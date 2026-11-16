// Task 078 (B2): a size or FORMAT change (X, Y) -> (X', Y') of the base carries lines, free points, layers, timeline, alt net and colours along (074/075 at X = Y), the canvas follows W x H.
//   node tools/grid/test-resize-format.js     BASE = the commit before 078 (default 7420aaea); OLD_TREE = that tree already extracted; NO_OLD=1 skips (1)
//   1. X = Y: measure scripts byte-equal to the old tree, the eight protected functions and the protected files unchanged
//   2. 3 shapes x ordnung 1..4 x lage 1/2 x 72 ordered (X,Y) -> (X',Y') pairs (3/3, 3/5, 5/3, 5/7, 7/8, 8/7, 2/6, 1/3, 4/4 ...): grid nodes = the scaled old ones = the rebuilt grid (1e-9 px), ids / lines / redo / free point,
//      layers L' = L * min' / min exactly, offset * f, rotation, canvas = W' x H', the centre moves C1 -> C2 (measured), dry run = real run and changes nothing, invalid sizes throw first
//   3. alt net seed; 4. timeline playback t = 0, .5, 1; 5. colours (square face by face, triangle / hexagon counted); 6. the canvas hook, nodeHit on a W x H canvas, the Field net as Single; 7. sources (CSS, HTML, sketch.js)
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || '7420aaea';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(process.env[f.replace(/\W/g, '_').toUpperCase()] || path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const SK = read('sketch.js'), CSS = read('style.css'), HTML = read('index.html');
const MODE = 'rotation_reflection6', SHAPES = ['triangle', 'square', 'hex'];
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const OTHER = { triangle: 'square', square: 'hex', hex: 'triangle' };
const R3 = Math.sqrt(3);
// the sizes, written independently of core/forms.js
const wantW = (sh, X, Y) => { if (X === Y) return 600; const e = 600 / Math.min(X, Y); return X < Y ? 600 : sh === 'hex' ? X * R3 / 2 * e : X * e; };
const wantH = (sh, X, Y) => { if (X === Y) return 600; const e = 600 / Math.min(X, Y); return Y < X ? 600 : sh === 'triangle' ? Y * R3 / 2 * e : Y * e; };

// ---- 1. old tree ----------------------------------------------------------------------------------------------------------------------------------
let oldDir = process.env.OLD_TREE || null;
if (!oldDir && !process.env.NO_OLD) {
    try { cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' }); oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resize-fmt-old-')); cp.execSync(`git archive ${BASE} | tar -x -C "${oldDir}"`, { cwd: ROOT, stdio: 'ignore' }); } catch (e) { oldDir = null; }
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
    check('(1) core/faces.js, core/tiling.js, core/facecolor.js, core/session*.js, core/export.js, tools/morph/off-path-golden.json unchanged', ['core/faces.js', 'core/tiling.js', 'core/facecolor.js', 'core/session.js', 'core/session-apply.js', 'core/session-store.js', 'core/session-writer.js', 'core/export.js', 'tools/morph/off-path-golden.json'].every(same));
    const PROT = ['applyTimelineFrame', 'applyLayerConnectionsMorphFrame', 'resolveTimelineKeyframeCoords', 'resolveTimelineSegment', 'totalTimelineDurationMs', 'setTimelineProgress', 'toggleTimelinePlayback', 'previewTimelineSegmentMidpoint'];
    const oldSK = fs.readFileSync(path.join(oldDir, 'sketch.js'), 'utf8');
    const grabIn = (src, name) => { const m = src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); return m ? m[0] : null; };
    check('(1) the eight protected functions of sketch.js are byte-equal to the old tree', PROT.every(n => grabIn(SK, n) && grabIn(SK, n) === grabIn(oldSK, n)));
}

