// =====================
// TIPOLOGIAS
// =====================
const TIPOLOGIAS = {
    giro: ["largura", "altura", "perfil", "vidro", "dobradicas", "dobradicas_posicao", "dobradicas_alturas", "puxador", "puxador_posicao", "medida_puxador", "valor_adicional", "puxadores", "acessorio", "observacao_venda", "observacao_producao"],
    deslizante: ["largura", "altura", "perfil", "vidro", "sistemas", "trilhos_superior", "trilhos_inferior", "vao_trilhos_superior", "vao_trilhos_inferior", "trilho", "puxador", "puxador_posicao", "medida_puxador", "valor_adicional", "puxadores", "acessorio", "observacao_venda", "observacao_producao"],
    correr: ["largura", "altura", "perfil", "vidro", "sistemas", "trilhos_superior", "trilhos_inferior", "trilho", "valor_adicional", "puxadores", "acessorio", "observacao_venda", "observacao_producao"]
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
    const tipologiaAtual = document.getElementById("tipologia")?.value;
    const valorAtual = sistemasSelect.value;
    sistemasSelect.innerHTML = "<option value=''>Selecione</option>";
    const sistemasFiltrados = tipologiaAtual
        ? sistemasLista.filter((sistema) => {
            const tipos = sistema.tipo || [];
            return tipos.includes(tipologiaAtual) || tipos.length === 0;
        })
        : sistemasLista;

    sistemasFiltrados.forEach((sistema) => {
        const opt = document.createElement("option");
        opt.value = sistema.id;
        opt.textContent = `${sistema.nome}${sistema.preco ? ` - R$ ${Number(sistema.preco).toFixed(2)}` : ""}`;
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
    const trilhosSuperior = sistema?.trilhossup || [];
    const trilhosInferior = sistema?.trilhosinf || [];

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
    atualizarPrecoPorta();
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
    atualizarPrecoPorta();
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
            largura: `Largura (mm)<input id="largura" type="number" value="800" data-required="true" oninput="desenharPorta(); atualizarPrecoPorta(); atualizarCamposObrigatorios()">`,
            altura: `Altura (mm)<input id="altura" type="number" value="2000" data-required="true" oninput="desenharPorta(); atualizarPrecoPorta(); atualizarCamposObrigatorios()">`,
            perfil: `Perfil<select id="perfil" data-required="true" onchange="atualizarPrecoPorta(); atualizarCamposObrigatorios()"></select>`,
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
        if (map[c]) container.innerHTML += `<label>${map[c]}</label>`;
    });
    atualizarPerfisSelect();
    atualizarVidrosSelect();
    atualizarPuxadoresSelect();
    atualizarPuxadorTipo();
    atualizarDobradicasInputs();
    atualizarLimiteDobradicas();
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
    const qtd = parseInt(document.getElementById("dobradicas")?.value || "0", 10) || 0;
    if (!container) return;

    container.innerHTML = "";
    for (let i = 0; i < qtd; i++) {
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.placeholder = `Altura da dobradiça ${i + 1} (mm)`;
        input.className = "dobradica-altura";
        input.oninput = () => { desenharPorta(); atualizarCamposObrigatorios(); };
        container.appendChild(input);
    }
    desenharPorta();
}

function atualizarLimiteDobradicas() {
    const alturaInput = document.getElementById("altura");
    const dobradicasInput = document.getElementById("dobradicas");
    if (!alturaInput || !dobradicasInput) return;
    const altura = parseFloat(alturaInput.value || "0");
    dobradicasInput.max = altura >= 2400 ? "4" : "3";
}

function obterAlturasDobradicas() {
    return Array.from(document.querySelectorAll(".dobradica-altura"))
        .map(input => input.value)
        .filter(Boolean);
}

window.TIPOLOGIAS = TIPOLOGIAS;
window.atualizarPerfisSelect = atualizarPerfisSelect;
window.atualizarVidrosSelect = atualizarVidrosSelect;
window.carregarSistemas = carregarSistemas;
window.atualizarSistemasSelect = atualizarSistemasSelect;
window.atualizarTrilhosDoSistema = atualizarTrilhosDoSistema;
window.atualizarResumoTrilhos = atualizarResumoTrilhos;
window.atualizarPuxadoresSelect = atualizarPuxadoresSelect;
window.renderCampos = renderCampos;
window.atualizarPuxadorTipo = atualizarPuxadorTipo;
window.atualizarDobradicasInputs = atualizarDobradicasInputs;
window.atualizarLimiteDobradicas = atualizarLimiteDobradicas;
window.obterAlturasDobradicas = obterAlturasDobradicas;
