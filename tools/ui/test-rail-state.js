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

let lastFocus = null;   // the element focus() was called on last
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
        closest: s => (s === 'button' ? el : null), contains: n => n === el, focus() { lastFocus = el; }, getBoundingClientRect: () => ({ left: 0, right: 40, top: 0, bottom: 40 }),
        querySelectorAll: () => [],
        dispatch(type, ev) { const e = Object.assign({ type, target: el, stopPropagation() { }, preventDefault() { } }, ev || {}); for (const h of (handlers[type] || [])) h(e); return e; },
    }, extra || {});
    return el;
}

function build(farbe) {
    const ids = ['btn-toggle-nodes', 'btn-toggle-curve', 'btn-toggle-faces', 'btn-toggle-free', 'btn-toggle-free-endpoints', 'btn-alternative-net', 'btn-restart', 'btn-undo', 'btn-info', 'btn-save', 'btn-clear', 'btn-paste-pattern', 'btn-gallery', 'btn-face-colors-reset'];
    const B = {};
    ids.forEach(id => { B[id] = makeEl(id); });
    B['btn-toggle-nodes'].classList.add('active');
    const names = { 'btn-save': 'Download Image', 'btn-gallery': 'Formorgel (öffnet in neuem Tab)', 'btn-toggle-nodes': 'Toggle Nodes', 'btn-toggle-curve': 'Toggle Curve', 'btn-toggle-faces': 'Toggle Face Fill', 'btn-toggle-free': 'Toggle Free Clothing', 'btn-toggle-free-endpoints': 'Toggle Free Endpoints', 'btn-alternative-net': 'Alternative Net Construction (click two points, then a third to confirm the side)', 'btn-restart': 'Neu anfangen' };
    Object.keys(names).forEach(id => B[id].setAttribute('aria-label', names[id]));
    const inRow = new Set(['btn-toggle-curve', 'btn-toggle-free', 'btn-toggle-free-endpoints', 'btn-alternative-net', 'btn-restart']);
    // the phone layout (ui-phone.js) adds a second icon row, .more-extra, with the former rail buttons
    const inExtra = new Set(['btn-gallery', 'btn-paste-pattern', 'btn-info', 'btn-save', 'btn-clear'].concat(farbe ? ['btn-face-colors-reset', 'btn-toggle-nodes'] : []));   // Farbe (phone layout, commit 2) adds Reset Color and Nodes
    const more = makeEl('btn-more-rail'), panel = makeEl('more-rail', { hidden: true }), row = makeEl('more-row'), extraRow = makeEl('more-extra');
    row.contains = n => inRow.has(n.id);
    extraRow.contains = n => inExtra.has(n.id);
    panel.contains = n => inRow.has(n.id) || inExtra.has(n.id) || n === panel;
    // closest() as the DOM answers it for the two selectors ui-rail.js asks: the nearest button or link, and the nearest .more-row / .more-extra
    // closest() as the DOM answers it for the selectors ui-rail.js asks (a selector list is a list: 'button, a' matches a button OR a link; the catalog link is an <a>)
    const tagOf = id => (id === 'btn-gallery' ? 'a' : 'button');
    const matches = (id, part) => {
        const b = B[id], tag = tagOf(id), ex = inExtra.has(id);
        if (part === 'button' || part === 'a') return part === tag;
        if (part === '.more-row') return inRow.has(id) || ex;
        if (part === '.more-extra a') return ex && tag === 'a';
        if (part === '.more-extra button') return ex && tag === 'button';
        if (part === '.more-extra button:not(#btn-info)') return ex && tag === 'button' && id !== 'btn-info';
        let m;
        if ((m = /^\.more-extra #([\w-]+)$/.exec(part))) return ex && id === m[1];
        if ((m = /^#([\w-]+)$/.exec(part))) return id === m[1];
        throw new Error('fake closest: unknown selector part ' + part);
    };
    ids.forEach(id => { B[id].closest = sel => (sel.split(',').map(x => x.trim()).some(p => matches(id, p)) ? (sel === '.more-row' ? row : B[id]) : null); });
    const nameEl = makeEl('more-name'), state = makeEl('state'), label = makeEl('label');
    nameEl.querySelector = s => (/state/.test(s) ? state : /label/.test(s) ? label : null);
    const sel = { '#btn-more-rail': more, '#more-rail': panel, '#more-rail .more-row': row, '#more-name': nameEl, '#btn-info': B['btn-info'], '#info-card': makeEl('info-card') };
    const exportBtn = makeEl('export-png');   // a button inside the export dialog (it is not in the sheet)
    const docH = {};
    const document = { visibilityState: 'visible', activeElement: null, getElementById: id => B[id] || (id === 'overlay-scrim' ? null : null), querySelector: s => sel[s] || null, querySelectorAll: () => [], addEventListener: (t, fn) => { (docH[t] = docH[t] || []).push(fn); } };
    const ctx = vm.createContext({ document, console, MutationObserver: class { observe() { } }, setTimeout, clearTimeout, performance: { now: () => 0 } });
    ctx.window = ctx; ctx.matchMedia = () => ({ matches: false }); ctx.innerWidth = 1200; ctx.addEventListener = () => { };
    vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    vm.runInContext(RAIL_SRC, ctx, { filename: 'ui-rail.js' });
    const sync = () => ctx.window.uiSync();
    // events bubble from an icon to the sheet's listeners: dispatch on the sheet with the icon as the target (the fake DOM has no bubbling of its own)
    const fire = (type, id, ev) => panel.dispatch(type, Object.assign({ target: B[id] }, ev || {}));
    return { fire, exportBtn, document, B, more, panel, row, extraRow, nameEl, state, label, sync, ctx,
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
    check('an icon outside the popover (Undo) does not change the line', e.label.textContent === before && (e.panel.handlers.pointerdown || []).length === 1);
    const w0 = e.label.writes + e.state.writes; e.sync(); e.sync(); e.sync();
    check('three ticks with nothing changed write nothing (no reflow)', e.label.writes + e.state.writes === w0, (e.label.writes + e.state.writes - w0) + ' writes');
    e.panel.hidden = true; e.sync();
    check('closing the popover empties the line (the hint) on the next tick', e.label.textContent === 'Symbol antippen' && e.state.textContent === '');
    const types = Object.keys(e.panel.handlers).filter(t => t !== 'keydown').sort().join(',');   // keydown is UI.overlay's (Escape, the Tab loop)
    check('the sheet listens to pointerdown, focusin and pointerover (the touch path is pointerdown, not hover or focus alone), and to mousedown and click for the second row', types === 'click,focusin,mousedown,pointerdown,pointerover', types);
});

console.log('\n== the second icon row of the phone layout (.more-extra) ==');
T('extra', () => {
    const e = build();
    e.panel.hidden = false;
    e.fire('pointerdown', 'btn-save', { pointerType: 'touch' });
    check('a pointerdown on Download (second row) names it: its aria-label, no state (an action)', e.label.textContent === 'Download Image' && e.state.textContent === '', e.state.textContent + '|' + e.label.textContent);
    e.fire('focusin', 'btn-gallery');
    check('a focusin on the catalog link (an <a>) names it too', e.label.textContent === 'Formorgel (öffnet in neuem Tab)', e.label.textContent);
    e.fire('pointerdown', 'btn-toggle-curve', { pointerType: 'touch' });
    check('the first row still works next to it (Curve: name and state)', e.label.textContent === 'Toggle Curve' && e.state.textContent === 'aus · ');
    // the sheet closes when a second-row action is used; a first-row toggle leaves it open
    const o = build();
    o.more.dispatch('click');
    check('the More button opens the sheet', o.panel.hidden === false);
    o.fire('click', 'btn-toggle-curve'); o.fire('mousedown', 'btn-toggle-curve');
    check('a press on a first-row toggle leaves the sheet open', o.panel.hidden === false);
    // Clear, Paste Pattern and Download are wired on the MOUSEDOWN (p5 mousePressed), and Download\'s dialog covers the button: the sheet closes on the mousedown, and the browser\'s focus default is cancelled
    for (const id of ['btn-save', 'btn-clear', 'btn-paste-pattern']) {
        if (o.panel.hidden) o.more.dispatch('click');
        lastFocus = null; o.document.activeElement = o.B[id];
        let prevented = 0; const was = o.panel.hidden;
        o.fire('mousedown', id, { preventDefault() { prevented++; } });
        check(`a mousedown on ${id} (second row) closes the sheet, cancels the focus default (the button is gone) and puts the focus on the Mehr button`, was === false && o.panel.hidden === true && prevented === 1 && lastFocus === o.more, 'prevented ' + prevented + ', focus ' + (lastFocus && lastFocus.id));
    }
    // a dialog that opened on that mousedown has the focus already (UI.dialog): the sheet must not take it back
    if (o.panel.hidden) o.more.dispatch('click');
    lastFocus = null; o.document.activeElement = o.exportBtn; o.fire('mousedown', 'btn-save', { preventDefault() { } });
    check('Download: the dialog that its mousedown opened keeps the focus (the sheet closes, the focus is not moved)', o.panel.hidden === true && lastFocus === null);
    // Info and the catalog link are click-driven: a mousedown on them closes nothing (the button would be gone before its click), the click does
    if (o.panel.hidden) o.more.dispatch('click');
    let pd = 0; o.fire('mousedown', 'btn-info', { preventDefault() { pd++; } }); o.fire('mousedown', 'btn-gallery', { preventDefault() { pd++; } });
    check('a mousedown on Info or on the catalog link neither closes the sheet nor cancels the default (their action is the click)', o.panel.hidden === false && pd === 0);
    o.B['btn-info'].dispatch('click');
    check('Info: its click opens the info card, which closes the sheet (one overlay at a time; its own overlay does it)', o.panel.hidden === true);
    o.more.dispatch('click'); lastFocus = null;
    o.fire('click', 'btn-gallery');
    check('the catalog link: its click closes the sheet and the focus goes back to the Mehr button (a link needs its click to navigate)', o.panel.hidden === true && lastFocus === o.more);
    // Farbe (phone layout, commit 2): Reset Color and Nodes are in the second row. Reset Color is wired on the CLICK (sketch.js), so a mousedown must not close the sheet (the click would never come and the
    // button would do nothing); it closes on the click, like Info. Nodes (a toggle, p5 mousedown) closes on the click too.
    const fb = build(true);
    for (const id of ['btn-face-colors-reset', 'btn-toggle-nodes']) {
        const o = fb;
        if (o.panel.hidden) o.more.dispatch('click');
        let pdx = 0; o.fire('mousedown', id, { preventDefault() { pdx++; } });
        check(`a mousedown on ${id} (Farbe's second row) neither closes the sheet nor cancels the default: its click must arrive`, o.panel.hidden === false && pdx === 0);
        lastFocus = null; o.fire('click', id);
        check(`the click on ${id} closes the sheet and the focus goes back to the Mehr button`, o.panel.hidden === true && lastFocus === o.more);
    }
    // the dot rule is about the toggles in the first row only: nothing in the second row can set or clear it
    const d = build(); d.set('btn-toggle-curve', true); d.sync(); d.fire('click', 'btn-save'); d.sync();
    check('the state dot covers the toggles; using a second-row action does not touch it', d.more.classList.contains('has-state'));
    // nothing in the second row has a state of its own (Info is the opener of its own card, Download and Clear are actions, Paste Pattern an action, Formorgel a link): a class 'active' there is not a state of the sheet
    const n = build(); ['btn-info', 'btn-save', 'btn-clear', 'btn-paste-pattern', 'btn-gallery'].forEach(id => n.set(id, true)); n.sync();
    check('the dot covers the four toggles of the first row and nothing of the second: second-row buttons marked active do not light it', !n.more.classList.contains('has-state'));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
