// Guard for morph stage d: the spatial morph FOLLOWS THE TIMELINE (linear and radial; bilinear stays static).
// CONVENTION (tested below): the front travels in the direction of the unit coordinate u (linear: the angle; radial: from the centre outward); behind it the LATER keyframe, ahead of it the EARLIER one.
//   w(u, p) = smooth(clamp01((p (1 + band) - u) / band)), band = 1: weight of the later keyframe; p = 0 -> 0 everywhere, p = 1 -> 1 everywhere, p = 0.5 -> smooth(1 - u).
// Properties (every one a check below): 1. the pure front weight against an independent oracle, its endpoints, its monotony, the hard step and the degenerate inputs; 2. the segment mirror equals the real
// resolveTimelineSegment() cut out of sketch.js for 300 elapsed values; 3. the render: p = 0.5 equals the static morph reversed (linear: angle + 180, radial: keyframes swapped), the frame at the start of
// segment i is the normal frame of keyframe i and at the end of the last segment the normal frame of the last keyframe, segments follow each other without a jump, each segment uses its OWN pairing, flips and
// members, the span is frozen (it does not depend on the progress), the status fields, bilinear ignores the progress; 4. the seams of the REAL drawn segments at 7 progress values; 5. golden hashes of the
// ON path.
//   node tools/morph/test-spatial-morph-time.js
//   node tools/morph/test-spatial-morph-time.js --print-golden      (prints the GOLDEN table below from the tree you trust)
//   SPATIAL_MORPH_JS=... SPATIAL_MORPH_RENDER_JS=... node tools/morph/test-spatial-morph-time.js        (sabotage runs)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld, seamSetup } = require('./render-harness.js');
const H = require('./morph-harness.js');
const M = require(process.env.SPATIAL_MORPH_JS || path.join(ROOT, 'core', 'spatial-morph.js'));
const SKETCH_SRC = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const PRINT = process.argv.includes('--print-golden');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { if (PRINT) return; checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 400)); } };
const J = (x) => JSON.stringify(x);
const same = (a, b) => J(a) === J(b);
const hashOf = (x) => crypto.createHash('sha256').update(J(x)).digest('hex').slice(0, 16);
const sec = (t) => { if (!PRINT) console.log(t); };

// ---- the independent oracle (plain arithmetic, no function of the module) -----------------------------------------------------------------------------------------------------------------------
const oSmooth = (t) => 0.5 * (1 - Math.cos(Math.PI * t));
function oracle(u, p, b) {
  const uu = Math.min(1, Math.max(0, u)), pp = Math.min(1, Math.max(0, p));
  const t = Math.min(1, Math.max(0, (pp * (1 + b) - uu) / b));
  return oSmooth(t);
}

