/**
 * tools/gitter/measure-representatives.js
 * Task 065: measurement (not a test: exit 0). Do the members of ONE line orbit (core/orbits.js computeLineKeyTable, the pairs of an entry) draw the same pattern when the whole
 * main group is applied by the app's own drawing (core/tiling.js drawShapeCell -> core/symmetry.js drawConnectionWithSymmetry, mode rotation_reflection6)? They should: the group
 * maps one member onto another, so the union of the group images is the same set. 063 saw that for the square at c = 4 four of eight members "draw differently" (frame lists compared
 * as lists of x1,y1,x2,y2).
 *
 *   node tools/gitter/measure-representatives.js              prints the measurement
 *   node tools/gitter/measure-representatives.js --json       the machine-readable result (its sha256 goes to stderr: the report quotes it)
 *   node tools/gitter/measure-representatives.js --catalog    only the acceptance catalog (gallery/v2/manifest.jsonl) consequences
 *
 * Three levels, each per orbit and per member (ONE member drawn alone, so the drawing is that member's):
 *   geometry  the segment multiset as UNDIRECTED segments (endpoints rounded to 0.001 px) - what a straight line looks like
 *   direction the same segments WITH their direction (x1,y1 -> x2,y2 as the app emits them) - what a curve that leans to one side depends on
 *   curves    the SVG path strings of drawCurvedBezier for a leaning curve (kind curve, symmetric false) and a symmetric curve - the pixels of a curved line
 * Cell level = one drawShapeCell call (all shapes, ordnung 1..5, square also c = 7); tessellation level = drawTessellation through tools/morph/render-harness.js (ordnung 1..3).
 * Reads core/* only; nothing there is changed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const ARGS = new Set(process.argv.slice(2));
const CORE = ['core/forms.js', 'core/orbits.js', 'core/symmetry.js', 'core/curves.js', 'core/tiling.js', 'core/catalog.js'];
const SIZE = 600, SF = 1.3;

function sandbox() {
    const sb = {
        strokeWeight() { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, atan2: Math.atan2, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max,
        dist: (a, b, c, d) => Math.hypot(c - a, d - b), console,
        segmentCollector: null, svgPathCollector: null, centroid: null, curveType: { kind: 'straight' }, symmetryMode: 'rotation_reflection6', outerCorners: null, currentShape: null,
        activeNetWarp: null, lineStyle: { visible: true, weight: 2 },
    };
    sb.toTileLocal = function (n, tileC, flip180, rotationDeg = 0) {
        let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y;
        if (flip180) { x = -x; y = -y; }
        if (rotationDeg) { const r = sb.radians(rotationDeg), rx = x * sb.cos(r) - y * sb.sin(r), ry = x * sb.sin(r) + y * sb.cos(r); x = rx; y = ry; }
        return { x: tileC.x + x, y: tileC.y + y };
    };
    vm.createContext(sb);
    vm.runInContext(CORE.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n'), sb);
    return sb;
}
const run = (sb, code) => vm.runInContext(code, sb);

const rnd = v => Math.round(v * 1000) / 1000;
// a path string reduced to its curve: the points (rounded) in the direction that sorts first - a Bezier path read backwards (its points reversed) is the same curve, so two
// path strings that are each other's reverse are the SAME drawing (the leaning curve is the one whose pixels depend on the direction of travel)
function canonicalPath(d) {
    const nums = (d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) || []).map(Number), pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push(rnd(nums[i]) + ',' + rnd(nums[i + 1]));
    const fwd = pts.join(' '), bwd = pts.slice().reverse().join(' ');
    return fwd <= bwd ? fwd : bwd;
}
// one cell, one member: the segments the app draws for the single line [a, b] under the whole main group. -> { dir: ["x1,y1>x2,y2", ...] sorted, geo: the same undirected, paths: [d strings] }
function cellDrawing(sb, grid, shape, pair, curve) {
    sb.curveType = curve || { kind: 'straight' };
    sb.segmentCollector = curve ? null : [];
    sb.svgPathCollector = curve ? [] : null;
    sb.drawShapeCell([pair], grid.centroid, false, grid.nodes, 0, undefined, shape);
    const segs = sb.segmentCollector, paths = sb.svgPathCollector;
    sb.segmentCollector = null; sb.svgPathCollector = null; sb.curveType = { kind: 'straight' };
    if (curve) return { paths: paths.map(canonicalPath).sort() };
    const dir = segs.map(q => `${rnd(q.x1)},${rnd(q.y1)}>${rnd(q.x2)},${rnd(q.y2)}`).sort();
    const geo = segs.map(q => { const a = [rnd(q.x1), rnd(q.y1)], b = [rnd(q.x2), rnd(q.y2)]; return (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])) ? a.join(',') + '>' + b.join(',') : b.join(',') + '>' + a.join(','); }).sort();
    return { dir, geo };
}
const sig = list => crypto.createHash('sha256').update(list.join(';')).digest('hex').slice(0, 10);
const reverseOf = d => d.split('>').reverse().join('>');
const CURVES = { leaning: { kind: 'curve', fold: 1, symmetric: false, leaning: 'left', strength: 25 }, symmetric: { kind: 'curve', fold: 1, symmetric: true, leaning: 'left', strength: 25 } };

const SHAPES = ['triangle', 'square', 'hex'];
const result = { grids: [], tessellation: [], firstAffected: {}, summary: {} };

// ---- cell level --------------------------------------------------------------------------------------------------------------------------------------
function measureGrid(shape, c, ordnung) {
    const sb = sandbox();
    const spec = { shape, ordnung, lage: 1 };
    const grid = sb.buildGrid(spec, { sizeFactor: SF, canvasW: SIZE, canvasH: SIZE });
    sb.centroid = grid.centroid; sb.outerCorners = grid.outerCorners; sb.currentShape = shape; sb.symmetryMode = 'rotation_reflection6';
    const table = sb.getLineKeyTable(spec);
    const rec = { shape, c, ordnung, nodes: grid.nodes.length, orbits: table.entries.length, pairs: table.pairCount, geoBad: 0, dirBad: 0, dirOnlyReversed: 0, leaningBad: 0, symmetricBad: 0, zDirBad: 0, zDirBadEqualZahl: 0, zDirBadDifferentZahl: 0, equalZahlOrbits: 0, examples: [], leaningExample: null };
    for (const e of table.entries) {
        // the orbit's node numbers: z1 >= z2 (core/forms.js numberGridNodes through the table); the "z-oriented" member runs from the end with the larger number to the other
        const zOf = id => table._zahl.get(id), zEqual = zOf(e.pairs[0][0]) === zOf(e.pairs[0][1]);
        if (zEqual) rec.equalZahlOrbits++;
        const orient = p => (zOf(p[0]) >= zOf(p[1]) ? [p[0], p[1]] : [p[1], p[0]]);
        const per = e.pairs.map(p => ({ p, d: cellDrawing(sb, grid, shape, p), z: cellDrawing(sb, grid, shape, orient(p)), l: cellDrawing(sb, grid, shape, p, CURVES.leaning), y: cellDrawing(sb, grid, shape, p, CURVES.symmetric) }));
        const classes = (f) => { const m = new Map(); per.forEach(x => { const g = sig(f(x)); if (!m.has(g)) m.set(g, []); m.get(g).push(x); }); return m; };
        const geo = classes(x => x.d.geo), dir = classes(x => x.d.dir), zdir = classes(x => x.z.dir), lean = classes(x => x.l.paths), sym = classes(x => x.y.paths);
        if (geo.size > 1) rec.geoBad++;
        if (zdir.size > 1) { rec.zDirBad++; if (zEqual) rec.zDirBadEqualZahl++; else rec.zDirBadDifferentZahl++; }
        if (sym.size > 1) rec.symmetricBad++;
        if (lean.size > 1) { rec.leaningBad++; if (!rec.leaningExample) rec.leaningExample = { token: e.token, classes: [...lean.values()].map(v => ({ size: v.length, members: v.slice(0, 3).map(x => x.p) })) }; }
        if (dir.size > 1) {
            rec.dirBad++;
            const cls = [...dir.values()];
            // is the second class exactly the FIRST class with every segment reversed? (then the member differs by orientation only)
            const rev = cls[0][0].d.dir.map(reverseOf).sort();
            if (cls.length === 2 && sig(rev) === sig(cls[1][0].d.dir)) rec.dirOnlyReversed++;
            if (rec.examples.length < 1) {
                const a = cls[0][0].d.dir, b = cls[1][0].d.dir;
                rec.examples.push({ token: e.token, size: e.size, classSizes: cls.map(v => v.length), members: cls.map(v => v.slice(0, 3).map(x => x.p)), segments: a.length, firstSegment: [a[0], b.find(t => !a.includes(t)) || null], reversedOfSecondEqualsFirst: sig(b.map(reverseOf).sort()) === sig(a) });
            }
        }
    }
    result.grids.push(rec);
    if ((rec.dirBad || rec.geoBad) && !result.firstAffected[shape + ' c=' + c]) result.firstAffected[shape + ' c=' + c] = ordnung;
}

// ---- tessellation level (drawTessellation through the harness) ------------------------------------------------------------------------------------------
function measureTessellation(shape, c, ordnung) {
    const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
    const w0 = H.makeRenderWorld(shape, c, 3, 'rotation_reflection6');
    const table = w0.get(`getLineKeyTable({ shape: ${JSON.stringify(shape)}, ordnung: ${ordnung}, lage: 1 })`);
    const rec = { shape, c, ordnung, orbits: table.entries.length, geoBad: 0, dirBad: 0 };
    for (const e of table.entries) {
        const g = new Set(), d = new Set();
        for (const p of e.pairs) {
            w0.baseConnections([p]);
            const f = w0.frame();
            d.add(sig(f.map(q => `${rnd(q.x1)},${rnd(q.y1)}>${rnd(q.x2)},${rnd(q.y2)}`).sort()));
            g.add(sig(f.map(q => { const a = [rnd(q.x1), rnd(q.y1)], b = [rnd(q.x2), rnd(q.y2)]; return (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])) ? a.join(',') + '>' + b.join(',') : b.join(',') + '>' + a.join(','); }).sort()));
        }
        if (g.size > 1) rec.geoBad++;
        if (d.size > 1) rec.dirBad++;
    }
    result.tessellation.push(rec);
}

if (!ARGS.has('--catalog')) {
    for (const shape of SHAPES) for (let ordnung = 1; ordnung <= 5; ordnung++) measureGrid(shape, shape === 'hex' ? ordnung : ordnung + 1, ordnung);
    measureGrid('square', 7, 6);   // square c = 1..7: c = 2..6 are ordnung 1..5 above, c = 7 is ordnung 6; c = 1 is the legacy marker with the node set of c = 2 (no extra orbits)
    for (const shape of SHAPES) for (let ordnung = 1; ordnung <= 3; ordnung++) measureTessellation(shape, shape === 'hex' ? ordnung : ordnung + 1, ordnung);
}

// ---- the consequence for the acceptance catalog (gallery/v2) -----------------------------------------------------------------------------------------------
const manifestPath = path.join(ROOT, 'gallery', 'v2', 'manifest.jsonl');
const catalog = { entries: 0, geoAffected: 0, dirAffected: [], byGrid: {}, previewDiffersFromSourceRep: 0 };
if (fs.existsSync(manifestPath)) {
    const entries = fs.readFileSync(manifestPath, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const cache = new Map();
    for (const e of entries) {
        const ck = e.grid.shape + e.grid.ordnung;
        if (!cache.has(ck)) {
            const sb = sandbox(), spec = { shape: e.grid.shape, ordnung: e.grid.ordnung, lage: 1 };
            const grid = sb.buildGrid(spec, { sizeFactor: SF, canvasW: SIZE, canvasH: SIZE });
            sb.centroid = grid.centroid; sb.outerCorners = grid.outerCorners; sb.currentShape = e.grid.shape;
            const table = sb.getLineKeyTable(spec), info = new Map();
            for (const ent of table.entries) {
                const geo = new Set(), dir = new Set();
                ent.pairs.forEach(p => { const x = cellDrawing(sb, grid, e.grid.shape, p); geo.add(sig(x.geo)); dir.add(sig(x.dir)); });
                info.set(ent.token, { geo: geo.size, dir: dir.size });
            }
            cache.set(ck, info);
        }
        const info = cache.get(ck);
        catalog.entries++;
        catalog.byGrid[ck] = catalog.byGrid[ck] || { entries: 0, dirAffected: 0, dirTokens: new Set() };
        catalog.byGrid[ck].entries++;
        if (e.lines.some(t => info.get(t).geo > 1)) catalog.geoAffected++;
        const bad = e.lines.filter(t => info.get(t).dir > 1);
        if (bad.length) { catalog.byGrid[ck].dirAffected++; bad.forEach(t => catalog.byGrid[ck].dirTokens.add(t)); catalog.dirAffected.push({ path: e.path, tokens: bad }); }
    }
    Object.values(catalog.byGrid).forEach(g => { g.dirTokens = [...g.dirTokens]; });
}
result.catalog = catalog;
result.summary = {
    orbits: result.grids.reduce((a, g) => a + g.orbits, 0),
    orbitsWithDifferingGeometry: result.grids.reduce((a, g) => a + g.geoBad, 0),
    orbitsWithDifferingDirection: result.grids.reduce((a, g) => a + g.dirBad, 0),
    orbitsWithDifferingDirectionWhenZOriented: result.grids.reduce((a, g) => a + g.zDirBad, 0),
    ofThemEqualZahl: result.grids.reduce((a, g) => a + g.zDirBadEqualZahl, 0),
    ofThemDifferentZahl: result.grids.reduce((a, g) => a + g.zDirBadDifferentZahl, 0),
    orbitsWithEqualZahl: result.grids.reduce((a, g) => a + g.equalZahlOrbits, 0),
    orbitsWithDifferingLeaningCurve: result.grids.reduce((a, g) => a + g.leaningBad, 0),
    orbitsWithDifferingSymmetricCurve: result.grids.reduce((a, g) => a + g.symmetricBad, 0),
    firstAffected: result.firstAffected,
};

if (ARGS.has('--json')) {
    const text = JSON.stringify(result, null, 1);
    process.stdout.write(text + '\n');
    process.stderr.write('sha256 ' + crypto.createHash('sha256').update(text).digest('hex').slice(0, 16) + '\n');
} else {
    const J2 = o => JSON.stringify(o);
    console.log('cell level: shape c ordnung | nodes orbits pairs | orbits differing in: geometry / direction (of them: exactly reversed) / leaning-curve pixels / symmetric-curve pixels | z-oriented direction (equal-zahl orbits)');
    result.grids.forEach(g => console.log(`  ${g.shape.padEnd(8)} c=${g.c} ordnung ${g.ordnung} | ${String(g.nodes).padStart(3)} ${String(g.orbits).padStart(4)} ${String(g.pairs).padStart(5)} | ${String(g.geoBad).padStart(3)} / ${String(g.dirBad).padStart(3)} (${g.dirOnlyReversed}) / ${String(g.leaningBad).padStart(3)} / ${String(g.symmetricBad).padStart(3)} | ${g.zDirBad} (${g.equalZahlOrbits})`));
    console.log('\ntessellation level (drawTessellation, harness):');
    result.tessellation.forEach(g => console.log(`  ${g.shape.padEnd(8)} c=${g.c} ordnung ${g.ordnung} | orbits ${String(g.orbits).padStart(3)} | differing geometry ${g.geoBad}, direction ${g.dirBad}`));
    console.log('\nsummary: ' + J2(result.summary));
    result.grids.filter(g => g.examples.length).slice(0, 4).forEach(g => console.log('\ndirection example ' + g.shape + ' c=' + g.c + ': ' + J2(g.examples[0])));
    result.grids.filter(g => g.leaningExample).slice(0, 2).forEach(g => console.log('\nleaning-curve example ' + g.shape + ' c=' + g.c + ': ' + J2(g.leaningExample)));
    console.log('\nacceptance catalog (gallery/v2): ' + catalog.entries + ' entries; geometry differs for ' + catalog.geoAffected + '; direction differs for ' + catalog.dirAffected.length);
    Object.entries(catalog.byGrid).filter(([, g]) => g.dirAffected).forEach(([k, g]) => console.log(`  ${k}: ${g.dirAffected}/${g.entries} entries, lines ${g.dirTokens.join(' ')}`));
}
