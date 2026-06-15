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

        const compatíveis = filtrarPuxadoresPorPerfil(perfil);

        if (!compatíveis.length) {
            select.innerHTML += "<option value='' disabled>Nenhum puxador atrelado a este perfil</option>";
        } else {
            compatíveis.forEach(puxador => {
                select.innerHTML += `<option value="${puxador.id}">${puxador.nome}</option>`;
            });
        }

        const permitidos = new Set(["", SEM_PUXADOR, ...compatíveis.map(puxador => String(puxador.id))]);
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
