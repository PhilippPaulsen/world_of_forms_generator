// Guard for the notification component (notices commit 9): the pure model (ui.js: window.noticeModel, loaded in a vm WITHOUT a document), the DOM it builds (the REAL ui.js in a vm with a
// fake DOM and injected timers), and the source text of index.html, style.css, ui.js and the call sites. No browser.
//   node tools/ui/test-notices.js
//   INDEX_HTML=... STYLE_CSS=... UI_JS=... node tools/ui/test-notices.js        (sabotage runs)
//
// What it pins. UI.notify(text, { key, kind, ttl, sticky }) and UI.notifyClear(key) are the ONE component; UI.toast(text, ms) is a thin wrapper over it. The container #ui-notices is always
// rendered (a live region: role="status", aria-live="polite", NEVER toggled with `hidden`), notices are inserted into it and removed from it; at most two (a third replaces the oldest);
// the duration is clamp(3000 + 50 x length, 4000, 9000) ms unless a ttl is given; the timer stops while the pointer is over a notice or the focus is inside it and restarts on leave; a text of
// 60 or more characters (or a sticky notice) has a close button; Escape closes the newest; a press outside notices closes the non-sticky ones, a press inside does not; a keyed notice is shown
// once per condition (updated in place while it shows, not shown again after a dismissal until UI.notifyClear(key)).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css'), UI_SRC = read('UI_JS', 'ui.js');
const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };
const J = x => JSON.stringify(x);
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const x = n => 'x'.repeat(n);

// ================= 1. the pure model (no document at all) =================
console.log('== the model (ui.js loaded WITHOUT a document) ==');
T('model', () => {
    const ctx = vm.createContext({ console });
    ctx.window = ctx;
    vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    const M = ctx.noticeModel;
    check('ui.js loads without a document (no throw), exports the model as window.noticeModel and builds no UI', !!M && ['noticeTtl', 'noticeNeedsClose', 'noticeKind', 'noticeEvictions', 'createKeyState'].every(k => typeof M[k] === 'function') && ctx.UI === undefined);
    check('noticeTtl: clamp(3000 + 50 x length, 4000, 9000): 0 chars 4000 (the floor), 20 chars 4000, 21 chars 4050, 60 chars 6000, 100 chars 8000, 120 chars 9000 (the cap), 500 chars 9000', [[0, 4000], [20, 4000], [21, 4050], [60, 6000], [100, 8000], [120, 9000], [500, 9000]].every(([n, ms]) => M.noticeTtl(x(n)) === ms) && M.noticeTtl(null) === 4000 && M.noticeTtl(undefined) === 4000);
    check('noticeTtl: an explicit ttl wins (not clamped: 2500 stays 2500, 15000 stays 15000); 0, a negative or a non-number ttl falls back to the default', M.noticeTtl(x(100), 2500) === 2500 && M.noticeTtl(x(10), 15000) === 15000 && M.noticeTtl(x(100), 0) === 8000 && M.noticeTtl(x(100), -5) === 8000 && M.noticeTtl(x(100), 'x') === 8000 && M.noticeTtl(x(100), undefined) === 8000);
    check('noticeNeedsClose: 59 characters no, 60 yes (the threshold), sticky yes at any length, an empty text no', M.noticeNeedsClose(x(59)) === false && M.noticeNeedsClose(x(60)) === true && M.noticeNeedsClose(x(1), true) === true && M.noticeNeedsClose('') === false && M.noticeNeedsClose(null) === false && M.CLOSE_AT === 60);
    check('noticeKind: info, warn, error; anything else is info', ['info', 'warn', 'error'].every(k => M.noticeKind(k) === k) && M.noticeKind('danger') === 'info' && M.noticeKind(undefined) === 'info' && M.noticeKind(null) === 'info');
    check('noticeEvictions: at most two are visible - with 0 or 1 showing none make room, with 2 showing one goes (the oldest), with 3 two', M.noticeEvictions(0) === 0 && M.noticeEvictions(1) === 0 && M.noticeEvictions(2) === 1 && M.noticeEvictions(3) === 2 && M.MAX_VISIBLE === 2);
    const ks = M.createKeyState();
    check('keys: no key always shows; a new key shows; while it is showing a second call UPDATES; after it is gone it is SKIPPED; clear(key) lets it show again', ks.decide(null) === 'show' && ks.decide(undefined) === 'show' && ks.decide('a') === 'show' && (ks.showing('a'), ks.decide('a') === 'update') && (ks.gone('a'), ks.decide('a') === 'skip' && ks.state('a') === 'done') && (ks.clear('a'), ks.decide('a') === 'show' && ks.state('a') === 'none'));
    const k2 = M.createKeyState();
    check('keys: gone() on a key that is not showing changes nothing (it is not "done" before it ever showed); clear() of an unknown key does not throw; keys are independent; a key is not an object property (a "constructor" key works)', (k2.gone('b'), k2.decide('b') === 'show') && (k2.clear('zzz'), true) && (k2.showing('p'), k2.showing('q'), k2.gone('p'), k2.decide('p') === 'skip' && k2.decide('q') === 'update') && k2.decide('constructor') === 'show' && (k2.showing('constructor'), k2.decide('constructor') === 'update'));
});

