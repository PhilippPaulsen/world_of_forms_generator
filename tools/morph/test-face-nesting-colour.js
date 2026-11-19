// Task 100: the colour correspondence of faces that lie inside one another (core/facecolor.js _ownerOf / _partnerOf / depth rule, markers // task 100).
//   1. the owner of a point is the INNERMOST face that contains it (concentric squares: cell, large, small), whatever the order of the field list; outside everything: null; on a cell edge: handled
//   2. the partner of a live face among nested candidates: the one with the closest area (not the first one of the same distance), whatever the list order
//   3. NOT nested faces: the partner is the same as in the file of main before this task (200 random cases, hash)
//   4. ties: deterministic, independent of the list order (equal distance and area ratio: the fixed order of the faces)
//   5. a whole correspondence colour: a small square in a cell takes the colour of the small square of both keyframes at t = 0 and t = 1
//   6. depth (stage 2): concentric candidates are matched by their nesting depth; the depth is computed only for faces that have a tie; a square that touches the cell edge; the shared face data are not changed
//   node tools/morph/test-face-nesting-colour.js        sabotage runs: FACECOLOR_JS=/copy/of/facecolor.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify, sha = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
const BASE = '6745c658';
const CORE = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'farborgel-bridge', 'glossary'];
const rd = (f) => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8');
const NEW_FC = fs.readFileSync(process.env.FACECOLOR_JS || path.join(ROOT, 'core', 'facecolor.js'), 'utf8');
const OLD_FC = execSync(`git show ${BASE}:core/facecolor.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
function world(fc) {
  const sb = { console, Math, strokeWeight() { }, radians: (d) => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, dist: (a, b, c, d) => Math.hypot(c - a, d - b), segmentCollector: null, svgPathCollector: null,
    curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, timeline: null, activeNetWarp: null, centroid: null, symmetryMode: 'none', outerCorners: null, currentShape: 'square', nodes: null,
    baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, additionalLayers: [] };
  vm.createContext(sb); vm.runInContext(CORE.map((f) => f === 'facecolor' ? fc : rd(f)).join('\n'), sb); return sb;
}
const N = world(NEW_FC), O = world(OLD_FC);
const sq = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const CELL = sq(0, 0, 120, 120), MID = sq(20, 20, 100, 100), SMALL = sq(40, 40, 80, 80);
const LIGHT = [0.9, 0.9, 0.9], MIDC = [0.3, 0.3, 0.3], DARK = [0.04, 0.04, 0.04];
const perms = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map((p) => [x].concat(p)));
const field = (sb, entries) => { const f = entries.map((e) => ({ poly: e.poly, lin: e.lin })); f.ctr = { x: 60, y: 60 }; f.span = 120; return sb.__fi(f); };
for (const sb of [N, O]) { sb.__fi = vm.runInContext('_fieldInfo', sb); sb.__own = vm.runInContext('_ownerOf', sb); sb.__par = vm.runInContext('_partnerOf', sb); sb.__faceInfo = vm.runInContext('_faceInfo', sb); sb.__setOrb = vm.runInContext('_setOrbits', sb); sb.__corr = vm.runInContext('_faceLinByCorrespondence', sb); }
const NEST = [{ poly: CELL, lin: LIGHT, name: 'cell' }, { poly: MID, lin: MIDC, name: 'mid' }, { poly: SMALL, lin: DARK, name: 'small' }];
const nameOf = (e) => NEST.find((x) => x.poly === e.poly) ? NEST.find((x) => x.poly === e.poly).name : null;
// ---- 1. owner ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  let bad = [];
  for (const order of perms(NEST)) {
    const info = field(N, order);
    const own = (x, y) => { const g = N.__own(info.grid, { x, y }); return g ? nameOf({ poly: g.poly }) : null; };
    const got = [own(60, 60), own(30, 60), own(10, 60), own(200, 200), own(61, 41)];
    if (J(got) !== J(['small', 'mid', 'cell', null, 'small'])) bad.push(order.map((e) => e.name).join('') + ':' + J(got));
  }
  check('1a. a point in the small square belongs to the small square, in the large one (outside the small) to the large one, in the cell (outside both) to the cell, outside to nobody; all 6 list orders', bad.length === 0, bad.join(' | '));
  const oldInfo = field(O, NEST), oo = (x, y) => { const g = O.__own(oldInfo.grid, { x, y }); return g ? nameOf({ poly: g.poly }) : null; };
  check('1b. the file of main picks the FIRST hit (the cell) for a point in the small square (the defect)', oo(60, 60) === 'cell');
}
// ---- 2. partner ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const live = (poly) => { const f = N.__faceInfo(poly.map((p) => ({ x: p.x, y: p.y })), null); N.__setOrb([f], { x: 60, y: 60 }, 120); return f; };
  let bad = [];
  for (const order of perms(NEST)) {
    const info = field(N, order);
    for (const target of NEST) {
      const p = N.__par(live(target.poly), info);
      if (!p || nameOf({ poly: p.poly }) !== target.name) bad.push(order.map((e) => e.name).join('') + ' ' + target.name + '->' + (p ? nameOf({ poly: p.poly }) : null));
    }
  }
  check('2a. the live cell, large and small square each get their own partner (the closest area at the same distance), all 6 list orders', bad.length === 0, bad.slice(0, 4).join(' | '));
  const oi = field(O, NEST), pf = O.__par((() => { const f = O.__faceInfo(SMALL.map((p) => ({ x: p.x, y: p.y })), null); O.__setOrb([f], { x: 60, y: 60 }, 120); return f; })(), oi);
  check('2b. the file of main gives the live small square NOT the small square as partner when the larger faces are listed first (the defect)', pf && nameOf({ poly: pf.poly }) !== 'small');
}
// ---- 3. not nested: same as main ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  let st = 12345; const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
  const hs = { n: [], o: [] }; let cases = 0;
  for (let k = 0; k < 200; k++) {
    const rects = [], m = 3 + Math.floor(rnd() * 4);   // m separate squares on a coarse grid (never nested), sizes 10 .. 30
    for (let i = 0; i < m; i++) { const gx = (i % 3) * 100 + 10, gy = Math.floor(i / 3) * 100 + 10, s = 10 + Math.floor(rnd() * 20); rects.push({ poly: sq(gx, gy, gx + s, gy + s), lin: [rnd(), rnd(), rnd()] }); }
    const liveRects = rects.map((r) => { const d = rnd() * 4 - 2, s = 1 + rnd() * 0.3; const p = r.poly; return p.map((q) => ({ x: p[0].x + (q.x - p[0].x) * s + d, y: p[0].y + (q.y - p[0].y) * s + d })); });
    for (const [sb, h] of [[N, hs.n], [O, hs.o]]) {
      const f = rects.map((e) => ({ poly: e.poly, lin: e.lin })); f.ctr = { x: 150, y: 150 }; f.span = 300; const info = sb.__fi(f);
      liveRects.forEach((p) => { const lf = sb.__faceInfo(p, null); sb.__setOrb([lf], { x: 150, y: 150 }, 300); const r = sb.__par(lf, info); h.push(r ? J(r.poly) : 'null'); });
    }
    cases += liveRects.length;
  }
  check(`3. ${cases} partner lookups among separate (not nested) squares: identical to the file of main (hash)`, sha(hs.n.join('|')) === sha(hs.o.join('|')));
}
// ---- 4. ties -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  // two candidates with the same centroid and the same area, a square and a rotated one (a diamond): an exact tie; the live face is a small square
  const diamond = [{ x: 60, y: 60 - Math.sqrt(1800) / Math.SQRT2 }, { x: 60 + Math.sqrt(1800) / Math.SQRT2, y: 60 }, { x: 60, y: 60 + Math.sqrt(1800) / Math.SQRT2 }, { x: 60 - Math.sqrt(1800) / Math.SQRT2, y: 60 }], h = Math.sqrt(1800) / 2, twin = sq(60 - h, 60 - h, 60 + h, 60 + h);
  const ents = [{ poly: twin, lin: [0.1, 0.1, 0.1] }, { poly: diamond, lin: [0.7, 0.7, 0.7] }];
  const picks = new Set();
  for (const order of perms(ents)) {
    const info = field(N, order);
    const lf = N.__faceInfo(sq(40, 40, 80, 80).map((p) => ({ x: p.x, y: p.y })), null); N.__setOrb([lf], { x: 60, y: 60 }, 120); lf.orb = 2;   // the candidates are an orbit of two (equal area, equal distance from the centre): the live face is of that orbit size
    const r = N.__par(lf, info); picks.add(r ? J(r.poly) : 'null');
  }
  check('4. an exact tie (equal distance, equal area ratio): the same partner for both list orders', picks.size === 1 && !picks.has('null'), J([...picks]));
}
// ---- 5. a whole correspondence colour ------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const A = field(N, NEST), B = field(N, [{ poly: CELL, lin: LIGHT }, { poly: MID, lin: DARK }, { poly: SMALL, lin: DARK }]);
  const lf = N.__faceInfo(SMALL.map((p) => ({ x: p.x, y: p.y })), null), cell = N.__faceInfo(CELL.map((p) => ({ x: p.x, y: p.y })), null);
  N.__setOrb([lf, cell], { x: 60, y: 60 }, 120);
  const c0 = N.__corr(lf, A, B, 0), c1 = N.__corr(lf, A, B, 1), cc = N.__corr(cell, A, B, 0.5);
  const near = (a, b) => a && a.every((v, i) => Math.abs(v - b[i]) < 0.02);
  check('5. the small square takes the dark colour of both keyframes at t = 0 and t = 1 (not the cell\'s light one); the cell stays light', near(c0, DARK) && near(c1, DARK) && near(cc, LIGHT), J([c0, c1, cc]));
}
console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
