// =====================
// ESTRUTURAS 3D
// =====================
function abrirEstrutura3D() {
    const url = `3dteste.html?orcamento_uuid=${ORCAMENTO_UUID}`;
    window.open(url, "_blank");
}

function carregarEstruturas3D() {
    try {
        const data = localStorage.getItem(`estruturas_${ORCAMENTO_UUID}`);
        if (!data) return;
        estruturas3D = JSON.parse(data);
        renderEstruturas3D();
    } catch (err) {
        console.error("Erro ao carregar estruturas 3D:", err);
    }
}

function renderEstruturas3D() {
    const container = document.getElementById("estruturas3DSalvas");
    container.innerHTML = "";
    estruturas3D.forEach((e, idx) => {
        container.innerHTML += `
            <div>
                <strong>Estrutura 3D ${idx + 1}</strong><br>
                Comprimento total: ${e.totalLength.toFixed(2)} mm<br>
                Fixadores: ${e.fixadores || "Nenhum"}<br>
                <button class="btn" onclick="verEstrutura3D(${idx})">Ver 3D</button>
            </div>
        `;
    });
}

function verEstrutura3D(idx) {
    const url = `3dteste.html?orcamento_uuid=${ORCAMENTO_UUID}&estrutura_idx=${idx}`;
    window.open(url, "_blank");
}

window.abrirEstrutura3D = abrirEstrutura3D;
window.carregarEstruturas3D = carregarEstruturas3D;
window.renderEstruturas3D = renderEstruturas3D;
window.verEstrutura3D = verEstrutura3D;
