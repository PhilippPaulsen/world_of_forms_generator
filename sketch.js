let canvasSize = 800;
let squareSize = 200;
let nodes = [];
let connections = [];
let symmetryMode = "rotation_reflection"; // Default symmetry
let nodeSlider, tileSlider, symmetryDropdown;

function setup() {
  createCanvas(canvasSize, canvasSize);
  noLoop();

  // Create Sliders
  nodeSlider = createSlider(3, 10, 4, 1);
  nodeSlider.position(10, height + 10);
  nodeSlider.input(() => {
    setupNodes();
    redraw();
  });

  tileSlider = createSlider(1, 5, 3, 1);
  tileSlider.position(10, height + 40);
  tileSlider.input(() => redraw());

  // Create Dropdown for Symmetry
  symmetryDropdown = createSelect();
  symmetryDropdown.position(10, height + 70);
  symmetryDropdown.option("Rotation and Reflection");
  symmetryDropdown.option("Only Rotation");
  symmetryDropdown.selected("Rotation and Reflection");
  symmetryDropdown.input(() => {
    symmetryMode = symmetryDropdown.value() === "Only Rotation" ? "rotation" : "rotation_reflection";
    redraw();
  });

  setupNodes(); // Initialize nodes
}

function draw() {
  background(255);

  drawTessellation(tileSlider.value()); // Draw tessellated connections
  drawNodes(); // Draw nodes
  drawConnections(); // Draw connections
}

function setupNodes() {
  nodes = [];
  let nodeCount = nodeSlider.value();
  let step = squareSize / (nodeCount - 1);
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

function drawNodes() {
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

        if (!startNode || !endNode) return; // Skip if nodes are undefined

        // Draw original connection
        stroke(0);
        strokeWeight(2);
        line(startNode.x, startNode.y, endNode.x, endNode.y);

        if (symmetryMode === "rotation_reflection") {
        // Reflect across horizontal axis
        let horizontalMirrorStart = getHorizontalMirrorNode(startNode);
        let horizontalMirrorEnd = getHorizontalMirrorNode(endNode);
        line(horizontalMirrorStart.x, horizontalMirrorStart.y, horizontalMirrorEnd.x, horizontalMirrorEnd.y);

        // Reflect across vertical axis
        let verticalMirrorStart = getVerticalMirrorNode(startNode);
        let verticalMirrorEnd = getVerticalMirrorNode(endNode);
        line(verticalMirrorStart.x, verticalMirrorStart.y, verticalMirrorEnd.x, verticalMirrorEnd.y);

        // Reflect across both axes (point reflection)
        let pointMirrorStart = getMirroredNode(startNode);
        let pointMirrorEnd = getMirroredNode(endNode);
        line(pointMirrorStart.x, pointMirrorStart.y, pointMirrorEnd.x, pointMirrorEnd.y);

        // Rotate original and reflected connections
        [90, 180, 270].forEach((angle) => {
            let rotatedStart = getRotatedNode(startNode, angle);
            let rotatedEnd = getRotatedNode(endNode, angle);
            line(rotatedStart.x, rotatedStart.y, rotatedEnd.x, rotatedEnd.y);

            let rotatedHMirrorStart = getRotatedNode(horizontalMirrorStart, angle);
            let rotatedHMirrorEnd = getRotatedNode(horizontalMirrorEnd, angle);
            line(rotatedHMirrorStart.x, rotatedHMirrorStart.y, rotatedHMirrorEnd.x, rotatedHMirrorEnd.y);

            let rotatedVMirrorStart = getRotatedNode(verticalMirrorStart, angle);
            let rotatedVMirrorEnd = getRotatedNode(verticalMirrorEnd, angle);
            line(rotatedVMirrorStart.x, rotatedVMirrorStart.y, rotatedVMirrorEnd.x, rotatedVMirrorEnd.y);

            let rotatedPMirrorStart = getRotatedNode(pointMirrorStart, angle);
            let rotatedPMirrorEnd = getRotatedNode(pointMirrorEnd, angle);
            line(rotatedPMirrorStart.x, rotatedPMirrorStart.y, rotatedPMirrorEnd.x, rotatedPMirrorEnd.y);
        });
        }

        if (symmetryMode === "rotation") {
        // Rotate original connection (90°, 180°, and 270°)
        [90, 180, 270].forEach((angle) => {
            let rotatedStart = getRotatedNode(startNode, angle);
            let rotatedEnd = getRotatedNode(endNode, angle);
            line(rotatedStart.x, rotatedStart.y, rotatedEnd.x, rotatedEnd.y);
        });
        }
    });
    }
  
function drawTessellation(tileCount) {
  let tileSize = squareSize;

  for (let i = -tileCount; i <= tileCount; i++) {
    for (let j = -tileCount; j <= tileCount; j++) {
      let offsetX = i * tileSize;
      let offsetY = j * tileSize;
      push();
      translate(offsetX, offsetY);
      drawConnections();
      pop();
    }
  }
}

function mousePressed() {
  let clickedNode = null;

  // Detect clicked node
  nodes.forEach((node, index) => {
    if (dist(mouseX, mouseY, node.x, node.y) < 10) {
      clickedNode = index + 1; // Node IDs start at 1
    }
  });

  if (clickedNode) handleNodeClick(clickedNode);
}

function handleNodeClick(nodeId) {
  if (connections.length && connections[connections.length - 1].length === 1) {
    // Complete the connection
    connections[connections.length - 1].push(nodeId);
  } else {
    // Start a new connection
    connections.push([nodeId]);
  }
  redraw(); // Trigger redraw
}

function getMirroredNode(node) {
  let centerX = width / 2;
  let centerY = height / 2;
  return {
    x: centerX - (node.x - centerX), // Reflect horizontally
    y: centerY - (node.y - centerY), // Reflect vertically
  };
}  

function getVerticalMirrorNode(node) {
  let centerX = width / 2; // Vertical axis through center
  return {
    x: centerX - (node.x - centerX), // Reflect horizontally
    y: node.y, // Keep the same y-coordinate
  };
}
  

function getHorizontalMirrorNode(node) {
  let centerY = height / 2; // Horizontal axis through center
  return {
    x: node.x, // Keep the same x-coordinate
    y: centerY - (node.y - centerY), // Reflect vertically
  };
}

function getRotatedNode(node, angle) {
  let centerX = width / 2;
  let centerY = height / 2;
  let rad = radians(angle);
  let dx = node.x - centerX;
  let dy = node.y - centerY;
  return {
    x: centerX + dx * cos(rad) - dy * sin(rad),
    y: centerY + dx * sin(rad) + dy * cos(rad),
  };
}
