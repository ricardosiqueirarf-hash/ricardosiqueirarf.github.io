const pages = [
  "login.html",
  "index_loja.html",
  "classes.html",
  "portas.html",
  "cadastro.html"
];

pages.forEach(p => {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = p;
  document.head.appendChild(link);
});

/* =========================================================
   Página inicial: mostrar apenas o nome da marca no header
   ========================================================= */
(function setupHomeBrandNameOnly() {
  const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const isHome = currentPage === "" || currentPage === "index.html";
  if (!isHome) return;

  const style = document.createElement("style");
  style.id = "cgHomeBrandNameOnly";
  style.textContent = `
    body#top header .brand { width:auto; min-height:auto; gap:0; }
    body#top header .logo-symbol { display:none !important; }
    body#top header .logo-wordmark { display:inline-flex; gap:10px; font-size:1.05rem; letter-spacing:.34em; white-space:nowrap; }
  `;
  document.head.appendChild(style);
})();

/* =========================================================
   Index loja: lápis de editar deve abrir a página intermediária
   ========================================================= */
(function setupClassesEntryFromIndexLoja() {
  const currentPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const isIndexLoja = currentPage === "index_loja.html" || window.location.pathname.toLowerCase().includes("index_loja");
  if (!isIndexLoja) return;

  function getUserTokenSafe() {
    try {
      if (typeof getUserToken === "function") return getUserToken();
      return localStorage.getItem("USER_TOKEN");
    } catch (_) {
      return localStorage.getItem("USER_TOKEN");
    }
  }

  function buildUrlClasses(url) {
    try {
      if (typeof buildUrlComToken === "function") return buildUrlComToken(url);
      const token = getUserTokenSafe();
      if (!token) return url;
      const target = new URL(url, window.location.origin);
      if (!target.searchParams.get("token")) target.searchParams.set("token", token);
      return target.toString();
    } catch (_) {
      return url;
    }
  }

  function editarOrcamentoClasses(uuid) {
    const baseUrl = `/classes.html?orcamento_uuid=${encodeURIComponent(uuid)}`;
    window.location.href = buildUrlClasses(baseUrl);
  }

  function aplicarOverride() {
    window.editarOrcamento = editarOrcamentoClasses;
  }

  window.editarOrcamentoClasses = editarOrcamentoClasses;

  aplicarOverride();
  document.addEventListener("DOMContentLoaded", aplicarOverride);
  setTimeout(aplicarOverride, 0);
  setTimeout(aplicarOverride, 300);
  setTimeout(aplicarOverride, 900);
  setTimeout(aplicarOverride, 1800);
})();
