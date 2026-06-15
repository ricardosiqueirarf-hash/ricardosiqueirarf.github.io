// =====================
// CONFERÊNCIA USANDO A MESMA FONTE DO PREÇO
// Usa calcularComponentesPortaAtual(), evitando divergência entre preço e verificação.
// =====================

function formatarNumeroBridge(valor, casas = 2) {
    return (Number(valor) || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas
    });
}

function formatarMoedaBridge(valor) {
    if (typeof formatarMoeda === "function") return formatarMoeda(valor || 0);
    return `R$ ${(Number(valor) || 0).toFixed(2)}`;
}

function obterFormulaBridge(linha, medidas) {
    if (linha.formula) return linha.formula;
    if (linha.categoria === "perfil") {
        return `2 × (${formatarNumeroBridge(medidas.larguraM, 3)} + ${formatarNumeroBridge(medidas.alturaM, 3)})`;
    }
    if (linha.categoria === "vidro") {
        return `${formatarNumeroBridge(medidas.larguraM, 3)} × ${formatarNumeroBridge(medidas.alturaM, 3)}`;
    }
    if (String(linha.categoria || "").startsWith("trilho")) {
        return linha.unidade === "m" ? "largura + vão correspondente" : "1 unidade por porta";
    }
    if (linha.categoria === "sistema") return "1 sistema por porta";
    if (linha.categoria === "insumo_perfil") return linha.unidade === "m" ? "perímetro da porta" : "1 unidade por porta";
    if (linha.categoria === "puxador") return linha.unidade === "m" ? "medida do puxador ÷ 1000" : "1 unidade por porta";
    if (linha.categoria === "tag") return "regra da tag aplicada";
    if (linha.categoria === "adicional") return "valor manual";
    return "-";
}

function renderizarConferenciaCalculoPorta() {
    if (typeof adicionarEstilosConferenciaCalculo === "function") {
        adicionarEstilosConferenciaCalculo();
    }

    const container = document.getElementById("calculoConferenciaCard");
    if (!container) return;

    if (typeof calcularComponentesPortaAtual !== "function") {
        container.innerHTML = `<div class="calculo-check-alerta">Cálculo por componentes ainda não carregado.</div>`;
        return;
    }

    const quantidadePortas = Number(document.getElementById("quantidade")?.value || 1) || 1;
    const componentes = calcularComponentesPortaAtual();
    const medidas = componentes.medidas;
    const linhas = componentes.linhas || [];
    const subtotalPorPorta = linhas.reduce((acc, linha) => acc + Number(linha.total || 0), 0);
    const totalTecnico = subtotalPorPorta * quantidadePortas;
    const totalSistema = typeof calcularPrecoPorta === "function" ? calcularPrecoPorta() : totalTecnico;
    const diferenca = totalSistema - totalTecnico;
    const perimetroTotal = medidas.perimetro * quantidadePortas;
    const areaTotal = medidas.area * quantidadePortas;

    const linhasHtml = linhas.length
        ? linhas.map((linha) => `
            <tr>
                <td>${linha.nome}</td>
                <td>${obterFormulaBridge(linha, medidas)}</td>
                <td>${formatarNumeroBridge(linha.quantidade, linha.unidade === "un" ? 0 : 3)} ${linha.unidade || ""}</td>
                <td>${formatarMoedaBridge(linha.unitario)}</td>
                <td>${formatarMoedaBridge(linha.total)}</td>
                <td>${formatarMoedaBridge(Number(linha.total || 0) * quantidadePortas)}</td>
            </tr>
        `).join("")
        : `<tr><td colspan="6">Selecione tipologia, perfil e vidro para ver o espelho do cálculo.</td></tr>`;

    const statusHtml = Math.abs(diferenca) <= 0.01
        ? `<div class="calculo-check-ok">✅ Total do espelho técnico bate com o preço exibido.</div>`
        : `<div class="calculo-check-alerta">⚠️ Total do espelho técnico não bate com o preço exibido pelo sistema. Diferença: ${formatarMoedaBridge(diferenca)}</div>`;

    container.innerHTML = `
        <div class="calculo-check-header">
            <strong>Conferência do cálculo da porta atual</strong>
            <button type="button" class="calculo-check-mini-btn" onclick="verificarFerramentaOrcamentoAtual()">Atualizar tudo</button>
        </div>

        <div class="calculo-check-summary">
            <div class="calculo-check-pill"><span>Largura × Altura</span><strong>${formatarNumeroBridge(medidas.larguraMm, 0)} × ${formatarNumeroBridge(medidas.alturaMm, 0)} mm</strong></div>
            <div class="calculo-check-pill"><span>Quantidade</span><strong>${formatarNumeroBridge(quantidadePortas, 0)} porta(s)</strong></div>
            <div class="calculo-check-pill"><span>Perfil por porta</span><strong>${formatarNumeroBridge(medidas.perimetro, 3)} m linear</strong></div>
            <div class="calculo-check-pill"><span>Perfil total</span><strong>${formatarNumeroBridge(perimetroTotal, 3)} m linear</strong></div>
            <div class="calculo-check-pill"><span>Vidro por porta</span><strong>${formatarNumeroBridge(medidas.area, 3)} m²</strong></div>
            <div class="calculo-check-pill"><span>Vidro total</span><strong>${formatarNumeroBridge(areaTotal, 3)} m²</strong></div>
        </div>

        <div class="calculo-check-table-wrap">
            <table class="calculo-check-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Fórmula</th>
                        <th>Qtd/porta</th>
                        <th>Preço unit.</th>
                        <th>Subtotal/porta</th>
                        <th>Total c/ qtd</th>
                    </tr>
                </thead>
                <tbody>${linhasHtml}</tbody>
            </table>
        </div>

        <div class="calculo-check-total">
            Subtotal por porta: ${formatarMoedaBridge(subtotalPorPorta)}<br>
            Total técnico: ${formatarMoedaBridge(totalTecnico)}<br>
            Preço exibido pelo sistema: ${formatarMoedaBridge(totalSistema)}
        </div>

        ${statusHtml}
    `;
}

window.renderizarConferenciaCalculoPorta = renderizarConferenciaCalculoPorta;
