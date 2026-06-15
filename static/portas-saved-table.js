// Renderização compacta das portas salvas em tabela.

function adicionarEstilosTabelaPortas() {
    if (document.getElementById('portasSavedTableStyles')) return;
    const style = document.createElement('style');
    style.id = 'portasSavedTableStyles';
    style.textContent = `
        .portas-table-wrap{width:100%;overflow-x:auto;}
        .portas-table{width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;border:1px solid rgba(16,121,186,.14);box-shadow:0 10px 20px rgba(15,44,62,.08);}
        .portas-table th,.portas-table td{padding:10px;border-bottom:1px solid rgba(16,121,186,.10);text-align:left;vertical-align:middle;font-size:.9rem;}
        .portas-table th{background:#e7f3fb;color:#0d5d8c;font-weight:900;}
        .portas-table tr:hover td{background:#f8fbff;}
        .portas-table-actions{display:flex;gap:6px;flex-wrap:wrap;}
        .portas-table-actions .btn{padding:8px 10px;font-size:.78rem;box-shadow:none;border-radius:10px;}
        .portas-empty-state{border:1px dashed rgba(16,121,186,.24);color:#6b7280;background:rgba(248,251,255,.86);border-radius:14px;padding:14px;font-weight:700;}
    `;
    document.head.appendChild(style);
}

function moedaTabelaPortas(valor) {
    if (typeof formatarMoeda === 'function') return formatarMoeda(Number(valor || 0));
    return `R$ ${Number(valor || 0).toFixed(2)}`;
}

function nomePerfilTabelaPortas(id) {
    return todosPerfis.find(perfil => String(perfil.id) === String(id))?.nome || '-';
}

function nomeVidroTabelaPortas(id) {
    const vidro = todosVidros.find(item => String(item.id) === String(id));
    if (!vidro) return '-';
    return [vidro.tipo, vidro.espessura ? `${vidro.espessura}mm` : ''].filter(Boolean).join(' ');
}

function nomeSistemaTabelaPortas(id) {
    if (typeof sistemasLista === 'undefined' || !Array.isArray(sistemasLista)) return '-';
    return sistemasLista.find(sistema => String(sistema.id) === String(id))?.nome || '-';
}

function celulaTextoPortas(texto, forte = false) {
    const td = document.createElement('td');
    if (forte) {
        const strong = document.createElement('strong');
        strong.textContent = texto;
        td.appendChild(strong);
    } else {
        td.textContent = texto;
    }
    return td;
}

function botaoTabelaPortas(texto, classe, acao) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = classe;
    btn.textContent = texto;
    btn.addEventListener('click', acao);
    return btn;
}

function renderPortas() {
    adicionarEstilosTabelaPortas();
    const container = document.getElementById('portasSalvas');
    if (!container) return;
    container.textContent = '';

    if (!Array.isArray(portas) || portas.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'portas-empty-state';
        empty.textContent = 'Nenhuma porta salva neste orçamento.';
        container.appendChild(empty);
        if (typeof atualizarResumoImpressao === 'function') atualizarResumoImpressao();
        if (typeof atualizarResumoOrdem === 'function') atualizarResumoOrdem();
        return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'portas-table-wrap';
    const table = document.createElement('table');
    table.className = 'portas-table';
    const thead = document.createElement('thead');
    const header = document.createElement('tr');
    ['#','Tipo','Qtd','Medida','Perfil','Vidro','Sistema','Preço','Ações'].forEach(txt => {
        const th = document.createElement('th');
        th.textContent = txt;
        header.appendChild(th);
    });
    thead.appendChild(header);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    portas.forEach((porta, index) => {
        const dados = porta.dados || {};
        const medida = `${dados.largura || '-'} × ${dados.altura || '-'} mm`;
        const tr = document.createElement('tr');
        tr.appendChild(celulaTextoPortas(String(index + 1), true));
        tr.appendChild(celulaTextoPortas(porta.tipo || '-'));
        tr.appendChild(celulaTextoPortas(String(porta.quantidade || '-')));
        tr.appendChild(celulaTextoPortas(medida));
        tr.appendChild(celulaTextoPortas(nomePerfilTabelaPortas(dados.perfil)));
        tr.appendChild(celulaTextoPortas(nomeVidroTabelaPortas(dados.vidro)));
        tr.appendChild(celulaTextoPortas((porta.tipo === 'deslizante' || porta.tipo === 'correr') ? nomeSistemaTabelaPortas(dados.sistemas) : '-'));
        tr.appendChild(celulaTextoPortas(moedaTabelaPortas(porta.preco), true));

        const tdAcoes = document.createElement('td');
        const acoes = document.createElement('div');
        acoes.className = 'portas-table-actions';
        acoes.appendChild(botaoTabelaPortas('Copiar', 'btn', () => copiarPorta(porta.id)));
        acoes.appendChild(botaoTabelaPortas('Editar', 'btn', () => editarPorta(porta.id)));
        acoes.appendChild(botaoTabelaPortas('Apagar', 'btn btn-danger', () => apagarPorta(porta.id)));
        tdAcoes.appendChild(acoes);
        tr.appendChild(tdAcoes);
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);

    if (typeof atualizarResumoImpressao === 'function') atualizarResumoImpressao();
    if (typeof atualizarResumoOrdem === 'function') atualizarResumoOrdem();
}

window.renderPortas = renderPortas;
setTimeout(() => { if (Array.isArray(window.portas)) renderPortas(); }, 900);
