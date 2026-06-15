// =====================
// CLOSET EVIDENCE
// Nova tipologia dentro de portas.html
// Modelos: Clássico 9571 e Invisível 9577
// Preview: estrutura sem portas frontais
// =====================

(function () {
    const TIPO = 'closet_evidence';

    function n(v, min = 0) {
        const x = Number(String(v ?? '').replace(',', '.'));
        return Number.isFinite(x) ? Math.max(min, x) : min;
    }

    function m(mm) { return n(mm, 0) / 1000; }
    function moeda(v) { return `R$ ${Number(v || 0).toFixed(2)}`; }
    function mm(v) { return `${Math.round(n(v, 0)).toLocaleString('pt-BR')} mm`; }

    function tipologiaEl() { return document.getElementById('tipologia'); }
    function camposEl() { return document.getElementById('campos'); }
    function isCloset() { return tipologiaEl()?.value === TIPO; }

    function addStyles() {
        if (document.getElementById('closetEvidenceStyles')) return;
        const style = document.createElement('style');
        style.id = 'closetEvidenceStyles';
        style.textContent = `
            .ce-card{border:1px solid rgba(16,121,186,.14);background:rgba(248,251,255,.96);border-radius:14px;padding:12px;margin-bottom:12px;}
            .ce-title{margin:0 0 10px;color:#0d5d8c;font-size:.95rem;font-weight:900;}
            .ce-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
            .ce-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}
            .ce-field{display:grid;gap:6px;font-weight:800;}
            .ce-field span{font-size:.84rem;}
            .ce-field input,.ce-field select{width:100%;padding:10px 11px;border:1px solid rgba(16,121,186,.22);border-radius:12px;outline:none;background:#fff;}
            .ce-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;}
            .ce-btn{min-height:40px;padding:0 14px;border:0;border-radius:999px;cursor:pointer;font-weight:900;background:#e7f3fb;color:#0d5d8c;}
            .ce-vaos{display:grid;gap:10px;}
            .ce-vao{border:1px solid rgba(16,121,186,.12);background:#fff;border-radius:12px;padding:10px;}
            .ce-vao-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:8px;color:#6b7280;font-weight:800;}
            .ce-vao-head strong{color:#0d5d8c;}
            .ce-preview{width:100%;min-height:360px;background:linear-gradient(90deg,rgba(16,121,186,.07) 1px,transparent 1px),linear-gradient(rgba(16,121,186,.07) 1px,transparent 1px),#fbfdff;background-size:24px 24px;border:1px dashed rgba(16,121,186,.30);border-radius:18px;padding:18px;overflow:auto;}
            .ce-preview-inner{min-width:680px;display:grid;gap:12px;place-items:center;}
            .ce-measure{text-align:center;color:#6b7280;font-size:.88rem;font-weight:900;}
            .ce-closet{position:relative;width:min(100%,900px);height:330px;display:grid;grid-template-columns:var(--ce-cols);border:6px solid #2f434d;background:rgba(239,248,252,.78);box-shadow:inset 0 0 0 4px rgba(255,255,255,.45),0 18px 38px rgba(15,44,62,.14);}
            .ce-strip{position:relative;border-right:3px solid #2f434d;background:rgba(240,248,252,.62);}
            .ce-strip:last-child{border-right:0;}
            .ce-strip.lat,.ce-strip.central{background:linear-gradient(180deg,rgba(47,67,77,.30),rgba(255,255,255,.42));}
            .ce-strip.vao{background:linear-gradient(180deg,rgba(255,255,255,.82),rgba(224,239,247,.34));}
            .ce-top,.ce-bottom{position:absolute;left:0;width:100%;height:38px;z-index:4;background:rgba(214,169,85,.22);}
            .ce-top{top:0;border-bottom:5px solid #2f434d;}
            .ce-bottom{bottom:0;border-top:5px solid #2f434d;}
            .ce-label{position:absolute;left:8px;right:8px;bottom:8px;z-index:5;padding:7px 8px;color:#24343d;background:rgba(255,255,255,.86);border-radius:10px;font-size:.74rem;font-weight:950;text-align:center;}
            .ce-shelf{position:absolute;left:10%;right:10%;height:5px;background:rgba(214,169,85,.78);box-shadow:0 0 15px rgba(214,169,85,.42);}
            .ce-shelf.one{top:32%;}.ce-shelf.two{top:58%;}
            .ce-lines{display:grid;gap:4px;margin-top:6px;color:#6b7280;font-size:.84rem;font-weight:800;}
            @media(max-width:760px){.ce-grid-2,.ce-grid-3{grid-template-columns:1fr}.ce-preview-inner{min-width:560px}}
        `;
        document.head.appendChild(style);
    }

    function addTipologia() {
        const select = tipologiaEl();
        if (!select) return;
        if (!Array.from(select.options).some(o => o.value === TIPO)) {
            const opt = document.createElement('option');
            opt.value = TIPO;
            opt.textContent = 'Closet Evidence';
            select.appendChild(opt);
        }
        try {
            if (typeof TIPOLOGIAS !== 'undefined' && !TIPOLOGIAS[TIPO]) {
                TIPOLOGIAS[TIPO] = ['closet_modelo','closet_vaos_json','valor_adicional','observacao_venda','observacao_producao'];
            }
        } catch (_) {}
    }

    function perfilPorCodigo(codigo) {
        const lista = Array.isArray(todosPerfis) ? todosPerfis : [];
        const alvo = String(codigo).toUpperCase();
        return lista.find(p => [p.nome, p.codigo, p.descricao, p.referencia, p.sku]
            .filter(Boolean).some(v => String(v).toUpperCase().includes(alvo))) || null;
    }

    function precoPerfil(codigo) {
        const p = perfilPorCodigo(codigo);
        if (!p) return 0;
        for (const k of ['preco_ml','precoMetroLinear','preco_metro_linear','valor_ml','valor_metro_linear','preco','valor','price']) {
            const val = Number(String(p[k] ?? '').replace(',', '.'));
            if (Number.isFinite(val) && val > 0) return val;
        }
        return 0;
    }

    function insumoPorTexto(textos) {
        const lista = Array.isArray(todosInsumos) ? todosInsumos : [];
        const alvos = textos.map(t => String(t).toUpperCase());
        return lista.find(i => {
            const base = [i.nome, i.descricao, i.categoria].filter(Boolean).join(' ').toUpperCase();
            return alvos.some(a => base.includes(a));
        }) || null;
    }

    function precoInsumo(textos) {
        const i = insumoPorTexto(textos);
        if (!i) return 0;
        for (const k of ['preco_unitario','valor_unitario','preco','valor','price']) {
            const val = Number(String(i[k] ?? '').replace(',', '.'));
            if (Number.isFinite(val) && val > 0) return val;
        }
        return 0;
    }

    function lerVaos() {
        const rows = Array.from(document.querySelectorAll('.ce-vao'));
        if (rows.length) {
            return rows.map((row, i) => ({
                largura: n(row.querySelector(`[data-ce-largura='${i}']`)?.value, 1),
                altura: n(row.querySelector(`[data-ce-altura='${i}']`)?.value, 1),
                profundidade: n(row.querySelector(`[data-ce-profundidade='${i}']`)?.value, 1)
            }));
        }
        const hidden = document.getElementById('closet_vaos_json');
        try { return JSON.parse(hidden?.value || '[]') || []; } catch { return []; }
    }

    function salvarVaos(vaos) {
        const hidden = document.getElementById('closet_vaos_json');
        if (hidden) hidden.value = JSON.stringify(vaos || []);
    }

    function renderVaos(vaos) {
        const wrap = document.getElementById('closetVaosWrap');
        if (!wrap) return;
        wrap.innerHTML = '';
        vaos.forEach((vao, i) => {
            const row = document.createElement('div');
            row.className = 'ce-vao';
            row.innerHTML = `
                <div class='ce-vao-head'><strong>Vão ${i + 1}</strong><span>Preview sem portas frontais</span></div>
                <div class='ce-grid-3'>
                    <label class='ce-field'><span>Largura (mm)</span><input data-ce-largura='${i}' type='number' min='1' step='10' value='${n(vao.largura,700)}'></label>
                    <label class='ce-field'><span>Altura (mm)</span><input data-ce-altura='${i}' type='number' min='1' step='10' value='${n(vao.altura,2400)}'></label>
                    <label class='ce-field'><span>Profundidade (mm)</span><input data-ce-profundidade='${i}' type='number' min='1' step='10' value='${n(vao.profundidade,600)}'></label>
                </div>`;
            wrap.appendChild(row);
        });
        wrap.querySelectorAll('input').forEach(inp => inp.addEventListener('input', atualizarCloset));
        salvarVaos(lerVaos());
    }

    function ajustarQtdVaos() {
        const qtd = n(document.getElementById('closet_qtd_vaos')?.value, 1);
        const atuais = lerVaos();
        const largura = n(document.getElementById('closet_largura_padrao')?.value, 700);
        const altura = n(document.getElementById('closet_altura_padrao')?.value, 2400);
        const profundidade = n(document.getElementById('closet_profundidade_padrao')?.value, 600);
        const vaos = [];
        for (let i = 0; i < qtd; i++) vaos.push(atuais[i] || { largura, altura, profundidade });
        renderVaos(vaos);
        atualizarCloset();
    }

    function calcularCloset() {
        const modelo = document.getElementById('closet_modelo')?.value || '9571';
        const perfilLateral = modelo === '9577' ? '9577' : '9571';
        const nomeModelo = modelo === '9577' ? 'Invisível' : 'Clássico';
        const vaos = lerVaos();
        const qtd = n(document.getElementById('quantidade')?.value, 1);
        const adicional = n(document.getElementById('valor_adicional')?.value, 0);
        const ml = {};
        const acessorios = { 'Conector 95P':0, 'Conector 115P':0, 'Conector 55P':0, 'Conector 120P':0, 'Baguete BA11/BA17':0 };
        const add = (codigo, metros) => { ml[codigo] = (ml[codigo] || 0) + n(metros, 0); };

        const larguraTotal = vaos.reduce((s,v) => s + n(v.largura,0), 0);
        const alturaMax = vaos.reduce((mx,v) => Math.max(mx, n(v.altura,0)), 0);
        const profMax = vaos.reduce((mx,v) => Math.max(mx, n(v.profundidade,0)), 0);

        vaos.forEach((vao, i) => {
            const largura = n(vao.largura,0), altura = n(vao.altura,0), prof = n(vao.profundidade,0);
            if (i === 0) {
                add(perfilLateral, m(altura * 2));
                add('9573', m(prof * 2));
                acessorios['Conector 95P'] += 4; acessorios['Conector 115P'] += 2; acessorios['Baguete BA11/BA17'] += 4;
            }
            if (i > 0) {
                add('9572', m(altura * 2));
                add('9573', m(prof * 2));
                acessorios['Conector 95P'] += 4; acessorios['Conector 115P'] += 2; acessorios['Baguete BA11/BA17'] += 4;
            }
            add('9573', m(largura * 2));
            if (i === vaos.length - 1) {
                add(perfilLateral, m(altura * 2));
                add('9573', m(prof * 2));
                acessorios['Conector 95P'] += 4; acessorios['Conector 115P'] += 2; acessorios['Baguete BA11/BA17'] += 4;
            }
        });

        add('9566', m((profMax * 4) + (larguraTotal * 2)));
        add('9567', m(larguraTotal * 2));
        acessorios['Conector 55P'] += 8;
        acessorios['Conector 120P'] += Math.max(4, vaos.length * 4);

        const perfis = Object.entries(ml).map(([codigo, metros]) => ({ codigo, metros, preco: precoPerfil(codigo), total: metros * precoPerfil(codigo) }));
        const insumos = Object.entries(acessorios).map(([nome, qt]) => {
            const busca = nome === 'Baguete BA11/BA17' ? ['BA11','BA17','BAGUETE'] : [nome];
            const preco = precoInsumo(busca);
            return { nome, qt, preco, total: qt * preco };
        });
        const subtotalPerfis = perfis.reduce((s,i) => s + i.total, 0);
        const subtotalInsumos = insumos.reduce((s,i) => s + i.total, 0);
        const unitario = subtotalPerfis + subtotalInsumos + adicional;
        return { modelo, nomeModelo, perfilLateral, vaos, larguraTotal, alturaMax, profMax, qtd, adicional, ml, acessorios, perfis, insumos, subtotalPerfis, subtotalInsumos, unitario, total: unitario * qtd };
    }

    function previewCloset(calc) {
        const svg = document.getElementById('portaSVG');
        if (!svg) return;
        const cols = [];
        const strips = [];
        calc.vaos.forEach((vao, i) => {
            if (i === 0) { cols.push('54px'); strips.push(`<div class='ce-strip lat'><div class='ce-label'>Lat. Esq<br>${calc.perfilLateral}</div></div>`); }
            if (i > 0) { cols.push('42px'); strips.push(`<div class='ce-strip central'><div class='ce-label'>Central<br>9572</div></div>`); }
            cols.push(`${Math.max(n(vao.largura,180),180)}fr`);
            strips.push(`<div class='ce-strip vao'><span class='ce-shelf one'></span><span class='ce-shelf two'></span><div class='ce-label'>Vão ${i+1}<br>${mm(vao.largura)} × ${mm(vao.altura)}<br>Prof. ${mm(vao.profundidade)}</div></div>`);
            if (i === calc.vaos.length - 1) { cols.push('54px'); strips.push(`<div class='ce-strip lat'><div class='ce-label'>Lat. Dir<br>${calc.perfilLateral}</div></div>`); }
        });
        const holder = document.createElement('div');
        holder.className = 'ce-preview';
        holder.innerHTML = `<div class='ce-preview-inner'>
            <div class='ce-measure'>Closet Evidence ${calc.nomeModelo} · estrutura sem portas frontais</div>
            <div class='ce-measure'>${calc.vaos.length} vãos · ${mm(calc.larguraTotal)} × ${mm(calc.alturaMax)} × ${mm(calc.profMax)}</div>
            <div class='ce-closet' style='--ce-cols:${cols.join(' ')}'>${strips.join('')}<div class='ce-top'><div class='ce-label'>Topo · 9566 + 9567</div></div><div class='ce-bottom'><div class='ce-label'>Base · 9566 + 9567</div></div></div>
            <div class='ce-measure'>Laterais ${calc.perfilLateral} · Central 9572 · Travessas 9573 · Topo/Base 9566 + 9567</div>
        </div>`;
        svg.replaceWith(holder);
        holder.id = 'portaSVG';
    }

    function atualizarCloset() {
        if (!isCloset()) return;
        salvarVaos(lerVaos());
        const calc = calcularCloset();
        previewCloset(calc);
        const preco = document.getElementById('precoPorta');
        if (preco) preco.innerHTML = `<strong>${moeda(calc.total)}</strong><div class='ce-lines'><span>Unitário estrutura: ${moeda(calc.unitario)}</span><span>Perfis: ${moeda(calc.subtotalPerfis)} · Insumos: ${moeda(calc.subtotalInsumos)} · Adicional: ${moeda(calc.adicional)}</span><span>${calc.vaos.length} vãos · ${calc.vaos.length * 2} portas previstas, sem portas no preview</span></div>`;
        if (typeof renderizarPendenciasObrigatoriasPorta === 'function') renderizarPendenciasObrigatoriasPorta();
    }

    function renderClosetCampos(dados = null) {
        addStyles();
        const campos = camposEl();
        if (!campos) return;
        const vaosSalvos = dados?.closet_vaos_json ? JSON.parse(dados.closet_vaos_json || '[]') : [{largura:700, altura:2400, profundidade:600}];
        campos.innerHTML = `<div class='ce-card'><h3 class='ce-title'>Closet Evidence</h3><div class='ce-grid-2'>
            <label class='ce-field'><span>Modelo</span><select id='closet_modelo'><option value='9571'>Clássico (9571)</option><option value='9577'>Invisível (9577)</option></select></label>
            <label class='ce-field'><span>Quantidade de vãos</span><input id='closet_qtd_vaos' type='number' min='1' step='1' value='${vaosSalvos.length || 1}'></label>
        </div></div>
        <div class='ce-card'><h3 class='ce-title'>Padrões para novos vãos</h3><div class='ce-grid-3'>
            <label class='ce-field'><span>Largura padrão</span><input id='closet_largura_padrao' type='number' min='1' step='10' value='700'></label>
            <label class='ce-field'><span>Altura padrão</span><input id='closet_altura_padrao' type='number' min='1' step='10' value='2400'></label>
            <label class='ce-field'><span>Profundidade padrão</span><input id='closet_profundidade_padrao' type='number' min='1' step='10' value='600'></label>
        </div><div class='ce-actions'><button type='button' class='ce-btn' id='closet_sync'>Sincronizar vãos</button></div></div>
        <div class='ce-card'><h3 class='ce-title'>Editar vãos</h3><input type='hidden' id='closet_vaos_json'><div id='closetVaosWrap' class='ce-vaos'></div></div>
        <div class='ce-card'><h3 class='ce-title'>Valores e observações</h3><div class='ce-grid-2'>
            <label class='ce-field'><span>Valor adicional</span><input id='valor_adicional' type='number' min='0' step='0.01' value='${dados?.valor_adicional || 0}'></label>
            <label class='ce-field'><span>Observação de venda</span><input id='observacao_venda' type='text' value='${dados?.observacao_venda || ''}'></label>
            <label class='ce-field' style='grid-column:1/-1'><span>Observação de produção</span><input id='observacao_producao' type='text' value='${dados?.observacao_producao || ''}'></label>
        </div></div>`;
        document.getElementById('closet_modelo').value = dados?.closet_modelo || '9571';
        renderVaos(vaosSalvos.length ? vaosSalvos : [{largura:700, altura:2400, profundidade:600}]);
        ['closet_modelo','closet_qtd_vaos','closet_largura_padrao','closet_altura_padrao','closet_profundidade_padrao','valor_adicional'].forEach(id => document.getElementById(id)?.addEventListener('input', atualizarCloset));
        document.getElementById('closet_modelo')?.addEventListener('change', atualizarCloset);
        document.getElementById('closet_sync')?.addEventListener('click', ajustarQtdVaos);
        document.getElementById('closet_qtd_vaos')?.addEventListener('change', ajustarQtdVaos);
        atualizarCloset();
    }

    function dadosCloset() {
        salvarVaos(lerVaos());
        const calc = calcularCloset();
        return {
            closet_modelo: calc.modelo,
            closet_nome_modelo: calc.nomeModelo,
            closet_vaos_json: JSON.stringify(calc.vaos),
            closet_perfil_lateral: calc.perfilLateral,
            largura: String(calc.larguraTotal),
            altura: String(calc.alturaMax),
            profundidade: String(calc.profMax),
            valor_adicional: String(calc.adicional),
            observacao_venda: document.getElementById('observacao_venda')?.value || '',
            observacao_producao: document.getElementById('observacao_producao')?.value || '',
            closet_ml_json: JSON.stringify(calc.ml),
            closet_acessorios_json: JSON.stringify(calc.acessorios)
        };
    }

    async function salvarCloset() {
        const calc = calcularCloset();
        if (!calc.vaos.length) return alert('Adicione pelo menos 1 vão');
        if (calc.vaos.some(v => !n(v.largura,0) || !n(v.altura,0) || !n(v.profundidade,0))) return alert('Preencha largura, altura e profundidade dos vãos');
        const porta = { id: editando ?? idCounter++, tipo: TIPO, dados: dadosCloset(), quantidade: calc.qtd, m2: 0, metro_linear: Number(Object.values(calc.ml).reduce((s,x)=>s+x,0).toFixed(4)), tag_aplicada: null, preco: Number(calc.total.toFixed(2)), svg: '' };
        const next = editando === null ? [...portas, porta] : portas.map(p => p.id === editando ? porta : p);
        const comUuid = next.map(p => ({...p, orcamento_uuid: ORCAMENTO_UUID}));
        try {
            await salvarPortasBackend(comUuid);
            portas = next;
            editando = null;
            alert('Closet Evidence salvo com sucesso!');
            renderPortas();
            renderClosetCampos();
            if (typeof atualizarVisualModoEdicaoPortas === 'function') atualizarVisualModoEdicaoPortas();
        } catch (err) {
            console.error(err);
            alert('Erro ao salvar Closet Evidence: ' + err.message);
        }
    }

    function instalarClosetEvidence() {
        addTipologia();
        const originalRender = window.renderCampos;
        if (typeof originalRender === 'function' && !originalRender.__ce) {
            window.renderCampos = function(...args) {
                addTipologia();
                if (isCloset()) return renderClosetCampos();
                return originalRender.apply(this, args);
            };
            window.renderCampos.__ce = true;
        }
        const originalSalvar = window.salvarPorta;
        if (typeof originalSalvar === 'function' && !originalSalvar.__ce) {
            window.salvarPorta = function(...args) { return isCloset() ? salvarCloset() : originalSalvar.apply(this,args); };
            window.salvarPorta.__ce = true;
        }
        const originalEditar = window.editarPorta;
        if (typeof originalEditar === 'function' && !originalEditar.__ce) {
            window.editarPorta = function(id) {
                const porta = portas.find(p => p.id === id);
                if (porta?.tipo === TIPO) {
                    editando = id;
                    tipologiaEl().value = TIPO;
                    document.getElementById('quantidade').value = porta.quantidade || 1;
                    renderClosetCampos(porta.dados || {});
                    if (typeof atualizarVisualModoEdicaoPortas === 'function') atualizarVisualModoEdicaoPortas();
                    return;
                }
                return originalEditar.call(this, id);
            };
            window.editarPorta.__ce = true;
        }
        const originalCopiar = window.copiarPorta;
        if (typeof originalCopiar === 'function' && !originalCopiar.__ce) {
            window.copiarPorta = function(id) {
                const porta = portas.find(p => p.id === id);
                if (porta?.tipo === TIPO) {
                    editando = null;
                    tipologiaEl().value = TIPO;
                    document.getElementById('quantidade').value = porta.quantidade || 1;
                    renderClosetCampos(porta.dados || {});
                    if (typeof atualizarVisualModoEdicaoPortas === 'function') atualizarVisualModoEdicaoPortas();
                    return;
                }
                return originalCopiar.call(this, id);
            };
            window.copiarPorta.__ce = true;
        }
        document.addEventListener('change', ev => { if (ev.target?.id === 'tipologia' && isCloset()) renderClosetCampos(); }, true);
    }

    window.calcularClosetEvidence = calcularCloset;
    window.atualizarClosetEvidence = atualizarCloset;
    window.renderClosetEvidenceCampos = renderClosetCampos;
    window.instalarClosetEvidence = instalarClosetEvidence;

    document.addEventListener('DOMContentLoaded', instalarClosetEvidence);
    setTimeout(instalarClosetEvidence, 600);
    setTimeout(instalarClosetEvidence, 1500);
})();
