// G7b (task 066), decision of task 065 (A): a line key names the UNDIRECTED straight line orbit. Every member of an orbit draws the SAME geometry under the whole main group
// (core/tiling.js drawShapeCell -> core/symmetry.js drawConnectionWithSymmetry); only the direction of travel of a member may differ, which matters for a leaning curve, never for a straight line.
//   node tools/gitter/test-member-geometry.js
// Source: tools/gitter/measure-representatives.js (--json): 1081 orbits (3 shapes x ordnung 1..5, square also c = 7), every member drawn alone; cell level (drawShapeCell) and tessellation
// level (drawTessellation, ordnung 1..3). ROOT_OVERRIDE = a copy of the repo tree (sabotage runs).
const cp = require('child_process'), path = require('path');
const ROOT = process.env.ROOT_OVERRIDE || path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const out = cp.execFileSync('node', [path.join(ROOT, 'tools/gitter/measure-representatives.js'), '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const R = JSON.parse(out), S = R.summary;

check('(1) coverage: 16 grids (3 shapes x ordnung 1..5, square c = 7), at least 1081 orbits, tessellation level for 9 grids (ordnung 1..3)', R.grids.length === 16 && S.orbits >= 1081 && R.tessellation.length === 9, R.grids.length + ' grids, ' + S.orbits + ' orbits');
check('(2) GEOMETRY: no orbit has two members that draw different segment sets (undirected), cell level: ' + S.orbits + ' orbits', S.orbitsWithDifferingGeometry === 0 && R.grids.every(g => g.geoBad === 0), S.orbitsWithDifferingGeometry);
check('(2) GEOMETRY at tessellation level (drawTessellation): 0 orbits differ in all 9 grids', R.tessellation.every(g => g.geoBad === 0) && R.tessellation.reduce((a, g) => a + g.orbits, 0) > 100);
check('(3) DIRECTION is the only difference: wherever members differ, the second class is exactly the first with every segment reversed (never a different geometry)', R.grids.every(g => g.dirBad === g.dirOnlyReversed) && S.orbitsWithDifferingDirection > 0, S.orbitsWithDifferingDirection);
check('(3) oriented by node number (larger number first, what pairForLineKey returns) every orbit with z1 != z2 draws alike; only z1 = z2 orbits keep two directions', S.ofThemDifferentZahl === 0 && S.orbitsWithDifferingDirectionWhenZOriented === S.ofThemEqualZahl, J2(S));
check('(4) the acceptance catalog (gallery/v2): 0 entries differ in geometry (the previews are straight lines)', R.catalog.entries === 284 && R.catalog.geoAffected === 0, R.catalog.geoAffected);
function J2(o) { return JSON.stringify({ d: o.orbitsWithDifferingDirectionWhenZOriented, eq: o.ofThemEqualZahl, ne: o.ofThemDifferentZahl }); }

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
