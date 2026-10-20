// Guard for the two exposures of the cleanup (step 1) and for what they made possible (step 3): layerApi.toggleIncludeNet and layerApi.moreState no longer go through hidden old elements, and
// the old elements' handlers and writes are gone from sketch.js. Source text of sketch.js and ui-layers.js, and the real code of sketch.js (extracted) in a vm with NO old element in the DOM. No browser.
//   node tools/ui/test-layer-api.js
//   SKETCH_JS=... UI_LAYERS_JS=... NETWARP_JS=... UI_DIR=<a folder with copies of the ui*.js and nav.js> node tools/ui/test-layer-api.js        (sabotage runs)
//
// What it pins.
//   toggleIncludeNet  runs the two statements the old handler of #btn-timeline-include-net runs (includeNetOverride = timelineIncludeNetToggle(includeNetOverride); window.syncTimelineNetUi();) and
//                     needs no button: it used to dispatch a mousedown on the hidden old one and threw without it. The old handler of the hidden button is gone (step 3).
//   moreState         { open: layerMoreOpen, dot: layerMoreDot() }; layerMoreDot() is the ONE place that computes the dot (layerHasNonDefaultSettings of the active layer against the base's current
//                     shape, symmetry mode, node count and size), and syncLayerMore writes the old toggle's has-state from the same function.
//   syncLayerMore     writes #layer-more-panel.hidden and nothing else: no #layer-more-row, no #btn-more-layer (it used to return early unless all three existed, and wrote their hidden /
//                     aria-expanded / has-state until step 3).
//   ui-layers.js      readState takes the open / dot state from layerApi.moreState() (closed, no dot while layerApi is missing); see test-layer-table.js for the views.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const SKETCH = read('SKETCH_JS', 'sketch.js'), LAYERS = read('UI_LAYERS_JS', 'ui-layers.js'), NETWARP = read('NETWARP_JS', 'core/netwarp.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 160)); } };
const J = x => JSON.stringify(x);

// the text from `head` up to and including its matching closing brace (the first { after head opens it)
function braced(src, head) {
    const i = src.indexOf(head); if (i < 0) return null;
    let d = 0, j = src.indexOf('{', i);
    for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); }
    return null;
}
const lineOf = (src, head) => { const i = src.indexOf(head); if (i < 0) return null; const e = src.indexOf('\n', i); return src.slice(i, e < 0 ? undefined : e); };

const OLD_HANDLER_LINE = lineOf(SKETCH, 'if (includeNetBtn) includeNetBtn.mousePressed(');
const API_BLOCK = (() => { const a = SKETCH.indexOf('    // layerApi: begin'), b = SKETCH.indexOf('    // layerApi: end\n'); return a >= 0 && b > a ? SKETCH.slice(a, b) : ''; })();
const API_LINE = name => { const m = API_BLOCK.match(new RegExp('^        ' + name + '\\([^)]*\\) \\{(.*)\\},$', 'm')); return m ? m[1].trim() : null; };

