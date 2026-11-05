// Morph stage d2: edge-crossing patterns and the keyframe parameters of the render hook.
//   1. THE DATA SET (tools/morph/seam-data.js): how many of the 258 corpus patterns cross the tile edge and are seamless across tiles (per shape and symmetry family).
//   2. CLAIM C (seams, mirror axes): on a CLOSED deformation the morph keeps every seam pair together at every progress value, in every mode, with 2 and 3 keyframes (M1 = 0, M2 = 0, M3 = 0); a pair that the later
//      keyframe's own normal frame separates is that keyframe's content, not a defect (the review's triangle hex_chain and mirror-axis cases); pairs coincident in BOTH keyframes stay together in the cases ii, iii, iv.
//      Stage d2c (the PROTOTYPE's boundary rule, restored; stage d2b's "commonEdge" rule is gone): M1c = 0 in ALL cases (criterion), the drawn endpoints do not jump. What this rule does NOT achieve is pinned below as
//      OPEN FINDINGS (the symmetry copies of a corner endpoint that split, lines that collapse to stubs, endpoints that would jump with exact ends): they are MEASURED NUMBERS of the prototype's rule on this data set,
//      not passing criteria; a better rule flips them on purpose. What the rule must achieve (connected lines, nothing loose) is tested in test-spatial-morph-prototype.js (the dangling-ends metric).
//   3. CLAIM A (keyframe parameters): the morph is drawn on the first keyframe layer's own lattice, shape, symmetry mode and size factor: at p = 0 and p = 1 it equals the keyframe (its normal frame; the endpoints that
//      change their edge projected onto it, stage d2c), call for call, whatever the base sheet's symmetry mode and size factor are; keyframes that disagree among themselves give the status 'parameterMismatch' (normal frame, nothing thrown).
//   node tools/morph/test-spatial-morph-edges.js
//   SPATIAL_MORPH_RENDER_JS=/path/to/mutated/spatial-morph-render.js node tools/morph/test-spatial-morph-edges.js        (sabotage runs; SPATIAL_MORPH_JS the same for core/spatial-morph.js)
'use strict';
const D = require('./seam-data.js');
const { makeRenderWorld } = D;

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 400)); } };
const J = (x) => JSON.stringify(x);
const same = (a, b) => J(a) === J(b);

// ================= 1. the data set =================
console.log('== 1. the data set: corpus patterns that cross the tile edge and are seamless across tiles ==');
let corpus = [];
T('corpus', () => {
  corpus = D.corpusQualifying();
  const q = corpus.filter((r) => r.qualifies);
  const per = {}; q.forEach((r) => { per[r.shape + '|' + r.mode] = (per[r.shape + '|' + r.mode] || 0) + 1; });
  const tot = {}; corpus.forEach((r) => { tot[r.shape + '|' + r.mode] = (tot[r.shape + '|' + r.mode] || 0) + 1; });
  Object.keys(tot).sort().forEach((k) => console.log(`      ${k.padEnd(32)} ${String(per[k] || 0).padStart(3)} of ${String(tot[k]).padStart(3)} qualify`));
  const byShape = (s) => q.filter((r) => r.shape === s).length;
  console.log(`      per shape: triangle ${byShape('triangle')}, square ${byShape('square')}, hex ${byShape('hex')}; all ${q.length} of ${corpus.length}`);
  check('the corpus has 258 patterns and 183 of them qualify (>= 4 endpoints on the outer edge and a partner for every boundary endpoint after tiling): triangle 61, square 71, hex 51', corpus.length === 258 && q.length === 183 && byShape('triangle') === 61 && byShape('square') === 71 && byShape('hex') === 51, J([corpus.length, q.length]));
  check('no corpus pattern uses the symmetry modes none or reflection_only (so the hand-built patterns, symmetry none, are needed for the free boundary slides)', corpus.every((r) => !['none', 'reflection_only'].includes(r.mode)));
});
const hand = {};
T('hand-built', () => {
  for (const [shape, seed] of [['triangle', 11], ['square', 11], ['hex', 11], ['triangle', 12], ['square', 12], ['hex', 12]]) {
    const hb = D.handBuilt(shape, 5, 3, seed);
    if (hb) (hand[shape] = hand[shape] || []).push(Object.assign({ label: shape + '/hand-built/' + seed }, hb));
  }
  check('hand-built edge-crossing patterns (symmetry none, order 5) exist for all three shapes', ['triangle', 'square', 'hex'].every((s) => (hand[s] || []).length >= 1), J(Object.keys(hand).map((s) => s + ':' + hand[s].length)));
  const nb = Object.values(hand).flat().map((p) => p.nb);
  check('...each with at least 4 endpoints on the outer edge', nb.every((x) => x >= 4), J(nb));
});

