// =====================
// UI DO PUXADOR METRO LINEAR / PERFIL
// Para essa categoria, o campo medida_puxador é automático:
// esquerda/direita = altura da porta
// cima/baixo = largura da porta
// =====================

function obterMedidaPuxadorPerfilMm() {
    const posicao = document.getElementById("puxador_posicao")?.value || "direita";
    const larguraMm = Number(document.getElementById("largura")?.value || 0) || 0;
    const alturaMm = Number(document.getElementById("altura")?.value || 0) || 0;

    if (posicao === "cima" || posicao === "baixo") return larguraMm;
    return alturaMm;
}

function garantirHintPuxadorPerfil(medidaInput) {
    if (!medidaInput) return null;
    let hint = document.getElementById("medida_puxador_auto_hint");
    if (!hint) {
        hint = document.createElement("div");
        hint.id = "medida_puxador_auto_hint";
        hint.style.fontSize = "0.78rem";
        hint.style.marginTop = "4px";
        hint.style.color = "#0d5d8c";
        hint.style.fontWeight = "700";
        medidaInput.insertAdjacentElement("afterend", hint);
    }
    return hint;
}

function atualizarMedidaPuxadorPerfilAutomatica() {
    const puxador = typeof obterPuxadorSelecionado === "function" ? obterPuxadorSelecionado() : null;
    const medidaInput = document.getElementById("medida_puxador");
    if (!medidaInput) return;

    const hint = garantirHintPuxadorPerfil(medidaInput);
    const ehPerfil = typeof puxadorEhPerfil === "function" && puxadorEhPerfil(puxador);

    if (!ehPerfil) {
        if (hint) hint.style.display = "none";
        return;
    }

    const posicao = document.getElementById("puxador_posicao")?.value || "direita";
    const medidaMm = obterMedidaPuxadorPerfilMm();
    const base = (posicao === "cima" || posicao === "baixo") ? "largura" : "altura";

    medidaInput.value = String(Math.max(0, medidaMm));
    medidaInput.disabled = true;
    medidaInput.readOnly = true;
    medidaInput.dataset.autoPerfil = "true";

    if (hint) {
        hint.style.display = "block";
        hint.textContent = `Automático: usa a ${base} da porta (${Math.max(0, medidaMm)} mm).`;
    }
}

function atualizarPuxadorTipo() {
    const puxador = typeof obterPuxadorSelecionado === "function" ? obterPuxadorSelecionado() : null;
    const medidaInput = document.getElementById("medida_puxador");
    if (!medidaInput) return;

    const hint = garantirHintPuxadorPerfil(medidaInput);

    if (!puxador || document.getElementById("puxador")?.value === "sem_puxador") {
        medidaInput.disabled = true;
        medidaInput.readOnly = true;
        medidaInput.value = "0";
        medidaInput.dataset.autoPerfil = "false";
        if (hint) hint.style.display = "none";
        return;
    }

    if (typeof puxadorEhPerfil === "function" && puxadorEhPerfil(puxador)) {
        atualizarMedidaPuxadorPerfilAutomatica();
        if (typeof atualizarPrecoPorta === "function") atualizarPrecoPorta();
        return;
    }

    medidaInput.dataset.autoPerfil = "false";
    if (hint) hint.style.display = "none";

    if (puxador.tipo_medida === "metro_linear") {
        medidaInput.disabled = false;
        medidaInput.readOnly = false;
    } else {
        medidaInput.disabled = true;
        medidaInput.readOnly = true;
        medidaInput.value = "0";
    }
}

function atualizarPuxadorPerfilAutoEPreco() {
    atualizarPuxadorTipo();
    atualizarMedidaPuxadorPerfilAutomatica();
    if (typeof atualizarPrecoPorta === "function") atualizarPrecoPorta();
}

window.obterMedidaPuxadorPerfilMm = obterMedidaPuxadorPerfilMm;
window.atualizarMedidaPuxadorPerfilAutomatica = atualizarMedidaPuxadorPerfilAutomatica;
window.atualizarPuxadorTipo = atualizarPuxadorTipo;
window.atualizarPuxadorPerfilAutoEPreco = atualizarPuxadorPerfilAutoEPreco;

document.addEventListener("change", (ev) => {
    if (["puxador", "puxador_posicao", "largura", "altura"].includes(ev.target?.id)) {
        atualizarPuxadorPerfilAutoEPreco();
    }
}, true);

document.addEventListener("input", (ev) => {
    if (["largura", "altura"].includes(ev.target?.id)) {
        atualizarPuxadorPerfilAutoEPreco();
    }
}, true);

setTimeout(atualizarPuxadorPerfilAutoEPreco, 300);
setTimeout(atualizarPuxadorPerfilAutoEPreco, 900);
