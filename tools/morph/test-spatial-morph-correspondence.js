/**
 * tools/morph/test-spatial-morph-correspondence.js
 * Task 034: spatialMorphRenderFaceColors() (core/spatial-morph-render.js) colours the faces of the Linear and Radial modes by the face correspondence of core/facecolor.js ("s2_5" of
 * tools/morph/measure-face-match.js --spatial), the raster stays for faces below 5 % of the cell, for Bilinear and for everything the correspondence cannot colour.
 *
 *   node tools/morph/test-spatial-morph-correspondence.js
 *   MORPH_SABOTAGE=raster|threshold|bilinear|srgb node tools/morph/test-spatial-morph-correspondence.js     (sabotage runs on in-memory copies; nothing is written)
 *
 *  1. The 7 cases of tasks 029/030, Spatial, step 0.05, the metric of task 032 (sollPure, faces < 10 px^2 left out): jump <= raster + 3 and error with equal colours < 0.02 in six of them;
 *     the triangle is the accepted violation (jump <= raster + 4, error as the raster's 0.0656); the colours equal the measurement's s2_5 (<= 1 byte).
 *  2. Dragging (step 0.01) in the square case: 69 against 69; Stern/Raute 0.317 -> about 0.107.
 *  3. Bilinear (four corner fields, and two-corner points of the bilinear mode): colours identical to the raster; a call without a mode, hand-built fields without a polygon list: the raster.
 *  4. Stateless; the draw call passes the mode; no new global without the spatialMorph prefix.
 *  5. Cost: the dense hexagon pattern at most 1.5 times the raster.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const SAB = process.env.MORPH_SABOTAGE || '';
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('uncaughtException', (e) => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack || e)); process.exit(1); });
const os = require('os');
const tmpFiles = [];
const tmpCopy = (name, text) => { const p = path.join(os.tmpdir(), name + '-' + process.pid + '.js'); fs.writeFileSync(p, text); tmpFiles.push(p); return p; };

// the sabotage copies (in memory -> temp files): the harness reads core/spatial-morph-render.js through SPATIAL_MORPH_RENDER_JS; core/facecolor.js through the fixtures' coreOverrides
const RENDER = fs.readFileSync(path.join(ROOT, 'core', 'spatial-morph-render.js'), 'utf8');
let render = RENDER, facecolor = null;
if (SAB === 'raster') render = render.replace("lins = live.map((f) => (f && f.a >= corr.minArea ? _faceLinByCorrespondence(f, corr.infoA, corr.infoB, corr.t) : null));", "lins = live.map(() => null);");
if (SAB === 'threshold') render = render.replace("f && f.a >= corr.minArea ?", "f ?");
if (SAB === 'bilinear') render = render.replace("if (mode !== 'linear' && mode !== 'radial') return null;", "if (mode !== 'linear' && mode !== 'radial' && mode !== 'bilinear') return null;");
if (SAB === 'srgb') { facecolor = fs.readFileSync(path.join(ROOT, 'core', 'facecolor.js'), 'utf8').replace("const pm = [0, 1, 2].map(k => (1 - t) * pA.lin[k] + t * pB.lin[k]);", "const pm = [0, 1, 2].map(k => { const a = linearToSrgb8(pA.lin[k]) / 255, b = linearToSrgb8(pB.lin[k]) / 255, m = (1 - t) * a + t * b; return m <= 0.04045 ? m / 12.92 : Math.pow((m + 0.055) / 1.055, 2.4); });"); }
if (SAB && render !== RENDER) process.env.SPATIAL_MORPH_RENDER_JS = tmpCopy('smr', render);
const F = require('../session/fixtures.js');
if (facecolor) { const fcPath = tmpCopy('fc', facecolor); const orig = F.makeContext; F.makeContext = function (opts) { opts = Object.assign({}, opts); opts.coreOverrides = Object.assign({}, opts.coreOverrides, { 'core/facecolor.js': fcPath }); return orig.call(this, opts); }; }
const M = require('./measure-face-match.js');
M.setNear(1.5);
const J = JSON.stringify;
const { lin2l, cdist } = M;
const cases = M.buildCases(true);
const hexOfLin = (lin) => '#' + lin.map((v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)).toString(16).padStart(2, '0')).join('');
const MIN_AREA = 10;

// one frame of the spatial path as the real renderer builds it (one tile, weights (1-t, t)): the faces, the production colours with the given mode, the raster colours (the function of before), the ms of both
function prodFrame(rig, t, mode, reps) {
  rig.w.sb.process_hrtime = () => Number(process.hrtime.bigint()) / 1e6;
  const r = rig.w.run(`(function(){
    var seg = resolveTimelineKeyframeCoords(timeline, 0), ch = spatialMorphChooseCorners([seg.from, seg.to], 'linear');
    var L0 = additionalLayers[${rig.idA}], s = { outerCorners: L0.outerCorners, centroid: L0.centroid, nodes: L0.nodes, shape: L0.shape, symmetryMode: L0.symmetryMode };
    var faceSheet = { shape: s.shape, symmetryMode: s.symmetryMode, centroid: s.centroid, outerCorners: s.outerCorners, gridMatchesBase: true };
    var prepared = spatialMorphPrepareLines(ch, s.outerCorners), wTile = { w00: ${1 - t}, w10: ${t}, w01: 0, w11: 0 };
    var cellLines = prepared.map(function (pl) { return [pl.a, pl.b].map(function (d) { return spatialMorphAnchoredPoint(d, wTile, wTile, false); }); });
    var tf = spatialMorphRenderTileFaces(cellLines, s, faceSheet), cf = spatialMorphRenderCornerFields([${rig.idA}, ${rig.idB}, ${rig.idA}, ${rig.idB}], 2, 'linear');
    var mode = ${J(mode)}, nw = spatialMorphRenderFaceColors(tf, cf, wTile, mode), rs = spatialMorphRenderFaceColorsRaster(tf, cf, wTile), msN = 0, msR = 0, R = ${reps || 0};
    if (R) { var t0 = process_hrtime(); for (var i = 0; i < R; i++) spatialMorphRenderFaceColors(tf, cf, wTile, mode); msN = (process_hrtime() - t0) / R; t0 = process_hrtime(); for (var j = 0; j < R; j++) spatialMorphRenderFaceColorsRaster(tf, cf, wTile); msR = (process_hrtime() - t0) / R; }
    var by = new Map(tf.nodes.map(function (n) { return [n.id, n]; }));
    return { msN: msN, msR: msR, faces: tf.faces.map(function (f, i) { return { verts: f.nodeIds.map(function (id) { return by.get(id); }).filter(Boolean).map(function (n) { return { x: n.x, y: n.y }; }), nw: cssColorToLinear(nw && nw[i] ? nw[i] : f.color), rs: cssColorToLinear(rs && rs[i] ? rs[i] : f.color), nwHex: nw ? nw[i] : null, rsHex: rs ? rs[i] : null }; }) };
  })()`);
  const morph = M.annotate(r.faces.map((f) => ({ verts: f.verts })), rig.geo.ctr, rig.geo.span, rig.geo.ops);
  morph.forEach((f, i) => { f.nw = r.faces[i].nw; f.rs = r.faces[i].rs; f.nwHex = r.faces[i].nwHex; f.rsHex = r.faces[i].rsHex; });
  return { morph, msN: r.msN, msR: r.msR };
}
function jumps(rig, step) {
  const ts = []; for (let k = 0; k * step <= 1 + 1e-9; k++) ts.push(+(k * step).toFixed(4));
  const fr = ts.map((t) => prodFrame(rig, t, 'linear')); let jn = 0, jr = 0;
  for (let k = 1; k < fr.length; k++) fr[k].morph.forEach((f) => { if (f.a < MIN_AREA) return; const b = M.predOf(fr[k - 1].morph, f); if (b === null) return; jn = Math.max(jn, cdist(f.nw, fr[k - 1].morph[b].nw)); jr = Math.max(jr, cdist(f.rs, fr[k - 1].morph[b].rs)); });
  return { jn, jr, fr, ts };
}

console.log('== 1. the 7 cases (Spatial, step 0.05) ==');
let hexRig = null, sqRig = null;
const EXPECT = { tri: { jumpPlus: 4, dLinMax: 0.0656 + 1e-3 } };
['sq', 'topoSq', 'hex', 'tri', 'gal', 'hexK', 'triK'].forEach((k) => {
  const rig = M.setup(cases[k]); if (k === 'hex') hexRig = rig; if (k === 'sq') sqRig = rig;
  const j = jumps(rig, 0.05);
  const uni = M.setup(M.withUniform(cases[k])); let dn = 0, dr = 0, n = 0;
  j.ts.forEach((t) => prodFrame(uni, t, 'linear').morph.forEach((f) => { if (f.a < MIN_AREA) return; const soll = M.sollPure(f, uni.kf.spatial.A, uni.kf.spatial.B); if (!soll) return; n++; dn = Math.max(dn, lin2l(f.nw, soll)); dr = Math.max(dr, lin2l(f.rs, soll)); }));
  const ex = EXPECT[k], ok = ex ? (j.jn <= j.jr + ex.jumpPlus && dn <= ex.dLinMax) : (j.jn <= j.jr + 3 && dn < 0.02);
  check(`${k}: largest per-face jump ${j.jn} against raster ${j.jr}; error with equal colours ${dn.toFixed(4)} (raster ${dr.toFixed(4)}; ${n} faces)${ex ? ' [accepted violation: jump <= raster + 4, error as today]' : ''}`, ok && n > 0);
  // the colours equal the measurement's s2_5
  const mf = M.spatialFrames(rig, j.ts, false); let worst = 0;
  mf.forEach((e, i) => e.morph.forEach((f, q) => { worst = Math.max(worst, cdist(e.col.s2_5[q], j.fr[i].morph[q].nw)); }));
  check(`${k}: the colours are the measurement's s2_5 (largest difference ${worst} byte)`, worst <= 1);
});

console.log('\n== 2. dragging and Stern/Raute ==');
{
  const j = jumps(sqRig, 0.01);
  check('square, step 0.01 (dragging): largest per-face jump 69 against 69 (<= raster + 3)', j.jn <= j.jr + 3 && j.jr >= 60, `${j.jn} against ${j.jr}`);
  const K = sqRig.kf.playback, star = K.A.find((f) => M.role(f, sqRig.geo) === 'star').color, dia = K.A.find((f) => M.role(f, sqRig.geo) === 'diamond').color;
  let mn = 0, mo = 0; [0, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 1].forEach((t) => prodFrame(sqRig, t, 'linear').morph.forEach((f) => { const r = M.role(f, sqRig.geo); if (!r) return; const soll = r === 'star' ? star : dia; mn = Math.max(mn, lin2l(f.nw, soll)); mo = Math.max(mo, lin2l(f.rs, soll)); }));
  console.log(`  info: Stern/Raute largest error: raster ${mo.toFixed(4)}, correspondence ${mn.toFixed(4)}`);
  check('Stern/Raute (Spatial): the error against the true colour drops from about 0.317 to about 0.107 (< 0.12, < half of the raster\'s)', mn < 0.12 && mn < 0.5 * mo && mo > 0.3, `${mn.toFixed(4)} against ${mo.toFixed(4)}`);
}

console.log('\n== 3. Bilinear and the raster paths stay as before ==');
{
  const rig4 = M.setup4(M.cases4().sq4);
  let same = 0, total = 0, anyDiff = false;
  [[0.4, 0], [0.5, 0.5], [0.9, 0.9], [0.25, 0.75]].forEach(([u, v]) => {
    const wt = M.bilinW(u, v);
    const r = rig4.w.run(`(function(){
      var infos = additionalLayers.map(function (l) { return { shape: l.shape, lineCount: spatialMorphRenderLineCount(l.connections), isPlayback: !!l.isTimelinePlayback, symmetryMode: l.symmetryMode, sizeFactor: l.shapeSizeFactor }; });
      var base = { shape: currentShape, lineCount: spatialMorphRenderLineCount(connections), symmetryMode: symmetryMode, sizeFactor: shapeSizeFactor };
      var plan = spatialMorphPlanKeyframes(infos, { mode: 'bilinear', timelineIds: null, base: base }), aligned = spatialMorphRenderAlign(plan, 'bilinear', timeline);
      var s = spatialMorphRenderSource(plan), faceSheet = (plan.ids && plan.ids[0] !== 'base') ? { shape: s.shape, symmetryMode: s.symmetryMode, centroid: s.centroid, outerCorners: s.outerCorners, gridMatchesBase: true } : null;
      var prepared = spatialMorphPrepareLines(aligned.corners, s.outerCorners), wTile = ${J(wt)};
      var cellLines = prepared.map(function (pl) { return [pl.a, pl.b].map(function (d) { return spatialMorphAnchoredPoint(d, wTile, wTile, false); }); });
      var tf = spatialMorphRenderTileFaces(cellLines, s, faceSheet), cf = spatialMorphRenderCornerFields(${J(rig4.cornerIds)}, ${rig4.count}, 'bilinear');
      return { bil: spatialMorphRenderFaceColors(tf, cf, wTile, 'bilinear'), none: spatialMorphRenderFaceColors(tf, cf, wTile), raster: spatialMorphRenderFaceColorsRaster(tf, cf, wTile), n: tf.faces.length };
    })()`);
    total += r.n; if (J(r.bil) === J(r.raster) && J(r.none) === J(r.raster)) same += r.n; else anyDiff = true;
  });
  check('Bilinear (four corner fields and the two-corner points of the mode) and a call without a mode: colours identical to the raster, face by face', !anyDiff && total > 0, `${same} of ${total} faces`);
  const lm = sqRig.w.run(`(function(){
    var poly = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    var mk = function (lin) { var F = [{ poly: poly, minX: 0, maxX: 100, minY: 0, maxY: 100, lin: lin }]; F.ctr = { x: 50, y: 50 }; F.span = 100; return { field: F, cellArea: 10000, raster: null }; };
    var a = [0.8, 0.1, 0.1], b = [0.1, 0.1, 0.9];
    var tf = { nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 100, y: 0 }, { id: 3, x: 100, y: 100 }, { id: 4, x: 0, y: 100 }], faces: [{ nodeIds: [1, 2, 3, 4], color: '#000000' }] };
    var r = spatialMorphRenderFaceColors(tf, [mk(a), mk(b), null, null], { w00: 0.7, w10: 0.3, w01: 0, w11: 0 }, 'linear');
    return { got: r && r[0], want: linearToHex([0, 1, 2].map(function (k) { return 0.7 * a[k] + 0.3 * b[k]; })) };
  })()`);
  check('a face that coincides with its partners in A and B (different colours): exactly the LINEAR-LIGHT mix (1-t) a + t b', lm.got === lm.want, J(lm));
  const hand = sqRig.w.run(`(function(){
    var tf = { nodes: [{ id: 1, x: 1, y: 1 }, { id: 2, x: 9, y: 1 }, { id: 3, x: 9, y: 9 }, { id: 4, x: 1, y: 9 }], faces: [{ nodeIds: [1, 2, 3, 4], color: '#123456' }] };
    var wT = { w00: 0.5, w10: 0.5, w01: 0, w11: 0 };
    return { a: spatialMorphRenderFaceColors(tf, [null, null, null, null], wT, 'linear'), b: spatialMorphRenderFaceColorsRaster(tf, [null, null, null, null], wT) };
  })()`);
  check('fields without a polygon list (or none): the raster path answers (here: null, the caller keeps the face colours)', J(hand.a) === J(hand.b));
}

console.log('\n== 4. stateless, wiring, globals ==');
{
  const ts = [0, 0.15, 0.4, 0.7, 1], run = (order) => { const o = {}; order.forEach((t) => { o[t] = J(prodFrame(sqRig, t, 'linear').morph.map((f) => f.nwHex)); }); return o; };
  const a = run(ts), b = run(ts.slice().reverse());
  check('stateless: t = 0..1 and t = 1..0 give exactly the same colours per face and t', ts.every((t) => a[t] === b[t]));
  check('the draw call passes the normalised mode to the colours', /spatialMorphRenderFaceColors\(tileFaces, cornerFields, wTile, mode\)/.test(RENDER));
  const top = (src) => new Set([...src.matchAll(/^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));
  // the names of the tree before the task (task/033-spatial-vier-ecken)
  const base = require('child_process').execSync('git show task/033-spatial-vier-ecken:core/spatial-morph-render.js', { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
  const added2 = [...top(RENDER)].filter((x) => !top(base).has(x));
  console.log(`  info: new top-level names: ${added2.join(', ')}`);
  check('every new global of core/spatial-morph-render.js has the prefix spatialMorph[A-Z]', added2.length > 0 && added2.every((x) => /^spatialMorph[A-Z]/.test(x)));
}

console.log('\n== 5. cost ==');
{
  let best = null;
  for (let r = 0; r < 4; r++) { let sn = 0, sr = 0, nf = 0; [0.25, 0.5, 0.75].forEach((t) => { const e = prodFrame(hexRig, t, 'linear', 5); sn += e.msN; sr += e.msR; nf += e.morph.length; }); const q = sn / Math.max(sr, 1e-6); if (!best || q < best.q) best = { q, sn, sr, nf }; }
  console.log(`  info: dense hexagon, t = 0.25 / 0.5 / 0.75 (${best.nf} faces): correspondence ${best.sn.toFixed(2)} ms, raster ${best.sr.toFixed(2)} ms in sum (ratio ${best.q.toFixed(2)})`);
  check('dense hexagon pattern: at most 1.5 times the raster time', best.q <= 1.5, `${best.q.toFixed(2)}x`);
}
tmpFiles.forEach((p) => { try { fs.unlinkSync(p); } catch (e) { /* ignore */ } });
console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
