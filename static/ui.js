// =====================
// TIPOLOGIAS
// =====================
const TIPOLOGIAS = {
    giro: ["largura", "altura", "perfil", "vidro", "dobradicas", "dobradicas_alturas", "puxador", "altura_puxador", "medida_puxador", "valor_adicional", "puxadores", "acessorio", "observacao_venda", "observacao_producao"],
    deslizante: ["largura", "altura", "perfil", "vidro", "sistemas", "trilhos_superior", "trilhos_inferior", "trilho", "puxador", "altura_puxador", "medida_puxador", "valor_adicional", "puxadores", "acessorio", "observacao_venda", "observacao_producao"],
    correr: ["largura", "altura", "perfil", "vidro", "sistemas", "trilhos_superior", "trilhos_inferior", "trilho", "valor_adicional", "puxadores", "acessorio", "observacao_venda", "observacao_producao"],
    pivotante: ["largura", "altura", "perfil", "vidro", "pivo", "puxador", "altura_puxador", "medida_puxador", "valor_adicional", "puxadores", "acessorio", "observacao_venda", "observacao_producao"]
};

// =====================
// UI
// =====================
function atualizarPerfisSelect() {
    const tipo = document.getElementById("tipologia").value;
    const perfilSelect = document.getElementById("perfil");
    if (!perfilSelect) return;
    perfilSelect.innerHTML = "<option value=''>Selecione</option>";
    todosPerfis.filter(p => p.tipologias.includes(tipo))
        .forEach(p => {
            perfilSelect.innerHTML += `<option value="${p.id}">${p.nome} - R$ ${p.preco}/m</option>`;
        });
}

function atualizarVidrosSelect() {
    const vidroSelect = document.getElementById("vidro");
    if (!vidroSelect) return;
    vidroSelect.innerHTML = "<option value=''>Selecione</option>";
    todosVidros.forEach(v => {
        vidroSelect.innerHTML += `<option value="${v.id}">${v.tipo} ${v.espessura || ""}mm - R$ ${v.preco}/m²</option>`;
    });
}

let sistemasLista = [];
let sistemasCarregados = false;

async function carregarSistemas() {
    if (sistemasCarregados) return;
    try {
        const res = await fetch("https://colorglass.onrender.com/api/sistemas");
        const data = await res.json();
        sistemasLista = Array.isArray(data) ? data : [];
        sistemasCarregados = true;
        atualizarSistemasSelect();
    } catch (err) {
        console.error("Erro ao carregar sistemas:", err);
    }
}

function atualizarSistemasSelect() {
    const sistemasSelect = document.getElementById("sistemas");
    if (!sistemasSelect) return;
    const valorAtual = sistemasSelect.value;
    sistemasSelect.innerHTML = "<option value=''>Selecione</option>";
    sistemasLista.forEach((sistema) => {
        const opt = document.createElement("option");
        opt.value = sistema.id;
        opt.textContent = sistema.nome;
        sistemasSelect.appendChild(opt);
    });
    sistemasSelect.value = valorAtual;
}

