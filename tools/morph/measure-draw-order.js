// Task 098: reference values and checks for the DRAW ORDER of face fills (core/faces.js drawFaceFillsAtTile). Compared against a reference taken BEFORE the change (reports/logs/098-basis-*).
//   node tools/morph/measure-draw-order.js corpus <out.json>      the 258 patterns of tools/color/corpus.js: hash of the computeCellFaces result (DATA), hash of the draw call log (fill colour and vertices of every polygon, tile flip false and true)
//   node tools/morph/measure-draw-order.js corpus-cmp <ref.json>  the same run against a reference: data identical, draw log identical (a byte-equal call log gives the same pixels), how many patterns draw in another order
//   node tools/morph/measure-draw-order.js anim <out.json> [i/n]  the 990 animation runs of tools/morph/measure-anim-overlap.js: per run a digest of the findFaces results of its 41 frames (DATA) and of the drawn order; --cmp ref.json compares
//   node tools/morph/measure-draw-order.js time                   frame time old (core/faces.js of main before this task) against the working tree: animation sequences (ABBA per frame) and the static corpus draw
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const C = require('../color/corpus.js');
const A = require('./measure-face-artifacts.js');
const M = require('./measure-anim-overlap.js');
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
const J = JSON.stringify;
const P5 = `var __log = []; var __cur = null, __fill = null; var CLOSE = 'close';
  push = () => { }; pop = () => { }; noStroke = () => { }; noFill = () => { }; stroke = () => { }; strokeWeight = () => { }; fill = (c) => { __fill = c; };
  beginShape = () => { __cur = []; }; vertex = (x, y) => { __cur.push([x, y]); }; endShape = () => { __log.push({ f: __fill, p: __cur }); __cur = null; };`;
function corpus(srcOverride) {
  const src = srcOverride || undefined, pats = C.buildPatterns(src), sheets = new Map(), out = [];
  const vm = require('vm');
  for (const p of pats) {
    const [shape, order, mode] = p.sh.label.split('/'), k = p.sh.label;
    if (!sheets.has(k)) { const sh = C.makeSheet(shape, +order, mode, src); vm.runInContext(P5, sh.sb); sheets.set(k, sh); }
    const sh = sheets.get(k), res = sh.faces(p.ids), data = J(res);
    const logs = [false, true].map((flip) => { sh.sb.__log.length = 0; vm.runInContext(`drawFaceFillsAtTile(__res, { x: ${sh.sb.centroid.x}, y: ${sh.sb.centroid.y} }, ${flip})`, Object.assign(sh.sb, { __res: res })); return J(sh.sb.__log); });
    out.push({ id: k + ':' + p.ids.join(','), data: sha(data), draw: sha(logs.join('|')), n: res.faces.length });
  }
  return out;
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
if (require.main === module) {
  const cmd = process.argv[2], file = process.argv[3];
  if (cmd === 'corpus') { const c = corpus(); fs.writeFileSync(file, J(c)); console.log('patterns', c.length); }
  else if (cmd === 'corpus-cmp') {
    const ref = JSON.parse(fs.readFileSync(file, 'utf8')), now = corpus();
    const d = now.filter((x, i) => ref[i] && ref[i].id === x.id && ref[i].data === x.data).length, w = now.filter((x, i) => ref[i] && ref[i].id === x.id && ref[i].draw === x.draw).length;
    console.log(`patterns ${now.length}/${ref.length}: data identical ${d}, draw call log identical ${w}, drawn in another order ${now.length - w}`);
    process.exit(d === ref.length && w === ref.length ? 0 : 1);
  } else if (cmd === 'anim') {
    const shard = (process.argv[4] && /^\d+\/\d+$/.test(process.argv[4])) ? process.argv[4].split('/').map(Number) : [0, 1];
    const jobs = []; A.CONFIGS.forEach((cfg, ci) => { for (let s = 1; s <= 30; s++) jobs.push({ ci, s }); });
    const res = {};
    jobs.filter((_, k) => k % shard[1] === shard[0]).forEach(({ ci, s }) => {
      const w = M.buildAna(A.CONFIGS[ci], s, 'base'); const data = [], order = [];
      w.set('globalThis.__calls = []; { const d = drawFaceFillsAtTile; drawFaceFillsAtTile = function (r) { const a = __polys.length; const x = d.apply(this, arguments); __calls.push(__polys.slice(a).map((q) => q.f + ":" + q.p.length).join(",")); return x; }; }');
      for (let i = 0; i < A.NT; i++) { w.set('globalThis.__calls.length = 0;'); M.frameInfo(w, i); const r = w.get('(function () { var l = globalThis.__anaGet(); return l && l.result ? JSON.stringify(l.result) : ""; })()'); data.push(sha(r)); order.push(sha(w.get('JSON.stringify(globalThis.__calls)'))); }
      res[ci + '/' + s] = { data: sha(data.join()), order: sha(order.join()) };
    });
    fs.writeFileSync(file, J(res)); console.log('runs', Object.keys(res).length);
  }
}
module.exports = { corpus };
