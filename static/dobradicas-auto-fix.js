// =====================
// POSICIONAMENTO AUTOMÁTICO DAS DOBRADIÇAS
// Padrão: mínimo 2 dobradiças.
// Primeira = 100 mm; última = altura - 100 mm.
// Intermediárias distribuídas igualmente entre as duas.
// =====================

function numeroCampoDobradicaMm(id) {
    const valor = document.getElementById(id)?.value;
    const numero = Number(String(valor ?? "").replace(",", "."));
    return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function calcularAlturasDobradicasPadrao(alturaMm, quantidade) {
    const qtd = Math.max(2, Math.round(Number(quantidade) || 2));
    const margemPadrao = 100;

    if (!alturaMm || alturaMm <= 0) return Array.from({ length: qtd }, () => "");

    const margem = Math.min(margemPadrao, Math.max(0, alturaMm / 2));
    const inicio = margem;
    const fim = Math.max(inicio, alturaMm - margem);

    if (qtd === 1) return [Math.round(alturaMm / 2)];
    if (qtd === 2) return [Math.round(inicio), Math.round(fim)];

    const passo = (fim - inicio) / (qtd - 1);
    return Array.from({ length: qtd }, (_, index) => Math.round(inicio + passo * index));
}

function criarInputAlturaDobradica(valor, index) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.placeholder = `Altura da dobradiça ${index + 1} (mm)`;
    input.className = "dobradica-altura";
    input.value = valor !== undefined && valor !== null ? String(valor) : "";
    input.dataset.autoDobradica = "true";
    input.oninput = () => {
        input.dataset.autoDobradica = "false";
        if (typeof desenharPorta === "function") desenharPorta();
        if (typeof atualizarCamposObrigatorios === "function") atualizarCamposObrigatorios();
    };
    return input;
}

function atualizarDobradicasInputs(auto = true) {
    const container = document.getElementById("dobradicasContainer");
    const qtdInput = document.getElementById("dobradicas");
    if (!container || !qtdInput) return;

    let qtd = parseInt(qtdInput.value || "0", 10) || 2;
    if (qtd < 2) qtd = 2;
    qtdInput.value = String(qtd);

    const alturaMm = numeroCampoDobradicaMm("altura");
    const valoresAtuais = Array.from(document.querySelectorAll(".dobradica-altura")).map(input => input.value);
    const valoresPadrao = calcularAlturasDobradicasPadrao(alturaMm, qtd);

    container.innerHTML = "";

    for (let i = 0; i < qtd; i++) {
        const valor = auto ? valoresPadrao[i] : (valoresAtuais[i] ?? valoresPadrao[i]);
        container.appendChild(criarInputAlturaDobradica(valor, i));
    }

    const hint = document.createElement("div");
    hint.id = "dobradicas_auto_hint";
    hint.style.fontSize = "0.78rem";
    hint.style.marginTop = "6px";
    hint.style.color = "#0d5d8c";
    hint.style.fontWeight = "700";
    hint.textContent = `Padrão automático: ${valoresPadrao.join(" / ")} mm`;
    container.appendChild(hint);

    if (typeof desenharPorta === "function") desenharPorta();
    if (typeof atualizarCamposObrigatorios === "function") atualizarCamposObrigatorios();
}

function aplicarDobradicasPadrao() {
    const qtdInput = document.getElementById("dobradicas");
    const tipo = document.getElementById("tipologia")?.value;
    if (!qtdInput || tipo !== "giro") return;

    if (!qtdInput.value || Number(qtdInput.value) < 2) {
        qtdInput.value = "2";
    }
    atualizarDobradicasInputs(true);
}

function obterAlturasDobradicas() {
    return Array.from(document.querySelectorAll(".dobradica-altura"))
        .map(input => input.value)
        .filter(Boolean);
}

window.calcularAlturasDobradicasPadrao = calcularAlturasDobradicasPadrao;
window.atualizarDobradicasInputs = atualizarDobradicasInputs;
window.aplicarDobradicasPadrao = aplicarDobradicasPadrao;
window.obterAlturasDobradicas = obterAlturasDobradicas;

document.addEventListener("input", (ev) => {
    if (ev.target?.id === "dobradicas") {
        atualizarDobradicasInputs(true);
    }

    if (ev.target?.id === "altura" && document.getElementById("tipologia")?.value === "giro") {
        atualizarDobradicasInputs(true);
    }
}, true);

document.addEventListener("change", (ev) => {
    if (["tipologia", "dobradicas", "altura"].includes(ev.target?.id)) {
        setTimeout(aplicarDobradicasPadrao, 0);
    }
}, true);

setTimeout(aplicarDobradicasPadrao, 300);
setTimeout(aplicarDobradicasPadrao, 900);
