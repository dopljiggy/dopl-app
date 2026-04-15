/* dopl service worker — cache-first for static assets, network-first for everything else. */
const CACHE_NAME = "dopl-shell-v18";
const SHELL = [
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
    (async () => {
      // Nuke every old cache.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
      // Ask every open tab to reload so they pick up the new build.
      const clientsList = await self.clients.matchAll({ type: "window" });
      for (const client of clientsList) {
        try {
          client.postMessage({ type: "dopl-sw-updated" });
        } catch {}
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Never cache Supabase / Stripe / SnapTrade traffic.
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

  // Never cache authenticated dashboard or feed HTML — always go to network.
  if (
    req.mode === "navigate" &&
    sameOrigin &&
    (url.pathname.startsWith("/dashboard") ||
      url.pathname.startsWith("/feed") ||
      url.pathname.startsWith("/welcome") ||
      url.pathname.startsWith("/settings") ||
      url.pathname.startsWith("/notifications"))
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // Other navigation requests: network-first, offline fallback to "/".
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/").then((r) => r || Response.error())
      )
    );
    return;
  }

  // Static assets: cache-first, refresh in background.
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
