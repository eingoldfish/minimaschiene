/**
 * Service worker: makes Minimaschine Web work offline (e.g. in a classroom
 * without WLAN). It runs in the background of the browser and answers the
 * page's requests from a local cache.
 *
 * Strategy:
 * - The page itself (index.html): network first, so updates arrive; cache if offline.
 * - All other files (scripts, styles, icons): cache first. Vite gives them
 *   names with a content hash, so a cached file never becomes outdated.
 *
 * The page sends the list of files it actually loaded (message "cache"),
 * so the first visit already makes the app available offline.
 */
const CACHE = 'minimaschine-v4';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'cache' || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((url) => typeof url === 'string' && new URL(url).origin === self.location.origin);
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(urls.map((url) => cache.add(url).catch(() => undefined)));
      // Remove files of older versions (hashed names under /assets/ that are no longer used).
      const wanted = new Set(urls.map((url) => new URL(url).href));
      for (const request of await cache.keys()) {
        if (request.url.includes('/assets/') && !wanted.has(request.url)) await cache.delete(request);
      }
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html', { ignoreVary: true }).then((cached) => cached ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    // ignoreVary: the script is requested with "crossorigin" (Origin header) and the server
    // may answer with "Vary: Origin" – the cached copy must still count as a match.
    caches.match(request, { ignoreVary: true }).then((cached) =>
      cached ?? fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }),
    ),
  );
});
