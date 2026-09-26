/**
 * tools/netwarp/test-netwarp-timelinenet.js
 * Case B1: the net follows the layer-keyframe Timeline (timeline.netStates parallel to keyframeLayerIds; segment k lerps
 * netStates[k] -> netStates[k+1] with the timeline's own localT).
 *
 *   node tools/netwarp/test-netwarp-timelinenet.js
 *
 *  1. Bookkeeping: netStates stays in lockstep with keyframeLayerIds at the three mutation points (first keyframe, push, splice), with a
 *     negative control that a dropped push is caught; rebuild drops the whole timeline.
 *  2. Compatibility per adjacent pair: refused on add / re-capture, a newly adjacent incompatible pair after a removal falls back to the
 *     author net with the reason.
 *  3. The driver: the frame is the lerp of the current segment's two states at localT, continuous at segment boundaries, exact regular
 *     midpoint for opposite strengths; author net when not live; incomplete states -> not coupled, and the status says which keyframe.
 *  4. The standalone animation locks out while coupled and unlocks again.
 *  5. Author / live separation (the Stage A class) with the Timeline as the driver, incl. a negative control.
 *  6. Export: animationFrame = global progress + animationSource / segmentIndex / localT; the standalone export unchanged.
 *  7. Real pipeline: the pattern morph and the net change together on one clock.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export'];
const SRC = FILES.map(f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const SKETCH = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
const grab = (src, name) => { const m = src.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const NAMES = ['resolveConnectionsToCoords', 'ensureLayerMorphIds', 'applyLayerConnectionsMorphFrame', 'canAddLayerToTimeline', 'addLayerToTimeline', 'spliceKeyframeOutOfTimeline', 'totalTimelineDurationMs', 'resolveTimelineSegment', 'applyTimelineFrame', 'toggleTimelinePlayback', 'setTimelineProgress', 'previewTimelineSegmentMidpoint', 'enforceNetAnimationLockout', 'recaptureTimelineKeyframeNet', 'ensureNetAnimation', 'captureNetAnimationEnd', 'applyNetAnimationFrame', 'toggleNetAnimationPlayback', 'setNetAnimationProgress'];
const EXTRACT = src => NAMES.map(n => grab(src, n)).join('\n');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const W = 600;
function makeSb(src, order, sf, mode) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        line: (a, b, c, d) => sb.lines.push([a, b, c, d]), bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, stroke: () => { }, noFill: () => { }, CLOSE: 'close',
        fill: c => { sb._fill = c; }, beginShape: () => { sb._cur = []; }, vertex: (x, y) => { sb._cur.push({ x, y }); }, endShape: () => { sb.polys.push({ fill: sb._fill, pts: sb._cur }); sb._cur = null; },
        document: { body: {} }, getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }), showNodes: true, width: W, height: W, showFaces: false,
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, activeNetWarp: null, lineColor: '#000000', altNetSeed: null,
        currentShape: 'square', shapeSizeFactor: sf, nodeCount: order, symmetryMode: mode, timeline: null, activeLayer: 'base',
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, lines: [], polys: []
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb); vm.runInContext(src, sb);
    const g = sb.buildSquareGrid(order, sf, W, W); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
    return sb;
}

let seed = 6; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const R = 5, ORDER = 4;
const S = (kind, w, extra) => ({ x: { kind, w, ...(extra || {}) }, y: 'same', repeat: false });
const F = ax => ({ x: ax, y: 'same', domain: 'field' });
function mk(core, sketchSrc) {
    const sb = makeSb(core, ORDER, R, 'none');
    sb.window = sb; sb.canvasW = W; sb.canvasH = W; sb.status = []; sb.now = 0; sb.includeNet = false; sb.locks = 0;
    sb.millis = () => sb.now; sb.syncAnimationLoopState = () => { }; sb.redraw = () => { }; sb.renderLayerTabs = () => { }; sb.updateOffsetControls = () => { };
    sb.setTimelineStatus = t => sb.status.push(t); sb.setNetAnimationStatus = t => sb.status.push(t); sb.syncNetAnimationLock = () => { sb.locks++; };
    sb.updateTimelineControls = () => { sb.enforceNetAnimationLockout(); }; sb.timelineIncludeNet = () => sb.includeNet;
    vm.runInContext(EXTRACT(sketchSrc), sb);
    // the keyframe coordinate resolver depends on the pairing editor's helpers - a plain version (index pairing) is enough here
    vm.runInContext(`function resolveTimelineKeyframeCoords(timeline, i) { const a = additionalLayers[timeline.keyframeLayerIds[i]], b = additionalLayers[timeline.keyframeLayerIds[i + 1]]; return { ok: true, from: resolveConnectionsToCoords(a), to: resolveConnectionsToCoords(b) }; }`, sb);
    return sb;
}
const addLayer = (sb, conns) => { const g = sb.layerGrid(sb.outerCorners, sb.centroid, 'square', R, R, ORDER, 'square', W, W); const l = { connections: conns, redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape: 'square', symmetryMode: 'none', enabled: true, showFaces: false, nodeCount: ORDER, shapeSizeFactor: R, nodes: g.nodes, centroid: g.centroid, outerCorners: g.outerCorners }; sb.additionalLayers.push(l); return sb.additionalLayers.length - 1; };
const PATS = [[[1, 16], [4, 13]], [[2, 15], [3, 14]], [[5, 12], [8, 9]], [[6, 11], [7, 10]]];
// add a keyframe layer: sets the author net and the checkbox, returns the layer index
const addKf = (sb, i, spec, include) => { sb.baseNetTransform = spec; sb.includeNet = include; const idx = addLayer(sb, PATS[i % 4].map(c => c.slice())); sb.activeLayer = idx; sb.addLayerToTimeline(); return idx; };
const sameJ = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ============ 1. bookkeeping ============
console.log('== 1. netStates in lockstep with keyframeLayerIds ==');
{
    const sb = mk(SRC, SKETCH), specs = [F({ kind: 'trig', w: -1 }), F({ kind: 'trig', w: 0.3 }), F({ kind: 'trig', w: 1 }), F({ kind: 'trig', w: -0.5 })];
    const inc = [true, true, false, true], ids = specs.map((sp, i) => addKf(sb, i, sp, inc[i])); const tl = sb.timeline;
    const aligned = () => tl.netStates.length === tl.keyframeLayerIds.length;
    check('after each add the arrays have the same length (first keyframe creation and every push)', aligned() && tl.keyframeLayerIds.length === 4);
    check('each entry is the net captured with THAT keyframe (or null when "Include net" was off)', tl.keyframeLayerIds.every((id, k) => { const i = ids.indexOf(id); return inc[i] ? sameJ(tl.netStates[k], specs[i]) : tl.netStates[k] === null; }));
    const byLayer = new Map(tl.keyframeLayerIds.map((id, k) => [id, tl.netStates[k]]));
    let ok = true;
    for (const pos of [1, 0, 1]) {   // an inner keyframe, the first, then an inner one again
        const id = tl.keyframeLayerIds[pos]; sb.spliceKeyframeOutOfTimeline(id); byLayer.delete(id);
        if (!aligned() || !tl.keyframeLayerIds.every((lid, k) => sameJ(tl.netStates[k], byLayer.get(lid)))) ok = false;
    }
    check(`after splicing an inner, the first and an inner keyframe the arrays stay the same length and every remaining entry still belongs to its keyframe (${tl.keyframeLayerIds.length} left)`, ok);
    const BAD = SKETCH.replace('timeline.netStates.push(netState);', '/* dropped */');
    check('negative control: the push line exists (the mutation changes the source)', BAD !== SKETCH);
    const bad = mk(SRC, BAD); [0, 1, 2].forEach(i => addKf(bad, i, specs[i], true));
    check('...and with the push dropped the lockstep check fails (array shorter than keyframeLayerIds)', bad.timeline.netStates.length !== bad.timeline.keyframeLayerIds.length);
    const BAD2 = SKETCH.replace('if (timeline.netStates) timeline.netStates.splice(pos, 1);', '/* dropped */'); const b2 = mk(SRC, BAD2); [0, 1, 2].forEach(i => addKf(b2, i, specs[i], true)); b2.spliceKeyframeOutOfTimeline(b2.timeline.keyframeLayerIds[0]);
    check('negative control for the splice: a dropped splice misaligns the arrays', BAD2 !== SKETCH && b2.timeline.netStates.length !== b2.timeline.keyframeLayerIds.length);
    const state = fs.readFileSync(path.join(ROOT, 'core/state.js'), 'utf8');
    check('rebuild: the whole timeline (netStates with it) is dropped - core/state.js sets timeline = null in both rebuild paths - and the net is the author net again', (state.match(/timeline = null;/g) || []).length >= 2 && (sb.timeline = null, sb.netTransformNow()) === sb.baseNetTransform);
}

