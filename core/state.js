/**
 * core/state.js
 * Shared mutable state for World of Forms Generator, plus the two
 * functions most tightly coupled to it (rebuildGrid, toTileLocal). Part
 * of the portable "core" module set (see CLAUDE.md) - read/written by
 * every other core/ module and by sketch.js, but doesn't itself know
 * about any UI control; sketch.js is what wires DOM inputs to these
 * variables.
 */

// ----------------- GLOBAL STATE ---------------------------------
let canvasW = 600;
let canvasH = 600; // keep square

let shapeSizeFactor = 5; // 1..9, adjustable via #shape-size-input
// Task 060 (G5a): gridSpec is the ONE writable truth of the base grid (core/forms.js GridSpec). nodeCount is its DERIVED legacy projection
// (core/tiling.js and the legacy fassade read it); projectGridSpec() below is the only place that writes it.
let gridSpec = { shape: 'triangle', ordnung: 2, lage: 1 };
let nodeCount = 3;       // DERIVED from gridSpec (projectGridSpec), never written elsewhere
// Roadmap 1.4-A: curveType replaces the old bare curveAmount number
// (core/curves.js's curveType struct - kind/fold/symmetric/leaning/
// strength). Still a single global shared by every sheet, same
// rationale as symmetryMode below (a plate-wide stylistic choice, not
// a per-connection property - see core/curves.js's own module
// docblock). The toggle button (#btn-toggle-curve) still just flips
// between straight and one fixed curve style for now - 1.4-B is what
// exposes fold/symmetric/leaning/strength as real UI controls.
let curveType = { kind: 'straight' };

let symmetryMode = "rotation_reflection6"; // Roadmap 1.11: initial default, now driven by sketch.js's Spiegeling/Drehling + fold button group (index.html) - matches this same value, so reactivating the control changed nothing about the default starting pattern. Was a raw <select id="symmetry-dropdown"> removed from the UI in an earlier flattening pass (commit 33411895); that markup is gone for good, not reintroduced - see sketch.js's own button-group wiring for the real control.
let lineColor = "#000000"; // fixed default - #line-color-picker removed from UI, logic below stays wired for later reuse
let showNodes = true;
// Task 024: the line style. visible=false: drawCurvedBezier() (core/curves.js, the single drawing sink) emits nothing to the canvas or the SVG
// collector (the segment collector stays untouched, so face detection never sees the switch); weight = strokeWeight of a line, LINE_WEIGHT.def (2) is
// what drawConnectionWithSymmetry() and the morph render always set. Session: settings.lineStyle, written only when it differs from the default.
const LINE_WEIGHT = Object.freeze({ min: 0.5, max: 8, step: 0.5, def: 2 });
let lineStyle = { visible: true, weight: LINE_WEIGHT.def };
let currentShape = 'triangle';
let freeEndpointsEnabled = false; // toggled via #btn-toggle-free-endpoints

// Center tile geometry (absolute coordinates)
let outerCorners = [];
let centroid = { x: 0, y: 0 };
let nodes = [];
let connections = [];
let redoStack = [];