sec('== 1. the front weight ==');
T('front', () => {
  const F = M.spatialMorphFrontWeight;
  check('the band is the internal constant 1', M.spatialMorphFrontBand === 1);
  // p = 0 and p = 1 for every u, inside and outside [0, 1]
  const us = []; for (let i = -8; i <= 72; i++) us.push(i / 64);
  us.push(-1e9, 1e9, -Infinity, Infinity, 0.5, 1 - 1e-16, 1e-16);
  check(`p = 0 gives exactly 0 and p = 1 exactly 1 for every u in [-0.125, 1.125] and far outside (${us.length} values, also +-Infinity)`, us.every((u) => F(u, 0) === 0 && F(u, 1) === 1));
  check('p below 0 counts as 0 and above 1 as 1 (also +-Infinity)', [-1, -1e9, -Infinity].every((p) => us.every((u) => F(u, p) === 0)) && [1.0000001, 2, 1e9, Infinity].every((p) => us.every((u) => F(u, p) === 1)));
  // p = 0.5: smooth(1 - u), bit for bit
  const inside = us.filter((u) => u >= 0 && u <= 1 && Number.isFinite(u));
  check(`p = 0.5 equals smooth(1 - u) bit for bit (${inside.length} values of u in [0, 1]; the module's own smooth and the independent one)`, inside.every((u) => F(u, 0.5) === M.spatialMorphSmooth(1 - u) && F(u, 0.5) === oSmooth(1 - u)));
  check('a u outside [0, 1] counts as its nearest end: F(-3, p) = F(0, p) and F(7, p) = F(1, p) for 33 values of p', Array.from({ length: 33 }, (_, i) => i / 32).every((p) => F(-3, p) === F(0, p) && F(7, p) === F(1, p) && F(-Infinity, p) === F(0, p) && F(Infinity, p) === F(1, p)));
  // the closed form on a grid
  let worst = 0, n = 0;
  for (const b of [1, 0.5, 2, 0.1]) for (let i = 0; i <= 64; i++) for (let j = 0; j <= 64; j++) { const u = i / 64, p = j / 64; worst = Math.max(worst, Math.abs(F(u, p, b) - oracle(u, p, b))); n++; }
  check(`the closed form on a grid (65 x 65 points x 4 bands = ${n}) equals the independent oracle (worst ${worst.toExponential(1)})`, worst <= 1e-15);
  check('three hand values: F(0.25, 0.5) = 0.5 (1 - cos(0.75 pi)), F(0, 0.25) = 0.5 (1 - cos(0.5 pi)) = 0.5, F(1, 0.75) = 0.5 (1 - cos(0.5 pi)) = 0.5', Math.abs(F(0.25, 0.5) - 0.8535533905932737) < 1e-15 && Math.abs(F(0, 0.25) - 0.5) < 1e-15 && Math.abs(F(1, 0.75) - 0.5) < 1e-15);
  // monotony
  let bad = 0;
  for (let i = 0; i <= 64; i++) { let prev = -1; for (let j = 0; j <= 400; j++) { const w = F(i / 64, j / 400); if (w < prev) bad++; prev = w; } }
  for (let j = 0; j <= 64; j++) { let prev = 2; for (let i = 0; i <= 400; i++) { const w = F(i / 400, j / 64); if (w > prev) bad++; prev = w; } }
  check(`monotone: non-decreasing in p for every u and non-increasing in u for every p (${65 * 401 * 2} samples, ${bad} violations)`, bad === 0);
  check('every value is in [0, 1] and finite', us.every((u) => Array.from({ length: 21 }, (_, i) => i / 20).every((p) => { const w = F(u, p); return Number.isFinite(w) && w >= 0 && w <= 1; })));
  // the front travels towards larger u: at p = 0.25 the start edge (u = 0) is already past the front, the far end is not
  check('the front starts at u = 0 and wanders to u = 1: at p = 0.5 the later keyframe has weight 1 at u = 0, 0.5 at u = 0.5 and 0 at u = 1, strictly decreasing in between; at p = 0.25 it has reached u = 0.5 and not beyond (0 for u >= 0.5)', F(0, 0.5) === 1 && Math.abs(F(0.5, 0.5) - 0.5) < 1e-15 && F(1, 0.5) === 0 && F(0.25, 0.5) > F(0.5, 0.5) && F(0.5, 0.5) > F(0.75, 0.5) && F(0.5, 0.25) === 0 && F(0.25, 0.25) > 0 && F(0.25, 0.25) < F(0, 0.25));
  // hard step and degenerate bands
  const hard = [0, -1, NaN, -Infinity, Infinity, undefined === 1 ? 0 : 'x', null];
  check('a band that is not a positive finite number is a HARD STEP: 0 at p = 0, 1 at p = 1, in between 1 where u < p and 0 elsewhere (u = p is 0)', hard.every((b) => F(0.3, 0, b) === 0 && F(0.3, 1, b) === 1 && F(0.3, 0.5, b) === 1 && F(0.5, 0.5, b) === 0 && F(0.7, 0.5, b) === 0 && F(1, 1, b) === 1 && F(0, 0, b) === 0));
  check('a NaN u or p gives 0 (and a missing one)', F(NaN, 0.5) === 0 && F(0.5, NaN) === 0 && F(NaN, NaN) === 0 && F(undefined, 0.5) === 0 && F(0.5, undefined) === 0 && F('0.5', 0.5) === 0);
  check('a band other than 1 is honoured: F(0.2, 0.5, 0.5) differs from the band 1 value, equals the oracle, and p = 0 / 1 still give 0 / 1', F(0.2, 0.5, 0.5) !== F(0.2, 0.5) && Math.abs(F(0.2, 0.5, 0.5) - oracle(0.2, 0.5, 0.5)) < 1e-15 && F(1, 1, 0.5) === 1 && F(0, 0, 0.5) === 0 && F(1, 1, 2) === 1 && F(0, 0, 2) === 0);
  // the corner weights
  const span = { scalarMin: 50, scalarMax: 550, minX: 50, maxX: 550, minY: 50, maxY: 550 };
  const o = { angleDeg: 45, center: { x: 300, y: 300 }, progress: 0.4 };
  let ok = true, fine = 0;
  for (const mode of ['linear', 'radial']) for (let i = 0; i < 40; i++) {
    const pt = { x: 40 + 13.7 * i, y: 600 - 11.3 * i };
    const w = M.spatialMorphFrontCornerWeights(mode, pt, span, o);
    const u = M.spatialMorphUnitCoords(mode, pt, span, o).u;
    if (!(w.w10 === M.spatialMorphFrontWeight(u, 0.4) && w.w00 === 1 - w.w10 && w.w01 === 0 && w.w11 === 0)) ok = false; fine++;
  }
  check(`the front corner weights (${fine} points, linear and radial) are (1 - w, w, 0, 0) with w the front weight of the RAW unit coordinate (no second smoothing)`, ok);
  const wb = M.spatialMorphFrontCornerWeights('bilinear', { x: 120, y: 300 }, span, o), sb = M.spatialMorphCornerWeights('bilinear', { x: 120, y: 300 }, span, o);
  check('bilinear has no front: the front corner weights are the static weights of stage a1 whatever the progress', same(wb, sb) && same(M.spatialMorphFrontCornerWeights('bilinear', { x: 120, y: 300 }, span, Object.assign({}, o, { progress: 0.9 })), sb));
  // exactEnds: at weights that are one corner the endpoint is that keyframe's own position, not its projection
  const sqp = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const dsc = M.spatialMorphPrepareEndpoint([{ x: 30, y: 0.4 }, { x: 0.3, y: 60 }, { x: 30, y: 0.4 }, { x: 0.3, y: 60 }], sqp);
  const at0 = M.spatialMorphAnchoredPoint(dsc, null, { w00: 1, w10: 0, w01: 0, w11: 0 }, true), at1 = M.spatialMorphAnchoredPoint(dsc, null, { w00: 0, w10: 1, w01: 0, w11: 0 }, true);
  const noEx = M.spatialMorphAnchoredPoint(dsc, null, { w00: 0, w10: 1, w01: 0, w11: 0 });
  const mid = M.spatialMorphAnchoredPoint(dsc, null, { w00: 0.5, w10: 0.5, w01: 0, w11: 0 }, true);
  check('exactEnds: an endpoint 0.4 px off its edge, and another keyframe putting it on a DIFFERENT edge: at weights (1, 0, 0, 0) and (0, 1, 0, 0) it is that keyframe\'s own position; without the flag it is the projection (the stage c behaviour); in between it is the blend of the projections', same(at0, { x: 30, y: 0.4 }) && same(at1, { x: 0.3, y: 60 }) && !same(noEx, { x: 0.3, y: 60 }) && mid.y === 0 || mid.x !== 0.3);
  const sw = M.spatialMorphFrontCornerWeights('linear', { x: 1, y: 2 }, span, undefined);
  check('missing options never throw and give finite weights that sum to 1', Object.values(sw).every(Number.isFinite) && Math.abs(sw.w00 + sw.w10 + sw.w01 + sw.w11 - 1) < 1e-15);
});

