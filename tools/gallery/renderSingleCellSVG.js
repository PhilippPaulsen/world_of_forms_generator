/**
 * tools/gallery/renderSingleCellSVG.js
 * Roadmap 1.11 pattern catalog, phase (a): headless, single-cell SVG
 * rendering - the core capability the design session confirmed is
 * feasible with a tiny, exactly-traced p5-dependency surface (see the
 * design session's own call-chain trace: core/symmetry.js's
 * drawConnectionWithSymmetry(), core/curves.js's buildCurvePieces()/
 * drawCurvedBezier(), core/tiling.js's drawShapeCell()/toTileLocal()).
 * Node-only tool, not part of the live app's own core/ engine (the app
 * never needs "render one specific orbit-combination as an isolated
 * SVG cell" itself) - lives outside core/ deliberately, matching
 * CLAUDE.md's own scoping of core/ to what sketch.js actually uses.
 *
 * Deliberately renders ONE cell (drawShapeCell() called once, no
 * tile-loop/drawTessellation() call) rather than a full tessellated
 * canvas - 1.11's own naming grammar (count, GroupToken, orbitIds -
 * see docs/terminology.md Part B) already describes the motif within
 * one cell under the shape's dihedral group, not a tiled canvas, so a
 * single cell is the structurally correct unit for a catalog entry,
 * not just a cheaper approximation of the full view (see the design
 * session, point 1).
 *
 * Each shape+order gets its own real vm.createContext() sandbox (true
 * isolation from this process's own global object and from any other
 * sandbox - not the plain `(0,eval)` pattern this project's throwaway
 * test scripts use, since THIS is a real, reusable, repeatedly-called
 * tool, not a one-shot verification script) via createGridRendererV2(),
 * so core/*.js's source is parsed once per shape+order and the grid/
 * orbit table built once, then reused across every k/orbit-combo
 * variation for that shape+order - avoiding re-parsing ~500 lines of
 * core source per individual catalog entry.
 */
const { readFileSync } = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

// Roadmap 1.11 pattern catalog: fixed rendering parameters, chosen (not
// guessed) via a real bounding-box check across all three shapes at
// order 2-5 in the design session - shapeSizeFactor=1.3 on a 300x300
// canvas keeps every shape's outerCorners safely inside the canvas
// with visible margin (~35px triangle/square, hex extends to ~283 on
// its wider axis, still unclipped) and no shape-dependent tuning
// needed. Not user-configurable - a catalog image is a fixed reference
// rendering, not a live-app view.
const CATALOG_CANVAS_SIZE = 300;
const CATALOG_SHAPE_SIZE_FACTOR = 1.3;

