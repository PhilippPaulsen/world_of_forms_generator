// Task 109 (H1): the Field net of the HEXAGON at EVERY size 3..9 (even too), WITHOUT a shift (the fine rhombus Field is a covering parallelogram of odd Rx x Ry meshes found by a search that reads neither X nor Y).
//   node tools/grid/test-net-field-hex-even.js      sabotage runs (section 8): the test mutates core/netwarp.js into temp copies and runs ITSELF with NETWARP_JS = the copy: every run must fail
//   1. all 49 pairs 3..9 x 3..9 x 4 laws: a Field, Rx and Ry ODD <= 27 (never a pair without a Field, never above the ceiling), canvas covered 100 %, boundaries increasing, F(F^-1) < 1e-8, split < 1e-9, dots 0 px, hexagon corners on fine-lattice nodes 100 %, faces allowed, no shift key
//   2. Aus <-> Field: a regular Field moves nothing (0 px), w = 1e-3 < 1 px; export: fieldTiles, fieldMeshes, NO fieldBase, NO gridShiftPx, facesOmitted false
//   3. netDomainEffective: hexagon 3..9 any parity (1, 2, 10 refused), triangle and square unchanged, no or an unknown shape odd only
//   4. Timeline table: hexagon Regular <-> Field ok at even and odd sizes (the guard is the square's only)
//   5. layers under the hexagon Field stay locked ("Base sheet only", netWarpBlocksFaces(sheet)) at even sizes as at odd ones; the base sheet is not locked
//   6. faces at even sizes x 4 laws x 2 symmetry configs: the fills in the canvas equal those without the tile skip, cover the canvas (0 px2 gap), the skip does skip, polygons simple; exactness of the refinement (ordnung 2): the image of every regular edge lies on the refined polygon (< 1e-9)
//   7. byte-equal to main 609f4fb8: the triangle and the square with a Field at ALL sizes 1..9, the hexagon at odd sizes with a Field and at every size without one
const fs = require('fs'), path = require('path'), os = require('os'), { execSync, spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; };';
const STUB = 'var __polys = [], __cur = null; push = function () { }; pop = function () { }; noStroke = function () { }; stroke = function () { }; noFill = function () { }; fill = function () { }; strokeWeight = function () { }; CLOSE = "close"; beginShape = function () { __cur = []; }; vertex = function (x, y) { __cur.push([x, y]); }; endShape = function () { __polys.push(__cur); };';
const FILES = {}; if (process.env.NETWARP_JS) FILES['core/netwarp.js'] = process.env.NETWARP_JS; 
const CHILD = !!process.env.NETWARP_JS, MAIN = '609f4fb8';
const world = (shape, sym, files, ord) => { const w = H.makeRenderWorld(shape, ord || 3, 3, sym || 'none', files === undefined ? FILES : files); w.set(HOOK); w.set(STUB); return w; };
const setup = (w, shape, X, Y, spec, sym, n, ord, pick) => w.set(`currentShape = ${J(shape)}; projectGridSpec({ shape: ${J(shape)}, ordnung: ${ord || 3}, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y});
    symmetryMode = ${J(sym)}; baseNetTransform = ${J(spec)}; baseNetAnimation = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; showFaces = false; rebuildGrid(currentShape);
    connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())${pick ? `.filter((c, i) => i % ${pick} === 1)` : `.slice(0, ${n})`};`);
