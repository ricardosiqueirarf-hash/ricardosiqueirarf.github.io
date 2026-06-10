const perfisDisponiveis = ["9700", "2215", "1036", "088", "3545", "3446"];

const closetState = {
  profundidade: 600,
  alturaUtil: 2400,
  larguraLateral: 350,
  larguraCentralPadrao: 700,
  alturaSuperior: 100,
  alturaInferior: 100,
  contadorCentral: 0,
  modulos: []
};

const elementos = {};

document.addEventListener("DOMContentLoaded", () => {
  mapearElementos();
  inicializarCloset();
  vincularEventosGerais();
  atualizarInterface();
});

function mapearElementos() {
  elementos.profundidade = document.getElementById("inputProfundidade");
  elementos.alturaUtil = document.getElementById("inputAlturaUtil");
  elementos.larguraLateral = document.getElementById("inputLarguraLateral");
  elementos.alturaSuperior = document.getElementById("inputAlturaSuperior");
  elementos.alturaInferior = document.getElementById("inputAlturaInferior");
  elementos.larguraCentralPadrao = document.getElementById("inputLarguraCentralPadrao");
  elementos.btnAdicionarCentral = document.getElementById("btnAdicionarCentral");
  elementos.btnRemoverUltimoCentral = document.getElementById("btnRemoverUltimoCentral");
  elementos.modulosEditor = document.getElementById("modulosEditor");
  elementos.closetPreview = document.getElementById("closetPreview");
  elementos.badgeModulos = document.getElementById("badgeModulos");
  elementos.dimensoesResumoCurto = document.getElementById("dimensoesResumoCurto");
  elementos.resumoTotalModulos = document.getElementById("resumoTotalModulos");
  elementos.resumoTotalPerfis = document.getElementById("resumoTotalPerfis");
  elementos.resumoMetragemAluminio = document.getElementById("resumoMetragemAluminio");
  elementos.resumoAlturaTotal = document.getElementById("resumoAlturaTotal");
  elementos.resumoLarguraTotal = document.getElementById("resumoLarguraTotal");
  elementos.resumoProfundidadeTotal = document.getElementById("resumoProfundidadeTotal");
}

function inicializarCloset() {
  closetState.contadorCentral = 0;
  closetState.modulos = [
    criarModuloBase("lateral-esquerdo", "lateral", "Lateral esquerdo", closetState.larguraLateral, closetState.alturaUtil),
    criarModuloBase("lateral-direito", "lateral", "Lateral direito", closetState.larguraLateral, closetState.alturaUtil),
    criarModuloBase("superior", "superior", "Superior", calcularLarguraEstrutural(), closetState.alturaSuperior),
    criarModuloBase("inferior", "inferior", "Inferior", calcularLarguraEstrutural(), closetState.alturaInferior)
  ];
  sincronizarModulosEstruturais();
}

function criarModuloBase(id, tipo, nome, largura, altura) {
  return {
    id,
    tipo,
    nome,
    largura,
    altura,
    profundidade: closetState.profundidade,
    perfis: ["9700", "9700", "9700", "9700"]
  };
}

function criarModuloCentral(largura = closetState.larguraCentralPadrao) {
  closetState.contadorCentral += 1;
  return criarModuloBase(
    `central-${closetState.contadorCentral}`,
    "central",
    `Central ${closetState.contadorCentral}`,
    largura,
    closetState.alturaUtil
  );
}

