// =====================
// PAINEL DE PENDÊNCIAS OBRIGATÓRIAS DA PORTA
// Mostra apenas campos obrigatórios ainda não preenchidos.
// As linhas somem conforme o usuário preenche.
// =====================

function valorCampoObrigatorio(id) {
    const el = document.getElementById(id);
    if (!el) return "";
    return String(el.value ?? "").trim();
}

function numeroCampoObrigatorio(id) {
    const valor = valorCampoObrigatorio(id).replace(",", ".");
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
}

function adicionarPendenciaObrigatoria(lista, campo, mensagem) {
    lista.push({ campo, mensagem });
}

function obterPendenciasObrigatoriasPortaAtual() {
    const pendencias = [];
    const tipo = valorCampoObrigatorio("tipologia");

    if (!tipo) adicionarPendenciaObrigatoria(pendencias, "Tipologia", "Tipologia vazia");
    if (numeroCampoObrigatorio("largura") <= 0) adicionarPendenciaObrigatoria(pendencias, "Largura", "Largura vazia");
    if (numeroCampoObrigatorio("altura") <= 0) adicionarPendenciaObrigatoria(pendencias, "Altura", "Altura vazia");
    if (numeroCampoObrigatorio("quantidade") <= 0) adicionarPendenciaObrigatoria(pendencias, "Quantidade", "Quantidade vazia");
    if (!valorCampoObrigatorio("perfil")) adicionarPendenciaObrigatoria(pendencias, "Perfil", "Perfil vazio");
    if (!valorCampoObrigatorio("vidro")) adicionarPendenciaObrigatoria(pendencias, "Vidro", "Vidro vazio");

    if (tipo === "giro") {
        const qtdDobradicasRaw = valorCampoObrigatorio("dobradicas");
        const qtdDobradicas = parseInt(qtdDobradicasRaw || "0", 10) || 0;
        const alturasDobradicas = typeof obterAlturasDobradicas === "function" ? obterAlturasDobradicas() : [];

        if (!qtdDobradicasRaw) {
            adicionarPendenciaObrigatoria(pendencias, "Dobradiças", "Quantidade de dobradiças vazia");
        } else if (qtdDobradicas < 2) {
            adicionarPendenciaObrigatoria(pendencias, "Dobradiças", "Mínimo de 2 dobradiças");
        }

        if (qtdDobradicas >= 2 && alturasDobradicas.length !== qtdDobradicas) {
            adicionarPendenciaObrigatoria(pendencias, "Alturas das dobradiças", "Alturas das dobradiças incompletas");
        }

        if (!valorCampoObrigatorio("dobradicas_posicao")) {
            adicionarPendenciaObrigatoria(pendencias, "Lado das dobradiças", "Lado das dobradiças vazio");
        }
    }

    const puxadorEl = document.getElementById("puxador");
    if (puxadorEl && tipo !== "correr") {
        const puxador = valorCampoObrigatorio("puxador");
        if (!puxador) {
            adicionarPendenciaObrigatoria(pendencias, "Puxador", "Puxador vazio");
        }

        if (puxador && puxador !== "sem_puxador" && !valorCampoObrigatorio("puxador_posicao")) {
            adicionarPendenciaObrigatoria(pendencias, "Lado do puxador", "Lado do puxador vazio");
        }

        const puxadorSelecionado = typeof obterPuxadorSelecionado === "function" ? obterPuxadorSelecionado() : null;
        const ehPuxadorPerfil = typeof puxadorEhPerfil === "function" && puxadorEhPerfil(puxadorSelecionado);
        const ehMetroLinear = puxadorSelecionado?.tipo_medida === "metro_linear";
        if (puxador && puxador !== "sem_puxador" && ehMetroLinear && !ehPuxadorPerfil && numeroCampoObrigatorio("medida_puxador") <= 0) {
            adicionarPendenciaObrigatoria(pendencias, "Tamanho do puxador", "Tamanho do puxador vazio");
        }
    }

    if (tipo === "deslizante" || tipo === "correr") {
        if (!valorCampoObrigatorio("sistemas")) adicionarPendenciaObrigatoria(pendencias, "Sistema", "Sistema vazio");
        if (!valorCampoObrigatorio("trilhos_superior")) adicionarPendenciaObrigatoria(pendencias, "Trilho superior", "Trilho superior vazio");
        if (!valorCampoObrigatorio("trilhos_inferior")) adicionarPendenciaObrigatoria(pendencias, "Trilho inferior", "Trilho inferior vazio");
    }

    return pendencias;
}

