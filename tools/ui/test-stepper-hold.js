// Guard for the stepper's hold-to-repeat (Phase 2, track A, commit C): the REAL ui.js is loaded into a vm with an injected clock and timers, no browser.
//   node tools/ui/test-stepper-hold.js
//   UI_JS=/path/to/mutated/ui.js node tools/ui/test-stepper-hold.js        (sabotage runs)
//
// Why. The chevron's hold-repeat was a setInterval around a step that is SYNCHRONOUS and can be slow (setValue -> input / change events -> sketch.js rebuilds the
// grid and redraw()s inside the handler: measured in the pane). A setInterval keeps queuing callbacks while a step takes longer than the interval, so the value
// keeps running after the finger is lifted. Now: a self-rescheduling setTimeout; the next step is due at the nominal time but never sooner than 16 ms after the
// previous step ENDED (gap = max(interval, cost + 16 ms)); the 150 -> 70 ms switch is by elapsed time (1800 ms of repeating); every release cancels, and a
// generation token makes a callback that is already queued or running a no-op.
//
// Step semantics (what the tests pin down). A press steps at once (t = 0). The repeat starts 600 ms after the press, first repeat at 750 ms, then every 150 ms until
// 1800 ms of repeating have passed (the 12th repeat, at 2400 ms), then every 70 ms. Held for 3000 ms on a device that keeps up: 1 + 12 + 8 = 21 steps (21 value
// units). On a slow device (each step costs 200 ms synchronously): gaps of 216 ms, 11 steps in 3000 ms (the press itself costs 200 ms, the repeat starts 600 ms after it ended). Never more steps than the fast device.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const UI_JS = process.env.UI_JS || path.join(__dirname, '..', '..', 'ui.js');
const SRC = fs.readFileSync(UI_JS, 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 120)); } };   // a crash is a FAIL, not a crashed test
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- an injected clock: virtual time, timers that only run when the test advances, a synchronous cost a step can "spend" ---------------------------------------
function makeClock() {
    let t = 0, id = 0, timers = [], noClear = false;
    const api = {
        now: () => t,
        spend: ms => { t += ms; },
        setTimeout(fn, ms) { timers.push({ id: ++id, at: t + Math.max(0, ms || 0), fn }); return id; },
        setInterval(fn, ms) { timers.push({ id: ++id, at: t + ms, fn, every: ms }); return id; },
        clearTimeout(i) { if (!noClear) timers = timers.filter(x => x.id !== i); },
        clearInterval(i) { if (!noClear) timers = timers.filter(x => x.id !== i); },
        pending: () => timers.length,
        keepQueued(on) { noClear = on; },                       // clearTimeout does nothing: a callback that was already queued still runs
        advanceTo(T_) {
            for (;;) {
                const due = timers.filter(x => x.at <= T_).sort((a, b) => a.at - b.at || a.id - b.id)[0];
                if (!due) break;
                const at = due.at;
                if (due.every) due.at += due.every; else timers = timers.filter(x => x !== due);   // an interval keeps its nominal rate, like a browser's
                if (t < at) t = at;
                due.fn();
            }
            if (t < T_) t = T_;
        },
    };
    return api;
}

// ---- fake DOM pieces: just what UI.stepper() touches ----------------------------------------------------------------------------------------------------------
function makeEl(extra) {
    const attrs = {}, handlers = {};
    const el = Object.assign({
        dataset: {}, style: {}, handlers,
        getAttribute: k => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); }, removeAttribute: k => { delete attrs[k]; },
        addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); },
        dispatch(type, ev) { const e = Object.assign({ type, target: el }, ev || {}); (handlers[type] || []).forEach(h => h(e)); return e; },
    }, extra || {});
    return el;
}

