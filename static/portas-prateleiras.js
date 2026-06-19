// =====================
// PRATELEIRAS - TIPOLOGIA / PERFIS / CÁLCULO
// =====================
(function () {
    const TIPO_PRATELEIRAS = "prateleiras";

    function numeroCampo(id) {
        const valor = document.getElementById(id)?.value;
        const numero = Number(String(valor ?? "").replace(",", "."));
        return Number.isFinite(numero) && numero > 0 ? numero : 0;
    }

    function instalarTipologiaPrateleiras() {
        try {
            if (typeof TIPOLOGIAS !== "undefined") {
                TIPOLOGIAS[TIPO_PRATELEIRAS] = [
                    "largura",
                    "profundidade",
                    "perfil",
                    "vidro",
                    "valor_adicional",
                    "acessorio",
                    "observacao_venda",
                    "observacao_producao"
                ];
            }
        } catch (err) {
            console.warn("Não foi possível registrar a tipologia de prateleiras.", err);
        }
    }

    function renderCamposPrateleiras() {
        const tipo = document.getElementById("tipologia")?.value || "";
        const container = document.getElementById("campos");
        if (!container) return;

        container.innerHTML = "";
        instalarTipologiaPrateleiras();
        if (typeof TIPOLOGIAS === "undefined" || !TIPOLOGIAS[tipo]) return;

        TIPOLOGIAS[tipo].forEach((campo) => {
            const map = {
                largura: `Largura (mm)<input id="largura" type="number" value="800" data-required="true" oninput="desenharPorta(); atualizarPrecoPorta(); atualizarCamposObrigatorios()">`,
                altura: `Altura (mm)<input id="altura" type="number" value="2000" data-required="true" oninput="desenharPorta(); atualizarPrecoPorta(); atualizarCamposObrigatorios()">`,
                profundidade: `Profundidade (mm)<input id="profundidade" type="number" value="450" data-required="true" oninput="desenharPorta(); atualizarPrecoPorta(); atualizarCamposObrigatorios()">`,
                perfil: `Perfil<select id="perfil" data-required="true" onchange="atualizarPuxadoresSelect(); atualizarPuxadorTipo(); atualizarPrecoPorta(); atualizarCamposObrigatorios()"></select>`,
                vidro: `Vidro<select id="vidro" data-required="true" onchange="atualizarPrecoPorta(); atualizarCamposObrigatorios()"></select>`,
                dobradicas: `Quantidade de dobradiças<input id="dobradicas" type="number" value="0" min="0" oninput="atualizarDobradicasInputs(); atualizarPrecoPorta(); atualizarCamposObrigatorios()">`,
                dobradicas_posicao: `Lado das dobradiças<select id="dobradicas_posicao" data-required="true" onchange="desenharPorta(); atualizarCamposObrigatorios()">
                    <option value="">Selecione</option>
                    <option value="esquerda">Esquerda</option>
                    <option value="direita">Direita</option>
                </select>`,
                dobradicas_alturas: `Alturas das dobradiças<div id="dobradicasContainer" class="helper-text">Defina a quantidade para gerar os campos.</div>`,
                puxador: `Puxador<select id="puxador" data-required="true" onchange="atualizarPuxadorTipo(); atualizarPrecoPorta(); atualizarCamposObrigatorios()"></select>`,
                puxador_posicao: `Lado do puxador<select id="puxador_posicao" data-required="true" onchange="desenharPorta(); atualizarCamposObrigatorios()">
                    <option value="">Selecione</option>
                    <option value="esquerda">Esquerda</option>
                    <option value="direita">Direita</option>
                    <option value="cima">Cima</option>
                    <option value="baixo">Baixo</option>
                </select>`,
                medida_puxador: `Tamanho do puxador (mm)<input id="medida_puxador" type="number" value="0" min="0" oninput="atualizarPrecoPorta(); desenharPorta()">`,
                valor_adicional: `Valor adicional (R$)<input id="valor_adicional" type="number" value="0" min="0" step="0.01" oninput="atualizarPrecoPorta()">`,
                puxadores: `Descrição do puxador<input id="puxadores" type="text" placeholder="Ex: puxador 60cm">`,
                acessorio: `Acessório<textarea id="acessorio" rows="2"></textarea>`,
                observacao_venda: `Observação de venda<textarea id="observacao_venda" rows="2"></textarea>`,
                observacao_producao: `Observação de produção<textarea id="observacao_producao" rows="2"></textarea>`,
                trilho: `<input id="trilho" type="hidden" value="">`,
                trilhos_superior: `Trilhos superiores<select id="trilhos_superior" data-required="true" onchange="atualizarResumoTrilhos(); atualizarCamposObrigatorios()"></select>`,
                trilhos_inferior: `Trilhos inferiores<select id="trilhos_inferior" data-required="true" onchange="atualizarResumoTrilhos(); atualizarCamposObrigatorios()"></select>`,
                vao_trilhos_superior: `Tamanho do vão superior (mm)<input id="vao_trilhos_superior" type="number" min="0" value="0" oninput="desenharPorta(); atualizarPrecoPorta()">`,
                vao_trilhos_inferior: `Tamanho do vão inferior (mm)<input id="vao_trilhos_inferior" type="number" min="0" value="0" oninput="desenharPorta(); atualizarPrecoPorta()">`,
                sistemas: `Sistema<select id="sistemas" data-required="true" onchange="atualizarTrilhosDoSistema(); atualizarCamposObrigatorios()"></select>`
            };

            if (map[campo]) container.innerHTML += `<label>${map[campo]}</label>`;
        });

        if (typeof atualizarPerfisSelect === "function") atualizarPerfisSelect();
        if (typeof atualizarVidrosSelect === "function") atualizarVidrosSelect();
        if (typeof atualizarPuxadoresSelect === "function") atualizarPuxadoresSelect();
        if (typeof atualizarPuxadorTipo === "function") atualizarPuxadorTipo();
        if (typeof atualizarDobradicasInputs === "function") atualizarDobradicasInputs();
        if (typeof atualizarLimiteDobradicas === "function") atualizarLimiteDobradicas();

        if (tipo === "deslizante" || tipo === "correr" || tipo === "divisao_ambiente") {
            if (typeof carregarSistemas === "function") {
                carregarSistemas().then(() => {
                    if (typeof atualizarTrilhosDoSistema === "function") atualizarTrilhosDoSistema();
                });
            }
        }

        if (typeof atualizarPrecoPorta === "function") atualizarPrecoPorta();
        if (typeof desenharPorta === "function") desenharPorta();
        if (typeof atualizarCamposObrigatorios === "function") atualizarCamposObrigatorios();
    }
    renderCamposPrateleiras.__prateleirasFix = true;

    function calcularMedidasPortaComPrateleiras() {
        const larguraMm = numeroCampo("largura");
        const alturaMmInput = numeroCampo("altura");
        const profundidadeMm = numeroCampo("profundidade");
        const tipo = document.getElementById("tipologia")?.value || "";
        const alturaMm = tipo === TIPO_PRATELEIRAS ? profundidadeMm : alturaMmInput;
        const larguraM = larguraMm / 1000;
        const alturaM = alturaMm / 1000;
        const profundidadeM = profundidadeMm / 1000;

        return {
            larguraMm,
            alturaMm,
            profundidadeMm,
            larguraM,
            alturaM,
            profundidadeM,
            area: larguraM * alturaM,
            perimetro: 2 * (larguraM + alturaM)
        };
    }

    function renderizarPrateleira3D() {
        const larguraMm = numeroCampo("largura");
        const profundidadeMm = numeroCampo("profundidade");

        if (larguraMm <= 0 || profundidadeMm <= 0) {
            if (typeof mostrarMensagemPorta3D === "function") {
                mostrarMensagemPorta3D("Informe largura e profundidade para visualizar a prateleira em 3D.");
            }
            return;
        }

        if (typeof inicializarCenaPorta3D !== "function" || !inicializarCenaPorta3D()) return;
        if (typeof garantirCanvasPorta3D === "function") garantirCanvasPorta3D();
        if (typeof ocultarMensagemPorta3D === "function") ocultarMensagemPorta3D();
        if (typeof limparCenaPorta3D === "function") limparCenaPorta3D();
        if (typeof criarMaterialPorta3D !== "function" || typeof criarBoxPorta3D !== "function") return;

        const materiais = criarMaterialPorta3D();
        const group = Porta3DState?.group;
        if (!group) return;

        const larguraM = Math.max(0.2, larguraMm / 1000);
        const profundidadeM = Math.max(0.15, profundidadeMm / 1000);
        const espPerfil = Math.max(0.025, Math.min(larguraM, profundidadeM) * 0.045);
        const espVidro = 0.024;

        group.add(criarBoxPorta3D(larguraM, espVidro, profundidadeM, 0, 0, 0, materiais.vidro));
        group.add(criarBoxPorta3D(larguraM, espPerfil, espPerfil, 0, 0.01, -profundidadeM / 2 + espPerfil / 2, materiais.perfilEscuro));
        group.add(criarBoxPorta3D(larguraM, espPerfil, espPerfil, 0, 0.01, profundidadeM / 2 - espPerfil / 2, materiais.perfilEscuro));
        group.add(criarBoxPorta3D(espPerfil, espPerfil, profundidadeM, -larguraM / 2 + espPerfil / 2, 0.012, 0, materiais.perfil));
        group.add(criarBoxPorta3D(espPerfil, espPerfil, profundidadeM, larguraM / 2 - espPerfil / 2, 0.012, 0, materiais.perfil));

        const maiorMedida = Math.max(larguraM, profundidadeM);
        Porta3DState.camera.position.set(maiorMedida * 0.8, maiorMedida * 0.62, maiorMedida * 1.55);
        Porta3DState.camera.lookAt(0, 0, 0);
        group.rotation.y = Porta3DState.rotationY;
        if (typeof redimensionarPorta3D === "function") redimensionarPorta3D();
    }

    function aplicarOverridesPrateleiras() {
        instalarTipologiaPrateleiras();

        try {
            const renderAtual = typeof window.renderCampos === "function" ? window.renderCampos : null;
            if (!renderAtual || (!renderAtual.__divisaoAmbienteFix && !renderAtual.__prateleirasFix)) {
                window.renderCampos = renderCamposPrateleiras;
                renderCampos = renderCamposPrateleiras;
            }
        } catch (_) {}

        try {
            window.calcularMedidasPorta = calcularMedidasPortaComPrateleiras;
            calcularMedidasPorta = calcularMedidasPortaComPrateleiras;
        } catch (_) {}

        if (typeof renderizarPorta3D === "function" && !window.__prateleirasPreviewPatchApplied) {
            const renderOriginal = renderizarPorta3D;
            const renderComPrateleiras = function () {
                const tipo = document.getElementById("tipologia")?.value || "";
                if (tipo === TIPO_PRATELEIRAS) return renderizarPrateleira3D();
                return renderOriginal.apply(this, arguments);
            };

            try {
                window.renderizarPorta3D = renderComPrateleiras;
                renderizarPorta3D = renderComPrateleiras;
            } catch (_) {}

            window.__prateleirasPreviewPatchApplied = true;
        }

        if (typeof desenharPorta === "function" && !window.__prateleirasDesenhoPatchApplied) {
            const desenharOriginal = desenharPorta;
            const desenharComPrateleiras = function () {
                const tipo = document.getElementById("tipologia")?.value || "";
                if (tipo === TIPO_PRATELEIRAS && typeof renderizarPorta3D === "function") return renderizarPorta3D();
                return desenharOriginal.apply(this, arguments);
            };

            try {
                window.desenharPorta = desenharComPrateleiras;
                desenharPorta = desenharComPrateleiras;
            } catch (_) {}

            window.__prateleirasDesenhoPatchApplied = true;
        }
    }

    aplicarOverridesPrateleiras();
    document.addEventListener("DOMContentLoaded", aplicarOverridesPrateleiras);

    let tentativas = 0;
    const timer = setInterval(() => {
        tentativas += 1;
        aplicarOverridesPrateleiras();
        if (window.__prateleirasPreviewPatchApplied || tentativas >= 30) clearInterval(timer);
    }, 400);
})();
