// =====================
// RESTAURA FUNÇÕES OPERACIONAIS DA TELA DE PORTAS
// Mantém salvar/renderizar/editar/copiar após ajustes de cálculo.
// =====================

function removerOpcaoPivotanteDaTela() {
    const select = document.getElementById("tipologia");
    if (!select) return;
    Array.from(select.options).forEach((option) => {
        if (option.value === "pivotante") option.remove();
    });
}

function atualizarCamposObrigatorios() {
    const camposObrigatorios = document.querySelectorAll("[data-required='true']");
    camposObrigatorios.forEach(campo => {
        campo.style.border = campo.value ? "" : "1px solid red";
    });
}

function normalizarAlturasDobradicas(valor) {
    if (Array.isArray(valor)) {
        return valor.map((item) => String(item)).filter((item) => item !== "");
    }
    if (typeof valor === "string") {
        const texto = valor.trim();
        if (!texto) return [];
        try {
            const parsed = JSON.parse(texto);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item)).filter((item) => item !== "");
            }
        } catch (_) {}
        return texto.split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
}

function preencherAlturasDobradicas(dadosPorta) {
    const alturas = normalizarAlturasDobradicas(dadosPorta?.dobradicas_alturas);
    const inputQtd = document.getElementById("dobradicas");
    if (!inputQtd || alturas.length === 0) return;

    inputQtd.value = String(alturas.length);
    atualizarDobradicasInputs();

    const inputs = document.querySelectorAll(".dobradica-altura");
    alturas.forEach((altura, index) => {
        if (inputs[index]) inputs[index].value = altura;
    });
}

function desenharPorta() {
    if (typeof window.renderizarPorta3D === "function") {
        window.renderizarPorta3D();
        return;
    }

    const svg = document.getElementById("portaSVG");
    if (!svg) return;
    const largura = +document.getElementById("largura")?.value || 0;
    const altura = +document.getElementById("altura")?.value || 0;

    svg.setAttribute("viewBox", "0 0 400 600");
    svg.innerHTML = "";

    if (largura <= 0 || altura <= 0) {
        svg.innerHTML = "<text x='50%' y='50%' text-anchor='middle'>Informe largura e altura</text>";
        return;
    }

    const scale = Math.min(320 / largura, 520 / altura);
    const doorWidth = largura * scale;
    const doorHeight = altura * scale;
    const x = (400 - doorWidth) / 2;
    const y = (600 - doorHeight) / 2;

    svg.innerHTML += `<rect x="${x}" y="${y}" width="${doorWidth}" height="${doorHeight}" fill="#e7f3fb" stroke="#1079ba" stroke-width="4" rx="8" />`;
}

function atualizarPrecoPorta() {
    const preco = typeof calcularPrecoPorta === "function" ? calcularPrecoPorta() : 0;
    const precoEl = document.getElementById("precoPorta");
    if (precoEl) precoEl.textContent = `Preço estimado: R$ ${preco.toFixed(2)}`;
    atualizarDetalhesCusto();
    desenharPorta();
    if (typeof renderizarConferenciaCalculoPorta === "function") renderizarConferenciaCalculoPorta();
}

function toggleDetalhesCustos() {
    const detalhes = document.getElementById("detalhesCustos");
    const toggle = document.getElementById("toggleCustos");
    if (!detalhes || !toggle) return;
    detalhes.style.display = toggle.checked ? "block" : "none";
    if (toggle.checked) atualizarDetalhesCusto();
}

function formatarQuantidadeLinhaPorta(linha) {
    const casas = linha.unidade === "un" ? 0 : 3;
    return `${Number(linha.quantidade || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })} ${linha.unidade || ""}`;
}

