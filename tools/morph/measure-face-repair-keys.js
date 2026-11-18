// Task 094, part 4: effect of the prototype repairs of core/faces.js (copies, see measure-face-artifacts.js variantSource) on the 258-pattern corpus of tools/color/corpus.js (the colour "baselines"):
//   (a) per pattern: number of faces and the SET OF TRAIL KEYS (computeFaceTrails) base vs variant -> patterns whose faces or keys change (= colour assignments that would be lost / re-keyed),
//   (b) stability against the image centre: the same pattern built around (300,300) and around 3 shifted centres: patterns whose face count depends on the centre, base vs variant.
//   node tools/morph/measure-face-repair-keys.js [rel|col|repair ...]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const C = require('../color/corpus.js');
const { variantSource } = require('./measure-face-artifacts.js');
const CORE = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'farborgel-bridge', 'glossary'];
const srcWith = (v) => CORE.map((f) => (f === 'faces' && v !== 'base') ? variantSource(v) : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const BUILDERS = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };
function sheetAt(shape, order, mode, src, cx, cy) {   // makeSheet with another image centre
    const sh = C.makeSheet(shape, order, mode, src);
    if (cx === 300 && cy === 300) return sh;
    const sb = sh.sb, grid = sb[BUILDERS[shape]](order, 1.3, cx, cy);
    sb.nodes = grid.nodes; sb.centroid = grid.centroid; sb.outerCorners = grid.outerCorners;
    const table = sb.computeThemeLineOrbits(grid.nodes, grid.centroid, shape, mode, grid.outerCorners);
    const reps = table.orbits.map((o) => o.pairs[0]);
    const group = sb.getGroupElementsCached(grid.nodes, grid.centroid, shape, mode, grid.outerCorners);
    return { sb, grid, table, reps, group, faces: (ids) => sb.computeCellFaces(ids.map((i) => reps[i]), grid.nodes) };
}
function snapshot(sh, ids) {
    const res = sh.faces(ids);
    const keys = sh.sb.computeFaceTrails(res, sh.group).map((t) => t.key).sort();
    return { n: res.faces.length, keys };
}
const SHIFTS = [[300, 300], [300.37, 299.61], [312.5, 288.2], [271.13, 305.77]];
function runVariant(v, patterns) {
    const src = srcWith(v), cache = new Map();
    const out = [];
    for (const p of patterns) {
        const cfg = p.sh.label.split('/'), ck = (s) => cfg.join('/') + '@' + s.join(',');
        const snaps = SHIFTS.map((s) => { const k = ck(s); if (!cache.has(k)) cache.set(k, sheetAt(cfg[0], +cfg[1], cfg[2], src, s[0], s[1])); return snapshot(cache.get(k), p.ids); });
        out.push(snaps);
    }
    return out;
}
function main() {
    const variants = process.argv.slice(2).length ? process.argv.slice(2) : ['rel', 'col', 'repair'];
    const patterns = C.buildPatterns();   // built with the working tree's faces.js: the 258 patterns (ids are orbit indices, independent of faces.js)
    console.log('patterns', patterns.length);
    const base = runVariant('base', patterns);
    const centreDep = (r) => r.filter((s) => s.some((x) => x.n !== s[0].n)).length;
    const centreKeyDep = (r) => r.filter((s) => s.some((x) => x.keys.join('|') !== s[0].keys.join('|'))).length;
    console.log(`base: patterns whose face count depends on the image centre: ${centreDep(base)}/${base.length}; whose trail-key set depends on it: ${centreKeyDep(base)}/${base.length}`);
    for (const v of variants) {
        const r = runVariant(v, patterns);
        const nChg = r.filter((s, i) => s[0].n !== base[i][0].n).length, kChg = r.filter((s, i) => s[0].keys.join('|') !== base[i][0].keys.join('|')).length;
        const examples = r.map((s, i) => [i, base[i][0].n, s[0].n]).filter((x) => x[1] !== x[2]).slice(0, 5);
        console.log(`${v}: patterns with another face count vs base ${nChg}/${r.length}; with another trail-key set ${kChg}/${r.length}; centre-dependent face count ${centreDep(r)}/${r.length}, key set ${centreKeyDep(r)}/${r.length}; examples [idx,base,var] ${JSON.stringify(examples)}`);
    }
}
if (require.main === module) main();
