// Guard for the rail's toggle state (rail rearrangement, commit 2): the REAL ui.js and the REAL ui-rail.js in a vm with a fake DOM. No browser.
//   node tools/ui/test-rail-state.js
//   UI_JS=... UI_RAIL_JS=... node tools/ui/test-rail-state.js        (sabotage runs)
//
// What. (1) aria-pressed: the rail's toggles (Nodes, Fill, Curve, Free, Free Endpoints, Alternative Net) carry their state only as the class 'active', which sketch.js's handlers - and the
// session restore, while the popover is closed - set. ui-rail.js mirrors the class into aria-pressed on every UI.onSync tick: both directions, after a restore, for a disabled button, and not on
// an action. (2) The state dot on Mehr (.has-state) is on exactly while one of the four toggles INSIDE the popover is on; Fill (outside it) does not count, and sketch.js's "Fill on turns Curve
// off" is a class change like any other. (3) The name line (#more-name, aria-hidden): the state and name of the last icon that got a pointerdown / focusin / mouse pointerover, refreshed on every
// tick, empty (a hint) when nothing was touched, reset when the popover closes, and written only when the text changed (so nothing reflows).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const UI_SRC = fs.readFileSync(process.env.UI_JS || path.join(ROOT, 'ui.js'), 'utf8');
const RAIL_SRC = fs.readFileSync(process.env.UI_RAIL_JS || path.join(ROOT, 'ui-rail.js'), 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 140)); } };

function makeEl(id, extra) {
    const attrs = {}, handlers = {}, cls = new Set();
    let text = '', writes = 0;
    const el = Object.assign({
        id, dataset: {}, style: {}, handlers, hidden: false, disabled: false, tabIndex: 0, offsetParent: {},
        getAttribute: k => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); }, removeAttribute: k => { delete attrs[k]; }, hasAttribute: k => k in attrs,
        addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); },
        classList: { contains: c => cls.has(c), add: c => { cls.add(c); }, remove: c => { cls.delete(c); }, toggle: (c, on) => { const want = on === undefined ? !cls.has(c) : !!on; if (want) cls.add(c); else cls.delete(c); return want; } },
        get textContent() { return text; }, set textContent(v) { text = String(v); writes++; },
        get writes() { return writes; },
        closest: s => (s === 'button' ? el : null), contains: n => n === el, focus() { }, getBoundingClientRect: () => ({ left: 0, right: 40, top: 0, bottom: 40 }),
        querySelectorAll: () => [],
        dispatch(type, ev) { const e = Object.assign({ type, target: el, stopPropagation() { }, preventDefault() { } }, ev || {}); for (const h of (handlers[type] || [])) h(e); return e; },
    }, extra || {});
    return el;
}

function build() {
    const ids = ['btn-toggle-nodes', 'btn-toggle-curve', 'btn-toggle-faces', 'btn-toggle-free', 'btn-toggle-free-endpoints', 'btn-alternative-net', 'btn-restart', 'btn-undo', 'btn-info', 'btn-save', 'btn-clear', 'btn-paste-pattern'];
    const B = {};
    ids.forEach(id => { B[id] = makeEl(id); });
    B['btn-toggle-nodes'].classList.add('active');
    const names = { 'btn-toggle-nodes': 'Toggle Nodes', 'btn-toggle-curve': 'Toggle Curve', 'btn-toggle-faces': 'Toggle Face Fill', 'btn-toggle-free': 'Toggle Free Clothing', 'btn-toggle-free-endpoints': 'Toggle Free Endpoints', 'btn-alternative-net': 'Alternative Net Construction (click two points, then a third to confirm the side)', 'btn-restart': 'Neu anfangen' };
    Object.keys(names).forEach(id => B[id].setAttribute('aria-label', names[id]));
    const inRow = new Set(['btn-toggle-curve', 'btn-toggle-free', 'btn-toggle-free-endpoints', 'btn-alternative-net', 'btn-restart']);
    const more = makeEl('btn-more-rail'), panel = makeEl('more-rail', { hidden: true }), row = makeEl('more-row');
    row.contains = n => inRow.has(n.id);
    const nameEl = makeEl('more-name'), state = makeEl('state'), label = makeEl('label');
    nameEl.querySelector = s => (/state/.test(s) ? state : /label/.test(s) ? label : null);
    const sel = { '#btn-more-rail': more, '#more-rail': panel, '#more-rail .more-row': row, '#more-name': nameEl, '#btn-info': B['btn-info'], '#info-card': makeEl('info-card') };
    const docH = {};
    const document = { visibilityState: 'visible', activeElement: null, getElementById: id => B[id] || (id === 'overlay-scrim' ? null : null), querySelector: s => sel[s] || null, querySelectorAll: () => [], addEventListener: (t, fn) => { (docH[t] = docH[t] || []).push(fn); } };
    const ctx = vm.createContext({ document, console, MutationObserver: class { observe() { } }, setTimeout, clearTimeout, performance: { now: () => 0 } });
    ctx.window = ctx; ctx.matchMedia = () => ({ matches: false }); ctx.innerWidth = 1200; ctx.addEventListener = () => { };
    vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    vm.runInContext(RAIL_SRC, ctx, { filename: 'ui-rail.js' });
    const sync = () => ctx.window.uiSync();
    // events bubble from an icon to the row's listeners: dispatch on the row with the icon as the target (the fake DOM has no bubbling of its own)
    const fire = (type, id, ev) => row.dispatch(type, Object.assign({ target: B[id] }, ev || {}));
    return { fire, B, more, panel, row, nameEl, state, label, sync, ctx,
        set: (id, on) => { if (on) B[id].classList.add('active'); else B[id].classList.remove('active'); },
        pressed: id => B[id].getAttribute('aria-pressed') };
}

