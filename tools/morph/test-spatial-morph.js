// Guard for core/spatial-morph.js (morph stage a1): the pure weight mathematics of the static, lines-only spatial morph.
// Properties (every one is a check below): every weight is in [0, 1]; the four corner weights sum to 1 (partition of unity, tolerance 1e-12) for every mode and point; the smooth
// weight is 0 / 0.5 / 1 at 0 / 0.5 / 1, monotonic, with a zero slope at both ends; bilinear: the four corners are exact; linear: 0 on the start line and 1 on the end line for each of the eight
// angles, constant along the perpendicular, a rotation by 90 degrees maps the field; radial: 0 at the nearest and 1 at the farthest tile, constant on circles; the weights depend only on the
// point and the span (same input, same bytes; no global is read; no input is changed); degenerate inputs never give a NaN; 280 GOLDEN numbers (70 cases x 4 weights) taken from the PROTOTYPE's
// own functions (core/spatialMorph.js of the morph worktree, run in a vm: computeSpatialMorphWeight(), computeSpatialMorphBilinearWeights(), smoothCosineWeight(), bilerpPoint()) are
// embedded below, so this test does not depend on the prototype tree; and a top-level-names guard (every name starts with spatialMorph, none is a p5 name, none collides with a top-level name
// of the other core files, sketch.js or the ui scripts).
//   node tools/morph/test-spatial-morph.js
//   SPATIAL_MORPH_JS=/path/to/mutated/spatial-morph.js node tools/morph/test-spatial-morph.js        (sabotage runs)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const FILE = process.env.SPATIAL_MORPH_JS || path.join(ROOT, 'core', 'spatial-morph.js');
const SRC = fs.readFileSync(FILE, 'utf8');
const M = require(FILE);

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 300)); } };
const TOL = 1e-12;
const W = (r) => [r.w00, r.w10, r.w01, r.w11];
const sum = (r) => r.w00 + r.w10 + r.w01 + r.w11;
const finite4 = (r) => W(r).every((x) => typeof x === 'number' && Number.isFinite(x));
const inRange4 = (r) => W(r).every((x) => x >= 0 && x <= 1);
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const CENTER = { x: 600, y: 600 };
const LIN = { scalarMin: 120, scalarMax: 980 }, RAD = { scalarMin: 35, scalarMax: 820 }, BI = { minX: 50, maxX: 1150, minY: 40, maxY: 1160 };
// a deterministic pseudo-random sequence (no Math.random: the test is repeatable)
let seed = 123456789;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const pts = Array.from({ length: 400 }, () => ({ x: -200 + rnd() * 1600, y: -200 + rnd() * 1600 }));
const specFor = (mode) => (mode === 'bilinear' ? BI : (mode === 'radial' ? RAD : LIN));
const CASES = [['linear', 0], ['linear', 45], ['linear', 90], ['linear', 135], ['linear', 180], ['linear', 225], ['linear', 270], ['linear', 315], ['radial', 0], ['bilinear', 0]];
const opts = (a) => ({ angleDeg: a, center: CENTER });

console.log('== the file ==');
T('file', () => {
  check('the module exports the nine functions and the mode list, all starting with spatialMorph', Object.keys(M).sort().join() === ['spatialMorphBlendPoint', 'spatialMorphClamp01', 'spatialMorphCornerWeights', 'spatialMorphDirection', 'spatialMorphModes', 'spatialMorphNormalizeMode', 'spatialMorphScalar', 'spatialMorphSmooth', 'spatialMorphUnit', 'spatialMorphUnitCoords'].sort().join(), Object.keys(M).join());
  check('the modes are linear, radial, bilinear (frozen)', JSON.stringify(M.spatialMorphModes) === '["linear","radial","bilinear"]' && Object.isFrozen(M.spatialMorphModes));
});

console.log('\n== the smooth weight ==');
T('smooth', () => {
  check('0 at 0 and 1 at 1 (exact), 0.5 at 0.5 within 1e-15 (cos(pi / 2) is 6e-17, not 0)', M.spatialMorphSmooth(0) === 0 && Math.abs(M.spatialMorphSmooth(0.5) - 0.5) < 1e-15 && M.spatialMorphSmooth(1) === 1, [M.spatialMorphSmooth(0), M.spatialMorphSmooth(0.5), M.spatialMorphSmooth(1)].join());
  let mono = true, prev = -1; for (let i = 0; i <= 10000; i++) { const s = M.spatialMorphSmooth(i / 10000); if (!(s >= prev)) mono = false; prev = s; }
  check('monotonic non-decreasing on 10001 points of [0, 1]', mono);
  const h = 1e-4;
  const dStart = (M.spatialMorphSmooth(h) - M.spatialMorphSmooth(0)) / h, dEnd = (M.spatialMorphSmooth(1) - M.spatialMorphSmooth(1 - h)) / h, dMid = (M.spatialMorphSmooth(0.5 + h) - M.spatialMorphSmooth(0.5 - h)) / (2 * h);
  check('the numerical derivative is zero at both ends: |s(h) - s(0)| / h and |s(1) - s(1-h)| / h are below 5e-4 for h = 1e-4 (the exact slope there is (pi^2 / 4) h = 2.5e-4; a linear ramp would give 1); in the middle it is pi / 2', Math.abs(dStart) < 5e-4 && Math.abs(dEnd) < 5e-4 && Math.abs(dMid - Math.PI / 2) < 1e-6, [dStart, dEnd, dMid].join());
  let sym = 0; for (let i = 0; i <= 100; i++) sym = Math.max(sym, Math.abs(M.spatialMorphSmooth(i / 100) + M.spatialMorphSmooth(1 - i / 100) - 1));
  check('symmetric: s(t) + s(1 - t) = 1 (within 1e-15)', sym < 1e-15, sym);
  check('outside [0, 1] it clamps, a non-number is 0: s(-3) = 0, s(7) = 1, s(NaN) = s(Infinity) = s(undefined) = s("x") = 0', M.spatialMorphSmooth(-3) === 0 && M.spatialMorphSmooth(7) === 1 && [NaN, Infinity, -Infinity, undefined, null, 'x'].every((v) => M.spatialMorphSmooth(v) === 0));
  check('clamp01: the value inside, 0 below, 1 above, 0 for anything that is not a finite number', M.spatialMorphClamp01(0.25) === 0.25 && M.spatialMorphClamp01(-1) === 0 && M.spatialMorphClamp01(2) === 1 && [NaN, Infinity, -Infinity, undefined, null, '0.5', {}].every((v) => M.spatialMorphClamp01(v) === 0));
});

