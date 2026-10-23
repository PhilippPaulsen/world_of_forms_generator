// Guard for the step options of UI.stepper (sheets redesign, commit 2): step, min, max, wrap, round, format, readonly / noTyping. The REAL ui.js in a vm with a fake DOM and an injected clock, and the REAL
// bindExact of ui-net.js (extracted) behind an exact field. No browser.
//   node tools/ui/test-stepper-options.js
//   UI_JS=... UI_NET_JS=... node tools/ui/test-stepper-options.js        (sabotage runs)
//
// What it pins. A stepper given { step } (and no compute) READS the current value from the input and WRITES the next one by setting input.value and dispatching 'input' and then 'change', both bubbling,
// so the handlers that already listen keep running; it rounds, stops at min / max (the chevron of that direction is disabled with a reason) or wraps (rotation), formats what it writes, makes a text /
// number input readonly with inputmode="none", and never touches anything but the input. A stepper without the options behaves as before (the defaults), and a disabled one does nothing.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const UI_SRC = fs.readFileSync(process.env.UI_JS || path.join(ROOT, 'ui.js'), 'utf8');
const NET_SRC = fs.readFileSync(process.env.UI_NET_JS || path.join(ROOT, 'ui-net.js'), 'utf8');

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
function makeEl(extra) {
    const attrs = {}, handlers = {};
    const el = Object.assign({
        dataset: {}, style: {}, handlers,
        getAttribute: k => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); }, removeAttribute: k => { delete attrs[k]; }, hasAttribute: k => k in attrs,
        addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); },
        dispatch(type, ev) { const e = Object.assign({ type, target: el, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; } }, ev || {}); const hs = handlers[type] || []; for (let i = 0; i < hs.length && !e.stopped; i++) hs[i](e); return e; },
    }, extra || {});
    return el;
}

// a stepper as the sheets will build it: a root with two chevrons and an input; `typeOfInput` = 'number' | 'text' | 'range'
function build(o) {
    o = o || {};
    const clock = makeClock(), toasts = [], docHandlers = {};
    const document = { visibilityState: 'visible', activeElement: null, body: makeEl({ appendChild() { } }), getElementById: () => null, createElement: () => makeEl({ appendChild() { }, classList: { add() { }, remove() { } } }), querySelector: () => null, addEventListener: (t, fn) => { (docHandlers[t] = docHandlers[t] || []).push(fn); } };
    const ctx = vm.createContext({ document, console, Event: class { constructor(type, init) { this.type = type; Object.assign(this, init); } }, MutationObserver: class { observe() { } }, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, setInterval: () => 0, clearInterval: () => { }, performance: { now: clock.now } });
    ctx.window = ctx;
    vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    const events = [];
    const input = makeEl({ type: o.type === undefined ? 'number' : o.type, value: String(o.start === undefined ? 0 : o.start), readOnly: false, dispatchEvent(ev) { events.push({ type: ev.type, bubbles: ev.bubbles, value: input.value }); (input.handlers[ev.type] || []).forEach(h => h(ev)); return true; } });
    const up = makeEl({ dataset: { dir: '1' } }), down = makeEl({ dataset: { dir: '-1' } });
    const root = makeEl({ querySelectorAll: () => [up, down] });
    let api = null, thrown = null;
    try { api = ctx.UI.stepper(root, Object.assign({ input }, o.opts)); } catch (e) { thrown = e; }
    return { ctx, UI: ctx.UI, clock, input, up, down, root, api, events, thrown, value: () => input.value,
        press: b => (b || up).dispatch('pointerdown', { button: 0, detail: 1 }), release: b => (b || up).dispatch('pointerup'), click0: b => (b || up).dispatch('click', { detail: 0 }),
        key: k => input.dispatch('keydown', { key: k }), up2: () => api.step(1), down2: () => api.step(-1) };
}
const reasonOf = b => b.dataset.reason;

