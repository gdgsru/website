/* GDG SRU · Campus Service Worker (Offline Resilience & PWA)
   Caches core shells and assets for seamless offline browsing on campus Wi-Fi.
*/
const CACHE_NAME = 'gdg-sru-v5';
const CORE_SHELLS = [
  '/',
  '/index.html',
  '/events/',
  '/team/',
  '/blog/',
  '/join/',
  '/member-badge/',
  '/certificates/',
  '/verify/',
  '/leaderboard/',
  '/resources/',
  '/privacy/',
  '/favicon.svg',
  '/assets/brand/gdg-logo.svg',
  '/manifest.webmanifest',
  '/assets/fonts/fonts.css',
  '/assets/css/page-home.css',
  '/assets/js/app.js',
  '/assets/js/card-system.js',
  '/assets/js/polish.js',
  '/assets/js/easter-eggs.js',
  '/assets/js/command-palette.js',
  '/assets/js/card-tilt.js',
  '/assets/js/pwa.js',
  '/assets/js/member-pass.js',
  '/assets/js/config-loader.js',
  '/assets/js/cert-engine.js',
  '/assets/data/certificate-default-template.html',
  '/assets/vendor/html2canvas.min.js',
  '/assets/vendor/jspdf.umd.min.js',
  '/assets/js/vendor/supabase.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use catch on individual resources so missing non-critical resources won't fail install
      return Promise.all(
        CORE_SHELLS.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn('[SW] Pre-cache skipped:', url, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Ignore cross-origin Supabase API / CDN / analytics requests for stale-while-revalidate
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-First for Mission Control admin portal
  if (url.pathname.includes('mission-control')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Stale-While-Revalidate for campus shell & static assets
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(req);

      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(req, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // If network failed and nothing cached, fallback to index
          if (req.mode === 'navigate') {
            return cache.match('/');
          }
          return null;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
