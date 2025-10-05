/**
 * sketch.js – Unified World of Forms Generator
 * Combines: Hexagon, Square, Triangle
 * Fully compatible with existing UI (sliders, dropdowns, buttons).
 * Author: Philipp Paulsen / 2025 Refactor
 */

let canvasW = 320;
let canvasH = 320;
let darkMode = false;

// Shape parameters
let currentShape = "hex"; // default
let shapeSizeFactor = 3;
let nodeCount = 3;
let curveAmount = 0;
let symmetryMode = "rotation_reflection6";
let lineColor = "#000000";
let showNodes = true;

// Data
let nodes = [];
let connections = [];
let outerCorners = [];
let centroid = { x: 0, y: 0 };

// === SETUP ==================================================

function setup() {
  const sizeSlider = select("#canvas-size-slider");
  canvasW = parseInt(sizeSlider.value()) || 320;
  canvasH = canvasW;
  createCanvas(canvasW, canvasH).parent("canvas-container");
  noLoop();

  // === UI HOOKS ===
  sizeSlider.input(() => {
    canvasW = parseInt(sizeSlider.value()) || 320;
    canvasH = canvasW;
    resizeCanvas(canvasW, canvasH);
    rebuildShape();
  });

  const shapeSlider = select("#square-size-slider");
  shapeSizeFactor = parseInt(shapeSlider.value()) || 3;
  shapeSlider.input(() => {
    shapeSizeFactor = parseInt(shapeSlider.value()) || 3;
    rebuildShape();
  });

  const nSlider = select("#node-slider");
  nodeCount = parseInt(nSlider.value()) || 3;
  nSlider.input(() => {
    nodeCount = parseInt(nSlider.value()) || 3;
    rebuildShape();
  });

  const cSlider = select("#curve-slider");
  cSlider.input(() => {
    curveAmount = parseInt(cSlider.value()) || 0;
    redraw();
  });

  const symDropdown = select("#symmetry-dropdown");
  symDropdown.changed(() => {
    symmetryMode = symDropdown.value();
    redraw();
  });

  const colorPicker = select("#line-color-picker");
  colorPicker.input(() => {
    lineColor = colorPicker.value();
    redraw();
  });

  const nodeCB = select("#toggle-nodes");
  nodeCB.changed(() => {
    showNodes = nodeCB.elt.checked;
    redraw();
  });

  select("#clear-button").mousePressed(() => {
    connections = [];
    redraw();
  });

  select("#back-button").mousePressed(() => {
    if (connections.length > 0) connections.pop();
    redraw();
  });

  select("#random-button").mousePressed(() => {
    addRandomConnection();
    redraw();
  });

  document.getElementById("shape-dropdown").addEventListener("change", e => {
    currentShape = e.target.value;
    rebuildShape();
  });

  document.getElementById("darkmode-toggle").addEventListener("change", e => {
    darkMode = e.target.checked;
    document.body.classList.toggle("dark", darkMode);
    redraw();
  });

  rebuildShape();
}

// === DRAW ===================================================

function draw() {
  background(darkMode ? 0 : 255);
  stroke(lineColor);
  noFill();

  switch (currentShape) {
    case "hex":
      drawHexTessellation();
      break;
    case "square":
      drawSquareTessellation();
      break;
    case "triangle":
      drawTriangleTessellation();
      break;
  }

  if (showNodes) drawNodes();
}

// === SHAPE BUILDERS =========================================

function rebuildShape() {
  connections = [];
  nodes = [];

  if (currentShape === "hex") {
    buildHex();
  } else if (currentShape === "square") {
    buildSquare();
  } else if (currentShape === "triangle") {
    buildTriangle();
  }

  redraw();
}

// --- HEX ----------------------------------------------------

function buildHex() {
  outerCorners = [];
  let shapeHeight = canvasH / shapeSizeFactor;
  let side = shapeHeight / sqrt(3);
  let cx = width / 2;
  let topY = (height / 2) - shapeHeight / 2;

  outerCorners.push({ x: cx - side / 2, y: topY });
  outerCorners.push({ x: cx + side / 2, y: topY });
  outerCorners.push({ x: cx + side, y: topY + (sqrt(3) / 2) * side });
  outerCorners.push({ x: cx + side / 2, y: topY + sqrt(3) * side });
  outerCorners.push({ x: cx - side / 2, y: topY + sqrt(3) * side });
  outerCorners.push({ x: cx - side, y: topY + (sqrt(3) / 2) * side });

  centroid = outerCorners.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  centroid.x /= 6;
  centroid.y /= 6;

  buildHexNodes();
}

function buildHexNodes() {
  nodes = [];
  let id = 1;
  let maxR = nodeCount;
  for (let r = 1; r <= maxR; r++) {
    let scale = r / maxR;
    for (let i = 0; i < 6; i++) {
      let a1 = outerCorners[i];
      let a2 = outerCorners[(i + 1) % 6];
      let x = centroid.x + (a1.x - centroid.x) * scale;
      let y = centroid.y + (a1.y - centroid.y) * scale;
      nodes.push({ x, y, id: id++ });

      let stepCount = r - 1;
      for (let s = 1; s <= stepCount; s++) {
        let t = s / (stepCount + 1);
        let mx = a1.x + t * (a2.x - a1.x);
        let my = a1.y + t * (a2.y - a1.y);
        mx = centroid.x + (mx - centroid.x) * scale;
        my = centroid.y + (my - centroid.y) * scale;
        nodes.push({ x: mx, y: my, id: id++ });
      }
    }
  }
  nodes.push({ x: centroid.x, y: centroid.y, id: id++ });
}

