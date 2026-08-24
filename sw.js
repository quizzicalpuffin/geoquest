/* Quizzical Puffin — offline service worker.
   Serves instantly from the cache, then quietly refreshes it in the background,
   so the quiz works with no signal at all and still picks up new versions. */
const CACHE = "puffin-v67";
const SHELL = ["./", "./index.html", "./med.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => null);
      if (cached) { e.waitUntil(network); return cached; }
      const res = await network;
      if (res) return res;
      /* offline and never cached — fall back to the app itself */
      return (await cache.match("./index.html")) ||
             new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    })
  );
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
