// =====================
// IMPRESSÃO
// =====================
function obterRecuosPuxador(alturaPorta, alturaPuxador, tamanhoPuxador) {
    if (!alturaPorta || !alturaPuxador || !tamanhoPuxador) return { recuoTopo: null, recuoBase: null };
    const inicio = alturaPuxador - tamanhoPuxador / 2;
    const fim = alturaPuxador + tamanhoPuxador / 2;
    return {
        recuoBase: Math.max(0, inicio),
        recuoTopo: Math.max(0, alturaPorta - fim)
    };
}

function obterIdentificacaoOrcamento() {
    const nome = orcamentoInfo?.cliente_nome || "-";
    const numero = orcamentoInfo?.numero_pedido ?? "-";
    return `Cliente: ${nome} | Pedido: ${numero}`;
}

function obterCidadeCliente() {
    return orcamentoInfo?.cliente_cidade || "-";
}

function obterDataHoje() {
    return new Date().toLocaleDateString("pt-BR");
}

function atualizarResumoImpressao() {
    const resumo = document.getElementById("printResumo");
    if (!resumo) return;
    if (portas.length === 0) {
        resumo.innerHTML = "";
        return;
    }

    let totalGeral = 0;
    const itens = portas.map((p, index) => {
        const largura = p.dados.largura || "-";
        const altura = p.dados.altura || "-";
        const puxador = p.dados.puxador === "sem_puxador"
            ? null
            : todosPuxadores.find(pux => pux.id == p.dados.puxador);
        const puxadorNome = puxador ? puxador.nome : "Sem puxador";
        const precoTotal = p.preco || 0;
        totalGeral += precoTotal;

        return `
            <div class="print-item">
                Quantidade: ${p.quantidade}<br>
                Altura: ${altura} mm<br>
                Largura: ${largura} mm<br>
                Puxador: ${puxadorNome}<br>
                Valor do item: ${formatarMoeda(precoTotal)}
            </div>
        `;
    }).join("");

    resumo.innerHTML = `
        <h2>Resumo do Orçamento</h2>
        <p>${obterIdentificacaoOrcamento()}</p>
        ${itens}
        <h3>Total geral: ${formatarMoeda(totalGeral)}</h3>
    `;
}

