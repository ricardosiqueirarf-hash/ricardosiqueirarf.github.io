// pricingEngine.js
// Motor puro de cálculo para portas ColorGlass.
// Fase 1: arquivo isolado, sem dependência de DOM e sem substituir o fluxo atual.

function toNumber(valor, fallback = 0) {
    if (valor === null || valor === undefined || valor === "") return fallback;
    const numero = Number(String(valor).replace(",", "."));
    return Number.isFinite(numero) ? numero : fallback;
}

function normalizarTexto(valor) {
    return String(valor ?? "").trim();
}

function buscarPorId(lista, id) {
    if (!Array.isArray(lista) || id === null || id === undefined || id === "") return null;
    return lista.find((item) => String(item?.id) === String(id)) || null;
}

export function normalizarTagValor(valor) {
    return String(valor || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

export function normalizarChaveInsumo(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "")
        .trim();
}

export function extrairReferenciaInsumo(valor) {
    if (valor == null) return "";
    if (typeof valor === "object") {
        return valor.nome ?? valor.name ?? valor.id ?? valor.codigo ?? valor.codigo_interno ?? "";
    }
    return valor;
}

export function encontrarInsumoDoPerfil(referencia, insumos = []) {
    if (!Array.isArray(insumos) || insumos.length === 0) return null;

    const textoOriginal = normalizarTexto(extrairReferenciaInsumo(referencia));
    if (!textoOriginal) return null;

    const matchDireto = insumos.find((insumo) =>
        normalizarTexto(insumo?.nome) === textoOriginal ||
        normalizarTexto(insumo?.id) === textoOriginal ||
        normalizarTexto(insumo?.codigo) === textoOriginal ||
        normalizarTexto(insumo?.codigo_interno) === textoOriginal
    );
    if (matchDireto) return matchDireto;

    const chave = normalizarChaveInsumo(textoOriginal);
    if (!chave) return null;

    const matchNormalizado = insumos.find((insumo) =>
        normalizarChaveInsumo(insumo?.nome) === chave ||
        normalizarChaveInsumo(insumo?.id) === chave ||
        normalizarChaveInsumo(insumo?.codigo) === chave ||
        normalizarChaveInsumo(insumo?.codigo_interno) === chave
    );
    if (matchNormalizado) return matchNormalizado;

    return insumos.find((insumo) => {
        const nome = normalizarChaveInsumo(insumo?.nome);
        return nome && (nome.includes(chave) || chave.includes(nome));
    }) || null;
}

export function obterInsumosDoPerfil(perfil, insumos = []) {
    const referencias = Array.isArray(perfil?.insumos) ? perfil.insumos : [];
    return referencias
        .map((referencia) => encontrarInsumoDoPerfil(referencia, insumos))
        .filter(Boolean);
}

export function calcularMedidasPorta(porta = {}) {
    const dados = porta.dados || porta;
    const larguraMm = toNumber(dados.largura ?? porta.largura, 0);
    const alturaMm = toNumber(dados.altura ?? porta.altura, 0);
    const larguraM = larguraMm / 1000;
    const alturaM = alturaMm / 1000;

    return {
        larguraMm,
        alturaMm,
        larguraM,
        alturaM,
        area: larguraM * alturaM,
        perimetro: 2 * (larguraM + alturaM)
    };
}

export function calcularQuantidadeMaterialPorta(material, medidas, contexto = {}) {
    const tipo = material?.tipo_medida;
    if (tipo === "metro_linear") {
        if (Number.isFinite(contexto.comprimentoM)) return contexto.comprimentoM;
        if (contexto.base === "largura") return medidas.larguraM;
        return medidas.perimetro;
    }
    if (tipo === "m2") return medidas.area;
    if (tipo === "unidade") return 1;
    return 0;
}

export function calcularTotalMaterialPorta(material, medidas, contexto = {}) {
    const quantidade = calcularQuantidadeMaterialPorta(material, medidas, contexto);
    return {
        material,
        quantidade,
        total: (toNumber(material?.preco, 0)) * quantidade
    };
}

export function calcularComprimentoTrilhoSelecionado(trilhoSelecionado, medidas, tipo, dados = {}) {
    if (tipo === "deslizante") {
        const vaoSuperiorM = toNumber(dados.vao_trilhos_superior, 0) / 1000;
        const vaoInferiorM = toNumber(dados.vao_trilhos_inferior, 0) / 1000;
        if (trilhoSelecionado.posicao === "superior") return medidas.larguraM + vaoSuperiorM;
        if (trilhoSelecionado.posicao === "inferior") return medidas.larguraM + vaoInferiorM;
    }
    return medidas.larguraM;
}

export function obterFormulaTrilhoSelecionado(trilhoSelecionado, medidas, tipo, dados = {}) {
    if (tipo === "deslizante") {
        if (trilhoSelecionado.posicao === "superior") {
            return `${medidas.larguraM.toFixed(3)}m largura + ${(toNumber(dados.vao_trilhos_superior, 0) / 1000).toFixed(3)}m vão superior`;
        }
        if (trilhoSelecionado.posicao === "inferior") {
            return `${medidas.larguraM.toFixed(3)}m largura + ${(toNumber(dados.vao_trilhos_inferior, 0) / 1000).toFixed(3)}m vão inferior`;
        }
    }
    return "largura da porta";
}

export function obterTrilhosSelecionados(porta = {}, contexto = {}) {
    const dados = porta.dados || {};
    const insumos = contexto.insumos || contexto.todosInsumos || [];
    const referencias = [
        { posicao: "superior", label: "superior", referencia: dados.trilhos_superior },
        { posicao: "inferior", label: "inferior", referencia: dados.trilhos_inferior }
    ].filter((item) => item.referencia);

    return referencias
        .map((item) => ({ ...item, material: encontrarInsumoDoPerfil(item.referencia, insumos) }))
        .filter((item) => item.material);
}

export function obterDadosPuxador(porta = {}, contexto = {}) {
    const dados = porta.dados || {};
    const puxadorId = dados.puxador;
    if (!puxadorId || puxadorId === "sem_puxador") return null;

    const puxadores = contexto.puxadores || contexto.todosPuxadores || [];
    const puxador = buscarPorId(puxadores, puxadorId);
    if (!puxador) return null;

    const tipoMedida = puxador.tipo_medida;
    const medidaPuxadorMm = toNumber(dados.medida_puxador, 0);
    const quantidade = tipoMedida === "metro_linear" ? medidaPuxadorMm / 1000 : 1;

    return { puxador, tipoMedida, quantidade, medidaPuxadorMm };
}

export function calcularTagAplicada(tag, medidas) {
    if (!tag || !tag.valor || !medidas) return null;

    let quantidade = 0;
    if (tag.medida === "m2") quantidade = medidas.area;
    else if (tag.medida === "perimetro") quantidade = medidas.perimetro;
    else if (tag.medida === "unidade") quantidade = 1;

    if (!quantidade) return null;
    const valorUnitario = toNumber(tag.valor, 0);
    return { tag, quantidade, total: valorUnitario * quantidade };
}

export function obterTagCorrespondente(porta = {}, contexto = {}) {
    const dados = porta.dados || {};
    const perfil = buscarPorId(contexto.perfis || contexto.todosPerfis || [], dados.perfil);
    const vidro = buscarPorId(contexto.vidros || contexto.todosVidros || [], dados.vidro);
    const tags = contexto.tags || contexto.todasTags || [];

    if (!perfil || !vidro || !Array.isArray(tags) || tags.length === 0) return null;

    const perfilIdKey = String(perfil.id);
    const vidroIdKey = String(vidro.id);
    const espessura = normalizarTexto(vidro.espessura);
    const vidroKeys = [
        [vidro.tipo, espessura].filter(Boolean).join(" - "),
        [vidro.tipo, espessura].filter(Boolean).join(" "),
        [vidro.tipo, espessura ? `${espessura}mm` : ""].filter(Boolean).join(" "),
        vidro.tipo
    ].filter(Boolean).map(normalizarTagValor);

    return tags.find((tag) => {
        const perfisTagRaw = tag.perfis != null ? String(tag.perfis) : "";
        const vidrosTagRaw = tag.vidros != null ? String(tag.vidros) : "";
        const tagsArr = Array.isArray(tag.tags) ? tag.tags.map(normalizarTagValor) : [];
        const matchesPerfis = perfisTagRaw ? perfisTagRaw === perfilIdKey : true;
        const vidrosTagNorm = normalizarTagValor(vidrosTagRaw);
        const matchesVidros = vidrosTagRaw ? (vidrosTagRaw === vidroIdKey || vidroKeys.includes(vidrosTagNorm)) : true;
        const strongMatch = (perfisTagRaw || vidrosTagRaw) && matchesPerfis && matchesVidros;
        const weakMatch = tagsArr.includes(perfilIdKey) && (tagsArr.includes(vidroIdKey) || vidroKeys.some(k => tagsArr.includes(k)));
        return strongMatch || weakMatch;
    }) || null;
}

function criarLinha({ categoria, item, nome, quantidade, unidade, unitario, total, formula }) {
    return {
        categoria,
        item,
        nome,
        quantidade: toNumber(quantidade, 0),
        unidade,
        unitario: toNumber(unitario, 0),
        total: toNumber(total, 0),
        formula: formula || ""
    };
}

export function calcularComponentesPorta(porta = {}, contexto = {}) {
    const dados = porta.dados || {};
    const tipo = porta.tipo || dados.tipo || "";
    const medidas = calcularMedidasPorta(porta);
    const perfis = contexto.perfis || contexto.todosPerfis || [];
    const vidros = contexto.vidros || contexto.todosVidros || [];
    const sistemas = contexto.sistemas || contexto.sistemasLista || [];
    const insumos = contexto.insumos || contexto.todosInsumos || [];

    const perfil = buscarPorId(perfis, dados.perfil);
    const vidro = buscarPorId(vidros, dados.vidro);
    const sistema = buscarPorId(sistemas, dados.sistemas);
    const valorAdicional = toNumber(dados.valor_adicional, 0);

    const componentes = { tipo, medidas, perfil, vidro, sistema, linhas: [] };

    if (perfil) {
        componentes.linhas.push(criarLinha({
            categoria: "perfil",
            item: perfil,
            nome: `Perfil (${perfil.nome})`,
            quantidade: medidas.perimetro,
            unidade: "m",
            unitario: perfil.preco,
            total: toNumber(perfil.preco, 0) * medidas.perimetro,
            formula: `2 × (${medidas.larguraM.toFixed(3)} + ${medidas.alturaM.toFixed(3)})`
        }));
    }

    if (vidro) {
        componentes.linhas.push(criarLinha({
            categoria: "vidro",
            item: vidro,
            nome: `Vidro (${vidro.tipo}${vidro.espessura ? ` ${vidro.espessura}mm` : ""})`,
            quantidade: medidas.area,
            unidade: "m²",
            unitario: vidro.preco,
            total: toNumber(vidro.preco, 0) * medidas.area,
            formula: `${medidas.larguraM.toFixed(3)} × ${medidas.alturaM.toFixed(3)}`
        }));
    }

    obterInsumosDoPerfil(perfil, insumos).forEach((insumo) => {
        const calculo = calcularTotalMaterialPorta(insumo, medidas);
        const unidade = insumo.tipo_medida === "metro_linear" ? "m" : (insumo.tipo_medida === "m2" ? "m²" : "un");
        componentes.linhas.push(criarLinha({
            categoria: "insumo_perfil",
            item: insumo,
            nome: `Insumo do perfil (${insumo.nome})`,
            quantidade: calculo.quantidade,
            unidade,
            unitario: insumo.preco,
            total: calculo.total,
            formula: unidade === "m" ? "perímetro da porta" : "1 unidade por porta"
        }));
    });

    if (tipo === "deslizante" || tipo === "correr") {
        if (sistema) {
            componentes.linhas.push(criarLinha({
                categoria: "sistema",
                item: sistema,
                nome: `Sistema (${sistema.nome})`,
                quantidade: 1,
                unidade: "un",
                unitario: sistema.preco,
                total: sistema.preco,
                formula: "1 sistema por porta"
            }));
        }

        obterTrilhosSelecionados(porta, contexto).forEach((trilhoSelecionado) => {
            const trilho = trilhoSelecionado.material;
            const comprimentoM = calcularComprimentoTrilhoSelecionado(trilhoSelecionado, medidas, tipo, dados);
            const calculo = calcularTotalMaterialPorta(trilho, medidas, { comprimentoM, base: "largura" });
            const unidade = trilho.tipo_medida === "metro_linear" ? "m" : (trilho.tipo_medida === "m2" ? "m²" : "un");
            componentes.linhas.push(criarLinha({
                categoria: `trilho_${trilhoSelecionado.posicao}`,
                item: trilho,
                nome: `Trilho ${trilhoSelecionado.label} (${trilho.nome})`,
                quantidade: calculo.quantidade,
                unidade,
                unitario: trilho.preco,
                total: calculo.total,
                formula: unidade === "m" ? obterFormulaTrilhoSelecionado(trilhoSelecionado, medidas, tipo, dados) : "1 unidade por porta"
            }));
        });
    }

    const puxadorInfo = obterDadosPuxador(porta, contexto);
    if (puxadorInfo) {
        componentes.linhas.push(criarLinha({
            categoria: "puxador",
            item: puxadorInfo.puxador,
            nome: `Puxador (${puxadorInfo.puxador.nome})`,
            quantidade: puxadorInfo.quantidade,
            unidade: puxadorInfo.tipoMedida === "metro_linear" ? "m" : "un",
            unitario: puxadorInfo.puxador.preco,
            total: toNumber(puxadorInfo.puxador.preco, 0) * puxadorInfo.quantidade,
            formula: puxadorInfo.tipoMedida === "metro_linear" ? "medida do puxador ÷ 1000" : "1 unidade por porta"
        }));
    }

    const tagAplicada = calcularTagAplicada(obterTagCorrespondente(porta, contexto), medidas);
    if (tagAplicada) {
        componentes.linhas.push(criarLinha({
            categoria: "tag",
            item: tagAplicada.tag,
            nome: "Tag aplicada",
            quantidade: tagAplicada.quantidade,
            unidade: tagAplicada.tag.medida === "m2" ? "m²" : (tagAplicada.tag.medida === "perimetro" ? "m" : "un"),
            unitario: tagAplicada.tag.valor,
            total: tagAplicada.total,
            formula: "regra da tag aplicada"
        }));
    }

    if (valorAdicional > 0) {
        componentes.linhas.push(criarLinha({
            categoria: "adicional",
            item: null,
            nome: "Valor adicional",
            quantidade: 1,
            unidade: "un",
            unitario: valorAdicional,
            total: valorAdicional,
            formula: "valor manual"
        }));
    }

    return componentes;
}

export function calcularPrecoPorta(porta = {}, contexto = {}) {
    const quantidadePortas = toNumber(porta.quantidade ?? porta.dados?.quantidade, 1) || 1;
    const componentes = calcularComponentesPorta(porta, contexto);
    const totalPorPorta = componentes.linhas.reduce((acc, linha) => acc + toNumber(linha.total, 0), 0);
    return totalPorPorta * quantidadePortas;
}

export function calcularPorta(porta = {}, contexto = {}) {
    const componentes = calcularComponentesPorta(porta, contexto);
    const quantidade = toNumber(porta.quantidade ?? porta.dados?.quantidade, 1) || 1;
    const totalPorPorta = componentes.linhas.reduce((acc, linha) => acc + toNumber(linha.total, 0), 0);
    const precoTotal = totalPorPorta * quantidade;

    return {
        tipo: componentes.tipo,
        quantidade,
        medidas: componentes.medidas,
        componentes: componentes.linhas,
        totalPorPorta,
        precoUnitario: totalPorPorta,
        precoTotal,
        contexto: {
            perfil: componentes.perfil,
            vidro: componentes.vidro,
            sistema: componentes.sistema
        }
    };
}

export default {
    normalizarTagValor,
    normalizarChaveInsumo,
    extrairReferenciaInsumo,
    encontrarInsumoDoPerfil,
    obterInsumosDoPerfil,
    calcularMedidasPorta,
    calcularQuantidadeMaterialPorta,
    calcularTotalMaterialPorta,
    calcularComprimentoTrilhoSelecionado,
    obterFormulaTrilhoSelecionado,
    obterTrilhosSelecionados,
    obterDadosPuxador,
    calcularTagAplicada,
    obterTagCorrespondente,
    calcularComponentesPorta,
    calcularPrecoPorta,
    calcularPorta
};
