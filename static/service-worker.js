const CACHE_NAME = "colorglass-pwa-v2";
const APP_SHELL = [
  "/app",
  "/app.html",
  "/login.html",
  "/index_loja.html",
  "/aprovacao.html",
  "/portas.html",
  "/controle.html",
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

function getControleChange(url) {
  const match = String(url || "").match(/\/api\/orcamento\/([^/]+)\/(status|valor-pago)(?:\?|$)/);
  if (!match) return null;
  return { uuid: decodeURIComponent(match[1]), action: match[2] };
}

async function sendControleLog(request, change, requestBody, responseBody) {
  try {
    if (!responseBody || responseBody.success === false) return;

    const headers = {};
    const auth = request.headers.get("Authorization");
    if (auth) headers.Authorization = auth;
    headers["Content-Type"] = "application/json";

    const payload = {
      tipo: change.action === "status" ? "status" : "valor_pago",
      uuid: change.uuid,
      status_novo: change.action === "status" ? requestBody.status : undefined,
      valor_novo: change.action === "valor-pago" ? requestBody.valor_pago : undefined,
      origem: "controle.html"
    };

    await fetch("/api/financeiro/controle-log", {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.warn("Falha ao enviar log do controle", error);
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method === "POST") {
    const change = getControleChange(request.url);
    if (change) {
      event.respondWith((async () => {
        const requestClone = request.clone();
        let requestBody = {};
        try { requestBody = await requestClone.json(); } catch (_) { requestBody = {}; }

        const response = await fetch(request);
        const responseClone = response.clone();
        let responseBody = null;
        try { responseBody = await responseClone.json(); } catch (_) { responseBody = null; }

        if (response.ok) {
          event.waitUntil(sendControleLog(request, change, requestBody, responseBody));
        }
        return response;
      })());
      return;
    }
  }

  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
