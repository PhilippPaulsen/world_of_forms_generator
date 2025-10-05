/**
 * sketch.js
 * 
 * Main sketch file for the consolidated World of Forms Generator.
 * Handles UI, event handling, drawing, and symmetry.
 */

let canvasW = 320;
let canvasH = 320;

let shapeSizeFactor = 1;
let nodeCount = 1;
let curveAmount = 0;
let symmetryMode = "rotation_reflection6";
let lineColor = "#000000";
let showNodes = true;
let currentShape = 'hex';

let outerCorners = [];
let centroid = { x: 0, y: 0 };
let nodes = [];
let connections = [];

function setup() {
    /************************************************************
     * 1) CREATE CANVAS
     ************************************************************/
    const sizeSlider = select("#canvas-size-slider");
    canvasW = parseInt(sizeSlider.value()) || 320;
    canvasH = canvasW;
    createCanvas(canvasW, canvasH).parent("canvas-container");
    noLoop();

    /************************************************************
     * 2) HOOK UP UI
     ************************************************************/
    sizeSlider.input(() => {
        let oldW = canvasW, oldH = canvasH;
        canvasW = parseInt(sizeSlider.value()) || 320;
        canvasH = canvasW;
        let scaleX = canvasW / oldW;
        let scaleY = canvasH / oldH;

        resizeCanvas(canvasW, canvasH);

        for (let nd of nodes) {
            nd.x = nd.x * scaleX;
            nd.y = nd.y * scaleY;
        }
        for (let c of outerCorners) {
            c.x *= scaleX;
            c.y *= scaleY;
        }
        centroid.x *= scaleX;
        centroid.y *= scaleY;

        redraw();
    });

    const shapeSlider = select("#square-size-slider");
    shapeSizeFactor = parseInt(shapeSlider.value()) || 1;
    shapeSlider.input(() => {
        shapeSizeFactor = parseInt(shapeSlider.value()) || 1;
        rebuildGrid(currentShape);
        redraw();
    });

    const nSlider = select("#node-slider");
    nodeCount = parseInt(nSlider.value()) || 1;
    nSlider.input(() => {
        nodeCount = parseInt(nSlider.value()) || 1;
        rebuildGrid(currentShape);
        redraw();
    });

    const cSlider = select("#curve-slider");
    curveAmount = parseInt(cSlider.value()) || 0;
    cSlider.input(() => {
        curveAmount = parseInt(cSlider.value()) || 0;
        redraw();
    });

    const symDropdown = select("#symmetry-dropdown");
    symmetryMode = symDropdown.value();
    symDropdown.changed(() => {
        symmetryMode = symDropdown.value();
        redraw();
    });

    const colorPicker = select("#line-color-picker");
    lineColor = colorPicker.value();
    colorPicker.input(() => {
        lineColor = colorPicker.value();
        redraw();
    });

    const nodeCB = select("#toggle-nodes");
    showNodes = nodeCB.elt.checked;
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

    // Added export button handler
    select("#export-button").mousePressed(() => saveCanvas("world_of_forms", "png"));

    document.getElementById("shape-dropdown").addEventListener("change", e => {
        currentShape = e.target.value;
        rebuildGrid(currentShape);
        redraw();
    });

    // Added dark mode toggle handler
    document.getElementById("darkmode-toggle").addEventListener("change", e => {
        document.body.classList.toggle("dark", e.target.checked);
        redraw();
    });

    rebuildGrid(currentShape);
}

function rebuildGrid(shape) {
    connections = [];
    let grid;
    if (shape === 'triangle') {
        grid = buildTriangleGrid(nodeCount, shapeSizeFactor, canvasW, canvasH);
    } else if (shape === 'square') {
        grid = buildSquareGrid(nodeCount, shapeSizeFactor, canvasW, canvasH);
    } else {
        grid = buildHexGrid(nodeCount, shapeSizeFactor, canvasW, canvasH);
    }
    nodes = grid.nodes;
    centroid = grid.centroid;
    outerCorners = grid.outerCorners;
}

