// Regra final: se o usuário mudar manualmente a tipologia, sai do modo edição.

(function () {
    function estaEditando() {
        return typeof editando !== 'undefined' && editando !== null;
    }

    function garantirPreviewSvgPadrao() {
        const preview = document.querySelector('.door-preview');
        if (!preview) return;
        const atual = document.getElementById('portaSVG');
        if (atual && atual.tagName && atual.tagName.toLowerCase() === 'svg') return;
        preview.innerHTML = '<svg id="portaSVG"></svg>';
    }

    function sairDoModoEdicaoPorTrocaTipologia() {
        if (!estaEditando()) return false;

        editando = null;

        const qtd = document.getElementById('quantidade');
        if (qtd) qtd.value = '1';

        document.querySelectorAll('.porta-row-editando').forEach(row => row.classList.remove('porta-row-editando'));
        document.querySelectorAll('.porta-editando-badge').forEach(badge => badge.remove());

        const botaoSalvar = Array.from(document.querySelectorAll('.door-form button, #doorActionsFooter button'))
            .find(btn => String(btn.getAttribute('onclick') || '').includes('salvarPorta'));
        if (botaoSalvar) botaoSalvar.textContent = 'Salvar Porta';

        if (typeof atualizarVisualModoEdicaoPortas === 'function') {
            setTimeout(() => atualizarVisualModoEdicaoPortas(), 0);
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

    function tratarTrocaTipologiaManual() {
        sairDoModoEdicaoPorTrocaTipologia();
        reprocessarTipologiaAtual();
    }

    function instalarEditingStateFix() {
        document.addEventListener('change', (ev) => {
            if (ev.target?.id === 'tipologia') {
                setTimeout(tratarTrocaTipologiaManual, 0);
                setTimeout(tratarTrocaTipologiaManual, 180);
                setTimeout(tratarTrocaTipologiaManual, 500);
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

    window.sairDoModoEdicaoPorTrocaTipologia = sairDoModoEdicaoPorTrocaTipologia;
    window.instalarEditingStateFix = instalarEditingStateFix;

    document.addEventListener('DOMContentLoaded', instalarEditingStateFix);
    setTimeout(instalarEditingStateFix, 900);
})();
