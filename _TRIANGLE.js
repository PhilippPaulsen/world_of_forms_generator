/***********************************************************
 * p5.js KITE TILING with Curves + UI
 *   - NO isometric grid lines (the kite boundaries)
 *   - Toggle to show/hide central nodes
 ***********************************************************/

let canvasWidth = 600;
let canvasHeight = 600;

// Central triangle geometry
let triangleBase, triangleHeight;
let A, B, C;           // vertices of the upright central triangle
let centroid;

// Sliders & dropdown
let nodeCount = 5;
let triangleDivisor = 5;
let symmetryMode = "rotation";
let curveAmount = 0.2; // control the curvature of Béziers

// For user-defined geometry
let nodes = [];
let connections = [];

// For mirrored geometry
let mirroredNodes = [];
let mirroredConnections = [];

// UI references
let triangleSizeSlider, nodeSlider, symmetryDropdown, curveSlider;
let showNodesCheckbox;   // toggle for node visibility
let showNodes = true;    // internal boolean to track node display

function setup() {
  createCanvas(canvasWidth, canvasHeight);
  pixelDensity(1);
  noLoop();  // We'll only redraw on demand

  // --- UI ELEMENTS ---

  // 1) Triangle size slider
  triangleSizeSlider = createSlider(1, 10, triangleDivisor, 1);
  triangleSizeSlider.position(10, canvasHeight + 10);
  triangleSizeSlider.input(() => {
    triangleDivisor = triangleSizeSlider.value();
    updateTriangleSize();  // recalc A,B,C
    setupNodes();          // recalc node positions
    redraw();              // draw once
  });

  // 2) Node count slider
  nodeSlider = createSlider(3, 15, nodeCount, 1);
  nodeSlider.position(10, canvasHeight + 40);
  nodeSlider.input(() => {
    nodeCount = nodeSlider.value();
    setupNodes();
    redraw();
  });

  // 3) Symmetry dropdown
  symmetryDropdown = createSelect();
  symmetryDropdown.position(10, canvasHeight + 70);
  symmetryDropdown.option("rotation");
  symmetryDropdown.option("rotation_reflection");
  symmetryDropdown.changed(() => {
    symmetryMode = symmetryDropdown.value();
    redraw();
  });

  // 4) Curve control slider
  curveSlider = createSlider(0, 100, curveAmount * 100, 1);
  curveSlider.position(10, canvasHeight + 100);
  curveSlider.input(() => {
    curveAmount = curveSlider.value() / 100.0;
    redraw();
  });

  // 5) Checkbox for showing/hiding central nodes
  showNodesCheckbox = createCheckbox("Show nodes", true);
  showNodesCheckbox.position(10, canvasHeight + 130);
  showNodesCheckbox.changed(() => {
    showNodes = showNodesCheckbox.checked();
    redraw();
  });

  // Initial setup
  updateTriangleSize(); 
  setupNodes();        
}

function draw() {
  background(255);

  // 1) Mirror the central triangle => T'
  reflectAll();

  // 2) Tile the kite with no diagonal gaps
  tileKiteNoGaps();

  // 3) Draw the central editing triangle & optional nodes
  drawCentralTriangleAndNodes();
}

// ---------------------------------------------------------------------------
// A) Triangle geometry and centroid
// ---------------------------------------------------------------------------
function updateTriangleSize() {
  triangleBase = canvasWidth / triangleDivisor;
  triangleHeight = (triangleBase * sqrt(3)) / 2;

  let cx = width / 2;
  let cy = height / 2;

  // Place B,C on a horizontal line
  B = { x: cx - triangleBase / 2, y: cy + triangleHeight / 2 };
  C = { x: cx + triangleBase / 2, y: cy + triangleHeight / 2 };
  A = { x: cx,                  y: cy - triangleHeight / 2 };

  centroid = {
    x: (A.x + B.x + C.x) / 3,
    y: (A.y + B.y + C.y) / 3,
  };
}

