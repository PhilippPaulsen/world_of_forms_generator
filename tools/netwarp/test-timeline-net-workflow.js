/**
 * tools/netwarp/test-timeline-net-workflow.js
 * THE ACCEPTANCE TEST of the layer-table work (diamond, timeline strip, removal of the old controls): the maintainer's real net workflow through the real
 * addLayerToTimeline() path. It must pass UNCHANGED after every one of those commits.
 *
 *   node tools/netwarp/test-timeline-net-workflow.js
 *   SKETCH_JS=... NETWARP_JS=... node tools/netwarp/test-timeline-net-workflow.js        (sabotage runs)
 *   PRINT_MATRIX=1 node tools/netwarp/test-timeline-net-workflow.js                      (prints the matrix as JSON)
 *
 * The workflow: there is exactly ONE net (baseNetTransform on the Base); a layer carries no net of its own; a timeline keyframe carries a SNAPSHOT of the Base net
 * (timeline.netStates[i], captured by "Add to Timeline" with Include net on automatic = on while a net warp is active). Set net A on the Base, select layer 1,
 * Add to Timeline; set net B on the Base, select layer 2, Add to Timeline: pattern AND net are then animated between the two keyframes.
 *
 * How it is built (nothing hand-written where the app has a constructor):
 *   - the core files are the REAL ones (core/forms, orbits, symmetry, curves, netwarp, tiling, faces, color, facecolor, export);
 *   - the Base net is set by the REAL Netz-row code: sketch.js's initNetControls() IIFE is extracted from the source and run against a fake p5 select()/selectAll()
 *     (fake elements with the p5 methods the IIFE calls). A "click" on a kind button runs its real mousePressed handler (target().mode = kind, applyNetKindChoice(),
 *     commit()), which builds baseNetTransform through the closure's axisSpec() / setDomain() / commit(); the strength goes in through the real strengthInput.input()
 *     handler (value in percent, strength = value / 100) - the same two controls the Netz row offers (kinds Aus / Sin / Tan / Geo; strength 0.0 .. 1.0 in 0.1 steps,
 *     default 0.5; switching on from Aus applies both axes + Field);
 *   - the layers are selected through activeLayer and added through the REAL addLayerToTimeline() (+ canAddLayerToTimeline, spliceKeyframeOutOfTimeline,
 *     applyTimelineFrame, setTimelineProgress, resolveTimelineKeyframeCoords with the pairing helpers, extracted from sketch.js); Include net is the real automatic
 *     value timelineIncludeNetValue(null);
 *   - what is stubbed: the DOM-bound refresh calls (renderLayerTabs, updateOffsetControls, updateTimelineControls, redraw, setTimelineStatus (recorded), the clock).
 *
 * What it asserts: the three cases of the maintainer's use (Sinus -> Tangens, Sinus s1 -> Sinus s2, Tangens -> Sinus): netStates, timelineNetSummary, the live net at
 * 0 / 0.5 / 1 of the segment (netTransformNow() with the timeline live), the pattern morph unchanged by the net; then the whole matrix of consecutive keyframes over
 * {no net, Sinus, Tangens, Geo} (+ "no net, Include net forced on" = {regular: true}) as the recorded BASELINE of the CURRENT behaviour (accepted or REFUSED, the exact
 * message, the summary); and the refusal path (a refused second keyframe leaves the whole state as it was).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export'];
const coreSrc = f => (f === 'netwarp' && process.env.NETWARP_JS) ? fs.readFileSync(process.env.NETWARP_JS, 'utf8') : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8');
const SRC = FILES.map(coreSrc).join('\n');
const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const grab = (src, name) => { const m = src.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const NAMES = ['resolveConnectionsToCoords', 'ensureLayerMorphIds', 'applyLayerConnectionsMorphFrame', 'canAddLayerToTimeline', 'addLayerToTimeline', 'spliceKeyframeOutOfTimeline', 'totalTimelineDurationMs',
    'resolveTimelineSegment', 'applyTimelineFrame', 'setTimelineProgress', 'resolveTimelineKeyframeCoords', 'isValidPairing', 'getSegmentPairing', 'getSegmentFlips', 'applyFlipsToCoords',
    'isValidFlips', 'sanitizeMembers', 'layerGroupElements', 'memberImageLines', 'enforceNetAnimationLockout'];
const NET_IIFE = (SKETCH.match(/\(function initNetControls\(\) \{[\s\S]*?\n    \}\)\(\);/) || [''])[0];

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 160)); } };
const J = x => JSON.stringify(x);
const near = (a, b) => Math.abs(a - b) < 1e-9;

const W = 600, R = 5, ORDER = 4;

function makeSb() {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        line: () => { }, bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, stroke: () => { }, noFill: () => { }, CLOSE: 'close',
        fill: () => { }, beginShape: () => { }, vertex: () => { }, endShape: () => { },
        document: { body: {}, createElement: () => ({ style: {}, classList: { add() { }, toggle() { } }, addEventListener() { }, appendChild() { } }) },
        getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }), showNodes: true, width: W, height: W, showFaces: false,
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, activeNetWarp: null, lineColor: '#000000', altNetSeed: null,
        currentShape: 'square', shapeSizeFactor: R, nodeCount: ORDER, symmetryMode: 'none', timeline: null, activeLayer: 'base',
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null,
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb); vm.runInContext(SRC, sb);
    const g = sb.buildSquareGrid(ORDER, R, W, W); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
    sb.window = sb; sb.canvasW = W; sb.canvasH = W; sb.status = []; sb.now = 0; sb.locks = 0;
    sb.millis = () => sb.now; sb.syncAnimationLoopState = () => { }; sb.sessionFlushNow = () => { }; sb.redraw = () => { }; sb.renderLayerTabs = () => { }; sb.updateOffsetControls = () => { };
    sb.setTimelineStatus = t => sb.status.push(t); sb.setNetAnimationStatus = t => sb.status.push(t); sb.syncNetAnimationLock = () => { sb.locks++; };
    sb.updateTimelineControls = () => { sb.enforceNetAnimationLockout(); };
    sb.includeForced = false;   // the automatic value (includeNetOverride null) unless a test forces "Include net" on
    sb.timelineIncludeNet = () => (sb.includeForced ? true : sb.timelineIncludeNetValue(null));
    vm.runInContext(NAMES.map(n => grab(SKETCH, n)).join('\n'), sb);
    return sb;
}

// ---- the REAL Netz row: initNetControls() against a fake p5 select() ----
function fakeEl(dataset) {
    let val = '0', html = '';
    const cls = new Set();
    const elt = { dataset: dataset || {}, hidden: false, disabled: false, title: '', textContent: '', innerHTML: '', addEventListener() { }, dispatchEvent() { },
        classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, on) => { const want = on === undefined ? !cls.has(c) : !!on; if (want) cls.add(c); else cls.delete(c); return want; } } };
    const p = { elt, press: null, inputFn: null,
        value(v) { if (v === undefined) return val; val = String(v); return p; },
        html(s) { if (s === undefined) return html; html = s; elt.textContent = s; return p; },
        mousePressed(fn) { p.press = fn; return p; }, input(fn) { p.inputFn = fn; return p; } };
    return p;
}
function netzRow(sb) {
    const els = new Map();
    const kinds = ['regular', 'sinus', 'tangens', 'geometric'].map(k => fakeEl({ kind: k })), axes = ['both', 'x', 'y'].map(a => fakeEl({ axes: a })), domains = ['single', 'tiled', 'field'].map(d => fakeEl({ domain: d }));
    sb.select = id => { if (!els.has(id)) els.set(id, fakeEl()); return els.get(id); };
    sb.selectAll = sel => (sel === '.net-kind-btn' ? kinds : sel === '.net-axes-btn' ? axes : sel === '.net-domain-btn' ? domains : []);
    sb.UI = { toast() { } }; sb.nodeInput = null; sb.curveBtn = null; sb.freeBtn = null; sb.faceBtn = null; sb.updateCurveTypeControls = () => { };
    vm.runInContext('var adoptNetState = null; var netControlsSync = null; var netLinesOn = false;', sb);
    vm.runInContext(NET_IIFE, sb, { filename: 'sketch.js initNetControls' });
    const strength = sb.select('#net-strength-input');
    return {
        // a click on a Netz-row kind button (its real handler), then - for a kind that has a strength - the strength input at `s` (0..1, the stepper's 0.1 grid)
        set(kind, s) {
            kinds.find(b => b.elt.dataset.kind === kind).press();
            if (kind !== 'regular' && s !== undefined) { strength.value(String(Math.round(s * 100))); strength.inputFn(); }
        },
        domainOf: () => (sb.baseNetTransform ? (sb.baseNetTransform.domain || (sb.baseNetTransform.repeat ? 'tiled' : 'single')) : null),
    };
}

// ---- layers ----
const PATS = [[[1, 16], [4, 13]], [[2, 15], [3, 14]]];
function addLayer(sb, conns) {
    const g = sb.layerGrid(sb.outerCorners, sb.centroid, 'square', R, R, ORDER, 'square', W, W);
    const l = { connections: conns, redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape: 'square', symmetryMode: 'none', enabled: true, showFaces: false, nodeCount: ORDER, shapeSizeFactor: R, nodes: g.nodes, centroid: g.centroid, outerCorners: g.outerCorners };
    sb.additionalLayers.push(l);
    return sb.additionalLayers.length - 1;
}
// the maintainer's sequence: net A on the Base, layer 1, Add to Timeline, net B on the Base, layer 2, Add to Timeline
function workflow(kindA, sA, kindB, sB, o) {
    o = o || {};
    const sb = makeSb(), row = netzRow(sb);
    const l1 = addLayer(sb, PATS[0].map(c => c.slice())), l2 = addLayer(sb, PATS[1].map(c => c.slice()));
    if (!o.noNet) {
        sb.includeForced = !!o.forceA; row.set(kindA, sA); const netA = sb.baseNetTransform && J(sb.baseNetTransform);
        sb.activeLayer = l1; sb.addLayerToTimeline();
        sb.includeForced = !!o.forceB; row.set(kindB, sB);
        sb.activeLayer = l2; const before = snapshot(sb); sb.statusBefore = sb.status.length; sb.addLayerToTimeline();
        return { sb, row, l1, l2, before, netA, netB: sb.baseNetTransform && J(sb.baseNetTransform) };
    }
    sb.activeLayer = l1; sb.addLayerToTimeline(); sb.activeLayer = l2; sb.addLayerToTimeline();   // the same layers, no net at all (the pattern reference)
    return { sb, l1, l2 };
}
const snapshot = sb => J({ timeline: sb.timeline, layers: sb.additionalLayers.map(l => ({ en: l.enabled, saved: l._timelineSavedEnabled, pb: !!l.isTimelinePlayback, c: l.connections })), n: sb.additionalLayers.length, active: sb.activeLayer, net: sb.baseNetTransform });
const at = (sb, t) => { sb.setTimelineProgress(t); return sb.netTransformNow(); };
const wOf = spec => (spec && spec.x ? spec.x.w : undefined);
const morphAt = (sb, t) => { sb.setTimelineProgress(t); const pb = sb.additionalLayers[sb.timeline.playbackLayerIndex]; return J({ nodes: pb._morphNodes, connections: pb._morphConnections }); };   // the interpolated end coordinates (_morphNodes) and the id pairs they belong to

// ============ the three cases ============
console.log('== the maintainer\'s workflow: net A on the Base, layer 1, Add; net B on the Base, layer 2, Add ==');
const CASES = [
    { name: '(a) Sinus -> Tangens', a: ['sinus', 0.5], b: ['tangens', 0.5], wA: -0.5, wB: 0.5, mid: 0 },
    { name: '(b) Sinus 0.3 -> Sinus 0.9', a: ['sinus', 0.3], b: ['sinus', 0.9], wA: -0.3, wB: -0.9, mid: -0.6 },
    { name: '(c) Tangens -> Sinus', a: ['tangens', 0.5], b: ['sinus', 0.5], wA: 0.5, wB: -0.5, mid: 0 },
];
for (const c of CASES) T(c.name, () => {
    const { sb, l1, l2, netA, netB } = workflow(c.a[0], c.a[1], c.b[0], c.b[1]);
    const tl = sb.timeline;
    check(`${c.name}: the Netz row built two different nets (Field, both axes) - net A w = ${c.wA}, net B w = ${c.wB}`, netA !== netB && /"domain":"field"/.test(netA) && /"y":"same"/.test(netA) && near(JSON.parse(netA).x.w, c.wA) && near(JSON.parse(netB).x.w, c.wB), netA + ' | ' + netB);
    check(`${c.name}: the second keyframe was ACCEPTED: two keyframes (layer 1, layer 2), one segment, a playback layer`, !!tl && J(tl.keyframeLayerIds) === J([l1, l2]) && tl.segmentDurationsMs.length === 1 && tl.playbackLayerIndex !== null && sb.additionalLayers[tl.playbackLayerIndex].isTimelinePlayback === true);
    check(`${c.name}: timeline.netStates holds the two nets, each the snapshot of the Base net at its Add to Timeline`, tl.netStates.length === 2 && J(tl.netStates[0]) === netA && J(tl.netStates[1]) === netB && tl.netStates[0] !== sb.baseNetTransform && tl.netStates[1] !== sb.baseNetTransform);   // snapshots, not the live author object
    const sum = sb.timelineNetSummary();
    check(`${c.name}: timelineNetSummary = animated ("Net animated with the timeline (2 keyframes).") and the timeline is coupled`, sum.state === 'animated' && /^Net animated with the timeline \(2 keyframes\)\.$/.test(sum.text) && sb.timelineNetCoupled() === true, sum.state + ': ' + sum.text);
    const n0 = at(sb, 0), n5 = at(sb, 0.5), n1 = at(sb, 1);
    check(`${c.name}: the live net (netTransformNow() with the timeline live) at 0 / 0.5 / 1 of the segment is the lerp: w = ${c.wA} / ${c.mid} / ${c.wB}, both axes, Field kept`, near(wOf(n0), c.wA) && near(wOf(n5), c.mid) && near(wOf(n1), c.wB) && n0.y === 'same' && n5.domain === 'field', [wOf(n0), wOf(n5), wOf(n1)].join(' / '));
    check(`${c.name}: the live frames are NOT the author net (the author net stays net B, never written back)`, J(sb.baseNetTransform) === netB && J(n5) !== netB);
    // the pattern morph is the same with and without the nets (the net does not touch the pattern interpolation)
    const ref = workflow(null, null, null, null, { noNet: true }).sb;
    check(`${c.name}: the pattern morph at 0 / 0.5 / 1 is identical to the same two layers WITHOUT any net`, [0, 0.5, 1].every(t => morphAt(sb, t) === morphAt(ref, t)) && morphAt(sb, 0.5) !== morphAt(sb, 0) && morphAt(sb, 0.5) !== morphAt(sb, 1));
    check(`${c.name}: the segment readout is the frame of the clock: currentFrame = { segmentIndex 0, localT 0.5 } at the midpoint`, (at(sb, 0.5), tl.currentFrame.segmentIndex === 0 && near(tl.currentFrame.localT, 0.5)));
});

// ============ the Netz row itself ============
console.log('\n== the Netz row (the real initNetControls()) ==');
T('netz row', () => {
    const sb = makeSb(), row = netzRow(sb);
    check('before any click the Base has no net (baseNetTransform null, "Aus")', sb.baseNetTransform === null);
    row.set('sinus', 0.5);
    const a = J(sb.baseNetTransform);
    check('Sin 0.5 from Aus: a trig net, w = -0.5, both axes ("same"), Field (the defaults of switching a net on)', J(sb.baseNetTransform) === '{"x":{"kind":"trig","w":-0.5},"y":"same","repeat":false,"domain":"field"}', a);
    row.set('tangens', 0.5);
    check('Tan 0.5 afterwards: w = +0.5, the domain and axes kept (only the kind changes)', J(sb.baseNetTransform) === '{"x":{"kind":"trig","w":0.5},"y":"same","repeat":false,"domain":"field"}');
    row.set('geometric', 0.5);
    check('Geo 0.5: a geometric net, w = strength * ln 8', sb.baseNetTransform.x.kind === 'geometric' && near(sb.baseNetTransform.x.w, 0.5 * Math.log(8)));
    row.set('regular');
    check('Aus: the Base net is off again (baseNetTransform null)', sb.baseNetTransform === null);
});

// ============ the matrix ============
console.log('\n== the matrix of consecutive keyframes (first -> second), Include net automatic ==');
const KINDS = [
    { id: 'none', kind: 'regular' },
    { id: 'sinus', kind: 'sinus', s: 0.5 },
    { id: 'tangens', kind: 'tangens', s: 0.5 },
    { id: 'geo', kind: 'geometric', s: 0.5 },
    { id: 'none*', kind: 'regular', forced: true },   // no net, but "Include net" forced on: captures {regular: true}
];
function cell(a, b) {
    const sb = makeSb(), row = netzRow(sb);
    const l1 = addLayer(sb, PATS[0].map(c => c.slice())), l2 = addLayer(sb, PATS[1].map(c => c.slice()));
    sb.includeForced = !!a.forced; row.set(a.kind, a.s); sb.activeLayer = l1; sb.addLayerToTimeline();
    sb.includeForced = !!b.forced; row.set(b.kind, b.s); sb.activeLayer = l2; sb.status.length = 0; sb.addLayerToTimeline();
    const accepted = !!sb.timeline && sb.timeline.keyframeLayerIds.length === 2;
    const sum = sb.timelineNetSummary();
    return { accepted, message: sb.status.filter(Boolean).slice(-1)[0] || '', states: sb.timeline ? sb.timeline.netStates.map(s => (s ? (s.regular ? 'regular' : s.x.kind + ':' + s.x.w) : null)) : null, summary: sum ? sum.state : null };
}
const MATRIX = {};
for (const a of KINDS) for (const b of KINDS) MATRIX[a.id + ' -> ' + b.id] = cell(a, b);
if (process.env.PRINT_MATRIX) { console.log(J(MATRIX, null, 1)); process.exit(0); }
const WANT = {   // recorded from the CURRENT code (PRINT_MATRIX=1): a refusal is accepted: false with the exact message; "states" = timeline.netStates (kind:w, regular, or null = none), "summary" = timelineNetSummary().state
    "none -> none": {"accepted": true, "message": "", "states": [null, null], "summary": "none"},
    "none -> sinus": {"accepted": true, "message": "Net not animated: keyframe 1 has no net captured (use \"Net\" on the keyframe)", "states": [null, "trig:-0.5"], "summary": "partial"},
    "none -> tangens": {"accepted": true, "message": "Net not animated: keyframe 1 has no net captured (use \"Net\" on the keyframe)", "states": [null, "trig:0.5"], "summary": "partial"},
    "none -> geo": {"accepted": true, "message": "Net not animated: keyframe 1 has no net captured (use \"Net\" on the keyframe)", "states": [null, "geometric:1.0397207708399179"], "summary": "partial"},
    "none -> none*": {"accepted": true, "message": "Net not animated: keyframe 1 has no net captured (use \"Net\" on the keyframe)", "states": [null, "regular"], "summary": "partial"},
    "sinus -> none": {"accepted": true, "message": "Net not animated: keyframe 2 has no net captured (use \"Net\" on the keyframe)", "states": ["trig:-0.5", null], "summary": "partial"},
    "sinus -> sinus": {"accepted": true, "message": "", "states": ["trig:-0.5", "trig:-0.5"], "summary": "constant"},
    "sinus -> tangens": {"accepted": true, "message": "", "states": ["trig:-0.5", "trig:0.5"], "summary": "animated"},
    "sinus -> geo": {"accepted": false, "message": "Layer 2 not added: its net cannot be interpolated with Layer 1's net - the law family differs on the X axis (trig vs geometric). Only the strength and focus of a same-family law can change between keyframes.", "states": ["trig:-0.5"], "summary": "pending"},
    "sinus -> none*": {"accepted": true, "message": "", "states": ["trig:-0.5", "regular"], "summary": "animated"},
    "tangens -> none": {"accepted": true, "message": "Net not animated: keyframe 2 has no net captured (use \"Net\" on the keyframe)", "states": ["trig:0.5", null], "summary": "partial"},
    "tangens -> sinus": {"accepted": true, "message": "", "states": ["trig:0.5", "trig:-0.5"], "summary": "animated"},
    "tangens -> tangens": {"accepted": true, "message": "", "states": ["trig:0.5", "trig:0.5"], "summary": "constant"},
    "tangens -> geo": {"accepted": false, "message": "Layer 2 not added: its net cannot be interpolated with Layer 1's net - the law family differs on the X axis (trig vs geometric). Only the strength and focus of a same-family law can change between keyframes.", "states": ["trig:0.5"], "summary": "pending"},
    "tangens -> none*": {"accepted": true, "message": "", "states": ["trig:0.5", "regular"], "summary": "animated"},
    "geo -> none": {"accepted": true, "message": "Net not animated: keyframe 2 has no net captured (use \"Net\" on the keyframe)", "states": ["geometric:1.0397207708399179", null], "summary": "partial"},
    "geo -> sinus": {"accepted": false, "message": "Layer 2 not added: its net cannot be interpolated with Layer 1's net - the law family differs on the X axis (geometric vs trig). Only the strength and focus of a same-family law can change between keyframes.", "states": ["geometric:1.0397207708399179"], "summary": "pending"},
    "geo -> tangens": {"accepted": false, "message": "Layer 2 not added: its net cannot be interpolated with Layer 1's net - the law family differs on the X axis (geometric vs trig). Only the strength and focus of a same-family law can change between keyframes.", "states": ["geometric:1.0397207708399179"], "summary": "pending"},
    "geo -> geo": {"accepted": true, "message": "", "states": ["geometric:1.0397207708399179", "geometric:1.0397207708399179"], "summary": "constant"},
    "geo -> none*": {"accepted": true, "message": "", "states": ["geometric:1.0397207708399179", "regular"], "summary": "animated"},
    "none* -> none": {"accepted": true, "message": "Net not animated: keyframe 2 has no net captured (use \"Net\" on the keyframe)", "states": ["regular", null], "summary": "partial"},
    "none* -> sinus": {"accepted": true, "message": "", "states": ["regular", "trig:-0.5"], "summary": "animated"},
    "none* -> tangens": {"accepted": true, "message": "", "states": ["regular", "trig:0.5"], "summary": "animated"},
    "none* -> geo": {"accepted": true, "message": "", "states": ["regular", "geometric:1.0397207708399179"], "summary": "animated"},
    "none* -> none*": {"accepted": true, "message": "", "states": ["regular", "regular"], "summary": "constant"},
};
T('matrix', () => {
    const keys = Object.keys(MATRIX);
    check(`the matrix has ${keys.length} ordered pairs over {no net, Sinus 0.5, Tangens 0.5, Geo 0.5, no net with Include net forced on}`, keys.length === 25);
    for (const k of keys) {
        const g = MATRIX[k], w = WANT[k];
        check(`${k}: ${w.accepted ? 'ACCEPTED' : 'REFUSED'}${w.accepted ? ' (summary ' + w.summary + ')' : ' - "' + w.message.replace(/^Layer 2 not added: /, '').slice(0, 70) + '..."'}`, J(g) === J(w), J(g));
    }
    check('Sinus -> Tangens and Tangens -> Sinus are accepted (the maintainer\'s case; the acceptance test stops the series if they are not)', MATRIX['sinus -> tangens'].accepted && MATRIX['tangens -> sinus'].accepted);
    check('a pair of different law families (trig vs geometric) is a REFUSAL, in both directions', !MATRIX['sinus -> geo'].accepted && !MATRIX['geo -> sinus'].accepted && !MATRIX['tangens -> geo'].accepted && !MATRIX['geo -> tangens'].accepted && /law family differs/.test(MATRIX['sinus -> geo'].message));
});

// ============ the refusal path ============
console.log('\n== a refused second keyframe leaves everything as it was ==');
T('refusal', () => {
    const { sb, l1, l2, before } = workflow('sinus', 0.5, 'geometric', 0.5);
    const msg = sb.status.filter(Boolean).slice(-1)[0] || '';
    check('Sinus -> Geo: the second keyframe is REFUSED, visibly: "Layer 2 not added: ... law family differs on the X axis (trig vs geometric)"', /^Layer 2 not added: its net cannot be interpolated with Layer 1's net - the law family differs on the X axis \(trig vs geometric\)\./.test(msg), msg);
    check('...the timeline, the layers (enabled flags, saved flags, lines, count), the active layer and the author net are EXACTLY as before the click (deep copy compared)', snapshot(sb) === before);
    check('...so: still one keyframe, no segment, no playback layer, layer 2 still enabled, and no net state was appended', sb.timeline.keyframeLayerIds.length === 1 && sb.timeline.segmentDurationsMs.length === 0 && sb.timeline.playbackLayerIndex === null && sb.timeline.netStates.length === 1 && sb.additionalLayers[l2].enabled === true && sb.additionalLayers[l2]._timelineSavedEnabled === undefined && sb.additionalLayers.length === 2);
    check('...and the first keyframe is untouched (layer 1 hidden by the timeline, its saved state kept)', sb.additionalLayers[l1].enabled === false && sb.additionalLayers[l1]._timelineSavedEnabled === true);
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
