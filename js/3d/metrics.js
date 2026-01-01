window.App3D = window.App3D || {};

(() => {
  const App3D = window.App3D;

  const dom = App3D.dom || {};
  dom.fixers = document.getElementById("fixers");
  dom.sizeX = document.getElementById("sizeX");
  dom.sizeY = document.getElementById("sizeY");
  dom.sizeZ = document.getElementById("sizeZ");
  dom.totalLen = document.getElementById("totalLen");
  dom.xInput = document.getElementById("x");
  dom.yInput = document.getElementById("y");
  dom.zInput = document.getElementById("z");
  dom.lenInput = document.getElementById("len");
  App3D.dom = dom;

  const state = {
    lines: [],
    history: [],
    bbox: new THREE.Box3(),
    segmentMap: new Map(),
    totalLength: 0,
    vertexMap: new Map()
  };
  App3D.state = state;

  App3D.vertexKey = function vertexKey(v) {
    return `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
  };

  App3D.segmentKey = function segmentKey(a, b) {
    const p1 = App3D.vertexKey(a);
    const p2 = App3D.vertexKey(b);
    return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
  };

  App3D.segmentLength = function segmentLength(a, b) {
    return a.distanceTo(b);
  };

  App3D.registerVertex = function registerVertex(point, axis) {
    const key = App3D.vertexKey(point);
    if (!state.vertexMap.has(key)) state.vertexMap.set(key, new Set());
    state.vertexMap.get(key).add(axis);
  };

  App3D.calculateFixers = function calculateFixers() {
    let total = 0;
    state.vertexMap.forEach((axes) => {
      if (axes.size >= 2) total += (axes.size - 1);
    });
    dom.fixers.textContent = total;
  };

  App3D.getInputs = function getInputs() {
    return {
      x: parseFloat(dom.xInput.value),
      y: parseFloat(dom.yInput.value),
      z: parseFloat(dom.zInput.value),
      len: parseFloat(dom.lenInput.value)
    };
  };

  App3D.updateCurrentPoint = function updateCurrentPoint() {
    const { x, y, z } = App3D.getInputs();
    App3D.currentPointMesh.position.set(x, y, z);
  };

  App3D.setInputs = function setInputs(x, y, z) {
    dom.xInput.value = x.toFixed(2);
    dom.yInput.value = y.toFixed(2);
    dom.zInput.value = z.toFixed(2);
    App3D.updateCurrentPoint();
  };

  App3D.updateMetrics = function updateMetrics() {
    if (state.lines.length === 0) {
      dom.sizeX.textContent = "0.00";
      dom.sizeY.textContent = "0.00";
      dom.sizeZ.textContent = "0.00";
      dom.totalLen.textContent = "0.00";
      dom.fixers.textContent = "0";
      return;
    }

    state.bbox.makeEmpty();
    state.lines.forEach((l) => state.bbox.expandByObject(l));

    const size = new THREE.Vector3();
    state.bbox.getSize(size);

    dom.sizeX.textContent = size.x.toFixed(2);
    dom.sizeY.textContent = size.y.toFixed(2);
    dom.sizeZ.textContent = size.z.toFixed(2);
    dom.totalLen.textContent = state.totalLength.toFixed(2);

    App3D.calculateFixers();
  };
})();
