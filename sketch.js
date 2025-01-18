/***************************************************************
 * FULL HEX PATTERN, NO STAR BRIDGING, nodeCount=1..7
 * Greatly expanded tessellation to fill entire canvas
 * Additional symmetry modes: 
 *   none, reflection_only, rotation, rotation_reflection
 ***************************************************************/

let canvasW = 320;
let canvasH = 320;

// shapeSizeFactor => in {1,3,5,7,9}
let shapeSizeFactor = 1;

// nodeCount => 1..7 => nested rings
let nodeCount = 1;

// curve offset => -50..50
let curveAmount = 0;

/**
 * Symmetry modes:
 *   "none"
 *   "reflection_only"
 *   "rotation"
 *   "rotation_reflection"
 */
let symmetryMode = "rotation_reflection";

// line color, node toggle
let lineColor = "#000000";
let showNodes = true;

// Outer "flat-top" hex corners, plus centroid
let outerCorners = [];
let centroid = { x:0, y:0 };

// Final node array + user connections
let nodes = [];
let connections = [];

function setup() {
  // 1) createCanvas from #canvas-size-slider
  const sizeSlider = select("#canvas-size-slider");
  canvasW = parseInt(sizeSlider.value())||320;
  canvasH = canvasW;
  createCanvas(canvasW, canvasH).parent("canvas-container");
  noLoop();

  // ---------- UI ----------

  // Canvas resizing => recalc
  sizeSlider.input(()=>{
    canvasW= parseInt(sizeSlider.value())||320;
    canvasH= canvasW;
    resizeCanvas(canvasW, canvasH);

    resetConnections();
    updateOuterHex();
    buildArrangement(nodeCount, 1.0);
    redraw();
  });

  // shapeSize => factor in {1,3,5,7,9}
  const shapeSlider = select("#square-size-slider");
  shapeSizeFactor= parseInt(shapeSlider.value())||1;
  shapeSlider.input(()=>{
    shapeSizeFactor= parseInt(shapeSlider.value())||1;
    resetConnections();
    updateOuterHex();
    buildArrangement(nodeCount, 1.0);
    redraw();
  });

  // nodeCount => 1..7
  const nSlider= select("#node-slider");
  nodeCount= parseInt(nSlider.value())||1;
  nSlider.input(()=>{
    nodeCount= parseInt(nSlider.value())||1;
    if(nodeCount<1) nodeCount=1;
    if(nodeCount>7) nodeCount=7;
    resetConnections();
    updateOuterHex();
    buildArrangement(nodeCount, 1.0);
    redraw();
  });

  // curve slider
  const cSlider= select("#curve-slider");
  curveAmount= parseInt(cSlider.value())||0;
  cSlider.input(()=>{
    curveAmount= parseInt(cSlider.value())||0;
    redraw();
  });

  // symmetry dropdown
  const symDropdown= select("#symmetry-dropdown");
  symmetryMode= symDropdown.value();
  symDropdown.changed(()=>{
    symmetryMode= symDropdown.value();
    redraw();
  });

  // line color
  const colorPicker= select("#line-color-picker");
  lineColor= colorPicker.value();
  colorPicker.input(()=>{
    lineColor= colorPicker.value();
    redraw();
  });

  // show nodes
  const nodeCB= select("#toggle-nodes");
  showNodes= nodeCB.elt.checked;
  nodeCB.changed(()=>{
    showNodes= nodeCB.elt.checked;
    redraw();
  });

  // Clear
  select("#clear-button").mousePressed(()=>{
    resetConnections();
    redraw();
  });
  // Undo
  select("#back-button").mousePressed(()=>{
    undoConnection();
    redraw();
  });
  // Random
  select("#random-button").mousePressed(()=>{
    addRandomConnection();
    redraw();
  });

  // init
  updateOuterHex();
  buildArrangement(nodeCount, 1.0);
}

function draw() {
  background(255);
  tileHexNoGaps();

  if(showNodes){
    fill(0);
    noStroke();
    for(let nd of nodes){
      ellipse(nd.x, nd.y, 6,6);
    }
  }
}

