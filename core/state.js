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
let nodeCount = 3;       // 1..5, adjustable via #node-count-input
// Roadmap 1.4-A: curveType replaces the old bare curveAmount number
// (core/curves.js's curveType struct - kind/fold/symmetric/leaning/
// strength). Still a single global shared by every sheet, same
// rationale as symmetryMode below (a plate-wide stylistic choice, not
// a per-connection property - see core/curves.js's own module
// docblock). The toggle button (#btn-toggle-curve) still just flips
// between straight and one fixed curve style for now - 1.4-B is what
// exposes fold/symmetric/leaning/strength as real UI controls.
let curveType = { kind: 'straight' };

let symmetryMode = "rotation_reflection6"; // fixed default - #symmetry-dropdown removed from UI, logic below stays wired for later reuse
let lineColor = "#000000"; // fixed default - #line-color-picker removed from UI, logic below stays wired for later reuse
let showNodes = true;
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
let activeLayer = 'base'; // 'base' | integer index into additionalLayers - which sheet mousePressed()/addRandomConnection()/undo/redo/clear target

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

// ----------------- STATE HELPERS ---------------------------------
function toTileLocal(n, tileC, flip180) {
    // shift node by removing center centroid, place at tile centroid; optional 180° flip
    let x = n.x - centroid.x;
    let y = n.y - centroid.y;
    if (flip180) { x = -x; y = -y; }
    return { x: tileC.x + x, y: tileC.y + y };
}

function rebuildGrid(shape) {
    connections = [];
    additionalLayers = [];
    activeLayer = 'base'; // an active additional-layer index would otherwise dangle once the array is cleared
    altNetSeed = null; // Roadmap 1.2-C: an ordinary shape/order rebuild is never an alt-net construction
    let grid;
    if (shape === 'triangle') grid = buildTriangleGrid(nodeCount, shapeSizeFactor, canvasW, canvasH);
    else if (shape === 'square') grid = buildSquareGrid(nodeCount, shapeSizeFactor, canvasW, canvasH);
    else grid = buildHexGrid(nodeCount, shapeSizeFactor, canvasW, canvasH);

    nodes = grid.nodes; centroid = grid.centroid; outerCorners = grid.outerCorners;
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
    activeLayer = 'base';

    const { center, vertices } = completeEdgeToRegularPolygon(p, q, n, side);
    let subdivided;
    if (n === 3) subdivided = _subdivideTriangleInterior(vertices[0], vertices[1], vertices[2], nodeCount);
    else if (n === 4) subdivided = _subdivideSquareInterior(vertices, nodeCount);
    else subdivided = _subdivideHexInterior(vertices, center, nodeCount);

    nodes = subdivided;
    centroid = center;
    outerCorners = vertices;
    altNetSeed = { p, q, side, n };
}
