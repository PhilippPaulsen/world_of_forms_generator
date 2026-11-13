// Task 070 (measurement only, writes nothing): the load of the LAGE-2 grids per shape and ordnung - the basis of the LAGE2_MAX table (core/forms.js).
//   node --expose-gc tools/gitter/measure-lage2-limits.js [shape ordnung] ...   (no argument: triangle/square 6..12, hex 3..12, stops a shape at the first case over a threshold)
// Per case: nodes, pairs, setBaseLage time (lage 1 -> 2 at the same ordnung), orbit table (time, heap), name table (time), session snapshot size, node spacing at size 3 / 5.
// STOP thresholds of the task: orbit table > 3 s, heap > 300 MB, setBaseLage > 1 s (draw() is measured in the browser).
'use strict';
const path = require('path');
const H = require(path.join(__dirname, '..', 'morph', 'render-harness.js'));
const S = require(path.join(__dirname, '..', 'session', 'scenarios.js'));
const ms = (f) => { const t = process.hrtime.bigint(); const r = f(); return [Number(process.hrtime.bigint() - t) / 1e6, r]; };
const heap = () => { if (global.gc) global.gc(); return process.memoryUsage().heapUsed / 1048576; };
const args = process.argv.slice(2);
let plan = [];
if (args.length) for (let i = 0; i < args.length; i += 2) plan.push([args[i], +args[i + 1]]);
else { for (let n = 6; n <= 12; n++) plan.push(['triangle', n]); for (let n = 6; n <= 12; n++) plan.push(['square', n]); for (let n = 3; n <= 12; n++) plan.push(['hex', n]); }
const stopped = new Set();
console.log('shape  ord  nodes    pairs  setBase(ms)  orbits(ms)  orbitN  heapMB  nameTbl(ms)  snapKB  sp@3  sp@5');
for (const [shape, o] of plan) {
    if (stopped.has(shape)) continue;
    const w = H.makeRenderWorld(shape, 3, 3, 'rotation_reflection6');
    w.set('globalThis.__lage2 = true; LAGE2_MAX.triangle = 12; LAGE2_MAX.square = 12; LAGE2_MAX.hex = 12;');   // the ceiling is lifted for the measurement only (a plain object)
    w.set(`currentShape = ${JSON.stringify(shape)}; setGrid({ shape: ${JSON.stringify(shape)}, ordnung: ${o}, lage: 1 });`);
    const [tb, r] = ms(() => w.get('JSON.stringify(setBaseLage(2))'));
    const n = w.get('nodes.length');
    const h0 = heap();
    const [to, orb] = ms(() => w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.length'));
    const h1 = heap();
    const spec = JSON.stringify({ shape, ordnung: o, lage: 2 });
    const [tn] = ms(() => w.get(`computeLineKeyTable(buildGridNodes(${spec}, { allowLage2: true }), ${spec}, {}).entries.length`));
    let snapKB = '-';
    try { w.set(`connections = ${JSON.stringify(w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.slice(0, 5).map(o => o.pairs[0])'))};`); snapKB = (JSON.stringify(S.snapOf(w.ctx, S.uiOf(w.ctx, 'none', 6))).length / 1024).toFixed(1); } catch (e) { snapKB = 'err'; }
    const spacing = (size) => { w.set(`shapeSizeFactor = ${size}; setGrid(${spec});`); return w.get('(function () { let m = Infinity; for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y); if (d < m) m = d; } return m; })()'); };
    const s3 = spacing(3), s5 = spacing(5);
    const over = to > 3000 || (h1 - h0) > 300 || tb > 1000;
    console.log(`${shape.padEnd(8)}${String(o).padStart(3)}${String(n).padStart(7)}${String(n * (n - 1) / 2).padStart(9)}${tb.toFixed(1).padStart(11)}${to.toFixed(0).padStart(12)}${String(orb).padStart(8)}${(h1 - h0).toFixed(0).padStart(8)}${tn.toFixed(0).padStart(13)}${String(snapKB).padStart(8)}${s3.toFixed(1).padStart(7)}${s5.toFixed(1).padStart(6)}${over ? '  <-- OVER' : ''}${JSON.parse(r).ok ? '' : ' REFUSED ' + r}`);
    if (over) stopped.add(shape);
}
