// Guard for the layer steppers (layers, 5d step 1b-1): the REAL ui.js and the REAL ui-layer.js in a vm, with fake DOM pieces, an injected clock and a step that costs time. No browser.
//   node tools/ui/test-layer-stepper.js
//   UI_JS=... UI_LAYER_JS=... node tools/ui/test-layer-stepper.js        (sabotage runs)
//
// What. ui-layer.js wraps the node-count and size inputs of the active layer in the Form row's stepper (UI.stepper, ui.js). A chevron sets the value and dispatches 'input' and 'change', which
// sketch.js answers with updateActiveLayerGrid() (clears THIS layer's lines, rebuilds its grid) and a redraw: a step costs time (measured in the pane: 4-8 ms on a 13-node square layer, ~38 ms
// with a base of 35 lines). So the hold-repeat guard of track A (test-stepper-hold.js) is run against a LAYER stepper too: no stacking while a step is slow, no step after the release.
// Also here: the limits (maxNodeCountFor of the LAYER's own shape, 1..9 for the size, nothing about the base net's Field rule), the reasons, that nothing steps while no layer is active, that
// a keyboard activation steps once and a pointer activation steps once (the click after a pointerdown does not step again), and that aria-pressed follows the 'active' class.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const UI_SRC = fs.readFileSync(process.env.UI_JS || path.join(ROOT, 'ui.js'), 'utf8');
const LAYER_SRC = fs.readFileSync(process.env.UI_LAYER_JS || path.join(ROOT, 'ui-layer.js'), 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 140)); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function makeClock() {
    let t = 0, id = 0, timers = [], noClear = false;
    return {
        now: () => t, spend: ms => { t += ms; },
        setTimeout(fn, ms) { timers.push({ id: ++id, at: t + Math.max(0, ms || 0), fn }); return id; },
        clearTimeout(i) { if (!noClear) timers = timers.filter(x => x.id !== i); },
        setInterval(fn, ms) { timers.push({ id: ++id, at: t + ms, fn, every: ms }); return id; },
        clearInterval(i) { if (!noClear) timers = timers.filter(x => x.id !== i); },
        keepQueued(on) { noClear = on; },
        pending: () => timers.length,
        advanceTo(T_) {
            for (;;) {
                const due = timers.filter(x => x.at <= T_).sort((a, b) => a.at - b.at || a.id - b.id)[0];
                if (!due) break;
                const at = due.at;
                if (due.every) due.at += due.every; else timers = timers.filter(x => x !== due);
                if (t < at) t = at;
                due.fn();
            }
            if (t < T_) t = T_;
        },
    };
}
function makeEl(extra) {
    const attrs = {}, handlers = {}, cls = new Set();
    const el = Object.assign({
        dataset: {}, style: {}, handlers, hidden: false,
        getAttribute: k => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); }, removeAttribute: k => { delete attrs[k]; },
        addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); },
        classList: { contains: c => cls.has(c), add: c => { cls.add(c); }, remove: c => { cls.delete(c); } },
        dispatch(type, ev) { const e = Object.assign({ type, target: el, stopImmediatePropagation() { this._stop = true; } }, ev || {}); for (const h of (handlers[type] || [])) { h(e); if (e._stop) break; } return e; },
    }, extra || {});
    return el;
}

