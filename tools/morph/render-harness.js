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
    const ctx = S.reset(F.makeContext({ state: true, export: true, coreOverrides: (function () { const o = {}; Object.keys(files || {}).forEach((k) => { if (/^core\//.test(k) && k !== 'core/spatial-morph-render.js' && k !== 'core/spatial-morph.js') o[k] = files[k]; }); return Object.keys(o).length ? o : undefined; })() }), shape, order, size, symmetryMode || 'none');
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

// The seam setup of the real drawn segments: a render world whose keyframe layers are the a2 test corner sets (custom nodes: every boundary endpoint has a partner on the neighbouring tile and slides on ITS
// OWN edge between the keyframes), and the list of seam point pairs found on the frame of the K00 pattern alone. keyframes = ['k00', 'k10'] or all four. Not a timeline: the caller sets it.
//   -> { w, built, ids, tiles, pairs, G, match: [[a, b]], unmatched } with a = { k, e, p } (segment index in a frame, endpoint 1 or 2, its position in the K00 frame)
function seamSetup(M, H, shape, sym, seed, keyframes, baseFrameFn) {
    const a2 = H.makeWorld(shape, 3, 3, 600);
    const built = H.buildClosedCorners(M, a2, sym, seed);
    const w = makeRenderWorld(shape, 3, 3, sym);
    const layers = keyframes.map((k) => {
        const nodes = [], conns = [];
        built.corners[k].forEach((l, i) => { nodes.push({ id: 2 * i + 1, x: l.x1, y: l.y1 }, { id: 2 * i + 2, x: l.x2, y: l.y2 }); conns.push([2 * i + 1, 2 * i + 2]); });
        const id = w.addKeyframeLayer(conns);
        w.set(`additionalLayers[${id}].nodes = ${JSON.stringify(nodes)};`);
        return id;
    });
    const tiles = w.get('spatialMorphRenderRecordTiles()');
    const polys = tiles.map((t) => w.get(`outerCorners.map(p => toTileLocal(p, ${JSON.stringify(t.c)}, ${t.flip}, ${t.rot}))`));
    const R = Math.max(...a2.poly.map((p) => Math.hypot(p.x - a2.ctr.x, p.y - a2.ctr.y)));
    const pairs = [];
    for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
        if (Math.hypot(tiles[i].c.x - tiles[j].c.x, tiles[i].c.y - tiles[j].c.y) > 2 * R + 1e-6) continue;
        const sh = polys[i].filter((p) => polys[j].some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6));
        if (sh.length === 2) pairs.push({ a: i, b: j, v: sh[0], w: sh[1] });
    }
    const ops = M.spatialMorphSymmetryOps(shape, sym).ops.length, G = built.lines * ops;
    return { w, a2, built, ids: layers, tiles, pairs, G, ops, polys, match: null, unmatched: 0, buildMatch(frame) {
        const ends = (t, v, ww) => { const o = []; for (let k = t * G; k < (t + 1) * G; k++) for (const e of [1, 2]) { const p = { x: frame[k]['x' + e], y: frame[k]['y' + e] }; if (H.distToSegment(p, v, ww) <= 1e-6) o.push({ k, e, p }); } return o; };
        const match = []; let unmatched = 0;
        for (const p of pairs) {
            const eA = ends(p.a, p.v, p.w), eB = ends(p.b, p.v, p.w), used = new Set();
            for (const oa of eA) {
                let best = -1, bd = Infinity;
                eB.forEach((ob, j) => { if (used.has(j)) return; const d = Math.hypot(oa.p.x - ob.p.x, oa.p.y - ob.p.y); if (d < bd) { bd = d; best = j; } });
                if (best < 0 || bd > 1e-9) { unmatched++; continue; }
                used.add(best); match.push([oa, eB[best]]);
            }
            unmatched += eB.length - used.size;
        }
        this.match = match; this.unmatched = unmatched; return { match, unmatched };
    }, drift(frame) {
        let d = 0, moved = 0;
        for (const [oa, ob] of this.match) { const ax = frame[oa.k]['x' + oa.e], ay = frame[oa.k]['y' + oa.e], bx = frame[ob.k]['x' + ob.e], by = frame[ob.k]['y' + ob.e]; d = Math.max(d, Math.hypot(ax - bx, ay - by)); moved = Math.max(moved, Math.hypot(ax - oa.p.x, ay - oa.p.y)); }
        return { drift: d, moved };
    } };
}

module.exports = { makeRenderWorld, seamSetup, ROOT };