console.log('== aria-pressed follows the class ==');
T('pressed', () => {
    const e = build();
    check('on load the toggles already carry aria-pressed (Nodes starts on, the others off)', e.pressed('btn-toggle-nodes') === 'true' && ['btn-toggle-curve', 'btn-toggle-faces', 'btn-toggle-free', 'btn-toggle-free-endpoints', 'btn-alternative-net'].every(id => e.pressed(id) === 'false'));
    e.set('btn-toggle-curve', true); e.set('btn-toggle-nodes', false); e.sync();
    check('a class added shows as aria-pressed="true" on the next tick, a class removed as "false"', e.pressed('btn-toggle-curve') === 'true' && e.pressed('btn-toggle-nodes') === 'false');
    e.set('btn-toggle-curve', false); e.sync();
    check('...and back again (both directions, more than once)', e.pressed('btn-toggle-curve') === 'false'); e.set('btn-toggle-curve', true); e.sync(); check('...on again', e.pressed('btn-toggle-curve') === 'true');
    // a restore: sketch.js sets the classes directly (showNodes, curveType, freeEndpointsEnabled ...) while the popover is closed, then draws
    const r = build();
    ['btn-toggle-curve', 'btn-toggle-free-endpoints', 'btn-alternative-net', 'btn-toggle-faces'].forEach(id => r.set(id, true)); r.set('btn-toggle-nodes', false);
    check('the popover is closed during the restore', r.panel.hidden === true);
    r.sync();
    check('after a restore (classes set while the popover is closed) the next tick has aria-pressed right on all six toggles', ['btn-toggle-curve', 'btn-toggle-free-endpoints', 'btn-alternative-net', 'btn-toggle-faces'].every(id => r.pressed(id) === 'true') && r.pressed('btn-toggle-nodes') === 'false' && r.pressed('btn-toggle-free') === 'false');
    // a disabled button (Curve and Free while a net transform is active) keeps following the class
    const d = build(); d.B['btn-toggle-curve'].disabled = true; d.B['btn-toggle-free'].disabled = true; d.set('btn-toggle-curve', true); d.sync();
    check('a disabled Curve button still follows the class (pressed while disabled)', d.pressed('btn-toggle-curve') === 'true' && d.B['btn-toggle-curve'].disabled === true);
    d.set('btn-toggle-curve', false); d.sync();
    check('...and un-presses while still disabled; the mirror does not touch the disabled state', d.pressed('btn-toggle-curve') === 'false' && d.B['btn-toggle-curve'].disabled === true && d.B['btn-toggle-free'].disabled === true);
    check('actions and openers get NO aria-pressed (Undo, Info, Download, Clear, Paste Pattern, Neu anfangen, Mehr)', ['btn-undo', 'btn-info', 'btn-save', 'btn-clear', 'btn-paste-pattern', 'btn-restart'].every(id => d.B[id].getAttribute('aria-pressed') === null) && d.more.getAttribute('aria-pressed') === null);
    const w = build(); let n = 0; const orig = w.B['btn-toggle-curve'].setAttribute; w.B['btn-toggle-curve'].setAttribute = (k, v) => { if (k === 'aria-pressed') n++; orig(k, v); };
    w.sync(); w.sync(); w.sync();
    check('an unchanged state writes no attribute (three ticks, no write)', n === 0, n + ' writes');
});

