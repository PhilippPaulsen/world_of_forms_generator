#!/usr/bin/env node
// Task 027 - PROTOTYPE of the face correspondence for the morph colour (a measurement, not a test; nothing under core/ or sketch.js is touched).
//   node tools/morph/measure-face-match.js [--case stern|mix|topo|all] [--verbose]
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
const area2 = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return a / 2; };
const centroidOf = (pts) => { let x = 0, y = 0, a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], c = p.x * q.y - q.x * p.y; a += c; x += (p.x + q.x) * c; y += (p.y + q.y) * c; } return a ? { x: x / (3 * a), y: y / (3 * a) } : { x: pts[0].x, y: pts[0].y }; };
const inside = (pt, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { if ((pts[i].y > pt.y) !== (pts[j].y > pt.y) && pt.x < (pts[j].x - pts[i].x) * (pt.y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x) c = !c; } return c; };

// faces: [{ verts: [{x,y}], color?: linear rgb }] -> annotated [{ verts, c, a, n, orb, color }]
function annotate(faces, ctr, span) {
  const out = faces.map((f) => ({ verts: f.verts, c: centroidOf(f.verts), a: Math.abs(area2(f.verts)), n: f.verts.length, color: f.color || null, orb: 1 }));
  out.forEach((f) => { f.r = Math.hypot(f.c.x - ctr.x, f.c.y - ctr.y); });
  out.forEach((f) => { f.orb = out.filter((g) => g.n === f.n && Math.abs(g.a - f.a) <= 1e-3 * f.a && Math.abs(g.r - f.r) <= 1e-3 * span).length; });
  return out;
}
function overlapShares(f, kf) {   // share of the face's samples that lie in each keyframe face (any corner count)
  const S = M.spatialMorphFaceSamples(f.verts), shares = new Map(); let tot = 0;
  S.forEach((q) => { tot += q.w; kf.forEach((g, gi) => { if (inside(q, g.verts)) shares.set(gi, (shares.get(gi) || 0) + q.w); }); });
  return { shares, tot };
}
// morph, kf: annotated lists -> [{ idx, status, passed }] parallel to morph
function matchFaces(morph, kf) {
  const res = morph.map((f) => {
    const passed = [];
    kf.forEach((g, gi) => {
      if (g.n !== f.n || g.orb !== f.orb) return;
      const q = f.a / g.a; if (q > RATIO || q < 1 / RATIO) return;
      if (!inside(f.c, g.verts) && !inside(g.c, f.verts)) return;
      passed.push({ gi, d: Math.hypot(f.c.x - g.c.x, f.c.y - g.c.y) });
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
  const w = makeRenderWorld('square', cfg.n, 3, 'rotation_reflection6');
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
  const rig = { w, cfg, idA, idB, pbId, geo, status, kf: { playback: { A: annotate(kf(idA), geo.ctr, geo.span), B: annotate(kf(idB), geo.ctr, geo.span) }, spatial: { A: annotate(kfBorder(idA), geo.ctr, geo.span), B: annotate(kfBorder(idB), geo.ctr, geo.span) } } };
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
  const morph = annotate(r.faces.map((f) => ({ verts: f.verts })), rig.geo.ctr, rig.geo.span);
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

const which = arg('--case', 'all');
const keys = which === 'all' ? Object.keys(CASES) : [which];
const rigs = {};
keys.forEach((k) => { rigs[k] = runCase(k); });
console.log('\n=== Spruenge zwischen t und t+0.05 (matchTile-Kriterien), je Flaeche; neu = Partnermischung mit Fallback, alt = heutige Ortsabtastung ===');
console.log('Fall | Pfad | Flaechen (Schritte x Flaechen) | nicht zuordenbar | max Sprung neu (bei t) | max alt (bei t) | >12 neu | >12 alt | Wechsel Partner<->Fallback | nur Partnerflaechen (Schritte x Fl.): max neu (bei t) / max alt');
keys.forEach((k) => { ['playback', 'spatial'].forEach((p) => { if (k === 'topo2' && p === 'spatial') return; const r = jumps(rigs[k], p, 0.05); console.log(`${k} | ${p} | ${r.faces} | ${r.unassignable} | ${r.newMax} (${r.newWorst}) | ${r.oldMax} (${r.oldWorst}) | ${r.newOver12} | ${r.oldOver12} | ${r.switches} | ${r.pFaces}: ${r.pNew} (${r.pNewWorst}) / ${r.pOld}`); }); });
console.log('\n=== Rechenzeit je Frame (ms, Node, Mittel von 20 Laeufen): Zuordnung+Mischung (neu) gegen heutige Ortsabtastung (alt) ===');
keys.forEach((k) => { ['playback', 'spatial'].forEach((p) => { if (k === 'topo2' && p === 'spatial') return; const t = timing(rigs[k], p); console.log(`${k} | ${p} | ` + Object.keys(t).map((x) => `t=${x}: ${t[x].faces} Fl. neu ${t[x].matchMs.toFixed(2)} / alt ${t[x].oldMs.toFixed(2)}`).join(' | ')); }); });
