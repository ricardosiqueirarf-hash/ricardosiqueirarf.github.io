window.App3D = window.App3D || {};

(() => {
  const App3D = window.App3D;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    75,
    (window.innerWidth - 300) / window.innerHeight,
    0.1,
    5000
  );
  camera.position.set(400, 400, 400);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth - 300, window.innerHeight);
  document.getElementById("canvas-container").appendChild(renderer.domElement);

  const axes = new THREE.AxesHelper(200);
  const grid = new THREE.GridHelper(2000, 10);
  scene.add(axes, grid);

  const currentPointGeometry = new THREE.SphereGeometry(10, 16, 16);
  const currentPointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const currentPointMesh = new THREE.Mesh(currentPointGeometry, currentPointMaterial);
  scene.add(currentPointMesh);

  App3D.scene = scene;
  App3D.camera = camera;
  App3D.renderer = renderer;
  App3D.currentPointMesh = currentPointMesh;

  App3D.lineModel = null;
  App3D.lineModelLength = 0;
  App3D.lineModelPromise = null;
  App3D.lineModelRotation = new THREE.Euler(0, 0, 0);
  App3D.lineModelScale = new THREE.Vector3(1, 1, 1);

  App3D.loadLineModel = function loadLineModel() {
    if (App3D.lineModelPromise) {
      return App3D.lineModelPromise;
    }

    App3D.lineModelPromise = new Promise((resolve, reject) => {
      if (!THREE.GLTFLoader) {
        const error = new Error("GLTFLoader indisponível. Verifique o script do loader.");
        console.error(error);
        reject(error);
        return;
      }
      const loader = new THREE.GLTFLoader();
      loader.load(
        "/thin.glb",
        (gltf) => {
          const model = gltf.scene || gltf.scenes?.[0];
          if (!model) {
            const error = new Error("Modelo GLB vazio.");
            console.error(error);
            reject(error);
            return;
          }

          const measurementModel = model.clone(true);
          if (App3D.lineModelRotation) {
            measurementModel.rotation.copy(App3D.lineModelRotation);
          }
          measurementModel.updateMatrixWorld(true);

          const box = new THREE.Box3().setFromObject(measurementModel);
          const size = new THREE.Vector3();
          box.getSize(size);

          App3D.lineModel = model;
          App3D.lineModelLength = size.y || 0;

          resolve(model);
        },
        undefined,
        (error) => {
          console.error("Erro ao carregar thin.glb:", error);
          reject(error);
        }
      );
    });

    return App3D.lineModelPromise;
  };

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  App3D.animate = animate;
})();