function atualizarTrilhosDoSistema() {
    const sistemasSelect = document.getElementById("sistemas");
    if (!sistemasSelect) return;
    const sistemaId = sistemasSelect.value;
    const sistema = sistemasLista.find((item) => String(item.id) === String(sistemaId));
    const trilhosSuperiorEl = document.getElementById("trilhos_superior");
    const trilhosInferiorEl = document.getElementById("trilhos_inferior");
    const trilhoResumoEl = document.getElementById("trilho");
    const trilhosSuperior = sistema?.trilhos_superior || [];
    const trilhosInferior = sistema?.trilhos_inferior || [];

    if (trilhosSuperiorEl) {
        const valorAtual = trilhosSuperiorEl.value;
        trilhosSuperiorEl.innerHTML = "<option value=''>Selecione</option>";
        trilhosSuperior.forEach((trilho) => {
            const opt = document.createElement("option");
            opt.value = trilho;
            opt.textContent = trilho;
            trilhosSuperiorEl.appendChild(opt);
        });
        if (valorAtual && trilhosSuperior.includes(valorAtual)) {
            trilhosSuperiorEl.value = valorAtual;
        } else if (trilhosSuperior.length === 1) {
            trilhosSuperiorEl.value = trilhosSuperior[0];
        }
    }

    if (trilhosInferiorEl) {
        const valorAtual = trilhosInferiorEl.value;
        trilhosInferiorEl.innerHTML = "<option value=''>Selecione</option>";
        trilhosInferior.forEach((trilho) => {
            const opt = document.createElement("option");
            opt.value = trilho;
            opt.textContent = trilho;
            trilhosInferiorEl.appendChild(opt);
        });
        if (valorAtual && trilhosInferior.includes(valorAtual)) {
            trilhosInferiorEl.value = valorAtual;
        } else if (trilhosInferior.length === 1) {
            trilhosInferiorEl.value = trilhosInferior[0];
        }
    }

    if (trilhoResumoEl) {
        const superiorSelecionado = trilhosSuperiorEl?.value || "";
        const inferiorSelecionado = trilhosInferiorEl?.value || "";
        const partes = [];
        if (superiorSelecionado) partes.push(`Superiores: ${superiorSelecionado}`);
        if (inferiorSelecionado) partes.push(`Inferiores: ${inferiorSelecionado}`);
        trilhoResumoEl.value = partes.join(" | ");
    }
}

function atualizarResumoTrilhos() {
    const trilhoResumoEl = document.getElementById("trilho");
    if (!trilhoResumoEl) return;
    const superiorSelecionado = document.getElementById("trilhos_superior")?.value || "";
    const inferiorSelecionado = document.getElementById("trilhos_inferior")?.value || "";
    const partes = [];
    if (superiorSelecionado) partes.push(`Superiores: ${superiorSelecionado}`);
    if (inferiorSelecionado) partes.push(`Inferiores: ${inferiorSelecionado}`);
    trilhoResumoEl.value = partes.join(" | ");
}

function atualizarPuxadoresSelect() {
    const puxadorSelect = document.getElementById("puxador");
    if (!puxadorSelect) return;
    puxadorSelect.innerHTML = "<option value=''>Selecione</option>";
    puxadorSelect.innerHTML += "<option value='sem_puxador'>Sem puxador</option>";
    todosPuxadores.forEach(p => {
        const unidade = p.tipo_medida === "metro_linear" ? "m" : "un";
        puxadorSelect.innerHTML += `<option value="${p.id}">${p.nome} - R$ ${p.preco}/${unidade}</option>`;
    });
}