// ============ 2. compatibility ============
console.log('\n== 2. per adjacent pair ==');
{
    const sb = mk(SRC, SKETCH);
    addKf(sb, 0, F({ kind: 'trig', w: -1 }), true);
    const before = sb.timeline.keyframeLayerIds.length;
    addKf(sb, 1, S('trig', -1), true);   // single vs field: not interpolable
    check('add: an incompatible net (domain) refuses the whole add, visibly, with the reason; nothing was appended', sb.timeline.keyframeLayerIds.length === before && sb.timeline.netStates.length === before && /not added/.test(sb.status[sb.status.length - 1]) && /domain differs/.test(sb.status[sb.status.length - 1]));
    addKf(sb, 1, F({ kind: 'trig', w: 0.4 }), true); addKf(sb, 2, F({ kind: 'trig', w: 1 }), true);
    sb.baseNetTransform = F({ kind: 'geometric', w: 1 });
    sb.recaptureTimelineKeyframeNet(1);
    check('re-capture: refused when it cannot be interpolated with a neighbour (law family), the old state kept', /NOT captured/.test(sb.status[sb.status.length - 1]) && /family differs/.test(sb.status[sb.status.length - 1]) && sb.timeline.netStates[1].x.w === 0.4);
    sb.baseNetTransform = F({ kind: 'trig', w: -0.2 }); sb.recaptureTimelineKeyframeNet(1);
    check('re-capture: an interpolable net replaces the state of that keyframe only', sb.timeline.netStates[1].x.w === -0.2 && sb.timeline.netStates[0].x.w === -1 && sb.timeline.netStates[2].x.w === 1);
    // an inner keyframe removed so that the neighbours become adjacent: make them incompatible first via a third-party edit of the states
    sb.timeline.netStates[1] = F({ kind: 'trig', w: 0.1 }); sb.timeline.netStates[2] = S('trig', 0.5);   // keyframes 2 and 3 are single (as if captured before a domain change)
    sb.timeline.netStates[0] = F({ kind: 'trig', w: -1 });
    sb.spliceKeyframeOutOfTimeline(sb.timeline.keyframeLayerIds[1]);
    sb.timeline.currentFrame = { segmentIndex: 0, localT: 0.5 }; sb.timeline.netLive = true; sb.baseNetTransform = F({ kind: 'trig', w: -0.77 });
    const seg = sb.timelineNetSegment();
    check('a removal that makes two keyframes adjacent whose nets are incompatible: no interpolation, the reason is named, the author net is shown', seg.spec === null && /cannot be interpolated/.test(seg.reason) && sb.netTransformNow() === sb.baseNetTransform);
}

