// === WORLD OF FORMS – STABLE SKETCH ===============================
// Core features restored with correct tiling & symmetry per shape.
// - Nodes are clickable in the center tile.
// - Tiling clones are drawn via local centroids (no global centroid bleed).
// - Square uses 4-fold rotation, Triangle 3-fold, Hex 6-fold when chosen.
// - Hex gets a center node when nodeCount == 1.
// - Background always white; nodes black, hover red.
//
// Ported from die-welt-der-formen/p5_prototype/sketch.js, with the
// shape-size, symmetry-mode, and line-color controls re-added on top
// (dropped there in favor of a simpler public-site UI, but kept here
// since this repo is the full-featured development environment).
// This file is the UI shell: DOM/event wiring (setup), the render loop
// (draw/mouseMoved), and interaction (mousePressed/addRandomConnection).
// The generative engine itself (grid generation, state, symmetry,
// curves, tiling, export) lives in core/, loaded separately - see
// CLAUDE.md for the module map.

// ----------------- HELPERS --------------------------------------
function normSym(val) {
    // Dropdown option values are already canonical tokens (see index.html),
    // so this just validates against the set drawConnectionWithSymmetry()
    // actually recognizes and falls back safely otherwise. (The original
    // version of this function parsed human-readable option *text* like
    // "3-fold + Reflection" - that never matched this dropdown's `value`
    // attributes, so every option except "None"/"Reflection" silently
    // collapsed to full 6-fold+reflection symmetry. Fixed here.)
    const validModes = ['none', 'reflection_only', 'rotation3', 'rotation6', 'rotation_reflection3', 'rotation_reflection6'];
    const v = (val || '').toLowerCase().trim();
    return validModes.includes(v) ? v : 'rotation_reflection6';
}

