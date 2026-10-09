// Guard for the removed layer-area UI whose MECHANISM stays (layers, commit 1: the layer animation): source text of index.html and sketch.js, and the mechanism itself in a vm. No browser.
//   node tools/ui/test-layer-ui-removed.js
//   INDEX_HTML=... SKETCH_JS=... SESSION_APPLY_JS=... node tools/ui/test-layer-ui-removed.js        (sabotage runs)
//
// Why. The per-layer animation controls (Set Start / Set End, duration, Play, progress; offset, rotation, size and connections of ONE layer) were removed from the page: the
// Timeline morphs connections, net and colours between keyframes, and the maintainer does not use the layer animation. Like the standalone net animation (ROADMAP: "UI removed,
// mechanism kept"), the functions, the layer.animation state, the autosave writer's guard and the collector's build-size derivation STAY, unreachable from the UI. This test
// pins both halves, so that deleting the mechanism later is a conscious decision, not an accident: the ids are gone from index.html, the functions are still in sketch.js, and
// they still work (a Start / End capture, a scrub, a play to the end).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const HTML = read('INDEX_HTML', 'index.html');
const SKETCH = read('SKETCH_JS', 'sketch.js');
const APPLY = read('SESSION_APPLY_JS', 'core/session-apply.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 140)); } };

console.log('== the markup is gone ==');
const REMOVED_IDS = ['layer-animation-group', 'btn-layer-anim-set-start', 'btn-layer-anim-set-end', 'layer-anim-duration-input', 'btn-layer-anim-play', 'layer-anim-progress-input', 'layer-anim-connections-status'];
const markup = HTML.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));   // a comment may name an id
const present = REMOVED_IDS.filter(id => new RegExp('\\bid="' + id + '"').test(markup));
check('none of the layer animation ids is in index.html', present.length === 0, present.join(', ') || REMOVED_IDS.length + ' ids absent');
check('no element of index.html is labelled "Layer Animation", "Set Start" or "Set End"', !/>\s*(Layer Animation|Set Start|Set End)\s*</.test(markup));

console.log('\n== the mechanism is still in the code ==');
const topFn = (src, name) => {   // a top-level function: from "function name(" at column 0 to the closing "}" at column 0
    const m = new RegExp('^function ' + name + '\\(', 'm').exec(src);
    if (!m) return null;
    const end = src.indexOf('\n}\n', m.index);
    return end < 0 ? null : src.slice(m.index, end + 3);
};
const FUNCS = ['ensureLayerAnimation', 'setActiveLayerAnimationStart', 'setActiveLayerAnimationEnd', 'setActiveLayerAnimationDuration', 'setActiveLayerAnimationProgress', 'toggleActiveLayerAnimationPlayback',
    'applyLayerAnimationFrame', 'lerpAngleShortest', 'applyLayerConnectionsMorphFrame', 'ensureLayerMorphIds', 'resolveConnectionsToCoords', 'isAnythingAnimating', 'syncAnimationLoopState'];
