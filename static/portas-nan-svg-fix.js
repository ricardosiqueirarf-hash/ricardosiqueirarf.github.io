// =====================
// FIX: SVG com NaN em portas salvas
// =====================
// Alguns orçamentos antigos podem ter salvo p.svg contendo atributos NaN.
// Quando a tela renderiza esses SVGs, o navegador gera erros contínuos como:
// <circle> cy NaN, <line> y1/y2 NaN, <text> y NaN.
// Este patch evita renderizar/salvar SVG inválido e deixa a OP gerar SVG limpo a partir dos dados.

(function instalarPortasNanSvgFix() {
    const SVG_INVALIDO_REGEX = /\b(?:NaN|Infinity|-Infinity|undefined|null)\b/i;
    let renderizandoPortasSeguro = false;

    function numeroSeguro(valor, fallback = 0) {
        if (valor === null || valor === undefined) return fallback;
        const texto = String(valor).trim().replace(",", ".");
        if (!texto) return fallback;
        const numero = Number(texto);
        return Number.isFinite(numero) ? numero : fallback;
    }

    function textoSeguro(valor, fallback = "-") {
        const texto = String(valor ?? "").trim();
        return texto || fallback;
    }

    function svgPortaSeguro(svg) {
        if (typeof svg !== "string") return "";
        const texto = svg.trim();
        if (!texto) return "";
        if (SVG_INVALIDO_REGEX.test(texto)) return "";
        if (/<script[\s>]/i.test(texto) || /on\w+=/i.test(texto)) return "";
        return texto;
    }

    function limparPortaParaSalvar(porta) {
        const limpa = { ...(porta || {}) };
        limpa.dados = { ...(porta?.dados || {}) };
        limpa.svg = svgPortaSeguro(porta?.svg);
        return limpa;
    }

    function obterPerfilNome(porta) {
        const lista = Array.isArray(window.todosPerfis) ? window.todosPerfis : (typeof todosPerfis !== "undefined" ? todosPerfis : []);
        return lista.find((perfil) => String(perfil.id) === String(porta?.dados?.perfil))?.nome || "Perfil não definido";
    }

    function obterVidroNome(porta) {
        const lista = Array.isArray(window.todosVidros) ? window.todosVidros : (typeof todosVidros !== "undefined" ? todosVidros : []);
        return lista.find((vidro) => String(vidro.id) === String(porta?.dados?.vidro))?.tipo || "Vidro não definido";
    }

    function obterSistemaNome(porta) {
        const lista = typeof sistemasLista !== "undefined" && Array.isArray(sistemasLista) ? sistemasLista : [];
        return lista.find((sistema) => String(sistema.id) === String(porta?.dados?.sistemas))?.nome || "";
    }

    function moeda(valor) {
        if (typeof window.formatarMoeda === "function") return window.formatarMoeda(valor || 0);
        return `R$ ${(Number(valor) || 0).toFixed(2)}`;
    }

    function renderPortasSeguro() {
        if (renderizandoPortasSeguro) return;
        renderizandoPortasSeguro = true;

        try {
            const container = document.getElementById("portasSalvas");
            if (!container) return;

            const listaPortas = Array.isArray(window.portas) ? window.portas : (typeof portas !== "undefined" ? portas : []);
            container.innerHTML = "";

            listaPortas.forEach((porta, idx) => {
                const p = limparPortaParaSalvar(porta);
                const dados = p.dados || {};
                const valorAdicional = numeroSeguro(dados.valor_adicional, 0);
                const svg = svgPortaSeguro(p.svg);
                const div = document.createElement("div");
                div.innerHTML = `
                    <strong>${idx + 1}. ${textoSeguro(p.tipo, "Porta")}</strong><br>
                    Quantidade: ${textoSeguro(p.quantidade, "1")}<br>
                    Perfil: ${obterPerfilNome(p)}<br>
                    Vidro: ${obterVidroNome(p)}<br>
                    ${obterSistemaNome(p) ? `Sistema: ${obterSistemaNome(p)}<br>` : ""}
                    Medida: ${textoSeguro(dados.largura)} x ${textoSeguro(dados.altura)} mm<br>
                    Valor adicional: ${valorAdicional ? moeda(valorAdicional) : "-"}<br>
                    Preço: ${moeda(p.preco || 0)}<br>
                    ${svg}<br>
                    <button class="btn" onclick="copiarPorta(${Number(p.id)})">Copiar</button>
                    <button class="btn" onclick="editarPorta(${Number(p.id)})">Editar</button>
                    <button class="btn btn-danger" onclick="apagarPorta(${Number(p.id)})">Apagar</button>
                `;
                container.appendChild(div);
            });

            if (typeof window.atualizarResumoImpressao === "function") window.atualizarResumoImpressao();
            if (typeof window.atualizarResumoOrdem === "function") window.atualizarResumoOrdem();
        } finally {
            renderizandoPortasSeguro = false;
        }
    }

    function gerarSvgOrdemProducaoSeguro(porta) {
        const dados = porta?.dados || {};
        const largura = numeroSeguro(dados.largura, 0);
        const altura = numeroSeguro(dados.altura, 0);
        const quantidade = Math.max(1, parseInt(porta?.quantidade || "1", 10) || 1);

        if (largura <= 0 || altura <= 0) return "";

        const canvasWidth = 420;
        const canvasHeight = 560;
        const padding = 60;
        const availableWidth = canvasWidth - padding * 2;
        const availableHeight = canvasHeight - padding * 2;
        const scale = Math.min(availableWidth / largura, availableHeight / altura);

        if (!Number.isFinite(scale) || scale <= 0) return "";

        const doorWidth = largura * scale;
        const doorHeight = altura * scale;
        const doorX = padding + (availableWidth - doorWidth) / 2;
        const doorY = padding + (availableHeight - doorHeight) / 2;
        const alturaTextX = doorX - 40;
        const alturaTextY = doorY + doorHeight / 2;
        const larguraTextX = doorX + doorWidth / 2;
        const larguraTextY = doorY + doorHeight + 44;
        const quantidadeX = doorX + doorWidth / 2;
        const quantidadeY = doorY + doorHeight / 2;
        const ladoDobradicas = dados.dobradicas_posicao === "direita" ? "direita" : "esquerda";
        const dobradicaX = ladoDobradicas === "direita" ? doorX + doorWidth - 6 : doorX + 6;
        const dobradicaLinhaFim = ladoDobradicas === "direita"
            ? Math.max(doorX, dobradicaX - 20)
            : Math.min(doorX + doorWidth, dobradicaX + 20);

        const alturas = typeof window.normalizarAlturasDobradicas === "function"
            ? window.normalizarAlturasDobradicas(dados.dobradicas_alturas)
            : [];

        const dobradicasSvg = (Array.isArray(alturas) ? alturas : [])
            .map((valor) => numeroSeguro(valor, 0))
            .filter((valor) => valor > 0)
            .map((alturaDobradica) => {
                const alturaLimitada = Math.max(0, Math.min(altura, alturaDobradica));
                const yPos = doorY + doorHeight - (alturaLimitada * scale);
                if (!Number.isFinite(yPos)) return "";
                const textoX = ladoDobradicas === "direita" ? dobradicaLinhaFim - 8 : dobradicaLinhaFim + 8;
                const textoAnchor = ladoDobradicas === "direita" ? "end" : "start";
                return `
                    <circle cx="${dobradicaX}" cy="${yPos}" r="4" fill="#0d5d8c" />
                    <line x1="${dobradicaX}" y1="${yPos}" x2="${dobradicaLinhaFim}" y2="${yPos}" stroke="#0d5d8c" stroke-width="2" />
                    <text x="${textoX}" y="${yPos - 4}" font-size="18" font-weight="700" fill="#0d5d8c" stroke="#ffffff" stroke-width="0.9" paint-order="stroke" text-anchor="${textoAnchor}">${alturaLimitada} mm</text>
                `;
            })
            .join("");

        const svg = `
            <svg class="op-svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
                <rect x="${doorX}" y="${doorY}" width="${doorWidth}" height="${doorHeight}" fill="#f4f8ff" stroke="#1079ba" stroke-width="3"/>
                ${dobradicasSvg}
                <text x="${quantidadeX}" y="${quantidadeY}" class="op-quantity" text-anchor="middle" dominant-baseline="middle">${quantidade}x</text>
                <line x1="${doorX - 16}" y1="${doorY}" x2="${doorX - 16}" y2="${doorY + doorHeight}" stroke="#333"/>
                <line x1="${doorX - 22}" y1="${doorY}" x2="${doorX}" y2="${doorY}" stroke="#333"/>
                <line x1="${doorX - 22}" y1="${doorY + doorHeight}" x2="${doorX}" y2="${doorY + doorHeight}" stroke="#333"/>
                <text x="${alturaTextX}" y="${alturaTextY}" class="op-measure" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${alturaTextX} ${alturaTextY})">${altura} mm</text>
                <line x1="${doorX}" y1="${doorY + doorHeight + 20}" x2="${doorX + doorWidth}" y2="${doorY + doorHeight + 20}" stroke="#333"/>
                <line x1="${doorX}" y1="${doorY + doorHeight + 16}" x2="${doorX}" y2="${doorY + doorHeight + 24}" stroke="#333"/>
                <line x1="${doorX + doorWidth}" y1="${doorY + doorHeight + 16}" x2="${doorX + doorWidth}" y2="${doorY + doorHeight + 24}" stroke="#333"/>
                <text x="${larguraTextX}" y="${larguraTextY}" class="op-measure" text-anchor="middle">${largura} mm</text>
            </svg>
        `;

        return svgPortaSeguro(svg);
    }

    function instalar() {
        if (typeof window.renderPortas === "function") {
            window.renderPortas = renderPortasSeguro;
        }

        if (typeof window.renderizarPortas === "function") {
            window.renderizarPortas = renderPortasSeguro;
        }

        if (typeof window.gerarSvgOrdemProducao === "function") {
            window.gerarSvgOrdemProducao = gerarSvgOrdemProducaoSeguro;
        }

        if (typeof window.salvarPortasBackend === "function" && !window.salvarPortasBackend.__nanSvgFix) {
            const salvarOriginal = window.salvarPortasBackend;
            const salvarSeguro = function salvarPortasBackendSeguro(portasComUUID) {
                const limpas = Array.isArray(portasComUUID)
                    ? portasComUUID.map(limparPortaParaSalvar)
                    : portasComUUID;
                return salvarOriginal(limpas);
            };
            salvarSeguro.__nanSvgFix = true;
            window.salvarPortasBackend = salvarSeguro;
        }
    }

    instalar();

    let tentativas = 0;
    const timer = setInterval(() => {
        tentativas += 1;
        instalar();
        if (tentativas >= 40) clearInterval(timer);
    }, 25);
})();
