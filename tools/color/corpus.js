/**
 * tools/color/corpus.js
 * The real-pattern corpus shared by the edit-inheritance tests: the SAME 258
 * patterns test-facecolor.js builds (10 shape x order x symmetry-mode configs,
 * random 2-5-orbit combinations of the REAL theme-line orbits, seed 20260923)
 * and, for each, every single-orbit edit (add an orbit it lacks, or remove one
 * of its orbits when it keeps at least one) - 10,902 edits, one per user click.
 * Kept separate from test-facecolor.js (which inlines its own copy) so that
 * file stays untouched.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const CORE = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor'];
const { execSync } = require('child_process');
// The core sources: the working tree, or (fromHead) the last commit's - for before/after comparisons.
const loadSrc = fromHead => CORE.map(f => fromHead
    ? execSync(`git show HEAD:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString()
    : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const SRC = loadSrc(false);
const BUILDERS = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };

function makeSheet(shape, order, mode, src = SRC) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs,
        dist: (a, b, c, d) => Math.hypot(c - a, d - b),
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, activeNetWarp: null,
        centroid: null, symmetryMode: mode, outerCorners: null, currentShape: shape, nodes: null,
        baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, additionalLayers: [], console
    };
    sb.toTileLocal = (n, tileC, flip180) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb);
    vm.runInContext(src, sb);
    const grid = sb[BUILDERS[shape]](order, 1.3, 300, 300);
    sb.nodes = grid.nodes; sb.centroid = grid.centroid; sb.outerCorners = grid.outerCorners;
    const table = sb.computeThemeLineOrbits(grid.nodes, grid.centroid, shape, mode, grid.outerCorners);
    const reps = table.orbits.map(o => o.pairs[0]);
    const group = sb.getGroupElementsCached(grid.nodes, grid.centroid, shape, mode, grid.outerCorners);
    const faces = orbitIds => sb.computeCellFaces(orbitIds.map(i => reps[i]), grid.nodes);
    sb.REF = vm.runInContext('OSTWALD_REFERENCE_SYSTEM', sb);
    return { sb, shape, order, mode, grid, table, reps, group, faces, label: `${shape}/${order}/${mode}` };
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const CONFIGS = [
    ['triangle', 3, 'rotation_reflection6'], ['triangle', 4, 'rotation_reflection6'], ['triangle', 3, 'rotation6'],
    ['square', 3, 'rotation_reflection6'], ['square', 4, 'rotation_reflection6'], ['square', 3, 'rotation6'],
    ['hex', 2, 'rotation_reflection6'], ['hex', 3, 'rotation_reflection6'], ['hex', 3, 'rotation6'], ['hex', 3, 'rotation_reflection3']
];

function buildPatterns(src = SRC) {
    const rand = rng(20260923);
    const patterns = [];
    for (const [shape, order, mode] of CONFIGS) {
        const sh = makeSheet(shape, order, mode, src);
        const n = sh.table.orbits.length;
        const seen = new Set();
        for (let tries = 0; tries < 400 && seen.size < 30; tries++) {
            const k = 2 + Math.floor(rand() * 4);
            const ids = []; while (ids.length < Math.min(k, n)) { const i = Math.floor(rand() * n); if (!ids.includes(i)) ids.push(i); }
            ids.sort((a, b) => a - b);
            const id = ids.join(',');
            if (seen.has(id)) continue;
            seen.add(id);
            const res = sh.faces(ids);
            if (res.faces.length) patterns.push({ sh, ids, res });
        }
    }
    return patterns;
}

// Every single-orbit edit of one pattern: [{ids, kind:'add'|'remove'}].
function editsOf(pattern) {
    const { sh, ids } = pattern;
    const out = [];
    for (let o = 0; o < sh.table.orbits.length; o++) {
        if (ids.includes(o)) { if (ids.length > 1) out.push({ ids: ids.filter(x => x !== o), kind: 'remove' }); }
        else out.push({ ids: ids.concat(o).sort((a, b) => a - b), kind: 'add' });
    }
    return out;
}

module.exports = { makeSheet, rng, buildPatterns, editsOf, CONFIGS, loadSrc };
