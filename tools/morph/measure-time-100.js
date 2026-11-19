// Task 100: frame time of morph and animation, the working tree's core/facecolor.js against a reference file (default reports/logs/100-basis-facecolor.js = main before the task), old and new drawn BACK TO BACK at every frame
// (order alternating, ABBA): the scene of task 099 for three shapes (both paths) and 12 random runs (morph and animation).
//   node tools/morph/measure-time-100.js [ref.js]
'use strict';
const path = require('path');
const H = require('./render-harness.js');
let FC = null;   // facecolor.js used by the next world built through A.build (null = the working tree's)
{ const orig = H.makeRenderWorld; H.makeRenderWorld = function (shape, order, size, sym, files) { return orig(shape, order, size, sym, Object.assign({}, files, FC ? { 'core/facecolor.js': FC } : {})); }; }
const A = require('./measure-face-artifacts.js');
const M = require('./measure-anim-overlap.js');
const S1 = require('./measure-scene-100.js');
const REF = process.argv[2] || path.join(__dirname, '..', '..', 'reports', 'logs', '100-basis-facecolor.js');
const sumTimes = (pairs) => { let a = 0, b = 0; pairs.forEach(([x, y]) => { a += x; b += y; }); return [a, b]; };
function abba(mk, frame, frames) {   // mk(file|null) -> world; frame(world, i)
  const o = mk(REF), n = mk(null), to = [], tn = [];
  const one = (w, i) => { const t0 = process.hrtime.bigint(); frame(w, i); return Number(process.hrtime.bigint() - t0) / 1e6; };
  for (let i = 0; i < frames; i++) { if (i % 2) { to.push(one(o, i)); tn.push(one(n, i)); } else { tn.push(one(n, i)); to.push(one(o, i)); } }
  return [to.reduce((x, y) => x + y, 0), tn.reduce((x, y) => x + y, 0)];
}
const rows = [], all = [];
for (const shape of ['square', 'triangle', 'hex']) for (const mode of ['morph', 'anim']) {
  const [a, b] = abba((f) => S1.build(shape, mode, { files: f ? { 'core/facecolor.js': f } : undefined }), (w, i) => S1.frameAt(w, i / 40), 41);
  rows.push(`scene ${shape} ${mode}: ${a.toFixed(0)} -> ${b.toFixed(0)} ms (${((b / a - 1) * 100).toFixed(1)} %)`); all.push([a, b]);
}
const RUNS = [[0, 'none', 3], [4, 'field', 2], [11, 'none', 5], [15, 'field', 1], [22, 'none', 2], [26, 'field', 4]];
for (const [ci, net, seed] of RUNS) {
  const cfg = A.CONFIGS[ci], acc = A.acceptedSeed(cfg, net, seed, 'morph');
  const [a, b] = abba((f) => { FC = f; try { return A.build(cfg, net, acc.seed, 'morph', 'base'); } finally { FC = null; } }, (w, i) => A.frameAt(w, i / 40), 41);
  rows.push(`morph run ${ci}/${net}/${seed}: ${a.toFixed(0)} -> ${b.toFixed(0)} ms (${((b / a - 1) * 100).toFixed(1)} %)`); all.push([a, b]);
  if (net === 'none') {
    const [c, d] = abba((f) => { FC = f; try { return M.buildAna(cfg, acc.seed, 'base'); } finally { FC = null; } }, (w, i) => A.frameAt(w, i / 40), 41);
    rows.push(`anim run ${ci}/${seed}: ${c.toFixed(0)} -> ${d.toFixed(0)} ms (${((d / c - 1) * 100).toFixed(1)} %)`); all.push([c, d]);
  }
}
const [ta, tb] = sumTimes(all);
console.log(rows.join('\n')); console.log(`TOTAL ${ta.toFixed(0)} -> ${tb.toFixed(0)} ms (${((tb / ta - 1) * 100).toFixed(1)} %)`);
