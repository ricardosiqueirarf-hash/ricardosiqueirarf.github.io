window.App3D = window.App3D || {};

(() => {
  const App3D = window.App3D;
  const { state } = App3D;

  function createLineMesh(start, end) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const thickness = 5;

    const geometry = new THREE.BoxGeometry(thickness, length, thickness);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const tube = new THREE.Mesh(geometry, material);

    tube.position.copy(start).add(direction.clone().multiplyScalar(0.5));
    tube.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize()
    );

    return tube;
  }

  App3D.drawLine = function drawLine(dx, dy, dz, axis, options = {}) {
    const { recordHistory = true } = options;
    const { x, y, z, len } = App3D.getInputs();

    const start = new THREE.Vector3(x, y, z);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const end = start.clone().add(dir.multiplyScalar(len));

    const key = App3D.segmentKey(start, end);
    if (!state.segmentMap.has(key)) {
      state.segmentMap.set(key, true);
      state.totalLength += App3D.segmentLength(start, end);
    }

    const tube = createLineMesh(start, end);

    App3D.scene.add(tube);
    state.lines.push(tube);

    if (recordHistory) {
      state.history.push({ from: start.clone(), to: end.clone(), axis });
    }

    App3D.registerVertex(start, axis);
    App3D.registerVertex(end, axis);

    App3D.setInputs(end.x, end.y, end.z);
    App3D.updateMetrics();
  };

  App3D.rebuildFromHistory = function rebuildFromHistory() {
    state.lines.forEach((l) => App3D.scene.remove(l));
    state.lines.length = 0;
    state.segmentMap.clear();
    state.vertexMap.clear();
    state.totalLength = 0;

    App3D.setInputs(0, 0, 0);

    state.history.forEach((h) => {
      App3D.setInputs(h.from.x, h.from.y, h.from.z);
      App3D.drawLine(
        h.to.x - h.from.x,
        h.to.y - h.from.y,
        h.to.z - h.from.z,
        h.axis,
        { recordHistory: false }
      );
    });
  };

  App3D.undoLast = function undoLast() {
    if (state.history.length === 0) return;
    state.history.pop();
    App3D.rebuildFromHistory();
  };

  App3D.clearScene = function clearScene() {
    state.history.length = 0;
    App3D.rebuildFromHistory();
  };

  window.drawLine = App3D.drawLine;
  window.undoLast = App3D.undoLast;
  window.clearScene = App3D.clearScene;
})();

