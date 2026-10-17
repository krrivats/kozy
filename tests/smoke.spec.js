import { test, expect } from '@playwright/test';

test('every screen renders without console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await expect(page.locator('[data-test="hero"]')).toBeVisible();
  for (const r of ['budget', 'stock', 'milk', 'settings', 'home']) {
    await page.goto(`/#/${r}`);
    await expect(page.locator(`.screen-${r}`)).toBeVisible();
  }
  expect(errors).toEqual([]);
});
