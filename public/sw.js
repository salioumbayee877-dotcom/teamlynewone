const CACHE = "teamly-v10";
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

// ── Web Push: notification shade on Android + iOS (PWA installed) ──────────
self.addEventListener("push", e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch(_) {
    try { data = { title: "Teamly", body: e.data ? e.data.text() : "" }; } catch(__) {}
  }
  const title = data.title || "Teamly";
  const options = {
    body: data.body || "",
    icon: data.icon || "/apple-touch-icon.png",
    badge: data.badge || "/apple-touch-icon.png",
    tag: data.tag || "teamly",
    data: { url: data.url || "/", ...(data.data || {}) },
    renotify: true,
    requireInteraction: false,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ("focus" in client) {
          client.postMessage({ type: "push-click", url: target });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
