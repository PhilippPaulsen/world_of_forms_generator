/**
 * gallery-render.js
 * Roadmap 1.11 gallery Phase (c), pass 2: on-demand full-tessellation
 * rendering for the catalog's detail view - the permanent version of
 * the shim the Phase (c) design session proved in a throwaway browser
 * probe (now deleted). Reuses the SAME engine the live app uses
 * (core/forms.js, core/orbits.js, core/symmetry.js, core/curves.js,
 * core/tiling.js - loaded via plain <script> tags in gallery.html,
 * BEFORE this file) with NO p5 library involved: every p5-global
 * core/*.js reads (radians/cos/sin/sqrt/abs/floor/ceil/strokeWeight/
 * width/height) is a plain Math.* alias or no-op below, exactly
 * mirroring tools/gallery/renderSingleCellSVG.js's own proven Node-
 * side shim (see that file's docblock), extended with the additional
 * tessellation-only dependencies the design session traced and proved
 * (floor/ceil, width/height, connections/nodes/additionalLayers as
 * bare globals, showFaces=false - the last of which is why
 * core/faces.js is correctly never loaded here at all: drawTessellation()
 * never calls computeCellFaces() when showFaces is falsy).
 *
 * These are real global `var`s, not properties of some local sandbox
 * object - core/tiling.js/symmetry.js/curves.js read them as BARE
 * identifiers (p5 global-mode convention, see CLAUDE.md's "Loading
 * mechanism note"), so they have to actually be page globals here too.
 * That only works because a real browser page has exactly one such
 * global scope, unlike tools/gallery/renderSingleCellSVG.js's Node
 * vm.createContext() sandbox, which fakes one per shape+order on
 * purpose for isolation - not needed or possible here.
 *
 * Pass 3 adds on-demand SINGLE-CELL rendering (buildOrbitTable() +
 * renderSingleCellSVG(), below drawTessellation()/
 * renderFullTessellationSVG()) for the orbit table and ad-hoc
 * combination previews gallery.js builds from a user's own orbit
 * selection - reusing the same shim globals above (drawShapeCell()
 * needs the identical dependency surface drawTessellation() does,
 * minus the tessellation-only ones).
 */

// p5-global math aliases - exact Math.* values, nothing p5-specific
// about them (same claim renderSingleCellSVG.js's own docblock makes,
// re-confirmed for a real browser DOM in the design session's probe).
var strokeWeight = function () {};
var radians = function (deg) { return deg * Math.PI / 180; };
var cos = Math.cos;
var sin = Math.sin;
var sqrt = Math.sqrt;
var abs = Math.abs;
var floor = Math.floor;
var ceil = Math.ceil;

// Mutable render-state globals - drawTessellation() and the
// tileTriangle()/tileSquare()/tileHex() helpers it calls read these as
// bare globals when called with no override (the base-sheet case).
// Reset on every renderFullTessellationSVG() call below, never left
// stale between renders (no cross-render leakage - Phase (c) task
// point 6).
var segmentCollector = null;
var svgPathCollector = null;
// Task 024: the app's line style (core/state.js); the gallery always draws its lines (default, never switched here).
var lineStyle = { visible: true, weight: 2 };
var centroid = null;
var curveType = { kind: 'straight' }; // catalog is straight-line-only, matching renderSingleCellSVG.js
var symmetryMode = null;
var outerCorners = null;
var currentShape = null;
var connections = null;
var nodes = null;
var additionalLayers = []; // no layer overlays in a catalog render - always empty
var showFaces = false; // see docblock above - keeps core/faces.js unneeded
var width = null;
var height = null;

// The net-warp globals (Group E, since 629e7575 / ef82275d): drawTessellation() asks netTransformNow() / netWarpForBase() what net is in force,
// and drawCurvedBezier() reads activeNetWarp, all as BARE globals that core/state.js defines in the app. The gallery never loads core/state.js
// (see toTileLocal() below), so each one needs its inert value here: no timeline, no net animation, no net transform = a regular net, no warp.
// nodeCount / shapeSizeFactor are only passed on to netWarpForBase() and only read when a net transform is set (never, here); the grid builders get
// their sizes as arguments. A global added to core/tiling.js, curves.js or netwarp.js without a line here makes tools/gallery/test-gallery-smoke.js
// and test-gallery-globals.js fail.
var timeline = null;
var baseNetAnimation = null;
var baseNetTransform = null;
var activeNetWarp = null;
var nodeCount = null;
var shapeSizeFactor = null;

// Replicated (not eval'd from core/state.js) for the same scoping
// reason renderSingleCellSVG.js replicates it: core/state.js declares
// its own competing top-level centroid/currentShape/etc that would
// shadow the globals above if loaded alongside it.
function toTileLocal(n, tileC, flip180, rotationDeg) {
  rotationDeg = rotationDeg || 0;
  var x = n.x - centroid.x;
  var y = n.y - centroid.y;
  if (flip180) { x = -x; y = -y; }
  if (rotationDeg) {
    var rad = radians(rotationDeg);
    var rx = x * cos(rad) - y * sin(rad);
    var ry = x * sin(rad) + y * cos(rad);
    x = rx; y = ry;
  }
  return { x: tileC.x + x, y: tileC.y + y };
}

var SHAPE_BUILDERS = { triangle: buildTriangleGrid, square: buildSquareGrid, hex: buildHexGrid };

