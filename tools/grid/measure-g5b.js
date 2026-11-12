// G5b (task 061): behaviour measurement with LAYERS, tree-agnostic (see measure-g5a.js: the same file runs in a checkout of the old commit and in the working tree; outputs must be equal).
//   node tools/grid/measure-g5b.js > out.json
// layers: base shape x c x (layer shape x layer order x layer size): layer geometry, drawn calls, segments, export JSON, with and without a square net;
// altnet: a base built from a construction (rebuildGridFromConstruction) with a layer; morph: keyframe layers of another order under a net, frames t = 0 .25 .5 .75 1.
'use strict';
const crypto = require('crypto');
const path = require('path');
const H = require(path.join(__dirname, '..', 'morph', 'render-harness.js'));
const S = require(path.join(__dirname, '..', 'session', 'scenarios.js'));
const h = (x) => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex').slice(0, 16);
const J = JSON.stringify;
const out = {};
const NET = { x: { kind: 'trig', w: -1 }, y: 'same', repeat: false };
const LAYERS_JS = 'JSON.stringify(additionalLayers.map(l => [l.shape, l.nodeCount, l.shapeSizeFactor, l.symmetryMode, l.nodes, l.centroid, l.outerCorners]))';
function record(w) {
    const rec = {};
    rec.layers = h(w.get(LAYERS_JS));
    rec.drawn = h(w.drawn());
    try { rec.frame = h(w.frame()); } catch (e) { rec.frame = 'n/a'; }   // a layer that shows faces empties segmentCollector mid-frame: the drawn calls and the export carry the comparison then
    rec.exp = h(w.get('(function () { const d = buildExportData(); d.exportedAt = 0; return JSON.stringify(d); })()'));
    return rec;
}
for (const bshape of ['triangle', 'square', 'hex']) for (const bc of [2, 3]) for (const lshape of ['triangle', 'square', 'hex']) for (const lc of [1, 2, 3, 4]) for (const lsize of [3, 5]) for (const net of [false, true]) {
    if (net && bshape !== 'square') continue;
    const key = ['layers', bshape, bc, lshape, lc, lsize, net ? 'net' : 'nonet'].join('/');
    try {
        const w = H.makeRenderWorld(bshape, bc, 3, 'none');
        w.set(`connections = ${J([[1, 2]])}; baseNetTransform = ${J(net ? NET : null)};`);
        S.addLayer(w.ctx, { shape: lshape, order: lc, size: lsize, connections: [[1, 2]], offsetX: lsize === 5 ? 30 : 0, mode: 'none', showFaces: true });
        out[key] = record(w);
    } catch (e) { out[key] = 'threw: ' + String(e && e.message).slice(0, 120); }
}
for (const [shape, lshape, lc] of [['hex', 'hex', 2], ['hex', 'triangle', 3], ['square', 'square', 3]]) {
    const key = ['altnet', shape, lshape, lc].join('/');
    try {
        const w = H.makeRenderWorld(shape, 3, 3, 'none');
        w.set(`rebuildGridFromConstruction({ x: 120, y: 230 }, { x: 310, y: 260 }, ${shape === 'hex' ? 6 : 4}, 1); connections = ${J([[1, 2]])};`);
        S.addLayer(w.ctx, { shape: lshape, order: lc, size: 3, connections: [[1, 2]], mode: 'none' });
        out[key] = record(w);
    } catch (e) { out[key] = 'threw: ' + String(e && e.message).slice(0, 120); }
}
const CONNS = { square: [[1, 5], [2, 8], [3, 7]], triangle: [[1, 5], [2, 6], [3, 4]], hex: [[1, 10], [3, 14], [5, 20]] };
const ALT = { square: [[1, 9], [2, 6], [4, 8]], triangle: [[1, 6], [2, 5], [3, 5]], hex: [[2, 11], [4, 15], [6, 21]] };
for (const shape of ['square', 'triangle', 'hex']) for (const net of [false, true]) for (const kfOrder of [3, 4]) for (const mode of ['linear', 'radial']) {
    if (net && shape !== 'square') continue;
    const key = ['morph', shape, net ? 'net' : 'nonet', kfOrder, mode].join('/');
    try {
        const w = H.makeRenderWorld(shape, 3, 3, 'none');
        w.baseConnections(CONNS[shape]);
        w.set(`baseNetTransform = ${J(net ? NET : null)};`);
        const a = w.addKeyframeLayer(CONNS[shape], { order: kfOrder }), b = w.addKeyframeLayer(ALT[shape], { order: kfOrder });
        w.setTimeline([a, b]);
        w.setMorph({ enabled: true, mode, angleDeg: mode === 'linear' ? 135 : 0 });
        const fr = [];
        for (const t of [0, 0.25, 0.5, 0.75, 1]) { w.set(`timeline.elapsedMs = ${t * 2000};`); fr.push(h(w.drawn())); }
        out[key] = fr;
    } catch (e) { out[key] = 'threw: ' + String(e && e.message).slice(0, 120); }
}
process.stdout.write(J(out, null, 1) + '\n');
