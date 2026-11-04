// Morph stage e1: the WRITE and READ access of the spatial morph block (window.setSpatialMorph / getSpatialMorph in sketch.js) and the SEAM-OPEN field of the status (spatialMorphStatus().seamOpen).
//   1. setSpatialMorph / getSpatialMorph, cut out of the REAL sketch.js and run in a vm with the real core files: partial patches merge, invalid values normalise, redraw() only on a change, never throws, touches
//      neither the timeline nor a layer, the getter returns a copy, the block survives the real build / validate / apply session functions.
//   2. spatialMorphSeamOpen (the pure function, core/spatial-morph.js) and the render module's use of it: the verdict equals an INDEPENDENT full-frame oracle (tools/morph/seam-data.js frameSeamOpen: the keyframe
//      drawn alone, its boundary endpoints of inner tiles looked up for a partner of another tile copy), for corpus, hand-built and closed-deformation patterns; the status shape; null when not evaluated; the cache
//      (a redraw loop and the playback at 60 frames compute it once, changed content / symmetry mode recompute); the check changes no frame; the cost.
//   3. source pins: sketch.js got the two functions and nothing else that matters here (the eight protected functions are byte-identical to bb03942c, pinned by sha256), no hotkey, no listener.
//   node tools/morph/test-spatial-morph-write.js
//   SPATIAL_MORPH_JS / SPATIAL_MORPH_RENDER_JS=/path/to/mutated/file.js node tools/morph/test-spatial-morph-write.js        (sabotage runs; SKETCH_JS the same for sketch.js)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const D = require('./seam-data.js');
const { makeRenderWorld } = D;
const F = require('../session/fixtures.js');
const S = require('../session/scenarios.js');
const M = D.M;
const ROOT = path.join(__dirname, '..', '..');
const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 400)); } };
const J = (x) => JSON.stringify(x);
const same = (a, b) => J(a) === J(b);
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const hashOf = (x) => sha(J(x)).slice(0, 16);

