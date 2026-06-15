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

(function loadHomeFixCss() {
  const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const isHome = currentPage === "" || currentPage === "index.html";
  if (!isHome) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "home-fix.css?v=2";
  document.head.appendChild(link);
})();

(function forceBudgetEditToClassesPage() {
  const currentPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const isIndexLoja = currentPage === "index_loja.html" || window.location.pathname.toLowerCase().includes("index_loja");
  if (!isIndexLoja) return;

  function getToken() {
    try {
      if (typeof window.getUserToken === "function") return window.getUserToken();
      return localStorage.getItem("USER_TOKEN") || "";
    } catch (_) {
      return localStorage.getItem("USER_TOKEN") || "";
    }
  }

  function buildClassesUrl(uuid) {
    let url = `/classes.html?orcamento_uuid=${encodeURIComponent(uuid)}`;
    const token = getToken();
    if (token) url += `&token=${encodeURIComponent(token)}`;
    return url;
  }

  function irParaClasses(uuid) {
    if (!uuid) return;
    window.location.href = buildClassesUrl(uuid);
  }

  function editarOrcamentoClasses(uuid) {
    irParaClasses(uuid);
  }

  function extrairUuidDoOnclick(valor) {
    const texto = String(valor || "");
    const match = texto.match(/editarOrcamento\(['\"]([^'\"]+)['\"]\)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  document.addEventListener("click", function interceptarCliqueEditarOrcamento(event) {
    const botao = event.target?.closest?.("button[onclick*='editarOrcamento']");
    if (!botao) return;

    const uuid = extrairUuidDoOnclick(botao.getAttribute("onclick"));
    if (!uuid) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    irParaClasses(uuid);
  }, true);

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
  setTimeout(aplicarOverride, 3500);
})();