sec('\n== 2. the segment arithmetic equals the real resolveTimelineSegment() ==');
T('segments', () => {
  const m = SKETCH_SRC.match(/function resolveTimelineSegment\([\s\S]*?\n\}\n/);
  const sb = vm.createContext({}); vm.runInContext(m[0], sb);
  const real = (durs, e) => vm.runInContext(`resolveTimelineSegment(${J({ segmentDurationsMs: durs })}, ${Number.isNaN(e) ? 'NaN' : String(e)})`, sb);
  const sets = [[2000], [2000, 3500], [1000, 2500, 400], [2000, 2000, 2000, 2000], [10, 0, 7], [1, 1e-9, 5]];
  let n = 0, bad = '';
  for (const durs of sets) {
    const total = durs.reduce((a, b) => a + b, 0);
    const els = [-5, -1e-12, 0, total, total + 1e-9, total + 5000, NaN];
    for (let k = 0; k < 300; k++) els.push((k / 299) * total * 1.05);
    let acc = 0; durs.forEach((d) => { acc += d; els.push(acc, acc - 1e-9, acc + 1e-9, acc - d / 2); });
    for (const e of els) { n++; const a = real(durs, e), b = M.spatialMorphSegmentAt(durs, e); if (!same(a === undefined ? null : a, b === undefined ? null : b)) { if (!bad) bad = `${J(durs)} @ ${e}: ${J(a)} vs ${J(b)}`; } }
  }
  check(`spatialMorphSegmentAt equals the real resolveTimelineSegment() for ${n} elapsed values (6 duration sets: 1 to 4 segments, uneven, a zero-length and a tiny segment; the boundaries, +-1e-9, before 0, after the end, NaN)`, bad === '', bad);
  check('at exactly the end of segment i the next segment starts at localT 0; at the very end the last segment is at localT 1; no segments gives null', same(M.spatialMorphSegmentAt([1000, 2000], 1000), { segmentIndex: 1, localT: 0 }) && same(M.spatialMorphSegmentAt([1000, 2000], 3000), { segmentIndex: 1, localT: 1 }) && same(M.spatialMorphSegmentAt([1000, 2000], 999.5), { segmentIndex: 0, localT: 0.9995 }) && M.spatialMorphSegmentAt([], 5) === null && M.spatialMorphSegmentAt(undefined, 5) === null);
});

// ---- 3. the render ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const CONNS = { square: [[1, 5], [2, 8], [3, 7]], triangle: [[1, 5], [2, 6], [3, 4]], hex: [[1, 10], [3, 14], [5, 20]] };
const ALT = { square: [[1, 9], [2, 6], [4, 8]], triangle: [[1, 6], [2, 5], [3, 5]], hex: [[2, 11], [4, 15], [6, 21]] };
const ALT2 = { square: [[3, 6], [1, 4], [2, 9]], triangle: [[2, 4], [1, 5], [3, 6]], hex: [[3, 12], [5, 16], [1, 8]] };
const setElapsed = (w, ms) => w.set(`timeline.elapsedMs = ${ms};`);
// STAGE D2C (exact ends off, the prototype's boundary rule): the frame at p = 0, at the start of a later segment and at the very end is the keyframe with those boundary endpoints PROJECTED onto their edge that change
// the edge they sit on (or lie off the one they share): the prototype's blend never reaches such a keyframe either. It is the normal frame of the keyframe itself when no endpoint is projected.
// projectedKeyframe(w, seg, which): the lines of keyframe `which` (0 = the earlier, 1 = the later one of segment seg) as the morph shows them at its end, and how many endpoints are projected (moved by more than 1e-6 px).
function projectedKeyframe(w, seg, which) {
  const r = w.run(`(function () { const r = resolveTimelineKeyframeCoords(timeline, ${seg}); return { from: r.from, to: r.to }; })()`);
  const prep = M.spatialMorphPrepareLines(M.spatialMorphChooseCorners([r.from, r.to], 'linear'), w.get('outerCorners'));
  let projected = 0;
  const pick = (d) => { if (!(d.onBoundary && d.moved)) return d.points[which]; const q = d.edgePoints[which]; if (Math.hypot(q.x - d.points[which].x, q.y - d.points[which].y) > 1e-6) projected++; return q; };
  const lines = prep.map((pl) => { const a = pick(pl.a), b = pick(pl.b); return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }; });
  return { lines, projected };
}
const linesToBase = (w, lines) => { const nd = [], cn = []; lines.forEach((l, i) => { nd.push({ id: 2 * i + 1, x: l.x1, y: l.y1 }, { id: 2 * i + 2, x: l.x2, y: l.y2 }); cn.push([2 * i + 1, 2 * i + 2]); }); w.set(`nodes = ${J(nd)}; connections = ${J(cn)};`); };
const setProgress = (w, p) => w.set(`timeline.elapsedMs = ${p} * totalTimelineDurationMs(timeline);`);
function world(shape, sym, kfs, tlExtra) {
  const w = makeRenderWorld(shape, 3, 3, sym);
  w.baseConnections(CONNS[shape]);
  const ids = kfs.map((c) => w.addKeyframeLayer(c));
  if (ids.length >= 2) w.setTimeline(ids, tlExtra);
  return w;
}
const normalHash = (shape, sym, conns) => { const w = makeRenderWorld(shape, 3, 3, sym); w.baseConnections(conns); return hashOf(w.drawn()); };