function atualizarDetalhesCusto() {
    const detalhes = document.getElementById("detalhesCustos");
    const toggle = document.getElementById("toggleCustos");
    if (!detalhes || !toggle || !toggle.checked) return;

    if (typeof calcularComponentesPortaAtual !== "function") {
        detalhes.innerHTML = "<em>Cálculo ainda não carregado.</em>";
        return;
    }

    const componentes = calcularComponentesPortaAtual();
    const linhas = componentes.linhas || [];
    if (!linhas.length) {
        detalhes.innerHTML = "<em>Selecione perfil, vidro e tipologia para ver os custos.</em>";
        return;
    }

    const custoTotal = linhas.reduce((acc, linha) => acc + (Number(linha.item?.custo ?? linha.unitario ?? 0) * Number(linha.quantidade || 0)), 0);
    const precoTotal = linhas.reduce((acc, linha) => acc + Number(linha.total || 0), 0);

    detalhes.innerHTML = `
        <strong>Detalhamento de custos e preços</strong>
        <table>
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Quantidade</th>
                    <th>Custo</th>
                    <th>Preço</th>
                </tr>
            </thead>
            <tbody>
                ${linhas.map((linha) => {
                    const custoLinha = Number(linha.item?.custo ?? linha.unitario ?? 0) * Number(linha.quantidade || 0);
                    return `
                        <tr>
                            <td>${linha.nome}</td>
                            <td>${formatarQuantidadeLinhaPorta(linha)}</td>
                            <td>${formatarMoeda(custoLinha)}</td>
                            <td>${formatarMoeda(linha.total)}</td>
                        </tr>
                    `;
                }).join("")}
            </tbody>
            <tfoot>
                <tr>
                    <th colspan="2">Totais por porta</th>
                    <th>${formatarMoeda(custoTotal)}</th>
                    <th>${formatarMoeda(precoTotal)}</th>
                </tr>
            </tfoot>
        </table>
    `;
}

