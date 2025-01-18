let canvasWidth = 320; // Default canvas width
let canvasHeight = canvasWidth * Math.sqrt(3) / 2; // Adjust for root 3 proportion
let triangleBase, triangleHeight;
let nodes = [];
let connections = [];
let nodeCount = 3; // Default subdivisions
let triangleDivisor = 5; // Default size divisor

function setup() {
  createCanvas(canvasWidth, canvasHeight);
  noLoop();

  const triangleSizeSlider = createSlider(1, 9, triangleDivisor, 2);
  triangleSizeSlider.position(10, canvasHeight + 10);
  triangleSizeSlider.input(() => {
    triangleDivisor = triangleSizeSlider.value();
    updateTriangleSize();
    setupNodes();
    redraw();
  });

  const nodeSlider = createSlider(3, 15, nodeCount, 1);
  nodeSlider.position(10, canvasHeight + 40);
  nodeSlider.input(() => {
    nodeCount = nodeSlider.value();
    setupNodes();
    redraw();
  });

  updateTriangleSize();
  setupNodes();
}

function draw() {
  background(255);

  drawTessellation();
  drawNodes();
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

  // Generate nodes toward the center
  for (let i = 0; i < nodeCount; i++) {
    const t = i / (nodeCount - 1);
    for (let j = 0; j <= i; j++) {
      const s = j / i || 0; // Avoid NaN for i = 0
      const x = (1 - t) * topVertex.x + t * (1 - s) * bottomLeft.x + t * s * bottomRight.x;
      const y = (1 - t) * topVertex.y + t * (1 - s) * bottomLeft.y + t * s * bottomRight.y;
      nodes.push({ x, y });
    }
  }

  console.log("Nodes initialized:", nodes);
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
  stroke(0);
  fill(0);
  nodes.forEach((node, index) => {
    ellipse(node.x, node.y, 6, 6);
    console.log(`Node ${index} at (${node.x}, ${node.y})`);
  });
}

function drawConnections() {
  connections.forEach(([startId, endId]) => {
    if (!startId || !endId) return;

    const startNode = nodes[startId - 1];
    const endNode = nodes[endId - 1];

    if (!startNode || !endNode) return;

    line(startNode.x, startNode.y, endNode.x, endNode.y);
  });
}

function mousePressed() {
  let clickedNode = null;

  nodes.forEach((node, index) => {
    if (dist(mouseX, mouseY, node.x, node.y) < 10) {
      clickedNode = index + 1;
    }
  });

  if (clickedNode) {
    handleNodeClick(clickedNode);
  } else {
    console.log("No node clicked.");
  }

  redraw();
}

function handleNodeClick(nodeId) {
  if (connections.length && connections[connections.length - 1].length === 1) {
    connections[connections.length - 1].push(nodeId);
    console.log("Connection completed:", connections[connections.length - 1]);
  } else {
    connections.push([nodeId]);
    console.log("New connection started:", connections[connections.length - 1]);
  }
}