// the page: the two steppers (each root holds two chevrons), the layer's shape and fold buttons, the sketch's reaction to an input, and the globals ui-layer.js reads
function build(o) {
    o = o || {};
    const clock = makeClock();
    const docHandlers = {}, observers = [];
    const nodeInput = Object.assign(makeEl(), { value: String(o.node === undefined ? 3 : o.node), dispatchEvent(ev) { return nodeInput.dispatch(ev.type, ev), true; } });
    const sizeInput = Object.assign(makeEl(), { value: String(o.size === undefined ? 5 : o.size), dispatchEvent(ev) { return sizeInput.dispatch(ev.type, ev), true; } });
    const mkRoot = input => { const up = makeEl({ dataset: { dir: '1' } }), down = makeEl({ dataset: { dir: '-1' } }); const root = { up, down, querySelectorAll: () => [up, down] }; input.closest = () => root; return root; };
    const nodeRoot = mkRoot(nodeInput), sizeRoot = mkRoot(sizeInput);
    const shapeBtns = ['triangle', 'square', 'hex'].map(s => makeEl({ dataset: { shape: s } })), foldBtns = ['3', '6'].map(f => makeEl({ dataset: { fold: f } }));
    const byId = { '#layer-node-count-input': nodeInput, '#layer-shape-size-input': sizeInput };
    const document = { visibilityState: 'visible', activeElement: null, getElementById: () => null, querySelector: s => byId[s] || null,
        querySelectorAll: s => (/layer-shape-icon-btn/.test(s) ? shapeBtns.concat(foldBtns) : []), addEventListener: (t, fn) => { (docHandlers[t] = docHandlers[t] || []).push(fn); } };
    const layer = { shape: o.shape || 'square', nodeCount: Number(nodeInput.value), shapeSizeFactor: Number(sizeInput.value) };
    const sketch = { grids: [], stepTimes: [] };
    // sketch.js's reaction: updateActiveLayerGrid() = a rebuild that costs time; the node count / size of the layer follow the input
    nodeInput.addEventListener('change', () => { sketch.stepTimes.push(clock.now()); clock.spend(typeof o.costAt === 'function' ? o.costAt(clock.now()) : (o.cost || 0)); layer.nodeCount = Number(nodeInput.value); sketch.grids.push('node ' + nodeInput.value); if (o.releaseAtStep && sketch.grids.length === o.releaseAtStep) nodeRoot.up.dispatch('pointerup'); });
    sizeInput.addEventListener('change', () => { sketch.stepTimes.push(clock.now()); clock.spend(typeof o.costAt === 'function' ? o.costAt(clock.now()) : (o.cost || 0)); layer.shapeSizeFactor = Number(sizeInput.value); sketch.grids.push('size ' + sizeInput.value); });
    const NODE_COUNT_MAX = { triangle: 7, square: 13, hex: 7 };
    const ctx = vm.createContext({ document, console, Event: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
        MutationObserver: class { constructor(cb) { this.cb = cb; observers.push(this); } observe() { } },
        setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, setInterval: clock.setInterval, clearInterval: clock.clearInterval, performance: { now: clock.now },
        activeLayer: o.base ? 'base' : 0, additionalLayers: [layer], maxNodeCountFor: s => NODE_COUNT_MAX[s] || 7 });
    ctx.window = ctx;
    vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    vm.runInContext(LAYER_SRC, ctx, { filename: 'ui-layer.js' });
    const sync = () => ctx.window.uiSync();
    return { clock, ctx, nodeInput, sizeInput, nodeRoot, sizeRoot, shapeBtns, foldBtns, layer, sketch, observers, sync,
        press: b => b.dispatch('pointerdown', { button: 0, detail: 1, pointerType: 'mouse' }),
        release: b => b.dispatch('pointerup'),
        dis: b => b.getAttribute('aria-disabled') === 'true', reason: b => b.dataset.reason || null };
}

