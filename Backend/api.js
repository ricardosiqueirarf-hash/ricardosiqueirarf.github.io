// =====================
// BACKEND / FETCH
// =====================
async function carregarPerfis() {
    const res = await fetch(`${API_BASE}/api/perfis`);
    todosPerfis = await res.json();
    atualizarPerfisSelect();
}

async function carregarVidros() {
    const res = await fetch(`${API_BASE}/api/vidros`);
    todosVidros = await res.json();
    atualizarVidrosSelect();
}

async function carregarInsumos() {
    const res = await fetch(`${API_BASE}/api/materiais`);
    todosInsumos = await res.json();
    atualizarDetalhesCusto();
}

async function carregarPuxadores() {
    const res = await fetch(`${API_BASE}/api/puxadores`, { headers: authHeader() });
    todosPuxadores = await res.json();
    atualizarPuxadoresSelect();
}

async function carregarTags() {
    const res = await fetch(`${API_BASE}/api/tags`);
    todasTags = await res.json();
    atualizarPrecoPorta();
}

async function carregarPortas() {
    try {
        const res = await fetch(`${API_BASE}/api/orcamento/${ORCAMENTO_UUID}/portas`);
        const data = await res.json();
        if (data.success && data.portas) {
            portas = data.portas.map((p) => ({ ...p, id: idCounter++ }));
            renderPortas();
        }
    } catch (err) {
        console.error(err);
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
