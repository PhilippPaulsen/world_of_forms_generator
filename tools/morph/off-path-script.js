// The 30 patterns of the "switch OFF changes nothing" proof (morph stage c), as SCRIPTS: offPathScript(spec) returns JavaScript source that sets one pattern up through the page's own globals
// (core/state.js, core/forms.js layerGrid(), sketch.js applyTimelineFrame()). The same source runs in a Node vm (tools/morph/test-spatial-morph-render.js, segments) and in the browser pane
// (tools/morph/measure-off-path.js, canvas pixels), so both environments draw the same patterns. A spec is plain JSON (tools/morph/off-path-specs.json):
//   { id, group, shape, order, size, mode, connections, curve?, net?, layers?: [{ shape, order, size, mode, offsetX, offsetY, rotation, connections, enabled }],
//     timeline?: { keyframes: [layer indexes], progress: 0..1, playing: bool } }
// Classic script (no module syntax): in the browser it defines the global offPathScript; in Node it is exported.
function offPathScript(spec) {
    const J = JSON.stringify;
    const L = [];
    L.push(`symmetryMode = 'none'; showFaces = false; baseNetTransform = null; baseNetAnimation = null; timeline = null; additionalLayers = []; activeLayer = 'base'; curveType = { kind: 'straight' };`);
    L.push(`currentShape = ${J(spec.shape)}; nodeCount = ${spec.order}; shapeSizeFactor = ${spec.size}; rebuildGrid(currentShape); symmetryMode = ${J(spec.mode)}; connections = ${J(spec.connections)}; redoStack = [];`);
    if (spec.curve) L.push(`curveType = ${J(spec.curve)};`);
    if (spec.net) L.push(`baseNetTransform = ${J(spec.net)};`);
    (spec.layers || []).forEach((l, i) => {
        L.push(`(function () {
            const layer = { connections: ${J(l.connections)}, redoStack: [], offsetX: ${l.offsetX || 0}, offsetY: ${l.offsetY || 0}, rotation: ${l.rotation || 0}, shape: ${J(l.shape)}, symmetryMode: ${J(l.mode)}, enabled: ${l.enabled !== false}, showFaces: false, nodeCount: ${l.order}, shapeSizeFactor: ${l.size} };
            const grid = layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, layer.shapeSizeFactor, layer.nodeCount, layer.shape, canvasW, canvasH);
            layer.nodes = grid.nodes; layer.centroid = grid.centroid; layer.outerCorners = grid.outerCorners;
            additionalLayers.push(layer);
        })();`);
    });
    if (spec.timeline) {
        const t = spec.timeline, ids = t.keyframes, segs = ids.length - 1;
        L.push(`(function () {
            const ids = ${J(ids)};
            ids.forEach(id => { additionalLayers[id]._timelineSavedEnabled = true; additionalLayers[id].enabled = false; });
            const prev = additionalLayers[ids[ids.length - 1]];
            const pb = { connections: [], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape: prev.shape, symmetryMode: prev.symmetryMode, enabled: true, showFaces: false, nodeCount: prev.nodeCount, shapeSizeFactor: prev.shapeSizeFactor, isTimelinePlayback: true };
            const grid = layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, pb.shapeSizeFactor, pb.nodeCount, pb.shape, canvasW, canvasH);
            pb.nodes = grid.nodes; pb.centroid = grid.centroid; pb.outerCorners = grid.outerCorners;
            additionalLayers.push(pb);
            timeline = { keyframeLayerIds: ids.slice(), playbackLayerIndex: additionalLayers.length - 1, segmentDurationsMs: new Array(${segs}).fill(2000), segmentPairings: new Array(${segs}).fill(null), segmentFlips: new Array(${segs}).fill(null), segmentMembers: new Array(${segs}).fill(null), netStates: ids.map(() => null), netLive: false, elapsedMs: 0, startTime: null, playing: false };
            const total = totalTimelineDurationMs(timeline);
            // 'playing': the frame is first computed through the PLAYING branch of applyTimelineFrame() (elapsed = millis() - startTime), then frozen at the exact progress (the real clock moves on between the two lines)
            if (${t.playing ? 'true' : 'false'}) { timeline.playing = true; timeline.startTime = millis() - ${t.progress} * total; applyTimelineFrame(); timeline.playing = false; }
            timeline.elapsedMs = ${t.progress} * total; applyTimelineFrame();
        })();`);
    }
    return L.join('\n');
}
if (typeof module !== 'undefined' && module.exports) module.exports = { offPathScript };