// The complete p5-dependency surface for a single-cell SVG render,
// confirmed by direct code tracing (not assumed) in the design
// session: strokeWeight() is a pure no-op for SVG collection;
// radians/cos/sin/sqrt/abs are exact Math.* aliases, nothing p5-
// specific about their VALUES. toTileLocal() (core/state.js) is
// replicated here rather than eval'd alongside state.js itself, which
// declares competing top-level `let centroid`/`currentShape`/etc that
// would shadow whatever this sandbox sets afterward - the same
// established eval-scoping reason every headless test in this
// project's history avoids eval'ing state.js directly.
function _buildSandbox() {
    const sandbox = {
        strokeWeight: () => { },
        radians: deg => deg * Math.PI / 180,
        cos: Math.cos,
        sin: Math.sin,
        sqrt: Math.sqrt,
        abs: Math.abs,
        activeNetWarp: null, lineStyle: { visible: true, weight: 2 }, // task 064: core/curves.js and core/tiling.js read these state.js globals now (gallery-render.js defines the same two as its shim)
        segmentCollector: null, // core/state.js global - drawCurvedBezier() checks it before svgPathCollector
        svgPathCollector: null,
        centroid: null, // set once per shape+order below, read by toTileLocal()
        curveType: { kind: 'straight' }, // catalog v1 is straight-line-only (design session, point 6 - 1.11's naming scope, not a cost shortcut)
        symmetryMode: null, // set once per shape+order below - drawConnectionWithSymmetry() reads this as a bare global, not a parameter
        outerCorners: null, // set once per shape+order below - mirrorAxisDir()'s no-arg fallback (reached since drawShapeCell() is called with mirrorAxisOverride=undefined) reads this bare global
        currentShape: null, // set once per shape+order below - mirrorAxisDir()'s no-arg fallback also reads this bare global
    };
    sandbox.toTileLocal = function (n, tileC, flip180, rotationDeg = 0) {
        let x = n.x - sandbox.centroid.x;
        let y = n.y - sandbox.centroid.y;
        if (flip180) { x = -x; y = -y; }
        if (rotationDeg) {
            const rad = sandbox.radians(rotationDeg);
            const rx = x * sandbox.cos(rad) - y * sandbox.sin(rad);
            const ry = x * sandbox.sin(rad) + y * sandbox.cos(rad);
            x = rx; y = ry;
        }
        return { x: tileC.x + x, y: tileC.y + y };
    };
    vm.createContext(sandbox);
    const coreFiles = ['core/forms.js', 'core/orbits.js', 'core/symmetry.js', 'core/curves.js', 'core/tiling.js', 'core/catalog.js'];   // task 064: + the v2 codec
    const src = coreFiles.map(f => readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    vm.runInContext(src, sandbox);
    return sandbox;
}

// Task 064 (G7a): the catalog v2 renderer. One grid {shape, ordnung, lage 1} -> its line-key table (core/orbits.js getLineKeyTable) and renderTokens(tokens): the single-cell
// SVG of the lines the tokens name (the representative pair of each key, pairForLineKey), drawn by the same drawShapeCell() call and written in the same SVG layout as v1.
// The mode is the whole main group of the shape ('rotation_reflection6', as the transport v2 sets it). The legacy orbit ids are not used anywhere.
const RENDERER_VERSION_V2 = '2-catalog-v2';
function createGridRendererV2(spec) {
    const sandbox = _buildSandbox();
    const v = sandbox.validateGridSpec(spec, { enforceMax: true });
    if (!v.ok) throw new Error('createGridRendererV2: ' + v.error);
    if (spec.lage !== 1) throw new Error('createGridRendererV2: lage 2 is not available yet');
    const symmetryMode = 'rotation_reflection6';
    const grid = sandbox.buildGrid(spec, { sizeFactor: CATALOG_SHAPE_SIZE_FACTOR, canvasW: CATALOG_CANVAS_SIZE, canvasH: CATALOG_CANVAS_SIZE });
    sandbox.centroid = grid.centroid;
    sandbox.symmetryMode = symmetryMode;
    sandbox.outerCorners = grid.outerCorners;
    sandbox.currentShape = spec.shape;
    const table = sandbox.getLineKeyTable(spec);
    const tokens = table.entries.map(e => e.token);   // compareLineKeys order
    function renderTokens(list) {
        const connSet = list.map(t => {
            const key = sandbox.parseLineKey(t, { table });
            const pair = key && sandbox.pairForLineKey(table, key);
            if (!pair) throw new Error(`renderTokens: line ${t} does not exist in ${spec.shape} ordnung ${spec.ordnung}`);
            return pair;
        });
        sandbox.svgPathCollector = [];
        sandbox.drawShapeCell(connSet, grid.centroid, false, grid.nodes, 0, undefined, spec.shape);
        const paths = sandbox.svgPathCollector;
        sandbox.svgPathCollector = null;
        const size = CATALOG_CANVAS_SIZE;
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">\n`;
        svg += `  <rect width="${size}" height="${size}" fill="#ffffff" />\n`;
        svg += `  <g stroke="#000000" stroke-width="2" fill="none">\n`;
        paths.forEach(d => { svg += `    <path d="${d}" />\n`; });
        svg += `  </g>\n</svg>\n`;
        return svg;
    }
    return { spec, symmetryMode, table, tokens, grid, sandbox, renderTokens };
}

module.exports = { createGridRendererV2, RENDERER_VERSION_V2, CATALOG_CANVAS_SIZE, CATALOG_SHAPE_SIZE_FACTOR };
