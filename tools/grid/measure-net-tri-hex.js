// Task 087: Netz-Feld fuer Dreieck, Sechseck und gerade Groessen — Messung (Typ R, read-only).
//   node tools/grid/measure-net-tri-hex.js [--svg]   -> JSON on stdout; --svg writes pictures to reports/logs/ (not committed)
// Everything runs on the REAL core files (tools/morph/render-harness.js); the only "copies" are in-memory overrides inside the vm:
//   - warps are built with the real makeNetWarp() and a frame of our choosing (netWarpForBase refuses triangle / hexagon);
//   - for even sizes netDomainEffective() is overridden in the vm to accept them. Nothing is written into the repo.
// Sections:
//   A  triangle / hexagon, X != Y odd (3/5, 5/3, 5/7, 7/5): frames O (orthogonal box dx x dy), P (lattice parallelogram that CONTAINS the tile, c0 = centroid - 2/3 (v1+v2) for the triangle),
//      Pc (lattice parallelogram centred on the tile): field outline vs canvas, crossings of macro lines, kink sizes, inverse, polyline cost, tile straddling, symmetry about the centroid
//   B  X = Y (600 x 600 exception): box field X e x Y h inside 600 x 600 (option b), form-true areas (option c), seams
//   C  square, even sizes (4/4, 4/5, 2/6, 6/5) x sinus, tangens, geometric: where the even field breaks, symmetry, E1 (law as is, centre on a macro line) vs E2 (Rt + 1 odd, tile aligned, border cells clipped)
'use strict';
const fs = require('fs');
const path = require('path');
const H = require(path.join(__dirname, '..', 'morph', 'render-harness.js'));
const J = JSON.stringify;
const MODE = 'rotation_reflection6';
const R3 = Math.sqrt(3);
const f2 = (x) => Math.round(x * 100) / 100, f4 = (x) => Math.round(x * 1e4) / 1e4, f6 = (x) => Math.round(x * 1e6) / 1e6;
const WANT_SVG = process.argv.includes('--svg');
const LOGDIR = path.join(__dirname, '..', '..', 'reports', 'logs');

