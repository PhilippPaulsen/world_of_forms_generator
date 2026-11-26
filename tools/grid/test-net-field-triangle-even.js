// Task 108 (T1): the Field net of the TRIANGLE at EVERY size 3..9 (even too), WITHOUT a shift (the Field is a covering parallelogram of odd Rx x Ry meshes found by a search; the parity of X, Y does not touch the warp).
//   node tools/grid/test-net-field-triangle-even.js      sabotage runs (section 6): the test mutates core/netwarp.js into temp copies and runs ITSELF with NETWARP_JS = the copy: every run must fail
//   1. all 49 pairs 3..9 x 3..9 x 4 laws: a Field, Rx and Ry ODD <= 21, canvas covered 100 %, boundaries strictly increasing, F(F^-1(p)) < 1e-8, split exact (< 1e-9), dots = the points the drawing core reads (0 px), faces allowed, no shift key anywhere
//   2. Aus <-> Field: a regular Field warp moves nothing (0 px) at every size, w = 1e-3 moves < 1 px (no jump of e/2); the export: fieldTiles, fieldMeshes, NO fieldBase, NO gridShiftPx
//   3. the Timeline table (netAnimationCompat): triangle and hexagon at even and odd sizes Regular <-> Field ok, Field <-> Field ok, Field <-> Tiled refused (domain); the square at an even size still refuses Regular <-> Field
//   4. netDomainEffective: triangle 3..9 any parity, 1, 2 and 10 refused; hexagon even refused; the square as in 106; no or an unknown shape = odd only
//   5. byte-equal to main afaed113: triangle ODD sizes with a Field (frames, warps, exports, overlays, apply / invert / inside / local / split), the hexagon at ALL sizes 1..9 with a Field (even too), the square at all sizes 1..9 with a Field, the triangle without a Field (none / Single / Tiled) at every size
const fs = require('fs'), path = require('path'), os = require('os'), { execSync, spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const MODE = 'rotation_reflection6', HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; };';
const CHILD = !!process.env.NETWARP_JS, MAIN = 'afaed113';
const FILES = {}; if (process.env.NETWARP_JS) FILES['core/netwarp.js'] = process.env.NETWARP_JS;
const world = (shape, files) => { const w = H.makeRenderWorld(shape, 3, 3, MODE, files || FILES); w.set(HOOK); return w; };
const setup = (w, shape, X, Y, spec, conns) => w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: 3, lage: 1 })}); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600;
    setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; baseNetTransform = ${J(spec === undefined ? null : spec)}; baseNetAnimation = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base';
    baseFaceAssignments = new Map(); baseFacePalette = null; baseFaceAnchor = null; showFaces = false; rebuildGrid(currentShape);
    connections = ${conns ? J(conns) : 'computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 6)'};`);
const dom = { repeat: false, domain: 'field' };
const SPECS = {
    sinus: Object.assign({ x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.56 } }, dom),
    tangens: Object.assign({ x: { kind: 'trig', w: 0.6 }, y: 'same' }, dom),
    mixed: Object.assign({ x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.6 } }, dom),
    geometric: Object.assign({ x: { kind: 'geometric', w: Math.log(4) }, y: { kind: 'trig', w: -0.5, focus: 0.3 } }, dom),
    regular: Object.assign({ x: { kind: 'uniform', w: 0 }, y: 'same', keep: true }, dom),
};
const PAIRS = []; for (let X = 3; X <= 9; X++) for (let Y = 3; Y <= 9; Y++) if (Math.max(X, Y) <= 3 * Math.min(X, Y)) PAIRS.push([X, Y]);

// ---- 1. all pairs ----------------------------------------------------------------------------------------------------------------------------------------
{
    const w = world('triangle'); let n = 0; const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    for (const [X, Y] of PAIRS) for (const ln of ['sinus', 'tangens', 'geometric', 'mixed']) {
        setup(w, 'triangle', X, Y, SPECS[ln]); n++;
        const r = w.get(`(function () {
            const wp = netWarpBaseNow(); if (!wp) return { none: true }; const f = wp.field, R = {};
            R.domain = wp.domain; R.Rx = f.Rx; R.Ry = f.Ry; R.noShift = wp.shiftVec === undefined && f.hix === undefined && f.hiy === undefined && f.tx === undefined && f.ty === undefined;
            let cov = true; for (let ix = 0; ix < 50; ix++) for (let iy = 0; iy < 50; iy++) if (!netWarpInsideNet(wp, { x: (ix + 0.5) / 50 * canvasW, y: (iy + 0.5) / 50 * canvasH })) cov = false; R.cov = cov;
            const mono = P => P.every((v, i) => i === 0 || v > P[i - 1]); R.mono = (!wp.fx || mono(wp.fx.field.P)) && (!wp.fy || mono(wp.fy.field.P));
            let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let inv = 0;
            for (let i = 0; i < 200; i++) { const p = { x: rnd() * canvasW, y: rnd() * canvasH }, q = applyNetWarp(wp, invertNetWarp(wp, p)); inv = Math.max(inv, Math.hypot(q.x - p.x, q.y - p.y)); } R.inv = inv;
            let split = 0, sc = 0;
            for (let i = 0; i < 150; i++) { const p1 = { x: rnd() * canvasW, y: rnd() * canvasH }, p2 = { x: rnd() * canvasW, y: rnd() * canvasH }, pts = netWarpSplitSegment(wp, p1, p2); if (!pts) continue; sc++; const m = pts.map(p => applyNetWarp(wp, p));
                for (let k = 1; k < 20; k++) { const t = k / 20, q = applyNetWarp(wp, { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }); let best = 1e9;
                    for (let j = 0; j + 1 < m.length; j++) { const a = m[j], b = m[j + 1], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, u = L ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L)) : 0; best = Math.min(best, Math.hypot(q.x - (a.x + u * dx), q.y - (a.y + u * dy))); } split = Math.max(split, best); } }
            R.split = split; R.splitN = sc;
            const nwDraw = netWarpForBase(netTransformNow(), currentShape, outerCorners, nodeCount, shapeSizeFactor); let dot = 0, hit = 0; for (const nd of nodes) { const a = applyNetWarp(nwDraw, nd), b = applyNetWarp(wp, nd), h = invertNetWarp(wp, a); dot = Math.max(dot, Math.hypot(a.x - b.x, a.y - b.y)); hit = Math.max(hit, Math.hypot(h.x - nd.x, h.y - nd.y)); } R.dot = dot; R.hit = hit;
            R.blocks = netWarpBlocksFaces(); showFaces = true; R.faces = computeCellFaces(connections, nodes, null).faces.length; showFaces = false;
            R.expFB = (netTransformExportData(baseNetTransform, baseGridDivisions(), _netSize(), wp.meshes, currentShape).fieldBase !== undefined) || (netTransformExportData(baseNetTransform, baseGridDivisions(), _netSize(), wp.meshes, currentShape).gridShiftPx !== undefined);
            return R;
        })()`);
        if (r.none || r.domain !== 'field') { note('none', [X, Y, ln]); continue; }
        if (!(r.Rx % 2 === 1 && r.Ry % 2 === 1 && r.Rx <= 21 && r.Ry <= 21)) note('odd', [X, Y, r.Rx, r.Ry]); if (!r.cov) note('cover', [X, Y, ln]); if (!r.mono) note('mono', [X, Y, ln]);
        if (r.inv > 1e-8) note('inv', [X, Y, ln, r.inv]); if (r.split > 1e-9) note('split', [X, Y, ln, r.split]); if (r.splitN < 10) note('splitN', [X, Y, ln, r.splitN]); if (r.dot > 1e-9 || r.hit > 1e-8) note('dot', [X, Y, ln, r.dot, r.hit]);
        if (r.blocks || r.faces < 1) note('faces', [X, Y, r.blocks, r.faces]); if (!r.noShift) note('shiftKey', [X, Y]); if (r.expFB) note('expFieldBase', [X, Y]);
    }
    check(`(1) 49 pairs x 4 laws (${n} cases): a Field, Rx and Ry odd <= 21, canvas covered 100 %, boundaries increasing, F(F^-1) < 1e-8, split < 1e-9, dots = drawing-core points (0 px), faces allowed, no shift key, no fieldBase / gridShiftPx`, !bad.first && n === 49 * 4, J(bad));
}

// ---- 2. Aus <-> Field: no jump, export fields ------------------------------------------------------------------------------------------------------------
{
    const w = world('triangle'); const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let jump = 0, cont = 0;
    for (const [X, Y] of [[4, 4], [3, 4], [4, 3], [6, 5], [8, 8], [3, 3], [5, 5], [9, 9]]) {
        setup(w, 'triangle', X, Y, SPECS.regular);
        const j = w.get('(function () { const wp = netWarpBaseNow(); if (!wp || wp.domain !== "field") return -1; let m = 0; for (let ix = 0; ix <= 12; ix++) for (let iy = 0; iy <= 12; iy++) { const p = { x: ix / 12 * canvasW, y: iy / 12 * canvasH }, q = applyNetWarp(wp, p); m = Math.max(m, Math.hypot(q.x - p.x, q.y - p.y)); } return m; })()');
        if (j < 0) note('regularNoWarp', [X, Y]); else jump = Math.max(jump, j);
        setup(w, 'triangle', X, Y, Object.assign({}, SPECS.sinus, { x: { kind: 'trig', w: -1e-3 }, y: 'same' }));
        const c = w.get('(function () { const wp = netWarpBaseNow(); let m = 0; for (let ix = 0; ix <= 12; ix++) for (let iy = 0; iy <= 12; iy++) { const p = { x: ix / 12 * canvasW, y: iy / 12 * canvasH }, q = applyNetWarp(wp, p); m = Math.max(m, Math.hypot(q.x - p.x, q.y - p.y)); } return m; })()');
        cont = Math.max(cont, c);
        setup(w, 'triangle', X, Y, SPECS.sinus);
        const ex = w.get(`(function () { const e = netTransformExportData(baseNetTransform, baseGridDivisions(), _netSize(), netWarpBaseNow().meshes, currentShape); return { keys: Object.keys(e), tiles: e.fieldTiles, meshes: e.fieldMeshes, bx: e.tileBoundaries.x.length, by: e.tileBoundaries.y.length, m: netWarpBaseNow().meshes }; })()`);
        if (ex.keys.includes('fieldBase') || ex.keys.includes('gridShiftPx')) note('exportKeys', [X, Y, ex.keys]);
        if (J(ex.tiles) !== J(X === Y ? X : { x: X, y: Y }) || ex.meshes.x !== ex.m.x || ex.meshes.y !== ex.m.y || ex.bx !== ex.m.x + 1 || ex.by !== ex.m.y + 1) note('exportMeshes', [X, Y, ex.tiles, ex.meshes]);
    }
    if (jump > 1e-9) note('jump', jump); if (cont >= 1) note('continuity', cont);
    check(`(2) Aus <-> Field at even and odd sizes: a regular Field moves nothing (max ${jump.toExponential(1)} px), w = 1e-3 moves ${cont.toFixed(3)} px (< 1); export: fieldTiles = size, fieldMeshes = Rx x Ry, tileBoundaries Rx + 1 / Ry + 1, no fieldBase, no gridShiftPx`, !bad.first, J(bad));
}

// ---- 3. the Timeline table -------------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const FIELD = SPECS.mixed, FIELD2 = SPECS.tangens, REG = { regular: true }, TILED = { x: { kind: 'trig', w: -0.8 }, y: 'same', repeat: true, domain: 'tiled' }; let rows = 0;
    for (const shape of ['triangle', 'hex', 'square']) {
        const w = world(shape);
        for (const [X, Y] of [[4, 4], [3, 4], [6, 5], [8, 8], [3, 3], [5, 5], [9, 7]]) {
            setup(w, shape, X, Y, null); const cp = (a, b) => w.get(`(function () { const r = netAnimationCompat(${J(a)}, ${J(b)}); return r.ok; })()`);
            const evenAxis = X % 2 === 0 || Y % 2 === 0, blocked = shape === 'square' && evenAxis;   // only the square's even Field moves the picture
            if (cp(REG, FIELD) !== !blocked || cp(FIELD, REG) !== !blocked) note('regField', [shape, X, Y]);
            if (cp(FIELD, FIELD2) !== true) note('fieldField', [shape, X, Y]); if (cp(FIELD, TILED) !== false) note('domain', [shape, X, Y]); rows += 3;
        }
    }
    check(`(3) netAnimationCompat (${rows} rows, triangle / hexagon / square, even and odd sizes): Regular <-> Field ok everywhere except the square at an even size (half a tile), Field <-> Field ok, Field <-> Tiled refused`, !bad.first, J(bad));
}

// ---- 4. netDomainEffective ---------------------------------------------------------------------------------------------------------------------------------
{
    const w = world('square'); const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const ok = (shape, X, Y) => w.get(`netDomainEffective({ domain: 'field' }, { x: ${X}, y: ${Y} }${shape === undefined ? '' : ', ' + J(shape)}).ignored === null`);
    for (let n = 1; n <= 10; n++) {
        if (ok('triangle', n, n) !== (n >= 3 && n <= 9)) note('triangle', n);
        if (ok('hex', n, n) !== (n >= 3 && n <= 9)) note('hex', n);   // task 109: the hexagon takes 3..9 at any parity
        if (ok('square', n, n) !== (n >= 3 && n <= 9)) note('square', n);
        for (const s of [undefined, null, '', 'circle', 'Triangle']) if (ok(s, n, n) !== (n >= 3 && n <= 9 && n % 2 === 1)) note('unknown', [String(s), n]);
    }
    for (const [X, Y] of [[4, 3], [3, 4], [6, 5], [4, 9]]) if (!ok('triangle', X, Y) || !ok('hex', X, Y)) note('mixed', [X, Y]);
    check('(4) netDomainEffective: the triangle takes 3..9 at any parity (1, 2, 10 refused, mixed axes too), the hexagon (task 109) 3..9 too, the square 3..9, no or an unknown shape odd only', !bad.first, J(bad));
}

// ---- 5. byte-equal to main ---------------------------------------------------------------------------------------------------------------------------------
if (!CHILD) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tri108-')), mainFile = path.join(dir, 'netwarp.js'), mainState = path.join(dir, 'state.js');
    fs.writeFileSync(mainFile, execSync(`git show ${MAIN}:core/netwarp.js`, { cwd: ROOT, maxBuffer: 1 << 26 }));
    const MAINFILES = { 'core/netwarp.js': mainFile }, worlds = {};
    const wOf = (kind, shape) => worlds[kind + shape] || (worlds[kind + shape] = world(shape, kind === 'main' ? MAINFILES : {}));
    const snap = (w, shape, X, Y, spec) => {
        setup(w, shape, X, Y, spec);
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
    for (const [X, Y] of PAIRS) if (X % 2 === 1 && Y % 2 === 1) for (const nm of ['mixed', 'geometric', 'sinus']) cases.push(['triangle', X, Y, SPECS[nm], 'tri-odd']);
    for (const shape of ['hex', 'square']) for (let X = 1; X <= 9; X++) for (let Y = 1; Y <= 9; Y++) if (Math.max(X, Y) <= 3 * Math.min(X, Y) && !(shape === 'hex' && ((X % 2 === 0 && X >= 4) || (Y % 2 === 0 && Y >= 4)))) for (const nm of ['mixed', 'geometric']) cases.push([shape, X, Y, SPECS[nm], shape + '-field']);   // task 109: the hexagon at an even size with a Field is a Field now (test-net-field-hex-even.js)
    for (let X = 1; X <= 9; X += 1) for (const Y of [1, 2, 3, 4, 5, 8]) if (Math.max(X, Y) <= 3 * Math.min(X, Y)) for (const [nm, sp] of [['none', null], ['single', NOFIELD.single], ['tiled', NOFIELD.tiled]]) cases.push(['triangle', X, Y, sp, 'tri-nofield-' + nm]);
    // the triangle at sizes below 3 with a Field stays "no net" as on main
    for (const [X, Y] of [[1, 1], [2, 2], [1, 2], [2, 3], [3, 2]]) cases.push(['triangle', X, Y, SPECS.mixed, 'tri-small']);
    let n = 0; const diffs = [];
    for (const [shape, X, Y, spec, kind] of cases) { const a = snap(wOf('main', shape), shape, X, Y, spec), b = snap(wOf('new', shape), shape, X, Y, spec); n++; if (a !== b) diffs.push([shape, X, Y, kind]); }
    // ... and the triangle at an EVEN size with a Field is NOT the main picture (main: no net): the opposite check, so the equality above is not vacuous
    let changed = 0, total = 0; for (const [X, Y] of PAIRS) if (X % 2 === 0 || Y % 2 === 0) { total++; if (snap(wOf('main', 'triangle'), 'triangle', X, Y, SPECS.mixed) !== snap(wOf('new', 'triangle'), 'triangle', X, Y, SPECS.mixed)) changed++; }
    check(`(5) byte-equal to main ${MAIN}: triangle odd with a Field, the hexagon (except with an even axis >= 4, task 109) and the square at the sizes 1..9 with a Field, the triangle without a Field and below size 3 (${n} cases); the triangle at an even size with a Field is a new picture (${changed} of ${total} differ)`, diffs.length === 0 && n > 250 && changed === total, J(diffs.slice(0, 6)) + ` n=${n} changed=${changed}/${total}`);
}

// ---- 6. sabotage runs --------------------------------------------------------------------------------------------------------------------------------------
if (!CHILD) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tri108s-')), src = fs.readFileSync(path.join(ROOT, 'core', 'netwarp.js'), 'utf8');
    const SAB = [
        ['the square shift (shiftVec) in the triangle code', "meshes: { x: best.Rx, y: best.Ry }, frame: { c0: base.c0, v1, v2, det }", "meshes: { x: best.Rx, y: best.Ry }, shiftVec: { x: 0.5 * v1.x, y: 0.5 * v1.y }, frame: { c0: base.c0, v1, v2, det }"],
        ['the triangle search starts at an even count', "for (let Rx = R.x | 1;", "for (let Rx = R.x;"],
        ['the export writes fieldBase / gridShiftPx for the triangle', "if (shape === 'square' && (R.x % 2 === 0 || R.y % 2 === 0))", "if ((R.x % 2 === 0 || R.y % 2 === 0))"],
        ['size 2 opens the triangle Field', "else if (n < (sq ? netFieldMinTiles : 3))", "else if (n < (sq || shape === 'triangle' ? 2 : 3))"],
        ['an unknown shape is read as the triangle', "(sq || shape === 'triangle' || shape === 'hex') && n % 2 === 0", "(sq || shape !== 'circle_never') && n % 2 === 0"],
        ['the triangle even gate is gone', "(sq || shape === 'triangle' || shape === 'hex') && n % 2 === 0", "(sq || shape === 'hex') && n % 2 === 0"],
        ['the Timeline guard applies to every shape', "currentShape === 'square' && typeof netSizeFactors === 'function'", "typeof netSizeFactors === 'function'"],
    ];
    let red = 0; const notRed = [];
    SAB.forEach(([name, from, to], i) => {
        if (src.split(from).length !== 2) { notRed.push([name, 'pattern not found once']); return; }
        const f = path.join(dir, 'sab' + i + '.js'); fs.writeFileSync(f, src.replace(from, () => to));
        const r = spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { NETWARP_JS: f }), encoding: 'utf8', maxBuffer: 1 << 26 });
        if (r.status !== 0) red++; else notRed.push([name, 'still green']);
    });
    check(`(6) ${SAB.length} sabotage runs on mutated copies: every one fails the test`, red === SAB.length && notRed.length === 0, J(notRed));
}
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
