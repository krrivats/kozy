// The REAL app in Firebase mode, against the local Auth + Firestore emulators (with firestore.rules loaded).
// Run from tests-rules/:  npm run test:app   (skipped by the normal `npm test`)
// Story: sign up → verify → create a household → add an editor and a viewer → roles → a stranger is separate
//        → role change / removal → an old family account (krrish) still opens its old household.
import { test, expect } from '@playwright/test';

const AUTH = 'http://127.0.0.1:9099';
const FS = 'http://127.0.0.1:8085';
const FSDOC = `${FS}/v1/projects/demo-kozy/databases/(default)/documents`;
const T = '2026-10-17';
const URL_ = (hash = 'home') => `/?emulator=1&today=${T}#/${hash}`;
const PASS = 'secret123';
const shot = (page, name) => page.screenshot({ path: new URL(`../screenshots/${name}.png`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });

test.describe.configure({ mode: 'serial' });

const ctxs = [];
async function newPage(browser) {
  const ctx = await browser.newContext();
  ctxs.push(ctx);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return page;
}

// Create an account through the screen and verify it with the emulator button.
async function signUp(page, name, email) {
  await page.goto(URL_());
  await expect(page.locator('[data-test="tab-up"]')).toBeVisible({ timeout: 20000 });
  await page.locator('[data-test="tab-up"]').click();
  if (email === 'asha@test.com') await shot(page, 'auth-create-account');
  await page.locator('.login [name="name"]').fill(name);
  await page.locator('.login [name="email"]').fill(email);
  await page.locator('.login [name="password"]').fill(PASS);
  await page.locator('.login [data-test="submit"]').click();
  await expect(page.locator('[data-test="inbox-email"]')).toHaveText(email, { timeout: 20000 });
  if (email === 'asha@test.com') await shot(page, 'auth-check-inbox');
  await page.locator('[data-test="emu-verify"]').click();
}

async function signIn(page, email) {
  await page.goto(URL_());
  await expect(page.locator('[data-test="tab-in"]')).toBeVisible({ timeout: 20000 });
  await page.locator('.login [name="email"]').fill(email);
  await page.locator('.login [name="password"]').fill(PASS);
  await page.locator('.login [data-test="submit"]').click();
}

async function createHousehold(page, name, budget) {
  await expect(page.locator('[data-test="create-household"]')).toBeVisible({ timeout: 20000 });
  if (name === 'Sharma home') await shot(page, 'auth-create-household');
  await page.locator('[data-test="hname"]').fill(name);
  await page.locator('[data-test="hbudget"]').fill(String(budget));
  await page.locator('[data-test="create-household"]').click();
  await expect(page.locator('body.ready')).toBeVisible({ timeout: 20000 });
}

async function openHousehold(page) {
  await page.goto(URL_('settings'));
  await expect(page.locator('body.ready')).toBeVisible({ timeout: 20000 });
  await page.locator('[data-sec="household"] summary').click();
}

async function addPerson(admin, name, email, role) {
  await admin.locator('[data-test="p-name"]').fill(name);
  await admin.locator('[data-test="p-email"]').fill(email);
  await admin.locator('[data-test="p-role"]').selectOption(role);
  await admin.locator('[data-test="p-add"]').click();
  await expect(admin.locator('.sheet')).toContainText('Send', { timeout: 10000 }); // invite offer
  await admin.locator('.sheet [data-no]').click();
}

test.beforeAll(async ({ request }) => {
  await request.delete(`${AUTH}/emulator/v1/projects/demo-kozy/accounts`);
  await request.delete(`${FS}/emulator/v1/projects/demo-kozy/databases/(default)/documents`);
  // The old family account (made by hand in the console long ago) and its household with one spend.
  await request.post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    data: { email: 'krrish@krrivats.app', password: PASS, returnSecureToken: true },
  });
  const admin = { headers: { Authorization: 'Bearer owner' } };
  await request.patch(`${FSDOC}/households/kozy-home`, { ...admin, data: { fields: { name: { stringValue: 'Kozy home' } } } });
  await request.patch(`${FSDOC}/households/kozy-home/entries/old1`, {
    ...admin,
    data: { fields: {
      amount: { integerValue: '777' }, cat: { stringValue: 'misc' }, date: { stringValue: T }, mode: { stringValue: 'UPI' },
      note: { stringValue: 'Legacy plumber' }, by: { stringValue: 'Krrish' }, byEmail: { stringValue: 'krrish@krrivats.app' },
    } },
  });
});

