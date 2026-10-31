// firestore.rules tests (Firestore emulator): many households, admin / editor / viewer, hijack attempts.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch,
} from 'firebase/firestore';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
let env;
const M = (email) => `memberships/${email}`;

// A signed-in user. Defaults: Google account with a verified email.
const as = (email, { verified = true, provider = 'google.com' } = {}) =>
  env.authenticatedContext(email.split('@')[0], { email, email_verified: verified, firebase: { sign_in_provider: provider } }).firestore();

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-kozy', firestore: { rules, host: '127.0.0.1', port: 8085 } });
});
after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const mem = (email, hid, role) => setDoc(doc(db, M(email)), { hid, role, name: email.split('@')[0], addedBy: 'x', addedAt: 1 });
    await mem('a1@t.com', 'h1', 'admin');
    await mem('e1@t.com', 'h1', 'editor');
    await mem('v1@t.com', 'h1', 'viewer');
    await mem('a2@t.com', 'h2', 'admin');
    for (const [hid, by] of [['h1', 'a1@t.com'], ['h2', 'a2@t.com']]) {
      await setDoc(doc(db, `households/${hid}`), { name: hid, createdBy: by });
      await setDoc(doc(db, `households/${hid}/entries/own`), { amount: 100, byEmail: by });
      await setDoc(doc(db, `households/${hid}/items/i1`), { en: 'Atta' });
      await setDoc(doc(db, `households/${hid}/stock/s1`), { type: 'bought' });
      await setDoc(doc(db, `households/${hid}/milk/2026-10-17`), { litres: 3 });
      await setDoc(doc(db, `households/${hid}/meta/cats`), { value: [] });
      await setDoc(doc(db, `households/${hid}/meta/billState`), { value: {} });
      await setDoc(doc(db, `households/${hid}/devices/d1`), { token: 't', email: by });
    }
    await setDoc(doc(db, 'households/h1/entries/byE'), { amount: 50, byEmail: 'e1@t.com' });
    // the old family household (no membership docs yet)
    await setDoc(doc(db, 'households/kozy-home'), { name: 'Kozy home' });
    await setDoc(doc(db, 'households/kozy-home/entries/old1'), { amount: 999, byEmail: 'krrish@krrivats.app' });
  });
});

// ---------------------------------------------------------------- isolation
test('households are isolated from each other', async () => {
  const a1 = as('a1@t.com');
  await assertSucceeds(getDoc(doc(a1, 'households/h1/entries/own')));
  await assertFails(getDoc(doc(a1, 'households/h2/entries/own')));
  await assertFails(getDocs(collection(a1, 'households/h2/entries')));
  await assertFails(getDoc(doc(a1, 'households/h2')));
  await assertFails(setDoc(doc(a1, 'households/h2/entries/hack'), { amount: 1, byEmail: 'a1@t.com' }));
  await assertFails(setDoc(doc(a1, 'households/h2/meta/cats'), { value: [1] }));
  await assertFails(deleteDoc(doc(a1, 'households/h2/entries/own')));
  const a2 = as('a2@t.com');
  await assertFails(getDoc(doc(a2, 'households/h1/entries/own')));
  await assertFails(getDoc(doc(a2, 'households/h1/items/i1')));
});

test('a verified user with no household sees nothing', async () => {
  const n = as('nobody@t.com');
  await assertFails(getDoc(doc(n, 'households/h1')));
  await assertFails(getDoc(doc(n, 'households/h1/entries/own')));
  await assertFails(getDocs(collection(n, 'households/h1/entries')));
  await assertFails(getDoc(doc(n, M('a1@t.com'))));
  await assertFails(getDoc(doc(n, 'households/kozy-home/entries/old1')));
  await assertSucceeds(getDoc(doc(n, M('nobody@t.com')))); // may check that they have no membership
});

test('signed-out users get nothing', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'households/h1/entries/own')));
  await assertFails(getDoc(doc(db, M('a1@t.com'))));
  await assertFails(setDoc(doc(db, 'households/hx'), { createdBy: 'x' }));
});

