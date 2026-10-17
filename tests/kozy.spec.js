// Kozy end-to-end tests (headless Chromium, 390x844). Run: npm test
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const T = '2026-10-17';

async function fresh(page, today = T, hash = 'home') {
  await page.goto(`/?today=${today}#/${hash}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('body.ready')).toBeVisible();
}

async function go(page, today, hash) {
  await page.goto(`/?today=${today}#/${hash}`);
  await expect(page.locator(`.screen-${hash}`)).toBeVisible();
}

async function addSpend(page, amount, catName, mode = 'UPI', note = '') {
  await page.locator('#fab').click();
  const sheet = page.locator('.sheet');
  await sheet.locator('input[name="amount"]').fill(String(amount));
  await sheet.locator('.cat-chip', { hasText: catName }).click();
  await sheet.locator(`[data-mode="${mode}"]`).click();
  if (note) await sheet.locator('input[name="note"]').fill(note);
  await sheet.locator('[data-save]').click();
  await expect(page.locator('#overlay')).toBeHidden();
}

function catRow(page, name) {
  return page.locator('.cat-row', { hasText: name });
}

test('add, edit and delete a spend from the + button', async ({ page }) => {
  await fresh(page);
  await expect(page.locator('[data-test="left"]')).toHaveText('₹40,000');
  await expect(page.locator('[data-test="days-left"]')).toHaveText('15');

  await addSpend(page, 250, 'Home misc', 'Cash', 'Bulb');
  await expect(page.locator('#toast')).toContainText('₹250');
  await expect(page.locator('[data-test="left"]')).toHaveText('₹39,750');
  await expect(page.locator('[data-test="last5"] .entry')).toHaveCount(1);
  await expect(page.locator('[data-test="last5"]')).toContainText('Bulb');
  await expect(page.locator('[data-test="last5"]')).toContainText('Cash · Me');
  // safe daily = 39,750 / 15 = 2,650
  await expect(page.locator('[data-test="safe-daily"]')).toHaveText('₹2,650');

  // edit
  await page.locator('[data-test="last5"] .entry').first().click();
  await page.locator('.sheet input[name="amount"]').fill('300');
  await page.locator('.sheet [data-save]').click();
  await expect(page.locator('[data-test="left"]')).toHaveText('₹39,700');

  // delete
  await page.locator('[data-test="last5"] .entry').first().click();
  await page.locator('.sheet [data-del]').click();
  await page.locator('.sheet [data-yes]').click();
  await expect(page.locator('[data-test="left"]')).toHaveText('₹40,000');

  // validation: no amount
  await page.locator('#fab').click();
  await page.locator('.sheet [data-save]').click();
  await expect(page.locator('.sheet .form-error')).toHaveText('Enter an amount');
});

test('category colours: amber at 80%, red over 100%', async ({ page }) => {
  await fresh(page);
  await addSpend(page, 500, 'Gas cylinder');
  await go(page, T, 'budget');
  await expect(catRow(page, 'Gas cylinder')).toHaveAttribute('data-level', 'ok');
  await addSpend(page, 400, 'Gas cylinder'); // 900 / 1100 = 82%
  await expect(catRow(page, 'Gas cylinder')).toHaveAttribute('data-level', 'warn');
  await expect(catRow(page, 'Gas cylinder').locator('.num')).toHaveClass(/warn/);
  await addSpend(page, 300, 'Gas cylinder'); // 1200 / 1100
  await expect(catRow(page, 'Gas cylinder')).toHaveAttribute('data-level', 'over');
  await expect(catRow(page, 'Gas cylinder').locator('.bar')).toHaveClass(/over/);
  // filter by category
  await catRow(page, 'Gas cylinder').click();
  await expect(page.locator('[data-test="entries"] .entry')).toHaveCount(3);
});

test('recurring bills show on the 1st and confirm in one tap', async ({ page }) => {
  await fresh(page, '2026-11-01');
  const rec = page.locator('[data-test="recurring"]');
  await expect(rec.locator('.rec-row')).toHaveCount(3);
  await rec.locator('[data-act="rec-ok"]').first().click(); // Solar EMI
  await expect(rec.locator('.rec-row')).toHaveCount(2);
  await expect(page.locator('[data-test="left"]')).toHaveText('₹35,000');
  await rec.locator('[data-act="rec-skip"]').last().click(); // skip gas this month
  await expect(rec.locator('.rec-row')).toHaveCount(1);
  await rec.locator('[data-act="rec-ok"]').click();
  await expect(rec).toHaveCount(0);
  await expect(page.locator('[data-test="left"]')).toHaveText('₹33,500');
  // still gone after reload, comes back next month
  await page.reload();
  await expect(page.locator('[data-test="recurring"]')).toHaveCount(0);
  await go(page, '2026-12-01', 'home');
  await expect(page.locator('[data-test="recurring"] .rec-row')).toHaveCount(3);
});

test('Bought → Finished → prediction, auto grocery spend, shopping list', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await fresh(page, '2026-10-01', 'stock');
  const atta = page.locator('.item[data-item="item-atta"]');
  await expect(atta.locator('[data-test="chip"]')).toHaveText('Not tracked');
  await expect(atta.locator('[data-act="finished"]')).toBeDisabled();

  // Bought 10 kg for ₹420 on 1 Oct
  await atta.locator('[data-act="bought"]').click();
  await page.locator('.sheet input[name="qty"]').fill('10');
  await page.locator('.sheet input[name="price"]').fill('420');
  await page.locator('.sheet button[type="submit"]').click();
  await expect(atta.locator('[data-test="chip"]')).toHaveText('In stock');

  // Finished on 11 Oct → lasted 10 days
  await go(page, '2026-10-11', 'stock');
  await atta.locator('[data-act="finished"]').click();
  await expect(atta.locator('[data-test="chip"]')).toHaveText('Finished');
  await expect(page.locator('[data-test="shopping"] [data-shop="item-atta"]')).toBeVisible();

  // Bought again same day (prefilled with last qty + price)
  await atta.locator('[data-act="bought"]').click();
  await expect(page.locator('.sheet input[name="qty"]')).toHaveValue('10');
  await expect(page.locator('.sheet input[name="price"]')).toHaveValue('420');
  await page.locator('.sheet button[type="submit"]').click();
  await expect(atta.locator('[data-test="chip"]')).toHaveText('In stock');
  await expect(atta.locator('.item-info')).toContainText('~10 days left');
  await expect(atta.locator('.item-stats')).toContainText('lasts 10d');
  await expect(atta.locator('.item-stats')).toContainText('7 kg/wk');
  await expect(atta.locator('.item-stats')).toContainText('₹1,260/mo');

  // 4 days later → 6 days left → Running low + on shopping list
  await go(page, '2026-10-15', 'stock');
  await expect(atta.locator('[data-test="chip"]')).toHaveText('Running low');
  await expect(atta.locator('.item-info')).toContainText('~6 days left');
  await expect(page.locator('[data-test="shopping"] [data-shop="item-atta"]')).toContainText('6d left');

  // Detail sheet numbers
  await atta.locator('[data-act="detail"]').click();
  await expect(page.locator('.sheet .stat-grid')).toContainText('10 days');
  await expect(page.locator('.sheet .stat-grid')).toContainText('21 Oct');
  await expect(page.locator('.sheet .hist-row')).toHaveCount(3);
  await page.keyboard.press('Escape');

  // Copy shopping list (WhatsApp text)
  await page.locator('[data-test="shopping"] [data-act="copy"]').click();
  await expect(page.locator('#toast')).toContainText('copied');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Kozy shopping list');
  expect(clip).toContain('Atta / आटा');

  // Each Bought added ₹420 to Groceries + veg
  await go(page, '2026-10-15', 'budget');
  await expect(catRow(page, 'Groceries + veg')).toContainText('₹840');
  await expect(page.locator('[data-test="entries"]')).toContainText('Atta / आटा 10 kg');
});