// ---- worlds and helpers -----------------------------------------------------------------------------------------------------------------------------
const worlds = {};
const HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; hookCalls = (typeof hookCalls === "number" ? hookCalls : 0) + 1; };';   // what sketch.js does with resizeCanvas
const W = (shape) => { if (!worlds[shape]) { worlds[shape] = H.makeRenderWorld(shape, 3, 3, MODE); worlds[shape].set(HOOK); } return worlds[shape]; };
const setup = (w, shape, ord, lage, X, Y) => w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: ord, lage })}); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = []; redoStack = []; baseNetTransform = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; baseFaceAnchor = null; baseLastHarmonyType = null; baseLastSelection = null; baseDistributionStrategy = null; spatialMorph = { enabled: false, mode: 'linear', angleDeg: 0 }; rebuildGrid(currentShape);`);
const addLayer = (w, o) => w.set(`(function () {
    const layer = { connections: ${J(o.connections || [])}, redoStack: ${J(o.redo || [])}, offsetX: ${o.offsetX || 0}, offsetY: ${o.offsetY || 0}, rotation: ${o.rotation || 0}, shape: ${J(o.shape)}, symmetryMode: ${J(o.mode || MODE)}, enabled: ${o.enabled !== false}, showFaces: ${!!o.showFaces}, shapeSizeFactor: ${o.size} };
    projectLayerGridSpec(layer, ${J({ shape: o.shape, ordnung: o.ord, lage: o.lage || 1 })});
    const grid = layerGridForSpec(outerCorners, centroid, currentShape, shapeSizeFactor, layer.shapeSizeFactor, layer.gridSpec, layer.shape, canvasW, canvasH, gridShortSideArg());
    layer.nodes = grid.nodes; layer.centroid = grid.centroid; layer.outerCorners = grid.outerCorners;
    ${o.free ? `layer.nodes.push({ id: layer.nodes.length + 1, x: ${o.free[0]}, y: ${o.free[1]}, free: true });` : ''}
    ${o.playback ? 'layer.isTimelinePlayback = true;' : ''}
    additionalLayers.push(layer);
})()`);
const canvasOf = (w) => w.get('[canvasW, canvasH]');
// C1 -> C2 and f: p' = C2 + (p - C1) * f
const mapper = (c1, c2, f) => (p) => ({ x: c2[0] / 2 + (p.x - c1[0] / 2) * f, y: c2[1] / 2 + (p.y - c1[1] / 2) * f });
const segKey = (s) => { const r = (v) => Math.round(v * 1000); const a = [r(s.x1), r(s.y1)], b = [r(s.x2), r(s.y2)]; return (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a]).join(';'); };
function mapMatch(oldSegs, newSegs, map, c1, c2) {
    const set = new Set(newSegs.map(segKey)); let n = 0, k = 0;
    for (const s of oldSegs) {
        if (![s.x1, s.x2].every(v => v >= 0 && v <= c1[0]) || ![s.y1, s.y2].every(v => v >= 0 && v <= c1[1])) continue;
        const p = map({ x: s.x1, y: s.y1 }), q = map({ x: s.x2, y: s.y2 }), m = { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
        if (![m.x1, m.x2].every(v => v >= -1e-9 && v <= c2[0] + 1e-9) || ![m.y1, m.y2].every(v => v >= -1e-9 && v <= c2[1] + 1e-9)) continue;
        n++; if (set.has(segKey(m))) k++;
    }
    return { n, k };
}
const layersOf = (w) => JSON.parse(w.get('JSON.stringify(additionalLayers.map(l => ({ size: l.shapeSizeFactor, ox: l.offsetX, oy: l.offsetY, rot: l.rotation, conns: l.connections, redo: l.redoStack, spec: l.gridSpec, nodes: l.nodes, centroid: l.centroid, corners: l.outerCorners, shape: l.shape })))'));
const baseOf = (w) => JSON.parse(w.get('JSON.stringify({ nodes, centroid, outerCorners })'));
const SIZES = [[3, 3], [3, 5], [5, 3], [5, 7], [7, 8], [8, 7], [2, 6], [1, 3], [4, 4]];
const frameWorld = (w) => { w.set('width = canvasW; height = canvasH;'); return w.frame(); };

// ---- 2. geometry, layers, state -------------------------------------------------------------------------------------------------------------------------
{
    let cases = 0, bad = { canvas: 0, base: 0, rebuild: 0, misc: 0, size: 0, layers: 0, rebuildL: 0, offset: 0, dry: 0, center: 0 }, maxRes = 0, moved = 0;
    for (const shape of SHAPES) {
        const w = W(shape), other = OTHER[shape];
        for (const lage of [1, 2]) for (let ord = 1; ord <= 4; ord++) for (const [X1, Y1] of SIZES) for (const [X2, Y2] of SIZES) {
            if (X1 === X2 && Y1 === Y2) continue;
            setup(w, shape, ord, lage, X1, Y1);
            const c1 = canvasOf(w), g0 = baseOf(w), nn = g0.nodes.length;
            w.set(`nodes.push({ id: ${nn + 1}, x: 301.5, y: 288.25, free: true }); connections = [[1, 2], [2, 3]]; redoStack = [[1, 3]];`);
            addLayer(w, { shape, ord, lage, size: 3, offsetX: 30, offsetY: -18, rotation: 17, connections: [[1, 2], [2, 3]], redo: [[1, 3]], free: [301.5, 288.25] });
            addLayer(w, { shape: other, ord: Math.min(ord, 3), lage: 1, size: 2, offsetX: -12, offsetY: 8, rotation: 0, connections: [[1, 2]] });
            const L0 = layersOf(w), min1 = Math.min(X1, Y1), min2 = Math.min(X2, Y2), f = min1 / min2;
            const snapDry = w.get('JSON.stringify([nodes, connections, shapeSizeFactor, shapeSizeFactorX, shapeSizeFactorY, canvasW, canvasH, gridRevision, additionalLayers])');
            const dry = w.get(`resizeBase(${X2}, ${Y2}, { dryRun: true })`);
            if (w.get('JSON.stringify([nodes, connections, shapeSizeFactor, shapeSizeFactorX, shapeSizeFactorY, canvasW, canvasH, gridRevision, additionalLayers])') !== snapDry) bad.dry++;
            const r = w.get(`resizeBase(${X2}, ${Y2})`);
            if (J(dry) !== J(r)) bad.dry++;
            const c2 = canvasOf(w), g1 = baseOf(w), L1 = layersOf(w), map = mapper(c1, c2, f);
            cases++;
            if (c2[0] !== wantW(shape, X2, Y2) || c2[1] !== wantH(shape, X2, Y2) || c1[0] !== wantW(shape, X1, Y1) || c1[1] !== wantH(shape, X1, Y1) || w.get('width') !== c2[0] || w.get('height') !== c2[1]) bad.canvas++;
            if (w.get('[shapeSizeFactor, gridSizeX(), gridSizeY()]').join() !== [min2, X2, Y2].join()) bad.size++;
            // the base: grid nodes = the scaled old ones = the grid rebuilt at the new size
            const n0 = g0.nodes, n1 = g1.nodes.filter(n => !n.free);
            const res = Math.max(...n0.map((n, k) => dist(map(n), n1[k])), ...g0.outerCorners.map((c, k) => dist(map(c), g1.outerCorners[k])));
            maxRes = Math.max(maxRes, res); if (!(res < 1e-9) || n0.length !== n1.length) bad.base++;
            const fresh = JSON.parse(J(w.get(`buildGrid(gridSpec, { sizeFactor: shapeSizeFactor, canvasW, canvasH, shortSide: gridShortSideArg() })`)));
            if (!fresh.nodes.every((n, k) => dist(n, n1[k]) < 1e-9 && n.id === n1[k].id)) bad.rebuild++;
            // lines, redo, free point
            const fr = g1.nodes.find(n => n.free);
            if (w.get('J(connections)'.replace('J', 'JSON.stringify')) !== '[[1,2],[2,3]]' || w.get('JSON.stringify(redoStack)') !== '[[1,3]]' || !fr || fr.id !== nn + 1 || dist(fr, map({ x: 301.5, y: 288.25 })) > 1e-9 || w.get('JSON.stringify(gridSpec)') !== J({ shape, ordnung: ord, lage })) bad.misc++;
            // the centre moves C1 -> C2: the outer corners are centred on it, before and after
            const bb = (oc) => { const xs = oc.map(p => p.x), ys = oc.map(p => p.y); return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }; };
            if (dist(bb(g0.outerCorners), { x: c1[0] / 2, y: c1[1] / 2 }) > 1e-9 || dist(bb(g1.outerCorners), { x: c2[0] / 2, y: c2[1] / 2 }) > 1e-9) bad.center++;
            if (c1[0] !== c2[0] || c1[1] !== c2[1]) moved++;
            // layers
            [3, 2].forEach((Lold, i) => {
                const l0 = L0[i], l1 = L1[i];
                if (l1.size !== (Lold * min2) / min1) bad.size++;
                const a = l0.nodes.filter(n => !n.free), b = l1.nodes.filter(n => !n.free);
                const lr = Math.max(...a.map((n, k) => dist(map(n), b[k])), ...l0.corners.map((c, k) => dist(map(c), l1.corners[k])), dist(map(l0.centroid), l1.centroid));
                if (!(lr < 1e-9) || a.length !== b.length) bad.layers++;
                const reb = JSON.parse(J(w.get(`layerGridForSpec(outerCorners, centroid, currentShape, shapeSizeFactor, ${l1.size}, ${J(l0.spec)}, ${J(l0.shape)}, canvasW, canvasH, gridShortSideArg())`)));
                if (J(reb.nodes) !== J(b) || J(reb.outerCorners) !== J(l1.corners)) bad.rebuildL++;
                if (Math.abs(l1.ox - l0.ox * f) > 1e-12 || Math.abs(l1.oy - l0.oy * f) > 1e-12) bad.offset++;
                if (l1.rot !== l0.rot || J(l1.conns) !== J(l0.conns) || J(l1.redo) !== J(l0.redo) || J(l1.spec) !== J(l0.spec) || l1.shape !== l0.shape) bad.misc++;
            });
            const lf0 = L0[0].nodes.find(n => n.free), lf1 = L1[0].nodes.find(n => n.free);
            if (!lf1 || lf1.id !== lf0.id || dist(lf1, map(lf0)) > 1e-9) bad.misc++;
        }
    }
    check(`(2) ${cases} cases (3 shapes x ordnung 1..4 x lage 1/2 x ${SIZES.length * (SIZES.length - 1)} (X,Y) pairs): the canvas is W' x H' (formula), shapeSizeFactor = min(X', Y'), gridSizeX / Y as asked`, cases === 3 * 2 * 4 * SIZES.length * (SIZES.length - 1) && bad.canvas === 0 && bad.size === 0, J(bad));
    check(`(2) the grid nodes and corners = the scaled old ones about C1 -> C2 (max rest ${maxRes.toExponential(1)} px) = the grid rebuilt at the new size; the outer corners are centred on (W/2, H/2), before and after`, bad.base === 0 && bad.rebuild === 0 && bad.center === 0, J(bad));
    check(`(2) the centre really moves: ${moved} of ${cases} cases change the canvas (C1 != C2)`, moved > cases / 2, moved);
    check('(2) lines, redo stack, gridSpec, base free point (id kept, scaled) unchanged', bad.misc === 0, J(bad));
    check('(2) layers: size L * min\' / min exactly, nodes = scaled old = rebuilt at the new base, offset * f, rotation, lines, redo, spec, free point', bad.layers === 0 && bad.rebuildL === 0 && bad.offset === 0, J(bad));
    check('(2) the dry run changes nothing and reports what the real run reports', bad.dry === 0, J(bad));

    // invalid and equal sizes, the old call shapes
    const w = W('square'); setup(w, 'square', 3, 1, 3, 3); w.set('connections = [[1, 2]];');
    const snap = () => w.get('JSON.stringify([nodes, connections, shapeSizeFactor, shapeSizeFactorX, shapeSizeFactorY, canvasW, canvasH, gridRevision])'), s0 = snap();
    const bads = [[1, 4], [4, 1], [2, 7], [9, 2], [0, 3], [3, 0], [10, 10], [1.5, 1.5], [3, 5.5], [NaN, 3], ['3', 3], [-1, -1]];
    const thrown = bads.map(([x, y]) => { w.sb.__a = x; w.sb.__b = y; try { w.get('resizeBase(__a, __b)'); return false; } catch (e) { return /resizeBase/.test(e.message); } });
    check('(2) ' + bads.length + ' invalid sizes (ratio above 1 : 3, outside 1..9, not integers) throw before anything changes', thrown.every(Boolean) && snap() === s0, thrown.join());
    const same = w.get('resizeBase(3, 3)'), same2 = w.get('resizeBase(3)');
    check('(2) the same size changes nothing (resizeBase(3, 3) and resizeBase(3))', same.changed === false && same2.changed === false && snap() === s0);
    w.get('resizeBase(3, 5)'); const sameF = w.get('resizeBase(3, 5)');
    check('(2) the same FORMAT changes nothing either (3/5 -> 3/5)', sameF.changed === false && J(canvasOf(w)) === J([600, 1000]));
    const r1 = w.get('resizeBase(5, { dryRun: true })');
    check('(2) the old call resizeBase(n, opts) still means a square target (3/5 -> 5 = 5/5, dry run)', r1.changed === true && r1.to === 5 && r1.from === '3/5' && J(canvasOf(w)) === J([600, 1000]));
    w.get('resizeBase(5)');
    check('(2) a square target after a non-square base: 600 x 600, X and Y null (the plain square again)', J(canvasOf(w)) === J([600, 600]) && w.get('[shapeSizeFactorX, shapeSizeFactorY, gridIsSquare()]').join() === ',,true');
    // a legacy canvas (a test world at 1100 x 1100): a square -> square change does not touch it
    setup(w, 'square', 3, 1, 3, 3); w.set('canvasW = 1100; canvasH = 1100; rebuildGrid(currentShape);');
    w.get('resizeBase(5)');
    check('(2) a square base on another canvas (1100 x 1100): a square -> square change leaves the canvas alone', J(canvasOf(w)) === J([1100, 1100]));
    w.set('canvasW = 600; canvasH = 600;');
}

// ---- 3. alt net ----------------------------------------------------------------------------------------------------------------------------------------
{
    const NSIDES = { triangle: 3, square: 4, hex: 6 };
    let cases = 0, badSeed = 0, bad = 0;
    for (const shape of SHAPES) {
        const w = W(shape);
        for (const [[X1, Y1], [X2, Y2]] of [[[3, 3], [3, 5]], [[3, 5], [5, 3]], [[5, 3], [3, 3]], [[4, 4], [2, 6]], [[5, 7], [7, 8]], [[3, 5], [3, 7]]]) {
            setup(w, shape, 2, 1, X1, Y1);
            const c1 = canvasOf(w), P = { x: 220, y: 260 }, Q = { x: 330, y: 250 };
            w.set(`rebuildGridFromConstruction(${J(P)}, ${J(Q)}, ${NSIDES[shape]}, 1);`);
            addLayer(w, { shape, ord: 2, size: 3, offsetX: 10, offsetY: 5, rotation: 9, connections: [[1, 2]] });
            const L0 = layersOf(w), f = Math.min(X1, Y1) / Math.min(X2, Y2);
            w.get(`resizeBase(${X2}, ${Y2})`);
            const c2 = canvasOf(w), map = mapper(c1, c2, f), L1 = layersOf(w), seed = w.get('altNetSeed');
            cases++;
            if (!seed || dist(seed.p, map(P)) > 1e-9 || dist(seed.q, map(Q)) > 1e-9) badSeed++;
            L0.forEach((l0, i) => { const a = l0.nodes.filter(n => !n.free), b = L1[i].nodes.filter(n => !n.free); if (!(Math.max(...a.map((n, k) => dist(map(n), b[k]))) < 1e-7)) bad++; });
        }
    }
    check(`(3) alt net with a layer (${cases} format changes): the seed (p, q) is mapped C1 -> C2 with f and the layer's nodes follow (0 px)`, badSeed === 0 && bad === 0, `${badSeed} ${bad}`);
}

