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

  window.salvarLocalEstrutura = function salvarLocalEstrutura() {
    const dados = {
      orcamento_uuid: App3D.ORCAMENTO_UUID,
      history: App3D.state.history.map((h) => ({
        from: { x: h.from.x, y: h.from.y, z: h.from.z },
        to: { x: h.to.x, y: h.to.y, z: h.to.z },
        axis: h.axis
      })),
      totalLength: App3D.state.totalLength,
      fixadores: App3D.dom.fixers.textContent
    };

    // Recupera estruturas existentes ou inicializa array
    const chave = `estruturas_${App3D.ORCAMENTO_UUID}`;
    const existentes = JSON.parse(localStorage.getItem(chave)) || [];
    existentes.push(dados);
    localStorage.setItem(chave, JSON.stringify(existentes));

    alert("Estrutura salva localmente!");
  };
})();
