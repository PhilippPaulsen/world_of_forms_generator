/**
 * core/session.js
 * Phase 3 (autosave, lean version), P0: the serializer and validator for a generator session snapshot - the data a
 * reload of the generator tab would otherwise lose. Pure logic, no DOM, no p5, no storage: callers hand in a
 * "state-like" object (the globals of core/state.js, gathered by the caller) and get plain JSON back; reading and
 * writing sessionStorage, and applying a snapshot to the live globals, are the next phases and live elsewhere.
 *
 * WHY NOT buildExportData(): that is a derived analysis format for outsiders (faces, adjacency, names), about
 * 144 KB for the densest corpus pattern against ~7.5 KB here, and it omits palette, anchor, harmony type, custom
 * selection, strategy, redo stacks, disabled layers, the timeline and the active tab. A reload needs the STATE, not
 * the analysis. The two formats are deliberately separate.
 *
 * NEVER SAVED (runtime, not work): clocks (timeline.playing / startTime / elapsedMs / netLive / currentFrame),
 * layer.animation, derived caches and render substitutes (_morphNodes, _morphConnections), crossLayerResult,
 * faceHover, the standalone net animation. The timeline is saved WITHOUT its clocks and comes back stopped at 0.
 *
 * VERSIONS. SESSION_SCHEMA_VERSION covers the shape of this file's format. SESSION_TRAIL_KEY_VERSION covers the
 * scheme that makes the face-trail keys of the assignments (core/facecolor.js: canonical vertex set, 0.01 px): if
 * that scheme changes, every stored key would silently become an inert orphan, so a snapshot made under another
 * scheme is rejected, not migrated. Bump the matching constant whenever the format or the key scheme changes.
 * Each sheet also carries a fingerprint of its GRID nodes (sessionNodeFingerprint): if the grid algorithm or its
 * numbers change, the connections (stored as node ids) would point at other nodes, and the restore must notice.
 *
 * validateSession() never throws and returns a NORMALIZED COPY (unknown keys dropped, every field type-checked and
 * bounded), so what a restore applies is never the parsed object itself. One deliberate normalization: a sheet
 * whose lastHarmonyType is 'custom' but whose lastSelection is missing or invalid falls back to lastHarmonyType
 * null (nothing could regenerate it).
 *
 * Depends on (browser: load AFTER core/farborgel-bridge.js): validateHarmonySelection(), DISTRIBUTION_STRATEGIES.
 */

const SESSION_SCHEMA_VERSION = 1;
const SESSION_TRAIL_KEY_VERSION = 1;
const SESSION_MAX_CHARS = 2 * 1024 * 1024;        // serialized size cap; the densest stress pattern with 3 layers is ~240 KB
const SESSION_STORAGE_KEY = 'wof:session';         // the sessionStorage key (used by the writer, a later phase)
const SESSION_QUARANTINE_PREFIX = 'wof:session:quarantine:'; // a rejected snapshot is moved here, never deleted
const SESSION_MAX_LAYERS = 64;
const SESSION_MAX_CONNECTIONS = 20000;             // per sheet (a full 225-node square has 25,200 pairs; nobody clicks that many)
const SESSION_MAX_ASSIGNMENTS = 50000;             // per sheet
const SESSION_MAX_FREE_NODES = 5000;
const SESSION_SHAPES = Object.freeze(['triangle', 'square', 'hex']);
const SESSION_HARMONY_TYPES = Object.freeze(['2', '3', '4', 'B', 'W', 'S', 'V', 'custom']);
const SESSION_CURVE_KINDS = Object.freeze(['straight', 'curve', 'compound', 'free']);
const SESSION_STRATEGIES = Object.freeze(['cyclic', 'area', 'symmetry', 'rings']);

