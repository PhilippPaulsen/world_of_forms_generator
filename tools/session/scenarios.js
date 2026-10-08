/**
 * tools/session/scenarios.js
 * Shared test plumbing for the session tests that need REAL patterns (not a test itself - the glob only runs test-*.js): worlds (vm contexts holding
 * the real core files and core/state.js), the corpus and layered scenarios, snapshot/export helpers, and fake UI hooks. Moved here unchanged from
 * test-session-apply.js so test-session-writer.js uses the same scenarios; fixtures.js stays the lower layer (the vm context itself).
 */
const F = require('./fixtures.js');
const { C, makeContext, SEL3, GRAY1, clone, J } = F;

const same = (a, b) => J(a) === J(b);
const CANVAS = 600;
const safe = f => { try { return f(); } catch (e) { return false; } };   // a broken apply must show up as a FAILED check, not as a crashed test run
const newCtx = () => makeContext({ state: true, export: true });

// ---- worlds and scenarios ------------------------------------------------------------------------------------------------------
function reset(ctx, shape, order, size, mode) {
    ctx.run(`currentShape = ${J(shape)}; nodeCount = ${order}; shapeSizeFactor = ${size}; canvasW = ${CANVAS}; canvasH = ${CANVAS}; symmetryMode = ${J(mode || 'rotation_reflection6')};
        curveType = { kind: 'straight' }; showNodes = true; showFaces = false; freeEndpointsEnabled = false; lineColor = '#000000'; baseNetTransform = null; redoStack = [];
        rebuildGrid(currentShape);`);
    return ctx;
}
function world(shape, order, size, mode) { return reset(newCtx(), shape, order, size, mode); }
function addLayer(ctx, o) {
    ctx.run(`(function () {
        const layer = { connections: ${J(o.connections || [])}, redoStack: [], offsetX: ${o.offsetX || 0}, offsetY: ${o.offsetY || 0}, rotation: ${o.rotation || 0}, shape: ${J(o.shape)},
            symmetryMode: ${J(o.mode || 'rotation_reflection6')}, enabled: ${o.enabled !== false}, showFaces: ${!!o.showFaces}, nodeCount: ${o.order}, shapeSizeFactor: ${o.size} };
        const grid = layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, layer.shapeSizeFactor, layer.nodeCount, layer.shape, canvasW, canvasH);
        layer.nodes = grid.nodes; layer.centroid = grid.centroid; layer.outerCorners = grid.outerCorners;
        ${o.free ? `layer.nodes.push({ id: layer.nodes.length + 1, x: ${o.free[0]}, y: ${o.free[1]}, free: true });` : ''}
        ${o.playback ? 'layer.isTimelinePlayback = true;' : ''}
        ${o.savedEnabled !== undefined ? `layer._timelineSavedEnabled = ${o.savedEnabled};` : ''}
        ${o.extra || ''}
        additionalLayers.push(layer);
    })()`);
}
// gray fill + a partial Farborgel harmony on the BASE sheet, like the app writes them
function colorBase(ctx, o) {
    ctx.run(`(function () {
        const res = computeCellFaces(connections, nodes, null);
        const group = getGroupElementsCached(nodes, centroid, currentShape, symmetryMode, outerCorners);
        const trails = computeFaceTrails(res, group);
        applyHarmonyToPattern(${J(GRAY1)}, baseFaceAssignments, trails, 'cyclic', undefined, { ruleId: 'max-contrast-gray', source: 'maxContrastGray', fillOnly: true });
        applyHarmonyToPattern(${J(SEL3)}, baseFaceAssignments, trails.slice(0, Math.max(1, Math.ceil(trails.length / 2))), ${J(o.strategy || 'area')}, undefined);
        baseFacePalette = newFacePalette(); baseFacePalette.ruleId = 'tetrad'; baseFacePalette.idx = [${o.idx || '2, 1'}]; baseFacePalette.overrides.set(trails[0].key, 1);
        baseFaceAnchor = { hueIndex: ${o.hue || 9}, registerIndex: ${o.reg === undefined ? 12 : o.reg} };
        baseLastHarmonyType = ${J(o.type || 'custom')}; baseLastSelection = ${o.type && o.type !== 'custom' ? 'null' : J(SEL3)}; baseDistributionStrategy = ${J(o.strategy || 'area')};
    })()`);
}
function orbitReps(ctx) { return ctx.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())'); }