function criarPainelPendenciasObrigatorias() {
    let painel = document.getElementById("pendenciasObrigatoriasPorta");
    if (painel) return painel;

    painel = document.createElement("div");
    painel.id = "pendenciasObrigatoriasPorta";
    painel.style.marginTop = "14px";
    painel.style.background = "#fff";
    painel.style.border = "1px solid #ffd1d1";
    painel.style.borderRadius = "10px";
    painel.style.overflow = "hidden";
    painel.style.boxShadow = "0 4px 14px rgba(0,0,0,0.08)";

    const porta3D = document.getElementById("porta3D");
    const portaSVG = document.getElementById("portaSVG");
    const alvo = porta3D || portaSVG;

    if (alvo) {
        alvo.insertAdjacentElement("afterend", painel);
    } else {
        document.body.appendChild(painel);
    }

    return painel;
}

function renderizarPendenciasObrigatoriasPorta() {
    const painel = criarPainelPendenciasObrigatorias();
    if (!painel) return;

    const pendencias = obterPendenciasObrigatoriasPortaAtual();

    if (pendencias.length === 0) {
        painel.style.display = "none";
        return;
    }

    painel.style.display = "block";
    painel.innerHTML = `
        <div style="background:#fff1f1;color:#9b1c1c;font-weight:800;padding:10px 12px;border-bottom:1px solid #ffd1d1;">
            Pendências obrigatórias
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
            <thead>
                <tr style="background:#ffe5e5;color:#7f1d1d;">
                    <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #ffd1d1;">Campo</th>
                    <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #ffd1d1;">Pendência</th>
                </tr>
            </thead>
            <tbody>
                ${pendencias.map((item) => `
                    <tr style="background:#fffafa;color:#b91c1c;">
                        <td style="padding:8px 10px;border-bottom:1px solid #ffe0e0;font-weight:700;">${item.campo}</td>
                        <td style="padding:8px 10px;border-bottom:1px solid #ffe0e0;">${item.mensagem}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

function instalarPainelPendenciasObrigatorias() {
    const eventos = ["input", "change", "click"];
    eventos.forEach((evento) => {
        document.addEventListener(evento, () => {
            setTimeout(renderizarPendenciasObrigatoriasPorta, 0);
            setTimeout(renderizarPendenciasObrigatoriasPorta, 120);
        }, true);
    });

    const renderCamposOriginal = window.renderCampos;
    if (typeof renderCamposOriginal === "function" && !renderCamposOriginal.__pendenciasWrapped) {
        const wrapped = function(...args) {
            const resultado = renderCamposOriginal.apply(this, args);
            setTimeout(renderizarPendenciasObrigatoriasPorta, 0);
            setTimeout(renderizarPendenciasObrigatoriasPorta, 250);
            return resultado;
        };
        wrapped.__pendenciasWrapped = true;
        window.renderCampos = wrapped;
    }

    setTimeout(renderizarPendenciasObrigatoriasPorta, 300);
    setTimeout(renderizarPendenciasObrigatoriasPorta, 900);
    setTimeout(renderizarPendenciasObrigatoriasPorta, 1600);
}

window.obterPendenciasObrigatoriasPortaAtual = obterPendenciasObrigatoriasPortaAtual;
window.renderizarPendenciasObrigatoriasPorta = renderizarPendenciasObrigatoriasPorta;
window.instalarPainelPendenciasObrigatorias = instalarPainelPendenciasObrigatorias;

document.addEventListener("DOMContentLoaded", instalarPainelPendenciasObrigatorias);
setTimeout(instalarPainelPendenciasObrigatorias, 500);
