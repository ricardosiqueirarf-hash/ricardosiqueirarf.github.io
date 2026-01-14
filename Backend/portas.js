if (localStorage.getItem("darkmode") === "true") {
    document.getElementById("tema-css").href = "/static/css/indexdark.css";
}
 
function go(p){ window.location.href = p }

// =====================
// BACKEND
// =====================
const API_BASE = "https://colorglass.onrender.com";

function authHeader() {
    const token = localStorage.getItem("ADMIN_TOKEN");
    return token ? { "Authorization": "Bearer " + token } : {};
}

// =====================
// UUID DO ORÇAMENTO
// =====================
const params = new URLSearchParams(window.location.search)
const ORCAMENTO_UUID = params.get("orcamento_uuid")
let orcamentoInfo = { cliente_nome: null, numero_pedido: null }
if(!ORCAMENTO_UUID){
    document.getElementById("infoOrcamento").innerHTML =
        "<strong style='color:red'>UUID do orçamento não encontrado</strong>"
    throw new Error("orcamento_uuid ausente")
}
document.getElementById("infoOrcamento").innerHTML =
    `Editando orçamento: <strong>${ORCAMENTO_UUID}</strong>`

// =====================
// TIPOLOGIAS
// =====================
const TIPOLOGIAS = {
    giro: ["largura","altura","perfil","vidro","dobradicas","dobradicas_alturas","puxador","altura_puxador","medida_puxador","valor_adicional","puxadores","acessorio","observacao_venda","observacao_producao"],
    deslizante: ["largura","altura","perfil","vidro","trilho","dobradicas","dobradicas_alturas","puxador","altura_puxador","medida_puxador","valor_adicional","puxadores","acessorio","observacao_venda","observacao_producao"],
    correr: ["largura","altura","perfil","vidro","trilho","dobradicas","dobradicas_alturas","puxador","altura_puxador","medida_puxador","valor_adicional","puxadores","acessorio","observacao_venda","observacao_producao"],
    pivotante: ["largura","altura","perfil","vidro","pivo","dobradicas","dobradicas_alturas","puxador","altura_puxador","medida_puxador","valor_adicional","puxadores","acessorio","observacao_venda","observacao_producao"]
}

// =====================
// DADOS
// =====================
let todosPerfis = []
let todosVidros = []
let todosInsumos = []
let todosPuxadores = []
let todasTags = []

async function carregarPerfis() {
    const res = await fetch(`${API_BASE}/api/perfis`)
    todosPerfis = await res.json()
    atualizarPerfisSelect()
}

async function carregarVidros() {
    const res = await fetch(`${API_BASE}/api/vidros`)
    todosVidros = await res.json()
    atualizarVidrosSelect()
}

async function carregarInsumos() {
    const res = await fetch(`${API_BASE}/api/materiais`)
    todosInsumos = await res.json()
    atualizarDetalhesCusto()
}

async function carregarPuxadores() {
    const res = await fetch(`${API_BASE}/api/puxadores`, { headers: authHeader() })
    todosPuxadores = await res.json()
    atualizarPuxadoresSelect()
}

async function carregarTags() {
    const res = await fetch(`${API_BASE}/api/tags`)
    todasTags = await res.json()
    atualizarPrecoPorta()
}

function atualizarPerfisSelect() {
    const tipo = document.getElementById("tipologia").value
    const perfilSelect = document.getElementById("perfil")
    if(!perfilSelect) return
    perfilSelect.innerHTML = "<option value=''>Selecione</option>"
    todosPerfis.filter(p => p.tipologias.includes(tipo))
        .forEach(p => {
            perfilSelect.innerHTML += `<option value="${p.id}">${p.nome} - R$ ${p.preco}/m</option>`
        })
}

function atualizarVidrosSelect() {
    const vidroSelect = document.getElementById("vidro")
    if(!vidroSelect) return
    vidroSelect.innerHTML = "<option value=''>Selecione</option>"
    todosVidros.forEach(v => {
        vidroSelect.innerHTML += `<option value="${v.id}">${v.tipo} ${v.espessura || ""}mm - R$ ${v.preco}/m²</option>`
    })
}

function atualizarPuxadoresSelect() {
    const puxadorSelect = document.getElementById("puxador")
    if(!puxadorSelect) return
    puxadorSelect.innerHTML = "<option value=''>Selecione</option>"
    puxadorSelect.innerHTML += "<option value='sem_puxador'>Sem puxador</option>"
    todosPuxadores.forEach(p => {
        const unidade = p.tipo_medida === "metro_linear" ? "m" : "un"
        puxadorSelect.innerHTML += `<option value="${p.id}">${p.nome} - R$ ${p.preco}/${unidade}</option>`
    })
}

// =====================
// PREÇO
// =====================
function obterDadosPuxador() {
    const puxadorId = document.getElementById("puxador")?.value
    if (puxadorId === "sem_puxador") return null
    const puxador = todosPuxadores.find(p => p.id == puxadorId)
    if (!puxador) return null

    const tipoMedida = puxador.tipo_medida
    const quantidadePortas = +document.getElementById("quantidade")?.value || 1
    const medidaPuxadorMm = +document.getElementById("medida_puxador")?.value || 0

    let quantidade = 0
    if (tipoMedida === "metro_linear") {
        quantidade = medidaPuxadorMm / 1000
    } else {
        quantidade = quantidadePortas
    }

    return {
        puxador,
        tipoMedida,
        quantidade,
        medidaPuxadorMm
    }
}