test('share button uses Web Share API when available', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.share = async (d) => { window.__shared = d; };
  });
  await fresh(page, T, 'stock');
  const poha = page.locator('.item[data-item="item-poha"]');
  await poha.locator('[data-act="bought"]').click();
  await page.locator('.sheet input[name="qty"]').fill('1');
  await page.locator('.sheet button[type="submit"]').click();
  await poha.locator('[data-act="finished"]').click();
  await page.locator('[data-test="shopping"] [data-act="share"]').click();
  await expect(page.locator('#toast')).toContainText('Shared');
  const shared = await page.evaluate(() => window.__shared);
  expect(shared.text).toContain('Poha / पोहा');
});

test('milk log: first-run setup, tick, skip, calendar, bill to Milk spend', async ({ page }) => {
  await fresh(page, T, 'milk');
  await expect(page.locator('[data-test="milk-setup"]')).toBeVisible();
  await page.locator('[data-test="milk-setup"] input[name="litres"]').fill('3');
  await page.locator('[data-test="milk-setup"] input[name="rate"]').fill('65');
  await page.locator('[data-test="milk-setup"] button[type="submit"]').click();
  await expect(page.locator('[data-test="milk-setup"]')).toHaveCount(0);

  await page.locator('[data-test="milk-today"] [data-act="tick"]').click();
  await expect(page.locator('[data-test="milk-today"]')).toContainText('✓ 3 L');
  await expect(page.locator(`.cal-cell[data-day="${T}"]`)).toHaveClass(/got/);

  // 16 Oct: different amount (4.5 L) via calendar
  await page.locator('.cal-cell[data-day="2026-10-16"]').click();
  await page.locator('.sheet input[name="litres"]').fill('4.5');
  await page.locator('.sheet button[type="submit"]').click();
  // 15 Oct: skip
  await page.locator('.cal-cell[data-day="2026-10-15"]').click();
  await page.locator('.sheet [data-skip]').click();
  await expect(page.locator('.cal-cell[data-day="2026-10-15"]')).toHaveClass(/skip/);
  // future days locked
  await expect(page.locator('.cal-cell[data-day="2026-10-20"]')).toBeDisabled();

  await expect(page.locator('[data-test="milk-litres"]')).toHaveText('7.5');
  await expect(page.locator('[data-test="milk-amount"]')).toHaveText('₹488'); // 7.5 × 65 = 487.5

  // Bill → Milk spend, and updating does not double it
  await page.locator('[data-form="bill"] input[name="amount"]').fill('500');
  await page.locator('[data-test="add-bill"]').click();
  await expect(page.locator('[data-test="add-bill"]')).toHaveText('Update');
  await page.locator('[data-form="bill"] input[name="amount"]').fill('520');
  await page.locator('[data-test="add-bill"]').click();
  await go(page, T, 'budget');
  await expect(catRow(page, 'Milk')).toContainText('₹520');

  // Home tile shows today's milk
  await go(page, T, 'home');
  await expect(page.locator('[data-test="home-milk"]')).toContainText('Milk ✓ 3 L');
});