// ================= 2. the DOM: the REAL ui.js in a fake DOM, injected timers =================
console.log('\n== the DOM (the real ui.js, a fake DOM, injected timers) ==');
class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this._a = {}; this.dataset = {}; this.handlers = {}; this._c = new Set(); this.style = {}; this.hidden = false; this._text = ''; this.id = ''; }
    set className(v) { this._c = new Set(String(v).split(/\s+/).filter(Boolean)); } get className() { return [...this._c].join(' '); }
    get classList() { const s = this._c; return { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c), toggle: (c, on) => { const w = on === undefined ? !s.has(c) : !!on; if (w) s.add(c); else s.delete(c); return w; } }; }
    setAttribute(k, v) { this._a[k] = String(v); } getAttribute(k) { return k in this._a ? this._a[k] : null; } removeAttribute(k) { delete this._a[k]; } hasAttribute(k) { return k in this._a; }
    addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; if (this.ownerDoc && this.ownerDoc.activeElement && c.contains(this.ownerDoc.activeElement)) this.ownerDoc.activeElement = null; return c; }   // a removed focused element drops the focus (to the body), like a browser
    get parentNode() { return this.parent; }
    get isConnected() { let e = this; while (e.parent) e = e.parent; return e === this.ownerDoc.root; }
    set textContent(v) { this._text = String(v); this.children.forEach(c => { c.parent = null; }); this.children = []; } get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set innerHTML(v) { this._html = String(v); this.children = []; } get innerHTML() { return this._html; }
    contains(n) { for (let e = n; e; e = e.parent) if (e === this) return true; return false; }
    closest(sel) { for (let e = this; e; e = e.parent) if (sel.startsWith('.') && e._c.has(sel.slice(1))) return e; return null; }
    focus() { this.focusCount = (this.focusCount || 0) + 1; this.ownerDoc.activeElement = this; this.dispatch('focusin', {}, true); if (this.ownerDoc.fireDoc) this.ownerDoc.fireDoc('focusin', { target: this }); }
    dispatch(type, ev, bubble) { const e = Object.assign({ type, target: this, stopPropagation() { }, preventDefault() { }, detail: 1 }, ev || {}); for (let n = this; n; n = bubble === false ? null : n.parent) { (n.handlers[type] || []).forEach(h => { e.currentTarget = n; h(e); }); if (type === 'pointerenter' || type === 'pointerleave') break; } return e; }
}
function build(o) {
    o = o || {};
    const byId = {}, docH = {}, timers = [], clock = { t: 0, id: 0 };
    const doc = { activeElement: null, visibilityState: 'visible', documentElement: {}, body: null, legacy: [], createElement: tag => { const e = new El(tag); e.ownerDoc = doc; return e; }, getElementById: id => byId[id] || null,
        addEventListener(t, fn) { (docH[t] = docH[t] || []).push(fn); }, querySelector: () => null, querySelectorAll(sel) { return /\.toast/.test(sel) ? doc.legacy.filter(n => !n.hidden) : []; } };
    doc.root = doc.createElement('div'); doc.fireDoc = (type, ev) => { (docH[type] || []).forEach(h => h(Object.assign({ type, preventDefault() { }, stopPropagation() { } }, ev))); };
    const host = o.noHost ? null : doc.createElement('div'); if (host) { host.id = 'ui-notices'; host.className = 'notices'; byId['ui-notices'] = host; doc.root.appendChild(host); }
    const outside = tag => { const el = doc.createElement(tag || 'input'); doc.root.appendChild(el); return el; };   // an element outside the container, in the document
    const ctx = vm.createContext({ document: doc, console, MutationObserver: class { observe() { } }, performance: { now: () => clock.t },
        setTimeout: (fn, ms) => { const id = ++clock.id; timers.push({ id, fn, at: clock.t + (ms || 0), ms: ms || 0 }); return id; },
        clearTimeout: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); } });
    ctx.window = ctx; ctx.matchMedia = () => ({ matches: false }); ctx.addEventListener = () => { };
    vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    const advance = ms => { const end = clock.t + ms; for (;;) { const due = timers.filter(t => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0]; if (!due) break; clock.t = due.at; timers.splice(timers.indexOf(due), 1); due.fn(); } clock.t = end; };
    const fire = (type, ev) => { const e = Object.assign({ type, target: ev && ev.target || null, preventDefault() { }, stopPropagation() { }, key: undefined }, ev || {}); (docH[type] || []).forEach(h => h(e)); return e; };
    const texts = () => (host ? host.children.map(n => n.children[0].textContent) : []);
    const legacy = (hidden) => { const n = doc.createElement('div'); n.className = 'limit-note toast'; n.hidden = !!hidden; doc.legacy.push(n); return n; };
    return { UI: ctx.UI, ctx, doc, host, timers, advance, fire, texts, legacy, clock, docH, outside };
}