// ----------------- SETUP ----------------------------------------
function setup() {
    // Canvas size (Hidden input, default 600)
    const sizeSlider = select('#canvas-size-slider');
    canvasW = parseInt(sizeSlider?.value()) || 600;
    canvasH = canvasW;
    createCanvas(canvasW, canvasH).parent('canvas-container');
    noLoop();

    // Shape selection via Icons (Common class .shape-icon-btn)
    const shapeBtns = selectAll('.shape-icon-btn');
    shapeBtns.forEach(btn => {
        btn.mousePressed(() => {
            // Remove active class from all
            shapeBtns.forEach(b => b.removeClass('active'));
            // Add to current
            btn.addClass('active');
            // Set shape
            currentShape = btn.attribute('data-shape');
            rebuildGrid(currentShape);
            redraw();
        });
    });

    // Shape size (Number Input)
    const shapeInput = select('#shape-size-input');
    if (shapeInput) {
        shapeSizeFactor = parseInt(shapeInput.value()) || 5;
        shapeInput.input(() => {
            let v = parseInt(shapeInput.value());
            if (v < 1) v = 1; if (v > 9) v = 9; // Clamp
            shapeSizeFactor = v;
            rebuildGrid(currentShape);
            redraw();
        });
    }

    // Node count (Number Input)
    const nodeInput = select('#node-count-input');
    if (nodeInput) {
        nodeCount = parseInt(nodeInput.value()) || 3;
        nodeInput.input(() => {
            let v = parseInt(nodeInput.value());
            if (v < 1) v = 1; if (v > 5) v = 5; // Clamp
            nodeCount = v;
            rebuildGrid(currentShape);
            redraw();
        });
    }

    // Symmetry Mode (Dropdown)
    const symDropdown = select('#symmetry-dropdown');
    if (symDropdown) {
        symmetryMode = normSym(symDropdown.value());
        symDropdown.changed(() => {
            symmetryMode = normSym(symDropdown.value());
            redraw();
        });
    }

    // Line Color (Color Picker)
    const colorPicker = select('#line-color-picker');
    if (colorPicker) {
        lineColor = colorPicker.value() || '#000000';
        colorPicker.input(() => {
            lineColor = colorPicker.value();
            redraw();
        });
    }

    // Curve Toggle Button
    const curveBtn = select('#btn-toggle-curve');
    if (curveBtn) {
        curveBtn.mousePressed(() => {
            if (curveAmount === 0) {
                curveAmount = 25; // Enable curve
                curveBtn.addClass('active');
            } else {
                curveAmount = 0; // Disable curve
                curveBtn.removeClass('active');
            }
            redraw();
        });
    }

    // Free Endpoints Toggle Button
    const freeEndpointsBtn = select('#btn-toggle-free-endpoints');
    if (freeEndpointsBtn) {
        freeEndpointsBtn.mousePressed(() => {
            freeEndpointsEnabled = !freeEndpointsEnabled;
            if (freeEndpointsEnabled) freeEndpointsBtn.addClass('active');
            else freeEndpointsBtn.removeClass('active');
        });
    }

    // Show nodes Toggle Button
    const nodeBtn = select('#btn-toggle-nodes');
    if (nodeBtn) {
        nodeBtn.mousePressed(() => {
            showNodes = !showNodes;
            if (showNodes) {
                nodeBtn.addClass('active');
                nodeBtn.html('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>');
            } else {
                nodeBtn.removeClass('active');
                nodeBtn.html('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/></svg>'); // Eye Off
            }
            redraw();
        });
    }

    // Action Buttons
    const clearBtn = select('#btn-clear');
    clearBtn && clearBtn.mousePressed(() => {
        connections = [];
        redoStack = []; // Clear redo on clear
        redraw();
    });

    const backBtn = select('#btn-undo');
    backBtn && backBtn.mousePressed(() => {
        if (connections.length) {
            redoStack.push(connections.pop()); // Push to redo stack
            redraw();
        }
    });

    const redoBtn = select('#btn-redo');
    redoBtn && redoBtn.mousePressed(() => {
        if (redoStack.length) {
            connections.push(redoStack.pop()); // Pop from redo stack
            redraw();
        }
    });

    const randBtn = select('#btn-random');
    randBtn && randBtn.mousePressed(() => {
        addRandomConnection();
        redoStack = []; // Clear redo on new action
        redraw();
    });

    // Export Dialog (PNG / JSON / SVG)
    const dlBtn = select('#btn-save');
    const exportOverlay = select('#export-overlay');
    const closeExportBtn = select('#close-export');

    if (dlBtn && exportOverlay) {
        dlBtn.mousePressed(() => {
            exportOverlay.removeClass('hidden');
        });
        closeExportBtn && closeExportBtn.mousePressed(() => {
            exportOverlay.addClass('hidden');
        });
        // Close on background click
        exportOverlay.mousePressed((e) => {
            if (e.target.id === 'export-overlay') exportOverlay.addClass('hidden');
        });
    }

    const pngBtn = select('#export-png');
    pngBtn && pngBtn.mousePressed(() => {
        exportPNG();
        exportOverlay && exportOverlay.addClass('hidden');
    });

    const jsonBtn = select('#export-json');
    jsonBtn && jsonBtn.mousePressed(() => {
        exportJSON();
        exportOverlay && exportOverlay.addClass('hidden');
    });

    const svgBtn = select('#export-svg');
    svgBtn && svgBtn.mousePressed(() => {
        exportSVG();
        exportOverlay && exportOverlay.addClass('hidden');
    });

    // Help Button Logic
    const helpBtn = select('#btn-help');
    const helpOverlay = select('#help-overlay');
    const closeHelpBtn = select('#close-help');

    if (helpBtn && helpOverlay) {
        helpBtn.mousePressed(() => {
            helpOverlay.removeClass('hidden');
        });
        closeHelpBtn && closeHelpBtn.mousePressed(() => {
            helpOverlay.addClass('hidden');
        });
        // Close on background click
        helpOverlay.mousePressed((e) => {
            if (e.target.id === 'help-overlay') helpOverlay.addClass('hidden');
        });
    }

    rebuildGrid(currentShape);
    // Draw a random connection on start
    addRandomConnection();
    redraw();
}

