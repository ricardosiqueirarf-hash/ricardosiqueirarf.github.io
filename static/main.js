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

function authHeader(extraHeaders = {}) {
    const baseHeaders = { ...(extraHeaders || {}) };
    if (window.ColorGlassAuth && typeof window.ColorGlassAuth.authHeaders === "function") {
        return window.ColorGlassAuth.authHeaders(baseHeaders);
    }
    const token = localStorage.getItem("USER_TOKEN") || localStorage.getItem("ADMIN_TOKEN") || "";
    return token ? { ...baseHeaders, "Authorization": "Bearer " + token } : baseHeaders;
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
    window.location.replace("login.html");
    throw new Error("orcamento_uuid ausente");
}

const infoOrcamentoEl = document.getElementById("infoOrcamento");
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
        if (document.querySelector(`script[src="${src}"]`) || document.querySelector(`script[src="/static/${src}"]`)) {
            resolve();
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => {
            if (!src.startsWith("/static/") && !src.startsWith("http")) {
                const fallback = document.createElement("script");
                fallback.src = `/static/${src}`;
                fallback.defer = true;
                fallback.onload = resolve;
                fallback.onerror = () => reject(new Error(`Erro ao carregar script: ${src}`));
                document.head.appendChild(fallback);
                return;
            }
            reject(new Error(`Erro ao carregar script: ${src}`));
        };
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
window.authHeader = authHeader;
window.formatarMoeda = formatarMoeda;
window.initMain = initMain;