T('dom', () => {
    let e = build();
    const UI = e.UI;
    check('UI exports notify, notifyClear, toast and hideToast', ['notify', 'notifyClear', 'toast', 'hideToast'].every(k => typeof UI[k] === 'function'));
    const el = UI.notify(x(10) + 'a', {});
    check('UI.notify inserts ONE child into #ui-notices: the notice (class "notice notice-info") with the text in a span.notice-text, the full text as its title; the container itself is never hidden (no `hidden`, still role/aria-live by the markup)', e.host.children.length === 1 && el === e.host.children[0] && el.className === 'notice notice-info' && el.children.length === 1 && el.children[0].className === 'notice-text' && el.children[0].textContent === x(10) + 'a' && el.getAttribute('title') === x(10) + 'a' && e.host.hidden === false);
    check('the container is only appended to and removed from: after the notice has expired the container is empty and still not hidden; the component never writes `hidden` on it', (e.advance(4000), e.host.children.length === 0 && e.host.hidden === false));
    e = build();
    e.doc.activeElement = e.doc.body = null;
    const before = e.doc.activeElement; e.UI.notify(x(80));
    check('no focus stealing: showing a notice (with a close button) changes nothing about document.activeElement', e.doc.activeElement === before && e.host.children.length === 1);
    e = build();
    check('kinds: warn and error give their class, anything else is info', [['warn', 'notice notice-warn'], ['error', 'notice notice-error'], ['bogus', 'notice notice-info'], [undefined, 'notice notice-info']].every(([k, c], i) => { const n = e.UI.notify('kind ' + i, { kind: k }); return n.className === c; }));
    // the close button threshold
    e = build();
    const n59 = e.UI.notify(x(59)), n60 = e.UI.notify(x(60));
    check('the close button: a 59-character text has none (a timer alone), a 60-character text has one', n59.children.length === 1 && n60.children.length === 2 && n60.children[1].tagName === 'BUTTON');
    const cb = n60.children[1];
    check('the close button is a real <button type="button"> with the German accessible name "Hinweis schließen" (UI.name: aria-label and title), data-i18n="notice.close", the --target classes (icon-btn notice-close) and it is a SIBLING of the text span (the announced text node does not contain it)', cb.type === 'button' && cb.getAttribute('aria-label') === 'Hinweis schließen' && cb.getAttribute('title') === 'Hinweis schließen' && cb.getAttribute('data-i18n') === 'notice.close' && cb.className === 'icon-btn notice-close' && n60.children[0].children.length === 0 && n60.children[0].contains(cb) === false);
    e = build(); const ns = e.UI.notify('short', { sticky: true });
    check('a sticky notice has a close button at any length and never expires', ns.children.length === 2 && (e.advance(60000), e.host.children.length === 1));
    // the cap of two
    e = build(); e.UI.notify('one'); e.UI.notify('two'); e.UI.notify('three');
    check('at most TWO notices: the third replaces the oldest (the newest is last, at the bottom)', J(e.texts()) === J(['two', 'three']));
    e.UI.notify('four');
    check('...and a fourth the one after that', J(e.texts()) === J(['three', 'four']));
    // durations
    e = build(); e.UI.notify(x(20));
    e.advance(3999); const still = e.host.children.length; e.advance(1);
    check('a short text (20 characters) lasts at least 4 s: there at 3999 ms, gone at 4000 ms', still === 1 && e.host.children.length === 0);
    e = build(); e.UI.notify(x(60));
    e.advance(5999); const still60 = e.host.children.length; e.advance(1);
    check('a 60-character text lasts 6000 ms', still60 === 1 && e.host.children.length === 0);
    e = build(); e.UI.notify(x(300));
    e.advance(8999); const still300 = e.host.children.length; e.advance(1);
    check('a long text lasts up to 9000 ms and not longer (the cap)', still300 === 1 && e.host.children.length === 0);
    e = build(); e.UI.notify(x(300), { ttl: 2500 }); e.advance(2499); const stillT = e.host.children.length; e.advance(1);
    check('an explicit ttl wins (2500 ms)', stillT === 1 && e.host.children.length === 0);
    e = build(); e.UI.toast(x(10), 7000); e.advance(6999); const stillW = e.host.children.length; e.advance(1);
    check('UI.toast(text, ms) is the thin wrapper: it notifies with ttl = ms (7000 ms here), without a key', stillW === 1 && e.host.children.length === 0 && (e.UI.toast('a'), e.UI.toast('a'), e.host.children.length === 2));
    // pause and restart
    e = build(); const nh = e.UI.notify(x(20));
    e.advance(1000); nh.dispatch('pointerenter', {}, false); e.advance(30000);
    const pausedHover = e.host.children.length; nh.dispatch('pointerleave', {}, false); e.advance(3999); const afterLeave = e.host.children.length; e.advance(1);
    check('the pointer over a notice pauses the timer (still there 30 s later); on leave it restarts the full duration (there at +3999 ms, gone at +4000 ms)', pausedHover === 1 && afterLeave === 1 && e.host.children.length === 0);
    e = build(); const nf = e.UI.notify(x(80));
    e.advance(2000); nf.children[1].focus(); e.advance(40000);
    const pausedFocus = e.host.children.length; nf.dispatch('focusout', { relatedTarget: null }, false); e.advance(6999); const afterBlur = e.host.children.length; e.advance(1);
    check('focus inside a notice pauses the timer; when it leaves the timer restarts (80 characters: 7000 ms)', pausedFocus === 1 && afterBlur === 1 && e.host.children.length === 0);
    e = build(); const nf2 = e.UI.notify(x(70));
    nf2.children[1].focus(); nf2.dispatch('focusout', { relatedTarget: nf2.children[1] }, false); e.advance(60000);
    check('focus moving WITHIN the notice (relatedTarget inside) does not restart the timer', e.host.children.length === 1);
    e = build(); const nb = e.UI.notify(x(20));
    nb.dispatch('pointerenter', {}, false); nb.children[0]; e.UI.notify(x(20));
    check('a notice that is hovered keeps its timer stopped while another notice runs its own', (e.advance(5000), e.host.children.length === 1 && e.host.children[0] === nb));
    // Escape
    e = build(); e.UI.notify('first'); e.UI.notify('second');
    e.fire('keydown', { key: 'Escape' });
    check('Escape closes the NEWEST notice only', J(e.texts()) === J(['first']));
    e.fire('keydown', { key: 'a' }); e.fire('keydown', { key: 'Escape' });
    check('...another key does nothing; the next Escape closes the last one; Escape with none showing does not throw', e.host.children.length === 0 && (e.fire('keydown', { key: 'Escape' }), true));
    e = build(); const lg = e.legacy(false); e.UI.notify('one');
    e.fire('keydown', { key: 'Escape' });
    check('the legacy `.toast` (#node-count-note, sketch.js) is still hidden by Escape, as before', lg.hidden === true && e.host.children.length === 0);
    // pointerdown
    e = build(); e.UI.notify('plain'); e.UI.notify('sticky', { sticky: true });
    const inside = e.host.children[0], outsideEl = e.doc.createElement('div');
    e.fire('pointerdown', { target: inside.children[0] });
    check('a press INSIDE a notice closes nothing', e.host.children.length === 2);
    e.fire('pointerdown', { target: outsideEl });
    check('a press OUTSIDE closes the non-sticky notices and leaves the sticky one', J(e.texts()) === J(['sticky']));
    e = build(); const lg2 = e.legacy(false); e.fire('pointerdown', { target: outsideEl });
    check('a press outside also hides the legacy `.toast` (the sketch\'s own note), one inside it does not', lg2.hidden === true && (() => { const l3 = e.legacy(false); e.fire('pointerdown', { target: l3 }); return l3.hidden === false; })());
    // the close button
    e = build(); const a1 = e.UI.notify(x(70)), a2 = e.UI.notify(x(80));
    a1.children[1].dispatch('click', {}, false);
    check('the close button closes ITS notice only', e.host.children.length === 1 && e.host.children[0] === a2);
    e = build(); e.UI.notify(x(70)); e.UI.notify(x(90)); e.UI.hideToast();
    check('UI.hideToast closes every non-sticky notice', e.host.children.length === 0);
    // keys
    e = build(); const k1 = e.UI.notify('first text', { key: 'net' });
    e.advance(3000); const k2 = e.UI.notify('second text', { key: 'net' });
    check('a keyed notice that is showing is UPDATED in place: the same element, no stacking, the new text', k1 === k2 && e.host.children.length === 1 && e.texts()[0] === 'second text' && k1.getAttribute('title') === 'second text');
    e.advance(3000); const alive = e.host.children.length; e.advance(1001);
    check('...and its timer starts again (3 s + 3 s later it is still there, gone 4 s after the update)', alive === 1 && e.host.children.length === 0);
    check('after it has EXPIRED the same key is not shown again (notify returns null, nothing is inserted)', e.UI.notify('again', { key: 'net' }) === null && e.host.children.length === 0);
    e.UI.notifyClear('net');
    check('UI.notifyClear(key) ends the condition: the same key shows again', e.UI.notify('back', { key: 'net' }) !== null && e.texts()[0] === 'back');
    e.fire('keydown', { key: 'Escape' });
    check('after a dismissal (Escape) the key is not shown again either', e.UI.notify('no', { key: 'net' }) === null && e.host.children.length === 0);
    e.UI.notifyClear('net'); const kc = e.UI.notify(x(70), { key: 'net' }); kc.children[1].dispatch('click', {}, false);
    check('...nor after the close button; notifyClear first, then it shows', e.UI.notify('no', { key: 'net' }) === null && (e.UI.notifyClear('net'), e.UI.notify('yes', { key: 'net' }) !== null));
    e.UI.notifyClear('net'); e.UI.notify('m', { key: 'net' });
    check('notifyClear of a SHOWING notice closes it (the condition ended) and the key may show again', (e.UI.notifyClear('net'), e.host.children.length === 0) && e.UI.notify('m2', { key: 'net' }) !== null);
    e = build(); e.UI.notify('k', { key: 'a' }); e.UI.notify('b'); e.UI.notify('c');
    check('a keyed notice replaced by the cap counts as gone: it is not shown again until notifyClear', J(e.texts()) === J(['b', 'c']) && e.UI.notify('k2', { key: 'a' }) === null && (e.UI.notifyClear('a'), e.UI.notify('k3', { key: 'a' }) !== null));
    e = build(); e.UI.notify('same'); e.UI.notify('same');
    check('without a key every call shows (two notices with the same text stack, up to the cap)', e.host.children.length === 2);
    e = build(); const up = e.UI.notify('short', { key: 'g' }); const upl = e.UI.notify(x(70), { key: 'g' }); const ups = e.UI.notify('short again', { key: 'g' });
    check('an update changes the close button with the text: none at 5 characters, one at 70, none again at 11', up === upl && upl === ups && ups.children.length === 1 && e.host.children.length === 1);
    e = build({ noHost: true });
    check('a page without #ui-notices: notify and toast return null and do not throw, notifyClear and hideToast neither', e.UI.notify('x') === null && e.UI.toast('x') === null && (e.UI.notifyClear('k'), e.UI.hideToast(), true));
    e = build();
    check('an empty text shows nothing', e.UI.notify('') === null && e.UI.notify(null) === null && e.UI.toast('') === null && e.host.children.length === 0);
    {   // ---- the focus goes back when the person closes a notice that holds it (a block of its own: the names are local) ----
    const closeBtn = n => n.children[1];
    let fe = build(); const inp = fe.outside('input'); inp.focus();
    let fn = fe.UI.notify(x(70), { ttl: 120000 });
    check('a notice appearing never takes the focus: the focus stays on the input, and the input was not "focused" again', fe.doc.activeElement === inp && inp.focusCount === 1);
    closeBtn(fn).focus(); fe.fire('keydown', { key: 'Enter' }); closeBtn(fn).dispatch('click', { detail: 0 }, false);
    check('ENTER on the close button (a click with detail 0): the notice closes and the focus is back on the element that had it before (the input)', fe.host.children.length === 0 && fe.doc.activeElement === inp);
    fe = build(); const inp2 = fe.outside('input'); inp2.focus(); fn = fe.UI.notify(x(70), { ttl: 120000 });
    closeBtn(fn).focus(); fe.fire('keydown', { key: ' ' }); closeBtn(fn).dispatch('click', { detail: 0 }, false);
    check('SPACE on the close button: the same, back on the input', fe.host.children.length === 0 && fe.doc.activeElement === inp2);
    fe = build(); const inp3 = fe.outside('input'); inp3.focus(); fn = fe.UI.notify(x(70), { ttl: 120000 });
    closeBtn(fn).focus(); closeBtn(fn).dispatch('click', { detail: 1 }, false);
    check('a mouse click on the close button (detail 1, the button has the focus): the same', fe.host.children.length === 0 && fe.doc.activeElement === inp3);
    fe = build(); const inp4 = fe.outside('input'); inp4.focus(); fn = fe.UI.notify(x(70), { ttl: 120000 });
    closeBtn(fn).focus(); fe.fire('keydown', { key: 'Escape' });
    check('ESCAPE while the focus is on the close button: the notice closes and the focus is back on the input', fe.host.children.length === 0 && fe.doc.activeElement === inp4);
    fe = build(); const fa = fe.outside('input'), fb = fe.outside('input'); fa.focus(); fb.focus(); fe.UI.notify(x(70), { ttl: 120000 });
    fe.fire('keydown', { key: 'Escape' });
    check('Escape while the focus is ELSEWHERE (on an input, not in the notice) closes the newest and does not move the focus (still on b, a is not "returned" to)', fe.host.children.length === 0 && fe.doc.activeElement === fb && fb.focusCount === 1 && fa.focusCount === 1);
    fe = build(); const inp5 = fe.outside('input'); inp5.focus(); fe.UI.notify(x(30)); fe.advance(10000);
    check('a notice that EXPIRES while the focus is elsewhere does not move it (the input was focused once)', fe.host.children.length === 0 && fe.doc.activeElement === inp5 && inp5.focusCount === 1);
    fe = build(); const inp6 = fe.outside('input'); inp6.focus(); const ev1 = fe.UI.notify(x(70), { ttl: 120000 }); closeBtn(ev1).focus(); fe.UI.notify('two'); fe.UI.notify('three');
    check('a notice that holds the focus and is REPLACED by the cap (not closed by the person) does not move the focus: the input was focused once, the focus dropped with the element', J(fe.texts()) === J(['two', 'three']) && inp6.focusCount === 1 && fe.doc.activeElement === null);
    fe = build(); const inp7 = fe.outside('input'); inp7.focus(); const hk = fe.UI.notify(x(70), { ttl: 120000, key: 'k' }); closeBtn(hk).focus(); fe.UI.notifyClear('k'); fe.UI.notify(x(70), { ttl: 120000 }); closeBtn(fe.host.children[0]).focus(); fe.UI.hideToast();
    check('notifyClear and hideToast (the program, not the person) never move the focus', inp7.focusCount === 1 && fe.doc.activeElement === null);
    // fallback: the recorded element is gone
    fe = build(); const gone = fe.outside('input'); gone.focus(); const na = fe.UI.notify('A ' + x(70), { ttl: 120000 }), nb = fe.UI.notify('B ' + x(70), { ttl: 120000 });
    fe.doc.root.removeChild(gone); closeBtn(nb).focus(); closeBtn(nb).dispatch('click', { detail: 0 }, false);
    check('the recorded element was REMOVED from the DOM in between: the focus goes to the close button of the remaining newest notice (A)', fe.host.children.length === 1 && fe.host.children[0] === na && fe.doc.activeElement === closeBtn(na));
    fe = build(); const gone2 = fe.outside('input'); gone2.focus(); const solo = fe.UI.notify(x(70), { ttl: 120000 }); fe.doc.root.removeChild(gone2); closeBtn(solo).focus(); closeBtn(solo).dispatch('click', { detail: 0 }, false);
    check('...and with no notice left the focus is left alone (nothing is focused: the browser\'s body)', fe.host.children.length === 0 && fe.doc.activeElement === null);
    fe = build(); const dis = fe.outside('button'); dis.focus(); const sn = fe.UI.notify(x(70), { ttl: 120000 }); dis.disabled = true; closeBtn(sn).focus(); closeBtn(sn).dispatch('click', { detail: 0 }, false);
    check('a recorded element that is no longer focusable (disabled) is not focused: the focus is left alone', dis.focusCount === 1 && fe.doc.activeElement === null);
    fe = build(); const keep = fe.outside('input'); keep.focus(); const o1 = fe.UI.notify('A ' + x(70), { ttl: 120000 }), o2 = fe.UI.notify('B ' + x(70), { ttl: 120000 });
    closeBtn(o1).focus(); closeBtn(o2).focus(); closeBtn(o2).dispatch('click', { detail: 0 }, false);
    check('the recorded element is the last one OUTSIDE the container: after the focus moved over the notices\' own buttons, closing the newest returns to the input, not to the other notice\'s button', fe.doc.activeElement === keep && keep.focusCount === 2);
    fe = build(); const f1 = fe.outside('input'), f2 = fe.outside('input'); f1.focus(); f2.focus(); const m1 = fe.UI.notify(x(70), { ttl: 120000 }); closeBtn(m1).focus(); closeBtn(m1).dispatch('click', { detail: 0 }, false);
    check('the LAST outside element wins (f2, not f1)', fe.doc.activeElement === f2);
    }
    // the disabled-control reason goes through the same path
    e = build(); const btn = e.doc.createElement('button'); btn.ownerDoc = e.doc; e.UI.setDisabled(btn, 'Keine Ebene aktiv.'); e.UI.guard(btn, () => { }); btn.dispatch('click', { detail: 1 });
    check('a UI.setDisabled reason (a tap on the aria-disabled control) shows as a notice through UI.toast: "Keine Ebene aktiv." (5 s default ttl of the call site)', J(e.texts()) === J(['Keine Ebene aktiv.']) && (e.advance(4999), e.host.children.length === 1) && (e.advance(1), e.host.children.length === 0));
});

