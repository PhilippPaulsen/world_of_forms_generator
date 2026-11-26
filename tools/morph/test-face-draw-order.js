// Task 098: the DRAW ORDER of face fills (core/faces.js drawFaceFillsAtTile, helpers _faceDrawOrderResult / _computeFaceDrawOrderResult between the markers // task 098).
//   A component that lies inside a face of another component is covered by that face's full polygon when the face is filled after it. When the faces fall into several groups (shared nodes) and one group's bounding box
//   contains another's, the faces are filled largest |area| first (stable on ties); otherwise in data order. The DATA (the result of computeCellFaces / findFaces) is never touched.
//   1. nested: a small closed outline (one face) around a large pattern: the enclosing face is drawn BEFORE the inner faces, whichever order the data has
//   2. one component: the data order, also when the areas are not sorted; side-by-side components (no enclosure): the data order
//   3. a bounding-box enclosure WITHOUT nesting (an L shape around a small group): the filter fires (documented: it may fire, it never misses), the order is by area, nothing is lost
//   4. ties: stable (the data order among equal areas); the order does not depend on flip180 (decided in cell coordinates)
//   5. the data is byte-equal before and after drawing, the sorted copy holds the SAME face objects, the original array is not reordered
//   6. the cache: a result changed in place (a face added, the first face replaced) is not drawn in a stale order
//   7. computeCellFaces on 60 patterns of the colour corpus is byte-equal to the file of main before this task (the data), and their draw call logs too (one group: the data order)
//   8. the highlight outline pass is still drawn after the fills
//   node tools/morph/test-face-draw-order.js        sabotage runs: FACES_JS=/copy/of/faces.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const C = require('../color/corpus.js');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const BASE = '4faaa8d8';
const CORE = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'farborgel-bridge', 'glossary'];
const srcWith = (facesText) => CORE.map((f) => f === 'faces' ? facesText : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const NEW_TXT = fs.readFileSync(process.env.FACES_JS || path.join(ROOT, 'core', 'faces.js'), 'utf8');
const OLD_TXT = execSync(`git show ${BASE}:core/faces.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
const P5 = `var __log = [], __cur = null, __fill = null, __ops = []; var CLOSE = 'close';
  push = () => { }; pop = () => { }; noStroke = () => { }; noFill = () => { }; stroke = () => { __ops.push('stroke'); }; strokeWeight = () => { }; fill = (c) => { __fill = c; };
  beginShape = () => { __cur = []; }; vertex = (x, y) => { __cur.push([x, y]); }; endShape = () => { __log.push({ f: __fill, p: __cur }); __cur = null; };`;
function sheet(txt) { const sh = C.makeSheet('square', 3, 'rotation_reflection6', srcWith(txt)); vm.runInContext(P5, sh.sb); return sh; }
const NEW = sheet(NEW_TXT), OLD = sheet(OLD_TXT);
const order = (sh, res, flip) => { sh.sb.__log.length = 0; sh.sb.__res = res; vm.runInContext(`drawFaceFillsAtTile(__res, { x: ${sh.sb.centroid.x}, y: ${sh.sb.centroid.y} }, ${!!flip})`, sh.sb); return sh.sb.__log.map((q) => q.f); };
// a face result from rectangles: faces = [{ name, group, x0, y0, x1, y1 }]; each face gets its own four nodes (faces of one group share the node at their first corner) so the groups are the node-sharing sets
function mk(specs) {
  const nodes = [], faces = [], shared = new Map();
  specs.forEach((f, i) => {
    const ids = [], pts = [[f.x0, f.y0], [f.x1, f.y0], [f.x1, f.y1], [f.x0, f.y1]];
    pts.forEach((p, k) => {
      let id = k === 0 && f.group !== undefined ? 'g' + f.group : null;
      if (id && shared.has(id)) { ids.push(id); return; }
      id = id || 'n' + i + '_' + k; if (k === 0 && f.group !== undefined) shared.set(id, true);
      nodes.push({ id, x: p[0], y: p[1] }); ids.push(id);
    });
    faces.push({ nodeIds: ids, area: Math.abs((f.x1 - f.x0) * (f.y1 - f.y0)), connIndex: 0, sheets: [], color: f.name });
  });
  return { nodes, faces };
}
const names = (r) => r.faces.map((f) => f.color);
// ---- 1. nested -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const inner = [{ name: 'i1', group: 1, x0: 100, y0: 100, x1: 120, y1: 120 }, { name: 'i2', group: 1, x0: 130, y0: 100, x1: 150, y1: 120 }, { name: 'i3', group: 1, x0: 100, y0: 130, x1: 120, y1: 150 }];
  const outer = { name: 'OUT', group: 2, x0: 50, y0: 50, x1: 300, y1: 300 };
  const bad = mk(inner.concat([outer])), good = mk([outer].concat(inner));
  check('1a. data order inner first, enclosing face last (the bad order): the enclosing face is DRAWN first', J(order(NEW, bad)) === J(['OUT', 'i1', 'i2', 'i3']), J(order(NEW, bad)));
  check('1b. the OLD file draws it in the data order (the defect the order removes)', J(order(OLD, bad)) === J(['i1', 'i2', 'i3', 'OUT']), J(order(OLD, bad)));
  check('1c. data order enclosing face first: unchanged', J(order(NEW, good)) === J(['OUT', 'i1', 'i2', 'i3']));
}
// ---- 2. one component and side-by-side --------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const one = mk([{ name: 'a', group: 1, x0: 0, y0: 0, x1: 10, y1: 10 }, { name: 'b', group: 1, x0: 20, y0: 0, x1: 100, y1: 90 }, { name: 'c', group: 1, x0: 40, y0: 40, x1: 50, y1: 45 }]);
  check('2a. one component, areas not sorted: the data order', J(order(NEW, one)) === J(['a', 'b', 'c']));
  const side = mk([{ name: 's1', group: 1, x0: 0, y0: 0, x1: 10, y1: 10 }, { name: 'S2', group: 2, x0: 100, y0: 0, x1: 300, y1: 200 }, { name: 's3', group: 3, x0: 20, y0: 0, x1: 30, y1: 10 }]);
  check('2b. side-by-side components (no group box contains another): the data order', J(order(NEW, side)) === J(['s1', 'S2', 's3']));
  check('2c. an empty result and a single face are drawn without error', J(order(NEW, { nodes: [], faces: [] })) === '[]' && J(order(NEW, mk([{ name: 'x', x0: 0, y0: 0, x1: 5, y1: 5 }]))) === '["x"]');
}
// ---- 3. enclosure without nesting (the filter may fire) ---------------------------------------------------------------------------------------------------------------------------------------------------
{
  // an L shape (two faces of group 2) whose bounding box contains the small group 1, which lies in the notch, outside the L
  const L = [{ name: 'L1', group: 2, x0: 0, y0: 0, x1: 100, y1: 20 }, { name: 'L2', group: 2, x0: 0, y0: 0, x1: 20, y1: 100 }];
  const small = [{ name: 'sm', group: 1, x0: 60, y0: 60, x1: 70, y1: 70 }];
  const r = mk(small.concat(L)), o = order(NEW, r);
  check('3. a bounding-box enclosure without nesting: the filter fires, the faces are drawn by area, none is lost or doubled', o.length === 3 && new Set(o).size === 3 && J(o) === J(['L1', 'L2', 'sm']), J(o));
}
// ---- 4. ties and flip180 ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const inner = [{ name: 'e1', group: 1, x0: 100, y0: 100, x1: 110, y1: 110 }, { name: 'e2', group: 1, x0: 120, y0: 100, x1: 130, y1: 110 }, { name: 'e3', group: 1, x0: 140, y0: 100, x1: 150, y1: 110 }, { name: 'e4', group: 1, x0: 160, y0: 100, x1: 170, y1: 110 }];
  const r = mk(inner.concat([{ name: 'BIG', group: 2, x0: 50, y0: 50, x1: 300, y1: 300 }, { name: 'BIG2', group: 3, x0: 50, y0: 50, x1: 300, y1: 300 }]));
  const o = order(NEW, r);
  check('4a. equal areas keep the data order (BIG before BIG2, e1..e4 in order)', J(o) === J(['BIG', 'BIG2', 'e1', 'e2', 'e3', 'e4']), J(o));
  check('4b. flip180 on and off: the same order', J(order(NEW, r, true)) === J(o) && J(order(NEW, r, false)) === J(o));
}
// ---- 5. data untouched ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const r = mk([{ name: 'i1', group: 1, x0: 100, y0: 100, x1: 120, y1: 120 }, { name: 'OUT', group: 2, x0: 50, y0: 50, x1: 300, y1: 300 }]);
  const before = J(r), arr = r.faces, first = r.faces[0];
  order(NEW, r); order(NEW, r, true);
  check('5a. the result is byte-equal after drawing (twice, both flips); the faces array is the same array in the same order', J(r) === before && r.faces === arr && r.faces[0] === first && r.faces[1].color === 'OUT');
  const g = NEW.sb; g.__res = r;
  const sorted = vm.runInContext('_faceDrawOrderResult(__res)', g);
  check('5b. the sorted copy is a NEW object that holds the SAME face objects (and the same node list)', !!sorted && sorted !== r && sorted.faces !== r.faces && sorted.nodes === r.nodes && sorted.faces.every((f) => r.faces.includes(f)) && sorted.faces.length === r.faces.length);
  check('5c. asked again: the same sorted object (cached), and drawing it directly does not sort again', vm.runInContext('_faceDrawOrderResult(__res)', g) === sorted && J(order(NEW, sorted)) === J(['OUT', 'i1']));
}
// ---- 6. cache validity ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const r = mk([{ name: 'i1', group: 1, x0: 100, y0: 100, x1: 120, y1: 120 }, { name: 'OUT', group: 2, x0: 50, y0: 50, x1: 300, y1: 300 }]);
  check('6a. first draw: enclosing face first', J(order(NEW, r)) === J(['OUT', 'i1']));
  const extra = mk([{ name: 'HUGE', group: 3, x0: 0, y0: 0, x1: 600, y1: 600 }]);
  r.nodes.push(...extra.nodes); r.faces.push(extra.faces[0]);
  check('6b. a face added IN PLACE (other length): the order follows the new content', J(order(NEW, r)) === J(['HUGE', 'OUT', 'i1']), J(order(NEW, r)));
  const r2 = mk([{ name: 'i1', group: 1, x0: 100, y0: 100, x1: 120, y1: 120 }, { name: 'OUT', group: 2, x0: 50, y0: 50, x1: 300, y1: 300 }]);
  order(NEW, r2);
  const swap = mk([{ name: 'j1', group: 1, x0: 100, y0: 100, x1: 120, y1: 120 }, { name: 'BIGGER', group: 2, x0: 10, y0: 10, x1: 400, y1: 400 }]);
  r2.nodes.splice(0, r2.nodes.length, ...swap.nodes); r2.faces.splice(0, r2.faces.length, ...swap.faces);
  check('6c. every face replaced IN PLACE (same length): not drawn in the stale order', J(order(NEW, r2)) === J(['BIGGER', 'j1']), J(order(NEW, r2)));
}
// ---- 7. the corpus -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const pats = C.buildPatterns(srcWith(OLD_TXT)).filter((_, i) => i % 4 === 0).slice(0, 60);
  let dataSame = 0, logSame = 0;
  const shN = new Map(), shO = new Map();
  for (const p of pats) {
    const [shape, ord, mode] = p.sh.label.split('/'), k = p.sh.label;
    if (!shN.has(k)) { const a = C.makeSheet(shape, +ord, mode, srcWith(NEW_TXT)); vm.runInContext(P5, a.sb); shN.set(k, a); const b = C.makeSheet(shape, +ord, mode, srcWith(OLD_TXT)); vm.runInContext(P5, b.sb); shO.set(k, b); }
    const a = shN.get(k), b = shO.get(k), ra = a.faces(p.ids), rb = b.faces(p.ids);
    if (J(ra) === J(rb)) dataSame++;
    if (J(order(a, ra)) === J(order(b, rb)) && J(a.sb.__log) === J(b.sb.__log)) logSame++;
  }
  check(`7. ${pats.length} corpus patterns: the computeCellFaces result is byte-equal to main before this task (${dataSame}) and the draw call log (fills and vertices) too (${logSame})`, pats.length === 60 && dataSame === 60 && logSame === 60);
}
// ---- 8. the highlight pass -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const r = mk([{ name: 'i1', group: 1, x0: 100, y0: 100, x1: 120, y1: 120 }, { name: 'OUT', group: 2, x0: 50, y0: 50, x1: 300, y1: 300 }]);
  r.faces[0].highlight = true;
  NEW.sb.__ops.length = 0; const o = order(NEW, r);
  check('8. the hovered trail outline is still drawn after the two fills (a third shape, a stroke call), the fills in painter order', o.length === 3 && o[0] === 'OUT' && o[1] === 'i1' && NEW.sb.__ops.includes('stroke'), J(o));
}
console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
