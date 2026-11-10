#!/usr/bin/env node
// Task 027/028 - PROTOTYPE of the face correspondence for the morph colour (a measurement, not a test; nothing under core/ or sketch.js is touched).
//   node tools/morph/measure-face-match.js [--case stern|mix|topo|topo2|all] [--verbose]      (027: the first stage, per t, as before)
//   node tools/morph/measure-face-match.js --stages [--case sq|hex|tri|topoSq|gal|all]       (028: orbit from the symmetry group, soft fallback, edge case, see the end of this file)
// matchFaces() (pure) assigns to every face of the morphed sheet at t its partner face in keyframe A and in keyframe B, or says why not:
//   unique     exactly one candidate passes every criterion (same corner count, same orbit size, centroid inclusion either way, area ratio within 1/RATIO..RATIO),
//              or one clearly dominates (the second nearest centroid is at least DOM times as far)
//   ambiguous  several candidates pass and none dominates
//   split      the unique partner is claimed by more than one morph face of the same orbit class (the keyframe face was split on the way)
//   merged     no same-shape candidate; the face's samples spread over two or more keyframe faces (or one of another corner count)
//   none       nothing of the keyframe lies under the face
// Orbit: without a symmetry table in the pure function an orbit is read off the polygons themselves: faces of one sheet with the same corner count, the same
// area and the same distance of the centroid from the cell centre (1e-3) are one orbit; `orb` = its size. The morph is symmetry-preserving, so the images of one
// orbit move together and the nearest same-class face is the right partner.
// Intended use (later, task 028): face colour = linear-light mix (1-t)*colour(partner A) + t*colour(partner B) when both partners are unique; the location
// sampling of today (crossfadeFaceColors / spatialMorphRenderFaceColors) only as the fallback. Per face, never a mean over faces.
'use strict';
const path = require('path');
const { makeRenderWorld } = require('./render-harness');
const M = require(path.join(__dirname, '..', '..', 'core', 'spatial-morph.js'));
const J = JSON.stringify;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const VERBOSE = process.argv.includes('--verbose');
const RUN_MAIN = require.main === module;   // task 031: the script can be required (tools/color/test-crossfade-match.js) without running a measurement

// ---------------------------------------------------------------------------------------------------------------- the prototype (pure)
const RATIO = 8, DOM = 1.5;
let NEAR_K = 0;   // 028 stage 1b: > 0 = a candidate also passes when the centroid distance is within NEAR_K * sqrt(larger area) (centroid nearness instead of inclusion only)
const area2 = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return a / 2; };
const centroidOf = (pts) => { let x = 0, y = 0, a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], c = p.x * q.y - q.x * p.y; a += c; x += (p.x + q.x) * c; y += (p.y + q.y) * c; } return a ? { x: x / (3 * a), y: y / (3 * a) } : { x: pts[0].x, y: pts[0].y }; };
const inside = (pt, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { if ((pts[i].y > pt.y) !== (pts[j].y > pt.y) && pt.x < (pts[j].x - pts[i].x) * (pt.y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x) c = !c; } return c; };

// faces: [{ verts: [{x,y}], color?: linear rgb }] -> annotated [{ verts, c, a, n, orb, color }]
function annotate(faces, ctr, span, ops) {
  const out = faces.map((f) => ({ verts: f.verts, c: centroidOf(f.verts), a: Math.abs(area2(f.verts)), n: f.verts.length, color: f.color || null, orb: 1 }));
  out.forEach((f) => { f.r = Math.hypot(f.c.x - ctr.x, f.c.y - ctr.y); const xs = f.verts.map((q) => q.x), ys = f.verts.map((q) => q.y); f.bb = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; });
  out.forEach((f) => { f.orb = out.filter((g) => g.n === f.n && Math.abs(g.a - f.a) <= 1e-3 * f.a && Math.abs(g.r - f.r) <= 1e-3 * span).length; });
  // 028 stage 1: the orbit from the symmetry group (the elements core/orbits.js:getGroupElementsCached() gives, as affine maps about the cell centre): the faces the images of the centroid land on
  if (ops) out.forEach((f) => {
    const set = new Set();
    ops.forEach((o) => { const q = { x: o.x0 + o.ax * (f.c.x - ctr.x) + o.bx * (f.c.y - ctr.y), y: o.y0 + o.ay * (f.c.x - ctr.x) + o.by * (f.c.y - ctr.y) };
      out.forEach((g, j) => { if (g.n === f.n && Math.hypot(g.c.x - q.x, g.c.y - q.y) <= 2e-3 * span) set.add(j); }); });
    f.og = set.size || 1; f.ogId = set.size ? Math.min(...set) : -1;
  });
  return out;
}
// 030: BBOX = true prefilters by bounding boxes (the same result, fewer polygon tests; measured in the time table); the samples of a face are computed once
let BBOX = true;
const inBB = (q, bb) => q.x >= bb.x0 && q.x <= bb.x1 && q.y >= bb.y0 && q.y <= bb.y1;
const inside2 = (pt, g) => (!BBOX || (g.bb && inBB(pt, g.bb))) && inside(pt, g.verts);
function overlapShares(f, kf) {   // share of the face's samples that lie in each keyframe face (any corner count)
  f._S = f._S || M.spatialMorphFaceSamples(f.verts); const shares = new Map(); let tot = 0;
  f._S.forEach((q) => { tot += q.w; });
  kf.forEach((g, gi) => {
    if (BBOX && g.bb && f.bb && (g.bb.x1 < f.bb.x0 || g.bb.x0 > f.bb.x1 || g.bb.y1 < f.bb.y0 || g.bb.y0 > f.bb.y1)) return;
    let a = 0; for (const q of f._S) { if (BBOX && g.bb && !inBB(q, g.bb)) continue; if (inside(q, g.verts)) a += q.w; }
    if (a > 0) shares.set(gi, a);
  });
  return { shares, tot };
}
// morph, kf: annotated lists -> [{ idx, status, passed }] parallel to morph
function matchFaces(morph, kf, mode) {
  const ok = mode === 'group' ? 'og' : 'orb';
  const res = morph.map((f) => {
    const passed = [];
    kf.forEach((g, gi) => {
      if (g.n !== f.n || g[ok] !== f[ok]) return;
      const q = f.a / g.a; if (q > RATIO || q < 1 / RATIO) return;
      const dd = Math.hypot(f.c.x - g.c.x, f.c.y - g.c.y);
      if (!inside2(f.c, g) && !inside2(g.c, f) && !(NEAR_K > 0 && dd <= NEAR_K * Math.sqrt(Math.max(f.a, g.a)))) return;
      passed.push({ gi, d: dd });
    });
    passed.sort((p, q) => p.d - q.d);
    if (passed.length === 1 || (passed.length > 1 && passed[1].d >= DOM * passed[0].d)) return { idx: passed[0].gi, status: 'unique', passed: passed.length };
    if (passed.length > 1) return { idx: passed[0].gi, status: 'ambiguous', passed: passed.length };
    const { shares, tot } = overlapShares(f, kf);
    return { idx: null, status: shares.size >= 2 || (shares.size === 1 && tot > 0) ? 'merged' : 'none', passed: 0 };
  });
  // split: one keyframe face claimed by several morph faces of the same orbit class that cannot be images of one orbit (orbit size smaller than the claim count)
  const claims = new Map();
  res.forEach((r, i) => { if (r.status === 'unique') { const k = r.idx; (claims.get(k) || claims.set(k, []).get(k)).push(i); } });
  claims.forEach((list, gi) => { if (list.length > 1) list.forEach((i) => { res[i].status = 'split'; }); });
  return res;
}
const mixLinear = (a, b, t) => [0, 1, 2].map((k) => (1 - t) * a[k] + t * b[k]);
// the colour a face would get: both partners unique -> mix; else the fallback (the colour of today's location sampling), flagged
function colourFor(mA, mB, kfA, kfB, t, fallbackLin) {
  if (mA.status === 'unique' && mB.status === 'unique' && kfA[mA.idx].color && kfB[mB.idx].color) return { lin: mixLinear(kfA[mA.idx].color, kfB[mB.idx].color, t), via: 'partner' };
  return { lin: fallbackLin, via: 'fallback' };
}

// ---------------------------------------------------------------------------------------------------------------- the measurement rig
const STUB = `
  var __stack = []; push = () => { __stack.push(null); }; pop = () => { __stack.pop(); };
  noStroke = () => {}; stroke = () => {}; strokeWeight = () => {}; noFill = () => {}; fill = () => {}; beginShape = () => {}; vertex = () => {}; bezierVertex = () => {}; endShape = () => {};
  var CLOSE = 'close';
`;
const lin2l = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const byte = (lin) => [0, 1, 2].map((k) => Math.round(255 * (lin[k] <= 0.0031308 ? 12.92 * lin[k] : 1.055 * Math.pow(Math.max(lin[k], 0), 1 / 2.4) - 0.055)));
const cdist = (a, b) => { const x = byte(a), y = byte(b); return Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]), Math.abs(x[2] - y[2])); };
const COL = (hue) => ({ hue, w: 0.036, s: 0.11, rule: 'test', params: null });

