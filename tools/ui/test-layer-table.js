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
// hairline, then the eye, "..." and the remove x of the ACTIVE sheet (disabled with a reason on the Base); no name line. The STRIP (commit 4) is the phone view of the same model: two rows
// under the canvas below 768px (row 1 = the Base chip, the layer chips that scroll sideways, "+"; row 2 = the actions of the active sheet). Exactly one of table, rail and strip shows at every
// width, for both pointer types; the old layer row is hidden at every width.
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
    check('the model is exported without a DOM (layerDisplayNumber, layerRemoveNeedsConfirm, layerTableModel, tableSignature, revealDelta)', !!M && ['layerDisplayNumber', 'layerRemoveNeedsConfirm', 'layerTableModel', 'tableSignature', 'revealDelta', 'panelRevealDelta'].every(k => typeof M[k] === 'function'));
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
    check('panelRevealDelta(unionRect, viewportHeight): 0 while the WHOLE block is inside the viewport (also exactly filling it: 0..812); the overhang when it ends below the bottom (900..1008 in 812: 196) or is cut by it (700..820: 8); negative when it starts above the top (-30..78: -30); a block TALLER than the viewport goes to the top with an 8px margin (100..1000: 92; top at 8: 0; top at -50: -58)', M.panelRevealDelta({ top: 100, bottom: 148 }, 812) === 0 && M.panelRevealDelta({ top: 0, bottom: 812 }, 812) === 0 && M.panelRevealDelta({ top: 764, bottom: 812 }, 812) === 0 && M.panelRevealDelta({ top: 900, bottom: 1008 }, 812) === 196 && M.panelRevealDelta({ top: 700, bottom: 820 }, 812) === 8 && M.panelRevealDelta({ top: -30, bottom: 78 }, 812) === -30 && M.panelRevealDelta({ top: 100, bottom: 1000 }, 812) === 92 && M.panelRevealDelta({ top: 8, bottom: 900 }, 812) === 0 && M.panelRevealDelta({ top: -50, bottom: 900 }, 812) === -58);
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
    scrollIntoView() { if (this.ownerDoc) this.ownerDoc.__scrollIntoView = (this.ownerDoc.__scrollIntoView || 0) + 1; }   // a trap: it can scroll the WINDOW, which the table's reveal must never do
    scrollBy(o) { (this.scrolls = this.scrolls || []).push(o); this.scrollTop = (this.scrollTop || 0) + (o.top || 0); }   // an element's own scrollBy (the table's scroller): recorded and applied
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
    const strip = o.noStrip ? null : mkEl('layer-strip', 'div', 'layer-strip');
    const overlay = mkEl('layer-remove-overlay', 'div', 'dialog-overlay hidden'), content = new El('div'); content.className = 'dialog-content'; content.ownerDoc = doc; overlay.appendChild(content);
    const title = mkEl('layer-remove-title', 'strong'); content.appendChild(title); mkEl('layer-remove-text', 'p'); const cancel = mkEl('cancel-layer-remove', 'button'), confirm = mkEl('confirm-layer-remove', 'button'); content.appendChild(cancel); content.appendChild(confirm);
    const moreSt = { open: !!o.moreOpen, dot: !!o.moreDot };   // what layerApi.moreState() reports (sketch.js: layerMoreOpen and layerMoreDot()); no hidden old toggle in the DOM any more
    // the rare-settings block: a wrapper with a HIDDEN group (a group hidden for this layer: it has a rect far away that must NOT count) and two visible groups; window.scrollBy is recorded
    const scrolls = [];
    const panel = o.noPanel ? null : mkEl('layer-more-panel', 'div');
    const pgHidden = new El('div'), pgNoRects = new El('div'), pgFirst = new El('div'), pgSecond = new El('div');
    const rects = o.blockRects || [[900, 948], [960, 1008]];
    if (panel) {
        [pgHidden, pgNoRects, pgFirst, pgSecond].forEach(g => { g.ownerDoc = doc; g.scrollIntoView = () => { scrolls.push({ wrong: 'scrollIntoView' }); }; });
        pgNoRects.getClientRects = () => []; pgNoRects.getBoundingClientRect = () => ({ top: 7000, bottom: 8000, left: 0, right: 100 });   // not [hidden], but display: none by CSS: no client rects
        pgHidden.hidden = true; pgHidden.getClientRects = () => []; pgHidden.getBoundingClientRect = () => ({ top: 5000, bottom: 6000, left: 0, right: 100 });
        [pgFirst, pgSecond].forEach((g, k) => { g.getClientRects = () => [{}]; g.getBoundingClientRect = () => ({ top: rects[k][0], bottom: rects[k][1], left: 0, right: 100 }); });
        panel.appendChild(pgHidden); panel.appendChild(pgNoRects); panel.appendChild(pgFirst); panel.appendChild(pgSecond);
        if (o.allHidden) { pgFirst.hidden = true; pgSecond.hidden = true; }
    }
    const clock = { t: 0 }, calls = [], moq = [];   // moq: the MutationObserver callbacks, run AFTER the click handler like a browser's microtask (UI.dialog moves the focus there)
    const layers = o.layers || [], st = { layers, active: o.active === undefined ? 'base' : o.active, timeline: o.timeline === undefined ? null : o.timeline };
    const ctx = vm.createContext({ document: doc, console, MutationObserver: class { constructor(cb) { this.cb = cb; } observe(el) { el.onClass = () => { moq.push(this.cb); }; } }, setTimeout: (f) => 0, clearTimeout() { }, performance: { now: () => clock.t } });
    ctx.window = ctx; ctx.matchMedia = q => ({ matches: !!o.reduced && /prefers-reduced-motion:\s*reduce\b/.test(q) }); ctx.innerWidth = 1200; ctx.innerHeight = 812; ctx.scrollBy = opts => { scrolls.push(opts); }; ctx.addEventListener = (type, fn) => { (ctx.__wl = ctx.__wl || {})[type] = (ctx.__wl[type] || []).concat(fn); };
    ctx.additionalLayers = layers; ctx.activeLayer = st.active; ctx.timeline = st.timeline;
    ctx.layerApi = {
        select(sheet) { calls.push(['select', sheet]); ctx.activeLayer = sheet; },
        add() { calls.push(['add']); layers.push({ connections: [], enabled: true }); ctx.activeLayer = layers.length - 1; },
        remove(i) { calls.push(['remove', i]); layers.splice(i, 1); if (ctx.activeLayer === i) ctx.activeLayer = 'base'; },
        setEnabled(i, on) { calls.push(['setEnabled', i, on]); if (layers[i]) layers[i].enabled = !!on; },
        toggleMore() { calls.push(['toggleMore']); moreSt.open = !moreSt.open; },
        moreState() { return { open: moreSt.open, dot: moreSt.dot }; },
    };
    if (o.noApi) delete ctx.layerApi;   // the first sync runs before sketch.js has set layerApi up
    if (o.noMoreState) delete ctx.layerApi.moreState;
    if (UI_SRC) vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    vm.runInContext(LAYERS, ctx, { filename: 'ui-layers.js' });
    const sync = () => ctx.window.uiSync();
    const tRows = () => [table.children[0]].concat(table.children[1].children);   // the Base row (children[0]), then the scrolling layer rows (children[1]); the foot is children[2], the name line children[3]
    const cell = key => { for (const r of tRows()) for (const b of r.children) if (b.dataset.key === key) return b; return key === 'add' || key === 'more' ? table.children[2].children.find(b => b.dataset.key === key) : null; };
    const keys = () => tRows().flatMap(r => r.children.map(b => b.dataset.key)).concat(table.children[2].children.map(b => b.dataset.key));
    // the rail: [0] group 1 = [the Base chip, the scrolling layer-chips column, "+"], [1] group 2 = [eye, diamond, "...", x]
    const railBase = () => rail.children[0].children[0], railChips = () => rail.children[0].children[1], railAdd = () => rail.children[0].children[2], railActions = () => rail.children[1].children;
    const rcell = key => { for (const b of [railBase()].concat(railChips().children, [railAdd()], railActions())) if (b.dataset.key === key) return b; return null; };
    const rkeys = () => [railBase().dataset.key].concat(railChips().children.map(b => b.dataset.key), [railAdd().dataset.key], railActions().map(b => b.dataset.key));
    // the strip: the same structure as the rail ([0] group 1 = [Base chip, the scrolling chips, "+"], [1] group 2 = [eye, diamond, "...", x])
    const sv = strip ? { base: () => strip.children[0].children[0], chips: () => strip.children[0].children[1], add: () => strip.children[0].children[2], actions: () => strip.children[1].children } : null;
    const scell = key => { for (const b of [sv.base()].concat(sv.chips().children, [sv.add()], sv.actions())) if (b.dataset.key === key) return b; return null; };
    const skeys = () => [sv.base().dataset.key].concat(sv.chips().children.map(b => b.dataset.key), [sv.add().dataset.key], sv.actions().map(b => b.dataset.key));
    return { ctx, doc, table, rail, strip, sv, scell, skeys, scrolls, panel, pgFirst, pgSecond, railBase, railChips, railAdd, rcell, rkeys, calls, layers, sync, cell, keys, overlay, cancel, confirm, moreSt, byId, clk: b => { b.dispatch('click', { detail: 1 }); while (moq.length) moq.shift()([]); } };
}
T('dom', () => {
    const L = (extra) => Object.assign({ connections: [], enabled: true }, extra || {});
    let e = build({});
    check('empty state: the cells are chip:base, "+" and "..."; "..." has aria-disabled and the reason as its reason', J(e.keys()) === J(['chip:base', 'add', 'more']) && e.cell('more').getAttribute('aria-disabled') === 'true' && e.cell('more').dataset.reason === 'Keine Ebene aktiv.');
    check('the Base chip is a stack icon (no number) named "Basis", aria-current while active', /<svg/.test(e.cell('chip:base').innerHTML) && e.cell('chip:base').getAttribute('aria-label') === 'Basis' && e.cell('chip:base').getAttribute('aria-current') === 'true' && e.cell('chip:base').classList.contains('active'));
    check('every cell is a real <button type="button"> with an aria-label, title = aria-label (UI.name; "..." shows its reason as the title while disabled), a .lt-cell class, and no mousedown (p5) listener', e.keys().every(k => { const b = e.cell(k); return b.tagName === 'BUTTON' && b.type === 'button' && b.getAttribute('aria-label') && (k === 'more' || b.getAttribute('title') === b.getAttribute('aria-label')) && b.classList.contains('lt-cell') && !b.handlers.mousedown; }));
    e.clk(e.cell('add')); e.sync();
    check('"+" calls layerApi.add() once and the table shows the new row at once (chip:0 active, its eye pressed)', J(e.calls) === J([['add']]) && J(e.keys()) === J(['chip:base', 'chip:0', 'eye:0', 'dia:0', 'x:0', 'add', 'more']) && e.cell('chip:0').classList.contains('active') && e.cell('eye:0').getAttribute('aria-pressed') === 'true');
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
    check('the playback layer has no row: cells chip:0 / chip:1 / chip:3 only, and the chip of array index 3 shows "3"', e.keys().join() === 'chip:base,chip:0,eye:0,dia:0,x:0,chip:1,eye:1,dia:1,x:1,chip:3,eye:3,dia:3,x:3,add,more' && e.cell('chip:3').textContent === '3');
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
    check('Confirm removes the layer once (layerApi.remove(0)) and closes the dialog', J(e.calls) === J([['remove', 0]]) && e.overlay.classList.contains('hidden') && J(e.keys()) === J(['chip:base', 'chip:0', 'eye:0', 'dia:0', 'x:0', 'add', 'more']));
    e = build({ layers: [L(), L({ connections: [[1, 2]] })], active: 'base' });
    e.clk(e.cell('x:1')); e.clk(e.confirm);
    check('...and it removes THE layer that was asked about (a second layer with a line: remove(1), not remove(0))', J(e.calls) === J([['remove', 1]]) && e.layers.length === 1);
    e = build({ layers: [L(), L()], active: 'base', timeline: { keyframeLayerIds: [1], playbackLayerIndex: null } });
    e.clk(e.cell('x:1'));
    check('x on a timeline keyframe without lines still asks, and the text names the keyframe and the line pairings', e.calls.length === 0 && /Keyframe der Timeline/.test(e.byId['layer-remove-text'].textContent) && /Linienzuordnungen/.test(e.byId['layer-remove-text'].textContent));
    // name line
    e = build({ layers: [L({ enabled: false })], active: 0, timeline: { keyframeLayerIds: [0], playbackLayerIndex: null } });
    const nameEl = e.table.children[3];
    check('the name line is aria-hidden and shows the hint "Symbol antippen" until something is touched', !!nameEl && nameEl.getAttribute('aria-hidden') === 'true' && nameEl.textContent === 'Symbol antippen');
    e.cell('eye:0').dispatch('pointerdown', { pointerType: 'touch' });
    check('a pointerdown on the eye of a hidden keyframe: "Ebene 1 · Keyframe, ausgeblendet"; switched on it says "Keyframe, zusätzlich sichtbar" on the next tick', nameEl.textContent === 'Ebene 1 · Keyframe, ausgeblendet' && (e.clk(e.cell('eye:0')), e.sync(), nameEl.textContent === 'Ebene 1 · Keyframe, zusätzlich sichtbar'));
    e.cell('chip:base').dispatch('pointerover', { pointerType: 'touch' });
    check('a pointerover from touch is ignored (nothing depends on hover); a mouse pointerover and a focusin show the icon', nameEl.textContent.startsWith('Ebene 1') && (e.cell('chip:base').dispatch('pointerover', { pointerType: 'mouse' }), nameEl.textContent.startsWith('Basis')) && (e.cell('x:0').focus(), nameEl.textContent === 'Ebene 1 entfernen'));
    // ---- the rail (commit 2) ----
    e = build({});
    const g1 = e.rail.children[0] ? e.rail.children[0].children : [];
    check('rail, structure (read without the helpers): group 1 = [the Base chip, the scrolling column (empty without layers), "+"], so the Base chip is a fixed child of the group, not of the scrolling column; group 2 = [eye, diamond, "...", x]', g1.length === 3 && g1[0].dataset.key === 'chip:base' && g1[1].className === 'lr-chips' && g1[1].children.length === 0 && g1[2].dataset.key === 'add' && e.rail.children[1] && J(e.rail.children[1].children.map(b => b.dataset.key)) === J(['eye', 'dia', 'more', 'x']));
    check('rail, empty state: the Base chip, "+", then the four actions in the order eye, diamond, "...", x (the Tab order: chips, "+", eye, diamond, "...", x); no layer chips', J(e.rkeys()) === J(['chip:base', 'add', 'eye', 'dia', 'more', 'x']));
    check('rail, on the Base: the eye, "..." and x are PRESENT and aria-disabled with the reason "Keine Ebene aktiv." (title = the reason), nothing jumps; "+" and the Base chip are enabled', ['eye', 'dia', 'more', 'x'].every(k => e.rcell(k).getAttribute('aria-disabled') === 'true' && e.rcell(k).dataset.reason === 'Keine Ebene aktiv.' && e.rcell(k).getAttribute('title') === 'Keine Ebene aktiv.') && ['chip:base', 'add'].every(k => e.rcell(k).getAttribute('aria-disabled') === null));
    e.calls.length = 0; ['eye', 'dia', 'more', 'x'].forEach(k => e.clk(e.rcell(k)));
    check('...a click on a disabled action does nothing (no layerApi call, no dialog): the reason is shown instead', e.calls.length === 0 && e.overlay.classList.contains('hidden'));
    check('rail, every button: a real <button type="button"> with an aria-label (UI.name), a .lt-cell class and no mousedown (p5) listener; the rail has no name line (no aria-hidden element, no pointerdown / focusin listener on it)', e.rkeys().every(k => { const b = e.rcell(k); return b.tagName === 'BUTTON' && b.type === 'button' && !!b.getAttribute('aria-label') && b.classList.contains('lt-cell') && !b.handlers.mousedown; }) && !e.rail.handlers.pointerdown && !e.rail.handlers.focusin && !e.rail.handlers.pointerover && !/aria-hidden/.test(J(e.rail.children.map(function w(c) { return [c._a, c.children.map(w)]; }))));
    check('rail, names: "Ebene hinzufügen", "Ebenen-Einstellungen" (the reason as the title while disabled), "Ebene sichtbar" and "Ebene entfernen" on the Base; the Base chip "Basis"', e.rcell('add').getAttribute('aria-label') === 'Ebene hinzufügen' && e.rcell('more').getAttribute('aria-label') === 'Ebenen-Einstellungen' && e.rcell('eye').getAttribute('aria-label') === 'Ebene sichtbar' && e.rcell('x').getAttribute('aria-label') === 'Ebene entfernen' && e.rcell('chip:base').getAttribute('aria-label') === 'Basis');
    e.calls.length = 0; e.clk(e.rcell('add'));
    check('rail "+": layerApi.add() once; both views show the new row on the same tick (the table row and the rail chip), the new chip is active, the actions are enabled and named for it', J(e.calls) === J([['add']]) && J(e.keys()) === J(['chip:base', 'chip:0', 'eye:0', 'dia:0', 'x:0', 'add', 'more']) && J(e.rkeys()) === J(['chip:base', 'chip:0', 'add', 'eye', 'dia', 'more', 'x']) && e.rcell('chip:0').classList.contains('active') && e.rcell('chip:0').textContent === '1' && e.rcell('eye').getAttribute('aria-disabled') === null && e.rcell('x').getAttribute('aria-disabled') === null && e.rcell('more').getAttribute('aria-disabled') === null && e.rcell('eye').getAttribute('aria-label') === 'Ebene 1 sichtbar' && e.rcell('x').getAttribute('aria-label') === 'Ebene 1 entfernen');
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
    check('rail, the playback layer has no chip: chip:0, chip:1, chip:3 (numbers 1, 2, 3), the actions are the third layer\'s', J(e.rkeys()) === J(['chip:base', 'chip:0', 'chip:1', 'chip:3', 'add', 'eye', 'dia', 'more', 'x']) && e.rcell('chip:3').textContent === '3' && e.rcell('x').getAttribute('aria-label') === 'Ebene 3 entfernen');
    // many layers: the rail keeps the active chip inside its scrolling column
    e = build({ layers: Array.from({ length: 10 }, () => L()), active: 'base' });
    const col = e.railChips(); col.scrollTop = 0;
    col.getBoundingClientRect = () => ({ top: 100, bottom: 400, left: 0, right: 36 });
    e.rcell('chip:9').getBoundingClientRect = () => ({ top: 520 - col.scrollTop, bottom: 568 - col.scrollTop, left: 0, right: 36 });
    e.clk(e.rcell('chip:9'));
    check('10 layers: selecting the last chip scrolls the chips column so that the chip is inside (scrollTop = the overhang, 168), and the scrolling column holds the 10 layer chips only (the Base chip is outside it)', col.scrollTop === 168 && col.children.length === 10 && !col.children.some(b => b.dataset.key === 'chip:base'), 'scrollTop ' + col.scrollTop);
    check('10 layers: the Base chip is a fixed child of group 1, BEFORE the scrolling column and "+" after it (it never scrolls out of view; the Tab order stays Base, layer chips, "+", eye, "...", x), and it is not rebuilt with the rows (the same button after the layers change)', e.rail.children[0].children.length === 3 && e.railBase().dataset.key === 'chip:base' && e.railBase().tagName === 'BUTTON' && e.railAdd().dataset.key === 'add' && J(e.rkeys()) === J(['chip:base'].concat(Array.from({ length: 10 }, (_, i) => 'chip:' + i), ['add', 'eye', 'dia', 'more', 'x'])) && (() => { const b = e.railBase(); e.layers.push(L()); e.sync(); return e.railBase() === b; })());
    e.clk(e.railBase());
    check('...the fixed Base chip works like the others: layerApi.select(\'base\') once, it is active (aria-current) and the actions are disabled again', J(e.calls.slice(-1)) === J([['select', 'base']]) && e.railBase().getAttribute('aria-current') === 'true' && e.railBase().classList.contains('active') && e.rcell('x').getAttribute('aria-disabled') === 'true');
    // one rebuild keeps the rail's focus
    e = build({ layers: [L(), L()], active: 0 });
    e.rcell('chip:1').focus(); e.layers.push(L()); e.sync();
    check('the focused rail chip survives a rebuild (a layer added elsewhere): the focus is on the chip with the same key', e.doc.activeElement && e.doc.activeElement.dataset.key === 'chip:1' && e.doc.activeElement === e.rcell('chip:1'));
    // a page without the rail still works
    e = build({ layers: [L()], active: 0, noRail: true });
    check('a page without #layer-rail still builds the table (the rail is optional in the script)', J(e.keys()) === J(['chip:base', 'chip:0', 'eye:0', 'dia:0', 'x:0', 'add', 'more']));
    // ---- the strip (commit 4): the same model, the same handlers, the same layerApi, built by the same function as the rail ----
    e = build({});
    const sg1 = e.strip.children[0] ? e.strip.children[0].children : [];
    check('strip, structure (read without the helpers): group 1 = [the Base chip, the scrolling column (empty without layers), "+"]; group 2 = [eye, diamond, "...", x]; the Base chip is a fixed child, not in the column', sg1.length === 3 && sg1[0].dataset.key === 'chip:base' && sg1[1].className === 'lr-chips' && sg1[1].children.length === 0 && sg1[2].dataset.key === 'add' && e.strip.children[1] && J(e.strip.children[1].children.map(b => b.dataset.key)) === J(['eye', 'dia', 'more', 'x']));
    check('strip, the Tab order on the Base: Base, "+", eye, diamond, "...", x; the actions are PRESENT and aria-disabled with the reason "Keine Ebene aktiv." (title = the reason) so nothing jumps; every cell is a real <button type="button"> with an aria-label, a .lt-cell class and no p5 mousedown listener; no name line (no listener on the strip)', J(e.skeys()) === J(['chip:base', 'add', 'eye', 'dia', 'more', 'x']) && ['eye', 'dia', 'more', 'x'].every(k => e.scell(k).getAttribute('aria-disabled') === 'true' && e.scell(k).dataset.reason === 'Keine Ebene aktiv.' && e.scell(k).getAttribute('title') === 'Keine Ebene aktiv.') && e.skeys().every(k => { const b = e.scell(k); return b.tagName === 'BUTTON' && b.type === 'button' && !!b.getAttribute('aria-label') && b.classList.contains('lt-cell') && !b.handlers.mousedown; }) && !e.strip.handlers.pointerdown && !e.strip.handlers.focusin && !e.strip.handlers.pointerover);
    e.calls.length = 0; ['eye', 'dia', 'more', 'x'].forEach(k => e.clk(e.scell(k)));
    check('strip, a click on a disabled action calls nothing and opens no dialog (the reason is shown instead)', e.calls.length === 0 && e.overlay.classList.contains('hidden'));
    e.clk(e.scell('add'));
    check('strip "+": layerApi.add() once; the table, the rail and the strip all show the new layer on the same tick; its chip is active, the actions are enabled and named for it ("Ebene 1 sichtbar" / "Ebene 1 entfernen")', J(e.calls) === J([['add']]) && J(e.keys()) === J(['chip:base', 'chip:0', 'eye:0', 'dia:0', 'x:0', 'add', 'more']) && J(e.rkeys()) === J(['chip:base', 'chip:0', 'add', 'eye', 'dia', 'more', 'x']) && J(e.skeys()) === J(['chip:base', 'chip:0', 'add', 'eye', 'dia', 'more', 'x']) && e.scell('chip:0').classList.contains('active') && e.scell('chip:0').textContent === '1' && e.scell('eye').getAttribute('aria-disabled') === null && e.scell('eye').getAttribute('aria-label') === 'Ebene 1 sichtbar' && e.scell('x').getAttribute('aria-label') === 'Ebene 1 entfernen');
    e = build({ layers: [L(), L()], active: 1 });
    e.clk(e.scell('eye'));
    check('strip eye with two layers and the SECOND active: setEnabled(1, false) once (the ACTIVE layer), the same button stays, aria-pressed false, the crossed eye; a second click switches it back ON (the opposite value, not a constant)', J(e.calls) === J([['setEnabled', 1, false]]) && e.layers[1].enabled === false && e.layers[0].enabled === true && e.scell('eye').getAttribute('aria-pressed') === 'false' && /M1 1l22 22/.test(e.scell('eye').innerHTML) && e.scell('chip:1').classList.contains('is-hidden') && e.rcell('chip:1').classList.contains('is-hidden') && (e.calls.length = 0, e.clk(e.scell('eye')), J(e.calls) === J([['setEnabled', 1, true]]) && e.layers[1].enabled === true));
    e.calls.length = 0; e.clk(e.scell('chip:0'));
    check('strip chips: layerApi.select(<index>) once; the actions follow (labelled "Ebene 1 ..."); the fixed Base chip selects \'base\' and disables the actions again', J(e.calls) === J([['select', 0]]) && e.scell('x').getAttribute('aria-label') === 'Ebene 1 entfernen' && (e.clk(e.sv.base()), J(e.calls[1]) === J(['select', 'base']) && e.sv.base().getAttribute('aria-current') === 'true' && e.scell('x').getAttribute('aria-disabled') === 'true'));
    e = build({ layers: [L(), L()], active: 1 });
    e.clk(e.scell('x'));
    check('strip x on an EMPTY plain active layer: remove(<the active index>) at once, no dialog, the focus lands on the active chip IN THE STRIP', J(e.calls) === J([['remove', 1]]) && e.overlay.classList.contains('hidden') && e.doc.activeElement === e.scell('chip:base'));
    e = build({ layers: [L(), L({ connections: [[1, 2], [3, 4]] })], active: 1 });
    e.clk(e.scell('x'));
    check('strip x on a layer WITH lines: the same dialog ("Ebene 2 entfernen?", "2 Linien"), remove not called yet', e.calls.length === 0 && !e.overlay.classList.contains('hidden') && e.byId['layer-remove-title'].textContent === 'Ebene 2 entfernen?' && /2 Linien/.test(e.byId['layer-remove-text'].textContent));
    e.clk(e.cancel);
    check('...Cancel closes it without removing and the focus goes back to the STRIP\'s x (not the rail\'s, not a table cell); Confirm removes that layer once and the focus goes to the active chip of the strip', e.calls.length === 0 && e.doc.activeElement === e.scell('x') && (e.clk(e.scell('x')), e.clk(e.confirm), J(e.calls) === J([['remove', 1]]) && e.layers.length === 1 && e.doc.activeElement === e.scell('chip:base')));
    e = build({ layers: [L()], active: 0 });
    e.clk(e.scell('more'));
    check('strip "...": layerApi.toggleMore() once; aria-expanded mirrors in the strip, the rail and the table on the same tick', J(e.calls) === J([['toggleMore']]) && e.scell('more').getAttribute('aria-expanded') === 'true' && e.rcell('more').getAttribute('aria-expanded') === 'true' && e.cell('more').getAttribute('aria-expanded') === 'true');
    e = build({ layers: [L(), L(), L({ isTimelinePlayback: true }), L()], active: 3, timeline: { keyframeLayerIds: [0, 1], playbackLayerIndex: 2 } });
    check('strip, the keyframe layers are chips 1 and 2, the playback layer has no chip, the plain layer is 3 (the running numbers), the actions are the third layer\'s', J(e.skeys()) === J(['chip:base', 'chip:0', 'chip:1', 'chip:3', 'add', 'eye', 'dia', 'more', 'x']) && e.scell('chip:0').textContent === '1' && e.scell('chip:1').textContent === '2' && e.scell('chip:3').textContent === '3' && e.scell('x').getAttribute('aria-label') === 'Ebene 3 entfernen');
    // many layers: the strip scrolls SIDEWAYS and keeps the active chip inside
    e = build({ layers: Array.from({ length: 10 }, () => L()), active: 'base' });
    const scol = e.sv.chips(); scol.scrollLeft = 0; scol.scrollTop = 0;
    scol.getBoundingClientRect = () => ({ left: 60, right: 260, top: 0, bottom: 48 });
    e.scell('chip:9').getBoundingClientRect = () => ({ left: 560 - scol.scrollLeft, right: 608 - scol.scrollLeft, top: 0, bottom: 48 });
    e.clk(e.scell('chip:9'));
    check('10 layers: selecting the last chip scrolls the strip\'s column SIDEWAYS so that the chip is inside (scrollLeft = the overhang 348, scrollTop untouched), the column holds the 10 layer chips only, the Base chip and "+" are fixed outside it', scol.scrollLeft === 348 && scol.scrollTop === 0 && scol.children.length === 10 && !scol.children.some(b => b.dataset.key === 'chip:base') && e.strip.children[0].children.length === 3 && J(e.skeys()) === J(['chip:base'].concat(Array.from({ length: 10 }, (_, i) => 'chip:' + i), ['add', 'eye', 'dia', 'more', 'x'])), 'scrollLeft ' + scol.scrollLeft);
    e = build({ layers: [L(), L()], active: 0 });
    e.scell('chip:1').focus(); e.layers.push(L()); e.sync();
    check('the focused strip chip survives a rebuild (a layer added elsewhere)', e.doc.activeElement === e.scell('chip:1'));
    e = build({ layers: [L()], active: 0, noStrip: true });
    check('a page without #layer-strip still builds the table and the rail (the strip is optional in the script)', J(e.keys()) === J(['chip:base', 'chip:0', 'eye:0', 'dia:0', 'x:0', 'add', 'more']) && J(e.rkeys()) === J(['chip:base', 'chip:0', 'add', 'eye', 'dia', 'more', 'x']));
    // ---- the rare-settings block is revealed when it opens (commit 5) ----
    e = build({ layers: [L()], active: 0 });
    e.cell('more').focus();
    e.clk(e.cell('more'));
    check('opening the block from the TABLE\'s "..." with the block below the fold (the union of its two visible groups 900..1008 in a 812px viewport; a [hidden] group\'s rect 5000..6000 and a group without client rects 7000..8000 do not count): window.scrollBy is called ONCE with { top: 196, behavior: \'smooth\' } (the whole block ends at the bottom edge); the focus stays on the "..." button', e.scrolls.length === 1 && J(e.scrolls[0]) === J({ top: 196, behavior: 'smooth' }) && e.doc.activeElement === e.cell('more'));
    e.clk(e.cell('more'));
    check('...closing it scrolls nothing', e.scrolls.length === 1 && e.cell('more').getAttribute('aria-expanded') === 'false');
    e = build({ layers: [L()], active: 0, blockRects: [[200, 248], [260, 308]] });
    e.clk(e.cell('more'));
    check('...no scroll when the WHOLE block is already inside the viewport (200..308)', e.scrolls.length === 0 && e.cell('more').getAttribute('aria-expanded') === 'true');
    e = build({ layers: [L()], active: 0, blockRects: [[700, 748], [760, 820]] });
    e.clk(e.cell('more'));
    check('...a block whose FIRST group is visible but whose last group is cut (700..820) scrolls by the overhang, 8px (the old first-group rule would not have)', e.scrolls.length === 1 && J(e.scrolls[0]) === J({ top: 8, behavior: 'smooth' }));
    e = build({ layers: [L()], active: 0, blockRects: [[-30, 18], [30, 78]] });
    e.clk(e.cell('more'));
    check('...a block starting above the top (-30..78) scrolls up by 30 (a negative delta)', e.scrolls.length === 1 && J(e.scrolls[0]) === J({ top: -30, behavior: 'smooth' }));
    e = build({ layers: [L()], active: 0, blockRects: [[100, 500], [510, 1000]] });
    e.clk(e.cell('more'));
    check('...a block TALLER than the viewport (100..1000 in 812) aligns its top edge to the viewport top with an 8px margin: scrollBy top 92', e.scrolls.length === 1 && J(e.scrolls[0]) === J({ top: 92, behavior: 'smooth' }));
    e = build({ layers: [L()], active: 0, reduced: true });
    e.clk(e.cell('more'));
    check('...with prefers-reduced-motion the behaviour is \'auto\' (no smooth scrolling); the fake matches only `prefers-reduced-motion: reduce`', e.scrolls.length === 1 && J(e.scrolls[0]) === J({ top: 196, behavior: 'auto' }));
    e = build({ layers: [L()], active: 0, allHidden: true });
    e.clk(e.cell('more'));
    check('...a block with no visible group (every group hidden for this layer) scrolls nothing and does not throw', e.scrolls.length === 0 && e.cell('more').getAttribute('aria-expanded') === 'true');
    e = build({ layers: [L()], active: 0 });
    e.rcell('more').focus(); e.clk(e.rcell('more'));
    check('the same from the RAIL\'s "...": one scroll, the focus stays on that button', e.scrolls.length === 1 && e.doc.activeElement === e.rcell('more'));
    e = build({ layers: [L()], active: 0 });
    e.scell('more').focus(); e.clk(e.scell('more'));
    check('the same from the STRIP\'s "...": one scroll, the focus stays on that button; a second open after a close scrolls again', e.scrolls.length === 1 && e.doc.activeElement === e.scell('more') && (e.clk(e.scell('more')), e.clk(e.scell('more')), e.scrolls.length === 2));
    // the reveal is one function that any collapsible block can use (commit 7: the timeline's "Mehr" group calls it, ui-timeline.js)
    e = build({ layers: [L()], active: 0 });
    const other = new El('div'); other.ownerDoc = e.doc; const kidA = new El('div'), kidB = new El('div'); [kidA, kidB].forEach(k => { k.ownerDoc = e.doc; k.getClientRects = () => [{}]; other.appendChild(k); });
    kidA.getBoundingClientRect = () => ({ top: 1000, bottom: 1040, left: 0, right: 10 }); kidB.getBoundingClientRect = () => ({ top: 1060, bottom: 1100, left: 0, right: 10 });
    check('layerTable.revealPanel(panel) is exported and reveals ANY element\'s visible children as one union (1000..1100 in 812: scrollBy top 288, smooth), the focus is untouched; a null panel does not throw', typeof e.ctx.layerTable.revealPanel === 'function' && (e.ctx.layerTable.revealPanel(other), e.scrolls.length === 1 && J(e.scrolls[0]) === J({ top: 288, behavior: 'smooth' })) && (() => { try { e.ctx.layerTable.revealPanel(null); return e.scrolls.length === 1; } catch (x) { return false; } })());
    e = build({});
    e.clk(e.cell('more')); e.clk(e.rcell('more')); e.clk(e.scell('more'));
    check('on the Base "..." is disabled: a click shows the reason and neither opens nor scrolls', e.scrolls.length === 0 && e.calls.length === 0);
    e = build({ layers: [L()], active: 0, noPanel: true });
    e.clk(e.cell('more'));
    check('a page without the block does not throw and scrolls nothing', e.scrolls.length === 0 && J(e.calls) === J([['toggleMore']]));
    // the cost of a tick
    e = build({ layers: [L({ connections: [[1, 2]] }), L()], active: 0 });
    let t0 = process.hrtime.bigint(); for (let i = 0; i < 20000; i++) e.sync(); const per = Number(process.hrtime.bigint() - t0) / 20000 / 1e6;
    check('a tick with nothing changed (2 layers) builds nothing and costs far below 0.1 ms (signature compare + the name line)', per < 0.1, per.toFixed(4) + ' ms');
    console.log('      (measured: ' + per.toFixed(4) + ' ms per unchanged tick)');
});

