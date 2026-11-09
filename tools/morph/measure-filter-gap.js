// Task 020 (measurement, no fix): does the "only conclusive pairings" filter keep pairings whose INTERMEDIATE frames have loose line ends or open seams?
// The case: square, order 4, symmetry mode rotation_reflection6 (catalog token D4), start = orbits 11 + 19, end = orbits 5 + 11 (gallery/manifest.jsonl: square/4/k2/D4/11+19 and 5+11); the two keyframe layers
// are made from the REAL orbit table (computeThemeLineOrbitTable: orbit id -> its first line pair, as sketch.js resolveCatalogPatternConnections does).
// For EVERY pairing (perm x flips x members of the group, all 8 elements per End line) it reports
//   - the filter verdict, asked the way the editor asks it: the sketch.js helpers timelineConclusiveContext / timelineConclusiveView, cut out of the real file (opts.poly = the start layer's outerCorners),
//   - at t = 0, 0.1, 0.25, 0.5, 0.75, 0.9, 1 the loose ends (`dangling`, the function of tools/morph/test-spatial-morph-prototype.js, copied verbatim) and the open seams (a boundary end of an inner tile
//     without a partner of another tile copy at the same world point, as tools/morph/seam-data.js frameSeamOpen counts it) of the frame the morph really draws (the real render hook: drawTessellation()).
// Reads only; nothing in the repo is written.
//   node tools/morph/measure-filter-gap.js [--mode linear:0] [--json out.json] [--top 12]
//   MEASURE_MODES="linear:0,radial:0" node tools/morph/measure-filter-gap.js      (extra modes for the offending candidates only)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
const D = require('./seam-data.js');
const M = D.M;

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const MODE = (arg('mode', 'linear:0')).split(':'), JSON_OUT = arg('json', null), TOP = +arg('top', 12);
const EXTRA = (process.env.MEASURE_MODES || '').split(',').filter(Boolean).map((s) => s.split(':'));
const TS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
const A_ORBITS = [11, 19], B_ORBITS = [5, 11];

// the dangling-ends metric: verbatim from tools/morph/test-spatial-morph-prototype.js
function dangling(S, W) {
  const pts = []; S.forEach((s, k) => { pts.push({ x: s.x1, y: s.y1, k }, { x: s.x2, y: s.y2, k }); });
  const cell = (x) => Math.floor(x / 0.002), g = new Map();
  pts.forEach((p, i) => { const key = cell(p.x) + ',' + cell(p.y); (g.get(key) || g.set(key, []).get(key)).push(i); });
  let n = 0, inside = 0; const loose = [];
  pts.forEach((p, i) => {
    if (p.x < 1 || p.x > W - 1 || p.y < 1 || p.y > W - 1) return;
    inside++;
    let has = false; const cx = cell(p.x), cy = cell(p.y);
    for (let dx = -1; dx <= 1 && !has; dx++) for (let dy = -1; dy <= 1 && !has; dy++) for (const j of g.get((cx + dx) + ',' + (cy + dy)) || []) if (j !== i && pts[j].k !== p.k && Math.hypot(pts[j].x - p.x, pts[j].y - p.y) <= 1e-3) { has = true; break; }
    if (!has) { n++; loose.push(p); }
  });
  return { n, inside, loose };
}

// ---- the world ----
const w = makeRenderWorld('square', 4, 3, 'rotation_reflection6');
w.baseConnections([]);
const table = w.get("computeThemeLineOrbitTable('rotation_reflection6')");
const pairOf = (id) => table.orbits[id].pairs[0];
const idA = w.addKeyframeLayer(A_ORBITS.map(pairOf)), idB = w.addKeyframeLayer(B_ORBITS.map(pairOf));
w.setTimeline([idA, idB]);
const W = w.get('canvasW');
const groupOrder = w.get('layerGroupElements(additionalLayers[' + idB + '])').groupOrder;
// the editor's own helpers, cut out of the real sketch.js
const SK = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const cut = (name) => { const m = SK.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('not in sketch.js: ' + name); return m[0]; };
['timelineEnrichPairingCandidates', 'timelineConclusiveContext', 'timelineConclusiveFree', 'timelineConclusiveView'].forEach((n) => w.set(cut(n)));

