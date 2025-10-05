// === WORLD OF FORMS – STABLE SKETCH ===============================
// Core features restored with correct tiling & symmetry per shape.
// - Nodes are clickable in the center tile.
// - Tiling clones are drawn via local centroids (no global centroid bleed).
// - Square uses 4-fold rotation, Triangle 3-fold, Hex 6-fold when chosen.
// - Hex gets a center node when nodeCount == 1.
// - Background always white; nodes black, hover red.

// ----------------- GLOBAL STATE ---------------------------------
let canvasW = 320;
let canvasH = 320; // keep square

let shapeSizeFactor = 5; // 1..9 (odd recommended)
let nodeCount = 1;       // 1 => outer nodes only (base form)
let curveAmount = 0;     // -50..50

let symmetryMode = "rotation_reflection6"; // normalized token
let lineColor = "#000000";
let showNodes = true;
let currentShape = 'triangle';

// Center tile geometry (absolute coordinates)
let outerCorners = [];
let centroid = { x: 0, y: 0 };
let nodes = [];
let connections = [];

// ----------------- HELPERS --------------------------------------
function normSym(val) {
  const v = (val || '').toLowerCase();
  if (v.includes('none')) return 'none';
  if (v.includes('reflection only') || v === 'reflection' || v === 'reflection_only') return 'reflection_only';
  if (v.includes('rotation + reflection')) return 'rotation_reflection6';
  if (v.includes('3-fold +')) return 'rotation_reflection3';
  if (v.includes('6-fold +')) return 'rotation_reflection6';
  if (v.includes('3-fold')) return 'rotation3';
  if (v.includes('6-fold')) return 'rotation6';
  return 'rotation_reflection6';
}

function rotateAround(pt, center, angleDeg) {
  const rad = radians(angleDeg);
  const dx = pt.x - center.x;
  const dy = pt.y - center.y;
  return {
    x: center.x + dx * cos(rad) - dy * sin(rad),
    y: center.y + dx * sin(rad) + dy * cos(rad)
  };
}

function reflectVerticallyAround(pt, center) {
  return { x: 2 * center.x - pt.x, y: pt.y };
}

function toTileLocal(n, tileC, flip180) {
  // shift node by removing center centroid, place at tile centroid; optional 180° flip
  let x = n.x - centroid.x;
  let y = n.y - centroid.y;
  if (flip180) { x = -x; y = -y; }
  return { x: tileC.x + x, y: tileC.y + y };
}

