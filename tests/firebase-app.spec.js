// The REAL app in Firebase mode, against the local Auth + Firestore emulators (with firestore.rules loaded).
// Run from tests-rules/:  npm run test:app   (skipped by the normal `npm test`)
import { test, expect } from '@playwright/test';

const AUTH = 'http://127.0.0.1:9099';
const FS = 'http://127.0.0.1:8085';
const T = '2026-10-17';
const URL_ = (hash = 'home') => `/?emulator=1&today=${T}#/${hash}`;
const PEOPLE = ['me@test.com', 'wife@test.com', 'papa@test.com', 'stranger@test.com'];

test.describe.configure({ mode: 'serial' });

async function makeUser(request, email, verified = true) {
  const r = await request.post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    data: { email, password: 'secret123', returnSecureToken: true },
  });
  const { localId } = await r.json();
  if (verified) {
    await request.post(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-kozy/accounts:update`, {
      headers: { Authorization: 'Bearer owner' }, data: { localId, emailVerified: true },
    });
  }
}

async function signIn(page, email) {
  await page.goto(URL_());
  await expect(page.locator('.login')).toBeVisible({ timeout: 20000 });
  await page.locator('.login [name="email"]').fill(email);
  await page.locator('.login [name="password"]').fill('secret123');
  await page.locator('.login button[type="submit"]').click();
}

test.beforeAll(async ({ request }) => {
  await request.delete(`${AUTH}/emulator/v1/projects/demo-kozy/accounts`);
  await request.delete(`${FS}/emulator/v1/projects/demo-kozy/databases/(default)/documents`);
  for (const e of PEOPLE) await makeUser(request, e, e !== 'stranger@test.com');
});

test('owner + wife on two phones: sign in, add, live sync, roles enforced', async ({ browser }) => {
  test.setTimeout(120000);
  const ownerCtx = await browser.newContext();
  const wifeCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const wife = await wifeCtx.newPage();
  const errors = [];
  for (const p of [owner, wife]) p.on('pageerror', (e) => errors.push(e.message));

  // Owner signs in → first run seeds items + bills into Firestore
  await signIn(owner, 'me@test.com');
  await expect(owner.locator('body.ready')).toBeVisible({ timeout: 20000 });
  await expect(owner.locator('.who-chip')).toHaveText('Me');
  await expect(owner.locator('[data-test="left"]')).toHaveText('₹40,000');
  await expect(owner.locator('[data-sync]')).toBeVisible();

  // Owner adds a spend
  await owner.locator('#fab').click();
  await owner.locator('.sheet [name="smart"]').fill('plumber 1200 cash');
  await owner.locator('.sheet [data-save]').click();
  await expect(owner.locator('[data-test="left"]')).toHaveText('₹38,800');

  // Wife signs in on her phone and sees the same numbers
  await signIn(wife, 'wife@test.com');
  await expect(wife.locator('body.ready')).toBeVisible({ timeout: 20000 });
  await expect(wife.locator('.who-chip')).toHaveText('Wife');
  await expect(wife.locator('[data-test="left"]')).toHaveText('₹38,800');

  // Wife adds sabzi with smart add → owner's phone updates live (no reload)
  await wife.locator('#fab').click();
  await wife.locator('.sheet [name="smart"]').fill('pyaz 2kg 80');
  await wife.locator('.sheet [data-save]').click();
  await expect(wife.locator('[data-test="left"]')).toHaveText('₹38,720');
  await expect(owner.locator('[data-test="left"]')).toHaveText('₹38,720', { timeout: 15000 });
  await expect(owner.locator('[data-test="recent"]')).toContainText('Wife bought Onion 2 kg');

  // Wife cannot change the owner's spend (the app blocks it before Firestore does)
  await wife.goto(URL_('budget'));
  await wife.locator('[data-view="spends"]').click();
  await wife.locator('[data-entry]', { hasText: 'Plumber' }).click();
  await expect(wife.locator('.sheet')).toContainText('Only the person who added this');
  await wife.keyboard.press('Escape');

  // Firestore itself refuses a setup write from the wife (rules, not just UI)
  const denied = await wife.evaluate(async () => {
    const { getAdapter } = await import('/js/store.js');
    const a = getAdapter();
    try { await a.write('meta', { id: 'cats', value: [] }); return 'allowed'; } catch (e) { return e.code; }
  });
  expect(denied).toBe('permission-denied');

  // Wife marks Atta bought → owner sees it in Stock
  await wife.goto(URL_('stock'));
  await wife.locator('.irow[data-item="item-atta"] [data-act="bought"]').click();
  await wife.locator('.sheet [data-size="10"]').click();
  await wife.locator('.sheet [name="price"]').fill('420');
  await wife.locator('.sheet button[type="submit"]').click();
  await owner.goto(URL_('stock'));
  await expect(owner.locator('.irow[data-item="item-atta"] [data-test="chip"]')).toHaveText('In stock', { timeout: 15000 });
  await expect(owner.locator('[data-test="bought-today"]')).toContainText('Atta 10 kg · Wife');

  // Owner reloads: data comes back from Firestore
  await owner.goto(URL_('home'));
  await owner.reload();
  await expect(owner.locator('[data-test="left"]')).toHaveText('₹38,300', { timeout: 20000 });

  expect(errors).toEqual([]);
  await ownerCtx.close();
  await wifeCtx.close();
});

test('viewer sees everything, cannot add; stranger and unverified are refused', async ({ browser }) => {
  test.setTimeout(90000);
  const ctx = await browser.newContext();
  const papa = await ctx.newPage();
  await signIn(papa, 'papa@test.com');
  await expect(papa.locator('body.ready')).toBeVisible({ timeout: 20000 });
  await expect(papa.locator('.who-chip')).toHaveText('View only');
  await expect(papa.locator('[data-test="left"]')).toHaveText('₹38,300');
  await expect(papa.locator('#fab')).toBeHidden();
  const denied = await papa.evaluate(async () => {
    const { getAdapter } = await import('/js/store.js');
    try { await getAdapter().write('entries', { id: 'x', amount: 1, byEmail: 'papa@test.com' }); return 'allowed'; } catch (e) { return e.code; }
  });
  expect(denied).toBe('permission-denied');
  await ctx.close();

  const ctx2 = await browser.newContext();
  const s = await ctx2.newPage();
  await signIn(s, 'stranger@test.com');
  await expect(s.locator('.card')).toContainText('cannot open the family data', { timeout: 20000 });
  await ctx2.close();
});
