// Task 101 (Typ R, nur messen): overlaps and holes of the face fills under a FIELD net (static pattern = net A alone, and the spatial morph A -> B), in the CANVAS (all tiles), per frame.
//   node tools/morph/measure-field-101.js scan [--shard i/n] [--out f.json]     the matrix: shape x size {3,5,9} x law {regular, sinus, tangens, geometric} x order {2..6} x symmetry {none, rotation3, rotation_reflection6}
//   node tools/morph/measure-field-101.js sum f1.json ...                      tables
//   node tools/morph/measure-field-101.js one <key> <mode> <seed> <ti> [out.png]   one frame: overlaps classified (inside a tile / between tiles), picture
// A key is shape/size/law/order/sym. Morph: 2 pair seeds, t = 0, .25, .5, .75, 1 (the pairs are random keyframes as in task 094, advanced until the morph accepts them). Sizes are square (X = Y): a non-square area gives lineCountMismatch in the harness (task 099).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
const A = require('./measure-face-artifacts.js');
const LAWS = { regular: [{ kind: 'uniform', w: 0 }, { kind: 'uniform', w: 0 }], sinus: [{ kind: 'trig', w: -0.8 }, { kind: 'trig', w: -0.3 }], tangens: [{ kind: 'trig', w: 0.6 }, { kind: 'trig', w: 0.2 }], geometric: [{ kind: 'geometric', w: Math.log(4) }, { kind: 'geometric', w: Math.log(2) }] };
const net = (l) => ({ x: l, y: 'same', repeat: false, domain: 'field' });
const STUB = `
  var __polys = [], __cur = null, __style = { fill: null }, __stack = [], __tiles = [];
  push = () => { __stack.push(JSON.stringify(__style)); }; pop = () => { __style = JSON.parse(__stack.pop()); };
  noStroke = () => { }; stroke = () => { }; noFill = () => { }; fill = (c) => { __style.fill = c; };
  beginShape = () => { __cur = []; }; vertex = (x, y) => { __cur.push([x, y]); }; endShape = () => { __polys.push({ f: __style.fill, p: __cur }); __cur = null; };
  var CLOSE = 'close';
  { const g = spatialMorphRenderFillFaces; spatialMorphRenderFillFaces = function () { const a = __polys.length; const r = g.apply(this, arguments); __tiles.push([a, __polys.length]); return r; }; }
  { const g = drawFaceFillsAtTile; drawFaceFillsAtTile = function () { const a = __polys.length; const r = g.apply(this, arguments); __tiles.push([a, __polys.length]); return r; }; }`;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function keyframes(ids, seed) { const r = rng(seed * 7919 + 17), K = []; for (let k = 0; k < 2; k++) { const n = 3 + Math.floor(r() * 3), set = new Set(), conns = []; let g = 0; while (conns.length < n && g++ < 200) { const a = ids[Math.floor(r() * ids.length)], b = ids[Math.floor(r() * ids.length)], key = Math.min(a, b) + '-' + Math.max(a, b); if (a === b || set.has(key)) continue; set.add(key); conns.push([a, b]); } K.push(conns); } return K; }
