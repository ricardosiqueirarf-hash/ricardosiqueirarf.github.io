const CACHE_NAME = "colorglass-pwa-v1";
const APP_SHELL = [
  "/app",
  "/app.html",
  "/login.html",
  "/index_loja.html",
  "/aprovacao.html",
  "/portas.html",
  "/controle_loja.html",
  "/static/manifest.json",
  "/static/icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