console.log('== the defaults are unchanged ==');
T('defaults', () => {
    const e = build({ opts: { compute: dir => ({ to: parseInt(e.input.value, 10) + dir }) }, start: 5, type: 'number' });
    check('a stepper with a compute() and no options: the input is not readonly, has no inputmode, the typed-value handling is installed (input, change and blur listeners), no throw', !e.thrown && e.input.readOnly === false && !e.input.hasAttribute('inputmode') && (e.input.handlers.input || []).length === 1 && (e.input.handlers.change || []).length === 1 && (e.input.handlers.blur || []).length === 1);
    e.up2();
    check('it steps by its own compute(), writes String(value) and dispatches input THEN change (both bubbling)', e.input.value === '6' && e.events.map(x => x.type).join() === 'input,change' && e.events.every(x => x.bubbles === true));
    const n = build({ opts: { compute: () => ({ to: 1 }), noTyping: true }, type: 'number' });
    check('noTyping with a compute() (the Netz and Farbe steppers) keeps its old meaning only: no typed-value listeners, and the input is NOT made readonly (the Farbe hue field stays typable at a mouse)', n.input.readOnly === false && !n.input.hasAttribute('inputmode') && !(n.input.handlers.input || []).length && !(n.input.handlers.change || []).length);
    const r = build({ opts: { compute: () => ({ to: 1 }), readonly: true }, type: 'number' });
    check('readonly: true makes the input of a stepper that has a compute() readonly, with inputmode="none"', r.input.readOnly === true && r.input.getAttribute('inputmode') === 'none');
    const t = build({ opts: {} });
    check('neither a compute() nor a step: UI.stepper throws (a stepper must have a rule)', !!t.thrown && /compute\(\) or a positive step/.test(String(t.thrown.message)));
    check('a non-positive or non-finite step is refused too', [0, -1, NaN, Infinity, '1'].every(s => !!build({ opts: { step: s } }).thrown));
});

console.log('\n== reading, writing, the events ==');
T('events', () => {
    const e = build({ opts: { step: 10 }, start: 0 });
    e.up2();
    check('step 10 from 0: the input holds "10" and the events are input, change - in that order, both bubbling, each seeing the NEW value', e.input.value === '10' && e.events.map(x => x.type).join() === 'input,change' && e.events.every(x => x.bubbles === true && x.value === '10'));
    e.events.length = 0; e.down2(); e.down2(); e.down2();
    check('...down three times: -20; nothing but the input is written (no other property of the root or the buttons changes)', e.input.value === '-20' && Object.keys(e.root.dataset).length === 0 && e.events.length === 6);
    const c = build({ opts: { step: 0.01, round: 2 }, start: '0,35' });
    c.up2();
    check('the current value is READ with the decimal comma helper ("0,35" counts as 0.35), the next is written with a dot', c.input.value === '0.36');
    const empty = build({ opts: { step: 1, min: 3, max: 9 }, start: '' }), bad = build({ opts: { step: 1 }, start: 'abc' });
    empty.up2(); bad.up2();
    check('an empty field counts as min (here 3 + 1 = 4), a field that is not a number as 0 (0 + 1 = 1)', empty.input.value === '4' && bad.input.value === '1');
    const f = build({ opts: { step: 0.01, round: 2, format: v => v.toFixed(2) }, start: '0.50' });
    f.up2(); f.up2();
    check('format(value) is what is written: "0.52" (two decimals), and a plain number the readers can parse', f.input.value === '0.52' && parseFloat(f.input.value) === 0.52);
    const g = build({ opts: { step: 1 }, start: 7 });
    g.press(); g.release();
    check('a pointer press steps once; a keyboard click (detail 0) steps once; an arrow key steps once; Arrow Down steps back', g.input.value === '8' && (g.click0(), g.input.value === '9') && (g.key('ArrowUp'), g.input.value === '10') && (g.key('ArrowDown'), g.input.value === '9'));
});

