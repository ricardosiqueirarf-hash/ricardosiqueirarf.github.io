// Ajuste compartilhado para páginas de cadastro de perfis/sistemas.
// Antiga tipologia interna: "correr". Nova: "divisao_ambiente".
(function ajustarCadastrosDivisaoAmbiente() {
    const TIPO_ANTIGO = "correr";
    const TIPO_NOVO = "divisao_ambiente";
    const LABEL_NOVO = "Divisão de ambiente";

    function normalizarTipologia(valor) {
        return String(valor || "").trim() === TIPO_ANTIGO ? TIPO_NOVO : String(valor || "").trim();
    }

    function formatarTipologia(valor) {
        const tipo = normalizarTipologia(valor);
        if (tipo === TIPO_NOVO) return LABEL_NOVO;
        if (tipo === "deslizante") return "Deslizante";
        if (tipo === "giro") return "Giro";
        if (tipo === "pivotante") return "Pivotante";
        if (tipo === "estrutural") return "Estrutural";
        return tipo || "-";
    }

    function normalizarArray(lista) {
        return (Array.isArray(lista) ? lista : [])
            .map(normalizarTipologia)
            .filter(Boolean)
            .filter((valor, index, arr) => arr.indexOf(valor) === index);
    }

    function atualizarCheckboxesPerfis() {
        document.querySelectorAll('.tipologias input[value="correr"]').forEach((input) => {
            input.value = TIPO_NOVO;
            const label = input.closest("label");
            if (label) {
                label.childNodes.forEach((node) => {
                    if (node.nodeType === Node.TEXT_NODE) node.textContent = " " + LABEL_NOVO;
                });
            }
        });
    }

    function atualizarSelectsSistemas() {
        try {
            if (typeof tipologiasDisponiveis !== "undefined" && Array.isArray(tipologiasDisponiveis)) {
                const index = tipologiasDisponiveis.indexOf(TIPO_ANTIGO);
                if (index >= 0) tipologiasDisponiveis[index] = TIPO_NOVO;
                if (!tipologiasDisponiveis.includes(TIPO_NOVO)) tipologiasDisponiveis.push(TIPO_NOVO);
            }
        } catch (_) {}

        document.querySelectorAll(".tipologia-select option").forEach((option) => {
            if (option.value === TIPO_ANTIGO) option.value = TIPO_NOVO;
            if (option.value === TIPO_NOVO) option.textContent = LABEL_NOVO;
            else if (option.value) option.textContent = formatarTipologia(option.value);
        });
    }

    function atualizarTabelas() {
        document.querySelectorAll("td").forEach((td) => {
            if (!td.textContent) return;
            td.textContent = td.textContent
                .replace(/\bcorrer\b/gi, LABEL_NOVO)
                .replace(/\bdivisao_ambiente\b/gi, LABEL_NOVO);
        });
    }

    function patchFuncoesPerfis() {
        if (typeof window.getTipologiasSelecionadas === "function" && !window.getTipologiasSelecionadas.__divisaoAmbienteFix) {
            const original = window.getTipologiasSelecionadas;
            const wrapped = function getTipologiasSelecionadasFix() {
                return normalizarArray(original.apply(this, arguments));
            };
            wrapped.__divisaoAmbienteFix = true;
            window.getTipologiasSelecionadas = wrapped;
            try { getTipologiasSelecionadas = wrapped; } catch (_) {}
        }

        if (typeof window.editar === "function" && !window.editar.__divisaoAmbienteFix) {
            const original = window.editar;
            const wrapped = function editarFix(item) {
                const normalizado = item && typeof item === "object"
                    ? { ...item, tipologias: normalizarArray(item.tipologias), tipo: normalizarArray(item.tipo) }
                    : item;
                const retorno = original.call(this, normalizado);
                atualizarCheckboxesPerfis();
                atualizarSelectsSistemas();
                atualizarTabelas();
                return retorno;
            };
            wrapped.__divisaoAmbienteFix = true;
            window.editar = wrapped;
            try { editar = wrapped; } catch (_) {}
        }

        if (typeof window.carregar === "function" && !window.carregar.__divisaoAmbienteFix) {
            const original = window.carregar;
            const wrapped = async function carregarFix() {
                const retorno = await original.apply(this, arguments);
                atualizarCheckboxesPerfis();
                atualizarSelectsSistemas();
                atualizarTabelas();
                return retorno;
            };
            wrapped.__divisaoAmbienteFix = true;
            window.carregar = wrapped;
            try { carregar = wrapped; } catch (_) {}
        }

        if (typeof window.atualizarSelectsTipologia === "function" && !window.atualizarSelectsTipologia.__divisaoAmbienteFix) {
            const original = window.atualizarSelectsTipologia;
            const wrapped = function atualizarSelectsTipologiaFix() {
                const retorno = original.apply(this, arguments);
                atualizarSelectsSistemas();
                return retorno;
            };
            wrapped.__divisaoAmbienteFix = true;
            window.atualizarSelectsTipologia = wrapped;
            try { atualizarSelectsTipologia = wrapped; } catch (_) {}
        }
    }

    function aplicar() {
        atualizarCheckboxesPerfis();
        atualizarSelectsSistemas();
        atualizarTabelas();
        patchFuncoesPerfis();
    }

    aplicar();
    document.addEventListener("DOMContentLoaded", aplicar);

    let tentativas = 0;
    const timer = setInterval(() => {
        tentativas += 1;
        aplicar();
        if (tentativas >= 80) clearInterval(timer);
    }, 25);
})();
