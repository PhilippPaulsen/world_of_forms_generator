// Guard for the layer table (layer-table commit 1) and the layer rail (commit 2): the pure model, the DOM it builds (the REAL ui.js and the REAL ui-layers.js in a vm with a fake DOM), and the source text of
// index.html, style.css and sketch.js. No browser.
//   node tools/ui/test-layer-table.js
//   INDEX_HTML=... STYLE_CSS=... SKETCH_JS=... UI_LAYERS_JS=... UI_JS=... node tools/ui/test-layer-table.js        (sabotage runs)
//
// What the table is. A pure view of additionalLayers / activeLayer / timeline, rebuilt on every UI.onSync tick after a signature comparison; the Base first (a chip only), then one row per
// layer WITHOUT the timeline's playback layer; a RUNNING number on the chip (not array index + 1: the playback layer takes an array slot); an eye (layer.enabled, switchable for every
// layer, a timeline keyframe included); a remove x (a confirmation only for a layer with lines or a timeline keyframe); "+" and "..."; a fixed name line. Every action goes through
// window.layerApi (sketch.js). It shows only where it fits (a fine pointer >= 936px, a coarse pointer >= 1032px) and then replaces the old layer row, which stays in the DOM.
// The RAIL (commit 2) is the narrow view of the same model: one column at the right gutter from 768px up to the table's threshold (fine 768 to 935, coarse 768 to 1031): the chips and "+", a
// hairline, then the eye, "..." and the remove x of the ACTIVE sheet (disabled with a reason on the Base); no name line. Exactly one of table and rail shows at any width >= 768px, none below.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css'), SKETCH = read('SKETCH_JS', 'sketch.js'), LAYERS = read('UI_LAYERS_JS', 'ui-layers.js'), UI_SRC = read('UI_JS', 'ui.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 160)); } };
const J = x => JSON.stringify(x);

// ================= 1. the pure model =================
console.log('== the model (loaded without a DOM) ==');
const modelCtx = vm.createContext({ console });
modelCtx.window = modelCtx;
T('model', () => {
    vm.runInContext(LAYERS, modelCtx, { filename: 'ui-layers.js' });
    const M = modelCtx.layerTable;
    check('the model is exported without a DOM (layerDisplayNumber, layerRemoveNeedsConfirm, layerTableModel, tableSignature, revealDelta)', !!M && ['layerDisplayNumber', 'layerRemoveNeedsConfirm', 'layerTableModel', 'tableSignature', 'revealDelta'].every(k => typeof M[k] === 'function'));
    const L = (extra) => Object.assign({ connections: [], enabled: true }, extra || {});
    const PB = () => L({ isTimelinePlayback: true });
    const layers = [L(), L(), PB(), L()];
    check('running numbers: 1, 2, (the playback layer: none), 3 - not the array index + 1 (which would be 1, 2, 3, 4)', J([0, 1, 2, 3].map(i => M.layerDisplayNumber(layers, i))) === J([1, 2, null, 3]));
    const after = [layers[0], layers[1], layers[3]];
    check('the numbers do not jump when the playback layer disappears (a keyframe was removed): the third layer is 3 before and after', M.layerDisplayNumber(layers, 3) === 3 && M.layerDisplayNumber(after, 2) === 3);
    check('a bad index or a non-layer gives null', M.layerDisplayNumber(layers, 9) === null && M.layerDisplayNumber(null, 0) === null && M.layerDisplayNumber(layers, 'base') === null);
    const tl = { keyframeLayerIds: [0, 1] };
    check('confirm rule: an empty plain layer needs none', J(M.layerRemoveNeedsConfirm(L(), null, 0)) === J({ confirm: false, lines: 0, keyframe: false }));
    check('...a layer with lines needs one (lines counted)', M.layerRemoveNeedsConfirm(L({ connections: [[1, 2], [3, 4]] }), null, 0).confirm === true && M.layerRemoveNeedsConfirm(L({ connections: [[1, 2], [3, 4]] }), null, 0).lines === 2);
    check('...a timeline keyframe needs one even without lines (its segments and pairings are lost)', M.layerRemoveNeedsConfirm(L(), tl, 1).confirm === true && M.layerRemoveNeedsConfirm(L(), tl, 1).keyframe === true);
    check('...an empty layer that is NOT a keyframe needs none while a timeline exists', M.layerRemoveNeedsConfirm(L(), tl, 3).confirm === false);
    // rows per state
    const empty = M.layerTableModel({ layers: [], active: 'base', timeline: null, moreOpen: false, moreDot: false });
    check('the empty state: only the Base row (a chip only), active; "..." disabled with the reason "Keine Ebene aktiv."; "+" is always there', J(empty.rows.map(r => r.key)) === J(['base']) && empty.rows[0].active === true && empty.more.disabled === true && empty.more.reason === 'Keine Ebene aktiv.' && !!empty.cells.add);
    const m = M.layerTableModel({ layers, active: 3, timeline: { keyframeLayerIds: [0, 1] }, moreOpen: true, moreDot: true });
    check('rows: the Base, then one per layer WITHOUT the playback layer: base, l0, l1, l3', J(m.rows.map(r => r.key)) === J(['base', 'l0', 'l1', 'l3']), m.rows.map(r => r.key).join(','));
    check('...the numbers on the rows are 1, 2, 3; the active row is the one for activeLayer 3 (the third), the Base is not active', J(m.rows.slice(1).map(r => r.number)) === J([1, 2, 3]) && m.rows[3].active === true && m.rows[0].active === false);
    check('...the keyframes are marked (rows 1 and 2), the plain layer is not', m.rows[1].keyframe === true && m.rows[2].keyframe === true && m.rows[3].keyframe === false);
    check('"..." is enabled for a layer, open and with the dot while the old toggle says so', m.more.disabled === false && m.more.open === true && m.more.dot === true);
    const hid = M.layerTableModel({ layers: [L({ enabled: false }), L()], active: 'base', timeline: null });
    check('a hidden layer keeps its row (flagged hidden, visible false); its eye is off', hid.rows.length === 3 && hid.rows[1].hidden === true && hid.rows[1].visible === false && hid.rows[2].hidden === false);
    check('"..." is disabled while the Base is active even with layers', hid.more.disabled === true && hid.more.open === false);
    // names and states of the cells (the name line)
    check('cell texts: the eye of a hidden keyframe says "Ebene 1 · Keyframe, ausgeblendet" and, switched on, "... zusätzlich sichtbar"; a plain hidden layer says "ausgeblendet"',
        m.cells['eye:0'].name === 'Ebene 1' && m.cells['eye:0'].state === 'Keyframe, zusätzlich sichtbar' && M.layerTableModel({ layers: [L({ enabled: false })], active: 0, timeline: { keyframeLayerIds: [0] } }).cells['eye:0'].state === 'Keyframe, ausgeblendet' && hid.cells['eye:0'].state === 'ausgeblendet' && hid.cells['eye:1'].state === 'sichtbar');
    check('the cell keys follow the array index (chip:3 for the third layer, whose number is 3 and whose array index is 3)', !!m.cells['chip:3'] && m.cells['chip:3'].name === 'Ebene 3' && !m.cells['chip:2']);
    // signature
    const base = { layers, active: 0, timeline: tl, moreOpen: false, moreDot: false };
    const s0 = M.tableSignature(base);
    check('the signature changes with: the active sheet, a layer\'s visibility, the keyframe set, the layer list, the more state - and not with a line added to a layer',
        s0 !== M.tableSignature(Object.assign({}, base, { active: 1 })) && s0 !== M.tableSignature(Object.assign({}, base, { layers: [L({ enabled: false }), layers[1], layers[2], layers[3]] })) && s0 !== M.tableSignature(Object.assign({}, base, { timeline: { keyframeLayerIds: [0] } })) && s0 !== M.tableSignature(Object.assign({}, base, { layers: layers.slice(0, 2) })) && s0 !== M.tableSignature(Object.assign({}, base, { moreOpen: true })) && s0 === M.tableSignature(Object.assign({}, base, { layers: [L({ connections: [[1, 2]] }), layers[1], layers[2], layers[3]] })));
    // the rail's actions: those of the ACTIVE sheet
    check('rail actions on the Base: index null; the eye and the x are present and DISABLED with the reason "Keine Ebene aktiv."; "..." shares the table\'s state (disabled, same reason)', empty.actions.index === null && empty.actions.eye.disabled === true && empty.actions.eye.reason === 'Keine Ebene aktiv.' && empty.actions.x.disabled === true && empty.actions.x.reason === 'Keine Ebene aktiv.' && empty.actions.more.disabled === true && empty.actions.more.reason === 'Keine Ebene aktiv.' && empty.actions.eye.label === 'Ebene sichtbar' && empty.actions.x.label === 'Ebene entfernen');
    check('rail actions for the third layer (array index 3, number 3, a plain layer): index 3, enabled, labelled "Ebene 3 sichtbar" / "Ebene 3 entfernen" - the RUNNING number, not the array index + 1', m.actions.index === 3 && m.actions.eye.disabled === false && m.actions.eye.reason === null && m.actions.eye.label === 'Ebene 3 sichtbar' && m.actions.x.label === 'Ebene 3 entfernen' && m.actions.eye.visible === true && m.actions.more.disabled === false);
    const hidA = M.layerTableModel({ layers: [L({ enabled: false }), L()], active: 0, timeline: null });
    check('...the eye of a hidden active layer says visible: false (the rail shows the crossed eye); a visible one says true', hidA.actions.eye.visible === false && M.layerTableModel({ layers: [L(), L()], active: 1, timeline: null }).actions.eye.visible === true && M.layerTableModel({ layers: [L(), L()], active: 1, timeline: null }).actions.index === 1);
    check('the playback layer is never "the active layer" of the rail (a stale activeLayer pointing at it): actions disabled like the Base', M.layerTableModel({ layers: [L(), PB()], active: 1, timeline: null }).actions.index === null && M.layerTableModel({ layers: [L(), PB()], active: 1, timeline: null }).actions.eye.disabled === true);
    // revealDelta: how far the rail's chip column scrolls to keep the active chip inside
    check('revealDelta: 0 while the chip is inside; negative above the top; positive below the bottom; a chip taller than the view shows its top', M.revealDelta(10, 58, 0, 100) === 0 && M.revealDelta(-30, 18, 0, 100) === -30 && M.revealDelta(80, 128, 0, 100) === 28 && M.revealDelta(20, 220, 0, 100) === 20 && M.revealDelta(0, 100, 0, 100) === 0);
});

