// Seam measurement for the spatial morph (morph stage a2): do the tiles stay closed along their shared edges when the weights change from tile to tile?
// The claim (from the prototype): a boundary endpoint that slides on a cell edge is blended with the weights of the SHARED EDGE (the world image of the edge midpoint, the same point for both
// tiles), not with the weights of its tile, so both tiles put it at the same world point. This file measures it on REAL tilings:
//   - the tile transforms (tileC, flip180) come from the real core/tiling.js (tileSquare, tileTriangle, tileHex, run in a vm with a recording drawShapeCell), the symmetry operations from the
//     real core/symmetry.js, toTileLocal from core/state.js; the weights are the stage-a1 functions, the geometry the stage-a2 functions (tools/morph/morph-harness.js is the render stage in miniature);
//   - the four keyframe line sets are built so the seam CAN close: every boundary endpoint has a partner at the same world point on the neighbouring tile in all four keyframes at once (otherwise there
//     is nothing on the other side to meet; buildClosedCorners() closes the set under the tile's symmetry operations and the lattice neighbours); endpoints slide differently in each keyframe;
//   - for every pair of neighbouring tiles the endpoints that lie on the shared edge are paired at a constant mixed weight (a plain tessellation: there they coincide), then the DRIFT of each pair is the
//     distance between its two members in the spatial morph. Pass: at most 1e-9 px, everywhere.
// 10 modes (linear at 8 angles, radial, bilinear) x 3 base shapes (square, triangle, hex) x symmetry families none / reflection_only / rotation_reflection3, and the other three families (rotation3,
// rotation6, rotation_reflection6) for two modes. Negative controls: the tile's weights for the edge ends open the seam (more than 1e-3 px), and a pattern without partners has unmatched seam points.
//   node tools/morph/test-spatial-morph-seams.js
//   SPATIAL_MORPH_JS=/path/to/mutated/spatial-morph.js node tools/morph/test-spatial-morph-seams.js        (sabotage runs)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const FILE = process.env.SPATIAL_MORPH_JS || path.join(ROOT, 'core', 'spatial-morph.js');
const M = require(FILE);
const H = require('./morph-harness.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 300)); } };
const LIMIT = 1e-9;
const MODES = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => ['linear', a]).concat([['radial', 0], ['bilinear', 0]]);
const SHAPES = ['square', 'triangle', 'hex'];
const MAIN = ['none', 'reflection_only', 'rotation_reflection3'];
const EXTRA = ['rotation3', 'rotation6', 'rotation_reflection6'];
const EXTRA_MODES = [['linear', 45], ['bilinear', 0]];
const fmt = (x) => x.toExponential(1);

const worlds = {};
const world = (shape) => (worlds[shape] || (worlds[shape] = H.makeWorld(shape, 2, 2, 240)));
const measure = (shape, sym, mode, angleDeg, corners, extra) => {
  const w = world(shape);
  return H.measureSeams(M, w, Object.assign({ mode, angleDeg, symMode: sym, span: H.makeSpan(M, w, mode, angleDeg) }, extra || {}), corners);
};

