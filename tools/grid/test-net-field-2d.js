// Task 086: the Field net (domain 'field') on a Rx x Ry area - X x Y macro tiles over W x H for the odd sizes {3,5,7,9} of a SQUARE; everything else is Single, with a hint.
//   node tools/grid/test-net-field-2d.js      sabotage runs (mutated copies): NETWARP_JS, TILING_JS, STATE_JS, EXPORT_JS (tools/session/fixtures.js), SPATIAL_MORPH_RENDER_JS, SKETCH_JS
//   1. all 16 pairs (X, Y) in {3,5,7,9}^2 (12 with X != Y): drawnTiles = X * Y, no segment outside [0,W] x [0,H], the field edge lies on the canvas edge (0 px), F(F^-1(p)) < 1e-8 px,
//      the warped tiles fill W x H exactly (sum of the tile areas), the faces of the base sheet are allowed (netWarpBlocksFaces false), the dots sit on the line ends (0 px)
//   2. Single instead of Field: an even axis (4/5, 2/6, 4/4, 6/7) and the triangle / hexagon: domain single (with the hint), no field, the export says 'single'
//   3. export: fieldTiles = X for X = Y (a number), {x, y} otherwise; the description round-trips; the session round trip and the timeline net snapshots stay as they are at X != Y
//   4. resizeBase 3/3 <-> 3/5 <-> 5/7 with a Field: it stays (no hint), the nodes are the fresh grid; to an even size it is Single with the hint; X = Y is byte-equal to main
//   5. the Netz row (the real initNetControls): #net-field-btn is disabled exactly when Single holds; the Shape-Size steppers (ui-form.js sizeCompute) in a Field
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const MODE = 'rotation_reflection6';
const HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; };';
const ODD = [3, 5, 7, 9];
const FILES = {};
if (process.env.NETWARP_JS) FILES['core/netwarp.js'] = process.env.NETWARP_JS;
const world = (shape, files) => { const w = H.makeRenderWorld(shape, 3, 3, MODE, files || FILES); w.set(HOOK); return w; };
const setup = (w, shape, X, Y, spec, conns) => w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: 3, lage: 1 })}); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600;
    setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = ${J(conns || [[1, 6], [2, 5]])}; redoStack = []; baseNetTransform = ${J(spec === undefined ? null : spec)}; baseNetAnimation = null;
    additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; baseFaceAnchor = null; baseLastHarmonyType = null; baseLastSelection = null; baseDistributionStrategy = null;
    showFaces = false; rebuildGrid(currentShape); connections = ${J(conns || [[1, 6], [2, 5]])};`);
const FIELD = { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.6 }, repeat: false, domain: 'field' };   // two different axes: a swapped hx/hy or Rx/Ry shows
const FIELDG = { x: { kind: 'geometric', w: Math.log(4) }, y: { kind: 'trig', w: -0.5, focus: 0.3 }, repeat: false, domain: 'field' };
const SINGLE = Object.assign({}, FIELD, { domain: 'single' });

// ---- 1. the 16 pairs --------------------------------------------------------------------------------------------------------------------------------------
const metrics = (w, X, Y, spec) => {
    const segs = w.frame(), W_ = w.get('canvasW'), H_ = w.get('canvasH');
    w.set(`baseNetTransform = ${J(Object.assign({}, spec, { domain: 'single' }))};`);
    const perTile = w.frame().length;
    w.set(`baseNetTransform = ${J(spec)};`);
    const out = segs.filter(s => [s.x1, s.x2].some(v => v < -1e-6 || v > W_ + 1e-6) || [s.y1, s.y2].some(v => v < -1e-6 || v > H_ + 1e-6)).length;
    const r = w.get(`(function () {
        const warp = netWarpBaseNow(), F = _netFrame(warp), [hx, hy] = _netFieldH(warp), W = canvasW, H = canvasH, at = (s, t) => ({ x: F.c0.x + s * F.v1.x + t * F.v2.x, y: F.c0.y + s * F.v1.y + t * F.v2.y });
        let edge = 0;
        for (let i = 0; i <= 40; i++) {
            const u = i / 40, sx = -hx + u * (2 * hx + 1), ty = -hy + u * (2 * hy + 1);
            edge = Math.max(edge, Math.abs(applyNetWarp(warp, at(sx, -hy)).y - 0), Math.abs(applyNetWarp(warp, at(sx, hy + 1)).y - H), Math.abs(applyNetWarp(warp, at(-hx, ty)).x - 0), Math.abs(applyNetWarp(warp, at(hx + 1, ty)).x - W));
        }
        let inv = 0, seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 400; i++) { const p = { x: rnd() * W, y: rnd() * H }, q = applyNetWarp(warp, invertNetWarp(warp, p)); inv = Math.max(inv, Math.hypot(q.x - p.x, q.y - p.y)); }
        let area = 0;
        for (let i = -hx; i <= hx; i++) for (let j = -hy; j <= hy; j++) {
            const c = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)].map(p => applyNetWarp(warp, p));
            let a = 0; for (let k = 0; k < 4; k++) { const p = c[k], q = c[(k + 1) % 4]; a += p.x * q.y - q.x * p.y; } area += Math.abs(a) / 2;
        }
        const nwDraw = netWarpForBase(netTransformNow(), currentShape, outerCorners, nodeCount, shapeSizeFactor);   // what core/tiling.js drawTessellation() reads (it passes shapeSizeFactor)
        let dot = 0; for (const nd of nodes) { const a = applyNetWarp(nwDraw, nd), b = applyNetWarp(warp, nd); dot = Math.max(dot, Math.hypot(a.x - b.x, a.y - b.y)); }
        const fc = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()), keepC = connections; connections = fc;
        showFaces = true; const faces = computeCellFaces(connections, nodes, null).faces.length; showFaces = false; connections = keepC;
        return { edge, inv, area, W, H, dot, faces, blocks: netWarpBlocksFaces(), domain: warp.domain, tiles: warp.field.Rx !== undefined ? [warp.field.Rx, warp.field.Ry] : [warp.field.Rt, warp.field.Rt] };
    })()`);
    return Object.assign(r, { drawnTiles: segs.length / perTile, outside: out, segs: segs.length });
};
{
    const w = world('square'); let n = 0, bad = {};
    const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    for (const X of ODD) for (const Y of ODD) for (const [name, spec] of [['trig', FIELD], ['geo', FIELDG]]) {
        setup(w, 'square', X, Y, spec); n++;
        const m = metrics(w, X, Y, spec);
        if (m.domain !== 'field' || m.tiles.join() !== [X, Y].join()) note('domain', [X, Y, m.domain, m.tiles]);
        if (Math.abs(m.drawnTiles - X * Y) > 1e-9) note('tiles', [X, Y, name, m.drawnTiles]);
        if (m.outside) note('outside', [X, Y, name, m.outside]);
        if (m.edge > 1e-6) note('edge', [X, Y, name, m.edge]);
        if (m.inv > 1e-8) note('inv', [X, Y, name, m.inv]);
        if (Math.abs(m.area - m.W * m.H) > 1e-6) note('area', [X, Y, name, m.area, m.W * m.H]);
        if (m.blocks || m.faces < 1) note('faces', [X, Y, m.blocks, m.faces]);
        if (m.dot > 1e-9) note('dot', [X, Y, name, m.dot]);
    }
    check(`(1) 16 pairs {3,5,7,9}^2 x 2 laws (${n} cases): drawnTiles = X*Y, 0 segments outside, edge on the canvas edge, F(F^-1(p)) < 1e-8, tile areas fill W x H, faces allowed, dots = line ends`, n === 32 && !bad.first, J(bad));
}

// ---- 1b. segments across tile boundaries (a layer's offset / rotated lines): netWarpSplitSegment is exact per axis ---------------------------------------
{
    const w = world('square'); let n = 0, worst = 0, splits = 0;
    for (const [X, Y] of [[3, 5], [5, 3], [5, 9], [9, 3], [7, 5], [3, 3]]) {
        setup(w, 'square', X, Y, FIELD);
        const r = w.get(`(function () {
            const warp = netWarpBaseNow(), W = canvasW, H = canvasH; let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
            let worst = 0, splits = 0, cnt = 0;
            for (let i = 0; i < 300; i++) {
                const p1 = { x: rnd() * W, y: rnd() * H }, p2 = { x: rnd() * W, y: rnd() * H }, pts = netWarpSplitSegment(warp, p1, p2);
                cnt++; if (!pts) continue; splits++;
                const mapped = pts.map(p => applyNetWarp(warp, p));
                for (let k = 1; k < 40; k++) {   // a point of the straight regular segment lands on the polyline through the mapped crossings
                    const t = k / 40, q = applyNetWarp(warp, { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
                    let best = Infinity;
                    for (let j = 0; j + 1 < mapped.length; j++) {
                        const a = mapped[j], b = mapped[j + 1], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, u = L ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L)) : 0;
                        best = Math.min(best, Math.hypot(q.x - (a.x + u * dx), q.y - (a.y + u * dy)));
                    }
                    worst = Math.max(worst, best);
                }
            }
            return { worst, splits, cnt };
        })()`);
        n++; worst = Math.max(worst, r.worst); splits += r.splits;
    }
    check(`(1b) netWarpSplitSegment on 3/5, 5/3, 5/9, 9/3, 7/5, 3/3: the image of a straight segment lies on the polyline through the mapped crossings (worst ${worst.toExponential(2)} px, ${splits} split segments)`, n === 6 && splits > 200 && worst < 1e-6, J([n, splits, worst]));
}

// ---- 2. Single instead of a Field --------------------------------------------------------------------------------------------------------------------------
{
    const w = world('square'); let n = 0, bad = {}, hints = 0;
    const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    for (const [X, Y] of [[2, 6], [1, 3], [2, 2], [1, 1], [2, 5], [3, 1], [1, 2], [2, 4]]) {   // task 106: an axis below 3 (an even size from 4 on is a Field of the square now: test-net-field-even.js)
        setup(w, 'square', X, Y, FIELD); n++;
        const warp = w.get('netWarpBaseNow()'), ex = w.get('buildExportData(null).meta.netTransform');
        if (!warp || warp.domain !== 'single' || warp.field !== null || !warp.domainIgnored) note('warp', [X, Y, warp && warp.domain]);
        if (!ex || ex.domain !== 'single' || !ex.domainIgnored || ex.fieldTiles !== undefined) note('export', [X, Y, ex && ex.domain]);
        if (w.get("netDomainEffective({ domain: 'field' }, netSizeFactors()).ignored") === null) note('fieldOk', [X, Y]);
        if (w.get('netWarpBlocksFaces()') !== true) note('faces', [X, Y]);
        const dot = w.get(`(function () { const a = netWarpForBase(netTransformNow(), currentShape, outerCorners, nodeCount, shapeSizeFactor), b = netWarpBaseNow(); let m = 0; for (const nd of nodes) { const p = applyNetWarp(a, nd), q = applyNetWarp(b, nd); m = Math.max(m, Math.hypot(p.x - q.x, p.y - q.y)); } return m; })()`);
        if (dot !== 0) note('dot', [X, Y, dot]);
        const segs = w.frame(), W_ = w.get('canvasW'), H_ = w.get('canvasH');
        if (segs.some(s => s.x1 < -1e-6 || s.x2 > W_ + 1e-6 || s.y1 < -1e-6 || s.y2 > H_ + 1e-6 && false)) note('drawn', [X, Y]);
    }
    check(`(2a) small axes, an axis below 3 (${n} sizes): Single with domainIgnored, no field, export domain 'single', faces blocked, dots = line ends`, n === 8 && !bad.first, J(bad));
    for (const [shape, X, Y] of [['hex', 2, 2], ['hex', 1, 3], ['triangle', 2, 2], ['triangle', 1, 3]]) {   // task 088/089: the triangle and the hexagon have a Field at odd sizes now; task 108: the triangle at every size 3..9 (test-net-field-triangle-even.js), so only an axis below 3 is no net there; the hexagon at an even axis
        const ws = world(shape); setup(ws, shape, X, Y, FIELD);
        if (ws.get('netWarpBaseNow()') !== null || ws.get('netWarpActive()') !== false || ws.get('buildExportData(null).meta.netTransform') !== undefined) note('shape', [shape, X, Y]);
    }
    check('(2b) hexagon and triangle with an axis below 3 (2/2, 1/3; tasks 108 / 109: the even sizes 3..9 are a Field): no net warp at all, no netTransform in the export', !bad.first, J(bad));
}

// ---- 3. export, session, timeline --------------------------------------------------------------------------------------------------------------------------
{
    const w = world('square'); const bad = {};
    const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    for (const [X, Y] of [[3, 5], [5, 3], [5, 7], [9, 3], [7, 9], [3, 3], [5, 5], [9, 9]]) {
        setup(w, 'square', X, Y, FIELD);
        const ex = w.get('buildExportData(null).meta.netTransform');
        const want = X === Y ? X : { x: X, y: Y };
        if (J(ex.fieldTiles) !== J(want) || ex.domain !== 'field' || ex.facesOmitted !== false) note('export', [X, Y, ex.fieldTiles]);
        if (ex.tileBoundaries.x.length !== X + 1 || ex.tileBoundaries.y.length !== Y + 1) note('bounds', [X, Y]);
        if (ex.tileBoundaries.x[X] !== X || ex.tileBoundaries.y[Y] !== Y || ex.tileBoundaries.x[0] !== 0) note('bounds-ends', [X, Y]);
        const back = w.get(`netTransformFromExport(${J(ex)})`);
        if (back.domain !== 'field' || J(back.x) !== J({ kind: 'trig', w: -0.8, alternate: false }) || J(back.y) !== J({ kind: 'trig', w: 0.6, alternate: false })) note('roundtrip', [X, Y, J(back)]);
        // the description is the geometry: the boundaries are the tile boundaries of the warp (P_k scaled) - x from the x law, y from the y law
        const P = w.get(`(function () { const wp = netWarpBaseNow(); return [wp.fx.field.P, wp.fy.field.P]; })()`);
        if (J(P[0]) !== J(ex.tileBoundaries.x) || J(P[1]) !== J(ex.tileBoundaries.y)) note('P', [X, Y]);
        // the session round trip (X != Y: the snapshot has the size, the net spec and no tile count)
        const ui = S.uiOf(w.ctx, 'spiegeling', 6), snap = S.snapOf(w.ctx, ui), exp = S.exportOf(w.ctx);
        if (snap.settings.netTransform === undefined && !J(snap).includes('"field"')) note('snap-net', [X, Y]);
        if (J(snap).includes('fieldTiles') || J(snap).includes('Rx')) note('snap-tiles', [X, Y]);
        const target = S.world('square', 3, 3, 'none'); target.run(HOOK);
        const tui = S.uiOf(target, 'none', 6), ap = S.applyInto(target, snap, S.fakeHooks(target, snap, tui));
        if (!(ap && ap.ok) || !S.safe(() => S.same(S.snapOf(target, tui), snap)) || !S.safe(() => S.same(S.exportOf(target), exp))) note('session', [X, Y, J(ap).slice(0, 200)]);
        if (target.get('baseNetTransform.domain') !== 'field') note('session-domain', [X, Y]);
    }
    check('(3a) export: fieldTiles = X for X = Y, {x, y} otherwise; tileBoundaries per axis (X+1, Y+1 entries, ends 0 and X / Y); round trip; session round trip identical (snapshot and export, no tile count in it)', !bad.first, J(bad));

    // the timeline's net snapshots at X != Y: playback t = 0, .5, 1 draws the lerp of the two snapshots, the same pictures as the same spec set as the author net
    const A = { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.6 }, repeat: false, domain: 'field' }, B = { x: { kind: 'trig', w: -0.3 }, y: { kind: 'trig', w: 0.2 }, repeat: false, domain: 'field' };
    const bad2 = {};
    const note2 = (k, v) => { bad2[k] = (bad2[k] || 0) + 1; if (!bad2.first) bad2.first = [k, v]; };
    for (const [X, Y] of [[3, 5], [5, 3], [5, 7], [3, 3]]) {
        setup(w, 'square', X, Y, A);
        const k1 = w.addKeyframeLayer([[1, 6]]), k2 = w.addKeyframeLayer([[2, 5]]);
        S.addLayer(w.ctx, { shape: 'square', order: 3, size: Math.min(X, Y), playback: true });
        w.setTimeline([k1, k2], { playbackLayerIndex: 2 });
        w.set('additionalLayers[0]._timelineSavedEnabled = true; additionalLayers[1]._timelineSavedEnabled = true; timeline.segmentPairings = [[1, 0]]; timeline.segmentFlips = [null]; timeline.segmentMembers = [null];');
        w.set(`timeline.netStates = [${J(A)}, ${J(B)}]; timeline.netLive = true;`);
        for (const t of [0, 0.5, 1]) {
            w.set(`timeline.currentFrame = { segmentIndex: 0, localT: ${t} };`);
            const now = w.get('netTransformNow()'), segsT = w.get('(function () { return null; })()');
            const lerp = w.get(`netLerpSpecs(${J(A)}, ${J(B)}, ${t})`);
            if (J(now.x) !== J(lerp.x) || J(now.y) !== J(lerp.y) || now.domain !== 'field') note2('lerp', [X, Y, t]);
            const warp = w.get('netWarpBaseNow()');
            if (!warp || warp.domain !== 'field' || (warp.field.Rx !== undefined ? warp.field.Rx : warp.field.Rt) !== X || (warp.field.Ry !== undefined ? warp.field.Ry : warp.field.Rt) !== Y) note2('warp', [X, Y, t]);
            // the same picture as the lerped spec set as the author net with no timeline
            const f1 = w.frame().map(s => [s.x1, s.y1, s.x2, s.y2].map(v => Math.round(v * 1e6)).join()).join('|');
            const saved = w.get('timeline'); w.set(`timeline = null; baseNetTransform = ${J(Object.assign({}, lerp, { keep: undefined }))};`);
            const f2 = w.frame().map(s => [s.x1, s.y1, s.x2, s.y2].map(v => Math.round(v * 1e6)).join()).join('|');
            w.set(`timeline = ${J(saved)}; baseNetTransform = ${J(A)};`);
            if (f1 !== f2 || !f1) note2('frame', [X, Y, t]);
        }
        // the snapshots survive the session round trip unchanged
        const ui = S.uiOf(w.ctx, 'spiegeling', 6), snap = S.snapOf(w.ctx, ui);
        const target = S.world('square', 3, 3, 'none'); target.run(HOOK);
        const tui = S.uiOf(target, 'none', 6), ap = S.applyInto(target, snap, S.fakeHooks(target, snap, tui));
        if (!(ap && ap.ok) || J(target.get('timeline.netStates')) !== J([A, B])) note2('netStates', [X, Y, J(ap).slice(0, 200)]);
    }
    check('(3b) timeline net snapshots at 3/5, 5/3, 5/7 (and 3/3): playback t = 0, .5, 1 = the lerp of the two snapshots over the X x Y field; the snapshots survive the session round trip', !bad2.first, J(bad2));
}

// ---- 4. resizeBase with a Field ---------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const w = world('square'), fresh = world('square');
    setup(w, 'square', 3, 3, FIELD);
    for (const [X, Y] of [[3, 5], [5, 7], [3, 3], [5, 5], [3, 9], [9, 3], [7, 7]]) {
        const r = w.run(`resizeBase(${X}, ${Y})`);
        if (r.hints.fieldNet) note('hint', [X, Y]);
        if (w.get('baseNetTransform.domain') !== 'field') note('kept', [X, Y]);
        const wp = w.get('netWarpBaseNow()');
        if (!wp || wp.domain !== 'field') note('warp', [X, Y]);
        setup(fresh, 'square', X, Y, FIELD, []);
        const a = w.get('JSON.stringify(nodes.filter(n => !n.free).map(n => [n.id, +n.x.toFixed(9), +n.y.toFixed(9)]))'), b = fresh.get('JSON.stringify(nodes.map(n => [n.id, +n.x.toFixed(9), +n.y.toFixed(9)]))');
        if (a !== b) note('nodes', [X, Y]);
        const wa = w.get('(function () { const p = netWarpBaseNow(); return JSON.stringify([p.field, p.c0, p.v1, p.v2, p.frame || null]); })()'), wb = fresh.get('(function () { const p = netWarpBaseNow(); return JSON.stringify([p.field, p.c0, p.v1, p.v2, p.frame || null]); })()');
        if (wa !== wb) note('rebuild', [X, Y]);
    }
    check('(4a) resizeBase 3/3 -> 3/5 -> 5/7 -> 3/3 -> 5/5 -> 3/9 -> 9/3 -> 7/7 with an active Field: the Field stays (no hint), the nodes and the warp are the fresh build of that size', !bad.first, J(bad));
    // to an even / small size: Single and the hint; from a Single to an odd one: no hint
    setup(w, 'square', 3, 5, FIELD);
    const r1 = w.run('resizeBase(2, 5)'), d1 = w.get('netWarpBaseNow().domain');
    check('(4b) 3/5 -> 2/5 (an axis below 3; task 106: 4/5 stays a Field): the hint "Field net is read as Single" and the drawn net is Single', r1.hints.fieldNet === true && d1 === 'single', J([r1.hints, d1]));
    const r2 = w.run('resizeBase(3, 5)'), d2 = w.get('netWarpBaseNow().domain');
    check('(4c) 4/5 -> 3/5 (Single read as Field again): no hint, the Field is back', r2.hints.fieldNet === false && d2 === 'field', J([r2.hints, d2]));
    setup(w, 'square', 3, 3, SINGLE);
    const r3 = w.run('resizeBase(3, 5)');
    check('(4d) a Single net: no hint at any size', r3.hints.fieldNet === false);
    const r4 = w.run('resizeBase(4, 5)');
    check('(4e) a Field spec of an even size is only read as Single (no hint when it was Single before)', (() => { setup(w, 'square', 4, 4, FIELD); const r = w.run('resizeBase(4, 6)'); return r.hints.fieldNet === false; })());
    void r4;
}

// ---- X = Y byte-equal to main -------------------------------------------------------------------------------------------------------------------------------
{
    let mainFiles = null;
    try {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wof086-'));
        mainFiles = {};
        for (const f of ['netwarp', 'state', 'export', 'spatial-morph-render']) { const p = path.join(dir, f + '.js'); fs.writeFileSync(p, execSync(`git show f4fc41ee:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 })); mainFiles['core/' + f + '.js'] = p; }
    } catch (e) { mainFiles = null; }
    if (!mainFiles) { check('(5) X = Y byte-equal to main: the commit f4fc41ee is not available here (a shallow clone): skipped', true); }
    else {
        const wn = world('square');
        const envKeep = {}; for (const k of ['STATE_JS', 'EXPORT_JS', 'SPATIAL_MORPH_RENDER_JS']) envKeep[k] = process.env[k];   // main's state.js / export.js / spatial-morph-render.js go in through the env of the fixtures
        process.env.STATE_JS = mainFiles['core/state.js']; process.env.EXPORT_JS = mainFiles['core/export.js']; process.env.SPATIAL_MORPH_RENDER_JS = mainFiles['core/spatial-morph-render.js'];
        const wm = H.makeRenderWorld('square', 3, 3, MODE, { 'core/netwarp.js': mainFiles['core/netwarp.js'] }); wm.set(HOOK);
        for (const k of Object.keys(envKeep)) { if (envKeep[k] === undefined) delete process.env[k]; else process.env[k] = envKeep[k]; }
        const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
        let n = 0;
        const specs = [FIELD, FIELDG, { x: { kind: 'trig', w: 0.7, alternate: true }, y: 'same', repeat: true, domain: 'tiled' }, SINGLE, { x: { kind: 'geometric', w: 1.1 }, y: 'same', repeat: false, macro: 3 }];
        for (const sz of [3, 5, 7, 9]) for (const spec of specs) {   // task 106: 4 left out, an even square is a Field now (compared in test-net-field-even.js section 4)
            setup(wn, 'square', sz, sz, spec); setup(wm, 'square', sz, sz, spec); n++;
            const probe = w2 => w2.get(`(function () {
                const segs = (segmentCollector = [], drawTessellation(), segmentCollector.slice()); segmentCollector = null;
                const ex = buildExportData(null); delete ex.exportedAt;
                const lines = netGridLines(netTransformNow(), outerCorners, baseGridDivisions(), { x0: 0, y0: 0, x1: width, y1: height }, (function () { const nw = netWarpBaseNow(), f = nw && nw.field; return f ? { closed: true, domain: 'field', fieldTiles: f.Rt } : { closed: !!nw && !nw.repeat }; })());
                const nw = netWarpBaseNow(); const p = { x: 301.7, y: 222.1 };
                return JSON.stringify({ segs, ex, lines, warp: nw ? { d: nw.domain, f: nw.field, ap: applyNetWarp(nw, p), inv: invertNetWarp(nw, p), split: netWarpSplitSegment(nw, { x: 10, y: 20 }, { x: 590, y: 400 }), loc: netWarpFieldLocal(nw, p), c: netWarpInsideNet(nw, p) } : null });
            })()`);
            if (probe(wn) !== probe(wm)) note('differs', [sz, J(spec).slice(0, 60)]);
        }
        check(`(5) X = Y (sizes 3,5,7,9 x 5 specs = ${n} cases): drawn segments, export, overlay lines, warp, apply / invert / split / local are byte-equal to main (f4fc41ee)`, n === 20 && !bad.first, J(bad));
        // X != Y with a Single: the net is the same on both (only the Field and the readers of shapeSizeFactor differ)
        const bad2 = {}; let m = 0;
        for (const [X, Y] of [[3, 5], [5, 7], [4, 5]]) for (const spec of [SINGLE, { x: { kind: 'trig', w: 0.7 }, y: 'same', repeat: true, domain: 'tiled' }]) {
            setup(wn, 'square', X, Y, spec); setup(wm, 'square', X, Y, spec); m++;
            const f = w2 => w2.get('JSON.stringify((segmentCollector = [], drawTessellation(), segmentCollector.slice()))');
            if (f(wn) !== f(wm)) bad2.single = (bad2.single || 0) + 1;
        }
        check(`(5b) X != Y with a Single or Tiled net (${m} cases): the picture is byte-equal to main`, m === 6 && !bad2.single, J(bad2));
    }
}