// ---- 4. timeline playback -------------------------------------------------------------------------------------------------------------------------------
{
    let n = 0, k = 0, cases = 0, badTl = 0;
    for (const shape of SHAPES) {
        const w = W(shape);
        for (const [[X1, Y1], [X2, Y2]] of [[[3, 3], [3, 5]], [[3, 5], [5, 3]], [[5, 3], [3, 3]], [[4, 4], [2, 6]], [[5, 7], [7, 8]]]) {
            setup(w, shape, 2, 1, X1, Y1);
            const conns = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 3)');
            w.set(`connections = ${J([conns[2]])};`);
            const k1 = w.addKeyframeLayer([conns[0]]), k2 = w.addKeyframeLayer([conns[1]]);
            addLayer(w, { shape, ord: 2, size: Math.min(X1, Y1), playback: true });
            w.setTimeline([k1, k2], { playbackLayerIndex: 2 });
            w.set('timeline.segmentPairings = [[1, 0]];');
            const frame = (t) => { w.set(`timeline.elapsedMs = ${t * 2000}; applyTimelineFrame();`); return frameWorld(w); };
            const c1 = canvasOf(w), before = [0, 0.5, 1].map(frame), ids0 = w.get('JSON.stringify([timeline.keyframeLayerIds, timeline.playbackLayerIndex, timeline.segmentPairings])');
            w.get(`resizeBase(${X2}, ${Y2})`);
            const c2 = canvasOf(w), map = mapper(c1, c2, Math.min(X1, Y1) / Math.min(X2, Y2));
            const after = [0, 0.5, 1].map(frame);
            cases++;
            if (w.get('JSON.stringify([timeline.keyframeLayerIds, timeline.playbackLayerIndex, timeline.segmentPairings])') !== ids0) badTl++;
            before.forEach((f0, i) => { const m = mapMatch(f0, after[i], map, c1, c2); n += m.n; k += m.k; });
        }
    }
    check(`(4) timeline (two keyframe layers, a playback layer, a pairing), ${cases} format changes: keyframes, playback index and pairing are the same`, badTl === 0, badTl);
    check(`(4) the playback at t = 0, .5, 1 before = after, mapped C1 -> C2: ${k}/${n} segments (100 %)`, n > 300 && k === n, `${k}/${n}`);
}

