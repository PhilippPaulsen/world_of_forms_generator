/**
 * tools/netwarp/test-netwarp-phase2.js
 * Roadmap 1.6 / Group E, Netzart 1, Phase 2 - the logic behind hit-testing, faces and export
 * (the UI itself, hit-testing and the dots were verified in a real browser, see the ROADMAP entry).
 *
 *   node tools/netwarp/test-netwarp-phase2.js
 *
 *  1. F^-1 (invertNetWarp): F(F^-1(p)) == p and F^-1(F(p)) == p over several tiles, every law, both
 *     parities - what makes a free endpoint land where it was clicked.
 *  2. Faces are refused on a warped net (computeCellFaces, computeCrossLayerFaces, export) and NOT
 *     when the warp is the identity or the base is not square; face detection returns as soon as the
 *     warp is gone.
 *  3. Export: meta.netTransform present only with a warp; regular exports are byte-identical to the
 *     previous commit's; faces/faceNodes omitted (base and layers) and flagged; E = nodeCount-1;
 *     the description round-trips through JSON to a warp that maps every node identically; the
 *     derived R really is last/first mesh on the exported lattice.
 *  4. SVG: node dots sit at F(node), the same place the lines end.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export'];
const load = fromHead => FILES.map(f => fromHead
    ? execSync(`git show HEAD:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString()
    : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const BUILD = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };
const SRC_NEW = load(false);

function makeSheet(src, shape, order, mode) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), console,
        line: () => { }, bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, noFill: () => { }, stroke: () => { }, fill: () => { }, beginShape: () => { }, vertex: () => { }, endShape: () => { }, CLOSE: 'close',
        document: { body: {} }, getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }), showNodes: true, width: 300, height: 300, showFaces: false,
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, activeNetWarp: null, lineColor: '#000000', altNetSeed: null,
        currentShape: shape, shapeSizeFactor: 1.3, nodeCount: order, symmetryMode: mode, timeline: null, activeLayer: 'base',
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => {
        let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; }
        if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; }
        return { x: tileC.x + x, y: tileC.y + y };
    };
    vm.createContext(sb);
    vm.runInContext(src, sb);
    const grid = sb[BUILD[shape]](order, 1.3, 300, 300);
    sb.nodes = grid.nodes; sb.centroid = grid.centroid; sb.outerCorners = grid.outerCorners;
    const table = sb.computeThemeLineOrbits(grid.nodes, grid.centroid, shape, mode, grid.outerCorners);
    const reps = table.orbits.map(o => o.pairs[0]);
    const addLayer = ids => { const l = { connections: ids.map(i => reps[i].slice()), redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape, symmetryMode: mode, enabled: true, showFaces: true, nodeCount: order, shapeSizeFactor: 1.3, nodes: grid.nodes, centroid: grid.centroid, outerCorners: grid.outerCorners }; sb.additionalLayers.push(l); return l; };
    const exp = () => { const d = sb.buildExportData(null); delete d.exportedAt; return d; };
    return { sb, grid, reps, addLayer, exp, setBase: ids => { sb.connections = ids.map(i => reps[i].slice()); } };
}
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const SPECS = {
    'sinus': { x: { kind: 'trig', w: -0.8 }, y: 'same' },
    'tangens': { x: { kind: 'trig', w: 0.7 }, y: 'same' },
    'geometric': { x: { kind: 'geometric', w: 1.4 }, y: 'same' },
    'geometric alternate, x/y separate': { x: { kind: 'geometric', w: -1.1, alternate: true }, y: { kind: 'trig', w: 0.5 } },
    'x only': { x: { kind: 'trig', w: -0.6 }, y: { kind: 'uniform', w: 0 } }
};

// ============ 1. inverse ============
console.log('== 1. F^-1 ==');
{
    const S = makeSheet(SRC_NEW, 'square', 5, 'rotation_reflection6'), sb = S.sb;
    for (const [name, spec] of Object.entries(SPECS)) {
        sb.baseNetTransform = spec; const w = sb.netWarpBaseNow(); let a = 0, b = 0, n = 0;
        for (let i = 0; i < 3000; i++) {
            const p = { x: -400 + rnd() * 1000, y: -400 + rnd() * 1000 };   // many tiles either side of the centre one
            const q = sb.applyNetWarp(w, sb.invertNetWarp(w, p)), r = sb.invertNetWarp(w, sb.applyNetWarp(w, p));
            a = Math.max(a, Math.hypot(q.x - p.x, q.y - p.y)); b = Math.max(b, Math.hypot(r.x - p.x, r.y - p.y)); n++;
        }
        check(`${name}: F(F^-1 p) == p and F^-1(F p) == p (px, over ${n} points in ~7x7 tiles)`, a < 1e-9 && b < 1e-9, `${a.toExponential(1)} / ${b.toExponential(1)}`);
    }
}

// ============ 2. faces refused ============
console.log('\n== 2. faces on a warped net ==');
{
    const S = makeSheet(SRC_NEW, 'square', 4, 'rotation_reflection6'), sb = S.sb;
    S.setBase([0, 2, 4, 5]); S.addLayer([1, 3]);
    const faces = () => sb.computeCellFaces(sb.connections, sb.nodes).faces.length;
    const layerBase = { conn: sb.connections, layers: [{ sheetId: 'L0', connections: sb.additionalLayers[0].connections, offsetX: 0, offsetY: 0 }] };
    const cross = () => sb.computeCrossLayerFaces(layerBase.conn, layerBase.layers).faces.length;
    const none = faces(), noneCross = cross();
    check('control: a regular net has faces', none > 0 && noneCross > 0, `${none} faces, ${noneCross} cross-layer`);
    sb.baseNetTransform = SPECS.sinus;
    check('sinus warp: computeCellFaces() returns nothing', faces() === 0);
    check('sinus warp: computeCrossLayerFaces() returns nothing', cross() === 0);
    sb.baseNetTransform = { x: { kind: 'trig', w: 0 }, y: 'same' };
    check('w = 0 (identity warp): faces unaffected', faces() === none && cross() === noneCross);
    sb.baseNetTransform = SPECS.sinus; sb.currentShape = 'triangle';
    check('spec set but base not square (warp inactive): faces unaffected', sb.netWarpActive() === false && sb.computeCellFaces(sb.connections, sb.nodes).faces.length >= 0);
    sb.currentShape = 'square'; sb.baseNetTransform = null;
    check('warp removed: faces come back', faces() === none);
}

// ============ 3. export ============
console.log('\n== 3. export ==');
{
    let n = 0, bad = 0;
    for (const [shape, order, mode] of [['square', 4, 'rotation_reflection6'], ['square', 3, 'rotation6'], ['triangle', 3, 'rotation6'], ['hex', 3, 'rotation_reflection6']]) {
        const A = makeSheet(SRC_NEW, shape, order, mode), B = makeSheet(load(true), shape, order, mode);
        for (let t = 0; t < 6; t++) {
            const ids = [t % 3, (t + 2) % 5, (t + 3) % 6].map(i => i % A.reps.length);
            for (const S of [A, B]) { S.sb.additionalLayers = []; S.setBase(ids); if (t % 2) S.addLayer([1 % A.reps.length]); }
            n++; if (JSON.stringify(A.exp()) !== JSON.stringify(B.exp())) bad++;
        }
    }
    check('regular / inactive-warp exports are byte-identical to the previous commit\'s (exportedAt aside)', bad === 0, `${n} exports, ${bad} differing`);

    const S = makeSheet(SRC_NEW, 'square', 5, 'rotation_reflection6'), sb = S.sb;
    S.setBase([0, 2, 4, 5]); S.addLayer([1, 3]);
    const reg = S.exp();
    check('control: the regular export has faces (base and layer) and no meta.netTransform', reg.geometry.faces.length > 0 && reg.geometry.layers[0].faces.length > 0 && !('netTransform' in reg.meta));
    for (const [name, spec] of Object.entries(SPECS)) {
        sb.baseNetTransform = spec;
        const d = JSON.parse(JSON.stringify(S.exp())), nt = d.meta.netTransform;
        check(`${name}: meta.netTransform present, faces omitted and flagged`,
            !!nt && nt.version === 1 && nt.interpretation === true && nt.facesOmitted === true && nt.geometryIsRegular === true && !('faces' in d.geometry) && !('faceNodes' in d.geometry) && !('faces' in d.geometry.layers[0]) && !('faceNodes' in d.geometry.layers[0]));
        check(`${name}: geometry.nodes/edges stay regular; E = nodeCount - 1`, JSON.stringify(d.geometry.nodes) === JSON.stringify(reg.geometry.nodes) && JSON.stringify(d.geometry.edges) === JSON.stringify(reg.geometry.edges) && nt.E === sb.nodeCount - 1, `E=${nt.E}`);
        const w1 = sb.netWarpBaseNow(), w2 = sb.netWarpForBase(sb.netTransformFromExport(nt), 'square', sb.outerCorners, sb.nodeCount);
        let worst = 0; sb.nodes.forEach(nd => { const a = sb.applyNetWarp(w1, nd), b = sb.applyNetWarp(w2, nd); worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y)); });
        for (let i = 0; i < 500; i++) { const p = { x: rnd() * 900 - 300, y: rnd() * 900 - 300 }; const a = sb.applyNetWarp(w1, p), b = sb.applyNetWarp(w2, p); worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y)); }
        check(`${name}: exported description -> JSON -> spec maps nodes and random points identically`, worst === 0, `worst ${worst}`);
    }
    // derived R / q really describe the exported lattice
    sb.baseNetTransform = { x: { kind: 'geometric', w: Math.log(6) }, y: 'same' };
    const nt = S.exp().meta.netTransform, w = sb.netWarpBaseNow(), E = sb.nodeCount - 1, size = sb.outerCorners[1].x - sb.outerCorners[0].x;
    const xs = [...Array(E + 1).keys()].map(i => sb.applyNetWarp(w, { x: sb.outerCorners[0].x + size * i / E, y: sb.outerCorners[0].y + 1e-9 }).x - sb.outerCorners[0].x - 0);
    // nodes are fixed points of F only at the tile boundary; interior lattice positions are what F maps them TO
    const lat = [...Array(E + 1).keys()].map(i => sb.applyNetWarp(w, { x: sb.outerCorners[0].x + size * i / E, y: sb.outerCorners[0].y }).x - sb.outerCorners[0].x);
    const widths = lat.slice(1).map((v, i) => v - lat[i]);
    check('exported R = last/first mesh and q = consecutive ratio on the warped lattice', Math.abs(widths[E - 1] / widths[0] - nt.x.R) < 1e-9 && widths.slice(1).every((v, i) => Math.abs(v / widths[i] - nt.x.q) < 1e-9), `R ${nt.x.R.toFixed(4)}, q ${nt.x.q.toFixed(4)}`);
    check('exported constants and law names for trig', (() => { sb.baseNetTransform = SPECS.sinus; const t = S.exp().meta.netTransform; sb.baseNetTransform = SPECS.tangens; const u = S.exp().meta.netTransform; return t.x.law === 'sinus' && u.x.law === 'tangens' && Math.abs(t.x.a - 0.8 * 1.3) < 1e-12 && Math.abs(u.x.a - 0.7 * 1.2) < 1e-12; })());
    // closed net / repeat: domain + repeat round-trip; the default (no repeat) is a single closed net
    for (const repeat of [false, true, undefined]) {
        sb.baseNetTransform = repeat === undefined ? { ...SPECS.sinus } : { ...SPECS.sinus, repeat };
        const nt2 = JSON.parse(JSON.stringify(S.exp())).meta.netTransform, back = sb.netTransformFromExport(nt2);
        check(`repeat ${repeat}: exports domain '${repeat ? 'per-tile' : 'single'}' and repeat ${!!repeat}, and reads back the same`, nt2.domain === (repeat ? 'per-tile' : 'single') && nt2.repeat === !!repeat && back.repeat === !!repeat);
    }
    check('an export from before the closed-net option (no domain/repeat) reads back as repeated', sb.netTransformFromExport({ version: 1, x: { kind: 'trig', w: -0.5 }, y: { kind: 'trig', w: -0.5 } }).repeat === true);
    check('an export marked domain single without repeat reads back as closed', sb.netTransformFromExport({ version: 1, domain: 'single', x: { kind: 'uniform' }, y: { kind: 'uniform' } }).repeat === false);
    {   // repeat alone is not a warp: nothing locks, nothing changes
        sb.baseNetTransform = { x: { kind: 'trig', w: 0 }, y: 'same', repeat: true };
        check('repeat with w = 0 is still the identity (no warp, no meta.netTransform)', sb.netWarpActive() === false && !('netTransform' in S.exp().meta));
    }
    {   // the hit-test helper behind "no free endpoints outside a closed net"
        sb.baseNetTransform = { ...SPECS.sinus }; const w = sb.netWarpBaseNow(), c = sb.outerCorners, sz = c[1].x - c[0].x;
        const P = (fx, fy) => ({ x: c[0].x + fx * sz, y: c[0].y + fy * sz });
        check('netWarpIsClosed / netWarpInsideNet: centre, corners and edges are inside; just outside is not', sb.netWarpIsClosed(w) && sb.netWarpInsideNet(w, P(0.5, 0.5)) && sb.netWarpInsideNet(w, P(0, 0)) && sb.netWarpInsideNet(w, P(1, 1)) && !sb.netWarpInsideNet(w, P(1.01, 0.5)) && !sb.netWarpInsideNet(w, P(0.5, -0.01)));
        sb.baseNetTransform = { ...SPECS.sinus, repeat: true };
        check('repeat on: the warp is not a closed net', sb.netWarpIsClosed(sb.netWarpBaseNow()) === false);
    }
    check('netTransformFromExport() refuses an unknown version', sb.netTransformFromExport({ version: 2 }) === null && sb.netTransformFromExport(null) === null);
}

// ============ 4. SVG dots ============
console.log('\n== 4. SVG node dots ==');
{
    const S = makeSheet(SRC_NEW, 'square', 4, 'rotation_reflection6'), sb = S.sb;
    S.setBase([0, 2]);
    const dots = () => [...sb.generateSVGString().matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)"/g)].map(m => [+m[1], +m[2]]);
    const reg = dots();
    check('regular: dots at the raw node positions', sb.nodes.every((n, i) => Math.abs(reg[i][0] - n.x) < 0.006 && Math.abs(reg[i][1] - n.y) < 0.006));
    sb.baseNetTransform = SPECS.tangens; const w = sb.netWarpBaseNow(), wd = dots();
    check('tangens: dots at F(node), and they differ from the raw ones', sb.nodes.every((n, i) => { const p = sb.applyNetWarp(w, n); return Math.abs(wd[i][0] - p.x) < 0.006 && Math.abs(wd[i][1] - p.y) < 0.006; }) && wd.some((d, i) => Math.abs(d[0] - reg[i][0]) > 1));
    // a line of the pattern ends exactly on a dot
    sb.svgPathCollector = []; sb.drawTessellation(); const paths = sb.svgPathCollector; sb.svgPathCollector = null;
    const ends = new Set(); paths.forEach(d => { const m = d.match(/M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)/); ends.add(m[1] + ',' + m[2]); ends.add(m[3] + ',' + m[4]); });
    const onDot = wd.filter(d => ends.has(d[0].toFixed(2) + ',' + d[1].toFixed(2))).length;
    check('every drawn line end that is a base node lies on a dot', onDot > 0, `${onDot} dots carry line ends`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