// ----------------- SETUP ----------------------------------------
function setup() {
  // Canvas size
  const sizeSlider = select('#canvas-size-slider');
  canvasW = parseInt(sizeSlider?.value()) || 320;
  canvasH = canvasW;
  createCanvas(canvasW, canvasH).parent('canvas-container');
  noLoop();

  // Recompute when canvas size changes (scale existing geometry)
  sizeSlider?.input(() => {
    const oldW = canvasW, oldH = canvasH;
    canvasW = parseInt(sizeSlider.value()) || 320;
    canvasH = canvasW;
    const scaleX = canvasW / oldW;
    const scaleY = canvasH / oldH;
    resizeCanvas(canvasW, canvasH);
    nodes.forEach(nd => { nd.x *= scaleX; nd.y *= scaleY; });
    outerCorners.forEach(c => { c.x *= scaleX; c.y *= scaleY; });
    centroid.x *= scaleX; centroid.y *= scaleY;
    redraw();
  });

  // Shape size factor
  const shapeSlider = select('#square-size-slider');
  shapeSizeFactor = parseInt(shapeSlider?.value()) || 5;
  shapeSlider?.input(() => { shapeSizeFactor = parseInt(shapeSlider.value()) || 5; rebuildGrid(currentShape); redraw(); });

  // Node count (default 1)
  const nSlider = select('#node-slider');
  nodeCount = parseInt(nSlider?.value()) || 1;
  nSlider?.input(() => { nodeCount = parseInt(nSlider.value()) || 1; rebuildGrid(currentShape); redraw(); });

  // Curve amount
  const cSlider = select('#curve-slider');
  curveAmount = parseInt(cSlider?.value()) || 0;
  cSlider?.input(() => { curveAmount = parseInt(cSlider.value()) || 0; redraw(); });

  // Symmetry
  const symDropdown = select('#symmetry-dropdown');
  symmetryMode = normSym(symDropdown?.value());
  symDropdown?.changed(() => { symmetryMode = normSym(symDropdown.value()); redraw(); });

  // Color
  const colorPicker = select('#line-color-picker');
  lineColor = colorPicker?.value() || '#000000';
  colorPicker?.input(() => { lineColor = colorPicker.value(); redraw(); });

  // Show nodes
  const nodeCB = select('#toggle-nodes');
  const initialChecked = nodeCB?.elt?.checked; if (typeof initialChecked === 'boolean') showNodes = initialChecked;
  nodeCB?.changed(() => { showNodes = nodeCB.elt.checked; redraw(); });

  // Buttons (safe if missing)
  const clearBtn = select('#clear-button');
  clearBtn && clearBtn.attribute('title','Clear').mousePressed(() => { connections = []; redraw(); });
  const backBtn = select('#back-button');
  backBtn && backBtn.attribute('title','Undo').mousePressed(() => { if (connections.length) connections.pop(); redraw(); });
  const randBtn = select('#random-button');
  randBtn && randBtn.attribute('title','Random').mousePressed(() => { addRandomConnection(); redraw(); });
  const dlBtn = select('#download-button');
  dlBtn && dlBtn.attribute('title','Download').mousePressed(() => saveCanvas('world_of_forms','png'));

  // Shape dropdown
  const shapeSel = document.getElementById('shape-dropdown');
  if (shapeSel) {
    currentShape = (shapeSel.value || 'triangle').toLowerCase();
    shapeSel.addEventListener('change', e => { currentShape = (e.target.value || 'triangle').toLowerCase(); rebuildGrid(currentShape); redraw(); });
  }

  rebuildGrid(currentShape);
  // Draw a random connection on start
  addRandomConnection();
  redraw();
}

// ----------------- DRAW -----------------------------------------
function draw() {
  // Dark Mode erkennen
  let isDarkMode = false;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    isDarkMode = true;
  }

  if (isDarkMode) {
    // Hintergrund im Dark Mode: immer vollständig schwarz, unabhängig vom CSS
    background(0);
    // Linien und Füllung global auf weiß setzen
    stroke("#ffffff");
    fill("#ffffff");
  } else {
    // Hintergrund exakt wie Bedienfeld
    const bgColor = getComputedStyle(document.body).getPropertyValue('--panel-bg-color') || '#ffffff';
    background(bgColor);
    // Linienfarbe wie Picker/CSS, Füllung standardmäßig schwarz
    stroke(lineColor);
    fill(0);
  }

  drawTessellation();

  // Knoten (Hover rot/hellgrau im Dark Mode)
  if (showNodes) {
    push();
    // Im Dark Mode: Punkte weiß oder hellgrau, im Light Mode: schwarz oder rot
    noStroke();
    nodes.forEach(nd => {
      const d = dist(mouseX, mouseY, nd.x, nd.y);
      if (isDarkMode) {
        fill(d < 10 ? color(200) : color(255));
      } else {
        fill(d < 10 ? color(220, 0, 0) : color(0));
      }
      ellipse(nd.x, nd.y, 6, 6);
    });
    pop();
  }
}

function mouseMoved() { if (showNodes) redraw(); }

// ----------------- GRID & TILING -------------------------------
function rebuildGrid(shape) {
  connections = [];
  let grid;
  if (shape === 'triangle') grid = buildTriangleGrid(nodeCount, shapeSizeFactor, canvasW, canvasH);
  else if (shape === 'square') grid = buildSquareGrid(nodeCount, shapeSizeFactor, canvasW, canvasH);
  else grid = buildHexGrid(nodeCount, shapeSizeFactor, canvasW, canvasH);

  nodes = grid.nodes; centroid = grid.centroid; outerCorners = grid.outerCorners;
}

function drawTessellation() {
  if (currentShape === 'hex') tileHex();
  else if (currentShape === 'square') tileSquare();
  else tileTriangle();
}

