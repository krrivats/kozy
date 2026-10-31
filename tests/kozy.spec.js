// Kozy end-to-end tests (headless Chromium, 390x844). Run: npm test
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const T = '2026-10-17';

async function fresh(page, today = T, hash = 'home', role = '') {
  await page.goto(`/?today=${today}${role ? `&role=${role}` : ''}#/${hash}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('body.ready')).toBeVisible();
}

async function go(page, today, hash, role = '') {
  await page.goto(`/?today=${today}${role ? `&role=${role}` : ''}#/${hash}`);
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

async function smartAdd(page, text) {
  await page.locator('#fab').click();
  await page.locator('.sheet [name="smart"]').fill(text);
  await page.locator('.sheet [data-save]').click();
  await expect(page.locator('#overlay')).toBeHidden();
}

async function loadDemo(page) {
  await go(page, T, 'settings');
  await openSec(page, 'data');
  await page.locator('[data-act="demo"]').click();
  await page.locator('.sheet [data-yes]').click();
  await expect(page.locator('.screen-home')).toBeVisible();
}

async function openSec(page, key) {
  const d = page.locator(`[data-sec="${key}"]`);
  if (!(await d.evaluate((el) => el.open))) await d.locator('> summary').click();
}

const tile = (page, name) => page.locator('.ctile', { hasText: name });
const row = (page, id) => page.locator(`.irow[data-item="${id}"]`);

test('add, edit, delete + undo a spend from the + button', async ({ page }) => {
  await fresh(page);
  await expect(page.locator('[data-test="left"]')).toHaveText('₹40,000');
  await expect(page.locator('[data-test="days-left"]')).toHaveText('15');

  await addSpend(page, 250, 'Home misc', 'Cash', 'Bulb');
  await expect(page.locator('#toast')).toContainText('₹250');
  await expect(page.locator('[data-test="left"]')).toHaveText('₹39,750');
  await expect(page.locator('[data-test="safe-daily"]')).toHaveText('₹2,650'); // 39,750 / 15
  await expect(page.locator('[data-test="recent"]')).toContainText('Me added ₹250 · Bulb');

  // edit (from Budget → Spends)
  await go(page, T, 'budget');
  await page.locator('[data-view="spends"]').click();
  await page.locator('[data-entry]').first().click();
  await page.locator('.sheet input[name="amount"]').fill('300');
  await page.locator('.sheet [data-save]').click();
  await expect(page.locator('[data-test="entries"]')).toContainText('₹300');

  // delete → undo → delete again
  await page.locator('[data-entry]').first().click();
  await page.locator('.sheet [data-del]').click();
  await page.locator('.sheet [data-yes]').click();
  await expect(page.locator('[data-test="entries"] .entry')).toHaveCount(0);
  await page.locator('#toast .toast-undo').click();
  await expect(page.locator('[data-test="entries"] .entry')).toHaveCount(1);

  // validation
  await page.locator('#fab').click();
  await page.locator('.sheet [data-save]').click();
  await expect(page.locator('.sheet .form-error')).toHaveText('Enter an amount');
});

test('home: previous / next month, then back to this month; no scan option anywhere', async ({ page }) => {
  await fresh(page);
  await addSpend(page, 250, 'Home misc', 'Cash', 'Bulb');
  await expect(page.locator('[data-test="left"]')).toHaveText('₹39,750');
  await expect(page.locator('[data-test="home-month"]')).toContainText('October 2026');
  await page.locator('[data-test="home-month"] [data-act="hmonth-prev"]').click();
  await expect(page.locator('[data-test="home-month"]')).toContainText('September 2026');
  await expect(page.locator('.hero .label')).toHaveText('Saved in September 2026');
  await expect(page.locator('[data-test="left"]')).toHaveText('₹40,000'); // nothing spent in September
  await expect(page.locator('[data-test="days-left"]')).toHaveCount(0);
  await page.locator('[data-test="home-month"] [data-act="hmonth-next"]').click();
  await expect(page.locator('.hero .label')).toHaveText('Left this month');
  await expect(page.locator('[data-test="left"]')).toHaveText('₹39,750');
  // leaving Home and coming back starts on this month again
  await page.locator('[data-test="home-month"] [data-act="hmonth-prev"]').click();
  await page.locator('.dock a[href="#/budget"], .tabbar a[data-tab="budget"]').first().click();
  await page.locator('.tabbar a[data-tab="home"]').click();
  await expect(page.locator('[data-test="home-month"]')).toContainText('October 2026');
  // the bill scanner is gone
  await expect(page.getByText('Scan bill')).toHaveCount(0);
  await page.locator('#fab').click();
  await expect(page.locator('[data-scan]')).toHaveCount(0);
});

test('smart quick add: spend, kitchen item, sabzi with ₹/kg', async ({ page }) => {
  await fresh(page);
  await smartAdd(page, 'auto 80 cash');
  await smartAdd(page, 'sabzi 250');
  await smartAdd(page, 'atta 10kg 420');
  await smartAdd(page, 'pyaz 5kg 40/kg');
  await expect(page.locator('[data-test="left"]')).toHaveText(`₹${(40000 - 80 - 250 - 420 - 200).toLocaleString('en-IN')}`);

  await go(page, T, 'budget');
  await expect(tile(page, 'Office travel')).toContainText('₹80');
  await expect(tile(page, 'Groceries')).toContainText('₹870');
  await page.locator('[data-view="spends"]').click();
  await expect(page.locator('[data-test="entries"]')).toContainText('Auto');
  await expect(page.locator('[data-test="entries"]')).toContainText('Cash');

  await go(page, T, 'stock');
  await expect(row(page, 'item-atta').locator('[data-test="chip"]')).toHaveText('In stock');
  await page.locator('[data-tab="veg"]').click();
  await expect(page.locator('.vtile[data-item="veg-onion"]')).toContainText('₹40/kg');
});

test('category colours: amber at 80%, red over 100%', async ({ page }) => {
  await fresh(page);
  await addSpend(page, 500, 'Gas cylinder');
  await go(page, T, 'budget');
  await expect(tile(page, 'Gas cylinder')).toHaveAttribute('data-level', 'ok');
  await addSpend(page, 400, 'Gas cylinder'); // 900 / 1100 = 82%
  await expect(tile(page, 'Gas cylinder')).toHaveAttribute('data-level', 'warn');
  await addSpend(page, 300, 'Gas cylinder'); // 1200 / 1100
  await expect(tile(page, 'Gas cylinder')).toHaveAttribute('data-level', 'over');
  await expect(tile(page, 'Gas cylinder').locator('.bar')).toHaveClass(/over/);
  await expect(tile(page, 'Other bills')).toHaveAttribute('data-level', 'none'); // no limit
  // tap a tile → its spends
  await tile(page, 'Gas cylinder').click();
  await expect(page.locator('[data-test="entries"] .entry')).toHaveCount(3);
});

test('bills: due chip on the 1st, Paid / Skip, repeats next month; any-frequency bill from Settings', async ({ page }) => {
  await fresh(page, '2026-11-01');
  await expect(page.locator('[data-test="chip-bills"]')).toHaveText(/3 bills due/);
  await page.locator('[data-test="chip-bills"]').click();
  await page.locator('[data-bill="b-solar"] button[type="submit"]').click();
  await expect(page.locator('[data-test="left"]')).toHaveText('₹35,000');
  await page.locator('[data-skip="b-gas"]').click();
  await page.locator('[data-bill="b-wifi"] button[type="submit"]').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('[data-test="chip-bills"]')).toHaveCount(0);
  await expect(page.locator('[data-test="left"]')).toHaveText('₹33,500');
  await go(page, '2026-12-01', 'home');
  await expect(page.locator('[data-test="chip-bills"]')).toHaveText(/3 bills due/);

  // Turn on Electricity: every 2 months, ₹1,800, due in 2 days → shows as due (remind 5 days before)
  await go(page, '2026-12-01', 'settings');
  await openSec(page, 'bills');
  const el = page.locator('[data-bill="b-elec"]');
  await el.locator('summary').click();
  await el.locator('[name="amount"]').fill('1800');
  await el.locator('[name="due"]').fill('2026-12-03');
  await el.locator('[name="active"]').check();
  await el.locator('button[type="submit"]').click();
  await go(page, '2026-12-01', 'home');
  await expect(page.locator('[data-test="chip-bills"]')).toHaveText(/4 bills due/);
  await page.locator('[data-test="chip-bills"]').click();
  await page.locator('[data-bill="b-elec"] button[type="submit"]').click();
  await go(page, '2026-12-01', 'settings');
  await openSec(page, 'bills');
  await expect(page.locator('[data-bill="b-elec"] summary')).toContainText('next 3 Feb'); // 2-monthly
});

test('kitchen: Bought (size chips, lasts about) → Finished → learned countdown, low warning', async ({ page }) => {
  await fresh(page, '2026-10-01', 'stock');
  const atta = row(page, 'item-atta');
  await expect(atta.locator('[data-test="chip"]')).toHaveText('Not tracked');
  await expect(atta.locator('[data-act="finished"]')).toBeDisabled();

  await atta.locator('[data-act="bought"]').click();
  await page.locator('.sheet [data-size="10"]').click();
  await expect(page.locator('.sheet input[name="qty"]')).toHaveValue('10');
  await page.locator('.sheet input[name="price"]').fill('420');
  await page.locator('.sheet input[name="note"]').fill('Aashirvaad');
  await page.locator('.sheet button[type="submit"]').click();
  await expect(atta.locator('[data-test="chip"]')).toHaveText('In stock');
  await expect(atta.locator('.item-info')).toContainText('15 days left'); // first time: 15-day guess

  // Finished after 10 days
  await go(page, '2026-10-11', 'stock');
  await atta.locator('[data-act="finished"]').click();
  await expect(atta.locator('[data-test="chip"]')).toHaveText('Finished');
  await expect(page.locator('[data-test="shopping"] [data-shop="item-atta"]')).toBeVisible();

  // Bought again from the shopping list pill → prefilled, Auto uses history (10 days)
  await page.locator('[data-shop="item-atta"]').click();
  await expect(page.locator('.sheet input[name="qty"]')).toHaveValue('10');
  await expect(page.locator('.sheet input[name="price"]')).toHaveValue('420');
  await expect(page.locator('.sheet [data-lasts=""]')).toHaveClass(/on/);
  await page.locator('.sheet button[type="submit"]').click();
  await expect(atta.locator('.item-info')).toContainText('10 days left · 21 Oct');

  // 4 days later → 6 left → Running low (≤ 7)
  await go(page, '2026-10-15', 'stock');
  await expect(atta.locator('[data-test="chip"]')).toHaveText('Running low');
  await atta.locator('[data-act="detail"]').click();
  const sheet = page.locator('.sheet');
  await expect(sheet.locator('.stat-grid')).toContainText('10 days');
  await expect(sheet.locator('.stat-grid')).toContainText('7 kg');
  await expect(sheet.locator('.stat-grid')).toContainText('₹1,260');
  await expect(sheet).toContainText('Aashirvaad');
  await expect(sheet.locator('.price-line')).toContainText('₹42/kg');
  // change estimate to 30 days → runs out 10 Nov → back to In stock
  await sheet.locator('[data-lasts="30"]').click();
  await sheet.locator('[data-lasts-form] button[type="submit"]').click();
  await expect(atta.locator('[data-test="chip"]')).toHaveText('In stock');
  await expect(atta.locator('.item-info')).toContainText('10 Nov');

  // Undo a Finished
  await atta.locator('[data-act="finished"]').click();
  await expect(atta.locator('[data-test="chip"]')).toHaveText('Finished');
  await page.locator('#toast .toast-undo').click();
  await expect(atta.locator('[data-test="chip"]')).toHaveText('In stock');

  // Groceries got both purchases
  await go(page, '2026-10-15', 'budget');
  await expect(tile(page, 'Groceries')).toContainText('₹840');
});

test('search finds by Hindi / Hinglish, "+ Add" creates a new item that stays', async ({ page }) => {
  await fresh(page, T, 'stock');
  await page.locator('[data-search]').fill('chawal');
  await expect(page.locator('.irow')).toHaveCount(1);
  await expect(page.locator('.irow')).toContainText('Rice');
  await page.locator('[data-search]').fill('आलू');
  await expect(page.locator('[data-test="add-new"]')).toContainText('आलू');
  await page.locator('[data-tab="veg"]').click();
  await expect(page.locator('[data-tab="veg"]')).toHaveClass(/on/);
  await expect(page.locator('.vtile')).toHaveCount(1);
  await page.locator('[data-tab="kitchen"]').click();
  await expect(page.locator('[data-tab="kitchen"]')).toHaveClass(/on/);

  await page.locator('[data-search]').fill('jaggery');
  await expect(page.locator('[data-test="add-new"]')).toContainText('jaggery');
  await expect(page.locator('.irow')).toHaveCount(0);
  await page.locator('[data-test="add-new"]').click();
  await expect(page.locator('.sheet input[name="en"]')).toHaveValue('Jaggery');
  await page.locator('.sheet input[name="hi"]').fill('गुड़');
  await page.locator('.sheet select[name="lowDays"]').selectOption('3');
  await page.locator('.sheet button[type="submit"]').click();
  // goes straight to Bought
  await expect(page.locator('.sheet .sheet-title')).toContainText('Bought Jaggery');
  await page.locator('.sheet [data-size="1"]').click();
  await page.locator('.sheet button[type="submit"]').click();
  await page.reload();
  await expect(page.locator('body.ready')).toBeVisible();
  await page.locator('[data-search]').fill('jagg');
  await expect(page.locator('[data-test="add-new"]')).toContainText('jagg');
  await expect(page.locator('.irow')).toHaveCount(1);
  await expect(page.locator('.irow').first()).toContainText('गुड़');
  await expect(page.locator('.irow').first().locator('[data-test="chip"]')).toHaveText('In stock');
});

test('sabzi: ₹/kg price history with ▲▼, need → shopping list, total mode', async ({ page }) => {
  await fresh(page, '2026-10-10', 'stock');
  await page.locator('[data-tab="veg"]').click();
  const onion = page.locator('.vtile[data-item="veg-onion"]');
  await expect(onion).toContainText('no price');
  await onion.click();
  await page.locator('.sheet [data-size="2"]').click();
  await page.locator('.sheet input[name="price"]').fill('40');
  await expect(page.locator('.sheet [data-total-line]')).toHaveText('Total ₹80');
  await page.locator('.sheet button[type="submit"]').click();
  await expect(onion).toContainText('₹40/kg');

  await go(page, '2026-10-17', 'stock');
  await page.locator('[data-tab="veg"]').click();
  await onion.click();
  await expect(page.locator('.sheet .price-line')).toContainText('Last ₹40/kg');
  await page.locator('.sheet [data-size="5"]').click();
  await page.locator('.sheet [data-pm="total"]').click();
  await page.locator('.sheet input[name="price"]').fill('250'); // ₹50/kg
  await page.locator('.sheet button[type="submit"]').click();
  await expect(onion).toContainText('₹50/kg');
  await expect(onion.locator('.over-text')).toHaveText('▲');
  await onion.click();
  await expect(page.locator('.sheet .price-line')).toContainText('+25%');
  await expect(page.locator('.sheet .hist-row')).toHaveCount(2);
  // need → on shopping list
  await page.locator('.sheet [data-need]').click();
  await expect(page.locator('[data-test="shopping"] [data-shop="veg-onion"]')).toBeVisible();
  // buying it takes it off the list
  await page.locator('[data-shop="veg-onion"]').click();
  await page.locator('.sheet [data-size="1"]').click();
  await page.locator('.sheet input[name="price"]').fill('45');
  await page.locator('.sheet button[type="submit"]').click();
  await expect(page.locator('[data-test="shopping"] [data-shop="veg-onion"]')).toHaveCount(0);

  await go(page, '2026-10-17', 'budget');
  await expect(tile(page, 'Groceries')).toContainText('₹375'); // 80 + 250 + 45
});

test('shopping list: copy, share, shopping mode ticks several items at once', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => { navigator.share = async (d) => { window.__shared = d; }; });
  await fresh(page, T, 'stock');
  for (const id of ['item-poha', 'item-salt', 'item-sugar']) {
    await page.locator('[data-search]').fill(id.replace('item-', ''));
    await expect(page.locator('[data-test="add-new"]')).toContainText(id.replace('item-', ''));
    await expect(page.locator('.irow')).toHaveCount(1);
    await row(page, id).locator('[data-act="bought"]').click();
    await page.locator('.sheet input[name="qty"]').fill('1');
    await page.locator('.sheet button[type="submit"]').click();
    await row(page, id).locator('[data-act="finished"]').click();
    await expect(row(page, id)).toHaveAttribute('data-status', 'finished');
  }
  await page.locator('[data-search]').fill('');
  await expect(page.locator('[data-test="add-new"]')).toHaveCount(0);
  await expect(page.locator('[data-test="shopping"] .pill')).toHaveCount(3);
  await page.locator('[data-test="shopping"] [data-act="copy"]').click();
  await expect(page.locator('#toast')).toContainText('copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Poha / पोहा');
  await page.locator('[data-test="shopping"] [data-act="share"]').click();
  expect((await page.evaluate(() => window.__shared)).text).toContain('Salt / नमक');

  await page.locator('[data-act="shopmode"]').click();
  await page.locator('.sheet [name="pick"][value="item-poha"]').check();
  await page.locator('.sheet [name="pick"][value="item-salt"]').check();
  await page.locator('.sheet [name="price-item-poha"]').fill('70');
  await expect(page.locator('.sheet [data-done]')).toHaveText('Done · 2 bought');
  await page.locator('.sheet [data-done]').click();
  // bought today; same-day buy + finish earlier taught Kozy "1-day pack", so they show as low, not finished
  await expect(page.locator('[data-shop="item-poha"]')).not.toHaveClass(/over/);
  await expect(page.locator('[data-shop="item-salt"]')).not.toHaveClass(/over/);
  await expect(page.locator('[data-shop="item-sugar"]')).toHaveClass(/over/);
  await expect(page.locator('[data-test="bought-today"]')).toContainText('Poha');
  await go(page, T, 'budget');
  await expect(tile(page, 'Groceries')).toContainText('₹70');
});

