// Morph stage d3 (K2): spatialMorphFilterPairingCandidates (core/spatial-morph.js), the pure filter of a candidate list ({ perm, flips, members, ...extra }) down to the conclusive pairings.
//   1. a separating pairing with the smaller dist drops out (the M1c counter-proof)   2. none conclusive: kept [], empty   3. order: best score first, ties in input order, over all 48 (perm, flips) of a triangle
//   4. free line ends (tools/morph/off-path-specs.json, curve kind free)   5. purity and the counts   6. invalid / unequal layers, odd lists   7. extra fields, opts.poly
//   node tools/morph/test-spatial-morph-pairing-filter.js
//   SPATIAL_MORPH_JS=/path/to/mutated/spatial-morph.js node tools/morph/test-spatial-morph-pairing-filter.js        (sabotage runs)
'use strict';
const fs = require('fs'), path = require('path');
const M = require(process.env.SPATIAL_MORPH_JS || path.join(__dirname, '..', '..', 'core', 'spatial-morph.js'));
const { spatialMorphFilterPairingCandidates: filter, spatialMorphScorePairing: score, spatialMorphComparePairingScore: cmp } = M;

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 300)); } };
const J = (x) => JSON.stringify(x, (k, v) => (v === Infinity ? 'inf' : v));
const layer = (nodes, connections) => ({ nodes: nodes.map(([id, x, y]) => ({ id, x, y })), connections });
const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const perms = (n) => n <= 1 ? [[0]] : perms(n - 1).flatMap((p) => Array.from({ length: n }, (_, k) => [...p.slice(0, k), n - 1, ...p.slice(k)]));

// a closed triangle and the same turned about node 1 (uneven, no accidental meetings): no free end in either
const A = layer([[1, 0, 0], [2, 10, 0], [3, 0, 10]], [[1, 2], [2, 3], [3, 1]]);
const B = layer([[1, 0, 0], [2, 0, 12], [3, -7, 0]], [[1, 2], [2, 3], [3, 1]]);
const ALL = []; for (const p of perms(3)) for (let f = 0; f < 8; f++) ALL.push({ perm: p, flips: [0, 1, 2].map((j) => !!(f >> j & 1)), members: null, tag: ALL.length });
const PRISTINE = J([A, B, ALL]);   // taken before any call: a mutation of a shared fixture by an earlier test cannot hide in the purity snapshots
const keep = (c) => { const s = score(A, B, c.perm, c.flips, c.members, {}); return s.dangling === 0 && s.boundaryMiss === 0; };

console.log('== 1. a separating pairing drops out although its dist is smaller ==');
T('separating', () => {
  const good = { perm: [0, 1, 2], flips: [false, false, false], members: null, tag: 'good' }, bad = { perm: [2, 0, 1], flips: [false, false, true], members: null, tag: 'bad' };
  const sg = score(A, B, good.perm, good.flips, null, {}), sb = score(A, B, bad.perm, bad.flips, null, {});
  check('the setup: the separating candidate has the smaller dist and is not conclusive', sb.dist < sg.dist && sb.dangling > 0 && sb.nodeMiss > 0 && sg.dangling === 0 && sg.nodeMiss === 0, J([sg.key, sb.key]));
  const r = filter(A, B, [bad, good], {});
  check('kept = [good] only, dropped 1, total 2, empty false', r.kept.length === 1 && r.kept[0].tag === 'good' && r.dropped === 1 && r.total === 2 && r.empty === false, J(r.kept.map((c) => c.tag)));
  // same coordinates, different ids: geometrically closed (dangling 0), but node 1 is two nodes in B, so only nodeMiss sees it
  const Bsplit = layer([[1, 0, 0], [2, 0, 12], [3, -7, 0], [4, 0, 0]], [[1, 2], [2, 3], [3, 4]]), sp = score(A, Bsplit, [0, 1, 2], null, null, {});
  const rsp = filter(A, Bsplit, [{ perm: [0, 1, 2] }, { perm: [1, 2, 0] }], {});
  check('task 022: a pairing that only nodeMiss objects to (dangling 0, boundaryMiss 0, nodeMiss > 0) STAYS in the list (nodeMiss only orders the kept ones); a separating one still drops out', sp.dangling === 0 && sp.boundaryMiss === 0 && sp.nodeMiss > 0 && filter(A, Bsplit, [{ perm: [0, 1, 2] }], {}).kept.length === 1 && rsp.kept.every((c) => c.score.dangling === 0 && c.score.boundaryMiss === 0) && rsp.kept.every((c, k) => k === 0 || cmp(rsp.kept[k - 1].score, c.score) <= 0), J(sp.key));
  check('the kept candidate carries its score (key [0, 0, 0, dist])', J(r.kept[0].score) === J(sg) && J(r.kept[0].score.key) === J([0, 0, 0, sg.dist]));
});