// ================= 1. setSpatialMorph / getSpatialMorph =================
console.log('== 1. setSpatialMorph / getSpatialMorph (cut out of sketch.js) ==');
const cut = (name) => { const m = SKETCH.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); return m ? m[0] : null; };
const SRC_SET = cut('setSpatialMorph'), SRC_GET = cut('getSpatialMorph');
// a small world: the real helpers, a block, a redraw counter, sentinels for the timeline and the layers
function mkSandbox() {
  const sb = { redraws: 0, redraw() { sb.redraws++; }, timeline: Object.freeze({ keyframeLayerIds: Object.freeze([0, 1]) }), additionalLayers: Object.freeze([Object.freeze({ id: 7 })]) };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(process.env.SPATIAL_MORPH_JS || path.join(ROOT, 'core', 'spatial-morph.js'), 'utf8'), sb);
  vm.runInContext('let spatialMorph = { enabled: false, mode: "linear", angleDeg: 0 };\n' + SRC_SET + SRC_GET, sb);
  return { sb, get: (code) => vm.runInContext(code, sb), call: (patch) => vm.runInContext('setSpatialMorph', sb)(patch) };
}
T('write', () => {
  check('the two functions exist in sketch.js and are exported as window properties', !!SRC_SET && !!SRC_GET && /window\.setSpatialMorph = setSpatialMorph;/.test(SKETCH) && /window\.getSpatialMorph = getSpatialMorph;/.test(SKETCH));
  const a = mkSandbox();
  const block = () => J(a.get('spatialMorph'));
  check('a partial patch merges into the block: { enabled: true } alone changes only enabled; then { mode: "radial" } keeps enabled; then { angleDeg: 45 } keeps both', a.call({ enabled: true }) === true && block() === J({ enabled: true, mode: 'linear', angleDeg: 0 }) && a.call({ mode: 'radial' }) === true && block() === J({ enabled: true, mode: 'radial', angleDeg: 0 }) && a.call({ angleDeg: 45 }) === true && block() === J({ enabled: true, mode: 'radial', angleDeg: 45 }));
  const r0 = a.sb.redraws;
  check('a change redraws exactly once; an EQUAL patch (the same values, a subset, an empty object, a patch of unknown keys) does not redraw and returns false', (a.call({ mode: 'bilinear' }), a.sb.redraws === r0 + 1) && [{ mode: 'bilinear' }, { enabled: true, mode: 'bilinear', angleDeg: 45 }, {}, { speed: 3, wave: true }, { enabled: true }].every((p) => a.call(p) === false) && a.sb.redraws === r0 + 1, a.sb.redraws - r0);
  check('invalid values normalise as in the session restore: mode "spiral" -> linear, enabled 1 -> false, angleDeg "x" / NaN -> 0, the other fields of the patch still apply', (a.call({ enabled: true, mode: 'spiral', angleDeg: 90 }), block() === J({ enabled: true, mode: 'linear', angleDeg: 90 })) && (a.call({ enabled: 1, angleDeg: NaN }), block() === J({ enabled: false, mode: 'linear', angleDeg: 0 })) && (a.call({ angleDeg: 'x', mode: 'radial' }), block() === J({ enabled: false, mode: 'radial', angleDeg: 0 })));
  const evil = { get enabled() { throw new Error('boom'); } }, cyc = {}; cyc.self = cyc;
  let threw = null, results = [];
  try { results = [null, undefined, 5, 'x', true, [], [1, 2], () => 1, Symbol('s'), evil, cyc, Object.create(null), new Proxy({}, { has() { throw new Error('p'); }, get() { throw new Error('p'); }, getOwnPropertyDescriptor() { throw new Error('p'); } })].map((p) => a.call(p)); } catch (e) { threw = e; }
  check('it never throws: null, undefined, a number, a string, a boolean, arrays, a function, a symbol, an object with a throwing getter, a cyclic object, a null-prototype object and a throwing Proxy all return false (the first nine) or a boolean', threw === null && results.length === 13 && results.slice(0, 10).every((x) => x === false) && results.every((x) => typeof x === 'boolean'), threw ? String(threw) : J(results));
  check('it touches neither the timeline nor a layer (frozen sentinels are unchanged and nothing threw)', a.get('timeline.keyframeLayerIds.length') === 2 && a.get('additionalLayers.length') === 1 && a.get('additionalLayers[0].id') === 7);
  const patch = { enabled: true, mode: 'radial', angleDeg: 10 }; a.call(patch); patch.mode = 'bilinear'; patch.angleDeg = 99;
  check('the block holds its OWN values: changing the patch object afterwards changes nothing', a.get('spatialMorph.mode') === 'radial' && a.get('spatialMorph.angleDeg') === 10);
  const g = a.get('getSpatialMorph()'); g.mode = 'bilinear'; g.angleDeg = 77; g.enabled = false;
  const g2 = a.get('getSpatialMorph()');
  check('getSpatialMorph() returns a COPY: changing it changes nothing in the model, and two reads are two objects with the same values', a.get('spatialMorph.mode') === 'radial' && a.get('spatialMorph.angleDeg') === 10 && g2 !== g && same(g2, { enabled: true, mode: 'radial', angleDeg: 10 }) && a.get('getSpatialMorph()') !== a.get('spatialMorph'));
  const none = a.sb.redraws; a.call('nope'); a.call({ mode: 'radial' });
  check('no redraw for an ignored or an equal patch', a.sb.redraws === none);
});
T('session round trip', () => {
  // the real vm world with state.js and the real session functions: set the block with the REAL setSpatialMorph, write the snapshot, restore it into a fresh world
  const mk = () => { const ctx = S.world('square', 3, 3, 'none'); ctx.sb.redraw = () => { ctx.sb.__redraws = (ctx.sb.__redraws || 0) + 1; }; vm.runInContext(SRC_SET + SRC_GET, ctx.sb); return ctx; };
  const src = mk(), ui = S.uiOf(src, 'none', 6);
  const before = S.snapOf(src, ui);
  src.run('setSpatialMorph({ enabled: true, mode: "radial", angleDeg: 45 })');
  const snap = S.snapOf(src, ui);
  check('the snapshot carries the block only when it differs from the defaults: before the call no spatialMorph, after it { enabled, radial, 45 }, and the redraw ran once', before.settings.spatialMorph === undefined && same(snap.settings.spatialMorph, { enabled: true, mode: 'radial', angleDeg: 45 }) && src.sb.__redraws === 1);
  const tgt = mk(), tui = S.uiOf(tgt, 'none', 6);
  const r = S.applyInto(tgt, snap, S.fakeHooks(tgt, null, tui));
  check('a reload (validate, plan, apply through the real functions) restores the block, and getSpatialMorph() reads it back as a copy', r.ok === true && same(tgt.sb.getSpatialMorph(), { enabled: true, mode: 'radial', angleDeg: 45 }) && same(S.snapOf(tgt, tui), snap));
  src.run('setSpatialMorph({ enabled: false, mode: "linear", angleDeg: 0 })');
  check('setting the block back to the defaults makes the snapshot byte-identical to the one before (the autosave writes nothing extra)', same(S.snapOf(src, ui), before));
});

