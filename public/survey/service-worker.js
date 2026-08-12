const CACHE_NAME = 'survey-geo-builder-v9';
const SHELL_FILES = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHTML = req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('/index.html');

  // HTML: network-first so updates ship immediately
  if (isHTML) {
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Shell assets: cache-first
  if (SHELL_FILES.some((f) => url.pathname.endsWith(f.replace('./', '')))) {
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
    return;
  }

  // Everything else (tiles, CDN libs): network-first, cache fallback
  event.respondWith(
    fetch(req).then((res) => {
      if (url.href.includes('tile') || url.href.includes('ArcGIS') || url.href.includes('unpkg') || url.href.includes('cdn')) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
