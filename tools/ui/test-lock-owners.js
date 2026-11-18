// Task 092 (point 4): who sets a lock lifts it. ui-farbe.js (UI.setDisabled(b, loadingSheet) on the chevrons of its steppers) and the stepper refresh in ui.js (a chevron with no step left is locked with its reason) used to lift
// each other's locks. UI.setDisabled(el, reason, owner): a lift by another owner leaves the lock; a call without an owner behaves as before. The REAL ui.js in a vm with a fake DOM (as test-stepper-disabled.js), no browser.
//   node tools/ui/test-lock-owners.js
//   UI_JS=/path/to/mutated/ui.js UI_FARBE_JS=... node tools/ui/test-lock-owners.js        (sabotage runs; a copy of the tree before the fix must be RED)
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

const FARBE = fs.readFileSync(process.env.UI_FARBE_JS || path.join(__dirname, '..', '..', 'ui-farbe.js'), 'utf8');
const NOFILL = 'Fläche füllen einschalten';
function lockedStepper() {   // a stepper whose up chevron has no step left: the refresh locks it with its reason (as the colour steppers do while face fill is off)
    const e = build({ start: 5, typing: false }); e.api.refresh(); e.flush();
    return e;
}
console.log('== the conflict (ui-farbe.js lifts the stepper refresh\'s lock) ==');
T('conflict', () => {
    // compute() of build() refuses nothing; make the up chevron refuse: use the stepper's own lock call through UI.setDisabled as the refresh does (owner 'stepper')
    const e = build({ start: 5 }); const UI = e.ctx.UI;
    UI.setDisabled(e.up, NOFILL, 'stepper');
    check('(setup) the chevron is locked with the reason', e.up.getAttribute('aria-disabled') === 'true' && e.up.dataset.reason === NOFILL);
    // what ui-farbe.js sync does for every chevron while no sheet is loading: lift (its own call, owner 'farbe')
    UI.setDisabled(e.up, null, 'farbe');
    check('a lift by the owner "farbe" leaves the lock of the owner "stepper" (RED without the fix: it was lifted)', e.up.getAttribute('aria-disabled') === 'true' && e.up.dataset.reason === NOFILL && e.up.dataset.lockOwner === 'stepper');
    UI.setDisabled(e.up, null, 'stepper');
    check('the owner itself lifts it (reason, owner and title cleaned)', e.up.getAttribute('aria-disabled') === null && e.up.dataset.reason === undefined && e.up.dataset.lockOwner === undefined);
    UI.setDisabled(e.up, 'loading', 'farbe'); UI.setDisabled(e.up, null, 'stepper');
    check('a lock of "farbe" is not lifted by "stepper" either', e.up.getAttribute('aria-disabled') === 'true' && e.up.dataset.lockOwner === 'farbe');
});
console.log('== the real callers pass their owner ==');
T('callers', () => {
    const UIJS = SRC;
    check('ui-farbe.js lifts / sets its stepper chevrons with the owner "farbe"', /querySelectorAll\('\.stepper-btn'\)\.forEach\(function \(b\) \{ UI\.setDisabled\(b, loadingSheet, 'farbe'\); \}\)/.test(FARBE));
    check('the stepper refresh in ui.js uses the owner "stepper"', /setDisabled\(b, r\.to === null \|\| r\.to === undefined \? r\.reason : null, 'stepper'\)/.test(UIJS));
});
console.log('== every caller without an owner behaves as before ==');
T('compat', () => {
    const e = build({ start: 5 }); const UI = e.ctx.UI;
    UI.setDisabled(e.up, 'reason A');
    check('a lock without an owner: aria-disabled, reason, title; no owner mark', e.up.getAttribute('aria-disabled') === 'true' && e.up.dataset.reason === 'reason A' && e.up.getAttribute('title') === 'reason A' && e.up.dataset.lockOwner === undefined);
    UI.setDisabled(e.up, 'reason B'); check('a second call overwrites the reason', e.up.dataset.reason === 'reason B');
    UI.setDisabled(e.up, null); check('a lift without an owner lifts', e.up.getAttribute('aria-disabled') === null && e.up.dataset.reason === undefined);
    UI.setDisabled(e.up, 'owned', 'x'); UI.setDisabled(e.up, null);
    check('a lock WITH an owner is lifted by a call without an owner (as before)', e.up.getAttribute('aria-disabled') === null);
    UI.setDisabled(e.up, 'owned', 'x'); UI.setDisabled(e.up, 'plain');
    check('a lock call without an owner takes the lock over (the owner mark is cleared)', e.up.dataset.reason === 'plain' && e.up.dataset.lockOwner === undefined);
    UI.setDisabled(e.up, null, 'y'); check('a lift by any owner lifts an ownerless lock', e.up.getAttribute('aria-disabled') === null);
    check('UI.setDisabled(null, ...) does nothing and the title is restored after a lift', (() => { UI.setDisabled(null, 'x'); e.up.setAttribute('title', 'T0'); UI.setDisabled(e.up, 'r'); UI.setDisabled(e.up, null); return e.up.getAttribute('title') === 'T0'; })());
});
console.log(failures === 0 ? `\n${checks}/${checks} checks passed` : `\n${failures} of ${checks} checks FAILED`);
process.exit(failures === 0 ? 0 : 1);
