// FirestoreAdapter — same interface as LocalAdapter, but data lives in Firestore so both phones share it.
// Layout: households/{HOUSEHOLD_ID}            (the ONE shared household document)
//         households/{HOUSEHOLD_ID}/{col}/{id} (entries, items, stock, milk, meta)
// Firebase SDK comes from the official CDN (modular build) — no npm, no build step.
// OFF until config.js says USE_FIREBASE = true.
import { firebaseConfig } from '../firebase-config.js';
import { HOUSEHOLD_ID, MEMBERS } from '../config.js';

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
    const app = appMod.initializeApp(firebaseConfig);
    this.auth = authMod.getAuth(app);
    await authMod.setPersistence(this.auth, authMod.browserLocalPersistence);
    this.db = fsMod.initializeFirestore(app, {
      localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }),
    });
    // Finish a Google redirect sign-in if we are coming back from one.
    try { await authMod.getRedirectResult(this.auth); } catch (e) { console.warn('redirect result', e); }
    this.user = await new Promise((resolve) => {
      const off = authMod.onAuthStateChanged(this.auth, (u) => { off(); resolve(u); });
    });
  }

  isSignedIn() { return !!this.user; }

  userLabel() {
    const email = this.user?.email || '';
    return MEMBERS[email] || this.user?.displayName?.split(' ')[0] || email || 'Me';
  }

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

  #colRef(col) {
    return this.F.collection(this.db, 'households', HOUSEHOLD_ID, col);
  }

  #docRef(col, id) {
    return this.F.doc(this.db, 'households', HOUSEHOLD_ID, col, id);
  }

  // Loads every collection and keeps listening. onRemote(col, docs) fires on later changes.
  async load(onRemote) {
    const F = this.F;
    await F.setDoc(F.doc(this.db, 'households', HOUSEHOLD_ID),
      { name: 'Kozy home', lastSeenBy: this.userEmail(), lastSeenAt: Date.now() }, { merge: true });

    const data = {};
    await Promise.all(COLLECTIONS.map((col) => new Promise((resolve, reject) => {
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