// ---------------------------------------------------------------------------
// B) Generate subdivided nodes inside the central upright triangle
// ---------------------------------------------------------------------------
function setupNodes() {
  nodes = [];
  connections = [];
  let id = 1;

  for (let i = 0; i < nodeCount; i++) {
    let t = i / (nodeCount - 1);
    for (let j = 0; j <= i; j++) {
      let s = (i === 0) ? 0 : j / i;
      let x = (1 - t) * A.x + t * ((1 - s) * B.x + s * C.x);
      let y = (1 - t) * A.y + t * ((1 - s) * B.y + s * C.y);
      nodes.push({ id: id++, x, y });
    }
  }
}

// ---------------------------------------------------------------------------
// C) Mirror the geometry about base BC => T'
// ---------------------------------------------------------------------------
function reflectAll() {
  mirroredNodes = [];
  mirroredConnections = [];

  for (let nd of nodes) {
    mirroredNodes.push( reflectPointOverLine(nd, B, C) );
  }
  for (let [startId, endId] of connections) {
    let sN = nodes.find(n => n.id === startId);
    let eN = nodes.find(n => n.id === endId);
    if (sN && eN) {
      let sMir = reflectPointOverLine(sN, B, C);
      let eMir = reflectPointOverLine(eN, B, C);
      mirroredConnections.push([sMir, eMir]);
    }
  }
}

// ---------------------------------------------------------------------------
// D) Tiling the kite with a hex-like staggering => no diagonal gaps
//    short diagonal = triangleBase = s
//    total vertical extent = s * sqrt(3)
//    row spacing = (s * sqrt(3))/2
//    col spacing = s
//    odd rows => x offset by s/2
// ---------------------------------------------------------------------------
function tileKiteNoGaps() {
  const s = triangleBase;
  const diagHeight = s * sqrt(3);
  const rowH = diagHeight / 2;
  const colW = s;

  let colCount = ceil(width / colW) + 4;
  let rowCount = ceil(height / rowH) + 4;

  for (let row = -2; row < rowCount; row++) {
    let yOff = row * rowH;
    for (let col = -2; col < colCount; col++) {
      let xOff = col * colW;
      if (row % 2 !== 0) {
        xOff += s / 2;
      }
      push();
      translate(xOff, yOff);
      drawKiteCell();
      pop();
    }
  }
}

// ---------------------------------------------------------------------------
// E) drawKiteCell => draws original + mirrored connections, but NO boundary lines
//    => we remove the "isometric grid" look
// ---------------------------------------------------------------------------
function drawKiteCell() {
  // Original T lines
  for (let [startId, endId] of connections) {
    let sN = nodes.find(n => n.id === startId);
    let eN = nodes.find(n => n.id === endId);
    if (sN && eN) {
      drawConnectionWithSymmetry(sN, eN);
    }
  }
  // Mirrored T' lines
  for (let [p1, p2] of mirroredConnections) {
    drawConnectionWithSymmetry(p1, p2);
  }

  // NO boundary lines => no isometric grid
  // (Commented out or removed)
  /*
  stroke(0);
  strokeWeight(1);
  noFill();

  // If you ever want them back:
  // beginShape();
  //   vertex(B.x, B.y);
  //   vertex(C.x, C.y);
  //   vertex(A.x, A.y);
  // endShape(CLOSE);

  // let A_mir = reflectPointOverLine(A, B, C);
  // beginShape();
  //   vertex(B.x, B.y);
  //   vertex(C.x, C.y);
  //   vertex(A_mir.x, A_mir.y);
  // endShape(CLOSE);
  */
}

// ---------------------------------------------------------------------------
// F) Draw the central editing triangle & optionally the nodes
// ---------------------------------------------------------------------------
function drawCentralTriangleAndNodes() {
  // Centroid
  fill(255, 0, 0);
  noStroke();
  ellipse(centroid.x, centroid.y, 8, 8);

  // Outline for the central triangle (if you still want it)
  stroke(0);
  strokeWeight(1);
  noFill();
  beginShape();
    vertex(A.x, A.y);
    vertex(B.x, B.y);
    vertex(C.x, C.y);
  endShape(CLOSE);

  // Optionally show nodes
  if (showNodes) {
    fill(0);
    noStroke();
    for (let n of nodes) {
      ellipse(n.x, n.y, 6, 6);
    }
  }
}

