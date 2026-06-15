// Preview 3D REAL do Closet Evidence
// Conceito: cubo aberto na frente. Não reaproveita lógica visual de porta.

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
            .ce-cube-stage{width:100%;min-height:480px;padding:22px;overflow:auto;border:1px dashed rgba(16,121,186,.30);border-radius:18px;background:radial-gradient(circle at 20% 0%,rgba(16,121,186,.16),transparent 34%),linear-gradient(135deg,#f9fcff,#edf6fb);perspective:1250px;}
            .ce-cube-wrap{min-width:780px;display:grid;gap:14px;place-items:center;}
            .ce-cube-title{color:#0d5d8c;font-weight:950;text-align:center;font-size:1rem;}
            .ce-cube-sub{color:#6b7280;font-weight:900;text-align:center;font-size:.86rem;}
            .ce-cube-scene{position:relative;width:min(920px,94%);height:390px;transform-style:preserve-3d;transform:rotateX(-13deg) rotateY(-28deg);margin:18px auto 8px;}
            .ce-cube{position:absolute;inset:36px 110px 36px 110px;transform-style:preserve-3d;}
            .ce-back{position:absolute;inset:0;background:linear-gradient(180deg,rgba(233,247,253,.96),rgba(200,221,233,.94));border:5px solid #2f434d;box-shadow:inset 0 0 0 4px rgba(255,255,255,.46);transform:translateZ(-120px);}
            .ce-left,.ce-right{position:absolute;top:0;bottom:0;width:120px;background:linear-gradient(90deg,rgba(47,67,77,.56),rgba(236,248,253,.38));border:5px solid #2f434d;transform-style:preserve-3d;box-shadow:inset 0 0 0 3px rgba(255,255,255,.18);}
            .ce-left{left:-120px;transform:rotateY(90deg);transform-origin:right center;}
            .ce-right{right:-120px;transform:rotateY(-90deg);transform-origin:left center;}
            .ce-top,.ce-bottom{position:absolute;left:0;right:0;height:120px;background:linear-gradient(180deg,rgba(214,169,85,.50),rgba(246,239,220,.30));border:5px solid #2f434d;transform-style:preserve-3d;box-shadow:inset 0 0 0 3px rgba(255,255,255,.18);}
            .ce-top{top:-120px;transform:rotateX(-90deg);transform-origin:bottom center;}
            .ce-bottom{bottom:-120px;transform:rotateX(90deg);transform-origin:top center;}
            .ce-openings{position:absolute;inset:0;display:grid;grid-template-columns:var(--ce-bays);background:transparent;transform:translateZ(0);box-shadow:0 22px 44px rgba(15,44,62,.22);}
            .ce-bay{position:relative;border-right:4px solid #2f434d;border-left:4px solid transparent;background:linear-gradient(180deg,rgba(255,255,255,.40),rgba(225,240,247,.12));box-shadow:inset 0 0 0 5px rgba(47,67,77,.18);transform-style:preserve-3d;}
            .ce-bay:first-child{border-left:6px solid #2f434d;}
            .ce-bay:last-child{border-right:6px solid #2f434d;}
            .ce-bay-divider-depth{position:absolute;top:0;bottom:0;right:-60px;width:120px;border-left:4px solid rgba(47,67,77,.85);background:linear-gradient(90deg,rgba(47,67,77,.30),rgba(255,255,255,.08));transform:rotateY(-90deg);transform-origin:left center;}
            .ce-shelf{position:absolute;left:9%;right:9%;height:8px;background:rgba(214,169,85,.88);border-radius:999px;box-shadow:0 0 18px rgba(214,169,85,.55);transform:translateZ(34px);}
            .ce-shelf.one{top:28%;}.ce-shelf.two{top:53%;}.ce-shelf.three{top:76%;opacity:.72;}
            .ce-bay-label{position:absolute;left:8px;right:8px;bottom:8px;z-index:6;padding:7px 8px;border-radius:10px;background:rgba(255,255,255,.88);color:#24343d;text-align:center;font-size:.72rem;font-weight:950;box-shadow:0 7px 14px rgba(15,44,62,.12);}
            .ce-face-label{position:absolute;top:-32px;left:50%;transform:translateX(-50%);color:#0d5d8c;font-size:.78rem;font-weight:950;background:rgba(255,255,255,.82);padding:5px 9px;border-radius:999px;}
            .ce-profile-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:min(900px,95%);}
            .ce-pill{background:#fff;border:1px solid rgba(16,121,186,.16);border-radius:999px;padding:7px 10px;font-size:.78rem;font-weight:900;color:#0d5d8c;}
            .ce-warning{max-width:760px;text-align:center;color:#92400e;background:#fff7df;border:1px solid rgba(214,169,85,.38);border-radius:12px;padding:9px 12px;font-size:.82rem;font-weight:800;}
            @media(max-width:760px){.ce-cube-wrap{min-width:660px}.ce-cube-scene{width:660px}.ce-cube{inset:34px 90px}.ce-left,.ce-right{width:95px}.ce-left{left:-95px}.ce-right{right:-95px}.ce-top,.ce-bottom{height:95px}.ce-top{top:-95px}.ce-bottom{bottom:-95px}}
        `;
        document.head.appendChild(style);
    }

    function montarNichos(c) {
        const bays = [];
        const html = [];
        c.vaos.forEach((vao, i) => {
            bays.push(`${Math.max(n(vao.largura, 180), 180)}fr`);
            html.push(`
                <div class="ce-bay">
                    ${i < c.vaos.length - 1 ? '<div class="ce-bay-divider-depth"></div>' : ''}
                    <span class="ce-shelf one"></span>
                    <span class="ce-shelf two"></span>
                    <span class="ce-shelf three"></span>
                    <div class="ce-bay-label">Vão ${i + 1}<br>${mm(vao.largura)} × ${mm(vao.altura)}<br>Prof. ${mm(vao.profundidade)}</div>
                </div>
            `);
        });
        return { bays, html };
    }

    function renderClosetReal3D() {
        if (!isCloset()) return;
        addCloset3DStyles();
        const c = calcularResumoCloset3D();
        const preview = document.querySelector('.door-preview');
        if (!preview) return;
        const { bays, html } = montarNichos(c);
        preview.innerHTML = `
            <div id="portaSVG" class="ce-cube-stage">
                <div class="ce-cube-wrap">
                    <div class="ce-cube-title">Closet Evidence ${c.nomeModelo} · 3D estrutural aberto</div>
                    <div class="ce-cube-sub">Frente aberta · ${c.vaos.length} vãos · ${mm(c.larguraTotal)} × ${mm(c.alturaMax)} × ${mm(c.profMax)}</div>
                    <div class="ce-cube-scene">
                        <div class="ce-cube">
                            <div class="ce-back"><span class="ce-face-label">Fundo</span></div>
                            <div class="ce-left"><span class="ce-face-label">Lateral</span></div>
                            <div class="ce-right"><span class="ce-face-label">Lateral</span></div>
                            <div class="ce-top"><span class="ce-face-label">Topo · 9566 / 9567</span></div>
                            <div class="ce-bottom"><span class="ce-face-label">Base · 9566 / 9567</span></div>
                            <div class="ce-openings" style="--ce-bays:${bays.join(' ')}">${html.join('')}</div>
                        </div>
                    </div>
                    <div class="ce-profile-row">
                        <span class="ce-pill">Laterais: ${c.perfilLateral}</span>
                        <span class="ce-pill">Centrais: 9572</span>
                        <span class="ce-pill">Travessas/Fundo: 9573</span>
                        <span class="ce-pill">Topo/Base: 9566 + 9567</span>
                    </div>
                    <div class="ce-warning">Preview representa apenas a estrutura do closet. As portas frontais foram removidas propositalmente.</div>
                </div>
            </div>`;
    }

    function restaurarPreviewPadrao() {
        if (isCloset()) return;
        const preview = document.querySelector('.door-preview');
        if (!preview) return;
        const atual = document.getElementById('portaSVG');
        if (atual && atual.tagName && atual.tagName.toLowerCase() === 'svg') return;
        preview.innerHTML = '<svg id="portaSVG"></svg>';
        if (typeof desenharPorta === 'function') setTimeout(() => desenharPorta(), 0);
    }

    function instalarReal3D() {
        document.addEventListener('input', () => setTimeout(() => { if (isCloset()) renderClosetReal3D(); }, 0), true);
        document.addEventListener('change', () => setTimeout(() => { if (isCloset()) renderClosetReal3D(); else restaurarPreviewPadrao(); }, 0), true);
        const obs = new MutationObserver(() => {
            if (!isCloset()) return;
            const real = document.querySelector('.ce-cube-stage');
            if (!real) setTimeout(renderClosetReal3D, 0);
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