// ---- small predicates ---------------------------------------------------------------------------------------------
function _sObj(x) { return typeof x === 'object' && x !== null && !Array.isArray(x); }
function _sNum(x) { return typeof x === 'number' && Number.isFinite(x); }
function _sInt(x) { return Number.isInteger(x); }
function _sPos(x) { return Number.isInteger(x) && x >= 1; }
function _sCoord(x) { return _sNum(x) && Math.abs(x) <= 1e6; }
function _sStr(x, max) { return typeof x === 'string' && x.length <= (max || 256); }
// the UI's node-count ceiling per shape (core/forms.js maxNodeCountFor), or a coarse bound when that file is not loaded
function _sMaxNodeCount(shape) { return typeof maxNodeCountFor === 'function' ? maxNodeCountFor(shape) : 15; }
// bounded plain JSON (null / boolean / finite number / short string / small array / small object), deep-copied.
// Throws a plain string on anything else; callers catch it into a rejection.
function _sJson(x, depth, label) {
    if (x === null || typeof x === 'boolean') return x;
    if (typeof x === 'number') { if (!Number.isFinite(x)) throw label + ': non-finite number'; return x; }
    if (typeof x === 'string') { if (x.length > 256) throw label + ': string too long'; return x; }
    if (depth <= 0) throw label + ': nested too deep';
    if (Array.isArray(x)) { if (x.length > 256) throw label + ': array too long'; return x.map(v => _sJson(v, depth - 1, label)); }
    if (_sObj(x)) {
        const keys = Object.keys(x);
        if (keys.length > 32) throw label + ': too many keys';
        const out = {};
        keys.forEach(k => { if (k === '__proto__') throw label + ': forbidden key'; out[k] = _sJson(x[k], depth - 1, label); });
        return out;
    }
    throw label + ': not plain data';
}

// FNV-1a over the GRID nodes (free endpoint nodes are state, not grid, and are stored separately): id and the
// position rounded to 0.01 px - the same rounding the trail keys use. { count, hash }.
function sessionNodeFingerprint(nodes) {
    const grid = (nodes || []).filter(n => !(n && n.free === true));
    let h = 0x811c9dc5;
    for (const n of grid) {
        const s = n.id + ':' + Math.round(n.x * 100) + ':' + Math.round(n.y * 100) + ';';
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    }
    return { count: grid.length, hash: h.toString(16).padStart(8, '0') };
}

// ---- building a snapshot ------------------------------------------------------------------------------------------
function _snapStoreEntries(store) {
    if (!store || typeof store.entries !== 'function') return [];
    return Array.from(store.entries()).map(([key, a]) => [key, {
        hue: a.hue, w: a.w, s: a.s,
        rule: a.rule === undefined ? null : a.rule,
        params: a.params === undefined ? null : JSON.parse(JSON.stringify(a.params)),
        displayColor: Array.isArray(a.displayColor) ? a.displayColor.slice() : null,
    }]);
}
function _snapPalette(p) {
    if (!p) return null;
    return { ruleId: p.ruleId === undefined ? null : p.ruleId, idx: Array.from(p.idx || []),
        overrides: p.overrides && typeof p.overrides.entries === 'function' ? Array.from(p.overrides.entries()) : [] };
}
function _snapSheet(o) {
    return {
        connections: (o.connections || []).map(c => c.slice()),
        redoStack: (o.redoStack || []).map(c => c.slice()),
        freeNodes: (o.nodes || []).filter(n => n && n.free === true).map(n => ({ id: n.id, x: n.x, y: n.y })),
        nodeCheck: sessionNodeFingerprint(o.nodes),
        faceAssignments: _snapStoreEntries(o.faceAssignments),
        facePalette: _snapPalette(o.facePalette),
        faceAnchor: o.faceAnchor ? { hueIndex: o.faceAnchor.hueIndex, registerIndex: o.faceAnchor.registerIndex } : null,
        lastHarmonyType: o.lastHarmonyType === undefined ? null : o.lastHarmonyType,
        lastSelection: o.lastSelection ? JSON.parse(JSON.stringify(o.lastSelection)) : null,
        distributionStrategy: o.distributionStrategy === undefined ? null : o.distributionStrategy,
    };
}