// ============ 3. the driver ============
console.log('\n== 3. the driver ==');
{
    const sb = mk(SRC, SKETCH), specs = [F({ kind: 'trig', w: -1 }), F({ kind: 'trig', w: 1 }), F({ kind: 'trig', w: -0.4, focus: 0.5 })];
    specs.forEach((sp, i) => addKf(sb, i, sp, true)); const tl = sb.timeline; tl.segmentDurationsMs = [2000, 4000];
    sb.baseNetTransform = F({ kind: 'trig', w: 0.61 });
    check('coupled: >= 2 keyframes and a state at every one', sb.timelineNetCoupled() === true && sb.timelineNetMissing().length === 0);
    check('not live (nothing played or scrubbed yet): the author net is what is shown', sb.netTransformNow() === sb.baseNetTransform);
    let ok = true;
    for (const [el, seg, lt] of [[0, 0, 0], [500, 0, 0.25], [1000, 0, 0.5], [1999, 0, 0.9995], [2000, 1, 0], [3000, 1, 0.25], [4000, 1, 0.5], [6000, 1, 1]]) {
        sb.setTimelineProgress(el / 6000);
        const cf = tl.currentFrame, want = sb.netLerpSpecs(tl.netStates[seg], tl.netStates[seg + 1], lt);
        if (cf.segmentIndex !== seg || Math.abs(cf.localT - lt) > 1e-9 || !sameJ(sb.netTransformNow(), sb.netLerpSpecs(tl.netStates[cf.segmentIndex], tl.netStates[cf.segmentIndex + 1], cf.localT))) ok = false;
        if (Math.abs(sb.netTransformNow().x.w - want.x.w) > 1e-9) ok = false;
    }
    check('scrubbing over both segments (unequal durations 2000 / 4000): the net is netLerpSpecs(states[seg], states[seg+1], localT) with the timeline\'s own segment and localT', ok);
    sb.setTimelineProgress(2000 / 6000 - 1e-9); const a = sb.netTransformNow().x.w; sb.setTimelineProgress(2000 / 6000 + 1e-9); const b = sb.netTransformNow().x.w;
    check(`continuous at the segment boundary: w just before ${a.toFixed(6)}, just after ${b.toFixed(6)} (both = the shared keyframe's ${tl.netStates[1].x.w})`, Math.abs(a - 1) < 1e-6 && Math.abs(b - 1) < 1e-6);
    check('...and EXACTLY: the last frame of segment k is netStates[k+1] and the first frame of k+1 is the same entry (spec-identical, the same warp)', sameJ(sb.netLerpSpecs(tl.netStates[0], tl.netStates[1], 1), sb.netLerpSpecs(tl.netStates[1], tl.netStates[2], 0)) || (() => { const fr = { c0: { x: 240, y: 240 }, v1: { x: 120, y: 0 }, v2: { x: 0, y: 120 } }, w1 = sb.makeNetWarp(sb.netLerpSpecs(tl.netStates[0], tl.netStates[1], 1), fr, 3, 5), w2 = sb.makeNetWarp(sb.netLerpSpecs(tl.netStates[1], tl.netStates[2], 0), fr, 3, 5); for (let i = 0; i < 100; i++) { const p = { x: rnd() * 600, y: rnd() * 600 }; if (!sameJ(sb.applyNetWarp(w1, p), sb.applyNetWarp(w2, p))) return false; } return true; })());
    sb.setTimelineProgress(1000 / 6000);   // mid of segment 0: sinus -1 <-> tangens +1
    const mid = sb.netTransformNow(), fr = { c0: { x: 240, y: 240 }, v1: { x: 120, y: 0 }, v2: { x: 0, y: 120 } }, wm = sb.makeNetWarp(mid, fr, 3, 5); let m = 0; for (let i = 0; i < 200; i++) { const p = { x: rnd() * 700 - 50, y: rnd() * 700 - 50 }, q = sb.applyNetWarp(wm, p); m = Math.max(m, Math.hypot(q.x - p.x, q.y - p.y)); }
    check(`the middle of a segment between opposite strengths is the EXACT regular net (identity to ${m} px)`, m === 0 && mid.x.w === 0 && mid.keep === true);
    tl.netLive = false; check('an author edit while paused (netLive off) shows the author net again, the frame is not applied', sb.netTransformNow() === sb.baseNetTransform);
    // incomplete: one keyframe without a state
    const inc = mk(SRC, SKETCH); addKf(inc, 0, F({ kind: 'trig', w: -1 }), true); addKf(inc, 1, F({ kind: 'trig', w: 1 }), false); addKf(inc, 2, F({ kind: 'trig', w: 0.2 }), true);
    inc.setTimelineProgress(0.5); inc.baseNetTransform = F({ kind: 'trig', w: 0.33 });
    check('a keyframe without a net state: not coupled, the net is not driven (author net), and the Timeline status names the keyframe', inc.timelineNetCoupled() === false && inc.timelineNetMissing().join() === '2' && inc.netTransformNow() === inc.baseNetTransform && /keyframe 2 has no net captured/.test(inc.status[inc.status.length - 1]));
    inc.baseNetTransform = F({ kind: 'trig', w: 0.33 }); inc.recaptureTimelineKeyframeNet(1);
    check('re-capturing the missing keyframe completes the coupling', inc.timelineNetCoupled() === true && inc.timelineNetMissing().length === 0);
    const none = mk(SRC, SKETCH); addKf(none, 0, F({ kind: 'trig', w: -1 }), false); addKf(none, 1, F({ kind: 'trig', w: 1 }), false);
    none.setTimelineProgress(0.5);
    check('a timeline with no net states at all behaves exactly as before: not coupled, no note', none.timelineNetCoupled() === false && none.timelineNetMissing().length === 0 && none.netTransformNow() === none.baseNetTransform && !/Net not animated/.test(none.status[none.status.length - 1]));
}

