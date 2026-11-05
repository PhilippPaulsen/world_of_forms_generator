// Morph stage d2c: the frame against the PROTOTYPE'S frame, and the dangling-ends metric.
//   WHY (the regression report of 2026-11-05): stage d2b's rule "commonEdge" made every endpoint whose keyframe positions do not lie on ONE common outer edge an interior endpoint; the two tiles that meet at a seam then
//   drew different points and the lines of a pattern ended in mid-air (30.5 % of the line ends on the maintainer's pattern), while both keyframes were seamless. The measures of d2b (M1c, M2c) could not see it: they only
//   ask about endpoint pairs that coincide in BOTH keyframes, and here the partners change between the keyframes. This test compares with what the prototype draws and counts the loose ends directly.
//   1. THE SCREENSHOT CANDIDATES (tools/morph/data/prototype-candidates.json): base triangle, 3 nodes, size 5, rotation_reflection6, canvas 560; K0 = the line [2,3] (the middle line), K1 = the altitude [1,5] (A) or
//      [3,4] (B); linear 0 / 45 / 90, radial, bilinear. The golden numbers are the segments the PROTOTYPE draws (recorded once from its code: x1 y1 x2 y2 of every segment that touches the canvas, in micro-pixels);
//      the test needs no prototype tree. Our static frame must equal them within 1e-6 px, and so must the front path at p = 0.5 with the angle + 180 (the front at p = 0.5 is the static blend turned round).
//   2. THE DANGLING-ENDS METRIC: the number of line ends inside the canvas (1 px inset) that meet no other line end (within 1e-3 px) of ANOTHER segment of the same frame. A loose end is where a line stops in mid-air.
//      On the candidates and on the 40 pairs of the d2 data set (tools/morph/data/prototype-dataset.json: corpus patterns of hex, square and triangle, K1 by a closed deformation (i), an edge change (iii) or
//      another pattern (iv)), for linear 0 / 45 / 90, radial and bilinear: ours must not have MORE loose ends than the prototype's static blend (its values are stored: the keyframes of some pairs have loose ends of
//      their own), static and, for linear and radial, on the front path at p = 0.25 / 0.5 / 0.75. The prototype has no progress: its values for the front frames come from ITS code fed with our front weight
//      (its weight function replaced by the front's, everything else unchanged), recorded once.
//   3. THE METRIC ITSELF has a positive control (a frame with known loose ends).
//   node tools/morph/test-spatial-morph-prototype.js
//   SPATIAL_MORPH_JS=... SPATIAL_MORPH_RENDER_JS=... node tools/morph/test-spatial-morph-prototype.js        (sabotage runs)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { makeRenderWorld } = require('./render-harness.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 400)); } };
const J = (x) => JSON.stringify(x);
const DATA = process.env.PROTOTYPE_DATA_DIR || path.join(__dirname, 'data');
const rd = (f) => fs.readFileSync(path.join(DATA, f));
const SHA = { 'prototype-candidates.json': '6610fee8ba5b473d61f8b3e272e23bc0833d0f27ce07d22865e403d0ca9c221c', 'prototype-dataset.json': 'e12e1202b0b1a85dd701faddc874be4ac6463b525441fe25b914a168fcfba826' };