// `s` is the state-like object: { currentShape, nodeCount, shapeSizeFactor, canvasW, canvasH, symmetryMode,
// symmetryCategory?, symmetryFold?, curveType, lineColor, showNodes, showFaces, freeEndpointsEnabled, altNetSeed,
// baseNetTransform, connections, redoStack, nodes, baseFaceAssignments (Map), baseFacePalette, baseFaceAnchor,
// baseLastHarmonyType, baseLastSelection, baseDistributionStrategy, additionalLayers, timeline, activeLayer } -
// the globals of core/state.js, gathered by the caller. Returns a plain-JSON object (maps become entry arrays,
// runtime clocks are left out). The result is only as trustworthy as `s`: validateSession() is what a reader must run.
function buildSessionSnapshot(s, now) {
    const base = _snapSheet({ connections: s.connections, redoStack: s.redoStack, nodes: s.nodes, faceAssignments: s.baseFaceAssignments,
        facePalette: s.baseFacePalette, faceAnchor: s.baseFaceAnchor, lastHarmonyType: s.baseLastHarmonyType,
        lastSelection: s.baseLastSelection, distributionStrategy: s.baseDistributionStrategy });
    const layers = (s.additionalLayers || []).map(l => Object.assign(_snapSheet(l), {
        shape: l.shape, symmetryMode: l.symmetryMode, nodeCount: l.nodeCount, shapeSizeFactor: l.shapeSizeFactor,
        offsetX: l.offsetX, offsetY: l.offsetY, rotation: l.rotation || 0, enabled: !!l.enabled, showFaces: !!l.showFaces,
        isTimelinePlayback: !!l.isTimelinePlayback,
        timelineSavedEnabled: l._timelineSavedEnabled === undefined ? null : !!l._timelineSavedEnabled,
    }));
    const tl = s.timeline;
    return {
        schema: SESSION_SCHEMA_VERSION,
        trailKeys: SESSION_TRAIL_KEY_VERSION,
        savedAt: typeof now === 'number' ? now : Date.now(),
        settings: {
            shape: s.currentShape, nodeCount: s.nodeCount, shapeSizeFactor: s.shapeSizeFactor,
            canvas: { w: s.canvasW, h: s.canvasH },
            symmetryMode: s.symmetryMode,
            symmetryCategory: s.symmetryCategory === undefined ? null : s.symmetryCategory,
            symmetryFold: s.symmetryFold === undefined ? null : s.symmetryFold,
            curveType: JSON.parse(JSON.stringify(s.curveType)),
            lineColor: s.lineColor, showNodes: !!s.showNodes, showFaces: !!s.showFaces, freeEndpointsEnabled: !!s.freeEndpointsEnabled,
            altNetSeed: s.altNetSeed ? JSON.parse(JSON.stringify(s.altNetSeed)) : null,
            netTransform: s.baseNetTransform ? JSON.parse(JSON.stringify(s.baseNetTransform)) : null,
        },
        base,
        layers,
        activeLayer: s.activeLayer,
        timeline: tl ? {
            keyframeLayerIds: tl.keyframeLayerIds.slice(),
            playbackLayerIndex: tl.playbackLayerIndex === undefined ? null : tl.playbackLayerIndex,
            segmentDurationsMs: tl.segmentDurationsMs.slice(),
            segmentPairings: (tl.segmentPairings || []).map(p => (p ? p.slice() : null)),
            segmentFlips: (tl.segmentFlips || []).map(p => (p ? p.slice() : null)),
            segmentMembers: (tl.segmentMembers || []).map(p => (p ? p.slice() : null)),
            netStates: (tl.netStates || tl.keyframeLayerIds.map(() => null)).map(n => (n ? JSON.parse(JSON.stringify(n)) : null)),
        } : null,
    };
}

// -> { ok: true, text } | { ok: false, code: 'too-large', size }
function serializeSession(snapshot) {
    const text = JSON.stringify(snapshot);
    if (text.length > SESSION_MAX_CHARS) return { ok: false, code: 'too-large', size: text.length };
    return { ok: true, text };
}