function vincularEventosGerais() {
  elementos.profundidade.addEventListener("input", (event) => {
    closetState.profundidade = normalizarNumero(event.target.value, 1);
    sincronizarModulosEstruturais();
    atualizarInterface();
  });

  elementos.alturaUtil.addEventListener("input", (event) => {
    closetState.alturaUtil = normalizarNumero(event.target.value, 1);
    sincronizarModulosEstruturais();
    atualizarInterface();
  });

  elementos.larguraLateral.addEventListener("input", (event) => {
    closetState.larguraLateral = normalizarNumero(event.target.value, 1);
    sincronizarModulosEstruturais();
    atualizarInterface();
  });

  elementos.alturaSuperior.addEventListener("input", (event) => {
    closetState.alturaSuperior = normalizarNumero(event.target.value, 1);
    sincronizarModulosEstruturais();
    atualizarInterface();
  });

  elementos.alturaInferior.addEventListener("input", (event) => {
    closetState.alturaInferior = normalizarNumero(event.target.value, 1);
    sincronizarModulosEstruturais();
    atualizarInterface();
  });

  elementos.larguraCentralPadrao.addEventListener("input", (event) => {
    closetState.larguraCentralPadrao = normalizarNumero(event.target.value, 1);
  });

  elementos.btnAdicionarCentral.addEventListener("click", adicionarModuloCentral);
  elementos.btnRemoverUltimoCentral.addEventListener("click", removerUltimoModuloCentral);
}

function normalizarNumero(valor, minimo = 0) {
  const numero = Number(valor);
  if (Number.isNaN(numero)) {
    return minimo;
  }
  return Math.max(minimo, numero);
}

function obterModulosCentrais() {
  return closetState.modulos.filter((modulo) => modulo.tipo === "central");
}

function obterModulosVerticais() {
  return closetState.modulos.filter((modulo) => modulo.tipo === "lateral" || modulo.tipo === "central");
}

function calcularLarguraEstrutural() {
  return obterModulosVerticais().reduce((total, modulo) => total + normalizarNumero(modulo.largura), 0);
}

function calcularAlturaTotal() {
  return closetState.alturaInferior + closetState.alturaUtil + closetState.alturaSuperior;
}

function sincronizarModulosEstruturais() {
  const larguraEstrutural = calcularLarguraEstrutural();

  closetState.modulos.forEach((modulo) => {
    modulo.profundidade = closetState.profundidade;

    if (modulo.tipo === "lateral") {
      modulo.largura = closetState.larguraLateral;
      modulo.altura = closetState.alturaUtil;
    }

    if (modulo.tipo === "central") {
      modulo.altura = closetState.alturaUtil;
    }

    if (modulo.tipo === "superior") {
      modulo.largura = larguraEstrutural;
      modulo.altura = closetState.alturaSuperior;
    }

    if (modulo.tipo === "inferior") {
      modulo.largura = larguraEstrutural;
      modulo.altura = closetState.alturaInferior;
    }
  });
}

function calcularModulo(modulo) {
  const largura = normalizarNumero(modulo.largura);
  const altura = normalizarNumero(modulo.altura);
  const profundidade = normalizarNumero(modulo.profundidade);
  let comprimentosPerfis;

  if (modulo.tipo === "lateral") {
    comprimentosPerfis = [altura, altura, profundidade, profundidade];
  } else if (modulo.tipo === "superior" || modulo.tipo === "inferior") {
    comprimentosPerfis = [largura, largura, profundidade, profundidade];
  } else {
    comprimentosPerfis = [altura, altura, largura, largura];
  }

  const totalAluminioMm = comprimentosPerfis.reduce((total, comprimento) => total + comprimento, 0);

  return {
    ...modulo,
    comprimentosPerfis,
    totalPerfis: modulo.perfis.length,
    totalAluminioMm,
    totalAluminioM: totalAluminioMm / 1000
  };
}

function calcularCloset() {
  sincronizarModulosEstruturais();
  const modulosCalculados = closetState.modulos.map(calcularModulo);
  const larguraTotal = calcularLarguraEstrutural();
  const alturaTotal = calcularAlturaTotal();
  const profundidadeTotal = closetState.profundidade;
  const totalPerfis = modulosCalculados.reduce((total, modulo) => total + modulo.totalPerfis, 0);
  const totalAluminioMm = modulosCalculados.reduce((total, modulo) => total + modulo.totalAluminioMm, 0);

  return {
    modulosCalculados,
    totalModulos: modulosCalculados.length,
    totalPerfis,
    totalAluminioMm,
    totalAluminioM: totalAluminioMm / 1000,
    larguraTotal,
    alturaTotal,
    profundidadeTotal
  };
}

