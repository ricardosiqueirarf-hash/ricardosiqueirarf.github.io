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

const infoOrcamentoEl = document.getElementById("infoOrcamento");
if (!ORCAMENTO_UUID) {
    if (infoOrcamentoEl) {
        infoOrcamentoEl.innerHTML = "<strong style='color:red'>UUID do orçamento não encontrado</strong>";
    }
    throw new Error("orcamento_uuid ausente");
}

if (infoOrcamentoEl) {
    infoOrcamentoEl.textContent = "";
}

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

// =====================
// SCRIPTS COMPLEMENTARES
// =====================
function carregarScriptPortas(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Erro ao carregar script: ${src}`));
        document.head.appendChild(script);
    });
}

async function carregarPreview3DPortas() {
    try {
        await carregarScriptPortas("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js");
        await carregarScriptPortas("door3d.js");
        await carregarScriptPortas("door3d-deslizante-fix.js");
        if (typeof renderizarPorta3D === "function") {
            renderizarPorta3D();
        }
    } catch (err) {
        console.error("Erro ao inicializar preview 3D:", err);
    }
}

async function carregarAcoesPortas() {
    try {
        await carregarScriptPortas("portas-crud-restorer.js");
        await carregarScriptPortas("pricing-deslizante-rail-fix.js");
        await carregarScriptPortas("puxador-perfil-fix.js");
        await carregarScriptPortas("puxador-perfil-ui-fix.js");
        await carregarScriptPortas("required-fields-panel.js");
        await carregarScriptPortas("side-conflict-fix.js");
        await carregarScriptPortas("portas-layout-cleanup.js");
        await carregarScriptPortas("portas-field-groups.js");
        await carregarScriptPortas("portas-saved-table.js");
        await carregarScriptPortas("portas-verification-collapse.js");
        await carregarScriptPortas("approval-navigation-fix.js");
        await carregarScriptPortas("orcamento-info-button.js");
        await carregarScriptPortas("deslizante-edit-fix.js");
        await carregarScriptPortas("edit-mode-visual-fix.js");
        await carregarScriptPortas("portas-actions.js");
        await carregarScriptPortas("dobradicas-auto-fix.js");
        await carregarScriptPortas("dobradicas-fields-final-fix.js");
        await carregarScriptPortas("editing-state-fix.js");
        await carregarScriptPortas("tipologia-divisao-ambiente-fix.js?v=1");
        await carregarScriptPortas("portas-nan-svg-fix.js?v=2");
        await carregarScriptPortas("portas-divisao-ambiente-display-fix.js?v=1");
    } catch (err) {
        console.error("Erro ao carregar ações seguras de portas:", err);
    }
}

async function carregarConferenciaCalculoPortas() {
    try {
        await carregarScriptPortas("calculation-check.js");
        await carregarScriptPortas("calculation-component-bridge.js");
        await carregarScriptPortas("calculation-data-normalizer.js");
        if (typeof inicializarConferenciaCalculoPorta === "function") {
            inicializarConferenciaCalculoPorta();
        }
        if (typeof instalarNormalizadorInsumosCalculo === "function") {
            instalarNormalizadorInsumosCalculo();
        }
        if (typeof renderizarConferenciaCalculoPorta === "function") {
            renderizarConferenciaCalculoPorta();
        }
    } catch (err) {
        console.error("Erro ao carregar conferência do cálculo:", err);
    }
}

async function initMain() {
    await carregarAcoesPortas();
    carregarPreview3DPortas();
    carregarConferenciaCalculoPortas();
    carregarPerfis();
    carregarVidros();
    carregarInsumos();
    carregarPuxadores();
    carregarTags();
    carregarPortas();
}

document.addEventListener("DOMContentLoaded", initMain);

window.API_BASE = API_BASE;
window.ORCAMENTO_UUID = ORCAMENTO_UUID;
window.go = go;
window.getAuthToken = getAuthToken;
window.authHeader = authHeader;
window.formatarMoeda = formatarMoeda;
window.initMain = initMain;