test('milk: buffalo + cow with own rates, one-tap tick, Change, per-type totals, pay milkman', async ({ page }) => {
  await fresh(page, T, 'milk');
  const setup = page.locator('[data-test="milk-setup"]');
  await expect(setup.locator('.mtype')).toHaveCount(2); // Buffalo 2 L + Cow 1.5 L by default
  await setup.locator('.mtype[data-type="buffalo"] [name="t-rate"]').fill('70');
  await setup.locator('.mtype[data-type="cow"] [name="t-rate"]').fill('55');
  await setup.locator('button[type="submit"]').click();
  await expect(setup).toHaveCount(0);
  await expect(page.locator('.top .sub')).toContainText('2 L 🐃 + 1.5 L 🐄');

  // one tap = done; the toast offers Change → same day editor
  await page.locator('[data-act="tick"]').click();
  await expect(page.locator('[data-test="milk-today"]')).toContainText('✓ 3.5 L');
  await page.locator('#toast [data-test="toast-action"]').click();
  const day = page.locator('[data-test="milk-day"]');
  await expect(day.locator('[name="l-buffalo"]')).toHaveValue('2');
  await day.locator('[name="l-cow"]').fill('2');
  await day.locator('button[type="submit"]').click();
  await expect(page.locator('[data-test="milk-today"]')).toContainText('✓ 4 L');
  await expect(page.locator(`.cal-cell[data-day="${T}"]`)).toHaveClass(/got/);

  // another day from the calendar: 2 buffalo + 1 cow; and a skipped day
  await page.locator('.cal-cell[data-day="2026-10-16"]').click();
  await day.locator('[name="l-cow"]').fill('1');
  await day.locator('button[type="submit"]').click();
  await page.locator('.cal-cell[data-day="2026-10-15"]').click();
  await page.locator('.sheet [data-skip]').click();
  await expect(page.locator('.cal-cell[data-day="2026-10-15"]')).toHaveClass(/skip/);
  await expect(page.locator('.cal-cell[data-day="2026-10-20"]')).toBeDisabled();

  // 17th: 2×70 + 2×55 = 250 · 16th: 2×70 + 1×55 = 195 → 7 L, ₹445
  await expect(page.locator('[data-test="milk-litres"]')).toHaveText('7');
  await expect(page.locator('[data-test="milk-amount"]')).toHaveText('₹445');
  await expect(page.locator('[data-test="milk-by-type"]')).toContainText('Buffalo');
  await expect(page.locator('[data-test="milk-by-type"]')).toContainText('₹280');
  await expect(page.locator('[data-test="milk-by-type"]')).toContainText('₹165');

  // milkman: due ₹445, part payment leaves the rest
  await expect(page.locator('[data-test="milk-due"]')).toHaveText('₹445');
  await page.locator('[data-test="pay-milk"]').click();
  await page.locator('[data-test="pay-sheet"] input[name="amount"]').fill('300');
  await page.locator('[data-test="pay-sheet"] [data-save]').click();
  await expect(page.locator('[data-test="milk-due"]')).toHaveText('₹145');
  await go(page, T, 'budget');
  await expect(tile(page, 'Milk')).toContainText('₹300');
  await go(page, T, 'home');
  await expect(page.locator('[data-test="chip-milk"]')).toContainText('Milk ✓ 4 L');

  // a new rate applies from now; old days keep theirs
  await go(page, T, 'settings');
  await openSec(page, 'money');
  await page.locator('[data-sec="money"] .mtype[data-type="cow"] [name="t-rate"]').fill('60');
  await page.locator('[data-form="milk"] button[type="submit"]').click();
  await go(page, T, 'milk');
  await expect(page.locator('[data-test="milk-amount"]')).toHaveText('₹445');
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
});

