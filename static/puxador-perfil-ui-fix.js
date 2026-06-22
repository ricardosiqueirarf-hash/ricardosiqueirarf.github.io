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

// =====================
// PUXADORES AGREGADOS AO PERFIL
// Baseado em static/perfis.html:
// - getPuxadoresSelecionados() salva os checkboxes como lista de IDs dos puxadores.
// - payload enviado no perfil: { ..., puxadores: [id1, id2, ...] }.
// Portanto, em portas a regra correta é:
// perfil selecionado -> perfil.puxadores -> comparar com todosPuxadores[].id.
// =====================
(function instalarFiltroPuxadoresAgregadosAoPerfil() {
    "use strict";

    const SEM_PUXADOR = "sem_puxador";

    function normalizar(valor) {
        return String(valor ?? "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function listaTexto(valor) {
        if (Array.isArray(valor)) {
            return valor.flatMap(listaTexto).filter(Boolean);
        }

        if (valor === null || valor === undefined || valor === "") return [];

        if (typeof valor === "object") {
            return [valor.id, valor.nome, valor.value, valor.puxador_id, valor.puxadorId]
                .flatMap(listaTexto)
                .filter(Boolean);
        }

        const texto = String(valor).trim();
        if (!texto) return [];

        try {
            const parsed = JSON.parse(texto);
            if (Array.isArray(parsed) || (parsed && typeof parsed === "object")) {
                return listaTexto(parsed);
            }
        } catch (_) {}

        return texto.split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
    }

    function getTodosPerfis() {
        if (Array.isArray(window.todosPerfis)) return window.todosPerfis;
        return [];
    }

    function getTodosPuxadores() {
        if (Array.isArray(window.todosPuxadores)) return window.todosPuxadores;
        return [];
    }

    function getPerfilSelecionado() {
        const perfilId = document.getElementById("perfil")?.value;
        if (!perfilId) return null;

        return getTodosPerfis().find((perfil) => String(perfil?.id) === String(perfilId)) || null;
    }

    function getIdsPuxadoresDoPerfil(perfil) {
        if (!perfil) return [];

        // O campo real salvo pelo cadastro de perfis é perfil.puxadores.
        const ids = listaTexto(perfil.puxadores);

        // Fallbacks mantidos para registros antigos ou nomes alternativos.
        const fallbacks = listaTexto([
            perfil.puxadores_compativeis,
            perfil.puxadoresCompativeis,
            perfil.puxadores_ids,
            perfil.puxadoresIds
        ]);

        return [...ids, ...fallbacks]
            .map((item) => String(item).trim())
            .filter(Boolean)
            .filter((item, index, array) => array.indexOf(item) === index);
    }

    function filtrarPuxadoresPorPerfil(perfil) {
        const ids = getIdsPuxadoresDoPerfil(perfil);
        if (!ids.length) return [];

        const idsExatos = new Set(ids.map((id) => String(id).trim()).filter(Boolean));
        const idsNormalizados = new Set(ids.map(normalizar).filter(Boolean));

        return getTodosPuxadores().filter((puxador) => {
            const id = String(puxador?.id ?? "").trim();
            const nome = String(puxador?.nome ?? "").trim();

            return (
                idsExatos.has(id) ||
                idsNormalizados.has(normalizar(id)) ||
                idsExatos.has(nome) ||
                idsNormalizados.has(normalizar(nome))
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
            select.disabled = true;
            select.innerHTML = "<option value=''>Selecione o perfil primeiro</option>";
            if (typeof window.atualizarPuxadorTipo === "function") window.atualizarPuxadorTipo();
            return;
        }

        const puxadores = filtrarPuxadoresPorPerfil(perfil);

        select.disabled = false;
        select.innerHTML = "<option value=''>Selecione</option>";
        select.innerHTML += "<option value='sem_puxador'>Sem puxador</option>";

        if (!puxadores.length) {
            select.innerHTML += "<option value='' disabled>Nenhum puxador atrelado a este perfil</option>";
            console.warn("[ColorGlass] Nenhum puxador encontrado para o perfil selecionado", {
                perfil_id: perfil.id,
                perfil_nome: perfil.nome,
                perfil_puxadores: perfil.puxadores,
                ids_lidos: getIdsPuxadoresDoPerfil(perfil),
                total_puxadores_carregados: getTodosPuxadores().length
            });
        } else {
            puxadores.forEach((puxador) => {
                const option = document.createElement("option");
                option.value = puxador.id;
                option.textContent = puxador.nome || puxador.id;
                select.appendChild(option);
            });
        }

        const permitidos = new Set(["", SEM_PUXADOR, ...puxadores.map((puxador) => String(puxador.id))]);
        select.value = permitidos.has(String(valorAtual)) ? valorAtual : "";

        if (typeof window.atualizarPuxadorTipo === "function") window.atualizarPuxadorTipo();
        if (typeof window.atualizarCamposObrigatorios === "function") window.atualizarCamposObrigatorios();
        if (typeof window.atualizarPrecoPorta === "function") window.atualizarPrecoPorta();
    }

    function instalarEventoPerfil() {
        const perfilSelect = document.getElementById("perfil");
        if (!perfilSelect || perfilSelect.dataset.puxadoresAgregadosFix === "true") return;

        perfilSelect.dataset.puxadoresAgregadosFix = "true";
        perfilSelect.addEventListener("change", () => {
            atualizarPuxadoresFiltrados();
            setTimeout(atualizarPuxadoresFiltrados, 50);
            setTimeout(atualizarPuxadoresFiltrados, 200);
        }, true);
    }

    function instalarPatchRenderCampos() {
        if (typeof window.renderCampos !== "function" || window.renderCampos.__puxadoresAgregadosFix) return;

        const original = window.renderCampos;
        const wrapped = function renderCamposComPuxadoresAgregados() {
            const retorno = original.apply(this, arguments);
            setTimeout(instalar, 0);
            setTimeout(atualizarPuxadoresFiltrados, 50);
            setTimeout(atualizarPuxadoresFiltrados, 200);
            return retorno;
        };

        wrapped.__puxadoresAgregadosFix = true;
        window.renderCampos = wrapped;
        try { renderCampos = wrapped; } catch (_) {}
    }

    function instalarPatchEdicaoPorta() {
        if (window.__puxadoresAgregadosPatchEdicaoInstalado) return;
        if (typeof window.preencherCamposPorta !== "function") return;

        const original = window.preencherCamposPorta;
        window.preencherCamposPorta = function preencherCamposComPuxadoresAgregados(porta) {
            original.apply(this, arguments);

            const dados = porta?.dados || {};
            setTimeout(() => {
                const perfilSelect = document.getElementById("perfil");
                if (perfilSelect && dados.perfil) perfilSelect.value = dados.perfil;

                atualizarPuxadoresFiltrados();

                const puxadorSelect = document.getElementById("puxador");
                if (puxadorSelect && dados.puxador) puxadorSelect.value = dados.puxador;

                if (typeof window.atualizarPuxadorTipo === "function") window.atualizarPuxadorTipo();
                if (typeof window.atualizarPrecoPorta === "function") window.atualizarPrecoPorta();
                if (typeof window.desenharPorta === "function") window.desenharPorta();
                if (typeof window.atualizarCamposObrigatorios === "function") window.atualizarCamposObrigatorios();
            }, 0);
        };

        window.__puxadoresAgregadosPatchEdicaoInstalado = true;
    }

    function instalar() {
        window.atualizarPuxadoresSelect = atualizarPuxadoresFiltrados;
        window.filtrarPuxadoresPorPerfil = filtrarPuxadoresPorPerfil;
        window.getIdsPuxadoresDoPerfil = getIdsPuxadoresDoPerfil;

        instalarEventoPerfil();
        instalarPatchRenderCampos();
        instalarPatchEdicaoPorta();
        atualizarPuxadoresFiltrados();
    }

    window.instalarFiltroPuxadoresPorPerfil = instalar;
    window.atualizarPuxadoresSelect = atualizarPuxadoresFiltrados;
    window.filtrarPuxadoresPorPerfil = filtrarPuxadoresPorPerfil;
    window.getIdsPuxadoresDoPerfil = getIdsPuxadoresDoPerfil;

    document.addEventListener("change", (ev) => {
        if (ev.target?.id === "perfil") atualizarPuxadoresFiltrados();
        if (ev.target?.id === "tipologia") setTimeout(instalar, 0);
        if (["puxador", "puxador_posicao", "largura", "altura"].includes(ev.target?.id)) {
            atualizarPuxadorPerfilAutoEPreco();
        }
    }, true);

    document.addEventListener("input", (ev) => {
        if (["largura", "altura"].includes(ev.target?.id)) {
            atualizarPuxadorPerfilAutoEPreco();
        }
    }, true);

    document.addEventListener("DOMContentLoaded", instalar);

    setTimeout(instalar, 0);
    setTimeout(instalar, 300);
    setTimeout(instalar, 900);
    setTimeout(instalar, 1800);
})();