function drawShapeCell(tileCentroid, flip180 = false) {
  for (const conn of connections) {
    if (conn.length === 2) {
      const n1 = nodes.find(n => n.id === conn[0]);
      const n2 = nodes.find(n => n.id === conn[1]);
      if (!n1 || !n2) continue;
      const p1 = toTileLocal(n1, tileCentroid, flip180);
      const p2 = toTileLocal(n2, tileCentroid, flip180);
      drawConnectionWithSymmetry(p1, p2, tileCentroid);
    }
  }
}

// --- HEX ---
function tileHex() {
  const side = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y);
  const hexW = side * 1.5;
  const hexH = sqrt(3) * side;
  const cols = ceil(width / hexW) + 6;
  const rows = ceil(height / hexH) + 6;
  for (let c = -3; c < cols; c++) {
    const xOff = c * hexW;
    for (let r = -3; r < rows; r++) {
      let yOff = r * hexH; if (c % 2) yOff += hexH * 0.5;
      const tileC = { x: centroid.x + xOff, y: centroid.y + yOff };
      drawShapeCell(tileC, false);
    }
  }
}

// --- SQUARE ---
function tileSquare() {
  const s = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y); // tile size
  const cols = ceil(width / s) + 4; const rows = ceil(height / s) + 4;
  for (let i = -2; i < cols; i++) {
    for (let j = -2; j < rows; j++) {
      const tileC = { x: centroid.x + i * s, y: centroid.y + j * s };
      drawShapeCell(tileC, false);
    }
  }
}

// --- TRIANGLE --- (triangular lattice, centroid-centered)
function tileTriangle() {
  // Justage-Parameter für das Dreieck-Tiling:
  // Passe horizontalAdjust und verticalAdjust manuell an, um die horizontale/vertikale Abstände zwischen den Dreiecken zu feintunen.
  // Standardwerte: horizontalAdjust = 0.0, verticalAdjust = 0.08
  const horizontalAdjust = -0.01;
  const verticalAdjust = 0.01;

  const s = dist(outerCorners[1].x, outerCorners[1].y, outerCorners[2].x, outerCorners[2].y);
  const h = (sqrt(3) / 2) * s;

  // --- Manuelle Verschiebung des gesamten Musters ---
  const offsetX = -s * 2.49; // negative Werte: nach links, positive: nach rechts
  const offsetY = -h * 3.02; // negative Werte: nach oben, positive: nach unten

  // Schrittweiten mit manueller Justage
  const v1 = { x: s * (1 + horizontalAdjust), y: 0 }; // horizontale Schrittweite (angepasst)
  const v2 = { x: s / 2, y: h * (1 + verticalAdjust) }; // vertikale Schrittweite (angepasst)

  // Ursprung für das Gitter
  const B = outerCorners[1];
  const cols = ceil(width / (s * (1 + horizontalAdjust))) + 4;
  const rows = ceil(height / (h * (1 + verticalAdjust))) + 4;

  for (let j = -2; j < rows; j++) {
    for (let i = -2; i < cols; i++) {
      const anchor = {
        x: B.x + i * v1.x + j * v2.x + offsetX,
        y: B.y + i * v1.y + j * v2.y + offsetY
      };

      // Aufrechtes Dreieck
      const centerUp = { x: anchor.x + s / 2, y: anchor.y - h / 3 };
      drawShapeCell(centerUp, false);

      // Umgedrehtes Dreieck
      const centerDown = { x: anchor.x + s / 2, y: anchor.y + h / 3 };
      drawShapeCell(centerDown, true);
    }
  }
}

// ----------------- INTERACTION ---------------------------------
function mousePressed() {
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  let foundId = null;
  for (let nd of nodes) { if (dist(mouseX, mouseY, nd.x, nd.y) < 18) { foundId = nd.id; break; } }
  if (foundId !== null) {
    if (!connections.length || connections[connections.length - 1].length === 2) connections.push([foundId]);
    else connections[connections.length - 1].push(foundId);
    redraw();
  }
}

function addRandomConnection() {
  if (nodes.length < 2) return;
  let i = floor(random(nodes.length)); let j = floor(random(nodes.length));
  if (i === j) return; connections.push([nodes[i].id, nodes[j].id]);
}