// ============= Outer Hex ============ //
//
// If factor=1 => top=0, bottom=canvasH => no vertical margin
// else smaller, but still horizontally centered
function updateOuterHex(){
  outerCorners=[];
  let shapeHeight= canvasH/ shapeSizeFactor;
  let side= shapeHeight/ sqrt(3);

  let cx= width/2;
  let topY= (height/2) - shapeHeight/2;

  // define corners for a flat-top hex
  // corner0 => (cx - side/2, topY)
  outerCorners.push({ x: cx - side/2, y: topY });
  outerCorners.push({ x: cx + side/2, y: topY });
  outerCorners.push({ x: cx + side,   y: topY + (sqrt(3)/2)* side });
  outerCorners.push({ x: cx + side/2, y: topY + sqrt(3)* side });
  outerCorners.push({ x: cx - side/2, y: topY + sqrt(3)* side });
  outerCorners.push({ x: cx - side,   y: topY + (sqrt(3)/2)* side });

  // centroid
  let sumX=0, sumY=0;
  for(let c of outerCorners){
    sumX+= c.x; sumY+= c.y;
  }
  centroid.x= sumX/6; 
  centroid.y= sumY/6;
}

// ============= Multi-Ring, No Star ============ //
// buildArrangement(n, scale=1)
// ring n => 6 corners + bridging((n-1)*6) => 6n
// inside => entire arrangement for n-1 => scaled => no bridging to it
function buildArrangement(n, ringScale){
  nodes=[];
  connections=[]; // reset old

  // ring corners => scale outerCorners from centroid
  function getScaledCorners(scale){
    let arr=[];
    for(let i=0; i<6; i++){
      let ox= outerCorners[i].x;
      let oy= outerCorners[i].y;
      let x= centroid.x + (ox-centroid.x)* scale;
      let y= centroid.y + (oy-centroid.y)* scale;
      arr.push({ x,y });
    }
    return arr;
  }

  let id=1;
  function addRingRecursive(r, scale){
    // ring r => 6 corners + bridging(r-1) each edge => total 6r
    let ringCorners= getScaledCorners(scale);
    // 6 corners
    for(let i=0; i<6; i++){
      nodes.push({ x:ringCorners[i].x, y:ringCorners[i].y, id:id++ });
    }
    // bridging => (r-1)*6
    let bridgingCount= r-1;
    if(bridgingCount>0){
      for(let c=0; c<6; c++){
        let c1= ringCorners[c];
        let c2= ringCorners[(c+1)%6];
        for(let seg=1; seg<= bridgingCount; seg++){
          let t= seg/(bridgingCount+1);
          let mx= c1.x + t*(c2.x - c1.x);
          let my= c1.y + t*(c2.y - c1.y);
          nodes.push({ x:mx, y:my, id:id++ });
        }
      }
    }
    // inside => ring r-1 => scale*(r-1)/r
    if(r>1){
      let subScale= scale*(r-1)/r;
      addRingRecursive(r-1, subScale);
    }
  }

  addRingRecursive(n, ringScale);
}

// ============= TILING, expand loops ============= //
function tileHexNoGaps(){
  let side= dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y);
  let hexW= side*1.5;
  let hexH= sqrt(3)* side;

  // expand further => col=-5.. colCount+5, row=-5.. etc
  let colCount= ceil(width/hexW)+10;
  let rowCount= ceil(height/hexH)+10;

  for(let col=-5; col<colCount; col++){
    let xOff= col* hexW;
    for(let row=-5; row<rowCount; row++){
      let yOff= row* hexH;
      if(col%2!==0){
        yOff+= hexH*0.5;
      }
      push();
      translate(xOff,yOff);
      drawHexCell();
      pop();
      if(col%2!==0){
        yOff-= hexH*0.5;
      }
    }
  }
}
function drawHexCell(){
  for(let pair of connections){
    if(pair.length===2){
      let sId= pair[0];
      let eId= pair[1];
      let sN= nodes.find(nd=> nd.id===sId);
      let eN= nodes.find(nd=> nd.id===eId);
      if(sN && eN){
        drawConnectionWithSymmetry(sN,eN);
      }
    }
  }
}