test('demo data: summary, who spent, goals, activity; backup, reset, restore', async ({ page }) => {
  await fresh(page, T, 'settings');
  await loadDemo(page);
  await expect(page.locator('[data-test="recent"] .act-row')).toHaveCount(4);
  await expect(page.locator('[data-test="chip-goal"]')).toContainText('Diwali 75%');
  await page.locator('[data-act="activity"]').click();
  expect(await page.locator('[data-test="activity"] .act-row').count()).toBeGreaterThan(30);
  await page.keyboard.press('Escape');

  await go(page, T, 'budget');
  await expect(page.locator('[data-test="goals"]')).toContainText('₹4,500');
  await expect(page.locator('[data-test="savings"]')).toContainText('₹4,500');
  await expect(page.locator('.chart .cb')).toHaveCount(6);
  await page.locator('[data-view="summary"]').click();
  await expect(page.locator('[data-test="who-spent"]')).toContainText('Wife');
  await expect(page.locator('[data-test="veg-movers"] .mv-row').first()).toBeVisible();
  await page.locator('[data-view="spends"]').click();
  await page.locator('[data-act="who"][data-who="Wife"]').click();
  await expect(page.locator('[data-act="who"][data-who="Wife"]')).toHaveClass(/on/);
  const wifeRows = await page.locator('[data-test="entries"] .entry-sub').allTextContents();
  expect(wifeRows.length).toBeGreaterThan(5);
  expect(wifeRows.every((t) => t.endsWith('Wife'))).toBe(true);

  await go(page, T, 'settings');
  await openSec(page, 'data');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="export"]').click()]);
  const backup = JSON.parse(await readFile(await dl.path(), 'utf8'));
  expect(backup.app).toBe('kozy');
  expect(backup.entries.length).toBeGreaterThan(30);

  await page.locator('[data-act="reset"]').click();
  await page.locator('.sheet [data-yes]').click();
  await expect(page.locator('[data-test="left"]')).toHaveText('₹40,000');
  await go(page, T, 'stock');
  await expect(page.locator('.irow')).toHaveCount(17);

  await go(page, T, 'settings');
  await openSec(page, 'data');
  await page.locator('input[data-act="import"]').setInputFiles(await dl.path());
  await page.locator('.sheet [data-yes]').click();
  await expect(page.locator('#toast')).toContainText('restored');
  await go(page, T, 'budget');
  await page.locator('[data-view="spends"]').click();
  await page.locator('[data-act="who"][data-who=""]').click();
  await expect.poll(() => page.locator('[data-test="entries"] .entry').count()).toBeGreaterThan(30);
});

