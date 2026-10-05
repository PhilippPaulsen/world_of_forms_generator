/**
 * tools/session/test-session-apply.js
 * Phase 3 autosave, P1b: collectSessionState() and applySessionSnapshot() of core/session-apply.js, against the REAL core/state.js and the
 * REAL buildExportData() in a vm context.
 *
 *   node tools/session/test-session-apply.js
 *   SESSION_APPLY_JS=/path/to/mutated/session-apply.js node tools/session/test-session-apply.js    (sabotage runs)
 *
 * What is proved here:
 *  1. the symmetric round trip: collect -> snapshot -> validate -> plan -> apply (into a context in a DIFFERENT default state) -> collect ->
 *     snapshot is identical, and buildExportData() (which carries the face colours) is identical before and after - on all 258 corpus
 *     patterns and on layered patterns (3 layers + the timeline playback layer, a timeline, a custom Farborgel selection, palette
 *     overrides, free endpoints, an alternative net);
 *  2. the order: when each UI hook runs, the globals already hold the final state; the stored symmetryMode survives a setter that
 *     recomputes it (the catalog-link case);
 *  3. the rollback: a fault injected before EVERY step (and a hook that throws at every hook step, and a store entry that throws on the
 *     n-th setFaceAssignment) leaves every global, every captured reference (identity), every old layer and store, the collected
 *     snapshot and buildExportData() exactly as before; onFailure runs once, BEFORE the rollback, and a throwing onFailure or a throwing
 *     re-sync does not stop it;
 *  4. a differential fuzz: 4000 mutations - whatever validateSession() AND planSessionRestore() accept applies without failing, and what
 *     the globals hold afterwards is exactly the validated snapshot.
 */
const F = require('./fixtures.js');
const { C, makeContext, SEL3, GRAY1, clone, J } = F;

let failures = 0, checks = 0;
function check(name, ok, detail) { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); }
const same = (a, b) => J(a) === J(b);
const CANVAS = 600;
const safe = f => { try { return f(); } catch (e) { return false; } };   // a broken apply must show up as a FAILED check, not as a crashed test run
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.message)); process.exit(1); });
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

// ---- 1. collect ---------------------------------------------------------------------------------------------------------------------
console.log('== 1. collectSessionState() and the captured list ==');
{
    const ctx = world('hex', 3, 5);
    const ui = uiOf(ctx, 'spiegeling', 3);
    const st = ctx.sb.collectSessionState(ui);
    check('it gathers the live globals by REFERENCE (no copies) plus symmetry category and fold from symmetryUi', st.connections === ctx.get('connections') && st.nodes === ctx.get('nodes') && st.additionalLayers === ctx.get('additionalLayers') && st.symmetryCategory === 'spiegeling' && st.symmetryFold === 3);
    check('without a symmetryUi the category and fold are null (the snapshot then derives them from the mode)', (s => s.symmetryCategory === null && s.symmetryFold === null)(ctx.sb.collectSessionState()));
    // every `let` of core/state.js is either captured/written by apply or on the explicit "left alone" list
    const lets = [...F.read('core/state.js').matchAll(/^let\s+(\w+)/gm)].map(m => m[1]);
    const captured = ctx.get('SESSION_APPLY_CAPTURED'), untouched = ctx.get('SESSION_APPLY_UNTOUCHED');
    const unclassified = lets.filter(n => !captured.includes(n) && !untouched.includes(n));
    check('every `let` of core/state.js is classified: captured for the rollback or deliberately left alone (a new global fails here until it is decided)', unclassified.length === 0, unclassified.join(',') || `${lets.length} globals`);
    check('the captured list has no name that state.js does not declare', captured.every(n => lets.includes(n)));
    check('captureSessionGlobals() returns exactly the captured names', same(Object.keys(ctx.sb.captureSessionGlobals()).sort(), [...captured].sort()));
}

