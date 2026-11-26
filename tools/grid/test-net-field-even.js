// Task 105 (N2a-1) / 106 (N2a-2): the Field net on an EVEN tile count per axis of the SQUARE (core/netwarp.js; task 106: free for the square, the triangle and the hexagon stay odd; the floor of the square's axis is `netFieldMinTiles` = 3, the tests set 2).
//   node tools/grid/test-net-field-even.js      sabotage runs: the test mutates core/netwarp.js into temp copies and runs ITSELF (EVEN_FAST=1) with NETWARP_JS = the copy: every run must fail (section 7)
//   1. every size pair with an even axis (2, 4, 6, 8 per axis, mixed with 3, 5, 7, 9; ratio <= 1:3) x 5 laws (regular, sinus, tangens, mixed axes, geometric): X * Y tiles drawn, 0 segments outside, field edge on the canvas edge (0 px),
//      every tile affine (kink 0), the tile areas fill W x H, mesh line at the canvas centre on an even axis / base tile centre at the centre on an odd one (symmetric laws), F(F^-1(p)) < 1e-8, trig symmetry (mirror, 180 deg, 90 deg at X = Y) 0 px,
//      dots = line ends (0 px, also against the warp core/tiling.js reads), hit test (invert(dot) = node, dot inside), faces allowed, the jump against Aus = e/2 per even axis
//   2. T exactly once per caller (task 105 step 0): applyNetWarp, invertNetWarp, netWarpInsideNet, netWarpFieldLocal, netWarpSplitSegment, netGridLines
//   3. Fig. 14 (E = 3 x 4): 4 x 3 and 3 x 4 sinus / tangens: mesh line in the middle of the even axis only
//   4. byte-equal to main 6ab1569c (frames, warps, exports, overlays, apply / invert / inside / local / split): odd x odd, an even square WITHOUT a field (no net / Single / Tiled), the triangle and the hexagon with a Field at every size 1..9 (even and odd)
//   5. the floor `netFieldMinTiles`: default 3, nothing but core/netwarp.js reads or writes it, an import (with or without fieldBase / gridShiftPx) cannot change it, the shape rule (even: square only; no or unknown shape = odd only), export fields only for an even axis
//   6. (kept for numbering) the jump in px
const fs = require('fs'), path = require('path'), os = require('os'), { execSync, spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const MODE = 'rotation_reflection6';
const HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; };';
const FAST = !!process.env.EVEN_FAST, CHILD = !!process.env.NETWARP_JS;
const MAIN = '6ab1569c';
const FILES = {};
if (process.env.NETWARP_JS) FILES['core/netwarp.js'] = process.env.NETWARP_JS;
const world = (shape, files) => { const w = H.makeRenderWorld(shape, 3, 3, MODE, files || FILES); w.set(HOOK); return w; };
const setup = (w, shape, X, Y, spec, conns) => w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: 3, lage: 1 })}); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600;
    setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = ${J(conns || [[1, 6], [2, 5]])}; redoStack = []; baseNetTransform = ${J(spec === undefined ? null : spec)}; baseNetAnimation = null;
    additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; baseFaceAnchor = null; baseLastHarmonyType = null; baseLastSelection = null; baseDistributionStrategy = null;
    showFaces = false; rebuildGrid(currentShape); connections = ${J(conns || [[1, 6], [2, 5]])};`);
const dom = { repeat: false, domain: 'field' };
const SPECS = {
    regular: Object.assign({ x: { kind: 'uniform', w: 0 }, y: 'same', keep: true }, dom),
    sinus: Object.assign({ x: { kind: 'trig', w: -0.8 }, y: 'same' }, dom),
    tangens: Object.assign({ x: { kind: 'trig', w: 0.7 }, y: 'same' }, dom),
    mixed: Object.assign({ x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.6 } }, dom),   // two different axes: a swapped axis, lo / hi or shift shows
    geometric: Object.assign({ x: { kind: 'geometric', w: Math.log(4) }, y: { kind: 'trig', w: -0.5, focus: 0.3 } }, dom),
};
const SYM = ['regular', 'sinus', 'tangens'];   // laws that are symmetric about the field centre on both axes
const PAIRS = [];
for (let X = 2; X <= 9; X++) for (let Y = 2; Y <= 9; Y++) if ((X % 2 === 0 || Y % 2 === 0) && Math.max(X, Y) <= 3 * Math.min(X, Y)) PAIRS.push([X, Y]);
const FASTPAIRS = [[4, 4], [3, 4], [4, 3], [2, 5], [6, 5]];
const USE = FAST ? FASTPAIRS : PAIRS;
const withEven = (w, fn) => { w.set('netFieldMinTiles = 2;'); try { return fn(); } finally { w.set('netFieldMinTiles = 3;'); } };   // n = 2 is a model case only (task 106: the UI floor is 3)

// the in-vm measurement of one case (switch ON)
const metrics = (w, X, Y, specName) => {
    const spec = SPECS[specName], sym = SYM.includes(specName);
    return w.get(`(function () {
        const warp = netWarpBaseNow(), W = canvasW, H = canvasH, Fr = _netFrame(warp), [hx, hy] = _netFieldH(warp), [ux, uy] = _netFieldHi(warp), T = _netShiftVec(warp) || { x: 0, y: 0 }, X = ${X}, Y = ${Y};
        if (!warp || warp.domain !== 'field') return { domain: warp && warp.domain };
        const out = { domain: warp.domain, tiles: [warp.field.Rx, warp.field.Ry], hx, hy, ux, uy, T };
        const reg = (s, t) => ({ x: Fr.c0.x + s * Fr.v1.x + t * Fr.v2.x, y: Fr.c0.y + s * Fr.v1.y + t * Fr.v2.y });
        out.rect = [warp.c0.x + T.x, warp.c0.y + T.y, warp.c0.x + warp.v1.x + T.x - W, warp.c0.y + warp.v2.y + T.y - H].map(v => Math.abs(v));   // the regular-space field rectangle + T = the canvas
        let edge = 0;
        for (let i = 0; i <= 40; i++) { const u = i / 40, a = (p) => applyNetWarp(warp, p), at = (uu, vv) => ({ x: warp.c0.x + uu * warp.v1.x + vv * warp.v2.x, y: warp.c0.y + uu * warp.v1.y + vv * warp.v2.y });
            edge = Math.max(edge, Math.abs(a(at(0, u)).x), Math.abs(a(at(1, u)).x - W), Math.abs(a(at(u, 0)).y), Math.abs(a(at(u, 1)).y - H)); }
        out.edge = edge;
        let knick = 0, area = 0, tiles = 0;
        for (let i = -hx; i <= ux; i++) for (let j = -hy; j <= uy; j++) {
            tiles++;
            const P = (l, m) => applyNetWarp(warp, reg(i + l, j + m)), p00 = P(0, 0), p10 = P(1, 0), p01 = P(0, 1), p11 = P(1, 1);
            for (const l of [0.25, 0.5, 0.75, 1]) for (const m of [0, 0.25, 0.5, 0.75, 1]) { const q = P(l, m); knick = Math.max(knick, Math.hypot(q.x - (p00.x + l * (p10.x - p00.x) + m * (p01.x - p00.x)), q.y - (p00.y + l * (p10.y - p00.y) + m * (p01.y - p00.y)))); }
            const c = [p00, p10, p11, p01]; let a = 0; for (let k = 0; k < 4; k++) { const p = c[k], q = c[(k + 1) % 4]; a += p.x * q.y - q.x * p.y; } area += Math.abs(a) / 2;
        }
        out.knick = knick; out.area = area; out.W = W; out.H = H; out.tileCount = tiles;
        let inv = 0, seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 300; i++) { const p = { x: rnd() * W, y: rnd() * H }, q = applyNetWarp(warp, invertNetWarp(warp, p)); inv = Math.max(inv, Math.hypot(q.x - p.x, q.y - p.y)); }
        out.inv = inv;
        // centre: an even axis has a tile boundary (s = 0 for x) at the canvas centre, an odd axis the centre of the base tile
        const evX = X % 2 === 0, evY = Y % 2 === 0, cs = evX ? 0 : 0.5, ct = evY ? 0 : 0.5, cp = applyNetWarp(warp, reg(cs, ct));
        out.centre = [Math.abs(cp.x - W / 2), Math.abs(cp.y - H / 2)];
        // symmetry about the canvas centre (the picture of p is F(p + T); q = p + T runs over [0, W] x [0, H])
        const img = q => applyNetWarp(warp, { x: q.x - T.x, y: q.y - T.y });
        let sym = { mx: 0, my: 0, r180: 0, r90: 0 };
        for (let i = 0; i < 200; i++) {
            const q = { x: rnd() * W, y: rnd() * H }, a = img(q), mx = img({ x: W - q.x, y: q.y }), my = img({ x: q.x, y: H - q.y }), r = img({ x: W - q.x, y: H - q.y });
            sym.mx = Math.max(sym.mx, Math.hypot(mx.x - (W - a.x), mx.y - a.y)); sym.my = Math.max(sym.my, Math.hypot(my.x - a.x, my.y - (H - a.y))); sym.r180 = Math.max(sym.r180, Math.hypot(r.x - (W - a.x), r.y - (H - a.y)));
            if (W === H) { const c = W / 2, r9 = img({ x: 2 * c - q.y, y: q.x }); sym.r90 = Math.max(sym.r90, Math.hypot(r9.x - (2 * c - a.y), r9.y - a.x)); }
        }
        out.sym = sym;
        // dots = line ends: the warp core/tiling.js reads (shapeSizeFactor) against the live one; hit test
        const nwDraw = netWarpForBase(netTransformNow(), currentShape, outerCorners, nodeCount, shapeSizeFactor);
        let dot = 0, hit = 0, ins = 0, nIn = 0; for (const nd of nodes) {
            const a = applyNetWarp(nwDraw, nd), b = applyNetWarp(warp, nd); dot = Math.max(dot, Math.hypot(a.x - b.x, a.y - b.y));
            const r = invertNetWarp(warp, b); hit = Math.max(hit, Math.hypot(r.x - nd.x, r.y - nd.y));
            if (b.x > 1e-6 && b.x < W - 1e-6 && b.y > 1e-6 && b.y < H - 1e-6) { nIn++; if (!netWarpInsideNet(warp, b)) ins++; }
        }
        out.dot = dot; out.hit = hit; out.insideBad = ins; out.nIn = nIn;
        // the jump against Aus (w -> 0): picture(p) - p
        const p0 = { x: 123.4, y: 234.5 }, q0 = applyNetWarp(warp, p0);
        out.afterPlain = [q0.x - p0.x, q0.y - p0.y];
        out.blocks = netWarpBlocksFaces();
        const fc = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()), keepC = connections; connections = fc;
        showFaces = true; out.faces = computeCellFaces(connections, nodes, null).faces.length; showFaces = false; connections = keepC;
        return out;
    })()`);
};
// frame based: tiles drawn, segments outside the canvas, every connection endpoint's dot is a line end
const framed = (w, X, Y, spec) => {
    const segs = w.frame(), W_ = w.get('canvasW'), H_ = w.get('canvasH');
    w.set(`baseNetTransform = ${J(Object.assign({}, spec, { domain: 'single' }))};`);
    const perTile = w.frame().length;
    w.set(`baseNetTransform = ${J(spec)};`);
    const outside = segs.filter(s => [s.x1, s.x2].some(v => v < -1e-6 || v > W_ + 1e-6) || [s.y1, s.y2].some(v => v < -1e-6 || v > H_ + 1e-6)).length;
    const ends = []; segs.forEach(s => { ends.push([s.x1, s.y1], [s.x2, s.y2]); });
    const dots = w.get(`(function () { const warp = netWarpBaseNow(), ids = new Set(); connections.forEach(c => { ids.add(c[0]); ids.add(c[1]); }); return nodes.filter(n => ids.has(n.id)).map(n => applyNetWarp(warp, n)); })()`);
    let worst = 0; for (const d of dots) { let best = Infinity; for (const e of ends) best = Math.min(best, Math.hypot(e[0] - d.x, e[1] - d.y)); worst = Math.max(worst, best); }
    return { drawnTiles: segs.length / perTile, outside, dotEnd: worst };
};

// ---- 1. every size pair with an even axis x 5 laws ----------------------------------------------------------------------------------------------------------
{
    const w = world('square'); let n = 0; const bad = {}, worst = { knick: 0, edge: 0, inv: 0, sym: 0, dot: 0, hit: 0, centre: 0 };
    const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    withEven(w, () => {
        for (const [X, Y] of USE) for (const name of Object.keys(SPECS)) {
            const spec = SPECS[name]; setup(w, 'square', X, Y, spec); n++;
            const m = metrics(w, X, Y, name), key = [X, Y, name];
            if (m.domain !== 'field' || m.tiles.join() !== [X, Y].join()) { note('domain', [key, m.domain, m.tiles]); continue; }
            if (m.hx !== Math.floor(X / 2) || m.hy !== Math.floor(Y / 2) || m.ux !== X - 1 - Math.floor(X / 2) || m.uy !== Y - 1 - Math.floor(Y / 2)) note('lohi', [key, m.hx, m.ux, m.hy, m.uy]);
            if (m.tileCount !== X * Y) note('tileCount', [key, m.tileCount]);
            if (Math.max(...m.rect) > 1e-6) note('rect', [key, m.rect]);
            worst.edge = Math.max(worst.edge, m.edge); if (m.edge > 1e-6) note('edge', [key, m.edge]);
            worst.knick = Math.max(worst.knick, m.knick); if (m.knick > 1e-9) note('knick', [key, m.knick]);
            if (Math.abs(m.area - m.W * m.H) > 1e-6) note('area', [key, m.area]);
            worst.inv = Math.max(worst.inv, m.inv); if (m.inv > 1e-8) note('inv', [key, m.inv]);
            if (SYM.includes(name)) {
                worst.centre = Math.max(worst.centre, ...m.centre); if (Math.max(...m.centre) > 1e-9) note('centre', [key, m.centre]);
                const s = Math.max(m.sym.mx, m.sym.my, m.sym.r180, X === Y ? m.sym.r90 : 0); worst.sym = Math.max(worst.sym, s); if (s > 1e-9) note('sym', [key, m.sym]);
            }
            worst.dot = Math.max(worst.dot, m.dot); if (m.dot !== 0) note('dotWarp', [key, m.dot]);
            worst.hit = Math.max(worst.hit, m.hit); if (m.hit > 1e-8) note('hit', [key, m.hit]);
            if (m.insideBad) note('inside', [key, m.insideBad, m.nIn]);
            if (m.blocks || m.faces < 1) note('faces', [key, m.blocks, m.faces]);
            if (name === 'regular') {   // the jump against Aus: T = e/2 per even axis, 0 per odd one (the plain grid and the picture of a regular net differ by T only)
                const e = 600 / Math.min(X, Y), want = [X % 2 === 0 ? e / 2 : 0, Y % 2 === 0 ? e / 2 : 0];
                if (Math.abs(m.afterPlain[0] - want[0]) > 1e-9 || Math.abs(m.afterPlain[1] - want[1]) > 1e-9) note('jump', [key, m.afterPlain, want]);
            }
            if (name === 'sinus' || name === 'geometric') {   // the frame: all tiles, none outside, dots = line ends
                const f = framed(w, X, Y, spec);
                if (Math.abs(f.drawnTiles - X * Y) > 1e-9) note('drawnTiles', [key, f.drawnTiles]);
                if (f.outside) note('outside', [key, f.outside]);
                if (f.dotEnd > 1e-6) note('dotEnd', [key, f.dotEnd]);
            }
        }
    });
    console.log('REPORT worst values over all cases:', J(Object.fromEntries(Object.entries(worst).map(([k, v]) => [k, Number(v.toPrecision(3))]))), 'cases', n);
    check(`(1) ${USE.length} size pairs with an even axis x 5 laws (${n} cases): X*Y tiles drawn, 0 segments outside, edge 0 px, kink 0 (worst ${worst.knick.toExponential(1)}), areas fill W x H, centre, F(F^-1) < 1e-8, trig symmetry, dots = line ends, hit test, faces allowed, jump = e/2`, n === USE.length * 5 && !bad.first, J(bad));
}

// ---- 2. T exactly once per caller ---------------------------------------------------------------------------------------------------------------------------
{
    const w = world('square'), bad = {}; let n = 0;
    const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    withEven(w, () => {
        for (const [X, Y] of USE) {
            const e = 600 / Math.min(X, Y), Tx = X % 2 === 0 ? e / 2 : 0, Ty = Y % 2 === 0 ? e / 2 : 0;
            // applyNetWarp: a regular net (identity law) moves every point by exactly T
            setup(w, 'square', X, Y, SPECS.regular);
            const a = w.get(`(function () { const warp = netWarpBaseNow(); let m = 0; for (let i = 0; i < 50; i++) { const p = { x: 13 * i + 5, y: 7 * i + 9 }, q = applyNetWarp(warp, p); m = Math.max(m, Math.abs(q.x - p.x - ${Tx}), Math.abs(q.y - p.y - ${Ty})); } return m; })()`);
            if (a > 1e-9) note('apply', [X, Y, a]); n++;
            setup(w, 'square', X, Y, SPECS.mixed);
            const r = w.get(`(function () {
                const warp = netWarpBaseNow(), W = canvasW, H = canvasH, Fr = _netFrame(warp), [hx, hy] = _netFieldH(warp), [ux, uy] = _netFieldHi(warp); let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
                const reg = (s, t) => ({ x: Fr.c0.x + s * Fr.v1.x + t * Fr.v2.x, y: Fr.c0.y + s * Fr.v1.y + t * Fr.v2.y });
                // invert: both ways; a regular point in the field rectangle
                let inv1 = 0, loc = 0, locTile = 0, nLoc = 0;
                for (let i = 0; i < 200; i++) {
                    const s = -hx + rnd() * (hx + ux + 1), t = -hy + rnd() * (hy + uy + 1), p = reg(s, t), q = applyNetWarp(warp, p), b = invertNetWarp(warp, q);
                    inv1 = Math.max(inv1, Math.hypot(b.x - p.x, b.y - p.y));
                    const f = netWarpFieldLocal(warp, q); nLoc++;
                    const ti = Math.floor(s), tj = Math.floor(t), want = { x: p.x - ti * Fr.v1.x - tj * Fr.v2.x, y: p.y - ti * Fr.v1.y - tj * Fr.v2.y };
                    if (!f) { locTile++; continue; }
                    loc = Math.max(loc, Math.hypot(f.x - want.x, f.y - want.y)); if (f.tile.i !== ti || f.tile.j !== tj) locTile++;
                }
                // inside: 1 px inside / outside every side of the picture (an image-space click)
                const side = [[1, H / 2, true], [-1, H / 2, false], [W - 1, H / 2, true], [W + 1, H / 2, false], [W / 2, 1, true], [W / 2, -1, false], [W / 2, H - 1, true], [W / 2, H + 1, false]];
                const insBad = side.filter(([x, y, want]) => netWarpInsideNet(warp, { x, y }) !== want).length;
                // split: a long straight regular segment crosses every inner tile boundary of each axis once (n - 1); its image lies on the polyline through the mapped crossings
                const L = reg(-hx + 0.3, 0.5), R = reg(ux + 1 - 0.3, 0.5), U = reg(0.5, -hy + 0.3), D = reg(0.5, uy + 1 - 0.3), sx = netWarpSplitSegment(warp, L, R), sy = netWarpSplitSegment(warp, U, D);
                let worst = 0;
                for (let i = 0; i < 100; i++) {
                    const p1 = reg(-hx + rnd() * (hx + ux + 1), -hy + rnd() * (hy + uy + 1)), p2 = reg(-hx + rnd() * (hx + ux + 1), -hy + rnd() * (hy + uy + 1)), pts = netWarpSplitSegment(warp, p1, p2); if (!pts) continue;
                    const mapped = pts.map(p => applyNetWarp(warp, p));
                    for (let k = 1; k < 30; k++) {
                        const tt = k / 30, qq = applyNetWarp(warp, { x: p1.x + tt * (p2.x - p1.x), y: p1.y + tt * (p2.y - p1.y) }); let best = Infinity;
                        for (let j = 0; j + 1 < mapped.length; j++) { const a = mapped[j], b = mapped[j + 1], dx = b.x - a.x, dy = b.y - a.y, LL = dx * dx + dy * dy, u = LL ? Math.max(0, Math.min(1, ((qq.x - a.x) * dx + (qq.y - a.y) * dy) / LL)) : 0; best = Math.min(best, Math.hypot(qq.x - (a.x + u * dx), qq.y - (a.y + u * dy))); }
                        worst = Math.max(worst, best);
                    }
                }
                return { inv1, loc, locTile, nLoc, insBad, nx: sx ? sx.length : 0, ny: sy ? sy.length : 0, worst };
            })()`);
            n++;
            if (r.inv1 > 1e-8) note('invert', [X, Y, r.inv1]);
            if (r.loc > 1e-8 || r.locTile) note('fieldLocal', [X, Y, r.loc, r.locTile]);
            if (r.insBad) note('inside', [X, Y, r.insBad]);
            if (r.nx !== X + 1 || r.ny !== Y + 1) note('splitCount', [X, Y, r.nx, r.ny]);
            if (r.worst > 1e-6) note('splitImage', [X, Y, r.worst]);
            // netGridLines (the overlay, no frame option): the macro lines sit on the images of the tile boundaries and run edge to edge
            const lines = w.get(`netGridLines(netTransformNow(), outerCorners, baseGridDivisions(), { x0: 0, y0: 0, x1: width, y1: height }, { closed: true, domain: 'field', fieldTiles: { x: ${X}, y: ${Y} } })`);
            const warpPts = w.get(`(function () { const warp = netWarpBaseNow(), Fr = _netFrame(warp), [hx, hy] = _netFieldH(warp); const reg = (s, t) => ({ x: Fr.c0.x + s * Fr.v1.x + t * Fr.v2.x, y: Fr.c0.y + s * Fr.v1.y + t * Fr.v2.y }); return { xs: Array.from({ length: ${X} + 1 }, (_, k) => applyNetWarp(warp, reg(k - hx, 0.5)).x), ys: Array.from({ length: ${Y} + 1 }, (_, k) => applyNetWarp(warp, reg(0.5, k - hy)).y) }; })()`);
            const E = w.get('baseGridDivisions()');
            const vx = lines.filter(l => l.axis === 'v' && l.level === 'macro').map(l => l.x1).sort((a, b) => a - b), hy_ = lines.filter(l => l.axis === 'h' && l.level === 'macro').map(l => l.y1).sort((a, b) => a - b);
            const ok = vx.length === X + 1 && hy_.length === Y + 1 && vx.every((v, k) => Math.abs(v - warpPts.xs[k]) < 1e-9) && hy_.every((v, k) => Math.abs(v - warpPts.ys[k]) < 1e-9)
                && lines.filter(l => l.axis === 'v').every(l => Math.abs(Math.min(l.y1, l.y2)) < 1e-9 && Math.abs(Math.max(l.y1, l.y2) - w.get('canvasH')) < 1e-9) && lines.filter(l => l.axis === 'h').every(l => Math.abs(Math.min(l.x1, l.x2)) < 1e-9 && Math.abs(Math.max(l.x1, l.x2) - w.get('canvasW')) < 1e-9);
            if (!ok) note('overlay', [X, Y, vx.length, hy_.length, E]); n++;
        }
    });
    check(`(2) T exactly once per caller (${n} runs): applyNetWarp (regular net = T), invertNetWarp, netWarpFieldLocal (tile and local point), netWarpInsideNet (picture frame +-1 px), netWarpSplitSegment (X+1 / Y+1 points, image on the polyline), netGridLines (macro lines on the tile-boundary images, edge to edge)`, !bad.first && n > 0, J(bad));
}

// ---- 3. Fig. 14 (E = 3 x 4): the mesh line in the middle of the even axis only -------------------------------------------------------------------------------
{
    const w = world('square'), bad = {};
    withEven(w, () => {
        for (const [X, Y] of [[4, 3], [3, 4]]) for (const name of ['sinus', 'tangens']) {
            setup(w, 'square', X, Y, SPECS[name]);
            const lines = w.get(`netGridLines(netTransformNow(), outerCorners, baseGridDivisions(), { x0: 0, y0: 0, x1: width, y1: height }, { closed: true, domain: 'field', fieldTiles: { x: ${X}, y: ${Y} } })`), W = w.get('canvasW'), Hh = w.get('canvasH');
            const vx = lines.filter(l => l.axis === 'v' && l.level === 'macro').map(l => l.x1), hy = lines.filter(l => l.axis === 'h' && l.level === 'macro').map(l => l.y1);
            const midX = vx.some(v => Math.abs(v - W / 2) < 1e-9), midY = hy.some(v => Math.abs(v - Hh / 2) < 1e-9);
            if (midX !== (X % 2 === 0) || midY !== (Y % 2 === 0)) bad[[X, Y, name]] = [midX, midY];
            if (vx.length !== X + 1 || hy.length !== Y + 1) bad['count' + [X, Y, name]] = [vx.length, hy.length];
        }
    });
    check('(3) Fig. 14 sizes 4 x 3 and 3 x 4, sinus and tangens: a mesh line at the canvas centre exactly on the even axis (not on the odd one), X + 1 and Y + 1 macro lines', Object.keys(bad).length === 0, J(bad));
}

// ---- 4. odd axes and the switch OFF: byte-equal to main -----------------------------------------------------------------------------------------------------
if (!CHILD) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'even105-')), mainFile = path.join(dir, 'netwarp.js');
    fs.writeFileSync(mainFile, execSync(`git show ${MAIN}:core/netwarp.js`, { cwd: ROOT, maxBuffer: 1 << 26 }));
    const MAINFILES = { 'core/netwarp.js': mainFile };   // state.js / export.js of the tree stay (they only pass the shape on; main's netDomainEffective ignores the extra argument)
    const worlds = {};
    const wOf = (kind, shape) => worlds[kind + shape] || (worlds[kind + shape] = world(shape, kind === 'main' ? MAINFILES : {}));
    const snap = (w, shape, X, Y, spec) => {
        setup(w, shape, X, Y, spec);
        return J(w.get(`(function () {
            const warp = netWarpBaseNow(), out = { warp: warp ? JSON.parse(JSON.stringify(warp)) : null, domain: netDomainEffective(baseNetTransform, netSizeFactors()), blocks: netWarpBlocksFaces(), exp: buildExportData(null).meta.netTransform || null };
            ${shape === 'square' ? '' : 'out.domainShape = netDomainEffective(baseNetTransform, netSizeFactors(), currentShape);'}
            out.exp2 = baseNetTransform ? netTransformExportData(baseNetTransform, baseGridDivisions(), _netSize(), undefined, currentShape) : null;
            out.lines = netGridLines(netTransformNow(), outerCorners, baseGridDivisions(), { x0: 0, y0: 0, x1: width, y1: height }, warp && warp.field ? { closed: true, domain: 'field', fieldTiles: warp.field.Rx !== undefined ? { x: warp.field.Rx, y: warp.field.Ry } : warp.field.Rt } : { closed: !!warp && !warp.repeat });
            if (warp) { let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const pts = []; for (let i = 0; i < 60; i++) { const p = { x: rnd() * canvasW, y: rnd() * canvasH }, q = { x: rnd() * canvasW, y: rnd() * canvasH };
                pts.push([applyNetWarp(warp, p), invertNetWarp(warp, p), netWarpInsideNet(warp, p), warp.field ? netWarpFieldLocal(warp, p) : null, netWarpSplitSegment(warp, p, q)]); } out.pts = pts; }
            return out;
        })()`)) + J(w.frame());
    };
    let n = 0; const diffs = [];
    const cases = [];
    for (const X of [3, 5, 7, 9]) for (const Y of [3, 5, 7, 9]) for (const name of ['mixed', 'geometric']) cases.push(['square', X, Y, SPECS[name], 'odd']);
    const NOFIELD = { single: Object.assign({}, SPECS.mixed, { domain: 'single' }), tiled: Object.assign({}, SPECS.mixed, { domain: 'tiled', repeat: true }) };
    for (const [X, Y] of [[4, 4], [3, 4], [4, 3], [2, 5], [6, 6], [8, 3], [1, 2]]) for (const [nm, sp] of [['none', null], ['single', NOFIELD.single], ['tiled', NOFIELD.tiled]]) cases.push(['square', X, Y, sp, 'even-nofield-' + nm]);
    for (const shape of ['triangle', 'hex']) for (let X = 1; X <= 9; X++) for (const Y of [1, 2, 3, 4, 5, 7, 8, 9]) if (Math.max(X, Y) <= 3 * Math.min(X, Y) && !((shape === 'triangle' || shape === 'hex') && ((X % 2 === 0 && X >= 4) || (Y % 2 === 0 && Y >= 4)))) for (const name of ['mixed', 'geometric']) cases.push([shape, X, Y, SPECS[name], shape + '-field']);   // task 108: the triangle at an even size with a Field is a Field now (test-net-field-triangle-even.js)
    for (const [shape, X, Y, spec, kind] of cases) {
        const a = snap(wOf('main', shape), shape, X, Y, spec), b = snap(wOf('new', shape), shape, X, Y, spec); n++;
        if (a !== b) diffs.push([shape, X, Y, kind]);
        if (kind === 'odd') {   // the same with the floor lowered to 2: odd axes are not touched by it
            const wn = wOf('new', shape); wn.set('netFieldMinTiles = 2;'); try { if (snap(wn, shape, X, Y, spec) !== a) diffs.push([shape, X, Y, 'odd-min2']); } finally { wn.set('netFieldMinTiles = 3;'); }
        }
    }
    check(`(4) frames, warps, domains, exports, overlays and apply / invert / inside / local / split byte-equal to main ${MAIN}: odd x odd (floor 3 and 2), an even square without a field (none / Single / Tiled), the hexagon and the triangle with a Field except with an even axis >= 4 (tasks 108 / 109: a Field now, or another ignored-reason text when the other axis is below 3) (${n} cases)`, diffs.length === 0 && n > 140, J(diffs.slice(0, 6)) + ' n=' + n);
}

// ---- 5. the floor and the shape rule --------------------------------------------------------------------------------------------------------------------------
{
    const w = world('square');
    const eff = (shape, X, Y) => w.get(`netDomainEffective({ domain: 'field' }, { x: ${X}, y: ${Y} }${shape === undefined ? '' : ', ' + J(shape)}).ignored === null`);
    const rules = {
        floor: w.get('netFieldMinTiles') === 3,
        squareEven: eff('square', 4, 4) && eff('square', 3, 4) && eff('square', 4, 3) && eff('square', 8, 8) && eff('square', 6, 5),
        squareFloor: !eff('square', 2, 2) && !eff('square', 2, 5) && !eff('square', 1, 3) && eff('square', 3, 3),
        squareMax: !eff('square', 10, 4),
        triHexOdd: eff('triangle', 3, 5) && eff('hex', 9, 9) && eff('triangle', 3, 3),
        hexEven: eff('hex', 4, 4) && eff('hex', 4, 3) && eff('hex', 6, 5) && eff('hex', 8, 8) && !eff('hex', 2, 4) && !eff('hex', 1, 1),   // task 109: the hexagon takes 3..9 at any parity
        triEven: eff('triangle', 4, 4) && eff('triangle', 3, 4) && eff('triangle', 8, 8) && !eff('triangle', 2, 4) && !eff('triangle', 1, 1),   // task 108: the triangle takes 3..9 at any parity
        noShape: !eff(undefined, 4, 4) && !eff(undefined, 3, 4) && eff(undefined, 5, 5) && eff(undefined, 3, 5),   // no shape = the conservative rule: odd counts only
        unknownShape: !eff('circle', 4, 4) && !eff(null, 4, 4) && !eff('', 4, 4) && eff('circle', 5, 5),
    };
    // the real warp builders: the square builds an even field at the default floor, the triangle and the hexagon do not (they have no warp at an even size)
    setup(w, 'square', 4, 4, SPECS.mixed); const sq = w.get('netWarpBaseNow()'); rules.squareWarp = !!sq && sq.domain === 'field';
    for (const shape of ['triangle', 'hex']) { const wt = world(shape); setup(wt, shape, 4, 4, SPECS.mixed); rules['warp_' + shape] = (wt.get('netWarpBaseNow()') || {}).domain === 'field'; }   // tasks 108 / 109: both build an even Field
    const wn2 = world('square'); wn2.set('netFieldMinTiles = 2;'); const two = wn2.get("netDomainEffective({ domain: 'field' }, { x: 2, y: 4 }, 'square').ignored === null && netDomainEffective({ domain: 'field' }, { x: 2, y: 4 }, 'triangle').ignored !== null"); rules.floor2 = two;
    check('(5a) netFieldMinTiles is 3 by default; an even count is a Field on the square and (task 108) the triangle (3..9, floor 3, ceiling 9); the hexagon (task 109) takes it too; no or an unknown shape reads the conservative rule (odd only); the real builders agree', Object.values(rules).every(Boolean), J(rules));
    const users = [];
    const scan = (dirp, rec) => { for (const f of fs.readdirSync(dirp)) { const fp = path.join(dirp, f); const st = fs.statSync(fp); if (st.isDirectory()) { if (rec && !['node_modules', 'tools', 'reports', 'docs', 'tasks', '.git', 'assets', 'gallery', 'notebooks'].includes(f)) scan(fp, rec); } else if (/\.(js|mjs|html)$/.test(f) && /netFieldMinTiles|netFieldEven/.test(fs.readFileSync(fp, 'utf8'))) users.push(path.relative(ROOT, fp)); } };
    scan(ROOT, true);
    const expected = process.env.NETWARP_JS ? null : ['core/netwarp.js'];
    check('(5b) nothing but core/netwarp.js mentions netFieldMinTiles (no sketch.js, ui, session, export, html, URL path) and netFieldEven is gone everywhere', expected === null || J(users) === J(expected), J(users));
    // an import of an even-field export (with and without the two extra fields) neither changes the floor nor the spec reading
    const base = { version: 1, domain: 'field', repeat: false, x: { kind: 'trig', law: 'sinus', w: -0.8, a: 1.04 }, y: { kind: 'trig', law: 'tangens', w: 0.6, a: 0.72 }, fieldTiles: { x: 4, y: 3 } };
    const withExtra = Object.assign({}, base, { fieldBase: { x: { lo: 2, hi: 1 }, y: { lo: 1, hi: 1 } }, gridShiftPx: { x: 75, y: 0 }, netFieldMinTiles: 2 });
    const r = w.get(`(function () { const a = netTransformFromExport(${J(base)}), b = netTransformFromExport(${J(withExtra)}); return { same: JSON.stringify(a) === JSON.stringify(b), dom: a.domain, floor: netFieldMinTiles }; })()`);
    check('(5c) netTransformFromExport: an export without fieldBase / gridShiftPx imports exactly as one with them (the importer reads neither, not even a foreign netFieldMinTiles key); the import never changes netFieldMinTiles', r.same && r.dom === 'field' && r.floor === 3, J(r));
    // export: fieldBase / gridShiftPx only for an even axis (switch on); an odd field exports exactly as before
    const bad = [];
    withEven(w, () => {
        for (const [X, Y] of [[4, 4], [4, 3], [3, 6], [2, 5], [3, 3], [5, 7], [3, 5]]) {
            setup(w, 'square', X, Y, SPECS.mixed);
            const ex = w.get('buildExportData(null).meta.netTransform'), even = X % 2 === 0 || Y % 2 === 0, e = 600 / Math.min(X, Y);
            const has = ex && ex.fieldBase !== undefined && ex.gridShiftPx !== undefined;
            if (even !== !!has) bad.push(['presence', X, Y]);
            if (even && (ex.domain !== 'field' || J(ex.gridShiftPx) !== J({ x: X % 2 === 0 ? e / 2 : 0, y: Y % 2 === 0 ? e / 2 : 0 }) || ex.fieldBase.x.lo + ex.fieldBase.x.hi + 1 !== X || ex.fieldBase.y.lo + ex.fieldBase.y.hi + 1 !== Y)) bad.push(['values', X, Y, ex && ex.gridShiftPx, ex && ex.fieldBase]);
            if (!even && ex.domain !== 'field') bad.push(['domain', X, Y]);
        }
    });
    check('(5d) export (square, even axes): fieldBase {lo, hi} and gridShiftPx {x, y} (e/2 per even axis) only when an axis is even, odd fields carry neither', bad.length === 0, J(bad));
}

// ---- 6. layers and the spatial morph under an even Field (task 106: the Field is free, so these must be as right as at an odd size) ------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const SPEC6 = { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.6 }, repeat: false, domain: 'field' };
    const reset = (w, X, Y) => w.set(`currentShape = 'square'; shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = [[1, 6], [2, 5]]; redoStack = []; baseNetTransform = null; additionalLayers = []; timeline = null; showFaces = false; rebuildGrid(currentShape); connections = [[1, 6], [2, 5]];`);
    // (a) a layer's drawn pieces, mapped back by invertNetWarp, lie on the regular segments of the same layer (offset / rotation / another mode), at even and odd sizes
    let nl = 0;
    for (const [X, Y] of FAST ? [[4, 4], [3, 4]] : [[4, 4], [3, 4], [4, 3], [6, 5], [5, 5], [3, 5]]) for (const layer of [null, { offsetX: 20, offsetY: -10 }, { rotation: 17, offsetX: 5 }, { mode: 'rotation_reflection3', offsetX: -30, offsetY: 25, rotation: 90 }]) {
        const w = world('square'); w.set('netFieldMinTiles = 2;'); reset(w, X, Y);
        if (layer) S.addLayer(w.ctx, Object.assign({ shape: 'square', order: 3, size: X, connections: [[1, 9], [3, 7], [2, 8]] }, layer));
        const reg = w.frame(); w.set(`baseNetTransform = ${J(SPEC6)};`); const net = w.frame(); nl++;
        const step = Math.max(1, Math.floor(net.length / 120)); let worst = 0;
        for (let i = 0; i < net.length; i += step) { const sg = net[i], m = w.get(`(function () { const wp = netWarpBaseNow(); return invertNetWarp(wp, { x: ${(sg.x1 + sg.x2) / 2}, y: ${(sg.y1 + sg.y2) / 2} }); })()`); let best = 1e9;
            for (const r of reg) { const dx = r.x2 - r.x1, dy = r.y2 - r.y1, L = dx * dx + dy * dy, u = L ? Math.max(0, Math.min(1, ((m.x - r.x1) * dx + (m.y - r.y1) * dy) / L)) : 0; best = Math.min(best, Math.hypot(m.x - (r.x1 + u * dx), m.y - (r.y1 + u * dy))); } worst = Math.max(worst, best); }
        if (worst > 1e-6) note('layerPreimage', [X, Y, layer && Object.keys(layer).join('+'), worst]);
    }
    // (b) the spatial morph (two keyframe layers, lines and faces): status netActive, the same counts per tile at every size, nothing outside the canvas
    const STUB = fs.readFileSync(path.join(ROOT, 'tools', 'morph', 'test-spatial-morph-faces.js'), 'utf8').match(/const STUB = `([\s\S]*?)`;/);
    let nm = 0; const per = new Set();
    for (const [X, Y] of FAST ? [[3, 3], [4, 4]] : [[3, 3], [5, 5], [4, 4], [3, 4], [6, 5]]) for (const faces of [false, true]) {
        const w = H.makeRenderWorld('square', 3, 3, 'rotation_reflection3', FILES); w.set(HOOK); if (STUB) w.set(STUB[1]); reset(w, X, Y); w.set(`symmetryMode = 'rotation_reflection3';`);
        const K0 = [[1, 5], [2, 8], [3, 7]], K1 = [[2, 6], [4, 8], [1, 9]]; w.baseConnections(K0); const ids = [K0, K1].map(k => w.addKeyframeLayer(k)); ids.forEach(i => w.set(`additionalLayers[${i}].showFaces = ${faces};`)); w.setTimeline(ids);
        w.set(`baseNetTransform = ${J(SPEC6)};`); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); nm++;
        const segs = w.frame(), W_ = w.get('canvasW'), H_ = w.get('canvasH'), polys = STUB ? w.get('__polys') : [];
        if (w.status().code !== 'netActive') note('morphStatus', [X, Y, faces, w.status().code]);
        if (segs.filter(sg => [sg.x1, sg.x2].some(v => v < -1e-6 || v > W_ + 1e-6) || [sg.y1, sg.y2].some(v => v < -1e-6 || v > H_ + 1e-6)).length) note('morphOutside', [X, Y, faces]);
        per.add('seg' + (segs.length / (X * Y)).toFixed(3)); if (faces) per.add('poly' + (polys.length / (X * Y)).toFixed(2));
    }
    if (per.size !== 2) note('morphPerTile', [...per]);   // 24 segments and 40 polygons per tile at every size, even or odd
    check(`(6) layers (${nl} cases: offset, rotation, mode; even and odd sizes: drawn pieces map back onto the regular segments, worst < 1e-6 px) and the spatial morph (${nm} scenes: status netActive, X*Y tiles with 24 segments and 40 faces each, nothing outside the canvas) under an even Field`, !bad.first && per.size === 2, J(bad) + J([...per]));
}

// ---- 7. sabotage runs: the test runs itself against mutated copies of core/netwarp.js -------------------------------------------------------------------------------
if (!CHILD && !process.env.EVEN_NOSAB) {
    const src = fs.readFileSync(path.join(ROOT, 'core', 'netwarp.js'), 'utf8'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'even105sab-'));
    const SAB = [
        ['T left out (applyNetWarp)', "if (T) { x += T.x; y += T.y; }", ''],
        ['T on the wrong axis (shift vector swaps tx / ty)', 'shiftVec: { x: evenKeys.tx * v1.x + evenKeys.ty * v2.x, y: evenKeys.tx * v1.y + evenKeys.ty * v2.y }', 'shiftVec: { x: evenKeys.ty * v1.x + evenKeys.tx * v2.x, y: evenKeys.ty * v1.y + evenKeys.tx * v2.y }'],
        ['lo / hi swapped (n / 2 - 1 tiles left, n / 2 right)', 'const hx = Math.floor(R.x / 2), hy = Math.floor(R.y / 2), evX', 'const hx = Math.floor((R.x - 1) / 2), hy = Math.floor((R.y - 1) / 2), evX'],
        ['floor 2 by default (n = 2 reachable)', 'let netFieldMinTiles = 3;', 'let netFieldMinTiles = 2;'],
        ['an unknown or missing shape is read as the square (not conservative)', "const sq = shape === 'square', evenOk = (sq || shape === 'triangle' || shape === 'hex') && n % 2 === 0;", "const sq = shape !== 'triangle' && shape !== 'hex', evenOk = (sq || shape === 'triangle' || shape === 'hex') && n % 2 === 0;"],
        ['an odd axis gets T', 'tx: evX ? 0.5 : 0, ty: evY ? 0.5 : 0', 'tx: 0.5, ty: 0.5'],
        ['inversion without the T subtraction', 'if (warp.field) pt = _netBackShift(warp, pt);   // task 105: pt is an image-space point', 'if (false) pt = _netBackShift(warp, pt);   // task 105: pt is an image-space point'],
        ['split with T instead of regular points', 'const a = netWarpTileCoords(warp, p1), b = netWarpTileCoords(warp, p2)', 'const a = netWarpTileCoords(warp, _netBackShift(warp, p1)), b = netWarpTileCoords(warp, _netBackShift(warp, p2))'],
        ['inside test without the T subtraction', 'netWarpTileCoords(warp, warp.field ? _netBackShift(warp, pt) : pt);   // pt is an image-space point (a click)', 'netWarpTileCoords(warp, pt);   // pt is an image-space point (a click)'],
        ['field-local click without the T subtraction', 'c = netWarpTileCoords(warp, _netBackShift(warp, pt));   // pt: an image-space click', 'c = netWarpTileCoords(warp, pt);   // pt: an image-space click'],
        ['overlay without the shift (tx = 0)', 'tx = fR.x % 2 === 0 ? 0.5 : 0, ty = fR.y % 2 === 0 ? 0.5 : 0, fxF', 'tx = 0, ty = 0, fxF'],
        ['even field with n + 1 tiles (E2)', 'const R = isField ? _netRt(Rt) : null;', 'const R = isField ? (r => ({ x: r.x % 2 === 0 ? r.x + 1 : r.x, y: r.y % 2 === 0 ? r.y + 1 : r.y }))(_netRt(Rt)) : null;'],
    ];
    let red = 0; const notRed = [];
    SAB.forEach(([name, from, to], i) => {
        if (src.split(from).length !== 2) { notRed.push([name, 'pattern not found once']); return; }
        const f = path.join(dir, `sab${i}.js`); fs.writeFileSync(f, src.replace(from, () => to));
        const r = spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { NETWARP_JS: f, EVEN_FAST: '1' }), encoding: 'utf8', maxBuffer: 1 << 26 });
        if (r.status !== 0) red++; else notRed.push([name, 'still green']);
    });
    check(`(7) ${SAB.length} sabotage runs on mutated copies of core/netwarp.js: every one fails the test`, red === SAB.length && notRed.length === 0, J(notRed));
}
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
