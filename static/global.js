const pages = [
  "login.html",
  "index_loja.html",
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
    body#top header .brand {
      width: auto;
      min-height: auto;
      gap: 0;
    }

    body#top header .logo-symbol {
      display: none !important;
    }

    body#top header .logo-wordmark {
      display: inline-flex;
      gap: 10px;
      font-size: 1.05rem;
      letter-spacing: 0.34em;
      white-space: nowrap;
    }
  `;

  document.head.appendChild(style);
})();

/* =========================================================
   Filtros avançados para index_loja.html
   - Só roda na tela index_loja
   - Não mexe na lógica original da tabela
   - Filtra por status, pagamento e período
   ========================================================= */
(function setupIndexLojaFilters() {
  const currentPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const isIndexLoja =
    currentPage === "index_loja.html" ||
    window.location.pathname.toLowerCase().includes("index_loja");

  if (!isIndexLoja) return;

  const normalize = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const parseMoney = (value) => {
    if (value === null || value === undefined) return null;

    const raw = String(value)
      .replace(/R\$/gi, "")
      .replace(/[^0-9,.-]/g, "")
      .trim();

    if (!raw) return null;

    let normalized = raw;

    if (raw.includes(",") && raw.includes(".")) {
      normalized = raw.replace(/\./g, "").replace(",", ".");
    } else if (raw.includes(",")) {
      normalized = raw.replace(",", ".");
    }

    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  };

  const parseDate = (value) => {
    const text = String(value || "").trim();
    if (!text) return null;

    let match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    }

    match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, yyyy, mm, dd] = match;
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    }

    return null;
  };

  const sameDay = (a, b) => {
    return (
      a &&
      b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  };

  const monthKey = (date) => {
    if (!date) return "";
    return `${date.getFullYear()}-${date.getMonth()}`;
  };

  const getTable = () => {
    return document.querySelector("#orcamentosExistentes table") || document.querySelector("table");
  };

  const getHeaderMap = (table) => {
    const headers = Array.from(table?.querySelectorAll("thead th, tr:first-child th") || [])
      .map(th => normalize(th.textContent));

    const find = (...terms) => {
      return headers.findIndex(header => terms.some(term => header.includes(term)));
    };

    return {
      status: find("status", "situacao", "situação"),
      data: find("data", "criacao", "criação"),
      total: find("total", "valor"),
      pago: find("pago", "pagamento", "recebido")
    };
  };

  const getCellText = (row, index) => {
    if (index < 0) return "";
    const cells = row.querySelectorAll("td");
    return cells[index]?.textContent || "";
  };

  const getRows = (table) => {
    return Array.from(table.querySelectorAll("tbody tr, tr"))
      .filter(row => row.querySelector("td"));
  };

  const inferStatus = (row, map) => {
    const statusSelect = Array.from(row.querySelectorAll("select"))
      .find(select => !select.classList.contains("loja-select"));

    const candidates = [
      getCellText(row, map.status),
      statusSelect?.value,
      statusSelect?.selectedOptions?.[0]?.textContent,
      row.dataset.status,
      row.textContent
    ]
      .map(normalize)
      .filter(Boolean);

    for (const value of candidates) {
      if (value === "1" || value.includes("orcamento")) return "1";
      if (value === "2" || value.includes("aprovado")) return "2";
      if (value === "3" || value.includes("producao") || value.includes("em producao")) return "3";
      if (value === "4" || value.includes("produzido")) return "4";
      if (value === "5" || value.includes("entregue")) return "5";
    }

    return "";
  };

  const inferPagamento = (row, map) => {
    const total = parseMoney(getCellText(row, map.total));
    const pago = parseMoney(getCellText(row, map.pago));

    if (pago === null && total === null) return "desconhecido";
    if (!pago || pago <= 0) return "sem_pagamento";
    if (total !== null && pago >= total) return "pago";

    return "parcial";
  };

  const inferData = (row, map) => {
    const mappedDate = parseDate(getCellText(row, map.data));
    if (mappedDate) return mappedDate;

    const cells = Array.from(row.querySelectorAll("td"));

    for (const cell of cells) {
      const date = parseDate(cell.textContent);
      if (date) return date;
    }

    return null;
  };

  const matchesPeriod = (date, period) => {
    if (!period) return true;
    if (!date) return false;

    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const last7 = new Date(startToday);
    last7.setDate(startToday.getDate() - 6);

    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    if (period === "hoje") {
      return sameDay(date, today);
    }

    if (period === "ultimos_7") {
      return date >= last7 && date <= today;
    }

    if (period === "mes_atual") {
      return monthKey(date) === monthKey(today);
    }

    if (period === "mes_passado") {
      return monthKey(date) === monthKey(lastMonthDate);
    }

    return true;
  };

  const addStyles = () => {
    if (document.getElementById("cgFiltroLojaStyle")) return;

    const style = document.createElement("style");
    style.id = "cgFiltroLojaStyle";

    style.textContent = `
      .cg-filtros-loja {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        margin: 10px 0 14px;
        padding: 12px;
        border: 1px solid rgba(16,121,186,0.12);
        border-radius: 16px;
        background: rgba(255,255,255,0.72);
        box-shadow: 0 10px 22px rgba(15,44,62,0.08);
      }

      .cg-filtros-loja select,
      .cg-filtros-loja button {
        min-height: 40px;
        border-radius: 12px;
        border: 1px solid rgba(16,121,186,0.20);
        background: #fff;
        color: #0d5d8c;
        font-weight: 700;
        padding: 0 12px;
        cursor: pointer;
      }

      .cg-filtros-loja button {
        background: linear-gradient(135deg, #1079ba, #0d5d8c);
        color: #fff;
        border: none;
        box-shadow: 0 8px 16px rgba(16,121,186,0.18);
      }

      .cg-filtros-resumo {
        margin-left: auto;
        font-size: 0.9rem;
        color: #6b7280;
        background: rgba(231,243,251,0.75);
        border: 1px solid rgba(16,121,186,0.14);
        padding: 8px 10px;
        border-radius: 999px;
        white-space: nowrap;
      }

      tr.cg-filter-hidden {
        display: none !important;
      }

      @media (max-width: 900px), (orientation: portrait) {
        .cg-filtros-loja {
          align-items: stretch;
        }

        .cg-filtros-loja select,
        .cg-filtros-loja button,
        .cg-filtros-resumo {
          width: 100%;
          margin-left: 0;
        }
      }
    `;

    document.head.appendChild(style);
  };

  const buildFilters = () => {
    if (document.getElementById("cgFiltrosLoja")) return;

    addStyles();

    const box = document.createElement("div");
    box.id = "cgFiltrosLoja";
    box.className = "cg-filtros-loja";

    box.innerHTML = `
      <select id="cgFiltroStatus" title="Filtrar por status">
        <option value="">Todos os status</option>
        <option value="1">Orçamento</option>
        <option value="2">Aprovado</option>
        <option value="3">Em produção</option>
        <option value="4">Produzido</option>
        <option value="5">Entregue</option>
      </select>

      <select id="cgFiltroPagamento" title="Filtrar por pagamento">
        <option value="">Todos os pagamentos</option>
        <option value="sem_pagamento">Sem pagamento</option>
        <option value="parcial">Parcial</option>
        <option value="pago">Pago</option>
      </select>

      <select id="cgFiltroPeriodo" title="Filtrar por período">
        <option value="">Todos os períodos</option>
        <option value="hoje">Hoje</option>
        <option value="ultimos_7">Últimos 7 dias</option>
        <option value="mes_atual">Este mês</option>
        <option value="mes_passado">Mês passado</option>
      </select>

      <button type="button" id="cgLimparFiltros">
        Limpar filtros
      </button>

      <span class="cg-filtros-resumo" id="cgFiltroResumo">
        Mostrando todos
      </span>
    `;

    const toolbar = document.querySelector(".orcamentos-toolbar");
    const tableBox = document.querySelector("#orcamentosExistentes");
    const title = Array.from(document.querySelectorAll("h1,h2,h3"))
      .find(el => normalize(el.textContent).includes("orcamento"));

    if (toolbar) {
      toolbar.insertAdjacentElement("afterend", box);
    } else if (tableBox) {
      tableBox.insertAdjacentElement("beforebegin", box);
    } else if (title) {
      title.insertAdjacentElement("afterend", box);
    } else {
      document.body.appendChild(box);
    }

    ["cgFiltroStatus", "cgFiltroPagamento", "cgFiltroPeriodo"].forEach(id => {
      document.getElementById(id)?.addEventListener("change", applyFilters);
    });

    document.getElementById("cgLimparFiltros")?.addEventListener("click", () => {
      ["cgFiltroStatus", "cgFiltroPagamento", "cgFiltroPeriodo"].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = "";
      });

      applyFilters();
    });
  };

  function applyFilters() {
    const table = getTable();
    if (!table) return;

    const map = getHeaderMap(table);

    const selectedStatus = document.getElementById("cgFiltroStatus")?.value || "";
    const selectedPagamento = document.getElementById("cgFiltroPagamento")?.value || "";
    const selectedPeriodo = document.getElementById("cgFiltroPeriodo")?.value || "";

    const rows = getRows(table);
    let shown = 0;

    rows.forEach(row => {
      const rowStatus = inferStatus(row, map);
      const rowPagamento = inferPagamento(row, map);
      const rowDate = inferData(row, map);

      const okStatus = !selectedStatus || rowStatus === selectedStatus;
      const okPagamento = !selectedPagamento || rowPagamento === selectedPagamento;
      const okPeriodo = matchesPeriod(rowDate, selectedPeriodo);

      const visible = okStatus && okPagamento && okPeriodo;

      row.classList.toggle("cg-filter-hidden", !visible);

      if (visible) shown += 1;
    });

    const resumo = document.getElementById("cgFiltroResumo");
    if (resumo) {
      resumo.textContent = `Mostrando ${shown} de ${rows.length}`;
    }
  }

  const boot = () => {
    buildFilters();
    applyFilters();

    const tableBox = document.querySelector("#orcamentosExistentes");

    if (tableBox) {
      const observer = new MutationObserver(() => {
        clearTimeout(window.__cgFiltroLojaTimer);
        window.__cgFiltroLojaTimer = setTimeout(applyFilters, 120);
      });

      observer.observe(tableBox, {
        childList: true,
        subtree: true
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
