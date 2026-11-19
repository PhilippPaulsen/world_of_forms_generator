// Task 103: comparison of the reference runs (reports/logs/103-basis-*) with the runs of the working tree (103-new-*).
//   node tools/morph/measure-shadow-103.js anim      the 990 animation runs: data digest of the findFaces results base vs new (switch off there: must be identical)
//   node tools/morph/measure-shadow-103.js runs      the 264 morph runs: runs / frames with a hole > 5000 px2, face counts
//   node tools/morph/measure-shadow-103.js 396       the 396 runs of 094: holes > 5000, self-intersections, 1e-9 instability, splitters (< 0.25 px2), face total
'use strict';
const fs = require('fs'), path = require('path');
const L = path.join(__dirname, '..', '..', 'reports', 'logs');
const files = (pre, ext) => fs.readdirSync(L).filter((f) => f.startsWith(pre) && f.endsWith(ext)).map((f) => path.join(L, f));
const load = (pre) => files(pre, '.json').map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const cmd = process.argv[2];
if (cmd === 'anim') {
  const m = (pre) => Object.assign({}, ...load(pre).filter((j) => !j.results));
  const b = m('103-basis-anim-'), n = m('103-new-anim-'), ks = Object.keys(b);
  const d = ks.filter((k) => n[k] && n[k].data === b[k].data).length, o = ks.filter((k) => n[k] && n[k].order === b[k].order).length;
  console.log(`animation runs ${Object.keys(n).length}/${ks.length}: data (findFaces results of 41 frames) identical ${d}, draw order identical ${o}`);
  process.exit(d === ks.length && Object.keys(n).length === ks.length ? 0 : 1);
} else if (cmd === 'runs') {
  const r = (pre) => [].concat(...load(pre).map((j) => j.results));
  for (const [name, pre] of [['base', '103-basis-runs-'], ['new ', '103-new-runs-']]) {
    const rs = r(pre), bad = rs.filter((x) => x.holes > 0);
    console.log(`${name}: ${rs.length} runs, runs with a hole > 5000 px2: ${bad.length}, frames: ${rs.reduce((s, x) => s + x.holes, 0)}, max ${Math.max(...rs.map((x) => x.maxGap))}, faces ${rs.reduce((s, x) => s + x.faces, 0)}${bad.length ? ' | ' + bad.map((x) => `cfg${x.ci}/${x.net}/${x.seed}:${x.holes}f:${Math.round(x.maxGap)}`).join(' ') : ''}`);
  }
} else if (cmd === '396') {
  const agg = (pre) => { const o = { seqs: 0, holes: 0, holeSeqs: 0, selfF: 0, selfP: 0, jitF: 0, jitCountF: 0, small: 0, smallF: 0, faces: 0, gapF: 0, overF: 0, areaF: 0, errors: 0 };
    for (const j of load(pre)) for (const r of j.results) { if (!r.ok) { o.errors++; continue; } o.seqs++; let h = 0;
      for (const f of r.frames) { if (r.mode === 'morph' && f.gapPx2 > 5000) h++; if (r.mode === 'morph' && f.gapPx2 > 0) o.gapF++; if (r.mode === 'morph' && f.overPx2 > 0) o.overF++; if (r.mode === 'morph' && Math.abs(f.areaDelta) > 1e-3) o.areaF++; if (f.selfX > 0) { o.selfF++; o.selfP += f.selfX; } if (f.jit) o.jitF++; if (f.jitCount) o.jitCountF++; o.small += f.small; if (f.small) o.smallF++; o.faces += f.n; }
      o.holes += h; if (h) o.holeSeqs++; }
    return o; };
  const b = agg('103-basis-396-'), n = agg('103-new-396-'), pct = (x, y) => y ? ((x / y - 1) * 100).toFixed(2) + ' %' : '-';
  console.log('metric                              base        new      change');
  for (const k of Object.keys(b)) console.log(k.padEnd(30), String(b[k]).padStart(10), String(n[k]).padStart(10), pct(n[k], b[k]).padStart(10));
}