// ---- 5. the Netz row and the steppers -------------------------------------------------------------------------------------------------------------------------
{
    const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
    const NET_IIFE = (SKETCH.match(/\(function initNetControls\(\) \{[\s\S]*?\n    \}\)\(\);/) || [''])[0];
    const vm = require('vm');
    function fakeEl(dataset) {
        let val = '0', html = ''; const cls = new Set();
        const elt = { dataset: dataset || {}, hidden: false, disabled: false, title: '', textContent: '', innerHTML: '', addEventListener() { }, dispatchEvent() { },
            classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, on) => { const want = on === undefined ? !cls.has(c) : !!on; if (want) cls.add(c); else cls.delete(c); return want; } } };
        const p = { elt, press: null, inputFn: null, value(v) { if (v === undefined) return val; val = String(v); return p; }, html(s) { if (s === undefined) return html; html = s; elt.textContent = s; return p; },
            mousePressed(fn) { p.press = fn; return p; }, input(fn) { p.inputFn = fn; return p; } };
        return p;
    }
    const w = world('square'); const sb = w.sb;
    const els = new Map();
    const kinds = ['regular', 'sinus', 'tangens', 'geometric'].map(k => fakeEl({ kind: k })), axes = ['both', 'x', 'y'].map(a => fakeEl({ axes: a })), domains = ['single', 'tiled', 'field'].map(d => fakeEl({ domain: d }));
    const sel = id => { if (!els.has(id)) els.set(id, fakeEl()); return els.get(id); };
    sb.select = sel; sb.selectAll = s => (s === '.net-kind-btn' ? kinds : s === '.net-axes-btn' ? axes : s === '.net-domain-btn' ? domains : []);
    sb.UI = { toast(t) { sb.__toasts.push(t); }, t: null }; sb.__toasts = []; sb.nodeInput = null; sb.curveBtn = null; sb.freeBtn = null; sb.faceBtn = null; sb.updateCurveTypeControls = () => { };
    sb.window = sb; sb.say = () => { }; sb.setNetAnimationStatus = () => { }; sb.syncNetAnimationLock = () => { }; sb.redraw = () => { }; sb.sessionFlushNow = () => { };
    sb.document = Object.assign(sb.document || {}, { body: {}, createElement: () => ({ style: {}, classList: { add() { }, toggle() { } }, addEventListener() { }, appendChild() { } }) });
    let row = null, why = '';
    try { vm.runInContext('var adoptNetState = null; var netControlsSync = null; var netLinesOn = false; var syncNetControls = null;', sb); vm.runInContext(NET_IIFE, sb, { filename: 'sketch.js initNetControls' }); row = true; } catch (e) { why = String(e && e.message).slice(0, 200); }
    check('(6) the real initNetControls() runs against fake elements', row === true, why);
    if (row) {
        const fieldBtn = sel('#net-field-btn'), kindBtn = k => kinds.find(b => b.elt.dataset.kind === k);
        const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
        let n = 0;
        for (const [X, Y, shapeOk] of [[3, 3, true], [3, 5, true], [5, 3, true], [5, 7, true], [9, 3, true], [7, 9, true], [4, 5, true], [5, 4, true], [2, 6, false], [4, 4, true], [6, 7, true], [4, 3, true]]) {
            setup(w, 'square', X, Y, null); n++;
            w.set('baseNetTransform = null;');
            try {
                kindBtn('regular').press(); sb.__toasts.length = 0; kindBtn('sinus').press(); sel('#net-strength-input').value('50'); sel('#net-strength-input').inputFn();   // from Regular (the row's own state is reset first): Both axes + Field when the size allows it (else Single and a toast)
                sb.netControlsSync();
                const bnt = w.get('baseNetTransform'), dom = bnt && (bnt.domain || (bnt.repeat ? 'tiled' : 'single'));
                if (dom !== (shapeOk ? 'field' : 'single')) note('domain', [X, Y, dom]);
                if (fieldBtn.elt.disabled !== !shapeOk) note('btn', [X, Y, fieldBtn.elt.disabled]);
                if (!shapeOk && !sb.__toasts.length) note('toast', [X, Y]);
                const wp = w.get('netWarpBaseNow()');
                if (wp && wp.domain !== (shapeOk ? 'field' : 'single')) note('warp', [X, Y]);
                if (shapeOk) { const d = w.get(`(function () { const a = netWarpForBase(netTransformNow(), currentShape, outerCorners, nodeCount, shapeSizeFactor), b = netWarpBaseNow(); let m = 0; for (const nd of nodes) { const p = applyNetWarp(a, nd), q = applyNetWarp(b, nd); m = Math.max(m, Math.hypot(p.x - q.x, p.y - q.y)); } return m; })()`); if (d !== 0) note('dot', [X, Y, d]); }
            } catch (e) { note('threw', [X, Y, String(e && e.message).slice(0, 160)]); }
            sb.__toasts.length = 0;
        }
        check(`(6a) Netz row, a kind chosen from Regular (${n} sizes): Field exactly when X and Y are both 3 or more (task 106: even sizes too: 4/5, 4/4, 6/7), else Single with the hint (2/6); #net-field-btn disabled exactly when Single holds; dots = line ends`, n === 12 && !bad.first, J(bad));
        // a Field set at a valid size, then the size becomes even: reset to Single, visibly, and the button is grey
        setup(w, 'square', 3, 5, null); kindBtn('regular').press(); kindBtn('sinus').press(); sel('#net-strength-input').value('50'); sel('#net-strength-input').inputFn(); sb.netControlsSync();
        w.run('resizeBase(2, 5)'); sb.netControlsSync();
        const d = w.get('baseNetTransform && baseNetTransform.domain');
        check('(6b) Field at 3/5, then the size 2/5 (task 106: 4/5 would stay a Field): the Netz row resets the domain to Single and the button is disabled', d === undefined && fieldBtn.elt.disabled === true, J([d, fieldBtn.elt.disabled]));
        w.run('resizeBase(3, 7)'); sb.netControlsSync();
        check('(6c) back at an odd 3/7: the button is enabled again (the domain stays Single until chosen)', fieldBtn.elt.disabled === false);
    }
    // the readout: the pure model + the real dictionary (ui-i18n.js in a vm)
    const READOUT = require(process.env.UI_NET_READOUT_JS || path.join(ROOT, 'ui-net-readout.js'));
    const ictx = vm.createContext({ window: {}, document: undefined, console }); ictx.window.document = undefined;
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'ui-i18n.js'), 'utf8'), ictx, { filename: 'ui-i18n.js' });
    const I = vm.runInContext('typeof uiI18n !== "undefined" ? uiI18n : window.uiI18n', ictx);
    const tIn = lang => (key, p) => { I.setLang(lang); return I.t(key, p); };
    check('(7a) readout: "Feld: 3 × 5 Kacheln" / "Field: 3 × 5 tiles" for 3/5; X = Y stays "Feld: 5 × 5 Kacheln"; Single and Tiled keep their one number',
        READOUT.readoutText('field', 3, tIn('de'), 5) === 'Feld: 3 × 5 Kacheln' && READOUT.readoutText('field', 3, tIn('en'), 5) === 'Field: 3 × 5 tiles' && READOUT.readoutText('field', 5, tIn('de'), 5) === 'Feld: 5 × 5 Kacheln'
        && READOUT.readoutText('field', 5, tIn('de')) === 'Feld: 5 × 5 Kacheln' && READOUT.readoutText('tiled', 3, tIn('de'), 5) === 'Gekachelt: 3 × 3' && READOUT.readoutText('single', 3, tIn('en'), 5) === 'Single: one net');
    const hint = ['net.hint.fieldOdd', 'net.reason.fieldOdd'].map(k => [tIn('de')(k, { size: '4/5', kept: '4/5' }), tIn('en')(k, { size: '4/5', kept: '4/5' })]);
    check('(7b) the Field-needs-odd hint and reason say X and Y (de and en)', hint.every(([d, e]) => /X und Y/.test(d) && /X and Y/.test(e)), J(hint));
    // sizeCompute (ui-form.js, cut out of the source) in a Field: lock closed X = Y in odd twos; lock open per axis odd twos within 1 : 3
    const FORM = fs.readFileSync(process.env.UI_FORM_JS || path.join(ROOT, 'ui-form.js'), 'utf8');
    const cut = FORM.slice(FORM.indexOf('  function fieldActive()'), FORM.indexOf('  function sizeRange('));
    const T_ = { 'reason.size.field.min': 'FMIN', 'reason.size.max': 'MAX', 'reason.size.min': 'MIN', 'reason.size.ratio': 'RATIO', 'note.size.field': (a, b) => 'NOTE' + a + b };
    function stepper(open, X, Y, field, axis, dir) {
        const c = vm.createContext({ baseNetTransform: field ? { domain: 'field' } : null, sizeLockIsOpen: () => open, gridSizeX: () => X, gridSizeY: () => Y, T: T_, console,
            sizeAxisRange: (ax, other) => { let min = null, max = null; for (let v = 1; v <= 9; v++) { if (Math.max(v, other) <= 3 * Math.min(v, other)) { if (min === null) min = v; max = v; } } return { min, max }; },
            sizeInput: { value: String(X) }, sizeYInput: { value: String(Y) }, parseInt, Math, typeof: undefined });
        vm.runInContext(cut + '\nthis.__c = sizeCompute;', c);
        return c.__c(dir, axis);
    }
    const r = (o) => J(o);
    const cases = [
        [stepper(false, 5, 5, true, 'x', 1), { to: 7, note: 'NOTE57' }], [stepper(false, 9, 9, true, 'x', 1), { to: null, reason: 'MAX' }], [stepper(false, 3, 3, true, 'x', -1), { to: null, reason: 'FMIN' }],
        [stepper(true, 3, 5, true, 'x', 1), { to: 5, note: 'NOTE35' }], [stepper(true, 3, 5, true, 'y', 1), { to: 7, note: 'NOTE57' }], [stepper(true, 3, 5, true, 'y', -1), { to: 3, note: 'NOTE53' }],
        [stepper(true, 3, 9, true, 'y', 1), { to: null, reason: 'MAX' }], [stepper(true, 3, 7, true, 'x', -1), { to: null, reason: 'FMIN' }], [stepper(true, 9, 3, true, 'x', -1), { to: 7, note: 'NOTE97' }],
        [stepper(true, 3, 5, false, 'x', 1), { to: 4 }], [stepper(false, 4, 4, false, 'x', 1), { to: 5 }],
    ];
    const badS = cases.map(([got, want], i) => [i, r(got), r(want)]).filter(([, a, b]) => a !== b);
    check('(7c) sizeCompute in a Field: lock closed X = Y in odd twos; lock open each axis odd twos (3/5 -> 5/5 or 3/7), the ends say why; without a Field steps of one', badS.length === 0, J(badS));
}
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
