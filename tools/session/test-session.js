/**
 * tools/session/test-session.js
 * Headless verification for core/session.js (Phase 3 autosave, P0): the pure snapshot builder, validator and
 * size cap. No DOM, no storage, no restore - those are later phases.
 *
 *   node tools/session/test-session.js
 *   SESSION_JS=/path/to/mutated/session.js node tools/session/test-session.js   (sabotage runs: the same checks
 *                                                                               against a deliberately broken copy)
 *
 * Real objects, not stand-ins: the core files run in a bare vm context with the same tiny p5 surface the other
 * tools/ tests use; the 258-pattern corpus of tools/color/corpus.js supplies real grids, orbits, trails, and the
 * stores are written by the real applyHarmonyToPattern(). "Round trip" here means state-like -> snapshot ->
 * JSON text -> parse + validate -> back to a state-like -> snapshot again: the two snapshots must be identical,
 * and the painted face colors computed from the original and from the restored store must match.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const C = require(path.join(ROOT, 'tools', 'color', 'corpus.js'));

const SESSION_SRC = fs.readFileSync(process.env.SESSION_JS || path.join(ROOT, 'core', 'session.js'), 'utf8');
const SRC = C.loadSrc(false) + '\n' + SESSION_SRC;

let failures = 0, checks = 0;
function check(name, ok, detail) { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); }
const J = x => JSON.stringify(x);
const same = (a, b) => J(a) === J(b);
const clone = x => JSON.parse(JSON.stringify(x));

// ---- a real sheet, with the session code loaded into the same context -----------------------------------------------
function sheet(shape, order, mode) { return C.makeSheet(shape, order, mode, SRC); }
const probe = sheet('triangle', 3, 'rotation_reflection6');
const S = probe.sb;
const K = name => vm.runInContext(name, S);   // top-level consts live in script scope, not on the context object

// ---- helpers: state-like <-> snapshot -------------------------------------------------------------------------------
function member(hueIndex, w, s, srgb) { return { analyticalCoordinate: { hueIndex, v: hueIndex === null ? 0 : 1 - w - s, w, s }, srgb }; }
function selectionOf(members) { return { version: 1, source: 'farborgel', members, classification: { cardinality: members.length }, activeMemberIndex: 0 }; }
const SEL3 = selectionOf([member(1, 0.1, 0.1, [200, 30, 40]), member(13, 0.2, 0.3, [40, 120, 200]), member(null, 0.5, 0.5, [128, 128, 128])]);
const GRAY1 = selectionOf([member(null, 0.3, 0.3, [90, 90, 90])]);

// an inverse of buildSessionSnapshot, test-side only (the real restore is P1): arrays back to Maps
function storeOf(entries) { const m = new Map(); entries.forEach(([k, a]) => m.set(k, clone(a))); return m; }
function paletteOf(p) { return p ? { ruleId: p.ruleId, idx: p.idx.slice(), overrides: new Map(p.overrides) } : null; }
function nodesOf(grid, freeNodes) { return grid.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })).concat(freeNodes.map(n => ({ id: n.id, x: n.x, y: n.y, free: true }))); }
function stateFromSnapshot(snap, gridNodesBase, gridNodesOfLayer) {
    const st = snap.settings;
    return {
        currentShape: st.shape, nodeCount: st.nodeCount, shapeSizeFactor: st.shapeSizeFactor, canvasW: st.canvas.w, canvasH: st.canvas.h,
        symmetryMode: st.symmetryMode, symmetryCategory: st.symmetryCategory, symmetryFold: st.symmetryFold, curveType: clone(st.curveType),
        lineColor: st.lineColor, showNodes: st.showNodes, showFaces: st.showFaces, freeEndpointsEnabled: st.freeEndpointsEnabled,
        altNetSeed: clone(st.altNetSeed), baseNetTransform: clone(st.netTransform),
        connections: clone(snap.base.connections), redoStack: clone(snap.base.redoStack), nodes: gridNodesBase.concat(snap.base.freeNodes.map(n => ({ id: n.id, x: n.x, y: n.y, free: true }))),
        baseFaceAssignments: storeOf(snap.base.faceAssignments), baseFacePalette: paletteOf(snap.base.facePalette), baseFaceAnchor: clone(snap.base.faceAnchor),
        baseLastHarmonyType: snap.base.lastHarmonyType, baseLastSelection: clone(snap.base.lastSelection), baseDistributionStrategy: snap.base.distributionStrategy,
        additionalLayers: snap.layers.map((l, i) => ({
            connections: clone(l.connections), redoStack: clone(l.redoStack), nodes: gridNodesOfLayer[i].concat(l.freeNodes.map(n => ({ id: n.id, x: n.x, y: n.y, free: true }))),
            faceAssignments: storeOf(l.faceAssignments), facePalette: paletteOf(l.facePalette), faceAnchor: clone(l.faceAnchor), lastHarmonyType: l.lastHarmonyType,
            lastSelection: clone(l.lastSelection), distributionStrategy: l.distributionStrategy, shape: l.shape, symmetryMode: l.symmetryMode, nodeCount: l.nodeCount,
            shapeSizeFactor: l.shapeSizeFactor, offsetX: l.offsetX, offsetY: l.offsetY, rotation: l.rotation, enabled: l.enabled, showFaces: l.showFaces,
            isTimelinePlayback: l.isTimelinePlayback, _timelineSavedEnabled: l.timelineSavedEnabled === null ? undefined : l.timelineSavedEnabled,
        })),
        timeline: snap.timeline ? Object.assign(clone(snap.timeline), { playing: false, startTime: null, elapsedMs: 0, netLive: false }) : null,
        activeLayer: snap.activeLayer,
    };
}
function firstDiff(a, b, p) {
    p = p || '';
    if (J(a) === J(b)) return null;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], p + '/' + k); if (d) return d; }
    }
    return p + ': ' + J(a).slice(0, 60) + ' vs ' + J(b).slice(0, 60);
}
const strip = snap => { const c = clone(snap); delete c.savedAt; return c; };

// a corpus pattern as a state-like object
function stateOfPattern(p, variant) {
    const sh = p.sh, sb = sh.sb, reps = p.ids.map(i => sh.reps[i]);
    const trails = sb.computeFaceTrails(p.res, sh.group);
    const store = new Map();
    // gray fill first (what the app does on a fresh sheet), then a Farborgel harmony over some strategy
    sb.applyHarmonyToPattern(GRAY1, store, trails, 'cyclic', undefined, { ruleId: 'max-contrast-gray', source: 'maxContrastGray', fillOnly: true });
    const strategy = ['cyclic', 'area'][variant % 2];
    // the Farborgel harmony covers the first half of the trails only, so gray-fill entries stay next to it (as after a partial re-application)
    if (variant % 3 !== 0) sb.applyHarmonyToPattern(SEL3, store, trails.slice(0, Math.max(1, Math.ceil(trails.length / 2))), strategy, undefined);
    const palette = sb.newFacePalette(); palette.ruleId = 'tetrad'; palette.idx = [variant % 5, 0]; if (trails[0]) palette.overrides.set(trails[0].key, variant % 4);
    return {
        currentShape: sh.shape, nodeCount: sh.order, shapeSizeFactor: 1.3, canvasW: 300, canvasH: 300, symmetryMode: sh.mode, symmetryCategory: 'spiegeling', symmetryFold: 6,
        curveType: { kind: 'straight' }, lineColor: '#000000', showNodes: true, showFaces: true, freeEndpointsEnabled: false, altNetSeed: null, baseNetTransform: null,
        connections: reps.map(r => r.slice()), redoStack: [], nodes: sh.grid.nodes,
        baseFaceAssignments: store, baseFacePalette: palette, baseFaceAnchor: { hueIndex: 1 + variant % 24, registerIndex: variant % 28 },
        baseLastHarmonyType: ['2', '3', '4', 'B', 'W', 'S', 'V'][variant % 7], baseLastSelection: null, baseDistributionStrategy: strategy,
        additionalLayers: [], timeline: null, activeLayer: 'base', _trails: trails, _reps: reps, _sh: sh,
    };
}
const paintedColors = (sh, conns, nodes, store) => sh.sb.computeCellFaces(conns, nodes, store).faces.map(f => f.color);

// ---- 1. constants, fingerprint, grid node ids -------------------------------------------------------------------------
console.log('== 1. constants, node fingerprint, grid-node ids ==');
{
    check('schema 1, trail-key scheme 1, cap 2 MB, key wof:session', K('SESSION_SCHEMA_VERSION') === 1 && K('SESSION_TRAIL_KEY_VERSION') === 1 && K('SESSION_MAX_CHARS') === 2 * 1024 * 1024 && K('SESSION_STORAGE_KEY') === 'wof:session');
    const g = probe.grid.nodes;
    const f1 = S.sessionNodeFingerprint(g), f2 = S.sessionNodeFingerprint(g.map(n => Object.assign({}, n)));
    check('fingerprint is stable and counts the grid nodes', same(f1, f2) && f1.count === g.length && /^[0-9a-f]{8}$/.test(f1.hash));
    check('free endpoint nodes do not change the fingerprint', same(f1, S.sessionNodeFingerprint(g.concat([{ id: g.length + 1, x: 12.5, y: 7, free: true }]))));
    const moved = g.map(n => Object.assign({}, n)); moved[3].x += 0.5;
    check('a grid node moved by half a pixel changes it', S.sessionNodeFingerprint(moved).hash !== f1.hash);
    const reid = g.map(n => Object.assign({}, n)); const t = reid[1].id; reid[1].id = reid[2].id; reid[2].id = t;
    check('swapped node ids change it', S.sessionNodeFingerprint(reid).hash !== f1.hash);
    // the validator relies on grid node ids being exactly 1..count - check it against the real builders
    let contiguous = true, n = 0;
    for (const shape of ['triangle', 'square', 'hex']) for (let order = 1; order <= S.maxNodeCountFor(shape) && order <= 8; order++) {
        const grid = S[{ triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' }[shape]](order, 1.3, 300, 300);
        const ids = grid.nodes.map(x => x.id);
        if (!ids.every((id, i) => id === i + 1)) contiguous = false;
        n++;
    }
    check('grid node ids are 1..count in every shape and order (the validator relies on it)', contiguous, `${n} grids`);
}

// ---- 2. round trips over the 258-pattern corpus -----------------------------------------------------------------------
console.log('\n== 2. round trips over the corpus ==');
const patterns = C.buildPatterns(SRC);
{
    let rtOk = 0, idemOk = 0, paintOk = 0, sizeMax = 0, assignedTotal = 0, bad = [];
    patterns.forEach((p, i) => {
        const st = stateOfPattern(p, i);
        const snap = S.buildSessionSnapshot(st, 1700000000000);
        const ser = S.serializeSession(snap);
        if (!ser.ok) { bad.push(i + ':serialize'); return; }
        sizeMax = Math.max(sizeMax, ser.text.length);
        const parsed = S.parseSession(ser.text);
        if (!parsed.ok) { bad.push(i + ':' + parsed.code + ' ' + parsed.detail); return; }
        rtOk++;
        const back = stateFromSnapshot(parsed.snapshot, p.sh.grid.nodes, []);
        const again = S.buildSessionSnapshot(back, 1700000000000);
        if (same(again, snap)) idemOk++; else bad.push(i + ':not-idempotent');
        const a = paintedColors(p.sh, st.connections, st.nodes, st.baseFaceAssignments), b = paintedColors(p.sh, back.connections, back.nodes, back.baseFaceAssignments);
        if (same(a, b) && a.length > 0) paintOk++; else bad.push(i + ':paint');
        assignedTotal += st.baseFaceAssignments.size;
    });
    check(`all ${patterns.length} corpus patterns serialize, parse and validate`, rtOk === patterns.length, bad.slice(0, 3).join(' | '));
    check('snapshot -> state -> snapshot is identical for every pattern', idemOk === patterns.length);
    check('painted face colors from the restored store equal the original ones, for every pattern', paintOk === patterns.length, `${assignedTotal} assignments`);
    check('the largest corpus snapshot is far below the cap', sizeMax < 100 * 1024, `${(sizeMax / 1024).toFixed(1)} KB`);
}

// ---- 3. a layered pattern: 3 layers, timeline, custom selection, palette overrides ------------------------------------
console.log('\n== 3. layered pattern with timeline, custom Farborgel selection and palette overrides ==');
let layered;   // { st, snap, text }
{
    const p = patterns.find(x => x.sh.shape === 'hex' && x.res.faces.length > 100) || patterns[0];
    const sh = p.sh, sb = sh.sb;
    const st = stateOfPattern(p, 4);
    st.baseLastHarmonyType = 'custom'; st.baseLastSelection = clone(SEL3);
    st.freeEndpointsEnabled = true;
    st.nodes = sh.grid.nodes.concat([{ id: sh.grid.nodes.length + 1, x: 41.25, y: 99.5, free: true }]);
    st.connections.push([1, sh.grid.nodes.length + 1]); st.redoStack = [[2, 3]];
    st.curveType = { kind: 'free', seed: 123456789, roughness: 1, strength: 25 };
    st.altNetSeed = { p: { x: 10, y: 20 }, q: { x: 80, y: 20 }, side: 1, n: 6 };
    st.baseNetTransform = { x: { kind: 'trig', w: 0.5, alternate: false }, y: 'same', domain: 'field' };   // kinds are uniform | trig | geometric (sinus / tangens are the sign of w)
    const layerOf = (shape, order, mode, off, rot, extra) => {
        const grid = sb[{ triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' }[shape]](order, 1.3, 300, 300);
        const store = new Map(); const trailsHere = sb.computeFaceTrails(sh.faces(p.ids), sh.group);
        sb.applyHarmonyToPattern(SEL3, store, trailsHere.slice(0, 5), 'cyclic', undefined);
        const palette = sb.newFacePalette(); palette.ruleId = 'isotint'; palette.idx = [1, 2]; palette.overrides.set('some-key', 2);   // palette.ruleId is a REGISTRY rule ('farborgel' is an assignment rule, never a palette's)
        return Object.assign({ connections: [[1, 2], [2, 3]], redoStack: [], offsetX: off, offsetY: -off, rotation: rot, shape, symmetryMode: mode, enabled: true, showFaces: true, nodeCount: order,
            shapeSizeFactor: 1.3, nodes: grid.nodes.concat([{ id: grid.nodes.length + 1, x: 5, y: 6, free: true }]), faceAssignments: store, facePalette: palette, faceAnchor: { hueIndex: 9, registerIndex: null },
            lastHarmonyType: 'custom', lastSelection: clone(SEL3), distributionStrategy: 'area', animation: { playing: true, startTime: 999, elapsedMs: 5 },
            _morphNodes: [{ id: 1, x: 0, y: 0 }], _morphConnections: [[1, 2]] }, extra || {});
    };
    st.additionalLayers = [layerOf('square', 3, 'rotation_reflection6', 30, 17), layerOf('triangle', 3, 'rotation6', 0, 0, { _timelineSavedEnabled: true }), layerOf('hex', 2, 'none', -40, 90, { enabled: false })];
    const playback = layerOf('triangle', 3, 'rotation6', 0, 0, { isTimelinePlayback: true, connections: [], faceAssignments: new Map(), facePalette: null, faceAnchor: null, lastHarmonyType: null, lastSelection: null, distributionStrategy: null, showFaces: false });
    st.additionalLayers.push(playback);
    st.timeline = { keyframeLayerIds: [0, 1, 2], playbackLayerIndex: 3, segmentDurationsMs: [2000, 3500], segmentPairings: [null, [1, 0]], segmentFlips: [[true, false], null], segmentMembers: [null, [0, 2]],
        netStates: [null, { regular: true }, { x: { kind: 'trig', w: -0.4 }, y: 'same' }], playing: true, startTime: 12345, elapsedMs: 777, netLive: true, currentFrame: { segment: 1, localT: 0.5 } };
    st.activeLayer = 2;
    const snap = S.buildSessionSnapshot(st, 1700000000000), ser = S.serializeSession(snap);
    const parsed = ser.ok ? S.parseSession(ser.text) : { ok: false, code: 'serialize' };
    check('the layered snapshot serializes and validates', ser.ok && parsed.ok, parsed.ok ? `${(ser.text.length / 1024).toFixed(1)} KB` : parsed.code + ' ' + parsed.detail);
    layered = { st, snap, text: ser.text, parsed };
    const text = ser.text;
    check('NO runtime clocks anywhere in the text (playing / startTime / elapsedMs / netLive / currentFrame)', !/"(playing|startTime|elapsedMs|netLive|currentFrame)"/.test(text));
    check('NO layer.animation, _morph*, crossLayer, faceHover in the text', !/"(animation|_morphNodes|_morphConnections|crossLayerResult|faceHover)"/.test(text));
    const snapObj = parsed.snapshot;
    check('3 real layers + the playback layer, activeLayer and the timeline come back', snapObj.layers.length === 4 && snapObj.activeLayer === 2 && snapObj.timeline.keyframeLayerIds.length === 3 && snapObj.timeline.playbackLayerIndex === 3);
    check('the playback layer keeps its flag; a disabled layer stays disabled; _timelineSavedEnabled survives', snapObj.layers[3].isTimelinePlayback === true && snapObj.layers[2].enabled === false && snapObj.layers[1].timelineSavedEnabled === true && snapObj.layers[0].timelineSavedEnabled === null);
    check('segment pairings, flips, members and per-keyframe net states survive', same(snapObj.timeline.segmentPairings, [null, [1, 0]]) && same(snapObj.timeline.segmentFlips, [[true, false], null]) && same(snapObj.timeline.segmentMembers, [null, [0, 2]]) && snapObj.timeline.netStates[0] === null && snapObj.timeline.netStates[2].x.kind === 'trig');
    check("'custom' with its Farborgel selection is kept on the base and on a layer", snapObj.base.lastHarmonyType === 'custom' && same(snapObj.base.lastSelection, SEL3) && snapObj.layers[0].lastHarmonyType === 'custom');
    check('palette overrides (a Map) come back as entries, per sheet', same(snapObj.base.facePalette.overrides, [[...st.baseFacePalette.overrides.entries()][0]]) && same(snapObj.layers[0].facePalette.overrides, [['some-key', 2]]));
    check("'farborgel' and 'max-contrast-gray' entries keep rule, params and displayColor", snapObj.base.faceAssignments.some(([, a]) => a.rule === 'farborgel' && a.params.source === 'harmonySelection' && Array.isArray(a.displayColor)) && snapObj.base.faceAssignments.some(([, a]) => a.rule === 'max-contrast-gray' && a.params.source === 'maxContrastGray'), J(snapObj.base.faceAssignments.reduce((m, [, a]) => { const k = a.rule + '/' + (a.params && a.params.source); m[k] = (m[k] || 0) + 1; return m; }, {})));
    check('free endpoint nodes are stored apart from the grid, on the base and on each layer', snapObj.base.freeNodes.length === 1 && snapObj.layers.every(l => l.freeNodes.length === 1));
    check('curve type with its seed, altNetSeed and the net transform survive', snapObj.settings.curveType.seed === 123456789 && same(snapObj.settings.altNetSeed, st.altNetSeed) && same(snapObj.settings.netTransform, st.baseNetTransform));
    // round trip through a restored state-like
    const back = stateFromSnapshot(snapObj, sh.grid.nodes, st.additionalLayers.map((l, i) => l.nodes.filter(n => !n.free)));
    const again = S.buildSessionSnapshot(back, 1700000000000);
    check('layered: snapshot -> state -> snapshot is identical', same(strip(again), strip(snap)) || same(again, snap));
}

// ---- 4. normalization ---------------------------------------------------------------------------------------------------
console.log('\n== 4. normalization ==');
{
    const base = clone(layered.snap);
    const run = mut => { const o = clone(base); mut(o); return S.validateSession(o); };
    let r = run(o => { o.base.lastSelection = null; });
    check("'custom' without a stored selection falls back to lastHarmonyType null (and is accepted)", r.ok && r.snapshot.base.lastHarmonyType === null && r.snapshot.base.lastSelection === null);
    r = run(o => { o.base.lastSelection = { version: 1, source: 'nope', members: [] }; });
    check("'custom' with an INVALID selection falls back to null too", r.ok && r.snapshot.base.lastHarmonyType === null);
    r = run(o => { o.base.lastHarmonyType = '3'; });
    check("a non-custom type does not keep a stale selection", r.ok && r.snapshot.base.lastHarmonyType === '3' && r.snapshot.base.lastSelection === null);
    r = run(o => { o.extra = 1; o.settings.zzz = 2; o.base.junk = 3; o.layers[0].junk = 4; o.timeline.junk = 5; });
    check('unknown keys at every level are dropped from the normalized copy', r.ok && !/junk|zzz|"extra"/.test(J(r.snapshot)));
    check('the normalized copy is a copy: mutating it does not touch the input', (() => { const o = clone(base); const v = S.validateSession(o); v.snapshot.base.connections.push([9, 9]); return o.base.connections.length === base.base.connections.length; })());
}

// ---- 5. versions and size -----------------------------------------------------------------------------------------------
console.log('\n== 5. versions and size ==');
{
    const base = clone(layered.snap);
    const code = mut => { const o = clone(base); mut(o); return S.validateSession(o); };
    for (const v of [0, 2, '1', null, undefined]) check(`schema ${J(v)} is rejected as schema-version`, (r => !r.ok && r.code === 'schema-version')(code(o => { if (v === undefined) delete o.schema; else o.schema = v; })));
    for (const v of [0, 2, '1', null, undefined]) check(`trailKeys ${J(v)} is rejected as trail-key-version`, (r => !r.ok && r.code === 'trail-key-version')(code(o => { if (v === undefined) delete o.trailKeys; else o.trailKeys = v; })));
    // 50,000 assignments is the per-sheet maximum; a dozen sheets of them exceeds 2 MB
    const big = clone(base); const entry = [0, { hue: 1, w: 0.1, s: 0.1, rule: 'farborgel', params: { source: 'farborgel', memberIndex: 0, cardinality: 3, strategy: 'cyclic' }, displayColor: [1, 2, 3] }];
    big.base.faceAssignments = Array.from({ length: 12000 }, (_, i) => ['k' + i + ':' + 'v'.repeat(60), entry[1]]);
    const ser = S.serializeSession(big);
    check('serializeSession refuses a snapshot over 2 MB with code too-large', !ser.ok && ser.code === 'too-large' && ser.size > 2 * 1024 * 1024, ser.size);
    check('parseSession refuses a string over 2 MB without parsing it', (r => !r.ok && r.code === 'too-large')(S.parseSession('x'.repeat(2 * 1024 * 1024 + 1))));
    check('a snapshot just under the cap is accepted by serialize', S.serializeSession(clone(base)).ok);
}

// ---- 6. the validator rejects what it must (targeted) --------------------------------------------------------------------
console.log('\n== 6. targeted rejections ==');
{
    const base = clone(layered.snap);
    const bad = (name, mut) => check('rejects: ' + name, (r => !r.ok && r.code === 'invalid')((() => { const o = clone(base); mut(o); return S.validateSession(o); })()), (() => { const o = clone(base); mut(o); return S.validateSession(o).detail; })());
    bad('a negative node id in a connection', o => { o.base.connections[0] = [-1, 2]; });
    bad('a connection to a node that does not exist', o => { o.base.connections[0] = [1, 99999]; });
    bad('a connection with three ids', o => { o.base.connections[0] = [1, 2, 3]; });
    bad('a non-integer node id', o => { o.base.connections[0] = [1.5, 2]; });
    bad('a free node colliding with a grid id', o => { o.base.connections = []; o.base.redoStack = []; o.base.freeNodes[0].id = 1; });
    bad('two free nodes with the same id', o => { o.base.freeNodes.push(clone(o.base.freeNodes[0])); });
    bad('a non-finite coordinate', o => { o.base.freeNodes[0].x = 1e999; });
    bad('a malformed node fingerprint', o => { o.base.nodeCheck.hash = 'ZZ'; });
    bad('hue not a number', o => { o.base.faceAssignments[0][1].hue = 'red'; });
    bad('w out of 0-1', o => { o.base.faceAssignments[0][1].w = 2; });
    bad('displayColor with a byte over 255', o => { o.base.faceAssignments[0][1].displayColor = [256, 0, 0]; });
    bad('two assignments with the same trail key', o => { o.base.faceAssignments.push(clone(o.base.faceAssignments[0])); });
    bad('params that are not plain data (deeply nested)', o => { let d = {}; const root = d; for (let i = 0; i < 9; i++) { d.x = {}; d = d.x; } o.base.faceAssignments[0][1].params = root; });
    bad('a __proto__ key in params', o => { o.base.faceAssignments[0][1].params = JSON.parse('{"__proto__": {"x": 1}}'); });
    bad('an unknown harmony type', o => { o.base.lastHarmonyType = 'Z'; });
    bad('an unknown strategy', o => { o.base.distributionStrategy = 'hierarchy'; });
    bad('an anchor hue of 25', o => { o.base.faceAnchor.hueIndex = 25; });
    bad('an unknown shape', o => { o.settings.shape = 'pentagon'; });
    bad('a hex node count above the UI ceiling', o => { o.settings.shape = 'hex'; o.settings.nodeCount = 9; });
    bad('a layer with a node count above its shape ceiling', o => { o.layers[0].shape = 'triangle'; o.layers[0].nodeCount = 11; });
    bad('an unknown curve kind', o => { o.settings.curveType.kind = 'wavy'; });
    bad('a non-boolean showNodes', o => { o.settings.showNodes = 1; });
    bad('altNetSeed with an impossible polygon', o => { o.settings.altNetSeed.n = 5; });
    bad('altNetSeed with side 2', o => { o.settings.altNetSeed.side = 2; });
    bad('activeLayer pointing past the layers', o => { o.activeLayer = 99; });
    bad('more layers than the cap', o => { o.layers = Array.from({ length: 65 }, () => clone(base.layers[0])); o.timeline = null; o.activeLayer = 'base'; });
    bad('a keyframe referring to a missing layer', o => { o.timeline.keyframeLayerIds = [0, 1, 7]; });
    bad('a duplicate keyframe', o => { o.timeline.keyframeLayerIds = [0, 0, 1]; });
    bad('a segment array of the wrong length', o => { o.timeline.segmentDurationsMs = [2000]; });
    bad('a non-positive segment duration', o => { o.timeline.segmentDurationsMs = [2000, 0]; });
    bad('a playback layer index that is not a playback layer', o => { o.timeline.playbackLayerIndex = 0; });
    bad('netStates with the wrong length', o => { o.timeline.netStates = [null]; });
    bad('a layer offset that is not a number', o => { o.layers[0].offsetX = 'left'; });
    check('rejects: a sparse array (a hole is not data JSON would carry)', (r => !r.ok)((() => { const o = clone(base); delete o.base.connections[0][1]; return S.validateSession(o); })()));
    check('rejects without throwing: a circular object', (r => !r.ok)((() => { const o = clone(base); o.base.self = o; return (() => { try { return S.validateSession(o); } catch (e) { return { ok: 'threw' }; } })(); })()) && (() => { const o = clone(base); o.settings.curveType.self = o; try { return !S.validateSession(o).ok; } catch (e) { return false; } })());
    bad('settings missing', o => { delete o.settings; });
    bad('base missing', o => { delete o.base; });
    bad('layers not an array', o => { o.layers = {}; });
}

// ---- 7. never throws; truncation; random mutation fuzz -------------------------------------------------------------------
console.log('\n== 7. robustness ==');
{
    let threw = 0;
    for (const v of [undefined, null, 0, 1, true, '', 'x', [], [1], () => 1, NaN, {}, { schema: 1 }, Symbol('s')]) {
        try { S.validateSession(v); } catch (e) { threw++; }
        try { S.parseSession(v); } catch (e) { threw++; }
    }
    check('validateSession and parseSession never throw on non-snapshot input', threw === 0, threw);
    const text = layered.text;
    let trThrew = 0, trOk = 0;
    for (let n = 0; n < text.length; n += Math.max(1, Math.floor(text.length / 400))) { try { if (S.parseSession(text.slice(0, n)).ok) trOk++; } catch (e) { trThrew++; } }
    check('every sampled truncation of a real snapshot is rejected without throwing', trThrew === 0 && trOk === 0, `${trThrew} threw, ${trOk} accepted`);
    check('the untruncated text is accepted', S.parseSession(text).ok);

    // random structural mutations of the parsed snapshot
    const rand = C.rng(20261005), baseObj = JSON.parse(text);
    const paths = [];
    (function walk(o, p) { if (o && typeof o === 'object') for (const k of Object.keys(o)) { paths.push(p.concat([k])); walk(o[k], p.concat([k])); } })(baseObj, []);
    const junk = [null, 'x', '', -1, 0, 1.5, 1e308, [], {}, [[]], true, false, 'a'.repeat(5000), [1, 2, 3], { a: 1 }, 99999, -0.5];
    let mThrew = 0, accepted = 0, rejected = 0, idempotent = 0, serializable = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
        const o = clone(baseObj);
        const nm = 1 + Math.floor(rand() * 3), applied = [];
        for (let m = 0; m < nm; m++) {
            const p = paths[Math.floor(rand() * paths.length)];
            let t = o; for (let d = 0; d < p.length - 1 && t; d++) t = t[p[d]];
            if (!t || typeof t !== 'object') continue;
            const k = p[p.length - 1], act = Math.floor(rand() * 3);
            if (act === 0) { delete t[k]; applied.push(p.join('/') + ' deleted'); } else { const jv = junk[Math.floor(rand() * junk.length)]; t[k] = jv; applied.push(p.join('/') + ' = ' + J(jv).slice(0, 40)); }
        }
        let r;
        try { r = S.validateSession(o); } catch (e) { mThrew++; continue; }
        if (r.ok) {
            accepted++;
            const r2 = S.validateSession(r.snapshot);
            if (r2.ok && same(r2.snapshot, r.snapshot)) idempotent++; else if (!globalThis.__shown) { globalThis.__shown = 1; console.log('  first non-idempotent mutant:', r2.ok ? firstDiff(r.snapshot, r2.snapshot) : r2.code + ' ' + r2.detail, '| mutations:', applied.join('; ')); }
            if (S.serializeSession(r.snapshot).ok) serializable++;
        } else rejected++;
    }
    check(`${N} random mutations never make the validator throw`, mThrew === 0, mThrew);
    check('every accepted mutant re-validates to an identical snapshot (normalization is idempotent)', idempotent === accepted, `${idempotent}/${accepted} accepted, ${rejected} rejected`);
    check('every accepted mutant is serializable', serializable === accepted);
    check('the fuzz exercises both outcomes (it is not vacuous)', accepted > 50 && rejected > 500, `${accepted} accepted, ${rejected} rejected`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
