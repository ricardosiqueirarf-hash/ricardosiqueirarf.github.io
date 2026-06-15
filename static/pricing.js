// =====================
// PREÇO / REGRAS
// =====================
function obterDadosPuxador() {
    const puxadorId = document.getElementById("puxador")?.value;
    if (puxadorId === "sem_puxador") return null;
    const puxador = todosPuxadores.find(p => p.id == puxadorId);
    if (!puxador) return null;

    const tipoMedida = puxador.tipo_medida;
    const quantidadePortas = +document.getElementById("quantidade")?.value || 1;
    const medidaPuxadorMm = +document.getElementById("medida_puxador")?.value || 0;

    let quantidade = 0;
    if (tipoMedida === "metro_linear") {
        quantidade = medidaPuxadorMm / 1000;
    } else {
        quantidade = quantidadePortas;
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

    // DEBUG opcional
    console.group("🔍 TAG MATCHING (fix)");
    console.log("Perfil:", perfilIdKey, perfil.nome);
    console.log("Vidro:", vidroIdKey, vidro.tipo, vidro.espessura);
    console.log("VidroKeys:", vidroKeys);

    const match = todasTags.find((tag) => {
        const perfisTagRaw = tag.perfis != null ? String(tag.perfis) : "";
        const vidrosTagRaw = tag.vidros != null ? String(tag.vidros) : "";
        const tagsArr = Array.isArray(tag.tags) ? tag.tags.map(normalizarTagValor) : [];

        // 1) Match forte (por colunas perfis/vidros)
        const matchesPerfis = perfisTagRaw ? perfisTagRaw === perfilIdKey : true;

        const vidrosTagNorm = normalizarTagValor(vidrosTagRaw);
        const matchesVidros = vidrosTagRaw
            ? (vidrosTagRaw === vidroIdKey || vidroKeys.includes(vidrosTagNorm))
            : true;

        const strongMatch = (perfisTagRaw || vidrosTagRaw) && matchesPerfis && matchesVidros;

        // 2) Match fraco (apenas pelo array tags[]), NÃO bloqueia o forte
        const weakMatch =
            tagsArr.includes(perfilIdKey) &&
            (tagsArr.includes(vidroIdKey) || vidroKeys.some(k => tagsArr.includes(k)));

        const ok = strongMatch || weakMatch;

        if (ok) console.log("✅ MATCH:", tag);
        else console.log("❌ NO MATCH:", { tag, perfisTagRaw, vidrosTagRaw, tagsArr, matchesPerfis, matchesVidros, strongMatch, weakMatch });

        return ok;
    }) || null;

    console.groupEnd();
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
    const medidas = calcularMedidasPorta();
    const largura = medidas.larguraM;
    const altura = medidas.alturaM;
    const perfil = todosPerfis.find(p => p.id == document.getElementById("perfil")?.value);
    const vidro = todosVidros.find(v => v.id == document.getElementById("vidro")?.value);
    const quantidadePortas = +document.getElementById("quantidade")?.value || 1;
    const valorAdicional = +document.getElementById("valor_adicional")?.value || 0;
    const perimetro = medidas.perimetro;
    const insumos = obterInsumosDoPerfil(perfil);

    let total = 0;
    if (perfil) total += perfil.preco * 2 * (largura + altura);
    if (vidro) total += vidro.preco * largura * altura;
    insumos.forEach((insumo) => {
        const tipo = insumo.tipo_medida;
        let quantidadeInsumo = 0;
        if (tipo === "metro_linear") {
            quantidadeInsumo = perimetro;
        } else if (tipo === "unidade") {
            quantidadeInsumo = 1;
        }
        total += (insumo.preco || 0) * quantidadeInsumo;
    });

    const puxadorInfo = obterDadosPuxador();
    if (puxadorInfo) {
        total += (puxadorInfo.puxador.preco || 0) * puxadorInfo.quantidade;
    }

    const tagAplicada = calcularTagAplicada(obterTagCorrespondente(), medidas);
    if (tagAplicada) {
        total += tagAplicada.total;
    }

    total += valorAdicional;
    return total * quantidadePortas;
}

window.obterDadosPuxador = obterDadosPuxador;
window.normalizarTagValor = normalizarTagValor;
window.normalizarChaveInsumo = normalizarChaveInsumo;
window.encontrarInsumoDoPerfil = encontrarInsumoDoPerfil;
window.obterInsumosDoPerfil = obterInsumosDoPerfil;
window.obterTagCorrespondente = obterTagCorrespondente;
window.calcularMedidasPorta = calcularMedidasPorta;
window.calcularTagAplicada = calcularTagAplicada;
window.calcularPrecoPorta = calcularPrecoPorta;
