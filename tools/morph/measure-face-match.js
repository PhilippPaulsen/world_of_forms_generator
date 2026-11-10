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

// ---------------------------------------------------------------------------------------------------------------- the prototype (pure)
const RATIO = 8, DOM = 1.5;
let NEAR_K = 0;   // 028 stage 1b: > 0 = a candidate also passes when the centroid distance is within NEAR_K * sqrt(larger area) (centroid nearness instead of inclusion only)
const area2 = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return a / 2; };
const centroidOf = (pts) => { let x = 0, y = 0, a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], c = p.x * q.y - q.x * p.y; a += c; x += (p.x + q.x) * c; y += (p.y + q.y) * c; } return a ? { x: x / (3 * a), y: y / (3 * a) } : { x: pts[0].x, y: pts[0].y }; };
const inside = (pt, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { if ((pts[i].y > pt.y) !== (pts[j].y > pt.y) && pt.x < (pts[j].x - pts[i].x) * (pt.y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x) c = !c; } return c; };

// faces: [{ verts: [{x,y}], color?: linear rgb }] -> annotated [{ verts, c, a, n, orb, color }]
function annotate(faces, ctr, span, ops) {
  const out = faces.map((f) => ({ verts: f.verts, c: centroidOf(f.verts), a: Math.abs(area2(f.verts)), n: f.verts.length, color: f.color || null, orb: 1 }));
  out.forEach((f) => { f.r = Math.hypot(f.c.x - ctr.x, f.c.y - ctr.y); });
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
function overlapShares(f, kf) {   // share of the face's samples that lie in each keyframe face (any corner count)
  const S = M.spatialMorphFaceSamples(f.verts), shares = new Map(); let tot = 0;
  S.forEach((q) => { tot += q.w; kf.forEach((g, gi) => { if (inside(q, g.verts)) shares.set(gi, (shares.get(gi) || 0) + q.w); }); });
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
      if (!inside(f.c, g.verts) && !inside(g.c, f.verts) && !(NEAR_K > 0 && dd <= NEAR_K * Math.sqrt(Math.max(f.a, g.a)))) return;
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
      var t0 = process_hrtime(); var colors = playbackCrossfadeColors(res); var ms = process_hrtime() - t0;
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

if (!['--stages', '--edge', '--explain'].some((a) => process.argv.includes(a))) {
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
const VARIANTS = ['old', 'v027', 'v1', 'v2a', 'v2b', 'v2ab'];
const lin2 = (a, b, k) => [0, 1, 2].map((i) => (1 - k) * a[i] + k * b[i]);
function dominantColour(f, kf) {
  const { shares, tot } = overlapShares(f, kf); let best = -1, bs = 0;
  shares.forEach((v, gi) => { if (v > bs) { bs = v; best = gi; } });
  return best >= 0 && tot > 0 && bs / tot >= DOM_SHARE && kf[best].color ? kf[best].color : null;
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
  const uniq = (m1, m2) => count(m1, (m, i) => u(m) && u(m2[i]));
  return { morph, kfA, kfB, col, via, n: morph.length, bothPoly: uniq(pA, pB), bothGroup: uniq(gA, gB), gA, gB, pA, pB };
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
function buildCases() {
  const hexP = randomPair('hex', 3, 'rotation_reflection6', 1, 5), triP = randomPair('triangle', 5, 'rotation_reflection3', 1, 5), gal = galleryPair('square', 4, 'D4', 'rotation_reflection6');
  return {
    sq: { name: 'Quadrat N=4 D4 (026): [[1,12]] -> [[1,8]] (Stern violett, Raute gelb)', n: 4, connsA: [[1, 12]], connsB: [[1, 8]], colourA: mkStarDiamond(12, 0), colourB: mkStarDiamond(12, 0), truth: true },
    topoSq: { name: 'Quadrat, Aufspaltung: [[1,7]] (5 Fl.) -> [[1,12]] (17 Fl.)', n: 4, connsA: [[1, 7]], connsB: [[1, 12]], colourA: RAINBOW, colourB: RAINBOW_B },
    hex: { name: 'Hexagon N=3 D6 (jumps-Paar hex-typical, 5 Linien, Seed 1)', shape: 'hex', n: 3, sym: 'rotation_reflection6', connsA: hexP.A, connsB: hexP.B, colourA: RAINBOW, colourB: RAINBOW_B },
    tri: { name: 'Dreieck N=5 D3 (jumps-Paar tri-typical, 5 Linien, Seed 1)', shape: 'triangle', n: 5, sym: 'rotation_reflection3', connsA: triP.A, connsB: triP.B, colourA: RAINBOW, colourB: RAINBOW_B },
    gal: { name: 'Galerie Quadrat 4 D4: ' + gal.name, n: 4, connsA: gal.A, connsB: gal.B, colourA: RAINBOW, colourB: RAINBOW_B }
  };
}
const withUniform = (cfg) => Object.assign({}, cfg, { colourA: UNIFORM, colourB: UNIFORM, truth: false });
// Soll of the uniform test: the colour every overlapped keyframe face has, if all of them have the same one on both sides (else undefined: the face is left out)
function sollUniform(f, kfA, kfB) {
  const cs = []; [kfA, kfB].forEach((kf) => { const { shares } = overlapShares(f, kf); shares.forEach((v, gi) => cs.push(kf[gi].color)); });
  if (!cs.length) return null; const c0 = cs[0]; return cs.every((c) => lin2l(c, c0) < 1e-3) ? c0 : null;
}

function stageRun(key, cfg) {
  const out = { key, name: cfg.name, paths: {} };
  const nat = setup(cfg), uni = setup(withUniform(cfg));
  const paths = ['playback', 'spatial'];
  paths.forEach((p) => {
    const row = {}; VARIANTS.forEach((v) => { row[v] = { jumpMax: 0, jumpAt: null, over12: 0, jumpFaces: 0, unassign: 0, switches: 0, dMax: 0, dFaces: 0, dBad: 0, pJump: 0 }; });
    let uniqShareP = 0, uniqShareG = 0, nFaces = 0, nFrames = 0, bothP = 0, bothG = 0;
    // jumps: natural colours, step 0.05
    const frames = TGRID.map((t) => evaluate2(nat, p, t));
    frames.forEach((e) => { bothP += e.bothPoly; bothG += e.bothGroup; nFaces += e.n; });
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
    VARIANTS.forEach((v) => { const x = r[v]; console.log(`   ${v.padEnd(8)} | ${String(x.jumpMax).padStart(3)} (${fmt(x.jumpAt, 2)}) | ${String(x.over12).padStart(4)} / ${x.jumpFaces} | ${String(x.switches).padStart(4)} | ${String(x.unassign).padStart(4)} | ${x.dMax.toFixed(4)} (${x.dBad} von ${x.dFaces})${r.sd ? ' | ' + r.sd[v].toFixed(4) : ''}`); });
  });
}
if (process.argv.includes('--stages')) {
  const cases = buildCases(); const which = arg('--case', 'all');
  [0, +arg('--near', '1.5')].forEach((K) => { NEAR_K = K; console.log(`\n######## Zuordnungskriterium: ${K ? 'Schwerpunkt-Einschluss ODER Naehe <= ' + K + ' x sqrt(Flaeche) (Stufe 1b)' : 'Schwerpunkt-Einschluss (wie 027)'} ########`);
    Object.keys(cases).filter((k) => which === 'all' || which === k).forEach((k) => printStage(stageRun(k, cases[k]))); });
}

// --explain: why a morph face finds no unique partner. For one case and path, at the given t, per face and side the FIRST criterion that rejects the nearest same-corner-count candidate
// (orbit size by group, area ratio, centroid inclusion) or "no candidate with this corner count".
if (process.argv.includes('--explain')) {
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
if (process.argv.includes('--edge')) {
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