// Roadmap 1.9 (generalizing 1.3(b)'s single overlay sheet): zero or
// more additional connection sets ("sheets") sharing the same grid/
// nodes as the base sheet, each rendered as its own tessellation pass
// offset by its own (offsetX, offsetY) relative to the base grid -
// see core/tiling.js. The base sheet (connections/redoStack above)
// stays structurally special - always present, always enabled, offset
// (0,0) - rather than being layers[0] in a unified array; see the 1.9
// design session for why (mainly: the export schema has to keep the
// base sheet's edges/adjacency at the top level for backward
// compatibility regardless of internal representation, so a unified
// model would need to unwrap it right back out anyway).
//
// Each entry: { connections, redoStack, offsetX, offsetY, enabled }.
// No cap enforced here - see the 1.9 design session for why (a plain
// array costs nothing to leave uncapped; the UI is what practically
// targets 4 total sheets = base + 3 additional). offsetX/offsetY are
// independent per layer relative to the base grid, not chained.
let additionalLayers = [];
// Roadmap 1.10a / Group D Phase 2: the BASE sheet's face-color assignments
// (core/facecolor.js) - trail key -> {hue, w, s, rule, params}. Keyed by
// grid geometry, so reset whenever the grid itself is rebuilt (below). An
// additional layer's own store lives on the layer object (layer.faceAssignments,
// created lazily by faceAssignmentsFor()), so it follows the layer.
let baseFaceAssignments = new Map();
// Group D Phase 3: the base sheet's palette state (rule, axis indices, per-
// trail slot overrides - see core/facecolor.js newFacePalette()); null =
// fresh, created lazily by facePaletteFor(). Reset with the grid, like the
// store. faceHover = {sheet, key} while a Face Colors swatch row is hovered
// (drives the on-canvas outline), else null.
let baseFacePalette = null;
// Group D Phase B2: the base sheet's Farborgel anchor (core/facecolor.js
// anchorFor()/newFaceAnchor()) - {hueIndex: 1-24, registerIndex: 0-27 |
// null}, Farborgel's own 1-based hue convention (converted to core/color.js's
// 0-based index only at the point of consumption, not here). null = fresh,
// created lazily by anchorFor(), exactly like baseFacePalette above. Reset
// with the grid, like the palette and the store.
let baseFaceAnchor = null;
// Group D Phase B4 follow-up: which of the 7 harmony types (2/3/4/W/B/S/V) was last applied to the
// base sheet via ui-farbe.js's applyHarmony() - null until one has been (or after resetFaceColors()/
// switching to the old rule system - core/facecolor.js). Read by ui-farbe.js's anchor-change handlers
// (Kreis/Dreieck/Register, the hue/register steppers) to decide whether an anchor change should
// automatically re-paint with this type, matching the old rule engine's always-live feel. Same
// lazy/reset-with-the-grid lifecycle as baseFaceAnchor above; a layer's own lives on the layer object
// (core/facecolor.js's lastHarmonyTypeFor()/setLastHarmonyTypeFor()).
let baseLastHarmonyType = null;
// Farborgel sub-page P3: the HarmonySelection a Farborgel-COMPOSED harmony was applied from (manual edits,
// compounds - nothing that buildHarmonySelection(anchor, type) could regenerate), kept so a later strategy
// change can reapply it. Only meaningful while baseLastHarmonyType === 'custom'
// (core/facecolor.js's CUSTOM_HARMONY_TYPE); same lazy/reset-with-the-grid lifecycle as baseLastHarmonyType,
// and a layer's own lives on the layer object (core/facecolor.js's lastSelectionFor()/setLastSelectionFor()).
let baseLastSelection = null;
// Phase B-Farbstrategien: which distribution strategy (core/farborgel-bridge.js's
// DISTRIBUTION_STRATEGIES - 'cyclic'/'area'/'symmetry'/'rings') the base sheet's last harmony
// application used - null (falls back to 'cyclic', today's default) until one has been chosen
// via ui-farbe.js's strategy stepper. Same lazy/reset-with-the-grid lifecycle as
// baseLastHarmonyType above; a layer's own lives on the layer object
// (core/facecolor.js's distributionStrategyFor()/setDistributionStrategyFor()).
let baseDistributionStrategy = null;
let faceHover = null;
// The trail the chip view has SELECTED (ui-phone-chips.js, through window.setFaceSelected in sketch.js): {sheet, key} or null. Its own slot, never written by the hover handlers; the hover wins on its own
// sheet while both are set (core/facecolor.js faceHighlightKeyFor()).
let faceSelected = null;
let activeLayer = 'base'; // 'base' | integer index into additionalLayers - which sheet mousePressed()/addRandomConnection()/undo/redo/clear target

