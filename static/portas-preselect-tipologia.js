// Pré-seleciona a tipologia em portas.html quando vier de classes.html
// Ex: portas.html?orcamento_uuid=...&tipologia=giro

(function () {
    const TIPOS_VALIDOS = new Set(['giro', 'deslizante', 'correr']);

    function getTipologiaUrl() {
        const params = new URLSearchParams(window.location.search);
        const tipo = String(params.get('tipologia') || '').trim().toLowerCase();
        return TIPOS_VALIDOS.has(tipo) ? tipo : '';
    }

    function aplicarTipologiaUrl() {
        const tipo = getTipologiaUrl();
        if (!tipo) return;

        const select = document.getElementById('tipologia');
        if (!select) return;

        if (select.value === tipo && document.getElementById('campos')?.children.length) return;

        select.value = tipo;
        editando = null;

        const qtd = document.getElementById('quantidade');
        if (qtd && !qtd.value) qtd.value = '1';

        if (typeof renderCampos === 'function') renderCampos();

        if (tipo === 'giro' && typeof aplicarDobradicasPadrao === 'function') {
            setTimeout(() => aplicarDobradicasPadrao(), 0);
            setTimeout(() => aplicarDobradicasPadrao(), 200);
            setTimeout(() => aplicarDobradicasPadrao(), 600);
        }

        if ((tipo === 'deslizante' || tipo === 'correr') && typeof restaurarSistemaETrilhosPorta === 'function') {
            setTimeout(() => {
                if (typeof atualizarPrecoPorta === 'function') atualizarPrecoPorta();
                if (typeof desenharPorta === 'function') desenharPorta();
            }, 350);
        }

        if (typeof atualizarVisualModoEdicaoPortas === 'function') atualizarVisualModoEdicaoPortas();
    }

    window.aplicarTipologiaUrl = aplicarTipologiaUrl;

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(aplicarTipologiaUrl, 500);
        setTimeout(aplicarTipologiaUrl, 1200);
        setTimeout(aplicarTipologiaUrl, 2000);
    });
})();
