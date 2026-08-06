/*
 * Offline shell.
 *
 * Navigations are network-first: a cache-first HTML document will happily serve
 * a stale build forever, which looks exactly like "my changes aren't showing up".
 * Hashed assets under /assets/ are safe to serve cache-first — their names change
 * whenever their contents do.
 */
const VERSION = "v2";
const SHELL = `hirsel-shell-${VERSION}`;
const ASSETS = `hirsel-assets-${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["./", "./manifest.webmanifest", "./icon.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  // the document: always try the network, fall back to the cached shell offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./").then((hit) => hit ?? caches.match("./index.html"))),
    );
    return;
  }

  // fingerprinted assets: cache-first is safe, the name changes with the content
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(ASSETS).then((c) => c.put(req, copy));
          return res;
        }),
    ),
  );
});