sec('\n== 3. the render at a progress ==');
// keyframe layers made of the a2 corner sets (custom nodes; every boundary endpoint slides on ITS OWN edge, so the keyframes' lines are exactly their projection and the relations below are exact)
const cmpFrames = (a, b) => { if (a.length !== b.length) return Infinity; let d = 0; for (let i = 0; i < a.length; i++) for (const k of ['x1', 'y1', 'x2', 'y2']) d = Math.max(d, Math.abs(a[i][k] - b[i][k])); return d; };
T('equivalence', () => {
  let linOk = 0, linN = 0, radOk = 0, radN = 0, worst = 0, exact = 0, total = 0, bad = '';
  for (const shape of ['square', 'triangle', 'hex']) for (const sym of ['none', 'reflection_only', 'rotation_reflection3']) {
    const seed = 900 + shape.length * 5 + sym.length;
    for (const ang of [0, 45, 90, 135, 180, 225, 270, 315, -30, 725]) {
      const T1 = seamSetup(M, H, shape, sym, seed, ['k00', 'k10']); T1.w.setTimeline(T1.ids); T1.w.setMorph({ enabled: true, mode: 'linear', angleDeg: ang }); setProgress(T1.w, 0.5);
      const S1 = seamSetup(M, H, shape, sym, seed, ['k00', 'k10']); S1.w.setMorph({ enabled: true, mode: 'linear', angleDeg: ang + 180 });   // no timeline: the static blend
      const d = cmpFrames(T1.w.frame(), S1.w.frame()); linN++; if (d <= 1e-9) linOk++; else bad = `${shape}/${sym}/${ang} ${d}`; worst = Math.max(worst, d); if (d === 0) exact++; total++;
    }
    const T2 = seamSetup(M, H, shape, sym, seed, ['k00', 'k10']); T2.w.setTimeline(T2.ids); T2.w.setMorph({ enabled: true, mode: 'radial', angleDeg: 0 }); setProgress(T2.w, 0.5);
    const S2 = seamSetup(M, H, shape, sym, seed, ['k10', 'k00']); S2.w.setMorph({ enabled: true, mode: 'radial', angleDeg: 0 });   // radial: the static morph with the two keyframes SWAPPED
    const d = cmpFrames(T2.w.frame(), S2.w.frame()); radN++; if (d <= 1e-9) radOk++; else bad = `${shape}/${sym}/radial ${d}`; worst = Math.max(worst, d); if (d === 0) exact++; total++;
  }
  check(`linear, p = 0.5, angle a == the STATIC morph (stage c, no timeline) at angle a + 180 with the same keyframes: ${linOk}/${linN} frames equal to 1e-9 px (10 angles incl. -30 and 725, 3 shapes, 3 symmetry families)`, linOk === linN, bad);
  check(`radial, p = 0.5 == the static radial morph with the two keyframes SWAPPED (the static weight of the later keyframe is smooth(u), the front's is smooth(1 - u), and 1 - smooth(u) = smooth(1 - u)): ${radOk}/${radN} frames equal to 1e-9 px`, radOk === radN, bad);
  check(`how exact: worst difference ${worst.toExponential(1)} px, ${exact} of ${total} frames bit for bit (the others differ in the last digit: the static weight of a reversed scalar is not the double 1 - u, and 1 - smooth(u) is not smooth(1 - u) to the last bit)`, worst <= 1e-9);
});