// ---- 2. the symmetric round trip: corpus --------------------------------------------------------------------------------------------
console.log('\n== 2. round trip over the 258-pattern corpus ==');
const patterns = C.buildPatterns();
{
    const sources = new Map(), target = world('square', 4, 1, 'none');
    let ok = 0, okExport = 0, stale = 0, bad = [];
    patterns.forEach((p, i) => {
        const key = p.sh.label;
        if (!sources.has(key)) sources.set(key, newCtx());
        const src = sources.get(key);
        populateCorpus(src, p, i);
        const ui = uiOf(src, 'spiegeling', 6);
        const snap1 = snapOf(src, ui), exp1 = exportOf(src);
        const tui = uiOf(target, 'none', 6);
        const hooks = fakeHooks(target, snap1, tui);
        const r = applyInto(target, snap1, hooks);
        stale += hooks.stale;
        if (r.ok) {
            if (safe(() => same(snapOf(target, tui), snap1))) ok++; else bad.push(i + ':snapshot differs');
            if (safe(() => same(exportOf(target), exp1))) okExport++; else bad.push(i + ':export differs');
        } else bad.push(i + ':' + (r.notReady ? 'not ready ' + J(r.notReady.p || r.notReady.v.detail) : r.code + ' ' + r.detail));
    });
    check(`collect -> snapshot -> plan -> apply -> collect -> snapshot is identical for all ${patterns.length} corpus patterns (target started in another shape/size/mode)`, ok === patterns.length, `${ok}/${patterns.length} ${bad.slice(0, 2).join(' | ')}`);
    check('buildExportData() (geometry, faces, face colours, colorSpec, layers) is identical before saving and after restoring, for every pattern', okExport === patterns.length, `${okExport}/${patterns.length}`);
    check('every UI hook ran after the globals were final (no stale call)', stale === 0, stale);
}

