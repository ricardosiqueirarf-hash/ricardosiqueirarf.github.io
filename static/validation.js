// =====================
// VERIFICAÇÃO DO ORÇAMENTO
// Etapa 2: painel e checklist inicial
// =====================

function adicionarEstilosVerificacaoOrcamento() {
    if (document.getElementById("orcamentoValidationStyles")) return;

    const style = document.createElement("style");
    style.id = "orcamentoValidationStyles";
    style.textContent = `
        .orcamento-health {
            padding: 10px 12px;
            border-radius: 12px;
            font-weight: 800;
            margin-bottom: 10px;
            border: 1px solid rgba(16,121,186,0.14);
        }

        .orcamento-health-info {
            background: rgba(231,243,251,0.75);
            color: #0d5d8c;
        }

        .orcamento-health-ok {
            background: rgba(233,248,238,0.95);
            color: #166534;
            border-color: rgba(34,197,94,0.25);
        }

        .orcamento-health-aviso {
            background: rgba(255,247,237,0.95);
            color: #9a3412;
            border-color: rgba(249,115,22,0.25);
        }

        .orcamento-health-erro {
            background: rgba(254,242,242,0.95);
            color: #991b1b;
            border-color: rgba(239,68,68,0.25);
        }

        #orcamentoChecklist {
            display: flex;
            flex-direction: column;
            gap: 7px;
            margin: 10px 0 12px;
        }

        .orcamento-checkitem {
            padding: 8px 10px;
            border-radius: 10px;
            background: rgba(247,249,252,0.95);
            border: 1px solid rgba(16,121,186,0.10);
            font-size: 0.92rem;
            line-height: 1.35;
        }

        .orcamento-checkitem-erro {
            border-color: rgba(239,68,68,0.25);
            background: rgba(254,242,242,0.8);
        }

        .orcamento-checkitem-aviso {
            border-color: rgba(249,115,22,0.25);
            background: rgba(255,247,237,0.85);
        }

        .orcamento-checkitem-ok {
            border-color: rgba(34,197,94,0.22);
            background: rgba(240,253,244,0.85);
        }
    `;

    document.head.appendChild(style);
}

function criarLinhaChecklist(tipo, texto) {
    const simbolos = {
        ok: "✅",
        aviso: "⚠️",
        erro: "❌",
        info: "ℹ️"
    };

    return `<div class="orcamento-checkitem orcamento-checkitem-${tipo}">${simbolos[tipo] || "•"} ${texto}</div>`;
}

function numeroValido(valor) {
    const numero = Number(String(valor ?? "").replace(",", "."));
    return Number.isFinite(numero) ? numero : 0;
}

