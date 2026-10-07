/**
 * core/session-apply.js
 * Phase 3 autosave, P1b: collecting the live state into the state-like object core/session.js turns into a snapshot
 * (collectSessionState), and applying a validated, planned snapshot back onto the globals of core/state.js
 * (applySessionSnapshot) - with a rollback that puts every touched global back if anything throws.
 *
 * WHERE THE LINE IS. core/session.js is pure (validate, plan). This file is the first that touches globals. It lives in
 * core/ rather than sketch.js because it only reads and writes the state.js globals - as core/facecolor.js and core/tiling.js
 * already do - which makes it testable headlessly against the real state and the real buildExportData(). Everything bound to
 * a setup() closure (the shape icons, the node/size inputs, window.symmetryUi, the rail toggles, the net panel, the layer tabs,
 * the timeline list) is reached ONLY through the `hooks` object the caller passes (sketch.js builds it from its closures).
 *
 * REPLACE, NOT RESTORE IN PLACE. Every global is assigned a NEW object, never filled in place. Reasons, from the alias search:
 * no reference to these arrays/maps survives a handler (the only bindings are locals inside functions, and the layer-tab and
 * timeline closures are rebuilt by the render calls the restore makes), the code base already replaces them wholesale
 * (rebuildGrid(), clearActiveConnections(), clearActiveRedoStack()), and four caches are keyed on object IDENTITY
 * (_groupElementsCache on nodes arrays, _trailsCache on grid nodes, _faceSnapshots on the store Map, _keyframeFieldCache on the
 * layer) - filling an old array in place would leave them answering for the old geometry. The consequence for the rollback: no
 * copies are needed. Apply never mutates an old object, so putting the old REFERENCES back is a complete undo.
 *
 * THREE PHASES, so a failure never leaves half a state:
 *   A  build: every new object (stores through setFaceAssignment, palettes, layers, timeline) is made aside. May throw; nothing global has changed.
 *   B  assign: capture the rollback (the old references), then plain assignments in a fixed order. Cannot throw by itself.
 *   C  sync the UI through the hooks, in a fixed order. May throw.
 * On a throw in any phase: opts.onFailure(error, info) FIRST (the caller quarantines the snapshot and removes the main key
 * there; an error it throws is swallowed), THEN the globals go back, THEN the UI is re-synced from the old state. If that
 * re-sync throws too, the result says resyncFailed: true and the caller reloads once (the key is gone by then).
 *
 * The stored symmetryMode is AUTHORITATIVE. window.symmetryUi's (category, fold) can legitimately disagree with it (a catalog
 * link with shape=square&symmetryMode=rotation6 leaves symmetryMode 'rotation6' while (drehling, 6) resolves to 'rotation3' -
 * measured), so the setters are called only to bring the UI along and symmetryMode is assigned again afterwards.
 *
 * NEVER written by apply (not part of a snapshot): canvasW / canvasH (the canvas already exists; the plan checks them),
 * svgPathCollector / segmentCollector / activeNetWarp (per-redraw render collectors).
 *
 * Depends on: core/state.js globals, core/facecolor.js setFaceAssignment(), core/session.js. Browser load order: after core/session.js.
 */

// every global apply writes, in the order it writes them (Phase B). test-session-apply.js pins this list against the `let`s of core/state.js.
const SESSION_APPLY_CAPTURED = Object.freeze([
    'currentShape', 'nodeCount', 'shapeSizeFactor', 'symmetryMode', 'curveType', 'lineColor', 'showNodes', 'showFaces', 'freeEndpointsEnabled',
    'nodes', 'centroid', 'outerCorners', 'altNetSeed',
    'connections', 'redoStack', 'baseFaceAssignments', 'baseFacePalette', 'baseFaceAnchor', 'baseLastHarmonyType', 'baseLastSelection', 'baseDistributionStrategy',
    'additionalLayers', 'timeline', 'activeLayer',
    'baseNetTransform', 'baseNetAnimation', 'faceHover',
]);
// the `let`s of core/state.js apply deliberately leaves alone
const SESSION_APPLY_UNTOUCHED = Object.freeze(['canvasW', 'canvasH', 'svgPathCollector', 'segmentCollector', 'activeNetWarp']);