// ================= 2. the seam-open check =================
console.log('\n== 2. spatialMorphSeamOpen and the status field seamOpen ==');
const W = (shape, order, sym, layersConns, extra) => {
  const w = makeRenderWorld(shape, order, 3, sym || 'none'); w.baseConnections(layersConns[0]);
  const ids = layersConns.map((c) => w.addKeyframeLayer(c)); if (ids.length >= 2) w.setTimeline(ids);
  w.setMorph(Object.assign({ enabled: true, mode: 'linear', angleDeg: 0 }, extra || {}));
  return { w, ids };
};
const openOf = (w) => { w.frame(); return w.status().seamOpen; };
const oracle = (w, ids) => ids.filter((id) => D.frameSeamOpen(w, id).open);
T('pure', () => {
  const M2 = M, sq = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const idw = { tileCount: 1, opCount: 1, toWorld: (p) => p };
  check('spatialMorphSeamOpen never throws and says valid: false for input it cannot check (not arrays, a bad line, a NaN, a world without toWorld, zero tiles), open false', [[null, sq, idw], [[], null, idw], [[{ x1: 0, y1: 0, x2: 1 }], sq, idw], [[{ x1: NaN, y1: 0, x2: 1, y2: 1 }], sq, idw], [[], sq, {}], [[], sq, { tileCount: 0, opCount: 1, toWorld: (p) => p }], [[], sq, { tileCount: 1, opCount: 1, toWorld: () => { throw new Error('x'); } }]].every((a) => { const r = M2.spatialMorphSeamOpen(...a); return r.open === false && (r.valid === false || r.boundary === 0); }));
  check('a keyframe without boundary endpoints is seamless (nothing to meet); the result is a new object each call', M2.spatialMorphSeamOpen([{ x1: 20, y1: 20, x2: 60, y2: 70 }], sq, idw).open === false && M2.spatialMorphSeamOpen([], sq, idw) !== M2.spatialMorphSeamOpen([], sq, idw));
  const r = M2.spatialMorphSeamOpen([{ x1: 0, y1: 50, x2: 50, y2: 50 }], sq, { tileCount: 2, opCount: 1, toWorld: (p, t) => ({ x: p.x + 100 * t, y: p.y }) });
  check('two tiles in a row, a line from the left edge: its boundary endpoint on tile 1 has a partner only when a line ends on the right edge of tile 0, and neither tile is an inner tile of a 2-tile list: nothing checked, not open', r.valid === true && r.open === false && r.checked === 0);
});
T('verdicts', () => {
  const hex = D.corpusQualifying().filter((r) => r.qualifies);
  const cases = [];
  // corpus patterns (seamless by qualification): K0 = K1 = the pattern; hand-built; open patterns
  for (const shape of ['triangle', 'square', 'hex']) { const r = hex.find((x) => x.shape === shape); cases.push({ name: `corpus ${r.key}`, shape: r.shape, order: r.order, sym: r.mode, layers: [r.conns, r.conns], expect: [] }); }
  for (const shape of ['triangle', 'square', 'hex']) { const hb = D.handBuilt(shape, 5, 3, 11); cases.push({ name: `hand-built ${shape} (seamless)`, shape, order: 5, sym: 'none', layers: [hb.conns, hb.conns], expect: [] }); }
  const OPEN = { square: [[2, 5]], triangle: [[1, 5]], hex: [[1, 10]] };   // a line that ends on an outer edge without a partner line on the neighbour
  for (const shape of ['square', 'hex']) cases.push({ name: `${shape}: a line ending on the edge with no partner is open`, shape, order: 3, sym: 'none', layers: [OPEN[shape], OPEN[shape]], expect: null });
  let n = 0, ok = 0, bad = '';
  for (const c of cases) {
    const { w, ids } = W(c.shape, c.order, c.sym, c.layers), got = openOf(w), want = oracle(w, ids);
    n++; if (same(got, want) && (c.expect === null || same(got, c.expect))) ok++; else bad = bad || `${c.name}: status ${J(got)}, oracle ${J(want)}`;
  }
  check(`the verdict of the status equals the independent full-frame oracle for ${n} patterns (3 corpus seamless, 3 hand-built seamless, 2 open); the seamless ones give [], the open ones list both keyframes`, ok === n, bad);
  const open0 = W('square', 3, 'none', [[[2, 5]], [[5, 8], [2, 5]].slice(0, 1)]);
  // K0 open, K1 closed: [0]; both closed: []; K0 closed, K1 open: [1]; both open [0, 1]
  const closedSq = [[2, 8]], openSq = [[2, 5]];   // [2, 8] runs from the top edge to the bottom edge: each end meets the other's partner; [2, 5] has no partner at 8
  const mix = (a, b) => { const { w } = W('square', 3, 'none', [a, b]); return openOf(w); };
  check('K0 open and K1 closed gives [0]; K0 closed and K1 open gives [1]; both closed gives []; both open gives [0, 1]', same(mix(openSq, closedSq), [0]) && same(mix(closedSq, openSq), [1]) && same(mix(closedSq, closedSq), []) && same(mix(openSq, openSq), [0, 1]), J([mix(openSq, closedSq), mix(closedSq, openSq), mix(closedSq, closedSq), mix(openSq, openSq)]));
  // keyframes with a free boundary slide that is still seamless (a closed deformation of the stage d2 data set): []
  let slid = 0, slidOk = 0;
  for (const shape of ['triangle', 'square', 'hex']) {
    const hb = D.handBuilt(shape, 5, 3, 11); const b = D.buildCase({ shape, order: 5, size: 3, mode: 'none', conns: hb.conns }, 'i', [hb.conns.length + 3, hb.conns.length + 9], 2);
    b.w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); const got = openOf(b.w), want = oracle(b.w, b.ids); slid++; if (same(got, []) && same(want, [])) slidOk++;
  }
  check(`a closed deformation (boundary nodes slide along their edge in step with their partners): both keyframes seamless, [] (${slidOk} of ${slid} patterns, oracle agrees)`, slidOk === slid);
  // an edge change makes K1 open (its moved node has no partner): the oracle and the status agree
  let eOk = 0, eN = 0;
  for (const shape of ['triangle', 'square', 'hex']) { const hb = D.handBuilt(shape, 5, 3, 11); const b = D.buildCase({ shape, order: 5, size: 3, mode: 'none', conns: hb.conns }, 'ii', [hb.conns.length + 3, hb.conns.length + 9], 2); b.w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); const got = openOf(b.w), want = oracle(b.w, b.ids); eN++; if (same(got, want) && got.includes(1) && !got.includes(0)) eOk++; }
  check(`an edge change (case ii of the d2 data set): K0 seamless, K1 open: [1], the oracle agrees (${eOk} of ${eN})`, eOk === eN);
  // the base fallback: the base sheet is keyframe 0 (-1)
  const wb = makeRenderWorld('square', 3, 3, 'none'); wb.baseConnections([[2, 5]]); const lid = wb.addKeyframeLayer([[2, 8]]); wb.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  check('the base fallback (no timeline, one layer): the base sheet is keyframe 0 and is reported as -1; the closed layer is not listed', same(openOf(wb), [-1]) && lid === 0, J(wb.status()));
  // the time test's patterns (3 keyframes, bilinear with 4 corners): the keyframes that take part are checked: the active segment's two, or all four corners
  const CONNS = [[1, 5], [2, 8], [3, 7]], ALT = [[1, 9], [2, 6], [4, 8]], ALT2 = [[3, 6], [1, 4], [2, 9]];
  const t3 = W('square', 3, 'none', [CONNS, ALT, ALT2]); const seg = [];
  for (const el of [500, 1500, 2500, 3500]) { t3.w.set(`timeline.elapsedMs = ${el};`); t3.w.frame(); seg.push(t3.w.status().seamOpen); }
  check('three keyframes (the stage d time-test patterns): segment 0 checks layers 0 and 1 ([]) and segment 1 checks layers 1 and 2 ([2]: the pattern ALT2 is open); the oracle agrees', same(seg, [[], [], [2], [2]]) && same(oracle(t3.w, t3.ids), [2]), J(seg));
  const b4 = W('square', 3, 'none', [CONNS, ALT, ALT2, ALT], { mode: 'bilinear' }); const bo = openOf(b4.w);
  check('bilinear with four corners checks all four layers: [2] (and the status code is bilinearStatic)', same(bo, [2]) && b4.w.status().code === 'bilinearStatic', J(b4.w.status()));
});
T('not evaluated', () => {
  const { w } = W('square', 3, 'none', [[[2, 5]], [[2, 5]]]);
  w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 }); const c0 = w.get('spatialMorphRenderState.seamChecks'); w.frame();
  check("the morph OFF: the check does not run (no computation, the counter is unchanged) and the status is off with seamOpen null", w.status().code === 'off' && w.status().seamOpen === null && w.get('spatialMorphRenderState.seamChecks') === c0);
  const w1 = makeRenderWorld('square', 3, 3, 'none'); w1.baseConnections([[2, 5]]); w1.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); w1.frame();
  check("a code that draws the normal frame (needsTwoKeyframes) has seamOpen null; the status keeps its other fields", w1.status().code === 'needsTwoKeyframes' && w1.status().seamOpen === null && same(Object.keys(w1.status()), ['code', 'keyframes', 'mode', 'progress', 'segment', 'seamOpen']));
  // parameterMismatch
  const wm = makeRenderWorld('square', 3, 3, 'none'); wm.baseConnections([[2, 5]]); const a = wm.addKeyframeLayer([[2, 5]], { mode: 'none' }), b = wm.addKeyframeLayer([[2, 5]], { mode: 'rotation6' }); wm.setTimeline([a, b]); wm.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); wm.frame();
  check('parameterMismatch: seamOpen null', wm.status().code === 'parameterMismatch' && wm.status().seamOpen === null);
  const wd = makeRenderWorld('square', 3, 3, 'none'); wd.baseConnections([[2, 5]]); const da = wd.addKeyframeLayer([[2, 5]]), db = wd.addKeyframeLayer([[2, 5]]); wd.setTimeline([da, db]); wd.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  wd.set('additionalLayers[1].nodes[1].x = NaN; additionalLayers[1].nodes[4].y = Infinity;'); let dthrew = null; try { wd.frame(); wd.frame(); } catch (e) { dthrew = e; }
  check('degenerate keyframe content (NaN and Infinity node coordinates): nothing throws, the status is a code that draws the normal frame and seamOpen is not an invented list', dthrew === null && (wd.status().seamOpen === null || Array.isArray(wd.status().seamOpen)), dthrew ? String(dthrew) : J(wd.status()));
  const s1 = w.status(); s1.seamOpen = [9];
  const { w: w2 } = W('square', 3, 'none', [[[2, 5]], [[2, 5]]]); w2.frame();
  check('the status read is a COPY: the seamOpen array a caller gets can be changed without changing the next read', (() => { const x = w2.get('spatialMorphStatus()'); x.seamOpen.push(5); return same(w2.get('spatialMorphStatus().seamOpen'), [0, 1]); })());
});
T('cache', () => {
  const CONNS = [[1, 5], [2, 8], [3, 7]], ALT = [[1, 9], [2, 6], [4, 8]];
  const { w, ids } = W('square', 3, 'none', [CONNS, ALT]);
  const cnt = () => [w.get('spatialMorphRenderState.seamChecks'), w.get('spatialMorphRenderState.seamHits')];
  w.frame(); const first = cnt();
  check('the first frame computes the check once per keyframe (2 keyframes: 2 computations, 0 hits)', same(first, [2, 0]), J(first));
  for (let i = 0; i < 60; i++) w.frame();
  const loop = cnt();
  check('60 more redraws of the same state compute nothing: still 2 computations, 120 cache hits', loop[0] === 2 && loop[1] === 120, J(loop));
  for (let i = 0; i < 60; i++) { w.set(`timeline.elapsedMs = ${(i / 59) * 2000};`); w.frame(); }
  const play = cnt();
  check('the timeline playback at 60 frames (progress 0 .. 1) computes nothing: still 2 computations, 240 hits', play[0] === 2 && play[1] === 240, J(play));
  w.set('additionalLayers[1].connections.push([3, 7]);'); w.set('additionalLayers[0].connections.push([3, 7]);'); w.frame(); const edited = cnt();
  check('a changed keyframe (one line added to each) recomputes both (4 computations in all) and not more', edited[0] === 4, J(edited));
  w.frame(); w.frame();
  check('...and the new content is cached again', cnt()[0] === 4);
  w.set('additionalLayers[0].symmetryMode = "rotation6"; additionalLayers[1].symmetryMode = "rotation6";'); w.frame(); const sym = cnt();
  check('the cache key includes the symmetry mode: both keyframes changed to rotation6 recompute (6 in all)', sym[0] === 6, J(sym));
  // the size factor needs no key part of its own: it changes the polygon (outerCorners), which IS in the key; a key without the size factor is an equivalent mutant
  // 64 distinct contents do not grow the cache without bound
  w.set('spatialMorphRenderState.seamCache.clear();'); const before = w.get('spatialMorphRenderState.seamChecks'); for (let i = 0; i < 70; i++) { w.set('additionalLayers[0].connections = [[1, 5], [2, 8]]; additionalLayers[1].connections = [[1, 5], [2, 8]]; additionalLayers[0].shapeSizeFactor = 3; additionalLayers[1].shapeSizeFactor = 3; additionalLayers[0].symmetryMode = "none"; additionalLayers[1].symmetryMode = "none"; additionalLayers[0].nodes.forEach((n) => { n.x += 0.01; }); additionalLayers[1].nodes.forEach((n) => { n.x += 0.01; });'); w.frame(); }
  check('70 frames with 70 distinct keyframe contents compute 70 verdicts (the two identical keyframes of a frame share one) and the cache holds at most 64 of them (it is cleared when full)', w.get('spatialMorphRenderState.seamChecks') - before === 70 && w.get('spatialMorphRenderState.seamCache.size') <= 64, w.get('spatialMorphRenderState.seamChecks') - before + ' / ' + w.get('spatialMorphRenderState.seamCache.size'));
});
T('no pixel change', () => {
  const CONNS = [[1, 5], [2, 8], [3, 7]], ALT = [[1, 9], [2, 6], [4, 8]], ALT2 = [[3, 6], [1, 4], [2, 9]];
  let n = 0, same2 = 0;
  for (const [shape, sym, mode, ang] of [['square', 'none', 'linear', 45], ['square', 'rotation_reflection3', 'radial', 0], ['square', 'none', 'bilinear', 0]]) {
    const { w } = W(shape, 3, sym, [CONNS, ALT, ALT2], { mode, angleDeg: ang });
    for (const el of [0, 700, 1500, 2500, 4000]) {
      w.set('spatialMorphRenderState.seamCheck = true;'); w.set(`timeline.elapsedMs = ${el};`); const on = hashOf(w.frame()), d1 = hashOf(w.drawn());
      w.set('spatialMorphRenderState.seamCheck = false;'); const off = hashOf(w.frame()), d2 = hashOf(w.drawn()); n++; if (on === off && d1 === d2) same2++;
    }
  }
  check(`the check changes no frame: ${same2} of ${n} frames (3 patterns, 5 progress values, every drawn line() / bezier() call and the collected segments) are identical with the check on and off, and with it off the status says seamOpen null`, same2 === n && n === 15);
  const { w } = W('square', 3, 'none', [CONNS, ALT]); w.set('spatialMorphRenderState.seamCheck = false;'); w.frame();
  check('with the switch off seamOpen is null and nothing is computed', w.status().seamOpen === null && w.get('spatialMorphRenderState.seamChecks') === 0);
});
T('cost', () => {
  // the vm cost (every world transform of the check is a function call inside a vm: an upper bound; the page measurement is in the report)
  const rows = [];
  for (const [shape, order, sym, conns] of [['hex', 3, 'rotation_reflection6', [[1, 10], [3, 14], [5, 20], [2, 11], [4, 15]]], ['triangle', 5, 'rotation_reflection6', [[1, 8], [8, 15], [2, 9], [3, 7]]]]) {
    const w = makeRenderWorld(shape, order, 3, sym); w.set('canvasW = 1100; canvasH = 1100; rebuildGrid(currentShape);'); w.baseConnections(conns);
    const a = w.addKeyframeLayer(conns), b = w.addKeyframeLayer(conns); w.setTimeline([a, b]); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); w.frame();
    rows.push(`${shape} ${sym} canvas 1100: ${w.get('spatialMorphRenderState.seamLastMs').toFixed(1)} ms in the vm, seamOpen ${J(w.status().seamOpen)}`);
  }
  console.log('      ' + rows.join(' | '));
  check('the check ran in both worlds without error (the page figures are measured in the browser pane)', rows.length === 2);
});

