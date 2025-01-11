/***********************************************************
 * p5.js "Kite Tiling (No Gaps)" Approach
 *
 * 1) One central upright triangle T as a user interface:
 *    - Sliders for size & node count
 *    - Symmetry dropdown
 *    - Clicking nodes => connections
 *
 * 2) Mirror T about its base => T'
 *    => Combine T & T' => "kite" or "diamond" of side length s
 *
 * 3) Tile these kites with a diagonal/hex-like staggering:
 *    - short diagonal = s (horizontal)
 *    - height = s * sqrt(3)
 *    => row spacing = (s * sqrt(3))/2
 *    => odd rows offset x by s/2
 *    => no diagonal gaps
 ***********************************************************/

let canvasWidth = 500;
let canvasHeight = 500;

// Central triangle geometry
let triangleBase, triangleHeight;
let A, B, C;        // The 3 vertices of the upright triangle
let centroid;

// User-editable pattern in the central triangle
let nodeCount = 4;
let triangleDivisor = 5; 
let symmetryMode = "rotation";
let lineColor = "#000000";
let nodes = [];
let connections = [];

// We'll also store the "mirrored" geometry
let mirroredNodes = [];
let mirroredConnections = [];

function setup() {
  createCanvas(canvasWidth, canvasHeight);
  pixelDensity(1);
  noLoop();

  // -- UI Elements --
  const triangleSizeSlider = createSlider(1, 9, triangleDivisor, 1);
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

  // 1) We have a central upright triangle T with user connections
  // 2) Mirror T about base => T'
  reflectAll();

  // 3) Tile the "kite" in a staggered (hex-like) arrangement
  drawKiteTilingNoGaps();

  // 4) Draw the central "interface" triangle
  drawCentralTriangleAndNodes();
}

// ---------------------------------------------------------------------------
// 1) Recompute triangle geometry
//    We'll place B & C at the bottom, A up top, all in the canvas center
// ---------------------------------------------------------------------------
function updateTriangleSize() {
  triangleBase = canvasWidth / triangleDivisor;
  triangleHeight = (triangleBase * sqrt(3)) / 2;

  let cx = width / 2;
  let cy = height / 2;

  // Place B & C on a horizontal line
  B = { x: cx - triangleBase/2, y: cy + triangleHeight/2 };
  C = { x: cx + triangleBase/2, y: cy + triangleHeight/2 };

  // A is above them
  A = { x: cx, y: cy - triangleHeight/2 };

  centroid = {
    x: (A.x + B.x + C.x)/3,
    y: (A.y + B.y + C.y)/3,
  };
}

// ---------------------------------------------------------------------------
// 2) Generate subdivided nodes in the central upright triangle
// ---------------------------------------------------------------------------
function setupNodes() {
  nodes = [];
  connections = [];
  let id = 1;
  for (let i = 0; i < nodeCount; i++) {
    let t = i / (nodeCount - 1);
    for (let j = 0; j <= i; j++) {
      let s = (i === 0) ? 0 : j / i;
      let x =
        (1 - t)*A.x +
        t*((1-s)*B.x + s*C.x);
      let y =
        (1 - t)*A.y +
        t*((1-s)*B.y + s*C.y);
      nodes.push({ id: id++, x, y });
    }
  }
}

// ---------------------------------------------------------------------------
// 3) Mirror all nodes/connections about the base BC => T'
// ---------------------------------------------------------------------------
function reflectAll() {
  mirroredNodes = [];
  mirroredConnections = [];

  // Mirror each node
  for (let n of nodes) {
    mirroredNodes.push(reflectPointOverLine(n, B, C));
  }

  // Mirror each connection
  for (let pair of connections) {
    let [startId, endId] = pair;
    let sN = nodes.find((nd) => nd.id === startId);
    let eN = nodes.find((nd) => nd.id === endId);
    if (sN && eN) {
      let sMir = reflectPointOverLine(sN, B, C);
      let eMir = reflectPointOverLine(eN, B, C);
      mirroredConnections.push([sMir, eMir]);
    }
  }
}

// ---------------------------------------------------------------------------
// 4) Tiling the "kite" with no diagonal gaps
//
//    * We'll orient the kite so the base BC is horizontal => "short diagonal"
//      is length = triangleBase = s
//
//    * The entire diamond is from top vertex A to bottom vertex A_mirror
//      => vertical extent = s√3
//
//    -> We'll do a hex-like staggered arrangement:
//       row spacing: (s√3)/2
//       col spacing: s
//       odd rows offset x by s/2
// ---------------------------------------------------------------------------
function drawKiteTilingNoGaps() {
  const s = triangleBase;         // short diagonal = side
  const diagHeight = s * sqrt(3); // long diagonal

  // We'll space rows by diagHeight/2, columns by s
  const rowHeight = diagHeight / 2;
  const colWidth = s;

  // Enough rows/cols to cover entire canvas
  let colCount = ceil(width / colWidth) + 2;
  let rowCount = ceil(height / rowHeight) + 2;

  for (let row = -2; row < rowCount; row++) {
    let yRow = row * rowHeight;
    for (let col = -2; col < colCount; col++) {
      let xCol = col * colWidth;
      // Stagger: if row is odd, offset x by s/2
      if (row % 2 !== 0) {
        xCol += s/2;
      }
      push();
      translate(xCol, yRow);
      // Draw the kite T ∪ T' in local coords
      drawKite();
      pop();
    }
  }
}