// base + 3 layers + playback layer + timeline on an ALTERNATIVE-NET hex base: the heaviest scenario
function layeredAltNet(ctx, o) {
    o = o || {};
    ctx.run(`currentShape = 'hex'; nodeCount = 3; shapeSizeFactor = 3; canvasW = ${CANVAS}; canvasH = ${CANVAS}; symmetryMode = 'rotation_reflection6'; rebuildGridFromConstruction({ x: 120, y: 230 }, { x: 310, y: 260 }, 6, 1);`);
    const reps = orbitReps(ctx);
    ctx.run(`connections = ${J([reps[3], reps[10], reps[20], reps[35]])};`);
    ctx.run(`nodes.push({ id: nodes.length + 1, x: 41.25, y: 99.5, free: true }); connections.push([1, nodes.length]); redoStack = [[2, 3]];
        showFaces = true; showNodes = false; freeEndpointsEnabled = true; lineColor = '#112233';
        baseNetTransform = { x: { kind: 'trig', w: -0.4 }, y: 'same', repeat: false };`);
    colorBase(ctx, {});
    const lr = (i) => [reps[i], reps[i + 2]];
    addLayer(ctx, { shape: 'square', order: 3, size: 3, offsetX: 30, offsetY: -30, rotation: 17, free: [14.5, 99.25], showFaces: true, connections: [[1, 2], [2, 3]], savedEnabled: true,
        extra: `layer.faceAssignments = new Map([['lk', { hue: 3, w: 0.2, s: 0.3, rule: 'farborgel', params: { source: 'farborgel', memberIndex: 1, cardinality: 3, strategy: 'cyclic' }, displayColor: [10, 20, 30] }]]);
                layer.facePalette = { ruleId: 'isotint', idx: [1, 2], overrides: new Map([['lk', 2]]) }; layer.faceAnchor = { hueIndex: 4, registerIndex: null };
                layer.lastHarmonyType = 'custom'; layer.lastSelection = ${J(SEL3)}; layer.distributionStrategy = 'rings';` });
    addLayer(ctx, { shape: 'triangle', order: 3, size: 3, mode: 'rotation6', connections: [[1, 2]], savedEnabled: false, enabled: false });
    addLayer(ctx, { shape: 'hex', order: 2, size: 3, mode: 'none', offsetX: -40, rotation: 90, free: [5, 6] });
    addLayer(ctx, { shape: 'hex', order: 3, size: 3, playback: true });
    ctx.run(`curveType = ${J(o.curveType || { kind: 'straight' })};`);   // after colorBase(): a non-straight curve has no faces to colour
    ctx.run(`timeline = { keyframeLayerIds: [0, 1, 2], playbackLayerIndex: 3, segmentDurationsMs: [2000, 3500], segmentPairings: [null, [1, 0]], segmentFlips: [[true, false], null],
        segmentMembers: [null, [0, 2]], netStates: [null, { regular: true }, { x: { kind: 'trig', w: -0.4 }, y: 'same' }], netLive: true, elapsedMs: 777, startTime: 12345, playing: true,
        currentFrame: { segmentIndex: 1, localT: 0.5 } }; activeLayer = 2;`);
}
function populateCorpus(ctx, pattern, variant) {
    reset(ctx, pattern.sh.shape, pattern.sh.order, 3, pattern.sh.mode);
    const reps = orbitReps(ctx);
    ctx.run(`connections = ${J(pattern.ids.map(i => reps[i]))}; showFaces = true;`);
    colorBase(ctx, { strategy: ['cyclic', 'area'][variant % 2], idx: `${variant % 5}, 0`, hue: 1 + variant % 24, reg: variant % 28, type: ['custom', '2', '3', '4', 'B', 'W', 'S', 'V'][variant % 8] });
}

// ---- helpers over contexts -----------------------------------------------------------------------------------------------------
function firstDiff(a, b, p) { p = p || ''; if (J(a) === J(b)) return null; if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], p + '/' + k); if (d) return d; } } return p + ': ' + String(J(a)).slice(0, 50) + ' vs ' + String(J(b)).slice(0, 50); }
const strip = s => { const c = clone(s); delete c.savedAt; return c; };
function uiOf(ctx, category, fold) { const ui = { category, fold }; return { category: () => ui.category, fold: () => ui.fold, _ui: ui }; }
function snapOf(ctx, ui) { return strip(ctx.sb.buildSessionSnapshot(ctx.sb.collectSessionState(ui), 1)); }
function exportOf(ctx) { const d = ctx.sb.buildExportData(null); delete d.exportedAt; return d; }
function planFor(ctx, snap, live) {
    const o = clone(snap); if (o.savedAt === undefined) o.savedAt = 1;   // the comparison copies have savedAt stripped
    const v = ctx.sb.validateSession(o);
    if (!v.ok) return { v };
    return { v, p: ctx.sb.planSessionRestore(v.snapshot, live || { canvasW: CANVAS, canvasH: CANVAS }) };
}
// fake hooks: record every call with whether the globals were ALREADY final, and mimic the real symmetry setters (which recompute symmetryMode)
function fakeHooks(ctx, expected, ui, o) {
    o = o || {};
    const log = [], h = { log, stale: 0, symmetryUi: ui };
    // symmetryCategory / symmetryFold are what the 'symmetry' hook itself sets, so they are not compared; everything else must already be final
    const noSym = snap => { const c = strip(snap); delete c.settings.symmetryCategory; delete c.settings.symmetryFold; return c; };
    const check = name => { if (expected && !safe(() => same(noSym(ctx.sb.buildSessionSnapshot(ctx.sb.collectSessionState(ui), 1)), noSym(expected)))) h.stale++; };
    for (const name of ctx.get('SESSION_HOOK_STEPS')) {
        h[name] = function (arg) {
            log.push(name);
            if (name === 'symmetry') {
                ui._ui.category = arguments[0]; ui._ui.fold = arguments[1];
                ctx.run(`symmetryMode = symmetryModeFor(currentShape, ${J(arguments[0])}, ${J(arguments[1])});`);   // like updateSymmetryModeControl(): recomputed from the UI state
            } else if (!o.skipCheck) check(name);
            if (o.throwAt === name && (!o.throwOnce || log.filter(x => x === name).length === 1)) throw new Error('hook ' + name + ' failed');
            if (o.throwAlways === name) throw new Error('hook ' + name + ' failed (also on re-sync)');
        };
    }
    return h;
}
function applyInto(target, snap, hooks, opts) {
    const r = planFor(target, snap);
    if (!r.v.ok || !r.p.ok) return { notReady: r };
    return target.sb.applySessionSnapshot(r.v.snapshot, r.p.plan, hooks, opts);
}

module.exports = { same, CANVAS, safe, newCtx, reset, world, addLayer, colorBase, orbitReps, layeredAltNet, populateCorpus, firstDiff, strip, uiOf, snapOf, exportOf, planFor, fakeHooks, applyInto };
