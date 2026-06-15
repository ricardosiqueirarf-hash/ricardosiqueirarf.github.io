// Renderização compacta das portas salvas em tabela.

let carregandoSistemasParaTabela = false;
let tabelaPortasAguardandoSistemas = false;

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
        .sistema-loading{color:#6b7280;font-style:italic;}
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

function tabelaPrecisaDeSistemas() {
    return Array.isArray(portas) && portas.some(porta => {
        const tipo = porta?.tipo;
        return (tipo === 'deslizante' || tipo === 'correr') && porta?.dados?.sistemas;
    });
}

function garantirSistemasParaTabela() {
    if (!tabelaPrecisaDeSistemas()) return;
    if (typeof sistemasLista !== 'undefined' && Array.isArray(sistemasLista) && sistemasLista.length > 0) return;
    if (carregandoSistemasParaTabela) return;
    if (typeof carregarSistemas !== 'function') return;

    carregandoSistemasParaTabela = true;
    tabelaPortasAguardandoSistemas = true;

    Promise.resolve(carregarSistemas())
        .then(() => {
            carregandoSistemasParaTabela = false;
            if (tabelaPortasAguardandoSistemas) {
                tabelaPortasAguardandoSistemas = false;
                renderPortas();
            }
        })
        .catch((err) => {
            carregandoSistemasParaTabela = false;
            console.error('Erro ao carregar sistemas para tabela de portas:', err);
        });
}

function nomeSistemaTabelaPortas(id) {
    const valorSalvo = id ? String(id) : '';
    if (!valorSalvo) return '-';

    if (typeof sistemasLista !== 'undefined' && Array.isArray(sistemasLista) && sistemasLista.length > 0) {
        const sistema = sistemasLista.find(item => String(item.id) === valorSalvo);
        if (sistema?.nome) return sistema.nome;
    }

    garantirSistemasParaTabela();
    return valorSalvo ? `Carregando (${valorSalvo})` : '-';
}

function celulaTextoPortas(texto, forte = false, extraClass = '') {
    const td = document.createElement('td');
    if (extraClass) td.className = extraClass;
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
    garantirSistemasParaTabela();

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

        const sistemaTexto = (porta.tipo === 'deslizante' || porta.tipo === 'correr') ? nomeSistemaTabelaPortas(dados.sistemas) : '-';
        tr.appendChild(celulaTextoPortas(sistemaTexto, false, sistemaTexto.startsWith('Carregando') ? 'sistema-loading' : ''));

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
setTimeout(() => { if (Array.isArray(portas)) renderPortas(); }, 900);
setTimeout(() => { if (Array.isArray(portas)) renderPortas(); }, 1800);
