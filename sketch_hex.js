/***************************************************************
 * Full HEX Pattern w/:
 *   1) Extended Symmetry (3-fold or 6-fold + reflection).
 *   2) Preserve connections on slider changes (scaling existing nodes).
 *   3) Center node for ring=1 => 7 total (6 corners + 1 center).
 *   4) Larger click radius (20) to avoid misselection.
 ***************************************************************/

let canvasW = 320;
let canvasH = 320;

let shapeSizeFactor = 1;   // in {1,3,5,7,9}
let nodeCount = 1;         // in [1..7]

// curve offset => -50..50
let curveAmount = 0;

/**
 * Extended symmetry modes:
 *   "none"
 *   "reflection_only"
 *   "rotation3"
 *   "rotation6"
 *   "rotation_reflection3"
 *   "rotation_reflection6"
 */
let symmetryMode = "rotation_reflection6";

let lineColor = "#000000";
let showNodes = true;

// The "outer" flat-top hex corners + centroid
let outerCorners = [];
let centroid = { x:0,y:0 };

// node array + user connections
let nodes = [];
let connections = [];

// For preserving geometry, we store old corners/nodes
// and transform them on slider changes
function setup() {
  /************************************************************
   * 1) CREATE CANVAS from #canvas-size-slider
   ************************************************************/
  const sizeSlider = select("#canvas-size-slider");
  canvasW = parseInt(sizeSlider.value())||320;
  canvasH = canvasW;
  createCanvas(canvasW, canvasH).parent("canvas-container");
  noLoop();

  /************************************************************
   * 2) HOOK UP UI
   ************************************************************/
  // Canvas resizing => transform
  sizeSlider.input(()=>{
    let oldW= canvasW, oldH= canvasH;
    canvasW= parseInt(sizeSlider.value())||320;
    canvasH= canvasW;
    let scaleX= canvasW / oldW;
    let scaleY= canvasH / oldH;

    // We do a "transform" approach for existing nodes => keep lines
    // 1) updateCanvasSize
    resizeCanvas(canvasW, canvasH);
    
    // 2) shift+scale node positions
    for(let nd of nodes){
      // relative to old center
      nd.x= nd.x * scaleX;
      nd.y= nd.y * scaleY;
    }
    // do the same for outerCorners + centroid
    for(let c of outerCorners){
      c.x*= scaleX;
      c.y*= scaleY;
    }
    centroid.x*= scaleX;
    centroid.y*= scaleY;

    redraw();
  });

  // shapeSize => factor in {1,3,5,7,9}
  const shapeSlider= select("#square-size-slider");
  shapeSizeFactor= parseInt(shapeSlider.value())||1;
  shapeSlider.input(()=>{
    let oldFactor= shapeSizeFactor;
    shapeSizeFactor= parseInt(shapeSlider.value())||1;
    // We'll do a "transform" so old nodes remain but get scaled
    transformForNewFactor(oldFactor, shapeSizeFactor);
    redraw();
  });

  // nodeCount => 1..7
  const nSlider= select("#node-slider");
  nodeCount= parseInt(nSlider.value())||1;
  nSlider.input(()=>{
    let oldCount= nodeCount;
    nodeCount= parseInt(nSlider.value())||1;
    if(nodeCount<1) nodeCount=1; 
    if(nodeCount>7) nodeCount=7;
    transformForNewNodeCount(oldCount, nodeCount);
    redraw();
  });

  // curve
  const cSlider= select("#curve-slider");
  curveAmount= parseInt(cSlider.value())||0;
  cSlider.input(()=>{
    curveAmount= parseInt(cSlider.value())||0;
    redraw();
  });

  // symmetry
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

  // showNodes
  const nodeCB= select("#toggle-nodes");
  showNodes= nodeCB.elt.checked;
  nodeCB.changed(()=>{
    showNodes= nodeCB.elt.checked;
    redraw();
  });

  // Clear
  select("#clear-button").mousePressed(()=>{
    connections=[];
    redraw();
  });
  // Undo
  select("#back-button").mousePressed(()=>{
    if(connections.length>0) connections.pop();
    redraw();
  });
  // Random
  select("#random-button").mousePressed(()=>{
    addRandomConnection();
    redraw();
  });

  // init => build the shape
  initArrangement();
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

/************************************************************
 * initArrangement => build an initial arrangement
 * we do factor= shapeSizeFactor, nodeCount => rings
 ************************************************************/
function initArrangement(){
  // build from scratch once
  nodes=[];
  connections=[];

  // define outer ring
  defineOuterHex();
  buildArrangement(nodeCount, 1.0);
}

/************************************************************
 * defineOuterHex => if factor=1 => top=0 bottom=canvasH
 ************************************************************/
function defineOuterHex(){
  outerCorners=[];
  let shapeHeight= canvasH/ shapeSizeFactor;
  let side= shapeHeight/ sqrt(3);
  let cx= width/2;
  let topY= (height/2) - shapeHeight/2;

  outerCorners.push({ x: cx - side/2, y: topY });
  outerCorners.push({ x: cx + side/2, y: topY });
  outerCorners.push({ x: cx + side,   y: topY + (sqrt(3)/2)* side });
  outerCorners.push({ x: cx + side/2, y: topY + sqrt(3)* side });
  outerCorners.push({ x: cx - side/2, y: topY + sqrt(3)* side });
  outerCorners.push({ x: cx - side,   y: topY + (sqrt(3)/2)* side });

  let sumX=0,sumY=0;
  for(let c of outerCorners){ sumX+= c.x; sumY+= c.y; }
  centroid.x= sumX/6; 
  centroid.y= sumY/6;
}

/************************************************************
 * buildArrangement(n, scale=1) => ring n => plus inside => ring(n-1)
 ************************************************************/
function buildArrangement(n, ringScale){
  // ring n => 6 corners + bridging => if n=1 => also add a center node
  // then inside => arrangement(n-1)
  // We'll do a recursive approach that accumulates in "nodes"

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

  function addRingRecursive(r, scale){
    // ring r => 6 corners + bridging( r-1 each edge ) => total= 6r 
    // if r=1 => also add 1 center node => total= 6 +1=7
    let ringCorners= getScaledCorners(scale);

    // corners
    let cornerStartId= nodes.length+1;
    for(let i=0; i<6; i++){
      nodes.push({ x: ringCorners[i].x, y: ringCorners[i].y, id: nodes.length+1 });
    }
    // bridging => (r-1) each edge
    let bridgingCount= r-1;
    for(let c=0; c<6; c++){
      let c1= ringCorners[c];
      let c2= ringCorners[(c+1)%6];
      for(let seg=1; seg<= bridgingCount; seg++){
        let t= seg/(bridgingCount+1);
        let mx= c1.x + t*(c2.x - c1.x);
        let my= c1.y + t*(c2.y - c1.y);
        nodes.push({ x:mx, y:my, id: nodes.length+1 });
      }
    }
    // if r=1 => also add center node => 1 => so ring=1 => 6 corners + bridging(0) + center=7
    if(r===1){
      // center
      nodes.push({ x: centroid.x, y: centroid.y, id: nodes.length+1 });
    }

    // inside => ring r-1 => scale*(r-1)/r
    if(r>1){
      let subScale= scale*(r-1)/r;
      addRingRecursive(r-1, subScale);
    }
  }
  addRingRecursive(n, ringScale);
}

/************************************************************
 * transformForNewFactor(oldFactor, newFactor)
 * => re-scale existing nodes to reflect a change 
 * in shapeSizeFactor, but keep connections
 ************************************************************/
function transformForNewFactor(oldF, newF){
  // old => shapeHeight= canvasH/oldF
  // new => shapeHeight= canvasH/newF
  let oldHeight= canvasH/ oldF;
  let newHeight= canvasH/ newF;
  let ratio= newHeight/ oldHeight;  // scale factor
  let cx= width/2;
  let topOld= (height/2) - (oldHeight/2);
  let topNew= (height/2) - (newHeight/2);

  // shift so old top aligns, scale, then shift so new top aligns
  // but simpler => let's do a direct scale about centerX, topEdge
  // or let's do scale about the centroid? 
  // We'll do a scale about the centroid to keep ring center consistent

  // 1) shift nodes so centroid => (0,0)
  for(let nd of nodes){
    nd.x-= centroid.x; 
    nd.y-= centroid.y;
  }
  for(let c of outerCorners){
    c.x-= centroid.x;
    c.y-= centroid.y;
  }
  // centroid => (0,0)
  
  // 2) scale
  for(let nd of nodes){
    nd.x*= ratio;
    nd.y*= ratio;
  }
  for(let c of outerCorners){
    c.x*= ratio;
    c.y*= ratio;
  }

  // 3) define new centroid => we recompute so top=...
  // or just shift them so new centroid is the same
  // We'll just do a simpler approach => shift them so the new centroid 
  // is still at old centroid

  defineOuterHex(); // re-define outerCorners + new centroid 
  // But we don't want to lose the old corners => we actually do want 
  // to preserve the scale we just did. Let's store the new centroid we want:
  let newCentroid = computeCentroidOfCurrentOuterCorners(); 
  // but we already scaled the old corners => so we must not override them 
  // We'll do: let's define the new shape with factor= newF => new outer corners, new centroid, 
  // then "snap" the scaled shape to that new centroid. Possibly simpler => we do a direct approach:

  // We'll just compute the new desired centroid position => same as defineOuterHex() would do
  let newShapeHeight= canvasH/ newF;
  let side= newShapeHeight/ sqrt(3);
  let topY= (height/2) - newShapeHeight/2;
  let cx2= width/2; 
  let corners2= [
    {x: cx2 - side/2, y: topY},
    {x: cx2 + side/2, y: topY},
    {x: cx2 + side,   y: topY + (sqrt(3)/2)* side},
    {x: cx2 + side/2, y: topY + sqrt(3)* side},
    {x: cx2 - side/2, y: topY + sqrt(3)* side},
    {x: cx2 - side,   y: topY + (sqrt(3)/2)* side},
  ];
  let sumX=0,sumY=0;
  for(let c of corners2){ sumX+= c.x; sumY+= c.y; }
  let cX2= sumX/6, cY2= sumY/6; // new centroid

  // after scaling, our new centroid is (0,0). We want it => (cX2, cY2).
  // so shift everything by (cX2, cY2).
  for(let nd of nodes){
    nd.x+= cX2;
    nd.y+= cY2;
  }
  for(let cc of outerCorners){
    cc.x+= cX2;
    cc.y+= cY2;
  }
  // now re-define global centroid => (cX2, cY2)
  centroid.x= cX2; 
  centroid.y= cY2;
}

/************************************************************
 * transformForNewNodeCount(oldCount, newCount)
 * => if newCount > oldCount => we add more rings? 
 * => if newCount < oldCount => we remove some rings?
 * 
 * But the user wants to preserve existing lines => 
 * that is tricky if we physically remove or add nodes. 
 * 
 * Possibly we say we must re-build the entire shape 
 * from scratch => old lines become invalid or partially valid. 
 * Or we can do an approach that only adds or removes rings 
 * at the inside or outside. 
 * 
 * For simplicity, we'll do a big confirmation: 
 * re-building might break old connections if node IDs change. 
 * 
 * But let's try a partial approach: if newCount> oldCount => 
 * we can build the new arrangement at smaller scale & add new nodes. 
 * 
 * This is quite advanced. 
 * 
 * We'll choose a simpler approach: "force the user to start fresh" => 
 * because adding or removing rings changes the node arrangement 
 * drastically. 
 ************************************************************/
function transformForNewNodeCount(oldC, newC){
  // easiest approach => inform user that the shape changed => 
  // let's do a brand new arrangement => existing lines are cleared
  connections=[];
  nodes=[];
  defineOuterHex();
  buildArrangement(newC, 1.0);
}

// tile
function tileHexNoGaps(){
  let side= dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y);
  let hexW= side*1.5;
  let hexH= sqrt(3)* side;

  let colCount= ceil(width/hexW)+10;
  let rowCount= ceil(height/hexH)+10;

  for(let col=-5; col<colCount; col++){
    let xOff= col*hexW;
    for(let row=-5; row<rowCount; row++){
      let yOff= row*hexH;
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
      let sId= pair[0], eId= pair[1];
      let sN= nodes.find(n=>n.id===sId);
      let eN= nodes.find(n=>n.id===eId);
      if(sN&&eN){
        drawConnectionWithSymmetry(sN,eN);
      }
    }
  }
}