let endpointCases = 0, projectedCases = 0;
T('endpoints', () => {
  for (const shape of ['square', 'triangle', 'hex']) for (const sym of ['none', 'rotation_reflection3']) for (const mode of ['linear', 'radial']) {
    const S = seamSetup(M, H, shape, sym, 1100 + shape.length * 7 + sym.length, ['k00', 'k10', 'k01']);
    const w = S.w; w.setTimeline(S.ids);
    const nodesOf = (k) => { const nd = [], cn = []; S.built.corners[k].forEach((l, i) => { nd.push({ id: 2 * i + 1, x: l.x1, y: l.y1 }, { id: 2 * i + 2, x: l.x2, y: l.y2 }); cn.push([2 * i + 1, 2 * i + 2]); }); return [nd, cn]; };
    // the normal frame of each keyframe: the base sheet holds the pattern, switch off
    w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 });
    const normalFrames = ['k00', 'k10', 'k01'].map((k) => { const [nd, cn] = nodesOf(k); w.set(`nodes = ${J(nd)}; connections = ${J(cn)};`); return w.frame(); });
    const normal = normalFrames.map(hashOf);
    const projHash = (seg, which) => { const pk = projectedKeyframe(w, seg, which); linesToBase(w, pk.lines); return { h: hashOf(w.frame()), n: pk.projected }; };
    const pr0 = projHash(0, 0), prB = projHash(1, 0), prEnd = projHash(1, 1);
    projectedCases += (pr0.n + prB.n + prEnd.n > 0) ? 1 : 0; endpointCases++;
    w.setMorph({ enabled: true, mode, angleDeg: 45 });
    setElapsed(w, 0); const f0 = w.frame(), h0 = hashOf(f0), s0 = w.status();
    setElapsed(w, 4000); const fEnd = w.frame(), hEnd = hashOf(fEnd), sEnd = w.status();
    setElapsed(w, 2000); const fB = w.frame(), hB = hashOf(fB), sB = w.status();
    setElapsed(w, 2000 - 1e-9); const hBm = hashOf(w.frame()), sBm = w.status();
    setElapsed(w, 1000); const hMid = hashOf(w.frame());
    check(`${shape}/${sym}/${mode}, 3 keyframes: progress 0 is keyframe 0, the start of segment 1 (elapsed 2000) keyframe 1, the end of the last segment (elapsed 4000) keyframe 2, each with its boundary endpoints that change their edge projected onto it (${pr0.n} / ${prB.n} / ${prEnd.n} endpoints; where none is, the normal frame itself to 1e-9 px: the projection of a point that lies on the edge up to rounding changes its last digits), the middle of segment 0 something else (chords of every drawn segment)`, h0 === pr0.h && hB === prB.h && hEnd === prEnd.h && (pr0.n > 0 || cmpFrames(f0, normalFrames[0]) <= 1e-9) && (prB.n > 0 || cmpFrames(fB, normalFrames[1]) <= 1e-9) && (prEnd.n > 0 || cmpFrames(fEnd, normalFrames[2]) <= 1e-9) && hMid !== pr0.h && hMid !== prB.h, J([pr0.n, prB.n, prEnd.n]));
    check(`${shape}/${sym}/${mode}: the frame 1e-9 ms before the end of segment 0 equals the start of segment 1 (no jump at the boundary); the status says segment ${sB.segment} at progress ${sB.progress} at the boundary, segment ${sBm.segment} just before it, segment ${sEnd.segment} at progress ${sEnd.progress} at the very end`, hBm === hB && s0.segment === 0 && s0.progress === 0 && sEnd.segment === 1 && sEnd.progress === 1 && sB.segment === 1 && sB.progress === 0 && sBm.segment === 0, J([s0, sBm, sB, sEnd]));
  }
  // endpoints that change the edge they sit on, or lie off it (stage d2c, the prototype's rule with exact ends off): the first and the last frame of a segment are those keyframes with the endpoints PROJECTED onto the
  // edge they share, NOT the normal frames (stage d showed the normal frames; that proof holds for aligned keyframes only): the decision is in the ROADMAP, "Spatial morph: staged plan", stage d2c.
  for (const shape of ['square', 'hex']) {
    const kfs = [CONNS[shape], ALT[shape], ALT2[shape]];
    const w = world(shape, 'rotation_reflection3', kfs);
    const n = kfs.map((c) => normalHash(shape, 'rotation_reflection3', c));
    w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 });
    const projHash = (seg, which) => { const pk = projectedKeyframe(w, seg, which); linesToBase(w, pk.lines); return { h: hashOf(w.drawn()), n: pk.projected }; };
    const q0 = projHash(0, 0), q1 = projHash(0, 1), q2 = projHash(1, 0), q3 = projHash(1, 1);
    w.setMorph({ enabled: true, mode: 'linear', angleDeg: 20 });
    setElapsed(w, 0); const a0 = hashOf(w.drawn()); setElapsed(w, 6000); const a1 = hashOf(w.drawn()); setElapsed(w, 2000); const a2 = hashOf(w.drawn());
    check(`${shape}: with keyframes whose lines end on DIFFERENT edges in different keyframes (boundary endpoints that cannot slide on one edge: ${q0.n} / ${q3.n} / ${q2.n} endpoints are projected at keyframe 0, 2 and, at the segment boundary, 1) progress 0 and the end are those keyframes with the endpoints projected onto the edge (stage d2c); where an endpoint is projected they are NOT the normal frames (the prototype's blend never reaches them either)`, q0.n + q3.n + q2.n > 0 && a0 === q0.h && a1 === q3.h && a2 === q2.h && (q0.n === 0 || a0 !== n[0]) && (q3.n === 0 || a1 !== n[2]) && (q2.n === 0 || a2 !== n[1]), J([q0.n, q3.n, q2.n]));
  }
  sec(`      ${projectedCases} of ${endpointCases} sampled keyframe sets have endpoints that change their edge: there the frames at p = 0 and at the end show them projected (stage d2c)`);
});

