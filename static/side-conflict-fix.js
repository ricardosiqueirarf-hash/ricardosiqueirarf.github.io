// =====================
// CONFLITO ENTRE LADO DO PUXADOR E LADO DAS DOBRADIÇAS
// O puxador não pode ficar no mesmo lado da dobradiça.
// Também remove o texto do preview 3D.
// =====================

function removerTextoPreview3D() {
    document.querySelectorAll(".porta3d-label").forEach((el) => el.remove());

    const styleId = "sideConflictFixStyles";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            .porta3d-label { display: none !important; }
            option[data-conflito-lado="true"] { color: #999; }
        `;
        document.head.appendChild(style);
    }
}

function obterSelectLadoDobradica() {
    return document.getElementById("dobradicas_posicao");
}

function obterSelectLadoPuxador() {
    return document.getElementById("puxador_posicao");
}

function resetarOpcoesLado(select) {
    if (!select) return;
    Array.from(select.options).forEach((option) => {
        option.disabled = false;
        option.hidden = false;
        option.dataset.conflitoLado = "false";
    });
}

function bloquearOpcaoLado(select, lado) {
    if (!select || !lado) return;
    const option = Array.from(select.options).find((opt) => opt.value === lado);
    if (!option) return;
    option.disabled = true;
    option.hidden = true;
    option.dataset.conflitoLado = "true";
}

function sincronizarConflitoLados(origem = "") {
    removerTextoPreview3D();

    const dobradicaSelect = obterSelectLadoDobradica();
    const puxadorSelect = obterSelectLadoPuxador();
    if (!dobradicaSelect || !puxadorSelect) return;

    const ladoDobradica = dobradicaSelect.value;
    const ladoPuxador = puxadorSelect.value;

    resetarOpcoesLado(dobradicaSelect);
    resetarOpcoesLado(puxadorSelect);

    if (ladoPuxador) bloquearOpcaoLado(dobradicaSelect, ladoPuxador);
    if (ladoDobradica) bloquearOpcaoLado(puxadorSelect, ladoDobradica);

    if (ladoDobradica && ladoPuxador && ladoDobradica === ladoPuxador) {
        if (origem === "puxador") {
            dobradicaSelect.value = "";
        } else if (origem === "dobradica") {
            puxadorSelect.value = "";
        } else {
            puxadorSelect.value = "";
        }
    }

    if (typeof atualizarCamposObrigatorios === "function") atualizarCamposObrigatorios();
    if (typeof renderizarPendenciasObrigatoriasPorta === "function") renderizarPendenciasObrigatoriasPorta();
    if (typeof desenharPorta === "function") desenharPorta();
}

function instalarConflitoLados() {
    removerTextoPreview3D();

    document.addEventListener("change", (ev) => {
        if (ev.target?.id === "puxador_posicao") {
            sincronizarConflitoLados("puxador");
        }
        if (ev.target?.id === "dobradicas_posicao") {
            sincronizarConflitoLados("dobradica");
        }
        if (ev.target?.id === "tipologia") {
            setTimeout(() => sincronizarConflitoLados("tipologia"), 0);
            setTimeout(() => sincronizarConflitoLados("tipologia"), 250);
        }
    }, true);

    const renderCamposOriginal = window.renderCampos;
    if (typeof renderCamposOriginal === "function" && !renderCamposOriginal.__conflitoLadosWrapped) {
        const wrapped = function(...args) {
            const resultado = renderCamposOriginal.apply(this, args);
            setTimeout(removerTextoPreview3D, 0);
            setTimeout(() => sincronizarConflitoLados("render"), 100);
            setTimeout(() => sincronizarConflitoLados("render"), 400);
            return resultado;
        };
        wrapped.__conflitoLadosWrapped = true;
        window.renderCampos = wrapped;
    }

    setTimeout(removerTextoPreview3D, 200);
    setTimeout(() => sincronizarConflitoLados("init"), 500);
    setTimeout(() => sincronizarConflitoLados("init"), 1200);
}

window.removerTextoPreview3D = removerTextoPreview3D;
window.sincronizarConflitoLados = sincronizarConflitoLados;
window.instalarConflitoLados = instalarConflitoLados;

document.addEventListener("DOMContentLoaded", instalarConflitoLados);
setTimeout(instalarConflitoLados, 500);