function renderCampos() {
    const tipo = document.getElementById("tipologia").value;
    const container = document.getElementById("campos");
    container.innerHTML = "";
    if (!TIPOLOGIAS[tipo]) return;

    TIPOLOGIAS[tipo].forEach(c => {
        const map = {
            largura: `Largura (mm)<input id="largura" type="number" value="800" data-required="true" oninput="desenharPorta(); atualizarPrecoPorta(); atualizarLimiteDobradicas(); atualizarCamposObrigatorios()">`,
            altura: `Altura (mm)<input id="altura" type="number" value="2000" data-required="true" oninput="desenharPorta(); atualizarPrecoPorta(); atualizarLimiteDobradicas(); atualizarCamposObrigatorios()">`,
            perfil: `Perfil<select id="perfil" data-required="true" onchange="atualizarPrecoPorta(); atualizarCamposObrigatorios()"></select>`,
            vidro: `Vidro<select id="vidro" data-required="true" onchange="atualizarPrecoPorta(); atualizarCamposObrigatorios()"></select>`,
            dobradicas: `Quantidade de dobradiças<input id="dobradicas" type="number" value="0" min="0" oninput="atualizarDobradicasInputs(); atualizarPrecoPorta(); atualizarCamposObrigatorios()">`,
            dobradicas_alturas: `Alturas das dobradiças<div id="dobradicasContainer" class="helper-text">Defina a quantidade para gerar os campos.</div>`,
            puxador: `Puxador<select id="puxador" data-required="true" onchange="atualizarPuxadorTipo(); atualizarPrecoPorta(); atualizarCamposObrigatorios()"></select>`,
            altura_puxador: `Altura do puxador (mm)<input id="altura_puxador" type="number" value="1000" min="0" oninput="desenharPorta()">`,
            medida_puxador: `Tamanho do puxador (mm)<input id="medida_puxador" type="number" value="0" min="0" oninput="atualizarPrecoPorta(); desenharPorta()">`,
            valor_adicional: `Valor adicional (R$)<input id="valor_adicional" type="number" value="0" min="0" step="0.01" oninput="atualizarPrecoPorta()">`,
            puxadores: `Descrição do puxador<input id="puxadores" type="text" placeholder="Ex: puxador 60cm">`,
            acessorio: `Acessório<textarea id="acessorio" rows="2"></textarea>`,
            observacao_venda: `Observação de venda<textarea id="observacao_venda" rows="2"></textarea>`,
            observacao_producao: `Observação de produção<textarea id="observacao_producao" rows="2"></textarea>`,
            trilho: `<input id="trilho" type="hidden" value="">`,
            trilhos_superior: `Trilhos superiores<select id="trilhos_superior" data-required="true" onchange="atualizarResumoTrilhos(); atualizarCamposObrigatorios()"></select>`,
            trilhos_inferior: `Trilhos inferiores<select id="trilhos_inferior" data-required="true" onchange="atualizarResumoTrilhos(); atualizarCamposObrigatorios()"></select>`,
            sistemas: `Sistema<select id="sistemas" data-required="true" onchange="atualizarTrilhosDoSistema(); atualizarCamposObrigatorios()"></select>`,
            pivo: `Pivo<textarea id="pivo" rows="2"></textarea>`
        };
        if (map[c]) container.innerHTML += `<label>${map[c]}</label>`;
    });
    atualizarPerfisSelect();
    atualizarVidrosSelect();
    atualizarPuxadoresSelect();
    atualizarPuxadorTipo();
    atualizarDobradicasInputs();
    if (tipo === "deslizante" || tipo === "correr") {
        carregarSistemas().then(() => {
            atualizarTrilhosDoSistema();
        });
    }
    atualizarPrecoPorta();
    desenharPorta();
    atualizarCamposObrigatorios();
}

function atualizarPuxadorTipo() {
    const puxadorId = document.getElementById("puxador")?.value;
    const medidaInput = document.getElementById("medida_puxador");
    if (!medidaInput) return;

    if (puxadorId === "sem_puxador") {
        medidaInput.disabled = true;
        medidaInput.value = "0";
        return;
    }

    const puxador = todosPuxadores.find(p => p.id == puxadorId);
    if (!puxador) {
        medidaInput.disabled = false;
        return;
    }

    if (puxador.tipo_medida === "metro_linear") {
        medidaInput.disabled = false;
    } else {
        medidaInput.disabled = true;
        medidaInput.value = "0";
    }
}

function atualizarDobradicasInputs() {
    const container = document.getElementById("dobradicasContainer");
    if (!container) return;
    const qtd = parseInt(document.getElementById("dobradicas")?.value || "0", 10) || 0;
    if (qtd <= 0) {
        container.innerHTML = "<span class='helper-text'>Defina a quantidade para gerar os campos.</span>";
        return;
    }

    container.innerHTML = "";
    for (let i = 0; i < qtd; i++) {
        container.innerHTML += `
            <input class="dobradica-altura" type="number" placeholder="Altura ${i + 1} (mm)" min="0" oninput="desenharPorta()">
        `;
    }
}

function obterAlturasDobradicas() {
    const inputs = document.querySelectorAll(".dobradica-altura");
    return Array.from(inputs)
        .map(input => input.value)
        .filter(valor => valor !== "");
}