// ============ 4. standalone animation lock ============
console.log('\n== 4. the standalone animation ==');
{
    const sb = mk(SRC, SKETCH);
    sb.baseNetTransform = F({ kind: 'trig', w: -1 }); sb.captureNetAnimationEnd('from'); sb.baseNetTransform = F({ kind: 'trig', w: 1 }); sb.captureNetAnimationEnd('to'); sb.setNetAnimationProgress(0.5);
    check('before any coupling the standalone animation works (live at t = 0.5)', sb.baseNetAnimation.live && sb.netTransformNow().x.w === 0);
    addKf(sb, 0, F({ kind: 'trig', w: -1 }), true);
    check('one keyframe is not a coupling: the standalone frame still applies', sb.timelineNetCoupled() === false && sb.baseNetAnimation.live === true);
    addKf(sb, 1, F({ kind: 'trig', w: 0.6 }), true);
    check('two keyframes with states: coupled - the standalone animation is stopped and not live, and the lock is applied', sb.timelineNetCoupled() && sb.baseNetAnimation.live === false && sb.baseNetAnimation.playing === false && sb.locks > 0);
    const n0 = sb.status.length; sb.baseNetTransform = F({ kind: 'trig', w: -1 });
    check('while coupled Set Start / Set End / Play / scrub of the standalone animation are refused with "The timeline drives the net."', sb.captureNetAnimationEnd('from') === false && (sb.toggleNetAnimationPlayback(), sb.setNetAnimationProgress(0.3), true) && sb.status.slice(n0).filter(t => t === 'The timeline drives the net.').length === 3 && sb.baseNetAnimation.live === false);
    sb.timeline = null;
    check('after "Remove Timeline" (no timeline) the coupling is gone: the standalone animation works again', sb.timelineNetCoupled() === false && sb.captureNetAnimationEnd('from') === true);
}