function gerarSvgOrdemProducao(porta) {
    const largura = parseFloat(porta.dados.largura || 0);
    const altura = parseFloat(porta.dados.altura || 0);
    if (!largura || !altura) return "";

    const w = 400;
    const h = 600;
    const scale = Math.min(w / largura, h / altura);

    const doorWidth = largura * scale;
    const doorHeight = altura * scale;
    const offsetX = 90;
    const offsetY = 30;

    const puxadorId = porta.dados.puxador;
    const deveDesenharPuxador = puxadorId && puxadorId !== "sem_puxador";
    const handleLength = deveDesenharPuxador ? parseFloat(porta.dados.medida_puxador || 0) : 0;
    const handlePos = deveDesenharPuxador ? parseFloat(porta.dados.altura_puxador || 0) : 0;
    const recuos = obterRecuosPuxador(altura, handlePos, handleLength);

    const handleScaled = handleLength > 0 ? handleLength * scale : doorHeight * 0.4;
    const handleCenter = offsetY + doorHeight - (handlePos * scale);
    const handleY = handleCenter - handleScaled / 2;
    const handleX = offsetX + doorWidth - 12;
    const quantidadeTexto = `${porta.quantidade || 1}x`;
    const alturasDobradicas = Array.isArray(porta.dados.dobradicas_alturas)
        ? porta.dados.dobradicas_alturas
        : [];
    const dobradicasSvg = alturasDobradicas.map((posicaoMm) => {
        const posicao = parseFloat(posicaoMm || 0);
        if (!posicao) return "";
        const y = offsetY + doorHeight - (posicao * scale);
        const x = offsetX + 6;
        return `
          <line x1="${x}" y1="${y}" x2="${x + 20}" y2="${y}" stroke="#000" stroke-width="3"/>
          <circle cx="${x}" cy="${y}" r="4" fill="#000"/>
        `;
    }).join("");

    return `
    <svg class="op-svg" width="520" height="720" viewBox="0 0 520 720" xmlns="http://www.w3.org/2000/svg">
      <rect x="${offsetX}" y="${offsetY}" width="${doorWidth}" height="${doorHeight}" fill="#f4f8ff" stroke="#1079ba" stroke-width="3"/>
      ${dobradicasSvg}
      ${deveDesenharPuxador ? `<rect x="${handleX}" y="${handleY}" width="8" height="${handleScaled}" fill="#d48400"/>` : ""}
      <text x="${offsetX + doorWidth / 2}" y="${offsetY + doorHeight / 2}" text-anchor="middle" dominant-baseline="middle" class="op-quantity">${quantidadeTexto}</text>

      <line x1="${offsetX - 20}" y1="${offsetY}" x2="${offsetX - 20}" y2="${offsetY + doorHeight}" stroke="#333"/>
      <line x1="${offsetX - 24}" y1="${offsetY}" x2="${offsetX}" y2="${offsetY}" stroke="#333"/>
      <line x1="${offsetX - 24}" y1="${offsetX + doorHeight}" x2="${offsetX}" y2="${offsetX + doorHeight}" stroke="#333"/>
      <text x="${offsetX - 50}" y="${offsetY + doorHeight / 2}" class="op-measure" transform="rotate(-90 ${offsetX - 50} ${offsetX - 50} ${offsetY + doorHeight / 2})">${altura} mm</text>

      <line x1="${offsetX}" y1="${offsetY + doorHeight + 20}" x2="${offsetX + doorWidth}" y2="${offsetY + doorHeight + 20}" stroke="#333"/>
      <line x1="${offsetX}" y1="${offsetX + doorHeight + 16}" x2="${offsetX}" y2="${offsetX + doorHeight + 24}" stroke="#333"/>
      <line x1="${offsetX + doorWidth}" y1="${offsetX + doorHeight + 16}" x2="${offsetX + doorWidth}" y2="${offsetX + doorHeight + 24}" stroke="#333"/>
      <text x="${offsetX + doorWidth / 2}" y="${offsetX + doorHeight + 48}" class="op-measure" text-anchor="middle">${largura} mm</text>
    </svg>
    `;
}

function atualizarResumoOrdem() {
    const container = document.getElementById("printOrdem");
    if (!container) return;
    if (portas.length === 0) {
        container.innerHTML = "";
        return;
    }

    const itens = portas.map((p, index) => {
        const perfilNome = todosPerfis.find(perfil => perfil.id == p.dados.perfil)?.nome || "-";
        const vidroNome = todosVidros.find(vidro => vidro.id == p.dados.vidro)?.tipo || "-";
        const puxadorNome = p.dados.puxador === "sem_puxador"
            ? "Sem puxador"
            : (todosPuxadores.find(puxador => puxador.id == p.dados.puxador)?.nome || "-");
        const valorAdicional = Number(p.dados.valor_adicional || 0);
        const observacaoVenda = p.dados.observacao_venda || "-";
        const observacaoProducao = p.dados.observacao_producao || "-";
        const quantidadeDobradicas = parseInt(p.dados.dobradicas || "0", 10) || 0;
        const alturasDobradicas = Array.isArray(p.dados.dobradicas_alturas) && p.dados.dobradicas_alturas.length
            ? `${p.dados.dobradicas_alturas.join(" mm, ")} mm`
            : "-";
        const alturaPorta = parseFloat(p.dados.altura || 0);
        const alturaPuxador = parseFloat(p.dados.altura_puxador || 0);
        const medidaPuxador = parseFloat(p.dados.medida_puxador || 0);
        const recuos = obterRecuosPuxador(alturaPorta, alturaPuxador, medidaPuxador);
        const vaoPuxador = recuos.recuoBase === null
            ? "-"
            : `Base ${Math.round(recuos.recuoBase)} mm | Topo ${Math.round(recuos.recuoTopo)} mm`;
        return `
            <div class="print-item op-page">
                <div>
                    ${gerarSvgOrdemProducao(p)}
                </div>
                <div class="op-info">
                    <div><strong>O.P. ${index + 1} - ${p.tipo}</strong></div>
                    <div>Perfil: ${perfilNome}</div>
                    <div>Vidro: ${vidroNome}</div>
                    <div>Puxador: ${puxadorNome}</div>
                    <div>Valor adicional: ${valorAdicional ? formatarMoeda(valorAdicional) : "-"}</div>
                    <div>Observação de venda: ${observacaoVenda}</div>
                    <div>Observação de produção: ${observacaoProducao}</div>
                    <div>Dobradiças: ${quantidadeDobradicas} (alturas: ${alturasDobradicas})</div>
                    <div>Vão do puxador: ${vaoPuxador}</div>
                </div>
            </div>
        `;
    }).join("");

    container.innerHTML = `
        <h2>Ordem de Produção</h2>
        <p>${obterIdentificacaoOrcamento()}</p>
        ${itens}
    `;
}

