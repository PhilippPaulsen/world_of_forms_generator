let canvasWidth = 320;
let canvasHeight = canvasWidth * Math.sqrt(3) / 2; // Adjust for root 3 proportion
let triangleBase, triangleHeight, centroid;
let nodes = [];
let connections = [];
let nodeCount = 3; // Default subdivisions
let triangleDivisor = 5; // Default size divisor
let symmetryMode = "rotation"; // Default symmetry mode
let lineColor = "#000000"; // Default line color

pixelDensity(1); // Avoid high-DPI issues

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
  drawCentralNodes();
}

function updateTriangleSize() {
  triangleBase = canvasWidth / triangleDivisor;
  triangleHeight = triangleBase * Math.sqrt(3) / 2;

  // Calculate the centroid using precise geometry
  const centerX = width / 2;
  const centerY = height / 2;
  const topVertex = { x: centerX, y: centerY - triangleHeight / 2 };
  const bottomLeft = { x: centerX - triangleBase / 2, y: centerY + triangleHeight / 2 };
  const bottomRight = { x: centerX + triangleBase / 2, y: centerY + triangleHeight / 2 };

  centroid = {
    x: (topVertex.x + bottomLeft.x + bottomRight.x) / 3,
    y: (topVertex.y + bottomLeft.y + bottomRight.y) / 3,
  };
}

function setupNodes() {
  nodes = [];
  const centerX = width / 2;
  const centerY = height / 2;

  // Define the main triangle vertices
  const topVertex = { x: centerX, y: centerY - triangleHeight / 2 };
  const bottomLeft = { x: centerX - triangleBase / 2, y: centerY + triangleHeight / 2 };
  const bottomRight = { x: centerX + triangleBase / 2, y: centerY + triangleHeight / 2 };

  // Generate nodes inside the triangle
  let id = 1;
  for (let i = 0; i < nodeCount; i++) {
    const t = i / (nodeCount - 1); // Linear interpolation along triangle height
    for (let j = 0; j <= i; j++) {
      const s = j / i || 0; // Linear interpolation along triangle base
      const x = (1 - t) * topVertex.x + t * (1 - s) * bottomLeft.x + t * s * bottomRight.x;
      const y = (1 - t) * topVertex.y + t * (1 - s) * bottomLeft.y + t * s * bottomRight.y;
      nodes.push({ id: id++, x, y });
    }
  }
}

function drawTessellation() {
  const cols = Math.ceil(width / triangleBase) + 2; // Number of columns
  const rows = Math.ceil(height / triangleHeight) * 2; // Double rows for half-height offset

  for (let row = -rows; row < rows; row++) {
    for (let col = -cols; col < cols; col++) {
      const xOffset = col * triangleBase; // Horizontal offset
      const yOffset = row * (triangleHeight / 2); // Fine-tune adjustment

      // Alternate row alignment
      const isFlipped = row % 2 !== 0;
      const adjustedXOffset = xOffset + (isFlipped ? triangleBase / 2 : 0);

      // Adjust for potential floating-point inaccuracies
      const preciseXOffset = Math.round(adjustedXOffset);
      const preciseYOffset = Math.round(yOffset);

      // Draw triangles
      drawTriangleAt(preciseXOffset, preciseYOffset, isFlipped);
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

  drawConnections(flipped);
  pop();
}

function drawCentralNodes() {
  // Draw centroid
  fill(255, 0, 0);
  noStroke();
  ellipse(centroid.x, centroid.y, 10, 10);

  // Draw the main triangle
  stroke(0);
  noFill();
  const centerX = width / 2;
  const centerY = height / 2;
  const topVertex = { x: centerX, y: centerY - triangleHeight / 2 };
  const bottomLeft = { x: centerX - triangleBase / 2, y: centerY + triangleHeight / 2 };
  const bottomRight = { x: centerX + triangleBase / 2, y: centerY + triangleHeight / 2 };

  beginShape();
  vertex(topVertex.x, topVertex.y);
  vertex(bottomLeft.x, bottomLeft.y);
  vertex(bottomRight.x, bottomRight.y);
  vertex(topVertex.x, topVertex.y);
  endShape();

  // Draw nodes
  fill(0);
  noStroke();
  nodes.forEach((node) => {
    ellipse(node.x, node.y, 6, 6);
  });
}

function drawConnections(flipped) {
  stroke(lineColor);
  strokeWeight(2);
  connections.forEach(([startId, endId]) => {
    const startNode = nodes.find((node) => node.id === startId);
    const endNode = nodes.find((node) => node.id === endId);

    if (startNode && endNode) {
      let transformedStart = { ...startNode };
      let transformedEnd = { ...endNode };

      // Flip the connections for flipped triangles
      if (flipped) {
        transformedStart = rotatePointAroundBase(startNode, 180);
        transformedEnd = rotatePointAroundBase(endNode, 180);
      }

      // Draw the original or flipped connection
      line(transformedStart.x, transformedStart.y, transformedEnd.x, transformedEnd.y);

      // Handle symmetry
      if (symmetryMode === "rotation_reflection") {
        drawReflectedConnections(transformedStart, transformedEnd);
        drawRotatedConnections(transformedStart, transformedEnd);
      } else if (symmetryMode === "rotation") {
        drawRotatedConnections(transformedStart, transformedEnd);
      }
    }
  });
}

function drawReflectedConnections(startNode, endNode) {
  const reflectedStart = reflectVertically(startNode);
  const reflectedEnd = reflectVertically(endNode);
  line(reflectedStart.x, reflectedStart.y, reflectedEnd.x, reflectedEnd.y);
}

function drawRotatedConnections(startNode, endNode) {
  const angles = [120, 240];
  angles.forEach((angle) => {
    const rotatedStart = rotatePointAroundBase(startNode, angle);
    const rotatedEnd = rotatePointAroundBase(endNode, angle);
    line(rotatedStart.x, rotatedStart.y, rotatedEnd.x, rotatedEnd.y);
  });
}

function rotatePointAroundBase(node, angle) {
  const rad = radians(angle);
  const dx = node.x - centroid.x;
  const dy = node.y - centroid.y;

  return {
    x: centroid.x + dx * cos(rad) - dy * sin(rad),
    y: centroid.y + dx * sin(rad) + dy * cos(rad),
  };
}

function reflectVertically(node) {
  return {
    x: 2 * centroid.x - node.x,
    y: node.y,
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