// colourFn(trail info) -> colour spec or null; info = { key, n, faceCount, i }
function setup(cfg) {
  const w = makeRenderWorld(cfg.shape || 'square', cfg.n, 3, cfg.sym || 'rotation_reflection6');
  w.set(STUB);
  const idA = w.addKeyframeLayer(cfg.connsA, { showFaces: true }), idB = w.addKeyframeLayer(cfg.connsB, { showFaces: true });
  const pbId = w.addKeyframeLayer(cfg.connsA, { isTimelinePlayback: true, enabled: true, showFaces: true });
  [[idA, cfg.colourA], [idB, cfg.colourB]].forEach(([id, fn]) => w.run(`(function(){
    var L = additionalLayers[${id}], sh = faceSheetOverrideOfLayer(L);
    var res = computeCellFaces(L.connections, L.nodes, null, null, sh), grp = sheetGroupElements(L.nodes, sh);
    var keys = computeFaceTrailKeys(res, grp), trails = computeFaceTrails(res, grp);
    L.faceAssignments = new Map();
    var fn = ${fn.toString()};
    var done = {};
    trails.forEach(function (tr, i) {
      var fi = keys.indexOf(tr.key), f0 = res.faces[fi];
      var spec = fn({ key: tr.key, n: f0 ? f0.nodeIds.length : 0, faceCount: tr.faceCount, i: i, done: done });
      if (spec) setFaceAssignment(L.faceAssignments, tr.key, spec);
    });
  })()`));
  w.setTimeline([idA, idB], { playbackLayerIndex: pbId, segmentPairings: [null], segmentFlips: [null], segmentMembers: [null] });
  const status = w.status ? (() => { try { return w.status().code; } catch (e) { return 'n/a'; } })() : 'n/a';
  const geo = w.run(`(function(){ var L = additionalLayers[${idA}], sh = faceSheetOverrideOfLayer(L); var xs = sh.outerCorners.map(function (p) { return p.x; }); return { ctr: sh.centroid, span: Math.max.apply(null, xs) - Math.min.apply(null, xs) }; })()`);
  const ops = w.run(`(function(){ var L = additionalLayers[${idA}], sh = faceSheetOverrideOfLayer(L), c = sh.centroid;
    var ge = getGroupElementsCached(L.nodes, c, sh.shape, sh.symmetryMode, sh.outerCorners);
    return ge.ops.map(function (op) { var p0 = op({ x: c.x, y: c.y }, c), p1 = op({ x: c.x + 100, y: c.y }, c), p2 = op({ x: c.x, y: c.y + 100 }, c); return { x0: p0.x, y0: p0.y, ax: (p1.x - p0.x) / 100, ay: (p1.y - p0.y) / 100, bx: (p2.x - p0.x) / 100, by: (p2.y - p0.y) / 100 }; }); })()`);
  geo.ops = ops;
  const kf = (id) => w.run(`(function(){
    var L = additionalLayers[${id}], sh = faceSheetOverrideOfLayer(L), store = faceAssignmentsFor(${id});
    var res = computeCellFaces(L.connections, L.nodes, store, null, sh), by = new Map(res.nodes.map(function (n) { return [n.id, n]; }));
    return res.faces.map(function (f) { return { verts: f.nodeIds.map(function (i) { return by.get(i); }).filter(Boolean).map(function (n) { return { x: n.x, y: n.y }; }), color: cssColorToLinear(f.color) }; });
  })()`);
  // the spatial path's keyframe faces as spatialMorphRenderCornerField() builds them: the cell closed by the border polygon, on a COPY of the store after the normal frame's own call
  const kfBorder = (id) => w.run(`(function(){
    var L = additionalLayers[${id}], sh = faceSheetOverrideOfLayer(L), copy = new Map(faceAssignmentsFor(${id}));
    var gridNodes = L.nodes.slice(), conns = L.connections.map(function (c) { return c.slice(); });
    var border = sh.outerCorners.map(function (p, k) { return { id: -1000001 - k, x: p.x, y: p.y, free: true }; });
    border.forEach(function (n, k) { gridNodes.push(n); conns.push([n.id, border[(k + 1) % border.length].id]); });
    computeCellFaces(L.connections, L.nodes, copy, null, sh);
    var res = computeCellFaces(conns, gridNodes, copy, null, sh), by = new Map(res.nodes.map(function (n) { return [n.id, n]; }));
    return res.faces.map(function (f) { return { verts: f.nodeIds.map(function (i) { return by.get(i); }).filter(Boolean).map(function (n) { return { x: n.x, y: n.y }; }), color: cssColorToLinear(f.color) }; }).filter(function (f) { return f.verts.length >= 3; });
  })()`);
  const rig = { w, cfg, idA, idB, pbId, geo, status, kf: { playback: { A: annotate(kf(idA), geo.ctr, geo.span, ops), B: annotate(kf(idB), geo.ctr, geo.span, ops) }, spatial: { A: annotate(kfBorder(idA), geo.ctr, geo.span, ops), B: annotate(kfBorder(idB), geo.ctr, geo.span, ops) } } };
  rig.frame = (path_, t) => frame(rig, path_, t);
  return rig;
}
// one frame of a path: the morph faces (polygons), the colours of today's location sampling (linear), the time of that call
function frame(rig, path_, t) {
  const { w, idA, idB, pbId } = rig;
  const code = path_ === 'playback' ? `(function(){
      timeline.elapsedMs = ${t * 2000}; applyTimelineFrame();
      var pb = additionalLayers[${pbId}], sh = faceSheetOverrideOfLayer(pb);
      var res = computeCellFaces(pb._morphConnections || pb.connections, pb._morphNodes || pb.nodes, null, null, sh);
      var by = new Map(res.nodes.map(function (n) { return [n.id, n]; }));
      var cf = timeline.currentFrame; var t0 = process_hrtime(); var colors = typeof crossfadeFaceColorsSampled === 'function' ? crossfadeFaceColorsSampled(res, keyframeFieldFor(timeline.keyframeLayerIds[cf.segmentIndex]), keyframeFieldFor(timeline.keyframeLayerIds[cf.segmentIndex + 1]), cf.localT) : playbackCrossfadeColors(res); var ms = process_hrtime() - t0;   // task 031: 'old' of the playback path = the location sampling kept as crossfadeFaceColorsSampled()
      return { ms: ms, faces: res.faces.map(function (f, i) { return { verts: f.nodeIds.map(function (id) { return by.get(id); }).filter(Boolean).map(function (n) { return { x: n.x, y: n.y }; }), old: cssColorToLinear(colors && colors[i] ? colors[i] : f.color) }; }) };
    })()` : `(function(){
      var seg = resolveTimelineKeyframeCoords(timeline, 0), ch = spatialMorphChooseCorners([seg.from, seg.to], 'linear');
      var L0 = additionalLayers[${idA}], s = { outerCorners: L0.outerCorners, centroid: L0.centroid, nodes: L0.nodes, shape: L0.shape, symmetryMode: L0.symmetryMode };
      var faceSheet = { shape: s.shape, symmetryMode: s.symmetryMode, centroid: s.centroid, outerCorners: s.outerCorners, gridMatchesBase: true };
      var prepared = spatialMorphPrepareLines(ch, s.outerCorners), wTile = { w00: ${1 - t}, w10: ${t}, w01: 0, w11: 0 };
      var cellLines = prepared.map(function (pl) { return [pl.a, pl.b].map(function (d) { return spatialMorphAnchoredPoint(d, wTile, wTile, false); }); });
      var tf = spatialMorphRenderTileFaces(cellLines, s, faceSheet);
      var cf = spatialMorphRenderCornerFields([${idA}, ${idB}, ${idA}, ${idB}], 2, 'linear');
      var t0 = process_hrtime(); var colors = spatialMorphRenderFaceColors(tf, cf, wTile); var ms = process_hrtime() - t0;
      var by = new Map(tf.nodes.map(function (n) { return [n.id, n]; }));
      return { ms: ms, faces: tf.faces.map(function (f, i) { return { verts: f.nodeIds.map(function (id) { return by.get(id); }).filter(Boolean).map(function (n) { return { x: n.x, y: n.y }; }), old: cssColorToLinear(colors && colors[i] ? colors[i] : '#808080') }; }) };
    })()`;
  w.sb.process_hrtime = () => Number(process.hrtime.bigint()) / 1e6;
  const r = w.run(code);
  const morph = annotate(r.faces.map((f) => ({ verts: f.verts })), rig.geo.ctr, rig.geo.span, rig.geo.ops);
  morph.forEach((f, i) => { f.old = r.faces[i].old; });
  return { morph, ms: r.ms };
}
function evaluate(rig, path_, t) {
  const { morph, ms } = frame(rig, path_, t);
  const t0 = process.hrtime.bigint();
  const kfA = rig.kf[path_].A, kfB = rig.kf[path_].B;
  const mA = matchFaces(morph, kfA), mB = matchFaces(morph, kfB);
  const colours = morph.map((f, i) => colourFor(mA[i], mB[i], kfA, kfB, t, f.old));
  const matchMs = Number(process.hrtime.bigint() - t0) / 1e6;
  return { morph, mA, mB, colours, kfA, kfB, oldMs: ms, matchMs };
}
const count = (arr, f) => arr.filter(f).length;   // f(m, i)
const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '-';

// ground truth for the Stern/Raute cases (026): the star at the cell centre, the four corner diamonds (4 corners, on a diagonal, area >= 1000)
function role(f, geo) {
  const dx = f.c.x - geo.ctr.x, dy = f.c.y - geo.ctr.y, d = Math.hypot(dx, dy);
  if (f.n === 8 && d < geo.span * 0.05) return 'star';
  if (f.n === 4 && Math.abs(Math.abs(dx) - Math.abs(dy)) < geo.span * 0.05 && f.a >= 1000 && d > geo.span * 0.05) return 'diamond';
  return null;
}
function truthLin(r, tA, tB, t) { return r === 'star' ? mixLinear(tA.star, tB.star, t) : mixLinear(tA.diamond, tB.diamond, t); }
const hex2lin = (h) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return [1, 3, 5].map((i) => f(parseInt(h.slice(i, i + 2), 16))); };

// ---------------------------------------------------------------------------------------------------------------- cases
const STAR_DIAMOND = (hs, hd) => function (info) { if (info.faceCount === 1 && info.n === 8) return { hue: HS, w: 0.036, s: 0.11, rule: 'test', params: null }; if (!info.done.d && info.faceCount === 4 && info.n === 4) { info.done.d = 1; return { hue: HD, w: 0.036, s: 0.11, rule: 'test', params: null }; } return null; };
const mkStarDiamond = (hs, hd) => new Function('return ' + STAR_DIAMOND().toString().replace('HS', hs).replace('HD', hd))();
const RAINBOW = (info) => ({ hue: (info.i * 5) % 24, w: 0.2, s: 0.3, rule: 'test', params: null });
const RAINBOW_B = (info) => ({ hue: (info.i * 5 + 11) % 24, w: 0.2, s: 0.3, rule: 'test', params: null });
const CASES = {
  stern: { name: 'Fall 1 (026): Quadrat N=4 D4, [[1,12]] -> [[1,8]], Stern violett und Raute gelb in A und B', n: 4, connsA: [[1, 12]], connsB: [[1, 8]], colourA: mkStarDiamond(12, 0), colourB: mkStarDiamond(12, 0), truth: true },
  mix: { name: 'Fall 2a: gleiche Linien, Farben verschieden (A: Stern 12, Raute 0; B: Stern 4, Raute 18)', n: 4, connsA: [[1, 12]], connsB: [[1, 8]], colourA: mkStarDiamond(12, 0), colourB: mkStarDiamond(4, 18), truth: true },
  topo: { name: 'Fall 2b: Aufspaltung/Verschmelzung: [[1,7]] (5 Flaechen) -> [[1,12]] (17 Flaechen), jede Spur eigene Farbe', n: 4, connsA: [[1, 7]], connsB: [[1, 12]], colourA: RAINBOW, colourB: RAINBOW_B, truth: false },
  topo2: { name: 'Fall 2b2: [[1,12]] (17) -> [[1,15]] (17), andere Anordnung', n: 4, connsA: [[1, 12]], connsB: [[1, 15]], colourA: RAINBOW, colourB: RAINBOW_B, truth: false }
};
const TS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];