async function salvarPorta() {
    const tipo = document.getElementById("tipologia").value;
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
    if (document.getElementById("puxador") && tipo !== "correr" && !puxadorSelecionado) pendencias.push("Puxador");
    if (tipo === "giro" && dobradicasQtd < 2) pendencias.push("Dobradiças (mínimo 2)");
    if (dobradicasQtd > 0 && alturasDobradicas.length !== dobradicasQtd) pendencias.push("Alturas das dobradiças");
    if (tipo === "giro" && !document.getElementById("dobradicas_posicao")?.value) pendencias.push("Lado das dobradiças");
    if (document.getElementById("puxador_posicao") && tipo !== "correr" && !document.getElementById("puxador_posicao")?.value) pendencias.push("Lado do puxador");
    if ((tipo === "deslizante" || tipo === "correr") && !document.getElementById("sistemas")?.value) pendencias.push("Sistema");
    if ((tipo === "deslizante" || tipo === "correr") && !document.getElementById("trilhos_superior")?.value) pendencias.push("Trilho superior");
    if ((tipo === "deslizante" || tipo === "correr") && !document.getElementById("trilhos_inferior")?.value) pendencias.push("Trilho inferior");

    if (pendencias.length > 0) {
        alert(`Preencha os campos obrigatórios: ${pendencias.join(", ")}`);
        return;
    }

    const portaExistente = editando !== null ? portas.find(p => p.id === editando) : null;
    const dados = portaExistente?.dados ? { ...portaExistente.dados } : {};
    TIPOLOGIAS[tipo].forEach(c => {
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
    const portasComUUID = nextPortas.map((p) => ({ ...p, orcamento_uuid: ORCAMENTO_UUID }));

    try {
        await salvarPortasBackend(portasComUUID);
        alert("Porta salva com sucesso!");
        portas = nextPortas;
        editando = null;
        renderPortas();
        if (typeof verificarFerramentaOrcamentoAtual === "function") verificarFerramentaOrcamentoAtual();
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar porta: " + err.message);
    }
}

function renderPortas() {
    const c = document.getElementById("portasSalvas");
    if (!c) return;
    c.innerHTML = "";
    portas.forEach((p, idx) => {
        const perfilNome = todosPerfis.find(perfil => perfil.id == p.dados.perfil)?.nome || "Perfil não definido";
        const vidroNome = todosVidros.find(vidro => vidro.id == p.dados.vidro)?.tipo || "Vidro não definido";
        const sistemaNome = (typeof sistemasLista !== "undefined" && Array.isArray(sistemasLista))
            ? sistemasLista.find(sistema => String(sistema.id) === String(p.dados.sistemas))?.nome
            : "";
        const valorAdicional = Number(p.dados.valor_adicional || 0);
        c.innerHTML += `
            <div>
                <strong>${idx + 1}. ${p.tipo}</strong><br>
                Quantidade: ${p.quantidade}<br>
                Perfil: ${perfilNome}<br>
                Vidro: ${vidroNome}<br>
                ${sistemaNome ? `Sistema: ${sistemaNome}<br>` : ""}
                Valor adicional: ${valorAdicional ? formatarMoeda(valorAdicional) : "-"}<br>
                Preço: R$ ${Number(p.preco || 0).toFixed(2)}<br>
                ${p.svg || ""}<br>
                <button class="btn" onclick="copiarPorta(${p.id})">Copiar</button>
                <button class="btn" onclick="editarPorta(${p.id})">Editar</button>
                <button class="btn btn-danger" onclick="apagarPorta(${p.id})">Apagar</button>
            </div>
        `;
    });
    if (typeof atualizarResumoImpressao === "function") atualizarResumoImpressao();
    if (typeof atualizarResumoOrdem === "function") atualizarResumoOrdem();
}

function preencherCamposPorta(porta) {
    document.getElementById("tipologia").value = porta.tipo;
    document.getElementById("quantidade").value = porta.quantidade;
    renderCampos();
    for (const k in porta.dados) {
        const el = document.getElementById(k);
        if (el) el.value = porta.dados[k];
    }
    preencherAlturasDobradicas(porta.dados);
    atualizarPrecoPorta();
    desenharPorta();
    if (porta.tipo === "deslizante" || porta.tipo === "correr") {
        carregarSistemas().then(() => {
            const sistemasSelect = document.getElementById("sistemas");
            if (sistemasSelect) sistemasSelect.value = porta.dados.sistemas || "";
            atualizarTrilhosDoSistema();
            const trilhosSuperiorSelect = document.getElementById("trilhos_superior");
            const trilhosInferiorSelect = document.getElementById("trilhos_inferior");
            if (trilhosSuperiorSelect) trilhosSuperiorSelect.value = porta.dados.trilhos_superior || "";
            if (trilhosInferiorSelect) trilhosInferiorSelect.value = porta.dados.trilhos_inferior || "";
            atualizarResumoTrilhos();
            atualizarPrecoPorta();
        });
    }
}

function editarPorta(id) {
    const porta = portas.find(p => p.id === id);
    if (!porta) return;
    editando = id;
    preencherCamposPorta(porta);
}

function copiarPorta(id) {
    const porta = portas.find(p => p.id === id);
    if (!porta) return;
    editando = null;
    preencherCamposPorta(porta);
}

function apagarPorta(id) {
    if (!confirm("Tem certeza que deseja apagar esta porta?")) return;
    portas = portas.filter(p => p.id !== id);
    renderPortas();
}

window.removerOpcaoPivotanteDaTela = removerOpcaoPivotanteDaTela;
window.atualizarCamposObrigatorios = atualizarCamposObrigatorios;
window.normalizarAlturasDobradicas = normalizarAlturasDobradicas;
window.preencherAlturasDobradicas = preencherAlturasDobradicas;
window.desenharPorta = desenharPorta;
window.atualizarPrecoPorta = atualizarPrecoPorta;
window.toggleDetalhesCustos = toggleDetalhesCustos;
window.atualizarDetalhesCusto = atualizarDetalhesCusto;
window.salvarPorta = salvarPorta;
window.renderPortas = renderPortas;
window.editarPorta = editarPorta;
window.copiarPorta = copiarPorta;
window.apagarPorta = apagarPorta;

document.addEventListener("DOMContentLoaded", removerOpcaoPivotanteDaTela);
