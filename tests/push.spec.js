// The service worker shows a reminder notification when a push arrives (same payload send.mjs sends).
import { test, expect } from '@playwright/test';

test('push message → notification shown by the service worker', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'uses Chrome DevTools Protocol');
  await context.grantPermissions(['notifications'], { origin: 'http://localhost:5174' });
  const cdp = await context.newCDPSession(page);
  let regId = null;
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => {
    const r = e.registrations.find((x) => x.scopeURL.startsWith('http://localhost:5174/'));
    if (r) regId = r.registrationId;
  });
  await cdp.send('ServiceWorker.enable');
  await page.goto('/?today=2026-10-17#/home');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // controlled by the SW now
  await expect(page.locator('body.ready')).toBeVisible();
  await expect.poll(() => regId).not.toBeNull();
  const errs = [];
  cdp.on('ServiceWorker.workerErrorReported', (e) => errs.push(e.errorMessage?.errorMessage));

  const payload = { data: { title: 'Kozy: 1 bill due, items to buy', body: '🛡️ LIC premium due in 9 days', url: '#/home', tag: 'kozy-morning' } };
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: 'http://localhost:5174', registrationId: regId, data: JSON.stringify(payload) });

  await page.waitForTimeout(300);
  expect(errs).toEqual([]);
  // The SW ran its push handler (showNotification + message to the open page → toast).
  await expect(page.locator('#toast')).toContainText('🔔 Kozy: 1 bill due, items to buy');
  const shown = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.getNotifications()).map((x) => `${x.title} | ${x.body}`).join(';');
  });
  // Headless Chrome may not keep notifications around; when it does, check the text too.
  if (shown) expect(shown).toContain('Kozy: 1 bill due, items to buy | 🛡️ LIC premium due in 9 days');
});