test.afterAll(async () => { for (const c of ctxs) await c.close().catch(() => {}); });

test('admin: sign up → verify → create household → add editor + viewer', async ({ browser }) => {
  test.setTimeout(120000);
  const admin = await newPage(browser);
  await signUp(admin, 'Asha', 'asha@test.com');
  await createHousehold(admin, 'Sharma home', 30000);
  await expect(admin.locator('.who-chip')).toHaveText('Asha');
  await expect(admin.locator('[data-test="left"]')).toHaveText('₹30,000');

  await admin.locator('#fab').click();
  await admin.locator('.sheet [name="smart"]').fill('plumber 1200 cash');
  await admin.locator('.sheet [data-save]').click();
  await expect(admin.locator('[data-test="left"]')).toHaveText('₹28,800');

  await openHousehold(admin);
  await expect(admin.locator('[data-test="hh-name-in"]')).toHaveValue('Sharma home');
  await expect(admin.locator('[data-member]')).toHaveCount(1);
  await addPerson(admin, 'Ed', 'ed@test.com', 'editor');
  await addPerson(admin, 'Vik', 'vik@test.com', 'viewer');
  await expect(admin.locator('[data-member]')).toHaveCount(3);
  await shot(admin, 'settings-household');
  await expect(admin.locator('[data-member="ed@test.com"] [data-test="chip"]')).toHaveText('Invited');
  await expect(admin.locator('[data-member="asha@test.com"] [data-test="chip"]')).toHaveText('Joined');
  // adding the same email twice, or the last admin leaving / being removed, is refused
  await admin.locator('[data-test="p-name"]').fill('Again');
  await admin.locator('[data-test="p-email"]').fill('ed@test.com');
  await admin.locator('[data-test="p-add"]').click();
  await expect(admin.locator('[data-team-form="add"] .form-error')).toContainText('already in your household');
  await admin.locator('[data-member="asha@test.com"] [data-team-act="remove"]').click();
  await expect(admin.locator('#toast')).toContainText('one Admin');
  expect(admin.errors).toEqual([]);
});

test('editor: lands in the household, edits any spend, has no setup or people controls', async ({ browser }) => {
  test.setTimeout(120000);
  const ed = await newPage(browser);
  await signUp(ed, 'Edward', 'ed@test.com'); // invited → goes straight in, no onboarding
  await expect(ed.locator('body.ready')).toBeVisible({ timeout: 20000 });
  await expect(ed.locator('.who-chip')).toHaveText('Ed'); // the name the admin typed
  await expect(ed.locator('[data-test="left"]')).toHaveText('₹28,800');

  // fixes the admin's spend
  await ed.goto(URL_('budget'));
  await ed.locator('[data-view="spends"]').click();
  await ed.locator('[data-entry]', { hasText: 'Plumber' }).click();
  await ed.locator('.sheet [name="amount"]').fill('1300');
  await ed.locator('.sheet [data-save]').click();
  await expect(ed.locator('[data-entry]', { hasText: 'Plumber' })).toContainText('₹1,300');

  // no setup
  await openHousehold(ed);
  await expect(ed.locator('[data-test="p-add"]')).toHaveCount(0);
  await expect(ed.locator('[data-test="hh-name"]')).toHaveText('Sharma home');
  await expect(ed.locator('[data-test="leave"]')).toBeVisible();
  await expect(ed.locator('[data-act="reset"]')).toHaveCount(0);
  await expect(ed.locator('[data-form="cats"] input[name="limit"]').first()).toBeDisabled();
  const denied = await ed.evaluate(async () => {
    const { getAdapter } = await import('/js/store.js');
    try { await getAdapter().write('meta', { id: 'cats', value: [] }); return 'allowed'; } catch (e) { return e.code; }
  });
  expect(denied).toBe('permission-denied');
  expect(ed.errors).toEqual([]);
});