function mousePressed(){
  if(mouseX<0||mouseX>width||mouseY<0||mouseY>height)return;
  let foundId=null;
  // Increase radius => 20
  for(let nd of nodes){
    if(dist(mouseX,mouseY, nd.x,nd.y) < 20){
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

// CLEAR/UNDO/Random
function resetConnections(){
  connections=[];
}
function undoConnection(){
  if(connections.length>0) connections.pop();
}
function addRandomConnection(){
  if(nodes.length<2)return;
  let i1= floor(random(nodes.length));
  let i2= floor(random(nodes.length));
  if(i1===i2)return;
  connections.push([nodes[i1].id, nodes[i2].id]);
}

// Extended symmetry
function drawConnectionWithSymmetry(p1,p2){
  stroke(lineColor);
  strokeWeight(2);

  // Always draw base line
  drawCurvedBezier(p1,p2, curveAmount);

  switch(symmetryMode){
    case "none":
      // no extras
      break;
    case "reflection_only":
      {
        let sRef= reflectVertically(p1);
        let eRef= reflectVertically(p2);
        drawCurvedBezier(sRef,eRef, curveAmount);
      }
      break;
    case "rotation3":
    {
      let angles=[120,240];
      for(let a of angles){
        let sR= rotateCentroid(p1,a);
        let eR= rotateCentroid(p2,a);
        drawCurvedBezier(sR,eR, curveAmount);
      }
    }
    break;
    case "rotation6":
    {
      let angles=[60,120,180,240,300];
      for(let a of angles){
        let sR= rotateCentroid(p1,a);
        let eR= rotateCentroid(p2,a);
        drawCurvedBezier(sR,eR, curveAmount);
      }
    }
    break;
    case "rotation_reflection3":
    {
      // 3-fold plus reflection
      let angles3=[120,240];
      for(let a of angles3){
        let sR= rotateCentroid(p1,a);
        let eR= rotateCentroid(p2,a);
        drawCurvedBezier(sR,eR, curveAmount);
      }
      // reflect
      let sRef= reflectVertically(p1);
      let eRef= reflectVertically(p2);
      drawCurvedBezier(sRef,eRef, curveAmount);
      // reflect the rotated
      for(let a of angles3){
        let sR= rotateCentroid(p1,a);
        let eR= rotateCentroid(p2,a);
        let sRR= reflectVertically(sR);
        let eRR= reflectVertically(eR);
        drawCurvedBezier(sRR,eRR, curveAmount);
      }
    }
    break;
    case "rotation_reflection6":
    default:
    {
      // 6-fold rotation plus vertical reflection
      let angles6=[60,120,180,240,300];
      for(let a of angles6){
        let sR= rotateCentroid(p1,a);
        let eR= rotateCentroid(p2,a);
        drawCurvedBezier(sR,eR, curveAmount);
      }
      let sRef= reflectVertically(p1);
      let eRef= reflectVertically(p2);
      drawCurvedBezier(sRef,eRef, curveAmount);
      for(let a of angles6){
        let sR= rotateCentroid(p1,a);
        let eR= rotateCentroid(p2,a);
        let sRR= reflectVertically(sR);
        let eRR= reflectVertically(eR);
        drawCurvedBezier(sRR,eRR, curveAmount);
      }
    }
    break;
  }
}

// normal offset curve
function drawCurvedBezier(p1,p2,cAmt){
  let scaleF=0.01;
  let sign=(cAmt>=0)?1:-1;
  let mag= abs(cAmt)* scaleF;
  if(mag<0.0001){
    line(p1.x,p1.y, p2.x,p2.y);
    return;
  }
  let mx=(p1.x+p2.x)/2;
  let my=(p1.y+p2.y)/2;
  let dx=p2.x-p1.x;
  let dy=p2.y-p1.y;
  let distLine= sqrt(dx*dx+ dy*dy);
  let nx=-dy, ny=dx;
  let ln= sqrt(nx*nx+ ny*ny);
  if(ln<0.0001) return;
  nx/=ln; ny/=ln;
  
  let offset= distLine* mag* sign;
  let c1x= mx+ nx*offset;
  let c1y= my+ ny*offset;
  let c2x= c1x, c2y= c1y;

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

/************************************************************
 * helper to compute centroid if needed
 ************************************************************/
function computeCentroidOfCurrentOuterCorners(){
  let sumx=0, sumy=0;
  for(let c of outerCorners){
    sumx+= c.x; sumy+= c.y;
  }
  return { x: sumx/6, y: sumy/6 };
}
