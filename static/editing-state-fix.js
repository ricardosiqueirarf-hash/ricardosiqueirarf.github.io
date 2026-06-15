// Corrige estado híbrido entre editar e novo ao trocar tipologia manualmente.

(function () {
    function portaEditandoAtual() {
        if (typeof editando === 'undefined' || editando === null) return null;
        if (!Array.isArray(portas)) return null;
        return portas.find(p => String(p.id) === String(editando)) || null;
    }

    function garantirPreviewSvgPadrao() {
        const preview = document.querySelector('.door-preview');
        if (!preview) return;
        const atual = document.getElementById('portaSVG');
        if (atual && atual.tagName && atual.tagName.toLowerCase() === 'svg') return;
        preview.innerHTML = '<svg id="portaSVG"></svg>';
    }

    function cancelarEdicaoSeTipologiaMudou() {
        const porta = portaEditandoAtual();
        if (!porta) return false;
        const tipoAtual = document.getElementById('tipologia')?.value || '';
        if (!tipoAtual || tipoAtual === porta.tipo) return false;

        editando = null;
        const qtd = document.getElementById('quantidade');
        if (qtd) qtd.value = '1';

        if (typeof atualizarVisualModoEdicaoPortas === 'function') {
            atualizarVisualModoEdicaoPortas();
        }
        return true;
    }

    function reprocessarTipologiaAtual() {
        const tipoAtual = document.getElementById('tipologia')?.value || '';

        if (tipoAtual !== 'closet_evidence') {
            garantirPreviewSvgPadrao();
        }

        if (typeof renderCampos === 'function') {
            renderCampos();
        }

        if (tipoAtual !== 'closet_evidence') {
            garantirPreviewSvgPadrao();
            if (typeof desenharPorta === 'function') setTimeout(() => desenharPorta(), 0);
        }

        if (tipoAtual === 'giro' && typeof aplicarDobradicasPadrao === 'function') {
            setTimeout(() => aplicarDobradicasPadrao(), 0);
            setTimeout(() => aplicarDobradicasPadrao(), 180);
            setTimeout(() => aplicarDobradicasPadrao(), 520);
        }

        if (typeof atualizarPrecoPorta === 'function') setTimeout(() => atualizarPrecoPorta(), 0);
        if (typeof atualizarCamposObrigatorios === 'function') setTimeout(() => atualizarCamposObrigatorios(), 0);
        if (typeof renderizarPendenciasObrigatoriasPorta === 'function') setTimeout(() => renderizarPendenciasObrigatoriasPorta(), 0);
        if (typeof atualizarVisualModoEdicaoPortas === 'function') setTimeout(() => atualizarVisualModoEdicaoPortas(), 0);
    }

    function tratarTrocaTipologia() {
        cancelarEdicaoSeTipologiaMudou();
        reprocessarTipologiaAtual();
    }

    function instalarEditingStateFix() {
        document.addEventListener('change', (ev) => {
            if (ev.target?.id === 'tipologia') {
                setTimeout(tratarTrocaTipologia, 0);
                setTimeout(tratarTrocaTipologia, 180);
                setTimeout(tratarTrocaTipologia, 500);
            }
        }, true);

        document.addEventListener('click', (ev) => {
            const texto = String(ev.target?.textContent || '').trim().toLowerCase();
            if (texto === 'editar') {
                setTimeout(() => {
                    if (typeof atualizarVisualModoEdicaoPortas === 'function') atualizarVisualModoEdicaoPortas();
                }, 0);
            }
        }, true);
    }

    window.instalarEditingStateFix = instalarEditingStateFix;
    document.addEventListener('DOMContentLoaded', instalarEditingStateFix);
    setTimeout(instalarEditingStateFix, 900);
})();