const fieldSpec = (law) => ({ x: law, y: law.kind === 'trig' ? { kind: 'trig', w: -law.w * 0.7 } : law, repeat: false, domain: 'field' });
const LAWS = { sinus: { kind: 'trig', w: -0.8 }, tangens: { kind: 'trig', w: 0.6 }, geometric: { kind: 'geometric', w: Math.log(4) }, regular: { kind: 'uniform', w: 0 } };
const draw = (w, skip) => { w.set(`__polys.length = 0; var __keep = netWarpTileOutsideCanvas; ${skip ? '' : 'netWarpTileOutsideCanvas = function () { return false; };'} drawTessellation(); netWarpTileOutsideCanvas = __keep;`); return w.get('__polys.slice()'); };
const area = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const clip = (P, W, H_) => { let o = P; const cut = (inside, inter) => { const inp = o; o = []; for (let i = 0; i < inp.length; i++) { const a = inp[i], b = inp[(i + 1) % inp.length], ia = inside(a), ib = inside(b); if (ia) { o.push(a); if (!ib) o.push(inter(a, b)); } else if (ib) o.push(inter(a, b)); } };
    cut(p => p[0] >= 0, (a, b) => { const t = (0 - a[0]) / (b[0] - a[0]); return [0, a[1] + t * (b[1] - a[1])]; }); cut(p => p[0] <= W, (a, b) => { const t = (W - a[0]) / (b[0] - a[0]); return [W, a[1] + t * (b[1] - a[1])]; });
    cut(p => p[1] >= 0, (a, b) => { const t = (0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), 0]; }); cut(p => p[1] <= H_, (a, b) => { const t = (H_ - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), H_]; }); return o; };
const inCanvasArea = (polys, W, H_) => polys.reduce((s, P) => { let x0 = 1e18, x1 = -1e18, y0 = 1e18, y1 = -1e18; for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } if (x1 < 0 || x0 > W || y1 < 0 || y0 > H_) return s; return s + Math.abs(area(clip(P, W, H_))); }, 0);
const segX = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < -1e-9 && o(c, d, a) * o(c, d, b) < -1e-9; };
const simple = P => { const n = P.length; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return false; } return true; };


const SPECS = {
    sinus: { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.56 }, repeat: false, domain: 'field' },
    tangens: { x: { kind: 'trig', w: 0.6 }, y: 'same', repeat: false, domain: 'field' },
    mixed: { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.6 }, repeat: false, domain: 'field' },
    geometric: { x: { kind: 'geometric', w: Math.log(4) }, y: { kind: 'trig', w: -0.5, focus: 0.3 }, repeat: false, domain: 'field' },
    regular: { x: { kind: 'uniform', w: 0 }, y: 'same', keep: true, repeat: false, domain: 'field' },
};
const PAIRS = []; for (let X = 3; X <= 9; X++) for (let Y = 3; Y <= 9; Y++) if (Math.max(X, Y) <= 3 * Math.min(X, Y)) PAIRS.push([X, Y]);
const EVENPAIRS = PAIRS.filter(([X, Y]) => X % 2 === 0 || Y % 2 === 0);

