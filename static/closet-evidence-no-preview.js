// Remove qualquer representação visual do Closet Evidence por enquanto.
// Mantém cálculo, campos, salvar/editar/copiar, mas não desenha nada no preview.

(function () {
    const TIPO = 'closet_evidence';

    function isClosetEvidence() {
        return document.getElementById('tipologia')?.value === TIPO;
    }

    function limparPreviewClosetEvidence() {
        if (!isClosetEvidence()) return;
        const preview = document.querySelector('.door-preview');
        if (!preview) return;
        preview.innerHTML = `
            <div id="portaSVG" style="
                min-height: 220px;
                display: grid;
                place-items: center;
                border: 1px dashed rgba(16,121,186,.25);
                border-radius: 18px;
                background: rgba(248,251,255,.72);
                color: #6b7280;
                font-weight: 900;
                text-align: center;
                padding: 20px;
            ">
                Preview do Closet Evidence temporariamente desativado.<br>
                O cálculo e salvamento continuam funcionando.
            </div>
        `;
    }

    function restaurarSvgParaOutrasTipologias() {
        if (isClosetEvidence()) return;
        const preview = document.querySelector('.door-preview');
        if (!preview) return;
        const atual = document.getElementById('portaSVG');
        if (atual && atual.tagName && atual.tagName.toLowerCase() === 'svg') return;
        preview.innerHTML = '<svg id="portaSVG"></svg>';
        if (typeof desenharPorta === 'function') {
            setTimeout(() => desenharPorta(), 0);
        }
    }

    function instalarClosetEvidenceNoPreview() {
        document.addEventListener('input', () => {
            setTimeout(limparPreviewClosetEvidence, 0);
            setTimeout(limparPreviewClosetEvidence, 120);
        }, true);

        document.addEventListener('change', () => {
            setTimeout(() => {
                if (isClosetEvidence()) limparPreviewClosetEvidence();
                else restaurarSvgParaOutrasTipologias();
            }, 0);
            setTimeout(() => {
                if (isClosetEvidence()) limparPreviewClosetEvidence();
            }, 180);
        }, true);

        const obs = new MutationObserver(() => {
            if (!isClosetEvidence()) return;
            const atual = document.getElementById('portaSVG');
            if (!atual || atual.tagName?.toLowerCase() === 'svg' || atual.querySelector?.('.ce-cube-stage, .ce-real3d-stage, .ce-preview, .ce3d-stage')) {
                setTimeout(limparPreviewClosetEvidence, 0);
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });

        setTimeout(limparPreviewClosetEvidence, 500);
        setTimeout(limparPreviewClosetEvidence, 1200);
    }

    window.limparPreviewClosetEvidence = limparPreviewClosetEvidence;
    window.instalarClosetEvidenceNoPreview = instalarClosetEvidenceNoPreview;

    document.addEventListener('DOMContentLoaded', instalarClosetEvidenceNoPreview);
    setTimeout(instalarClosetEvidenceNoPreview, 900);
})();
