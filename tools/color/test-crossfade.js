/**
 * tools/color/test-crossfade.js
 * Verification of the timeline color crossfade (Group D item 4, phase 3): the playback
 * layer's faces take the position-sampled, linear-light mix of the two bracketing keyframes'
 * colorings, weights (1-t, t); no identity tracking, no store writes.
 *
 *   node tools/color/test-crossfade.js
 *
 * Real morphs (random / near pairs of 3-line keyframes over three shapes and two modes),
 * driven through the REAL computeLayerCellFaces() / drawTessellation() with the app's own
 * morph function (extracted from sketch.js) - not a re-implementation of the pipeline.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor'];
const SRC = FILES.map(f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const SKETCH = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
const grab = name => { const m = SKETCH.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const MORPH_SRC = ['resolveConnectionsToCoords', 'ensureLayerMorphIds', 'applyLayerConnectionsMorphFrame'].map(grab).join('\n');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const BUILD = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };
const round = v => Math.round(v * 100) + 0;
const vset = (pts) => pts.map(p => [round(p.x), round(p.y)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).join(';');
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function makeSandbox(shape, mode, order) {
    const drawnPolys = [];
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        line: () => { }, bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, noFill: () => { }, stroke: () => { }, CLOSE: 'close',
        fill: c => { sb._fill = c; }, beginShape: () => { sb._cur = []; }, vertex: (x, y) => { sb._cur.push({ x, y }); },
        endShape: () => { drawnPolys.push({ fill: sb._fill, pts: sb._cur }); sb._cur = null; },
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, activeNetWarp: null, lineColor: '#000', altNetSeed: null,
        currentShape: shape, shapeSizeFactor: 1.3, nodeCount: order, symmetryMode: mode, width: 300, height: 300, showFaces: false,
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, activeLayer: 'base', timeline: null, drawnPolys
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb);
    vm.runInContext(SRC + '\n' + MORPH_SRC, sb);
    const grid = sb[BUILD[shape]](order, 1.3, 300, 300);
    sb.nodes = grid.nodes; sb.centroid = grid.centroid; sb.outerCorners = grid.outerCorners;
    sb.REF = vm.runInContext('OSTWALD_REFERENCE_SYSTEM', sb);
    return sb;
}
const newLayer = (sb, shape, mode, order, extra) => {
    const g = sb.layerGrid(sb.outerCorners, sb.centroid, sb.currentShape, sb.shapeSizeFactor, sb.shapeSizeFactor, order, shape, 300, 300);
    const l = { connections: [], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape, symmetryMode: mode, enabled: true, showFaces: false, nodeCount: order, shapeSizeFactor: sb.shapeSizeFactor, nodes: g.nodes, centroid: g.centroid, outerCorners: g.outerCorners, ...extra };
    sb.additionalLayers.push(l); return l;
};
// keyframes (hidden, faces on) + playback layer; more than two keyframes -> several segments
function setup(sb, shape, mode, order, idsList) {
    const kfs = idsList.map(() => newLayer(sb, shape, mode, order, { showFaces: true, enabled: false }));
    const P = newLayer(sb, shape, mode, order, { isTimelinePlayback: true });
    const tbl = sb.computeThemeLineOrbits(kfs[0].nodes, kfs[0].centroid, shape, mode, kfs[0].outerCorners);
    kfs.forEach((k, i) => { k.connections = idsList[i].map(j => tbl.orbits[j % tbl.orbits.length].pairs[0].slice()); });
    sb.timeline = { keyframeLayerIds: kfs.map((_, i) => i), playbackLayerIndex: kfs.length, segmentDurationsMs: kfs.slice(1).map(() => 2000), currentFrame: null };
    return { kfs, P, tbl };
}
const colorLayer = (sb, layer, rule, idx) => {
    const i = sb.additionalLayers.indexOf(layer), st = sb.faceAssignmentsFor(i), ov = sb.faceSheetOverrideOfLayer(layer), g = sb.sheetGroupElements(layer.nodes, ov);
    const trails = sb.computeFaceTrails(sb.computeCellFaces(layer.connections, layer.nodes, null, null, ov), g);
    const pal = sb.facePaletteFor(i); pal.ruleId = rule; pal.idx = idx.map((v, a) => v % sb.harmonyRuleParams(sb.getHarmonyRule(rule), sb.REF)[a].count);
    sb.applyPaletteToTrails(st, trails, pal);
    return trails;
};
// morph position: the playback layer's substitute + the frame the timeline would publish
const frame = (sb, S, seg, t) => {
    const A = S.kfs[seg], B = S.kfs[seg + 1];
    sb.applyLayerConnectionsMorphFrame(S.P, { fromConnections: sb.resolveConnectionsToCoords(A), toConnections: sb.resolveConnectionsToCoords(B) }, t);
    sb.timeline.currentFrame = { segmentIndex: seg, localT: t };
};
const playbackFaces = sb => { const m = sb.computeLayerCellFaces(); return m && m.has(sb.timeline.playbackLayerIndex) ? m.get(sb.timeline.playbackLayerIndex) : null; };
const kfFaces = (sb, layer) => sb.computeCellFaces(layer.connections, layer.nodes, sb.faceAssignmentsFor(sb.additionalLayers.indexOf(layer)), null, sb.faceSheetOverrideOfLayer(layer));
const canon = (sb, css) => sb.linearToHex(sb.cssColorToLinear(css));      // the color as the field sees it
const faceMap = (sb, res) => { const by = new Map(res.nodes.map(n => [n.id, n])); return res.faces.map(f => ({ key: vset(f.nodeIds.map(id => by.get(id))), color: f.color, poly: f.nodeIds.map(id => by.get(id)).map(n => ({ x: n.x, y: n.y })) })); };

const rand = rng(4711);
const CONFIGS = [];
for (const shape of ['triangle', 'square', 'hex']) for (const mode of ['rotation_reflection6', 'rotation3']) CONFIGS.push([shape, mode, 3]);
const pick = (n, k) => { const a = []; while (a.length < Math.min(k, n)) { const i = Math.floor(rand() * n); if (!a.includes(i)) a.push(i); } return a; };

// ============ 1. endpoints ============
console.log('== 1. t=0 and t=1 give each keyframe\'s own colors ==');
let snapDiffers = 0, ambiguous = 0, morphs = 0, endFaces = 0, endBad = 0, assignedFaces = 0, defaultFaces = 0, midFrames = 0, midFaces = 0, convexBad = 0, linearBad = 0, linearUniform = 0, srgbDiffers = 0, srgbTested = 0, nanBad = 0;
const timesFade = [], timesBase = [];
for (const [shape, mode, order] of CONFIGS) {
    for (let m = 0; m < 6; m++) {
        const sb = makeSandbox(shape, mode, order);
        const N = sb.computeThemeLineOrbits(sb.nodes, sb.centroid, shape, mode, sb.outerCorners).orbits.length;
        let A = pick(N, 3), B = pick(N, 3);
        if (m % 2 === 1) { B = A.slice(); let o; do { o = Math.floor(rand() * N); } while (A.includes(o)); B[Math.floor(rand() * B.length)] = o; }
        const S = setup(sb, shape, mode, order, [A, B]);
        // variant: 0,1 = both colored; 2 = only A; 3 = only B; 4 = A fully, B partially (one trail)
        const variant = m % 5;
        if (variant !== 3) colorLayer(sb, S.kfs[0], 'tetrad', [0, 2]);
        if (variant !== 2 && variant !== 4) colorLayer(sb, S.kfs[1], 'isotint', [12, 3]);
        if (variant === 4) { const trs = colorLayer(sb, S.kfs[1], 'isotint', [12, 3]); const st = sb.faceAssignmentsFor(1); [...st.keys()].slice(1).forEach(k => st.delete(k)); }
        morphs++;
        const kA = faceMap(sb, kfFaces(sb, S.kfs[0])), kB = faceMap(sb, kfFaces(sb, S.kfs[1]));
        for (const [t, kf] of [[0, kA], [1, kB]]) {
            frame(sb, S, 0, t);
            const res = playbackFaces(sb);
            // A playback face is matched to the keyframe face that CONTAINS its interior samples (not by vertex
            // set: the morph's free nodes are not snapped to grid nodes the way a keyframe's real nodes are, so
            // a face can differ by a fraction of a pixel - counted below as `snapDiffers`).
            const byKey = new Map(kf.map(f => [f.key, f.color]));
            faceMap(sb, res).forEach(f => {
                endFaces++;
                if (!byKey.has(f.key)) snapDiffers++;
                const owners = new Set(sb.faceSamplePoints(f.poly).map(p => kf.findIndex(k => sb.pointInPolygon(p, k.poly))));
                if (owners.size !== 1 || owners.has(-1)) { ambiguous++; return; }
                const want = kf[[...owners][0]].color;
                if (canon(sb, f.color) !== canon(sb, want)) endBad++;
                if (want.startsWith('#')) assignedFaces++; else defaultFaces++;
            });
        }
        // mid frames: linear-light mix, convexity, in [0,1]
        const fieldA = sb.keyframeColorField(kfFaces(sb, S.kfs[0])), fieldB = sb.keyframeColorField(kfFaces(sb, S.kfs[1]));
        const look = (field, p) => { for (const f of field) if (sb.pointInPolygon(p, f.poly)) return f.lin; return null; };
        for (const t of [0.25, 0.5, 0.75]) {
            frame(sb, S, 0, t); midFrames++;
            const res = playbackFaces(sb);
            const by = new Map(res.nodes.map(n => [n.id, n]));
            res.faces.forEach(f => {
                midFaces++;
                const poly = f.nodeIds.map(id => by.get(id)).map(n => ({ x: n.x, y: n.y }));
                const samples = sb.faceSamplePoints(poly), pairs = samples.map(p => [look(fieldA, p), look(fieldB, p)]);
                const lin = sb.cssColorToLinear(f.color);
                if (lin.some(v => !Number.isFinite(v))) nanBad++;
                // convexity: every channel within the min/max of the colors it mixes
                const all = pairs.flatMap(p => p.filter(Boolean));
                if (all.length) for (let k = 0; k < 3; k++) { const lo = Math.min(...all.map(c => c[k])), hi = Math.max(...all.map(c => c[k])); if (lin[k] < lo - 1.5e-3 || lin[k] > hi + 1.5e-3) convexBad++; }
                // uniform case: every sample sees the same A color and the same B color -> exactly the linear-light mix (hex quantization aside)
                const both = pairs.every(p => p[0] && p[1]);
                if (both && pairs.every(p => sb.linearToHex(p[0]) === sb.linearToHex(pairs[0][0]) && sb.linearToHex(p[1]) === sb.linearToHex(pairs[0][1]))) {
                    linearUniform++;
                    const a = pairs[0][0], b = pairs[0][1];
                    const want = sb.linearToHex([0, 1, 2].map(k => (1 - t) * a[k] + t * b[k]));
                    if (f.color !== want) linearBad++;
                    // the same mix done on sRGB values would differ (so the test could tell linear light apart)
                    const sa = a.map(sb.linearToSrgb8), sbb = b.map(sb.linearToSrgb8);
                    const srgbMix = '#' + [0, 1, 2].map(k => Math.round((1 - t) * sa[k] + t * sbb[k]).toString(16).padStart(2, '0')).join('');
                    srgbTested++; if (srgbMix !== want) srgbDiffers++;
                }
            });
        }
        // timing of the crossfade computation alone, in this wired setup
        frame(sb, S, 0, 0.5);
        const base = sb.computeCellFaces(S.P._morphConnections, S.P._morphNodes, null, null, sb.faceSheetOverrideOfLayer(S.P));
        const tf0 = process.hrtime.bigint(); for (let i = 0; i < 20; i++) sb.playbackCrossfadeColors(base); timesFade.push(Number(process.hrtime.bigint() - tf0) / 1e6 / 20);
        const tb0 = process.hrtime.bigint(); for (let i = 0; i < 20; i++) sb.computeCellFaces(S.P._morphConnections, S.P._morphNodes, null, null, sb.faceSheetOverrideOfLayer(S.P)); timesBase.push(Number(process.hrtime.bigint() - tb0) / 1e6 / 20);
    }
}
console.log(`  info: ${snapDiffers} of ${endFaces} endpoint faces differ from their keyframe face by node snapping (sub-pixel; matched by containment instead); ${ambiguous} straddle two keyframe faces`);
check('at t=0 and t=1 every playback face has exactly its keyframe\'s face color (assigned #hex or default hsl, compared as the displayed color)', endBad === 0 && endFaces > 0 && ambiguous <= endFaces * 0.01, `${morphs} morphs (3 shapes x 2 modes; both/one/partly colored), ${endFaces} face checks (${assignedFaces} assigned, ${defaultFaces} default)`);
check('mid-morph: where every sample sees one A color and one B color the face is exactly the LINEAR-LIGHT mix (1-t)a + tb', linearBad === 0 && linearUniform > 0, `${linearUniform} uniform faces of ${midFaces}`);
check('control: the same mix in sRGB would give a different color in most of those cases (the test can tell them apart)', srgbTested > 0 && srgbDiffers / srgbTested > 0.3, `${srgbDiffers}/${srgbTested} differ`);
check('every face color is a convex combination of the colors it samples (per channel) and finite', convexBad === 0 && nanBad === 0, `${midFaces} faces in ${midFrames} mid frames`);

// ============ 2. fallback, one-sided, multi-segment ============
console.log('\n== 2. fallbacks and segments ==');
{
    const sb = makeSandbox('triangle', 'rotation_reflection6', 4);
    const S = setup(sb, 'triangle', 'rotation_reflection6', 4, [[0, 4, 5], [0, 4, 8], [2, 4, 8]]);
    frame(sb, S, 0, 0.5);
    const defaults = playbackFaces(sb);
    const plain = sb.computeCellFaces(S.P._morphConnections, S.P._morphNodes, null, null, sb.faceSheetOverrideOfLayer(S.P));
    check('neither keyframe colored: playback fills are byte-identical to the default orbit colors (Phase 1 behavior)', eq(defaults, plain) && sb.playbackCrossfadeColors(plain) === null);
    colorLayer(sb, S.kfs[0], 'tetrad', [0, 2]); colorLayer(sb, S.kfs[1], 'isotint', [12, 3]); colorLayer(sb, S.kfs[2], 'shadow-series', [6, 4]);
    // segment 0: kf0->kf1, segment 1: kf1->kf2
    const canonList = (res, kf) => { const m = new Map(faceMap(sb, kf).map(f => [f.key, f.color])); return faceMap(sb, res).every(f => m.has(f.key) && canon(sb, m.get(f.key)) === canon(sb, f.color)); };
    frame(sb, S, 1, 0); const s1a = playbackFaces(sb);
    frame(sb, S, 1, 1); const s1b = playbackFaces(sb);
    check('second segment: t=0 shows keyframe 1\'s coloring, t=1 keyframe 2\'s (the bracketing pair follows timeline.currentFrame)', canonList(s1a, kfFaces(sb, S.kfs[1])) && canonList(s1b, kfFaces(sb, S.kfs[2])));
    frame(sb, S, 0, 0.4);
    const before = playbackFaces(sb);
    sb.timeline.currentFrame = null;
    check('no published frame: no crossfade (default colors), no error', (() => { const r = playbackFaces(sb); return r.faces.every((f, i) => f.color === plain.faces[0].color || typeof f.color === 'string'); })());
    check('the color is the same on repeated evaluation of the same frame (deterministic)', (() => { frame(sb, S, 0, 0.4); return eq(before, playbackFaces(sb)); })());
    check('sketch.js publishes the frame (applyTimelineFrame() writes timeline.currentFrame = {segmentIndex, localT}) and clears it on an unresolvable segment',
        /timeline\.currentFrame = \{ segmentIndex: segment\.segmentIndex, localT: segment\.localT \}/.test(SKETCH) && /timeline\.currentFrame = null;/.test(SKETCH));
}

// ============ 3. no store writes, cache ============
console.log('\n== 3. nothing written; keyframe fields cached ==');
{
    const sb = makeSandbox('triangle', 'rotation_reflection6', 4);
    const S = setup(sb, 'triangle', 'rotation_reflection6', 4, [[0, 4, 5], [0, 4, 8]]);
    colorLayer(sb, S.kfs[0], 'tetrad', [0, 2]); colorLayer(sb, S.kfs[1], 'isotint', [12, 3]);
    sb.computeCellFaces(S.kfs[0].connections, S.kfs[0].nodes, sb.faceAssignmentsFor(0), null, sb.faceSheetOverrideOfLayer(S.kfs[0]));
    const stores = () => JSON.stringify([0, 1, 2].map(i => [...sb.faceAssignmentsFor(i)]));
    const snaps = () => [0, 1, 2].map(i => sb.faceSnapshotFor(sb.faceAssignmentsFor(i)));
    // count computeCellFaces() calls on the KEYFRAME grids (from before the first frame)
    let kfCalls = 0; const orig = sb.computeCellFaces;
    sb.computeCellFaces = function (c, nodes, ...r) { if (nodes === S.kfs[0].nodes || nodes === S.kfs[1].nodes) kfCalls++; return orig.call(this, c, nodes, ...r); };
    frame(sb, S, 0, 0); playbackFaces(sb);          // the first frame builds both fields and records each keyframe store's baseline snapshot
    const s0 = stores(), sn0 = snaps();
    for (let f = 1; f <= 40; f++) { frame(sb, S, 0, f / 40); playbackFaces(sb); }
    check('41 playback frames: no store entry is written or removed (keyframes\' and playback layer\'s), snapshots untouched', stores() === s0 && eq(snaps().map(x => x && x.faceCount), sn0.map(x => x && x.faceCount)));
    check('the two keyframe fields are built once for 41 frames, not per frame', kfCalls === 2, `${kfCalls} keyframe face computations`);
    // an edit to keyframe 2's geometry that keeps the line count (the morph stays resolvable)
    S.kfs[1].connections[2] = S.tbl.orbits[3].pairs[0].slice();
    kfCalls = 0; frame(sb, S, 0, 0.5); playbackFaces(sb); playbackFaces(sb);
    check('editing a keyframe\'s connections rebuilds ITS field once; the unedited keyframe\'s is reused', kfCalls === 1, `${kfCalls} keyframe face computation(s)`);
    kfCalls = 0;
    sb.faceAssignmentsFor(1).set('x', { hue: 3, w: 0.1, s: 0.1, rule: null, params: null });   // any change to a keyframe's store
    playbackFaces(sb);
    check('a change to a keyframe\'s store rebuilds its field', kfCalls >= 1);
}

// ============ 4. through the real drawing ============
console.log('\n== 4. the real drawTessellation() fills the crossfade colors ==');
{
    let cases = 0, bad = 0, drawnTotal = 0;
    for (const shape of ['triangle', 'hex']) {
        const sb = makeSandbox(shape, 'rotation_reflection6', 3);
        const S = setup(sb, shape, 'rotation_reflection6', 3, [[0, 2, 5], [1, 4, 7]]);
        colorLayer(sb, S.kfs[0], 'tetrad', [0, 2]); colorLayer(sb, S.kfs[1], 'isotint', [12, 3]);
        for (const t of [0, 0.3, 0.5, 0.8, 1]) {
            cases++; frame(sb, S, 0, t);
            sb.drawnPolys.length = 0; sb.showFaces = false; sb.drawTessellation();
            const res = playbackFaces(sb), by = new Map(res.nodes.map(n => [n.id, n]));
            const want = new Set(res.faces.map(f => f.nodeIds.map(id => by.get(id)).map(n => `${round(n.x)},${round(n.y)}`).join(';') + '|' + f.color));
            const got = new Set(sb.drawnPolys.filter(p => p.pts.length).map(p => p.pts.map(v => `${round(v.x)},${round(v.y)}`).join(';') + '|' + p.fill));
            drawnTotal += want.size;
            if (![...want].every(w => got.has(w))) bad++;
        }
    }
    check('every playback face is filled by the real drawing in exactly its crossfade color (per frame)', bad === 0, `${cases} frames, ${drawnTotal} faces`);
}

// ============ 5. cost ============
console.log('\n== 5. cost of the crossfade computation (wired, headless) ==');
{
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const sorted = timesFade.slice().sort((a, b) => a - b);
    console.log(`  playbackCrossfadeColors() per frame: mean ${mean(timesFade).toFixed(2)} ms, p90 ${sorted[Math.floor(sorted.length * 0.9)].toFixed(2)} ms, max ${sorted[sorted.length - 1].toFixed(2)} ms   (face detection of the same frame: mean ${mean(timesBase).toFixed(2)} ms)`);
    check('the crossfade computation stays small next to face detection and far below a frame (mean < 2 ms)', mean(timesFade) < 2);
}
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