// ================= 1. the source =================
console.log('== the source ==');
T('source', () => {
    const body = API_LINE('toggleIncludeNet');
    check('toggleIncludeNet is exactly the two statements: includeNetOverride = timelineIncludeNetToggle(includeNetOverride); window.syncTimelineNetUi();', body === 'includeNetOverride = timelineIncludeNetToggle(includeNetOverride); window.syncTimelineNetUi();', body);
    const oldBody = OLD_HANDLER_LINE && (OLD_HANDLER_LINE.match(/mousePressed\(\(\) => \{(.*)\}\);\s*$/) || [])[1];
    check('the old Include net handler is gone: no includeNetBtn variable, no select of #btn-timeline-include-net, no mousePressed binding for it', !/includeNetBtn|btn-timeline-include-net/.test(SKETCH) && OLD_HANDLER_LINE === null, OLD_HANDLER_LINE);
    check('toggleIncludeNet does not touch the DOM: no includeNetBtn, no dispatchEvent, no MouseEvent in the layerApi block', !/includeNetBtn|dispatchEvent|MouseEvent/.test(API_BLOCK));
    check('moreState is { open: layerMoreOpen, dot: layerMoreDot() } (a getter: it writes nothing)', API_LINE('moreState') === 'return { open: layerMoreOpen, dot: layerMoreDot() };', API_LINE('moreState'));
    const code = SKETCH.replace(/\/\/[^\n]*/g, '');
    check('the dot rule lives in ONE function: layerHasNonDefaultSettings( is called once inside setup(), in layerMoreDot, which moreState uses; syncLayerMore writes no dot any more', (code.slice(code.indexOf('function setup()')).match(/layerHasNonDefaultSettings\(/g) || []).length === 1 && /function layerMoreDot\(\) \{[^}]*layerHasNonDefaultSettings\(additionalLayers\[activeLayer\], \{ shape: currentShape, symmetryMode, nodeCount, shapeSizeFactor \}\)/.test(code) && !/needsDot|has-state/.test(braced(code, 'function syncLayerMore()') || 'x'));
    const sync = braced(code, 'function syncLayerMore()') || '';
    check('syncLayerMore writes the PANEL only: it returns without #layer-more-panel and otherwise sets its hidden flag; no #layer-more-row, no #btn-more-layer, no aria-expanded, no has-state', /^function syncLayerMore\(\) \{\s*if \(!layerMorePanel\) return;\s*const showPanel = activeLayer !== 'base' && !!additionalLayers\[activeLayer\] && layerMoreOpen;\s*if \(layerMorePanel\.hidden === showPanel\) layerMorePanel\.hidden = !showPanel;\s*\}$/.test(sync) && !/layerMoreRow|layerMoreBtn|aria-expanded|has-state/.test(code));
    const rs = braced(LAYERS.replace(/\/\/[^\n]*/g, ''), 'function readState()') || '';
    check('ui-layers.js readState takes the Mehr state from api().moreState() and tolerates a missing layerApi; it never looks up #btn-more-layer', /const a = api\(\), more = a && a\.moreState \? a\.moreState\(\) : null/.test(rs) && /moreOpen: !!\(more && more\.open\)/.test(rs) && /moreDot: !!\(more && more\.dot\)/.test(rs) && !/btn-more-layer/.test(LAYERS.replace(/\/\/[^\n]*/g, '')));
    check('no block comment inside setup() (p5\'s friendly-error reader); the new code adds a function layerMoreDot and a const needsDot, no p5-member name',!/\/\*/.test(braced(SKETCH, 'function setup()') || '/*'));
});

// ================= 2. toggleIncludeNet in a vm, no old button anywhere =================
console.log('\n== toggleIncludeNet runs without any old element ==');
function includeEnv() {
    const ctx = vm.createContext({ console });
    ctx.window = ctx; ctx.syncs = 0; ctx.document = { getElementById: () => null, querySelector: () => null };   // NO #btn-timeline-include-net in the document
    ctx.baseNetTransform = null;
    vm.runInContext(braced(NETWARP, 'function netAuthorWarpActive()') || 'throw new Error("netAuthorWarpActive not found")', ctx);
    // netAuthorWarpActive() reads the real net state (netWarpForBase ...): replace it by a switch the test owns, keep the REAL value and toggle functions of core/netwarp.js
    vm.runInContext('var authorActive = false; function netAuthorWarpActive() { return authorActive; }', ctx);
    vm.runInContext(lineOf(NETWARP, 'function timelineIncludeNetValue(') + '\n' + lineOf(NETWARP, 'function timelineIncludeNetToggle('), ctx);
    vm.runInContext('var includeNetOverride = null; window.syncTimelineNetUi = function () { syncs++; };', ctx);
    const body = API_LINE('toggleIncludeNet');
    ctx.toggle = vm.runInContext('(function () { ' + body + ' })', ctx);
    return ctx;
}
T('toggle', () => {
    let c = includeEnv();
    const run = (active, steps) => { c.authorActive = active; vm.runInContext('includeNetOverride = null; syncs = 0;', c); const seen = []; for (let i = 0; i < steps; i++) { c.toggle(); seen.push([vm.runInContext('includeNetOverride', c), vm.runInContext('timelineIncludeNetValue(includeNetOverride)', c)]); } return seen; };
    check('no net active: automatic (null, shown off) -> true (on) -> back to automatic (null, off)', J(run(false, 3)) === J([[true, true], [null, false], [true, true]]), J(run(false, 3)));
    check('a net active: automatic (null, shown on) -> false (off) -> back to automatic (null, on)', J(run(true, 3)) === J([[false, false], [null, true], [false, false]]), J(run(true, 3)));
    run(false, 4);
    check('every toggle calls window.syncTimelineNetUi() once (the strip, the dot and the old button follow)', vm.runInContext('syncs', c) === 4);
    // the old handler's own statements give the same trace, step by step, including a net that appears and goes mid-way
    // the reference: the two statements the old handler ran (copied from the commit before step 3), as a function of its own
    const oldToggle = vm.runInContext('(function () { includeNetOverride = timelineIncludeNetToggle(includeNetOverride); window.syncTimelineNetUi(); })', c);
    const trace = fn => { vm.runInContext('includeNetOverride = null;', c); const t = []; [false, false, true, true, false, true, true, false].forEach(a => { c.authorActive = a; fn(); t.push(vm.runInContext('includeNetOverride', c)); }); return t; };
    check('the new body and the reference (the old handler\'s statements) give the identical override trace over eight steps with the net appearing and going (null, true, false, null all reached)', J(trace(c.toggle)) === J(trace(oldToggle)) && new Set(trace(c.toggle).map(String)).size === 3, J(trace(c.toggle)));
    check('there is no document element for it to need: the vm document returns null for every id and nothing threw', c.document.getElementById('btn-timeline-include-net') === null);
});

// ================= 3. moreState and syncLayerMore in a vm =================
console.log('\n== moreState and syncLayerMore ==');
function moreEnv(o) {
    o = o || {};
    const ctx = vm.createContext({ console });
    ctx.window = ctx;
    const el = (hidden) => ({ hidden });
    ctx.layerMorePanel = o.noPanel ? null : el(true);
    ctx.layerMoreOpen = false; ctx.activeLayer = 'base'; ctx.currentShape = 'square'; ctx.symmetryMode = 'rotation_reflection6'; ctx.nodeCount = 4; ctx.shapeSizeFactor = 3;
    ctx.additionalLayers = [{ shape: 'square', symmetryMode: 'rotation_reflection6', nodeCount: 4, shapeSizeFactor: 3, offsetX: 0, offsetY: 0, rotation: 0 }];
    vm.runInContext(braced(SKETCH, 'function layerHasNonDefaultSettings(') + '\n' + braced(SKETCH, 'function layerMoreDot()') + '\n' + braced(SKETCH, 'function syncLayerMore()'), ctx);
    ctx.api = vm.runInContext('({ moreState() { ' + API_LINE('moreState') + ' } })', ctx);
    return ctx;
}
T('more', () => {
    const c = moreEnv();
    const st = () => J(c.api.moreState());
    check('moreState: base active, closed -> { open: false, dot: false }', st() === J({ open: false, dot: false }));
    c.layerMoreOpen = true;
    check('...open (the variable layerMoreOpen) -> open: true, whatever the sheet', st() === J({ open: true, dot: false }));
    c.layerMoreOpen = false; c.activeLayer = 0;
    check('a layer active with the base\'s own shape, symmetry, node count and size, no offset, no rotation -> dot: false', st() === J({ open: false, dot: false }));
    const L = c.additionalLayers[0];
    const dots = []; [['offsetX', 5], ['offsetY', -2], ['rotation', 30], ['shape', 'hexagon'], ['symmetryMode', 'rotation3'], ['nodeCount', 5], ['shapeSizeFactor', 2]].forEach(([k, v]) => { const was = L[k]; L[k] = v; dots.push(c.api.moreState().dot); L[k] = was; });
    check('each of the seven non-default settings (offset X, offset Y, rotation, shape, symmetry mode, node count, size) -> dot: true, and false again when reset', J(dots) === J([true, true, true, true, true, true, true]) && st() === J({ open: false, dot: false }), J(dots));
    c.activeLayer = 7;
    check('an active index without a layer, or the base active, has no dot even if a layer differs', st() === J({ open: false, dot: false }) && (c.activeLayer = 'base', L.offsetX = 9, st() === J({ open: false, dot: false })));
    L.offsetX = 0;
    // syncLayerMore: the panel only
    c.activeLayer = 0; c.layerMoreOpen = true; c.syncLayerMore();
    check('syncLayerMore: a layer active and "Mehr" open -> the panel is shown (hidden false)', c.layerMorePanel.hidden === false);
    c.layerMoreOpen = false; c.syncLayerMore();
    check('...closed -> hidden again', c.layerMorePanel.hidden === true);
    c.layerMoreOpen = true; c.activeLayer = 'base'; c.syncLayerMore();
    check('...open but the base active -> hidden (the wrapper does not show an empty block)', c.layerMorePanel.hidden === true);
    c.activeLayer = 7; c.syncLayerMore();
    check('...an index without a layer -> hidden', c.layerMorePanel.hidden === true);
    c.activeLayer = 0; c.syncLayerMore(); c.syncLayerMore();
    check('...writes only on a change (a second call with the same state keeps it shown)', c.layerMorePanel.hidden === false);
    const noPanel = moreEnv({ noPanel: true }); let threw = null; try { noPanel.activeLayer = 0; noPanel.layerMoreOpen = true; noPanel.syncLayerMore(); } catch (e) { threw = e; }
    check('without the panel itself it returns quietly (nothing to write)', !threw);
});

// ================= 4. no removed element is selected, read or written any more (cleanup step 3) =================
console.log('\n== the removed elements are not touched by sketch.js or the ui scripts ==');
T('removed', () => {
    const REMOVED = ['layer-row-group', 'layer-row', 'btn-layer-base', 'layer-tabs', 'btn-add-layer', 'paste-pattern-status', 'layer-more-row', 'btn-more-layer', 'layer-node-count-note',
        'align-to-base-status', 'btn-add-to-timeline', 'btn-timeline-include-net', 'btn-remove-timeline', 'timeline-playback-controls', 'btn-timeline-play', 'timeline-progress-input',
        'timeline-net-warning', 'net-free-note', 'net-field-note', 'net-macro-note'];
    const VARS = ['layerBaseBtn', 'layerTabsContainer', 'addLayerBtn', 'includeNetBtn', 'removeTimelineBtn', 'timelinePlaybackControls', 'timelinePlayBtn', 'timelineProgressInput', 'addToTimelineBtn',
        'layerMoreRow', 'layerMoreBtn', 'syncTimelineDisplay'];
    const noComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
    const scripts = { 'sketch.js': SKETCH };
    ['ui.js', 'ui-layers.js', 'ui-layer.js', 'ui-timeline.js', 'ui-rail.js', 'ui-net.js', 'ui-form.js', 'ui-farbe.js', 'nav.js'].forEach(f => { const q = path.join(process.env.UI_DIR || ROOT, f); if (fs.existsSync(q)) scripts[f] = fs.readFileSync(q, 'utf8'); });
    const hits = [];
    Object.entries(scripts).forEach(([f, src]) => { const code = noComments(src); REMOVED.forEach(id => { if (code.includes(id)) hits.push(f + ': ' + id); }); });
    check('none of the ' + REMOVED.length + ' removed ids appears in the code (comments aside) of sketch.js or any ui script: no select(), getElementById(), querySelector(), no string', hits.length === 0, hits.join(', ') || REMOVED.length + ' ids absent');
    const code = noComments(SKETCH), vhits = VARS.filter(v => new RegExp('\\b' + v + '\\b').test(code));
    check('none of the ' + VARS.length + ' variables and functions that served them is left in sketch.js (the Include net button, the old Play, the old progress input, the old tabs, the old toggle, syncTimelineDisplay)', vhits.length === 0, vhits.join(', ') || VARS.length + ' absent');
});

// ================= 5. what stays of the old timeline code (cleanup step 3) =================
console.log('\n== what the cleanup keeps: the net status line and updateTimelineControls ==');
T('kept', () => {
    // syncTimelineNetUi: the ONE writer of #timeline-net-state; extracted and run with a fake element and a summary the test owns
    const i = SKETCH.indexOf('window.syncTimelineNetUi = () => {'), j = SKETCH.indexOf('\n    };', i);
    check('window.syncTimelineNetUi is found (an arrow function in setup())', i > 0 && j > i);
    const text = SKETCH.slice(i, j + 7);
    const c = vm.createContext({ console }); c.window = c; c.summary = null; c.netUiSig = null;
    c.timelineNetSummary = () => c.summary;
    c.netStateEl = { elt: { hidden: true, dataset: {} }, writes: 0, html(t) { this.writes++; this.text = t; } };
    vm.runInContext(text, c);
    const run = () => c.window.syncTimelineNetUi();
    run();
    check('no summary: the line is hidden', c.netStateEl.elt.hidden === true && c.netStateEl.writes === 0);
    c.summary = { state: 'animated', text: 'Net: animated' }; run();
    check('a summary: the line is shown with its text and data-state', c.netStateEl.elt.hidden === false && c.netStateEl.text === 'Net: animated' && c.netStateEl.elt.dataset.state === 'animated');
    const w = c.netStateEl.writes; run(); run();
    check('an unchanged summary writes nothing again (the signature)', c.netStateEl.writes === w);
    c.summary = { state: 'partial', text: 'Net: partial' }; run();
    check('a changed summary is written again', c.netStateEl.text === 'Net: partial' && c.netStateEl.elt.dataset.state === 'partial' && c.netStateEl.writes === w + 1);
    c.summary = null; run();
    check('the summary going away hides the line again', c.netStateEl.elt.hidden === true);
    // updateTimelineControls: what it still does, in order
    const body = braced(SKETCH, 'function updateTimelineControls()') || '';
    const calls = body.split('\n').map(l => l.trim()).filter(Boolean).slice(1, -1);
    check('updateTimelineControls keeps exactly: the keyframe list\'s hidden flag, the keyframe list, the pairing editor, the net animation lockout and the net status line', J(calls) === J(['const hasTimeline = !!timeline;', 'if (timelineKeyframeList) timelineKeyframeList.elt.hidden = !hasTimeline;', 'renderTimelineKeyframeList();', 'renderTimelinePairingEditor();', 'enforceNetAnimationLockout();   // Case B1: the standalone net animation locks/unlocks with the coupling', 'if (window.syncTimelineNetUi) window.syncTimelineNetUi();']), J(calls));
    check('renderLayerTabs does nothing: an empty function the callers and the session restore still name (it is exported on window)', /function renderLayerTabs\(\) \{ \}/.test(SKETCH) && /window\.renderLayerTabs = renderLayerTabs;/.test(SKETCH));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
