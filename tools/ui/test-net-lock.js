// Guard for the net lock (notices commit 11): while a net transform is active, Curve, Free and Fill are LOCKED with UI.setDisabled (aria-disabled, focusable, the reason shown as a notice on a tap,
// a click or a long press) instead of the native `disabled`; a locked control must provably do nothing; a free one must toggle exactly as before. Four parts: the SOURCE of sketch.js / ui-rail.js /
// style.css / index.html; the LOCK BLOCK of netControlsSync() extracted from sketch.js and run for every condition in a vm; the three toggle HANDLERS (curve, free, fill) extracted from sketch.js and run
// in a vm (locked: nothing changes; unlocked: they toggle and exclude each other as before); and the whole path (a keyboard Enter / Space through ui.js's bridge, a mouse press, a tap, a long press) with
// the REAL ui.js in a fake DOM and injected timers. The conditions live inline in setup() (netControlsSync), so the real file cannot be loaded here; they were also checked in the browser pane.
//   node tools/ui/test-net-lock.js
//   SKETCH_JS=... UI_RAIL_JS=... STYLE_CSS=... INDEX_HTML=... UI_JS=... node tools/ui/test-net-lock.js        (sabotage runs)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const SKETCH = read('SKETCH_JS', 'sketch.js'), RAIL = read('UI_RAIL_JS', 'ui-rail.js'), CSS = read('STYLE_CSS', 'style.css'), HTML = read('INDEX_HTML', 'index.html'), UI_SRC = read('UI_JS', 'ui.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };
const J = x => JSON.stringify(x);
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const sk = strip(SKETCH);
// the text of a call's callback body: from `head` to the matching `});`
const callbackBody = (src, head) => { const i = src.indexOf(head); if (i < 0) return ''; let d = 0, j = src.indexOf('{', i); const k = j; for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(k + 1, j); } return ''; };

const REASON_NET = 'Off while a net transform is active. Set the net back to Regular (Base sheet, square) to use curves again.';
const REASON_FACE_FIELD = 'Face fills on a Field: the base sheet and layers on the base grid (same shape and size, no offset, no rotation) only';
const REASON_FACE_OTHER = 'Off while a net transform is active (faces are exact only on a Field)';

