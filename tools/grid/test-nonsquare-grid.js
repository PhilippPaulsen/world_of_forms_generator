// Task 077 (B1): a base area of X x Y meshes, cells undistorted (core/forms.js gridWidth/gridHeight/validateGridSize + the builders' shortSide,
// core/state.js setGridSize). X = Y stays byte-equal to main.
//   node tools/grid/test-nonsquare-grid.js     FORMS_JS / STATE_JS = paths of mutated copies (sabotage runs); BASE = ref for the X = Y comparison (default main)
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'main';
const forms = fs.readFileSync(process.env.FORMS_JS || path.join(ROOT, 'core/forms.js'), 'utf8');
const state = fs.readFileSync(process.env.STATE_JS || path.join(ROOT, 'core/state.js'), 'utf8');
const oldForms = cp.execFileSync('git', ['show', BASE + ':core/forms.js'], { cwd: ROOT, encoding: 'utf8' });
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const mk = (...src) => { const sb = { Math, console, Number, Error, Map, JSON, Object, radians: x => x * Math.PI / 180, cos: Math.cos, sin: Math.sin }; vm.createContext(sb); vm.runInContext(src.join('\n'), sb); return sb; };
const ev = (sb, s) => vm.runInContext(s, sb);
const S = mk(forms, state), O = mk(oldForms);
const shapes = ['triangle', 'square', 'hex'], R3 = Math.sqrt(3), EPS = 1e-9;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (p, q, r) => { const ux = q.x - p.x, uy = q.y - p.y, vx = r.x - q.x, vy = r.y - q.y; return Math.acos(-(ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))) * 180 / Math.PI; };
const pairs = []; for (let x = 1; x <= 9; x++) for (let y = 1; y <= 9; y++) if (Math.max(x, y) <= 3 * Math.min(x, y)) pairs.push([x, y]);
// the formula, written out independently of core/forms.js
const wantW = (shape, X, Y) => { if (X === Y) return 600; const e = 600 / Math.min(X, Y); return X < Y ? 600 : shape === 'hex' ? X * R3 / 2 * e : X * e; };
const wantH = (shape, X, Y) => { if (X === Y) return 600; const e = 600 / Math.min(X, Y); return Y < X ? 600 : shape === 'triangle' ? Y * R3 / 2 * e : Y * e; };

// (1) the table of reports/076.md section 3 as a counter-check (hand-entered numbers, not computed by the formula above)
const T = [['triangle', 3, 5, 600, 866.0], ['square', 3, 5, 600, 1000], ['square', 2, 3, 600, 900], ['square', 5, 7, 600, 840], ['square', 3, 4, 600, 800], ['square', 4, 5, 600, 750], ['square', 5, 8, 600, 960], ['square', 5, 9, 600, 1080],
    ['square', 1, 3, 600, 1800], ['square', 3, 1, 1800, 600], ['triangle', 3, 4, 600, 692.8], ['triangle', 5, 7, 600, 727.5], ['triangle', 2, 3, 600, 779.4], ['hex', 5, 3, 866.0, 600], ['hex', 3, 2, 779.4, 600], ['hex', 7, 5, 727.5, 600], ['triangle', 5, 3, 1000, 600], ['hex', 3, 5, 600, 1000]];
check('(1) table 076: ' + T.length + ' sizes (W x H to 0.05 px)', T.every(([sh, X, Y, w, h]) => Math.abs(S.gridWidth(sh, X, Y) - w) < 0.05 && Math.abs(S.gridHeight(sh, X, Y) - h) < 0.05),
    T.filter(([sh, X, Y, w, h]) => Math.abs(S.gridWidth(sh, X, Y) - w) >= 0.05 || Math.abs(S.gridHeight(sh, X, Y) - h) >= 0.05).map(t => t.join('/')));
check('(1) W, H equal the formula for every shape and every admissible X, Y (' + pairs.length * 3 + ' sizes)', shapes.every(sh => pairs.every(([X, Y]) => S.gridWidth(sh, X, Y) === wantW(sh, X, Y) && S.gridHeight(sh, X, Y) === wantH(sh, X, Y))));
check('(1) X = Y is 600 x 600 for every shape', shapes.every(sh => [1, 2, 3, 4, 5, 6, 7, 8, 9].every(X => S.gridWidth(sh, X, X) === 600 && S.gridHeight(sh, X, X) === 600)));
check('(1) the one named edge placement and the centre (W/2, H/2)', ev(S, 'GRID_EDGE_PLACEMENT') === 'through-edge-cells' && ev(S, 'GRID_SHORT_SIDE') === 600 && shapes.every(sh => pairs.every(([X, Y]) => { const c = S.gridCenter(sh, X, Y); return c.x === wantW(sh, X, Y) / 2 && c.y === wantH(sh, X, Y) / 2; })));