// ---- validating (and normalizing) a snapshot ----------------------------------------------------------------------
function _vConnections(list, what) {
    if (!Array.isArray(list)) throw what + ' must be an array';
    if (list.length > SESSION_MAX_CONNECTIONS) throw `${what} has ${list.length} entries (max ${SESSION_MAX_CONNECTIONS})`;
    return list.map((c, i) => {
        if (!Array.isArray(c) || (c.length !== 1 && c.length !== 2) || !c.every(_sPos)) throw `${what}[${i}] must be one or two positive integer node ids`;
        return c.slice();
    });
}
function _vAssignment(a, label) {
    if (!_sObj(a)) throw label + ' is not an object';
    if (!_sNum(a.hue)) throw label + ' hue must be a finite number';
    if (!_sNum(a.w) || a.w < 0 || a.w > 1 || !_sNum(a.s) || a.s < 0 || a.s > 1) throw label + ' w and s must be numbers in 0-1';
    if (!(a.rule === null || _sStr(a.rule, 64))) throw label + ' rule must be null or a short string';
    const dc = a.displayColor;
    if (!(dc === null || (Array.isArray(dc) && dc.length === 3 && dc.every(b => _sInt(b) && b >= 0 && b <= 255)))) throw label + ' displayColor must be null or three bytes';
    return { hue: a.hue, w: a.w, s: a.s, rule: a.rule, params: a.params === null || a.params === undefined ? null : _sJson(a.params, 4, label + ' params'), displayColor: dc === null ? null : dc.slice() };
}
function _vSheet(o, what) {
    if (!_sObj(o)) throw what + ' is not an object';
    const free = o.freeNodes;
    if (!Array.isArray(free) || free.length > SESSION_MAX_FREE_NODES) throw what + '.freeNodes must be an array (max ' + SESSION_MAX_FREE_NODES + ')';
    const seenFree = new Set();
    const freeNodes = free.map((n, i) => {
        if (!_sObj(n) || !_sPos(n.id) || !_sCoord(n.x) || !_sCoord(n.y)) throw `${what}.freeNodes[${i}] must be {id, x, y}`;
        if (seenFree.has(n.id)) throw `${what}.freeNodes has a duplicate id ${n.id}`;
        seenFree.add(n.id);
        return { id: n.id, x: n.x, y: n.y };
    });
    const nc = o.nodeCheck;
    if (!_sObj(nc) || !Number.isInteger(nc.count) || nc.count < 0 || nc.count > 100000 || typeof nc.hash !== 'string' || !/^[0-9a-f]{8}$/.test(nc.hash)) throw what + '.nodeCheck must be {count, hash}';
    // grid node ids are 1..count (checked against the real builders in the tests); a free node must not reuse one
    const idOk = id => id <= nc.count || seenFree.has(id);
    const connections = _vConnections(o.connections, what + '.connections');
    const redoStack = _vConnections(o.redoStack, what + '.redoStack');
    [connections, redoStack].forEach((list, k) => list.forEach((c, i) => c.forEach(id => { if (!idOk(id)) throw `${what}.${k ? 'redoStack' : 'connections'}[${i}] refers to node ${id}, which is neither a grid node nor a free node`; })));
    freeNodes.forEach(n => { if (n.id <= nc.count) throw `${what}.freeNodes id ${n.id} collides with a grid node id`; });
    const fa = o.faceAssignments;
    if (!Array.isArray(fa) || fa.length > SESSION_MAX_ASSIGNMENTS) throw what + '.faceAssignments must be an array (max ' + SESSION_MAX_ASSIGNMENTS + ')';
    const seenKeys = new Set();
    const faceAssignments = fa.map((e, i) => {
        if (!Array.isArray(e) || e.length !== 2 || !_sStr(e[0], 512) || e[0] === '') throw `${what}.faceAssignments[${i}] must be [key, entry]`;
        if (seenKeys.has(e[0])) throw `${what}.faceAssignments has a duplicate key`;
        seenKeys.add(e[0]);
        return [e[0], _vAssignment(e[1], `${what}.faceAssignments[${i}]`)];
    });
    let facePalette = null;
    if (o.facePalette !== null && o.facePalette !== undefined) {
        const p = o.facePalette;
        if (!_sObj(p) || !(p.ruleId === null || _sStr(p.ruleId, 64)) || !Array.isArray(p.idx) || p.idx.length > 64 || !p.idx.every(i => _sInt(i) && i >= 0)
            || !Array.isArray(p.overrides) || p.overrides.length > SESSION_MAX_ASSIGNMENTS
            || !p.overrides.every(e => Array.isArray(e) && e.length === 2 && _sStr(e[0], 512) && _sInt(e[1]) && e[1] >= 0)) throw what + '.facePalette is malformed';
        facePalette = { ruleId: p.ruleId, idx: p.idx.slice(), overrides: p.overrides.map(e => [e[0], e[1]]) };
    }
    let faceAnchor = null;
    if (o.faceAnchor !== null && o.faceAnchor !== undefined) {
        const a = o.faceAnchor;
        if (!_sObj(a) || !_sInt(a.hueIndex) || a.hueIndex < 1 || a.hueIndex > 24 || !(a.registerIndex === null || (_sInt(a.registerIndex) && a.registerIndex >= 0 && a.registerIndex <= 27))) throw what + '.faceAnchor must be {hueIndex 1-24, registerIndex 0-27 or null}';
        faceAnchor = { hueIndex: a.hueIndex, registerIndex: a.registerIndex };
    }
    let lastHarmonyType = o.lastHarmonyType === undefined ? null : o.lastHarmonyType;
    if (!(lastHarmonyType === null || SESSION_HARMONY_TYPES.includes(lastHarmonyType))) throw what + '.lastHarmonyType is not a known harmony type';
    let lastSelection = null;
    if (o.lastSelection !== null && o.lastSelection !== undefined) {
        const v = validateHarmonySelection(o.lastSelection);
        if (v.ok) lastSelection = JSON.parse(JSON.stringify(v.selection));   // an invalid stored selection is dropped, not fatal
    }
    if (lastHarmonyType === 'custom' && lastSelection === null) lastHarmonyType = null;   // nothing could regenerate it
    if (lastHarmonyType !== 'custom') lastSelection = null;                               // same rule as setLastHarmonyTypeFor()
    const distributionStrategy = o.distributionStrategy === undefined ? null : o.distributionStrategy;
    if (!(distributionStrategy === null || SESSION_STRATEGIES.includes(distributionStrategy))) throw what + '.distributionStrategy is not a known strategy';
    return { connections, redoStack, freeNodes, nodeCheck: { count: nc.count, hash: nc.hash }, faceAssignments, facePalette, faceAnchor, lastHarmonyType, lastSelection, distributionStrategy };
}
function _vPermutation(p, what) {
    if (p === null) return null;
    if (!Array.isArray(p) || p.length > 64 || !p.every(i => _sInt(i) && i >= 0)) throw what + ' must be null or an array of non-negative integers';
    return p.slice();
}
function _vFlips(p, what) {
    if (p === null) return null;
    if (!Array.isArray(p) || p.length > 64 || !p.every(b => typeof b === 'boolean')) throw what + ' must be null or an array of booleans';
    return p.slice();
}