// Roadmap 1.8 Stage C (persistent-layer timeline, superseding the
// ephemeral per-layer capture design's earlier keyframe model for this
// exact use case): null unless at least one of additionalLayers[] has
// been designated a keyframe via sketch.js's addLayerToTimeline().
// Deliberately a TOP-LEVEL concept, not nested inside any one layer's
// own `animation` field the way Stage A/B's per-layer transform/
// connections animation is - a transition spanning multiple independent,
// persistent, still-editable layers has no single layer to belong to.
//
// Shape: { keyframeLayerIds, playbackLayerIndex, segmentDurationsMs,
// elapsedMs, startTime, playing }.
//
// Roadmap 1.8 Stage C phase (ii): generalized from phase (i)'s fixed
// two named keyframes (keyframeLayerIds: [idA, idB]) to an ORDERED
// ARRAY of any length >= 1 - keyframeLayerIds: [id0, id1, ..., idN-1].
// A single entry (just-started, not yet playable) is a valid, real
// state, not an edge case to special-case away - see addLayerToTimeline()
// (sketch.js) for why the playback layer is created LAZILY, only once a
// second keyframe makes a real segment possible.
//
// segmentDurationsMs is a PARALLEL array, one entry per SEGMENT (length
// = keyframeLayerIds.length - 1, i.e. segmentDurationsMs[i] is the
// duration of the transition from keyframeLayerIds[i] to
// keyframeLayerIds[i+1]) - each segment's own FIXED duration, captured
// once when that segment is created, not derived by dividing one total
// duration evenly (design session point 2) - see
// totalTimelineDurationMs()/resolveTimelineSegment() (sketch.js) for how
// play/pause/scrub and the per-frame interpolation both consume this.
//
// playbackLayerIndex is null until the SECOND keyframe is added (no
// segment exists yet with only one keyframe, so there is nothing to
// interpolate and no reason to have created the render-substitute
// layer) - see addLayerToTimeline()'s own comment for the lazy-creation
// reasoning, and spliceKeyframeOutOfTimeline()'s own comment for the
// symmetric lazy-removal case (dropping back to a single keyframe
// removes the now-unusable playback layer again).
//
// A keyframe layer's own pre-timeline `enabled` value is saved directly
// on that layer object itself (layer._timelineSavedEnabled), not in a
// field here - deliberately NOT indexed by layer array position (unlike
// keyframeLayerIds itself), since a plain {index: value} map would need
// re-keying on every single removeLayer() splice once more than two
// keyframes can exist; a property living on the layer object travels
// with it regardless of its current array position, sidestepping that
// entirely.
//
// Cleared (not just left dangling) by rebuildGrid()/
// rebuildGridFromConstruction() below, same as additionalLayers itself -
// a base-level shape/order change already unconditionally discards every
// layer, so any timeline referencing them by index is equally moot.
let timeline = null;

// When set to an array, drawCurvedBezier() appends SVG path data to it
// instead of drawing to the canvas (see exportSVG()). This lets the SVG
// export reuse drawTessellation()/drawConnectionWithSymmetry() exactly
// as-is - same geometry, same symmetry rules, no separate/duplicated
// implementation that could drift out of sync with the on-screen render.
let svgPathCollector = null;

// Roadmap 1.10a: when set to an array, drawCurvedBezier() appends a raw
// {x1,y1,x2,y2} straight-chord segment to it instead of drawing (see
// core/faces.js's collectCellSegments()) - a third collector mode next
// to svgPathCollector, same precedented pattern, so face-detection's
// input can never drift from what drawConnectionWithSymmetry() actually
// produces. Always the straight p1->p2 chord regardless of curveType
// - face-detection is explicitly straight-line-only for v1 (curved
// intersection math is real extra work, deferred; the UI toggle that
// triggers this collector is mutually exclusive with the curve toggle,
// so this simplification is never reached with curveType.kind!=='straight'
// in practice, but the collector itself doesn't rely on that to be correct).
let segmentCollector = null;

// Roadmap 1.10a: whether to render symmetry-orbit-colored face fills
// for the BASE sheet, computed by core/faces.js's computeCellFaces()
// and drawn behind the line/node drawing by core/tiling.js's tile*()
// functions (see drawFaceFillsAtTile()). Each additional layer gets its
// own independent showFaces field instead (see addLayer() in
// sketch.js) - "pro Blatt/Sheet unabhängig", no cross-layer fill, per
// the 1.10 design session's point 7 - toggled via sketch.js's
// #btn-toggle-faces button, contextual to whichever sheet tab is
// active (activeShowFaces()/setActiveShowFaces()). Kept mutually
// exclusive with curveType.kind!=='straight' by that same button's
// handler; computeCellFaces() also defends against that combination directly.
let showFaces = false;

