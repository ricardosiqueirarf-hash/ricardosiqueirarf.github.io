// Ajustes visuais do modo edição: botão Atualizar Porta e destaque da linha editada.

function adicionarEstilosModoEdicaoPortas() {
    if (document.getElementById('editModeVisualFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'editModeVisualFixStyles';
    style.textContent = `
        .porta-row-editando td {
            background: #e7f3fb !important;
            border-top: 2px solid #1079ba;
            border-bottom: 2px solid #1079ba;
        }
        .porta-row-editando td:first-child {
            border-left: 2px solid #1079ba;
        }
        .porta-row-editando td:last-child {
            border-right: 2px solid #1079ba;
        }
        .porta-editando-badge {
            display: inline-block;
            margin-left: 6px;
            padding: 2px 7px;
            border-radius: 999px;
            background: #1079ba;
            color: #fff;
            font-size: 0.72rem;
            font-weight: 900;
        }
    `;
    document.head.appendChild(style);
}

function obterBotaoSalvarPorta() {
    return Array.from(document.querySelectorAll('.door-form button, #doorActionsFooter button'))
        .find(btn => String(btn.getAttribute('onclick') || '').includes('salvarPorta'));
}

function atualizarTextoBotaoSalvarPorta() {
    const btn = obterBotaoSalvarPorta();
    if (!btn) return;
    btn.textContent = editando !== null && editando !== undefined ? 'Atualizar Porta' : 'Salvar Porta';
}

function destacarLinhaPortaEditando() {
    adicionarEstilosModoEdicaoPortas();
    const linhas = document.querySelectorAll('#portasSalvas tbody tr');
    linhas.forEach(linha => linha.classList.remove('porta-row-editando'));

    if (editando === null || editando === undefined || !Array.isArray(portas)) return;

    const index = portas.findIndex(porta => String(porta.id) === String(editando));
    if (index < 0 || !linhas[index]) return;

    linhas[index].classList.add('porta-row-editando');

    const primeiraCelula = linhas[index].querySelector('td:first-child');
    if (primeiraCelula && !primeiraCelula.querySelector('.porta-editando-badge')) {
        const badge = document.createElement('span');
        badge.className = 'porta-editando-badge';
        badge.textContent = 'editando';
        primeiraCelula.appendChild(badge);
    }
}

function atualizarVisualModoEdicaoPortas() {
    adicionarEstilosModoEdicaoPortas();
    atualizarTextoBotaoSalvarPorta();
    destacarLinhaPortaEditando();
}

function instalarVisualModoEdicaoPortas() {
    const editarOriginal = window.editarPorta;
    if (typeof editarOriginal === 'function' && !editarOriginal.__visualEditWrapped) {
        const wrapped = function(...args) {
            const resultado = editarOriginal.apply(this, args);
            setTimeout(atualizarVisualModoEdicaoPortas, 0);
            setTimeout(atualizarVisualModoEdicaoPortas, 250);
            return resultado;
        };
        wrapped.__visualEditWrapped = true;
        window.editarPorta = wrapped;
    }

    const copiarOriginal = window.copiarPorta;
    if (typeof copiarOriginal === 'function' && !copiarOriginal.__visualEditWrapped) {
        const wrapped = function(...args) {
            const resultado = copiarOriginal.apply(this, args);
            setTimeout(atualizarVisualModoEdicaoPortas, 0);
            setTimeout(atualizarVisualModoEdicaoPortas, 250);
            return resultado;
        };
        wrapped.__visualEditWrapped = true;
        window.copiarPorta = wrapped;
    }

    const salvarOriginal = window.salvarPorta;
    if (typeof salvarOriginal === 'function' && !salvarOriginal.__visualEditWrapped) {
        const wrapped = async function(...args) {
            const resultado = await salvarOriginal.apply(this, args);
            setTimeout(atualizarVisualModoEdicaoPortas, 0);
            setTimeout(atualizarVisualModoEdicaoPortas, 350);
            return resultado;
        };
        wrapped.__visualEditWrapped = true;
        window.salvarPorta = wrapped;
    }

    const renderOriginal = window.renderPortas;
    if (typeof renderOriginal === 'function' && !renderOriginal.__visualEditWrapped) {
        const wrapped = function(...args) {
            const resultado = renderOriginal.apply(this, args);
            setTimeout(atualizarVisualModoEdicaoPortas, 0);
            return resultado;
        };
        wrapped.__visualEditWrapped = true;
        window.renderPortas = wrapped;
    }

    document.addEventListener('input', atualizarVisualModoEdicaoPortas, true);
    document.addEventListener('change', atualizarVisualModoEdicaoPortas, true);

    setTimeout(atualizarVisualModoEdicaoPortas, 300);
    setTimeout(atualizarVisualModoEdicaoPortas, 900);
}

window.atualizarVisualModoEdicaoPortas = atualizarVisualModoEdicaoPortas;
window.instalarVisualModoEdicaoPortas = instalarVisualModoEdicaoPortas;

document.addEventListener('DOMContentLoaded', instalarVisualModoEdicaoPortas);
setTimeout(instalarVisualModoEdicaoPortas, 700);
setTimeout(instalarVisualModoEdicaoPortas, 1400);