// A stepper wired the way ui-form.js does it, around a fake number input. costAt(t) = how long one step takes synchronously (the sketch's work in the 'change' handler).
function build(o) {
    o = o || {};
    const clock = makeClock();
    const docHandlers = {};
    const document = { visibilityState: 'visible', activeElement: null, getElementById: () => null,
        addEventListener: (t, fn) => { (docHandlers[t] = docHandlers[t] || []).push(fn); } };
    const ctx = vm.createContext({ document, console, Event: class { constructor(type, init) { this.type = type; Object.assign(this, init); } }, MutationObserver: class { observe() { } },
        setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, setInterval: clock.setInterval, clearInterval: clock.clearInterval, performance: { now: clock.now } });
    ctx.window = ctx;
    vm.runInContext(SRC, ctx, { filename: 'ui.js' });
    const steps = [];                                           // the time every step began
    const inputHandlers = {};
    const input = Object.assign(makeEl(), { value: String(o.start || 0), dispatchEvent(ev) { (input.handlers[ev.type] || []).forEach(h => h(ev)); return true; } });
    input.addEventListener('change', () => { steps.push(clock.now()); clock.spend(typeof o.costAt === 'function' ? o.costAt(clock.now()) : (o.cost || 0)); });
    const up = makeEl({ dataset: { dir: '1' } }), down = makeEl({ dataset: { dir: '-1' } });
    const root = { querySelectorAll: () => [up, down] };
    const max = o.max === undefined ? 100000 : o.max;
    const api = ctx.UI.stepper(root, { input, noTyping: true, compute: dir => { const v = parseInt(input.value, 10) + dir; return (v > max || v < -100000) ? { to: null, reason: 'limit' } : { to: v }; } });
    const doc = { fire(type, patch) { Object.assign(document, patch || {}); (docHandlers[type] || []).forEach(h => h({ type })); } };
    return { clock, up, down, input, steps, api, doc, value: () => parseInt(input.value, 10), press: b => (b || up).dispatch('pointerdown', { button: 0, detail: 1, pointerType: 'mouse' }) };
}

// ---- the old logic, verbatim, as a reference model on the same clock ----------------------------------------------------------------------------------------------
function oldModel(clock, onStep) {
    let delay = null, repeat = null, count = 0;
    function stop() { clock.clearTimeout(delay); clock.clearInterval(repeat); delay = repeat = null; count = 0; }
    return {
        down() { onStep(); stop(); delay = clock.setTimeout(function () { repeat = clock.setInterval(function () { count++; if (!onStep()) { stop(); return; } if (count === 12) { clock.clearInterval(repeat); repeat = clock.setInterval(function () { if (!onStep()) stop(); }, 70); } }, 150); }, 600); },
        up: stop,
    };
}

console.log('== a device that keeps up: the same step times as the old setInterval ==');
const EXPECT_FAST = [0]; for (let k = 1; k <= 12; k++) EXPECT_FAST.push(600 + 150 * k); for (let k = 1; k <= 8; k++) EXPECT_FAST.push(2400 + 70 * k);
for (const cost of [0, 3, 40]) T('fast ' + cost, () => {
    const e = build({ cost }); e.press(); e.clock.advanceTo(3000); e.up.dispatch('pointerup');
    const ref = []; const clock = makeClock(); const m = oldModel(clock, () => { ref.push(clock.now()); clock.spend(cost); return true; }); m.down(); clock.advanceTo(3000); m.up();
    if (cost === 0) check('cost 0: every step time equals the old setInterval\'s (600 ms start delay, first repeat at 750, 150 ms, then 70 ms after the 12th repeat)', same(e.steps, ref), `${e.steps.length} steps, first repeats ${e.steps.slice(1, 4)}`);
    else {
        // the old code started its 70 ms interval AFTER the 12th repeat had finished (so its fast phase begins `cost` later); the new one keeps the nominal times
        const gaps = a => a.slice(13).map((t, i) => t - a.slice(12)[i]);
        check(`cost ${cost} ms: the press and the 12 repeats at 150 ms are the old setInterval's; the fast phase has the same 70 ms rate (the old one waited ${cost} ms more before its first fast step)`, same(e.steps.slice(0, 13), ref.slice(0, 13)) && gaps(e.steps).every(g => g === 70) && gaps(ref)[0] === 70 + cost && gaps(ref).slice(1).every(g => g === 70) && ref[13] - e.steps[13] === cost, `${e.steps.length} steps, first repeats ${e.steps.slice(1, 4)}`);
    }
    if (cost === 0) {
        check('held for 3000 ms: the steps are 0, 750, 900 ... 2400, 2470 ... 2960 (21 steps)', same(e.steps, EXPECT_FAST), e.steps.length + ' steps');
        check('the value after 3 s on a fast device is start + 21', e.value() === 21, String(e.value()));
    }
});

