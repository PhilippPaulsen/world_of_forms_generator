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

// Roadmap: catalog (gallery.html) -> generator back-link. A catalog
// entry's (shape, order, symmetryMode, orbitIds) tuple is already
// exactly what core/orbits.js's computeThemeLineOrbits() needs to
// reconstruct the same connections gallery-render.js's own
// renderFullTessellationSVG() builds - see the design session for why
// node-id numbering is guaranteed identical regardless of scale
// (core/forms.js's id assignment depends only on nodeCount, never on
// shapeSizeFactor/canvas size) and why shapeSizeFactor is deliberately
// NOT part of this scheme (a pure rendering parameter, no bearing on
// which nodes/orbits exist).
//
// orbitIds is comma-separated, not '+' (the pattern-name display
// format's own separator, e.g. "2*/D3 0+2") - '+' in a URL query VALUE
// is reserved and silently decodes to a space unless percent-encoded,
// which would corrupt the id list; comma has no such meaning.
//
// Two validation layers, deliberately kept separate (see the design
// session): this function is the SYNTACTIC layer only - can these four
// params even describe a real request - checked before touching any
// grid/orbit machinery. The SEMANTIC layer (do the given orbitIds
// actually exist in THIS exact table) can only run once the grid is
// built - see applyCatalogPattern() below. Returns null (never a
// partial/best-guess object) for anything that doesn't clearly ask for
// a catalog pattern - an ordinary load with no query string, and a
// malformed one, are treated identically: fall through to the normal
// addRandomConnection() default.
const CATALOG_URL_SHAPES = ['triangle', 'square', 'hex'];
const CATALOG_URL_MODES = ['none', 'reflection_only', 'rotation3', 'rotation6', 'rotation_reflection3', 'rotation_reflection6'];

function parseCatalogUrlParams(search) {
    const params = new URLSearchParams(search);
    const shape = params.get('shape');
    const orderRaw = params.get('order');
    const symmetryModeParam = params.get('symmetryMode');
    const orbitIdsRaw = params.get('orbitIds');
    if (!shape || !orderRaw || !symmetryModeParam || !orbitIdsRaw) return null;

    if (!CATALOG_URL_SHAPES.includes(shape)) return null;
    // Deliberately NOT normSym() here - that function's fallback
    // ('rotation_reflection6' for anything unrecognized) exists to keep
    // a live UI control always showing SOMETHING sane; here, an
    // unrecognized mode means the whole link is malformed, and should
    // fall through to the ordinary default rather than silently
    // substituting a DIFFERENT mode and proceeding to look up orbitIds
    // against the wrong group's table.
    if (!CATALOG_URL_MODES.includes(symmetryModeParam)) return null;

    const order = parseInt(orderRaw, 10);
    // 1..5 matches #node-count-input's own min/max (index.html) - every
    // real manifest entry is within this range (max observed: 5,
    // triangle), so this is a syntactic sanity bound, not a workaround.
    if (!Number.isInteger(order) || order < 1 || order > 5) return null;

    const orbitIds = orbitIdsRaw.split(',').map(s => parseInt(s, 10));
    if (orbitIds.length === 0 || orbitIds.some(id => !Number.isInteger(id) || id < 0)) return null;

    return { shape, order, symmetryMode: symmetryModeParam, orbitIds };
}

