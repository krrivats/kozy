// Kozy service worker — makes the app open with no internet.
// Strategy: network first for our own files (so updates show up), cache as fallback (offline).
// Bump VERSION when files change so old caches are cleaned.
const VERSION = 'kozy-v1.0.0';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/config.js',
  'js/firebase-config.js',
  'js/store.js',
  'js/ui.js',
  'js/adapters/local.js',
  'js/adapters/firestore.js',
  'js/logic/format.js',
  'js/logic/budget.js',
  'js/logic/stock.js',
  'js/logic/milk.js',
  'js/logic/demo.js',
  'js/views/common.js',
  'js/views/home.js',
  'js/views/budget.js',
  'js/views/stock.js',
  'js/views/milk.js',
  'js/views/settings.js',
  'js/views/spend-sheet.js',
  'js/views/login.js',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firebase SDK from the CDN: cache after first load so Firebase mode also opens offline.
  if (url.hostname === 'www.gstatic.com') {
    event.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return; // Firestore / auth traffic: leave alone

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./'));
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
