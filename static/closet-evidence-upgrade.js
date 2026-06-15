// Upgrade do Closet Evidence: busca estrutural por número + preview 3D sem portas.

(function () {
    const TIPO = 'closet_evidence';

    function num(v, min = 0) {
        const x = Number(String(v ?? '').replace(',', '.'));
        return Number.isFinite(x) ? Math.max(min, x) : min;
    }

    function metro(mm) { return num(mm, 0) / 1000; }
    function moeda(v) { return `R$ ${Number(v || 0).toFixed(2)}`; }
    function mm(v) { return `${Math.round(num(v, 0)).toLocaleString('pt-BR')} mm`; }
    function isCloset() { return document.getElementById('tipologia')?.value === TIPO; }

    function textoPerfil(perfil) {
        return [perfil?.nome, perfil?.codigo, perfil?.descricao, perfil?.referencia, perfil?.sku, perfil?.classe, perfil?.categoria, perfil?.tipo]
            .filter(Boolean).join(' ').toUpperCase();
    }

    function scorePerfilEstrutural(perfil, codigo) {
        const texto = textoPerfil(perfil);
        const code = String(codigo).toUpperCase();
        if (!texto.includes(code)) return -999;
        let score = 0;
        if (String(perfil?.codigo || '').toUpperCase() === code) score += 80;
        if (String(perfil?.referencia || '').toUpperCase() === code) score += 60;
        if (String(perfil?.nome || '').toUpperCase().includes(code)) score += 40;
        if (/ESTRUTURAL|ESTRUTURA|CLOSET|EVIDENCE/.test(texto)) score += 100;
        if (/PUXADOR|PORTA|TRILHO|ROLDANA|DOBRADI/.test(texto)) score -= 50;
        return score;
    }

    function buscarPerfilEstrutural(codigo) {
        const lista = Array.isArray(todosPerfis) ? todosPerfis : [];
        return lista
            .map(perfil => ({ perfil, score: scorePerfilEstrutural(perfil, codigo) }))
            .filter(item => item.score >= 0)
            .sort((a, b) => b.score - a.score)[0]?.perfil || null;
    }

    function precoPerfilEstrutural(codigo) {
        const perfil = buscarPerfilEstrutural(codigo);
        if (!perfil) return 0;
        for (const k of ['preco_ml','precoMetroLinear','preco_metro_linear','valor_ml','valor_metro_linear','preco','valor','price']) {
            const v = Number(String(perfil[k] ?? '').replace(',', '.'));
            if (Number.isFinite(v) && v > 0) return v;
        }
        return 0;
    }

    function nomePerfilEstrutural(codigo) {
        return buscarPerfilEstrutural(codigo)?.nome || String(codigo);
    }

    function buscarInsumo(textos) {
        const lista = Array.isArray(todosInsumos) ? todosInsumos : [];
        const alvos = textos.map(t => String(t).toUpperCase());
        return lista.find(i => {
            const base = [i.nome, i.descricao, i.categoria, i.tipo].filter(Boolean).join(' ').toUpperCase();
            return alvos.some(a => base.includes(a));
        }) || null;
    }

    function precoInsumo(textos) {
        const insumo = buscarInsumo(textos);
        if (!insumo) return 0;
        for (const k of ['preco_unitario','valor_unitario','preco','valor','price']) {
            const v = Number(String(insumo[k] ?? '').replace(',', '.'));
            if (Number.isFinite(v) && v > 0) return v;
        }
        return 0;
    }

    function garantirSvgQuandoNaoCloset() {
        const atual = document.getElementById('portaSVG');
        if (!atual || isCloset()) return;
        if (atual.tagName && atual.tagName.toLowerCase() === 'svg') return;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'portaSVG';
        atual.replaceWith(svg);
    }

    function addStyles3D() {
        if (document.getElementById('closetEvidenceUpgradeStyles')) return;
        const style = document.createElement('style');
        style.id = 'closetEvidenceUpgradeStyles';
        style.textContent = `
            .ce3d-stage{width:100%;min-height:420px;padding:24px;overflow:auto;background:radial-gradient(circle at top left,rgba(16,121,186,.14),transparent 38%),linear-gradient(135deg,#f8fbff,#eef6fb);border:1px dashed rgba(16,121,186,.30);border-radius:18px;perspective:1100px;}
            .ce3d-wrap{min-width:720px;display:grid;gap:14px;place-items:center;}
            .ce3d-title{text-align:center;color:#0d5d8c;font-weight:950;}
            .ce3d-measure{text-align:center;color:#6b7280;font-size:.86rem;font-weight:900;}
            .ce3d-scene{position:relative;width:min(900px,95%);height:360px;transform-style:preserve-3d;transform:rotateX(-10deg) rotateY(-24deg);}
            .ce3d-box{position:absolute;left:8%;right:8%;top:8%;bottom:8%;transform-style:preserve-3d;}
            .ce3d-back{position:absolute;inset:0;background:linear-gradient(180deg,rgba(236,248,253,.92),rgba(210,228,238,.90));border:6px solid #2f434d;box-shadow:inset 0 0 0 4px rgba(255,255,255,.45);transform:translateZ(-95px);}
            .ce3d-left,.ce3d-right{position:absolute;top:0;bottom:0;width:70px;background:linear-gradient(90deg,rgba(47,67,77,.46),rgba(255,255,255,.38));border:5px solid #2f434d;transform-style:preserve-3d;}
            .ce3d-left{left:-70px;transform:rotateY(90deg);transform-origin:right center;}
            .ce3d-right{right:-70px;transform:rotateY(-90deg);transform-origin:left center;}
            .ce3d-top,.ce3d-bottom{position:absolute;left:0;right:0;height:48px;background:linear-gradient(180deg,rgba(214,169,85,.42),rgba(255,255,255,.25));border:5px solid #2f434d;transform-style:preserve-3d;}
            .ce3d-top{top:-48px;transform:rotateX(-90deg);transform-origin:bottom center;}
            .ce3d-bottom{bottom:-48px;transform:rotateX(90deg);transform-origin:top center;}
            .ce3d-front-frame{position:absolute;inset:0;display:grid;grid-template-columns:var(--ce3d-cols);border:6px solid #2f434d;background:rgba(240,248,252,.18);box-shadow:0 22px 42px rgba(15,44,62,.18);transform:translateZ(0);}
            .ce3d-strip{position:relative;border-right:4px solid #2f434d;background:rgba(255,255,255,.26);}
            .ce3d-strip:last-child{border-right:0;}
            .ce3d-strip.lat,.ce3d-strip.central{background:linear-gradient(180deg,rgba(47,67,77,.36),rgba(255,255,255,.30));}
            .ce3d-strip.vao{background:linear-gradient(180deg,rgba(255,255,255,.54),rgba(224,239,247,.20));}
            .ce3d-shelf{position:absolute;left:10%;right:10%;height:6px;background:rgba(214,169,85,.86);box-shadow:0 0 16px rgba(214,169,85,.55);transform:translateZ(22px);}
            .ce3d-shelf.one{top:34%;}.ce3d-shelf.two{top:60%;}
            .ce3d-label{position:absolute;left:8px;right:8px;bottom:8px;padding:7px 8px;color:#24343d;background:rgba(255,255,255,.88);border-radius:10px;font-size:.72rem;font-weight:950;text-align:center;box-shadow:0 6px 12px rgba(15,44,62,.10);}
            .ce3d-depth-line{position:absolute;right:-54px;top:22%;height:44%;width:4px;background:#d6a955;transform:translateZ(-45px) rotateY(-90deg);box-shadow:0 0 14px rgba(214,169,85,.6);}
            .ce3d-profile-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:min(900px,95%);}
            .ce3d-profile-pill{background:#fff;border:1px solid rgba(16,121,186,.16);border-radius:999px;padding:7px 10px;font-size:.78rem;font-weight:900;color:#0d5d8c;text-align:center;}
            @media(max-width:760px){.ce3d-wrap{min-width:620px}.ce3d-profile-list{grid-template-columns:1fr}.ce3d-scene{width:620px}}
        `;
        document.head.appendChild(style);
    }

    function lerVaosUpgrade() {
        const rows = Array.from(document.querySelectorAll('.ce-vao'));
        if (rows.length) {
            return rows.map((row, i) => ({
                largura: num(row.querySelector(`[data-ce-largura='${i}']`)?.value, 1),
                altura: num(row.querySelector(`[data-ce-altura='${i}']`)?.value, 1),
                profundidade: num(row.querySelector(`[data-ce-profundidade='${i}']`)?.value, 1)
            }));
        }
        try { return JSON.parse(document.getElementById('closet_vaos_json')?.value || '[]') || []; } catch { return []; }
    }

    function calcularClosetEvidenceUpgrade() {
        const modelo = document.getElementById('closet_modelo')?.value || '9571';
        const perfilLateral = modelo === '9577' ? '9577' : '9571';
        const nomeModelo = modelo === '9577' ? 'Invisível' : 'Clássico';
        const vaos = lerVaosUpgrade();
        const qtd = num(document.getElementById('quantidade')?.value, 1);
        const adicional = num(document.getElementById('valor_adicional')?.value, 0);
        const ml = {};
        const acessorios = { 'Conector 95P':0, 'Conector 115P':0, 'Conector 55P':0, 'Conector 120P':0, 'Baguete BA11/BA17':0 };
        const add = (codigo, metros) => { ml[codigo] = (ml[codigo] || 0) + num(metros, 0); };
        const larguraTotal = vaos.reduce((s,v) => s + num(v.largura,0), 0);
        const alturaMax = vaos.reduce((s,v) => Math.max(s, num(v.altura,0)), 0);
        const profMax = vaos.reduce((s,v) => Math.max(s, num(v.profundidade,0)), 0);

        vaos.forEach((vao, i) => {
            const largura = num(vao.largura,0), altura = num(vao.altura,0), prof = num(vao.profundidade,0);
            if (i === 0) { add(perfilLateral, metro(altura * 2)); add('9573', metro(prof * 2)); acessorios['Conector 95P'] += 4; acessorios['Conector 115P'] += 2; acessorios['Baguete BA11/BA17'] += 4; }
            if (i > 0) { add('9572', metro(altura * 2)); add('9573', metro(prof * 2)); acessorios['Conector 95P'] += 4; acessorios['Conector 115P'] += 2; acessorios['Baguete BA11/BA17'] += 4; }
            add('9573', metro(largura * 2));
            if (i === vaos.length - 1) { add(perfilLateral, metro(altura * 2)); add('9573', metro(prof * 2)); acessorios['Conector 95P'] += 4; acessorios['Conector 115P'] += 2; acessorios['Baguete BA11/BA17'] += 4; }
        });
        add('9566', metro((profMax * 4) + (larguraTotal * 2)));
        add('9567', metro(larguraTotal * 2));
        acessorios['Conector 55P'] += 8;
        acessorios['Conector 120P'] += Math.max(4, vaos.length * 4);

        const perfis = Object.entries(ml).map(([codigo, metros]) => {
            const preco = precoPerfilEstrutural(codigo);
            return { codigo, nome: nomePerfilEstrutural(codigo), metros, preco, total: metros * preco };
        });
        const insumos = Object.entries(acessorios).map(([nome, qt]) => {
            const preco = precoInsumo(nome === 'Baguete BA11/BA17' ? ['BA11','BA17','BAGUETE'] : [nome]);
            return { nome, qt, preco, total: qt * preco };
        });
        const subtotalPerfis = perfis.reduce((s,i) => s + i.total, 0);
        const subtotalInsumos = insumos.reduce((s,i) => s + i.total, 0);
        const unitario = subtotalPerfis + subtotalInsumos + adicional;
        return { modelo, nomeModelo, perfilLateral, vaos, qtd, adicional, ml, acessorios, larguraTotal, alturaMax, profMax, perfis, insumos, subtotalPerfis, subtotalInsumos, unitario, total: unitario * qtd };
    }

    function renderPreview3DCloset(calc) {
        addStyles3D();
        const atual = document.getElementById('portaSVG');
        if (!atual) return;
        const cols = [];
        const strips = [];
        calc.vaos.forEach((vao, i) => {
            if (i === 0) { cols.push('58px'); strips.push(`<div class='ce3d-strip lat'><div class='ce3d-label'>Lat. Esq<br>${calc.perfilLateral}</div></div>`); }
            if (i > 0) { cols.push('46px'); strips.push(`<div class='ce3d-strip central'><div class='ce3d-label'>Central<br>9572</div></div>`); }
            cols.push(`${Math.max(num(vao.largura, 180), 180)}fr`);
            strips.push(`<div class='ce3d-strip vao'><span class='ce3d-shelf one'></span><span class='ce3d-shelf two'></span><div class='ce3d-label'>Vão ${i + 1}<br>${mm(vao.largura)} × ${mm(vao.altura)}<br>Prof. ${mm(vao.profundidade)}</div></div>`);
            if (i === calc.vaos.length - 1) { cols.push('58px'); strips.push(`<div class='ce3d-strip lat'><div class='ce3d-label'>Lat. Dir<br>${calc.perfilLateral}</div></div>`); }
        });
        const div = document.createElement('div');
        div.id = 'portaSVG';
        div.className = 'ce3d-stage';
        div.innerHTML = `<div class='ce3d-wrap'>
            <div class='ce3d-title'>Closet Evidence ${calc.nomeModelo} · 3D estrutural sem portas frontais</div>
            <div class='ce3d-measure'>${calc.vaos.length} vãos · ${mm(calc.larguraTotal)} × ${mm(calc.alturaMax)} × ${mm(calc.profMax)}</div>
            <div class='ce3d-scene'>
                <div class='ce3d-box'>
                    <div class='ce3d-back'></div>
                    <div class='ce3d-left'></div><div class='ce3d-right'></div>
                    <div class='ce3d-top'></div><div class='ce3d-bottom'></div>
                    <div class='ce3d-front-frame' style='--ce3d-cols:${cols.join(' ')}'>${strips.join('')}</div>
                    <div class='ce3d-depth-line'></div>
                </div>
            </div>
            <div class='ce3d-profile-list'>
                ${calc.perfis.map(p => `<div class='ce3d-profile-pill'>${p.codigo} · ${p.metros.toFixed(2)}m · ${moeda(p.total)}</div>`).join('')}
            </div>
        </div>`;
        atual.replaceWith(div);
    }

    function atualizarClosetEvidenceUpgrade() {
        if (!isCloset()) { garantirSvgQuandoNaoCloset(); return; }
        const hidden = document.getElementById('closet_vaos_json');
        if (hidden) hidden.value = JSON.stringify(lerVaosUpgrade());
        const calc = calcularClosetEvidenceUpgrade();
        renderPreview3DCloset(calc);
        const preco = document.getElementById('precoPorta');
        if (preco) preco.innerHTML = `<strong>${moeda(calc.total)}</strong><div class='ce-lines'><span>Unitário estrutura: ${moeda(calc.unitario)}</span><span>Perfis estruturais: ${moeda(calc.subtotalPerfis)} · Insumos: ${moeda(calc.subtotalInsumos)} · Adicional: ${moeda(calc.adicional)}</span><span>${calc.vaos.length} vãos · busca por: 9566, 9567, ${calc.perfilLateral}, 9572 e 9573</span></div>`;
    }

    function instalarUpgradeClosetEvidence() {
        const oldAtualizar = window.atualizarClosetEvidence;
        window.calcularClosetEvidence = calcularClosetEvidenceUpgrade;
        window.atualizarClosetEvidence = atualizarClosetEvidenceUpgrade;
        document.addEventListener('input', () => setTimeout(atualizarClosetEvidenceUpgrade, 0), true);
        document.addEventListener('change', () => setTimeout(atualizarClosetEvidenceUpgrade, 0), true);
        setTimeout(() => { if (isCloset()) atualizarClosetEvidenceUpgrade(); }, 600);
        setTimeout(() => { if (isCloset()) atualizarClosetEvidenceUpgrade(); }, 1400);
        if (typeof oldAtualizar === 'function' && isCloset()) setTimeout(atualizarClosetEvidenceUpgrade, 50);
    }

    window.buscarPerfilEstruturalClosetEvidence = buscarPerfilEstrutural;
    window.calcularClosetEvidenceUpgrade = calcularClosetEvidenceUpgrade;
    window.atualizarClosetEvidenceUpgrade = atualizarClosetEvidenceUpgrade;
    window.instalarUpgradeClosetEvidence = instalarUpgradeClosetEvidence;

    document.addEventListener('DOMContentLoaded', instalarUpgradeClosetEvidence);
    setTimeout(instalarUpgradeClosetEvidence, 900);
})();