T('segments-own', () => {
  // each segment uses its OWN pairing, flips and members: the frame inside segment i equals the frame of a two-keyframe timeline [K_i, K_i+1] with that segment's own settings at the same local progress
  for (const shape of ['square', 'hex']) {
    const kfs = [CONNS[shape], ALT[shape], ALT2[shape]];
    const extra = { segmentPairings: [null, [1, 0, 2]], segmentFlips: [[true, false, false], [false, true, false]] };
    const w = world(shape, 'rotation_reflection3', kfs, extra);
    const plain = world(shape, 'rotation_reflection3', kfs);
    w.setMorph({ enabled: true, mode: 'linear', angleDeg: 30 }); plain.setMorph({ enabled: true, mode: 'linear', angleDeg: 30 });
    let eqOwn = true, differs = true;
    for (const seg of [0, 1]) for (const lt of [0.25, 0.5, 0.8]) {
      setElapsed(w, seg * 2000 + lt * 2000); setElapsed(plain, seg * 2000 + lt * 2000);
      const two = world(shape, 'rotation_reflection3', [kfs[seg], kfs[seg + 1]], { segmentPairings: [extra.segmentPairings[seg]], segmentFlips: [extra.segmentFlips[seg]] });
      two.setMorph({ enabled: true, mode: 'linear', angleDeg: 30 }); setElapsed(two, lt * 2000);
      const a = hashOf(w.frame()), b = hashOf(two.frame()), c = hashOf(plain.frame());
      if (a !== b) eqOwn = false;
      if (a === c) differs = false;
    }
    check(`${shape}: with a flip in segment 0 and a pairing plus a flip in segment 1 the frame at 3 local progress values in each segment equals the two-keyframe timeline of that segment alone (own pairing, flips, aligned to ITS keyframe, not to keyframe 0), and differs from the same timeline without them`, eqOwn && differs);
  }
});

T('span-status', () => {
  const w = world('square', 'none', [CONNS.square, ALT.square]);
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  const seen = new Set();
  for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) { setProgress(w, p); seen.add(hashOf(w.frame())); }
  const c = w.get('spatialMorphRenderState.spanComputes');
  check('the span does not depend on the progress: 7 progress values give 7 different frames and ONE span computation; a new angle computes it again', seen.size === 7 && c === 1 && (w.setMorph({ enabled: true, mode: 'linear', angleDeg: 90 }), w.frame(), w.get('spatialMorphRenderState.spanComputes') === 2), `${seen.size} frames, ${c} computations`);
  // bilinear ignores the progress
  const wb = world('square', 'none', [CONNS.square, ALT.square, ALT2.square, ALT.square]);
  wb.setMorph({ enabled: true, mode: 'bilinear', angleDeg: 0 });
  const hs = new Set(); for (const p of [0, 0.3, 0.7, 1]) { setProgress(wb, p); hs.add(hashOf(wb.frame())); }
  check("bilinear stays static: four progress values, one frame; status 'bilinearStatic' with progress and segment null (stage e1: seamOpen [2], the keyframe ALT2 is open at the tile edge)", hs.size === 1 && same(wb.status(), { code: 'bilinearStatic', keyframes: 4, mode: 'bilinear', progress: null, segment: null, seamOpen: [2] }), J(wb.status()));
  // status of a followed frame
  w.setMorph({ enabled: true, mode: 'radial', angleDeg: 0 }); setProgress(w, 0.25); w.drawn();
  check("a followed frame: status 'ok' with the timeline's keyframe count, the mode, the local progress and the segment", same(w.status(), { code: 'ok', keyframes: 2, mode: 'radial', progress: 0.25, segment: 0, seamOpen: [] }), J(w.status()));
  const w3 = world('square', 'none', [CONNS.square, ALT.square, ALT2.square]); w3.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); setElapsed(w3, 3000); w3.drawn();
  check('with 3 keyframes at elapsed 3000 ms: segment 1 at local progress 0.5, keyframes 3', same(w3.status(), { code: 'ok', keyframes: 3, mode: 'linear', progress: 0.5, segment: 1, seamOpen: [2] }), J(w3.status()));
  // no timeline: static, fields null
  const ws = makeRenderWorld('square', 3, 3, 'none'); ws.baseConnections(CONNS.square); ws.addKeyframeLayer(CONNS.square); ws.addKeyframeLayer(ALT.square); ws.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); ws.drawn();
  check('without a timeline linear and radial draw the static blend of stage c: status ok, progress and segment null', same(ws.status(), { code: 'ok', keyframes: 2, mode: 'linear', progress: null, segment: null, seamOpen: [] }), J(ws.status()));
  // net
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); setProgress(w, 0.5);
  w.set(`baseNetTransform = ${J({ x: { kind: 'trig', w: 0.3 }, y: 'same', repeat: false, domain: 'field' })};`); w.drawn();
  check("a net warp in force: 'netActive' wins over 'ok' and keeps the progress and the segment", w.status().code === 'netActive' && w.status().progress === 0.5 && w.status().segment === 0, J(w.status()));
  w.set('baseNetTransform = null;');
  // preconditions inside a segment
  const bad = (what, w2, code, seg) => { w2.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); setElapsed(w2, 3000); const h = hashOf(w2.drawn()); const st = w2.status(); w2.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 }); const off = hashOf(w2.drawn()); check(`${what}: status ${code} at segment ${seg} with progress ${st.progress}, the normal frame is drawn`, st.code === code && st.segment === seg && typeof st.progress === 'number' && h === off, J(st)); };
  let wm = world('square', 'none', [CONNS.square, ALT.square, ALT2.square]); wm.set('additionalLayers[2].connections.pop();'); bad('keyframe 2 has one line less (segment 1 is the active one)', wm, 'lineCountMismatch', 1);
  wm = world('square', 'none', [CONNS.square, ALT.square, ALT2.square]); wm.set("additionalLayers[2].shape = 'hex';"); bad('keyframe 2 has another shape', wm, 'shapeMismatch', 1);
  wm = world('square', 'none', [CONNS.square, ALT.square, ALT2.square]); wm.set('additionalLayers[2].connections = [[1, 5], [2, 8], [3, 999]];'); bad('a line of keyframe 2 names a node that is gone', wm, 'alignmentFailed', 1);
  wm = world('square', 'none', [CONNS.square, ALT.square, ALT2.square]); wm.set('timeline.keyframeLayerIds[2] = 77;'); bad('the timeline names a layer that does not exist', wm, 'alignmentFailed', 1);
  // the other segment of the same timeline still draws
  wm = world('square', 'none', [CONNS.square, ALT.square, ALT2.square]); wm.set('additionalLayers[2].connections.pop();'); wm.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); setElapsed(wm, 1000); wm.drawn();
  check('the broken keyframe only stops its own segment: at elapsed 1000 (segment 0) the morph is drawn', wm.status().code === 'ok' && wm.status().segment === 0, J(wm.status()));
  const w1 = makeRenderWorld('square', 3, 3, 'none'); w1.baseConnections(CONNS.square); w1.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); w1.drawn();
  check('no keyframe at all: needsTwoKeyframes with progress and segment null', same(w1.status(), { code: 'needsTwoKeyframes', keyframes: 0, mode: 'linear', progress: null, segment: null, seamOpen: null }), J(w1.status()));
  // an exception inside the follower never escapes
  const wr = world('square', 'none', [CONNS.square, ALT.square]); wr.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); setProgress(wr, 0.5);
  wr.set('const __r = resolveTimelineKeyframeCoords; let __k = 0; resolveTimelineKeyframeCoords = function () { if (__k++ === 0) throw new Error("boom"); return __r.apply(this, arguments); };');
  let threw = null; try { wr.drawn(); } catch (e) { threw = e; }
  check("an exception while following the timeline never escapes: the normal frame is drawn, status 'renderError'", threw === null && wr.status().code === 'renderError', (threw && threw.message) + ' ' + J(wr.status()));
  // the real resolveTimelineSegment missing: the mirror gives the same frames
  const wa = world('square', 'none', [CONNS.square, ALT.square, ALT2.square]); wa.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); setElapsed(wa, 3000); const withReal = hashOf(wa.frame());
  wa.set('resolveTimelineSegment = undefined;'); const withMirror = hashOf(wa.frame());
  check('the render uses the real resolveTimelineSegment() when the page has it and the pure mirror when it does not: the same frame', withReal === withMirror && wa.status().segment === 1);
  // the switch off is still the normal frame whatever the timeline does
  wa.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 });
  check('with the switch OFF nothing of this stage is read: the status is off with progress and segment null', (wa.drawn(), same(wa.status(), { code: 'off', keyframes: 0, mode: 'linear', progress: null, segment: null, seamOpen: null })), J(wa.status()));
});

