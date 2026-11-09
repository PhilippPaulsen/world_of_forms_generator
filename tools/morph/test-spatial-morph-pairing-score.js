// Morph stage d3 (K1): spatialMorphScorePairing / spatialMorphComparePairingScore (core/spatial-morph.js), the pure score of a pairing (perm, flips, members).
//   1. identity of identical layers = 0 in all four numbers   2. role swap symmetry (all perms x flips, n = 4)   3. a wrong pairing that separates a node loses although its dist is smaller (the M1c counter-proof)
//   4. free line ends (tools/morph/off-path-specs.json, curve kind free)   5. purity (frozen inputs, snapshot before / after)   6. members through group elements   7. the lexicographic comparison
//   node tools/morph/test-spatial-morph-pairing-score.js
//   SPATIAL_MORPH_JS=/path/to/mutated/spatial-morph.js node tools/morph/test-spatial-morph-pairing-score.js        (sabotage runs)
'use strict';
const fs = require('fs'), path = require('path');
const M = require(process.env.SPATIAL_MORPH_JS || path.join(__dirname, '..', '..', 'core', 'spatial-morph.js'));
const { spatialMorphScorePairing: score, spatialMorphComparePairingScore: cmp } = M;

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 300)); } };
const J = (x) => JSON.stringify(x, (k, v) => (v instanceof Map ? { map: [...v] } : (v === Infinity ? 'inf' : v)));
const layer = (nodes, connections) => ({ nodes: nodes.map((n) => (Array.isArray(n) ? { id: n[0], x: n[1], y: n[2] } : { ...n })), connections });
const POLY = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const sameScore = (a, b) => a.dangling === b.dangling && a.nodeMiss === b.nodeMiss && a.boundaryMiss === b.boundaryMiss && close(a.dist, b.dist);
const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const perms = (n) => n <= 1 ? [[0]] : perms(n - 1).flatMap((p) => Array.from({ length: n }, (_, k) => [...p.slice(0, k), n - 1, ...p.slice(k)]));
const inverse = (p) => { const q = []; p.forEach((v, i) => { q[v] = i; }); return q; };

// a closed triangle plus a line from edge to edge: no free end; the second layer = the first, moved, other ids
const TRI = layer([[1, 20, 20], [2, 60, 20], [3, 40, 60], [4, 0, 50], [5, 100, 50]], [[1, 2], [2, 3], [3, 1], [4, 5]]);
const TRI2 = layer([[11, 25, 22], [12, 58, 24], [13, 44, 55], [14, 0, 40], [15, 100, 60]], [[11, 12], [12, 13], [13, 11], [14, 15]]);

console.log('== 1. identity ==');
T('identity', () => {
  const s = score(TRI, TRI, null, null, null, { poly: POLY });
  check('identical layers, identity: dangling 0, nodeMiss 0, boundaryMiss 0, dist 0, key all 0', s.dangling === 0 && s.nodeMiss === 0 && s.boundaryMiss === 0 && s.dist === 0 && J(s.key) === '[0,0,0,0]', J(s));
  const t = score(TRI, TRI, [0, 1, 2, 3], [false, false, false, false], null, { poly: POLY });
  check('an explicit identity perm and all-false flips give the same score', J(t) === J(s));
  const m = layer([[1, 20, 20], [2, 60, 20], [3, 40, 60], [4, 50, 50], [5, 100, 50]], TRI.connections);
  const b = score(TRI, m, null, null, null, { poly: POLY });
  check('a boundary node (4) that is interior in B: boundaryMiss 1 (A->B); with the roles swapped also 1 (B->A)', b.boundaryMiss === 1 && score(m, TRI, null, null, null, { poly: POLY }).boundaryMiss === 1, J(b));
  check('different line counts: the worst score', score(TRI, layer(TRI.nodes, [[1, 2]]), null, null, null, {}).dangling === Infinity);
});

