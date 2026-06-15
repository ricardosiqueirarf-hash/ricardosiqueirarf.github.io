// Adiciona somente o botão "Informações do orçamento" em portas.html.
// Não cria botão de Aprovação para evitar duplicidade com approval-navigation-fix.js.

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

  function criarBotaoInfo() {
    let botao = document.getElementById('btnSidebarInfoOrcamento');
    if (botao) return botao;

    botao = document.createElement('button');
    botao.id = 'btnSidebarInfoOrcamento';
    botao.type = 'button';
    botao.textContent = 'Informações do orçamento';
    botao.addEventListener('click', () => {
      const uuid = getUuid();
      if (!uuid) {
        alert('Orçamento não encontrado.');
        return;
      }
      window.location.href = `vizualizacao.html?orcamento_uuid=${encodeURIComponent(uuid)}${tokenParam()}`;
    });
    return botao;
  }

  function removerAprovacaoDuplicada() {
    const duplicado = document.getElementById('btnSidebarAprovacao');
    if (duplicado) duplicado.remove();
  }

  function instalarBotaoInfoOrcamento() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    removerAprovacaoDuplicada();

    const botaoInfo = criarBotaoInfo();
    const botaoAprovacaoExistente = document.getElementById('btnIrAprovacao')
      || Array.from(sidebar.querySelectorAll('button')).find(btn => String(btn.textContent || '').trim().toLowerCase() === 'aprovação');

    if (botaoAprovacaoExistente) {
      botaoAprovacaoExistente.insertAdjacentElement('afterend', botaoInfo);
      return;
    }

    const botaoVoltar = Array.from(sidebar.querySelectorAll('button'))
      .find(btn => String(btn.textContent || '').trim().toLowerCase() === 'voltar');

    if (botaoVoltar) {
      botaoVoltar.insertAdjacentElement('afterend', botaoInfo);
      return;
    }

    sidebar.appendChild(botaoInfo);
  }

  document.addEventListener('DOMContentLoaded', instalarBotaoInfoOrcamento);
  setTimeout(instalarBotaoInfoOrcamento, 500);
  setTimeout(instalarBotaoInfoOrcamento, 1200);
  setTimeout(instalarBotaoInfoOrcamento, 2200);
})();