// ---- 5. colours -----------------------------------------------------------------------------------------------------------------------------------------
{
    const faceColors = (w) => w.get(`(function () { const r = computeCellFaces(connections, nodes, baseFaceAssignments); const byId = new Map(r.nodes.map(n => [n.id, n]));
        return r.faces.map(f => ({ poly: f.nodeIds.map(id => ({ x: byId.get(id).x, y: byId.get(id).y })), color: f.color })); })()`);
    const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i].y > pt.y) !== (poly[j].y > pt.y) && pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) c = !c; return c; };
    const stats = {};
    for (const shape of SHAPES) {
        const w = W(shape); let cases = 0, carried = 0, faces = 0, equal = 0, lost0Cases = 0, lostAny = 0, dryBad = 0, paletteBad = 0;
        for (const lage of [1, 2]) for (const ord of [2, 3]) for (const [[X1, Y1], [X2, Y2]] of [[[3, 3], [3, 5]], [[3, 5], [5, 3]], [[5, 3], [3, 3]], [[2, 6], [4, 4]], [[5, 7], [3, 5]], [[3, 5], [3, 7]], [[4, 4], [7, 8]]]) {
            setup(w, shape, ord, lage, X1, Y1);
            w.set('connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 4);');
            try { S.colorBase(w.ctx, { type: 'custom' }); } catch (e) { continue; }
            const real0 = w.get("Array.from(baseFaceAssignments.values()).filter(a => a.rule !== 'max-contrast-gray').length");
            if (!real0) continue;
            cases++;
            const c1 = canvasOf(w), before = faceColors(w), oKey0 = w.get('Array.from(baseFacePalette.overrides.keys())[0]');
            const dry = w.get(`resizeBase(${X2}, ${Y2}, { dryRun: true })`), r = w.get(`resizeBase(${X2}, ${Y2})`);
            if (dry.lost.colorsCount !== r.lost.colorsCount || dry.lost.colorsTotal !== r.lost.colorsTotal || dry.kept.colors !== r.kept.colors || r.lost.colorsTotal !== real0 || r.kept.colors + r.lost.colorsCount !== real0) dryBad++;
            const c2 = canvasOf(w), map = mapper(c1, c2, Math.min(X1, Y1) / Math.min(X2, Y2)), after = faceColors(w);
            let cmp = 0, eq = 0;
            before.forEach(of => {
                const m = { x: of.poly.reduce((s, p) => s + p.x, 0) / of.poly.length, y: of.poly.reduce((s, p) => s + p.y, 0) / of.poly.length };
                const own = [m, ...of.poly.map(v => ({ x: m.x + (v.x - m.x) * 0.5, y: m.y + (v.y - m.y) * 0.5 }))];
                const pt = own.find(p => inPoly(p, of.poly)); if (!pt) return;
                const nf = after.find(g => inPoly(map(pt), g.poly)); if (!nf) return;
                if (/^#(..)\1\1$/i.test(of.color) || /^hsl/.test(of.color)) return;   // the default gray is not an assignment
                cmp++; if (nf.color === of.color) eq++;
            });
            faces += cmp; equal += eq;
            if (r.lost.colorsCount === 0) { lost0Cases++; if (eq === cmp) carried++; } else lostAny++;
            const oKey1 = w.get('Array.from(baseFacePalette.overrides.keys())[0]');
            if (r.lost.colorsCount === 0 && (oKey1 === undefined || oKey1 === oKey0)) paletteBad++;
        }
        stats[shape] = { cases, lost0Cases, carried, lostAny, faces, equal, dryBad, paletteBad };
    }
    const sq = stats.square;
    check(`(5) square (${sq.cases} patterns x format changes): every pattern whose faces survive is carried face by face (${sq.carried}/${sq.lost0Cases}); dry run = real run; palette override re-keyed`, sq.cases > 20 && sq.carried === sq.lost0Cases && sq.lost0Cases > 0.9 * sq.cases && sq.dryBad === 0 && sq.paletteBad === 0, J(sq));
    for (const shape of ['triangle', 'hex']) {
        const s = stats[shape], exact = shape === 'triangle';
        check(`(5) ${shape} (${s.cases} patterns): ${exact ? `where no trail is lost the colours are carried face by face (${s.carried}/${s.lost0Cases})` : `${s.equal}/${s.faces} real-coloured faces keep their colour`}; ${s.lostAny} patterns lose trails (counted); dry run = real run`,
            s.cases > 10 && (exact ? s.carried === s.lost0Cases : s.equal >= 0.99 * s.faces) && s.dryBad === 0 && s.paletteBad === 0, J(s));
    }
    console.log('INFO  colours: ' + J(stats));
}