console.log('== the seams stay closed (drift in px, worst over all neighbouring tile pairs and seam points) ==');
const table = [];
T('matrix', () => {
  let shapeIx = 0;
  for (const shape of SHAPES) {
    const w = world(shape);
    shapeIx++;
    const lat = `${w.tiles.length} tiles, ${H.neighbourPairs(w).length} neighbouring pairs`;
    for (const sym of MAIN.concat(EXTRA)) {
      const built = H.buildClosedCorners(M, w, sym, 100 + shapeIx);
      const valid = M.spatialMorphValidateCorners(built.corners);
      const modes = MAIN.includes(sym) ? MODES : EXTRA_MODES;
      const rows = modes.map(([mode, a]) => Object.assign({ mode, a }, measure(shape, sym, mode, a, built.corners)));
      const worst = rows.reduce((p, r) => Math.max(p, r.maxDrift), 0), base = rows.reduce((p, r) => Math.max(p, r.baselineWorst), 0);
      const unmatched = rows.reduce((p, r) => p + r.unmatched, 0), pointsMin = Math.min(...rows.map((r) => r.seamPoints)), moveMin = Math.min(...rows.map((r) => r.maxMove));
      table.push({ shape, sym, worst, rows });
      console.log(`      ${shape.padEnd(8)} ${sym.padEnd(22)} ${rows.map((r) => (r.mode === 'linear' ? 'L' + r.a : r.mode === 'radial' ? 'rad' : 'bil') + '=' + fmt(r.maxDrift)).join(' ')}`);
      check(`${shape} / ${sym}: ${rows.length} modes; ${built.tuples} partner-closed boundary endpoints in ${built.lines} lines (${lat}); ${pointsMin}+ seam points per mode, none unmatched; keyframes at the pure corners agree within ${fmt(base)}; worst drift ${fmt(worst)} px (limit ${LIMIT})`,
        valid.ok && unmatched === 0 && pointsMin > 0 && base <= LIMIT && worst <= LIMIT, J({ valid: valid.ok, unmatched, pointsMin, base, worst }));
      check(`${shape} / ${sym}: the morph is not trivial: seam points move by at least ${moveMin.toFixed(1)} px away from the pure K00 pattern in the least moving mode`, moveMin > 1, moveMin);
    }
  }
});
function J(x) { return JSON.stringify(x); }

console.log('\n== the table: worst drift per mode x shape (main families, px) ==');
T('summary', () => {
  const modeKeys = MODES.map(([m, a]) => (m === 'linear' ? 'linear ' + a : m));
  console.log('      ' + 'mode'.padEnd(12) + SHAPES.map((s) => s.padEnd(12)).join(''));
  MODES.forEach(([m, a], i) => {
    const cells = SHAPES.map((shape) => {
      const rows = table.filter((t) => t.shape === shape && MAIN.includes(t.sym)).map((t) => t.rows[i].maxDrift);
      return fmt(Math.max(...rows)).padEnd(12);
    });
    console.log('      ' + modeKeys[i].padEnd(12) + cells.join(''));
  });
  const all = table.reduce((p, t) => Math.max(p, t.worst), 0);
  check(`the worst drift over everything (${table.length} shape x family cases, ${table.reduce((p, t) => p + t.rows.length, 0)} runs) is ${fmt(all)} px: far below the limit of ${LIMIT}`, all <= LIMIT);
});

console.log('\n== negative controls: the measurement can fail ==');
T('controls', () => {
  for (const shape of SHAPES) {
    const w = world(shape);
    const built = H.buildClosedCorners(M, w, 'none', 100);
    const bad = measure(shape, 'none', 'linear', 45, built.corners, { edgeFromTile: true });
    const badB = measure(shape, 'none', 'bilinear', 0, built.corners, { edgeFromTile: true });
    check(`${shape}: with the TILE's weights for the sliding edge ends (the wrong rule) the seams open: drift ${bad.maxDrift.toFixed(2)} px (linear 45) and ${badB.maxDrift.toFixed(2)} px (bilinear), at least a million times the limit of ${LIMIT} (a small tile shows a smaller drift: the size depends on how fast the weights change per tile)`, bad.maxDrift > 1e-3 && badB.maxDrift > 1e-3 && bad.unmatched === 0, J([bad.maxDrift, badB.maxDrift]));
    const open = H.buildClosedCorners(M, w, 'none', 100, { closure: false });
    const m = measure(shape, 'none', 'linear', 45, open.corners);
    check(`${shape}: a pattern whose boundary endpoints have no partner shows ${m.unmatched} unmatched seam points (the pairing is not vacuous)`, m.unmatched > 0, m.unmatched);
  }
  const w = world('square');
  const built = H.buildClosedCorners(M, w, 'none', 100);
  const a = measure('square', 'none', 'linear', 45, built.corners), b = measure('square', 'none', 'linear', 45, built.corners);
  check('the same input twice gives the same measurement', J(a) === J(b));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