test('viewer is read-only; a stranger starts their own household and sees nothing of Sharma home', async ({ browser }) => {
  test.setTimeout(120000);
  const vik = await newPage(browser);
  await signUp(vik, 'Vikram', 'vik@test.com');
  await expect(vik.locator('body.ready')).toBeVisible({ timeout: 20000 });
  await expect(vik.locator('.who-chip')).toHaveText('View only');
  await expect(vik.locator('[data-test="left"]')).toHaveText('₹28,700');
  await expect(vik.locator('#fab')).toBeHidden();
  const denied = await vik.evaluate(async () => {
    const { getAdapter } = await import('/js/store.js');
    try { await getAdapter().write('entries', { id: 'x', amount: 1, byEmail: 'vik@test.com' }); return 'allowed'; } catch (e) { return e.code; }
  });
  expect(denied).toBe('permission-denied');

  const gita = await newPage(browser);
  await signUp(gita, 'Gita', 'gita@test.com');
  await expect(gita.locator('[data-test="my-email"]')).toHaveText('gita@test.com'); // not invited anywhere
  await createHousehold(gita, 'Gupta home', 10000);
  await expect(gita.locator('[data-test="left"]')).toHaveText('₹10,000');
  await expect(gita.locator('[data-test="recent"]')).not.toContainText('Plumber');
  // the rules refuse reaching into another household, even by id
  const peek = await gita.evaluate(async () => {
    const a = (await import('/js/store.js')).getAdapter();
    try { await a.F.getDocs(a.F.collection(a.db, 'households', 'kozy-home', 'entries')); return 'allowed'; } catch (e) { return e.code; }
  });
  expect(peek).toBe('permission-denied');
  expect(vik.errors).toEqual([]);
  expect(gita.errors).toEqual([]);
});

test('admin changes a role and removes a person; they lose access and land on onboarding', async ({ browser }) => {
  test.setTimeout(150000);
  const admin = await newPage(browser);
  const vik = await newPage(browser);
  await signIn(admin, 'asha@test.com');
  await signIn(vik, 'vik@test.com');
  await expect(vik.locator('body.ready')).toBeVisible({ timeout: 20000 });
  await expect(vik.locator('#fab')).toBeHidden();

  await openHousehold(admin);
  await expect(admin.locator('[data-member="ed@test.com"] [data-test="chip"]')).toHaveText('Joined'); // signed in earlier: no longer Invited
  await admin.locator('[data-team-role="vik@test.com"]').selectOption('editor');
  await expect(admin.locator('#toast')).toContainText('Vik is now Editor');
  await vik.reload();
  await expect(vik.locator('body.ready')).toBeVisible({ timeout: 20000 });
  await expect(vik.locator('#fab')).toBeVisible();

  await admin.locator('[data-member="vik@test.com"] [data-team-act="remove"]').click();
  await admin.locator('.sheet [data-yes]').click();
  await expect(admin.locator('[data-member]')).toHaveCount(2);
  // Vik's open app notices when it comes back to the front, and says so
  await vik.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(vik.locator('[data-test="access-lost"]')).toBeVisible({ timeout: 20000 });
  await vik.locator('[data-test="access-lost"] button', { hasText: 'OK' }).click();
  await expect(vik.locator('[data-test="create-household"]')).toBeVisible({ timeout: 20000 });
  expect(admin.errors).toEqual([]);
});

