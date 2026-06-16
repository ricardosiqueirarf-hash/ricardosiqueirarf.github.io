const CACHE_NAME = "colorglass-pwa-v3";
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

function getAuthHeaders(request) {
  const headers = { "Content-Type": "application/json" };
  const auth = request.headers.get("Authorization");
  if (auth) headers.Authorization = auth;
  return headers;
}

async function buscarPedidoControle(request, uuid) {
  try {
    const auth = request.headers.get("Authorization");
    const headers = auth ? { Authorization: auth } : {};
    const res = await fetch("/api/financeiro?status=2,3,4,5&limit=2000", { headers });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) return null;
    return data.find((item) => String(item.id) === String(uuid)) || null;
  } catch (_) {
    return null;
  }
}

async function sendControleLog(request, change, requestBody, responseBody) {
  try {
    if (!responseBody || responseBody.success === false) return;

    const pedido = await buscarPedidoControle(request, change.uuid);
    const orcamento = responseBody.orcamento || pedido || {};

    const payload = {
      tipo: change.action === "status" ? "status" : "valor_pago",
      uuid: change.uuid,
      numero_pedido: orcamento.numero_pedido || pedido?.numero_pedido,
      cliente_nome: orcamento.cliente_nome || pedido?.cliente_nome,
      lojaid: orcamento.lojaid || pedido?.lojaid,
      valor_total: orcamento.valor_total || pedido?.valor_total,
      status_novo: change.action === "status" ? (responseBody.status ?? requestBody.status) : undefined,
      valor_novo: change.action === "valor-pago" ? (responseBody.valor_pago ?? requestBody.valor_pago) : undefined,
      origem: "controle.html"
    };

    await fetch("/api/financeiro/controle-log", {
      method: "POST",
      headers: getAuthHeaders(request),
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
