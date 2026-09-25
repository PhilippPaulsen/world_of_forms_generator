/**
 * tools/netwarp/test-netwarp-focus.js
 * Roadmap 1.6 / Group E: the movable FOCUS of a trig axis (Single/Tiled). Sinus/tangens with focus c in [-1,1]:
 *   f = (g(a'(u - c)) + g(a'(1 + c))) / (g(a'(1 - c)) + g(a'(1 + c))),  u = 2l - 1,  a' = a / (1 + |c|)
 * which puts the widest (sinus) / narrowest (tangens) mesh at tile position (1 + c)/2.
 *
 *   node tools/netwarp/test-netwarp-focus.js
 *
 *  1. focus 0 / absent is byte-identical to the last commit BEFORE focus existed (BASE below): the laws, applyNetWarp(),
 *     the export and the drawn lines of the real pipeline.
 *  2. The law: endpoints, monotone, the window stays below pi/2 (no folding), the extreme mesh at the focus.
 *  3. Symmetry, measured: c = 0 commutes with rot90/rot180/mirror/diagonal swap; c != 0 breaks rot90/rot180/mirror and
 *     the anti-diagonal but keeps the main-diagonal swap while c_x == c_y; c_x != c_y breaks that too.
 *  4. `alternate`: inert at c = 0, and at c != 0 it removes the seam jump (the odd tile is the mirrored law).
 *  5. Nesting: Em = 2 is a real split with a focus (M1 != 1/2), offered only when every warped axis allows it; inverse.
 *  6. Field: focus is ignored (stripped), visibly in the export; Step A's face eligibility is unchanged.
 *  7. Export/import and the net-line overlay.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = '1319c7e4';   // the last commit before the focus parameter
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor'];
const load = fromHead => FILES.map(f => fromHead ? execSync(`git show ${BASE}:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString() : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
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
let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const S0 = { x: { kind: 'trig', w: -1 }, y: 'same', repeat: false };
const frame = { c0: { x: 0, y: 0 }, v1: { x: 600, y: 0 }, v2: { x: 0, y: 600 } };
const sbN = makeSb(SRC_NEW, 7, 1, 'none'), sbO = makeSb(SRC_OLD, 7, 1, 'none');

// ============ 1. focus 0 / absent is byte-identical ============
console.log('== 1. focus 0 / absent: byte-identical to ' + BASE + ' ==');
{
    let laws = 0, lawBad = 0, refBad = 0;
    for (const w of [-1, -0.8, -0.3, 0.2, 0.6, 1]) for (const E of [3, 6, 12]) for (const focus of [undefined, 0]) {
        const ax = focus === undefined ? { kind: 'trig', w } : { kind: 'trig', w, focus };
        const a = sbO.netAxisLaw({ kind: 'trig', w }, E), b = sbN.netAxisLaw(ax, E); laws++;
        for (let i = 0; i <= 400; i++) {
            const l = i / 400, A = w < 0 ? -w * 1.3 : w * 1.2;
            const ref = w < 0 ? (Math.sin(A * (2 * l - 1)) / Math.sin(A) + 1) / 2 : (Math.tan(A * (2 * l - 1)) / Math.tan(A) + 1) / 2;
            if (a(l) !== b(l)) { lawBad++; break; }
            if (b(l) !== ref) { refBad++; break; }
        }
    }
    check('netAxisLaw(): === the previous commit and === the original closed form at 401 points, focus absent or 0', lawBad === 0 && refBad === 0, `${laws} laws`);
    let pts = 0, ptBad = 0;
    for (const w of [-1, -0.5, 0.7]) for (const macro of [undefined, 3]) {
        const spec = { x: { kind: 'trig', w, focus: 0 }, y: { kind: 'trig', w: -w, focus: 0 }, macro }, specO = { x: { kind: 'trig', w }, y: { kind: 'trig', w: -w }, macro };
        const fr = { c0: { x: 30, y: 40 }, v1: { x: 200, y: 0 }, v2: { x: 0, y: 200 } }, wn = sbN.makeNetWarp(spec, fr, 6), wo = sbO.makeNetWarp(specO, fr, 6);
        for (let i = 0; i < 300; i++) { const p = { x: rnd() * 900 - 300, y: rnd() * 900 - 300 }; pts++; if (JSON.stringify(sbN.applyNetWarp(wn, p)) !== JSON.stringify(sbO.applyNetWarp(wo, p))) ptBad++; }
    }
    check('applyNetWarp(): identical output (JSON) at random points, focus 0 vs none, plain and nested', ptBad === 0, `${pts} points`);
    const eN = sbN.netTransformExportData({ x: { kind: 'trig', w: -0.7, focus: 0 }, y: 'same' }, 6, 1), eO = sbO.netTransformExportData({ x: { kind: 'trig', w: -0.7 }, y: 'same' }, 6, 1);
    check('export at focus 0: identical (no focus key, same `a`)', JSON.stringify(eN) === JSON.stringify(eO));
    let n = 0, bad = 0, lines = 0;
    for (const order of [3, 5, 7]) for (const mode of ['rotation_reflection6', 'none']) for (const w of [-1, -0.6, 0.5, 1]) for (const dom of [{ repeat: false }, { repeat: true }]) {
        const build = (src, ax) => { seed = 40 + order; const sb = makeSb(src, order, 3, mode); const ids = sb.nodes.map(x => x.id); sb.connections = [1, 2, 3, 4].map(() => [ids[Math.floor(rnd() * ids.length)], ids[Math.floor(rnd() * ids.length)]]).filter(c => c[0] !== c[1]); sb.baseNetTransform = { x: ax, y: 'same', ...dom }; return sb; };
        const a = build(SRC_OLD, { kind: 'trig', w }), b = build(SRC_NEW, { kind: 'trig', w, focus: 0 }); a.lines = []; a.drawTessellation(); b.lines = []; b.drawTessellation();
        n++; lines += b.lines.length; if (JSON.stringify(a.lines) !== JSON.stringify(b.lines)) bad++;
    }
    check('the real pipeline: drawTessellation() draws exactly the previous commit\'s line() calls, focus 0', bad === 0 && lines > 1000, `${n} configurations, ${lines} lines`);
}

// ============ 2. the law ============
console.log('\n== 2. the law with a focus ==');
{
    let cases = 0, minStep = 1, endErr = 0, maxWin = 0;
    for (const w of [-1, -0.75, -0.5, -0.25, -0.05, 0.05, 0.25, 0.5, 0.75, 1]) for (let ci = -10; ci <= 10; ci++) {
        const c = ci / 10, f = sbN.netAxisLaw({ kind: 'trig', w, focus: c }, 6);
        endErr = Math.max(endErr, Math.abs(f(0)), Math.abs(f(1) - 1)); let prev = f(0);
        for (let i = 1; i <= 2000; i++) { const v = f(i / 2000); minStep = Math.min(minStep, v - prev); prev = v; }
        const a0 = w < 0 ? -w * 1.3 : w * 1.2; maxWin = Math.max(maxWin, (a0 / (1 + Math.abs(c))) * (1 + Math.abs(c))); cases++;
    }
    check(`f(0) = 0, f(1) = 1 (error ${endErr}) and strictly increasing at every (w, c): ${cases} cases, min step ${minStep.toExponential(1)}`, endErr < 1e-12 && minStep > 0);
    check(`the rescaled window half-width a'(1+|c|) is at most ${maxWin.toFixed(3)} < pi/2 = 1.571 across the strength range: no folding`, maxWin <= 1.3 + 1e-12 && maxWin < Math.PI / 2);
    const gp = (w, c) => { const f = sbN.netAxisLaw({ kind: 'trig', w, focus: c }, 6), p = [...Array(7).keys()].map(i => 600 * f(i / 6)); return p.slice(1).map((v, i) => +(v - p[i]).toFixed(1)); };
    console.log('   sinus c=0.5 gaps:', gp(-1, 0.5).join(' '), ' tangens c=0.5:', gp(1, 0.5).join(' '));
    check('sinus, Node Count 7 (E=6), c=0.5: gaps 50.4 80.8 104.6 119.7 124.9 119.7 (widest cell #4, at tile position 0.75)', JSON.stringify(gp(-1, 0.5)) === JSON.stringify([50.4, 80.8, 104.6, 119.7, 124.9, 119.7]));
    let extOk = true;
    for (const [w, pick] of [[-1, Math.max], [1, Math.min]]) for (const c of [-1, -0.5, 0, 0.5, 1]) { const g = gp(w, c), ext = g.indexOf(pick(...g)), want = Math.min(5, Math.floor(((1 + c) / 2) * 6)); if (Math.abs(ext - want) > 1) extOk = false; }
    check('the widest (sinus) / narrowest (tangens) mesh sits at the focus, within one cell, c = -1..1', extOk);
    check('sinus c and -c are mirror images (the law with -c is 1 - f(1 - l))', (() => { const a = sbN.netAxisLaw({ kind: 'trig', w: -1, focus: 0.6 }, 6), b = sbN.netAxisLaw({ kind: 'trig', w: -1, focus: -0.6 }, 6); for (let i = 0; i <= 200; i++) if (Math.abs(b(i / 200) - (1 - a(1 - i / 200))) > 1e-12) return false; return true; })());
    check('a focus on a geometric or uniform axis is ignored (the law is the same object behaviour)', (() => { const a = sbN.netAxisLaw({ kind: 'geometric', w: 1, focus: 0.7 }, 6), b = sbN.netAxisLaw({ kind: 'geometric', w: 1 }, 6); for (let i = 0; i <= 50; i++) if (a(i / 50) !== b(i / 50)) return false; return sbN.netAxisLaw({ kind: 'uniform', w: 0, focus: 0.5 }, 6) === null; })());
    check('focus is clamped to [-1, 1]', (() => { const a = sbN.netAxisLaw({ kind: 'trig', w: -1, focus: 5 }, 6), b = sbN.netAxisLaw({ kind: 'trig', w: -1, focus: 1 }, 6); return [0.1, 0.5, 0.9].every(t => a(t) === b(t)); })());
}

// ============ 3. symmetry, measured ============
console.log('\n== 3. symmetry: what focus breaks ==');
{
    const mk = spec => sbN.makeNetWarp(spec, frame, 6, 1), cx = 300, cy = 300;
    const pts = []; for (let i = 0; i < 400; i++) pts.push({ x: (i * 137.5) % 600, y: (i * 61.8 + 13) % 600 });
    const T = { rot90: p => ({ x: cx - (p.y - cy), y: cy + (p.x - cx) }), rot180: p => ({ x: 2 * cx - p.x, y: 2 * cy - p.y }), mirrorX: p => ({ x: 2 * cx - p.x, y: p.y }), swap: p => ({ x: cx + (p.y - cy), y: cy + (p.x - cx) }), anti: p => ({ x: cx - (p.y - cy), y: cy - (p.x - cx) }) };
    const err = (spec, t) => { const w = mk(spec); let m = 0; for (const p of pts) { const a = sbN.applyNetWarp(w, T[t](p)), b = T[t](sbN.applyNetWarp(w, p)); m = Math.max(m, Math.hypot(a.x - b.x, a.y - b.y)); } return m; };
    const row = c => ['rot90', 'rot180', 'mirrorX', 'swap', 'anti'].map(t => err({ x: { kind: 'trig', w: -1, focus: c }, y: 'same' }, t));
    const r0 = row(0);
    console.log('   c=0   rot90/rot180/mirrorX/swap/anti-diagonal:', r0.map(v => v.toExponential(1)).join('  '));
    check('c = 0: every one of them commutes (error < 1e-11 px)', r0.every(v => v < 1e-11));
    let ok = true; for (const c of [0.1, 0.3, 0.6, 1, -0.4]) { const r = row(c); console.log(`   c=${c}`.padEnd(9), r.map(v => v.toExponential(1)).join('  ')); if (!(r[0] > 10 && r[1] > 10 && r[2] > 10 && r[3] < 1e-11 && r[4] > 10)) ok = false; }
    check('c != 0 (both axes share c): rot90, rot180, mirror-x and the ANTI-diagonal break by more than 10 px; the main-diagonal swap stays exact (< 1e-11)', ok);
    const sx = err({ x: { kind: 'trig', w: -1, focus: 0.5 }, y: { kind: 'trig', w: -1, focus: 0.2 } }, 'swap'), sm = err({ x: { kind: 'trig', w: -1, focus: 0.5 }, y: { kind: 'trig', w: -1, focus: -0.5 } }, 'swap');
    check(`c_x != c_y breaks the diagonal swap too (${sx.toFixed(1)} px at 0.5/0.2, ${sm.toFixed(1)} px at 0.5/-0.5)`, sx > 10 && sm > 10);
}

// ============ 4. alternate ============
console.log('\n== 4. alternate at c != 0 ==');
{
    const gapsOf = (c, alt) => { const w = sbN.makeNetWarp({ x: { kind: 'trig', w: -1, focus: c, alternate: alt }, y: 'same', repeat: true }, frame, 6, 1); const xs = []; for (let i = -6; i <= 18; i++) xs.push(sbN.applyNetWarp(w, { x: 600 * i / 6, y: 300 }).x); return xs.slice(1).map((v, i) => v - xs[i]); };
    const seams = g => [0, 1, 2].map(t => g[6 + t * 6] / g[6 + t * 6 - 1]);
    const a0 = gapsOf(0, false), b0 = gapsOf(0, true);
    check('c = 0: alternate is inert (every mesh width identical to 1e-9 px)', a0.every((v, i) => Math.abs(v - b0[i]) < 1e-9), Math.max(...a0.map((v, i) => Math.abs(v - b0[i]))).toExponential(1));
    const a5 = gapsOf(0.5, false), b5 = gapsOf(0.5, true);
    console.log('   c=0.5 seam ratio (next tile\'s first mesh / previous tile\'s last):  off', seams(a5).map(v => v.toFixed(3)).join(' '), ' on', seams(b5).map(v => v.toFixed(3)).join(' '));
    check('c = 0.5: without alternate the mesh width jumps at every seam (0.421x); with it the widths run on (1.000x)', seams(a5).every(v => Math.abs(v - 0.421) < 0.001) && seams(b5).every(v => Math.abs(v - 1) < 1e-9));
    check('c = 0.5, alternate: the odd tile is the mirrored law (its meshes in reverse order)', b5.slice(12, 18).every((v, i) => Math.abs(v - b5.slice(6, 12)[5 - i]) < 1e-9));
}

// ============ 5. nesting, options, inverse ============
console.log('\n== 5. nesting, macro options, inverse ==');
{
    const f2 = sbN.netAxisLaw({ kind: 'trig', w: -1, focus: 0.5 }, 4, 2), M1 = f2.pl.M[1];
    console.log('   Em = 2 with focus 0.5 (sinus, strength 1): M1 =', M1.toFixed(4));
    check('Em = 2 with a focus is a real split (M1 != 1/2), where without it M1 = 1/2 exactly', Math.abs(M1 - 0.5) > 0.05 && Math.abs(sbN.netAxisLaw({ kind: 'trig', w: -1, focus: 0 }, 4, 2).pl.M[1] - 0.5) < 1e-14);
    const F = { x: { kind: 'trig', w: -1, focus: 0.5 }, y: 'same' }, Z = { x: { kind: 'trig', w: -1 }, y: 'same' }, G = { x: { kind: 'geometric', w: 1 }, y: 'same' }, mixed = { x: { kind: 'trig', w: -1, focus: 0.5 }, y: { kind: 'trig', w: -1 } }, gf = { x: { kind: 'geometric', w: 1 }, y: { kind: 'trig', w: 0.5, focus: -0.3 } };
    const o = (E, sp) => JSON.stringify(sbN.netMacroOptions(E, sp));
    check('options: trig + focus offers 2 (E=4 -> 2,4 ; 6 -> 2,3,6), symmetric trig does not (6 -> 3,6), geometric unchanged', o(4, F) === '[2,4]' && o(6, F) === '[2,3,6]' && o(6, Z) === '[3,6]' && o(4, G) === '[2,4]');
    check('options: a symmetric trig axis in play (X focused, Y not) or focus 0 offers no 2; geometric + focused trig does', !JSON.parse(o(4, mixed)).includes(2) && JSON.parse(o(4, gf)).includes(2) && !JSON.parse(o(4, { x: { kind: 'trig', w: -1, focus: 0 }, y: 'same' })).includes(2));
    check('every offered option is accepted by netMacroEffective', [2, 3, 4, 5, 6, 8, 9, 12, 14].every(E => [F, Z, G, mixed, gf].every(sp => sbN.netMacroOptions(E, sp).every(m => sbN.netMacroEffective(m, E).valid))));
    let worst = 0, n = 0;
    for (const spec of [{ x: { kind: 'trig', w: -1, focus: 0.6 }, y: 'same' }, { x: { kind: 'trig', w: 0.8, focus: -0.7, alternate: true }, y: { kind: 'trig', w: -0.5, focus: 0.3 }, repeat: true }, { x: { kind: 'trig', w: -1, focus: 0.5 }, y: 'same', macro: 3 }, { x: { kind: 'trig', w: -0.9, focus: -0.4, alternate: true }, y: 'same', macro: 2, repeat: true }])
        for (let i = 0; i < 300; i++) { const w = sbN.makeNetWarp(spec, frame, 6, 1), p = { x: rnd() * 1800 - 600, y: rnd() * 1800 - 600 }, q = sbN.invertNetWarp(w, sbN.applyNetWarp(w, p)); worst = Math.max(worst, Math.hypot(q.x - p.x, q.y - p.y)); n++; }
    check(`free-endpoint inverse: F^-1(F(p)) = p to ${worst.toExponential(1)} px over ${n} points (smooth, nested, alternate, repeat, per-axis focus)`, worst < 1e-8);
}

// ============ 6. Field ignores focus; Step A unaffected ============
console.log('\n== 6. Field: focus ignored; Step A unaffected ==');
{
    const spF = { x: { kind: 'trig', w: -1, focus: 0.6 }, y: 'same', domain: 'field' }, spN = { x: { kind: 'trig', w: -1 }, y: 'same', domain: 'field' };
    const wF = sbN.makeNetWarp(spF, frame, 3, 3), wN = sbN.makeNetWarp(spN, frame, 3, 3); let same = true;
    for (let i = 0; i < 300; i++) { const p = { x: rnd() * 600, y: rnd() * 600 }; if (JSON.stringify(sbN.applyNetWarp(wF, p)) !== JSON.stringify(sbN.applyNetWarp(wN, p))) same = false; }
    check('a Field with a focus warps exactly like a Field without (the focus is stripped)', same && JSON.stringify(sbN.netFieldLaw({ kind: 'trig', w: -1, focus: 0.6 }, 5).field.P) === JSON.stringify(sbN.netFieldLaw({ kind: 'trig', w: -1 }, 5).field.P));
    const e = sbN.netTransformExportData(spF, 3, 3);
    check('the Field export says so: focusIgnored, no focus on the axes, faces still exact (facesOmitted false)', !!e.focusIgnored && e.x.focus === undefined && e.facesOmitted === false && JSON.stringify(e.tileBoundaries) === JSON.stringify(sbN.netTransformExportData(spN, 3, 3).tileBoundaries));
    const blocks = (spec, sf, sheet) => { const sb = makeSb(SRC_NEW, 4, sf, 'none'); sb.baseNetTransform = spec; return sb.netWarpBlocksFaces(sheet); };
    check('face eligibility is untouched: Single/Tiled with a focus still refuse faces; a Field base sheet (with or without a focus) still allows them; layers refused', blocks({ x: { kind: 'trig', w: -1, focus: 0.5 }, y: 'same' }, 1) === true && blocks({ x: { kind: 'trig', w: -1, focus: 0.5 }, y: 'same', repeat: true }, 3) === true && blocks(spF, 3) === false && blocks(spN, 3) === false && blocks(spF, 3, {}) === true);
}

// ============ 7. export/import, overlay, UI wiring ============
console.log('\n== 7. export, overlay, UI ==');
{
    const spec = { x: { kind: 'trig', w: -0.8, focus: 0.5, alternate: true }, y: 'same', repeat: true, macro: 3 };
    const e = sbN.netTransformExportData(spec, 6, 1);
    check('export with a focus: focus 0.5 and the rescaled angle a = 1.04 / 1.5, alternate; JSON round trip restores the spec', e.x.focus === 0.5 && Math.abs(e.x.a - 0.8 * 1.3 / 1.5) < 1e-12 && e.x.alternate === true && (() => { const back = sbN.netTransformFromExport(JSON.parse(JSON.stringify(e))); return back.x.focus === 0.5 && back.x.alternate === true && back.macro === 3 && back.repeat === true; })());
    check('an export from before focus (no focus key) reads back without one', sbN.netTransformFromExport(JSON.parse(JSON.stringify(sbO.netTransformExportData(S0, 6, 1)))).x.focus === undefined);
    const sb = makeSb(SRC_NEW, 7, 1, 'none'), L = sb.netGridLines({ x: { kind: 'trig', w: -1, focus: 0.5 }, y: 'same' }, sb.outerCorners, 6, { x0: 0, y0: 0, x1: W, y1: W }, { closed: true });
    const v = L.filter(l => l.axis === 'v').sort((a, b) => a.x1 - b.x1), g = v.slice(1).map((l, i) => +(l.x1 - v[i].x1).toFixed(1));
    console.log('   overlay gaps, sinus c=0.5:', g.join(' '));
    check('the overlay draws the asymmetric net: gaps 50.4 80.8 104.6 119.7 124.9 119.7 from the lines themselves', JSON.stringify(g) === JSON.stringify([50.4, 80.8, 104.6, 119.7, 124.9, 119.7]));
    const ui = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8'), html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    check('UI wiring present: slider input, per-axis focus in fresh(), focus only in the spec when non-zero, hidden in a Field', /focusInput\.input\(/.test(ui) && /focus: 0 \}\)/.test(ui) && /c\.focus \? \{ kind: 'trig', w: -c\.strength, focus: c\.focus/.test(ui) && /focusRow\.elt\.hidden = !trig \|\| ui\.domain === 'field'/.test(ui) && /id="net-focus-input"/.test(html));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