test('CSV export downloads the month', async ({ page }) => {
  await fresh(page);
  await addSpend(page, 1234, 'Office travel', 'UPI', 'Bus, auto');
  await go(page, T, 'budget');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="csv"]').click()]);
  expect(dl.suggestedFilename()).toBe('kozy-2026-10.csv');
  const text = await readFile(await dl.path(), 'utf8');
  expect(text).toContain('Date,Category,Amount (INR),Mode,Note,Added by');
  expect(text).toContain('2026-10-17,Office travel,1234,UPI,"Bus, auto",Me');
  expect(text).toContain('Total spent,1234');
});

test('demo data loads, history chart, savings, card due; reset clears', async ({ page }) => {
  await fresh(page, T, 'settings');
  await page.locator('[data-act="demo"]').click();
  await page.locator('.sheet [data-yes]').click();
  await expect(page.locator('.screen-home')).toBeVisible();
  await expect(page.locator('[data-test="last5"] .entry')).toHaveCount(5);
  await expect(page.locator('[data-test="recurring"]')).toHaveCount(0);

  await go(page, T, 'budget');
  expect(await page.locator('[data-test="entries"] .entry').count()).toBeGreaterThan(30);
  await expect(page.locator('.chart .cb')).toHaveCount(6);
  await expect(page.locator('[data-test="savings"]')).toContainText('₹4,500');
  await expect(page.locator('[data-test="cc-remaining"]')).toHaveText('₹1,000');
  expect(await page.locator('.cat-row[data-level="over"]').count()).toBeGreaterThan(0);

  await go(page, T, 'stock');
  expect(await page.locator('.item[data-status="finished"]').count()).toBeGreaterThan(0);
  expect(await page.locator('[data-test="shopping"] li').count()).toBeGreaterThan(0);

  await go(page, T, 'milk');
  expect(await page.locator('.cal-cell.got').count()).toBeGreaterThan(10);

  // backup JSON
  await go(page, T, 'settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="export"]').click()]);
  const backup = JSON.parse(await readFile(await dl.path(), 'utf8'));
  expect(backup.app).toBe('kozy');
  expect(backup.entries.length).toBeGreaterThan(30);

  // reset
  await page.locator('[data-act="reset"]').click();
  await page.locator('.sheet [data-yes]').click();
  await expect(page.locator('[data-test="left"]')).toHaveText('₹40,000');
  await expect(page.locator('[data-test="last5"] .entry')).toHaveCount(0);
  await go(page, T, 'stock');
  await expect(page.locator('.item')).toHaveCount(17);

  // restore the backup
  await go(page, T, 'settings');
  await page.locator('input[data-act="import"]').setInputFiles(await dl.path());
  await page.locator('.sheet [data-yes]').click();
  await expect(page.locator('#toast')).toContainText('restored');
  await go(page, T, 'budget');
  expect(await page.locator('[data-test="entries"] .entry').count()).toBeGreaterThan(30);
});

test('settings: change a limit and add a stock item', async ({ page }) => {
  await fresh(page, T, 'settings');
  const row = page.locator('.limit-row', { has: page.locator('input[value="Buffer"]') });
  await row.locator('input[name="limit"]').fill('1900');
  await page.locator('[data-form="cats"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('₹41,000');
  await go(page, T, 'home');
  await expect(page.locator('[data-test="left"]')).toHaveText('₹41,000');

  await go(page, T, 'stock');
  await page.locator('[data-act="add-item"]').click();
  await page.locator('.sheet input[name="en"]').fill('Jaggery');
  await page.locator('.sheet input[name="hi"]').fill('गुड़');
  await page.locator('.sheet button[type="submit"]').click();
  await expect(page.locator('.item', { hasText: 'Jaggery' })).toContainText('गुड़');
  await expect(page.locator('.item')).toHaveCount(18);
});

test('works offline after first visit (service worker)', async ({ page, context }) => {
  await page.goto(`/?today=${T}#/home`);
  await expect(page.locator('body.ready')).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // now controlled by the SW
  await expect(page.locator('body.ready')).toBeVisible();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await addSpend(page, 99, 'Buffer');

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('body.ready')).toBeVisible();
  await expect(page.locator('[data-test="last5"]')).toContainText('₹99');
  await go(page, T, 'stock');
  await expect(page.locator('.item')).toHaveCount(17);
  await context.setOffline(false);
});
