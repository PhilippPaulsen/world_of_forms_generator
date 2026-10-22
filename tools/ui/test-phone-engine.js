// Guard for the phone layout ENGINE (phone layout, commit 1a): the REAL ui-phone.js and the REAL ui-phone-config.js in a vm-free Node run with a small fake DOM that models what matters here - nodes that move
// (appendChild / insertBefore take a node out of its old parent), comment nodes, hidden subtrees, a tab order and a focus. No browser.
//   node tools/ui/test-phone-engine.js
//   UI_PHONE_JS=... PHONE_CONFIG_JS=... node tools/ui/test-phone-engine.js        (sabotage runs)
//
// What it pins. apply(tab) re-parents the controls the config lists into the containers it makes - the SAME node objects (no clone: identity, one element per id, the same handlers, firing once however often the
// layout went on and off), apply and release are idempotent, release() puts every node back between the same neighbours and leaves no marker and no container behind (the whole tree compares equal to the tree
// before), a sub-tab is shown by MOVING its pane into the slot and parking the others in a hidden container (so a parked control is neither in the tab order nor reachable), the sub-tab is remembered per tab, a tab
// that is not covered (and any width from 768px) releases, the tabchange event and the media query drive it, a missing id is tolerated and reported, the focus survives a move.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const { createPhone } = require(process.env.UI_PHONE_JS || path.join(ROOT, 'ui-phone.js'));
const { config } = require(process.env.PHONE_CONFIG_JS || path.join(ROOT, 'ui-phone-config.js'));

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 400)); } };