// ---------------------------------------------------------------------------
// 5) Draw one "kite" => original lines + mirrored lines
//    We'll keep B at (0,0), C at (s,0) if we do a local transform
//    but simpler is to just draw them in absolute coords relative to A,B,C
// ---------------------------------------------------------------------------
function drawKite() {
  // Original lines in T
  for (let [startId, endId] of connections) {
    let sN = nodes.find((nd) => nd.id === startId);
    let eN = nodes.find((nd) => nd.id === endId);
    if (sN && eN) {
      lineWithSymmetry(sN, eN);
    }
  }
  // Mirrored lines in T'
  for (let [p1, p2] of mirroredConnections) {
    lineWithSymmetry(p1, p2);
  }

  // Optionally draw the boundary of the kite
  stroke(0);
  strokeWeight(1);
  noFill();

  // T boundary: B->C->A
  beginShape();
    vertex(B.x, B.y);
    vertex(C.x, C.y);
    vertex(A.x, A.y);
  endShape(CLOSE);

  // T' boundary: B->C->A_mirror
  let A_mir = reflectPointOverLine(A, B, C);
  beginShape();
    vertex(B.x, B.y);
    vertex(C.x, C.y);
    vertex(A_mir.x, A_mir.y);
  endShape(CLOSE);
}

// ---------------------------------------------------------------------------
// 6) Draw the central "interface" triangle with nodes
// ---------------------------------------------------------------------------
function drawCentralTriangleAndNodes() {
  // centroid
  fill(255,0,0);
  noStroke();
  ellipse(centroid.x, centroid.y, 8, 8);

  // boundary
  stroke(0);
  noFill();
  beginShape();
    vertex(A.x, A.y);
    vertex(B.x, B.y);
    vertex(C.x, C.y);
  endShape(CLOSE);

  // nodes
  fill(0);
  noStroke();
  for (let n of nodes) {
    ellipse(n.x, n.y, 6, 6);
  }
}

// ---------------------------------------------------------------------------
// 7) Let user click on a node => connect them
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
    if (connections.length && connections[connections.length-1].length === 1) {
      connections[connections.length-1].push(clickedId);
    } else {
      connections.push([clickedId]);
    }
    redraw();
  }
}

// ---------------------------------------------------------------------------
// 8) lineWithSymmetry() => draw line in local coords, then do rotation/reflection
//    around the centroid if needed
// ---------------------------------------------------------------------------
function lineWithSymmetry(sN, eN) {
  stroke(lineColor);
  strokeWeight(2);

  // Base line
  line(sN.x, sN.y, eN.x, eN.y);

  if (symmetryMode === "rotation" || symmetryMode === "rotation_reflection") {
    let angles = [120, 240];
    for (let ang of angles) {
      let sR = rotatePointAroundBase(sN, ang);
      let eR = rotatePointAroundBase(eN, ang);
      line(sR.x, sR.y, eR.x, eR.y);
    }
  }
  if (symmetryMode === "rotation_reflection") {
    // reflect original
    let sRef = reflectVertically(sN);
    let eRef = reflectVertically(eN);
    line(sRef.x, sRef.y, eRef.x, eRef.y);

    // reflect the rotated lines
    let angles = [120, 240];
    for (let ang of angles) {
      let sR = rotatePointAroundBase(sN, ang);
      let eR = rotatePointAroundBase(eN, ang);
      let sRR = reflectVertically(sR);
      let eRR = reflectVertically(eR);
      line(sRR.x, sRR.y, eRR.x, eRR.y);
    }
  }
}

// ---------------------------------------------------------------------------
// Reflection & Rotation Helpers
// ---------------------------------------------------------------------------

// Rotate a point around the centroid by angle (in degrees)
function rotatePointAroundBase(pt, angleDeg) {
  let r = radians(angleDeg);
  let dx = pt.x - centroid.x;
  let dy = pt.y - centroid.y;
  return {
    x: centroid.x + dx*cos(r) - dy*sin(r),
    y: centroid.y + dx*sin(r) + dy*cos(r),
  };
}

// Reflect about vertical axis through the centroid
function reflectVertically(pt) {
  return {
    x: 2*centroid.x - pt.x,
    y: pt.y,
  };
}

// Reflect point P over line from L1 to L2
function reflectPointOverLine(P, L1, L2) {
  let vx = L2.x - L1.x;
  let vy = L2.y - L1.y;
  let len = sqrt(vx*vx + vy*vy);

  let ux = vx / len;
  let uy = vy / len;

  let wx = P.x - L1.x;
  let wy = P.y - L1.y;

  let dot = wx*ux + wy*uy; // scalar projection
  let px = L1.x + dot*ux;  // projection x
  let py = L1.y + dot*uy;  // projection y

  let vxPP = px - P.x;
  let vyPP = py - P.y;
  return {
    x: P.x + 2*vxPP,
    y: P.y + 2*vyPP,
  };
}