test('settings: change a limit, add a goal', async ({ page }) => {
  await fresh(page, T, 'settings');
  await openSec(page, 'limits');
  const r = page.locator('.limit-row', { has: page.locator('input[value="Buffer"]') });
  await r.locator('input[name="limit"]').fill('1900');
  await page.locator('[data-form="cats"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('₹41,000');
  await go(page, T, 'home');
  await expect(page.locator('[data-test="left"]')).toHaveText('₹41,000');

  await go(page, T, 'settings');
  await openSec(page, 'goals');
  const g = page.locator('[data-form="goal"]');
  await g.locator('[name="name"]').fill('New cooler');
  await g.locator('[name="target"]').fill('8000');
  await g.locator('[name="cat"]').selectOption('buffer');
  await g.locator('button[type="submit"]').click();
  await addSpend(page, 2000, 'Buffer');
  await go(page, T, 'budget');
  await expect(page.locator('[data-test="goals"]')).toContainText('New cooler');
  await expect(page.locator('[data-test="goals"]')).toContainText('₹2,000');
});

test('roles: editor adds and edits any spend but cannot change setup; viewer only views', async ({ page }) => {
  await fresh(page);
  await addSpend(page, 999, 'Home misc', 'UPI', 'Owner spend');

  // member (wife)
  await go(page, T, 'home', 'member');
  await expect(page.locator('.preview-bar')).toContainText('wife');
  await expect(page.locator('.who-chip')).toHaveText('Wife');
  await addSpend(page, 120, 'Groceries', 'Cash', 'Wife spend');
  await expect(page.locator('[data-test="recent"]')).toContainText('Wife added ₹120');
  await go(page, T, 'budget', 'member');
  await page.locator('[data-view="spends"]').click();
  // an editor may fix ANY spend, the owner's too
  await page.locator('[data-entry]', { hasText: 'Owner spend' }).click();
  await expect(page.locator('.sheet [data-save]')).toBeVisible();
  await page.locator('.sheet [name="amount"]').fill('1001');
  await page.locator('.sheet [data-save]').click();
  await expect(page.locator('[data-entry]', { hasText: 'Owner spend' })).toContainText('₹1,001');
  await page.locator('[data-entry]', { hasText: 'Wife spend' }).click();
  await expect(page.locator('.sheet [data-save]')).toBeVisible();
  await page.keyboard.press('Escape');
  await go(page, T, 'settings', 'member');
  await expect(page.locator('[data-form="cats"] input[name="limit"]').first()).toBeDisabled();
  await expect(page.locator('[data-act="reset"]')).toHaveCount(0);
  await expect(page.locator('[data-act="demo"]')).toHaveCount(0);
  // the store refuses setup writes even if a button slipped through
  const msg = await page.evaluate(async () => {
    const s = await import('/js/store.js');
    try { await s.setMeta('cats', []); return 'allowed'; } catch (e) { return e.message; }
  });
  expect(msg).toBe('Only the admin can change setup');
  await go(page, T, 'stock', 'member');
  await row(page, 'item-dal').locator('[data-act="bought"]').click();
  await page.locator('.sheet input[name="qty"]').fill('2');
  await page.locator('.sheet button[type="submit"]').click();
  await expect(page.locator('[data-test="bought-today"]')).toContainText('Wife');

  // viewer
  await go(page, T, 'home', 'viewer');
  await expect(page.locator('.who-chip')).toHaveText('View only');
  await expect(page.locator('#fab')).toBeHidden();
  await expect(page.locator('[data-test="left"]')).toBeVisible();
  await go(page, T, 'stock', 'viewer');
  await expect(page.locator('.ibtn')).toHaveCount(0);
  await expect(page.locator('[data-act="shopmode"]')).toHaveCount(0);
  await go(page, T, 'milk', 'viewer');
  await expect(page.locator('[data-act="tick"]')).toHaveCount(0);
  const vmsg = await page.evaluate(async () => {
    const s = await import('/js/store.js');
    try { await s.put('entries', { amount: 1, cat: 'misc', date: '2026-10-17' }); return 'allowed'; } catch (e) { return e.name; }
  });
  expect(vmsg).toBe('ReadOnlyError');
});

test('works offline after first visit (service worker)', async ({ page, context }) => {
  await page.goto(`/?today=${T}#/home`);
  await expect(page.locator('body.ready')).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.locator('body.ready')).toBeVisible();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await addSpend(page, 99, 'Buffer');

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('body.ready')).toBeVisible();
  await expect(page.locator('[data-test="recent"]')).toContainText('₹99');
  await go(page, T, 'stock');
  await expect(page.locator('.irow')).toHaveCount(17);
  await context.setOffline(false);
});

