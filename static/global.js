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

(function loadHomeFixCss() {
  const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const isHome = currentPage === "" || currentPage === "index.html";
  if (!isHome) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "home-fix.css?v=2";
  document.head.appendChild(link);
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
