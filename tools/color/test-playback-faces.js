/**
 * tools/color/test-playback-faces.js
 * Verification of face fills for the timeline's PLAYBACK layer (Group D item 4, phase 1):
 * its faces are detected from the morph render substitute (_morphConnections/_morphNodes),
 * so fills match the lines drawn at every frame.
 *
 *   node tools/color/test-playback-faces.js
 *
 *  1. For every shape x mode combination and several morph positions t: the segments face
 *     detection uses EQUAL the segments the real drawTessellation() draws for the playback
 *     layer (drawShapeCell() arguments captured from the real code), and the polygons the real
 *     drawing fills at the base cell EQUAL the detected faces.
 *  2. The toggle: the playback layer shows faces exactly when every keyframe layer has its
 *     face fill on; ordinary layers follow their own toggle.
 *  3. Nothing is written: no assignment store is touched or created with entries, keyframe
 *     stores are unchanged (a geometric key means nothing on per-frame geometry).
 *  4. Ordinary layers: computeLayerCellFaces() is byte-identical to the previous commit.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'tiling', 'faces', 'color', 'facecolor'];
const load = fromHead => FILES.map(f => fromHead
    ? execSync(`git show HEAD:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString()
    : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const SKETCH = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
const grab = name => { const m = SKETCH.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const MORPH_SRC = ['resolveConnectionsToCoords', 'ensureLayerMorphIds', 'applyLayerConnectionsMorphFrame'].map(grab).join('\n');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const BUILD = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };
const round = v => Math.round(v * 100) + 0;
const segKey = s => [[round(s.x1), round(s.y1)], [round(s.x2), round(s.y2)]].sort((a, b) => a[0] - b[0] || a[1] - b[1]).join('|');
const bag = segs => segs.map(segKey).sort();

function makeSandbox(src, baseShape, baseMode, order) {
    const drawnPolys = [];
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        // p5 drawing stubs that RECORD the filled polygons (fill color + vertices), so the real drawing can be inspected
        line: () => { }, bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, noFill: () => { }, stroke: () => { }, CLOSE: 'close',
        fill: c => { sb._fill = c; }, beginShape: () => { sb._cur = []; }, vertex: (x, y) => { sb._cur.push({ x, y }); },
        endShape: () => { drawnPolys.push({ fill: sb._fill, pts: sb._cur }); sb._cur = null; },
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, lineColor: '#000', altNetSeed: null,
        currentShape: baseShape, shapeSizeFactor: 1.3, nodeCount: order, symmetryMode: baseMode, width: 300, height: 300, showFaces: false,
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, activeLayer: 'base', timeline: null, drawnPolys
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => {
        let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y;
        if (flip180) { x = -x; y = -y; }
        if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; }
        return { x: tileC.x + x, y: tileC.y + y };
    };
    vm.createContext(sb);
    vm.runInContext(src + '\n' + MORPH_SRC, sb);
    const grid = sb[BUILD[baseShape]](order, 1.3, 300, 300);
    sb.nodes = grid.nodes; sb.centroid = grid.centroid; sb.outerCorners = grid.outerCorners;
    return sb;
}
function addLayer(sb, shape, mode, order, extra = {}) {
    const g = sb.layerGrid(sb.outerCorners, sb.centroid, sb.currentShape, sb.shapeSizeFactor, sb.shapeSizeFactor, order, shape, 300, 300);
    const layer = { connections: [], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape, symmetryMode: mode, enabled: true, showFaces: false, nodeCount: order, shapeSizeFactor: sb.shapeSizeFactor, nodes: g.nodes, centroid: g.centroid, outerCorners: g.outerCorners, ...extra };
    sb.additionalLayers.push(layer);
    return layer;
}
// a two-keyframe timeline + playback layer, exactly the shape addLayerToTimeline() builds
function setupTimeline(sb, shape, mode, order, idsA, idsB) {
    const A = addLayer(sb, shape, mode, order, { showFaces: true, enabled: false });
    const B = addLayer(sb, shape, mode, order, { showFaces: true, enabled: false });
    const P = addLayer(sb, shape, mode, order, { isTimelinePlayback: true, showFaces: false });
    const tbl = sb.computeThemeLineOrbits(A.nodes, A.centroid, shape, mode, A.outerCorners);
    A.connections = idsA.map(i => tbl.orbits[i % tbl.orbits.length].pairs[0].slice());
    B.connections = idsB.map(i => tbl.orbits[i % tbl.orbits.length].pairs[0].slice());
    sb.timeline = { keyframeLayerIds: [0, 1], playbackLayerIndex: 2, segmentDurationsMs: [2000] };
    return { A, B, P };
}
const setFrame = (sb, layers, t) => sb.applyLayerConnectionsMorphFrame(layers.P, { fromConnections: sb.resolveConnectionsToCoords(layers.A), toConnections: sb.resolveConnectionsToCoords(layers.B) }, t);

// ============ 1. faces == the real drawing, per frame ============
console.log('== 1. playback-layer faces vs the real drawing ==');
{
    const OLDSRC = null;
    let cases = 0, segBad = 0, polyBad = 0, noDrawn = 0, mapMissing = 0, facesTotal = 0, morphOnly = 0;
    const MODES = ['rotation_reflection6', 'rotation6', 'rotation3'];
    for (const baseShape of ['triangle', 'square', 'hex']) for (const shape of ['triangle', 'square', 'hex']) for (const mode of MODES) {
        const sb = makeSandbox(load(false), baseShape, 'rotation_reflection6', 3);
        const L = setupTimeline(sb, shape, mode, 3, [0, 2, 5], [1, 4, 7]);
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            cases++;
            setFrame(sb, L, t);
            const calls = [];
            const origDraw = sb.drawShapeCell;
            sb.drawShapeCell = function (...a) { if (a[3] === L.P._morphNodes && a[0].length === L.P._morphConnections.length) calls.push(a); return origDraw.apply(this, a); };
            sb.drawnPolys.length = 0;
            sb.showFaces = false;
            sb.drawTessellation();
            sb.drawShapeCell = origDraw;
            const atCell = calls.find(a => a[2] === false && Math.hypot(a[1].x - sb.centroid.x, a[1].y - sb.centroid.y) < 1e-6);
            if (!atCell) { noDrawn++; continue; }
            sb.segmentCollector = []; origDraw.apply(sb, atCell); const drawn = sb.segmentCollector; sb.segmentCollector = null;
            const ov = sb.faceSheetOverrideOfLayer(L.P);
            const used = sb.collectCellSegments(L.P._morphConnections, L.P._morphNodes, ov);
            if (!eq(bag(used), bag(drawn))) segBad++;
            // the polygons the real drawing filled at the cell tile == the faces face detection returns
            const map = sb.computeLayerCellFaces();
            if (!map || !map.has(2)) { mapMissing++; continue; }
            const faces = map.get(2);
            facesTotal += faces.faces.length;
            const by = new Map(faces.nodes.map(n => [n.id, n]));
            const want = faces.faces.map(f => f.nodeIds.map(id => by.get(id)).map(n => `${round(n.x)},${round(n.y)}`).join(';') + '|' + f.color);
            const got = sb.drawnPolys.filter(p => p.pts.length).map(p => p.pts.map(v => `${round(v.x)},${round(v.y)}`).join(';') + '|' + p.fill);
            // every detected face is drawn (at the cell tile, possibly among other tiles' copies)
            const gotSet = new Set(got);
            if (!want.every(w => gotSet.has(w))) polyBad++;
            if (eq(faces, sb.computeCellFaces(L.P._morphConnections, L.P._morphNodes, null, null, ov)) === false) polyBad++;
            if (t > 0 && t < 1) morphOnly++;
        }
    }
    check('the real drawTessellation() drew the playback layer from its morph substitute in every case', noDrawn === 0, `${cases} cases (3 base shapes x 3 keyframe shapes x 3 modes x 5 frames)`);
    check('face-detection segments EQUAL the real drawn segments at every frame (multiset, 0.01px)', segBad === 0, `${segBad} mismatches`);
    check('computeLayerCellFaces() returns the playback layer and every detected face is filled by the real drawing, in its default color', mapMissing === 0 && polyBad === 0, `${facesTotal} faces, ${morphOnly} mid-morph cases`);
}

// ============ 2. toggle ============
console.log('\n== 2. toggle ==');
{
    const sb = makeSandbox(load(false), 'triangle', 'rotation_reflection6', 3);
    const L = setupTimeline(sb, 'triangle', 'rotation_reflection6', 3, [0, 2], [1, 3]);
    setFrame(sb, L, 0.5);
    const has = () => { const m = sb.computeLayerCellFaces(); return !!(m && m.has(2)); };
    const r = [];
    r.push(has());                                   // both keyframes on
    L.A.showFaces = false; r.push(has());            // one off
    L.B.showFaces = false; r.push(has());            // both off
    L.A.showFaces = true; L.B.showFaces = true; sb.timeline = null; r.push(has());      // no timeline: a lone playback layer never shows faces
    sb.timeline = { keyframeLayerIds: [0, 1], playbackLayerIndex: 2, segmentDurationsMs: [2000] };
    L.P.enabled = false; r.push(has()); L.P.enabled = true;
    check('playback layer shows faces iff every keyframe layer has face fill on (and it is enabled, and a timeline exists)', eq(r, [true, false, false, false, false]), JSON.stringify(r));
    check('an ordinary layer still follows its own showFaces', (() => { const o = addLayer(sb, 'triangle', 'rotation_reflection6', 3, { showFaces: true }); const m = sb.computeLayerCellFaces(); const on = m && m.has(3); o.showFaces = false; const m2 = sb.computeLayerCellFaces(); return on === false || on === true ? (!(m2 && m2.has(3))) : false; })());
}

// ============ 3. nothing written ============
console.log('\n== 3. no store access ==');
{
    const sb = makeSandbox(load(false), 'triangle', 'rotation_reflection6', 4);
    const L = setupTimeline(sb, 'triangle', 'rotation_reflection6', 4, [0, 4, 5], [1, 3, 7]);
    // color the KEYFRAME layers so their stores are non-empty
    for (const kf of [L.A, L.B]) {
        const st = sb.faceAssignmentsFor(sb.additionalLayers.indexOf(kf));
        const ov = sb.faceSheetOverrideOfLayer(kf), g = sb.sheetGroupElements(kf.nodes, ov);
        const trails = sb.computeFaceTrails(sb.computeCellFaces(kf.connections, kf.nodes, null, null, ov), g);
        sb.applyPaletteToTrails(st, trails, { ruleId: 'tetrad', idx: [0, 2], overrides: new Map() });
    }
    const before = [L.A, L.B].map(k => JSON.stringify([...sb.faceAssignmentsFor(sb.additionalLayers.indexOf(k))]));
    let frames = 0;
    for (let f = 0; f <= 40; f++) { setFrame(sb, L, f / 40); sb.computeLayerCellFaces(); frames++; }
    const after = [L.A, L.B].map(k => JSON.stringify([...sb.faceAssignmentsFor(sb.additionalLayers.indexOf(k))]));
    check('keyframe layers\' stores are byte-identical after 41 playback frames', eq(before, after));
    check('the playback layer\'s store stays empty (nothing written, no snapshot)', sb.faceAssignmentsFor(2).size === 0 && sb.faceSnapshotFor(sb.faceAssignmentsFor(2)) === null, `${frames} frames`);
}

// ============ 4. regression ============
console.log('\n== 4. ordinary layers vs the previous commit ==');
{
    let n = 0, bad = 0;
    for (const [shape, mode] of [['triangle', 'rotation_reflection6'], ['square', 'rotation6'], ['hex', 'rotation3']]) {
        const A = makeSandbox(load(false), shape, mode, 3), B = makeSandbox(load(true), shape, mode, 3);
        for (const [S, tag] of [[A, 'new'], [B, 'old']]) {
            const l = addLayer(S, shape, mode, 3, { showFaces: true });
            const tbl = S.computeThemeLineOrbits(l.nodes, l.centroid, shape, mode, l.outerCorners);
            l.connections = [0, 2, 5].map(i => tbl.orbits[i % tbl.orbits.length].pairs[0].slice());
        }
        n++;
        const ma = A.computeLayerCellFaces(), mb = B.computeLayerCellFaces();
        if (JSON.stringify([...ma]) !== JSON.stringify([...mb])) bad++;
    }
    check('ordinary layers: computeLayerCellFaces() byte-identical to the previous commit', bad === 0, `${n} configs`);
}
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
