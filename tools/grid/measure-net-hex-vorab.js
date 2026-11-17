// Task 089, step 2: pre-checks for the hexagon Field (fine rhombus lattice, circumscribing parallelogram). Read-only measurement on the real core in a vm.
//   node tools/grid/measure-net-hex-vorab.js   -> JSON on stdout
//   1. alignment: share of hexagon corners (all hexagons of the canvas) that lie on nodes of the fine lattice anchored at the centroid
//   2. coverage: the smallest odd (Rx, Ry) >= 3 whose parallelogram (centred on the base mesh) contains the four canvas corners, per size; the limit needed for all 16 sizes
//   3. frame time of drawTessellation (median of 5, 10 orbits) with that Field (netWarpForBase replaced in the vm by the planned hexagon builder)
//   4. tileHex (latticeIJBounds, margin 3): segments drawn outside the canvas with and without the Field
'use strict';
const path = require('path');
const H = require(path.join(__dirname, '..', 'morph', 'render-harness.js'));
const J = JSON.stringify, MODE = 'rotation_reflection6';
const w = H.makeRenderWorld('hex', 3, 3, MODE); w.set('var canvasSizeSync = function () { width = canvasW; height = canvasH; };');
w.set(`
var __fine = function () { const oc = outerCorners, v1 = { x: oc[2].x - oc[0].x, y: oc[2].y - oc[0].y }, v2 = { x: oc[4].x - oc[0].x, y: oc[4].y - oc[0].y };
    return { v1: v1, v2: v2, f1: { x: (v1.x + v2.x) / 3, y: (v1.y + v2.y) / 3 }, f2: { x: (2 * v2.x - v1.x) / 3, y: (2 * v2.y - v1.y) / 3 } }; };
// the covering Field: base mesh = the fine mesh whose first node is the centroid (c0 = centroid), Rx, Ry odd >= 3, minimal Rx * Ry whose parallelogram (centred on the base mesh) contains the canvas corners
var __cover = function (cap) {
    const F = __fine(), c0 = { x: centroid.x, y: centroid.y }, det = F.f1.x * F.f2.y - F.f2.x * F.f1.y;
    const tc = [{ x: 0, y: 0 }, { x: canvasW, y: 0 }, { x: canvasW, y: canvasH }, { x: 0, y: canvasH }].map(function (p) { const dx = p.x - c0.x, dy = p.y - c0.y; return { s: (dx * F.f2.y - dy * F.f2.x) / det, t: (F.f1.x * dy - F.f1.y * dx) / det }; });
    let best = null;
    for (let Rx = 3; Rx <= cap; Rx += 2) for (let Ry = 3; Ry <= cap; Ry += 2) { if (best && Rx * Ry >= best.n) continue; const hx = (Rx - 1) / 2, hy = (Ry - 1) / 2;
        if (tc.every(function (c) { return c.s >= -hx - 1e-9 && c.s <= Rx - hx + 1e-9 && c.t >= -hy - 1e-9 && c.t <= Ry - hy + 1e-9; })) best = { n: Rx * Ry, Rx: Rx, Ry: Ry }; }
    return best;
};
var __mkField = function (spec, base, Rx, Ry) {
    const hx = (Rx - 1) / 2, hy = (Ry - 1) / 2, ax = spec.x, ay = spec.y === 'same' ? spec.x : spec.y, fx = netFieldLaw(ax, Rx), fy = netFieldLaw(ay, Ry), det = base.v1.x * base.v2.y - base.v2.x * base.v1.y;
    const c0 = { x: base.c0.x - hx * base.v1.x - hy * base.v2.x, y: base.c0.y - hx * base.v1.y - hy * base.v2.y }, v1 = { x: Rx * base.v1.x, y: Rx * base.v1.y }, v2 = { x: Ry * base.v2.x, y: Ry * base.v2.y };
    return { fx: fx, fy: fy, altX: false, altY: false, repeat: false, domain: 'field', field: { Rt: 1, h: 0, Rx: Rx, Ry: Ry, hx: hx, hy: hy }, meshes: { x: Rx, y: Ry }, frame: { c0: base.c0, v1: base.v1, v2: base.v2, det: det }, domainIgnored: null, c0: c0, v1: v1, v2: v2, det: v1.x * v2.y - v2.x * v1.y };
};
var __hexWarp = function (spec, cap) { const F = __fine(), b = __cover(cap); if (!b) return null; return __mkField(spec, { c0: { x: centroid.x, y: centroid.y }, v1: F.f1, v2: F.f2 }, b.Rx, b.Ry); };
var __origNWFB = netWarpForBase, __useHex = false, __cap = 41, __spec = null;
netWarpForBase = function (spec, shape, corners, nc, Rt) { if (__useHex && shape === 'hex') return __hexWarp(spec, __cap); return __origNWFB(spec, shape, corners, nc, Rt); };
`);
const setup = (X, Y, n) => w.set(`currentShape = 'hex'; projectGridSpec({ shape: 'hex', ordnung: 3, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y});
    symmetryMode = ${J(MODE)}; baseNetTransform = null; baseNetAnimation = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; showFaces = false; rebuildGrid(currentShape);
    connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, ${n});`);
