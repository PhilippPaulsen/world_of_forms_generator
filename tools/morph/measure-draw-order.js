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
if (require.main === module && process.argv[2] === 'time') {
  const OLDF = path.join(ROOT, 'reports', 'logs', '098-basis-faces.js');   // core/faces.js of main before this task (git show 4faaa8d8)
  const buildWith = (file, ci, seed) => { const keep = process.env.FACES_JS; process.env.FACES_JS = file; try { return M.buildAna(A.CONFIGS[ci], seed, 'base'); } finally { if (keep === undefined) delete process.env.FACES_JS; else process.env.FACES_JS = keep; } };
  const NEWF = path.join(ROOT, 'core', 'faces.js'), med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  // animation: 4 runs with a reordered frame and 4 without, 41 frames each, old and new back to back per frame (ABBA)
  let so = 0, sn = 0; const rows = [];
  for (const [ci, seed] of [[29, 28], [8, 26], [29, 29], [18, 20], [4, 3], [15, 5], [26, 7], [11, 2]]) {
    const o = buildWith(OLDF, ci, seed), n = buildWith(NEWF, ci, seed), to = [], tn = [];
    const one = (w, t) => { const t0 = process.hrtime.bigint(); A.frameAt(w, t); return Number(process.hrtime.bigint() - t0) / 1e6; };
    for (let i = 0; i < 41; i++) { const t = i / 40; if (i % 2) { to.push(one(o, t)); tn.push(one(n, t)); } else { tn.push(one(n, t)); to.push(one(o, t)); } }
    const a = to.reduce((x, y) => x + y, 0), b = tn.reduce((x, y) => x + y, 0); so += a; sn += b; rows.push(`${ci}/${seed}: ${a.toFixed(0)} -> ${b.toFixed(0)} ms (${((b / a - 1) * 100).toFixed(1)} %)`);
  }
  console.log('animation (sum over 41 frames):', rows.join(' | '), `| total ${so.toFixed(0)} -> ${sn.toFixed(0)} ms (${((sn / so - 1) * 100).toFixed(1)} %)`);
  // static: the draw of all 258 corpus patterns (one tile, flip false), old and new interleaved, 15 rounds
  const vm = require('vm'), pats = C.buildPatterns();
  const prep = (txt) => { const CORE = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'farborgel-bridge', 'glossary']; const src = CORE.map((f) => f === 'faces' ? txt : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n'); const m = new Map(); return (p) => { const [shape, ord, mode] = p.sh.label.split('/'), k = p.sh.label; if (!m.has(k)) { const sh = C.makeSheet(shape, +ord, mode, src); vm.runInContext(P5, sh.sb); m.set(k, sh); } const sh = m.get(k); return { sh, res: sh.faces(p.ids) }; }; };
  const getO = prep(fs.readFileSync(OLDF, 'utf8')), getN = prep(fs.readFileSync(NEWF, 'utf8'));
  const PO = pats.map(getO), PN = pats.map(getN);
  const draw = (P) => { const t0 = process.hrtime.bigint(); for (let r = 0; r < 20; r++) for (const x of P) { x.sh.sb.__log.length = 0; x.sh.sb.__res = x.res; vm.runInContext(`drawFaceFillsAtTile(__res, { x: ${x.sh.sb.centroid.x}, y: ${x.sh.sb.centroid.y} }, false)`, x.sh.sb); } return Number(process.hrtime.bigint() - t0) / 1e6; };
  draw(PO); draw(PN); const ta = [], tb = [];
  for (let i = 0; i < 15; i++) { if (i % 2) { ta.push(draw(PO)); tb.push(draw(PN)); } else { tb.push(draw(PN)); ta.push(draw(PO)); } }
  console.log(`static corpus draw (258 patterns x 20): old ${med(ta).toFixed(1)} ms, new ${med(tb).toFixed(1)} ms (${((med(tb) / med(ta) - 1) * 100).toFixed(1)} %)`);
}
module.exports = { corpus };
