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
let curveAmount = 0;     // 0 or 25, toggled via #btn-toggle-curve
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
    let grid;
    if (shape === 'triangle') grid = buildTriangleGrid(nodeCount, shapeSizeFactor, canvasW, canvasH);
    else if (shape === 'square') grid = buildSquareGrid(nodeCount, shapeSizeFactor, canvasW, canvasH);
    else grid = buildHexGrid(nodeCount, shapeSizeFactor, canvasW, canvasH);

    nodes = grid.nodes; centroid = grid.centroid; outerCorners = grid.outerCorners;
}