// ----------------- DRAW -----------------------------------------
function draw() {
    // Force Light Mode / Standard Style
    // Hintergrund exakt wie Bedienfeld (oder weiß)
    const bgColor = getComputedStyle(document.body).getPropertyValue('--panel-bg-color') || '#ffffff';
    background(bgColor);

    // Linienfarbe wie Picker/CSS, keine Füllung für die Kurven
    stroke(lineColor);
    noFill();

    drawTessellation();

    // Knoten (Hover rot)
    if (showNodes) {
        push();
        noStroke();
        nodes.forEach(nd => {
            const d = dist(mouseX, mouseY, nd.x, nd.y);
            // Default: Schwarz (Grid) / Blau (frei) oder Rot bei Hover
            fill(d < 10 ? color(220, 0, 0) : (nd.free ? color(30, 110, 220) : color(0)));
            ellipse(nd.x, nd.y, 6, 6);
        });
        pop();
    }

    // Draw Canvas Border (Frame)
    push();
    noFill();
    stroke(lineColor); // Use same color as lines (usually black) or fixed black
    strokeWeight(4);   // 4px border (doubled)
    rect(0, 0, width, height);
    pop();
}

function mouseMoved() { if (showNodes) redraw(); }

// ----------------- GRID & TILING -------------------------------
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
    const cols = ceil(width / s) + 6; const rows = ceil(height / s) + 6;
    for (let i = -4; i < cols; i++) {
        for (let j = -4; j < rows; j++) {
            const tileC = { x: centroid.x + i * s, y: centroid.y + j * s };
            drawShapeCell(tileC, false);
        }
    }
}

