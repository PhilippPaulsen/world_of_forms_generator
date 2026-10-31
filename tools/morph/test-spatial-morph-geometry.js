// Guard for the geometry half of core/spatial-morph.js (morph stage a2): corner line sets, the corner rule, the blend of a whole line set, and boundary anchoring. Pure functions.
// Properties (every one is a check below): validation never throws and gives an error code for every kind of bad input; the corner rule for 2 / 3 / 4 keyframes (bilinear) and for
// linear / radial (two keyframes only); the 2-keyframe blend at a constant weight equals the timeline's uniform morph (applyLayerConnectionsMorphFrame, cut out of sketch.js) bit for
// bit; the blend returns new arrays and is an affine combination; edge detection (index, parameter, tolerance 1 px by default, tolerance 0, corner, zero-length edge, NaN); the
// anchored point (interior: tile weights; static boundary: fixed; moving boundary: projected on the edge and blended with the EDGE weights, never the tile weights); no input is changed
// (deep-frozen, strict mode); no global is read; same input, same bytes; and GOLDEN segments (tools/morph/spatial-morph-a2-golden.json: 13 cases, 26 tile samples, 2952 numbers) taken
// from the PROTOTYPE's own drawSpatialMorphCell() run in a vm with the real core tiling, so this test does not depend on the prototype tree. The seam measurement is its own file
// (test-spatial-morph-seams.js).
//   node tools/morph/test-spatial-morph-geometry.js
//   SPATIAL_MORPH_JS=/path/to/mutated/spatial-morph.js node tools/morph/test-spatial-morph-geometry.js        (sabotage runs)
//   SPATIAL_MORPH_A2_GOLDEN=/path/to/mutated/golden.json node tools/morph/test-spatial-morph-geometry.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const FILE = process.env.SPATIAL_MORPH_JS || path.join(ROOT, 'core', 'spatial-morph.js');
const GOLDEN_FILE = process.env.SPATIAL_MORPH_A2_GOLDEN || path.join(__dirname, 'spatial-morph-a2-golden.json');
const SRC = fs.readFileSync(FILE, 'utf8');
const M = require(FILE);
const H = require('./morph-harness.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 300)); } };
const J = (x) => JSON.stringify(x);
const same = (a, b) => J(a) === J(b);
const close = (a, b, tol) => Math.abs(a - b) <= tol;
const L = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
const sq = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];   // the base cell: a square, edges 0 (top) 1 (right) 2 (bottom) 3 (left)
let seed = 987654321;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

console.log('== constants ==');
T('constants', () => {
  check('the boundary tolerance is 1 px and the same-point tolerance is 1e-4 px (the prototype\'s SPATIAL_MORPH_BOUNDARY_EPS and SPATIAL_MORPH_SAME_PT_EPS)', M.spatialMorphBoundaryTolerance === 1.0 && M.spatialMorphSamePointTolerance === 1e-4);
});

console.log('\n== validation of the four corner line sets ==');
T('validate', () => {
  const ok = { k00: [L(1, 2, 3, 4)], k10: [L(5, 6, 7, 8)], k01: [L(1, 2, 3, 4)], k11: [L(5, 6, 7, 8)] };
  check('four sets of the same length with finite numbers are ok and report the count', same(M.spatialMorphValidateCorners(ok), { ok: true, count: 1 }));
  const codes = [
    ['nothing at all', undefined, 'not-object', 'undefined'], ['null', null, 'not-object', 'object'], ['a number', 5, 'not-object', 'number'],
    ['k01 missing', { k00: [], k10: [], k11: [] }, 'missing-corner', 'k01'],
    ['k10 is not an array', { k00: [L(1, 2, 3, 4)], k10: 'x', k01: [L(1, 2, 3, 4)], k11: [L(1, 2, 3, 4)] }, 'not-array', 'k10'],
    ['different counts', { k00: [L(1, 2, 3, 4), L(1, 2, 3, 4)], k10: [L(1, 2, 3, 4), L(1, 2, 3, 4)], k01: [L(1, 2, 3, 4), L(1, 2, 3, 4)], k11: [L(1, 2, 3, 4)] }, 'count-mismatch', '2,2,2,1'],
    ['no lines at all', { k00: [], k10: [], k01: [], k11: [] }, 'empty', '0'],
    ['a null line', { k00: [L(1, 2, 3, 4)], k10: [L(1, 2, 3, 4)], k01: [null], k11: [L(1, 2, 3, 4)] }, 'bad-line', 'k01[0]'],
    ['a line without y2', { k00: [L(1, 2, 3, 4)], k10: [L(1, 2, 3, 4)], k01: [L(1, 2, 3, 4)], k11: [{ x1: 1, y1: 2, x2: 3 }] }, 'bad-line', 'k11[0]'],
    ['a coordinate that is a string', { k00: [L(1, 2, 3, 4)], k10: [L(1, 2, '3', 4)], k01: [L(1, 2, 3, 4)], k11: [L(1, 2, 3, 4)] }, 'bad-line', 'k10[0]'],
    ['a NaN', { k00: [L(1, 2, 3, 4)], k10: [L(1, 2, NaN, 4)], k01: [L(1, 2, 3, 4)], k11: [L(1, 2, 3, 4)] }, 'bad-number', 'k10[0].x2'],
    ['an infinity in the second line', { k00: [L(1, 2, 3, 4), L(1, 2, 3, 4)], k10: [L(1, 2, 3, 4), L(1, 2, 3, 4)], k01: [L(1, 2, 3, 4), L(1, -Infinity, 3, 4)], k11: [L(1, 2, 3, 4), L(1, 2, 3, 4)] }, 'bad-number', 'k01[1].y1'],
  ];
  codes.forEach(([what, input, code, detail]) => {
    let r, threw = null; try { r = M.spatialMorphValidateCorners(input); } catch (e) { threw = e; }
    check(`${what}: ok false, code '${code}', detail '${detail}', no throw`, threw === null && r && r.ok === false && r.code === code && r.detail === detail, threw ? threw.message : J(r));
  });
});