// ================= 3. source pins =================
console.log('\n== 3. source pins ==');
T('pins', () => {
  const PROT = ['applyTimelineFrame', 'applyLayerConnectionsMorphFrame', 'resolveTimelineKeyframeCoords', 'resolveTimelineSegment', 'totalTimelineDurationMs', 'setTimelineProgress', 'toggleTimelinePlayback', 'previewTimelineSegmentMidpoint'];
  const PINNED = ["f069eecefcff450fa75917d0f7758d2029a441ec7139aa076f3d2441d5d9fd08", "83384dbdb97ce87f1ebb18896b5be3131c280fcfcde35988177bbe1e3e61ca6d", "fc0dcac56033f3dc5bdca2ce0573362658820ec7c36818fc6d301fe086968d6c", "45343680fb52a81a99bdba4ff361e76ed73c26c1b871f45986e8cdb0f702e10e", "97111f21cfcf03331b80e0f4272fd1dc58bd78e6fccc3d819533f01dd4910fe6", "37345290516db9ae0e50df6f3d6f5c19a2b4cdacaf29dfe3017b5c0ba7d315f7", "d310d224e2578d4af6b13c49733885346a01960f27199c9f7d48ea114ab4a34f", "afcb922e154cd8c072dd8c99648956160fd184be845c5f0c45005dd9e6c67714"];   // sha256 of each body at bb03942c
  const got = PROT.map((n) => { const c = cut(n); return c ? sha(c) : null; });
  check(`the eight protected sketch.js functions are byte-identical to bb03942c (sha256 of each body pinned): ${got.filter((g, i) => g === PINNED[i]).length} of 8`, same(got, PINNED), J(got.map((g, i) => (g === PINNED[i] ? 'ok' : PROT[i]))));
  check('the new functions contain no hotkey, no event listener, no storage access and no block comment', ![SRC_SET, SRC_GET].some((t) => /keyPressed|addEventListener|localStorage|sessionStorage|\/\*/.test(t)));
  check('the new functions are top-level declarations followed by their window exports, next to setFaceSelected', SKETCH.indexOf('window.setFaceSelected = setFaceSelected;') < SKETCH.indexOf('function setSpatialMorph(') && SKETCH.indexOf('window.setSpatialMorph = setSpatialMorph;') < SKETCH.indexOf('function updatePatternNameStatus('));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