// The live references, by name (NOT copies): enough to undo an apply, and to check by identity that an undo was complete.
function captureSessionGlobals() {
    return {
        currentShape, nodeCount, shapeSizeFactor, symmetryMode, curveType, lineColor, showNodes, showFaces, freeEndpointsEnabled,
        nodes, centroid, outerCorners, altNetSeed,
        connections, redoStack, baseFaceAssignments, baseFacePalette, baseFaceAnchor, baseLastHarmonyType, baseLastSelection, baseDistributionStrategy,
        additionalLayers, timeline, activeLayer,
        baseNetTransform, baseNetAnimation, faceHover,
    };
}
function _restoreSessionGlobals(c) {
    currentShape = c.currentShape; nodeCount = c.nodeCount; shapeSizeFactor = c.shapeSizeFactor; symmetryMode = c.symmetryMode; curveType = c.curveType;
    lineColor = c.lineColor; showNodes = c.showNodes; showFaces = c.showFaces; freeEndpointsEnabled = c.freeEndpointsEnabled;
    nodes = c.nodes; centroid = c.centroid; outerCorners = c.outerCorners; altNetSeed = c.altNetSeed;
    connections = c.connections; redoStack = c.redoStack; baseFaceAssignments = c.baseFaceAssignments; baseFacePalette = c.baseFacePalette;
    baseFaceAnchor = c.baseFaceAnchor; baseLastHarmonyType = c.baseLastHarmonyType; baseLastSelection = c.baseLastSelection; baseDistributionStrategy = c.baseDistributionStrategy;
    additionalLayers = c.additionalLayers; timeline = c.timeline; activeLayer = c.activeLayer;
    baseNetTransform = c.baseNetTransform; baseNetAnimation = c.baseNetAnimation; faceHover = c.faceHover;
}

// The build size of a layer's nodes. A layer animation overwrites layer.shapeSizeFactor frame by frame WITHOUT rebuilding the nodes
// (sketch.js applyLayerAnimationFrame), so while an animation is paused or scrubbed mid-way the field says 3.8 and the nodes are still the
// grid that was built for 5. The snapshot's nodeCheck is the fingerprint of the nodes, planSessionRestore() rebuilds the grid FROM the stored
// size, so the stored size must be the one the nodes were built with. Derived here, only when the layer does not already match:
// candidates in this order - the live field, the animation's start, its end, the integers 1-9 (the size input's range); the first whose
// layerGrid() has the live nodes' fingerprint wins. The arguments are exactly those of sketch.js updateActiveLayerGrid(): the base's live
// outerCorners, centroid, shape and size, the layer's own nodeCount and shape, the canvas. No match -> null (the caller keeps the live
// value; the writer's check() then refuses the snapshot and says why). Never throws.
// SESSION_COLLECT_STATS is for the tests: gridBuilds counts layerGrid() calls, searches counts layers that needed the candidate list.
const SESSION_COLLECT_STATS = { gridBuilds: 0, searches: 0 };
function _layerGridFingerprint(layer, f) {
    SESSION_COLLECT_STATS.gridBuilds++;
    return sessionNodeFingerprint(layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, f, layer.nodeCount, layer.shape, canvasW, canvasH).nodes);
}
function _sameFingerprint(a, b) { return a.count === b.count && a.hash === b.hash; }
// `layer` did not match its live shapeSizeFactor (the first candidate, tried by the caller): try the rest.
function sessionLayerBuildSize(layer) {
    try {
        SESSION_COLLECT_STATS.searches++;
        const want = sessionNodeFingerprint(layer.nodes);
        const tries = [layer.shapeSizeFactor];
        if (layer.animation) tries.push(layer.animation.fromShapeSizeFactor, layer.animation.toShapeSizeFactor);
        for (let k = 1; k <= 9; k++) tries.push(k);
        for (let i = 1; i < tries.length; i++) {
            const f = tries[i];
            if (typeof f !== 'number' || !(f > 0) || !isFinite(f) || tries.indexOf(f) !== i) continue;   // each candidate once, the live one is already known not to match
            if (_sameFingerprint(_layerGridFingerprint(layer, f), want)) return f;
        }
        return null;
    } catch (e) { return null; }
}

// The state-like object core/session.js's buildSessionSnapshot() takes: the live globals plus the symmetry (category, fold) that
// live in setup() closures and are reached through window.symmetryUi ({category(), fold()}, may be undefined headlessly).
// References, not copies - buildSessionSnapshot() copies. With opts.buildSizes (the autosave writer) each layer whose nodes do not match
// its own shapeSizeFactor is replaced by a shallow copy carrying the size its nodes were built with (sessionLayerBuildSize); every other
// layer is the live object, and the live layers are never modified. Without it (the apply path, the tests of the plain state) the
// state is the live one.
function collectSessionState(symmetryUi, opts) {
    let layers = additionalLayers;
    if (opts && opts.buildSizes && Array.isArray(additionalLayers)) {
        layers = additionalLayers.map(l => {
            if (!l || !Array.isArray(l.nodes)) return l;
            let ok;
            try { ok = _sameFingerprint(_layerGridFingerprint(l, l.shapeSizeFactor), sessionNodeFingerprint(l.nodes)); } catch (e) { return l; }
            if (ok) return l;   // the fast path: nothing to derive
            const f = sessionLayerBuildSize(l);
            return f === null ? l : Object.assign({}, l, { shapeSizeFactor: f });
        });
    }
    return {
        currentShape, nodeCount, shapeSizeFactor, canvasW, canvasH, symmetryMode,
        symmetryCategory: symmetryUi && typeof symmetryUi.category === 'function' ? symmetryUi.category() : null,
        symmetryFold: symmetryUi && typeof symmetryUi.fold === 'function' ? symmetryUi.fold() : null,
        curveType, lineColor, showNodes, showFaces, freeEndpointsEnabled, altNetSeed, baseNetTransform,
        connections, redoStack, nodes, baseFaceAssignments, baseFacePalette, baseFaceAnchor, baseLastHarmonyType, baseLastSelection, baseDistributionStrategy,
        additionalLayers: layers, timeline, activeLayer,
    };
}

