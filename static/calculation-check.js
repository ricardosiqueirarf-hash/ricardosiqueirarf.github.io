// =====================
// FERRAMENTA ÚNICA: VERIFICAÇÃO + CONFERÊNCIA DO CÁLCULO
// Mostra checklist do orçamento e espelho técnico do cálculo no mesmo card.
// =====================

function adicionarEstilosConferenciaCalculo() {
    if (document.getElementById("calculationCheckStyles")) return;

    const style = document.createElement("style");
    style.id = "calculationCheckStyles";
    style.textContent = `
        .calculo-check-card {
            margin-top: 12px;
            padding: 12px;
            border-radius: 14px;
            border: 1px solid rgba(16,121,186,0.16);
            background: rgba(255,255,255,0.96);
            box-shadow: 0 10px 18px rgba(15,44,62,0.08);
        }

        .calculo-check-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }

        .calculo-check-header strong {
            color: #0d5d8c;
            font-size: 0.96rem;
        }

        .calculo-check-mini-btn {
            padding: 7px 10px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            background: rgba(16,121,186,0.10);
            color: #0d5d8c;
            font-weight: 800;
        }

        .calculo-check-summary {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
            margin-bottom: 10px;
            font-size: 0.86rem;
        }

        .calculo-check-pill {
            border: 1px solid rgba(16,121,186,0.12);
            border-radius: 10px;
            padding: 8px;
            background: rgba(247,249,252,0.96);
        }

        .calculo-check-pill span {
            display: block;
            color: #6b7280;
            font-size: 0.78rem;
            margin-bottom: 2px;
        }

        .calculo-check-pill strong {
            color: #1f2933;
        }

        .calculo-check-table-wrap {
            overflow-x: auto;
        }

        .calculo-check-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.82rem;
            min-width: 720px;
        }

        .calculo-check-table th,
        .calculo-check-table td {
            border: 1px solid rgba(220,221,225,0.9);
            padding: 7px;
            text-align: left;
            vertical-align: top;
        }

        .calculo-check-table th {
            background: rgba(231,243,251,0.95);
            color: #0d5d8c;
        }

        .calculo-check-total {
            margin-top: 9px;
            padding: 9px 10px;
            border-radius: 12px;
            font-weight: 900;
            background: rgba(231,243,251,0.85);
            color: #0d5d8c;
            border: 1px solid rgba(16,121,186,0.16);
        }

        .calculo-check-alerta {
            margin-top: 8px;
            padding: 9px 10px;
            border-radius: 12px;
            background: rgba(255,247,237,0.95);
            color: #9a3412;
            border: 1px solid rgba(249,115,22,0.25);
            font-weight: 800;
        }

        .calculo-check-ok {
            margin-top: 8px;
            padding: 9px 10px;
            border-radius: 12px;
            background: rgba(240,253,244,0.95);
            color: #166534;
            border: 1px solid rgba(34,197,94,0.22);
            font-weight: 800;
        }

        .orcamento-auditoria-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
            margin-top: 10px;
        }

        @media (max-width: 700px) {
            .calculo-check-summary {
                grid-template-columns: 1fr;
            }
        }
    `;

    document.head.appendChild(style);
}

function formatarNumeroCalculo(valor, casas = 2) {
    const numero = Number(valor) || 0;
    return numero.toLocaleString("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas
    });
}

function formatarMoedaCalculo(valor) {
    if (typeof formatarMoeda === "function") return formatarMoeda(valor || 0);
    return `R$ ${(Number(valor) || 0).toFixed(2)}`;
}

function obterNomeTagCalculo(tag) {
    if (!tag) return "Tag aplicada";
    if (Array.isArray(tag.tags) && tag.tags.length) return tag.tags.join(", ");
    return [tag.perfis, tag.vidros].filter(Boolean).join(" - ") || "Tag aplicada";
}

function obterUnidadeTagCalculo(medida) {
    if (medida === "m2") return "m²";
    if (medida === "perimetro") return "m";
    return "un";
}

function criarLinhaConferencia(item, formula, quantidadePorPorta, unidade, unitario, subtotalPorPorta, quantidadePortas) {
    return {
        item,
        formula,
        quantidadePorPorta,
        unidade,
        unitario,
        subtotalPorPorta,
        totalComQuantidade: subtotalPorPorta * quantidadePortas
    };
}