// tiles, for the seam count
const tiles = w.get('spatialMorphRenderRecordTiles()'), outer = w.get('outerCorners'), centroid = w.get('centroid');
const polys = tiles.map((t) => w.get(`outerCorners.map(p => toTileLocal(p, ${JSON.stringify(t.c)}, ${t.flip}, ${t.rot}))`));
const Rr = Math.max(...outer.map((p) => D.dist(p, centroid))), nbr = tiles.map(() => new Set());
for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
  if (D.dist(tiles[i].c, tiles[j].c) > 2 * Rr + 1e-6) continue;
  if (polys[i].filter((p) => polys[j].some((q) => D.dist(p, q) < 1e-6)).length === 2) { nbr[i].add(j); nbr[j].add(i); }
}
function seamGaps(f) {   // boundary ends of inner tiles with no partner of another tile copy at the same world point
  const spt = f.length / tiles.length, P = D.pairsOf(f, spt, 1e-6), has = new Set();
  P.cross.forEach(([a, b]) => { has.add(a); has.add(b); });
  let need = 0, ok = 0; const open = [];
  P.pts.forEach((p, i) => { const t = Math.floor(p.k / spt); if (nbr[t].size !== outer.length) return; if (!M.spatialMorphOnEdge({ x: p.x, y: p.y }, polys[t], 1e-6)) return; need++; if (has.has(i)) ok++; else open.push({ x: p.x, y: p.y, tile: t }); });
  return { gaps: need - ok, need, open };
}

// ---- the candidates ----
const perms = [[0, 1], [1, 0]], flipsAll = [[false, false], [false, true], [true, false], [true, true]];
const cands = [];
for (const perm of perms) for (const flips of flipsAll) for (let g0 = 0; g0 < groupOrder; g0++) for (let g1 = 0; g1 < groupOrder; g1++) cands.push({ perm, flips, members: [g0, g1] });
const setPairing = (c) => w.set(`timeline.segmentPairings[0] = ${JSON.stringify(c.perm)}; timeline.segmentFlips[0] = ${JSON.stringify(c.flips)}; timeline.segmentMembers[0] = ${JSON.stringify(c.members)};`);
const frameAt = (t) => { w.set(`timeline.elapsedMs = ${t * 2000};`); return w.frame(); };
const sig = (f) => f.map((s) => [s.x1, s.y1, s.x2, s.y2].map((v) => Math.round(v * 1e3)).join(',')).sort().join(';');

function measure(c, mode) {
  setPairing(c);
  w.setMorph({ enabled: true, mode: mode[0], angleDeg: +mode[1] });
  const per = TS.map((t) => { const f = frameAt(t), d = dangling(f, W), s = seamGaps(f); return { t, dangling: d.n, gaps: s.gaps, loose: d.loose, open: s.open }; });
  return per;
}
function verdict(c) {   // the editor's question for ONE candidate, plus the score it sees
  setPairing(c);
  w.set(`CAND = { n: 2, orientation: false, items: ${JSON.stringify([c])} };`);
  const v = w.get('timelineConclusiveView(CAND, true, timelineConclusiveContext(0))');
  const s = w.get(`(function () { const x = timelineConclusiveContext(0); return spatialMorphScorePairing(x.layerA, x.layerB, CAND.items[0].perm, CAND.items[0].flips, CAND.items[0].members, { poly: x.poly, groupElements: x.groupElements }); })()`);
  return { state: v.state, keep: v.state === 'ok' && v.items.length === 1, score: { dangling: s.dangling, nodeMiss: s.nodeMiss, boundaryMiss: s.boundaryMiss, dist: s.dist } };
}