function runCase(key) {
  const cfg = CASES[key]; const rig = setup(cfg);
  console.log(`\n=== ${cfg.name} ===`);
  console.log(`Keyframe A: ${rig.kf.playback.A.length} Flaechen (Blatt ohne Rand), B: ${rig.kf.playback.B.length}; mit Randpolygon (Spatial): A ${rig.kf.spatial.A.length}, B ${rig.kf.spatial.B.length}`);
  const colourOf = (idx, kf) => kf[idx].color;
  const paths = key === 'topo2' ? ['playback'] : ['playback', 'spatial'];
  const tA = {}, tB = {};
  if (cfg.truth) { const K = rig.kf.playback; const rA = K.A.find((f) => role(f, rig.geo) === 'star'), rB = K.B.find((f) => role(f, rig.geo) === 'star'); tA.star = rA.color; tB.star = rB.color; const dA = K.A.find((f) => role(f, rig.geo) === 'diamond'), dB = K.B.find((f) => role(f, rig.geo) === 'diamond'); tA.diamond = dA.color; tB.diamond = dB.color; }
  for (const p of paths) {
    console.log(`\n-- Pfad ${p} --`);
    console.log('t     | Flaechen | beide eindeutig | Fallback (nur A eindeutig / nur B / keiner; Gruende A+B) | Stern/Raute: dLin neu max | dLin alt max | richtiger Partner (Stern/Raute)');
    for (const t of TS) {
      const e = evaluate(rig, p, t);
      const n = e.morph.length, both = count(e.colours, (c) => c.via === 'partner'), fb = n - both;
      const u = (m) => m.status === 'unique'; const st = { nurA: count(e.mA, (m, i) => u(m) && !u(e.mB[i])), nurB: count(e.mB, (m, i) => u(m) && !u(e.mA[i])), keiner: count(e.mA, (m, i) => !u(m) && !u(e.mB[i])) }; const why = {}; e.mA.concat(e.mB).forEach((m) => { if (!u(m)) why[m.status] = (why[m.status] || 0) + 1; });
      let dNew = '-', dOld = '-', right = '-';
      if (cfg.truth) {
        let mn = 0, mo = 0, ok = 0, tot = 0;
        e.morph.forEach((f, i) => { const r = role(f, rig.geo); if (!r) return; const soll = truthLin(r, tA, tB, t); mn = Math.max(mn, lin2l(e.colours[i].lin, soll)); mo = Math.max(mo, lin2l(f.old, soll)); tot++; const pa = e.mA[i], pb = e.mB[i]; if (pa.status === 'unique' && pb.status === 'unique' && role(e.kfA[pa.idx], rig.geo) === r && role(e.kfB[pb.idx], rig.geo) === r) ok++; });
        dNew = mn.toFixed(4); dOld = mo.toFixed(4); right = `${ok}/${tot}`;
      }
      console.log(`${String(t).padEnd(5)} | ${String(n).padStart(8)} | ${String(both).padStart(3)} (${pct(both, n).padStart(4)})     | ${String(fb).padStart(3)} (${pct(fb, n).padStart(4)}) ${J(st).replace(/"/g, '')} Gruende ${J(why).replace(/"/g, '')} | ${dNew} | ${dOld} | ${right}`);
      if (VERBOSE) e.morph.forEach((f, i) => console.log(`    face ${i} n=${f.n} orb=${f.orb} area=${f.a.toFixed(0)} A:${e.mA[i].status}${e.mA[i].idx !== null ? '#' + e.mA[i].idx : ''} B:${e.mB[i].status}${e.mB[i].idx !== null ? '#' + e.mB[i].idx : ''} via ${e.colours[i].via}`));
    }
  }
  return rig;
}
// jumps between t and t+0.05 per face (matchTile criteria of measure-color-jumps.js: area ratio 0.5..2, centroid inclusion, half of the samples inside), new colour vs today's
function jumps(rig, p, step) {
  const frames = []; for (let k = 0; k * step <= 1 + 1e-9; k++) { const t = +(k * step).toFixed(4); const e = evaluate(rig, p, t); frames.push(e); }
  const row = { pFaces: 0, pNew: 0, pOld: 0, pNewWorst: null, faces: 0, unassignable: 0, newMax: 0, oldMax: 0, newOver12: 0, oldOver12: 0, newWorst: null, oldWorst: null, switches: 0 };
  for (let k = 1; k < frames.length; k++) {
    const P = frames[k - 1], C = frames[k];
    C.morph.forEach((f, i) => {
      let best = null, bd = Infinity;
      P.morph.forEach((g, gi) => {
        if (f.a / g.a > 2 || f.a / g.a < 0.5) return;
        if (!inside(f.c, g.verts) && !inside(g.c, f.verts)) return;
        const S = M.spatialMorphFaceSamples(f.verts); if (S.reduce((a, q) => a + (inside(q, g.verts) ? q.w : 0), 0) < 0.5) return;
        const d = Math.hypot(f.c.x - g.c.x, f.c.y - g.c.y); if (d < bd) { bd = d; best = gi; }
      });
      row.faces++;
      if (best === null) { row.unassignable++; return; }
      const jn = cdist(C.colours[i].lin, P.colours[best].lin), jo = cdist(f.old, P.morph[best].old);
      if (C.colours[i].via !== P.colours[best].via) row.switches++;
      if (C.colours[i].via === 'partner' && P.colours[best].via === 'partner') { row.pFaces++; if (jn > row.pNew) { row.pNew = jn; row.pNewWorst = k * step; } if (jo > row.pOld) row.pOld = jo; }
      if (jn > 12) row.newOver12++; if (jo > 12) row.oldOver12++;
      if (jn > row.newMax) { row.newMax = jn; row.newWorst = k * step; } if (jo > row.oldMax) { row.oldMax = jo; row.oldWorst = k * step; }
    });
  }
  return row;
}
function timing(rig, p) {
  const out = {};
  for (const t of [0.25, 0.5, 0.75]) {
    const e0 = evaluate(rig, p, t); let m = 0, o = 0; const R = 20;
    for (let r = 0; r < R; r++) { const e = evaluate(rig, p, t); m += e.matchMs; o += e.oldMs; }
    out[t] = { faces: e0.morph.length, matchMs: m / R, oldMs: o / R };
  }
  return out;
}

if (RUN_MAIN && !['--stages', '--edge', '--explain', '--v3', '--hyst', '--spatial'].some((a) => process.argv.includes(a))) {
const which = arg('--case', 'all');
const keys = which === 'all' ? Object.keys(CASES) : [which];
const rigs = {};
keys.forEach((k) => { rigs[k] = runCase(k); });
console.log('\n=== Spruenge zwischen t und t+0.05 (matchTile-Kriterien), je Flaeche; neu = Partnermischung mit Fallback, alt = heutige Ortsabtastung ===');
console.log('Fall | Pfad | Flaechen (Schritte x Flaechen) | nicht zuordenbar | max Sprung neu (bei t) | max alt (bei t) | >12 neu | >12 alt | Wechsel Partner<->Fallback | nur Partnerflaechen (Schritte x Fl.): max neu (bei t) / max alt');
keys.forEach((k) => { ['playback', 'spatial'].forEach((p) => { if (k === 'topo2' && p === 'spatial') return; const r = jumps(rigs[k], p, 0.05); console.log(`${k} | ${p} | ${r.faces} | ${r.unassignable} | ${r.newMax} (${r.newWorst}) | ${r.oldMax} (${r.oldWorst}) | ${r.newOver12} | ${r.oldOver12} | ${r.switches} | ${r.pFaces}: ${r.pNew} (${r.pNewWorst}) / ${r.pOld}`); }); });
console.log('\n=== Rechenzeit je Frame (ms, Node, Mittel von 20 Laeufen): Zuordnung+Mischung (neu) gegen heutige Ortsabtastung (alt) ===');
keys.forEach((k) => { ['playback', 'spatial'].forEach((p) => { if (k === 'topo2' && p === 'spatial') return; const t = timing(rigs[k], p); console.log(`${k} | ${p} | ` + Object.keys(t).map((x) => `t=${x}: ${t[x].faces} Fl. neu ${t[x].matchMs.toFixed(2)} / alt ${t[x].oldMs.toFixed(2)}`).join(' | ')); }); });
}

// =============================================================================================================================================================================================
// 028 - the stages. Variants of the colour of a face (linear light, per face):
//   old    today's location sampling (crossfadeFaceColors / spatialMorphRenderFaceColors)
//   v027   027: orbit from the polygons; both partners unique -> mix, else old
//   v1     stage 1: orbit from the symmetry group; both unique -> mix, else old
//   v2a    stage 2a: v1; ONE side unique -> that partner's colour, blended into old over the t window W (weight 1 at t=0 for an A-only face, 1 at t=1 for a B-only face)
//   v2b    stage 2b: v1; fallback = sampling only inside the keyframe face the morph face overlaps most (>= 40 % of its samples) on each side, mixed (1-t, t); one side only -> that side; none -> old
//   v2ab   both: one side unique -> window blend of that partner's colour into the v2b fallback; otherwise the v2b fallback
// =============================================================================================================================================================================================
const W_WIN = 0.1, DOM_SHARE = 0.4;
const VARIANTS = ['old', 'v027', 'v1', 'v2a', 'v2b', 'v2ab', 'v3', 'v3r', 'v3c', 'v3cb', 'v3cbr', 'vg'];
let SHOW = VARIANTS;   // the variants a table prints
const lin2 = (a, b, k) => [0, 1, 2].map((i) => (1 - k) * a[i] + k * b[i]);
function dominantColour(f, kf) {
  const { shares, tot } = overlapShares(f, kf); let best = -1, bs = 0;
  shares.forEach((v, gi) => { if (v > bs) { bs = v; best = gi; } });
  return best >= 0 && tot > 0 && bs / tot >= DOM_SHARE && kf[best].color ? kf[best].color : null;
}