console.log('\n== a slow device: steps are skipped, never added ==');
T('slow', () => {
    const fast = build({ cost: 0 }); fast.press(); fast.clock.advanceTo(3000); fast.up.dispatch('pointerup');
    const slow = build({ cost: 200 }); slow.press(); slow.clock.advanceTo(3000); slow.up.dispatch('pointerup');
    const gaps = slow.steps.slice(1).map((t, i) => t - slow.steps[i]).slice(1);
    check('cost 200 ms: the value after 3 s is 11, fewer than the fast device\'s 21 (and never more)', slow.value() === 11 && slow.value() < fast.value(), `${slow.value()} against ${fast.value()}`);
    check('...every gap is 216 ms = cost + 16 ms: the next step never starts before the previous one ended + 16 ms', gaps.length > 5 && gaps.every(g => g === 216), gaps.join(','));
    check('...and no step began while the previous one was still running', slow.steps.every((t, i) => i === 0 || t >= slow.steps[i - 1] + 200));
    for (const cost of [60, 100, 140, 200, 400, 1000]) {
        const e = build({ cost }); e.press(); e.clock.advanceTo(3000); e.up.dispatch('pointerup');
        check(`cost ${cost} ms: at most the fast device's ${fast.value()} steps (${e.value()}), and gaps never shorter than cost + 16 ms`, e.value() <= fast.value() && e.steps.every((t, i) => i < 2 || t - e.steps[i - 1] >= Math.min(cost + 16, 150) - 0), String(e.value()));
    }
    check('a very slow device (1000 ms per step) still ends with the release: nothing pending, no step afterwards', (() => { const e = build({ cost: 1000 }); e.press(); e.clock.advanceTo(2500); e.up.dispatch('pointerup'); const n = e.value(); e.clock.advanceTo(20000); return e.value() === n && e.clock.pending() === 0; })());
});
T('elapsed', () => {
    // the 150 -> 70 ms switch is by elapsed time: a device that is slow for the first 1500 ms and then recovers steps every 70 ms right after 1800 ms of repeating
    const e = build({ costAt: t => (t < 1500 ? 200 : 5) }); e.press(); e.clock.advanceTo(3600); e.up.dispatch('pointerup');
    // the 11th repeat is at 2648: 1848 ms of repeating have passed there, but only 11 repeats have been made
    const late = e.steps.filter(t => t >= 2640); const gaps = late.slice(1).map((t, i) => t - late[i]);
    check('slow at first, fast later: after 1800 ms of repeating the gap is 70 ms (a step count would still be at 150 ms)', gaps.length > 4 && gaps.every(g => g === 70), gaps.slice(0, 8).join(','));
});