// ---- 4. the seams at 7 progress values -------------------------------------------------------------------------------------------------------------------------------------------------------
sec('\n== 4. seams of the real drawn segments at progress 0 / 0.1 / 0.25 / 0.5 / 0.75 / 0.9 / 1 ==');
const MODES = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => ['linear', a]).concat([['radial', 0]]);
const PS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
const SEAM = [];
T('seams', () => {
  if (process.env.TIME_SKIP_SEAMS) { check('(seams skipped: TIME_SKIP_SEAMS is set, for sabotage runs only)', true); return; }
  for (const shape of ['square', 'triangle', 'hex']) for (const sym of ['none', 'reflection_only', 'rotation_reflection3']) {
    const S = seamSetup(M, H, shape, sym, 700 + shape.length * 3 + sym.length, ['k00', 'k10']);
    const w = S.w;
    w.setTimeline(S.ids);
    w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); setElapsed(w, 0);
    const base = w.frame();
    S.buildMatch(base);
    let worst = 0, minMoved = Infinity, maxMoved = 0, frames = 0, atZero = 0, atOne = 0;
    for (const [mode, angleDeg] of MODES) for (const p of PS) {
      w.setMorph({ enabled: true, mode, angleDeg }); setProgress(w, p);
      const f = w.frame(); frames++;
      const r = S.drift(f);
      worst = Math.max(worst, r.drift);
      if (p === 0) atZero = Math.max(atZero, r.moved);
      if (p === 0.5) { minMoved = Math.min(minMoved, r.moved); maxMoved = Math.max(maxMoved, r.moved); }
    }
    SEAM.push({ shape, sym, worst });
    check(`${shape} / ${sym}: ${frames} frames (8 linear angles + radial x 7 progress values), ${S.tiles.length} tiles, ${S.pairs.length} tile pairs, ${S.match.length} seam points, ${S.unmatched} unmatched; worst drift ${worst.toExponential(1)} px (limit 1e-9); at p = 0.5 the seam points are moved by ${minMoved.toFixed(0)} to ${maxMoved.toFixed(0)} px from keyframe 0, at p = 0 by ${atZero.toExponential(0)}`, S.match.length > 0 && S.unmatched === 0 && worst <= 1e-9 && minMoved > 1 && atZero < 1e-9, '');
  }
  if (!PRINT) console.log('      worst drift per shape / symmetry (px): ' + SEAM.map((s) => `${s.shape}/${s.sym} ${s.worst.toExponential(1)}`).join('  '));
});