console.log('\n== mode, direction, scalar, unit ==');
T('basics', () => {
  check('normalize: radial, bilinear, linear; anything else is linear', M.spatialMorphNormalizeMode('radial') === 'radial' && M.spatialMorphNormalizeMode('bilinear') === 'bilinear' && M.spatialMorphNormalizeMode('linear') === 'linear' && ['x', '', null, undefined, 3, 'Radial'].every((m) => M.spatialMorphNormalizeMode(m) === 'linear'));
  const d = (a) => M.spatialMorphDirection(a);
  check('the direction of 0 / 90 / 180 / 270 is exact: (1, 0), (0, 1), (-1, 0), (0, -1) - canvas coordinates, y down: 0 = left to right, 90 = top to bottom', JSON.stringify([d(0), d(90), d(180), d(270)]) === JSON.stringify([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]));
  const q = Math.SQRT1_2;
  check('45 points to the lower right (cos 45, sin 45), 135 to the lower left, 225 to the upper left, 315 to the upper right', ANGLES.filter((a) => a % 90).every((a) => { const r = d(a), ex = { 45: [q, q], 135: [-q, q], 225: [-q, -q], 315: [q, -q] }[a]; return Math.abs(r.x - ex[0]) < 1e-15 && Math.abs(r.y - ex[1]) < 1e-15; }));
  check('the angle is taken modulo 360: -90 = 270, 450 = 90, -360 = 0, 720 = 0 (exact); every direction has length 1', JSON.stringify([d(-90), d(450), d(-360), d(720)]) === JSON.stringify([d(270), d(90), d(0), d(0)]) && [0, 45, 30, 77.5, -20, 1000].every((a) => Math.abs(Math.hypot(d(a).x, d(a).y) - 1) < 1e-15));
  check('a non-finite angle is 0 degrees; a continuous angle that is not a 45 step (30) is used as it is, like the prototype', JSON.stringify([d(NaN), d(Infinity), d(undefined), d('90')]) === JSON.stringify([d(0), d(0), d(0), d(0)]) && Math.abs(d(30).x - Math.cos(Math.PI / 6)) < 1e-15 && Math.abs(d(30).y - 0.5) < 1e-15);
  const p = { x: 300, y: 200 };
  check('the scalar: linear 0 = x, 90 = y, 180 = -x, 45 = (x + y) / sqrt 2; radial = the distance from the centre; bilinear = x', M.spatialMorphScalar('linear', p, { angleDeg: 0 }) === 300 && M.spatialMorphScalar('linear', p, { angleDeg: 90 }) === 200 && M.spatialMorphScalar('linear', p, { angleDeg: 180 }) === -300 && Math.abs(M.spatialMorphScalar('linear', p, { angleDeg: 45 }) - 500 * Math.SQRT1_2) < 1e-12 && M.spatialMorphScalar('radial', p, { center: { x: 300, y: 0 } }) === 200 && M.spatialMorphScalar('bilinear', p) === 300);
  check('unit: 0 at lo, 1 at hi, 0.5 in the middle, clamped outside; a span that is not positive (hi <= lo, NaN, undefined) gives 0; a non-finite value gives 0', M.spatialMorphUnit(10, 10, 30) === 0 && M.spatialMorphUnit(30, 10, 30) === 1 && M.spatialMorphUnit(20, 10, 30) === 0.5 && M.spatialMorphUnit(-5, 10, 30) === 0 && M.spatialMorphUnit(99, 10, 30) === 1 && M.spatialMorphUnit(5, 10, 10) === 0 && M.spatialMorphUnit(5, 30, 10) === 0 && M.spatialMorphUnit(5, NaN, 10) === 0 && M.spatialMorphUnit(5, 10, undefined) === 0 && M.spatialMorphUnit(NaN, 10, 30) === 0 && M.spatialMorphUnit(Infinity, 10, 30) === 0);
});

