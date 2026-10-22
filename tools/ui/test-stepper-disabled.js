// Guard for a DISABLED stepper (phone layout, commit 3b): UI.stepper() in the REAL ui.js, loaded into a vm with a fake DOM, no browser.
//   node tools/ui/test-stepper-disabled.js
//   UI_JS=/path/to/mutated/ui.js node tools/ui/test-stepper-disabled.js        (sabotage runs)
//
// Why. The phone layout shows the Fokus stepper in its Achsen panel even while sketch.js hides the Fokus row (Aus, Geo): it marks the stepper's ROOT aria-disabled with the reason
// "Fokus gilt für Sin und Tan" (UI.setDisabled). A stepper whose root is disabled must do NOTHING: a press on a chevron (pointer, hold, keyboard click), an arrow key on the display and a typed value
// change no value and ask compute() nothing; the reason is shown instead; the chevrons say the same through refresh(). Enabling the root again brings everything back.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const UI_JS = process.env.UI_JS || path.join(__dirname, '..', '..', 'ui.js');
const SRC = fs.readFileSync(UI_JS, 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };

function makeClock() {
    let t = 0, id = 0, timers = [];
    return {
        now: () => t,
        setTimeout(fn, ms) { timers.push({ id: ++id, at: t + Math.max(0, ms || 0), fn }); return id; },
        clearTimeout(i) { timers = timers.filter(x => x.id !== i); },
        advanceTo(T_) { for (;;) { const due = timers.filter(x => x.at <= T_).sort((a, b) => a.at - b.at || a.id - b.id)[0]; if (!due) break; timers = timers.filter(x => x !== due); if (t < due.at) t = due.at; due.fn(); } if (t < T_) t = T_; },
    };
}
const queued = [];
function makeEl(extra) {
    const attrs = {}, handlers = {};
    const el = Object.assign({
        dataset: {}, style: {}, handlers,
        getAttribute: k => (k in attrs ? attrs[k] : null),
        setAttribute: (k, v) => { const was = attrs[k]; attrs[k] = String(v); if (was !== attrs[k] && k === 'aria-disabled') queued.push(...(el.observers || [])); },   // a MutationObserver on aria-disabled: a change queues its callback; flush() runs the queue (the real one runs a microtask later, when setDisabled has written the reason too)
        removeAttribute: k => { const had = k in attrs; delete attrs[k]; if (had && k === 'aria-disabled') queued.push(...(el.observers || [])); },
        addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); },
        dispatch(type, ev) { const e = Object.assign({ type, target: el, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; } }, ev || {}); const hs = handlers[type] || []; for (let i = 0; i < hs.length && !e.stopped; i++) hs[i](e); return e; },
    }, extra || {});
    return el;
}

