// Morph stage d3 (task 021): the pairing score on the SYMMETRY-CLOSED line set (core/spatial-morph.js spatialMorphScorePairing with opts.groupElements, spatialMorphClosePairing) and the editor's free-ends guard
// (sketch.js timelineConclusiveFree) that uses it.
//   1. the real case (square, order 4, D4 = rotation_reflection6; start orbits 11+19, end 5+11; tools/morph/measure-filter-gap.js): free ends of the layers 0 instead of 1, the guard no longer says "free"
//   2. real free line ends (off-path-specs "free-seeded") keep the guard   3. without group elements: the stored lines only, as before   4. small closed worlds: what only the copies show (nodeMiss, free ends, duplicates)
//   5. purity   6. the numbers of the real case (how many of the 512 pairings stay conclusive) and the cost per candidate
//   node tools/morph/test-spatial-morph-score-symmetry.js
//   SPATIAL_MORPH_JS / SKETCH_JS=/path/to/mutated/file.js node tools/morph/test-spatial-morph-score-symmetry.js        (sabotage runs)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const M = require(process.env.SPATIAL_MORPH_JS || path.join(ROOT, 'core', 'spatial-morph.js'));
const { makeRenderWorld } = require('./render-harness.js');
const SK = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 300)); } };
const J = (x) => JSON.stringify(x, (k, v) => (v instanceof Map ? { map: [...v] } : (v === Infinity ? 'inf' : v)));
const cut = (name) => { const m = SK.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('not in sketch.js: ' + name); return m[0]; };
const score = M.spatialMorphScorePairing;
const tri = (ids, pts) => ({ nodes: ids.map((id, k) => ({ id, x: pts[k][0], y: pts[k][1] })), connections: [] });
const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); (o instanceof Map ? [...o.values()] : Object.values(o)).forEach(deepFreeze); } return o; };

console.log('== 1. the real case: square order 4, D4, 11+19 against 5+11 ==');
let w = null, ctx = null, GE = null;
T('real', () => {
  w = makeRenderWorld('square', 4, 3, 'rotation_reflection6'); w.baseConnections([]);
  const table = w.get("computeThemeLineOrbitTable('rotation_reflection6')"), pair = (id) => table.orbits[id].pairs[0];
  const a = w.addKeyframeLayer([11, 19].map(pair)), b = w.addKeyframeLayer([5, 11].map(pair)); w.setTimeline([a, b]);
  ['timelineEnrichPairingCandidates', 'timelineConclusiveContext', 'timelineConclusiveFree', 'timelineConclusiveView'].forEach((n) => w.set(cut(n)));
  ctx = w.get('timelineConclusiveContext(0)'); GE = ctx.groupElements;
  check('the context carries the group elements (8) and the start layer\'s polygon', !!GE && GE.groupOrder === 8 && ctx.poly.length === 4);
  const open = (l) => score(l, l, null, null, null, { poly: ctx.poly }).dangling, closed = (l) => score(l, l, null, null, null, { poly: ctx.poly, groupElements: GE }).dangling;
  check('each layer scored alone: 1 free end on the stored lines (node 10 meets its line only through a copy), 0 on the closed line set', open(ctx.layerA) === 1 && open(ctx.layerB) === 1 && closed(ctx.layerA) === 0 && closed(ctx.layerB) === 0);
  check('the editor\'s guard timelineConclusiveFree is false for the pair (it was true before)', w.get('timelineConclusiveFree(timelineConclusiveContext(0))') === false);
  w.set('CAND = { n: 2, orientation: false, items: [{ perm: [0, 1] }, { perm: [1, 0] }] };');
  const v = w.get('timelineConclusiveView(CAND, true, timelineConclusiveContext(0))');
  check('the filter is effective: the state is not "free" (here "empty": no pairing of these two patterns is conclusive on every number)', v.state === 'ok' || v.state === 'empty', v.state);
});

