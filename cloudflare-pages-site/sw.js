/* GDG SRU · Campus Service Worker (Offline Resilience & PWA)
   Caches core shells and assets for seamless offline browsing on campus Wi-Fi.
*/
const CACHE_NAME = 'gdg-sru-v41';
const CORE_SHELLS = [
  '/',
  '/index.html',
  '/events/',
  '/team/',
  '/blog/',
  '/join/',
  '/member-badge/',
  '/members/',
  '/profile.html',
  '/certificates/',
  '/verify/',
  '/leaderboard/',
  '/resources/',
  '/privacy/',
  '/favicon.svg',
  '/assets/brand/gdg-logo.svg',
  '/manifest.webmanifest',
  '/assets/fonts/fonts.css',
  '/assets/fonts/cert-fonts.css',
  '/assets/css/site-nav.css',
  '/assets/css/page-home.css',
  '/assets/css/page-events.css',
  '/assets/css/page-team.css',
  '/assets/css/page-blogs.css',
  '/assets/css/page-certificates.css',
  '/assets/css/page-join.css',
  '/assets/css/page-members.css',
  '/assets/css/profile.css',
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

  // Network-First for Admin portal & Admin assets
  if (url.pathname.startsWith('/admin') || url.pathname.includes('mission-control') || url.pathname.startsWith('/assets/admin/')) {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(req)) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }))
    );
    return;
  }

  // 1. Network-First for HTML navigations, config files, and JS/CSS assets
  // Guarantees all code deployments and CMS updates appear immediately without requiring hard refresh
  const isNetworkFirst = req.mode === 'navigate' 
    || req.headers.get('accept')?.includes('text/html') 
    || url.pathname.endsWith('/config.js')
    || (url.pathname.startsWith('/assets/js/') && url.pathname.endsWith('.js'))
    || (url.pathname.startsWith('/assets/css/') && url.pathname.endsWith('.css'))
    ;
  if (isNetworkFirst) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Seamless offline fallback when Wi-Fi drops
          const cached = await caches.match(req);
          return cached || (await caches.match('/')) || (await caches.match('/index.html'));
        })
    );
    return;
  }

  // 2. Cache-First for versioned immutable fonts & vendor libraries (avoids multi-MB background refetches)
  const isImmutableAsset = url.pathname.startsWith('/assets/fonts/') || url.pathname.startsWith('/assets/vendor/');

  // 3. Stale-While-Revalidate for static sub-assets (images, media, avatars)
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(req);
      if (isImmutableAsset && cachedResponse) {
        return cachedResponse;
      }

      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(req, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async () => {
          if (req.mode === 'navigate') {
            return (await cache.match('/')) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
          }
          return cachedResponse || new Response('', { status: 408, statusText: 'Offline' });
        });

      return cachedResponse || fetchPromise;
    })
  );
});
