// Task 088: the Field net on the TRIANGLE sheet (domain 'field', X and Y odd in {3,5,7,9}, also X = Y): the smallest odd (Rx, Ry) >= (X, Y), <= 21, whose lattice parallelogram covers the whole canvas.
//   node tools/grid/test-net-field-triangle.js      sabotage runs: NETWARP_JS, EXPORT_JS (mutated copies)
//   1. all 16 pairs x 4 laws (sinus, tangens, geometric, regular): the canvas is covered 100 %, Rx, Ry odd and <= 21, tile boundaries strictly increasing, F(F^-1(p)) < 1e-8, no triangle straddles a mesh boundary,
//      the image of a straight segment lies on the polyline through its crossings (split, < 1e-9), dots = line ends, Aus <-> Field continuous at w = 1e-3
//   2. symmetry numbers (mirror about the vertical axis, 120 degrees) are REPORTED, time per frame at 9/9 and 7/5
//   3. no Field -> byte-equal to main: a Single / Tiled / regular net on the triangle and the square without a Field; the Field of a square (25 cases) is byte-equal to main
//   4. export: fieldTiles = the sizes, fieldMeshes = {x, y} only for the triangle, boundaries per axis; session round trip identical
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const MODE = 'rotation_reflection6', HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; };';
const FILES = process.env.NETWARP_JS ? { 'core/netwarp.js': process.env.NETWARP_JS } : undefined;
const world = (shape, files) => { const w = H.makeRenderWorld(shape, 3, 3, MODE, files === undefined ? FILES : files); w.set(HOOK); return w; };
const setup = (w, shape, X, Y, spec, nconn) => w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: 3, lage: 1 })}); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600;
    setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; baseNetTransform = ${J(spec === undefined ? null : spec)}; baseNetAnimation = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base';
    baseFaceAssignments = new Map(); baseFacePalette = null; baseFaceAnchor = null; showFaces = false; rebuildGrid(currentShape);
    connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, ${nconn || 6});`);
const LAWS = { sinus: { kind: 'trig', w: -0.8 }, tangens: { kind: 'trig', w: 0.6 }, geometric: { kind: 'geometric', w: Math.log(4) }, regular: { kind: 'uniform', w: 0 } };
const fieldSpec = (law) => ({ x: law, y: law.kind === 'trig' ? { kind: 'trig', w: -law.w * 0.7 } : law, repeat: false, domain: 'field' });

{
    const w = world('triangle'); let n = 0; const bad = {};
    const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    for (const X of [3, 5, 7, 9]) for (const Y of [3, 5, 7, 9]) for (const [ln, law] of Object.entries(LAWS)) {
        const spec = fieldSpec(law); setup(w, 'triangle', X, Y, spec, 6); n++;
        const r = w.get(`(function () {
            const wp = netWarpBaseNow(); if (!wp) return { none: true };
            const F = _netFrame(wp), f = wp.field, W = canvasW, H = canvasH, R = {};
            let cov = true; for (let ix = 0; ix < 60; ix++) for (let iy = 0; iy < 60; iy++) if (!netWarpInsideNet(wp, { x: (ix + 0.5) / 60 * W, y: (iy + 0.5) / 60 * H })) cov = false;
            R.cov = cov; R.domain = wp.domain; R.meshes = wp.meshes; R.odd = f.Rx % 2 === 1 && f.Ry % 2 === 1 && f.Rx <= 21 && f.Ry <= 21 && f.Rx >= ${X} && f.Ry >= ${Y};
            const mono = P => P.every((v, i) => i === 0 || v > P[i - 1]); R.mono = (!wp.fx || mono(wp.fx.field.P)) && (!wp.fy || mono(wp.fy.field.P));
            let inv = 0, seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
            for (let i = 0; i < 300; i++) { const p = { x: rnd() * W, y: rnd() * H }, q = applyNetWarp(wp, invertNetWarp(wp, p)); inv = Math.max(inv, Math.hypot(q.x - p.x, q.y - p.y)); } R.inv = inv;
            // the base mesh holds the up triangle and its point reflection (the down triangle): no triangle straddles a mesh boundary
            const oc = outerCorners, cen = centroid, mc = { x: F.c0.x + 0.5 * F.v1.x + 0.5 * F.v2.x, y: F.c0.y + 0.5 * F.v1.y + 0.5 * F.v2.y };
            const tcs = p => netWarpTileCoords(wp, p), up = oc.map(tcs), dn = oc.map(p => tcs({ x: 2 * mc.x - p.x, y: 2 * mc.y - p.y }));
            R.straddle = up.concat(dn).some(c => c.s < -1e-9 || c.s > 1 + 1e-9 || c.t < -1e-9 || c.t > 1 + 1e-9);
            let split = 0, sc = 0;
            for (let i = 0; i < 300; i++) {
                const p1 = { x: rnd() * W, y: rnd() * H }, p2 = { x: rnd() * W, y: rnd() * H }, pts = netWarpSplitSegment(wp, p1, p2); if (!pts) continue; sc++;
                const m = pts.map(p => applyNetWarp(wp, p));
                for (let k = 1; k < 20; k++) { const t = k / 20, q = applyNetWarp(wp, { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }); let best = 1e9;
                    for (let j = 0; j + 1 < m.length; j++) { const a = m[j], b = m[j + 1], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, u = L ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L)) : 0; best = Math.min(best, Math.hypot(q.x - (a.x + u * dx), q.y - (a.y + u * dy))); }
                    split = Math.max(split, best); }
            }
            R.split = split; R.splitN = sc;
            const nwDraw = netWarpForBase(netTransformNow(), currentShape, outerCorners, nodeCount, shapeSizeFactor); let dot = 0; for (const nd of nodes) { const a = applyNetWarp(nwDraw, nd), b = applyNetWarp(wp, nd); dot = Math.max(dot, Math.hypot(a.x - b.x, a.y - b.y)); } R.dot = dot;
            R.blocks = netWarpBlocksFaces(); showFaces = true; R.faces = computeCellFaces(connections, nodes, null).faces.length; showFaces = false;
            return R;
        })()`);
        if (ln === 'regular') { if (!r.none && r.domain !== 'field') note('regular', [X, Y]); continue; }
        if (r.none || r.domain !== 'field') { note('none', [X, Y, ln]); continue; }
        if (!r.cov) note('cover', [X, Y, ln]); if (!r.odd) note('odd', [X, Y, J(r.meshes)]); if (!r.mono) note('mono', [X, Y, ln]); if (r.inv > 1e-8) note('inv', [X, Y, ln, r.inv]);
        if (r.splitN < 20) note('splitN', [X, Y, ln, r.splitN]); if (r.straddle) note('straddle', [X, Y]); if (r.split > 1e-9) note('split', [X, Y, ln, r.split]); if (r.dot > 1e-9) note('dot', [X, Y, ln, r.dot]); if (r.blocks || r.faces < 1) note('faces', [X, Y, r.blocks, r.faces]);
    }
    check(`(1) 16 sizes x 4 laws (${n} cases): Field with odd Rx, Ry <= 21, canvas covered 100 %, monotone boundaries, F(F^-1) < 1e-8, no triangle straddles a mesh, split exact, dots = line ends, faces allowed`, n === 64 && !bad.first, J(bad));

    // Aus <-> Field: a tiny strength moves nothing
    let cont = 0;
    for (const [X, Y] of [[3, 5], [5, 5], [9, 7]]) {
        setup(w, 'triangle', X, Y, fieldSpec({ kind: 'trig', w: -1e-3 }), 4);
        cont = Math.max(cont, w.get('(function () { const wp = netWarpBaseNow(); let m = 0; for (let ix = 0; ix <= 10; ix++) for (let iy = 0; iy <= 10; iy++) { const p = { x: ix / 10 * canvasW, y: iy / 10 * canvasH }, q = applyNetWarp(wp, p); m = Math.max(m, Math.hypot(q.x - p.x, q.y - p.y)); } return m; })()'));
    }
    check(`(1b) Aus <-> Field continuous: at w = 1e-3 the largest displacement is ${cont.toFixed(3)} px (< 1)`, cont < 1);

    // symmetry numbers and time per frame (reported)
    const rep = {};
    for (const [X, Y] of [[3, 5], [5, 5], [9, 9], [7, 5]]) {
        setup(w, 'triangle', X, Y, fieldSpec(LAWS.sinus), 10);
        const sym = w.get(`(function () { const wp = netWarpBaseNow(), ctr = centroid; let mir = 0, r3 = 0; for (let ix = 1; ix <= 7; ix++) for (let iy = 1; iy <= 7; iy++) { const p = { x: ix / 8 * canvasW, y: iy / 8 * canvasH }, q = applyNetWarp(wp, p);
            const m = applyNetWarp(wp, { x: 2 * ctr.x - p.x, y: p.y }); mir = Math.max(mir, Math.hypot(m.x - (2 * ctr.x - q.x), m.y - q.y)); const a = applyNetWarp(wp, rotateAround(p, ctr, 120)), b = rotateAround(q, ctr, 120); r3 = Math.max(r3, Math.hypot(a.x - b.x, a.y - b.y)); } return { mir: Math.round(mir * 100) / 100, rot120: Math.round(r3 * 100) / 100, meshes: wp.meshes }; })()`);
        const t = []; for (let i = 0; i < 5; i++) { const t0 = process.hrtime.bigint(); w.frame(); t.push(Number(process.hrtime.bigint() - t0) / 1e6); }
        t.sort((a, b) => a - b); rep[`${X}/${Y}`] = Object.assign(sym, { frameMsMedian: Math.round(t[2] * 10) / 10 });
        setup(w, 'triangle', X, Y, null, 10); const t1 = []; for (let i = 0; i < 5; i++) { const t0 = process.hrtime.bigint(); w.frame(); t1.push(Number(process.hrtime.bigint() - t0) / 1e6); } t1.sort((a, b) => a - b); rep[`${X}/${Y}`].frameMsNoNet = Math.round(t1[2] * 10) / 10;
    }
    console.log('REPORT symmetry (mirror about the vertical axis / rot120, px) and frame time (ms, 10 orbits):', J(rep));
    check('(2) the frame at 9/9 and 7/5 draws (time reported above)', rep['9/9'].frameMsMedian > 0 && rep['7/5'].frameMsMedian > 0);
}

// ---- 3. no Field: byte-equal to main ----
{
    let mainFiles = null;
    try {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wof088-')); mainFiles = {};
        for (const f of ['netwarp', 'state', 'export', 'spatial-morph-render']) { const p = path.join(dir, f + '.js'); fs.writeFileSync(p, execSync(`git show 149dad21:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 })); mainFiles['core/' + f + '.js'] = p; }
    } catch (e) { mainFiles = null; }
    if (!mainFiles) check('(3) main 149dad21 is not available here: skipped', true);
    else {
        const mk = (shape, main) => {
            if (!main) return world(shape);
            const keep = {}; for (const k of ['STATE_JS', 'EXPORT_JS', 'SPATIAL_MORPH_RENDER_JS']) keep[k] = process.env[k];
            process.env.STATE_JS = mainFiles['core/state.js']; process.env.EXPORT_JS = mainFiles['core/export.js']; process.env.SPATIAL_MORPH_RENDER_JS = mainFiles['core/spatial-morph-render.js'];
            const wm = H.makeRenderWorld(shape, 3, 3, MODE, { 'core/netwarp.js': mainFiles['core/netwarp.js'] }); wm.set(HOOK);
            for (const k of Object.keys(keep)) { if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k]; } return wm;
        };
        const probe = (w2) => w2.get(`(function () { const segs = (segmentCollector = [], drawTessellation(), segmentCollector.slice()); segmentCollector = null; const ex = buildExportData(null); delete ex.exportedAt; return JSON.stringify({ segs, ex, nw: netWarpBaseNow() === null }); })()`);
        const bad = {}; let n = 0;
        const specs = [null, { x: { kind: 'trig', w: 0.7 }, y: 'same', repeat: false, domain: 'single' }, { x: { kind: 'trig', w: -0.7 }, y: 'same', repeat: true, domain: 'tiled' }, { x: { kind: 'geometric', w: 1.1 }, y: 'same', repeat: false, macro: 3 }];
        for (const shape of ['triangle', 'hex', 'square']) { const wn = mk(shape, false), wm = mk(shape, true); for (const sz of [3, 4, 5]) for (const spec of (shape === 'square' ? specs.concat([fieldSpec(LAWS.sinus), fieldSpec(LAWS.geometric)]) : specs)) { if (shape === 'triangle' && spec && spec.domain === 'field') continue; setup(wn, shape, sz, sz, spec, 6); setup(wm, shape, sz, sz, spec, 6); n++; if (probe(wn) !== probe(wm)) bad[shape] = (bad[shape] || 0) + 1; } }
        check(`(3) triangle / hexagon without a Field and square with and without one (${n} cases): drawn segments, export, net-active flag byte-equal to main`, n > 40 && !bad.triangle && !bad.hex && !bad.square, J(bad));
        const w = world('triangle'); setup(w, 'triangle', 4, 4, fieldSpec(LAWS.sinus)); const ev = w.get('netWarpBaseNow() === null && netDomainEffective({ domain: "field" }, netSizeFactors()).ignored !== null');
        setup(w, 'triangle', 3, 4, fieldSpec(LAWS.sinus)); const od = w.get('netWarpBaseNow() === null');
        const wh = world('hex'); setup(wh, 'hex', 4, 4, fieldSpec(LAWS.sinus));   // task 089: the hexagon has a Field at odd sizes now
        check('(3b) an even size on the triangle (4/4, 3/4) and the hexagon (4/4): no net warp (as before)', ev && od && wh.get('netWarpBaseNow() === null'));
    }
}

