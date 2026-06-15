// Closet Evidence 3D neutralizado temporariamente.
// Não gera nenhuma representação visual para evitar conflito com o preview das portas.

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
                Cálculo, salvar, editar e copiar continuam funcionando.
            </div>
        `;
    }

    function restaurarPreviewPadrao() {
        if (isClosetEvidence()) return;
        const preview = document.querySelector('.door-preview');
        if (!preview) return;
        const atual = document.getElementById('portaSVG');
        if (atual && atual.tagName && atual.tagName.toLowerCase() === 'svg') return;
        preview.innerHTML = '<svg id="portaSVG"></svg>';
        if (typeof desenharPorta === 'function') setTimeout(() => desenharPorta(), 0);
    }

    function instalarClosetEvidenceReal3D() {
        document.addEventListener('input', () => {
            setTimeout(limparPreviewClosetEvidence, 0);
            setTimeout(limparPreviewClosetEvidence, 120);
        }, true);

        document.addEventListener('change', () => {
            setTimeout(() => {
                if (isClosetEvidence()) limparPreviewClosetEvidence();
                else restaurarPreviewPadrao();
            }, 0);
            setTimeout(limparPreviewClosetEvidence, 180);
        }, true);

        setTimeout(limparPreviewClosetEvidence, 500);
        setTimeout(limparPreviewClosetEvidence, 1200);
    }

    window.renderClosetEvidenceReal3D = limparPreviewClosetEvidence;
    window.instalarClosetEvidenceReal3D = instalarClosetEvidenceReal3D;

    document.addEventListener('DOMContentLoaded', instalarClosetEvidenceReal3D);
    setTimeout(instalarClosetEvidenceReal3D, 900);
})();
