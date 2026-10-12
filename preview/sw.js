/* -----------------------------------------------------------------------------
   Kurd Castle — preview service worker
   The whole game is a few kilobytes of text (no art, no audio), so the app shell
   is precached outright: after the first visit the game starts offline and
   instantly, which is also what an installed PWA or a Trusted Web Activity
   build needs in order to behave like a real app.
   --------------------------------------------------------------------------- */

const CACHE = 'kurd-castle-v1';

const SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './pwa.js',
  './src/main.js',
  './src/sim.js',
  './src/map.js',
  './src/render.js',
  './src/ui.js',
  './src/balance.js',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Navigations fall back to the cached shell so a cold start works offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html').then((r) => r || Response.error()))
    );
    return;
  }

  // Everything else: cache first, refresh in the background (stale-while-revalidate).
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
