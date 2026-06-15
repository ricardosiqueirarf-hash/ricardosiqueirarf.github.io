// Ajusta apenas a exibição do nome da tipologia nas portas salvas.
// Mantém o HTML/estética já existente.
(function ajustarNomeDivisaoAmbiente() {
    function nomeTipologia(tipo) {
        if (typeof window.formatarTipologiaPorta === "function") return window.formatarTipologiaPorta(tipo);
        if (tipo === "correr" || tipo === "divisao_ambiente") return "Divisão de ambiente";
        if (tipo === "deslizante") return "Deslizante";
        if (tipo === "giro") return "Giro";
        return tipo || "-";
    }

    function aplicar() {
        const container = document.getElementById("portasSalvas");
        if (!container) return;
        container.querySelectorAll("div > strong").forEach((strong) => {
            const texto = strong.textContent || "";
            strong.textContent = texto
                .replace(/\b(correr|divisao_ambiente)\b/gi, nomeTipologia("divisao_ambiente"))
                .replace(/\bdeslizante\b/gi, nomeTipologia("deslizante"))
                .replace(/\bgiro\b/gi, nomeTipologia("giro"));
        });
    }

    function patchRender() {
        if (typeof window.renderPortas !== "function" || window.renderPortas.__displayDivisaoAmbienteFix) return;
        const original = window.renderPortas;
        const wrapped = function renderPortasComNomeDivisaoAmbiente() {
            const retorno = original.apply(this, arguments);
            aplicar();
            return retorno;
        };
        wrapped.__displayDivisaoAmbienteFix = true;
        window.renderPortas = wrapped;
        try { renderPortas = wrapped; } catch (_) {}
    }

    patchRender();
    aplicar();

    let tentativas = 0;
    const timer = setInterval(() => {
        tentativas += 1;
        patchRender();
        aplicar();
        if (tentativas >= 80) clearInterval(timer);
    }, 25);
})();