console.log('\n== the state dot on Mehr ==');
T('dot', () => {
    const e = build();
    check('nothing in the popover is on: no dot (Nodes on does not count)', !e.more.classList.contains('has-state'));
    e.set('btn-toggle-curve', true); e.sync();
    check('Curve on: the dot is on, with the popover closed', e.more.classList.contains('has-state') && e.panel.hidden === true);
    // sketch.js: Fill on turns Curve off (class removed from Curve, added to Fill)
    e.set('btn-toggle-curve', false); e.set('btn-toggle-faces', true); e.sync();
    check('Fill on turns Curve off (sketch.js): the dot follows, it goes off (Fill is outside the popover)', !e.more.classList.contains('has-state'));
    e.set('btn-toggle-faces', false); e.set('btn-toggle-curve', true); e.sync();
    check('...and Curve on turns Fill off: the dot is on again', e.more.classList.contains('has-state') && e.pressed('btn-toggle-faces') === 'false');
    for (const id of ['btn-toggle-free', 'btn-toggle-free-endpoints', 'btn-alternative-net']) {
        const x = build(); x.set(id, true); x.sync();
        check(`${id} on: the dot is on; off again: the dot is off`, x.more.classList.contains('has-state') && (x.set(id, false), x.sync(), !x.more.classList.contains('has-state')));
    }
    const r = build(); ['btn-toggle-free-endpoints', 'btn-alternative-net'].forEach(id => r.set(id, true)); r.sync();
    check('a restore with the popover closed shows the dot', r.panel.hidden === true && r.more.classList.contains('has-state'));
    r.set('btn-toggle-free-endpoints', false); r.sync();
    check('one of two still on: the dot stays', r.more.classList.contains('has-state'));
});

console.log('\n== the name line ==');
T('name', () => {
    const e = build();
    check('nothing touched: a short hint and no state', e.state.textContent === '' && e.label.textContent === 'Symbol antippen');
    e.panel.hidden = false;
    e.fire('pointerdown', 'btn-toggle-curve', { pointerType: 'touch' });
    check('a pointerdown (touch) on Curve: the name is its aria-label, the state "aus"', e.label.textContent === 'Toggle Curve' && e.state.textContent === 'aus · ', e.state.textContent + e.label.textContent);
    e.set('btn-toggle-curve', true); e.sync();
    check('the tap that turned it on: the next tick shows "an" without another event', e.state.textContent === 'an · ' && e.label.textContent === 'Toggle Curve');
    e.fire('focusin', 'btn-restart');
    check('a focusin on "Neu anfangen": its name, no state (an action)', e.label.textContent === 'Neu anfangen' && e.state.textContent === '');
    e.fire('pointerover', 'btn-toggle-free', { pointerType: 'touch' });
    check('a pointerover from a touch or pen is ignored (nothing depends on hover)', e.label.textContent === 'Neu anfangen');
    e.fire('pointerover', 'btn-toggle-free', { pointerType: 'mouse' });
    check('a mouse pointerover shows that icon', e.label.textContent === 'Toggle Free Clothing' && e.state.textContent === 'aus · ');
    e.fire('focusin', 'btn-alternative-net');
    check('the long Alternative Net label is shown whole (the box clamps it, the text is not cut here)', e.label.textContent.startsWith('Alternative Net Construction (click two points'));
    // touching something outside the row (the rail's Undo) changes nothing
    const before = e.label.textContent; e.fire('pointerdown', 'btn-undo', { pointerType: 'mouse' });
    check('an icon outside the popover (Undo) does not change the line', e.label.textContent === before && (e.row.handlers.pointerdown || []).length === 1);
    const w0 = e.label.writes + e.state.writes; e.sync(); e.sync(); e.sync();
    check('three ticks with nothing changed write nothing (no reflow)', e.label.writes + e.state.writes === w0, (e.label.writes + e.state.writes - w0) + ' writes');
    e.panel.hidden = true; e.sync();
    check('closing the popover empties the line (the hint) on the next tick', e.label.textContent === 'Symbol antippen' && e.state.textContent === '');
    const types = Object.keys(e.row.handlers).sort().join(',');
    check('the row listens to pointerdown, focusin and pointerover (the touch path is pointerdown, not hover or focus alone)', types === 'focusin,pointerdown,pointerover', types);
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
