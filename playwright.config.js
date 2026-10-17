// Playwright: headless Chromium at iPhone-ish size 390x844.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    acceptDownloads: true,
  },
  webServer: {
    command: 'node tools/server.mjs 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