// ---- 3. layered scenarios ------------------------------------------------------------------------------------------------------------
console.log('\n== 3. layered scenarios ==');
let LAYERED;
{
    for (const [label, opt] of [['alt-net hex, 3 layers + playback + timeline, custom selection, palette overrides, free endpoints', {}], ['same with a free curve (faces off in the export)', { curveType: { kind: 'free', seed: 123456789, roughness: 1, strength: 25 } }]]) {
        const src = newCtx(); layeredAltNet(src, opt);
        const ui = uiOf(src, 'spiegeling', 6);
        const snap1 = snapOf(src, ui), exp1 = exportOf(src);
        const target = world('square', 4, 1, 'none'), tui = uiOf(target, 'none', 6);
        const hooks = fakeHooks(target, snap1, tui);
        const r = applyInto(target, snap1, hooks);
        check(`${label}: applies`, r.ok === true, r.ok ? '' : J(r).slice(0, 200));
        check('  snapshot -> apply -> snapshot is identical', safe(() => same(snapOf(target, tui), snap1)));
        check('  buildExportData() is identical', safe(() => same(exportOf(target), exp1)));
        check('  hooks ran in order, each after the globals were final', same(hooks.log, ['shapeAndInputs', 'symmetry', 'toggles', 'net', 'layers', 'timeline', 'finish']) && hooks.stale === 0, hooks.log.join(',') + ' stale=' + hooks.stale);
        const t = target.get('timeline');
        check('  the timeline comes back STOPPED at 0 (clocks never restored): playing false, startTime null, elapsedMs 0, netLive false, no currentFrame', safe(() => t.playing === false && t.startTime === null && t.elapsedMs === 0 && t.netLive === false && !('currentFrame' in t)));
        const layers = target.get('additionalLayers');
        check('  the playback layer keeps its flag, the disabled layer stays disabled, _timelineSavedEnabled is back, layers carry no animation / _morph fields', safe(() => layers[3].isTimelinePlayback === true && layers[1].enabled === false && layers[0]._timelineSavedEnabled === true && layers[1]._timelineSavedEnabled === false && layers.every(l => !('animation' in l) && !('_morphNodes' in l))));
        check('  free endpoint nodes are back in nodes (base and layers) with free: true, after the grid nodes', safe(() => target.get('nodes').at(-1).free === true && layers[0].nodes.at(-1).free === true));
        check('  a fresh object everywhere: nothing in the target is the source\'s object', target.get('connections') !== src.get('connections') && target.get('baseFaceAssignments') !== src.get('baseFaceAssignments'));
        if (label.startsWith('alt-net')) LAYERED = { src, snap1, exp1 };
    }
    // the catalog-link case: symmetryMode 'rotation6' on a square while (drehling, 6) resolves to 'rotation3'
    const src = world('square', 3, 5, 'rotation6'); src.run(`connections = [[1, 5]];`);
    const ui = uiOf(src, 'drehling', 6);
    check('premise (measured in the browser): this live state has symmetryMode rotation6 while (drehling, 6) resolves to rotation3', src.get('symmetryMode') === 'rotation6' && src.get(`symmetryModeFor('square', 'drehling', 6)`) === 'rotation3');
    const snap1 = snapOf(src, ui), target = world('hex', 3, 3), tui = uiOf(target, 'spiegeling', 6);
    const r = applyInto(target, snap1, fakeHooks(target, null, tui));
    check('the stored symmetryMode is authoritative: after a setter that recomputes it, symmetryMode is still rotation6', r.ok && target.get('symmetryMode') === 'rotation6' && tui.category() === 'drehling' && tui.fold() === 6, target.get('symmetryMode'));
    // category and fold null in the snapshot (collected without a symmetryUi) are derived from the mode
    const src2 = world('hex', 3, 3, 'rotation_reflection3'); const snapNoUi = snapOf(src2, undefined);
    const t2 = world('square', 3, 3), tui2 = uiOf(t2, 'none', 6); const r2 = applyInto(t2, snapNoUi, fakeHooks(t2, null, tui2));
    check('category / fold missing from the snapshot are derived from the mode (rotation_reflection3 -> spiegeling, 3)', r2.ok && tui2.category() === 'spiegeling' && tui2.fold() === 3, tui2.category() + ',' + tui2.fold());
}

