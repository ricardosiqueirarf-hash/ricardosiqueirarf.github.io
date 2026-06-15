// =====================
// NORMALIZAÇÃO DOS INSUMOS DO PERFIL
// Garante que perfil.insumos encontre materiais mesmo com variações de texto.
// Ex: BA02 vs BA-02, CANTONEIRA 50 vs Cantoneira 50mm.
// =====================

function normalizarChaveInsumoCalculo(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "")
        .trim();
}

function extrairValorInsumoPerfilCalculo(item) {
    if (item == null) return "";
    if (typeof item === "object") {
        return item.nome ?? item.name ?? item.id ?? item.codigo ?? item.codigo_interno ?? "";
    }
    return item;
}

function encontrarMaterialPorReferenciaCalculo(referencia) {
    if (!Array.isArray(todosInsumos) || todosInsumos.length === 0) return null;

    const valorOriginal = extrairValorInsumoPerfilCalculo(referencia);
    const valorTexto = String(valorOriginal ?? "").trim();
    if (!valorTexto) return null;

    const direto = todosInsumos.find((insumo) =>
        String(insumo.nome ?? "") === valorTexto ||
        String(insumo.id ?? "") === valorTexto ||
        String(insumo.codigo ?? "") === valorTexto ||
        String(insumo.codigo_interno ?? "") === valorTexto
    );
    if (direto) return direto;

    const chave = normalizarChaveInsumoCalculo(valorTexto);
    if (!chave) return null;

    const normalizadoExato = todosInsumos.find((insumo) =>
        normalizarChaveInsumoCalculo(insumo.nome) === chave ||
        normalizarChaveInsumoCalculo(insumo.id) === chave ||
        normalizarChaveInsumoCalculo(insumo.codigo) === chave ||
        normalizarChaveInsumoCalculo(insumo.codigo_interno) === chave
    );
    if (normalizadoExato) return normalizadoExato;

    return todosInsumos.find((insumo) => {
        const nome = normalizarChaveInsumoCalculo(insumo.nome);
        return nome && (nome.includes(chave) || chave.includes(nome));
    }) || null;
}

function normalizarInsumosDosPerfisParaCalculo() {
    if (!Array.isArray(todosPerfis) || !Array.isArray(todosInsumos)) return;
    if (todosPerfis.length === 0 || todosInsumos.length === 0) return;

    todosPerfis.forEach((perfil) => {
        if (!Array.isArray(perfil.insumos)) return;

        const insumosOriginais = perfil.insumos;
        const insumosNormalizados = insumosOriginais.map((referencia) => {
            const material = encontrarMaterialPorReferenciaCalculo(referencia);
            return material?.nome || extrairValorInsumoPerfilCalculo(referencia);
        }).filter((item) => String(item ?? "").trim() !== "");

        perfil.insumos = insumosNormalizados;
        perfil.__insumos_normalizados_calculo = true;
    });
}

function atualizarFerramentaComNormalizacaoDeInsumos() {
    normalizarInsumosDosPerfisParaCalculo();

    if (typeof renderizarConferenciaCalculoPorta === "function") {
        renderizarConferenciaCalculoPorta();
    }
    if (typeof prepararCardUnificadoOrcamento === "function") {
        prepararCardUnificadoOrcamento();
    }
}

function instalarNormalizadorInsumosCalculo() {
    normalizarInsumosDosPerfisParaCalculo();

    if (typeof window.atualizarFerramentaOrcamentoAposCarga === "function" && !window.atualizarFerramentaOrcamentoAposCarga.__normalizadorInsumosWrapped) {
        const original = window.atualizarFerramentaOrcamentoAposCarga;
        const wrapped = function (...args) {
            normalizarInsumosDosPerfisParaCalculo();
            const retorno = original.apply(this, args);
            normalizarInsumosDosPerfisParaCalculo();
            return retorno;
        };
        wrapped.__normalizadorInsumosWrapped = true;
        window.atualizarFerramentaOrcamentoAposCarga = wrapped;
    }

    if (typeof window.calcularPrecoPorta === "function" && !window.calcularPrecoPorta.__normalizadorInsumosWrapped) {
        const originalCalcularPreco = window.calcularPrecoPorta;
        const wrappedCalcularPreco = function (...args) {
            normalizarInsumosDosPerfisParaCalculo();
            return originalCalcularPreco.apply(this, args);
        };
        wrappedCalcularPreco.__normalizadorInsumosWrapped = true;
        window.calcularPrecoPorta = wrappedCalcularPreco;
    }

    if (typeof window.renderizarConferenciaCalculoPorta === "function" && !window.renderizarConferenciaCalculoPorta.__normalizadorInsumosWrapped) {
        const originalRenderizar = window.renderizarConferenciaCalculoPorta;
        const wrappedRenderizar = function (...args) {
            normalizarInsumosDosPerfisParaCalculo();
            return originalRenderizar.apply(this, args);
        };
        wrappedRenderizar.__normalizadorInsumosWrapped = true;
        window.renderizarConferenciaCalculoPorta = wrappedRenderizar;
    }

    setTimeout(atualizarFerramentaComNormalizacaoDeInsumos, 300);
    setTimeout(atualizarFerramentaComNormalizacaoDeInsumos, 900);
    setTimeout(atualizarFerramentaComNormalizacaoDeInsumos, 1800);
}

window.normalizarChaveInsumoCalculo = normalizarChaveInsumoCalculo;
window.encontrarMaterialPorReferenciaCalculo = encontrarMaterialPorReferenciaCalculo;
window.normalizarInsumosDosPerfisParaCalculo = normalizarInsumosDosPerfisParaCalculo;
window.instalarNormalizadorInsumosCalculo = instalarNormalizadorInsumosCalculo;

document.addEventListener("DOMContentLoaded", instalarNormalizadorInsumosCalculo);
