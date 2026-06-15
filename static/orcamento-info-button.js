// Adiciona botões laterais em portas.html: Aprovação e Informações do orçamento.

(function () {
  function getUuid() {
    const params = new URLSearchParams(window.location.search);
    return window.ORCAMENTO_UUID || params.get('orcamento_uuid') || '';
  }

  function tokenParam() {
    const params = new URLSearchParams(window.location.search);
    const token = localStorage.getItem('USER_TOKEN') || params.get('token') || '';
    return token ? `&token=${encodeURIComponent(token)}` : '';
  }

  function criarBotao(id, texto, destino) {
    let botao = document.getElementById(id);
    if (botao) return botao;

    botao = document.createElement('button');
    botao.id = id;
    botao.type = 'button';
    botao.textContent = texto;
    botao.addEventListener('click', () => {
      const uuid = getUuid();
      if (!uuid) {
        alert('Orçamento não encontrado.');
        return;
      }
      window.location.href = `${destino}?orcamento_uuid=${encodeURIComponent(uuid)}${tokenParam()}`;
    });
    return botao;
  }

  function instalarBotoesOrcamento() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const botaoVoltar = Array.from(sidebar.querySelectorAll('button'))
      .find(btn => String(btn.textContent || '').trim().toLowerCase() === 'voltar');

    const botaoAprovacao = criarBotao('btnSidebarAprovacao', 'Aprovação', 'aprovacao.html');
    const botaoInfo = criarBotao('btnSidebarInfoOrcamento', 'Informações do orçamento', 'vizualizacao.html');

    if (botaoVoltar) {
      botaoVoltar.insertAdjacentElement('afterend', botaoAprovacao);
      botaoAprovacao.insertAdjacentElement('afterend', botaoInfo);
      return;
    }

    sidebar.appendChild(botaoAprovacao);
    sidebar.appendChild(botaoInfo);
  }

  document.addEventListener('DOMContentLoaded', instalarBotoesOrcamento);
  setTimeout(instalarBotoesOrcamento, 500);
  setTimeout(instalarBotoesOrcamento, 1200);
})();
