// Task 073: what survives a change of the base size ("Größe", #shape-size-input, shapeSizeFactor). A measurement only: it reads the real core files through
// tools/morph/render-harness.js (the template of tools/grid/measure-g5a.js) and changes nothing.
//   node tools/grid/measure-size-change.js            -> JSON summary on stdout (per section A..K, see the report reports/073.md)
// Sections: T (what rebuildGrid() clears), A (ids, u/v, line pairs), B (x/y of the nodes: affine fit new = s*old + t), C (names), D (free endpoints),
// E (face keys), F (layers), G (timeline / morph frames), H (net), J (alt net), K (canvas coverage).
'use strict';
const path = require('path');
const H = require(path.join(__dirname, '..', 'morph', 'render-harness.js'));
const S = require(path.join(__dirname, '..', 'session', 'scenarios.js'));
const J = JSON.stringify;
const SHAPES = ['triangle', 'square', 'hex'];
const SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const ORD = [1, 2, 3, 4, 5, 6];
const LAGEN = [1, 2];
const MODE = 'rotation_reflection6';
const C0 = { x: 300, y: 300 };
const out = {};
const worlds = {};
const W = (shape) => worlds[shape] || (worlds[shape] = H.makeRenderWorld(shape, 3, 3, MODE));
const setGrid = (w, shape, ord, lage, size) => w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: ord, lage })}); shapeSizeFactor = ${size}; symmetryMode = ${J(MODE)}; connections = []; baseNetTransform = null; additionalLayers = []; timeline = null; rebuildGrid(currentShape);`);
const snapGrid = (w) => J(w.get('({ nodes, centroid, outerCorners })'));
const gridOf = (w, shape, ord, lage, size) => { setGrid(w, shape, ord, lage, size); return JSON.parse(snapGrid(w)); };
const gridNumbered = (w, shape, ord, lage, size) => JSON.parse(J(w.get(`buildGrid(${J({ shape, ordnung: ord, lage })}, { sizeFactor: ${size}, canvasW: 600, canvasH: 600 }, { numbered: true })`)));
const max = (a, b) => (b > a ? b : a);
const f6 = (x) => Math.round(x * 1e6) / 1e6;

// least squares new = s * old + t for one axis
function fit1(oldV, newV) {
    const n = oldV.length, mo = oldV.reduce((a, b) => a + b, 0) / n, mn = newV.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0; for (let i = 0; i < n; i++) { num += (oldV[i] - mo) * (newV[i] - mn); den += (oldV[i] - mo) ** 2; }
    const s = den ? num / den : 1, t = mn - s * mo, res = Math.max(...oldV.map((v, i) => Math.abs(s * v + t - newV[i])));
    return { s, t, res };
}
function affine(gOld, gNew) {
    const ox = gOld.nodes.map((n) => n.x), oy = gOld.nodes.map((n) => n.y), nx = gNew.nodes.map((n) => n.x), ny = gNew.nodes.map((n) => n.y);
    const X = fit1(ox, nx), Y = fit1(oy, ny);
    return { sx: X.s, sy: Y.s, tx: X.t, ty: Y.t, res: Math.max(X.res, Y.res) };
}
const apply = (A, p) => ({ x: A.sx * p.x + A.tx, y: A.sy * p.y + A.ty });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const segKey = (s) => { const r = (v) => Math.round(v * 10); const a = [r(s.x1), r(s.y1)], b = [r(s.x2), r(s.y2)]; return (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a]).join(';'); };
const inside = (s, m) => [s.x1, s.y1, s.x2, s.y2].every((v) => v >= -m && v <= 600 + m);
// the mapped old frame, clipped to the canvas, against the new frame: { inside, found }
function frameMatch(oldSegs, newSegs, A) {
    const set = new Set(newSegs.map(segKey));
    let n = 0, f = 0;
    for (const s of oldSegs) { const p = apply(A, { x: s.x1, y: s.y1 }), q = apply(A, { x: s.x2, y: s.y2 }), m = { x1: p.x, y1: p.y, x2: q.x, y2: q.y }; if (!inside(m, 0)) continue; n++; if (set.has(segKey(m))) f++; }
    return { inside: n, found: f };
}
function pointInPoly(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { if ((poly[i].y > p.y) !== (poly[j].y > p.y) && p.x < ((poly[j].x - poly[i].x) * (p.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) c = !c; } return c; }

// ---- T: what rebuildGrid() clears (the handler of #shape-size-input is: shapeSizeFactor = v; rebuildGrid(currentShape); then UI refresh) -------------------------------------------
{
    const w = W('square'); setGrid(w, 'square', 3, 1, 3);
    S.addLayer(w.ctx, { shape: 'square', order: 3, size: 3, offsetX: 30, offsetY: -30, rotation: 17, free: [14.5, 99.25], connections: [[1, 2]] });
    w.set(`connections = [[1, 2], [2, 3]]; redoStack = [[[1, 3]]]; baseFaceAssignments.set('k', 1); baseFacePalette = { ruleId: 'x' }; baseFaceAnchor = { hueIndex: 1, registerIndex: 2 }; baseLastHarmonyType = 'x'; baseLastSelection = [1]; baseDistributionStrategy = 'area';
        baseNetTransform = { x: { kind: 'trig', w: -1 }, y: 'same', domain: 'field' }; baseNetAnimation = { from: null }; altNetSeed = { p: { x: 1, y: 2 }, q: { x: 3, y: 4 }, side: 1, n: 4 }; nodes.push({ id: 99, x: 11.5, y: 12.5, free: true });
        activeLayer = 0; timeline = { keyframeLayerIds: [0], playbackLayerIndex: null }; symmetryMode = 'rotation3'; freeEndpointsEnabled = true; showFaces = true; spatialMorph = { enabled: true, mode: 'linear', angleDeg: 0 }; shapeSizeFactor = 7;`);
    const names = ['connections', 'redoStack', 'additionalLayers', 'timeline', 'baseFaceAssignments.size', 'baseFacePalette', 'baseFaceAnchor', 'baseLastHarmonyType', 'baseLastSelection', 'baseDistributionStrategy', 'baseNetTransform', 'baseNetAnimation', 'altNetSeed',
        'nodes.filter(n => n.free).length', 'activeLayer', 'symmetryMode', 'freeEndpointsEnabled', 'showFaces', 'spatialMorph.enabled', 'gridSpec', 'gridRevision'];
    const before = {}; names.forEach((n) => { before[n] = w.get(`JSON.stringify(${n})`); });
    w.set('rebuildGrid(currentShape);');
    const t = {}; names.forEach((n) => { const a = w.get(`JSON.stringify(${n})`); t[n] = a === before[n] ? 'kept' : 'changed ' + before[n].slice(0, 28) + ' -> ' + String(a).slice(0, 28); });
    out.T = t;
    w.set("spatialMorph = { enabled: false, mode: 'linear', angleDeg: 0 }; freeEndpointsEnabled = false; showFaces = false; altNetSeed = null; baseNetAnimation = null; redoStack = [];");
}

// ---- A, B, C, D: per shape x ordnung x lage over all size pairs ------------------------------------------------------------------------------------------------------------------
const AB = {}; const grids = {};
for (const shape of SHAPES) {
    const w = W(shape);
    const a = { orbitListDiffAcrossSizes: 0, orbitCases: 0, cases: 0, idDiff: 0, uvDiff: 0, nodeCountDiff: 0, nameDiff: 0, nameNull: 0, nameTotal: 0 };
    const b = { pairs: 0, maxRes: 0, maxSxSy: 0, maxSdev: 0, fixDevCanvas: 0, fixDevCentroidOld: 0, centroidMapRes: 0, cornerMapRes: 0, translateOnly: 0 };
    const d = { n: 0, maxShiftMeshNew: 0, outsideAfterKeep: 0, insideBefore: 0 };
    for (const lage of LAGEN) for (const ord of ORD) {
        const per = {};
        for (const size of SIZES) { try { per[size] = gridNumbered(w, shape, ord, lage, size); } catch (e) { per[size] = null; } }
        if (!SIZES.every((s) => per[s])) continue;
        grids[[shape, ord, lage].join('/')] = per;
        const ref = per[5]; a.cases++;
        const conns = []; const N = Math.min(ref.nodes.length, 9); for (let i = 1; i < N; i++) conns.push([1, i + 1], [i, i + 1]);
        const names = new Set(); const spec = { shape, ordnung: ord, lage };
        for (const size of SIZES) {
            const g = per[size];
            if (g.nodes.length !== ref.nodes.length) a.nodeCountDiff++;
            if (g.nodes.some((n, i) => n.id !== ref.nodes[i].id)) a.idDiff++;
            if (g.nodes.some((n, i) => n.u !== ref.nodes[i].u || n.v !== ref.nodes[i].v)) a.uvDiff++;
            setGrid(w, shape, ord, lage, size);
            const nm = w.get(`(function () { const r = gridDisplayNameFor(${J(spec)}, ${J(conns)}, ${J(MODE)}); return r ? r.ascii : null; })()`);
            a.nameTotal++; if (nm === null) a.nameNull++; names.add(nm);
        }
        if (names.size > 1) a.nameDiff++;
        if (ord <= 4) { a.orbitCases++; const ol = new Set(); for (const size of SIZES) { setGrid(w, shape, ord, lage, size); ol.add(J(w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs)'))); } if (ol.size > 1) a.orbitListDiffAcrossSizes++; }
        for (const s0 of SIZES) for (const s1 of SIZES) {
            if (s0 === s1) continue;
            const g0 = per[s0], g1 = per[s1], A = affine(g0, g1); b.pairs++;
            b.maxRes = max(b.maxRes, A.res); b.maxSxSy = max(b.maxSxSy, Math.abs(A.sx - A.sy)); b.maxSdev = max(b.maxSdev, Math.abs(A.sx - s0 / s1));
            const P = { x: A.tx / (1 - A.sx), y: A.ty / (1 - A.sy) };
            b.fixDevCanvas = max(b.fixDevCanvas, dist(P, C0)); b.fixDevCentroidOld = max(b.fixDevCentroidOld, dist(P, g0.centroid));
            b.centroidMapRes = max(b.centroidMapRes, dist(apply(A, g0.centroid), g1.centroid));
            b.cornerMapRes = max(b.cornerMapRes, ...g0.outerCorners.map((c, i) => dist(apply(A, c), g1.outerCorners[i])));
            // D: a free endpoint at 0.37 of the way from the centroid to corner 0 (old size); kept in px vs scaled with the pattern
            const p0 = { x: g0.centroid.x + 0.37 * (g0.outerCorners[0].x - g0.centroid.x), y: g0.centroid.y + 0.37 * (g0.outerCorners[0].y - g0.centroid.y) };
            const scaled = apply(A, p0), mesh = dist(g1.nodes[0], g1.nodes[1]) || 1;
            d.n++; d.maxShiftMeshNew = max(d.maxShiftMeshNew, dist(p0, scaled) / mesh);
            if (pointInPoly(p0, g0.outerCorners)) { d.insideBefore++; if (!pointInPoly(p0, g1.outerCorners)) d.outsideAfterKeep++; }
        }
    }
    AB[shape] = { a, b: Object.fromEntries(Object.entries(b).map(([k, v]) => [k, typeof v === 'number' ? f6(v) : v])), d: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, f6(v)])) };
}
out.A_B_C_D = AB;

// ---- E: face keys (faceTrailKey) at ordnung 2..4, both lagen, over all size pairs; unscaled vs scaled-by-the-fit coordinates ----------------------------------------------------
{
    const E = {};
    for (const shape of SHAPES) {
        const w = W(shape); let pairs = 0, facesTot = 0, noFaces = 0, sameKeyRaw = 0, sameKeyScaled = 0, cmp = 0, nearMiss = 0, idMissing = 0, idConflict = 0;
        const near = (a, b) => { const A = a.split(';'), B = b.split(';'); return A.length === B.length && A.every((q, i) => { const u = q.split(',').map(Number), v = B[i].split(',').map(Number); return Math.abs(u[0] - v[0]) <= 1 && Math.abs(u[1] - v[1]) <= 1; }); };
        for (const lage of LAGEN) for (const ord of [2, 3, 4]) {
            const per = grids[[shape, ord, lage].join('/')]; if (!per) continue;
            const R = {};
            setGrid(w, shape, ord, lage, 5); const refConns = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 4)');
            for (const size of SIZES) {
                setGrid(w, shape, ord, lage, size);
                const conns = refConns; w.set(`connections = ${J(conns)};`);
                const res = w.get('(function () { const r = computeCellFaces(connections, nodes, null); return { faces: r.faces.map(f => ({ nodeIds: f.nodeIds })), nodes: r.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })) }; })()');
                const keys = w.get(`(function () { const r = ${J(res)}; const g = getGroupElementsCached(nodes, centroid, currentShape, symmetryMode, outerCorners); return computeFaceTrailKeys(r, g); })()`);
                R[size] = { res, keys, conns };
            }
            for (const s0 of SIZES) for (const s1 of SIZES) {
                if (s0 === s1) continue;
                const A = affine(per[s0], per[s1]); pairs++;
                const o = R[s0], nw = R[s1]; if (!o.res.faces.length) { noFaces++; continue; }
                facesTot += o.res.faces.length;
                const mapped = { faces: o.res.faces, nodes: o.res.nodes.map((n) => Object.assign({ id: n.id }, apply(A, n))) };
                setGrid(w, shape, ord, lage, s1);
                const sk = w.get(`(function () { const g = getGroupElementsCached(nodes, centroid, currentShape, symmetryMode, outerCorners); return computeFaceTrailKeys(${J(mapped)}, g); })()`);
                // faces are compared as a multiset of keys (the vertex order of a face list can differ with the geometry)
                const cnt = new Map(); nw.keys.forEach((k) => cnt.set(k, (cnt.get(k) || 0) + 1));
                const rawSet = new Set(nw.keys), restOld = [];
                o.keys.forEach((k) => { cmp++; if (rawSet.has(k)) sameKeyRaw++; });
                sk.forEach((k) => { if (cnt.get(k) > 0) { cnt.set(k, cnt.get(k) - 1); sameKeyScaled++; } else restOld.push(k); });
                const restNew = []; cnt.forEach((c, k) => { for (let i = 0; i < c; i++) restNew.push(k); });
                // re-keying by face identity (the sorted node ids of the face, size-free): old key -> new key must be a function, and the face sets must be the same
                const idOf = (f) => f.nodeIds.slice().sort((x, y) => x - y).join(','), newById = new Map(nw.res.faces.map((f, i) => [idOf(f), nw.keys[i]])), m = new Map(); let bad = false;
                o.res.faces.forEach((f, i) => { const nk = newById.get(idOf(f)); if (nk === undefined) { idMissing++; return; } if (m.has(o.keys[i]) && m.get(o.keys[i]) !== nk) bad = true; m.set(o.keys[i], nk); });
                if (bad) idConflict++;
                restOld.forEach((k) => { const i = restNew.findIndex((q) => near(k, q)); if (i >= 0) { restNew.splice(i, 1); nearMiss++; } });
            }
        }
        E[shape] = { sizePairs: pairs, noFacePairs: noFaces, keysCompared: cmp, equalWithoutRescale: sameKeyRaw, equalAfterRescale: sameKeyScaled, offByOneUnitOnly: nearMiss, rekeyByIds_facesWithoutCounterpart: idMissing, rekeyByIds_pairsWithConflict: idConflict };
    }
    out.E = E;
}

// ---- F: layers (same shape, other shape, lage 2): does the layer geometry depend on the base size? exact scaling? integer layer sizes after a base size change? -------------------
{
    const F = {};
    for (const shape of SHAPES) {
        const w = W(shape); const r = { sameShape: { maxAbsLayerChangeWhenBaseChangesAndLKept: 0, maxResidualScaledL: 0 }, otherShapeCentroidShiftNote: null, lage2MaxRes: 0, integerLayerSizes: {} };
        for (const [a, b] of [[2, 4], [3, 6], [4, 2], [6, 3], [3, 5], [5, 3], [1, 9], [9, 1]]) {
            setGrid(w, shape, 2, 1, a); const base0 = w.get('({ oc: outerCorners, c: centroid })');
            const Ab = affine(gridOf(w, shape, 2, 1, a), gridOf(w, shape, 2, 1, b));
            const baseOld = gridOf(w, shape, 2, 1, a), baseNew = gridOf(w, shape, 2, 1, b);
            let keepOK = 0;
            for (let L = 1; L <= 9; L++) {
                const lay = (base, sizeBase, Ls) => JSON.parse(J(w.get(`layerGrid(${J(base.outerCorners)}, ${J(base.centroid)}, ${J(shape)}, ${sizeBase}, ${Ls}, nodeCount, ${J(shape)}, 600, 600)`)));
                const l0 = lay(baseOld, a, L), lKept = lay(baseNew, b, L), lScaled = lay(baseNew, b, (L * b) / a);
                r.sameShape.maxAbsLayerChangeWhenBaseChangesAndLKept = max(r.sameShape.maxAbsLayerChangeWhenBaseChangesAndLKept, ...l0.outerCorners.map((c, i) => dist(c, lKept.outerCorners[i])));
                r.sameShape.maxResidualScaledL = max(r.sameShape.maxResidualScaledL, ...l0.outerCorners.map((c, i) => dist(apply(Ab, c), lScaled.outerCorners[i])));
                const Ls = (L * b) / a; if (Number.isInteger(Ls) && Ls >= 1 && Ls <= 9) keepOK++;
            }
            r.integerLayerSizes[`${a}->${b}`] = keepOK + '/9';
        }
        // other-shape layer (built from the canvas and the base centroid): independent of the base size except for the centroid
        const other = SHAPES.find((s) => s !== shape);
        const cen = (a) => gridOf(w, shape, 2, 1, a).centroid;
        const ob = (a) => JSON.parse(J(w.get(`layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, 3, 3, ${J(other)}, 600, 600)`)));
        setGrid(w, shape, 2, 1, 3); const o3 = ob(3); setGrid(w, shape, 2, 1, 6); const o6 = ob(6);
        r.otherShapeCentroidShiftNote = { layerShape: other, maxCornerDiffPxL3BaseChanged3to6: f6(Math.max(...o3.outerCorners.map((c, i) => dist(c, o6.outerCorners[i])))), centroid3: cen(3), centroid6: cen(6) };
        // lage 2 layer: scaling exact?
        for (const [a, b] of [[2, 4], [3, 6]]) {
            const spec = { shape, ordnung: 2, lage: 2 };
            const bo = gridOf(w, shape, 2, 2, a), bn = gridOf(w, shape, 2, 2, b), Ab = affine(bo, bn);
            const g = (base, sb, Ls) => JSON.parse(J(w.get(`layerGridForSpec(${J(base.outerCorners)}, ${J(base.centroid)}, ${J(shape)}, ${sb}, ${Ls}, ${J(spec)}, ${J(shape)}, 600, 600)`)));
            const l0 = g(bo, a, a), l1 = g(bn, b, b);
            r.lage2MaxRes = max(r.lage2MaxRes, ...l0.nodes.map((n, i) => dist(apply(Ab, n), l1.nodes[i])));
        }
        r.sameShape.maxAbsLayerChangeWhenBaseChangesAndLKept = f6(r.sameShape.maxAbsLayerChangeWhenBaseChangesAndLKept);
        r.sameShape.maxResidualScaledL = f6(r.sameShape.maxResidualScaledL); r.lage2MaxRes = f6(r.lage2MaxRes);
        F[shape] = r;
    }
    out.F = F;
}

// ---- F2/G/I: frames. A layer with offset + rotation, a keyframe timeline at t = .5 with the spatial morph on; the old frame mapped by the fit against the new frame --------------------
{
    const G = {};
    for (const shape of SHAPES) {
        const w = W(shape); const rec = {};
        for (const [a, b] of [[2, 4], [3, 6], [4, 2], [6, 3], [3, 5]]) {
            // base only
            setGrid(w, shape, 2, 1, a); w.set('connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 3);');
            const conns = w.get('connections'); const g0 = JSON.parse(snapGrid(w)); const f0 = w.frame();
            setGrid(w, shape, 2, 1, b); w.set(`connections = ${J(conns)};`); const g1 = JSON.parse(snapGrid(w)); const f1 = w.frame(); const A = affine(g0, g1);
            const base = frameMatch(f0, f1, A);
            // base + layer (L = a, rides the base loop, then L' = b) with offset and rotation, offsets scaled by a/b
            const ox = 30, oy = -18, rot = 17, mkLayer = (size, o, Ls) => { S.addLayer(w.ctx, { shape, order: w.get('nodeCount'), size: Ls, offsetX: o[0], offsetY: o[1], rotation: rot, connections: [conns[0]], mode: MODE }); };
            setGrid(w, shape, 2, 1, a); w.set(`connections = ${J(conns)};`); mkLayer(a, [ox, oy], a); const fl0 = w.frame();
            setGrid(w, shape, 2, 1, b); w.set(`connections = ${J(conns)};`); mkLayer(b, [ox * (a / b), oy * (a / b)], b); const fl1 = w.frame();
            const lay = frameMatch(fl0, fl1, A);
            setGrid(w, shape, 2, 1, b); w.set(`connections = ${J(conns)};`); mkLayer(b, [ox, oy], b); const fl2 = w.frame();   // offset NOT scaled
            const layNoScale = frameMatch(fl0, fl2, A);
            // keyframe timeline, t = .5, spatial morph on
            const morph = (size) => { setGrid(w, shape, 2, 1, size); const k1 = w.addKeyframeLayer([conns[0]]), k2 = w.addKeyframeLayer([conns[1] || conns[0]]); w.setTimeline([k1, k2]); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); w.set('timeline.elapsedMs = 1000;'); const fr = w.drawn().filter((c) => c[0] === 'line').map((c) => ({ x1: c[1], y1: c[2], x2: c[3], y2: c[4] })); w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 }); return fr; };
            const m0 = morph(a), m1 = morph(b); const mm = frameMatch(m0, m1, A);
            rec[`${a}->${b}`] = { base: `${base.found}/${base.inside}`, layerOffsetScaled: `${lay.found}/${lay.inside}`, layerOffsetNotScaled: `${layNoScale.found}/${layNoScale.inside}`, morphT05: `${mm.found}/${mm.inside}` };
        }
        G[shape] = rec;
    }
    out.F2_G_I = G;
}

// ---- H: net (square only): frame match with a net spec, domain single / tiled / field; Field validity per size -------------------------------------------------------------------
{
    const Hh = { fieldValidity: {}, frames: {}, linesTiledSingle: {} };
    for (let R = 1; R <= 9; R++) { const e = W('square').get(`netDomainEffective({ domain: 'field' }, ${R})`); Hh.fieldValidity[R] = e.ignored ? 'ignored: ' + e.ignored.reason.slice(0, 40) : 'field'; }
    const w = W('square');
    for (const dom of ['single', 'tiled', 'field']) {
        const rec = {};
        for (const [a, b] of [[3, 5], [3, 6], [4, 6], [5, 7], [5, 3], [2, 4]]) {
            const spec = { x: { kind: 'trig', w: -1 }, y: 'same', repeat: dom === 'tiled', domain: dom === 'field' ? 'field' : undefined };
            const mk = (size) => { setGrid(w, 'square', 3, 1, size); w.set(`connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 3); baseNetTransform = ${J(spec)};`); const g = JSON.parse(snapGrid(w)); const eff = w.get(`netDomainEffective(baseNetTransform, shapeSizeFactor)`); return { g, f: w.frame(), eff: eff.domain + (eff.ignored ? '(ignored)' : '') }; };
            const o = mk(a), n = mk(b), A = affine(o.g, n.g), m = frameMatch(o.f, n.f, A);
            rec[`${a}->${b}`] = `${m.found}/${m.inside} [${o.eff} -> ${n.eff}]`;
        }
        Hh.frames[dom] = rec;
    }
    w.set('baseNetTransform = null;');
    out.H = Hh;
}

// ---- J: alt net and alignLayerToBase ------------------------------------------------------------------------------------------------------------------------------------------------
{
    const w = W('square'); setGrid(w, 'square', 3, 1, 4);
    const P = { x: 220, y: 260 }, Q = { x: 330, y: 250 };
    w.set(`rebuildGridFromConstruction(${J(P)}, ${J(Q)}, 4, 1);`);
    const alt0 = JSON.parse(snapGrid(w)); const seed = w.get('altNetSeed');
    const s = 0.5, T = (p) => ({ x: C0.x + (p.x - C0.x) * s, y: C0.y + (p.y - C0.y) * s });
    w.set(`rebuildGridFromConstruction(${J(T(P))}, ${J(T(Q))}, 4, 1);`);
    const alt1 = JSON.parse(snapGrid(w));
    const res = Math.max(...alt0.nodes.map((n, i) => dist({ x: C0.x + (n.x - C0.x) * s, y: C0.y + (n.y - C0.y) * s }, alt1.nodes[i])));
    w.set('shapeSizeFactor = 5; rebuildGrid(currentShape);');
    const al = { seedKept: w.get('altNetSeed'), seedBefore: seed, scaledSeedMaxResidualPx: f6(res), nodesAfterSizeChangeAreStandardGrid: J(JSON.parse(snapGrid(w)).nodes) === J(gridOf(w, 'square', 3, 1, 5).nodes) };
    // alignLayerToBase: invariant under a common scaling of the two sizes? (the exact condition vs the same pair multiplied by the ratio)
    const aligns = { checked: 0, aligned: 0, invariantUnderCommonScale: 0 };
    for (const shape of SHAPES) for (let n = 2; n <= 5; n++) for (let a = 1; a <= 9; a++) for (let L = 1; L <= 9; L++) for (let m = 2; m <= 6; m++) {
        const c0 = w.get(`_alignmentConditionMet(${a}, ${n}, ${L}, ${m}, ${J(shape)})`); aligns.checked++; if (!c0) continue; aligns.aligned++;
        const b = a === 9 ? 3 : a * 2 <= 9 ? a * 2 : a, ratio = b / a; if (b === a || w.get(`_alignmentConditionMet(${b}, ${n}, ${L * ratio}, ${m}, ${J(shape)})`)) aligns.invariantUnderCommonScale++;
    }
    out.J = { altNet: al, alignLayerToBase: aligns };
}

// ---- K: canvas: how many segments, how many leave the canvas, extent beyond it, per size (ordnung 2, lage 1, three orbit lines) -------------------------------------------------------
{
    const K = {};
    for (const shape of SHAPES) {
        const w = W(shape); const rec = {};
        for (const size of SIZES) {
            setGrid(w, shape, 2, 1, size); w.set('connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 3);');
            const f = w.frame(); const out600 = f.filter((s) => !inside(s, 0)).length;
            const xs = f.flatMap((s) => [s.x1, s.x2]), ys = f.flatMap((s) => [s.y1, s.y2]);
            rec[size] = `${f.length} seg, ${out600} touch outside, x ${Math.round(Math.min(...xs))}..${Math.round(Math.max(...xs))}`;
        }
        K[shape] = rec;
    }
    out.K = K;
}

process.stdout.write(J(out, null, 1) + '\n');