// the Base row of the table is outside the scrolling rows (commit 7): a block of its own, so that it runs even when an older check of the DOM block above has thrown
T('table base row', () => {
    const L = (extra) => Object.assign({ connections: [], enabled: true }, extra || {});
    let e;
    e = build({ layers: Array.from({ length: 12 }, () => L()), active: 'base' });
    const tk = e.table.children;
    check('table, structure (read without the helpers): the table is [the Base row, the scrolling layer rows, the foot, the name line]; the Base row holds ONLY chip:base and is a sibling of the scroller (.lt-rows), not inside it; the scroller holds the 12 layer rows and no chip:base', tk.length === 4 && /(^| )lt-base( |$)/.test(tk[0].className) && tk[0].children.length === 1 && tk[0].children[0].dataset.key === 'chip:base' && tk[1].className === 'lt-rows' && tk[1].children.length === 12 && !tk[1].children.some(r => r.children.some(b => b.dataset.key === 'chip:base')) && tk[2].className === 'lt-foot' && tk[3].className === 'lt-name');
    check('12 layers: the Tab order (the DOM order) is unchanged: the Base chip, then every layer row (chip, eye, diamond, x), then "+" and "..."', J(e.keys()) === J(['chip:base'].concat(...Array.from({ length: 12 }, (_, i) => ['chip:' + i, 'eye:' + i, 'dia:' + i, 'x:' + i]), ['add', 'more'])));
    const baseBtn = e.cell('chip:base'); baseBtn.focus(); e.layers.push(L()); e.sync();
    check('...the Base button is not rebuilt with the rows (the same element after a layer is added, and its focus stays); the scroller then holds 13 rows', e.cell('chip:base') === baseBtn && e.doc.activeElement === baseBtn && e.table.children[1].children.length === 13 && e.table.children[0].children.length === 1);
    e.clk(e.cell('chip:3'));
    check('...the Base chip is still patched in place: active while the Base is the active sheet, not active after a layer chip is selected (and active again after a click on it)', baseBtn.classList.contains('active') === false && e.cell('chip:3').classList.contains('active') && (e.clk(baseBtn), baseBtn.classList.contains('active') && !e.cell('chip:3').classList.contains('active')));
    e = build({});
    check('without layers the scroller is there but empty (the Base row and the foot only; the CSS takes the empty scroller out of the layout)', e.table.children.length === 4 && e.table.children[1].children.length === 0 && J(e.keys()) === J(['chip:base', 'add', 'more']));
});

