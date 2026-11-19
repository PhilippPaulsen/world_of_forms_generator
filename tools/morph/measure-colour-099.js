// Task 099, part 4 (only measuring): the colour of the morph faces and of the playback faces with prototypes of core/facecolor.js (copies in the OS temp dir, loaded through the harness' core overrides).
// Runs the 264 morph runs of task 098 (33 sheets x without net / Field x 4 pairs, 41 steps) and the animation runs of tools/morph/measure-anim-overlap.js (33 x 30 pairs is too many: 33 x 4) for a variant:
//   per run: colour jumps and spikes between neighbouring frames (measure-face-artifacts.js), frame time, and for runs without a net the ENDPOINT check: the fills of the morph frame at t = 0 / t = 1 against the fills of the
//   static pattern of keyframe 0 / 1 (fraction of drawn polygons whose fill is not a fill of the static pattern).
//   node tools/morph/measure-colour-099.js run <variant> [i/n] <out.json>      node tools/morph/measure-colour-099.js sum f1.json f2.json ...
'use strict';
const fs = require('fs');
const H = require('./render-harness.js');
const SC = require('./measure-scene-099.js');
let VARIANT = process.argv[3] || 'base';
{ const orig = H.makeRenderWorld; H.makeRenderWorld = function (shape, order, size, sym, files) { const extra = SC.protoFiles(VARIANT); return orig(shape, order, size, sym, Object.assign({}, files, extra)); }; }
const A = require('./measure-face-artifacts.js');
function endpoint(cfg, net, seed) {   // morph frame t = 0 / 1 against the static pattern of the keyframe, no net only
  const out = { t0: 0, t1: 0, n0: 0, n1: 0 };
  for (const [k, t] of [[0, 0], [1, 1]]) {
    const w = A.build(cfg, net, seed, 'morph', 'base');
    const polys = A.frameAt(w, t), fills = new Set(polys.map((q) => q.f));
    const s = A.build(cfg, net, seed, 'morph', 'base');   // the same keyframes, drawn as a static pattern of keyframe k
    s.set('spatialMorph = { enabled: false, mode: "linear", angleDeg: 0 };'); s.baseConnections(s.K[k]); s.set('additionalLayers.forEach((l) => { l.showFaces = false; }); showFaces = true; __polys.length = 0; drawTessellation();');
    const sf = new Set(s.get('__polys').map((q) => q.f));
    const bad = polys.filter((q) => !sf.has(q.f)).length;
    out['t' + k] = bad; out['n' + k] = polys.length;
  }
  return out;
}
if (process.argv[2] === 'run') {
  const shard = (process.argv[4] || '0/1').split('/').map(Number), outf = process.argv[5];
  const jobs = []; A.CONFIGS.forEach((cfg, ci) => { for (const net of ['none', 'field']) for (let s = 1; s <= 4; s++) jobs.push({ ci, net, s }); });
  const res = [];
  jobs.filter((_, k) => k % shard[1] === shard[0]).forEach(({ ci, net, s }) => {
    const cfg = A.CONFIGS[ci], acc = A.acceptedSeed(cfg, net, s, 'morph');
    const t0 = process.hrtime.bigint();
    const r = A.runSequence(cfg, net, acc.seed, 'morph', { variant: 'base', eps: false });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const rec = { ci, net, seed: acc.seed, colJump: r.seq.colJump, colSpike: r.seq.colSpike, ms };
    if (net === 'none') Object.assign(rec, endpoint(cfg, net, acc.seed));
    res.push(rec);
  });
  fs.writeFileSync(outf, JSON.stringify({ variant: VARIANT, results: res }));
} else if (process.argv[2] === 'sum') {
  const all = []; let v = '';
  process.argv.slice(3).forEach((f) => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); v = j.variant; j.results.forEach((r) => all.push(r)); });
  const t = { variant: v, runs: all.length, colJump: 0, colSpike: 0, ms: 0, endpointBad0: 0, endpointN0: 0, endpointBad1: 0, endpointN1: 0, runsBad: 0 };
  all.forEach((r) => { t.colJump += r.colJump; t.colSpike += r.colSpike; t.ms += r.ms; if (r.n0 !== undefined) { t.endpointBad0 += r.t0; t.endpointN0 += r.n0; t.endpointBad1 += r.t1; t.endpointN1 += r.n1; if (r.t0 || r.t1) t.runsBad++; } });
  t.ms = Math.round(t.ms); console.log(JSON.stringify(t));
}
