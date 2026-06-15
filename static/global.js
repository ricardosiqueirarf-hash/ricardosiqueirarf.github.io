const pages = [
  "login.html",
  "index_admin.html",
  "index_loja.html",
  "portas.html",
  "cadastro.html",
  "usuarios_admin.html"
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

(function forceBudgetEditToPortasPage() {
  const currentPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const isBudgetList = currentPage === "index_loja.html" || currentPage === "index_admin.html" || window.location.pathname.toLowerCase().includes("index_loja");
  if (!isBudgetList) return;

  function buildPortasUrl(uuid) {
    return `/portas.html?orcamento_uuid=${encodeURIComponent(uuid)}`;
  }

  function irParaPortas(uuid) {
    if (!uuid) return;
    window.location.href = buildPortasUrl(uuid);
  }

  function editarOrcamentoPortas(uuid) {
    irParaPortas(uuid);
  }

  function extrairUuidDoOnclick(valor) {
    const texto = String(valor || "");
    const match = texto.match(/editarOrcamento\(['"]([^'"]+)['"]\)/);
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
    irParaPortas(uuid);
  }, true);

  function aplicarOverride() {
    window.editarOrcamento = editarOrcamentoPortas;
  }

  window.editarOrcamentoPortas = editarOrcamentoPortas;
  aplicarOverride();
  document.addEventListener("DOMContentLoaded", aplicarOverride);
  setTimeout(aplicarOverride, 0);
  setTimeout(aplicarOverride, 300);
  setTimeout(aplicarOverride, 900);
})();

(function enforceThermalLabelSize() {
  function aplicar() {
    if (document.getElementById("thermal-label-size-4x6")) return;
    const style = document.createElement("style");
    style.id = "thermal-label-size-4x6";
    style.textContent = `
      @page etiquetaTermica { size: 4in 6in; margin: 0; }
      .thermal-label {
        page: etiquetaTermica !important;
        width: 4in !important;
        height: 6in !important;
        padding: .24in !important;
        box-sizing: border-box !important;
      }
      @media print {
        .thermal-label {
          page: etiquetaTermica !important;
          width: 4in !important;
          height: 6in !important;
          margin: 0 !important;
          break-after: page;
          page-break-after: always;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", aplicar);
  } else {
    setTimeout(aplicar, 0);
  }
})();
