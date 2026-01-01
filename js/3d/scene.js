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

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  App3D.animate = animate;
})();
