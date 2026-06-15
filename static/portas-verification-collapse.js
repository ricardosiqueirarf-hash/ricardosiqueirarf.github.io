// Deixa a verificação do orçamento recolhida por padrão.

function adicionarEstilosVerificacaoRecolhida() {
    if (document.getElementById('portasVerificationCollapseStyles')) return;
    const style = document.createElement('style');
    style.id = 'portasVerificationCollapseStyles';
    style.textContent = `
        .orcamento-collapsed-body{display:none;}
        .orcamento-auditoria-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;}
        .orcamento-auditoria-header h2{margin:0;}
        .orcamento-toggle-btn{padding:9px 12px;border-radius:10px;border:none;background:rgba(16,121,186,.12);color:#0d5d8c;font-weight:900;cursor:pointer;}
    `;
    document.head.appendChild(style);
}

function organizarVerificacaoOrcamentoRecolhida() {
    adicionarEstilosVerificacaoRecolhida();
    const card = document.getElementById('orcamentoAuditoriaCard');
    if (!card || card.dataset.organizadoVerificacao === 'true') return;

    const titulo = card.querySelector('h2');
    const filhos = Array.from(card.children).filter(child => child !== titulo);

    const header = document.createElement('div');
    header.className = 'orcamento-auditoria-header';
    if (titulo) header.appendChild(titulo);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'orcamento-toggle-btn';
    toggle.textContent = 'Abrir verificação';

    const body = document.createElement('div');
    body.id = 'orcamentoAuditoriaBody';
    body.className = 'orcamento-collapsed-body';
    filhos.forEach(child => body.appendChild(child));

    toggle.addEventListener('click', () => {
        const fechado = body.classList.toggle('orcamento-collapsed-body');
        toggle.textContent = fechado ? 'Abrir verificação' : 'Ocultar verificação';
    });

    header.appendChild(toggle);
    card.replaceChildren(header, body);
    card.dataset.organizadoVerificacao = 'true';
}

window.organizarVerificacaoOrcamentoRecolhida = organizarVerificacaoOrcamentoRecolhida;
document.addEventListener('DOMContentLoaded', organizarVerificacaoOrcamentoRecolhida);
setTimeout(organizarVerificacaoOrcamentoRecolhida, 500);
setTimeout(organizarVerificacaoOrcamentoRecolhida, 1200);