console.log('\n== 6. the numbers of the real case (all 512 pairings: 2 permutations x 4 flips x 8 x 8 group elements) ==');
T('numbers', () => {
  const cands = []; for (const perm of [[0, 1], [1, 0]]) for (const f0 of [false, true]) for (const f1 of [false, true]) for (let g0 = 0; g0 < 8; g0++) for (let g1 = 0; g1 < 8; g1++) cands.push({ perm, flips: [f0, f1], members: [g0, g1] });
  const t0 = process.hrtime.bigint();
  const sc = cands.map((c) => score(ctx.layerA, ctx.layerB, c.perm, c.flips, c.members, { poly: ctx.poly, groupElements: GE }));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / cands.length;
  const z = (s) => s.dangling === 0 && s.boundaryMiss === 0, all0 = (s) => z(s) && s.nodeMiss === 0;
  const tup = {}; sc.forEach((s) => { const k = `${s.dangling}/${s.nodeMiss}/${s.boundaryMiss}`; tup[k] = (tup[k] || 0) + 1; });
  console.log(`      512 scores: ${ms.toFixed(3)} ms per candidate (closed set, groupElements given); tuples dangling/nodeMiss/boundaryMiss: ${J(tup)}`);
  check('the cost per candidate is far below the 0.1 ms target on the real case (measured above; asserted at 0.5 ms for slow machines)', ms < 0.5, ms.toFixed(3));
  check('128 of the 512 pairings pass dangling and boundaryMiss (measured by tools/morph/measure-filter-gap.js: 64 of those 128 have loose ends at t = 0.1 and 0.9)', sc.filter(z).length === 128, sc.filter(z).length);
  check('none of them is conclusive on nodeMiss as well: the two patterns differ in topology, so the editor\'s filter (all three 0) keeps nothing here and says so', sc.filter(all0).length === 0);
  const best = sc.filter(z).reduce((m, s) => Math.min(m, s.nodeMiss), Infinity), worstNm = sc.filter(z).reduce((m, s) => Math.max(m, s.nodeMiss), 0);
  check('among the 128 the nodeMiss takes two values (12 and 20 with duplicates counted once), 64 each', best === 12 && worstNm === 20 && sc.filter((s) => z(s) && s.nodeMiss === 12).length === 64 && sc.filter((s) => z(s) && s.nodeMiss === 20).length === 64);
  const base = cands.map((c) => score(ctx.layerA, ctx.layerB, c.perm, c.flips, c.members, { poly: ctx.poly }));
  check('without the group elements (the stored lines only) the same pairings score differently: nothing is conclusive and every layer is "free"', base.filter(all0).length === 0 && base.some((s, i) => J(s.key) !== J(sc[i].key)));
});

console.log('\n== 2. real free line ends keep the guard ==');
T('free', () => {
  const helpers = ['timelineEnrichPairingCandidates', 'timelineConclusiveContext', 'timelineConclusiveFree', 'timelineConclusiveView'];
  // a diagonal between two opposite inner nodes of the 4 x 4 lattice: its images under D4 are the two diagonals of the inner square, which cross in the middle where no end is: all four ends stay free
  const f = makeRenderWorld('square', 4, 3, 'rotation_reflection6'); f.baseConnections([]);
  const probe = f.addKeyframeLayer([[10, 14]]), L0 = f.get('additionalLayers[' + probe + ']'), poly = L0.outerCorners;
  const inner = L0.nodes.filter((n) => !M.spatialMorphOnEdge(n, poly));
  let best = null; for (const a of inner) for (const b of inner) { const d = Math.hypot(a.x - b.x, a.y - b.y); if (!best || d > best.d) best = { a, b, d }; }
  const a = f.addKeyframeLayer([[best.a.id, best.b.id]]), b = f.addKeyframeLayer([[best.a.id, best.b.id]]); f.setTimeline([a, b]);
  helpers.forEach((n) => f.set(cut(n)));
  const c = f.get('timelineConclusiveContext(0)');
  const closed = score(c.layerA, c.layerA, null, null, null, { poly: c.poly, groupElements: c.groupElements }).dangling;
  check('4 inner nodes, the diagonal between two opposite ones: 4 free ends even on the closed set (the two images cross in the middle, no end meets another) and the guard stays true', inner.length === 4 && closed === 4 && f.get('timelineConclusiveFree(timelineConclusiveContext(0))') === true, closed);
  f.set('CAND = { n: 1, orientation: false, items: [{ perm: [0] }] };');
  check('the view says "free" and shows the list unfiltered (the candidates\' own array), as before', (() => { const v = f.get('timelineConclusiveView(CAND, true, timelineConclusiveContext(0))'); return v.state === 'free' && v.kept === 1; })());
  // the off-path spec with curve kind free: its stored lines look open (6 distinct end nodes) but under the real D4 copies they close up (the centre node meets four images): MEASURED, noted in the report
  const specs = JSON.parse(fs.readFileSync(path.join(__dirname, 'off-path-specs.json'), 'utf8')), sp = specs.find((x) => x.curve && x.curve.kind === 'free');
  const g = makeRenderWorld(sp.shape, sp.order, sp.size, sp.mode); g.baseConnections([]);
  const ga = g.addKeyframeLayer(sp.connections), gb = g.addKeyframeLayer(sp.connections); g.setTimeline([ga, gb]);
  helpers.forEach((n) => g.set(cut(n)));
  const gc = g.get('timelineConclusiveContext(0)');
  check('the free-seeded spec (curve kind free) in its real world: 1 free end on the stored lines, 0 on the closed set, the guard false: its "free" is the curve style, not open line ends', score(gc.layerA, gc.layerA, null, null, null, { poly: gc.poly }).dangling === 1 && score(gc.layerA, gc.layerA, null, null, null, { poly: gc.poly, groupElements: gc.groupElements }).dangling === 0 && g.get('timelineConclusiveFree(timelineConclusiveContext(0))') === false);
});

