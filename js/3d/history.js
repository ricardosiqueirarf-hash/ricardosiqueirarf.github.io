window.App3D = window.App3D || {};

(() => {
  const App3D = window.App3D;
  const { state } = App3D;
  const EPS = 1e-6;

  function findLineAtPoint(start, axis) {
    const axisLower = axis.toLowerCase();

    for (const h of state.history) {
      if (h.axis !== axis) continue;

      const from = h.from;
      const to = h.to;
      const minVal = Math.min(from[axisLower], to[axisLower]);
      const maxVal = Math.max(from[axisLower], to[axisLower]);
      const pointVal = start[axisLower];

      const onSegment = pointVal >= minVal - EPS && pointVal <= maxVal + EPS;
      if (!onSegment) continue;

      if (axisLower === "x") {
        if (Math.abs(start.y - from.y) > EPS || Math.abs(start.z - from.z) > EPS) continue;
      } else if (axisLower === "y") {
        if (Math.abs(start.x - from.x) > EPS || Math.abs(start.z - from.z) > EPS) continue;
      } else if (axisLower === "z") {
        if (Math.abs(start.x - from.x) > EPS || Math.abs(start.y - from.y) > EPS) continue;
      }

      return { from, to, minVal, maxVal, pointVal, axisLower };
    }

    return null;
  }

  function createLineMesh(start, end) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const model = App3D.lineModel;
    const baseLength = App3D.lineModelLength;

    if (model && baseLength > EPS) {
      const clone = model.clone(true);
      const baseScale = App3D.lineModelScale || new THREE.Vector3(1, 1, 1);
      clone.scale.copy(baseScale);

      const baseRotation = App3D.lineModelRotation;
      const baseQuaternion = new THREE.Quaternion();
      if (baseRotation) {
        baseQuaternion.setFromEuler(baseRotation);
      }

      const alignQuaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize()
      );

      clone.quaternion.copy(baseQuaternion);
      clone.quaternion.multiply(alignQuaternion);

      const lengthScale = length / baseLength;
      if (Number.isFinite(lengthScale) && lengthScale > 0) {
        clone.scale.y *= lengthScale;
      }

      clone.position.copy(start).add(direction.clone().multiplyScalar(0.5));

      return clone;
    }

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
    const { recordHistory = true, allowExistingLineMove = true } = options;
    const { x, y, z, len } = App3D.getInputs();

    const start = new THREE.Vector3(x, y, z);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const axisLower = axis.toLowerCase();
    const directionSign = Math.sign(dir[axisLower]);
    if (allowExistingLineMove) {
      const lineAtPoint = findLineAtPoint(start, axis);
      if (lineAtPoint) {
        const { from, minVal, maxVal, pointVal } = lineAtPoint;
        let targetVal = null;
        if (directionSign > 0 && pointVal < maxVal - EPS) targetVal = maxVal;
        if (directionSign < 0 && pointVal > minVal + EPS) targetVal = minVal;

        if (targetVal !== null) {
          const target = from.clone();
          target[axisLower] = targetVal;
          App3D.setInputs(target.x, target.y, target.z);
        }
        return;
      }
    }
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
        { recordHistory: false, allowExistingLineMove: false }
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


