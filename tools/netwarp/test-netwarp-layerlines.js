/**
 * tools/netwarp/test-netwarp-layerlines.js
 * Roadmap 1.6 / Group E, layer-spill stage 1: exact layer LINES on a FIELD warp. F is piecewise affine on a field (kinks on the
 * base-tile boundary lines), so a straight segment that crosses a boundary - only a layer's can - maps to a POLYLINE, not to the
 * chord between the mapped endpoints. The sink (core/curves.js drawCurvedBezier()) now draws that polyline
 * (core/netwarp.js netWarpSplitSegment()).
 *
 *   node tools/netwarp/test-netwarp-layerlines.js
 *
 *  1. The splitting itself: crossings at integer tile coordinates, corners once, boundary-touching segments untouched.
 *  2. The investigation's own example: (30,390) -> (150,510) on the 120 px field, chord off by 15.22 px, polyline exact.
 *  3. The real pipeline with layers (offset / rotation / larger and smaller tiles): every drawn polyline equals the true
 *     image F(segment) to ~1e-13 px; the previous commit's chords miss it by whole pixels.
 *  4. Zero regression: base-only drawings are byte-identical to the previous commit (BASE below) and every base segment is
 *     ONE piece; Single / Tiled warps and curves are byte-identical too.
 *  5. SVG: an affected segment is ONE path with several L commands; an unaffected one is M ... L as before.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = 'eef20c1d';   // the last commit before the segment decomposition
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export'];
const load = old => FILES.map(f => old ? execSync(`git show ${BASE}:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString() : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const SRC_NEW = load(false), SRC_OLD = load(true);
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const W = 600;
function makeSb(src, order, sf, mode) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        line: (a, b, c, d) => sb.lines.push([a, b, c, d]), bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, stroke: () => { }, noFill: () => { }, CLOSE: 'close',
        fill: c => { sb._fill = c; }, beginShape: () => { sb._cur = []; }, vertex: (x, y) => { sb._cur.push({ x, y }); }, endShape: () => { sb.polys.push({ fill: sb._fill, pts: sb._cur }); sb._cur = null; },
        document: { body: {} }, getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }), showNodes: true, width: W, height: W, showFaces: false,
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, activeNetWarp: null, lineColor: '#000000', altNetSeed: null,
        currentShape: 'square', shapeSizeFactor: sf, nodeCount: order, symmetryMode: mode, timeline: null, activeLayer: 'base',
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, lines: [], polys: []
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb); vm.runInContext(src, sb);
    const g = sb.buildSquareGrid(order, sf, W, W); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
    return sb;
}

let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const FIELD = { x: { kind: 'trig', w: -1 }, y: 'same', domain: 'field' };
const distSeg = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy; let t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); };
const CONNS = [[1, 16], [4, 13], [2, 8], [8, 15], [15, 9], [9, 2]];
function build(src, order, R, spec, layers, mode) {
    const sb = makeSb(src, order, R, mode || 'none'); sb.baseNetTransform = spec;
    sb.connections = []; sb.additionalLayers = layers.map(o => {
        const L = { connections: (o.connections || CONNS).map(c => c.slice()), redoStack: [], offsetX: o.offsetX || 0, offsetY: o.offsetY || 0, rotation: o.rotation || 0, shape: 'square', symmetryMode: mode || 'none', enabled: true, showFaces: false, nodeCount: o.nodeCount || order, shapeSizeFactor: o.shapeSizeFactor || R };
        const g = sb.layerGrid(sb.outerCorners, sb.centroid, 'square', R, L.shapeSizeFactor, L.nodeCount, 'square', W, W); L.nodes = g.nodes; L.centroid = g.centroid; L.outerCorners = g.outerCorners; return L;
    });
    return sb;
}
// every call of the sink, with the line() calls it produced
function drawRecorded(sb) {
    const calls = [], orig = sb.drawCurvedBezier;
    sb.drawCurvedBezier = function (p1, p2, ct, a, b) { const i0 = sb.lines.length; orig.call(this, p1, p2, ct, a, b); calls.push({ p1, p2, from: i0, to: sb.lines.length }); };
    sb.lines = []; sb.drawTessellation(); sb.drawCurvedBezier = orig; return calls;
}
const chain = (sb, c) => { const pts = []; for (let i = c.from; i < c.to; i++) { const l = sb.lines[i]; if (i === c.from) pts.push({ x: l[0], y: l[1] }); pts.push({ x: l[2], y: l[3] }); } return pts; };
const trueDev = (sb, W, c) => { const pts = chain(sb, c); let d = 0; for (let i = 1; i < 300; i++) { const t = i / 300, q = sb.applyNetWarp(W, { x: c.p1.x + t * (c.p2.x - c.p1.x), y: c.p1.y + t * (c.p2.y - c.p1.y) }); let m = 1e9; for (let k = 0; k < pts.length - 1; k++) m = Math.min(m, distSeg(q, pts[k], pts[k + 1])); d = Math.max(d, m); } return d; };

// ============ 1. the splitting ============
console.log('== 1. netWarpSplitSegment ==');
{
    const sb = build(SRC_NEW, 4, 5, FIELD, []), Wp = sb.makeNetWarp(FIELD, { c0: { x: 240, y: 240 }, v1: { x: 120, y: 0 }, v2: { x: 0, y: 120 } }, 3, 5);
    const sp = (a, b) => sb.netWarpSplitSegment(Wp, a, b);
    const s1 = sp({ x: 30, y: 390 }, { x: 150, y: 510 });
    check('the investigation\'s segment (30,390)->(150,510) crosses exactly at the corner (120,480): ONE split point', s1 && s1.length === 3 && Math.abs(s1[1].x - 120) < 1e-9 && Math.abs(s1[1].y - 480) < 1e-9, JSON.stringify(s1));
    check('a segment inside one tile is not split (null); nor is one along a boundary, ending on it, or leaving it (the boundary x = 120 crossed only by y = 120)', sp({ x: 250, y: 250 }, { x: 350, y: 350 }) === null && sp({ x: 120, y: 130 }, { x: 120, y: 230 }) === null && sp({ x: 100, y: 130 }, { x: 120, y: 220 }) === null && sp({ x: 120, y: 130 }, { x: 60, y: 230 }) === null && sp({ x: 120, y: 30 }, { x: 120, y: 200 }).length === 3);
    const s2 = sp({ x: 10, y: 10 }, { x: 590, y: 20 });
    check('a long segment across the whole field crosses every interior boundary once: 4 vertical lines -> 4 points in order, all on the segment', s2 && s2.length === 6 && s2.every((p, i) => i === 0 || p.x > s2[i - 1].x) && [1, 2, 3, 4].every(i => Math.abs(s2[i].x - 120 * i) < 1e-9 && Math.abs(s2[i].y - (10 + (120 * i - 10) / 580 * 10)) < 1e-9));
    check('crossings are only at kinks: none at the field\'s outer edge (x = 0 / 600) or beyond it', sp({ x: -50, y: 300 }, { x: 5, y: 300 }) === null && sp({ x: 595, y: 300 }, { x: 650, y: 300 }) === null && sp({ x: -100, y: 300 }, { x: 5, y: 300 }) === null);
    const single = sb.makeNetWarp({ ...FIELD, domain: 'single' }, { c0: { x: 240, y: 240 }, v1: { x: 120, y: 0 }, v2: { x: 0, y: 120 } }, 3, 5);
    check('no field -> null (Single / Tiled untouched); an identity axis has no kinks', sb.netWarpSplitSegment(single, { x: 30, y: 390 }, { x: 150, y: 510 }) === null && (() => { const w = sb.makeNetWarp({ x: { kind: 'trig', w: -1 }, y: { kind: 'uniform', w: 0 }, domain: 'field' }, { c0: { x: 240, y: 240 }, v1: { x: 120, y: 0 }, v2: { x: 0, y: 120 } }, 3, 5), r = sb.netWarpSplitSegment(w, { x: 30, y: 390 }, { x: 150, y: 510 }); return r && r.length === 3 && Math.abs(r[1].x - 120) < 1e-9; })());
}

// ============ 2. the investigation's example ============
console.log('\n== 2. the 15.22 px example ==');
{
    const one = src => { const sb = build(src, 4, 5, FIELD, []); sb.activeNetWarp = sb.netWarpBaseNow(); sb.lines = []; sb.drawCurvedBezier({ x: 30, y: 390 }, { x: 150, y: 510 }, { kind: 'straight' }); return { sb, lines: sb.lines, W: sb.activeNetWarp }; };
    const o = one(SRC_OLD), n = one(SRC_NEW), F = n.sb.applyNetWarp(n.W, { x: 120, y: 480 });
    const devOld = distSeg(F, { x: o.lines[0][0], y: o.lines[0][1] }, { x: o.lines[0][2], y: o.lines[0][3] });
    const dN = Math.min(...n.lines.map(l => distSeg(F, { x: l[0], y: l[1] }, { x: l[2], y: l[3] })));
    console.log(`   F(120,480) = (${F.x.toFixed(2)}, ${F.y.toFixed(2)}); previous commit: ${o.lines.length} chord, ${devOld.toFixed(2)} px off; now: ${n.lines.length} pieces, ${dN.toExponential(1)} px off`);
    check('previous commit: ONE chord that misses the image of the corner by 15.22 px', o.lines.length === 1 && Math.abs(devOld - 15.22) < 0.01, devOld.toFixed(2));
    check('now: two pieces through F(120,480) = (81.04, 518.96), off by < 1e-9 px, joined end to start', n.lines.length === 2 && dN < 1e-9 && Math.abs(F.x - 81.04) < 0.01 && Math.abs(F.y - 518.96) < 0.01 && n.lines[0][2] === n.lines[1][0] && n.lines[0][3] === n.lines[1][1]);
    check('the outer endpoints are unchanged (the same mapped points as the chord)', n.lines[0][0] === o.lines[0][0] && n.lines[0][1] === o.lines[0][1] && n.lines[1][2] === o.lines[0][2] && n.lines[1][3] === o.lines[0][3]);
}

// ============ 3. the real pipeline, layers ============
console.log('\n== 3. real pipeline with layers: every polyline is the true image ==');
{
    let worstNew = 0, worstOld = 0, cfgs = 0, segs = 0, inexactOld = 0, multi = 0;
    for (const R of [3, 5, 7]) for (const order of [3, 4]) for (const lay of [{ offsetX: 30, offsetY: 30 }, { offsetX: 60, offsetY: 60 }, { rotation: 17 }, { shapeSizeFactor: R + 4 }, { shapeSizeFactor: Math.max(1, R - 2), offsetX: 40 }, { rotation: 33, offsetX: 20, offsetY: 50 }]) for (const spec of [FIELD, { x: { kind: 'trig', w: 0.7, focus: -0.5 }, y: { kind: 'geometric', w: -1 }, domain: 'field' }]) {
        const conns = order === 4 ? CONNS : [[1, 9], [3, 7], [2, 6], [6, 8], [8, 4]];
        const sn = build(SRC_NEW, order, R, spec, [{ ...lay, connections: conns }]), so = build(SRC_OLD, order, R, spec, [{ ...lay, connections: conns }]);
        const cn = drawRecorded(sn), co = drawRecorded(so), Wn = sn.netWarpBaseNow(); cfgs++;
        cn.forEach((c, i) => { segs++; const dn = trueDev(sn, Wn, c); worstNew = Math.max(worstNew, dn); const doo = trueDev(so, so.netWarpBaseNow(), co[i]); worstOld = Math.max(worstOld, doo); if (doo > 1e-6) inexactOld++; if (c.to - c.from > 1) multi++; });
    }
    check(`every drawn segment equals the true image F(segment) to ${worstNew.toExponential(1)} px (offset / rotation / larger and smaller tiles, two law pairs, R 3/5/7)`, worstNew < 1e-9, `${cfgs} configurations, ${segs} segments`);
    console.log(`   previous commit on the same drawings: worst ${worstOld.toFixed(1)} px off, ${inexactOld} segments inexact; now ${multi} segments drawn as polylines`);
    check('control: the previous commit\'s chords really were inexact on these drawings (> 10 px worst, thousands of segments)', worstOld > 10 && inexactOld > 1000);
}

// ============ 4. zero regression ============
console.log('\n== 4. zero regression ==');
{
    let cfgs = 0, bad = 0, multiBase = 0, lines = 0;
    for (const R of [3, 5, 7]) for (const order of [3, 4]) for (const mode of ['rotation_reflection6', 'none']) for (const spec of [FIELD, { x: { kind: 'trig', w: -1, focus: 0.5 }, y: 'same', domain: 'field' }]) {
        seed = 90 + R + order; const ids = build(SRC_NEW, order, R, spec, [], mode).nodes.map(n => n.id), conns = []; while (conns.length < 6) { const a = ids[Math.floor(rnd() * ids.length)], b = ids[Math.floor(rnd() * ids.length)]; if (a !== b) conns.push([a, b]); }
        const sn = build(SRC_NEW, order, R, spec, [], mode), so = build(SRC_OLD, order, R, spec, [], mode); sn.connections = conns.map(c => c.slice()); so.connections = conns.map(c => c.slice());
        const cn = drawRecorded(sn), co = drawRecorded(so); cfgs++; lines += sn.lines.length;
        if (JSON.stringify(sn.lines) !== JSON.stringify(so.lines)) bad++;
        multiBase += cn.filter(c => c.to - c.from !== 1).length;
        // same-scale, rotation-0, offset-0 layer (drawn inside the base loop) is a base-aligned copy: also one piece
        const sl = build(SRC_NEW, order, R, spec, [{ connections: conns }], mode); sl.connections = conns.map(c => c.slice()); multiBase += drawRecorded(sl).filter(c => c.to - c.from !== 1).length;
    }
    check(`base-only drawings are byte-identical to ${BASE} (every line() call), Field with and without a focus`, bad === 0 && lines > 1000, `${cfgs} configurations, ${lines} lines`);
    check('every base segment (and an aligned offset-0 same-scale layer) is exactly ONE piece', multiBase === 0);
    let nb = 0, nbad = 0;
    for (const dom of [{ repeat: false }, { repeat: true }, { domain: 'single' }, { domain: 'tiled' }]) for (const lay of [{ offsetX: 30, offsetY: 30 }, { rotation: 17 }]) for (const spec of [{ x: { kind: 'trig', w: -1 }, y: 'same' }, { x: { kind: 'geometric', w: 1.2 }, y: 'same' }]) {
        const sn = build(SRC_NEW, 4, 5, { ...spec, ...dom }, [lay]), so = build(SRC_OLD, 4, 5, { ...spec, ...dom }, [lay]); drawRecorded(sn); drawRecorded(so); nb++; if (JSON.stringify(sn.lines) !== JSON.stringify(so.lines)) nbad++;
    }
    check('Single and Tiled warps with layers are byte-identical to the previous commit (the decomposition is Field-only)', nbad === 0, `${nb} configurations`);
    const cur = { kind: 'curve', strength: 60, fold: 0 };
    const sc = (src) => { const sb = build(src, 4, 5, FIELD, []); sb.activeNetWarp = sb.netWarpBaseNow(); sb.lines = []; try { sb.drawCurvedBezier({ x: 30, y: 390 }, { x: 150, y: 510 }, cur); } catch (e) { return 'threw:' + e.message; } return JSON.stringify(sb.lines); };
    check('a curve on a field is untouched (the decomposition is straight-lines-only)', sc(SRC_NEW) === sc(SRC_OLD));
}

// ============ 5. SVG and the collector ============
console.log('\n== 5. SVG / collector ==');
{
    const run = (src, p1, p2, mode) => { const sb = build(src, 4, 5, FIELD, []); sb.activeNetWarp = sb.netWarpBaseNow(); if (mode === 'svg') sb.svgPathCollector = []; else if (mode === 'seg') sb.segmentCollector = []; sb.drawCurvedBezier(p1, p2, { kind: 'straight' }); return mode === 'svg' ? sb.svgPathCollector : sb.segmentCollector; };
    const cross = run(SRC_NEW, { x: 30, y: 390 }, { x: 150, y: 510 }, 'svg'), plain = run(SRC_NEW, { x: 250, y: 250 }, { x: 350, y: 350 }, 'svg'), plainOld = run(SRC_OLD, { x: 250, y: 250 }, { x: 350, y: 350 }, 'svg');
    console.log('   crossing:', cross[0], '\n   inside a tile:', plain[0]);
    check('an affected segment is ONE path: M x y L x y L x y (a polyline through F(120,480) = 81.04 518.96)', cross.length === 1 && /^M [\d.]+ [\d.]+ L 81\.04 518\.96 L [\d.]+ [\d.]+$/.test(cross[0]), cross[0]);
    check('an unaffected segment is M x y L x y exactly as before', plain.length === 1 && /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/.test(plain[0]) && plain[0] === plainOld[0]);
    const sg = run(SRC_NEW, { x: 30, y: 390 }, { x: 150, y: 510 }, 'seg');
    check('the segment collector receives the pieces (2 joined segments) - it is only used by face detection, which switches the warp off', sg.length === 2 && sg[0].x2 === sg[1].x1 && sg[0].y2 === sg[1].y1);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
