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
const API = require(process.env.PHONE_CONFIG_JS || path.join(ROOT, 'ui-phone-config.js'));
const { config } = API;

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 400)); } };

// ---- a small fake DOM -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
class Node_ {
    constructor(doc, type, tag) { this.doc = doc; this.nodeType = type; this.tagName = tag ? tag.toUpperCase() : ''; this.childNodes = []; this.parentNode = null; this.attrs = {}; this.handlers = {}; this.hidden = false; this.readOnly = false; this.text = ''; this.clicks = 0; this.dataset = {}; }
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
    setAttribute(k, v) { this.attrs[k] = String(v); if (/^data-/.test(k)) this.dataset[k.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } removeAttribute(k) { delete this.attrs[k]; } hasAttribute(k) { return k in this.attrs; }
    addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
    dispatchEvent(e) { this.dispatch(e.type, e); return true; }
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
    const layerPanel = el('div', { id: 'layer-more-panel' }, [btn('layer-align', 'layer-btn'), el('input', { id: 'layer-loose-field', type: 'number' })]); layerPanel.hidden = true;
    // the ten control groups of the layer block (the real ids; every group starts hidden like on the page until sketch.js shows it for a layer); each holds a label (display: none on the page) and its control
    const lg = (id, kids) => { const g = el('div', { id, class: 'control-group' }, [el('label', {}, [])].concat(kids)); g.hidden = true; return g; };
    const layerGroups = [lg('layer-shape-group', [el('div', { class: 'icon-row' }, ['triangle', 'square', 'hex'].map(k => { const b2 = btn(null, 'layer-shape-icon-btn icon-btn'); b2.setAttribute('data-shape', k); return b2; }))]),
        lg('layer-node-count-group', [el('div', { class: 'stepper' }, [el('input', { id: 'layer-node-count-input', type: 'number' }), btn(null, 'stepper-btn'), btn(null, 'stepper-btn')])]),
        lg('layer-shape-size-group', [el('div', { class: 'stepper' }, [el('input', { id: 'layer-shape-size-input', type: 'number' }), btn(null, 'stepper-btn'), btn(null, 'stepper-btn')])]),
        lg('layer-mode-group', [el('div', { class: 'icon-row' }, ['none', 'spiegeling', 'drehling'].map(k => { const b2 = btn(null, 'layer-mode-btn icon-btn'); b2.setAttribute('data-mode', k); return b2; }))]),
        lg('layer-fold-group', [el('div', { class: 'icon-row' }, [btn(null, 'layer-fold-btn layer-btn icon-btn'), btn(null, 'layer-fold-btn layer-btn icon-btn')])]),
        lg('layer-align-group', [btn('btn-align-to-base', 'layer-btn icon-btn')]),
        lg('layer-offset-x-group', [el('input', { id: 'layer-offset-x-input', type: 'number' })]),
        lg('layer-offset-y-group', [el('input', { id: 'layer-offset-y-input', type: 'number' })]),
        lg('layer-mesh-preset-group', [el('div', { class: 'icon-row' }, [btn('btn-mesh-preset-x', 'layer-btn icon-btn'), btn('btn-mesh-preset-y', 'layer-btn icon-btn')])]),
        lg('layer-rotation-group', [el('input', { id: 'layer-rotation-input', type: 'number' })])];
    layerGroups.forEach(g => layerPanel.appendChild(g));
    const tlPairing = el('div', { id: 'timeline-pairing', class: 'timeline-pairing' }, [el('select', { id: 'timeline-pairing-segment' }, []), el('div', { id: 'timeline-pairing-list' }, []), btn('btn-timeline-pairing-reset', 'layer-btn'), btn('btn-timeline-pairing-browse', 'layer-btn'), el('div', { id: 'timeline-pairing-browser' }, [el('select', { id: 'timeline-pairing-sort' }, []), el('input', { id: 'timeline-pairing-filter', type: 'number' }), el('div', { id: 'timeline-pairing-browser-count' }, []), el('div', { id: 'timeline-pairing-browser-list' }, [])])]); tlPairing.hidden = true;
    const tlGroup = el('div', { id: 'timeline-group', class: 'control-group' }, [btn('btn-clear-timeline', 'layer-btn'), el('div', { id: 'timeline-keyframe-list', class: 'icon-row' }, []), el('div', { id: 'timeline-net-state' }, []), tlPairing, el('span', { id: 'timeline-status' }, [])]);
    // what ui-phone-timeline.js and ui-phone-pairing.js make at load: the icon row, the readout and the pairing view's four containers, in a hidden holder
    const tlHome = el('div', { id: 'ph-tl-home' }, [el('div', { id: 'ph-tl-icons' }, [btn('ph-tl-netrec', 'icon-btn ph-tl-btn'), btn('ph-tl-pairing', 'icon-btn ph-tl-btn'), btn('ph-tl-trash', 'icon-btn ph-tl-btn')]), el('p', { id: 'ph-tl-readout' }, []), el('div', { id: 'ph-tl-chips' }, []), el('div', { id: 'ph-tl-moves' }, []), el('div', { id: 'ph-tl-variant' }, []), btn('ph-tl-listbtn', 'icon-btn ph-tl-btn'), btn('ph-tl-reset', 'icon-btn ph-tl-btn'), el('div', { id: 'ph-tl-listhead' }, []), el('div', { id: 'ph-tl-list' }, [])]); tlHome.hidden = true;
    const settings = ['curve-fold-group', 'curve-strength-group', 'free-roughness-group', 'free-controls-group'].map(id => { const g = el('div', { id, class: 'control-group' }, [el('input', { type: 'range' })]); g.hidden = true; return g; });
    const faceList = el('div', { id: 'face-colors-list' }), faceGroup = el('div', { id: 'face-colors-group', class: 'control-group' }, [faceList]); faceGroup.hidden = true;
    body.appendChild(el('div', { class: 'main-container' }, [el('div', { class: 'controls-container' }, [btn('btn-leftover', 'layer-btn')].concat(settings, [tlGroup, layerPanel, faceGroup]))]));
    body.appendChild(tlHome);
    // the Netz sheet (#more-netz): the net group sketch.js shows for the square on the base. The axes row, the Fokus stepper (inside #net-focus-row, which sketch.js shows for Sin and Tan), Net lines and Reverse
    // (inside #net-geo-row) are the pieces the phone layout moves out; the exact field stays
    const focusRow = el('div', { id: 'net-focus-row' }, [el('h3', {}, []), el('div', {}, [el('div', { id: 'net-focus-stepper', class: 'stepper' }, [el('span', { id: 'net-focus-value', class: 'stepper-display' }), btn(null, 'stepper-btn'), btn(null, 'stepper-btn')]), el('input', { id: 'net-focus-exact', type: 'number' })])]); focusRow.hidden = true;
    const geoRow = el('div', { id: 'net-geo-row', class: 'icon-row' }, [btn('net-reverse-btn', 'layer-btn'), btn('net-alternate-btn', 'layer-btn')]); geoRow.hidden = true;
    const axes = el('div', { id: 'net-axes-row', class: 'icon-row' }, ['both', 'x', 'y'].map(k => { const b = btn(null, 'layer-btn net-axes-btn'); b.setAttribute('data-axes', k); return b; }));
    const domainRow = el('div', { id: 'net-domain-row', class: 'icon-row' }, [['net-domain-single', 'single'], ['net-domain-tiled', 'tiled'], ['net-field-btn', 'field']].map(x => { const b = btn(x[0], 'layer-btn net-domain-btn'); b.setAttribute('data-domain', x[1]); return b; }));
    const macroRow = el('div', { id: 'net-macro-row' }, [el('label', {}, []), el('div', { id: 'net-macro-buttons', class: 'icon-row' }, [])]); macroRow.hidden = true;
    const netGroup = el('div', { id: 'net-group', class: 'control-group' }, [axes, focusRow, el('div', { id: 'net-focus-hint' }, []), macroRow, domainRow, el('div', { class: 'icon-row' }, [btn('net-lines-btn', 'layer-btn')]), geoRow]);
    const moreNetz = el('div', { id: 'more-netz', class: 'overlay overlay-wide' }, [el('input', { id: 'net-strength-exact', type: 'number' }), netGroup, el('p', { id: 'net-readout', class: 'net-readout' }, [])]); moreNetz.hidden = true; body.appendChild(moreNetz);
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
        Object.assign(win, { window: win, document: doc, console, Event: class { constructor(t, o) { this.type = t; this.bubbles = !!(o && o.bubbles); } }, MutationObserver: class { constructor(cb) { (win.observers = win.observers || []).push(cb); } observe(el, o) { (win.observed = win.observed || []).push({ el, o }); } disconnect() { win.disconnected = (win.disconnected || 0) + 1; } }, performance: { now: () => 0 }, setTimeout, clearTimeout });
        vm.runInContext(fs.readFileSync(process.env.UI_JS || path.join(ROOT, 'ui.js'), 'utf8'), win, { filename: 'ui.js' });
    }
    return { doc, win, mq, calls, scrim, layerModel, layerPanel, tlGroup, tlPairing, tlHome, faceList, faceGroup, focusRow, geoRow, moreNetz, macroRow, domainRow };
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
    check('apply makes two sheet hosts inside the stack, hidden, role dialog, named: ph-sheet-layer "Ebenen-Einstellungen" and ph-sheet-timeline "Zeitleiste: Mehr", class overlay ph-sheet (the layer sheet also ph-sheet-rows: it has blocks)', !!host && !!tl && host.parentNode.id === 'ph-stack' && tl.parentNode.id === 'ph-stack' && host.hidden && tl.hidden && host.getAttribute('role') === 'dialog' && tl.getAttribute('role') === 'dialog' && host.getAttribute('aria-label') === 'Ebenen-Einstellungen' && tl.getAttribute('aria-label') === 'Zeitleiste: Mehr' && host.className === 'overlay ph-sheet ph-sheet-rows' && tl.className === 'overlay ph-sheet ph-sheet-rows', host && host.className);
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
    const field = p.doc.getElementById('layer-loose-field'); field.focus();
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
    check('Art: row 1 = the four kind buttons (the radiogroup wrapper, moved whole); row 2 = the strength stepper, the panel\'s own More, Reverse LAST (More keeps its place whether or not sketch.js shows Reverse)', rowsOf(pane('art')) === 'nav-kinds / net-strength-stepper+btn-more-netz+net-reverse-btn' && orig['nav-kinds'].children.length === 4 && orig['nav-kinds'].children.every(b => b.getAttribute('role') === 'radio'), rowsOf(pane('art')));
    check('Achsen: row 1 = Both / X / Y (the axes row), row 2 = the Fokus stepper alone; the exact fields are in the Netz sheet (its first row, wrapped into steppers since 4b)', rowsOf(pane('achsen')) === 'net-axes-row / net-focus-stepper' && p.doc.getElementById('net-focus-exact').parentNode.parentNode.className === 'ph-sheet-row' && p.doc.getElementById('net-strength-exact').parentNode.parentNode === p.doc.getElementById('net-focus-exact').parentNode.parentNode && p.moreNetz.contains(p.doc.getElementById('net-strength-exact')) && p.doc.getElementById('net-geo-row').children.map(c => c.id).join() === 'net-alternate-btn');
    const sheet = p.doc.getElementById('more-rail');
    check('the rail\'s sheet keeps its first row (Curve ... Neu anfangen) and gets the second: Random, the catalog link, Info, Download, Clear, then the Curve / Free settings groups; More keeps its own name', sheet.children.map(c => c.id || c.className).join() === 'more-row,more-row more-extra,more-settings,more-name' && sheet.children[1].children.map(c => c.id).join() === 'btn-random,btn-gallery,btn-info,btn-save,btn-clear' && !config.toolRows.netz.sheet.openerLabel);
    // follow (mode 'disable'): the Fokus stepper stays SHOWN and is aria-disabled with the reason while sketch.js hides #net-focus-row (Aus, Geo)
    const fs = p.doc.getElementById('net-focus-stepper'), REASON = 'Fokus gilt für Sin und Tan';
    check('the Fokus stepper is shown (not hidden) and disabled with the reason while sketch.js hides #net-focus-row (Aus, Geo): aria-disabled, data-reason and title say it - at apply', fs.hidden === false && fs.getAttribute('aria-disabled') === 'true' && fs.dataset.reason === REASON && fs.getAttribute('title') === REASON, fs.getAttribute('aria-disabled') + ' / ' + fs.dataset.reason);
    p.focusRow.hidden = false; p.win.uiSync();
    check('...and enabled again when sketch.js shows the row (Sin, Tan): on the next UI tick no aria-disabled, no reason, no title left', fs.hidden === false && fs.getAttribute('aria-disabled') === null && fs.dataset.reason === undefined && fs.getAttribute('title') === null);
    p.focusRow.hidden = true; p.win.uiSync();
    check('...and disabled again with it', fs.getAttribute('aria-disabled') === 'true' && fs.dataset.reason === REASON && fs.hidden === false);
    p.win.uiSync(); p.win.uiSync();
    check('a UI tick with nothing changed does nothing more (the same state, one title)', fs.getAttribute('aria-disabled') === 'true' && fs.getAttribute('title') === REASON);
    // labels: Net lines is an icon in the tool row, its name comes from the config
    const nl = p.doc.getElementById('net-lines-btn'), LAB = config.toolRows.netz.labels['net-lines-btn'];
    check('Net lines has the name "Netzlinien zeigen" (aria-label and title, data-i18n key) while the Netz tool row is on - the config\'s label, nothing hard-coded', LAB.text === 'Netzlinien zeigen' && nl.getAttribute('aria-label') === LAB.text && nl.getAttribute('title') === LAB.text && nl.getAttribute('data-i18n') === LAB.i18n);
    p.focusRow.hidden = true; eng.release();
    check('release enables the follower again and restores the whole tree', fs.hidden === false && fs.getAttribute('aria-disabled') === null && dump(p.doc.documentElement) === before);
    check('...the stepper has no title, no reason and no aria-disabled left (it had none), and Net lines has no aria-label, no title and no data-i18n (it had none)', fs.getAttribute('title') === null && fs.dataset.reason === undefined && nl.getAttribute('aria-label') === null && nl.getAttribute('title') === null && nl.getAttribute('data-i18n') === null);
    check('after release the stepper is inside #net-focus-row again and a UI tick does nothing to it', fs.parentNode.parentNode === p.focusRow && (p.win.uiSync(), fs.hidden === false && fs.getAttribute('aria-disabled') === null));
    // the name and title a control HAD are put back, not just removed
    const r = netzPage(), er = ph(r), nr = r.doc.getElementById('net-lines-btn'), fr = r.doc.getElementById('net-focus-stepper');
    nr.setAttribute('title', 'Draw the net\'s own grid lines'); nr.setAttribute('aria-label', 'Net lines'); nr.setAttribute('data-i18n', 'netz.lines.old'); fr.setAttribute('title', 'Fokus');
    er.start();
    check('a control that already had a name / a title: the layout\'s label replaces them while it is on; the stepper\'s own title is kept for later', nr.getAttribute('title') === 'Netzlinien zeigen' && nr.getAttribute('aria-label') === 'Netzlinien zeigen' && fr.dataset.baseTitle === 'Fokus' && fr.getAttribute('title') === REASON);
    er.release();
    check('...release puts back the original title, aria-label and data-i18n of Net lines and the stepper\'s own title', nr.getAttribute('title') === 'Draw the net\'s own grid lines' && nr.getAttribute('aria-label') === 'Net lines' && nr.getAttribute('data-i18n') === 'netz.lines.old' && fr.getAttribute('title') === 'Fokus' && fr.getAttribute('aria-disabled') === null);
    // the other follow mode (a string = 'hide') still copies the hidden state
    const h = netzPage(), cfgH = JSON.parse(JSON.stringify(config)); cfgH.follow = { 'net-focus-stepper': 'net-focus-row' };
    const eh = ph(h, cfgH), fh = h.doc.getElementById('net-focus-stepper'); eh.start();
    check('mode "hide" (a plain string) is unchanged: the follower is hidden with its block, shown with it, and not disabled', fh.hidden === true && fh.getAttribute('aria-disabled') === null && (h.focusRow.hidden = false, h.win.uiSync(), fh.hidden === false) && (h.focusRow.hidden = true, h.win.uiSync(), fh.hidden === true));
    eh.release();
    check('...and release shows it again', fh.hidden === false);
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
    // commit 3b: at 768px and up nothing of the follow mode or the label is applied: the Fokus stepper is not disabled (its block is hidden, nothing marks it), Net lines keeps its own text as its name
    const q = netzPage(); q.mq.matches = false; const eq = ph(q); eq.start();
    const fq = q.doc.getElementById('net-focus-stepper'), nq = q.doc.getElementById('net-lines-btn');
    q.win.uiSync(); q.win.uiSync();
    check('at 768px and up the Fokus stepper is never disabled (not even with its row hidden, and across UI ticks) and Net lines gets no aria-label, title or data-i18n from the layout', fq.getAttribute('aria-disabled') === null && fq.getAttribute('title') === null && fq.dataset.reason === undefined && fq.hidden === false && nq.getAttribute('aria-label') === null && nq.getAttribute('title') === null && nq.getAttribute('data-i18n') === null);
    q.mq.set(true); q.mq.set(false); q.win.uiSync();
    check('...also after a narrow phase and back: nothing is left behind', fq.getAttribute('aria-disabled') === null && fq.getAttribute('title') === null && nq.getAttribute('aria-label') === null && nq.getAttribute('title') === null && nq.getAttribute('data-i18n') === null);
    // another tab (Form) while the config has the follow / label: the Fokus stepper is not moved and not touched
    const f2 = buildPage({ ui: true }), e2 = ph(f2); e2.start(); f2.win.uiSync();
    check('in the Form tab (nothing of Netz is moved) the Fokus stepper and Net lines are untouched', f2.doc.getElementById('net-focus-stepper').getAttribute('aria-disabled') === null && f2.doc.getElementById('net-lines-btn').getAttribute('aria-label') === null);
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
    // commit 4: a notice lies over an open sheet under the phone layout; a tap on it (its close button, its text) is not a tap outside the sheet
    const t6 = mk('button', 't6'), p6 = mk('div', 'p6'), o6 = UI.overlay(t6, p6, {}), noticeBox = p.doc.createElement('div'), noticeBtn = noticeBox.appendChild(p.doc.createElement('button')), elsewhere = mk('div', 'elsewhere');
    noticeBox.className = 'notice notice-warn'; p.doc.body.appendChild(noticeBox);
    o6.open(); p.doc.dispatch('pointerdown', { target: noticeBtn });
    const keptByNotice = o6.isOpen;
    p.doc.dispatch('pointerdown', { target: noticeBox });
    const keptByText = o6.isOpen;
    p.doc.dispatch('pointerdown', { target: elsewhere });
    check('a pointerdown on a notice (its close button or its text) does NOT close an open overlay; one on any other element outside still does', keptByNotice === true && keptByText === true && o6.isOpen === false);
    // commit 4: html.overlay-open while an overlay is open (the phone CSS moves the notices to the top of the canvas then)
    const root = p.doc.documentElement, t7 = mk('button', 't7'), p7 = mk('div', 'p7'), t8 = mk('button', 't8'), p8 = mk('div', 'p8'), o7 = UI.overlay(t7, p7, {}), o8 = UI.overlay(t8, p8, {});
    const had = root.classList.contains('overlay-open');
    o7.open(); const onOpen = root.classList.contains('overlay-open');
    o8.open(); const onSwitch = root.classList.contains('overlay-open');   // one overlay replaces the other: still open
    o8.close(false); const afterClose = root.classList.contains('overlay-open');
    o7.open(); p.doc.dispatch('tabchange', { detail: { tab: 'nirgends' } }); const afterTab = root.classList.contains('overlay-open');
    check('UI.overlay puts the class overlay-open on <html> while an overlay is open: on at open, still on when another overlay replaces it, off when it closes (also through a tab change); never on while none is open', had === false && onOpen === true && onSwitch === true && afterClose === false && afterTab === false);
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


console.log('\n== the layer sheet in rows (sheets redesign, commit 3a): config.sheets.layer.blocks, with the REAL ui.js ==');
const LAYER_BLOCKS = config.sheets.layer.blocks;
const blockIds = LAYER_BLOCKS.map(rows => rows.map(r => r.items.map(i => i.id)));
const rowsOf = host => host.querySelectorAll('.ph-sheet-block').map(b => b.children.map(r => r.children.map(g => g.id)));
const showGroups = (p, ids, on) => { ids.forEach(id => { p.doc.getElementById(id).hidden = !on; }); p.win.uiSync(); };
const allGroupIds = [].concat.apply([], [].concat.apply([], blockIds));
T('rows-build', () => {
    const { p, host } = sheetPage();
    const orig = {}; allGroupIds.forEach(id => { orig[id] = p.doc.getElementById(id); });
    check('the config has two blocks: block 1 = shape + mode, node + size, fold; block 2 = offset X + offset Y + align, mesh + rotation (ten groups, each once)', blockIds.length === 2 && JSON.stringify(blockIds) === JSON.stringify([[['layer-shape-group', 'layer-mode-group'], ['layer-node-count-group', 'layer-shape-size-group'], ['layer-fold-group']], [['layer-offset-x-group', 'layer-offset-y-group', 'layer-align-group'], ['layer-mesh-preset-group', 'layer-rotation-group']]]) && new Set(allGroupIds).size === 10);
    check('the sheet host gets the class ph-sheet-rows; the content wrapper (#layer-more-panel) holds exactly two .ph-sheet-block, each holding its .ph-sheet-row elements, in the config order', host.classList.contains('ph-sheet-rows') && JSON.stringify(rowsOf(host)) === JSON.stringify(blockIds) && p.layerPanel.children.filter(c => c.className === 'ph-sheet-block').length === 2, JSON.stringify(rowsOf(host)));
    check('the groups are the SAME node objects (moved, not cloned), one element per id, no id twice in the document', allGroupIds.every(id => p.doc.getElementById(id) === orig[id] && p.doc.all().filter(n => n.id === id).length === 1) && (() => { const ids2 = p.doc.all().map(n => n.id).filter(Boolean); return new Set(ids2).size === ids2.length; })());
    check('the first row of block 1 is the layer sheet\'s wrap row (class ph-sheet-row-wrap); the only other wrap row is the timeline sheet\'s pairing row (5b)', p.doc.all().filter(n => /\bph-sheet-row-wrap\b/.test(n.className)).length === 2 && host.querySelectorAll('.ph-sheet-row')[0].className === 'ph-sheet-row ph-sheet-row-wrap' && p.doc.getElementById('ph-sheet-timeline').querySelectorAll('.ph-sheet-row-wrap').length === 1);
    check('the leftover wrapper holds no group any more but the rows (the groups are in rows: the old wrapper keeps only its first two original children and the blocks)', p.layerPanel.children.every(c => c.className === 'ph-sheet-block' || !/^layer-.*-group$/.test(c.id)));
    check('the groups\' own hidden state is untouched by the engine (still hidden: sketch.js shows them for a layer)', allGroupIds.every(id => orig[id].hidden === true));
    check('with every group hidden every row and every block is hidden: no empty row, no gap (the base is active)', host.querySelectorAll('.ph-sheet-row').every(r => r.hidden === true) && host.querySelectorAll('.ph-sheet-block').every(b => b.hidden === true));
});
T('rows-collapse', () => {
    const { p, host } = sheetPage();
    const rows = () => host.querySelectorAll('.ph-sheet-row'), blocks = () => host.querySelectorAll('.ph-sheet-block');
    const state = () => rows().map(r => r.hidden ? 'h' : 's').join('') + '/' + blocks().map(b => b.hidden ? 'h' : 's').join('');
    // a layer is active: sketch.js shows every group but the fold group (a hexagon layer shows it)
    showGroups(p, allGroupIds.filter(id => id !== 'layer-fold-group'), true);
    check('a layer (not a hexagon): every row shows but the fold row (row 3 of block 1 collapses), both blocks show', state() === 'sshss/ss', state());
    showGroups(p, ['layer-fold-group'], true);
    check('a hexagon layer: the fold row shows too', state() === 'sssss/ss', state());
    showGroups(p, ['layer-fold-group'], false);
    check('...and collapses again when sketch.js hides the fold group', state() === 'sshss/ss', state());
    showGroups(p, ['layer-offset-x-group', 'layer-offset-y-group'], false);
    check('a row with some groups hidden stays (offset X / Y hidden, Align still shown: row 1 of block 2 shows)', rows()[3].hidden === false && blocks()[1].hidden === false, state());
    showGroups(p, ['layer-align-group'], false);
    check('a row whose groups are ALL hidden is hidden (row 1 of block 2), its block stays while another row shows', rows()[3].hidden === true && rows()[4].hidden === false && blocks()[1].hidden === false, state());
    showGroups(p, allGroupIds, false);
    check('the base becomes active (sketch.js hides every group): every row and both blocks are hidden at once', rows().every(r => r.hidden) && blocks().every(b => b.hidden), state());
    // the MutationObserver path: where the page has one, a change of `hidden` re-reads the rows without a UI tick
    p.doc.getElementById('layer-shape-group').hidden = false; (p.win.observers || []).forEach(cb => cb());
    check('a MutationObserver callback re-reads the rows without a UI tick', rows()[0].hidden === false && blocks()[0].hidden === false);
});
T('rows-release', () => {
    const p0 = buildPage({ ui: true }), before = dump(p0.doc.documentElement);
    const p = buildPage({ ui: true }), orig = {}; allGroupIds.forEach(id => { orig[id] = p.doc.getElementById(id); });
    const nb = {}; allGroupIds.forEach(id => { nb[id] = [orig[id].parentNode, orig[id].previousSibling, orig[id].nextSibling]; });
    const eng = ph(p); eng.start(); eng.show('ebenen');
    const host0 = p.doc.getElementById('ph-sheet-layer');
    showGroups(p, allGroupIds, true);
    p.doc.getElementById('ls-more').dispatch('click');   // the sheet is open
    eng.release();
    check('release (the sheet open): every group is back with the same parent and the same neighbours', allGroupIds.every(id => orig[id].parentNode === nb[id][0] && orig[id].previousSibling === nb[id][1] && orig[id].nextSibling === nb[id][2]));
    check('...no .ph-sheet-block and no .ph-sheet-row is left, no marker comment, no host', p.doc.all().filter(n => /ph-sheet-(block|row)/.test(n.className)).length === 0 && !p.doc.getElementById('ph-sheet-layer') && (function none(n) { return n.childNodes.every(c => (c.nodeType !== 8 || !/^ph:/.test(c.text)) && (c.nodeType !== 1 || none(c))); })(p.doc.documentElement));
    check('...the sheet host (kept for the next apply) no longer has the class ph-sheet-rows', !host0.classList.contains('ph-sheet-rows'));
    check('...the row observer is disconnected (nothing watches the groups any more)', (p.win.disconnected || 0) >= 1, String(p.win.disconnected));
    check('...every group keeps the hidden state sketch.js gave it (shown), none is hidden by the engine', allGroupIds.every(id => orig[id].hidden === false));
    showGroups(p, allGroupIds, false);
    check('and the page is the tree it was (groups hidden again as at the start)', dump(p.doc.documentElement).replace(/\[hidden\]/g, '') === before.replace(/\[hidden\]/g, '') && allGroupIds.every(id => p.doc.all().filter(n => n.id === id).length === 1));
    eng.release();
    check('release is idempotent (a second release does nothing)', (() => { const m = p.doc.mutations; eng.release(); return p.doc.mutations === m; })());
    // apply again after a release: the same rows are rebuilt, the handlers still fire once
    eng.apply('form'); eng.show('ebenen');
    check('apply after release builds the rows again (two blocks, five rows) and every group is once in the document', JSON.stringify(rowsOf(p.doc.getElementById('ph-sheet-layer'))) === JSON.stringify(blockIds) && allGroupIds.every(id => p.doc.all().filter(n => n.id === id).length === 1));
    check('...and a second apply(form) while it is on does no work', (() => { const m = p.doc.mutations; eng.apply('form'); return p.doc.mutations === m; })());
    eng.release();
});


console.log('\n== the layer sheet steppers (sheets redesign, commit 3b): config.sheets.layer.steppers, with the REAL ui.js ==');
const SPEC = config.sheets.layer.steppers;
const SIDS = ['layer-offset-x-input', 'layer-offset-y-input', 'layer-rotation-input'];
// the handler counts of an element: what a plain input must have again after release
const hcount = n => Object.keys(n.handlers).sort().map(k => k + ':' + n.handlers[k].length).join(',');
const click0 = b => b.dispatch('click', { detail: 0 });   // a keyboard activation: steps once
const chev = (p, id, dir) => p.doc.getElementById(id).parentNode.querySelectorAll('.stepper-btn').find(b => b.getAttribute('data-dir') === String(dir));
T('steppers-decorate', () => {
    const p0 = buildPage({ ui: true }), orig = {}, before = {}; SIDS.forEach(id => { orig[id] = p0.doc.getElementById(id); before[id] = [orig[id].parentNode, orig[id].previousSibling, orig[id].nextSibling, hcount(orig[id]), orig[id].readOnly, orig[id].getAttribute('inputmode'), dump(orig[id])]; });
    const eng = ph(p0); eng.start(); eng.show('ebenen');
    check('the three inputs are the SAME node objects, each in a .stepper (role group, named in German) inside its own control group; one element per id, no id twice', SIDS.every(id => { const n = p0.doc.getElementById(id); return n === orig[id] && n.parentNode.className === 'stepper' && n.parentNode.getAttribute('role') === 'group' && /^layer-(offset-[xy]|rotation)-group$/.test(n.parentNode.parentNode.id) && p0.doc.all().filter(x => x.id === id).length === 1; }) && (() => { const ids2 = p0.doc.all().map(n => n.id).filter(Boolean); return new Set(ids2).size === ids2.length; })());
    check('the stepper is the Form row\'s markup: an icon (svg, aria-hidden), the input, then .stepper-chevrons with an up (data-dir 1) and a down (data-dir -1) button, each with an svg; the names are German: Versatz X (mehr / weniger), Versatz Y, Drehung', SIDS.every(id => { const r = p0.doc.getElementById(id).parentNode, k = r.children; return k.length === 3 && k[0].tagName.toLowerCase() === 'svg' && k[0].getAttribute('aria-hidden') === 'true' && k[1] === orig[id] && k[2].className === 'stepper-chevrons' && k[2].children.map(b => b.getAttribute('data-dir')).join() === '1,-1' && k[2].children.every(b => b.children[0].tagName.toLowerCase() === 'svg' && b.getAttribute('title') === b.getAttribute('aria-label')); }) && p0.doc.getElementById('layer-offset-x-input').parentNode.getAttribute('aria-label') === 'Versatz X' && chev(p0, 'layer-offset-y-input', 1).getAttribute('aria-label') === 'Versatz Y mehr' && chev(p0, 'layer-rotation-input', -1).getAttribute('aria-label') === 'Drehung weniger');
    check('no typing: every input is readOnly with inputmode="none" while the layout is on (no soft keyboard, the field is the display)', SIDS.every(id => orig[id].readOnly === true && orig[id].getAttribute('inputmode') === 'none'));
    check('the icons are the config\'s: arrow right (X), arrow down (Y), rotate (rotation), as stroke paths', SIDS.every(id => { const svg = orig[id].parentNode.children[0]; const d = svg.children.map(x => x.getAttribute('d')); return JSON.stringify(d) === JSON.stringify(config.icons[SPEC[id].icon]); }));
    eng.release();
    check('release UNDOES it: every input is back with the same parent and neighbours, no .stepper wrapper is left in the document, no duplicated id', SIDS.every(id => orig[id].parentNode === before[id][0] && orig[id].previousSibling === before[id][1] && orig[id].nextSibling === before[id][2]) && p0.doc.all().filter(n => n.className === 'stepper' && SIDS.some(id => n.querySelector('#' + id))).length === 0);
    check('...readOnly and inputmode are what they were (not readonly, no inputmode), and the input carries exactly the listeners it had before (none were left on it)', SIDS.every(id => orig[id].readOnly === before[id][4] && orig[id].getAttribute('inputmode') === before[id][5] && hcount(orig[id]) === before[id][3]), SIDS.map(id => hcount(orig[id]) + ' / ' + before[id][3]).join(' | '));
    check('...the input node is as it was (same tree, same attributes)', SIDS.every(id => dump(orig[id]) === before[id][6]));
});
T('steppers-steps', () => {
    const p = buildPage({ ui: true }); const eng = ph(p); eng.start(); eng.show('ebenen');
    const log = []; const inp = id => p.doc.getElementById(id);
    SIDS.forEach(id => ['input', 'change'].forEach(t => inp(id).addEventListener(t, e => log.push(id.replace(/^layer-(offset-)?/, '')[0] + ':' + t + ':' + (e.bubbles ? 'b' : 'n')))));
    const upX = chev(p, 'layer-offset-x-input', 1), dnX = chev(p, 'layer-offset-x-input', -1);
    inp('layer-offset-x-input').value = '0'; click0(upX);
    check('offset X: one step up = +10 ("0" -> "10"); the input event and then the change event, both bubbling, on the existing input', inp('layer-offset-x-input').value === '10' && log.join() === 'x:input:b,x:change:b', inp('layer-offset-x-input').value + ' ' + log.join());
    click0(dnX); click0(dnX); click0(dnX);
    check('offset X goes negative without a limit (10 - 30 = -20)', inp('layer-offset-x-input').value === '-20');
    inp('layer-offset-y-input').value = '0'; click0(chev(p, 'layer-offset-y-input', 1)); click0(chev(p, 'layer-offset-y-input', 1)); click0(chev(p, 'layer-offset-y-input', -1));
    check('offset Y: +10, +10, -10 = 10', inp('layer-offset-y-input').value === '10');
    inp('layer-offset-x-input').value = '103.92304845413264'; click0(upX);
    check('an offset the mesh preset wrote (103.923...) steps to the next whole number (113.92 -> round 0 = 114)', inp('layer-offset-x-input').value === '114', inp('layer-offset-x-input').value);
    const upR = chev(p, 'layer-rotation-input', 1), dnR = chev(p, 'layer-rotation-input', -1);
    inp('layer-rotation-input').value = '345'; click0(upR);
    check('rotation wraps: 345 + 15 = 0 (360 is not a value)', inp('layer-rotation-input').value === '0');
    click0(dnR);
    check('rotation wraps down: 0 - 15 = 345', inp('layer-rotation-input').value === '345');
    inp('layer-rotation-input').value = '350'; click0(upR);
    check('an off-grid rotation wraps by the remainder (350 + 15 = 5)', inp('layer-rotation-input').value === '5');
    check('the chevrons are never disabled (no bound, a wrap): the up and down buttons of the three steppers have no aria-disabled', SIDS.every(id => [1, -1].every(d => chev(p, id, d).getAttribute('aria-disabled') === null)));
    inp('layer-offset-x-input').value = '0'; log.length = 0;
    inp('layer-offset-x-input').parentNode.dispatch('keydown', { key: 'ArrowUp', preventDefault() { } });
    check('a key on the stepper (ArrowUp) steps too, from the wrapper (the key handler is on the wrapper, not on the input)', inp('layer-offset-x-input').value === '10' && !inp('layer-offset-x-input').handlers.keydown, inp('layer-offset-x-input').value);
    // a pointer press steps once at once (and starts the hold); the release stops it
    const before = inp('layer-offset-y-input').value; upX.dispatch('pointerdown', { button: 0 }); upX.dispatch('pointerup', {});
    check('a pointer press on a chevron steps at once (once), and the release ends the hold', inp('layer-offset-x-input').value === '20');
    eng.release();
});
T('steppers-cycles', () => {
    const p = buildPage({ ui: true }); const eng = ph(p); eng.start(); eng.show('ebenen');
    const vis0 = (p.doc.handlers.visibilitychange || []).length, root0 = p.doc.getElementById('layer-offset-x-input').parentNode;
    for (let i = 0; i < 3; i++) { eng.release(); eng.apply('form'); eng.show('ebenen'); }
    const inp = p.doc.getElementById('layer-offset-x-input');
    check('after three release / apply cycles the stepper is the SAME made wrapper (made once: UI.stepper cannot unbind its listeners), the document has no more visibilitychange listeners than after the first apply (' + vis0 + ')', inp.parentNode === root0 && (p.doc.handlers.visibilitychange || []).length === vis0, (p.doc.handlers.visibilitychange || []).length + ' / ' + vis0);
    inp.value = '0'; click0(chev(p, 'layer-offset-x-input', 1));
    check('...and one tap still steps once (no handler was added by a cycle): 0 -> 10', inp.value === '10');
    check('...the input is readonly again after the re-apply (the engine sets it at every apply)', inp.readOnly === true && inp.getAttribute('inputmode') === 'none');
    eng.release(); eng.release();
    check('release twice is harmless (nothing moves the second time) and the plain input is back', (() => { const m = p.doc.mutations; eng.release(); return p.doc.mutations === m; })() && inp.parentNode.id === 'layer-offset-x-group' && inp.readOnly === false);
    // a tab change with the sheet open: the layout is released for a tab that is not covered... every tab is covered, so a width change is the release
    eng.apply('form'); eng.show('ebenen'); p.mq.set(false);
    check('a width change to 768+ (the media query) releases the steppers: plain inputs again', !p.doc.documentElement.classList.contains('ph') && inp.parentNode.id === 'layer-offset-x-group' && inp.readOnly === false && !inp.getAttribute('inputmode'));
    p.mq.set(true);
    check('...and back to a phone width decorates them again', p.doc.documentElement.classList.contains('ph') && inp.parentNode.className === 'stepper' && inp.readOnly === true);
});
T('steppers-no-ui', () => {
    const p = buildPage({ ui: true }); delete p.win.UI.stepper;
    const eng = ph(p); eng.start(); eng.show('ebenen');
    check('WITHOUT UI.stepper the inputs stay plain and typable (the rows still work): no wrapper, not readonly', SIDS.every(id => { const n = p.doc.getElementById(id); return n.parentNode.id.endsWith('-group') && n.readOnly === false; }));
});


console.log('\n== the Netz sheet in rows (sheets redesign, commit 4a): config.overlays.netz, an overlay with its own UI.overlay ==');
const NZ = config.overlays.netz, nzIds = [].concat.apply([], [].concat.apply([], NZ.blocks).map(r => r.items.map(i => i.id)));
const nzRows = p => p.moreNetz.children.filter(c => c.className === 'ph-sheet-block').map(b => b.children.map(r => r.children.map(g => g.id || (g.querySelector('input') || {}).id).join('+')).join(' / '));   // a wrapped field is named by its input
T('netz-rows-build', () => {
    const p = netzPage(), orig = {}; nzIds.forEach(id => { orig[id] = p.doc.getElementById(id); });
    const eng = ph(p); eng.start();
    check('the config lists the Netz overlay for the Netz tab only: two blocks, block 1 = the two exact fields, block 2 = the domain row, the macro row, the Alternate wrapper, the readout (ids ' + nzIds.join(', ') + ')', JSON.stringify(config.tabs.netz.overlays) === '["netz"]' && !config.tabs.form.overlays && !config.tabs.farbe.overlays && NZ.content === 'more-netz' && nzIds.join() === 'net-strength-exact,net-focus-exact,net-domain-row,net-macro-row,net-geo-row,net-readout');
    check('apply puts two blocks into #more-netz itself (the overlay is the host: no new host), rows in the config order, and the overlay gets the class ph-sheet-rows', JSON.stringify(nzRows(p)) === JSON.stringify(['net-strength-exact+net-focus-exact', 'net-domain-row / net-macro-row / net-geo-row / net-readout']) && p.moreNetz.classList.contains('ph-sheet-rows') && !p.doc.getElementById('ph-sheet-netz'), JSON.stringify(nzRows(p)));
    check('the items are the SAME node objects (moved, not cloned), one element per id, no id twice; the readout row has its height (data-h 20)', nzIds.every(id => p.doc.getElementById(id) === orig[id] && p.doc.all().filter(n => n.id === id).length === 1) && p.doc.getElementById('net-readout').parentNode.getAttribute('data-h') === '20' && (() => { const x = p.doc.all().map(n => n.id).filter(Boolean); return new Set(x).size === x.length; })());
    check('the overlay\'s own state is not the engine\'s: #more-netz stays hidden and nothing opened it (its UI.overlay belongs to ui-net.js)', p.moreNetz.hidden === true && p.scrim.hidden === true);
    check('collapse at the start (sketch.js shows neither the macro row nor the Alternate wrapper): their rows are hidden, the exact fields, the domain row and the readout show; both blocks show', (() => { const rows = p.moreNetz.querySelectorAll('.ph-sheet-row'); return rows.map(r => r.hidden ? 'h' : 's').join('') === 'sshhs' && p.moreNetz.querySelectorAll('.ph-sheet-block').every(b => !b.hidden); })());
    const pf = buildPage({ ui: true }), ef = ph(pf); ef.start();
    check('in the Form tab #more-netz is untouched (the sheet is not reachable there): no block, no class on it, the exact fields where they were', pf.moreNetz.querySelectorAll('.ph-sheet-block').length === 0 && !pf.moreNetz.classList.contains('ph-sheet-rows') && pf.doc.getElementById('net-strength-exact').parentNode === pf.moreNetz);
});
T('netz-rows-collapse', () => {
    const p = netzPage(), eng = ph(p); eng.start();
    const rows = () => p.moreNetz.querySelectorAll('.ph-sheet-row').map(r => r.hidden ? 'h' : 's').join('');
    const alt = p.doc.getElementById('net-alternate-btn'), geo = p.doc.getElementById('net-geo-row');
    p.macroRow.hidden = false; p.win.uiSync();
    check('sketch.js shows the macro row (a geometric law with a nested net): its row appears', rows() === 'ssshs', rows());
    p.macroRow.hidden = true; geo.hidden = false; alt.hidden = true; p.win.uiSync();
    check('the Alternate wrapper shown with its button hidden (a geometric net in Single: Reverse is in the panel, Alternate is for Tiled) leaves NO empty row: a wrapper whose children are all hidden counts as hidden', rows() === 'sshhs', rows());
    alt.hidden = false; p.win.uiSync();
    check('the Alternate button shown (Tiled): its row appears', rows() === 'sshss', rows());
    geo.hidden = true; p.win.uiSync();
    check('the wrapper hidden by sketch.js (a trig law without a focus): the row collapses again', rows() === 'sshhs', rows());
    p.macroRow.hidden = false; geo.hidden = false; p.win.uiSync();
    check('everything shown: five rows, none hidden; the sheet keeps its blocks', rows() === 'sssss', rows());
    (p.win.observers || []).forEach(cb => cb());
});
T('netz-rows-release', () => {
    const p = netzPage(), before = dump(p.doc.documentElement), orig = {}; nzIds.forEach(id => { orig[id] = p.doc.getElementById(id); });
    const nb = {}; nzIds.forEach(id => { nb[id] = [orig[id].parentNode, orig[id].previousSibling, orig[id].nextSibling]; });
    const eng = ph(p); eng.start(); p.macroRow.hidden = false; p.win.uiSync();
    eng.release();
    check('release puts every item back with the same parent and neighbours; no block, no row, no marker, no ph-sheet-rows class is left on the overlay', nzIds.every(id => orig[id].parentNode === nb[id][0] && orig[id].previousSibling === nb[id][1] && orig[id].nextSibling === nb[id][2]) && p.doc.all().filter(n => /ph-sheet-(block|row)/.test(n.className)).length === 0 && !p.moreNetz.classList.contains('ph-sheet-rows') && (function none(n) { return n.childNodes.every(c => (c.nodeType !== 8 || !/^ph:/.test(c.text)) && (c.nodeType !== 1 || none(c))); })(p.doc.documentElement));
    check('...every item keeps the hidden state sketch.js gave it (the engine never sets hidden on an item)', orig['net-macro-row'].hidden === false && orig['net-geo-row'].hidden === true && orig['net-readout'].hidden === false);
    p.macroRow.hidden = true;
    check('...and the tree is the one before apply', dump(p.doc.documentElement).replace(/\[hidden\]/g, '') === before.replace(/\[hidden\]/g, ''));
    check('release is idempotent', (() => { const m = p.doc.mutations; eng.release(); return p.doc.mutations === m; })());
    eng.apply('netz');
    check('apply again after a release rebuilds the same rows and every id is once in the document', JSON.stringify(nzRows(p)) === JSON.stringify(['net-strength-exact+net-focus-exact', 'net-domain-row / net-macro-row / net-geo-row / net-readout']) && nzIds.every(id => p.doc.all().filter(n => n.id === id).length === 1));
    check('...and a second apply does no work', (() => { const m = p.doc.mutations; eng.apply('netz'); return p.doc.mutations === m; })());
    p.mq.set(false);
    check('a width change to 768+ releases it (the overlay keeps its layout and typed fields above 768px)', nzIds.every(id => orig[id].parentNode === nb[id][0]) && p.moreNetz.querySelectorAll('.ph-sheet-block').length === 0);
});


console.log('\n== the fine steppers of the Netz sheet and the offset display (sheets redesign, commit 4b), with the REAL ui.js and the REAL bindExact / setLocked of ui-net.js ==');
const NET_SRC = fs.readFileSync(process.env.UI_NET_JS || path.join(ROOT, 'ui-net.js'), 'utf8');
const exFn = (src, head) => { const i = src.indexOf(head); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
const BIND_SRC = exFn(NET_SRC, 'function bindExact('), LOCK_SRC = exFn(NET_SRC, 'function setLocked(');
// the page's own ui.js (UI) plus a toast that records; bindExact and setLocked of ui-net.js, extracted and run against the page's fields
const netFine = () => {
    const p = netzPage(), toasts = [], eng = ph(p), UI = p.win.UI;
    const U2 = Object.assign({}, UI, { toast: m => { toasts.push(m); } });
    const fn = new Function('UI', 'Event', BIND_SRC + '\n' + LOCK_SRC + '\nreturn { bindExact: bindExact, setLocked: setLocked };')(U2, p.win.Event);
    const mkCarrier = pct => ({ value: String(pct), events: [], dispatchEvent(ev) { this.events.push(ev.type); return true; } });
    const sF = p.doc.getElementById('net-strength-exact'), fF = p.doc.getElementById('net-focus-exact');
    const sC = mkCarrier(50), fC = mkCarrier(0), lock = { s: null, f: null };
    const showS = fn.bindExact(sF, sC, 0, 1, 'MSG-S', () => lock.s), showF = fn.bindExact(fF, fC, -1, 1, 'MSG-F', () => lock.f);
    showS(); showF();
    return { p, eng, UI, fn, toasts, sF, fF, sC, fC, lock, showS, showF, before: { sh: hcount(sF), fh: hcount(fF), sd: dump(sF), fd: dump(fF), sp: sF.parentNode, fp: fF.parentNode } };
};
T('netz-fine-decorate', () => {
    const n = netFine(), { p, eng, sF, fF } = n;
    eng.start();
    const rowOf = x => x.parentNode.parentNode;
    check('under the phone layout the two exact fields are the SAME nodes, each inside a .stepper (role group) that is a child of the first row of block 1; one element per id', rowOf(sF).className === 'ph-sheet-row' && rowOf(fF) === rowOf(sF) && sF.parentNode.className === 'stepper' && fF.parentNode.className === 'stepper' && sF.parentNode.getAttribute('role') === 'group' && p.doc.all().filter(x => x.id === 'net-strength-exact' || x.id === 'net-focus-exact').length === 2 && rowOf(sF).children.length === 2);
    check('the stepper is the Form row\'s markup (icon, the field, up and down chevrons) with the German names Stärke fein / Fokus fein (+ mehr / weniger) and the icons sliders / target', [[sF, 'Stärke fein', 'sliders'], [fF, 'Fokus fein', 'target']].every(a => { const r = a[0].parentNode, k = r.children; return k.length === 3 && k[0].tagName.toLowerCase() === 'svg' && k[1] === a[0] && k[2].children.map(b => b.getAttribute('data-dir')).join() === '1,-1' && r.getAttribute('aria-label') === a[1] && k[2].children[0].getAttribute('aria-label') === a[1] + ' mehr' && k[2].children[1].getAttribute('aria-label') === a[1] + ' weniger' && JSON.stringify(k[0].children.map(x => x.getAttribute('d'))) === JSON.stringify(config.icons[a[2]]); }));
    check('no keyboard: both fields are readOnly with inputmode="none" and carry data-stepper (the mark ui-net.js\'s setLocked looks for)', [sF, fF].every(x => x.readOnly === true && x.getAttribute('inputmode') === 'none' && x.hasAttribute('data-stepper')));
    eng.release();
    check('release UNDOES it: the fields are back in their sections (same parents, same tree, not readonly, no inputmode, no data-stepper), no wrapper is left, and they carry exactly the listeners they had (the stepper bound none on them)', sF.parentNode === n.before.sp && fF.parentNode === n.before.fp && dump(sF) === n.before.sd && dump(fF) === n.before.fd && !sF.readOnly && !fF.readOnly && !sF.hasAttribute('data-stepper') && hcount(sF) === n.before.sh && hcount(fF) === n.before.fh && p.doc.all().filter(x => x.className === 'stepper' && x.querySelector('#net-strength-exact')).length === 0);
});
T('netz-fine-steps', () => {
    const n = netFine(), { p, eng, sF, fF, sC, fC, toasts, UI } = n; eng.start();
    const btn = (f, dir) => f.parentNode.querySelectorAll('.stepper-btn').find(b => b.getAttribute('data-dir') === String(dir));
    const log = []; ['input', 'change'].forEach(t => sF.addEventListener(t, e => log.push(t + ':' + (e.bubbles ? 'b' : 'n'))));
    click0(btn(sF, 1));
    check('strength 0.50 -> 0.51 with ONE tap: the stepper writes "0.51" (two decimals), dispatches input then change (both bubbling) on the field, and bindExact turns that into the carrier (51 percent): the SAME path as a typed value', sF.value === '0.51' && sC.value === '51' && log.join() === 'input:b,change:b' && sC.events.join() === 'input,change' && toasts.length === 0, sF.value + ' ' + sC.value + ' ' + log.join());
    for (let i = 0; i < 4; i++) click0(btn(sF, 1));
    check('0.55 after five taps up; seven taps down give 0.48, thirteen more 0.43 (0.01 each, no float drift)', sF.value === '0.55' && sC.value === '55');
    for (let i = 0; i < 12; i++) click0(btn(sF, -1));
    check('...and 0.43 after twelve taps down', sF.value === '0.43' && sC.value === '43', sF.value);
    sC.value = '99'; n.showS(); click0(btn(sF, 1));
    check('strength reaches 1.00 (carrier 100), and the next tap up does nothing: the chevron is disabled with the reason "Größter Wert erreicht." (the stepper\'s own message)', sF.value === '1.00' && sC.value === '100' && btn(sF, 1).getAttribute('aria-disabled') === 'true' && btn(sF, 1).dataset.reason === 'Größter Wert erreicht.', btn(sF, 1).dataset.reason);
    sF.value = '7'; sF.dispatch('change', { type: 'change' });
    check('bindExact is the same as before: a value above the range is clamped to 1.00 with its notice (MSG-S)', sF.value === '1.00' && sC.value === '100' && toasts.indexOf('MSG-S') >= 0, toasts.join());
    sF.value = 'abc'; sF.dispatch('change', { type: 'change' });
    check('...an invalid text is restored to the current value', sF.value === '1.00');
    // focus: -1 .. 1
    fC.value = '-99'; n.showF(); click0(btn(fF, -1));
    check('focus runs from -1.00 to 1.00 in steps of 0.01 (-0.99 -> -1.00), the carrier -100, and stops there', fF.value === '-1.00' && fC.value === '-100' && btn(fF, -1).getAttribute('aria-disabled') === 'true');
    click0(btn(fF, 1)); click0(btn(fF, 1));
    check('...focus -0.98 after two taps up (the carrier -98): the net transform follows through the carrier', fF.value === '-0.98' && fC.value === '-98' && fC.events.length >= 4);
    eng.release();
});
T('netz-fine-lock', () => {
    const n = netFine(), { p, eng, sF, fF, sC, fC, fn, lock, UI } = n; eng.start();
    const up = f => f.parentNode.querySelectorAll('.stepper-btn')[0];
    const tick = () => { fn.setLocked(sF, lock.s); fn.setLocked(fF, lock.f); p.win.uiSync(); };
    tick();
    check('ticks while decorated and UNLOCKED leave the fields readonly (setLocked sets readOnly = false on a plain field; the data-stepper mark makes it leave it alone)', sF.readOnly === true && fF.readOnly === true && sF.getAttribute('aria-disabled') === null);
    lock.f = 'Fokus gilt für Sin und Tan'; tick();
    check('the focus field LOCKED (Aus or Geo): its field keeps readonly, carries aria-disabled with the reason, and the STEPPER mirrors it: root aria-disabled with the same reason (UI.stepper then does nothing; its chevrons follow through its own MutationObserver, which the pane proves)', fF.readOnly === true && fF.getAttribute('aria-disabled') === 'true' && fF.dataset.reason === lock.f && fF.parentNode.getAttribute('aria-disabled') === 'true' && fF.parentNode.dataset.reason === lock.f, String(fF.parentNode.dataset.reason));
    const v0 = fF.value; click0(up(fF));
    check('a tap on a chevron of the locked stepper changes nothing: no value, no carrier event', fF.value === v0 && fC.events.length === 0, fF.value);
    check('...while the strength stepper (not locked) still works', (() => { const s0 = sF.value; click0(up(sF)); return sF.value !== s0; })());
    lock.f = null; tick();
    check('unlocked again: aria-disabled and the reason are gone from the field and the stepper root, readonly stays, the chevron steps', fF.getAttribute('aria-disabled') === null && fF.parentNode.getAttribute('aria-disabled') === null && fF.readOnly === true && (() => { const f0 = fF.value; click0(up(fF)); return fF.value !== f0; })());
    for (let i = 0; i < 5; i++) { lock.s = i % 2 ? null : 'Die Stärke gilt für Sin, Tan und Geo.'; tick(); }
    check('five more ticks locking and unlocking the strength: the field is readonly after every one (the tick never undoes it)', sF.readOnly === true);
    lock.s = null; tick(); let ticks = 0; p.win.UI.onSync(() => { ticks++; }); eng.release();
    check('release asks for one UI tick at once (window.uiSync), so ui-net.js re-reads the lock of the plain fields without waiting for the next redraw', ticks >= 1, String(ticks));
    lock.s = 'reason'; lock.f = null; fn.setLocked(sF, lock.s); fn.setLocked(fF, lock.f);
    check('after release the plain fields obey setLocked again: locked = readOnly, unlocked = not (the engine called a tick, ui-net.js owns them)', sF.readOnly === true && fF.readOnly === false && !sF.hasAttribute('data-stepper'));
});
T('netz-display', () => {
    const p = buildPage({ ui: true }), eng = ph(p); eng.start(); eng.show('ebenen');
    const x = p.doc.getElementById('layer-offset-x-input'), y = p.doc.getElementById('layer-offset-y-input'), r = p.doc.getElementById('layer-rotation-input');
    const seen = []; x.addEventListener('input', () => seen.push(x.value)); x.addEventListener('change', () => seen.push(x.value));
    x.value = '103.92304845413264';
    check('the layer steppers DISPLAY at most one decimal: the shown text of 103.92304845413264 is 103.9, and what everything else reads (the sketch\'s .value(), the events) is the full value, unchanged', x.__shown === '103.9' && x.value === '103.92304845413264', x.__shown + ' / ' + x.value);
    x.value = '60'; y.value = '0.04'; r.value = '345';
    check('whole numbers and short values show as they are (60, 0, 345): no padding, no trailing zero; a negative value rounds toward the nearest tenth (-0.04 -> -0)', x.__shown === '60' && y.__shown === '0' && r.__shown === '345' && (() => { y.value = '-12.34'; return y.__shown === '-12.3'; })());
    x.value = '103.92304845413264'; seen.length = 0;
    const upX = x.parentNode.querySelectorAll('.stepper-btn')[0]; click0(upX);
    check('a tap from the displayed 103.9: the stepper adds 10 to the STORED value and rounds to a whole number (step 10, round 0): 113.923... -> 114; the hidden decimals are dropped by the first tap; the events carry 114 (not 113.9)', x.value === '114' && x.__shown === '114' && seen.join() === '114,114', x.value + ' ' + seen.join());
    x.value = '103.92304845413264'; click0(x.parentNode.querySelectorAll('.stepper-btn')[1]);
    check('...and a tap down: 93.923... -> 94', x.value === '94');
    x.value = '103.92304845413264'; const before = x.value; eng.release();
    check('release deletes the display layer: the input has its plain value again (the full text 103.92304845413264 is what it holds), no own accessor, no shown text left', x.value === before && Object.getOwnPropertyDescriptor(x, 'value') && Object.getOwnPropertyDescriptor(x, 'value').value === before && x.__shown === undefined, JSON.stringify(Object.getOwnPropertyDescriptor(x, 'value')));
    eng.apply('form'); eng.show('ebenen');
    check('apply again puts the display layer back (once: no accessor chain)', x.__shown === '103.9' && x.value === before);
    eng.release();
});


console.log('\n== the timeline sheet (sheets redesign, commit 5a): the rows, the gate and the view (ui-phone-timeline.js), with the REAL ui.js ==');
const TLV = require(process.env.UI_PHONE_TIMELINE_JS || path.join(ROOT, 'ui-phone-timeline.js'));
const TLS = config.sheets.timeline;
const tlSheet = () => { const p = buildPage({ ui: true }), eng = ph(p); eng.start(); eng.show('zeit'); return { p, eng, host: p.doc.getElementById('ph-sheet-timeline') }; };
const tlRows = host => host.querySelectorAll('.ph-sheet-block').map(b => b.children.map(r => (r.hidden ? '(h)' : '') + r.children.map(g => g.id).join('+')).join(' / '));
T('timeline-rows', () => {
    const { p, eng, host } = tlSheet();
    check('the timeline sheet is data: block 1 = the icon row (286px: 48 + 8 + 9 + 8 + 48 + 8 + the 84px select + 8 + 9 + 8 + 48) and the readout (fluid, 20px), block 2 = the pairing view behind the gate ph-tl-editor-show: the chips (fluid), the moves 160 + the variant group 155 (a wrap row), [list][reset]; block 3 = the list behind ph-tl-list-show', JSON.stringify(TLS.blocks.map(b => b.map(r => r.items.map(i => i.id + (i.gate ? '@' + i.gate : '') + (i.w ? ':' + i.w : '') + (r.h ? ':h' + r.h : '')).join('+')))) === JSON.stringify([['ph-tl-icons:286', 'ph-tl-readout:h20'], ['ph-tl-chips@ph-tl-editor-show', 'ph-tl-moves@ph-tl-editor-show:160+ph-tl-variant@ph-tl-editor-show:155', 'ph-tl-listbtn@ph-tl-editor-show:48+ph-tl-reset@ph-tl-editor-show:48'], ['ph-tl-listhead@ph-tl-list-show', 'ph-tl-list@ph-tl-list-show']]) && TLS.blocks[1][1].wrap === true && ['ph-tl-icons', 'ph-tl-readout'].every(id => config.createdByScript[id] === 'ui-phone-timeline.js') && ['ph-tl-chips', 'ph-tl-moves', 'ph-tl-variant', 'ph-tl-reset', 'ph-tl-listbtn', 'ph-tl-listhead', 'ph-tl-list'].every(id => config.createdByScript[id] === 'ui-phone-pairing.js'));
    check('apply moves the icon row, the readout and the pairing view\'s containers into rows INSIDE #timeline-group (the content: no new host), the sheet host gets ph-sheet-rows; every row of blocks 2 and 3 is hidden (gate closed), so the closed sheet shows ONE block', JSON.stringify(tlRows(host)) === JSON.stringify(['ph-tl-icons / ph-tl-readout', '(h)ph-tl-chips / (h)ph-tl-moves+ph-tl-variant / (h)ph-tl-listbtn+ph-tl-reset', '(h)ph-tl-listhead / (h)ph-tl-list']) && host.classList.contains('ph-sheet-rows') && p.tlGroup.children.filter(c => c.className === 'ph-sheet-block').length === 3 && host.querySelectorAll('.ph-sheet-block')[1].hidden === true && host.querySelectorAll('.ph-sheet-block')[2].hidden === true && host.querySelectorAll('.ph-sheet-block')[0].hidden === false, JSON.stringify(tlRows(host)));
    check('the heights by the config: closed 16 + 48 + 8 + 20 + 16 = 108; open 108 - 16 + 16 + (48 + 8 + 48 + 8 + 48) + 16 = 284; open at 320 (the pairing row wraps into two lines) 284 + 56 = 340; closed at 320 108; the list state (header, ONE list row counted) 16 + 48 + 8 + 20 + 16 + 48 + 8 + 48 + 16 = 228', API.sheetHeight(config, 'timeline') === 108 && API.sheetHeight(config, 'timeline', { gates: ['ph-tl-editor-show'] }) === 284 && API.sheetHeight(config, 'timeline', { gates: ['ph-tl-editor-show'], narrow: true }) === 340 && API.sheetHeight(config, 'timeline', { gates: ['ph-tl-list-show'] }) === 228 && API.sheetHeight(config, 'timeline', { narrow: true }) === 108);
    // the gate: the class on the content opens the row; sketch.js's own hidden still decides
    check('the engine WATCHES the content\'s class (a MutationObserver on #timeline-group, attributeFilter class), so the gate follows the toggle at once, not only on the next UI tick', (p.win.observed || []).some(x => x.el === p.tlGroup && x.o && x.o.attributeFilter && x.o.attributeFilter.indexOf('class') >= 0));
    p.tlGroup.classList.add('ph-tl-editor-show'); p.win.uiSync();
    check('with the class ph-tl-editor-show on #timeline-group the three rows of block 2 and the block show', tlRows(host)[1] === 'ph-tl-chips / ph-tl-moves+ph-tl-variant / ph-tl-listbtn+ph-tl-reset' && host.querySelectorAll('.ph-sheet-block')[1].hidden === false, JSON.stringify(tlRows(host)));
    p.tlGroup.classList.remove('ph-tl-editor-show'); p.tlGroup.classList.add('ph-tl-list-show'); p.win.uiSync();
    check('the class ph-tl-list-show shows block 3 (the header and the list) and hides block 2: the list REPLACES the editor', tlRows(host)[2] === 'ph-tl-listhead / ph-tl-list' && host.querySelectorAll('.ph-sheet-block')[2].hidden === false && host.querySelectorAll('.ph-sheet-block')[1].hidden === true);
    p.tlGroup.classList.remove('ph-tl-list-show'); p.win.uiSync();
    check('...and removing the class hides them again', tlRows(host)[1] === '(h)ph-tl-chips / (h)ph-tl-moves+ph-tl-variant / (h)ph-tl-listbtn+ph-tl-reset' && host.querySelectorAll('.ph-sheet-block')[1].hidden === true && host.querySelectorAll('.ph-sheet-block')[2].hidden === true);
    check('the old editor #timeline-pairing is the MODEL of the pairing view: it stays where it is (a child of #timeline-group, in no row), parked hidden by the CSS, with its own hidden attribute untouched', p.tlPairing.parentNode === p.tlGroup && p.tlPairing.hidden === true && !p.doc.all().some(n => /(^| )ph-sheet-row( |$)/.test(n.className) && n.contains(p.tlPairing)));
    check('the old pieces are PARKED, not removed: the keyframe list, the net box, the status span and the text button are all still in the document (the CSS hides them; the icon buttons forward to two of them)', ['timeline-keyframe-list', 'timeline-net-state', 'timeline-status', 'btn-clear-timeline'].every(id => !!p.doc.getElementById(id) && p.doc.all().filter(n => n.id === id).length === 1));
    eng.release();
    check('release puts the editor back into the group and the two made elements back into their holder; no block, no row, no marker left; the host class and the gate class are no longer on anything', p.tlPairing.parentNode === p.tlGroup && p.tlHome.children.map(c => c.id).join() === 'ph-tl-icons,ph-tl-readout,ph-tl-chips,ph-tl-moves,ph-tl-variant,ph-tl-listbtn,ph-tl-reset,ph-tl-listhead,ph-tl-list' && p.doc.all().filter(n => /ph-sheet-(block|row)/.test(n.className)).length === 0 && !p.doc.getElementById('ph-sheet-timeline'));
    check('release and apply again are idempotent: the same two blocks, every id once', (() => { const m = p.doc.mutations; eng.release(); const same = p.doc.mutations === m; eng.apply('form'); eng.show('zeit'); const h2 = p.doc.getElementById('ph-sheet-timeline'); return same && JSON.stringify(tlRows(h2)) === JSON.stringify(['ph-tl-icons / ph-tl-readout', '(h)ph-tl-chips / (h)ph-tl-moves+ph-tl-variant / (h)ph-tl-listbtn+ph-tl-reset', '(h)ph-tl-listhead / (h)ph-tl-list']) && ['ph-tl-icons', 'ph-tl-readout', 'timeline-pairing', 'ph-tl-chips', 'ph-tl-moves', 'ph-tl-variant', 'ph-tl-reset', 'ph-tl-listbtn', 'ph-tl-listhead', 'ph-tl-list'].every(id => p.doc.all().filter(n => n.id === id).length === 1); })());
});
// a view on a page of its own (the engine is not started: the view works on its elements wherever they are)
const tlView = (o) => {
    const p = buildPage({ ui: true }); p.tlHome._detach();
    const state = Object.assign({ tl: null, summary: null, active: 'base' }, o || {});
    const kf = p.doc.getElementById('timeline-keyframe-list'), clicks = [], clr = p.doc.getElementById('btn-clear-timeline');
    clr.addEventListener('click', () => clicks.push('clear'));
    const mkKf = n => { kf.childNodes.slice().forEach(c => c._detach()); for (let i = 0; i < n; i++) { const tab = p.doc.createElement('span'); const nb = p.doc.createElement('button'), xb = p.doc.createElement('button'); nb.addEventListener('click', () => clicks.push('net' + i)); xb.addEventListener('click', () => clicks.push('remove' + i)); tab.appendChild(nb); tab.appendChild(xb); kf.appendChild(tab); } };
    p.doc.documentElement.classList.add('ph');
    const view = TLV.createTimelineView(p.doc, p.win, { read: { timelineState: () => state.tl, timelineSummary: () => state.summary, activeLayerNow: () => state.active } });
    const tlo = (ids, nets) => ({ keyframeLayerIds: ids, netStates: nets || ids.map(() => ({ x: {} })), segmentDurationsMs: ids.slice(1).map(() => 2000) });
    const set = (patch) => { Object.assign(state, patch); if (patch.tl) mkKf(patch.tl.keyframeLayerIds.length); p.win.uiSync(); };
    return { p, view, state, clicks, set, tlo, mkKf, nodes: view.nodes };
};
const dis = b => b.getAttribute('aria-disabled') === 'true';
T('timeline-view', () => {
    const v = tlView(), n = v.nodes;
    check('the view makes two elements in a hidden holder (not yet in the sheet): #ph-tl-icons (a group named Zeitleiste with data-i18n) with the three buttons and two 1px hairlines, #ph-tl-readout (a polite live region)', n.holder.hidden === true && n.icons.id === 'ph-tl-icons' && n.icons.getAttribute('role') === 'group' && n.icons.getAttribute('data-i18n') === 'timeline.strip' && n.icons.children.map(c => c.tagName.toLowerCase() === 'span' ? 'sep' : c.className.split(' ').pop()).join() === 'ph-tl-netrec,sep,ph-tl-pairing,sep,ph-tl-trash' && n.readout.getAttribute('aria-live') === 'polite');
    check('every button has a German name from the dictionary key (aria-label = title, data-i18n): Netz der gewählten Ebene neu aufnehmen / Linienzuordnung / Zeitleiste entfernen; the pairing toggle has aria-pressed', [[n.netrec, 'Netz der gewählten Ebene neu aufnehmen', 'timeline.recaptureNet'], [n.pairing, 'Linienzuordnung', 'timeline.pairing'], [n.trash, 'Zeitleiste entfernen', 'timeline.remove']].every(a => a[0].getAttribute('data-i18n') === a[2] && a[0].getAttribute('aria-label') === a[1] || (dis(a[0]) && a[0].dataset.baseTitle === a[1])) && n.pairing.getAttribute('aria-pressed') === 'false');
    check('with no timeline: all three are disabled with their reasons - netrec and trash "Noch keine Keyframes", the toggle "Mindestens zwei Keyframes nötig" - and the readout is empty', dis(n.netrec) && dis(n.pairing) && dis(n.trash) && n.netrec.dataset.reason === 'Noch keine Keyframes' && n.trash.dataset.reason === 'Noch keine Keyframes' && n.pairing.dataset.reason === 'Mindestens zwei Keyframes nötig' && n.readout.textContent === '');
});
T('timeline-forward', () => {
    const v = tlView(), n = v.nodes;
    v.set({ tl: v.tlo([2, 0, 5]), summary: { state: 'animated' }, active: 0 });
    check('three keyframes (layers 2, 0, 5), layer 0 selected: netrec is enabled; a tap forwards to the "Net" button of keyframe 2 (position 1) and to NO other button', !dis(n.netrec) && (n.netrec.dispatch('click', { detail: 1 }), v.clicks.join() === 'net1'), v.clicks.join());
    v.clicks.length = 0; v.set({ active: 5 }); n.netrec.dispatch('click', { detail: 1 });
    check('...layer 5 (the third keyframe): the third "Net" button only', v.clicks.join() === 'net2');
    v.clicks.length = 0; v.set({ active: 2 }); n.netrec.dispatch('click', { detail: 1 });
    check('...layer 2 (the first): the first one', v.clicks.join() === 'net0');
    v.clicks.length = 0; v.set({ active: 'base' });
    check('the BASE selected: netrec is disabled with "Gewählte Ebene ist kein Keyframe", and a tap forwards nothing', dis(n.netrec) && n.netrec.dataset.reason === 'Gewählte Ebene ist kein Keyframe' && (n.netrec.dispatch('click', { detail: 1 }), v.clicks.length === 0));
    v.set({ active: 7 });
    check('a layer that is no keyframe (7): the same reason, nothing forwarded', dis(n.netrec) && n.netrec.dataset.reason === 'Gewählte Ebene ist kein Keyframe' && (n.netrec.dispatch('click', { detail: 1 }), v.clicks.length === 0));
    v.clicks.length = 0; n.trash.dispatch('click', { detail: 1 });
    check('the trash forwards ONE click to #btn-clear-timeline (whose handler asks first: ui-timeline.js, test-timeline-strip.js) and does nothing else', !dis(n.trash) && v.clicks.join() === 'clear');
    v.clicks.length = 0; v.set({ tl: null, summary: null, active: 'base' }); n.trash.dispatch('click', { detail: 1 });
    check('without a timeline the trash is disabled ("Noch keine Keyframes") and forwards nothing', dis(n.trash) && n.trash.dataset.reason === 'Noch keine Keyframes' && v.clicks.length === 0);
    check('the "x" buttons of the keyframe list are never forwarded to (only the first button of a keyframe)', (() => { v.set({ tl: v.tlo([0, 1]), summary: { state: 'animated' }, active: 1 }); v.clicks.length = 0; n.netrec.dispatch('click', { detail: 1 }); return v.clicks.join() === 'net1' && v.clicks.indexOf('remove1') < 0; })());
});
T('timeline-toggle', () => {
    const v = tlView(), n = v.nodes, g = v.p.tlGroup;
    v.set({ tl: v.tlo([0]), summary: { state: 'pending' }, active: 0 });
    check('with ONE keyframe the toggle is disabled with "Mindestens zwei Keyframes nötig" and a tap does nothing (no class, aria-pressed false)', dis(n.pairing) && n.pairing.dataset.reason === 'Mindestens zwei Keyframes nötig' && (n.pairing.dispatch('click', { detail: 1 }), !g.classList.contains('ph-tl-editor-open') && n.pairing.getAttribute('aria-pressed') === 'false'));
    g.classList.add('ts-open'); v.set({ tl: v.tlo([0, 1]), summary: { state: 'animated' } });
    check('with two keyframes it is enabled; a tap puts ph-tl-editor-open on #timeline-group and aria-pressed true (and the button looks active)', !dis(n.pairing) && (n.pairing.dispatch('click', { detail: 1 }), g.classList.contains('ph-tl-editor-open') && n.pairing.getAttribute('aria-pressed') === 'true' && /\bactive\b/.test(n.pairing.className)));
    n.pairing.dispatch('click', { detail: 1 });
    check('...a second tap closes it again', !g.classList.contains('ph-tl-editor-open') && n.pairing.getAttribute('aria-pressed') === 'false' && !/\bactive\b/.test(n.pairing.className));
    n.pairing.dispatch('click', { detail: 1 }); g.classList.remove('ts-open'); v.p.win.uiSync();
    check('it is UI state, closed again whenever the sheet closes (#timeline-group loses ts-open): the class and the pressed state go on the next tick', !g.classList.contains('ph-tl-editor-open') && n.pairing.getAttribute('aria-pressed') === 'false');
    // 5a2: the sketch draws nothing while a sheet closes and opens again, so NO UI tick comes in between (found in the pane: the toggle was still on after close and reopen)
    g.classList.add('ts-open'); v.p.win.uiSync(); n.pairing.dispatch('click', { detail: 1 });
    g.classList.remove('ts-open'); v.p.doc.dispatch('click', { target: v.p.doc.getElementById('ts-more') }); g.classList.add('ts-open');
    check('close and reopen WITHOUT a tick in between (the click that closes the sheet bubbles to the document): the toggle is off, the class is gone, the editor stays hidden when the sheet is open again', !g.classList.contains('ph-tl-editor-open') && n.pairing.getAttribute('aria-pressed') === 'false' && !/\bactive\b/.test(n.pairing.className) && (v.p.win.uiSync(), !g.classList.contains('ph-tl-editor-open')));
    g.classList.add('ts-open'); n.pairing.dispatch('click', { detail: 1 }); v.set({ tl: v.tlo([0]) });
    check('...and when the timeline drops below two keyframes while the editor is open', !g.classList.contains('ph-tl-editor-open') && dis(n.pairing));
    v.p.doc.documentElement.classList.remove('ph'); g.classList.add('ts-open'); v.set({ tl: v.tlo([0, 1]) }); n.pairing.dispatch('click', { detail: 1 }); v.p.win.uiSync();
    check('outside the phone layout the view does nothing on a tick (no class left on the group)', !g.classList.contains('ph-tl-editor-open'));
});
T('timeline-readout', () => {
    const v = tlView(), n = v.nodes;
    const say = (tl, st) => { v.set({ tl: tl, summary: st ? { state: st } : null }); return n.readout.textContent; };
    check('the six states in German from the summary: none, partial (the missing keyframe numbers: 2), pending, incompatible, constant, animated (the keyframe count: 3)', say(v.tlo([0, 1], [null, null]), 'none') === 'Netz: nicht animiert' && say(v.tlo([0, 1], [{ x: 1 }, null]), 'partial') === 'Netz: Keyframe 2 ohne Netz' && say(v.tlo([0], [{ x: 1 }]), 'pending') === 'Netz: zweiten Keyframe hinzufügen' && say(v.tlo([0, 1]), 'incompatible') === 'Netz: nicht animierbar' && say(v.tlo([0, 1]), 'constant') === 'Netz: gleich in allen Keyframes' && say(v.tlo([0, 1, 2]), 'animated') === 'Netz: animiert (3 Keyframes)');
    check('partial with several keyframes without a net: "1, 3"; and without a summary or a timeline the line is empty (it keeps its 20px)', say(v.tlo([0, 1, 2], [null, { x: 1 }, null]), 'partial') === 'Netz: Keyframe 1, 3 ohne Netz' && say(null, null) === '' && say(v.tlo([0, 1]), 'zzz') === '');
});

// ---- the pairing view of the timeline sheet (sheets redesign, commit 5b): ui-phone-pairing.js with the REAL ui.js and the real icon-row view, against a fake of the model that REBUILDS its rows after every change (as sketch.js does) ----
console.log('\n== the pairing view (sheets redesign, commit 5b): forwarding, the selection, the model rebuilt after every action ==');
const PV = require(process.env.UI_PHONE_PAIRING_JS || path.join(ROOT, 'ui-phone-pairing.js'));
// the model: what sketch.js's renderTimelinePairingEditor() renders, rebuilt from scratch (new elements) after every action: row r = Start line r, perm[r] = its End line; up / down swap the End assignments of two rows,
// flip toggles the End line's flip, prev / next step its variant k of c; the reset button is hidden while the pairing is the default
const pairModel = (p, init) => {
    const st = Object.assign({ perm: [0, 1, 2, 3], flips: [false, false, false, false], vk: [1, 1, 1, 1], vc: [12, 6, 6, 4], segCount: 1, seg: 0 }, init), log = [], doc = p.doc;
    const sel = doc.getElementById('timeline-pairing-segment'), list = doc.getElementById('timeline-pairing-list'), reset = doc.getElementById('btn-timeline-pairing-reset');
    const mk = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
    const isDefault = () => st.perm.every((j, i) => j === i) && st.flips.every(f => !f) && st.vk.every(k => k === 1);
    const render = () => {
        p.tlPairing.hidden = st.segCount === 0;
        if (st.segCount === 0) return;   // sketch.js: the panel is hidden and the rows are left as they were
        sel.childNodes.slice().forEach(c => c._detach()); for (let i = 0; i < st.segCount; i++) { const o = mk('option', '', 'Segment ' + (i + 1) + ': Layer ' + (i + 1) + ' → Layer ' + (i + 2)); o.setAttribute('value', String(i)); sel.appendChild(o); } sel.value = String(st.seg);
        list.childNodes.slice().forEach(c => c._detach());
        st.perm.forEach((e, r) => {
            const row = mk('div', 'pairing-row'), lab = mk('span', 'pairing-label', 'Start ' + (r + 1) + ' (a) → End ' + (e + 1) + ' (b)' + (st.flips[e] ? ' ⇄' : ''));
            const up = mk('button', 'layer-btn pairing-move-btn', '▲'), down = mk('button', 'layer-btn pairing-move-btn', '▼'), flip = mk('button', 'layer-btn pairing-move-btn pairing-flip-btn' + (st.flips[e] ? ' active' : ''), '⇄');
            up.disabled = r === 0; down.disabled = r === st.perm.length - 1;
            up.addEventListener('click', () => { log.push('up' + r); if (st.refuse) { render(); return; } const q = st.perm.slice(); [q[r], q[r - 1]] = [q[r - 1], q[r]]; st.perm = q; render(); });
            down.addEventListener('click', () => { log.push('down' + r); if (st.refuse) { render(); return; } const q = st.perm.slice(); [q[r], q[r + 1]] = [q[r + 1], q[r]]; st.perm = q; render(); });
            flip.addEventListener('click', () => { log.push('flip' + r); st.flips[e] = !st.flips[e]; render(); });
            [lab, up, down, flip].forEach(x => row.appendChild(x));
            if (st.vc[e] > 1) {
                const v = mk('span', 'pairing-variant'), prev = mk('button', 'layer-btn pairing-move-btn pairing-variant-prev'), cnt = mk('span', 'pairing-variant-count', st.vk[e] + '/' + st.vc[e]), next = mk('button', 'layer-btn pairing-move-btn pairing-variant-next');
                cnt.setAttribute('data-k', String(st.vk[e])); cnt.setAttribute('data-c', String(st.vc[e]));
                prev.addEventListener('click', () => { log.push('prev' + r); st.vk[e] = (st.vk[e] - 2 + st.vc[e]) % st.vc[e] + 1; render(); });
                next.addEventListener('click', () => { log.push('next' + r); st.vk[e] = st.vk[e] % st.vc[e] + 1; render(); });
                [prev, cnt, next].forEach(x => v.appendChild(x)); row.appendChild(v);
            }
            list.appendChild(row);
        });
        reset.hidden = isDefault();
        renderBrowse();
    };
    // the model's list (renderTimelinePairingBrowser): offered for 1 <= n <= 5; the flag survives a segment that is not browsable (sketch.js keeps timelinePairingBrowseOpen); rows sorted by the sum, ties by the permutation
    const bbtn = doc.getElementById('btn-timeline-pairing-browse'), browser = doc.getElementById('timeline-pairing-browser'), blist = doc.getElementById('timeline-pairing-browser-list'), bcount = doc.getElementById('timeline-pairing-browser-count');
    const perms = n => n <= 1 ? [[0]] : [].concat.apply([], perms(n - 1).map(q => Array.from({ length: n }, (_, k) => { const r = q.slice(); r.splice(k, 0, n - 1); return r; }))).sort((a, b) => { for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; });
    const disp = q => q.reduce((a, j, i) => a + (i - j) * (i - j) * 1200 + (j === 0 ? 0 : 17), 0);
    function renderBrowse() {
        const n = st.perm.length, cand = st.segCount > 0 && n >= 1 && n <= 5;
        bbtn.hidden = !cand; bbtn.textContent = st.browseOpen ? 'Hide list' : 'Browse all';
        const open = cand && !!st.browseOpen; browser.hidden = !open;
        blist.childNodes.slice().forEach(c => c._detach());
        if (!open) return;
        const items = (n === 1 ? [[0, false], [0, true]] : perms(n)).map(x => n === 1 ? { perm: [0], flip: x[1], sum: x[1] ? 0 : 0 } : { perm: x, sum: disp(x) });
        items.sort((a, b) => a.sum - b.sum || (a.perm.join('') < b.perm.join('') ? -1 : 1));
        bcount.textContent = 'Showing ' + (st.filterMax ? items.filter(i => i.sum <= st.filterMax).length : items.length) + ' of ' + items.length + (n === 1 ? ' variants (Start 1 \u2192 End 1, distinct pictures only)' : ' pairings (Start 1..' + n + ' \u2192 End ...)');
        items.filter(i => !st.filterMax || i.sum <= st.filterMax).forEach(it => {
            const b = mk('button', 'pairing-browse-row' + (n === 1 ? (it.flip === !!st.flips[0] ? ' current' : '') : (it.perm.join('') === st.perm.join('') ? ' current' : '')));
            b.setAttribute('data-perm', it.perm.join('')); if (n === 1) { b.setAttribute('data-flip', it.flip ? '1' : '0'); b.setAttribute('data-member', '0'); }
            b.appendChild(mk('span', '', n === 1 ? '2\u20135' + (it.flip ? ' \u21C4' : ' (as clicked)') : it.perm.map(j => j + 1).join(' '))); b.appendChild(mk('span', '', Math.round(it.sum).toLocaleString('en-US') + ' px\u00B2'));
            const segR = st.seg; b.addEventListener('click', () => { log.push('row:' + it.perm.join('') + (n === 1 ? '|' + (it.flip ? 1 : 0) : '')); (st.rowSegs = st.rowSegs || []).push(segR); if (n === 1) st.flips[0] = it.flip; else st.perm = it.perm.slice(); render(); });
            blist.appendChild(b);
        });
    }
    bbtn.addEventListener('click', () => { log.push('browse'); st.browseOpen = !st.browseOpen; render(); });
    sel.addEventListener('change', () => { log.push('seg' + sel.value); st.seg = parseInt(sel.value, 10) || 0; render(); });
    reset.addEventListener('click', () => { log.push('reset'); st.perm = st.perm.map((_, i) => i); st.flips = st.flips.map(() => false); st.vk = st.vk.map(() => 1); render(); });
    render();
    return { st, log, render };
};
const pairPage = (init) => {
    const v = tlView(), model = pairModel(v.p, init);
    const view = PV.createPairingView(v.p.doc, v.p.win, { perm: () => model.st.perm.slice() });
    v.set({ tl: v.tlo([0, 1, 2]), summary: { state: 'animated' } }); v.p.tlGroup.classList.add('ts-open');
    return Object.assign({ model, pview: view, n: view.nodes, g: v.p.tlGroup }, { v });
};
const open = x => { x.v.nodes.pairing.dispatch('click', { detail: 1 }); x.v.p.win.uiSync(); };
const chipsOf = x => x.n.chips.children;
const selOf = x => chipsOf(x).findIndex(c => c.getAttribute('aria-pressed') === 'true');
T('pairing-view-basics', () => {
    const x = pairPage();
    check('the view makes its containers in the SAME holder as the icon row (#ph-tl-home) and puts the segment select into the icon row right after the pairing toggle: [netrec | pairing select | trash]', x.n.chips.parentNode === x.v.nodes.holder && x.n.moves.parentNode === x.v.nodes.holder && x.n.variant.parentNode === x.v.nodes.holder && x.n.reset.parentNode === x.v.nodes.holder && x.v.nodes.icons.children.map(c => c.className.split(' ').pop() || c.tagName).join().replace(/ph-tl-btn ?/g, '') !== '' && x.v.nodes.icons.children.indexOf(x.n.segment) === x.v.nodes.icons.children.indexOf(x.v.nodes.pairing) + 1 && x.v.nodes.icons.children[x.v.nodes.icons.children.indexOf(x.n.segment) + 1].className === 'ph-tl-sep');
    check('with ONE segment the select is hidden (also while the toggle is on); chips are not built while the toggle is off', x.n.segment.hidden === true && chipsOf(x).length === 0);
    open(x);
    check('the toggle on: one chip per line (4), numbered 1..4 from the row index, the FIRST selected (black: class active, aria-pressed), names "Linie n"', chipsOf(x).length === 4 && chipsOf(x).map(c => c.textContent).join() === '1,2,3,4' && selOf(x) === 0 && /\bactive\b/.test(chipsOf(x)[0].className) && !/\bactive\b/.test(chipsOf(x)[1].className) && chipsOf(x).map(c => c.getAttribute('aria-label')).join() === 'Linie 1,Linie 2,Linie 3,Linie 4');
    check('the first row has no ▲ (aria-disabled, no reason: the model has none), ▼ is enabled, the reverse icon is enabled, the variant text is the model\'s "1/12" and both variant buttons are enabled', dis(x.n.up) && !x.n.up.dataset.reason && !dis(x.n.down) && !dis(x.n.flip) && x.n.count.textContent === '1/12' && !dis(x.n.prev) && !dis(x.n.next));
    check('the pairing is the default: the reset icon is disabled with the reason "Zuordnung ist Standard" (its title)', dis(x.n.reset) && x.n.reset.dataset.reason === 'Zuordnung ist Standard');
    x.n.reset.dispatch('click', { detail: 1 });
    check('a tap on the disabled reset icon forwards nothing', x.model.log.length === 0);
});
T('pairing-view-no-tick', () => {
    // the sketch redraws nothing when a sheet opens or a toggle is tapped: the view must not wait for a UI tick (found with the toggle of 5a2: a close and an open come with none)
    const x = pairPage();
    x.v.nodes.pairing.dispatch('click', { detail: 1 }); x.v.p.doc.dispatch('click', { target: x.v.nodes.pairing });
    check('a tap on the pairing toggle builds the chips at once (the click that bubbles to the document refreshes the view; NO UI tick comes in between)', chipsOf(x).length === 4 && selOf(x) === 0);
    x.model.st.perm = [0, 1]; x.model.st.flips = [false, false]; x.model.render(); x.v.p.doc.dispatch('click', { target: x.v.p.doc.getElementById('ts-more') });
    check('...and any later click of the document refreshes it again (two lines now), without a tick', chipsOf(x).length === 2);
    check('the chips group is named "Linienzuordnung" (role group, aria-label, data-i18n timeline.pairing) and the select "Segment" (data-i18n-label)', x.n.chips.getAttribute('role') === 'group' && x.n.chips.getAttribute('aria-label') === 'Linienzuordnung' && x.n.chips.getAttribute('data-i18n') === 'timeline.pairing' && x.n.segment.getAttribute('aria-label') === 'Segment' && x.n.segment.getAttribute('data-i18n-label') === 'timeline.segment');
});
T('pairing-view-chips', () => {
    const x = pairPage({ vc: [12, 6, 1, 4] }); open(x);
    chipsOf(x)[2].dispatch('click', { detail: 1 });
    check('a chip tap selects that line (the third: black), changes NOTHING in the model (no click reached any model button, perm unchanged) and the moves follow the row: ▲ and ▼ are enabled', selOf(x) === 2 && x.model.log.length === 0 && x.model.st.perm.join() === '0,1,2,3' && !dis(x.n.up) && !dis(x.n.down));
    check('the variant text is the SELECTED row\'s (End line 3 has 1 variant: no stepper in the model): "1/1" and both variant buttons disabled', x.n.count.textContent === '1/1' && dis(x.n.prev) && dis(x.n.next));
    chipsOf(x)[3].dispatch('click', { detail: 1 });
    check('the last line: ▼ is disabled', dis(x.n.down) && !dis(x.n.up) && x.n.count.textContent === '1/4');
    // the number of lines changes under the selection: clamped
    x.model.st.perm = [0, 1]; x.model.st.flips = [false, false]; x.model.render(); x.v.p.win.uiSync();
    check('the model has two lines now (a keyframe was replaced): the selection is clamped to the last one and there are two chips', chipsOf(x).length === 2 && selOf(x) === 1);
    x.model.st.perm = [0, 1, 2, 3]; x.model.st.flips = [false, false, false, false]; x.model.render(); x.v.p.win.uiSync();
    check('...and when the lines come back the selection stays where it was (UI state, not saved: it follows no model state)', chipsOf(x).length === 4 && selOf(x) === 1);
});
T('pairing-view-forwarding', () => {
    const x = pairPage(); open(x);
    chipsOf(x)[2].dispatch('click', { detail: 1 });
    x.n.up.dispatch('click', { detail: 1 });
    check('▲ on line 3 forwards ONE click to the ▲ button of row 3 (index 2) of the model and nothing else; the model\'s own swap ran (perm 0,2,1,3); the selection FOLLOWED the End line (End 3 is on row 2 now: chip 2 selected)', x.model.log.join() === 'up2' && x.model.st.perm.join() === '0,2,1,3' && selOf(x) === 1, x.model.log.join() + ' ' + x.model.st.perm.join() + ' sel' + selOf(x));
    x.n.up.dispatch('click', { detail: 1 });
    check('▲ again: the click went to row 2 (up1), perm 2,0,1,3, selection on chip 1 - and now ▲ is disabled (the first row)', x.model.log.join() === 'up2,up1' && x.model.st.perm.join() === '2,0,1,3' && selOf(x) === 0 && dis(x.n.up));
    x.n.up.dispatch('click', { detail: 1 });
    check('a tap on the disabled ▲ forwards nothing, the selection stays', x.model.log.join() === 'up2,up1' && selOf(x) === 0);
    x.n.down.dispatch('click', { detail: 1 });
    check('▼ on line 1: click to row 1 (down0), perm 0,2,1,3: the End line moved down and the selection with it (chip 2)', x.model.log.join() === 'up2,up1,down0' && x.model.st.perm.join() === '0,2,1,3' && selOf(x) === 1);
    x.n.next.dispatch('click', { detail: 1 });
    check('the variant step ›: ONE click to the › of row 2 (next1) only; k/c from the rebuilt model "2/6"; the selection stays', x.model.log.join() === 'up2,up1,down0,next1' && x.n.count.textContent === '2/6' && selOf(x) === 1 && x.model.st.vk[2] === 2);
    x.n.prev.dispatch('click', { detail: 1 }); x.n.prev.dispatch('click', { detail: 1 });
    check('‹ twice: 1/6 and then 6/6 (the model wraps, the view only shows what it reads)', x.model.log.slice(-2).join() === 'prev1,prev1' && x.n.count.textContent === '6/6');
    x.n.flip.dispatch('click', { detail: 1 });
    check('⇄: ONE click to the flip button of row 2, End line 3 is flipped in the model, the selection stays', x.model.log.slice(-1)[0] === 'flip1' && x.model.st.flips[2] === true && selOf(x) === 1);
    check('the pairing is not the default any more: the reset icon is enabled (no reason, no aria-disabled)', !dis(x.n.reset) && !x.n.reset.dataset.reason);
    x.n.reset.dispatch('click', { detail: 1 });
    check('reset: ONE click on #btn-timeline-pairing-reset, the model is the default again (perm 0,1,2,3, no flips, k = 1), the icon is disabled again with the reason, the selection stays on row 2', x.model.log.slice(-1)[0] === 'reset' && x.model.st.perm.join() === '0,1,2,3' && x.model.st.flips.every(f => !f) && dis(x.n.reset) && x.n.reset.dataset.reason === 'Zuordnung ist Standard' && selOf(x) === 1);
    check('no tap forwarded to a DIFFERENT row\'s button and none to two buttons: every logged action is one entry of the sequence up2, up1, down0, next1, prev1, prev1, flip1, reset', x.model.log.join() === 'up2,up1,down0,next1,prev1,prev1,flip1,reset');
});
T('pairing-view-refused', () => {
    const x = pairPage(); open(x);
    chipsOf(x)[2].dispatch('click', { detail: 1 }); x.model.st.refuse = true;
    x.n.up.dispatch('click', { detail: 1 });
    check('the model REFUSES a move (sketch.js: setTimelinePairing returns without a change): the click reached the model\'s ▲ once, the permutation is unchanged and the selection stays on the line it was on (it follows the End line through the permutation, not a fixed +-1)', x.model.log.join() === 'up2' && x.model.st.perm.join() === '0,1,2,3' && selOf(x) === 2);
});
T('pairing-view-eight-in-a-row', () => {
    const x = pairPage(); open(x);
    // eight actions in a row, each followed by a REBUILD of every model element (new rows, new buttons): a held reference would hit a detached button
    const seq = [['chip', 3], ['up'], ['up'], ['down'], ['next'], ['flip'], ['down'], ['reset']], expectSel = [3, 2, 1, 2, 2, 2, 3, 3], expectLog = ['', 'up3', 'up3,up2', 'up3,up2,down1', 'up3,up2,down1,next2', 'up3,up2,down1,next2,flip2', 'up3,up2,down1,next2,flip2,down2', 'up3,up2,down1,next2,flip2,down2,reset'];
    const got = [];
    seq.forEach((a, i) => { if (a[0] === 'chip') chipsOf(x)[a[1]].dispatch('click', { detail: 1 }); else x.n[a[0]].dispatch('click', { detail: 1 }); got.push([selOf(x), x.model.log.join()]); });
    check('eight actions in a row (chip 4, ▲, ▲, ▼, ›, ⇄, ▼, reset), the model rebuilt after each: every action reached the right button of the right row, once, and the selection after each is ' + expectSel.join(), JSON.stringify(got) === JSON.stringify(expectSel.map((sel, i) => [sel, expectLog[i]])), JSON.stringify(got));
    check('the view never holds a model element: after the eight actions none of the buttons it clicked is still in the document (the rows were replaced) and it still works', x.model.log.length === 7 && !x.v.p.doc.getElementById('timeline-pairing-list').children.some(r => r.className !== 'pairing-row'));
});
T('pairing-view-follow-real-data', () => {
    // the selection follows the SAME End line: perm before / after of the model's own up / down on real permutations
    const P = PV;
    const cases = [['up', 2, [0, 1, 2, 3], [0, 2, 1, 3], 1], ['up', 1, [0, 2, 1, 3], [2, 0, 1, 3], 0], ['down', 0, [2, 0, 1, 3], [0, 2, 1, 3], 1], ['down', 2, [0, 1, 3, 2], [0, 1, 2, 3], 3], ['flip', 2, [0, 1, 2, 3], [0, 1, 2, 3], 2], ['next', 1, [3, 1, 0, 2], [3, 1, 0, 2], 1]];
    check('followSelection: ▲ and ▼ follow the End line through the permutation (' + cases.length + ' real cases), ⇄ and the variant steps keep the row', cases.every(c => P.followSelection(c[0], c[1], 4, c[2], c[3]) === c[4]));
    check('without the permutation it moves one row (clamped at both ends) and a missing End line falls back to the same', P.followSelection('up', 2, 4, null, null) === 1 && P.followSelection('down', 3, 4, null, null) === 3 && P.followSelection('up', 0, 4, null, null) === 0 && P.followSelection('up', 2, 4, [0, 1, 2, 3], [9, 9, 9, 9]) === 1);
});
T('pairing-view-segments', () => {
    const x = pairPage({ segCount: 2, seg: 0 });
    check('two segments: the select is SHOWN in the icon row (also with the toggle off) with the options "1→2" and "2→3" built from the model\'s options (values 0 and 1, the label from the position, not the model\'s text), the current one selected', x.n.segment.hidden === false && x.n.segment.children.map(o => o.getAttribute('value') + ':' + o.textContent).join() === '0:1→2,1:2→3' && x.n.segment.value === '0');
    open(x);
    x.n.segment.value = '1'; x.n.segment.dispatch('change');
    check('a change sets the MODEL select\'s value and dispatches change on it (the model\'s own handler ran once: seg1) and the chips are rebuilt for the new segment', x.model.log.join() === 'seg1' && x.model.st.seg === 1 && x.n.segment.value === '1' && chipsOf(x).length === 4);
    x.model.st.segCount = 1; x.model.st.seg = 0; x.model.render(); x.v.p.win.uiSync();
    check('the model drops to one segment: the select is hidden again', x.n.segment.hidden === true && x.n.segment.children.length === 1);
    x.model.st.segCount = 0; x.model.render(); x.v.p.win.uiSync();
    check('no segment at all (the model hides its panel): no chips, every icon disabled', chipsOf(x).length === 0 && dis(x.n.up) && dis(x.n.down) && dis(x.n.flip) && dis(x.n.prev) && dis(x.n.next) && dis(x.n.reset));
});
T('pairing-view-reset-open', () => {
    const x = pairPage(); open(x);
    chipsOf(x)[1].dispatch('click', { detail: 1 }); x.n.flip.dispatch('click', { detail: 1 });
    x.g.classList.remove('ts-open'); x.v.p.doc.dispatch('click', { target: x.v.p.doc.getElementById('ts-more') }); x.g.classList.add('ts-open'); x.v.p.win.uiSync();
    check('the sheet closed and opened again: the toggle is off (5a2), the pairing view builds nothing (no chips), the selection of a line is UI state and may stay', chipsOf(x).length === 0 && !x.g.classList.contains('ph-tl-editor-open') && x.model.st.flips[1] === true);
    x.v.set({ tl: x.v.tlo([0]) });
    check('fewer than two keyframes with the toggle on: the toggle is off again (5a) and the view has nothing to show', chipsOf(x).length === 0);
});
T('pairing-view-outside-phone', () => {
    const x = pairPage(); open(x);
    x.v.p.doc.documentElement.classList.remove('ph'); const before = x.n.chips.children.length; x.model.st.perm = [1, 0, 2, 3]; x.model.render(); x.v.p.win.uiSync();
    check('without html.ph the view does nothing on a tick', x.n.chips.children.length === before && chipsOf(x).length === 4);
});


// ---- the pairing list (sheets redesign, commit 5c): the model's own list is opened with its Browse all button, read afresh, forwarded to and closed again ----
console.log('\n== the pairing list (sheets redesign, commit 5c) ==');
const lst = x => x.n.list.children, lrows = x => lst(x).map(b => b.children[0].children.filter(c => /ph-tl-lorder/.test(c.className)).map(c => c.textContent).join() + '|' + b.children[1].textContent);
const inList = x => x.g.classList.contains('ph-tl-list-show'), inEditor = x => x.g.classList.contains('ph-tl-editor-show');
const modelFlags = x => ({ sort: x.v.p.doc.getElementById('timeline-pairing-sort').value, filter: x.v.p.doc.getElementById('timeline-pairing-filter').value, open: x.model.st.browseOpen });
const goList = x => { open(x); x.n.listBtn.dispatch('click', { detail: 1 }); };
T('pairing-list-icon', () => {
    const x = pairPage({ perm: [0, 1, 2], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1] });
    check('with the toggle off nothing of the list is shown (no class, no model list opened)', !inList(x) && !inEditor(x) && x.model.st.browseOpen === undefined);
    open(x);
    check('n = 3: the list icon is shown in row 3 next to reset ([list][reset]), named "Alle Zuordnungen", enabled; the editor class is set', x.n.listBtn.hidden === false && x.n.listBtn.getAttribute('aria-label') === 'Alle Zuordnungen' && !dis(x.n.listBtn) && inEditor(x) && !inList(x));
    [1, 2, 4, 5].forEach(n => { x.model.st.perm = Array.from({ length: n }, (_, i) => i); x.model.st.flips = x.model.st.perm.map(() => false); x.model.st.vk = x.model.st.perm.map(() => 1); x.model.st.vc = x.model.st.perm.map(() => 1); x.model.render(); x.v.p.win.uiSync(); x['hidden' + n] = x.n.listBtn.hidden; });
    check('the list icon is there for n = 1, 2, 4 and 5 lines', [1, 2, 4, 5].every(n => x['hidden' + n] === false));
    x.model.st.perm = [0, 1, 2, 3, 4, 5]; x.model.st.flips = x.model.st.perm.map(() => false); x.model.st.vk = x.model.st.perm.map(() => 1); x.model.st.vc = x.model.st.perm.map(() => 1); x.model.render(); x.v.p.win.uiSync();
    check('n = 6 (PAIRING_BROWSE_MAX_N = 5: the model hides its Browse all button): the list icon is NOT in the row (hidden, no dead control) and a tap on where it was does nothing', x.n.listBtn.hidden === true && (x.n.listBtn.dispatch('click', { detail: 1 }), !inList(x) && x.model.log.length === 0));
});
T('pairing-list-open', () => {
    const x = pairPage({ perm: [0, 2, 1], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1], browseOpen: false });
    x.v.p.doc.getElementById('timeline-pairing-sort').value = 'asc'; x.v.p.doc.getElementById('timeline-pairing-filter').value = '';
    goList(x);
    check('a tap on the list icon opens the MODEL\'s list with one click on its Browse all button (logged once) and shows the list view: the editor class is replaced by the list class', x.model.log.join() === 'browse' && x.model.st.browseOpen === true && inList(x) && !inEditor(x));
    const L = x.pview.list.vm();
    check('six pairings (3 lines): the rows are the model\'s, SORTED ASCENDING by the sum, the sums are the model\'s own numbers (0 + 17 x ..., 2 x 1200 + ..., ...)', lst(x).length === 6 && L.rows.every((r, i, a) => !i || a[i - 1].sum <= r.sum) && L.rows[0].order === '1 2 3' && L.rows[0].sum === 34);
    check('the figures in German with a no-break space (the model\'s "4,834 px²" is read as 4834 and shown "4 834")', lrows(x).some(r => /\d \d{3}$/.test(r)) && lrows(x)[0].endsWith('|34'), lrows(x).join(' / '));
    const cur = lst(x).filter(b => b.getAttribute('aria-current') === 'true');
    check('the CURRENT pairing (1 3 2) is marked: black (class active) and aria-current, exactly one row', cur.length === 1 && /\bactive\b/.test(cur[0].className) && cur[0].children[0].children.filter(c => /ph-tl-lorder/.test(c.className))[0].textContent === '1 3 2');
    const def = lst(x).filter(b => b.children[0].children.some(c => /ph-tl-ldef/.test(c.className)));
    check('the DEFAULT pairing (1 2 3) is marked with the small text "Standard" (and named so: the row\'s accessible name ends with "(Standard)"), no other row', def.length === 1 && def[0].children[0].children.filter(c => /ph-tl-lorder/.test(c.className))[0].textContent === '1 2 3' && def[0].children[0].children.filter(c => /ph-tl-ldef/.test(c.className))[0].textContent === 'Standard' && /\(Standard\)$/.test(def[0].getAttribute('aria-label')));
    check('every row has the accessible name "Zuordnung <order>, Σd² <value> px²" (aria-label and title)', lst(x).every(b => /^Zuordnung \d( \d)*, Σd² [\d ]+ px²/.test(b.getAttribute('aria-label')) && b.getAttribute('title') === b.getAttribute('aria-label')), lst(x)[1].getAttribute('aria-label'));
    check('the header: the count from the model "6 von 6 Zuordnungen", a back arrow named "Zurück zur Zuordnung"', x.n.listCount.textContent === '6 von 6 Zuordnungen' && x.n.back.getAttribute('aria-label') === 'Zurück zur Zuordnung');
    check('the model\'s sort (ascending) and filter (empty) were not touched, and its list is open (the view opened it)', JSON.stringify(modelFlags(x)) === JSON.stringify({ sort: 'asc', filter: '', open: true }));
    check('nothing else was clicked: the model log is exactly the one Browse all click', x.model.log.join() === 'browse');
});
T('pairing-list-pick', () => {
    const x = pairPage({ perm: [0, 2, 1], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1] });
    open(x); chipsOf(x)[2].dispatch('click', { detail: 1 }); x.n.listBtn.dispatch('click', { detail: 1 });
    const selBefore = selOf(x); const pick = key => lst(x).filter(b => b.getAttribute('aria-label').indexOf('Zuordnung ' + key) === 0)[0];
    pick('3 1 2').dispatch('click', { detail: 1 });
    check('the third line was selected before the list was opened: after the pick the selection is on line 1 again', selBefore === 2 && selOf(x) === 0);
    check('a tap on the row "3 1 2" forwards ONE click to the MODEL\'s row button with that permutation (row:201 logged once) and the model applied it (perm 2,0,1); the model\'s list is closed again (a second Browse all click: the view had opened it) and the view is back in the EDITOR with the first line selected, the rows gone', x.model.log.join() === 'browse,row:201,browse' && x.model.st.perm.join() === '2,0,1' && x.model.st.browseOpen === false && inEditor(x) && !inList(x) && selOf(x) === 0 && lst(x).length === 0);
    check('the editor shows the new state (chips for 3 lines, the variant text of row 1, reset enabled: not the default)', chipsOf(x).length === 3 && !dis(x.n.reset));
    x.n.listBtn.dispatch('click', { detail: 1 });
    const cur = lst(x).filter(b => b.getAttribute('aria-current') === 'true')[0];
    check('the list opened again marks the NEW current pairing (3 1 2)', !!cur && cur.getAttribute('aria-label').indexOf('Zuordnung 3 1 2') === 0 && lst(x).filter(b => b.getAttribute('aria-current') === 'true').length === 1);
    check('the model\'s sort and filter are untouched (the view never writes them)', modelFlags(x).sort === undefined && modelFlags(x).filter === undefined);
});
T('pairing-list-leave', () => {
    // back arrow
    let x = pairPage({ perm: [0, 1, 2], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1] }); goList(x);
    x.n.back.dispatch('click', { detail: 1 });
    check('the back arrow returns to the editor and closes the model\'s list (browse, browse); nothing else was clicked', inEditor(x) && !inList(x) && x.model.log.join() === 'browse,browse' && x.model.st.browseOpen === false);
    // Escape
    x = pairPage({ perm: [0, 1, 2], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1] }); goList(x);
    let stopped = 0; x.v.p.doc.dispatch('keydown', { key: 'Escape', stopPropagation() { stopped++; }, preventDefault() { } });
    check('Escape with the list open goes BACK to the editor and is STOPPED (UI.overlay does not see it: the sheet stays open); the model\'s list is closed again', inEditor(x) && !inList(x) && stopped === 1 && x.model.st.browseOpen === false);
    x.v.p.doc.dispatch('keydown', { key: 'Escape', stopPropagation() { stopped++; }, preventDefault() { } });
    check('Escape from the editor is NOT touched by the view (it goes on to UI.overlay, which closes the sheet)', stopped === 1);
    x.v.p.doc.dispatch('keydown', { key: 'a', stopPropagation() { stopped++; } });
    check('another key with the list open is not touched either', stopped === 1);
    // the sheet closes
    x = pairPage({ perm: [0, 1, 2], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1] }); goList(x);
    x.g.classList.remove('ts-open'); x.v.p.doc.dispatch('click', { target: x.v.p.doc.getElementById('ts-more') });
    check('the sheet closes (a click on its "..." with ts-open gone): the list is left, both classes are gone, the model\'s list is closed again - the next opening starts closed', !inList(x) && !inEditor(x) && x.model.st.browseOpen === false && !x.g.classList.contains('ph-tl-editor-open'));
    // keyframe removal
    x = pairPage({ perm: [0, 1, 2], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1] }); goList(x);
    x.g.classList.add('ts-open'); x.v.set({ tl: x.v.tlo([0]) });
    check('a keyframe is removed (one left): the toggle goes off and with it the list; the model\'s list is closed', !inList(x) && !inEditor(x) && x.model.st.browseOpen === false);
    // the toggle off
    x = pairPage({ perm: [0, 1, 2], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1] }); goList(x);
    x.v.nodes.pairing.dispatch('click', { detail: 1 }); x.v.p.doc.dispatch('click', { target: x.v.nodes.pairing });
    check('the pairing toggle tapped off while the list is open: the list is left', !inList(x) && x.model.st.browseOpen === false);
    // a model that had its list open already is left as it was
    x = pairPage({ perm: [0, 1, 2], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1], browseOpen: true }); goList(x);
    const before = x.model.log.join(); x.n.back.dispatch('click', { detail: 1 });
    check('the model\'s list was open before (the desktop left it so): the view does not click Browse all to open it and does not close it on leaving: it stays as found', before === '' && x.model.log.join() === '' && x.model.st.browseOpen === true);
    // outside the phone layout
    x = pairPage({ perm: [0, 1, 2], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1] }); goList(x);
    x.v.p.doc.documentElement.classList.remove('ph'); x.v.p.win.uiSync();
    check('the phone layout ends (768px) with the list open: the gate classes go and the model\'s list is closed (the page is as at 768px)', !inList(x) && !inEditor(x) && x.model.st.browseOpen === false);
});
T('pairing-list-segments', () => {
    const x = pairPage({ perm: [0, 1, 2], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1], segCount: 2 }); goList(x);
    check('two segments, the list open on segment 1', lst(x).length === 6 && x.n.segment.hidden === false);
    x.n.segment.value = '1'; x.n.segment.dispatch('change');
    check('a segment change with the list open: the list FOLLOWS (the model re-renders its list for the new segment: still six rows, the count line re-read), the view stays in the list', inList(x) && lst(x).length === 6 && x.n.listCount.textContent === '6 von 6 Zuordnungen');
    x.model.st.perm = [0, 1, 2, 3, 4, 5]; x.model.st.flips = x.model.st.perm.map(() => false); x.model.st.vk = x.model.st.perm.map(() => 1); x.model.st.vc = x.model.st.perm.map(() => 1); x.model.render(); x.v.p.win.uiSync();
    check('the other segment has 6 lines (not browsable: the model hides its list): the view LEAVES the list (back in the editor, no list icon), and the model\'s open flag is reset by a click on its hidden Browse all button', !inList(x) && inEditor(x) && x.n.listBtn.hidden === true && x.model.st.browseOpen === false);
    x.model.st.perm = [0, 1, 2]; x.model.st.flips = x.model.st.perm.map(() => false); x.model.st.vk = x.model.st.perm.map(() => 1); x.model.st.vc = x.model.st.perm.map(() => 1); x.model.render(); x.v.p.win.uiSync();
    check('...so when a browsable segment is back the model\'s list is NOT open by itself (the page is as it was)', x.model.st.browseOpen === false && lst(x).length === 0 && x.v.p.doc.getElementById('timeline-pairing-browser').hidden === true);
});
T('pairing-list-stale-segment', () => {
    // a row button of the list of segment 1 keeps closing over segment 1: only a FRESH lookup after the segment change reaches the row of segment 2
    const x = pairPage({ perm: [0, 1, 2], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1], segCount: 2 }); goList(x);
    const pick = key => lst(x).filter(b => b.getAttribute('aria-label').indexOf('Zuordnung ' + key) === 0)[0];
    pick('1 3 2').dispatch('click', { detail: 1 }); x.n.listBtn.dispatch('click', { detail: 1 });
    x.n.segment.value = '1'; x.n.segment.dispatch('change');
    pick('2 1 3').dispatch('click', { detail: 1 });
    check('a pick in the list of segment 2 reaches the model row rendered for segment 2 (the first pick was rendered for segment 1: rowSegs 0, 1) - never a row button kept from the first look', JSON.stringify(x.model.st.rowSegs) === JSON.stringify([0, 1]), JSON.stringify(x.model.st.rowSegs));
});
T('pairing-list-orientations', () => {
    const x = pairPage({ perm: [0], flips: [false], vk: [1], vc: [1] }); goList(x);
    check('n = 1 (the two orientations): the list shows the model\'s two variants ("2–5 ⇄", "2–5"), the as-clicked one is the default and the current one', lst(x).length === 2 && lrows(x).map(r => r.split('|')[0]).sort().join() === '2–5,2–5 ⇄'.split(',').sort().join() && x.pview.list.vm().rows.find(r => r.isDefault).order === '2–5' && x.pview.list.vm().rows.find(r => r.current).order === '2–5');
    lst(x).filter(b => /⇄/.test(b.children[0].children.filter(c => /ph-tl-lorder/.test(c.className))[0].textContent))[0].dispatch('click', { detail: 1 });
    check('a tap on the reversed variant forwards to the model\'s row with data-flip 1 (row:0|1 once), the model applies it, the view is back in the editor with line 1', x.model.log.join() === 'browse,row:0|1,browse' && x.model.st.flips[0] === true && inEditor(x) && selOf(x) === 0);
});
T('pairing-list-no-stale', () => {
    const x = pairPage({ perm: [0, 1, 2], flips: [false, false, false], vk: [1, 1, 1], vc: [1, 1, 1] }); goList(x);
    const first = lst(x)[0];
    x.v.p.win.uiSync(); x.v.p.doc.dispatch('click', { target: x.v.p.doc.getElementById('ts-more') });
    check('the list is rendered ONCE per change: a tick and a document click without a change leave the very same row elements (light: nothing is rebuilt)', lst(x)[0] === first && lst(x).length === 6);
    x.model.st.perm = [2, 0, 1]; x.model.render(); x.v.p.win.uiSync();
    check('when the model changes (another current pairing) the rows are rebuilt from the model\'s new rows and the mark moves', lst(x)[0] !== first && lst(x).filter(b => b.getAttribute('aria-current') === 'true')[0].getAttribute('aria-label').indexOf('Zuordnung 3 1 2') === 0);
    // two picks in a row, the model rebuilding every time: the second pick must find the model's NEW row button
    const pick = key => lst(x).filter(b => b.getAttribute('aria-label').indexOf('Zuordnung ' + key) === 0)[0];
    pick('2 1 3').dispatch('click', { detail: 1 }); x.n.listBtn.dispatch('click', { detail: 1 }); pick('1 3 2').dispatch('click', { detail: 1 });
    check('two picks in a row with the model rebuilt after each: each reaches the model\'s row of the moment (row:102 then row:021), once', x.model.log.filter(l => /^row:/.test(l)).join() === 'row:102,row:021' && x.model.st.perm.join() === '0,2,1');
});
console.log('\n== release removes the aria-haspopup that UI.overlay put on the sheets\' triggers (sheets redesign, commit 5b) ==');
T('haspopup-release', () => {
    const p = buildPage({ ui: true }), ls = p.doc.getElementById('ls-more'), ts = p.doc.getElementById('ts-more');
    ts.setAttribute('aria-haspopup', 'menu');   // a value the trigger had of its own
    const eng = ph(p); eng.start(); eng.show('zeit');
    check('while the layout is on both triggers say aria-haspopup="dialog" (UI.overlay: the sheet is a dialog)', ls.getAttribute('aria-haspopup') === 'dialog' && ts.getAttribute('aria-haspopup') === 'dialog');
    eng.release();
    check('release: the layer "..." has NO aria-haspopup again (it had none), the strip\'s "..." has the value it had before ("menu"): above 768px the trigger opens an inline block, not a dialog', ls.getAttribute('aria-haspopup') === null && ts.getAttribute('aria-haspopup') === 'menu');
    eng.apply('form'); eng.show('zeit');
    check('apply again marks them again (the sheets are made once; the mark is put back with every apply)', ls.getAttribute('aria-haspopup') === 'dialog' && ts.getAttribute('aria-haspopup') === 'dialog');
    eng.apply('farbe');
    check('a tab change inside the phone layout (apply: release and build) leaves them marked', ls.getAttribute('aria-haspopup') === 'dialog' && ts.getAttribute('aria-haspopup') === 'dialog');
    p.mq.set(false);
    check('the media query leaving the phone layout takes them away again (the same release)', ls.getAttribute('aria-haspopup') === null && ts.getAttribute('aria-haspopup') === 'menu');
    const q = buildPage({ ui: true }); const e2 = ph(q); e2.start(); e2.release();
    check('the page equals a fresh load after the round trip as far as aria-haspopup goes: the attributes of both triggers match those of a page that never ran the engine (aria-expanded is the owners\' own: ui-timeline.js and ui-layers.js set it themselves; the fake page has none)', (() => { const fresh = buildPage({ ui: true }), strip = a => { const o = Object.assign({}, a); delete o['aria-expanded']; return JSON.stringify(o); }; return ['ls-more', 'ts-more'].every(id => strip(q.doc.getElementById(id).attrs) === strip(fresh.doc.getElementById(id).attrs)); })());
});