// ---- a small fake DOM -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
class Node_ {
    constructor(doc, type, tag) { this.doc = doc; this.nodeType = type; this.tagName = tag ? tag.toUpperCase() : ''; this.childNodes = []; this.parentNode = null; this.attrs = {}; this.handlers = {}; this.hidden = false; this.text = ''; this.clicks = 0; this.dataset = {}; }
    get children() { return this.childNodes.filter(n => n.nodeType === 1); }
    get id() { return this.attrs.id || ''; }
    get className() { return this.attrs.class || ''; } set className(v) { this.attrs.class = String(v); }
    get classList() { const n = this; const list = () => (n.attrs.class || '').split(/\s+/).filter(Boolean); return { add: c => { if (!list().includes(c)) n.attrs.class = list().concat(c).join(' '); }, remove: c => { n.attrs.class = list().filter(x => x !== c).join(' '); }, contains: c => list().includes(c) }; }
    get style() { const n = this; if (!n._st) { n._style = n._style || {}; n._st = { setProperty: (k, v) => { n._style[k] = String(v); }, removeProperty: k => { delete n._style[k]; }, getPropertyValue: k => n._style[k] || '' }; } return n._st; }   // one object: a property written to it (background) stays
    get firstChild() { return this.childNodes[0] || null; }
    get offsetParent() { return this.doc.reachable(this) ? this.parentNode : null; }   // null when it has no box (a hidden ancestor), like the DOM
    get isConnected() { let e = this; while (e.parentNode) e = e.parentNode; return e === this.doc.documentElement || e === this.doc; }
    get nextSibling() { const p = this.parentNode; if (!p) return null; const i = p.childNodes.indexOf(this); return p.childNodes[i + 1] || null; }
    get previousSibling() { const p = this.parentNode; if (!p) return null; const i = p.childNodes.indexOf(this); return i > 0 ? p.childNodes[i - 1] : null; }
    get textContent() { return this.text; } set textContent(v) { this.text = String(v); }
    setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } removeAttribute(k) { delete this.attrs[k]; } hasAttribute(k) { return k in this.attrs; }
    addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
    dispatch(t, ev) { (this.handlers[t] || []).slice().forEach(h => h(Object.assign({ type: t, target: this, preventDefault() { }, stopPropagation() { } }, ev || {}))); }
    contains(n) { for (let e = n; e; e = e.parentNode) if (e === this) return true; return false; }
    cloneNode(deep) { const c = new Node_(this.doc, this.nodeType, this.tagName); c.attrs = Object.assign({}, this.attrs); c.text = this.text; c.hidden = this.hidden; if (deep) this.childNodes.forEach(k => c.appendChild(k.cloneNode(true))); return c; }   // a clone has the attributes (so the same id) and NO listeners, as in the DOM
    _detach() { this.doc.mutations++; const p = this.parentNode; if (p) { p.childNodes.splice(p.childNodes.indexOf(this), 1); this.parentNode = null; if (this.doc.activeElement && this.contains(this.doc.activeElement)) this.doc.activeElement = this.doc.body; } }
    appendChild(n) { n._detach(); n.parentNode = this; this.childNodes.push(n); return n; }
    insertBefore(n, ref) { if (!ref) return this.appendChild(n); if (n === ref) return n; n._detach(); const i = this.childNodes.indexOf(ref); if (i < 0) throw new Error('insertBefore: the reference node is not a child'); n.parentNode = this; this.childNodes.splice(i, 0, n); return n; }
    removeChild(n) { if (n.parentNode !== this) throw new Error('removeChild: not a child'); n._detach(); return n; }
    focus() { if (!this.doc.reachable(this)) return; this.doc.activeElement = this; }
    click() { this.dispatch('click'); }
    closest(sel) { for (let e = this; e && e.nodeType === 1; e = e.parentNode) if (e.matches(sel)) return e; return null; }
    matches(sel) { return sel.split(',').map(x => x.trim()).some(p => { let m; if ((m = /^([a-z]+):not\(\[disabled\]\)$/.exec(p))) return this.tagName === m[1].toUpperCase() && !this.hasAttribute('disabled'); if ((m = /^\[([a-z-]+)="([^"]*)"\]$/.exec(p))) return this.getAttribute(m[1]) === m[2]; if ((m = /^([a-z]+)\[([a-z-]+)\]$/.exec(p))) return this.tagName === m[1].toUpperCase() && this.hasAttribute(m[2]); if ((m = /^\.([\w-]+)$/.exec(p))) return this.classList.contains(m[1]); if ((m = /^#([\w-]+)$/.exec(p))) return this.id === m[1]; return /^[a-z]+$/.test(p) && this.tagName === p.toUpperCase(); }); }
    get tabIndex() { if (this._tabIndex !== undefined) return this._tabIndex; return /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(this.tagName) || (this.tagName === 'A' && this.hasAttribute('href')) ? 0 : (this.hasAttribute('tabindex') ? Number(this.getAttribute('tabindex')) : -1); } set tabIndex(v) { this._tabIndex = v; }
    querySelector(sel) { return this.doc.find(this, sel); }
    // the selectors the code under test asks: a list of  tag | tag:not([disabled]) | [attr="v"] | .class | #id
    querySelectorAll(sel) { const parts = sel.split(',').map(x => x.trim()); return this.doc.all(this).filter(n => parts.some(p => { let m; if ((m = /^([a-z]+):not\(\[disabled\]\)$/.exec(p))) return n.tagName === m[1].toUpperCase() && !n.hasAttribute('disabled'); if ((m = /^\[([a-z-]+)="([^"]*)"\]$/.exec(p))) return n.getAttribute(m[1]) === m[2]; if ((m = /^([a-z]+)\[([a-z-]+)\]$/.exec(p))) return n.tagName === m[1].toUpperCase() && n.hasAttribute(m[2]); if ((m = /^\.([\w-]+)$/.exec(p))) return n.classList.contains(m[1]); if ((m = /^#([\w-]+)$/.exec(p))) return n.id === m[1]; return /^[a-z]+$/.test(p) && n.tagName === p.toUpperCase(); })); }
}
function makeDoc() {
    const doc = { readyState: 'interactive', handlers: {}, mutations: 0 };   // mutations: every detach / attach of a node, to see that an idempotent call does no work
    doc.createElement = tag => new Node_(doc, 1, tag);
    doc.createComment = text => { const n = new Node_(doc, 8, ''); n.text = text; return n; };
    doc.documentElement = doc.createElement('html'); doc.body = doc.createElement('body'); doc.documentElement.appendChild(doc.body);
    doc.activeElement = doc.body;
    doc.all = (root, out) => { out = out || []; (root || doc.documentElement).childNodes.forEach(n => { if (n.nodeType === 1) { out.push(n); doc.all(n, out); } }); return out; };
    doc.getElementById = id => doc.all().find(n => n.id === id) || null;
    doc.find = (root, sel) => { const t = /^[a-z]+$/.exec(sel); if (t) return doc.all(root).find(n => n.tagName === sel.toUpperCase()) || null; const m = /^([.#])([\w-]+)$/.exec(sel); if (!m) throw new Error('fake DOM: selector ' + sel); return doc.all(root).find(n => m[1] === '#' ? n.id === m[2] : n.classList.contains(m[2])) || null; };
    doc.querySelector = sel => doc.find(doc.documentElement, sel);
    doc.addEventListener = (t, fn) => { (doc.handlers[t] = doc.handlers[t] || []).push(fn); };
    doc.dispatch = (t, ev) => (doc.handlers[t] || []).slice().forEach(h => h(Object.assign({ type: t }, ev || {})));
    // reachable = connected and no hidden ancestor (display: none) - what the browser needs to focus it; the tab order is the reachable focusables in document order
    doc.reachable = n => { for (let e = n; e; e = e.parentNode) { if (e.hidden) return false; if (e === doc.documentElement) return true; } return false; };
    doc.tabOrder = () => doc.all().filter(n => /^(BUTTON|A|INPUT|SELECT)$/.test(n.tagName) && doc.reachable(n) && !n.hasAttribute('disabled'));
    return doc;
}
// the page: the pieces of index.html the Form layout touches, in their real nesting and order (ids and classes as in index.html)
function buildPage(opts) {
    opts = opts || {};
    const doc = makeDoc(), win = { innerHeight: 812, handlers: {}, addEventListener(t, fn) { (win.handlers[t] = win.handlers[t] || []).push(fn); }, dispatch(t) { (win.handlers[t] || []).slice().forEach(h => h({ type: t })); } };
    const el = (tag, attrs, kids, handler) => { const n = doc.createElement(tag); Object.keys(attrs || {}).forEach(k => n.setAttribute(k, attrs[k])); (kids || []).forEach(k => n.appendChild(k)); if (handler) n.addEventListener('click', () => { n.clicks++; }); return n; };
    const btn = (id, cls) => el('button', id ? { id, class: cls || 'icon-btn', type: 'button' } : { class: cls || 'icon-btn', type: 'button' }, [], true);
    const body = doc.body;
    body.appendChild(el('header', { class: 'app-header' }, [el('nav', { class: 'app-tabs' }, [el('a', { id: 'tab-form', href: '#form' }), el('a', { id: 'tab-farbe', href: '#farbe' }), el('a', { id: 'tab-netz', href: '#netz' })]), btn('btn-help')]));
    body.appendChild(el('div', { class: 'nav-rows' }, [
        el('div', { id: 'nav-form', class: 'nav-row nav-form' }, [
            el('div', { id: 'nav-shapes', class: 'nav-cluster nav-shapes' }, ['triangle', 'square', 'hex'].map(s => { const b = btn(null, 'shape-icon-btn icon-btn'); b.setAttribute('data-shape', s); return b; })),
            el('span', { class: 'nav-divider' }),
            el('div', { id: 'nav-node-stepper', class: 'stepper' }, [el('input', { id: 'node-count-input', type: 'number' }), btn(null, 'stepper-btn'), btn(null, 'stepper-btn')]),
            el('div', { id: 'nav-size-stepper', class: 'stepper' }, [el('input', { id: 'shape-size-input', type: 'number' }), btn(null, 'stepper-btn'), btn(null, 'stepper-btn')]),
            el('span', { class: 'nav-divider' }),
            el('div', { id: 'nav-symmetry', class: 'nav-cluster nav-symmetry' }, [btn('btn-sym-rotation'), btn('btn-sym-rotation-mirror')]),
            btn('btn-more-form', 'icon-btn nav-more'), el('span', { class: 'nav-break' })]),
        el('div', { id: 'nav-farbe', class: 'nav-row nav-farbe' }, [
            el('div', { id: 'nav-anchor-views', class: 'nav-cluster nav-anchor-views' }, [btn('btn-open-kreis'), btn('btn-open-dreieck')]),
            el('span', { class: 'nav-divider nav-divider-a' }),
            el('div', { id: 'farbe-family-circle', class: 'nav-cluster nav-harmony-family' }, [btn('btn-harmony-2'), btn('btn-harmony-3'), btn('btn-harmony-4')]),
            el('div', { id: 'farbe-family-triangle', class: 'nav-cluster nav-harmony-family' }, ['b', 'w', 's', 'v'].map(k => btn('btn-harmony-' + k))),
            el('span', { class: 'nav-divider nav-divider-b' }),
            el('div', { id: 'farbe-anchor-hue-stepper', class: 'stepper' }, [el('input', { id: 'farbe-anchor-hue-input', type: 'number' }), btn(null, 'stepper-btn'), btn(null, 'stepper-btn')]),
            el('div', { id: 'farbe-anchor-register-stepper', class: 'stepper' }, [el('span', { id: 'farbe-anchor-register-display', class: 'stepper-display' }), btn(null, 'stepper-btn'), btn(null, 'stepper-btn')]),
            el('span', { id: 'farbe-anchor-preview', class: 'fc-swatch' }),
            el('select', { id: 'face-colors-rule' })]),
        el('div', { id: 'nav-netz', class: 'nav-row nav-netz' }, [
            el('div', { id: 'nav-kinds', class: 'nav-cluster nav-kinds', role: 'radiogroup' }, ['regular', 'sinus', 'tangens', 'geometric'].map(k => { const b = btn(null, 'icon-btn net-kind-btn'); b.setAttribute('data-kind', k); b.setAttribute('role', 'radio'); return b; })),
            el('span', { class: 'nav-divider nav-divider-a' }),
            el('div', { id: 'net-strength-stepper', class: 'stepper' }, [el('span', { id: 'net-strength-value', class: 'stepper-display' }), btn(null, 'stepper-btn'), btn(null, 'stepper-btn')]),
            btn('btn-more-netz', 'icon-btn nav-more')])]));
    body.appendChild(el('div', { class: 'canvas-row' }, [
        el('div', { id: 'canvas-container' }),
        el('div', { id: 'timeline-strip', class: 'timeline-strip' }, [btn('ts-play', 'icon-btn ts-btn'), el('input', { id: 'ts-range', type: 'range' }), btn('ts-net', 'icon-btn ts-btn'), btn('ts-more', 'icon-btn ts-btn ts-more')]),
        el('div', { id: 'layer-strip', class: 'layer-strip' }, [btn('ls-base', 'lt-cell'), btn('ls-add', 'lt-cell'), btn('ls-eye', 'lt-cell'), btn('ls-more', 'lt-cell lt-more')]),
        el('div', { class: 'rail-left' }, [
            el('div', { class: 'rail-top' }, [el('div', { id: 'rail-group-a', class: 'rail-group' }, [btn('btn-undo'), btn('btn-redo'), btn('btn-random')]),
                el('div', { class: 'rail-bm' }, [el('div', { id: 'rail-group-b', class: 'rail-group' }, [btn('btn-toggle-nodes'), btn('btn-toggle-faces')]), el('div', { id: 'rail-group-more', class: 'rail-group' }, [btn('btn-more-rail', 'icon-btn nav-more')])])]),
            el('div', { class: 'rail-bottom' }, [el('div', { id: 'rail-group-c', class: 'rail-group' }, [el('a', { id: 'btn-gallery', class: 'icon-btn', href: 'gallery.html' }, [], true), el('a', { id: 'btn-farborgel', class: 'icon-btn rail-farbe-only', href: 'color-harmony/ui/index.html' }, [], true), btn('btn-paste-pattern', 'icon-btn rail-form-only')]),
                el('div', { id: 'rail-group-d', class: 'rail-group' }, [btn('btn-info'), btn('btn-save')]), el('div', { id: 'rail-group-e', class: 'rail-group' }, [btn('btn-clear')]),
                el('div', { id: 'farbe-strategy-group', class: 'rail-group rail-farbe-only', role: 'radiogroup' }, ['cyclic', 'area', 'symmetry', 'rings'].map(k => btn('btn-strategy-' + k))),
                el('div', { id: 'rail-group-reset', class: 'rail-group rail-farbe-only' }, [btn('btn-face-colors-reset')])])])]));
    // the leftover containers: the layer "Mehr" wrapper (hidden unless its state is open), the timeline group (a class ts-open when open) and the contextual groups sketch.js shows for Curve / Free
    const layerPanel = el('div', { id: 'layer-more-panel' }, [btn('layer-align', 'layer-btn'), el('input', { id: 'layer-offset-x-input', type: 'number' })]); layerPanel.hidden = true;
    const tlGroup = el('div', { id: 'timeline-group', class: 'control-group' }, [btn('btn-clear-timeline', 'layer-btn'), el('input', { id: 'timeline-pairing-filter', type: 'number' })]);
    const settings = ['curve-fold-group', 'curve-strength-group', 'free-roughness-group', 'free-controls-group'].map(id => { const g = el('div', { id, class: 'control-group' }, [el('input', { type: 'range' })]); g.hidden = true; return g; });
    const faceList = el('div', { id: 'face-colors-list' }), faceGroup = el('div', { id: 'face-colors-group', class: 'control-group' }, [faceList]); faceGroup.hidden = true;
    body.appendChild(el('div', { class: 'main-container' }, [el('div', { class: 'controls-container' }, [btn('btn-leftover', 'layer-btn')].concat(settings, [tlGroup, layerPanel, faceGroup]))]));
    // the Netz sheet (#more-netz): the net group sketch.js shows for the square on the base. The axes row, the Fokus stepper (inside #net-focus-row, which sketch.js shows for Sin and Tan), Net lines and Reverse
    // (inside #net-geo-row) are the pieces the phone layout moves out; the exact field stays
    const focusRow = el('div', { id: 'net-focus-row' }, [el('h3', {}, []), el('div', {}, [el('div', { id: 'net-focus-stepper', class: 'stepper' }, [el('span', { id: 'net-focus-value', class: 'stepper-display' }), btn(null, 'stepper-btn'), btn(null, 'stepper-btn')]), el('input', { id: 'net-focus-exact', type: 'number' })])]); focusRow.hidden = true;
    const geoRow = el('div', { id: 'net-geo-row', class: 'icon-row' }, [btn('net-reverse-btn', 'layer-btn'), btn('net-alternate-btn', 'layer-btn')]); geoRow.hidden = true;
    const axes = el('div', { id: 'net-axes-row', class: 'icon-row' }, ['both', 'x', 'y'].map(k => { const b = btn(null, 'layer-btn net-axes-btn'); b.setAttribute('data-axes', k); return b; }));
    const netGroup = el('div', { id: 'net-group', class: 'control-group' }, [axes, focusRow, el('div', { class: 'icon-row' }, [btn('net-lines-btn', 'layer-btn')]), geoRow]);
    const moreNetz = el('div', { id: 'more-netz', class: 'overlay overlay-wide' }, [el('input', { id: 'net-strength-exact', type: 'number' }), netGroup]); moreNetz.hidden = true; body.appendChild(moreNetz);
    const scrim = el('div', { id: 'overlay-scrim', class: 'overlay-scrim' }); scrim.hidden = true; body.appendChild(scrim);
    // what ui-layers.js and ui-timeline.js do on the "..." click (the existing handlers, bound BEFORE the engine starts, as on the page): flip the block's own state
    const layerModel = { open: false };
    doc.getElementById('ls-more').addEventListener('click', () => { layerModel.open = !layerModel.open; layerPanel.hidden = !layerModel.open; });
    doc.getElementById('ts-more').addEventListener('click', () => { if (tlGroup.classList.contains('ts-open')) tlGroup.classList.remove('ts-open'); else tlGroup.classList.add('ts-open'); });
    const more = el('div', { id: 'more-rail', class: 'overlay' }, [el('div', { class: 'more-row' }, [btn('btn-toggle-curve'), btn('btn-restart')]), el('p', { id: 'more-name' })]); more.hidden = true;
    body.appendChild(more);
    if (opts.without) opts.without.forEach(id => { const n = doc.getElementById(id); n._detach(); });
    doc.documentElement.setAttribute('data-tab', 'form');
    const mq = { matches: true, handlers: [], addEventListener(t, fn) { if (t === 'change') mq.handlers.push(fn); }, set(v) { mq.matches = v; mq.handlers.slice().forEach(h => h({ matches: v })); } };
    win.matchMedia = q => { if (q !== config.query) throw new Error('unexpected media query ' + q); return mq; };
    const calls = { reveal: 0 }; win.layerTable = { revealActive() { calls.reveal++; } };
    // opts.ui: the REAL ui.js (UI.overlay, UI.onSync) in this window; without it the engine finds no UI.overlay and leaves the sheet blocks where they are
    if (opts.ui) {
        vm.createContext(win);
        Object.assign(win, { window: win, document: doc, console, MutationObserver: class { constructor(cb) { (win.observers = win.observers || []).push(cb); } observe() { } }, performance: { now: () => 0 }, setTimeout, clearTimeout });
        vm.runInContext(fs.readFileSync(process.env.UI_JS || path.join(ROOT, 'ui.js'), 'utf8'), win, { filename: 'ui.js' });
    }
    return { doc, win, mq, calls, scrim, layerModel, layerPanel, tlGroup, faceList, faceGroup, focusRow, geoRow, moreNetz };
}
const ph = (page, cfg) => createPhone(page.doc, page.win, cfg || config);
// a structure string of the whole tree (tag, id, class, kids; comments by text): equal before apply and after release
const dump = n => n.nodeType === 8 ? '<!--' + n.text + '-->' : '<' + n.tagName + (n.id ? '#' + n.id : '') + (n.className ? '.' + n.className.split(/\s+/).join('.') : '') + (n.hidden ? '[hidden]' : '') + '>' + n.childNodes.map(dump).join('') + '</>';
const formIds = () => { const t = config.tabs.form, tr = config.toolRows[t.toolRow], out = [].concat.apply([], tr.groups).concat(tr.end, tr.sheet ? tr.sheet.items : []); t.subtabs.forEach(s => config.subtabs[s].rows.forEach(r => r.items.forEach(i => out.push(i.id)))); return out; };
const ids = formIds();
const original = page => { const o = {}; ids.forEach(id => { o[id] = page.doc.getElementById(id); }); return o; };

console.log('== apply ==');
T('apply', () => {
    const p = buildPage(), orig = original(p), before = dump(p.doc.documentElement), eng = ph(p);
    check('the page has every listed control once before (' + ids.length + ' ids)', ids.every(id => orig[id]));
    eng.start();
    check('start() on a phone with the Form tab (html[data-tab]) applies: html gets the class ph and --panel-h', p.doc.documentElement.classList.contains('ph') && p.doc.documentElement.style.getPropertyValue('--panel-h') === '104px' && eng.state().applied === 'form');
    check('--ph-inner-h is window.innerHeight (the fallback of a browser without svh)', p.doc.documentElement.style.getPropertyValue('--ph-inner-h') === '812px');
    const stack = p.doc.getElementById('ph-stack'), toolRow = p.doc.getElementById('ph-toolrow'), subtabs = p.doc.getElementById('ph-subtabs'), slot = p.doc.getElementById('ph-slot'), park = p.doc.getElementById('ph-park');
    check('the containers are inserted right after .canvas-row: tool row, sub-tab row, slot, parking (in that order), before .main-container', stack && p.doc.querySelector('.canvas-row').nextSibling === stack && stack.nextSibling === p.doc.querySelector('.main-container') && stack.children.map(c => c.id).join() === 'ph-toolrow,ph-subtabs,ph-slot,ph-park');
    const toolIds = n => n.children.map(c => c.id || c.className.split(' ')[0]);
    const tools = toolRow.children[0];
    check('the tool row: [ Undo Redo Random | Nodes Fill ] scrolling part, a separator, then More (fixed at the end)', tools.className === 'ph-tools' && tools.children.map(g => g.className.split(' ')[0]).join() === 'ph-toolgroup,ph-sep,ph-toolgroup' && tools.children[0].children.map(c => c.id).join() === 'btn-undo,btn-redo,btn-random' && tools.children[2].children.map(c => c.id).join() === 'btn-toggle-nodes,btn-toggle-faces' && toolIds(toolRow).join() === 'ph-tools,ph-sep,btn-more-rail', toolIds(toolRow).join());
    check('the sub-tab row: three buttons Raster, Ebenen, Zeit; Raster is aria-current', subtabs.children.map(b => b.textContent).join() === 'Raster,Ebenen,Zeit' && subtabs.children.map(b => b.getAttribute('aria-current')).join('|') === 'true||', subtabs.children.map(b => b.getAttribute('aria-current')).join('|'));
    const pane = slot.children[0];
    check('the slot shows the Raster pane: row 1 = shapes, symmetry; row 2 = node stepper, size stepper, More', slot.children.length === 1 && pane.getAttribute('data-subtab') === 'raster' && pane.children.map(r => r.children.map(c => c.id).join('+')).join(' / ') === 'nav-shapes+nav-symmetry / nav-node-stepper+nav-size-stepper+btn-more-form', pane.children.map(r => r.children.map(c => c.id).join('+')).join(' / '));
    check('the other panes (Ebenen, Zeit) are in the parking container, which is hidden', park.hidden === true && park.children.map(c => c.getAttribute('data-subtab')).join() === 'ebenen,zeit' && park.children[0].children[0].children[0].id === 'layer-strip' && park.children[1].children[0].children[0].id === 'timeline-strip');
    const sheet = p.doc.getElementById('more-rail');
    check('the rail\'s sheet got a second icon row (.more-extra) with the five former rail buttons, then the contextual groups (.more-settings), all between its first row and the name line', sheet.children.map(c => c.id || c.className).join() === 'more-row,more-row more-extra,more-settings,more-name', sheet.children.map(c => c.id || c.className).join());
    check('...the .more-settings wrapper holds the four Curve / Free groups, still hidden (sketch.js shows them)', sheet.children[2].children.map(c => c.id + (c.hidden ? '[h]' : '')).join() === 'curve-fold-group[h],curve-strength-group[h],free-roughness-group[h],free-controls-group[h]');
    check('...holding Formorgel, Paste Pattern, Info, Download, Clear in that order', sheet.children[1].children.map(c => c.id).join() === 'btn-gallery,btn-paste-pattern,btn-info,btn-save,btn-clear');
    check('every listed control is the SAME node object as before (no clone) and there is exactly one element per id', ids.every(id => p.doc.getElementById(id) === orig[id] && p.doc.all().filter(n => n.id === id).length === 1));
    const allIds = p.doc.all().map(n => n.id).filter(Boolean);
    check('no id appears twice anywhere in the document while the layout is on', new Set(allIds).size === allIds.length, allIds.length + ' ids');
    check('a comment marker stands where each moved element was (one per element, none for an element that did not move)', (function count(n) { return n.childNodes.reduce((a, c) => a + (c.nodeType === 8 && /^ph:/.test(c.text) ? 1 : 0) + (c.nodeType === 1 ? count(c) : 0), 0); })(p.doc.documentElement) === ids.length + 4);
    check('apply is idempotent: a second apply(form) does no work at all (not one node is moved or made) and leaves the very same containers', (() => { const d1 = dump(p.doc.documentElement), m0 = p.doc.mutations, s0 = p.doc.getElementById('ph-stack'), sl0 = p.doc.getElementById('ph-slot'); eng.apply('form'); eng.apply('form'); return dump(p.doc.documentElement) === d1 && p.doc.mutations === m0 && p.doc.getElementById('ph-stack') === s0 && p.doc.getElementById('ph-slot') === sl0 && p.doc.all().filter(n => n.id === 'ph-stack').length === 1; })(), 'mutations ' + p.doc.mutations);
    check('the tree before apply differs from the tree during (the layout really moved things)', before !== dump(p.doc.documentElement));
});

console.log('\n== the sheet buttons and the focus ==');
T('proxy', () => {
    const p = buildPage(), orig = original(p), eng = ph(p); eng.start();
    const sheet = p.doc.getElementById('more-rail'), opener = orig['btn-more-rail'];
    check('sheet closed (hidden): asking Info, Download, Clear, Paste or Formorgel to take the focus gives it to the sheet\'s opener (the More button in the tool row)', ['btn-info', 'btn-save', 'btn-clear', 'btn-paste-pattern', 'btn-gallery'].every(id => { p.doc.activeElement = p.doc.body; orig[id].focus(); return p.doc.activeElement === opener; }));
    sheet.hidden = false;
    check('sheet open: they take the focus themselves', ['btn-info', 'btn-save'].every(id => { p.doc.activeElement = p.doc.body; orig[id].focus(); return p.doc.activeElement === orig[id]; }));
    sheet.hidden = true;
    check('a control that is not in the sheet is not touched (Undo keeps its own focus())', !Object.prototype.hasOwnProperty.call(orig['btn-undo'], 'focus') && !Object.prototype.hasOwnProperty.call(orig['btn-more-form'], 'focus'));
    eng.release();
    check('release removes the redirect: focus() is the element\'s own again', ['btn-info', 'btn-save', 'btn-clear', 'btn-paste-pattern', 'btn-gallery'].every(id => !Object.prototype.hasOwnProperty.call(orig[id], 'focus')));
});

console.log('\n== release ==');
T('release', () => {
    const p = buildPage(), before = dump(p.doc.documentElement), orig = original(p);
    const nb = {}; ids.forEach(id => { nb[id] = [orig[id].parentNode, orig[id].previousSibling, orig[id].nextSibling]; });
    const eng = ph(p); eng.start(); eng.show('ebenen'); eng.show('zeit');
    eng.release();
    check('release puts every control back: the same parent, the same neighbours', ids.every(id => orig[id].parentNode === nb[id][0] && orig[id].previousSibling === nb[id][1] && orig[id].nextSibling === nb[id][2]), ids.filter(id => orig[id].parentNode !== nb[id][0] || orig[id].previousSibling !== nb[id][1] || orig[id].nextSibling !== nb[id][2]).join(','));
    check('...and the whole tree is equal to the tree before (no marker, no container, no extra row left)', dump(p.doc.documentElement) === before);
    check('the class ph, --panel-h and --ph-inner-h are gone', !p.doc.documentElement.classList.contains('ph') && p.doc.documentElement.style.getPropertyValue('--panel-h') === '' && p.doc.documentElement.style.getPropertyValue('--ph-inner-h') === '' && eng.state().applied === null && eng.state().moved.length === 0);
    check('release is idempotent (a second release, and a release before any apply, do no work)', (() => { const m0 = p.doc.mutations; eng.release(); eng.release(); const q = buildPage(); const e2 = ph(q); const d = dump(q.doc.documentElement), mq0 = q.doc.mutations; e2.release(); return p.doc.mutations === m0 && q.doc.mutations === mq0 && dump(q.doc.documentElement) === d && dump(p.doc.documentElement) === before; })());
    // two round trips, then the handlers fire once
    const eng2 = ph(p); eng2.apply('form'); eng2.release(); eng2.apply('form'); eng2.release(); eng2.apply('form');
    ids.forEach(id => { if (orig[id].tagName === 'BUTTON' || orig[id].tagName === 'A') orig[id].clicks = 0; });
    ids.forEach(id => { if (orig[id].tagName === 'BUTTON' || orig[id].tagName === 'A') orig[id].dispatch('click'); });
    const fired = ids.filter(id => orig[id].tagName === 'BUTTON' || orig[id].tagName === 'A');
    check('after two round trips (apply, release, apply, release, apply) each control\'s handler fires exactly once per click (' + fired.length + ' buttons)', fired.every(id => orig[id].clicks === 1 && (orig[id].handlers.click || []).length === 1), fired.filter(id => orig[id].clicks !== 1).join(','));
    eng2.release(); eng2.apply('form'); eng2.release();
    check('and again a full round trip leaves the tree as it was (no drift: two markers, two rows)', dump(p.doc.documentElement) === before);
});

console.log('\n== sub-tabs ==');
T('subtabs', () => {
    const p = buildPage(), orig = original(p), eng = ph(p); eng.start();
    const slot = () => p.doc.getElementById('ph-slot'), park = () => p.doc.getElementById('ph-park');
    const btnOf = s => p.doc.getElementById('ph-subtab-' + s);
    const rasterIds = ['nav-shapes', 'nav-symmetry', 'nav-node-stepper', 'nav-size-stepper', 'btn-more-form'];
    const inTab = id => p.doc.tabOrder().indexOf(orig[id]) >= 0;
    check('Raster shown: its controls are in the tab order, the layer strip and the timeline strip are NOT (parked in a hidden container)', rasterIds.every(id => p.doc.reachable(orig[id])) && !p.doc.reachable(orig['layer-strip']) && !p.doc.reachable(orig['timeline-strip']) && !p.doc.tabOrder().includes(p.doc.getElementById('ls-base')) && !p.doc.tabOrder().includes(p.doc.getElementById('ts-play')));
    btnOf('ebenen').dispatch('click');
    check('a click on "Ebenen" moves the layer strip into the slot and the Raster pane into the parking container', slot().children.length === 1 && slot().children[0].getAttribute('data-subtab') === 'ebenen' && slot().children[0].children[0].children[0] === orig['layer-strip'] && park().children.map(c => c.getAttribute('data-subtab')).sort().join() === 'raster,zeit', park().children.map(c => c.getAttribute('data-subtab')).join());
    check('...the strip\'s own buttons are reachable now, the Raster controls are NOT (parked: out of the tab order and unreachable) - the very nodes, not copies', p.doc.tabOrder().includes(p.doc.getElementById('ls-base')) && rasterIds.every(id => !p.doc.reachable(orig[id])) && rasterIds.every(id => !p.doc.tabOrder().includes(orig[id])) && p.doc.getElementById('nav-shapes') === orig['nav-shapes']);
    check('aria-current marks the active sub-tab only; the slot is labelled by it', btnOf('ebenen').getAttribute('aria-current') === 'true' && btnOf('raster').getAttribute('aria-current') === null && btnOf('zeit').getAttribute('aria-current') === null && slot().getAttribute('aria-labelledby') === 'ph-subtab-ebenen');
    check('the sub-tab buttons are real buttons in the tab order, all of them (the header tabs\' model: Tab moves between them, Enter / Space activates)', ['raster', 'ebenen', 'zeit'].every(s => btnOf(s).tagName === 'BUTTON' && btnOf(s).getAttribute('type') === 'button' && !btnOf(s).hasAttribute('tabindex') && p.doc.tabOrder().includes(btnOf(s))));
    check('the afterShow hook of the layer strip ran on the first show of Ebenen (it lost its scroll position when it moved) and again on each later show', p.calls.reveal === 1 && (eng.show('zeit'), eng.show('ebenen'), p.calls.reveal === 2), 'revealActive x' + p.calls.reveal);
    eng.show('zeit');
    check('"Zeit": the timeline strip is in the slot, one row; the layer strip is parked again', slot().children[0].getAttribute('data-subtab') === 'zeit' && slot().children[0].children.length === 1 && p.doc.reachable(orig['timeline-strip']) && !p.doc.reachable(orig['layer-strip']));
    check('only ONE pane is ever in the slot (never two)', slot().children.length === 1);
    check('show() of an unknown sub-tab changes nothing and returns false', (() => { const d = dump(p.doc.documentElement); const r = eng.show('nirgends'); return r === false && dump(p.doc.documentElement) === d; })());
    // remembered per tab: leave the tab (Netz is not covered: released), come back
    p.doc.documentElement.setAttribute('data-tab', 'nirgends'); p.doc.dispatch('tabchange', { detail: { tab: 'nirgends' } });
    check('A tab the config does not cover (here an unknown one: every real tab is covered from commit 3): the tabchange releases (class gone, controls back in the Form row and the rail)', !p.doc.documentElement.classList.contains('ph') && orig['btn-undo'].parentNode.id === 'rail-group-a' && orig['nav-shapes'].parentNode.id === 'nav-form' && p.doc.getElementById('ph-stack') === null);
    p.doc.documentElement.setAttribute('data-tab', 'form'); p.doc.dispatch('tabchange', { detail: { tab: 'form' } });
    check('back to Form: the layout is on again and shows the sub-tab it had (Zeit), remembered per tab', p.doc.documentElement.classList.contains('ph') && p.doc.getElementById('ph-slot').children[0].getAttribute('data-subtab') === 'zeit' && p.doc.getElementById('ph-subtab-zeit').getAttribute('aria-current') === 'true' && eng.state().remembered.form === 'zeit');
    // the focus
    const q = buildPage(), e2 = ph(q); e2.start(); const more = q.doc.getElementById('btn-more-form'); more.focus();
    check('a focused control that moves keeps the focus (apply with the focus inside: a re-apply after a release puts it back)', q.doc.activeElement === more && (e2.release(), q.doc.activeElement === more) && (e2.apply('form'), q.doc.activeElement === more));
    q.doc.activeElement = q.doc.getElementById('btn-more-form'); e2.show('ebenen');
    check('switching sub-tab while the focus is inside the pane that gets parked moves the focus to the sub-tab button (not to the body)', q.doc.activeElement === q.doc.getElementById('ph-subtab-ebenen'), q.doc.activeElement.id || q.doc.activeElement.tagName);
});

console.log('\n== width, tabs and events ==');
T('events', () => {
    const p = buildPage(); p.mq.matches = false;
    const eng = ph(p), before = dump(p.doc.documentElement); eng.start();
    check('at 768px and up (the media query does not match) start() applies nothing: the tree is untouched', dump(p.doc.documentElement) === before && !p.doc.documentElement.classList.contains('ph'));
    check('apply(form) there returns false and releases', eng.apply('form') === false && dump(p.doc.documentElement) === before);
    p.mq.set(true);
    check('the media query turning to a phone width applies (resize / rotation)', p.doc.documentElement.classList.contains('ph') && eng.state().applied === 'form');
    p.mq.set(false);
    check('...and turning back to 768px releases everything', dump(p.doc.documentElement) === before && eng.state().applied === null);
    p.mq.set(true); eng.show('ebenen'); p.mq.set(false); p.mq.set(true);
    check('a round trip across 768px keeps the sub-tab (Ebenen)', p.doc.getElementById('ph-slot').children[0].getAttribute('data-subtab') === 'ebenen');
    p.win.innerHeight = 640; p.win.dispatch('resize');
    check('a resize event re-reads window.innerHeight into --ph-inner-h', p.doc.documentElement.style.getPropertyValue('--ph-inner-h') === '640px');
    p.win.dispatch('orientationchange');
    check('start() twice registers the listeners once (a second start adds nothing)', (() => { const n = (p.doc.handlers.tabchange || []).length; eng.start(); return (p.doc.handlers.tabchange || []).length === n && n === 1 && p.mq.handlers.length === 1; })());
    // no data-tab yet (nav.js has not run): nothing applies until the first tabchange
    const r = buildPage(); r.doc.documentElement.removeAttribute('data-tab'); const e3 = ph(r), d0 = dump(r.doc.documentElement); e3.start();
    check('before nav.js has said which tab it is (no html[data-tab]) the engine waits: nothing moved', dump(r.doc.documentElement) === d0 && e3.state().applied === null);
    r.doc.documentElement.setAttribute('data-tab', 'nirgends'); r.doc.dispatch('tabchange', { detail: { tab: 'nirgends' } });
    check('the first tabchange (an uncovered tab) leaves it alone', dump(r.doc.documentElement) === d0);
    r.doc.documentElement.setAttribute('data-tab', 'form'); r.doc.dispatch('tabchange', { detail: { tab: 'form' } });
    check('the first tabchange for Form applies, and the document was still "interactive" then (before the load event, when p5 runs setup)', r.doc.documentElement.classList.contains('ph') && e3.state().firstApplyState === 'interactive');
    ['nirgends'].forEach(t => { r.doc.documentElement.setAttribute('data-tab', t); r.doc.dispatch('tabchange', { detail: { tab: t } }); });
    check('every not covered tab releases (an unknown one): all controls where they were', dump(r.doc.documentElement) === d0);
    check('an unknown tab (a hash nav.js would not produce) is treated as not covered', ph(buildPage()).apply('nirgends') === false);
});

console.log('\n== a missing element ==');
T('missing', () => {
    const p = buildPage({ without: ['btn-random', 'timeline-strip'] }), eng = ph(p), before = dump(p.doc.documentElement);
    let threw = null; try { eng.start(); eng.show('zeit'); } catch (e) { threw = e; }
    check('an id the page does not have does not throw; state().missing names it', !threw && eng.state().missing.includes('btn-random') && eng.state().missing.includes('timeline-strip'), threw ? String(threw) : eng.state().missing.join(','));
    eng.release();
    check('release still restores the rest (the tree equals the one without those elements before)', dump(p.doc.documentElement) === before);
});

console.log('\n== the sheets (commit 1b): the layer "Mehr" block and the timeline "Mehr" group, with the REAL ui.js ==');
// a phone page with the real UI.overlay, the layer strip (Ebenen) in the slot so its "..." button can take the focus
const sheetPage = sub => { const p = buildPage({ ui: true }), eng = ph(p); eng.start(); eng.show(sub || 'ebenen'); return { p, eng, host: p.doc.getElementById('ph-sheet-layer'), tl: p.doc.getElementById('ph-sheet-timeline'), lt: p.doc.getElementById('ls-more'), ts: p.doc.getElementById('ts-more') }; };
const esc = host => { let stopped = 0; host.dispatch('keydown', { key: 'Escape', stopPropagation() { stopped++; } }); return stopped; };
T('sheet-build', () => {
    const { p, host, tl, lt, ts } = sheetPage();
    check('apply makes two sheet hosts inside the stack, hidden, role dialog, named: ph-sheet-layer "Ebenen-Einstellungen" and ph-sheet-timeline "Zeitleiste: Mehr", class overlay ph-sheet', !!host && !!tl && host.parentNode.id === 'ph-stack' && tl.parentNode.id === 'ph-stack' && host.hidden && tl.hidden && host.getAttribute('role') === 'dialog' && tl.getAttribute('role') === 'dialog' && host.getAttribute('aria-label') === 'Ebenen-Einstellungen' && tl.getAttribute('aria-label') === 'Zeitleiste: Mehr' && host.className === 'overlay ph-sheet' && tl.className === 'overlay ph-sheet', host && host.className);
    check('the hosts hold the very blocks (#layer-more-panel, #timeline-group), moved, not copied; the leftover container no longer holds them', host.children[0] === p.layerPanel && tl.children[0] === p.tlGroup && p.doc.all().filter(n => n.id === 'layer-more-panel' || n.id === 'timeline-group').length === 2);
    check('the "..." buttons are the sheets\' openers: aria-haspopup dialog, aria-expanded false', lt.getAttribute('aria-haspopup') === 'dialog' && ts.getAttribute('aria-haspopup') === 'dialog' && lt.getAttribute('aria-expanded') === 'false' && ts.getAttribute('aria-expanded') === 'false');
    check('closed: the scrim is hidden and the layer block keeps its own state (hidden), as before', p.scrim.hidden === true && p.layerPanel.hidden === true && p.layerModel.open === false);
});
T('sheet-open-close', () => {
    const { p, host, lt } = sheetPage();
    lt.dispatch('click');
    check('a tap on the layer "..." flips the block\'s own state (the existing handler) AND opens the sheet: host visible, scrim visible, aria-expanded true, class sheet', p.layerModel.open === true && p.layerPanel.hidden === false && host.hidden === false && host.classList.contains('sheet') && p.scrim.hidden === false && lt.getAttribute('aria-expanded') === 'true');
    check('focus moved into the sheet (its first reachable button)', host.contains(p.doc.activeElement), p.doc.activeElement.id || p.doc.activeElement.tagName);
    const stopped = esc(host);
    check('Escape closes the sheet: host and scrim hidden, aria-expanded false; Escape does not bubble further', host.hidden && p.scrim.hidden && lt.getAttribute('aria-expanded') === 'false' && stopped === 1);
    check('...and the block\'s own state closes with it (the "..." button was clicked once more): model closed, #layer-more-panel hidden', p.layerModel.open === false && p.layerPanel.hidden === true);
    check('...and the focus is back on the "..." button', p.doc.activeElement === lt, p.doc.activeElement.id || p.doc.activeElement.tagName);
    lt.dispatch('click'); lt.dispatch('click');
    check('a second tap on "..." closes it again (the trigger toggles; the sheet follows the state)', host.hidden && p.scrim.hidden && p.layerModel.open === false);
    lt.dispatch('click'); p.doc.dispatch('pointerdown', { target: p.doc.getElementById('canvas-container') });
    check('a tap outside (pointerdown anywhere else) closes it and closes the state; the focus is NOT pulled back to the "..." button (the person tapped elsewhere)', host.hidden && p.scrim.hidden && p.layerModel.open === false && p.doc.activeElement !== lt);
    lt.dispatch('click'); p.doc.dispatch('pointerdown', { target: p.layerPanel.children[0] });
    check('a pointerdown INSIDE the sheet leaves it open', !host.hidden && p.layerModel.open === true);
    p.scrim.dispatch('click');
    check('a tap on the scrim closes the sheet and the state', host.hidden && p.scrim.hidden && p.layerModel.open === false);
    // the click count: every close is ONE click on the button (a loop would show here)
    const before = lt.clicks; lt.dispatch('click'); esc(host);
    check('a sheet-originated close clicks the "..." button exactly once (open click + one close click = 2 handler runs, no loop)', lt.clicks - before === 2, String(lt.clicks - before));
});
T('sheet-sync', () => {
    const { p, host, lt } = sheetPage();
    p.layerModel.open = true; p.layerPanel.hidden = false; p.win.uiSync();
    check('UI.onSync: a block that is open by some other path (a restore, the page\'s own code) opens the sheet at the next sync', !host.hidden && !p.scrim.hidden);
    p.layerModel.open = false; p.layerPanel.hidden = true; p.win.uiSync();
    check('...and a block that is closed by some other path closes the sheet at the next sync (no stuck scrim)', host.hidden && p.scrim.hidden && lt.getAttribute('aria-expanded') === 'false');
    lt.dispatch('click'); p.doc.getElementById('layer-align').focus(); p.layerModel.open = false; p.layerPanel.hidden = true; p.win.uiSync();
    check('a block that closes by itself while the focus is inside the sheet (a button of the block removes what it shows): the sheet closes and the focus goes to the "..." button, not into the void', host.hidden && p.doc.activeElement === lt, p.doc.activeElement.id || p.doc.activeElement.tagName);
    p.win.uiSync(); p.win.uiSync();
    check('a sync with nothing to do changes nothing (no flicker: the host and the scrim keep their state)', host.hidden && p.scrim.hidden);
});
T('sheet-timeline', () => {
    const { p, eng, tl, ts, host, lt } = sheetPage('zeit');
    ts.dispatch('click');
    check('the timeline "..." (ts-open class on #timeline-group) opens the timeline sheet', p.tlGroup.classList.contains('ts-open') && !tl.hidden && !p.scrim.hidden && ts.getAttribute('aria-expanded') === 'true' && tl.contains(p.doc.activeElement));
    esc(tl);
    check('Escape closes it, removes ts-open, returns the focus to the timeline "..." button', tl.hidden && p.scrim.hidden && !p.tlGroup.classList.contains('ts-open') && p.doc.activeElement === ts, p.doc.activeElement.id || p.doc.activeElement.tagName);
    // only one sheet at a time: opening one closes the other AND the other's state
    eng.show('ebenen'); lt.dispatch('click'); eng.show('zeit'); ts.dispatch('click');
    check('only ONE sheet is open at a time: opening the timeline sheet closes the layer sheet and the layer block\'s own state', !tl.hidden && host.hidden && p.layerModel.open === false && p.layerPanel.hidden === true && lt.getAttribute('aria-expanded') === 'false');
    check('...with a single scrim', p.scrim.hidden === false);
});
T('sheet-lifecycle', () => {
    const { p, eng, host, tl, lt } = sheetPage(); const d0 = (() => { const q = buildPage(); return dump(q.doc.documentElement); })();
    lt.dispatch('click');
    p.mq.set(false);
    check('a width change to 768+ with a sheet open: the sheet closes cleanly, the block goes back into the controls container with its state closed, scrim hidden, nothing inert, the whole tree is the one before', dump(p.doc.documentElement) === d0 && p.scrim.hidden && p.layerModel.open === false && p.layerPanel.hidden === true && lt.getAttribute('aria-expanded') === 'false' && !p.doc.getElementById('ph-sheet-layer'));
    p.mq.set(true); eng.show('ebenen'); lt.dispatch('click');
    p.doc.documentElement.setAttribute('data-tab', 'nirgends'); p.doc.dispatch('tabchange', { detail: { tab: 'nirgends' } });
    check('a tab change to an uncovered tab with a sheet open: closes cleanly, state closed, scrim hidden, tree equal to the original', dump(p.doc.documentElement) === d0 && p.scrim.hidden && p.layerModel.open === false);
    p.doc.documentElement.setAttribute('data-tab', 'form'); p.doc.dispatch('tabchange', { detail: { tab: 'form' } });
    const host2 = p.doc.getElementById('ph-sheet-layer');
    check('back in Form the SAME host element is reused (made once: UI.overlay cannot unbind its listeners) and the sheet works again', host2 === host && p.layerPanel.parentNode === host && (() => { eng.show('ebenen'); lt.dispatch('click'); const o = !host.hidden; esc(host); return o && host.hidden; })());
    // handlers: the opener has its own click handler + the engine's sync listener, however many round trips
    for (let i = 0; i < 4; i++) { p.mq.set(false); p.mq.set(true); }
    const n0 = buildPage().doc.getElementById('ls-more').handlers.click.length;   // the page's own listeners on the button (the click counter and the model handler of the fake page)
    check('after 4 round trips the "..." button has the page\'s own click listeners plus exactly ONE of the engine (the sync) and the host exactly 1 keydown listener (UI.overlay\'s): no growth', lt.handlers.click.length === n0 + 1 && host.handlers.keydown.length === 1, lt.handlers.click.length + ' (page ' + n0 + ') / ' + host.handlers.keydown.length);
    eng.show('ebenen'); const c0 = lt.clicks; lt.dispatch('click');
    check('...and a tap still runs the existing handler once', lt.clicks - c0 === 1 && p.layerModel.open === true);
    lt.dispatch('click'); eng.release();
    check('release with the block closed leaves no host, no stuck scrim', !p.doc.getElementById('ph-sheet-layer') && !p.doc.getElementById('ph-sheet-timeline') && p.scrim.hidden);
});
T('sheet-open-at-apply', () => {
    const p = buildPage({ ui: true }); p.layerModel.open = true; p.layerPanel.hidden = false;
    const eng = ph(p); eng.start();
    check('a block that is already open when the layout turns on (the window got narrower while it was open inline) opens its sheet at once, without waiting for the next sync', !p.doc.getElementById('ph-sheet-layer').hidden && !p.scrim.hidden);
});
T('sheet-resize-typing', () => {
    const { p, host, lt } = sheetPage();
    lt.dispatch('click');
    const field = p.doc.getElementById('layer-offset-x-input'); field.focus();
    p.win.innerHeight = 420; p.win.dispatch('resize');
    check('a resize (the soft keyboard) while a text/number field IN the sheet has the focus keeps the sheet open', p.doc.activeElement === field && !host.hidden && p.layerModel.open === true);
    p.doc.getElementById('layer-align').focus(); p.win.dispatch('resize');
    check('a resize with the focus on a button of the sheet closes it, like every UI.overlay (and the state)', host.hidden && p.layerModel.open === false && p.scrim.hidden);
});
T('sheet-inline', () => {
    const a = buildPage(), ea = ph(a); ea.start();
    check('WITHOUT UI.overlay (no ui.js) the blocks stay where they are: no host, the layer block in the controls container, hidden by its own state', !a.doc.getElementById('ph-sheet-layer') && !a.doc.getElementById('ph-sheet-timeline') && a.layerPanel.parentNode.className === 'controls-container');
    const b = buildPage({ ui: true }); b.mq.matches = false; const eb = ph(b), d = dump(b.doc.documentElement); eb.start();
    b.doc.getElementById('ls-more').dispatch('click');
    check('WITHOUT html.ph (768+ or a tab not covered): no host, nothing moved, a tap on "..." only flips the block\'s own state (inline, as today), no scrim', !b.doc.getElementById('ph-sheet-layer') && b.layerModel.open === true && b.layerPanel.hidden === false && b.scrim.hidden && b.doc.getElementById('ls-more').handlers.click.length === buildPage().doc.getElementById('ls-more').handlers.click.length && b.layerPanel.parentNode.className === 'controls-container');
    const c = buildPage({ ui: true, without: ['timeline-strip'] }), ec = ph(c); ec.start();
    check('a sheet whose "..." button is missing is reported (state().missing) and its block stays inline; the other sheet still works', ec.state().missing.includes('timeline') && !!c.doc.getElementById('ph-sheet-layer') && !c.doc.getElementById('ph-sheet-timeline') && c.tlGroup.parentNode.className === 'controls-container');
});

T('sheet-dialogs', () => {
    // a confirmation dialog (the real UI.dialog, as ui-timeline.js / ui-layers.js / ui-rail.js make them) opened from a sheet, from the tool row, and the sheet's own scrim
    const mkDialog = (p, opener, extraOpen) => {
        const el = (tag, attrs, kids) => { const n = p.doc.createElement(tag); Object.keys(attrs || {}).forEach(k => n.setAttribute(k, attrs[k])); (kids || []).forEach(k => n.appendChild(k)); return n; };
        const cancel = el('button', { id: 'dlg-cancel', type: 'button' }), confirm = el('button', { id: 'dlg-confirm', type: 'button' });
        const strong = el('strong'), content = el('div', { class: 'dialog-content' }, [el('p', {}, [strong]), el('div', { class: 'restart-actions' }, [cancel, confirm])]);
        const overlay = el('div', { id: 'dlg', class: 'dialog-overlay hidden' }, [content]); p.doc.body.appendChild(overlay);
        const fire = () => (p.win.observers || []).slice().forEach(cb => cb());
        opener.addEventListener('click', () => { overlay.classList.remove('hidden'); fire(); });
        const close = () => { overlay.classList.add('hidden'); fire(); };
        cancel.addEventListener('click', close);
        confirm.addEventListener('click', close);
        p.win.UI.dialog(overlay, opener, cancel);
        return { overlay, cancel, confirm, open: () => opener.dispatch('click'), isOpen: () => !overlay.classList.contains('hidden') };
    };
    const tap = (p, target) => { p.doc.dispatch('pointerdown', { target }); target.focus(); target.dispatch('click'); };   // a tap: pointerdown, the focus a click gives, the click
    // 1. from the timeline sheet (the opener "Zeitleiste entfernen" is IN the sheet)
    {
        const { p, eng, tl, ts } = sheetPage('zeit'); const clear = p.doc.getElementById('btn-clear-timeline');
        const d = mkDialog(p, clear);
        ts.dispatch('click'); clear.focus(); d.open();
        check('a dialog opened from a sheet: the focus moves into the dialog (Abbrechen first) and the sheet is still open', d.isOpen() && p.doc.activeElement === d.cancel && !tl.hidden && !p.scrim.hidden, p.doc.activeElement.id);
        p.doc.dispatch('pointerdown', { target: d.cancel });
        check('a pointerdown on the dialog\'s button leaves the sheet open (the tap is not "outside")', !tl.hidden && p.tlGroup.classList.contains('ts-open') && !p.scrim.hidden);
        d.cancel.focus(); d.cancel.dispatch('click');
        check('Abbrechen: the dialog closes, the SHEET is still open and the focus is back on the opener inside it', !d.isOpen() && !tl.hidden && p.doc.activeElement === clear, p.doc.activeElement.id || p.doc.activeElement.tagName);
        d.open(); let stopped = 0; d.overlay.dispatch('keydown', { key: 'Escape', preventDefault() { }, stopPropagation() { stopped++; } });
        check('Escape in the dialog is the same path (UI.dialog clicks Abbrechen): dialog closed, sheet open, the focus on the opener', !d.isOpen() && !tl.hidden && p.doc.activeElement === clear && stopped === 1);
        d.open(); p.doc.dispatch('pointerdown', { target: d.overlay }); d.overlay.dispatch('click');
        check('a pointerdown on the dialog\'s backdrop (the overlay element) does not close the sheet either', !tl.hidden);
        d.confirm.focus(); d.confirm.dispatch('click');
        check('confirm closes the dialog and keeps the sheet open (it follows the block; whoever confirms changes the block, the engine does not close it)', !d.isOpen() && !tl.hidden);
        p.doc.dispatch('pointerdown', { target: p.scrim });
        p.scrim.dispatch('click');
        check('the sheet\'s OWN scrim still closes the sheet (and its state)', tl.hidden && p.scrim.hidden && !p.tlGroup.classList.contains('ts-open'));
        ts.dispatch('click'); p.doc.dispatch('pointerdown', { target: p.doc.getElementById('canvas-container') });
        check('a tap outside (not in a dialog) still closes it', tl.hidden && !p.tlGroup.classList.contains('ts-open'));
    }
    // 2. a dialog opened from the tool row while NO sheet is open: nothing to keep or close
    {
        const { p, tl, host } = sheetPage('zeit'); const undo = p.doc.getElementById('btn-undo');
        const d = mkDialog(p, undo); d.open(); tap(p, d.cancel);
        check('a dialog from the tool row (no sheet open): the tap on Abbrechen closes it, the focus returns to the opener, no sheet appears or is disturbed', !d.isOpen() && p.doc.activeElement === undo && tl.hidden && host.hidden && p.scrim.hidden, p.doc.activeElement.id);
    }
    // 3. the keyboard and the pointer path end in the same state
    {
        const a = sheetPage('zeit'), b = sheetPage('zeit');
        const run = (page, viaPointer) => { const clear = page.p.doc.getElementById('btn-clear-timeline'), d = mkDialog(page.p, clear); page.ts.dispatch('click'); clear.focus(); d.open(); if (viaPointer) tap(page.p, d.cancel); else d.overlay.dispatch('keydown', { key: 'Escape', preventDefault() { }, stopPropagation() { } }); return [d.isOpen(), !page.tl.hidden, page.p.doc.activeElement.id, page.p.tlGroup.classList.contains('ts-open')].join(); };
        const rp = run(a, true), rk = run(b, false);
        check('pointer path and keyboard path give the same state (dialog closed, sheet open, focus on the opener, block open)', rp === rk && rp === 'false,true,btn-clear-timeline,true', rp + ' / ' + rk);
    }
});
console.log('\n== the Farbe tab (commit 2) ==');
const CHIPS = require(process.env.UI_PHONE_CHIPS_JS || path.join(ROOT, 'ui-phone-chips.js'));
const farbePage = opts => { const p = buildPage(Object.assign({ ui: true }, opts || {})); const chips = CHIPS.createChips(p.doc, p.win); p.chips = chips; p.doc.documentElement.setAttribute('data-tab', 'farbe'); return p; };
const farbeIds = () => { const t = config.tabs.farbe, tr = config.toolRows[t.toolRow], out = [].concat.apply([], tr.groups).concat(tr.end, tr.sheet.items); t.subtabs.forEach(s => config.subtabs[s].rows.forEach(r => r.items.forEach(i => { if (i.id) out.push(i.id); (i.also || []).forEach(x => out.push(x)); }))); return out; };
T('farbe-apply', () => {
    const p = farbePage(), eng = ph(p); const before = dump(p.doc.documentElement), orig = {}; farbeIds().forEach(id => { orig[id] = p.doc.getElementById(id); });
    const opener = p.doc.getElementById('btn-more-rail'), label0 = opener.getAttribute('aria-label'), i18n0 = opener.getAttribute('data-i18n'), title0 = opener.getAttribute('title');
    opener.setAttribute('aria-label', 'Mehr: Kurve, Frei'); opener.setAttribute('data-i18n', 'more.rail.button'); opener.setAttribute('title', 'Mehr: Kurve, Frei');
    const before2 = dump(p.doc.documentElement);
    eng.start();
    check('Farbe is covered: start() with html[data-tab=farbe] applies it (class ph, applied "farbe", the first sub-tab Harmonie)', p.doc.documentElement.classList.contains('ph') && eng.state().applied === 'farbe' && eng.state().sub === 'harmonie', JSON.stringify(eng.state().missing));
    check('every listed control exists (the chip containers come from the chip view); nothing is missing', eng.state().missing.length === 0 && farbeIds().every(id => orig[id]), eng.state().missing.join());
    const toolRow = p.doc.getElementById('ph-toolrow'), tools = toolRow.children[0];
    check('the tool row: [ Fill | the strategy group ] scrolling part, a separator, then More at the end; Undo, Redo, Random, Clear stay where they were (hidden in Farbe by the rail CSS)', tools.children.map(g => g.className.split(' ')[0]).join() === 'ph-toolgroup,ph-sep,ph-toolgroup' && tools.children[0].children.map(c => c.id).join() === 'btn-toggle-faces' && tools.children[2].children.map(c => c.id).join() === 'farbe-strategy-group' && toolRow.children.map(c => c.id || c.className.split(' ')[0]).join() === 'ph-tools,ph-sep,btn-more-rail' && p.doc.getElementById('btn-undo').parentNode.id === 'rail-group-a' && p.doc.getElementById('btn-clear').parentNode.id === 'rail-group-e');
    check('the strategy radiogroup moved WHOLE: the wrapper (role radiogroup) with its four buttons, the same nodes', orig['farbe-strategy-group'].getAttribute('role') === 'radiogroup' && orig['farbe-strategy-group'].children.map(c => c.id).join() === 'btn-strategy-cyclic,btn-strategy-area,btn-strategy-symmetry,btn-strategy-rings');
    check('the sub-tab row: Harmonie, Spuren, Ebenen, Zeit; Harmonie is current', p.doc.getElementById('ph-subtabs').children.map(b => b.textContent).join() === 'Harmonie,Spuren,Ebenen,Zeit' && p.doc.getElementById('ph-subtab-harmonie').getAttribute('aria-current') === 'true');
    const pane = id => p.doc.getElementById('ph-slot').children[0].getAttribute('data-subtab') === id ? p.doc.getElementById('ph-slot').children[0] : p.doc.getElementById('ph-park').children.find(c => c.getAttribute('data-subtab') === id);
    const rowsOf = pane => pane.children.map(r => r.children.map(c => c.id || c.className.split(' ')[0]).join('+')).join(' / ');
    check('Harmonie: row 1 = the anchor views (Kreis, Dreieck), a hairline the engine made, the two harmony clusters in one slot; row 2 = hue stepper, register stepper, the swatch', rowsOf(pane('harmonie')) === 'nav-anchor-views+ph-sep+farbe-family-triangle+farbe-family-circle / farbe-anchor-hue-stepper+farbe-anchor-register-stepper+farbe-anchor-preview', rowsOf(pane('harmonie')));
    check('Harmonie row 1 is a scrolling row (below 340px), row 2 is not', pane('harmonie').children[0].className === 'ph-row ph-row-scroll' && pane('harmonie').children[1].className === 'ph-row');
    check('Spuren: row 1 = #ph-trail-chips, row 2 = #ph-trail-stepper (the chip view\'s containers); Ebenen and Zeit are the shared strips', rowsOf(pane('spuren')) === 'ph-trail-chips / ph-trail-stepper' && rowsOf(pane('ebenen')) === 'layer-strip' && rowsOf(pane('zeit')) === 'timeline-strip');
    const sheet = p.doc.getElementById('more-rail');
    check('the rail\'s sheet got ONE extra row: Reset Color, Nodes, the Farborgel link, Info, Download (and no Curve / Free settings row: Farbe has none); Form\'s own first row is still its first child', sheet.children.map(c => c.id || c.className).join() === 'more-row,more-row more-extra,more-name' && sheet.children[1].children.map(c => c.id).join() === 'btn-face-colors-reset,btn-toggle-nodes,btn-farborgel,btn-info,btn-save', sheet.children.map(c => c.id || c.className).join());
    check('the opener More says what is in it while Farbe is on (aria-label, title, data-i18n key)', opener.getAttribute('aria-label') === config.toolRows.farbe.sheet.openerLabel.text && opener.getAttribute('title') === config.toolRows.farbe.sheet.openerLabel.text && opener.getAttribute('data-i18n') === config.toolRows.farbe.sheet.openerLabel.i18n, opener.getAttribute('aria-label'));
    check('every listed control is the SAME node as before, one element per id, no id twice in the document', farbeIds().every(id => p.doc.getElementById(id) === orig[id] && p.doc.all().filter(n => n.id === id).length === 1) && (() => { const ids2 = p.doc.all().map(n => n.id).filter(Boolean); return new Set(ids2).size === ids2.length; })());
    check('the chip containers left their holder for the panel: the holder (hidden) is empty', p.doc.getElementById('ph-chip-home').hidden === true && p.doc.getElementById('ph-chip-home').children.length === 0);
    // Form <-> Farbe <-> Netz
    p.doc.documentElement.setAttribute('data-tab', 'nirgends'); p.doc.dispatch('tabchange', { detail: { tab: 'nirgends' } });
    check('Farbe -> an uncovered tab releases: the tree is the tree before apply, the opener has its own label, title and data-i18n again, the chip containers are back in their holder', dump(p.doc.documentElement) === before2 && opener.getAttribute('aria-label') === 'Mehr: Kurve, Frei' && opener.getAttribute('title') === 'Mehr: Kurve, Frei' && opener.getAttribute('data-i18n') === 'more.rail.button' && p.doc.getElementById('ph-chip-home').children.length === 2);
    p.doc.documentElement.setAttribute('data-tab', 'form'); p.doc.dispatch('tabchange', { detail: { tab: 'form' } });
    check('uncovered -> Form applies Form (Raster, remembered per tab: Farbe\'s own sub-tab is not Form\'s) and the opener has no Farbe label', eng.state().applied === 'form' && eng.state().sub === 'raster' && opener.getAttribute('aria-label') === 'Mehr: Kurve, Frei' && p.doc.getElementById('more-rail').children.map(c => c.id || c.className).join() === 'more-row,more-row more-extra,more-settings,more-name');
    eng.show('zeit');
    p.doc.documentElement.setAttribute('data-tab', 'farbe'); p.doc.dispatch('tabchange', { detail: { tab: 'farbe' } });
    check('Form -> Farbe directly (no other tab between): Form is released first, Farbe applied, its first sub-tab Harmonie, and Form\'s sub-tab (Zeit) is remembered for its return', eng.state().applied === 'farbe' && eng.state().sub === 'harmonie' && eng.state().remembered.form === 'zeit');
    eng.show('spuren'); eng.release();
    check('release from Farbe with Spuren shown: the whole tree is the one before (every marker removed, the opener restored)', dump(p.doc.documentElement) === before2 && !p.doc.documentElement.classList.contains('ph'));
    const k = farbePage(), ek = ph(k); ek.start(); ek.release(); ek.apply('farbe'); ek.release(); ek.apply('farbe'); ek.release();
    check('three apply / release round trips of Farbe leave no drift (the tree equals the first state, no marker, no container)', (() => { const q = farbePage(); const d = dump(q.doc.documentElement); const e = ph(q); q.doc.documentElement.setAttribute('data-tab', 'farbe'); e.apply('farbe'); e.release(); e.apply('farbe'); e.release(); e.apply('farbe'); e.release(); return dump(q.doc.documentElement) === d; })());
    // the wrong-tab guard: Farbe's buttons are not touched by Form
    const f = farbePage(); f.doc.documentElement.setAttribute('data-tab', 'form'); const ef = ph(f); ef.start();
    check('Form applied while the Farbe pieces are on the page: they stay where they are (the strategy group in the rail, the families in the Farbe row)', f.doc.getElementById('farbe-strategy-group').parentNode.className === 'rail-bottom' && f.doc.getElementById('farbe-family-circle').parentNode.id === 'nav-farbe');
});
T('farbe-chips', () => {
    const p = farbePage(), eng = ph(p); eng.start(); eng.show('spuren');
    const ch = p.chips, N = ch.nodes;
    const mkRows = specs => { while (p.faceList.firstChild) p.faceList.removeChild(p.faceList.firstChild); const clicks = []; specs.forEach((sp, i) => { const row = p.doc.createElement('div'); row.className = 'fc-row'; row.dataset.key = sp.key; const sw = p.doc.createElement('span'); sw.className = 'fc-swatch'; sw.style.background = sp.color; sw.style.backgroundColor = sp.color; const lab = p.doc.createElement('span'); lab.className = 'fc-label'; lab.textContent = 'Trail ' + (i + 1) + ' · ' + sp.faces + ' face' + (sp.faces === 1 ? '' : 's'); row.appendChild(sw); row.appendChild(lab);
            if (sp.n !== undefined) { const wrap = p.doc.createElement('span'); wrap.className = 'pairing-variant'; ['◀', 'cnt', '▶'].forEach((t, j) => { if (j === 1) { const c = p.doc.createElement('span'); c.className = 'pairing-variant-count'; c.dataset.k = String(sp.n || 1); c.dataset.c = '3'; c.textContent = sp.n ? sp.n + '/3' : '–/3'; wrap.appendChild(c); } else { const b = p.doc.createElement('button'); b.className = 'layer-btn pairing-move-btn'; b.addEventListener('click', () => { clicks.push(sp.key + (j ? '+' : '-')); }); wrap.appendChild(b); } }); row.appendChild(wrap); }
            p.faceList.appendChild(row); }); return clicks; };
    p.faceGroup.hidden = false;
    let clicks = mkRows([{ key: 'k1', color: 'rgb(1, 1, 1)', faces: 6, n: 1 }, { key: 'k2', color: 'rgb(2, 2, 2)', faces: 1, n: 2 }, { key: 'k3', color: 'rgb(3, 3, 3)', faces: 4, n: 3 }]);
    ch.refresh();
    check('the chip view shows one chip per model row with its number, its accessible label and the colour bar read from the row\'s swatch; the first is selected and aria-pressed', N.chips.children.length === 3 && N.chips.children.map(c => c.textContent).join() === '1,2,3' && N.chips.children[0].getAttribute('aria-pressed') === 'true' && N.chips.children[1].getAttribute('aria-pressed') === 'false' && N.chips.children[1].getAttribute('aria-label') === 'Spur 2 · 1 Fläche' && N.chips.children.map(c => c.children[0].style.background).join('|') === 'rgb(1, 1, 1)|rgb(2, 2, 2)|rgb(3, 3, 3)');
    check('the stepper shows the selected trail\'s counter "1/3" and its label "Spur 1 · 6 Flächen"', N.count.textContent === '1/3' && N.label.textContent === 'Spur 1 · 6 Flächen');
    N.chips.children[2].dispatch('click');
    check('a tap on chip 3 selects it (aria-pressed, the label and counter follow); the getter says which', N.chips.children[2].getAttribute('aria-pressed') === 'true' && N.chips.children[0].getAttribute('aria-pressed') === 'false' && N.label.textContent === 'Spur 3 · 4 Flächen' && N.count.textContent === '3/3' && ch.selectedTrail().index === 2 && ch.selectedTrail().key === 'k3' && ch.selectedTrail().color === 'rgb(3, 3, 3)' && ch.selectedTrail().faceCount === 4);
    N.next.dispatch('click'); N.prev.dispatch('click');
    check('Next and Previous FORWARD the click to the SELECTED trail\'s own buttons (the model row\'s: the same handlers); no other row\'s button is clicked', clicks.join() === 'k3+,k3-', clicks.join());
    const m0 = p.doc.mutations; ch.sync(); ch.sync();
    check('a sync with nothing changed does no work (the signature is the same: not one node is touched)', p.doc.mutations === m0);
    clicks = mkRows([{ key: 'k1', color: 'rgb(1, 1, 1)', faces: 6, n: 1 }, { key: 'k2', color: 'rgb(2, 2, 2)', faces: 1, n: 2 }]);
    ch.refresh();
    check('the model lost the selected trail (3 rows -> 2): the selection is clamped to the last one, not left dangling; chips and stepper follow', N.chips.children.length === 2 && N.chips.children[1].getAttribute('aria-pressed') === 'true' && ch.selectedTrail().index === 1 && N.label.textContent === 'Spur 2 · 1 Fläche');
    clicks = mkRows([{ key: 'k0', color: 'rgb(9, 9, 9)', faces: 2, n: 1 }, { key: 'k1', color: 'rgb(1, 1, 1)', faces: 6, n: 1 }, { key: 'k2', color: 'rgb(2, 2, 2)', faces: 1, n: 2 }]);
    ch.refresh();
    check('a trail inserted before the selected one: the selection stays on the same trail (by key)', ch.selectedTrail().key === 'k2' && ch.selectedTrail().index === 2);
    const mark = p.doc.documentElement; mark.setAttribute('data-tab', 'nirgends'); const d1 = p.doc.mutations; clicks = mkRows([{ key: 'z', color: 'red', faces: 1, n: 1 }]); const d2 = p.doc.mutations; ch.sync();
    check('outside the Farbe phone layout the view does no work on a sync (it is not on screen)', p.doc.mutations === d2); mark.setAttribute('data-tab', 'farbe');
    mkRows([]); ch.refresh();
    check('no trails: ONE muted line "Keine Flächen" replaces the chips (data-i18n), the stepper shows nothing and its buttons are disabled with a reason', N.chips.children.length === 1 && N.chips.children[0].textContent === 'Keine Flächen' && N.chips.children[0].getAttribute('data-i18n') === 'trails.none' && N.count.textContent === '' && N.label.textContent === '' && N.prev.getAttribute('aria-disabled') === 'true' && N.next.getAttribute('aria-disabled') === 'true' && !!N.prev.dataset.reason && ch.selectedTrail() === null, N.prev.dataset.reason);
    mkRows([{ key: 'k1', color: 'rgb(1, 1, 1)', faces: 2, n: 1 }]); p.faceGroup.hidden = true; ch.refresh();
    check('the model group is hidden (Fill is off: its rows are stale): the view is empty, whatever the old rows say', N.chips.children.length === 1 && N.chips.children[0].textContent === 'Keine Flächen');
    p.win.farbeReason = () => 'Fläche füllen einschalten'; ch.refresh();
    check('with the panel\'s reason (window.farbeReason: Fill is off) the stepper buttons carry THAT reason (aria-disabled, data-reason), the one the other Farbe controls show', N.prev.dataset.reason === 'Fläche füllen einschalten' && N.next.getAttribute('aria-disabled') === 'true');
    p.win.farbeReason = () => null; p.faceGroup.hidden = false; mkRows([{ key: 'k1', color: 'rgb(1, 1, 1)', faces: 2, n: 1 }]); ch.refresh();
    check('rows and no reason: the buttons are enabled again (no aria-disabled left)', !N.prev.getAttribute('aria-disabled') && !N.next.getAttribute('aria-disabled'));
    const tr = N.prev.dispatch.bind(N.prev); mkRows([{ key: 'u', color: 'red', faces: 2, n: 0 }]); ch.refresh();
    check('an uncoloured trail (counter "–/3") is shown with the dash and still steps (the first click of the row\'s own stepper picks the first colour)', N.count.textContent === '–/3');
    const nm0 = p.doc.all().filter(n => n.id === 'ph-trail-chips').length;
    eng.release(); eng.apply('farbe'); eng.release();
    check('through release and apply the chip view keeps its single listener set (one container each, no duplicated ids)', p.doc.all().filter(n => n.id === 'ph-trail-chips').length === nm0 && p.doc.all().filter(n => n.id === 'ph-trail-stepper').length === 1);
});
console.log('\n== the Netz tab (commit 3) ==');
const netzPage = () => { const p = buildPage({ ui: true }); p.doc.documentElement.setAttribute('data-tab', 'netz'); return p; };
const netzIds = () => { const t = config.tabs.netz, tr = config.toolRows[t.toolRow], out = [].concat.apply([], tr.groups).concat(tr.end, tr.sheet.items, tr.sheet.settings || []); t.subtabs.forEach(s => config.subtabs[s].rows.forEach(r => r.items.forEach(i => { if (i.id) out.push(i.id); (i.also || []).forEach(x => out.push(x)); }))); return out; };
T('netz-apply', () => {
    const p = netzPage(), eng = ph(p), before = dump(p.doc.documentElement), orig = {}; netzIds().forEach(id => { orig[id] = p.doc.getElementById(id); });
    eng.start();
    check('every tab the config lists is covered and applies: Form, Farbe and Netz each set html.ph (so the header is the one 40px rule of the phone CSS in every tab)', Object.keys(config.tabs).every(t => config.tabs[t].covered === true) && ['form', 'farbe', 'netz'].every(t => { const q = buildPage({ ui: true }), e = ph(q); CHIPS.createChips(q.doc, q.win); q.doc.documentElement.setAttribute('data-tab', t); e.apply(t); return q.doc.documentElement.classList.contains('ph') && e.state().applied === t && e.state().missing.length === 0; }));
    check('Netz applies from html[data-tab=netz]: class ph, the first sub-tab Art, nothing missing', p.doc.documentElement.classList.contains('ph') && eng.state().applied === 'netz' && eng.state().sub === 'art' && eng.state().missing.length === 0, eng.state().missing.join());
    check('every listed control exists once and is the SAME node as before', netzIds().every(id => orig[id] && p.doc.getElementById(id) === orig[id] && p.doc.all().filter(n => n.id === id).length === 1), netzIds().filter(id => !orig[id]).join());
    const toolRow = p.doc.getElementById('ph-toolrow'), tools = toolRow.children[0];
    check('the tool row: [ Undo Redo | Nodes Net lines Fill ] scrolling part, a separator, then More at the end (Random, the catalog link, Info, Download and Clear are in the sheet)', tools.children.map(g => g.className.split(' ')[0]).join() === 'ph-toolgroup,ph-sep,ph-toolgroup' && tools.children[0].children.map(c => c.id).join() === 'btn-undo,btn-redo' && tools.children[2].children.map(c => c.id).join() === 'btn-toggle-nodes,net-lines-btn,btn-toggle-faces' && toolRow.children.map(c => c.id || c.className.split(' ')[0]).join() === 'ph-tools,ph-sep,btn-more-rail');
    const pane = id => p.doc.getElementById('ph-slot').children[0].getAttribute('data-subtab') === id ? p.doc.getElementById('ph-slot').children[0] : p.doc.getElementById('ph-park').children.find(c => c.getAttribute('data-subtab') === id);
    const rowsOf = pn => pn.children.map(r => r.children.map(c => c.id || c.className.split(' ')[0]).join('+')).join(' / ');
    check('the sub-tab row: Art, Achsen, Ebenen, Zeit; Art is current', p.doc.getElementById('ph-subtabs').children.map(b => b.textContent).join() === 'Art,Achsen,Ebenen,Zeit' && p.doc.getElementById('ph-subtab-art').getAttribute('aria-current') === 'true');
    check('Art: row 1 = the four kind buttons (the radiogroup wrapper, moved whole); row 2 = the strength stepper, Reverse, the panel\'s own More', rowsOf(pane('art')) === 'nav-kinds / net-strength-stepper+net-reverse-btn+btn-more-netz' && orig['nav-kinds'].children.length === 4 && orig['nav-kinds'].children.every(b => b.getAttribute('role') === 'radio'), rowsOf(pane('art')));
    check('Achsen: row 1 = Both / X / Y (the axes row), row 2 = the Fokus stepper alone; the exact field and the title stay in the Netz sheet', rowsOf(pane('achsen')) === 'net-axes-row / net-focus-stepper' && p.doc.getElementById('net-focus-exact').parentNode.parentNode === p.doc.getElementById('net-focus-row') && p.doc.getElementById('net-strength-exact').parentNode === p.moreNetz && p.doc.getElementById('net-geo-row').children.map(c => c.id).join() === 'net-alternate-btn');
    const sheet = p.doc.getElementById('more-rail');
    check('the rail\'s sheet keeps its first row (Curve ... Neu anfangen) and gets the second: Random, the catalog link, Info, Download, Clear, then the Curve / Free settings groups; More keeps its own name', sheet.children.map(c => c.id || c.className).join() === 'more-row,more-row more-extra,more-settings,more-name' && sheet.children[1].children.map(c => c.id).join() === 'btn-random,btn-gallery,btn-info,btn-save,btn-clear' && !config.toolRows.netz.sheet.openerLabel);
    // follow: the Fokus stepper copies the hidden state of its row
    const fs = p.doc.getElementById('net-focus-stepper');
    check('the Fokus stepper is hidden while sketch.js hides #net-focus-row (Aus, Geo) - it follows it at apply', fs.hidden === true);
    p.focusRow.hidden = false; p.win.uiSync();
    check('...and shows when sketch.js shows the row (Sin, Tan): on the next UI tick', fs.hidden === false);
    p.focusRow.hidden = true; p.win.uiSync();
    check('...and hides again with it', fs.hidden === true);
    p.focusRow.hidden = true; eng.release();
    check('release shows the follower again (it is not hidden by the layout\'s rule any more) and restores the whole tree', fs.hidden === false && dump(p.doc.documentElement) === before);
    check('after release the stepper is inside #net-focus-row again and a UI tick does nothing to it', fs.parentNode.parentNode === p.focusRow && (p.win.uiSync(), fs.hidden === false));
    // round trips
    const q = netzPage(), eq = ph(q); CHIPS.createChips(q.doc, q.win); const d0 = (() => { const z = netzPage(); CHIPS.createChips(z.doc, z.win); return dump(z.doc.documentElement); })(); eq.start();
    ['form', 'farbe', 'netz', 'form', 'netz', 'farbe'].forEach(t => { q.doc.documentElement.setAttribute('data-tab', t); q.doc.dispatch('tabchange', { detail: { tab: t } }); });
    check('Netz -> Form -> Farbe -> Netz round trips: every tab applies in turn, one element per id and no id twice', eq.state().applied === 'farbe' && (() => { const ids2 = q.doc.all().map(n => n.id).filter(Boolean); return new Set(ids2).size === ids2.length; })());
    eq.release();
    check('...and a release at the end leaves the tree as it was (no marker, no container, no hidden follower)', dump(q.doc.documentElement) === d0);
});
T('netz-wide', () => {
    const p = netzPage(); p.mq.matches = false; const eng = ph(p), d = dump(p.doc.documentElement); eng.start();
    check('at 768px and up (the media query does not match) the Netz tab is NOT converted: the tree is untouched, no class ph', dump(p.doc.documentElement) === d && !p.doc.documentElement.classList.contains('ph') && eng.state().applied === null);
    p.mq.set(true);
    check('...and turning narrow applies it; widening again releases every control', p.doc.documentElement.classList.contains('ph') && (p.mq.set(false), dump(p.doc.documentElement) === d));
});
T('overlay-options', () => {
    // the two options and the resize rule added to UI.overlay in 1b, on a plain trigger / panel pair (nothing of the phone engine)
    const p = buildPage({ ui: true }), UI = p.win.UI, mk = (tag, id) => { const n = p.doc.createElement(tag); n.setAttribute('id', id); p.doc.body.appendChild(n); return n; };
    const t1 = mk('button', 't1'), p1 = mk('div', 'p1'), b1 = p1.appendChild(p.doc.createElement('button')), calls = [];
    const o1 = UI.overlay(t1, p1, { onClose: rf => calls.push(rf) });
    t1.dispatch('click');
    check('default: a click on the trigger opens (toggleOnClick not given = as before 1b), and opens again closes', o1.isOpen === true && (t1.dispatch('click'), o1.isOpen === false));
    check('onClose(returnFocus) runs after every close: true for Escape / the trigger, false for a tap outside and for close(false)', (() => { calls.length = 0; o1.open(); esc(p1); o1.open(); p.doc.dispatch('pointerdown', { target: p.doc.body }); o1.open(); o1.close(false); return calls.join() === 'true,false,false'; })(), calls.join());
    const t2 = mk('button', 't2'), p2 = mk('div', 'p2'), o2 = UI.overlay(t2, p2, { toggleOnClick: false });
    t2.dispatch('click');
    check('toggleOnClick: false - the trigger\'s click does not open it (the owner does), open() and close() still work', o2.isOpen === false && (o2.open(), o2.isOpen === true) && (o2.close(false), o2.isOpen === false));
    // the Tab loop: every control Tab can reach is in it (a number field after the last button too), hidden ones are not, and only the ends wrap
    const t4 = mk('button', 't4'), p4 = mk('div', 'p4'), mkIn = (tag, id, type) => { const n = p.doc.createElement(tag); if (id) n.setAttribute('id', id); if (type) n.setAttribute('type', type); p4.appendChild(n); return n; };
    const a4 = mkIn('button', 'a4'), n4 = mkIn('input', 'n4', 'number'), b4 = mkIn('button', 'b4'), c4 = mkIn('input', 'c4', 'number'), z4 = mkIn('button', 'z4'); z4.hidden = true;
    const o4 = UI.overlay(t4, p4); o4.open();
    const tab = (from, shift) => { from.focus(); let prevented = 0; p4.dispatch('keydown', { key: 'Tab', shiftKey: !!shift, preventDefault() { prevented++; } }); return { prevented, active: p.doc.activeElement }; };
    const r1 = tab(c4), r2 = tab(a4, true), r3 = tab(b4), r4 = tab(n4, true);
    check('Tab on the LAST control of the panel wraps to the first, Shift+Tab on the first wraps to the last: here the last is a number field after the last button, and a hidden button after it is ignored', r1.prevented === 1 && r1.active === a4 && r2.prevented === 1 && r2.active === c4, r1.active.id + ' / ' + r2.active.id);
    check('...and a Tab in the middle is left to the browser (not prevented), also from a number field', r3.prevented === 0 && r4.prevented === 0);
    // a tab change (the Back button, a hash edit: no tap) closes the open overlay and its onClose runs: no stuck scrim over the next tab
    const t5 = mk('button', 't5'), p5 = mk('div', 'p5'), cl5 = []; const o5 = UI.overlay(t5, p5, { onClose: rf => cl5.push(rf) });
    o5.open(); p.doc.dispatch('tabchange', { detail: { tab: 'nirgends' } });
    check('a tabchange (nav.js) closes the open overlay (scrim hidden, onClose(false)); with none open it does nothing', o5.isOpen === false && p.scrim.hidden === true && cl5.join() === 'false' && (p.doc.dispatch('tabchange', {}), cl5.length === 1));
    const t3 = mk('button', 't3'), p3 = mk('div', 'p3'), f3 = p3.appendChild(p.doc.createElement('input')), b3 = p3.appendChild(p.doc.createElement('button')), o3 = UI.overlay(t3, p3);
    o3.open(); f3.focus(); p.win.dispatch('resize');
    check('a resize with the focus in a text field of the panel keeps it open; with the focus on a button it closes', o3.isOpen === true && (b3.focus(), p.win.dispatch('resize'), o3.isOpen === false));
    const cb = p3.appendChild(p.doc.createElement('input')); cb.setAttribute('type', 'checkbox'); cb.type = 'checkbox'; o3.open(); cb.focus(); p.win.dispatch('resize');
    check('...a checkbox or range is not "typing": a resize closes it then as well', o3.isOpen === false);
});

console.log('\n== the engine knows no control ==');
T('source', () => {
    const src = fs.readFileSync(process.env.UI_PHONE_JS || path.join(ROOT, 'ui-phone.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const html = fs.readFileSync(process.env.INDEX_HTML || path.join(ROOT, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const htmlIds = []; html.replace(/\bid="([^"]+)"/g, (m, id) => { htmlIds.push(id); return m; });
    const named = htmlIds.filter(id => id.length > 3 && !/^ph-/.test(id) && new RegExp("['\"]" + id + "['\"]").test(src));
    check('ui-phone.js names no id of index.html (only its own ph- ids); every control comes from the config', named.length === 0, named.join(', ') || 'none');
    check('it never clones: no cloneNode, innerHTML, outerHTML or insertAdjacentHTML', !/cloneNode|innerHTML|outerHTML|insertAdjacentHTML/.test(src));
    check('it never builds markup from strings: nodes come from createElement and createComment', /createElement/.test(src) && /createComment/.test(src));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