console.log('\n== round ==');
T('round', () => {
    const a = build({ opts: { step: 0.1 }, start: 0.2 }); a.up2();
    const b = build({ opts: { step: 0.1, round: 1 }, start: 0.2 }); b.up2();
    check('without round the float artefact shows (0.2 + 0.1 = 0.30000000000000004); with round: 1 it is "0.3"', a.input.value === '0.30000000000000004' && b.input.value === '0.3');
    const c = build({ opts: { step: 0.01, round: 2 }, start: 0.29 }); c.up2(); c.up2();
    check('round: 2 over many steps stays exact (0.29 -> 0.30 -> 0.31)', c.input.value === '0.31');
    const d = build({ opts: { step: 15, round: 0 }, start: 22.5 }); d.up2();
    check('round: 0 rounds to whole numbers (22.5 + 15 = 37.5 -> 38)', d.input.value === '38');
});

console.log('\n== min, max and the bounds ==');
T('bounds', () => {
    const e = build({ opts: { step: 0.1, round: 1, min: 0, max: 1 }, start: 0.95 });
    e.up2();
    check('a step that would pass the bound stops on it (0.95 + 0.1 -> 1)', e.input.value === '1');
    e.events.length = 0;
    const blocked = e.api.step(1);
    check('at the bound a step does nothing: no value change, no event', blocked === false && e.input.value === '1' && e.events.length === 0);
    e.api.refresh();
    check('refresh(): the chevron of that direction is aria-disabled WITH a reason, the other one is enabled', e.up.getAttribute('aria-disabled') === 'true' && /Größter Wert erreicht/.test(reasonOf(e.up)) && e.down.getAttribute('aria-disabled') === null);
    e.press(e.up); e.clock.advanceTo(3000); e.release(e.up);
    check('a press on the disabled chevron changes nothing, however long it is held', e.input.value === '1');
    const lo = build({ opts: { step: 5, min: 0, max: 100 }, start: 3 });
    lo.down2();
    check('and the lower bound the same way (3 - 5 -> 0), then it is blocked', lo.input.value === '0' && lo.api.step(-1) === false && (lo.api.refresh(), lo.down.getAttribute('aria-disabled') === 'true' && /Kleinster Wert erreicht/.test(reasonOf(lo.down))));
    const half = build({ opts: { step: 1, max: 5 }, start: 7 });
    half.api.refresh();
    check('a value already above max blocks the up chevron and lets it come back: one step down lands on the bound (7 - 1 = 6 is still above 5: it is clamped to 5)', half.up.getAttribute('aria-disabled') === 'true' && half.api.step(-1) === true && half.input.value === '5');
});

console.log('\n== wrap ==');
T('wrap', () => {
    const e = build({ opts: { step: 15, min: 0, max: 360, wrap: true, round: 0 }, start: 345 });
    e.up2();
    check('rotation wraps: 345 + 15 = 0 (360 itself is not a value)', e.input.value === '0');
    e.down2();
    check('...and 0 - 15 = 345', e.input.value === '345');
    e.input.value = '350'; e.up2();
    check('an off-grid value wraps by the remainder (350 + 15 = 5)', e.input.value === '5');
    e.input.value = '0'; e.api.refresh();
    check('with wrap neither chevron is ever disabled, not even at 0 or 345', e.up.getAttribute('aria-disabled') === null && e.down.getAttribute('aria-disabled') === null);
    const f = build({ opts: { step: 0.4, min: 0, max: 1, wrap: true, round: 1 }, start: 0.8 }); f.up2();
    check('wrap with a fractional step and round (0.8 + 0.4 = 1.2 -> 0.2)', f.input.value === '0.2');
    const noRange = build({ opts: { step: 15, wrap: true }, start: 345 }); noRange.up2();
    check('wrap without both bounds is not a wrap: it simply counts on (360)', noRange.input.value === '360');
});

