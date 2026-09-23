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

// Roadmap: catalog pattern syntactic validation - shared between the
// URL-driven back-link (parseCatalogUrlParams() below) and the
// clipboard-driven "Paste Pattern" action (parseClipboardCatalogPattern()
// below) - ONE definition of "what a valid pattern object looks like",
// not two independently-drifting copies (design session point 1).
// Takes already-coerced-to-target-type candidate values - each caller's
// own parsing step (URLSearchParams string splitting vs. JSON.parse)
// stays separate, since the two transports hand this differently-shaped
// raw input (strings from a query string; whatever JSON.parse produced,
// which for a hand-edited clipboard payload could be any type at all)
// - this only checks range/enum validity once that coercion has already
// happened. Deliberately NOT normSym() for symmetryMode - see
// parseCatalogUrlParams()'s own original comment on that, unchanged in
// meaning by this extraction.
function isWellFormedCatalogPattern(shape, order, symmetryMode, orbitIds) {
    if (!CATALOG_URL_SHAPES.includes(shape)) return false;
    if (!CATALOG_URL_MODES.includes(symmetryMode)) return false;
    // 1..7 matches #node-count-input's own min/max (index.html) - every
    // real manifest entry is within the lower part of this range (max
    // observed: 5, triangle; the ceiling itself was raised to 7 per
    // Group A's node-count-limit item, see nodeInput's own clamp
    // comment in setup()), so this is a syntactic sanity bound, not a
    // workaround.
    if (!Number.isInteger(order) || order < 1 || order > 7) return false;
    if (!Array.isArray(orbitIds) || orbitIds.length === 0 || orbitIds.some(id => !Number.isInteger(id) || id < 0)) return false;
    return true;
}

function parseCatalogUrlParams(search) {
    const params = new URLSearchParams(search);
    const shape = params.get('shape');
    const orderRaw = params.get('order');
    const symmetryModeParam = params.get('symmetryMode');
    const orbitIdsRaw = params.get('orbitIds');
    if (!shape || !orderRaw || !symmetryModeParam || !orbitIdsRaw) return null;

    const order = parseInt(orderRaw, 10);
    const orbitIds = orbitIdsRaw.split(',').map(s => parseInt(s, 10));
    if (!isWellFormedCatalogPattern(shape, order, symmetryModeParam, orbitIds)) return null;

    // Roadmap: catalog -> NEW LAYER back-link extension. 'new' is
    // currently the only recognized value - a numeric layer INDEX would
    // have no meaningful referent on a fresh page load (the generator
    // always starts with zero additional layers; there is no
    // pre-existing session for a URL to target by index - see the
    // design session). Present-but-not-'new' is reported (not silently
    // ignored) and treated as absent, so a typo'd layer= value degrades
    // to the ordinary base-sheet link rather than doing something
    // unexpected, and doesn't invalidate the rest of an otherwise-valid
    // link the way a malformed shape/order/symmetryMode/orbitIds does.
    const layerRaw = params.get('layer');
    let layer = null;
    if (layerRaw === 'new') {
        layer = 'new';
    } else if (layerRaw !== null) {
        console.warn(`Unrecognized layer= value "${layerRaw}" in catalog URL - ignoring, loading as the base pattern instead.`);
    }

    return { shape, order, symmetryMode: symmetryModeParam, orbitIds, layer };
}

// Roadmap: catalog -> clipboard "Paste Pattern" action. Parses+validates
// a clipboard payload written by gallery.js's "Copy pattern" button
// (JSON.stringify({shape, order, symmetryMode, orbitIds})) via the SAME
// syntactic validation as the URL path (isWellFormedCatalogPattern()
// above) - clipboard content is exactly as untrusted as a hand-edited
// URL (stale, hand-edited, or from something else entirely; JSON.parse
// itself can hand back any type for shape/order/symmetryMode/orbitIds,
// not necessarily the right ones). Never throws, returns null for
// anything that doesn't clearly describe a real pattern - same "no
// partial/best-guess object" convention as parseCatalogUrlParams().
// Always targets a NEW layer (no base-sheet equivalent, no `layer`
// field to parse) - see this action's own design session point 3.
function parseClipboardCatalogPattern(text) {
    let obj;
    try {
        obj = JSON.parse(text);
    } catch (err) {
        return null;
    }
    if (!obj || typeof obj !== 'object') return null;
    const { shape, order, symmetryMode, orbitIds } = obj;
    if (!isWellFormedCatalogPattern(shape, order, symmetryMode, orbitIds)) return null;
    return { shape, order, symmetryMode, orbitIds };
}

// Semantic validation + reconstruction (the second layer above) - only
// meaningful once the target grid (base or a layer's own, see callers
// below) already reflects pattern.shape/order, since it needs the real
// live nodes/centroid. Mirrors gallery-render.js's
// renderFullTessellationSVG() exactly: orbitIds.map(id =>
// table.orbits[id].pairs[0]) - the SAME reconstruction, reusing the
// SAME live orbit-table glue (computeThemeLineOrbitTable(), core/orbits.js)
// rather than a second, independently-written lookup. Any representative
// pair (pairs[0]) is fine to use as-is - two pairs land in the same
// orbit precisely because the group maps one onto the other, so the
// rendered copy-set is an invariant of the orbit, not of which member
// was chosen (see the design session). gridOverride/shapeOverride are
// computeThemeLineOrbitTable()'s own passthrough params (core/orbits.js) -
// omitted (as applyCatalogPattern() below does) resolves against the
// base sheet's own live globals, byte-identical to before this was
// extracted; applyCatalogPatternToNewLayer() passes a layer's own grid
// instead. Throws on a stale/malformed orbitIds (not realistic for an
// app-generated link, but a hand-edited or future-format-drifted one
// should degrade gracefully) - each caller's own try/catch reports it
// via console.warn, not a new UI element (deliberately - expected to be
// rare enough that dedicated in-page chrome isn't warranted yet).
function resolveCatalogPatternConnections(pattern, gridOverride, shapeOverride) {
    const table = computeThemeLineOrbitTable(pattern.symmetryMode, gridOverride, shapeOverride);
    return pattern.orbitIds.map(id => {
        if (!table.orbits[id]) {
            throw new Error(`orbit id ${id} does not exist for ${pattern.shape} order ${pattern.order} ${pattern.symmetryMode} (table has ${table.orbits.length} orbits)`);
        }
        return table.orbits[id].pairs[0];
    });
}

// Applies a catalog pattern to the BASE sheet - only meaningful once
// rebuildGrid(currentShape) has already run for the resolved
// shape/order. Returns true/false so the caller knows whether to fall
// back to addRandomConnection(); never throws out of setup().
function applyCatalogPattern(pattern) {
    try {
        connections = resolveCatalogPatternConnections(pattern);
        return true;
    } catch (err) {
        console.warn('Failed to load catalog pattern from URL - falling back to the default random connection:', err.message);
        return false;
    }
}

