// Task 097 (Typ R, nur messen): overlaps of the face fills in the timeline ANIMATION (playback layer, the NORMAL face pass: core/tiling.js -> computeCellFaces -> core/faces.js findFaces) and their cause.
//   node tools/morph/measure-anim-overlap.js one <cfgIndex> <seed> <tIndex> [variant] [out.png]     analysis of ONE frame (JSON) and its picture (overlap blue, gap red)
//   node tools/morph/measure-anim-overlap.js scan [--seeds N] [--variant v] [--shard i/n] [--out f.json]   all 33 sheets x seeds 1..N (animation, 41 steps): frames with overlap, with the analysis of each
//   node tools/morph/measure-anim-overlap.js sum f.json ...
// The frame comes from tools/morph/measure-face-artifacts.js (build / frameAt, mode 'anim'); the analysis runs INSIDE the vm on the segments findFaces was given (core/faces.js functions, read only):
// connected components, the signed areas of their traces, which branch of findFaces decided, and which faces overlap in the cell (1 px raster of the cell, pairs of faces with the overlapped area).
// Variants: 'base' = the working tree; 'outer' = the prototype of part 4 (a copy of core/faces.js in the OS temp dir, see variantSource below); 'old' = core/faces.js of main before 095.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const A = require('./measure-face-artifacts.js');
const R = require('./measure-face-artifacts-report.js');
const ROOT = path.join(__dirname, '..', '..');

// code run in the vm: the analysis of one findFaces call
const ANALYSE = `
(function __anaDef() {
  var __last = null, __orig = findFaces;
  findFaces = function (segments, realNodes) { var r = __orig.apply(this, arguments); __last = { segments: segments.map(function (s) { return Object.assign({}, s); }), realNodes: realNodes, result: r }; return r; };
  globalThis.__anaGet = function () { return __last; };
  globalThis.__anaRun = function () {
    var L = __last; if (!L) return null;
    var deduped = dedupeSegments(L.segments), sp = splitSegments(deduped, L.realNodes), nodes = sp.nodes, edges = sp.edges;
    if (!edges.length) return { comps: [], faces: [], nodes: nodes.length, edges: 0 };
    var nodeById = new Map(nodes.map(function (n) { return [n.id, n]; }));
    var adj = _buildFaceAdjacency(nodes, edges), bnds = _traceAllFaceBoundaries(nodes, edges, adj);
    var traced = bnds.map(function (b) { return { boundary: b, area: _signedArea(b, nodeById) }; }).filter(function (f) { return Math.abs(f.area) > 1e-6; });
    var comps = _connectedComponents(nodes, edges), compOf = new Map(); comps.forEach(function (c, i) { c.forEach(function (id) { compOf.set(id, i); }); });
    var out = [], faces = [];
    comps.forEach(function (c, idx) {
      var ct = traced.filter(function (f) { return compOf.get(f.boundary[0]) === idx; });
      if (!ct.length) { out.push({ id: idx, nodes: c.size, traces: 0 }); return; }
      var pos = ct.filter(function (f) { return f.area > 0; }), neg = ct.filter(function (f) { return f.area < 0; }), branch, bounded;
      if (pos.length === 1 && neg.length >= 1) { branch = 'one-positive'; bounded = neg; }
      else if (neg.length === 1 && pos.length >= 1) { branch = 'one-negative'; bounded = pos; }
      else { branch = 'ambiguous'; var s = ct.slice().sort(function (a, b) { return Math.abs(b.area) - Math.abs(a.area); }); bounded = s.slice(1); }
      var dropped = ct.filter(function (f) { return bounded.indexOf(f) < 0; });
      out.push({ id: idx, nodes: c.size, traces: ct.length, pos: pos.length, neg: neg.length, branch: branch, bounded: bounded.length, droppedArea: dropped.map(function (f) { return Math.round(f.area); }), keptAreas: bounded.map(function (f) { return Math.round(f.area); }).sort(function (a, b) { return Math.abs(b) - Math.abs(a); }).slice(0, 3) });
    });
    // the faces EXACTLY as findFaces returned them (list order = the order they are filled in; a prototype's ordering is in here), with their component
    var rn = new Map(L.result.nodes.map(function (n) { return [n.id, n]; }));
    var __ord = (typeof _faceDrawOrderResult === 'function') ? _faceDrawOrderResult(L.result) : null;   // task 098: the order the faces are DRAWN in (null = the data order)
    globalThis.__anaTriggered = !!__ord;
    (__ord ? __ord.faces : L.result.faces).forEach(function (f) { faces.push({ comp: compOf.get(f.nodeIds[0]), area: f.area, poly: f.nodeIds.map(function (id) { var n = rn.get(id); return [n.x, n.y]; }) }); });
    return { comps: out, faces: faces, nodes: nodes.length, edges: edges.length };
  };
})();`;

