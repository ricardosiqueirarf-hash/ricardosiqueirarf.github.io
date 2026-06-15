// =====================
// PREVIEW 3D DA PORTA
// MVP: substitui visualmente o SVG 2D por uma cena 3D
// =====================

const Porta3DState = {
    initialized: false,
    container: null,
    scene: null,
    camera: null,
    renderer: null,
    group: null,
    animationId: null,
    rotationY: -0.25,
    isDragging: false,
    lastX: 0
};

function adicionarEstilosPorta3D() {
    if (document.getElementById("porta3DStyles")) return;

    const style = document.createElement("style");
    style.id = "porta3DStyles";
    style.textContent = `
        #porta3D {
            width: 100%;
            height: 400px;
            border: 1px solid rgba(16,121,186,0.18);
            background: linear-gradient(135deg, #f8fbff 0%, #eef6fb 100%);
            border-radius: 14px;
            overflow: hidden;
            position: relative;
            cursor: grab;
        }

        #porta3D:active {
            cursor: grabbing;
        }

        #porta3D canvas {
            display: block;
            width: 100% !important;
            height: 100% !important;
        }

        .porta3d-empty {
            position: absolute;
            inset: 0;
            z-index: 4;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.88);
            color: #6b7280;
            font-weight: 800;
            text-align: center;
            padding: 16px;
            pointer-events: none;
        }

        .porta3d-label {
            position: absolute;
            left: 12px;
            bottom: 12px;
            background: rgba(255,255,255,0.86);
            border: 1px solid rgba(16,121,186,0.14);
            border-radius: 999px;
            padding: 7px 11px;
            font-size: 0.82rem;
            color: #1f2933;
            font-weight: 700;
            box-shadow: 0 8px 16px rgba(15,44,62,0.10);
            pointer-events: none;
        }
    `;

    document.head.appendChild(style);
}

function prepararContainerPorta3D() {
    adicionarEstilosPorta3D();

    let container = document.getElementById("porta3D");
    if (container) return container;

    const svgAntigo = document.getElementById("portaSVG");
    if (!svgAntigo || !svgAntigo.parentNode) return null;

    const wrapper = document.createElement("div");
    wrapper.id = "porta3DWrapper";

    container = document.createElement("div");
    container.id = "porta3D";

    const label = document.createElement("div");
    label.className = "porta3d-label";
    label.textContent = "Prévia 3D — arraste para girar";

    svgAntigo.style.display = "none";
    svgAntigo.setAttribute("aria-hidden", "true");

    svgAntigo.parentNode.insertBefore(wrapper, svgAntigo);
    wrapper.appendChild(container);
    wrapper.appendChild(label);
    wrapper.appendChild(svgAntigo);

    return container;
}

function mostrarMensagemPorta3D(texto) {
    const container = prepararContainerPorta3D();
    if (!container) return;

    let mensagem = document.getElementById("porta3DEmptyMessage");
    if (!mensagem) {
        mensagem = document.createElement("div");
        mensagem.id = "porta3DEmptyMessage";
        mensagem.className = "porta3d-empty";
        container.appendChild(mensagem);
    }

    mensagem.textContent = texto;
    mensagem.style.display = "flex";
}

function ocultarMensagemPorta3D() {
    const mensagem = document.getElementById("porta3DEmptyMessage");
    if (mensagem) mensagem.style.display = "none";
}

function garantirCanvasPorta3D() {
    const { container, renderer } = Porta3DState;
    if (!container || !renderer || !renderer.domElement) return;

    if (renderer.domElement.parentNode !== container) {
        container.insertBefore(renderer.domElement, container.firstChild);
    }
}

function numeroCampoPorta3D(id) {
    const valor = document.getElementById(id)?.value;
    const numero = Number(String(valor ?? "").replace(",", "."));
    return Number.isFinite(numero) ? numero : 0;
}

function limitarNumeroPorta3D(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
}

