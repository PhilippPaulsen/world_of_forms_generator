// Task 102 (only measuring): a cell line that lies within FACE_EPSILON of the cell border / of another line (near-collinear, not exactly) makes the face finder lose a region (Quadrat, Paar 26: 14 985 of 40 000 px2 missing).
//   node tools/morph/measure-border-102.js case        the cell of the case: missing area against FACE_EPSILON and against the prototype 'shadow'
//   node tools/morph/measure-border-102.js runs [n]    the 94/95 morph runs (33 sheets x none/field x 4 pairs x 41 frames) with FACES_JS = base or the prototype: frames with a hole > 5000 px2, face counts
// Prototype 'shadow' (copy of core/faces.js in the OS temp dir, only with faceRepairCollinear on = the morph's cell faces): a segment whose BOTH ends lie within FACE_EPSILON of a longer (or equal, lower index) segment is dropped before the split.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..', '..');
const A = require('./measure-face-artifacts.js');
const SRC = fs.readFileSync(path.join(ROOT, 'core', 'faces.js'), 'utf8');
const ANCHOR = '    const deduped = dedupeSegments(segments);\n';
if (!SRC.includes(ANCHOR)) throw new Error('anchor missing');
const FN = `function _dropShadowed(segs) {
    const len = (s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    const dist = (px, py, b) => { const dx = b.x2 - b.x1, dy = b.y2 - b.y1, L2 = dx * dx + dy * dy; const t = L2 > 0 ? Math.max(0, Math.min(1, ((px - b.x1) * dx + (py - b.y1) * dy) / L2)) : 0; return Math.hypot(px - (b.x1 + t * dx), py - (b.y1 + t * dy)); };
    const L = segs.map(len), drop = new Array(segs.length).fill(false);
    for (let i = 0; i < segs.length; i++) for (let j = 0; j < segs.length; j++) {
        if (i === j || drop[j] || L[j] < L[i] - 1e-9 || (Math.abs(L[j] - L[i]) <= 1e-9 && j > i)) continue;
        const a = segs[i], b = segs[j];
        if (dist(a.x1, a.y1, b) <= FACE_EPSILON && dist(a.x2, a.y2, b) <= FACE_EPSILON) { drop[i] = true; break; }
    }
    return segs.filter((_, i) => !drop[i]);
}
`;
const PROTO = SRC.replace(ANCHOR, '    let deduped = dedupeSegments(segments);\n    if (faceRepairCollinear) deduped = _dropShadowed(deduped);\n').replace('function findFaces(segments, realNodes) {', FN + 'function findFaces(segments, realNodes) {');
const protoFile = path.join(os.tmpdir(), `faces102-${process.pid}.js`); fs.writeFileSync(protoFile, PROTO); process.on('exit', () => { try { fs.unlinkSync(protoFile); } catch (e) { } });
if (process.argv[2] === 'case') {
  const lines = [[400, 399.08, 399.69, 200], [350, 400, 299.69, 300], [350, 250.31, 350.31, 400]].map((l) => [{ x: l[0], y: l[1] }, { x: l[2], y: l[3] }]);
  for (const v of ['base', 'eps0.05', 'eps0.2', 'eps0.3', 'shadow']) {
    if (v === 'shadow') process.env.FACES_JS = protoFile;
    const w = A.build(A.CONFIGS[8], 'none', 26, 'morph', v === 'shadow' ? 'base' : v);
    const r = JSON.parse(w.get(`JSON.stringify((function(){const s=spatialMorphRenderSource({ids:['base']});const r=spatialMorphRenderTileFaces(${JSON.stringify(lines)},s,null);return {n:r.faces.length,sum:r.faces.reduce((p,f)=>p+f.area,0)};})())`));
    console.log(v.padEnd(8), 'faces', r.n, 'sum', Math.round(r.sum), 'missing', Math.round(40000 - r.sum));
  }
} else if (process.argv[2] === 'runs') {
  const shard = (process.argv[3] || '0/1').split('/').map(Number), variant = process.argv[4] || 'base', out = process.argv[5];
  if (variant === 'shadow') process.env.FACES_JS = protoFile;
  const jobs = []; A.CONFIGS.forEach((cfg, ci) => { for (const net of ['none', 'field']) for (let s = 1; s <= 4; s++) jobs.push({ ci, net, s }); });
  const res = [];
  jobs.filter((_, k) => k % shard[1] === shard[0]).forEach(({ ci, net, s }) => {
    const cfg = A.CONFIGS[ci], acc = A.acceptedSeed(cfg, net, s, 'morph'), w = A.build(cfg, net, acc.seed, 'morph', 'base'); w.set('if (typeof spatialMorphRenderGrow === "function") spatialMorphRenderGrow = (p) => p;');
    let holes = 0, faces = 0, maxGap = 0; for (let i = 0; i < A.NT; i += 2) { const a = A.analyseFrame(A.frameAt(w, i / 40), w.dims); faces += a.n; if (a.gapPx2 > 5000) { holes++; maxGap = Math.max(maxGap, a.gapPx2); } }
    res.push({ ci, net, seed: acc.seed, holes, faces, maxGap });
  });
  fs.writeFileSync(out, JSON.stringify({ variant, results: res }));
}
