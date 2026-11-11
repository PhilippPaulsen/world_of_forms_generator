/**
 * tools/ui/test-quad-canvas-svg.js
 * Task 053: a 'quad' piece of core/curves.js drawCurvedBezier() is the SAME curve on the canvas and in the SVG export.
 * (Before: canvas bezier(cur, Q, Q, to) = a cubic whose control weight at t=0.5 is 0.75; SVG "Q" = weight 0.5.)
 *
 *   node tools/ui/test-quad-canvas-svg.js
 *   QUAD_CURVES_JS=/path/to/curves.js node tools/ui/test-quad-canvas-svg.js        (measure another copy, e.g. the tree before the fix)
 *   QUAD_SABOTAGE=old|weight node tools/ui/test-quad-canvas-svg.js                   (in-memory sabotage copies; files are never written)
 *
 *  1. For curve pieces (fold 1 sym/asym, fold 2, fold 3, both leanings, several strengths) the canvas points and the SVG points at t = 0, .25, .5, .75, 1 agree; the largest distance is printed (px).
 *  2. Lines, fold 2 (true cubic), lines OFF, line weight, straight segments, collector: calls and path strings are byte-identical to core/curves.js of BASE.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const F = require('../session/fixtures.js');
const ROOT = F.ROOT;
const SAB = process.env.QUAD_SABOTAGE || '';
const BASE = '9b398d27';   // the tree before the task
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });

const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'quad053-'));
const oldSrc = execSync(`git show ${BASE}:core/curves.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
let newSrc = fs.readFileSync(process.env.QUAD_CURVES_JS || path.join(ROOT, 'core/curves.js'), 'utf8');
if (SAB === 'old') newSrc = oldSrc;
if (SAB === 'weight') {   // the control point weighted wrong: C = P0 + 0.5 (Q - P0) instead of 2/3
    if (!/2\s*\/\s*3/.test(newSrc)) { console.log('FAIL  sabotage anchor missing (2/3)'); process.exit(1); }
    newSrc = newSrc.replace(/2\s*\/\s*3/g, '0.5');
}
const oldFile = path.join(tmp, 'old-curves.js'), newFile = path.join(tmp, 'new-curves.js');
fs.writeFileSync(oldFile, oldSrc); fs.writeFileSync(newFile, newSrc);

// one world per curves.js: canvas stand-ins record the calls, the SVG collector gets the path strings
function world(file) {
    const ctx = F.makeContext({ state: true, coreOverrides: { 'core/curves.js': file } });
    const sb = ctx.sb;
    sb.__calls = [];
    sb.line = (...a) => sb.__calls.push(['line', ...a]);
    sb.bezier = (...a) => sb.__calls.push(['bezier', ...a]);
    sb.strokeWeight = (...a) => sb.__calls.push(['strokeWeight', ...a]);
    sb.quadraticVertex = (...a) => sb.__calls.push(['quadraticVertex', ...a]);
    sb.beginShape = (...a) => sb.__calls.push(['beginShape', ...a]);
    sb.vertex = (...a) => sb.__calls.push(['vertex', ...a]);
    sb.endShape = (...a) => sb.__calls.push(['endShape', ...a]);
    const canvas = (p1, p2, ct) => { sb.__calls = []; ctx.run('svgPathCollector = null; segmentCollector = null;'); sb.__p1 = p1; sb.__p2 = p2; sb.__ct = ct; ctx.run('drawCurvedBezier(__p1, __p2, __ct, 1, 2)'); return sb.__calls.slice(); };
    const svg = (p1, p2, ct) => { sb.__p1 = p1; sb.__p2 = p2; sb.__ct = ct; ctx.run('svgPathCollector = []; drawCurvedBezier(__p1, __p2, __ct, 1, 2)'); const r = ctx.run('svgPathCollector.slice()'); ctx.run('svgPathCollector = null;'); return r; };
    return { ctx, canvas, svg };
}
const W = world(newFile), O = world(oldFile);

// ---- evaluation: canvas = a list of cubic bezier() calls / lines; SVG = the d string
const cubic = (p0, c1, c2, p3, t) => { const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; return [a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1]]; };
const quad = (p0, q, p2, t) => { const u = 1 - t; return [u * u * p0[0] + 2 * u * t * q[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * q[1] + t * t * p2[1]]; };
const TS = [0, 0.25, 0.5, 0.75, 1];
function canvasPieces(calls) {   // [{ eval(t) }]
    const out = [];
    for (const c of calls) {
        if (c[0] === 'bezier') out.push(t => cubic([c[1], c[2]], [c[3], c[4]], [c[5], c[6]], [c[7], c[8]], t));
        else if (c[0] === 'line') out.push(t => [c[1] + (c[3] - c[1]) * t, c[2] + (c[4] - c[2]) * t]);
    }
    return out;
}
function svgPieces(d) {
    const tok = d.trim().split(/\s+/); const out = []; let i = 0, cur = null;
    while (i < tok.length) {
        const cmd = tok[i++]; const n = (k) => tok.slice(i, i + k).map(Number);
        if (cmd === 'M') { cur = n(2); i += 2; }
        else if (cmd === 'L') { const a = cur, b = n(2); i += 2; out.push(t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); cur = b; }
        else if (cmd === 'Q') { const a = cur, v = n(4); i += 4; out.push(t => quad(a, [v[0], v[1]], [v[2], v[3]], t)); cur = [v[2], v[3]]; }
        else if (cmd === 'C') { const a = cur, v = n(6); i += 6; out.push(t => cubic(a, [v[0], v[1]], [v[2], v[3]], [v[4], v[5]], t)); cur = [v[4], v[5]]; }
        else throw new Error('svg cmd ' + cmd);
    }
    return out;
}
// The SVG writer rounds to 2 decimals (<= 0.005 px), which would be the floor of any distance. The measurement therefore reads the path string with full precision (toFixed of the test world's vm patched
// for the duration of the call); the canvas keeps its full precision anyway. The 2-decimal output itself is covered by the byte-identity checks below.
const fullSvg = (w, p1, p2, ct) => { w.ctx.run('Number.prototype.__tf = Number.prototype.toFixed; Number.prototype.toFixed = function () { return String(this); };'); try { return w.svg(p1, p2, ct); } finally { w.ctx.run('Number.prototype.toFixed = Number.prototype.__tf;'); } };
function maxDist(p1, p2, ct) {
    const calls = W.canvas(p1, p2, ct);
    const cp = canvasPieces(calls), sp = svgPieces(fullSvg(W, p1, p2, ct)[0]);
    if (cp.length !== sp.length) return { n: [cp.length, sp.length], d: Infinity };
    let m = 0;
    cp.forEach((f, k) => TS.forEach(t => { const a = f(t), b = sp[k](t); m = Math.max(m, Math.hypot(a[0] - b[0], a[1] - b[1])); }));
    return { n: [cp.length, sp.length], d: m };
}

const CASES = [];
const P = [[{ x: 100, y: 120 }, { x: 460, y: 300 }], [{ x: 50, y: 500 }, { x: 350, y: 80 }], [{ x: 300, y: 300 }, { x: 320, y: 580 }]];
for (const [p1, p2] of P) for (const strength of [8, 25, 60]) for (const leaning of ['left', 'right'])
    for (const [fold, symmetric] of [[1, true], [1, false], [2, true], [2, false], [3, true], [4, false]]) CASES.push({ p1, p2, ct: { kind: 'curve', fold, strength, leaning, symmetric } });

let worst = 0, worstQuad = 0, worstCubic = 0, bad = 0;
for (const c of CASES) {
    const r = maxDist(c.p1, c.p2, c.ct);
    worst = Math.max(worst, r.d);
    if (c.ct.fold === 2) worstCubic = Math.max(worstCubic, r.d); else worstQuad = Math.max(worstQuad, r.d);
    if (!(r.d < 1e-6)) bad++;
}
console.log(`cases ${CASES.length}; max distance canvas vs SVG: quad pieces (fold 1, 3, 4) ${worstQuad.toExponential(3)} px, fold 2 (cubic) ${worstCubic.toExponential(3)} px, overall ${worst.toExponential(3)} px`);
{   // spot values for the report
    const ct = { kind: 'curve', fold: 1, strength: 25, leaning: 'left', symmetric: true };
    const r = maxDist(P[0][0], P[0][1], ct);
    console.log(`  fold 1 / strength 25 / chord ${Math.round(Math.hypot(360, 180))} px: ${r.d.toFixed(4)} px`);
}
check('canvas == SVG for every fold / strength / leaning case (max distance < 1e-6 px)', bad === 0, bad + ' of ' + CASES.length + ' cases differ');

// ---- 2. byte-identical to BASE where nothing should change
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const straight = { kind: 'straight' }, free = { kind: 'free', seed: 7, roughness: 0.5, strength: 20, visible: true, leaning: 'left' };
const NOCHANGE = [
    ['straight line', { kind: 'straight' }], ['fold 2 cubic', { kind: 'curve', fold: 2, strength: 25, leaning: 'left', symmetric: true }], ['fold 2 asym', { kind: 'curve', fold: 2, strength: 40, leaning: 'right', symmetric: false }],
];
for (const [name, ct] of NOCHANGE) for (const [p1, p2] of P) {
    check(`canvas calls identical to BASE: ${name}`, same(W.canvas(p1, p2, ct), O.canvas(p1, p2, ct)));
    check(`svg path identical to BASE: ${name}`, same(W.svg(p1, p2, ct), O.svg(p1, p2, ct)));
}
// SVG of a quad piece: unchanged for ALL curve cases
let svgSame = true; for (const c of CASES) if (!same(W.svg(c.p1, c.p2, c.ct), O.svg(c.p1, c.p2, c.ct))) svgSame = false;
check('svg path identical to BASE: all curve cases (the SVG side is not touched)', svgSame);
// lines off, line weight, segment collector
for (const w of [W, O]) w.ctx.run('lineStyle.visible = false;');
check('lines off: nothing drawn, canvas and SVG equal to BASE', same(W.canvas(P[0][0], P[0][1], CASES[0].ct), O.canvas(P[0][0], P[0][1], CASES[0].ct)) && W.canvas(P[0][0], P[0][1], CASES[0].ct).length === 0 && same(W.svg(P[0][0], P[0][1], CASES[0].ct), O.svg(P[0][0], P[0][1], CASES[0].ct)));
for (const w of [W, O]) w.ctx.run('lineStyle.visible = true; lineStyle.weight = 5;');
check('line weight 5: strokeWeight call and lines identical to BASE (straight + fold 2)', same(W.canvas(P[0][0], P[0][1], straight), O.canvas(P[0][0], P[0][1], straight)) && same(W.canvas(P[0][0], P[0][1], NOCHANGE[1][1]), O.canvas(P[0][0], P[0][1], NOCHANGE[1][1])));
check('line weight 5 on a quad: the strokeWeight call is the same as BASE', same(W.canvas(P[0][0], P[0][1], CASES[0].ct).filter(c => c[0] === 'strokeWeight'), O.canvas(P[0][0], P[0][1], CASES[0].ct).filter(c => c[0] === 'strokeWeight')));
for (const w of [W, O]) w.ctx.run('lineStyle.weight = 2;');
const collect = (w, ct) => { w.ctx.sb.__p1 = P[0][0]; w.ctx.sb.__p2 = P[0][1]; w.ctx.sb.__ct = ct; return w.ctx.run('segmentCollector = []; drawCurvedBezier(__p1, __p2, __ct, 1, 2); (function () { var r = segmentCollector; segmentCollector = null; return r; })()'); };
check('segment collector identical to BASE (curve and straight)', same(collect(W, CASES[0].ct), collect(O, CASES[0].ct)) && same(collect(W, straight), collect(O, straight)));
// free line (wiggle pieces): which piece types does it make; canvas calls compared to BASE only where it has no quad
const freeCalls = W.canvas(P[0][0], P[0][1], free), freeOld = O.canvas(P[0][0], P[0][1], free);
console.log(`  free line: ${freeCalls.length} canvas calls (BASE ${freeOld.length}); identical to BASE: ${same(freeCalls, freeOld)}`);
// a quad piece draws exactly ONE bezier() with c1/c2 = P0 + 2/3 (Q - P0), P2 + 2/3 (Q - P2)
{
    const ct = CASES[0].ct, calls = W.canvas(P[0][0], P[0][1], ct), b = calls.filter(c => c[0] === 'bezier');
    const d = fullSvg(W, P[0][0], P[0][1], ct)[0].split(' '); const q = [Number(d[4]), Number(d[5])];
    const e = (p, k) => p + 2 / 3 * (q[k] - p);
    check('a quad piece: one bezier() call with the exact cubic control points', b.length === 1 && Math.abs(b[0][3] - e(b[0][1], 0)) < 1e-6 && Math.abs(b[0][4] - e(b[0][2], 1)) < 1e-6 && Math.abs(b[0][5] - e(b[0][7], 0)) < 1e-6 && Math.abs(b[0][6] - e(b[0][8], 1)) < 1e-6);
}
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