console.log('\n== which layers are the keyframes ==');
T('select', () => {
  const lay = (shape, n, extra) => Object.assign({ shape, lineCount: n }, extra || {});
  const S = M.spatialMorphSelectKeyframeLayers;
  const four = [lay('square', 3), lay('square', 3), lay('square', 3), lay('square', 3)];
  check('bilinear: a timeline of four matching layers gives those four, in the timeline\'s order', same(S(four, { mode: 'bilinear', timelineIds: [2, 0, 3, 1] }), { ok: true, ids: [2, 0, 3, 1], source: 'keyframes' }));
  check('bilinear: more than four matching timeline layers give the first four', same(S(four.concat([lay('square', 3), lay('square', 3)]), { mode: 'bilinear', timelineIds: [0, 1, 2, 3, 4, 5] }).ids, [0, 1, 2, 3]));
  check('bilinear: a timeline with two layers is filled up from the other matching layers in index order (the prototype\'s behaviour)', same(S(four, { mode: 'bilinear', timelineIds: [1, 3] }).ids, [1, 3, 0, 2]));
  check('...and fillFromLayers: false keeps the timeline\'s two layers', same(S(four, { mode: 'bilinear', timelineIds: [1, 3], fillFromLayers: false }).ids, [1, 3]));
  check('bilinear: a layer with another line count, another shape or the playback flag is left out', same(S([lay('square', 3), lay('square', 4), lay('hex', 3), lay('square', 3, { isPlayback: true }), lay('square', 3)], { mode: 'bilinear', timelineIds: [0, 1, 2, 3, 4] }).ids, [0, 4]));
  check('bilinear: no timeline: the layers that match the first one, source layers', same(S([lay('square', 3), lay('square', 3), lay('square', 5), lay('square', 3)], { mode: 'bilinear' }), { ok: true, ids: [0, 1, 3], source: 'layers' }));
  check('bilinear: one layer and a matching base sheet: the base (id \'base\') is keyframe 0', same(S([lay('square', 3)], { mode: 'bilinear', base: { shape: 'square', lineCount: 3 } }), { ok: true, ids: ['base', 0], source: 'base' }));
  check('...a base with another line count or shape is no pair', S([lay('square', 3)], { mode: 'bilinear', base: { shape: 'square', lineCount: 4 } }).code === 'no-pair' && S([lay('square', 3)], { mode: 'bilinear', base: { shape: 'hex', lineCount: 3 } }).code === 'no-pair');
  check('...and two layers never use the base', same(S([lay('square', 3), lay('square', 3)], { mode: 'bilinear', base: { shape: 'square', lineCount: 3 } }).ids, [0, 1]));
  check('linear / radial: exactly the timeline\'s first two layers, with NO shape or count filter (the prototype\'s resolveSpatialMorphKeyframes)', same(S([lay('square', 3), lay('hex', 9), lay('square', 3)], { mode: 'linear', timelineIds: [1, 2, 0] }), { ok: true, ids: [1, 2], source: 'keyframes' }) && same(S(four, { mode: 'radial', timelineIds: [3, 0, 1, 2] }).ids, [3, 0]));
  check('linear / radial without a timeline: the first two layers that are not playback layers; one layer and a matching base: the base', same(S([lay('square', 3, { isPlayback: true }), lay('square', 3), lay('square', 3)], { mode: 'linear' }), { ok: true, ids: [1, 2], source: 'layers' }) && same(S([lay('square', 3)], { mode: 'radial', base: { shape: 'square', lineCount: 3 } }).ids, ['base', 0]));
  const garbage = [[undefined, undefined], [null, {}], [[], {}], [[null, null], { timelineIds: [0, 1] }], [[lay('square', 3)], { timelineIds: [7, 9], mode: 'bilinear' }], ['x', 5]];
  check('garbage (no layers, null layers, ids out of range) is {ok: false, code: no-pair} and never throws', garbage.every(([l, o]) => { try { const r = S(l, o); return r.ok === false && r.code === 'no-pair'; } catch (e) { return false; } }));
});

console.log('\n== the corner rule ==');
T('corners', () => {
  const A = [L(0, 0, 1, 1)], B = [L(2, 2, 3, 3)], C = [L(4, 4, 5, 5)], D = [L(6, 6, 7, 7)], E = [L(8, 8, 9, 9)];
  const C4 = M.spatialMorphChooseCorners;
  let r = C4([A, B], 'bilinear');
  check('2 keyframes (bilinear): k00 = K0, k10 = K1, k01 = K0, k11 = K1 (the SAME arrays), keyframeCount 2', r.ok && r.k00 === A && r.k10 === B && r.k01 === A && r.k11 === B && r.keyframeCount === 2);
  r = C4([A, B, C], 'bilinear');
  check('3 keyframes (bilinear): k01 = K2 and k11 = K1', r.ok && r.k00 === A && r.k10 === B && r.k01 === C && r.k11 === B && r.keyframeCount === 3);
  r = C4([A, B, C, D], 'bilinear');
  check('4 keyframes (bilinear): all four, k11 = K3', r.ok && r.k00 === A && r.k10 === B && r.k01 === C && r.k11 === D && r.keyframeCount === 4);
  r = C4([A, B, C, D, E], 'bilinear');
  check('more than four: the first four', r.ok && r.k11 === D && r.keyframeCount === 4);
  ['linear', 'radial', 'weird', undefined].forEach((m) => { r = C4([A, B, C, D], m); check(`mode ${String(m)}: only K0 and K1 take part whatever else is given (k01 = K0, k11 = K1), keyframeCount 2`, r.ok && r.k01 === A && r.k11 === B && r.keyframeCount === 2); });
  check('fewer than two arrays (one, none, not an array, entries that are not arrays) is {ok: false, code: too-few-keyframes}', [[A], [], null, undefined, 'x', [A, null], [A, 'x']].every((k) => { const q = C4(k, 'bilinear'); return q.ok === false && q.code === 'too-few-keyframes'; }));
  const kf = [[L(1, 2, 3, 4)], [L(5, 6, 7, 8)], [L(1, 1, 1, 1)], [L(2, 2, 2, 2)]];
  check('the corners the rule gives pass the validation', [2, 3, 4].every((n) => M.spatialMorphValidateCorners(C4(kf.slice(0, n), 'bilinear')).ok === true));
});

