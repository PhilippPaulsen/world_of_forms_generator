// Task 097, parts 3 and 4: overlaps of the face polygons in the STATIC pattern (the 258 patterns of tools/color/corpus.js: computeCellFaces on a regular sheet, the path of the normal draw), and the effect of a prototype of
// core/faces.js findFaces (copy, OS temp dir; 'sorted' = faces in painter order, the largest first) on the same patterns: overlaps, the painter's error, face count, trail-key sets, time.
//   node tools/morph/measure-corpus-overlap.js [sorted ...]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const C = require('../color/corpus.js');
const { overlapPairs } = require('./measure-anim-overlap.js');
const CORE = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'farborgel-bridge', 'glossary'];
const FACES_SRC = fs.readFileSync(path.join(ROOT, 'core', 'faces.js'), 'utf8');
const PROTOS = { sorted: (t) => t.replace("    const totalOrbits = deduped.reduce(", "    bounded.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));\n    const totalOrbits = deduped.reduce(") };
PROTOS.sortedMulti = (t) => t.replace("    const totalOrbits = deduped.reduce(", "    if (components.length > 1) bounded.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));\n    const totalOrbits = deduped.reduce(");
const srcOf = (v) => CORE.map((f) => f === 'faces' && v !== 'base' ? PROTOS[v](FACES_SRC) : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
function measure(v, patterns) {
  const src = srcOf(v), sheets = new Map(), out = { patterns: 0, withOverlap: 0, overlapPx2: 0, wrongPx2: 0, faces: 0, keys: [], counts: [], orders: [], ms: 0, worst: [] };
  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i], [shape, order, mode] = p.sh.label.split('/'), k = p.sh.label;
    if (!sheets.has(k)) sheets.set(k, C.makeSheet(shape, +order, mode, src));
    const sh = sheets.get(k), t0 = process.hrtime.bigint(), res = sh.faces(p.ids); out.ms += Number(process.hrtime.bigint() - t0) / 1e6;
    const byId = new Map(res.nodes.map((n) => [n.id, n]));
    const an = { faces: res.faces.map((f) => ({ area: f.area, poly: f.nodeIds.map((id) => { const n = byId.get(id); return [n.x, n.y]; }) })) };
    const ov = overlapPairs(an);
    out.orders.push(res.faces.map((f) => f.nodeIds.join(',')).join(';')); out.patterns++; out.faces += res.faces.length; out.counts.push(res.faces.length);
    out.keys.push(sh.sb.computeFaceTrails(res, sh.group).map((t) => t.key).sort().join('|'));
    if (ov.total > 1) { out.withOverlap++; out.overlapPx2 += ov.total; out.wrongPx2 += ov.wrong; out.worst.push([i, p.sh.label, Math.round(ov.total), Math.round(ov.wrong)]); }
  }
  out.worst.sort((a, b) => b[3] - a[3]); out.worst = out.worst.slice(0, 5);
  return out;
}
const patterns = C.buildPatterns();
const base = measure('base', patterns);
console.log(`base: ${base.patterns} patterns, ${base.faces} faces, patterns with overlapping face polygons ${base.withOverlap}, overlap ${Math.round(base.overlapPx2)} px2, painter error ${Math.round(base.wrongPx2)} px2, ${base.ms.toFixed(0)} ms`, JSON.stringify(base.worst));
for (const v of (process.argv.slice(2).length ? process.argv.slice(2) : ['sorted','sortedMulti'])) {
  const r = measure(v, patterns);
  const oChg = r.orders.filter((k, i) => k !== base.orders[i]).length, kChg = r.keys.filter((k, i) => k !== base.keys[i]).length, nChg = r.counts.filter((n, i) => n !== base.counts[i]).length;
  console.log(`${v}: patterns with overlap ${r.withOverlap}, overlap ${Math.round(r.overlapPx2)} px2, painter error ${Math.round(r.wrongPx2)} px2, trail-key sets changed ${kChg}/${r.patterns}, face counts changed ${nChg}/${r.patterns}, face ORDER changed ${oChg}/${r.patterns}, ${r.ms.toFixed(0)} ms (base ${base.ms.toFixed(0)})`);
}
