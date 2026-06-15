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

    const valorAtual = perfilSelect.value;
    perfilSelect.innerHTML = "<option value=''>Selecione</option>";

    todosPerfis
        .filter(p => Array.isArray(p.tipologias) && p.tipologias.includes(tipo))
        .forEach(p => {
            perfilSelect.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
        });

    if (valorAtual && Array.from(perfilSelect.options).some(opt => opt.value === valorAtual)) {
        perfilSelect.value = valorAtual;
    }

    atualizarPuxadoresSelect();
}

function atualizarVidrosSelect() {
    const vidroSelect = document.getElementById("vidro");
    if (!vidroSelect) return;
    vidroSelect.innerHTML = "<option value=''>Selecione</option>";
    todosVidros.forEach(v => {
        vidroSelect.innerHTML += `<option value="${v.id}">${v.tipo} ${v.espessura || ""}mm</option>`;
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

function normalizarTextoCompatibilidade(valor) {
    return String(valor ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function normalizarArrayCompatibilidade(valor) {
    if (Array.isArray(valor)) {
        return valor.map(item => String(item ?? "").trim()).filter(Boolean);
    }

    if (valor === null || valor === undefined || valor === "") {
        return [];
    }

    if (typeof valor === "string") {
        const texto = valor.trim();
        if (!texto) return [];

        try {
            const parsed = JSON.parse(texto);
            if (Array.isArray(parsed)) {
                return parsed.map(item => String(item ?? "").trim()).filter(Boolean);
            }
        } catch (_) {
            // Mantém compatibilidade com cadastro em texto separado por vírgula/ponto e vírgula.
        }

        return texto.split(/[;,|]/).map(item => item.trim()).filter(Boolean);
    }

    return [String(valor).trim()].filter(Boolean);
}

function obterPerfilSelecionado() {
    const perfilId = document.getElementById("perfil")?.value;
    if (!perfilId) return null;
    return todosPerfis.find(perfil => String(perfil.id) === String(perfilId)) || null;
}

function obterPuxadoresDoPerfil(perfil) {
    return normalizarArrayCompatibilidade(
        perfil?.puxadores ??
        perfil?.puxadores_compativeis ??
        perfil?.puxadoresCompativeis
    );
}

function filtrarPuxadoresCompativeis(perfil) {
    const referencias = obterPuxadoresDoPerfil(perfil);
    if (!referencias.length) return [];

    const refsExatas = new Set(referencias.map(item => String(item).trim()).filter(Boolean));
    const refsNormalizadas = new Set(referencias.map(normalizarTextoCompatibilidade).filter(Boolean));

    return todosPuxadores.filter(puxador => {
        const id = String(puxador.id ?? "").trim();
        const nome = String(puxador.nome ?? "").trim();

        return (
            refsExatas.has(id) ||
            refsExatas.has(nome) ||
            refsNormalizadas.has(normalizarTextoCompatibilidade(id)) ||
            refsNormalizadas.has(normalizarTextoCompatibilidade(nome))
        );
    });
}

function atualizarPuxadoresSelect() {
    const puxadorSelect = document.getElementById("puxador");
    if (!puxadorSelect) return;

    const valorAtual = puxadorSelect.value;
    const perfil = obterPerfilSelecionado();

    puxadorSelect.innerHTML = "";

    if (!perfil) {
        puxadorSelect.innerHTML = "<option value=''>Selecione o perfil primeiro</option>";
        puxadorSelect.disabled = true;
        return;
    }

    puxadorSelect.disabled = false;
    puxadorSelect.innerHTML = "<option value=''>Selecione</option>";
    puxadorSelect.innerHTML += "<option value='sem_puxador'>Sem puxador</option>";

    const puxadoresCompativeis = filtrarPuxadoresCompativeis(perfil);

    if (!puxadoresCompativeis.length) {
        puxadorSelect.innerHTML += "<option value='' disabled>Nenhum puxador atrelado a este perfil</option>";
    } else {
        puxadoresCompativeis.forEach(p => {
            puxadorSelect.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
        });
    }

    const valoresPermitidos = new Set(["", "sem_puxador", ...puxadoresCompativeis.map(p => String(p.id))]);
    puxadorSelect.value = valoresPermitidos.has(String(valorAtual)) ? valorAtual : "";

    atualizarPuxadorTipo();
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
        input.dataset.required = "true";
        input.oninput = () => {
            desenharPorta();
            atualizarCamposObrigatorios();
        };
        container.appendChild(input);
    }
    desenharPorta();
    atualizarCamposObrigatorios();
}

function atualizarLimiteDobradicas() {
    const qtdInput = document.getElementById("dobradicas");
    const tipologia = document.getElementById("tipologia")?.value;
    if (!qtdInput) return;
    if (tipologia === "giro") {
        qtdInput.min = "1";
        if (Number(qtdInput.value) < 1) qtdInput.value = "1";
    }
}

function renderizarPortas() {
    const box = document.getElementById("portasSalvas");
    if (!box) return;
    box.innerHTML = portas.map((p, i) => {
        const perfilNome = todosPerfis.find(perfil => perfil.id == p.dados.perfil)?.nome || "-";
        const vidroNome = todosVidros.find(vidro => vidro.id == p.dados.vidro)?.tipo || "-";
        const puxadorNome = p.dados.puxador === "sem_puxador"
            ? "Sem puxador"
            : (todosPuxadores.find(pux => pux.id == p.dados.puxador)?.nome || "-");
        return `
        <div>
            <strong>${p.tipo}</strong><br>
            Qtd: ${p.quantidade} | ${p.dados.largura || "-"} x ${p.dados.altura || "-"} mm<br>
            Perfil: ${perfilNome} | Vidro: ${vidroNome}<br>
            Puxador: ${puxadorNome}<br>
            Preço: ${formatarMoeda(p.preco || 0)}<br>
            <button class="btn" onclick="editarPorta(${i})">Editar</button>
            <button class="btn btn-danger" onclick="excluirPorta(${i})">Excluir</button>
        </div>`;
    }).join("");
}

window.atualizarPerfisSelect = atualizarPerfisSelect;
window.atualizarVidrosSelect = atualizarVidrosSelect;
window.atualizarSistemasSelect = atualizarSistemasSelect;
window.atualizarTrilhosDoSistema = atualizarTrilhosDoSistema;
window.atualizarResumoTrilhos = atualizarResumoTrilhos;
window.atualizarPuxadoresSelect = atualizarPuxadoresSelect;
window.renderCampos = renderCampos;
window.atualizarPuxadorTipo = atualizarPuxadorTipo;
window.atualizarDobradicasInputs = atualizarDobradicasInputs;
window.atualizarLimiteDobradicas = atualizarLimiteDobradicas;
window.renderizarPortas = renderizarPortas;