console.log('\n== the 2-keyframe blend equals the timeline\'s uniform morph, bit for bit ==');
T('uniform', () => {
  const sketch = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
  const grab = (name) => { const m = sketch.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
  const sb = { lerp: (a, b, t) => t * (b - a) + a };   // p5 1.9.0: p5.prototype.lerp = function (start, stop, amt) { return amt * (stop - start) + start; }
  vm.createContext(sb);
  vm.runInContext(grab('ensureLayerMorphIds') + '\n' + grab('applyLayerConnectionsMorphFrame'), sb);
  const n = 9;
  const k0 = Array.from({ length: n }, () => L(rnd() * 600, rnd() * 600, rnd() * 600, rnd() * 600));
  const k1 = Array.from({ length: n }, () => L(rnd() * 600, rnd() * 600, rnd() * 600, rnd() * 600));
  const corners = M.spatialMorphChooseCorners([k0, k1], 'bilinear');
  const ts = [0, 1, 0.5, 1 / 3, 2 / 3, 0.1, 0.9, 1e-9, 1 - 1e-9].concat(Array.from({ length: 300 }, () => rnd()));
  let bad = 0, worst = 0;
  ts.forEach((t) => {
    const layer = {}; sb.applyLayerConnectionsMorphFrame(layer, { fromConnections: k0, toConnections: k1 }, t);
    const mine = M.spatialMorphBlendLines(corners, { w00: 1 - t, w10: t, w01: 0, w11: 0 });
    layer._morphNodes.forEach((nd, i) => {
      const m = layer._morphNodes[i]; const line = mine[Math.floor(i / 2)]; const a = i % 2 === 0 ? [line.x1, line.y1] : [line.x2, line.y2];
      if (m.x !== a[0] || m.y !== a[1]) { bad++; worst = Math.max(worst, Math.abs(m.x - a[0]), Math.abs(m.y - a[1])); }
    });
  });
  check(`for ${ts.length} values of t (0, 1, thirds, 1e-9 from the ends, 300 random) the lerp of applyLayerConnectionsMorphFrame (cut out of sketch.js; p5's lerp formula) and spatialMorphBlendLines at the weights (1 - t, t, 0, 0) are the same doubles: ${bad} differ`, bad === 0, worst);
  const lin = M.spatialMorphCornerWeights('linear', { x: 130, y: 75 }, { scalarMin: 0, scalarMax: 400 }, { angleDeg: 0, center: { x: 0, y: 0 } });
  const layer = {}; sb.applyLayerConnectionsMorphFrame(layer, { fromConnections: k0, toConnections: k1 }, lin.w10);
  const mine = M.spatialMorphBlendLines(corners, lin);
  check('...also with the weights a linear spatial field gives (w01 = w11 = 0 exactly): the same doubles at t = smooth(u)', layer._morphNodes.every((nd, i) => { const line = mine[Math.floor(i / 2)]; return nd.x === (i % 2 === 0 ? line.x1 : line.x2) && nd.y === (i % 2 === 0 ? line.y1 : line.y2); }));
  const copy = { k00: k0, k10: k1, k01: k0.map((l) => Object.assign({}, l)), k11: k1.map((l) => Object.assign({}, l)) };
  const viaFour = M.spatialMorphBlendLines(copy, { w00: 0.7, w10: 0.3, w01: 0, w11: 0 });
  const viaTwo = M.spatialMorphBlendLines(corners, { w00: 0.7, w10: 0.3, w01: 0, w11: 0 });
  check('equal-but-separate arrays for k01 / k11 take the four-corner formula: the same numbers to 1e-12 (the exact path is for the shared arrays the corner rule returns)', viaFour.every((l, i) => ['x1', 'y1', 'x2', 'y2'].every((k) => close(l[k], viaTwo[i][k], 1e-12))));
  const three = M.spatialMorphChooseCorners([k0, k1, k1.map((l) => L(l.x1 + 10, l.y1 + 10, l.x2 + 10, l.y2 + 10))], 'bilinear');
  const b3 = M.spatialMorphBlendLines(three, { w00: 0.2, w10: 0.2, w01: 0.4, w11: 0.2 });
  check('3 keyframes: a weight on k01 moves the lines towards K2 (the blend is not the 2-keyframe lerp any more)', Math.abs(b3[0].x1 - M.spatialMorphBlendLines(corners, { w00: 0.2, w10: 0.2, w01: 0.4, w11: 0.2 })[0].x1) > 1);
});

console.log('\n== blending a whole line set ==');
T('blend', () => {
  const base = [L(10, 20, 30, 40), L(50, 60, 70, 80)];
  const off = (dx, dy) => base.map((l) => L(l.x1 + dx, l.y1 + dy, l.x2 + dx * 2, l.y2 + dy * 2));
  const corners = { k00: base, k10: off(100, 0), k01: off(0, 100), k11: off(100, 100) };
  const w = { w00: 0.1, w10: 0.2, w01: 0.3, w11: 0.4 };
  const r = M.spatialMorphBlendLines(corners, w);
  check('an affine combination: the corners are the base shifted by (100, 0), (0, 100), (100, 100), so the blend is the base shifted by (100 (w10 + w11), 100 (w01 + w11)) and the far end by twice that', r.every((l, i) => close(l.x1, base[i].x1 + 60, 1e-12) && close(l.y1, base[i].y1 + 70, 1e-12) && close(l.x2, base[i].x2 + 120, 1e-12) && close(l.y2, base[i].y2 + 140, 1e-12)));
  check('the result is new arrays and new objects: not one of the corner arrays or lines', r !== corners.k00 && r.every((l) => !corners.k00.includes(l) && !corners.k10.includes(l) && !corners.k01.includes(l) && !corners.k11.includes(l)));
  const pure = [{ w00: 1, w10: 0, w01: 0, w11: 0 }, { w00: 0, w10: 1, w01: 0, w11: 0 }, { w00: 0, w10: 0, w01: 1, w11: 0 }, { w00: 0, w10: 0, w01: 0, w11: 1 }];
  check('the four pure corner weights give that corner\'s lines exactly', ['k00', 'k10', 'k01', 'k11'].every((k, j) => same(M.spatialMorphBlendLines(corners, pure[j]), corners[k])));
  const ident = { k00: base, k10: base.map((l) => Object.assign({}, l)), k01: base.map((l) => Object.assign({}, l)), k11: base.map((l) => Object.assign({}, l)) };
  let worst = 0; for (let i = 0; i < 200; i++) { const a = rnd(), b = rnd() * (1 - a), c = rnd() * (1 - a - b); const rr = M.spatialMorphBlendLines(ident, { w00: a, w10: b, w01: c, w11: 1 - a - b - c }); rr.forEach((l, k) => ['x1', 'y1', 'x2', 'y2'].forEach((p) => { worst = Math.max(worst, Math.abs(l[p] - base[k][p])); })); }
  check(`four identical line sets blend to themselves at any weights that sum to 1 (worst ${worst.toExponential(2)})`, worst < 1e-12);
  const nan = M.spatialMorphBlendLines(corners, { w00: NaN, w10: Infinity, w01: undefined, w11: 'x' });
  check('a non-finite or missing weight counts as 0: the result has no NaN', nan.every((l) => Object.values(l).every(Number.isFinite)));
  const nanCorners = { k00: [L(NaN, 1, 2, 3)], k10: [L(1, 1, 2, 3)], k01: [L(1, 1, 2, 3)], k11: [L(1, 1, 2, 3)] };
  check('a non-finite corner coordinate counts as 0: the result has no NaN', Object.values(M.spatialMorphBlendLines(nanCorners, w)[0]).every(Number.isFinite) && Object.values(M.spatialMorphBlendLines(Object.assign({}, nanCorners, { k01: nanCorners.k00, k11: nanCorners.k10 }), w)[0]).every(Number.isFinite));
  check('garbage in (no corners, no weights) gives an empty array or finite lines and never throws', (() => { try { return same(M.spatialMorphBlendLines(undefined, undefined), []) && same(M.spatialMorphBlendLines({}, {}), []) && M.spatialMorphBlendLines({ k00: [L(1, 2, 3, 4)] }, undefined).every((l) => Object.values(l).every(Number.isFinite)); } catch (e) { return false; } })());
});

console.log('\n== projection on a segment and edge detection ==');
T('edges', () => {
  const P = M.spatialMorphProjectToSegment;
  check('the foot of the perpendicular, its parameter t and the distance', same(P({ x: 30, y: 5 }, { x: 0, y: 0 }, { x: 100, y: 0 }), { x: 30, y: 0, t: 0.3, dist: 5 }));
  check('the foot is clamped to the segment: before the start t = 0, after the end t = 1', same(P({ x: -20, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }), { x: 0, y: 0, t: 0, dist: 20 }) && same(P({ x: 130, y: 40 }, { x: 0, y: 0 }, { x: 100, y: 0 }), { x: 100, y: 0, t: 1, dist: Math.hypot(30, 40) }));
  check('a zero-length segment projects to its start with t = 0 and the distance to it (no division by zero)', same(P({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 }), { x: 0, y: 0, t: 0, dist: 5 }));
  check('a non-finite or missing coordinate gives null (no number is invented)', [P({ x: NaN, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }), P({ x: 0, y: 0 }, { x: Infinity, y: 0 }, { x: 1, y: 1 }), P({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: undefined }), P(null, sq[0], sq[1]), P({ x: 1, y: 1 }, undefined, sq[1])].every((r) => r === null));
  const on = M.spatialMorphOnEdge;
  check('a point 0.5 px inside the top edge is on edge 0 at t = 0.5 (foot point included)', same(on({ x: 50, y: 0.5 }, sq), { edge: 0, t: 0.5, dist: 0.5, x: 50, y: 0 }));
  check('the tolerance is inclusive: exactly 1 px away is on the edge, 1 px + 1e-9 is not', on({ x: 50, y: 1 }, sq) !== null && on({ x: 50, y: 1 + 1e-9 }, sq) === null);
  check('a custom tolerance replaces the default: 3 px is on with tol 3 and off with tol 2.9; tolerance 0 means exactly on the edge', on({ x: 50, y: 3 }, sq, 3) !== null && on({ x: 50, y: 3 }, sq, 2.9) === null && on({ x: 50, y: 0 }, sq, 0) !== null && on({ x: 50, y: 1e-9 }, sq, 0) === null);
  check('a negative or non-finite tolerance is the default 1 px', on({ x: 50, y: 0.9 }, sq, -5) !== null && on({ x: 50, y: 1.1 }, sq, -5) === null && on({ x: 50, y: 0.9 }, sq, NaN) !== null && on({ x: 50, y: 1.1 }, sq, NaN) === null);
  check('a point well inside the cell is on no edge', on({ x: 50, y: 50 }, sq) === null);
  check('a polygon corner belongs to two edges and gets the lower index: (0, 0) is edge 0 at t = 0, (100, 0) is edge 0 at t = 1, (100, 100) is edge 1 at t = 1', same([on({ x: 0, y: 0 }, sq).edge, on({ x: 0, y: 0 }, sq).t], [0, 0]) && same([on({ x: 100, y: 0 }, sq).edge, on({ x: 100, y: 0 }, sq).t], [0, 1]) && same([on({ x: 100, y: 100 }, sq).edge, on({ x: 100, y: 100 }, sq).t], [1, 1]));
  check('the right and the bottom edge are found at their own index and parameter', same([on({ x: 99.5, y: 25 }, sq).edge, on({ x: 99.5, y: 25 }, sq).t], [1, 0.25]) && same([on({ x: 25, y: 100.5 }, sq).edge, on({ x: 25, y: 100.5 }, sq).t], [2, 0.75]));
  const degenerate = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  const dr = on({ x: 0.5, y: 0 }, degenerate);
  check('a polygon with a zero-length edge (two equal vertices) gives finite numbers and still finds the point', dr !== null && Object.values(dr).every(Number.isFinite));
  check('a non-finite point, fewer than three polygon points or no polygon give null and never throw', [on({ x: NaN, y: 0 }, sq), on({ x: 0, y: 0 }, sq.slice(0, 2)), on({ x: 0, y: 0 }, undefined), on(undefined, sq), on({ x: 0, y: 0 }, 'x')].every((r) => r === null));
  check('the midpoint of an edge (the last edge closes the polygon) and the origin for an invalid edge', same(M.spatialMorphEdgeMidpoint(sq, 0), { x: 50, y: 0 }) && same(M.spatialMorphEdgeMidpoint(sq, 3), { x: 0, y: 50 }) && same(M.spatialMorphEdgeMidpoint(sq, 4), { x: 0, y: 0 }) && same(M.spatialMorphEdgeMidpoint(sq, -1), { x: 0, y: 0 }) && same(M.spatialMorphEdgeMidpoint(undefined, 0), { x: 0, y: 0 }) && same(M.spatialMorphEdgeMidpoint(sq, 1.5), { x: 0, y: 0 }));
});

console.log('\n== the edge that contains an endpoint\'s four positions ==');
T('containing', () => {
  const F = M.spatialMorphFindContainingEdge;
  const top = (x) => ({ x, y: 0 }), right = (y) => ({ x: 100, y }), bottom = (x) => ({ x, y: 100 });
  check('the edge with the most positions within the tolerance wins: one on the top edge, three on the right edge: the right edge (1)', F([top(40), right(20), right(50), right(80)], sq).edge === 1);
  check('a tie goes to the edge that holds the first position: [top, top, right, right] is the top edge (0); [right, right, top, top] is the right edge (1)', F([top(10), top(20), right(30), right(40)], sq).edge === 0 && F([right(30), right(40), top(10), top(20)], sq).edge === 1);
  check('...and a tie where neither edge holds the first position goes to the smaller sum of distances: [(50, 40), top, bottom] is the top edge, [(50, 60), top, bottom] is the bottom edge', F([{ x: 50, y: 40 }, top(10), bottom(30)], sq).edge === 0 && F([{ x: 50, y: 60 }, top(10), bottom(30)], sq).edge === 2);
  check('all four at a polygon corner: the lower edge index wins the full tie (corner (0, 0) is on edges 0 and 3: edge 0)', F([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], sq).edge === 0);
  const r = F([top(10), top(20), top(30), top(40)], sq);
  check('the result carries the edge\'s end points and midpoint as copies (changing them does not change the polygon)', same([r.v, r.w, r.mid], [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }]) && r.v !== sq[0] && r.w !== sq[1] && (() => { r.v.x = 99; return sq[0].x === 0; })());
  check('with positions that are on no edge the nearest edge by summed distance is chosen (the prototype still returns an edge)', F([{ x: 50, y: 3 }, { x: 50, y: 4 }, { x: 50, y: 5 }, { x: 50, y: 6 }], sq).edge === 0);
  check('no positions, no polygon or fewer than three points give null', [F([], sq), F(undefined, sq), F([top(1)], undefined), F([top(1)], sq.slice(0, 2))].every((x) => x === null));
});

