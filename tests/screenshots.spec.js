// Saves screenshots of every screen (light + dark) with demo data into /screenshots.
import { test, expect } from '@playwright/test';

const T = '2026-10-17';
const SCREENS = ['home', 'budget', 'stock', 'milk', 'settings'];

for (const scheme of ['light', 'dark']) {
  test(`screenshots ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto(`/?today=${T}#/settings`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-act="demo"]').click();
    await page.locator('.sheet [data-yes]').click();
    await expect(page.locator('.screen-home')).toBeVisible();
    // Leave this month's gas bill pending so the recurring card shows on Home.
    await page.evaluate(async () => {
      const store = await import('/js/store.js');
      const done = { ...store.meta('recurringDone', {}) };
      done['2026-10'] = ['r-solar', 'r-wifi'];
      const gas = store.list('entries').find((e) => e.ref === 'r-gas' && e.date.startsWith('2026-10'));
      if (gas) await store.remove('entries', gas.id);
      await store.setMeta('recurringDone', done);
    });

    for (const s of SCREENS) {
      await page.goto(`/?today=${T}#/${s}`);
      await expect(page.locator(`.screen-${s}`)).toBeVisible();
      await page.waitForTimeout(150);
      await page.screenshot({ path: `screenshots/${s}-${scheme}.png`, fullPage: true });
    }
    // Sheets
    await page.goto(`/?today=${T}#/home`);
    await page.locator('#fab').click();
    await page.locator('.sheet input[name="amount"]').fill('450');
    await page.locator('.sheet .cat-chip', { hasText: 'Groceries' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/quick-add-${scheme}.png` });
    await page.keyboard.press('Escape');

    await page.goto(`/?today=${T}#/stock`);
    await page.locator('.item[data-item="item-atta"] [data-act="bought"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/stock-bought-${scheme}.png` });
    await page.keyboard.press('Escape');
    await page.locator('.item[data-item="item-atta"] [data-act="detail"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/stock-detail-${scheme}.png` });
  });
}