// ---- Phase A: build every new object aside --------------------------------------------------------------------------------------
function _buildStore(entries) {
    const store = new Map();
    entries.forEach(([key, a]) => setFaceAssignment(store, key, a));   // validates through resolveColor(); throws on an entry the colour system refuses
    return store;
}
function _buildPalette(p) { return p ? { ruleId: p.ruleId, idx: p.idx.slice(), overrides: new Map(p.overrides) } : null; }
// the per-sheet colour fields. A live layer gets these lazily, so they are only set when there is something to set.
function _sheetColorFields(sheet) {
    const out = {};
    if (sheet.faceAssignments.length) out.faceAssignments = _buildStore(sheet.faceAssignments);
    if (sheet.facePalette) out.facePalette = _buildPalette(sheet.facePalette);
    if (sheet.faceAnchor) out.faceAnchor = { hueIndex: sheet.faceAnchor.hueIndex, registerIndex: sheet.faceAnchor.registerIndex };
    if (sheet.lastHarmonyType !== null) out.lastHarmonyType = sheet.lastHarmonyType;
    if (sheet.lastSelection) out.lastSelection = JSON.parse(JSON.stringify(sheet.lastSelection));
    if (sheet.distributionStrategy !== null) out.distributionStrategy = sheet.distributionStrategy;
    return out;
}
function _buildSessionObjects(snap, plan, step) {
    const st = snap.settings, built = {};
    step('A:base');
    built.base = {
        connections: snap.base.connections.map(c => c.slice()), redoStack: snap.base.redoStack.map(c => c.slice()),
        faceAssignments: _buildStore(snap.base.faceAssignments),
        facePalette: _buildPalette(snap.base.facePalette), faceAnchor: snap.base.faceAnchor ? { hueIndex: snap.base.faceAnchor.hueIndex, registerIndex: snap.base.faceAnchor.registerIndex } : null,
        lastHarmonyType: snap.base.lastHarmonyType, lastSelection: snap.base.lastSelection ? JSON.parse(JSON.stringify(snap.base.lastSelection)) : null,
        distributionStrategy: snap.base.distributionStrategy,
        nodes: plan.base.nodes, centroid: plan.base.centroid, outerCorners: plan.base.outerCorners,
    };
    step('A:layers');
    built.layers = snap.layers.map((l, i) => {
        const layer = Object.assign({
            connections: l.connections.map(c => c.slice()), redoStack: l.redoStack.map(c => c.slice()),
            offsetX: l.offsetX, offsetY: l.offsetY, rotation: l.rotation, shape: l.shape, symmetryMode: l.symmetryMode,
            enabled: l.enabled, showFaces: l.showFaces, nodeCount: l.nodeCount, shapeSizeFactor: l.shapeSizeFactor,
            nodes: plan.layers[i].nodes, centroid: plan.layers[i].centroid, outerCorners: plan.layers[i].outerCorners,
        }, _sheetColorFields(l));
        if (l.isTimelinePlayback) layer.isTimelinePlayback = true;
        if (l.timelineSavedEnabled !== null) layer._timelineSavedEnabled = l.timelineSavedEnabled;
        return layer;
    });
    step('A:timeline');
    const t = snap.timeline;
    built.timeline = t ? {
        keyframeLayerIds: t.keyframeLayerIds.slice(), playbackLayerIndex: t.playbackLayerIndex, segmentDurationsMs: t.segmentDurationsMs.slice(),
        segmentPairings: t.segmentPairings.map(p => (p ? p.slice() : null)), segmentFlips: t.segmentFlips.map(p => (p ? p.slice() : null)), segmentMembers: t.segmentMembers.map(p => (p ? p.slice() : null)),
        netStates: t.netStates.map(n => (n ? JSON.parse(JSON.stringify(n)) : null)),
        netLive: false, elapsedMs: 0, startTime: null, playing: false,   // the clocks: never restored, the timeline comes back stopped at 0
    } : null;
    built.curveType = JSON.parse(JSON.stringify(st.curveType));
    built.altNetSeed = st.altNetSeed ? JSON.parse(JSON.stringify(st.altNetSeed)) : null;
    built.netTransform = st.netTransform ? JSON.parse(JSON.stringify(st.netTransform)) : null;
    return built;
}

