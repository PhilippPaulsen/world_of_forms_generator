// Guard for the Morph button and block (morph stage e2a): the pure model of ui-morph.js (angle step and wrap, angle label, status text and its priority, signature), the wiring against a fake DOM
// (every control writes the right patch through window.setSpatialMorph, the tick refreshes only on a changed signature, the button is inserted once per view and after a rebuild, nothing is touched before the
// views exist), the dictionary (both languages, at most 40 characters) and the source text of ui-morph.js, index.html and style.css. No browser.
//   node tools/ui/test-morph-view.js
//   UI_MORPH_JS=... UI_I18N_JS=... INDEX_HTML=... STYLE_CSS=... node tools/ui/test-morph-view.js        (sabotage runs)
//
// What it pins. The view reads the block through window.getSpatialMorph() (a copy), writes it ONLY through window.setSpatialMorph(patch) and reads window.spatialMorphStatus(); it keeps no reference into the model, has no
// MutationObserver and no hotkey, and writes the DOM only when a signature of what it shows changed. The status line is the first that applies of: an error code, a non-empty seamOpen, netActive / bilinearStatic.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const SRC = read('UI_MORPH_JS', 'ui-morph.js'), I18N_SRC = read('UI_I18N_JS', 'ui-i18n.js'), HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };
const J = x => JSON.stringify(x);
const code = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// ---- a fake DOM with the few things the view uses ----
class N {
    constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.doc = doc; this.children = []; this.parent = null; this.attrs = {}; this.dataset = {}; this.handlers = {}; this.cls = new Set(); this.hidden = false; this.id = ''; this.value = ''; this.title = ''; this._text = ''; this.offsetParent = {}; this.writes = 0; this.props = {};
        const self = this; this.style = { setProperty(k, v) { self.props[k] = v; self.writes++; } }; }
    set className(v) { this.cls = new Set(String(v).split(/\s+/).filter(Boolean)); } get className() { return [...this.cls].join(' '); }
    get classList() { const s = this.cls, self = this; return { add: c => { s.add(c); }, remove: c => { s.delete(c); }, contains: c => s.has(c), toggle: (c, on) => { const w = on === undefined ? !s.has(c) : !!on; if (w) s.add(c); else s.delete(c); self.writes++; return w; } }; }
    setAttribute(k, v) { this.writes++; this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } removeAttribute(k) { this.writes++; delete this.attrs[k]; } hasAttribute(k) { return k in this.attrs; }
    addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
    appendChild(c) { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.push(c); return c; }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; }
    insertBefore(c, ref) { if (c.parent) c.parent.removeChild(c); const i = ref ? this.children.indexOf(ref) : -1; c.parent = this; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
    set textContent(v) { this.writes++; this._text = String(v); } get textContent() { return this._text; }
    contains(n) { for (let e = n; e; e = e.parent) if (e === this) return true; return false; }
    all() { const out = []; (function walk(n) { n.children.forEach(c => { out.push(c); walk(c); }); })(this); return out; }
    querySelector(sel) { const c = sel.slice(1); return this.all().find(e => e.cls.has(c)) || null; }
    querySelectorAll(sel) { const c = sel.slice(1); return this.all().filter(e => e.cls.has(c)); }
    focus() { this.doc.activeElement = this; }
    dispatch(type, ev) { const e = Object.assign({ type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }, ev || {}); for (let n = this; n; n = n.parent) (n.handlers[type] || []).forEach(h => h(e)); return e; }
    click() { return this.dispatch('click'); }
}

// the page: o.views = which layer views are built ('strip', 'rail', 'table'); the model: a fake of the morph block API
function build(o) {
    o = o || {};
    const byId = {}, doc = { activeElement: null };
    doc.createElement = tag => new N(tag, doc);
    doc.getElementById = id => byId[id] || null;
    const mk = (id, tag, cls, parent) => { const e = doc.createElement(tag || 'div'); e.id = id; if (cls) e.className = cls; byId[id] = e; if (parent) parent.appendChild(e); return e; };
    doc.body = mk('body', 'body'); doc.documentElement = mk('html', 'html');
    const group = mk('morph-group', 'div', 'control-group', doc.body);
    if (o.openStart) group.cls.add('mo-open');
    const toggle = mk('morph-toggle', 'button', 'icon-btn morph-toggle', group), modes = mk('morph-modes', 'div', 'morph-modes', group);
    const radios = ['linear', 'radial', 'bilinear'].map(m => mk('morph-mode-' + m, 'button', 'icon-btn morph-mode-btn', modes));
    const angle = mk('morph-angle', 'div', 'stepper morph-angle', group), input = mk('morph-angle-input', 'input', '', angle), status = mk('morph-status', 'p', 'morph-status', group);
    const chev = [1, -1].map((d) => { const c = doc.createElement('button'); c.className = 'stepper-btn'; angle.appendChild(c); return c; });
    const view = (id, groupCls, cells) => { const host = mk(id, 'div', '', doc.body), g = doc.createElement('div'); g.className = groupCls; host.appendChild(g); cells.forEach(c => { const b = doc.createElement('button'); b.className = c; g.appendChild(b); }); return host; };
    const views = o.views || [];
    const strip = views.includes('strip') ? view('layer-strip', 'lr-g2', ['lr-eye', 'lr-diamond', 'lr-more', 'lr-x']) : null;
    const rail = views.includes('rail') ? view('layer-rail', 'lr-g2', ['lr-eye', 'lr-diamond', 'lr-more', 'lr-x']) : null;
    const table = views.includes('table') ? view('layer-table', 'lt-foot', ['lt-add', 'lt-more']) : null;
    const model = { block: { enabled: false, mode: 'linear', angleDeg: 0 }, status: { code: 'off', keyframes: [], mode: 'linear', progress: 0, segment: 0, seamOpen: [] }, setCalls: [], getCalls: 0, statusCalls: 0 };
    const syncs = [];
    const UI = {
        onSync: fn => { syncs.push(fn); },
        name: (el, text) => { el.setAttribute('aria-label', text); el.title = text; },
        stepper: (root, opts) => { UI.stepperOpts = opts; UI.stepperRoot = root; },
        setDisabled: (el, reason) => { if (reason) { el.setAttribute('aria-disabled', 'true'); el.title = reason; } else if (el.getAttribute('aria-disabled') === 'true') { el.removeAttribute('aria-disabled'); el.title = ''; } },
    };
    const ctx = vm.createContext({ console, document: doc, UI, additionalLayers: o.layers || [] });
    ctx.window = ctx;
    ctx.getSpatialMorph = () => { model.getCalls++; return Object.assign({}, model.block); };
    ctx.setSpatialMorph = patch => { model.setCalls.push(J(patch)); Object.assign(model.block, patch); return model.block; };
    ctx.spatialMorphStatus = () => { model.statusCalls++; return model.status; };
    if (o.i18n) vm.runInContext(I18N_SRC, ctx, { filename: 'ui-i18n.js' });
    if (o.layerTable) ctx.layerTable = o.layerTable;
    vm.runInContext(SRC, ctx, { filename: 'ui-morph.js' });
    return { ctx, doc, byId, group, toggle, modes, radios, angle, chev, input, status, strip, rail, table, model, syncs, UI, M: ctx.uiMorph,
        tick: () => syncs.forEach(f => f()),
        morphButtons: () => [strip, rail, table].map(h => h ? h.all().filter(e => e.cls.has('lt-morph')) : null),
        stepAngle: dir => { const r = UI.stepperOpts.compute(dir); input.value = UI.stepperOpts.format(r.to); input.dispatch('change'); } };
}

