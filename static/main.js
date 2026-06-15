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
// FUNÇÕES OPERACIONAIS NATIVAS DA TELA DE PORTAS
// Mantidas aqui para não depender de portas-crud-restorer.js
// =====================
function removerOpcaoPivotanteDaTela() {
    const select = document.getElementById("tipologia");
    if (!select) return;
    Array.from(select.options).forEach((option) => {
        if (option.value === "pivotante") option.remove();
    });
}

function atualizarCamposObrigatorios() {
    const camposObrigatorios = document.querySelectorAll("[data-required='true']");
    camposObrigatorios.forEach((campo) => {
        campo.style.border = campo.value ? "" : "1px solid red";
    });
}

function normalizarAlturasDobradicas(valor) {
    if (Array.isArray(valor)) {
        return valor.map((item) => String(item)).filter((item) => item !== "");
    }
    if (typeof valor === "string") {
        const texto = valor.trim();
        if (!texto) return [];
        try {
            const parsed = JSON.parse(texto);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item)).filter((item) => item !== "");
            }
        } catch (_) {}
        return texto.split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
}

function preencherAlturasDobradicas(dadosPorta) {
    const alturas = normalizarAlturasDobradicas(dadosPorta?.dobradicas_alturas);
    const inputQtd = document.getElementById("dobradicas");
    if (!inputQtd || alturas.length === 0) return;

    inputQtd.value = String(alturas.length);
    if (typeof atualizarDobradicasInputs === "function") atualizarDobradicasInputs();

    const inputs = document.querySelectorAll(".dobradica-altura");
    alturas.forEach((altura, index) => {
        if (inputs[index]) inputs[index].value = altura;
    });
}

async function salvarPorta() {
    const tipo = document.getElementById("tipologia")?.value;
    if (!tipo) return alert("Selecione a tipologia");
    if (tipo === "pivotante") return alert("Porta pivotante foi removida desta tela.");

    const medidas = typeof calcularMedidasPorta === "function"
        ? calcularMedidasPorta()
        : { larguraMm: 0, alturaMm: 0, area: 0, perimetro: 0 };

    const largura = medidas.larguraMm;
    const altura = medidas.alturaMm;
    const quantidade = +document.getElementById("quantidade")?.value || 0;
    const perfilSelecionado = document.getElementById("perfil")?.value;
    const vidroSelecionado = document.getElementById("vidro")?.value;
    const puxadorSelecionado = document.getElementById("puxador")?.value;
    const dobradicasQtd = parseInt(document.getElementById("dobradicas")?.value || "0", 10) || 0;
    const alturasDobradicas = typeof obterAlturasDobradicas === "function" ? obterAlturasDobradicas() : [];
    const pendencias = [];

    if (!largura) pendencias.push("Largura");
    if (!altura) pendencias.push("Altura");
    if (!quantidade) pendencias.push("Quantidade");
    if (!perfilSelecionado) pendencias.push("Perfil");
    if (!vidroSelecionado) pendencias.push("Vidro");
    if (document.getElementById("puxador") && tipo !== "correr" && !puxadorSelecionado) pendencias.push("Puxador");
    if (tipo === "giro" && dobradicasQtd < 2) pendencias.push("Dobradiças (mínimo 2)");
    if (dobradicasQtd > 0 && alturasDobradicas.length !== dobradicasQtd) pendencias.push("Alturas das dobradiças");
    if (tipo === "giro" && !document.getElementById("dobradicas_posicao")?.value) pendencias.push("Lado das dobradiças");
    if (document.getElementById("puxador_posicao") && tipo !== "correr" && !document.getElementById("puxador_posicao")?.value) pendencias.push("Lado do puxador");
    if ((tipo === "deslizante" || tipo === "correr") && !document.getElementById("sistemas")?.value) pendencias.push("Sistema");
    if ((tipo === "deslizante" || tipo === "correr") && !document.getElementById("trilhos_superior")?.value) pendencias.push("Trilho superior");
    if ((tipo === "deslizante" || tipo === "correr") && !document.getElementById("trilhos_inferior")?.value) pendencias.push("Trilho inferior");

    if (pendencias.length > 0) {
        alert(`Preencha os campos obrigatórios: ${pendencias.join(", ")}`);
        return;
    }

    const portaExistente = editando !== null ? portas.find((p) => p.id === editando) : null;
    const dados = portaExistente?.dados ? { ...portaExistente.dados } : {};
    if (typeof TIPOLOGIAS !== "undefined" && TIPOLOGIAS[tipo]) {
        TIPOLOGIAS[tipo].forEach((campo) => {
            const el = document.getElementById(campo);
            if (el) dados[campo] = el.value;
        });
    }
    dados.dobradicas_alturas = alturasDobradicas;

    const portaSVGEl = document.getElementById("portaSVG");
    const porta = {
        id: editando ?? idCounter++,
        tipo,
        dados,
        quantidade,
        m2: Number((medidas.area || 0).toFixed(4)),
        metro_linear: Number((medidas.perimetro || 0).toFixed(4)),
        tag_aplicada: typeof calcularTagAplicada === "function" && typeof obterTagCorrespondente === "function"
            ? calcularTagAplicada(obterTagCorrespondente(), medidas)
            : null,
        preco: typeof calcularPrecoPorta === "function" ? calcularPrecoPorta() : 0,
        svg: portaSVGEl ? portaSVGEl.outerHTML : ""
    };

    const nextPortas = editando === null ? [...portas, porta] : portas.map((p) => (p.id === editando ? porta : p));
    const portasComUUID = nextPortas.map((p) => ({ ...p, orcamento_uuid: ORCAMENTO_UUID }));

    try {
        await salvarPortasBackend(portasComUUID);
        alert("Porta salva com sucesso!");
        portas = nextPortas;
        editando = null;
        renderPortas();
        if (typeof verificarFerramentaOrcamentoAtual === "function") verificarFerramentaOrcamentoAtual();
    } catch (err) {
        console.error("Erro ao salvar porta:", err);
        alert("Erro ao salvar porta: " + (err?.message || err));
    }
}