test('no screen is wider than the phone (no sideways scrolling)', async ({ page }) => {
  await fresh(page, T, 'settings');
  await loadDemo(page);
  for (const [r, extra] of [['home'], ['budget'], ['budget', 'spends'], ['budget', 'summary'], ['stock'], ['stock', 'veg'], ['milk'], ['settings']]) {
    await go(page, T, r);
    if (extra === 'veg') await page.locator('[data-tab="veg"]').click();
    else if (extra) await page.locator(`[data-view="${extra}"]`).click();
    if (r === 'settings') for (const k of ['limits', 'bills', 'goals', 'money', 'items', 'remind', 'data', 'account']) await openSec(page, k);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(wide, `${r} ${extra || ''}`).toBeLessThanOrEqual(0);
  }
});

// ---------- v1.2 ----------
test('edit any entry: kitchen purchase, sabzi price, Today pill, Recent rows (spend, purchase, milk)', async ({ page }) => {
  await fresh(page, T, 'stock');
  // kitchen purchase → edit qty + price from the item history
  await row(page, 'item-atta').locator('[data-act="bought"]').click();
  await page.locator('.sheet [data-size="10"]').click();
  await page.locator('.sheet input[name="price"]').fill('420');
  await page.locator('.sheet button[type="submit"]').click();
  await row(page, 'item-atta').locator('[data-act="detail"]').click();
  await page.locator('.sheet [data-edit-ev]').first().click();
  const ed = page.locator('[data-test="edit-purchase"]');
  await ed.locator('[name="qty"]').fill('5');
  await ed.locator('[name="price"]').fill('230');
  await ed.locator('[name="note"]').fill('Shakti bhog');
  await ed.locator('[data-save]').click();
  await expect(page.locator('.sheet .hist-row').first()).toContainText('Bought 5 kg · ₹230');
  await page.keyboard.press('Escape');
  // the Today strip pill opens the same editor
  await page.locator('[data-test="bought-today"] [data-act="edit-ev"]').first().click();
  await expect(page.locator('[data-test="edit-purchase"] [name="price"]')).toHaveValue('230');
  await page.keyboard.press('Escape');

  // sabzi purchase → fix the price
  await page.locator('[data-tab="veg"]').click();
  await page.locator('.vtile[data-item="veg-tomato"]').click();
  await page.locator('.sheet [data-size="2"]').click();
  await page.locator('.sheet input[name="price"]').fill('40');
  await page.locator('.sheet button[type="submit"]').click();
  await page.locator('.vtile[data-item="veg-tomato"]').click();
  await page.locator('.sheet [data-edit-ev]').first().click();
  await page.locator('[data-test="edit-purchase"] [name="price"]').fill('70');
  await page.locator('[data-test="edit-purchase"] [data-save]').click();
  await expect(page.locator('.sheet .price-line')).toContainText('₹35/kg');
  await page.keyboard.press('Escape');

  await go(page, T, 'budget');
  await expect(tile(page, 'Groceries')).toContainText('₹300');

  // Recent on Home: tap rows to edit
  await go(page, T, 'home');
  await page.locator('[data-test="chip-milk"]').click();
  await addSpend(page, 150, 'Home misc', 'Cash', 'Tape');
  await page.locator('[data-test="recent"] [data-open="spend"]').first().click();
  await expect(page.locator('.sheet .sheet-title')).toHaveText('Edit spend');
  await page.keyboard.press('Escape');
  await page.locator('[data-test="recent"] [data-open="milk"]').first().click();
  await expect(page.locator('.sheet .sheet-title')).toContainText('Milk');
  await page.keyboard.press('Escape');
  await page.locator('[data-test="recent"] [data-open="stock"]').first().click();
  await expect(page.locator('[data-test="edit-purchase"]')).toBeVisible();
});

