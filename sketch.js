let canvasSize = 320; // Default canvas size
let squareSize = canvasSize / 3; // Central square size
let nodes = [];
let connections = [];
let symmetryMode = "rotation_reflection";

function setup() {
  const canvas = createCanvas(canvasSize, canvasSize);
  canvas.parent("canvas-container");

  // Canvas size slider
  const canvasSizeSlider = select("#canvas-size-slider");
  canvasSizeSlider.input(() => {
    canvasSize = canvasSizeSlider.value();
    resizeCanvas(canvasSize, canvasSize);
    squareSize = canvasSize / 3; // Update square size
    setupNodes(); // Recalculate nodes
    redraw();
  });

  // Node count slider
  const nodeSlider = select("#node-slider");
  nodeSlider.input(() => {
    setupNodes();
    redraw();
  });

  // Symmetry dropdown
  const symmetryDropdown = select("#symmetry-dropdown");
  symmetryDropdown.changed(() => {
    symmetryMode = symmetryDropdown.value() === "rotation" ? "rotation" : "rotation_reflection";
    redraw();
  });

  // Clear button
  const clearButton = select("#clear-button");
  clearButton.mousePressed(() => {
    connections = [];
    redraw();
  });

  // Back button
  const backButton = select("#back-button");
  backButton.mousePressed(() => {
    connections.pop();
    redraw();
  });

  setupNodes();
  noLoop();
}

function draw() {
  background(255);

  // Draw tessellation
  drawTessellation();

  // Draw nodes
  drawNodes();
}

function setupNodes() {
  nodes = [];
  const nodeCount = select("#node-slider").value();
  const step = squareSize / (nodeCount - 1);
  let idCounter = 1;

  for (let i = 0; i < nodeCount; i++) {
    for (let j = 0; j < nodeCount; j++) {
      nodes.push({
        x: width / 2 - squareSize / 2 + i * step,
        y: height / 2 - squareSize / 2 + j * step,
        id: idCounter++,
      });
    }
  }
}

function drawTessellation() {
  const tileCount = 2; // Fixed: 2 tiles around the center (5x5 grid total)
  const tileSize = squareSize;

  for (let i = -tileCount; i <= tileCount; i++) {
    for (let j = -tileCount; j <= tileCount; j++) {
      const offsetX = i * tileSize;
      const offsetY = j * tileSize;

      push();
      translate(offsetX, offsetY);
      drawConnections(); // Draw tessellated connections
      pop();
    }
  }
}

function drawNodes() {
  nodes.forEach((node) => {
    fill(0);
    noStroke();
    ellipse(node.x, node.y, 8, 8);
  });
}

function drawConnections() {
  connections.forEach(([startId, endId]) => {
    if (!startId || !endId) return;

    const startNode = nodes[startId - 1];
    const endNode = nodes[endId - 1];

    if (!startNode || !endNode) return;

    // Draw original connection
    stroke(0);
    strokeWeight(2);
    line(startNode.x, startNode.y, endNode.x, endNode.y);

    if (symmetryMode === "rotation_reflection") {
      // Reflect across horizontal axis
      const hStart = getHorizontalMirrorNode(startNode);
      const hEnd = getHorizontalMirrorNode(endNode);
      line(hStart.x, hStart.y, hEnd.x, hEnd.y);

      // Reflect across vertical axis
      const vStart = getVerticalMirrorNode(startNode);
      const vEnd = getVerticalMirrorNode(endNode);
      line(vStart.x, vStart.y, vEnd.x, vEnd.y);

      // Reflect across both axes (point reflection)
      const pStart = getPointMirrorNode(startNode);
      const pEnd = getPointMirrorNode(endNode);
      line(pStart.x, pStart.y, pEnd.x, pEnd.y);

      // Rotate original and reflected connections
      [90, 180, 270].forEach((angle) => {
        drawRotatedConnection(startNode, endNode, angle);
        drawRotatedConnection(hStart, hEnd, angle);
        drawRotatedConnection(vStart, vEnd, angle);
        drawRotatedConnection(pStart, pEnd, angle);
      });
    }

    if (symmetryMode === "rotation") {
      // Rotate original connection
      [90, 180, 270].forEach((angle) => {
        drawRotatedConnection(startNode, endNode, angle);
      });
    }
  });
}

function getHorizontalMirrorNode(node) {
  const centerY = height / 2;
  return { x: node.x, y: centerY - (node.y - centerY) };
}

function getVerticalMirrorNode(node) {
  const centerX = width / 2;
  return { x: centerX - (node.x - centerX), y: node.y };
}

function getPointMirrorNode(node) {
  const centerX = width / 2;
  const centerY = height / 2;
  return { x: centerX - (node.x - centerX), y: centerY - (node.y - centerY) };
}

function getRotatedNode(node, angle) {
  const centerX = width / 2;
  const centerY = height / 2;
  const rad = radians(angle);
  const dx = node.x - centerX;
  const dy = node.y - centerY;
  return { x: centerX + dx * cos(rad) - dy * sin(rad), y: centerY + dx * sin(rad) + dy * cos(rad) };
}

function drawRotatedConnection(startNode, endNode, angle) {
  const rotatedStart = getRotatedNode(startNode, angle);
  const rotatedEnd = getRotatedNode(endNode, angle);
  line(rotatedStart.x, rotatedStart.y, rotatedEnd.x, rotatedEnd.y);
}

function mousePressed() {
  let clickedNode = null;

  nodes.forEach((node, index) => {
    if (dist(mouseX, mouseY, node.x, node.y) < 10) {
      clickedNode = index + 1;
    }
  });

  if (clickedNode) handleNodeClick(clickedNode);
}

function handleNodeClick(nodeId) {
  if (connections.length && connections[connections.length - 1].length === 1) {
    connections[connections.length - 1].push(nodeId);
  } else {
    connections.push([nodeId]);
  }
  redraw();
}
