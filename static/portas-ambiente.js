// =====================
// AMBIENTE POR ITEM DO ORÇAMENTO
// =====================
// Mantém compatibilidade com o fluxo atual: salva o ambiente dentro de porta.dados.ambiente
// sem exigir alteração imediata na tabela do Supabase.

(function () {
    const AMBIENTE_ID = "ambiente";
    const SUGESTOES_AMBIENTE = [
        "Cozinha",
        "Área gourmet",
        "Sala",
        "Quarto casal",
        "Quarto solteiro",
        "Closet",
        "Banheiro",
        "Lavanderia",
        "Escritório"
    ];

    function textoSeguro(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function obterAmbientePorta(porta) {
        return String(porta?.dados?.ambiente || porta?.ambiente || "").trim();
    }

    function aplicarCampoAmbienteNasTipologias() {
        try {
            if (typeof TIPOLOGIAS === "undefined" || !TIPOLOGIAS) return false;

            Object.keys(TIPOLOGIAS).forEach((tipo) => {
                if (!Array.isArray(TIPOLOGIAS[tipo])) return;
                if (!TIPOLOGIAS[tipo].includes(AMBIENTE_ID)) {
                    TIPOLOGIAS[tipo].unshift(AMBIENTE_ID);
                }
            });
            return true;
        } catch (err) {
            console.warn("Não foi possível aplicar ambiente nas tipologias:", err);
            return false;
        }
    }

    function garantirDatalistAmbientes() {
        if (document.getElementById("ambientesSugeridos")) return;

        const datalist = document.createElement("datalist");
        datalist.id = "ambientesSugeridos";
        SUGESTOES_AMBIENTE.forEach((nome) => {
            const option = document.createElement("option");
            option.value = nome;
            datalist.appendChild(option);
        });
        document.body.appendChild(datalist);
    }

    function criarCampoAmbiente(valorAtual = "") {
        garantirDatalistAmbientes();

        const label = document.createElement("label");
        label.dataset.ambienteField = "true";
        label.textContent = "Ambiente";

        const input = document.createElement("input");
        input.id = AMBIENTE_ID;
        input.type = "text";
        input.placeholder = "Ex: Cozinha, Closet, Quarto casal";
        input.setAttribute("list", "ambientesSugeridos");
        input.dataset.required = "true";
        input.value = valorAtual || "";
        input.addEventListener("input", () => {
            if (typeof atualizarCamposObrigatorios === "function") atualizarCamposObrigatorios();
        });

        label.appendChild(input);
        return label;
    }

    function garantirCampoAmbiente() {
        const container = document.getElementById("campos");
        if (!container) return;

        const existente = document.getElementById(AMBIENTE_ID);
        if (existente) return;

        const ultimoValor = window.__ultimoAmbientePorta || "";
        const campo = criarCampoAmbiente(ultimoValor);
        container.insertBefore(campo, container.firstChild || null);

        if (typeof atualizarCamposObrigatorios === "function") atualizarCamposObrigatorios();
    }

    function instalarPatchRenderCampos() {
        if (typeof renderCampos !== "function") return false;
        if (renderCampos.__ambientePatch) return true;

        const renderCamposOriginal = renderCampos;
        const renderCamposComAmbiente = function (...args) {
            const resultado = renderCamposOriginal.apply(this, args);
            garantirCampoAmbiente();
            return resultado;
        };
        renderCamposComAmbiente.__ambientePatch = true;

        try { renderCampos = renderCamposComAmbiente; } catch (_) {}
        window.renderCampos = renderCamposComAmbiente;
        return true;
    }

    function instalarPatchSalvarPorta() {
        if (typeof salvarPorta !== "function") return false;
        if (salvarPorta.__ambientePatch) return true;

        const salvarPortaOriginal = salvarPorta;
        const salvarPortaComAmbiente = async function (...args) {
            garantirCampoAmbiente();

            const ambienteInput = document.getElementById(AMBIENTE_ID);
            const ambiente = String(ambienteInput?.value || "").trim();

            if (!ambiente) {
                alert("Informe o ambiente deste item do orçamento.");
                if (ambienteInput) {
                    ambienteInput.focus();
                    ambienteInput.style.border = "1px solid red";
                }
                return;
            }

            if (ambienteInput) ambienteInput.value = ambiente;
            window.__ultimoAmbientePorta = ambiente;

            aplicarCampoAmbienteNasTipologias();
            return salvarPortaOriginal.apply(this, args);
        };
        salvarPortaComAmbiente.__ambientePatch = true;

        try { salvarPorta = salvarPortaComAmbiente; } catch (_) {}
        window.salvarPorta = salvarPortaComAmbiente;
        return true;
    }

    function instalarPatchPreencherCamposPorta() {
        if (typeof preencherCamposPorta !== "function") return false;
        if (preencherCamposPorta.__ambientePatch) return true;

        const preencherOriginal = preencherCamposPorta;
        const preencherComAmbiente = function (porta, ...args) {
            window.__ultimoAmbientePorta = obterAmbientePorta(porta);
            const resultado = preencherOriginal.call(this, porta, ...args);
            garantirCampoAmbiente();
            const input = document.getElementById(AMBIENTE_ID);
            if (input) input.value = obterAmbientePorta(porta);
            return resultado;
        };
        preencherComAmbiente.__ambientePatch = true;

        try { preencherCamposPorta = preencherComAmbiente; } catch (_) {}
        window.preencherCamposPorta = preencherComAmbiente;
        return true;
    }

    function enriquecerTabelaPortas() {
        const table = document.querySelector("#portasSalvas table.portas-table");
        if (!table || !Array.isArray(window.portas || portas)) return;

        const listaPortas = window.portas || portas;
        const header = table.querySelector("thead tr");
        if (header && !Array.from(header.children).some((th) => th.textContent.trim() === "Ambiente")) {
            const th = document.createElement("th");
            th.textContent = "Ambiente";
            header.insertBefore(th, header.children[1] || null);
        }

        table.querySelectorAll("tbody tr").forEach((tr, index) => {
            if (tr.querySelector("td[data-ambiente-col='true']")) return;
            const td = document.createElement("td");
            td.dataset.ambienteCol = "true";
            td.textContent = obterAmbientePorta(listaPortas[index]) || "-";
            tr.insertBefore(td, tr.children[1] || null);
        });
    }

    function enriquecerResumoOrcamento() {
        const resumo = document.getElementById("printResumo");
        if (!resumo || !Array.isArray(window.portas || portas)) return;
        const listaPortas = window.portas || portas;

        resumo.querySelectorAll(".print-item").forEach((item, index) => {
            if (item.querySelector("[data-ambiente-resumo='true']")) return;
            const ambiente = obterAmbientePorta(listaPortas[index]) || "-";
            const div = document.createElement("div");
            div.dataset.ambienteResumo = "true";
            div.innerHTML = `<strong>Ambiente:</strong> ${textoSeguro(ambiente)}`;
            item.insertBefore(div, item.firstChild || null);
        });
    }

    function enriquecerOrdemProducao() {
        const ordem = document.getElementById("printOrdem");
        if (!ordem || !Array.isArray(window.portas || portas)) return;
        const listaPortas = window.portas || portas;

        ordem.querySelectorAll(".print-item .op-info").forEach((info, index) => {
            if (info.querySelector("[data-ambiente-op='true']")) return;
            const ambiente = obterAmbientePorta(listaPortas[index]) || "-";
            const row = document.createElement("div");
            row.className = "op-info-row";
            row.dataset.ambienteOp = "true";
            row.innerHTML = `<span>Ambiente</span><strong>${textoSeguro(ambiente)}</strong>`;

            const primeiraLinha = info.querySelector(".op-info-row");
            if (primeiraLinha?.nextSibling) {
                info.insertBefore(row, primeiraLinha.nextSibling);
            } else {
                info.insertBefore(row, info.firstChild || null);
            }
        });
    }

    function portasExpandidasPorQuantidade() {
        const listaPortas = window.portas || portas || [];
        const expandidas = [];
        listaPortas.forEach((porta) => {
            const qtd = parseInt(porta?.quantidade || "1", 10) || 1;
            for (let i = 0; i < qtd; i += 1) expandidas.push(porta);
        });
        return expandidas;
    }

    function enriquecerEtiquetasTermicas() {
        const container = document.getElementById("printEtiqueta");
        if (!container) return;

        const expandidas = portasExpandidasPorQuantidade();
        container.querySelectorAll(".thermal-label").forEach((label, index) => {
            if (label.querySelector("[data-ambiente-etiqueta='true']")) return;
            const ambiente = obterAmbientePorta(expandidas[index]) || "-";
            const header = label.querySelector(".thermal-header") || label;
            const div = document.createElement("div");
            div.dataset.ambienteEtiqueta = "true";
            div.innerHTML = `<strong>Ambiente:</strong> ${textoSeguro(ambiente)}`;
            header.appendChild(div);
        });
    }

    function instalarPatchFuncaoImpressao(nomeFuncao, callbackDepois) {
        const fn = window[nomeFuncao];
        if (typeof fn !== "function" || fn.__ambientePatch) return false;

        const fnComAmbiente = function (...args) {
            const resultado = fn.apply(this, args);
            callbackDepois();
            return resultado;
        };
        fnComAmbiente.__ambientePatch = true;

        window[nomeFuncao] = fnComAmbiente;
        try { eval(`${nomeFuncao} = window[nomeFuncao]`); } catch (_) {}
        return true;
    }

    function instalarPatchesImpressao() {
        instalarPatchFuncaoImpressao("atualizarResumoImpressao", enriquecerResumoOrcamento);
        instalarPatchFuncaoImpressao("atualizarResumoOrdem", enriquecerOrdemProducao);
        instalarPatchFuncaoImpressao("atualizarEtiquetasTermicas", enriquecerEtiquetasTermicas);
        instalarPatchFuncaoImpressao("imprimirOrcamento", enriquecerResumoOrcamento);
        instalarPatchFuncaoImpressao("imprimirOrdemProducao", enriquecerOrdemProducao);
        instalarPatchFuncaoImpressao("imprimirEtiquetaTermica", enriquecerEtiquetasTermicas);
    }

    function observarPortasSalvas() {
        const alvo = document.getElementById("portasSalvas");
        if (!alvo || alvo.__ambienteObserver) return;

        const observer = new MutationObserver(() => {
            enriquecerTabelaPortas();
        });
        observer.observe(alvo, { childList: true, subtree: true });
        alvo.__ambienteObserver = observer;
    }

    function aplicarTudo() {
        aplicarCampoAmbienteNasTipologias();
        instalarPatchRenderCampos();
        instalarPatchSalvarPorta();
        instalarPatchPreencherCamposPorta();
        instalarPatchesImpressao();
        garantirCampoAmbiente();
        observarPortasSalvas();
        enriquecerTabelaPortas();
        enriquecerResumoOrcamento();
        enriquecerOrdemProducao();
        enriquecerEtiquetasTermicas();
    }

    document.addEventListener("DOMContentLoaded", aplicarTudo);

    // Como alguns scripts são carregados dinamicamente após o DOMContentLoaded,
    // repetimos a instalação por alguns segundos até tudo estar disponível.
    let tentativas = 0;
    const interval = setInterval(() => {
        aplicarTudo();
        tentativas += 1;
        if (tentativas >= 20) clearInterval(interval);
    }, 500);

    window.ColorGlassAmbientesPortas = {
        aplicarTudo,
        enriquecerTabelaPortas,
        enriquecerResumoOrcamento,
        enriquecerOrdemProducao,
        enriquecerEtiquetasTermicas
    };
})();