function atualizarLimiteDobradicas() {
    const altura = +document.getElementById("altura")?.value || 0;
    const qtd = Math.max(0, Math.floor(altura / 700));
    const input = document.getElementById("dobradicas");
    if (input && qtd > 0) {
        input.max = qtd;
    }
}

function atualizarCamposObrigatorios() {
    const camposObrigatorios = document.querySelectorAll("[data-required='true']");
    camposObrigatorios.forEach(campo => {
        if (!campo.value) {
            campo.style.border = "1px solid red";
        } else {
            campo.style.border = "";
        }
    });
}

function desenharPorta() {
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

    const puxadorId = document.getElementById("puxador")?.value;
    const deveDesenharPuxador = puxadorId && puxadorId !== "sem_puxador";
    if (deveDesenharPuxador) {
        const handleLength = (+document.getElementById("medida_puxador")?.value || 0) * scale;
        const handlePos = (+document.getElementById("altura_puxador")?.value || 0) * scale;
        const handleHeight = handleLength > 0 ? handleLength : doorHeight * 0.4;
        const handleX = x + doorWidth - 18;
        const handleY = y + doorHeight - handlePos - handleHeight / 2;
        svg.innerHTML += `<rect x="${handleX}" y="${handleY}" width="8" height="${handleHeight}" fill="#f0c24c" />`;
    }

    const alturasDobradicas = obterAlturasDobradicas();
    alturasDobradicas.forEach((alturaDobradica) => {
        const pos = (+alturaDobradica || 0) * scale;
        const yPos = y + doorHeight - pos;
        svg.innerHTML += `<circle cx="${x + 6}" cy="${yPos}" r="4" fill="#0d5d8c" />`;
        svg.innerHTML += `<line x1="${x + 6}" y1="${yPos}" x2="${x + 24}" y2="${yPos}" stroke="#0d5d8c" stroke-width="2" />`;
    });
}

function atualizarPrecoPorta() {
    const preco = calcularPrecoPorta();
    const precoEl = document.getElementById("precoPorta");
    if (precoEl) {
        precoEl.textContent = `Preço estimado: R$ ${preco.toFixed(2)}`;
    }
    atualizarDetalhesCusto();
    desenharPorta();
}

function toggleDetalhesCustos() {
    const detalhes = document.getElementById("detalhesCustos");
    const toggle = document.getElementById("toggleCustos");
    if (!detalhes || !toggle) return;
    detalhes.style.display = toggle.checked ? "block" : "none";
    if (toggle.checked) {
        atualizarDetalhesCusto();
    }
}