// ============ 5. author / live separation ============
console.log('\n== 5. author net vs the Timeline frame ==');
{
    const mkPlay = (sketchSrc, coreSrc) => { const sb = mk(coreSrc || SRC, sketchSrc); [F({ kind: 'trig', w: -1 }), F({ kind: 'trig', w: 1 }), F({ kind: 'trig', w: -0.3 })].forEach((sp, i) => addKf(sb, i, sp, true)); sb.timeline.segmentDurationsMs = [1000, 1000]; sb.connections = [[1, 16]]; return sb; };
    const sb = mkPlay(SKETCH); sb.baseNetTransform = F({ kind: 'trig', w: 0.44, focus: 0.1 });
    const ref = sb.baseNetTransform, json = JSON.stringify(ref), statesJ = JSON.stringify(sb.timeline.netStates);
    sb.now = 0; sb.toggleTimelinePlayback();
    let intact = true, ws = [];
    for (let f = 0; f <= 40; f++) { sb.now = f * 50; sb.applyTimelineFrame(); sb.lines = []; sb.drawTessellation(); sb.netWarpBaseNow(); ws.push(sb.netTransformNow().x.w); if (sb.baseNetTransform !== ref || JSON.stringify(sb.baseNetTransform) !== json || JSON.stringify(sb.timeline.netStates) !== statesJ) intact = false; }
    check('over 41 frames of Timeline playback (draw + netWarpBaseNow each frame) baseNetTransform is the SAME object with the same content and the captured states are unchanged', intact && sb.timeline.netLive === true);
    check('the net actually moves during playback (w runs -1 -> 1 -> -0.3 across the two segments)', Math.abs(ws[0] + 1) < 1e-9 && ws.some(w => w > 0.9) && Math.abs(ws[ws.length - 1] + 0.3) < 1e-9, ws.filter((_, i) => i % 10 === 0).map(w => w.toFixed(2)).join(' '));
    sb.timeline.playing = true; sb.timeline.startTime = 0; sb.now = 800; sb.applyTimelineFrame();
    sb.baseNetTransform = F({ kind: 'trig', w: -0.9, focus: 0.7 });   // what the strength/focus sliders do (commit()): the author spec only
    let survived = true; for (let f = 0; f < 8; f++) { sb.now += 50; sb.applyTimelineFrame(); sb.lines = []; sb.drawTessellation(); if (!sameJ(sb.baseNetTransform, F({ kind: 'trig', w: -0.9, focus: 0.7 }))) survived = false; }
    check('an author edit during playback lands in baseNetTransform and survives 8 more frames', survived && sb.timeline.netLive);
    const at = el => { sb.timeline.playing = false; sb.setTimelineProgress(el / 2000); return JSON.stringify(sb.netTransformNow()); };
    const f1 = at(700); sb.baseNetTransform = S('geometric', 2); const f2 = at(700); sb.baseNetTransform = null; const f3 = at(700);
    check('the frame depends only on (states, segment, localT): the same time gives the same net whatever the author net is (even null)', f1 === f2 && f2 === f3);
    const BAD = SRC.replace("return timelineNetSegment().spec || baseNetTransform;", "baseNetTransform = timelineNetSegment().spec || baseNetTransform; return baseNetTransform;");
    const bad = mkPlay(SKETCH, BAD); bad.baseNetTransform = F({ kind: 'trig', w: 0.44 }); const r0 = bad.baseNetTransform, j0 = JSON.stringify(r0); bad.now = 0; bad.toggleTimelinePlayback(); bad.now = 400; bad.applyTimelineFrame(); bad.netWarpBaseNow();
    check('negative control: a netTransformNow() that wrote the Timeline frame back is caught (the author net is clobbered)', BAD !== SRC && (bad.baseNetTransform !== r0 || JSON.stringify(bad.baseNetTransform) !== j0));
}

