/**
 * tools/netwarp/test-netwarp.js
 * Roadmap 1.6 / Group E, Netzart 1, Phase 1 (core/netwarp.js + the drawCurvedBezier() sink hook).
 *
 *   node tools/netwarp/test-netwarp.js
 *
 *  1. Identity: a null spec, w=0 (every kind, alternate on/off), and a spec on a non-square base
 *     draw EXACTLY the same line() calls as the previous commit's code (HEAD control).
 *  2. Mesh-width table for the sinus / tangens / geometric laws (design-session numbers, now against
 *     the shipped netAxisLaw): monotone, sum of widths = 1, F(0)=0, F(1)=1, outer/inner, ratio q.
 *  3. Through the real pipeline: every endpoint drawn by drawTessellation() lies on the warped node
 *     lattice x0 + size*f(k/E) (in every tile), and a drawn connection has the expected endpoints.
 *  4. Sink consistency: canvas line() calls == segmentCollector segments (exact) == SVG path data (2 dp).
 *  5. Symmetry commutation: rot90 about the tile centre commutes with F for the trig laws with equal
 *     axes; not for the geometric series (alternate or not), nor for unequal axes. Then the real
 *     drawConnectionWithSymmetry() output under a warp is / is not closed under the group.
 *  6. alternate parity: widths continuous across tile seams; without it they jump by 1/R; inert for trig.
 *  8. Closed net (repeat off, the default): one tile, nothing outside the net rectangle, equal to the
 *     repeated drawing restricted to it; a half-size layer keeps its own sub-tiles; an offset layer degrades
 *     sensibly; repeat on == the previous commit's behaviour.
 *  7. Face fills are skipped on a warped net; the warp never leaks (finally); face detection outside
 *     drawTessellation() sees unwarped geometry.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor'];
const load = fromHead => FILES.map(f => fromHead
    ? execSync(`git show HEAD:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString()
    : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const BUILD = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };
const W = 300, SF = 3; // canvas, shapeSizeFactor -> tile size 100

function makeSb(src, shape, mode, order) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        line: (a, b, c, d) => sb.lines.push([a, b, c, d]), bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, noFill: () => { }, stroke: () => { },
        fill: () => { sb.fills++; }, beginShape: () => { }, vertex: () => { }, endShape: () => { }, CLOSE: 'close',
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, lineColor: '#000', altNetSeed: null,
        currentShape: shape, shapeSizeFactor: SF, nodeCount: order, symmetryMode: mode, width: W, height: W, showFaces: false,
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, activeLayer: 'base', timeline: null,
        baseNetTransform: null, baseNetAnimation: null, activeNetWarp: null, lines: [], fills: 0
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => {
        let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y;
        if (flip180) { x = -x; y = -y; }
        if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; }
        return { x: tileC.x + x, y: tileC.y + y };
    };
    vm.createContext(sb);
    vm.runInContext(src, sb);
    const g = sb[BUILD[shape]](order, SF, W, W);
    sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
    return sb;
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function randomConnections(sb, n) {
    const out = []; const ids = sb.nodes.map(x => x.id);
    while (out.length < n) { const a = ids[Math.floor(rnd() * ids.length)], b = ids[Math.floor(rnd() * ids.length)]; if (a !== b) out.push([a, b]); }
    return out;
}
const SRC_NEW = load(false), SRC_OLD = load(true);
const draw = sb => { sb.lines = []; sb.drawTessellation(); return sb.lines; };
const fixture = (src, shape, mode, order, spec, seedN) => {
    seed = seedN; const sb = makeSb(src, shape, mode, order); sb.connections = randomConnections(sb, 4);
    if (shape === 'square') { // a same-scale offset layer and a rotated layer ride along
        const g = sb.layerGrid(sb.outerCorners, sb.centroid, sb.currentShape, sb.shapeSizeFactor, sb.shapeSizeFactor, order, shape, W, W);
        const mk = extra => ({ connections: randomConnections({ nodes: g.nodes }, 2), redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape, symmetryMode: mode, enabled: true, showFaces: false, nodeCount: order, shapeSizeFactor: SF, nodes: g.nodes, centroid: g.centroid, outerCorners: g.outerCorners, ...extra });
        sb.additionalLayers.push(mk({ offsetX: 17, offsetY: -9 }), mk({ rotation: 30 }));
    }
    sb.baseNetTransform = spec;
    return sb;
};

// ============ 1. identity ============
console.log('== 1. identity: byte-equal to the previous commit ==');
{
    const IDS = [null, { x: { kind: 'uniform', w: 0 }, y: 'same' }, { x: { kind: 'trig', w: 0 }, y: 'same' }, { x: { kind: 'geometric', w: 0, alternate: true }, y: { kind: 'trig', w: 0 } }];
    let cases = 0, bad = 0, lines = 0;
    for (const shape of ['square', 'triangle', 'hex']) for (const mode of ['rotation_reflection6', 'rotation3', 'reflection_only', 'none']) for (const order of [2, 3, 4]) for (const spec of IDS) {
        const a = draw(fixture(SRC_OLD, shape, mode, order, spec, 11 + order)), b = draw(fixture(SRC_NEW, shape, mode, order, spec, 11 + order));
        cases++; lines += b.length; if (JSON.stringify(a) !== JSON.stringify(b)) bad++;
    }
    check('null / w=0 specs: exactly the HEAD line() calls', bad === 0, `${cases} cases, ${lines} lines, ${bad} differ`);
    let bad2 = 0, n2 = 0;
    for (const shape of ['triangle', 'hex']) for (const order of [2, 3]) {
        const spec = { x: { kind: 'trig', w: -0.7 }, y: { kind: 'geometric', w: 1.1 } };
        const a = draw(fixture(SRC_OLD, shape, 'rotation_reflection6', order, spec, 5)), b = draw(fixture(SRC_NEW, shape, 'rotation_reflection6', order, spec, 5));
        n2++; if (JSON.stringify(a) !== JSON.stringify(b)) bad2++;
    }
    check('a real warp on a non-square base is inactive (Phase 1: square only)', bad2 === 0, `${n2} cases`);
    const sbW = fixture(SRC_NEW, 'square', 'rotation_reflection6', 3, { x: { kind: 'trig', w: -0.7 }, y: 'same' }, 5), o = draw(fixture(SRC_OLD, 'square', 'rotation_reflection6', 3, null, 5)), n = draw(sbW);
    check('control: a real warp DOES change the output', JSON.stringify(o) !== JSON.stringify(n));
}

// ============ 2. law table ============
console.log('\n== 2. mesh widths of the shipped laws (design-session table) ==');
const sbLaw = makeSb(SRC_NEW, 'square', 'none', 3);
const law = (axis, E) => sbLaw.netAxisLaw(axis, E);
const widths = (f, E) => Array.from({ length: E }, (_, k) => f((k + 1) / E) - f(k / E));
const fmt = w => w.map(x => x.toFixed(4)).join(' ');
const strictly = (arr, dir) => arr.every((x, i) => i === 0 || (dir > 0 ? x > arr[i - 1] : x < arr[i - 1]));
const A_SIN = vm.runInContext('NETWARP_A_SIN', sbLaw), A_TAN = vm.runInContext('NETWARP_A_TAN', sbLaw);
const EXPECT = { // outer/inner mesh (E=4 / E=12), from the design session
    'sin 0.6': [0.911, 0.854], 'sin 1.0': [0.755, 0.611], 'sin 1.3': [0.592, 0.372],
    'tan 0.6': [1.212, 1.374], 'tan 1.0': [1.851, 2.714], 'tan 1.2': [2.760, 5.006]
};
for (const E of [4, 12]) {
    console.log(`  E=${E}`);
    for (const [kind, a] of [['sin', 0.6], ['sin', 1.0], ['sin', 1.3], ['tan', 0.6], ['tan', 1.0], ['tan', 1.2]]) {
        const w = kind === 'sin' ? -a / A_SIN : a / A_TAN;
        const f = law({ kind: 'trig', w }, E), ws = widths(f, E), h = E / 2;
        const inner = ws.slice(h), outerToIn = ws.slice(0, h).reverse();  // both halves, centre outwards
        const dir = kind === 'sin' ? -1 : 1;
        const mono = strictly(inner, dir) && strictly(outerToIn, dir);
        const sum = ws.reduce((s, x) => s + x, 0), ratio = ws[0] / ws[h - 1], cont = kind === 'sin' ? Math.cos(a) : 1 / Math.cos(a) ** 2;
        const exp = EXPECT[`${kind} ${a.toFixed(1)}`][E === 4 ? 0 : 1];
        console.log(`   ${kind} a=${a.toFixed(1)}  widths ${fmt(ws)}`);
        console.log(`      ${dir < 0 ? 'shrinks' : 'grows'} outward: ${mono}  sum ${sum.toFixed(6)}  F(0)=${f(0).toFixed(6)} F(1)=${f(1).toFixed(6)}  outer/inner ${ratio.toFixed(3)} (design ${exp.toFixed(3)})  continuum ${cont.toFixed(3)}`);
        check(`${kind} a=${a} E=${E}: monotone ${dir < 0 ? 'shrink' : 'growth'}, sum=1, F(0)=0, F(1)=1, ratio == design table`,
            mono && Math.abs(sum - 1) < 1e-12 && Math.abs(f(0)) < 1e-12 && Math.abs(f(1) - 1) < 1e-12 && Math.abs(ratio - exp) < 5e-4);
    }
    for (const q of [0.8, 1.25, 1.5]) {
        const f = law({ kind: 'geometric', w: (E - 1) * Math.log(q) }, E), ws = widths(f, E);
        const ratios = ws.slice(1).map((x, i) => x / ws[i]);
        const constQ = ratios.every(r => Math.abs(r - q) < 1e-9), fl = ws[E - 1] / ws[0];
        console.log(`   geo q=${q}  widths ${fmt(ws)}`);
        console.log(`      consecutive ratios == q: ${constQ}  sum ${ws.reduce((s, x) => s + x, 0).toFixed(6)}  F(0)=${f(0).toFixed(6)} F(1)=${f(1).toFixed(6)}  last/first ${fl.toFixed(3)} (q^(E-1) = ${Math.pow(q, E - 1).toFixed(3)}, R = e^w)`);
        check(`geometric q=${q} E=${E}: constant ratio q, sum=1, F(0)=0, F(1)=1, last/first = q^(E-1)`,
            constQ && Math.abs(ws.reduce((s, x) => s + x, 0) - 1) < 1e-12 && Math.abs(f(0)) < 1e-12 && Math.abs(f(1) - 1) < 1e-12 && Math.abs(fl - Math.pow(q, E - 1)) < 1e-9 * fl);
    }
}
check('geometric: E<2 or w=0 is the identity (null law)', law({ kind: 'geometric', w: 1 }, 1) === null && law({ kind: 'geometric', w: 0 }, 4) === null && law({ kind: 'trig', w: 0 }, 4) === null);

// ============ 3. real pipeline: warped lattice ============
console.log('\n== 3. drawn endpoints lie on the warped node lattice ==');
{
    const E = 4, order = 5, size = W / SF;
    for (const [name0, spec0] of [['sinus', { x: { kind: 'trig', w: -0.8 }, y: 'same' }], ['tangens x / geometric y', { x: { kind: 'trig', w: 0.6 }, y: { kind: 'geometric', w: 1.2 } }]])
    for (const repeat of [true, false]) {
        const name = `${name0}, repeat ${repeat ? 'on' : 'off (closed)'}`, spec = { ...spec0, repeat };
        seed = 3; const sb = makeSb(SRC_NEW, 'square', 'none', order); sb.connections = randomConnections(sb, 6); sb.baseNetTransform = spec;
        const lines = draw(sb);
        const fx = sb.netAxisLaw(spec.x, E), fy = sb.netAxisLaw(spec.y === 'same' ? spec.x : spec.y, E);
        const x0 = sb.outerCorners[0].x, y0 = sb.outerCorners[0].y;
        const onLattice = (v, o, f) => { const s = (v - o) / size, k = Math.floor(s + 1e-9); const l = s - k; for (let i = 0; i <= E; i++) if (Math.abs(k + f(i / E) - s) < 1e-9) return true; return false; };
        let bad = 0, pts = 0;
        for (const [a, b, c, d] of lines) for (const [x, y] of [[a, b], [c, d]]) { pts++; if (!onLattice(x, x0, fx) || !onLattice(y, y0, fy)) bad++; }
        check(`${name}: ${pts} endpoints over all tiles on x0 + size*(k + f(i/E))`, bad === 0, `${bad} off-lattice`);
        // the centre-tile connection maps exactly
        const [n1, n2] = sb.connections[0].map(id => sb.nodes.find(n => n.id === id));
        const idx = n => [Math.floor((n.id - 1) / order), (n.id - 1) % order];
        const ex = n => { const [i, j] = idx(n); return [x0 + size * fx(i / E), y0 + size * fy(j / E)]; };
        const want = [...ex(n1), ...ex(n2)];
        check(`${name}: connection ${sb.connections[0]} drawn at the closed-form lattice positions`, lines.some(l => l.every((v, i) => Math.abs(v - want[i]) < 1e-9)));
    }
}

// ============ 4. sink consistency ============
console.log('\n== 4. canvas == segment collector == SVG ==');
{
    for (const repeat of [true, false]) {
    const spec = { x: { kind: 'trig', w: 0.5 }, y: { kind: 'geometric', w: 0.9, alternate: true }, repeat };
    seed = 9; const sb = makeSb(SRC_NEW, 'square', 'rotation_reflection6', 3); sb.connections = randomConnections(sb, 4); sb.baseNetTransform = spec;
    const lines = draw(sb);
    sb.segmentCollector = []; sb.drawTessellation(); const segs = sb.segmentCollector; sb.segmentCollector = null;
    sb.svgPathCollector = []; sb.drawTessellation(); const svg = sb.svgPathCollector; sb.svgPathCollector = null;
    const canvasSegs = lines.map(l => l.join(','));
    const collSegs = segs.map(s => [s.x1, s.y1, s.x2, s.y2].join(','));
    check(`repeat ${repeat ? 'on' : 'off'}: segment collector receives exactly the canvas segments, same order`, JSON.stringify(canvasSegs) === JSON.stringify(collSegs), `${lines.length} segments`);
    const num = v => v.toFixed(2);
    const svgSegs = svg.map(d => { const m = d.match(/M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)/); return m ? m.slice(1).join(',') : d; });
    check(`repeat ${repeat ? 'on' : 'off'}: SVG path data == canvas segments to 2 dp`, JSON.stringify(lines.map(l => l.map(num).join(','))) === JSON.stringify(svgSegs), `${svg.length} paths`);
    const un = fixture(SRC_NEW, 'square', 'rotation_reflection6', 3, null, 9); seed = 9;
    check('control: the warped output differs from the unwarped one', JSON.stringify(draw(un)) !== JSON.stringify(lines));
    }
}

// ============ 5. symmetry commutation ============
console.log('\n== 5. rot90 about the tile centre vs F ==');
const sbSym = makeSb(SRC_NEW, 'square', 'rotation_reflection6', 3);
const unit = { c0: { x: 0, y: 0 }, v1: { x: 1, y: 0 }, v2: { x: 0, y: 1 } }, ctr = { x: 0.5, y: 0.5 };
const commErr = (spec, E, n = 4000) => {
    const w = sbSym.makeNetWarp(spec, unit, E); let worst = 0;
    seed = 21; for (let i = 0; i < n; i++) { const p = { x: rnd() * 0.999, y: rnd() * 0.999 }; const a = sbSym.applyNetWarp(w, sbSym.rotateAround(p, ctr, 90)), b = sbSym.rotateAround(sbSym.applyNetWarp(w, p), ctr, 90); worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y)); }
    // the design session's single reference point
    const p0 = { x: 0.13, y: 0.71 }, a0 = sbSym.applyNetWarp(w, sbSym.rotateAround(p0, ctr, 90)), b0 = sbSym.rotateAround(sbSym.applyNetWarp(w, p0), ctr, 90);
    return { worst, ref: Math.hypot(a0.x - b0.x, a0.y - b0.y) };
};
const R = {
    'sinus, equal axes': commErr({ x: { kind: 'trig', w: -0.77 }, y: 'same' }, 4),
    'tangens, equal axes': commErr({ x: { kind: 'trig', w: 0.83 }, y: 'same' }, 4),
    'trig + alternate (inert)': commErr({ x: { kind: 'trig', w: -0.77, alternate: true }, y: 'same' }, 4),
    'geometric q=1.5 E=4, equal axes': commErr({ x: { kind: 'geometric', w: 3 * Math.log(1.5) }, y: 'same' }, 4),
    'geometric + alternate': commErr({ x: { kind: 'geometric', w: 3 * Math.log(1.5), alternate: true }, y: 'same' }, 4),
    'sinus x / tangens y (unequal)': commErr({ x: { kind: 'trig', w: -0.77 }, y: { kind: 'trig', w: 0.83 } }, 4)
};
for (const [k, v] of Object.entries(R)) console.log(`   ${k.padEnd(34)} worst over 4000 points ${v.worst.toExponential(2)}   reference point (0.13, 0.71): ${v.ref.toExponential(2)}`);
check('trig laws with equal axes commute with rot90 (odd about the centre)', R['sinus, equal axes'].worst < 1e-12 && R['tangens, equal axes'].worst < 1e-12 && R['trig + alternate (inert)'].worst < 1e-12);
check('geometric series does NOT commute (design session reference point: 0.3197)', R['geometric q=1.5 E=4, equal axes'].worst > 0.05 && Math.abs(R['geometric q=1.5 E=4, equal axes'].ref - 0.3197) < 5e-4, R['geometric q=1.5 E=4, equal axes'].ref.toFixed(4));
check('geometric + alternate does not commute either; unequal axes do not', R['geometric + alternate'].worst > 0.05 && R['sinus x / tangens y (unequal)'].worst > 0.05);
{   // the real symmetry engine: connections drawn at the centre tile
    const closure = spec => {
        seed = 4; const sb = makeSb(SRC_NEW, 'square', 'rotation_reflection6', 4); const conns = randomConnections(sb, 5);
        sb.activeNetWarp = sb.netWarpForBase(spec, 'square', sb.outerCorners, 4);
        sb.segmentCollector = []; sb.drawShapeCell(conns, sb.centroid, false, sb.nodes, 0, undefined, undefined, undefined); const segs = sb.segmentCollector; sb.segmentCollector = null;
        const c = sb.activeNetWarp ? sb.applyNetWarp(sb.activeNetWarp, sb.centroid) : sb.centroid;
        const key = (p, q) => [p, q].map(z => `${z.x.toFixed(6)},${z.y.toFixed(6)}`).sort().join('|');
        const set = new Set(segs.map(s => key({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 })));
        let missing = 0;
        for (const s of segs) { const r = (p) => sb.rotateAround(p, c, 90); if (!set.has(key(r({ x: s.x1, y: s.y1 }), r({ x: s.x2, y: s.y2 })))) missing++; }
        sb.activeNetWarp = null; return { total: segs.length, missing };
    };
    const t = closure({ x: { kind: 'trig', w: -0.77 }, y: 'same' }), g = closure({ x: { kind: 'geometric', w: 3 * Math.log(1.5) }, y: 'same' }), id = closure(null);
    console.log(`   real drawConnectionWithSymmetry, rot90 closure of the centre-tile segments: unwarped ${id.missing}/${id.total} missing, sinus ${t.missing}/${t.total}, geometric ${g.missing}/${g.total}`);
    check('symmetry engine output stays 90-degree closed under an equal-axes trig warp', t.missing === 0 && id.missing === 0);
    check('...and is not closed under the geometric series', g.missing > 0);
}

// ============ 6. alternate parity ============
console.log('\n== 6. tile seams ==');
{
    const E = 4, R = 1.5 ** 3;
    const seam = alt => {
        const w = sbSym.makeNetWarp({ x: { kind: 'geometric', w: Math.log(R), alternate: alt }, y: { kind: 'uniform', w: 0 } }, unit, E);
        const xs = []; for (let k = 0; k < 4 * E; k++) xs.push(sbSym.applyNetWarp(w, { x: k / E + 1e-15, y: 0.3 }).x); xs.push(sbSym.applyNetWarp(w, { x: 4, y: 0.3 }).x);
        return xs.slice(1).map((x, i) => x - xs[i]);
    };
    const plain = seam(false), alt = seam(true);
    const jump = ws => [1, 2, 3].map(t => ws[t * E] / ws[t * E - 1]);
    console.log(`   width ratio across seams 1..3 - plain: ${jump(plain).map(x => x.toFixed(4)).join(' ')}   alternate: ${jump(alt).map(x => x.toFixed(4)).join(' ')}   (1/R = ${(1 / R).toFixed(4)})`);
    check('plain per-tile domain: widths jump by 1/R at every seam', jump(plain).every(x => Math.abs(x - 1 / R) < 1e-9));
    check('alternate: widths continuous across seams (ratio 1); tile-boundary nodes fixed', jump(alt).every(x => Math.abs(x - 1) < 1e-9));
    const w = sbSym.makeNetWarp({ x: { kind: 'geometric', w: 1.3, alternate: true }, y: { kind: 'uniform', w: 0 } }, unit, E);
    check('boundary nodes fixed in both parities: F(k)=k', [-2, -1, 0, 1, 2, 3, 4].every(k => Math.abs(sbSym.applyNetWarp(w, { x: k, y: 0 }).x - k) < 1e-12));
    const a = sbSym.makeNetWarp({ x: { kind: 'trig', w: -0.6, alternate: true }, y: 'same' }, unit, E), b = sbSym.makeNetWarp({ x: { kind: 'trig', w: -0.6 }, y: 'same' }, unit, E);
    let worst = 0; for (let i = 0; i < 2000; i++) { const p = { x: -3 + rnd() * 6, y: -3 + rnd() * 6 }; const u = sbSym.applyNetWarp(a, p), v = sbSym.applyNetWarp(b, p); worst = Math.max(worst, Math.hypot(u.x - v.x, u.y - v.y)); }
    check('alternate is inert for the trig laws', worst < 1e-12, worst.toExponential(2));
}

// ============ 7. faces skipped, no leak ============
console.log('\n== 7. faces / leak ==');
{
    const mk = spec => { seed = 2; const sb = fixture(SRC_NEW, 'square', 'rotation_reflection6', 3, spec, 2); sb.showFaces = true; return sb; };
    for (const [name, spec, expectCalls] of [['no warp', null, true], ['warp active', { x: { kind: 'trig', w: -0.5 }, y: 'same' }, false]]) {
        const sb = mk(spec); let calls = 0, lcalls = 0; const o = sb.computeCellFaces, ol = sb.computeLayerCellFaces;
        sb.computeCellFaces = (...a) => { calls++; return o.apply(sb, a); }; sb.computeLayerCellFaces = (...a) => { lcalls++; return ol.apply(sb, a); };
        sb.drawTessellation();
        check(`${name}: face detection ${expectCalls ? 'runs' : 'is skipped'}`, expectCalls ? (calls === 1 && lcalls === 1) : (calls === 0 && lcalls === 0), `computeCellFaces ${calls}, computeLayerCellFaces ${lcalls}`);
    }
    const sb = mk({ x: { kind: 'trig', w: -0.5 }, y: 'same' });
    sb.drawTessellation(); check('activeNetWarp is null after a redraw', sb.activeNetWarp === null);
    sb.line = () => { throw new Error('boom'); };
    let threw = false; try { sb.drawTessellation(); } catch (e) { threw = true; }
    check('activeNetWarp is cleared even when drawing throws', threw && sb.activeNetWarp === null);
    // face detection outside drawTessellation sees the regular geometry
    const sw = mk({ x: { kind: 'trig', w: -0.5 }, y: 'same' }), sr = mk(null);
    const norm = s => JSON.stringify(s);
    check('collectCellSegments() outside a redraw is unwarped (same as no spec)', norm(sw.collectCellSegments(sw.connections, sw.nodes)) === norm(sr.collectCellSegments(sr.connections, sr.nodes)));
}

// ============ 8. closed net (repeat off): one tile, nothing outside ============
console.log('\n== 8. closed net vs repeat ==');
{
    const SPEC = { x: { kind: 'trig', w: -0.8 }, y: 'same' };
    const rectOf = sb => { const c = sb.outerCorners; return { x0: c[0].x, y0: c[0].y, x1: c[2].x, y1: c[2].y }; };
    const inside = (l, r, tol = 1e-6, m = 0) => [[l[0], l[1]], [l[2], l[3]]].every(([x, y]) => x >= r.x0 - tol - m && x <= r.x1 + tol + m && y >= r.y0 - tol - m && y <= r.y1 + tol + m);
    const segKey = l => { const q = v => Math.round(v * 1e4) / 1e4, a = [q(l[0]), q(l[1])], b = [q(l[2]), q(l[3])]; return (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a]).join('|'); };
    let cases = 0, outside = 0, mismatch = 0, tileBad = 0, altDiff = 0;
    for (const sf of [1, 2, 3, 5, 9]) for (const order of [3, 4, 5]) for (const mode of ['rotation_reflection6', 'rotation6', 'reflection_only', 'none']) {
        const build = spec => { seed = 40 + order; const sb = makeSb(SRC_NEW, 'square', mode, order); sb.shapeSizeFactor = sf; const g = sb.buildSquareGrid(order, sf, W, W); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners; sb.connections = randomConnections(sb, 4); sb.baseNetTransform = spec; return sb; };
        const closed = build(SPEC), rep = build({ ...SPEC, repeat: true }), r = rectOf(closed);
        let calls = 0; const o = closed.drawShapeCell; closed.drawShapeCell = function (...a) { calls++; return o.apply(this, a); };
        const lc = draw(closed), lr = draw(rep); cases++;
        if (calls !== 1) tileBad++;
        if (!lc.every(l => inside(l, r))) outside++;
        // exactly what the repeated drawing has inside the net rectangle - nothing lost, nothing added
        // (a segment lying wholly ON the rectangle's boundary is left out of both: a repeated drawing also carries the
        // neighbour tile's own edge lines there, which a closed net does not have)
        const onEdge = l => (l[0] === l[2] || Math.abs(l[0] - l[2]) < 1e-6) && [r.x0, r.x1].some(v => Math.abs(l[0] - v) < 1e-6) || (Math.abs(l[1] - l[3]) < 1e-6 && [r.y0, r.y1].some(v => Math.abs(l[1] - v) < 1e-6));
        const want = new Set(lr.filter(l => inside(l, r) && !onEdge(l)).map(segKey)), got = new Set(lc.filter(l => !onEdge(l)).map(segKey));
        if (want.size !== got.size || [...want].some(k => !got.has(k))) mismatch++;
        const alt = build({ x: { kind: 'geometric', w: 1.1, alternate: true }, y: 'same' }), noalt = build({ x: { kind: 'geometric', w: 1.1 }, y: 'same' });
        const la = draw(alt), ln = draw(noalt);   // equal up to float noise (a point exactly on the tile edge takes k=1, the odd branch)
        if (la.length !== ln.length || la.some((l, i) => l.some((v, j) => Math.abs(v - ln[i][j]) > 1e-9))) altDiff++;
    }
    check('closed: the base sheet visits exactly one tile (drawShapeCell called once)', tileBad === 0, `${cases} cases (Shape Size 1/2/3/5/9 x order 3/4/5 x 4 modes)`);
    check('closed: every drawn endpoint lies inside the net rectangle', outside === 0, `${outside} escaping`);
    check('closed: the drawn segments equal the repeated drawing restricted to the net rectangle', mismatch === 0, `${mismatch} differing`);
    check('closed: `alternate` has no effect (no seams in one tile)', altDiff === 0);

    // a smaller layer (half the tile size: 2x2 sub-tiles) fills the net with ITS OWN tile count, not one tile
    const mkLayer = (sb, extra) => { const g = sb.layerGrid(sb.outerCorners, sb.centroid, sb.currentShape, sb.shapeSizeFactor, sb.shapeSizeFactor * 2, 3, 'square', W, W); const l = { connections: [[1, 9], [3, 7]], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape: 'square', symmetryMode: sb.symmetryMode, enabled: true, showFaces: false, nodeCount: 3, shapeSizeFactor: sb.shapeSizeFactor * 2, nodes: g.nodes, centroid: g.centroid, outerCorners: g.outerCorners, ...extra }; sb.additionalLayers.push(l); return l; };
    {
        const sb = makeSb(SRC_NEW, 'square', 'rotation_reflection6', 3); sb.shapeSizeFactor = 3; const g = sb.buildSquareGrid(3, 3, W, W); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners; sb.connections = [[1, 9]];
        mkLayer(sb, {}); sb.baseNetTransform = SPEC;
        const layerCalls = []; const o = sb.drawShapeCell; sb.drawShapeCell = function (...a) { layerCalls.push(a[1]); return o.apply(this, a); };
        const lines = draw(sb), r = rectOf(sb);
        const layerTiles = layerCalls.length - 1;
        // the half-size layer's lattice has a tile CENTRED on the shared centroid, so 3 tiles per axis meet the net (its outer
        // tiles reach half a layer tile past the net: layer spill, a phase 3 question) - and one (0,0) tile would be wrong
        check('closed: a half-size layer gets every tile that meets the net (3x3), not a single (0,0) tile; spill <= half a layer tile', layerTiles === 9 && lines.every(l => inside(l, r, 1e-6, 25)), `${layerTiles} layer tiles`);
    }
    // an OFFSET layer spills past the net: it must degrade sensibly - finite, no crash, bounded by rect + offset
    {
        const sb = makeSb(SRC_NEW, 'square', 'rotation_reflection6', 4); sb.shapeSizeFactor = 3; const g = sb.buildSquareGrid(4, 3, W, W); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners; sb.connections = [[1, 16], [4, 13]];
        const g2 = sb.layerGrid(sb.outerCorners, sb.centroid, 'square', 3, 3, 4, 'square', W, W);
        sb.additionalLayers.push({ connections: [[2, 15], [5, 12]], redoStack: [], offsetX: 30, offsetY: -20, rotation: 0, shape: 'square', symmetryMode: 'rotation_reflection6', enabled: true, showFaces: false, nodeCount: 4, shapeSizeFactor: 3, nodes: g2.nodes, centroid: g2.centroid, outerCorners: g2.outerCorners });
        sb.baseNetTransform = SPEC; let lines, threw = false; try { lines = draw(sb); } catch (e) { threw = true; }
        const r = rectOf(sb);
        check('closed + an offset layer: draws, finite, and stays within the net rectangle widened by one tile + the layer offset (its neighbouring tiles show at the edge)', !threw && lines.length > 0 && lines.every(l => l.every(Number.isFinite)) && lines.every(l => inside(l, r, 1e-6, 131)), `${lines && lines.length} lines`);
    }
    // repeat on is exactly the previous behaviour: same lines as the HEAD~ code path would draw (the old code always repeated)
    let same = 0, n = 0;
    for (const order of [3, 4]) for (const sf of [2, 5]) {
        const spec = { x: { kind: 'trig', w: -0.6 }, y: { kind: 'geometric', w: 0.8, alternate: true }, repeat: true };
        const build = src => { seed = 70 + order; const sb = makeSb(src, 'square', 'rotation_reflection6', order); sb.shapeSizeFactor = sf; const g = sb.buildSquareGrid(order, sf, W, W); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners; sb.connections = randomConnections(sb, 4); sb.baseNetTransform = spec; return sb; };
        n++; if (JSON.stringify(draw(build(SRC_OLD))) === JSON.stringify(draw(build(SRC_NEW)))) same++;
    }
    check('repeat on: byte-identical to the previous commit (the behaviour before the closed-net option)', same === n, `${same}/${n}`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
