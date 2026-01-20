const container = document.getElementById("preview-3d");
const controlButtons = document.querySelectorAll(".preview-3d-btn");

if (container) {
  const importMap = {
    imports: {
      three: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
  };

  if (!document.querySelector('script[type="importmap"]')) {
    const script = document.createElement("script");
    script.type = "importmap";
    script.textContent = JSON.stringify(importMap);
    document.head.appendChild(script);
  }

  const DEFAULT_MODEL = "1036.glb";
  const models = {
    "1036.glb": "Clássico",
    "3545.glb": "Slim",
    "3446.glb": "Invisível"
  };

  const THREE = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");

  function computeBaseDir() {
    const path = window.location.pathname;
    if (path.endsWith("/")) return path;
    const lastSlash = path.lastIndexOf("/");
    return path.slice(0, lastSlash + 1);
  }

  const BASE_DIR = computeBaseDir();

  function makeUrlCandidates(filename) {
    return [
      filename,
      "./" + filename,
      BASE_DIR + filename,
      "/" + filename,
      BASE_DIR + "assets/" + filename,
      "/assets/" + filename,
      BASE_DIR + "models/" + filename,
      "/models/" + filename
    ];
  }

  async function testFetch(url) {
    try {
      const abs = new URL(url, window.location.href).toString();
      const response = await fetch(abs, { cache: "no-store" });
      if (!response.ok) return null;
      await response.arrayBuffer();
      return abs;
    } catch (error) {
      return null;
    }
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f9ff);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.001, 1000000);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
  scene.add(ambientLight);

  const dir = new THREE.DirectionalLight(0xffffff, 2.6);
  dir.position.set(10, 20, 10);
  scene.add(dir);

  const fillDir = new THREE.DirectionalLight(0xffffff, 1.4);
  fillDir.position.set(-12, 8, -10);
  scene.add(fillDir);

  const pointFront = new THREE.PointLight(0xffffff, 4.0, 0, 2);
  pointFront.position.set(0, 0, 50);
  scene.add(pointFront);

  const pointBack = new THREE.PointLight(0xffffff, 3.5, 0, 2);
  pointBack.position.set(0, 0, -50);
  scene.add(pointBack);

  const cameraState = {
    isDragging: false,
    lastX: 0,
    lastY: 0,
    yaw: Math.PI / 4,
    pitch: Math.PI / 8,
    radius: 2.5,
    target: new THREE.Vector3(0, 0, 0)
  };

  function atualizarCamera() {
    const maxPitch = Math.PI / 2 - 0.05;
    const minPitch = -maxPitch;
    cameraState.pitch = Math.max(minPitch, Math.min(maxPitch, cameraState.pitch));

    const x = cameraState.radius * Math.cos(cameraState.pitch) * Math.cos(cameraState.yaw);
    const y = cameraState.radius * Math.sin(cameraState.pitch);
    const z = cameraState.radius * Math.cos(cameraState.pitch) * Math.sin(cameraState.yaw);

    camera.position.set(
      cameraState.target.x + x,
      cameraState.target.y + y,
      cameraState.target.z + z
    );
    camera.lookAt(cameraState.target);
  }

  function frameObject(obj, fitOffset = 1.25) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    cameraState.target.copy(center);

    const maxSize = Math.max(size.x, size.y, size.z);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    let distance = (maxSize / (2 * Math.tan(fov / 2))) * fitOffset;

    if (!isFinite(distance) || distance <= 0) distance = 2.5;

    cameraState.radius = distance;

    atualizarCamera();
  }

  function autoScale(obj, targetSize = 2.0) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (!isFinite(maxDim) || maxDim <= 0) return;

    const scale = targetSize / maxDim;
    obj.scale.multiplyScalar(scale);
  }

  function forceVisibleMaterials(root) {
    root.traverse((node) => {
      if (!node.isMesh) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((material) => {
        if (!material) return;
        material.side = THREE.DoubleSide;
        material.transparent = !!material.transparent;
        material.depthWrite = true;
        if ("metalness" in material) material.metalness = 0.65;
        if ("roughness" in material) material.roughness = 0.35;
        material.needsUpdate = true;
      });
    });
  }

  let currentModel = null;
  let loadToken = 0;

  function limparModelo() {
    if (!currentModel) return;
    scene.remove(currentModel);

    currentModel.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
        else node.material.dispose();
      }
    });

    currentModel = null;
  }

  async function carregarModelo(filename) {
    loadToken += 1;
    const token = loadToken;
    limparModelo();

    const urls = makeUrlCandidates(filename);
    let firstGoodAbs = null;

    for (const url of urls) {
      const abs = await testFetch(url);
      if (abs && !firstGoodAbs) firstGoodAbs = abs;
    }

    if (!firstGoodAbs) return;

    const loader = new GLTFLoader();

    loader.load(
      firstGoodAbs,
      (gltf) => {
        if (token !== loadToken) return;
        currentModel = gltf.scene;
        scene.add(currentModel);

        autoScale(currentModel, 2.0);
        forceVisibleMaterials(currentModel);
        frameObject(currentModel, 1.35);
      }
    );
  }

  function resizeRenderer() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(() => resizeRenderer());
    resizeObserver.observe(container);
  }

  window.addEventListener("resize", () => resizeRenderer());

  renderer.domElement.addEventListener("mousedown", (event) => {
    cameraState.isDragging = true;
    cameraState.lastX = event.clientX;
    cameraState.lastY = event.clientY;
  });

  window.addEventListener("mouseup", () => {
    cameraState.isDragging = false;
  });

  window.addEventListener("mousemove", (event) => {
    if (!cameraState.isDragging) return;
    const dx = event.clientX - cameraState.lastX;
    const dy = event.clientY - cameraState.lastY;
    cameraState.lastX = event.clientX;
    cameraState.lastY = event.clientY;
    const speed = 0.005;
    cameraState.yaw += dx * speed;
    cameraState.pitch += dy * speed;
    atualizarCamera();
  });

  renderer.domElement.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const zoom = 1 + event.deltaY * 0.001;
      cameraState.radius = Math.max(0.05, Math.min(5000, cameraState.radius * zoom));
      atualizarCamera();
    },
    { passive: false }
  );

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  function setActiveButton(filename) {
    if (!controlButtons.length) return;
    controlButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.model === filename);
    });
  }

  function bindControls() {
    if (!controlButtons.length) return;
    controlButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const model = button.dataset.model;
        if (!model || !models[model]) return;
        setActiveButton(model);
        await carregarModelo(model);
      });
    });
  }

  resizeRenderer();
  atualizarCamera();
  animate();
  bindControls();
  setActiveButton(DEFAULT_MODEL);
  await carregarModelo(DEFAULT_MODEL);
}


