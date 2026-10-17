// Saves screenshots of every screen (light + dark) with demo data into /screenshots.
import { test, expect } from '@playwright/test';

const T = '2026-10-17';

async function shot(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `screenshots/${name}.png` });
}

async function closeSheet(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#overlay')).toBeHidden();
}

for (const scheme of ['light', 'dark']) {
  test(`screenshots ${scheme}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto(`/?today=${T}#/settings`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-sec="data"] > summary').click();
    await page.locator('[data-act="demo"]').click();
    await page.locator('.sheet [data-yes]').click();
    await expect(page.locator('.screen-home')).toBeVisible();
    await expect(page.locator('#toast.show')).toHaveCount(0, { timeout: 5000 });
    // Leave this month's gas bill due today so the bills chip shows on Home.
    await page.evaluate(async (t) => {
      const store = await import('/js/store.js');
      const st = { ...store.meta('billState', {}) };
      st['b-gas'] = { due: t };
      await store.setMeta('billState', st);
    }, T);

    const s = (n) => `${n}-${scheme}`;
    await page.goto(`/?today=${T}#/home`); await expect(page.locator('.screen-home')).toBeVisible(); await shot(page, s('home'));
    await page.locator('[data-act="bills"]').click(); await shot(page, s('home-bills')); await closeSheet(page);

    await page.goto(`/?today=${T}#/budget`); await expect(page.locator('.screen-budget')).toBeVisible(); await shot(page, s('budget'));
    await page.locator('[data-view="spends"]').click(); await shot(page, s('budget-spends'));
    await page.locator('[data-view="summary"]').click(); await shot(page, s('budget-summary'));
    await page.locator('[data-view="cats"]').click();

    await page.goto(`/?today=${T}#/stock`); await expect(page.locator('.screen-stock')).toBeVisible(); await shot(page, s('stock'));
    await page.locator('.irow[data-item="item-atta"] [data-act="bought"]').click(); await shot(page, s('stock-bought')); await closeSheet(page);
    await page.locator('[data-act="shopmode"]').click(); await shot(page, s('stock-shopping')); await closeSheet(page);
    await page.locator('[data-search]').fill('jagg'); await shot(page, s('stock-search-add'));
    await page.locator('[data-search]').fill('');
    await page.locator('[data-tab="veg"]').click(); await shot(page, s('sabzi'));
    await page.locator('.vtile[data-item="veg-onion"]').click(); await shot(page, s('sabzi-onion')); await closeSheet(page);
    await page.locator('[data-tab="kitchen"]').click();

    await page.goto(`/?today=${T}#/milk`); await expect(page.locator('.screen-milk')).toBeVisible(); await shot(page, s('milk'));
    await page.goto(`/?today=${T}#/settings`); await expect(page.locator('.screen-settings')).toBeVisible();
    await page.locator('[data-sec="bills"] > summary').click(); await shot(page, s('settings'));

    await page.goto(`/?today=${T}#/home`);
    await page.locator('#fab').click();
    await page.locator('.sheet [name="smart"]').fill('onion 5kg 50/kg');
    await shot(page, s('quick-add'));
    await closeSheet(page);

    await page.goto(`/?today=${T}&role=member#/home`); await expect(page.locator('.screen-home')).toBeVisible(); await shot(page, s('member-home'));
    await page.goto(`/?today=${T}&role=viewer#/stock`); await expect(page.locator('.screen-stock')).toBeVisible(); await shot(page, s('viewer-stock'));
  });
}
