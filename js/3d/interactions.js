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

    // === MENU DE OPÇÕES ===
    const action = prompt(
      "Você selecionou uma linha. Escolha uma ação:\n" +
      "1 - Alterar eixo\n" +
      "2 - Alterar comprimento da linha\n" +
      "3 - Deletar linha"
    );
    if (action === null) {
      editingAxis = null;
      return; // cancelou
    }

    switch (action) {
      case "1":
        // Alterar eixo da linha (mantendo lógica original)
        const geometry = selectedLine.geometry;
        const currentLen = geometry.parameters.height;

        // Salva direção original
        originalDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(selectedLine.quaternion);

        const inputLen = prompt(`Digite o novo comprimento da linha no eixo ${axis}:`, currentLen.toFixed(2));
        if (inputLen === null) break; // cancelou
        const newLen = parseFloat(inputLen);
        if (isNaN(newLen) || newLen <= 0) return alert("Valor inválido!");
        const diff = newLen - currentLen;

        // Determina o comprimento total do eixo selecionado (espaço ocupado)
        let axisMin = Infinity;
        let axisMax = -Infinity;
        state.history.forEach((h) => {
          if (h.axis === axis) {
            axisMin = Math.min(axisMin, h.from[axis.toLowerCase()], h.to[axis.toLowerCase()]);
            axisMax = Math.max(axisMax, h.from[axis.toLowerCase()], h.to[axis.toLowerCase()]);
          }
        });
        const totalAxisLen = axisMax - axisMin;

        state.history.forEach((h, i) => {
          const line = state.lines[i];
          const dirVec = new THREE.Vector3().subVectors(h.to, h.from).normalize();

          if (h.axis === axis) {
            const fromVal = h.from[axis.toLowerCase()];
            const toVal = h.to[axis.toLowerCase()];

            // Ponto mais distante de 0
            let maxPointVal = Math.abs(fromVal) > Math.abs(toVal) ? fromVal : toVal;
            const sign = Math.sign(maxPointVal);

            // Calcula nova posição proporcional ao comprimento total do eixo
            const newMaxVal = maxPointVal + diff * sign;

            let newFrom = h.from.clone();
            let newTo = h.to.clone();
            if (toVal === maxPointVal) {
              newTo[axis.toLowerCase()] = newMaxVal;
            } else {
              newFrom[axis.toLowerCase()] = newMaxVal;
            }

            // Mantém a espessura original da linha
            const oldGeom = line.geometry.parameters;
            const width = oldGeom.width || 0.08;
            const depth = oldGeom.depth || 0.08;
            const height = newFrom.distanceTo(newTo);

            line.geometry.dispose();
            line.geometry = new THREE.BoxGeometry(width, height, depth);
            line.position.copy(newFrom.clone().add(newTo).multiplyScalar(0.5));
            line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec);

            h.from.copy(newFrom);
            h.to.copy(newTo);
          } else {
            // Linhas de outros eixos: deslocamento sempre em direção a 0
            if (h.from[axis.toLowerCase()] !== 0 || h.to[axis.toLowerCase()] !== 0) {
              const moveVec = new THREE.Vector3(0, 0, 0);
              moveVec[axis.toLowerCase()] = diff;
              h.from.add(moveVec);
              h.to.add(moveVec);
            }

            const center = h.from.clone().add(h.to).multiplyScalar(0.5);
            const direction = new THREE.Vector3().subVectors(h.to, h.from);

            // Mantém a espessura original da linha
            const oldGeom = line.geometry.parameters;
            const width = oldGeom.width || 0.08;
            const depth = oldGeom.depth || 0.08;
            const height = direction.length();

            line.geometry.dispose();
            line.geometry = new THREE.BoxGeometry(width, height, depth);
            line.position.copy(center);
            line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
          }
        });

        // Atualiza ponto atual
        const inputs = App3D.getInputs();
        const moveVector = originalDirection.clone().normalize().multiplyScalar(diff);
        const newPoint = new THREE.Vector3(inputs.x, inputs.y, inputs.z).add(moveVector);
        App3D.setInputs(newPoint.x, newPoint.y, newPoint.z);

        App3D.updateMetrics();
        refreshTotals();
        break;

      case "2":
        editSelectedLine(selectedLine, index);
        refreshTotals();
        break;

      case "3":
        // Deletar linha
        if (confirm("Tem certeza que deseja deletar esta linha?")) {
          state.history.splice(index, 1); // remove do histórico
          App3D.scene.remove(selectedLine); // remove do 3D
          state.lines.splice(index, 1); // remove do array de linhas
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

    // Pergunta pelo novo comprimento
    const oldGeom = selectedLine.geometry.parameters;
    const width = oldGeom.width || 0.08; // mantém largura original
    const depth = oldGeom.depth || 0.08; // mantém profundidade original
    const currentLen = oldGeom.height || 1; // comprimento atual
    const inputLen = prompt(`Digite o novo comprimento da linha no eixo ${axis}:`, currentLen.toFixed(2));
    if (inputLen === null) return; // cancelou
    const newLen = parseFloat(inputLen);
    if (isNaN(newLen) || newLen <= 0) return alert("Valor inválido!");
    const diff = newLen - currentLen;

    // Salva direção original da linha
    const originalDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(selectedLine.quaternion);

    // Ponto mais distante de 0 no eixo selecionado
    const axisLower = axis.toLowerCase();
    const fromVal = h.from[axisLower];
    const toVal = h.to[axisLower];
    let maxPointVal = Math.abs(fromVal) > Math.abs(toVal) ? fromVal : toVal;
    const sign = Math.sign(maxPointVal);
    const newPos = maxPointVal + diff * sign;

    let newFrom = h.from.clone();
    let newTo = h.to.clone();
    if (toVal === maxPointVal) {
      newTo[axisLower] = newPos;
    } else {
      newFrom[axisLower] = newPos;
    }

    // Atualiza geometria e posição mantendo a espessura original
    const height = newFrom.distanceTo(newTo);
    selectedLine.geometry.dispose();
    selectedLine.geometry = new THREE.BoxGeometry(width, height, depth);
    selectedLine.position.copy(newFrom.clone().add(newTo).multiplyScalar(0.5));
    selectedLine.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(newTo, newFrom).normalize()
    );

    // Atualiza histórico
    h.from.copy(newFrom);
    h.to.copy(newTo);

    // Atualiza ponto atual na direção da linha
    const inputs = App3D.getInputs();
    const moveVector = originalDirection.clone().normalize().multiplyScalar(diff);
    const newPoint = new THREE.Vector3(inputs.x, inputs.y, inputs.z).add(moveVector);
    App3D.setInputs(newPoint.x, newPoint.y, newPoint.z);

    // Recalcula totalLength e fixadores
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

    if (intersects.length === 0) return; // Nenhuma linha clicada

    const clickedLine = intersects[0].object;
    const index = state.lines.indexOf(clickedLine);
    if (index === -1) return;

    const h = state.history[index];
    const axis = h.axis;
    const axisLower = axis.toLowerCase();

    // Valores mínimo e máximo da linha no eixo
    const minVal = Math.min(h.from[axisLower], h.to[axisLower]);
    const maxVal = Math.max(h.from[axisLower], h.to[axisLower]);

    // Pergunta onde posicionar o ponto atual
    const input = prompt(`Linha eixo ${axis} de ${minVal.toFixed(2)} -> ${maxVal.toFixed(2)}\nDigite a posição desejada:`);
    if (input === null) return; // Cancelou
    let newVal = parseFloat(input);
    if (isNaN(newVal) || newVal < minVal || newVal > maxVal) {
      return alert(`Valor inválido! Deve estar entre ${minVal.toFixed(2)} e ${maxVal.toFixed(2)}.`);
    }

    // Mantém os outros eixos iguais ao ponto inicial da linha
    let newX = h.from.x;
    let newY = h.from.y;
    let newZ = h.from.z;

    if (axisLower === "x") newX = newVal;
    else if (axisLower === "y") newY = newVal;
    else if (axisLower === "z") newZ = newVal;

    // Atualiza ponto atual
    App3D.setInputs(newX, newY, newZ);
  });

  /* ... bloco de preview comentado ... */
})();