// Roadmap: catalog -> NEW LAYER back-link extension (layer=new URL
// param, see parseCatalogUrlParams()). Targets a freshly-created
// additionalLayers[] entry instead of the base globals -
// addLayer() + updateActiveLayerGrid() are the EXACT same mechanism a
// real "+Layer" click followed by manually changing its Shape/Node
// Count controls would use (design session point 2: indistinguishable
// from a real user action, not a special-cased silent write).
// symmetryMode is written directly to the layer's own field, mirroring
// how applyCatalogPattern() itself relies on the base's own global
// having already been set (setup()'s own catalogUrlPattern handling,
// further up) - this function never touches the base's globals/UI at
// all, so the existing base-only link stays completely unaffected.
// On semantic failure, the just-created layer is removed via the
// existing removeLayer() - a clean, base-only fallback, not a dangling
// empty layer.
function applyCatalogPatternToNewLayer(pattern) {
    addLayer();
    const layerIndex = activeLayer;
    try {
        updateActiveLayerGrid({ shape: pattern.shape, nodeCount: pattern.order });
        const layer = additionalLayers[layerIndex];
        layer.symmetryMode = pattern.symmetryMode;
        layer.connections = resolveCatalogPatternConnections(
            pattern,
            { nodes: layer.nodes, centroid: layer.centroid, outerCorners: layer.outerCorners },
            pattern.shape
        );
        return true;
    } catch (err) {
        console.warn('Failed to load catalog pattern into a new layer from URL - removing the empty layer and falling back to the default random base connection:', err.message);
        removeLayer(layerIndex);
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
            updateTimelineControls(); // rebuildGrid() also clears timeline - see its own comment (core/state.js)
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
            updateTimelineControls();
            redraw();
        });
    }

    // Node count (Number Input)
    const nodeInput = select('#node-count-input');
    if (nodeInput) {
        nodeCount = parseInt(nodeInput.value()) || 3;
        nodeInput.input(() => {
            let v = parseInt(nodeInput.value());
            // Roadmap 1.1 (Group A, node-count limit raise): 5 -> 7 -
            // matches #node-count-input's own max, `isWellFormedCatalogPattern()`'s
            // order bound, and the layer input's own clamp just below -
            // see the verification session's real measurement (hex, the
            // fastest-growing shape: ~41ms at order 6, ~71ms at order 7,
            // ~119ms at order 8 for updatePatternNameStatus()'s uncached
            // orbit-table rebuild) for why 7, not higher, was chosen.
            if (v < 1) v = 1; if (v > 7) v = 7; // Clamp
            nodeCount = v;
            rebuildGrid(currentShape);
            renderLayerTabs();
            updateOffsetControls();
            updateTimelineControls();
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

    // Roadmap 1.12 stage 5 (symmetryMode axis) part 3: the best-effort
    // INVERSE of resolveSymmetryMode() directly above - reused by both
    // the catalog-URL best-effort highlighting below and the per-layer
    // Mode/Fold buttons further down (previously inlined once for the
    // catalog case only; a second call site now needs the identical
    // mapping). Exact for the four rotation-bearing raw modes and for
    // 'none' (this table really is resolveSymmetryMode()'s own inverse
    // there); approximate for 'reflection_only' (Z2), which has no
    // category+fold combination that reaches it going forward - see the
    // design session. currentFold is the caller's own fallback for
    // whichever entries don't have a real fold of their own (none/Z2),
    // so a fold click doesn't lose the user's last real fold choice.
    function bestEffortCategoryFold(mode, currentFold) {
        return {
            none: { category: 'none', fold: currentFold },
            reflection_only: { category: 'spiegeling', fold: currentFold },
            rotation3: { category: 'drehling', fold: 3 },
            rotation6: { category: 'drehling', fold: 6 },
            rotation_reflection3: { category: 'spiegeling', fold: 3 },
            rotation_reflection6: { category: 'spiegeling', fold: 6 },
        }[mode];
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
        const bestEffort = bestEffortCategoryFold(symmetryMode, symmetryFold);
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
                // Roadmap (Group A): fold/strength now come from the
                // live #curve-fold-input/#curve-strength-input controls
                // (declared further below in this same setup() call -
                // safe forward reference, this handler only actually
                // runs on a later click, by which point setup() has
                // already run those declarations once, same pattern
                // updateCurveTypeControls() itself already relies on)
                // instead of a fixed hardcoded pair - so re-activating
                // curve mode resumes at whatever fold/strength the
                // person last set, not always fold=1/strength=25. Their
                // own untouched HTML defaults (1/25) still match the
                // OLD hardcoded pair exactly for a first-ever activation
                // on a fresh page load - byte-identical starting point,
                // just no longer frozen after that.
                curveType = {
                    kind: 'curve',
                    fold: curveFoldInput ? parseInt(curveFoldInput.value()) || 1 : 1,
                    symmetric: true,
                    leaning: 'left',
                    strength: curveStrengthInput ? parseFloat(curveStrengthInput.value()) || 0 : 25,
                };
                curveBtn.addClass('active');
                freeBtn && freeBtn.removeClass('active');
                setActiveShowFaces(false);
                faceBtn && faceBtn.removeClass('active');
            }
            updateCurveTypeControls();
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
                    // Roadmap (Group A): strength now shares the SAME
                    // live #curve-strength-input - curveType.strength was
                    // already read identically for 'curve' and 'free' in
                    // core/curves.js (one field, two kinds) - unified
                    // here into one control to match, rather than a
                    // second, separately-hardcoded 20 that a shared
                    // slider couldn't represent alongside curve's own
                    // 25 anyway. On a fresh page load where 'free' is
                    // activated before 'curve' ever has been, this
                    // starts at the slider's own HTML default (25, not
                    // the old 20) - a small, deliberate, documented
                    // behavior change, not an oversight.
                    strength: curveStrengthInput ? parseFloat(curveStrengthInput.value()) || 0 : 20,
                    leaning: 'left',
                    visible: false
                };
                freeBtn.addClass('active');
                curveBtn && curveBtn.removeClass('active');
                setActiveShowFaces(false);
                faceBtn && faceBtn.removeClass('active');
            }
            updateCurveTypeControls();
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
            updateCurveTypeControls();
            redraw();
        });
    }

    initFaceColorsPanel();

    // Roadmap 1.5-B: kind:'free' controls (roughness/visible/reroll) -
    // a plate-wide curveType setting, not per-layer (see index.html's
    // own comment on these groups), so no layer-switch call site needs
    // to re-sync this the way updateOffsetControls() does for layer-
    // specific state. Shown only while curveType.kind === 'free'.
    // Roadmap (Group A): also owns fold/strength (kind:'curve', and
    // strength also kind:'free' - see index.html's own comment on these
    // two groups) - renamed from updateFreeControls() to
    // updateCurveTypeControls() since it's no longer 'free'-only; every
    // one of its 4 call sites (curveBtn/freeBtn/faceBtn handlers, plus
    // setup()'s own initial call below) already runs at exactly the
    // moments curveType.kind can change, so no new call site is needed.
    // curveFoldGroup/curveFoldInput/curveStrengthGroup/curveStrengthInput
    // are named with a `curve` prefix specifically to avoid colliding
    // with the UNRELATED #mode-fold-group/#layer-fold-group ("3-fold"/
    // "6-fold" HEX SYMMETRY buttons, an entirely different "fold"
    // concept - see updateSymmetryModeControl()'s own foldGroup local
    // and the layer panel's own top-level foldGroup const further below
    // in this file) - caught as a real `const` redeclaration error
    // before this shipped, not a hypothetical concern.
    const roughnessGroup = select('#free-roughness-group');
    const roughnessInput = select('#free-roughness-input');
    const roughnessValueEl = select('#free-roughness-value');
    const freeControlsGroup = select('#free-controls-group');
    const freeVisibleBtn = select('#btn-toggle-free-visible');
    const rerollBtn = select('#btn-free-reroll-seed');
    const curveFoldGroup = select('#curve-fold-group');
    const curveFoldInput = select('#curve-fold-input');
    const curveFoldValueEl = select('#curve-fold-value');
    const curveStrengthGroup = select('#curve-strength-group');
    const curveStrengthInput = select('#curve-strength-input');
    const curveStrengthValueEl = select('#curve-strength-value');

    function updateCurveTypeControls() {
        const isFree = curveType.kind === 'free';
        const isCurve = curveType.kind === 'curve';
        if (roughnessGroup) roughnessGroup.elt.hidden = !isFree;
        if (freeControlsGroup) freeControlsGroup.elt.hidden = !isFree;
        if (isFree && roughnessInput) {
            roughnessInput.value(curveType.roughness);
            if (roughnessValueEl) roughnessValueEl.html(curveType.roughness);
        }
        // fold: kind:'curve' only - core/curves.js never reads it for 'free'.
        if (curveFoldGroup) curveFoldGroup.elt.hidden = !isCurve;
        if (isCurve && curveFoldInput) {
            curveFoldInput.value(curveType.fold);
            if (curveFoldValueEl) curveFoldValueEl.html(curveType.fold);
        }
        // strength: kind:'curve' OR kind:'free' - core/curves.js reads
        // curveType.strength identically for both (see buildCurvePieces()'s
        // shared `mag` computation, before the kind-specific branches).
        const hasStrength = isCurve || isFree;
        if (curveStrengthGroup) curveStrengthGroup.elt.hidden = !hasStrength;
        if (hasStrength && curveStrengthInput) {
            curveStrengthInput.value(curveType.strength);
            if (curveStrengthValueEl) curveStrengthValueEl.html(curveType.strength);
        }
    }

    if (roughnessInput) {
        roughnessInput.input(() => {
            if (curveType.kind !== 'free') return;
            let v = parseFloat(roughnessInput.value());
            if (isNaN(v) || v < 0) v = 0;
            if (v > 5) v = 5;
            curveType.roughness = v;
            if (roughnessValueEl) roughnessValueEl.html(v);
            redraw();
        });
    }

    // Roadmap (Group A): fold - kind:'curve' only. A stepped integer
    // control (index.html's own step="1"); buildCurvePieces() throws if
    // fold isn't a positive integer, so the clamp/rounding here is
    // defensive (the HTML range's own step/min/max already constrain a
    // normal drag), not load-bearing for a plain slider interaction.
    if (curveFoldInput) {
        curveFoldInput.input(() => {
            if (curveType.kind !== 'curve') return;
            let v = Math.round(parseFloat(curveFoldInput.value()));
            if (isNaN(v) || v < 1) v = 1;
            if (v > 12) v = 12;
            curveType.fold = v;
            if (curveFoldValueEl) curveFoldValueEl.html(v);
            redraw();
        });
    }

    // Roadmap (Group A): strength - kind:'curve' OR kind:'free' (one
    // shared curveType field, one shared control - see
    // updateCurveTypeControls()'s own comment). min=0 deliberately, not
    // symmetric around 0: a negative value would trip
    // buildCurvePieces()'s own `mag < 0.0001` degenerate check for ANY
    // negative magnitude, silently rendering a plain straight line
    // rather than a mirrored bulge - bulge DIRECTION is curveType.leaning's
    // job (see core/curves.js's mirrorCurveType()), not strength's sign,
    // so this control correctly has no negative range to offer.
    if (curveStrengthInput) {
        curveStrengthInput.input(() => {
            if (curveType.kind !== 'curve' && curveType.kind !== 'free') return;
            let v = parseFloat(curveStrengthInput.value());
            if (isNaN(v) || v < 0) v = 0;
            if (v > 200) v = 200;
            curveType.strength = v;
            if (curveStrengthValueEl) curveStrengthValueEl.html(v);
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
    // Roadmap: catalog -> clipboard "Paste Pattern" action - same role
    // as addLayerBtn above (adds a layer), different source (a
    // gallery.html "Copy pattern" click, via the clipboard, instead of
    // a fresh "+Layer" + manual editing). See applyCatalogPatternToNewLayer()'s
    // own comment for why this reuses it unmodified.
    const pastePatternBtn = select('#btn-paste-pattern');
    const pastePatternStatus = select('#paste-pattern-status');
    // Roadmap 1.8 Stage C: timeline controls - NOT contextual to
    // whichever tab is active (unlike layer-animation-group below),
    // since a timeline spans multiple layers rather than belonging to
    // one - always visible, with individual pieces shown/hidden by
    // updateTimelineControls() based on whether `timeline` exists and
    // how many keyframes it currently has (phase (ii)).
    const addToTimelineBtn = select('#btn-add-to-timeline');
    const removeTimelineBtn = select('#btn-remove-timeline');
    const timelineKeyframeList = select('#timeline-keyframe-list');
    const timelinePlaybackControls = select('#timeline-playback-controls');
    const timelinePlayBtn = select('#btn-timeline-play');
    const timelineProgressInput = select('#timeline-progress-input');
    const timelineStatusEl = select('#timeline-status');
    // Roadmap 1.8 Stage D phase (i): manual line-pairing editor.
    const timelinePairingPanel = select('#timeline-pairing');
    const timelinePairingSegmentSelect = select('#timeline-pairing-segment');
    const timelinePairingList = select('#timeline-pairing-list');
    const timelinePairingMetric = select('#timeline-pairing-metric');
    const timelinePairingResetBtn = select('#btn-timeline-pairing-reset');
    let timelinePairingSegment = 0;
    // Roadmap 1.8 Stage D phase (ii): "Browse all" list state.
    const timelinePairingBrowseBtn = select('#btn-timeline-pairing-browse');
    const timelinePairingBrowser = select('#timeline-pairing-browser');
    const timelinePairingSortSelect = select('#timeline-pairing-sort');
    const timelinePairingFilterInput = select('#timeline-pairing-filter');
    const timelinePairingBrowserCount = select('#timeline-pairing-browser-count');
    const timelinePairingBrowserList = select('#timeline-pairing-browser-list');
    let timelinePairingBrowseOpen = false;
    let timelinePairingBrowseJustOpened = false; // scroll the current row into view only when the list was just opened
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
    // Roadmap 1.12 stage 5 (symmetryMode axis) part 3: this layer's own
    // symmetryMode - same contextual show/hide + active-state-sync
    // handling as shapeGroup/layerShapeBtns directly above (dedicated
    // .layer-mode-btn/.layer-fold-btn buttons, not the base's own
    // #btn-mode-*/#btn-fold-* set, for the identical "one shared button
    // group can't show two different active states" reason). foldGroup's
    // visibility gets a SECOND, more specific refinement inside
    // updateOffsetControls() below (keyed to THIS layer's own shape,
    // not currentShape) - the line here only handles the base showOffsets
    // toggle, same two-tier pattern the base's own mode-fold-group has
    // (always hex-gated) layered on top of "only when a layer tab is
    // active" (layers only).
    const modeGroup = select('#layer-mode-group');
    const foldGroup = select('#layer-fold-group');
    const layerModeBtns = selectAll('.layer-mode-btn');
    const layerFoldBtns = selectAll('.layer-fold-btn');
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
    // Roadmap 1.8 Stage A: this layer's own animation controls - same
    // contextual show/hide as the fields above. Populate-on-switch is
    // split into its own syncLayerAnimationDisplay() function (below,
    // also exposed on window like updateOffsetControls/renderLayerTabs
    // are - see their own comment) rather than inlined here, since
    // draw() also needs to call it every frame during active playback
    // to keep the progress slider/play-icon live, not just on a tab
    // switch or explicit control interaction.
    const animationGroup = select('#layer-animation-group');
    const setAnimStartBtn = select('#btn-layer-anim-set-start');
    const setAnimEndBtn = select('#btn-layer-anim-set-end');
    const animDurationInput = select('#layer-anim-duration-input');
    const animPlayBtn = select('#btn-layer-anim-play');
    const animProgressInput = select('#layer-anim-progress-input');
    // Roadmap 1.8 Stage B (connections morph): status line for a
    // refused Set Start/End line-count mismatch - same plain-<span>
    // convention as #align-to-base-status. Exposed on window (mirroring
    // updateOffsetControls/syncLayerAnimationDisplay just below) since
    // setActiveLayerAnimationStart()/End() are top-level functions, not
    // declared inside this setup() closure.
    const animConnectionsStatus = select('#layer-anim-connections-status');
    // Roadmap 1.8 Stage B: which layer the CURRENTLY shown message
    // belongs to - Set Start/End's own click handlers call
    // updateOffsetControls() right after setActiveLayerAnimationStart()/
    // End() (a pre-existing "refresh the whole panel" pattern, unrelated
    // to this feature), so updateOffsetControls()'s own populate-on-
    // switch block can't unconditionally clear this status the way
    // alignStatus does (alignBtn's own handler never calls
    // updateOffsetControls() itself, so it never hits this) - doing so
    // would immediately wipe out the very message Set Start/End just
    // set, before the person ever sees it (caught via a real Set-Start
    // mismatch click in this stage's browser test). Tracked here instead
    // so updateOffsetControls() only clears it on an ACTUAL tab switch
    // (activeLayer different from whichever layer last wrote a message),
    // never on a same-layer refresh.
    let layerAnimConnectionsStatusOwner = null;
    function setLayerAnimConnectionsStatus(msg) {
        if (animConnectionsStatus) animConnectionsStatus.html(msg || '');
        layerAnimConnectionsStatusOwner = msg ? activeLayer : null;
    }
    window.setLayerAnimConnectionsStatus = setLayerAnimConnectionsStatus;

    function updateOffsetControls() {
        const showOffsets = activeLayer !== 'base';
        if (offsetXGroup) offsetXGroup.elt.hidden = !showOffsets;
        if (offsetYGroup) offsetYGroup.elt.hidden = !showOffsets;
        if (meshPresetGroup) meshPresetGroup.elt.hidden = !showOffsets;
        if (shapeGroup) shapeGroup.elt.hidden = !showOffsets;
        if (modeGroup) modeGroup.elt.hidden = !showOffsets;
        if (foldGroup) foldGroup.elt.hidden = !showOffsets; // refined below to this layer's own shape once showOffsets is true
        if (alignGroup) alignGroup.elt.hidden = !showOffsets;
        if (nodeCountGroup) nodeCountGroup.elt.hidden = !showOffsets;
        if (shapeSizeGroup) shapeSizeGroup.elt.hidden = !showOffsets;
        if (rotationGroup) rotationGroup.elt.hidden = !showOffsets;
        if (animationGroup) animationGroup.elt.hidden = !showOffsets;
        if (showOffsets) {
            const layer = additionalLayers[activeLayer];
            if (offsetXInput) offsetXInput.value(layer.offsetX);
            if (offsetYInput) offsetYInput.value(layer.offsetY);
            if (layerNodeCountInput) layerNodeCountInput.value(layer.nodeCount);
            if (layerShapeSizeInput) layerShapeSizeInput.value(layer.shapeSizeFactor);
            if (layerRotationInput) layerRotationInput.value(layer.rotation || 0);
            syncLayerAnimationDisplay(layer);
            // Roadmap 1.12 stage 4 (UI): active-state sync for the
            // layer-shape button group, mirroring how the base's own
            // .shape-icon-btn set tracks currentShape - this is the
            // "populate on switch" step for a button group instead of a
            // value input.
            layerShapeBtns.forEach(b => {
                if (b.attribute('data-shape') === layer.shape) b.addClass('active');
                else b.removeClass('active');
            });
            // Roadmap 1.12 stage 5 (symmetryMode axis) part 3: fold row
            // visibility keyed to THIS layer's own shape (not
            // currentShape) - mirrors layer-shape-group's own layer-
            // scoped logic exactly, just for a further-nested control.
            // Active-state sync for both button groups derives its
            // category/fold from layer.symmetryMode via
            // bestEffortCategoryFold() (defined above) - the single
            // source of truth stays the raw symmetryMode string, not a
            // separately-tracked per-layer category/fold pair, so this
            // is always consistent with whatever the last write (click,
            // or a future non-UI code path) actually set.
            if (foldGroup) foldGroup.elt.hidden = layer.shape !== 'hex';
            const layerBestEffort = bestEffortCategoryFold(layer.symmetryMode, 6) || {};
            layerModeBtns.forEach(b => {
                if (b.attribute('data-mode') === layerBestEffort.category) b.addClass('active');
                else b.removeClass('active');
            });
            layerFoldBtns.forEach(b => {
                if (parseInt(b.attribute('data-fold')) === layerBestEffort.fold) b.addClass('active');
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
            // Roadmap 1.8 Stage B: a mismatch message belongs to whichever
            // layer produced it - clear it only on an ACTUAL tab switch
            // (see layerAnimConnectionsStatusOwner's own comment above for
            // why this can't be an unconditional clear the way alignStatus'
            // own reset above is).
            if (layerAnimConnectionsStatusOwner !== null && layerAnimConnectionsStatusOwner !== activeLayer) {
                setLayerAnimConnectionsStatus('');
            }
        }
    }

    // Roadmap 1.8 Stage A: populates the animation controls (duration/
    // progress/play-icon) for the given layer - split out of
    // updateOffsetControls() itself (unlike the other populate-on-switch
    // steps above) because draw() also needs to call it every frame
    // during active playback, not only on a tab switch or explicit
    // control interaction, to keep the progress slider/play-icon live.
    // Renders a sensible default (duration 2000, progress 0, Play icon)
    // when this layer has no animation object yet (Set Start/End not
    // clicked) - those controls stay fully usable in that state, they
    // just haven't captured a start/end pair to interpolate between.
    function syncLayerAnimationDisplay(layer) {
        const anim = layer.animation;
        if (animDurationInput) animDurationInput.value(anim ? anim.durationMs : 2000);
        const progress = anim && anim.durationMs > 0
            ? (anim.playing ? Math.max(0, Math.min(anim.durationMs, millis() - anim.startTime)) : anim.elapsedMs) / anim.durationMs
            : 0;
        if (animProgressInput) animProgressInput.value(progress);
        if (animPlayBtn) {
            const playing = !!(anim && anim.playing);
            animPlayBtn.attribute('title', playing ? 'Pause' : 'Play');
            animPlayBtn.html(playing
                ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>'
                : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 5 L19 12 L7 19 Z" /></svg>');
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
    // over the setup()-local DOM references intact. Roadmap 1.8 Stage A:
    // syncLayerAnimationDisplay() needs the identical treatment - draw()
    // (a top-level function) calls it every frame during playback.
    window.updateOffsetControls = updateOffsetControls;
    window.syncLayerAnimationDisplay = syncLayerAnimationDisplay;

    function renderLayerTabs() {
        if (layerBaseBtn) {
            if (activeLayer === 'base') layerBaseBtn.addClass('active');
            else layerBaseBtn.removeClass('active');
        }
        if (!layerTabsContainer) return;
        const container = layerTabsContainer.elt;
        container.innerHTML = '';

        additionalLayers.forEach((layer, i) => {
            // Roadmap 1.8 Stage C: the auto-created timeline playback
            // layer is an ordinary additionalLayers[] entry (so every
            // existing rendering/enabled-flag mechanism already works
            // for it unmodified - see addLayerToTimeline()'s own
            // comment) but isn't meant to be hand-edited like a real
            // pattern layer, so it gets no tab here. Its true array index
            // (i) is unaffected - only its OWN tab's rendering is skipped,
            // every other layer's tab/click-handler still closes over its
            // own correct, real index exactly as before.
            if (layer.isTimelinePlayback) return;
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
                // Roadmap 1.8 Stage C phase (ii): "Add to Timeline"'s own
                // eligibility (canAddLayerToTimeline()) depends on
                // activeLayer - switching tabs can change whether the
                // NOW-active layer is addable, so its disabled/tooltip
                // state needs a refresh here too, not just after add/
                // remove-layer actions.
                updateTimelineControls();
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

    // Roadmap 1.8 Stage C: status line for a refused "Add to Timeline"
    // (shape/order/symmetryMode or line-count mismatch), a live
    // mismatch discovered during playback, or (phase (ii)) a plain
    // "which segment am I looking at" readout - same plain-<span>
    // convention as #layer-anim-connections-status. Exposed on window
    // since addLayerToTimeline()/applyTimelineFrame()/removeLayer() are
    // top-level functions.
    function setTimelineStatus(msg) {
        if (timelineStatusEl) timelineStatusEl.html(msg || '');
    }
    window.setTimelineStatus = setTimelineStatus;

    // Roadmap 1.8 Stage C: populates the Play/Pause icon and progress
    // slider from the timeline's own current state - split out of
    // updateTimelineControls() (unlike the align-button pattern this
    // otherwise mirrors) because draw() also needs to call it every
    // frame during active playback, the same reason Stage A's
    // syncLayerAnimationDisplay() is its own function. Phase (ii): reads
    // totalTimelineDurationMs(timeline) (the SUM of every segment's own
    // fixed duration) instead of a single timeline.durationMs field -
    // the scrub slider's 0..1 range always spans the whole sequence.
    function syncTimelineDisplay() {
        if (!timeline) return;
        const totalDuration = totalTimelineDurationMs(timeline);
        if (timelineProgressInput) {
            const progress = totalDuration > 0
                ? (timeline.playing ? Math.max(0, Math.min(totalDuration, millis() - timeline.startTime)) : timeline.elapsedMs) / totalDuration
                : 0;
            timelineProgressInput.value(progress);
        }
        if (timelinePlayBtn) {
            const playing = timeline.playing;
            timelinePlayBtn.attribute('title', playing ? 'Pause' : 'Play');
            timelinePlayBtn.html(playing
                ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>'
                : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 5 L19 12 L7 19 Z" /></svg>');
        }
    }
    window.syncTimelineDisplay = syncTimelineDisplay;

    // Roadmap 1.8 Stage C phase (ii): the simple ordered keyframe list
    // (design session point 5) - "1. Layer 2", "2. Layer 5", ... in
    // sequence order, each with its own small remove button
    // (removeKeyframeFromTimeline() - takes the keyframe OUT of the
    // sequence, restoring that layer's own visibility, WITHOUT deleting
    // the layer itself, unlike its tab's own "x"). Reuses the exact
    // .layer-tab/.layer-remove-btn chrome renderLayerTabs() already
    // established, so this reads as part of the same visual language,
    // not a new widget. No drag-reorder in this phase (design session
    // point 5) - order is authored by the sequence "Add to Timeline" was
    // clicked in; reorder today by removing and re-adding in the wanted
    // order. Rebuilt fresh on every call (container.innerHTML = ''),
    // same "no stale entries" discipline renderLayerTabs() itself uses.
    function renderTimelineKeyframeList() {
        if (!timelineKeyframeList) return;
        const container = timelineKeyframeList.elt;
        container.innerHTML = '';
        if (!timeline) return;
        timeline.keyframeLayerIds.forEach((layerIndex, pos) => {
            const tab = document.createElement('span');
            tab.className = 'layer-tab';

            const label = document.createElement('span');
            label.textContent = `${pos + 1}. Layer ${layerIndex + 1}`;
            label.style.fontSize = '13px';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'layer-remove-btn';
            removeBtn.textContent = '×';
            removeBtn.title = `Remove Layer ${layerIndex + 1} from the timeline (keeps the layer itself)`;
            removeBtn.addEventListener('click', () => {
                removeKeyframeFromTimeline(layerIndex);
            });

            tab.appendChild(label);
            tab.appendChild(removeBtn);
            container.appendChild(tab);
        });
    }
    window.renderTimelineKeyframeList = renderTimelineKeyframeList;

    // Roadmap 1.8 Stage D phase (i): the manual line-pairing editor -
    // for the selected segment, lists every Start line with the End line
    // currently assigned to it (row order = the pairing), with up/down
    // buttons that swap a row's End assignment with its neighbour's
    // (moveTimelinePairing()), plus the sum-of-squared-endpoint-
    // displacement readout for the current vs. default pairing. Rebuilt
    // fresh on every call, same "no stale rows" discipline as
    // renderTimelineKeyframeList(). A stored pairing that has gone stale
    // (line count changed since - see isValidPairing()) is discarded here.
    function renderTimelinePairingEditor() {
        if (!timelinePairingPanel) return;
        const segCount = timeline ? timeline.segmentDurationsMs.length : 0;
        timelinePairingPanel.elt.hidden = segCount === 0;
        if (segCount === 0) return;
        timelinePairingSegment = Math.max(0, Math.min(segCount - 1, timelinePairingSegment));
        const seg = timelinePairingSegment;

        const sel = timelinePairingSegmentSelect.elt;
        sel.innerHTML = '';
        for (let i = 0; i < segCount; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = `Segment ${i + 1}: Layer ${timeline.keyframeLayerIds[i] + 1} \u2192 Layer ${timeline.keyframeLayerIds[i + 1] + 1}`;
            sel.appendChild(opt);
        }
        sel.value = String(seg);

        const list = timelinePairingList.elt;
        list.innerHTML = '';
        const info = timelineSegmentInfo(seg);
        if (!info || !info.ok) {
            timelinePairingMetric.html(info ? info.reason : '');
            timelinePairingResetBtn.elt.hidden = true;
            renderTimelinePairingBrowser(null, seg);
            return;
        }
        if (timeline.segmentPairings[seg] && info.permIsDefault) timeline.segmentPairings[seg] = null;
        if (timeline.segmentFlips && timeline.segmentFlips[seg] && !info.flipsAny) timeline.segmentFlips[seg] = null;
        if (timeline.segmentMembers && timeline.segmentMembers[seg] && !info.membersAny) timeline.segmentMembers[seg] = null;
        info.perm.forEach((endIdx, row) => {
            const r = document.createElement('div');
            r.className = 'pairing-row';
            const label = document.createElement('span');
            label.className = 'pairing-label';
            // Stage D phase (iii): a flipped End line is shown with its
            // node pair reversed (the order it is actually read in).
            const endLabel = info.toLabels[endIdx] || '?';
            const flipped = info.flips[endIdx];
            label.textContent = `Start ${row + 1} (${info.fromLabels[row] || '?'}) \u2192 End ${endIdx + 1} (${flipped ? endLabel.split('\u2013').reverse().join('\u2013') : endLabel})${flipped ? ' \u21C4' : ''}`;
            const up = document.createElement('button');
            up.className = 'layer-btn pairing-move-btn';
            up.textContent = '\u25B2';
            up.title = 'Swap this End assignment with the row above';
            up.disabled = row === 0;
            up.addEventListener('click', () => moveTimelinePairing(seg, row, -1));
            const down = document.createElement('button');
            down.className = 'layer-btn pairing-move-btn';
            down.textContent = '\u25BC';
            down.title = 'Swap this End assignment with the row below';
            down.disabled = row === info.n - 1;
            down.addEventListener('click', () => moveTimelinePairing(seg, row, 1));
            // Stage D phase (iii): per-row orientation toggle - reverses
            // THIS row's assigned End line (indexed by End line, so it
            // stays with that line when rows are reordered).
            const flip = document.createElement('button');
            flip.className = 'layer-btn pairing-move-btn pairing-flip-btn' + (flipped ? ' active' : '');
            flip.textContent = '\u21C4';
            flip.title = flipped ? 'This End line is reversed - click to restore its stored direction' : 'Reverse this End line (swap which End endpoint each Start endpoint moves to)';
            flip.addEventListener('click', () => setTimelineFlip(seg, endIdx));
            // Stage D phase (iv) step 2: per-row variant stepper "k/c" over
            // this row's deduplicated (group element, flip) variants
            // (timelineRowVariants()). Both numbers are recomputed here on
            // every render from the row's CURRENT Start<->End pairing -
            // nothing is cached across reorders, so after Up/Down the count
            // is the new pairing's (e.g. 12 for an orbit-0 line paired with
            // an orbit-0 line, 6 for orbit 0 with orbit 2, 4 for orbit 2
            // with orbit 2). k is the position of the CURRENT state's
            // rendered picture in that list (matched by picture key, not by
            // the stored element index), so a stored choice that is not the
            // canonical representative of the new pairing's list - or a
            // duplicate of a listed variant - still shows where it actually
            // sits. A step commits element and flip together via
            // setTimelineMember(), the same setter everything else uses.
            const rv = timelineRowVariants(seg, row);
            const variants = rv ? rv.variants : [];
            const vCount = variants.length;
            let vIdx = vCount === 0 ? -1 : (rv.currentKey !== null
                ? variants.findIndex(v => v.key === rv.currentKey)
                : variants.findIndex(v => v.g === info.members[endIdx] && v.f === !!info.flips[endIdx]));
            if (vCount > 0 && vIdx < 0) vIdx = 0;
            r.appendChild(label);
            r.appendChild(up);
            r.appendChild(down);
            r.appendChild(flip);
            if (vCount > 1) {
                const stepper = document.createElement('span');
                stepper.className = 'pairing-variant';
                const prevBtn = document.createElement('button');
                prevBtn.className = 'layer-btn pairing-move-btn pairing-variant-prev';
                prevBtn.textContent = '\u25C0';
                prevBtn.title = 'Previous variant of this End line (distinct pictures against this row\'s Start line)';
                prevBtn.addEventListener('click', () => {
                    const v = variants[(vIdx - 1 + vCount) % vCount];
                    setTimelineMember(seg, endIdx, v.g, v.f);
                });
                const countEl = document.createElement('span');
                countEl.className = 'pairing-variant-count';
                countEl.textContent = `${vIdx + 1}/${vCount}`;
                countEl.dataset.k = String(vIdx + 1);
                countEl.dataset.c = String(vCount);
                countEl.title = `End line variant ${vIdx + 1} of ${vCount} distinct pictures for this row's current Start\u2194End pairing`;
                const nextBtn = document.createElement('button');
                nextBtn.className = 'layer-btn pairing-move-btn pairing-variant-next';
                nextBtn.textContent = '\u25B6';
                nextBtn.title = 'Next variant of this End line (distinct pictures against this row\'s Start line)';
                nextBtn.addEventListener('click', () => {
                    const v = variants[(vIdx + 1) % vCount];
                    setTimelineMember(seg, endIdx, v.g, v.f);
                });
                stepper.appendChild(prevBtn);
                stepper.appendChild(countEl);
                stepper.appendChild(nextBtn);
                r.appendChild(stepper);
            }
            list.appendChild(r);
        });
        const fmt = v => Math.round(v).toLocaleString('en-US');
        timelinePairingMetric.html(info.isDefault
            ? `Displacement \u03A3d\u00B2: ${fmt(info.displacement)} px\u00B2 (default)`
            : `Displacement \u03A3d\u00B2: ${fmt(info.displacement)} px\u00B2 (default: ${fmt(info.defaultDisplacement)})`);
        timelinePairingResetBtn.elt.hidden = info.isDefault;
        renderTimelinePairingBrowser(info, seg);
    }
    window.renderTimelinePairingEditor = renderTimelinePairingEditor;

    // Roadmap 1.8 Stage D phase (ii): the numeric "Browse all" list - one
    // row per pairing (order = the End line assigned to Start 1..n, then
    // its sum-of-squared-displacement), sorted by that value (ties broken
    // by the permutation itself, so the order is deterministic) and
    // optionally cut off at a max value. The row equal to the segment's
    // CURRENT pairing is marked. Clicking a row commits it via
    // setTimelinePairing() - the same call the up/down buttons end in.
    // Hidden entirely unless the segment resolves and 1 <= n <=
    // PAIRING_BROWSE_MAX_N (timelinePairingCandidates() returns null
    // otherwise; at n=1 the rows are the two orientations, not pairings). Rebuilt fresh like the rest of the panel; the list's
    // scroll position is preserved across rebuilds so stepping with
    // up/down doesn't jump the list back to the top.
    function renderTimelinePairingBrowser(info, seg) {
        const cand = info ? timelinePairingCandidates(seg) : null;
        if (timelinePairingBrowseBtn) timelinePairingBrowseBtn.elt.hidden = !cand;
        const open = !!cand && timelinePairingBrowseOpen;
        if (timelinePairingBrowseBtn) timelinePairingBrowseBtn.html(open ? 'Hide list' : 'Browse all');
        if (timelinePairingBrowser) timelinePairingBrowser.elt.hidden = !open;
        if (!open) {
            timelinePairingBrowserList.elt.innerHTML = ''; // no stale rows behind a hidden list (n left the browse range, or the list was closed)
            return;
        }

        const dir = timelinePairingSortSelect.elt.value === 'desc' ? -1 : 1;
        const maxRaw = parseFloat(timelinePairingFilterInput.elt.value);
        const hasMax = Number.isFinite(maxRaw);
        const cmpPerm = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
        const rows = cand.items
            .filter(it => !hasMax || Math.round(it.displacement) <= maxRaw)
            .sort((a, b) => (a.displacement - b.displacement) * dir || cmpPerm(a.perm, b.perm));

        timelinePairingBrowserCount.html(cand.orientation
            ? `Showing ${rows.length} of ${cand.items.length} variants (Start 1 \u2192 End 1, distinct pictures only)`
            : `Showing ${rows.length} of ${cand.items.length} pairings (Start 1..${cand.n} \u2192 End ...)`);
        const list = timelinePairingBrowserList.elt;
        const prevScroll = list.scrollTop;
        list.innerHTML = '';
        const fmt = v => Math.round(v).toLocaleString('en-US');
        let currentRow = null;
        rows.forEach(it => {
            const btn = document.createElement('button');
            // n=1 (Stage D phase iv): "current" = the variant sharing the
            // current state's rendered-picture key - the current state may
            // itself be a duplicate of a listed variant, not listed on its own.
            const isCurrent = cand.orientation
                ? it.key === cand.currentKey
                : it.perm.every((j, i) => j === info.perm[i]);
            btn.className = 'pairing-browse-row' + (isCurrent ? ' current' : '');
            btn.dataset.perm = it.perm.join('');
            if (cand.orientation) { btn.dataset.flip = it.flips[0] ? '1' : '0'; btn.dataset.member = String(it.members[0]); }
            // Stage D phase (iii)/(iv), n=1: the candidates are the End line's
            // distinct (group element, flip) variants (see
            // timelinePairingCandidates()) - shown as the node pair actually
            // read (start\u2192end), with a marker for a reversal / a non-identity
            // element, so as-clicked and reversed read as before.
            const variantText = cand.orientation
                ? `${it.ids[0]}\u2013${it.ids[1]}${it.flips[0] ? ' \u21C4' : ''}${it.members[0] === 0 && !it.flips[0] ? ' (as clicked)' : ''}`
                : '';
            btn.title = cand.orientation
                ? `Start 1 \u2192 End 1 as ${it.ids[0]}\u2013${it.ids[1]} (group element ${it.members[0]}${it.flips[0] ? ', reversed' : ''})`
                : it.perm.map((j, i) => `Start ${i + 1} \u2192 End ${j + 1}`).join(', ');
            const order = document.createElement('span');
            order.textContent = cand.orientation ? variantText : it.perm.map(j => j + 1).join(' ');
            const d = document.createElement('span');
            d.textContent = `${fmt(it.displacement)} px\u00B2`;
            btn.appendChild(order);
            btn.appendChild(d);
            btn.addEventListener('click', () => cand.orientation
                ? commitTimelineSegmentPairing(seg, it.perm, it.flips, it.members)
                : setTimelinePairing(seg, it.perm));
            list.appendChild(btn);
            if (isCurrent) currentRow = btn;
        });
        list.scrollTop = prevScroll;
        if (timelinePairingBrowseJustOpened && currentRow) currentRow.scrollIntoView({ block: 'nearest' });
        timelinePairingBrowseJustOpened = false;
    }

    if (timelinePairingBrowseBtn) {
        timelinePairingBrowseBtn.elt.addEventListener('click', () => {
            timelinePairingBrowseOpen = !timelinePairingBrowseOpen;
            timelinePairingBrowseJustOpened = timelinePairingBrowseOpen;
            renderTimelinePairingEditor();
        });
    }
    if (timelinePairingSortSelect) timelinePairingSortSelect.elt.addEventListener('change', () => renderTimelinePairingEditor());
    if (timelinePairingFilterInput) timelinePairingFilterInput.elt.addEventListener('input', () => renderTimelinePairingEditor());

    if (timelinePairingSegmentSelect) {
        timelinePairingSegmentSelect.elt.addEventListener('change', () => {
            timelinePairingSegment = parseInt(timelinePairingSegmentSelect.elt.value, 10) || 0;
            previewTimelineSegmentMidpoint(timelinePairingSegment);
            updateTimelineControls();
            redraw();
        });
    }
    if (timelinePairingResetBtn) {
        timelinePairingResetBtn.elt.addEventListener('click', () => resetTimelinePairing(timelinePairingSegment));
    }

    // Roadmap 1.8 Stage C phase (ii): shows/hides the timeline controls
    // based on THREE states, not phase (i)'s original binary create-vs-
    // remove toggle: no timeline yet (only "Add to Timeline" matters,
    // enabled/disabled + tooltipped via canAddLayerToTimeline()'s own
    // coarse check - same pattern "Align to base" uses); a timeline with
    // exactly one keyframe (started, not yet playable - the list and
    // "Remove Timeline" already make sense, but there is no segment yet
    // to play/scrub); and a timeline with two or more keyframes (fully
    // playable). "Add to Timeline" itself stays visible and just
    // disables/re-enables in ALL three states, rather than hiding like
    // phase (i)'s single create button did - its role (start vs. extend)
    // changes, but the affordance itself doesn't need to disappear.
    // Called after every add/remove-layer action and every base-level
    // shape/order rebuild (all of which can change eligibility or the
    // timeline's own shape) - see each of those call sites.
    function updateTimelineControls() {
        const hasTimeline = !!timeline;
        const playable = hasTimeline && timeline.keyframeLayerIds.length >= 2;
        if (addToTimelineBtn) {
            const can = canAddLayerToTimeline();
            addToTimelineBtn.elt.disabled = !can;
            addToTimelineBtn.attribute('title', can ? 'Add to Timeline' : 'Select a real layer (not Base) not already in the timeline to add it as the next keyframe.');
        }
        if (removeTimelineBtn) removeTimelineBtn.elt.hidden = !hasTimeline;
        if (timelineKeyframeList) timelineKeyframeList.elt.hidden = !hasTimeline;
        if (timelinePlaybackControls) timelinePlaybackControls.elt.hidden = !playable;
        if (timelineProgressInput) timelineProgressInput.elt.hidden = !playable;
        renderTimelineKeyframeList();
        renderTimelinePairingEditor();
        if (playable) syncTimelineDisplay();
    }
    window.updateTimelineControls = updateTimelineControls;

    if (addToTimelineBtn) {
        addToTimelineBtn.mousePressed(() => {
            addLayerToTimeline();
        });
    }
    if (removeTimelineBtn) {
        removeTimelineBtn.mousePressed(() => {
            removeTimelineAction();
        });
    }
    if (timelinePlayBtn) {
        timelinePlayBtn.mousePressed(() => {
            toggleTimelinePlayback();
            syncTimelineDisplay();
            redraw();
        });
    }
    if (timelineProgressInput) {
        timelineProgressInput.input(() => {
            setTimelineProgress(parseFloat(timelineProgressInput.value()));
            syncTimelineDisplay();
            redraw();
        });
    }

    if (layerBaseBtn) {
        layerBaseBtn.mousePressed(() => {
            activeLayer = 'base';
            renderLayerTabs();
            updateOffsetControls();
            updateFaceToggleControl();
            updateTimelineControls(); // Roadmap 1.8 Stage C phase (ii): see the per-layer tab handler's own comment above - "Add to Timeline" is always disabled for Base, but its tooltip/state still needs refreshing on the way there
            redraw(); // Roadmap 1.11-B: see the per-layer tab handler's own comment above
        });
    }

    if (addLayerBtn) {
        addLayerBtn.mousePressed(() => {
            addLayer();
            renderLayerTabs();
            updateOffsetControls();
            updateFaceToggleControl();
            // Roadmap 1.8 Stage C: addLayer() changes activeLayer to the
            // new layer, which changes canAddLayerToTimeline()'s own
            // result ("Add to Timeline" now targets THIS new layer).
            updateTimelineControls();
            redraw();
        });
    }

    // Roadmap: catalog -> clipboard "Paste Pattern" action. Mirrors
    // setup()'s own catalogUrlPattern.layer==='new' tail handling
    // exactly - applyCatalogPatternToNewLayer() reused completely
    // unmodified (including its own removeLayer() rollback on semantic
    // failure), then the SAME UI-sync sequence that tail already runs.
    // navigator.clipboard.readText() is a real, uneven cross-browser
    // permission surface (unlike writeText(), used on the gallery side)
    // - guarded for outright unavailability (insecure context, very old
    // browser) before ever calling it, and its rejection (permission
    // denied, or blocked entirely) is reported via #paste-pattern-status,
    // never a silent no-op - this needed real, isolated browser
    // verification, not just code review (see this feature's own
    // implementation report).
    if (pastePatternBtn) {
        pastePatternBtn.mousePressed(async () => {
            // Bug fix (found via real state reproduction, not assumed):
            // navigator.clipboard.readText() can take a real, uneven
            // amount of time - a first-time permission prompt in
            // particular. Without disabling the button for that whole
            // window, an impatient double-click (very plausible exactly
            // during a permission prompt) fired this handler TWICE, each
            // independently calling applyCatalogPatternToNewLayer() -
            // creating a SECOND, unwanted layer from what the person
            // intended as a single paste. That extra layer then silently
            // broke "Animate A -> B"'s own "exactly two ordinary layers"
            // eligibility check (canCreateTwoKeyframeTimeline()) the next
            // time it was clicked, with no obvious explanation - reproduced
            // concretely (two back-to-back applyCatalogPatternToNewLayer()
            // calls leave 3 non-playback layers, canCreateTwoKeyframeTimeline()
            // correctly but confusingly returns false) before this fix.
            // Native `disabled` both greys the button out (existing
            // .layer-btn:disabled CSS) and stops the browser from
            // dispatching mousedown/click to it at all - a re-click during
            // the awaited read is a no-op, not a second invocation.
            pastePatternBtn.elt.disabled = true;
            try {
                if (!navigator.clipboard || !navigator.clipboard.readText) {
                    if (pastePatternStatus) pastePatternStatus.html('Clipboard access is not available in this browser/context.');
                    return;
                }
                let text;
                try {
                    text = await navigator.clipboard.readText();
                } catch (err) {
                    if (pastePatternStatus) pastePatternStatus.html("Clipboard permission denied - check your browser's site settings.");
                    console.warn('Failed to read clipboard for Paste Pattern:', err.message);
                    return;
                }
                const pattern = parseClipboardCatalogPattern(text);
                if (!pattern) {
                    if (pastePatternStatus) pastePatternStatus.html('Clipboard does not contain a valid copied pattern.');
                    return;
                }
                if (applyCatalogPatternToNewLayer(pattern)) {
                    if (pastePatternStatus) pastePatternStatus.html('');
                } else {
                    if (pastePatternStatus) pastePatternStatus.html('Failed to load the copied pattern - see console for details.');
                }
                renderLayerTabs();
                updateOffsetControls();
                updateFaceToggleControl();
                updateTimelineControls();
                redraw();
                updateCrossLayerStatus();
                updatePatternNameStatus();
            } finally {
                pastePatternBtn.elt.disabled = false;
            }
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

    // Roadmap 1.12 stage 5 (symmetryMode axis) part 3: this layer's own
    // Mode/Fold - separate handlers from the base's own .mode-btn/
    // .fold-btn ones above, writing additionalLayers[activeLayer].
    // symmetryMode via setActiveLayerSymmetryMode(), never the global
    // symmetryMode (mirrors the shape handler directly above exactly).
    // category/fold aren't tracked as separate persisted state the way
    // the base's own symmetryCategory/symmetryFold closure variables
    // are - each click derives "the other half" (fold for a mode click,
    // category for a fold click) from the layer's CURRENT symmetryMode
    // via bestEffortCategoryFold(), so layer.symmetryMode stays the
    // single source of truth (no separate category/fold fields to ever
    // drift out of sync with it, unlike the base's own two-variable
    // approach - a deliberate simplification enabled by the base
    // already existing as a working precedent to compare against).
    if (layerModeBtns.length) {
        layerModeBtns.forEach(btn => {
            btn.mousePressed(() => {
                if (activeLayer === 'base') return;
                const layer = additionalLayers[activeLayer];
                const category = btn.attribute('data-mode');
                const current = bestEffortCategoryFold(layer.symmetryMode, 6) || { fold: 6 };
                setActiveLayerSymmetryMode(normSym(resolveSymmetryMode(layer.shape, category, current.fold)));
                updateOffsetControls();
                redraw();
            });
        });
    }

    if (layerFoldBtns.length) {
        layerFoldBtns.forEach(btn => {
            btn.mousePressed(() => {
                if (activeLayer === 'base') return;
                const layer = additionalLayers[activeLayer];
                const fold = parseInt(btn.attribute('data-fold'));
                const current = bestEffortCategoryFold(layer.symmetryMode, fold) || { category: 'spiegeling' };
                setActiveLayerSymmetryMode(normSym(resolveSymmetryMode(layer.shape, current.category, fold)));
                updateOffsetControls();
                redraw();
            });
        });
    }

    // Roadmap 1.8 Stage A: this layer's own animation controls. Set
    // Start/End are explicit-action captures (never automatic, same
    // convention as "Align to base"); Duration/Play/Progress all funnel
    // through the top-level setActiveLayer*() setters (Roadmap 1.8
    // Stage A section) so activeLayer==='base' stays a no-op everywhere,
    // same guard as every other per-layer setter.
    if (setAnimStartBtn) {
        setAnimStartBtn.mousePressed(() => {
            setActiveLayerAnimationStart();
            updateOffsetControls();
        });
    }
    if (setAnimEndBtn) {
        setAnimEndBtn.mousePressed(() => {
            setActiveLayerAnimationEnd();
            updateOffsetControls();
        });
    }
    if (animDurationInput) {
        animDurationInput.input(() => {
            setActiveLayerAnimationDuration(animDurationInput.value());
        });
    }
    if (animPlayBtn) {
        animPlayBtn.mousePressed(() => {
            toggleActiveLayerAnimationPlayback();
            updateOffsetControls();
            redraw();
        });
    }
    // Roadmap 1.8 Stage A (design session point 4 - bidirectional scrub):
    // dragging this slider pauses (if playing) and jumps straight to the
    // dragged progress - setActiveLayerAnimationProgress() itself already
    // applies the new frame immediately, so a single redraw() here is
    // enough to show it even while noLoop() is active (nothing else is
    // animating).
    if (animProgressInput) {
        animProgressInput.input(() => {
            setActiveLayerAnimationProgress(parseFloat(animProgressInput.value()));
            updateOffsetControls();
            redraw();
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
            if (v < 1) v = 1; if (v > 7) v = 7; // Roadmap 1.1 (Group A): matches the base input's own 5 -> 7 raise, see its own clamp comment above
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
    updateTimelineControls();
    updateFaceToggleControl();
    updateCurveTypeControls();
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
    //
    // Roadmap: catalog -> NEW LAYER back-link extension - a
    // catalogUrlPattern.layer === 'new' link is routed to
    // applyCatalogPatternToNewLayer() instead, which never touches the
    // base globals/UI at all (see its own comment), so the plain
    // base-only case just below is completely unaffected either way.
    if (catalogUrlPattern && catalogUrlPattern.layer === 'new') {
        if (!applyCatalogPatternToNewLayer(catalogUrlPattern)) addRandomConnection();
    } else if (!catalogUrlPattern || !applyCatalogPattern(catalogUrlPattern)) {
        addRandomConnection();
    }
    // Roadmap: renderLayerTabs()/updateOffsetControls()/updateFaceToggleControl()/
    // updateTimelineControls() only ran once, earlier in setup(), BEFORE
    // rebuildGrid() above - a layer created just now by
    // applyCatalogPatternToNewLayer() needs an explicit re-sync so its
    // tab/controls actually appear on the very first paint, the same
    // sync a real "+Layer" click's own handler already does. Harmless
    // (redundant, not wrong) when no layer was created.
    renderLayerTabs();
    updateOffsetControls();
    updateFaceToggleControl();
    updateTimelineControls();
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

    // Roadmap 1.8 Stage A: recompute every ACTIVELY PLAYING layer's live
    // offsetX/offsetY/rotation/shapeSizeFactor BEFORE drawTessellation()
    // reads them - cheap (a handful of lerp() calls per playing layer,
    // negligible next to drawTessellation()'s own cost - see the design
    // session's real per-redraw timing citations). Re-checking
    // isAnythingAnimating() afterward (not just at the Play/Pause click
    // site) is what makes loop() correctly stop the instant the LAST
    // playing layer reaches its own end, not one frame late or never -
    // applyLayerAnimationFrame() itself may have just flipped that
    // layer's own `playing` to false.
    //
    // [real-bug fix]: gated on layer.animation.playing, NOT merely
    // layer.animation existing (the shipped bug: `if (layer.animation)`
    // alone). A layer that merely HAS an animation object but isn't
    // playing (the entire window between "Set Start" and "Set End", or
    // any paused state) would otherwise get its live offsetX/rotation/
    // shapeSizeFactor forcibly reset to t=0's interpolated value (=
    // fromOffsetX/fromRotation/fromShapeSizeFactor, since elapsedMs is
    // still 0) on EVERY redraw - including the redraw the offset/
    // rotation/shape-size input's OWN change handler already triggers
    // right after writing the user's edit. That silently undid the
    // edit before "Set End" ever captured it, so `to*` always ended up
    // identical to `from*` - Play then genuinely interpolated between
    // two identical states, which is indistinguishable from doing
    // nothing (the reported bug: "no visible movement" - confirmed via
    // real UI clicks, not assumed: editing #layer-offset-x-input after
    // "Set Start" measurably had zero lasting effect on
    // additionalLayers[i].offsetX before this fix). Scrubbing
    // (setActiveLayerAnimationProgress()) is unaffected - it already
    // calls applyLayerAnimationFrame() itself, directly, exactly once
    // per scrub action, never relying on this per-frame loop.
    additionalLayers.forEach(layer => { if (layer.animation && layer.animation.playing) applyLayerAnimationFrame(layer); });
    // Roadmap 1.8 Stage C phase (i): same "recompute while actively
    // playing, re-check isAnythingAnimating() afterward" pattern as the
    // per-layer loop just above - applyTimelineFrame() may itself flip
    // timeline.playing to false (reaching the end), which
    // syncAnimationLoopState() needs to see this same frame, not one
    // frame late. syncTimelineDisplay() runs unconditionally whenever a
    // timeline exists (not gated on `playing`) so the progress
    // slider/play-icon stay live during playback the same way
    // syncLayerAnimationDisplay() already does below for the per-layer
    // case - timeline isn't tab-contextual, so this isn't gated on
    // activeLayer either.
    if (timeline && timeline.playing) applyTimelineFrame();
    syncAnimationLoopState();
    if (activeLayer !== 'base' && additionalLayers[activeLayer] && additionalLayers[activeLayer].animation) {
        syncLayerAnimationDisplay(additionalLayers[activeLayer]);
    }
    if (timeline) syncTimelineDisplay();

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
    // Group D Phase 3: Face Colors panel - same once-per-draw, signature-
    // gated pattern (rebuilds only when its contents could have changed).
    updateFaceColorsPanel();
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
    updateTimelineControls(); // rebuildGridFromConstruction() also clears timeline - see its own comment (core/state.js)
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
// Roadmap 1.12 stage 5 (symmetryMode axis) part 2: symmetryMode -
// same role/convention as shape directly above, added now that a layer
// has its own value (Phase 1) - callers extract it as the mode argument
// to computeThemeLineOrbitTable()/computeThemeLineName()/friends,
// mirroring core/tiling.js's own override.symmetryMode embedding
// (Phase 1). Fixes patternNameSignature()/updatePatternNameStatus(),
// previously the two live call sites still reading/passing the bare
// global symmetryMode regardless of activeLayer - the same bug class
// the shape fix above already addressed for shape, just not yet
// extended to this axis (design session finding).
function activeGridOverride() {
    if (activeLayer === 'base') return undefined;
    const layer = additionalLayers[activeLayer];
    return { nodes: layer.nodes, centroid: layer.centroid, outerCorners: layer.outerCorners, shape: layer.shape, symmetryMode: layer.symmetryMode };
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
    // Roadmap 1.12 stage 5 (symmetryMode axis) part 1 (data model +
    // rendering only - no UI wiring yet): symmetryMode starts identical
    // to the base's current global value, same "layer starts as a copy
    // of base" convention as shape above - NOT a live reference to the
    // global (a later base symmetryMode change must not silently drag
    // this layer's own value along with it, the same one-time-copy
    // semantics shape/nodeCount/shapeSizeFactor already have). Unlike
    // shape, this needs no grid refresh of any kind at creation or
    // change time - core/tiling.js's drawTessellation()/drawAdditionalLayers()
    // already read it straight from this field (symmetryModeOverride),
    // no layerGrid() involvement.
    const layer = { connections: [], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape: currentShape, symmetryMode, enabled: true, showFaces: false, nodeCount, shapeSizeFactor };
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
//
// Roadmap 1.8 Stage C phase (ii): if `index` is the timeline's
// auto-created playback layer, the WHOLE timeline is torn down first
// (can't continue without it) - clearTimelineState() restores every
// keyframe's saved `enabled`. If `index` is instead one of the
// timeline's (possibly many) keyframes, only THAT ONE keyframe leaves
// the sequence - spliceKeyframeOutOfTimeline() (shared with
// removeKeyframeFromTimeline()'s own, layer-preserving removal) - the
// rest of the sequence survives, re-assembled around the gap. Dropping
// to a single remaining keyframe orphans the now-unusable playback
// layer, spliced out here too via the same local spliceOne() helper so
// activeLayer's own index-shift logic isn't duplicated. A timeline
// that ISN'T affected at all (the removed layer is some other,
// unrelated one) survives with its own stored indices shifted the same
// way activeLayer's is just below.
function removeLayer(index) {
    function spliceOne(i) {
        additionalLayers.splice(i, 1);
        if (activeLayer === i) {
            activeLayer = 'base';
        } else if (typeof activeLayer === 'number' && activeLayer > i) {
            activeLayer -= 1;
        }
    }
    let orphanedPlaybackIndex = null;
    if (timeline && index === timeline.playbackLayerIndex) {
        clearTimelineState(`Timeline removed: Layer ${index + 1} was deleted.`);
    } else if (timeline && timeline.keyframeLayerIds.includes(index)) {
        orphanedPlaybackIndex = spliceKeyframeOutOfTimeline(index);
    }
    spliceOne(index);
    if (orphanedPlaybackIndex !== null) {
        spliceOne(orphanedPlaybackIndex > index ? orphanedPlaybackIndex - 1 : orphanedPlaybackIndex);
    }
    if (timeline) {
        timeline.keyframeLayerIds = timeline.keyframeLayerIds.map(i => i > index ? i - 1 : i);
        if (timeline.playbackLayerIndex !== null && timeline.playbackLayerIndex > index) timeline.playbackLayerIndex -= 1;
    }
    // Roadmap 1.8 Stage A (design session's own isolated verification
    // focus): a removed layer's own `playing` flag leaves with it (the
    // object itself is gone, spliced out above), but isAnythingAnimating()
    // only re-evaluates when SOMETHING calls syncAnimationLoopState() -
    // without this call, removing the LAST still-playing layer would
    // leave loop() running forever with nothing left to animate (not
    // dangerous, but exactly the silent-leftover-loop risk the design
    // session flagged as this feature's highest-risk piece).
    syncAnimationLoopState();
    // Refreshes the playback layer's interpolated content immediately
    // (a mid-sequence removal changes which pair a given scrub position
    // now resolves to) - the caller's own redraw() right after picks
    // this up. Safe no-op when timeline is null.
    applyTimelineFrame();
    // Roadmap 1.8 Stage C: refreshes the Add/Remove/playback control
    // visibility (a timeline may have just changed shape or been torn
    // down above) - window-exposed by setup() the same way
    // updateOffsetControls() is, since this is a top-level function.
    updateTimelineControls();
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

// Roadmap 1.12 stage 5 (symmetryMode axis) part 3: writes the ACTIVE
// layer's own symmetryMode - a no-op when activeLayer is 'base', same
// guard as setActiveLayerRotation() directly above. Pure property
// write, mirroring that function exactly (not updateActiveLayerGrid()'s
// clear-and-rebuild pattern): symmetryMode is a pure render-time
// parameter (Phase 1's own core/tiling.js module-docblock classifies
// it alongside curveType/rotation), never baked into stored nodes/
// connections, so no grid refresh or connections/redoStack clearing is
// ever needed when it changes - core/tiling.js's drawTessellation()/
// drawAdditionalLayers() (Phase 1) already read straight from this
// field via symmetryModeOverride. Takes an ALREADY-RESOLVED raw mode
// string (unlike setActiveLayerRotation()'s raw numeric input, which
// normalizes itself) - the caller (setup()'s layer-mode/fold click
// handlers) resolves category+fold to a raw value via the same
// resolveSymmetryMode()/normSym() pipeline the base's own control uses,
// since that resolution needs this layer's own shape (a setup()-local
// closure concern), not something this standalone setter should
// re-derive itself.
function setActiveLayerSymmetryMode(resolvedMode) {
    if (activeLayer === 'base') return;
    additionalLayers[activeLayer].symmetryMode = resolvedMode;
}

// ----------------- LAYER ANIMATION (Roadmap 1.8 Stage A) -------------
// Layer-level keyframe animation - interpolates a layer's already-
// existing continuous parameters (offsetX/offsetY from 1.9/1.12 stage
// 2, rotation from 1.12 stage 3, shapeSizeFactor from 1.12 stage 1)
// between a captured start and end state over time. Additional layers
// only, never the base - offsetX/offsetY/rotation are already layer-
// only concepts (the base has none), and animating the base's own
// shapeSizeFactor would mean the shared coordinate-scale reference
// every other layer's positioning depends on changes over time, a
// materially different, more invasive feature (design session).
//
// layer.animation, once created (undefined until the first Set Start/
// End capture), holds:
//   fromOffsetX/fromOffsetY/fromRotation/fromShapeSizeFactor - the
//     captured start state
//   toOffsetX/toOffsetY/toRotation/toShapeSizeFactor - the captured
//     end state
//   durationMs - playback length
//   elapsedMs - progress while PAUSED (authoritative then); while
//     PLAYING, derived progress is millis()-startTime instead, and
//     elapsedMs is kept in sync every frame purely so pausing/resuming/
//     scrubbing never has to distinguish "where was it stored" - it's
//     always readable from elapsedMs regardless of playing state once
//     applyLayerAnimationFrame() has run at least once this frame.
//   startTime - millis() this playback segment's t=0 corresponds to;
//     recomputed on every play so a paused-then-resumed animation
//     continues from elapsedMs, not from the beginning.
//   playing - whether this layer is actively advancing right now.
//
// No new rendering-path plumbing: core/tiling.js/core/symmetry.js
// already read layer.offsetX/rotation/shapeSizeFactor unconditionally -
// animation just means something other than the mouse is now writing
// those same fields on a timer (design session point 2's central
// reasoning for choosing this data model over two-full-layers-as-
// keyframes).
function ensureLayerAnimation(layer) {
    if (!layer.animation) {
        layer.animation = {
            fromOffsetX: layer.offsetX, fromOffsetY: layer.offsetY,
            fromRotation: layer.rotation || 0, fromShapeSizeFactor: layer.shapeSizeFactor,
            toOffsetX: layer.offsetX, toOffsetY: layer.offsetY,
            toRotation: layer.rotation || 0, toShapeSizeFactor: layer.shapeSizeFactor,
            durationMs: 2000, elapsedMs: 0, startTime: null, playing: false,
        };
    }
    return layer.animation;
}

// Roadmap 1.8 Stage B (connections morph): resolves this layer's
// CURRENT connections/nodes into raw {x1,y1,x2,y2} coordinate pairs -
// the same lookup drawShapeCell() itself does (nodeArr.find(n => n.id
// === conn[0])), but done once at capture time rather than at render
// time, so the captured shape survives independently of whatever the
// layer's own connections/nodes go on to become afterward (the person
// keeps editing/rebuilding this SAME layer to author the other
// endpoint of the morph - see setActiveLayerAnimationStart()/End()
// below). A connection with a dangling/missing endpoint id is skipped,
// the same defensive guard drawShapeCell() itself already has
// (`if (!n1 || !n2) continue`) - not reachable via any shipped UI path,
// kept consistent rather than assumed impossible.
function resolveConnectionsToCoords(layer) {
    const coords = [];
    for (const conn of layer.connections) {
        if (conn.length !== 2) continue;
        const n1 = layer.nodes.find(n => n.id === conn[0]);
        const n2 = layer.nodes.find(n => n.id === conn[1]);
        if (!n1 || !n2) continue;
        coords.push({ x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y });
    }
    return coords;
}

// Roadmap 1.8 Stage B: stable synthetic node ids for the interpolated
// morph render substitute (applyLayerConnectionsMorphFrame() below) -
// assigned ONCE per (fromConnections,toConnections) pairing, never
// regenerated per frame. This is what keeps a 'free'-styled morphing
// line's curve seed (core/curves.js's _connectionSeed(), keyed off
// id1/id2) STABLE across the whole animation instead of re-rolling its
// noise pattern every frame (verified via a real browser test - see
// this stage's implementation report). Only regenerated when the
// pairing's own length changes (a genuinely new Start/End capture with
// a different, still-matching, line count) - recapturing with the SAME
// count keeps the previous ids, so an in-flight animation's noise
// pattern isn't disturbed by an unrelated recapture of the other side.
function ensureLayerMorphIds(anim, count) {
    if (!anim.morphIds || anim.morphIds.length !== count) {
        anim.morphIds = [];
        for (let i = 0; i < count; i++) anim.morphIds.push([i * 2, i * 2 + 1]);
    }
}

// Captures the ACTIVE layer's CURRENT live offsetX/offsetY/rotation/
// shapeSizeFactor as its animation's start (Set Start) or end (Set
// End) state - explicit-action convention, same as "Align to base"
// (never automatic). A no-op when activeLayer is 'base'.
// Roadmap 1.8 Stage B: also resolves+deep-copies this layer's CURRENT
// connections into anim.fromConnections/toConnections (see
// resolveConnectionsToCoords() above) - independent of the transform
// fields above (always captured unconditionally, unaffected by
// anything below). A line-count mismatch against the OTHER side's
// already-captured connections is refused with a status message
// (#layer-anim-connections-status, see setup()'s
// setLayerAnimConnectionsStatus()) rather than silently truncating or
// crashing - matching this project's established "refuse, don't
// silently do something wrong" convention (e.g. core/tiling.js's
// clampTileCount()). layer._morphNodes/_morphConnections (the render
// substitute - see core/tiling.js) are cleared unconditionally on every
// Set Start/End click so the live, currently-edited connections render
// normally until the next Play/scrub recomputes the substitute -
// otherwise a stale substitute from a PREVIOUS animation would keep
// shadowing whatever the person is now clicking together for the next
// Start/End pattern.
function setActiveLayerAnimationStart() {
    if (activeLayer === 'base') return;
    const layer = additionalLayers[activeLayer];
    const anim = ensureLayerAnimation(layer);
    anim.fromOffsetX = layer.offsetX;
    anim.fromOffsetY = layer.offsetY;
    anim.fromRotation = layer.rotation || 0;
    anim.fromShapeSizeFactor = layer.shapeSizeFactor;
    layer._morphNodes = null;
    layer._morphConnections = null;
    const resolved = resolveConnectionsToCoords(layer);
    if (anim.toConnections && resolved.length !== anim.toConnections.length) {
        if (window.setLayerAnimConnectionsStatus) window.setLayerAnimConnectionsStatus(
            `Line count mismatch: Start has ${resolved.length}, End has ${anim.toConnections.length} - counts must match. Start connections NOT captured.`
        );
        return;
    }
    anim.fromConnections = resolved;
    if (anim.toConnections) ensureLayerMorphIds(anim, resolved.length);
    if (window.setLayerAnimConnectionsStatus) window.setLayerAnimConnectionsStatus('');
}
function setActiveLayerAnimationEnd() {
    if (activeLayer === 'base') return;
    const layer = additionalLayers[activeLayer];
    const anim = ensureLayerAnimation(layer);
    anim.toOffsetX = layer.offsetX;
    anim.toOffsetY = layer.offsetY;
    anim.toRotation = layer.rotation || 0;
    anim.toShapeSizeFactor = layer.shapeSizeFactor;
    layer._morphNodes = null;
    layer._morphConnections = null;
    const resolved = resolveConnectionsToCoords(layer);
    if (anim.fromConnections && resolved.length !== anim.fromConnections.length) {
        if (window.setLayerAnimConnectionsStatus) window.setLayerAnimConnectionsStatus(
            `Line count mismatch: End has ${resolved.length}, Start has ${anim.fromConnections.length} - counts must match. End connections NOT captured.`
        );
        return;
    }
    anim.toConnections = resolved;
    if (anim.fromConnections) ensureLayerMorphIds(anim, resolved.length);
    if (window.setLayerAnimConnectionsStatus) window.setLayerAnimConnectionsStatus('');
}

function setActiveLayerAnimationDuration(rawValue) {
    if (activeLayer === 'base') return;
    const layer = additionalLayers[activeLayer];
    const anim = ensureLayerAnimation(layer);
    let v = parseFloat(rawValue);
    if (!Number.isFinite(v) || v <= 0) v = 2000;
    anim.durationMs = v;
}

// Play/Pause toggle for the ACTIVE layer's animation - a no-op when
// activeLayer is 'base'. Resuming continues from anim.elapsedMs (not
// from the beginning): startTime is recomputed so millis()-startTime
// reproduces the same elapsed progress the pause left off at.
function toggleActiveLayerAnimationPlayback() {
    if (activeLayer === 'base') return;
    const layer = additionalLayers[activeLayer];
    const anim = ensureLayerAnimation(layer);
    if (anim.playing) {
        anim.elapsedMs = Math.max(0, Math.min(anim.durationMs, millis() - anim.startTime));
        anim.playing = false;
    } else {
        // Roadmap 1.8 Stage A: play-once-and-stop (design session point
        // 3) - restarts from the beginning once it has already reached
        // the end, rather than silently doing nothing on a second Play
        // click.
        if (anim.elapsedMs >= anim.durationMs) anim.elapsedMs = 0;
        anim.startTime = millis() - anim.elapsedMs;
        anim.playing = true;
    }
    syncAnimationLoopState();
}

// Manual scrub (design session point 4 - bidirectional progress
// control): sets progress directly to `t` (0..1) and pauses if it was
// playing, matching a scrub gesture's usual "grab it, it stops"
// convention. Applied immediately (not waiting for the next natural
// animation frame) so dragging the slider while noLoop() is active
// still shows a live preview - the caller is responsible for a single
// redraw() afterward, same as every other manual-interaction control.
function setActiveLayerAnimationProgress(t) {
    if (activeLayer === 'base') return;
    const layer = additionalLayers[activeLayer];
    const anim = ensureLayerAnimation(layer);
    anim.elapsedMs = Math.max(0, Math.min(1, t)) * anim.durationMs;
    anim.playing = false;
    syncAnimationLoopState();
    applyLayerAnimationFrame(layer);
}

// Shortest-angular-path interpolation (design session point 3) - plain
// linear interpolation of the raw stored degree values would sweep the
// LONG way around whenever the short path crosses the 0/360 boundary
// (e.g. 350 -> 10 linearly sweeps 340 degrees the wrong way instead of
// the natural 20 degrees). +540 (not +180) before the modulo keeps the
// dividend always positive despite JS's sign-of-dividend % semantics -
// verified concretely: 350->10 gives delta=20 (the short way), matching
// hand computation, not just assumed algebraically.
function lerpAngleShortest(fromDeg, toDeg, t) {
    const delta = ((toDeg - fromDeg + 540) % 360) - 180;
    const result = fromDeg + delta * t;
    return ((result % 360) + 360) % 360;
}

// Recomputes ONE layer's live offsetX/offsetY/rotation/shapeSizeFactor
// from its animation's current progress - called for every layer that
// HAS an animation object on every draw() call (not just while
// playing), so a paused/scrubbed state renders correctly too, not only
// live playback. Auto-stops at t=1 (play-once, not looping) - the
// caller (draw()) re-checks isAnythingAnimating() afterward so loop()
// correctly ends the instant the last playing layer finishes, not one
// frame late.
function applyLayerAnimationFrame(layer) {
    const anim = layer.animation;
    if (!anim) return;
    let elapsed = anim.playing ? (millis() - anim.startTime) : anim.elapsedMs;
    elapsed = Math.max(0, Math.min(anim.durationMs, elapsed));
    if (anim.playing) {
        anim.elapsedMs = elapsed;
        if (elapsed >= anim.durationMs) anim.playing = false;
    }
    const t = anim.durationMs > 0 ? elapsed / anim.durationMs : 1;
    layer.offsetX = lerp(anim.fromOffsetX, anim.toOffsetX, t);
    layer.offsetY = lerp(anim.fromOffsetY, anim.toOffsetY, t);
    layer.rotation = lerpAngleShortest(anim.fromRotation, anim.toRotation, t);
    layer.shapeSizeFactor = lerp(anim.fromShapeSizeFactor, anim.toShapeSizeFactor, t);
    applyLayerConnectionsMorphFrame(layer, anim, t);
}

// Roadmap 1.8 Stage B (connections morph): recomputes this layer's
// interpolated connections-morph render substitute
// (layer._morphNodes/_morphConnections) for the CURRENT progress t -
// read by core/tiling.js's drawTessellation() override object and
// drawAdditionalLayers()'s drawShapeCell() call INSTEAD OF
// layer.nodes/layer.connections whenever set (see their own comments).
// Computed ONCE per draw() call here (not per tile) - the same
// "mutate once, let the existing per-tile loop pick it up for free"
// strategy the four transform fields above already use, not a new
// per-tile mechanism.
//
// Synthetic node ids (anim.morphIds, see ensureLayerMorphIds()) are
// assigned once and reused every frame here, never regenerated - the
// requirement a 'free'-styled morphing line's curve seed (id-keyed,
// core/curves.js's _connectionSeed()) needs to stay STABLE across the
// whole animation instead of re-rolling its noise pattern every frame
// (verified concretely via a real browser test tracking one 'free'
// line's rendered path across several frames - see this stage's
// implementation report).
//
// null/null (not an empty array) whenever no valid pairing exists -
// no fromConnections/toConnections captured yet, a length mismatch
// between them (refused at capture time, see setActiveLayerAnimation
// Start()/End(), but defended here too rather than trusting the
// invariant blindly), or an empty pairing - so the two render call
// sites' `layer._morphNodes || layer.nodes` fallback correctly reverts
// to this layer's own live connections/nodes: both right after Set
// Start/End (before Play/scrub ever runs this) and for any layer that
// has never used the connections-morph feature at all.
function applyLayerConnectionsMorphFrame(layer, anim, t) {
    if (!anim.fromConnections || !anim.toConnections ||
        anim.fromConnections.length !== anim.toConnections.length ||
        anim.fromConnections.length === 0) {
        layer._morphNodes = null;
        layer._morphConnections = null;
        return;
    }
    ensureLayerMorphIds(anim, anim.fromConnections.length);
    const morphNodes = [];
    const morphConnections = [];
    for (let i = 0; i < anim.fromConnections.length; i++) {
        const from = anim.fromConnections[i], to = anim.toConnections[i];
        const idA = anim.morphIds[i][0], idB = anim.morphIds[i][1];
        morphNodes.push({ id: idA, x: lerp(from.x1, to.x1, t), y: lerp(from.y1, to.y1, t), free: true });
        morphNodes.push({ id: idB, x: lerp(from.x2, to.x2, t), y: lerp(from.y2, to.y2, t), free: true });
        morphConnections.push([idA, idB]);
    }
    layer._morphNodes = morphNodes;
    layer._morphConnections = morphConnections;
}

// Whether loop()/noLoop() should be active right now - the single
// source of truth both toggleActiveLayerAnimationPlayback() and
// draw()'s own per-frame re-check consult, so multiple independently-
// playing layers (1.12's own per-layer-independence precedent - no
// artificial "only one animates at a time" restriction) and a layer
// finishing mid-playback both correctly resolve to the same answer.
// Roadmap 1.8 Stage C phase (i): also true while the timeline is
// playing - a single shared loop()/noLoop() gate covering both the
// per-layer transform/connections animation (Stage A/B) and the
// persistent-layer timeline (Stage C), same "loop() only while
// something is actually moving" discipline for both.
function isAnythingAnimating() {
    return additionalLayers.some(l => l.animation && l.animation.playing) || !!(timeline && timeline.playing);
}

// Roadmap 1.8 Stage A (design session point 1's own scoping condition):
// loop() is activated ONLY while something is actually animating, never
// left on permanently - the app's whole efficiency discipline (pattern-
// name-status caching, the cross-layer fill offscreen-buffer cache)
// exists specifically because redraw is normally event-driven, not
// continuous; leaving loop() on after playback ends would silently
// undo that for the other 99% of the time nothing is moving. Guarded by
// animationLoopActive so redundant loop()/noLoop() calls are avoided
// (harmless either way, but this keeps the intent explicit at each call
// site rather than relying on p5's own idempotence).
//
// Deliberately does NOT call redraw() itself when stopping - this is
// called from two genuinely different contexts that need different
// repaint handling: (1) from WITHIN draw() itself (every frame, to stop
// the instant the last playing layer finishes) - the CURRENT draw()
// call is already mid-execution and will finish painting the correct
// final frame on its own; calling redraw() here would recursively
// re-enter draw() from inside draw() itself, a real bug caught before
// this shipped, not a hypothetical one. (2) from a click handler
// OUTSIDE draw() (Pause, Set Start/End, a layer being removed
// mid-playback) - every one of those call sites already ends with its
// own explicit redraw() (this app's established "redraw() after every
// manual state change" convention), so an extra one here would only be
// redundant, never load-bearing.
let animationLoopActive = false;
function syncAnimationLoopState() {
    const shouldBeLooping = isAnythingAnimating();
    if (shouldBeLooping && !animationLoopActive) {
        animationLoopActive = true;
        loop();
    } else if (!shouldBeLooping && animationLoopActive) {
        animationLoopActive = false;
        noLoop();
    }
}

// ----------------- TIMELINE (Roadmap 1.8 Stage C) ----------------------
// Persistent-layer keyframe timeline, superseding Stage B's ephemeral
// Set Start/End capture model: a captured fromConnections/toConnections
// snapshot can't be revisited and can't grow beyond two states. Here,
// each keyframe IS one of additionalLayers[]'s own real, persistent,
// independently-editable entries - revisiting one is just switching to
// that layer's own tab and editing normally. `timeline` (core/state.js)
// is a TOP-LEVEL concept, not nested inside any one layer's own
// `animation` field - a transition spanning several independent layers
// has no single layer to belong to. Stage B's own mechanism
// (ensureLayerAnimation() etc., above) stays fully intact and
// unmodified alongside this.
//
// Roadmap 1.8 Stage C phase (ii): generalized from phase (i)'s fixed
// two named keyframes to an ORDERED ARRAY of any length >= 1
// (core/state.js's own comment on `timeline` has the full shape/
// reasoning). The one part that generalizes with genuinely NO change at
// all is the interpolation math itself - applyLayerConnectionsMorphFrame()
// (Stage B, still below, untouched) only ever sees ONE resolved
// {fromConnections, toConnections} pair and ONE local t; this phase's
// entire job is finding the RIGHT pair + local t for the current global
// time (resolveTimelineSegment() below) and feeding it in exactly the
// same shape phase (i) always did.

// Roadmap 1.8 Stage C phase (ii): "Add to Timeline"'s own eligibility -
// the active layer must be a real, ordinary layer (not base, not the
// playback layer) and not already part of the sequence. Mirrors "Align
// to base"'s own disabled-button pattern. Finer content checks (shape/
// order/symmetryMode/line-count matching the PREVIOUS keyframe) are only
// evaluated when the button is actually clicked - see
// addLayerToTimeline() - and reported via #timeline-status.
function canAddLayerToTimeline() {
    if (activeLayer === 'base') return false;
    const layer = additionalLayers[activeLayer];
    if (!layer || layer.isTimelinePlayback) return false;
    if (timeline && timeline.keyframeLayerIds.includes(activeLayer)) return false;
    return true;
}

// Roadmap 1.8 Stage C phase (ii): "Add to Timeline" - appends the
// CURRENTLY ACTIVE layer (typically just pasted or just built) as the
// next keyframe. Design session point 3: this directly matches the
// stated paste-then-add authoring rhythm - addLayer()/
// applyCatalogPatternToNewLayer() already leave the new layer as
// activeLayer, so no separate picker is needed.
//
// The FIRST call (timeline is null) just starts tracking - one keyframe
// alone has no segment to render, so no playback layer is created yet
// (see below) and no shape/order/symmetryMode/line-count validation is
// possible or needed. Every SUBSEQUENT call validates the new keyframe
// against the PREVIOUS one only (not against every earlier keyframe
// individually) - sufficient by transitivity, since every earlier
// consecutive pair already validated equal to each other when it was
// added, matching/refusing exactly as phase (i)'s own single-pair check
// did (design session point 4 of the original phase (i) session: this
// constraint is sharper than the coordinate math itself needs, but
// required for the playback layer's own FIXED tessellation scheme,
// established from keyframe 0, to mean the same thing for every
// keyframe's content).
function addLayerToTimeline() {
    if (!canAddLayerToTimeline()) return;
    const idx = activeLayer;
    const layer = additionalLayers[idx];

    if (!timeline) {
        timeline = {
            keyframeLayerIds: [idx],
            playbackLayerIndex: null,
            segmentDurationsMs: [],
            segmentPairings: [],
            segmentFlips: [],
            segmentMembers: [],
            elapsedMs: 0, startTime: null, playing: false,
        };
        layer._timelineSavedEnabled = layer.enabled;
        layer.enabled = false;
        setTimelineStatus('');
        renderLayerTabs();
        updateOffsetControls();
        updateTimelineControls();
        redraw();
        return;
    }

    const prevIdx = timeline.keyframeLayerIds[timeline.keyframeLayerIds.length - 1];
    const prevLayer = additionalLayers[prevIdx];
    if (layer.shape !== prevLayer.shape || layer.nodeCount !== prevLayer.nodeCount ||
        layer.shapeSizeFactor !== prevLayer.shapeSizeFactor || layer.symmetryMode !== prevLayer.symmetryMode) {
        setTimelineStatus(`Layer ${idx + 1} must share the same shape, order, size and symmetry mode as Layer ${prevIdx + 1} to extend the timeline.`);
        return;
    }
    const fromCoords = resolveConnectionsToCoords(prevLayer);
    const toCoords = resolveConnectionsToCoords(layer);
    if (fromCoords.length !== toCoords.length || fromCoords.length === 0) {
        setTimelineStatus(`Line count mismatch: Layer ${prevIdx + 1} has ${fromCoords.length}, Layer ${idx + 1} has ${toCoords.length} - counts must match.`);
        return;
    }

    // Roadmap 1.8 Stage C phase (ii): the playback layer is created
    // LAZILY, here, the first time a real segment becomes possible (the
    // second keyframe) - not at the first "Add to Timeline" click, which
    // has nothing yet to interpolate. Every later "Add to Timeline" call
    // (3rd, 4th, ... keyframe) reuses this SAME playback layer unchanged
    // - only keyframeLayerIds/segmentDurationsMs grow.
    if (timeline.playbackLayerIndex === null) {
        const playbackLayer = {
            connections: [], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0,
            shape: prevLayer.shape, symmetryMode: prevLayer.symmetryMode, enabled: true,
            showFaces: false, nodeCount: prevLayer.nodeCount, shapeSizeFactor: prevLayer.shapeSizeFactor,
            isTimelinePlayback: true,
        };
        const grid = layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, playbackLayer.shapeSizeFactor, playbackLayer.nodeCount, playbackLayer.shape, canvasW, canvasH);
        playbackLayer.nodes = grid.nodes;
        playbackLayer.centroid = grid.centroid;
        playbackLayer.outerCorners = grid.outerCorners;
        additionalLayers.push(playbackLayer);
        // idx/prevIdx were captured before this push and are both
        // earlier indices - push() only appends, so neither is affected.
        timeline.playbackLayerIndex = additionalLayers.length - 1;
    }

    timeline.keyframeLayerIds.push(idx);
    // Design session point 2: each segment's own FIXED duration,
    // captured once here - not derived by dividing one total evenly.
    // Currently always the same default (2000ms); a later session could
    // expose this as an editable value per segment without touching
    // anything else, since it already lives in its own array entry.
    timeline.segmentDurationsMs.push(2000);
    timeline.segmentPairings.push(null); // Roadmap 1.8 Stage D phase (i): null = default (index) pairing
    timeline.segmentFlips.push(null); // Stage D phase (iii): null = no End line reversed
    timeline.segmentMembers.push(null); // Stage D phase (iv): null = every End line as clicked (group element 0)
    layer._timelineSavedEnabled = layer.enabled;
    layer.enabled = false;

    setTimelineStatus('');
    applyTimelineFrame();
    renderLayerTabs();
    updateOffsetControls();
    updateTimelineControls();
    redraw();
}

// Roadmap 1.8 Stage C phase (ii): sum of every segment's own fixed
// duration - what play/pause/scrub treat as "the timeline's total
// length" (the scrub slider's own 0..1 range spans this whole sum, not
// any one segment).
function totalTimelineDurationMs(timeline) {
    return timeline.segmentDurationsMs.reduce((a, b) => a + b, 0);
}

// Roadmap 1.8 Stage C phase (ii): the "which pair of consecutive
// keyframes brackets the current global time" helper (design session
// point 4) - given global elapsedMs (0..totalTimelineDurationMs()),
// walks the segments in order accumulating their own (possibly
// different) durations, and returns the segment index plus the LOCAL
// t (0..1) within it. The very last segment is returned even if
// floating-point rounding leaves elapsedMs a hair past its own end
// (the `i === segCount - 1` fallback), so a scrub to exactly t=1 always
// resolves to "end of the last segment", never falls through with no
// match at all. Returns null only when there are zero segments (fewer
// than 2 keyframes) - the caller's own job to handle.
function resolveTimelineSegment(timeline, elapsedMs) {
    const segCount = timeline.segmentDurationsMs.length;
    if (segCount === 0) return null;
    let acc = 0;
    for (let i = 0; i < segCount; i++) {
        const segDur = timeline.segmentDurationsMs[i];
        const segEnd = acc + segDur;
        if (elapsedMs < segEnd || i === segCount - 1) {
            const localElapsed = Math.max(0, elapsedMs - acc);
            const localT = segDur > 0 ? Math.min(1, localElapsed / segDur) : 1;
            return { segmentIndex: i, localT };
        }
        acc = segEnd;
    }
}

// Roadmap 1.8 Stage C phase (ii): resolves the TWO keyframe layers
// bracketing one specific segment's CURRENT connections into raw
// coordinate pairs, fresh on every call - this (not any cached/frozen
// field) is what keeps the interpolation "live-resolved": editing a
// keyframe layer's connections is picked up the very next time this
// runs. Reuses resolveConnectionsToCoords() (Stage B, unmodified) - the
// same lookup drawShapeCell() itself does. Mismatched/zero counts are
// reported, not silently truncated - checked here, not just once at
// addLayerToTimeline() time, since a keyframe can be edited to a
// different count at any point while the timeline exists.
function resolveTimelineKeyframeCoords(timeline, segmentIndex) {
    const idFrom = timeline.keyframeLayerIds[segmentIndex];
    const idTo = timeline.keyframeLayerIds[segmentIndex + 1];
    const layerFrom = additionalLayers[idFrom];
    const layerTo = additionalLayers[idTo];
    if (!layerFrom || !layerTo) return { ok: false, reason: 'A keyframe layer no longer exists.' };
    const from = resolveConnectionsToCoords(layerFrom);
    const toStored = resolveConnectionsToCoords(layerTo);
    if (from.length !== toStored.length || from.length === 0) {
        return { ok: false, reason: `Keyframe line count mismatch: Layer ${idFrom + 1} has ${from.length}, Layer ${idTo + 1} has ${toStored.length} - counts must match.` };
    }
    // Roadmap 1.8 Stage D phase (i): the optional manual pairing
    // (timeline.segmentPairings[segmentIndex]) reorders the END side
    // only - to[i] becomes toOriented[perm[i]] - so
    // applyLayerConnectionsMorphFrame() below, still untouched, keeps
    // pairing index i with index i exactly as before; a null/invalid
    // pairing is the old default (index order) and changes nothing.
    // Stage D phase (iii): before pairing, End line j is REVERSED
    // (endpoints swapped) when segmentFlips[segmentIndex][j] is true -
    // indexed by End line, not by row, so up/down reordering never
    // disturbs an orientation choice. A null/absent/invalid flips entry
    // (every timeline authored before this phase has none) leaves
    // toOriented === toStored, i.e. the pre-phase-(iii) behavior exactly.
    // Stage D phase (iv): even before that, End line j is REPLACED by its
    // image under group element segmentMembers[segmentIndex][j] (index 0
    // = identity = as clicked; see core/orbits.js's computeGroupElements())
    // - an interpolation-time substitution only: the End keyframe layer's
    // own connections are never touched. Order member -> flip -> pairing;
    // member and flip commute (reversing an image is the image of the
    // reversal), so the order is a convention, not a constraint. A
    // null/absent/all-zero/wrong-length members entry leaves toMembered
    // === toStored (the SAME array, no group computation at all), i.e.
    // exactly the pre-phase-(iv) behavior. An out-of-range single entry
    // counts as 0; a line touching a free endpoint has no orbit, so its
    // member choice is ignored (memberImageLines()).
    // toStored (as authored), toMembered/toOriented (member / member+flip
    // applied, before pairing) and perm/flips/members are returned too for
    // the pairing editor's own displacement readout (timelineSegmentInfo()).
    const perm = getSegmentPairing(timeline, segmentIndex, from.length);
    const flips = getSegmentFlips(timeline, segmentIndex, from.length);
    let members = null, groupElements = null;
    const rawMembers = timeline.segmentMembers && timeline.segmentMembers[segmentIndex];
    if (Array.isArray(rawMembers) && rawMembers.length === from.length && rawMembers.some(g => g !== 0)) {
        groupElements = layerGroupElements(layerTo);
        members = groupElements ? sanitizeMembers(rawMembers, groupElements.groupOrder) : null;
    }
    const toMembered = members ? memberImageLines(layerTo, members, groupElements).map(l => l.coords) : toStored;
    const toOriented = applyFlipsToCoords(toMembered, flips);
    const to = perm ? perm.map(j => toOriented[j]) : toOriented;
    return { ok: true, from, to, toStored, toMembered, toOriented, perm, flips, members, groupElements, layerFrom, layerTo };
}

// Roadmap 1.8 Stage D phase (i): a pairing is perm[i] = index into the
// END keyframe's line list assigned to START line i. Must be a true
// permutation of 0..n-1 for the CURRENT line count - a stored pairing
// silently goes stale when a keyframe layer's line count changes (a
// line added/removed), and is then treated as absent (default order)
// rather than trusted; the editor (renderTimelinePairingEditor())
// discards it on next render.
function isValidPairing(perm, n) {
    if (!Array.isArray(perm) || perm.length !== n) return false;
    const seen = new Array(n).fill(false);
    for (const j of perm) {
        if (!Number.isInteger(j) || j < 0 || j >= n || seen[j]) return false;
        seen[j] = true;
    }
    return true;
}
function getSegmentPairing(timeline, segmentIndex, n) {
    const perm = timeline.segmentPairings && timeline.segmentPairings[segmentIndex];
    return isValidPairing(perm, n) ? perm : null;
}

// Roadmap 1.8 Stage D phase (iii): per-End-line orientation flips - an
// array of n booleans (flips[j] true = End line j is read with its two
// endpoints swapped). Same "stale means absent" rule as isValidPairing():
// a wrong-length/non-boolean entry, or one with no true value, is
// treated as no flips at all (null), which is also what every timeline
// created before this phase has (no segmentFlips array at all).
function isValidFlips(flips, n) {
    return Array.isArray(flips) && flips.length === n && flips.every(f => typeof f === 'boolean');
}
function getSegmentFlips(timeline, segmentIndex, n) {
    const flips = timeline.segmentFlips && timeline.segmentFlips[segmentIndex];
    return isValidFlips(flips, n) && flips.some(f => f) ? flips : null;
}
// Returns the SAME array when flips is null (no copy, no allocation on
// the common unflipped path); otherwise a new array with the flagged
// lines' endpoints swapped.
function applyFlipsToCoords(coords, flips) {
    if (!flips) return coords;
    return coords.map((c, j) => flips[j] ? { x1: c.x2, y1: c.y2, x2: c.x1, y2: c.y1 } : c);
}

// Roadmap 1.8 Stage D phase (iv): per-End-line member choice - an array
// of n group-element indices (segmentMembers[seg][j] = element applied to
// End line j; 0 = identity = as clicked). Same "stale means absent" rule
// as the pairing/flips arrays for the LENGTH (a wrong-length entry is
// ignored wholesale); an individual out-of-range index is treated as 0.
function sanitizeMembers(raw, groupOrder) {
    const clean = raw.map(g => Number.isInteger(g) && g >= 0 && g < groupOrder ? g : 0);
    return clean.some(g => g !== 0) ? clean : null;
}
function isValidMemberArray(members, n) {
    return Array.isArray(members) && members.length === n && members.every(g => Number.isInteger(g) && g >= 0);
}

// The group elements (core/orbits.js, cached per grid) of a layer's own
// grid/shape/symmetryMode, or null if they cannot be built (a grid that
// is not symmetric under its claimed group makes the engine throw - a
// real bug elsewhere, reported once and not allowed to take the render
// loop down; callers fall back to "no member choice").
let groupElementsWarned = false;
function layerGroupElements(layer) {
    try {
        return getGroupElementsCached(layer.nodes, layer.centroid, layer.shape, layer.symmetryMode, layer.outerCorners);
    } catch (err) {
        if (!groupElementsWarned) { groupElementsWarned = true; console.warn('Group elements unavailable for a layer grid - member choice disabled:', err.message); }
        return null;
    }
}

// A layer's complete lines as node-id pairs, in resolveConnectionsToCoords()'s
// own filtered order (so index j names the same line in both).
function completeConnectionIds(layer) {
    const ids = [];
    for (const conn of layer.connections) {
        if (conn.length !== 2) continue;
        const n1 = layer.nodes.find(n => n.id === conn[0]);
        const n2 = layer.nodes.find(n => n.id === conn[1]);
        if (!n1 || !n2) continue;
        ids.push([conn[0], conn[1]]);
    }
    return ids;
}

// Each complete line of `layer`, replaced by its image under group
// element members[j] (null members = as clicked): {ids, coords} in
// resolveConnectionsToCoords()'s filtered order. Maps the line's node ids
// through the element's permutation and reads the image's coordinates
// from the layer's own nodes - the group is a symmetry of the grid, so
// both image nodes exist. A line with a free endpoint is absent from the
// permutation (no orbit) and stays as clicked.
function memberImageLines(layer, members, ge) {
    const lines = [];
    let j = 0;
    for (const conn of layer.connections) {
        if (conn.length !== 2) continue;
        const n1 = layer.nodes.find(n => n.id === conn[0]);
        const n2 = layer.nodes.find(n => n.id === conn[1]);
        if (!n1 || !n2) continue;
        let ids = [conn[0], conn[1]], a = n1, b = n2;
        const g = members ? members[j] : 0;
        if (g > 0) {
            const perm = ge.perms[g];
            const i1 = perm.get(conn[0]), i2 = perm.get(conn[1]);
            const m1 = i1 !== undefined ? layer.nodes.find(n => n.id === i1) : null;
            const m2 = i2 !== undefined ? layer.nodes.find(n => n.id === i2) : null;
            if (m1 && m2) { ids = [i1, i2]; a = m1; b = m2; }
        }
        lines.push({ ids, coords: { x1: a.x, y1: a.y, x2: b.x, y2: b.y } });
        j++;
    }
    return lines;
}

// Roadmap 1.8 Stage D phase (i): sum of squared endpoint displacements
// for a given pairing (design session point 3's cost proxy) - both
// endpoints of every line, in the layer's own px coordinates. perm null
// = index order. Purely an orientation aid, not used by rendering.
function pairingDisplacement(from, toOriented, perm) {
    let sum = 0;
    for (let i = 0; i < from.length; i++) {
        const t = toOriented[perm ? perm[i] : i];
        sum += (from[i].x1 - t.x1) ** 2 + (from[i].y1 - t.y1) ** 2
             + (from[i].x2 - t.x2) ** 2 + (from[i].y2 - t.y2) ** 2;
    }
    return sum;
}

// Everything the pairing editor shows for one segment, resolved live
// (same "live-resolved, never cached" discipline as the interpolation
// itself). Labels are the real node-id pairs of the COMPLETE connections
// only, in exactly resolveConnectionsToCoords()'s own filtered order, so
// label i always names coords[i].
function completeConnectionLabels(layer) {
    const labels = [];
    for (const conn of layer.connections) {
        if (conn.length !== 2) continue;
        const n1 = layer.nodes.find(n => n.id === conn[0]);
        const n2 = layer.nodes.find(n => n.id === conn[1]);
        if (!n1 || !n2) continue;
        labels.push(`${conn[0]}\u2013${conn[1]}`);
    }
    return labels;
}
function timelineSegmentInfo(segmentIndex) {
    if (!timeline || segmentIndex < 0 || segmentIndex >= timeline.segmentDurationsMs.length) return null;
    const r = resolveTimelineKeyframeCoords(timeline, segmentIndex);
    if (!r.ok) return { ok: false, reason: r.reason };
    const n = r.from.length;
    const perm = r.perm || Array.from({ length: n }, (_, i) => i);
    const flips = r.flips || new Array(n).fill(false);
    const members = r.members || new Array(n).fill(0);
    const permIsDefault = perm.every((j, i) => j === i);
    const flipsAny = flips.some(f => f);
    const membersAny = members.some(g => g !== 0);
    return {
        ok: true, n, perm, flips, members, permIsDefault, flipsAny, membersAny,
        isDefault: permIsDefault && !flipsAny && !membersAny, // index pairing, no flips, every End line as clicked
        fromLabels: completeConnectionLabels(r.layerFrom),
        // End labels name the line actually used (its member image),
        // not the authored one, so a chosen member is visible in the editor.
        toLabels: r.members
            ? memberImageLines(r.layerTo, r.members, r.groupElements).map(l => `${l.ids[0]}\u2013${l.ids[1]}`)
            : completeConnectionLabels(r.layerTo),
        // displacement follows the effective (member+flip) endpoints;
        // defaultDisplacement is the plain default: index order, no flips,
        // no member substitution (as authored).
        displacement: pairingDisplacement(r.from, r.toOriented, perm),
        defaultDisplacement: pairingDisplacement(r.from, r.toStored, null),
    };
}

// Roadmap 1.8 Stage D phase (ii)/(iii): "Browse all" is offered for
// 1 <= n <= PAIRING_BROWSE_MAX_N, i.e. whenever the combined space
// n!*2^n is greater than 1 (n=1 lists the two orientations; n=2..5 the
// n! pairings, 120 at n=5) - the agreed cutoff from the phase (ii)
// design session; n=6 (720) and beyond stay editor-only (up/down and
// the per-row flip toggle).
const PAIRING_BROWSE_MAX_N = 5;

// All permutations of 0..n-1 in lexicographic order.
function allPermutations(n) {
    const out = [];
    (function go(prefix, rest) {
        if (rest.length === 0) { out.push(prefix); return; }
        rest.forEach((x, i) => go([...prefix, x], rest.filter((_, j) => j !== i)));
    })([], Array.from({ length: n }, (_, i) => i));
    return out;
}

// Roadmap 1.8 Stage D phase (iv): the picture ONE morphing line draws -
// its segment at t = 0.25/0.5/0.75, every image under all group elements
// (exactly what drawConnectionWithSymmetry() puts on the canvas for a
// straight line), endpoints quantized to 1e-3 px and each segment
// canonically ordered/sorted, so two transitions that render identically
// get the same string. 1e-3 px sits between the ~1e-9 px float noise of
// exact lattice transforms and the tens-of-px differences between
// genuinely different transitions (core/orbits.js's snap tolerance is
// 1e-6, core/faces.js's 0.5 for arbitrary user geometry - neither fits
// exact-transform output as well). Three frames, not one, so two
// transitions that merely coincide at t=0.5 are not merged. Compares
// coordinates, never a symbolic stabilizer computed in isolation - the
// equivalence depends on the line it is paired with (a Start line on a
// mirror axis makes mirror-image End variants identical; an off-axis one
// does not).
const ROW_VARIANT_FRAMES = [0.25, 0.5, 0.75];
function transitionPictureKey(a, b, ge) {
    const q = v => Math.round(v * 1000) / 1000;
    const c = ge.centroid;
    return ROW_VARIANT_FRAMES.map(t => {
        const p = { x: a.x1 + (b.x1 - a.x1) * t, y: a.y1 + (b.y1 - a.y1) * t };
        const r = { x: a.x2 + (b.x2 - a.x2) * t, y: a.y2 + (b.y2 - a.y2) * t };
        const segs = new Set();
        for (const op of ge.ops) {
            const P = op(p, c), Q = op(r, c);
            const s1 = `${q(P.x)},${q(P.y)}`, s2 = `${q(Q.x)},${q(Q.y)}`;
            segs.add(s1 < s2 ? s1 + '~' + s2 : s2 + '~' + s1);
        }
        return [...segs].sort().join('|');
    }).join('##');
}

// Roadmap 1.8 Stage D phase (iv): the DEDUPLICATED End-line variants for
// one row - every (group element g, flip f) applied to the End line
// currently assigned to that row (perm[row]), keeping only the first
// candidate of each distinct rendered picture against that row's own
// Start line. Candidate order is g ascending, unflipped before flipped,
// so the kept representative is always the "simplest": identity and
// unflipped first, then the smallest g. Returns
// {variants: [{g, f, ids, coords, key, displacement}], currentKey,
// groupOrder}; currentKey is the picture key of the row's CURRENT state
// (which may be a duplicate not itself listed - callers mark whichever
// variant shares its key as current). Without group elements (grid
// unavailable) only identity is offered and flips are not deduplicated.
// Lines with a free endpoint have no member choice (identity only).
function timelineRowVariants(segmentIndex, row) {
    if (!timeline) return null;
    const r = resolveTimelineKeyframeCoords(timeline, segmentIndex);
    if (!r.ok || row < 0 || row >= r.from.length) return null;
    const perm = r.perm || Array.from({ length: r.from.length }, (_, i) => i);
    const j = perm[row];
    const layerTo = r.layerTo;
    const authored = completeConnectionIds(layerTo)[j];
    const ge = layerGroupElements(layerTo);
    const a = r.from[row];
    const groupOrder = ge ? ge.groupOrder : 1;
    const nodeOf = id => layerTo.nodes.find(n => n.id === id);
    const variants = [];
    const seen = new Set();
    for (let g = 0; g < groupOrder; g++) {
        let ids = authored;
        if (g > 0) {
            const i1 = ge.perms[g].get(authored[0]), i2 = ge.perms[g].get(authored[1]);
            if (i1 === undefined || i2 === undefined) continue; // free endpoint: no orbit, no member choice
            ids = [i1, i2];
        }
        const n1 = nodeOf(ids[0]), n2 = nodeOf(ids[1]);
        if (!n1 || !n2) continue;
        for (const f of [false, true]) {
            const coords = f ? { x1: n2.x, y1: n2.y, x2: n1.x, y2: n1.y } : { x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y };
            const key = ge ? transitionPictureKey(a, coords, ge) : `g${g}f${f ? 1 : 0}`;
            if (seen.has(key)) continue;
            seen.add(key);
            variants.push({
                g, f, ids: f ? [ids[1], ids[0]] : ids, coords, key,
                displacement: (a.x1 - coords.x1) ** 2 + (a.y1 - coords.y1) ** 2 + (a.x2 - coords.x2) ** 2 + (a.y2 - coords.y2) ** 2,
            });
        }
    }
    const currentKey = ge ? transitionPictureKey(a, r.to[row], ge) : null;
    return { variants, currentKey, groupOrder };
}

// Roadmap 1.8 Stage D phase (ii)/(iii)/(iv): the segment's browsable
// candidates, or null when the segment is unresolvable or the space is
// not worth browsing / too large. Two-level design (phase (iii) design
// session): correspondence (n!) and per-line variants are NOT merged
// into one flat list. For n >= 2 the candidates are the n! pairings (as
// in phase (ii)), each with its sum-of-squared displacement computed at
// the segment's CURRENT flips/members (so a listed value always equals
// what the editor would show after picking it); per-line variants stay a
// separate, linear per-row control. Only at n = 1, where n! = 1 leaves the
// line's own variants as the sole variable, are those variants the
// candidates: the deduplicated (group element, flip) images of the End
// line (timelineRowVariants()), each carrying perm/flips/members ready
// to commit - a list of at most 2*|G| entries (2 without symmetry), still
// never a flat n!*2^n one. Offered whenever the combined space n!*2^n is
// greater than 1 (true for every n >= 1) up to PAIRING_BROWSE_MAX_N.
function timelinePairingCandidates(segmentIndex) {
    if (!timeline || segmentIndex < 0 || segmentIndex >= timeline.segmentDurationsMs.length) return null;
    const r = resolveTimelineKeyframeCoords(timeline, segmentIndex);
    if (!r.ok) return null;
    const n = r.from.length;
    let factorial = 1;
    for (let i = 2; i <= n; i++) factorial *= i;
    if (factorial * 2 ** n <= 1 || n > PAIRING_BROWSE_MAX_N) return null;
    if (n === 1) {
        const rv = timelineRowVariants(segmentIndex, 0);
        if (!rv) return null;
        return {
            n,
            orientation: true,
            currentKey: rv.currentKey,
            items: rv.variants.map(v => ({
                perm: [0], flips: [v.f], members: [v.g], key: v.key, ids: v.ids,
                displacement: v.displacement,
            })),
        };
    }
    return {
        n,
        orientation: false,
        items: allPermutations(n).map(perm => ({ perm, displacement: pairingDisplacement(r.from, r.toOriented, perm) })),
    };
}

// Roadmap 1.8 Stage C: recomputes the timeline's playback layer's
// interpolated render substitute for the CURRENT progress - mirrors
// applyLayerAnimationFrame()'s own time bookkeeping, generalized (phase
// (ii)) from "the one segment" to "find which segment brackets the
// current global time, then apply that segment's own pair + local t" via
// resolveTimelineSegment()/resolveTimelineKeyframeCoords() above. Reuses
// applyLayerConnectionsMorphFrame() (Stage B, still completely
// unmodified) verbatim - a freshly-built {fromConnections, toConnections}
// object, never persisted anywhere, is passed as its `anim` parameter;
// that function only ever reads .fromConnections/.toConnections/
// .morphIds off it, and ensureLayerMorphIds() (called inside)
// regenerates ids purely as a function of the connection COUNT (never
// randomly), so rebuilding this object fresh every call still yields
// byte-identical ids call to call as long as the count hasn't changed -
// the same 'free'-curve seed-stability property phase (i) already
// verified, unaffected by which segment is currently active.
//
// When more than one segment exists, #timeline-status doubles as a
// cheap, free orientation readout ("Segment 2/3 (Layer 2 -> Layer 4)")
// whenever no error is active - reuses the existing status span, no new
// UI element, directly useful for the "which pair am I looking at"
// question a longer sequence raises.
function applyTimelineFrame() {
    if (!timeline) return;
    const totalDuration = totalTimelineDurationMs(timeline);
    let elapsed = timeline.playing ? (millis() - timeline.startTime) : timeline.elapsedMs;
    elapsed = Math.max(0, Math.min(totalDuration, elapsed));
    if (timeline.playing) {
        timeline.elapsedMs = elapsed;
        if (elapsed >= totalDuration) timeline.playing = false;
    }
    const playbackLayer = timeline.playbackLayerIndex !== null ? additionalLayers[timeline.playbackLayerIndex] : null;
    if (!playbackLayer) return; // fewer than 2 keyframes so far - nothing to render yet
    const segment = resolveTimelineSegment(timeline, elapsed);
    if (!segment) return; // defensive - playbackLayerIndex is only ever non-null once a segment exists
    const resolved = resolveTimelineKeyframeCoords(timeline, segment.segmentIndex);
    if (!resolved.ok) {
        playbackLayer._morphNodes = null;
        playbackLayer._morphConnections = null;
        setTimelineStatus(resolved.reason);
        return;
    }
    const segCount = timeline.segmentDurationsMs.length;
    setTimelineStatus(segCount > 1
        ? `Segment ${segment.segmentIndex + 1}/${segCount} (Layer ${timeline.keyframeLayerIds[segment.segmentIndex] + 1} → Layer ${timeline.keyframeLayerIds[segment.segmentIndex + 1] + 1})`
        : '');
    applyLayerConnectionsMorphFrame(playbackLayer, { fromConnections: resolved.from, toConnections: resolved.to }, segment.localT);
}

// Play/Pause toggle for the timeline - mirrors
// toggleActiveLayerAnimationPlayback() exactly (resume-from-elapsedMs,
// play-once-and-restart-from-0-if-already-finished), now against the
// SUM of every segment's own duration rather than one fixed value.
// Visibility was already established once per keyframe, at
// addLayerToTimeline() time, and stays that way for the timeline's
// whole lifetime - Play/Pause/scrub never touch it.
function toggleTimelinePlayback() {
    if (!timeline) return;
    const totalDuration = totalTimelineDurationMs(timeline);
    if (timeline.playing) {
        timeline.elapsedMs = Math.max(0, Math.min(totalDuration, millis() - timeline.startTime));
        timeline.playing = false;
    } else {
        if (timeline.elapsedMs >= totalDuration) timeline.elapsedMs = 0;
        timeline.startTime = millis() - timeline.elapsedMs;
        timeline.playing = true;
    }
    syncAnimationLoopState();
}

// Manual scrub (0..1, over the WHOLE sequence) - mirrors
// setActiveLayerAnimationProgress() exactly: pauses if playing, applies
// the new frame immediately so a drag shows a live preview even while
// noLoop() is active.
function setTimelineProgress(t) {
    if (!timeline) return;
    const totalDuration = totalTimelineDurationMs(timeline);
    timeline.elapsedMs = Math.max(0, Math.min(1, t)) * totalDuration;
    timeline.playing = false;
    syncAnimationLoopState();
    applyTimelineFrame();
}

// Roadmap 1.8 Stage D phase (i): live preview for the pairing editor -
// parks the timeline at t=0.5 of ONE segment (paused, applied
// immediately so it shows even while noLoop() is active), i.e. exactly
// the halfway frame, where a different pairing differs most visibly from
// the endpoints. Every pairing edit and every segment switch calls this,
// so a reorder is always directly visible on the canvas. Reuses the
// timeline's own elapsedMs/applyTimelineFrame() path - no separate
// preview render.
function previewTimelineSegmentMidpoint(segmentIndex) {
    if (!timeline || segmentIndex < 0 || segmentIndex >= timeline.segmentDurationsMs.length) return;
    let acc = 0;
    for (let i = 0; i < segmentIndex; i++) acc += timeline.segmentDurationsMs[i];
    timeline.elapsedMs = acc + timeline.segmentDurationsMs[segmentIndex] / 2;
    timeline.playing = false;
    syncAnimationLoopState();
    applyTimelineFrame();
    if (window.syncTimelineDisplay) window.syncTimelineDisplay();
}

// Roadmap 1.8 Stage D phase (ii): the ONE place a pairing is committed -
// used by both the up/down editor (moveTimelinePairing() below) and the
// "Browse all" list (a click on a row), so picking a pairing from the
// list is by construction the same state change as stepping there with
// the buttons. Validates against the segment's CURRENT line count
// (isValidPairing()), stores a result equal to the default order as null
// so "default" stays a single state, then parks the live preview at
// t=0.5 and refreshes the panel.
function setTimelinePairing(segmentIndex, perm) {
    const info = timelineSegmentInfo(segmentIndex);
    if (!info || !info.ok) return;
    commitTimelineSegmentPairing(segmentIndex, perm, info.flips);
}

// Roadmap 1.8 Stage D phase (iii): flips End line `endIdx` (or sets it
// explicitly when `value` is given) and keeps the current correspondence.
function setTimelineFlip(segmentIndex, endIdx, value) {
    const info = timelineSegmentInfo(segmentIndex);
    if (!info || !info.ok || endIdx < 0 || endIdx >= info.n) return;
    const flips = info.flips.slice();
    flips[endIdx] = value === undefined ? !flips[endIdx] : !!value;
    commitTimelineSegmentPairing(segmentIndex, info.perm, flips);
}

// Roadmap 1.8 Stage D phase (iii): the shared tail of every pairing edit
// (correspondence, per-line flip, or both at once from the n=1 list) -
// validates against the CURRENT line count, stores a default
// correspondence / an all-false flips array as null (so "default" stays
// a single state each), then parks the live preview and refreshes.
function commitTimelineSegmentPairing(segmentIndex, perm, flips, members) {
    const info = timelineSegmentInfo(segmentIndex);
    if (!info || !info.ok) return;
    if (members === undefined) members = info.members; // callers that don't touch member choice keep it
    if (!isValidPairing(perm, info.n) || !isValidFlips(flips, info.n) || !isValidMemberArray(members, info.n)) return;
    timeline.segmentPairings[segmentIndex] = perm.every((j, i) => j === i) ? null : perm.slice();
    if (!timeline.segmentFlips) timeline.segmentFlips = timeline.segmentPairings.map(() => null);
    timeline.segmentFlips[segmentIndex] = flips.some(f => f) ? flips.slice() : null;
    if (!timeline.segmentMembers) timeline.segmentMembers = timeline.segmentPairings.map(() => null);
    timeline.segmentMembers[segmentIndex] = members.some(g => g !== 0) ? members.slice() : null;
    previewTimelineSegmentMidpoint(segmentIndex);
    updateTimelineControls();
    redraw();
}

// Roadmap 1.8 Stage D phase (iv): sets End line `endIdx`'s member choice
// (group element index; 0 = as clicked), keeping correspondence and
// flips. Refused (no state change) for an index outside the End layer's
// group - the number of elements comes from that layer's own grid/mode.
// Step 2 (per-row variant stepper): the optional `flip` (true/false; omitted
// = keep the End line's current flip) lets one call move to any
// (group element, flip) variant of timelineRowVariants(), which spans both
// - the stepper's list is the full deduplicated (element, flip) space of a
// row, not just its elements.
function setTimelineMember(segmentIndex, endIdx, g, flip) {
    const info = timelineSegmentInfo(segmentIndex);
    if (!info || !info.ok || endIdx < 0 || endIdx >= info.n || !Number.isInteger(g) || g < 0) return;
    const r = resolveTimelineKeyframeCoords(timeline, segmentIndex);
    const ge = layerGroupElements(r.layerTo);
    if (g > 0 && (!ge || g >= ge.groupOrder)) return;
    const members = info.members.slice();
    members[endIdx] = g;
    const flips = info.flips.slice();
    if (flip !== undefined) flips[endIdx] = !!flip;
    commitTimelineSegmentPairing(segmentIndex, info.perm, flips, members);
}

// Roadmap 1.8 Stage D phase (i): moves START line `row`'s assigned END
// line up/down by swapping it with its neighbour's (delta -1/+1) - i.e.
// reorders the End list against the fixed Start list. The swapped
// permutation is committed via setTimelinePairing() (perm[i] = End line
// index assigned to Start line i, see isValidPairing()).
function moveTimelinePairing(segmentIndex, row, delta) {
    const info = timelineSegmentInfo(segmentIndex);
    if (!info || !info.ok) return;
    const other = row + delta;
    if (row < 0 || other < 0 || row >= info.n || other >= info.n) return;
    const perm = info.perm.slice();
    [perm[row], perm[other]] = [perm[other], perm[row]];
    setTimelinePairing(segmentIndex, perm);
}
function resetTimelinePairing(segmentIndex) {
    if (!timeline || segmentIndex < 0 || segmentIndex >= timeline.segmentPairings.length) return;
    timeline.segmentPairings[segmentIndex] = null;
    if (timeline.segmentFlips) timeline.segmentFlips[segmentIndex] = null;
    if (timeline.segmentMembers) timeline.segmentMembers[segmentIndex] = null;
    previewTimelineSegmentMidpoint(segmentIndex);
    updateTimelineControls();
    redraw();
}

// Roadmap 1.8 Stage C phase (ii): splices ONE keyframe out of the
// timeline's OWN bookkeeping (keyframeLayerIds/segmentDurationsMs) and
// restores that layer's saved visibility (layer._timelineSavedEnabled,
// see core/state.js) - does NOT touch additionalLayers[] itself, so
// this is safe to call both from removeKeyframeFromTimeline() (the
// layer stays, just leaves the sequence) and from removeLayer() (the
// layer is ALSO about to be spliced out of additionalLayers by its own
// caller, immediately after this runs).
//
// If the removed keyframe was interior (had a segment on both sides),
// those two now-invalid segments collapse into ONE new segment
// (a fresh default duration, not a computed combination of the two
// old ones - simplest, least surprising); if it was the first or last
// keyframe, its own single adjacent segment is simply dropped, nothing
// to merge.
//
// Dropping to exactly one keyframe removes the now-unusable playback
// layer too (the exact symmetric inverse of addLayerToTimeline()'s own
// lazy creation on the SECOND keyframe) - the caller is told via the
// returned index (mirroring phase (i)'s own orphanedPlaybackIndex
// pattern) so it can decide whether/how to splice it out of
// additionalLayers[] itself. Dropping to zero keyframes tears the whole
// timeline down.
function spliceKeyframeOutOfTimeline(layerIndex) {
    if (!timeline) return null;
    const pos = timeline.keyframeLayerIds.indexOf(layerIndex);
    if (pos === -1) return null;
    const layer = additionalLayers[layerIndex];
    if (layer && layer._timelineSavedEnabled !== undefined) {
        layer.enabled = layer._timelineSavedEnabled;
        delete layer._timelineSavedEnabled;
    }
    const segCountBefore = timeline.segmentDurationsMs.length;
    timeline.keyframeLayerIds.splice(pos, 1);
    // segmentPairings (Stage D phase (i)) is spliced in lockstep with
    // segmentDurationsMs - a merged interior segment gets a fresh null
    // (default) pairing, since its two neighbours' pairings referred to
    // keyframes that are no longer adjacent.
    if (pos > 0 && pos < segCountBefore) {
        timeline.segmentDurationsMs.splice(pos - 1, 2, 2000);
        timeline.segmentPairings.splice(pos - 1, 2, null);
        if (timeline.segmentFlips) timeline.segmentFlips.splice(pos - 1, 2, null);
        if (timeline.segmentMembers) timeline.segmentMembers.splice(pos - 1, 2, null);
    } else if (pos === 0 && segCountBefore > 0) {
        timeline.segmentDurationsMs.splice(0, 1);
        timeline.segmentPairings.splice(0, 1);
        if (timeline.segmentFlips) timeline.segmentFlips.splice(0, 1);
        if (timeline.segmentMembers) timeline.segmentMembers.splice(0, 1);
    } else if (pos === segCountBefore && segCountBefore > 0) {
        timeline.segmentDurationsMs.splice(pos - 1, 1);
        timeline.segmentPairings.splice(pos - 1, 1);
        if (timeline.segmentFlips) timeline.segmentFlips.splice(pos - 1, 1);
        if (timeline.segmentMembers) timeline.segmentMembers.splice(pos - 1, 1);
    }

    if (timeline.keyframeLayerIds.length === 0) {
        const orphanedPlaybackIndex = timeline.playbackLayerIndex;
        timeline = null;
        return orphanedPlaybackIndex;
    }
    let orphanedPlaybackIndex = null;
    if (timeline.keyframeLayerIds.length === 1 && timeline.playbackLayerIndex !== null) {
        orphanedPlaybackIndex = timeline.playbackLayerIndex;
        timeline.playbackLayerIndex = null;
    }
    const totalDuration = totalTimelineDurationMs(timeline);
    timeline.elapsedMs = Math.min(timeline.elapsedMs, totalDuration);
    if (timeline.playing && totalDuration === 0) timeline.playing = false;
    return orphanedPlaybackIndex;
}

// Roadmap 1.8 Stage C phase (ii): the keyframe list's own per-entry
// remove action - takes a keyframe OUT of the sequence (restoring its
// layer's visibility, shrinking keyframeLayerIds/segmentDurationsMs)
// without deleting the underlying layer itself, unlike that layer's own
// "x" tab button (removeLayer()). Handles the "dropped to one keyframe"
// case by actually removing the now-orphaned playback layer from
// additionalLayers[] - spliceKeyframeOutOfTimeline() only reports that
// index, this is the one caller-side that owns the actual splice, same
// activeLayer-adjustment logic removeLayer()'s own spliceOne() uses.
function removeKeyframeFromTimeline(layerIndex) {
    if (!timeline) return;
    const orphanedPlaybackIndex = spliceKeyframeOutOfTimeline(layerIndex);
    if (orphanedPlaybackIndex !== null) {
        additionalLayers.splice(orphanedPlaybackIndex, 1);
        if (activeLayer === orphanedPlaybackIndex) {
            activeLayer = 'base';
        } else if (typeof activeLayer === 'number' && activeLayer > orphanedPlaybackIndex) {
            activeLayer -= 1;
        }
        if (timeline) {
            timeline.keyframeLayerIds = timeline.keyframeLayerIds.map(i => i > orphanedPlaybackIndex ? i - 1 : i);
        }
    }
    syncAnimationLoopState();
    applyTimelineFrame();
    renderLayerTabs();
    updateOffsetControls();
    updateTimelineControls();
    redraw();
}

// Explicit "Remove Timeline" action - tears down the WHOLE sequence at
// once (distinct from removeKeyframeFromTimeline()'s one-at-a-time
// removal): restores every keyframe's saved visibility via
// clearTimelineState(), then removes the playback layer (if one had
// been created - a single-keyframe timeline never got that far) via the
// ordinary removeLayer() (safe to call now: timeline is already null,
// so removeLayer()'s own timeline-teardown branch is a no-op for it).
function removeTimelineAction() {
    if (!timeline) return;
    const playbackIndex = timeline.playbackLayerIndex;
    clearTimelineState('');
    if (playbackIndex !== null) removeLayer(playbackIndex);
    renderLayerTabs();
    updateOffsetControls();
    updateTimelineControls();
    redraw();
}

// Roadmap 1.8 Stage C: restores every keyframe layer's saved `enabled`
// state and clears `timeline` to null - the WHOLE-sequence teardown
// (see removeTimelineAction() above, and removeLayer()'s own use when
// the playback layer itself is the one being deleted). Does NOT touch
// additionalLayers[] itself. Already fully N-agnostic (phase (i) never
// needed to change here) - `timeline.keyframeLayerIds.forEach()` already
// walks however many keyframes exist.
function clearTimelineState(statusMessage) {
    if (!timeline) return;
    timeline.keyframeLayerIds.forEach(i => {
        const layer = additionalLayers[i];
        if (layer && layer._timelineSavedEnabled !== undefined) {
            layer.enabled = layer._timelineSavedEnabled;
            delete layer._timelineSavedEnabled;
        }
    });
    timeline = null;
    syncAnimationLoopState(); // a playing timeline being torn down must not leave loop() running for nothing
    if (statusMessage !== undefined) setTimelineStatus(statusMessage);
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
// Roadmap 1.12 stage 5 (symmetryMode axis) part 2: mode now reads the
// ACTIVE sheet's own symmetryMode (activeGridOverride()'s symmetryMode
// field, falling back to the global for the base) the same way shape
// does directly above - UNLIKE the shape case, this one WAS an
// observable bug (design session finding): a per-layer symmetryMode
// edit doesn't clear that layer's connections the way a shape change
// does (Phase 1 - it's a pure render-time parameter, see
// setActiveLayerRotation()'s own precedent), so conns alone wouldn't
// change and this cache would keep showing the stale pre-edit name.
function patternNameSignature() {
    const gridOverride = activeGridOverride();
    const activeShape = gridOverride ? gridOverride.shape : currentShape;
    const activeMode = gridOverride ? gridOverride.symmetryMode : symmetryMode;
    return JSON.stringify({ shape: activeShape, mode: activeMode, activeLayer, conns: activeConnections() });
}

// ----------------- FACE COLORS PANEL (Group D Phase 3) -----------------
// The UI over core/facecolor.js + core/color.js: rule picker, one k/c stepper
// per rule axis, a swatch row per face trail (hover outlines the trail on the
// canvas; a per-trail stepper picks another slot of the SAME generated
// series), and Reset colors. Everything acts on the ACTIVE sheet's own store
// and palette state (faceAssignmentsFor()/facePaletteFor()), so each tab keeps
// independent colors. The panel exists only while that sheet's face fill is on.
//
// Not built here (Phase 2's deferred decisions, deliberately): orphan cleanup,
// split/merge inheritance, stub-vertex key stability. In particular a trail
// whose geometry an edit changed comes back UNASSIGNED (default color, no
// explanation) - the row just says "default".
let faceColorsSignature = null;

// Why the active sheet draws no face fills right now, or null when it does.
// Mirrors core/tiling.js's computeLayerCellFaces() guard (enabled, showFaces,
// same scale, rotation 0) - duplicated on purpose so those guards stay
// untouched; a base sheet only needs straight lines (computeCellFaces()).
function faceFillsUnavailableReason() {
    if (curveType.kind !== 'straight') return 'Face fills need straight lines (curve/free mode is on).';
    if (activeLayer === 'base') return null;
    const l = additionalLayers[activeLayer];
    if (!l.enabled) return 'This layer is hidden.';
    if (l.shapeSizeFactor !== shapeSizeFactor || (l.rotation || 0) !== 0) return 'Face fills are not drawn for this layer (its size or rotation differs from the base sheet).';
    return null;
}

function faceColorsGrid() {
    return activeLayer === 'base'
        ? { gridNodes: nodes, conns: connections }
        : { gridNodes: additionalLayers[activeLayer].nodes, conns: additionalLayers[activeLayer].connections };
}

function faceColorsSig() {
    const l = activeLayer === 'base' ? null : additionalLayers[activeLayer];
    return JSON.stringify({
        sheet: activeLayer, conns: faceColorsGrid().conns, shape: currentShape, mode: symmetryMode, n: faceColorsGrid().gridNodes.length,
        layer: l && [l.enabled, l.shapeSizeFactor, l.rotation], size: shapeSizeFactor, curve: curveType.kind,
        store: faceAssignmentsFor(activeLayer).size
    });
}

// Called once per draw(): shows/hides the panel with the active sheet's face
// fill and rebuilds it only when what it lists could have changed.
function updateFaceColorsPanel() {
    const groupEl = document.getElementById('face-colors-group');
    if (!groupEl) return;
    const visible = activeShowFaces();
    groupEl.hidden = !visible;
    if (!visible) { faceColorsSignature = null; faceHover = null; return; }
    if (faceColorsSig() !== faceColorsSignature) renderFaceColorsPanel();
}

function faceColorsAxisValue(rule, axis, k) {
    const sys = OSTWALD_REFERENCE_SYSTEM;
    if (axis.id === 'hue') return sys.hues[k].name;
    if (axis.id === 'level') return rule.id === 'tetrad' ? sys.fullColorLevels.pairs[k].join(' / ') : sys.grayScale.letters[k];
    return '';
}

function faceColorsStepper(k, c, title, onStep) {
    const wrap = document.createElement('span');
    wrap.className = 'pairing-variant';
    const mk = (txt, delta) => {
        const b = document.createElement('button');
        b.className = 'layer-btn pairing-move-btn';
        b.textContent = txt;
        b.title = title;
        b.addEventListener('click', () => onStep(delta));
        return b;
    };
    const cnt = document.createElement('span');
    cnt.className = 'pairing-variant-count';
    cnt.textContent = `${k + 1}/${c}`;
    cnt.dataset.k = String(k + 1);
    cnt.dataset.c = String(c);
    wrap.appendChild(mk('◀', -1));
    wrap.appendChild(cnt);
    wrap.appendChild(mk('▶', 1));
    return wrap;
}

// (Re)colors every trail of the active sheet from its palette, then refreshes.
function applyFaceColorsPalette() {
    const { gridNodes, conns } = faceColorsGrid();
    const group = sheetGroupElements(gridNodes);
    if (group) {
        const trails = computeFaceTrails(computeCellFaces(conns, gridNodes), group);
        applyPaletteToTrails(faceAssignmentsFor(activeLayer), trails, facePaletteFor(activeLayer));
    }
    renderFaceColorsPanel();
    redraw();
}

function renderFaceColorsPanel() {
    const sheet = activeLayer;
    const statusEl = document.getElementById('face-colors-status');
    const ruleSel = document.getElementById('face-colors-rule');
    const axesEl = document.getElementById('face-colors-axes');
    const noteEl = document.getElementById('face-colors-note');
    const listEl = document.getElementById('face-colors-list');
    const resetBtn = document.getElementById('btn-face-colors-reset');
    const unassignedEl = document.getElementById('face-colors-unassigned');
    const unassignedText = document.getElementById('face-colors-unassigned-text');
    if (!statusEl || !ruleSel || !axesEl || !noteEl || !listEl || !resetBtn || !unassignedEl || !unassignedText) return;
    unassignedEl.hidden = true;
    faceHover = null; // the rows being replaced may have been hovered; restored below if the pointer is still on one
    axesEl.innerHTML = ''; listEl.innerHTML = ''; noteEl.textContent = '';

    const store = faceAssignmentsFor(sheet);
    const palette = facePaletteFor(sheet);
    const reason = faceFillsUnavailableReason();
    const { gridNodes, conns } = faceColorsGrid();
    const group = reason ? null : sheetGroupElements(gridNodes);
    const trails = group ? computeFaceTrails(computeCellFaces(conns, gridNodes, store), group) : [];

    resetBtn.disabled = store.size === 0 && !palette.ruleId;
    ruleSel.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = ''; ph.textContent = 'Choose a harmony rule…';
    ruleSel.appendChild(ph);
    listHarmonyRules().forEach(r => {
        const o = document.createElement('option');
        o.value = r.id;
        o.textContent = r.label + (r.verified === false ? ' – unverified' : '');
        ruleSel.appendChild(o);
    });
    ruleSel.value = palette.ruleId || '';
    ruleSel.disabled = trails.length === 0;

    if (reason || !group) { statusEl.textContent = reason || 'Face colors are unavailable for this grid.'; faceColorsSignature = faceColorsSig(); return; }
    statusEl.textContent = trails.length === 0
        ? 'No faces yet — draw connections that enclose regions.'
        : `${trails.length} face trail${trails.length === 1 ? '' : 's'} (all symmetry copies of a face share one color)`;

    const rule = palette.ruleId ? getHarmonyRule(palette.ruleId) : null;
    // Uncolored trails while a rule is applied (new regions an edit created, anything reconciliation
    // could not hand a color to): say so, and offer the explicit fill - never an automatic repaint.
    if (rule) {
        const missing = unassignedTrails(store, trails).length;
        if (missing) {
            unassignedText.textContent = `${missing} of ${trails.length} trail${trails.length === 1 ? '' : 's'} ${missing === 1 ? 'has' : 'have'} no palette color (e.g. new regions).`;
            unassignedEl.hidden = false;
        }
    }
    // The series in force (frozen at the last full application - see core/facecolor.js): per-trail steppers
    // work inside it, so an edit that changes the trail count does not change what a stepper offers.
    const seriesSlots = palette.slots || trails.length;
    if (rule) {
        harmonyRuleParams(rule, OSTWALD_REFERENCE_SYSTEM).forEach((axis, a) => {
            const row = document.createElement('div');
            row.className = 'fc-axis';
            const lab = document.createElement('span');
            lab.className = 'fc-axis-label';
            lab.textContent = axis.label;
            const val = document.createElement('span');
            val.className = 'fc-axis-value';
            val.textContent = faceColorsAxisValue(rule, axis, palette.idx[a]);
            row.appendChild(lab);
            row.appendChild(faceColorsStepper(palette.idx[a], axis.count, `Step ${axis.label}`, delta => {
                palette.idx[a] = (palette.idx[a] + delta + axis.count) % axis.count;
                applyFaceColorsPalette();
            }));
            row.appendChild(val);
            axesEl.appendChild(row);
        });
        noteEl.textContent = (rule.verified === false ? 'Unverified definition. ' : '') + (rule.note || '');
    }

    trails.forEach((t, i) => {
        const row = document.createElement('div');
        row.className = 'fc-row';
        const sw = document.createElement('span');
        sw.className = 'fc-swatch';
        sw.style.background = t.color;
        const a = store.get(t.key);
        const lab = document.createElement('span');
        lab.className = 'fc-label';
        lab.textContent = `Trail ${i + 1} · ${t.faceCount} face${t.faceCount === 1 ? '' : 's'}`;
        row.appendChild(sw);
        row.appendChild(lab);
        if (!a) { const d = document.createElement('span'); d.className = 'fc-default'; d.textContent = 'default'; row.appendChild(d); }
        if (rule) {
            // A stepper writes ONLY its own trail (assignTrailSlot()): never a re-run of the rule over the
            // others, which would erase the colors edits handed on. An uncolored trail shows a dash and takes
            // the first (or last) slot of the series on its first click.
            const slot = (a && a.rule === rule.id && a.params && Number.isInteger(a.params.slot) && a.params.slot < seriesSlots) ? a.params.slot : null;
            const stepper = faceColorsStepper(slot === null ? 0 : slot, seriesSlots, 'Pick another color of this series for this trail', delta => {
                const next = slot === null ? (delta > 0 ? 0 : seriesSlots - 1) : (slot + delta + seriesSlots) % seriesSlots;
                assignTrailSlot(store, palette, t.key, next, seriesSlots);
                renderFaceColorsPanel();
                redraw();
            });
            if (slot === null) stepper.querySelector('.pairing-variant-count').textContent = `\u2013/${seriesSlots}`;
            row.appendChild(stepper);
        }
        row.dataset.key = t.key;
        row.addEventListener('mouseenter', () => { faceHover = { sheet, key: t.key }; redraw(); });
        row.addEventListener('mouseleave', () => { if (faceHover && faceHover.key === t.key) { faceHover = null; redraw(); } });
        listEl.appendChild(row);
        if (row.matches(':hover')) faceHover = { sheet, key: t.key };
    });
    faceColorsSignature = faceColorsSig();
}

function initFaceColorsPanel() {
    const ruleSel = document.getElementById('face-colors-rule');
    const resetBtn = document.getElementById('btn-face-colors-reset');
    if (ruleSel) ruleSel.addEventListener('change', () => {
        const palette = facePaletteFor(activeLayer);
        if (!ruleSel.value) { resetFaceColors(activeLayer); renderFaceColorsPanel(); redraw(); return; }
        palette.ruleId = ruleSel.value;
        // hue axis starts at the first hue, level axes at their middle - the lightest levels
        // (gray letter 'a') are nearly white and would make a first application look like "nothing happened"
        palette.idx = harmonyRuleParams(getHarmonyRule(ruleSel.value), OSTWALD_REFERENCE_SYSTEM).map(ax => ax.id === 'hue' ? 0 : ax.count >> 1);
        palette.overrides = new Map(); // another rule = another series: old slot picks would mean something else
        applyFaceColorsPalette();
    });
    if (resetBtn) resetBtn.addEventListener('click', () => { resetFaceColors(activeLayer); renderFaceColorsPanel(); redraw(); });
    const spreadBtn = document.getElementById('btn-face-colors-spread');
    if (spreadBtn) spreadBtn.addEventListener('click', () => {
        const { gridNodes, conns } = faceColorsGrid();
        const group = sheetGroupElements(gridNodes), store = faceAssignmentsFor(activeLayer);
        if (group) spreadPaletteToUnassigned(store, computeFaceTrails(computeCellFaces(conns, gridNodes, store), group), facePaletteFor(activeLayer));
        renderFaceColorsPanel();
        redraw();
    });
    const listEl = document.getElementById('face-colors-list');
    if (listEl) listEl.addEventListener('mouseleave', () => { if (faceHover) { faceHover = null; redraw(); } });
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
        // Roadmap 1.12 stage 5 (symmetryMode axis) part 2: gridOverride's
        // own .symmetryMode field (correctly undefined for the base
        // sheet, falling through to computeThemeLineName()'s own global-
        // symmetryMode default there) threaded through as the mode
        // argument, replacing the bare `undefined` this call previously
        // always passed regardless of activeLayer - the design session's
        // own finding: a layer's displayed pattern name was silently
        // computed under the BASE's symmetryMode, not its own.
        const gridOverride = activeGridOverride();
        patternNameCacheValue = computeThemeLineName(activeConnections(), gridOverride && gridOverride.symmetryMode, gridOverride, gridOverride && gridOverride.shape);
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
// Roadmap 1.12 stage 5 (symmetryMode axis) part 2: symmetryMode included
// per layer now too, mirroring offsetX/offsetY above - core/faces.js's
// collectCrossLayerSegments() (via _planCrossLayerNeighborhood()) needs
// it to gather THIS layer's own segments under its own symmetryMode,
// not the base's (design session's flagged highest-risk fix).
function buildCrossLayerInput() {
    const baseConn = connections.filter(c => c.length === 2);
    const layers = additionalLayers
        .map((layer, i) => ({
            sheetId: i,
            connections: layer.connections.filter(c => c.length === 2),
            offsetX: layer.offsetX,
            offsetY: layer.offsetY,
            symmetryMode: layer.symmetryMode,
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
