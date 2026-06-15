// Organização visual leve da tela portas.

function adicionarEstilosLayoutPortas() {
    if (document.getElementById('portasLayoutCleanupStyles')) return;
    const style = document.createElement('style');
    style.id = 'portasLayoutCleanupStyles';
    style.textContent = `
        .porta-field-section{border:1px solid rgba(16,121,186,.12);background:rgba(248,251,255,.92);border-radius:14px;padding:12px;margin-bottom:12px;}
        .porta-field-section-title{font-weight:900;color:#0d5d8c;font-size:.9rem;margin-bottom:10px;display:flex;align-items:center;gap:8px;}
        .porta-field-section-title:before{content:"";width:8px;height:8px;border-radius:999px;background:#1079ba;display:inline-block;}
        .porta-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
        .door-actions-footer{position:sticky;bottom:0;z-index:8;background:rgba(255,255,255,.96);border:1px solid rgba(16,121,186,.14);box-shadow:0 -8px 18px rgba(15,44,62,.08);border-radius:14px;padding:12px;display:grid;gap:10px;margin-top:8px;backdrop-filter:blur(8px);}
        .door-actions-footer .btn{width:100%;text-align:center;}
        .door-preview{display:flex;flex-direction:column;gap:12px;}
        #pendenciasObrigatoriasPorta{margin-top:0!important;box-shadow:0 8px 18px rgba(185,28,28,.08)!important;}
        @media(max-width:760px){.porta-field-grid{grid-template-columns:1fr}.door-actions-footer{position:static}}
    `;
    document.head.appendChild(style);
}

function removerPivotanteDireto() {
    const select = document.getElementById('tipologia');
    if (!select) return;
    Array.from(select.options).forEach(option => {
        if (option.value === 'pivotante') option.remove();
    });
}

function organizarRodapeFormulario() {
    const form = document.querySelector('.door-form');
    const preco = document.getElementById('precoPorta');
    if (!form || !preco) return;
    const salvar = Array.from(form.querySelectorAll('button')).find(btn => String(btn.getAttribute('onclick') || '').includes('salvarPorta'));
    if (!salvar) return;
    let footer = document.getElementById('doorActionsFooter');
    if (!footer) {
        footer = document.createElement('div');
        footer.id = 'doorActionsFooter';
        footer.className = 'door-actions-footer';
        form.appendChild(footer);
    }
    if (preco.parentElement !== footer) footer.appendChild(preco);
    if (salvar.parentElement !== footer) footer.appendChild(salvar);
}

function aplicarLayoutPortas() {
    adicionarEstilosLayoutPortas();
    removerPivotanteDireto();
    organizarRodapeFormulario();
}

function instalarLayoutPortas() {
    document.addEventListener('input', () => setTimeout(aplicarLayoutPortas, 0), true);
    document.addEventListener('change', () => setTimeout(aplicarLayoutPortas, 0), true);
    setTimeout(aplicarLayoutPortas, 200);
    setTimeout(aplicarLayoutPortas, 800);
}

window.instalarLayoutPortas = instalarLayoutPortas;
window.aplicarLayoutPortas = aplicarLayoutPortas;
document.addEventListener('DOMContentLoaded', instalarLayoutPortas);
setTimeout(instalarLayoutPortas, 500);