test('join with a code (typed, and by link), a wrong code is refused, then delete account and delete household', async ({ browser }) => {
  test.setTimeout(180000);
  const admin = await newPage(browser);
  await signIn(admin, 'asha@test.com');
  await openHousehold(admin);
  await admin.locator('[data-test="code-role"]').selectOption('viewer');
  await admin.locator('[data-test="newcode"]').click();
  await expect(admin.locator('[data-test="code-text"]')).toBeVisible({ timeout: 10000 });
  const code = (await admin.locator('[data-test="code-text"]').first().innerText()).replace(/[^A-Z0-9]/g, '');
  expect(code).toHaveLength(8);
  await shot(admin, 'settings-invite-code');

  // typed code
  const zed = await newPage(browser);
  await signUp(zed, 'Zed', 'zed@test.com');
  await expect(zed.locator('[data-test="join-code"]')).toBeVisible({ timeout: 20000 });
  await shot(zed, 'auth-join-code');
  await zed.locator('[data-test="join-code"]').fill('WRONG123');
  await zed.locator('[data-test="join-go"]').click();
  await expect(zed.locator('[data-join-err]')).toContainText('not valid');
  await zed.locator('[data-test="join-code"]').fill(code.slice(0, 4) + '-' + code.slice(4).toLowerCase());
  await zed.locator('[data-test="join-go"]').click();
  await expect(zed.locator('body.ready')).toBeVisible({ timeout: 20000 });
  await expect(zed.locator('.who-chip')).toHaveText('View only');
  await expect(zed.locator('[data-test="left"]')).toBeVisible();
  await expect(zed.locator('#fab')).toBeHidden();

  // invite link: ?join=CODE survives sign-up and fills the box
  const zoe = await newPage(browser);
  await zoe.goto(`/?emulator=1&today=${T}&join=${code}#/home`);
  await expect(zoe.locator('[data-test="invite-banner"]')).toBeVisible({ timeout: 20000 });
  await zoe.locator('.login [name="name"]').fill('Zoe');
  await zoe.locator('.login [name="email"]').fill('zoe@test.com');
  await zoe.locator('.login [name="password"]').fill(PASS);
  await zoe.locator('.login [data-test="submit"]').click();
  await expect(zoe.locator('[data-test="inbox-email"]')).toHaveText('zoe@test.com', { timeout: 20000 });
  await zoe.locator('[data-test="emu-verify"]').click();
  await expect(zoe.locator('[data-test="join-code"]')).toHaveValue(code, { timeout: 20000 });
  await zoe.locator('[data-test="join-go"]').click();
  await expect(zoe.locator('body.ready')).toBeVisible({ timeout: 20000 });
  await expect(zoe.locator('.who-chip')).toHaveText('View only');

  // admin sees both as Joined viewers
  await admin.reload();
  await admin.locator('[data-sec="household"] summary').click();
  await expect(admin.locator('[data-member="zed@test.com"] [data-test="chip"]')).toHaveText('Joined');
  await expect(admin.locator('[data-member="zoe@test.com"]')).toContainText('Zoe');

  // Zoe deletes her own account: she leaves, the login is gone, the household stays
  await zoe.goto(URL_('settings'));
  await zoe.locator('[data-sec="account"] summary').click();
  await zoe.locator('[data-test="delete-account"]').click();
  await zoe.locator('.sheet [data-yes]').click();
  await expect(zoe.locator('[data-test="tab-in"]')).toBeVisible({ timeout: 20000 });
  await zoe.locator('.login [name="email"]').fill('zoe@test.com');
  await zoe.locator('.login [name="password"]').fill(PASS);
  await zoe.locator('.login [data-test="submit"]').click();
  await expect(zoe.locator('.login .form-error')).toBeVisible({ timeout: 10000 });
  await admin.reload();
  await admin.locator('[data-sec="household"] summary').click();
  await expect(admin.locator('[data-member="zoe@test.com"]')).toHaveCount(0);

  // Gita deletes her whole household by typing its name
  const gita = await newPage(browser);
  await signIn(gita, 'gita@test.com');
  await openHousehold(gita);
  await gita.locator('[data-test="delete-household"]').click();
  await expect(gita.locator('[data-test="delete-yes"]')).toBeDisabled();
  await gita.locator('[data-test="delete-confirm"]').fill('gupta HOME');
  await gita.locator('[data-test="delete-yes"]').click();
  await expect(gita.locator('[data-test="create-household"]')).toBeVisible({ timeout: 30000 });
  for (const p of [admin, zed, zoe, gita]) expect(p.errors).toEqual([]);
});

test('old family account krrish@krrivats.app signs in with just "krrish" and opens the old household as admin', async ({ browser }) => {
  test.setTimeout(90000);
  const k = await newPage(browser);
  await signIn(k, 'krrish'); // no @: the quiet shortcut adds @krrivats.app
  await expect(k.locator('body.ready')).toBeVisible({ timeout: 20000 }); // never asked to verify the email
  await expect(k.locator('.who-chip')).toHaveText('Krrish');
  await expect(k.locator('[data-test="recent"]')).toContainText('₹777');
  await openHousehold(k);
  await expect(k.locator('[data-member="krrish@krrivats.app"]')).toContainText('Krrish');
  await expect(k.locator('[data-team-role="krrish@krrivats.app"]')).toHaveValue('admin');
  await expect(k.locator('[data-test="p-add"]')).toBeVisible();
  await expect(k.locator('[data-form="cats"] input[name="limit"]').first()).toBeEnabled();
  expect(k.errors).toEqual([]);
});

test('guest from the login screen: sample copy, never a household\'s data', async ({ browser }) => {
  const g = await newPage(browser);
  await g.goto(URL_());
  await expect(g.locator('[data-test="guest"]')).toBeVisible({ timeout: 20000 });
  await g.locator('[data-test="guest"]').click();
  await expect(g.locator('[data-test="guest-bar"]')).toBeVisible({ timeout: 20000 });
  await expect(g.locator('.who-chip')).toHaveText('Guest');
  await expect(g.locator('[data-test="recent"]')).not.toContainText('Plumber');
  await g.goto(URL_('settings'));
  await expect(g.locator('[data-sec="household"]')).toHaveCount(0); // no Household in guest mode
});