// ---- 1. all pairs ---------------------------------------------------------------------------------------------------------------------------------
{
    const w = world('hex', 'rotation_reflection6'); let n = 0, maxR = 0; const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    for (const [X, Y] of CHILD ? PAIRS.filter((p, i) => i % 3 === 0 || p[0] + p[1] === 18) : PAIRS) for (const ln of CHILD ? ['sinus', 'geometric'] : ['sinus', 'tangens', 'geometric', 'mixed']) {
        setup(w, 'hex', X, Y, SPECS[ln], 'rotation_reflection6', 6); n++;
        const r = w.get(`(function () {
            const wp = netWarpBaseNow(); if (!wp) return { none: true }; const f = wp.field, R = {};
            R.domain = wp.domain; R.Rx = f.Rx; R.Ry = f.Ry; R.noShift = wp.shiftVec === undefined && f.hix === undefined && f.hiy === undefined && f.tx === undefined && f.ty === undefined;
            let cov = true; for (let ix = 0; ix < 50; ix++) for (let iy = 0; iy < 50; iy++) if (!netWarpInsideNet(wp, { x: (ix + 0.5) / 50 * canvasW, y: (iy + 0.5) / 50 * canvasH })) cov = false; R.cov = cov;
            const mono = P => P.every((v, i) => i === 0 || v > P[i - 1]); R.mono = (!wp.fx || mono(wp.fx.field.P)) && (!wp.fy || mono(wp.fy.field.P));
            let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let inv = 0;
            for (let i = 0; i < 150; i++) { const p = { x: rnd() * canvasW, y: rnd() * canvasH }, q = applyNetWarp(wp, invertNetWarp(wp, p)); inv = Math.max(inv, Math.hypot(q.x - p.x, q.y - p.y)); } R.inv = inv;
            let split = 0, sc = 0;
            for (let i = 0; i < 120; i++) { const p1 = { x: rnd() * canvasW, y: rnd() * canvasH }, p2 = { x: rnd() * canvasW, y: rnd() * canvasH }, pts = netWarpSplitSegment(wp, p1, p2); if (!pts) continue; sc++; const m = pts.map(p => applyNetWarp(wp, p));
                for (let k = 1; k < 20; k++) { const t = k / 20, q = applyNetWarp(wp, { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }); let best = 1e9;
                    for (let j = 0; j + 1 < m.length; j++) { const a = m[j], b = m[j + 1], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, u = L ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L)) : 0; best = Math.min(best, Math.hypot(q.x - (a.x + u * dx), q.y - (a.y + u * dy))); } split = Math.max(split, best); } }
            R.split = split; R.splitN = sc;
            const nwDraw = netWarpForBase(netTransformNow(), currentShape, outerCorners, nodeCount, shapeSizeFactor); let dot = 0, hit = 0; for (const nd of nodes) { const a = applyNetWarp(nwDraw, nd), b = applyNetWarp(wp, nd), h = invertNetWarp(wp, a); dot = Math.max(dot, Math.hypot(a.x - b.x, a.y - b.y)); hit = Math.max(hit, Math.hypot(h.x - nd.x, h.y - nd.y)); } R.dot = dot; R.hit = hit;
            const mw = { v1: { x: outerCorners[2].x - outerCorners[0].x, y: outerCorners[2].y - outerCorners[0].y }, v2: { x: outerCorners[4].x - outerCorners[0].x, y: outerCorners[4].y - outerCorners[0].y } }; let nc = 0, on = 0;
            for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) { const sh = { x: i * mw.v1.x + j * mw.v2.x, y: i * mw.v1.y + j * mw.v2.y }, ce = { x: centroid.x + sh.x, y: centroid.y + sh.y }; if (ce.x < 0 || ce.x > canvasW || ce.y < 0 || ce.y > canvasH) continue;
                for (const p of outerCorners) { const c = netWarpTileCoords(wp, { x: p.x + sh.x, y: p.y + sh.y }); nc++; if (Math.abs(c.s - Math.round(c.s)) < 1e-6 && Math.abs(c.t - Math.round(c.t)) < 1e-6) on++; } }
            R.nodePct = 100 * on / nc;
            R.blocks = netWarpBlocksFaces(); showFaces = true; R.faces = computeCellFaces(connections, nodes, null).faces.length; showFaces = false;
            return R;
        })()`);
        if (r.none || r.domain !== 'field') { note('none', [X, Y, ln]); continue; }
        maxR = Math.max(maxR, r.Rx, r.Ry);
        if (!(r.Rx % 2 === 1 && r.Ry % 2 === 1 && r.Rx >= 3 && r.Ry >= 3 && r.Rx <= 27 && r.Ry <= 27)) note('oddOrCeiling', [X, Y, r.Rx, r.Ry]); if (!r.cov) note('cover', [X, Y, ln]); if (!r.mono) note('mono', [X, Y, ln]);
        if (r.inv > 1e-8) note('inv', [X, Y, ln, r.inv]); if (r.split > 1e-9 || r.splitN < 10) note('split', [X, Y, ln, r.split, r.splitN]); if (r.dot > 1e-9 || r.hit > 1e-8) note('dot', [X, Y, ln, r.dot, r.hit]);
        if (r.nodePct < 100 - 1e-9) note('corners', [X, Y, r.nodePct]); if (r.blocks || r.faces < 1) note('faces', [X, Y, r.blocks, r.faces]); if (!r.noShift) note('shiftKey', [X, Y]);
    }
    check(`(1) 49 pairs x 4 laws (${n} cases): a Field at every pair (33 of them with an even axis), Rx and Ry odd <= 27 (largest ${maxR}), canvas covered 100 %, boundaries increasing, F(F^-1) < 1e-8, split < 1e-9, dots 0 px, corners on fine nodes 100 %, faces allowed, no shift key`, !bad.first && (CHILD || n === 49 * 4) && maxR <= 27, J(bad));
}