function atualizarDetalhesCusto() {
    const detalhes = document.getElementById("detalhesCustos");
    const toggle = document.getElementById("toggleCustos");
    if (!detalhes || !toggle || !toggle.checked) return;

    const largura = (+document.getElementById("largura")?.value || 0) / 1000;
    const altura = (+document.getElementById("altura")?.value || 0) / 1000;
    const valorAdicional = +document.getElementById("valor_adicional")?.value || 0;
    const perimetro = 2 * (largura + altura);

    const perfil = todosPerfis.find(p => p.id == document.getElementById("perfil")?.value);
    const vidro = todosVidros.find(v => v.id == document.getElementById("vidro")?.value);
    const insumos = (perfil?.insumos || [])
        .map((nome) => todosInsumos.find((insumo) => insumo.nome === nome))
        .filter(Boolean);

    const puxadorInfo = obterDadosPuxador();
    const medidas = calcularMedidasPorta();
    const tagAplicada = calcularTagAplicada(obterTagCorrespondente(), medidas);

    if (!perfil && !vidro && insumos.length === 0 && !puxadorInfo && valorAdicional <= 0) {
        detalhes.innerHTML = "<em>Selecione perfil, vidro e tipologia para ver os custos.</em>";
        return;
    }

    const linhas = [];
    let custoTotal = 0;
    let precoTotal = 0;

    if (perfil) {
        const custoPerfil = (perfil.custo || 0) * perimetro;
        const precoPerfil = (perfil.preco || 0) * perimetro;
        custoTotal += custoPerfil;
        precoTotal += precoPerfil;
        linhas.push({
            item: `Perfil (${perfil.nome})`,
            quantidade: `${perimetro.toFixed(2)} m`,
            custo: custoPerfil,
            preco: precoPerfil
        });
    }

    if (vidro) {
        const area = largura * altura;
        const custoVidro = (vidro.custo || 0) * area;
        const precoVidro = (vidro.preco || 0) * area;
        custoTotal += custoVidro;
        precoTotal += precoVidro;
        linhas.push({
            item: `Vidro (${vidro.tipo})`,
            quantidade: `${area.toFixed(2)} m²`,
            custo: custoVidro,
            preco: precoVidro
        });
    }

    insumos.forEach((insumo) => {
        const tipo = insumo.tipo_medida;
        let quantidadeInsumo = 0;
        if (tipo === "metro_linear") {
            quantidadeInsumo = perimetro;
        } else if (tipo === "unidade") {
            quantidadeInsumo = 1;
        } else {
            return;
        }

        const custoInsumo = (insumo.custo || 0) * quantidadeInsumo;
        const precoInsumo = (insumo.preco || 0) * quantidadeInsumo;
        custoTotal += custoInsumo;
        precoTotal += precoInsumo;
        linhas.push({
            item: `Insumo (${insumo.nome})`,
            quantidade: tipo === "metro_linear"
                ? `${quantidadeInsumo.toFixed(2)} m`
                : `${quantidadeInsumo} un`,
            custo: custoInsumo,
            preco: precoInsumo
        });
    });

    if (puxadorInfo) {
        const custoPuxador = (puxadorInfo.puxador.custo || 0) * puxadorInfo.quantidade;
        const precoPuxador = (puxadorInfo.puxador.preco || 0) * puxadorInfo.quantidade;
        custoTotal += custoPuxador;
        precoTotal += precoPuxador;
        linhas.push({
            item: `Puxador (${puxadorInfo.puxador.nome})`,
            quantidade: puxadorInfo.tipoMedida === "metro_linear"
                ? `${puxadorInfo.quantidade.toFixed(2)} m`
                : `${puxadorInfo.quantidade} un`,
            custo: custoPuxador,
            preco: precoPuxador
        });
    }

    if (valorAdicional > 0) {
        custoTotal += valorAdicional;
        precoTotal += valorAdicional;
        linhas.push({
            item: "Valor adicional",
            quantidade: "1 un",
            custo: valorAdicional,
            preco: valorAdicional
        });
    }

    if (tagAplicada) {
        custoTotal += tagAplicada.total;
        precoTotal += tagAplicada.total;
        const unidadeTexto = tagAplicada.tag.medida === "m2"
            ? "m²"
            : tagAplicada.tag.medida === "perimetro"
                ? "m"
                : "un";
        const tagNome = Array.isArray(tagAplicada.tag.tags) && tagAplicada.tag.tags.length
            ? tagAplicada.tag.tags.join(", ")
            : [tagAplicada.tag.perfis, tagAplicada.tag.vidros].filter(Boolean).join(" - ") || "Tag aplicada";
        linhas.push({
            item: `Tag (${tagNome})`,
            quantidade: `${tagAplicada.quantidade.toFixed(2)} ${unidadeTexto}`,
            custo: tagAplicada.total,
            preco: tagAplicada.total
        });
    }

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
                ${linhas.map((linha) => `
                    <tr>
                        <td>${linha.item}</td>
                        <td>${linha.quantidade}</td>
                        <td>${formatarMoeda(linha.custo)}</td>
                        <td>${formatarMoeda(linha.preco)}</td>
                    </tr>
                `).join("")}
            </tbody>
            <tfoot>
                <tr>
                    <th colspan="2">Totais</th>
                    <th>${formatarMoeda(custoTotal)}</th>
                    <th>${formatarMoeda(precoTotal)}</th>
                </tr>
            </tfoot>
        </table>
    `;
}

// =====================
// CRUD PORTAS
// =====================
async function salvarPorta() {
    const tipo = document.getElementById("tipologia").value;
    if (!tipo) return alert("Selecione a tipologia");

    const medidas = calcularMedidasPorta();
    const largura = medidas.larguraMm;
    const altura = medidas.alturaMm;
    const quantidade = +document.getElementById("quantidade")?.value || 0;
    const perfilSelecionado = document.getElementById("perfil")?.value;
    const vidroSelecionado = document.getElementById("vidro")?.value;
    const puxadorSelecionado = document.getElementById("puxador")?.value;
    const dobradicasQtd = parseInt(document.getElementById("dobradicas")?.value || "0", 10) || 0;
    const alturasDobradicas = obterAlturasDobradicas();

    const pendencias = [];
    if (!largura) pendencias.push("Largura");
    if (!altura) pendencias.push("Altura");
    if (!quantidade) pendencias.push("Quantidade");
    if (!perfilSelecionado) pendencias.push("Perfil");
    if (!vidroSelecionado) pendencias.push("Vidro");
    if (tipo !== "correr" && !puxadorSelecionado) pendencias.push("Puxador");
    if (tipo === "giro" && dobradicasQtd < 2) pendencias.push("Dobradiças (mínimo 2)");
    if (dobradicasQtd > 0 && alturasDobradicas.length !== dobradicasQtd) {
        pendencias.push("Alturas das dobradiças");
    }

    if (pendencias.length > 0) {
        alert(`Preencha os campos obrigatórios: ${pendencias.join(", ")}`);
        return;
    }

    const dados = {};
    TIPOLOGIAS[tipo].forEach(c => {
        const el = document.getElementById(c);
        if (el) dados[c] = el.value;
    });
    if (tipo === "giro") {
        dados.dobradicas_alturas = obterAlturasDobradicas();
    } else {
        dados.dobradicas = "0";
        dados.dobradicas_alturas = [];
    }

    const porta = {
        id: editando ?? idCounter++,
        tipo,
        dados,
        quantidade,
        m2: Number(medidas.area.toFixed(4)),
        metro_linear: Number(medidas.perimetro.toFixed(4)),
        tag_aplicada: calcularTagAplicada(obterTagCorrespondente(), medidas),
        preco: calcularPrecoPorta(),
        svg: portaSVG.outerHTML
    };
    const nextPortas = editando === null
        ? [...portas, porta]
        : portas.map(p => (p.id === editando ? porta : p));
    const portasComUUID = nextPortas.map(p => ({ ...p, orcamento_uuid: ORCAMENTO_UUID }));
    try {
        await salvarPortasBackend(portasComUUID);
        alert("Porta salva com sucesso!");
        portas = nextPortas;
        editando = null;
        renderPortas();
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar porta: " + err.message);
    }
}

function renderPortas() {
    const c = document.getElementById("portasSalvas");
    c.innerHTML = "";
    portas.forEach((p, idx) => {
        const perfilNome = todosPerfis.find(perfil => perfil.id == p.dados.perfil)?.nome || "Perfil não definido";
        const vidroNome = todosVidros.find(vidro => vidro.id == p.dados.vidro)?.tipo || "Vidro não definido";
        const puxadorNome = p.dados.puxador === "sem_puxador"
            ? "Sem puxador"
            : (todosPuxadores.find(puxador => puxador.id == p.dados.puxador)?.nome || "Puxador não definido");
        const puxadorLinha = p.tipo === "correr"
            ? ""
            : `Puxador: ${puxadorNome}<br>`;
        const valorAdicional = Number(p.dados.valor_adicional || 0);
        const quantidadeDobradicas = parseInt(p.dados.dobradicas || "0", 10) || 0;
        const dobradicasLinha = p.tipo === "giro"
            ? `Dobradiças: ${quantidadeDobradicas}<br>`
            : "";
        c.innerHTML += `
            <div>
                <strong>${idx + 1}. ${p.tipo}</strong><br>
                Quantidade: ${p.quantidade}<br>
                Perfil: ${perfilNome}<br>
                Vidro: ${vidroNome}<br>
                ${puxadorLinha}
                Valor adicional: ${valorAdicional ? formatarMoeda(valorAdicional) : "-"}<br>
                ${dobradicasLinha}
                Preço: R$ ${p.preco.toFixed(2)}<br>
                ${p.svg}<br>
                <button class="btn" onclick="copiarPorta(${p.id})">Copiar</button>
                <button class="btn" onclick="editarPorta(${p.id})">Editar</button>
                <button class="btn btn-danger" onclick="apagarPorta(${p.id})">Apagar</button>
            </div>
        `;
    });
    atualizarResumoImpressao();
    atualizarResumoOrdem();
}

function editarPorta(id) {
    const porta = portas.find(p => p.id === id);
    if (!porta) return;
    editando = id;
    document.getElementById("tipologia").value = porta.tipo;
    document.getElementById("quantidade").value = porta.quantidade;
    renderCampos();
    for (const k in porta.dados) {
        const el = document.getElementById(k);
        if (el) el.value = porta.dados[k];
    }
    if (Array.isArray(porta.dados.dobradicas_alturas)) {
        const inputs = document.querySelectorAll(".dobradica-altura");
        porta.dados.dobradicas_alturas.forEach((altura, idx) => {
            if (inputs[idx]) inputs[idx].value = altura;
        });
    }
    atualizarPuxadorTipo();
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
        });
    }
}

function copiarPorta(id) {
    const porta = portas.find(p => p.id === id);
    if (!porta) return;
    editando = null;
    document.getElementById("tipologia").value = porta.tipo;
    document.getElementById("quantidade").value = porta.quantidade;
    renderCampos();
    for (const k in porta.dados) {
        const el = document.getElementById(k);
        if (el) el.value = porta.dados[k];
    }
    if (Array.isArray(porta.dados.dobradicas_alturas)) {
        const inputs = document.querySelectorAll(".dobradica-altura");
        porta.dados.dobradicas_alturas.forEach((altura, idx) => {
            if (inputs[idx]) inputs[idx].value = altura;
        });
    }
    atualizarPuxadorTipo();
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
        });
    }
}

function apagarPorta(id) {
    if (!confirm("Tem certeza que deseja apagar esta porta?")) return;
    portas = portas.filter(p => p.id !== id);
    renderPortas();
}

window.TIPOLOGIAS = TIPOLOGIAS;
window.atualizarPerfisSelect = atualizarPerfisSelect;
window.atualizarVidrosSelect = atualizarVidrosSelect;
window.atualizarPuxadoresSelect = atualizarPuxadoresSelect;
window.renderCampos = renderCampos;
window.atualizarPuxadorTipo = atualizarPuxadorTipo;
window.atualizarTrilhosDoSistema = atualizarTrilhosDoSistema;
window.atualizarResumoTrilhos = atualizarResumoTrilhos;
window.atualizarDobradicasInputs = atualizarDobradicasInputs;
window.obterAlturasDobradicas = obterAlturasDobradicas;
window.atualizarLimiteDobradicas = atualizarLimiteDobradicas;
window.atualizarCamposObrigatorios = atualizarCamposObrigatorios;
window.desenharPorta = desenharPorta;
window.atualizarPrecoPorta = atualizarPrecoPorta;
window.toggleDetalhesCustos = toggleDetalhesCustos;
window.atualizarDetalhesCusto = atualizarDetalhesCusto;
window.salvarPorta = salvarPorta;
window.renderPortas = renderPortas;
window.editarPorta = editarPorta;
window.copiarPorta = copiarPorta;
window.apagarPorta = apagarPorta;
