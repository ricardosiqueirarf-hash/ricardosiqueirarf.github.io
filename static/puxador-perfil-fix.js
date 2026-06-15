// =====================
// PUXADOR TIPO METRO LINEAR / PERFIL
// Ex: 3136P substitui uma lateral do perfil base, em vez de ser somado por fora.
// =====================

function normalizarTipoMedidaPuxador(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function puxadorEhPerfil(puxador) {
    const tipo = normalizarTipoMedidaPuxador(puxador?.tipo_medida);
    return tipo === "metro_linear_perfil" || tipo === "metro_linearperfil" || tipo === "metro_linear_puxador_perfil";
}

function unidadePuxadorLabel(puxador) {
    if (puxadorEhPerfil(puxador)) return "m/perfil";
    if (puxador?.tipo_medida === "metro_linear") return "m";
    return "un";
}

function atualizarPuxadoresSelect() {
    const puxadorSelect = document.getElementById("puxador");
    if (!puxadorSelect) return;

    const valorAtual = puxadorSelect.value;
    puxadorSelect.innerHTML = "<option value=''>Selecione</option>";
    puxadorSelect.innerHTML += "<option value='sem_puxador'>Sem puxador</option>";

    todosPuxadores.forEach(p => {
        const unidade = unidadePuxadorLabel(p);
        puxadorSelect.innerHTML += `<option value="${p.id}">${p.nome} - R$ ${Number(p.preco || 0).toFixed(2)}/${unidade}</option>`;
    });

    if (valorAtual) puxadorSelect.value = valorAtual;
}

function obterPuxadorSelecionado() {
    const puxadorId = document.getElementById("puxador")?.value;
    if (!puxadorId || puxadorId === "sem_puxador") return null;
    return todosPuxadores.find(p => String(p.id) === String(puxadorId)) || null;
}

function obterComprimentoPuxadorPerfil(medidas) {
    const posicao = document.getElementById("puxador_posicao")?.value || "direita";
    if (posicao === "cima" || posicao === "baixo") return medidas.larguraM;
    return medidas.alturaM;
}

function obterFormulaPuxadorPerfil(medidas) {
    const posicao = document.getElementById("puxador_posicao")?.value || "direita";
    if (posicao === "cima" || posicao === "baixo") return `substitui o perfil ${posicao}: ${medidas.larguraM.toFixed(3)}m`;
    return `substitui o perfil ${posicao}: ${medidas.alturaM.toFixed(3)}m`;
}

function obterDadosPuxador() {
    const puxador = obterPuxadorSelecionado();
    if (!puxador) return null;

    const tipoMedida = puxador.tipo_medida;
    const medidaPuxadorMm = +document.getElementById("medida_puxador")?.value || 0;
    const medidas = typeof calcularMedidasPorta === "function" ? calcularMedidasPorta() : null;

    let quantidade = 0;
    if (puxadorEhPerfil(puxador) && medidas) {
        quantidade = obterComprimentoPuxadorPerfil(medidas);
    } else if (tipoMedida === "metro_linear") {
        quantidade = medidaPuxadorMm / 1000;
    } else {
        quantidade = 1;
    }

    return {
        puxador,
        tipoMedida,
        quantidade,
        medidaPuxadorMm,
        ehPerfil: puxadorEhPerfil(puxador)
    };
}

function calcularComponentesPortaAtual() {
    const medidas = calcularMedidasPorta();
    const tipo = obterTipoPortaAtual();
    const perfil = todosPerfis.find(p => p.id == document.getElementById("perfil")?.value);
    const vidro = todosVidros.find(v => v.id == document.getElementById("vidro")?.value);
    const sistema = obterSistemaSelecionado();
    const puxador = obterPuxadorSelecionado();
    const puxadorPerfil = puxadorEhPerfil(puxador) ? puxador : null;
    const comprimentoPuxadorPerfil = puxadorPerfil ? obterComprimentoPuxadorPerfil(medidas) : 0;
    const valorAdicional = +document.getElementById("valor_adicional")?.value || 0;

    const componentes = { tipo, medidas, perfil, vidro, sistema, linhas: [] };

    if (perfil) {
        const qtdPerfilBase = Math.max(0, medidas.perimetro - comprimentoPuxadorPerfil);
        componentes.linhas.push({
            categoria: "perfil",
            item: perfil,
            nome: `Perfil (${perfil.nome})`,
            quantidade: qtdPerfilBase,
            unidade: "m",
            unitario: Number(perfil.preco) || 0,
            total: (Number(perfil.preco) || 0) * qtdPerfilBase,
            formula: puxadorPerfil
                ? `perímetro ${medidas.perimetro.toFixed(3)}m - lado do puxador ${comprimentoPuxadorPerfil.toFixed(3)}m`
                : `2 × (${medidas.larguraM.toFixed(3)} + ${medidas.alturaM.toFixed(3)})`
        });
    }

    if (puxadorPerfil) {
        componentes.linhas.push({
            categoria: "puxador_perfil",
            item: puxadorPerfil,
            nome: `Puxador-perfil (${puxadorPerfil.nome})`,
            quantidade: comprimentoPuxadorPerfil,
            unidade: "m",
            unitario: Number(puxadorPerfil.preco) || 0,
            total: (Number(puxadorPerfil.preco) || 0) * comprimentoPuxadorPerfil,
            formula: obterFormulaPuxadorPerfil(medidas)
        });
    }

    if (vidro) {
        componentes.linhas.push({
            categoria: "vidro",
            item: vidro,
            nome: `Vidro (${vidro.tipo}${vidro.espessura ? ` ${vidro.espessura}mm` : ""})`,
            quantidade: medidas.area,
            unidade: "m²",
            unitario: Number(vidro.preco) || 0,
            total: (Number(vidro.preco) || 0) * medidas.area,
            formula: `${medidas.larguraM.toFixed(3)} × ${medidas.alturaM.toFixed(3)}`
        });
    }

    obterInsumosDoPerfil(perfil).forEach((insumo) => {
        const calculo = calcularTotalMaterialPorta(insumo, medidas);
        const unidade = insumo.tipo_medida === "metro_linear" ? "m" : (insumo.tipo_medida === "m2" ? "m²" : "un");
        componentes.linhas.push({
            categoria: "insumo_perfil",
            item: insumo,
            nome: `Insumo do perfil (${insumo.nome})`,
            quantidade: calculo.quantidade,
            unidade,
            unitario: Number(insumo.preco) || 0,
            total: calculo.total,
            formula: unidade === "m" ? "perímetro da porta" : "1 unidade por porta"
        });
    });

    if (tipo === "deslizante" || tipo === "correr") {
        if (sistema) {
            componentes.linhas.push({
                categoria: "sistema",
                item: sistema,
                nome: `Sistema (${sistema.nome})`,
                quantidade: 1,
                unidade: "un",
                unitario: Number(sistema.preco) || 0,
                total: Number(sistema.preco) || 0,
                formula: "1 sistema por porta"
            });
        }

        obterTrilhosSelecionados().forEach((trilhoSelecionado) => {
            if (typeof calcularLinhaTrilhoPorMetroLinear === "function") {
                componentes.linhas.push(calcularLinhaTrilhoPorMetroLinear(trilhoSelecionado, medidas, tipo));
                return;
            }

            const trilho = trilhoSelecionado.material;
            const comprimentoM = calcularComprimentoTrilhoSelecionado(trilhoSelecionado, medidas, tipo);
            const calculo = calcularTotalMaterialPorta(trilho, medidas, { comprimentoM, base: "largura" });
            componentes.linhas.push({
                categoria: `trilho_${trilhoSelecionado.posicao}`,
                item: trilho,
                nome: `Trilho ${trilhoSelecionado.label} (${trilho.nome})`,
                quantidade: calculo.quantidade,
                unidade: "m",
                unitario: Number(trilho.preco) || 0,
                total: calculo.total,
                formula: calcularComprimentoTrilhoSelecionado ? obterFormulaTrilhoSelecionado(trilhoSelecionado, medidas, tipo) : "metro linear"
            });
        });
    }

    const puxadorInfo = obterDadosPuxador();
    if (puxadorInfo && !puxadorInfo.ehPerfil) {
        componentes.linhas.push({
            categoria: "puxador",
            item: puxadorInfo.puxador,
            nome: `Puxador (${puxadorInfo.puxador.nome})`,
            quantidade: puxadorInfo.quantidade,
            unidade: puxadorInfo.tipoMedida === "metro_linear" ? "m" : "un",
            unitario: Number(puxadorInfo.puxador.preco) || 0,
            total: (Number(puxadorInfo.puxador.preco) || 0) * puxadorInfo.quantidade,
            formula: puxadorInfo.tipoMedida === "metro_linear" ? "medida do puxador ÷ 1000" : "1 unidade por porta"
        });
    }

    const tagAplicada = calcularTagAplicada(obterTagCorrespondente(), medidas);
    if (tagAplicada) {
        componentes.linhas.push({
            categoria: "tag",
            item: tagAplicada.tag,
            nome: "Tag aplicada",
            quantidade: tagAplicada.quantidade,
            unidade: tagAplicada.tag.medida === "m2" ? "m²" : (tagAplicada.tag.medida === "perimetro" ? "m" : "un"),
            unitario: Number(tagAplicada.tag.valor) || 0,
            total: tagAplicada.total,
            formula: "regra da tag aplicada"
        });
    }

    if (valorAdicional > 0) {
        componentes.linhas.push({
            categoria: "adicional",
            item: null,
            nome: "Valor adicional",
            quantidade: 1,
            unidade: "un",
            unitario: valorAdicional,
            total: valorAdicional,
            formula: "valor manual"
        });
    }

    return componentes;
}

function calcularPrecoPorta() {
    const quantidadePortas = +document.getElementById("quantidade")?.value || 1;
    const componentes = calcularComponentesPortaAtual();
    const totalPorPorta = componentes.linhas.reduce((acc, linha) => acc + (Number(linha.total) || 0), 0);
    return totalPorPorta * quantidadePortas;
}

function atualizarPrecoPortaPuxadorPerfilFix() {
    const preco = calcularPrecoPorta();
    const precoEl = document.getElementById("precoPorta");
    if (precoEl) precoEl.textContent = `Preço estimado: R$ ${preco.toFixed(2)}`;
    if (typeof atualizarDetalhesCusto === "function") atualizarDetalhesCusto();
    if (typeof renderizarConferenciaCalculoPorta === "function") renderizarConferenciaCalculoPorta();
    if (typeof renderizarPorta3D === "function") renderizarPorta3D();
}

function atualizarPuxadorTipo() {
    const puxador = obterPuxadorSelecionado();
    const medidaInput = document.getElementById("medida_puxador");
    if (!medidaInput) return;

    if (!puxador || document.getElementById("puxador")?.value === "sem_puxador") {
        medidaInput.disabled = true;
        medidaInput.value = "0";
        return;
    }

    if (puxadorEhPerfil(puxador)) {
        medidaInput.disabled = true;
        medidaInput.value = "0";
        atualizarPrecoPortaPuxadorPerfilFix();
        return;
    }

    if (puxador.tipo_medida === "metro_linear") {
        medidaInput.disabled = false;
    } else {
        medidaInput.disabled = true;
        medidaInput.value = "0";
    }
}

window.normalizarTipoMedidaPuxador = normalizarTipoMedidaPuxador;
window.puxadorEhPerfil = puxadorEhPerfil;
window.atualizarPuxadoresSelect = atualizarPuxadoresSelect;
window.obterPuxadorSelecionado = obterPuxadorSelecionado;
window.obterDadosPuxador = obterDadosPuxador;
window.calcularComponentesPortaAtual = calcularComponentesPortaAtual;
window.calcularPrecoPorta = calcularPrecoPorta;
window.atualizarPrecoPorta = atualizarPrecoPortaPuxadorPerfilFix;
window.atualizarPuxadorTipo = atualizarPuxadorTipo;

document.addEventListener("change", (ev) => {
    if (["puxador", "puxador_posicao", "perfil", "largura", "altura"].includes(ev.target?.id)) {
        atualizarPrecoPortaPuxadorPerfilFix();
    }
}, true);

document.addEventListener("input", (ev) => {
    if (["largura", "altura"].includes(ev.target?.id)) {
        atualizarPrecoPortaPuxadorPerfilFix();
    }
}, true);