// ---- 2. Aus <-> Field and the export ----------------------------------------------------------------------------------------------------------------
{
    const w = world('hex', 'rotation_reflection6'); const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let jump = 0, cont = 0;
    const move = `(function () { const wp = netWarpBaseNow(); if (!wp || wp.domain !== "field") return -1; let m = 0; for (let ix = 0; ix <= 12; ix++) for (let iy = 0; iy <= 12; iy++) { const p = { x: ix / 12 * canvasW, y: iy / 12 * canvasH }, q = applyNetWarp(wp, p); m = Math.max(m, Math.hypot(q.x - p.x, q.y - p.y)); } return m; })()`;
    for (const [X, Y] of [[4, 4], [3, 4], [4, 3], [6, 5], [8, 8], [6, 6], [3, 3], [5, 5], [9, 9]]) {
        setup(w, 'hex', X, Y, SPECS.regular, 'rotation_reflection6', 4); const j = w.get(move); if (j < 0) note('regularNoWarp', [X, Y]); else jump = Math.max(jump, j);
        setup(w, 'hex', X, Y, Object.assign({}, SPECS.sinus, { x: { kind: 'trig', w: -1e-3 }, y: 'same' }), 'rotation_reflection6', 4); cont = Math.max(cont, w.get(move));
        setup(w, 'hex', X, Y, SPECS.sinus, 'rotation_reflection6', 4);
        const ex = w.get(`(function () { const wp = netWarpBaseNow(), e = netTransformExportData(baseNetTransform, baseGridDivisions(), _netSize(), wp.meshes, currentShape); return { keys: Object.keys(e), tiles: e.fieldTiles, meshes: e.fieldMeshes, bx: e.tileBoundaries.x.length, by: e.tileBoundaries.y.length, m: wp.meshes, omitted: e.facesOmitted, mapping: e.facesMapping }; })()`);
        if (ex.keys.includes('fieldBase') || ex.keys.includes('gridShiftPx')) note('exportKeys', [X, Y, ex.keys]);
        if (J(ex.tiles) !== J(X === Y ? X : { x: X, y: Y }) || ex.meshes.x !== ex.m.x || ex.meshes.y !== ex.m.y || ex.bx !== ex.m.x + 1 || ex.by !== ex.m.y + 1) note('exportMeshes', [X, Y, ex.tiles, ex.meshes]);
        if (ex.omitted !== false || !/split/.test(ex.mapping || '')) note('exportFaces', [X, Y, ex.omitted]);
    }
    if (jump > 1e-9) note('jump', jump); if (cont >= 1) note('continuity', cont);
    check(`(2) Aus <-> Field at even and odd sizes: a regular Field moves nothing (max ${jump.toExponential(1)} px), w = 1e-3 moves ${cont.toFixed(3)} px (< 1); export: fieldTiles = size, fieldMeshes = Rx x Ry, Rx + 1 / Ry + 1 boundaries, no fieldBase, no gridShiftPx, faces written (facesOmitted false, mapping says split)`, !bad.first, J(bad));
}

// ---- 3. netDomainEffective ----------------------------------------------------------------------------------------------------------------------------
{
    const w = world('square'); const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const ok = (shape, X, Y) => w.get(`netDomainEffective({ domain: 'field' }, { x: ${X}, y: ${Y} }${shape === undefined ? '' : ', ' + J(shape)}).ignored === null`);
    for (let n = 1; n <= 10; n++) {
        for (const s of ['hex', 'triangle', 'square']) if (ok(s, n, n) !== (n >= 3 && n <= 9)) note(s, n);
        for (const s of [undefined, null, '', 'circle', 'Hex']) if (ok(s, n, n) !== (n >= 3 && n <= 9 && n % 2 === 1)) note('unknown', [String(s), n]);
    }
    for (const [X, Y] of [[4, 3], [3, 4], [6, 5], [4, 9]]) if (!ok('hex', X, Y)) note('mixed', [X, Y]);
    for (const [X, Y] of [[2, 4], [4, 2], [1, 3], [10, 4]]) if (ok('hex', X, Y)) note('refused', [X, Y]);
    check('(3) netDomainEffective: the hexagon takes 3..9 at any parity (1, 2, 10 refused, mixed axes too), triangle and square as before, no or an unknown shape odd only', !bad.first, J(bad));
}

