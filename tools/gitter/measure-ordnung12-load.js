// Task 069 (measurement only, writes nothing): the load of the lage-1 grids at ordnung 7..12 (triangle 7..12, square 12, hex 8..12, with the old ceilings 6 / 12 / 7 as references).
//   node --expose-gc tools/gitter/measure-ordnung12-load.js [maxHexOrdnung]
// Per case: nodes, pairs, setGrid time, theme-line orbit table (time, heap), orbit count, the name table (computeLineKeyTable: time), the node spacing at shapeSizeFactor 3 / 5 on the 600 px canvas.
'use strict';
const path = require('path');
const H = require(path.join(__dirname, '..', 'morph', 'render-harness.js'));
const MAXHEX = parseInt(process.argv[2] || '12', 10);
const cases = [['triangle', 6], ['triangle', 7], ['triangle', 8], ['triangle', 9], ['triangle', 10], ['triangle', 11], ['triangle', 12], ['square', 12], ['hex', 7], ['hex', 8], ['hex', 9], ['hex', 10], ['hex', 11], ['hex', 12]].filter(([s, o]) => s !== 'hex' || o <= MAXHEX);
const ms = (f) => { const t = process.hrtime.bigint(); const r = f(); return [Number(process.hrtime.bigint() - t) / 1e6, r]; };
const heap = () => { if (global.gc) global.gc(); return process.memoryUsage().heapUsed / 1048576; };
console.log('shape  ord  nodes   pairs   setGrid  orbits(ms)  orbitN   heapMB  nameTable(ms)  spacing@3  spacing@5');
for (const [shape, o] of cases) {
    const w = H.makeRenderWorld(shape, 3, 3, 'rotation_reflection6');
    const spec = JSON.stringify({ shape, ordnung: o, lage: 1 });
    const [tg] = ms(() => w.set(`setGrid(${spec});`));
    const n = w.get('nodes.length');
    const h0 = heap();
    const [to, orb] = ms(() => w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.length'));
    const h1 = heap();
    const [tn] = ms(() => w.get(`computeLineKeyTable(buildGridNodes(${spec}, {}), ${spec}, {}).entries.length`));
    const spacing = (size) => { w.set(`shapeSizeFactor = ${size}; setGrid(${spec});`); return w.get('(function () { let m = Infinity; for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y); if (d < m) m = d; } return m; })()'); };
    const s3 = spacing(3), s5 = spacing(5);
    console.log(`${shape.padEnd(8)}${String(o).padStart(3)}${String(n).padStart(7)}${String(n * (n - 1) / 2).padStart(9)}${tg.toFixed(1).padStart(9)}${to.toFixed(0).padStart(11)}${String(orb).padStart(9)}${(h1 - h0).toFixed(0).padStart(9)}${tn.toFixed(0).padStart(14)}${s3.toFixed(1).padStart(10)}${s5.toFixed(1).padStart(11)}`);
}