console.log('\n== 2. none conclusive ==');
T('none', () => {
  const bad = ALL.filter((c) => !keep(c)).slice(0, 5), r = filter(A, B, bad, {});
  check('5 unconclusive candidates: kept [], empty true, dropped 5, total 5 (no substitute list)', Array.isArray(r.kept) && r.kept.length === 0 && r.empty === true && r.dropped === 5 && r.total === 5);
  const e = filter(A, B, [], {});
  check('an empty list: kept [], empty true, total 0', e.kept.length === 0 && e.empty === true && e.total === 0 && e.dropped === 0);
});

console.log('\n== 3. order ==');
T('order', () => {
  const r = filter(A, B, ALL, {}), want = ALL.filter(keep);
  check('of the 48 (perm, flips) of the triangle exactly 6 are conclusive', ALL.length === 48 && r.kept.length === 6 && r.dropped === 42 && r.total === 48 && want.length === 6, r.kept.length);
  const dists = r.kept.map((c) => c.score.dist);
  check('best score first: dist ascending (all other numbers are 0)', dists.every((d, i) => i === 0 || dists[i - 1] <= d) && dists[0] < dists[5], dists.join());
  const ties = r.kept.filter((c) => c.score.dist === dists.find((d) => dists.filter((x) => x === d).length > 1));
  check('equal scores keep the input order (three candidates tie, their tags ascend)', ties.length === 3 && ties.every((c, i) => i === 0 || ties[i - 1].tag < c.tag), ties.map((c) => c.tag).join());
  const rev = filter(A, B, ALL.slice().reverse(), {}), tiesRev = rev.kept.filter((c) => c.score.dist === ties[0].score.dist);
  check('reversing the input reverses the tie order (it is the input order, not the content)', tiesRev.map((c) => c.tag).join() === ties.map((c) => c.tag).reverse().join());
  check('the first element is the minimum of the comparison over all kept', r.kept.every((c) => cmp(r.kept[0].score, c.score) <= 0));
});

console.log('\n== 4. free line ends (off-path-specs.json, curve kind free) ==');
T('free', () => {
  const specs = JSON.parse(fs.readFileSync(path.join(__dirname, 'off-path-specs.json'), 'utf8')), sp = specs.find((x) => x.curve && x.curve.kind === 'free');
  const ids = [...new Set(sp.connections.flat())], L = layer(ids.map((id, k) => [id, 10 + 15 * k, 20 + 7 * (k % 3)]), sp.connections);
  const r = filter(L, L, [{ perm: [0, 1, 2] }, { perm: [1, 0, 2] }], {});
  check('the layer has six free ends: dangling counts them, so no candidate is conclusive (kept [], empty)', score(L, L, [0, 1, 2], null, null, {}).dangling === 6 && r.kept.length === 0 && r.empty === true && r.dropped === 2);
  const closed = layer(ids.slice(0, 3).map((id, k) => [id, 10 + 15 * k, 20 + 7 * k]), [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]]);
  check('a candidate of the same shape without free ends (a closed triangle) is kept', filter(closed, closed, [{ perm: [0, 1, 2] }], {}).kept.length === 1);
});