// ---- 6. the canvas hook, nodeHit, the Field net -----------------------------------------------------------------------------------------------------------
{
    const w = W('square'); setup(w, 'square', 2, 1, 3, 3); w.set('hookCalls = 0;');
    w.get('resizeBase(3, 5, { dryRun: true })'); const dryCalls = w.get('hookCalls');
    w.get('resizeBase(3, 5)'); const c1 = w.get('hookCalls');
    try { w.get('resizeBase(1, 5)'); } catch (e) { }
    const c2 = w.get('hookCalls'); w.get('resizeBase(3, 5)'); const c3 = w.get('hookCalls');
    w.get('setGridSize(5, 3)'); const c4 = w.get('hookCalls');
    check('(6) the canvas hook (sketch.js: resizeCanvas) runs once per real change: none for a dry run, an invalid size or the same size; setGridSize asks it too', dryCalls === 0 && c1 === 1 && c2 === 1 && c3 === 1 && c4 >= 2, [dryCalls, c1, c2, c3, c4].join());
    // a shape change of a non-square base takes the area of the new shape (the triangle is another height)
    w.get('resizeBase(3, 5)'); const before = w.get('hookCalls');
    w.set("currentShape = 'triangle'; projectGridSpec({ shape: 'triangle', ordnung: 2, lage: 1 }); rebuildGrid(currentShape);");
    check('(6) a shape change of a 3/5 base: the canvas becomes the triangle\'s 600 x ' + wantH('triangle', 3, 5).toFixed(1) + ' and the hook runs', Math.abs(w.get('canvasH') - wantH('triangle', 3, 5)) < 1e-9 && w.get('canvasW') === 600 && w.get('hookCalls') === before + 1, J(canvasOf(w)));
    // nodeHit on a W x H canvas: the scale is the smaller of the two (sabotage: width only)
    const grabFn = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
    const radii = [];
    const sb = { document: { querySelector: () => ({ scrollWidth: 800, scrollHeight: 560 }) }, width: 1000, height: 600, freeEndpointsEnabled: false, hitRadius: (t, s) => { radii.push(s); return 18; }, pickNodeAt: () => null, drawnHitNodes: () => [] };
    require('vm').createContext(sb); require('vm').runInContext(grabFn('nodeHit'), sb); sb.nodeHit(10, 10, 'touch');
    check('(6) nodeHit on a 1000 x 600 canvas shown 800 x 560: the scale is min(0.8, 0.9333) = 0.8 (the smaller axis), not the width alone', radii.length === 1 && Math.abs(radii[0] - 0.8) < 1e-12, radii.join());
    // the Field net: a Single on a non-square base, with the hint
    setup(w, 'square', 2, 1, 3, 3); w.set("baseNetTransform = { domain: 'field' };");
    const rF = w.get('resizeBase(3, 5)');
    check('(6) a Field net of a square base at an odd size is read as Single on a 3/5 base (netSizeFactor NaN), with the hint hints.fieldNet', rF.hints.fieldNet === true && Number.isNaN(w.get('netSizeFactor()')) && w.get("netDomainEffective({ domain: 'field' }, netSizeFactor()).ignored !== null"), J(rF.hints));
    const rF2 = w.get('resizeBase(5)');
    check('(6) and a Field again on the square 5/5 (no hint: a Field before and after)', rF2.hints.fieldNet === false && w.get('netSizeFactor()') === 5);
}