// ============ 6. export ============
console.log('\n== 6. export ==');
{
    const sb = mk(SRC, SKETCH); [F({ kind: 'trig', w: -1 }), F({ kind: 'trig', w: 1 }), F({ kind: 'trig', w: -0.4 })].forEach((sp, i) => addKf(sb, i, sp, true)); sb.timeline.segmentDurationsMs = [1000, 3000]; sb.connections = [[1, 16], [4, 13]];
    sb.baseNetTransform = F({ kind: 'trig', w: -0.4 });
    const ex = () => JSON.parse(JSON.stringify(sb.buildExportData(null))).meta.netTransform;
    const authorEx = ex();
    check('not live: the export describes the author net and has no animation fields', authorEx.animationFrame === undefined && authorEx.animationSource === undefined);
    sb.setTimelineProgress(0.5);   // 2000 ms of 4000: segment 1, localT 1/3
    const e = ex(), want = sb.netLerpSpecs(sb.timeline.netStates[1], sb.timeline.netStates[2], 1 / 3);
    check(`live: the DRAWN frame (w = ${want.x.w.toFixed(4)}) with animationFrame = elapsed/total = 0.5, animationSource "timeline", segmentIndex 1, localT 1/3`, e.animationFrame === 0.5 && e.animationSource === 'timeline' && e.segmentIndex === 1 && Math.abs(e.localT - 1 / 3) < 1e-12 && Math.abs(e.x.w - want.x.w) < 1e-12 && e.x.w !== authorEx.x.w);
    const st = mk(SRC, SKETCH); st.connections = [[1, 16]]; st.baseNetTransform = F({ kind: 'trig', w: -1 }); st.captureNetAnimationEnd('from'); st.baseNetTransform = F({ kind: 'trig', w: 1 }); st.captureNetAnimationEnd('to'); st.setNetAnimationProgress(0.25);
    const es = JSON.parse(JSON.stringify(st.buildExportData(null))).meta.netTransform;
    check('the standalone animation export is unchanged: animationFrame = t, no animationSource', es.animationFrame === 0.25 && es.animationSource === undefined && es.segmentIndex === undefined);
}

