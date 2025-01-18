let canvasWidth = 320;
let canvasHeight = canvasWidth * Math.sqrt(3) / 2; // Adjust for root 3 proportion
let triangleBase, triangleHeight;
let nodes = [];
let connections = [];
let nodeCount = 3; // Default subdivisions
let triangleDivisor = 5; // Default size divisor
let symmetryMode = "rotation"; // Default symmetry mode
let showNodes = true;
let lineColor = "#000000"; // Default line color

function setup() {
  createCanvas(canvasWidth, canvasHeight);
  noLoop();

  // Triangle Size Slider
  const triangleSizeSlider = createSlider(1, 9, triangleDivisor, 2);
  triangleSizeSlider.position(10, canvasHeight + 10);
  triangleSizeSlider.input(() => {
    triangleDivisor = triangleSizeSlider.value();
    updateTriangleSize();
    setupNodes();
    redraw();
  });

  // Node Slider
  const nodeSlider = createSlider(3, 15, nodeCount, 1);
  nodeSlider.position(10, canvasHeight + 40);
  nodeSlider.input(() => {
    nodeCount = nodeSlider.value();
    setupNodes();
    redraw();
  });

  // Symmetry Dropdown
  const symmetryDropdown = createSelect();
  symmetryDropdown.position(10, canvasHeight + 70);
  symmetryDropdown.option("rotation");
  symmetryDropdown.option("rotation_reflection");
  symmetryDropdown.changed(() => {
    symmetryMode = symmetryDropdown.value();
    redraw();
  });

  updateTriangleSize();
  setupNodes();
}

function draw() {
  background(255);
  drawTessellation();
  if (showNodes) drawNodes();
}

function updateTriangleSize() {
  triangleBase = canvasWidth / triangleDivisor;
  triangleHeight = triangleBase * Math.sqrt(3) / 2;
}

function setupNodes() {
  nodes = [];
  const centerX = width / 2;
  const centerY = height / 2;

  // Define triangle vertices
  const topVertex = { x: centerX, y: centerY - triangleHeight / 2 };
  const bottomLeft = { x: centerX - triangleBase / 2, y: centerY + triangleHeight / 2 };
  const bottomRight = { x: centerX + triangleBase / 2, y: centerY + triangleHeight / 2 };

  // Generate nodes inside the triangle
  let id = 1;
  for (let i = 0; i < nodeCount; i++) {
    const t = i / (nodeCount - 1);
    for (let j = 0; j <= i; j++) {
      const s = j / i || 0;
      const x = (1 - t) * topVertex.x + t * (1 - s) * bottomLeft.x + t * s * bottomRight.x;
      const y = (1 - t) * topVertex.y + t * (1 - s) * bottomLeft.y + t * s * bottomRight.y;
      nodes.push({ id: id++, x, y });
    }
  }
}

function drawTessellation() {
  const cols = Math.ceil(width / triangleBase) + 2;
  const rows = Math.ceil(height / triangleHeight) + 2;

  for (let row = -rows; row < rows; row++) {
    for (let col = -cols; col < cols; col++) {
      const xOffset = col * triangleBase;
      const yOffset = row * triangleHeight;

      // Adjust for alternate rows
      const adjustedXOffset = xOffset + (row % 2 === 0 ? 0 : triangleBase / 2);

      // Draw triangles
      drawTriangleAt(adjustedXOffset, yOffset, false);
      drawTriangleAt(adjustedXOffset, yOffset, true);
    }
  }
}

function drawTriangleAt(xOffset, yOffset, flipped) {
  push();
  translate(xOffset, yOffset);

  if (flipped) {
    scale(-1, 1);
    translate(-triangleBase, 0);
  }

  drawConnections();
  pop();
}

function drawNodes() {
  fill(0);
  noStroke();
  nodes.forEach((node) => {
    ellipse(node.x, node.y, 6, 6);
  });
}

function drawConnections() {
  stroke(lineColor);
  strokeWeight(2);
  connections.forEach(([startId, endId]) => {
    const startNode = nodes.find((node) => node.id === startId);
    const endNode = nodes.find((node) => node.id === endId);

    if (startNode && endNode) {
      // Original connection
      line(startNode.x, startNode.y, endNode.x, endNode.y);

      // Handle symmetry
      if (symmetryMode === "rotation_reflection") {
        drawReflectedConnections(startNode, endNode);
        drawRotatedConnections(startNode, endNode);
      } else if (symmetryMode === "rotation") {
        drawRotatedConnections(startNode, endNode);
      }
    }
  });
}

function drawReflectedConnections(startNode, endNode) {
  // Reflect across the vertical axis
  const verticalStart = reflectVertically(startNode);
  const verticalEnd = reflectVertically(endNode);
  line(verticalStart.x, verticalStart.y, verticalEnd.x, verticalEnd.y);

  // Reflect across the horizontal axis
  const horizontalStart = reflectHorizontally(startNode);
  const horizontalEnd = reflectHorizontally(endNode);
  line(horizontalStart.x, horizontalStart.y, horizontalEnd.x, horizontalEnd.y);

  // Reflect across the diagonal axis (point symmetry)
  const diagonalStart = reflectDiagonally(startNode);
  const diagonalEnd = reflectDiagonally(endNode);
  line(diagonalStart.x, diagonalStart.y, diagonalEnd.x, diagonalEnd.y);
}

function drawRotatedConnections(startNode, endNode) {
  // Rotate 120 degrees and 240 degrees (for equilateral triangles)
  const angles = [120, 240];
  angles.forEach((angle) => {
    const rotatedStart = rotatePoint(startNode, angle);
    const rotatedEnd = rotatePoint(endNode, angle);
    line(rotatedStart.x, rotatedStart.y, rotatedEnd.x, rotatedEnd.y);
  });
}

// Symmetry Transformations

function reflectVertically(node) {
  const centerX = width / 2; // Vertical center of the canvas
  return {
    x: centerX - (node.x - centerX),
    y: node.y,
  };
}

function reflectHorizontally(node) {
  const centerY = height / 2; // Horizontal center of the canvas
  return {
    x: node.x,
    y: centerY - (node.y - centerY),
  };
}

function reflectDiagonally(node) {
  const centerX = width / 2;
  const centerY = height / 2;
  return {
    x: centerX - (node.x - centerX),
    y: centerY - (node.y - centerY),
  };
}

function rotatePoint(node, angle) {
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

function mousePressed() {
  let clickedNode = null;
  nodes.forEach((node) => {
    if (dist(mouseX, mouseY, node.x, node.y) < 10) {
      clickedNode = node.id;
    }
  });

  if (clickedNode) {
    if (connections.length && connections[connections.length - 1].length === 1) {
      connections[connections.length - 1].push(clickedNode);
    } else {
      connections.push([clickedNode]);
    }
    redraw();
  }
}