// ---------------------------------------------------------------- unverified emails
test('an unverified email gets nothing, even if that email was invited (anti-hijack)', async () => {
  const fake = as('e1@t.com', { verified: false, provider: 'password' });
  await assertFails(getDoc(doc(fake, 'households/h1/entries/own')));
  await assertFails(getDoc(doc(fake, M('e1@t.com'))));
  await assertFails(setDoc(doc(fake, 'households/h1/entries/x'), { amount: 1, byEmail: 'e1@t.com' }));
  const fakeAdmin = as('a1@t.com', { verified: false, provider: 'password' });
  await assertFails(getDoc(doc(fakeAdmin, 'households/h1')));
  await assertFails(setDoc(doc(fakeAdmin, M('x@t.com')), { hid: 'h1', role: 'admin', name: 'x' }));
});

// ---------------------------------------------------------------- roles inside a household
test('admin: everything in their household', async () => {
  const a = as('a1@t.com');
  await assertSucceeds(updateDoc(doc(a, 'households/h1/entries/byE'), { amount: 60 }));
  await assertSucceeds(setDoc(doc(a, 'households/h1/entries/n1'), { amount: 5, byEmail: 'a1@t.com' }));
  await assertSucceeds(deleteDoc(doc(a, 'households/h1/entries/byE')));
  await assertSucceeds(setDoc(doc(a, 'households/h1/meta/cats'), { value: [1] }));
  await assertSucceeds(setDoc(doc(a, 'households/h1/meta/budgetTotal'), { value: 30000 }));
  await assertSucceeds(updateDoc(doc(a, 'households/h1'), { name: 'Sharma home' }));
  await assertSucceeds(getDocs(collection(a, 'households/h1/devices')));
  await assertSucceeds(setDoc(doc(a, 'households/h1/items/i2'), { en: 'Rice' }));
});

test('editor: add, edit and delete ANY entry; no setup, no people, no rename', async () => {
  const e = as('e1@t.com');
  await assertSucceeds(getDoc(doc(e, 'households/h1/entries/own')));
  await assertSucceeds(setDoc(doc(e, 'households/h1/entries/n2'), { amount: 7, byEmail: 'e1@t.com' }));
  await assertFails(setDoc(doc(e, 'households/h1/entries/n3'), { amount: 7, byEmail: 'a1@t.com' })); // can't sign as the admin
  await assertSucceeds(updateDoc(doc(e, 'households/h1/entries/own'), { amount: 120 }));            // admin's entry
  await assertFails(updateDoc(doc(e, 'households/h1/entries/own'), { byEmail: 'e1@t.com' }));       // can't take credit
  await assertSucceeds(deleteDoc(doc(e, 'households/h1/entries/own')));
  await assertSucceeds(setDoc(doc(e, 'households/h1/stock/s2'), { type: 'bought' }));
  await assertSucceeds(setDoc(doc(e, 'households/h1/items/i3'), { en: 'Salt' }));
  await assertSucceeds(setDoc(doc(e, 'households/h1/milk/2026-10-18'), { litres: 4 }));
  await assertSucceeds(setDoc(doc(e, 'households/h1/meta/billState'), { value: { b: 1 } }));
  await assertFails(setDoc(doc(e, 'households/h1/meta/cats'), { value: [] }));
  await assertFails(setDoc(doc(e, 'households/h1/meta/budgetTotal'), { value: 1 }));
  await assertFails(setDoc(doc(e, 'households/h1/meta/family'), { value: [] }));
  await assertFails(updateDoc(doc(e, 'households/h1'), { name: 'mine now' }));
  await assertFails(deleteDoc(doc(e, 'households/h1')));
  await assertFails(getDocs(collection(e, 'households/h1/devices')));
  await assertSucceeds(setDoc(doc(e, 'households/h1/devices/d2'), { token: 't2', email: 'e1@t.com' }));
  await assertFails(setDoc(doc(e, 'households/h1/devices/d3'), { token: 't3', email: 'a1@t.com' }));
});