console.log('\n== 2. symmetry under swapping the roles ==');
T('symmetry', () => {
  let n = 0, bad = 0;
  for (const p of perms(4)) for (let f = 0; f < 16; f++) {
    const fl = [0, 1, 2, 3].map((j) => !!(f >> j & 1)), o = { poly: POLY };
    const fwd = score(TRI, TRI2, p, fl, null, o);
    const rev = score(TRI2, TRI, inverse(p), p.map((_, i) => fl[p[i]]), null, o);
    n++; if (!sameScore(fwd, rev)) bad++;
  }
  check(`all ${n} (perm, flips) of n = 4: score(A,B,p,f) equals score(B,A,p^-1,f') in the three counts and dist`, n === 24 * 16 && bad === 0, bad + ' differ');
});

console.log('\n== 3. a wrong pairing that separates a node loses although its dist is smaller ==');
T('wrong pairing', () => {
  // A: a V (lines N-P, N-Q); B: A turned by about 90 degrees about N (uneven, so no accidental meeting of ends). The right pairing keeps N whole (2 free ends); the swapped one with a flip has the smaller dist but splits N.
  const A = layer([[1, 0, 0], [2, 10, 0], [3, 0, 10]], [[1, 2], [1, 3]]);
  const B = layer([[1, 0, 0], [2, 0, 12], [3, -7, 0]], [[1, 2], [1, 3]]);
  const right = score(A, B, [0, 1], null, null, {}), wrong = score(A, B, [1, 0], [false, true], null, {});
  check('right: dangling 2, nodeMiss 0; wrong: dangling 4, nodeMiss > 0', right.dangling === 2 && right.nodeMiss === 0 && wrong.dangling === 4 && wrong.nodeMiss > 0, J([right, wrong]));
  check('the wrong pairing has the SMALLER dist (153 against 393) and still compares worse', wrong.dist < right.dist && cmp(right, wrong) < 0 && cmp(wrong, right) > 0, J([right.dist, wrong.dist]));
  let best = null; for (const p of perms(2)) for (const fl of [[false, false], [false, true], [true, false], [true, true]]) { const s = score(A, B, p, fl, null, {}); if (best === null || cmp(s, best) < 0) best = s; }
  check('the best of all 8 candidates keeps N whole (2 free ends, nodeMiss 0; both whole pairings tie there and dist decides: 293 before 393), the node-splitting ones all rank behind', J(best.key) === '[2,0,0,293]' && perms(2).every((p) => [[false, false], [false, true], [true, false], [true, true]].every((fl) => { const s = score(A, B, p, fl, null, {}); return s.nodeMiss === 0 || cmp(best, s) < 0; })));
  // B merges nodes that A keeps apart: only the B->A direction sees it
  const A2 = layer([[1, 0, 0], [2, 10, 0], [3, 50, 0], [4, 60, 0]], [[1, 2], [3, 4]]);
  const B2 = layer([[1, 0, 0], [2, 10, 0], [3, 60, 0]], [[1, 2], [2, 3]]);
  const m = score(A2, B2, null, null, null, {});
  check('A keeps two lines apart, B joins them in a node: nodeMiss 1 (B->A only); swapped roles: also 1 (A->B then)', m.nodeMiss === 1 && score(B2, A2, null, null, null, {}).nodeMiss === 1, J(m));
});

console.log('\n== 4. free line ends (off-path-specs.json, curve kind free) ==');
T('free ends', () => {
  const specs = JSON.parse(fs.readFileSync(path.join(__dirname, 'off-path-specs.json'), 'utf8')), sp = specs.find((x) => x.curve && x.curve.kind === 'free');
  check('the spec exists: three lines on six different nodes', !!sp && sp.connections.length === 3 && new Set(sp.connections.flat()).size === 6);
  const ids = [...new Set(sp.connections.flat())], nodes = ids.map((id, k) => [id, 10 + 15 * k, 20 + 7 * (k % 3)]);
  const L = layer(nodes, sp.connections);
  const s = score(L, L, null, null, null, {});
  check('identity: all six ends are free (dangling 6), nothing else', s.dangling === 6 && s.nodeMiss === 0 && s.boundaryMiss === 0 && s.dist === 0, J(s));
  const half = layer(nodes.map(([id, x, y]) => [id, x, y]), [sp.connections[0], [sp.connections[0][1], sp.connections[1][0]], sp.connections[2]]);
  check('joining two lines in a node removes two free ends (4 left); a lone incomplete connection does not count as a line', score(half, half, null, null, null, {}).dangling === 4 && score(layer(nodes, [...sp.connections, [ids[0]]]), L, null, null, null, {}).dangling === 6);
});