// a stepper as ui-net.js builds the Fokus one: a root with two chevrons, a hidden carrier input (noTyping), a display that takes the arrow keys; `typing` = a typable input instead
function build(o) {
    o = o || {};
    const clock = makeClock(), docHandlers = {}, toasts = [];
    const toastEl = makeEl({ textContent: '', hidden: true, classList: { add() { }, remove() { } } });
    const document = { visibilityState: 'visible', activeElement: null, body: makeEl({ appendChild() { } }), getElementById: () => null, createElement: () => makeEl({ appendChild() { }, classList: { add() { }, remove() { } } }), querySelector: () => null,
        addEventListener: (t, fn) => { (docHandlers[t] = docHandlers[t] || []).push(fn); } };
    const ctx = vm.createContext({ document, console, Event: class { constructor(type, init) { this.type = type; Object.assign(this, init); } }, MutationObserver: class { constructor(f) { this.f = f; } observe(node) { (node.observers = node.observers || []).push(this.f); } },
        setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, setInterval: () => 0, clearInterval: () => 0, performance: { now: clock.now } });
    ctx.window = ctx;
    vm.runInContext(SRC, ctx, { filename: 'ui.js' });
    const input = Object.assign(makeEl(), { value: String(o.start || 0), dispatchEvent(ev) { (input.handlers[ev.type] || []).forEach(h => h(ev)); return true; } });
    const seen = [];
    const up = makeEl({ dataset: { dir: '1' } }), down = makeEl({ dataset: { dir: '-1' } }), display = makeEl();
    const root = makeEl({ querySelectorAll: () => [up, down] });
    let asked = 0;
    const api = ctx.UI.stepper(root, { input, noTyping: !o.typing, keyEl: o.typing ? undefined : display, compute: dir => { asked++; const v = parseInt(input.value, 10) + dir; return v > 100 || v < -100 ? { to: null, reason: 'limit' } : { to: v }; } });
    if (o.typing) input.addEventListener('input', () => seen.push(input.value));   // a listener registered AFTER the stepper's (sketch.js's own): it must not see a refused value
    return { flush: () => { while (queued.length) queued.shift()(); }, clock, ctx, up, down, display, root, input, api, seen, asked: () => asked, value: () => parseInt(input.value, 10), UI: ctx.UI,
        press: b => (b || up).dispatch('pointerdown', { button: 0, detail: 1 }), release: b => (b || up).dispatch('pointerup'), click: (b, detail) => (b || up).dispatch('click', { detail: detail || 0 }),
        key: k => (o.typing ? input : display).dispatch('keydown', { key: k }) };
}
const REASON = 'Fokus gilt für Sin und Tan';

console.log('== an enabled stepper works (the baseline of every check below) ==');
T('enabled', () => {
    const e = build({ start: 10 }); e.press(); e.release();
    check('a press steps +1 (pointer)', e.value() === 11);
    e.click(e.down, 0);
    check('a keyboard click on the down chevron steps -1', e.value() === 10);
    e.key('ArrowUp');
    check('an arrow key on the display steps', e.value() === 11);
    const t = build({ start: 4, typing: true }); t.input.value = '7'; t.input.dispatch('input', { target: t.input });
    check('a typed value in a typable stepper is accepted and reaches the next listener', t.value() === 7 && t.seen.join() === '7');
});