// Semantic validation + reconstruction (the second layer above) - only
// meaningful once rebuildGrid(currentShape) has already run for the
// resolved shape/order, since it needs the real live nodes/centroid.
// Mirrors gallery-render.js's renderFullTessellationSVG() exactly:
// connections = orbitIds.map(id => table.orbits[id].pairs[0]) - the
// SAME reconstruction, reusing the SAME live orbit-table glue
// (computeThemeLineOrbitTable(), core/orbits.js - already loaded by
// index.html for the existing pattern-name-status feature) rather than
// a second, independently-written lookup. Any representative pair
// (pairs[0]) is fine to use as-is - two pairs land in the same orbit
// precisely because the group maps one onto the other, so the rendered
// copy-set is an invariant of the orbit, not of which member was
// chosen (see the design session). Returns true/false so the caller
// knows whether to fall back to addRandomConnection(); never throws
// out of setup() - a stale/malformed orbitIds (not realistic for an
// app-generated link, but a hand-edited or future-format-drifted one
// should degrade gracefully) is reported via console.warn, not a new
// UI element (deliberately - this is expected to be rare enough that
// building dedicated in-page chrome for it isn't warranted yet).
function applyCatalogPattern(pattern) {
    try {
        const table = computeThemeLineOrbitTable(pattern.symmetryMode);
        const newConnections = pattern.orbitIds.map(id => {
            if (!table.orbits[id]) {
                throw new Error(`orbit id ${id} does not exist for ${pattern.shape} order ${pattern.order} ${pattern.symmetryMode} (table has ${table.orbits.length} orbits)`);
            }
            return table.orbits[id].pairs[0];
        });
        connections = newConnections;
        return true;
    } catch (err) {
        console.warn('Failed to load catalog pattern from URL - falling back to the default random connection:', err.message);
        return false;
    }
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
            updateSymmetryModeControl(); // Roadmap 1.11: fold row only applies to hex - show/hide it and re-resolve symmetryMode for the new shape (function declaration, hoisted within setup() regardless of textual order below)
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

    // Roadmap: catalog -> generator back-link (see parseCatalogUrlParams()/
    // applyCatalogPattern() above for the full reasoning). Parsed once,
    // here - after the shape/node-count controls exist and have their
    // ordinary defaults, but before anything downstream (the symmetry-
    // mode block, the final rebuildGrid() at the end of setup()) reads
    // currentShape/nodeCount - so a valid catalog link overrides BOTH
    // the internal state AND the controls a real user interaction would
    // also update (point 3 of the design: not just connections, or the
    // shape icons/node-count input would visually disagree with the
    // actually-loaded grid). symmetryMode itself is applied further
    // below, once modeBtns/foldBtns exist.
    const catalogUrlPattern = parseCatalogUrlParams(location.search);
    if (catalogUrlPattern) {
        currentShape = catalogUrlPattern.shape;
        nodeCount = catalogUrlPattern.order;
        shapeBtns.forEach(b => b.removeClass('active'));
        const matchingShapeBtn = shapeBtns.find(b => b.attribute('data-shape') === currentShape);
        if (matchingShapeBtn) matchingShapeBtn.addClass('active');
        if (nodeInput) nodeInput.value(nodeCount);
    }

    // Symmetry Mode (Spiegeling/Drehling button group + hex-only fold
    // sub-row) - see index.html's own comment on this control for the
    // removal/reintroduction history. Category+fold state resolves to
    // one of the six canonical raw mode strings via
    // resolveSymmetryMode() - normSym() still validates the result
    // (defensive, matches the function's existing role elsewhere)
    // even though every reachable combination is already one of the
    // six real values by construction.
    let symmetryCategory = 'spiegeling'; // 'none' | 'spiegeling' | 'drehling' - matches the pre-existing rotation_reflection6 default
    let symmetryFold = 6; // 3 | 6 - hex only, ignored for triangle/square

    function resolveSymmetryMode(shape, category, fold) {
        if (category === 'none') return 'none';
        if (shape === 'hex') {
            if (category === 'spiegeling') return fold === 3 ? 'rotation_reflection3' : 'rotation_reflection6';
            return fold === 3 ? 'rotation3' : 'rotation6';
        }
        // Triangle/square: rotation3 ≡ rotation6 and rotation_reflection3 ≡
        // rotation_reflection6 (confirmed collapse, group-verification
        // session) - fold is meaningless there, so one representative
        // raw mode per category is picked arbitrarily but consistently.
        return category === 'spiegeling' ? 'rotation_reflection6' : 'rotation3';
    }

    function updateSymmetryModeControl() {
        symmetryMode = normSym(resolveSymmetryMode(currentShape, symmetryCategory, symmetryFold));
        const foldGroup = select('#mode-fold-group');
        if (foldGroup) foldGroup.elt.hidden = currentShape !== 'hex';
    }

    const modeBtns = selectAll('.mode-btn');
    modeBtns.forEach(btn => {
        btn.mousePressed(() => {
            modeBtns.forEach(b => b.removeClass('active'));
            btn.addClass('active');
            symmetryCategory = btn.attribute('data-mode');
            updateSymmetryModeControl();
            redraw();
        });
    });

    const foldBtns = selectAll('.fold-btn');
    foldBtns.forEach(btn => {
        btn.mousePressed(() => {
            foldBtns.forEach(b => b.removeClass('active'));
            btn.addClass('active');
            symmetryFold = parseInt(btn.attribute('data-fold'));
            updateSymmetryModeControl();
            redraw();
        });
    });

    updateSymmetryModeControl(); // initial sync - keeps symmetryMode/fold-row-visibility correct on load without waiting for a click

    // Roadmap: catalog -> generator back-link, continued from above - the
    // raw symmetryMode from the URL wins outright over whatever
    // updateSymmetryModeControl() just resolved from the default
    // category/fold, since it's already the portable, authoritative
    // value (point 1 of the design - no category/fold re-derivation
    // needed or wanted). Button highlighting below is best-effort: exact
    // for the four rotation-bearing raw modes (this table is literally
    // resolveSymmetryMode()'s own inverse) and for 'none', approximate
    // for 'reflection_only' (Z2) - Z2 has no category+fold combination
    // that reaches it (see the design session), so Spiegeling is
    // highlighted as the conceptually correct category (Ostwald's own
    // term covers the full reflection-containing case, not just the
    // dihedral groups) even though re-clicking it afterward would NOT
    // reproduce Z2 - a known, deliberately-deferred gap, not something
    // this feature tries to solve. symmetryCategory/symmetryFold
    // themselves are updated too, not just the button classes, so a
    // LATER updateSymmetryModeControl() call (e.g. a subsequent shape-
    // icon click) resolves from a sane starting point instead of a
    // stale pre-load default.
    if (catalogUrlPattern) {
        symmetryMode = catalogUrlPattern.symmetryMode;
        const bestEffort = {
            none: { category: 'none', fold: symmetryFold },
            reflection_only: { category: 'spiegeling', fold: symmetryFold },
            rotation3: { category: 'drehling', fold: 3 },
            rotation6: { category: 'drehling', fold: 6 },
            rotation_reflection3: { category: 'spiegeling', fold: 3 },
            rotation_reflection6: { category: 'spiegeling', fold: 6 },
        }[symmetryMode];
        if (bestEffort) {
            symmetryCategory = bestEffort.category;
            symmetryFold = bestEffort.fold;
            modeBtns.forEach(b => b.removeClass('active'));
            const matchingModeBtn = modeBtns.find(b => b.attribute('data-mode') === symmetryCategory);
            if (matchingModeBtn) matchingModeBtn.addClass('active');
            foldBtns.forEach(b => b.removeClass('active'));
            const matchingFoldBtn = foldBtns.find(b => parseInt(b.attribute('data-fold')) === symmetryFold);
            if (matchingFoldBtn) matchingFoldBtn.addClass('active');
        }
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
    // Roadmap 1.12 stage 1 pass 2: this layer's own order/size - same
    // contextual show/hide + populate-on-switch handling as the offset
    // controls above, folded into this same function (not a separate
    // one) since both are "sync every layer-contextual control" and are
    // already called together from every one of updateOffsetControls()'s
    // existing call sites (layer switch/add/remove, shape/size/node-
    // count change).
    const nodeCountGroup = select('#layer-node-count-group');
    const shapeSizeGroup = select('#layer-shape-size-group');
    const layerNodeCountInput = select('#layer-node-count-input');
    const layerShapeSizeInput = select('#layer-shape-size-input');
    // Roadmap 1.12 stage 4 (UI): this layer's own shape - same
    // contextual show/hide handling as the fields above, PLUS an
    // active-state sync (which of the three buttons reflects
    // layer.shape) since this is a button group, not a value input.
    const shapeGroup = select('#layer-shape-group');
    const layerShapeBtns = selectAll('.layer-shape-icon-btn');
    // Roadmap 1.12 "Align to base": same contextual show/hide as the
    // fields above, PLUS a disabled-state sync (same-shape-only, per
    // this feature's scope) and clearing any stale "not achievable"
    // message on every switch, so it never lingers across a layer
    // change or shape change it no longer applies to.
    const alignGroup = select('#layer-align-group');
    const alignBtn = select('#btn-align-to-base');
    const alignStatus = select('#align-to-base-status');
    // Roadmap 1.12 stage 3: this layer's own rotation - same contextual
    // show/hide + populate-on-switch handling as the fields above,
    // folded into this same function for the same reason.
    const rotationGroup = select('#layer-rotation-group');
    const layerRotationInput = select('#layer-rotation-input');

    function updateOffsetControls() {
        const showOffsets = activeLayer !== 'base';
        if (offsetXGroup) offsetXGroup.elt.hidden = !showOffsets;
        if (offsetYGroup) offsetYGroup.elt.hidden = !showOffsets;
        if (meshPresetGroup) meshPresetGroup.elt.hidden = !showOffsets;
        if (shapeGroup) shapeGroup.elt.hidden = !showOffsets;
        if (alignGroup) alignGroup.elt.hidden = !showOffsets;
        if (nodeCountGroup) nodeCountGroup.elt.hidden = !showOffsets;
        if (shapeSizeGroup) shapeSizeGroup.elt.hidden = !showOffsets;
        if (rotationGroup) rotationGroup.elt.hidden = !showOffsets;
        if (showOffsets) {
            const layer = additionalLayers[activeLayer];
            if (offsetXInput) offsetXInput.value(layer.offsetX);
            if (offsetYInput) offsetYInput.value(layer.offsetY);
            if (layerNodeCountInput) layerNodeCountInput.value(layer.nodeCount);
            if (layerShapeSizeInput) layerShapeSizeInput.value(layer.shapeSizeFactor);
            if (layerRotationInput) layerRotationInput.value(layer.rotation || 0);
            // Roadmap 1.12 stage 4 (UI): active-state sync for the
            // layer-shape button group, mirroring how the base's own
            // .shape-icon-btn set tracks currentShape - this is the
            // "populate on switch" step for a button group instead of a
            // value input.
            layerShapeBtns.forEach(b => {
                if (b.attribute('data-shape') === layer.shape) b.addClass('active');
                else b.removeClass('active');
            });
            // Roadmap 1.12 "Align to base": same-shape-only, per this
            // feature's scope (triangle-hex/square-anything exact
            // alignment needs a decoupled, non-integer sizing input -
            // out of scope, a later session). Disabled (not hidden) so
            // the button stays a consistent visual anchor; the tooltip
            // explains why when it's unavailable.
            if (alignBtn) {
                const shapeMatches = layer.shape === currentShape;
                alignBtn.elt.disabled = !shapeMatches;
                alignBtn.attribute('title', shapeMatches ? 'Align to base' : "Only available when this layer's shape matches the base's");
            }
            if (alignStatus) alignStatus.html('');
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

    // Roadmap 1.12 stage 4 (UI): this layer's own shape - the missing
    // piece that finally makes a real cross-net-type combination
    // (e.g. triangle base + hexagon layer) reachable through actual
    // clicks, not just script-driven state (stage 4 parts 1-2 already
    // shipped the data model/rendering/symmetry for it). Separate
    // handler from the base's own .shape-icon-btn one above - writes
    // additionalLayers[activeLayer].shape via updateActiveLayerGrid(),
    // never currentShape, and updates only the LAYER buttons' own
    // active state (the base's selector is untouched by this).
    if (layerShapeBtns.length) {
        layerShapeBtns.forEach(btn => {
            btn.mousePressed(() => {
                if (activeLayer === 'base') return;
                layerShapeBtns.forEach(b => b.removeClass('active'));
                btn.addClass('active');
                updateActiveLayerGrid({ shape: btn.attribute('data-shape') });
                // Roadmap 1.12 "Align to base" bugfix: found live while
                // testing - this handler predates the align button and
                // never re-synced the layer-contextual controls'
                // disabled/active state after a shape change, so
                // #btn-align-to-base stayed enabled even once this
                // layer's shape no longer matched the base's (its own
                // manual active-class toggle above is exactly the kind
                // of narrow, single-field update updateOffsetControls()
                // exists to replace - see its own docblock). Calling the
                // shared sync function here keeps every layer-contextual
                // control (not just the align button) consistent with
                // this layer's new shape, the same as every other
                // shape/size/rotation change already does.
                updateOffsetControls();
                redraw();
            });
        });
    }

    // Roadmap 1.12 "Align to base": computed suggestion, same explicit-
    // action convention as the mesh-width preset buttons below (never
    // automatic). alignLayerToBase() (core/forms.js) searches the
    // layer's own reachable parameter range for the smallest
    // (shapeSizeFactor, nodeCount) pair whose grid is a strict superset
    // of the base's own nodes - see the design session for the derived,
    // per-shape condition. Guarded by activeLayer/shape-match even
    // though the button is already disabled in that state (updateOffsetControls()) -
    // defense in depth against a stale click queued before a fast
    // layer/shape switch. On success, applies via the SAME
    // updateActiveLayerGrid() path every other layer-grid-changing
    // control already uses (clears this layer's own connections/
    // redoStack, refreshes its persisted grid) and syncs the now-stale
    // Layer Node Count/Layer Shape Size input displays. On
    // {achievable:false}, shows an explicit status message - never a
    // silent no-op, never an inexact approximation applied instead.
    if (alignBtn) {
        alignBtn.mousePressed(() => {
            if (activeLayer === 'base') return;
            const layer = additionalLayers[activeLayer];
            if (layer.shape !== currentShape) return;
            const result = alignLayerToBase(shapeSizeFactor, nodeCount, layer.shapeSizeFactor, layer.nodeCount, layer.shape);
            if (result.achievable) {
                updateActiveLayerGrid({ shapeSizeFactor: result.shapeSizeFactor, nodeCount: result.nodeCount });
                if (layerShapeSizeInput) layerShapeSizeInput.value(layer.shapeSizeFactor);
                if (layerNodeCountInput) layerNodeCountInput.value(layer.nodeCount);
                if (alignStatus) alignStatus.html('');
                redraw();
            } else {
                if (alignStatus) alignStatus.html('Not achievable within the current parameter ranges.');
            }
        });
    }

    // Roadmap 1.12 stage 1 pass 2: this layer's own order/size - same
    // clamp ranges as the base sheet's own Shape Size/Node Count inputs
    // above (1-9 / 1-5), acting on whichever layer is currently active.
    // updateActiveLayerGrid() (INTERACTION section below) does the
    // actual state mutation (clear this layer's own connections/
    // redoStack, refresh its persisted grid via layerGrid()) - these
    // handlers are just the DOM wiring, same division of labor as
    // mousePressed()/addRandomConnection() calling activeNodes() rather
    // than inlining the base/layer split themselves.
    if (layerNodeCountInput) {
        layerNodeCountInput.input(() => {
            if (activeLayer === 'base') return;
            let v = parseInt(layerNodeCountInput.value());
            if (v < 1) v = 1; if (v > 5) v = 5;
            updateActiveLayerGrid({ nodeCount: v });
            redraw();
        });
    }
    if (layerShapeSizeInput) {
        layerShapeSizeInput.input(() => {
            if (activeLayer === 'base') return;
            let v = parseInt(layerShapeSizeInput.value());
            if (v < 1) v = 1; if (v > 9) v = 9;
            updateActiveLayerGrid({ shapeSizeFactor: v });
            redraw();
        });
    }

    // Roadmap 1.12 stage 3: this layer's own rotation - a pure render-
    // time placement parameter, exactly like offsetX/offsetY (not baked
    // into stored nodes/outerCorners, see the stage-3 design session's
    // point 1) - so, unlike nodeCount/shapeSizeFactor above, this needs
    // NO updateActiveLayerGrid() call: no connections-clearing, no grid
    // refresh, just the field itself. [0,360) wraparound is a pure UI
    // nicety (avoids an ever-growing spinner value on repeated
    // scrolling) - rotateAround() itself handles any angle correctly,
    // this normalization is not mathematically required.
    if (layerRotationInput) {
        layerRotationInput.input(() => {
            setActiveLayerRotation(layerRotationInput.value());
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
    // Draw a random connection on start - unless a valid catalog URL
    // pattern is already resolved (see catalogUrlPattern/applyCatalogPattern()
    // above), in which case that pattern's own connections replace the
    // random seed entirely. Any failure (semantic validation - orbitIds
    // that don't actually exist in this exact table) falls back to
    // exactly the pre-existing default, same as no URL pattern at all.
    if (!catalogUrlPattern || !applyCatalogPattern(catalogUrlPattern)) {
        addRandomConnection();
    }
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
    // Roadmap [layer node-dot rendering fix]: previously always the base
    // sheet's own `nodes`, regardless of activeLayer - an active,
    // differently-scaled/shaped layer's own node positions (already
    // correctly click-resolvable via activeNodes(), the stage-1 fix)
    // were never actually drawn, making it impossible to see where to
    // click to build a theme-line for that layer. Base sheet: full
    // interactive styling when it IS the active sheet (byte-identical to
    // before this fix), dimmed light gray when a layer tab is active
    // instead - drawTessellation() still renders the base's own
    // connections regardless of activeLayer, so its dots stay visible
    // for spatial reference (shared centroid) rather than disappearing
    // while its lines remain on screen. Scope: base + the ACTIVE layer
    // only, not every simultaneously-enabled layer (design confirmed).
    if (showNodes) {
        push();
        noStroke();
        nodes.forEach(nd => {
            if (activeLayer === 'base') {
                const d = dist(mouseX, mouseY, nd.x, nd.y);
                // Default: Schwarz (Grid) / Blau (frei) oder Rot bei Hover
                fill(d < 10 ? color(220, 0, 0) : (nd.free ? color(30, 110, 220) : color(0)));
            } else {
                fill(200);
            }
            ellipse(nd.x, nd.y, 6, 6);
        });
        // The active layer's own persisted nodes (canonical, untransformed
        // positions - same rendering convention as the base's own dots
        // above, see layerGrid()/addLayer()'s own comments for why these
        // are already in the right coordinate space with no offset/
        // rotation baked in).
        if (activeLayer !== 'base') {
            additionalLayers[activeLayer].nodes.forEach(nd => {
                const d = dist(mouseX, mouseY, nd.x, nd.y);
                fill(d < 10 ? color(220, 0, 0) : (nd.free ? color(30, 110, 220) : color(0)));
                ellipse(nd.x, nd.y, 6, 6);
            });
        }
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
// Roadmap 1.12 stage 1 (node-resolution fix): same base/active-layer
// split as the four helpers above, for the NODE array a click/random-
// connection should resolve/create against - mousePressed()'s hit-test
// and free-endpoint creation, and addRandomConnection()'s random pick,
// previously always read the bare global `nodes` regardless of
// activeLayer (the bug this fix addresses). Returns the actual array
// (mutated via .push() by mousePressed(), same convention as
// activeConnections()), not a copy.
function activeNodes() { return activeLayer === 'base' ? nodes : additionalLayers[activeLayer].nodes; }
// Roadmap 1.12 stage 1 pass 2: the {nodes, centroid, outerCorners}
// gridOverride core/orbits.js's computeThemeLineOrbitTable() (and
// friends) expects - undefined for the base sheet, so callers can pass
// this straight through as the (optional) gridOverride argument and get
// that function's own base-global default, byte-identical to omitting
// it entirely. For an additional layer, its own PERSISTED fields (see
// addLayer()/updateActiveLayerGrid()) - never an ephemeral layerGrid()
// call, per the node-resolution fix this mirrors.
// Roadmap [orbits.js shape-mismatch fix]: shape - this layer's own
// shape, mirroring core/tiling.js's own override.shape embedding (the
// same override-object convention, not a separate accessor) - callers
// extract it as the shapeOverride argument to
// computeThemeLineOrbitTable()/computeThemeLineName()/friends, the
// same way tileHex()/tileSquare()/tileTriangle() extract override.shape
// before passing it onward. Correctly undefined for the base sheet
// (the whole object is undefined there), letting shapeOverride default
// to currentShape exactly as before this fix.
function activeGridOverride() {
    if (activeLayer === 'base') return undefined;
    const layer = additionalLayers[activeLayer];
    return { nodes: layer.nodes, centroid: layer.centroid, outerCorners: layer.outerCorners, shape: layer.shape };
}

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
    // order/size, independent of the base's. Starts identical to the
    // base's current values (ratio=1, no visual change until the user
    // adjusts them), matching the natural "layer starts as a copy of
    // base" workflow addLayer() already establishes for connections.
    //
    // Roadmap 1.12 stage 1 (node-resolution fix): nodes/centroid/outerCorners
    // are PERSISTED here (via one real layerGrid() call, core/forms.js),
    // not re-derived fresh on every render/interaction - a fresh call
    // would restart node ids at 1 every time (_subdivide*Interior()'s own
    // `let id = 1`), silently discarding any free-endpoint node (1.3(a))
    // pushed into a previous call's now-abandoned array. Refreshed again
    // only if this layer's own nodeCount/shapeSizeFactor changes later
    // (not yet wired - that's the paused pass 2's own point 4); never
    // re-derived on every redraw/click the way it was before this fix.
    // Roadmap 1.12 stage 3: rotation defaults to 0 (unrotated) - a pure
    // render-time placement field, same status as offsetX/offsetY, so no
    // grid-refresh implications at creation time either.
    // Roadmap 1.12 stage 4 (data model only - no rendering/UI wiring
    // yet): shape starts identical to the base's current shape, same
    // "layer starts as a copy of base" convention as nodeCount/
    // shapeSizeFactor above. Not yet threaded into the layerGrid() call
    // below (that's a later, UI-driven pass's job - see the stage-4
    // design session) - since layer.shape always equals currentShape at
    // creation time regardless, layerGrid()'s own layerShape parameter
    // (defaulting to baseShape when omitted, as it is here) already
    // produces the exact same, correct same-shape result.
    const layer = { connections: [], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape: currentShape, enabled: true, showFaces: false, nodeCount, shapeSizeFactor };
    const grid = layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, layer.shapeSizeFactor, layer.nodeCount);
    layer.nodes = grid.nodes;
    layer.centroid = grid.centroid;
    layer.outerCorners = grid.outerCorners;
    additionalLayers.push(layer);
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

// Roadmap 1.12 stage 1 pass 2: changes the ACTIVE layer's own nodeCount
// and/or shapeSizeFactor (patch, e.g. {nodeCount: 4}) and refreshes that
// layer's own persisted {nodes, centroid, outerCorners} via one real
// layerGrid() call - the second (and, per addLayer()'s own comment,
// final) trigger point layerGrid() needs beyond layer creation. No
// analogous call is needed for base-level changes: rebuildGrid()/
// rebuildGridFromConstruction() (core/state.js) already wipe
// additionalLayers=[] unconditionally on any base-level change, so no
// layer ever survives underneath a stale base grid.
//
// Also clears this layer's OWN connections/redoStack (not the base's,
// not any other layer's) - its previous connections reference node ids
// from the grid about to be replaced (_subdivide*Interior() restarts
// ids at 1 for a new nodeCount, so old ids from a differently-sized
// grid are stale, meaningless references), same reasoning rebuildGrid()
// already applies at the base-sheet level. A no-op when activeLayer is
// 'base' - this only ever changes an ADDITIONAL layer's own grid, never
// the base's (which has its own Shape Size/Node Count controls).
function updateActiveLayerGrid(patch) {
    if (activeLayer === 'base') return;
    const layer = additionalLayers[activeLayer];
    Object.assign(layer, patch);
    layer.connections = [];
    layer.redoStack = [];
    // Roadmap 1.12 stage 4 (UI) bugfix: layer.shape (post-patch, so a
    // {shape:...} patch takes effect on the SAME refresh that applies
    // it) and canvasW/canvasH were previously omitted here entirely -
    // layerGrid()'s layerShape parameter silently defaulted to baseShape
    // (currentShape) every time, so its cross-shape branch (which needs
    // canvasW/canvasH to size the new polygon - buildTriangleGrid()/
    // buildSquareGrid()/buildHexGrid()) was never actually reachable
    // through this function, for ANY layer - latent and harmless before
    // this session, since nothing could set a layer's shape differently
    // from the base's before this control existed, but a real bug now
    // that it does: without this, a shape-changing patch would update
    // layer.shape itself (Object.assign above) while silently leaving
    // the actual persisted grid geometry unchanged (still the base's
    // shape) - see the design session's own before/after verification.
    const grid = layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, layer.shapeSizeFactor, layer.nodeCount, layer.shape, canvasW, canvasH);
    layer.nodes = grid.nodes;
    layer.centroid = grid.centroid;
    layer.outerCorners = grid.outerCorners;
}

// Roadmap 1.12 stage 3: normalizes a raw rotation input value into
// [0,360) and writes it to the ACTIVE layer - a no-op when activeLayer
// is 'base'. Unlike updateActiveLayerGrid() above, this never clears
// connections/redoStack and never calls layerGrid() - rotation is a
// pure render-time placement parameter (like offsetX/offsetY), not
// baked into stored nodes/outerCorners, so no grid refresh is ever
// needed when it changes (see the stage-3 design session's own point
// 1). Extracted as its own function (mirroring updateActiveLayerGrid()'s
// own separation of DOM wiring from state-mutation logic), so it's
// directly testable headlessly without needing the DOM at all - the
// [0,360) wraparound itself is a pure UI nicety (avoids an ever-growing
// spinner value), not a mathematical requirement: rotateAround() (core/
// symmetry.js) handles any angle correctly regardless.
function setActiveLayerRotation(rawValue) {
    if (activeLayer === 'base') return;
    let v = parseFloat(rawValue) || 0;
    v = ((v % 360) + 360) % 360;
    additionalLayers[activeLayer].rotation = v;
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
// Roadmap [orbits.js shape-mismatch fix]: shape now reads the ACTIVE
// sheet's own shape (activeGridOverride()'s shape field, falling back
// to currentShape for the base) rather than the bare currentShape
// global - this function's own comment above already states its
// design principle as "deliberately explicit... rather than relying on
// a side effect defined elsewhere"; keying the cache on the base's
// shape even while a differently-shaped layer is active contradicted
// that principle, even though it wasn't independently observable as a
// bug (a layer's own shape change already clears its connections,
// which this same signature also tracks via conns, so the cache still
// happened to invalidate correctly regardless - fixed here for
// consistency with the stated principle, not because of an observed
// stale-cache symptom).
function patternNameSignature() {
    const activeShape = activeLayer === 'base' ? currentShape : additionalLayers[activeLayer].shape;
    return JSON.stringify({ shape: activeShape, mode: symmetryMode, activeLayer, conns: activeConnections() });
}

// Updates #pattern-name-status for whichever sheet is currently active.
// Called once per draw() (see there for why this is cached rather than
// unconditional like updateCrossLayerStatus()).
function updatePatternNameStatus() {
    const statusEl = select('#pattern-name-status');
    if (!statusEl) return;

    const sig = patternNameSignature();
    if (sig !== patternNameCacheSignature) {
        // Roadmap 1.12 stage 1 pass 2 (node-resolution fix follow-through):
        // activeGridOverride() instead of omitting the argument - this
        // previously always computed the name against the BASE's own
        // grid regardless of activeLayer, so a differently-sized/scaled
        // layer's displayed name was silently wrong (orbit ids resolved
        // against the wrong node set, same bug class the shipped fix
        // addressed for rendering/interaction - just not yet wired here).
        // Roadmap [orbits.js shape-mismatch fix]: gridOverride captured
        // once (not called twice) - its own .shape field (correctly
        // undefined for the base sheet) is threaded through as the new
        // shapeOverride argument, so a layer whose shape differs from
        // the base's gets its OWN shape's symmetry group, not the
        // base's (the crash/wrong-result this fix addresses).
        const gridOverride = activeGridOverride();
        patternNameCacheValue = computeThemeLineName(activeConnections(), undefined, gridOverride, gridOverride && gridOverride.shape);
        patternNameCacheSignature = sig;
    }
    // Roadmap [orbits.js free-endpoint fix]: computeThemeLineName() now
    // returns null both when nothing's drawn yet AND when the active
    // sheet's connections include a free-endpoint node (1.3(a) - no
    // orbit under the fixed symmetry group by construction, see
    // core/orbits.js's computeThemeLineOrbits()) - these are genuinely
    // different situations and shouldn't share one fallback text; the
    // old unconditional "No theme lines yet" would be actively
    // misleading for a sheet that clearly has visible lines.
    if (patternNameCacheValue) {
        statusEl.html(patternNameCacheValue);
    } else if (activeConnections().some(c => c.length === 2)) {
        statusEl.html('Name unavailable (includes free endpoints)');
    } else {
        statusEl.html('No theme lines yet');
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

// Roadmap 1.12 stage 1: cross-layer face detection (computeCrossLayerFaces(),
// core/faces.js) assumes every sheet shares ONE lattice, translated by a
// constant offset (_planCrossLayerNeighborhood()'s single shared v1/v2/R/M,
// see the 1.12 stage-1 design session's own finding) - correct for 1.9's
// offset-only layers, but NOT for a layer whose own scale (shapeSizeFactor)
// differs from the base's, which has a genuinely different lattice period.
// Computing anyway would silently produce wrong faces, not just imprecise
// ones - refused outright rather than computed with a caveat, same "don't
// silently compute wrong" principle as computeLayerCellFaces()'s own guard
// (core/tiling.js). Returns the actual mismatched layers (not just a
// boolean) so the status message can name them.
//
// Roadmap 1.12 stage 3: also excludes a layer with a nonzero rotation,
// even at matching scale - renamed from scaleMismatchedEnabledLayers()
// since it's no longer just a scale check. _planCrossLayerNeighborhood()/
// _meshBasisVectors() (core/faces.js) assume every included layer shares
// the base's EXACT v1/v2 - decomposeLatticeOffset() decomposes a layer's
// offset against the BASE's own (unrotated) lattice vectors, and
// collectCrossLayerSegments() calls drawShapeCell() with no rotation-
// awareness at all. A same-scale-but-rotated layer would previously have
// PASSED this guard (it only checked shapeSizeFactor) and gone on to
// silently compute wrong cross-layer face geometry.
// Roadmap 1.12 stage 4 (UI) guard fix: also excludes a layer whose own
// shape differs from the base's - found while implementing the per-layer
// shape control (a differently-shaped layer was previously reachable
// only via direct state manipulation, never through this guard's own
// live path). "Every sheet shares ONE lattice" (this function's own
// docblock above) fails even more fundamentally for a shape mismatch
// than for the scale/rotation cases already excluded - a hex lattice and
// a triangle lattice aren't the same lattice TYPE, so
// _planCrossLayerNeighborhood()/_meshBasisVectors() (core/faces.js)
// would otherwise silently compute cross-layer faces against the wrong
// basis entirely, not just an imprecise one.
function incompatibleEnabledLayersForCrossLayerFaces() {
    return additionalLayers
        .map((layer, i) => ({ index: i, layer }))
        .filter(({ layer }) => layer.enabled && (layer.shapeSizeFactor !== shapeSizeFactor || (layer.rotation || 0) !== 0 || layer.shape !== currentShape));
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

    const mismatched = incompatibleEnabledLayersForCrossLayerFaces();
    if (mismatched.length > 0) {
        const names = mismatched.map(({ index }) => `Layer ${index + 1}`).join(', ');
        // Roadmap 1.12 stage 4 (UI): wording updated alongside
        // incompatibleEnabledLayersForCrossLayerFaces()'s own new shape
        // check above - "size or rotation" alone became misleading for a
        // layer flagged ONLY because its shape differs (matching scale
        // and rotation otherwise), which the new per-layer shape control
        // makes reachable for the first time.
        statusEl.html(`Cross-layer face detection needs every enabled layer to share the base's shape, scale and rotation - ${names} ${mismatched.length === 1 ? 'has' : 'have'} an independent shape, size or rotation. Match the base or disable to compute.`);
        return;
    }

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

    // Roadmap 1.12 stage 1: refuse outright rather than compute wrong
    // faces - see incompatibleEnabledLayersForCrossLayerFaces()'s own
    // comment. Checked here too (not just in updateCrossLayerStatus()'s
    // proactive display) as the actual hard safety net: the button could
    // in principle still be clicked while the status text hasn't caught
    // up for some reason, and this is the call that would do real,
    // silently-wrong work.
    const mismatched = incompatibleEnabledLayersForCrossLayerFaces();
    if (mismatched.length > 0) {
        updateCrossLayerStatus();
        return;
    }

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
    // Roadmap 1.12 stage 1 (node-resolution fix): activeNodes() instead
    // of the bare global `nodes` - both the hit-test below and 1.3(a)'s
    // free-endpoint creation previously always read/wrote the base's
    // array regardless of activeLayer, so a free-endpoint node created
    // while a layer tab was active silently landed in the BASE's node
    // space (and id range) instead of that layer's own.
    const activeNodeArr = activeNodes();
    let foundId = null;
    for (let nd of activeNodeArr) { if (dist(mouseX, mouseY, nd.x, nd.y) < 18) { foundId = nd.id; break; } }
    if (foundId === null && freeEndpointsEnabled) {
        const newId = Math.max(...activeNodeArr.map(n => n.id), 0) + 1;
        activeNodeArr.push({ id: newId, x: mouseX, y: mouseY, free: true });
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
    // Roadmap 1.12 stage 1 (node-resolution fix): same activeNodes()
    // swap as mousePressed() - previously always picked from the bare
    // global `nodes`, so a "random connection" added to a layer would
    // reference the BASE's node ids even while that layer was active.
    const activeNodeArr = activeNodes();
    if (activeNodeArr.length < 2) return;
    let i = floor(random(activeNodeArr.length)); let j = floor(random(activeNodeArr.length));
    if (i === j) return; activeConnections().push([activeNodeArr[i].id, activeNodeArr[j].id]);
}
