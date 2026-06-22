// Corrige edição de portas deslizantes/correr.
// O bug ocorria quando sistemasLista já estava carregado: o select novo não era repopulado.

async function carregarSistemas() {
    try {
        if (typeof sistemasCarregados !== 'undefined' && sistemasCarregados) {
            if (typeof atualizarSistemasSelect === 'function') atualizarSistemasSelect();
            return sistemasLista;
        }

        const res = await fetch('https://colorglass.onrender.com/api/sistemas');
        const data = await res.json();
        sistemasLista = Array.isArray(data) ? data : [];
        sistemasCarregados = true;
        if (typeof atualizarSistemasSelect === 'function') atualizarSistemasSelect();
        return sistemasLista;
    } catch (err) {
        console.error('Erro ao carregar sistemas:', err);
        return [];
    }
}

function valorSalvoPorta(dados, id) {
    if (!dados) return '';
    const valor = dados[id];
    return valor === undefined || valor === null ? '' : String(valor);
}

function aplicarValorCampoPorta(id, valor) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = valorSalvoPorta({ [id]: valor }, id);
}

function aplicarDadosBasicosPorta(dados) {
    // O perfil precisa ser aplicado antes do puxador, porque o select de puxadores é filtrado pelo perfil.
    const perfilEl = document.getElementById('perfil');
    if (perfilEl && dados.perfil) {
        perfilEl.value = valorSalvoPorta(dados, 'perfil');
    }

    if (typeof atualizarPuxadoresSelect === 'function') {
        atualizarPuxadoresSelect();
    }

    Object.keys(dados).forEach((k) => {
        if (k === 'perfil' || k === 'puxador') return;
        const el = document.getElementById(k);
        if (el) el.value = valorSalvoPorta(dados, k);
    });

    const puxadorEl = document.getElementById('puxador');
    if (puxadorEl && dados.puxador) {
        puxadorEl.value = valorSalvoPorta(dados, 'puxador');
    }

    if (typeof atualizarPuxadorTipo === 'function') atualizarPuxadorTipo();
    if (typeof atualizarCamposObrigatorios === 'function') atualizarCamposObrigatorios();
}

async function restaurarSistemaETrilhosPorta(porta) {
    if (!porta || (porta.tipo !== 'deslizante' && porta.tipo !== 'correr')) return;
    const dados = porta.dados || {};

    await carregarSistemas();

    const sistemasSelect = document.getElementById('sistemas');
    if (sistemasSelect) {
        if (typeof atualizarSistemasSelect === 'function') atualizarSistemasSelect();
        sistemasSelect.value = valorSalvoPorta(dados, 'sistemas');
    }

    if (typeof atualizarTrilhosDoSistema === 'function') atualizarTrilhosDoSistema();

    const trilhosSuperiorSelect = document.getElementById('trilhos_superior');
    const trilhosInferiorSelect = document.getElementById('trilhos_inferior');

    if (trilhosSuperiorSelect) trilhosSuperiorSelect.value = valorSalvoPorta(dados, 'trilhos_superior');
    if (trilhosInferiorSelect) trilhosInferiorSelect.value = valorSalvoPorta(dados, 'trilhos_inferior');

    if (typeof atualizarResumoTrilhos === 'function') atualizarResumoTrilhos();
    if (typeof atualizarCamposObrigatorios === 'function') atualizarCamposObrigatorios();
    if (typeof renderizarPendenciasObrigatoriasPorta === 'function') renderizarPendenciasObrigatoriasPorta();
    if (typeof atualizarPrecoPorta === 'function') atualizarPrecoPorta();
    if (typeof desenharPorta === 'function') desenharPorta();
}

function preencherCamposPorta(porta) {
    if (!porta) return;

    document.getElementById('tipologia').value = porta.tipo;
    document.getElementById('quantidade').value = porta.quantidade;

    if (typeof renderCampos === 'function') renderCampos();

    const dados = porta.dados || {};
    aplicarDadosBasicosPorta(dados);

    if (typeof preencherAlturasDobradicas === 'function') preencherAlturasDobradicas(dados);

    if (porta.tipo === 'deslizante' || porta.tipo === 'correr') {
        setTimeout(() => restaurarSistemaETrilhosPorta(porta), 0);
        setTimeout(() => restaurarSistemaETrilhosPorta(porta), 250);
        setTimeout(() => restaurarSistemaETrilhosPorta(porta), 800);

        // Alguns fixes recriam campos/trilhos de forma assíncrona. Reaplica perfil + puxador depois disso.
        setTimeout(() => aplicarDadosBasicosPorta(dados), 0);
        setTimeout(() => aplicarDadosBasicosPorta(dados), 250);
        setTimeout(() => aplicarDadosBasicosPorta(dados), 800);
    }

    if (typeof atualizarPuxadorTipo === 'function') atualizarPuxadorTipo();
    if (typeof atualizarPrecoPorta === 'function') atualizarPrecoPorta();
    if (typeof desenharPorta === 'function') desenharPorta();
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

window.carregarSistemas = carregarSistemas;
window.restaurarSistemaETrilhosPorta = restaurarSistemaETrilhosPorta;
window.aplicarDadosBasicosPorta = aplicarDadosBasicosPorta;
window.preencherCamposPorta = preencherCamposPorta;
window.editarPorta = editarPorta;
window.copiarPorta = copiarPorta;