function atualizarInterface() {
  const calculo = calcularCloset();
  renderizarModulos(calculo);
  renderizarVisualizacao(calculo);
  renderizarResumo(calculo);
}

function renderizarModulos(calculo) {
  elementos.modulosEditor.innerHTML = "";

  calculo.modulosCalculados.forEach((modulo) => {
    const card = document.createElement("article");
    card.className = "module-card";
    card.innerHTML = `
      <div class="module-card__header">
        <div class="module-card__title">
          <h3>${modulo.nome}</h3>
          <span class="module-card__meta">Tipo: ${modulo.tipo} · Alumínio: ${formatarMetro(modulo.totalAluminioM)}</span>
        </div>
        ${modulo.tipo === "central" ? `<button class="btn btn-danger" type="button" data-remove-central="${modulo.id}">Remover</button>` : ""}
      </div>
      <div class="module-card__grid">
        <label class="field">
          <span>Largura</span>
          <input type="number" min="1" step="10" value="${modulo.largura}" data-modulo-medida="largura" data-modulo-id="${modulo.id}" ${modulo.tipo === "superior" || modulo.tipo === "inferior" ? "readonly" : ""}>
        </label>
        <label class="field">
          <span>Altura</span>
          <input type="number" min="1" step="10" value="${modulo.altura}" data-modulo-medida="altura" data-modulo-id="${modulo.id}" ${modulo.tipo !== "central" ? "readonly" : ""}>
        </label>
        <label class="field">
          <span>Profundidade</span>
          <input type="number" min="1" step="10" value="${modulo.profundidade}" data-modulo-medida="profundidade" data-modulo-id="${modulo.id}" readonly>
        </label>
      </div>
      <div class="profile-grid">
        ${modulo.perfis.map((perfil, index) => criarSelectPerfilHtml(modulo.id, index, perfil, modulo.comprimentosPerfis[index])).join("")}
      </div>
    `;
    elementos.modulosEditor.appendChild(card);
  });

  elementos.modulosEditor.querySelectorAll("[data-modulo-medida]").forEach((input) => {
    input.addEventListener("input", alterarMedidaModulo);
  });

  elementos.modulosEditor.querySelectorAll("[data-perfil-posicao]").forEach((select) => {
    select.addEventListener("change", (event) => {
      atualizarPerfilModulo(event.target.dataset.moduloId, Number(event.target.dataset.perfilPosicao), event.target.value);
    });
  });

  elementos.modulosEditor.querySelectorAll("[data-remove-central]").forEach((button) => {
    button.addEventListener("click", () => removerModuloCentral(button.dataset.removeCentral));
  });
}

function criarSelectPerfilHtml(idModulo, posicaoPerfil, perfilAtual, comprimento) {
  const opcoes = perfisDisponiveis.map((perfil) => {
    const selected = perfil === perfilAtual ? "selected" : "";
    return `<option value="${perfil}" ${selected}>${perfil}</option>`;
  }).join("");

  return `
    <label class="field">
      <span>Perfil ${posicaoPerfil + 1} · ${comprimento} mm</span>
      <select data-modulo-id="${idModulo}" data-perfil-posicao="${posicaoPerfil}">
        ${opcoes}
      </select>
    </label>
  `;
}

function alterarMedidaModulo(event) {
  const modulo = closetState.modulos.find((item) => item.id === event.target.dataset.moduloId);
  const medida = event.target.dataset.moduloMedida;
  if (!modulo || !medida) {
    return;
  }

  modulo[medida] = normalizarNumero(event.target.value, 1);

  if (modulo.tipo === "lateral" && medida === "largura") {
    closetState.larguraLateral = modulo.largura;
    elementos.larguraLateral.value = modulo.largura;
  }

  if (modulo.tipo === "central" && medida === "altura") {
    closetState.alturaUtil = modulo.altura;
    elementos.alturaUtil.value = modulo.altura;
  }

  sincronizarModulosEstruturais();
  atualizarInterface();
}