// the table reveals the ACTIVE row inside its scroller (commit 8): with the shared helper revealActive (the rail's and the strip's), by scrolling the scroller only
T('table reveal', () => {
    const L = (extra) => Object.assign({ connections: [], enabled: true }, extra || {});
    // geometry: the scroller 100..500 (ten 36px rows, 4px apart), row i at 104 + 40 i - scrollTop
    let GEO = null;
    const origRect = El.prototype.getBoundingClientRect;
    El.prototype.getBoundingClientRect = function () {
        if (GEO && this === GEO.scroller) return { top: 100, bottom: 500, left: 0, right: 156 };
        if (GEO && this.dataset && /^chip:\d/.test(this.dataset.key || '') && this.parent && this.parent.parent === GEO.scroller) { const i = GEO.scroller.children.indexOf(this.parent), top = 104 + 40 * i - (GEO.scroller.scrollTop || 0); return { top, bottom: top + 36, left: 0, right: 36 }; }
        return origRect.call(this);
    };
    const geo = e => { GEO = { scroller: e.table.children[1] }; GEO.scroller.scrollTop = 0; return GEO.scroller; };
    const hook = (e, sc) => { e.ctx.layerApi.remove = i => { e.calls.push(['remove', i]); e.layers.splice(i, 1); if (e.ctx.activeLayer === i) e.ctx.activeLayer = 'base'; else if (typeof e.ctx.activeLayer === 'number' && e.ctx.activeLayer > i) e.ctx.activeLayer--; }; };
    try {
        let e = build({ layers: Array.from({ length: 14 }, () => L()), active: 'base' });
        let sc = geo(e); e.sync();
        check('14 layers, the Base active: nothing scrolls (the Base row is fixed outside the scroller, there is no row to reveal); no window scroll', !sc.scrolls && e.scrolls.length === 0);
        e.cell('add').focus(); e.clk(e.cell('add'));
        check('"+" with the list at the top: the new row (the 15th: 664..700 in a scroller ending at 500) is revealed: the SCROLLER scrolls once, { top: 200, behavior: \'smooth\' } (the overhang), the window does not, and the focus stays on "+"', sc.scrolls && sc.scrolls.length === 1 && J(sc.scrolls[0]) === J({ top: 200, behavior: 'smooth' }) && sc.scrollTop === 200 && e.scrolls.length === 0 && !e.doc.__scrollIntoView && e.doc.activeElement === e.cell('add') && e.cell('chip:14').classList.contains('active'));
        e.clk(e.cell('chip:2'));
        check('a chip click on a row scrolled above the top (row 3: -16..20, the scroller starts at 100) scrolls the scroller up by 116 ({ top: -116, smooth }), the window is untouched', sc.scrolls.length === 2 && J(sc.scrolls[1]) === J({ top: -116, behavior: 'smooth' }) && sc.scrollTop === 84 && e.scrolls.length === 0);
        e.cell('chip:5').focus(); e.cell('chip:5').dispatch('click', { detail: 0 }); e.sync();
        check('a KEYBOARD selection (a click with detail 0 on the focused chip) takes the same path; row 6 (204..240) is already inside: NO scroll', sc.scrolls.length === 2 && e.cell('chip:5').classList.contains('active') && e.doc.activeElement === e.cell('chip:5') && e.scrolls.length === 0);
        e.clk(e.cell('chip:5'));
        check('selecting the active row again scrolls nothing (the active key did not change)', sc.scrolls.length === 2);
        sc.scrollTop = 0; sc.scrolls.length = 0; e.clk(e.cell('chip:9'));
        check('a row ending exactly at the bottom edge (row 10: 464..500) is inside: no scroll; the next one (row 11: 504..540, cut by the edge) scrolls by the overhang { top: 40, smooth }', sc.scrolls.length === 0 && (e.clk(e.cell('chip:10')), sc.scrolls.length === 1 && J(sc.scrolls[0]) === J({ top: 40, behavior: 'smooth' })));
        // base first, then a layer in view: nothing; the Base row and the foot never scroll
        check('the Base row, the foot and the table itself are never scrolled: only the scroller has a scrollBy record', !e.table.scrolls && !e.table.children[0].scrolls && !e.table.children[2].scrolls && !e.table.children[0].scrollTop && !e.table.scrollTop);
        // remove: a layer above the active one goes; the active one shifts to a number the list has to bring into view
        e = build({ layers: Array.from({ length: 15 }, () => L()), active: 'base' }); sc = geo(e); hook(e, sc); e.sync();
        e.clk(e.cell('chip:13')); sc.scrollTop = 0; sc.scrolls.length = 0;
        e.clk(e.cell('x:0'));
        check('a REMOVE that shifts the active row (row 14 becomes row 13, 584..620 with the list at the top) reveals it: one scroll { top: 120, smooth }; a removed active row (the Base becomes active) would scroll nothing', sc.scrolls.length === 1 && J(sc.scrolls[0]) === J({ top: 120, behavior: 'smooth' }) && e.cell('chip:12').classList.contains('active') && e.scrolls.length === 0);
        // restore: the page is built with an active layer far down
        e = build({ layers: Array.from({ length: 14 }, () => L()), active: 'base' }); sc = geo(e); e.ctx.activeLayer = 11; e.sync();
        check('a RESTORE ends as a state change (the page built with the Base active, then layer 12 is the active sheet) with the list at the top: row 12 at 544..580 is revealed: { top: 80, smooth }', sc.scrolls && sc.scrolls.length === 1 && J(sc.scrolls[0]) === J({ top: 80, behavior: 'smooth' }) && e.scrolls.length === 0);
        // a table that was hidden when the active sheet changed is revealed when the window is resized (the table comes back from the rail's width)
        e = build({ layers: Array.from({ length: 14 }, () => L()), active: 'base' }); sc = geo(e); GEO = null;
        e.ctx.activeLayer = 13; e.sync();
        check('hidden table (no geometry): the active sheet changes to row 14 and nothing scrolls (all rects are zero-size); the geometry comes back (the table is shown) and a window resize reveals the row: { top: 160, smooth }', !sc.scrolls && (GEO = { scroller: sc }, (e.ctx.__wl.resize || []).forEach(f => f()), sc.scrolls && sc.scrolls.length === 1 && J(sc.scrolls[0]) === J({ top: 160, behavior: 'smooth' })));
        // reduced motion
        e = build({ layers: Array.from({ length: 14 }, () => L()), active: 'base', reduced: true }); sc = geo(e); e.cell('add').focus(); e.clk(e.cell('add'));
        check('with prefers-reduced-motion the table\'s reveal uses behavior \'auto\' (the one shared scrollBehavior())', sc.scrolls && sc.scrolls.length === 1 && J(sc.scrolls[0]) === J({ top: 200, behavior: 'auto' }));
        // the rail and the strip are unchanged: instant (scrollTop), not smooth
        e = build({ layers: Array.from({ length: 10 }, () => L()), active: 'base' });
        const col = e.railChips(); col.scrollTop = 0; col.getBoundingClientRect = () => ({ top: 100, bottom: 400, left: 0, right: 36 });
        e.rcell('chip:9').getBoundingClientRect = () => ({ top: 520 - col.scrollTop, bottom: 568 - col.scrollTop, left: 0, right: 36 });
        e.clk(e.rcell('chip:9'));
        check('the rail still scrolls instantly (scrollTop, no scrollBy: the smooth behaviour is the table\'s only)', col.scrollTop === 168 && !col.scrolls);
    } finally { GEO = null; El.prototype.getBoundingClientRect = origRect; }
});