test('viewer: reads everything in the household, changes nothing', async () => {
  const v = as('v1@t.com');
  await assertSucceeds(getDoc(doc(v, 'households/h1')));
  await assertSucceeds(getDocs(collection(v, 'households/h1/entries')));
  await assertSucceeds(getDocs(collection(v, 'households/h1/stock')));
  await assertSucceeds(getDoc(doc(v, 'households/h1/meta/cats')));
  await assertFails(setDoc(doc(v, 'households/h1/entries/v1'), { amount: 1, byEmail: 'v1@t.com' }));
  await assertFails(updateDoc(doc(v, 'households/h1/entries/own'), { amount: 1 }));
  await assertFails(deleteDoc(doc(v, 'households/h1/entries/own')));
  await assertFails(setDoc(doc(v, 'households/h1/stock/v1'), { type: 'bought' }));
  await assertFails(setDoc(doc(v, 'households/h1/milk/2026-10-19'), { litres: 1 }));
  await assertFails(setDoc(doc(v, 'households/h1/meta/billState'), { value: {} }));
  await assertSucceeds(setDoc(doc(v, 'households/h1/devices/vd'), { token: 'tv', email: 'v1@t.com' })); // may get reminders
});

// ---------------------------------------------------------------- managing people
test('admin lists, adds, changes and removes people of THEIR household only', async () => {
  const a = as('a1@t.com');
  const mine = await assertSucceeds(getDocs(query(collection(a, 'memberships'), where('hid', '==', 'h1'))));
  if (mine.size !== 3) throw new Error(`expected 3 members, got ${mine.size}`);
  await assertFails(getDocs(query(collection(a, 'memberships'), where('hid', '==', 'h2')))); // other household
  await assertFails(getDocs(collection(a, 'memberships')));                                  // no unfiltered list

  await assertSucceeds(setDoc(doc(a, M('new@t.com')), { hid: 'h1', role: 'editor', name: 'New', addedBy: 'a1@t.com', addedAt: 2 }));
  await assertSucceeds(getDoc(doc(a, M('new@t.com'))));
  await assertSucceeds(updateDoc(doc(a, M('new@t.com')), { role: 'viewer' }));
  await assertSucceeds(updateDoc(doc(a, M('e1@t.com')), { role: 'admin' }));   // several admins
  await assertSucceeds(deleteDoc(doc(a, M('new@t.com'))));

  await assertFails(setDoc(doc(a, M('x@t.com')), { hid: 'h2', role: 'admin', name: 'X', addedBy: 'a1@t.com', addedAt: 2 })); // into another household
  await assertFails(setDoc(doc(a, M('a2@t.com')), { hid: 'h1', role: 'viewer', name: 'steal', addedBy: 'a1@t.com', addedAt: 2 })); // overwrite someone else's
  await assertFails(getDoc(doc(a, M('a2@t.com'))));
  await assertFails(deleteDoc(doc(a, M('a2@t.com'))));
  await assertFails(updateDoc(doc(a, M('a2@t.com')), { role: 'viewer' }));
  await assertFails(updateDoc(doc(a, M('v1@t.com')), { hid: 'h2' })); // can't move a person to another household
});

test('editor and viewer can NOT manage people', async () => {
  for (const email of ['e1@t.com', 'v1@t.com']) {
    const u = as(email);
    await assertFails(getDocs(query(collection(u, 'memberships'), where('hid', '==', 'h1'))));
    await assertFails(setDoc(doc(u, M('new@t.com')), { hid: 'h1', role: 'viewer', name: 'N', addedBy: email, addedAt: 2 }));
    await assertFails(updateDoc(doc(u, M('v1@t.com')), { role: 'admin' }));
    await assertFails(updateDoc(doc(u, M(email)), { role: 'admin' }));     // can't promote yourself
    await assertFails(deleteDoc(doc(u, M('a1@t.com'))));
    await assertSucceeds(getDoc(doc(u, M(email))));                        // can read their own
  }
});

test('anyone can touch their own name / joinedAt, and can leave', async () => {
  const e = as('e1@t.com');
  await assertSucceeds(updateDoc(doc(e, M('e1@t.com')), { name: 'Meena', joinedAt: 5, uid: 'u' }));
  await assertSucceeds(deleteDoc(doc(e, M('e1@t.com'))));
  await assertFails(getDoc(doc(e, 'households/h1/entries/own'))); // gone → locked out at once
  await assertFails(updateDoc(doc(as('v1@t.com'), M('v1@t.com')), { hid: 'h2' }));
});