// ---------------------------------------------------------------------------
// G) Mouse click => connect nodes (no resetting of nodes!)
// ---------------------------------------------------------------------------
function mousePressed() {
  let clickedId = null;
  for (let n of nodes) {
    if (dist(mouseX, mouseY, n.x, n.y) < 10) {
      clickedId = n.id;
      break;
    }
  }

  if (clickedId) {
    if (!connections.length || connections[connections.length-1].length === 2) {
      // start a new connection
      connections.push([clickedId]);
    } else {
      // complete the last connection
      connections[connections.length-1].push(clickedId);
    }
    redraw();
  }
}

// ---------------------------------------------------------------------------
// H) drawConnectionWithSymmetry => draws CURVES + rotation/reflection
// ---------------------------------------------------------------------------
function drawConnectionWithSymmetry(startNode, endNode) {
  stroke(0);
  strokeWeight(2);

  // base curve
  drawCurvedBezier(startNode, endNode);

  if (symmetryMode === "rotation" || symmetryMode === "rotation_reflection") {
    let angles = [120, 240];
    for (let ang of angles) {
      let sR = rotatePointAroundBase(startNode, ang);
      let eR = rotatePointAroundBase(endNode, ang);
      drawCurvedBezier(sR, eR);
    }
  }

  if (symmetryMode === "rotation_reflection") {
    // reflect original
    let sRef = reflectVertically(startNode);
    let eRef = reflectVertically(endNode);
    drawCurvedBezier(sRef, eRef);

    // reflect the rotated lines
    let angles = [120, 240];
    for (let ang of angles) {
      let sR = rotatePointAroundBase(startNode, ang);
      let eR = rotatePointAroundBase(endNode, ang);
      let sRR = reflectVertically(sR);
      let eRR = reflectVertically(eR);
      drawCurvedBezier(sRR, eRR);
    }
  }
}

// ---------------------------------------------------------------------------
// I) drawCurvedBezier => draws a cubic Bézier with offset control points
// ---------------------------------------------------------------------------
function drawCurvedBezier(p1, p2) {
  if (curveAmount < 0.001) {
    // If curve ~0 => just draw a line
    line(p1.x, p1.y, p2.x, p2.y);
    return;
  }

  let mx = (p1.x + p2.x)*0.5;
  let my = (p1.y + p2.y)*0.5;
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  let distLine = sqrt(dx*dx + dy*dy);

  // normal direction
  let nx = -dy;
  let ny = dx;
  let len = sqrt(nx*nx + ny*ny);
  nx /= len; // unit normal
  ny /= len;

  let offset = distLine * curveAmount;

  // place both control points near midpoint, offset along the normal
  let c1x = mx + nx * offset;
  let c1y = my + ny * offset;
  let c2x = mx + nx * offset;
  let c2y = my + ny * offset;

  noFill();
  bezier(p1.x, p1.y, c1x, c1y, c2x, c2y, p2.x, p2.y);
}

// ---------------------------------------------------------------------------
// J) Helpers: rotate, reflect, reflect over line
// ---------------------------------------------------------------------------
function rotatePointAroundBase(pt, angleDeg) {
  let rad = radians(angleDeg);
  let dx = pt.x - centroid.x;
  let dy = pt.y - centroid.y;
  return {
    x: centroid.x + dx*cos(rad) - dy*sin(rad),
    y: centroid.y + dx*sin(rad) + dy*cos(rad),
  };
}

function reflectVertically(pt) {
  return {
    x: 2*centroid.x - pt.x,
    y: pt.y,
  };
}

function reflectPointOverLine(P, L1, L2) {
  let vx = L2.x - L1.x;
  let vy = L2.y - L1.y;
  let len = sqrt(vx*vx + vy*vy);

  let ux = vx/len;
  let uy = vy/len;

  let wx = P.x - L1.x;
  let wy = P.y - L1.y;
  let dot = wx*ux + wy*uy;
  let px = L1.x + dot*ux;
  let py = L1.y + dot*uy;

  let vxPP = px - P.x;
  let vyPP = py - P.y;
  return { x: P.x + 2*vxPP, y: P.y + 2*vyPP };
}
