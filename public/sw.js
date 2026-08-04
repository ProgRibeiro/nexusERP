const VERSION = "nx-erp-shell-v2";
const SAFE_STATIC_FILES = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];
const FIELD_SHELL_ROUTES = ["/execucao"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SAFE_STATIC_FILES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (SAFE_STATIC_FILES.includes(url.pathname) || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        if (response.ok) caches.open(VERSION).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })),
    );
    return;
  }

  if (event.request.mode === "navigate" && FIELD_SHELL_ROUTES.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) caches.open(VERSION).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
