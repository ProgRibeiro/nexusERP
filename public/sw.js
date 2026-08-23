const VERSION = "nx-erp-shell-v6";
const SAFE_STATIC_FILES = [
  "/manifest.webmanifest",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SAFE_STATIC_FILES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Remove também versões que tenham armazenado chunks do Next. Chunks
      // são versionados pelo próprio framework e jamais devem sobreviver a
      // uma publicação ou recompilação do Turbopack.
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("nx-erp-") && key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // O Next/Turbopack gerencia seus próprios chunks. Interceptá-los causa
  // mistura entre factories de módulos de builds diferentes.
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) return;

  if (SAFE_STATIC_FILES.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        if (response.ok) caches.open(VERSION).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })),
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        // Páginas autenticadas nunca são persistidas em cache. Isso evita que
        // dados de um usuário anterior apareçam após logout ou troca de perfil.
        .catch(() => caches.match("/offline.html")),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
