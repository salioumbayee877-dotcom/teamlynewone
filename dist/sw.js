const CACHE = "teamly-v5";
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

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = e.request.url;

  // Never cache API / Supabase / AI calls
  if (SKIP_CACHE.some(s => url.includes(s))) return;

  // Static assets: cache-first (fast load)
  if (STATIC.some(s => url.endsWith(s))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(r => {
          caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          return r;
        });
        return cached || fresh;
      })
    );
    return;
  }

  // Everything else: network-first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("/index.html")))
  );
});