// ---- the labels of the phone layout through the dictionary (sheets redesign, commit 6a) ----
T('labels-i18n', () => {
    const I = require(path.join(ROOT, 'ui-i18n.js'));
    const read = (lang, tab) => {
        I.setLang(lang);
        try {
            const p = buildPage({ ui: true }); p.win.uiI18n = I;
            const eng = ph(p); eng.start(); eng.apply(tab);
            const d = p.doc;
            return { subtabs: d.getElementById('ph-subtabs').children.map(b => b.textContent).join(), tools: d.getElementById('ph-toolrow').getAttribute('aria-label'), nav: d.getElementById('ph-subtabs').getAttribute('aria-label'),
                layer: d.getElementById('ph-sheet-layer') && d.getElementById('ph-sheet-layer').getAttribute('aria-label'), timeline: d.getElementById('ph-sheet-timeline') && d.getElementById('ph-sheet-timeline').getAttribute('aria-label') };
        } finally { I.setLang('de'); }
    };
    const de = { form: 'Raster,Ebenen,Zeit', farbe: 'Harmonie,Spuren,Ebenen,Zeit', netz: 'Art,Achsen,Ebenen,Zeit' }, en = { form: 'Grid,Layers,Time', farbe: 'Harmony,Trails,Layers,Time', netz: 'Type,Axes,Layers,Time' };
    ['form', 'farbe', 'netz'].forEach(tab => {
        const d = read('de', tab), e = read('en', tab);
        check('German with the dictionary present (' + tab + '): sub-tabs ' + de[tab] + ', groups Werkzeuge / Unterbereiche, hosts Ebenen-Einstellungen / Zeitleiste: Mehr - as before', d.subtabs === de[tab] && d.tools === 'Werkzeuge' && d.nav === 'Unterbereiche' && d.layer === 'Ebenen-Einstellungen' && d.timeline === 'Zeitleiste: Mehr', JSON.stringify(d));
        check('?lang=en (' + tab + '): sub-tabs ' + en[tab] + ', groups Tools / Sub-sections, hosts Layer settings / Timeline: more', e.subtabs === en[tab] && e.tools === 'Tools' && e.nav === 'Sub-sections' && e.layer === 'Layer settings' && e.timeline === 'Timeline: more', JSON.stringify(e));
    });
    const p = buildPage({ ui: true }), eng = ph(p); eng.start(); eng.apply('netz');
    check('without the dictionary (the Node tests, a page without ui-i18n.js) the German text of the config is written', p.doc.getElementById('ph-subtabs').children.map(b => b.textContent).join() === de.netz && p.doc.getElementById('ph-toolrow').getAttribute('aria-label') === 'Werkzeuge' && p.doc.getElementById('ph-subtabs').getAttribute('aria-label') === 'Unterbereiche');
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
