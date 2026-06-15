if (localStorage.getItem("darkmode") === "true") {
    const temaCss = document.getElementById("tema-css");
    if (temaCss) temaCss.href = "/static/css/indexdark.css";
}

function go(p) {
    window.location.href = p;
}

// =====================
// BACKEND / AUTH
// =====================
const API_BASE = "https://colorglass.onrender.com";

function getAuthToken() {
    const params = new URLSearchParams(window.location.search);
    const tokenUrl = params.get("token");

    if (tokenUrl) {
        localStorage.setItem("USER_TOKEN", tokenUrl);
        localStorage.setItem("ADMIN_TOKEN", tokenUrl);
        params.delete("token");
        const clean = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
        window.history.replaceState({}, document.title, clean);
        return tokenUrl;
    }

    if (window.ColorGlassAuth && typeof window.ColorGlassAuth.getToken === "function") {
        return window.ColorGlassAuth.getToken();
    }

    return localStorage.getItem("USER_TOKEN") || localStorage.getItem("ADMIN_TOKEN") || "";
}

function authHeader(extraHeaders = {}) {
    if (window.ColorGlassAuth && typeof window.ColorGlassAuth.authHeaders === "function") {
        return window.ColorGlassAuth.authHeaders(extraHeaders);
    }

    const token = getAuthToken();
    return token
        ? { ...(extraHeaders || {}), "Authorization": "Bearer " + token }
        : { ...(extraHeaders || {}) };
}

function formatarMoeda(valor) {
    return `R$ ${Number(valor).toFixed(2)}`;
}

// =====================
// UUID DO ORÇAMENTO
// =====================
const params = new URLSearchParams(window.location.search);
const ORCAMENTO_UUID = params.get("orcamento_uuid");
var orcamentoInfo = { cliente_nome: null, numero_pedido: null, cliente_cidade: null };

if (!ORCAMENTO_UUID) {
    document.getElementById("infoOrcamento").innerHTML =
        "<strong style='color:red'>UUID do orçamento não encontrado</strong>";
    throw new Error("orcamento_uuid ausente");
}

document.getElementById("infoOrcamento").innerHTML =
    `Editando orçamento: <strong>${ORCAMENTO_UUID}</strong>`;

// =====================
// ESTADO GLOBAL
// =====================
var portas = [];
var editando = null;
var idCounter = 0;

var todosPerfis = [];
var todosVidros = [];
var todosInsumos = [];
var todosPuxadores = [];
var todasTags = [];

var estruturas3D = [];

function initMain() {
    carregarPerfis();
    carregarVidros();
    carregarInsumos();
    carregarPuxadores();
    carregarTags();
    carregarPortas();
    carregarEstruturas3D();
    carregarOrcamentoInfo();
}

document.addEventListener("DOMContentLoaded", initMain);

window.API_BASE = API_BASE;
window.ORCAMENTO_UUID = ORCAMENTO_UUID;
window.go = go;
window.getAuthToken = getAuthToken;
window.authHeader = authHeader;
window.formatarMoeda = formatarMoeda;
window.initMain = initMain;
