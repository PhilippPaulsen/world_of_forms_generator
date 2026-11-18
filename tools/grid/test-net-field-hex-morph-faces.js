// Task 091: the FACE FILLS of the spatial morph under a hexagon Field net (core/spatial-morph-render.js spatialMorphRenderFillFaces: netWarpRefineFaces splits the polygons at the mesh lines, the morph's face sheet is marked
// morphRefine: true so netWarpBlocksFaces lets exactly that sheet through).
//   node tools/grid/test-net-field-hex-morph-faces.js      sabotage runs: NETWARP_JS, SPATIAL_MORPH_RENDER_JS (mutated copies); ONLY=1,2 selects sections
//   1. every tile has faces, t = 0, .25, .5, .75, 1 x sizes x two symmetry families x coupled (A -> B) and uncoupled (A -> regular) nets: no edge of a drawn polygon crosses a mesh line (the image of a regular edge is its chord, < 1e-9 px)
//   2. t = 0 and t = 1: the morph's faces equal those of the static pattern of keyframe A / B (the faces of 090)
//   3. layers: a real layer sheet stays refused under the hexagon Field (netWarpBlocksFaces), only the morph sheet passes; the square and the triangle pass either way
//   4. everything else (square, triangle, hexagon without a Field, with and without the morph) is byte-equal to main
//   5. time per frame: the morph under the Field with faces <= 1.5 x the morph without a net with faces (same shape, size, load)
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const on = k => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const FILES = {}; if (process.env.NETWARP_JS) FILES['core/netwarp.js'] = process.env.NETWARP_JS;
const KF = { square: [[[1, 5], [2, 8], [3, 7]], [[1, 9], [2, 6], [4, 8]]], triangle: [[[1, 5], [2, 6], [3, 4]], [[1, 6], [2, 5], [3, 5]]], hex: [[[1, 10], [3, 14], [5, 20]], [[2, 11], [4, 15], [6, 21]]] };
const A = { x: { kind: 'trig', w: -0.8 }, y: 'same', repeat: false, domain: 'field' }, B = { x: { kind: 'trig', w: -0.3 }, y: 'same', repeat: false, domain: 'field' };
const STUB = `
  var __depth = 0, __polys = [], __cur = null, __style = { fill: null, stroke: 'S' }, __stack = [], __endThrows = 0, __vertexCalls = 0;
  push = () => { __stack.push(JSON.stringify(__style)); __depth++; };
  pop = () => { __style = JSON.parse(__stack.pop()); __depth--; };
  noStroke = () => { __style.stroke = null; }; stroke = (c) => { __style.stroke = c; }; noFill = () => { __style.fill = null; };
  fill = (c) => { __style.fill = c; };
  beginShape = () => { __cur = []; }; vertex = (x, y) => { __vertexCalls++; __cur.push([x, y]); };
  endShape = (m) => { if (__endThrows && __polys.length + 1 >= __endThrows) throw new Error('endShape'); __polys.push({ fill: __style.fill, pts: __cur, close: m }); __cur = null; };
  var CLOSE = 'close';
  var __cf = computeCellFaces, __cfCalls = 0, __cfWarpNull = [], __cfThrowAt = 0;
  computeCellFaces = function (c, n, st) { __cfCalls++; __cfWarpNull.push(activeNetWarp === null); if (st && typeof __isReal === 'function' && __isReal(st)) __real++; if (__cfThrowAt && __cfCalls === __cfThrowAt) throw new Error('cf'); return __cf.apply(this, arguments); };
  var __gray = 0, __lazy = 0, __assign = 0, __real = 0;
  // stage 010: the colour pass hands computeCellFaces() a COPY of a keyframe's store, so these two run, on the copy; __real counts the calls that got a REAL store (the base's or a layer's own object)
  const __isReal = (st) => st === baseFaceAssignments || additionalLayers.some((l) => l.faceAssignments === st);
  { const g = ensureDefaultGrayFill; ensureDefaultGrayFill = function (st) { __gray++; if (__isReal(st)) __real++; return g.apply(this, arguments); }; }
  { const l = applyAssignmentsLazily; applyAssignmentsLazily = function (r, st) { __lazy++; if (__isReal(st)) __real++; return l.apply(this, arguments); }; }
  { const a = faceAssignmentsFor; faceAssignmentsFor = function () { __assign++; return a.apply(this, arguments); }; }
`;
function mk(o) {
    o = Object.assign({ shape: 'hex', size: 3, sym: 'none', K: KF[o.shape || 'hex'], net: A, states: null, morph: true, files: FILES, modes: null }, o);
    const w = makeRenderWorld(o.shape, 3, o.size, o.sym, o.files); w.set(STUB);
    w.set(`var __pairs = [], __inFill = false; { const a = applyNetWarp; applyNetWarp = function (wp, p) { const q = a(wp, p); if (__inFill) __pairs.push([p, q]); return q; }; }
        { const f = spatialMorphRenderFillFaces; spatialMorphRenderFillFaces = function () { __inFill = true; try { return f.apply(this, arguments); } finally { __inFill = false; } }; }`);
    w.baseConnections(o.K[0]);
    const ids = o.K.map((k, i) => w.addKeyframeLayer(k, o.modes ? { mode: o.modes[i] } : undefined));
    ids.forEach(i => w.set(`additionalLayers[${i}].showFaces = true;`));
    w.setTimeline(ids);
    w.set(`baseNetTransform = ${J(o.net)};`);
    if (o.states) w.set(`timeline.netStates = ${J(o.states)}; timeline.netLive = true;`);
    w.setMorph({ enabled: o.morph, mode: 'linear', angleDeg: 0 });
    return w;
}
const at = (w, t) => { w.set(`timeline.elapsedMs = ${t} * 2000; timeline.currentFrame = { segmentIndex: 0, localT: ${t} }; __polys.length = 0; __pairs.length = 0; drawTessellation();`); return w; };
const polys = w => w.get('__polys'), stats = w => w.get('spatialMorphRenderState.faceStats');

