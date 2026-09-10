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
            renderLayerTabs(); // rebuildGrid() clears additionalLayers - keep the tab strip in sync
            updateOffsetControls();
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
            renderLayerTabs();
            updateOffsetControls();
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
            renderLayerTabs();
            updateOffsetControls();
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

    // Curve Toggle Button. Mutually exclusive with the face-fill toggle
    // below (Roadmap 1.10a design session, point 7 - straight-line-only
    // face detection): enabling curve here force-disables face-fill on
    // whichever layer is currently active.
    const curveBtn = select('#btn-toggle-curve');
    const faceBtn = select('#btn-toggle-faces');
    if (curveBtn) {
        curveBtn.mousePressed(() => {
            if (curveAmount === 0) {
                curveAmount = 25; // Enable curve
                curveBtn.addClass('active');
                setActiveShowFaces(false);
                faceBtn && faceBtn.removeClass('active');
            } else {
                curveAmount = 0; // Disable curve
                curveBtn.removeClass('active');
            }
            redraw();
        });
    }

    // Face-Fill Toggle Button (Roadmap 1.10a). Contextual to the active
    // layer (base or a specific additional layer - see
    // activeShowFaces()/setActiveShowFaces()), and mutually exclusive
    // with curve mode the same way the curve toggle above is with this
    // one. updateFaceToggleControl() keeps the button's visual state in
    // sync whenever the active layer changes (same call sites as
    // updateOffsetControls() below).
    function updateFaceToggleControl() {
        if (!faceBtn) return;
        if (activeShowFaces()) faceBtn.addClass('active');
        else faceBtn.removeClass('active');
    }
    if (faceBtn) {
        faceBtn.mousePressed(() => {
            const next = !activeShowFaces();
            setActiveShowFaces(next);
            if (next) {
                curveAmount = 0;
                curveBtn && curveBtn.removeClass('active');
            }
            updateFaceToggleControl();
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

    // ----------------- LAYER TAB STRIP (Roadmap 1.9) -----------------
    // Base tab is static HTML (#btn-layer-base) since the base sheet is
    // structurally special (always present, can't be removed, see
    // core/state.js). Additional-layer tabs are rendered dynamically
    // into #layer-tabs since their count is variable - the first place
    // this app generates DOM elements at runtime rather than wiring
    // fixed IDs from index.html. Offset inputs are contextual to
    // whichever tab is active (one X/Y pair, not one per layer, per
    // the 1.9 design session) - updateOffsetControls() shows/hides and
    // (re)populates them; renderLayerTabs() rebuilds the tab strip
    // itself. Both are `function` declarations (not `const`) so they're
    // hoisted and safely callable from the shape/size/node-count
    // handlers above, which are defined earlier in this same setup().
    const layerBaseBtn = select('#btn-layer-base');
    const layerTabsContainer = select('#layer-tabs');
    const addLayerBtn = select('#btn-add-layer');
    const offsetXGroup = select('#layer-offset-x-group');
    const offsetYGroup = select('#layer-offset-y-group');
    const meshPresetGroup = select('#layer-mesh-preset-group');
    const offsetXInput = select('#layer-offset-x-input');
    const offsetYInput = select('#layer-offset-y-input');

    function updateOffsetControls() {
        const showOffsets = activeLayer !== 'base';
        if (offsetXGroup) offsetXGroup.elt.hidden = !showOffsets;
        if (offsetYGroup) offsetYGroup.elt.hidden = !showOffsets;
        if (meshPresetGroup) meshPresetGroup.elt.hidden = !showOffsets;
        if (showOffsets) {
            const layer = additionalLayers[activeLayer];
            if (offsetXInput) offsetXInput.value(layer.offsetX);
            if (offsetYInput) offsetYInput.value(layer.offsetY);
        }
    }

    function renderLayerTabs() {
        if (layerBaseBtn) {
            if (activeLayer === 'base') layerBaseBtn.addClass('active');
            else layerBaseBtn.removeClass('active');
        }
        if (!layerTabsContainer) return;
        const container = layerTabsContainer.elt;
        container.innerHTML = '';

        additionalLayers.forEach((layer, i) => {
            const tab = document.createElement('span');
            tab.className = 'layer-tab';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'layer-enable-checkbox';
            checkbox.checked = layer.enabled;
            checkbox.title = 'Show/Hide Layer ' + (i + 1);
            checkbox.addEventListener('change', () => {
                layer.enabled = checkbox.checked;
                redraw();
            });

            const btn = document.createElement('button');
            btn.className = 'layer-btn' + (activeLayer === i ? ' active' : '');
            btn.textContent = 'Layer ' + (i + 1);
            btn.title = 'Edit Layer ' + (i + 1);
            btn.addEventListener('click', () => {
                activeLayer = i;
                renderLayerTabs();
                updateOffsetControls();
                updateFaceToggleControl();
            });

            const removeBtn = document.createElement('button');
            removeBtn.className = 'layer-remove-btn';
            removeBtn.textContent = '×';
            removeBtn.title = 'Remove Layer ' + (i + 1);
            removeBtn.addEventListener('click', () => {
                removeLayer(i);
                renderLayerTabs();
                updateOffsetControls();
                updateFaceToggleControl();
                redraw();
            });

            tab.appendChild(checkbox);
            tab.appendChild(btn);
            tab.appendChild(removeBtn);
            container.appendChild(tab);
        });
    }

    if (layerBaseBtn) {
        layerBaseBtn.mousePressed(() => {
            activeLayer = 'base';
            renderLayerTabs();
            updateOffsetControls();
            updateFaceToggleControl();
        });
    }

    if (addLayerBtn) {
        addLayerBtn.mousePressed(() => {
            addLayer();
            renderLayerTabs();
            updateOffsetControls();
            updateFaceToggleControl();
            redraw();
        });
    }

    // Offset Inputs (continuous, pixels - see 1.3(b) design: building
    // this as a free parameter costs nothing extra over a whole-mesh-
    // width-only control, so it's not artificially constrained) and
    // "1 mesh-width" Presets both act on whichever layer is currently
    // active - getMeshWidth() (core/tiling.js) derives the step from
    // the current shape's own tiling math.
    if (offsetXInput) {
        offsetXInput.input(() => {
            if (activeLayer === 'base') return;
            additionalLayers[activeLayer].offsetX = parseFloat(offsetXInput.value()) || 0;
            redraw();
        });
    }
    if (offsetYInput) {
        offsetYInput.input(() => {
            if (activeLayer === 'base') return;
            additionalLayers[activeLayer].offsetY = parseFloat(offsetYInput.value()) || 0;
            redraw();
        });
    }
    const meshPresetXBtn = select('#btn-mesh-preset-x');
    meshPresetXBtn && meshPresetXBtn.mousePressed(() => {
        if (activeLayer === 'base') return;
        additionalLayers[activeLayer].offsetX = getMeshWidth().x;
        if (offsetXInput) offsetXInput.value(additionalLayers[activeLayer].offsetX);
        redraw();
    });
    const meshPresetYBtn = select('#btn-mesh-preset-y');
    meshPresetYBtn && meshPresetYBtn.mousePressed(() => {
        if (activeLayer === 'base') return;
        additionalLayers[activeLayer].offsetY = getMeshWidth().y;
        if (offsetYInput) offsetYInput.value(additionalLayers[activeLayer].offsetY);
        redraw();
    });

    renderLayerTabs();
    updateOffsetControls();
    updateFaceToggleControl();

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

    // Action Buttons - operate on the active layer (base or overlay,
    // see activeConnections()/clearActiveRedoStack() etc. in INTERACTION)
    const clearBtn = select('#btn-clear');
    clearBtn && clearBtn.mousePressed(() => {
        clearActiveConnections();
        clearActiveRedoStack(); // Clear redo on clear
        redraw();
    });

    const backBtn = select('#btn-undo');
    backBtn && backBtn.mousePressed(() => {
        const conns = activeConnections();
        const redo = activeRedoStack();
        if (conns.length) {
            redo.push(conns.pop()); // Push to redo stack
            redraw();
        }
    });

    const redoBtn = select('#btn-redo');
    redoBtn && redoBtn.mousePressed(() => {
        const conns = activeConnections();
        const redo = activeRedoStack();
        if (redo.length) {
            conns.push(redo.pop()); // Pop from redo stack
            redraw();
        }
    });

    const randBtn = select('#btn-random');
    randBtn && randBtn.mousePressed(() => {
        addRandomConnection();
        clearActiveRedoStack(); // Clear redo on new action
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

    // Cross-Layer Face Compute (Roadmap 1.10b-ii-b) - see
    // computeCrossLayerFacesFlow()/updateCrossLayerStatus() (INTERACTION
    // section below) for the actual logic; this just wires the click.
    const computeCrossLayerBtn = select('#btn-compute-cross-layer');
    computeCrossLayerBtn && computeCrossLayerBtn.mousePressed(computeCrossLayerFacesFlow);

    rebuildGrid(currentShape);
    // Draw a random connection on start
    addRandomConnection();
    redraw();
    updateCrossLayerStatus();
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

    // Roadmap 1.10b-ii-b: cheap enough to run on every redraw (see
    // updateCrossLayerStatus()'s own comment) - catches every
    // connections/layers/offsets change via the same redraw() calls
    // those already trigger, without needing a hook at each individual
    // mutation site.
    updateCrossLayerStatus();
}

function mouseMoved() { if (showNodes) redraw(); }

// ----------------- INTERACTION ---------------------------------
// Roadmap 1.9 (generalizing 1.3(b)'s base/overlay pair): which
// connections/redo-stack pair mousePressed()/addRandomConnection()/
// undo/redo/clear act on depends on activeLayer ('base' | integer
// index into additionalLayers, see core/state.js). Reads return the
// actual array (mutate via .push()/.pop() as before); clears need an
// explicit setter since `arr = []` can't be expressed through a
// returned reference.
function activeConnections() { return activeLayer === 'base' ? connections : additionalLayers[activeLayer].connections; }
function activeRedoStack() { return activeLayer === 'base' ? redoStack : additionalLayers[activeLayer].redoStack; }
function clearActiveConnections() { if (activeLayer === 'base') connections = []; else additionalLayers[activeLayer].connections = []; }
function clearActiveRedoStack() { if (activeLayer === 'base') redoStack = []; else additionalLayers[activeLayer].redoStack = []; }

// Roadmap 1.10a: same base/active-layer split as above, for the face-
// fill toggle - "pro Blatt/Sheet unabhängig" (design session point 7),
// no cross-layer fill in 1.10a. The base sheet keeps its own showFaces
// global (core/state.js, read directly by core/tiling.js's
// drawTessellation()); additional layers get their own showFaces field
// (see addLayer()). setActiveShowFaces() needs an explicit setter for
// the same reason clearActiveConnections() does - `x = v` can't be
// expressed through a returned reference for the base-sheet case.
function activeShowFaces() { return activeLayer === 'base' ? showFaces : additionalLayers[activeLayer].showFaces; }
function setActiveShowFaces(v) { if (activeLayer === 'base') showFaces = v; else additionalLayers[activeLayer].showFaces = v; }

// Adds a new, empty additional layer and makes it the active one -
// matches the natural workflow (add layer -> immediately start
// clicking nodes to build its connections). No cap enforced here (see
// 1.9 design session) - the UI is what practically targets 4 total
// sheets.
function addLayer() {
    additionalLayers.push({ connections: [], redoStack: [], offsetX: 0, offsetY: 0, enabled: true, showFaces: false });
    activeLayer = additionalLayers.length - 1;
}

// Removes one additional layer by index. Falls back to 'base' if it
// was the active layer; otherwise shifts a numeric activeLayer down
// by one if it pointed past the removed index, since splice() shifts
// every later layer's index down by one too.
function removeLayer(index) {
    additionalLayers.splice(index, 1);
    if (activeLayer === index) {
        activeLayer = 'base';
    } else if (typeof activeLayer === 'number' && activeLayer > index) {
        activeLayer -= 1;
    }
}

// ----------------- CROSS-LAYER FACE COMPUTE (Roadmap 1.10b-ii-b) -----
// Synchronous, user-initiated compute - NOT wired into every redraw()
// the way 1.10a's per-sheet showFaces is (see the 1.10b-ii-b design
// session for why: post spatial-hash-fix real times are sub-second to
// a few seconds, too long to re-run on every click/drag the way single-
// sheet face detection already does). No rendering yet - coloring and
// canvas display are 1.10b-ii-c; this is compute + timing + staleness
// feedback only.
let crossLayerResult = null;          // last computeCrossLayerFaces() result, or null if never computed
let crossLayerResultSignature = null; // crossLayerConfigSignature() at the time crossLayerResult was computed
let crossLayerResultTimeMs = 0;       // that compute's real elapsed time, for the status line

// Builds the {baseConn, layers} input computeCrossLayerFaces() (and
// estimateCrossLayerSegmentCount()) expect - base sheet's complete
// connections, plus one entry per ENABLED additional layer (sheetId =
// its additionalLayers[] index, matching how 1.10b-i's own live testing
// already addressed sheets), each with its own complete connections and
// offset. Mirrors collectCrossLayerSegments()'s/drawShapeCell()'s own
// completeness filter ([id,id] only - a connection started by one click
// and never finished stays [id]).
function buildCrossLayerInput() {
    const baseConn = connections.filter(c => c.length === 2);
    const layers = additionalLayers
        .map((layer, i) => ({
            sheetId: i,
            connections: layer.connections.filter(c => c.length === 2),
            offsetX: layer.offsetX,
            offsetY: layer.offsetY,
            enabled: layer.enabled
        }))
        .filter(l => l.enabled);
    return { baseConn, layers };
}

// A cheap fingerprint of everything a cross-layer compute result
// actually depends on - base connections, and each ENABLED layer's own
// connections/offset. Used to detect staleness (see
// updateCrossLayerStatus()) without needing to hook every individual
// mutation site (mousePressed(), undo/redo/clear, layer add/remove/
// enable-toggle, offset inputs) - updateCrossLayerStatus() is instead
// called once per draw() (see there), which already fires after every
// one of those via their own redraw() calls.
function crossLayerConfigSignature() {
    const { baseConn, layers } = buildCrossLayerInput();
    return JSON.stringify({
        base: baseConn,
        layers: layers.map(l => ({ sheetId: l.sheetId, conns: l.connections, ox: l.offsetX, oy: l.offsetY }))
    });
}

// Soft time hint (1.10b-ii-b design session, point 2): grounded in the
// post-spatial-hash-fix real O(S^2)-ish scaling (2,400 segments -> real
// 250ms, 3,600 -> real 598ms) extrapolated to ~1.7s at 6,000 and
// ~3-5s at 10,000 segments - informational only, never a hard refusal.
function crossLayerTimeHint(estimatedSegments) {
    if (estimatedSegments >= 10000) return 'this will likely take several seconds';
    if (estimatedSegments >= 6000) return 'this may take a moment';
    return '';
}

// Updates #cross-layer-status: before any compute (or once the config
// has changed since the last one), shows the live segment estimate's
// time hint (or nothing, if fast); after a compute that's still current
// for the present config, shows the result summary instead. Called once
// per draw() (cheap - estimateCrossLayerSegmentCount()'s own cost is
// one real but tiny single-connection collectCellSegments() probe,
// negligible next to drawTessellation()'s own per-redraw cost) rather
// than from every individual mutation site, so no interaction point
// (however it changes connections/layers/offsets) can be missed.
function updateCrossLayerStatus() {
    const statusEl = select('#cross-layer-status');
    if (!statusEl) return;

    const { baseConn, layers } = buildCrossLayerInput();
    const estimate = estimateCrossLayerSegmentCount(baseConn.length, layers);
    const currentSignature = crossLayerConfigSignature();

    if (crossLayerResult && crossLayerResultSignature === currentSignature) {
        statusEl.html(`${crossLayerResult.faces.length} faces found (${Math.round(crossLayerResultTimeMs)} ms)`);
    } else if (crossLayerResult) {
        const hint = crossLayerTimeHint(estimate);
        statusEl.html(`Outdated (last: ${crossLayerResult.faces.length} faces) - recompute to update` + (hint ? `; ${hint}` : ''));
    } else {
        const hint = crossLayerTimeHint(estimate);
        statusEl.html(hint ? `Estimated ~${estimate} segments - ${hint}` : '');
    }
}

// The Compute button's click handler. Sets the disabled/"Computing…"
// state FIRST, then defers the actual (synchronous, blocking) compute
// to the next tick via setTimeout(fn, 0) - a plain synchronous call
// here would freeze the main thread in the SAME tick as the click,
// before the browser gets a chance to paint the disabled button/label
// change, making the button appear to do nothing until the result
// suddenly appears (1.10b-ii-b design session, point 3).
function computeCrossLayerFacesFlow() {
    const computeBtn = select('#btn-compute-cross-layer');
    const statusEl = select('#cross-layer-status');
    if (!computeBtn) return;

    computeBtn.elt.disabled = true;
    computeBtn.html('Computing…');
    if (statusEl) statusEl.html('Computing…');

    setTimeout(() => {
        const { baseConn, layers } = buildCrossLayerInput();
        const t0 = performance.now();
        const result = computeCrossLayerFaces(baseConn, layers);
        const t1 = performance.now();

        crossLayerResult = result;
        crossLayerResultTimeMs = t1 - t0;
        crossLayerResultSignature = crossLayerConfigSignature();

        computeBtn.elt.disabled = false;
        computeBtn.html('Compute Cross-Layer Faces');
        updateCrossLayerStatus();
    }, 0);
}

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
        const conns = activeConnections();
        if (!conns.length || conns[conns.length - 1].length === 2) conns.push([foundId]);
        else conns[conns.length - 1].push(foundId);
        clearActiveRedoStack(); // Clear redo stack on manual add
        redraw();
    }
}

function addRandomConnection() {
    if (nodes.length < 2) return;
    let i = floor(random(nodes.length)); let j = floor(random(nodes.length));
    if (i === j) return; activeConnections().push([nodes[i].id, nodes[j].id]);
}
