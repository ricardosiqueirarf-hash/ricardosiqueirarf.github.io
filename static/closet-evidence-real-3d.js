// Preview 3D REAL do Closet Evidence: gabinete aberto, sem portas frontais.
// Este arquivo substitui qualquer preview 2D anterior quando a tipologia for closet_evidence.

(function () {
    const TIPO = 'closet_evidence';

    function n(v, min = 0) {
        const x = Number(String(v ?? '').replace(',', '.'));
        return Number.isFinite(x) ? Math.max(min, x) : min;
    }

    function mm(v) {
        return `${Math.round(n(v, 0)).toLocaleString('pt-BR')} mm`;
    }

    function isCloset() {
        return document.getElementById('tipologia')?.value === TIPO;
    }

    function lerVaosCloset3D() {
        const rows = Array.from(document.querySelectorAll('.ce-vao'));
        if (rows.length) {
            return rows.map((row, i) => ({
                largura: n(row.querySelector(`[data-ce-largura='${i}']`)?.value, 700),
                altura: n(row.querySelector(`[data-ce-altura='${i}']`)?.value, 2400),
                profundidade: n(row.querySelector(`[data-ce-profundidade='${i}']`)?.value, 600)
            }));
        }
        try {
            return JSON.parse(document.getElementById('closet_vaos_json')?.value || '[]') || [];
        } catch {
            return [];
        }
    }

    function calcularResumoCloset3D() {
        const modelo = document.getElementById('closet_modelo')?.value || '9571';
        const perfilLateral = modelo === '9577' ? '9577' : '9571';
        const nomeModelo = modelo === '9577' ? 'Invisível' : 'Clássico';
        const vaos = lerVaosCloset3D();
        const larguraTotal = vaos.reduce((s, v) => s + n(v.largura, 0), 0);
        const alturaMax = vaos.reduce((s, v) => Math.max(s, n(v.altura, 0)), 0);
        const profMax = vaos.reduce((s, v) => Math.max(s, n(v.profundidade, 0)), 0);
        return { modelo, nomeModelo, perfilLateral, vaos, larguraTotal, alturaMax, profMax };
    }

    function addCloset3DStyles() {
        if (document.getElementById('closetEvidenceReal3DStyles')) return;
        const style = document.createElement('style');
        style.id = 'closetEvidenceReal3DStyles';
        style.textContent = `
            .ce-real3d-stage{
                width:100%;
                min-height:460px;
                padding:22px;
                overflow:auto;
                border:1px dashed rgba(16,121,186,.30);
                border-radius:18px;
                background:radial-gradient(circle at 20% 0%,rgba(16,121,186,.16),transparent 34%),linear-gradient(135deg,#f9fcff,#edf6fb);
                perspective:1250px;
            }
            .ce-real3d-wrap{min-width:760px;display:grid;gap:14px;place-items:center;}
            .ce-real3d-title{color:#0d5d8c;font-weight:950;text-align:center;font-size:1rem;}
            .ce-real3d-sub{color:#6b7280;font-weight:900;text-align:center;font-size:.86rem;}
            .ce-real3d-scene{
                position:relative;
                width:min(900px,92%);
                height:380px;
                transform-style:preserve-3d;
                transform:rotateX(-13deg) rotateY(-28deg);
                margin:18px auto 8px;
            }
            .ce-real3d-cabinet{
                position:absolute;
                inset:34px 90px 34px 90px;
                transform-style:preserve-3d;
            }
            .ce-real3d-back{
                position:absolute;
                inset:0;
                background:linear-gradient(180deg,rgba(233,247,253,.94),rgba(200,221,233,.92));
                border:5px solid #2f434d;
                box-shadow:inset 0 0 0 4px rgba(255,255,255,.46);
                transform:translateZ(-115px);
            }
            .ce-real3d-left,.ce-real3d-right{
                position:absolute;
                top:0;
                bottom:0;
                width:115px;
                background:linear-gradient(90deg,rgba(47,67,77,.56),rgba(236,248,253,.38));
                border:5px solid #2f434d;
                transform-style:preserve-3d;
                box-shadow:inset 0 0 0 3px rgba(255,255,255,.18);
            }
            .ce-real3d-left{left:-115px;transform:rotateY(90deg);transform-origin:right center;}
            .ce-real3d-right{right:-115px;transform:rotateY(-90deg);transform-origin:left center;}
            .ce-real3d-top,.ce-real3d-bottom{
                position:absolute;
                left:0;
                right:0;
                height:115px;
                background:linear-gradient(180deg,rgba(214,169,85,.50),rgba(246,239,220,.28));
                border:5px solid #2f434d;
                transform-style:preserve-3d;
                box-shadow:inset 0 0 0 3px rgba(255,255,255,.18);
            }
            .ce-real3d-top{top:-115px;transform:rotateX(-90deg);transform-origin:bottom center;}
            .ce-real3d-bottom{bottom:-115px;transform:rotateX(90deg);transform-origin:top center;}
            .ce-real3d-front{
                position:absolute;
                inset:0;
                display:grid;
                grid-template-columns:var(--ce-cols);
                border:6px solid #2f434d;
                background:rgba(255,255,255,.05);
                transform:translateZ(0);
                box-shadow:0 22px 44px rgba(15,44,62,.22);
            }
            .ce-real3d-cell{position:relative;border-right:4px solid #2f434d;transform-style:preserve-3d;}
            .ce-real3d-cell:last-child{border-right:0;}
            .ce-real3d-cell.lat,.ce-real3d-cell.central{background:linear-gradient(180deg,rgba(47,67,77,.38),rgba(255,255,255,.22));}
            .ce-real3d-cell.vao{background:linear-gradient(180deg,rgba(255,255,255,.42),rgba(225,240,247,.12));}
            .ce-real3d-divider-depth{
                position:absolute;
                top:0;bottom:0;right:-58px;width:110px;
                border-left:4px solid rgba(47,67,77,.78);
                background:linear-gradient(90deg,rgba(47,67,77,.28),rgba(255,255,255,.08));
                transform:rotateY(-90deg);
                transform-origin:left center;
            }
            .ce-real3d-shelf{
                position:absolute;
                left:9%;right:9%;height:8px;
                background:rgba(214,169,85,.88);
                border-radius:999px;
                box-shadow:0 0 18px rgba(214,169,85,.55);
                transform:translateZ(32px);
            }
            .ce-real3d-shelf.one{top:30%;}
            .ce-real3d-shelf.two{top:55%;}
            .ce-real3d-shelf.three{top:77%;opacity:.72;}
            .ce-real3d-label{
                position:absolute;
                left:7px;right:7px;bottom:8px;
                z-index:6;
                padding:7px 8px;
                border-radius:10px;
                background:rgba(255,255,255,.88);
                color:#24343d;
                text-align:center;
                font-size:.72rem;
                font-weight:950;
                box-shadow:0 7px 14px rgba(15,44,62,.12);
            }
            .ce-real3d-edge-label{
                position:absolute;
                top:-32px;left:50%;transform:translateX(-50%);
                color:#0d5d8c;font-size:.78rem;font-weight:950;background:rgba(255,255,255,.82);padding:5px 9px;border-radius:999px;
            }
            .ce-real3d-profile-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:min(900px,95%);}
            .ce-real3d-pill{background:#fff;border:1px solid rgba(16,121,186,.16);border-radius:999px;padding:7px 10px;font-size:.78rem;font-weight:900;color:#0d5d8c;}
            .ce-real3d-warning{max-width:760px;text-align:center;color:#92400e;background:#fff7df;border:1px solid rgba(214,169,85,.38);border-radius:12px;padding:9px 12px;font-size:.82rem;font-weight:800;}
            @media(max-width:760px){.ce-real3d-wrap{min-width:640px}.ce-real3d-scene{width:640px}.ce-real3d-cabinet{inset:34px 74px}.ce-real3d-left,.ce-real3d-right{width:95px}.ce-real3d-left{left:-95px}.ce-real3d-right{right:-95px}.ce-real3d-top,.ce-real3d-bottom{height:95px}.ce-real3d-top{top:-95px}.ce-real3d-bottom{bottom:-95px}}
        `;
        document.head.appendChild(style);
    }

    function montarColunasEPartes(c) {
        const cols = [];
        const html = [];
        c.vaos.forEach((vao, i) => {
            if (i === 0) {
                cols.push('60px');
                html.push(`<div class="ce-real3d-cell lat"><div class="ce-real3d-divider-depth"></div><div class="ce-real3d-label">Lat. Esq<br>${c.perfilLateral}</div></div>`);
            }
            if (i > 0) {
                cols.push('48px');
                html.push(`<div class="ce-real3d-cell central"><div class="ce-real3d-divider-depth"></div><div class="ce-real3d-label">Central<br>9572</div></div>`);
            }
            cols.push(`${Math.max(n(vao.largura, 180), 180)}fr`);
            html.push(`<div class="ce-real3d-cell vao">
                <span class="ce-real3d-shelf one"></span>
                <span class="ce-real3d-shelf two"></span>
                <span class="ce-real3d-shelf three"></span>
                <div class="ce-real3d-label">Vão ${i + 1}<br>${mm(vao.largura)} × ${mm(vao.altura)}<br>Prof. ${mm(vao.profundidade)}</div>
            </div>`);
            if (i === c.vaos.length - 1) {
                cols.push('60px');
                html.push(`<div class="ce-real3d-cell lat"><div class="ce-real3d-divider-depth"></div><div class="ce-real3d-label">Lat. Dir<br>${c.perfilLateral}</div></div>`);
            }
        });
        return { cols, html };
    }

    function renderClosetReal3D() {
        if (!isCloset()) return;
        addCloset3DStyles();
        const c = calcularResumoCloset3D();
        const preview = document.querySelector('.door-preview');
        if (!preview) return;
        const { cols, html } = montarColunasEPartes(c);
        preview.innerHTML = `<div id="portaSVG" class="ce-real3d-stage">
            <div class="ce-real3d-wrap">
                <div class="ce-real3d-title">Closet Evidence ${c.nomeModelo} · 3D estrutural aberto</div>
                <div class="ce-real3d-sub">Sem portas frontais · ${c.vaos.length} vãos · ${mm(c.larguraTotal)} × ${mm(c.alturaMax)} × ${mm(c.profMax)}</div>
                <div class="ce-real3d-scene">
                    <div class="ce-real3d-cabinet">
                        <div class="ce-real3d-back"><span class="ce-real3d-edge-label">Fundo</span></div>
                        <div class="ce-real3d-left"><span class="ce-real3d-edge-label">Lateral</span></div>
                        <div class="ce-real3d-right"><span class="ce-real3d-edge-label">Lateral</span></div>
                        <div class="ce-real3d-top"><span class="ce-real3d-edge-label">Topo · 9566/9567</span></div>
                        <div class="ce-real3d-bottom"><span class="ce-real3d-edge-label">Base · 9566/9567</span></div>
                        <div class="ce-real3d-front" style="--ce-cols:${cols.join(' ')}">${html.join('')}</div>
                    </div>
                </div>
                <div class="ce-real3d-profile-row">
                    <span class="ce-real3d-pill">Laterais: ${c.perfilLateral}</span>
                    <span class="ce-real3d-pill">Centrais: 9572</span>
                    <span class="ce-real3d-pill">Travessas/Fundo: 9573</span>
                    <span class="ce-real3d-pill">Topo/Base: 9566 + 9567</span>
                </div>
                <div class="ce-real3d-warning">Preview representa a estrutura do closet. As portas frontais foram removidas propositalmente.</div>
            </div>
        </div>`;
    }

    function restaurarSvgParaOutrasTipologias() {
        if (isCloset()) return;
        const preview = document.querySelector('.door-preview');
        const atual = document.getElementById('portaSVG');
        if (!preview || (atual && atual.tagName && atual.tagName.toLowerCase() === 'svg')) return;
        preview.innerHTML = '<svg id="portaSVG"></svg>';
        if (typeof desenharPorta === 'function') {
            setTimeout(() => desenharPorta(), 0);
        }
    }

    function instalarReal3D() {
        document.addEventListener('input', () => setTimeout(renderClosetReal3D, 0), true);
        document.addEventListener('change', () => {
            setTimeout(() => {
                if (isCloset()) renderClosetReal3D();
                else restaurarSvgParaOutrasTipologias();
            }, 0);
        }, true);

        const obs = new MutationObserver(() => {
            if (isCloset()) {
                const real = document.querySelector('.ce-real3d-stage');
                if (!real) setTimeout(renderClosetReal3D, 0);
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });

        setTimeout(renderClosetReal3D, 800);
        setTimeout(renderClosetReal3D, 1600);
    }

    window.renderClosetEvidenceReal3D = renderClosetReal3D;
    window.instalarClosetEvidenceReal3D = instalarReal3D;

    document.addEventListener('DOMContentLoaded', instalarReal3D);
    setTimeout(instalarReal3D, 1000);
})();