const worlds = {};
function W(shape) {
    if (!worlds[shape]) { worlds[shape] = H.makeRenderWorld(shape, 3, 3, MODE); worlds[shape].set('var canvasSizeSync = function () { width = canvasW; height = canvasH; };'); worlds[shape].set(HELPERS); }
    return worlds[shape];
}
function setup(w, shape, ord, X, Y) {
    w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: ord, lage: 1 })}); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600;
        setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = []; redoStack = []; baseNetTransform = null; baseNetAnimation = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base';
        baseFaceAssignments = new Map(); baseFacePalette = null; baseFaceAnchor = null; showFaces = false; rebuildGrid(currentShape);`);
}

// ---- helpers living inside the vm (they call the REAL netwarp functions) ----
const HELPERS = `
var __ptSeg = function (p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy; let t = L ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); };
// frame kinds for the base sheet of the current shape: O = orthogonal box (dx x dy), P = lattice parallelogram containing the tile, Pc = lattice parallelogram centred on the tile
var __frame = function (kind, X, Y) {
    const e = 600 / Math.min(X, Y), mw = getMeshWidth();
    const dx = currentShape === 'hex' ? (Math.sqrt(3) / 2) * e : e, dy = currentShape === 'triangle' ? (Math.sqrt(3) / 2) * e : e;
    if (kind === 'O') return { c0: { x: canvasW / 2 - dx / 2, y: canvasH / 2 - dy / 2 }, v1: { x: dx, y: 0 }, v2: { x: 0, y: dy } };
    const v1 = mw.v1, v2 = mw.v2, k = kind === 'P' ? (currentShape === 'triangle' ? 2 / 3 : 1 / 2) : 1 / 2;
    return { c0: { x: centroid.x - k * (v1.x + v2.x), y: centroid.y - k * (v1.y + v2.y) }, v1, v2 };
};
var __stCoords = function (fr, p) { const det = fr.v1.x * fr.v2.y - fr.v2.x * fr.v1.y, dx = p.x - fr.c0.x, dy = p.y - fr.c0.y; return { s: (dx * fr.v2.y - dy * fr.v2.x) / det, t: (fr.v1.x * dy - fr.v1.y * dx) / det }; };
// every drawn regular segment of the base sheet over the canvas (warp off), as the collector sees it
var __regularSegs = function () { const keep = activeNetWarp; activeNetWarp = null; const out = []; segmentCollector = out; try { _drawTessellationCore(); } finally { segmentCollector = null; activeNetWarp = keep; } return out; };
// the tile polygons (regular coordinates) of the base sheet over the canvas
var __tiles = function () {
    const mw = getMeshWidth(), out = [], pad = 3, oc = outerCorners, c = centroid, v1 = mw.v1, v2 = mw.v2;
    const shift = (p, i, j) => ({ x: p.x + i * v1.x + j * v2.x, y: p.y + i * v1.y + j * v2.y });
    for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) {
        const cen = shift(c, i, j);
        if (cen.x < -pad || cen.x > canvasW + pad || cen.y < -pad || cen.y > canvasH + pad) continue;
        out.push({ poly: oc.map(p => shift(p, i, j)), cen });
        if (currentShape === 'triangle') { const d = { x: cen.x + (2 / 3) * v2.x - (1 / 3) * v1.x, y: cen.y + (2 / 3) * v2.y - (1 / 3) * v1.y }; out.push({ poly: oc.map(p => { const q = shift(p, i, j); return { x: d.x - (q.x - cen.x), y: d.y - (q.y - cen.y) }; }), cen: d, down: true }); }
    }
    return out;
};
`;

// ---------------------------------------------------------------------------------------------------------------------------------
// A: triangle / hexagon, odd X != Y
// ---------------------------------------------------------------------------------------------------------------------------------
const SPEC = { x: { kind: 'trig', w: -0.9 }, y: { kind: 'trig', w: 0.7 }, domain: 'field' };
const outA = {};
const pics = {};
for (const shape of ['triangle', 'hex']) {
    const w = W(shape);
    outA[shape] = {};
    for (const [X, Y] of [[3, 5], [5, 3], [5, 7], [7, 5]]) {
        setup(w, shape, 3, X, Y);
        w.set('var __conns = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 60); connections = __conns;');
        const rec = {};
        for (const kind of ['O', 'P', 'Pc']) {
            rec[kind] = w.get(`(function () {
                const X = ${X}, Y = ${Y}, kind = ${J(kind)}, spec = ${J(SPEC)}, C = { x: canvasW / 2, y: canvasH / 2 };
                const fr = __frame(kind, X, Y), warp = makeNetWarp(spec, fr, 3, { x: X, y: Y });
                if (!warp || warp.domain !== 'field') return { error: 'no field warp: ' + J(warp && warp.domainIgnored) };
                const hx = (X - 1) / 2, hy = (Y - 1) / 2, R = (v) => Math.round(v * 1e4) / 1e4;
                // field outline: the images of the 4 field corners (regular) ; coverage of the canvas by the field parallelogram
                const fc = [[-hx, -hy], [X - hx, -hy], [X - hx, Y - hy], [-hx, Y - hy]].map(([s, t]) => ({ x: fr.c0.x + s * fr.v1.x + t * fr.v2.x, y: fr.c0.y + s * fr.v1.y + t * fr.v2.y }));
                let inside = 0, tot = 0; for (let ix = 0; ix < 120; ix++) for (let iy = 0; iy < 120; iy++) { const p = { x: (ix + 0.5) / 120 * canvasW, y: (iy + 0.5) / 120 * canvasH }; tot++; if (netWarpInsideNet(warp, p)) inside++; }
                // regular segments over the canvas, clipped to those with both ends in the canvas
                const segs = __regularSegs().filter(s => [s.x1, s.x2].every(v => v >= -1e-6 && v <= canvasW + 1e-6) && [s.y1, s.y2].every(v => v >= -1e-6 && v <= canvasH + 1e-6));
                let cross = 0, maxKink = 0, sumKink = 0, kinkN = 0, splitVerts = 0, outsideAfter = 0;
                const crossKink = (p1, p2) => {
                    const a = netWarpTileCoords(warp, p1), b = netWarpTileCoords(warp, p2), ts = [];
                    const ax = (u0, u1, hh, law) => { if (!law) return; const lo = Math.min(u0, u1), hi = Math.max(u0, u1); for (let k = Math.max(-hh + 1, Math.floor(lo)); k <= Math.min(X, Math.ceil(hi)); k++) { if (lo < k - 1e-9 && hi > k + 1e-9) ts.push((k - u0) / (u1 - u0)); } };
                    ax(a.s, b.s, hx, warp.fx); ax(a.t, b.t, hy, warp.fy);
                    if (!ts.length) return null;
                    const q1 = applyNetWarp(warp, p1), q2 = applyNetWarp(warp, p2); let m = 0;
                    ts.forEach(t => { const q = applyNetWarp(warp, { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }); m = Math.max(m, __ptSeg(q, q1, q2)); });
                    return m;
                };
                const t0 = Date.now();
                segs.forEach(s => {
                    const p1 = { x: s.x1, y: s.y1 }, p2 = { x: s.x2, y: s.y2 };
                    const k = crossKink(p1, p2);
                    if (k !== null) { cross++; maxKink = Math.max(maxKink, k); sumKink += k; kinkN++; }
                    const sp = netWarpSplitSegment(warp, p1, p2); if (sp) splitVerts += sp.length - 2;
                    const q1 = applyNetWarp(warp, p1), q2 = applyNetWarp(warp, p2);
                    if (![q1.x, q2.x].every(v => v >= -1e-6 && v <= canvasW + 1e-6) || ![q1.y, q2.y].every(v => v >= -1e-6 && v <= canvasH + 1e-6)) outsideAfter++;
                });
                const splitMs = Date.now() - t0;
                // inverse
                let inv = 0; for (let ix = 0; ix <= 12; ix++) for (let iy = 0; iy <= 12; iy++) { const p = { x: ix / 12 * canvasW, y: iy / 12 * canvasH }; const b1 = applyNetWarp(warp, invertNetWarp(warp, p)), b2 = invertNetWarp(warp, applyNetWarp(warp, p)); inv = Math.max(inv, Math.hypot(b1.x - p.x, b1.y - p.y), Math.hypot(b2.x - p.x, b2.y - p.y)); }
                // tile straddling (faces are affine per cell only if the tile polygon lies in one cell)
                const tiles = __tiles(); let strad = 0, tileKink = 0, nT = 0;
                tiles.forEach(T => {
                    if (T.cen.x < 0 || T.cen.x > canvasW || T.cen.y < 0 || T.cen.y > canvasH) return;
                    nT++; let st = false, tk = 0;
                    for (let i = 0; i < T.poly.length; i++) { const k = crossKink(T.poly[i], T.poly[(i + 1) % T.poly.length]); if (k !== null) { st = true; tk = Math.max(tk, k); } }
                    // a tile can straddle with all its edges inside macro cells only if an interior diagonal crosses: test the (s,t) ranges of the vertices
                    const ss = T.poly.map(p => netWarpTileCoords(warp, p)); const rg = (a) => [Math.min(...a), Math.max(...a)];
                    const [s0, s1] = rg(ss.map(q => q.s)), [t0_, t1] = rg(ss.map(q => q.t));
                    const sk = (lo, hi, hh) => { for (let k = -hh + 1; k <= hh; k++) if (lo < k - 1e-9 && hi > k + 1e-9) return true; return false; };
                    if (sk(s0, s1, hx) || sk(t0_, t1, hy)) st = true;
                    if (st) strad++; tileKink = Math.max(tileKink, tk);
                });
                // symmetry about the centroid: rot 120 (triangle) / rot 60 (hexagon), mirror about the vertical axis through the centroid
                const ctr = centroid; let r3 = 0, mir = 0, r180 = 0;
                const ang = currentShape === 'triangle' ? 120 : 60;
                for (let ix = 1; ix <= 7; ix++) for (let iy = 1; iy <= 7; iy++) {
                    const p = { x: ix / 8 * canvasW, y: iy / 8 * canvasH }, q = applyNetWarp(warp, p);
                    const a = applyNetWarp(warp, rotateAround(p, ctr, ang)), b = rotateAround(q, ctr, ang); r3 = Math.max(r3, Math.hypot(a.x - b.x, a.y - b.y));
                    const m = applyNetWarp(warp, { x: 2 * ctr.x - p.x, y: p.y }); mir = Math.max(mir, Math.hypot(m.x - (2 * ctr.x - q.x), m.y - q.y));
                    const r = applyNetWarp(warp, rotateAround(p, ctr, 180)), r2 = rotateAround(q, ctr, 180); r180 = Math.max(r180, Math.hypot(r.x - r2.x, r.y - r2.y));
                }
                const xs = fc.map(p => p.x), ys = fc.map(p => p.y);
                return { canvas: [R(canvasW), R(canvasH)], fieldBBox: [[R(Math.min(...xs)), R(Math.min(...ys))], [R(Math.max(...xs)), R(Math.max(...ys))]], canvasShareInsideField: R(inside / tot),
                    segments: segs.length, crossing: cross, crossingShare: R(cross / segs.length), maxKinkPx: R(maxKink), meanKinkPx: R(kinkN ? sumKink / kinkN : 0), splitExtraVertices: splitVerts, splitMs, outsideAfterWarp: outsideAfter,
                    inverseMaxErrPx: inv, tiles: nT, tilesStraddling: strad, tileStraddleShare: R(strad / nT), maxTileEdgeKinkPx: R(tileKink), rotErrPx: R(r3), rot180ErrPx: R(r180), mirrorErrPx: R(mir) };
            })()`);
        }
        outA[shape][`${X}/${Y}`] = rec;
        if (WANT_SVG && X === 3 && Y === 5 || WANT_SVG && shape === 'hex' && X === 5 && Y === 3) pics[`${shape}-${X}x${Y}`] = svgPair(w, shape, X, Y);
    }
}

// picture: regular lattice segments through the warp for frame O (left) and frame P/Pc (right), polylines at macro crossings, field outline
function svgPair(w, shape, X, Y) {
    const data = {};
    for (const kind of ['O', shape === 'triangle' ? 'P' : 'Pc']) {
        data[kind] = w.get(`(function () {
            const X = ${X}, Y = ${Y}, fr = __frame(${J(kind)}, X, Y), warp = makeNetWarp(${J(SPEC)}, fr, 3, { x: X, y: Y });
            const segs = __regularSegs(), out = [];
            segs.forEach(s => { const p1 = { x: s.x1, y: s.y1 }, p2 = { x: s.x2, y: s.y2 }, sp = netWarpSplitSegment(warp, p1, p2) || [p1, p2]; out.push(sp.map(q => applyNetWarp(warp, q))); });
            const hx = (X - 1) / 2, hy = (Y - 1) / 2, c = (s, t) => ({ x: fr.c0.x + s * fr.v1.x + t * fr.v2.x, y: fr.c0.y + s * fr.v1.y + t * fr.v2.y });
            const outline = [c(-hx, -hy), c(X - hx, -hy), c(X - hx, Y - hy), c(-hx, Y - hy)];
            return { lines: out, outline, W: canvasW, H: canvasH };
        })()`);
    }
    const kinds = Object.keys(data), Wd = data[kinds[0]].W, Hd = data[kinds[0]].H, gap = 40;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd * 2 + gap * 3}" height="${Hd + 2 * gap}" viewBox="0 0 ${Wd * 2 + gap * 3} ${Hd + 2 * gap}"><rect width="100%" height="100%" fill="#fff"/>`;
    kinds.forEach((k, i) => {
        const ox = gap + i * (Wd + gap), oy = gap, d = data[k];
        svg += `<g transform="translate(${ox},${oy})"><clipPath id="c${i}"><rect width="${Wd}" height="${Hd}"/></clipPath><rect width="${Wd}" height="${Hd}" fill="none" stroke="#000" stroke-width="2"/>`;
        svg += `<g clip-path="url(#c${i})">` + d.lines.map(l => `<polyline fill="none" stroke="#1a3a8a" stroke-width="1" points="${l.map(p => f2(p.x) + ',' + f2(p.y)).join(' ')}"/>`).join('') + '</g>';
        svg += `<polygon fill="none" stroke="#d22" stroke-width="2" stroke-dasharray="6 4" points="${d.outline.map(p => f2(p.x) + ',' + f2(p.y)).join(' ')}"/>`;
        svg += `<text x="4" y="-10" font-size="16" font-family="sans-serif">${shape} ${X}/${Y} frame ${k} (red = field outline)</text></g>`;
    });
    return svg + '</svg>';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// B: X = Y, 600 x 600 exception