// ---- 4. the rollback sweep -------------------------------------------------------------------------------------------------------------
console.log('\n== 4. rollback: a fault before every step, a throwing hook at every hook step, a throwing store entry ==');
{
    const { snap1 } = LAYERED;
    function freshTarget() {
        const t = world('triangle', 3, 3, 'rotation6');
        t.run(`connections = [[1, 2], [2, 3]]; redoStack = [[1, 3]]; showFaces = true; lineColor = '#123456'; baseLastHarmonyType = '3'; activeLayer = 'base';
            baseFaceAssignments.set('old-key', { hue: 1, w: 0.1, s: 0.1, rule: 'farborgel', params: null, displayColor: [1, 2, 3] });
            baseFaceAnchor = { hueIndex: 2, registerIndex: 1 };
            faceHover = { sheet: 'base', key: 'old-key' }; baseNetAnimation = { from: null, to: null, durationMs: 1000, elapsedMs: 0, playing: false, startTime: null, live: false, t: 0 };`);
        addLayer(t, { shape: 'triangle', order: 3, size: 3, connections: [[1, 2]], free: [3, 4], extra: `layer.faceAssignments = new Map([['lk0', { hue: 2, w: 0.1, s: 0.2, rule: null, params: null, displayColor: null }]]);` });
        t.run(`timeline = { keyframeLayerIds: [0], playbackLayerIndex: null, segmentDurationsMs: [], segmentPairings: [], segmentFlips: [], segmentMembers: [], netStates: [null], netLive: false, elapsedMs: 0, startTime: null, playing: false };
            baseNetTransform = { x: { kind: 'trig', w: 0.3 }, y: 'same', repeat: false };`);
        return t;
    }
    // dry run: the step names
    const dry = freshTarget(); const steps = [];
    applyInto(dry, snap1, fakeHooks(dry, null, uiOf(dry, 'none', 6), { skipCheck: true }), { beforeStep: n => steps.push(n) });
    check('the step list is A:base A:layers A:timeline B:capture B:settings B:grid B:base B:layers B:net and the seven C: hooks', same(steps, ['A:base', 'A:layers', 'A:timeline', 'B:capture', 'B:settings', 'B:grid', 'B:base', 'B:layers', 'B:net', 'C:shapeAndInputs', 'C:symmetry', 'C:toggles', 'C:net', 'C:layers', 'C:timeline', 'C:finish']), steps.join(' '));

    function oneFailure(mode, k) {
        const t = freshTarget(), tui = uiOf(t, 'none', 6);
        // the export first: computing faces lazily writes the gray-fill entries into the store (gray-as-selection), so take the snapshot AFTER it
        const preRefs = t.sb.captureSessionGlobals(), preExport = exportOf(t), preSnap = snapOf(t, tui);
        const oldLayers = preRefs.additionalLayers.slice(), oldLayerStores = oldLayers.map(l => l.faceAssignments);
        const events = [], stepName = steps[k];
        let seen = 0;
        const hooks = fakeHooks(t, null, tui, { skipCheck: true, throwAt: mode === 'hook' ? stepName.slice(2) : undefined, throwOnce: true });
        const opts = {
            onFailure: () => { events.push('onFailure'); const cur = t.sb.captureSessionGlobals(); events.push(cur.currentShape !== preRefs.currentShape ? 'globals-still-new' : 'globals-already-old'); },
            beforeStep: n => { if (mode === 'step' && n === stepName) throw new Error('fault before ' + n); },
        };
        const r = applyInto(t, snap1, hooks, opts);
        const post = t.sb.captureSessionGlobals();
        const identical = Object.keys(preRefs).filter(n => preRefs[n] !== post[n]);
        const out = {
            failed: r.ok === false && r.code === 'apply-failed' && r.rolledBack === true && r.step === stepName,
            noIdentityLoss: identical.length === 0, identical,
            layersAndStores: post.additionalLayers === preRefs.additionalLayers && oldLayers.every((l, i) => post.additionalLayers[i] === l && l.faceAssignments === oldLayerStores[i]),
            snapshot: safe(() => same(snapOf(t, tui), preSnap)), exp: safe(() => same(exportOf(t), preExport)),
            onFailureOnce: events.filter(e => e === 'onFailure').length === 1,
            // the caller's quarantine runs while the NEW globals are still in place whenever any were assigned (B:settings onward)
            // the caller's quarantine runs while the NEW globals are still in place: once B:settings has run (the fault is before a LATER step), currentShape is already the snapshot's
            order: k > steps.indexOf('B:settings') ? events[1] === 'globals-still-new' : true,
            sym: t.get('symmetryMode') === preRefs.symmetryMode && tui.category() === 'none' && tui.fold() === 6,
        };
        out.all = Object.values({ f: out.failed, i: out.noIdentityLoss, l: out.layersAndStores, s: out.snapshot, e: out.exp, o: out.onFailureOnce, r: out.order, y: out.sym }).every(Boolean);
        return { out, r };
    }
    // the same rollback with NO hooks object at all (a headless caller): the globals alone must come back, symmetryMode included
    // (with hooks, the re-sync assigns the old symmetryMode again, which would hide a global restore that forgot it)
    { let okAll = 0, bad = [];
      steps.filter(n => !n.startsWith('C:')).forEach(name => {
          const t = freshTarget(); const pre = t.sb.captureSessionGlobals();
          const r = applyInto(t, snap1, undefined, { beforeStep: n => { if (n === name) throw new Error('fault before ' + n); } });
          const post = t.sb.captureSessionGlobals();
          const diff = Object.keys(pre).filter(k => pre[k] !== post[k]);
          if (r.ok === false && r.step === name && diff.length === 0) okAll++; else bad.push(name + ':' + diff.join(','));
      });
      check('with no hooks at all, a fault before each of the 9 data steps still restores every captured global by identity (symmetryMode, faceHover, baseNetAnimation included)', okAll === 9, bad.join(' ')); }
    const results = { step: [], hook: [] };
    steps.forEach((name, k) => { results.step.push([name, oneFailure('step', k)]); });
    steps.forEach((name, k) => { if (name.startsWith('C:')) results.hook.push([name, oneFailure('hook', k)]); });
    const badStep = results.step.filter(([, x]) => !x.out.all);
    check(`a fault injected before each of the ${steps.length} steps rolls back completely: failure reported with the step name, every captured reference identical (===), old layers and their stores untouched, collected snapshot and buildExportData() unchanged, onFailure exactly once and before the rollback, symmetry UI restored`,
        badStep.length === 0, badStep.map(([n, x]) => n + ' ' + J(x.out)).slice(0, 2).join(' | '));
    const badHook = results.hook.filter(([, x]) => !x.out.all);
    check('a hook that throws (each of the 7 hook steps, first call only) rolls back completely and is re-synced from the old state', badHook.length === 0, badHook.map(([n, x]) => n + ' ' + J(x.out)).slice(0, 2).join(' | '));
    check('...and the failure names the hook step', results.hook.every(([n, x]) => x.r.step === n && /failed/.test(x.r.detail)));
    // the re-sync hooks ran with the OLD state: the last 'symmetry' call carries the old category/fold
    { const t = freshTarget(), tui = uiOf(t, 'none', 6); const hooks = fakeHooks(t, null, tui, { skipCheck: true, throwAt: 'timeline', throwOnce: true });
      applyInto(t, snap1, hooks, {});
      check('the rollback re-sync runs every hook again, from the old state (symmetry back to none/6, hooks listed a second time)', hooks.log.length > 7 && hooks.log.slice(-7).join(',') === 'shapeAndInputs,symmetry,toggles,net,layers,timeline,finish' && tui.category() === 'none'); }
    // a throwing onFailure must not stop the rollback; a throwing re-sync is reported, the globals are still restored
    { const t = freshTarget(), tui = uiOf(t, 'none', 6); const pre = t.sb.captureSessionGlobals();
      let r; try { r = applyInto(t, snap1, fakeHooks(t, null, tui, { skipCheck: true, throwAt: 'layers', throwOnce: true }), { onFailure: () => { throw new Error('quarantine failed'); } }); } catch (e) { r = { ok: 'threw' }; }
      const post = t.sb.captureSessionGlobals();
      check('a throwing onFailure (e.g. quarantine write) does not stop the rollback, and apply does not throw', r.ok === false && Object.keys(pre).every(n => pre[n] === post[n])); }
    { const t = freshTarget(), tui = uiOf(t, 'none', 6); const pre = t.sb.captureSessionGlobals();
      const r = applyInto(t, snap1, fakeHooks(t, null, tui, { skipCheck: true, throwAlways: 'net' }), {});
      const post = t.sb.captureSessionGlobals();
      check('a re-sync that throws again is reported (resyncFailed: true) and the globals are restored anyway', r.ok === false && r.resyncFailed === true && Object.keys(pre).every(n => pre[n] === post[n])); }
    // a store entry that throws in setFaceAssignment, at EVERY entry (base store, layer stores)
    { const total = snap1.base.faceAssignments.length + snap1.layers.reduce((n, l) => n + l.faceAssignments.length, 0);
      let okAll = 0, bad = [];
      for (let n = 1; n <= total; n++) {
          const t = freshTarget(), tui = uiOf(t, 'none', 6);
          t.run(`(function () { const real = setFaceAssignment; let calls = 0; setFaceAssignment = function () { calls++; if (calls === ${n}) throw new Error('entry ${n} refused'); return real.apply(this, arguments); }; })()`);
          const pre = t.sb.captureSessionGlobals(), preSnap = snapOf(t, tui);
          const r = applyInto(t, snap1, fakeHooks(t, null, tui, { skipCheck: true }), {});
          const post = t.sb.captureSessionGlobals();
          if (r.ok === false && r.phase === 'A' && Object.keys(pre).every(x => pre[x] === post[x]) && same(snapOf(t, tui), preSnap)) okAll++; else bad.push(n + ':' + J(r).slice(0, 80));
      }
      check(`a store entry that throws in setFaceAssignment (each of the ${total} entries in turn) fails in phase A and changes nothing at all`, okAll === total, `${okAll}/${total} ${bad.slice(0, 1)}`); }
    // sanity: the sweep is not vacuous - the successful run changes every field the sweep compares
    { const t = freshTarget(), tui = uiOf(t, 'none', 6); const pre = t.sb.captureSessionGlobals();
      const r = applyInto(t, snap1, fakeHooks(t, null, tui, { skipCheck: true }), {});
      const post = t.sb.captureSessionGlobals();
      const unchanged = Object.keys(pre).filter(n => pre[n] === post[n] && typeof pre[n] === 'object' && pre[n] !== null);
      check('(control) a successful apply replaces every object-valued captured global, so the identity checks above can fail', r.ok === true && unchanged.length === 0, unchanged.join(',')); }
}

