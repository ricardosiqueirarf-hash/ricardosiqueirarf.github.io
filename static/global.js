(function setupColorGlassAuth() {
  function getUrlToken() {
    try {
      return new URLSearchParams(window.location.search).get("token") || "";
    } catch (_) {
      return "";
    }
  }

  function getToken() {
    return getUrlToken() || localStorage.getItem("USER_TOKEN") || localStorage.getItem("ADMIN_TOKEN") || "";
  }

  function syncLegacyTokens() {
    const urlToken = getUrlToken();
    if (urlToken) {
      localStorage.setItem("USER_TOKEN", urlToken);
      localStorage.setItem("ADMIN_TOKEN", urlToken);
      return;
    }

    const userToken = localStorage.getItem("USER_TOKEN");
    const adminToken = localStorage.getItem("ADMIN_TOKEN");

    if (userToken && !adminToken) {
      localStorage.setItem("ADMIN_TOKEN", userToken);
    }

    if (adminToken && !userToken) {
      localStorage.setItem("USER_TOKEN", adminToken);
    }
  }

  function authHeaders(extraHeaders) {
    const token = getToken();
    return token
      ? { ...(extraHeaders || {}), "Authorization": `Bearer ${token}` }
      : { ...(extraHeaders || {}) };
  }

  function logout(destino) {
    localStorage.removeItem("USER_TOKEN");
    localStorage.removeItem("ADMIN_TOKEN");
    localStorage.removeItem("USER_LEVEL");
    localStorage.removeItem("USER_STOREID");
    window.location.href = destino || "login.html";
  }

  syncLegacyTokens();

  window.ColorGlassAuth = {
    getToken,
    authHeaders,
    syncLegacyTokens,
    logout
  };
})();

const pages = [
  "login.html",
  "index_loja.html",
  "portas.html",
  "classes.html",
  "cadastro.html"
];

pages.forEach(p => {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = p;
  document.head.appendChild(link);
});

(function installIndexLojaAuthFix() {
  const pagina = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const isIndexLoja = pagina === "index_loja.html" || window.location.pathname.endsWith("/loja");
  if (!isIndexLoja) return;

  function normalizarTexto(valor) {
    return String(valor || "").trim();
  }

  function storeIdFrom(loja) {
    if (typeof loja === "string") return normalizarTexto(loja);
    return normalizarTexto(
      loja && (loja.storeID || loja.storeid || loja.lojaID || loja.lojaid || loja.storeId)
    );
  }

  function nomeFrom(loja) {
    if (typeof loja === "string") return normalizarTexto(loja);
    return normalizarTexto(
      loja && (loja.nome || loja.name || loja.user || loja.usuario || loja.storeName)
    ) || storeIdFrom(loja);
  }

  function mapaDeLojas(lista) {
    const mapa = new Map();
    (Array.isArray(lista) ? lista : []).forEach((loja) => {
      const storeID = storeIdFrom(loja);
      const nome = nomeFrom(loja);
      if (storeID && nome && !mapa.has(storeID)) {
        mapa.set(storeID, nome);
      }
    });
    return mapa;
  }

  async function buscarStores(token) {
    const res = await fetch("https://colorglass.onrender.com/api/clientes/storeids", {
      headers: token ? { "Authorization": `Bearer ${token}` } : {}
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.stores) && data.stores.length
      ? data.stores
      : (Array.isArray(data.storeIds) ? data.storeIds : []);
  }

  function aplicarPatch() {
    const token = window.ColorGlassAuth?.getToken?.() || localStorage.getItem("USER_TOKEN") || localStorage.getItem("ADMIN_TOKEN") || "";
    let aplicou = false;

    if (typeof window.carregarMapaLojas === "function") {
      window.carregarMapaLojas = async function carregarMapaLojasSeguro() {
        try {
          const lojas = await buscarStores(token);
          return mapaDeLojas(lojas);
        } catch (err) {
          console.warn("Mapa de lojas indisponível; carregando orçamentos sem nomes de loja.", err);
          return new Map();
        }
      };
      aplicou = true;
    }

    if (typeof window.buscarLojasPorUsuarios === "function") {
      window.buscarLojasPorUsuarios = async function buscarLojasPorUsuariosSeguro() {
        try {
          return await buscarStores(token);
        } catch (err) {
          console.warn("Fallback de lojas por usuários bloqueado por segurança.", err);
          return [];
        }
      };
      aplicou = true;
    }

    return aplicou;
  }

  let tentativas = 0;
  const timer = setInterval(() => {
    tentativas += 1;
    const ok = aplicarPatch();
    if (ok || tentativas >= 40) {
      clearInterval(timer);
    }
  }, 25);
})();

(function loadHomeFixCss() {
  const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const isHome = currentPage === "" || currentPage === "index.html";
  if (!isHome) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "home-fix.css?v=2";
  document.head.appendChild(link);
})();