// FirestoreAdapter — same interface as LocalAdapter, but data lives in Firestore so the whole household shares it.
// Layout: memberships/{email}                    { hid, role: admin|editor|viewer, name, ... }  (one email = one household)
//         households/{hid}                       the household (name, createdBy)
//         households/{hid}/{col}/{id}            (entries, items, stock, milk, meta)
//         households/{hid}/devices/{id}          (phones that turned on reminders)
// Firebase SDK comes from the official CDN (modular build) — no npm, no build step.
import { firebaseConfig, VAPID_KEY } from '../firebase-config.js';
import { EMULATOR, LEGACY, LEGACY_HID, ROLE_TO_INTERNAL } from '../config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const COLLECTIONS = ['entries', 'items', 'stock', 'milk', 'meta'];

// Firestore rejects `undefined` values.
function clean(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Join codes: 8 letters/digits without look-alikes (no 0/O, 1/I/L).
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const normalizeCode = (raw) => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// A random, unguessable household id.
function newHid() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return `h${[...b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

export class FirestoreAdapter {
  name = 'firestore';
  needsAuth = true;
  user = null;
  unsubs = [];
  hid = null;
  membership = null; // { hid, role, name, ... } of the signed-in person
  householdName = '';
  pendingSetup = null; // { budget, demo } chosen on the onboarding screen, applied once after the first load
  onAccessLost = null; // set by app.js: called when Firestore stops letting us read (removed from the household)

  async init() {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    this.A = authMod;
    this.F = fsMod;
    const app = appMod.initializeApp(EMULATOR ? { apiKey: 'demo-key', projectId: 'demo-kozy', authDomain: 'localhost' } : firebaseConfig);
    this.app = app;
    this.auth = authMod.getAuth(app);
    if (EMULATOR) authMod.connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    await authMod.setPersistence(this.auth, authMod.browserLocalPersistence);
    // experimentalAutoDetectLongPolling: some phones/networks block Firestore's streaming connection ("client is offline").
    this.db = fsMod.initializeFirestore(app, EMULATOR ? {} : {
      experimentalAutoDetectLongPolling: true,
      localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }),
    });
    if (EMULATOR) fsMod.connectFirestoreEmulator(this.db, '127.0.0.1', 8085);
    // Finish a Google redirect sign-in if we are coming back from one.
    try { await authMod.getRedirectResult(this.auth); } catch (e) { console.warn('redirect result', e); }
    this.user = await new Promise((resolve) => {
      const off = authMod.onAuthStateChanged(this.auth, (u) => { off(); resolve(u); });
    });
  }

  isSignedIn() { return !!this.user; }

  // ---------- who am I ----------
  // 'owner' (admin) | 'member' (editor) | 'viewer' | null (no household yet)
  role() { return ROLE_TO_INTERNAL[this.membership?.role] || null; }

  // The membership role as written in Firestore: admin | editor | viewer.
  memberRole() { return this.membership?.role || null; }

  userLabel() {
    return this.membership?.name || this.user?.displayName?.split(' ')[0] || (this.user?.email || 'Me').split('@')[0];
  }

  userEmail() { return (this.user?.email || '').toLowerCase(); }

  #displayName() {
    return (this.user?.displayName || '').trim() || (this.user?.email || 'Me').split('@')[0];
  }

  #isLegacy() {
    const email = this.userEmail();
    return !!LEGACY[email] && (this.user?.providerData || []).some((p) => p.providerId === 'password');
  }

  #memRef(email) { return this.F.doc(this.db, 'memberships', email); }

  // ---------- sign in / up ----------
  async signInGoogle() {
    const provider = new this.A.GoogleAuthProvider();
    // Popups are unreliable in an iPhone home-screen app, so use redirect there.
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (standalone) {
      await this.A.signInWithRedirect(this.auth, provider);
      return null;
    }
    const res = await this.A.signInWithPopup(this.auth, provider);
    this.user = res.user;
    return res.user;
  }

  async signInEmail(email, password) {
    const res = await this.A.signInWithEmailAndPassword(this.auth, email, password);
    this.user = res.user;
    return res.user;
  }

  async createEmailAccount(name, email, password) {
    const res = await this.A.createUserWithEmailAndPassword(this.auth, email, password);
    if (name) await this.A.updateProfile(res.user, { displayName: name });
    // firestore.rules only trusts verified emails, so send the verification mail right away.
    await this.A.sendEmailVerification(res.user);
    this.user = res.user;
    return res.user;
  }

  async resendVerification() {
    await this.A.sendEmailVerification(this.user);
  }

  // After the person taps the verify link in their mail: refresh the user and the token (the rules read email_verified from it).
  async reloadUser() {
    if (!this.user) return null;
    await this.user.reload();
    await this.user.getIdToken(true);
    this.user = this.auth.currentUser;
    return this.user;
  }

  async sendReset(email) {
    await this.A.sendPasswordResetEmail(this.auth, email);
  }

  async signOut() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    await this.A.signOut(this.auth);
    this.user = null;
    this.membership = null;
    this.hid = null;
  }

  // The very first read on a phone can fail with "client is offline" while the connection is still opening: try a few times.
  async #getDocRetry(ref) {
    let last;
    for (let i = 0; i < 4; i++) {
      try { return await this.F.getDoc(ref); } catch (e) {
        last = e;
        if (!/offline|unavailable/i.test(`${e?.code} ${e?.message}`)) throw e;
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      }
    }
    throw last;
  }

  // ---------- where does this person belong? ----------
  // → { state: 'signed-out' | 'unverified' | 'no-household' | 'ready' }
  async resolve() {
    const F = this.F;
    if (!this.user) return { state: 'signed-out' };
    const legacy = this.#isLegacy();
    if (!this.user.emailVerified && !legacy) return { state: 'unverified' };
    const email = this.userEmail();
    const ref = this.#memRef(email);
    let snap = await this.#getDocRetry(ref);
    if (!snap.exists() && legacy) {
      // The two old family accounts claim the old household (rules allow exactly this).
      const now = Date.now();
      await F.setDoc(ref, { hid: LEGACY_HID, role: LEGACY[email].role, name: LEGACY[email].name, addedBy: email, addedAt: now, joinedAt: now, uid: this.user.uid });
      snap = await this.#getDocRetry(ref);
    }
    if (!snap.exists()) { this.membership = null; this.hid = null; return { state: 'no-household' }; }
    const m = snap.data();
    this.membership = m;
    this.hid = m.hid;
    if (!m.joinedAt || m.uid !== this.user.uid) {
      // First time this person is in: mark them as joined (the Household list shows Joined instead of Invited).
      const patch = { joinedAt: m.joinedAt || Date.now(), uid: this.user.uid };
      try { await F.updateDoc(ref, patch); this.membership = { ...m, ...patch }; } catch (e) { console.warn('joinedAt', e); }
    }
    try {
      const h = await F.getDoc(F.doc(this.db, 'households', this.hid));
      this.householdName = h.exists() ? (h.data().name || '') : '';
    } catch (e) { console.warn('household name', e); }
    return { state: 'ready' };
  }

  // Is this person still in the same household with the same role? One small read from the server.
  // → 'ok' | 'removed' | 'changed' | 'unknown' (offline). Firestore listeners are NOT re-checked when only the membership doc changes.
  async checkMembership() {
    try {
      const snap = await this.F.getDocFromServer(this.#memRef(this.userEmail()));
      if (!snap.exists()) return 'removed';
      const m = snap.data();
      return m.hid !== this.hid || m.role !== this.membership?.role ? 'changed' : 'ok';
    } catch (e) {
      return e?.code === 'permission-denied' ? 'removed' : 'unknown';
    }
  }

  // Start a brand-new household: it and its first admin membership are written in ONE batch (the rules require that).
  async createHousehold({ name }) {
    const F = this.F;
    const email = this.userEmail();
    const hid = newHid();
    const now = Date.now();
    const person = this.#displayName();
    const batch = F.writeBatch(this.db);
    batch.set(F.doc(this.db, 'households', hid), { name: String(name || '').trim() || `${person}’s home`, createdBy: email });
    batch.set(this.#memRef(email), { hid, role: 'admin', name: person, addedBy: email, addedAt: now, joinedAt: now, uid: this.user.uid });
    await batch.commit();
  }

  // ---------- household + people (Settings → Household) ----------
  async renameHousehold(name) {
    const n = String(name || '').trim();
    if (!n) return;
    await this.F.updateDoc(this.F.doc(this.db, 'households', this.hid), { name: n });
    this.householdName = n;
  }

  async listMembers() {
    const F = this.F;
    const snap = await F.getDocs(F.query(F.collection(this.db, 'memberships'), F.where('hid', '==', this.hid)));
    return snap.docs.map((d) => ({ ...d.data(), email: d.id }));
  }

  async addMember({ name, email, role }) {
    const e = String(email || '').trim().toLowerCase();
    try {
      await this.F.setDoc(this.#memRef(e), { hid: this.hid, role, name: String(name || '').trim() || e.split('@')[0], addedBy: this.userEmail(), addedAt: Date.now() });
    } catch (err) {
      if (err?.code === 'permission-denied') {
        const x = new Error('Could not add this email. It may already be in another household.');
        x.code = 'already-elsewhere';
        throw x;
      }
      throw err;
    }
  }

  async setMemberRole(email, role) {
    await this.F.updateDoc(this.#memRef(email), { role });
    if (email === this.userEmail()) this.membership = { ...this.membership, role };
  }

  async removeMember(email) {
    await this.F.deleteDoc(this.#memRef(email));
  }

  async leaveHousehold() {
    await this.F.deleteDoc(this.#memRef(this.userEmail()));
    this.membership = null;
    this.hid = null;
  }

  // ---------- invite codes ----------
  // The admin makes a code for an Editor or Viewer; whoever enters it (after signing up) lands inside this household.
  async createInvite(role, days = 7) {
    const b = crypto.getRandomValues(new Uint8Array(8));
    const code = [...b].map((x) => CODE_CHARS[x % CODE_CHARS.length]).join('');
    await this.F.setDoc(this.F.doc(this.db, 'invites', code), {
      hid: this.hid, role, createdBy: this.userEmail(), createdAt: Date.now(), expiresAt: Date.now() + days * 86400000,
    });
    return code;
  }

  async listInvites() {
    const F = this.F;
    const snap = await F.getDocs(F.query(F.collection(this.db, 'invites'), F.where('hid', '==', this.hid)));
    return snap.docs.map((d) => ({ ...d.data(), code: d.id })).filter((i) => i.expiresAt > Date.now()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async revokeInvite(code) {
    await this.F.deleteDoc(this.F.doc(this.db, 'invites', code));
  }

  // Join a household with a code. Throws an Error with a plain message when the code does not work.
  async joinWithCode(raw) {
    const code = normalizeCode(raw);
    if (code.length < 6) throw new Error('Type the code the admin sent you.');
    const snap = await this.#getDocRetry(this.F.doc(this.db, 'invites', code));
    if (!snap.exists()) throw new Error('That code is not valid. Check it with the admin.');
    const inv = snap.data();
    if (inv.expiresAt <= Date.now()) throw new Error('This code has expired. Ask the admin for a new one.');
    const now = Date.now();
    try {
      await this.F.setDoc(this.#memRef(this.userEmail()), {
        hid: inv.hid, role: inv.role, name: this.#displayName(), addedBy: 'code', addedAt: now, joinedAt: now, uid: this.user.uid, code,
      });
    } catch (e) {
      if (e?.code === 'permission-denied') throw new Error('This code could not be used. You may already be in a household.');
      throw e;
    }
  }

  // ---------- delete ----------
  // Removes the whole household: all data, people, codes, phones. Admin only (the rules check it too).
  async deleteHousehold() {
    const F = this.F;
    const me = this.userEmail();
    const refs = [];
    for (const col of [...COLLECTIONS, 'devices']) {
      (await F.getDocs(this.#colRef(col))).docs.forEach((d) => refs.push(d.ref));
    }
    (await F.getDocs(F.query(F.collection(this.db, 'invites'), F.where('hid', '==', this.hid)))).docs.forEach((d) => refs.push(d.ref));
    (await F.getDocs(F.query(F.collection(this.db, 'memberships'), F.where('hid', '==', this.hid)))).docs
      .filter((d) => d.id !== me).forEach((d) => refs.push(d.ref));
    refs.push(F.doc(this.db, 'households', this.hid));
    for (let i = 0; i < refs.length; i += 450) {
      const batch = F.writeBatch(this.db);
      refs.slice(i, i + 450).forEach((r) => batch.delete(r));
      await batch.commit();
    }
    await F.deleteDoc(this.#memRef(me)); // last: the admin needs their own membership until everything else is gone
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.membership = null;
    this.hid = null;
  }

  // Firebase only lets you delete your account if you signed in a few minutes ago.
  signedInRecently() {
    const t = Date.parse(this.user?.metadata?.lastSignInTime || '');
    return EMULATOR || (t && Date.now() - t < 4 * 60000);
  }

  async deleteAccount() {
    if (this.membership?.role === 'admin') await this.deleteHousehold(); // the caller checked no one else is in it
    else if (this.membership) { this.unsubs.forEach((u) => u()); this.unsubs = []; await this.leaveHousehold(); }
    await this.A.deleteUser(this.user);
    this.user = null;
  }

  // ---------- phone reminders ----------
  // Ask permission, get this phone's push token, save it for the daily reminder job.
  async enablePush() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      throw new Error('This browser can’t show reminders. On iPhone: add Kozy to the Home Screen and open it from there.');
    }
    if (!VAPID_KEY || VAPID_KEY.startsWith('PASTE')) throw new Error('Add VAPID_KEY in firebase-config.js first (see MORNING_REPORT.md).');
    const M = await import(`${SDK}/firebase-messaging.js`);
    if (!(await M.isSupported())) throw new Error('Reminders are not supported here. On iPhone: open Kozy from the Home Screen icon (iOS 16.4 or newer).');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Notifications were not allowed. Turn them on in phone Settings → Kozy.');
    const reg = await navigator.serviceWorker.ready;
    const token = await M.getToken(M.getMessaging(this.app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const id = [...new Uint8Array(hash)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
    await this.F.setDoc(this.F.doc(this.db, 'households', this.hid, 'devices', id), {
      token, email: this.userEmail(), label: this.userLabel(), ua: navigator.userAgent.slice(0, 120), createdAt: Date.now(),
    });
    return true;
  }

  // ---------- data ----------
  #colRef(col) {
    return this.F.collection(this.db, 'households', this.hid, col);
  }

  #docRef(col, id) {
    return this.F.doc(this.db, 'households', this.hid, col, id);
  }

  // Loads every collection and keeps listening. onRemote(col, docs) fires on later changes.
  async load(onRemote, cols = COLLECTIONS) {
    const F = this.F;
    const data = {};
    await Promise.all(cols.map((col) => new Promise((resolve, reject) => {
      let first = true;
      const unsub = F.onSnapshot(this.#colRef(col), (snap) => {
        const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        if (first) { first = false; data[col] = docs; resolve(); }
        else onRemote?.(col, docs);
      }, (err) => {
        if (first) reject(err);
        else if (err?.code === 'permission-denied') this.onAccessLost?.(); // removed from the household while the app was open
        else console.error(col, err);
      });
      this.unsubs.push(unsub);
    })));
    return data;
  }

  async write(col, doc) {
    await this.F.setDoc(this.#docRef(col, doc.id), clean(doc));
  }

  async delete(col, id) {
    await this.F.deleteDoc(this.#docRef(col, id));
  }

  // Used by Reset and Import. Firestore batches max 500 ops, so chunk.
  async replaceAll(data) {
    const F = this.F;
    const ops = [];
    for (const col of COLLECTIONS) {
      const snap = await F.getDocs(this.#colRef(col));
      snap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
      for (const doc of data[col] || []) ops.push((b) => b.set(this.#docRef(col, doc.id), clean(doc)));
    }
    for (let i = 0; i < ops.length; i += 450) {
      const batch = F.writeBatch(this.db);
      ops.slice(i, i + 450).forEach((op) => op(batch));
      await batch.commit();
    }
  }
}
