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

        // ✅ ADICIONADO: Perfil e Vidro no resumo do orçamento
        const perfilNome = todosPerfis.find(perfil => perfil.id == p.dados.perfil)?.nome || "-";
        const vidroNome = todosVidros.find(vidro => vidro.id == p.dados.vidro)?.tipo || "-";

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
                Perfil: ${perfilNome}<br>
                Vidro: ${vidroNome}<br>
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

    const canvasWidth = 420;
    const canvasHeight = 560;
    const padding = 60;
    const availableWidth = canvasWidth - padding * 2;
    const availableHeight = canvasHeight - padding * 2;
    const scale = Math.min(availableWidth / largura, availableHeight / altura);

    const doorWidth = largura * scale;
    const doorHeight = altura * scale;
    const doorX = padding + (availableWidth - doorWidth) / 2;
    const doorY = padding + (availableHeight - doorHeight) / 2;

    const alturaTextX = doorX - 40;
    const alturaTextY = doorY + doorHeight / 2;
    const larguraTextX = doorX + doorWidth / 2;
    const larguraTextY = doorY + doorHeight + 44;
    const quantidadeTexto = `${porta.quantidade || 1}x`;
    const quantidadeX = doorX + doorWidth / 2;
    const quantidadeY = doorY + doorHeight / 2;

    return `
    <svg class="op-svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${doorX}" y="${doorY}" width="${doorWidth}" height="${doorHeight}" fill="#f4f8ff" stroke="#1079ba" stroke-width="3"/>
      <text x="${quantidadeX}" y="${quantidadeY}" class="op-quantity" text-anchor="middle" dominant-baseline="middle">${quantidadeTexto}</text>

      <line x1="${doorX - 16}" y1="${doorY}" x2="${doorX - 16}" y2="${doorY + doorHeight}" stroke="#333"/>
      <line x1="${doorX - 22}" y1="${doorY}" x2="${doorX}" y2="${doorY}" stroke="#333"/>
      <line x1="${doorX - 22}" y1="${doorY + doorHeight}" x2="${doorX}" y2="${doorY + doorHeight}" stroke="#333"/>
      <text x="${alturaTextX}" y="${alturaTextY}" class="op-measure" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${alturaTextX} ${alturaTextY})">
        ${altura} mm
      </text>

      <line x1="${doorX}" y1="${doorY + doorHeight + 20}" x2="${doorX + doorWidth}" y2="${doorY + doorHeight + 20}" stroke="#333"/>
      <line x1="${doorX}" y1="${doorY + doorHeight + 16}" x2="${doorX}" y2="${doorY + doorHeight + 24}" stroke="#333"/>
      <line x1="${doorX + doorWidth}" y1="${doorY + doorHeight + 16}" x2="${doorX + doorWidth}" y2="${doorY + doorHeight + 24}" stroke="#333"/>
      <text x="${larguraTextX}" y="${larguraTextY}" class="op-measure" text-anchor="middle">${largura} mm</text>
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
        const observacaoProducao = p.dados.observacao_producao || "-";
        const cabecalho = index === 0
            ? `
                <div class="op-header">
                    <h2>Ordem de Produção</h2>
                    <p>${obterIdentificacaoOrcamento()}</p>
                </div>
            `
            : "";

        return `
            <div class="print-item op-page">
                <div class="op-left">
                    ${cabecalho}
                    <div class="op-title">O.P. ${index + 1} - ${p.tipo}</div>
                    ${gerarSvgOrdemProducao(p)}
                </div>
                <div class="op-info">
                    <div class="op-info-title">Detalhes</div>
                    <div class="op-info-row">
                        <span>Perfil</span>
                        <strong>${perfilNome}</strong>
                    </div>
                    <div class="op-info-row">
                        <span>Vidro</span>
                        <strong>${vidroNome}</strong>
                    </div>
                    <div class="op-info-row">
                        <span>Puxador</span>
                        <strong>${puxadorNome}</strong>
                    </div>
                    <div class="op-info-row">
                        <span>Observação de produção</span>
                        <strong>${observacaoProducao}</strong>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    container.innerHTML = itens;
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