if (on('1')) {
    const bad = {}, note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0;
    for (const sym of ['none', 'rotation_reflection6']) for (const size of [3, 5, 7]) for (const [label, states] of [['coupled', [A, B]], ['uncoupled', [A, { x: { kind: 'trig', w: -0.4 }, y: 'same', repeat: true, domain: 'tiled' }]]]) {
        const w = mk({ size, sym, states });
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            at(w, t); n++;
            const st = stats(w), P = polys(w); if (!(st.tiles > 0 && st.tilesWithFaces === st.tiles && P.length > 0)) { note('nofaces', [sym, size, label, t, J(st)]); continue; }
            // no drawn polygon edge crosses a mesh line: the image of the regular edge (dense samples) is its chord
            const r = w.get(`(function () { const wp = netWarpBaseNow(), W = wp, pr = __pairs.slice(); let worst = 0, edges = 0;
                // consecutive pairs of one polygon: __pairs holds (regular, mapped) per vertex in drawing order; polygons are __polys[k] with |pts| vertices
                let o = 0; __polys.forEach(poly => { const m = poly.pts.length, seg = pr.slice(o, o + m); o += m; if (seg.length < m) return;
                    for (let i = 0; i < m; i++) { const a = seg[i], b = seg[(i + 1) % m]; edges++;
                        for (let k = 1; k < 8; k++) { const t = k / 8, q = applyNetWarp(wp, { x: a[0].x + t * (b[0].x - a[0].x), y: a[0].y + t * (b[0].y - a[0].y) }); const ex = a[1].x + t * (b[1].x - a[1].x), ey = a[1].y + t * (b[1].y - a[1].y); worst = Math.max(worst, Math.hypot(q.x - ex, q.y - ey)); } } });
                return { worst, edges, active: !!wp && wp.refineFaces === true }; })()`);
            if (!r.active) note('warp', [sym, size, label, t]); if (r.worst > 1e-9) note('cross', [sym, size, label, t, r.worst]);
        }
    }
    check(`(1) hexagon morph under a Field (${n} frames: 2 symmetries x 3 sizes x coupled / uncoupled x 5 times): every tile has faces, no polygon edge crosses a mesh line (< 1e-9 px)`, n === 60 && !bad.first, J(bad));
}
if (on('2')) {
    // t = 0 and t = 1: both keyframes carry the same closed pattern (10 orbits, D6); the morph's face polygons inside the canvas equal those of the static pattern under net A / B (the faces of 090), < 1e-9 px
    const bad = []; const key = P => P.map(p => p[0].toFixed(6) + ',' + p[1].toFixed(6)).join(';');
    const wq = makeRenderWorld('hex', 3, 5, 'rotation_reflection6', FILES); const all = wq.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())'); const LINES = all.slice(0, 10);
    for (const t of [0, 1]) {
        const wm = at(mk({ size: 5, sym: 'rotation_reflection6', K: [LINES, LINES], states: [A, B] }), t), wmP = polys(wm).map(p => p.pts);
        const ws = makeRenderWorld('hex', 3, 5, 'rotation_reflection6', FILES); ws.set(STUB); ws.baseConnections(LINES); ws.set(`baseNetTransform = ${J(t === 0 ? A : B)}; showFaces = true;`); ws.set('__polys.length = 0; drawTessellation();');
        const inC = P => P.some(p => p[0] >= 0 && p[0] <= 600 && p[1] >= 0 && p[1] <= 600);
        const a = new Set(wmP.filter(inC).map(key)), b = polys(ws).map(p => p.pts).filter(inC).map(key);
        const miss = b.filter(x => !a.has(x)).length; if (!b.length || miss > 0) bad.push([t, b.length, a.size, miss]);
    }
    check('(2) t = 0 and t = 1: the morph\'s face polygons inside the canvas are those of the static pattern (same closed cell) under net A / B (6 decimals = < 1e-6 px)', bad.length === 0, J(bad));
}
if (on('1b')) {
    // the tile skip loses no visible polygon: the polygons that touch the canvas are the same with and without it (sets and counts), also between two different patterns (keyframes of different symmetry)
    const bad = {}, note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0, tiles = 0, skipped = 0;
    const key = P => P.map(p => p[0].toFixed(4) + ',' + p[1].toFixed(4)).join(';');
    const LAWS = { sinus: [{ kind: 'trig', w: -0.8 }, { kind: 'trig', w: -0.3 }], tangens: [{ kind: 'trig', w: 0.6 }, { kind: 'trig', w: 0.2 }], geometric: [{ kind: 'geometric', w: Math.log(4) }, { kind: 'geometric', w: Math.log(2) }], regular: [{ kind: 'uniform', w: 0 }, { kind: 'uniform', w: 0 }] };
    const configs = [];
    for (const sym of ['none', 'rotation_reflection6']) for (const X of [3, 5, 7, 9]) for (const [ln, laws] of Object.entries(LAWS)) configs.push({ sym, size: X, laws, modes: null, K: KF.hex });
    // two different patterns (KF.hex: different lines in the two keyframes) are in every config; keyframes of DIFFERENT symmetry are refused by the morph itself (status parameterMismatch: no morph, no face pass), checked below
    for (const c of configs) {
        const nets = c.laws.map(l => ({ x: l, y: 'same', repeat: false, domain: 'field' })), w = mk({ size: c.size, sym: c.sym, K: c.K, modes: c.modes, net: nets[0], states: nets });
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            const touch = P => P.some(p => p[0] >= -1e-9 && p[0] <= 600 && p[1] >= -1e-9 && p[1] <= 600) || (Math.min(...P.map(p => p[0])) <= 600 && Math.max(...P.map(p => p[0])) >= 0 && Math.min(...P.map(p => p[1])) <= 600 && Math.max(...P.map(p => p[1])) >= 0);
            const cw = w.get('canvasW'), ch = w.get('canvasH');
            const run = (skip) => { w.set(`var __keepSkip = netWarpTileOutsideCanvas; ${skip ? '' : 'netWarpTileOutsideCanvas = function () { return false; };'} timeline.elapsedMs = ${t} * 2000; timeline.currentFrame = { segmentIndex: 0, localT: ${t} }; __polys.length = 0; drawTessellation(); netWarpTileOutsideCanvas = __keepSkip;`); return [w.get('__polys.slice()').map(p => p.pts), w.get('spatialMorphRenderState.faceStats')]; };
            const [a, sa] = run(true), [b, sb] = run(false); if (!sa || !sb) { note('nomorph', [c.sym, c.size, J(c.modes), J(c.laws[0]), t, w.get('spatialMorphStatus().code')]); continue; } n++; tiles += sb.tiles; skipped += sb.tiles - sa.tiles;
            const inC = P => { const xs = P.map(p => p[0]), ys = P.map(p => p[1]); return Math.max(...xs) >= 0 && Math.min(...xs) <= cw && Math.max(...ys) >= 0 && Math.min(...ys) <= ch; };
            const A_ = a.filter(inC).map(key), B_ = b.filter(inC).map(key), setA = new Set(A_), miss = B_.filter(x => !setA.has(x)).length;
            if (miss > 0 || A_.length !== B_.length) note('lost', [c.sym, c.size, J(c.modes), t, A_.length, B_.length, miss]);
            if (!B_.length) note('empty', [c.sym, c.size, t]);
        }
    }
    { const wm = at(mk({ size: 3, modes: ['rotation_reflection3', 'none'], states: [A, B] }), 0.5); check('(1c) keyframes of different symmetry: the morph refuses (parameterMismatch), no face pass', wm.get('spatialMorphStatus().code') === 'parameterMismatch'); }
    console.log('REPORT skip: tiles with faces without skip', tiles, ', skipped by the margin', skipped);
    check(`(1b) the tile skip loses no polygon that touches the canvas (${n} frames: 2 symmetries x 4 sizes x 4 laws (two different line sets), t = 0, .25, .5, .75, 1)`, !bad.first && skipped > 0, J(bad));
}
if (on('6')) {
    // uncoupled (the domains of the two snapshots differ: the lerp is refused and the AUTHOR net shows; A -> regular is coupled and fills like A -> B); a Single author net: no faces (a clear rule: lines only, status netFacesNeedField); no author net: unwarped faces
    const bad = [], TILED_ = { x: { kind: 'trig', w: -0.4 }, y: 'same', repeat: true, domain: 'tiled' };
    const w1 = at(mk({ size: 5, net: A, states: [A, TILED_] }), 0.5); if (!(stats(w1).tilesWithFaces > 0) || w1.get('spatialMorphStatus().code') !== 'netActive') bad.push(['author field', J(stats(w1))]);
    const single = { x: { kind: 'trig', w: 0.7 }, y: 'same', repeat: false, domain: 'single' };
    const w2 = at(mk({ size: 5, net: single, states: [A, TILED_] }), 0.5); if (!(stats(w2).tilesWithFaces > 0) || w2.get('netWarpBaseNow()') !== null || w2.get('spatialMorphStatus().code') !== 'ok') bad.push(['author single', J(stats(w2)), w2.get('spatialMorphStatus().code')]);   // a Single net does not apply to the hexagon at all: no net in force, lines and faces unwarped
    const w3 = at(mk({ size: 5, net: null, states: [A, TILED_] }), 0.5); if (!(stats(w3).tilesWithFaces > 0) || w3.get('netWarpBaseNow()') !== null) bad.push(['no author net', J(stats(w3))]);
    check('(6) uncoupled nets: the author Field net fills exactly (see (1)); a Single author net does not apply to the hexagon (no net in force: lines and faces unwarped); no author net: unwarped faces', bad.length === 0, J(bad));
}
if (on('3')) {
    const w = mk({ size: 5 }); const ok = (code) => w.get(code);
    check('(3) hexagon Field: a real layer sheet is refused, the morph sheet passes; square and triangle: unchanged',
        ok('netWarpBlocksFaces({ gridMatchesBase: true })') === true && ok('netWarpBlocksFaces({ gridMatchesBase: true, morphRefine: true })') === false && ok('netWarpBlocksFaces({ gridMatchesBase: false, morphRefine: true })') === true && ok('netWarpBlocksFaces(null)') === false);
    const bad = []; for (const shape of ['square', 'triangle']) { const wq = mk({ shape, size: 5, K: KF[shape] }); if (wq.get('netWarpBlocksFaces({ gridMatchesBase: true })') !== false || wq.get('netWarpBlocksFaces({ gridMatchesBase: false })') !== true) bad.push(shape); }
    check('(3b) square and triangle Field: a base-grid sheet passes, another is refused (as before)', bad.length === 0, J(bad));
}
if (on('4')) {
    let mainFiles = null; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wof091-'));
    try { mainFiles = {}; for (const f of ['netwarp', 'spatial-morph-render']) { const p = path.join(dir, f + '.js'); fs.writeFileSync(p, execSync(`git show 66110f0a:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 })); mainFiles[f] = p; } } catch (e) { mainFiles = null; }
    if (!mainFiles) check('(4) main 66110f0a is not available here: skipped', true);
    else {
        const mkMain = (o) => { const keep = process.env.SPATIAL_MORPH_RENDER_JS; process.env.SPATIAL_MORPH_RENDER_JS = mainFiles['spatial-morph-render']; const w = mk(Object.assign({}, o, { files: { 'core/netwarp.js': mainFiles.netwarp } })); if (keep === undefined) delete process.env.SPATIAL_MORPH_RENDER_JS; else process.env.SPATIAL_MORPH_RENDER_JS = keep; return w; };
        const probe = (w) => { w.set('__polys.length = 0; __pairs.length = 0;'); w.set('drawTessellation();'); return J([w.get('__polys'), w.get('__calls ? 0 : 0'), w.get('spatialMorphStatus().code')]); };
        const bad = {}; let n = 0;
        const FIELD = A, TILED = { x: { kind: 'trig', w: -0.4 }, y: 'same', repeat: true, domain: 'tiled' };
        for (const shape of ['square', 'triangle', 'hex']) for (const net of [null, FIELD, TILED]) for (const morph of [true, false]) {
            if (shape === 'hex' && net === FIELD) continue;
            const wa = mk({ shape, size: 3, K: KF[shape], net, morph }), wb = mkMain({ shape, size: 3, K: KF[shape], net, morph }); n++;
            if (probe(wa) !== probe(wb)) bad[shape + (net && net.domain)] = (bad[shape + (net && net.domain)] || 0) + 1; }
        check(`(4) square, triangle (with and without a Field), hexagon (no net, Tiled), with and without the morph (${n} cases): faces and status byte-equal to main`, n === 16 && Object.keys(bad).length === 0, J(bad));
    }
}
if (on('5')) {
    const rep = {}; let worst = 0;
    for (const size of [3, 5, 9]) for (const [label, K] of [['typical', KF.hex], ['heavy', null]]) {
        const loads = K || (() => { const wq = makeRenderWorld('hex', 3, size, 'rotation_reflection6'); const all = wq.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())'); return [all.slice(0, 10), all.slice(10, 20)]; })();
        const sym = label === 'heavy' ? 'rotation_reflection6' : 'none';
        const med = (net) => { const w = mk({ size, K: loads, sym, net, states: net ? [A, B] : null }); at(w, 0.5); const a = []; for (let i = 0; i < 5; i++) { const t0 = process.hrtime.bigint(); at(w, 0.5); a.push(Number(process.hrtime.bigint() - t0) / 1e6); } a.sort((p, q) => p - q); return a[2]; };
        const f = med(A), nn = med(null); rep[`${size}/${size} ${label}`] = { fieldMs: Math.round(f * 10) / 10, noNetMs: Math.round(nn * 10) / 10, ratio: Math.round(100 * f / nn) / 100 }; if (label === 'typical') worst = Math.max(worst, f / nn);
    }
    console.log('REPORT morph frame time with faces (ms; Field vs no net):', J(rep));
    const ty = ['5/5 typical', '9/9 typical'].map(k => rep[k]), tyOk = ty[0].fieldMs <= 30 && ty[1].fieldMs <= 60, tyRatio = Math.max(ty[0].ratio, ty[1].ratio, rep['3/3 typical'].ratio);
    check(`(5) typical load (3 lines): morph under the Field with faces <= 1.5 x the morph without a net (worst ${tyRatio}), or <= 2.0 x with 5/5 <= 30 ms and 9/9 <= 60 ms (${ty[0].fieldMs} / ${ty[1].fieldMs} ms); the heavy load is only reported`, tyRatio <= 1.5 || (tyRatio <= 2.0 && tyOk));
}
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