console.log('== limits and reasons ==');
T('limits', () => {
    const e = build({ shape: 'triangle', node: 7, size: 5 }); e.sync();
    check('triangle layer at node count 7: the up chevron is disabled with the triangle / hexagon reason, the down chevron is not', e.dis(e.nodeRoot.up) && !e.dis(e.nodeRoot.down) && e.reason(e.nodeRoot.up) === 'Höchstens 7 Knoten bei Dreieck und Sechseck.', String(e.reason(e.nodeRoot.up)));
    const s = build({ shape: 'square', node: 13, size: 5 }); s.sync();
    check('square layer at 13: the up chevron is disabled with the square reason (13 comes from maxNodeCountFor(the layer\'s own shape))', s.dis(s.nodeRoot.up) && s.reason(s.nodeRoot.up) === 'Höchstens 13 Knoten beim Quadrat.', String(s.reason(s.nodeRoot.up)));
    const s12 = build({ shape: 'square', node: 12 }); s12.sync();
    check('square layer at 12: both chevrons are enabled (the base\'s own shape plays no part: the limit is the layer\'s)', !s12.dis(s12.nodeRoot.up) && !s12.dis(s12.nodeRoot.down));
    const one = build({ shape: 'square', node: 1 }); one.sync();
    check('node count 1: the down chevron is disabled ("Mindestens 1 Knoten.")', one.dis(one.nodeRoot.down) && one.reason(one.nodeRoot.down) === 'Mindestens 1 Knoten.');
    const z = build({ size: 9 }); z.sync();
    check('size 9: up disabled "Größte Größe: 9."; size 1: down disabled "Kleinste Größe: 1."', z.dis(z.sizeRoot.up) && z.reason(z.sizeRoot.up) === 'Größte Größe: 9.' && (() => { const o = build({ size: 1 }); o.sync(); return o.dis(o.sizeRoot.down) && o.reason(o.sizeRoot.down) === 'Kleinste Größe: 1.'; })());
    const even = build({ size: 4 }); even.sync(); even.press(even.sizeRoot.up); even.release(even.sizeRoot.up);
    check('the size steps by 1 (an even size is fine for a layer: the Form row\'s odd-only Field rule is about the base\'s size and net, not applied here)', even.sizeInput.value === '5' && even.layer.shapeSizeFactor === 5, even.sizeInput.value);
    const b = build({ base: true }); b.sync();
    check('no layer active (the base): all four chevrons are disabled ("Keine Ebene aktiv.") and a press steps nothing', [b.nodeRoot.up, b.nodeRoot.down, b.sizeRoot.up, b.sizeRoot.down].every(x => b.dis(x) && b.reason(x) === 'Keine Ebene aktiv.') && (() => { b.press(b.nodeRoot.up); b.release(b.nodeRoot.up); return b.sketch.grids.length === 0 && b.nodeInput.value === '3'; })());
    const sw = build({ shape: 'square', node: 13 }); sw.sync(); sw.layer.shape = 'triangle'; sw.nodeInput.value = '7'; sw.sync();
    check('after a layer switch (a programmatic change) the next sync re-reads the limits (square 13 -> triangle 7: the up chevron is disabled by the triangle limit)', sw.dis(sw.nodeRoot.up) && sw.reason(sw.nodeRoot.up).includes('Dreieck'));
    const typed = build({ shape: 'triangle', node: 3 });
    typed.nodeInput.value = '12'; typed.nodeInput.dispatch('input');
    check('a TYPED out-of-range node count is clamped to the layer\'s limit before the sketch reads it (12 on a triangle layer -> 7)', typed.nodeInput.value === '7', typed.nodeInput.value);
});

console.log('\n== one step per activation ==');
T('activation', () => {
    const e = build({ shape: 'square', node: 5 });
    e.press(e.nodeRoot.up); e.release(e.nodeRoot.up); e.nodeRoot.up.dispatch('click', { detail: 1 });
    check('a mouse press steps once; the click that ends it (detail 1) does not step again', e.nodeInput.value === '6' && e.sketch.grids.length === 1, e.nodeInput.value + ', ' + e.sketch.grids.length + ' grids');
    e.nodeRoot.up.dispatch('click', { detail: 0 });
    check('a keyboard activation (a click with detail 0) steps once', e.nodeInput.value === '7' && e.sketch.grids.length === 2);
    const ev = []; e.nodeInput.addEventListener('input', () => ev.push('input')); e.nodeInput.addEventListener('change', () => ev.push('change'));
    e.nodeRoot.down.dispatch('click', { detail: 0 });
    check('a step dispatches input and change on the EXISTING input (so every handler in sketch.js keeps working), in that order, once each', same(ev, ['input', 'change']), ev.join(','));
    const arrow = build({ node: 5 }); arrow.nodeInput.dispatch('keydown', { key: 'ArrowUp', preventDefault() { } });
    check('ArrowUp in the field steps once', arrow.nodeInput.value === '6' && arrow.sketch.grids.length === 1);
});

