/**
 * tools/netwarp/test-netwarp-field.js
 * Roadmap 1.6 / Group E, Model 2 ("field"): the law over the WHOLE repeated span (R x R tiles, R = Shape Size,
 * odd 3..9, the base tile the central macro cell); each tile an affine copy of the clicked pattern.
 *
 *   node tools/netwarp/test-netwarp-field.js
 *
 *  1. repeat -> domain migration: a spec without `domain` (repeat true/false) and explicit 'single'/'tiled'
 *     draw EXACTLY the previous commit's line() calls; the export description of legacy specs is unchanged.
 *  2. The worked example (Node Count 4, Shape Size 3, Sinus 1.00) and the R = 5/7/9 tile-width table.
 *  3. Affine copies: every node of every tile sits at P_k + l*w_k; exactly R x R tiles are drawn, nothing outside.
 *  4. Lines map to lines: crossings inside a tile map exactly.
 *  5. Oddness / commutation about the centroid for the whole field; the real symmetry engine stays closed.
 *  6. The inverse: closed form per tile (0 evaluations of f), accurate inside and outside the field.
 *  7. Validity: an invalid field is ignored, visibly, and falls back to the legacy reading.
 *  8. Overlay: macro lines at the tile boundaries, micro lines from the clicked tile's own E.
 *  9. Export: domain 'field', fieldTiles, tileBoundaries; round trip; legacy exports unchanged.
 * 10. Free endpoints (option b): a click on any tile maps back into the central tile.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor'];
const load = fromHead => FILES.map(f => fromHead ? execSync(`git show HEAD:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString() : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const SRC_NEW = load(false), SRC_OLD = load(true);
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const W = 600;
function makeSb(src, order, sf, mode) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        line: (a, b, c, d) => sb.lines.push([a, b, c, d]), bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, noFill: () => { }, stroke: () => { },
        fill: () => { }, beginShape: () => { }, vertex: () => { }, endShape: () => { }, CLOSE: 'close',
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, lineColor: '#000', altNetSeed: null,
        currentShape: 'square', shapeSizeFactor: sf, nodeCount: order, symmetryMode: mode, width: W, height: W, showFaces: false,
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, activeLayer: 'base', timeline: null,
        baseNetTransform: null, activeNetWarp: null, lines: []
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb); vm.runInContext(src, sb);
    const g = sb.buildSquareGrid(order, sf, W, W); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
    return sb;
}
let seed = 17; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gaps = a => a.slice(1).map((v, i) => +(v - a[i]).toFixed(2));
const r2 = v => +v.toFixed(2);
const S = { x: { kind: 'trig', w: -1 }, y: 'same' };
const draw = (sb, spec, conns, mode) => { sb.baseNetTransform = spec; sb.connections = conns; if (mode) sb.symmetryMode = mode; sb.lines = []; sb.drawTessellation(); return sb.lines; };
const randConns = (sb, n) => { const ids = sb.nodes.map(x => x.id), out = []; while (out.length < n) { const a = ids[Math.floor(rnd() * ids.length)], b = ids[Math.floor(rnd() * ids.length)]; if (a !== b) out.push([a, b]); } return out; };

// ============ 1. migration ============
console.log('== 1. repeat -> domain migration: byte-identical ==');
{
    const LEG = [{ x: { kind: 'trig', w: -0.8 }, y: 'same' }, { x: { kind: 'trig', w: 0.6 }, y: { kind: 'trig', w: -0.4 } }, { x: { kind: 'geometric', w: 1.3, alternate: true }, y: 'same' }, { x: { kind: 'trig', w: -1 }, y: 'same', macro: 3 }];
    let n = 0, bad = 0, lines = 0, badE = 0, nE = 0;
    for (const order of [3, 4, 7]) for (const sf of [1, 2, 3, 5]) for (const base of LEG) for (const [suffix, equivalents] of [[{ repeat: false }, [{}, { repeat: false }, { domain: 'single' }, { domain: 'single', repeat: true }]], [{ repeat: true }, [{ repeat: true }, { domain: 'tiled' }, { domain: 'tiled', repeat: false }]]]) {
        const mk = src => { seed = 50 + order; const sb = makeSb(src, order, sf, 'rotation_reflection6'); sb.connections = randConns(sb, 3); return sb; };
        const ref = (() => { const sb = mk(SRC_OLD); sb.baseNetTransform = { ...base, ...suffix }; sb.lines = []; sb.drawTessellation(); return sb.lines; })();
        for (const eq of equivalents) {
            const sb = mk(SRC_NEW); sb.baseNetTransform = { ...base, ...eq }; sb.lines = []; sb.drawTessellation();
            n++; lines += sb.lines.length; if (JSON.stringify(ref) !== JSON.stringify(sb.lines)) bad++;
        }
    }
    check('domain absent / repeat true|false / explicit \'single\' | \'tiled\' (domain wins over a conflicting repeat): exactly the previous commit\'s line() calls', bad === 0, `${n} drawings, ${lines} lines, ${bad} differ`);
    const oldSb = makeSb(SRC_OLD, 7, 3, 'none'), newSb = makeSb(SRC_NEW, 7, 3, 'none');
    for (const base of LEG) for (const rep of [false, true]) for (const E of [3, 6]) { const sp = { ...base, repeat: rep }; nE++; if (JSON.stringify(oldSb.netTransformExportData(sp, E)) !== JSON.stringify(newSb.netTransformExportData(sp, E, 3))) badE++; }
    check('the export description of legacy specs (meta.netTransform) is byte-identical - no new keys', badE === 0, `${nE} specs`);
    let badR = 0, nR = 0;
    for (const base of LEG) for (const rep of [false, true]) { const ex = JSON.parse(JSON.stringify(newSb.netTransformExportData({ ...base, repeat: rep }, 6, 3))), back = newSb.netTransformFromExport(ex), old = oldSb.netTransformFromExport(JSON.parse(JSON.stringify(oldSb.netTransformExportData({ ...base, repeat: rep }, 6)))); nR++; if (JSON.stringify(back) !== JSON.stringify(old)) badR++; }
    check('netTransformFromExport() of a legacy export gives the same spec as before (no `domain` key added)', badR === 0, `${nR} round trips`);
}

// ============ 2. worked example and the width table ============
console.log('\n== 2. the worked example and R = 5 / 7 / 9 ==');
{
    const sb = makeSb(SRC_NEW, 4, 3, 'none'); sb.baseNetTransform = { ...S, domain: 'field' };
    const w = sb.netWarpBaseNow(), n = 4, T = 200;
    check('domain field at Shape Size 3 is a field warp (R = 3, h = 1), not ignored', w && w.field && w.field.Rt === 3 && w.field.h === 1 && w.domainIgnored === null);
    // the ten x positions of the field: the regular lattice x = 0, 66.67, ... 600 through the warp
    const reg = [...Array(10).keys()].map(i => i * (600 / 9)), xs = reg.map(x => sb.applyNetWarp(w, { x, y: 100 }).x);
    const EXPECT = [0, 56.42, 112.84, 169.27, 256.42, 343.58, 430.73, 487.16, 543.58, 600];
    console.log('   field x:', xs.map(r2).join(', '), '\n   gaps:   ', gaps(xs).join(' / '));
    check('the 10 node x positions (Model 2, macro gaps 169.27 / 261.47 / 169.27, uniform inside each tile)', xs.every((v, i) => Math.abs(v - EXPECT[i]) < 0.006));
    // the real pipeline: connect the central tile's row (ids 1,5,9,13), symmetry off, read every emitted endpoint
    sb.symmetryMode = 'none'; const ids = [...Array(n).keys()].map(i => i * n + 1); const lines = draw(sb, sb.baseNetTransform, ids.slice(1).map((id, i) => [ids[i], id]), 'none');
    const dx = [...new Set(lines.flatMap(l => [l[0], l[2]]).map(v => +v.toFixed(3)))].filter(v => v >= -1e-6 && v <= 600 + 1e-6).sort((a, b) => a - b);
    check('the same ten values in the segments the real drawing emits, across all 9 tiles', dx.length === 10 && dx.every((v, i) => Math.abs(v - EXPECT[i]) < 0.006), gaps(dx).join(' / '));
    const TBL = { 3: [169.27, 261.47, 169.27], 5: [81.04, 138.92, 160.08, 138.92, 81.04], 7: [50.68, 84.69, 107.14, 114.98, 107.14, 84.69, 50.68], 9: [36.16, 58.03, 75.08, 85.92, 89.63, 85.92, 75.08, 58.03, 36.16] };
    for (const R of [3, 5, 7, 9]) {
        const s2 = makeSb(SRC_NEW, 4, R, 'none'); s2.baseNetTransform = { ...S, domain: 'field' }; const ww = s2.netWarpBaseNow(), T2 = 600 / R;
        const P = [...Array(R + 1).keys()].map(k => s2.applyNetWarp(ww, { x: k * T2, y: 0 }).x), wd = gaps(P);
        check(`R = ${R} (Shape Size ${R}): tile widths ${TBL[R].join(' / ')} px; tile boundaries reach 0 and 600`, JSON.stringify(wd) === JSON.stringify(TBL[R]) && Math.abs(P[0]) < 1e-9 && Math.abs(P[R] - 600) < 1e-9);
    }
    const tg = makeSb(SRC_NEW, 4, 5, 'none'); tg.baseNetTransform = { x: { kind: 'trig', w: 0.8 }, y: 'same', domain: 'field' }; const tw = tg.netWarpBaseNow();
    check('tangens 0.8, R = 5: widths 163.59 / 95.58 / 81.66 / 95.58 / 163.59 (the central tile is the smallest)', JSON.stringify(gaps([...Array(6).keys()].map(k => tg.applyNetWarp(tw, { x: k * 120, y: 0 }).x))) === JSON.stringify([163.59, 95.58, 81.66, 95.58, 163.59]));
}

// ============ 3. affine copies, R x R tiles ============
console.log('\n== 3. every tile an affine copy; exactly R x R tiles ==');
{
    let cfgs = 0, badNode = 0, badTiles = 0, outside = 0, pts = 0;
    for (const R of [3, 5, 7]) for (const order of [3, 4]) for (const spec of [{ ...S, domain: 'field' }, { x: { kind: 'trig', w: 0.7 }, y: { kind: 'geometric', w: 1.1 }, domain: 'field' }]) {
        const sb = makeSb(SRC_NEW, order, R, 'none'), h = (R - 1) / 2, T = 600 / R; seed = 90 + R; const conns = randConns(sb, 4);
        sb.baseNetTransform = spec; const w = sb.netWarpBaseNow(); if (!w) continue;
        let calls = 0; const o = sb.drawShapeCell; sb.drawShapeCell = function (...a) { calls++; return o.apply(this, a); };
        const lines = draw(sb, spec, conns, 'none'); cfgs++; if (calls !== R * R) badTiles++;
        if (!lines.every(l => l.every(v => v >= -1e-6 && v <= 600 + 1e-6))) outside++;
        // expected: each tile's endpoints = P_k + l * w_k on each axis, l = the node's local position in the clicked tile
        const F = ax => sb.netFieldLaw(ax === 'x' ? spec.x : (spec.y === 'same' ? spec.x : spec.y), R), fx = F('x'), fy = F('y');
        const P = f => f.field.P, wid = (f, k) => P(f)[k + 1] - P(f)[k];
        const step = T / (order - 1);
        for (const [a, b] of conns) {
            const na = sb.nodes.find(n => n.id === a), nb = sb.nodes.find(n => n.id === b);
            const la = { l: (na.x - sb.outerCorners[0].x) / T, m: (na.y - sb.outerCorners[0].y) / T }, lb = { l: (nb.x - sb.outerCorners[0].x) / T, m: (nb.y - sb.outerCorners[0].y) / T };
            for (let i = 0; i < R; i++) for (let j = 0; j < R; j++) {
                const want = [P(fx)[i] * T + la.l * wid(fx, i) * T, P(fy)[j] * T + la.m * wid(fy, j) * T, P(fx)[i] * T + lb.l * wid(fx, i) * T, P(fy)[j] * T + lb.m * wid(fy, j) * T];
                pts++; if (!lines.some(l => l.every((v, q) => Math.abs(v - want[q]) < 1e-9) || (Math.abs(l[0] - want[2]) < 1e-9 && Math.abs(l[1] - want[3]) < 1e-9 && Math.abs(l[2] - want[0]) < 1e-9 && Math.abs(l[3] - want[1]) < 1e-9))) badNode++;
            }
        }
    }
    check('drawShapeCell() is called exactly R x R times (9 / 25 / 49) - the closed-net rectangle scaled to the field', badTiles === 0, `${cfgs} configurations`);
    check('every drawn endpoint lies inside the field (= the canvas)', outside === 0);
    check('every connection appears in every tile at P_k + l * w_k on both axes (affine copy, also with different laws per axis)', badNode === 0, `${pts} tile copies checked`);
}

// ============ 4. lines map to lines ============
console.log('\n== 4. crossings map exactly ==');
{
    const sb = makeSb(SRC_NEW, 4, 3, 'none'); sb.baseNetTransform = { ...S, domain: 'field' }; const w = sb.netWarpBaseNow(), T = 200;
    const cross = (p1, p2, p3, p4) => { const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]); const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d; return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])]; };
    const map = p => { const q = sb.applyNetWarp(w, { x: p[0], y: p[1] }); return [q.x, q.y]; };
    let worst = 0, cnt = 0;
    for (let n = 0; n < 6000; n++) {
        const k = Math.floor(rnd() * 3), j = Math.floor(rnd() * 3), tl = [k * T, j * T], pt = () => [tl[0] + rnd() * T, tl[1] + rnd() * T];
        const a = pt(), b = pt(), c = pt(), d = pt(), X = cross(a, b, c, d);
        if (!(X[0] >= tl[0] && X[0] <= tl[0] + T && X[1] >= tl[1] && X[1] <= tl[1] + T)) continue;
        const FX = map(X), Xm = cross(map(a), map(b), map(c), map(d)); cnt++; worst = Math.max(worst, Math.hypot(FX[0] - Xm[0], FX[1] - Xm[1]));
    }
    check('F(crossing of two lines in a tile) == crossing of the mapped lines (the smooth warp: up to 22% of a tile; the design session measured 6.6e-12 px)', worst < 1e-8, `worst ${worst.toExponential(1)} px over ${cnt} crossings`);
}

// ============ 5. oddness / commutation ============
console.log('\n== 5. oddness, commutation, symmetry ==');
{
    let worstOdd = 0, worstRot = 0, worstMir = 0, cf = true;
    for (const R of [3, 5, 7, 9]) for (const spec of [{ ...S, domain: 'field' }, { x: { kind: 'trig', w: 0.8 }, y: 'same', domain: 'field' }]) {
        const sb = makeSb(SRC_NEW, 4, R, 'none'); sb.baseNetTransform = spec; const w = sb.netWarpBaseNow(), c = sb.centroid;
        const cc = sb.applyNetWarp(w, c); if (Math.hypot(cc.x - c.x, cc.y - c.y) > 1e-9) cf = false;
        for (let i = 0; i < 1500; i++) {
            const p = { x: rnd() * 600, y: rnd() * 600 }, a = sb.applyNetWarp(w, sb.rotateAround(p, c, 90)), b = sb.rotateAround(sb.applyNetWarp(w, p), c, 90);
            worstRot = Math.max(worstRot, Math.hypot(a.x - b.x, a.y - b.y));
            const m = sb.applyNetWarp(w, { x: 2 * c.x - p.x, y: p.y }), q = sb.applyNetWarp(w, p); worstMir = Math.max(worstMir, Math.hypot(m.x - (2 * c.x - q.x), m.y - q.y));
        }
        const T = 600 / R, P = [...Array(R + 1).keys()].map(k => sb.applyNetWarp(w, { x: k * T, y: 0 }).x); worstOdd = Math.max(worstOdd, ...P.map((v, i) => Math.abs(v - (600 - P[R - i]))));
    }
    check('the field centre = the central tile\'s centre = the centroid is a fixed point', cf);
    check('tile boundaries are odd about the centre (R = 3, 5, 7, 9; the design session measured <= 8.9e-14 px)', worstOdd < 1e-10, `${worstOdd.toExponential(1)} px`);
    check('rot90 and the mirror commute with the field F about the centroid, over the whole canvas', worstRot < 1e-9 && worstMir < 1e-9, `rot90 ${worstRot.toExponential(1)}, mirror ${worstMir.toExponential(1)} px`);
    const sr = makeSb(SRC_NEW, 4, 5, 'rotation_reflection6'); seed = 5; const conns = randConns(sr, 4), lines = draw(sr, { ...S, domain: 'field' }, conns, 'rotation_reflection6');
    const q4 = v => String(Math.round(v * 1e4) / 1e4 + 0);   // (+ 0: -0 and -1e-14 must not print as '-0.0000' - the field has lines on its edge)
    const key = (a, b, c, d) => [[a, b], [c, d]].map(z => `${q4(z[0])},${q4(z[1])}`).sort().join('|'), set = new Set(lines.map(l => key(...l)));
    const c = sr.centroid; let missing = 0; for (const l of lines) { const a = sr.rotateAround({ x: l[0], y: l[1] }, c, 90), b = sr.rotateAround({ x: l[2], y: l[3] }, c, 90); if (!set.has(key(a.x, a.y, b.x, b.y))) missing++; }
    check('the real drawing (rotation_reflection6, R = 5) stays 90-degree closed as a whole field', missing === 0, `${lines.length} segments, ${missing} missing`);
}

// ============ 6. inverse ============
console.log('\n== 6. F^-1: closed form per tile ==');
{
    const sb = makeSb(SRC_NEW, 4, 5, 'none'); let worst = 0, n = 0;
    for (const spec of [{ ...S, domain: 'field' }, { x: { kind: 'trig', w: 0.8 }, y: { kind: 'geometric', w: -1.2 }, domain: 'field' }]) {
        sb.baseNetTransform = spec; const w = sb.netWarpBaseNow();
        for (let i = 0; i < 4000; i++) { const p = { x: -500 + rnd() * 1600, y: -500 + rnd() * 1600 }, back = sb.applyNetWarp(w, sb.invertNetWarp(w, p)), fwd = sb.invertNetWarp(w, sb.applyNetWarp(w, p)); worst = Math.max(worst, Math.hypot(back.x - p.x, back.y - p.y), Math.hypot(fwd.x - p.x, fwd.y - p.y)); n++; }
    }
    check('F(F^-1 p) == p and F^-1(F p) == p inside the field and far outside it (linear extension), two law pairs', worst < 1e-8, `worst ${worst.toExponential(1)} px, ${n} points`);
    sb.baseNetTransform = { ...S, domain: 'field' }; const w = sb.netWarpBaseNow(); let calls = 0; const wrap = f => { const g = x => { calls++; return f(x); }; g.field = f.field; return g; }; w.fx = wrap(w.fx); w.fy = wrap(w.fy);
    for (let i = 0; i < 500; i++) sb.invertNetWarp(w, { x: rnd() * 600, y: rnd() * 600 });
    check('the field inverse evaluates f zero times in 500 inversions (closed form per tile)', calls === 0, `${calls} calls`);
}

// ============ 7. validity ============
console.log('\n== 7. an invalid field is ignored, visibly ==');
{
    const sb = makeSb(SRC_NEW, 4, 3, 'none'), eff = (rt, extra) => sb.netDomainEffective({ ...S, domain: 'field', ...extra }, rt);
    check('odd R = 3, 5, 7, 9 are fields', [3, 5, 7, 9].every(r => eff(r).domain === 'field' && eff(r).ignored === null));
    const bad = (rt, frag, legacy) => { const e = eff(rt, legacy); return e.domain === (legacy && legacy.repeat ? 'tiled' : 'single') && e.ignored && e.ignored.requested === 'field' && e.ignored.reason.includes(frag); };
    check('refused with a reason: R = 1, 2 (too few), 4, 6, 8 (even), 11 (beyond the ceiling), 3.5 (not an integer), undefined', bad(1, 'at least 3') && bad(2, 'at least 3') && bad(4, 'odd') && bad(6, 'odd') && bad(8, 'odd') && bad(11, 'ceiling') && bad(3.5, 'integer') && bad(undefined, 'integer'));
    check('the fallback is the legacy reading: repeat true -> tiled, otherwise single', bad(4, 'odd', { repeat: true }) && bad(4, 'odd', { repeat: false }));
    const a = makeSb(SRC_NEW, 4, 4, 'none'), b = makeSb(SRC_NEW, 4, 4, 'none'); a.baseNetTransform = { ...S, domain: 'field' }; b.baseNetTransform = { ...S, repeat: false }; seed = 3; const cn = randConns(a, 3);
    check('an ignored field (Shape Size 4) draws exactly what the legacy spec draws', JSON.stringify(draw(a, { ...S, domain: 'field' }, cn, 'none')) === JSON.stringify(draw(b, { ...S, repeat: false }, cn, 'none')));
    check('unknown domain strings are ignored too', sb.netDomainEffective({ ...S, domain: 'foo' }, 3).ignored.reason.includes("unknown domain 'foo'"));
    sb.baseNetTransform = { x: { kind: 'trig', w: 0 }, y: 'same', domain: 'field' }; check('a field with w = 0 is the identity (no warp)', sb.netWarpBaseNow() === null);
}

// ============ 8. overlay ============
console.log('\n== 8. overlay: macro at the tile boundaries, micro inside ==');
{
    const sb = makeSb(SRC_NEW, 4, 3, 'none'), spec = { ...S, domain: 'field' }, E = 3, Rt = 3;
    const L = sb.netGridLines(spec, sb.outerCorners, E, { x0: 0, y0: 0, x1: W, y1: W }, { closed: true, domain: 'field', fieldTiles: Rt }), v = L.filter(l => l.axis === 'v').sort((a, b) => a.x1 - b.x1);
    const macro = v.filter(l => l.level === 'macro').map(l => +l.x1.toFixed(2)), micro = v.filter(l => l.level === 'micro').map(l => +l.x1.toFixed(2));
    console.log('   macro x:', macro.join(', '), '\n   micro x:', micro.join(', '));
    check('macro lines (tile boundaries) 0 / 169.27 / 430.73 / 600; micro lines uniform inside each tile (E - 1 = 2 each)', JSON.stringify(macro) === JSON.stringify([0, 169.27, 430.73, 600]) && JSON.stringify(micro) === JSON.stringify([56.42, 112.84, 256.42, 343.58, 487.16, 543.58]));
    check('R + 1 macro and R * (E - 1) micro lines per axis; all edge to edge over the field', v.length === 10 && L.filter(l => l.axis === 'h').length === 10 && L.every(l => (l.axis === 'v' ? Math.abs(Math.min(l.y1, l.y2)) < 1e-9 && Math.abs(Math.max(l.y1, l.y2) - 600) < 1e-9 : Math.abs(Math.min(l.x1, l.x2)) < 1e-9 && Math.abs(Math.max(l.x1, l.x2) - 600) < 1e-9)));
    sb.baseNetTransform = spec; const w = sb.netWarpBaseNow(); const xs = [...Array(10).keys()].map(i => sb.applyNetWarp(w, { x: i * 600 / 9, y: 0 }).x);
    check('the line positions equal applyNetWarp() of the regular lattice (the same F)', v.every((l, i) => Math.abs(l.x1 - xs[i]) < 1e-9));
    check('without the field option the overlay is the legacy one (unchanged)', JSON.stringify(sb.netGridLines(S, sb.outerCorners, 6, { x0: 0, y0: 0, x1: W, y1: W }, { closed: true })) === JSON.stringify(makeSb(SRC_OLD, 4, 3, 'none').netGridLines(S, sb.outerCorners, 6, { x0: 0, y0: 0, x1: W, y1: W }, { closed: true })));
}

// ============ 9. export ============
console.log('\n== 9. export ==');
{
    const sb = makeSb(SRC_NEW, 4, 3, 'none'), ex = (spec, rt) => JSON.parse(JSON.stringify(sb.netTransformExportData(spec, 3, rt)));
    const f = ex({ ...S, domain: 'field' }, 3);
    check("domain 'field', fieldTiles 3, repeat false, macro = E, micro 1", f.domain === 'field' && f.fieldTiles === 3 && f.repeat === false && f.macro === 3 && f.micro === 1 && !('domainIgnored' in f));
    check('tileBoundaries (tile units) 0 / 0.8463 / 2.1537 / 3 on both axes', f.tileBoundaries.unit === 'tiles' && [0, 0.8463, 2.1537, 3].every((v, i) => Math.abs(f.tileBoundaries.x[i] - v) < 5e-5 && Math.abs(f.tileBoundaries.y[i] - v) < 5e-5));
    const back = sb.netTransformFromExport(f);
    check('round trip: the spec comes back with domain field; the same warp maps random points identically', back.domain === 'field' && back.repeat === false && (() => { const w1 = sb.netWarpForBase({ ...S, domain: 'field' }, 'square', sb.outerCorners, 4, 3), w2 = sb.netWarpForBase(back, 'square', sb.outerCorners, 4, 3); let d = 0; for (let i = 0; i < 400; i++) { const p = { x: rnd() * 800 - 100, y: rnd() * 800 - 100 }, a = sb.applyNetWarp(w1, p), b = sb.applyNetWarp(w2, p); d = Math.max(d, Math.hypot(a.x - b.x, a.y - b.y)); } return d === 0; })());
    const ig = ex({ ...S, domain: 'field' }, 4);
    check('an invalid field is exported as what was drawn (single) plus domainIgnored {requested, reason}', ig.domain === 'single' && ig.domainIgnored.requested === 'field' && /odd/.test(ig.domainIgnored.reason) && !('fieldTiles' in ig));
    check('intra-tile macro in a field is flagged macroIgnored (not applicable)', /does not apply in a field/.test(ex({ ...S, domain: 'field', macro: 3 }, 3).macroIgnored.reason));
    const g = ex({ x: { kind: 'geometric', w: 1.2 }, y: 'same', domain: 'field' }, 3);
    check('geometric q in a field is per tile (Rt = 3): exp(w / 2)', Math.abs(g.x.q - Math.exp(1.2 / 2)) < 1e-12 && g.x.alternate === false);
    const exportSrc = fs.readFileSync(path.join(ROOT, 'core', 'export.js'), 'utf8');
    check('core/export.js passes shapeSizeFactor (the tile count) to the description', exportSrc.includes('netTransformExportData(baseNetTransform, nodeCount - 1, shapeSizeFactor)'));
}

// ============ 10. free endpoints ============
console.log('\n== 10. free endpoints on a field (option b) ==');
{
    const sb = makeSb(SRC_NEW, 4, 5, 'none'); sb.baseNetTransform = { ...S, domain: 'field' }; const w = sb.netWarpBaseNow(), h = 2, T = 120;
    let worst = 0, n = 0, wrongTile = 0;
    for (let i = -h; i <= h; i++) for (let j = -h; j <= h; j++) for (let q = 0; q < 12; q++) {
        const l = rnd() * 0.98 + 0.01, m = rnd() * 0.98 + 0.01;
        const reg = { x: sb.outerCorners[0].x + (i + l) * T, y: sb.outerCorners[0].y + (j + m) * T };    // where the node's clone sits (regular field coords)
        const click = sb.applyNetWarp(w, reg), r = sb.netWarpFieldLocal(w, click);
        n++; if (!r) { worst = Infinity; continue; }
        if (r.tile.i !== i || r.tile.j !== j) wrongTile++;
        worst = Math.max(worst, Math.abs(r.x - (sb.outerCorners[0].x + l * T)), Math.abs(r.y - (sb.outerCorners[0].y + m * T)));
    }
    check('a click on the clone in ANY tile maps back to the same position inside the central tile, and reports which tile it hit', worst < 1e-9 && wrongTile === 0, `${n} clicks over 25 tiles, worst ${worst.toExponential(1)} px`);
    // stored there, the node is drawn in the clicked tile exactly where it was clicked
    const l = 0.3, m = 0.6, reg = { x: sb.outerCorners[0].x + (2 + l) * T, y: sb.outerCorners[0].y + (-1 + m) * T }, click = sb.applyNetWarp(w, reg), at = sb.netWarpFieldLocal(w, click);
    sb.nodes.push({ id: 99, x: at.x, y: at.y, free: true }); sb.symmetryMode = 'none'; const lines = draw(sb, sb.baseNetTransform, [[1, 99]], 'none');
    check('the stored free node is drawn at the click in the clicked tile (a scaled copy in every other tile)', lines.some(ln => (Math.abs(ln[2] - click.x) < 1e-9 && Math.abs(ln[3] - click.y) < 1e-9) || (Math.abs(ln[0] - click.x) < 1e-9 && Math.abs(ln[1] - click.y) < 1e-9)) && at.tile.i === 2 && at.tile.j === -1);
    check('a click outside the field, or on a non-field warp, has nothing to map to (null)', sb.netWarpFieldLocal(w, { x: -5, y: 100 }) === null && sb.netWarpFieldLocal(w, { x: 300, y: 605 }) === null && makeSb(SRC_NEW, 4, 3, 'none').netWarpFieldLocal(null, { x: 1, y: 1 }) === null);
    const sk = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    check('UI wiring (source): index.html has the Single / Tiled / Field buttons and no Repeat-tiles toggle; sketch.js resets Field for an invalid Shape Size, visibly',
        ['single', 'tiled', 'field'].every(d => html.includes(`data-domain="${d}"`)) && !html.includes('net-repeat-btn') && sk.includes("netDomainEffective({ domain: 'field' }, R)") && sk.includes('so Field was reset to Single'));
    check('sketch.js wires it: mousePressed() uses netWarpFieldLocal() for a field warp, the overlay passes the field option', sk.includes('netWarp && netWarp.field ? netWarpFieldLocal(') && sk.includes("domain: 'field', fieldTiles: field.Rt"));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