function obterVaoTrilhoPorta3D(id, alturaM) {
    const valorMm = numeroCampoPorta3D(id);
    if (valorMm <= 0) return 0.055;
    return limitarNumeroPorta3D(valorMm / 1000, 0.015, Math.max(0.08, alturaM * 0.28));
}

function obterTipoPorta3D() {
    return document.getElementById("tipologia")?.value || "giro";
}

function criarMaterialPorta3D() {
    return {
        vidro: new THREE.MeshPhysicalMaterial({
            color: 0xbfe7ff,
            transparent: true,
            opacity: 0.36,
            roughness: 0.12,
            metalness: 0.0,
            transmission: 0.25,
            thickness: 0.02
        }),
        perfil: new THREE.MeshStandardMaterial({
            color: 0x1079ba,
            metalness: 0.45,
            roughness: 0.24
        }),
        perfilEscuro: new THREE.MeshStandardMaterial({
            color: 0x0d5d8c,
            metalness: 0.48,
            roughness: 0.22
        }),
        dourado: new THREE.MeshStandardMaterial({
            color: 0xf0c24c,
            metalness: 0.55,
            roughness: 0.20
        }),
        vao: new THREE.MeshStandardMaterial({
            color: 0xf0c24c,
            transparent: true,
            opacity: 0.26,
            metalness: 0.0,
            roughness: 0.45
        }),
        sombra: new THREE.MeshStandardMaterial({
            color: 0xdbeafe,
            metalness: 0.0,
            roughness: 0.55
        })
    };
}