// ---------------------------------------------------------------- starting a household
test('a new verified user starts a household (household + first admin in one batch)', async () => {
  const n = as('n1@t.com');
  const b = writeBatch(n);
  b.set(doc(n, 'households/hn'), { name: 'New home', createdBy: 'n1@t.com', createdAt: 1 });
  b.set(doc(n, M('n1@t.com')), { hid: 'hn', role: 'admin', name: 'N', addedBy: 'n1@t.com', addedAt: 1 });
  await assertSucceeds(b.commit());
  await assertSucceeds(setDoc(doc(n, 'households/hn/entries/e'), { amount: 1, byEmail: 'n1@t.com' }));
  await assertSucceeds(setDoc(doc(n, 'households/hn/meta/budgetTotal'), { value: 30000 }));
  await assertFails(getDoc(doc(n, 'households/h1/entries/own')));
  await assertFails(getDoc(doc(as('a1@t.com'), 'households/hn/entries/e'))); // and h1's admin can't see it
});

test('starting a household: abuse is refused', async () => {
  // second household for someone who already has one
  const a = as('a1@t.com');
  const b1 = writeBatch(a);
  b1.set(doc(a, 'households/h9'), { name: 'second', createdBy: 'a1@t.com' });
  b1.set(doc(a, M('a1@t.com')), { hid: 'h9', role: 'admin', name: 'A', addedBy: 'a1@t.com', addedAt: 1 });
  await assertFails(b1.commit());

  const n = as('n2@t.com');
  // membership alone, pointing at an existing household
  await assertFails(setDoc(doc(n, M('n2@t.com')), { hid: 'h1', role: 'admin', name: 'N', addedBy: 'n2@t.com', addedAt: 1 }));
  await assertFails(setDoc(doc(n, M('n2@t.com')), { hid: 'h1', role: 'viewer', name: 'N', addedBy: 'n2@t.com', addedAt: 1 }));
  // household alone
  await assertFails(setDoc(doc(n, 'households/hz'), { name: 'z', createdBy: 'n2@t.com' }));
  // household "created" in someone else's name
  const b2 = writeBatch(n);
  b2.set(doc(n, 'households/hy'), { name: 'y', createdBy: 'a1@t.com' });
  b2.set(doc(n, M('n2@t.com')), { hid: 'hy', role: 'admin', name: 'N', addedBy: 'n2@t.com', addedAt: 1 });
  await assertFails(b2.commit());
  // batch that takes over an existing household id
  const b3 = writeBatch(n);
  b3.set(doc(n, 'households/h1'), { name: 'mine', createdBy: 'n2@t.com' });
  b3.set(doc(n, M('n2@t.com')), { hid: 'h1', role: 'admin', name: 'N', addedBy: 'n2@t.com', addedAt: 1 });
  await assertFails(b3.commit());
  // a membership for someone else's email
  const b4 = writeBatch(n);
  b4.set(doc(n, 'households/hw'), { name: 'w', createdBy: 'n2@t.com' });
  b4.set(doc(n, M('someoneelse@t.com')), { hid: 'hw', role: 'admin', name: 'S', addedBy: 'n2@t.com', addedAt: 1 });
  await assertFails(b4.commit());
  // unverified email can't start one
  const u = as('n3@t.com', { verified: false, provider: 'password' });
  const b5 = writeBatch(u);
  b5.set(doc(u, 'households/hv'), { name: 'v', createdBy: 'n3@t.com' });
  b5.set(doc(u, M('n3@t.com')), { hid: 'hv', role: 'admin', name: 'V', addedBy: 'n3@t.com', addedAt: 1 });
  await assertFails(b5.commit());
  // extra fields are refused
  const b6 = writeBatch(n);
  b6.set(doc(n, 'households/hq'), { name: 'q', createdBy: 'n2@t.com' });
  b6.set(doc(n, M('n2@t.com')), { hid: 'hq', role: 'admin', name: 'N', addedBy: 'n2@t.com', addedAt: 1, superuser: true });
  await assertFails(b6.commit());
});