// ================= 2. the DOM, with the real ui.js =================
console.log('\n== the DOM (the real ui.js and ui-layers.js, a fake DOM) ==');
class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this._a = {}; this.dataset = {}; this.handlers = {}; this._c = new Set(); this.style = {}; this.hidden = false; this.id = ''; this._text = ''; this._html = ''; this.type = ''; this.tabIndex = 0; this.offsetParent = {}; }
    set className(v) { this._c = new Set(String(v).split(/\s+/).filter(Boolean)); } get className() { return [...this._c].join(' '); }
    get classList() { const s = this._c, self = this; return { add: c => { s.add(c); if (self.onClass) self.onClass(); }, remove: c => { s.delete(c); if (self.onClass) self.onClass(); }, contains: c => s.has(c), toggle: (c, on) => { const w = on === undefined ? !s.has(c) : !!on; if (w) s.add(c); else s.delete(c); return w; } }; }
    setAttribute(k, v) { this._a[k] = String(v); } getAttribute(k) { return k in this._a ? this._a[k] : null; } removeAttribute(k) { delete this._a[k]; } hasAttribute(k) { return k in this._a; }
    addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    set textContent(v) { this._text = String(v); if (v === '') { this.children.forEach(c => { c.parent = null; }); this.children = []; } } get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set innerHTML(v) { this._html = String(v); this.children = []; } get innerHTML() { return this._html; }
    contains(n) { for (let e = n; e; e = e.parent) if (e === this) return true; return false; }
    closest(sel) { for (let e = this; e; e = e.parent) { if (sel.startsWith('.') ? e._c.has(sel.slice(1)) : e.tagName.toLowerCase() === sel) return e; } return null; }
    focus() { this.ownerDoc.activeElement = this; this.dispatch('focusin'); }
    getBoundingClientRect() { return { left: 0, right: 40, top: 0, bottom: 40 }; }
    querySelector(sel) { const all = this.querySelectorAll(sel); return all[0] || null; }
    querySelectorAll(sel) { const out = []; const want = sel.startsWith('.') ? e => e._c.has(sel.slice(1)) : (/^[a-z]+$/.test(sel) ? e => e.tagName.toLowerCase() === sel : () => false); const walk = n => n.children.forEach(c => { if (want(c)) out.push(c); walk(c); }); walk(this); return out; }
    dispatch(type, ev) { const e = Object.assign({ type, target: this, stopPropagation() { }, preventDefault() { }, detail: 1 }, ev || {}); for (let n = this; n; n = n.parent) (n.handlers[type] || []).forEach(h => { e.currentTarget = n; h(e); }); return e; }
}
function build(o) {
    o = o || {};
    const byId = {};
    const doc = { activeElement: null, visibilityState: 'visible', documentElement: {}, addEventListener() { }, createElement: tag => { const e = new El(tag); e.ownerDoc = doc; return e; }, getElementById: id => byId[id] || null, querySelector: () => null, querySelectorAll: () => [] };
    const mkEl = (id, tag, cls) => { const e = doc.createElement(tag || 'div'); e.id = id; if (cls) e.className = cls; byId[id] = e; return e; };
    const table = mkEl('layer-table', 'div', 'layer-table');
    const rail = o.noRail ? null : mkEl('layer-rail', 'div', 'layer-rail');
    const overlay = mkEl('layer-remove-overlay', 'div', 'dialog-overlay hidden'), content = new El('div'); content.className = 'dialog-content'; content.ownerDoc = doc; overlay.appendChild(content);
    const title = mkEl('layer-remove-title', 'strong'); content.appendChild(title); mkEl('layer-remove-text', 'p'); const cancel = mkEl('cancel-layer-remove', 'button'), confirm = mkEl('confirm-layer-remove', 'button'); content.appendChild(cancel); content.appendChild(confirm);
    const oldMore = mkEl('btn-more-layer', 'button'); oldMore.setAttribute('aria-expanded', 'false');
    const clock = { t: 0 }, calls = [], moq = [];   // moq: the MutationObserver callbacks, run AFTER the click handler like a browser's microtask (UI.dialog moves the focus there)
    const layers = o.layers || [], st = { layers, active: o.active === undefined ? 'base' : o.active, timeline: o.timeline === undefined ? null : o.timeline };
    const ctx = vm.createContext({ document: doc, console, MutationObserver: class { constructor(cb) { this.cb = cb; } observe(el) { el.onClass = () => { moq.push(this.cb); }; } }, setTimeout: (f) => 0, clearTimeout() { }, performance: { now: () => clock.t } });
    ctx.window = ctx; ctx.matchMedia = () => ({ matches: false }); ctx.innerWidth = 1200; ctx.addEventListener = () => { };
    ctx.additionalLayers = layers; ctx.activeLayer = st.active; ctx.timeline = st.timeline;
    ctx.layerApi = {
        select(sheet) { calls.push(['select', sheet]); ctx.activeLayer = sheet; },
        add() { calls.push(['add']); layers.push({ connections: [], enabled: true }); ctx.activeLayer = layers.length - 1; },
        remove(i) { calls.push(['remove', i]); layers.splice(i, 1); if (ctx.activeLayer === i) ctx.activeLayer = 'base'; },
        setEnabled(i, on) { calls.push(['setEnabled', i, on]); if (layers[i]) layers[i].enabled = !!on; },
        toggleMore() { calls.push(['toggleMore']); oldMore.setAttribute('aria-expanded', oldMore.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'); },
    };
    if (UI_SRC) vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    vm.runInContext(LAYERS, ctx, { filename: 'ui-layers.js' });
    const sync = () => ctx.window.uiSync();
    const cell = key => { for (const r of table.children[0].children) for (const b of r.children) if (b.dataset.key === key) return b; return key === 'add' || key === 'more' ? table.children[1].children.find(b => b.dataset.key === key) : null; };
    const keys = () => table.children[0].children.flatMap(r => r.children.map(b => b.dataset.key)).concat(table.children[1].children.map(b => b.dataset.key));
    // the rail: [0] group 1 = [the Base chip, the scrolling layer-chips column, "+"], [1] group 2 = [eye, "...", x]
    const railBase = () => rail.children[0].children[0], railChips = () => rail.children[0].children[1], railAdd = () => rail.children[0].children[2], railActions = () => rail.children[1].children;
    const rcell = key => { for (const b of [railBase()].concat(railChips().children, [railAdd()], railActions())) if (b.dataset.key === key) return b; return null; };
    const rkeys = () => [railBase().dataset.key].concat(railChips().children.map(b => b.dataset.key), [railAdd().dataset.key], railActions().map(b => b.dataset.key));
    return { ctx, doc, table, rail, railBase, railChips, railAdd, rcell, rkeys, calls, layers, sync, cell, keys, overlay, cancel, confirm, oldMore, byId, clk: b => { b.dispatch('click', { detail: 1 }); while (moq.length) moq.shift()([]); } };
}
T('dom', () => {
    const L = (extra) => Object.assign({ connections: [], enabled: true }, extra || {});
    let e = build({});
    check('empty state: the cells are chip:base, "+" and "..."; "..." has aria-disabled and the reason as its reason', J(e.keys()) === J(['chip:base', 'add', 'more']) && e.cell('more').getAttribute('aria-disabled') === 'true' && e.cell('more').dataset.reason === 'Keine Ebene aktiv.');
    check('the Base chip is a stack icon (no number) named "Basis", aria-current while active', /<svg/.test(e.cell('chip:base').innerHTML) && e.cell('chip:base').getAttribute('aria-label') === 'Basis' && e.cell('chip:base').getAttribute('aria-current') === 'true' && e.cell('chip:base').classList.contains('active'));
    check('every cell is a real <button type="button"> with an aria-label, title = aria-label (UI.name; "..." shows its reason as the title while disabled), a .lt-cell class, and no mousedown (p5) listener', e.keys().every(k => { const b = e.cell(k); return b.tagName === 'BUTTON' && b.type === 'button' && b.getAttribute('aria-label') && (k === 'more' || b.getAttribute('title') === b.getAttribute('aria-label')) && b.classList.contains('lt-cell') && !b.handlers.mousedown; }));
    e.clk(e.cell('add')); e.sync();
    check('"+" calls layerApi.add() once and the table shows the new row at once (chip:0 active, its eye pressed)', J(e.calls) === J([['add']]) && J(e.keys()) === J(['chip:base', 'chip:0', 'eye:0', 'x:0', 'add', 'more']) && e.cell('chip:0').classList.contains('active') && e.cell('eye:0').getAttribute('aria-pressed') === 'true');
    check('the number chip shows the running number and is named "Ebene 1"; the remove cell "Ebene 1 entfernen"; the eye "Ebene 1 sichtbar"', e.cell('chip:0').textContent === '1' && e.cell('chip:0').getAttribute('aria-label') === 'Ebene 1' && e.cell('x:0').getAttribute('aria-label') === 'Ebene 1 entfernen' && e.cell('eye:0').getAttribute('aria-label') === 'Ebene 1 sichtbar');
    check('"..." is enabled once a layer is active (no aria-disabled) and calls layerApi.toggleMore(); the table shows aria-expanded at once', (() => { e.calls.length = 0; const m = e.cell('more'); const dis = m.getAttribute('aria-disabled'); e.clk(m); return dis === null && J(e.calls) === J([['toggleMore']]) && m.getAttribute('aria-expanded') === 'true'; })());
    // eye
    const eyeBtn = e.cell('eye:0'); e.calls.length = 0;
    e.clk(eyeBtn);
    check('the eye calls layerApi.setEnabled(<its own layer>, !enabled) once, and the same button stays in the DOM (the focus survives), now pressed=false and chip dimmed', J(e.calls) === J([['setEnabled', 0, false]]) && e.cell('eye:0') === eyeBtn && eyeBtn.getAttribute('aria-pressed') === 'false' && e.cell('chip:0').classList.contains('is-hidden'));
    // two layers: the eye of the SECOND writes the second
    e = build({ layers: [L(), L()], active: 0 });
    e.clk(e.cell('eye:1'));
    check('with two layers the eye of row 2 writes layer 1 (array index), not layer 0', J(e.calls) === J([['setEnabled', 1, false]]) && e.layers[1].enabled === false && e.layers[0].enabled === true);
    e.calls.length = 0; e.clk(e.cell('chip:1'));
    check('a chip calls layerApi.select(<its index>); the Base chip select(\'base\')', J(e.calls) === J([['select', 1]]) && (e.clk(e.cell('chip:base')), J(e.calls[1]) === J(['select', 'base'])));
    // playback layer is no row
    e = build({ layers: [L(), L(), L({ isTimelinePlayback: true }), L()], active: 3, timeline: { keyframeLayerIds: [0, 1], playbackLayerIndex: 2 } });
    check('the playback layer has no row: cells chip:0 / chip:1 / chip:3 only, and the chip of array index 3 shows "3"', e.keys().join() === 'chip:base,chip:0,eye:0,x:0,chip:1,eye:1,x:1,chip:3,eye:3,x:3,add,more' && e.cell('chip:3').textContent === '3');
    // remove without a confirmation
    e = build({ layers: [L(), L()], active: 'base' });
    e.clk(e.cell('x:1'));
    check('x on an EMPTY plain layer: layerApi.remove(<its index>) at once, no dialog, and the focus lands on the active sheet\'s chip (the removed row is gone)', J(e.calls) === J([['remove', 1]]) && e.overlay.classList.contains('hidden') && e.doc.activeElement === e.cell('chip:base'));
    // remove with a confirmation
    e = build({ layers: [L({ connections: [[1, 2], [3, 4], [5, 6]] }), L()], active: 'base' });
    e.clk(e.cell('x:0'));
    check('x on a layer WITH lines: no remove yet; the dialog opens ("Ebene 1 entfernen?", the lines named), layerApi.remove not called', e.calls.length === 0 && !e.overlay.classList.contains('hidden') && e.byId['layer-remove-title'].textContent === 'Ebene 1 entfernen?' && /3 Linien/.test(e.byId['layer-remove-text'].textContent));
    e.clk(e.cancel);
    check('Cancel closes the dialog without removing; the focus goes back to that x', e.calls.length === 0 && e.overlay.classList.contains('hidden') && e.doc.activeElement === e.cell('x:0'));
    e.clk(e.cell('x:0')); e.clk(e.confirm);
    check('Confirm removes the layer once (layerApi.remove(0)) and closes the dialog', J(e.calls) === J([['remove', 0]]) && e.overlay.classList.contains('hidden') && J(e.keys()) === J(['chip:base', 'chip:0', 'eye:0', 'x:0', 'add', 'more']));
    e = build({ layers: [L(), L({ connections: [[1, 2]] })], active: 'base' });
    e.clk(e.cell('x:1')); e.clk(e.confirm);
    check('...and it removes THE layer that was asked about (a second layer with a line: remove(1), not remove(0))', J(e.calls) === J([['remove', 1]]) && e.layers.length === 1);
    e = build({ layers: [L(), L()], active: 'base', timeline: { keyframeLayerIds: [1], playbackLayerIndex: null } });
    e.clk(e.cell('x:1'));
    check('x on a timeline keyframe without lines still asks, and the text names the keyframe and the line pairings', e.calls.length === 0 && /Keyframe der Timeline/.test(e.byId['layer-remove-text'].textContent) && /Linienzuordnungen/.test(e.byId['layer-remove-text'].textContent));
    // name line
    e = build({ layers: [L({ enabled: false })], active: 0, timeline: { keyframeLayerIds: [0], playbackLayerIndex: null } });
    const nameEl = e.table.children[2];
    check('the name line is aria-hidden and shows the hint "Symbol antippen" until something is touched', !!nameEl && nameEl.getAttribute('aria-hidden') === 'true' && nameEl.textContent === 'Symbol antippen');
    e.cell('eye:0').dispatch('pointerdown', { pointerType: 'touch' });
    check('a pointerdown on the eye of a hidden keyframe: "Ebene 1 · Keyframe, ausgeblendet"; switched on it says "Keyframe, zusätzlich sichtbar" on the next tick', nameEl.textContent === 'Ebene 1 · Keyframe, ausgeblendet' && (e.clk(e.cell('eye:0')), e.sync(), nameEl.textContent === 'Ebene 1 · Keyframe, zusätzlich sichtbar'));
    e.cell('chip:base').dispatch('pointerover', { pointerType: 'touch' });
    check('a pointerover from touch is ignored (nothing depends on hover); a mouse pointerover and a focusin show the icon', nameEl.textContent.startsWith('Ebene 1') && (e.cell('chip:base').dispatch('pointerover', { pointerType: 'mouse' }), nameEl.textContent.startsWith('Basis')) && (e.cell('x:0').focus(), nameEl.textContent === 'Ebene 1 entfernen'));
    // ---- the rail (commit 2) ----
    e = build({});
    const g1 = e.rail.children[0] ? e.rail.children[0].children : [];
    check('rail, structure (read without the helpers): group 1 = [the Base chip, the scrolling column (empty without layers), "+"], so the Base chip is a fixed child of the group, not of the scrolling column; group 2 = [eye, "...", x]', g1.length === 3 && g1[0].dataset.key === 'chip:base' && g1[1].className === 'lr-chips' && g1[1].children.length === 0 && g1[2].dataset.key === 'add' && e.rail.children[1] && J(e.rail.children[1].children.map(b => b.dataset.key)) === J(['eye', 'more', 'x']));
    check('rail, empty state: the Base chip, "+", then the three actions in the order eye, "...", x (the Tab order: chips, "+", eye, "...", x); no layer chips', J(e.rkeys()) === J(['chip:base', 'add', 'eye', 'more', 'x']));
    check('rail, on the Base: the eye, "..." and x are PRESENT and aria-disabled with the reason "Keine Ebene aktiv." (title = the reason), nothing jumps; "+" and the Base chip are enabled', ['eye', 'more', 'x'].every(k => e.rcell(k).getAttribute('aria-disabled') === 'true' && e.rcell(k).dataset.reason === 'Keine Ebene aktiv.' && e.rcell(k).getAttribute('title') === 'Keine Ebene aktiv.') && ['chip:base', 'add'].every(k => e.rcell(k).getAttribute('aria-disabled') === null));
    e.calls.length = 0; ['eye', 'more', 'x'].forEach(k => e.clk(e.rcell(k)));
    check('...a click on a disabled action does nothing (no layerApi call, no dialog): the reason is shown instead', e.calls.length === 0 && e.overlay.classList.contains('hidden'));
    check('rail, every button: a real <button type="button"> with an aria-label (UI.name), a .lt-cell class and no mousedown (p5) listener; the rail has no name line (no aria-hidden element, no pointerdown / focusin listener on it)', e.rkeys().every(k => { const b = e.rcell(k); return b.tagName === 'BUTTON' && b.type === 'button' && !!b.getAttribute('aria-label') && b.classList.contains('lt-cell') && !b.handlers.mousedown; }) && !e.rail.handlers.pointerdown && !e.rail.handlers.focusin && !e.rail.handlers.pointerover && !/aria-hidden/.test(J(e.rail.children.map(function w(c) { return [c._a, c.children.map(w)]; }))));
    check('rail, names: "Ebene hinzufügen", "Ebenen-Einstellungen" (the reason as the title while disabled), "Ebene sichtbar" and "Ebene entfernen" on the Base; the Base chip "Basis"', e.rcell('add').getAttribute('aria-label') === 'Ebene hinzufügen' && e.rcell('more').getAttribute('aria-label') === 'Ebenen-Einstellungen' && e.rcell('eye').getAttribute('aria-label') === 'Ebene sichtbar' && e.rcell('x').getAttribute('aria-label') === 'Ebene entfernen' && e.rcell('chip:base').getAttribute('aria-label') === 'Basis');
    e.calls.length = 0; e.clk(e.rcell('add'));
    check('rail "+": layerApi.add() once; both views show the new row on the same tick (the table row and the rail chip), the new chip is active, the actions are enabled and named for it', J(e.calls) === J([['add']]) && J(e.keys()) === J(['chip:base', 'chip:0', 'eye:0', 'x:0', 'add', 'more']) && J(e.rkeys()) === J(['chip:base', 'chip:0', 'add', 'eye', 'more', 'x']) && e.rcell('chip:0').classList.contains('active') && e.rcell('chip:0').textContent === '1' && e.rcell('eye').getAttribute('aria-disabled') === null && e.rcell('x').getAttribute('aria-disabled') === null && e.rcell('more').getAttribute('aria-disabled') === null && e.rcell('eye').getAttribute('aria-label') === 'Ebene 1 sichtbar' && e.rcell('x').getAttribute('aria-label') === 'Ebene 1 entfernen');
    check('rail, the eye shows the active layer: aria-pressed true and the open eye icon', e.rcell('eye').getAttribute('aria-pressed') === 'true' && /<circle cx="12" cy="12" r="3"/.test(e.rcell('eye').innerHTML));
    // the eye of the ACTIVE layer, with two layers and the SECOND active
    e = build({ layers: [L(), L()], active: 1 });
    e.clk(e.rcell('eye'));
    check('rail eye with two layers and the SECOND active: layerApi.setEnabled(1, false) once (the ACTIVE layer, not layer 0); the button stays, aria-pressed false, the crossed eye, the chip dimmed in both views', J(e.calls) === J([['setEnabled', 1, false]]) && e.layers[1].enabled === false && e.layers[0].enabled === true && e.rcell('eye').getAttribute('aria-pressed') === 'false' && /M1 1l22 22/.test(e.rcell('eye').innerHTML) && e.rcell('chip:1').classList.contains('is-hidden') && e.cell('chip:1').classList.contains('is-hidden'));
    e.calls.length = 0; e.clk(e.rcell('eye'));
    check('...and a second click on the same eye switches the layer back ON (setEnabled(1, true): the value is the opposite of the current one, not a constant), the open eye again', J(e.calls) === J([['setEnabled', 1, true]]) && e.layers[1].enabled === true && e.rcell('eye').getAttribute('aria-pressed') === 'true' && /<circle cx="12" cy="12" r="3"/.test(e.rcell('eye').innerHTML) && !e.rcell('chip:1').classList.contains('is-hidden'));
    e.clk(e.rcell('eye'));
    e.calls.length = 0; e.clk(e.rcell('chip:0'));
    check('rail chips: layerApi.select(<index>) once; the actions follow the new active sheet (labelled "Ebene 1 ..."); the Base chip selects \'base\' and disables the actions again', J(e.calls) === J([['select', 0]]) && e.rcell('x').getAttribute('aria-label') === 'Ebene 1 entfernen' && (e.clk(e.rcell('chip:base')), J(e.calls[1]) === J(['select', 'base']) && e.rcell('x').getAttribute('aria-disabled') === 'true' && e.rcell('x').getAttribute('aria-label') === 'Ebene entfernen'));
    // the x of the active layer: no confirmation for an empty plain layer, a dialog for one with lines
    e = build({ layers: [L(), L()], active: 1 });
    e.clk(e.rcell('x'));
    check('rail x on an EMPTY plain active layer: layerApi.remove(<the active index>) at once, no dialog; the focus lands on the active sheet\'s chip in the rail', J(e.calls) === J([['remove', 1]]) && e.overlay.classList.contains('hidden') && e.doc.activeElement === e.rcell('chip:base'));
    e = build({ layers: [L(), L({ connections: [[1, 2], [3, 4]] })], active: 1 });
    e.clk(e.rcell('x'));
    check('rail x on a layer WITH lines: no remove yet; the same dialog opens ("Ebene 2 entfernen?", the lines named: "2 Linien" - the running number), layerApi.remove not called', e.calls.length === 0 && !e.overlay.classList.contains('hidden') && e.byId['layer-remove-title'].textContent === 'Ebene 2 entfernen?' && /2 Linien/.test(e.byId['layer-remove-text'].textContent));
    e.clk(e.cancel);
    check('...Cancel closes it without removing and the focus goes back to the RAIL\'s x (not a table cell)', e.calls.length === 0 && e.overlay.classList.contains('hidden') && e.doc.activeElement === e.rcell('x'));
    e.clk(e.rcell('x')); e.clk(e.confirm);
    check('...Confirm removes THAT layer once (remove(1)) and the focus goes to the active sheet\'s chip in the rail', J(e.calls) === J([['remove', 1]]) && e.layers.length === 1 && e.overlay.classList.contains('hidden') && e.doc.activeElement === e.rcell('chip:base'));
    e = build({ layers: [L(), L()], active: 1, timeline: { keyframeLayerIds: [1], playbackLayerIndex: null } });
    e.clk(e.rcell('x'));
    check('rail x on a timeline keyframe without lines still asks, and the text names the keyframe and the line pairings', e.calls.length === 0 && /Keyframe der Timeline/.test(e.byId['layer-remove-text'].textContent) && /Linienzuordnungen/.test(e.byId['layer-remove-text'].textContent));
    // "...": the same state as the table's
    e = build({ layers: [L()], active: 0 });
    e.clk(e.rcell('more'));
    check('rail "...": layerApi.toggleMore() once; aria-expanded mirrors the old toggle in the rail AND the table on the same tick', J(e.calls) === J([['toggleMore']]) && e.rcell('more').getAttribute('aria-expanded') === 'true' && e.cell('more').getAttribute('aria-expanded') === 'true');
    // the playback layer has no chip in the rail either
    e = build({ layers: [L(), L(), L({ isTimelinePlayback: true }), L()], active: 3, timeline: { keyframeLayerIds: [0, 1], playbackLayerIndex: 2 } });
    check('rail, the playback layer has no chip: chip:0, chip:1, chip:3 (numbers 1, 2, 3), the actions are the third layer\'s', J(e.rkeys()) === J(['chip:base', 'chip:0', 'chip:1', 'chip:3', 'add', 'eye', 'more', 'x']) && e.rcell('chip:3').textContent === '3' && e.rcell('x').getAttribute('aria-label') === 'Ebene 3 entfernen');
    // many layers: the rail keeps the active chip inside its scrolling column
    e = build({ layers: Array.from({ length: 10 }, () => L()), active: 'base' });
    const col = e.railChips(); col.scrollTop = 0;
    col.getBoundingClientRect = () => ({ top: 100, bottom: 400, left: 0, right: 36 });
    e.rcell('chip:9').getBoundingClientRect = () => ({ top: 520 - col.scrollTop, bottom: 568 - col.scrollTop, left: 0, right: 36 });
    e.clk(e.rcell('chip:9'));
    check('10 layers: selecting the last chip scrolls the chips column so that the chip is inside (scrollTop = the overhang, 168), and the scrolling column holds the 10 layer chips only (the Base chip is outside it)', col.scrollTop === 168 && col.children.length === 10 && !col.children.some(b => b.dataset.key === 'chip:base'), 'scrollTop ' + col.scrollTop);
    check('10 layers: the Base chip is a fixed child of group 1, BEFORE the scrolling column and "+" after it (it never scrolls out of view; the Tab order stays Base, layer chips, "+", eye, "...", x), and it is not rebuilt with the rows (the same button after the layers change)', e.rail.children[0].children.length === 3 && e.railBase().dataset.key === 'chip:base' && e.railBase().tagName === 'BUTTON' && e.railAdd().dataset.key === 'add' && J(e.rkeys()) === J(['chip:base'].concat(Array.from({ length: 10 }, (_, i) => 'chip:' + i), ['add', 'eye', 'more', 'x'])) && (() => { const b = e.railBase(); e.layers.push(L()); e.sync(); return e.railBase() === b; })());
    e.clk(e.railBase());
    check('...the fixed Base chip works like the others: layerApi.select(\'base\') once, it is active (aria-current) and the actions are disabled again', J(e.calls.slice(-1)) === J([['select', 'base']]) && e.railBase().getAttribute('aria-current') === 'true' && e.railBase().classList.contains('active') && e.rcell('x').getAttribute('aria-disabled') === 'true');
    // one rebuild keeps the rail's focus
    e = build({ layers: [L(), L()], active: 0 });
    e.rcell('chip:1').focus(); e.layers.push(L()); e.sync();
    check('the focused rail chip survives a rebuild (a layer added elsewhere): the focus is on the chip with the same key', e.doc.activeElement && e.doc.activeElement.dataset.key === 'chip:1' && e.doc.activeElement === e.rcell('chip:1'));
    // a page without the rail still works
    e = build({ layers: [L()], active: 0, noRail: true });
    check('a page without #layer-rail still builds the table (the rail is optional in the script)', J(e.keys()) === J(['chip:base', 'chip:0', 'eye:0', 'x:0', 'add', 'more']));
    // the cost of a tick
    e = build({ layers: [L({ connections: [[1, 2]] }), L()], active: 0 });
    let t0 = process.hrtime.bigint(); for (let i = 0; i < 20000; i++) e.sync(); const per = Number(process.hrtime.bigint() - t0) / 20000 / 1e6;
    check('a tick with nothing changed (2 layers) builds nothing and costs far below 0.1 ms (signature compare + the name line)', per < 0.1, per.toFixed(4) + ' ms');
    console.log('      (measured: ' + per.toFixed(4) + ' ms per unchanged tick)');
});

// ================= 3. the source =================
console.log('\n== the markup, the CSS and the one block in sketch.js ==');
T('source', () => {
    const rowStart = HTML.indexOf('<div class="canvas-row">'), rowEnd = HTML.indexOf('<div class="main-container">');
    const canvasRow = rowStart >= 0 && rowEnd > rowStart ? HTML.slice(rowStart, rowEnd) : '';
    const tag = (canvasRow.match(/<div id="layer-table"[^>]*>/) || [''])[0];
    const railTag = (canvasRow.match(/<div id="layer-rail"[^>]*>/) || [''])[0];
    check('#layer-table and #layer-rail are the LAST TWO children of the canvas row (the table, then the rail), each role="group", aria-label "Ebenen", data-i18n, empty in the markup (ui-layers.js builds them)', /class="layer-table"/.test(tag) && /role="group"/.test(tag) && /aria-label="Ebenen"/.test(tag) && /data-i18n="layers\.table"/.test(tag) && /class="layer-rail"/.test(railTag) && /role="group"/.test(railTag) && /aria-label="Ebenen"/.test(railTag) && /data-i18n="layers\.rail"/.test(railTag) && /<div id="layer-table"[^>]*><\/div>[\s\S]*?<div id="layer-rail"[^>]*><\/div>\s*<\/div>\s*$/.test(canvasRow) && (canvasRow.match(/id="layer-table"/g) || []).length === 1 && (canvasRow.match(/id="layer-rail"/g) || []).length === 1);
    check('the old layer row is still in the DOM: #layer-row-group > #layer-row with #btn-layer-base, #layer-tabs, #btn-add-layer, and #layer-more-row stays', /id="layer-row-group"[\s\S]*?id="layer-row"[\s\S]*?id="btn-layer-base"[\s\S]*?id="layer-tabs"[\s\S]*?id="btn-add-layer"/.test(HTML) && HTML.includes('id="layer-more-row"') && HTML.includes('id="btn-more-layer"') && HTML.includes('id="layer-more-panel"'));
    const ov = (HTML.match(/<div id="layer-remove-overlay"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/) || [''])[0];
    check('the remove dialog: a dialog-overlay (hidden), Cancel BEFORE Confirm (Cancel has the initial focus), data-i18n on the texts', /class="dialog-overlay hidden"/.test(ov) && ov.indexOf('id="cancel-layer-remove"') > 0 && ov.indexOf('id="confirm-layer-remove"') > ov.indexOf('id="cancel-layer-remove"') && /data-i18n="layers\.remove\.cancel"/.test(ov) && /data-i18n="layers\.remove\.confirm"/.test(ov));
    const order = ['<script src="sketch.js', '<script src="ui.js', '<script src="ui-form.js', '<script src="ui-layer.js', '<script src="ui-layers.js', '<script src="ui-net.js'].map(s => HTML.indexOf(s));
    check('ui-layers.js is loaded with a ?v= after ui.js and ui-layer.js (UI and the layer controls exist) and before ui-net.js', order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])) && /<script src="ui-layers\.js\?v=\w+"><\/script>/.test(HTML), order.join(','));
    // the CSS
    const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const MQ = '@media (pointer: fine) and (min-width: 936px), (pointer: coarse) and (min-width: 1032px) {';
    const qi = css.indexOf(MQ);
    check('the table shows only in ONE media query: a fine pointer >= 936px, a coarse pointer >= 1032px (the exact thresholds, measured: 156 px + 8 px gap fit (W - 560) / 2 - 24 from 936; 204 + 8 from 1032)', qi > 0 && css.split(MQ).length === 2);
    let depth = 0, end = qi + MQ.length; for (; end < css.length; end++) { if (css[end] === '{') depth++; else if (css[end] === '}') { if (!depth) break; depth--; } }
    const inside = qi > 0 ? css.slice(qi + MQ.length, end) : '', outside = qi > 0 ? css.slice(0, qi) + css.slice(end + 1) : css;
    check('the default is hidden (.layer-table { display: none }) outside the query; inside it the table is a flex column, positioned ABSOLUTELY at the right gutter (right: 24px, top: var(--gap)), 4 columns wide: 4 x --target + 3 gaps (156px fine / 204px coarse)', /\.layer-table\s*\{\s*display:\s*none;\s*\}/.test(outside) && /\.layer-table\s*\{[^}]*display:\s*flex[^}]*position:\s*absolute[^}]*top:\s*var\(--gap\)[^}]*right:\s*24px[^}]*width:\s*calc\(4 \* var\(--target\) \+ 3 \* var\(--rail-gap\)\)/.test(inside));
    const RQ = '@media (min-width: 768px) and (max-width: 935px) and (pointer: fine), (min-width: 768px) and (max-width: 1031px) and (pointer: coarse) {';
    const ri = css.indexOf(RQ);
    let rdepth = 0, rend = ri + RQ.length; for (; rend < css.length; rend++) { if (css[rend] === '{') rdepth++; else if (css[rend] === '}') { if (!rdepth) break; rdepth--; } }
    const railInside = ri > 0 ? css.slice(ri + RQ.length, rend) : '', outsideBoth = ri > 0 && qi > 0 ? (css.slice(0, Math.min(qi, ri)) + css.slice(Math.min(qi, ri) === qi ? end + 1 : rend + 1, Math.max(qi, ri)) + css.slice((Math.max(qi, ri) === qi ? end : rend) + 1)) : css;
    const OLDROW = /#layer-row, #layer-more-row\s*\{\s*display:\s*none;\s*\}/, OLDGROUP = /#layer-row-group:has\(> #paste-pattern-status:empty\)\s*\{\s*display:\s*none;\s*\}/;
    check('the old row is hidden inside the TABLE query AND inside the RAIL query (#layer-row, #layer-more-row display: none; the group goes with its row unless the Paste status line has text) - never outside them (below 768px it stays untouched)', OLDROW.test(inside) && OLDGROUP.test(inside) && OLDROW.test(railInside) && OLDGROUP.test(railInside) && !/#layer-row\b/.test(outsideBoth.replace(/#layer-row-group/g, '')) && !/#layer-more-row\s*\{[^}]*display:\s*none/.test(outsideBoth));
    check('the grid reserves the diamond column: the chip in column 1, the eye in 2, the x in 4 (commit 2 fills 3), "+" in 1, "..." in 2', ['lt-chip\\s*\\{[^}]*grid-column:\\s*1', 'lt-eye\\s*\\{[^}]*grid-column:\\s*2', 'lt-x\\s*\\{[^}]*grid-column:\\s*4', 'lt-add\\s*\\{[^}]*grid-column:\\s*1', 'lt-more\\s*\\{[^}]*grid-column:\\s*2'].every(r => new RegExp(r).test(css)) && /\.lt-row, \.layer-table \.lt-foot\s*\{[^}]*grid-template-columns:\s*repeat\(4, var\(--target\)\)/.test(css));
    // ---- the rail's CSS (commit 2) ----
    check('the rail shows only in ONE media query: from 768px (where the left tool rail turns vertical) to the table\'s threshold - a fine pointer 768 to 935px, a coarse pointer 768 to 1031px (the exact query)', ri > 0 && css.split(RQ).length === 2);
    check('the rail is hidden by default (.layer-rail { display: none }) outside the query; inside it is a flex column, positioned ABSOLUTELY at the right gutter (right: 24px, top: var(--gap): level with the canvas top like the left rail), exactly one button wide (width: var(--target)) and never taller than the canvas (max-height: var(--canvas-size))', /\.layer-rail\s*\{\s*display:\s*none;\s*\}/.test(outsideBoth) && /\.layer-rail\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*position:\s*absolute[^}]*top:\s*var\(--gap\)[^}]*right:\s*24px[^}]*width:\s*var\(--target\)[^}]*max-height:\s*var\(--canvas-size\)/.test(railInside));
    check('group 1 scrolls: .lr-chips has overflow-y: auto, min-height: 0 and room for the focus ring (4px padding, -4px margin); its scrollbar is hidden (the column is exactly one button wide)', /\.layer-rail \.lr-chips\s*\{[^}]*overflow-y:\s*auto[^}]*min-height:\s*0/.test(css) && /\.layer-rail \.lr-chips\s*\{[^}]*padding:\s*4px[^}]*margin:\s*-4px/.test(css) && /\.layer-rail \.lr-chips\s*\{[^}]*scrollbar-width:\s*none/.test(css) && /\.layer-rail \.lr-g1\s*\{[^}]*min-height:\s*0[^}]*flex:\s*0 1 auto/.test(css) && /\.layer-rail \.lr-g2\s*\{[^}]*flex:\s*none/.test(css));
    check('the rail has a hairline between the groups (.lr-g2::before, like the left rail\'s) and the disabled / dimmed styles of the table apply to it too', /\.layer-rail \.lr-g2::before\s*\{[^}]*height:\s*1px[^}]*background:\s*var\(--color-hairline\)/.test(css) && /\.layer-rail \.icon-btn\[aria-disabled="true"\]/.test(css) && /\.layer-rail \.lt-chip\.is-hidden:not\(\.active\)/.test(css));
    check('the rail is NOT restyled below 768px (the phone strip is commit 4): the rail query starts at min-width: 768px and the old row\'s own rules are not touched', !/@media[^{]*max-width:\s*767px[^{]*\{[^}]*layer-rail/.test(css) && RQ.startsWith('@media (min-width: 768px)') && /,\s*\(min-width: 768px\)/.test(RQ));
    // which view shows at which width: the media queries evaluated, the pointer types and every width
    const evalMQ = (q, w, ptr) => q.replace(/^@media\s*/, '').replace(/\s*\{$/, '').split(',').some(list => list.split(' and ').every(c => { const m = c.trim().match(/^\((min-width|max-width|pointer):\s*(\w+?)(px)?\)$/); if (!m) throw new Error('unknown condition ' + c); return m[1] === 'min-width' ? w >= +m[2] : m[1] === 'max-width' ? w <= +m[2] : ptr === m[2]; }));
    let overlap = 0, gaps = 0, below = 0, fits = true; const widths = []; for (let w = 300; w <= 1600; w++) widths.push(w);
    for (const ptr of ['fine', 'coarse']) for (const w of widths) {
        const t = evalMQ(MQ, w, ptr), r = evalMQ(RQ, w, ptr);
        if (t && r) overlap++;
        if (w >= 768 && !t && !r) gaps++;
        if (w < 768 && (t || r)) below++;
        const target = ptr === 'fine' ? 36 : 48, free = (w - 560) / 2 - 24;   // the free width right of the canvas, the 24px gutter taken off
        if (r && free < target + 8) fits = false;
        if (t && free < 4 * target + 3 * 4 + 8) fits = false;
    }
    check('which view shows (the queries evaluated for both pointer types at every width 300..1600): never both (' + overlap + ' overlaps), always exactly one from 768px (' + gaps + ' gaps), none below 768px (' + below + ')', overlap === 0 && gaps === 0 && below === 0);
    check('the arithmetic: wherever the rail shows, (W - 560) / 2 - 24 holds the button plus 8px (36 + 8 fine, 48 + 8 coarse); wherever the table shows, its 4 columns plus 8px (the canvas never moves, nothing overlaps it)', fits === true);
    check('the handover is exact: a fine pointer 935px = rail, 936px = table; a coarse pointer 1031px = rail, 1032px = table; 767px = neither (the old row)', evalMQ(RQ, 935, 'fine') && !evalMQ(MQ, 935, 'fine') && evalMQ(MQ, 936, 'fine') && !evalMQ(RQ, 936, 'fine') && evalMQ(RQ, 1031, 'coarse') && !evalMQ(MQ, 1031, 'coarse') && evalMQ(MQ, 1032, 'coarse') && !evalMQ(RQ, 1032, 'coarse') && !evalMQ(RQ, 767, 'fine') && !evalMQ(RQ, 767, 'coarse') && evalMQ(RQ, 768, 'fine') && evalMQ(RQ, 768, 'coarse'));
    // ---- the table's chip column: room for the focus ring (commit 3) ----
    check('the table\'s chip column (.lt-rows) has the rail\'s room for the keyboard focus ring: 4px padding and an equal negative margin (the outer width and position of the table stay: its width rule is unchanged above), still the scrolling column', /\.layer-table \.lt-rows\s*\{[^}]*padding:\s*4px[^}]*margin:\s*-4px[^}]*overflow-y:\s*auto[^}]*min-height:\s*0/.test(css));
    // ---- the confirmation dialogs (commit 3) ----
    const inlineCss = HTML.replace(/\/\*[\s\S]*?\*\//g, '');
    const genericBtn = (inlineCss.match(/\.dialog-content button\s*\{[^}]*\}/) || [''])[0];
    const ruleBody = sel => (css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')) || [, ''])[1];
    const neutral = ruleBody('.dialog-content .restart-actions button'), danger = ruleBody('.dialog-content .restart-actions .dialog-danger');
    const spec = sel => [(sel.match(/#[\w-]+/g) || []).length, (sel.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) || []).length, (sel.replace(/\.[\w-]+|#[\w-]+|\[[^\]]*\]|:[\w-]+/g, ' ').match(/[a-z][\w-]*/gi) || []).length];
    const gt = (a, b) => { for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; } return false; };
    check('the cause is pinned: index.html\'s generic `.dialog-content button` rule fills EVERY button of any dialog red (background: var(--accent); color: white; border: none) - it stays (the Help and Export "Close" buttons use it), so the two confirmations need rules that out-rank it', /background:\s*var\(--accent\)/.test(genericBtn) && /color:\s*white/.test(genericBtn) && /border:\s*none/.test(genericBtn) && (inlineCss.match(/\.dialog-content button\s*\{/g) || []).length === 1);
    check('"Abbrechen" is the NORMAL outlined button: `.dialog-content .restart-actions button` has a 1px solid var(--text) border, var(--background) background, var(--text) colour, var(--radius); nothing red, no outline override (the focus ring is the global one)', /border:\s*1px solid var\(--text\)/.test(neutral) && /background:\s*var\(--background\)/.test(neutral) && /color:\s*var\(--text\)/.test(neutral) && /border-radius:\s*var\(--radius\)/.test(neutral) && !/accent/.test(neutral) && !/outline/.test(neutral));
    check('the destructive confirm button (.dialog-danger) differs ONLY by a red text and border (var(--danger), its own token, NOT --accent); nothing filled (no background in its rule)', /color:\s*var\(--danger\)/.test(danger) && /border-color:\s*var\(--danger\)/.test(danger) && !/accent/.test(danger) && !/background/.test(danger) && danger.split(';').filter(x => x.trim()).length === 2);
    // contrast of the destructive text: computed from the tokens in index.html (WCAG: relative luminance, (L1 + 0.05) / (L2 + 0.05))
    const hexOf = (block, name) => ((block.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})')) || [, ''])[1]);
    const lumOf = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const ratio = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const rootBlock = (inlineCss.match(/:root\s*\{[^}]*\}/) || [''])[0], darkBlock = (inlineCss.match(/body\.dark\s*\{[^}]*\}/) || [''])[0];
    const lt = { danger: hexOf(rootBlock, 'danger'), accent: hexOf(rootBlock, 'accent'), bg: hexOf(rootBlock, 'background'), hover: hexOf(rootBlock, 'hover-bg') }, dk = { danger: hexOf(darkBlock, 'danger'), accent: hexOf(darkBlock, 'accent'), bg: hexOf(darkBlock, 'background'), hover: hexOf(darkBlock, 'hover-bg') };
    check('--danger: light #d70015 (>= 4.5:1 on the dialog background --background, and on --hover-bg while hovered: 5.38 / 4.72), dark keeps the accent value #ff453a (5.50:1 on #121212; 4.21:1 on the dark hover background, noted, not changed); the ratios are computed here from the tokens', lt.danger === '#d70015' && dk.danger === '#ff453a' && ratio(lt.danger, lt.bg) >= 4.5 && ratio(lt.danger, lt.hover) >= 4.5 && ratio(dk.danger, dk.bg) >= 4.5 && Math.abs(ratio(lt.danger, lt.bg) - 5.38) < 0.01 && Math.abs(ratio(dk.danger, dk.bg) - 5.50) < 0.01, [ratio(lt.danger, lt.bg), ratio(lt.danger, lt.hover), ratio(dk.danger, dk.bg), ratio(dk.danger, dk.hover)].map(x => x.toFixed(2)).join(' / '));
    check('--accent is NOT changed (#ff3b30 light, #ff453a dark: the red Close buttons of Help and Export, 3.55:1 on white) and --danger is used nowhere but the destructive rule (style.css) and its two definitions', lt.accent === '#ff3b30' && dk.accent === '#ff453a' && (css.match(/var\(--danger\)/g) || []).length === 2 && (inlineCss.match(/var\(--danger\)/g) || []).length === 0 && (inlineCss.match(/--danger:/g) || []).length === 2);
    check('both rules out-rank the generic rule by specificity (0,2,1 and 0,3,0 against 0,1,1), so it does not matter which stylesheet comes last', gt(spec('.dialog-content .restart-actions button'), spec('.dialog-content button')) && gt(spec('.dialog-content .restart-actions .dialog-danger'), spec('.dialog-content button')) && J(spec('.dialog-content .restart-actions button')) === J([0, 2, 1]) && J(spec('.dialog-content .restart-actions .dialog-danger')) === J([0, 3, 0]));
    check('the hover state sits inside @media (hover: hover) (no sticky hover on touch)', /@media \(hover: hover\)\s*\{\s*\.dialog-content \.restart-actions button:hover\s*\{\s*background:\s*var\(--hover-bg\);\s*\}\s*\}/.test(css));
    const dlg = id => (HTML.match(new RegExp('<div id="' + id + '"[\\s\\S]*?</div>\\s*</div>\\s*</div>')) || [''])[0];
    const btnTag = (m, id) => (m.match(new RegExp('<button id="' + id + '"[^>]*>')) || [''])[0];
    const rd = dlg('restart-overlay'), ld = dlg('layer-remove-overlay');
    check('both confirmations: the buttons are in .restart-actions, Cancel first without a class, the destructive confirm ("Neu anfangen", "Entfernen") has class="dialog-danger" - the two dialogs look identical', [[rd, 'cancel-restart', 'confirm-restart'], [ld, 'cancel-layer-remove', 'confirm-layer-remove']].every(([m, c, k]) => /class="restart-actions"/.test(m) && m.indexOf('id="' + c + '"') > 0 && m.indexOf('id="' + k + '"') > m.indexOf('id="' + c + '"') && !/class=/.test(btnTag(m, c)) && /class="dialog-danger"/.test(btnTag(m, k))) && (HTML.match(/class="dialog-danger"/g) || []).length === 2);
    // ui-layers.js
    check('ui-layers.js has no p5 binding (no mousePressed, no select()) and uses the shared helpers (UI.guard, UI.name, UI.setDisabled, UI.dialog, UI.onSync)', !/mousePressed|[^.\w]select\(/.test(LAYERS) && ['UI.guard(', 'UI.name(', 'UI.setDisabled(', 'UI.dialog(', 'UI.onSync('].every(s => LAYERS.includes(s)));
    check('ui-layers.js calls ONLY window.layerApi for actions (select, add, remove, setEnabled, toggleMore) and writes no sketch state itself (no assignment to activeLayer / additionalLayers / timeline, no .enabled write)', ['select', 'add', 'remove', 'setEnabled', 'toggleMore'].every(m => new RegExp('api\\(\\)\\.' + m + '\\(').test(LAYERS)) && !/(^|[;{}\n])\s*(activeLayer|additionalLayers|timeline)\s*=[^=]|\.enabled\s*=[^=]/.test(LAYERS));
    check('ui-layers.js (rail): the eye, "..." and x of the rail go through UI.guard (a click on a disabled one shows the reason, never acts); the rail has no name line listener (the name line is bound to the table only)', /UI\.guard\(railEye,/.test(LAYERS) && /UI\.guard\(railMore,/.test(LAYERS) && /UI\.guard\(railX,/.test(LAYERS) && /table\.addEventListener\('pointerdown', touched, true\)/.test(LAYERS) && !/rail\.addEventListener\('(pointerdown|focusin|pointerover)'/.test(LAYERS));
    check('ui-layers.js (rail): the actions are those of the ACTIVE sheet (model.actions.index) and a fourth button is left for the diamond (commented, not drawn)', /lastModel \? lastModel\.actions\.index : null/.test(LAYERS) && /a fourth button, the diamond, comes with the timeline commit/.test(LAYERS) && !/diamond/i.test(LAYERS.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')));
    // the block in sketch.js
    const bi = SKETCH.indexOf('    // layerApi: begin'), ei = SKETCH.indexOf('    // layerApi: end\n');
    const block = bi >= 0 && ei > bi ? SKETCH.slice(bi, ei) : '';
    check('sketch.js: exactly ONE layerApi block (between its two marker comments), one `window.layerApi = {`, and it publishes exactly select, add, remove, setEnabled, toggleMore', (SKETCH.match(/window\.layerApi\s*=/g) || []).length === 1 && J([...block.matchAll(/^        (\w+)\(/gm)].map(m => m[1])) === J(['select', 'add', 'remove', 'setEnabled', 'toggleMore']));
    const body = n => ((block.match(new RegExp('        ' + n + '\\([^)]*\\) \\{ ([^\\n]*) \\},')) || [, ''])[1]);
    check('...each is the sequence the old handlers run: select and add end with the five calls (renderLayerTabs, updateOffsetControls, updateFaceToggleControl, updateTimelineControls, redraw); remove has the tab remove handler\'s four; toggleMore is the old toggle',
        body('select') === 'activeLayer = sheet; renderLayerTabs(); updateOffsetControls(); updateFaceToggleControl(); updateTimelineControls(); redraw();' && body('add') === 'addLayer(); renderLayerTabs(); updateOffsetControls(); updateFaceToggleControl(); updateTimelineControls(); redraw();' && body('remove') === 'removeLayer(index); renderLayerTabs(); updateOffsetControls(); updateFaceToggleControl(); redraw();' && body('toggleMore') === 'layerMoreOpen = !layerMoreOpen; syncLayerMore();', J([body('select'), body('add')]));
    check('...setEnabled is a property write, the old row\'s checkbox refresh (renderLayerTabs) and a redraw: nothing else', body('setEnabled') === 'additionalLayers[index].enabled = !!on; renderLayerTabs(); redraw();');
    check('the block has no logic: no if, no loop, no new let / const (setup() is scanned by p5\'s friendly-error reader) and no block comment', !/\b(if|for|while|let|const)\b|\/\*/.test(block.replace(/\/\/[^\n]*/g, '')));
    check('sketch.js never mentions the table (#layer-table, ui-layers, layerTable): the view is not wired from the sketch', !/layer-table|ui-layers|layerTable/.test(SKETCH.replace(/\/\/[^\n]*/g, '')));
    // the freed eye
    const nodeFn = (SKETCH.match(/function updateNodeToggleIcon\(\) \{[\s\S]*?\n    \}\n/) || [''])[0], freeFn = (SKETCH.match(/function updateFreeVisibleToggleIcon\(\) \{[\s\S]*?\n    \}\n/) || [''])[0];
    check('the eye is free: Toggle Nodes swaps three offset dots (filled circles at (6,17), (12,8), (18,15); a slash when off), no eye path left in it', (nodeFn.match(/<circle cx="(6|12|18)" cy="(17|8|15)" r="2\.2"\/>/g) || []).length === 6 && /M3 3 L21 21/.test(nodeFn) && !/M1 12s4-8/.test(nodeFn) && !/M17\.94/.test(nodeFn));
    check('...#btn-toggle-free-visible swaps the polyline M6 17 L12 8 L18 15 (with a slash when off), no eye path left in it', (freeFn.match(/M6 17 L12 8 L18 15/g) || []).length === 2 && /M3 3 L21 21/.test(freeFn) && !/M1 12s4-8/.test(freeFn) && !/M17\.94/.test(freeFn));
    check('...and the static markup of both buttons matches their start state (nodes: the dots; free-visible: the polyline with the slash), with no eye path anywhere in them', (HTML.match(/id="btn-toggle-nodes"[\s\S]*?<\/button>/) || [''])[0].includes('r="2.2"') && (HTML.match(/id="btn-toggle-free-visible"[\s\S]*?<\/button>/) || [''])[0].includes('M6 17 L12 8 L18 15') && !/M1 12s4-8/.test((HTML.match(/id="btn-toggle-nodes"[\s\S]*?<\/button>/) || [''])[0] + (HTML.match(/id="btn-toggle-free-visible"[\s\S]*?<\/button>/) || [''])[0]));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