// ================= 3. the source =================
console.log('\n== the markup, the CSS and the one block in sketch.js ==');
T('more state (layerApi.moreState)', () => {
    const L = (extra) => Object.assign({ connections: [], enabled: true }, extra || {});
    const views = e => [e.cell('more'), e.rcell('more'), e.scell('more')];
    let e = build({ layers: [L()], active: 0 }); e.sync();
    check('moreState { open: false, dot: false }: "..." is closed (aria-expanded false) and has no dot in the table, the rail and the strip', views(e).every(b => b.getAttribute('aria-expanded') === 'false' && !b.classList.contains('has-state')));
    e = build({ layers: [L()], active: 0, moreOpen: true }); e.sync();
    check('moreState { open: true, dot: false }: open (aria-expanded true) everywhere, no dot', views(e).every(b => b.getAttribute('aria-expanded') === 'true' && !b.classList.contains('has-state')));
    e = build({ layers: [L()], active: 0, moreDot: true }); e.sync();
    check('moreState { open: false, dot: true }: the dot (has-state) shows everywhere while closed', views(e).every(b => b.getAttribute('aria-expanded') === 'false' && b.classList.contains('has-state')));
    e = build({ layers: [L()], active: 0, moreOpen: true, moreDot: true }); e.sync();
    check('moreState { open: true, dot: true }: open with the dot', views(e).every(b => b.getAttribute('aria-expanded') === 'true' && b.classList.contains('has-state')));
    e.moreSt.open = false; e.moreSt.dot = false; e.sync();
    check('the views follow moreState on the next tick (no hidden old toggle is read): closed and no dot again', views(e).every(b => b.getAttribute('aria-expanded') === 'false' && !b.classList.contains('has-state')));
    e.calls.length = 0; e.clk(e.cell('more')); e.sync();
    check('a click on "..." still goes through layerApi.toggleMore() and the next tick shows it open in all three views', J(e.calls) === J([['toggleMore']]) && views(e).every(b => b.getAttribute('aria-expanded') === 'true'));
    // the first sync runs before sketch.js has set layerApi up
    let threw = null, n = null;
    try { n = build({ layers: [L()], active: 0, noApi: true }); n.sync(); } catch (err) { threw = err; }
    check('WITHOUT window.layerApi (the first sync runs before sketch.js sets it up) readState does not throw: the view is built, "..." closed and without a dot', !threw && !!n && views(n).every(b => b.getAttribute('aria-expanded') === 'false' && !b.classList.contains('has-state')), threw && threw.message);
    threw = null; n = null;
    try { n = build({ layers: [L()], active: 0, noMoreState: true }); n.sync(); } catch (err) { threw = err; }
    check('...and with a layerApi that has no moreState (an older sketch.js): the same fallback', !threw && !!n && views(n).every(b => b.getAttribute('aria-expanded') === 'false' && !b.classList.contains('has-state')), threw && threw.message);
    const code = LAYERS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    check('ui-layers.js reads the layer "Mehr" state from layerApi.moreState() only: no lookup of #btn-more-layer, no aria-expanded or has-state read from the DOM', /a && a\.moreState \? a\.moreState\(\) : null/.test(code) && !/btn-more-layer/.test(code) && !/getAttribute\('aria-expanded'\)\s*===/.test(code) && !/contains\('has-state'\)\s*\)?\s*;?\s*$/m.test(code.split('function readState')[1] ? code.split('function readState')[1].split('function sync')[0] : ''));
});
T('source', () => {
    const rowStart = HTML.indexOf('<div class="canvas-row">'), rowEnd = HTML.indexOf('<div class="main-container">');
    const canvasRow = rowStart >= 0 && rowEnd > rowStart ? HTML.slice(rowStart, rowEnd) : '';
    const tag = (canvasRow.match(/<div id="layer-table"[^>]*>/) || [''])[0];
    const railTag = (canvasRow.match(/<div id="layer-rail"[^>]*>/) || [''])[0];
    check('#layer-table and #layer-rail are the LAST TWO children of the canvas row (the table, then the rail), each role="group", aria-label "Ebenen", data-i18n, empty in the markup (ui-layers.js builds them)', /class="layer-table"/.test(tag) && /role="group"/.test(tag) && /aria-label="Ebenen"/.test(tag) && /data-i18n="layers\.table"/.test(tag) && /class="layer-rail"/.test(railTag) && /role="group"/.test(railTag) && /aria-label="Ebenen"/.test(railTag) && /data-i18n="layers\.rail"/.test(railTag) && /<div id="layer-table"[^>]*><\/div>[\s\S]*?<div id="layer-rail"[^>]*><\/div>\s*<\/div>\s*$/.test(canvasRow) && (canvasRow.match(/id="layer-table"/g) || []).length === 1 && (canvasRow.match(/id="layer-rail"/g) || []).length === 1);
    check('the old layer row is GONE from the markup: no #layer-row-group, #layer-row, #btn-layer-base, #layer-tabs, #btn-add-layer, #paste-pattern-status, #layer-more-row, #btn-more-layer; #layer-more-panel stays', !/id="(layer-row-group|layer-row|btn-layer-base|layer-tabs|btn-add-layer|paste-pattern-status|layer-more-row|btn-more-layer)"/.test(HTML) && HTML.includes('id="layer-more-panel"'));
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
    const OLDROW = /#layer-row, #layer-more-row\s*\{\s*display:\s*none;\s*\}/, OLDGROUP = /#layer-row-group:has\(> #paste-pattern-status:empty\)\s*\{\s*display:\s*none;\s*\}/;   // the rules of the old row: gone with it
    // the stylesheet with every @media block removed: what applies at EVERY width
    const noMedia = (() => { let t = css; for (;;) { const i = t.indexOf('@media'); if (i < 0) return t; let d = 0, j = t.indexOf('{', i), k = j; for (; k < t.length; k++) { if (t[k] === '{') d++; else if (t[k] === '}') { d--; if (!d) break; } } t = t.slice(0, i) + t.slice(k + 1); } })();
    check('the old row\'s hide rules are GONE from style.css (the row is gone from the markup): no `#layer-row, #layer-more-row { display: none }`, no `#layer-row-group:has(...)` rule, anywhere', !OLDROW.test(css) && !OLDGROUP.test(css) && !/#layer-row|#layer-more-row|#layer-tabs|paste-pattern-status/.test(css));
    check('the grid reserves the diamond column: the chip in column 1, the eye in 2, the x in 4 (commit 2 fills 3), "+" in 1, "..." in 2', ['lt-chip\\s*\\{[^}]*grid-column:\\s*1', 'lt-eye\\s*\\{[^}]*grid-column:\\s*2', 'lt-x\\s*\\{[^}]*grid-column:\\s*4', 'lt-add\\s*\\{[^}]*grid-column:\\s*1', 'lt-more\\s*\\{[^}]*grid-column:\\s*2'].every(r => new RegExp(r).test(css)) && /\.lt-row, \.layer-table \.lt-foot\s*\{[^}]*grid-template-columns:\s*repeat\(4, var\(--target\)\)/.test(css));
    // ---- the rail's CSS (commit 2) ----
    check('the rail shows only in ONE media query: from 768px (where the left tool rail turns vertical) to the table\'s threshold - a fine pointer 768 to 935px, a coarse pointer 768 to 1031px (the exact query)', ri > 0 && css.split(RQ).length === 2);
    check('the rail is hidden by default (.layer-rail { display: none }) outside the query; inside it is a flex column, positioned ABSOLUTELY at the right gutter (right: 24px, top: var(--gap): level with the canvas top like the left rail), exactly one button wide (width: var(--target)) and never taller than the canvas (max-height: var(--canvas-size))', /\.layer-rail\s*\{\s*display:\s*none;\s*\}/.test(outsideBoth) && /\.layer-rail\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*position:\s*absolute[^}]*top:\s*var\(--gap\)[^}]*right:\s*24px[^}]*width:\s*var\(--target\)[^}]*max-height:\s*var\(--canvas-size\)/.test(railInside));
    check('group 1 scrolls: .lr-chips has overflow-y: auto, min-height: 0 and room for the focus ring (4px padding, -4px margin); its scrollbar is hidden (the column is exactly one button wide)', /\.layer-rail \.lr-chips\s*\{[^}]*overflow-y:\s*auto[^}]*min-height:\s*0/.test(css) && /\.layer-rail \.lr-chips\s*\{[^}]*padding:\s*4px[^}]*margin:\s*-4px/.test(css) && /\.layer-rail \.lr-chips\s*\{[^}]*scrollbar-width:\s*none/.test(css) && /\.layer-rail \.lr-g1\s*\{[^}]*min-height:\s*0[^}]*flex:\s*0 1 auto/.test(css) && /\.layer-rail \.lr-g2\s*\{[^}]*flex:\s*none/.test(css));
    check('the rail has a hairline between the groups (.lr-g2::before, like the left rail\'s) and the disabled / dimmed styles of the table apply to it too', /\.layer-rail \.lr-g2::before\s*\{[^}]*height:\s*1px[^}]*background:\s*var\(--color-hairline\)/.test(css) && /\.layer-rail \.icon-btn\[aria-disabled="true"\]/.test(css) && /\.layer-rail \.lt-chip\.is-hidden:not\(\.active\)/.test(css));
    check('the rail is NOT restyled below 768px (the phone strip is commit 4): the rail query starts at min-width: 768px and the old row\'s own rules are not touched', !/@media[^{]*max-width:\s*767px[^{]*\{[^}]*layer-rail/.test(css) && RQ.startsWith('@media (min-width: 768px)') && /,\s*\(min-width: 768px\)/.test(RQ));
    // which view shows at which width: the media queries evaluated, the pointer types and every width
    const evalMQ = (q, w, ptr) => q.replace(/^@media\s*/, '').replace(/\s*\{$/, '').split(',').some(list => list.split(' and ').every(c => { const m = c.trim().match(/^\((min-width|max-width|pointer):\s*(\w+?)(px)?\)$/); if (!m) throw new Error('unknown condition ' + c); return m[1] === 'min-width' ? w >= +m[2] : m[1] === 'max-width' ? w <= +m[2] : ptr === m[2]; }));
    const SQ = '@media (max-width: 767px) {', sqi = css.indexOf(SQ);
    let sdepth = 0, send = sqi + SQ.length; for (; send < css.length; send++) { if (css[send] === '{') sdepth++; else if (css[send] === '}') { if (!sdepth) break; sdepth--; } }
    // the strip's rule is the one inside `@media (max-width: 767px)` that starts with `.layer-strip {` (other rules use that query too: the phone rail rows)
    const stripBlocks = []; { let at = 0; for (;;) { const k = css.indexOf(SQ, at); if (k < 0) break; let d = 0, e = k + SQ.length; for (; e < css.length; e++) { if (css[e] === '{') d++; else if (css[e] === '}') { if (!d) break; d--; } } stripBlocks.push(css.slice(k + SQ.length, e)); at = e; } }
    const stripInside = stripBlocks.filter(b => /\.layer-strip\s*\{/.test(b)).join('\n');
    const stripShows = (w, ptr) => stripInside !== '' && evalMQ(SQ, w, ptr);
    let overlap = 0, gaps = 0, fits = true; const widths = []; for (let w = 300; w <= 1600; w++) widths.push(w);
    const shown = (w, ptr) => [stripShows(w, ptr), evalMQ(RQ, w, ptr), evalMQ(MQ, w, ptr)].filter(Boolean).length;
    for (const ptr of ['fine', 'coarse']) for (const w of widths) {
        const t = evalMQ(MQ, w, ptr), r = evalMQ(RQ, w, ptr), n = shown(w, ptr);
        if (n > 1) overlap++;
        if (n === 0) gaps++;
        const target = ptr === 'fine' ? 36 : 48, free = (w - 560) / 2 - 24;   // the free width right of the canvas, the 24px gutter taken off
        if (r && free < target + 8) fits = false;
        if (t && free < 4 * target + 3 * 4 + 8) fits = false;
    }
    check('which view shows (the three queries evaluated for both pointer types at every width 300..1600): never two at once (' + overlap + ' overlaps) and always exactly one (' + gaps + ' widths with none)', overlap === 0 && gaps === 0);
    check('the arithmetic: wherever the rail shows, (W - 560) / 2 - 24 holds the button plus 8px (36 + 8 fine, 48 + 8 coarse); wherever the table shows, its 4 columns plus 8px (the canvas never moves, nothing overlaps it)', fits === true);
    check('the handovers are exact: a fine pointer 935px = rail, 936px = table; a coarse pointer 1031px = rail, 1032px = table; 767px = the strip, 768px = the rail, for BOTH pointer types', evalMQ(RQ, 935, 'fine') && !evalMQ(MQ, 935, 'fine') && evalMQ(MQ, 936, 'fine') && !evalMQ(RQ, 936, 'fine') && evalMQ(RQ, 1031, 'coarse') && !evalMQ(MQ, 1031, 'coarse') && evalMQ(MQ, 1032, 'coarse') && !evalMQ(RQ, 1032, 'coarse') && ['fine', 'coarse'].every(p => stripShows(767, p) && !evalMQ(RQ, 767, p) && !stripShows(768, p) && evalMQ(RQ, 768, p) && stripShows(320, p) && !stripShows(1600, p)));
    // ---- the strip's CSS and markup (commit 4) ----
    check('the strip is hidden by default (.layer-strip { display: none }) outside the query; inside `@media (max-width: 767px)` it is a flex column with an 8px gap (var(--gap)) taking a FULL LINE of the phone\'s wrapping row (flex: 0 0 100%), min-width: 0 and border-box - for both pointer types (the query has no pointer condition)', /\.layer-strip\s*\{\s*display:\s*none;\s*\}/.test(css.replace(stripInside, '')) && /\.layer-strip\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*gap:\s*var\(--gap\)[^}]*flex:\s*0 0 100%[^}]*min-width:\s*0[^}]*box-sizing:\s*border-box/.test(stripInside) && !/pointer/.test(SQ));
    check('the strip\'s rows: each group is a flex ROW with an 8px gap; the chips column scrolls SIDEWAYS (overflow-x: auto, min-width: 0, no scrollbar) with 4px padding and an equal negative margin for the focus ring; "+" and the Base chip are not in it', /\.layer-strip \.lr-group\s*\{[^}]*flex-direction:\s*row[^}]*gap:\s*var\(--gap\)/.test(css) && /\.layer-strip \.lr-chips\s*\{[^}]*flex-direction:\s*row[^}]*gap:\s*var\(--gap\)[^}]*padding:\s*4px[^}]*margin:\s*-4px[^}]*overflow-x:\s*auto[^}]*min-width:\s*0[^}]*scrollbar-width:\s*none/.test(css) && !/\.layer-strip \.lr-chips\s*\{[^}]*overflow-y/.test(css));
    check('the strip shares the table\'s and the rail\'s disabled and dimmed styles and the chip font', /\.layer-strip \.icon-btn\[aria-disabled="true"\]/.test(css) && /\.layer-strip \.lt-chip\.is-hidden:not\(\.active\)/.test(css) && /\.layer-strip \.lt-chip \{ font: inherit/.test(css));
    const sTag = (canvasRow.match(/<div id="layer-strip"[^>]*>/) || [''])[0];
    check('#layer-strip is a child of the canvas row placed DIRECTLY AFTER #canvas-container and BEFORE .rail-left (the DOM order, and the tab order, is the visual order: canvas, strip, the tool rail\'s rows), role="group", aria-label "Ebenen", data-i18n, empty in the markup; the table and the rail stay the last two children', /class="layer-strip"/.test(sTag) && /role="group"/.test(sTag) && /aria-label="Ebenen"/.test(sTag) && /data-i18n="layers\.strip"/.test(sTag) && /<div id="canvas-container"><\/div>[\s\S]{0,4200}<div id="layer-strip"[^>]*><\/div>\s*<div class="rail-left">/.test(canvasRow) && (canvasRow.match(/id="layer-strip"/g) || []).length === 1 && canvasRow.indexOf('id="layer-strip"') < canvasRow.indexOf('id="layer-table"') && canvasRow.indexOf('id="layer-strip"') < canvasRow.indexOf('class="rail-left"'));
    // ---- the table's chip column: room for the focus ring (commit 3) ----
    check('the table\'s layer rows (.lt-rows) are the ONLY scrolling part: 4px padding (the gap under the Base row, and the keyboard focus ring\'s room) and a -4px side and bottom margin (margin: 0 -4px -4px: the outer width and the height of the table stay), overflow-y: auto, min-height: 0; the Base row (.lt-base) is fixed (flex: none); with no layers the empty scroller takes no room (.lt-rows:empty { display: none })', /\.layer-table \.lt-rows\s*\{[^}]*padding:\s*4px[^}]*margin:\s*0 -4px -4px[^}]*overflow-y:\s*auto[^}]*min-height:\s*0/.test(css) && /\.layer-table \.lt-base\s*\{[^}]*flex:\s*none/.test(css) && /\.layer-table \.lt-rows:empty\s*\{[^}]*display:\s*none/.test(css));
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
    check('--accent is NOT changed (#ff3b30 light, #ff453a dark: the red Close buttons of Help and Export, 3.55:1 on white) and --danger is used nowhere but the destructive rule, the error notice\'s left border and the timeline sheet\'s trash icon (style.css, since 5a) and its two definitions', lt.accent === '#ff3b30' && dk.accent === '#ff453a' && (css.match(/var\(--danger\)/g) || []).length === 4 && /html\.ph \.ph-tl-trash\s*\{\s*color:\s*var\(--danger\);\s*\}/.test(css) && /\.notice-error\s*\{\s*border-left-color:\s*var\(--danger\);\s*\}/.test(css) && (inlineCss.match(/var\(--danger\)/g) || []).length === 0 && (inlineCss.match(/--danger:/g) || []).length === 2);
    check('both rules out-rank the generic rule by specificity (0,2,1 and 0,3,0 against 0,1,1), so it does not matter which stylesheet comes last', gt(spec('.dialog-content .restart-actions button'), spec('.dialog-content button')) && gt(spec('.dialog-content .restart-actions .dialog-danger'), spec('.dialog-content button')) && J(spec('.dialog-content .restart-actions button')) === J([0, 2, 1]) && J(spec('.dialog-content .restart-actions .dialog-danger')) === J([0, 3, 0]));
    check('the hover state sits inside @media (hover: hover) (no sticky hover on touch)', /@media \(hover: hover\)\s*\{\s*\.dialog-content \.restart-actions button:hover\s*\{\s*background:\s*var\(--hover-bg\);\s*\}\s*\}/.test(css));
    const dlg = id => (HTML.match(new RegExp('<div id="' + id + '"[\\s\\S]*?</div>\\s*</div>\\s*</div>')) || [''])[0];
    const btnTag = (m, id) => (m.match(new RegExp('<button id="' + id + '"[^>]*>')) || [''])[0];
    const rd = dlg('restart-overlay'), ld = dlg('layer-remove-overlay');
    check('both confirmations: the buttons are in .restart-actions, Cancel first without a class, the destructive confirm ("Neu anfangen", "Entfernen") has class="dialog-danger" - the two dialogs look identical', [[rd, 'cancel-restart', 'confirm-restart'], [ld, 'cancel-layer-remove', 'confirm-layer-remove']].every(([m, c, k]) => /class="restart-actions"/.test(m) && m.indexOf('id="' + c + '"') > 0 && m.indexOf('id="' + k + '"') > m.indexOf('id="' + c + '"') && !/class=/.test(btnTag(m, c)) && /class="dialog-danger"/.test(btnTag(m, k))) && (HTML.match(/class="dialog-danger"/g) || []).length === 3);
    // ui-layers.js
    check('ui-layers.js has no p5 binding (no mousePressed, no select()) and uses the shared helpers (UI.guard, UI.name, UI.setDisabled, UI.dialog, UI.onSync)', !/mousePressed|[^.\w]select\(/.test(LAYERS) && ['UI.guard(', 'UI.name(', 'UI.setDisabled(', 'UI.dialog(', 'UI.onSync('].every(s => LAYERS.includes(s)));
    check('ui-layers.js calls ONLY window.layerApi for actions (select, add, remove, setEnabled, toggleMore) and writes no sketch state itself (no assignment to activeLayer / additionalLayers / timeline, no .enabled write)', ['select', 'add', 'remove', 'setEnabled', 'toggleMore'].every(m => new RegExp('api\\(\\)\\.' + m + '\\(').test(LAYERS)) && !/(^|[;{}\n])\s*(activeLayer|additionalLayers|timeline)\s*=[^=]|\.enabled\s*=[^=]/.test(LAYERS));
    check('ui-layers.js (rail and strip, built by ONE function): the eye, "..." and x go through UI.guard (a click on a disabled one shows the reason, never acts); neither view has a name line listener (the name line is bound to the table only)', /UI\.guard\(v\.eye,/.test(LAYERS) && /UI\.guard\(v\.more,/.test(LAYERS) && /UI\.guard\(v\.x,/.test(LAYERS) && /table\.addEventListener\('pointerdown', touched, true\)/.test(LAYERS) && !/(rail|strip|container|v\.container)\.addEventListener\('(pointerdown|focusin|pointerover)'/.test(LAYERS) && /if \(rail\) buildNarrow\('rail', rail\);/.test(LAYERS) && /if \(strip\) buildNarrow\('strip', strip\);/.test(LAYERS));
    check('ui-layers.js (rail and strip): the actions are those of the ACTIVE sheet (model.actions.index) and the order is eye, DIAMOND, "...", x (the diamond is the 4th button now)', /lastModel \? lastModel\.actions\.index : null/.test(LAYERS) && /group2\.appendChild\(v\.eye\); group2\.appendChild\(v\.dia\); group2\.appendChild\(v\.more\); group2\.appendChild\(v\.x\);/.test(LAYERS) && /UI\.guard\(v\.dia,/.test(LAYERS));
    check('ui-layers.js: the reveal is ONE function, revealPanel(panel), called by moreNow() - the single handler of every "..." (table, rail, strip) - only when the model says the block is open (and exported as layerTable.revealPanel for the timeline\'s "Mehr"), scrolls the PAGE with window.scrollBy({ top: delta, behavior }) (smooth unless prefers-reduced-motion), measures the UNION of the visible groups (not [hidden], with client rects), has NO scrollIntoView left and never focuses anything', /function moreNow\(\) \{ if \(api\(\)\) api\(\)\.toggleMore\(\); sync\(\); if \(lastModel && lastModel\.more\.open\) revealPanel\(document\.getElementById\('layer-more-panel'\)\); \}/.test(LAYERS) && /root\.layerTable\.revealPanel = revealPanel;/.test(LAYERS) && /window\.scrollBy\(\{ top: delta, behavior: scrollBehavior\(\) \}\)/.test(LAYERS) && /return reduced \? 'auto' : 'smooth';/.test(LAYERS) && /\(prefers-reduced-motion: reduce\)/.test(LAYERS) && (LAYERS.match(/revealPanel\(/g) || []).length === 2 && (LAYERS.match(/window\.scrollBy\(/g) || []).length === 1 && (LAYERS.match(/panelRevealDelta\(/g) || []).length === 2 && !/scrollIntoView/.test(LAYERS.replace(/\/\/[^\n]*/g, '')) && /if \(c\.hidden \|\| !c\.getClientRects \|\| !c\.getClientRects\(\)\.length\) continue;/.test(LAYERS) && /if \(r\.top < top\) top = r\.top;/.test(LAYERS) && /if \(r\.bottom > bottom\) bottom = r\.bottom;/.test(LAYERS) && /const PANEL_MARGIN = 8;/.test(LAYERS) && !/\.focus\(\)[^\n]*scrollBy|scrollBy[^\n]*\.focus\(\)/.test(LAYERS));
    const layersCode = LAYERS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    check('ui-layers.js: the table reuses the shared row reveal, no second copy: ONE function revealActive (the rail and the strip call it from renderNarrow, the table with its own view record { smooth: true } from render() and the resize handler), ONE revealDelta, ONE scrollBehavior (the only matchMedia call: the page reveal and the table share it), one scrollTop += and one scrollLeft += (inside revealActive), scrollBy only in revealPanel (the window) and in revealActive (the scroller), no scrollIntoView', (layersCode.match(/function revealActive\(/g) || []).length === 1 && (layersCode.match(/function revealDelta\(/g) || []).length === 1 && (layersCode.match(/function scrollBehavior\(/g) || []).length === 1 && (layersCode.match(/matchMedia\(/g) || []).length === 1 && /const tableView = \{ name: 'table', chips: rowsEl, horizontal: false, lastActive: null, smooth: true \};/.test(layersCode) && (layersCode.match(/revealActive\(tableView\)/g) || []).length === 2 && (layersCode.match(/revealActive\(v\)/g) || []).length === 2 /* the definition and the call in renderNarrow */ && (layersCode.match(/\.scrollTop\s*\+?=/g) || []).length === 1 && (layersCode.match(/\.scrollLeft\s*\+?=/g) || []).length === 1 && (layersCode.match(/\bscrollBy\(/g) || []).length === 2 && /col\.scrollBy\(\{ top: d, behavior: scrollBehavior\(\) \}\)/.test(layersCode) && !/scrollIntoView/.test(layersCode) && /if \(rebuilt \|\| rowKey !== tableView\.lastActive\) \{ tableView\.lastActive = rowKey; revealActive\(tableView\); \}/.test(layersCode));
    // the block in sketch.js
    const bi = SKETCH.indexOf('    // layerApi: begin'), ei = SKETCH.indexOf('    // layerApi: end\n');
    const block = bi >= 0 && ei > bi ? SKETCH.slice(bi, ei) : '';
    check('sketch.js: exactly ONE layerApi block (between its two marker comments), one `window.layerApi = {`, and it publishes exactly select, add, remove, setEnabled, toggleMore (commits 1-5), addToTimeline, removeKeyframe, play, setProgress, clearTimeline, includeNet, toggleIncludeNet (commit 6) and moreState (the cleanup)', (SKETCH.match(/window\.layerApi\s*=/g) || []).length === 1 && J([...block.matchAll(/^        (\w+)\(/gm)].map(m => m[1])) === J(['select', 'add', 'remove', 'setEnabled', 'toggleMore', 'addToTimeline', 'removeKeyframe', 'play', 'setProgress', 'clearTimeline', 'includeNet', 'toggleIncludeNet', 'moreState']));
    const body = n => ((block.match(new RegExp('        ' + n + '\\([^)]*\\) \\{ ([^\\n]*) \\},')) || [, ''])[1]);
    check('...each is the sequence the old handlers run: select and add end with the five calls (renderLayerTabs, updateOffsetControls, updateFaceToggleControl, updateTimelineControls, redraw); remove has the tab remove handler\'s four; toggleMore is the old toggle',
        body('select') === 'activeLayer = sheet; renderLayerTabs(); updateOffsetControls(); updateFaceToggleControl(); updateTimelineControls(); redraw();' && body('add') === 'addLayer(); renderLayerTabs(); updateOffsetControls(); updateFaceToggleControl(); updateTimelineControls(); redraw();' && body('remove') === 'removeLayer(index); renderLayerTabs(); updateOffsetControls(); updateFaceToggleControl(); redraw();' && body('toggleMore') === 'layerMoreOpen = !layerMoreOpen; syncLayerMore();', J([body('select'), body('add')]));
    check('...setEnabled is a property write, the old row\'s checkbox refresh (renderLayerTabs) and a redraw: nothing else', body('setEnabled') === 'additionalLayers[index].enabled = !!on; renderLayerTabs(); redraw();');
    check('...the timeline additions (commit 6) are the old handlers\' own calls or plain getters: addToTimeline = addLayerToTimeline(); removeKeyframe = removeKeyframeFromTimeline(index); play = toggleTimelinePlayback() and a redraw; setProgress = setTimelineProgress(t) and a redraw (the old Play button and progress input also refreshed their own icon and value: gone with them); clearTimeline = removeTimelineAction(); includeNet returns the override; toggleIncludeNet runs the two statements the old handler runs (no hidden button needed); moreState hands out the layer "Mehr" state', body('addToTimeline') === 'addLayerToTimeline();' && body('removeKeyframe') === 'removeKeyframeFromTimeline(index);' && body('play') === 'toggleTimelinePlayback(); redraw();' && body('setProgress') === 'setTimelineProgress(t); redraw();' && body('clearTimeline') === 'removeTimelineAction();' && body('includeNet') === 'return includeNetOverride;' && body('toggleIncludeNet') === 'includeNetOverride = timelineIncludeNetToggle(includeNetOverride); window.syncTimelineNetUi();' && body('moreState') === 'return { open: layerMoreOpen, dot: layerMoreDot() };');
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
