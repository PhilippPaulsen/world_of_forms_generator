/***************************************************************
 * SKETCH.JS
 * Triangle Tiling (Kite / Rhombus) 
 * - Canvas size changes => just enlarge or shrink visible area,
 *   but keep the triangle's scale & position *centered*.
 * - "Shape Size" changes => re-scale the triangle (A,B,C) + nodes.
 ***************************************************************/

// Canvas dims
let canvasW = 320; 
let canvasH = 320;

// For the central triangle geometry
let shapeSizeFactor = 5; // from #square-size-slider (range 1..9)
let nodeCount = 4;       // from #node-slider
let curveAmount = 0;     // from #curve-slider (-50..50)
let symmetryMode = "rotation_reflection"; // #symmetry-dropdown
let lineColor = "#000000";
let showNodes = true;    // #toggle-nodes

// The triangle's main vertices
let A, B, C;
// Its centroid
let centroid = { x: 0, y: 0 };
// We'll store the "current center" of the shape
// so if the canvas is resized, we can shift the shape accordingly.
let shapeCenterX = 160;
let shapeCenterY = 160;

// Subdivided nodes + user connections
let nodes = [];
let connections = [];

// Mirrored geometry for the kite tiling
let mirroredNodes = [];
let mirroredConnections = [];

// p5 setup
function setup() {
  // 1) Create canvas from #canvas-size-slider
  let sizeSlider = select("#canvas-size-slider");
  canvasW = parseInt(sizeSlider.value()) || 320;
  canvasH = canvasW; // keep square if desired
  createCanvas(canvasW, canvasH).parent("canvas-container");
  noLoop();

  // 2) Hook up UI
  // Canvas size slider => only resize the visible area, then SHIFT the triangle so it stays center
  sizeSlider.input(() => {
    let newSize = parseInt(sizeSlider.value()) || 320;
    let oldW = canvasW;
    let oldH = canvasH;
    canvasW = newSize;
    canvasH = newSize;
    resizeCanvas(canvasW, canvasH);

    // SHIFT all triangle geometry so it remains centered:
    // old center => (oldW/2, oldH/2)
    // new center => (canvasW/2, canvasH/2)
    let dx = (canvasW / 2) - (oldW / 2);
    let dy = (canvasH / 2) - (oldH / 2);
    shiftEntireGeometry(dx, dy);

    redraw();
  });

  // "Shape Size" => recalc the triangle scale & re-subdivide
  const shapeSlider = select("#square-size-slider");
  shapeSizeFactor = parseInt(shapeSlider.value()) || 5;
  shapeSlider.input(() => {
    shapeSizeFactor = parseInt(shapeSlider.value()) || 5;
    resetConnections();
    updateTriangleGeometry(); // re-scale A,B,C around shapeCenterX, shapeCenterY
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

  // Curve slider
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

  // Clear
  const clearBtn = select("#clear-button");
  clearBtn.mousePressed(() => {
    resetConnections();
    redraw();
  });

  // Undo
  const backBtn = select("#back-button");
  backBtn.mousePressed(() => {
    undoConnection();
    redraw();
  });

  // Random line
  const randBtn = select("#random-button");
  randBtn.mousePressed(() => {
    addRandomConnection();
    redraw();
  });

  // 3) Initialize geometry
  shapeCenterX = canvasW / 2; // center the shape
  shapeCenterY = canvasH / 2;
  updateTriangleGeometry(); 
  setupNodes();
}

// The main draw
function draw() {
  background(255);

  // 1) Mirror geometry => we get mirroredNodes, mirroredConnections
  mirrorTriangle();

  // 2) Tiled kite approach => fill entire canvas
  tileKiteNoGaps();

  // 3) Optionally draw the central nodes
  if (showNodes) {
    fill(0);
    noStroke();
    for (let nd of nodes) {
      ellipse(nd.x, nd.y, 6,6);
    }
  }
}

//---------------- GEOMETRY & TILING ----------------//

// Recompute A,B,C around shapeCenterX, shapeCenterY
function updateTriangleGeometry() {
  // base scale => shapeSizeFactor * something
  let base = shapeSizeFactor * 30; 
  let h = (base * sqrt(3))/2;

  // We'll place B,C horizontally around shapeCenter, A above
  B = { x: shapeCenterX - base/2, y: shapeCenterY + h/2 };
  C = { x: shapeCenterX + base/2, y: shapeCenterY + h/2 };
  A = { x: shapeCenterX,          y: shapeCenterY - h/2 };

  centroid = {
    x: (A.x + B.x + C.x)/3,
    y: (A.y + B.y + C.y)/3,
  };
}

// Create subdivided nodes inside the upright triangle
function setupNodes() {
  nodes = [];
  let id=1;
  for (let i=0; i<nodeCount; i++) {
    let t = (nodeCount<=1)? 0 : i/(nodeCount-1);
    for (let j=0; j<=i; j++) {
      let s = (i===0)? 0 : j/i;
      let x = (1 - t)*A.x + t*((1-s)*B.x + s*C.x);
      let y = (1 - t)*A.y + t*((1-s)*B.y + s*C.y);
      nodes.push({ id:id++, x, y });
    }
  }
  connections = [];
}

// Mirror the entire triangle => T'
function mirrorTriangle() {
  mirroredNodes = [];
  mirroredConnections = [];

  for (let nd of nodes) {
    mirroredNodes.push( reflectPointOverLine(nd, B, C) );
  }
  for (let pair of connections) {
    if (pair.length===2) {
      let sN = nodes.find(n=>n.id===pair[0]);
      let eN = nodes.find(n=>n.id===pair[1]);
      if (sN&&eN) {
        let sMir = reflectPointOverLine(sN,B,C);
        let eMir = reflectPointOverLine(eN,B,C);
        mirroredConnections.push([sMir,eMir]);
      }
    }
  }
}

// Tiled “kite” => no diagonal gaps
function tileKiteNoGaps() {
  // base from B->C
  const s = dist(B.x,B.y, C.x,C.y);
  const diagHeight = s*sqrt(3); 
  const rowH = diagHeight/2;
  const colW = s;

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

// Draw original + mirrored connections
function drawKiteCell() {
  // original
  for (let pair of connections) {
    if (pair.length===2) {
      let sN= nodes.find(n=>n.id===pair[0]);
      let eN= nodes.find(n=>n.id===pair[1]);
      if(sN&&eN) {
        drawConnectionWithSymmetry(sN,eN);
      }
    }
  }
  // mirrored
  for (let pair of mirroredConnections) {
    if (pair.length===2) {
      // pair is [sMirNode, eMirNode] => actual coords
      drawConnectionWithSymmetry(pair[0],pair[1]);
    }
  }
}

//---------------- MOUSE / CONNECTIONS ----------------//

function mousePressed() {
  // only if inside canvas
  if(mouseX<0||mouseX>width||mouseY<0||mouseY>height)return;
  // find node
  let foundId=null;
  for(let nd of nodes) {
    if(dist(mouseX,mouseY, nd.x,nd.y)<10) {
      foundId= nd.id; break;
    }
  }
  if(foundId!==null) {
    if(!connections.length || connections[connections.length-1].length===2) {
      connections.push([foundId]);
    } else {
      connections[connections.length-1].push(foundId);
    }
    redraw();
  }
}

//-------------- SHIFTING & UTILS --------------//

// SHIFT entire geometry by (dx,dy) => to keep the shape centered if canvas changes
function shiftEntireGeometry(dx, dy) {
  // shift the main vertices
  A.x+=dx; A.y+=dy;
  B.x+=dx; B.y+=dy;
  C.x+=dx; C.y+=dy;
  centroid.x+=dx; 
  centroid.y+=dy;

  // shift the subdivided nodes
  for(let nd of nodes) {
    nd.x+=dx; 
    nd.y+=dy;
  }
  // shift connections => no need, they are IDs
  // mirrored geometry => we'll recalc them next time we draw
}

// Clear all connections
function resetConnections() {
  connections=[];
}

// Undo last connection
function undoConnection() {
  if(connections.length>0){
    connections.pop();
  }
}

// Add random line
function addRandomConnection() {
  if(nodes.length<2) return;
  let i1=floor(random(nodes.length));
  let i2=floor(random(nodes.length));
  if(i1===i2) return;
  let id1=nodes[i1].id;
  let id2=nodes[i2].id;
  connections.push([id1,id2]);
}

//---------------- DRAWING W/ SYMMETRY & CURVES --------------//

function drawConnectionWithSymmetry(p1,p2) {
  stroke(lineColor);
  strokeWeight(2);

  // base curve
  drawCurvedBezier(p1,p2, curveAmount);

  if(symmetryMode==="rotation"||symmetryMode==="rotation_reflection"){
    let angles=[120,240];
    for(let ang of angles){
      let sR= rotatePointAroundBase(p1,ang);
      let eR= rotatePointAroundBase(p2,ang);
      drawCurvedBezier(sR,eR,curveAmount);
    }
  }
  if(symmetryMode==="rotation_reflection"){
    // reflect original
    let sRef= reflectVertically(p1);
    let eRef= reflectVertically(p2);
    drawCurvedBezier(sRef,eRef,curveAmount);

    // reflect the rotated lines
    let angles=[120,240];
    for(let ang of angles){
      let sR= rotatePointAroundBase(p1,ang);
      let eR= rotatePointAroundBase(p2,ang);
      let sRR= reflectVertically(sR);
      let eRR= reflectVertically(eR);
      drawCurvedBezier(sRR,eRR,curveAmount);
    }
  }
}

// Curved Bézier from p1->p2 with offset normal
function drawCurvedBezier(p1,p2,cAmt) {
  let scaleF=0.01;
  let sign=(cAmt>=0)?1:-1;
  let mag=abs(cAmt)*scaleF; 
  if(mag<0.0001){
    line(p1.x,p1.y, p2.x,p2.y);
    return;
  }
  let mx=(p1.x+p2.x)*0.5;
  let my=(p1.y+p2.y)*0.5;
  let dx=p2.x-p1.x;
  let dy=p2.y-p1.y;
  let distLine=sqrt(dx*dx+dy*dy);
  let nx=-dy, ny=dx;
  let ln=sqrt(nx*nx+ny*ny);
  if(ln<0.0001){
    return;
  }
  nx/=ln; ny/=ln;
  let offset=distLine*mag*sign;
  let c1x=mx+nx*offset;
  let c1y=my+ny*offset;
  // For a symmetrical bow, use same c1, c2
  let c2x=c1x; 
  let c2y=c1y;

  noFill();
  bezier(p1.x,p1.y, c1x,c1y, c2x,c2y, p2.x,p2.y);
}

//-------------- Transform helpers --------------//

function rotatePointAroundBase(pt, angleDeg) {
  let rad=radians(angleDeg);
  let dx=pt.x - centroid.x;
  let dy=pt.y - centroid.y;
  return {
    x: centroid.x + dx*cos(rad) - dy*sin(rad),
    y: centroid.y + dx*sin(rad) + dy*cos(rad),
  };
}
function reflectVertically(pt){
  return {
    x: 2*centroid.x - pt.x,
    y: pt.y
  };
}
function reflectPointOverLine(P, L1, L2){
  let vx=L2.x-L1.x;
  let vy=L2.y-L1.y;
  let len=sqrt(vx*vx+vy*vy);
  let ux=vx/len, uy=vy/len;
  let wx=P.x - L1.x;
  let wy=P.y - L1.y;
  let dot=wx*ux + wy*uy;
  let px=L1.x + dot*ux;
  let py=L1.y + dot*uy;
  let vxPP=px-P.x;
  let vyPP=py-P.y;
  return {
    x:P.x + 2*vxPP,
    y:P.y + 2*vyPP
  };
}