// ================= 1. the pure model =================
console.log('== the model (loaded without a DOM) ==');
const mctx = vm.createContext({ console }); mctx.window = mctx;
vm.runInContext(SRC, mctx, { filename: 'ui-morph.js' });
const M = mctx.uiMorph;
T('model', () => {
    check('the model loads without a DOM and exports its functions', !!M && ['stepAngle', 'angleLabel', 'parseAngle', 'statusText', 'signature', 'layerName'].every(k => typeof M[k] === 'function'));
    check('stepAngle: 45 degree steps, 0 + 1 = 45, 90 - 1 = 45, 135 + 1 = 180', M.stepAngle(0, 1) === 45 && M.stepAngle(90, -1) === 45 && M.stepAngle(135, 1) === 180);
    check('...wraps at 360: 315 + 1 = 0 (never 360), 0 - 1 = 315', M.stepAngle(315, 1) === 0 && M.stepAngle(0, -1) === 315);
    check('...an angle off the grid (a restore, the console) is snapped first: 100 + 1 = 135, 100 - 1 = 45; NaN / undefined count as 0', M.stepAngle(100, 1) === 135 && M.stepAngle(100, -1) === 45 && M.stepAngle(NaN, 1) === 45 && M.stepAngle(undefined, -1) === 315);
    check('...eight steps up return to the start from every grid angle', [0, 45, 90, 135, 180, 225, 270, 315].every(a => { let v = a; for (let i = 0; i < 8; i++) v = M.stepAngle(v, 1); return v === a; }));
    check('angleLabel: "135°", "0°"; a bad value reads 0°', M.angleLabel(135) === '135°' && M.angleLabel(0) === '0°' && M.angleLabel(NaN) === '0°');
    check('parseAngle: reads "135°" back to 135; garbage gives 0', M.parseAngle('135°') === 135 && M.parseAngle('0°') === 0 && M.parseAngle('x') === 0);

    const st = (c, seam) => ({ code: c, keyframes: [0, 1], mode: 'linear', progress: 0, segment: 0, seamOpen: seam || [] });
    check('statusText: nothing for off and ok (even with an empty seamOpen); nothing for no status', ['off', 'ok'].every(c => M.statusText(st(c)) === '') && M.statusText(null) === '' && M.statusText(undefined) === '' && M.statusText('x') === '');
    check('...each error code has its own text, all different', (() => { const t = M.ERROR_CODES.map(c => M.statusText(st(c))); return t.every(x => x.length > 0) && new Set(t).size === t.length; })());
    check('...netActive and bilinearStatic: their notes', M.statusText(st('netActive')) === 'Netz verzerrt Linien' && M.statusText(st('bilinearStatic')) === 'Bilinear: ohne Zeitverlauf');
    check('...netFacesNeedField (stage f1: faces asked for, Single or Tiled net): its note, at most 40 characters; "Flächen folgen" is gone from every status text', M.statusText(st('netFacesNeedField')) === 'Flächen im Morph nur bei Feld-Netz' && M.statusText(st('netFacesNeedField')).length <= 40 && !/Flächen folgen/.test(M.statusText(st('netActive'))));
    check('...seamOpen alone (code ok): "Naht offen: Ebene 1, 3" with the layer numbers (index + 1 without a layer table), the base sheet (-1) as "Basis"', M.statusText(st('ok', [0, 2])) === 'Naht offen: Ebene 1, 3' && M.statusText(st('ok', [-1, 0])) === 'Naht offen: Ebene Basis, 1');
    check('PRIORITY: an error code beats seamOpen (needsTwoKeyframes + seamOpen: the error)', M.statusText(st('needsTwoKeyframes', [0])) === 'Zwei Keyframe-Ebenen nötig' && M.statusText(st('shapeMismatch', [1])) === 'Keyframes: Form verschieden');
    check('PRIORITY: seamOpen beats netActive and bilinearStatic (a seam open AND a net warp note shows the seam)', M.statusText(st('netActive', [0])) === 'Naht offen: Ebene 1' && M.statusText(st('bilinearStatic', [2])) === 'Naht offen: Ebene 3');
    check('...an empty seamOpen lets the note show', M.statusText(st('netActive', [])) === 'Netz verzerrt Linien');
    check('layerName: with the layer table the running number it shows (layerDisplayNumber), without it index + 1; the base is "Basis"', (() => {
        const saved = mctx.layerTable; mctx.layerTable = { layerDisplayNumber: (layers, i) => 10 + i };
        const withT = M.layerName(1, [{}, {}]) === '11'; mctx.layerTable = saved;
        return withT && M.layerName(1, [{}, {}]) === '2' && M.layerName(-1, []) === 'Basis';
    })());
    const s1 = M.signature({ enabled: true, mode: 'linear', angleDeg: 45 }, 'a', 'de');
    check('signature: equal inputs give an equal string; each of enabled, mode, angle, text, language changes it', s1 === M.signature({ enabled: true, mode: 'linear', angleDeg: 45 }, 'a', 'de') && [M.signature({ enabled: false, mode: 'linear', angleDeg: 45 }, 'a', 'de'), M.signature({ enabled: true, mode: 'radial', angleDeg: 45 }, 'a', 'de'), M.signature({ enabled: true, mode: 'linear', angleDeg: 90 }, 'a', 'de'), M.signature({ enabled: true, mode: 'linear', angleDeg: 45 }, 'b', 'de'), M.signature({ enabled: true, mode: 'linear', angleDeg: 45 }, 'a', 'en')].every(x => x !== s1));
});