function obterConferenciaCalculoPortaAtual() {
    if (typeof calcularMedidasPorta !== "function") return null;

    const medidas = calcularMedidasPorta();
    const quantidadePortas = Number(document.getElementById("quantidade")?.value || 1) || 1;
    const perfil = Array.isArray(todosPerfis)
        ? todosPerfis.find((p) => String(p.id) === String(document.getElementById("perfil")?.value))
        : null;
    const vidro = Array.isArray(todosVidros)
        ? todosVidros.find((v) => String(v.id) === String(document.getElementById("vidro")?.value))
        : null;
    const valorAdicional = Number(document.getElementById("valor_adicional")?.value || 0) || 0;
    const linhas = [];
    const avisos = [];

    if (perfil) {
        const subtotal = (Number(perfil.preco) || 0) * medidas.perimetro;
        linhas.push(criarLinhaConferencia(
            `Perfil (${perfil.nome})`,
            `2 × (${formatarNumeroCalculo(medidas.larguraM, 3)} + ${formatarNumeroCalculo(medidas.alturaM, 3)})`,
            medidas.perimetro,
            "m",
            Number(perfil.preco) || 0,
            subtotal,
            quantidadePortas
        ));
    } else {
        avisos.push("Perfil ainda não selecionado.");
    }

    if (vidro) {
        const subtotal = (Number(vidro.preco) || 0) * medidas.area;
        linhas.push(criarLinhaConferencia(
            `Vidro (${vidro.tipo}${vidro.espessura ? ` ${vidro.espessura}mm` : ""})`,
            `${formatarNumeroCalculo(medidas.larguraM, 3)} × ${formatarNumeroCalculo(medidas.alturaM, 3)}`,
            medidas.area,
            "m²",
            Number(vidro.preco) || 0,
            subtotal,
            quantidadePortas
        ));
    } else {
        avisos.push("Vidro ainda não selecionado.");
    }

    const insumos = (perfil?.insumos || [])
        .map((nome) => Array.isArray(todosInsumos) ? todosInsumos.find((insumo) => insumo.nome === nome) : null)
        .filter(Boolean);

    insumos.forEach((insumo) => {
        const tipo = insumo.tipo_medida;
        let quantidade = 0;
        let unidade = "un";
        let formula = "1 unidade por porta";

        if (tipo === "metro_linear") {
            quantidade = medidas.perimetro;
            unidade = "m";
            formula = "mesmo ML do perfil";
        } else if (tipo === "unidade") {
            quantidade = 1;
            unidade = "un";
        } else {
            avisos.push(`Insumo ${insumo.nome}: tipo de medida não tratado (${tipo}).`);
            return;
        }

        const subtotal = (Number(insumo.preco) || 0) * quantidade;
        linhas.push(criarLinhaConferencia(
            `Insumo (${insumo.nome})`,
            formula,
            quantidade,
            unidade,
            Number(insumo.preco) || 0,
            subtotal,
            quantidadePortas
        ));
    });

    const puxadorId = document.getElementById("puxador")?.value;
    if (puxadorId && puxadorId !== "sem_puxador") {
        const puxador = Array.isArray(todosPuxadores)
            ? todosPuxadores.find((p) => String(p.id) === String(puxadorId))
            : null;
        if (puxador) {
            const tipoMedida = puxador.tipo_medida;
            const medidaPuxadorMm = Number(document.getElementById("medida_puxador")?.value || 0) || 0;
            const quantidade = tipoMedida === "metro_linear" ? medidaPuxadorMm / 1000 : 1;
            const unidade = tipoMedida === "metro_linear" ? "m" : "un";
            const formula = tipoMedida === "metro_linear"
                ? `${formatarNumeroCalculo(medidaPuxadorMm, 0)} mm ÷ 1000`
                : "1 unidade por porta";
            const subtotal = (Number(puxador.preco) || 0) * quantidade;
            linhas.push(criarLinhaConferencia(
                `Puxador (${puxador.nome})`,
                formula,
                quantidade,
                unidade,
                Number(puxador.preco) || 0,
                subtotal,
                quantidadePortas
            ));
        } else {
            avisos.push("Puxador selecionado não encontrado na lista carregada.");
        }
    }

    const tagAplicada = typeof calcularTagAplicada === "function" && typeof obterTagCorrespondente === "function"
        ? calcularTagAplicada(obterTagCorrespondente(), medidas)
        : null;
    if (tagAplicada) {
        const unidade = obterUnidadeTagCalculo(tagAplicada.tag.medida);
        const valorUnitario = Number(tagAplicada.tag.valor) || 0;
        linhas.push(criarLinhaConferencia(
            `Tag (${obterNomeTagCalculo(tagAplicada.tag)})`,
            `medida: ${tagAplicada.tag.medida}`,
            tagAplicada.quantidade,
            unidade,
            valorUnitario,
            tagAplicada.total,
            quantidadePortas
        ));
    }

    if (valorAdicional > 0) {
        linhas.push(criarLinhaConferencia(
            "Valor adicional",
            "valor informado por porta",
            1,
            "un",
            valorAdicional,
            valorAdicional,
            quantidadePortas
        ));
    }

    const subtotalPorPorta = linhas.reduce((acc, linha) => acc + linha.subtotalPorPorta, 0);
    const totalTecnico = subtotalPorPorta * quantidadePortas;
    const totalSistema = typeof calcularPrecoPorta === "function" ? calcularPrecoPorta() : totalTecnico;
    const diferenca = totalSistema - totalTecnico;

    if (Math.abs(diferenca) > 0.01) {
        avisos.push(`Diferença entre preço do sistema e espelho técnico: ${formatarMoedaCalculo(diferenca)}.`);
        const puxador = puxadorId && puxadorId !== "sem_puxador" && Array.isArray(todosPuxadores)
            ? todosPuxadores.find((p) => String(p.id) === String(puxadorId))
            : null;
        if (puxador?.tipo_medida === "unidade" && quantidadePortas > 1) {
            avisos.push("Possível atenção: puxador por unidade pode estar sendo multiplicado pela quantidade mais de uma vez no cálculo atual.");
        }
    }

    return {
        medidas,
        quantidadePortas,
        linhas,
        avisos,
        subtotalPorPorta,
        totalTecnico,
        totalSistema,
        diferenca
    };
}