// 029: v3 = continuous weighting. g = min(share of the face's samples inside its partner polygon in A, the same in B) (a side without a candidate: 0); colour = g * (1-t, t) mix of the partner colours + (1-g) * today's
// location sampling. No hard decision. v3r = v3 against the REFERENCE faces at the border (spatial path; the playback path has no such edge case, v3r = v3 there).
function shareIn(f, g) { const S = M.spatialMorphFaceSamples(f.verts); let a = 0, tot = 0; S.forEach((q) => { tot += q.w; if (inside(q, g.verts)) a += q.w; }); return tot ? a / tot : 0; }
// extension (not in the 029 order, labelled as such): v3c = g from CONTAINMENT, the larger of "share of the face inside the partner" and "share of the partner inside the face" (a face that grows or shrinks along the morph
// stays the same face); v3cb = v3c with the fallback of stage 2b (dominant keyframe face) instead of today's sampling; v3cbr = v3cb against the reference faces (spatial).
function shareOfPartnerIn(f, g) { g._S = g._S || M.spatialMorphFaceSamples(g.verts); let a = 0, tot = 0; g._S.forEach((q) => { tot += q.w; if (inside(q, f.verts)) a += q.w; }); return tot ? a / tot : 0; }
function v3Eval(morph, kfA, kfB, t, mA, mB, opt) {
  opt = opt || {}; const col = [], gs = [];
  morph.forEach((f, i) => {
    const a = mA[i].idx, b = mB[i].idx;
    let fb = f.old;
    if (opt.fbDom) { const dA = dominantColour(f, kfA), dB = dominantColour(f, kfB); fb = dA && dB ? lin2(dA, dB, t) : (dA || dB || f.old); }
    if (a === null || b === null || !kfA[a].color || !kfB[b].color) { col.push(fb); gs.push(0); return; }
    const sh = (g) => opt.contain ? Math.max(shareIn(f, g), shareOfPartnerIn(f, g)) : shareIn(f, g);
    const g = Math.min(sh(kfA[a]), sh(kfB[b]));
    const pm = lin2(kfA[a].color, kfB[b].color, t);
    col.push([0, 1, 2].map((k) => g * pm[k] + (1 - g) * fb[k])); gs.push(g);
  });
  return { col, g: gs };
}
// the reference faces of the spatial path (028 point 5): the tile faces of the same anchored lines at weight (1,0) / (0,1), colours from the true keyframe faces (dominant overlap)
function buildRef(rig) {
  if (rig.kfRef) return;
  const trueKf = rig.kf.spatial, ref = {};
  ['A', 'B'].forEach((side) => { const { morph } = frame(rig, 'spatial', side === 'A' ? 0 : 1); ref[side] = annotate(morph.map((f) => ({ verts: f.verts, color: dominantColour(f, trueKf[side]) })).filter((f) => f.color), rig.geo.ctr, rig.geo.span, rig.geo.ops); });
  rig.kfRef = ref;
}
function evaluate2(rig, path_, t) {
  const { morph, ms } = frame(rig, path_, t);
  const kfA = rig.kf[path_].A, kfB = rig.kf[path_].B;
  const pA = matchFaces(morph, kfA, 'poly'), pB = matchFaces(morph, kfB, 'poly'), gA = matchFaces(morph, kfA, 'group'), gB = matchFaces(morph, kfB, 'group');
  const u = (m) => m.status === 'unique';
  const col = {}; VARIANTS.forEach((v) => { col[v] = []; });
  const via = {}; VARIANTS.forEach((v) => { via[v] = []; });
  morph.forEach((f, i) => {
    const old = f.old;
    col.old.push(old); via.old.push('fallback');
    const c27 = colourFor(pA[i], pB[i], kfA, kfB, t, old); col.v027.push(c27.lin); via.v027.push(c27.via);
    const c1 = colourFor(gA[i], gB[i], kfA, kfB, t, old); col.v1.push(c1.lin); via.v1.push(c1.via);
    const aOnly = u(gA[i]) && !u(gB[i]) && kfA[gA[i].idx].color, bOnly = u(gB[i]) && !u(gA[i]) && kfB[gB[i].idx].color;
    const wA = Math.max(0, 1 - t / W_WIN), wB = Math.max(0, 1 - (1 - t) / W_WIN);
    // 2a
    if (c1.via === 'partner') { col.v2a.push(c1.lin); via.v2a.push('partner'); }
    else if (aOnly) { col.v2a.push(lin2(old, kfA[gA[i].idx].color, wA)); via.v2a.push(wA > 0 ? 'blend' : 'fallback'); }
    else if (bOnly) { col.v2a.push(lin2(old, kfB[gB[i].idx].color, wB)); via.v2a.push(wB > 0 ? 'blend' : 'fallback'); }
    else { col.v2a.push(old); via.v2a.push('fallback'); }
    // 2b fallback
    const dA = dominantColour(f, kfA), dB = dominantColour(f, kfB);
    const fb = dA && dB ? lin2(dA, dB, t) : (dA || dB || old);
    if (c1.via === 'partner') { col.v2b.push(c1.lin); via.v2b.push('partner'); } else { col.v2b.push(fb); via.v2b.push('fallback'); }
    // 2a+2b
    if (c1.via === 'partner') { col.v2ab.push(c1.lin); via.v2ab.push('partner'); }
    else if (aOnly) { col.v2ab.push(lin2(fb, kfA[gA[i].idx].color, wA)); via.v2ab.push(wA > 0 ? 'blend' : 'fallback'); }
    else if (bOnly) { col.v2ab.push(lin2(fb, kfB[gB[i].idx].color, wB)); via.v2ab.push(wB > 0 ? 'blend' : 'fallback'); }
    else { col.v2ab.push(fb); via.v2ab.push('fallback'); }
  });
  const e3 = v3Eval(morph, kfA, kfB, t, gA, gB); col.v3 = e3.col; via.v3 = e3.g.map((g) => g > 0.5 ? 'partner' : 'fallback');
  let e3r = e3;
  if (path_ === 'spatial' && rig.kfRef) e3r = v3Eval(morph, rig.kfRef.A, rig.kfRef.B, t, matchFaces(morph, rig.kfRef.A, 'group'), matchFaces(morph, rig.kfRef.B, 'group'));
  col.v3r = e3r.col; via.v3r = e3r.g.map((g) => g > 0.5 ? 'partner' : 'fallback');
  const e3c = v3Eval(morph, kfA, kfB, t, gA, gB, { contain: true }), e3cb = v3Eval(morph, kfA, kfB, t, gA, gB, { contain: true, fbDom: true });
  let e3cbr = e3cb; if (path_ === 'spatial' && rig.kfRef) e3cbr = v3Eval(morph, rig.kfRef.A, rig.kfRef.B, t, matchFaces(morph, rig.kfRef.A, 'group'), matchFaces(morph, rig.kfRef.B, 'group'), { contain: true, fbDom: true });
  [['v3c', e3c], ['v3cb', e3cb], ['v3cbr', e3cbr]].forEach(([v, e]) => { col[v] = e.col; via[v] = e.g.map((g) => g > 0.5 ? 'partner' : 'fallback'); });
  // 029 option check: the gate "only quadrat-like cases": per FRAME v1 when at least 40 % of the faces have both partners unique, else today's colours
  const gateOn = count(gA, (m, i) => u(m) && u(gB[i])) / (morph.length || 1) >= 0.4; col.vg = gateOn ? col.v1 : col.old; via.vg = gateOn ? via.v1 : via.old;
  const uniq = (m1, m2) => count(m1, (m, i) => u(m) && u(m2[i]));
  return { morph, kfA, kfB, col, via, g3: e3.g, g3r: e3r.g, gx: { v3c: e3c.g, v3cb: e3cb.g, v3cbr: e3cbr.g }, oldMs: ms, n: morph.length, bothPoly: uniq(pA, pB), bothGroup: uniq(gA, gB), gA, gB, pA, pB };
}
const TGRID = []; for (let k = 0; k <= 20; k++) TGRID.push(+(k * 0.05).toFixed(2));
const hexOf = (c) => c;   // linear stays linear: dLin is taken in linear light

