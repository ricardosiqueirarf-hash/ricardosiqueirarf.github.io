// Agrupa campos dinâmicos da porta em blocos visuais.

function obterIdCampoDoLabelGrupo(label) {
    return label?.querySelector?.('input, select, textarea')?.id || '';
}

function criarSecaoCampoGrupo(titulo) {
    const section = document.createElement('div');
    section.className = 'porta-field-section';
    const title = document.createElement('div');
    title.className = 'porta-field-section-title';
    title.textContent = titulo;
    const grid = document.createElement('div');
    grid.className = 'porta-field-grid';
    section.appendChild(title);
    section.appendChild(grid);
    return { section, grid };
}

function organizarCamposPortaEmGrupos() {
    const campos = document.getElementById('campos');
    if (!campos || campos.dataset.organizadoVisual === 'true') return;

    const labels = Array.from(campos.children).filter(el => el.tagName === 'LABEL');
    if (!labels.length) return;

    const grupos = [
        ['Medidas', ['largura','altura']],
        ['Materiais', ['perfil','vidro']],
        ['Ferragens e sistemas', ['dobradicas','dobradicas_posicao','dobradicas_alturas','puxador','puxador_posicao','medida_puxador','sistemas','trilhos_superior','trilhos_inferior','vao_trilhos_superior','vao_trilhos_inferior']],
        ['Valores e observações', ['valor_adicional','puxadores','acessorio','observacao_venda','observacao_producao']]
    ];

    const porId = new Map();
    labels.forEach(label => {
        const id = obterIdCampoDoLabelGrupo(label);
        if (id === 'trilho') {
            label.style.display = 'none';
            return;
        }
        if (id) porId.set(id, label);
    });

    const frag = document.createDocumentFragment();
    const usados = new Set();

    grupos.forEach(([titulo, ids]) => {
        const bloco = criarSecaoCampoGrupo(titulo);
        ids.forEach(id => {
            const label = porId.get(id);
            if (label) {
                bloco.grid.appendChild(label);
                usados.add(id);
            }
        });
        if (bloco.grid.children.length) frag.appendChild(bloco.section);
    });

    const sobra = labels.filter(label => {
        const id = obterIdCampoDoLabelGrupo(label);
        return id && id !== 'trilho' && !usados.has(id);
    });

    if (sobra.length) {
        const bloco = criarSecaoCampoGrupo('Outros campos');
        sobra.forEach(label => bloco.grid.appendChild(label));
        frag.appendChild(bloco.section);
    }

    campos.innerHTML = '';
    campos.appendChild(frag);
    campos.dataset.organizadoVisual = 'true';
}

function instalarGruposCamposPorta() {
    const original = window.renderCampos;
    if (typeof original === 'function' && !original.__fieldGroupsWrapped) {
        const wrapped = function(...args) {
            const campos = document.getElementById('campos');
            if (campos) campos.dataset.organizadoVisual = 'false';
            const resultado = original.apply(this, args);
            setTimeout(organizarCamposPortaEmGrupos, 0);
            setTimeout(organizarCamposPortaEmGrupos, 250);
            return resultado;
        };
        wrapped.__fieldGroupsWrapped = true;
        window.renderCampos = wrapped;
    }
    setTimeout(organizarCamposPortaEmGrupos, 300);
    setTimeout(organizarCamposPortaEmGrupos, 900);
}

window.organizarCamposPortaEmGrupos = organizarCamposPortaEmGrupos;
window.instalarGruposCamposPorta = instalarGruposCamposPorta;
document.addEventListener('DOMContentLoaded', instalarGruposCamposPorta);
setTimeout(instalarGruposCamposPorta, 500);
