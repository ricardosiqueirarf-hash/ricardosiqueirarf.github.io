window.App3D = window.App3D || {};

(() => {
  const App3D = window.App3D;

  const params = new URLSearchParams(window.location.search);
  const orcamentoUuid = params.get("orcamento_uuid");
  if (!orcamentoUuid) {
    alert("UUID do orçamento não encontrado");
    throw new Error("orcamento_uuid ausente");
  }
  App3D.ORCAMENTO_UUID = orcamentoUuid;

  App3D.animate();
  App3D.carregarPerfisEstruturais();

  window.salvarEstruturaSupabase = async function salvarEstruturaSupabase() {
    const perfisSelect = App3D.dom.perfisSelect;
    const selectedOption = perfisSelect?.options?.[perfisSelect.selectedIndex];
    const material = selectedOption?.textContent?.trim() || null;

    const imagem = {
      history: App3D.state.history.map((h) => ({
        from: { x: h.from.x, y: h.from.y, z: h.from.z },
        to: { x: h.to.x, y: h.to.y, z: h.to.z },
        axis: h.axis
      }))
    };

    const payload = {
      orcamento_uuid: App3D.ORCAMENTO_UUID,
      material,
      imagem,
      custototal: null,
      precototal: null,
      comprimentotot: App3D.state.totalLength,
      fixadores: Number(App3D.dom.fixers.textContent || 0)
    };

    try {
      const res = await fetch(`${App3D.API_BASE}/api/estruturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Erro ao salvar estrutura 3D");
      }
      alert("Estrutura 3D salva no Supabase!");
    } catch (error) {
      console.error("Erro ao salvar estrutura 3D:", error);
      alert("Erro ao salvar estrutura 3D.");
    }
  };
})();