console.log('\n== 5. purity ==');
T('purity', () => {
  const ge = { groupOrder: 2, perms: [new Map(), new Map([[1, 2], [2, 1], [3, 3], [4, 4], [5, 5]])] };
  const A = JSON.parse(J(TRI)), B = JSON.parse(J(TRI2)), p = [2, 0, 3, 1], f = [true, false, false, true], mem = [1, 0, 0, 0], o = { poly: POLY.map((q) => ({ ...q })), groupElements: ge };
  const before = J([A, B, p, f, mem, o]);
  const s1 = score(deepFreeze(A), deepFreeze(B), deepFreeze(p), deepFreeze(f), deepFreeze(mem), deepFreeze(o));
  check('frozen inputs do not throw; the inputs are deep-equal before and after', J([A, B, p, f, mem, o]) === before);
  check('two calls give the same score; the result is a new object (no input aliased)', J(s1) === J(score(A, B, p, f, mem, o)) && s1.key !== p && s1.key !== f);
  const src = fs.readFileSync(process.env.SPATIAL_MORPH_JS || path.join(__dirname, '..', '..', 'core', 'spatial-morph.js'), 'utf8');
  const body = src.slice(src.indexOf('function spatialMorphPairingLines'), src.indexOf("if (typeof module !== 'undefined'"));
  check('the new code touches no store, no global, no DOM (no sketch / window / document / additionalLayers / timeline / Math.random)', !/\b(window|document|additionalLayers|timeline|segmentPairings|Math\.random|console)\b/.test(body));
});

console.log('\n== 6. members ==');
T('members', () => {
  const ge = { groupOrder: 2, perms: [new Map(), new Map([[11, 12], [12, 11], [13, 13], [14, 14], [15, 15]])] };
  const o = { poly: POLY, groupElements: ge };
  const a = score(TRI, TRI2, null, null, [0, 0, 0, 0], o), b = score(TRI, TRI2, null, null, [1, 0, 0, 0], o);
  check('member 1 on line 0 (ends 11, 12 swapped) changes dist, an all-zero members vector equals none', a.dist !== b.dist && J(a) === J(score(TRI, TRI2, null, null, null, o)));
  check('members without group elements, wrong length or out of range count as absent', J(score(TRI, TRI2, null, null, [1, 0, 0, 0], { poly: POLY })) === J(a) && J(score(TRI, TRI2, null, null, [1], o)) === J(a) && J(score(TRI, TRI2, null, null, [7, 0, 0, 0], o)) === J(a));
});

console.log('\n== 7. comparison ==');
T('compare', () => {
  const s = (d, n, b, x) => ({ dangling: d, nodeMiss: n, boundaryMiss: b, dist: x, key: [d, n, b, x] });
  check('lexicographic: dangling first, then nodeMiss, boundaryMiss, dist', cmp(s(0, 9, 9, 9), s(1, 0, 0, 0)) < 0 && cmp(s(1, 0, 9, 9), s(1, 1, 0, 0)) < 0 && cmp(s(1, 1, 0, 9), s(1, 1, 1, 0)) < 0 && cmp(s(1, 1, 1, 1), s(1, 1, 1, 2)) < 0 && cmp(s(1, 1, 1, 1), s(1, 1, 1, 1)) === 0);
  check('Infinity (worst score) is last; a value without key is worse than any score', cmp(s(5, 5, 5, 5), score(TRI, layer([], []), null, null, null, {})) < 0 && cmp({}, s(0, 0, 0, 0)) > 0);
});

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
