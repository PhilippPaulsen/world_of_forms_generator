// Task 075 (size steps 2 and 3): a size change of the base carries the layers, the timeline, the alt net and the face colours along; it asks first only when colour groups would be lost.
//   node tools/grid/test-resize-layers.js     BASE = the commit before 075 (default 1e110c99); OLD_TREE = that tree already extracted; NO_OLD=1 skips (1)
//   1. nothing without a size change moves: measure scripts byte-equal to the old tree, protected files and the eight protected functions unchanged
//   2. layers: 3 shapes x ordnung 1..4 x lage 1/2 x 72 size pairs, a layer of the same shape and one of another shape: size L * new / old (exact fraction), geometry = the scaled old one (0 px) = the layer
//      rebuilt at the new base, offset * old / new, rotation, connections, gridSpec, free point; the drawing with offset and rotation = the scaled old drawing (100 %) = a rebuild (hash)
//   3. alt net with layers: the seed is scaled and the layers follow (0 px); session round trip with layers, timeline and colours after a size change
//   4. timeline: keyframes, pairings, flips, members, net specs are the same object; the playback at t = 0, .5, 1 before = after (scaled, 100 %)
//   5. colours: real assignments carried (square: face by face, 0 lost), the dry run says what the real run does and changes nothing, palette overrides re-keyed, anchor / harmony / selection / strategy kept,
//      the default gray refilled and not counted, layer colours too; what merges or vanishes is counted
//   6. the handler (real text from sketch.js on fakes): no dialog for lines / layers / timeline / carried colours, the dialog only for lost colour groups, cancel changes nothing, the notice names what was
//      kept, adjusted and not kept (de/en), the Field hint
//   7. sources
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || '1e110c99';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
const hash = x => crypto.createHash('sha256').update(typeof x === 'string' ? x : J(x)).digest('hex').slice(0, 16);
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const SK = read('sketch.js');
const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const MODE = 'rotation_reflection6', SHAPES = ['triangle', 'square', 'hex'], SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const OTHER = { triangle: 'square', square: 'hex', hex: 'triangle' };

// ---- 1. old tree ----------------------------------------------------------------------------------------------------------------------------------
let oldDir = process.env.OLD_TREE || null;
if (!oldDir && !process.env.NO_OLD) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resize2-old-'));
        cp.execSync(`git archive ${BASE} | tar -x -C "${oldDir}"`, { cwd: ROOT, stdio: 'ignore' });
    } catch (e) { oldDir = null; }
}
if (!oldDir) console.log('NOTE  the old tree is not available: the comparison with it is skipped');
else {
    const run = (cwd, script) => cp.execFileSync('node', [script], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
    for (const script of ['tools/grid/measure-g5a.js', 'tools/grid/measure-g5b.js', 'tools/session/measure-g6a.js', 'tools/grid/measure-g6b.js', 'tools/grid/measure-lage2-app.js', 'tools/grid/measure-size-change.js']) {
        let a, b, err = '';
        try { a = JSON.parse(run(oldDir, script)); b = JSON.parse(run(ROOT, script)); } catch (e) { err = String(e.message).slice(0, 200); }
        const keys = a ? Object.keys(b) : [], bad = a ? keys.filter(k => J(a[k]) !== J(b[k])) : [];
        check('(1) ' + script + ' equals the old tree (' + keys.length + ' keys)', a && keys.length > 3 && bad.length === 0, err || bad.slice(0, 3).join(' | '));
    }
    const same = f => read(f) === fs.readFileSync(path.join(oldDir, f), 'utf8');
    check('(1) core/faces.js, core/tiling.js, core/facecolor.js, tools/morph/off-path-golden.json, core/session*.js, core/export.js unchanged',
        ['core/faces.js', 'core/tiling.js', 'core/facecolor.js', 'tools/morph/off-path-golden.json', 'core/session.js', 'core/session-apply.js', 'core/export.js'].every(same));
    const PROT = ['applyTimelineFrame', 'applyLayerConnectionsMorphFrame', 'resolveTimelineKeyframeCoords', 'resolveTimelineSegment', 'totalTimelineDurationMs', 'setTimelineProgress', 'toggleTimelinePlayback', 'previewTimelineSegmentMidpoint'];
    const oldSK = fs.readFileSync(path.join(oldDir, 'sketch.js'), 'utf8');
    const grabIn = (src, name) => { const m = src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); return m ? m[0] : null; };
    check('(1) the eight protected functions of sketch.js are byte-equal to the old tree', PROT.every(n => grabIn(SK, n) && grabIn(SK, n) === grabIn(oldSK, n)));
}