// ----------------- DRAWING LINES + SYMMETRY ---------------------
function drawConnectionWithSymmetry(p1, p2, center) {
  // Linienfarbe und Füllung werden im draw() global gesetzt
  strokeWeight(2);
  drawCurvedBezier(p1, p2, curveAmount);

  // Choose rotation set per shape, ignore incompatible modes gracefully
  let rotAngles = [];
  if (currentShape === 'square') {
    if (symmetryMode === 'rotation3' || symmetryMode === 'rotation6') rotAngles = [90, 180, 270];
    if (symmetryMode === 'rotation_reflection3' || symmetryMode === 'rotation_reflection6') rotAngles = [90, 180, 270];
  } else if (currentShape === 'triangle') {
    if (symmetryMode === 'rotation3' || symmetryMode === 'rotation6') rotAngles = [120, 240];
    if (symmetryMode === 'rotation_reflection3' || symmetryMode === 'rotation_reflection6') rotAngles = [120, 240];
  } else { // hex
    if (symmetryMode === 'rotation3') rotAngles = [120, 240];
    if (symmetryMode === 'rotation6') rotAngles = [60, 120, 180, 240, 300];
    if (symmetryMode === 'rotation_reflection3') rotAngles = [120, 240];
    if (symmetryMode === 'rotation_reflection6') rotAngles = [60, 120, 180, 240, 300];
  }

  // Rotations
  rotAngles.forEach(a => {
    const sR = rotateAround(p1, center, a);
    const eR = rotateAround(p2, center, a);
    drawCurvedBezier(sR, eR, curveAmount);
  });

  // Reflection(s)
  if (symmetryMode === 'reflection_only') {
    const sRef = reflectVerticallyAround(p1, center);
    const eRef = reflectVerticallyAround(p2, center);
    drawCurvedBezier(sRef, eRef, curveAmount);
  }
  if (symmetryMode === 'rotation_reflection3' || symmetryMode === 'rotation_reflection6') {
    const sRef = reflectVerticallyAround(p1, center);
    const eRef = reflectVerticallyAround(p2, center);
    drawCurvedBezier(sRef, eRef, curveAmount);
    rotAngles.forEach(a => {
      const sR = rotateAround(p1, center, a);
      const eR = rotateAround(p2, center, a);
      const sRR = reflectVerticallyAround(sR, center);
      const eRR = reflectVerticallyAround(eR, center);
      drawCurvedBezier(sRR, eRR, curveAmount);
    });
  }
}

function drawCurvedBezier(p1, p2, cAmt) {
  const scaleF = 0.01; const sign = (cAmt >= 0) ? 1 : -1; const mag = abs(cAmt) * scaleF;
  if (mag < 0.0001) { line(p1.x, p1.y, p2.x, p2.y); return; }
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x, dy = p2.y - p1.y; const distLine = sqrt(dx * dx + dy * dy);
  let nx = -dy, ny = dx; const ln = sqrt(nx * nx + ny * ny); if (ln < 0.0001) return; nx /= ln; ny /= ln;
  const offset = distLine * mag * sign; const cx = mx + nx * offset, cy = my + ny * offset;
  // Die Linien sollen immer ungefüllt sein, aber noFill() nicht global setzen!
  // Wir setzen fill/stroke im draw() global, daher hier keine Änderung.
  bezier(p1.x, p1.y, cx, cy, cx, cy, p2.x, p2.y);
}

// ----------------- GRID BUILDERS (formerly forms.js) ------------
function buildTriangleGrid(nodeCount, shapeSizeFactor, canvasW, canvasH) {
  const nodes = []; let id = 1;
  const base = canvasW / shapeSizeFactor; const h = (Math.sqrt(3) / 2) * base;
  const cx = canvasW / 2, cy = canvasH / 2;
  const A = { x: cx, y: cy - h / 2 }, B = { x: cx - base / 2, y: cy + h / 2 }, C = { x: cx + base / 2, y: cy + h / 2 };

  if (nodeCount <= 1) {
    [A, B, C].forEach(p => nodes.push({ id: id++, x: p.x, y: p.y }));
  } else {
    for (let i = 0; i < nodeCount; i++) {
      const t = (nodeCount <= 1) ? 0 : i / (nodeCount - 1);
      for (let j = 0; j <= i; j++) {
        const s = (i === 0) ? 0 : j / i;
        const x = (1 - t) * A.x + t * ((1 - s) * B.x + s * C.x);
        const y = (1 - t) * A.y + t * ((1 - s) * B.y + s * C.y);
        nodes.push({ id: id++, x, y });
      }
    }
  }
  const centroid = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
  return { nodes, centroid, outerCorners: [A, B, C] };
}