function renderizarVisualizacao(calculo) {
  const verticais = obterModulosVerticais();
  const totalLargura = Math.max(calculo.larguraTotal, 1);
  const gridTemplateColumns = verticais
    .map((modulo) => `${Math.max((modulo.largura / totalLargura) * 100, 8)}fr`)
    .join(" ");

  elementos.closetPreview.innerHTML = `
    <div class="preview-shell">
      <div class="preview-measure">Largura total: ${calculo.larguraTotal} mm</div>
      <div class="preview-body">
        <div class="preview-top">Módulo superior · ${calculo.larguraTotal} × ${closetState.alturaSuperior} × ${calculo.profundidadeTotal} mm</div>
        <div class="preview-columns" style="grid-template-columns: ${gridTemplateColumns};">
          ${verticais.map((modulo) => `
            <div class="preview-module ${modulo.tipo}">
              <div class="preview-module__content">
                <span class="preview-module__name">${modulo.nome}</span>
                <span class="preview-module__measure">${modulo.largura} × ${modulo.altura} × ${modulo.profundidade} mm</span>
              </div>
            </div>
          `).join("")}
        </div>
        <div class="preview-bottom">Módulo inferior · ${calculo.larguraTotal} × ${closetState.alturaInferior} × ${calculo.profundidadeTotal} mm</div>
      </div>
      <div class="preview-measure">Altura total: ${calculo.alturaTotal} mm · Profundidade: ${calculo.profundidadeTotal} mm</div>
    </div>
  `;
}

function renderizarResumo(calculo) {
  elementos.badgeModulos.textContent = `${calculo.totalModulos} módulos`;
  elementos.dimensoesResumoCurto.textContent = `${calculo.larguraTotal} × ${calculo.alturaTotal} × ${calculo.profundidadeTotal} mm`;
  elementos.resumoTotalModulos.textContent = calculo.totalModulos;
  elementos.resumoTotalPerfis.textContent = calculo.totalPerfis;
  elementos.resumoMetragemAluminio.textContent = formatarMetro(calculo.totalAluminioM);
  elementos.resumoAlturaTotal.textContent = `${calculo.alturaTotal} mm`;
  elementos.resumoLarguraTotal.textContent = `${calculo.larguraTotal} mm`;
  elementos.resumoProfundidadeTotal.textContent = `${calculo.profundidadeTotal} mm`;
  elementos.btnRemoverUltimoCentral.disabled = obterModulosCentrais().length === 0;
}

function adicionarModuloCentral() {
  const novoModulo = criarModuloCentral();
  const indiceLateralDireito = closetState.modulos.findIndex((modulo) => modulo.id === "lateral-direito");
  closetState.modulos.splice(indiceLateralDireito, 0, novoModulo);
  sincronizarModulosEstruturais();
  atualizarInterface();
}

function removerUltimoModuloCentral() {
  const centrais = obterModulosCentrais();
  const ultimoCentral = centrais[centrais.length - 1];
  if (ultimoCentral) {
    removerModuloCentral(ultimoCentral.id);
  }
}

function removerModuloCentral(id) {
  closetState.modulos = closetState.modulos.filter((modulo) => modulo.id !== id || modulo.tipo !== "central");
  sincronizarModulosEstruturais();
  atualizarInterface();
}

function atualizarPerfilModulo(idModulo, posicaoPerfil, perfilSelecionado) {
  const modulo = closetState.modulos.find((item) => item.id === idModulo);
  if (!modulo || !perfisDisponiveis.includes(perfilSelecionado)) {
    return;
  }

  modulo.perfis[posicaoPerfil] = perfilSelecionado;
  atualizarInterface();
}

function formatarMetro(valor) {
  return `${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} m`;
}