function renderPortas() {
    const c = document.getElementById("portasSalvas");
    if (!c) return;
    c.innerHTML = "";

    if (!Array.isArray(portas) || portas.length === 0) {
        c.innerHTML = "<div class='portas-empty-state'>Nenhuma porta salva neste orçamento.</div>";
        if (typeof atualizarResumoImpressao === "function") atualizarResumoImpressao();
        if (typeof atualizarResumoOrdem === "function") atualizarResumoOrdem();
        if (typeof atualizarResumoEtiqueta === "function") atualizarResumoEtiqueta();
        return;
    }

    portas.forEach((p, idx) => {
        const dados = p.dados || {};
        const perfilNome = todosPerfis.find((perfil) => perfil.id == dados.perfil)?.nome || "Perfil não definido";
        const vidroNome = todosVidros.find((vidro) => vidro.id == dados.vidro)?.tipo || "Vidro não definido";
        const sistemaNome = (typeof sistemasLista !== "undefined" && Array.isArray(sistemasLista))
            ? sistemasLista.find((sistema) => String(sistema.id) === String(dados.sistemas))?.nome
            : "";
        const valorAdicional = Number(dados.valor_adicional || 0);

        c.innerHTML += `
            <div>
                <strong>${idx + 1}. ${p.tipo}</strong><br>
                Quantidade: ${p.quantidade}<br>
                Perfil: ${perfilNome}<br>
                Vidro: ${vidroNome}<br>
                ${sistemaNome ? `Sistema: ${sistemaNome}<br>` : ""}
                Valor adicional: ${valorAdicional ? formatarMoeda(valorAdicional) : "-"}<br>
                Preço: R$ ${Number(p.preco || 0).toFixed(2)}<br>
                ${p.svg || ""}<br>
                <button class="btn" onclick="copiarPorta(${p.id})">Copiar</button>
                <button class="btn" onclick="editarPorta(${p.id})">Editar</button>
                <button class="btn btn-danger" onclick="apagarPorta(${p.id})">Apagar</button>
            </div>
        `;
    });

    if (typeof atualizarResumoImpressao === "function") atualizarResumoImpressao();
    if (typeof atualizarResumoOrdem === "function") atualizarResumoOrdem();
    if (typeof atualizarResumoEtiqueta === "function") atualizarResumoEtiqueta();
}

function preencherCamposPorta(porta) {
    if (!porta) return;
    const tipologia = document.getElementById("tipologia");
    const quantidade = document.getElementById("quantidade");
    if (tipologia) tipologia.value = porta.tipo;
    if (quantidade) quantidade.value = porta.quantidade;

    if (typeof renderCampos === "function") renderCampos();

    const dados = porta.dados || {};
    Object.keys(dados).forEach((key) => {
        const el = document.getElementById(key);
        if (el && !Array.isArray(dados[key])) el.value = dados[key];
    });

    preencherAlturasDobradicas(dados);

    if (typeof atualizarPrecoPorta === "function") atualizarPrecoPorta();
    if (typeof desenharPorta === "function") desenharPorta();

    if (porta.tipo === "deslizante" || porta.tipo === "correr") {
        const finalizar = () => {
            const sistemasSelect = document.getElementById("sistemas");
            if (sistemasSelect) sistemasSelect.value = dados.sistemas || "";
            if (typeof atualizarTrilhosDoSistema === "function") atualizarTrilhosDoSistema();
            const trilhosSuperiorSelect = document.getElementById("trilhos_superior");
            const trilhosInferiorSelect = document.getElementById("trilhos_inferior");
            if (trilhosSuperiorSelect) trilhosSuperiorSelect.value = dados.trilhos_superior || "";
            if (trilhosInferiorSelect) trilhosInferiorSelect.value = dados.trilhos_inferior || "";
            if (typeof atualizarResumoTrilhos === "function") atualizarResumoTrilhos();
            if (typeof atualizarPrecoPorta === "function") atualizarPrecoPorta();
        };

        if (typeof carregarSistemas === "function") {
            Promise.resolve(carregarSistemas()).then(finalizar).catch(finalizar);
        } else {
            finalizar();
        }
    }
}

function editarPorta(id) {
    const porta = portas.find((p) => p.id === id);
    if (!porta) return;
    editando = id;
    preencherCamposPorta(porta);
}

function copiarPorta(id) {
    const porta = portas.find((p) => p.id === id);
    if (!porta) return;
    editando = null;
    preencherCamposPorta(porta);
}

function apagarPorta(id) {
    if (!confirm("Tem certeza que deseja apagar esta porta?")) return;
    portas = portas.filter((p) => p.id !== id);
    renderPortas();
}

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
    removerOpcaoPivotanteDaTela();
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
window.removerOpcaoPivotanteDaTela = removerOpcaoPivotanteDaTela;
window.atualizarCamposObrigatorios = atualizarCamposObrigatorios;
window.normalizarAlturasDobradicas = normalizarAlturasDobradicas;
window.preencherAlturasDobradicas = preencherAlturasDobradicas;
window.salvarPorta = salvarPorta;
window.renderPortas = renderPortas;
window.preencherCamposPorta = preencherCamposPorta;
window.editarPorta = editarPorta;
window.copiarPorta = copiarPorta;
window.apagarPorta = apagarPorta;