function buildSquareGrid(nodeCount, shapeSizeFactor, canvasW, canvasH) {
  const nodes = []; let id = 1; const size = canvasW / shapeSizeFactor; const startX = canvasW / 2 - size / 2; const startY = canvasH / 2 - size / 2;
  const corners = [
    { x: startX, y: startY },
    { x: startX + size, y: startY },
    { x: startX + size, y: startY + size },
    { x: startX, y: startY + size },
  ];
  if (nodeCount <= 1) {
    corners.forEach(p => nodes.push({ id: id++, x: p.x, y: p.y }));
  } else {
    const step = size / (nodeCount - 1);
    for (let i = 0; i < nodeCount; i++) {
      for (let j = 0; j < nodeCount; j++) {
        nodes.push({ id: id++, x: startX + i * step, y: startY + j * step });
      }
    }
  }
  const centroid = { x: canvasW / 2, y: canvasH / 2 };
  return { nodes, centroid, outerCorners: corners };
}

function buildHexGrid(nodeCount, shapeSizeFactor, canvasW, canvasH) {
  const nodes = []; const outerCorners = [];
  const shapeHeight = canvasH / shapeSizeFactor; const side = shapeHeight / sqrt(3);
  const cx = canvasW / 2; const topY = (canvasH / 2) - shapeHeight / 2;
  outerCorners.push({ x: cx - side / 2, y: topY });
  outerCorners.push({ x: cx + side / 2, y: topY });
  outerCorners.push({ x: cx + side, y: topY + (sqrt(3) / 2) * side });
  outerCorners.push({ x: cx + side / 2, y: topY + sqrt(3) * side });
  outerCorners.push({ x: cx - side / 2, y: topY + sqrt(3) * side });
  outerCorners.push({ x: cx - side, y: topY + (sqrt(3) / 2) * side });
  let sumX = 0, sumY = 0; outerCorners.forEach(c => { sumX += c.x; sumY += c.y; });
  const centroid = { x: sumX / 6, y: sumY / 6 };

  if (nodeCount <= 1) {
    // 6 outer corners + center node (as requested)
    outerCorners.forEach((p, idx) => nodes.push({ id: idx + 1, x: p.x, y: p.y }));
    nodes.push({ id: nodes.length + 1, x: centroid.x, y: centroid.y });
    return { nodes, centroid, outerCorners };
  }

  function getScaledCorners(scale) {
    return outerCorners.map(p => ({ x: centroid.x + (p.x - centroid.x) * scale, y: centroid.y + (p.y - centroid.y) * scale }));
  }
  function addRingRecursive(r, scale) {
    const ringC = getScaledCorners(scale);
    ringC.forEach(p => nodes.push({ id: nodes.length + 1, x: p.x, y: p.y }));
    const bridge = r - 1;
    for (let c = 0; c < 6; c++) {
      const c1 = ringC[c], c2 = ringC[(c + 1) % 6];
      for (let seg = 1; seg <= bridge; seg++) {
        const t = seg / (bridge + 1);
        nodes.push({ id: nodes.length + 1, x: c1.x + t * (c2.x - c1.x), y: c1.y + t * (c2.y - c1.y) });
      }
    }
    if (r > 1) addRingRecursive(r - 1, scale * (r - 1) / r);
  }
  addRingRecursive(nodeCount, 1.0);
  // Always include the central node as well (not only for nodeCount == 1)
  nodes.push({ id: nodes.length + 1, x: centroid.x, y: centroid.y });
  return { nodes, centroid, outerCorners };
}