/*
 * vflics Studio service worker — minimal offline app-shell cache.
 *
 * Scope is /studio only (registered from the Studio client). It caches the
 * shell so the installed PWA opens offline; it deliberately does NOT cache
 * Supabase API/Storage requests or the publish endpoint (always network).
 */

const CACHE = 'vflics-studio-shell-v1';
const SHELL = ['/studio', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept cross-origin (Supabase, R2, etc.) or API calls.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // App-shell navigations: network-first, fall back to the cached shell.
  if (request.mode === 'navigate' && url.pathname.startsWith('/studio')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/studio', copy));
          return res;
        })
        .catch(() => caches.match('/studio'))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