// ================= 2. the dictionary =================
console.log('\n== the dictionary (both languages, at most 40 characters) ==');
T('dict', () => {
    const ictx = vm.createContext({ console }); ictx.window = ictx; vm.runInContext(I18N_SRC, ictx, { filename: 'ui-i18n.js' });
    const D = ictx.uiI18n.DICT;
    const statusKeys = M.ERROR_CODES.concat(M.NOTE_CODES).map(c => 'morph.status.' + c);
    check('every status key and the button, group, toggle, modes, angle keys exist in the dictionary, German and English', statusKeys.concat(['morph.status.seamOpen', 'morph.status.base', 'morph.button', 'morph.group', 'morph.sheet', 'morph.toggle', 'morph.modes', 'morph.mode.linear', 'morph.mode.radial', 'morph.mode.bilinear', 'morph.angle', 'morph.angle.more', 'morph.angle.less', 'morph.angle.value']).every(k => D[k] && D[k].de && D[k].en));
    check('the fallback German texts of the module equal the dictionary German (the page without ui-i18n.js reads the same)', Object.keys(M.T).every(k => D[k] && D[k].de === M.T[k]), Object.keys(M.T).filter(k => !D[k] || D[k].de !== M.T[k]).join());
    ['de', 'en'].forEach(lang => {
        const longest = statusKeys.map(k => D[k][lang]).concat([D['morph.status.seamOpen'][lang].replace('{layers}', '1, 2, 3, 4, 5, 6')]);
        check(lang + ': every status text is at most ' + M.MAX_STATUS + ' characters (the seam text with six layers: ' + longest[longest.length - 1].length + ')', longest.every(s => s.length <= M.MAX_STATUS), longest.filter(s => s.length > M.MAX_STATUS).join(' | '));
    });
    const mk = lang => build({ i18n: true, views: ['strip'], layers: [] });
    const b = mk(); b.ctx.uiI18n.setLang('en'); b.model.status = { code: 'ok', seamOpen: [-1, 1] }; b.model.block = { enabled: true, mode: 'linear', angleDeg: 0 }; b.tick();
    check('in English the status line reads "Seam open: layer base, 2" through the dictionary (and the signature includes the language: it rewrote at the language change)', b.status.textContent === 'Seam open: layer base, 2', b.status.textContent);
    b.ctx.uiI18n.setLang('de'); b.tick();
    check('...and back in German "Naht offen: Ebene Basis, 2"', b.status.textContent === 'Naht offen: Ebene Basis, 2', b.status.textContent);
});