// PROPOSAL (measured here, not implemented in core/): the same score on the SYMMETRY-CLOSED line set. The editor's score sees only the lines the layer stores (the base cell); the drawn pattern also has the
// images of every line under the group (core/orbits.js group elements: perms[g] maps node ids to node ids), and a node shared by two lines only through such images is invisible to it. Here every base line and
// its paired End line are replaced by their images under all group elements (same element on both sides: the morph applies the op to the blended line), and spatialMorphScorePairing scores the two aligned lists.
const GE = w.get('layerGroupElements(additionalLayers[' + idB + '])');
const nodeIndex = (id) => new Map(w.get('additionalLayers[' + id + '].nodes').map((n) => [n.id, n]));
const lineIds = (id, conns) => conns.filter((c) => c.length === 2);
function closedScore(c, opts) {
  const x = w.get('timelineConclusiveContext(0)');
  const la = M.spatialMorphPairingLines(x.layerA, null, null), lb = M.spatialMorphPairingLines(x.layerB, c.members, GE);
  const img = (g, id) => (g > 0 && GE.perms[g] && GE.perms[g].has(id) ? GE.perms[g].get(id) : id);
  const nodesA = new Map(x.layerA.nodes.map((n) => [n.id, n])), nodesB = new Map(x.layerB.nodes.map((n) => [n.id, n]));
  const connA = [], connB = [];
  for (let g = 0; g < GE.groupOrder; g++) for (let i = 0; i < la.length; i++) {
    const bi = c.perm[i], fl = c.flips[bi], bids = fl ? [lb[bi].ids[1], lb[bi].ids[0]] : lb[bi].ids;
    const a = [img(g, la[i].ids[0]), img(g, la[i].ids[1])], b = [img(g, bids[0]), img(g, bids[1])];
    connA.push(a); connB.push(b);
  }
  const mk = (nodes, conns) => ({ nodes: [...nodes.values()], connections: conns });
  return M.spatialMorphScorePairing(mk(nodesA, connA), mk(nodesB, connB), null, null, null, { poly: x.poly });
}
function closedSelf(which) {   // a layer scored against itself on its symmetry-closed line set: the free-ends guard of the editor, but on the lines that are really drawn
  const x = w.get('timelineConclusiveContext(0)'), L = which === 'A' ? x.layerA : x.layerB, lines = M.spatialMorphPairingLines(L, null, null);
  const img = (g, id) => (g > 0 && GE.perms[g] && GE.perms[g].has(id) ? GE.perms[g].get(id) : id);
  const conns = []; for (let g = 0; g < GE.groupOrder; g++) lines.forEach((l) => conns.push([img(g, l.ids[0]), img(g, l.ids[1])]));
  const closed = { nodes: L.nodes, connections: conns };
  return { open: M.spatialMorphScorePairing(L, L, null, null, null, { poly: x.poly }).dangling, closed: M.spatialMorphScorePairing(closed, closed, null, null, null, { poly: x.poly }).dangling };
}
const t0 = Date.now();
const rows = cands.map((c, i) => {
  const v = verdict(c), per = measure(c, MODE);
  const mx = per.reduce((b, p) => (p.dangling > b.dangling ? p : b), per[0]), mg = per.reduce((b, p) => (p.gaps > b.gaps ? p : b), per[0]);
  setPairing(c); w.setMorph({ enabled: true, mode: MODE[0], angleDeg: +MODE[1] });
  const cs = closedScore(c);
  return { i, perm: c.perm, flips: c.flips, members: c.members, keep: v.keep, state: v.state, score: v.score, closed: { dangling: cs.dangling, nodeMiss: cs.nodeMiss, boundaryMiss: cs.boundaryMiss }, maxDangling: mx.dangling, tDangling: mx.t, maxGaps: mg.gaps, tGaps: mg.t, per: per.map((p) => [p.t, p.dangling, p.gaps]), pic: [0.1, 0.5, 0.9].map((t) => sig(frameAt(t))).join('|') };
});
const ms = Date.now() - t0;
const pics = new Set(rows.map((r) => r.pic)).size;
const fmt = (r) => `${r.perm.join('')} ${r.flips.map((f) => (f ? 'F' : '-')).join('')} ${r.members.join('')}`;
console.log(`case: square order 4 rotation_reflection6 (D4), start orbits ${A_ORBITS.join('+')} = ${J(A_ORBITS.map(pairOf))}, end orbits ${B_ORBITS.join('+')} = ${J(B_ORBITS.map(pairOf))}; mode ${MODE.join(':')}, canvas ${W}, ${tiles.length} tiles, group order ${groupOrder}`);
function J(x) { return JSON.stringify(x); }
console.log(`candidates: ${rows.length} (perm x flips x members), ${pics} distinct pictures (frames at t = 0.1, 0.5, 0.9 together); ${ms} ms in all, ${(ms / rows.length).toFixed(1)} ms per candidate for 7 frames (+ verdict)`);
const states = {}; rows.forEach((r) => { states[r.state] = (states[r.state] || 0) + 1; });
console.log('editor state of the filter for the layer pair:', J(states), '(free = a layer has free line ends: the filter would not apply)');
const keep = rows.filter((r) => r.keep), drop = rows.filter((r) => !r.keep);
const summary = (list) => { const m = {}; list.forEach((r) => { const k = `maxDangling ${r.maxDangling} | maxGaps ${r.maxGaps}`; m[k] = (m[k] || 0) + 1; }); return m; };
console.log(`filter YES: ${keep.length}`, J(summary(keep)));
console.log(`filter NO : ${drop.length}`, J(summary(drop)));
const bad = keep.filter((r) => r.maxDangling > 0 || r.maxGaps > 0);
console.log(`filter YES with intermediate dangling or seam gaps > 0: ${bad.length}`);
const isBad = (r) => r.maxDangling > 0 || r.maxGaps > 0;
const cross = (key) => { const m = {}; rows.forEach((r) => { const k = key(r); (m[k] = m[k] || { n: 0, bad: 0 }); m[k].n++; if (isBad(r)) m[k].bad++; }); return J(m); };
console.log('\nthe editor\'s score (base lines only) against the measured truth (bad = loose ends or seam gaps at any t):');
console.log('  score dangling/nodeMiss/boundaryMiss -> n, bad:', cross((r) => `${r.score.dangling}/${r.score.nodeMiss}/${r.score.boundaryMiss}`));
const pass0 = rows.filter((r) => r.score.dangling === 0 && r.score.nodeMiss === 0 && r.score.boundaryMiss === 0);
console.log(`  candidates the score would call conclusive if the free-ends guard did not stop it: ${pass0.length}, of them bad: ${pass0.filter(isBad).length}`);
console.log('free ends of each layer scored alone: base lines only (what the editor\'s guard sees) / symmetry-closed lines: A', J(closedSelf('A')), 'B', J(closedSelf('B')));
console.log('PROPOSAL, the same score on the symmetry-closed line set (images under all group elements):');
console.log('  closed score dangling/nodeMiss/boundaryMiss -> n, bad:', cross((r) => `${r.closed.dangling}/${r.closed.nodeMiss}/${r.closed.boundaryMiss}`));
const passC = rows.filter((r) => r.closed.dangling === 0 && r.closed.nodeMiss === 0 && r.closed.boundaryMiss === 0);
console.log(`  conclusive by the closed score: ${passC.length}, of them bad: ${passC.filter(isBad).length}; bad but not caught (closed score 0): ${rows.filter((r) => isBad(r) && r.closed.dangling === 0 && r.closed.nodeMiss === 0 && r.closed.boundaryMiss === 0).length}`);
const xc = w.get('timelineConclusiveContext(0)'); const selfClosed = (id) => { const nodes = new Map(w.get('additionalLayers[' + id + '].nodes').map((n) => [n.id, n])); return null; };
const bt = {}; rows.filter(isBad).forEach((r) => r.per.forEach((p) => { if (p[1] > 0 || p[2] > 0) bt[p[0]] = (bt[p[0]] || 0) + 1; }));
const survivors = rows.filter((r) => r.closed.dangling === 0 && r.closed.boundaryMiss === 0);
console.log(`  survivors of the closed score on dangling and boundaryMiss (nodeMiss is > 0 for every pairing here: the two patterns differ in topology): ${survivors.length}, distinct pictures among them ${new Set(survivors.map((r) => r.pic)).size}, bad among them ${survivors.filter(isBad).length}`);
console.log('  the bad candidates are bad at these t (count):', J(bt), '(a check at t = 0.5 alone would miss all of them)');
console.log('\nTable (candidate = perm flips members; filter; max dangling over t (at t); max seam gaps over t (at t); score dangling/nodeMiss/boundaryMiss):');
const show = (list, title) => { console.log(title); list.slice(0, TOP).forEach((r) => console.log(`  ${fmt(r).padEnd(8)} ${r.keep ? 'YES' : 'no '}  dang ${String(r.maxDangling).padStart(3)} @${r.tDangling}  gaps ${String(r.maxGaps).padStart(3)} @${r.tGaps}  score ${r.score.dangling}/${r.score.nodeMiss}/${r.score.boundaryMiss}  by t: ${r.per.map((p) => p[1] + '/' + p[2]).join(' ')}`)); };
show(keep.slice().sort((a, b) => (b.maxDangling + b.maxGaps) - (a.maxDangling + a.maxGaps)), `filter YES, worst ${TOP} by dangling + gaps:`);
show(drop.slice().sort((a, b) => (a.maxDangling + a.maxGaps) - (b.maxDangling + b.maxGaps)), `filter NO, best ${TOP} by dangling + gaps:`);
const id0 = rows.find((r) => r.perm.join('') === '01' && !r.flips.some(Boolean) && r.members.every((g) => g === 0));
console.log('\nstandard pairing (identity, no flips, members 0):', id0 ? `${id0.keep ? 'YES' : 'no'} (state ${id0.state}), score ${J(id0.score)}, by t (t,dangling,gaps): ${J(id0.per)}` : 'n/a');