// ---- 5. differential fuzz: everything accepted applies, and applies exactly -----------------------------------------------------------------
console.log('\n== 5. differential fuzz: validate + plan accepted => apply ok and exact ==');
{
    const { snap1 } = LAYERED;
    const target = world('square', 4, 1, 'none'), tui = uiOf(target, 'none', 6);
    const rand = C.rng(20261007), baseObj = clone(snap1), paths = [];
    baseObj.savedAt = 1;   // snap1 has it stripped for comparisons
    (function walk(o, p) { if (o && typeof o === 'object') for (const k of Object.keys(o)) { paths.push(p.concat([k])); walk(o[k], p.concat([k])); } })(baseObj, []);
    const junk = [null, 'x', '', -1, 0, 1, 2, 24, 25, 1.5, 0.5, 0.9, 1e308, [], {}, true, false, 'nope', 'constructor', '__proto__', 'farborgel', 'isotint', 'tetrad', 'max-contrast-gray', [1, 2, 3], [0, 0], [0], { a: 1 }, 99999, -0.5, 'custom', '3', 'W', 'rings', 'area', 'none', 'hex', 'square', 'triangle', 'rotation6', 'reflection_only', 'rotation3', { x: 5 }, { x: { kind: 'trig' } }, { x: { kind: 'weird', w: 1 } }, { x: { kind: 'trig', w: 'a' } }, { regular: true }, { x: { kind: 'trig', w: 2 }, y: 7 }, { x: { kind: 'uniform', w: 0 }, y: 'same' }, { x: { kind: 'geometric', w: 1e9 }, y: 'same', domain: 'field' }];
    let accepted = 0, planned = 0, applied = 0, exact = 0, notOk = [], inexact = [];
    const preconditions = new Set();
    const N = 4000;
    for (let i = 0; i < N; i++) {
        const o = clone(baseObj), notes = [];
        const nm = 1 + Math.floor(rand() * 3);
        for (let m = 0; m < nm; m++) {
            const p = paths[Math.floor(rand() * paths.length)];
            let t = o; for (let d = 0; d < p.length - 1 && t; d++) t = t[p[d]];
            if (!t || typeof t !== 'object') continue;
            const k = p[p.length - 1], act = Math.floor(rand() * 3);
            if (act === 0) { delete t[k]; notes.push(p.join('/') + ' deleted'); } else { const jv = junk[Math.floor(rand() * junk.length)]; t[k] = jv; notes.push(p.join('/') + ' = ' + J(jv)); }
        }
        const v = target.sb.validateSession(o);
        if (!v.ok) continue;
        accepted++;
        const pl = target.sb.planSessionRestore(v.snapshot, { canvasW: CANVAS, canvasH: CANVAS });
        if (!pl.ok) continue;
        planned++;
        let r;
        try { r = target.sb.applySessionSnapshot(v.snapshot, pl.plan, fakeHooks(target, null, tui, { skipCheck: true }), {}); } catch (e) { r = { ok: false, detail: 'THREW ' + e.message }; }
        if (r.ok !== true) { if (notOk.length < 5) notOk.push((r.step || '') + ' ' + r.detail + ' <= ' + notes.join('; ').slice(0, 150)); continue; }
        applied++;
        const got = snapOf(target, tui);   // before painting: painting lazily writes gray-fill entries into the store
        // post-apply consumers: paint every sheet, and the colour panel's palette, must not throw
        try {
            // the consumers: the symmetry mode must be one the drawing code knows; every sheet paints; the net / timeline readers the draw loop calls; and the whole JSON export
            const modes = target.run('[symmetryMode].concat(additionalLayers.map(l => l.symmetryMode))');
            if (!modes.every(m => target.get('symmetryCategoryFoldFor')(m, 6) !== undefined)) throw new Error('invalid symmetry mode applied: ' + modes.filter(m => target.get('symmetryCategoryFoldFor')(m, 6) === undefined).join(','));
            target.run(`(function () {
                netWarpActive(); netTransformNow(); if (timeline) { timelineNetSummary(); }
                additionalLayers.forEach(l => { if (l.enabled && l.connections.length) computeCellFaces(l.connections.filter(c => c.length === 2), l.nodes, l.faceAssignments || null, null, faceSheetOverrideOfLayer(l)); });
                computeCellFaces(connections.filter(c => c.length === 2), nodes, baseFaceAssignments);
                if (baseFacePalette && baseFacePalette.ruleId) generateHarmonyPalette(baseFacePalette.ruleId, baseFacePalette.idx, 3);
                additionalLayers.forEach(l => { if (l.facePalette && l.facePalette.ruleId) generateHarmonyPalette(l.facePalette.ruleId, l.facePalette.idx, 3); });
            })()`);
            exportOf(target);
        } catch (e) { if (notOk.length < 8) notOk.push('POST-APPLY ' + e.message.slice(0, 90) + ' <= ' + notes.join('; ').slice(0, 150)); preconditions.add(e.message.slice(0, 60)); continue; }
        const want = strip(v.snapshot);
        // a snapshot WITHOUT category / fold gets them derived from its mode when applied (tested above), so only those two fields are allowed to differ then
        if (want.settings.symmetryCategory === null) got.settings.symmetryCategory = null;
        if (want.settings.symmetryFold === null) got.settings.symmetryFold = null;
        // symmetryCategory / symmetryFold are set from the snapshot (or derived); everything else must equal the validated snapshot
        if (same(got, want)) exact++; else if (inexact.length < 3) inexact.push(notes.join('; ').slice(0, 120));
    }
    check(`${N} mutations: nothing the validator AND the plan accept fails to apply (no throw, no {ok:false})`, notOk.length === 0 && applied === planned, `${accepted} validated, ${planned} planned, ${applied} applied${notOk.length ? ' | ' + notOk.join(' || ') : ''}`);
    check('after every apply the globals hold exactly the validated snapshot (collect -> snapshot equals it)', exact === applied, `${exact}/${applied}${inexact.length ? ' | ' + inexact.join(' || ') : ''}`);
    if (preconditions.size) console.log('  new preconditions the consumers revealed:', [...preconditions].join(' | '));
    check('the fuzz is not vacuous', accepted > 200 && planned > 100 && applied === planned, `${accepted}/${planned}/${applied} of ${N}`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
