// sw.js
//
// PWA service worker. Two caching strategies:
//
//  1. App shell (this repo's own files) — precached on install, served
//     cache-first, refreshed in the background. Bump CACHE_VERSION any
//     time you change a precached file's content (same idea as the `?v=`
//     query strings in index.html — a plain redeploy alone won't bust
//     this cache, since the file *names* don't change).
//  2. Everything else same-origin-adjacent (Leaflet from unpkg, Google
//     Fonts, Esri satellite tiles, OpenGolfAPI search) — runtime,
//     stale-while-revalidate. This is what makes "offline map" work in
//     practice: once you've viewed a hole's tiles or searched courses
//     with a signal, they're cached and reusable without one, no
//     separate "download this course" step required.
//
// Registered from js/app.js with scope './' so it works from a GitHub
// Pages subpath (e.g. /golf-scorer/) as well as a custom domain.

const CACHE_VERSION = 'v4';
const SHELL_CACHE = `fairway-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `fairway-runtime-${CACHE_VERSION}`;

// Paths are relative to this file's own location (the site root), so they
// resolve correctly under a GitHub Pages project subpath too.
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css?v=8',
  './js/app.js?v=8',
  './js/router.js',
  './js/header.js',
  './js/theme.js',
  './js/design.js',
  './js/ripple.js',
  './js/stats.js',
  './js/geo.js',
  './js/usStates.js',
  './js/storage.js',
  './js/models.js',
  './js/mapConfig.js',
  './js/courseResolve.js',
  './js/api/opengolfapi.js',
  './js/components/tile.js',
  './js/views/home.js',
  './js/views/courses.js',
  './js/views/newRound.js',
  './js/views/play.js',
  './js/views/summary.js',
  './js/views/stats.js',
  './js/views/settings.js',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        // allSettled, not all — one 404/offline asset shouldn't fail the
        // whole install and leave the app with no offline shell at all.
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never cache writes

  const url = new URL(request.url);

  // Navigations (opening/refreshing the app): network-first so you always
  // get the latest shell when online, falling back to the cached shell
  // when you don't have a connection.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  const isOwnOrigin = url.origin === self.location.origin;
  const isRuntimePartner =
    url.hostname.endsWith('unpkg.com') || // Leaflet
    url.hostname.endsWith('fonts.googleapis.com') ||
    url.hostname.endsWith('fonts.gstatic.com') ||
    url.hostname.includes('arcgisonline.com') || // Esri satellite tiles
    url.hostname.endsWith('opengolfapi.org');

  if (!isOwnOrigin && !isRuntimePartner) return; // let the browser handle it normally

  event.respondWith(staleWhileRevalidate(request, isOwnOrigin ? SHELL_CACHE : RUNTIME_CACHE));
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      // Only cache genuinely good responses — an opaque (cross-origin,
      // no-cors) response has status 0 but is still usable to serve back.
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Serve the cached copy instantly if we have one; otherwise wait on the
  // network. Either way, the fetch above keeps the cache fresh for next time.
  return cached || (await networkFetch) || Response.error();
}