// ---- 4. export and session ----
{
    const w = world('triangle'); const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    for (const [X, Y] of [[3, 5], [5, 3], [5, 5], [9, 7]]) {
        setup(w, 'triangle', X, Y, fieldSpec(LAWS.sinus), 4);
        const ex = w.get('buildExportData(null).meta.netTransform'), m = w.get('netWarpBaseNow().meshes');
        const want = X === Y ? X : { x: X, y: Y };
        if (ex.domain !== 'field' || J(ex.fieldTiles) !== J(want) || J(ex.fieldMeshes) !== J(m)) note('export', [X, Y, ex.fieldTiles, ex.fieldMeshes]);
        if (ex.tileBoundaries.x.length !== m.x + 1 || ex.tileBoundaries.y.length !== m.y + 1) note('bounds', [X, Y]);
        const ui = S.uiOf(w.ctx, 'spiegeling', 6), snap = S.snapOf(w.ctx, ui), exp = S.exportOf(w.ctx);
        if (J(snap).includes('fieldMeshes') || J(snap).includes('Rx')) note('snap', [X, Y]);
        const target = S.world('triangle', 3, 3, 'none'); target.run(HOOK);
        const tui = S.uiOf(target, 'none', 6), ap = S.applyInto(target, snap, S.fakeHooks(target, snap, tui));
        if (!(ap && ap.ok) || !S.safe(() => S.same(S.snapOf(target, tui), snap)) || !S.safe(() => S.same(S.exportOf(target), exp))) note('session', [X, Y, J(ap).slice(0, 160)]);
    }
    setup(w, 'square', 3, 5, fieldSpec(LAWS.sinus), 4); const exq = w.get('buildExportData(null).meta.netTransform');
    check('(4) export: fieldTiles = the sizes, fieldMeshes = {x, y} of the triangle (boundaries Rx+1, Ry+1); the square has no fieldMeshes; session round trip identical (no mesh count in it)', !bad.first && exq.fieldMeshes === undefined, J(bad));
}
// ---- 5. timeline net snapshots on the triangle: playback t = 0, .5, 1 draws the lerp over the covering Field ----
{
    const w = world('triangle'); const bad = {};
    const A = fieldSpec({ kind: 'trig', w: -0.8 }), B = fieldSpec({ kind: 'trig', w: -0.3 });
    for (const [X, Y] of [[3, 5], [5, 5], [7, 5]]) {
        setup(w, 'triangle', X, Y, A, 4);
        const k1 = w.addKeyframeLayer([[1, 6]]), k2 = w.addKeyframeLayer([[2, 5]]);
        S.addLayer(w.ctx, { shape: 'triangle', order: 3, size: Math.min(X, Y), playback: true });
        w.setTimeline([k1, k2], { playbackLayerIndex: 2 });
        w.set('additionalLayers[0]._timelineSavedEnabled = true; additionalLayers[1]._timelineSavedEnabled = true; timeline.segmentPairings = [[1, 0]]; timeline.segmentFlips = [null]; timeline.segmentMembers = [null];');
        w.set(`timeline.netStates = [${J(A)}, ${J(B)}]; timeline.netLive = true;`);
        for (const t of [0, 0.5, 1]) {
            w.set(`timeline.currentFrame = { segmentIndex: 0, localT: ${t} };`);
            const lerp = w.get(`netLerpSpecs(${J(A)}, ${J(B)}, ${t})`), now = w.get('netTransformNow()'), wp = w.get('netWarpBaseNow()');
            if (J(now.x) !== J(lerp.x) || !wp || wp.domain !== 'field' || !wp.meshes) bad[`${X}/${Y}@${t}`] = 1;
            const f1 = w.frame().length; if (!f1) bad.empty = 1;
        }
    }
    check('(5) timeline net snapshots on the triangle (3/5, 5/5, 7/5), t = 0, .5, 1: the Field follows the lerp of the two snapshots', !Object.keys(bad).length, J(bad));
}
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
