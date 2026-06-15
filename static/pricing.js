// =====================
// PREÇO / REGRAS
// =====================
function obterDadosPuxador() {
    const puxadorId = document.getElementById("puxador")?.value;
    if (!puxadorId || puxadorId === "sem_puxador") return null;
    const puxador = todosPuxadores.find(p => p.id == puxadorId);
    if (!puxador) return null;

    const tipoMedida = puxador.tipo_medida;
    const medidaPuxadorMm = +document.getElementById("medida_puxador")?.value || 0;

    let quantidade = 0;
    if (tipoMedida === "metro_linear") {
        quantidade = medidaPuxadorMm / 1000;
    } else {
        // Quantidade por porta. A quantidade total de portas é aplicada só no final.
        quantidade = 1;
    }

    return {
        puxador,
        tipoMedida,
        quantidade,
        medidaPuxadorMm
    };
}

function normalizarTagValor(valor) {
    return String(valor || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function normalizarChaveInsumo(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "")
        .trim();
}

function extrairReferenciaInsumo(valor) {
    if (valor == null) return "";
    if (typeof valor === "object") {
        return valor.nome ?? valor.name ?? valor.id ?? valor.codigo ?? valor.codigo_interno ?? "";
    }
    return valor;
}

function encontrarInsumoDoPerfil(referencia) {
    if (!Array.isArray(todosInsumos) || todosInsumos.length === 0) return null;

    const textoOriginal = String(extrairReferenciaInsumo(referencia) ?? "").trim();
    if (!textoOriginal) return null;

    const matchDireto = todosInsumos.find((insumo) =>
        String(insumo.nome ?? "").trim() === textoOriginal ||
        String(insumo.id ?? "").trim() === textoOriginal ||
        String(insumo.codigo ?? "").trim() === textoOriginal ||
        String(insumo.codigo_interno ?? "").trim() === textoOriginal
    );
    if (matchDireto) return matchDireto;

    const chave = normalizarChaveInsumo(textoOriginal);
    if (!chave) return null;

    const matchNormalizado = todosInsumos.find((insumo) =>
        normalizarChaveInsumo(insumo.nome) === chave ||
        normalizarChaveInsumo(insumo.id) === chave ||
        normalizarChaveInsumo(insumo.codigo) === chave ||
        normalizarChaveInsumo(insumo.codigo_interno) === chave
    );
    if (matchNormalizado) return matchNormalizado;

    return todosInsumos.find((insumo) => {
        const nome = normalizarChaveInsumo(insumo.nome);
        return nome && (nome.includes(chave) || chave.includes(nome));
    }) || null;
}

function obterInsumosDoPerfil(perfil) {
    const referencias = Array.isArray(perfil?.insumos) ? perfil.insumos : [];
    return referencias
        .map((referencia) => encontrarInsumoDoPerfil(referencia))
        .filter(Boolean);
}

function obterTipoPortaAtual() {
    return document.getElementById("tipologia")?.value || "";
}

function obterSistemaSelecionado() {
    const sistemaId = document.getElementById("sistemas")?.value;
    if (!sistemaId) return null;
    if (typeof sistemasLista === "undefined" || !Array.isArray(sistemasLista)) return null;
    return sistemasLista.find((sistema) => String(sistema.id) === String(sistemaId)) || null;
}

function numeroCampoMm(id) {
    const valor = document.getElementById(id)?.value;
    const numero = Number(String(valor ?? "").replace(",", "."));
    return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function calcularComprimentoTrilhoSelecionado(trilhoSelecionado, medidas, tipo) {
    if (tipo === "deslizante") {
        const vaoSuperiorM = numeroCampoMm("vao_trilhos_superior") / 1000;
        const vaoInferiorM = numeroCampoMm("vao_trilhos_inferior") / 1000;
        if (trilhoSelecionado.posicao === "superior") {
            return medidas.larguraM + vaoSuperiorM;
        }
        if (trilhoSelecionado.posicao === "inferior") {
            return medidas.larguraM + vaoInferiorM;
        }
    }

    return medidas.larguraM;
}

function obterFormulaTrilhoSelecionado(trilhoSelecionado, medidas, tipo) {
    if (tipo === "deslizante") {
        if (trilhoSelecionado.posicao === "superior") {
            return `${medidas.larguraM.toFixed(3)}m largura + ${(numeroCampoMm("vao_trilhos_superior") / 1000).toFixed(3)}m vão superior`;
        }
        if (trilhoSelecionado.posicao === "inferior") {
            return `${medidas.larguraM.toFixed(3)}m largura + ${(numeroCampoMm("vao_trilhos_inferior") / 1000).toFixed(3)}m vão inferior`;
        }
    }
    return "largura da porta";
}

function calcularQuantidadeMaterialPorta(material, medidas, contexto = {}) {
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

function calcularTotalMaterialPorta(material, medidas, contexto = {}) {
    const quantidade = calcularQuantidadeMaterialPorta(material, medidas, contexto);
    return {
        material,
        quantidade,
        total: (Number(material?.preco) || 0) * quantidade
    };
}

function obterTrilhosSelecionados() {
    const referencias = [
        {
            posicao: "superior",
            label: "superior",
            referencia: document.getElementById("trilhos_superior")?.value
        },
        {
            posicao: "inferior",
            label: "inferior",
            referencia: document.getElementById("trilhos_inferior")?.value
        }
    ].filter((item) => item.referencia);

    return referencias
        .map((item) => ({
            ...item,
            material: encontrarInsumoDoPerfil(item.referencia)
        }))
        .filter((item) => item.material);
}

function calcularComponentesPortaAtual() {
    const medidas = calcularMedidasPorta();
    const tipo = obterTipoPortaAtual();
    const perfil = todosPerfis.find(p => p.id == document.getElementById("perfil")?.value);
    const vidro = todosVidros.find(v => v.id == document.getElementById("vidro")?.value);
    const sistema = obterSistemaSelecionado();
    const valorAdicional = +document.getElementById("valor_adicional")?.value || 0;

    const componentes = {
        tipo,
        medidas,
        perfil,
        vidro,
        sistema,
        linhas: []
    };

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
            const trilho = trilhoSelecionado.material;
            const comprimentoM = calcularComprimentoTrilhoSelecionado(trilhoSelecionado, medidas, tipo);
            const calculo = calcularTotalMaterialPorta(trilho, medidas, { comprimentoM, base: "largura" });
            const unidade = trilho.tipo_medida === "metro_linear" ? "m" : (trilho.tipo_medida === "m2" ? "m²" : "un");
            componentes.linhas.push({
                categoria: `trilho_${trilhoSelecionado.posicao}`,
                item: trilho,
                nome: `Trilho ${trilhoSelecionado.label} (${trilho.nome})`,
                quantidade: calculo.quantidade,
                unidade,
                unitario: Number(trilho.preco) || 0,
                total: calculo.total,
                formula: unidade === "m"
                    ? obterFormulaTrilhoSelecionado(trilhoSelecionado, medidas, tipo)
                    : "1 unidade por porta"
            });
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

function obterTagCorrespondente() {
    const perfil = todosPerfis.find(p => p.id == document.getElementById("perfil")?.value);
    const vidro = todosVidros.find(v => v.id == document.getElementById("vidro")?.value);

    if (!perfil || !vidro || !Array.isArray(todasTags) || todasTags.length === 0) return null;

    const perfilIdKey = String(perfil.id);
    const vidroIdKey = String(vidro.id);

    const espessura = String(vidro.espessura || "").trim();
    const vidroKeys = [
        [vidro.tipo, espessura].filter(Boolean).join(" - "),
        [vidro.tipo, espessura].filter(Boolean).join(" "),
        [vidro.tipo, espessura ? `${espessura}mm` : ""].filter(Boolean).join(" "),
        vidro.tipo
    ].filter(Boolean).map(normalizarTagValor);

    const match = todasTags.find((tag) => {
        const perfisTagRaw = tag.perfis != null ? String(tag.perfis) : "";
        const vidrosTagRaw = tag.vidros != null ? String(tag.vidros) : "";
        const tagsArr = Array.isArray(tag.tags) ? tag.tags.map(normalizarTagValor) : [];

        const matchesPerfis = perfisTagRaw ? perfisTagRaw === perfilIdKey : true;
        const vidrosTagNorm = normalizarTagValor(vidrosTagRaw);
        const matchesVidros = vidrosTagRaw
            ? (vidrosTagRaw === vidroIdKey || vidroKeys.includes(vidrosTagNorm))
            : true;

        const strongMatch = (perfisTagRaw || vidrosTagRaw) && matchesPerfis && matchesVidros;
        const weakMatch =
            tagsArr.includes(perfilIdKey) &&
            (tagsArr.includes(vidroIdKey) || vidroKeys.some(k => tagsArr.includes(k)));

        return strongMatch || weakMatch;
    }) || null;

    return match;
}

function calcularMedidasPorta() {
    const larguraMm = +document.getElementById("largura")?.value || 0;
    const alturaMm = +document.getElementById("altura")?.value || 0;
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

function calcularTagAplicada(tag, medidas) {
    if (!tag || !tag.valor || !medidas) return null;
    let quantidade = 0;
    if (tag.medida === "m2") {
        quantidade = medidas.area;
    } else if (tag.medida === "perimetro") {
        quantidade = medidas.perimetro;
    } else if (tag.medida === "unidade") {
        quantidade = 1;
    }
    if (!quantidade) return null;
    const valorUnitario = Number(tag.valor) || 0;
    return {
        tag,
        quantidade,
        total: valorUnitario * quantidade
    };
}

function calcularPrecoPorta() {
    const quantidadePortas = +document.getElementById("quantidade")?.value || 1;
    const componentes = calcularComponentesPortaAtual();
    const totalPorPorta = componentes.linhas.reduce((acc, linha) => acc + (Number(linha.total) || 0), 0);
    return totalPorPorta * quantidadePortas;
}

window.obterDadosPuxador = obterDadosPuxador;
window.normalizarTagValor = normalizarTagValor;
window.normalizarChaveInsumo = normalizarChaveInsumo;
window.encontrarInsumoDoPerfil = encontrarInsumoDoPerfil;
window.obterInsumosDoPerfil = obterInsumosDoPerfil;
window.obterTipoPortaAtual = obterTipoPortaAtual;
window.obterSistemaSelecionado = obterSistemaSelecionado;
window.numeroCampoMm = numeroCampoMm;
window.calcularComprimentoTrilhoSelecionado = calcularComprimentoTrilhoSelecionado;
window.obterFormulaTrilhoSelecionado = obterFormulaTrilhoSelecionado;
window.calcularQuantidadeMaterialPorta = calcularQuantidadeMaterialPorta;
window.calcularTotalMaterialPorta = calcularTotalMaterialPorta;
window.obterTrilhosSelecionados = obterTrilhosSelecionados;
window.calcularComponentesPortaAtual = calcularComponentesPortaAtual;
window.obterTagCorrespondente = obterTagCorrespondente;
window.calcularMedidasPorta = calcularMedidasPorta;
window.calcularTagAplicada = calcularTagAplicada;
window.calcularPrecoPorta = calcularPrecoPorta;