// ---- worlds and helpers -----------------------------------------------------------------------------------------------------------------------------
const worlds = {};
const W = (shape) => worlds[shape] || (worlds[shape] = H.makeRenderWorld(shape, 3, 3, MODE));
const setup = (w, shape, ord, lage, size) => w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: ord, lage })}); shapeSizeFactor = ${size}; symmetryMode = ${J(MODE)}; connections = []; redoStack = []; baseNetTransform = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; baseFaceAnchor = null; baseLastHarmonyType = null; baseLastSelection = null; baseDistributionStrategy = null; spatialMorph = { enabled: false, mode: 'linear', angleDeg: 0 }; rebuildGrid(currentShape);`);
// a layer of any shape / ordnung / lage / size (size may be a fraction), built exactly like S.addLayer() but through layerGridForSpec
const addLayer = (w, o) => w.set(`(function () {
    const layer = { connections: ${J(o.connections || [])}, redoStack: ${J(o.redo || [])}, offsetX: ${o.offsetX || 0}, offsetY: ${o.offsetY || 0}, rotation: ${o.rotation || 0}, shape: ${J(o.shape)}, symmetryMode: ${J(o.mode || MODE)}, enabled: ${o.enabled !== false}, showFaces: ${!!o.showFaces}, shapeSizeFactor: ${o.size} };
    projectLayerGridSpec(layer, ${J({ shape: o.shape, ordnung: o.ord, lage: o.lage || 1 })});
    const grid = layerGridForSpec(outerCorners, centroid, currentShape, shapeSizeFactor, layer.shapeSizeFactor, layer.gridSpec, layer.shape, canvasW, canvasH);
    layer.nodes = grid.nodes; layer.centroid = grid.centroid; layer.outerCorners = grid.outerCorners;
    ${o.free ? `layer.nodes.push({ id: layer.nodes.length + 1, x: ${o.free[0]}, y: ${o.free[1]}, free: true });` : ''}
    ${o.playback ? 'layer.isTimelinePlayback = true;' : ''}
    additionalLayers.push(layer);
})()`);
const CX = 300, CY = 300;
const scaleP = (p, f) => ({ x: CX + (p.x - CX) * f, y: CY + (p.y - CY) * f });
const segKey = (s) => { const r = (v) => Math.round(v * 1000); const a = [r(s.x1), r(s.y1)], b = [r(s.x2), r(s.y2)]; return (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a]).join(';'); };
const insideCanvas = (s) => [s.x1, s.y1, s.x2, s.y2].every((v) => v >= 0 && v <= 600);
function mapMatch(oldSegs, newSegs, f) {
    const set = new Set(newSegs.map(segKey)); let n = 0, k = 0;
    for (const s of oldSegs) { const p = scaleP({ x: s.x1, y: s.y1 }, f), q = scaleP({ x: s.x2, y: s.y2 }, f), m = { x1: p.x, y1: p.y, x2: q.x, y2: q.y }; if (!insideCanvas(m)) continue; n++; if (set.has(segKey(m))) k++; }
    return { n, k };
}
const layersOf = (w) => JSON.parse(w.get('JSON.stringify(additionalLayers.map(l => ({ size: l.shapeSizeFactor, ox: l.offsetX, oy: l.offsetY, rot: l.rotation, conns: l.connections, redo: l.redoStack, spec: l.gridSpec, nodes: l.nodes, centroid: l.centroid, corners: l.outerCorners, shape: l.shape })))'));
const baseOf = (w) => JSON.parse(w.get('JSON.stringify({ nodes, centroid, outerCorners })'));

// ---- 2. layers --------------------------------------------------------------------------------------------------------------------------------------
{
    let pairs = 0, badSize = 0, badGeom = 0, badRebuild = 0, badOffset = 0, badMisc = 0, maxRes = 0;
    for (const shape of SHAPES) {
        const w = W(shape), other = OTHER[shape];
        for (const lage of [1, 2]) for (let ord = 1; ord <= 4; ord++) for (const a of SIZES) for (const b of SIZES) {
            if (a === b) continue;
            setup(w, shape, ord, lage, a);
            const g0 = baseOf(w), nn = g0.nodes.length;
            addLayer(w, { shape, ord, lage, size: 3, offsetX: 30, offsetY: -18, rotation: 17, connections: [[1, 2], [2, 3]], redo: [[1, 3]], free: [301.5, 288.25], showFaces: false });
            addLayer(w, { shape: other, ord: Math.min(ord, 3), lage: 1, size: 2, offsetX: -12, offsetY: 8, rotation: 0, connections: [[1, 2]] });
            const L0 = layersOf(w);
            w.get(`resizeBase(${b})`);
            const L1 = layersOf(w), f = a / b, base1 = baseOf(w);
            pairs++;
            [3, 2].forEach((Lold, i) => {
                const l0 = L0[i], l1 = L1[i];
                if (l1.size !== (Lold * b) / a) badSize++;
                const grid0 = l0.nodes.filter(n => !n.free), grid1 = l1.nodes.filter(n => !n.free);
                const res = Math.max(...grid0.map((n, k) => dist(scaleP(n, f), grid1[k])), ...l0.corners.map((c, k) => dist(scaleP(c, f), l1.corners[k])), dist(scaleP(l0.centroid, f), l1.centroid));
                maxRes = Math.max(maxRes, res); if (!(res < 1e-9) || grid0.length !== grid1.length) badGeom++;
                // the layer rebuilt at the new base with its new size
                const reb = JSON.parse(J(w.get(`layerGridForSpec(outerCorners, centroid, currentShape, shapeSizeFactor, ${l1.size}, ${J(l0.spec)}, ${J(l0.shape)}, canvasW, canvasH)`)));
                if (J(reb.nodes) !== J(grid1) || J(reb.outerCorners) !== J(l1.corners)) badRebuild++;
                if (Math.abs(l1.ox - l0.ox * f) > 1e-12 || Math.abs(l1.oy - l0.oy * f) > 1e-12) badOffset++;
                if (l1.rot !== l0.rot || J(l1.conns) !== J(l0.conns) || J(l1.redo) !== J(l0.redo) || J(l1.spec) !== J(l0.spec) || l1.shape !== l0.shape) badMisc++;
            });
            const fr0 = L0[0].nodes.find(n => n.free), fr1 = L1[0].nodes.find(n => n.free);
            if (!fr1 || fr1.id !== fr0.id || dist(fr1, scaleP(fr0, f)) > 1e-9) badMisc++;
            if (J(base1.nodes.map(n => n.id)) !== J(g0.nodes.map(n => n.id))) badMisc++;
        }
    }
    check(`(2) ${pairs} cases (3 shapes x ordnung 1..4 x lage 1/2 x 72 size pairs, two layers each): size L * new / old exactly`, pairs === 3 * 2 * 4 * 72 && badSize === 0, badSize);
    check(`(2) layer nodes, corners and centroid = the scaled old ones (max rest ${maxRes.toExponential(1)} px) and = the layer rebuilt at the new base`, badGeom === 0 && badRebuild === 0, `${badGeom} ${badRebuild}`);
    check('(2) offset X / Y * old / new, rotation unchanged, connections, redo stack, gridSpec, shape and the free point (id kept, scaled) unchanged, base ids unchanged', badOffset === 0 && badMisc === 0, `${badOffset} ${badMisc}`);
    // the drawing: two layers with offset and rotation, the scaled old drawing is in the new one, and = a rebuild (hash)
    let n = 0, k = 0, bad = 0, drawn = 0;
    const PAIRS = [[2, 4], [3, 6], [4, 2], [6, 3], [3, 5], [5, 3], [1, 9], [9, 1], [2, 8], [7, 3], [5, 7], [8, 2]];
    for (const shape of SHAPES) {
        const w = W(shape), other = OTHER[shape];
        for (const [a, b] of PAIRS) {
            const build = (size, conns, Ls1, Ls2, f) => { setup(w, shape, 2, 1, size); w.set(`connections = ${J(conns)};`); addLayer(w, { shape, ord: 2, lage: 1, size: Ls1, offsetX: 30 * f, offsetY: -18 * f, rotation: 17, connections: [conns[0]] }); addLayer(w, { shape: other, ord: 2, lage: 1, size: Ls2, offsetX: -12 * f, offsetY: 8 * f, rotation: 0, connections: [conns[1]] }); };
            setup(w, shape, 2, 1, a); const conns = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 3)');
            build(a, conns, 3, 2, 1); const f0 = w.frame(); w.get(`resizeBase(${b})`); const f1 = w.frame();
            build(b, conns, (3 * b) / a, (2 * b) / a, a / b); const f2 = w.frame();
            const m = mapMatch(f0, f1, a / b); n += m.n; k += m.k; drawn++;
            if (hash(f1) !== hash(f2)) bad++;
        }
    }
    check(`(2) the drawing (layers with offset and rotation, ${drawn} cases): the scaled old drawing is ${k}/${n} in the new one (100 %), = a rebuild with the scaled offsets (hash)`, n > 1000 && k === n && bad === 0, `${k}/${n} ${bad}`);
}

// ---- 3. alt net with layers, session round trip --------------------------------------------------------------------------------------------------------
{
    const NSIDES = { triangle: 3, square: 4, hex: 6 };
    let cases = 0, bad = 0, badSeed = 0;
    for (const shape of SHAPES) {
        const w = W(shape);
        for (const [a, b] of [[4, 2], [2, 4], [3, 6], [6, 3], [5, 7], [1, 9], [9, 1]]) {
            setup(w, shape, 2, 1, a);
            const P = { x: 220, y: 260 }, Q = { x: 330, y: 250 };
            w.set(`rebuildGridFromConstruction(${J(P)}, ${J(Q)}, ${NSIDES[shape]}, 1);`);
            addLayer(w, { shape, ord: 2, lage: 1, size: 3, offsetX: 10, offsetY: 5, rotation: 9, connections: [[1, 2]] });
            addLayer(w, { shape: OTHER[shape], ord: 2, lage: 1, size: 2, connections: [[1, 2]] });
            const L0 = layersOf(w), f = a / b;
            w.get(`resizeBase(${b})`);
            const L1 = layersOf(w), seed = w.get('altNetSeed');
            cases++;
            if (!seed || dist(seed.p, scaleP(P, f)) > 1e-9 || dist(seed.q, scaleP(Q, f)) > 1e-9) badSeed++;
            L0.forEach((l0, i) => { const g0 = l0.nodes.filter(n => !n.free), g1 = L1[i].nodes.filter(n => !n.free); if (!(Math.max(...g0.map((n, k) => dist(scaleP(n, f), g1[k]))) < 1e-7)) bad++; });
        }
    }
    check(`(3) alt net with a same-shape and an other-shape layer (${cases} cases): the seed (p, q) is scaled and every layer's nodes are the scaled ones (0 px)`, cases === 21 && badSeed === 0 && bad === 0, `${badSeed} ${bad}`);

    // session round trip: base with lines, free point and colours, two layers (one fraction after the change), a timeline with two keyframes and a playback layer
    const w = W('square'); setup(w, 'square', 3, 1, 3);
    const nn = w.get('nodes.length');
    w.set(`nodes.push({ id: ${nn + 1}, x: 333.5, y: 271.25, free: true }); connections = [[1, 5], [2, 8], [3, 7], [1, ${nn + 1}]]; redoStack = [[2, 3]]; freeEndpointsEnabled = true;`);
    addLayer(w, { shape: 'square', ord: 3, size: 3, connections: [[1, 2]], enabled: false });   // keyframe 1
    addLayer(w, { shape: 'square', ord: 3, size: 3, connections: [[1, 3]], enabled: false });   // keyframe 2
    addLayer(w, { shape: 'square', ord: 3, size: 3, playback: true });
    addLayer(w, { shape: 'square', ord: 3, size: 2, offsetX: 20, offsetY: 4, rotation: 31, connections: [[2, 3]], showFaces: true });
    w.setTimeline([0, 1], { playbackLayerIndex: 2 });
    w.set('additionalLayers[0]._timelineSavedEnabled = true; additionalLayers[1]._timelineSavedEnabled = true; timeline.segmentPairings = [[1, 0]]; timeline.segmentFlips = [null]; timeline.segmentMembers = [null];');
    S.colorBase(w.ctx, {});
    const tl0 = w.get('JSON.stringify(timeline)');
    const r = w.get('resizeBase(5)');
    const tl1 = w.get('JSON.stringify(timeline)');
    check('(3) base with lines, free point, colours, four layers and a timeline: size 3 -> 5; the layer of size 2 becomes 10/3 (a fraction), the others 5; nothing is reported lost', w.get('shapeSizeFactor') === 5 && w.get('additionalLayers.map(l => l.shapeSizeFactor).join()') === `5,5,5,${(2 * 5) / 3}` && r.lost.colorsCount === 0 && r.kept.layers === 4 && r.kept.timeline === true, J(r));
    check('(3) the timeline (keyframe ids, playback index, durations, pairings, flips, members, net states) is the same data', tl0 === tl1, tl1.slice(0, 120));
    const ui = S.uiOf(w.ctx, 'spiegeling', 6), snap = S.snapOf(w.ctx, ui), exp = S.exportOf(w.ctx);
    const target = S.world('hex', 4, 1, 'none'), tui = S.uiOf(target, 'none', 6), hooks = S.fakeHooks(target, snap, tui);
    const ap = S.applyInto(target, snap, hooks);
    check('(3) session round trip after the change (fraction layer size, layers, timeline, colours): apply into another world gives the identical snapshot and export', ap.ok && S.safe(() => S.same(S.snapOf(target, tui), snap)) && S.safe(() => S.same(S.exportOf(target), exp)) && target.get('additionalLayers[3].shapeSizeFactor') === (2 * 5) / 3, J(ap).slice(0, 200));
}

