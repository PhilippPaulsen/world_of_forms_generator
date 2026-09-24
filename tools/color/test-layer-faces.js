/**
 * tools/color/test-layer-faces.js
 * Verification of per-layer face detection (Group D follow-up): a layer's faces
 * are expanded under ITS OWN shape, symmetry mode and mirror axis - the same
 * override parameters core/tiling.js draws the layer with - instead of the base's.
 *
 *   node tools/color/test-layer-faces.js
 *
 *  1. Every shape x symmetry-mode combination: the segments face detection uses
 *     equal, exactly, the segments the REAL drawing code produces for that
 *     layer (arguments captured from the real drawTessellation()), and are closed
 *     under the layer's own symmetry group (so the group used for trail keys is
 *     the true symmetry of the drawn lines). Control: without the override
 *     (= the previous behavior) they diverge for mismatching layers.
 *  2. Regression: a layer whose shape and mode match the base's, and every base
 *     call, gives byte-identical faces with and without the override.
 *  3. The panel's "unavailable" predicate (extracted from sketch.js) agrees with
 *     computeLayerCellFaces() for every case - no rendering of wrong fills.
 *  4. Four sheets with different shapes/modes/rules, 399 interleaved edits: no
 *     cross-sheet contamination, per-sheet reconciliation fires, export of layers
 *     with their own shape/mode is fixed and round-trips.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'tiling', 'faces', 'color', 'facecolor', 'export'];
const load = fromHead => FILES.map(f => fromHead
    ? execSync(`git show HEAD:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString()
    : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const SRC_NEW = load(false);
const SKETCH = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const BUILD = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };
const MODES = ['none', 'reflection_only', 'rotation3', 'rotation6', 'rotation_reflection3', 'rotation_reflection6'];

function makeSandbox(src, shape, mode, order) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), console,
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, lineColor: '#000000', altNetSeed: null,
        currentShape: shape, shapeSizeFactor: 1.3, nodeCount: order, symmetryMode: mode, width: 300, height: 300, showFaces: false,
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, activeLayer: 'base'
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => {
        let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y;
        if (flip180) { x = -x; y = -y; }
        if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; }
        return { x: tileC.x + x, y: tileC.y + y };
    };
    vm.createContext(sb);
    vm.runInContext(src, sb);
    const grid = sb[BUILD[shape]](order, 1.3, 300, 300);
    sb.nodes = grid.nodes; sb.centroid = grid.centroid; sb.outerCorners = grid.outerCorners;
    sb.REF = vm.runInContext('OSTWALD_REFERENCE_SYSTEM', sb);
    return sb;
}
function addLayer(sb, shape, mode, order, extra = {}) {
    const g = sb.layerGrid(sb.outerCorners, sb.centroid, sb.currentShape, sb.shapeSizeFactor, sb.shapeSizeFactor, order, shape, 300, 300);
    const layer = { connections: [], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape, symmetryMode: mode, enabled: true, showFaces: false, nodeCount: order, shapeSizeFactor: sb.shapeSizeFactor, nodes: g.nodes, centroid: g.centroid, outerCorners: g.outerCorners, ...extra };
    sb.additionalLayers.push(layer);
    return layer;
}
const tableOf = (sb, layer) => sb.computeThemeLineOrbits(layer.nodes, layer.centroid, layer.shape, layer.symmetryMode, layer.outerCorners);
const round = v => Math.round(v * 100) + 0;
const segKey = s => [[round(s.x1), round(s.y1)], [round(s.x2), round(s.y2)]].sort((a, b) => a[0] - b[0] || a[1] - b[1]).join('|');
const bag = segs => segs.map(segKey).sort();

// ============================ 1. segments == drawn segments ============================
console.log('== 1. face-detection segments vs the real drawing code (shape x mode matrix) ==');
let combos = 0, mismatchNew = 0, mismatchNoOverride = 0, mismatchExpected = 0, closureBad = 0, groupNull = 0, noDrawnCall = 0, patternsChecked = 0, sameNoOverrideBad = 0;
for (const baseShape of ['triangle', 'square', 'hex']) for (const baseMode of ['rotation_reflection6', 'rotation6']) {
    const sb = makeSandbox(SRC_NEW, baseShape, baseMode, 3);
    for (const layerShape of ['triangle', 'square', 'hex']) for (const layerMode of MODES) {
        combos++;
        sb.additionalLayers = [];
        const layer = addLayer(sb, layerShape, layerMode, 3);
        const tbl = tableOf(sb, layer), N = tbl.orbits.length;
        const pick = [0, Math.floor(N / 2), N - 1].filter((v, i, a) => a.indexOf(v) === i);
        const sets = [[pick[0]], pick.slice(0, 2), pick];
        const differs = layerShape !== baseShape || layerMode !== baseMode;
        for (const ids of sets) {
            patternsChecked++;
            layer.connections = ids.map(i => tbl.orbits[i].pairs[0].slice());
            const ov = sb.faceSheetOverrideOfLayer(layer);
            // the REAL drawing: drawTessellation() with the drawShapeCell() arguments it uses for this layer captured
            const calls = [];
            const origDraw = sb.drawShapeCell;
            sb.drawShapeCell = function (...a) { if (a[3] === layer.nodes) calls.push(a); return origDraw.apply(this, a); };
            sb.showFaces = false; layer.showFaces = false; sb.connections = [];
            sb.svgPathCollector = null; sb.segmentCollector = [];
            sb.drawTessellation();
            sb.segmentCollector = null;
            sb.drawShapeCell = origDraw;
            const atCell = calls.find(a => a[2] === false && Math.hypot(a[1].x - sb.centroid.x, a[1].y - sb.centroid.y) < 1e-6);
            if (!atCell) { noDrawnCall++; continue; }
            sb.segmentCollector = []; origDraw.apply(sb, atCell); const drawn = sb.segmentCollector; sb.segmentCollector = null;
            const used = sb.collectCellSegments(layer.connections, layer.nodes, ov);
            if (!eq(bag(used), bag(drawn))) mismatchNew++;
            const legacy = sb.collectCellSegments(layer.connections, layer.nodes);          // no override = the previous behavior
            if (!eq(bag(legacy), bag(drawn))) { mismatchNoOverride++; if (!differs) sameNoOverrideBad++; }
            else if (differs) mismatchExpected += 0;
            // closed under the layer's OWN group (the keys' group is the true symmetry of the drawn lines)
            const group = sb.sheetGroupElements(layer.nodes, ov);
            if (!group) { groupNull++; continue; }
            const set = new Set(used.map(segKey));
            let bad = 0;
            used.forEach(s => group.ops.forEach(op => {
                const a = op({ x: s.x1, y: s.y1 }, group.centroid), b = op({ x: s.x2, y: s.y2 }, group.centroid);
                if (!set.has(segKey({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }))) bad++;
            }));
            if (bad) closureBad++;
        }
    }
}
check('the real drawTessellation() called drawShapeCell for every layer/combo (captured arguments)', noDrawnCall === 0, `${combos} shape/mode combos, ${patternsChecked} patterns`);
check('with the override, face-detection segments EQUAL the real drawn segments (multiset, 0.01px) in every combo', mismatchNew === 0, `${mismatchNew} mismatches`);
check('control: without the override (previous behavior) they diverge for mismatching layers', mismatchNoOverride > 0, `${mismatchNoOverride} of ${patternsChecked} patterns diverged`);
check('a layer matching the base in shape AND mode needs no override: same segments without it', sameNoOverrideBad === 0);
check('the layer\'s own group builds for every combo (shape mismatch used to throw) and the drawn segments are closed under it', groupNull === 0 && closureBad === 0, `${closureBad} closure violations`);

// ============================ 2. regression: byte-identical when nothing differs ============================
console.log('\n== 2. regression ==');
{
    const OLD = load(true);
    let n = 0, sameLayers = 0, baseBad = 0, layerSameBad = 0, layerDiffChanged = 0, layerDiffTotal = 0;
    for (const [shape, order, mode] of [['triangle', 4, 'rotation_reflection6'], ['square', 3, 'rotation6'], ['hex', 3, 'rotation_reflection6']]) {
        const A = makeSandbox(SRC_NEW, shape, mode, order), B = makeSandbox(OLD, shape, mode, order);
        const tbl = A.computeThemeLineOrbits(A.nodes, A.centroid, shape, mode, A.outerCorners);
        for (let t = 0; t < 12; t++) {
            const ids = [t % tbl.orbits.length, (t * 3 + 1) % tbl.orbits.length, (t * 5 + 2) % tbl.orbits.length].filter((v, i, a) => a.indexOf(v) === i);
            const conns = ids.map(i => tbl.orbits[i].pairs[0]);
            n++;
            if (JSON.stringify(A.computeCellFaces(conns, A.nodes)) !== JSON.stringify(B.computeCellFaces(conns, B.nodes))) baseBad++;   // base call, no override: byte-identical to the previous commit
            // a layer with the SAME shape and mode as the base (own node count): identical with and without the override, and identical to the previous commit
            const la = addLayer(A, shape, mode, order), lb = addLayer(B, shape, mode, order);
            const lt = tableOf(A, la);
            la.connections = lb.connections = ids.map(i => lt.orbits[i % lt.orbits.length].pairs[0].slice());
            const withOv = JSON.stringify(A.computeCellFaces(la.connections, la.nodes, null, null, A.faceSheetOverrideOfLayer(la)));
            const without = JSON.stringify(A.computeCellFaces(la.connections, la.nodes));
            const old = JSON.stringify(B.computeCellFaces(lb.connections, lb.nodes));
            sameLayers++; if (withOv !== without || withOv !== old) layerSameBad++;
            // and its trail keys (so stored assignments stay valid)
            const ga = A.sheetGroupElements(la.nodes, A.faceSheetOverrideOfLayer(la)), gb = B.sheetGroupElements(lb.nodes);
            const ka = A.computeFaceTrailKeys(A.computeCellFaces(la.connections, la.nodes, null, null, A.faceSheetOverrideOfLayer(la)), ga), kb = B.computeFaceTrailKeys(B.computeCellFaces(lb.connections, lb.nodes), gb);
            if (!eq(ka, kb)) layerSameBad++;
            A.additionalLayers = []; B.additionalLayers = [];
        }
    }
    check('base-sheet calls: byte-identical to the previous commit', baseBad === 0, `${n} patterns`);
    check('a layer matching the base in shape and mode: faces AND trail keys identical with/without the override and to the previous commit (stored assignments stay valid)', layerSameBad === 0, `${sameLayers} layers`);
}

// ============================ 3. panel predicate vs computeLayerCellFaces() ============================
console.log('\n== 3. panel "unavailable" predicate vs the render path ==');
{
    const m = SKETCH.match(/function faceFillsUnavailableReason\(\) \{[\s\S]*?\n\}\n/);
    const sb = makeSandbox(SRC_NEW, 'triangle', 'rotation_reflection6', 3);
    vm.runInContext(m[0], sb);
    const variants = [];
    for (const shape of ['triangle', 'square', 'hex']) for (const mode of MODES) for (const size of [1.3, 1.0]) for (const rot of [0, 30]) for (const enabled of [true, false]) variants.push({ shape, mode, size, rot, enabled });
    let disagree = 0, wrongFillsRendered = 0;
    for (const v of variants) {
        sb.additionalLayers = [];
        const layer = addLayer(sb, v.shape, v.mode, 3, { shapeSizeFactor: v.size, rotation: v.rot, enabled: v.enabled, showFaces: true });
        const tbl = tableOf(sb, layer); layer.connections = [tbl.orbits[0].pairs[0].slice(), tbl.orbits[tbl.orbits.length - 1].pairs[0].slice()];
        sb.activeLayer = 0;
        const reasonNull = sb.faceFillsUnavailableReason() === null;
        const map = sb.computeLayerCellFaces();
        const rendered = !!(map && map.has(0));
        if (reasonNull !== rendered) disagree++;
        if (rendered) { // what is rendered must be the layer's own faces
            const own = JSON.stringify(sb.computeCellFaces(layer.connections, layer.nodes, null, null, sb.faceSheetOverrideOfLayer(layer)));
            if (JSON.stringify(map.get(0)) !== own) wrongFillsRendered++;
        }
    }
    check('panel says "available" exactly when computeLayerCellFaces() renders, for shape x mode x size x rotation x enabled', disagree === 0, `${variants.length} layer configurations`);
    check('everything rendered is the layer\'s own face set (no wrong-fill case left)', wrongFillsRendered === 0);
}

// ============================ 4. four sheets, 399 interleaved edits, export ============================
console.log('\n== 4. four sheets with different shapes/modes/rules: independence and export ==');
{
    const build = src => {
        const sb = makeSandbox(src, 'triangle', 'rotation_reflection6', 4);
        addLayer(sb, 'triangle', 'rotation6', 4, { showFaces: true });                // own symmetry mode
        addLayer(sb, 'square', 'rotation_reflection6', 3, { showFaces: true, enabled: false });   // own shape (disabled: not exported)
        addLayer(sb, 'hex', 'rotation3', 3, { showFaces: true });                      // own shape and mode
        return sb;
    };
    const sb = build(SRC_NEW);
    const SHEETS = [
        { name: 'base', rule: 'isotint', idx: [0, 4] }, { name: 0, rule: 'tetrad', idx: [2, 2] },
        { name: 1, rule: 'shadow-series', idx: [5, 3] }, { name: 2, rule: 'isotone', idx: [9, 2] }];
    const sheetOf = s => s.name === 'base' ? { nodes: sb.nodes, table: sb.computeThemeLineOrbits(sb.nodes, sb.centroid, 'triangle', 'rotation_reflection6', sb.outerCorners) } : { nodes: sb.additionalLayers[s.name].nodes, table: tableOf(sb, sb.additionalLayers[s.name]) };
    SHEETS.forEach(s => {
        Object.assign(s, sheetOf(s));
        // an initial pattern with at least 3 trails on this sheet's own grid/group (searched, deterministic)
        const N = s.table.orbits.length, ov = s.name === 'base' ? null : sb.faceSheetOverrideOfLayer(sb.additionalLayers[s.name]);
        const g = s.name === 'base' ? sb.sheetGroupElements(s.nodes) : sb.sheetGroupElements(s.nodes, ov);
        s.ids = null;
        for (let a = 0; a < N && !s.ids; a++) for (let b = a + 1; b < N && !s.ids; b++) for (let c = b + 1; c < N && !s.ids; c++) {
            const conns = [a, b, c].map(i => s.table.orbits[i].pairs[0].slice());
            if (sb.computeFaceTrails(sb.computeCellFaces(conns, s.nodes, null, null, ov), g).length >= 3) s.ids = [a, b, c];
        }
        if (!s.ids) throw new Error('no 3-trail pattern found for sheet ' + s.name);
    });
    const connsOf = s => s.ids.map(i => s.table.orbits[i].pairs[0].slice());
    const setConns = s => { if (s.name === 'base') sb.connections = connsOf(s); else sb.additionalLayers[s.name].connections = connsOf(s); };
    const ovOf = s => sb.faceSheetOverrideFor(s.name);
    const faces = (s, store) => sb.computeCellFaces(connsOf(s), s.nodes, store, null, ovOf(s));
    SHEETS.forEach(setConns);
    const state = {};
    SHEETS.forEach(s => {
        const store = sb.faceAssignmentsFor(s.name), g = sb.sheetGroupElements(s.nodes, ovOf(s));
        const trails = sb.computeFaceTrails(faces(s, null), g), pal = sb.facePaletteFor(s.name);
        pal.ruleId = s.rule; pal.idx = s.idx; sb.applyPaletteToTrails(store, trails, pal);
        faces(s, store);
        state[s.name] = { ref: new Map(store), snap: sb.faceSnapshotFor(store) };
    });
    let seed = 99; const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    let steps = 0, contaminated = 0, selfBad = 0; const fired = {};
    for (let k = 0; k < 399; k++) {
        const s = SHEETS[Math.floor(rand() * SHEETS.length)], N = s.table.orbits.length;
        const o = Math.floor(rand() * N), cur = s.ids;
        const nxt = cur.includes(o) ? (cur.length > 1 ? cur.filter(x => x !== o) : cur) : cur.concat(o).sort((a, b) => a - b);
        if (eq(nxt, cur)) continue;
        s.ids = nxt; setConns(s); steps++;
        const store = sb.faceAssignmentsFor(s.name), g = sb.sheetGroupElements(s.nodes, ovOf(s));
        const snapNew = sb.faceTrailSnapshot(faces(s, null), g), prev = state[s.name].snap;
        if (snapNew.faceCount) {
            const same = prev.keys.size === snapNew.keys.size && [...snapNew.keys].every(x => prev.keys.has(x));
            if (!same) { const out = sb.reconcileFaceAssignments(state[s.name].ref, prev, snapNew); if (out.inherited) fired[s.name] = (fired[s.name] || 0) + 1; }
            state[s.name].snap = snapNew;
        }
        faces(s, store);                                                     // the real path: hook reconciles this sheet's own store
        if (JSON.stringify([...store].sort()) !== JSON.stringify([...state[s.name].ref].sort())) selfBad++;
        for (const t of SHEETS) if (t !== s && JSON.stringify([...sb.faceAssignmentsFor(t.name)].sort()) !== JSON.stringify([...state[t.name].ref].sort())) contaminated++;
    }
    check('399 interleaved edits over base + 3 layers (own mode / own shape / own shape+mode): 0 cross-sheet contamination', contaminated === 0, `${steps} edits`);
    check('each sheet\'s hooked store equals its own reference reconciliation chain, and reconciliation fired on every sheet', selfBad === 0 && SHEETS.every(s => fired[s.name] > 0), JSON.stringify(fired));
    check('four sheets keep four different rules / palettes / stores', new Set(SHEETS.map(s => sb.faceAssignmentsFor(s.name))).size === 4 && eq(SHEETS.map(s => sb.facePaletteFor(s.name).ruleId), ['isotint', 'tetrad', 'shadow-series', 'isotone']));

    // ---- export: fixed for layers with their own shape/mode, and it round-trips ----
    const OLD = load(true), old = build(OLD);
    old.connections = sb.connections.map(c => c.slice());
    old.additionalLayers.forEach((l, i) => { l.connections = sb.additionalLayers[i].connections.map(c => c.slice()); });
    const data = JSON.parse(JSON.stringify((() => { const d = sb.buildExportData(null); return d; })()));
    const dataOld = JSON.parse(JSON.stringify(old.buildExportData(null)));
    // the layers export in enabled order: [layer 0, layer 2]
    const exported = [0, 2];
    let expBad = 0, roundBad = 0, faceRows = 0, oldDiffers = 0, oldSameWhereMatching = 0;
    exported.forEach((li, k) => {
        const s = SHEETS[li + 1], layer = sb.additionalLayers[li];
        const want = JSON.parse(JSON.stringify(sb.computeCellFaces(layer.connections.filter(c => c.length === 2), layer.nodes, layer.faceAssignments || null, null, sb.faceSheetOverrideOfLayer(layer))));
        if (!eq(data.geometry.layers[k].faces, want.faces)) expBad++;                  // exported faces == the layer's own faces
        // vs the previous commit: layer 0 shares the base's shape but has its OWN mode (differs); layer 2 has its own shape+mode (differs)
        if (!eq(dataOld.geometry.layers[k].faces.map(f => f.nodeIds.length), data.geometry.layers[k].faces.map(f => f.nodeIds.length)) || dataOld.geometry.layers[k].faces.length !== data.geometry.layers[k].faces.length) oldDiffers++;
        const fc = data.meta.faceColoring, entry = fc.layers.find(l => l.layerIndex === k);
        if (!entry) { roundBad++; return; }
        data.geometry.layers[k].faces.forEach(f => {
            faceRows++;
            if (!f.colorSpec) return;
            const cs = f.colorSpec;
            if (cs.rule !== s.rule || !entry.assignments.some(e => e.trail === cs.trail && e.rule === s.rule)) roundBad++;
            if (sb.resolveColor(fc.system, { hue: cs.hue, w: cs.w, s: cs.s }).hex !== f.color) roundBad++;
            const g = sb.generateHarmonyPalette(cs.rule, cs.params.idx, cs.params.slots, fc.system)[cs.params.slot];
            if (g.hue !== cs.hue || g.w !== cs.w || g.s !== cs.s) roundBad++;
        });
    });
    check('export: geometry.layers[].faces equal the layer\'s OWN face set (previously expanded under the base\'s mode/shape)', expBad === 0);
    check('control: for these layers the previous commit exported different faces (the defect was real)', oldDiffers > 0, `${oldDiffers} of 2 exported layers differ`);
    check('export round trip with four different rules: colorSpec -> resolveColor() == face.color, rule/params regenerate, entries listed per sheet', roundBad === 0 && faceRows > 0, `${faceRows} layer faces`);
    check('layerIndex is the position in the EXPORTED layers (disabled layers are skipped): exported layer 1 is tab 2 (isotone)',
        eq(data.meta.faceColoring.layers.map(l => [l.layerIndex, [...new Set(l.assignments.map(a => a.rule))].join()]), [[0, 'tetrad'], [1, 'isotone']]) && !JSON.stringify(data.meta.faceColoring).includes('shadow-series'));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