// ---- 7. sources -----------------------------------------------------------------------------------------------------------------------------------------
{
    const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); return m ? m[0] : ''; };
    check('(7) sketch.js: canvasSizeSync() resizes the p5 canvas to canvasW x canvasH, drops the fill buffer and sets --canvas-ratio only for a non-square canvas', /resizeCanvas\(canvasW, canvasH, true\)/.test(grab('canvasSizeSync')) && /crossLayerFillBuffer = null/.test(grab('canvasSizeSync')) && /--canvas-ratio/.test(grab('canvasSizeSync')) && /window\.canvasSizeSync = canvasSizeSync/.test(SK));
    check('(7) sketch.js: the size input still sets X = Y (it calls resizeBase(v) with one number); clientToSketch keeps its two scales', /resizeBase\(v\)/.test(SK) && /const sx = cv\.scrollWidth \/ width \|\| 1, sy = cv\.scrollHeight \/ height \|\| 1/.test(grab('clientToSketch')));
    check('(7) sketch.js: nodeHit takes Math.min of the two scales', /Math\.min\(cv\.scrollWidth \/ width, cv\.scrollHeight \/ height\)/.test(grab('nodeHit')));
    const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    check('(7) style.css: --canvas-w / --canvas-h are derived from --canvas-ratio and the short side --canvas-max (560px), limited by the available width', /--canvas-w:\s*min\(calc\(var\(--canvas-max\) \* max\(1, var\(--canvas-ratio\)\)\), var\(--canvas-avail\)\)/.test(css) && /--canvas-h:\s*calc\(var\(--canvas-w\) \/ var\(--canvas-ratio\)\)/.test(css));
    check('(7) index.html: the canvas container is --canvas-w x --canvas-h', /#canvas-container \{[^}]*width: var\(--canvas-w\);[^}]*height: var\(--canvas-h\);/.test(HTML));
    const panels = ['#face-colors-group', '#timeline-group', '#morph-group', '.timeline-strip'];
    check('(7) style.css: the panels under the canvas keep the fixed width --canvas-size (never the canvas width)', panels.every(p => new RegExp(p.replace(/[.#]/g, '\\$&') + '[^{]*\\{[^}]*width: var\\(--canvas-size\\)').test(css)) && !/(face-colors-group|timeline-group|morph-group|timeline-strip)[^{]*\{[^}]*width: var\(--canvas-w\)/.test(css));
}

console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