// ================= 3. the markup, the CSS, the source =================
console.log('\n== the markup, the CSS and the call sites ==');
T('source', () => {
    const cont = (HTML.match(/<div id="ui-notices"[^>]*>/) || [''])[0];
    check('index.html: #ui-notices is an always-rendered container: class "notices", role="status", aria-live="polite", NO hidden attribute, empty; the old #ui-toast is gone', /^<div id="ui-notices" class="notices" role="status" aria-live="polite">$/.test(cont) && /<div id="ui-notices"[^>]*><\/div>/.test(HTML) && !/id="ui-toast"/.test(HTML) && !/ui-toast/.test(strip(UI_SRC)));
    check('index.html: #node-count-note stays EXACTLY as it was (a legacy .toast sketch.js writes into: class "limit-note toast", role="status", hidden) and the container comes after it in the body', /<div id="node-count-note" class="limit-note toast" role="status" hidden><\/div>/.test(HTML) && HTML.indexOf('id="node-count-note"') < HTML.indexOf('id="ui-notices"') && HTML.indexOf('id="ui-notices"') < HTML.indexOf('<script src="https://cdn.jsdelivr.net'));
    const css = strip(CSS);
    const rule = sel => { const m = css.match(new RegExp('(?:^|\\})\\s*' + sel.replace(/[.#]/g, '\\$&') + '\\s*\\{([^}]*)\\}')); return m ? m[1] : ''; };
    const nt = rule('.notices'), nn = rule('.notice');
    check('style.css .notices: fixed, centred (left 50% + translateX(-50%)), z-index 60, width min(92vw, 480px), a flex column with an 8px gap, the container does not catch the pointer', /position:\s*fixed/.test(nt) && /left:\s*50%/.test(nt) && /transform:\s*translateX\(-50%\)/.test(nt) && /z-index:\s*60/.test(nt) && /width:\s*min\(92vw, 480px\)/.test(nt) && /display:\s*flex/.test(nt) && /flex-direction:\s*column/.test(nt) && /gap:\s*8px/.test(nt) && /pointer-events:\s*none/.test(nt));
    check('style.css .notices: bottom is calc(16px + env(safe-area-inset-bottom, 0px)) - the safe-area inset is 0 in the pane, so the expression itself is pinned', /bottom:\s*calc\(16px \+ env\(safe-area-inset-bottom, 0px\)\)/.test(nt));
    check('style.css .notice: the toast look (background, text, radius tokens) plus a 3px left border; the notice catches the pointer; nothing is filled', /pointer-events:\s*auto/.test(nn) && /background:\s*var\(--color-bg\)/.test(nn) && /color:\s*var\(--color-text\)/.test(nn) && /border-radius:\s*var\(--radius\)/.test(nn) && /border-left-width:\s*3px/.test(nn) && /border:\s*1px solid var\(--color-text\)/.test(nn));
    check('style.css kinds: info = the text colour token, warn = a neutral grey token (--color-secondary), error = --danger (the left border colour only)', /\.notice-info\s*\{\s*border-left-color:\s*var\(--color-text\);\s*\}/.test(css) && /\.notice-warn\s*\{\s*border-left-color:\s*var\(--color-secondary\);\s*\}/.test(css) && /\.notice-error\s*\{\s*border-left-color:\s*var\(--danger\);\s*\}/.test(css));
    const tx = rule('.notice-text'), cl = rule('.notice .notice-close');
    check('style.css: the text is clamped to three lines (-webkit-line-clamp: 3), the close button is --target square and does not shrink', /-webkit-line-clamp:\s*3/.test(tx) && /overflow:\s*hidden/.test(tx) && /width:\s*var\(--target\)/.test(cl) && /height:\s*var\(--target\)/.test(cl) && /flex:\s*none/.test(cl));
    const block = css.slice(css.indexOf('.notices {'), css.indexOf('.notice .notice-close {') + 200);
    check('no animation and no transition in the notices rules (nothing to reduce under prefers-reduced-motion), no @keyframes for them', !/animation|transition|@keyframes/.test(block) && !/@keyframes[^{]*notice/.test(css));
    check('style.css: the legacy .toast rule stays for #node-count-note (fixed, bottom 16px, z-index 60)', /\.toast\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*16px[^}]*z-index:\s*60/.test(css) && /\.toast\[hidden\]\s*\{\s*display:\s*none;\s*\}/.test(css));
    const ui = strip(UI_SRC);
    check('ui.js: the container is fetched by id once and never written with `hidden`; the component removes children with removeChild and appends with appendChild', (ui.match(/getElementById\('ui-notices'\)/g) || []).length === 1 && !/noticesEl\(\)\.hidden|host\.hidden/.test(ui) && /host\.appendChild\(n\.el\)/.test(ui) && /n\.el\.parentNode\.removeChild\(n\.el\)/.test(ui));
    check('ui.js: Escape closes the newest (notices[notices.length - 1]); a press outside closes only when the target is not inside a .notice; the timer restarts on pointerleave and focusout, stops on pointerenter and focusin', /removeNotice\(notices\[notices\.length - 1\], true\)/.test(ui) && /!\(e\.target && e\.target\.closest && e\.target\.closest\('\.notice'\)\)/.test(ui) && /'pointerenter'[\s\S]{0,80}stopTimer/.test(ui) && /'pointerleave'[\s\S]{0,80}startTimer/.test(ui) && /'focusin'[\s\S]{0,80}stopTimer/.test(ui) && /'focusout'[\s\S]{0,200}startTimer/.test(ui));
    check('ui.js: the close button is made by syncClose from the model\'s noticeNeedsClose, named through UI.name with data-i18n "notice.close" and the German text "Hinweis schließen", with a plain click listener', /M\.noticeNeedsClose\(/.test(ui) && /setAttribute\('data-i18n', 'notice\.close'\)/.test(ui) && /name\(b, NOTICE_TEXT\['notice\.close'\]\)/.test(ui) && /'notice\.close': 'Hinweis schließen'/.test(ui) && /b\.addEventListener\('click', function \(\) \{ removeNotice\(n, true\); \}\)/.test(ui));
    check('ui.js: the last focus OUTSIDE the container is recorded by a capture focusin listener that ignores targets inside it; only the close button and Escape pass byPerson (removeNotice(..., true) twice), the cap, the expiry, hideToast and notifyClear do not; the return tries the recorded element if it is connected and enabled, then the newest remaining close button', /document\.addEventListener\('focusin', function \(e\) \{[\s\S]{0,160}!\(host && host\.contains\(e\.target\)\)\) lastOutsideFocus = e\.target;[\s\S]{0,20}\}, true\);/.test(ui) && (ui.match(/removeNotice\([^)]*, true\)/g) || []).length === 2 && /el\.isConnected !== false && !el\.disabled && !el\.hidden/.test(ui) && /left\.closeBtn\.focus\(\)/.test(ui) && /if \(hadFocus\) returnFocus\(\);/.test(ui));
    check('ui.js: toast is a one-line wrapper over notify with ttl = ms; the key states are never touched by toast', /function toast\(text, ms\) \{ return notify\(text, \{ ttl: ms \}\); \}/.test(ui) && /window\.UI = \{[^}]*notify: notify, notifyClear: notifyClear, toast: toast, hideToast: hideToast/.test(ui));
    // the call sites: unchanged
    const files = { 'ui.js': UI_SRC, 'ui-net.js': rd('ui-net.js'), 'ui-farbe.js': rd('ui-farbe.js'), 'ui-layers.js': rd('ui-layers.js'), 'sketch.js': rd('sketch.js') };
    const calls = {};
    Object.keys(files).forEach(f => { const c = strip(files[f]); calls[f] = (c.match(/\b(?:UI\.)?toast\(/g) || []).length - (f === 'ui.js' ? 1 : 0); });   // minus the definition in ui.js
    check('the call sites of the toast are the same as before, signatures unchanged: ui.js 4 (showReason, the stepper\'s typed limit, blocked step, step note), ui-net.js 2 (the typed limits), ui-farbe.js 1 (the Farborgel error), ui-layers.js 1 (the diamond refusal), sketch.js 1 (the net notes)', J(calls) === J({ 'ui.js': 4, 'ui-net.js': 2, 'ui-farbe.js': 1, 'ui-layers.js': 1, 'sketch.js': 1 }), J(calls));
    check('no call site passes a key or options yet (the routing commit does): every UI.toast( call has the text and at most a number', Object.keys(files).every(f => !/\bUI\.toast\([^)]*\{/.test(strip(files[f]))));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
