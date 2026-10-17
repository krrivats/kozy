// firestore.rules tests (run inside the Firestore emulator): owner / member / viewer / stranger.
// The real rules file is copied with test emails filled in, so the placeholders stay untouched.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  .replace(/'ME_EMAIL'/g, "'me@test.com'")
  .replace(/'WIFE_EMAIL'/g, "'wife@test.com'")
  .replace(/'VIEWER_EMAIL'/g, "'papa@test.com'");

let env;
const H = 'households/kozy-home';
const as = (email, verified = true) => env.authenticatedContext(email.split('@')[0], { email, email_verified: verified }).firestore();

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-kozy', firestore: { rules, host: '127.0.0.1', port: 8085 } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, H), { name: 'Kozy home' });
    await setDoc(doc(db, `${H}/entries/owner1`), { amount: 999, by: 'Me', byEmail: 'me@test.com' });
    await setDoc(doc(db, `${H}/entries/wife1`), { amount: 120, by: 'Wife', byEmail: 'wife@test.com' });
    await setDoc(doc(db, `${H}/meta/cats`), { value: [] });
    await setDoc(doc(db, `${H}/meta/billState`), { value: {} });
    await setDoc(doc(db, `${H}/devices/d1`), { token: 't', email: 'wife@test.com' });
  });
});

test('owner can read and write everything', async () => {
  const db = as('me@test.com');
  await assertSucceeds(getDoc(doc(db, `${H}/entries/wife1`)));
  await assertSucceeds(updateDoc(doc(db, `${H}/entries/wife1`), { amount: 130 }));
  await assertSucceeds(deleteDoc(doc(db, `${H}/entries/wife1`)));
  await assertSucceeds(setDoc(doc(db, `${H}/meta/cats`), { value: [1] }));
  await assertSucceeds(getDocs(collection(db, `${H}/devices`)));
  await assertSucceeds(setDoc(doc(db, H), { name: 'x' }));
});

test('member (wife): reads all, adds own spends, cannot touch owner spends or setup', async () => {
  const db = as('wife@test.com');
  await assertSucceeds(getDoc(doc(db, `${H}/entries/owner1`)));
  await assertSucceeds(getDocs(collection(db, `${H}/entries`)));
  await assertSucceeds(setDoc(doc(db, `${H}/entries/new1`), { amount: 50, byEmail: 'wife@test.com' }));
  await assertFails(setDoc(doc(db, `${H}/entries/new2`), { amount: 50, byEmail: 'me@test.com' })); // can't pretend to be owner
  await assertSucceeds(updateDoc(doc(db, `${H}/entries/wife1`), { amount: 125 }));
  await assertFails(updateDoc(doc(db, `${H}/entries/owner1`), { amount: 1 }));
  await assertFails(deleteDoc(doc(db, `${H}/entries/owner1`)));
  await assertFails(updateDoc(doc(db, `${H}/entries/wife1`), { byEmail: 'me@test.com' })); // can't hand it to owner
  await assertSucceeds(deleteDoc(doc(db, `${H}/entries/wife1`)));
  await assertSucceeds(setDoc(doc(db, `${H}/stock/s1`), { itemId: 'item-atta', type: 'bought' }));
  await assertSucceeds(setDoc(doc(db, `${H}/items/i1`), { en: 'Jaggery' }));
  await assertSucceeds(setDoc(doc(db, `${H}/milk/2026-10-17`), { litres: 4 }));
  await assertSucceeds(setDoc(doc(db, `${H}/meta/billState`), { value: { 'b-gas': {} } }));
  await assertFails(setDoc(doc(db, `${H}/meta/cats`), { value: [] }));
  await assertFails(setDoc(doc(db, `${H}/meta/bills`), { value: [] }));
  await assertFails(setDoc(doc(db, H), { name: 'x' }));
  await assertFails(getDocs(collection(db, `${H}/devices`)));
  await assertSucceeds(setDoc(doc(db, `${H}/devices/d2`), { token: 't2', email: 'wife@test.com' }));
  await assertFails(setDoc(doc(db, `${H}/devices/d3`), { token: 't3', email: 'me@test.com' }));
});

test('viewer reads everything, writes nothing', async () => {
  const db = as('papa@test.com');
  await assertSucceeds(getDoc(doc(db, `${H}/entries/owner1`)));
  await assertSucceeds(getDocs(collection(db, `${H}/stock`)));
  await assertFails(setDoc(doc(db, `${H}/entries/v1`), { amount: 1, byEmail: 'papa@test.com' }));
  await assertFails(setDoc(doc(db, `${H}/stock/v1`), { type: 'bought' }));
  await assertFails(setDoc(doc(db, `${H}/milk/2026-10-17`), { litres: 1 }));
  await assertFails(setDoc(doc(db, `${H}/meta/billState`), { value: {} }));
  await assertSucceeds(setDoc(doc(db, `${H}/devices/v1`), { token: 'tv', email: 'papa@test.com' })); // may get reminders
});

test('strangers, unverified emails and signed-out users get nothing', async () => {
  await assertFails(getDoc(doc(as('someone@test.com'), `${H}/entries/owner1`)));
  await assertFails(getDoc(doc(as('me@test.com', false), `${H}/entries/owner1`))); // unverified look-alike
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `${H}/entries/owner1`)));
  await assertFails(getDoc(doc(as('me@test.com'), 'other/doc')));
});
