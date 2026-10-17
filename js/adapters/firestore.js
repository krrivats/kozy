// FirestoreAdapter — same interface as LocalAdapter, but data lives in Firestore so both phones share it.
// Layout: households/{HOUSEHOLD_ID}              (the ONE shared household document)
//         households/{HOUSEHOLD_ID}/{col}/{id}   (entries, items, stock, milk, meta)
//         households/{HOUSEHOLD_ID}/devices/{id} (phones that turned on reminders)
// Firebase SDK comes from the official CDN (modular build) — no npm, no build step.
// OFF until config.js says USE_FIREBASE = true.
import { firebaseConfig, VAPID_KEY } from '../firebase-config.js';
import { HOUSEHOLD_ID, MEMBERS as REAL_MEMBERS, EMULATOR, EMULATOR_MEMBERS } from '../config.js';

const MEMBERS = EMULATOR ? EMULATOR_MEMBERS : REAL_MEMBERS;

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const COLLECTIONS = ['entries', 'items', 'stock', 'milk', 'meta'];

// Firestore rejects `undefined` values.
function clean(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export class FirestoreAdapter {
  name = 'firestore';
  needsAuth = true;
  user = null;
  unsubs = [];

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
    this.db = fsMod.initializeFirestore(app, EMULATOR ? {} : {
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

  #member() {
    const email = (this.user?.email || '').toLowerCase();
    const key = Object.keys(MEMBERS).find((k) => k.toLowerCase() === email);
    return key ? MEMBERS[key] : null;
  }

  userLabel() {
    return this.#member()?.label || this.user?.displayName?.split(' ')[0] || this.user?.email || 'Me';
  }

  // Unknown emails get no role: the app shows "not allowed" and the rules block them anyway.
  role() { return this.#member()?.role || null; }

  userEmail() { return this.user?.email || ''; }

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

  async createEmailAccount(email, password) {
    const res = await this.A.createUserWithEmailAndPassword(this.auth, email, password);
    // firestore.rules only trusts verified emails, so send the verification mail right away.
    await this.A.sendEmailVerification(res.user);
    this.user = res.user;
    return res.user;
  }

  async signOut() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    await this.A.signOut(this.auth);
    this.user = null;
  }

  // Phone reminders: ask permission, get this phone's push token, save it for the daily reminder job.
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
    await this.F.setDoc(this.F.doc(this.db, 'households', HOUSEHOLD_ID, 'devices', id), {
      token, email: this.userEmail(), label: this.userLabel(), ua: navigator.userAgent.slice(0, 120), createdAt: Date.now(),
    });
    return true;
  }

  #colRef(col) {
    return this.F.collection(this.db, 'households', HOUSEHOLD_ID, col);
  }

  #docRef(col, id) {
    return this.F.doc(this.db, 'households', HOUSEHOLD_ID, col, id);
  }

  // Loads every collection and keeps listening. onRemote(col, docs) fires on later changes.
  async load(onRemote, cols = COLLECTIONS) {
    const F = this.F;
    if (this.role() === 'owner') {
      await F.setDoc(F.doc(this.db, 'households', HOUSEHOLD_ID),
        { name: 'Kozy home', lastSeenAt: Date.now() }, { merge: true });
    }

    const data = {};
    await Promise.all(cols.map((col) => new Promise((resolve, reject) => {
      let first = true;
      const unsub = F.onSnapshot(this.#colRef(col), (snap) => {
        const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        if (first) { first = false; data[col] = docs; resolve(); }
        else onRemote?.(col, docs);
      }, (err) => { if (first) reject(err); else console.error(col, err); });
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