console.log('\n== partition of unity and range, every mode ==');
T('partition', () => {
  let worstSum = 0, bad = 0, n = 0, zeroV = true;
  CASES.forEach(([mode, a]) => pts.forEach((p) => { const r = M.spatialMorphCornerWeights(mode, p, specFor(mode), opts(a)); n++; worstSum = Math.max(worstSum, Math.abs(sum(r) - 1)); if (!finite4(r) || !inRange4(r)) bad++; if (mode !== 'bilinear' && (r.w01 !== 0 || r.w11 !== 0)) zeroV = false; }));
  check(`every weight is in [0, 1] and finite (${n} points x modes)`, bad === 0, bad);
  check(`the four corner weights sum to 1 within ${TOL} (worst ${worstSum.toExponential(2)})`, worstSum <= TOL);
  check('in the 1D modes (linear, radial) K01 and K11 get weight 0: the weights are (1 - su, su, 0, 0), the prototype\'s K01 = K00, K11 = K10 blend', zeroV);
  const b = M.spatialMorphCornerWeights('linear', { x: 600, y: 600 }, LIN, opts(0));
  check('1D: w00 + w10 = 1 and w10 = smooth(u) (the weight of the END keyframe grows with the unit coordinate)', Math.abs(b.w00 + b.w10 - 1) < TOL && Math.abs(b.w10 - M.spatialMorphSmooth(M.spatialMorphUnitCoords('linear', { x: 600, y: 600 }, LIN, opts(0)).u)) < TOL);
});

console.log('\n== bilinear ==');
T('bilinear', () => {
  const at = (x, y) => M.spatialMorphCornerWeights('bilinear', { x, y }, BI);
  const eq = (r, a) => W(r).every((v, i) => Math.abs(v - a[i]) < TOL);
  check('the four corners are exact: (minX, minY) = K00, (maxX, minY) = K10, (minX, maxY) = K01, (maxX, maxY) = K11 (weight 1, the others 0)', eq(at(50, 40), [1, 0, 0, 0]) && eq(at(1150, 40), [0, 1, 0, 0]) && eq(at(50, 1160), [0, 0, 1, 0]) && eq(at(1150, 1160), [0, 0, 0, 1]));
  check('the edge midpoints split 50 / 50 between the two corners of the edge; the centre gives 0.25 each', eq(at(600, 40), [0.5, 0.5, 0, 0]) && eq(at(600, 1160), [0, 0, 0.5, 0.5]) && eq(at(50, 600), [0.5, 0, 0.5, 0]) && eq(at(1150, 600), [0, 0.5, 0, 0.5]) && eq(at(600, 600), [0.25, 0.25, 0.25, 0.25]));
  check('a point outside the span is clamped to the nearest edge or corner: (0, 0) = K00, (9999, 9999) = K11, (600, -50) = the top edge midpoint', eq(at(0, 0), [1, 0, 0, 0]) && eq(at(9999, 9999), [0, 0, 0, 1]) && eq(at(600, -50), [0.5, 0.5, 0, 0]));
  const uv = M.spatialMorphUnitCoords('bilinear', { x: 325, y: 320 }, BI);
  check('the unit coordinates are (x - minX) / (maxX - minX) and (y - minY) / (maxY - minY): (325, 320) gives u = 0.25, v = 0.25', Math.abs(uv.u - 0.25) < 1e-15 && Math.abs(uv.v - 0.25) < 1e-15, JSON.stringify(uv));
  const p00 = { x: 10, y: 20 }, p10 = { x: 300, y: 25 }, p01 = { x: 12, y: 400 }, p11 = { x: 310, y: 390 };
  const bl = (x, y) => M.spatialMorphBlendPoint(p00, p10, p01, p11, at(x, y));
  const same = (a, b) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
  check('the blend of four corner points: at the corners it IS that corner point, at the centre the average of the four', same(bl(50, 40), p00) && same(bl(1150, 40), p10) && same(bl(50, 1160), p01) && same(bl(1150, 1160), p11) && same(bl(600, 600), { x: (10 + 300 + 12 + 310) / 4, y: (20 + 25 + 400 + 390) / 4 }));
  check('with one corner point for all four (a pattern that does not move) the blend is that point for every weight', pts.slice(0, 50).every((p) => same(M.spatialMorphBlendPoint(p00, p00, p00, p00, M.spatialMorphCornerWeights('bilinear', p, BI)), p00)));
});