function renderizarConferenciaCalculoPorta() {
    adicionarEstilosConferenciaCalculo();

    const container = document.getElementById("calculoConferenciaCard");
    if (!container) return;

    const conferencia = obterConferenciaCalculoPortaAtual();
    if (!conferencia) {
        container.innerHTML = `<div class="calculo-check-alerta">Cálculo ainda não disponível.</div>`;
        return;
    }

    const { medidas, quantidadePortas, linhas, avisos, subtotalPorPorta, totalTecnico, totalSistema, diferenca } = conferencia;
    const perimetroTotal = medidas.perimetro * quantidadePortas;
    const areaTotal = medidas.area * quantidadePortas;

    const linhasHtml = linhas.length
        ? linhas.map((linha) => `
            <tr>
                <td>${linha.item}</td>
                <td>${linha.formula}</td>
                <td>${formatarNumeroCalculo(linha.quantidadePorPorta, linha.unidade === "un" ? 0 : 3)} ${linha.unidade}</td>
                <td>${formatarMoedaCalculo(linha.unitario)}</td>
                <td>${formatarMoedaCalculo(linha.subtotalPorPorta)}</td>
                <td>${formatarMoedaCalculo(linha.totalComQuantidade)}</td>
            </tr>
        `).join("")
        : `<tr><td colspan="6">Selecione tipologia, perfil e vidro para ver o espelho do cálculo.</td></tr>`;

    const statusHtml = Math.abs(diferenca) <= 0.01
        ? `<div class="calculo-check-ok">✅ Total do espelho técnico bate com o preço exibido.</div>`
        : `<div class="calculo-check-alerta">⚠️ Total do espelho técnico não bate com o preço exibido pelo sistema.</div>`;

    container.innerHTML = `
        <div class="calculo-check-header">
            <strong>Conferência do cálculo da porta atual</strong>
            <button type="button" class="calculo-check-mini-btn" onclick="verificarFerramentaOrcamentoAtual()">Atualizar tudo</button>
        </div>

        <div class="calculo-check-summary">
            <div class="calculo-check-pill"><span>Largura × Altura</span><strong>${formatarNumeroCalculo(medidas.larguraMm, 0)} × ${formatarNumeroCalculo(medidas.alturaMm, 0)} mm</strong></div>
            <div class="calculo-check-pill"><span>Quantidade</span><strong>${formatarNumeroCalculo(quantidadePortas, 0)} porta(s)</strong></div>
            <div class="calculo-check-pill"><span>Perfil por porta</span><strong>${formatarNumeroCalculo(medidas.perimetro, 3)} m linear</strong></div>
            <div class="calculo-check-pill"><span>Perfil total</span><strong>${formatarNumeroCalculo(perimetroTotal, 3)} m linear</strong></div>
            <div class="calculo-check-pill"><span>Vidro por porta</span><strong>${formatarNumeroCalculo(medidas.area, 3)} m²</strong></div>
            <div class="calculo-check-pill"><span>Vidro total</span><strong>${formatarNumeroCalculo(areaTotal, 3)} m²</strong></div>
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
            Subtotal por porta: ${formatarMoedaCalculo(subtotalPorPorta)}<br>
            Total técnico: ${formatarMoedaCalculo(totalTecnico)}<br>
            Preço exibido pelo sistema: ${formatarMoedaCalculo(totalSistema)}
        </div>

        ${statusHtml}
        ${avisos.map((aviso) => `<div class="calculo-check-alerta">⚠️ ${aviso}</div>`).join("")}
    `;
}