// the cost of one more measure: the frame-based quantities at 5 time positions per candidate, measured alone (no verdict)
const costN = 40, cc = cands.filter((_, i) => i % Math.floor(cands.length / costN) === 0).slice(0, costN);
const T5 = [0, 0.25, 0.5, 0.75, 1];
const tt = Date.now(); cc.forEach((c) => { setPairing(c); w.setMorph({ enabled: true, mode: MODE[0], angleDeg: +MODE[1] }); T5.forEach((t) => { const f = frameAt(t); dangling(f, W); seamGaps(f); }); }); const costFrames = (Date.now() - tt) / cc.length;
const tf = Date.now(); cc.forEach((c) => { setPairing(c); T5.forEach((t) => frameAt(t)); }); const costDraw = (Date.now() - tf) / cc.length;
const ts = Date.now(); for (let k = 0; k < 20; k++) cc.forEach((c) => { const x = w.get('timelineConclusiveContext(0)'); M.spatialMorphScorePairing(x.layerA, x.layerB, c.perm, c.flips, c.members, { poly: x.poly, groupElements: x.groupElements }); }); const costScore = (Date.now() - ts) / (20 * cc.length);
const tc = Date.now(); for (let k = 0; k < 5; k++) cc.forEach((c) => closedScore(c)); const costClosed = (Date.now() - tc) / (5 * cc.length);
console.log(`\ncost per candidate: current score ${costScore.toFixed(3)} ms (incl. context read); 5 drawn frames + dangling + seam gaps ${costFrames.toFixed(1)} ms (of which drawing alone ${costDraw.toFixed(1)} ms) = ${(costFrames / 5).toFixed(1)} ms per time position; closed-line score ${costClosed.toFixed(3)} ms`);

if (EXTRA.length && pass0.length) {
  console.log('\nextra modes for the candidates the score would pass (guard aside):');
  pass0.slice(0, 3).forEach((r) => EXTRA.forEach((m) => { const per = measure({ perm: r.perm, flips: r.flips, members: r.members }, m); console.log(`  ${fmt(r)} ${m.join(':')}: max dangling ${Math.max(...per.map((p) => p.dangling))}, max gaps ${Math.max(...per.map((p) => p.gaps))}`); }));
}
if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify({ mode: MODE, rows: rows.map((r) => Object.assign({}, r, { pic: undefined })) })); console.log('wrote', JSON_OUT); }