// -> { ok: true, snapshot } (a normalized copy) | { ok: false, code, detail }
// codes: 'not-an-object' | 'schema-version' | 'trail-key-version' | 'invalid'. Never throws.
function validateSession(input) {
    try {
        if (!_sObj(input)) return { ok: false, code: 'not-an-object', detail: 'snapshot is not an object' };
        // Validate what JSON would carry, not the live object: a sparse array (Array.prototype.every skips holes),
        // an undefined value or -0 would otherwise pass here and change on the way through storage. For text that
        // went through JSON.parse this is a no-op; for an in-memory object it is what makes the check honest.
        const raw = JSON.parse(JSON.stringify(input));
        if (raw.schema !== SESSION_SCHEMA_VERSION) return { ok: false, code: 'schema-version', detail: `schema ${JSON.stringify(raw.schema)} is not ${SESSION_SCHEMA_VERSION}` };
        if (raw.trailKeys !== SESSION_TRAIL_KEY_VERSION) return { ok: false, code: 'trail-key-version', detail: `trail key scheme ${JSON.stringify(raw.trailKeys)} is not ${SESSION_TRAIL_KEY_VERSION}` };
        if (!_sNum(raw.savedAt) || raw.savedAt < 0) throw 'savedAt must be a non-negative number';
        const st = raw.settings;
        if (!_sObj(st)) throw 'settings is not an object';
        if (!SESSION_SHAPES.includes(st.shape)) throw 'settings.shape must be triangle, square or hex';
        if (!_sPos(st.nodeCount) || st.nodeCount > _sMaxNodeCount(st.shape)) throw 'settings.nodeCount must be an integer from 1 to ' + _sMaxNodeCount(st.shape) + ' for ' + st.shape;
        if (!_sNum(st.shapeSizeFactor) || st.shapeSizeFactor <= 0 || st.shapeSizeFactor > 100) throw 'settings.shapeSizeFactor must be a positive number';
        if (!_sObj(st.canvas) || !_sPos(st.canvas.w) || !_sPos(st.canvas.h) || st.canvas.w > 10000 || st.canvas.h > 10000) throw 'settings.canvas must be {w, h}';
        if (!_sStr(st.symmetryMode, 64) || st.symmetryMode === '') throw 'settings.symmetryMode must be a short string';
        if (!(st.symmetryCategory === null || st.symmetryCategory === undefined || _sStr(st.symmetryCategory, 32))) throw 'settings.symmetryCategory must be null or a short string';
        if (!(st.symmetryFold === null || st.symmetryFold === undefined || st.symmetryFold === 3 || st.symmetryFold === 6)) throw 'settings.symmetryFold must be null, 3 or 6';
        const ct = st.curveType;
        if (!_sObj(ct) || !SESSION_CURVE_KINDS.includes(ct.kind)) throw 'settings.curveType.kind must be one of ' + SESSION_CURVE_KINDS.join(', ');
        const curveType = _sJson(ct, 2, 'settings.curveType');
        if (!_sStr(st.lineColor, 32)) throw 'settings.lineColor must be a short string';
        for (const k of ['showNodes', 'showFaces', 'freeEndpointsEnabled']) if (typeof st[k] !== 'boolean') throw `settings.${k} must be a boolean`;
        let altNetSeed = null;
        if (st.altNetSeed !== null && st.altNetSeed !== undefined) {
            const a = st.altNetSeed;
            if (!_sObj(a) || !_sObj(a.p) || !_sCoord(a.p.x) || !_sCoord(a.p.y) || !_sObj(a.q) || !_sCoord(a.q.x) || !_sCoord(a.q.y) || (a.side !== 1 && a.side !== -1) || ![3, 4, 6].includes(a.n)) throw 'settings.altNetSeed must be {p, q, side, n}';
            altNetSeed = { p: { x: a.p.x, y: a.p.y }, q: { x: a.q.x, y: a.q.y }, side: a.side, n: a.n };
        }
        const netTransform = st.netTransform === null || st.netTransform === undefined ? null : _sJson(st.netTransform, 6, 'settings.netTransform');
        if (netTransform !== null && !_sObj(netTransform)) throw 'settings.netTransform must be null or an object';
        const settings = { shape: st.shape, nodeCount: st.nodeCount, shapeSizeFactor: st.shapeSizeFactor, canvas: { w: st.canvas.w, h: st.canvas.h },
            symmetryMode: st.symmetryMode, symmetryCategory: st.symmetryCategory === undefined ? null : st.symmetryCategory, symmetryFold: st.symmetryFold === undefined ? null : st.symmetryFold,
            curveType, lineColor: st.lineColor, showNodes: st.showNodes, showFaces: st.showFaces, freeEndpointsEnabled: st.freeEndpointsEnabled, altNetSeed, netTransform };

        const base = _vSheet(raw.base, 'base');
        if (!Array.isArray(raw.layers) || raw.layers.length > SESSION_MAX_LAYERS) throw 'layers must be an array (max ' + SESSION_MAX_LAYERS + ')';
        const layers = raw.layers.map((l, i) => {
            const what = 'layers[' + i + ']';
            const sheet = _vSheet(l, what);
            if (!SESSION_SHAPES.includes(l.shape)) throw what + '.shape must be triangle, square or hex';
            if (!_sStr(l.symmetryMode, 64) || l.symmetryMode === '') throw what + '.symmetryMode must be a short string';
            if (!_sPos(l.nodeCount) || l.nodeCount > _sMaxNodeCount(l.shape)) throw what + '.nodeCount must be an integer from 1 to ' + _sMaxNodeCount(l.shape) + ' for ' + l.shape;
            if (!_sNum(l.shapeSizeFactor) || l.shapeSizeFactor <= 0 || l.shapeSizeFactor > 100) throw what + '.shapeSizeFactor must be a positive number';
            if (!_sCoord(l.offsetX) || !_sCoord(l.offsetY) || !_sNum(l.rotation) || Math.abs(l.rotation) > 1e5) throw what + ' offsetX / offsetY / rotation must be finite numbers';
            for (const k of ['enabled', 'showFaces', 'isTimelinePlayback']) if (typeof l[k] !== 'boolean') throw `${what}.${k} must be a boolean`;
            if (!(l.timelineSavedEnabled === null || typeof l.timelineSavedEnabled === 'boolean')) throw what + '.timelineSavedEnabled must be null or a boolean';
            return Object.assign(sheet, { shape: l.shape, symmetryMode: l.symmetryMode, nodeCount: l.nodeCount, shapeSizeFactor: l.shapeSizeFactor, offsetX: l.offsetX, offsetY: l.offsetY,
                rotation: l.rotation, enabled: l.enabled, showFaces: l.showFaces, isTimelinePlayback: l.isTimelinePlayback, timelineSavedEnabled: l.timelineSavedEnabled });
        });
        const activeLayer = raw.activeLayer;
        if (!(activeLayer === 'base' || (_sInt(activeLayer) && activeLayer >= 0 && activeLayer < layers.length))) throw 'activeLayer must be "base" or the index of a layer';

        let timeline = null;
        if (raw.timeline !== null && raw.timeline !== undefined) {
            const t = raw.timeline;
            if (!_sObj(t)) throw 'timeline is not an object';
            const kf = t.keyframeLayerIds;
            if (!Array.isArray(kf) || kf.length < 1 || kf.length > SESSION_MAX_LAYERS || !kf.every(i => _sInt(i) && i >= 0 && i < layers.length)) throw 'timeline.keyframeLayerIds must list valid layer indexes';
            if (new Set(kf).size !== kf.length) throw 'timeline.keyframeLayerIds has a duplicate';
            const segs = kf.length - 1;
            if (!(t.playbackLayerIndex === null || (_sInt(t.playbackLayerIndex) && t.playbackLayerIndex >= 0 && t.playbackLayerIndex < layers.length && layers[t.playbackLayerIndex].isTimelinePlayback))) throw 'timeline.playbackLayerIndex must be null or a playback layer';
            if ((t.playbackLayerIndex === null) !== (segs === 0)) throw 'timeline.playbackLayerIndex must be set exactly when there are two or more keyframes';
            const arr = (name, f) => { const a = t[name]; if (!Array.isArray(a) || a.length !== segs) throw `timeline.${name} must have one entry per segment (${segs})`; return a.map((p, i) => f(p, `timeline.${name}[${i}]`)); };
            const segmentDurationsMs = arr('segmentDurationsMs', (d, w) => { if (!_sNum(d) || d <= 0 || d > 3.6e6) throw w + ' must be a positive duration'; return d; });
            const segmentPairings = arr('segmentPairings', _vPermutation), segmentFlips = arr('segmentFlips', _vFlips), segmentMembers = arr('segmentMembers', _vPermutation);
            const ns = t.netStates;
            if (!Array.isArray(ns) || ns.length !== kf.length) throw 'timeline.netStates must have one entry per keyframe';
            const netStates = ns.map((n, i) => { if (n === null) return null; const c = _sJson(n, 6, `timeline.netStates[${i}]`); if (!_sObj(c)) throw `timeline.netStates[${i}] must be null or an object`; return c; });
            timeline = { keyframeLayerIds: kf.slice(), playbackLayerIndex: t.playbackLayerIndex, segmentDurationsMs, segmentPairings, segmentFlips, segmentMembers, netStates };
        }
        return { ok: true, snapshot: { schema: SESSION_SCHEMA_VERSION, trailKeys: SESSION_TRAIL_KEY_VERSION, savedAt: raw.savedAt, settings, base, layers, activeLayer, timeline } };
    } catch (e) {
        return { ok: false, code: 'invalid', detail: typeof e === 'string' ? e : 'unexpected shape (' + (e && e.message) + ')' };
    }
}

// The raw string from storage -> the same result as validateSession(), plus 'too-large' / 'not-json'. Never throws.
function parseSession(rawString) {
    if (rawString === null || rawString === undefined || rawString === '') return { ok: false, code: 'empty', detail: 'nothing stored' };
    if (typeof rawString !== 'string') return { ok: false, code: 'not-json', detail: 'not a string' };
    if (rawString.length > SESSION_MAX_CHARS) return { ok: false, code: 'too-large', detail: `larger than ${SESSION_MAX_CHARS} characters` };
    let obj;
    try { obj = JSON.parse(rawString); } catch (e) { return { ok: false, code: 'not-json', detail: 'not valid JSON' }; }
    return validateSession(obj);
}
