// Task 098 (only measuring): does the MORPH path (core/spatial-morph-render.js spatialMorphRenderFillFaces, which fills the faces of spatialMorphRenderTileFaces in DATA order) have the same covering by an enclosing face when
// components lie inside a face? For every distinct findFaces result of a morph frame: does a component enclose another (the draw-order filter of task 098), do the face polygons overlap, and would the painter hide faces in data order.
//   node tools/morph/measure-morph-nesting.js [--seeds N] [--shard i/n] [--out f.json]      sum f.json ...
'use strict';
const fs = require('fs');
const A = require('./measure-face-artifacts.js');
const M = require('./measure-anim-overlap.js');
const HOOK = `globalThis.__res = []; { const f = findFaces; findFaces = function () { const r = f.apply(this, arguments); globalThis.__res.push(r); return r; }; }`;
function analyse(res) {   // -> { faces, trig, overlap, wrong }
  const byId = new Map(res.nodes.map((n) => [n.id, n]));
  const an = { faces: res.faces.map((f) => ({ area: f.area, poly: f.nodeIds.map((id) => { const n = byId.get(id); return [n.x, n.y]; }) })) };
  const ov = M.overlapPairs(an);
  return { faces: res.faces.length, overlap: ov.total, wrong: ov.wrong };
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
if (process.argv[2] === 'sum') {
  const all = []; process.argv.slice(3).forEach((f) => JSON.parse(fs.readFileSync(f, 'utf8')).results.forEach((r) => all.push(r)));
  const t = { runs: all.length, frames: 0, results: 0, trig: 0, overlapResults: 0, wrongResults: 0, framesWithWrong: 0, framesWithOverlap: 0, maxWrong: 0 }; const by = {};
  all.forEach((r) => { t.frames += r.frames; t.results += r.results; t.trig += r.trig; t.overlapResults += r.overlapResults; t.wrongResults += r.wrongResults; t.framesWithWrong += r.framesWithWrong; t.framesWithOverlap += r.framesWithOverlap; t.maxWrong = Math.max(t.maxWrong, r.maxWrong); const k = A.CONFIGS[r.ci].shape + ' ' + r.net; const b = by[k] = by[k] || { runs: 0, framesWithWrong: 0, framesWithOverlap: 0 }; b.runs++; b.framesWithWrong += r.framesWithWrong; b.framesWithOverlap += r.framesWithOverlap; });
  console.log(JSON.stringify(t)); console.log(JSON.stringify(by));
} else {
  const seeds = +arg('--seeds', 6), shard = arg('--shard', '0/1').split('/').map(Number), outf = arg('--out', null);
  const jobs = []; A.CONFIGS.forEach((cfg, ci) => { for (const net of ['none', 'field']) for (let s = 1; s <= seeds; s++) jobs.push({ ci, net, s }); });
  const results = [];
  jobs.filter((_, k) => k % shard[1] === shard[0]).forEach(({ ci, net, s }) => {
    const cfg = A.CONFIGS[ci], acc = A.acceptedSeed(cfg, net, s, 'morph');
    const w = A.build(cfg, net, acc.seed, 'morph', 'base'); w.set(HOOK);
    const rec = { ci, net, seed: acc.seed, frames: 0, results: 0, trig: 0, overlapResults: 0, wrongResults: 0, framesWithWrong: 0, framesWithOverlap: 0, maxWrong: 0 };
    for (let i = 0; i < A.NT; i++) {
      w.set('globalThis.__res.length = 0;'); A.frameAt(w, i / (A.NT - 1)); rec.frames++;
      const n = w.get('globalThis.__res.length'); if (!n) continue;
      const seen = new Set(); let fw = 0, fo = 0;
      for (let k = 0; k < n; k++) {
        const key = w.get(`(function () { var r = globalThis.__res[${k}]; return r.faces.length + ':' + (r.faces[0] ? r.faces[0].nodeIds.join('|') : ''); })()`); if (seen.has(key)) continue; seen.add(key);
        const res = JSON.parse(w.get(`JSON.stringify(globalThis.__res[${k}])`)); if (!res.faces.length) continue;
        const trig = w.get(`!!_faceDrawOrderResult(globalThis.__res[${k}])`);
        const a = analyse(res); rec.results++; if (trig) rec.trig++;
        if (a.overlap > 1) { rec.overlapResults++; fo = 1; } if (a.wrong > 1) { rec.wrongResults++; fw = 1; rec.maxWrong = Math.max(rec.maxWrong, Math.round(a.wrong)); }
      }
      rec.framesWithWrong += fw; rec.framesWithOverlap += fo;
    }
    results.push(rec);
  });
  const o = JSON.stringify({ shard, results }); if (outf) fs.writeFileSync(outf, o); else console.log(o);
}
