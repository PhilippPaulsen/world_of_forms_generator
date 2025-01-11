/***************************************************************
 * SKETCH.JS
 * Triangle Tiling (Kite / Rhombus) with Mirroring 
 * - Canvas size slider
 * - "Shape Size" slider (#square-size-slider) => triangle base
 * - Node slider => subdivisions
 * - Curve slider => -50..50 offset 
 * - Symmetry => rotation or rotation+reflection
 * - Line color picker
 * - Toggle nodes
 * - Clear, Undo, Random line
 ***************************************************************/

// Canvas dimensions
let canvasW = 320;
let canvasH = 320;

// Triangle base size, node count, curve offset, etc.
let triangleBaseFactor = 5;  // read from #square-size-slider
let nodeCount = 4;           // from #node-slider
let curveAmount = 0;         // from #curve-slider, range -50..50
let symmetryMode = "rotation_reflection"; // from #symmetry-dropdown
let lineColor = "#000000";   // from #line-color-picker
let showNodes = true;        // from #toggle-nodes

// Central upright triangle vertices
let A, B, C;      // computed from triangleBaseFactor
let centroid;     // centroid of ABC

// The arrays storing “subdivided nodes” and user connections
let nodes = [];
let connections = [];

// For “kite tiling”: we reflect the entire triangle about base BC => T'
let mirroredNodes = [];
let mirroredConnections = [];

// p5 Setup
function setup() {
  // 1) Read canvas size slider => createCanvas
  const sizeSlider = select("#canvas-size-slider");
  canvasW = parseInt(sizeSlider.value()) || 320;
  canvasH = canvasW; // keep square if you prefer
  createCanvas(canvasW, canvasH).parent("canvas-container");

  noLoop(); // We'll redraw only on demand

  // 2) Hook up UI

  // When canvas size slider changes, resize the canvas
  sizeSlider.input(() => {
    let val = parseInt(sizeSlider.value()) || 320;
    canvasW = val;
    canvasH = val;
    resizeCanvas(canvasW, canvasH);
    redraw();
  });

  // “Shape Size” => triangle base factor
  const shapeSizeSlider = select("#square-size-slider");
  triangleBaseFactor = parseInt(shapeSizeSlider.value()) || 5;
  shapeSizeSlider.input(() => {
    triangleBaseFactor = parseInt(shapeSizeSlider.value()) || 5;
    resetConnections();
    updateTriangleGeometry();
    setupNodes();
    redraw();
  });

  // Node slider
  const nodeSlider = select("#node-slider");
  nodeCount = parseInt(nodeSlider.value()) || 4;
  nodeSlider.input(() => {
    nodeCount = parseInt(nodeSlider.value()) || 4;
    resetConnections();
    setupNodes();
    redraw();
  });

  // Curve slider (-50..50)
  const cSlider = select("#curve-slider");
  curveAmount = parseInt(cSlider.value()) || 0;
  cSlider.input(() => {
    curveAmount = parseInt(cSlider.value()) || 0;
    redraw();
  });

  // Symmetry dropdown
  const symDropdown = select("#symmetry-dropdown");
  symmetryMode = symDropdown.value();
  symDropdown.changed(() => {
    symmetryMode = symDropdown.value();
    redraw();
  });

  // Line color
  const colorPicker = select("#line-color-picker");
  lineColor = colorPicker.value();
  colorPicker.input(() => {
    lineColor = colorPicker.value();
    redraw();
  });

  // Toggle nodes
  const nodeCB = select("#toggle-nodes");
  showNodes = nodeCB.elt.checked;
  nodeCB.changed(() => {
    showNodes = nodeCB.elt.checked;
    redraw();
  });

  // Buttons: Clear, Undo, Random
  const clearBtn = select("#clear-button");
  clearBtn.mousePressed(() => {
    resetConnections();
    redraw();
  });

  const backBtn = select("#back-button");
  backBtn.mousePressed(() => {
    undoConnection();
    redraw();
  });

  const randomBtn = select("#random-button");
  randomBtn.mousePressed(() => {
    addRandomConnection();
    redraw();
  });

  // 3) Init geometry
  updateTriangleGeometry();
  setupNodes();
}