function atualizarEtiquetasTermicas() {
    const container = document.getElementById("printEtiqueta");
    if (!container) return;
    if (portas.length === 0) {
        container.innerHTML = "";
        return;
    }

    const dataHoje = obterDataHoje();
    const clienteNome = orcamentoInfo?.cliente_nome || "-";
    const pedidoNumero = orcamentoInfo?.numero_pedido ?? "-";
    const cidadeCliente = obterCidadeCliente();

    const etiquetas = [];
    portas.forEach((porta, index) => {
        const quantidade = parseInt(porta.quantidade || "1", 10) || 1;
        const largura = porta.dados.largura || "-";
        const altura = porta.dados.altura || "-";
        const perfilNome = todosPerfis.find(perfil => perfil.id == porta.dados.perfil)?.nome || "-";
        const vidroNome = todosVidros.find(vidro => vidro.id == porta.dados.vidro)?.tipo || "-";
        const descricao = `${index + 1} Porta - ${largura} x ${altura} mm`;

        for (let i = 1; i <= quantidade; i += 1) {
            etiquetas.push(`
                <div class="thermal-label">
                    <div class="thermal-header">
                        <div><strong>Pedido:</strong> ${pedidoNumero}</div>
                        <div><strong>Data:</strong> ${dataHoje}</div>
                        <div><strong>Volume:</strong> ${i}/${quantidade}</div>
                        <div><strong>Cliente:</strong> ${clienteNome}</div>
                        <div><strong>Cidade:</strong> ${cidadeCliente}</div>
                    </div>
                    <div class="thermal-divider"></div>
                    <div class="thermal-body">
                        <div><strong>${descricao}</strong></div>
                        <div>${perfilNome}</div>
                        <div>${vidroNome}</div>
                    </div>
                    <div class="thermal-divider"></div>
                    <div class="thermal-footer">colorglassfortaleza.com.br</div>
                </div>
            `);
        }
    });

    container.innerHTML = etiquetas.join("");
}

function imprimirOrcamento() {
    atualizarResumoImpressao();
    document.getElementById("printResumo").classList.add("active");
    document.getElementById("printOrdem").classList.remove("active");
    document.getElementById("printEtiqueta").classList.remove("active");
    window.print();
}

function imprimirOrdemProducao() {
    atualizarResumoOrdem();
    document.getElementById("printOrdem").classList.add("active");
    document.getElementById("printResumo").classList.remove("active");
    document.getElementById("printEtiqueta").classList.remove("active");
    window.print();
}

function imprimirEtiquetaTermica() {
    atualizarEtiquetasTermicas();
    document.getElementById("printEtiqueta").classList.add("active");
    document.getElementById("printResumo").classList.remove("active");
    document.getElementById("printOrdem").classList.remove("active");
    window.print();
}

window.obterRecuosPuxador = obterRecuosPuxador;
window.obterIdentificacaoOrcamento = obterIdentificacaoOrcamento;
window.obterCidadeCliente = obterCidadeCliente;
window.obterDataHoje = obterDataHoje;
window.atualizarResumoImpressao = atualizarResumoImpressao;
window.gerarSvgOrdemProducao = gerarSvgOrdemProducao;
window.atualizarResumoOrdem = atualizarResumoOrdem;
window.atualizarEtiquetasTermicas = atualizarEtiquetasTermicas;
window.imprimirOrcamento = imprimirOrcamento;
window.imprimirOrdemProducao = imprimirOrdemProducao;
window.imprimirEtiquetaTermica = imprimirEtiquetaTermica;
