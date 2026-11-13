// Task 071 (measurement only, writes nothing): what the page shows as the pattern name - the old name (computeThemeLineName) against the v2 display name (gridDisplayNameFor) - and what a call costs.
//   node tools/gitter/measure-name-display.js
'use strict';
const path = require('path');
const H = require(path.join(__dirname, '..', 'morph', 'render-harness.js'));
const ms = (f) => { const t = process.hrtime.bigint(); const r = f(); return [Number(process.hrtime.bigint() - t) / 1e6, r]; };
const cases = [['triangle', 3, 1, 'rotation_reflection6', 2, false], ['square', 4, 1, 'rotation_reflection6', 2, false], ['hex', 3, 1, 'rotation_reflection6', 3, false], ['hex', 3, 1, 'rotation_reflection3', 2, false], ['square', 4, 1, 'rotation3', 2, false],
    ['square', 4, 1, 'reflection_only', 2, false], ['square', 4, 1, 'none', 2, false], ['square', 4, 1, 'rotation_reflection6', 0, false], ['square', 4, 1, 'rotation_reflection6', 2, true], ['square', 3, 2, 'rotation_reflection6', 2, false], ['hex', 3, 2, 'rotation_reflection6', 2, false],
    ['triangle', 12, 1, 'rotation_reflection6', 8, false], ['square', 12, 1, 'rotation_reflection6', 8, false], ['hex', 12, 1, 'rotation_reflection6', 8, false], ['hex', 9, 2, 'rotation_reflection6', 8, false]];
console.log('shape ord lage mode                 lines free | old name                              | v2 display                         | first call ms | repeat ms (old / v2)');
for (const [shape, o, lage, mode, k, free] of cases) {
    const w = H.makeRenderWorld(shape, 3, 3, mode);
    w.set('LAGE2_MAX.hex = 12;');
    w.set(`currentShape = ${JSON.stringify(shape)}; setGrid({ shape: ${JSON.stringify(shape)}, ordnung: ${o}, lage: ${lage} }); symmetryMode = ${JSON.stringify(mode)};`);
    const reps = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, "rotation_reflection6", outerCorners).orbits.map(o => o.pairs[0].slice())');
    let conns = reps.slice(Math.floor(reps.length / 3), Math.floor(reps.length / 3) + k);
    w.set(`connections = ${JSON.stringify(conns)};`);
    if (free) w.set('nodes.push({ id: nodes.length + 1, x: 41.5, y: 99.5, free: true }); connections.push([1, nodes.length]);');
    const oldName = () => w.get('computeThemeLineName(connections, undefined, undefined, undefined)');
    const v2 = () => w.get('(function () { const r = gridDisplayNameFor(baseGridSpecNow(), connections, symmetryMode); return r ? r.display : null; })()');
    const [t0, on] = ms(oldName), [t1, vn] = ms(v2);
    const [t2] = ms(() => { for (let i = 0; i < 20; i++) oldName(); }), [t3] = ms(() => { for (let i = 0; i < 20; i++) v2(); });
    console.log(`${shape.padEnd(8)}${String(o).padStart(3)}${String(lage).padStart(4)}  ${mode.padEnd(21)}${String(conns.length + (free ? 1 : 0)).padStart(3)} ${free ? 'yes' : ' no'} | ${String(on).slice(0, 36).padEnd(37)} | ${String(vn).slice(0, 34).padEnd(34)} | ${t0.toFixed(1).padStart(5)} / ${t1.toFixed(1).padStart(5)} | ${(t2 / 20).toFixed(2)} / ${(t3 / 20).toFixed(2)}`);
}