// ---- 5. golden hashes of the ON path ---------------------------------------------------------------------------------------------------------------------------------------------------------
// History of these 30 hashes. Stage d pinned them with the prototype's boundary rule and EXACT ends (at weights that are one corner the endpoint is that keyframe's own position). Stage d2b (the rule
// "commonEdge") re-pinned 16 of them; stage d2c reverted the rule: with it and exact ends still on all 30 are the stage d values again (checked when d2c was made). Stage d2c then switched the exact ends off in
// the front path (core/spatial-morph-render.js: the pops and the loose ends at intermediate p, see the ROADMAP): 12 of the 30 changed once more, the 12 listed in STAGE_D_CHANGED_BY_D2C with their stage d values,
// the other 18 are unchanged since stage d. A changed hash is a frame of a pattern whose active segment has an endpoint that changes its edge or lies off it (it is projected now where it was the keyframe's own position).
const GOLDEN = {
  "square/none/linear45@500": 'b7a321c24a07ef27',
  "square/none/linear45@1500": '0c34f38690dc261b',
  "square/none/linear45@2500": '8eec3963a5ca97ca',
  "square/none/linear45@3500": '3607cb4cf5fece18',
  "square/none/linear45@5000": '58a6c59426917fec',
  "square/rotation_reflection3/linear90@500": '8dd5fbfe1ec86618',
  "square/rotation_reflection3/linear90@1500": '746aa56215a92bf6',
  "square/rotation_reflection3/linear90@2500": '19f07b552255d3ee',
  "square/rotation_reflection3/linear90@3500": '47998c6d6cf85bc2',
  "square/rotation_reflection3/linear90@5000": '103e44a4dd21654d',
  "triangle/reflection_only/linear0@500": 'cc0c68da185c7dda',
  "triangle/reflection_only/linear0@1500": '9b96bec7514a850a',
  "triangle/reflection_only/linear0@2500": '2c67e5b009ef9ddd',
  "triangle/reflection_only/linear0@3500": '227360b59ab5987e',
  "triangle/reflection_only/linear0@5000": 'c1e4cd39e95a21d3',
  "triangle/none/radial0@500": 'c723c8398dfd5109',
  "triangle/none/radial0@1500": '739e516b630e8e19',
  "triangle/none/radial0@2500": '68ccff870c94f18b',
  "triangle/none/radial0@3500": '612213724a7ef4c8',
  "triangle/none/radial0@5000": 'f9adc58930acb2e9',
  "hex/rotation_reflection3/radial0@500": '15b3fc7807b3ccc4',
  "hex/rotation_reflection3/radial0@1500": '6280d6de883bed0f',
  "hex/rotation_reflection3/radial0@2500": '97a17a252ef4178e',
  "hex/rotation_reflection3/radial0@3500": 'e26741fd54edcf13',
  "hex/rotation_reflection3/radial0@5000": '73bc46b99febaa1d',
  "hex/none/linear315@500": '955b6315742063f0',
  "hex/none/linear315@1500": '7d56232e53b11602',
  "hex/none/linear315@2500": 'd66baffcee07f48f',
  "hex/none/linear315@3500": '7b6938b6d80e3bc1',
  "hex/none/linear315@5000": 'a28452c6dbfa4df2',
};
const STAGE_D_CHANGED_BY_D2C = {
  "square/none/linear45@500": '98eca811d2fc60bf',
  "square/none/linear45@1500": '26a01c44c46b31f0',
  "square/none/linear45@3500": 'b1a3441f3d0ae67f',
  "square/none/linear45@5000": '73028a7af5bbe573',
  "square/rotation_reflection3/linear90@500": '10c5775a3604bb05',
  "square/rotation_reflection3/linear90@1500": '3c747e2e4db3fb9f',
  "square/rotation_reflection3/linear90@3500": '6e06b2096a617480',
  "square/rotation_reflection3/linear90@5000": '37d75d79b659223b',
  "hex/rotation_reflection3/radial0@1500": 'a91d6092ae88aef1',
  "hex/rotation_reflection3/radial0@2500": '5fd3b63ba1bc33ad',
  "hex/none/linear315@1500": 'bddc717ad0346587',
  "hex/none/linear315@2500": 'ab6d214757669147',
};
function goldenFrames() {
  const out = {};
  const scen = [['square', 'none', 'linear', 45], ['square', 'rotation_reflection3', 'linear', 90], ['triangle', 'reflection_only', 'linear', 0], ['triangle', 'none', 'radial', 0], ['hex', 'rotation_reflection3', 'radial', 0], ['hex', 'none', 'linear', 315]];
  for (const [shape, sym, mode, ang] of scen) {
    const w = world(shape, sym, [CONNS[shape], ALT[shape], ALT2[shape]]);
    w.setMorph({ enabled: true, mode, angleDeg: ang });
    for (const el of [500, 1500, 2500, 3500, 5000]) { setElapsed(w, el); out[`${shape}/${sym}/${mode}${ang}@${el}`] = hashOf(w.frame()); }
  }
  return out;
}
if (PRINT) { console.log(JSON.stringify(goldenFrames(), null, 1)); process.exit(0); }
T('golden', () => {
  const now = goldenFrames();
  const bad = Object.keys(GOLDEN).filter((k) => GOLDEN[k] !== now[k]);
  check(`12 of the 30 hashes differ from their stage d values (the exact ends are off since stage d2c: an endpoint that changes its edge is projected), 18 are the stage d values`, Object.keys(STAGE_D_CHANGED_BY_D2C).length === 12 && Object.keys(STAGE_D_CHANGED_BY_D2C).every((k) => k in GOLDEN && GOLDEN[k] !== STAGE_D_CHANGED_BY_D2C[k]));
  check(`${Object.keys(GOLDEN).length} golden frame hashes of the ON path (6 patterns x 5 elapsed values over 2 segments; chords of every drawn segment) are the pinned ones (stage d2c)`, Object.keys(GOLDEN).length === 30 && Object.keys(now).length === 30 && bad.length === 0, bad.slice(0, 3).join(','));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
