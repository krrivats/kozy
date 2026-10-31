// Bill photo scan with the real scanner (Tesseract.js from the CDN — needs internet).
import { test, expect } from '@playwright/test';

test('scan a printed bill photo → review → saved as purchases', async ({ page, browser }) => {
  test.skip(!!process.env.CI, 'The bill picture is drawn with the machine's fonts, so OCR only matches on the laptop');
  test.setTimeout(180000);
  // 1) make a bill "photo"
  const b = await browser.newPage({ viewport: { width: 560, height: 520 } });
  await b.setContent(`<body style="margin:0;background:#fff;font:22px/1.5 Courier New,monospace;color:#111;padding:24px">
    <div style="text-align:center;font-weight:bold">SHRI BALAJI KIRANA STORE</div>
    <div>Date: 17/10/2026</div><br>
    <div>Aashirvaad Atta 10kg &nbsp;&nbsp; 420.00</div>
    <div>Fortune Oil 1L &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 165.00</div>
    <div>Tata Salt 1kg &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 28.00</div>
    <div>Parle G Biscuit &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 40.00</div><br>
    <div style="font-weight:bold">Grand Total &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 653.00</div></body>`);
  const png = await b.screenshot();
  await b.close();

  // 2) scan it in Kozy
  await page.goto('/?today=2026-10-17#/home');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('body.ready')).toBeVisible();
  await page.locator('#fab').click();
  await page.locator('.sheet [data-scan]').click();
  await page.locator('[data-test="scan"] [data-file]').setInputFiles({ name: 'bill.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('[data-review]')).toBeVisible({ timeout: 150000 });
  const review = page.locator('[data-review]');
  await expect(review).toContainText('bill total ₹653');
  await expect(review).toContainText('Atta');
  await expect(review).toContainText('Oil');
  await expect(review).toContainText('Salt');
  await page.locator('[data-save-scan]').click();
  await expect(page.locator('#toast')).toContainText('₹653');

  // 3) atta is now in stock, and Groceries has the money
  await page.goto('/?today=2026-10-17#/stock');
  await expect(page.locator('.irow[data-item="item-atta"] [data-test="chip"]')).toHaveText('In stock');
  await page.goto('/?today=2026-10-17#/budget');
  await expect(page.locator('.ctile', { hasText: 'Groceries' })).toContainText('₹653');
});