function normalizarAlturasDobradicasValidacao(valor) {
    if (Array.isArray(valor)) {
        return valor.filter((item) => String(item ?? "").trim() !== "");
    }

    if (typeof valor === "string") {
        const texto = valor.trim();
        if (!texto) return [];

        try {
            const parsed = JSON.parse(texto);
            if (Array.isArray(parsed)) {
                return parsed.filter((item) => String(item ?? "").trim() !== "");
            }
        } catch (_) {
            // segue com separadores simples
        }

        return texto
            .split(/[;,|]/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return [];
}

function verificarPortaIndividual(porta, index, resultado) {
    const numeroPorta = index + 1;
    const prefixo = `Porta ${numeroPorta}`;
    const dados = porta?.dados || {};

    const tipo = porta?.tipo || dados.tipo || "";
    const largura = numeroValido(dados.largura);
    const altura = numeroValido(dados.altura);
    const quantidade = numeroValido(porta?.quantidade);
    const preco = numeroValido(porta?.preco);

    if (!tipo) resultado.erros.push(`${prefixo}: tipologia ausente.`);
    if (!largura) resultado.erros.push(`${prefixo}: largura ausente.`);
    if (!altura) resultado.erros.push(`${prefixo}: altura ausente.`);
    if (!quantidade) resultado.erros.push(`${prefixo}: quantidade ausente.`);
    if (!dados.perfil) resultado.erros.push(`${prefixo}: perfil ausente.`);
    if (!dados.vidro) resultado.erros.push(`${prefixo}: vidro ausente.`);
    if (preco <= 0) resultado.erros.push(`${prefixo}: preço zerado ou inválido.`);

    if (largura > 0 && altura > 0) {
        const areaCalculada = (largura / 1000) * (altura / 1000);
        const perimetroCalculado = 2 * ((largura / 1000) + (altura / 1000));
        const areaSalva = numeroValido(porta?.m2);
        const perimetroSalvo = numeroValido(porta?.metro_linear);

        if (areaSalva > 0 && Math.abs(areaSalva - areaCalculada) > 0.01) {
            resultado.avisos.push(`${prefixo}: m² salvo não bate com largura x altura.`);
        }

        if (perimetroSalvo > 0 && Math.abs(perimetroSalvo - perimetroCalculado) > 0.01) {
            resultado.avisos.push(`${prefixo}: metro linear salvo não bate com o perímetro.`);
        }
    }

    if (tipo === "giro") {
        const qtdDobradicas = parseInt(dados.dobradicas || "0", 10) || 0;
        const alturas = normalizarAlturasDobradicasValidacao(dados.dobradicas_alturas);

        if (qtdDobradicas < 2) {
            resultado.erros.push(`${prefixo}: porta de giro precisa de no mínimo 2 dobradiças.`);
        }

        if (!dados.dobradicas_posicao) {
            resultado.erros.push(`${prefixo}: lado das dobradiças não definido.`);
        }

        if (qtdDobradicas > 0 && alturas.length !== qtdDobradicas) {
            resultado.erros.push(`${prefixo}: quantidade de alturas das dobradiças não bate com a quantidade informada.`);
        }
    }

    if ((tipo === "deslizante" || tipo === "correr") && !dados.sistemas) {
        resultado.avisos.push(`${prefixo}: sistema não definido para porta ${tipo}.`);
    }
}

function obterStatusVerificacaoBase() {
    const resultado = {
        erros: [],
        avisos: [],
        oks: []
    };

    if (typeof ORCAMENTO_UUID === "undefined" || !ORCAMENTO_UUID) {
        resultado.erros.push("UUID do orçamento não encontrado.");
    } else {
        resultado.oks.push("UUID do orçamento encontrado.");
    }

    if (!Array.isArray(portas) || portas.length === 0) {
        resultado.avisos.push("Nenhuma porta carregada neste orçamento.");
    } else {
        resultado.oks.push(`${portas.length} porta(s) carregada(s).`);
        portas.forEach((porta, index) => verificarPortaIndividual(porta, index, resultado));
    }

    if (Array.isArray(todosPerfis) && todosPerfis.length > 0) {
        resultado.oks.push("Perfis carregados.");
    } else {
        resultado.avisos.push("Perfis ainda não carregados.");
    }

    if (Array.isArray(todosVidros) && todosVidros.length > 0) {
        resultado.oks.push("Vidros carregados.");
    } else {
        resultado.avisos.push("Vidros ainda não carregados.");
    }

    if (Array.isArray(todosPuxadores) && todosPuxadores.length > 0) {
        resultado.oks.push("Puxadores carregados.");
    } else {
        resultado.avisos.push("Puxadores ainda não carregados.");
    }

    return resultado;
}

function renderResultadoVerificacao(resultado) {
    adicionarEstilosVerificacaoOrcamento();

    const statusEl = document.getElementById("orcamentoHealthStatus");
    const checklistEl = document.getElementById("orcamentoChecklist");

    if (!statusEl || !checklistEl) return;

    const temErro = resultado.erros.length > 0;
    const temAviso = resultado.avisos.length > 0;

    if (temErro) {
        statusEl.className = "orcamento-health orcamento-health-erro";
        statusEl.textContent = "Status: erro crítico encontrado";
    } else if (temAviso) {
        statusEl.className = "orcamento-health orcamento-health-aviso";
        statusEl.textContent = "Status: atenção necessária";
    } else {
        statusEl.className = "orcamento-health orcamento-health-ok";
        statusEl.textContent = "Status: verificação inicial OK";
    }

    const linhas = [
        ...resultado.erros.map((texto) => criarLinhaChecklist("erro", texto)),
        ...resultado.avisos.map((texto) => criarLinhaChecklist("aviso", texto)),
        ...resultado.oks.map((texto) => criarLinhaChecklist("ok", texto))
    ];

    checklistEl.innerHTML = linhas.join("");
}

function verificarOrcamentoAtual() {
    const resultado = obterStatusVerificacaoBase();
    renderResultadoVerificacao(resultado);
    return resultado;
}

function inicializarPainelVerificacao() {
    adicionarEstilosVerificacaoOrcamento();

    const statusEl = document.getElementById("orcamentoHealthStatus");
    const checklistEl = document.getElementById("orcamentoChecklist");

    if (!statusEl || !checklistEl) return;

    statusEl.className = "orcamento-health orcamento-health-info";
    statusEl.textContent = "Status: aguardando verificação";
    checklistEl.innerHTML = criarLinhaChecklist("info", "Clique em Verificar orçamento para rodar o checklist inicial.");
}

window.verificarOrcamentoAtual = verificarOrcamentoAtual;
window.inicializarPainelVerificacao = inicializarPainelVerificacao;

document.addEventListener("DOMContentLoaded", inicializarPainelVerificacao);