function normalizarTagValor(valor) {
    return String(valor || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
}

function obterTagCorrespondente() {
    const perfil = todosPerfis.find(p => p.id == document.getElementById("perfil")?.value)
    const vidro  = todosVidros.find(v => v.id == document.getElementById("vidro")?.value)

    if (!perfil || !vidro || !Array.isArray(todasTags) || todasTags.length === 0) return null

    const perfilIdKey = String(perfil.id)
    const vidroIdKey  = String(vidro.id)

    const espessura = String(vidro.espessura || "").trim()
    const vidroKeys = [
        [vidro.tipo, espessura].filter(Boolean).join(" - "),
        [vidro.tipo, espessura].filter(Boolean).join(" "),
        [vidro.tipo, espessura ? `${espessura}mm` : ""].filter(Boolean).join(" "),
        vidro.tipo
    ].filter(Boolean).map(normalizarTagValor)

    // DEBUG opcional
    console.group("🔍 TAG MATCHING (fix)")
    console.log("Perfil:", perfilIdKey, perfil.nome)
    console.log("Vidro:", vidroIdKey, vidro.tipo, vidro.espessura)
    console.log("VidroKeys:", vidroKeys)

    const match = todasTags.find((tag) => {
        const perfisTagRaw = tag.perfis != null ? String(tag.perfis) : ""
        const vidrosTagRaw = tag.vidros != null ? String(tag.vidros) : ""
        const tagsArr      = Array.isArray(tag.tags) ? tag.tags.map(normalizarTagValor) : []

        // 1) Match forte (por colunas perfis/vidros)
        const matchesPerfis = perfisTagRaw ? perfisTagRaw === perfilIdKey : true

        const vidrosTagNorm = normalizarTagValor(vidrosTagRaw)
        const matchesVidros = vidrosTagRaw
            ? (vidrosTagRaw === vidroIdKey || vidroKeys.includes(vidrosTagNorm))
            : true

        const strongMatch = (perfisTagRaw || vidrosTagRaw) && matchesPerfis && matchesVidros

        // 2) Match fraco (apenas pelo array tags[]), NÃO bloqueia o forte
        const weakMatch =
            tagsArr.includes(perfilIdKey) &&
            (tagsArr.includes(vidroIdKey) || vidroKeys.some(k => tagsArr.includes(k)))

        const ok = strongMatch || weakMatch

        if (ok) console.log("✅ MATCH:", tag)
        else console.log("❌ NO MATCH:", { tag, perfisTagRaw, vidrosTagRaw, tagsArr, matchesPerfis, matchesVidros, strongMatch, weakMatch })

        return ok
    }) || null

    console.groupEnd()
    return match
}



function calcularMedidasPorta() {
    const larguraMm = +document.getElementById("largura")?.value || 0
    const alturaMm = +document.getElementById("altura")?.value || 0
    const larguraM = larguraMm / 1000
    const alturaM = alturaMm / 1000
    return {
        larguraMm,
        alturaMm,
        larguraM,
        alturaM,
        area: larguraM * alturaM,
        perimetro: 2 * (larguraM + alturaM)
    }
}

function calcularTagAplicada(tag, medidas) {
    if (!tag || !tag.valor || !medidas) return null
    let quantidade = 0
    if (tag.medida === "m2") {
        quantidade = medidas.area
    } else if (tag.medida === "perimetro") {
        quantidade = medidas.perimetro
    } else if (tag.medida === "unidade") {
        quantidade = 1
    }
    if (!quantidade) return null
    const valorUnitario = Number(tag.valor) || 0
    return {
        tag,
        quantidade,
        total: valorUnitario * quantidade
    }
}

function calcularPrecoPorta(){
    const medidas = calcularMedidasPorta()
    const largura = medidas.larguraM
    const altura = medidas.alturaM
    const perfil = todosPerfis.find(p=>p.id==document.getElementById("perfil")?.value)
    const vidro = todosVidros.find(v=>v.id==document.getElementById("vidro")?.value)
    const quantidadePortas = +document.getElementById("quantidade")?.value || 1
    const valorAdicional = +document.getElementById("valor_adicional")?.value || 0
    const perimetro = medidas.perimetro
    const insumos = (perfil?.insumos || [])
        .map((nome) => todosInsumos.find((insumo) => insumo.nome === nome))
        .filter(Boolean)

    let total = 0
    if(perfil) total += perfil.preco * 2 * (largura + altura)
    if(vidro) total += vidro.preco * largura * altura
    insumos.forEach((insumo) => {
        const tipo = insumo.tipo_medida
        let quantidadeInsumo = 0
        if (tipo === "metro_linear") {
            quantidadeInsumo = perimetro
        } else if (tipo === "unidade") {
            quantidadeInsumo = quantidadePortas
        }
        total += (insumo.preco || 0) * quantidadeInsumo
    })

    const puxadorInfo = obterDadosPuxador()
    if (puxadorInfo) {
        total += (puxadorInfo.puxador.preco || 0) * puxadorInfo.quantidade
    }

    const tagAplicada = calcularTagAplicada(obterTagCorrespondente(), medidas)
    if (tagAplicada) {
        total += tagAplicada.total
    }

    total += valorAdicional
    return total * quantidadePortas
}

function atualizarPrecoPorta(){
    const preco = calcularPrecoPorta()
    const precoEl = document.getElementById("precoPorta")
    if (precoEl) {
        precoEl.textContent = `Preço estimado: R$ ${preco.toFixed(2)}`
    }
    atualizarDetalhesCusto()
    desenharPorta()
}

function toggleDetalhesCustos() {
    const detalhes = document.getElementById("detalhesCustos")
    const toggle = document.getElementById("toggleCustos")
    if (!detalhes || !toggle) return
    detalhes.style.display = toggle.checked ? "block" : "none"
    if (toggle.checked) {
        atualizarDetalhesCusto()
    }
}

function formatarMoeda(valor) {
    return `R$ ${Number(valor).toFixed(2)}`
}

function atualizarDetalhesCusto() {
    const detalhes = document.getElementById("detalhesCustos")
    const toggle = document.getElementById("toggleCustos")
    if (!detalhes || !toggle || !toggle.checked) return

    const largura = (+document.getElementById("largura")?.value || 0) / 1000
    const altura = (+document.getElementById("altura")?.value || 0) / 1000
    const quantidadePortas = +document.getElementById("quantidade")?.value || 1
    const valorAdicional = +document.getElementById("valor_adicional")?.value || 0
    const perimetro = 2 * (largura + altura)

    const perfil = todosPerfis.find(p => p.id == document.getElementById("perfil")?.value)
    const vidro = todosVidros.find(v => v.id == document.getElementById("vidro")?.value)
    const insumos = (perfil?.insumos || [])
        .map((nome) => todosInsumos.find((insumo) => insumo.nome === nome))
        .filter(Boolean)

    const puxadorInfo = obterDadosPuxador()
    const medidas = calcularMedidasPorta()
    const tagAplicada = calcularTagAplicada(obterTagCorrespondente(), medidas)

    if (!perfil && !vidro && insumos.length === 0 && !puxadorInfo && valorAdicional <= 0) {
        detalhes.innerHTML = "<em>Selecione perfil, vidro e tipologia para ver os custos.</em>"
        return
    }

    const linhas = []
    let custoTotal = 0
    let precoTotal = 0

    if (perfil) {
        const custoPerfil = (perfil.custo || 0) * perimetro
        const precoPerfil = (perfil.preco || 0) * perimetro
        custoTotal += custoPerfil
        precoTotal += precoPerfil
        linhas.push({
            item: `Perfil (${perfil.nome})`,
            quantidade: `${perimetro.toFixed(2)} m`,
            custo: custoPerfil,
            preco: precoPerfil
        })
    }

    if (vidro) {
        const area = largura * altura
        const custoVidro = (vidro.custo || 0) * area
        const precoVidro = (vidro.preco || 0) * area
        custoTotal += custoVidro
        precoTotal += precoVidro
        linhas.push({
            item: `Vidro (${vidro.tipo})`,
            quantidade: `${area.toFixed(2)} m²`,
            custo: custoVidro,
            preco: precoVidro
        })
    }

    insumos.forEach((insumo) => {
        const tipo = insumo.tipo_medida
        let quantidadeInsumo = 0
        if (tipo === "metro_linear") {
            quantidadeInsumo = perimetro
        } else if (tipo === "unidade") {
            quantidadeInsumo = quantidadePortas
        } else {
            return
        }

        const custoInsumo = (insumo.custo || 0) * quantidadeInsumo
        const precoInsumo = (insumo.preco || 0) * quantidadeInsumo
        custoTotal += custoInsumo
        precoTotal += precoInsumo
        linhas.push({
            item: `Insumo (${insumo.nome})`,
            quantidade: tipo === "metro_linear"
                ? `${quantidadeInsumo.toFixed(2)} m`
                : `${quantidadeInsumo} un`,
            custo: custoInsumo,
            preco: precoInsumo
        })
    })

    if (puxadorInfo) {
        const custoPuxador = (puxadorInfo.puxador.custo || 0) * puxadorInfo.quantidade
        const precoPuxador = (puxadorInfo.puxador.preco || 0) * puxadorInfo.quantidade
        custoTotal += custoPuxador
        precoTotal += precoPuxador
        linhas.push({
            item: `Puxador (${puxadorInfo.puxador.nome})`,
            quantidade: puxadorInfo.tipoMedida === "metro_linear"
                ? `${puxadorInfo.quantidade.toFixed(2)} m`
                : `${puxadorInfo.quantidade} un`,
            custo: custoPuxador,
            preco: precoPuxador
        })
    }

    if (valorAdicional > 0) {
        custoTotal += valorAdicional
        precoTotal += valorAdicional
        linhas.push({
            item: "Valor adicional",
            quantidade: "1 un",
            custo: valorAdicional,
            preco: valorAdicional
        })
    }

    if (tagAplicada) {
        custoTotal += tagAplicada.total
        precoTotal += tagAplicada.total
        const unidadeTexto = tagAplicada.tag.medida === "m2"
            ? "m²"
            : tagAplicada.tag.medida === "perimetro"
                ? "m"
                : "un"
        const tagNome = Array.isArray(tagAplicada.tag.tags) && tagAplicada.tag.tags.length
            ? tagAplicada.tag.tags.join(", ")
            : [tagAplicada.tag.perfis, tagAplicada.tag.vidros].filter(Boolean).join(" - ") || "Tag aplicada"
        linhas.push({
            item: `Tag (${tagNome})`,
            quantidade: `${tagAplicada.quantidade.toFixed(2)} ${unidadeTexto}`,
            custo: tagAplicada.total,
            preco: tagAplicada.total
        })
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
    `
}

// =====================
// RENDER CAMPOS
// =====================
function renderCampos(){
    const tipo = document.getElementById("tipologia").value
    const container = document.getElementById("campos")
    container.innerHTML=""
    if(!TIPOLOGIAS[tipo]) return

    TIPOLOGIAS[tipo].forEach(c=>{
        const map={
            largura:`Largura (mm)<input id="largura" type="number" value="800" data-required="true" oninput="desenharPorta(); atualizarPrecoPorta(); atualizarLimiteDobradicas(); atualizarCamposObrigatorios()">`,
            altura:`Altura (mm)<input id="altura" type="number" value="2000" data-required="true" oninput="desenharPorta(); atualizarPrecoPorta(); atualizarLimiteDobradicas(); atualizarCamposObrigatorios()">`,
            perfil:`Perfil<select id="perfil" data-required="true" onchange="atualizarPrecoPorta(); atualizarCamposObrigatorios()"></select>`,
            vidro:`Vidro<select id="vidro" data-required="true" onchange="atualizarPrecoPorta(); atualizarCamposObrigatorios()"></select>`,
            dobradicas:`Quantidade de dobradiças<input id="dobradicas" type="number" value="0" min="0" oninput="atualizarDobradicasInputs(); atualizarPrecoPorta(); atualizarCamposObrigatorios()">`,
            dobradicas_alturas:`Alturas das dobradiças<div id="dobradicasContainer" class="helper-text">Defina a quantidade para gerar os campos.</div>`,
            puxador:`Puxador<select id="puxador" data-required="true" onchange="atualizarPuxadorTipo(); atualizarPrecoPorta(); atualizarCamposObrigatorios()"></select>`,
            altura_puxador:`Altura do puxador (mm)<input id="altura_puxador" type="number" value="1000" min="0" oninput="desenharPorta()">`,
            medida_puxador:`Tamanho do puxador (mm)<input id="medida_puxador" type="number" value="0" min="0" oninput="atualizarPrecoPorta(); desenharPorta()">`,
            valor_adicional:`Valor adicional (R$)<input id="valor_adicional" type="number" value="0" min="0" step="0.01" oninput="atualizarPrecoPorta()">`,
            puxadores:`Descrição do puxador<input id="puxadores" type="text" placeholder="Ex: puxador 60cm">`,
            acessorio:`Acessório<textarea id="acessorio" rows="2"></textarea>`,
            observacao_venda:`Observação de venda<textarea id="observacao_venda" rows="2"></textarea>`,
            observacao_producao:`Observação de produção<textarea id="observacao_producao" rows="2"></textarea>`,
            trilho:`Trilho<textarea id="trilho" rows="2"></textarea>`,
            pivo:`Pivo<textarea id="pivo" rows="2"></textarea>`
        }
        if(map[c]) container.innerHTML+=`<label>${map[c]}</label>`
    })
    atualizarPerfisSelect()
    atualizarVidrosSelect()
    atualizarPuxadoresSelect()
    atualizarPuxadorTipo()
    atualizarDobradicasInputs()
    atualizarPrecoPorta()
    desenharPorta()
    atualizarCamposObrigatorios()
}

function atualizarPuxadorTipo() {
    const puxadorId = document.getElementById("puxador")?.value
    const medidaInput = document.getElementById("medida_puxador")
    if (!medidaInput) return

    if (puxadorId === "sem_puxador") {
        medidaInput.disabled = true
        medidaInput.value = "0"
        return
    }

    const puxador = todosPuxadores.find(p => p.id == puxadorId)
    if (!puxador) {
        medidaInput.disabled = false
        return
    }

    if (puxador.tipo_medida === "metro_linear") {
        medidaInput.disabled = false
    } else {
        medidaInput.disabled = true
        medidaInput.value = "0"
    }
}

function atualizarDobradicasInputs() {
    const container = document.getElementById("dobradicasContainer")
    if (!container) return
    const qtd = parseInt(document.getElementById("dobradicas")?.value || "0", 10) || 0
    if (qtd <= 0) {
        container.innerHTML = "<span class='helper-text'>Defina a quantidade para gerar os campos.</span>"
        return
    }

    container.innerHTML = ""
    for (let i = 0; i < qtd; i++) {
        container.innerHTML += `
            <input class="dobradica-altura" type="number" placeholder="Altura ${i + 1} (mm)" min="0" oninput="desenharPorta()">
        `
    }
}

function obterAlturasDobradicas() {
    const inputs = document.querySelectorAll(".dobradica-altura")
    return Array.from(inputs)
        .map(input => input.value)
        .filter(valor => valor !== "")
}

function atualizarLimiteDobradicas() {
    const altura = +document.getElementById("altura")?.value || 0
    const qtd = Math.max(0, Math.floor(altura / 700))
    const input = document.getElementById("dobradicas")
    if (input && qtd > 0) {
        input.max = qtd
    }
}

function atualizarCamposObrigatorios() {
    const camposObrigatorios = document.querySelectorAll("[data-required='true']")
    camposObrigatorios.forEach(campo => {
        if(!campo.value){
            campo.style.border = "1px solid red"
        } else {
            campo.style.border = ""
        }
    })
}

function desenharPorta() {
    const svg = document.getElementById("portaSVG")
    if (!svg) return
    const largura = +document.getElementById("largura")?.value || 0
    const altura = +document.getElementById("altura")?.value || 0

    svg.setAttribute("viewBox", "0 0 400 600")
    svg.innerHTML = ""

    if (largura <= 0 || altura <= 0) {
        svg.innerHTML = "<text x='50%' y='50%' text-anchor='middle'>Informe largura e altura</text>"
        return
    }

    const scale = Math.min(320 / largura, 520 / altura)
    const doorWidth = largura * scale
    const doorHeight = altura * scale

    const x = (400 - doorWidth) / 2
    const y = (600 - doorHeight) / 2

    svg.innerHTML += `<rect x="${x}" y="${y}" width="${doorWidth}" height="${doorHeight}" fill="#e7f3fb" stroke="#1079ba" stroke-width="4" rx="8" />`

    const puxadorId = document.getElementById("puxador")?.value
    const deveDesenharPuxador = puxadorId && puxadorId !== "sem_puxador"
    if (deveDesenharPuxador) {
        const handleLength = (+document.getElementById("medida_puxador")?.value || 0) * scale
        const handlePos = (+document.getElementById("altura_puxador")?.value || 0) * scale
        const handleHeight = handleLength > 0 ? handleLength : doorHeight * 0.4
        const handleX = x + doorWidth - 18
        const handleY = y + doorHeight - handlePos - handleHeight / 2
        svg.innerHTML += `<rect x="${handleX}" y="${handleY}" width="8" height="${handleHeight}" fill="#f0c24c" />`
    }

    const alturasDobradicas = obterAlturasDobradicas()
    alturasDobradicas.forEach((alturaDobradica) => {
        const pos = (+alturaDobradica || 0) * scale
        const yPos = y + doorHeight - pos
        svg.innerHTML += `<circle cx="${x + 6}" cy="${yPos}" r="4" fill="#0d5d8c" />`
        svg.innerHTML += `<line x1="${x + 6}" y1="${yPos}" x2="${x + 24}" y2="${yPos}" stroke="#0d5d8c" stroke-width="2" />`
    })
}

let portas = []
let editando = null
let idCounter = 0

async function salvarPorta(){
    const tipo = document.getElementById("tipologia").value
    if(!tipo) return alert("Selecione a tipologia")

    const medidas = calcularMedidasPorta()
    const largura = medidas.larguraMm
    const altura = medidas.alturaMm
    const quantidade = +document.getElementById("quantidade")?.value || 0
    const perfilSelecionado = document.getElementById("perfil")?.value
    const vidroSelecionado = document.getElementById("vidro")?.value
    const puxadorSelecionado = document.getElementById("puxador")?.value
    const dobradicasQtd = parseInt(document.getElementById("dobradicas")?.value || "0", 10) || 0
    const alturasDobradicas = obterAlturasDobradicas()

    const pendencias = []
    if (!largura) pendencias.push("Largura")
    if (!altura) pendencias.push("Altura")
    if (!quantidade) pendencias.push("Quantidade")
    if (!perfilSelecionado) pendencias.push("Perfil")
    if (!vidroSelecionado) pendencias.push("Vidro")
    if (!puxadorSelecionado) pendencias.push("Puxador")
    if (tipo === "giro" && dobradicasQtd < 2) pendencias.push("Dobradiças (mínimo 2)")
    if (dobradicasQtd > 0 && alturasDobradicas.length !== dobradicasQtd) {
        pendencias.push("Alturas das dobradiças")
    }

    if (pendencias.length > 0) {
        alert(`Preencha os campos obrigatórios: ${pendencias.join(", ")}`)
        return
    }

    const dados = {}
    TIPOLOGIAS[tipo].forEach(c=>{
        const el = document.getElementById(c)
        if(el) dados[c] = el.value
    })
    dados.dobradicas_alturas = obterAlturasDobradicas()

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
    }
    const nextPortas = editando === null
        ? [...portas, porta]
        : portas.map(p => (p.id === editando ? porta : p))
    const portasComUUID = nextPortas.map(p => ({ ...p, orcamento_uuid: ORCAMENTO_UUID }))
    try {
        const resPortas = await fetch(`${API_BASE}/api/orcamento/${ORCAMENTO_UUID}/portas`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portas: portasComUUID })
        })
        const dataPortas = await resPortas.json()
        if (!dataPortas.success) throw new Error(dataPortas.error || "Erro ao salvar portas")

        alert("Porta salva com sucesso!")
        portas = nextPortas
        editando = null
        renderPortas()
    } catch (err) {
        console.error(err)
        alert("Erro ao salvar porta: " + err.message)
    }
}

function renderPortas(){
    const c = document.getElementById("portasSalvas")
    c.innerHTML = ""
    portas.forEach((p, idx)=>{
        const perfilNome = todosPerfis.find(perfil => perfil.id == p.dados.perfil)?.nome || "Perfil não definido"
        const vidroNome = todosVidros.find(vidro => vidro.id == p.dados.vidro)?.tipo || "Vidro não definido"
        const puxadorNome = p.dados.puxador === "sem_puxador"
            ? "Sem puxador"
            : (todosPuxadores.find(puxador => puxador.id == p.dados.puxador)?.nome || "Puxador não definido")
        const valorAdicional = Number(p.dados.valor_adicional || 0)
        const quantidadeDobradicas = parseInt(p.dados.dobradicas || "0", 10) || 0
        c.innerHTML += `
            <div>
                <strong>${idx+1}. ${p.tipo}</strong><br>
                Quantidade: ${p.quantidade}<br>
                Perfil: ${perfilNome}<br>
                Vidro: ${vidroNome}<br>
                Puxador: ${puxadorNome}<br>
                Valor adicional: ${valorAdicional ? formatarMoeda(valorAdicional) : "-"}<br>
                Dobradiças: ${quantidadeDobradicas}<br>
                Preço: R$ ${p.preco.toFixed(2)}<br>
                ${p.svg}<br>
                <button class="btn" onclick="copiarPorta(${p.id})">Copiar</button>
                <button class="btn" onclick="editarPorta(${p.id})">Editar</button>
                <button class="btn btn-danger" onclick="apagarPorta(${p.id})">Apagar</button>
            </div>
        `
    })
    atualizarResumoImpressao()
    atualizarResumoOrdem()
}

function editarPorta(id){
    const porta = portas.find(p=>p.id===id)
    if(!porta) return
    editando = id
    document.getElementById("tipologia").value = porta.tipo
    document.getElementById("quantidade").value = porta.quantidade
    renderCampos()
    for(const k in porta.dados){
        const el=document.getElementById(k)
        if(el) el.value = porta.dados[k]
    }
    if (Array.isArray(porta.dados.dobradicas_alturas)) {
        const inputs = document.querySelectorAll(".dobradica-altura")
        porta.dados.dobradicas_alturas.forEach((altura, idx) => {
            if (inputs[idx]) inputs[idx].value = altura
        })
    }
    atualizarPuxadorTipo()
    atualizarPrecoPorta()
    desenharPorta()
}

function copiarPorta(id){
    const porta = portas.find(p=>p.id===id)
    if(!porta) return
    editando = null
    document.getElementById("tipologia").value = porta.tipo
    document.getElementById("quantidade").value = porta.quantidade
    renderCampos()
    for(const k in porta.dados){
        const el=document.getElementById(k)
        if(el) el.value = porta.dados[k]
    }
    if (Array.isArray(porta.dados.dobradicas_alturas)) {
        const inputs = document.querySelectorAll(".dobradica-altura")
        porta.dados.dobradicas_alturas.forEach((altura, idx) => {
            if (inputs[idx]) inputs[idx].value = altura
        })
    }
    atualizarPuxadorTipo()
    atualizarPrecoPorta()
    desenharPorta()
}

function apagarPorta(id){
    if(!confirm("Tem certeza que deseja apagar esta porta?")) return
    portas = portas.filter(p=>p.id!==id)
    renderPortas()
}

// =====================
// IMPRESSÃO
// =====================
function obterRecuosPuxador(alturaPorta, alturaPuxador, tamanhoPuxador) {
    if (!alturaPorta || !alturaPuxador || !tamanhoPuxador) return { recuoTopo: null, recuoBase: null }
    const inicio = alturaPuxador - tamanhoPuxador / 2
    const fim = alturaPuxador + tamanhoPuxador / 2
    return {
        recuoBase: Math.max(0, inicio),
        recuoTopo: Math.max(0, alturaPorta - fim)
    }
}

function obterIdentificacaoOrcamento() {
    const nome = orcamentoInfo?.cliente_nome || "-"
    const numero = orcamentoInfo?.numero_pedido ?? "-"
    return `Cliente: ${nome} | Pedido: ${numero}`
}

function obterCidadeCliente() {
    return orcamentoInfo?.cliente_cidade || "-"
}

function obterDataHoje() {
    return new Date().toLocaleDateString("pt-BR")
}

function atualizarResumoImpressao() {
    const resumo = document.getElementById("printResumo")
    if (!resumo) return
    if (portas.length === 0) {
        resumo.innerHTML = ""
        return
    }

    let totalGeral = 0
    const itens = portas.map((p, index) => {
        const largura = p.dados.largura || "-"
        const altura = p.dados.altura || "-"
        const puxador = p.dados.puxador === "sem_puxador"
            ? null
            : todosPuxadores.find(pux => pux.id == p.dados.puxador)
        const puxadorNome = puxador ? puxador.nome : "Sem puxador"
        const precoTotal = p.preco || 0
        totalGeral += precoTotal

        return `
            <div class="print-item">
                Quantidade: ${p.quantidade}<br>
                Altura: ${altura} mm<br>
                Largura: ${largura} mm<br>
                Puxador: ${puxadorNome}<br>
                Valor do item: ${formatarMoeda(precoTotal)}
            </div>
        `
    }).join("")

    resumo.innerHTML = `
        <h2>Resumo do Orçamento</h2>
        <p>${obterIdentificacaoOrcamento()}</p>
        ${itens}
        <h3>Total geral: ${formatarMoeda(totalGeral)}</h3>
    `
}

function gerarSvgOrdemProducao(porta) {
    const largura = parseFloat(porta.dados.largura || 0)
    const altura = parseFloat(porta.dados.altura || 0)
    if (!largura || !altura) return ""

    const w = 400
    const h = 600
    const scale = Math.min(w / largura, h / altura)

    const doorWidth = largura * scale
    const doorHeight = altura * scale
    const offsetX = 90
    const offsetY = 30

    const puxadorId = porta.dados.puxador
    const deveDesenharPuxador = puxadorId && puxadorId !== "sem_puxador"
    const handleLength = deveDesenharPuxador ? parseFloat(porta.dados.medida_puxador || 0) : 0
    const handlePos = deveDesenharPuxador ? parseFloat(porta.dados.altura_puxador || 0) : 0
    const recuos = obterRecuosPuxador(altura, handlePos, handleLength)

    const handleScaled = handleLength > 0 ? handleLength * scale : doorHeight * 0.4
    const handleCenter = offsetY + doorHeight - (handlePos * scale)
    const handleY = handleCenter - handleScaled / 2
    const handleX = offsetX + doorWidth - 12
    const quantidadeTexto = `${porta.quantidade || 1}x`
    const alturasDobradicas = Array.isArray(porta.dados.dobradicas_alturas)
        ? porta.dados.dobradicas_alturas
        : []
    const dobradicasSvg = alturasDobradicas.map((posicaoMm) => {
        const posicao = parseFloat(posicaoMm || 0)
        if (!posicao) return ""
        const y = offsetY + doorHeight - (posicao * scale)
        const x = offsetX + 6
        return `
          <line x1="${x}" y1="${y}" x2="${x + 20}" y2="${y}" stroke="#000" stroke-width="3"/>
          <circle cx="${x}" cy="${y}" r="4" fill="#000"/>
        `
    }).join("")

    return `
    <svg class="op-svg" width="520" height="720" viewBox="0 0 520 720" xmlns="http://www.w3.org/2000/svg">
      <rect x="${offsetX}" y="${offsetY}" width="${doorWidth}" height="${doorHeight}" fill="#f4f8ff" stroke="#1079ba" stroke-width="3"/>
      ${dobradicasSvg}
      ${deveDesenharPuxador ? `<rect x="${handleX}" y="${handleY}" width="8" height="${handleScaled}" fill="#d48400"/>` : ""}
      <text x="${offsetX + doorWidth / 2}" y="${offsetY + doorHeight / 2}" text-anchor="middle" dominant-baseline="middle" class="op-quantity">${quantidadeTexto}</text>

      <line x1="${offsetX - 20}" y1="${offsetY}" x2="${offsetX - 20}" y2="${offsetY + doorHeight}" stroke="#333"/>
      <line x1="${offsetX - 24}" y1="${offsetY}" x2="${offsetX}" y2="${offsetY}" stroke="#333"/>
      <line x1="${offsetX - 24}" y1="${offsetX + doorHeight}" x2="${offsetX}" y2="${offsetX + doorHeight}" stroke="#333"/>
      <text x="${offsetX - 50}" y="${offsetY + doorHeight / 2}" class="op-measure" transform="rotate(-90 ${offsetX - 50} ${offsetX - 50} ${offsetY + doorHeight / 2})">${altura} mm</text>

      <line x1="${offsetX}" y1="${offsetY + doorHeight + 20}" x2="${offsetX + doorWidth}" y2="${offsetY + doorHeight + 20}" stroke="#333"/>
      <line x1="${offsetX}" y1="${offsetY + doorHeight + 16}" x2="${offsetX}" y2="${offsetX + doorHeight + 24}" stroke="#333"/>
      <line x1="${offsetX + doorWidth}" y1="${offsetX + doorHeight + 16}" x2="${offsetX + doorWidth}" y2="${offsetX + doorHeight + 24}" stroke="#333"/>
      <text x="${offsetX + doorWidth / 2}" y="${offsetX + doorHeight + 48}" class="op-measure" text-anchor="middle">${largura} mm</text>
    </svg>
    `
}

function atualizarResumoOrdem() {
    const container = document.getElementById("printOrdem")
    if (!container) return
    if (portas.length === 0) {
        container.innerHTML = ""
        return
    }

    const itens = portas.map((p, index) => {
        const perfilNome = todosPerfis.find(perfil => perfil.id == p.dados.perfil)?.nome || "-"
        const vidroNome = todosVidros.find(vidro => vidro.id == p.dados.vidro)?.tipo || "-"
        const puxadorNome = p.dados.puxador === "sem_puxador"
            ? "Sem puxador"
            : (todosPuxadores.find(puxador => puxador.id == p.dados.puxador)?.nome || "-")
        const valorAdicional = Number(p.dados.valor_adicional || 0)
        const observacaoVenda = p.dados.observacao_venda || "-"
        const observacaoProducao = p.dados.observacao_producao || "-"
        const quantidadeDobradicas = parseInt(p.dados.dobradicas || "0", 10) || 0
        const alturasDobradicas = Array.isArray(p.dados.dobradicas_alturas) && p.dados.dobradicas_alturas.length
            ? `${p.dados.dobradicas_alturas.join(" mm, ")} mm`
            : "-"
        const alturaPorta = parseFloat(p.dados.altura || 0)
        const alturaPuxador = parseFloat(p.dados.altura_puxador || 0)
        const medidaPuxador = parseFloat(p.dados.medida_puxador || 0)
        const recuos = obterRecuosPuxador(alturaPorta, alturaPuxador, medidaPuxador)
        const vaoPuxador = recuos.recuoBase === null
            ? "-"
            : `Base ${Math.round(recuos.recuoBase)} mm | Topo ${Math.round(recuos.recuoTopo)} mm`
        return `
            <div class="print-item op-page">
                <div>
                    ${gerarSvgOrdemProducao(p)}
                </div>
                <div class="op-info">
                    <div><strong>O.P. ${index + 1} - ${p.tipo}</strong></div>
                    <div>Perfil: ${perfilNome}</div>
                    <div>Vidro: ${vidroNome}</div>
                    <div>Puxador: ${puxadorNome}</div>
                    <div>Valor adicional: ${valorAdicional ? formatarMoeda(valorAdicional) : "-"}</div>
                    <div>Observação de venda: ${observacaoVenda}</div>
                    <div>Observação de produção: ${observacaoProducao}</div>
                    <div>Dobradiças: ${quantidadeDobradicas} (alturas: ${alturasDobradicas})</div>
                    <div>Vão do puxador: ${vaoPuxador}</div>
                </div>
            </div>
        `
    }).join("")

    container.innerHTML = `
        <h2>Ordem de Produção</h2>
        <p>${obterIdentificacaoOrcamento()}</p>
        ${itens}
    `
}

function atualizarEtiquetasTermicas() {
    const container = document.getElementById("printEtiqueta")
    if (!container) return
    if (portas.length === 0) {
        container.innerHTML = ""
        return
    }

    const dataHoje = obterDataHoje()
    const clienteNome = orcamentoInfo?.cliente_nome || "-"
    const pedidoNumero = orcamentoInfo?.numero_pedido ?? "-"
    const cidadeCliente = obterCidadeCliente()

    const etiquetas = []
    portas.forEach((porta, index) => {
        const quantidade = parseInt(porta.quantidade || "1", 10) || 1
        const largura = porta.dados.largura || "-"
        const altura = porta.dados.altura || "-"
        const perfilNome = todosPerfis.find(perfil => perfil.id == porta.dados.perfil)?.nome || "-"
        const vidroNome = todosVidros.find(vidro => vidro.id == porta.dados.vidro)?.tipo || "-"
        const descricao = `${index + 1} Porta - ${largura} x ${altura} mm`

        for (let i = 1; i <= quantidade; i += 1) {
            etiquetas.push(`
                <div class="thermal-label">
                    <div class="thermal-header">
                        <div><strong>Pedido:</strong> ${pedidoNumero}</div>
                        <div><strong>Data:</strong> ${dataHoje}</div>
                        <div><strong>Volume:</strong> ${i}/${quantidade}</div>
                        <div><strong>Cliente:</strong> ${clienteNome}</div>
                        <div><strong>Cidade:</strong> ${cidadeCliente}</div>
                    </div>
                    <div class="thermal-divider"></div>
                    <div class="thermal-body">
                        <div><strong>${descricao}</strong></div>
                        <div>${perfilNome}</div>
                        <div>${vidroNome}</div>
                    </div>
                    <div class="thermal-divider"></div>
                    <div class="thermal-footer">colorglassfortaleza.com.br</div>
                </div>
            `)
        }
    })

    container.innerHTML = etiquetas.join("")
}

function imprimirOrcamento() {
    atualizarResumoImpressao()
    document.getElementById("printResumo").classList.add("active")
    document.getElementById("printOrdem").classList.remove("active")
    document.getElementById("printEtiqueta").classList.remove("active")
    window.print()
}

function imprimirOrdemProducao() {
    atualizarResumoOrdem()
    document.getElementById("printOrdem").classList.add("active")
    document.getElementById("printResumo").classList.remove("active")
    document.getElementById("printEtiqueta").classList.remove("active")
    window.print()
}

function imprimirEtiquetaTermica() {
    atualizarEtiquetasTermicas()
    document.getElementById("printEtiqueta").classList.add("active")
    document.getElementById("printResumo").classList.remove("active")
    document.getElementById("printOrdem").classList.remove("active")
    window.print()
}

// =====================
// CARREGAR PORTAS EXISTENTES
// =====================
async function carregarPortas(){
    try{
        const res = await fetch(`${API_BASE}/api/orcamento/${ORCAMENTO_UUID}/portas`)
        const data = await res.json()
        if(data.success && data.portas){
            portas = data.portas.map((p) => ({ ...p, id: idCounter++ }))
            renderPortas()
        }
    } catch(err){
        console.error(err)
    }
}

async function carregarOrcamentoInfo() {
    try {
        const res = await fetch(`${API_BASE}/api/orcamentos`)
        const data = await res.json()
        if (data.success && Array.isArray(data.orcamentos)) {
            const encontrado = data.orcamentos.find((orcamento) => orcamento.id == ORCAMENTO_UUID)
            if (encontrado) {
                orcamentoInfo = {
                    cliente_nome: encontrado.cliente_nome || "-",
                    numero_pedido: encontrado.numero_pedido ?? "-",
                    cliente_cidade: encontrado.cliente_cidade || "-"
                }
            }
        }
    } catch (err) {
        console.error("Erro ao carregar informações do orçamento:", err)
    }
}

// =====================
// LINK ESTRUTURAS 3D
// =====================
function abrirEstrutura3D(){
    const url = `3dteste.html?orcamento_uuid=${ORCAMENTO_UUID}`;
    window.open(url, "_blank");
}

// =====================
// CARREGAR ESTRUTURAS 3D SALVAS
// =====================
let estruturas3D = [];

function carregarEstruturas3D() {
    try {
        const data = localStorage.getItem(`estruturas_${ORCAMENTO_UUID}`);
        if (!data) return;
        estruturas3D = JSON.parse(data);
        renderEstruturas3D();
    } catch (err) {
        console.error("Erro ao carregar estruturas 3D:", err);
    }
}

function renderEstruturas3D() {
    const container = document.getElementById("estruturas3DSalvas");
    container.innerHTML = "";
    estruturas3D.forEach((e, idx) => {
        container.innerHTML += `
            <div>
                <strong>Estrutura 3D ${idx + 1}</strong><br>
                Comprimento total: ${e.totalLength.toFixed(2)} mm<br>
                Fixadores: ${e.fixadores || "Nenhum"}<br>
                <button class="btn" onclick="verEstrutura3D(${idx})">Ver 3D</button>
            </div>
        `;
    });
}

function verEstrutura3D(idx) {
    const url = `3dteste.html?orcamento_uuid=${ORCAMENTO_UUID}&estrutura_idx=${idx}`;
    window.open(url, "_blank");
}

// =====================
carregarPerfis()
carregarVidros()
carregarInsumos()
carregarPuxadores()
carregarTags()
carregarPortas()
carregarEstruturas3D()
carregarOrcamentoInfo()