function criarBoxPorta3D(largura, altura, profundidade, x, y, z, material) {
    const geo = new THREE.BoxGeometry(largura, altura, profundidade);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function adicionarPainelPorta3D(group, materiais, larguraM, alturaM, zOffset = 0, deslocamentoX = 0) {
    const espPerfil = Math.max(0.035, Math.min(larguraM, alturaM) * 0.035);
    const profPerfil = 0.055;
    const profVidro = 0.018;

    const vidroLargura = Math.max(0.05, larguraM - espPerfil * 2);
    const vidroAltura = Math.max(0.05, alturaM - espPerfil * 2);

    group.add(criarBoxPorta3D(vidroLargura, vidroAltura, profVidro, deslocamentoX, 0, zOffset, materiais.vidro));

    group.add(criarBoxPorta3D(espPerfil, alturaM, profPerfil, deslocamentoX - larguraM / 2 + espPerfil / 2, 0, zOffset, materiais.perfil));
    group.add(criarBoxPorta3D(espPerfil, alturaM, profPerfil, deslocamentoX + larguraM / 2 - espPerfil / 2, 0, zOffset, materiais.perfil));
    group.add(criarBoxPorta3D(larguraM, espPerfil, profPerfil, deslocamentoX, alturaM / 2 - espPerfil / 2, zOffset, materiais.perfilEscuro));
    group.add(criarBoxPorta3D(larguraM, espPerfil, profPerfil, deslocamentoX, -alturaM / 2 + espPerfil / 2, zOffset, materiais.perfilEscuro));
}

function adicionarPuxadorPorta3D(group, materiais, larguraM, alturaM) {
    const puxadorId = document.getElementById("puxador")?.value;
    if (!puxadorId || puxadorId === "sem_puxador") return;

    const posicao = document.getElementById("puxador_posicao")?.value || "direita";
    const tamanhoMm = numeroCampoPorta3D("medida_puxador");
    const comprimento = tamanhoMm > 0
        ? Math.min(alturaM * 0.8, Math.max(0.12, tamanhoMm / 1000))
        : Math.max(0.18, alturaM * 0.38);
    const esp = 0.025;
    const z = 0.065;

    let largura = esp;
    let altura = comprimento;
    let x = larguraM / 2 - 0.075;
    let y = 0;

    if (posicao === "esquerda") {
        x = -larguraM / 2 + 0.075;
    } else if (posicao === "direita") {
        x = larguraM / 2 - 0.075;
    } else if (posicao === "cima") {
        largura = Math.min(larguraM * 0.75, Math.max(0.18, comprimento));
        altura = esp;
        x = 0;
        y = alturaM / 2 - 0.075;
    } else if (posicao === "baixo") {
        largura = Math.min(larguraM * 0.75, Math.max(0.18, comprimento));
        altura = esp;
        x = 0;
        y = -alturaM / 2 + 0.075;
    }

    group.add(criarBoxPorta3D(largura, altura, esp, x, y, z, materiais.dourado));
}

function adicionarDobradicasPorta3D(group, materiais, larguraM, alturaM) {
    const tipo = obterTipoPorta3D();
    if (tipo !== "giro") return;

    const lado = document.getElementById("dobradicas_posicao")?.value || "esquerda";
    const alturas = typeof obterAlturasDobradicas === "function" ? obterAlturasDobradicas() : [];
    const x = lado === "direita" ? larguraM / 2 + 0.018 : -larguraM / 2 - 0.018;
    const z = 0.055;

    alturas.forEach((alturaMm) => {
        const posMm = Number(alturaMm) || 0;
        if (posMm <= 0) return;
        const y = -alturaM / 2 + Math.min(alturaM, posMm / 1000);
        group.add(criarBoxPorta3D(0.035, 0.075, 0.035, x, y, z, materiais.perfilEscuro));
    });
}

function adicionarTrilhosPorta3D(group, materiais, larguraM, alturaM, vaoSuperiorM, vaoInferiorM) {
    const tipo = obterTipoPorta3D();
    if (tipo !== "correr" && tipo !== "deslizante") return;

    const trilhoAltura = 0.038;
    const trilhoProf = 0.14;
    const trilhoLargura = larguraM * 1.1;
    const yTrilhoSuperior = alturaM / 2 + vaoSuperiorM + trilhoAltura / 2;
    const yTrilhoInferior = -alturaM / 2 - vaoInferiorM - trilhoAltura / 2;

    group.add(criarBoxPorta3D(trilhoLargura, trilhoAltura, trilhoProf, 0, yTrilhoSuperior, 0, materiais.perfilEscuro));
    group.add(criarBoxPorta3D(trilhoLargura, trilhoAltura, trilhoProf, 0, yTrilhoInferior, 0, materiais.perfilEscuro));

    if (vaoSuperiorM > 0.005) {
        group.add(criarBoxPorta3D(larguraM * 1.04, vaoSuperiorM, 0.012, 0, alturaM / 2 + vaoSuperiorM / 2, -0.085, materiais.vao));
    }

    if (vaoInferiorM > 0.005) {
        group.add(criarBoxPorta3D(larguraM * 1.04, vaoInferiorM, 0.012, 0, -alturaM / 2 - vaoInferiorM / 2, -0.085, materiais.vao));
    }
}

function limparCenaPorta3D() {
    const group = Porta3DState.group;
    if (!group) return;

    while (group.children.length) {
        const child = group.children.pop();
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach((mat) => mat.dispose && mat.dispose());
            } else if (child.material.dispose) {
                child.material.dispose();
            }
        }
    }
}

function inicializarCenaPorta3D() {
    if (Porta3DState.initialized) {
        garantirCanvasPorta3D();
        return true;
    }

    if (typeof THREE === "undefined") {
        console.error("Three.js não carregado.");
        return false;
    }

    const container = prepararContainerPorta3D();
    if (!container) return false;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fbff);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.01, 100);
    camera.position.set(0.8, 0.45, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const luzAmbiente = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(luzAmbiente);

    const luzDirecional = new THREE.DirectionalLight(0xffffff, 1.4);
    luzDirecional.position.set(2, 3, 4);
    luzDirecional.castShadow = true;
    scene.add(luzDirecional);

    const luzFrontal = new THREE.PointLight(0xffffff, 0.8);
    luzFrontal.position.set(-2, 1, 2.5);
    scene.add(luzFrontal);

    Porta3DState.container = container;
    Porta3DState.scene = scene;
    Porta3DState.camera = camera;
    Porta3DState.renderer = renderer;
    Porta3DState.group = group;
    Porta3DState.initialized = true;

    container.addEventListener("pointerdown", (ev) => {
        Porta3DState.isDragging = true;
        Porta3DState.lastX = ev.clientX;
    });

    window.addEventListener("pointerup", () => {
        Porta3DState.isDragging = false;
    });

    window.addEventListener("pointermove", (ev) => {
        if (!Porta3DState.isDragging) return;
        const delta = ev.clientX - Porta3DState.lastX;
        Porta3DState.lastX = ev.clientX;
        Porta3DState.rotationY += delta * 0.008;
        if (Porta3DState.group) Porta3DState.group.rotation.y = Porta3DState.rotationY;
    });

    window.addEventListener("resize", redimensionarPorta3D);

    animarPorta3D();
    return true;
}

