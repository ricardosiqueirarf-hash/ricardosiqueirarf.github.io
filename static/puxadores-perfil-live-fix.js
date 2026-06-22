// =====================
// PUXADORES POR PERFIL - FIX LIVE
// Garante que, ao selecionar um perfil, o select de puxadores liste apenas os puxadores agregados naquele perfil.
// Também suporta formatos diferentes vindos do Supabase: array, JSON string, texto separado por vírgula e objetos.
// =====================
(function instalarPuxadoresPerfilLiveFix() {
    "use strict";

    const SEM_PUXADOR = "sem_puxador";

    function normalizar(valor) {
        return String(valor ?? "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function adicionarRef(lista, valor) {
        if (valor === null || valor === undefined) return;

        if (Array.isArray(valor)) {
            valor.forEach((item) => adicionarRef(lista, item));
            return;
        }

        if (typeof valor === "object") {
            ["id", "nome", "name", "value", "puxador", "puxador_id", "puxadorId"].forEach((campo) => {
                if (valor[campo] !== undefined && valor[campo] !== null) adicionarRef(lista, valor[campo]);
            });
            return;
        }

        const texto = String(valor).trim();
        if (!texto) return;

        try {
            const parsed = JSON.parse(texto);
            if (Array.isArray(parsed) || (parsed && typeof parsed === "object")) {
                adicionarRef(lista, parsed);
                return;
            }
        } catch (_) {}

        texto.split(/[;,|]/).forEach((parte) => {
            const item = parte.trim();
            if (item && !lista.includes(item)) lista.push(item);
        });
    }

    function listaRefs(...valores) {
        const refs = [];
        valores.forEach((valor) => adicionarRef(refs, valor));
        return refs.filter((valor, index, array) => array.indexOf(valor) === index);
    }

    function getPerfis() {
        if (Array.isArray(window.todosPerfis)) return window.todosPerfis;
        try {
            if (typeof todosPerfis !== "undefined" && Array.isArray(todosPerfis)) return todosPerfis;
        } catch (_) {}
        return [];
    }

    function getPuxadores() {
        if (Array.isArray(window.todosPuxadores)) return window.todosPuxadores;
        try {
            if (typeof todosPuxadores !== "undefined" && Array.isArray(todosPuxadores)) return todosPuxadores;
        } catch (_) {}
        return [];
    }

    function getPerfilSelecionado() {
        const perfilId = document.getElementById("perfil")?.value;
        if (!perfilId) return null;

        return getPerfis().find((perfil) => {
            return String(perfil?.id ?? "") === String(perfilId) || String(perfil?.nome ?? "") === String(perfilId);
        }) || null;
    }

    function getRefsPuxadoresPerfil(perfil) {
        if (!perfil) return [];
        return listaRefs(
            perfil.puxadores,
            perfil.puxadores_compativeis,
            perfil.puxadoresCompativeis,
            perfil.puxadores_ids,
            perfil.puxadoresIds,
            perfil.puxador,
            perfil.puxador_id,
            perfil.puxadorId
        );
    }

    function puxadorBateComRefs(puxador, refsExatas, refsNorm) {
        const campos = listaRefs(
            puxador?.id,
            puxador?.nome,
            puxador?.codigo,
            puxador?.sku,
            puxador?.referencia
        );

        return campos.some((campo) => {
            const texto = String(campo ?? "").trim();
            return refsExatas.has(texto) || refsNorm.has(normalizar(texto));
        });
    }

    function filtrarPuxadoresDoPerfil(perfil) {
        const refs = getRefsPuxadoresPerfil(perfil);
        if (!refs.length) return [];

        const refsExatas = new Set(refs.map((ref) => String(ref).trim()).filter(Boolean));
        const refsNorm = new Set(refs.map(normalizar).filter(Boolean));

        return getPuxadores().filter((puxador) => puxadorBateComRefs(puxador, refsExatas, refsNorm));
    }

    function preencherSelectPuxadores() {
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

        const compativeis = filtrarPuxadoresDoPerfil(perfil);
        select.disabled = false;
        select.innerHTML = "<option value=''>Selecione</option>";
        select.innerHTML += "<option value='sem_puxador'>Sem puxador</option>";

        if (!compativeis.length) {
            select.innerHTML += "<option value='' disabled>Nenhum puxador atrelado a este perfil</option>";
            console.warn("[puxadores-perfil-live-fix] Perfil sem puxadores compatíveis encontrados", {
                perfil,
                refs: getRefsPuxadoresPerfil(perfil),
                totalPuxadores: getPuxadores().length
            });
        } else {
            compativeis.forEach((puxador) => {
                const option = document.createElement("option");
                option.value = puxador.id;
                option.textContent = puxador.nome || puxador.id;
                select.appendChild(option);
            });
        }

        const permitidos = new Set(["", SEM_PUXADOR, ...compativeis.map((puxador) => String(puxador.id))]);
        select.value = permitidos.has(String(valorAtual)) ? valorAtual : "";

        if (typeof window.atualizarPuxadorTipo === "function") window.atualizarPuxadorTipo();
        if (typeof window.atualizarCamposObrigatorios === "function") window.atualizarCamposObrigatorios();
        if (typeof window.atualizarPrecoPorta === "function") window.atualizarPrecoPorta();
    }

    function instalar() {
        window.atualizarPuxadoresSelect = preencherSelectPuxadores;
        window.filtrarPuxadoresDoPerfil = filtrarPuxadoresDoPerfil;
        window.getRefsPuxadoresPerfil = getRefsPuxadoresPerfil;

        const perfilSelect = document.getElementById("perfil");
        if (perfilSelect && !perfilSelect.dataset.puxadoresPerfilLiveFix) {
            perfilSelect.dataset.puxadoresPerfilLiveFix = "true";
            perfilSelect.addEventListener("change", () => {
                preencherSelectPuxadores();
                setTimeout(preencherSelectPuxadores, 50);
                setTimeout(preencherSelectPuxadores, 200);
            }, true);
        }

        if (document.getElementById("puxador")) preencherSelectPuxadores();
    }

    function patchRenderCampos() {
        if (typeof window.renderCampos !== "function" || window.renderCampos.__puxadoresPerfilLiveFix) return;

        const original = window.renderCampos;
        const wrapped = function renderCamposComPuxadoresPerfil() {
            const retorno = original.apply(this, arguments);
            setTimeout(instalar, 0);
            setTimeout(preencherSelectPuxadores, 50);
            setTimeout(preencherSelectPuxadores, 200);
            return retorno;
        };

        wrapped.__puxadoresPerfilLiveFix = true;
        window.renderCampos = wrapped;
        try { renderCampos = wrapped; } catch (_) {}
    }

    function patchCarregadores() {
        ["carregarPerfis", "carregarPuxadores"].forEach((nomeFuncao) => {
            const fn = window[nomeFuncao];
            if (typeof fn !== "function" || fn.__puxadoresPerfilLiveFix) return;

            const wrapped = async function carregadorComPuxadoresPerfil() {
                const retorno = await fn.apply(this, arguments);
                setTimeout(preencherSelectPuxadores, 0);
                setTimeout(preencherSelectPuxadores, 150);
                return retorno;
            };

            wrapped.__puxadoresPerfilLiveFix = true;
            window[nomeFuncao] = wrapped;
            try { eval(`${nomeFuncao} = wrapped`); } catch (_) {}
        });
    }

    document.addEventListener("change", (ev) => {
        if (ev.target?.id === "perfil") {
            preencherSelectPuxadores();
            setTimeout(preencherSelectPuxadores, 100);
        }
        if (ev.target?.id === "tipologia") {
            setTimeout(instalar, 0);
            setTimeout(preencherSelectPuxadores, 200);
        }
    }, true);

    document.addEventListener("DOMContentLoaded", () => {
        patchRenderCampos();
        patchCarregadores();
        instalar();
    });

    let tentativas = 0;
    const timer = setInterval(() => {
        tentativas += 1;
        patchRenderCampos();
        patchCarregadores();
        instalar();
        if (tentativas >= 80) clearInterval(timer);
    }, 100);
})();