function draw() {
    // Adjust background for dark mode
    if (document.body.classList.contains("dark")) {
        background(30); // Dark background
    } else {
        background(255); // Light background
    }
    drawTessellation();

    if (showNodes) {
        noStroke();
        // Added node hover effect
        for (let nd of nodes) {
            let d = dist(mouseX, mouseY, nd.x, nd.y);
            if (d < 10) {
                fill("#ff3b30"); // Apple-Red for hover
            } else {
                if (document.body.classList.contains("dark")) {
                    fill(255);
                } else {
                    fill(0);
                }
            }
            ellipse(nd.x, nd.y, 6, 6);
        }
    }
}

// Added mouseMoved to enable hover effect
function mouseMoved() {
    if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        redraw();
    }
}

function drawTessellation() {
    if (currentShape === 'hex') {
        tileHexNoGaps();
    } else if (currentShape === 'square') {
        tileSquareNoGaps();
    } else if (currentShape === 'triangle') {
        tileTriangleNoGaps();
    }
}

function drawShapeCell() {
    for (const conn of connections) {
        if (conn.length === 2) {
            const node1 = nodes.find(n => n.id === conn[0]);
            const node2 = nodes.find(n => n.id === conn[1]);
            if (node1 && node2) {
                drawConnectionWithSymmetry(node1, node2);
            }
        }
    }
}

function tileHexNoGaps() {
    if (outerCorners.length < 2) return;
    let side = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y);
    let hexW = side * 1.5;
    let hexH = sqrt(3) * side;

    let colCount = ceil(width / hexW);
    let rowCount = ceil(height / hexH);

    for (let col = -colCount; col < colCount * 2; col++) {
        let xOff = col * hexW;
        for (let row = -rowCount; row < rowCount * 2; row++) {
            let yOff = row * hexH;
            if (col % 2 !== 0) {
                yOff += hexH * 0.5;
            }
            push();
            translate(xOff, yOff);
            drawShapeCell();
            pop();
        }
    }
}

function tileSquareNoGaps() {
    if (outerCorners.length < 2) return;
    // Corrected squareSize calculation for accurate tiling
    const squareSize = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y);
    const tilesNeeded = Math.ceil(canvasW / squareSize) + 4;
    const tileCount = Math.max(2, Math.ceil(tilesNeeded / 2));

    for (let i = -tileCount; i <= tileCount; i++) {
        for (let j = -tileCount; j <= tileCount; j++) {
            const offsetX = i * squareSize;
            const offsetY = j * squareSize;

            push();
            translate(offsetX, offsetY);
            drawShapeCell();
            pop();
        }
    }
}

function tileTriangleNoGaps() {
    if (outerCorners.length < 3) return;
    // Corrected tiling values for triangles
    const s = dist(outerCorners[1].x, outerCorners[1].y, outerCorners[2].x, outerCorners[2].y);
    const rowH = s * sqrt(3) / 2;
    const colW = s;

    let colCount = ceil(width / colW) + 4;
    let rowCount = ceil(height / rowH) + 4;

    for (let row = -rowCount; row < rowCount * 2; row++) {
        let yOff = row * rowH;
        for (let col = -colCount; col < colCount * 2; col++) {
            let xOff = col * colW;
            if (row % 2 !== 0) {
                xOff += s / 2;
            }
            push();
            translate(xOff, yOff);
            drawShapeCell();
            pop();
        }
    }
}

function mousePressed() {
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
    let foundId = null;
    for (let nd of nodes) {
        if (dist(mouseX, mouseY, nd.x, nd.y) < 20) {
            foundId = nd.id;
            break;
        }
    }
    if (foundId !== null) {
        if (!connections.length || connections[connections.length - 1].length === 2) {
            connections.push([foundId]);
        } else {
            connections[connections.length - 1].push(foundId);
        }
        redraw();
    }
}

