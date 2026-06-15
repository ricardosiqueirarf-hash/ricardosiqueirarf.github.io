// Fix final das caixas de altura das dobradiças em portas de giro.
// Garante que o container exista mesmo após renderizações/reorganizações visuais.

function dfNumeroMm(id) {
    const valor = document.getElementById(id)?.value;
    const numero = Number(String(valor ?? '').replace(',', '.'));
    return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function dfCalcularAlturas(alturaMm, qtd) {
    const quantidade = Math.max(1, Math.round(Number(qtd) || 1));
    const margem = Math.min(100, Math.max(0, alturaMm / 2));
    const inicio = alturaMm > 0 ? margem : '';
    const fim = alturaMm > 0 ? Math.max(margem, alturaMm - margem) : '';

    if (!alturaMm || alturaMm <= 0) return Array.from({ length: quantidade }, () => '');
    if (quantidade === 1) return [Math.round(inicio)];
    if (quantidade === 2) return [Math.round(inicio), Math.round(fim)];

    const passo = (fim - inicio) / (quantidade - 1);
    return Array.from({ length: quantidade }, (_, i) => Math.round(inicio + passo * i));
}

function dfCriarBlocoAlturas() {
    let container = document.getElementById('dobradicasContainer');
    if (container) return container;

    const dobradicasInput = document.getElementById('dobradicas');
    if (!dobradicasInput) return null;

    const label = document.createElement('label');
    label.id = 'dobradicasAlturasLabelFinal';
    label.innerHTML = 'Alturas das dobradiças';

    container = document.createElement('div');
    container.id = 'dobradicasContainer';
    container.className = 'helper-text';
    container.style.display = 'grid';
    container.style.gap = '8px';
    container.style.marginTop = '6px';

    label.appendChild(container);

    const fieldSection = dobradicasInput.closest('.porta-field-section');
    const grid = fieldSection?.querySelector('.porta-field-grid');
    const parentLabel = dobradicasInput.closest('label');

    if (grid) {
        if (parentLabel && parentLabel.nextSibling) {
            grid.insertBefore(label, parentLabel.nextSibling);
        } else {
            grid.appendChild(label);
        }
    } else if (parentLabel?.parentElement) {
        parentLabel.insertAdjacentElement('afterend', label);
    } else {
        document.getElementById('campos')?.appendChild(label);
    }

    return container;
}

function dfCriarInputAltura(valor, index) {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.placeholder = `Altura da dobradiça ${index + 1} (mm)`;
    input.className = 'dobradica-altura';
    input.value = valor !== undefined && valor !== null ? String(valor) : '';
    input.style.width = '100%';
    input.style.padding = '10px 11px';
    input.style.border = '1px solid rgba(16,121,186,.22)';
    input.style.borderRadius = '12px';
    input.style.background = '#fff';
    input.addEventListener('input', () => {
        if (typeof desenharPorta === 'function') desenharPorta();
        if (typeof atualizarCamposObrigatorios === 'function') atualizarCamposObrigatorios();
        if (typeof renderizarPendenciasObrigatoriasPorta === 'function') renderizarPendenciasObrigatoriasPorta();
    });
    return input;
}

function dfMostrarHint(container, texto) {
    const hint = document.createElement('div');
    hint.id = 'dobradicas_auto_hint';
    hint.style.fontSize = '0.78rem';
    hint.style.marginTop = '2px';
    hint.style.color = '#0d5d8c';
    hint.style.fontWeight = '800';
    hint.textContent = texto;
    container.appendChild(hint);
}

function atualizarDobradicasInputs(auto = true) {
    const tipo = document.getElementById('tipologia')?.value;
    if (tipo !== 'giro') return;

    const qtdInput = document.getElementById('dobradicas');
    if (!qtdInput) return;

    const container = dfCriarBlocoAlturas();
    if (!container) return;

    const bruto = String(qtdInput.value ?? '').trim();

    if (bruto === '') {
        container.innerHTML = '';
        dfMostrarHint(container, 'Defina a quantidade para gerar as posições automaticamente.');
        return;
    }

    let qtd = parseInt(bruto, 10);
    if (!Number.isFinite(qtd) || qtd < 0) qtd = 0;

    if (qtd === 0) {
        qtd = 2;
        qtdInput.value = '2';
    }

    const atuais = Array.from(container.querySelectorAll('.dobradica-altura')).map(input => input.value);
    const altura = dfNumeroMm('altura');
    const padrao = dfCalcularAlturas(altura, qtd);

    container.innerHTML = '';

    for (let i = 0; i < qtd; i++) {
        const valor = auto ? padrao[i] : (atuais[i] ?? padrao[i]);
        container.appendChild(dfCriarInputAltura(valor, i));
    }

    dfMostrarHint(container, `Padrão automático: ${padrao.join(' / ')} mm`);

    if (typeof desenharPorta === 'function') desenharPorta();
    if (typeof atualizarCamposObrigatorios === 'function') atualizarCamposObrigatorios();
    if (typeof renderizarPendenciasObrigatoriasPorta === 'function') renderizarPendenciasObrigatoriasPorta();
}

function aplicarDobradicasPadrao() {
    if (document.getElementById('tipologia')?.value !== 'giro') return;
    const qtdInput = document.getElementById('dobradicas');
    if (!qtdInput) return;

    const bruto = String(qtdInput.value ?? '').trim();
    if (bruto === '') {
        atualizarDobradicasInputs(true);
        return;
    }

    if (Number(bruto) === 0) qtdInput.value = '2';
    atualizarDobradicasInputs(true);
}

function obterAlturasDobradicas() {
    return Array.from(document.querySelectorAll('.dobradica-altura'))
        .map(input => input.value)
        .filter(Boolean);
}

function instalarDobradicasFinalFix() {
    const originalRender = window.renderCampos;
    if (typeof originalRender === 'function' && !originalRender.__dobradicasFinalFix) {
        const wrapped = function(...args) {
            const result = originalRender.apply(this, args);
            setTimeout(aplicarDobradicasPadrao, 0);
            setTimeout(aplicarDobradicasPadrao, 120);
            setTimeout(aplicarDobradicasPadrao, 400);
            return result;
        };
        wrapped.__dobradicasFinalFix = true;
        window.renderCampos = wrapped;
    }

    document.addEventListener('input', (ev) => {
        if (ev.target?.id === 'dobradicas' || ev.target?.id === 'altura') {
            setTimeout(() => atualizarDobradicasInputs(true), 0);
        }
    }, true);

    document.addEventListener('change', (ev) => {
        if (['tipologia', 'dobradicas', 'altura'].includes(ev.target?.id)) {
            setTimeout(aplicarDobradicasPadrao, 0);
            setTimeout(aplicarDobradicasPadrao, 180);
        }
    }, true);

    const observer = new MutationObserver(() => {
        if (document.getElementById('tipologia')?.value === 'giro' && document.getElementById('dobradicas')) {
            const container = document.getElementById('dobradicasContainer');
            const qtd = parseInt(document.getElementById('dobradicas')?.value || '0', 10) || 0;
            const caixas = document.querySelectorAll('.dobradica-altura').length;
            if (!container || (qtd > 0 && caixas === 0)) {
                setTimeout(aplicarDobradicasPadrao, 0);
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(aplicarDobradicasPadrao, 300);
    setTimeout(aplicarDobradicasPadrao, 900);
    setTimeout(aplicarDobradicasPadrao, 1600);
}

window.atualizarDobradicasInputs = atualizarDobradicasInputs;
window.aplicarDobradicasPadrao = aplicarDobradicasPadrao;
window.obterAlturasDobradicas = obterAlturasDobradicas;
window.instalarDobradicasFinalFix = instalarDobradicasFinalFix;

document.addEventListener('DOMContentLoaded', instalarDobradicasFinalFix);
setTimeout(instalarDobradicasFinalFix, 800);