function variantFiles(v) { const f = A.variantFile(v); return f; }
// the faces of one analysed call -> overlap pairs in the cell (1 px raster, cap 400 x 400)
function overlapPairs(an) {
  const F = an.faces; if (!F.length) return { total: 0, wrong: 0, pairs: {} };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  F.forEach((f) => f.poly.forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }));
  const w = Math.min(400, Math.ceil(x1 - x0) + 1), h = Math.min(400, Math.ceil(y1 - y0) + 1), sx = w / Math.max(1e-9, x1 - x0 + 1e-9), sy = h / Math.max(1e-9, y1 - y0 + 1e-9);
  const cover = new Array(w * h);   // lists of face indexes
  F.forEach((f, fi) => {
    const P = f.poly, n = P.length;
    for (let r = 0; r < h; r++) {
      const y = y0 + (r + 0.6139) / sy, xs = [];   // sample points at an irregular offset: no sample sits on the lattice lines of the integer patterns (ties would count twice)
      for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let c = Math.max(0, Math.ceil((xs[k] - x0) * sx - 0.3712)); c <= Math.min(w - 1, Math.floor((xs[k + 1] - x0) * sx - 0.3712)); c++) { const i = r * w + c; (cover[i] = cover[i] || []).push(fi); }
    }
  });
  const pairs = {}; let total = 0, wrong = 0; const cell = 1 / (sx * sy);
  for (let i = 0; i < cover.length; i++) {
    const c = cover[i]; if (!c || c.length < 2) continue; total += cell;
    // what the painter shows: the face drawn LAST (faces are filled in list order); what is right: the innermost (smallest) of the faces that cover the pixel
    let inner = c[0]; for (const fi of c) if (Math.abs(F[fi].area) < Math.abs(F[inner].area)) inner = fi;
    if (c[c.length - 1] !== inner) wrong += cell; for (let a = 0; a < c.length; a++) for (let b = a + 1; b < c.length; b++) { const k = c[a] + '-' + c[b]; pairs[k] = (pairs[k] || 0) + cell; } }
  return { total, wrong, pairs, bbox: [x0, y0, x1, y1] };
}
// classification of an analysed frame (the dominant overlap relation)
function classify(an, ov) {
  if (!(ov.total > 1)) return { cls: 'none' };
  let sameComp = 0, diffComp = 0, nestedFaceOuter = 0, keptOuter = 0;
  for (const [k, area] of Object.entries(ov.pairs)) {
    const [a, b] = k.split('-').map(Number), fa = an.faces[a], fb = an.faces[b];
    if (fa.comp === fb.comp) sameComp += area; else diffComp += area;
  }
  // an AMBIGUOUS component keeps its outer face when ... (the fallback drops the largest |area| trace: wrong when two components or several positive and negative traces exist)
  const amb = an.comps.filter((c) => c.branch === 'ambiguous').length;
  const cls = diffComp >= sameComp ? 'c-components' : (amb ? 'a-outer-kept(ambiguous)' : 'a-outer-kept(sign)');
  return { cls, wrong: Math.round(ov.wrong), sameComp: Math.round(sameComp), diffComp: Math.round(diffComp), ambiguousComps: amb, comps: an.comps.length };
}
function analyseFrameAt(w, t) {
  A.frameAt(w, t);
  w.set('0');
  const an = w.get('(function(){ return globalThis.__anaRun && globalThis.__anaRun(); })()');
  return an ? JSON.parse(JSON.stringify(an)) : null;
}
// part 4: prototypes of findFaces in COPIES of core/faces.js (OS temp dir), loaded through FACES_JS (measure-face-artifacts.js: the 'base' variant reads it)
const FACES_SRC = fs.readFileSync(path.join(ROOT, 'core', 'faces.js'), 'utf8');
const PROTOS = {
  // faces in painter order: the largest first, so a face that contains another component is drawn BEFORE what lies inside it
  sorted: (t) => t.replace("    const totalOrbits = deduped.reduce(", "    bounded.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));\n    const totalOrbits = deduped.reduce("),
};
PROTOS.sortedMulti = (t) => t.replace("    const totalOrbits = deduped.reduce(", "    if (components.length > 1) bounded.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));   // only when the pattern has several connected components (nesting is possible)\n    const totalOrbits = deduped.reduce(");
const protoFiles = {};
function protoFile(v) { if (!protoFiles[v]) { const p = path.join(os.tmpdir(), `faces097-${process.pid}-${v}.js`); const src = PROTOS[v](FACES_SRC); if (src === FACES_SRC) throw new Error('prototype anchor missing: ' + v); fs.writeFileSync(p, src); protoFiles[v] = p; } return protoFiles[v]; }
process.on('exit', () => { Object.values(protoFiles).forEach((p) => { try { fs.unlinkSync(p); } catch (e) { } }); });
function buildAna(cfg, seed, variant) {
  const proto = variant && PROTOS[variant];
  const keep = process.env.FACES_JS; if (proto) process.env.FACES_JS = protoFile(variant); else if (variant === 'old') { process.env.FACES_JS = A.variantFile('old'); }
  let w; try { w = A.build(cfg, 'none', seed, 'anim', 'base'); } finally { if (keep === undefined) delete process.env.FACES_JS; else process.env.FACES_JS = keep; }
  w.set(ANALYSE);
  return w;
}
function frameInfo(w, i) {
  const t = i / (A.NT - 1);
  const polys = A.frameAt(w, t), fa = A.analyseFrame(polys, w.dims);
  return { fa, polys, t };
}
module.exports = { ANALYSE, overlapPairs, classify, buildAna, frameInfo, analyseFrameAt };

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'one') {
    const [ci, seed, ti, variant, out] = process.argv.slice(3);
    const w = buildAna(A.CONFIGS[+ci], +seed, variant || 'base');
    const { fa, polys } = frameInfo(w, +ti);
    const an = w.get('globalThis.__anaRun()');
    const ov = overlapPairs(an), cl = classify(an, ov);
    console.log(JSON.stringify({ cfg: A.CONFIGS[+ci], seed: +seed, t: +ti, overPx2: fa.overPx2, gapPx2: fa.gapPx2, n: fa.n, comps: an.comps, faces: an.faces.length, overlapCellPx2: Math.round(ov.total), wrongCellPx2: cl.wrong, class: cl }));
    if (out) {   // the picture as the painter shows it (plain: no overlap / gap marking), the prototype through FACES_JS
      const keep = process.env.FACES_JS; if (variant && PROTOS[variant]) process.env.FACES_JS = protoFile(variant);
      try { require('./measure-face-artifacts-report.js').drawFrame(A, +ci, 'none', +seed, 'anim', +ti, 'base', out, { plain: true }); } finally { if (keep === undefined) delete process.env.FACES_JS; else process.env.FACES_JS = keep; }
    }
  } else if (cmd === 'scan') {
    const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
    const seeds = +arg('--seeds', 30), variant = arg('--variant', 'base'), shard = arg('--shard', '0/1').split('/').map(Number), outf = arg('--out', null);
    const jobs = []; A.CONFIGS.forEach((cfg, ci) => { for (let s = 1; s <= seeds; s++) jobs.push({ ci, s }); });
    const res = [];
    jobs.filter((_, k) => k % shard[1] === shard[0]).forEach(({ ci, s }) => {
      const cfg = A.CONFIGS[ci]; let w;
      try { w = buildAna(cfg, s, variant); } catch (e) { res.push({ ci, seed: s, error: String(e).slice(0, 120) }); return; }
      const rec = { ci, seed: s, frames: 0, zero: 0, over: [], gapPx2Sum: 0 };
      for (let i = 0; i < A.NT; i++) {
        let fi; try { fi = frameInfo(w, i); } catch (e) { rec.error = String(e).slice(0, 120); break; }
        rec.frames++; if (fi.fa.n === 0) rec.zero++;
        else { const trig = w.get('(function () { var l = globalThis.__anaGet(); return l && l.result && typeof _faceDrawOrderResult === "function" ? !!_faceDrawOrderResult(l.result) : false; })()'); if (trig) { rec.trig = (rec.trig || 0) + 1; if (!(fi.fa.overPx2 > 0)) rec.trigNoOverlap = (rec.trigNoOverlap || 0) + 1; } }
        if (fi.fa.overPx2 > 0) {
          const an = w.get('globalThis.__anaRun()'); const ov = an ? overlapPairs(an) : { total: 0, pairs: {} }, cl = an ? classify(an, ov) : { cls: 'noanalysis' };
          rec.over.push({ i, overPx2: fi.fa.overPx2, gapPx2: fi.fa.gapPx2, n: fi.fa.n, cellOverlap: Math.round(ov.total), wrong: cl.wrong, cls: cl.cls, same: cl.sameComp, diff: cl.diffComp, comps: an && an.comps.map((c) => [c.nodes, c.pos, c.neg, c.branch, c.bounded]) });
        }
      }
      res.push(rec);
    });
    const o = JSON.stringify({ variant, shard, results: res }); if (outf) fs.writeFileSync(outf, o); else console.log(o);
  } else if (cmd === 'sum') {
    const all = []; process.argv.slice(3).forEach((f) => JSON.parse(fs.readFileSync(f, 'utf8')).results.forEach((r) => all.push(r)));
    const runs = all.length, withOver = all.filter((r) => r.over && r.over.length), frames = all.reduce((s, r) => s + (r.frames || 0), 0), overFrames = withOver.reduce((s, r) => s + r.over.length, 0);
    console.log(`runs ${runs}, frames ${frames}, runs with overlap ${withOver.length}, overlap frames ${overFrames}, errors ${all.filter((r) => r.error).length}`);
    const by = {}; withOver.forEach((r) => r.over.forEach((o) => { const k = A.CONFIGS[r.ci].shape + ' ' + o.cls; const e = by[k] = by[k] || { frames: 0, maxPx2: 0, sumPx2: 0 }; e.frames++; e.maxPx2 = Math.max(e.maxPx2, o.overPx2); e.sumPx2 += o.overPx2; }));
    console.log(JSON.stringify(by, null, 1));
    const cfgs = {}; withOver.forEach((r) => { const c = A.CONFIGS[r.ci]; const k = `${c.shape} ${c.sym} o${c.order} s${c.size}`; (cfgs[k] = cfgs[k] || []).push(r.seed + ':' + r.over.length); });
    console.log(JSON.stringify(cfgs));
  }
}