// MOUSE => connect nodes
function mousePressed(){
  if(mouseX<0||mouseX>width||mouseY<0||mouseY>height)return;
  let foundId=null;
  for(let nd of nodes){
    if(dist(mouseX,mouseY, nd.x,nd.y)<10){
      foundId= nd.id; 
      break;
    }
  }
  if(foundId!==null){
    if(!connections.length || connections[connections.length-1].length===2){
      connections.push([foundId]);
    } else {
      connections[connections.length-1].push(foundId);
    }
    redraw();
  }
}

// CLEAR, UNDO, RANDOM
function resetConnections(){
  connections=[];
}
function undoConnection(){
  if(connections.length>0){
    connections.pop();
  }
}
function addRandomConnection(){
  if(nodes.length<2)return;
  let i1= floor(random(nodes.length));
  let i2= floor(random(nodes.length));
  if(i1===i2)return;
  connections.push([nodes[i1].id,nodes[i2].id]);
}

// ============= Symmetry + Curves ============= //
function drawConnectionWithSymmetry(p1,p2){
  stroke(lineColor);
  strokeWeight(2);

  // Always draw the base line
  drawCurvedBezier(p1,p2, curveAmount);

  // Based on symmetryMode, apply transformations
  if(symmetryMode==="none"){
    // no extra lines
    return;
  }
  else if(symmetryMode==="reflection_only"){
    // only reflect about vertical axis
    let sRef= reflectVertically(p1);
    let eRef= reflectVertically(p2);
    drawCurvedBezier(sRef,eRef, curveAmount);
  }
  else if(symmetryMode==="rotation"){
    // 6-fold rotation only
    let angles=[60,120,180,240,300];
    for(let a of angles){
      let sR= rotateCentroid(p1,a);
      let eR= rotateCentroid(p2,a);
      drawCurvedBezier(sR,eR, curveAmount);
    }
  }
  else if(symmetryMode==="rotation_reflection"){
    // 6-fold rotation + vertical reflection
    // step1: rotation
    let angles=[60,120,180,240,300];
    for(let a of angles){
      let sR= rotateCentroid(p1,a);
      let eR= rotateCentroid(p2,a);
      drawCurvedBezier(sR,eR, curveAmount);
    }
    // step2: vertical reflection of base
    let sRef= reflectVertically(p1);
    let eRef= reflectVertically(p2);
    drawCurvedBezier(sRef,eRef, curveAmount);

    // step3: vertical reflection of the rotated lines
    for(let a of angles){
      let sR= rotateCentroid(p1,a);
      let eR= rotateCentroid(p2,a);
      let sRR= reflectVertically(sR);
      let eRR= reflectVertically(eR);
      drawCurvedBezier(sRR,eRR, curveAmount);
    }
  }
}

// Normal-offset curve
function drawCurvedBezier(p1,p2,cAmt){
  let scaleF=0.01;
  let sign=(cAmt>=0)?1:-1;
  let mag= abs(cAmt)* scaleF;
  if(mag<0.0001){
    // effectively a straight line
    line(p1.x,p1.y, p2.x,p2.y);
    return;
  }
  let mx=(p1.x+p2.x)*0.5;
  let my=(p1.y+p2.y)*0.5;
  let dx=p2.x-p1.x;
  let dy=p2.y-p1.y;
  let distLine= sqrt(dx*dx+ dy*dy);
  let nx=-dy, ny=dx;
  let ln= sqrt(nx*nx + ny*ny);
  if(ln<0.0001)return;
  nx/=ln; ny/=ln;

  let offset= distLine* mag* sign;
  let c1x= mx + nx*offset;
  let c1y= my + ny*offset;
  let c2x=c1x, c2y=c1y;

  noFill();
  bezier(p1.x,p1.y, c1x,c1y, c2x,c2y, p2.x,p2.y);
}

// rotate + reflect about centroid
function rotateCentroid(pt, angleDeg){
  let rad=radians(angleDeg);
  let dx= pt.x - centroid.x;
  let dy= pt.y - centroid.y;
  return {
    x: centroid.x + dx*cos(rad) - dy*sin(rad),
    y: centroid.y + dx*sin(rad) + dy*cos(rad)
  };
}
function reflectVertically(pt){
  return {
    x: 2*centroid.x - pt.x,
    y: pt.y
  };
}