// ================= 2. claim C and the case matrix =================
console.log('\n== 2. claim C: seams on edge-crossing patterns (M1 = pairs from different tile copies, M2 = pairs inside one tile copy, M3 = call for call at p = 0 / 1) ==');
const pats = Object.values(hand).flat();
const byKey = {}; corpus.filter((r) => r.qualifies).forEach((r) => { (byKey[r.key] = byKey[r.key] || []).push(r); });
const corpusSample = [];
Object.values(byKey).forEach((list) => list.slice(0, 1).forEach((r) => {
  const others = list.filter((o) => o !== r && o.conns.length === r.conns.length);
  corpusSample.push({ label: r.key + '/#' + r.index, shape: r.shape, order: r.order, size: 3, mode: r.mode, conns: r.conns, other: others[0], other2: others[1] });
}));
const HB_MODES = D.MODES, CORPUS_MODES = [['linear', 0], ['radial', 0], ['bilinear', 0]], CORPUS_PS = [0, 0.25, 0.5, 0.9, 1];
const agg = {};   // case|keyframes -> sums
const add = (key, rows, inv) => {
  const a = agg[key] = agg[key] || { jump: 0, ratio: Infinity, ends: 0, runs: 0, m1: 0, m1n: 0, m1w: 0, m1c: 0, m1cn: 0, m1cw: 0, m2: 0, m2c: 0, m3: 0, m3n: 0 };
  a.runs++; a.jump = Math.max(a.jump, inv.jumpLow, inv.jumpHigh); a.jumpExact = Math.max(a.jumpExact || 0, inv.jumpExactLow, inv.jumpExactHigh); a.ratio = Math.min(a.ratio, inv.minRatio); a.below = (a.below || 0) + inv.below90; a.belowNot = (a.belowNot || 0) + inv.below90NotLinear; a.ends += inv.endpoints;
  rows.forEach((x) => { a.m1 += x.m1[0]; a.m1n += x.m1[1]; a.m1w = Math.max(a.m1w, x.m1[2]); a.m1c += x.m1c[0]; a.m1cn += x.m1c[1]; a.m1cw = Math.max(a.m1cw, x.m1c[2]); a.m2 += x.m2[0]; a.m2c += x.m2c[0]; if (x.m3 !== undefined) { a.m3 = Math.max(a.m3, x.m3); a.m3n++; } });
};
let skipped = 0;
T('matrix', () => {
  for (const [set, list, modes, ps] of [['hand', pats, HB_MODES, D.PS], ['corpus', corpusSample, CORPUS_MODES, CORPUS_PS]]) {
    for (const pat of list) {
      if (set === 'hand' && !pat.other) {   // case iv needs a second pattern of the same size
        pat.other = D.handBuilt(pat.shape, 5, 3, 100 + pat.conns.length * 7, pat.conns.length); pat.other2 = D.handBuilt(pat.shape, 5, 3, 200 + pat.conns.length * 7, pat.conns.length);
      }
      for (const kc of ['i', 'ii', 'iii', 'iv']) for (const nk of [2, 3]) {
        const r = D.runCase(pat, kc, nk, [pat.conns.length + 3, pat.conns.length + 9], modes, ps);
        if (r.skip) { skipped++; continue; }
        add(`${kc}|${nk}`, r.rows, r.inv);
      }
    }
  }
  console.log('      case | keyframes | cases run | M1 broken of pairs (worst px) | M1c broken of pairs closed in both (worst px) | M2 broken | M2c broken | M3 worst | jump at both ends (px) | shortest line at w = 0.01 / shorter keyframe line');
  Object.keys(agg).sort().forEach((k) => { const a = agg[k]; console.log(`      ${k.padEnd(7)} ${String(a.runs).padStart(4)} | ${String(a.m1).padStart(8)} of ${String(a.m1n).padStart(8)} (${a.m1w.toExponential(1)}) | ${a.m1c} of ${a.m1cn} (${a.m1cw.toExponential(1)}) | ${a.m2} | ${a.m2c} | ${a.m3.toExponential(1)} | ${a.jump.toExponential(1)} | ${(100 * a.ratio).toFixed(1)} %`); });
  console.log(`      (${skipped} case runs skipped: no valid closed deformation, no second pattern or no boundary node to edit)`);
  const i2 = agg['i|2'], i3 = agg['i|3'];
  check(`case i (closed deformation), 2 keyframes: ${i2.runs} patterns x 5 modes x all progress values: M1 = 0 broken of ${i2.m1n} seam pairs (worst ${i2.m1w.toExponential(1)} px), M2 = 0`, i2.m1 === 0 && i2.m1w <= 1e-6 && i2.m2 === 0 && i2.m1n > 1000, J([i2.m1, i2.m1n, i2.m2]));
  check(`case i, 3 keyframes (both segments, bilinear with three corners): M1 = 0 broken of ${i3.m1n} pairs (worst ${i3.m1w.toExponential(1)} px), M2 = 0`, i3.m1 === 0 && i3.m1w <= 1e-6 && i3.m2 === 0 && i3.m1n > 1000, J([i3.m1, i3.m1n, i3.m2]));
  check('case i: M3, the morph frame at p = 0 and p = 1 equals the normal frame of the keyframe call for call', i2.m3 <= 1e-9 && i3.m3 <= 1e-9 && i2.m3n > 0, J([i2.m3, i3.m3]));
  for (const kc of ['ii', 'iii', 'iv']) for (const nk of [2, 3]) {
    const a = agg[`${kc}|${nk}`];
    if (!a) { check(`case ${kc}, ${nk} keyframes ran`, false); continue; }
    check(`case ${kc}, ${nk} keyframes: pairs that coincide in BOTH keyframes' normal frames (${a.m1cn}) all stay together (M1c = 0, worst ${a.m1cw.toExponential(1)} px); the ${a.m1} broken of ${a.m1n} K0-coincident pairs are pairs the later keyframe itself separates; M3 (p = 0 / 1 against the normal frame: the projected endpoints, measured, not a criterion) ${a.m3.toExponential(1)}`, a.m1c === 0 && a.m1cw <= 1e-6 && a.m1cn > 100, J([a.m1c, a.m1cn, a.m1, a.m1n]));
  }
  const all = Object.keys(agg).map((k) => agg[k]);
  // OPEN FINDINGS of the prototype's rule (stage d2c). SOURCE: the prototype's boundary rule (any position within 1 px of an edge, projection on the majority edge, weights of the edge midpoint) as restored in stage d2c,
  // MEASURED on this data set (the numbers above). They are pinned so that a change of the rule shows up; they are NOT passing criteria: the symmetry copies of a corner endpoint that split inside one tile, lines that
  // collapse to a stub, and the endpoint jump that exact ends would cause are known weaknesses of the rule, open in the ROADMAP (a rule without them AND without loose line ends is new design work).
  check(`(a) the drawn endpoints do not jump: the displacement between w = 0 and w = 1e-6 and between w = 1 - 1e-6 and w = 1 is at most ${Math.max(...all.map((a) => a.jump)).toExponential(1)} px over ${all.reduce((n, a) => n + a.ends, 0)} endpoints (limit 1e-3)`, all.every((a) => a.jump <= 1e-3));
  check(`OPEN FINDING (measured with the prototype's rule, not a criterion): M2c, inside-tile pairs that coincide in both keyframes yet split, cases ii|3 ${agg['ii|3'].m2c}, iv|2 ${agg['iv|2'].m2c}, iv|3 ${agg['iv|3'].m2c} (${all.reduce((n, a) => n + a.m2c, 0)} in all), none in the other cases`, J(['ii|3', 'iv|2', 'iv|3'].map((k) => agg[k].m2c)) === '[6344,2794,25064]' && all.reduce((n, a) => n + a.m2c, 0) === 34202);
  check(`OPEN FINDING (measured, not a criterion): with EXACT ends (switched off in the front path since stage d2c) an endpoint that changes its edge would jump by ${Math.max(...all.map((a) => a.jumpExact)).toFixed(1)} px between w = 0 and w = 1e-6`, Math.abs(Math.max(...all.map((a) => a.jumpExact)) - 200) < 1e-6);
  check(`OPEN FINDING (measured, not a criterion): the shortest line at w = 0.01 is ${(100 * Math.min(...all.map((a) => a.ratio))).toFixed(2)} % of the shorter keyframe line; ${all.reduce((n, a) => n + (a.below || 0), 0)} lines are below 90 %, ${all.reduce((n, a) => n + (a.belowNot || 0), 0)} of them differ from the plain linear blend of their two keyframes`, Math.abs(Math.min(...all.map((a) => a.ratio)) - 0.0035406763156079434) < 1e-9 && all.reduce((n, a) => n + (a.below || 0), 0) === 9 && all.reduce((n, a) => n + (a.belowNot || 0), 0) === 9);
});
T('review cases', () => {
  // the review's triangle hex_chain: its later keyframe is not closed across the tile edge: no seam pair of K0 is still a pair in K1's own normal frame
  const K0 = [[2, 3], [3, 6], [6, 14], [14, 13], [13, 7], [7, 2]], K1 = [[4, 6], [6, 10], [10, 14], [14, 12], [12, 7], [7, 4]];
  const w = makeRenderWorld('triangle', 5, 3, 'none'); w.baseConnections(K0);
  const a = w.addKeyframeLayer(K0), b = w.addKeyframeLayer(K1); w.setTimeline([a, b]);
  const nf = [D.layerNormal(w, a), D.layerNormal(w, b)]; w.setMorph({ enabled: true, mode: 'linear', angleDeg: 25 });
  const spt = nf[0].length / w.get('spatialMorphRenderRecordTiles().length'), P = D.pairsOf(nf[0], spt);
  const both = D.coincident(P, P.cross, nf), f = D.at(w, 0.5), g = D.gaps(P, f, P.cross);
  check(`the review's "consistent" triangle hex_chain: ${P.cross.length} seam pairs coincide in K0, ${both.length} of them still coincide in K1's own normal frame (K1 is open across the tile edge), ${g.broken} are apart at p = 0.5: that is K1's content, not a defect of the blend`, P.cross.length > 1000 && both.length === 0 && g.broken > 0, J([P.cross.length, both.length, g.broken]));
  // the review's mirror-axis single line: K1 leaves the axis, so the copies of K1 do not meet either; a K1 that stays on the axis keeps them together
  const mk = (K0b, K1b) => { const wm = makeRenderWorld('triangle', 5, 3, 'reflection_only'); wm.baseConnections(K0b); const x = wm.addKeyframeLayer(K0b), y = wm.addKeyframeLayer(K1b); wm.setTimeline([x, y]); const n2 = [D.layerNormal(wm, x), D.layerNormal(wm, y)]; wm.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); const s2 = n2[0].length / wm.get('spatialMorphRenderRecordTiles().length'), P2 = D.pairsOf(n2[0], s2), both2 = D.coincident(P2, P2.inside, n2); return { P2, both2, wm }; };
  const off = mk([[5, 8]], [[4, 8]]), on = mk([[5, 8]], [[5, 9]]);
  const gOff = D.gaps(off.P2, D.at(off.wm, 0.5), off.P2.inside), gOn = D.gaps(on.P2, D.at(on.wm, 0.5), on.P2.inside);
  check(`the review's mirror-axis line [[5,8]] -> [[4,8]] (reflection_only): ${off.P2.inside.length} junction pairs in K0, ${off.both2.length} still pairs in K1 (the node leaves the axis); and [[5,8]] -> [[5,9]], which stays on the axis, keeps all ${on.P2.inside.length} together (${gOn.broken} broken)`, off.P2.inside.length > 100 && off.both2.length === 0 && gOff.broken > 0 && on.P2.inside.length > 100 && on.both2.length === on.P2.inside.length && gOn.broken === 0, J([off.P2.inside.length, off.both2.length, gOff.broken, on.P2.inside.length, gOn.broken]));
});
T('open finding: symmetry copies of a corner endpoint', () => {
  // square / 3 / rotation_reflection6: an endpoint that is a polygon corner in keyframe 0 and the cell centre in keyframe 1. Its symmetry copies, which coincide in both keyframes, take their edge weights at the world image
  // of the canonical edge midpoint (a different world point per copy) and split. SOURCE: the prototype's rule, measured here; NOT a passing criterion (stage d2b removed the split by making such an endpoint interior,
  // which opened the seams of real patterns; its numbers are the ones before it: 88 of 13552 with exact ends, 286 now that p = 0 / 1 are projected).
  const q = corpus.filter((r) => r.qualifies && r.key === 'square/3/rotation_reflection6');
  const r0 = q.find((r) => J(r.conns) === '[[1,3],[1,5],[2,4],[2,5],[2,8]]'), r1 = q.find((r) => J(r.conns) === '[[1,5],[1,6],[1,9],[2,4],[2,8]]');
  if (!r0 || !r1) { check('the open-finding pattern pair exists in the corpus', false); return; }
  const res = D.runCase({ shape: 'square', order: 3, size: 3, mode: 'rotation_reflection6', conns: r0.conns, other: r1 }, 'iv', 2, [1, 2], [['linear', 0]], [0.5]);
  const x = res.rows[0];
  check(`OPEN FINDING (measured with the prototype's rule, not a criterion): the pinned case (case iv, linear 0, p = 0.5): ${x.m2c[0]} of ${x.m2c[1]} inside-tile pairs that coincide in both keyframes split (worst ${x.m2c[2].toFixed(1)} px)`, x.m2c[0] === 286 && x.m2c[1] === 13552 && Math.abs(x.m2c[2] - 141.4213562373095) < 1e-6, J(x.m2c));
  let n = 0, bad = 0, pairs = 0;
  for (const pat of corpusSample.concat(pats)) for (const [kc, nk] of [['ii', 3], ['iv', 2], ['iv', 3]]) {
    if (kc === 'iv' && !pat.other) continue;
    const r = D.runCase(pat, kc, nk, [pat.conns.length + 3, pat.conns.length + 9], [['linear', 0], ['radial', 0], ['bilinear', 0]], [0.25, 0.5, 0.75]);
    if (r.skip) continue; r.rows.forEach((y) => { n++; bad += y.m2c[0]; pairs += y.m2c[1]; });
  }
  check(`OPEN FINDING (measured with the prototype's rule, not a criterion): the sampled cases (ii with 3 keyframes, iv with 2 and 3, linear / radial / bilinear, p = 0.25 / 0.5 / 0.75): ${n} frames, ${bad} split pairs of ${pairs}`, n === 528 && bad === 9936 && pairs === 4645537, J([n, bad, pairs]));
});
// ================= 3. claim A: keyframe parameters =================
console.log('\n== 3. claim A: the morph uses the keyframe layer\'s own lattice, shape, symmetry mode and size factor ==');
const LINES = { square: [[[7, 13], [13, 19]], [[7, 17], [17, 19]], 5], triangle: [[[5, 8], [8, 11]], [[5, 9], [9, 12]], 5], hex: [[[2, 8], [8, 14]], [[2, 9], [9, 14]], 3] };
const SYMS = ['none', 'reflection_only', 'rotation6', 'rotation_reflection6'];
// a world: base sheet (shape, order, size, symmetry) + two (three) keyframe layers (kf size / symmetry), a timeline, the morph on (linear 0)
function world(shape, base, kf, nk) {
  const [c0, c1, order] = LINES[shape];
  const w = makeRenderWorld(shape, order, base.size, base.sym); w.baseConnections([]);
  const mk = (cs) => w.addKeyframeLayer(cs, { shape, order, size: kf.size, mode: kf.sym });
  const ids = [mk(c0), mk(c1)].concat(nk === 3 ? [mk(c0)] : []);
  w.setTimeline(ids); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  return { w, ids };
}
const normalOf = (w, id) => D.layerNormal(w, id);
// Stage d2c (the prototype's boundary rule, exact ends off): p = 0 / p = 1 show keyframe 0 / 1 with the boundary endpoints that change their edge (or lie off the one they share) PROJECTED onto the edge. The expected
// frame is the normal frame of a layer that holds those projected lines (same shape, size and symmetry mode as the keyframe layer, its own outer polygon); it is the keyframe's own normal frame when nothing is projected.
let projectedEnds = 0, projectedCases = 0;
function projectedNormal(w, ids, k, kf, shape, order) {
  const r = w.run('(function () { const r = resolveTimelineKeyframeCoords(timeline, 0); return { from: r.from, to: r.to }; })()');
  const poly = w.get(`additionalLayers[${ids[0]}].outerCorners`);
  const prep = D.M.spatialMorphPrepareLines(D.M.spatialMorphChooseCorners([r.from, r.to], 'linear'), poly);
  let projected = 0;
  const pick = (d) => { if (!(d.onBoundary && d.moved)) return d.points[k]; const q = d.edgePoints[k]; if (Math.hypot(q.x - d.points[k].x, q.y - d.points[k].y) > 1e-6) projected++; return q; };
  const nodes = [], conns = [];
  prep.forEach((pl, i) => { const a = pick(pl.a), b = pick(pl.b); nodes.push({ id: 2 * i + 1, x: a.x, y: a.y }, { id: 2 * i + 2, x: b.x, y: b.y }); conns.push([2 * i + 1, 2 * i + 2]); });
  const id = w.addKeyframeLayer(conns, { shape, order, size: kf.size, mode: kf.sym }); w.set(`additionalLayers[${id}].nodes = ${J(nodes)};`);
  projectedEnds += projected; if (projected) projectedCases++;
  return D.layerNormal(w, id);
}
T('equal to the normal frame of the keyframes', () => {
  let n = 0, ok = 0, worst = 0, bad = '', segs = 0;
  for (const shape of ['square', 'triangle', 'hex']) for (const sym of SYMS) for (const [bs, ks] of [[5, 3], [3, 5]]) {
    const baseSym = sym === 'none' ? 'rotation_reflection6' : (sym === 'rotation6' ? 'reflection_only' : 'none');   // never the keyframes' own mode
    const { w, ids } = world(shape, { size: bs, sym: baseSym }, { size: ks, sym }, 2);
    const [kc0, kc1, korder] = LINES[shape]; const nf = [0, 1].map((k) => projectedNormal(w, ids, k, { size: ks, sym }, shape, korder)); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
    for (const [p, k] of [[0, 0], [1, 1]]) { const f = D.at(w, p, 0), st = w.status().code, d = D.maxdiff(f, nf[k]); n++; worst = Math.max(worst, d); segs += f.length; if (d <= 1e-9 && f.length === nf[k].length && st === 'ok') ok++; else bad = bad || `${shape}/${sym}/base ${baseSym} size ${bs}/kf size ${ks} p ${p}: ${f.length} vs ${nf[k].length} segments, diff ${d}, status ${st}`; }
  }
  check(`p = 0 and p = 1 equal keyframe 0 / 1 (its normal frame; with the endpoints that change their edge projected onto it: ${projectedEnds} endpoints in ${projectedCases} of the cases), call for call, for 3 shapes x 4 symmetry modes x 2 size pairs with a base of another symmetry mode and another size: ${ok}/${n} (${segs} segments, worst ${worst.toExponential(1)} px)`, ok === n && n === 48, bad);
});
T('another shape than the base', () => {
  // the keyframes' shape is not the base sheet's: the lattice, the tile function and the symmetry operations are the keyframes' (the planner only requires the keyframes to agree with each other)
  let n = 0, ok = 0, segs = 0, bad = '';
  for (const [baseShape, kfShape] of [['square', 'hex'], ['hex', 'triangle'], ['triangle', 'square']]) for (const sym of ['none', 'rotation_reflection6']) {
    const [c0, c1, order] = LINES[kfShape], [, , baseOrder] = LINES[baseShape];
    const w = makeRenderWorld(baseShape, baseOrder, 3, 'rotation6'); w.baseConnections([]);
    const a = w.addKeyframeLayer(c0, { shape: kfShape, order, size: 3, mode: sym }), b = w.addKeyframeLayer(c1, { shape: kfShape, order, size: 3, mode: sym }); w.setTimeline([a, b]);
    const nf = [0, 1].map((k) => projectedNormal(w, [a, b], k, { size: 3, sym }, kfShape, order)); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
    for (const [p, k] of [[0, 0], [1, 1]]) { const f = D.at(w, p, 0), st = w.status().code, d = D.maxdiff(f, nf[k]); n++; segs += f.length; if (d <= 1e-9 && f.length === nf[k].length && st === 'ok') ok++; else bad = bad || `${baseShape} base / ${kfShape} keyframes / ${sym} p ${p}: ${f.length} vs ${nf[k].length} segments, diff ${d}, status ${st}`; }
  }
  check(`p = 0 and p = 1 equal the keyframes (projected where an endpoint changes its edge, see above) when their SHAPE is not the base's (square / hex / triangle, 2 symmetry modes): ${ok}/${n} (${segs} segments)`, ok === n && n === 12, bad);
});
T('same as a base that matches', () => {
  // the whole morph (span, tiles, symmetry copies, front) must be the one a MATCHING base draws: base (size, mode) = keyframes' (size, mode) gives the same frame as any other base
  let n = 0, ok = 0, bad = '';
  for (const shape of ['square', 'hex']) for (const sym of ['rotation_reflection6', 'reflection_only']) for (const mode of [['linear', 0], ['linear', 45], ['radial', 0]]) {
    const A = world(shape, { size: 5, sym: 'none' }, { size: 3, sym }, 2), B = world(shape, { size: 3, sym }, { size: 3, sym }, 2);
    A.w.setMorph({ enabled: true, mode: mode[0], angleDeg: mode[1] }); B.w.setMorph({ enabled: true, mode: mode[0], angleDeg: mode[1] });
    for (const p of [0.25, 0.5, 0.75]) { const fa = D.at(A.w, p, 0), fb = D.at(B.w, p, 0), d = D.maxdiff(fa, fb); n++; if (d <= 1e-9 && fa.length === fb.length && fa.length > 0) ok++; else bad = bad || `${shape}/${sym}/${mode} p ${p}: ${fa.length} vs ${fb.length}, diff ${d}`; }
  }
  check(`the front frames at p = 0.25 / 0.5 / 0.75 do not depend on the base's size and symmetry mode: ${ok}/${n} equal (1e-9 px) to a base that matches the keyframes (lattice, span and symmetry copies all come from the keyframe layer)`, ok === n && n === 36, bad);
  const A = world('square', { size: 5, sym: 'none' }, { size: 3, sym: 'rotation_reflection6' }, 3), B = world('square', { size: 3, sym: 'rotation_reflection6' }, { size: 3, sym: 'rotation_reflection6' }, 3);
  A.w.setMorph({ enabled: true, mode: 'bilinear', angleDeg: 0 }); B.w.setMorph({ enabled: true, mode: 'bilinear', angleDeg: 0 });
  const fa = D.at(A.w, 0, 0), fb = D.at(B.w, 0, 0);
  check(`the static bilinear blend of three keyframes does not depend on the base either (${fa.length} segments, worst difference ${D.maxdiff(fa, fb).toExponential(1)} px)`, fa.length > 0 && D.maxdiff(fa, fb) <= 1e-9);
});
T('parameterMismatch', () => {
  for (const [what, k0, k1] of [['symmetry mode', { size: 3, sym: 'none' }, { size: 3, sym: 'rotation6' }], ['size factor', { size: 3, sym: 'none' }, { size: 5, sym: 'none' }]]) {
    const [c0, c1, order] = LINES.square;
    for (const [route, tl] of [['timeline (front)', true], ['no timeline (static)', false]]) for (const mode of ['linear', 'bilinear']) {
      const w = makeRenderWorld('square', order, 3, 'none'); w.baseConnections([[7, 13], [13, 19]]);
      const a = w.addKeyframeLayer(c0, { shape: 'square', order, size: k0.size, mode: k0.sym }), b = w.addKeyframeLayer(c1, { shape: 'square', order, size: k1.size, mode: k1.sym });
      if (tl) w.setTimeline([a, b]);
      w.setMorph({ enabled: false, mode, angleDeg: 0 }); const normal = w.frame();
      w.setMorph({ enabled: true, mode, angleDeg: 0 }); let threw = null, f = null;
      const logged = []; const realErr = console.error, realWarn = console.warn; console.error = (...x) => logged.push(x); console.warn = (...x) => logged.push(x);
      try { f = w.frame(); } catch (e) { threw = e; } finally { console.error = realErr; console.warn = realWarn; }
      check(`keyframes that differ in ${what} (${route}, ${mode}): status parameterMismatch, the normal frame is drawn (${f ? f.length : '-'} segments), nothing thrown, nothing logged`, !threw && w.status().code === 'parameterMismatch' && f && D.maxdiff(f, normal) === 0 && f.length === normal.length && logged.length === 0, threw ? String(threw) : w.status().code);
    }
  }
  // the pure planner: absent fields are not compared (stage c callers), present ones are
  const M = D.M;
  const L2 = [{ shape: 'square', lineCount: 2, symmetryMode: 'none', sizeFactor: 3 }, { shape: 'square', lineCount: 2, symmetryMode: 'none', sizeFactor: 3 }];
  check('spatialMorphPlanKeyframes: equal parameters ok; a different symmetryMode or sizeFactor gives parameterMismatch; shapeMismatch and lineCountMismatch keep their precedence; a missing field is ignored',
    M.spatialMorphPlanKeyframes(L2, { mode: 'linear' }).ok === true && M.spatialMorphPlanKeyframes([L2[0], Object.assign({}, L2[1], { symmetryMode: 'rotation6' })], { mode: 'linear' }).code === 'parameterMismatch' && M.spatialMorphPlanKeyframes([L2[0], Object.assign({}, L2[1], { sizeFactor: 5 })], { mode: 'linear' }).code === 'parameterMismatch' &&
    M.spatialMorphPlanKeyframes([L2[0], Object.assign({}, L2[1], { shape: 'hex', sizeFactor: 5 })], { mode: 'linear' }).code === 'shapeMismatch' && M.spatialMorphPlanKeyframes([L2[0], Object.assign({}, L2[1], { lineCount: 3, sizeFactor: 5 })], { mode: 'linear' }).code === 'lineCountMismatch' &&
    M.spatialMorphPlanKeyframes([{ shape: 'square', lineCount: 2 }, { shape: 'square', lineCount: 2, symmetryMode: 'rotation6' }], { mode: 'linear' }).ok === true);
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