const parse = (key) => { const [shape, size, law, order, sym] = key.split('/'); return { shape, size: +size, law, order: +order, sym }; };
function build(cfg, mode, seed, files) {
  const w = makeRenderWorld(cfg.shape, cfg.order, cfg.size, cfg.sym, files); w.set(STUB);
  const ids = w.get('nodes.filter((n) => !n.free).map((n) => n.id)'), K = keyframes(ids, seed), L = LAWS[cfg.law], NA = net(L[0]), NB = net(L[1]);
  w.dims = [w.get('canvasW'), w.get('canvasH')]; w.K = K;
  if (mode === 'static') { w.baseConnections(K[0]); w.set(`showFaces = true; baseNetTransform = ${JSON.stringify(NA)};`); w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 }); }
  else {
    w.baseConnections(K[0]); const ls = K.map((k) => w.addKeyframeLayer(k)); ls.forEach((i) => w.set(`additionalLayers[${i}].showFaces = true;`)); w.setTimeline(ls);
    w.set(`baseNetTransform = ${JSON.stringify(NA)}; timeline.netStates = ${JSON.stringify([NA, NB])}; timeline.netLive = true;`); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  }
  w.mode = mode; return w;
}
function frame(w, t) { w.set(`timeline && (timeline.elapsedMs = ${t} * 2000, timeline.currentFrame = { segmentIndex: 0, localT: ${t} }); __polys.length = 0; __tiles.length = 0; drawTessellation();`); return w.get('__polys'); }
function okSeed(cfg, seed) { for (let k = 0; k < 25; k++) { const s = seed + 1000 * k; try { const w = build(cfg, 'morph', s); frame(w, 0.5); const c = w.status().code; if (c === 'netActive') return s; } catch (e) { return -1; } } return -1; }
const TS = [0, 0.25, 0.5, 0.75, 1];
function scan(shard) {
  const jobs = []; for (const shape of ['square', 'triangle', 'hex']) for (const size of [3, 5, 9]) for (const law of Object.keys(LAWS)) for (const order of [2, 3, 4, 5, 6]) for (const sym of ['none', 'rotation3', 'rotation_reflection6']) jobs.push([shape, size, law, order, sym].join('/'));
  const out = [];
  jobs.filter((_, i) => i % shard[1] === shard[0]).forEach((key) => {
    const cfg = parse(key); const rec = { key, frames: [] };
    try {
      const ws = build(cfg, 'static', 1); const polys = frame(ws, 0), a = A.analyseFrame(polys, ws.dims); rec.frames.push({ mode: 'static', seed: 1, ti: 0, n: a.n, over: a.overPx2, gap: a.gapPx2, area: +a.areaDelta.toFixed(2), small: a.small, dup: a.dup, selfX: a.selfX });
    } catch (e) { rec.err = String(e).slice(0, 80); }
    for (const s0 of [1, 2]) {
      const s = okSeed(cfg, s0); if (s < 0) { rec.noMorph = (rec.noMorph || 0) + 1; continue; }
      const w = build(cfg, 'morph', s);
      TS.forEach((t, ti) => { const a = A.analyseFrame(frame(w, t), w.dims); rec.frames.push({ mode: 'morph', seed: s, ti, n: a.n, over: a.overPx2, gap: a.gapPx2, area: +a.areaDelta.toFixed(2), small: a.small, dup: a.dup, selfX: a.selfX }); });
    }
    out.push(rec);
  });
  return out;
}
// overlaps of one frame classified: both polygons of a pair from the SAME tile or from DIFFERENT tiles
function classify(w, polys) {
  const tiles = w.get('__tiles'), tileOf = new Array(polys.length); tiles.forEach(([a, b], k) => { for (let i = a; i < b; i++) tileOf[i] = k; });
  const [CW, CH] = w.dims, S = 2, nx = Math.ceil(CW / S), ny = Math.ceil(CH / S), cover = new Array(nx * ny);
  polys.forEach((q, pi) => { const p = q.p; if (p.length < 3) return; let y0 = Infinity, y1 = -Infinity; for (const v of p) { y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
    for (let r = Math.max(0, Math.ceil((y0 - 0.6139) / S)); r <= Math.min(ny - 1, Math.floor((y1 - 0.6139) / S)); r++) { const y = 0.6139 + r * S, xs = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let c = Math.max(0, Math.ceil((xs[k] - 0.3712) / S)); c <= Math.min(nx - 1, Math.floor((xs[k + 1] - 0.3712) / S)); c++) (cover[r * nx + c] = cover[r * nx + c] || []).push(pi); } });
  let inside = 0, between = 0, gap = 0, edgeGap = 0; const cell = S * S;
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) { const l = cover[r * nx + c]; if (!l) { gap += cell; if (r < 3 || c < 3 || r >= ny - 3 || c >= nx - 3) edgeGap += cell; continue; } if (l.length < 2) continue; const t0 = tileOf[l[0]]; if (l.every((i) => tileOf[i] === t0)) inside += cell; else between += cell; }
  return { insideTilePx2: inside, betweenTilesPx2: between, gapPx2: gap, gapAtCanvasEdgePx2: edgeGap, tiles: tiles.length, polys: polys.length };
}
module.exports = { build, frame, classify, parse, okSeed, TS };
if (require.main === module) {
  const cmd = process.argv[2], arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
  if (cmd === 'scan') { const sh = arg('--shard', '0/1').split('/').map(Number), o = arg('--out', null), r = JSON.stringify({ results: scan(sh) }); if (o) fs.writeFileSync(o, r); else console.log(r); }
  else if (cmd === 'sum') {
    const all = []; process.argv.slice(3).forEach((f) => JSON.parse(fs.readFileSync(f, 'utf8')).results.forEach((r) => all.push(r)));
    const g = {}; const add = (k, f) => { const e = g[k] = g[k] || { frames: 0, over: 0, gap: 0, maxOver: 0, maxGap: 0, areaOff: 0, invalid: 0 }; e.frames++; if (f.over > 0) { e.over++; e.maxOver = Math.max(e.maxOver, f.over); } if (f.gap > 0) { e.gap++; e.maxGap = Math.max(e.maxGap, f.gap); } if (Math.abs(f.area) > 1) e.areaOff++; if (f.selfX || f.small) e.invalid++; };
    all.forEach((r) => { const c = require('./measure-field-101.js').parse(r.key); r.frames.forEach((f) => { if (f.n === 0) return; add(`${c.shape} ${f.mode}`, f); add(`${c.shape} ${f.mode} ord${c.order}`, f); add(`${c.shape} ${f.mode} ${c.law}`, f); add(`${c.shape} ${f.mode} size${c.size}`, f); add(`${c.shape} ${f.mode} ${c.sym}`, f); }); });
    Object.keys(g).sort().forEach((k) => { const e = g[k]; console.log(k.padEnd(34), `frames ${e.frames} overlap ${e.over} (max ${e.maxOver}) gap ${e.gap} (max ${e.maxGap}) areaOff ${e.areaOff} invalid ${e.invalid}`); });
    console.log('configs', all.length, 'errors', all.filter((r) => r.err).length, 'noMorph', all.reduce((s, r) => s + (r.noMorph || 0), 0));
  } else if (cmd === 'one') {
    const [key, mode, seed, ti, outp] = process.argv.slice(3), cfg = parse(key), w = build(cfg, mode, +seed), polys = frame(w, TS[+ti] || 0), a = A.analyseFrame(polys, w.dims), cl = classify(w, polys);
    console.log(J(Object.assign({ key, mode, seed: +seed, ti: +ti, over: a.overPx2, gap: a.gapPx2, n: a.n }, cl)));
    if (outp) require('./measure-face-artifacts-report.js').drawFrame({ build: () => w, frameAt: () => polys, analyseFrame: A.analyseFrame, CONFIGS: [cfg], NT: 41 }, 0, 'field', 1, 'morph', 0, 'base', outp, { plain: false });
  }
}
function J(x) { return JSON.stringify(x); }