console.log('\n== linear: eight angles ==');
T('linear', () => {
  const perp = (d) => ({ x: -d.y, y: d.x });
  let startOk = true, endOk = true, constOk = true, worstConst = 0;
  ANGLES.forEach((a) => {
    const d = M.spatialMorphDirection(a), n = perp(d);
    for (const t of [-700, -123.5, 0, 90, 480, 1300]) {
      const onStart = { x: LIN.scalarMin * d.x + t * n.x, y: LIN.scalarMin * d.y + t * n.y }, onEnd = { x: LIN.scalarMax * d.x + t * n.x, y: LIN.scalarMax * d.y + t * n.y };
      const ws = M.spatialMorphCornerWeights('linear', onStart, LIN, opts(a)), we = M.spatialMorphCornerWeights('linear', onEnd, LIN, opts(a));
      if (Math.abs(ws.w00 - 1) > 1e-9 || Math.abs(ws.w10) > 1e-9) startOk = false;
      if (Math.abs(we.w10 - 1) > 1e-9 || Math.abs(we.w00) > 1e-9) endOk = false;
      const mid = { x: 500 * d.x + t * n.x, y: 500 * d.y + t * n.y }, ref = M.spatialMorphCornerWeights('linear', { x: 500 * d.x, y: 500 * d.y }, LIN, opts(a));
      const wm = M.spatialMorphCornerWeights('linear', mid, LIN, opts(a));
      const diff = Math.max(Math.abs(wm.w00 - ref.w00), Math.abs(wm.w10 - ref.w10)); worstConst = Math.max(worstConst, diff); if (diff > 1e-9) constOk = false;
    }
  });
  check('on the START line of each of the 8 angles (the points whose scalar = scalarMin) the weight of K00 is 1 and of K10 is 0 (1e-9: the points are built with cos / sin)', startOk);
  check('on the END line of each of the 8 angles (scalar = scalarMax) the weight of K10 is 1 and of K00 is 0', endOk);
  check(`constant along every line perpendicular to the direction (8 angles x 6 offsets): the largest deviation is ${worstConst.toExponential(1)} (limit 1e-9)`, constOk);
  const xs = [0, 120, 300, 550, 800, 980, 1200].map((x) => M.spatialMorphCornerWeights('linear', { x, y: 77 }, LIN, opts(0)).w10);
  check('at 0 degrees the END weight grows from the left to the right edge and does not depend on y: 0 up to x = 120, 1 from x = 980 on, strictly between in between', xs[0] === 0 && xs[1] === 0 && xs[5] === 1 && xs[6] === 1 && xs[2] > 0 && xs[3] > xs[2] && xs[4] > xs[3] && xs[4] < 1 && M.spatialMorphCornerWeights('linear', { x: 550, y: -400 }, LIN, opts(0)).w10 === xs[3]);
  const ys = [0, 120, 300, 550, 800, 980, 1200].map((y) => M.spatialMorphCornerWeights('linear', { x: 33, y }, LIN, opts(90)).w10);
  check('at 90 degrees it grows from the TOP to the BOTTOM (canvas y down): the same numbers as at 0 degrees along y', JSON.stringify(ys) === JSON.stringify(xs));
  const x180 = [0, 120, 300, 550, 800, 980, 1200].map((x) => M.spatialMorphCornerWeights('linear', { x: -x, y: 5 }, LIN, opts(180)).w10);
  check('at 180 degrees the weight grows towards the LEFT: the point (-x, y) gives the 0 degree number of (x, y)', JSON.stringify(x180) === JSON.stringify(xs));
  let rotWorst = 0;
  ANGLES.forEach((a) => pts.slice(0, 60).forEach((p) => { const w1 = M.spatialMorphCornerWeights('linear', p, LIN, opts(a)), w2 = M.spatialMorphCornerWeights('linear', { x: -p.y, y: p.x }, LIN, opts(a + 90)), w3 = M.spatialMorphCornerWeights('linear', { x: -p.x, y: -p.y }, LIN, opts(a + 180)); rotWorst = Math.max(rotWorst, Math.abs(w1.w10 - w2.w10), Math.abs(w1.w10 - w3.w10)); }));
  check(`the angle steps agree with each other: rotating the point by 90 degrees (x, y) -> (-y, x) and the angle by +90 gives the same weights, and by 180 degrees too (8 angles x 60 points, worst ${rotWorst.toExponential(1)}, limit 1e-12)`, rotWorst <= 1e-12);
});

console.log('\n== radial ==');
T('radial', () => {
  const at = (x, y, span) => M.spatialMorphCornerWeights('radial', { x, y }, span || RAD, opts(0));
  check('the weight is 0 (K00) at the nearest tile (distance scalarMin) and 1 (K10) at the farthest (distance scalarMax); closer than the nearest tile, and the centre itself, is 0', at(635, 600).w00 === 1 && at(600, 565).w00 === 1 && at(600, 600).w00 === 1 && at(600 + 820, 600).w10 === 1 && at(600, 600 - 820).w10 === 1 && at(0, 0).w10 === 1);
  const D = 820; const span0 = { scalarMin: 0, scalarMax: D };
  check('with the span (0, D) the weight is 0 at the centre and 1 at distance D: the normalisation is by the span the caller froze (the nearest and farthest TILE in the prototype), not by the canvas corner', at(600, 600, span0).w00 === 1 && Math.abs(at(600 + D, 600, span0).w10 - 1) < 1e-12 && Math.abs(at(600, 600 + D / 2, span0).w10 - 0.5) < 1e-12);
  let circ = 0; [100, 333, 600].forEach((r) => { const ref = at(600 + r, 600).w10; for (let k = 0; k < 32; k++) { const t = (k / 32) * 2 * Math.PI; circ = Math.max(circ, Math.abs(at(600 + r * Math.cos(t), 600 + r * Math.sin(t)).w10 - ref)); } });
  check(`constant on circles around the centre (3 radii x 32 directions, worst ${circ.toExponential(1)}, limit 1e-12)`, circ <= 1e-12);
  const moved = M.spatialMorphCornerWeights('radial', { x: 700, y: 600 }, RAD, { center: { x: 100, y: 600 } });
  check('the centre is an argument: the same point gives the weight of its distance from the centre that was passed', Math.abs(moved.w10 - M.spatialMorphSmooth((600 - 35) / (820 - 35))) < 1e-12);
  check('without a centre the origin is the centre (no NaN)', finite4(M.spatialMorphCornerWeights('radial', { x: 300, y: 400 }, RAD, {})) && finite4(M.spatialMorphCornerWeights('radial', { x: 300, y: 400 }, RAD)));
});