function drawHexTessellation() {
  const side = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y);
  const hexW = side * 1.5;
  const hexH = sqrt(3) * side;
  const cols = ceil(width / hexW) + 4;
  const rows = ceil(height / hexH) + 4;

  for (let j = -2; j < rows; j++) {
    for (let i = -2; i < cols; i++) {
      let xOff = i * hexW;
      let yOff = j * hexH;
      if (i % 2 !== 0) yOff += hexH / 2;

      push();
      translate(xOff, yOff);
      drawConnections();
      pop();
    }
  }
}

// --- SQUARE -------------------------------------------------

function buildSquare() {
  const squareSize = canvasW / shapeSizeFactor;
  const step = squareSize / (nodeCount - 1);
  let id = 1;
  nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    for (let j = 0; j < nodeCount; j++) {
      nodes.push({
        x: width / 2 - squareSize / 2 + i * step,
        y: height / 2 - squareSize / 2 + j * step,
        id: id++
      });
    }
  }
}

function drawSquareTessellation() {
  const squareSize = canvasW / shapeSizeFactor;
  const tileCount = ceil(width / squareSize) + 1;

  for (let i = -1; i <= tileCount; i++) {
    for (let j = -1; j <= tileCount; j++) {
      push();
      translate(i * squareSize, j * squareSize);
      drawConnections();
      pop();
    }
  }
}

// --- TRIANGLE -----------------------------------------------

function buildTriangle() {
  nodes = [];
  const base = width / shapeSizeFactor;
  const h = base * sqrt(3) / 2;
  const cx = width / 2;
  const cy = height / 2;
  const top = { x: cx, y: cy - h / 2 };
  const left = { x: cx - base / 2, y: cy + h / 2 };
  const right = { x: cx + base / 2, y: cy + h / 2 };

  let id = 1;
  for (let i = 0; i < nodeCount; i++) {
    const t = i / (nodeCount - 1);
    for (let j = 0; j <= i; j++) {
      const s = i ? j / i : 0;
      const x = (1 - t) * top.x + t * ((1 - s) * left.x + s * right.x);
      const y = (1 - t) * top.y + t * ((1 - s) * left.y + s * right.y);
      nodes.push({ x, y, id: id++ });
    }
  }
}

function drawTriangleTessellation() {
  const base = width / shapeSizeFactor;
  const h = base * sqrt(3) / 2;
  const cols = ceil(width / base) + 2;
  const rows = ceil(height / h) + 2;

  for (let row = -2; row < rows; row++) {
    for (let col = -2; col < cols; col++) {
      const xOff = col * base + (row % 2 === 0 ? 0 : base / 2);
      const yOff = row * h;
      push();
      translate(xOff, yOff);
      drawConnections();
      pop();
    }
  }
}

// === DRAW CONNECTIONS =======================================

function drawConnections() {
  for (let [a, b] of connections) {
    const p1 = nodes.find(n => n.id === a);
    const p2 = nodes.find(n => n.id === b);
    if (!p1 || !p2) continue;
    drawConnectionWithSymmetry(p1, p2);
  }
}

function drawNodes() {
  fill(darkMode ? 255 : 0);
  noStroke();
  for (let n of nodes) ellipse(n.x, n.y, 6, 6);
}

function mousePressed() {
  let found = null;
  for (let n of nodes) {
    if (dist(mouseX, mouseY, n.x, n.y) < 15) {
      found = n.id;
      break;
    }
  }
  if (found) {
    if (!connections.length || connections[connections.length - 1].length === 2)
      connections.push([found]);
    else connections[connections.length - 1].push(found);
    redraw();
  }
}

// === SYMMETRY ===============================================

function drawConnectionWithSymmetry(p1, p2) {
  stroke(lineColor);
  strokeWeight(2);
  drawCurvedBezier(p1, p2, curveAmount);

  if (symmetryMode.includes("rotation")) {
    const angles = currentShape === "square" ? [90, 180, 270] :
                   currentShape === "triangle" ? [120, 240] :
                   [60, 120, 180, 240, 300];
    for (let a of angles) {
      const p1r = rotateAroundCentroid(p1, a);
      const p2r = rotateAroundCentroid(p2, a);
      drawCurvedBezier(p1r, p2r, curveAmount);
    }
  }

  if (symmetryMode.includes("reflection")) {
    const p1r = reflectVertically(p1);
    const p2r = reflectVertically(p2);
    drawCurvedBezier(p1r, p2r, curveAmount);
  }
}

function drawCurvedBezier(p1, p2, cAmt) {
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;
  const offset = cAmt * 0.01 * len;
  const cx = midX + nx * offset;
  const cy = midY + ny * offset;
  noFill();
  bezier(p1.x, p1.y, cx, cy, cx, cy, p2.x, p2.y);
}

function rotateAroundCentroid(pt, angle) {
  const rad = radians(angle);
  const cx = width / 2;
  const cy = height / 2;
  const dx = pt.x - cx;
  const dy = pt.y - cy;
  return { x: cx + dx * cos(rad) - dy * sin(rad), y: cy + dx * sin(rad) + dy * cos(rad) };
}

function reflectVertically(pt) {
  const cx = width / 2;
  return { x: 2 * cx - pt.x, y: pt.y };
}

// === RANDOM CONNECTION ======================================

function addRandomConnection() {
  if (nodes.length < 2) return;
  const i1 = floor(random(nodes.length));
  const i2 = floor(random(nodes.length));
  if (i1 === i2) return;
  connections.push([nodes[i1].id, nodes[i2].id]);
}