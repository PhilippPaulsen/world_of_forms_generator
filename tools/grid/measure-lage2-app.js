// Task 067: tree-agnostic measurement (runs in the old tree and the working tree; the outputs must be equal): the session fingerprints of every lage-1 base grid
// (3 shapes x c 1..7 x 3 sizes) and of layer grids, and layerGridMatchesBase over a matrix of layers. Nothing here touches lage 2 or the switch.
'use strict';
const crypto = require('crypto'), path = require('path');
const S = require(path.join(__dirname, '..', 'session', 'scenarios.js'));
const J = JSON.stringify;
const out = {};
for (const shape of ['triangle', 'square', 'hex']) for (let c = 1; c <= 7; c++) for (const size of [2, 3, 5]) {
    const k = ['fp', shape, c, size].join('/');
    try {
        const w = S.world(shape, c, size, 'none');
        out[k] = w.run('(function(){ const f = sessionNodeFingerprint(nodes, gridSpec); const g = sessionGridFingerprint(nodes, gridSpec); return [f, g, gridSpec]; })()');
        S.addLayer(w, { shape, order: Math.max(1, c - 1), size: size === 2 ? 3 : 2, connections: [[1, 2]] });
        out[k + '/layer'] = w.run('(function(){ const l = additionalLayers[0]; return [sessionNodeFingerprint(l.nodes, layerGridSpecOf(l)), layerGridSpecOf(l)]; })()');
    } catch (e) { out[k] = 'threw: ' + String(e && e.message).slice(0, 100); }
}
for (const shape of ['triangle', 'square']) for (const lshape of ['triangle', 'square', 'hex']) for (const size of [3, 4]) for (const off of [0, 5]) for (const rot of [0, 10]) {
    const k = ['match', shape, lshape, size, off, rot].join('/');
    try {
        const w = S.world(shape, 3, 3, 'none');
        S.addLayer(w, { shape: lshape, order: 2, size, offsetX: off, rotation: rot });
        out[k] = w.run('layerGridMatchesBase(additionalLayers[0])');
    } catch (e) { out[k] = 'threw: ' + String(e && e.message).slice(0, 100); }
}
process.stdout.write(J(out) + '\n');
