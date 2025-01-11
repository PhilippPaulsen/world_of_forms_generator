let canvasSize = 320; // Default canvas size
let squareSize = canvasSize / 5; // Default central square size divisor
let squareSizeDivisor = 5; // Default divisor
let nodes = [];
let connections = [];
let symmetryMode = "rotation_reflection";
let showNodes = true;
let lineColor = "#000000"; // Default line color
let curveOffset = 30; // Default curve offset

function setup() {
  const canvas = createCanvas(canvasSize, canvasSize);
  canvas.parent("canvas-container");

  // Canvas size slider
  const canvasSizeSlider = select("#canvas-size-slider");
  canvasSizeSlider.input(() => {
    canvasSize = canvasSizeSlider.value();
    resizeCanvas(canvasSize, canvasSize);
    updateSquareSize(); // Recalculate square size
    setupNodes(); // Recalculate nodes
    redraw();
  });

  // Node count slider
  const nodeSlider = select("#node-slider");
  nodeSlider.input(() => {
    setupNodes();
    redraw();
  });

  // Curve offset slider
  const curveSlider = select("#curve-slider");
  curveSlider.input(() => {
    curveOffset = curveSlider.value(); // Dynamically update curve offset
    redraw();
  });

  // Square size slider
  const squareSizeSlider = select("#square-size-slider");
  squareSizeSlider.input(() => {
    squareSizeDivisor = squareSizeSlider.value();
    updateSquareSize();
    setupNodes(); // Recalculate nodes
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

  // Undo button (renamed from "Back")
  const undoButton = select("#back-button");
  undoButton.html("Undo");
  undoButton.mousePressed(() => {
    connections.pop();
    redraw();
  });

  // Random button
  const randomButton = select("#random-button");
  randomButton.mousePressed(() => {
    const randomStart = Math.floor(random(nodes.length)) + 1;
    const randomEnd = Math.floor(random(nodes.length)) + 1;
    if (randomStart !== randomEnd) {
      connections.push([randomStart, randomEnd]);
    }
    redraw();
  });

  // Line color picker
  const lineColorPicker = select("#line-color-picker");
  lineColorPicker.input(() => {
    lineColor = lineColorPicker.value();
    redraw();
  });

  // Node toggle checkbox
  const toggleNodes = select("#toggle-nodes");
  toggleNodes.changed(() => {
    showNodes = toggleNodes.checked();
    redraw();
  });

  setupNodes();
  noLoop();
}

function updateSquareSize() {
  squareSize = canvasSize / squareSizeDivisor; // Update central square size
}

function draw() {
  background(255);

  // Draw black border around canvas
  stroke(0); // Border color
  strokeWeight(2); // Border thickness
  noFill();
  rect(1, 1, width - 2, height - 2); // Border rectangle

  // Draw tessellation
  drawTessellation();

  // Draw nodes if toggled on
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
  const tilesNeeded = Math.ceil(canvasSize / squareSize);
  const tileCount = Math.max(2, Math.ceil(tilesNeeded / 2)); // Ensure at least 2 tiles around center

  for (let i = -tileCount; i <= tileCount; i++) {
    for (let j = -tileCount; j <= tileCount; j++) {
      const offsetX = i * squareSize;
      const offsetY = j * squareSize;

      push();
      translate(offsetX, offsetY);
      drawConnections(); // Draw tessellated connections
      pop();
    }
  }
}

function drawNodes() {
  if (!showNodes) return; // Skip if nodes are hidden
  nodes.forEach((node) => {
    fill(0);
    noStroke();
    ellipse(node.x, node.y, 8, 8);
  });
}

function drawConnections() {
  connections.forEach(([startId, endId]) => {
    if (!startId || !endId) return; // Skip invalid connections

    const startNode = nodes[startId - 1];
    const endNode = nodes[endId - 1];

    if (!startNode || !endNode) return; // Skip if nodes are missing

    // Calculate control points: Perpendicular offset
    const { controlX, controlY } = calculateControlPoints(startNode, endNode);

    // Original curve
    stroke(lineColor);
    strokeWeight(2);
    noFill();
    bezier(startNode.x, startNode.y, controlX, controlY, controlX, controlY, endNode.x, endNode.y);

    if (symmetryMode === "rotation_reflection") {
      drawSymmetricalCurves(startNode, endNode, controlX, controlY);
    }

    if (symmetryMode === "rotation") {
      [90, 180, 270].forEach((angle) => {
        drawRotatedBezier(startNode, endNode, controlX, controlY, angle);
      });
    }
  });
}

function calculateControlPoints(startNode, endNode) {
  const midX = (startNode.x + endNode.x) / 2;
  const midY = (startNode.y + endNode.y) / 2;
  const dx = endNode.x - startNode.x;
  const dy = endNode.y - startNode.y;
  const length = dist(startNode.x, startNode.y, endNode.x, endNode.y);

  return {
    controlX: midX - (dy / length) * curveOffset, // Perpendicular offset
    controlY: midY + (dx / length) * curveOffset, // Perpendicular offset
  };
}

function drawSymmetricalCurves(startNode, endNode, cx, cy) {
  const transformations = [
    getHorizontalMirrorNode,
    getVerticalMirrorNode,
    getPointMirrorNode,
  ];

  transformations.forEach((transform) => {
    const transformedStart = transform(startNode);
    const transformedEnd = transform(endNode);
    const transformedControl = transform({ x: cx, y: cy });
    bezier(
      transformedStart.x,
      transformedStart.y,
      transformedControl.x,
      transformedControl.y,
      transformedControl.x,
      transformedControl.y,
      transformedEnd.x,
      transformedEnd.y
    );

    [90, 180, 270].forEach((angle) => {
      const rotatedStart = getRotatedNode(transformedStart, angle);
      const rotatedEnd = getRotatedNode(transformedEnd, angle);
      const rotatedControl = getRotatedNode(transformedControl, angle);
      bezier(
        rotatedStart.x,
        rotatedStart.y,
        rotatedControl.x,
        rotatedControl.y,
        rotatedControl.x,
        rotatedControl.y,
        rotatedEnd.x,
        rotatedEnd.y
      );
    });
  });
}

function drawRotatedBezier(startNode, endNode, cx, cy, angle) {
  const rotatedStart = getRotatedNode(startNode, angle);
  const rotatedEnd = getRotatedNode(endNode, angle);
  const rotatedControl = getRotatedNode({ x: cx, y: cy }, angle);

  bezier(
    rotatedStart.x,
    rotatedStart.y,
    rotatedControl.x,
    rotatedControl.y,
    rotatedControl.x,
    rotatedControl.y,
    rotatedEnd.x,
    rotatedEnd.y
  );
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
  return {
    x: centerX + dx * cos(rad) - dy * sin(rad),
    y: centerY + dx * sin(rad) + dy * cos(rad),
  };
}

function handleNodeClick(nodeId) {
  if (connections.length && connections[connections.length - 1].length === 1) {
    connections[connections.length - 1].push(nodeId);
  } else {
    connections.push([nodeId]);
  }
  redraw();
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