// p5 draw
function draw() {
  background(255);

  // Re-check the canvas size slider to allow live resizing
  const sizeSlider = select("#canvas-size-slider");
  let newSize = parseInt(sizeSlider.value()) || 320;
  if (newSize !== canvasW) {
    canvasW = newSize;
    canvasH = newSize;
    resizeCanvas(canvasW, canvasH);
  }

  // 1) Mirror the entire triangle => T'
  reflectTriangle();

  // 2) Tiled “kite” approach => fill the canvas
  tileKiteNoGaps();

  // 3) Draw the central triangle’s nodes (if toggled on), etc.
  drawCentralReference();
}

// --------------- Geometry & Tiling ---------------

// Update “A,B,C” from triangleBaseFactor
function updateTriangleGeometry() {
  // The base = factor * 30?  Customize scaling as you like
  const base = triangleBaseFactor * 30;
  const h = (base * sqrt(3)) / 2;

  // center near canvas center
  const cx = width / 2;
  const cy = height / 2;

  B = { x: cx - base/2, y: cy + h/2 };
  C = { x: cx + base/2, y: cy + h/2 };
  A = { x: cx,          y: cy - h/2 };

  centroid = {
    x: (A.x + B.x + C.x)/3,
    y: (A.y + B.y + C.y)/3,
  };
}

// Create subdivided nodes inside the upright triangle
function setupNodes() {
  nodes = [];
  const n = nodeCount;
  let id = 1;
  for (let i = 0; i < n; i++) {
    let t = (n<=1)? 0 : i/(n-1);
    for (let j=0; j<=i; j++) {
      let s = (i===0)? 0 : j/i;
      let x = (1 - t)*A.x + t*((1-s)*B.x + s*C.x);
      let y = (1 - t)*A.y + t*((1-s)*B.y + s*C.y);
      nodes.push({ id:id++, x, y });
    }
  }
}

// Mirror the entire triangle about base BC => T'
function reflectTriangle() {
  mirroredNodes = [];
  mirroredConnections = [];
  // Mirror each node
  for (let nd of nodes) {
    mirroredNodes.push( reflectPointOverLine(nd, B, C) );
  }
  // Mirror each connection
  for (let pair of connections) {
    if (pair.length===2) {
      let sN = nodes.find(n=>n.id===pair[0]);
      let eN = nodes.find(n=>n.id===pair[1]);
      if (sN&&eN) {
        let sMir = reflectPointOverLine(sN, B, C);
        let eMir = reflectPointOverLine(eN, B, C);
        mirroredConnections.push([sMir, eMir]);
      }
    }
  }
}

// Tiled “kite” approach => no diagonal gaps
function tileKiteNoGaps() {
  const s = dist(B.x,B.y, C.x,C.y); // base length from B->C
  // total vertical extent = s * sqrt(3)? Actually the big “kite” is 2*(height/2) = s*sqrt(3)
  const diagHeight = s * sqrt(3);
  const rowH = diagHeight/2;
  const colW = s;

  // expand enough to fill the entire canvas
  let colCount = ceil(width/colW)+4;
  let rowCount = ceil(height/rowH)+4;

  for (let row=-2; row<rowCount; row++) {
    let yOff = row*rowH;
    for (let col=-2; col<colCount; col++) {
      let xOff = col*colW;
      if (row%2!==0) {
        xOff += s/2;
      }
      push();
      translate(xOff,yOff);
      drawKiteCell();
      pop();
    }
  }
}

// draw one “kite cell” => original + mirrored connections
function drawKiteCell() {
  // original
  for (let pair of connections) {
    if (pair.length===2) {
      let sN = nodes.find(n=>n.id===pair[0]);
      let eN = nodes.find(n=>n.id===pair[1]);
      if (sN&&eN) {
        drawConnectionWithSymmetry(sN, eN);
      }
    }
  }
  // mirrored
  for (let pair of mirroredConnections) {
    if (pair.length===2) {
      let [sN, eN] = pair;
      drawConnectionWithSymmetry(sN, eN); 
    }
  }
}

// Draw the “central reference” => only the nodes if showNodes
function drawCentralReference() {
  if (showNodes) {
    fill(0);
    noStroke();
    for (let nd of nodes) {
      ellipse(nd.x, nd.y, 6,6);
    }
  }
  // If you want to see the main triangle’s boundary or centroid, you can do:
  // stroke(200);
  // line(A.x,A.y, B.x,B.y);
  // line(B.x,B.y, C.x,C.y);
  // line(C.x,C.y, A.x,A.y);
}