console.log('\n== a stepper whose ROOT is aria-disabled does nothing ==');
T('pointer', () => {
    const e = build({ start: 10 }); e.UI.setDisabled(e.root, REASON);
    const n0 = e.asked();
    e.press(); e.clock.advanceTo(3000); e.release();
    check('a pointer press (and a hold of 3 s) changes no value and starts no repeat', e.value() === 10 && e.clock.now() === 3000);
    e.click(e.up, 1);
    check('...the click that follows a pointer press changes nothing either', e.value() === 10);
    check('compute() is not even asked by a press (the refusal does not depend on it)', e.asked() === n0, e.asked() + ' asked');
});
T('keyboard', () => {
    const e = build({ start: 10 }); e.UI.setDisabled(e.root, REASON);
    e.click(e.up, 0); e.click(e.down, 0);
    check('a keyboard click (Enter / Space, detail 0) on either chevron changes nothing', e.value() === 10);
    const a = e.key('ArrowUp'), b = e.key('ArrowDown'), c = e.key('ArrowRight'), d = e.key('ArrowLeft');
    check('the arrow keys on the display change nothing (each is still handled: no page scroll)', e.value() === 10 && [a, b, c, d].every(x => x.defaultPrevented));
    check('through the stepper\'s own step() nothing changes either (the API a caller might use)', e.api.step(1) === false && e.api.step(-1) === false && e.value() === 10);
});
T('chevrons', () => {
    const e = build({ start: 10 }); e.UI.setDisabled(e.root, REASON);
    e.api.refresh();
    check('refresh() marks both chevrons aria-disabled with the root\'s reason (title, data-reason)', [e.up, e.down].every(b => b.getAttribute('aria-disabled') === 'true' && b.dataset.reason === REASON && b.getAttribute('title') === REASON), e.up.dataset.reason);
    e.press(e.down); e.clock.advanceTo(3000); e.release(e.down);
    check('a press on a chevron that refresh() has marked changes nothing', e.value() === 10);
});
T('typed', () => {
    const e = build({ start: 4, typing: true }); e.UI.setDisabled(e.root, REASON);
    e.input.value = '9'; e.input.dispatch('input', { target: e.input });
    check('a typed value is put back to the last valid one and never reaches the listeners behind the stepper (sketch.js)', e.input.value === '4' && e.seen.length === 0, e.input.value + ' / ' + e.seen.join());
    e.input.value = '12'; e.input.dispatch('input', { target: e.input });
    check('...also for a second attempt', e.input.value === '4' && e.seen.length === 0);
});
T('enabling again', () => {
    const e = build({ start: 10 }); e.UI.setDisabled(e.root, REASON); e.api.refresh();
    e.UI.setDisabled(e.root, null); e.api.refresh();
    check('with the root enabled again the chevrons are enabled again (refresh)', !e.up.getAttribute('aria-disabled') && !e.down.getAttribute('aria-disabled'));
    e.press(); e.release();
    e.key('ArrowUp');
    check('...and the stepper steps again (pointer, arrow key)', e.value() === 12);
    const t = build({ start: 4, typing: true }); t.UI.setDisabled(t.root, REASON); t.UI.setDisabled(t.root, null);
    t.input.value = '8'; t.input.dispatch('input', { target: t.input });
    check('...and accepts a typed value again', t.value() === 8 && t.seen.join() === '8');
});
T('from outside', () => {
    // the phone layout disables the root in the middle of a UI tick that has already refreshed this stepper: the chevrons must follow at once, not on the next redraw
    const e = build({ start: 10 }); e.api.refresh();
    check('start: an enabled stepper, enabled chevrons', !e.up.getAttribute('aria-disabled') && !e.down.getAttribute('aria-disabled'));
    e.UI.setDisabled(e.root, REASON); e.flush();
    check('the root gets disabled: both chevrons are disabled with its reason WITHOUT a call of refresh()', [e.up, e.down].every(b => b.getAttribute('aria-disabled') === 'true' && b.dataset.reason === REASON));
    e.UI.setDisabled(e.root, null); e.flush();
    check('the root is enabled again: both chevrons are enabled again WITHOUT a call of refresh()', [e.up, e.down].every(b => !b.getAttribute('aria-disabled') && b.dataset.reason === undefined));
    e.press(); e.release();
    check('...and the stepper steps', e.value() === 11);
});
T('own disabled state is separate', () => {
    const e = build({ start: 100 });
    e.api.refresh();
    check('a stepper at its limit disables only the chevron that cannot go on, with compute()\'s reason (the root stays enabled)', e.up.getAttribute('aria-disabled') === 'true' && e.up.dataset.reason === 'limit' && !e.down.getAttribute('aria-disabled') && !e.root.getAttribute('aria-disabled'));
});

console.log('\n== the source ==');
T('source', () => {
    const src = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const body = src.slice(src.indexOf('function stepper(root, opts)'), src.indexOf('// ---- aria-pressed'));
    check('UI.stepper asks compute() only through a wrapper that refuses while the root is disabled; no other use of opts.compute', /const compute = function \(dir\) \{ return isDisabled\(root\)/.test(body) && (body.match(/opts\.compute\(/g) || []).length === 1);
    check('the stepper watches its root\'s aria-disabled (a MutationObserver calling refresh)', /new MutationObserver\(function \(\) \{ refresh\(\); \}\)\.observe\(root, \{ attributes: true, attributeFilter: \['aria-disabled'\] \}\)/.test(body));
    check('the typed-value listener, the pointerdown and the click handler each check the root', /input', function \(e\) \{\s*if \(isDisabled\(root\)\)/.test(body) && /downDisabled = isDisabled\(b\) \|\| isDisabled\(root\)/.test(body) && /isDisabled\(b\) \|\| isDisabled\(root\)\) \{ showReason\(b, root\)/.test(body));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