console.log('\n== readonly and the keyboard ==');
T('readonly', () => {
    const n = build({ opts: { step: 10 }, type: 'number' }), t = build({ opts: { step: 0.01, round: 2 }, type: 'text' });
    check('a stepper with a step rule makes a number or a text input readonly with inputmode="none" (the keyboard never opens)', n.input.readOnly === true && n.input.getAttribute('inputmode') === 'none' && t.input.readOnly === true && t.input.getAttribute('inputmode') === 'none');
    check('the typed-value handling is off by default in that mode (no input / change / blur listeners)', !(n.input.handlers.input || []).length && !(n.input.handlers.change || []).length && !(n.input.handlers.blur || []).length);
    const r = build({ opts: { step: 1 }, type: 'range' }), h = build({ opts: { step: 1 }, type: 'hidden' });
    check('a range or a hidden carrier is never made readonly', r.input.readOnly === false && !r.input.hasAttribute('inputmode') && h.input.readOnly === false);
    const off = build({ opts: { step: 1, readonly: false }, type: 'number' }), typed = build({ opts: { step: 1, noTyping: false }, type: 'number' });
    check('readonly: false and noTyping: false give the old behaviour back', off.input.readOnly === false && !off.input.hasAttribute('inputmode') && typed.input.readOnly === false && (typed.input.handlers.input || []).length === 1);
});

console.log('\n== hold-to-repeat and the touch guard are unchanged ==');
T('hold', () => {
    const e = build({ opts: { step: 1 }, start: 0 });
    e.press(); e.clock.advanceTo(3000); e.release();
    check('held for 3 s on a device that keeps up: 21 steps (the press, 12 repeats at 150 ms, 8 at 70 ms), exactly as for the old steppers', e.input.value === '21', e.input.value);
    const w = build({ opts: { step: 15, min: 0, max: 360, wrap: true, round: 0 }, start: 0 });
    w.press(); w.clock.advanceTo(2400); w.release(); const atRelease = w.input.value; w.clock.advanceTo(9000);
    check('a held wrap stepper keeps counting round (13 steps by 2.4 s: 195), and stops when the finger lifts (nothing after the release)', atRelease === '195' && w.input.value === atRelease, atRelease + ' / ' + w.input.value);
    const b = build({ opts: { step: 1, min: 0, max: 4 }, start: 0 });
    b.press(); b.clock.advanceTo(5000);
    check('a held stepper stops on its own at the bound (the step returns false and ends the hold)', b.input.value === '4');
    const src = UI_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    check('the constants and the guard are the ones of before: 600 / 150 / 70 / 1800 / 16 ms, a generation token, touch-action manipulation, a stop on pointerup / cancel / leave / blur / contextmenu and on visibilitychange', /HOLD_START_MS = 600, HOLD_SLOW_MS = 150, HOLD_FAST_MS = 70, HOLD_FAST_AFTER_MS = 1800, HOLD_PAUSE_MS = 16/.test(src) && /mine !== gen/.test(src) && /touchAction = 'manipulation'/.test(src) && /\['pointerup', 'pointercancel', 'pointerleave', 'blur', 'contextmenu'\]/.test(src) && /visibilitychange/.test(src));
});

console.log('\n== a disabled stepper does nothing ==');
T('disabled', () => {
    const e = build({ opts: { step: 10 }, start: 50 });
    e.UI.setDisabled(e.root, 'Nicht aktiv.');
    e.press(); e.clock.advanceTo(3000); e.release();
    e.click0(e.up); e.click0(e.down); e.key('ArrowUp'); e.key('ArrowDown'); e.api.step(1); e.api.step(-1);
    check('a step-rule stepper whose root is aria-disabled: a press and a 3 s hold, a keyboard click on either chevron, both arrow keys and step() change nothing and dispatch nothing', e.input.value === '50' && e.events.length === 0);
    e.api.refresh();
    check('...and the chevrons say why (the root\'s reason)', [e.up, e.down].every(b => b.getAttribute('aria-disabled') === 'true' && reasonOf(b) === 'Nicht aktiv.'));
    e.UI.setDisabled(e.root, null); e.api.refresh(); e.up2();
    check('enabled again it steps', e.input.value === '60');
});

