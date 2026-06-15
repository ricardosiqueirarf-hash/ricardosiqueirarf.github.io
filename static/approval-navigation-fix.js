// Remove função antiga Portas técnico e adiciona atalho para Aprovação mantendo orcamento_uuid.

function obterOrcamentoUuidAtual() {
    const params = new URLSearchParams(window.location.search);
    return window.ORCAMENTO_UUID || params.get('orcamento_uuid') || '';
}

function irParaAprovacaoComUuid() {
    const uuid = obterOrcamentoUuidAtual();
    const destino = uuid
        ? `aprovacao.html?orcamento_uuid=${encodeURIComponent(uuid)}`
        : 'aprovacao.html';
    window.location.href = destino;
}

function removerBotaoPortasTecnico() {
    const botaoTecnico = document.getElementById('btnPortasTecnico');
    if (botaoTecnico) botaoTecnico.remove();
}

function adicionarBotaoAprovacaoSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || document.getElementById('btnIrAprovacao')) return;

    const botao = document.createElement('button');
    botao.id = 'btnIrAprovacao';
    botao.type = 'button';
    botao.textContent = 'Aprovação';
    botao.addEventListener('click', irParaAprovacaoComUuid);

    sidebar.appendChild(botao);
}

function instalarNavegacaoAprovacao() {
    removerBotaoPortasTecnico();
    adicionarBotaoAprovacaoSidebar();
}

window.irParaAprovacaoComUuid = irParaAprovacaoComUuid;
window.instalarNavegacaoAprovacao = instalarNavegacaoAprovacao;

document.addEventListener('DOMContentLoaded', instalarNavegacaoAprovacao);
setTimeout(instalarNavegacaoAprovacao, 300);
setTimeout(instalarNavegacaoAprovacao, 900);
setTimeout(instalarNavegacaoAprovacao, 1600);
