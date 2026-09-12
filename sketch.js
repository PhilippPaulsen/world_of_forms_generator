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
            cancelAltNetConstruction(); // Roadmap 1.2-C: an in-progress P/Q click pair no longer means anything once the target shape/order changed underneath it
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

    // Curve Toggle Button. Three-way mutually exclusive with the free-
    // clothing toggle and the face-fill toggle below (Roadmap 1.10a
    // design session, point 7 - straight-line-only face detection, now
    // extended to 'free' too - core/faces.js's guard is already
    // `kind !== 'straight'`, so it already excludes 'free' with no
    // change needed there; this is only the UI-level three-way
    // exclusion, generalizing the old two-way curve/faces logic).
    const curveBtn = select('#btn-toggle-curve');
    const freeBtn = select('#btn-toggle-free');
    const faceBtn = select('#btn-toggle-faces');
    if (curveBtn) {
        curveBtn.mousePressed(() => {
            if (curveType.kind === 'curve') {
                curveType = { kind: 'straight' }; // Disable curve
                curveBtn.removeClass('active');
            } else {
                // Roadmap 1.4-A: same fixed style the old binary toggle
                // always used (fold=1, symmetric, strength=25 - byte-
                // identical rendering to the pre-1.4-A code, verified in
                // the 1.4-A implementation session's own regression
                // test). 1.4-B is what exposes fold/symmetric/leaning/
                // strength as real controls; this toggle stays exactly
                // as simple as it was before that.
                curveType = { kind: 'curve', fold: 1, symmetric: true, leaning: 'left', strength: 25 };
                curveBtn.addClass('active');
                freeBtn && freeBtn.removeClass('active');
                setActiveShowFaces(false);
                faceBtn && faceBtn.removeClass('active');
            }
            updateFreeControls();
            redraw();
        });
    }

    // Roadmap 1.5-B: 'free' clothing toggle - a separate button from
    // the curve toggle above (not a redesign of it), same three-way
    // exclusion. Activating 'free' auto-rolls a starting seed (via the
    // SAME Math.random() call the reroll button uses below) rather than
    // always starting from a fixed default - "try a variation" is the
    // point from the very first activation, not just on reroll; the
    // chosen seed then becomes a fixed, exported, deterministic value
    // like any other curveType field (core/curves.js's buildCurvePieces()
    // never calls random() itself - see the 1.5-A design).
    if (freeBtn) {
        freeBtn.mousePressed(() => {
            if (curveType.kind === 'free') {
                curveType = { kind: 'straight' }; // Disable free clothing
                freeBtn.removeClass('active');
            } else {
                curveType = {
                    kind: 'free',
                    seed: Math.floor(Math.random() * 2147483648),
                    roughness: 1,
                    strength: 20,
                    leaning: 'left',
                    visible: false
                };
                freeBtn.addClass('active');
                curveBtn && curveBtn.removeClass('active');
                setActiveShowFaces(false);
                faceBtn && faceBtn.removeClass('active');
            }
            updateFreeControls();
            updateFreeVisibleToggleIcon();
            redraw();
        });
    }

    // Face-Fill Toggle Button (Roadmap 1.10a). Contextual to the active
    // layer (base or a specific additional layer - see
    // activeShowFaces()/setActiveShowFaces()), and mutually exclusive
    // with curve/free mode the same way those two are with this one and
    // with each other. updateFaceToggleControl() keeps the button's
    // visual state in sync whenever the active layer changes (same call
    // sites as updateOffsetControls() below).
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
                curveType = { kind: 'straight' };
                curveBtn && curveBtn.removeClass('active');
                freeBtn && freeBtn.removeClass('active');
            }
            updateFaceToggleControl();
            updateFreeControls();
            redraw();
        });
    }

    // Roadmap 1.5-B: kind:'free' controls (roughness/visible/reroll) -
    // a plate-wide curveType setting, not per-layer (see index.html's
    // own comment on these groups), so no layer-switch call site needs
    // to re-sync this the way updateOffsetControls() does for layer-
    // specific state. Shown only while curveType.kind === 'free'.
    const roughnessGroup = select('#free-roughness-group');
    const roughnessInput = select('#free-roughness-input');
    const freeControlsGroup = select('#free-controls-group');
    const freeVisibleBtn = select('#btn-toggle-free-visible');
    const rerollBtn = select('#btn-free-reroll-seed');

    function updateFreeControls() {
        const isFree = curveType.kind === 'free';
        if (roughnessGroup) roughnessGroup.elt.hidden = !isFree;
        if (freeControlsGroup) freeControlsGroup.elt.hidden = !isFree;
        if (isFree && roughnessInput) roughnessInput.value(curveType.roughness);
    }

    if (roughnessInput) {
        roughnessInput.input(() => {
            if (curveType.kind !== 'free') return;
            let v = parseFloat(roughnessInput.value());
            if (isNaN(v) || v < 0) v = 0;
            if (v > 5) v = 5;
            curveType.roughness = v;
            redraw();
        });
    }

    // "heimliches Gesetz" ("hidden law") toggle - curveType.visible.
    // Same eye/eye-off icon-swap convention as #btn-toggle-nodes
    // (sketch.js below), a genuinely separate control for a separate
    // thing: this hides the underlying theme-line WITHIN kind:'free',
    // not the node markers showNodes controls.
    function updateFreeVisibleToggleIcon() {
        if (!freeVisibleBtn) return;
        if (curveType.visible) {
            freeVisibleBtn.addClass('active');
            freeVisibleBtn.html('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>');
        } else {
            freeVisibleBtn.removeClass('active');
            freeVisibleBtn.html('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/></svg>');
        }
    }
    if (freeVisibleBtn) {
        freeVisibleBtn.mousePressed(() => {
            if (curveType.kind !== 'free') return;
            curveType.visible = !curveType.visible;
            updateFreeVisibleToggleIcon();
            redraw();
        });
    }

    // Reroll, not a raw seed number input - see the 1.5-B design
    // session for why (a seed has no meaningful order to "tune" the way
    // shape size/node count do; "try another variation" is the actual
    // mental model). Only this click uses Math.random() - the render
    // path (core/curves.js's buildCurvePieces()) stays a pure function
    // of the stored seed, so the result is fully reproducible/exported
    // from the moment it's rolled.
    if (rerollBtn) {
        rerollBtn.mousePressed(() => {
            if (curveType.kind !== 'free') return;
            curveType.seed = Math.floor(Math.random() * 2147483648);
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

    // Roadmap 1.2-C: alternative net construction toggle - one-shot
    // tool-like activation (armed by toggling on, auto-deactivates on
    // confirm - see handleAltNetClick()). Toggling OFF while a
    // construction is in progress cancels it (cancelAltNetConstruction()),
    // which is the only cancel mechanism - no separate Escape handling.
    const altNetBtn = select('#btn-alternative-net');
    if (altNetBtn) {
        altNetBtn.mousePressed(() => {
            altNetActive = !altNetActive;
            altNetPending = null;
            if (altNetActive) altNetBtn.addClass('active');
            else altNetBtn.removeClass('active');
            redraw();
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
    // Roadmap 1.2-C: exposed as a global - updateOffsetControls()/
    // renderLayerTabs() are declared here (closing over setup()-local DOM
    // refs like offsetXInput/layerTabsContainer), so they're invisible
    // from handleAltNetClick() (a top-level function, same scope
    // mousePressed()/mouseMoved() must be in for p5's global mode - see
    // CLAUDE.md). Every OTHER call site is itself inside setup()'s own
    // closure, which is why this gap wasn't hit before. window.x = x
    // exposes the function globally while keeping its original closure
    // over the setup()-local DOM references intact.
    window.updateOffsetControls = updateOffsetControls;

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
                // Roadmap 1.11-B: switching tabs alone didn't previously
                // trigger a redraw() (canvas content doesn't change just
                // by selecting a tab) - added so #pattern-name-status
                // (contextual to activeLayer, see updatePatternNameStatus())
                // actually reflects the newly-selected sheet immediately,
                // not only after some unrelated later redraw.
                redraw();
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
    window.renderLayerTabs = renderLayerTabs; // see updateOffsetControls()'s own comment above

    if (layerBaseBtn) {
        layerBaseBtn.mousePressed(() => {
            activeLayer = 'base';
            renderLayerTabs();
            updateOffsetControls();
            updateFaceToggleControl();
            redraw(); // Roadmap 1.11-B: see the per-layer tab handler's own comment above
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
    // Roadmap 1.2-B: getMeshWidth() now returns {v1,v2} (the net's own
    // lattice vectors) instead of {x,y} (two independent axis-aligned
    // scalars) - each preset shifts by one FULL lattice vector, setting
    // both offsetX and offsetY together, so the shift follows the net's
    // actual lattice direction regardless of rotation (previously only
    // correct because v1/v2 happened to be axis-aligned).
    const meshPresetXBtn = select('#btn-mesh-preset-x');
    meshPresetXBtn && meshPresetXBtn.mousePressed(() => {
        if (activeLayer === 'base') return;
        const v1 = getMeshWidth().v1;
        additionalLayers[activeLayer].offsetX = v1.x;
        additionalLayers[activeLayer].offsetY = v1.y;
        if (offsetXInput) offsetXInput.value(additionalLayers[activeLayer].offsetX);
        if (offsetYInput) offsetYInput.value(additionalLayers[activeLayer].offsetY);
        redraw();
    });
    const meshPresetYBtn = select('#btn-mesh-preset-y');
    meshPresetYBtn && meshPresetYBtn.mousePressed(() => {
        if (activeLayer === 'base') return;
        const v2 = getMeshWidth().v2;
        additionalLayers[activeLayer].offsetX = v2.x;
        additionalLayers[activeLayer].offsetY = v2.y;
        if (offsetXInput) offsetXInput.value(additionalLayers[activeLayer].offsetX);
        if (offsetYInput) offsetYInput.value(additionalLayers[activeLayer].offsetY);
        redraw();
    });

    renderLayerTabs();
    updateOffsetControls();
    updateFaceToggleControl();
    updateFreeControls();
    updateFreeVisibleToggleIcon();

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
        // Roadmap 1.10b-ii-c: only pass a crossLayerData object through
        // to exportJSON()/buildExportData() when a valid, CURRENT (not
        // stale - same crossLayerConfigSignature() check draw()/
        // updateCrossLayerStatus() already use) cross-layer result
        // exists - an outdated result never gets exported as if it were
        // still accurate, same rule as rendering.
        const crossLayerData = (crossLayerResult && crossLayerResultSignature === crossLayerConfigSignature())
            ? { latticeBasis: crossLayerResult.latticeBasis, nodes: crossLayerResult.nodes, faces: crossLayerResult.faces }
            : null;
        exportJSON(crossLayerData);
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
    updatePatternNameStatus();
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

    // Roadmap 1.10b-ii-c: cross-layer face fills - additive to (not a
    // replacement for) 1.10a's per-sheet showFaces fills already drawn
    // inside drawTessellation() above. Rendered only when a computed
    // result exists AND is still current for the present connections/
    // layers/offsets (crossLayerConfigSignature() - the same staleness
    // check updateCrossLayerStatus() uses for its own "Outdated" label):
    // an outdated result is never rendered as if it were current, even
    // though it's still SHOWN (with that label) in the status text. The
    // whole block below (buffer render-or-reuse, then blit) only runs at
    // all inside this same currency check, so an outdated result simply
    // never reaches the blit - the previously cached buffer's content is
    // left alone but never drawn, same "hidden until recomputed" behavior
    // as before caching existed.
    //
    // Roadmap 1.10b-ii-d: offscreen-buffer cache (see crossLayerFillBuffer/
    // crossLayerFillBufferSignature above) - re-renders into the buffer
    // ONLY when its signature doesn't match the current result's (i.e. a
    // new compute was accepted since the buffer was last built), then
    // always just blits the buffer via image(). clear() before re-
    // rendering matters: a new result can have FEWER faces than the one
    // the buffer previously held, and without clearing, stale pixels from
    // the larger previous render would linger under/around the new ones.
    if (crossLayerResult && crossLayerResultSignature === crossLayerConfigSignature()) {
        if (crossLayerFillBufferSignature !== crossLayerResultSignature) {
            if (!crossLayerFillBuffer) crossLayerFillBuffer = createGraphics(width, height);
            crossLayerFillBuffer.clear();
            drawCrossLayerFaceFillsAcrossCanvas(crossLayerResult, crossLayerFillBuffer);
            crossLayerFillBufferSignature = crossLayerResultSignature;
        }
        image(crossLayerFillBuffer, 0, 0);
    }

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

    // Roadmap 1.2-C: live preview of the alternative-net construction in
    // progress - a dashed outline (distinct from the actual rendered
    // pattern) of the candidate polygon, flipping sides as
    // altNetPending.previewSide updates in mouseMoved(). Drawn after
    // nodes so P/Q markers stay visible on top.
    if (altNetActive && altNetPending) {
        push();
        noStroke();
        fill(30, 110, 220);
        ellipse(altNetPending.p.x, altNetPending.p.y, 8, 8);
        if (altNetPending.q !== undefined) {
            ellipse(altNetPending.q.x, altNetPending.q.y, 8, 8);
            const n = shapeToN(currentShape);
            const { vertices } = completeEdgeToRegularPolygon(altNetPending.p, altNetPending.q, n, altNetPending.previewSide);
            noFill();
            stroke(120);
            strokeWeight(2);
            drawingContext.setLineDash([6, 4]);
            beginShape();
            vertices.forEach(v => vertex(v.x, v.y));
            endShape(CLOSE);
            drawingContext.setLineDash([]);
        }
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

    // Roadmap 1.11-B: NOT unconditionally cheap the way
    // updateCrossLayerStatus() is - computeThemeLineName() rebuilds the
    // full orbit table from scratch (core/orbits.js's
    // computeThemeLineOrbitTable(), no caching of its own by design -
    // see that function's own comment on why the cache lives here
    // instead), measured at ~13ms at the UI's largest reachable order
    // (hex, nodeCount 5). Paying that on every mouseMoved()-triggered
    // redraw would reintroduce exactly the kind of avoidable per-redraw
    // recomputation 1.10b-ii-d's diagnosis/fix targeted - so this is
    // cached here (signature-invalidated), same pattern as
    // crossLayerFillBuffer/crossLayerFillBufferSignature above, not
    // called unconditionally like updateCrossLayerStatus().
    updatePatternNameStatus();
}

// ----------------- ALTERNATIVE NET CONSTRUCTION (Roadmap 1.2-C) -----
// One-shot tool-like activation (not a persistent mode, per the design
// session): toggling #btn-alternative-net arms a 3-click flow - click
// P, click Q (live preview from then on, flipping side as the mouse
// crosses line PQ), click again to confirm the currently-previewed
// side. Reuses the existing shape-selector buttons for n (no new
// picker) and raw click coordinates for P/Q (no snap-to-existing-node -
// the grid any existing node belongs to is about to be replaced
// entirely, so snapping to it has no clear meaning here, unlike
// ordinary connection-drawing).
let altNetActive = false;
let altNetPending = null; // null | {p} | {p, q, previewSide}

// UI-level safeguard against a careless near-zero-length click pair,
// which would otherwise silently hit core/tiling.js's MAX_TILES safety
// cap (cce6a8b) rather than giving immediate, obvious feedback. Well
// below any default net's own smallest edge (canvasW/9 at
// shapeSizeFactor=9 - e.g. ~67px on a 600px canvas), but far above the
// ~3px scale that measurably produces a pathological tile count (1.2-B
// design session) - a rejected click just doesn't advance the state
// machine (stays waiting for a valid Q), no separate error UI needed.
const MIN_EDGE_LENGTH = 20;

function shapeToN(shape) { return shape === 'triangle' ? 3 : (shape === 'square' ? 4 : 6); }

// Which side of line PQ point m falls on, in this project's screen
// coordinates (y increasing downward) - sign verified directly against
// completeEdgeToRegularPolygon()'s own `side` parameter (1.2-C
// implementation note): a positive cross product here matches side=+1.
function sideOfLine(p, q, m) {
    const cross = (q.x - p.x) * (m.y - p.y) - (q.y - p.y) * (m.x - p.x);
    return cross >= 0 ? 1 : -1;
}

function cancelAltNetConstruction() {
    altNetActive = false;
    altNetPending = null;
    const btn = select('#btn-alternative-net');
    if (btn) btn.removeClass('active');
}

function handleAltNetClick(x, y) {
    if (altNetPending === null) {
        altNetPending = { p: { x, y } };
        redraw();
        return;
    }
    if (altNetPending.q === undefined) {
        const q = { x, y };
        if (dist(altNetPending.p.x, altNetPending.p.y, q.x, q.y) < MIN_EDGE_LENGTH) return; // reject - stay waiting for a valid Q
        altNetPending.q = q;
        altNetPending.previewSide = 1; // initial default; mouseMoved() corrects it live from here on
        redraw();
        return;
    }
    // Third click: confirm the currently-previewed side.
    const { p, q, previewSide } = altNetPending;
    const n = shapeToN(currentShape);
    rebuildGridFromConstruction(p, q, n, previewSide);
    renderLayerTabs(); // rebuildGridFromConstruction() clears additionalLayers - keep the tab strip in sync, same as the shape-button handler
    updateOffsetControls();
    cancelAltNetConstruction();
    redraw();
}

function mouseMoved() {
    if (altNetActive && altNetPending && altNetPending.q !== undefined) {
        altNetPending.previewSide = sideOfLine(altNetPending.p, altNetPending.q, mouseX, mouseY);
    }
    if (showNodes || (altNetActive && altNetPending)) redraw();
}

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
    // Roadmap 1.12 stage 1: nodeCount/shapeSizeFactor - this layer's own
    // order/size, independent of the base's (see core/forms.js's
    // layerGrid(), which derives this layer's actual grid from these two
    // fields plus the base's CURRENT outerCorners/centroid - never
    // cached here, always re-derived fresh). Starts identical to the
    // base's current values (ratio=1, no visual change until the user
    // adjusts them), matching the natural "layer starts as a copy of
    // base" workflow addLayer() already establishes for connections.
    additionalLayers.push({ connections: [], redoStack: [], offsetX: 0, offsetY: 0, enabled: true, showFaces: false, nodeCount, shapeSizeFactor });
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

// ----------------- PATTERN NAME (Roadmap 1.11-B) ---------------------
// Per-sheet only (Base or whichever layer tab is active), same scoping
// as 1.10a's own per-sheet face detection - no combined/cross-layer
// name, since 1.9's offset overlay is a continuous parameter with no
// orbit structure to name against (see core/orbits.js's own docblock).

// Cached computeThemeLineName() result + the signature it was computed
// for - see updatePatternNameStatus()'s own comment in draw() for why
// this needs caching (unlike updateCrossLayerStatus()). null/null never
// matches a real signature, so the first call always computes for real.
let patternNameCacheSignature = null;
let patternNameCacheValue = null;

// Everything the active sheet's name actually depends on: which shape/
// symmetry group is active, which sheet is selected, and that sheet's
// own connections (activeConnections() - already the existing base/
// layer selector, see INTERACTION above). Deliberately explicit about
// shape/mode rather than relying only on rebuildGrid()'s side effect of
// clearing connections on a shape change (the way crossLayerConfigSignature()
// implicitly does) - cheap either way, and self-evidently correct
// without depending on a side effect defined elsewhere.
function patternNameSignature() {
    return JSON.stringify({ shape: currentShape, mode: symmetryMode, activeLayer, conns: activeConnections() });
}

// Updates #pattern-name-status for whichever sheet is currently active.
// Called once per draw() (see there for why this is cached rather than
// unconditional like updateCrossLayerStatus()).
function updatePatternNameStatus() {
    const statusEl = select('#pattern-name-status');
    if (!statusEl) return;

    const sig = patternNameSignature();
    if (sig !== patternNameCacheSignature) {
        patternNameCacheValue = computeThemeLineName(activeConnections());
        patternNameCacheSignature = sig;
    }
    statusEl.html(patternNameCacheValue || 'No theme lines yet');
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

// Roadmap 1.10b-ii-d (performance follow-up): offscreen cache for
// drawCrossLayerFaceFillsAcrossCanvas()'s own output - real profiling
// found that pass costs ~390ms at 915 faces/23x23 tiles, almost entirely
// canvas draw-call volume (fill()/vertex()), and it was being re-run from
// scratch on EVERY draw() (including plain mouseMoved() redraws, see
// draw() below), not just when the underlying result actually changed.
// crossLayerFillBuffer holds the rendered-once image; crossLayerFillBufferSignature
// is the crossLayerResultSignature it was rendered for - draw() only
// re-renders into the buffer when these disagree (i.e. a new compute was
// accepted since the buffer was last built), and just blits the buffer
// (a single image() call, measured ~0.001ms) otherwise. null/null is
// deliberately never "equal" to a real signature, so the very first
// current result always triggers one real render, same as before caching
// existed.
let crossLayerFillBuffer = null;
let crossLayerFillBufferSignature = null;

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
        // Roadmap 1.10b-ii-c: redraw() so the newly computed result
        // actually renders (drawCrossLayerFaceFillsAcrossCanvas(), see
        // draw()) - 1.10b-ii-b never needed this (no rendering existed
        // yet, only the status-text summary updateCrossLayerStatus()
        // handles), so it was correctly absent there; without it here,
        // the canvas silently keeps showing whatever it last rendered
        // (compute-and-display would stop being one action in practice,
        // even though the result IS computed and non-stale) until some
        // UNRELATED interaction happens to trigger its own redraw().
        redraw();
    }, 0);
}

function mousePressed() {
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
    if (altNetActive) { handleAltNetClick(mouseX, mouseY); return; }
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
