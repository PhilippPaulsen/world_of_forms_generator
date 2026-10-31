// Test harness for the spatial morph RENDER HOOK (stage c; not a test: the glob tools/*/test-*.js does not pick it up). It runs the REAL core files (forms, orbits, symmetry, curves, netwarp, tiling,
// faces, color, facecolor, state.js, core/spatial-morph.js, core/spatial-morph-render.js) in a vm, plus the few sketch.js functions the keyframe alignment needs (cut out of the real file), and
// reads a frame the way core/faces.js and the tests do: through segmentCollector, which drawCurvedBezier() fills instead of drawing. A frame is the list of segments { x1, y1, x2, y2 } in drawing order.
//   makeRenderWorld(shape, order, size, symmetryMode, files)  -> { ctx, run, get, frame(), addKeyframeLayer(connections, opts), setTimeline(ids), setMorph(m), set(code) }
// `files` can replace a core file by path (sabotage runs): { 'core/tiling.js': '/path/to/copy.js', ... }.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const F = require('../session/fixtures.js');
const S = require('../session/scenarios.js');

const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const grab = (name) => { const m = SKETCH.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const SKETCH_NAMES = ['resolveConnectionsToCoords', 'resolveTimelineKeyframeCoords', 'isValidPairing', 'getSegmentPairing', 'isValidFlips', 'getSegmentFlips', 'applyFlipsToCoords', 'sanitizeMembers', 'layerGroupElements', 'memberImageLines',
    'ensureLayerMorphIds', 'applyLayerConnectionsMorphFrame', 'totalTimelineDurationMs', 'resolveTimelineSegment', 'applyTimelineFrame'];
const SKETCH_SRC = 'let groupElementsWarned = false;\n' + SKETCH_NAMES.map(grab).join('\n');

function readCore(rel, files) {
    const env = rel === 'core/spatial-morph-render.js' ? process.env.SPATIAL_MORPH_RENDER_JS : undefined;
    const p = (files && files[rel]) || env || path.join(ROOT, rel);
    return fs.readFileSync(p, 'utf8');
}

function makeRenderWorld(shape, order, size, symmetryMode, files) {
    files = Object.assign({}, files);
    if (process.env.TILING_JS && !files['core/tiling.js']) files['core/tiling.js'] = process.env.TILING_JS;   // sabotage runs
    // the real core + state.js + export.js in a vm (files can replace a core file: a sabotage copy, or the tree before the hook), the grid built
    const ctx = S.reset(F.makeContext({ state: true, export: true, coreOverrides: files && files['core/tiling.js'] ? { 'core/tiling.js': files['core/tiling.js'] } : undefined }), shape, order, size, symmetryMode || 'none');
    const sb = ctx.sb;
    Object.assign(sb, { width: 600, height: 600, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, millis: () => 1e6, setTimelineStatus: () => { }, lerp: (a, b, t) => t * (b - a) + a,
        line: (...a) => sb.__calls.push(['line', ...a]), bezier: (...a) => sb.__calls.push(['bezier', ...a]), __calls: [] });
    vm.runInContext(SKETCH_SRC, sb);
    // core/spatial-morph.js is already loaded by the session fixtures (SPATIAL_MORPH_JS replaces it)
    vm.runInContext(readCore('core/spatial-morph-render.js', files), sb);
    const run = (code) => vm.runInContext(code, sb);
    const world = {
        ctx, sb, run,
        get: (name) => vm.runInContext(name, sb),
        set: (code) => vm.runInContext(code, sb),
        // one frame of drawTessellation() as segments
        frame() { return vm.runInContext('(function () { segmentCollector = []; try { drawTessellation(); return segmentCollector.slice(); } finally { segmentCollector = null; } })()', sb); },
        // what drawTessellation() DRAWS: every line() and bezier() call in order (a curve or a free line is not just its chord)
        drawn() { sb.__calls.length = 0; vm.runInContext('drawTessellation()', sb); return sb.__calls.slice(); },
        status() { return JSON.parse(JSON.stringify(vm.runInContext('spatialMorphStatus()', sb))); },
        setMorph(m) { vm.runInContext(`spatialMorph = ${JSON.stringify(m)};`, sb); },
        baseConnections(conns) { vm.runInContext(`connections = ${JSON.stringify(conns)};`, sb); },
        // a keyframe layer: same shape / order / size as the base unless o says otherwise; disabled like a timeline keyframe
        addKeyframeLayer(conns, o) { S.addLayer(ctx, Object.assign({ shape: vm.runInContext('currentShape', sb), order: vm.runInContext('nodeCount', sb), size: vm.runInContext('shapeSizeFactor', sb), mode: vm.runInContext('symmetryMode', sb), connections: conns, enabled: false }, o || {})); return vm.runInContext('additionalLayers.length - 1', sb); },
        setTimeline(ids, extra) {
            const segs = ids.length - 1;
            const tl = Object.assign({ keyframeLayerIds: ids.slice(), playbackLayerIndex: null, segmentDurationsMs: new Array(segs).fill(2000), segmentPairings: new Array(segs).fill(null), segmentFlips: new Array(segs).fill(null), segmentMembers: new Array(segs).fill(null), netStates: ids.map(() => null), netLive: false, elapsedMs: 0, startTime: null, playing: false }, extra || {});
            vm.runInContext(`timeline = ${JSON.stringify(tl)};`, sb);
        },
    };
    return world;
}

module.exports = { makeRenderWorld, ROOT };