// ---- 4. timeline playback ----------------------------------------------------------------------------------------------------------------------------
{
    let n = 0, k = 0, cases = 0, badTl = 0;
    for (const shape of SHAPES) {
        const w = W(shape);
        for (const [a, b] of [[3, 5], [5, 2], [2, 6], [6, 3], [4, 7]]) {
            setup(w, shape, 2, 1, a);
            const conns = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 3)');
            w.set(`connections = ${J([conns[2]])};`);
            const k1 = w.addKeyframeLayer([conns[0]]), k2 = w.addKeyframeLayer([conns[1]]);
            addLayer(w, { shape, ord: 2, size: a, playback: true });
            w.setTimeline([k1, k2], { playbackLayerIndex: 2 });
            w.set('timeline.segmentPairings = [[1, 0]];');
            const frame = (t) => { w.set(`timeline.elapsedMs = ${t * 2000}; applyTimelineFrame();`); return w.frame(); };
            const before = [0, 0.5, 1].map(frame), tl0 = w.get('JSON.stringify(timeline)');
            w.get(`resizeBase(${b})`);
            const after = [0, 0.5, 1].map(frame);
            cases++;
            if (w.get('JSON.stringify(timeline)') !== tl0.replace(/"elapsedMs":[\d.]+/, '"elapsedMs":' + 2000) && w.get('JSON.stringify(timeline.keyframeLayerIds) + timeline.playbackLayerIndex + JSON.stringify(timeline.segmentPairings)') !== '[0,1]2[[1,0]]') badTl++;
            before.forEach((f0, i) => { const m = mapMatch(f0, after[i], a / b); n += m.n; k += m.k; });
        }
    }
    check(`(4) timeline with two keyframe layers, a playback layer and a pairing, ${cases} cases: keyframes, playback index and pairing are the same`, badTl === 0, badTl);
    check(`(4) the playback at t = 0, .5, 1 before = after, scaled: ${k}/${n} segments (100 %)`, n > 300 && k === n, `${k}/${n}`);
}