// ---- 4. the Timeline table ----------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const FIELD = SPECS.mixed, FIELD2 = SPECS.tangens, REG = { regular: true }, TILED = { x: { kind: 'trig', w: -0.8 }, y: 'same', repeat: true, domain: 'tiled' }; let rows = 0;
    for (const shape of ['hex', 'square']) {
        const w = world(shape);
        for (const [X, Y] of [[4, 4], [3, 4], [6, 5], [8, 8], [3, 3], [5, 5], [9, 7]]) {
            setup(w, shape, X, Y, null, 'rotation_reflection6', 4); const cp = (a, b) => w.get(`netAnimationCompat(${J(a)}, ${J(b)}).ok`);
            const blocked = shape === 'square' && (X % 2 === 0 || Y % 2 === 0);
            if (cp(REG, FIELD) !== !blocked || cp(FIELD, REG) !== !blocked) note('regField', [shape, X, Y]);
            if (cp(FIELD, FIELD2) !== true) note('fieldField', [shape, X, Y]); if (cp(FIELD, TILED) !== false) note('domain', [shape, X, Y]); rows += 3;
        }
    }
    check(`(4) netAnimationCompat (${rows} rows, hexagon and square, even and odd sizes): hexagon Regular <-> Field ok at every size, the square refuses only at an even size, Field <-> Field ok, Field <-> Tiled refused`, !bad.first, J(bad));
}

// ---- 5. layers off the base grid stay locked (task 113: layers on the base grid are free) ----------------------------------------------------------------------------------------------------------------------------
{
    const w = world('hex', 'rotation_reflection6'); const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0;
    for (const [X, Y] of [[4, 4], [3, 4], [4, 3], [6, 5], [8, 8], [6, 6], [3, 3], [5, 5], [9, 9]]) {
        setup(w, 'hex', X, Y, SPECS.sinus, 'rotation_reflection6', 8); n++;
        const r = w.get(`(function () { showFaces = true; const base = computeCellFaces(connections, nodes, null, null, null).faces.length, lay2 = computeCellFaces(connections, nodes, null, null, { gridMatchesBase: false }).faces.length;   // task 113: a sheet on the base grid is not refused (its faces need a real layer sheet: test-net-field-hex-layer-faces.js)
            return { base, lay2, morph: netWarpBlocksFaces({ gridMatchesBase: true, morphRefine: true }), bBase: netWarpBlocksFaces(), bLay: netWarpBlocksFaces({ gridMatchesBase: true }), bLay2: netWarpBlocksFaces({ gridMatchesBase: false }) }; })()`);
        if (r.base < 1 || r.bBase) note('base', [X, Y, r.base]); if (r.lay2 !== 0 || r.bLay || !r.bLay2) note('layerLock', [X, Y, r.lay2, r.bLay, r.bLay2]); if (r.morph !== false) note('morphRefine', [X, Y, r.morph]);
    }
    check(`(5) layers under the hexagon Field (${n} sizes, even and odd): a sheet off the base grid gets 0 faces and netWarpBlocksFaces says so, a sheet on the base grid is not refused (task 113), the base sheet gets its faces, the morph path is not locked`, !bad.first, J(bad));
}