// Roadmap 1.6 / Group E (core/netwarp.js): the base sheet's net transform spec
// ({x: {kind, w, alternate}, y: same-shape | 'same'}), null = regular net. Phase 1 has no UI;
// set from code/tests. activeNetWarp is the READY warp drawTessellation() installs for the
// duration of one redraw (null otherwise) and drawCurvedBezier() - the single drawing sink -
// applies to every segment endpoint. Never persisted: derived from the spec per redraw.
let baseNetTransform = null;
// NO UI ENTRY POINT (as of the removal of its controls): the standalone net animation below is functional and tested but unreachable from the UI - superseded
// by the Timeline-coupled net animation (timeline.netStates); kept on purpose, see sketch.js "NET ANIMATION". It stays null unless something sets it.
// Net-warp animation (Group E x 1.8 Stage A pattern): {from, to, durationMs, elapsedMs, playing, startTime, live, t}. STRUCTURALLY SEPARATE
// from baseNetTransform (the AUTHOR spec the controls read and write): the frame being shown is computed from it by netTransformNow()
// (core/netwarp.js) and never written back. `live` = the animation frame, not the author net, is what is drawn (while playing, or
// paused/scrubbed until the next author edit); `t` = progress 0..1 (set by sketch.js's applyNetAnimationFrame(), core/* has no clock).
let baseNetAnimation = null;
let activeNetWarp = null;

// Roadmap 1.2-C: null unless the CURRENT net came from
// rebuildGridFromConstruction() (below), in which case {p, q, side, n} -
// the exact inputs that reproduce this net's geometry, exported as
// meta.altNetSeed (core/export.js) for construction-history
// reproducibility. Reset to null by rebuildGrid() (an ordinary shape/
// order change means the current net is no longer an alternative-net
// construction), so switching shapes away from one via the existing
// shape buttons correctly clears this too - no separate reset path
// needed (see rebuildGrid() below).
let altNetSeed = null;

// Spatial morph (morph stage b): the PARAMETERS of the static, lines-only spatial morph, one project-level object (not per layer, not per segment):
// { enabled: false, mode: 'linear' | 'radial' | 'bilinear', angleDeg: any finite number (used by linear only) }. Defaults off / linear / 0
// (core/spatial-morph.js spatialMorphDefaults() is the same value; tools/session pins them equal). Saved by core/session.js only when it differs from the
// defaults and restored by core/session-apply.js; nothing draws from it yet (the render hook is a later stage). Replaced as a whole, never edited in place.
let spatialMorph = { enabled: false, mode: 'linear', angleDeg: 0 };

// ----------------- STATE HELPERS ---------------------------------
// Roadmap 1.12 stage 3: rotationDeg (default 0, byte-identical to
// before this stage for every pre-existing call site) rotates the
// node's centroid-relative delta vector by this layer's own rotation,
// BEFORE flip180's sign-flip and before placing it at tileC - reads the
// GLOBAL centroid always, still correct per stage 1's own "shared
// centroid" invariant (a layer's rotation is a rotation about that same
// shared point, never moving it). Composed with core/tiling.js's own
// rotation of that layer's v1/v2 (see each tile*() function's own
// comment), this reconstructs a true rigid rotation of the whole
// tessellation: both the TILE POSITIONS and the CONTENT within each
// tile rotate by the same angle about the same center.
function toTileLocal(n, tileC, flip180, rotationDeg = 0) {
    // shift node by removing center centroid, place at tile centroid; optional 180° flip
    let x = n.x - centroid.x;
    let y = n.y - centroid.y;
    if (flip180) { x = -x; y = -y; }
    if (rotationDeg) {
        const rad = radians(rotationDeg);
        const rx = x * cos(rad) - y * sin(rad);
        const ry = x * sin(rad) + y * cos(rad);
        x = rx; y = ry;
    }
    return { x: tileC.x + x, y: tileC.y + y };
}