// ---- 5. colours ---------------------------------------------------------------------------------------------------------------------------------------
{
    const faceColors = (w, store) => w.get(`(function () { const r = computeCellFaces(connections, nodes, ${store}); const byId = new Map(r.nodes.map(n => [n.id, n]));
        return r.faces.map(f => ({ poly: f.nodeIds.map(id => ({ x: byId.get(id).x, y: byId.get(id).y })), color: f.color })); })()`);
    const stats = {};
    for (const shape of SHAPES) {
        const w = W(shape); let cases = 0, carried = 0, faces = 0, equal = 0, lost0Cases = 0, lostAny = 0, dryBad = 0, paletteBad = 0, otherBad = 0, grayCmp = 0, grayEq = 0;
        for (const lage of [1, 2]) for (const ord of [2, 3, 4]) for (const [a, b] of [[3, 5], [5, 3], [2, 6], [6, 2], [4, 7], [9, 1], [1, 9], [8, 3]]) {
            setup(w, shape, ord, lage, a);
            w.set('connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 4);');
            try { S.colorBase(w.ctx, { type: 'custom' }); } catch (e) { continue; }
            const real0 = w.get("Array.from(baseFaceAssignments.values()).filter(a => a.rule !== 'max-contrast-gray').length");
            if (!real0) continue;
            cases++;
            const before = faceColors(w, 'baseFaceAssignments');
            const kept0 = w.get('JSON.stringify([baseFaceAnchor, baseLastHarmonyType, baseLastSelection, baseDistributionStrategy, baseFacePalette.ruleId, baseFacePalette.idx])');
            const oKey0 = w.get('Array.from(baseFacePalette.overrides.keys())[0]');
            const stBefore = w.get('JSON.stringify([nodes, connections, shapeSizeFactor, gridRevision, Array.from(baseFaceAssignments.keys())])');
            const dry = w.get(`resizeBase(${b}, { dryRun: true })`);
            if (w.get('JSON.stringify([nodes, connections, shapeSizeFactor, gridRevision, Array.from(baseFaceAssignments.keys())])') !== stBefore) dryBad++;
            const r = w.get(`resizeBase(${b})`);
            if (dry.lost.colorsCount !== r.lost.colorsCount || dry.lost.colorsTotal !== r.lost.colorsTotal || dry.kept.colors !== r.kept.colors) dryBad++;
            if (r.lost.colorsTotal !== real0 || r.kept.colors + r.lost.colorsCount !== real0) dryBad++;
            if (w.get('JSON.stringify([baseFaceAnchor, baseLastHarmonyType, baseLastSelection, baseDistributionStrategy, baseFacePalette.ruleId, baseFacePalette.idx])') !== kept0) otherBad++;
            const after = faceColors(w, 'baseFaceAssignments');
            // every old face: the new face that contains its scaled interior point; its colour is the old colour unless the trail was lost
            const f = a / b; let cmpFaces = 0, eqFaces = 0;
            before.forEach(of => {
                const m = { x: of.poly.reduce((s, p) => s + p.x, 0) / of.poly.length, y: of.poly.reduce((s, p) => s + p.y, 0) / of.poly.length };
                const own = [m, ...of.poly.map(v => ({ x: m.x + (v.x - m.x) * 0.5, y: m.y + (v.y - m.y) * 0.5 }))];
                const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i].y > pt.y) !== (poly[j].y > pt.y) && pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) c = !c; return c; };
                const pt = own.find(p => inPoly(p, of.poly)); if (!pt) return;
                const q = scaleP(pt, f), nf = after.find(g => inPoly(q, g.poly)); if (!nf) return;
                const gray = /^#(..)\1\1$/i.test(of.color) || /^hsl/.test(of.color);   // the default gray is not a colour assignment: only real colours are compared
                if (gray) return;
                cmpFaces++; if (nf.color === of.color) eqFaces++;
            });
            faces += cmpFaces; equal += eqFaces;
            if (r.lost.colorsCount === 0) { lost0Cases++; if (eqFaces === cmpFaces) carried++; } else lostAny++;
            // the palette override follows its trail
            const oKey1 = w.get('Array.from(baseFacePalette.overrides.keys())[0]');
            if (r.lost.colorsCount === 0 && (oKey1 === undefined || oKey1 === oKey0 || w.get('baseFacePalette.overrides.get(Array.from(baseFacePalette.overrides.keys())[0])') !== 1)) paletteBad++;
        }
        stats[shape] = { cases, lost0Cases, carried, lostAny, faces, equal, dryBad, paletteBad, otherBad };
    }
    const sq = stats.square;
    check(`(5) square (${sq.cases} patterns x size pairs, both lagen, ordnung 2..4): every pattern whose faces all survive is carried face by face (${sq.carried}/${sq.lost0Cases}); the dry run = the real run and changes nothing; palette override re-keyed; anchor, harmony, selection, strategy kept`, sq.cases > 40 && sq.carried === sq.lost0Cases && sq.lost0Cases > 0.9 * sq.cases && sq.dryBad === 0 && sq.paletteBad === 0 && sq.otherBad === 0, J(sq));
    for (const shape of ['triangle', 'hex']) {
        const s = stats[shape];
        const exact = shape === 'triangle';
        check(`(5) ${shape} (${s.cases} patterns): ${exact ? `where no trail is lost the colours are carried face by face (${s.carried}/${s.lost0Cases})` : `${s.equal}/${s.faces} real-coloured faces keep their colour (a tiny face that merges with its neighbour takes the neighbour's; ${s.carried}/${s.lost0Cases} patterns exactly)`}; the dry run = the real run; ${s.lostAny} patterns lose trails (faces merge or vanish: counted, not hidden)`,
            s.cases > 20 && (exact ? s.carried === s.lost0Cases : s.equal >= 0.99 * s.faces) && s.dryBad === 0 && s.paletteBad === 0 && s.otherBad === 0, J(s));
    }
    console.log('INFO  colours: ' + J(stats));
    // layer colours (square): the layer's own store is re-keyed through its own sheet
    const w = W('square'); setup(w, 'square', 3, 1, 3);
    w.set('connections = [[1, 5]];');
    addLayer(w, { shape: 'square', ord: 3, size: 3, connections: [[1, 5], [2, 8], [3, 7]], showFaces: true });
    w.set(`(function () { const layer = additionalLayers[0], sheet = faceSheetOverrideOfLayer(layer), res = computeCellFaces(layer.connections, layer.nodes, null, null, sheet), group = sheetGroupElements(layer.nodes, sheet), trails = computeFaceTrails(res, group);
        layer.faceAssignments = new Map(); applyHarmonyToPattern(${J(S.SEL3 || require(path.join(ROOT, 'tools', 'session', 'fixtures.js')).SEL3)}, layer.faceAssignments, trails.slice(0, Math.max(1, Math.ceil(trails.length / 2))), 'area', undefined); layer.facePalette = newFacePalette(); layer.facePalette.ruleId = 'tetrad'; layer.facePalette.idx = [1, 2]; layer.facePalette.overrides.set(trails[0].key, 1); })()`);
    const tot = w.get("Array.from(additionalLayers[0].faceAssignments.values()).filter(a => a.rule !== 'max-contrast-gray').length");
    const lcol = () => w.get(`(function () { const layer = additionalLayers[0], sheet = faceSheetOverrideOfLayer(layer), res = computeCellFaces(layer.connections, layer.nodes, layer.faceAssignments, null, sheet); const byId = new Map(res.nodes.map(n => [n.id, n])); return res.faces.map(f => ({ poly: f.nodeIds.map(id => ({ x: byId.get(id).x, y: byId.get(id).y })), color: f.color })); })()`);
    const lb = lcol(), rr = w.get('resizeBase(5)'), la = lcol();
    const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i].y > pt.y) !== (poly[j].y > pt.y) && pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) c = !c; return c; };
    let cmp = 0, eq = 0;
    lb.forEach(of => { const m = { x: of.poly.reduce((s, p) => s + p.x, 0) / of.poly.length, y: of.poly.reduce((s, p) => s + p.y, 0) / of.poly.length }; if (!inPoly(m, of.poly)) return; const nf = la.find(g => inPoly(scaleP(m, 3 / 5), g.poly)); if (!nf) return; cmp++; if (nf.color === of.color) eq++; });
    check(`(5) a layer's own colours (${tot} real groups, square, 3 -> 5): re-keyed through the layer's sheet, ${eq}/${cmp} faces keep their colour, the layer's palette override follows, 0 lost`, tot > 0 && cmp > 5 && eq === cmp && rr.lost.colorsCount === 0 && rr.kept.colors >= tot && w.get('additionalLayers[0].facePalette.overrides.size') === 1, `${eq}/${cmp} ${J(rr)}`);
    // the default gray is not counted and is filled in again; a store with only gray has nothing to lose
    setup(w, 'square', 3, 1, 3); w.set('connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 3); computeCellFaces(connections, nodes, baseFaceAssignments);');
    const grayN = w.get('baseFaceAssignments.size'), rg = w.get('resizeBase(7)');
    w.set('computeCellFaces(connections, nodes, baseFaceAssignments);');
    check('(5) the default gray: written for every trail (' + grayN + ' entries), not counted as a colour (0 groups), moves with its trail (the same number of entries at the new size)', grayN > 0 && rg.lost.colorsTotal === 0 && rg.lost.colorsCount === 0 && rg.kept.colors === 0 && w.get('baseFaceAssignments.size') === grayN, J(rg));
}