const missing = FUNCS.filter(f => !topFn(SKETCH, f));
check('every mechanism function is still a top-level function of sketch.js', missing.length === 0, missing.join(', ') || FUNCS.length + ' functions');
check('syncLayerAnimationDisplay and setLayerAnimConnectionsStatus are still in setup() (and exposed on window)', /function syncLayerAnimationDisplay\(/.test(SKETCH) && /function setLayerAnimConnectionsStatus\(/.test(SKETCH) && /window\.syncLayerAnimationDisplay\s*=/.test(SKETCH) && /window\.setLayerAnimConnectionsStatus\s*=/.test(SKETCH));
check('the per-frame loop still applies a playing layer animation (draw)', /additionalLayers\.forEach\(layer => \{ if \(layer\.animation && layer\.animation\.playing\) applyLayerAnimationFrame\(layer\); \}\);/.test(SKETCH));
check('isAnythingAnimating still counts a playing layer animation, and the autosave writer is blocked by it', /l\.animation && l\.animation\.playing/.test(topFn(SKETCH, 'isAnythingAnimating') || '') && /isBlocked:\s*\(\)\s*=>\s*isAnythingAnimating\(\)/.test(SKETCH));
check('starting a layer animation still flushes the autosave first (sessionFlushNow)', /sessionFlushNow\(\);/.test(topFn(SKETCH, 'toggleActiveLayerAnimationPlayback') || ''));
check('the collector (core/session-apply.js) still derives the build size from the animation\'s start and end size', /layer\.animation\.fromShapeSizeFactor,\s*layer\.animation\.toShapeSizeFactor/.test(APPLY));
check('the lookups of the removed elements are null-safe: no bare select() of a removed id (optionalSelect only)', !new RegExp("[^l]select\\('#(" + REMOVED_IDS.join('|') + ")'\\)").test(SKETCH) && /const optionalSelect\s*=\s*sel\s*=>\s*\(document\.querySelector\(sel\)\s*\?\s*select\(sel\)\s*:\s*null\)/.test(SKETCH));

console.log('\n== the mechanism still works (the real functions, headless) ==');
T('mechanism', () => {
    const src = FUNCS.map(f => topFn(SKETCH, f)).filter(Boolean).concat([topFn(SKETCH, 'setActiveLayerAnimationStart')]).join('\n');
    let now = 1000, flushed = 0, loopSyncs = 0; const statuses = [];
    const sb = { lerp: (a, b, t) => a + (b - a) * t, millis: () => now, console, activeLayer: 0, additionalLayers: [], timeline: null, baseNetAnimation: null, animationLoopActive: false,
        loop() { }, noLoop() { }, sessionFlushNow: () => { flushed++; }, window: { setLayerAnimConnectionsStatus: m => statuses.push(m) } };
    vm.createContext(sb); vm.runInContext(src, sb);
    const node = (id, x, y) => ({ id, x, y });
    const layer = { nodes: [node(1, 0, 0), node(2, 100, 0), node(3, 0, 100), node(4, 100, 100)], connections: [[1, 2], [3, 4]], offsetX: 0, offsetY: 0, rotation: 350, shapeSizeFactor: 3 };
    sb.additionalLayers = [layer];
    const run = code => vm.runInContext(code, sb);

    run('setActiveLayerAnimationStart()');
    check('Set Start creates layer.animation and captures offset, rotation, size and the two lines', layer.animation && layer.animation.fromRotation === 350 && layer.animation.fromShapeSizeFactor === 3 && layer.animation.fromConnections.length === 2);
    layer.offsetX = 30; layer.offsetY = 40; layer.rotation = 10; layer.shapeSizeFactor = 5; layer.connections = [[1, 3], [2, 4]];
    run('setActiveLayerAnimationEnd()');
    check('Set End captures the end state and its own two lines', layer.animation.toOffsetX === 30 && layer.animation.toRotation === 10 && layer.animation.toShapeSizeFactor === 5 && layer.animation.toConnections.length === 2);

    run('setActiveLayerAnimationProgress(0.5)');
    check('scrubbing to 0.5 interpolates offset, size and the lines, and takes the SHORT way round for the rotation (350 -> 10 passes 0, not 180)', layer.offsetX === 15 && layer.offsetY === 20 && layer.shapeSizeFactor === 4 && Math.abs(layer.rotation) < 1e-9, [layer.offsetX, layer.offsetY, layer.shapeSizeFactor, layer.rotation].join(','));
    check('...and sets the morph render substitute (2 lines, 4 free nodes)', layer._morphConnections && layer._morphConnections.length === 2 && layer._morphNodes.length === 4 && layer._morphNodes.every(n => n.free));
    check('the substitute is at the middle of Start and End: the first line runs from (0,0)-(100,0) to (0,0)-(0,100) -> (0,0)-(50,50)', Math.abs(layer._morphNodes[1].x - 50) < 1e-9 && Math.abs(layer._morphNodes[1].y - 50) < 1e-9);

    // a count mismatch is refused with a message, nothing is captured
    layer.connections = [[1, 2]]; statuses.length = 0;
    run('setActiveLayerAnimationEnd()');
    check('a line count mismatch at Set End is refused and reported (not captured)', layer.animation.toConnections.length === 2 && statuses.some(m => /mismatch/i.test(m)), statuses.join('|').slice(0, 80));
    check('...but the transform fields of that refused End ARE captured (the code captures them unconditionally; only the lines are refused)', layer.animation.toShapeSizeFactor === 4);
    layer.offsetX = 30; layer.offsetY = 40; layer.rotation = 10; layer.shapeSizeFactor = 5; layer.connections = [[1, 3], [2, 4]];
    run('setActiveLayerAnimationEnd()');

    // play to the end: flushes the autosave first, loops while it plays, stops at the end
    run('setActiveLayerAnimationDuration(1000)');
    check('the duration is stored', layer.animation.durationMs === 1000);
    now = 5000; flushed = 0; layer.animation.elapsedMs = 0;
    run('toggleActiveLayerAnimationPlayback()');
    check('Play flushes the autosave BEFORE it overwrites saved layer fields, and isAnythingAnimating() is true (the writer waits)', flushed === 1 && layer.animation.playing === true && run('isAnythingAnimating()') === true);
    now = 5500; run('applyLayerAnimationFrame(additionalLayers[0])');
    check('at 500 ms of 1000 the frame is the middle again', layer.shapeSizeFactor === 4 && layer.animation.playing === true);
    now = 6200; run('applyLayerAnimationFrame(additionalLayers[0])');
    check('past the end it stops by itself at the End values and isAnythingAnimating() is false again', layer.animation.playing === false && layer.shapeSizeFactor === 5 && layer.offsetX === 30 && run('isAnythingAnimating()') === false);

    // the base is never animated
    sb.activeLayer = 'base'; const before = JSON.stringify(layer.animation);
    let threw = null; try { run('setActiveLayerAnimationStart(); setActiveLayerAnimationEnd(); toggleActiveLayerAnimationPlayback(); setActiveLayerAnimationDuration(500); setActiveLayerAnimationProgress(0.5)'); } catch (e) { threw = e.message; }
    check('with the base active the capture, play, duration and scrub do nothing (and do not throw)', threw === null && JSON.stringify(layer.animation) === before, threw || 'unchanged');
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