// ---- 6. faces at even sizes ---------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}, note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0, skipped = 0;
    const pairs = CHILD ? [[4, 4], [6, 5]] : [[4, 4], [3, 4], [4, 3], [6, 5], [6, 6], [8, 8], [4, 6]], LAWS6 = CHILD ? ['sinus', 'geometric'] : ['sinus', 'tangens', 'geometric', 'mixed'];   // a sabotage child runs a smaller set
    for (const [sym, nc] of CHILD ? [['rotation6', 20]] : [['rotation6', 20], ['rotation_reflection6', 10]]) {
        const w = world('hex', sym);
        for (const [X, Y] of pairs) for (const ln of LAWS6) {
            setup(w, 'hex', X, Y, SPECS[ln], sym, nc); w.set('showFaces = true;'); n++;
            const W = w.get('canvasW'), H_ = w.get('canvasH'), a = draw(w, true), b = draw(w, false), A = inCanvasArea(a, W, H_), B = inCanvasArea(b, W, H_);
            if (a.length === 0) note('empty', [sym, X, Y, ln]);
            if (Math.abs(A - B) > 1e-9 * W * H_) note('lost', [sym, X, Y, ln, A, B]);
            if (Math.abs(A - W * H_) > 1e-6 * W * H_) note('cover', [sym, X, Y, ln, A, W * H_]);
            if (a.length >= b.length) note('noSkip', [sym, X, Y, ln, a.length, b.length]); else skipped += b.length - a.length;
            if (ln === 'sinus' && X + Y <= 10) { const sg = a.filter(P => P.length >= 3).map(P => Math.sign(area(P))), nz = sg.filter(s => s !== 0); if (new Set(nz).size > 1) note('orientation', [sym, X, Y]); if (!a.filter(P => clip(P, W, H_).length >= 3).slice(0, 300).every(simple)) note('simple', [sym, X, Y]); }
        }
    }
    check(`(6a) hexagon Field at even sizes (${n} cases): the fills in the canvas equal those without the tile skip (0 px2), cover the canvas (no gap), the skip skips (${skipped} polygons saved), one orientation, simple polygons`, !bad.first && n === (CHILD ? 4 : 56), J(bad));
    const w = world('hex', 'rotation3', undefined, 2); let maxD = 0, added = 0, colorsOk = true, facesN = 0;
    for (const [X, Y] of [[4, 4], [4, 3], [6, 5], [8, 8]]) {
        setup(w, 'hex', X, Y, SPECS.sinus, 'rotation3', 0, 2, 3);
        const r = w.get(`(function () {
            const wp = netWarpBaseNow(), saved = activeNetWarp; activeNetWarp = null; const plain = computeCellFaces(connections, nodes, new Map()); activeNetWarp = wp; const ref = computeCellFaces(connections, nodes, new Map()); activeNetWarp = saved;
            const pl = new Map(plain.nodes.map(n => [n.id, n])), rf = new Map(ref.nodes.map(n => [n.id, n])); let maxD = 0, add = 0, colors = true;
            plain.faces.forEach((f, i) => { const g = ref.faces[i]; add += g.nodeIds.length - f.nodeIds.length; if (f.color !== g.color) colors = false;
                const mp = g.nodeIds.map(id => applyNetWarp(wp, rf.get(id)));
                for (let k = 0; k < f.nodeIds.length; k++) { const a = pl.get(f.nodeIds[k]), b = pl.get(f.nodeIds[(k + 1) % f.nodeIds.length]);
                    for (let j = 0; j <= 12; j++) { const t = j / 12, q = applyNetWarp(wp, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }); let best = 1e9;
                        for (let m = 0; m < mp.length; m++) { const u = mp[m], v = mp[(m + 1) % mp.length], dx = v.x - u.x, dy = v.y - u.y, L = dx * dx + dy * dy, s = L ? Math.max(0, Math.min(1, ((q.x - u.x) * dx + (q.y - u.y) * dy) / L)) : 0; best = Math.min(best, Math.hypot(q.x - (u.x + s * dx), q.y - (u.y + s * dy))); }
                        maxD = Math.max(maxD, best); } } });
            return { maxD, add, colors, faces: plain.faces.length };
        })()`);
        maxD = Math.max(maxD, r.maxD); added += r.add; colorsOk = colorsOk && r.colors; facesN += r.faces;
    }
    check(`(6b) exactness at even sizes (ordnung 2, rotation-only pattern): the image of every regular face edge lies on the refined polygon (max ${maxD.toExponential(2)} px < 1e-9), the refinement added ${added} vertices, colours as in Aus (${facesN} faces)`, maxD < 1e-9 && added > 0 && colorsOk, J({ maxD, added, colorsOk }));
}