// ================= 1. the source =================
console.log('== the source ==');
T('source', () => {
    check('sketch.js: btnLocked(b) = native disabled OR aria-disabled; lockBtn(b, reason) = UI.setDisabled(b.elt, reason) (the native disabled only as the fallback of a page without ui.js)', /function btnLocked\(b\) \{ return !!b && \(b\.elt\.disabled \|\| b\.elt\.getAttribute\('aria-disabled'\) === 'true'\); \}/.test(sk) && /function lockBtn\(b, reason\) \{\s*if \(window\.UI && UI\.setDisabled\) UI\.setDisabled\(b\.elt, reason\);\s*else b\.elt\.disabled = !!reason;/.test(sk));
    check('the GUARDS: each of the three handlers (Curve, Free, Fill) starts with `if (btnLocked(<its button>)) return;` as its FIRST statement - they used to rely on the native disabled to stop the mousedown that p5 listens for', /curveBtn\.mousePressed\(\(\) => \{\s*if \(btnLocked\(curveBtn\)\) return;/.test(sk) && /freeBtn\.mousePressed\(\(\) => \{\s*if \(btnLocked\(freeBtn\)\) return;/.test(sk) && /faceBtn\.mousePressed\(\(\) => \{\s*if \(btnLocked\(faceBtn\)\) return;/.test(sk) && count(sk, /if \(btnLocked\(/g) === 3);
    check('the lock block of netControlsSync: Curve and Free lockBtn(b, active ? "Off while a net transform is active. Set the net back to Regular (Base sheet, square) to use curves again." : null); Fill lockBtn(faceBtn, !active || faceOk ? null : (isField ? <Field reason> : <other reason>)); faceOk = isField && active && (activeLayer === \'base\' || layerGridMatchesBase(layer)); written only when lockSig changes', /\[curveBtn, freeBtn\]\.filter\(Boolean\)\.forEach\(b => lockBtn\(b, active \? 'Off while a net transform is active\. Set the net back to Regular \(Base sheet, square\) to use curves again.' : null\)\);/.test(sk) && /if \(faceBtn\) lockBtn\(faceBtn, !active \|\| faceOk \? null : \(isField \? 'Face fills on a Field[^']*' : 'Off while a net transform is active \(faces are exact only on a Field\)'\)\);/.test(sk) && /const faceOk = isField && active && \(activeLayer === 'base' \|\| layerGridMatchesBase\(additionalLayers\[activeLayer\]\)\);/.test(sk) && /const lockSig = `\$\{active\}\|\$\{faceOk\}\|\$\{isField && active\}`;\s*if \(lockSig !== wasActive\) \{/.test(sk));
    check('nothing sets the native disabled on the three buttons any more (only the fallback inside lockBtn) and the lock never writes their title by hand', !/(curveBtn|freeBtn|faceBtn)\.elt\.disabled\s*=/.test(sk) && !/b\.elt\.disabled = active/.test(sk) && !/(curveBtn|freeBtn|faceBtn)\.elt\.title\s*=/.test(sk));
    check('the exclusion of Curve, Free and Fill is untouched: Curve turns Free and Fill off, Free turns Curve and Fill off, Fill on turns the curve type to straight and Curve and Free off', /curveBtn\.addClass\('active'\);\s*freeBtn && freeBtn\.removeClass\('active'\);\s*setActiveShowFaces\(false\);\s*faceBtn && faceBtn\.removeClass\('active'\);/.test(sk) && /freeBtn\.addClass\('active'\);\s*curveBtn && curveBtn\.removeClass\('active'\);\s*setActiveShowFaces\(false\);\s*faceBtn && faceBtn\.removeClass\('active'\);/.test(sk) && /if \(next\) \{\s*curveType = \{ kind: 'straight' \};\s*curveBtn && curveBtn\.removeClass\('active'\);\s*freeBtn && freeBtn\.removeClass\('active'\);/.test(sk) && /if \(active && curveType\.kind !== 'straight'\) \{/.test(sk));
    const rail = strip(RAIL);
    check('ui-rail.js gives the three locked toggles their reason on a tap, a click and a long press: UI.guard(<button>, noop) for #btn-toggle-curve, #btn-toggle-free and #btn-toggle-faces (an unlocked one is not touched: sketch.js\'s own handler toggles it)', /\['btn-toggle-curve', 'btn-toggle-free', 'btn-toggle-faces'\]\.forEach\(function \(id\) \{ const b = document\.getElementById\(id\); if \(b\) UI\.guard\(b, function \(\) \{ \}\); \}\);/.test(rail));
    const css = strip(CSS);
    check('style.css: the locked three look as the native disabled ones did (opacity 0.35, not-allowed) and have no hover fill (the hover rule is inside @media (hover: hover))', /#btn-toggle-curve\[aria-disabled="true"\], #btn-toggle-free\[aria-disabled="true"\], #btn-toggle-faces\[aria-disabled="true"\] \{ opacity: 0\.35; cursor: not-allowed; \}/.test(css) && /@media \(hover: hover\) \{\s*#btn-toggle-curve\[aria-disabled="true"\]:hover, #btn-toggle-free\[aria-disabled="true"\]:hover, #btn-toggle-faces\[aria-disabled="true"\]:hover \{ background: var\(--background\); \}\s*\}/.test(css));
    check('the long note #net-locks-note is gone (markup, CSS, writers); #timeline-net-warning stays in the DOM unwritten and hidden (a test needs the element) and sketch.js no longer writes it', !/net-locks-note/.test(HTML + CSS + sk) && /<div id="timeline-net-warning" hidden><\/div>/.test(HTML) && !/includeNetWarn|timeline-net-warning/.test(sk));
    const info = (SKETCH.match(/fieldInfo\.html\(`([^`]*)`\)/) || [, ''])[1];
    check('the Field sentence about face fills is not lost: #net-field-info carries it (same words) while a net is active on a Field', /Face fills are exact on a Field and work for the base sheet and for layers on the base grid \(same shape and size, no offset, no rotation - every timeline playback layer\); other layers are not filled\./.test(info) && /fieldInfo\.elt\.hidden = !\(active && isField\);/.test(sk));
});
function count(s, re) { return (s.match(re) || []).length; }

// ================= 2. the lock block, extracted, for every condition =================
console.log('\n== the lock block of netControlsSync (extracted) ==');
const BLOCK = (() => { const a = SKETCH.indexOf('            const faceOk = isField && active'), b = SKETCH.indexOf('wasActive = lockSig;'); return a >= 0 && b > a ? SKETCH.slice(a, b + 'wasActive = lockSig;'.length) + '\n            }' : ''; })();
function lockRun() {
    const calls = [];
    const factory = new Function('lockBtn', 'curveBtn', 'freeBtn', 'faceBtn', 'layerGridMatchesBase', 'additionalLayers', 'let wasActive = null; return function (isField, active, activeLayer) {\n' + BLOCK.replace(/\n            \}$/, '\n            }') + '\n};');
    const mk = n => ({ n });
    const fn = factory((b, reason) => calls.push([b.n, reason]), mk('curve'), mk('free'), mk('face'), l => !!l.onBase, [{ onBase: true }, { onBase: false }]);
    return { sync: fn, calls };
}
T('lock', () => {
    check('the block was found in sketch.js (faceOk ... wasActive = lockSig)', BLOCK.length > 300 && /lockBtn\(b, active/.test(BLOCK));
    let r = lockRun(); r.sync(false, false, 'base');
    check('NO net active: Curve, Free and Fill are all unlocked (reason null) - also on a layer tab', J(r.calls) === J([['curve', null], ['free', null], ['face', null]]) && (() => { const q = lockRun(); q.sync(false, false, 1); return J(q.calls) === J([['curve', null], ['free', null], ['face', null]]); })());
    r = lockRun(); r.sync(false, true, 'base');
    check('a net active on Single or Tiled (not a Field), Base sheet: Curve and Free locked with "Off while a net transform is active. Set the net back to Regular (Base sheet, square) to use curves again."; Fill locked with "Off while a net transform is active (faces are exact only on a Field)"', J(r.calls) === J([['curve', REASON_NET], ['free', REASON_NET], ['face', REASON_FACE_OTHER]]));
    r = lockRun(); r.sync(false, true, 0);
    check('...the same from a layer tab (the warp is set on the Base sheet, it is in force everywhere)', J(r.calls) === J([['curve', REASON_NET], ['free', REASON_NET], ['face', REASON_FACE_OTHER]]));
    r = lockRun(); r.sync(true, true, 'base');
    check('a net active on a FIELD, Base sheet: Curve and Free locked; Fill is FREE (faces are exact on a Field for the Base)', J(r.calls) === J([['curve', REASON_NET], ['free', REASON_NET], ['face', null]]));
    r = lockRun(); r.sync(true, true, 0);
    check('a net on a Field, a layer ON the base grid (same shape and size, no offset, no rotation): Fill is free', J(r.calls) === J([['curve', REASON_NET], ['free', REASON_NET], ['face', null]]));
    r = lockRun(); r.sync(true, true, 1);
    check('a net on a Field, a layer OFF the base grid: Fill locked with the Field reason "Face fills on a Field: the base sheet and layers on the base grid ... only"', J(r.calls) === J([['curve', REASON_NET], ['free', REASON_NET], ['face', REASON_FACE_FIELD]]));
    r = lockRun(); r.sync(false, true, 'base'); r.calls.length = 0; r.sync(false, true, 'base');
    check('the lock is written only when the condition changed (lockSig): the same state again writes nothing', r.calls.length === 0);
    r = lockRun(); r.sync(true, true, 'base'); r.calls.length = 0; r.sync(true, true, 1);
    check('...a change of the faceOk part alone (the layer tab changes from the Base to a layer off the grid) rewrites the locks (Fill now locked)', J(r.calls) === J([['curve', REASON_NET], ['free', REASON_NET], ['face', REASON_FACE_FIELD]]));
    r = lockRun(); r.sync(false, true, 'base'); r.calls.length = 0; r.sync(false, false, 'base');
    check('the net removed: all three UNLOCK (reason null) at once', J(r.calls) === J([['curve', null], ['free', null], ['face', null]]));
    r = lockRun(); r.sync(true, false, 'base');
    check('a Field selected but no net active (identity warp: nothing locked)', J(r.calls) === J([['curve', null], ['free', null], ['face', null]]));
});

// ================= 3. the three handlers, extracted =================
console.log('\n== the toggle handlers (extracted): locked = nothing happens, unlocked = they toggle and exclude as before ==');
function handlerWorld() {
    const log = [];
    const world = { curveType: { kind: 'straight' }, faces: false, log };
    const mkBtn = id => { const el = { disabled: false, _a: {}, getAttribute(k) { return k in this._a ? this._a[k] : null; } }; return { id, elt: el, classes: new Set(), addClass(c) { this.classes.add(c); log.push([id, '+' + c]); }, removeClass(c) { this.classes.delete(c); } }; };
    const curveBtn = mkBtn('curve'), freeBtn = mkBtn('free'), faceBtn = mkBtn('face');
    const ctx = vm.createContext({ curveType: world.curveType, curveBtn, freeBtn, faceBtn, curveFoldInput: null, curveStrengthInput: null, Math, parseInt, parseFloat,
        setActiveShowFaces: v => { world.faces = !!v; log.push(['faces', v]); }, activeShowFaces: () => world.faces, updateCurveTypeControls: () => log.push(['updateCurveTypeControls']), updateFreeVisibleToggleIcon: () => log.push(['updateFreeVisibleToggleIcon']),
        updateFaceToggleControl: () => { if (world.faces) faceBtn.addClass('active'); else faceBtn.removeClass('active'); }, redraw: () => log.push(['redraw']) });
    vm.runInContext(SKETCH.match(/function btnLocked\(b\) \{[^\n]*\}/)[0], ctx);
    const handler = (head) => { const body = callbackBody(SKETCH, head); if (!body) throw new Error('handler not found: ' + head); return vm.runInContext('(function () {' + body + '})', ctx); };
    return { ctx, world, log, curveBtn, freeBtn, faceBtn, curve: handler('curveBtn.mousePressed(() => {'), free: handler('freeBtn.mousePressed(() => {'), face: handler('faceBtn.mousePressed(() => {'), get type() { return vm.runInContext('curveType', ctx); } };
}
T('handlers', () => {
    for (const [name, btn, key] of [['Curve', 'curveBtn', 'curve'], ['Free', 'freeBtn', 'free'], ['Fill', 'faceBtn', 'face']]) {
        let w = handlerWorld(); w[btn].elt._a['aria-disabled'] = 'true'; w[key]();
        check(name + ' LOCKED (aria-disabled): the handler returns first - the curve type stays straight, no class, no fill flag, no update, no redraw (the state is byte-identical to before)', w.type.kind === 'straight' && w.world.faces === false && w.log.length === 0 && ['curveBtn', 'freeBtn', 'faceBtn'].every(b => w[b].classes.size === 0));
        w = handlerWorld(); w[btn].elt.disabled = true; w[key]();
        check(name + ' with the native disabled (the no-UI fallback) is locked too', w.log.length === 0 && w.type.kind === 'straight');
    }
    let w = handlerWorld(); w.curve();
    check('Curve UNLOCKED toggles on exactly as before: the curve type becomes "curve", the button is active, a redraw', w.type.kind === 'curve' && w.curveBtn.classes.has('active') && w.log.some(l => l[0] === 'redraw'));
    w.curve();
    check('...and off again', w.type.kind === 'straight' && !w.curveBtn.classes.has('active'));
    w = handlerWorld(); w.free();
    check('Free UNLOCKED toggles on: the curve type becomes "free", the button is active', w.type.kind === 'free' && w.freeBtn.classes.has('active') && w.log.some(l => l[0] === 'updateFreeVisibleToggleIcon'));
    w = handlerWorld(); w.world.faces = true; w.faceBtn.addClass('active'); w.curve();
    check('the EXCLUSION still works unlocked: Curve on turns Fill off (the fill flag false, its button not active) and Free off', w.type.kind === 'curve' && w.world.faces === false && !w.faceBtn.classes.has('active') && !w.freeBtn.classes.has('active'));
    w = handlerWorld(); w.curve(); w.free();
    check('...Free on turns Curve off', w.type.kind === 'free' && !w.curveBtn.classes.has('active') && w.freeBtn.classes.has('active'));
    w = handlerWorld(); w.curve(); w.face();
    check('...Fill on turns the curve type back to straight and Curve and Free off', w.world.faces === true && w.type.kind === 'straight' && !w.curveBtn.classes.has('active') && !w.freeBtn.classes.has('active') && w.faceBtn.classes.has('active'));
    w = handlerWorld(); w.face(); w.face();
    check('Fill UNLOCKED toggles on and off', w.world.faces === false && !w.faceBtn.classes.has('active'));
});

// ================= 4. the whole path with the real ui.js =================
console.log('\n== keyboard, mouse, tap and long press on a locked and on a free control (the real ui.js, a fake DOM) ==');
class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this._a = {}; this.dataset = {}; this.handlers = {}; this._c = new Set(); this.style = {}; this.hidden = false; this._text = ''; this.disabled = false; }
    set className(v) { this._c = new Set(String(v).split(/\s+/).filter(Boolean)); } get className() { return [...this._c].join(' '); }
    get classList() { const s = this._c; return { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c), toggle: (c, on) => { const w = on === undefined ? !s.has(c) : !!on; if (w) s.add(c); else s.delete(c); return w; } }; }
    setAttribute(k, v) { this._a[k] = String(v); } getAttribute(k) { return k in this._a ? this._a[k] : null; } removeAttribute(k) { delete this._a[k]; }
    addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; }
    get parentNode() { return this.parent; }
    set textContent(v) { this._text = String(v); this.children.forEach(c => { c.parent = null; }); this.children = []; } get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set innerHTML(v) { this._html = String(v); this.children = []; } get innerHTML() { return this._html; }
    contains(n) { for (let e = n; e; e = e.parent) if (e === this) return true; return false; }
    closest(sel) { for (let e = this; e; e = e.parent) { if (sel.startsWith('.') ? e._c.has(sel.slice(1)) : e.tagName.toLowerCase() === sel) return e; } return null; }
    dispatchEvent(ev) { ev.target = this; for (let n = this; n; n = n.parent) (n.handlers[ev.type] || []).forEach(h => h(ev)); return true; }
}
function whole() {
    const timers = [], clock = { t: 0, id: 0 }, dh = {};
    const doc = { activeElement: null, createElement: tag => { const e = new El(tag); e.ownerDoc = doc; return e; }, getElementById: id => id === 'ui-notices' ? host : null, querySelectorAll: () => [],
        addEventListener(t, fn) { (dh[t] = dh[t] || []).push(fn); } };
    const host = doc.createElement('div');
    class MouseEvent { constructor(type, o) { this.type = type; Object.assign(this, o || {}); } }
    const ctx = vm.createContext({ document: doc, console, MouseEvent, Event: class { constructor(t) { this.type = t; } }, MutationObserver: class { observe() { } }, performance: { now: () => clock.t },
        setTimeout: (fn, ms) => { const id = ++clock.id; timers.push({ id, fn, at: clock.t + (ms || 0) }); return id; }, clearTimeout: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); } });
    ctx.window = ctx; ctx.matchMedia = () => ({ matches: false }); ctx.addEventListener = () => { };
    vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    const advance = ms => { const end = clock.t + ms; for (;;) { const due = timers.filter(t => t.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; clock.t = due.at; timers.splice(timers.indexOf(due), 1); due.fn(); } clock.t = end; };
    const fire = (type, ev) => { const e = Object.assign({ type, preventDefault() { }, stopPropagation() { } }, ev); (dh[type] || []).forEach(h => h(e)); return e; };
    // a toggle button as sketch.js + ui-rail.js build it: p5's mousePressed = a 'mousedown' listener that runs the REAL Curve handler extracted from sketch.js (with its own guard), ui-rail's UI.guard, sketch's lockBtn
    const hw = handlerWorld();
    const btn = doc.createElement('button'); btn.id = 'btn-toggle-curve'; doc.root = btn;
    hw.curveBtn.elt = btn; hw.curveBtn.addClass = c => btn.classList.add(c); hw.curveBtn.removeClass = c => btn.classList.remove(c);
    const calls = { downs: 0, get toggles() { return hw.log.filter(l => l[0] === 'redraw').length; } };
    btn.addEventListener('mousedown', () => { calls.downs++; hw.curve(); });
    ctx.UI.guard(btn, function () { });
    const press = (kind) => {   // kind: 'key' (Enter / Space: a click with detail 0), 'mouse' (pointerdown, mousedown, click with detail 1)
        if (kind === 'key') { fire('keydown', { key: 'Enter', target: btn }); fire('click', { target: btn, detail: 0 }); btn.dispatchEvent({ type: 'click', detail: 0, preventDefault() { } }); }
        else { fire('pointerdown', { target: btn }); btn.dispatchEvent({ type: 'pointerdown' }); btn.dispatchEvent({ type: 'mousedown' }); fire('click', { target: btn, detail: 1 }); btn.dispatchEvent({ type: 'click', detail: 1, preventDefault() { } }); btn.dispatchEvent({ type: 'pointerup' }); }
    };
    return { ctx, btn, calls, press, advance, texts: () => host.children.map(n => n.children[0].textContent), fire, doc };
}
T('whole', () => {
    let W = whole(); W.ctx.UI.setDisabled(W.btn, REASON_NET);
    check('locked = aria-disabled with the reason as its title, NOT the native disabled, and the control is not hidden (it stays focusable: no disabled attribute)', W.btn.getAttribute('aria-disabled') === 'true' && W.btn.getAttribute('title') === REASON_NET && W.btn.disabled === false);
    W.press('key');
    check('ENTER or SPACE on the focused LOCKED control (a click with detail 0): the keyboard bridge does not fire a mousedown at all (aria-disabled: the handler is not even reached), nothing toggles, and the reason is shown as a notice', W.calls.downs === 0 && W.calls.toggles === 0 && !W.btn.classList.contains('active') && J(W.texts()) === J([REASON_NET]));
    W = whole(); W.ctx.UI.setDisabled(W.btn, REASON_NET); W.press('mouse');
    check('a MOUSE press or a tap on the locked control: the mousedown reaches the handler (one), whose guard returns before any change (no toggle, no active class), and the click shows the reason', W.calls.downs === 1 && W.calls.toggles === 0 && !W.btn.classList.contains('active') && J(W.texts()) === J([REASON_NET]));
    W = whole(); W.ctx.UI.setDisabled(W.btn, REASON_NET); W.btn.dispatchEvent({ type: 'pointerdown' }); W.advance(499); const early = W.texts().length; W.advance(2);
    check('a LONG PRESS (500 ms) on the locked control shows the reason (not before), and changes nothing', early === 0 && J(W.texts()) === J([REASON_NET]) && W.calls.toggles === 0);
    W = whole(); W.press('key');
    check('a FREE control, ENTER / SPACE: the bridge fires exactly one mousedown, it toggles once (aria-pressed follows the active class in ui-rail.js), no notice', W.calls.downs === 1 && W.calls.toggles === 1 && W.btn.classList.contains('active') && W.texts().length === 0);
    W = whole(); W.press('mouse'); W.press('mouse');
    check('a FREE control, mouse and tap: it toggles on and off, no notice', W.calls.toggles === 2 && !W.btn.classList.contains('active') && W.texts().length === 0);
    W = whole(); W.ctx.UI.setDisabled(W.btn, REASON_NET); W.ctx.UI.setDisabled(W.btn, null); W.press('key');
    check('a control that was locked and UNLOCKED again toggles exactly as a free one (the title is restored, aria-disabled gone)', W.btn.getAttribute('aria-disabled') === null && W.calls.toggles === 1);
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