test('salary-day checklist on the 1st: Done / Skip, one tap each', async ({ page }) => {
  await fresh(page, '2026-11-01');
  await expect(page.locator('[data-test="chip-checklist"]')).toHaveText(/Salary day · 3 to do/);
  await page.locator('[data-test="chip-checklist"]').click();
  await expect(page.locator('.sheet .sheet-title')).toHaveText('✅ Salary-day checklist');
  await page.locator('[data-bill="c-festival"] button[type="submit"]').click();
  await page.locator('[data-skip="c-emergency"]').click();
  await page.locator('[data-bill="c-card"] button[type="submit"]').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('[data-test="chip-checklist"]')).toHaveCount(0);
  await go(page, '2026-11-01', 'budget');
  await expect(tile(page, 'Festival fund')).toContainText('₹1,500');
  await expect(tile(page, 'Credit card payoff')).toContainText('₹3,000');
  await expect(tile(page, 'Emergency fund')).toContainText('₹0');
});

test('budget manager: own monthly budget, allocation shown while editing', async ({ page }) => {
  await fresh(page, T, 'settings');
  await openSec(page, 'limits');
  await expect(page.locator('[data-alloc]')).toContainText('All assigned ✓');
  await page.locator('[data-test="budget-total"]').fill('45000');
  await expect(page.locator('[data-alloc]')).toContainText('₹5,000 left to assign');
  await page.locator('[data-form="cats"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('₹5,000 not assigned');
  await go(page, T, 'home');
  await expect(page.locator('[data-test="left"]')).toHaveText('₹45,000');
});

test('insights, year view, family spends, monthly plan', async ({ page }) => {
  await fresh(page, T, 'settings');
  await loadDemo(page);
  await go(page, T, 'budget');
  await expect(page.locator('[data-test="insights"]')).toContainText('At this pace you will spend about');

  await page.locator('[data-view="summary"]').click();
  await expect(page.locator('[data-test="insights"]')).toContainText('You usually spend');
  const fam = page.locator('[data-test="family"]');
  await expect(fam).toContainText('Papa');
  await expect(fam).toContainText('₹450');
  await fam.locator('[data-fam="Papa"]').click();
  await expect(page.locator('[data-test="entries"] .entry')).toHaveCount(1);
  await expect(page.locator('[data-test="entries"]')).toContainText('Medicine for Papa');

  await page.locator('[data-view="year"]').click();
  await expect(page.locator('[data-test="fy"]')).toContainText('FY 2026–27');
  await expect(page.locator('[data-test="year"] .chart .cb')).toHaveCount(12);
  await page.locator('[data-act="fy-prev"]').click();
  await expect(page.locator('[data-test="fy"]')).toContainText('FY 2025–26');

  await go(page, T, 'stock');
  await page.locator('[data-tab="plan"]').click();
  await expect(page.locator('[data-test="plan"]')).toContainText('Kitchen / month');
  await expect(page.locator('.plan-row[data-plan="item-atta"]')).toContainText(/uses \d+(\.\d)? kg\/month · buy \d+ × 10 kg/);
  await page.locator('[data-act="plan-all"]').click();
  await page.locator('[data-tab="kitchen"]').click();
  await expect(page.locator('[data-test="shopping"] [data-shop="item-atta"]')).toBeVisible();
});

test('guest mode: own sample copy on this device, separate from real data, exit to sign in', async ({ page }) => {
  await fresh(page);
  await addSpend(page, 777, 'Buffer', 'UPI', 'Real family spend');
  await page.evaluate(() => localStorage.setItem('kozy.guest', '1'));
  await page.reload();
  await expect(page.locator('[data-test="guest-bar"]')).toContainText('Guest mode');
  await expect(page.locator('.who-chip')).toHaveText('Guest');
  await expect(page.locator('[data-test="recent"] .act-row')).toHaveCount(4); // demo data loaded
  await expect(page.locator('[data-test="recent"]')).not.toContainText('Real family spend');
  await page.locator('[data-test="guest-bar"] button').click();
  await expect(page.locator('[data-test="guest-bar"]')).toHaveCount(0);
  await expect(page.locator('[data-test="recent"]')).toContainText('Real family spend');
});

// ---------- v1.5 ----------
test('header: name + real gear only; appearance Auto / Light / Dark saved on this phone', async ({ page }) => {
  await fresh(page, T, 'budget');
  await expect(page.locator('.top .who-chip')).toHaveText('Me');
  await expect(page.locator('.top .gear-btn')).toHaveAttribute('aria-label', 'Settings');
  await go(page, T, 'settings');
  await openSec(page, 'look');
  await page.locator('[data-test="theme"] [data-theme-v="dark"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); // remembered
  await openSec(page, 'look');
  await page.locator('[data-test="theme"] [data-theme-v="auto"]').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  // card due is gone; the section is Milk only
  await expect(page.locator('[data-sec="money"] summary')).toContainText('Milk');
  await expect(page.locator('[data-sec="money"] summary')).not.toContainText('Card');
});

test('next month: new-month card on the 1st, limits from usual spend, unpaid milk carries over', async ({ page }) => {
  await fresh(page, '2026-11-01', 'settings');
  await openSec(page, 'data');
  await page.locator('[data-act="demo"]').click();
  await page.locator('.sheet [data-yes]').click();
  await expect(page.locator('.screen-home')).toBeVisible();
  const nm = page.locator('[data-test="new-month"]');
  await expect(nm).toContainText('October 2026: spent');
  await expect(nm).toContainText('Same budget, limits and bills continue');
  // Remove October's milk payment → October's milk is unpaid and carries into November
  await page.evaluate(async () => {
    const store = await import('/js/store.js');
    for (const e of store.list('entries').filter((x) => x.cat === 'milk' && x.date.startsWith('2026-10'))) await store.remove('entries', e.id);
  });
  await expect(page.locator('[data-test="chip-milkman"]')).toContainText('Pay milkman');
  await go(page, '2026-11-01', 'milk');
  await expect(page.locator('[data-test="milk-earlier"]')).toContainText('Earlier unpaid');
  // usual spend shown next to limits; one tap fills them
  await go(page, '2026-11-01', 'settings');
  await openSec(page, 'limits');
  await expect(page.locator('.limit-row .usual').first()).toContainText('usual');
  await page.locator('[data-test="use-usual"]').click();
  const travel = page.locator('.limit-row', { has: page.locator('input[value="Office travel"]') }).locator('input[name="limit"]');
  expect(Number(await travel.inputValue())).not.toBe(5000);
});