console.log('\n== hold-repeat against a layer stepper (injected clock) ==');
const EXPECT = [0]; for (let k = 1; k <= 12; k++) EXPECT.push(600 + 150 * k);
T('hold-fast', () => {
    const e = build({ shape: 'square', node: 1, cost: 0 }); e.press(e.nodeRoot.up); e.clock.advanceTo(1800); e.release(e.nodeRoot.up);
    check('held 1800 ms on a device that keeps up: steps at 0, 750, 900 ... 1800 (the same times as the Form row\'s stepper) and the node count climbs from 1 to 10', same(e.sketch.stepTimes, EXPECT.slice(0, 9)) && e.nodeInput.value === '10', e.sketch.stepTimes.join(',') + ' -> ' + e.nodeInput.value);
    const before = e.sketch.grids.length; e.clock.advanceTo(5000);
    check('after the release no further step comes, however long the clock runs, and no timer is left', e.sketch.grids.length === before && e.clock.pending() === 0, e.sketch.grids.length - before + ' extra steps, ' + e.clock.pending() + ' timers');
    const cap = build({ shape: 'square', node: 11, cost: 0 }); cap.press(cap.nodeRoot.up); cap.clock.advanceTo(4000);
    check('held up to the layer\'s limit: it stops at 13 by itself (the step that cannot happen ends the hold), no step beyond', cap.nodeInput.value === '13' && cap.sketch.grids.length === 2 && cap.clock.pending() === 0, cap.nodeInput.value + ', ' + cap.sketch.grids.length + ' steps, ' + cap.clock.pending() + ' timers');
});
T('hold-slow', () => {
    const e = build({ shape: 'square', node: 1, cost: 200 }); e.press(e.nodeRoot.up); e.clock.advanceTo(3000); e.release(e.nodeRoot.up);
    const gaps = e.sketch.stepTimes.slice(2).map((t, i) => t - e.sketch.stepTimes.slice(1)[i]);
    check('a step that costs 200 ms (a dense picture): the gaps are cost + 16 ms = 216, never shorter: steps are skipped, never stacked', gaps.length >= 5 && gaps.every(g => g === 216), gaps.join(','));
    check('...and fewer steps than on the fast device in the same 3 s', e.sketch.grids.length < 21 && e.sketch.grids.length >= 8, String(e.sketch.grids.length));
    const n = e.sketch.grids.length; e.clock.advanceTo(8000);
    check('after the release no further step (the grid is not rebuilt once more behind the finger)', e.sketch.grids.length === n && e.clock.pending() === 0);
    const q = build({ shape: 'square', node: 1, cost: 0 }); q.press(q.nodeRoot.up); q.clock.advanceTo(800); q.clock.keepQueued(true); q.release(q.nodeRoot.up); const m = q.sketch.grids.length; q.clock.advanceTo(3000);
    check('a callback that was already queued when the finger lifted (the clear does not reach it) still does not step: the generation token', q.sketch.grids.length === m, q.sketch.grids.length - m + ' extra');
    const mid = build({ shape: 'square', node: 1, cost: 20, releaseAtStep: 3 }); mid.press(mid.nodeRoot.up); mid.clock.advanceTo(1000); const midPending = mid.clock.pending(); mid.clock.advanceTo(4000);
    check('the finger lifts WHILE a step runs (the sketch\'s handler is mid-rebuild): that step finishes, NO timer is scheduled for another one (checked right after it, before any time passes), and none ever steps', mid.sketch.grids.length === 3 && midPending === 0 && mid.clock.pending() === 0, mid.sketch.grids.length + ' steps, ' + midPending + ' timers right after');
    const lv = build({ shape: 'square', node: 1, cost: 0 }); lv.press(lv.sizeRoot.up); lv.clock.advanceTo(900); lv.sizeRoot.up.dispatch('pointerleave'); const k = lv.sketch.grids.length; lv.clock.advanceTo(3000);
    check('the size stepper ends its hold on pointerleave, too', lv.sketch.grids.length === k && lv.clock.pending() === 0);
});

console.log('\n== aria-pressed follows the active class (shape and fold) ==');
T('pressed', () => {
    const e = build({});
    check('every shape and fold button gets aria-pressed="false" at the start', e.shapeBtns.concat(e.foldBtns).every(b => b.getAttribute('aria-pressed') === 'false'));
    e.shapeBtns[1].classList.add('active'); e.foldBtns[0].classList.add('active'); e.observers.forEach(o => o.cb());
    check('...and "true" after the class is set (the sketch\'s handlers set it), for exactly those', same(e.shapeBtns.map(b => b.getAttribute('aria-pressed')), ['false', 'true', 'false']) && same(e.foldBtns.map(b => b.getAttribute('aria-pressed')), ['true', 'false']));
    e.shapeBtns[1].classList.remove('active'); e.shapeBtns[2].classList.add('active'); e.observers.forEach(o => o.cb());
    check('...and follows the class when another shape becomes active', same(e.shapeBtns.map(b => b.getAttribute('aria-pressed')), ['false', 'false', 'true']));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
