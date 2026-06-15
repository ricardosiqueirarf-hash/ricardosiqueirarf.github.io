// =====================
// CORREÇÃO DO 3D DAS PORTAS DESLIZANTES/CORRER
// Para deslizante, o vão superior/inferior é o COMPRIMENTO do trilho.
// Se o vão for 0, o trilho não aparece.
// =====================

function obterVaoTrilho3DComprimento(id) {
    const valor = document.getElementById(id)?.value;
    const numero = Number(String(valor ?? "").replace(",", "."));
    return Number.isFinite(numero) && numero > 0 ? numero / 1000 : 0;
}

function adicionarTrilhosPorta3D(group, materiais, larguraM, alturaM, vaoSuperiorM, vaoInferiorM) {
    const tipo = obterTipoPorta3D();
    if (tipo !== "correr" && tipo !== "deslizante") return;

    const trilhoAltura = 0.038;
    const trilhoProf = 0.14;
    const folgaVisual = 0.012;

    const trilhoSuperiorLargura = tipo === "deslizante"
        ? Math.max(0, vaoSuperiorM)
        : Math.max(larguraM, larguraM + Math.max(0, vaoSuperiorM));
    const trilhoInferiorLargura = tipo === "deslizante"
        ? Math.max(0, vaoInferiorM)
        : Math.max(larguraM, larguraM + Math.max(0, vaoInferiorM));

    const yTrilhoSuperior = alturaM / 2 + trilhoAltura / 2 + folgaVisual;
    const yTrilhoInferior = -alturaM / 2 - trilhoAltura / 2 - folgaVisual;

    if (trilhoSuperiorLargura > 0.005) {
        group.add(criarBoxPorta3D(trilhoSuperiorLargura, trilhoAltura, trilhoProf, 0, yTrilhoSuperior, 0, materiais.perfilEscuro));
    }

    if (trilhoInferiorLargura > 0.005) {
        group.add(criarBoxPorta3D(trilhoInferiorLargura, trilhoAltura, trilhoProf, 0, yTrilhoInferior, 0, materiais.perfilEscuro));
    }
}

function renderizarPorta3D() {
    const container = prepararContainerPorta3D();
    if (!container) return;

    const larguraMm = numeroCampoPorta3D("largura");
    const alturaMm = numeroCampoPorta3D("altura");

    if (larguraMm <= 0 || alturaMm <= 0) {
        mostrarMensagemPorta3D("Informe largura e altura para visualizar a porta em 3D.");
        return;
    }

    if (!inicializarCenaPorta3D()) return;

    garantirCanvasPorta3D();
    ocultarMensagemPorta3D();
    limparCenaPorta3D();

    const materiais = criarMaterialPorta3D();
    const tipo = obterTipoPorta3D();
    const larguraM = Math.max(0.2, larguraMm / 1000);
    const alturaM = Math.max(0.2, alturaMm / 1000);
    let larguraCenaM = larguraM;
    let alturaCenaM = alturaM;

    if (tipo === "correr" || tipo === "deslizante") {
        const vaoSuperiorM = obterVaoTrilho3DComprimento("vao_trilhos_superior");
        const vaoInferiorM = obterVaoTrilho3DComprimento("vao_trilhos_inferior");
        const trilhoSuperiorLargura = tipo === "deslizante" ? vaoSuperiorM : larguraM + vaoSuperiorM;
        const trilhoInferiorLargura = tipo === "deslizante" ? vaoInferiorM : larguraM + vaoInferiorM;
        const maiorTrilhoM = Math.max(trilhoSuperiorLargura, trilhoInferiorLargura, larguraM);

        adicionarPainelPorta3D(Porta3DState.group, materiais, larguraM, alturaM, 0, 0);
        adicionarPuxadorPorta3D(Porta3DState.group, materiais, larguraM, alturaM);
        adicionarTrilhosPorta3D(Porta3DState.group, materiais, larguraM, alturaM, vaoSuperiorM, vaoInferiorM);

        larguraCenaM = maiorTrilhoM;
        alturaCenaM = alturaM + 0.12;
    } else {
        adicionarPainelPorta3D(Porta3DState.group, materiais, larguraM, alturaM, 0, 0);
        adicionarPuxadorPorta3D(Porta3DState.group, materiais, larguraM, alturaM);
        adicionarDobradicasPorta3D(Porta3DState.group, materiais, larguraM, alturaM);
    }

    const maiorMedida = Math.max(larguraCenaM, alturaCenaM);
    Porta3DState.camera.position.set(maiorMedida * 0.55, alturaCenaM * 0.12, maiorMedida * 2.35);
    Porta3DState.camera.lookAt(0, 0, 0);
    Porta3DState.group.rotation.y = Porta3DState.rotationY;
    redimensionarPorta3D();
}

window.obterVaoTrilho3DComprimento = obterVaoTrilho3DComprimento;
window.adicionarTrilhosPorta3D = adicionarTrilhosPorta3D;
window.renderizarPorta3D = renderizarPorta3D;
window.desenharPorta = renderizarPorta3D;
