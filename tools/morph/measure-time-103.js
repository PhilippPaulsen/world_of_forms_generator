// Task 103: frame time of the spatial morph WITH faces, main's core/faces.js (reports/logs/103-basis-faces.js) against the working tree, old and new drawn back to back at every frame (ABBA, min of 4 each),
// 12 scenes (6 sheets x without net / Field), 21 frames. Also: segment pairs of the rule per cell (cells of the morph = findFaces calls with the switch on).
//   node tools/morph/measure-time-103.js [rounds]
'use strict';
const path = require('path');
const A = require('./measure-face-artifacts.js');
const OLDF = path.join(__dirname, '..', '..', 'reports', 'logs', '103-basis-faces.js'), NEWF = path.join(__dirname, '..', '..', 'core', 'faces.js');
const build = (file, ci, net) => { const keep = process.env.FACES_JS; process.env.FACES_JS = file; try { const cfg = A.CONFIGS[ci], { seed } = A.acceptedSeed(cfg, net, 1, 'morph'); const w = A.build(cfg, net, seed, 'morph', 'base'); w.set('if (typeof spatialMorphRenderGrow === "function") spatialMorphRenderGrow = (p) => p;'); return w; } finally { if (keep === undefined) delete process.env.FACES_JS; else process.env.FACES_JS = keep; } };
const ms = (w, t) => { const t0 = process.hrtime.bigint(); A.frameAt(w, t); return Number(process.hrtime.bigint() - t0) / 1e6; };
const rounds = +(process.argv[2] || 3);
let SO = 0, SN = 0; const rows = [], rr = [];
for (let r = 0; r < rounds; r++) {
  let to = 0, tn = 0;
  for (const ci of [4, 9, 15, 20, 26, 31]) for (const net of ['none', 'field']) {
    const o = build(OLDF, ci, net), n = build(NEWF, ci, net);
    for (let i = 0; i < 3; i++) { ms(o, 0.5); ms(n, 0.5); }
    let a = 0, b = 0;
    for (let i = 0; i <= 20; i++) { const t = i / 20; let bo = Infinity, bn = Infinity; for (let k = 0; k < 4; k++) { if (k % 2) { bo = Math.min(bo, ms(o, t)); bn = Math.min(bn, ms(n, t)); } else { bn = Math.min(bn, ms(n, t)); bo = Math.min(bo, ms(o, t)); } } a += bo; b += bn; }
    to += a; tn += b; if (r === 0) rows.push(`${A.CONFIGS[ci].shape}/${A.CONFIGS[ci].sym}/s${A.CONFIGS[ci].size}/${net}: ${a.toFixed(0)} -> ${b.toFixed(0)} ms (${((b / a - 1) * 100).toFixed(1)} %)`);
  }
  rr.push((tn / to - 1) * 100); SO += to; SN += tn; console.log(`round ${r + 1}: ${to.toFixed(0)} -> ${tn.toFixed(0)} ms (${((tn / to - 1) * 100).toFixed(2)} %)`);
}
console.log(rows.join('\n')); rr.sort((x, y) => x - y);
console.log(`TOTAL ${rounds} rounds: ${SO.toFixed(0)} -> ${SN.toFixed(0)} ms (${((SN / SO - 1) * 100).toFixed(2)} %), median round ${rr[rr.length >> 1].toFixed(2)} %`);
// segment pairs per cell
let calls = 0, sum = 0, max = 0, dropped = 0;
for (const ci of [4, 9, 15, 20, 26, 31]) for (const net of ['none', 'field']) {
  const w = build(NEWF, ci, net);
  w.set('globalThis.__S=[];{const f=findFaces;findFaces=function(s,n){const r=f.apply(this,arguments);if(faceRepairCollinear)__S.push(s.length);return r;}}');
  for (let i = 0; i <= 20; i += 4) A.frameAt(w, i / 20);
  for (const n of JSON.parse(w.get('JSON.stringify(__S)'))) { calls++; sum += n * (n - 1); max = Math.max(max, n); }
}
console.log(`cells with the switch on: ${calls}, segment pairs per cell: mean ${(sum / calls).toFixed(0)} (n(n-1)), largest cell ${max} segments (${max * (max - 1)} pairs)`);