test('an invited person (verified) joins just by having a membership', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), M('invitee@t.com')), { hid: 'h1', role: 'viewer', name: 'Papa', addedBy: 'a1@t.com', addedAt: 1 });
  });
  const i = as('invitee@t.com', { provider: 'password' });
  await assertSucceeds(getDocs(collection(i, 'households/h1/entries')));
  await assertFails(getDocs(collection(i, 'households/h2/entries')));
});

// ---------------------------------------------------------------- the old family household
test('legacy family accounts keep working without any data move', async () => {
  const k = as('krrish@krrivats.app', { verified: false, provider: 'password' });
  await assertSucceeds(getDoc(doc(k, 'households/kozy-home/entries/old1')));
  await assertSucceeds(setDoc(doc(k, 'households/kozy-home/meta/cats'), { value: [] }));        // admin
  await assertFails(getDoc(doc(k, 'households/h1/entries/own')));                               // not other households
  const p = as('preeti@krrivats.app', { verified: false, provider: 'password' });
  await assertSucceeds(getDoc(doc(p, 'households/kozy-home/entries/old1')));
  await assertSucceeds(setDoc(doc(p, 'households/kozy-home/entries/n'), { amount: 1, byEmail: 'preeti@krrivats.app' }));
  await assertFails(setDoc(doc(p, 'households/kozy-home/meta/cats'), { value: [] }));           // editor: no setup
  // claim membership docs (so the Household screen lists them)
  await assertSucceeds(setDoc(doc(k, M('krrish@krrivats.app')), { hid: 'kozy-home', role: 'admin', name: 'Krrish', addedBy: 'system', addedAt: 1 }));
  await assertFails(setDoc(doc(p, M('preeti@krrivats.app')), { hid: 'kozy-home', role: 'admin', name: 'Preeti', addedBy: 'system', addedAt: 1 })); // not as admin
  await assertSucceeds(setDoc(doc(p, M('preeti@krrivats.app')), { hid: 'kozy-home', role: 'editor', name: 'Preeti', addedBy: 'system', addedAt: 1 }));
  // a stranger with a password account is NOT legacy
  const s = as('stranger@t.com', { verified: false, provider: 'password' });
  await assertFails(getDoc(doc(s, 'households/kozy-home/entries/old1')));
  // a Google account with the same email would need a verified email, but legacy only counts password accounts
  const g = as('krrish@krrivats.app', { verified: false, provider: 'google.com' });
  await assertFails(getDoc(doc(g, 'households/kozy-home/entries/old1')));
});

// ---------------------------------------------------------------- invite codes
const NOW = () => Date.now();
async function seedInvite(code, { hid = 'h1', role = 'editor', expiresAt = NOW() + 86400000 } = {}) {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `invites/${code}`), { hid, role, createdBy: 'a1@t.com', createdAt: 1, expiresAt }));
}
const joinDoc = (hid, role, code, extra = {}) => ({ hid, role, name: 'New', addedBy: 'code', addedAt: 1, code, ...extra });

test('invite codes: only the admin of a household makes, lists and deletes them', async () => {
  const a = as('a1@t.com');
  await assertSucceeds(setDoc(doc(a, 'invites/ABCD2345'), { hid: 'h1', role: 'editor', createdBy: 'a1@t.com', createdAt: 1, expiresAt: NOW() + 1000000 }));
  await assertSucceeds(getDocs(query(collection(a, 'invites'), where('hid', '==', 'h1'))));
  await assertSucceeds(deleteDoc(doc(a, 'invites/ABCD2345')));
  await assertFails(setDoc(doc(a, 'invites/ADMINCODE'), { hid: 'h1', role: 'admin', createdBy: 'a1@t.com', createdAt: 1, expiresAt: NOW() + 1000000 })); // no admin codes
  await assertFails(setDoc(doc(a, 'invites/OTHERHH1'), { hid: 'h2', role: 'editor', createdBy: 'a1@t.com', createdAt: 1, expiresAt: NOW() + 1000000 })); // not for another household
  const e = as('e1@t.com');
  await assertFails(setDoc(doc(e, 'invites/EDITORCD'), { hid: 'h1', role: 'viewer', createdBy: 'e1@t.com', createdAt: 1, expiresAt: NOW() + 1000000 }));
  await seedInvite('KEEP1234');
  await assertFails(deleteDoc(doc(e, 'invites/KEEP1234')));
  await assertFails(getDocs(query(collection(as('a2@t.com'), 'invites'), where('hid', '==', 'h1')))); // another admin can't list them
  await assertFails(getDocs(collection(as('n1@t.com'), 'invites')));                                      // nobody lists all codes
});

