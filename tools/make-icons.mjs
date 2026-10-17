// Draws the Kozy logo into PNG app icons using headless Chromium: npm run icons
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const out = (f) => fileURLToPath(new URL(`../icons/${f}`, import.meta.url));

// rounded = favicon-style; full = square (iOS/Android round it themselves); safe = smaller art for maskable
function svg({ rounded, scale = 1 }) {
  const r = rounded ? 16 : 0;
  const t = `translate(32 32) scale(${scale}) translate(-32 -32)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
    <rect width="64" height="64" rx="${r}" fill="#1F6B57"/>
    <g transform="${t}">
      <path d="M12 30 32 13l20 17" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="32" cy="38" r="13" fill="#F2B544"/>
      <text x="32" y="44.5" text-anchor="middle" font-size="17" font-weight="800" font-family="Segoe UI, system-ui, sans-serif" fill="#4A3200">₹</text>
    </g>
  </svg>`;
}

const jobs = [
  ['icon-192.png', 192, { rounded: false, scale: 0.88 }],
  ['icon-512.png', 512, { rounded: false, scale: 0.88 }],
  ['icon-maskable-512.png', 512, { rounded: false, scale: 0.8 }],
  ['apple-touch-icon.png', 180, { rounded: false, scale: 0.88 }],
  ['favicon-32.png', 32, { rounded: true, scale: 1 }],
];

const browser = await chromium.launch();
for (const [file, size, opt] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(opt)}</body></html>`);
  await page.screenshot({ path: out(file), omitBackground: true });
  await page.close();
  console.log('wrote', file);
}
await browser.close();