function addRandomConnection() {
    if (nodes.length < 2) return;
    let i1 = floor(random(nodes.length));
    let i2 = floor(random(nodes.length));
    if (i1 === i2) return;
    connections.push([nodes[i1].id, nodes[i2].id]);
}

function drawConnectionWithSymmetry(p1, p2) {
    // Set line color based on dark mode
    if (document.body.classList.contains("dark")) {
        stroke(255); // White in dark mode
    } else {
        stroke(lineColor);
    }
    strokeWeight(2);

    drawCurvedBezier(p1, p2, curveAmount);

    switch (symmetryMode) {
        case "reflection_only":
            let sRef = reflectVertically(p1);
            let eRef = reflectVertically(p2);
            drawCurvedBezier(sRef, eRef, curveAmount);
            break;
        case "rotation3":
            [120, 240].forEach(a => {
                let sR = rotateCentroid(p1, a);
                let eR = rotateCentroid(p2, a);
                drawCurvedBezier(sR, eR, curveAmount);
            });
            break;
        case "rotation6":
            [60, 120, 180, 240, 300].forEach(a => {
                let sR = rotateCentroid(p1, a);
                let eR = rotateCentroid(p2, a);
                drawCurvedBezier(sR, eR, curveAmount);
            });
            break;
        case "rotation_reflection3":
            [120, 240].forEach(a => {
                let sR = rotateCentroid(p1, a);
                let eR = rotateCentroid(p2, a);
                drawCurvedBezier(sR, eR, curveAmount);
                let sRR = reflectVertically(sR);
                let eRR = reflectVertically(eR);
                drawCurvedBezier(sRR, eRR, curveAmount);
            });
            let sRef_ = reflectVertically(p1);
            let eRef_ = reflectVertically(p2);
            drawCurvedBezier(sRef_, eRef_, curveAmount);
            break;
        case "rotation_reflection6":
            [60, 120, 180, 240, 300].forEach(a => {
                let sR = rotateCentroid(p1, a);
                let eR = rotateCentroid(p2, a);
                drawCurvedBezier(sR, eR, curveAmount);
                let sRR = reflectVertically(sR);
                let eRR = reflectVertically(eR);
                drawCurvedBezier(sRR, eRR, curveAmount);
            });
            let sRef__ = reflectVertically(p1);
            let eRef__ = reflectVertically(p2);
            drawCurvedBezier(sRef__, eRef__, curveAmount);
            break;
    }
}

function drawCurvedBezier(p1, p2, cAmt) {
    let scaleF = 0.01;
    let sign = (cAmt >= 0) ? 1 : -1;
    let mag = abs(cAmt) * scaleF;
    if (mag < 0.0001) {
        line(p1.x, p1.y, p2.x, p2.y);
        return;
    }
    let mx = (p1.x + p2.x) / 2;
    let my = (p1.y + p2.y) / 2;
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let distLine = sqrt(dx * dx + dy * dy);
    let nx = -dy, ny = dx;
    let ln = sqrt(nx * nx + ny * ny);
    if (ln < 0.0001) return;
    nx /= ln; ny /= ln;

    let offset = distLine * mag * sign;
    let c1x = mx + nx * offset;
    let c1y = my + ny * offset;

    noFill();
    bezier(p1.x, p1.y, c1x, c1y, c1x, c1y, p2.x, p2.y);
}

function rotateCentroid(pt, angleDeg) {
    let rad = radians(angleDeg);
    let dx = pt.x - centroid.x;
    let dy = pt.y - centroid.y;
    return {
        x: centroid.x + dx * cos(rad) - dy * sin(rad),
        y: centroid.y + dx * sin(rad) + dy * cos(rad)
    };
}

function reflectVertically(pt) {
    return {
        x: 2 * centroid.x - pt.x,
        y: pt.y
    };
}