console.log('\n== 5. purity and counts ==');
T('purity', () => {
  const [a, b, list] = JSON.parse(PRISTINE), o = { poly: [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }] };
  const before = J([a, b, list, o]);
  const r = filter(deepFreeze(a), deepFreeze(b), deepFreeze(list), deepFreeze(o));
  check('deep-frozen inputs do not throw; layers, list and options are deep-equal before and after', J([a, b, list, o]) === before);
  const [a2, b2, l2] = JSON.parse(PRISTINE), o2 = JSON.parse(J(o)), snap = J([a2, b2, l2, o2]);
  filter(a2, b2, l2, o2);
  check('the shared fixtures are still as built (no test call wrote to them)', J([A, B, ALL]) === PRISTINE);
  check('the same with plain (not frozen) inputs: nothing is written to the layers, the list, its candidates or the options', J([a2, b2, l2, o2]) === snap);
  check('dropped + kept.length === total', r.dropped + r.kept.length === r.total && r.total === 48);
  check('kept holds copies (no input candidate is returned itself) and the input candidates have no score field', r.kept.every((c) => !list.includes(c)) && list.every((c) => !('score' in c)));
  const src = fs.readFileSync(process.env.SPATIAL_MORPH_JS || path.join(__dirname, '..', '..', 'core', 'spatial-morph.js'), 'utf8');
  const body = src.slice(src.indexOf('function spatialMorphFilterPairingCandidates'), src.indexOf("if (typeof module !== 'undefined'"));
  check('the new code touches no store, no global, no DOM', !/\b(window|document|additionalLayers|timeline|segmentPairings|Math\.random|console)\b/.test(body));
});

console.log('\n== 6. invalid input ==');
T('invalid', () => {
  const c = [{ perm: [0, 1, 2], flips: null, members: null }];
  const odd = [filter(null, B, c, {}), filter(A, undefined, c, {}), filter({}, {}, c, {}), filter(A, layer(B.nodes.map((n) => [n.id, n.x, n.y]), [[1, 2]]), c, {}), filter(A, B, null, {}), filter(A, B, 'x', {}), filter(A, B, [null, 5, 'x', undefined], {}), filter(A, B, c, null)];
  check('null / undefined / empty layers, unequal line counts: kept [], empty true, no crash', odd.slice(0, 4).every((r) => r.kept.length === 0 && r.empty === true && r.total === 1 && r.dropped === 1));
  check('a non-array list is an empty list; non-object entries are dropped and counted', odd[4].total === 0 && odd[5].total === 0 && odd[6].total === 4 && odd[6].dropped === 4 && odd[6].empty === true);
  check('opts null is fine (the candidate is scored without a boundary)', odd[7].kept.length === 1);
  check('a stale perm (wrong length) counts as absent, as in the score: the candidate is the index order', filter(A, B, [{ perm: [0, 1] }], {}).kept.length === 1);
});

console.log('\n== 7. extra fields and opts.poly ==');
T('extra', () => {
  const x = { perm: [0, 1, 2], displacement: 12.5, key: 'k', ids: [1, 2], nested: { a: [1] } };
  const r = filter(A, B, [x], {});
  check('extra fields pass through unchanged (same values; nested objects are the same references)', r.kept.length === 1 && r.kept[0].displacement === 12.5 && r.kept[0].key === 'k' && r.kept[0].ids === x.ids && r.kept[0].nested === x.nested);
  const BP = [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -100, y: 100 }];
  const edgeA = layer([[1, 0, 0], [2, 100, 0], [3, 0, 100]], [[1, 2], [2, 3], [3, 1]]), edgeB = layer([[1, 0, 0], [2, 50, 0], [3, 0, 50]], [[1, 2], [2, 3], [3, 1]]);
  const all6 = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map((perm) => ({ perm }));
  const withPoly = filter(edgeA, edgeB, all6, { poly: BP }), noPoly = filter(edgeA, edgeB, all6, {}), danglingOk = all6.filter((c) => score(edgeA, edgeB, c.perm, null, null, { poly: BP }).dangling === 0).length;
  check('opts.poly is passed on (task 023: boundaryMiss no longer excludes, it only orders): with the polygon a pairing that moves boundary node 2 into the tile stays in the list (boundaryMiss > 0, ordered by the score); without the polygon boundaryMiss is 0 everywhere; dangling > 0 still drops out', withPoly.kept.length === danglingOk && withPoly.kept.length > 0 && withPoly.kept.every((c) => c.score.boundaryMiss > 0) && withPoly.kept.every((c, k) => k === 0 || cmp(withPoly.kept[k - 1].score, c.score) <= 0) && noPoly.kept.every((c) => c.score.boundaryMiss === 0), J([withPoly.kept.length, danglingOk, noPoly.kept.length]));
  check('task 023: a candidate with a loose end (dangling > 0) is dropped whatever its boundaryMiss', filter(layer([[1, 0, 0], [2, 10, 0], [3, 5, 8]], [[1, 2]]), layer([[1, 0, 0], [2, 10, 0], [3, 5, 8]], [[1, 2]]), [{ perm: [0] }], { poly: BP }).kept.length === 0);
});

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