// ---------------------------------------------------------------------------------------------------------------------------------
const outB = { optionB_box: {}, optionC_formtrue: {}, seams: {} };
for (const shape of ['triangle', 'hex']) {
    const w = W(shape);
    for (const n of [3, 5, 7, 9]) {
        setup(w, shape, 3, n, n);
        w.set('connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 60);');
        const e = 600 / n, dx = shape === 'hex' ? R3 / 2 * e : e, dy = shape === 'triangle' ? R3 / 2 * e : e;
        const boxW = n * dx, boxH = n * dy;
        // option b: the box field boxW x boxH centred in 600 x 600; outside regular. segments crossing the box border: F is the identity ON the border, so they just get a vertex there.
        const rec = w.get(`(function () {
            const n = ${n}, fr = __frame('O', n, n), warp = makeNetWarp(${J(SPEC)}, fr, 3, { x: n, y: n });
            if (!warp || warp.domain !== 'field') return { error: 'no field' };
            const segs = __regularSegs().filter(s => [s.x1, s.x2].every(v => v >= -1e-6 && v <= canvasW + 1e-6) && [s.y1, s.y2].every(v => v >= -1e-6 && v <= canvasH + 1e-6));
            const hh = (n - 1) / 2; let inBox = 0, outBox = 0, straddleBorder = 0, maxTurn = 0;
            const inside = (p) => { const c = netWarpTileCoords(warp, p); return c.s >= -hh - 1e-9 && c.s <= n - hh + 1e-9 && c.t >= -hh - 1e-9 && c.t <= n - hh + 1e-9; };
            segs.forEach(s => { const a = inside({ x: s.x1, y: s.y1 }), b = inside({ x: s.x2, y: s.y2 }); if (a && b) inBox++; else if (!a && !b) outBox++; else straddleBorder++; });
            // slope of the linear extension beyond the box (what the real code would draw outside): d F / d s at the edge vs 1
            const P = warp.fx.field.P, edgeSlope = (P[n] - P[n - 1]);
            return { boxW: ${f2(boxW)}, boxH: ${f2(boxH)}, segmentsInsideBox: inBox, outsideBox: outBox, crossingBoxBorder: straddleBorder, edgeTileWidthFactor: Math.round(edgeSlope * 1e4) / 1e4, bandTopBottom_or_leftRight: [Math.round((canvasW - ${f2(boxW)}) / 2 * 100) / 100, Math.round((canvasH - ${f2(boxH)}) / 2 * 100) / 100] };
        })()`);
        outB.optionB_box[`${shape} ${n}/${n}`] = rec;
        outB.optionC_formtrue[`${shape} ${n}/${n}`] = { canvasToday: [600, 600], canvasFormTrue: [f2(boxW), f2(boxH)], shortSide: f2(Math.min(boxW, boxH)), cellEdge: f2(e) };
    }
}
// seams to the neighbouring sizes (081 formula): the form-true area of n/n vs (n,n+1) and (n+1,n) areas
const gw = (shape, X, Y) => { if (X === Y) return 600; const e = 600 / Math.min(X, Y); return shape === 'hex' ? X * R3 / 2 * e : X < Y ? 600 : X * e; };
const gh = (shape, X, Y) => { if (X === Y) return 600; const e = 600 / Math.min(X, Y); return shape === 'triangle' ? Y * R3 / 2 * e : Y < X ? 600 : Y * e; };
for (const shape of ['triangle', 'hex']) outB.seams[shape] = [[3, 3], [3, 4], [4, 3], [5, 5], [5, 6], [6, 5]].map(([X, Y]) => `${X}/${Y}: ${f2(gw(shape, X, Y))} x ${f2(gh(shape, X, Y))}`);
outB.goldenOffPath = { note: 'tools/morph/off-path-specs.json: 30 patterns, 4 triangle, 21 square, 5 hex, all 600 x 600 (X = Y)' };