console.log('\n== the weights depend only on the point and the span ==');
T('pure', () => {
  const run = () => CASES.map(([m, a]) => pts.slice(0, 80).map((p) => M.spatialMorphCornerWeights(m, p, specFor(m), opts(a))));
  check('determinism: the same input gives the same output, byte for byte (JSON of 800 results, three runs)', JSON.stringify(run()) === JSON.stringify(run()) && JSON.stringify(run()) === JSON.stringify(run()));
  check('the caller does not matter: fresh copies of the point, the span and the options (different objects, same numbers) give the same weights', CASES.every(([m, a]) => pts.slice(0, 40).every((p) => JSON.stringify(M.spatialMorphCornerWeights(m, p, specFor(m), opts(a))) === JSON.stringify(M.spatialMorphCornerWeights(m, { x: p.x, y: p.y, extra: 1 }, Object.assign({}, specFor(m), { unrelated: 'x' }), { center: { x: CENTER.x, y: CENTER.y }, angleDeg: a })))));
  // the same world point reached from two neighbouring tiles through different arithmetic (a seam point): equal to 1e-12 in weight
  const A = { x: 400, y: 300 }, B = { x: 463.3, y: 355.1 };
  const viaA = { x: A.x + (B.x - A.x) / 2, y: A.y + (B.y - A.y) / 2 }, viaB = { x: B.x + (A.x - B.x) / 2, y: B.y + (A.y - B.y) / 2 };
  check('a seam point reached from either tile (A + (B - A) / 2 and B + (A - B) / 2) gives the same weights to 1e-12: the field is a function of the world point, so neighbouring tiles agree on their shared edge', CASES.every(([m, a]) => W(M.spatialMorphCornerWeights(m, viaA, specFor(m), opts(a))).every((v, i) => Math.abs(v - W(M.spatialMorphCornerWeights(m, viaB, specFor(m), opts(a)))[i]) < 1e-12)));
  // inputs are not mutated: deep-freeze everything and run the module in strict mode so that a write throws
  const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
  const strictCtx = vm.createContext({ module: { exports: {} }, Math, Number, Object });
  vm.runInContext('"use strict";\n' + SRC, strictCtx, { filename: 'spatial-morph.js (strict)' });
  const SM = strictCtx.module.exports;
  let threw = null;
  try {
    const p = deepFreeze({ x: 123.5, y: 456.5 }), span = deepFreeze({ scalarMin: 10, scalarMax: 900, minX: 0, maxX: 1200, minY: 0, maxY: 1200 }), o = deepFreeze({ angleDeg: 45, center: { x: 600, y: 600 } });
    const c = [deepFreeze({ x: 1, y: 2 }), deepFreeze({ x: 3, y: 4 }), deepFreeze({ x: 5, y: 6 }), deepFreeze({ x: 7, y: 8 })];
    ['linear', 'radial', 'bilinear', 'weird'].forEach((m) => { const w = SM.spatialMorphCornerWeights(m, p, span, o); SM.spatialMorphUnitCoords(m, p, span, o); SM.spatialMorphScalar(m, p, o); SM.spatialMorphBlendPoint(c[0], c[1], c[2], c[3], deepFreeze(Object.assign({}, w))); });
    SM.spatialMorphDirection(45); SM.spatialMorphSmooth(0.3); SM.spatialMorphUnit(1, 0, 2);
  } catch (e) { threw = e; }
  check('no input is changed: frozen points, spans, options and corner points go through every function of the strict-mode module without a TypeError', threw === null, threw && threw.message);
  const before = JSON.stringify([pts[0], LIN, opts(45)]); M.spatialMorphCornerWeights('linear', pts[0], LIN, opts(45));
  check('...and the plain objects are equal before and after a call', before === JSON.stringify([pts[0], LIN, opts(45)]));
  const bare = vm.createContext({ module: { exports: {} }, Math, Number, Object });   // a context with NO other global: no window, document, state, p5, Date, performance, timers
  let bareErr = null; try { vm.runInContext(SRC, bare, { filename: 'spatial-morph.js (bare)' }); const B2 = bare.module.exports; ['linear', 'radial', 'bilinear'].forEach((m) => B2.spatialMorphCornerWeights(m, { x: 1, y: 2 }, { scalarMin: 0, scalarMax: 10, minX: 0, maxX: 10, minY: 0, maxY: 10 }, { angleDeg: 45, center: { x: 0, y: 0 } })); } catch (e) { bareErr = e; }
  check('no global is read: the file loads and every function runs in a context that has only Math, Number and Object (a read of a global would be a ReferenceError)', bareErr === null, bareErr && bareErr.message);
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  check('the source has no random, clock, timer, DOM or p5 access: no Math.random, Date, performance, setTimeout, setInterval, requestAnimationFrame, window, document, globalThis, state, timeline, additionalLayers, outerCorners, width, height', !/Math\.random|\bDate\b|performance|setTimeout|setInterval|requestAnimationFrame|\bwindow\b|\bdocument\b|globalThis|\bstate\b|\btimeline\b|additionalLayers|outerCorners|\bwidth\b|\bheight\b/.test(code));
});