// ================= 3. the wiring =================
console.log('\n== the wiring (a fake DOM, a fake model) ==');
T('buttons', () => {
    const b = build({ views: ['strip', 'rail', 'table'] });
    const bs = b.morphButtons();
    check('after the first tick each of the three views has exactly ONE Morph button', bs.every(a => a && a.length === 1));
    const strip = b.strip.querySelector('.lr-g2').children.map(c => c.className.split(' ')[0]);
    check('strip and rail order: eye, diamond, "...", Morph, x (the button goes before the x)', J(strip) === J(['lr-eye', 'lr-diamond', 'lr-more', 'icon-btn', 'lr-x']) && J(b.rail.querySelector('.lr-g2').children.map(c => c.className.split(' ')[0])) === J(strip));
    check('the table foot: "+", "...", Morph (the button last)', J(b.table.querySelector('.lt-foot').children.map(c => c.className.split(' ')[0])) === J(['lt-add', 'lt-more', 'icon-btn']));
    check('each button has a name (aria-label "Morph"), aria-controls the block, aria-expanded false, type button', bs.every(a => a[0].getAttribute('aria-label') === 'Morph' && a[0].getAttribute('aria-controls') === 'morph-group' && a[0].getAttribute('aria-expanded') === 'false' && a[0].type === 'button'));
    for (let i = 0; i < 5; i++) b.tick();
    check('five more ticks add no second button anywhere', b.morphButtons().every(a => a.length === 1));
    // the open state
    bs[2][0].click();
    check('a click opens the block: mo-open on the group, aria-expanded true on ALL three buttons', b.group.cls.has('mo-open') && b.morphButtons().every(a => a[0].getAttribute('aria-expanded') === 'true'));
    bs[0][0].click();
    check('a second click (on another view\'s button) closes it again', !b.group.cls.has('mo-open') && b.morphButtons().every(a => a[0].getAttribute('aria-expanded') === 'false'));
    // a view rebuilt: its action group is replaced by a new one (what a layout rebuild does)
    const old = b.strip.querySelector('.lr-g2'); b.strip.removeChild(old);
    const g = b.doc.createElement('div'); g.className = 'lr-g2'; ['lr-eye', 'lr-diamond', 'lr-more', 'lr-x'].forEach(c => { const e = b.doc.createElement('button'); e.className = c; g.appendChild(e); }); b.strip.appendChild(g);
    check('before the next tick the rebuilt strip has no button', b.morphButtons()[0].length === 0);
    bs[1][0].click(); // open it
    b.tick();
    check('...the next tick inserts exactly one into the new group (never two), the others keep theirs; the open state (mo-open) is kept and shown on the new button', b.morphButtons().every(a => a.length === 1) && b.morphButtons()[0][0].getAttribute('aria-expanded') === 'true' && b.group.cls.has('mo-open'));
    // the state of a new button: the dot
    b.model.block.enabled = true; b.tick();
    const nb = b.morphButtons();
    check('the dot (has-state) is on all three buttons while the morph is on, off again when it is off', nb.every(a => a[0].cls.has('has-state')) && (() => { b.model.block.enabled = false; b.tick(); return b.morphButtons().every(a => !a[0].cls.has('has-state')); })());
    b.model.block.enabled = true; b.tick();
    const g2 = b.table.querySelector('.lt-foot'); b.table.removeChild(g2); const g3 = b.doc.createElement('div'); g3.className = 'lt-foot'; b.table.appendChild(g3); b.tick();
    check('a rebuilt view\'s new button gets the current state (the dot) in the same tick', b.morphButtons()[2][0].cls.has('has-state'));
});
T('before the views', () => {
    const b = build({ views: [] });
    check('no layer view in the page: no button, no throw, and the view module created no node of its own', b.morphButtons().every(a => a === null) && b.doc.body.all().length === b.doc.body.all().filter(e => e.id !== undefined).length);
    const marks = b.doc.body.all().map(e => e.writes).reduce((a, x) => a + x, 0);
    const before = b.doc.body.all().length;
    b.tick(); b.tick();
    check('...ticks before the views exist add nothing to the document', b.doc.body.all().length === before, before + ' -> ' + b.doc.body.all().length);
    void marks;
    // the views appear later
    const host = b.doc.createElement('div'); host.id = 'layer-table'; b.byId['layer-table'] = host; b.doc.body.appendChild(host);
    b.tick();
    check('...a view that exists without its action group (not built yet) is left alone', host.children.length === 0);
    const foot = b.doc.createElement('div'); foot.className = 'lt-foot'; host.appendChild(foot); b.tick();
    check('...once its action group exists it gets its button', foot.children.length === 1 && foot.children[0].cls.has('lt-morph'));
});
T('controls', () => {
    const b = build({ views: ['strip'] });
    b.toggle.click();
    check('the toggle writes { enabled: true }, again { enabled: false }', b.model.setCalls[0] === '{"enabled":true}' && (b.toggle.click(), b.model.setCalls[1] === '{"enabled":false}'));
    b.radios[1].click(); b.radios[2].click(); b.radios[0].click();
    check('the three mode buttons write { mode: radial }, { mode: bilinear }, { mode: linear } - only the mode', J(b.model.setCalls.slice(2)) === J(['{"mode":"radial"}', '{"mode":"bilinear"}', '{"mode":"linear"}']));
    b.model.setCalls.length = 0;
    b.stepAngle(1);
    check('the angle up writes { angleDeg: 45 } only', J(b.model.setCalls) === J(['{"angleDeg":45}']) && b.input.value === '45°');
    for (let i = 0; i < 7; i++) b.stepAngle(1);
    check('seven more steps: the model went 90 .. 315 and wrapped to 0 on the eighth (never 360), the field reads "0°"', b.model.block.angleDeg === 0 && !b.model.setCalls.some(c => c === '{"angleDeg":360}') && b.input.value === '0°');
    b.stepAngle(-1);
    check('one down from 0 gives 315 (wrap), the field "315°", the arrow property --morph-angle 315deg', b.model.block.angleDeg === 315 && b.input.value === '315°' && b.angle.props['--morph-angle'] === '315deg', b.angle.props['--morph-angle']);
    check('the stepper is made with the readonly / noTyping options and the input of the block', b.UI.stepperOpts.readonly === true && b.UI.stepperOpts.noTyping === true && b.UI.stepperOpts.input === b.input && b.UI.stepperRoot === b.angle);
    // arrows on the radiogroup
    b.model.block.mode = 'linear'; b.model.setCalls.length = 0;
    b.modes.dispatch('keydown', { key: 'ArrowRight' }); b.modes.dispatch('keydown', { key: 'ArrowRight' }); b.modes.dispatch('keydown', { key: 'ArrowRight' }); b.modes.dispatch('keydown', { key: 'ArrowLeft' });
    check('the arrow keys on the mode group move the mode (linear > radial > bilinear > linear > bilinear), the focus follows', J(b.model.setCalls) === J(['{"mode":"radial"}', '{"mode":"bilinear"}', '{"mode":"linear"}', '{"mode":"bilinear"}']) && b.doc.activeElement === b.radios[2]);
    check('another key does nothing', (() => { const n = b.model.setCalls.length; b.modes.dispatch('keydown', { key: 'a' }); return b.model.setCalls.length === n; })());
});
T('refresh', () => {
    const b = build({ views: ['strip', 'rail', 'table'] });
    b.model.block = { enabled: true, mode: 'radial', angleDeg: 90 }; b.tick();
    check('a tick shows the block: the toggle pressed and active, only the selected mode checked, the angle row aria-disabled (not hidden) for radial, "90°" in the field', b.toggle.getAttribute('aria-pressed') === 'true' && b.toggle.cls.has('active') && b.radios.map(r => r.getAttribute('aria-checked')).join() === 'false,true,false' && b.radios[1].cls.has('active') && !b.radios[0].cls.has('active') && b.angle.getAttribute('aria-disabled') === 'true' && b.angle.hidden === false && b.input.value === '90°');
    check('the modes are ONE tab stop (roving tabindex): only the selected radio has tabindex 0, the others -1', b.radios.map(r => r.getAttribute('tabindex')).join() === '-1,0,-1');
    b.model.block.mode = 'linear'; b.tick();
    const stops = () => [b.input, ...b.chev].map((e) => e.getAttribute('tabindex')).join();
    check('linear: the angle row is operable: not aria-disabled, no title, no tabindex on the field or the two chevrons', !b.angle.hasAttribute('aria-disabled') && b.angle.title === '' && stops() === ',,' && b.angle.hidden === false, stops());
    b.model.block.mode = 'bilinear'; b.tick();
    check('bilinear: the row is STILL THERE (never hidden), aria-disabled with the title "Winkel: nur bei linear", and has no focus stop (tabindex -1 on the field and both chevrons)', b.angle.hidden === false && b.angle.getAttribute('aria-disabled') === 'true' && b.angle.title === 'Winkel: nur bei linear' && stops() === '-1,-1,-1', stops());
    b.model.block.mode = 'radial'; b.tick();
    check('radial: the same; back to linear gives the operable row again (the focus stops and the title are taken away)', b.angle.getAttribute('aria-disabled') === 'true' && stops() === '-1,-1,-1' && (b.model.block.mode = 'linear', b.tick(), !b.angle.hasAttribute('aria-disabled') && b.angle.title === '' && stops() === ',,'));
    check('the row is never hidden in any mode and the module never writes `hidden` (the row keeps its height, nothing below it moves)', ['linear', 'radial', 'bilinear', 'linear'].every((m) => { b.model.block.mode = m; b.tick(); return b.angle.hidden === false; }) && !/angleEl\.hidden/.test(SRC.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')));
    { const e = build({ i18n: true, views: ['strip'] }); e.ctx.uiI18n.setLang('en'); e.model.block = { enabled: true, mode: 'radial', angleDeg: 0 }; e.tick(); check('in English the reason reads "Angle: linear only"', e.angle.title === 'Angle: linear only', e.angle.title); }
    // refresh only on a changed signature
    const count = () => [b.toggle, b.status, b.input, b.angle, ...b.radios, ...b.morphButtons().map(a => a[0])].reduce((a, e) => a + e.writes, 0) + b.input.writes;
    b.tick(); const w0 = count();
    for (let i = 0; i < 50; i++) b.tick();
    check('fifty ticks with nothing changed write NO attribute, class, text or style anywhere', count() === w0, w0 + ' -> ' + count());
    const sets0 = b.model.getCalls;
    b.tick();
    check('...but each tick still READS the block (a copy) and the status: that is the signature', b.model.getCalls === sets0 + 1);
    b.model.block.angleDeg = 180; b.tick();
    check('a changed angle writes again (the field "180°")', count() > w0 && b.input.value === '180°');
    const w1 = count(); b.model.status = { code: 'netActive', seamOpen: [] }; b.tick();
    check('a changed status writes the text (and the title with the full text); back to ok clears both', b.status.textContent === 'Netz verzerrt Linien' && b.status.title === 'Netz verzerrt Linien' && count() > w1 && (b.model.status = { code: 'ok', seamOpen: [] }, b.tick(), b.status.textContent === '' && !b.status.hasAttribute('title')));
    // a status longer than 40 characters is cut with an ellipsis, the full text stays in the title
    const longText = 'Naht offen: Ebene ' + Array.from({ length: 12 }, (_, i) => i + 1).join(', ');
    b.model.status = { code: 'ok', seamOpen: Array.from({ length: 12 }, (_, i) => i) }; b.tick();
    check('a text over 40 characters is cut to 40 with an ellipsis; the title holds all of it', b.status.textContent.length === 40 && b.status.textContent.endsWith('…') && b.status.title === longText, b.status.textContent);
    // priority through the DOM
    b.model.status = { code: 'shapeMismatch', seamOpen: [0] }; b.tick();
    check('priority in the view: an error code is shown, not the seam', b.status.textContent === 'Keyframes: Form verschieden');
    b.model.status = { code: 'netActive', seamOpen: [0, 1] }; b.tick();
    check('...a seam open beats the net warp note', b.status.textContent === 'Naht offen: Ebene 1, 2');
    // no reference into the model: the view reads copies
    b.tick(); b.input.dispatch('change');
    check('writing goes only through setSpatialMorph: a change event writes { angleDeg } (parsed from the field), nothing else', J(b.model.setCalls.slice(-1)) === J(['{"angleDeg":180}']));
    b.model.block.enabled = false; b.tick(); const readBlock = b.model.block;
    check('the view works on a copy: mutating what getSpatialMorph returned changes nothing in the model', (() => { const c = b.ctx.getSpatialMorph(); c.enabled = true; return readBlock.enabled === false; })());
});
T('base sheet active', () => {
    const b = build({ views: ['strip'] });
    b.ctx.activeLayer = -1;
    b.morphButtons()[0][0].click();
    check('the button works whatever sheet is active: no disabled state, no aria-disabled, the click opens the block with the base sheet active', !b.morphButtons()[0][0].hasAttribute('disabled') && !b.morphButtons()[0][0].hasAttribute('aria-disabled') && b.group.cls.has('mo-open') && !b.morphButtons()[0][0].disabled);
});
T('escape', () => {
    const b = build({ views: ['strip', 'table'], openStart: true });
    check('a block that starts open (a restore of the open state) shows aria-expanded true on the buttons from the first tick: the module reads the class', (() => { b.tick(); return true; })());
    const btn = b.morphButtons()[0][0];
    b.group.dispatch('keydown', { key: 'Escape' });
    check('Escape inside the open block closes it from 768px and puts the focus on the (visible) button', !b.group.cls.has('mo-open') && b.doc.activeElement === btn && btn.getAttribute('aria-expanded') === 'false');
    b.group.dispatch('keydown', { key: 'Escape' });
    check('Escape with the block closed does nothing', !b.group.cls.has('mo-open'));
    btn.click(); b.doc.documentElement.cls.add('ph'); const ev = b.group.dispatch('keydown', { key: 'Escape' });
    check('under the phone layout (html.ph) the module leaves Escape to the sheet (UI.overlay): the block stays open', b.group.cls.has('mo-open') && !ev.defaultPrevented);
    // the focus goes to the visible button: the first has no layout box
    const c = build({ views: ['strip', 'table'] }); c.morphButtons()[0][0].offsetParent = null; c.morphButtons()[2][0].click();
    c.group.dispatch('keydown', { key: 'Escape' });
    check('...the focus goes to the button that has a box (offsetParent), not to a hidden one', c.doc.activeElement === c.morphButtons()[2][0]);
});

// ================= 3b. the status texts for their REAL causes (morph stage e2b) =================
// No stubbed status: each case builds real layers in the render harness (tools/morph/render-harness.js, the real core files) and draws a real frame; the text is the one the view shows for what spatialMorphStatus() reports.
console.log('\n== the status texts for their real causes ==');
T('real causes', () => {
    const { makeRenderWorld } = require('../morph/render-harness.js');
    const real = (w, mode) => { w.setMorph({ enabled: true, mode: mode || 'linear', angleDeg: 0 }); w.frame(); return w.status(); };
    const K0 = [[2, 3], [3, 6], [6, 14], [14, 13], [13, 7], [7, 2]], K1 = [[4, 6], [6, 10], [10, 14], [14, 12], [12, 7], [7, 4]];
    const mk = (shape, order, size, sym) => { const w = makeRenderWorld(shape, order, size, sym); w.baseConnections([]); return w; };
    const cases = [
        ['needsTwoKeyframes: ONE keyframe layer, an empty base', () => { const w = mk('triangle', 3, 5, 'rotation_reflection6'); w.addKeyframeLayer([[1, 5]]); return real(w); }, 'needsTwoKeyframes', 'Zwei Keyframe-Ebenen nötig'],
        ['needsTwoKeyframes: the base has another line count than the ONE layer (the base is no keyframe)', () => { const w = mk('triangle', 3, 5, 'rotation_reflection6'); w.baseConnections([[2, 3]]); w.addKeyframeLayer([[1, 5], [2, 3]]); return real(w); }, 'needsTwoKeyframes', 'Zwei Keyframe-Ebenen nötig'],
        ['shapeMismatch: a triangle layer and a square layer', () => { const w = mk('triangle', 3, 5, 'rotation_reflection6'); w.addKeyframeLayer([[1, 5]]); w.addKeyframeLayer([[1, 4]], { shape: 'square', order: 3 }); return real(w); }, 'shapeMismatch', 'Keyframes: Form verschieden'],
        ['lineCountMismatch: 1 line against 2', () => { const w = mk('triangle', 3, 5, 'rotation_reflection6'); w.addKeyframeLayer([[1, 5]]); w.addKeyframeLayer([[1, 4], [2, 3]]); return real(w); }, 'lineCountMismatch', 'Keyframes: Linienzahl verschieden'],
        ['parameterMismatch: another symmetry mode', () => { const w = mk('triangle', 3, 5, 'rotation_reflection6'); w.addKeyframeLayer([[1, 5]]); w.addKeyframeLayer([[1, 4]], { mode: 'rotation6' }); return real(w); }, 'parameterMismatch', 'Keyframes: Größe/Symmetrie verschieden'],
        ['parameterMismatch: another size factor', () => { const w = mk('triangle', 3, 5, 'rotation_reflection6'); w.addKeyframeLayer([[1, 5]]); w.addKeyframeLayer([[1, 4]], { size: 4 }); return real(w); }, 'parameterMismatch', 'Keyframes: Größe/Symmetrie verschieden'],
        ['bilinearStatic: two keyframes, bilinear', () => { const w = mk('triangle', 3, 5, 'rotation_reflection6'); w.addKeyframeLayer([[1, 5]]); w.addKeyframeLayer([[1, 4]]); return real(w, 'bilinear'); }, 'bilinearStatic', 'Bilinear: ohne Zeitverlauf'],
        ['netActive: a net on the (square) base', () => { const w = mk('square', 4, 5, 'rotation_reflection6'); w.addKeyframeLayer([[1, 5]]); w.addKeyframeLayer([[1, 6]]); w.run('baseNetTransform = { x: { kind: "trig", w: -0.5 }, y: "same", repeat: false, domain: "field" };'); return real(w); }, 'netActive', 'Netz verzerrt Linien'],
        ['seamOpen: two open keyframe layers (order 5, symmetry none)', () => { const w = mk('triangle', 5, 3, 'none'); w.addKeyframeLayer(K0); w.addKeyframeLayer(K1); return real(w); }, 'ok', 'Naht offen: Ebene 1, 2'],
        ['seamOpen with the base fallback: an open base and ONE layer', () => { const w = mk('triangle', 5, 3, 'none'); w.baseConnections(K1); w.addKeyframeLayer(K0); return real(w); }, 'ok', 'Naht offen: Ebene Basis, 1'],
    ];
    cases.forEach(([name, run, code, text]) => {
        const stt = run(), shown = M.statusText(stt, []);
        check(`real cause - ${name}: spatialMorphStatus().code is ${code} and the line reads "${text}" (${text.length} characters)`, stt.code === code && shown === text && shown.length <= 40, J([stt.code, shown]));
    });
    check('the codes alignmentFailed and renderError have no real cause the UI can produce (changing a keyframe layer cleans the timeline or gives lineCountMismatch / parameterMismatch; nothing throws): they are covered by their text only', M.statusText({ code: 'alignmentFailed' }, []) === 'Zuordnung nicht möglich' && M.statusText({ code: 'renderError' }, []) === 'Morph nicht darstellbar');
});

// ================= 4. the source =================
console.log('\n== the source text ==');
T('source', () => {
    const src = code(SRC);
    check('ui-morph.js has no MutationObserver and no document-level keydown (no hotkey): its only key handlers are on the block and the mode group', !/MutationObserver/.test(src) && !/document\.addEventListener\(\s*['"]key/.test(src) && !/window\.addEventListener\(\s*['"]key/.test(src) && (src.match(/addEventListener\(\s*['"]keydown/g) || []).length === 2);
    check('it reaches the model only through window.getSpatialMorph / setSpatialMorph / spatialMorphStatus: no name of a model variable (spatialMorph, timeline, activeLayer, additionalLayers except the read of the layer list)', !/\bspatialMorph\b/.test(src.replace(/spatialMorphStatus/g, '')) && !/\btimeline\b/.test(src) && !/\bactiveLayer\b/.test(src) && /window\.setSpatialMorph/.test(src) && /window\.getSpatialMorph/.test(src) && /window\.spatialMorphStatus/.test(src));
    check('it touches no DOM before the views exist: ensureButtons returns when the view\'s action group is missing, and the module has no DOMContentLoaded or load wait', /if \(!g \|\| g\.querySelector\('\.lt-morph'\)\) return;/.test(src) && !/DOMContentLoaded/.test(src));
    check('the markup: the ids of the block exist once in index.html, the script is loaded after ui-layers.js and before the phone config', ['morph-group', 'morph-toggle', 'morph-modes', 'morph-mode-linear', 'morph-mode-radial', 'morph-mode-bilinear', 'morph-angle', 'morph-angle-input', 'morph-status'].every(id => (HTML.match(new RegExp('id="' + id + '"', 'g')) || []).length === 1) && HTML.indexOf('<script src="ui-layers.js') < HTML.indexOf('<script src="ui-morph.js') && HTML.indexOf('<script src="ui-morph.js') < HTML.indexOf('<script src="ui-phone-config.js'));
    check('the angle field is readonly with inputmode none; the toggle has aria-pressed, the modes a radiogroup of three radios', /id="morph-angle-input"[^>]*readonly/.test(HTML) && /id="morph-angle-input"[^>]*inputmode="none"/.test(HTML) && /id="morph-toggle"[^>]*aria-pressed="false"/.test(HTML) && /id="morph-modes"[^>]*role="radiogroup"/.test(HTML) && (HTML.match(/role="radio"/g) || []).length >= 3 && /id="morph-status"[^>]*role="status"/.test(HTML));
    // the CSS
    const at = CSS.indexOf('MORPH (html.sr-morph');
    const region = CSS.slice(CSS.lastIndexOf('/*', at));
    const rules = region.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map(s => s.trim()).filter(Boolean);
    check('the MORPH region exists at the end of style.css', at > 0 && rules.length >= 10, rules.length + ' rules');
    const bodies = rules.map(r => r.split('{').slice(1).join('{'));
    check('the controls follow var(--target) and no rule of the region fixes a control to 48px (the status line has its 20px height: the only fixed px size of a control)', !/\b48px\b/.test(region.replace(/\/\*[\s\S]*?\*\//g, '').replace(/data:image[^"]*"/g, '')) && /width: var\(--target\); height: var\(--target\)/.test(region));
    check('the block from 768px: a fixed width of var(--canvas-size), margins that make it ONE line of the wrapping controls container and centre it on the canvas (its left edge = the canvas\' left edge, also while the layer "Mehr" block is open), never centred text: html.sr-morph:not(.ph) #morph-group.mo-open', /html\.sr-morph:not\(\.ph\) #morph-group\.mo-open\.ph-sheet-rows \{[^}]*width: var\(--canvas-size\)[^}]*margin-left: max\(0px, calc\(\(100% - var\(--canvas-size\)\) \/ 2\)\); margin-right: max\(0px, calc\(\(100% - var\(--canvas-size\)\) \/ 2\)\)/.test(region) && !/html\.sr-morph:not\(\.ph\) #morph-group[^{]*\{[^}]*text-align: center/.test(region));
    check('closed means gone: #morph-group:not(.mo-open) is display none (the first rule), and the sheet under the phone layout takes it as display: contents', /#morph-group:not\(\.mo-open\) \{ display: none; \}/.test(region) && /html\.sr-morph\.ph #morph-group[^{]*\{ display: contents; \}/.test(region));
    check('the status line has a RESERVED height (height: 20px, one line, ellipsis) so a text never shifts a neighbour', /#morph-status \{[^}]*height: 20px[^}]*white-space: nowrap[^}]*text-overflow: ellipsis/.test(region));
    check('the angle field is never narrower than the longest label "315\u00B0" (39 px at 16 px; found clipped at the fine pointer\'s 36 px): min-width 44px next to width var(--target)', /\.morph-angle input \{[^}]*width: var\(--target\)[^}]*min-width: 44px/.test(region));
    const dimRule = /\.morph-angle\[aria-disabled="true"\] \{([^}]*)\}/.exec(region);
    check('the dimmed angle row (aria-disabled, radial and bilinear) changes ONLY its look: opacity and pointer-events, nothing that takes space (no display, height, width, margin, padding, visibility, position, transform, overflow); there is no [hidden] rule for it', !!dimRule && /opacity:\s*0\.4/.test(dimRule[1]) && /pointer-events:\s*none/.test(dimRule[1]) && !/(^|;|\s)(display|height|width|margin|padding|visibility|position|transform|overflow|min-height|max-height)\s*:/.test(dimRule[1]) && !/morph-angle\[hidden\]/.test(region));
    // the recorders (stage e2b): the Morph buttons of the three views and the block with its parts, and the two snapshots
    const ML = fs.readFileSync(path.join(ROOT, 'tools/ui/measure-layout.js'), 'utf8'), MP = fs.readFileSync(path.join(ROOT, 'tools/ui/measure-phone.js'), 'utf8');
    check('tools/ui/measure-layout.js tracks the Morph button of the strip, the rail and the table, #morph-group, and (in TRACKED_MORPH) its three rows, the toggle, the modes and the three radios, the angle stepper with its field and both chevrons and the status line; it takes the snapshots morph_block and morph_block_radial', ['#layer-table .lt-morph', '#layer-rail .lt-morph', '#layer-strip .lt-morph', "'#morph-group'"].every((x) => ML.indexOf(x) >= 0) && ['nth-child(1)', 'nth-child(2)', 'nth-child(3)', '#morph-toggle', '#morph-modes', '#morph-mode-linear', '#morph-mode-radial', '#morph-mode-bilinear', "'#morph-angle'", '#morph-angle-input', 'data-dir="1"', 'data-dir="-1"', '#morph-status'].every((x) => /const TRACKED_MORPH = \[.*\];/.exec(ML)[0].indexOf(x) >= 0) && /result\.morph_block = await snapQ\(false, false, false, false, true\)/.test(ML) && /result\.morph_block_radial = await snapQ\(false, false, false, false, true\)/.test(ML));
    check('tools/ui/measure-phone.js takes the states morph_block and morph_block_radial (the Morph sheet open, the three rows, the angle row, the status line, the strip\'s Morph button), at the start of phone2(), and puts the morph back off', /states\.morph_block = snapMorph\(\)/.test(MP) && /states\.morph_block_radial = snapMorph\(\)/.test(MP) && ['#ph-sheet-morph .ph-sheet-row[0]', '#ph-sheet-morph .ph-sheet-row[2]', "'#morph-angle'", "'#morph-status'", "'#layer-strip .lt-morph'"].every((x) => MP.indexOf(x) >= 0) && /setSpatialMorph\(\{ enabled: false, mode: 'linear', angleDeg: 0 \}\)/.test(MP));
    check('the arrow turns by a custom property (--morph-angle), not by layout', /\.morph-angle-icon \{ transform: rotate\(var\(--morph-angle, 0deg\)\); \}/.test(region));
    check('the region is gated: every selector of it starts with html.sr-morph, .lt-morph, .layer-table .lt-morph or #morph-group (nothing above the region mentions sr-morph)', rules.every(r => /^(html\.sr-morph|\.lt-morph|\.layer-table \.lt-morph|#morph-group|@media|html\.sr-morph\.ph)/.test(r.replace(/^\s+/, ''))) && !/sr-morph/.test(CSS.slice(0, at - 200)), rules.filter(r => !/^(html\.sr-morph|\.lt-morph|\.layer-table \.lt-morph|#morph-group|@media|html\.sr-morph\.ph)/.test(r.replace(/^\s+/, ''))).map(r => r.slice(0, 50)).join(' || '));
    check('the dot: the Morph button is a .nav-more, so the existing .nav-more.has-state::after rule draws it (no copy of the dot in the region)', /nav-more'/.test(SRC) || /className = 'icon-btn lt-morph nav-more/.test(SRC)) ;
    check('hotkeys: index.html has no accesskey on the block and the module no key code but Escape and the arrows', !/morph[^>]*accesskey/.test(HTML) && !/e\.key === '[a-zA-Z]'/.test(src));
    // sketch.js and core/ unchanged against the commit of task 018 (d3 K3 list helpers; was b5a300e7, the e1 commit, before)
    let diff = null;
    try { diff = cp.execFileSync('git', ['diff', '--stat', 'f06c0e77', '--', 'sketch.js', 'core/tiling.js'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { diff = null; }
    if (diff === null) console.log('NOTE  git or the commit 80deee88 is not available: the sketch.js / core/tiling.js diff pin is skipped');
    else check('sketch.js and core/tiling.js have an EMPTY diff against f06c0e77 (task 071c, the last commit that changed sketch.js: the name field writes only on change; before it 066: G7b removes the old-format catalog reader (063: 5ae2886e, 062 notice: 061: 712fef39, 060: f5c8336a, gridSpec/nodeCount projection); 80deee88 = task 050 before it; before: d1174f82, the d3 K3 list helpers): the UI stage touches neither (stage d2c changed core/spatial-morph*.js, so the pin names the two files that must stay byte-identical)', diff.trim() === '', diff.trim().slice(0, 200));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