// ============ 7. pattern and net on one clock ============
console.log('\n== 7. real pipeline: pattern and net together ==');
{
    const sb = mk(SRC, SKETCH); [F({ kind: 'trig', w: -1 }), F({ kind: 'trig', w: 1 }), F({ kind: 'trig', w: -0.6 })].forEach((sp, i) => addKf(sb, i, sp, true)); sb.timeline.segmentDurationsMs = [2000, 2000];
    const cap = t => { sb.setTimelineProgress(t); const calls = [], orig = sb.drawCurvedBezier; sb.drawCurvedBezier = function (p1, p2, ct, a, b) { const i0 = sb.lines.length; orig.call(this, p1, p2, ct, a, b); calls.push({ a: { x: p1.x, y: p1.y }, from: i0 }); }; sb.lines = []; sb.drawTessellation(); sb.drawCurvedBezier = orig; const W_ = sb.netWarpBaseNow(); let worst = 0; calls.forEach(c => { const A = sb.applyNetWarp(W_, c.a), l = sb.lines[c.from]; worst = Math.max(worst, Math.hypot(l[0] - A.x, l[1] - A.y)); }); return { w: sb.netTransformNow().x.w, regularFirst: calls[0].a, worst, n: calls.length, conns: JSON.stringify(sb.additionalLayers[sb.timeline.playbackLayerIndex]._morphConnections) }; };
    const fr = [0, 0.125, 0.25, 0.375, 0.5, 0.75, 1].map(cap);
    console.log('   t -> net w / first regular endpoint:', fr.map((f, i) => `${[0, 0.125, 0.25, 0.375, 0.5, 0.75, 1][i]}: ${f.w.toFixed(2)} @ (${f.regularFirst.x.toFixed(0)},${f.regularFirst.y.toFixed(0)})`).join(' | '));
    check('every drawn segment starts at F(regular endpoint) of THAT frame\'s net (0 px), at every sampled time', fr.every(f => f.worst < 1e-9 && f.n > 0));
    check('the net changes between frames while the pattern morphs (net w and the morphing regular endpoints both differ)', new Set(fr.map(f => f.w.toFixed(6))).size >= 5 && new Set(fr.map(f => f.regularFirst.x.toFixed(3) + ',' + f.regularFirst.y.toFixed(3))).size >= 4);
    check('the net is continuous across the segment boundary at t = 0.5 (w = 1, the shared keyframe) while the pattern also passes through its keyframe there', Math.abs(fr[4].w - 1) < 1e-9 && Math.abs(cap(0.5 - 1e-7).w - cap(0.5 + 1e-7).w) < 1e-5);
}