// --------------- Connection Drawing with Symmetry & Curves ---------------

function drawConnectionWithSymmetry(p1, p2) {
  // parse curveAmount => range -50..50
  stroke(lineColor);
  strokeWeight(2);

  drawCurvedBezier(p1, p2, curveAmount);

  if (symmetryMode==="rotation" || symmetryMode==="rotation_reflection") {
    // e.g. rotate 120, 240 deg around centroid
    // This can be quite visually heavy. 
    let angles=[120,240];
    for (let a of angles) {
      let sR=rotatePointAroundBase(p1,a);
      let eR=rotatePointAroundBase(p2,a);
      drawCurvedBezier(sR,eR, curveAmount);
    }
  }
  if (symmetryMode==="rotation_reflection") {
    // reflect original
    let sRef=reflectVertically(p1);
    let eRef=reflectVertically(p2);
    // If you want a “mirrored curve offset,” you can do -curveAmount here
    drawCurvedBezier(sRef,eRef, curveAmount);

    // reflect the rotated lines
    let angles=[120,240];
    for (let a of angles) {
      let sR=rotatePointAroundBase(p1,a);
      let eR=rotatePointAroundBase(p2,a);
      let sRR=reflectVertically(sR);
      let eRR=reflectVertically(eR);
      drawCurvedBezier(sRR,eRR, curveAmount);
    }
  }
}

// A simple cubic Bézier with offset normal
function drawCurvedBezier(p1,p2,cAmt) {
  // range -50..50 => scale e.g. *0.01
  let scaleFactor=0.01;
  let offsetSign=(cAmt>=0)?1:-1;
  let mag=abs(cAmt)*scaleFactor;
  if (mag<0.0001) {
    line(p1.x,p1.y, p2.x,p2.y);
    return;
  }

  let mx=(p1.x+p2.x)/2;
  let my=(p1.y+p2.y)/2;
  let dx=p2.x-p1.x;
  let dy=p2.y-p1.y;
  let distLine=sqrt(dx*dx+dy*dy);
  let nx=-dy, ny=dx;
  let ln=sqrt(nx*nx+ny*ny);
  if (ln<0.0001) {
    return;
  }
  nx/=ln; ny/=ln;

  let offset=distLine*mag*offsetSign;
  let c1x=mx+nx*offset;
  let c1y=my+ny*offset;
  let c2x=c1x; 
  let c2y=c1y;

  noFill();
  bezier(p1.x,p1.y, c1x,c1y, c2x,c2y, p2.x,p2.y);
}

// --------------- Mouse Connections ---------------
function mousePressed() {
  // Only if inside the canvas
  if (mouseX<0||mouseX>width||mouseY<0||mouseY>height) return;

  // find a node
  let foundId=null;
  for (let nd of nodes) {
    if (dist(mouseX,mouseY, nd.x, nd.y)<10) {
      foundId=nd.id; 
      break;
    }
  }
  if (foundId!==null) {
    if (!connections.length || connections[connections.length-1].length===2) {
      connections.push([foundId]);
    } else {
      connections[connections.length-1].push(foundId);
    }
    redraw();
  }
}

// --------------- Additional Functions ---------------

function resetConnections() {
  connections = [];
}

function undoConnection() {
  if (connections.length>0) {
    connections.pop();
  }
}

function addRandomConnection() {
  if (nodes.length<2) return;
  let i1=floor(random(nodes.length));
  let i2=floor(random(nodes.length));
  if (i1===i2)return;
  let id1=nodes[i1].id;
  let id2=nodes[i2].id;
  connections.push([id1,id2]);
}

// --------------- Transform Helpers ---------------
function rotatePointAroundBase(pt, angleDeg) {
  let rad=radians(angleDeg);
  let dx=pt.x - centroid.x;
  let dy=pt.y - centroid.y;
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
  let vx=L2.x-L1.x;
  let vy=L2.y-L1.y;
  let len=sqrt(vx*vx+vy*vy);

  let ux=vx/len;
  let uy=vy/len;

  let wx=P.x - L1.x;
  let wy=P.y - L1.y;
  let dot=wx*ux + wy*uy;

  let px=L1.x + dot*ux;
  let py=L1.y + dot*uy;

  let vxPP=px-P.x;
  let vyPP=py-P.y;
  return {
    x: P.x + 2*vxPP,
    y: P.y + 2*vyPP
  };
}
