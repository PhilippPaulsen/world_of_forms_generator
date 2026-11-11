// Task 058 (G3): load measurement of the lage-1 / lage-2 grids, a measurement and NOT a test (the glob tools/*/test-*.js does not pick it up).
//   node tools/gitter/measure-lage2-load.js [maxN]     prints a table: shape, lage, n, nodes, node pairs, pair orbits (the theme-line orbit table the app builds), 3-combinations of orbits,
//                                                      build ms (buildGrid, median of 15), orbit-table ms, peak RSS MB (a fresh node process per row, so the rows do not share a heap).
// The orbit table is core/orbits.js computeThemeLineOrbits() - exactly what the app computes per grid change; times are of THIS machine.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const MODE = { triangle: 'rotation_reflection3', square: 'rotation_reflection3', hex: 'rotation_reflection6' };
if (process.argv[2] === '--one') {
    const [shape, n, lage] = [process.argv[3], +process.argv[4], +process.argv[5]];
    const sb = { Math, console, Number, Object, Error, Set, Map, JSON, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, atan2: Math.atan2, PI: Math.PI };
    vm.createContext(sb);
    for (const f of ['forms', 'symmetry', 'orbits']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8'), sb);
    sb.__spec = { shape, ordnung: n, lage }; sb.__view = { sizeFactor: 3, canvasW: 600, canvasH: 600 };
    const t = [];
    let g; for (let i = 0; i < 15; i++) { const t0 = process.hrtime.bigint(); g = vm.runInContext('buildGrid(__spec, __view, { allowLage2: true })', sb); t.push(Number(process.hrtime.bigint() - t0) / 1e6); }
    t.sort((a, b) => a - b);
    sb.__g = g; const t1 = process.hrtime.bigint();
    const tab = vm.runInContext(`computeThemeLineOrbits(__g.nodes, __g.centroid, ${JSON.stringify(shape)}, ${JSON.stringify(MODE[shape])}, __g.outerCorners)`, sb);
    const ms = Number(process.hrtime.bigint() - t1) / 1e6, k = tab.orbits.length;
    console.log(JSON.stringify({ nodes: g.nodes.length, pairs: tab.rawPairCount, orbits: k, combos3: k * (k - 1) * (k - 2) / 6, buildMs: +t[7].toFixed(2), tableMs: +ms.toFixed(0), rssMB: +(process.resourceUsage().maxRSS / 1024).toFixed(0) }));
    process.exit(0);
}
const maxN = +(process.argv[2] || 8);
console.log('shape     lage  n   nodes    pairs  orbits  3-combos        build ms  table ms  peak RSS MB');
for (const shape of ['triangle', 'square', 'hex']) for (const lage of [1, 2]) for (let n = 1; n <= maxN; n++) {
    const r = JSON.parse(cp.execFileSync(process.execPath, [__filename, '--one', shape, n, lage], { encoding: 'utf8' }));
    console.log(`${shape.padEnd(9)} ${lage}     ${n}   ${String(r.nodes).padStart(5)} ${String(r.pairs).padStart(8)} ${String(r.orbits).padStart(7)}  ${String(r.combos3).padStart(13)}  ${String(r.buildMs).padStart(8)}  ${String(r.tableMs).padStart(8)}  ${String(r.rssMB).padStart(6)}`);
}