// ---- 7. byte-equal to main ----------------------------------------------------------------------------------------------------------------------------
if (!CHILD) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hex109-')), mainFile = path.join(dir, 'netwarp.js');
    fs.writeFileSync(mainFile, execSync(`git show ${MAIN}:core/netwarp.js`, { cwd: ROOT, maxBuffer: 1 << 26 }));
    const MAINFILES = { 'core/netwarp.js': mainFile }, worlds = {};
    const wOf = (kind, shape) => worlds[kind + shape] || (worlds[kind + shape] = world(shape, 'rotation_reflection6', kind === 'main' ? MAINFILES : undefined));
    const snap = (w, shape, X, Y, spec) => {
        setup(w, shape, X, Y, spec, 'rotation_reflection6', 6);
        return J(w.get(`(function () {
            const warp = netWarpBaseNow(), out = { warp: warp ? JSON.parse(JSON.stringify(warp)) : null, domain: netDomainEffective(baseNetTransform, netSizeFactors()), blocks: netWarpBlocksFaces(), exp: buildExportData(null).meta.netTransform || null };
            out.domainShape = netDomainEffective(baseNetTransform, netSizeFactors(), currentShape);
            out.exp2 = baseNetTransform ? netTransformExportData(baseNetTransform, baseGridDivisions(), _netSize(), warp && warp.meshes, currentShape) : null;
            out.lines = netGridLines(netTransformNow(), outerCorners, baseGridDivisions(), { x0: 0, y0: 0, x1: width, y1: height }, warp && warp.field ? (warp.meshes ? { closed: true, domain: 'field', fieldTiles: { x: warp.field.Rx, y: warp.field.Ry }, frame: warp.frame, diagonal: true } : { closed: true, domain: 'field', fieldTiles: warp.field.Rx !== undefined ? { x: warp.field.Rx, y: warp.field.Ry } : warp.field.Rt }) : { closed: !!warp && !warp.repeat });
            if (warp) { let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const pts = []; for (let i = 0; i < 60; i++) { const p = { x: rnd() * canvasW, y: rnd() * canvasH }, q = { x: rnd() * canvasW, y: rnd() * canvasH };
                pts.push([applyNetWarp(warp, p), invertNetWarp(warp, p), netWarpInsideNet(warp, p), warp.field ? netWarpFieldLocal(warp, p) : null, netWarpSplitSegment(warp, p, q)]); } out.pts = pts; }
            return out;
        })()`)) + J(w.frame());
    };
    const NOFIELD = { single: Object.assign({}, SPECS.mixed, { domain: 'single' }), tiled: Object.assign({}, SPECS.mixed, { domain: 'tiled', repeat: true }) };
    const cases = [];
    for (const shape of ['triangle', 'square']) for (let X = 1; X <= 9; X++) for (let Y = 1; Y <= 9; Y++) if (Math.max(X, Y) <= 3 * Math.min(X, Y) && !(shape === 'triangle' && ((X % 2 === 0 && X >= 4) || (Y % 2 === 0 && Y >= 4)))) for (const nm of ['mixed']) cases.push([shape, X, Y, SPECS[nm], shape + '-field']);
    // the triangle at an even size is the task-108 Field and the same in both trees: it is NOT excluded here because 108 is in main; only the ignored-reason of an even axis >= 4 with the other axis < 3 may differ
    for (const [X, Y] of PAIRS) if (X % 2 === 1 && Y % 2 === 1) for (const nm of ['mixed', 'geometric', 'sinus']) cases.push(['hex', X, Y, SPECS[nm], 'hex-odd']);
    for (let X = 1; X <= 9; X++) for (const Y of [1, 2, 3, 4, 5, 8]) if (Math.max(X, Y) <= 3 * Math.min(X, Y)) for (const [nm, sp] of [['none', null], ['single', NOFIELD.single], ['tiled', NOFIELD.tiled]]) cases.push(['hex', X, Y, sp, 'hex-nofield-' + nm]);
    for (const [X, Y] of [[1, 1], [2, 2], [1, 2], [2, 3], [3, 2]]) cases.push(['hex', X, Y, SPECS.mixed, 'hex-small']);
    let n = 0; const diffs = [];
    for (const [shape, X, Y, spec, kind] of cases) { const a = snap(wOf('main', shape), shape, X, Y, spec), b = snap(wOf('new', shape), shape, X, Y, spec); n++; if (a !== b) diffs.push([shape, X, Y, kind]); }
    let changed = 0, total = 0; for (const [X, Y] of EVENPAIRS) { total++; if (snap(wOf('main', 'hex'), 'hex', X, Y, SPECS.mixed) !== snap(wOf('new', 'hex'), 'hex', X, Y, SPECS.mixed)) changed++; }
    check(`(7) byte-equal to main ${MAIN}: the triangle and the square with a Field at all sizes, the hexagon at odd sizes with a Field and at every size without one, and below size 3 (${n} cases); the hexagon at an even size with a Field is a new picture (${changed} of ${total} differ)`, diffs.length === 0 && n > 250 && changed === total, J(diffs.slice(0, 6)) + ` n=${n} changed=${changed}/${total}`);
}

