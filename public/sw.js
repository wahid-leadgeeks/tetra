/**
 * TETRA Service Worker
 * Provides offline shell fallback, asset caching, and web notification handling.
 */

const CACHE_NAME = "tetra-pwa-v1";

const PRECACHE_ASSETS = [
  "/offline.html",
  "/favicon.ico",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

// Install: Cache offline shell and core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[SW] Precache failed during install:", err);
      }),
  );
});

// Activate: Clean up old caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: Network-first for pages and APIs, stale-while-revalidate for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Bypass API and Auth routes — always network-only
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation requests: Network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        const offline = await cache.match("/offline.html");
        return offline || new Response("Offline", { status: 503, statusText: "Offline" });
      }),
    );
    return;
  }

  // Next.js static bundles and public assets: Stale-While-Revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        }),
      ),
    );
  }
});

// Message listener: Client commands (e.g. SHOW_NOTIFICATION, SKIP_WAITING)
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    if (self.registration && typeof self.registration.showNotification === "function") {
      self.registration.showNotification(title || "TETRA", {
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        ...options,
      });
    }
  }
});

// Notification click: Focus existing client or open new window
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and optionally navigate
      for (const client of clientList) {
        if ("focus" in client && client.url.startsWith(self.location.origin)) {
          if (targetUrl && client.url !== targetUrl && "navigate" in client) {
            return client.navigate(targetUrl).then((navigatedClient) => navigatedClient?.focus());
          }
          return client.focus();
        }
      }
      // If no window is open, open a new window to the target URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

// Push notification: Display incoming web push events
self.addEventListener("push", (event) => {
  let payload = { title: "TETRA Notification", body: "" };
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch {
    payload = {
      title: "TETRA Notification",
      body: event.data ? event.data.text() : "",
    };
  }

  const title = payload.title || "TETRA";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    data: payload.data || { url: payload.url || "/" },
    tag: payload.tag || `tetra-push-${Date.now()}`,
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