console.log('\n== behind the real exact-field handler (bindExact of ui-net.js) ==');
function extract(src, head) {
    const i = src.indexOf(head);
    if (i < 0) return '';
    let d = 0, j = src.indexOf('{', i);
    for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
    return '';
}
const BIND = extract(NET_SRC, 'function bindExact(');
T('bindExact', () => {
    // the exact field as a stepper's input; bindExact turns what lands in it into the carrier's whole percent, exactly as for a typed value
    const e = build({ opts: { step: 0.01, min: 0, max: 1, round: 2, format: v => v.toFixed(2) }, type: 'text', start: '0.50' });
    const toasts = [], carrier = { value: '50', events: [], dispatchEvent(ev) { this.events.push(ev.type); return true; } };
    const UI = { normalizeNumber: e.UI.normalizeNumber, toast: m => toasts.push(m) };
    const bind = new Function('UI', 'Event', BIND + '\nreturn bindExact;')(UI, class { constructor(type) { this.type = type; } });
    let why = null;
    const show = bind(e.input, carrier, 0, 1, 'Die Stärke liegt zwischen 0,00 und 1,00.', () => why);
    check('the handler was found in ui-net.js', BIND.length > 200);
    e.up2();
    check('a step of 0.01 from 0.50 reaches the carrier as 51 (whole percent), with the events the handler sends, and the field shows "0.51"', carrier.value === '51' && carrier.events.join() === 'input,change' && e.input.value === '0.51' && toasts.length === 0, carrier.value + ' / ' + e.input.value);
    e.down2(); e.down2();
    check('...down twice: 49', carrier.value === '49' && e.input.value === '0.49');
    e.input.value = '1.00'; carrier.value = '100'; e.api.refresh();
    check('at the top (max 1) the up chevron is disabled and a step does nothing (the carrier is not touched)', e.up.getAttribute('aria-disabled') === 'true' && (carrier.events.length = 0, e.api.step(1) === false) && carrier.value === '100' && carrier.events.length === 0);
    // without bounds on the stepper the handler still clamps, says so and restores - exactly as for a typed value
    const f = build({ opts: { step: 0.01, round: 2, format: v => v.toFixed(2) }, type: 'text', start: '1.00' });
    const toasts2 = [], carrier2 = { value: '100', events: [], dispatchEvent(ev) { this.events.push(ev.type); return true; } };
    const bind2 = new Function('UI', 'Event', BIND + '\nreturn bindExact;')({ normalizeNumber: f.UI.normalizeNumber, toast: m => toasts2.push(m) }, class { constructor(type) { this.type = type; } });
    bind2(f.input, carrier2, 0, 1, 'MSG', () => null);
    f.up2();
    check('with no bound on the stepper, 1.00 + 0.01 passes the handler: it clamps to 1.00, says the notice ("MSG") and shows 1.00 (clamp, notice and restore stay the handler\'s)', carrier2.value === '100' && toasts2.join() === 'MSG' && f.input.value === '1.00', carrier2.value + ' / ' + f.input.value + ' / ' + toasts2.join());
    why = 'Netz gilt nicht'; e.input.value = '0.40'; carrier.value = '40'; carrier.events.length = 0; e.api.refresh();
    e.up2();
    check('with the net not applicable the handler refuses (the reason as a notice), restores the carrier\'s value and the stepper has written nothing lasting', carrier.value === '40' && toasts.includes('Netz gilt nicht') && e.input.value === '0.40' && carrier.events.length === 0, carrier.value + ' / ' + e.input.value);
});

console.log('\n== source ==');
T('source', () => {
    const src = UI_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const body = src.slice(src.indexOf('function stepRule('), src.indexOf('// ---- aria-pressed'));
    check('the write is input.value = fmt(v) followed by exactly two dispatches, input then change, each { bubbles: true }; nothing else of the page is written by the stepper', /input\.value = fmt\(v\);[\s\S]{0,80}input\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\);\s*input\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\);/.test(body));
    check('the defaults: noTyping defaults to "has no compute", readonly to "step rule and no typing"; a hidden / range carrier is excluded', /const noTyping = opts\.noTyping !== undefined \? !!opts\.noTyping : ruleMode;/.test(body) && /const readonly = opts\.readonly !== undefined \? !!opts\.readonly : \(ruleMode && noTyping\);/.test(body) && /\^\(text\|number\|tel\|search\|\)\$/.test(body));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
