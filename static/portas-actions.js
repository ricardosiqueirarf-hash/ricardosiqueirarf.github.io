// =====================
// AÇÕES SEGURAS DA TELA DE PORTAS
// =====================

async function apagarPortaPersistindo(id) {
    const porta = Array.isArray(portas) ? portas.find((p) => p.id === id) : null;
    if (!porta) {
        alert("Porta não encontrada.");
        return;
    }

    const confirmar = confirm("Tem certeza que deseja apagar esta porta? A exclusão será salva no orçamento.");
    if (!confirmar) return;

    const portasAntes = [...portas];
    const editandoAntes = editando;
    const portasDepois = portas.filter((p) => p.id !== id);
    const portasComUUID = portasDepois.map((p) => ({
        ...p,
        orcamento_uuid: ORCAMENTO_UUID
    }));

    try {
        await salvarPortasBackend(portasComUUID);
        portas = portasDepois;
        if (editando === id) {
            editando = null;
        }
        renderPortas();
        if (typeof verificarOrcamentoAtual === "function") {
            verificarOrcamentoAtual();
        }
        alert("Porta apagada e orçamento atualizado com sucesso.");
    } catch (err) {
        console.error("Erro ao apagar porta:", err);
        portas = portasAntes;
        editando = editandoAntes;
        renderPortas();
        alert("Erro ao apagar porta: " + (err?.message || err));
    }
}

window.apagarPorta = apagarPortaPersistindo;
