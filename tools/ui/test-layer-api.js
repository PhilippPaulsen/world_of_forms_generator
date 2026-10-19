// Guard for the two exposures of the cleanup (commit A): layerApi.toggleIncludeNet and layerApi.moreState no longer go through hidden old elements. Source text of sketch.js and ui-layers.js, and the
// real code of sketch.js (extracted) in a vm with NO old element in the DOM. No browser.
//   node tools/ui/test-layer-api.js
//   SKETCH_JS=... UI_LAYERS_JS=... NETWARP_JS=... node tools/ui/test-layer-api.js        (sabotage runs)
//
// What it pins.
//   toggleIncludeNet  runs the two statements the old handler of #btn-timeline-include-net runs (includeNetOverride = timelineIncludeNetToggle(includeNetOverride); window.syncTimelineNetUi();) and
//                     needs no button: it used to dispatch a mousedown on the hidden old one and threw without it. The old handler stays bound (it goes in a later step), with the same two statements.
//   moreState         { open: layerMoreOpen, dot: layerMoreDot() }; layerMoreDot() is the ONE place that computes the dot (layerHasNonDefaultSettings of the active layer against the base's current
//                     shape, symmetry mode, node count and size), and syncLayerMore writes the old toggle's has-state from the same function.
//   syncLayerMore     writes #layer-more-panel.hidden without #layer-more-row and without #btn-more-layer (it used to return early unless all three existed); while the old row and toggle exist it
//                     still writes their hidden / aria-expanded / has-state, so nothing changes visibly yet.
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
    check('...the SAME two statements the old handler runs (the old handler is still bound, untouched, to the hidden button until the later step)', !!oldBody && oldBody.trim() === body, oldBody && oldBody.trim());
    check('toggleIncludeNet does not touch the DOM: no includeNetBtn, no dispatchEvent, no MouseEvent in the layerApi block', !/includeNetBtn|dispatchEvent|MouseEvent/.test(API_BLOCK));
    check('moreState is { open: layerMoreOpen, dot: layerMoreDot() } (a getter: it writes nothing)', API_LINE('moreState') === 'return { open: layerMoreOpen, dot: layerMoreDot() };', API_LINE('moreState'));
    const code = SKETCH.replace(/\/\/[^\n]*/g, '');
    check('the dot rule lives in ONE function: layerHasNonDefaultSettings( is called once inside setup(), in layerMoreDot, and syncLayerMore uses layerMoreDot()', (code.slice(code.indexOf('function setup()')).match(/layerHasNonDefaultSettings\(/g) || []).length === 1 && /function layerMoreDot\(\) \{[^}]*layerHasNonDefaultSettings\(additionalLayers\[activeLayer\], \{ shape: currentShape, symmetryMode, nodeCount, shapeSizeFactor \}\)/.test(code) && /const needsDot = layerMoreDot\(\);/.test(code));
    const sync = braced(code, 'function syncLayerMore()') || '';
    check('syncLayerMore returns early only without the PANEL: no early return on #layer-more-row or #btn-more-layer, the row and the toggle are written only while they exist', /^function syncLayerMore\(\) \{\s*if \(!layerMorePanel\) return;/.test(sync) && !/\|\|\s*!layerMoreBtn|!layerMoreRow\s*\|\|/.test(sync) && /if \(layerMoreRow && layerMoreRow\.hidden === layerActive\)/.test(sync) && /if \(!layerMoreBtn\) return;/.test(sync));
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
    const oldBody = (OLD_HANDLER_LINE.match(/mousePressed\(\(\) => \{(.*)\}\);\s*$/) || [])[1];
    const oldToggle = vm.runInContext('(function () { ' + oldBody + ' })', c);
    const trace = fn => { vm.runInContext('includeNetOverride = null;', c); const t = []; [false, false, true, true, false, true, true, false].forEach(a => { c.authorActive = a; fn(); t.push(vm.runInContext('includeNetOverride', c)); }); return t; };
    check('the new body and the old handler give the identical override trace over eight steps with the net appearing and going (null, true, false, null all reached)', J(trace(c.toggle)) === J(trace(oldToggle)) && new Set(trace(c.toggle).map(String)).size === 3, J(trace(c.toggle)));
    check('there is no document element for it to need: the vm document returns null for every id and nothing threw', c.document.getElementById('btn-timeline-include-net') === null);
});

// ================= 3. moreState and syncLayerMore in a vm =================
console.log('\n== moreState and syncLayerMore ==');
function moreEnv(o) {
    o = o || {};
    const ctx = vm.createContext({ console });
    ctx.window = ctx;
    const el = (hidden) => { const cls = new Set(); return { hidden, attrs: {}, classList: { contains: c => cls.has(c), toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); } }, getAttribute(a) { return a in this.attrs ? this.attrs[a] : null; }, setAttribute(a, v) { this.attrs[a] = String(v); } }; };
    ctx.layerMorePanel = o.noPanel ? null : el(true); ctx.layerMoreRow = o.noRow ? null : el(true); ctx.layerMoreBtn = o.noBtn ? null : el(false);
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
    // syncLayerMore: all three elements, then without the row, without the toggle, without both
    c.activeLayer = 0; c.layerMoreOpen = true; L.rotation = 10; c.syncLayerMore();
    check('with the old row and toggle present nothing changed: the row is shown (hidden false), the panel is shown (open + a layer), the toggle has aria-expanded "true" and the dot', c.layerMoreRow.hidden === false && c.layerMorePanel.hidden === false && c.layerMoreBtn.attrs['aria-expanded'] === 'true' && c.layerMoreBtn.classList.contains('has-state'));
    c.activeLayer = 'base'; c.syncLayerMore();
    check('...base active: the row and the panel are hidden again, the dot is off', c.layerMoreRow.hidden === true && c.layerMorePanel.hidden === true && !c.layerMoreBtn.classList.contains('has-state'));
    const noOld = moreEnv({ noRow: true, noBtn: true }); noOld.activeLayer = 0; noOld.layerMoreOpen = true; noOld.syncLayerMore();
    check('WITHOUT the old row and the old toggle in the DOM the panel is still written: shown while a layer is active and open', noOld.layerMorePanel.hidden === false);
    noOld.layerMoreOpen = false; noOld.syncLayerMore();
    check('...closed: hidden again; open with the base active: hidden', noOld.layerMorePanel.hidden === true && (noOld.layerMoreOpen = true, noOld.activeLayer = 'base', noOld.syncLayerMore(), noOld.layerMorePanel.hidden === true));
    const noRow = moreEnv({ noRow: true }); noRow.activeLayer = 0; noRow.layerMoreOpen = true; noRow.additionalLayers[0].offsetX = 4; noRow.syncLayerMore();
    check('without the old row only: the panel is written and the toggle still gets aria-expanded and the dot', noRow.layerMorePanel.hidden === false && noRow.layerMoreBtn.attrs['aria-expanded'] === 'true' && noRow.layerMoreBtn.classList.contains('has-state'));
    const noBtn = moreEnv({ noBtn: true }); noBtn.activeLayer = 0; noBtn.layerMoreOpen = true; noBtn.syncLayerMore();
    check('without the old toggle only: the panel and the row are written', noBtn.layerMorePanel.hidden === false && noBtn.layerMoreRow.hidden === false);
    const noPanel = moreEnv({ noPanel: true }); let threw = null; try { noPanel.activeLayer = 0; noPanel.syncLayerMore(); } catch (e) { threw = e; }
    check('without the panel itself it returns quietly (nothing to write)', !threw);
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
