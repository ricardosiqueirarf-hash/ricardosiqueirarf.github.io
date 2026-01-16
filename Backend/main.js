if (localStorage.getItem("darkmode") === "true") {
    document.getElementById("tema-css").href = "/static/css/indexdark.css";
}

function go(p) {
    window.location.href = p;
}

// =====================
// BACKEND
// =====================
const API_BASE = "https://colorglass.onrender.com";

function authHeader() {
    const token = localStorage.getItem("ADMIN_TOKEN");
    return token ? { "Authorization": "Bearer " + token } : {};
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
window.authHeader = authHeader;
window.formatarMoeda = formatarMoeda;
window.initMain = initMain;
