// Closet Evidence upgrade neutralizado temporariamente.
// Mantém a página estável sem gerar qualquer representação visual do closet.

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

    function instalarClosetEvidenceSemPreview() {
        document.addEventListener('input', () => {
            setTimeout(limparPreviewClosetEvidence, 0);
            setTimeout(limparPreviewClosetEvidence, 120);
        }, true);

        document.addEventListener('change', () => {
            setTimeout(limparPreviewClosetEvidence, 0);
            setTimeout(limparPreviewClosetEvidence, 180);
        }, true);

        setTimeout(limparPreviewClosetEvidence, 500);
        setTimeout(limparPreviewClosetEvidence, 1200);
    }

    window.limparPreviewClosetEvidence = limparPreviewClosetEvidence;
    window.instalarClosetEvidenceSemPreview = instalarClosetEvidenceSemPreview;

    document.addEventListener('DOMContentLoaded', instalarClosetEvidenceSemPreview);
    setTimeout(instalarClosetEvidenceSemPreview, 900);
})();