// ============ 8. the persistent indicator, the default and the warning condition (the seven cases of the visibility investigation) ============
console.log('\n== 8. indicator states, automatic default, warning, separator ==');
{
    const A = F({ kind: 'trig', w: -1 }), B = F({ kind: 'trig', w: 1 });
    const build = (a, b) => { const sb = mk(SRC, SKETCH); sb.baseNetTransform = a.spec; sb.includeNet = a.inc; const i0 = addLayer(sb, PATS[0].map(c => c.slice())); sb.activeLayer = i0; sb.addLayerToTimeline(); sb.baseNetTransform = b.spec; sb.includeNet = b.inc; const i1 = addLayer(sb, PATS[1].map(c => c.slice())); sb.activeLayer = i1; sb.addLayerToTimeline(); return sb; };
    const state = sb => { const r = sb.timelineNetSummary(); return r && r.state; };
    check('S1 (net captured at both keyframes, different nets): animated (green)', state(build({ spec: A, inc: true }, { spec: B, inc: true })) === 'animated');
    const v1 = build({ spec: A, inc: false }, { spec: B, inc: false });
    check('V1 (never included): "none" - the loud state, and the text tells what to do', state(v1) === 'none' && /NOT animated: no keyframe has a net/.test(v1.timelineNetSummary().text) && /Include net/.test(v1.timelineNetSummary().text));
    const v2 = build({ spec: A, inc: false }, { spec: B, inc: true });
    check('V2 (only keyframe 2 has a net): "partial", naming keyframe 1', state(v2) === 'partial' && /keyframe 1 has no net/.test(v2.timelineNetSummary().text));
    check('V3 (included, the same net twice): "constant" (informational)', state(build({ spec: A, inc: true }, { spec: A, inc: true })) === 'constant');
    check('V4 (included, both regular): "constant"', state(build({ spec: null, inc: true }, { spec: null, inc: true })) === 'constant');
    const v5 = build({ spec: A, inc: false }, { spec: B, inc: false }); v5.baseNetTransform = B; v5.recaptureTimelineKeyframeNet(0); v5.recaptureTimelineKeyframeNet(1);
    check('V5 ("Net" on both rows without changing the net): "constant" - not silent any more', state(v5) === 'constant');
    const v6 = build({ spec: A, inc: false }, { spec: B, inc: false }); v6.baseNetTransform = A; v6.recaptureTimelineKeyframeNet(0); v6.baseNetTransform = B; v6.recaptureTimelineKeyframeNet(1);
    check('V6 ("Net" on row 1, change the net, "Net" on row 2): animated', state(v6) === 'animated');
    const one = mk(SRC, SKETCH); one.baseNetTransform = A; one.includeNet = true; one.activeLayer = addLayer(one, PATS[0].map(c => c.slice())); one.addLayerToTimeline();
    check('a single keyframe with a net: "pending" (waiting for the second), never "animated"', state(one) === 'pending' && state(mk(SRC, SKETCH)) === null);
    const inc = mk(SRC, SKETCH); [F({ kind: 'trig', w: -1 }), F({ kind: 'trig', w: 0.4 }), S('trig', 0.5)].forEach((sp, i) => addKf(inc, i, sp, true));   // the third add is refused (domain) -> only two keyframes
    inc.timeline.netStates[1] = F({ kind: 'trig', w: 0.4 }); inc.timeline.keyframeLayerIds.push(99); inc.timeline.netStates.push(S('trig', 0.5));
    check('an incompatible adjacent pair: "incompatible", naming the two keyframes and the reason', state(inc) === 'incompatible' && /keyframes 2 and 3/.test(inc.timelineNetSummary().text) && /domain differs/.test(inc.timelineNetSummary().text));
    // automatic default and the toggle
    const d = mk(SRC, SKETCH);
    d.baseNetTransform = A; const on1 = d.timelineIncludeNetValue(null); d.baseNetTransform = null; const off1 = d.timelineIncludeNetValue(null);
    check('default: ON while a net warp is active, OFF for a regular net', on1 === true && off1 === false);
    d.baseNetTransform = A; d.currentShape = 'triangle';
    check('default: OFF for a shape the warp does not apply to (a spec alone is not an active warp)', d.timelineIncludeNetValue(null) === false); d.currentShape = 'square';
    check('an explicit choice wins over the automatic value: on without a warp, off with one', (d.baseNetTransform = null, d.timelineIncludeNetValue(true)) === true && (d.baseNetTransform = A, d.timelineIncludeNetValue(false)) === false);
    d.baseNetTransform = A;
    check('toggle: from automatic-on it turns off (an override); from off back to on returns to automatic (null)', d.timelineIncludeNetToggle(null) === false && d.timelineIncludeNetToggle(false) === null);
    d.baseNetTransform = null;
    check('toggle: from automatic-off it turns on (an override); back off returns to automatic', d.timelineIncludeNetToggle(null) === true && d.timelineIncludeNetToggle(true) === null);
    // the warning condition = (author warp active) && !(shown value)
    const warn = (spec, ov) => { d.baseNetTransform = spec; return d.netAuthorWarpActive() && !d.timelineIncludeNetValue(ov); };
    check('warning condition: only when a warp is active AND the toggle is off (automatic never warns; a chosen "off" with a warp does; no warp never does)', warn(A, null) === false && warn(A, false) === true && warn(A, true) === false && warn(null, false) === false && warn(null, null) === false);
    // the stray separator
    const two = build({ spec: A, inc: false }, { spec: B, inc: true });   // one segment, keyframe 1 without a net
    two.setTimelineProgress(0.3); const st2 = two.status[two.status.length - 1];
    check('one segment: the net note has no stray leading " | "', /^Net not animated/.test(st2) && !/^\s*\|/.test(st2), st2);
    const three = mk(SRC, SKETCH); [A, B, F({ kind: 'trig', w: 0.2 })].forEach((sp, i) => addKf(three, i, sp, i !== 1)); three.setTimelineProgress(0.3); const st3 = three.status[three.status.length - 1];
    check('several segments: the note follows the segment text with " | "', /^Segment 1\/2 \(Layer 1 .+ Layer 2\) \| Net not animated/.test(st3), st3);
    // wiring
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    check('the include control is a .layer-btn button (not a label + checkbox, which style.css hides inside a control group); the indicator and the warning are divs', /<button id="btn-timeline-include-net" class="layer-btn"/.test(html) && !/type="checkbox"/.test(html.slice(html.indexOf('id="timeline-group"'), html.indexOf('id="timeline-group"') + 3000)) && /<div id="timeline-net-state"/.test(html) && /<div id="timeline-net-warning"/.test(html) && css.length > 0);
    check('index.html keeps NO label element inside the timeline group that the control depends on', !/<div class="control-group" id="timeline-group">[\s\S]*?<label[^>]*timeline-include/.test(html));
    check('sketch.js: the toggle, the indicator and the warning are synced from updateTimelineControls(), the net commit() and draw()', /syncTimelineNetUi\(\);\n    \}\n    window\.updateTimelineControls/.test(SKETCH) && /window\.syncTimelineNetUi\) window\.syncTimelineNetUi\(\);   \/\/ the automatic/.test(SKETCH) && /applyNetAnimationFrame\(\);[^\n]*\n    if \(window\.syncTimelineNetUi\)/.test(SKETCH));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