function prepararCardUnificadoOrcamento() {
    adicionarEstilosConferenciaCalculo();

    const cardAuditoria = document.getElementById("orcamentoAuditoriaCard");
    const precoEl = document.getElementById("precoPorta");

    let container = document.getElementById("calculoConferenciaCard");
    if (!container) {
        container = document.createElement("div");
        container.id = "calculoConferenciaCard";
        container.className = "calculo-check-card";
    }

    if (cardAuditoria) {
        const titulo = cardAuditoria.querySelector("h2");
        if (titulo) titulo.textContent = "Verificação e Conferência do Orçamento";

        const checklist = document.getElementById("orcamentoChecklist");
        if (checklist && container.parentNode !== cardAuditoria) {
            checklist.insertAdjacentElement("afterend", container);
        } else if (!checklist && container.parentNode !== cardAuditoria) {
            cardAuditoria.appendChild(container);
        }

        const botao = cardAuditoria.querySelector("button");
        if (botao) {
            botao.textContent = "Verificar orçamento e cálculo";
            botao.onclick = verificarFerramentaOrcamentoAtual;
        }
    } else if (precoEl && container.parentNode !== precoEl.parentNode) {
        precoEl.insertAdjacentElement("afterend", container);
    }

    renderizarConferenciaCalculoPorta();
}

function verificarFerramentaOrcamentoAtual() {
    let resultado = null;
    if (typeof window.__verificarOrcamentoOriginal === "function") {
        resultado = window.__verificarOrcamentoOriginal();
    } else if (typeof window.verificarOrcamentoAtual === "function") {
        resultado = window.verificarOrcamentoAtual();
    }

    prepararCardUnificadoOrcamento();
    renderizarConferenciaCalculoPorta();
    return resultado;
}

function integrarVerificacaoECalculo() {
    if (typeof window.verificarOrcamentoAtual === "function" && !window.verificarOrcamentoAtual.__unificadoComCalculo) {
        window.__verificarOrcamentoOriginal = window.verificarOrcamentoAtual;
        const wrapped = function (...args) {
            const resultado = window.__verificarOrcamentoOriginal.apply(this, args);
            prepararCardUnificadoOrcamento();
            renderizarConferenciaCalculoPorta();
            return resultado;
        };
        wrapped.__unificadoComCalculo = true;
        window.verificarOrcamentoAtual = wrapped;
    }
}

function inicializarConferenciaCalculoPorta() {
    prepararCardUnificadoOrcamento();
    integrarVerificacaoECalculo();

    const atualizar = () => {
        clearTimeout(window.__calculoCheckTimer);
        window.__calculoCheckTimer = setTimeout(() => {
            prepararCardUnificadoOrcamento();
            renderizarConferenciaCalculoPorta();
        }, 60);
    };

    document.addEventListener("input", atualizar, true);
    document.addEventListener("change", atualizar, true);

    if (typeof window.atualizarPrecoPorta === "function" && !window.atualizarPrecoPorta.__calculoCheckWrapped) {
        const originalAtualizarPrecoPorta = window.atualizarPrecoPorta;
        const wrapped = function (...args) {
            const retorno = originalAtualizarPrecoPorta.apply(this, args);
            atualizar();
            return retorno;
        };
        wrapped.__calculoCheckWrapped = true;
        window.atualizarPrecoPorta = wrapped;
    }

    if (typeof window.renderCampos === "function" && !window.renderCampos.__calculoCheckWrapped) {
        const originalRenderCampos = window.renderCampos;
        const wrappedRenderCampos = function (...args) {
            const retorno = originalRenderCampos.apply(this, args);
            prepararCardUnificadoOrcamento();
            atualizar();
            return retorno;
        };
        wrappedRenderCampos.__calculoCheckWrapped = true;
        window.renderCampos = wrappedRenderCampos;
    }

    atualizar();
}

window.obterConferenciaCalculoPortaAtual = obterConferenciaCalculoPortaAtual;
window.renderizarConferenciaCalculoPorta = renderizarConferenciaCalculoPorta;
window.prepararCardUnificadoOrcamento = prepararCardUnificadoOrcamento;
window.verificarFerramentaOrcamentoAtual = verificarFerramentaOrcamentoAtual;
window.inicializarConferenciaCalculoPorta = inicializarConferenciaCalculoPorta;

document.addEventListener("DOMContentLoaded", inicializarConferenciaCalculoPorta);