// ---------------------------------------------------------------------------------------------------------------------------------
// C: square, even sizes
// ---------------------------------------------------------------------------------------------------------------------------------
const outC = {};
const LAWS = { sinus: { kind: 'trig', w: -0.9 }, tangens: { kind: 'trig', w: 0.7 }, geometric: { kind: 'geometric', w: Math.log(4) } };
{
    const w = W('square');
    // let netDomainEffective accept even counts (E1: law as is, centre of the area on a macro line), real function otherwise
    w.set(`var __realNDE = netDomainEffective; var __allowEven = false; netDomainEffective = function (spec, Rt) { if (__allowEven && spec && spec.domain === 'field') return { domain: 'field', ignored: null }; return __realNDE(spec, Rt); };`);
    const first = {};   // where the real code stops
    for (const [X, Y] of [[4, 4], [4, 5], [2, 6], [6, 5]]) {
        setup(w, 'square', 3, X, Y);
        first[`${X}/${Y}`] = w.get(`(function () { const fr = __frame('O', ${X}, ${Y}); const wp = makeNetWarp(${J({ x: LAWS.sinus, y: 'same', domain: 'field' })}, fr, 3, { x: ${X}, y: ${Y} }); const e = netDomainEffective({ domain: 'field' }, { x: ${X}, y: ${Y} }); return { realCodeDomain: wp ? wp.domain : null, ignored: e.ignored && e.ignored.reason }; })()`);
        outC[`${X}/${Y}`] = {};
        for (const [lawName, law] of Object.entries(LAWS)) {
            const spec = { x: law, y: 'same', domain: 'field' };
            const rec = {};
            for (const opt of ['E1', 'E2']) {
                rec[opt] = w.get(`(function () {
                    const X = ${X}, Y = ${Y}, opt = ${J(opt)}, spec = ${J(spec)}, R = (v) => Math.round(v * 1e4) / 1e4;
                    const e = 600 / Math.min(X, Y), base = __frame('O', X, Y);   // base tile = the tile at the canvas centre
                    let Rt, c0;
                    __allowEven = (opt === 'E1');
                    // E1: Rt = X, Y as they are (even allowed); E2: the tile-aligned field Rt + 1 on an even axis (odd, 3..9), outer cells clipped by the canvas
                    Rt = opt === 'E1' ? { x: X, y: Y } : { x: X % 2 ? X : X + 1, y: Y % 2 ? Y : Y + 1 };
                    if (opt === 'E2' && (Rt.x > 9 || Rt.y > 9)) { __allowEven = false; return { error: 'Rt+1 > 9' }; }
                    const warp = makeNetWarp(spec, base, 3, Rt); __allowEven = false;
                    if (!warp || warp.domain !== 'field') return { error: 'no field: ' + JSON.stringify(warp && warp.domainIgnored) };
                    const hx = warp.field.hx !== undefined ? warp.field.hx : warp.field.h, hy = warp.field.hy !== undefined ? warp.field.hy : warp.field.h;
                    const rx = Rt.x, ry = Rt.y;
                    // 1. kink inside tiles: every tile copy of the base tile, its diagonal (regular) against the mapped chord
                    let kink = 0, tiles = 0, kinkTilesN = 0;
                    for (let i = -Math.ceil(rx / 2); i <= Math.ceil(rx / 2); i++) for (let j = -Math.ceil(ry / 2); j <= Math.ceil(ry / 2); j++) {
                        const a = { x: base.c0.x + i * base.v1.x, y: base.c0.y + j * base.v2.y }, b = { x: a.x + base.v1.x, y: a.y + base.v2.y };
                        if (b.x < 0 || a.x > canvasW || b.y < 0 || a.y > canvasH) continue;
                        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, qa = applyNetWarp(warp, a), qb = applyNetWarp(warp, b), qm = applyNetWarp(warp, m);
                        const k = Math.hypot(qm.x - (qa.x + qb.x) / 2, qm.y - (qa.y + qb.y) / 2); tiles++; if (k > 1e-6) kinkTilesN++; kink = Math.max(kink, k);
                    }
                    // 2. symmetry about the canvas centre: mirror x, mirror y, rot180, rot90 (X = Y)
                    const C = { x: canvasW / 2, y: canvasH / 2 }; let mx = 0, my = 0, r2 = 0, r4 = 0;
                    for (let ix = 1; ix <= 9; ix++) for (let iy = 1; iy <= 9; iy++) {
                        const p = { x: ix / 10 * canvasW, y: iy / 10 * canvasH }, q = applyNetWarp(warp, p);
                        const a = applyNetWarp(warp, { x: 2 * C.x - p.x, y: p.y }); mx = Math.max(mx, Math.hypot(a.x - (2 * C.x - q.x), a.y - q.y));
                        const b = applyNetWarp(warp, { x: p.x, y: 2 * C.y - p.y }); my = Math.max(my, Math.hypot(b.x - q.x, b.y - (2 * C.y - q.y)));
                        const c = applyNetWarp(warp, { x: 2 * C.x - p.x, y: 2 * C.y - p.y }); r2 = Math.max(r2, Math.hypot(c.x - (2 * C.x - q.x), c.y - (2 * C.y - q.y)));
                        if (X === Y) { const d = applyNetWarp(warp, rotateAround(p, C, 90)), d2 = rotateAround(q, C, 90); r4 = Math.max(r4, Math.hypot(d.x - d2.x, d.y - d2.y)); }
                    }
                    // 3. what the canvas border does: the warped images of the left/top border lines (0 = the net ends exactly on the frame)
                    const bl = applyNetWarp(warp, { x: 0, y: canvasH / 2 }), bt = applyNetWarp(warp, { x: canvasW / 2, y: 0 }), br = applyNetWarp(warp, { x: canvasW, y: canvasH / 2 }), bb = applyNetWarp(warp, { x: canvasW / 2, y: canvasH });
                    const border = Math.max(Math.abs(bl.x), Math.abs(bt.y), Math.abs(br.x - canvasW), Math.abs(bb.y - canvasH));
                    // 4. continuity to the regular net: displacement at strength 1/1000 of the law (Aus <-> Feld has no jump)
                    const small = JSON.parse(JSON.stringify(spec)); small.x.w = spec.x.w * 1e-3; __allowEven = (opt === 'E1');
                    const w2 = makeNetWarp(small, base, 3, Rt); __allowEven = false; let disp = 0, dispFull = 0;
                    for (let ix = 0; ix <= 10; ix++) for (let iy = 0; iy <= 10; iy++) { const p = { x: ix / 10 * canvasW, y: iy / 10 * canvasH }; if (w2) { const q = applyNetWarp(w2, p); disp = Math.max(disp, Math.hypot(q.x - p.x, q.y - p.y)); } const q = applyNetWarp(warp, p); dispFull = Math.max(dispFull, Math.hypot(q.x - p.x, q.y - p.y)); }
                    // 5. the widths of the macro cells that are VISIBLE in the canvas along x
                    const P = warp.fx.field.P, vis = []; for (let k = 0; k < rx; k++) { const lo = Math.max(base.c0.x + (k - hx) * base.v1.x * 1, 0), hi = Math.min(base.c0.x + (k - hx + 1) * base.v1.x, canvasW); }
                    const widths = []; for (let k = 0; k < rx; k++) widths.push(R((P[k + 1] - P[k]) * e));
                    // 6. inverse
                    let inv = 0; for (let ix = 0; ix <= 10; ix++) for (let iy = 0; iy <= 10; iy++) { const p = { x: ix / 10 * canvasW, y: iy / 10 * canvasH }, b1 = applyNetWarp(warp, invertNetWarp(warp, p)); inv = Math.max(inv, Math.hypot(b1.x - p.x, b1.y - p.y)); }
                    return { Rt: [rx, ry], tilesInCanvas: tiles, tilesWithKink: kinkTilesN, maxKinkInsideTilePx: R(kink), mirrorXErr: R(mx), mirrorYErr: R(my), rot180Err: R(r2), rot90Err: X === Y ? R(r4) : null, borderGapPx: R(border), displacementAtW1e3Px: R(disp), displacementFullPx: R(dispFull), macroWidthsXpx: widths, inverseErr: inv };
                })()`);
            }
            outC[`${X}/${Y}`][lawName] = rec;
        }
    }
    outC.firstBreak = first;
}