// ---- 8. sabotage runs ---------------------------------------------------------------------------------------------------------------------------------
if (!CHILD) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hex109s-')), src = fs.readFileSync(path.join(ROOT, 'core', 'netwarp.js'), 'utf8');
    const GATE = "(sq || shape === 'triangle' || shape === 'hex') && n % 2 === 0";
    const SAB = [
        ['the hexagon gate is gone (even sizes refused again)', GATE, "(sq || shape === 'triangle') && n % 2 === 0"],
        ['the triangle is refused again (a gate for the hexagon only)', GATE, "(sq || shape === 'hex') && n % 2 === 0"],
        ['an unknown shape is read as the hexagon', GATE, "(sq || shape !== 'circle_never') && n % 2 === 0"],
        ['size 2 opens the hexagon Field', "else if (n < (sq ? netFieldMinTiles : 3))", "else if (n < (sq || shape === 'hex' ? 2 : 3))"],
        ['the square shift (shiftVec) in the hexagon code', "refineFaces: true, frame: { c0: cen, v1: f1, v2: f2, det }", "refineFaces: true, shiftVec: { x: 0.5 * f1.x, y: 0.5 * f1.y }, frame: { c0: cen, v1: f1, v2: f2, det }"],
        ['the export writes fieldBase / gridShiftPx for the hexagon', "if (shape === 'square' && (R.x % 2 === 0 || R.y % 2 === 0))", "if ((R.x % 2 === 0 || R.y % 2 === 0))"],
        ['a layer off the base grid is freed (the grid rule is gone)', "(!!sheet && !sheet.gridMatchesBase)", 'false'],
        ['the face refinement is switched off', "if (!warp || warp.refineFaces !== true || !warp.frame || !result", "if (true || !warp || warp.refineFaces !== true || !warp.frame || !result"],
        ['the tile skip is removed (never skips)', "    return x1 < -m || x0 > W + m || y1 < -m || y0 > H + m;", "    return false;"],
        ['the tile skip skips too much (always skips)', "    return x1 < -m || x0 > W + m || y1 < -m || y0 > H + m;", "    return true;"],
        ['the Timeline guard applies to every shape', "currentShape === 'square' && typeof netSizeFactors === 'function'", "typeof netSizeFactors === 'function'"],
        ['the search ceiling 27 is lowered to 21', "for (let Rx = 3; Rx <= 27; Rx += 2) for (let Ry = 3; Ry <= 27; Ry += 2)", "for (let Rx = 3; Rx <= 21; Rx += 2) for (let Ry = 3; Ry <= 21; Ry += 2)"],
    ];
    let red = 0; const notRed = [];
    SAB.forEach(([name, from, to], i) => {
        if (src.split(from).length !== 2) { notRed.push([name, 'pattern not found once']); return; }
        const f = path.join(dir, 'sab' + i + '.js'); fs.writeFileSync(f, src.replace(from, () => to));
        const r = spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { NETWARP_JS: f }), encoding: 'utf8', maxBuffer: 1 << 26 });
        if (r.status !== 0) red++; else notRed.push([name, 'still green']);
    });
    check(`(8) ${SAB.length} sabotage runs on mutated copies: every one fails the test`, red === SAB.length && notRed.length === 0, J(notRed));
}
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