console.log('\n== degenerate input ==');
T('degenerate', () => {
  const ok = (r) => finite4(r) && inRange4(r) && Math.abs(sum(r) - 1) <= TOL;
  const flatX = { minX: 100, maxX: 100, minY: 0, maxY: 1000 }, flatY = { minX: 0, maxX: 1000, minY: 700, maxY: 700 };
  check('a bilinear span of zero width: u = 0 for every point (K00 / K01 side), v still works; zero height: v = 0, u still works', ok(M.spatialMorphCornerWeights('bilinear', { x: 500, y: 500 }, flatX)) && M.spatialMorphUnitCoords('bilinear', { x: 500, y: 500 }, flatX).u === 0 && M.spatialMorphUnitCoords('bilinear', { x: 500, y: 500 }, flatX).v === 0.5 && M.spatialMorphUnitCoords('bilinear', { x: 500, y: 500 }, flatY).v === 0 && M.spatialMorphUnitCoords('bilinear', { x: 500, y: 500 }, flatY).u === 0.5);
  check('a 1D span of zero length (scalarMin = scalarMax) or an inverted one: u = 0, so the weights are (1, 0, 0, 0)', ['linear', 'radial'].every((m) => JSON.stringify(W(M.spatialMorphCornerWeights(m, { x: 300, y: 300 }, { scalarMin: 50, scalarMax: 50 }, opts(0)))) === '[1,0,0,0]' && JSON.stringify(W(M.spatialMorphCornerWeights(m, { x: 300, y: 300 }, { scalarMin: 80, scalarMax: 20 }, opts(0)))) === '[1,0,0,0]'));
  check('a point far outside the span is clamped: the weights stay in [0, 1] and sum to 1 (1e300, -1e300)', CASES.every(([m, a]) => [{ x: 1e300, y: 1e300 }, { x: -1e300, y: -1e300 }, { x: 1e300, y: -1e300 }].every((p) => ok(M.spatialMorphCornerWeights(m, p, specFor(m), opts(a))))));
  const garbage = [NaN, Infinity, -Infinity, undefined, null, 'x', '12', {}, [], true, 1e308, -1e308, 0, -0];
  let n = 0, bad = 0;
  ['linear', 'radial', 'bilinear', 'weird', undefined, null, 5].forEach((m) => garbage.forEach((a) => garbage.forEach((b) => {
    const cases = [
      [m, { x: a, y: b }, { scalarMin: a, scalarMax: b, minX: a, maxX: b, minY: a, maxY: b }, { angleDeg: a, center: { x: b, y: a } }],
      [m, { x: 100, y: 200 }, { scalarMin: a, scalarMax: b, minX: b, maxX: a, minY: a, maxY: b }, { angleDeg: b, center: { x: 50, y: a } }],
      [m, { x: a, y: 200 }, { scalarMin: 0, scalarMax: 500, minX: 0, maxX: 500, minY: 0, maxY: 500 }, { angleDeg: a }],
    ];
    cases.forEach((c) => { n++; const r = M.spatialMorphCornerWeights(c[0], c[1], c[2], c[3]); if (!ok(r)) bad++; });
  })));
  check(`NaN, infinities, strings, null, undefined, objects and extreme numbers in every argument (${n} calls): the four weights are always finite, in [0, 1] and sum to 1`, bad === 0, bad);
  check('missing arguments (no point, no span, no options, nothing) give finite weights too', [[], ['linear'], ['radial', undefined, undefined, undefined], ['bilinear', null, null, null], [undefined, {}, {}, {}]].every((a) => ok(M.spatialMorphCornerWeights(...a))));
  check('an unknown mode behaves as linear: the same weights as mode "linear" with the same angle', pts.slice(0, 50).every((p) => JSON.stringify(M.spatialMorphCornerWeights('spiral', p, LIN, opts(45))) === JSON.stringify(M.spatialMorphCornerWeights('linear', p, LIN, opts(45)))));
  check('an angle that is not a step of 45 (30, -45, 400, 1e6) gives finite weights and equals the angle taken modulo 360 to 1e-12 (-45 = 315, 405 = 45; only the multiples of 90 are bit-exact)', [30, -45, 400, 1e6, 12.5].every((a) => pts.slice(0, 30).every((p) => ok(M.spatialMorphCornerWeights('linear', p, LIN, opts(a))))) && pts.slice(0, 30).every((p) => [[-45, 315], [405, 45]].every(([a, b]) => W(M.spatialMorphCornerWeights('linear', p, LIN, opts(a))).every((v, i) => Math.abs(v - W(M.spatialMorphCornerWeights('linear', p, LIN, opts(b)))[i]) < 1e-12))));
  check('the blend with a weight set that came from degenerate input is finite', ok(M.spatialMorphCornerWeights('bilinear', { x: NaN, y: NaN }, BI)) && Number.isFinite(M.spatialMorphBlendPoint({ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }, { x: 7, y: 8 }, M.spatialMorphCornerWeights('bilinear', { x: NaN, y: NaN }, BI)).x));
});

console.log('\n== golden numbers: the prototype\'s own functions ==');