// Task 057 (G2): bumped by every rebuild of the base grid (rebuildGrid, setGrid, rebuildGridFromConstruction) so later consumers
// can tell a stale derived value from a current one. Nothing reads it yet.
let gridRevision = 0;

// Task 060 (G5a): the ONLY write of nodeCount. Validates first (throws before any state is touched), then sets gridSpec and its derived
// legacy projection together. Does not rebuild and does not touch gridRevision (session-apply and setup use it without a rebuild).
function projectGridSpec(spec) {
    const c = toLegacy(spec);
    gridSpec = spec;
    nodeCount = c;
}

// Legacy signature kept: the grid of `shape` at the order held by gridSpec (a different shape keeps the legacy count, as nodeCount did).
function rebuildGrid(shape) {
    // built first: an invalid shape throws before any state is touched
    const spec = gridSpec.shape === shape ? gridSpec : gridSpecOnShape(gridSpec, shape);   // task 068b: lage 2 keeps its lage (ordnung taken over, clamped); lage 1 as before
    const grid = buildGrid(spec, { sizeFactor: shapeSizeFactor, canvasW, canvasH });
    projectGridSpec(spec);
    connections = [];
    additionalLayers = [];
    baseFaceAssignments = new Map(); // keys are geometry of the OLD grid
    baseFacePalette = null; baseFaceAnchor = null; baseLastHarmonyType = null; baseLastSelection = null; baseDistributionStrategy = null; faceHover = null;
    activeLayer = 'base'; // an active additional-layer index would otherwise dangle once the array is cleared
    timeline = null; // Roadmap 1.8 Stage C: its keyframeLayerIds/playbackLayerIndex would dangle the same way activeLayer would
    baseNetAnimation = null; // the captured Start/End nets belong to the old grid setup (Shape Size decides what a Field is)
    altNetSeed = null; // Roadmap 1.2-C: an ordinary shape/order rebuild is never an alt-net construction

    nodes = grid.nodes; centroid = grid.centroid; outerCorners = grid.outerCorners;
    gridRevision++;
}

// Task 057 (G2): the GridSpec entry point. Validates, sets currentShape and the derived nodeCount, rebuilds like rebuildGrid().
function setGrid(spec) {
    const v = validateGridSpec(spec);
    if (!v.ok) throw new Error('setGrid: ' + v.error);
    currentShape = spec.shape;
    projectGridSpec(spec);
    rebuildGrid(spec.shape);
    if (typeof gridControlsSync === 'function') gridControlsSync();   // task 068b: the page's inputs/buttons follow (set by sketch.js setup)
}

