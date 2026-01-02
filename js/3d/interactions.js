window.App3D = window.App3D || {};

(() => {
  const App3D = window.App3D;
  const { state } = App3D;

  function handleDirectionKey(event) {
    const key = event.key.toLowerCase();
    if (key === "s") {
      event.preventDefault();
      App3D.drawLine(0, 0, 1, "Z"); // frente
      return;
    }
    if (key === "w") {
      event.preventDefault();
      App3D.drawLine(0, 0, -1, "Z"); // trás
      return;
    }
    if (key === "arrowup") {
      event.preventDefault();
      App3D.drawLine(0, 1, 0, "Y"); // cima
      return;
    }
    if (key === "arrowdown") {
      event.preventDefault();
      App3D.drawLine(0, -1, 0, "Y"); // baixo
      return;
    }
    if (key === "arrowright") {
      event.preventDefault();
      App3D.drawLine(1, 0, 0, "X"); // direita
      return;
    }
    if (key === "arrowleft") {
      event.preventDefault();
      App3D.drawLine(-1, 0, 0, "X"); // esquerda
    }
  }

  document.addEventListener("keydown", handleDirectionKey, true);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let selectedLine = null;
  let originalDirection = null;
  let editingAxis = null;

  // helpers
  const EPS = 1e-6;
  const samePoint = (a, b) => a.distanceTo(b) < EPS;

  App3D.renderer.domElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const rect = App3D.renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, App3D.camera);
    const intersects = raycaster.intersectObjects(state.lines);
    if (intersects.length === 0) return;

    selectedLine = intersects[0].object;
    const index = state.lines.indexOf(selectedLine);
    if (index === -1) return;

    const axis = state.history[index].axis;
    editingAxis = axis;

    const action = prompt(
      "Você selecionou uma linha. Escolha uma ação:\n" +
      "1 - Alterar eixo\n" +
      "2 - Alterar comprimento da linha\n" +
      "3 - Deletar linha"
    );
    if (action === null) {
      editingAxis = null;
      return;
    }

    switch (action) {
      case "1": {
        // =======================
        // ALTERAR COMPRIMENTO NO EIXO (com deslocamento correto das linhas conectadas)
        // =======================
        const geometry = selectedLine.geometry;
        const currentLen = geometry.parameters.height;

        // direção da linha selecionada (pra mover o ponto atual)
        originalDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(selectedLine.quaternion);

        const inputLen = prompt(
          `Digite o novo comprimento da linha no eixo ${axis}:`,
          currentLen.toFixed(2)
        );
        if (inputLen === null) break;
        const newLen = parseFloat(inputLen);
        if (isNaN(newLen) || newLen <= 0) return alert("Valor inválido!");

        const diff = newLen - currentLen; // pode ser + ou -
        const axisLower = axis.toLowerCase();

        // 1) Primeiro, calcula TODOS os "pontos movidos" das linhas do eixo selecionado:
        //    - qual endpoint era o mais distante de 0 no eixo
        //    - quanto ele vai andar (delta = diff * sign)
        //    - isso cria um "mapa" para arrastar as linhas conectadas naquele endpoint
        const movedPoints = []; // [{ oldPoint: Vector3, deltaVec: Vector3 }]

        state.history.forEach((h) => {
          if (h.axis !== axis) return;

          const fromVal = h.from[axisLower];
          const toVal = h.to[axisLower];

          // endpoint mais distante de 0 no eixo
          const maxPointVal = Math.abs(fromVal) > Math.abs(toVal) ? fromVal : toVal;

          // se maxPointVal for 0 (linha em cima do zero), não tem pra onde "esticar"
          const sign = Math.sign(maxPointVal) || 1;

          // quanto o endpoint distante vai mudar (isso é o "deslocamento real" no eixo)
          const delta = diff * sign; // <- aqui está a lógica correta (+ aumenta, - reduz)
          const deltaVec = new THREE.Vector3(0, 0, 0);
          deltaVec[axisLower] = delta;

          // qual endpoint é o "moved" nessa linha
          const oldMovedPoint = (toVal === maxPointVal) ? h.to.clone() : h.from.clone();

          movedPoints.push({ oldPoint: oldMovedPoint, deltaVec });
        });

        // 2) Agora percorre TODAS as linhas:
        //    - se for do eixo escolhido: atualiza comprimento (movendo o endpoint distante)
        //    - se for de outros eixos: se algum endpoint coincide com um oldPoint, arrasta ele pelo deltaVec
        state.history.forEach((h, i) => {
          const line = state.lines[i];

          if (h.axis === axis) {
            const fromVal = h.from[axisLower];
            const toVal = h.to[axisLower];

            const maxPointVal = Math.abs(fromVal) > Math.abs(toVal) ? fromVal : toVal;
            const sign = Math.sign(maxPointVal) || 1;
            const newMaxVal = maxPointVal + diff * sign; // <- aumenta/diminui corretamente

            const newFrom = h.from.clone();
            const newTo = h.to.clone();

            // move só o endpoint mais distante
            if (toVal === maxPointVal) newTo[axisLower] = newMaxVal;
            else newFrom[axisLower] = newMaxVal;

            // atualiza mesh mantendo espessura
            const oldGeom = line.geometry.parameters;
            const width = oldGeom.width || 0.08;
            const depth = oldGeom.depth || 0.08;

            const dirVec = new THREE.Vector3().subVectors(newTo, newFrom).normalize();
            const height = newFrom.distanceTo(newTo);

            line.geometry.dispose();
            line.geometry = new THREE.BoxGeometry(width, height, depth);
            line.position.copy(newFrom.clone().add(newTo).multiplyScalar(0.5));
            line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec);

            h.from.copy(newFrom);
            h.to.copy(newTo);
            return;
          }

          // === OUTROS EIXOS: arrasta apenas SE estiver conectado no endpoint que se moveu ===
          const newFrom = h.from.clone();
          const newTo = h.to.clone();

          for (const mp of movedPoints) {
            if (samePoint(newFrom, mp.oldPoint)) newFrom.add(mp.deltaVec);
            if (samePoint(newTo, mp.oldPoint)) newTo.add(mp.deltaVec);
          }

          // se não mudou nada, não recria geometria
          const changed = !samePoint(newFrom, h.from) || !samePoint(newTo, h.to);
          if (!changed) return;

          // atualiza histórico
          h.from.copy(newFrom);
          h.to.copy(newTo);

          // atualiza mesh mantendo espessura
          const center = newFrom.clone().add(newTo).multiplyScalar(0.5);
          const direction = new THREE.Vector3().subVectors(newTo, newFrom);

          const oldGeom = line.geometry.parameters;
          const width = oldGeom.width || 0.08;
          const depth = oldGeom.depth || 0.08;
          const height = direction.length();

          line.geometry.dispose();
          line.geometry = new THREE.BoxGeometry(width, height, depth);
          line.position.copy(center);
          line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        });

        // 3) Atualiza ponto atual (cursor) na direção original da linha selecionada
        const inputs = App3D.getInputs();
        const moveVector = originalDirection.clone().normalize().multiplyScalar(diff);
        const newPoint = new THREE.Vector3(inputs.x, inputs.y, inputs.z).add(moveVector);
        App3D.setInputs(newPoint.x, newPoint.y, newPoint.z);

        App3D.updateMetrics();
        refreshTotals();
        break;
      }

      case "2":
        editSelectedLine(selectedLine, index);
        refreshTotals();
        break;

      case "3":
        if (confirm("Tem certeza que deseja deletar esta linha?")) {
          state.history.splice(index, 1);
          App3D.scene.remove(selectedLine);
          state.lines.splice(index, 1);
          App3D.updateMetrics();
          refreshTotals();
        }
        break;

      default:
        alert("Opção inválida!");
    }

    editingAxis = null;
  });

  // ===================== CONTROLE DE CÂMERA (ARRASTAR + SCROLL) =====================
  const cameraState = {
    isDragging: false,
    lastX: 0,
    lastY: 0,
    yaw: Math.PI / 4,
    pitch: Math.PI / 6,
    radius: App3D.camera.position.length()
  };

  function updateCameraPosition() {
    const maxPitch = Math.PI / 2 - 0.05;
    const minPitch = -maxPitch;
    cameraState.pitch = Math.max(minPitch, Math.min(maxPitch, cameraState.pitch));

    const x = cameraState.radius * Math.cos(cameraState.pitch) * Math.cos(cameraState.yaw);
    const y = cameraState.radius * Math.sin(cameraState.pitch);
    const z = cameraState.radius * Math.cos(cameraState.pitch) * Math.sin(cameraState.yaw);

    App3D.camera.position.set(x, y, z);
    App3D.camera.lookAt(0, 0, 0);
  }

  updateCameraPosition();

  App3D.renderer.domElement.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    cameraState.isDragging = true;
    cameraState.lastX = event.clientX;
    cameraState.lastY = event.clientY;
  });

  window.addEventListener("mouseup", () => {
    cameraState.isDragging = false;
  });

  window.addEventListener("mousemove", (event) => {
    if (!cameraState.isDragging) return;
    const deltaX = event.clientX - cameraState.lastX;
    const deltaY = event.clientY - cameraState.lastY;
    cameraState.lastX = event.clientX;
    cameraState.lastY = event.clientY;

    const sensitivity = 0.005;
    cameraState.yaw += deltaX * sensitivity;
    cameraState.pitch += deltaY * sensitivity;
    updateCameraPosition();
  });

  App3D.renderer.domElement.addEventListener("wheel", (event) => {
    event.preventDefault();
    const zoomFactor = 1 + event.deltaY * 0.001;
    cameraState.radius = Math.max(50, Math.min(5000, cameraState.radius * zoomFactor));
    updateCameraPosition();
  }, { passive: false });

  // ===================== FUNÇÃO PARA ALTERAR COMPRIMENTO DA LINHA =====================
  function editSelectedLine(selectedLine, index) {
    const h = state.history[index];
    const axis = h.axis;

    const oldGeom = selectedLine.geometry.parameters;
    const width = oldGeom.width || 0.08;
    const depth = oldGeom.depth || 0.08;
    const currentLen = oldGeom.height || 1;

    const inputLen = prompt(`Digite o novo comprimento da linha no eixo ${axis}:`, currentLen.toFixed(2));
    if (inputLen === null) return;
    const newLen = parseFloat(inputLen);
    if (isNaN(newLen) || newLen <= 0) return alert("Valor inválido!");
    const diff = newLen - currentLen;

    const originalDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(selectedLine.quaternion);

    const axisLower = axis.toLowerCase();
    const fromVal = h.from[axisLower];
    const toVal = h.to[axisLower];
    const maxPointVal = Math.abs(fromVal) > Math.abs(toVal) ? fromVal : toVal;
    const sign = Math.sign(maxPointVal) || 1;
    const newPos = maxPointVal + diff * sign;

    const newFrom = h.from.clone();
    const newTo = h.to.clone();
    if (toVal === maxPointVal) newTo[axisLower] = newPos;
    else newFrom[axisLower] = newPos;

    const height = newFrom.distanceTo(newTo);
    selectedLine.geometry.dispose();
    selectedLine.geometry = new THREE.BoxGeometry(width, height, depth);
    selectedLine.position.copy(newFrom.clone().add(newTo).multiplyScalar(0.5));
    selectedLine.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(newTo, newFrom).normalize()
    );

    h.from.copy(newFrom);
    h.to.copy(newTo);

    const inputs = App3D.getInputs();
    const moveVector = originalDirection.clone().normalize().multiplyScalar(diff);
    const newPoint = new THREE.Vector3(inputs.x, inputs.y, inputs.z).add(moveVector);
    App3D.setInputs(newPoint.x, newPoint.y, newPoint.z);

    state.totalLength = 0;
    state.vertexMap.clear();
    state.history.forEach((lineHistory) => {
      state.totalLength += lineHistory.from.distanceTo(lineHistory.to);
      App3D.registerVertex(lineHistory.from, lineHistory.axis);
      App3D.registerVertex(lineHistory.to, lineHistory.axis);
    });

    App3D.updateMetrics();
  }

  // ===================== CLIQUE PARA MOVER O PONTO ATUAL NA LINHA =====================
  App3D.renderer.domElement.addEventListener("click", (event) => {
    const rect = App3D.renderer.domElement.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycasterClick = new THREE.Raycaster();
    raycasterClick.setFromCamera({ x: mouseX, y: mouseY }, App3D.camera);
    const intersects = raycasterClick.intersectObjects(state.lines);

    if (intersects.length === 0) return;

    const clickedLine = intersects[0].object;
    const index = state.lines.indexOf(clickedLine);
    if (index === -1) return;

    const h = state.history[index];
    const axis = h.axis;
    const axisLower = axis.toLowerCase();

    const minVal = Math.min(h.from[axisLower], h.to[axisLower]);
    const maxVal = Math.max(h.from[axisLower], h.to[axisLower]);

    const input = prompt(
      `Linha eixo ${axis} de ${minVal.toFixed(2)} -> ${maxVal.toFixed(2)}\nDigite a posição desejada:`
    );
    if (input === null) return;
    const newVal = parseFloat(input);
    if (isNaN(newVal) || newVal < minVal || newVal > maxVal) {
      return alert(`Valor inválido! Deve estar entre ${minVal.toFixed(2)} e ${maxVal.toFixed(2)}.`);
    }

    let newX = h.from.x;
    let newY = h.from.y;
    let newZ = h.from.z;

    if (axisLower === "x") newX = newVal;
    else if (axisLower === "y") newY = newVal;
    else if (axisLower === "z") newZ = newVal;

    App3D.setInputs(newX, newY, newZ);
  });

  /* ... bloco de preview comentado ... */
})();