// ---- a frame = the segments the real drawTessellation() draws (straight curve style: every call is a line) ----
const segs = (calls) => calls.map((c) => ({ x1: c[1], y1: c[2], x2: c[3], y2: c[4] }));
const visible = (S, W) => S.filter((s) => !(Math.max(s.x1, s.x2) < -5 || Math.min(s.x1, s.x2) > W + 5 || Math.max(s.y1, s.y2) < -5 || Math.min(s.y1, s.y2) > W + 5));   // touches the canvas (5 px margin)
// the dangling-ends metric (see the header)
function dangling(S, W) {
  const pts = []; S.forEach((s, k) => { pts.push({ x: s.x1, y: s.y1, k }, { x: s.x2, y: s.y2, k }); });
  const cell = (x) => Math.floor(x / 0.002), g = new Map();
  pts.forEach((p, i) => { const key = cell(p.x) + ',' + cell(p.y); (g.get(key) || g.set(key, []).get(key)).push(i); });
  let n = 0, inside = 0;
  pts.forEach((p, i) => {
    if (p.x < 1 || p.x > W - 1 || p.y < 1 || p.y > W - 1) return;
    inside++;
    let has = false; const cx = cell(p.x), cy = cell(p.y);
    for (let dx = -1; dx <= 1 && !has; dx++) for (let dy = -1; dy <= 1 && !has; dy++) for (const j of g.get((cx + dx) + ',' + (cy + dy)) || []) if (j !== i && pts[j].k !== p.k && Math.hypot(pts[j].x - p.x, pts[j].y - p.y) <= 1e-3) { has = true; break; }
    if (!has) n++;
  });
  return { n, inside };
}
// the multiset distance between two segment lists (order and direction of a segment do not matter): the number of segments of A that have no partner within tol in B, and the largest distance of those
function matchFrames(A, B, tol) {
  const cell = 1, key = (s) => Math.floor((s.x1 + s.x2) / 2 / cell) + ',' + Math.floor((s.y1 + s.y2) / 2 / cell), grid = new Map();
  B.forEach((s, i) => { const k = key(s); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  const used = new Uint8Array(B.length), d = (a, b) => Math.min(Math.max(Math.hypot(a.x1 - b.x1, a.y1 - b.y1), Math.hypot(a.x2 - b.x2, a.y2 - b.y2)), Math.max(Math.hypot(a.x1 - b.x2, a.y1 - b.y2), Math.hypot(a.x2 - b.x1, a.y2 - b.y1)));
  let bad = 0, worst = 0;
  const rest = [];
  A.forEach((a, ia) => {
    const mx = Math.floor((a.x1 + a.x2) / 2 / cell), my = Math.floor((a.y1 + a.y2) / 2 / cell); let best = -1, bd = Infinity;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (const j of grid.get((mx + dx) + ',' + (my + dy)) || []) { if (used[j]) continue; const v = d(a, B[j]); if (v < bd) { bd = v; best = j; } }
    if (best >= 0 && bd <= tol) used[best] = 1; else rest.push(ia);
  });
  rest.forEach((ia) => { let bd = Infinity, best = -1; for (let j = 0; j < B.length; j++) { if (used[j]) continue; const v = d(A[ia], B[j]); if (v < bd) { bd = v; best = j; } } bad++; if (best >= 0) { used[best] = 1; if (bd > worst) worst = bd; } else worst = Infinity; });
  const unmatchedB = used.reduce((s, u) => s + (u ? 0 : 1), 0);
  return { bad, worst, unmatchedB };
}
const fromFlat = (flat) => { const o = []; for (let i = 0; i < flat.length; i += 4) o.push({ x1: flat[i] / 1e6, y1: flat[i + 1] / 1e6, x2: flat[i + 2] / 1e6, y2: flat[i + 3] / 1e6 }); return o; };

// ---- worlds ----
function addKeyframe(w, k) {
  if (k.conns) return w.addKeyframeLayer(k.conns);
  const nodes = [], conns = []; k.lines.forEach((l, i) => { nodes.push({ id: 2 * i + 1, x: l.x1, y: l.y1 }, { id: 2 * i + 2, x: l.x2, y: l.y2 }); conns.push([2 * i + 1, 2 * i + 2]); });
  const id = w.addKeyframeLayer(conns); w.set(`additionalLayers[${id}].nodes = ${J(nodes)};`); return id;
}
function world(s) {   // s: { shape, order, size, sym, canvas (0 = the harness' 600), k0, k1 }
  const w = makeRenderWorld(s.shape, s.order, s.size, s.sym);
  if (s.canvas) w.set(`canvasW = ${s.canvas}; canvasH = ${s.canvas}; rebuildGrid(currentShape);`);
  w.baseConnections([]);
  const ids = [addKeyframe(w, s.k0), addKeyframe(w, s.k1)];
  return { w, ids, W: s.canvas || 600 };
}
const MODES = [['linear', 0], ['linear', 45], ['linear', 90], ['radial', 0], ['bilinear', 0]];
const staticFrame = (x, mode, ang) => { x.w.set('timeline = null;'); x.w.setMorph({ enabled: true, mode, angleDeg: ang }); return segs(x.w.drawn()); };
const frontFrame = (x, mode, ang, p) => { x.w.setTimeline(x.ids); x.w.set(`timeline.elapsedMs = ${p * 2000};`); x.w.setMorph({ enabled: true, mode, angleDeg: ang }); return segs(x.w.drawn()); };

// ================= 0. the data =================
let CAND = null, SET = null;
T('data', () => {
  const sha = (f) => crypto.createHash('sha256').update(rd(f)).digest('hex');
  CAND = JSON.parse(rd('prototype-candidates.json')); SET = JSON.parse(rd('prototype-dataset.json'));
  check('the two data files are the recorded ones (sha256 pinned: a golden number cannot be changed without this check failing)', (sha('prototype-candidates.json') === SHA['prototype-candidates.json'] && sha('prototype-dataset.json') === SHA['prototype-dataset.json']) || process.env.PROTOTYPE_DATA_DIR !== undefined, sha('prototype-candidates.json').slice(0, 12) + ' ' + sha('prototype-dataset.json').slice(0, 12));
  const nums = CAND.cases.reduce((n, c) => n + Object.values(c.frames).reduce((m, f) => m + f.flat.length, 0), 0);
  check(`the candidates: ${CAND.cases.length} patterns x ${Object.keys(CAND.cases[0].frames).length} modes = ${CAND.cases.length * 5} prototype frames, ${nums} golden numbers; the data set: ${SET.specs.length} pairs (closed deformation ${SET.specs.filter((s) => s.kcase === 'i').length}, edge change ${SET.specs.filter((s) => s.kcase === 'iii').length}, other pattern ${SET.specs.filter((s) => s.kcase === 'iv').length}) with ${SET.specs.length * 5} prototype counts`, CAND.cases.length === 2 && nums > 10000 && SET.specs.length === 40);
});

// ================= 1. the candidates: equal to the prototype =================
console.log('\n== 1. the screenshot candidates: our frame equals the prototype\'s segments (1e-6 px) ==');
let compared = 0;
const dangCand = [];
T('candidates', () => {
  for (const c of CAND.cases) {
    const x = world({ shape: c.shape, order: c.order, size: c.size, sym: c.sym, canvas: c.canvas, k0: { conns: c.k0 }, k1: { conns: c.k1 } });
    for (const [mode, ang] of MODES) {
      const gold = fromFlat(c.frames[mode + ang].flat);
      const ours = visible(staticFrame(x, mode, ang), c.canvas), m = matchFrames(ours, gold, 1e-6);
      compared += gold.length * 4;
      check(`${c.id} ${mode} ${ang}: static frame = the prototype's ${gold.length} segments touching the canvas (${gold.length * 4} numbers) within 1e-6 px`, m.bad === 0 && m.unmatchedB === 0 && ours.length === gold.length, J([ours.length, gold.length, m.bad, m.unmatchedB, m.worst === Infinity ? 'inf' : +m.worst.toFixed(3)]));
      if (mode === 'linear') {
        const front = visible(frontFrame(x, mode, (ang + 180) % 360, 0.5), c.canvas), mf = matchFrames(front, gold, 1e-6);
        compared += gold.length * 4;
        check(`${c.id} linear ${ang}: the FRONT at p = 0.5 and the angle ${(ang + 180) % 360} is the same blend (the prototype's numbers again)`, mf.bad === 0 && mf.unmatchedB === 0 && front.length === gold.length, J([front.length, mf.bad, mf.unmatchedB]));
      }
    }
  }
  console.log(`      ${compared} golden numbers compared in all`);
});

// ================= 2. the dangling ends =================
console.log('\n== 2. dangling ends: ours <= the prototype\'s value, in every frame ==');
const PS = [0.25, 0.5, 0.75];
T('candidates dangling', () => {
  let frames = 0, worse = [];
  for (const c of CAND.cases) {
    const x = world({ shape: c.shape, order: c.order, size: c.size, sym: c.sym, canvas: c.canvas, k0: { conns: c.k0 }, k1: { conns: c.k1 } });
    for (const [mode, ang] of MODES) {
      const G = c.frames[mode + ang];
      const list = [['static', staticFrame(x, mode, ang), G.dangling]].concat(mode === 'bilinear' ? [] : PS.map((p) => ['front p=' + p, frontFrame(x, mode, ang, p), G.front[p]]));
      for (const [lab, fr, bound] of list) { const d = dangling(fr, c.canvas); frames++; dangCand.push(d.n); if (d.n > bound) worse.push(`${c.id} ${mode}${ang} ${lab}: ${d.n} > ${bound}`); }
    }
  }
  check(`the candidates: ${frames} frames (static and front p = 0.25 / 0.5 / 0.75, five modes): no frame has more loose ends than the prototype's (${CAND.cases[0].frames.linear0.dangling} on both candidates; ours: most ${Math.max(...dangCand)}, total ${dangCand.reduce((a, b) => a + b, 0)})`, frames === 2 * (5 + 4 * 3) && worse.length === 0, worse.slice(0, 4).join(' | '));
});
T('data set dangling', () => {
  let frames = 0, worse = [], total = 0, bounds = 0;
  for (const s of SET.specs) {
    const x = world({ shape: s.shape, order: s.order, size: s.size, sym: s.sym, canvas: 0, k0: s.k0, k1: s.k1 });
    for (const [mode, ang] of MODES) {
      const list = [['static', staticFrame(x, mode, ang), s.proto[mode + ang]]].concat(mode === 'bilinear' ? [] : PS.map((p) => ['front p=' + p, frontFrame(x, mode, ang, p), s.proto[mode + ang + '@' + p]]));
      for (const [lab, fr, bound] of list) { const d = dangling(fr, 600); frames++; total += d.n; bounds += bound; if (d.n > bound) worse.push(`${s.id} ${mode}${ang} ${lab}: ${d.n} > ${bound}`); }
    }
  }
  check(`the data set: ${SET.specs.length} pairs x (5 static + 4 modes x 3 progress values) = ${frames} frames: ours has at most the prototype's loose ends in EVERY frame (ours ${total} in all, the prototype's bounds ${bounds}); ${worse.length} frames are worse`, frames === 40 * 17 && worse.length === 0, worse.slice(0, 4).join(' | '));
});

// ================= 3. the metric has a positive control =================
console.log('\n== 3. the metric ==');
T('metric', () => {
  const S = [{ x1: 10, y1: 10, x2: 50, y2: 10 }, { x1: 50, y1: 10, x2: 50, y2: 60 }, { x1: 100, y1: 100, x2: 120, y2: 130 }];
  check('a chain of two segments and a stray one: the two outer ends of the chain and the two ends of the stray segment are loose (4), the joint (two ends of different segments at 50, 10) is not', dangling(S, 200).n === 4 && dangling(S, 200).inside === 6);
  check('an end within 1e-3 px of another segment\'s end meets it, one 0.01 px away does not; an end outside the 1 px inset is not counted; two ends of the SAME segment never meet each other', dangling([{ x1: 10, y1: 10, x2: 50, y2: 10 }, { x1: 50.0005, y1: 10, x2: 50, y2: 60 }], 200).n === 2 && dangling([{ x1: 10, y1: 10, x2: 50, y2: 10 }, { x1: 50.01, y1: 10, x2: 50, y2: 60 }], 200).n === 4 && dangling([{ x1: 0.5, y1: 0.5, x2: 3, y2: 3 }], 200).n === 1 && dangling([{ x1: 5, y1: 5, x2: 5, y2: 5 }], 200).n === 2);
});

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