// ---- Phase C: the UI, through the caller's hooks ---------------------------------------------------------------------------------
// One entry per hook, in the order they run. A hook is optional; a missing one is skipped. The state passed is the stateLike the globals
// already hold (collectSessionState()), so a hook reads what it must show from the arguments or from the globals - both are final by now.
const SESSION_HOOK_STEPS = Object.freeze(['shapeAndInputs', 'symmetry', 'toggles', 'net', 'layers', 'timeline', 'finish']);
function _runSessionHooks(hooks, state, step) {
    if (!hooks) return;
    for (const name of SESSION_HOOK_STEPS) {
        step('C:' + name);
        if (typeof hooks[name] !== 'function') continue;
        if (name === 'symmetry') {
            let cat = state.symmetryCategory, fold = state.symmetryFold;
            if ((cat === null || fold === null) && typeof symmetryCategoryFoldFor === 'function') {
                const d = symmetryCategoryFoldFor(state.symmetryMode, fold === null ? 6 : fold);
                if (d) { if (cat === null) cat = d.category; if (fold === null) fold = d.fold; }
            }
            hooks.symmetry(cat, fold);
            symmetryMode = state.symmetryMode;   // the setters recompute it from (shape, category, fold); the stored/old mode is authoritative
        } else hooks[name](state);
    }
}

// -> { ok: true } | { ok: false, code: 'apply-failed', phase: 'A'|'B'|'C', step, detail, rolledBack: true, resyncFailed: boolean }
// `snapshot` = validateSession().snapshot, `plan` = planSessionRestore().plan for it. Never throws.
// opts.onFailure(error, info): called once, BEFORE the rollback, errors swallowed. opts.beforeStep(name): called before every step
// ('A:base' ... 'B:settings' ... 'C:net' ...) - a test seam (a step that throws there simulates a fault at exactly that point).
function applySessionSnapshot(snapshot, plan, hooks, opts) {
    opts = opts || {};
    let phase = 'A', current = 'start';
    const step = name => { current = name; phase = name.charAt(0); if (typeof opts.beforeStep === 'function') opts.beforeStep(name); };
    let old = null, oldState = null;
    try {
        const built = _buildSessionObjects(snapshot, plan, step);
        step('B:capture');
        old = captureSessionGlobals();
        oldState = collectSessionState(hooks && hooks.symmetryUi);
        const st = snapshot.settings;
        step('B:settings');
        currentShape = st.shape; nodeCount = st.nodeCount; shapeSizeFactor = st.shapeSizeFactor; symmetryMode = st.symmetryMode; curveType = built.curveType;
        lineColor = st.lineColor; showNodes = st.showNodes; showFaces = st.showFaces; freeEndpointsEnabled = st.freeEndpointsEnabled;
        step('B:grid');
        nodes = built.base.nodes; centroid = built.base.centroid; outerCorners = built.base.outerCorners; altNetSeed = built.altNetSeed;
        step('B:base');
        connections = built.base.connections; redoStack = built.base.redoStack; baseFaceAssignments = built.base.faceAssignments; baseFacePalette = built.base.facePalette;
        baseFaceAnchor = built.base.faceAnchor; baseLastHarmonyType = built.base.lastHarmonyType; baseLastSelection = built.base.lastSelection; baseDistributionStrategy = built.base.distributionStrategy;
        step('B:layers');
        additionalLayers = built.layers; timeline = built.timeline; activeLayer = snapshot.activeLayer;
        step('B:net');
        baseNetTransform = built.netTransform; baseNetAnimation = null; faceHover = null;
        // the state the hooks are told to show: the globals as they now are, with the snapshot's own (category, fold) - the live
        // symmetryUi still holds the OLD ones until the 'symmetry' hook sets them
        const shown = collectSessionState();
        shown.symmetryCategory = st.symmetryCategory; shown.symmetryFold = st.symmetryFold;
        _runSessionHooks(hooks, shown, step);
        return { ok: true };
    } catch (e) {
        const detail = (e && e.message) ? e.message : String(e);
        if (typeof opts.onFailure === 'function') { try { opts.onFailure(e, { phase, step: current, detail }); } catch (e2) { /* the caller's own failure must not stop the rollback */ } }
        if (old) _restoreSessionGlobals(old);
        let resyncFailed = false;
        if (old && hooks) { try { _runSessionHooks(hooks, oldState, () => { }); } catch (e3) { resyncFailed = true; } }
        return { ok: false, code: 'apply-failed', phase, step: current, detail, rolledBack: true, resyncFailed };
    }
}