const out = { alignment: {}, coverage: {}, frameMs: {}, tileHex: {} };
const SPEC = { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.6 }, domain: 'field' };
// 1. alignment: all hexagons of the base lattice over the canvas, corners in the fine basis anchored at the centroid
for (const [X, Y] of [[3, 5], [5, 5], [5, 3]]) { setup(X, Y, 3);
    out.alignment[`${X}/${Y}`] = w.get(`(function () { const F = __fine(), oc = outerCorners, det = F.f1.x * F.f2.y - F.f2.x * F.f1.y; let n = 0, on = 0, worst = 0;
        for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) { const sh = { x: i * F.v1.x + j * F.v2.x, y: i * F.v1.y + j * F.v2.y }; const cen = { x: centroid.x + sh.x, y: centroid.y + sh.y }; if (cen.x < 0 || cen.x > canvasW || cen.y < 0 || cen.y > canvasH) continue;
            oc.forEach(function (p) { const dx = p.x + sh.x - centroid.x, dy = p.y + sh.y - centroid.y, s = (dx * F.f2.y - dy * F.f2.x) / det, t = (F.f1.x * dy - F.f1.y * dx) / det, d = Math.max(Math.abs(s - Math.round(s)), Math.abs(t - Math.round(t))); n++; if (d < 1e-6) on++; worst = Math.max(worst, d); }); }
        return { corners: n, onNodePct: Math.round(1e4 * on / n) / 100, worstFrac: Math.round(worst * 1e6) / 1e6, hexSide: Math.hypot(oc[1].x - oc[0].x, oc[1].y - oc[0].y), fineEdge: Math.hypot(F.f1.x, F.f1.y) }; })()`); }
// 2. coverage per size (cap 41), the limit needed
let maxR = 0; const over = {};
for (const X of [3, 5, 7, 9]) for (const Y of [3, 5, 7, 9]) { setup(X, Y, 3); const b = w.get('__cover(41)'); out.coverage[`${X}/${Y}`] = b ? [b.Rx, b.Ry] : null; if (b) { maxR = Math.max(maxR, b.Rx, b.Ry); if (Math.max(b.Rx, b.Ry) > 31) over[`${X}/${Y}`] = [b.Rx, b.Ry]; } }
out.coverageNeededLimit = maxR; out.sizesOver31 = over;
// 3 + 4. frame time and tiles outside the field
for (const [X, Y] of [[3, 5], [5, 5], [7, 5], [9, 9]]) {
    setup(X, Y, 10);
    w.set('__useHex = false; baseNetTransform = null;');
    const t = []; let regTotal = 0, regOut = 0; for (let i = 0; i < 5; i++) { const t0 = process.hrtime.bigint(); const f = w.frame(); t.push(Number(process.hrtime.bigint() - t0) / 1e6); regTotal = f.length; regOut = f.filter((s) => [s.x1, s.x2].some((v) => v < -1 || v > 601) || [s.y1, s.y2].some((v) => v < -1 || v > 601)).length; }
    t.sort((a, b) => a - b);
    w.set(`__useHex = true; baseNetTransform = ${J(SPEC)};`);
    const u = []; let fTotal = 0, fOut = 0, mesh = null; for (let i = 0; i < 5; i++) { const t0 = process.hrtime.bigint(); const f = w.frame(); u.push(Number(process.hrtime.bigint() - t0) / 1e6); fTotal = f.length; fOut = f.filter((s) => [s.x1, s.x2].some((v) => v < -1 || v > 601) || [s.y1, s.y2].some((v) => v < -1 || v > 601)).length; }
    u.sort((a, b) => a - b); mesh = w.get('netWarpForBase(netTransformNow(), currentShape, outerCorners, nodeCount, shapeSizeFactor).meshes');
    out.frameMs[`${X}/${Y}`] = { noNetMedian: Math.round(t[2] * 10) / 10, fieldMedian: Math.round(u[2] * 10) / 10, meshes: mesh };
    out.tileHex[`${X}/${Y}`] = { regularSegments: regTotal, regularOutsideCanvas: regOut, fieldSegments: fTotal, fieldOutsideCanvas: fOut };
}
process.stdout.write(J(out, null, 1) + '\n');