test('invite codes: a new verified person joins with a valid code, with exactly that household and role', async () => {
  await seedInvite('GOODCODE', { role: 'viewer' });
  const n = as('n1@t.com');
  await assertSucceeds(setDoc(doc(n, M('n1@t.com')), joinDoc('h1', 'viewer', 'GOODCODE')));
  await assertSucceeds(getDoc(doc(n, 'households/h1/entries/own')));
  await assertFails(setDoc(doc(n, 'households/h1/entries/x'), { amount: 1, byEmail: 'n1@t.com' })); // viewer
});

test('invite codes: wrong code, wrong role, wrong household, expired, unverified, or already in a household are refused', async () => {
  await seedInvite('VIEWONLY', { role: 'viewer' });
  await seedInvite('OLDCODE1', { expiresAt: NOW() - 1000 });
  const n = as('n1@t.com');
  await assertFails(setDoc(doc(n, M('n1@t.com')), joinDoc('h1', 'viewer', 'NOSUCHCD')));            // no such code
  await assertFails(setDoc(doc(n, M('n1@t.com')), joinDoc('h1', 'editor', 'VIEWONLY')));            // asks for more than the code gives
  await assertFails(setDoc(doc(n, M('n1@t.com')), joinDoc('h1', 'admin', 'VIEWONLY')));
  await assertFails(setDoc(doc(n, M('n1@t.com')), joinDoc('h2', 'viewer', 'VIEWONLY')));            // code is for h1, not h2
  await assertFails(setDoc(doc(n, M('n1@t.com')), joinDoc('h1', 'editor', 'OLDCODE1')));            // expired
  const u = as('n2@t.com', { verified: false, provider: 'password' });
  await assertFails(setDoc(doc(u, M('n2@t.com')), joinDoc('h1', 'viewer', 'VIEWONLY')));            // unverified
  const a2 = as('a2@t.com'); // already admin of h2: can't hop into h1 with a code
  await assertFails(setDoc(doc(a2, M('a2@t.com')), joinDoc('h1', 'viewer', 'VIEWONLY')));
  const other = as('n3@t.com');
  await assertFails(setDoc(doc(other, M('n4@t.com')), joinDoc('h1', 'viewer', 'VIEWONLY')));        // not for someone else's email
});

// ---------------------------------------------------------------- delete household
test('admin can delete their whole household (data, people, codes) but not another one', async () => {
  await seedInvite('TOGO1234');
  const a = as('a1@t.com');
  for (const p of ['entries/own', 'entries/byE', 'items/i1', 'stock/s1', 'milk/2026-10-17', 'meta/cats', 'meta/billState', 'devices/d1']) {
    await assertSucceeds(deleteDoc(doc(a, `households/h1/${p}`)));
  }
  await assertSucceeds(deleteDoc(doc(a, 'invites/TOGO1234')));
  await assertSucceeds(deleteDoc(doc(a, M('e1@t.com'))));
  await assertSucceeds(deleteDoc(doc(a, M('v1@t.com'))));
  await assertSucceeds(deleteDoc(doc(a, 'households/h1')));
  await assertSucceeds(deleteDoc(doc(a, M('a1@t.com'))));
  await assertFails(deleteDoc(doc(a, 'households/h2')));
  const e = as('e1@t.com');
  await assertFails(deleteDoc(doc(e, 'households/h2')));
});