// --- TRIANGLE --- (triangular lattice, centroid-centered)
function tileTriangle() {
    // Justage-Parameter für das Dreieck-Tiling:
    // Passe horizontalAdjust und verticalAdjust manuell an, um die horizontale/vertikale Abstände zwischen den Dreiecken zu feintunen.
    // Justage-Parameter für das Dreieck-Tiling (Reset auf 0 für exakte Mathematik)
    const horizontalAdjust = 0.0;
    const verticalAdjust = 0.0;

    const s = dist(outerCorners[1].x, outerCorners[1].y, outerCorners[2].x, outerCorners[2].y);
    const h = (sqrt(3) / 2) * s;

    // --- Manuelle Verschiebung des gesamten Musters ---
    // Reset auf 0, da das Gitter relativ zu "B" (zentrales Dreieck) aufgebaut wird.
    const offsetX = 0;
    const offsetY = 0;

    // Schrittweiten mit manueller Justage
    const v1 = { x: s * (1 + horizontalAdjust), y: 0 }; // horizontale Schrittweite (angepasst)
    const v2 = { x: s / 2, y: h * (1 + verticalAdjust) }; // vertikale Schrittweite (angepasst)

    // Ursprung für das Gitter
    const B = outerCorners[1];
    const cols = ceil(width / (s * (1 + horizontalAdjust))) + 8;
    const rows = ceil(height / (h * (1 + verticalAdjust))) + 8;

    for (let j = -4; j < rows; j++) {
        for (let i = -4; i < cols; i++) {
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
    if (foundId === null && freeEndpointsEnabled) {
        const newId = Math.max(...nodes.map(n => n.id), 0) + 1;
        nodes.push({ id: newId, x: mouseX, y: mouseY, free: true });
        foundId = newId;
    }
    if (foundId !== null) {
        if (!connections.length || connections[connections.length - 1].length === 2) connections.push([foundId]);
        else connections[connections.length - 1].push(foundId);
        redoStack = []; // Clear redo stack on manual add
        redraw();
    }
}

function addRandomConnection() {
    if (nodes.length < 2) return;
    let i = floor(random(nodes.length)); let j = floor(random(nodes.length));
    if (i === j) return; connections.push([nodes[i].id, nodes[j].id]);
}

// ----------------- CURVE RENDERING ---------------------
function drawCurvedBezier(p1, p2, cAmt) {
    const scaleF = 0.01; const sign = (cAmt >= 0) ? 1 : -1; const mag = abs(cAmt) * scaleF;
    if (mag < 0.0001) {
        if (svgPathCollector) {
            svgPathCollector.push(`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
            return;
        }
        line(p1.x, p1.y, p2.x, p2.y);
        return;
    }
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x, dy = p2.y - p1.y; const distLine = sqrt(dx * dx + dy * dy);
    let nx = -dy, ny = dx; const ln = sqrt(nx * nx + ny * ny); if (ln < 0.0001) return; nx /= ln; ny /= ln;
    const offset = distLine * mag * sign; const cx = mx + nx * offset, cy = my + ny * offset;
    if (svgPathCollector) {
        // p5's bezier(p1, cx,cy, cx,cy, p2) is a cubic bezier with both
        // control points identical - mathematically equivalent to a
        // quadratic bezier with control point (cx,cy), i.e. SVG's Q command.
        svgPathCollector.push(`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
        return;
    }
    // Die Linien sollen immer ungefüllt sein, aber noFill() nicht global setzen!
    // Wir setzen fill/stroke im draw() global, daher hier keine Änderung.
    bezier(p1.x, p1.y, cx, cy, cx, cy, p2.x, p2.y);
}

// ----------------- EXPORT ----------------------------------------
function exportPNG() {
    saveCanvas('world_of_forms', 'png');
}

function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Builds the exportable state as plain data: the un-tessellated,
// un-symmetry-expanded base cell (nodes/connections are never mutated
// by drawConnectionWithSymmetry - that only computes transient copies
// at render time), plus an angle-sorted adjacency list per node so a
// later face-detection pass (see README "Flächenfärbung") can walk the
// minimal enclosed cycles without needing any structural change here.
function buildExportData() {
    // Mirror the same completeness filter drawShapeCell() already applies -
    // a connection started by one click and never finished stays [id] (length 1).
    const completeConnections = connections.filter(c => c.length === 2);
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    const adjacency = {};
    nodes.forEach(n => { adjacency[n.id] = []; });

    completeConnections.forEach((conn, edgeIndex) => {
        const [aId, bId] = conn;
        const a = nodeById.get(aId), b = nodeById.get(bId);
        if (!a || !b) return;
        const angleAB = (degrees(atan2(b.y - a.y, b.x - a.x)) + 360) % 360;
        const angleBA = (degrees(atan2(a.y - b.y, a.x - b.x)) + 360) % 360;
        adjacency[aId].push({ neighborId: bId, edgeIndex, angleDeg: angleAB });
        adjacency[bId].push({ neighborId: aId, edgeIndex, angleDeg: angleBA });
    });

    Object.keys(adjacency).forEach(id => {
        adjacency[id].sort((x, y) => x.angleDeg - y.angleDeg);
    });

    return {
        formatVersion: 1,
        generator: "World of Forms Generator",
        exportedAt: new Date().toISOString(),
        meta: {
            shapeType: currentShape,
            shapeSizeFactor,
            nodeCount,
            symmetryMode,
            curveAmount,
            lineColor
        },
        geometry: {
            centroid: { x: centroid.x, y: centroid.y },
            outerCorners: outerCorners.map(c => ({ x: c.x, y: c.y })),
            nodes: nodes.map(n => ({ id: n.id, x: n.x, y: n.y })),
            edges: completeConnections.map(c => [c[0], c[1]]),
            adjacency
        }
    };
}

function exportJSON() {
    const data = buildExportData();
    downloadBlob(JSON.stringify(data, null, 2), 'world_of_forms.json', 'application/json');
}

// Renders the full visible tessellation (same scope as the PNG export -
// see plan discussion) by reusing drawTessellation() unchanged in SVG
// collection mode, so the vector output can never drift from what's
// actually on screen.
function generateSVGString() {
    svgPathCollector = [];
    drawTessellation();
    const paths = svgPathCollector;
    svgPathCollector = null;

    const w = width, h = height;
    const bgColor = getComputedStyle(document.body).getPropertyValue('--panel-bg-color') || '#ffffff';

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
    svg += `  <rect x="0" y="0" width="${w}" height="${h}" fill="${bgColor.trim() || '#ffffff'}" />\n`;
    svg += `  <g stroke="${lineColor}" stroke-width="2" fill="none">\n`;
    paths.forEach(d => { svg += `    <path d="${d}" />\n`; });
    svg += `  </g>\n`;
    if (showNodes) {
        svg += `  <g fill="#000000">\n`;
        nodes.forEach(nd => { svg += `    <circle cx="${nd.x.toFixed(2)}" cy="${nd.y.toFixed(2)}" r="3" />\n`; });
        svg += `  </g>\n`;
    }
    // Canvas frame, matching draw()'s rect(0,0,width,height) at strokeWeight(4).
    svg += `  <rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="${lineColor}" stroke-width="4" />\n`;
    svg += `</svg>\n`;
    return svg;
}

function exportSVG() {
    downloadBlob(generateSVGString(), 'world_of_forms.svg', 'image/svg+xml');
}