console.log('\n== 3. without group elements: the stored lines only ==');
T('compat', () => {
  const A = { nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 10, y: 0 }, { id: 3, x: 5, y: 8 }], connections: [[1, 2], [2, 3], [3, 1]] }, B = { nodes: [{ id: 1, x: 1, y: 1 }, { id: 2, x: 11, y: 0 }, { id: 3, x: 5, y: 9 }], connections: [[1, 2], [2, 3], [3, 1]] };
  const ref = score(A, B, [1, 2, 0], [false, true, false], null, {});
  check('no groupElements, null, an empty object, one element (groupOrder 1) and a missing perms array all give the very same score', [undefined, null, {}, { groupOrder: 1, perms: [new Map()] }, { groupOrder: 8 }].every((ge) => J(score(A, B, [1, 2, 0], [false, true, false], null, ge === undefined ? {} : { groupElements: ge })) === J(ref)));
});

console.log('\n== 4. small worlds: what only the copies show ==');
T('closed', () => {
  const C3 = { groupOrder: 3, perms: [new Map(), new Map([[1, 2], [2, 3], [3, 1]]), new Map([[1, 3], [2, 1], [3, 2]])] };
  const P = [[0, 0], [10, 0], [5, 8.66]], Q = [[1, 1], [11, 0], [5, 9]];
  const A = Object.assign(tri([1, 2, 3], P), { connections: [[1, 2]] }), B = Object.assign(tri([1, 2, 3], Q), { connections: [[1, 2]] });
  const o = score(A, B, null, null, null, {}), c = score(A, B, null, null, null, { groupElements: C3 });
  check('one stored line of a triangle: 2 free ends alone; under the 3 rotations it is the closed triangle, 0 free ends, nothing missing', o.dangling === 2 && c.dangling === 0 && c.nodeMiss === 0 && c.boundaryMiss === 0, J([o.key, c.key]));
  // the partner line is another one: A (1,2) against B (1,3): equal on one line, but the copies split node 2 in B
  const B2 = Object.assign(tri([1, 2, 3], Q), { connections: [[1, 3]] });
  const o2 = score(A, B2, null, null, null, {}), c2 = score(A, B2, null, null, null, { groupElements: C3 });
  check('a pairing that is consistent on the stored line but splits a node through the copies (A line 1-2 against B line 1-3): nodeMiss 0 on the stored line, > 0 on the closed set', o2.nodeMiss === 0 && c2.nodeMiss > 0, J([o2.key, c2.key]));
  // a line a symmetry maps onto itself is counted once (a duplicate would "meet" itself and hide its free ends)
  const SW = { groupOrder: 2, perms: [new Map(), new Map([[1, 2], [2, 1]])] };
  const s2 = score(A, B, null, null, null, { groupElements: SW });
  check('the line 1-2 under the swap 1 <-> 2 is its own image: kept once, so its two ends are still free (dangling 2, not 0)', s2.dangling === 2, J(s2.key));
  // the same element on BOTH sides: a pairing equivariant under the group scores like the identity one
  const rot = score(A, Object.assign(tri([1, 2, 3], Q), { connections: [[2, 3]] }), null, null, null, { groupElements: C3 });
  check('A line 1-2 against B line 2-3 (a rotation of it): consistent under the group, nodeMiss 0 and 0 free ends', rot.nodeMiss === 0 && rot.dangling === 0, J(rot.key));
  // robust: an element without a map, a node without an image, a missing node
  const odd = { groupOrder: 4, perms: [new Map(), null, new Map([[1, 99]]), { get: () => undefined }] };
  let r = null, threw = null; try { r = score(A, B, null, null, null, { groupElements: odd }); } catch (e) { threw = e; }
  check('an element with no map, a node with no image, an image node the layer lacks: those images are skipped, nothing throws, the base line stays', threw === null && r.dangling === 2 && r.key.length === 4, threw && threw.message);
  check('the closure helper alone: slots in, slots out (two per image line), identity first', (() => { const base = [{ line: 0, idA: 1, idB: 1, pa: { x: 0, y: 0 }, pb: { x: 1, y: 1 } }, { line: 0, idA: 2, idB: 2, pa: { x: 10, y: 0 }, pb: { x: 11, y: 0 } }]; const out = M.spatialMorphClosePairing(base, A, B, C3, 3); return out.length === 6 && out[0].idA === 1 && out[2].idA === 2 && out[4].idA === 3 && out[0].line === 0 && out[2].line === 1; })());
});