// ---- 6. the handler on fakes ------------------------------------------------------------------------------------------------------------------------------
{
    const dict = (() => { const src = read('ui-i18n.js'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2], en: k[3] }; return m; })();
    const a0 = SK.indexOf('shapeInput.input(() => {'), b0 = SK.indexOf('// Node count (Number Input)');
    const block = SK.slice(a0, b0).slice(0, SK.slice(a0, b0).lastIndexOf('}'));
    const P5 = ['fill', 'noFill', 'push', 'pop', 'stroke', 'noStroke', 'strokeWeight', 'ellipse', 'line', 'bezier'];
    const mk = (shape, ord, lage, size, setupCode, lang) => {
        const log = { said: [], dialogs: [], calls: [] };
        const t = (key, vars) => { const e = dict[key]; if (!e) return key; return e[lang || 'de'].replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] !== undefined ? vars[k] : '{' + k + '}'); };
        const win = { UI: { t }, say: (k, text, kind) => log.said.push([k, text, kind]), timelineConfirm: o => log.dialogs.push(o) };
        const w = H.makeRenderWorld(shape, 3, size, MODE);
        w.sb.document = { body: {} }; w.sb.window = win; w.sb.UI = win.UI; P5.forEach(f => { if (!w.sb[f]) w.sb[f] = () => { }; });
        ['sizeChangePlan', 'sizeChangeText', 'saySizeChange', 'shapeLossWhat'].forEach(n => w.set(grab(n)));
        const input = { v: String(size), handler: null, value(x) { if (x === undefined) return this.v; this.v = String(x); return this; }, input(f) { this.handler = f; } };
        Object.assign(w.sb, { shapeInput: input, renderLayerTabs() { log.calls.push('tabs'); }, updateOffsetControls() { }, updateTimelineControls() { }, applyTimelineFrame() { log.calls.push('frame'); }, redraw() { log.calls.push('redraw'); } });
        w.set(block);
        setup(w, shape, ord, lage, size);
        if (setupCode) w.set(setupCode);
        return { w, input, log };
    };
    const type = (x, v) => { x.input.v = String(v); x.input.handler(); };
    const colorCode = "connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 4);";
    // square: layers, timeline and colours all carried: no dialog, the notice names them
    let x = mk('square', 3, 1, 3, colorCode);
    addLayer(x.w, { shape: 'square', ord: 3, size: 3, connections: [[1, 5]] });
    x.w.set('timeline = { keyframeLayerIds: [], playbackLayerIndex: null };');
    S.colorBase(x.w.ctx, { type: 'custom' });
    type(x, 5);
    check('(6) square with lines, a layer, a timeline and real colours: no dialog; the notice "Größe 3 -> 5. Linien erhalten. Ebenen, Zeitleiste und Farben angepasst."; the field shows 5; the layer views follow', x.log.dialogs.length === 0 && x.w.get('shapeSizeFactor') === 5 && J(x.log.said) === J([['size-change', 'Größe 3 -> 5. Linien erhalten. Ebenen, Zeitleiste und Farben angepasst.', 'info']]) && x.input.v === '5' && x.log.calls.includes('tabs'), J(x.log.said));
    // hex: colour groups merge: the dialog first, with the real counts
    const hexCode = colorCode;
    let hx = mk('hex', 4, 1, 5, hexCode);
    S.colorBase(hx.w.ctx, { type: 'custom' });
    const dry = hx.w.get('resizeBase(3, { dryRun: true })');
    check('(6) the hexagon of ordnung 4: the dry run of 5 -> 3 loses colour groups (the faces merge at the smaller shape)', dry.lost.colorsCount > 0, J(dry.lost));
    const stB = hx.w.get('JSON.stringify([connections, baseFaceAssignments.size, shapeSizeFactor, nodes.length])');
    type(hx, 3);
    check('(6) the dialog opens first: "Größe ändern?", "Beim Größenwechsel gehen ' + dry.lost.colorsCount + ' von ' + dry.lost.colorsTotal + ' Farbgruppen verloren (Flächen verschmelzen oder entfallen). Das lässt sich nicht rückgängig machen.", "Ändern"; nothing has changed yet',
        hx.log.dialogs.length === 1 && hx.log.dialogs[0].title === 'Größe ändern?' && hx.log.dialogs[0].text === `Beim Größenwechsel gehen ${dry.lost.colorsCount} von ${dry.lost.colorsTotal} Farbgruppen verloren (Flächen verschmelzen oder entfallen). Das lässt sich nicht rückgängig machen.` && hx.log.dialogs[0].confirmLabel === 'Ändern'
        && hx.w.get('JSON.stringify([connections, baseFaceAssignments.size, shapeSizeFactor, nodes.length])') === stB && hx.log.said.length === 0, hx.log.dialogs[0] && hx.log.dialogs[0].text);
    hx.log.dialogs[0].returnFocus();
    check('(6) cancel: nothing changed, the field is back at 5, nothing said', hx.input.v === '5' && hx.w.get('JSON.stringify([connections, baseFaceAssignments.size, shapeSizeFactor, nodes.length])') === stB && hx.log.said.length === 0);
    type(hx, 3); hx.log.dialogs[1].onConfirm();
    const said = hx.log.said[0] && hx.log.said[0][1];
    check('(6) confirm: size 3; the notice names what was kept and what was not: "Größe 5 -> 3. Linien erhalten. Farben angepasst. Nicht erhalten: ' + dry.lost.colorsCount + ' von ' + dry.lost.colorsTotal + ' Farbgruppen."', hx.w.get('shapeSizeFactor') === 3 && said === `Größe 5 -> 3. Linien erhalten. Farben angepasst. Nicht erhalten: ${dry.lost.colorsCount} von ${dry.lost.colorsTotal} Farbgruppen.`, said);
    // gray only: no dialog, no word about colours
    x = mk('square', 3, 1, 3, colorCode + ' computeCellFaces(connections, nodes, baseFaceAssignments);');
    type(x, 5);
    check('(6) default gray only: no dialog, "Größe 3 -> 5. Linien erhalten." (no word about colours)', x.log.dialogs.length === 0 && J(x.log.said) === J([['size-change', 'Größe 3 -> 5. Linien erhalten.', 'info']]), J(x.log.said));
    // Field net
    x = mk('square', 3, 1, 5, "connections = [[1, 5]]; baseNetTransform = { x: { kind: 'trig', w: -1 }, y: 'same', domain: 'field' };");
    type(x, 4);
    check('(6) a Field net and an even new size: said, not removed: "... Feld-Netz gilt bei Größe 4 als Einzel."; the spec stays', x.log.said.length === 1 && x.log.said[0][1] === 'Größe 5 -> 4. Linien erhalten. Feld-Netz gilt bei Größe 4 als Einzel.' && x.w.get("baseNetTransform.domain") === 'field', J(x.log.said));
    x = mk('square', 3, 1, 5, "connections = [[1, 5]]; baseNetTransform = { x: { kind: 'trig', w: -1 }, y: 'same', domain: 'field' };");
    type(x, 7);
    check('(6) a Field net and an odd new size: no hint', x.log.said[0][1] === 'Größe 5 -> 7. Linien erhalten.', J(x.log.said));
    x = mk('square', 3, 1, 3, colorCode, 'en');
    addLayer(x.w, { shape: 'square', ord: 3, size: 3, connections: [[1, 5]] });
    S.colorBase(x.w.ctx, { type: 'custom' });
    type(x, 5);
    check('(6) English notice: "Size 3 -> 5. Lines kept. layers and colors adjusted."', x.log.said[0][1] === 'Size 3 -> 5. Lines kept. layers and colors adjusted.', x.log.said[0] && x.log.said[0][1]);
    check('(6) the new text keys exist in German and English (non-empty, different)', ['size.adj.layers', 'size.adj.timeline', 'size.adj.colors', 'note.size.adjusted', 'note.size.colorsLost', 'note.size.fieldNet', 'size.confirm.text'].every(k => dict[k] && dict[k].de && dict[k].en && dict[k].de !== dict[k].en));
}

// ---- 7. sources ----------------------------------------------------------------------------------------------------------------------------------
{
    check('(7) the layer stepper shows the size rounded (a fraction is possible internally): both writes of #layer-shape-size-input use Math.round', (SK.match(/layerShapeSizeInput\.value\(Math\.round\(layer\.shapeSizeFactor\)\)/g) || []).length === 2 && !/layerShapeSizeInput\.value\(layer\.shapeSizeFactor\)/.test(SK));
    check('(7) the handler asks through a dry run (sizeChangePlan -> resizeBase(..., { dryRun: true })) and only when colour groups are lost', /resizeBase\(target, \{ dryRun: true \}\)/.test(SK) && /plan\.loss\.colors && window\.timelineConfirm/.test(SK)  && !/plan\.loss\.layers \|\| plan\.loss\.timeline\) && window\.timelineConfirm[^\n]*size\.confirm/.test(SK));
    const st = read('core/state.js');
    check('(7) core/state.js: no layer or timeline is cleared by resizeBase (the layers are rebuilt as new objects, the timeline object is kept)', /additionalLayers = keep\.layers\.map/.test(st) && /timeline = keep\.tl;/.test(st) && !/layer\.faceAssignments = new Map\(\)/.test(st));
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
