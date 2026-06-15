// =====================
// BACKEND / FETCH
// =====================
function atualizarFerramentaOrcamentoAposCarga() {
    if (typeof renderizarConferenciaCalculoPorta === "function") {
        renderizarConferenciaCalculoPorta();
    }
    if (typeof prepararCardUnificadoOrcamento === "function") {
        prepararCardUnificadoOrcamento();
    }
}

async function carregarPerfis() {
    const res = await fetch(`${API_BASE}/api/perfis`);
    todosPerfis = await res.json();
    atualizarPerfisSelect();
    atualizarFerramentaOrcamentoAposCarga();
}

async function carregarVidros() {
    const res = await fetch(`${API_BASE}/api/vidros`);
    todosVidros = await res.json();
    atualizarVidrosSelect();
    atualizarFerramentaOrcamentoAposCarga();
}

async function carregarInsumos() {
    const res = await fetch(`${API_BASE}/api/materiais`);
    todosInsumos = await res.json();
    atualizarDetalhesCusto();
    atualizarFerramentaOrcamentoAposCarga();
}

async function carregarPuxadores() {
    const res = await fetch(`${API_BASE}/api/puxadores`, { headers: authHeader() });
    todosPuxadores = await res.json();
    atualizarPuxadoresSelect();
    atualizarFerramentaOrcamentoAposCarga();
}

async function carregarTags() {
    const res = await fetch(`${API_BASE}/api/tags`);
    todasTags = await res.json();
    atualizarPrecoPorta();
    atualizarFerramentaOrcamentoAposCarga();
}

function exibirErroPortasSalvas(mensagem) {
    const box = document.getElementById("portasSalvas");
    if (!box) return;
    box.innerHTML = `<div class="portas-empty-state" style="color:#991b1b;border-color:#fecaca;background:#fff5f5;">${mensagem}</div>`;
}

function normalizarPortasResposta(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.portas)) return data.portas;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    return [];
}

async function carregarPortas() {
    try {
        const res = await fetch(`${API_BASE}/api/orcamento/${ORCAMENTO_UUID}/portas`);
        let data = null;
        try {
            data = await res.json();
        } catch (jsonErr) {
            throw new Error("Resposta inválida ao carregar portas.");
        }

        if (!res.ok || data?.success === false) {
            throw new Error(data?.error || `Erro HTTP ${res.status}`);
        }

        const portasRecebidas = normalizarPortasResposta(data);
        portas = portasRecebidas.map((p) => ({ ...p, id: idCounter++ }));

        if (typeof renderPortas === "function") {
            renderPortas();
        }
        atualizarFerramentaOrcamentoAposCarga();
    } catch (err) {
        console.error("Erro ao carregar portas salvas:", err);
        exibirErroPortasSalvas(`Erro ao carregar portas salvas: ${err.message}`);
    }
}

async function carregarOrcamentoInfo() {
    try {
        const res = await fetch(`${API_BASE}/api/orcamentos`);
        const data = await res.json();
        if (data.success && Array.isArray(data.orcamentos)) {
            const encontrado = data.orcamentos.find((orcamento) => orcamento.id == ORCAMENTO_UUID);
            if (encontrado) {
                orcamentoInfo = {
                    cliente_nome: encontrado.cliente_nome || "-",
                    numero_pedido: encontrado.numero_pedido ?? "-",
                    cliente_cidade: encontrado.cliente_cidade || "-"
                };
            }
        }
    } catch (err) {
        console.error("Erro ao carregar informações do orçamento:", err);
    }
}

async function salvarPortasBackend(portasComUUID) {
    const resPortas = await fetch(`${API_BASE}/api/orcamento/${ORCAMENTO_UUID}/portas`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portas: portasComUUID })
    });
    const dataPortas = await resPortas.json();
    if (!dataPortas.success) {
        throw new Error(dataPortas.error || "Erro ao salvar portas");
    }
    return dataPortas;
}

window.carregarPerfis = carregarPerfis;
window.carregarVidros = carregarVidros;
window.carregarInsumos = carregarInsumos;
window.carregarPuxadores = carregarPuxadores;
window.carregarTags = carregarTags;
window.carregarPortas = carregarPortas;
window.carregarOrcamentoInfo = carregarOrcamentoInfo;
window.salvarPortasBackend = salvarPortasBackend;
window.atualizarFerramentaOrcamentoAposCarga = atualizarFerramentaOrcamentoAposCarga;