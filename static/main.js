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
    } catch (erro) {
        console.warn("Preview 3D indisponível:", erro);
    }
}

async function carregarComplementosPortas() {
    const scripts = [
        "portas-crud-restorer.js",
        "pricing-deslizante-rail-fix.js",
        "puxador-perfil-fix.js",
        "puxador-perfil-ui-fix.js",
        "required-fields-panel.js",
        "side-conflict-fix.js",
        "portas-layout-cleanup.js",
        "portas-field-groups.js",
        "portas-saved-table.js",
        "portas-verification-collapse.js",
        "approval-navigation-fix.js",
        "orcamento-info-button.js",
        "deslizante-edit-fix.js",
        "edit-mode-visual-fix.js",
        "portas-actions.js",
        "dobradicas-auto-fix.js",
        "dobradicas-fields-final-fix.js",
        "editing-state-fix.js"
    ];

    for (const src of scripts) {
        await carregarScriptPortas(src);
    }
}

// =====================
// INICIALIZAÇÃO
// =====================
window.addEventListener("DOMContentLoaded", async () => {
    try {
        if (typeof carregarOrcamentoInfo === "function") await carregarOrcamentoInfo();
        await Promise.all([
            typeof carregarPerfis === "function" ? carregarPerfis() : Promise.resolve(),
            typeof carregarVidros === "function" ? carregarVidros() : Promise.resolve(),
            typeof carregarInsumos === "function" ? carregarInsumos() : Promise.resolve(),
            typeof carregarPuxadores === "function" ? carregarPuxadores() : Promise.resolve(),
            typeof carregarTags === "function" ? carregarTags() : Promise.resolve()
        ]);
        await carregarComplementosPortas();
        if (typeof carregarPortas === "function") await carregarPortas();
        if (typeof renderCampos === "function") renderCampos();
        await carregarPreview3DPortas();
    } catch (erro) {
        console.error("Erro ao inicializar portas:", erro);
    }
});
