/**
 * tools/color/test-crossfade-match.js
 * Task 031: the timeline crossfade colours by FACE CORRESPONDENCE (core/facecolor.js crossfadeFaceColors(), "h2c" of tools/morph/measure-face-match.js) instead of location sampling.
 *
 *   node tools/color/test-crossfade-match.js
 *   MATCH_SABOTAGE=sampled|bbox|onoff|srgb node tools/color/test-crossfade-match.js     (sabotage runs on in-memory copies of core/facecolor.js; nothing is written)
 *
 *  1. Stern/Raute (026, violet and yellow in both keyframes): per-face error in linear light against the true colour at t = 0 .. 1, and the largest per-face jump between neighbouring steps (0.05 and 0.01),
 *     against the location sampling that is kept as crossfadeFaceColorsSampled(); the endpoints are exactly the keyframes.
 *  2. The 7 cases of tasks 029/030 (square, split, hexagon, triangle, gallery square, curated gallery hexagon and triangle), playback path: jump <= sampling + 3 bytes, error with equal colours in A and B < 0.02.
 *  3. Different colours in A and B: exactly the keyframe colours at t = 0 and 1, within 0.1 of the interval the partner colours span in between.
 *  4. Equal colours: exactly that colour (1e-9, linear light) wherever every polygon under a face has it; Stern/Raute with different NEIGHBOUR colours below 0.1.
 *  5. Stateless: forward and backward runs give the same colours; the fields carry the polygon list; faces nothing lies under keep the sampled path (null); the playback path colours; the spatial path's use of the helpers is guarded by typeof (task 034).
 *  6. Cost: the dense hexagon pattern (three frames together) at most three times the sampling.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const SAB = process.env.MATCH_SABOTAGE || '';
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack || e)); process.exit(1); });

// the sabotage copies: the harness reads core/facecolor.js through tools/session/fixtures.js (the working tree); a sabotage run swaps the file text through coreOverrides of makeContext
const FACECOLOR = path.join(ROOT, 'core', 'facecolor.js');
let src = fs.readFileSync(FACECOLOR, 'utf8');
if (SAB === 'sampled') src = src.replace("const lin = _faceLinByCorrespondence(f, infoA, infoB, t) || _sampledFaceLin(polys[i], fieldA, fieldB, t);", "const lin = _sampledFaceLin(polys[i], fieldA, fieldB, t);");
if (SAB === 'bbox') src = src.replace("if (g.lin && p.x >= g.minX && p.x <= g.maxX", "if (g.lin && p.x >= g.minX + 40 && p.x <= g.maxX");
if (SAB === 'onoff') src = src.replace("const wA = (1 - t) * sA.cov, wB = t * sB.cov;", "const wA = (1 - t) * (sA.cov > 0 ? 1 : 0), wB = t * (sB.cov > 0 ? 1 : 0);");
if (SAB === 'srgb') src = src.replace("const pm = [0, 1, 2].map(k => (1 - t) * pA.lin[k] + t * pB.lin[k]);", "const pm = [0, 1, 2].map(k => { const a = linearToSrgb8(pA.lin[k]) / 255, b = linearToSrgb8(pB.lin[k]) / 255, m = (1 - t) * a + t * b; return m <= 0.04045 ? m / 12.92 : Math.pow((m + 0.055) / 1.055, 2.4); });");
let tmp = null;
if (SAB) { tmp = path.join(require('os').tmpdir(), 'facecolor-sab-' + process.pid + '.js'); fs.writeFileSync(tmp, src); }
const M = require('../morph/measure-face-match.js');
M.setNear(1.5);
const F = require('../session/fixtures.js');
if (tmp) { const orig = F.makeContext; F.makeContext = function (opts) { opts = Object.assign({}, opts); opts.coreOverrides = Object.assign({}, opts.coreOverrides, { 'core/facecolor.js': tmp }); return orig.call(this, opts); }; }

const lin2l = M.lin2l, cdist = M.cdist;
const cases = M.buildCases(true);
cases.mix = Object.assign({}, cases.sq, { colourB: M.mkStarDiamond(4, 18) });

// one frame of the playback path: the live faces, the new colours (playbackCrossfadeColors), the sampled colours (crossfadeFaceColorsSampled) and the keyframe fields, in linear light
function getFrame(rig, t, reps) {
  const code = `(function(){
    timeline.elapsedMs = ${t * 2000}; applyTimelineFrame();
    var pb = additionalLayers[${rig.pbId}], sh = faceSheetOverrideOfLayer(pb), cf = timeline.currentFrame;
    var res = computeCellFaces(pb._morphConnections || pb.connections, pb._morphNodes || pb.nodes, null, null, sh);
    var by = new Map(res.nodes.map(function (n) { return [n.id, n]; }));
    var fA = keyframeFieldFor(${rig.idA}), fB = keyframeFieldFor(${rig.idB});
    var nw = playbackCrossfadeColors(res), od = crossfadeFaceColorsSampled(res, fA, fB, cf.localT);
    var msNew = 0, msOld = 0, R = ${reps || 0};
    if (R) { var t0 = process_hrtime(); for (var i = 0; i < R; i++) playbackCrossfadeColors(res); msNew = (process_hrtime() - t0) / R; t0 = process_hrtime(); for (var j = 0; j < R; j++) crossfadeFaceColorsSampled(res, fA, fB, cf.localT); msOld = (process_hrtime() - t0) / R; }
    return { msNew: msNew, msOld: msOld, hasCtr: !!fA.ctr && fA.span > 0, faces: res.faces.map(function (f, i) {
      return { verts: f.nodeIds.map(function (id) { return by.get(id); }).filter(Boolean).map(function (n) { return { x: n.x, y: n.y }; }), nw: cssColorToLinear(nw && nw[i] ? nw[i] : f.color), od: cssColorToLinear(od && od[i] ? od[i] : f.color) }; }) };
  })()`;
  rig.w.sb.process_hrtime = () => Number(process.hrtime.bigint()) / 1e6;
  const r = rig.w.run(code);
  const morph = M.annotate(r.faces.map(f => ({ verts: f.verts })), rig.geo.ctr, rig.geo.span, rig.geo.ops);
  morph.forEach((f, i) => { f.nw = r.faces[i].nw; f.od = r.faces[i].od; });
  return { morph, msNew: r.msNew, msOld: r.msOld, hasCtr: r.hasCtr };
}
function jumps(rig, step) {
  const ts = []; for (let k = 0; k * step <= 1 + 1e-9; k++) ts.push(+(k * step).toFixed(4));
  const fr = ts.map(t => getFrame(rig, t)); let jn = 0, jo = 0, n = 0;
  for (let k = 1; k < fr.length; k++) fr[k].morph.forEach(f => { const b = M.predOf(fr[k - 1].morph, f); if (b === null) return; n++; jn = Math.max(jn, cdist(f.nw, fr[k - 1].morph[b].nw)); jo = Math.max(jo, cdist(f.od, fr[k - 1].morph[b].od)); });
  return { jn, jo, n, fr, ts };
}

console.log('== 1. Stern / Raute (task 026), real playback pipeline ==');
{
  const rig = M.setup(cases.sq), K = rig.kf.playback;
  const star = K.A.find(f => M.role(f, rig.geo) === 'star').color, dia = K.A.find(f => M.role(f, rig.geo) === 'diamond').color;
  let mn = 0, mo = 0, ends = 0;
  [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].forEach(t => getFrame(rig, t).morph.forEach(f => { const r = M.role(f, rig.geo); if (!r) return; const soll = r === 'star' ? star : dia; mn = Math.max(mn, lin2l(f.nw, soll)); mo = Math.max(mo, lin2l(f.od, soll)); if (t === 0 || t === 1) ends = Math.max(ends, lin2l(f.nw, soll)); }));
  console.log(`  info: largest per-face error of the star and the corner diamonds: sampling ${mo.toFixed(4)}, correspondence ${mn.toFixed(4)}; endpoints ${ends.toExponential(1)}`);
  check('Stern/Raute: the error against the true (equal) colour is far below the sampling (< 0.12 and < half of it)', mn < 0.12 && mn < 0.5 * mo, `${mn.toFixed(4)} against ${mo.toFixed(4)}`);
  check('Stern/Raute: at t = 0 and t = 1 the star and the diamonds have exactly their keyframe colour (hex quantization aside)', ends < 2e-3, ends.toExponential(2));
  [0.05, 0.01].forEach(step => { const j = jumps(rig, step); console.log(`  info: step ${step}: largest per-face jump ${j.jn} (sampling ${j.jo}) over ${j.n} face steps`); check(`Stern/Raute step ${step}: largest per-face jump <= sampling + 3 bytes`, j.jn <= j.jo + 3, `${j.jn} against ${j.jo}`); });
}

console.log('\n== 2. the 7 cases of tasks 029/030 (playback): jump and equal-colour error ==');
let hexRig = null;
['sq', 'topoSq', 'hex', 'tri', 'gal', 'hexK', 'triK'].forEach(k => {
  const rig = M.setup(cases[k]); if (k === 'hex') hexRig = rig;
  const j = jumps(rig, 0.05);
  const uni = M.setup(M.withUniform(cases[k])); let dmax = 0, dn = 0;
  j.ts.forEach(t => { const e = getFrame(uni, t); e.morph.forEach(f => { const soll = M.sollUniform(f, uni.kf.playback.A, uni.kf.playback.B); if (!soll) return; dn++; dmax = Math.max(dmax, lin2l(f.nw, soll)); }); });
  check(`${k}: largest per-face jump ${j.jn} <= sampling ${j.jo} + 3; equal colours in A and B: error ${dmax.toFixed(4)} < 0.02 (${dn} faces)`, j.jn <= j.jo + 3 && dmax < 0.02 && dn > 0);
});

console.log('\n== 3. different colours in A and B ==');
{
  const rig = M.setup(cases.mix), K = rig.kf.playback, pick = (kf, r) => kf.find(f => M.role(f, rig.geo) === r).color;
  let exc = 0, endBad = 0, n = 0, inside = 0;
  [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].forEach(t => getFrame(rig, t).morph.forEach(f => {
    const r = M.role(f, rig.geo); if (!r) return; n++;
    const a = pick(K.A, r), b = pick(K.B, r); let e = 0;
    for (let c = 0; c < 3; c++) e = Math.max(e, Math.min(a[c], b[c]) - f.nw[c], f.nw[c] - Math.max(a[c], b[c]));
    exc = Math.max(exc, e); if (e <= 2e-3) inside++;
    if (t === 0 && lin2l(f.nw, a) > 2e-3) endBad++; if (t === 1 && lin2l(f.nw, b) > 2e-3) endBad++;
  }));
  console.log(`  info: ${inside} of ${n} star / diamond face samples lie between the two partner colours (per channel); the largest excursion beyond the interval is ${exc.toFixed(4)} (neighbouring keyframe polygons leak in where a face overlaps them)`);
  check('star and diamonds: at t = 0 and t = 1 exactly the keyframes\' colours; in between within 0.1 of the interval the two partner colours span (not strictly inside it)', endBad === 0 && n > 0 && exc < 0.1, `${n} face samples, ${endBad} endpoint misses, excursion ${exc.toFixed(4)}`);
}

console.log('\n== 4. equal colours ==');
// function level: the colour (linear light) of every face of the uniform rig (every trail the same colour in A and B): exactly that colour where every polygon under the face has it
function funcLevel(rig, ts) {
  let worst = 0, n = 0;
  ts.forEach(t => {
    const lins = rig.w.run(`(function(){
      timeline.elapsedMs = ${t * 2000}; applyTimelineFrame();
      var pb = additionalLayers[${rig.pbId}], sh = faceSheetOverrideOfLayer(pb);
      var res = computeCellFaces(pb._morphConnections || pb.connections, pb._morphNodes || pb.nodes, null, null, sh);
      var by = new Map(res.nodes.map(function (n) { return [n.id, n]; }));
      var iA = _fieldInfo(keyframeFieldFor(${rig.idA})), iB = _fieldInfo(keyframeFieldFor(${rig.idB}));
      var polys = res.faces.map(function (f) { return f.nodeIds.map(function (id) { return by.get(id); }).filter(Boolean).map(function (n) { return { x: n.x, y: n.y }; }); });
      var live = polys.map(function (p) { return p.length < 3 ? null : _faceInfo(p, null); });
      _setOrbits(live.filter(Boolean), iA.ctr, iA.span);
      return live.map(function (f) { return f ? { v: f.poly, lin: _faceLinByCorrespondence(f, iA, iB, ${t}) } : null; });
    })()`);
    const items = lins.filter(Boolean), ann = M.annotate(items.map(x => ({ verts: x.v })), rig.geo.ctr, rig.geo.span, rig.geo.ops);
    items.forEach((x, i) => { const soll = M.sollUniform(ann[i], rig.kf.playback.A, rig.kf.playback.B); if (!soll || !x.lin) return; n++; worst = Math.max(worst, lin2l(x.lin, soll)); });
  });
  return { worst, n };
}
{
  const TS = [0, 0.05, 0.25, 0.5, 0.75, 0.95, 1];
  ['sq', 'tri', 'hexK'].forEach(k => { const r = funcLevel(M.setup(M.withUniform(cases[k])), TS); check(`${k}: every face with one colour in A and in B under it has exactly that colour (<= 1e-9 in linear light, all t)`, r.n > 0 && r.worst <= 1e-9, `${r.n} faces, worst ${r.worst.toExponential(2)}`); });
  const rig = M.setup(cases.sq), K = rig.kf.playback;
  const star = K.A.find(f => M.role(f, rig.geo) === 'star').color, dia = K.A.find(f => M.role(f, rig.geo) === 'diamond').color;
  let worst = 0; TS.forEach(t => getFrame(rig, t).morph.forEach(f => { const r = M.role(f, rig.geo); if (r) worst = Math.max(worst, lin2l(f.nw, r === 'star' ? star : dia)); }));
  console.log(`  info: star / diamond with equal colours in A and B but different NEIGHBOUR colours: largest deviation ${worst.toFixed(4)} (not 1e-9: the weight g of the partner mix is below 1 while the face overlaps neighbours)`);
  check('Stern/Raute with equal colours: the deviation stays below 0.1 (it is below 0.12 in task 030\'s measurement, 0.08)', worst < 0.1, worst.toFixed(4));
}

console.log('\n== 5. stateless, fields, fallback ==');
{
  const rig = M.setup(cases.tri);
  const ts = [0, 0.15, 0.3, 0.55, 0.8, 1], run = order => { const o = {}; order.forEach(t => { o[t] = JSON.stringify(getFrame(rig, t).morph.map(f => f.nw)); }); return o; };
  const fw = run(ts), bw = run(ts.slice().reverse());
  check('stateless: running t = 0..1 and t = 1..0 gives exactly the same colours per face and t', ts.every(t => fw[t] === bw[t]));
  check('the keyframe fields of the real app carry the sheet\'s centre and width (keyframeFieldFor passes the sheet); existing entries unchanged ({ poly, bounding box, lin })',
    getFrame(rig, 0.5).hasCtr && rig.w.run(`(function(){ var f = keyframeFieldFor(${rig.idA}); return f.length > 0 && f.every(function (e) { return e.poly && Number.isFinite(e.minX) && Array.isArray(e.lin); }); })()`));
  const sample = rig.w.run(`(function(){
    var fld = function (x0, y0, x1, y1, lin) { return { poly: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], minX: x0, maxX: x1, minY: y0, maxY: y1, lin: lin }; };
    var A = [fld(0, 0, 10, 10, [0.2, 0.4, 0.6])], B = [fld(0, 0, 10, 10, [0.6, 0.4, 0.2])];
    var res = { nodes: [{ id: 1, x: 100, y: 100 }, { id: 2, x: 110, y: 100 }, { id: 3, x: 110, y: 110 }, { id: 4, x: 100, y: 110 }, { id: 5, x: 2, y: 2 }, { id: 6, x: 8, y: 2 }, { id: 7, x: 8, y: 8 }, { id: 8, x: 2, y: 8 }],
      faces: [{ nodeIds: [1, 2, 3, 4] }, { nodeIds: [5, 6, 7, 8] }] };
    return { far: crossfadeFaceColors(res, A, B, 0.5)[0], inner: crossfadeFaceColors(res, A, B, 0.5)[1], expect: linearToHex([0.4, 0.4, 0.4]) };
  })()`);
  check('a face that no keyframe polygon lies under keeps the sampled path (null: the face\'s own colour); a hand-built field (no sheet) works and mixes in linear light', sample.far === null && sample.inner === sample.expect, JSON.stringify(sample));
  const core = fs.readFileSync(FACECOLOR, 'utf8'), rend = fs.readFileSync(path.join(ROOT, 'core', 'spatial-morph-render.js'), 'utf8');
  // task 034 gives the spatial path the correspondence on purpose (tools/morph/test-spatial-morph-correspondence.js); this file only guards that the render file reaches it through typeof-guarded helpers
  check('spatial-morph-render.js uses the correspondence only through typeof-guarded helpers, and not crossfadeFaceColors / keyframeColorField', ['_fieldInfo', '_faceInfo', '_setOrbits', '_faceLinByCorrespondence'].every(n => new RegExp('typeof ' + n + " !== 'function'").test(rend)) && !/crossfadeFaceColors|keyframeColorField/.test(rend));
  check('crossfadeFaceColorsSampled() still returns the sampled colours (the fallback and the reference of these tests)', /function crossfadeFaceColorsSampled\(/.test(core));
}

console.log('\n== 6. cost ==');
{
  const reps = 6; let best = null;
  for (let r = 0; r < 4; r++) { let sn = 0, so = 0, nf = 0; [0.25, 0.5, 0.75].forEach(t => { const e = getFrame(hexRig, t, reps); sn += e.msNew; so += e.msOld; nf += e.morph.length; }); const q = sn / Math.max(so, 1e-6); if (!best || q < best.q) best = { q, sn, so, nf }; }
  console.log(`  info: dense hexagon, t = 0.25 / 0.5 / 0.75 (${best.nf} faces in the three frames): correspondence ${best.sn.toFixed(2)} ms, sampling ${best.so.toFixed(2)} ms in sum (ratio ${best.q.toFixed(2)})`);
  check('dense hexagon pattern: the three frames together cost at most three times the sampling', best.q <= 3.0, `${best.q.toFixed(2)}x`);
}
if (tmp) fs.unlinkSync(tmp);
console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
