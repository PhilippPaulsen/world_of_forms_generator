// Measurement (task 038, stage 1; not a test: the glob tools/*/test-*.js does not pick it up). PROTOTYPE of lever (a) of reports/037.md WITHOUT touching core/: inside the vm the two per-tile functions of
// core/spatial-morph-render.js are wrapped by a memo that lives for ONE frame:
//   spatialMorphRenderTileFaces(lines, s, sheet)       key = the cell lines in canonical coordinates, EXACT floats (no rounding: rounding could merge different outputs)
//   spatialMorphRenderFaceColors(res, fields, w, mode) key = the identity of the (cached) faces result + the four corner weights (exact) + the mode
// What else could change the output of the two calls is, per frame, constant (s, the face sheet, the colour fields) or applied LATER, per tile, by spatialMorphRenderFillFaces (tile position / flip / rotation
// and the net warp): the cached values are in CANONICAL cell coordinates and are only read. The check: for every case, mode and p the polygon lists of the memo world (every fill colour and every vertex, in order)
// equal those of the plain world byte for byte (JSON). The time: mean ms per frame over 10 frames at step 0.01 (p = 0.50 ...), plain vs memo, and the memo's hit counts.
//   node tools/morph/measure-tile-reuse.js [--cases hex-typical,...] [--modes linear,radial] [--sabotage nokeyweights|noorient]   (sabotage = a deliberately wrong key, stage 1 must then FAIL the equality)
'use strict';
const { build, PAIRS } = require('./measure-color-jumps.js');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const CASES = arg('cases', 'dense-8,coloured,hex-typical,hex-dense-8,hex-coloured,tri-typical,tri-dense-6,tri-coloured').split(',');
const MODES = arg('modes', 'linear,radial').split(',');
const SAB = arg('sabotage', '');
const now = () => Number(process.hrtime.bigint()) / 1e6;

const MEMO = `
  var __memo = { faces: new Map(), colors: new Map(), hitF: 0, missF: 0, hitC: 0, missC: 0 };
  var __resetMemo = () => { __memo.faces.clear(); __memo.colors.clear(); };
  { const f = spatialMorphRenderTileFaces;
    spatialMorphRenderTileFaces = function (lines, s, sheet) {
      const key = JSON.stringify(lines);
      if (__memo.faces.has(key)) { __memo.hitF++; return __memo.faces.get(key); }
      __memo.missF++; const r = f.apply(this, arguments); __memo.faces.set(key, r); return r; }; }
  { const f = spatialMorphRenderFaceColors;
    spatialMorphRenderFaceColors = function (res, fields, w, mode) {
      let per = __memo.colors.get(res); if (!per) { per = new Map(); __memo.colors.set(res, per); }
      const key = ${SAB === 'nokeyweights' ? "''" : 'JSON.stringify([w.w00, w.w10, w.w01, w.w11, mode])'};
      if (per.has(key)) { __memo.hitC++; return per.get(key); }
      __memo.missC++; const r = f.apply(this, arguments); per.set(key, r); return r; }; }
`;
const polysOf = (w) => w.get('JSON.stringify(__polys)');
const plain = (w, p) => { w.set(`timeline.elapsedMs = ${p * 2000}; __polys.length = 0; __tiles.length = 0; __lines.length = 0;`); const t = now(); w.run('drawTessellation()'); return now() - t; };
const memo = (w, p) => { w.set(`timeline.elapsedMs = ${p * 2000}; __polys.length = 0; __tiles.length = 0; __lines.length = 0; __resetMemo();`); const t = now(); w.run('drawTessellation()'); const d = now() - t; w.set('__resetMemo()'); return d; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

let bad = 0;
for (const c of CASES) for (const mode of MODES) {
    if (!PAIRS[c]) continue;
    const A = build(c, mode), B = build(c, mode);
    B.set(MEMO);
    const ps = []; for (let k = 0; k <= 10; k++) ps.push(k / 10); for (let k = 0; k < 10; k++) ps.push(0.5 + 0.01 * k);
    let same = 0, diff = 0, firstDiff = null; const ta = [], tb = [];
    ps.forEach((p, i) => {
        const a = plain(A, p), b = memo(B, p);
        if (i >= 11) { ta.push(a); tb.push(b); }
        if (polysOf(A) === polysOf(B)) same++; else { diff++; if (firstDiff === null) firstDiff = p; }
    });
    const m = B.get('({ hitF: __memo.hitF, missF: __memo.missF, hitC: __memo.hitC, missC: __memo.missC })');
    const polys = JSON.parse(polysOf(A)).length;
    if (diff) bad++;
    console.log(JSON.stringify({ case: c, mode, equalFrames: same, differentFrames: diff, firstDiff, polys, plainMs: +mean(ta).toFixed(1), memoMs: +mean(tb).toFixed(1), saved: +(1 - mean(tb) / mean(ta)).toFixed(3), facesMissPerFrame: +(m.missF / ps.length).toFixed(1), colorMissPerFrame: +(m.missC / ps.length).toFixed(1) }));
}
console.log(bad ? `FAIL: ${bad} case(s) with different output` : 'all outputs equal');
process.exit(bad ? 1 : 0);