console.log('\n== one endpoint: boundary, moved, projected ==');
T('endpoint', () => {
  const E = M.spatialMorphPrepareEndpoint;
  const pt = (x, y) => ({ x, y });
  const st = E([pt(40, 0), pt(40, 0), pt(40, 0), pt(40, 0)], sq);
  check('a static boundary endpoint: on the boundary, not moved, edge 0, the edge midpoint is the weights sample, nothing is projected', st.onBoundary === true && st.moved === false && st.edge.edge === 0 && same(st.sample, { x: 50, y: 0 }) && same(st.edgePoints, st.points));
  const sl = E([pt(10, 0.4), pt(40, -0.3), pt(70, 0), pt(95, 0.9)], sq);
  check('a sliding boundary endpoint: moved; its four positions are projected on the edge (y becomes exactly 0, x stays)', sl.onBoundary && sl.moved && sl.edge.edge === 0 && same(sl.edgePoints, [pt(10, 0), pt(40, 0), pt(70, 0), pt(95, 0)]));
  const inn = E([pt(20, 30), pt(40, 50), pt(60, 40), pt(30, 70)], sq);
  check('an interior endpoint: not on the boundary, moved, no edge; the sample is its first position; positions are kept', inn.onBoundary === false && inn.moved === true && inn.edge === null && same(inn.sample, pt(20, 30)) && same(inn.edgePoints, inn.points));
  const mixed = E([pt(30, 0), pt(30, 20), pt(60, 30), pt(70, 40)], sq);
  check('one position on the edge and three well inside (the prototype\'s "any of the four"): on the boundary, moved, edge 0, the three inside are projected on the edge (x kept, y to 0)', mixed.onBoundary && mixed.moved && mixed.edge.edge === 0 && same(mixed.edgePoints, [pt(30, 0), pt(30, 0), pt(60, 0), pt(70, 0)]));
  const late = E([pt(30, 40), pt(30, 30), pt(30, 20), pt(30, 0)], sq);
  check('"on the boundary" looks at all four positions, not only the first: only the LAST keyframe position on the edge still makes a boundary endpoint (edge 0, moved), and the three inside are projected up onto the edge', late.onBoundary && late.moved && late.edge.edge === 0 && same(late.edgePoints, [pt(30, 0), pt(30, 0), pt(30, 0), pt(30, 0)]));
  const outside = E([pt(150, 0), pt(40, 0), pt(40, 0), pt(40, 0)], sq);
  check('a position beyond the end of the edge is clamped to the edge end (t is clamped to 0..1): x 150 becomes 100', outside.edgePoints[0].x === 100 && outside.edgePoints[0].y === 0);
  const cross = E([pt(20, 0), pt(80, 0), pt(30, 100), pt(70, 100)], sq);
  check('keyframes that put the endpoint on DIFFERENT edges: the edge of the first position wins the 2:2 tie (top), the bottom positions are projected up onto the top edge (y 100 becomes 0): there is no seam guarantee for such an endpoint', cross.edge.edge === 0 && same(cross.edgePoints, [pt(20, 0), pt(80, 0), pt(30, 0), pt(70, 0)]));
  check('the spread decides "moved": 3-4-5 apart is not moved with sameTol 5 (the test is strict), moved with 4.999; the default 1e-4: 5e-5 apart is not moved, 2e-4 apart is', E([pt(0, 50), pt(3, 54), pt(0, 50), pt(0, 50)], sq, { sameTol: 5 }).moved === false && E([pt(0, 50), pt(3, 54), pt(0, 50), pt(0, 50)], sq, { sameTol: 4.999 }).moved === true && E([pt(40, 0), pt(40.00005, 0), pt(40, 0), pt(40, 0)], sq).moved === false && E([pt(40, 0), pt(40.0002, 0), pt(40, 0), pt(40, 0)], sq).moved === true);
  check('tolerance 0: a position exactly on the edge is on the boundary, 0.4 px off is not; the default 1 px accepts 0.4 px', E([pt(40, 0), pt(40, 0), pt(40, 0), pt(40, 0)], sq, { tol: 0 }).onBoundary === true && E([pt(40, 0.4), pt(40, 0.4), pt(40, 0.4), pt(40, 0.4)], sq, { tol: 0 }).onBoundary === false && E([pt(40, 0.4), pt(40, 0.4), pt(40, 0.4), pt(40, 0.4)], sq).onBoundary === true);
  const corner = E([pt(0, 0), pt(0, 0), pt(0, 0), pt(0, 0)], sq);
  check('an endpoint at a polygon corner: on the boundary, not moved, edge 0 (the lower index), no NaN', corner.onBoundary && !corner.moved && corner.edge.edge === 0 && Object.values(corner.sample).every(Number.isFinite));
  const slideToCorner = E([pt(0, 0), pt(100, 0), pt(50, 0), pt(100, 0)], sq);
  check('an endpoint that slides from corner to corner is moved on edge 0 and keeps t = 0 and t = 1 exactly', slideToCorner.moved && slideToCorner.edge.edge === 0 && slideToCorner.edgePoints[0].x === 0 && slideToCorner.edgePoints[1].x === 100);
  const zeroEdge = E([pt(0.5, 0), pt(0.5, 0.2), pt(0.5, 0), pt(0.5, 0)], [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
  check('a polygon with a zero-length edge gives finite numbers everywhere', [zeroEdge.sample, zeroEdge.edge.mid, ...zeroEdge.edgePoints].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  const nan = E([pt(NaN, 0), undefined, null, { x: Infinity }], sq);
  check('NaN, a missing position or an infinity counts as 0: finite everywhere, no throw', [...nan.points, ...nan.edgePoints, nan.sample].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  const noPoly = E([pt(40, 0), pt(40, 0), pt(40, 0), pt(40, 0)], undefined);
  check('no polygon: not on the boundary, no edge', noPoly.onBoundary === false && noPoly.edge === null);
});

console.log('\n== the anchored point ==');
T('anchored', () => {
  const E = M.spatialMorphPrepareEndpoint, A = M.spatialMorphAnchoredPoint;
  const pt = (x, y) => ({ x, y });
  const wT = { w00: 1, w10: 0, w01: 0, w11: 0 }, wE = { w00: 0, w10: 0, w01: 0, w11: 1 };
  const inn = E([pt(20, 30), pt(40, 50), pt(60, 40), pt(30, 70)], sq);
  check('an interior endpoint is blended with the TILE weights; the edge weights are ignored', same(A(inn, wT, wE), pt(20, 30)) && same(A(inn, wE, wT), pt(30, 70)));
  const sl = E([pt(10, 0.4), pt(40, -0.3), pt(70, 0), pt(95, 0.9)], sq);
  check('a sliding boundary endpoint is blended (projected) with the EDGE weights; the tile weights are ignored', same(A(sl, wT, wE), pt(95, 0)) && same(A(sl, wE, wT), pt(10, 0)) && same(A(sl, wE, { w00: 0, w10: 1, w01: 0, w11: 0 }), pt(40, 0)));
  const stat = E([pt(40, 0), pt(40, 0), pt(40, 0), pt(40, 0)], sq);
  check('a static boundary endpoint stays where it is whatever the weights are (even with weights that would pull it elsewhere)', same(A(stat, wT, wE), pt(40, 0)) && same(A(stat, wE, wT), pt(40, 0)));
  check('...and a sliding boundary endpoint without usable edge weights (null, NaN, missing) stays at the edge point of K00, never at the tile\'s blend', same(A(sl, wE, null), pt(10, 0)) && same(A(sl, wE, { w00: NaN, w10: 0, w01: 0, w11: 0 }), pt(10, 0)) && same(A(sl, wE, undefined), pt(10, 0)));
  check('an interior endpoint without usable tile weights stays at its first position', same(A(inn, null, wE), pt(20, 30)) && same(A(inn, undefined, undefined), pt(20, 30)));
  let worst = 0, off = 0;
  for (let i = 0; i < 300; i++) {
    const a = rnd(), b = rnd() * (1 - a), c = rnd() * (1 - a - b), w = { w00: a, w10: b, w01: c, w11: 1 - a - b - c };
    const p = A(sl, wT, w);
    worst = Math.max(worst, Math.abs(w.w00 + w.w10 + w.w01 + w.w11 - 1)); off = Math.max(off, Math.abs(p.y), Math.max(0, 0 - p.x), Math.max(0, p.x - 100));
  }
  check(`at any weights that are a partition of unity a sliding endpoint stays ON its edge segment (300 random weights: off the edge by at most ${off.toExponential(2)}; weights summed to 1 within ${worst.toExponential(2)})`, off < 1e-12 && worst < 1e-12);
  const line = M.spatialMorphAnchoredLine({ a: E([pt(10, 0), pt(20, 0), pt(30, 0), pt(40, 0)], sq), b: E([pt(100, 10), pt(100, 20), pt(100, 30), pt(100, 40)], sq) }, wT, wE, { w00: 0, w10: 1, w01: 0, w11: 0 });
  check('a line with both ends on the boundary: each end has its OWN edge weights (end a with the weights of its edge, end b with the weights of the right edge)', same(line, { x1: 40, y1: 0, x2: 100, y2: 20 }));
  const empty = A(undefined, wT, wE);
  check('no descriptor gives the origin (finite, no throw)', same(empty, pt(0, 0)));
  const lines = M.spatialMorphPrepareLines({ k00: [L(10, 0, 50, 50)], k10: [L(40, 0, 60, 60)], k01: [L(10, 0, 50, 50)], k11: [L(40, 0, 60, 60)] }, sq);
  check('prepareLines gives one { a, b } per line, the same as prepareEndpoint of each end; no lines for no corners', lines.length === 1 && same(lines[0].a, E([pt(10, 0), pt(40, 0), pt(10, 0), pt(40, 0)], sq)) && same(lines[0].b, E([pt(50, 50), pt(60, 60), pt(50, 50), pt(60, 60)], sq)) && same(M.spatialMorphPrepareLines(undefined, sq), []));
});

console.log('\n== weights at an edge point (partition of unity, same point from either tile) ==');
T('edgeweights', () => {
  const LINS = { scalarMin: 0, scalarMax: 400 }, BIS = { minX: 0, maxX: 400, minY: 0, maxY: 400 };
  let worst = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    const e = Math.floor(rnd() * 4), t = rnd();
    const v = sq[e], w = sq[(e + 1) % 4], p = { x: 150 + (v.x + t * (w.x - v.x)) , y: 120 + (v.y + t * (w.y - v.y)) };
    [['linear', LINS, 45], ['radial', { scalarMin: 10, scalarMax: 300 }, 0], ['bilinear', BIS, 0]].forEach(([mode, span, a]) => {
      const r = M.spatialMorphCornerWeights(mode, p, span, { angleDeg: a, center: { x: 200, y: 200 } });
      worst = Math.max(worst, Math.abs(r.w00 + r.w10 + r.w01 + r.w11 - 1)); n++;
    });
  }
  check(`the stage-a1 weights at ${n} points on cell edges are a partition of unity (worst ${worst.toExponential(2)}): the blend of the projected edge points is an affine combination`, worst < 1e-12);
  const midA = M.spatialMorphEdgeMidpoint(sq, 1), midB = M.spatialMorphEdgeMidpoint([{ x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 100 }], 0);
  check('two tiles that share an edge reach the same world midpoint however their cells are numbered (the edge midpoint is symmetric in its end points)', same(midA, midB));
});

console.log('\n== no input is changed, no global is read, same input gives the same bytes ==');
T('purity', () => {
  const strictCtx = vm.createContext({ module: { exports: {} }, Math, Number, Object });
  vm.runInContext('"use strict";\n' + SRC, strictCtx, { filename: 'spatial-morph.js (strict)' });
  const SM = strictCtx.module.exports;
  const input = () => deepFreeze({ k00: [L(10, 0, 50, 50), L(1, 2, 3, 4)], k10: [L(40, 0, 60, 60), L(2, 3, 4, 5)], k01: [L(10, 0, 50, 50), L(3, 4, 5, 6)], k11: [L(40, 0, 60, 60), L(4, 5, 6, 7)] });
  const poly = deepFreeze(sq.map((p) => ({ x: p.x, y: p.y })));
  const w = deepFreeze({ w00: 0.1, w10: 0.2, w01: 0.3, w11: 0.4 });
  let threw = null, out = null;
  try {
    const c = input();
    out = [SM.spatialMorphValidateCorners(c), SM.spatialMorphChooseCorners(deepFreeze([[L(1, 2, 3, 4)], [L(5, 6, 7, 8)], [L(1, 1, 1, 1)]]), 'bilinear'), SM.spatialMorphBlendLines(c, w),
      SM.spatialMorphSelectKeyframeLayers(deepFreeze([{ shape: 'square', lineCount: 2 }, { shape: 'square', lineCount: 2 }]), deepFreeze({ mode: 'bilinear', timelineIds: [0, 1], base: { shape: 'square', lineCount: 2 } })),
      SM.spatialMorphProjectToSegment({ x: 1, y: 2 }, poly[0], poly[1]), SM.spatialMorphOnEdge({ x: 1, y: 2 }, poly), SM.spatialMorphEdgeMidpoint(poly, 0), SM.spatialMorphFindContainingEdge(deepFreeze([{ x: 1, y: 0 }, { x: 2, y: 0 }]), poly)];
    const lines = SM.spatialMorphPrepareLines(c, poly, deepFreeze({ tol: 1 }));
    out.push(SM.spatialMorphNormalize(deepFreeze({ enabled: true, mode: 'radial', angleDeg: 5, extra: {} })), SM.spatialMorphEqual(deepFreeze({ mode: 'x' }), undefined), SM.spatialMorphDefaults());   // stage b: the parameter helpers
    out.push(lines, SM.spatialMorphPrepareEndpoint(deepFreeze([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }]), poly), SM.spatialMorphAnchoredPoint(lines[0].a, w, w), SM.spatialMorphAnchoredLine(lines[0], w, w, w));
  } catch (e) { threw = e; }
  check('deep-frozen corners, weights, polygons and options go through every function of the strict-mode module without a TypeError', threw === null, threw && threw.message);
  const bare = vm.createContext({ module: { exports: {} }, Math, Number, Object });   // no window, document, state, p5, timeline, outerCorners, width, height, Date, timers
  let bareErr = null;
  try { vm.runInContext(SRC, bare, { filename: 'spatial-morph.js (bare)' }); const B = bare.module.exports; const c = input(); const pl = B.spatialMorphPrepareLines(c, poly); B.spatialMorphAnchoredLine(pl[0], w, w, w); B.spatialMorphBlendLines(c, w); B.spatialMorphSelectKeyframeLayers([], {}); B.spatialMorphChooseCorners([], 'linear'); B.spatialMorphValidateCorners(c); B.spatialMorphNormalize({ mode: 'radial' }); B.spatialMorphEqual({}, undefined); B.spatialMorphDefaults(); } catch (e) { bareErr = e; }
  check('no global is read: every function of the file runs in a context that has only Math, Number and Object (a read of a global would be a ReferenceError)', bareErr === null, bareErr && bareErr.message);
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  check('the source has no random, clock, timer, DOM or p5 access and names none of the sketch\'s variables', !/Math\.random|\bDate\b|performance|setTimeout|setInterval|requestAnimationFrame|\bwindow\b|\bdocument\b|globalThis|\bstate\b|\btimeline\b|additionalLayers|outerCorners|\bwidth\b|\bheight\b|\bnodes\b|\bconnections\b/.test(code));
  const a = J([M.spatialMorphPrepareLines(input(), sq), M.spatialMorphBlendLines(input(), w)]), b = J([M.spatialMorphPrepareLines(input(), sq), M.spatialMorphBlendLines(input(), w)]);
  check('the same input twice gives the same bytes', a === b);
  const c1 = { k00: [L(10, 0, 50, 50)], k10: [L(40, 0, 60, 60)], k01: [L(10, 0, 50, 50)], k11: [L(40, 0, 60, 60)] }, before = J(c1);
  M.spatialMorphPrepareLines(c1, sq); M.spatialMorphBlendLines(c1, w); M.spatialMorphValidateCorners(c1);
  check('...and plain objects are equal before and after the calls', J(c1) === before);
});

console.log('\n== golden segments from the prototype ==');
T('golden', () => {
  const G = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
  let numbers = 0, worst = 0; const bad = [];
  const shapes = new Set(), modes = new Set(), syms = new Set(), counts = new Set();
  G.cases.forEach((c) => {
    const world = H.makeWorld(c.shape, c.order, c.sf, c.W);
    shapes.add(c.shape); modes.add(c.mode); syms.add(c.symMode); counts.add(c.keyframes.length);
    const kf = c.keyframes.map((k) => k.map((a) => L(a[0], a[1], a[2], a[3])));
    const corners = M.spatialMorphChooseCorners(kf, c.mode);
    const v = M.spatialMorphValidateCorners(corners);
    if (!v.ok) { bad.push(c.name + ': ' + v.code); return; }
    const prepared = M.spatialMorphPrepareLines(corners, world.poly);
    c.tiles.forEach((tile, ti) => {
      const mine = H.morphTile(M, world, { mode: c.mode, angleDeg: c.angleDeg, span: c.span, symMode: c.symMode }, prepared, tile, undefined);
      const exp = c.expect[ti];
      if (mine.length !== exp.length) { bad.push(`${c.name} tile ${ti}: ${mine.length} segments vs ${exp.length}`); return; }
      mine.forEach((s, i) => [s.a.x, s.a.y, s.b.x, s.b.y].forEach((val, j) => { const d = Math.abs(val - exp[i][j]); numbers++; if (d > worst) worst = d; if (!(d <= 1e-9)) bad.push(`${c.name} tile ${ti} seg ${i}[${j}]: ${val} vs ${exp[i][j]}`); }));
    });
  });
  check(`${G.cases.length} cases, ${numbers} golden numbers (segment ends the PROTOTYPE draws; 3 shapes, 3 modes, ${syms.size} symmetry modes, 2 / 3 / 4 keyframes, moving / static / mixed / cross-edge boundary ends) equal ours within 1e-9 (worst ${worst.toExponential(2)})`, G.cases.length === 13 && numbers >= 2900 && bad.length === 0, bad.slice(0, 3).join(' | '));
  check('the golden set covers square, triangle and hex, linear, radial and bilinear, 2, 3 and 4 keyframes and none, reflection and rotation symmetry', same([...shapes].sort(), ['hex', 'square', 'triangle']) && same([...modes].sort(), ['bilinear', 'linear', 'radial']) && same([...counts].sort(), [2, 3, 4]) && syms.has('none') && syms.has('reflection_only') && syms.has('rotation_reflection3') && syms.has('rotation_reflection6') && syms.has('rotation3'));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
