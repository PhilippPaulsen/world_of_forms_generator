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

// Rebuilds the exact grid+orbit table a manifest entry was generated
// from, and renders its FULL TESSELLATION (not the single-cell
// thumbnail) as an inline SVG string. (shape, order, symmetryMode,
// orbitIds) is exactly the tuple every manifest.jsonl row already
// stores - no new data needed, nothing pre-generated (design session's
// storage-cost finding).
function renderFullTessellationSVG(entry) {
  var size = DETAIL_CANVAS_SIZE;
  var buildGrid = SHAPE_BUILDERS[entry.shape];
  if (!buildGrid) throw new Error('renderFullTessellationSVG: unknown shape "' + entry.shape + '"');

  var grid = buildGrid(entry.order, DETAIL_SHAPE_SIZE_FACTOR, size, size);
  centroid = grid.centroid;
  outerCorners = grid.outerCorners;
  currentShape = entry.shape;
  symmetryMode = entry.symmetryMode;
  width = size;
  height = size;
  nodes = grid.nodes;
  additionalLayers = [];

  var table = computeThemeLineOrbits(grid.nodes, grid.centroid, entry.shape, entry.symmetryMode, grid.outerCorners);
  connections = entry.orbitIds.map(function (id) {
    if (!table.orbits[id]) {
      throw new Error('renderFullTessellationSVG: orbit id ' + id + ' does not exist for ' + entry.shape + ' order ' + entry.order + ' (table has ' + table.orbits.length + ' orbits)');
    }
    return table.orbits[id].pairs[0];
  });

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