// [mode, angleDeg, x, y, span, [w00, w10, w01, w11]]: the span is [scalarMin, scalarMax] for linear and radial and [minX, maxX, minY, maxY] for bilinear; the centre of radial is (600, 600).
// Produced by running the prototype's computeSpatialMorphWeight() / computeSpatialMorphBilinearWeights() / smoothCosineWeight() / bilerpPoint() with the wave OFF (phase 0, ping-pong off).
const GOLDEN = [
    ["linear", 0, 0, 0, [120, 980], [1, 0, 0, 0]],
    ["linear", 0, 300, 200, [120, 980], [0.8957482442146271, 0.10425175578537293, 0, 0]],
    ["linear", 0, 600, 600, [120, 980], [0.4091815745102818, 0.5908184254897182, 0, 0]],
    ["linear", 0, 900, 450, [120, 980], [0.021199700045797076, 0.9788002999542029, 0, 0]],
    ["linear", 0, 1200, 1200, [120, 980], [0, 1, 0, 0]],
    ["linear", 0, 150, 1000, [120, 980], [0.997000487619973, 0.0029995123800270473, 0, 0]],
    ["linear", 45, 0, 0, [120, 980], [1, 0, 0, 0]],
    ["linear", 45, 300, 200, [120, 980], [0.8287976411942292, 0.17120235880577084, 0, 0]],
    ["linear", 45, 600, 600, [120, 980], [0.0565645827317095, 0.9434354172682905, 0, 0]],
    ["linear", 45, 900, 450, [120, 980], [0.002151782667503044, 0.997848217332497, 0, 0]],
    ["linear", 45, 1200, 1200, [120, 980], [0, 1, 0, 0]],
    ["linear", 45, 150, 1000, [120, 980], [0.09001056443625699, 0.909989435563743, 0, 0]],
    ["linear", 90, 0, 0, [120, 980], [1, 0, 0, 0]],
    ["linear", 90, 300, 200, [120, 980], [0.9788002999542029, 0.02119970004579702, 0, 0]],
    ["linear", 90, 600, 600, [120, 980], [0.4091815745102818, 0.5908184254897182, 0, 0]],
    ["linear", 90, 900, 450, [120, 980], [0.6786154449005664, 0.3213845550994336, 0, 0]],
    ["linear", 90, 1200, 1200, [120, 980], [0, 1, 0, 0]],
    ["linear", 90, 150, 1000, [120, 980], [0, 1, 0, 0]],
    ["linear", 135, 0, 0, [120, 980], [1, 0, 0, 0]],
    ["linear", 135, 300, 200, [120, 980], [1, 0, 0, 0]],
    ["linear", 135, 600, 600, [120, 980], [1, 0, 0, 0]],
    ["linear", 135, 900, 450, [120, 980], [1, 0, 0, 0]],
    ["linear", 135, 1200, 1200, [120, 980], [1, 0, 0, 0]],
    ["linear", 135, 150, 1000, [120, 980], [0.40731289350346833, 0.5926871064965317, 0, 0]],
    ["linear", 180, 0, 0, [120, 980], [1, 0, 0, 0]],
    ["linear", 180, 300, 200, [120, 980], [1, 0, 0, 0]],
    ["linear", 180, 600, 600, [120, 980], [1, 0, 0, 0]],
    ["linear", 180, 900, 450, [120, 980], [1, 0, 0, 0]],
    ["linear", 180, 1200, 1200, [120, 980], [1, 0, 0, 0]],
    ["linear", 180, 150, 1000, [120, 980], [1, 0, 0, 0]],
    ["linear", 225, 0, 0, [120, 980], [1, 0, 0, 0]],
    ["linear", 225, 300, 200, [120, 980], [1, 0, 0, 0]],
    ["linear", 225, 600, 600, [120, 980], [1, 0, 0, 0]],
    ["linear", 225, 900, 450, [120, 980], [1, 0, 0, 0]],
    ["linear", 225, 1200, 1200, [120, 980], [1, 0, 0, 0]],
    ["linear", 225, 150, 1000, [120, 980], [1, 0, 0, 0]],
    ["linear", 270, 0, 0, [120, 980], [1, 0, 0, 0]],
    ["linear", 270, 300, 200, [120, 980], [1, 0, 0, 0]],
    ["linear", 270, 600, 600, [120, 980], [1, 0, 0, 0]],
    ["linear", 270, 900, 450, [120, 980], [1, 0, 0, 0]],
    ["linear", 270, 1200, 1200, [120, 980], [1, 0, 0, 0]],
    ["linear", 270, 150, 1000, [120, 980], [1, 0, 0, 0]],
    ["linear", 315, 0, 0, [120, 980], [1, 0, 0, 0]],
    ["linear", 315, 300, 200, [120, 980], [1, 0, 0, 0]],
    ["linear", 315, 600, 600, [120, 980], [1, 0, 0, 0]],
    ["linear", 315, 900, 450, [120, 980], [0.8745743356209685, 0.12542566437903147, 0, 0]],
    ["linear", 315, 1200, 1200, [120, 980], [1, 0, 0, 0]],
    ["linear", 315, 150, 1000, [120, 980], [1, 0, 0, 0]],
    ["linear", 45, 400, 300, [200, 1500], [0.8782541840177769, 0.12174581598222312, 0, 0]],
    ["linear", 30, 400, 300, [100, 1000], [0.5929873745893421, 0.40701262541065786, 0, 0]],
    ["linear", 45, 700, 800, [200, 1500], [0.25631144842033815, 0.7436885515796618, 0, 0]],
    ["linear", 30, 700, 800, [100, 1000], [0, 1, 0, 0]],
    ["radial", 0, 600, 600, [35, 820], [1, 0, 0, 0]],
    ["radial", 0, 635, 600, [35, 820], [1, 0, 0, 0]],
    ["radial", 0, 900, 600, [35, 820], [0.7442014957884472, 0.2557985042115528, 0, 0]],
    ["radial", 0, 600, 100, [35, 820], [0.3569534138896262, 0.6430465861103738, 0, 0]],
    ["radial", 0, 100, 100, [35, 820], [0.05016906598465065, 0.9498309340153493, 0, 0]],
    ["radial", 0, 1180, 20, [35, 820], [0, 1, 0, 0]],
    ["radial", 0, 650, 700, [35, 820], [0.9765663777267892, 0.02343362227321083, 0, 0]],
    ["bilinear", 0, 50, 40, [50, 1150, 40, 1160], [1, 0, 0, 0]],
    ["bilinear", 0, 1150, 40, [50, 1150, 40, 1160], [0, 1, 0, 0]],
    ["bilinear", 0, 50, 1160, [50, 1150, 40, 1160], [0, 0, 1, 0]],
    ["bilinear", 0, 1150, 1160, [50, 1150, 40, 1160], [0, 0, 0, 1]],
    ["bilinear", 0, 600, 600, [50, 1150, 40, 1160], [0.25, 0.24999999999999997, 0.24999999999999997, 0.24999999999999994]],
    ["bilinear", 0, 600, 40, [50, 1150, 40, 1160], [0.5, 0.49999999999999994, 0, 0]],
    ["bilinear", 0, 50, 600, [50, 1150, 40, 1160], [0.5, 0, 0.49999999999999994, 0]],
    ["bilinear", 0, 325, 320, [50, 1150, 40, 1160], [0.7285533905932737, 0.12499999999999997, 0.12499999999999997, 0.02144660940672623]],
    ["bilinear", 0, 875, 880, [50, 1150, 40, 1160], [0.02144660940672625, 0.12500000000000003, 0.12500000000000003, 0.7285533905932737]],
    ["bilinear", 0, 0, 0, [50, 1150, 40, 1160], [1, 0, 0, 0]],
    ["bilinear", 0, 1300, 1300, [50, 1150, 40, 1160], [0, 0, 0, 1]],
];
T('golden', () => {
  const toSpan = (mode, s) => (mode === 'bilinear' ? { minX: s[0], maxX: s[1], minY: s[2], maxY: s[3] } : { scalarMin: s[0], scalarMax: s[1] });
  let worst = 0, numbers = 0, bad = [];
  GOLDEN.forEach((g) => {
    const [mode, a, x, y, s, exp] = g;
    const r = M.spatialMorphCornerWeights(mode, { x, y }, toSpan(mode, s), { angleDeg: a, center: CENTER });
    W(r).forEach((v, i) => { const d = Math.abs(v - exp[i]); numbers++; if (d > worst) worst = d; if (d > TOL) bad.push(`${mode} ${a} (${x}, ${y}) w${i}: ${v} vs ${exp[i]}`); });
  });
  check(`${GOLDEN.length} cases = ${numbers} golden weights (8 linear angles on 6 points, 8 more linear, 7 radial, 11 bilinear: inside, on the edges, outside) equal the prototype's within ${TOL} (worst ${worst.toExponential(2)})`, GOLDEN.length >= 70 && numbers >= 280 && bad.length === 0, bad.slice(0, 3).join(' | '));
  const lin = GOLDEN.filter((g) => g[0] === 'linear'), rad = GOLDEN.filter((g) => g[0] === 'radial'), bil = GOLDEN.filter((g) => g[0] === 'bilinear');
  check('the golden table covers every mode and all 8 angles, and its own rows are partitions of unity (the numbers were not edited)', lin.length === 52 && rad.length === 7 && bil.length === 11 && new Set(lin.map((g) => g[1])).size === 9 && GOLDEN.every((g) => Math.abs(g[5].reduce((p, q) => p + q, 0) - 1) < 1e-12));
});