// ---------------------------------------------------------------------------------------------------------------------------------
// 087c part 1: X, Y <-> E1, E2 (meshes), counts of triangles / hexagons W
// ---------------------------------------------------------------------------------------------------------------------------------
const outD = {};
for (const shape of ['square', 'triangle', 'hex']) {
    const w = W(shape);
    for (const [X, Y] of [[3, 5], [5, 5]]) {
        setup(w, shape, 3, X, Y);
        outD[`${shape} ${X}/${Y}`] = w.get(`(function () {
            const X = ${X}, Y = ${Y}, tiles = __tiles(), mw = getMeshWidth(), e = 600 / Math.min(X, Y), det = Math.abs(mw.v1.x * mw.v2.y - mw.v2.x * mw.v1.y);
            const inC = tiles.filter(T => T.cen.x >= 0 && T.cen.x <= canvasW && T.cen.y >= 0 && T.cen.y <= canvasH);
            const full = tiles.filter(T => T.poly.every(p => p.x >= -1e-6 && p.x <= canvasW + 1e-6 && p.y >= -1e-6 && p.y <= canvasH + 1e-6));
            const poly = tiles[0].poly, area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; };
            const tileArea = area(poly), cellArea = (currentShape === 'hex' ? Math.sqrt(3) / 2 * e * e : currentShape === 'triangle' ? Math.sqrt(3) / 2 * e * e : e * e);   // the O frame cell dx x dy
            return { canvas: [Math.round(canvasW * 100) / 100, Math.round(canvasH * 100) / 100], edge: e, latticeMeshArea: Math.round(det * 100) / 100, tileArea: Math.round(tileArea * 100) / 100, tilesCentreInCanvas: inC.length, tilesFullyInside: full.length,
                canvasAreaOverTileArea: Math.round(canvasW * canvasH / tileArea * 1000) / 1000, rectMeshes_XY: X * Y, rectCellsOfCanvas: Math.round(canvasW * canvasH / cellArea * 1000) / 1000 };
        })()`);
    }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 087c parts 2-4: E3 (even sizes), triangle / hexagon frames, images. Manual field warps (the 086 trick: field rectangle in c0/v1/v2, base tile in frame)
// ---------------------------------------------------------------------------------------------------------------------------------
const HELPERS2 = `
var __mkField = function (spec, base, Rx, Ry, hx, hy) {
    const ax = spec.x, ay = spec.y === 'same' ? spec.x : spec.y, fx = netFieldLaw(ax, Rx), fy = netFieldLaw(ay, Ry);
    const det = base.v1.x * base.v2.y - base.v2.x * base.v1.y;
    const c0 = { x: base.c0.x - hx * base.v1.x - hy * base.v2.x, y: base.c0.y - hx * base.v1.y - hy * base.v2.y }, v1 = { x: Rx * base.v1.x, y: Rx * base.v1.y }, v2 = { x: Ry * base.v2.x, y: Ry * base.v2.y };
    return { fx: fx, fy: fy, altX: false, altY: false, repeat: false, domain: 'field', field: { Rt: 1, h: 0, Rx: Rx, Ry: Ry, hx: hx, hy: hy }, frame: { c0: base.c0, v1: base.v1, v2: base.v2, det: det }, domainIgnored: null, c0: c0, v1: v1, v2: v2, det: v1.x * v2.y - v2.x * v1.y };
};
// the polyline of the image of the straight segment p1p2 (vertices at the integer-sigma lines of the field law, any Rx, Ry, half-integer or integer h)
var __poly = function (warp, p1, p2) {
    const a = netWarpTileCoords(warp, p1), b = netWarpTileCoords(warp, p2), f = warp.field, hx = f.hx, hy = f.hy, Rx = f.Rx, Ry = f.Ry, ts = [];
    if (warp.fx && a.s !== b.s) for (let m = 1; m < Rx; m++) { const sm = m - hx; if ((a.s - sm) * (b.s - sm) < 0) ts.push((sm - a.s) / (b.s - a.s)); }
    if (warp.fy && a.t !== b.t) for (let m = 1; m < Ry; m++) { const tm = m - hy; if ((a.t - tm) * (b.t - tm) < 0) ts.push((tm - a.t) / (b.t - a.t)); }
    ts.sort(function (x, y) { return x - y; });
    const pts = [p1]; ts.forEach(function (t) { pts.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }); }); pts.push(p2);
    return pts.map(function (q) { return applyNetWarp(warp, q); });
};
var __shiftSegs = function (segs, sx, sy) { return segs.map(function (s) { return { x1: s.x1 + sx, y1: s.y1 + sy, x2: s.x2 + sx, y2: s.y2 + sy }; }); };
var __inCanvas = function (p) { return p.x >= -1e-6 && p.x <= canvasW + 1e-6 && p.y >= -1e-6 && p.y <= canvasH + 1e-6; };
// stats of a field warp over the current canvas: coverage, uncovered area, whole / cut meshes, visible meshes per axis, kinks of segments over macro lines, split cost, inverse
var __stats = function (warp, sx, sy) {
    const W_ = canvasW, H_ = canvasH, F = warp.frame || warp, f = warp.field, Rx = f.Rx, Ry = f.Ry, hx = f.hx, hy = f.hy, R = function (v) { return Math.round(v * 1e4) / 1e4; };
    let ins = 0, tot = 0; for (let ix = 0; ix < 150; ix++) for (let iy = 0; iy < 150; iy++) { tot++; if (netWarpInsideNet(warp, { x: (ix + 0.5) / 150 * W_, y: (iy + 0.5) / 150 * H_ })) ins++; }
    const at = function (s, t) { return applyNetWarp(warp, { x: F.c0.x + s * F.v1.x + t * F.v2.x, y: F.c0.y + s * F.v1.y + t * F.v2.y }); };
    let whole = 0, cut = 0; const cols = {}, rows = {};
    for (let a = 0; a < Rx; a++) for (let b = 0; b < Ry; b++) {
        const i = a - hx, j = b - hy, c = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
        const x0 = Math.min.apply(null, c.map(function (p) { return p.x; })), x1 = Math.max.apply(null, c.map(function (p) { return p.x; })), y0 = Math.min.apply(null, c.map(function (p) { return p.y; })), y1 = Math.max.apply(null, c.map(function (p) { return p.y; }));
        if (x1 <= 1e-6 || x0 >= W_ - 1e-6 || y1 <= 1e-6 || y0 >= H_ - 1e-6) continue;
        if (c.every(__inCanvas)) whole++; else cut++;
        cols[a] = 1; rows[b] = 1;
    }
    const segs = __shiftSegs(__regularSegs(), sx || 0, sy || 0).filter(function (s) { return __inCanvas({ x: s.x1, y: s.y1 }) && __inCanvas({ x: s.x2, y: s.y2 }); });
    let cross = 0, maxK = 0, verts = 0; const t0 = Date.now();
    segs.forEach(function (s) {
        const pl = __poly(warp, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
        if (pl.length > 2) { cross++; verts += pl.length - 2; const q1 = pl[0], q2 = pl[pl.length - 1]; for (let k = 1; k < pl.length - 1; k++) maxK = Math.max(maxK, __ptSeg(pl[k], q1, q2)); }
    });
    const ms = Date.now() - t0;
    let inv = 0; for (let ix = 0; ix <= 10; ix++) for (let iy = 0; iy <= 10; iy++) { const p = { x: ix / 10 * W_, y: iy / 10 * H_ }, q = applyNetWarp(warp, invertNetWarp(warp, p)); inv = Math.max(inv, Math.hypot(q.x - p.x, q.y - p.y)); }
    return { Rt: [Rx, Ry], coveragePct: R(100 * ins / tot), uncoveredPx2: Math.round((1 - ins / tot) * W_ * H_), meshesWhole: whole, meshesCut: cut, visibleCols: Object.keys(cols).length, visibleRows: Object.keys(rows).length,
        segments: segs.length, segmentsOverMacro: cross, maxKinkPx: R(maxK), splitVertices: verts, splitMs: ms, inverseErrPx: inv };
};
`;
const SPEC3 = { x: { kind: 'trig', w: -0.9 }, y: { kind: 'trig', w: 0.7 }, domain: 'field' };
const LAWS3 = { sinus: { kind: 'trig', w: -0.9 }, tangens: { kind: 'trig', w: 0.7 }, geometric: { kind: 'geometric', w: Math.log(4) } };
const oddUp = (n) => (n % 2 ? n : n + 1);
const picsC = {};
function svgPanels(name, panels) {
    const gap = 30, W0 = panels[0].W, H0 = panels[0].H, n = panels.length, sc = Math.min(1, 420 / W0), pw = W0 * sc, ph = H0 * sc;
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (n * (pw + gap) + gap) + '" height="' + (ph + 2 * gap + 10) + '"><rect width="100%" height="100%" fill="#fff"/>';
    panels.forEach((p, i) => {
        const ox = gap + i * (pw + gap), oy = gap + 6;
        svg += '<g transform="translate(' + ox + ',' + oy + ') scale(' + sc + ')"><clipPath id="c' + i + '"><rect width="' + p.W + '" height="' + p.H + '"/></clipPath>';
        svg += '<g clip-path="url(#c' + i + ')">' + p.lines.map(l => '<polyline fill="none" stroke="#1a3a8a" stroke-width="' + (1.2 / sc) + '" points="' + l.map(q => f2(q.x) + ',' + f2(q.y)).join(' ') + '"/>').join('') + '</g>';
        svg += '<rect width="' + p.W + '" height="' + p.H + '" fill="none" stroke="#000" stroke-width="' + (2 / sc) + '"/>';
        if (p.outline) svg += '<polygon fill="none" stroke="#d22" stroke-width="' + (2 / sc) + '" stroke-dasharray="' + (6 / sc) + ' ' + (4 / sc) + '" points="' + p.outline.map(q => f2(q.x) + ',' + f2(q.y)).join(' ') + '"/>';
        svg += '<text x="0" y="' + (-8 / sc) + '" font-size="' + (13 / sc) + '" font-family="sans-serif">' + p.title + '</text></g>';
    });
    svg += '</svg>';
    fs.mkdirSync(LOGDIR, { recursive: true });
    fs.writeFileSync(path.join(LOGDIR, '087c-' + name + '.svg'), svg);
    try { require('child_process').execFileSync('rsvg-convert', ['-w', String(Math.round(n * (pw + gap) + gap)), '-o', path.join(LOGDIR, '087c-' + name + '.png'), path.join(LOGDIR, '087c-' + name + '.svg')], { stdio: 'ignore' }); } catch (e) { }
}
const getPanel = (w, title, code) => Object.assign({ title }, w.get('(function () { const r = ' + code + '; return { lines: r.lines, outline: r.outline, W: canvasW, H: canvasH }; })()'));

// ---- part 2: square, even sizes: E1 / E2 / E3 ----
const outE = {};
{
    const w = W('square'); w.set(HELPERS2);
    const buildWarp = `function (opt, X, Y, spec) {
        const e = 600 / Math.min(X, Y), base = __frame('O', X, Y), sx = (opt === 'E3' && X % 2 === 0) ? e / 2 : 0, sy = (opt === 'E3' && Y % 2 === 0) ? e / 2 : 0;
        const b = { c0: { x: base.c0.x + sx, y: base.c0.y + sy }, v1: base.v1, v2: base.v2 };
        let Rx = X, Ry = Y, hx = (X - 1) / 2, hy = (Y - 1) / 2;
        if (opt === 'E2') { Rx = X % 2 ? X : X + 1; Ry = Y % 2 ? Y : Y + 1; hx = (Rx - 1) / 2; hy = (Ry - 1) / 2; }
        if (opt === 'E3') { hx = X / 2 === Math.floor(X / 2) ? X / 2 : (X - 1) / 2; hy = Y / 2 === Math.floor(Y / 2) ? Y / 2 : (Y - 1) / 2; }
        return { warp: __mkField(spec, b, Rx, Ry, hx, hy), sx: sx, sy: sy, e: e };
    }`;
    w.set('var __buildE = ' + buildWarp + ';');
    for (const [X, Y] of [[4, 4], [4, 5], [2, 6], [6, 5]]) {
        setup(w, 'square', 3, X, Y);
        w.set('connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 3);');
        outE[`${X}/${Y}`] = {};
        for (const [lawName, law] of Object.entries(LAWS3)) {
            const rec = {};
            for (const opt of ['E1', 'E2', 'E3']) {
                rec[opt] = w.get(`(function () {
                    const X = ${X}, Y = ${Y}, spec = ${J({ x: law, y: 'same', domain: 'field' })}, r = __buildE(${J(opt)}, X, Y, spec), warp = r.warp, F = warp.frame, f = warp.field, R = function (v) { return Math.round(v * 1e4) / 1e4; };
                    const W_ = canvasW, H_ = canvasH, C = { x: W_ / 2, y: H_ / 2 };
                    // kink inside the lattice tiles: tile i,j = base + i v1 + j v2 (the drawn lattice, shifted by (sx, sy) in E3), diagonal vs mapped chord
                    let kink = 0, tiles = 0, kt = 0;
                    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
                        const a = { x: F.c0.x + i * F.v1.x, y: F.c0.y + j * F.v2.y }, b = { x: a.x + F.v1.x, y: a.y + F.v2.y };
                        if (b.x < 0 || a.x > W_ || b.y < 0 || a.y > H_) continue;
                        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, qa = applyNetWarp(warp, a), qb = applyNetWarp(warp, b), qm = applyNetWarp(warp, m), k = Math.hypot(qm.x - (qa.x + qb.x) / 2, qm.y - (qa.y + qb.y) / 2);
                        tiles++; if (k > 1e-6) kt++; kink = Math.max(kink, k);
                    }
                    let mx = 0, my = 0, r2 = 0, r4 = 0;
                    for (let ix = 1; ix <= 9; ix++) for (let iy = 1; iy <= 9; iy++) {
                        const p = { x: ix / 10 * W_, y: iy / 10 * H_ }, q = applyNetWarp(warp, p);
                        const a = applyNetWarp(warp, { x: 2 * C.x - p.x, y: p.y }); mx = Math.max(mx, Math.hypot(a.x - (2 * C.x - q.x), a.y - q.y));
                        const b = applyNetWarp(warp, { x: p.x, y: 2 * C.y - p.y }); my = Math.max(my, Math.hypot(b.x - q.x, b.y - (2 * C.y - q.y)));
                        const c = applyNetWarp(warp, { x: 2 * C.x - p.x, y: 2 * C.y - p.y }); r2 = Math.max(r2, Math.hypot(c.x - (2 * C.x - q.x), c.y - (2 * C.y - q.y)));
                        if (X === Y) { const d = applyNetWarp(warp, rotateAround(p, C, 90)), d2 = rotateAround(q, C, 90); r4 = Math.max(r4, Math.hypot(d.x - d2.x, d.y - d2.y)); }
                    }
                    const bl = applyNetWarp(warp, { x: 0, y: H_ / 2 }), bt = applyNetWarp(warp, { x: W_ / 2, y: 0 }), br = applyNetWarp(warp, { x: W_, y: H_ / 2 }), bb = applyNetWarp(warp, { x: W_ / 2, y: H_ });
                    const st = __stats(warp, r.sx, r.sy);
                    return { Rt: st.Rt, tilesInCanvas: tiles, tilesWithKink: kt, maxKinkInTilePx: R(kink), mirrorXErr: R(mx), mirrorYErr: R(my), rot180Err: R(r2), rot90Err: X === Y ? R(r4) : null, borderGapPx: R(Math.max(Math.abs(bl.x), Math.abs(bt.y), Math.abs(br.x - W_), Math.abs(bb.y - H_))),
                        baseTileShiftVsAusPx: [R(r.sx), R(r.sy)], inverseErrPx: st.inverseErrPx, coveragePct: st.coveragePct, meshesWhole: st.meshesWhole, meshesCut: st.meshesCut };
                })()`);
            }
            outE[`${X}/${Y}`][lawName] = rec;
        }
        if ((X === 4 && Y === 4) || (X === 4 && Y === 5)) {
            const panels = ['E1', 'E2', 'E3'].map((opt) => getPanel(w, `square ${X}/${Y} ${opt} (sinus)`, `(function () {
                const r = __buildE(${J(opt)}, ${X}, ${Y}, ${J({ x: LAWS3.sinus, y: 'same', domain: 'field' })}), warp = r.warp, F = warp.frame, f = warp.field;
                const segs = __shiftSegs(__regularSegs(), r.sx, r.sy), lines = segs.map(function (s) { return __poly(warp, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }); });
                const c = function (s, t) { return { x: F.c0.x + s * F.v1.x + t * F.v2.x, y: F.c0.y + s * F.v1.y + t * F.v2.y }; };
                return { lines: lines, outline: [c(-f.hx, -f.hy), c(f.Rx - f.hx, -f.hy), c(f.Rx - f.hx, f.Ry - f.hy), c(-f.hx, f.Ry - f.hy)] };
            })()`));
            svgPanels(`square-${X}x${Y}-E1E2E3`, panels);
        }
    }
}

// ---- parts 3 + 4: triangle / hexagon frames ----
const outF = {};
for (const shape of ['triangle', 'hex']) {
    const w = W(shape); w.set(HELPERS2);
    w.set(`var __buildF = function (kind, X, Y, spec) {
        const mw = getMeshWidth(), e = 600 / Math.min(X, Y), O = __frame('O', X, Y), P = __frame('P', X, Y);
        if (kind === 'O') return __mkField(spec, O, X, Y, (X - 1) / 2, (Y - 1) / 2);
        if (kind === 'Pexact') return __mkField(spec, P, X, Y, (X - 1) / 2, (Y - 1) / 2);
        if (kind === 'Pcirc') { let best = null; const full = function (wp) { for (let ix = 0; ix < 40; ix++) for (let iy = 0; iy < 40; iy++) if (!netWarpInsideNet(wp, { x: (ix + 0.5) / 40 * canvasW, y: (iy + 0.5) / 40 * canvasH })) return false; return true; };
            for (let Rx = X; Rx <= 21; Rx += 2) for (let Ry = Y; Ry <= 21; Ry += 2) { if (best && Rx * Ry >= best.n) continue; const wp = __mkField(spec, P, Rx, Ry, (Rx - 1) / 2, (Ry - 1) / 2); if (full(wp)) best = { n: Rx * Ry, wp: wp }; }
            return best ? best.wp : __mkField(spec, P, 21, 21, 10, 10); }
        if (kind === 'Ofine') { const b = { c0: { x: O.c0.x + O.v1.x / 3, y: O.c0.y }, v1: { x: O.v1.x / 3, y: 0 }, v2: O.v2 }, Rx = 3 * X; return __mkField(spec, b, Rx, Y, (Rx - 1) / 2, (Y - 1) / 2); }
        if (kind === 'Pfine') { const v1 = mw.v1, v2 = mw.v2, f1 = { x: (v1.x + v2.x) / 3, y: (v1.y + v2.y) / 3 }, f2 = { x: (2 * v2.x - v1.x) / 3, y: (2 * v2.y - v1.y) / 3 }, k = 1 / 2, b = { c0: { x: centroid.x - k * (f1.x + f2.x), y: centroid.y - k * (f1.y + f2.y) }, v1: f1, v2: f2 };
            const Rx = (function (n) { return n % 2 ? n : n + 1; })(3 * X + Math.ceil(Y / 2)), Ry = (function (n) { return n % 2 ? n : n + 1; })(3 * Y); return __mkField(spec, b, Rx, Ry, (Rx - 1) / 2, (Ry - 1) / 2); }
    };`);
    const kinds = shape === 'triangle' ? ['Pexact', 'Pcirc', 'O'] : ['Pexact', 'Pcirc', 'O', 'Ofine', 'Pfine'];
    for (const [X, Y] of (shape === 'triangle' ? [[3, 5], [5, 3], [5, 5], [7, 5]] : [[3, 5], [5, 3], [5, 5]])) {
        setup(w, shape, 3, X, Y);
        w.set('connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 60);');   // many segments: the kink statistics need slanted edges too
        const rec = {};
        for (const kind of kinds) rec[kind] = w.get(`(function () { const wp = __buildF(${J(kind)}, ${X}, ${Y}, ${J(SPEC3)}); return wp ? __stats(wp, 0, 0) : null; })()`);
        outF[`${shape} ${X}/${Y}`] = rec;
        w.set('connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 6);');   // a lighter example form for the pictures
        if (shape === 'triangle' || (X === 3 && Y === 5) || (X === 5 && Y === 5)) {
            const pk = shape === 'triangle' ? ['Pexact', 'Pcirc', 'O'] : ['Pexact', 'Pcirc', 'O', 'Ofine', 'Pfine'];
            const panels = pk.map((kind) => getPanel(w, `${shape} ${X}/${Y} frame ${kind}`, `(function () {
                const warp = __buildF(${J(kind)}, ${X}, ${Y}, ${J(SPEC3)}), F = warp.frame, f = warp.field, segs = __regularSegs(), lines = segs.map(function (s) { return __poly(warp, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }); });
                const c = function (s, t) { return { x: F.c0.x + s * F.v1.x + t * F.v2.x, y: F.c0.y + s * F.v1.y + t * F.v2.y }; };
                return { lines: lines, outline: [c(-f.hx, -f.hy), c(f.Rx - f.hx, -f.hy), c(f.Rx - f.hx, f.Ry - f.hy), c(-f.hx, f.Ry - f.hy)] };
            })()`));
            svgPanels(`${shape}-${X}x${Y}-frames`, panels);
        }
    }
}
const out = { A_triangleHex_oddXneY: outA, B_XeqY: outB, C_squareEven: outC, D_part1_mapping: outD, E_part2_E3: outE, F_part34_frames: outF };
if (WANT_SVG) {
    fs.mkdirSync(LOGDIR, { recursive: true });
    Object.entries(pics).forEach(([k, svg]) => fs.writeFileSync(path.join(LOGDIR, `087-${k}.svg`), svg));
}
process.stdout.write(J(out, null, 1) + '\n');
