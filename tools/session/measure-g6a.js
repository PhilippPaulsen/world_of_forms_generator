// G6a (task 062): tree-agnostic restore measurement (see tools/grid/measure-g5a.js): the SAME file runs in a checkout of the old commit (schema 1) and in the working tree
// (schema 2); the state after save -> validate -> plan -> apply must be the same: grids, layers, connections, colours, timeline, the export JSON.
//   node tools/session/measure-g6a.js > out.json
'use strict';
const crypto = require('crypto');
const path = require('path');
const S = require(path.join(__dirname, 'scenarios.js'));
const F = require(path.join(__dirname, 'fixtures.js'));
const h = (x) => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex').slice(0, 16);
const { world, newCtx, uiOf, snapOf, exportOf, fakeHooks, applyInto, layeredAltNet, populateCorpus, addLayer } = S;
const out = {};
// task 063: export v2 changed the export's own fields (formatVersion, meta.grid / nodeCount, nodes' zahl/u/v, lineKeys, name, patternName / themeLineOrbits); the comparison with the
// old tree hashes the export WITHOUT them, so geometry, edges, adjacency, faces and colours are still compared byte for byte.
const V2_KEYS = new Set(['formatVersion', 'name', 'patternName', 'themeLineOrbits', 'lineKeys', 'nodeCount', 'grid', 'zahl', 'u', 'v', 'glossary']);
const stripV2 = (o) => (Array.isArray(o) ? o.map(stripV2) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([k]) => !V2_KEYS.has(k)).map(([k, v]) => [k, stripV2(v)])) : o);
const STATE_JS = 'JSON.stringify({ currentShape, nodeCount, shapeSizeFactor, symmetryMode, nodes, centroid, outerCorners, connections, redoStack, altNetSeed, activeLayer, timeline: timeline && { k: timeline.keyframeLayerIds, p: timeline.playbackLayerIndex, d: timeline.segmentDurationsMs, m: timeline.segmentMembers, f: timeline.segmentFlips, q: timeline.segmentPairings }, layers: additionalLayers.map(l => ({ shape: l.shape, nodeCount: l.nodeCount, size: l.shapeSizeFactor, off: [l.offsetX, l.offsetY, l.rotation], conns: l.connections, redo: l.redoStack, nodes: l.nodes, centroid: l.centroid, corners: l.outerCorners, assign: l.faceAssignments ? [...l.faceAssignments] : null, enabled: l.enabled, playback: !!l.isTimelinePlayback })), baseAssign: baseFaceAssignments ? [...baseFaceAssignments] : null })';
function roundtrip(key, src, ui) {
    try {
        const snap = snapOf(src, ui);
        const target = world('square', 4, 1, 'none'), tui = uiOf(target, 'none', 6);
        const r = applyInto(target, snap, fakeHooks(target, snap, tui));
        out[key] = r.ok ? { state: h(target.get(STATE_JS)), src: h(src.get(STATE_JS)), exp: h(stripV2(exportOf(target))), expSrc: h(stripV2(exportOf(src))), equal: h(target.get(STATE_JS)) === h(src.get(STATE_JS)) } : 'not ok: ' + JSON.stringify(r).slice(0, 160);
    } catch (e) { out[key] = 'threw: ' + String(e && e.message).slice(0, 120); }
}
{
    const src = newCtx(); layeredAltNet(src, {}); roundtrip('layeredAltNet', src, uiOf(src, 'spiegeling', 6));
}
for (const shape of ['triangle', 'square', 'hex']) for (const c of [1, 2, 3, 5]) {
    const src = world(shape, c, 3, 'none');
    src.run('connections = [[1, 2]];');
    roundtrip('base/' + shape + '/' + c, src, uiOf(src, 'none', 6));
}
for (const shape of ['triangle', 'square']) {
    const src = world(shape, 3, 3, 'none'); src.run('connections = [[1, 2]];');
    addLayer(src, { shape, order: 1, size: 3, connections: [[1, 2]], mode: 'none' });
    addLayer(src, { shape: 'hex', order: 1, size: 3, connections: [[1, 2]], mode: 'none' });
    addLayer(src, { shape: 'square', order: 2, size: 3, connections: [[1, 2]], mode: 'none', offsetX: 20 });
    roundtrip('layersC1/' + shape, src, uiOf(src, 'none', 6));
}
const patterns = F.C.buildPatterns();
for (let i = 0; i < patterns.length; i += 11) {
    const src = newCtx(); populateCorpus(src, patterns[i], i);
    roundtrip('corpus/' + i, src, uiOf(src, 'spiegeling', 6));
}
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
