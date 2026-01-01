window.App3D = window.App3D || {};

(() => {
  const App3D = window.App3D;

  App3D.API_BASE = "https://colorglass.onrender.com";
  App3D.dom = App3D.dom || {};
  App3D.dom.perfisSelect = document.getElementById("perfil");

  App3D.tipologiaEhEstrutural = function tipologiaEhEstrutural(valor) {
    const normalizado = String(valor || "").toLowerCase().trim();
    return normalizado === "estrutural" || normalizado === "estruturais";
  };

  App3D.extrairTipologias = function extrairTipologias(perfil) {
    if (Array.isArray(perfil.tipologias)) {
      return perfil.tipologias;
    }
    if (typeof perfil.tipologias === "string") {
      const normalized = perfil.tipologias.trim();
      try {
        const parsed = JSON.parse(normalized);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (err) {
        // ignora erro de parse e continua com string
      }
      return normalized.split(",").map((item) => item.trim());
    }
    if (perfil.tipologia) {
      return [perfil.tipologia];
    }
    return [];
  };

  App3D.carregarPerfisEstruturais = async function carregarPerfisEstruturais() {
    try {
      const res = await fetch(`${App3D.API_BASE}/api/perfis`);
      const perfis = await res.json();
      const perfisEstruturais = perfis.filter((perfil) => {
        const tipologias = App3D.extrairTipologias(perfil);
        return tipologias.some((t) => App3D.tipologiaEhEstrutural(t));
      });

      App3D.dom.perfisSelect.innerHTML = "<option value=''>Selecione um perfil</option>";
      perfisEstruturais.forEach((perfil) => {
        App3D.dom.perfisSelect.innerHTML += `<option value="${perfil.id}">${perfil.nome}</option>`;
      });
    } catch (error) {
      console.error("Erro ao carregar perfis estruturais:", error);
    }
  };
})();