function redimensionarPorta3D() {
    const { container, camera, renderer } = Porta3DState;
    if (!container || !camera || !renderer) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 400;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function animarPorta3D() {
    Porta3DState.animationId = requestAnimationFrame(animarPorta3D);
    const { renderer, scene, camera, group } = Porta3DState;
    if (!renderer || !scene || !camera) return;

    if (group) {
        group.rotation.y += Porta3DState.isDragging ? 0 : 0.0015;
    }

    renderer.render(scene, camera);
}

function renderizarPorta3D() {
    const container = prepararContainerPorta3D();
    if (!container) return;

    const larguraMm = numeroCampoPorta3D("largura");
    const alturaMm = numeroCampoPorta3D("altura");

    if (larguraMm <= 0 || alturaMm <= 0) {
        mostrarMensagemPorta3D("Informe largura e altura para visualizar a porta em 3D.");
        return;
    }

    if (!inicializarCenaPorta3D()) return;

    garantirCanvasPorta3D();
    ocultarMensagemPorta3D();
    limparCenaPorta3D();

    const materiais = criarMaterialPorta3D();
    const tipo = obterTipoPorta3D();
    const larguraM = Math.max(0.2, larguraMm / 1000);
    const alturaM = Math.max(0.2, alturaMm / 1000);
    let alturaCenaM = alturaM;
    let centroCenaY = 0;

    if (tipo === "correr" || tipo === "deslizante") {
        const vaoSuperiorM = obterVaoTrilhoPorta3D("vao_trilhos_superior", alturaM);
        const vaoInferiorM = obterVaoTrilhoPorta3D("vao_trilhos_inferior", alturaM);
        adicionarPainelPorta3D(Porta3DState.group, materiais, larguraM, alturaM, 0, 0);
        adicionarPuxadorPorta3D(Porta3DState.group, materiais, larguraM, alturaM);
        adicionarTrilhosPorta3D(Porta3DState.group, materiais, larguraM, alturaM, vaoSuperiorM, vaoInferiorM);
        alturaCenaM = alturaM + vaoSuperiorM + vaoInferiorM + 0.09;
        centroCenaY = (vaoSuperiorM - vaoInferiorM) / 2;
    } else {
        adicionarPainelPorta3D(Porta3DState.group, materiais, larguraM, alturaM, 0, 0);
        adicionarPuxadorPorta3D(Porta3DState.group, materiais, larguraM, alturaM);
        adicionarDobradicasPorta3D(Porta3DState.group, materiais, larguraM, alturaM);
    }

    const maiorMedida = Math.max(larguraM, alturaCenaM);
    Porta3DState.camera.position.set(maiorMedida * 0.55, centroCenaY + alturaCenaM * 0.12, maiorMedida * 2.35);
    Porta3DState.camera.lookAt(0, centroCenaY, 0);
    Porta3DState.group.rotation.y = Porta3DState.rotationY;
    redimensionarPorta3D();
}

function desenharPorta() {
    renderizarPorta3D();
}

window.renderizarPorta3D = renderizarPorta3D;
window.desenharPorta = desenharPorta;

document.addEventListener("DOMContentLoaded", () => {
    prepararContainerPorta3D();
    renderizarPorta3D();
});
