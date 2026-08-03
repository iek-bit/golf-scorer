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

const CACHE_VERSION = 'v6';
const SHELL_CACHE = `fairway-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `fairway-runtime-${CACHE_VERSION}`;

// Paths are relative to this file's own location (the site root), so they
// resolve correctly under a GitHub Pages project subpath too.
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css?v=10',
  './js/app.js?v=10',
  './js/router.js',
  './js/header.js',
  './js/theme.js',
  './js/design.js',
  './js/ripple.js',
  './js/installPrompt.js',
  './js/segmentedThumb.js',
  './js/export.js',
  './js/stats.js',
  './js/geo.js',
  './js/usStates.js',
  './js/storage.js',
  './js/models.js',
  './js/mapConfig.js',
  './js/courseResolve.js',
  './js/api/opengolfapi.js',
  './js/api/weather.js',
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
  const isOwnOrigin = url.origin === self.location.origin;

  // Navigations and same-origin app code (JS/CSS/manifest/icons) are
  // network-first: while online, always run whatever was actually just
  // deployed. This app has no per-file cache-busting — only app.js and
  // styles.css get a `?v=` query string — so every other module
  // (home.js, opengolfapi.js, storage.js, ...) lives at a bare,
  // unversioned URL. Serving those stale-first (the previous strategy)
  // meant a deploy that changed one module's shape could silently run
  // that old module alongside a freshly-fetched app.js — a real cause of
  // a blank/broken app that a hard refresh wouldn't even fix, since the
  // service worker — not the browser's HTTP cache — was the one serving
  // the mismatch. The cache here exists purely as an *offline* fallback,
  // never preferred over a live network response.
  if (request.mode === 'navigate' || isOwnOrigin) {
    event.respondWith(networkFirst(request, SHELL_CACHE, request.mode === 'navigate' ? './index.html' : null));
    return;
  }

  // Cross-origin partners (fonts, Leaflet, map tiles, OpenGolfAPI) are
  // different: their content doesn't change shape between one of *our*
  // deploys, so serving a recent cached copy instantly (and refreshing
  // it in the background) is a safe, worthwhile speed/offline win rather
  // than a correctness risk.
  const isRuntimePartner =
    url.hostname.endsWith('unpkg.com') || // Leaflet
    url.hostname.endsWith('fonts.googleapis.com') ||
    url.hostname.endsWith('fonts.gstatic.com') ||
    url.hostname.includes('arcgisonline.com') || // Esri satellite tiles
    url.hostname.endsWith('opengolfapi.org');

  if (!isRuntimePartner) return; // let the browser handle it normally

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

async function networkFirst(request, cacheName, navigateFallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // Offline (or the request itself failed) — fall back to whatever we
    // have cached for this exact URL, and for a navigation specifically,
    // fall further back to the cached app shell itself so the app still
    // opens at all with no signal.
    return (await cache.match(request)) || (navigateFallbackUrl && (await cache.match(navigateFallbackUrl))) || Response.error();
  }
}

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
