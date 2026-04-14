/* dopl service worker — cache-first for static assets, network-first for everything else. */
const CACHE_NAME = "dopl-shell-v1";
const SHELL = [
  "/",
  "/manifest.json",
  "/dopl-logo.svg",
  "/apple-touch-icon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache Supabase realtime / API / Stripe / SnapTrade / our own /api.
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase") ||
    url.hostname.includes("stripe.com") ||
    url.hostname.includes("snaptrade") ||
    url.hostname.includes("vercel.com")
  ) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Navigation requests: network-first, fall back to cached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/").then((r) => r || Response.error()))
    );
    return;
  }

  // Static: cache-first, refresh in background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === "basic") {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

async function networkFirst(req) {
  try {
    return await fetch(req);
  } catch (e) {
    const cached = await caches.match(req);
    if (cached) return cached;
    throw e;
  }
}
