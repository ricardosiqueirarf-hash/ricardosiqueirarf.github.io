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

(function installLoginAuditLog() {
  if (window.__COLORGLASS_LOGIN_AUDIT_INSTALLED__) return;
  window.__COLORGLASS_LOGIN_AUDIT_INSTALLED__ = true;

  const originalFetch = window.fetch;
  if (typeof originalFetch !== "function") return;

  function isLoginRequest(input, init) {
    try {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      return method === "POST" && url.includes("/api/usuarios/login");
    } catch (_) {
      return false;
    }
  }

  function dataHoraFortaleza() {
    const agora = new Date();
    return {
      data_acesso: agora.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" }),
      hora_acesso: agora.toLocaleTimeString("pt-BR", { timeZone: "America/Fortaleza" })
    };
  }

  async function enviarLogLogin(data) {
    try {
      if (!data || !data.success || !data.token) return;
      const dh = dataHoraFortaleza();
      await originalFetch("https://colorglass.onrender.com/api/financeiro/controle-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${data.token}`
        },
        body: JSON.stringify({
          tipo: "login",
          level: data.level,
          data_acesso: dh.data_acesso,
          hora_acesso: dh.hora_acesso,
          ip: "browser"
        })
      });
    } catch (err) {
      console.warn("Falha ao enviar log de login.", err);
    }
  }

  window.fetch = async function colorGlassFetch(input, init) {
    const response = await originalFetch.apply(this, arguments);
    if (isLoginRequest(input, init)) {
      try {
        const clone = response.clone();
        clone.json().then(enviarLogLogin).catch(() => {});
      } catch (_) {}
    }
    return response;
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