/* Admin Panel Service Worker – offline caching */
const CACHE_NAME = 'mcq-admin-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/auth.js',
  './js/questions.js',
  './js/admin.js',
  './js/pdf.js',
  './js/app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        // Still succeed install even if CDN fails offline
        console.warn('Some assets failed to cache:', err);
        return cache.addAll([
          './',
          './index.html',
          './css/style.css',
          './js/storage.js',
          './js/auth.js',
          './js/questions.js',
          './js/admin.js',
          './js/pdf.js',
          './js/app.js'
        ]);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache successful same-origin / CDN responses
        if (res && res.status === 200 && (req.url.startsWith(self.location.origin) || req.url.includes('cdnjs.cloudflare.com'))) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback for navigation
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