// Live-app default canvas/scale (matches sketch.js's own defaults, and
// the design session's own "live app default" measurement point:
// 600px canvas, shapeSizeFactor=5 - triangle order 3 gave 6,912 paths/
// ~10ms, hex order 3 gave 4,680 paths/~6.5ms, both real-measured).
var DETAIL_CANVAS_SIZE = 600;
var DETAIL_SHAPE_SIZE_FACTOR = 5;

// Task 064 (G7a): rebuilds the grid of a v2 manifest entry ({grid: {shape, ordnung, lage}, lines: [tokens]}) and renders its FULL TESSELLATION (not the single-cell
// thumbnail) as an inline SVG string. The lines are the entry's own line keys, resolved in the grid's line table (core/orbits.js transportConnectionsV2) - the same
// resolution the generator's "Open in generator" link makes - and the whole main group of the shape ('rotation_reflection6') draws them. Nothing pre-generated.
var CATALOG_MODE = 'rotation_reflection6';
function renderFullTessellationSVG(entry) {
  var size = DETAIL_CANVAS_SIZE;
  var spec = { shape: entry.grid.shape, ordnung: entry.grid.ordnung, lage: entry.grid.lage };
  var v = validateGridSpec(spec, { enforceMax: true });
  if (!v.ok) throw new Error('renderFullTessellationSVG: ' + v.error);

  var grid = buildGrid(spec, { sizeFactor: DETAIL_SHAPE_SIZE_FACTOR, canvasW: size, canvasH: size });
  centroid = grid.centroid;
  outerCorners = grid.outerCorners;
  currentShape = spec.shape;
  symmetryMode = CATALOG_MODE;
  width = size;
  height = size;
  nodes = grid.nodes;
  additionalLayers = [];

  connections = transportConnectionsV2({ spec: spec, shape: spec.shape, keys: entry.lines.map(function (t) { return parseLineKey(t); }) });

  svgPathCollector = [];
  drawTessellation();
  var paths = svgPathCollector;
  svgPathCollector = null;

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">';
  svg += '<rect width="' + size + '" height="' + size + '" fill="#ffffff" />';
  svg += '<g stroke="#000000" stroke-width="1.5" fill="none">';
  paths.forEach(function (d) { svg += '<path d="' + d + '" />'; });
  svg += '</g></svg>';
  return svg;
}

// Roadmap 1.11 gallery Phase (c), pass 3: on-demand SINGLE-CELL
// rendering (not a full tessellation) for the orbit table and ad-hoc
// combination previews - these are never in the manifest (the manifest
// only stores k=2,3,4 combos from Phase (a)/(b)'s own confirmed scope;
// a single orbit is conceptually k=1, and an arbitrary user-selected
// subset was never pre-generated at all), so they always render live.
// Same fixed parameters tools/gallery/renderSingleCellSVG.js used to
// generate every manifest thumbnail (300x300 canvas, shapeSizeFactor
// 1.3, stroke-width 2) - matching them exactly is what makes these
// on-demand previews look identical to manifest-backed grid cells.
var CATALOG_CANVAS_SIZE = 300;
var CATALOG_SHAPE_SIZE_FACTOR = 1.3;

// Task 064 (G7a): the grid + line-key table of one (shape, ordnung), built ONCE and reused for every tile and every generated combination. The "orbits" are the grid's line
// keys in compareLineKeys order (core/orbits.js getLineKeyTable); a tile / combination refers to them by their INDEX in that list inside the page only - everything that leaves
// the page (labels, links, paste) uses the key tokens.
function buildOrbitTable(shape, ordnung) {
  var spec = { shape: shape, ordnung: ordnung, lage: 1 };
  var v = validateGridSpec(spec, { enforceMax: true });
  if (!v.ok) throw new Error('buildOrbitTable: ' + v.error);
  var grid = buildGrid(spec, { sizeFactor: CATALOG_SHAPE_SIZE_FACTOR, canvasW: CATALOG_CANVAS_SIZE, canvasH: CATALOG_CANVAS_SIZE });
  var table = getLineKeyTable(spec);
  return { shape: shape, order: ordnung, spec: spec, symmetryMode: CATALOG_MODE, grid: grid, table: table, tokens: table.entries.map(function (e) { return e.token; }) };
}

// Renders ONE single cell (drawShapeCell(), not drawTessellation()) for a set of line indices (positions in builderState.tokens) against an already-built table - used for
// a lone line preview and for a full ad-hoc k-combination preview.
function renderSingleCellSVG(builderState, lineIndices) {
  var size = CATALOG_CANVAS_SIZE;
  centroid = builderState.grid.centroid;
  outerCorners = builderState.grid.outerCorners;
  currentShape = builderState.shape;
  symmetryMode = builderState.symmetryMode;
  nodes = builderState.grid.nodes;

  var connSet = lineIndices.map(function (i) {
    var e = builderState.table.entries[i];
    if (!e) throw new Error('renderSingleCellSVG: line index ' + i + ' does not exist for ' + builderState.shape + ' ordnung ' + builderState.order + ' (table has ' + builderState.table.entries.length + ' lines)');
    return pairForLineKey(builderState.table, e.key);
  });

  svgPathCollector = [];
  drawShapeCell(connSet, builderState.grid.centroid, false, builderState.grid.nodes, 0, undefined, builderState.shape);
  var paths = svgPathCollector;
  svgPathCollector = null;

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">';
  svg += '<rect width="' + size + '" height="' + size + '" fill="#ffffff" />';
  svg += '<g stroke="#000000" stroke-width="2" fill="none">';
  paths.forEach(function (d) { svg += '<path d="' + d + '" />'; });
  svg += '</g></svg>';
  return svg;
}