console.log('\n== names: the file is a classic script (its top-level names are page globals) ==');
T('names', () => {
  const DATA = JSON.parse(fs.readFileSync(process.env.P5_NAMES_JSON || path.join(ROOT, 'tools', 'ui', 'p5-names-1.9.0.json'), 'utf8'));
  const { makeReader } = require(path.join(ROOT, 'tools', 'ui', 'p5-names-reader.js'));
  const R = makeReader(DATA);
  const topLevel = (src) => { const s = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')); const out = []; s.split('\n').forEach((line) => { let m; if ((m = /^(?:async\s+)?function\s*\*?\s*([\w$]+)/.exec(line)) || (m = /^(?:const|let|var)\s+([\w$]+)/.exec(line)) || (m = /^class\s+([\w$]+)/.exec(line))) out.push(m[1]); }); return out; };
  const names = topLevel(SRC);
  check(`the file has top-level names (${names.length}: ${names.join(', ')}) and EVERY one starts with spatialMorph`, names.length === 10 && names.every((n) => /^spatialMorph[A-Z]/.test(n)), names.filter((n) => !/^spatialMorph[A-Z]/.test(n)).join());
  check('the module.exports list is exactly these names (nothing exported that is not top-level, nothing top-level left out)', JSON.stringify(Object.keys(M).sort()) === JSON.stringify(names.slice().sort()));
  const hits = names.filter((n) => R.kindOf(n) !== null || DATA.members.includes(n) || DATA.constants.includes(n) || DATA.globalFunctions.includes(n) || DATA.objectPrototypeNames.includes(n));
  check('no name is a p5 member, constant or global function of the frozen list tools/ui/p5-names-1.9.0.json (the reader\'s own check, kindOf, says none reacts)', hits.length === 0, hits.join());
  const otherFiles = fs.readdirSync(path.join(ROOT, 'core')).filter((f) => /\.js$/.test(f) && f !== 'spatial-morph.js').map((f) => path.join(ROOT, 'core', f)).concat([path.join(ROOT, 'sketch.js')]).concat(fs.readdirSync(ROOT).filter((f) => /^(ui|nav|gallery).*\.js$/.test(f)).map((f) => path.join(ROOT, f)));
  const owner = new Map(); otherFiles.forEach((f) => topLevel(fs.readFileSync(f, 'utf8')).forEach((n) => { if (!owner.has(n)) owner.set(n, path.basename(f)); }));
  const clash = names.filter((n) => owner.has(n));
  check(`none collides with a top-level name of the other core files, sketch.js or the ui, nav and gallery scripts (${otherFiles.length} files, ${owner.size} names scanned)`, clash.length === 0 && owner.size > 300, clash.map((n) => n + ' in ' + owner.get(n)).join());
  const idx = (name) => { const h = fs.readFileSync(path.join(ROOT, name), 'utf8'); return /spatial-morph\.js/.test(h); };
  check('the file is not loaded by any page yet (index.html and gallery.html do not mention it): stage a1 has no wiring', !idx('index.html') && !idx('gallery.html'));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
