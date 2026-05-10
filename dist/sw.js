const CACHE = "teamly-v7";
const STATIC = ["/", "/index.html", "/app.js", "/apple-touch-icon.png", "/manifest.json"];
const SKIP_CACHE = ["/rest/v1/", "supabase.co", ".netlify/functions", "nominatim.openstreetmap", "anthropic"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

const safePut = (cache, req, res) => {
  if (res && res.ok && res.type !== "opaque") {
    cache.put(req, res).catch(()=>{});
  }
};

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = e.request.url;

  // Browser extensions (chrome-extension://, moz-extension://, etc.) issue
  // requests we can't cache — bail before the cache.put would reject.
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;

  // Never cache API / Supabase / AI calls
  if (SKIP_CACHE.some(s => url.includes(s))) return;

  // Static assets: network-first so deploys are picked up immediately
  if (STATIC.some(s => url.endsWith(s))) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE).then(c => safePut(c, e.request, clone));
          return r;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match("/index.html")))
    );
    return;
  }

  // Everything else: network-first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => safePut(c, e.request, clone));
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("/index.html")))
  );
});
