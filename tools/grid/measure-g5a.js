// G5a (task 060): the behaviour measurement, tree-agnostic. It uses only what both the old and the new tree have (tools/session/scenarios.js world(),
// tools/morph/render-harness.js makeRenderWorld()), so the SAME file runs in a checkout of the old commit and in the working tree; the two outputs must be equal.
//   node tools/grid/measure-g5a.js > out.json          (run from the root of the tree to measure: it reads its own ../..)
// Per shape x c (1..7) x size x net: nodes/centroid/corners, the drawn calls and segments of drawTessellation(), the export JSON (without the time stamp),
// the net lines (E from the tree's own producer), netWarpBaseNow(). Then 5 morph frames (t = 0 .25 .5 .75 1) for 3 shapes x 3 symmetries x linear/radial/bilinear.
'use strict';
const crypto = require('crypto');
const path = require('path');
const H = require(path.join(__dirname, '..', 'morph', 'render-harness.js'));
const h = (x) => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex').slice(0, 16);
const J = JSON.stringify;
const out = {};
// task 063: export v2 changed the export's own fields (formatVersion, meta.grid / nodeCount, nodes' zahl/u/v, lineKeys, name, patternName / themeLineOrbits); the comparison with the
// old tree hashes the export WITHOUT them, so geometry, edges, adjacency, faces and colours are still compared byte for byte.
const V2_KEYS = new Set(['formatVersion', 'name', 'patternName', 'themeLineOrbits', 'lineKeys', 'nodeCount', 'grid', 'zahl', 'u', 'v']);
const stripV2 = (o) => (Array.isArray(o) ? o.map(stripV2) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([k]) => !V2_KEYS.has(k)).map(([k, v]) => [k, stripV2(v)])) : o);
const NETS = { none: null, single: { x: { kind: 'trig', w: -1 }, y: 'same', repeat: false }, tiled: { x: { kind: 'trig', w: -1 }, y: 'same', repeat: true } };
const E_EXPR = "(typeof baseGridDivisions === 'function' ? baseGridDivisions() : nodeCount - 1)";
const CONN = [[1, 2], [1, 3]];

for (const shape of ['triangle', 'square', 'hex']) for (let c = 1; c <= 7; c++) for (const size of [1, 3, 5]) for (const net of Object.keys(NETS)) {
    if (net !== 'none' && shape !== 'square' && c !== 3) continue;   // the warp only exists for square; one other shape as a control
    const key = [shape, c, size, net].join('/');
    try {
        const w = H.makeRenderWorld(shape, c, size, 'none');
        w.set(`connections = ${J(CONN)}; baseNetTransform = ${J(NETS[net])};`);
        const rec = {};
        rec.grid = h(w.get('JSON.stringify({ nodes, centroid, outerCorners })'));
        rec.drawn = h(w.drawn());
        rec.frame = h(w.frame());
        rec.exp = h(JSON.stringify(stripV2(JSON.parse(w.get('(function () { const d = buildExportData(); d.exportedAt = 0; return JSON.stringify(d); })()')))));
        rec.warp = h(w.get('JSON.stringify(netWarpBaseNow())'));
        rec.lines = h(w.get(`JSON.stringify(netGridLines(netTransformNow(), outerCorners, ${E_EXPR}, { x0: 0, y0: 0, x1: 600, y1: 600 }, { closed: true }))`));
        rec.E = w.get(E_EXPR);
        out[key] = rec;
    } catch (e) { out[key] = 'threw: ' + String(e && e.message).slice(0, 120); }
}

const CONNS = { square: [[1, 5], [2, 8], [3, 7]], triangle: [[1, 5], [2, 6], [3, 4]], hex: [[1, 10], [3, 14], [5, 20]] };
const ALT = { square: [[1, 9], [2, 6], [4, 8]], triangle: [[1, 6], [2, 5], [3, 5]], hex: [[2, 11], [4, 15], [6, 21]] };
for (const shape of ['square', 'triangle', 'hex']) for (const sym of ['none', 'rotation_reflection3', 'rotation3']) for (const mode of ['linear', 'radial', 'bilinear']) {
    const key = ['morph', shape, sym, mode].join('/');
    try {
        const w = H.makeRenderWorld(shape, 3, 3, sym);
        w.baseConnections(CONNS[shape]);
        const a = w.addKeyframeLayer(CONNS[shape]), b = w.addKeyframeLayer(ALT[shape]);
        w.setTimeline([a, b]);
        w.setMorph({ enabled: true, mode, angleDeg: mode === 'linear' ? 135 : 0 });
        const fr = [];
        for (const t of [0, 0.25, 0.5, 0.75, 1]) { w.set(`timeline.elapsedMs = ${t * 2000};`); fr.push(h(w.drawn())); }
        out[key] = fr;
    } catch (e) { out[key] = 'threw: ' + String(e && e.message).slice(0, 120); }
}
process.stdout.write(J(out, null, 1) + '\n');
