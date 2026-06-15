// =====================
// TIPOLOGIA: DIVISÃO DE AMBIENTE
// =====================
// Novo nome da antiga tipologia "correr".
// Mantém compatibilidade técnica com registros antigos, mas salva novos dados como "divisao_ambiente".

(function instalarDivisaoAmbienteFix() {
    const TIPO_NOVO = "divisao_ambiente";
    const TIPO_ANTIGO = "correr";
    const LABEL_NOVO = "Divisão de ambiente";

    function normalizarTipologiaPorta(tipo) {
        return String(tipo || "").trim() === TIPO_ANTIGO ? TIPO_NOVO : String(tipo || "").trim();
    }

    function formatarTipologiaPorta(tipo) {
        const normalizada = normalizarTipologiaPorta(tipo);
        const mapa = {
            giro: "Giro",
            deslizante: "Deslizante",
            divisao_ambiente: LABEL_NOVO,
            estrutural: "Estrutural",
            pivotante: "Pivotante"
        };
        return mapa[normalizada] || normalizada || "-";
    }

    function tipologiaUsaSistema(tipo) {
        const normalizada = normalizarTipologiaPorta(tipo);
        return normalizada === "deslizante" || normalizada === TIPO_NOVO;
    }

    function normalizarTipologiasArray(lista) {
        return (Array.isArray(lista) ? lista : [])
            .map(normalizarTipologiaPorta)
            .filter(Boolean)
            .filter((valor, index, arr) => arr.indexOf(valor) === index);
    }

    function normalizarObjetoComTipologia(item) {
        if (!item || typeof item !== "object") return item;
        if (Array.isArray(item.tipologias)) item.tipologias = normalizarTipologiasArray(item.tipologias);
        if (Array.isArray(item.tipo)) item.tipo = normalizarTipologiasArray(item.tipo);
        if (item.tipo === TIPO_ANTIGO) item.tipo = TIPO_NOVO;
        return item;
    }

    function normalizarBasesGlobais() {
        if (Array.isArray(window.todosPerfis)) window.todosPerfis.forEach(normalizarObjetoComTipologia);
        if (typeof todosPerfis !== "undefined" && Array.isArray(todosPerfis)) todosPerfis.forEach(normalizarObjetoComTipologia);
        if (Array.isArray(window.todasTags)) window.todasTags.forEach(normalizarObjetoComTipologia);
        if (typeof todasTags !== "undefined" && Array.isArray(todasTags)) todasTags.forEach(normalizarObjetoComTipologia);
        if (Array.isArray(window.sistemasLista)) window.sistemasLista.forEach(normalizarObjetoComTipologia);
        if (typeof sistemasLista !== "undefined" && Array.isArray(sistemasLista)) sistemasLista.forEach(normalizarObjetoComTipologia);
        if (Array.isArray(window.portas)) window.portas.forEach(normalizarObjetoComTipologia);
        if (typeof portas !== "undefined" && Array.isArray(portas)) portas.forEach(normalizarObjetoComTipologia);
    }

    function aplicarOpcaoDivisaoAmbiente() {
        const select = document.getElementById("tipologia");
        if (!select) return;

        let opcaoNova = Array.from(select.options).find((option) => option.value === TIPO_NOVO);
        let opcaoAntiga = Array.from(select.options).find((option) => option.value === TIPO_ANTIGO);

        if (opcaoAntiga) {
            opcaoAntiga.value = TIPO_NOVO;
            opcaoAntiga.textContent = LABEL_NOVO;
            opcaoNova = opcaoAntiga;
        }

        if (!opcaoNova) {
            opcaoNova = document.createElement("option");
            opcaoNova.value = TIPO_NOVO;
            opcaoNova.textContent = LABEL_NOVO;
            select.appendChild(opcaoNova);
        }

        // Opção técnica oculta para funções antigas que ainda checam "correr" internamente.
        if (!Array.from(select.options).some((option) => option.value === TIPO_ANTIGO)) {
            const legacy = document.createElement("option");
            legacy.value = TIPO_ANTIGO;
            legacy.textContent = LABEL_NOVO;
            legacy.hidden = true;
            legacy.disabled = true;
            select.appendChild(legacy);
        }

        if (select.value === TIPO_ANTIGO) select.value = TIPO_NOVO;
    }

    function patchTipoLogiasObjeto() {
        try {
            if (typeof TIPOLOGIAS !== "undefined" && TIPOLOGIAS) {
                if (TIPOLOGIAS[TIPO_ANTIGO] && !TIPOLOGIAS[TIPO_NOVO]) {
                    TIPOLOGIAS[TIPO_NOVO] = [...TIPOLOGIAS[TIPO_ANTIGO]];
                }
                if (!TIPOLOGIAS[TIPO_NOVO]) {
                    TIPOLOGIAS[TIPO_NOVO] = ["largura", "altura", "perfil", "vidro", "sistemas", "trilhos_superior", "trilhos_inferior", "trilho", "valor_adicional", "puxadores", "acessorio", "observacao_venda", "observacao_producao"];
                }
            }
        } catch (_) {}
    }

    function envolverCarregadores() {
        if (typeof window.carregarPerfis === "function" && !window.carregarPerfis.__divisaoAmbienteFix) {
            const original = window.carregarPerfis;
            const wrapped = async function carregarPerfisDivisaoAmbiente() {
                const resultado = await original.apply(this, arguments);
                normalizarBasesGlobais();
                if (typeof window.atualizarPerfisSelect === "function") window.atualizarPerfisSelect();
                return resultado;
            };
            wrapped.__divisaoAmbienteFix = true;
            window.carregarPerfis = wrapped;
        }

        if (typeof window.carregarTags === "function" && !window.carregarTags.__divisaoAmbienteFix) {
            const original = window.carregarTags;
            const wrapped = async function carregarTagsDivisaoAmbiente() {
                const resultado = await original.apply(this, arguments);
                normalizarBasesGlobais();
                return resultado;
            };
            wrapped.__divisaoAmbienteFix = true;
            window.carregarTags = wrapped;
        }
    }

    function patchAtualizarPerfisSelect() {
        if (typeof window.atualizarPerfisSelect !== "function" || window.atualizarPerfisSelect.__divisaoAmbienteFix) return;

        const wrapped = function atualizarPerfisSelectDivisaoAmbiente() {
            const tipo = normalizarTipologiaPorta(document.getElementById("tipologia")?.value);
            const perfilSelect = document.getElementById("perfil");
            if (!perfilSelect) return;
            perfilSelect.innerHTML = "<option value=''>Selecione</option>";
            normalizarBasesGlobais();
            const lista = typeof todosPerfis !== "undefined" && Array.isArray(todosPerfis) ? todosPerfis : [];
            lista
                .filter((p) => normalizarTipologiasArray(p.tipologias).includes(tipo))
                .forEach((p) => {
                    perfilSelect.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
                });
        };

        wrapped.__divisaoAmbienteFix = true;
        window.atualizarPerfisSelect = wrapped;
        try { atualizarPerfisSelect = wrapped; } catch (_) {}
    }

    function patchAtualizarSistemasSelect() {
        if (typeof window.atualizarSistemasSelect !== "function" || window.atualizarSistemasSelect.__divisaoAmbienteFix) return;

        const wrapped = function atualizarSistemasSelectDivisaoAmbiente() {
            const sistemasSelect = document.getElementById("sistemas");
            if (!sistemasSelect) return;
            const tipologiaAtual = normalizarTipologiaPorta(document.getElementById("tipologia")?.value);
            const valorAtual = sistemasSelect.value;
            sistemasSelect.innerHTML = "<option value=''>Selecione</option>";

            normalizarBasesGlobais();
            const lista = typeof sistemasLista !== "undefined" && Array.isArray(sistemasLista) ? sistemasLista : [];
            const sistemasFiltrados = tipologiaAtual
                ? lista.filter((sistema) => {
                    const tipos = normalizarTipologiasArray(sistema.tipo || []);
                    return tipos.includes(tipologiaAtual) || tipos.length === 0;
                })
                : lista;

            sistemasFiltrados.forEach((sistema) => {
                const opt = document.createElement("option");
                opt.value = sistema.id;
                opt.textContent = sistema.nome;
                sistemasSelect.appendChild(opt);
            });
            sistemasSelect.value = valorAtual;
        };

        wrapped.__divisaoAmbienteFix = true;
        window.atualizarSistemasSelect = wrapped;
        try { atualizarSistemasSelect = wrapped; } catch (_) {}
    }

    function patchRenderCampos() {
        if (typeof window.renderCampos !== "function" || window.renderCampos.__divisaoAmbienteFix) return;
        const original = window.renderCampos;
        const wrapped = function renderCamposDivisaoAmbiente() {
            patchTipoLogiasObjeto();
            aplicarOpcaoDivisaoAmbiente();
            const resultado = original.apply(this, arguments);
            const tipo = normalizarTipologiaPorta(document.getElementById("tipologia")?.value);
            if (tipologiaUsaSistema(tipo) && typeof window.carregarSistemas === "function") {
                window.carregarSistemas().then(() => {
                    if (typeof window.atualizarSistemasSelect === "function") window.atualizarSistemasSelect();
                    if (typeof window.atualizarTrilhosDoSistema === "function") window.atualizarTrilhosDoSistema();
                });
            }
            return resultado;
        };
        wrapped.__divisaoAmbienteFix = true;
        window.renderCampos = wrapped;
        try { renderCampos = wrapped; } catch (_) {}
    }

    function withTipoLegadoParaFuncoesAntigas(callback) {
        const select = document.getElementById("tipologia");
        if (!select || normalizarTipologiaPorta(select.value) !== TIPO_NOVO) return callback();

        const valorOriginal = select.value;
        let legacy = Array.from(select.options).find((option) => option.value === TIPO_ANTIGO);
        if (!legacy) {
            legacy = document.createElement("option");
            legacy.value = TIPO_ANTIGO;
            legacy.textContent = LABEL_NOVO;
            legacy.hidden = true;
            select.appendChild(legacy);
        }
        legacy.disabled = false;
        select.value = TIPO_ANTIGO;
        try {
            return callback();
        } finally {
            select.value = valorOriginal;
            legacy.disabled = true;
        }
    }

    function patchCalculosLegados() {
        if (typeof window.calcularComponentesPortaAtual === "function" && !window.calcularComponentesPortaAtual.__divisaoAmbienteFix) {
            const original = window.calcularComponentesPortaAtual;
            const wrapped = function calcularComponentesPortaAtualDivisaoAmbiente() {
                const resultado = withTipoLegadoParaFuncoesAntigas(() => original.apply(this, arguments));
                if (resultado && resultado.tipo === TIPO_ANTIGO) resultado.tipo = TIPO_NOVO;
                return resultado;
            };
            wrapped.__divisaoAmbienteFix = true;
            window.calcularComponentesPortaAtual = wrapped;
            try { calcularComponentesPortaAtual = wrapped; } catch (_) {}
        }

        if (typeof window.calcularPrecoPorta === "function" && !window.calcularPrecoPorta.__divisaoAmbienteFix) {
            const wrapped = function calcularPrecoPortaDivisaoAmbiente() {
                const quantidadePortas = +document.getElementById("quantidade")?.value || 1;
                const componentes = window.calcularComponentesPortaAtual ? window.calcularComponentesPortaAtual() : { linhas: [] };
                const totalPorPorta = (componentes.linhas || []).reduce((acc, linha) => acc + (Number(linha.total) || 0), 0);
                return totalPorPorta * quantidadePortas;
            };
            wrapped.__divisaoAmbienteFix = true;
            window.calcularPrecoPorta = wrapped;
            try { calcularPrecoPorta = wrapped; } catch (_) {}
        }
    }

    function patchPreview3D() {
        if (typeof window.renderizarPorta3D === "function" && !window.renderizarPorta3D.__divisaoAmbienteFix) {
            const original = window.renderizarPorta3D;
            const wrapped = function renderizarPorta3DDivisaoAmbiente() {
                return withTipoLegadoParaFuncoesAntigas(() => original.apply(this, arguments));
            };
            wrapped.__divisaoAmbienteFix = true;
            window.renderizarPorta3D = wrapped;
            try { renderizarPorta3D = wrapped; } catch (_) {}
        }
    }

    function patchSalvarPorta() {
        if (typeof window.salvarPorta !== "function" || window.salvarPorta.__divisaoAmbienteFix) return;

        const wrapped = async function salvarPortaDivisaoAmbiente() {
            const tipo = normalizarTipologiaPorta(document.getElementById("tipologia")?.value);
            if (!tipo) return alert("Selecione a tipologia");
            if (tipo === "pivotante") return alert("Porta pivotante foi removida desta tela.");

            const medidas = calcularMedidasPorta();
            const largura = medidas.larguraMm;
            const altura = medidas.alturaMm;
            const quantidade = +document.getElementById("quantidade")?.value || 0;
            const perfilSelecionado = document.getElementById("perfil")?.value;
            const vidroSelecionado = document.getElementById("vidro")?.value;
            const puxadorSelecionado = document.getElementById("puxador")?.value;
            const dobradicasQtd = parseInt(document.getElementById("dobradicas")?.value || "0", 10) || 0;
            const alturasDobradicas = typeof obterAlturasDobradicas === "function" ? obterAlturasDobradicas() : [];
            const pendencias = [];

            if (!largura) pendencias.push("Largura");
            if (!altura) pendencias.push("Altura");
            if (!quantidade) pendencias.push("Quantidade");
            if (!perfilSelecionado) pendencias.push("Perfil");
            if (!vidroSelecionado) pendencias.push("Vidro");
            if (document.getElementById("puxador") && tipo !== TIPO_NOVO && !puxadorSelecionado) pendencias.push("Puxador");
            if (tipo === "giro" && dobradicasQtd < 2) pendencias.push("Dobradiças (mínimo 2)");
            if (dobradicasQtd > 0 && alturasDobradicas.length !== dobradicasQtd) pendencias.push("Alturas das dobradiças");
            if (tipo === "giro" && !document.getElementById("dobradicas_posicao")?.value) pendencias.push("Lado das dobradiças");
            if (document.getElementById("puxador_posicao") && tipo !== TIPO_NOVO && !document.getElementById("puxador_posicao")?.value) pendencias.push("Lado do puxador");
            if (tipologiaUsaSistema(tipo) && !document.getElementById("sistemas")?.value) pendencias.push("Sistema");
            if (tipologiaUsaSistema(tipo) && !document.getElementById("trilhos_superior")?.value) pendencias.push("Trilho superior");
            if (tipologiaUsaSistema(tipo) && !document.getElementById("trilhos_inferior")?.value) pendencias.push("Trilho inferior");

            if (pendencias.length > 0) {
                alert(`Preencha os campos obrigatórios: ${pendencias.join(", ")}`);
                return;
            }

            const portaExistente = editando !== null ? portas.find(p => p.id === editando) : null;
            const dados = portaExistente?.dados ? { ...portaExistente.dados } : {};
            const campos = (typeof TIPOLOGIAS !== "undefined" && TIPOLOGIAS[tipo]) ? TIPOLOGIAS[tipo] : [];
            campos.forEach(c => {
                const el = document.getElementById(c);
                if (el) dados[c] = el.value;
            });
            dados.dobradicas_alturas = alturasDobradicas;

            const portaSVGEl = document.getElementById("portaSVG");
            const porta = {
                id: editando ?? idCounter++,
                tipo,
                dados,
                quantidade,
                m2: Number(medidas.area.toFixed(4)),
                metro_linear: Number(medidas.perimetro.toFixed(4)),
                tag_aplicada: calcularTagAplicada(obterTagCorrespondente(), medidas),
                preco: calcularPrecoPorta(),
                svg: portaSVGEl ? portaSVGEl.outerHTML : ""
            };

            const nextPortas = editando === null ? [...portas, porta] : portas.map(p => (p.id === editando ? porta : p));
            const portasComUUID = nextPortas.map((p) => ({ ...p, tipo: normalizarTipologiaPorta(p.tipo), orcamento_uuid: ORCAMENTO_UUID }));

            try {
                await salvarPortasBackend(portasComUUID);
                alert("Porta salva com sucesso!");
                portas = nextPortas.map((p) => ({ ...p, tipo: normalizarTipologiaPorta(p.tipo) }));
                editando = null;
                renderPortas();
                if (typeof verificarFerramentaOrcamentoAtual === "function") verificarFerramentaOrcamentoAtual();
            } catch (err) {
                console.error(err);
                alert("Erro ao salvar porta: " + err.message);
            }
        };

        wrapped.__divisaoAmbienteFix = true;
        window.salvarPorta = wrapped;
        try { salvarPorta = wrapped; } catch (_) {}
    }

    function patchEditarPorta() {
        if (typeof window.preencherCamposPorta === "function" && !window.preencherCamposPorta.__divisaoAmbienteFix) {
            const original = window.preencherCamposPorta;
            const wrapped = function preencherCamposPortaDivisaoAmbiente(porta) {
                const normalizada = { ...(porta || {}), tipo: normalizarTipologiaPorta(porta?.tipo), dados: { ...(porta?.dados || {}) } };
                const resultado = original.call(this, normalizada);
                aplicarOpcaoDivisaoAmbiente();
                if (document.getElementById("tipologia")) document.getElementById("tipologia").value = normalizada.tipo;
                if (tipologiaUsaSistema(normalizada.tipo) && typeof window.carregarSistemas === "function") {
                    window.carregarSistemas().then(() => {
                        const sistemasSelect = document.getElementById("sistemas");
                        if (sistemasSelect) sistemasSelect.value = normalizada.dados.sistemas || "";
                        if (typeof window.atualizarTrilhosDoSistema === "function") window.atualizarTrilhosDoSistema();
                        const trilhosSuperiorSelect = document.getElementById("trilhos_superior");
                        const trilhosInferiorSelect = document.getElementById("trilhos_inferior");
                        if (trilhosSuperiorSelect) trilhosSuperiorSelect.value = normalizada.dados.trilhos_superior || "";
                        if (trilhosInferiorSelect) trilhosInferiorSelect.value = normalizada.dados.trilhos_inferior || "";
                        if (typeof window.atualizarResumoTrilhos === "function") window.atualizarResumoTrilhos();
                        if (typeof window.atualizarPrecoPorta === "function") window.atualizarPrecoPorta();
                    });
                }
                return resultado;
            };
            wrapped.__divisaoAmbienteFix = true;
            window.preencherCamposPorta = wrapped;
            try { preencherCamposPorta = wrapped; } catch (_) {}
        }
    }

    function patchSalvarBackend() {
        if (typeof window.salvarPortasBackend === "function" && !window.salvarPortasBackend.__divisaoAmbienteFix) {
            const original = window.salvarPortasBackend;
            const wrapped = function salvarPortasBackendDivisaoAmbiente(portasComUUID) {
                const normalizadas = Array.isArray(portasComUUID)
                    ? portasComUUID.map((p) => ({ ...p, tipo: normalizarTipologiaPorta(p.tipo) }))
                    : portasComUUID;
                return original(normalizadas);
            };
            wrapped.__divisaoAmbienteFix = true;
            window.salvarPortasBackend = wrapped;
        }
    }

    function instalar() {
        window.TIPOLOGIA_DIVISAO_AMBIENTE = TIPO_NOVO;
        window.normalizarTipologiaPorta = normalizarTipologiaPorta;
        window.formatarTipologiaPorta = formatarTipologiaPorta;
        window.tipologiaUsaSistema = tipologiaUsaSistema;
        window.normalizarTipologiasArray = normalizarTipologiasArray;
        window.normalizarObjetoComTipologia = normalizarObjetoComTipologia;

        patchTipoLogiasObjeto();
        aplicarOpcaoDivisaoAmbiente();
        normalizarBasesGlobais();
        envolverCarregadores();
        patchAtualizarPerfisSelect();
        patchAtualizarSistemasSelect();
        patchRenderCampos();
        patchCalculosLegados();
        patchPreview3D();
        patchSalvarPorta();
        patchEditarPorta();
        patchSalvarBackend();
    }

    instalar();
    document.addEventListener("DOMContentLoaded", instalar);

    let tentativas = 0;
    const timer = setInterval(() => {
        tentativas += 1;
        instalar();
        if (tentativas >= 80) clearInterval(timer);
    }, 25);
})();