// Task 068b: the lage of the BASE grid (no UI yet: 068c). Like a shape change it clears connections, layers and the timeline (rebuildGrid) and the redo stack, and bumps gridRevision.
// -> { ok: true, changed } | { ok: false, reason: 'invalid-lage' | 'switch-off' | 'ordnung-limit', limit? }; never throws, nothing is touched on a refusal.
function setBaseLage(lage) {
    if (lage !== 1 && lage !== 2) return { ok: false, reason: 'invalid-lage' };
    if (gridSpec.lage === lage) return { ok: true, changed: false };
    if (lage === 2) {
        if (!lage2SwitchOn()) return { ok: false, reason: 'switch-off' };
        if (gridSpec.ordnung > maxOrdnungFor(gridSpec.shape, 2)) return { ok: false, reason: 'ordnung-limit', limit: maxOrdnungFor(gridSpec.shape, 2) };
    }
    setGrid({ shape: gridSpec.shape, ordnung: gridSpec.ordnung, lage });
    redoStack = [];
    return { ok: true, changed: true };
}
// Task 068b: the lage of ONE layer (no UI yet). Clears that layer's lines and redo stack like a shape change and rebuilds its grid; refused for a timeline keyframe / playback layer.
// -> { ok: true, changed } | { ok: false, reason: 'unknown-layer' | 'invalid-lage' | 'in-timeline' | 'switch-off' | 'ordnung-limit', limit? }
function setLayerLage(layer, lage) {
    const idx = additionalLayers.indexOf(layer);
    if (idx < 0) return { ok: false, reason: 'unknown-layer' };
    if (lage !== 1 && lage !== 2) return { ok: false, reason: 'invalid-lage' };
    const spec = layerGridSpecOf(layer);
    if (spec.lage === lage) return { ok: true, changed: false };
    if (timeline && (timeline.keyframeLayerIds.indexOf(idx) >= 0 || timeline.playbackLayerIndex === idx)) return { ok: false, reason: 'in-timeline' };
    if (lage === 2) {
        if (!lage2SwitchOn()) return { ok: false, reason: 'switch-off' };
        if (spec.ordnung > maxOrdnungFor(layer.shape, 2)) return { ok: false, reason: 'ordnung-limit', limit: maxOrdnungFor(layer.shape, 2) };
    }
    projectLayerGridSpec(layer, { shape: spec.shape, ordnung: spec.ordnung, lage });
    layer.connections = [];
    layer.redoStack = [];
    const g = layerGridForSpec(outerCorners, centroid, currentShape, shapeSizeFactor, layer.shapeSizeFactor, layer.gridSpec, layer.shape, canvasW, canvasH);
    layer.nodes = g.nodes; layer.centroid = g.centroid; layer.outerCorners = g.outerCorners;
    if (typeof gridControlsSync === 'function') gridControlsSync();
    return { ok: true, changed: true };
}

// Roadmap 1.2-C: the "combiner" 1.2-A's own design deliberately held
// off building (per explicit instruction at the time - "not part of the
// task, stays for a later phase, if needed at all") - this is that later
// phase. Ties completeEdgeToRegularPolygon() (1.2-A) to the matching
// _subdivide*Interior() helper (also 1.2-A) by n, producing the same
// {nodes, centroid, outerCorners} shape the three default builders
// return, so every downstream consumer (tiling, symmetry, faces,
// orbits, export) works unchanged - none of them care HOW outerCorners/
// centroid/nodes were produced, only that they describe a real regular-
// polygon net consistently (verified true throughout 1.2-B/1.2-C).
//
// completeEdgeToRegularPolygon()'s own vertices[0..n-1] are already in
// correct cyclic (each-adjacent-to-the-next) order - rotating a regular
// n-gon's own vertex by 360/n around its center always lands exactly on
// the next vertex around the polygon - so they can be used directly as
// outerCorners without reordering, matching each _subdivide*Interior()
// helper's own adjacency convention (verified against each helper's own
// docblock: triangle's A/B/C role assignment doesn't matter as long as
// it's consistent; square's c0-c1/c0-c3 edge-sharing convention is
// exactly consecutive vertices; hex's ring-building only needs
// consistent cyclic order, not a specific starting corner).
//
// Does NOT set currentShape - the caller (sketch.js) derives `n` from
// the ALREADY-selected shape button (no new picker, per the 1.2-A/1.2-C
// design), so currentShape is already correct by the time this runs.
function rebuildGridFromConstruction(p, q, n, side) {
    connections = [];
    additionalLayers = [];
    baseFaceAssignments = new Map();
    baseFacePalette = null; baseFaceAnchor = null; baseLastHarmonyType = null; baseLastSelection = null; baseDistributionStrategy = null; faceHover = null;
    activeLayer = 'base';
    timeline = null; // Roadmap 1.8 Stage C: see rebuildGrid()'s own comment
    baseNetAnimation = null;

    const { center, vertices } = completeEdgeToRegularPolygon(p, q, n, side);
    let subdivided;
    if (n === 3) subdivided = _subdivideTriangleInterior(vertices[0], vertices[1], vertices[2], nodeCount);
    else if (n === 4) subdivided = _subdivideSquareInterior(vertices, nodeCount);
    else subdivided = _subdivideHexInterior(vertices, center, nodeCount);

    nodes = subdivided;
    centroid = center;
    outerCorners = vertices;
    altNetSeed = { p, q, side, n };
    gridRevision++;
}
