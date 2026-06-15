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

// =====================
// FILTRO FINAL: PUXADORES COMPATÍVEIS POR PERFIL
// Este arquivo garante que qualquer script antigo que liste todos os puxadores
// seja sobrescrito pela regra correta: perfil selecionado => puxadores atrelados.
// =====================
(function () {
    "use strict";

    const SEM_PUXADOR = "sem_puxador";

    function normalizarCompat(valor) {
        return String(valor ?? "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function listaTexto(valor) {
        if (Array.isArray(valor)) {
            return valor.map(item => String(item ?? "").trim()).filter(Boolean);
        }

        if (valor === null || valor === undefined || valor === "") {
            return [];
        }

        if (typeof valor === "string") {
            const texto = valor.trim();
            if (!texto) return [];

            try {
                const parsed = JSON.parse(texto);
                if (Array.isArray(parsed)) {
                    return parsed.map(item => String(item ?? "").trim()).filter(Boolean);
                }
            } catch (_) {}

            return texto.split(/[;,|]/).map(item => item.trim()).filter(Boolean);
        }

        return [String(valor).trim()].filter(Boolean);
    }

    function getPerfis() {
        return Array.isArray(window.todosPerfis) ? window.todosPerfis : [];
    }

    function getPuxadores() {
        return Array.isArray(window.todosPuxadores) ? window.todosPuxadores : [];
    }

    function getPerfilSelecionado() {
        const perfilId = document.getElementById("perfil")?.value;
        if (!perfilId) return null;
        return getPerfis().find(perfil => String(perfil.id) === String(perfilId)) || null;
    }

    function getRefsPuxadoresPerfil(perfil) {
        return listaTexto(
            perfil?.puxadores ??
            perfil?.puxadores_compativeis ??
            perfil?.puxadoresCompativeis
        );
    }

    function filtrarPuxadoresPorPerfil(perfil) {
        const refs = getRefsPuxadoresPerfil(perfil);
        if (!refs.length) return [];

        const refsExatas = new Set(refs.map(item => String(item).trim()).filter(Boolean));
        const refsNorm = new Set(refs.map(normalizarCompat).filter(Boolean));

        return getPuxadores().filter(puxador => {
            const id = String(puxador.id ?? "").trim();
            const nome = String(puxador.nome ?? "").trim();

            return (
                refsExatas.has(id) ||
                refsExatas.has(nome) ||
                refsNorm.has(normalizarCompat(id)) ||
                refsNorm.has(normalizarCompat(nome))
            );
        });
    }

    function atualizarPuxadoresFiltrados() {
        const select = document.getElementById("puxador");
        if (!select) return;

        const valorAtual = select.value;
        const perfil = getPerfilSelecionado();

        select.innerHTML = "";

        if (!perfil) {
            select.innerHTML = "<option value=''>Selecione o perfil primeiro</option>";
            select.disabled = true;
            if (typeof window.atualizarPuxadorTipo === "function") window.atualizarPuxadorTipo();
            return;
        }

        select.disabled = false;
        select.innerHTML = "<option value=''>Selecione</option>";
        select.innerHTML += "<option value='sem_puxador'>Sem puxador</option>";

        const compativeis = filtrarPuxadoresPorPerfil(perfil);

        if (!compativeis.length) {
            select.innerHTML += "<option value='' disabled>Nenhum puxador atrelado a este perfil</option>";
        } else {
            compativeis.forEach(puxador => {
                select.innerHTML += `<option value="${puxador.id}">${puxador.nome}</option>`;
            });
        }

        const permitidos = new Set(["", SEM_PUXADOR, ...compativeis.map(puxador => String(puxador.id))]);
        select.value = permitidos.has(String(valorAtual)) ? valorAtual : "";

        if (typeof window.atualizarPuxadorTipo === "function") window.atualizarPuxadorTipo();
    }

    function instalarFiltroPuxadoresPorPerfil() {
        window.atualizarPuxadoresSelect = atualizarPuxadoresFiltrados;
        window.filtrarPuxadoresPorPerfil = filtrarPuxadoresPorPerfil;

        const perfilSelect = document.getElementById("perfil");
        if (perfilSelect && !perfilSelect.dataset.puxadoresPerfilFiltroInstalado) {
            perfilSelect.dataset.puxadoresPerfilFiltroInstalado = "true";
            perfilSelect.addEventListener("change", () => {
                atualizarPuxadoresFiltrados();
                if (typeof window.atualizarPrecoPorta === "function") window.atualizarPrecoPorta();
                if (typeof window.atualizarCamposObrigatorios === "function") window.atualizarCamposObrigatorios();
            });
        }

        atualizarPuxadoresFiltrados();
    }

    function instalarPatchEdicaoPorta() {
        if (window.__puxadoresPerfilPatchEdicaoInstalado) return;
        if (typeof window.preencherCamposPorta !== "function") return;

        const preencherOriginal = window.preencherCamposPorta;

        window.preencherCamposPorta = function preencherCamposPortaComPuxadorFiltrado(porta) {
            preencherOriginal(porta);

            const dados = porta?.dados || {};
            setTimeout(() => {
                const perfilSelect = document.getElementById("perfil");
                if (perfilSelect && dados.perfil) perfilSelect.value = dados.perfil;

                instalarFiltroPuxadoresPorPerfil();

                const puxadorSelect = document.getElementById("puxador");
                if (puxadorSelect && dados.puxador) puxadorSelect.value = dados.puxador;

                if (typeof window.atualizarPuxadorTipo === "function") window.atualizarPuxadorTipo();
                if (typeof window.atualizarPrecoPorta === "function") window.atualizarPrecoPorta();
                if (typeof window.desenharPorta === "function") window.desenharPorta();
                if (typeof window.atualizarCamposObrigatorios === "function") window.atualizarCamposObrigatorios();
            }, 0);
        };

        window.__puxadoresPerfilPatchEdicaoInstalado = true;
    }

    function instalar() {
        instalarFiltroPuxadoresPorPerfil();
        instalarPatchEdicaoPorta();
    }

    window.instalarFiltroPuxadoresPorPerfil = instalar;

    document.addEventListener("change", (ev) => {
        if (ev.target?.id === "perfil") instalar();
    }, true);

    document.addEventListener("DOMContentLoaded", instalar);

    // Reaplica porque main.js carrega alguns fixes dinâmicos depois do DOMContentLoaded.
    setTimeout(instalar, 0);
    setTimeout(instalar, 300);
    setTimeout(instalar, 900);
    setTimeout(instalar, 1800);
})();
