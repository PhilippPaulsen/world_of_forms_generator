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
 * tool, not a one-shot verification script) via createShapeOrderRenderer(),
 * so core/*.js's source is parsed once per shape+order and the grid/
 * orbit table built once, then reused across every k/orbit-combo
 * variation for that shape+order - avoiding re-parsing ~500 lines of
 * core source per individual catalog entry.
 */
const { readFileSync } = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

// Roadmap 1.11 pattern catalog: version stamp for manifest staleness
// detection (design session, point 5) - bump by hand whenever
// core/orbits.js's orbit algorithm, core/forms.js's grid construction,
// or core/symmetry.js's group/rotation logic changes in a way that
// could alter which orbit an id refers to or how a cell renders (this
// project's own history - the 1.11-A D-formula correction - confirms
// this real risk, not a hypothetical one).
const RENDERER_VERSION = '1.11-catalog-v1';

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
    const coreFiles = ['core/forms.js', 'core/orbits.js', 'core/symmetry.js', 'core/curves.js', 'core/tiling.js'];
    const src = coreFiles.map(f => readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    vm.runInContext(src, sandbox);
    return sandbox;
}

const SHAPE_BUILDERS = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };

// Roadmap 1.11 pattern catalog: one real grid + orbit table, built ONCE
// per (shape, order, symmetryMode) - every subsequent renderCombo()
// call for this same handle reuses both, only varying which orbit-id
// combination gets drawn. Mirrors this project's own established
// "explicit parameters, no hidden state" testability standard
// (core/orbits.js's own computeThemeLineOrbits() docblock) - the
// returned handle exposes the real table (orbits/groupToken/etc) so a
// caller can verify against it directly, not just trust the rendered
// output.
function createShapeOrderRenderer(shape, order, symmetryMode = 'rotation_reflection6') {
    if (!SHAPE_BUILDERS[shape]) throw new Error(`createShapeOrderRenderer: unknown shape "${shape}"`);
    const sandbox = _buildSandbox();
    const grid = sandbox[SHAPE_BUILDERS[shape]](order, CATALOG_SHAPE_SIZE_FACTOR, CATALOG_CANVAS_SIZE, CATALOG_CANVAS_SIZE);
    sandbox.centroid = grid.centroid;
    sandbox.symmetryMode = symmetryMode;
    sandbox.outerCorners = grid.outerCorners;
    sandbox.currentShape = shape;
    const table = sandbox.computeThemeLineOrbits(grid.nodes, grid.centroid, shape, symmetryMode, grid.outerCorners);

    // Roadmap 1.11 pattern catalog: one representative connection per
    // requested orbit id - the FIRST pair listed in that orbit's own
    // members array. computeThemeLineOrbits() already canonically
    // orders each orbit's members by _pairKey() (see its own docblock -
    // "deterministic order within an orbit"), so this choice is itself
    // deterministic and reproducible from (shape, order, symmetryMode,
    // orbitId) alone, not an arbitrary pick.
    function renderCombo(orbitIds) {
        const connSet = orbitIds.map(id => {
            if (!table.orbits[id]) throw new Error(`renderCombo: orbit id ${id} does not exist for ${shape} order ${order} (table has ${table.orbits.length} orbits)`);
            return table.orbits[id].pairs[0];
        });
        sandbox.svgPathCollector = [];
        sandbox.drawShapeCell(connSet, grid.centroid, false, grid.nodes, 0, undefined, shape);
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

    return { shape, order, symmetryMode, groupToken: table.groupToken, table, grid, renderCombo };
}

module.exports = { createShapeOrderRenderer, RENDERER_VERSION, CATALOG_CANVAS_SIZE, CATALOG_SHAPE_SIZE_FACTOR };