console.log('\n== every way a hold ends: no step follows ==');
const RELEASES = ['pointerup', 'pointercancel', 'pointerleave', 'blur', 'contextmenu'];
for (const type of RELEASES) T(type, () => {
    const e = build({ cost: 2 }); e.press(); e.clock.advanceTo(1000);                       // steps at 0, 750, 900
    const before = e.value(); e.up.dispatch(type); e.clock.advanceTo(10000);
    check(`${type}: after the release no further step (value ${before} stays), no timer left`, before === 3 && e.value() === before && e.clock.pending() === 0, `${before} -> ${e.value()}, pending ${e.clock.pending()}`);
});
T('visibilitychange', () => {
    const e = build({ cost: 2 }); e.press(); e.clock.advanceTo(1000); e.doc.fire('visibilitychange', { visibilityState: 'hidden' }); const v = e.value(); e.clock.advanceTo(10000);
    check('visibilitychange to hidden (tab / app switch, lock screen): the repeat stops, no timer left', e.value() === v && e.clock.pending() === 0 && v === 3, `${v} -> ${e.value()}`);
    const k = build({ cost: 2 }); k.press(); k.clock.advanceTo(1000); k.doc.fire('visibilitychange', { visibilityState: 'visible' }); k.clock.advanceTo(1300);
    check('visibilitychange to visible does not stop a hold', k.value() > 3, String(k.value()));
});
T('both buttons', () => {
    const e = build({ cost: 2 }); e.press(e.up); e.press(e.down); e.clock.advanceTo(800); e.doc.fire('visibilitychange', { visibilityState: 'hidden' }); const v = e.value(); e.clock.advanceTo(9000);
    check('a hidden page stops the holds of BOTH chevrons of a stepper', e.value() === v && e.clock.pending() === 0, `${v} -> ${e.value()}`);
});
T('pointerleave while captured', () => {
    const e = build({ cost: 2 }); e.press(); e.clock.advanceTo(800); e.up.dispatch('lostpointercapture'); e.up.dispatch('pointerleave'); const v = e.value(); e.clock.advanceTo(5000);
    check('pointerleave (the pointer is captured by the button on touch: it arrives after the capture ends) stops the repeat', e.value() === v && e.clock.pending() === 0, `${v} -> ${e.value()}`);
});
T('release inside a step', () => {
    for (const type of RELEASES) {
        const e = build({ cost: 2 }); let released = false;
        e.input.addEventListener('change', () => { if (!released && e.value() === 4) { released = true; e.up.dispatch(type); } });   // blur / pointercancel arriving DURING a step (a step can move focus or re-render)
        e.press(); e.clock.advanceTo(1060);                                  // the step at 1052 ms (value 4) is the one that releases
        const pendingRightAfter = e.clock.pending();
        e.clock.advanceTo(8000);
        if (type === RELEASES[0]) check('a release that arrives while a step is running: the hold ends there, no timer is rescheduled (not even one that would find itself released)', e.value() === 4 && pendingRightAfter === 0 && e.clock.pending() === 0, `${type}: value ${e.value()}, pending right after the step ${pendingRightAfter}`);
        else if (!(e.value() === 4 && pendingRightAfter === 0 && e.clock.pending() === 0)) check('release inside a step: ' + type, false, `value ${e.value()}, pending ${e.clock.pending()}`);
    }
});
T('queued callback', () => {
    const e = build({ cost: 2 }); e.press(); e.clock.advanceTo(749); e.clock.keepQueued(true); e.up.dispatch('pointerup'); const v = e.value();   // clearTimeout cannot cancel a callback that is already queued
    e.clock.advanceTo(5000);
    check('a timer callback that is already queued when the release arrives does not step (the generation token), and schedules nothing', e.value() === v && e.clock.pending() === 0, `${v} -> ${e.value()}, pending ${e.clock.pending()}`);
    const f = build({ cost: 2 }); f.press(); f.clock.advanceTo(749); f.up.dispatch('pointerup'); f.press(); f.clock.advanceTo(749 + 3000);
    check('a new press right after a release starts a fresh hold (and only one)', f.value() > 5 && f.steps.every((t, i) => i < 2 || t - f.steps[i - 1] >= 70), String(f.value()));
});
T('limit', () => {
    const e = build({ cost: 2, max: 5 }); e.press(); e.clock.advanceTo(6000);
    check('a step that is refused (the value hit its limit) ends the hold: no timer left', e.value() === 5 && e.clock.pending() === 0, `${e.value()}, pending ${e.clock.pending()}`);
});
T('disabled', () => {
    const e = build({ cost: 2 }); e.up.setAttribute('aria-disabled', 'true'); e.press(); e.clock.advanceTo(3000);
    check('a press on a disabled chevron steps nothing and starts no hold', e.value() === 0 && e.clock.pending() <= 1, `${e.value()}, pending ${e.clock.pending()}`);
    const r = build({ cost: 2 }); r.up.dispatch('pointerdown', { button: 2, detail: 1 }); r.clock.advanceTo(3000);
    check('a secondary mouse button does nothing', r.value() === 0 && r.clock.pending() === 0);
});

console.log('\n== the keyboard never starts a hold ==');
T('keys', () => {
    const e = build({ cost: 5 });
    const keyHandlers = e.input.handlers.keydown || [];
    check('ArrowUp / ArrowDown are handled on the field', keyHandlers.length === 1);
    let t = 0; for (let i = 0; i < 30; i++) { e.clock.advanceTo(t); keyHandlers.forEach(h => h({ key: 'ArrowUp', repeat: i > 0, preventDefault() { } })); t += 33; }
    check('a held key (keydown with repeat, one every 33 ms) steps once per event: 30 events, 30 steps, at the browser\'s own rate', e.value() === 30 && e.steps.length === 30, `${e.value()}`);
    check('...and no timer exists at any point (nothing to stack, nothing that runs on after the key is up)', e.clock.pending() === 0);
    e.clock.advanceTo(t + 5000);
    check('after the key is up nothing steps', e.value() === 30);
    const c = build({ cost: 5 });
    for (let i = 0; i < 5; i++) c.up.dispatch('click', { detail: 0 });
    check('Enter / Space on a chevron (click with detail 0), repeated by a held Enter: one step per click, no timer', c.value() === 5 && c.clock.pending() === 0, `${c.value()}`);
    const m = build({ cost: 5 });
    m.press(); m.up.dispatch('pointerup'); m.up.dispatch('click', { detail: 1 }); m.clock.advanceTo(5000);
    check('a mouse / touch tap (pointerdown, pointerup, click with detail 1) steps exactly once', m.value() === 1 && m.clock.pending() === 0, String(m.value()));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