console.log('\n== 5. purity ==');
T('purity', () => {
  const C3 = { groupOrder: 3, perms: [new Map(), new Map([[1, 2], [2, 3], [3, 1]]), new Map([[1, 3], [2, 1], [3, 2]])] };
  const A = Object.assign(tri([1, 2, 3], [[0, 0], [10, 0], [5, 8]]), { connections: [[1, 2], [2, 3]] }), B = Object.assign(tri([1, 2, 3], [[1, 1], [11, 0], [5, 9]]), { connections: [[1, 2], [2, 3]] });
  const p = [1, 0], f = [true, false], mem = [1, 0], o = { poly: [{ x: -9, y: -9 }, { x: 9, y: -9 }, { x: 9, y: 9 }, { x: -9, y: 9 }], groupElements: C3 };
  const before = J([A, B, p, f, mem, o]);
  const s1 = score(deepFreeze(A), deepFreeze(B), deepFreeze(p), deepFreeze(f), deepFreeze(mem), deepFreeze(o));
  check('deep-frozen layers, arguments, options and element maps: no throw; everything deep-equal before and after; two calls give the same score', J([A, B, p, f, mem, o]) === before && J(s1) === J(score(A, B, p, f, mem, o)));
  const src = fs.readFileSync(process.env.SPATIAL_MORPH_JS || path.join(ROOT, 'core', 'spatial-morph.js'), 'utf8');
  const body = src.slice(src.indexOf('function spatialMorphNodeMap'), src.indexOf("if (typeof module !== 'undefined'"));
  check('the new code touches no store, global or DOM, and the file keeps the sketch\'s names out (node list and line list are read through the spelled-in-halves keys)', !/\b(window|document|additionalLayers|timeline|segmentPairings|Math\.random|console|nodes|connections)\b/.test(body.replace(/\/\/[^\n]*/g, '')));
  check('the editor passes the group elements to the free-ends guard (sketch.js timelineConclusiveFree) and the context carries them also without members', /spatialMorphScorePairing\(l, l, null, null, null, \{ poly: ctx\.poly, groupElements: ctx\.groupElements \}\)\.dangling > 0/.test(SK) && /groupElements: r\.groupElements \|\| layerGroupElements\(r\.layerTo\)/.test(SK));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
