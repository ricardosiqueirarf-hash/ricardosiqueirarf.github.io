// =====================
// CORREÇÃO DO CÁLCULO DOS TRILHOS DESLIZANTES
// Para deslizante, o campo vão superior/inferior representa o ML do trilho.
// Não soma largura da porta + vão.
// =====================

function calcularComprimentoTrilhoSelecionado(trilhoSelecionado, medidas, tipo) {
    if (tipo === "deslizante") {
        const vaoSuperiorM = numeroCampoMm("vao_trilhos_superior") / 1000;
        const vaoInferiorM = numeroCampoMm("vao_trilhos_inferior") / 1000;

        if (trilhoSelecionado.posicao === "superior") {
            return vaoSuperiorM;
        }
        if (trilhoSelecionado.posicao === "inferior") {
            return vaoInferiorM;
        }
    }

    // Para correr, mantém largura da porta por enquanto.
    return medidas.larguraM;
}

function obterFormulaTrilhoSelecionado(trilhoSelecionado, medidas, tipo) {
    if (tipo === "deslizante") {
        if (trilhoSelecionado.posicao === "superior") {
            return `${(numeroCampoMm("vao_trilhos_superior") / 1000).toFixed(3)}m vão superior`;
        }
        if (trilhoSelecionado.posicao === "inferior") {
            return `${(numeroCampoMm("vao_trilhos_inferior") / 1000).toFixed(3)}m vão inferior`;
        }
    }

    return "largura da porta";
}

window.calcularComprimentoTrilhoSelecionado = calcularComprimentoTrilhoSelecionado;
window.obterFormulaTrilhoSelecionado = obterFormulaTrilhoSelecionado;
