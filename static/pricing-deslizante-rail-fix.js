// =====================
// CORREÇÃO DO CÁLCULO DOS TRILHOS DESLIZANTES
// Campo vão é digitado em mm e convertido para metro linear.
// Ex: 3000 mm = 3,000 m de trilho.
// Para deslizante, trilho = vão em metros, NÃO largura + vão.
// =====================

function calcularComprimentoTrilhoSelecionado(trilhoSelecionado, medidas, tipo) {
    if (tipo === "deslizante") {
        const vaoSuperiorM = numeroCampoMm("vao_trilhos_superior") / 1000;
        const vaoInferiorM = numeroCampoMm("vao_trilhos_inferior") / 1000;

        if (trilhoSelecionado.posicao === "superior") return vaoSuperiorM;
        if (trilhoSelecionado.posicao === "inferior") return vaoInferiorM;
    }

    return medidas.larguraM;
}

function obterFormulaTrilhoSelecionado(trilhoSelecionado, medidas, tipo) {
    if (tipo === "deslizante") {
        if (trilhoSelecionado.posicao === "superior") {
            return `${numeroCampoMm("vao_trilhos_superior").toFixed(0)} mm ÷ 1000`;
        }
        if (trilhoSelecionado.posicao === "inferior") {
            return `${numeroCampoMm("vao_trilhos_inferior").toFixed(0)} mm ÷ 1000`;
        }
    }

    return "largura da porta";
}

function calcularLinhaTrilhoPorMetroLinear(trilhoSelecionado, medidas, tipo) {
    const trilho = trilhoSelecionado.material;
    const comprimentoM = calcularComprimentoTrilhoSelecionado(trilhoSelecionado, medidas, tipo);
    const precoMetro = Number(trilho?.preco) || 0;

    return {
        categoria: `trilho_${trilhoSelecionado.posicao}`,
        item: trilho,
        nome: `Trilho ${trilhoSelecionado.label} (${trilho?.nome || trilhoSelecionado.referencia || "não encontrado"})`,
        quantidade: comprimentoM,
        unidade: "m",
        unitario: precoMetro,
        total: precoMetro * comprimentoM,
        formula: obterFormulaTrilhoSelecionado(trilhoSelecionado, medidas, tipo)
    };
}

function calcularComponentesPortaAtual() {
    const medidas = calcularMedidasPorta();
    const tipo = obterTipoPortaAtual();
    const perfil = todosPerfis.find(p => p.id == document.getElementById("perfil")?.value);
    const vidro = todosVidros.find(v => v.id == document.getElementById("vidro")?.value);
    const sistema = obterSistemaSelecionado();
    const valorAdicional = +document.getElementById("valor_adicional")?.value || 0;

    const componentes = { tipo, medidas, perfil, vidro, sistema, linhas: [] };

    if (perfil) {
        componentes.linhas.push({
            categoria: "perfil",
            item: perfil,
            nome: `Perfil (${perfil.nome})`,
            quantidade: medidas.perimetro,
            unidade: "m",
            unitario: Number(perfil.preco) || 0,
            total: (Number(perfil.preco) || 0) * medidas.perimetro,
            formula: `2 × (${medidas.larguraM.toFixed(3)} + ${medidas.alturaM.toFixed(3)})`
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
            // Deslizante: trilho sempre em metro linear do vão em mm / 1000.
            if (tipo === "deslizante") {
                componentes.linhas.push(calcularLinhaTrilhoPorMetroLinear(trilhoSelecionado, medidas, tipo));
                return;
            }

            // Correr: por enquanto mantém largura da porta em metro linear.
            componentes.linhas.push(calcularLinhaTrilhoPorMetroLinear(trilhoSelecionado, medidas, tipo));
        });
    }

    const puxadorInfo = obterDadosPuxador();
    if (puxadorInfo) {
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

function atualizarPrecoPortaDeslizanteFix() {
    const preco = calcularPrecoPorta();
    const precoEl = document.getElementById("precoPorta");
    if (precoEl) precoEl.textContent = `Preço estimado: R$ ${preco.toFixed(2)}`;
    if (typeof atualizarDetalhesCusto === "function") atualizarDetalhesCusto();
    if (typeof renderizarConferenciaCalculoPorta === "function") renderizarConferenciaCalculoPorta();
    if (typeof renderizarPorta3D === "function") renderizarPorta3D();
}

window.calcularComprimentoTrilhoSelecionado = calcularComprimentoTrilhoSelecionado;
window.obterFormulaTrilhoSelecionado = obterFormulaTrilhoSelecionado;
window.calcularLinhaTrilhoPorMetroLinear = calcularLinhaTrilhoPorMetroLinear;
window.calcularComponentesPortaAtual = calcularComponentesPortaAtual;
window.calcularPrecoPorta = calcularPrecoPorta;
window.atualizarPrecoPorta = atualizarPrecoPortaDeslizanteFix;

document.addEventListener("input", (ev) => {
    if (["vao_trilhos_superior", "vao_trilhos_inferior", "trilhos_superior", "trilhos_inferior", "sistemas"].includes(ev.target?.id)) {
        atualizarPrecoPortaDeslizanteFix();
    }
}, true);

document.addEventListener("change", (ev) => {
    if (["vao_trilhos_superior", "vao_trilhos_inferior", "trilhos_superior", "trilhos_inferior", "sistemas"].includes(ev.target?.id)) {
        atualizarPrecoPortaDeslizanteFix();
    }
}, true);