// the cases. natural colouring: every trail its own hue in A and another in B (jumps); uniform: every trail the SAME colour in A and B (Soll known for every face: that colour)
const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function randConns(r, n, ids) { const out = [], seen = new Set(); let g = 0; while (out.length < n && g++ < 1000) { const a = ids[Math.floor(r() * ids.length)], b = ids[Math.floor(r() * ids.length)]; if (a === b) continue; const k = a < b ? a + '-' + b : b + '-' + a; if (seen.has(k)) continue; seen.add(k); out.push([a, b]); } return out; }
const UNIFORM = (info) => ({ hue: 8, w: 0.2, s: 0.3, rule: 'test', params: null });
function randomPair(shape, N, sym, seed, n) {
  const w = makeRenderWorld(shape, N, 3, sym); const ids = w.get('nodes.filter((nd) => !nd.free).map((nd) => nd.id)');
  const r = rng(seed * 7919 + n); return { A: randConns(r, n, ids), B: randConns(r, n, ids) };
}
// a gallery pair (gallery/manifest.jsonl): two entries of one (shape, order, group) with count 2 whose face counts differ the most (split / merge); lines = the first pair of each orbit
function galleryPair(shape, order, token, mode) {
  const fs = require('fs'); const man = fs.readFileSync(path.join(__dirname, '..', '..', 'gallery', 'manifest.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse)
    .filter((e) => e.shape === shape && e.order === order && e.groupToken === token && e.count === 2).slice(0, 60);
  const w = makeRenderWorld(shape, order, 3, mode);
  const table = w.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners)');
  const items = man.map((e) => { const conns = e.orbitIds.map((id) => table.orbits[id].pairs[0]); const id = w.addKeyframeLayer(conns, { showFaces: true });
    const faces = w.run(`(function(){ var L = additionalLayers[${id}]; return computeCellFaces(L.connections, L.nodes, null, null, faceSheetOverrideOfLayer(L)).faces.length; })()`); return { e, conns, faces }; }).filter((x) => x.faces > 0);
  let best = null; for (const a of items) for (const b of items) { if (a === b) continue; const q = Math.min(a.faces, b.faces) / Math.max(a.faces, b.faces); if (a.faces >= 5 && b.faces >= 5 && (!best || q < best.q)) best = { a, b, q }; }
  return { A: best.a.conns, B: best.b.conns, name: `${best.a.e.path.split('/').pop()} (${best.a.faces} Fl.) -> ${best.b.e.path.split('/').pop()} (${best.b.faces} Fl.)` };
}

// a CURATED gallery pair (not random): among the first 80 count-2 entries of (shape, order, group) with 8..40 faces, the pair that shares exactly one orbit line (an edit of one pattern, as a user makes it) and has the most similar
// face count (ties: the first in manifest order); deterministic.
function curatedPair(shape, order, token, mode) {
  const fs = require('fs'); const man = fs.readFileSync(path.join(__dirname, '..', '..', 'gallery', 'manifest.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse)
    .filter((e) => e.shape === shape && e.order === order && e.groupToken === token && e.count === 2).slice(0, 80);
  const w = makeRenderWorld(shape, order, 3, mode);
  const table = w.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners)');
  const items = man.map((e) => { const conns = e.orbitIds.map((id) => table.orbits[id].pairs[0]); const id = w.addKeyframeLayer(conns, { showFaces: true });
    const faces = w.run(`(function(){ var L = additionalLayers[${id}]; return computeCellFaces(L.connections, L.nodes, null, null, faceSheetOverrideOfLayer(L)).faces.length; })()`); return { e, conns, faces }; }).filter((x) => x.faces >= 8 && x.faces <= 40);
  let best = null;
  for (const a of items) for (const b of items) {
    if (a === b || a.e.path >= b.e.path) continue; const shared = a.e.orbitIds.filter((o) => b.e.orbitIds.includes(o)).length; if (shared !== 1) continue;
    const q = Math.abs(a.faces - b.faces); if (!best || q < best.q) best = { a, b, q };
  }
  return { A: best.a.conns, B: best.b.conns, name: `${best.a.e.path.split('/').pop()} (${best.a.faces} Fl.) -> ${best.b.e.path.split('/').pop()} (${best.b.faces} Fl.)` };
}
function buildCases(curated) {
  const hexP = randomPair('hex', 3, 'rotation_reflection6', 1, 5), triP = randomPair('triangle', 5, 'rotation_reflection3', 1, 5), gal = galleryPair('square', 4, 'D4', 'rotation_reflection6');
  const hexK = (curated || process.argv.includes('--v3') || process.argv.includes('--hyst')) ? curatedPair('hex', 2, 'D6', 'rotation_reflection6') : null, triK = (curated || process.argv.includes('--v3') || process.argv.includes('--hyst')) ? curatedPair('triangle', 4, 'D3', 'rotation_reflection6') : null;
  const extra = hexK ? {
    hexK: { name: 'Galerie Hexagon 2 D6 (kuratiert): ' + hexK.name, shape: 'hex', n: 2, sym: 'rotation_reflection6', connsA: hexK.A, connsB: hexK.B, colourA: RAINBOW, colourB: RAINBOW_B },
    triK: { name: 'Galerie Dreieck 4 D3 (kuratiert): ' + triK.name, shape: 'triangle', n: 4, sym: 'rotation_reflection6', connsA: triK.A, connsB: triK.B, colourA: RAINBOW, colourB: RAINBOW_B } } : {};
  return Object.assign({
    sq: { name: 'Quadrat N=4 D4 (026): [[1,12]] -> [[1,8]] (Stern violett, Raute gelb)', n: 4, connsA: [[1, 12]], connsB: [[1, 8]], colourA: mkStarDiamond(12, 0), colourB: mkStarDiamond(12, 0), truth: true },
    topoSq: { name: 'Quadrat, Aufspaltung: [[1,7]] (5 Fl.) -> [[1,12]] (17 Fl.)', n: 4, connsA: [[1, 7]], connsB: [[1, 12]], colourA: RAINBOW, colourB: RAINBOW_B },
    hex: { name: 'Hexagon N=3 D6 (jumps-Paar hex-typical, 5 Linien, Seed 1)', shape: 'hex', n: 3, sym: 'rotation_reflection6', connsA: hexP.A, connsB: hexP.B, colourA: RAINBOW, colourB: RAINBOW_B },
    tri: { name: 'Dreieck N=5 D3 (jumps-Paar tri-typical, 5 Linien, Seed 1)', shape: 'triangle', n: 5, sym: 'rotation_reflection3', connsA: triP.A, connsB: triP.B, colourA: RAINBOW, colourB: RAINBOW_B },
    gal: { name: 'Galerie Quadrat 4 D4: ' + gal.name, n: 4, connsA: gal.A, connsB: gal.B, colourA: RAINBOW, colourB: RAINBOW_B }
  }, extra);
}
const withUniform = (cfg) => Object.assign({}, cfg, { colourA: UNIFORM, colourB: UNIFORM, truth: false });
// Soll of the uniform test: the colour every overlapped keyframe face has, if all of them have the same one on both sides (else undefined: the face is left out)
function sollUniform(f, kfA, kfB) {
  const cs = []; [kfA, kfB].forEach((kf) => { const { shares } = overlapShares(f, kf); shares.forEach((v, gi) => cs.push(kf[gi].color)); });
  if (!cs.length) return null; const c0 = cs[0]; return cs.every((c) => lin2l(c, c0) < 1e-3) ? c0 : null;
}

function stageRun(key, cfg) {
  const out = { key, name: cfg.name, paths: {} };
  const nat = setup(cfg), uni = setup(withUniform(cfg)); buildRef(nat); buildRef(uni);
  const paths = ['playback', 'spatial'];
  paths.forEach((p) => {
    const row = {}; VARIANTS.forEach((v) => { row[v] = { jumpMax: 0, jumpAt: null, over12: 0, jumpFaces: 0, unassign: 0, switches: 0, dMax: 0, dFaces: 0, dBad: 0, pJump: 0, gHi: 0, gN: 0 }; });
    let uniqShareP = 0, uniqShareG = 0, nFaces = 0, nFrames = 0, bothP = 0, bothG = 0;
    // jumps: natural colours, step 0.05
    const frames = TGRID.map((t) => evaluate2(nat, p, t));
    frames.forEach((e) => { bothP += e.bothPoly; bothG += e.bothGroup; nFaces += e.n; e.g3.forEach((g) => { row.v3.gN++; if (g > 0.5) row.v3.gHi++; }); e.g3r.forEach((g) => { row.v3r.gN++; if (g > 0.5) row.v3r.gHi++; }); Object.keys(e.gx).forEach((v) => e.gx[v].forEach((g) => { row[v].gN++; if (g > 0.5) row[v].gHi++; })); });
    for (let k = 1; k < frames.length; k++) {
      const P = frames[k - 1], C = frames[k];
      C.morph.forEach((f, i) => {
        let best = null, bd = Infinity;
        P.morph.forEach((g, gi) => {
          if (f.a / g.a > 2 || f.a / g.a < 0.5) return;
          if (!inside(f.c, g.verts) && !inside(g.c, f.verts)) return;
          const S = M.spatialMorphFaceSamples(f.verts); if (S.reduce((a, q) => a + (inside(q, g.verts) ? q.w : 0), 0) < 0.5) return;
          const d = Math.hypot(f.c.x - g.c.x, f.c.y - g.c.y); if (d < bd) { bd = d; best = gi; }
        });
        VARIANTS.forEach((v) => {
          const r = row[v]; r.jumpFaces++;
          if (best === null) { r.unassign++; return; }
          const j = cdist(C.col[v][i], P.col[v][best]);
          if (C.via[v][i] !== P.via[v][best]) r.switches++;
          if (j > 12) r.over12++;
          if (j > r.jumpMax) { r.jumpMax = j; r.jumpAt = TGRID[k]; }
        });
      });
    }
    // uniform colours: dLin to the Soll colour per face
    TGRID.forEach((t) => {
      const e = evaluate2(uni, p, t);
      e.morph.forEach((f, i) => {
        const soll = sollUniform(f, e.kfA, e.kfB); if (!soll) return;
        VARIANTS.forEach((v) => { const d = lin2l(e.col[v][i], soll), r = row[v]; r.dFaces++; if (d > r.dMax) r.dMax = d; if (d > 0.02) r.dBad++; });
      });
    });
    // star / diamond truth (stern case): dLin of the star and the corner diamonds to the mix of their true colours
    let sd = null;
    if (cfg.truth) {
      sd = {}; VARIANTS.forEach((v) => { sd[v] = 0; });
      const K = nat.kf.playback, tA = { star: K.A.find((f) => role(f, nat.geo) === 'star').color, diamond: K.A.find((f) => role(f, nat.geo) === 'diamond').color };
      frames.forEach((e, k) => e.morph.forEach((f, i) => { const r = role(f, nat.geo); if (!r) return; const soll = tA[r]; VARIANTS.forEach((v) => { sd[v] = Math.max(sd[v], lin2l(e.col[v][i], soll)); }); }));
    }
    { // time per frame (ms): today's location sampling (measured inside the world) against the matching + v3 colours (Node), mean of 20 runs at t = 0.25 / 0.5 / 0.75
      let nw = 0, od = 0, k = 0;
      [0.25, 0.5, 0.75].forEach((t) => { const { morph, ms } = frame(nat, p, t); const kfA = nat.kf[p].A, kfB = nat.kf[p].B;
        for (let r = 0; r < 20; r++) { const t0 = process.hrtime.bigint(); const mA = matchFaces(morph, kfA, 'group'), mB = matchFaces(morph, kfB, 'group'); v3Eval(morph, kfA, kfB, t, mA, mB); nw += Number(process.hrtime.bigint() - t0) / 1e6; od += ms; k++; } });
      row.time = { nw: nw / k, od: od / k };
    }
    row.share = { poly: bothP / nFaces, group: bothG / nFaces, faces: nFaces / frames.length };
    row.sd = sd; out.paths[p] = row;
  });
  return out;
}
function fmt(x, d) { return x === null || x === undefined ? '-' : (typeof x === 'number' ? x.toFixed(d === undefined ? 0 : d) : String(x)); }
function printStage(out) {
  console.log(`\n=== ${out.name} ===`);
  Object.keys(out.paths).forEach((p) => {
    const r = out.paths[p];
    console.log(`-- Pfad ${p}: Flaechen je Frame ${r.share.faces.toFixed(1)}; beide Partner eindeutig, Mittel ueber t = 0..1 (Schritt 0.05): Orbit aus Polygonen ${(100 * r.share.poly).toFixed(0)} % -> aus Gruppe ${(100 * r.share.group).toFixed(0)} % (Stufe 1)`);
    console.log('   Variante | max Sprung/Flaeche (bei t) | Spruenge > 12 | Wechsel Partner/Fallback | nicht zuordenbar | dLin bei gleichen Farben: max (Flaechen > 0.02 von n)' + (r.sd ? ' | Stern/Raute dLin max' : ''));
    SHOW.forEach((v) => { const x = r[v]; console.log(`   ${v.padEnd(8)} | ${String(x.jumpMax).padStart(3)} (${fmt(x.jumpAt, 2)}) | ${String(x.over12).padStart(4)} / ${x.jumpFaces} | ${String(x.switches).padStart(4)} | ${String(x.unassign).padStart(4)} | ${x.dMax.toFixed(4)} (${x.dBad} von ${x.dFaces})${r.sd ? ' | ' + r.sd[v].toFixed(4) : ''}${x.gN ? ' | g>0.5: ' + (100 * x.gHi / x.gN).toFixed(0) + ' %' : ''}`); });
    console.log(`   Zeit je Frame: heutige Ortsabtastung ${r.time.od.toFixed(2)} ms, Zuordnung + v3 ${r.time.nw.toFixed(2)} ms`);
  });
}
if (RUN_MAIN && process.argv.includes('--v3')) {
  NEAR_K = 1.5; SHOW = ['old', 'v1', 'v2b', 'v3', 'v3r', 'v3c', 'v3cb', 'v3cbr', 'vg']; const cases = buildCases(); const which = arg('--case', 'all');
  console.log('######## 029: Nähekriterium 1.5; v3 = stetige Gewichtung, v3r = v3 + Referenzflaechen am Rand ########');
  Object.keys(cases).filter((k) => which === 'all' || which === k).forEach((k) => printStage(stageRun(k, cases[k])));
}
if (RUN_MAIN && process.argv.includes('--stages')) {
  const cases = buildCases(); const which = arg('--case', 'all');
  [0, +arg('--near', '1.5')].forEach((K) => { NEAR_K = K; console.log(`\n######## Zuordnungskriterium: ${K ? 'Schwerpunkt-Einschluss ODER Naehe <= ' + K + ' x sqrt(Flaeche) (Stufe 1b)' : 'Schwerpunkt-Einschluss (wie 027)'} ########`);
    Object.keys(cases).filter((k) => which === 'all' || which === k).forEach((k) => printStage(stageRun(k, cases[k]))); });
}

// --explain: why a morph face finds no unique partner. For one case and path, at the given t, per face and side the FIRST criterion that rejects the nearest same-corner-count candidate
// (orbit size by group, area ratio, centroid inclusion) or "no candidate with this corner count".
if (RUN_MAIN && process.argv.includes('--explain') && !process.argv.includes('--spatial')) {
  const cases = buildCases(); const k = arg('--case', 'sq'), p = arg('--path', 'playback'); const rig = setup(cases[k]);
  arg('--t', '0.25,0.5').split(',').forEach((ts) => {
    const t = +ts, e = evaluate2(rig, p, t); const why = { A: {}, B: {} };
    ['A', 'B'].forEach((side) => {
      const kf = side === 'A' ? e.kfA : e.kfB, ms = side === 'A' ? e.gA : e.gB;
      e.morph.forEach((f, i) => {
        if (ms[i].status === 'unique') { why[side].unique = (why[side].unique || 0) + 1; return; }
        const same = kf.filter((g) => g.n === f.n);
        let r;
        if (!same.length) r = `kein Kandidat mit ${f.n} Ecken`;
        else {
          const g = same.reduce((a, b) => Math.hypot(a.c.x - f.c.x, a.c.y - f.c.y) <= Math.hypot(b.c.x - f.c.x, b.c.y - f.c.y) ? a : b);
          if (g.og !== f.og) r = `Orbitgroesse ${f.og} gegen ${g.og} (n=${f.n})`;
          else if (f.a / g.a > RATIO || f.a / g.a < 1 / RATIO) r = 'Flaechenverhaeltnis';
          else if (!inside(f.c, g.verts) && !inside(g.c, f.verts)) r = `Schwerpunkt-Einschluss (n=${f.n}, Abstand ${(Math.hypot(f.c.x - g.c.x, f.c.y - g.c.y) / rig.geo.span).toFixed(2)} Zelle)`;
          else r = 'mehrdeutig/anderes';
        }
        why[side][r] = (why[side][r] || 0) + 1;
      });
    });
    console.log(`t=${t} ${p} ${k}: ` + J(why));
  });
}

// --edge (028, point 4): the spatial frame at t = 0 / 1 against the keyframe. Cause: spatialMorphPrepareLines() marks an endpoint { onBoundary, moved } when it lies on the cell border in ONE keyframe and not in the
// other; spatialMorphAnchoredPoint(d, w, wEdge, false) (exactEnds off, stage d2c) puts it on the BORDER projection of its keyframe position at EVERY weight incl. p = 0 / 1, so the frame at t = 0 is not the keyframe's own lines.
// Measured here: per case the number of such endpoints and their displacement at t = 0 / 1 against the keyframe position; the share of morph faces with unique partners at t = 0 / 1 and over t, once against the TRUE keyframe
// faces (as spatialMorphRenderCornerField builds them) and once against the REFERENCE faces (the tile faces of the same anchored lines at weight (1,0) / (0,1), colours taken from the true faces): the proposal.
if (RUN_MAIN && process.argv.includes('--edge')) {
  NEAR_K = +arg('--near', '1.5');
  const cases = buildCases();
  ['sq', 'topoSq', 'gal', 'hex'].forEach((k) => {
    const rig = setup(cases[k]);
    const disp = rig.w.run(`(function(){
      var seg = resolveTimelineKeyframeCoords(timeline, 0), ch = spatialMorphChooseCorners([seg.from, seg.to], 'linear');
      var L0 = additionalLayers[${rig.idA}], prepared = spatialMorphPrepareLines(ch, L0.outerCorners), moved = 0, ends = 0, maxA = 0, maxB = 0;
      prepared.forEach(function (pl) { [pl.a, pl.b].forEach(function (d) { ends++; if (d.moved) moved++;
        var pA = spatialMorphAnchoredPoint(d, { w00: 1, w10: 0, w01: 0, w11: 0 }, { w00: 1, w10: 0, w01: 0, w11: 0 }, false), pB = spatialMorphAnchoredPoint(d, { w00: 0, w10: 1, w01: 0, w11: 0 }, { w00: 0, w10: 1, w01: 0, w11: 0 }, false);
        maxA = Math.max(maxA, Math.hypot(pA.x - d.points[0].x, pA.y - d.points[0].y)); maxB = Math.max(maxB, Math.hypot(pB.x - d.points[1].x, pB.y - d.points[1].y)); }); });
      return { lines: prepared.length, ends: ends, moved: moved, maxA: maxA, maxB: maxB };
    })()`);
    const trueKf = rig.kf.spatial, ref = {};
    ['A', 'B'].forEach((side) => { const { morph } = frame(rig, 'spatial', side === 'A' ? 0 : 1); ref[side] = morph.map((f) => ({ verts: f.verts, color: dominantColour(f, trueKf[side]) })).filter((f) => f.color); ref[side] = annotate(ref[side], rig.geo.ctr, rig.geo.span, rig.geo.ops); });
    const share = (kfset, t) => { rig.kf.spatial = kfset; const e = evaluate2(rig, 'spatial', t); return e.bothGroup / e.n; };
    const row = (kfset) => [0, 0.05, 0.5, 0.95, 1].map((t) => (100 * share(kfset, t)).toFixed(0) + '%').join(' / ');
    const mean = (kfset) => (100 * TGRID.reduce((a, t) => a + share(kfset, t), 0) / TGRID.length).toFixed(0) + '%';
    console.log(`${k}: ${disp.lines} Linien, ${disp.moved} von ${disp.ends} Endpunkten onBoundary+moved; Abweichung der Frame-Linie vom Keyframe bei t=0: ${disp.maxA.toFixed(1)} px, bei t=1: ${disp.maxB.toFixed(1)} px`);
    console.log(`   eindeutig (beide Seiten) bei t = 0 / 0.05 / 0.5 / 0.95 / 1: gegen die echten Keyframe-Flaechen ${row(trueKf)} (Mittel ${mean(trueKf)}); gegen Referenzflaechen ${row({ A: ref.A, B: ref.B })} (Mittel ${mean({ A: ref.A, B: ref.B })})`);
    rig.kf.spatial = trueKf;
  });
}

// =============================================================================================================================================================================================
// 030 - hysteresis. `node tools/morph/measure-face-match.js --hyst [--case sq|topoSq|hex|tri|gal|hexK|triK|all] [--step 0.05] [--fine]`   (--fine: only the Stern/Raute case at step 0.01)
//   v3cb  029: containment weight g, fallback = the dominant keyframe polygon per side (>= 40 % of the face's samples), mixed (1-t, t)
//   h1    v3cb with HYSTERESIS: a face keeps the dominant polygon it had in the step before (found by the matchTile criteria) while that polygon still holds >= 25 % of its samples and the new candidate does not exceed
//         it by the factor 1.25; the state runs through the sequence t = 0..1 (forward) and is run again 1..0 (backward) to show the path dependence
//   h2    no decision: the fallback of a side = the colours of ALL polygons it overlaps, weighted by the overlap share (normalised); mixed (1-t, t); the weight g and the partner mix as in v3cb
// =============================================================================================================================================================================================
function predOf(prevMorph, f) {   // the face of the step before (matchTile criteria of measure-color-jumps.js: area ratio 0.5..2, centroid inclusion, half of the samples inside), or null
  let best = null, bd = Infinity;
  prevMorph.forEach((g, gi) => {
    if (f.a / g.a > 2 || f.a / g.a < 0.5) return;
    if (!inside2(f.c, g) && !inside2(g.c, f)) return;
    if (shareIn(f, g) < 0.5) return;
    const d = Math.hypot(f.c.x - g.c.x, f.c.y - g.c.y); if (d < bd) { bd = d; best = gi; }
  });
  return best;
}
const shareOf = (ov, gi) => (ov.tot && gi >= 0 ? (ov.shares.get(gi) || 0) / ov.tot : 0);
function bestOf(ov) { let best = -1, bs = 0; ov.shares.forEach((v, gi) => { if (v > bs) { bs = v; best = gi; } }); return best; }
function plainDom(ov, kf) { const b = bestOf(ov); return b >= 0 && shareOf(ov, b) >= DOM_SHARE && kf[b].color ? b : -1; }
const HYST = 1.25, KEEP = 0.25;
function hystDom(ov, kf, prevDom) {
  const b = bestOf(ov);
  if (prevDom !== null && prevDom >= 0) { const sp = shareOf(ov, prevDom); if (sp >= KEEP && kf[prevDom].color && (b === prevDom || shareOf(ov, b) < HYST * sp)) return prevDom; }
  return plainDom(ov, kf);
}
function smoothSide(ov, kf) { let a = [0, 0, 0], w = 0; ov.shares.forEach((v, gi) => { if (!kf[gi].color) return; const x = v / ov.tot; w += x; for (let k = 0; k < 3; k++) a[k] += x * kf[gi].color[k]; }); return w > 0 ? a.map((v) => v / w) : null; }
// h2c (extension, labelled): like h2, but the two sides are weighted by how much of the face they cover: ((1-t) covA cA + t covB cB) / ((1-t) covA + t covB); no side switches on or off
function coverSide(ov, kf) { let w = 0; ov.shares.forEach((v, gi) => { if (kf[gi].color) w += v / ov.tot; }); return w; }
const combineCov = (a, wa, b, wb, t, old) => { const A = (1 - t) * wa, B = t * wb; return A + B > 1e-9 ? [0, 1, 2].map((k) => ((a ? A * a[k] : 0) + (b ? B * b[k] : 0)) / (A + B)) : old; };
const combine = (a, b, t, old) => (a && b ? lin2(a, b, t) : (a || b || old));
// one frame of the variants plain (v3cb attribution), h1 and h2. e = evaluate2 result; prev = { morph, domA, domB } of the step before in the processing order, or null
function hFrame(e, t, prev) {
  const { morph, kfA, kfB } = e, h1 = [], h2 = [], h2c = [], domA = [], domB = [], plainA = [], plainB = [];
  morph.forEach((f, i) => {
    const ovA = overlapShares(f, kfA), ovB = overlapShares(f, kfB), pi = prev ? predOf(prev.morph, f) : null;
    plainA.push(plainDom(ovA, kfA)); plainB.push(plainDom(ovB, kfB));
    const dA = hystDom(ovA, kfA, pi === null ? null : prev.domA[pi]), dB = hystDom(ovB, kfB, pi === null ? null : prev.domB[pi]); domA.push(dA); domB.push(dB);
    const fb1 = combine(dA >= 0 ? kfA[dA].color : null, dB >= 0 ? kfB[dB].color : null, t, f.old);
    const sA = smoothSide(ovA, kfA), sB = smoothSide(ovB, kfB), fb2 = combine(sA, sB, t, f.old), fb2c = combineCov(sA, coverSide(ovA, kfA), sB, coverSide(ovB, kfB), t, f.old);
    const a = e.gA[i].idx, b = e.gB[i].idx, g = e.gx.v3cb[i];
    const pm = a !== null && b !== null && kfA[a].color && kfB[b].color ? lin2(kfA[a].color, kfB[b].color, t) : null;
    h1.push(pm ? [0, 1, 2].map((k) => g * pm[k] + (1 - g) * fb1[k]) : fb1);
    h2.push(pm ? [0, 1, 2].map((k) => g * pm[k] + (1 - g) * fb2[k]) : fb2);
    h2c.push(pm ? [0, 1, 2].map((k) => g * pm[k] + (1 - g) * fb2c[k]) : fb2c);
  });
  return { h1, h2, h2c, domA, domB, plainA, plainB, morph };
}
function chain(frames, ts, order) {   // order: indices in processing order; returns h frames by index
  const out = []; let prev = null;
  order.forEach((k) => { const h = hFrame(frames[k], ts[k], prev); out[k] = h; prev = h; });
  return out;
}
const H_VARIANTS = ['old', 'v3', 'v3cb', 'h1', 'h2', 'h2c'];
function hystRun(key, cfg, step) {
  const nat = setup(cfg), uni = setup(withUniform(cfg));
  const ts = []; for (let k = 0; k * step <= 1 + 1e-9; k++) ts.push(+(k * step).toFixed(4));
  const idx = ts.map((_, k) => k), rev = idx.slice().reverse();
  const out = { key, name: cfg.name, paths: {} };
  ['playback', 'spatial'].forEach((p) => {
    const fr = ts.map((t) => evaluate2(nat, p, t)); const fw = chain(fr, ts, idx), bw = chain(fr, ts, rev);
    const colOf = (v, k, h) => (v === 'h1' ? h[k].h1 : v === 'h2' ? h[k].h2 : v === 'h2c' ? h[k].h2c : fr[k].col[v]);
    const R = {}; H_VARIANTS.forEach((v) => { R[v] = { jumpMax: 0, jumpAt: null, over12: 0, faces: 0, unassign: 0, dMax: 0, dBad: 0, dFaces: 0, sd: 0 }; });
    const attr = { over12: 0, dom: 0, partner: 0, both: 0, none: 0 };
    for (let k = 1; k < ts.length; k++) {
      const P = fr[k - 1], C = fr[k];
      C.morph.forEach((f, i) => {
        const best = predOf(P.morph, f);
        H_VARIANTS.forEach((v) => {
          const r = R[v]; r.faces++; if (best === null) { r.unassign++; return; }
          const j = cdist(colOf(v, k, fw)[i], colOf(v, k - 1, fw)[best]);
          if (j > 12) r.over12++; if (j > r.jumpMax) { r.jumpMax = j; r.jumpAt = ts[k]; r.worst = `Flaeche n=${f.n} A=${f.a.toFixed(0)} (Vorgaenger ${P.morph[best].a.toFixed(0)}), g ${fr[k - 1].gx.v3cb[best].toFixed(2)} -> ${C.gx.v3cb[i].toFixed(2)}, Partner A ${P.gA[best].idx} -> ${C.gA[i].idx}, B ${P.gB[best].idx} -> ${C.gB[i].idx}, dominant A ${fw[k - 1].plainA[best]} -> ${fw[k].plainA[i]}, B ${fw[k - 1].plainB[best]} -> ${fw[k].plainB[i]}, h1 dom A ${fw[k - 1].domA[best]} -> ${fw[k].domA[i]}, B ${fw[k - 1].domB[best]} -> ${fw[k].domB[i]}`; }
          if (v === 'v3cb' && j > 12) {   // attribution: did the dominant polygon (either side) or the partner (either side) change between the steps?
            attr.over12++;
            const dom = fw[k].plainA[i] !== fw[k - 1].plainA[best] || fw[k].plainB[i] !== fw[k - 1].plainB[best];
            const par = C.gA[i].idx !== P.gA[best].idx || C.gB[i].idx !== P.gB[best].idx;
            if (dom && par) attr.both++; else if (dom) attr.dom++; else if (par) attr.partner++; else attr.none++;
          }
        });
      });
    }
    // path dependence of h1 / h2: the colour of the same face at the same t, forward chain against backward chain (byte channel maximum)
    let pdMax = 0, pdN = 0, pdAll = 0; const hd = { h1: 0, h2: 0 };
    ['h1', 'h2'].forEach((v) => ts.forEach((t, k) => fr[k].morph.forEach((f, i) => { const d = cdist(colOf(v, k, fw)[i], colOf(v, k, bw)[i]); if (v === 'h1') { pdAll++; if (d > pdMax) pdMax = d; if (d > 2) pdN++; } hd[v] = Math.max(hd[v], d); })));
    // uniform colours: dLin against the Soll colour (all faces, all t)
    const fu = ts.map((t) => evaluate2(uni, p, t)), hu = chain(fu, ts, idx);
    ts.forEach((t, k) => fu[k].morph.forEach((f, i) => { const soll = sollUniform(f, fu[k].kfA, fu[k].kfB); if (!soll) return;
      H_VARIANTS.forEach((v) => { const c = v === 'h1' ? hu[k].h1[i] : v === 'h2' ? hu[k].h2[i] : v === 'h2c' ? hu[k].h2c[i] : fu[k].col[v][i]; const d = lin2l(c, soll), r = R[v]; r.dFaces++; if (d > r.dMax) r.dMax = d; if (d > 0.02) r.dBad++; }); }));
    // Stern / Raute (case sq): the star and the corner diamonds against their colour
    if (cfg.truth) { const K = nat.kf.playback, tA = { star: K.A.find((f) => role(f, nat.geo) === 'star').color, diamond: K.A.find((f) => role(f, nat.geo) === 'diamond').color };
      ts.forEach((t, k) => fr[k].morph.forEach((f, i) => { const r = role(f, nat.geo); if (!r) return; H_VARIANTS.forEach((v) => { R[v].sd = Math.max(R[v].sd, lin2l(colOf(v, k, fw)[i], tA[r])); }); })); }
    // time per frame (ms) at t = 0.25 / 0.5 / 0.75: matching (both sides) + v3cb colours + h1 + h2, with and without the bounding-box prefilter; against today's sampling (measured in the world)
    const timeOf = (bb) => { BBOX = bb; let nw = 0, od = 0, n = 0;
      [0.25, 0.5, 0.75].forEach((t) => { const { morph, ms } = frame(nat, p, t), pm = frame(nat, p, t - 0.05).morph, kfA = nat.kf[p].A, kfB = nat.kf[p].B;
        for (let r = 0; r < 5; r++) { const t0 = process.hrtime.bigint(); morph.forEach((f) => { f._S = null; }); pm.forEach((f) => { f._S = null; });
          const gA = matchFaces(morph, kfA, 'group'), gB = matchFaces(morph, kfB, 'group'); const x = v3Eval(morph, kfA, kfB, t, gA, gB, { contain: true, fbDom: true });
          hFrame({ morph, kfA, kfB, gA, gB, gx: { v3cb: x.g } }, t, { morph: pm, domA: pm.map(() => -1), domB: pm.map(() => -1) }); nw += Number(process.hrtime.bigint() - t0) / 1e6; od += ms; n++; } });
      BBOX = true; return { nw: nw / n, od: od / n }; };
    const tOn = timeOf(true), tOff = timeOf(false);
    out.paths[p] = { R, attr, pd: { max: pdMax, n: pdN, all: pdAll, h1: hd.h1, h2: hd.h2 }, tOn, tOff, faces: fr.reduce((a, e) => a + e.n, 0) / fr.length };
  });
  return out;
}
function printHyst(o, step) {
  console.log(`\n=== ${o.name} (Schritt ${step}) ===`);
  Object.keys(o.paths).forEach((p) => {
    const r = o.paths[p];
    console.log(`-- Pfad ${p}: Flaechen je Frame ${r.faces.toFixed(1)}`);
    console.log('   Variante | max Sprung (bei t) | Sprünge > 12 / Flaechen | dLin gleiche Farben max (Flaechen > 0.02 von n)' + (r.R.old.sd || r.R.h1.sd ? ' | Stern/Raute dLin max' : ''));
    H_VARIANTS.forEach((v) => { const x = r.R[v]; console.log(`   ${v.padEnd(8)} | ${String(x.jumpMax).padStart(3)} (${fmt(x.jumpAt, 2)}) | ${String(x.over12).padStart(4)} / ${x.faces} | ${x.dMax.toFixed(4)} (${x.dBad} von ${x.dFaces})${x.sd ? ' | ' + x.sd.toFixed(4) : ''}`); });
    if (process.argv.includes('--worst')) H_VARIANTS.forEach((v) => console.log(`   groesster Sprung ${v}: ${r.R[v].worst || '-'}`));
    const a = r.attr; console.log(`   Quelle der v3cb-Spruenge > 12 (${a.over12}): nur dominantes Polygon gewechselt ${a.dom}, nur Partner gewechselt ${a.partner}, beides ${a.both}, keins von beiden ${a.none}`);
    console.log(`   Pfadabhaengigkeit h1 vorwaerts gegen rueckwaerts (gleiche Flaeche, gleiches t): max ${r.pd.max} Byte, ${r.pd.n} von ${r.pd.all} Flaechen > 2 Byte; h2 ${r.pd.h2} Byte (zustandslos)`);
    console.log(`   Zeit je Frame (ms): heutige Abtastung ${r.tOn.od.toFixed(2)}; Zuordnung + v3cb + h1 + h2 mit Bounding-Box ${r.tOn.nw.toFixed(2)}, ohne ${r.tOff.nw.toFixed(2)}`);
  });
}
if (RUN_MAIN && process.argv.includes('--hyst')) {
  NEAR_K = 1.5; const cases = buildCases(); const which = arg('--case', 'all');
  if (process.argv.includes('--fine')) printHyst(hystRun('sq', cases.sq, 0.01), 0.01);
  else Object.keys(cases).filter((k) => which === 'all' || which === k).forEach((k) => printHyst(hystRun(k, cases[k], +arg('--step', '0.05')), +arg('--step', '0.05')));
}


// =============================================================================================================================================================================================
// 032 - the spatial path. `node tools/morph/measure-face-match.js --spatial [--case sq|topoSq|hex|tri|gal|hexK|triK|all] [--step 0.05] [--fine] [--explain]`
//   old   today: spatialMorphRenderFaceColors (the corner-raster sampling)
//   s1    the correspondence of task 031 (core/facecolor.js _faceLinByCorrespondence, run in the render world: the REAL implementation) on the spatial faces; the keyframe faces are those the corner field is
//         built from (border-closed cell, copy of the store); a face nothing lies under keeps the raster colour
//   s2    s1 with the raster colour (old) for faces smaller than a threshold (1 %, 2 %, 5 % of the cell area): s2_1, s2_2, s2_5
//   s3    s1 against the REFERENCE faces at the border (tile faces at weight (1,0) / (0,1), colours from the true faces; 028 point 5)
// --fine: only the Stern/Raute case at step 0.01.  --explain: the worst fine-step jump of s1 in that case, side by side with the raster sampling.
// =============================================================================================================================================================================================
function prodInfos(rig, set, tag) {   // the keyframe fields of a face set as production fields (core/facecolor.js _fieldInfo), kept in the render world
  const mk = (list) => list.map((f) => ({ poly: f.verts, lin: f.color }));
  rig.w.run(`(function(){
    var mkF = function (L) { return L.map(function (e) { var xs = e.poly.map(function (p) { return p.x; }), ys = e.poly.map(function (p) { return p.y; }); return { poly: e.poly, minX: Math.min.apply(null, xs), maxX: Math.max.apply(null, xs), minY: Math.min.apply(null, ys), maxY: Math.max.apply(null, ys), lin: e.lin }; }); };
    var A = mkF(${J(mk(set.A))}), B = mkF(${J(mk(set.B))});
    A.ctr = B.ctr = ${J(rig.geo.ctr)}; A.span = B.span = ${rig.geo.span};
    globalThis.__iA_${tag} = _fieldInfo(A); globalThis.__iB_${tag} = _fieldInfo(B);
  })()`);
}
function prodLins(rig, tag, morph, t, reps) {   // the correspondence colour (linear, or null) of every face; reps > 0: also the mean ms per call
  rig.w.sb.process_hrtime = () => Number(process.hrtime.bigint()) / 1e6;
  return rig.w.run(`(function(){
    var polys = ${J(morph.map((f) => f.verts))}, iA = __iA_${tag}, iB = __iB_${tag};
    var one = function () { var live = polys.map(function (p) { return _faceInfo(p, null); }); _setOrbits(live, iA.ctr, iA.span); return live.map(function (f) { return _faceLinByCorrespondence(f, iA, iB, ${t}); }); };
    var lins = one(), ms = 0, R = ${reps || 0};
    if (R) { var t0 = process_hrtime(); for (var i = 0; i < R; i++) one(); ms = (process_hrtime() - t0) / R; }
    return { lins: lins, ms: ms };
  })()`);
}

// 032: the Soll of the uniform-colour test on the border-closed cell: the colour X only for a face that lies COMPLETELY in polygons of that colour in A and in B (a 10 x 10 grid inside the face, no point in another colour or in no
// polygon). The border-closed cell holds faces of the border that are not X (they get their default fill), and a face that overlaps one a little can legitimately differ from X.
function sollPure(f, kfA, kfB) {
  const pts = []; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { const q = { x: f.bb.x0 + (i + 0.5) / 10 * (f.bb.x1 - f.bb.x0), y: f.bb.y0 + (j + 0.5) / 10 * (f.bb.y1 - f.bb.y0) }; if (inside(q, f.verts)) pts.push(q); }
  if (!pts.length) return null; let c0 = null;
  for (const q of pts) for (const kf of [kfA, kfB]) {
    const g = kf.find((h) => h.color && q.x >= h.bb.x0 && q.x <= h.bb.x1 && q.y >= h.bb.y0 && q.y <= h.bb.y1 && inside(q, h.verts));
    if (!g) return null; if (!c0) c0 = g.color; else if (lin2l(g.color, c0) > 1e-3) return null;
  }
  return c0;
}
// 032: faces below MIN_AREA px^2 (sub-pixel slivers of the dense patterns: area 1 to 5) are left out of the jump and error figures and counted instead (--min-area 0 counts all)
const MIN_AREA = +arg('--min-area', '10');
const S_THR = [0.01, 0.02, 0.05], S_VARS = ['old', 's1', 's2_1', 's2_2', 's2_5', 's3'];
function spatialFrames(rig, ts, withRef) {
  const cell = rig.kf.spatial.A.reduce((a, f) => a + f.a, 0);
  prodInfos(rig, rig.kf.spatial, 'T'); if (withRef) { buildRef(rig); prodInfos(rig, rig.kfRef, 'R'); }
  return ts.map((t) => {
    const fr = frame(rig, 'spatial', t), m = fr.morph, s1l = prodLins(rig, 'T', m, t).lins, s3l = withRef ? prodLins(rig, 'R', m, t).lins : s1l;
    const col = { old: m.map((f) => f.old), s1: m.map((f, i) => s1l[i] || f.old), s3: m.map((f, i) => s3l[i] || f.old) };
    S_THR.forEach((thr, k) => { col['s2_' + [1, 2, 5][k]] = m.map((f, i) => (f.a < thr * cell ? f.old : col.s1[i])); });
    return { morph: m, col, ms: fr.ms, cell };
  });
}
function spatialRun(key, cfg, step) {
  const nat = setup(cfg), uni = setup(withUniform(cfg));
  const ts = []; for (let k = 0; k * step <= 1 + 1e-9; k++) ts.push(+(k * step).toFixed(4));
  const fr = spatialFrames(nat, ts, true), fu = spatialFrames(uni, ts, true);
  const R = {}; S_VARS.forEach((v) => { R[v] = { jumpMax: 0, jumpAt: null, over12: 0, faces: 0, unassign: 0, dMax: 0, dBad: 0, dFaces: 0, sd: 0 }; });
  let slivers = 0;
  for (let k = 1; k < ts.length; k++) fr[k].morph.forEach((f, i) => {
    if (f.a < MIN_AREA) { slivers++; return; }
    const best = predOf(fr[k - 1].morph, f);
    S_VARS.forEach((v) => { const r = R[v]; r.faces++; if (best === null) { r.unassign++; return; } const j = cdist(fr[k].col[v][i], fr[k - 1].col[v][best]); if (j > 12) r.over12++; if (j > r.jumpMax) { r.jumpMax = j; r.jumpAt = ts[k]; } });
  });
  ts.forEach((t, k) => fu[k].morph.forEach((f, i) => { if (f.a < MIN_AREA) return; const soll = sollPure(f, uni.kf.spatial.A, uni.kf.spatial.B); if (!soll) return; S_VARS.forEach((v) => { const d = lin2l(fu[k].col[v][i], soll), r = R[v]; r.dFaces++; if (d > r.dMax) r.dMax = d; if (d > 0.02) r.dBad++; }); }));
  if (cfg.truth) { const K = nat.kf.playback, tA = { star: K.A.find((f) => role(f, nat.geo) === 'star').color, diamond: K.A.find((f) => role(f, nat.geo) === 'diamond').color };
    ts.forEach((t, k) => fr[k].morph.forEach((f, i) => { const r = role(f, nat.geo); if (!r) return; S_VARS.forEach((v) => { R[v].sd = Math.max(R[v].sd, lin2l(fr[k].col[v][i], tA[r])); }); })); }
  // time per frame (ms, Node): the raster sampling (measured in the world) against the correspondence, mean of 10 runs at t = 0.25 / 0.5 / 0.75
  let nw = 0, od = 0, nf = 0, kk = 0;
  [0.25, 0.5, 0.75].forEach((t) => { const f1 = frame(nat, 'spatial', t); const p = prodLins(nat, 'T', f1.morph, t, 10); nw += p.ms; od += f1.ms; nf += f1.morph.length; kk++; });
  return { key, name: cfg.name, R, step, faces: nf / kk, slivers, ms: { nw: nw / kk, od: od / kk } };
}
function printSpatial(o) {
  console.log(`\n=== ${o.name} (Spatial, Schritt ${o.step}; Flaechen je Frame ${o.faces.toFixed(1)}; ${o.slivers} Flaechenschritte < ${MIN_AREA} px^2 nicht gezaehlt) ===`);
  console.log('   Variante | max Sprung (bei t) | Spruenge > 12 / Flaechen | dLin gleiche Farben max (Flaechen > 0.02 von n)' + (o.R.old.sd ? ' | Stern/Raute dLin max' : ''));
  S_VARS.forEach((v) => { const x = o.R[v]; console.log(`   ${v.padEnd(8)} | ${String(x.jumpMax).padStart(3)} (${fmt(x.jumpAt, 2)}) | ${String(x.over12).padStart(4)} / ${x.faces} | ${x.dMax.toFixed(4)} (${x.dBad} von ${x.dFaces})${x.sd ? ' | ' + x.sd.toFixed(4) : ''}`); });
  console.log(`   Zeit je Frame (ms): Rasterabtastung ${o.ms.od.toFixed(2)}, Zuordnung ${o.ms.nw.toFixed(2)}`);
}
// the worst fine-step jump of s1 in the Stern/Raute case, side by side with the raster sampling: the face, the step, the overlap with the polygons of A and of B before and after, and the raster's own side colours
function explainFine(cfg) {
  const rig = setup(cfg), step = 0.01, ts = []; for (let k = 0; k * step <= 1 + 1e-9; k++) ts.push(+(k * step).toFixed(4));
  const fr = spatialFrames(rig, ts, false); let worst = null;
  for (let k = 1; k < ts.length; k++) fr[k].morph.forEach((f, i) => { const b = predOf(fr[k - 1].morph, f); if (b === null) return; const j = cdist(fr[k].col.s1[i], fr[k - 1].col.s1[b]); if (!worst || j > worst.j) worst = { j, k, i, b, jo: cdist(fr[k].col.old[i], fr[k - 1].col.old[b]) }; });
  const hex = (lin) => '#' + lin.map((v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)).toString(16).padStart(2, '0')).join('');
  const side = (kf, f) => { const ov = overlapShares(f, kf); const L = []; ov.shares.forEach((v, gi) => L.push(`#${gi} n=${kf[gi].n} a=${kf[gi].a.toFixed(0)} ${hex(kf[gi].color)} ${(100 * v / ov.tot).toFixed(0)} %`)); return L.join('; ') || 'keine'; };
  const raster = (f, t) => rig.w.run(`(function(){
    var s = spatialMorphFaceSamples(${J(f.verts)}), cf = spatialMorphRenderCornerFields([${rig.idA}, ${rig.idB}, ${rig.idA}, ${rig.idB}], 2, 'linear'), out = [];
    [0, 1].forEach(function (k) { var acc = [0, 0, 0], sum = 0, hits = {}; s.forEach(function (q) { var l = spatialMorphRasterSample(cf[k].raster, q.x, q.y); if (l) { acc[0] += q.w * l[0]; acc[1] += q.w * l[1]; acc[2] += q.w * l[2]; sum += q.w; var h = linearToHex(l); hits[h] = (hits[h] || 0) + q.w; } }); out.push({ mean: sum > 0 ? [acc[0] / sum, acc[1] / sum, acc[2] / sum] : null, sum: sum, hits: hits }); });
    return out; })()`);
  const f1 = fr[worst.k].morph[worst.i], f0 = fr[worst.k - 1].morph[worst.b], t1 = ts[worst.k], t0 = ts[worst.k - 1];
  console.log(`groesster Sprung s1 (Stern/Raute, Spatial, Schritt 0.01): ${worst.j} Byte bei t ${t0} -> ${t1} (Rasterabtastung derselben Flaeche: ${worst.jo})`);
  [[f0, t0], [f1, t1]].forEach(([f, t]) => {
    const r = raster(f, t); const fmtHits = (h) => Object.keys(h).map((x) => `${x} ${(100 * h[x]).toFixed(0)} %`).join(', ');
    console.log(`  t=${t}: Flaeche n=${f.n} A=${f.a.toFixed(0)} Schwerpunkt (${f.c.x.toFixed(0)}, ${f.c.y.toFixed(0)})`);
    console.log(`    A-Polygone unter der Flaeche: ${side(rig.kf.spatial.A, f)}`);
    console.log(`    B-Polygone unter der Flaeche: ${side(rig.kf.spatial.B, f)}`);
    console.log(`    Raster A: Bedeckung ${(100 * r[0].sum).toFixed(0)} %, Treffer ${fmtHits(r[0].hits)}; Raster B: Bedeckung ${(100 * r[1].sum).toFixed(0)} %, Treffer ${fmtHits(r[1].hits)}`);
    const k = f === f0 ? worst.k - 1 : worst.k, i = f === f0 ? worst.b : worst.i;
    console.log(`    Farben: s1 ${hex(fr[k].col.s1[i])}, Raster (heute) ${hex(fr[k].col.old[i])}`);
  });
}

// --bad: the faces of the uniform-colour test (every polygon one colour) whose s1 error exceeds 0.02: why (no coverage -> raster fallback, partial coverage, the partner mix against the leaked neighbours)
function explainBad(key, cfg) {
  const uni = setup(withUniform(cfg)); const ts = []; for (let k = 0; k <= 20; k++) ts.push(+(k * 0.05).toFixed(2));
  const fr = spatialFrames(uni, ts, false); const rows = [];
  fr.forEach((e, k) => e.morph.forEach((f, i) => {
    const soll = sollPure(f, uni.kf.spatial.A, uni.kf.spatial.B); if (!soll) return;
    const d1 = Math.max(lin2l(e.col.s1[i], soll), lin2l(e.col.old[i], soll)); if (d1 <= 0.02) return;
    const ovA = overlapShares(f, uni.kf.spatial.A), ovB = overlapShares(f, uni.kf.spatial.B), cov = (ov) => { let c = 0; ov.shares.forEach((v) => { c += v; }); return ov.tot ? c / ov.tot : 0; };
    const lin = prodLins(uni, 'T', [f], ts[k]).lins[0];
    rows.push({ t: ts[k], n: f.n, a: f.a, d1: lin2l(e.col.s1[i], soll), d0: lin2l(e.col.old[i], soll), covA: cov(ovA), covB: cov(ovB), fb: lin === null });
  }));
  if (rows.length) {   // the first bad face under the production functions: the colours under its samples, its partners and the weight g
    const r0 = rows[0], k0 = ts.indexOf(r0.t), f0 = fr[k0].morph.find((f) => f.n === r0.n && Math.abs(f.a - r0.a) < 1e-6);
    const info = uni.w.run(`(function(){
      var f = _faceInfo(${J(f0.verts)}, null), iA = __iA_T, iB = __iB_T; _setOrbits([f], iA.ctr, iA.span);
      var hx = function (l) { return l ? linearToHex(l) : null; };
      var side = function (info) { var cols = {}; f.samples.forEach(function (p) { var g = _ownerOf(info.grid, p); var h = g ? hx(g.lin) : 'none'; cols[h] = (cols[h] || 0) + 1; }); return cols; };
      var pA = _partnerOf(f, iA), pB = _partnerOf(f, iB);
      return { orb: f.orb, samples: f.samples.length, underA: side(iA), underB: side(iB), pA: pA && { n: pA.n, a: pA.a, col: hx(pA.lin) }, pB: pB && { n: pB.n, a: pB.a, col: hx(pB.lin) } };
    })()`);
    console.log('  first bad face (production functions): ' + J(info));
  }
  console.log(`${key}: ${rows.length} faces with s1 error > 0.02 (of the uniform test); fallback to the raster: ${rows.filter((r) => r.fb).length}`);
  rows.slice(0, 8).forEach((r) => console.log(`  t=${r.t} n=${r.n} area=${r.a.toFixed(0)} s1 ${r.d1.toFixed(4)} raster ${r.d0.toFixed(4)} coverage A ${(100 * r.covA).toFixed(0)} % B ${(100 * r.covB).toFixed(0)} % ${r.fb ? '(no correspondence colour: raster)' : ''}`));
}
if (RUN_MAIN && process.argv.includes('--spatial') && process.argv.includes('--bad')) { const cases = buildCases(true); explainBad(arg('--case', 'hex'), cases[arg('--case', 'hex')]); process.exit(0); }
if (RUN_MAIN && process.argv.includes('--spatial')) {
  const cases = buildCases(true); const which = arg('--case', 'all');
  if (process.argv.includes('--explain')) explainFine(cases.sq);
  else if (process.argv.includes('--fine')) printSpatial(spatialRun('sq', cases.sq, 0.01));
  else Object.keys(cases).filter((k) => which === 'all' || which === k).forEach((k) => printSpatial(spatialRun(k, cases[k], +arg('--step', '0.05'))));
}

module.exports = { mkStarDiamond, setup, buildCases, withUniform, sollUniform, annotate, predOf, role, cdist, lin2l, setNear(k) { NEAR_K = k; } };
