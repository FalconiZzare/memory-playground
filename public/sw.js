/*
 * MemPlayground service worker.
 *
 * Caching strategy, chosen so updates land immediately on mobile
 * (iOS Safari in particular) while offline still works:
 *
 *  - Navigations (the HTML): NETWORK-FIRST. Online users always get the
 *    freshest page, so a deploy is picked up on the next plain load with
 *    no reload dance and no dependence on service worker update timing.
 *    The cached copy is only served when the network is unreachable.
 *  - /_next/static/ assets: CACHE-FIRST. File names are content-hashed,
 *    so a cached copy can never be stale.
 *  - Everything else same-origin (icons, manifest): STALE-WHILE-REVALIDATE.
 */

// "__BUILD_ID__" is replaced with a unique id by scripts/stamp-sw.mjs on
// every `npm run build`, so each deploy invalidates the previous cache.
const CACHE = "memplayground-__BUILD_ID__";
const PRECACHE = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function cachePut(request, response) {
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // HTML: network-first, cache is the offline fallback only.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) cachePut(request, response);
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/")),
        ),
    );
    return;
  }

  // Content-hashed build assets: immutable, cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) cachePut(request, response);
          return response;
        });
      }),
    );
    return;
  }

  // Icons, manifest, misc: serve cached instantly, refresh in background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cachePut(request, response);
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