// (2) the grid through the API: undistorted cells, centred, inside the frame
let nBad = { edge: 0, angle: 0, center: 0, frame: 0, size: 0 }, nGrids = 0;
for (const sh of shapes) for (const [X, Y] of pairs) for (const ord of [1, 3]) {
    ev(S, `currentShape = '${sh}'; projectGridSpec({ shape: '${sh}', ordnung: ${ord}, lage: 1 }); setGridSize(${X}, ${Y});`);
    nGrids++;
    const e = 600 / Math.min(X, Y), W = ev(S, 'canvasW'), H = ev(S, 'canvasH');
    const oc = JSON.parse(ev(S, 'JSON.stringify(outerCorners)')), nodes = JSON.parse(ev(S, 'JSON.stringify(nodes)'));
    if (W !== wantW(sh, X, Y) || H !== wantH(sh, X, Y) || ev(S, 'gridSizeX()') !== X || ev(S, 'gridSizeY()') !== Y || ev(S, 'gridEdgeFactor()') !== Math.min(X, Y)) nBad.size++;
    const n = oc.length, side = sh === 'hex' ? e / R3 : e;   // the hexagon's cell edge e is its height (flat to flat); its side is e / sqrt3
    if (!oc.every((p, i) => Math.abs(dist(p, oc[(i + 1) % n]) - side) < EPS * 600)) nBad.edge++;
    const want = sh === 'triangle' ? 60 : sh === 'square' ? 90 : 120;
    if (!oc.every((p, i) => Math.abs(angle(oc[(i + n - 1) % n], p, oc[(i + 1) % n]) - want) < 1e-6)) nBad.angle++;
    const xs = oc.map(p => p.x), ys = oc.map(p => p.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    if (Math.abs(cx - W / 2) > 1e-9 || Math.abs(cy - H / 2) > 1e-9) nBad.center++;
    // inside the frame; the hexagon with X = 1 overhangs by (2/sqrt3 - 1) e / 2 per side already on main at 1/1 (its width 1.155 e against a 600 frame): allowed only there, and only by that
    const slack = (sh === 'hex' && X === 1) ? (2 / R3 - 1) * e / 2 + 1e-9 : 1e-9;
    if (!nodes.every(p => p.x >= -slack && p.x <= W + slack && p.y >= -slack && p.y <= H + slack)) nBad.frame++;
}
check('(2) setGridSize: canvas, X, Y, edge factor as set (' + nGrids + ' grids)', nBad.size === 0, nBad.size);
check('(2) every outer edge is e = 600 / min(X, Y) (hexagon: its side e / sqrt3) in both directions (no distortion)', nBad.edge === 0, nBad.edge);
check('(2) corner angles 60 / 90 / 120 degrees', nBad.angle === 0, nBad.angle);
check('(2) the polygon is centred on (W/2, H/2)', nBad.center === 0, nBad.center);
check('(2) every node lies in the frame (hexagon, X = 1: overhang only as on main)', nBad.frame === 0, nBad.frame);
// the cell is the same size whatever the other count is: the edge depends on min(X, Y) only
check('(2) the edge depends on min(X, Y) only', shapes.every(sh => [1, 2, 3].every(m => [m, m + 1, 2 * m, 3 * m].filter(v => v <= 9).every(v => {
    ev(S, `currentShape = '${sh}'; projectGridSpec({ shape: '${sh}', ordnung: 2, lage: 1 }); setGridSize(${m}, ${v}); `); const a = JSON.parse(ev(S, 'JSON.stringify(outerCorners)'));
    return Math.abs(dist(a[0], a[1]) - (sh === 'hex' ? 600 / m / R3 : 600 / m)) < 1e-9; }))));

// (3) rejection without mutation
ev(S, "currentShape = 'square'; projectGridSpec({ shape: 'square', ordnung: 2, lage: 1 }); setGridSize(3, 5);");
const snap = () => ev(S, 'JSON.stringify({canvasW, canvasH, shapeSizeFactor, shapeSizeFactorX, shapeSizeFactorY, nodes, centroid, outerCorners, gridSpec, nodeCount, gridRevision, connections, additionalLayers})');
const before = snap();
const bad = [[1, 4], [4, 1], [2, 7], [9, 2], [1, 9], [9, 1], [0, 1], [1, 0], [10, 10], [3, 10], [1.5, 1.5], [3, 5.5], [NaN, 3], ['3', 3], [undefined, 3], [-1, -1]];
const thrown = bad.map(([x, y]) => { try { S.__a = x; S.__b = y; ev(S, 'setGridSize(__a, __b)'); return false; } catch (e) { return /setGridSize/.test(e.message); } });
check('(3) setGridSize rejects ' + bad.length + ' sizes (ratio above 1 : 3, outside 1..9, not integers)', thrown.every(Boolean), thrown.map((t, i) => t ? '' : bad[i]).join(' '));
check('(3) a rejected size leaves canvas, X, Y, nodes and the rest untouched (no clamp)', snap() === before);
check('(3) validateGridSize: the border 3 : 1 is ok, 1 : 4 is not; every admissible pair is ok', S.validateGridSize(3, 9).ok && S.validateGridSize(9, 3).ok && S.validateGridSize(1, 3).ok && !S.validateGridSize(1, 4).ok && !S.validateGridSize(2, 7).ok && pairs.every(([x, y]) => S.validateGridSize(x, y).ok));
check('(3) the pair count: 81 pairs, those above 1 : 3 are rejected', (() => { let ok = 0; for (let x = 1; x <= 9; x++) for (let y = 1; y <= 9; y++) if (S.validateGridSize(x, y).ok) ok++; return ok === pairs.length; })());

// (4) X = Y: byte-equal to main (builders, whole grid, with and without centre), the hexagon cell the same size as before the fix
let n4 = 0, bad4 = 0;
for (const sh of shapes) for (let c = 1; c <= 4; c++) for (let sf = 1; sf <= 9; sf++) for (const center of [undefined, { x: 280, y: 310 }]) {
    const b = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' }[sh], a1 = JSON.stringify(ev(O, `${b}(${c}, ${sf}, 600, 600, ${JSON.stringify(center)})`));
    const a2 = JSON.stringify(ev(S, `${b}(${c}, ${sf}, 600, 600, ${JSON.stringify(center)})`)), a3 = JSON.stringify(ev(S, `${b}(${c}, ${sf}, 600, 600, ${JSON.stringify(center)}, 600)`));
    n4++; if (a1 !== a2 || a1 !== a3) bad4++;
}
check('(4) the three builders at X = Y: byte-equal to ' + BASE + ' with and without shortSide 600 (' + n4 + ' grids)', bad4 === 0, bad4);
let bad4b = 0, n4b = 0;
for (const sh of shapes) for (let sf = 1; sf <= 9; sf++) {
    ev(S, `currentShape = '${sh}'; projectGridSpec({ shape: '${sh}', ordnung: 3, lage: 1 }); shapeSizeFactor = ${sf}; shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; rebuildGrid(currentShape);`);
    const g = JSON.stringify(ev(S, '({ nodes, centroid, outerCorners })'));   // ordnung 3 = legacy count 4 (triangle/square), 3 (hex)
    const legacyC = sh === 'hex' ? 3 : 4, o2 = JSON.stringify(ev(O, `build${{ triangle: 'Triangle', square: 'Square', hex: 'Hex' }[sh]}Grid(${legacyC}, ${sf}, 600, 600)`));
    n4b++; if (g !== o2) bad4b++;
}
check('(4) rebuildGrid at X = Y (shapeSizeFactorX, Y null): byte-equal to the old builders (' + n4b + ' grids)', bad4b === 0, bad4b);
check('(4) hexagon X = Y: the cell height is 600 / S as before (1/1 .. 9/9)', [1, 2, 3, 4, 5, 6, 7, 8, 9].every(sf => { ev(S, `currentShape = 'hex'; projectGridSpec({ shape: 'hex', ordnung: 2, lage: 1 }); setGridSize(${sf}, ${sf})`); const oc = JSON.parse(ev(S, 'JSON.stringify(outerCorners)')); return Math.abs(oc[4].y - oc[1].y - 600 / sf) < 1e-9 && ev(S, 'canvasW') === 600 && ev(S, 'canvasH') === 600; }));
check('(4) a hexagon on a 900 x 500 canvas: the edge divides the width now (the old canvasH division is gone)', (() => { const a = JSON.parse(JSON.stringify(ev(S, 'buildHexGrid(2, 3, 900, 500).outerCorners'))); return Math.abs(a[4].y - a[1].y - 900 / 3) < 1e-9; })());

// (5) layers: one factor L relative to the base edge e
ev(S, "currentShape = 'square'; projectGridSpec({ shape: 'square', ordnung: 2, lage: 1 }); setGridSize(3, 5);");
const W35 = ev(S, 'canvasW'), H35 = ev(S, 'canvasH');
let ok5 = true;
for (const ls of shapes) for (const L of [3, 4, 9]) {
    const lg = JSON.parse(JSON.stringify(ev(S, `layerGridForSpec(outerCorners, centroid, currentShape, gridEdgeFactor(), ${L}, { shape: '${ls}', ordnung: 2, lage: 1 }, '${ls}', canvasW, canvasH, gridShortSideArg())`)));
    const edge = dist(lg.outerCorners[0], lg.outerCorners[1]);
    // a square base (3/5, e = 200): a same-shape layer scales the base polygon by 3 / L; a cross-shape one is built with edge 600 / L about the same centre
    const wantEdge = ls === 'hex' ? 600 / L / R3 : 600 / L;
    if (Math.abs(edge - wantEdge) > 1e-9) ok5 = false;
}
check('(5) layers on a 3/5 base: the layer edge is 600 / L (L relative to the base edge, no layer X/Y)', ok5);
check('(5) a layer built through addLayer-style state path takes the same short side (canvas ' + W35 + ' x ' + H35 + ')', W35 === 600 && H35 === 1000);

console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
