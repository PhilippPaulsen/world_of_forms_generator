/*
 * The phone layout engine (phone layout, commit 1a). UI only: it reads ui-phone-config.js (the data) and knows no control.
 *
 * Below 768px, for a tab the config marks `covered`, apply(tab) RE-PARENTS the existing controls - the same elements, so ids, classes and every handler stay - into containers it creates: a tool row, a
 * row of sub-tabs and ONE panel slot under the canvas. It never clones. A comment node left at each element's old place remembers it; release() puts everything back, removes the containers and the class
 * `ph` from <html>. The class `ph` is set only here and gates all of the phone CSS (style.css), so without this script the phone keeps the layout it had.
 *
 *   apply(tab)     idempotent: nothing to do when that tab is already applied; another tab releases first. Does nothing (and releases) at >= 768px or for a tab that is not covered.
 *   release()      idempotent: moves every element back to its marker and removes what apply() made.
 *   show(subtab)   the sub-tab's pane goes into the slot, the other panes into the parking container (hidden: display none - out of the Tab order and the accessibility tree, and no hit testing).
 *   sheets         config.sheets: blocks that become bottom sheets (UI.overlay) while the layout is on; see buildSheet(). A sheet may have `blocks` (rows of existing elements, see buildBlocks()) and `steppers`
 *                  (existing inputs wrapped into UI.stepper while the layout is on, see decorateSteppers()).
 *   start()        listens: 'tabchange' on document (nav.js), the media query, resize / orientationchange; applies for the current tab.
 *
 * Since patterns commit C0b-2 apply(tab) = layout(tab) + surfaces(tab). layout(tab) is the PAGE LAYOUT above (stack, tool row, sub-tabs, slot, scroll lock, follows, `ph`, --panel-h, --ph-inner-h) and runs only below 768px for a
 * covered tab, as before. surfaces(tab) loops over config.surfaces (the SURFACE REGISTRY, data): per surface the tabs, its flag class and a host per mode ('phone', 'inline'): the phone hosts are the sheets and the overlay
 * the engine always had (the blocks and steppers stay in config.sheets / config.overlays), the trails' host is the Spuren pane of the layout. Every surface applied sets `html.sr` and its own `sr-...` class (the gates of the twin
 * rules of style.css, and what the view modules read instead of `ph`); release removes them. At 768px and up a surface is applied only when its inline switch (`inlineOn`) is on: every switch is OFF, so nothing is applied there.
 * Per-surface state lives in surfaceState[name] (its sheets, row blocks, decorated steppers, observers) with its own release steps; `moved`, `sheetCache`, `stepperCache`, take() and restoreAll() are shared.
 *
 * Sub-tab buttons follow the header tabs' model (nav.js): all of them are in the Tab order, Enter / Space activates one, aria-current marks the active one. The choice is remembered per tab.
 * Loaded after ui-layers.js and ui-timeline.js (they fill #layer-strip and #timeline-strip when they run) and before sketch.js's setup() (p5 runs it on the window load event).
 */
(function (root) {
  'use strict';

  function createPhone(doc, win, config, opts) {
    opts = opts || {};
    const html = doc.documentElement;
    const mq = typeof win.matchMedia === 'function' ? win.matchMedia(config.query) : { matches: false };
    const moved = new Map();          // id -> { node, marker }: every element that is away from its place
    const missing = [];               // ids the config names that the page does not have
    const remembered = {};            // tab -> the sub-tab it showed last
    let built = null;                 // the containers apply() made
    let applied = null;               // the tab the layout is applied for
    let firstApplyState = null;       // document.readyState at the first apply()
    let started = false;
    const surfaceState = {};          // surface name -> { name, mode, flag, sheets, sheetBlocks, rowHosts, decorated, rowObserver, lockObserver }: what the surface made (C0b-2)
    let inlineTab = null;             // the tab the surfaces are applied for WITHOUT the layout (768px and up, a surface whose inline switch is on)

    function el(tag, cls, attrs) {
      const e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      return e;
    }
    // Moves the element with that id into `into` (before `before`, or last). The first move leaves a comment node where it was.
    function take(id, into, before) {
      const node = doc.getElementById(id);
      if (!node || !node.parentNode) { if (missing.indexOf(id) < 0) missing.push(id); return null; }
      if (!moved.has(id)) {
        const marker = doc.createComment('ph:' + id);
        node.parentNode.insertBefore(marker, node);
        moved.set(id, { node: node, marker: marker });
      }
      if (before) into.insertBefore(node, before); else into.appendChild(node);
      return node;
    }
    function restoreAll() {
      moved.forEach(function (m) {
        const p = m.marker.parentNode;
        if (p) { p.insertBefore(m.node, m.marker); p.removeChild(m.marker); }
      });
      moved.clear();
    }
    // A moved element that had the focus loses it (a DOM move blurs): give it back.
    function keepFocus(fn) {
      const had = doc.activeElement;
      fn();
      if (had && had !== doc.body && had.isConnected !== false && doc.activeElement !== had && typeof had.focus === 'function') { try { had.focus({ preventScroll: true }); } catch (e) { had.focus(); } }
    }
    function setInnerHeight() { if (win.innerHeight) html.style.setProperty('--ph-inner-h', win.innerHeight + 'px'); }

    function build(tab) {
      const t = config.tabs[tab], tr = config.toolRows[t.toolRow], anchor = doc.querySelector(config.anchor);
      if (!anchor || !anchor.parentNode) return null;
      const b = { buttons: {}, panes: {}, order: t.subtabs.slice(), proxied: [] };
      b.stack = el('div', 'ph-stack', { id: 'ph-stack' });
      // the tool row: the groups scroll sideways when they do not fit, the end (More) stays
      b.toolRow = el('div', 'ph-toolrow', { id: 'ph-toolrow', role: 'group', 'aria-label': say(config.names.tools.i18n, config.names.tools.text) });
      b.tools = el('div', 'ph-tools');
      tr.groups.forEach(function (ids, i) {
        if (i) b.tools.appendChild(el('span', 'ph-sep', { 'aria-hidden': 'true' }));
        const g = el('div', 'ph-toolgroup');
        ids.forEach(function (id) { take(id, g); });
        b.tools.appendChild(g);
      });
      b.toolRow.appendChild(b.tools);
      b.toolRow.appendChild(el('span', 'ph-sep', { 'aria-hidden': 'true' }));
      tr.end.forEach(function (id) { take(id, b.toolRow); });
      // the sub-tab row
      b.subtabs = el('nav', 'ph-subtabs', { id: 'ph-subtabs', 'aria-label': say(config.names.subtabs.i18n, config.names.subtabs.text) });
      t.subtabs.forEach(function (sid) {
        const btn = el('button', 'ph-subtab', { type: 'button', id: 'ph-subtab-' + sid, 'aria-controls': 'ph-slot' });
        btn.textContent = say(config.subtabs[sid].i18n, config.subtabs[sid].label);
        btn.addEventListener('click', function () { show(sid); });
        b.subtabs.appendChild(btn);
        b.buttons[sid] = btn;
      });
      // the panel slot and the parking container; every sub-tab is a pane (rows of moved elements), parked until it is shown
      b.slot = el('div', 'ph-slot', { id: 'ph-slot', role: 'group' });
      b.park = el('div', 'ph-park', { id: 'ph-park' });
      b.park.hidden = true;
      t.subtabs.forEach(function (sid) {
        const pane = el('div', 'ph-pane', { 'data-subtab': sid });
        config.subtabs[sid].rows.forEach(function (row) {
          const r = el('div', row.scroll ? 'ph-row ph-row-scroll' : 'ph-row');
          row.items.forEach(function (it) {
            if (it.sep) { r.appendChild(el('span', 'ph-sep', { 'aria-hidden': 'true' })); return; }
            take(it.id, r);
            (it.also || []).forEach(function (id) { take(id, r); });   // elements that share the item's slot (one of them is hidden)
          });
          pane.appendChild(r);
        });
        b.park.appendChild(pane);
        b.panes[sid] = pane;
      });
      b.stack.appendChild(b.toolRow);
      b.stack.appendChild(b.subtabs);
      b.stack.appendChild(b.slot);
      b.stack.appendChild(b.park);
      anchor.parentNode.insertBefore(b.stack, anchor.nextSibling || null);
      // the rail's "Mehr" sheet receives the other former rail buttons as a second icon row, above its name line
      if (tr.sheet) {
        const host = doc.getElementById(tr.sheet.id), before = tr.sheet.before ? doc.getElementById(tr.sheet.before) : null;
        if (host) {
          b.sheetRow = el('div', 'more-row more-extra');
          host.insertBefore(b.sheetRow, before && before.parentNode === host ? before : null);
          tr.sheet.items.forEach(function (id) { take(id, b.sheetRow); });
          b.sheetHost = host;
          // the groups sketch.js shows while Curve or Free is on: they stay hidden until it shows them, and then they are in this sheet, under the toggles that make them appear
          if (tr.sheet.settings && tr.sheet.settings.length) {
            b.settingsRow = el('div', 'more-settings');
            host.insertBefore(b.settingsRow, before && before.parentNode === host ? before : null);
            tr.sheet.settings.forEach(function (id) { take(id, b.settingsRow); });
          }
          // A button in the closed sheet cannot take the focus back (UI.overlay and UI.dialog call trigger.focus() when Info or the Download dialog closes): while the layout is on, its focus() hands the
          // focus to the sheet's opener (in the tool row) when the button itself is not visible.
          const opener = tr.sheet.opener ? doc.getElementById(tr.sheet.opener) : null;
          // the opener's name while this tool row is on (its own describes Form's sheet): put back by release()
          if (opener && tr.sheet.openerLabel) {
            b.openerSaved = { node: opener, label: opener.getAttribute('aria-label'), title: opener.getAttribute('title'), i18n: opener.getAttribute('data-i18n') };
            const openerText = say(tr.sheet.openerLabel.i18n, tr.sheet.openerLabel.text);
            opener.setAttribute('aria-label', openerText); opener.setAttribute('title', openerText);
            if (tr.sheet.openerLabel.i18n) opener.setAttribute('data-i18n', tr.sheet.openerLabel.i18n);
          }
          if (opener) tr.sheet.items.forEach(function (id) {
            const node = doc.getElementById(id);
            if (!node) return;
            node.focus = function (o) {
              const visible = typeof node.offsetParent === 'undefined' || node.offsetParent !== null;
              return (visible ? Object.getPrototypeOf(node).focus : opener.focus).call(visible ? node : opener, o);
            };
            b.proxied.push(node);
          });
        } else if (missing.indexOf(tr.sheet.id) < 0) missing.push(tr.sheet.id);
      }
      // labels: the name a control has while this tool row is on (an icon-only Net lines button: its text is emptied visually, its name is the label); put back by release()
      b.labelsSaved = [];
      Object.keys(tr.labels || {}).forEach(function (id) {
        const node = doc.getElementById(id), l = tr.labels[id];
        if (!node) { if (missing.indexOf(id) < 0) missing.push(id); return; }
        b.labelsSaved.push({ node: node, label: node.getAttribute('aria-label'), title: node.getAttribute('title'), i18n: node.getAttribute('data-i18n') });
        const labelText = say(l.i18n, l.text);
        node.setAttribute('aria-label', labelText); node.setAttribute('title', labelText);
        if (l.i18n) node.setAttribute('data-i18n', l.i18n);
      });
      buildSurfaces(tab, b, 'phone');
      return b;
    }

    // ---- bottom sheets ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
    // A block with a "..." button (the layer "Mehr", the timeline "Mehr") that is inline elsewhere becomes a bottom sheet (UI.overlay) while the layout is on. The block keeps its own open state and its own button
    // handler (which flips that state); the sheet FOLLOWS the state (syncSheets: on the button's click, which comes after the existing handler, and on every UI tick), and a close that comes from the sheet
    // (Escape, the scrim, a tap outside, a resize) clicks the button once more so the state closes too. The host and its UI.overlay are made once per sheet and reused: UI.overlay binds document and window
    // listeners that cannot be taken off again.
    const sheetCache = {};            // sheet id -> { def, trigger, el, overlay }
    function sheetOpen(def) {
      const c = doc.getElementById(def.content);
      if (!c) return false;
      if (def.open.notHidden) return !c.hidden;
      return !!(c.classList && c.classList.contains(def.open.hasClass));
    }
    function eachSurface(fn) { Object.keys(surfaceState).forEach(function (name) { fn(surfaceState[name], name); }); }
    function syncSheets() {
      if (!Object.keys(surfaceState).length) return;
      eachSurface(function (st) {
        st.sheets.forEach(function (h) {
          const want = sheetOpen(h.def);
          if (want && !h.overlay.isOpen) h.overlay.open();
          else if (!want && h.overlay.isOpen) h.overlay.close(!!(doc.activeElement && h.el.contains(doc.activeElement)));
        });
      });
      syncRows();
      syncLocks();
    }
    // A sheet with `blocks` (config.sheets.<id>.blocks): the existing elements go into row containers inside blocks inside the sheet's content, in the order the config says. They move whole (nothing is cloned or
    // rewritten) and sketch.js keeps showing and hiding them; a row whose elements are ALL hidden is hidden itself, a block whose rows are all hidden too, so no empty row and no gap is left. release() puts the
    // elements back (restoreAll) and removes the containers; a MutationObserver (where there is one) and every UI tick re-read the `hidden` attributes.
    // park: ids of the host that stay where they are (the Netz overlay at 768px and up: the typed strength field, which is not shown there). A row left with no item and a block left with no row are not made.
    function buildBlocks(def, host, content, st, park) {
      const parked = function (id) { return !!park && park.indexOf(id) >= 0; };
      host.classList.add('ph-sheet-rows');
      st.rowHosts.push(host);
      def.blocks.forEach(function (rows) {
        const blk = el('div', 'ph-sheet-block'), rowEls = [];
        rows.forEach(function (row) {
          const items = row.items.filter(function (it) { return !parked(it.id); });
          if (!items.length) return;
          const r = el('div', row.wrap ? 'ph-sheet-row ph-sheet-row-wrap' : 'ph-sheet-row');
          if (row.h) r.setAttribute('data-h', String(row.h));
          items.forEach(function (it) { take(it.id, r); });
          blk.appendChild(r);
          const gates = {}; items.forEach(function (it) { if (it.gate) gates[it.id] = it.gate; });   // an item behind a gate is hidden unless the content has that class
          rowEls.push({ el: r, ids: items.map(function (it) { return it.id; }), gates: gates, content: content });
        });
        if (!rowEls.length) return;
        content.appendChild(blk);
        st.sheetBlocks.push({ el: blk, rows: rowEls });
      });
      if (typeof win.MutationObserver === 'function') {
        st.rowObserver = new win.MutationObserver(function () { syncRows(); });
        st.rowObserver.observe(content, { attributes: true, attributeFilter: ['class'] });   // a gate opens and closes with a class of the content
        st.sheetBlocks.forEach(function (blk) { blk.rows.forEach(function (r) { r.ids.forEach(function (id) { const n = doc.getElementById(id); if (n) st.rowObserver.observe(n, { attributes: true, attributeFilter: ['hidden'], subtree: true }); }); }); });
      }
    }
    // config.sheets.<id>.steppers: an existing input (a plain typed field above 768px) is wrapped into a stepper - the markup of the Form row's steppers, made here from config data - while the layout is on, and
    // is the plain input again after release(). The input itself is MOVED (take()), never cloned: its id, its handlers and the sketch's own listeners stay. The stepper is UI.stepper with the options of the
    // config (step, min, max, wrap, round); the typing is switched off here (readOnly and inputmode none: no soft keyboard) and put back at release(). UI.stepper binds its listeners once, on the made wrapper (its
    // key handler on the wrapper too, not on the input) and on the document (visibilitychange: stops a held chevron), and cannot unbind them: the wrapper and its stepper are made ONCE per input (stepperCache)
    // and reused, so nothing grows with every apply, and no listener is ever left on the plain input.
    const stepperCache = {};          // input id -> { input, root, chevrons, names }
    function svgIcon(paths) {
      const ns = 'http://www.w3.org/2000/svg', mk = typeof doc.createElementNS === 'function' ? function (t) { return doc.createElementNS(ns, t); } : function (t) { return doc.createElement(t); };
      const svg = mk('svg');
      [['class', 'ico stepper-icon'], ['width', '18'], ['height', '18'], ['viewBox', '0 0 24 24'], ['aria-hidden', 'true']].forEach(function (a) { svg.setAttribute(a[0], a[1]); });
      paths.forEach(function (d) { const p = mk('path'); p.setAttribute('d', d); svg.appendChild(p); });
      return svg;
    }
    function nameOf(n) { return say(n.i18n, n.text); }
    function buildStepper(sp, input) {
      const icons = config.icons || {}, root = el('div', 'stepper', { role: 'group' }), chevrons = el('div', 'stepper-chevrons'), btns = [];
      root.appendChild(svgIcon(icons[sp.icon] || []));
      root.appendChild(chevrons);
      [['1', 'chevron-up', 'more'], ['-1', 'chevron-down', 'less']].forEach(function (d) {
        const b = el('button', 'stepper-btn', { type: 'button', 'data-dir': d[0] }), ic = svgIcon(icons[d[1]] || []);
        ic.setAttribute('class', 'ico');
        b.appendChild(ic); chevrons.appendChild(b); btns.push([b, sp[d[2]]]);
      });
      return { input: input, root: root, chevrons: chevrons, btns: btns, made: false };
    }
    function nameStepper(c, sp) {
      c.root.setAttribute('aria-label', nameOf(sp.name)); if (sp.name.i18n) c.root.setAttribute('data-i18n', sp.name.i18n);
      c.btns.forEach(function (x) { const t = nameOf(x[1]); x[0].setAttribute('aria-label', t); x[0].setAttribute('title', t); if (x[1].i18n) x[0].setAttribute('data-i18n', x[1].i18n); });
    }
    // The display layer (commit 4b): the input DISPLAYS its value with at most `decimals` decimals (103.9) while the value everything else reads - the sketch's p5 .value(), the events, the stepper - stays the full one.
    // The instance gets its own `value` accessor: the setter keeps the full text and puts the rounded text into the element's native value; the getter returns the full text. release() deletes the accessor and puts
    // the full text back into the native value. Without the DOM's own accessor (a fake DOM) the shown text is kept in input.__shown.
    function displayOf(raw, decimals) {
      const t = String(raw), n = parseFloat(t);
      if (t.trim() === '' || !isFinite(n)) return t;
      const f = Math.pow(10, decimals);
      return String(Math.round(n * f) / f);
    }
    function showRounded(input, decimals) {
      const proto = win.HTMLInputElement && win.HTMLInputElement.prototype, desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
      const nativeGet = desc ? function () { return desc.get.call(input); } : function () { return input.value; };
      const nativeSet = desc ? function (v) { desc.set.call(input, v); } : function (v) { input.__shown = v; };
      let raw = String(nativeGet() === undefined ? '' : nativeGet());
      Object.defineProperty(input, 'value', { configurable: true, enumerable: true, get: function () { return raw; }, set: function (v) { raw = v === null || v === undefined ? '' : String(v); nativeSet(displayOf(raw, decimals)); } });
      nativeSet(displayOf(raw, decimals));
      return function undo() { const keep = raw; delete input.value; if (desc) nativeSet(keep); else { input.value = keep; delete input.__shown; } };
    }
    // only: the ids to decorate (a host that wants some of the overlay's steppers: the Netz overlay at 768px and up has the fine Fokus stepper only); without it every stepper of the definition
    function decorateSteppers(def, st, only) {
      const UI = win.UI;
      if (!def.steppers || !UI || typeof UI.stepper !== 'function') return;
      Object.keys(def.steppers).forEach(function (iid) {
        if (only && only.indexOf(iid) < 0) return;
        const sp = def.steppers[iid], input = doc.getElementById(iid);
        if (!input || !input.parentNode) { if (missing.indexOf(iid) < 0) missing.push(iid); return; }
        let c = stepperCache[iid];
        if (!c || c.input !== input) { c = buildStepper(sp, input); stepperCache[iid] = c; }
        nameStepper(c, sp);
        const saved = { readOnly: input.readOnly, inputmode: input.getAttribute('inputmode') };
        // the wrapper takes the input's place (the input may sit in a group or be a row item itself), then the input moves into it
        const home = input.parentNode, ref = input.nextSibling;
        take(iid, c.root, c.chevrons);
        home.insertBefore(c.root, ref);
        if (sp.noTyping) { input.readOnly = true; input.setAttribute('inputmode', 'none'); input.setAttribute('data-stepper', ''); }
        const d = { id: iid, input: input, root: c.root, saved: saved, undoDisplay: null };
        if (sp.display && sp.display.decimals >= 0) d.undoDisplay = showRounded(input, sp.display.decimals);
        if (!c.made) {
          const o = { input: input, keyEl: c.root, step: sp.step, noTyping: !!sp.noTyping, readonly: false };
          ['min', 'max', 'wrap', 'round'].forEach(function (k) { if (sp[k] !== undefined) o[k] = sp[k]; });
          if (sp.fixed >= 0) o.format = function (v) { return Number(v).toFixed(sp.fixed); };
          UI.stepper(c.root, o);
          c.made = true;
        }
        st.decorated.push(d);
      });
      if (typeof win.MutationObserver === 'function' && st.decorated.length) {
        st.lockObserver = new win.MutationObserver(function () { syncLocks(); });
        st.decorated.forEach(function (d) { st.lockObserver.observe(d.input, { attributes: true, attributeFilter: ['aria-disabled', 'data-reason'] }); });
      }
      syncLocks();
    }
    // A decorated input that its owner locks (UI.setDisabled on the INPUT: aria-disabled and the reason, ui-net.js's exact fields) disables its stepper with the same reason: UI.stepper does nothing while its root is
    // disabled, and a tap on a chevron shows the reason. ui-net.js's setLocked() leaves readOnly alone while the input carries data-stepper (this engine owns it then).
    function syncLocks() {
      const UI = win.UI;
      if (!UI || typeof UI.setDisabled !== 'function') return;
      eachSurface(function (st) {
        st.decorated.forEach(function (d) {
          const locked = d.input.getAttribute('aria-disabled') === 'true';
          UI.setDisabled(d.root, locked ? (d.input.dataset.reason || d.input.getAttribute('title') || '-') : null);
        });
      });
    }
    function undecorateSteppers(st) {
      if (st.lockObserver) st.lockObserver.disconnect();
      (st.decorated || []).forEach(function (d) {
        if (d.undoDisplay) d.undoDisplay();
        if (d.root.parentNode) d.root.parentNode.removeChild(d.root);
        if (win.UI && typeof win.UI.setDisabled === 'function') win.UI.setDisabled(d.root, null);
        d.input.removeAttribute('data-stepper');
        d.input.readOnly = d.saved.readOnly;
        if (d.saved.inputmode === null) d.input.removeAttribute('inputmode'); else d.input.setAttribute('inputmode', d.saved.inputmode);
      });
      const had = (st.decorated || []).length > 0;
      st.decorated = [];
      // the owner of a lock (ui-net.js) re-reads its state on its next tick; ask for that tick now so the plain fields are right at once
      if (had && typeof win.uiSync === 'function') win.uiSync();
    }
    // an item is hidden when it is, or when it holds element children and every one of them is (a wrapper whose only child sketch.js hides: the Alternate button in #net-geo-row)
    function itemHidden(n) {
      if (n.hidden) return true;
      const kids = n.children ? Array.prototype.slice.call(n.children) : [];
      return kids.length > 0 && kids.every(function (k) { return k.hidden; });
    }
    // config.overlays: an overlay that exists with its own UI.overlay (ui-net.js's #more-netz) gets the same rows as a sheet's content; its open state is its own (host kind 'overlay' of a surface, in either mode)
    // host.steppers: false = the host wraps none of the overlay's typed inputs into steppers; a list of ids = only those; absent = all (the phone). host.park: ids of the blocks that stay where they are, hidden with
    // their section (the Netz overlay at 768px and up, patterns C0b-4: the typed strength field is parked - the strength is edited in the panel's stepper - and the Fokus input is a fine stepper)
    function buildOverlay(oid, st, host) {
      const def = (config.overlays || {})[oid], content = def && doc.getElementById(def.content);
      if (!content) { if (def && missing.indexOf(def.content) < 0) missing.push(def.content); return; }
      if (def.blocks) buildBlocks(def, content, content, st, host && host.park);
      if (def.steppers && !(host && host.steppers === false)) decorateSteppers(def, st, host && Array.isArray(host.steppers) ? host.steppers : null);
    }
    // host kind 'group' (the colour trails at 768px and up): an existing group of the page (the Face Colors group) gets a row host of its own - made here, id and items from the config - and the containers a view made
    // (host.items) move into it. The group's own content stays where it is (the CSS parks it); its visibility stays whoever owns it (sketch.js hides the group while Fill is off). release() puts the items back
    // and removes the host.
    function buildGroup(host, st) {
      const group = doc.getElementById(host.id);
      if (!group) { if (missing.indexOf(host.id) < 0) missing.push(host.id); return; }
      const h = el('div', 'sr-host', { id: host.hostId });
      (host.items || []).forEach(function (id) { take(id, h); });
      group.appendChild(h);
      st.groupHosts.push(h);
      (host.items || []).forEach(afterShow);
    }
    // host kind 'content' (the timeline group at 768px and up): the blocks of a sheet are built inside the existing content element itself - no sheet host, no UI.overlay, no trigger sync: the element's own open state
    // (ts-open, flipped by the strip's "..." button's own handler) decides whether it is shown. host.blocks = which of the sheet's blocks (by number); release() takes them out again with the rest.
    function buildContent(host, st) {
      const def = (config.sheets || {})[host.sheet], content = def && doc.getElementById(def.content);
      if (!content) { if (def && missing.indexOf(def.content) < 0) missing.push(def.content); return; }
      const blocks = Array.isArray(host.blocks) ? host.blocks.map(function (i) { return def.blocks[i]; }).filter(Boolean) : def.blocks;
      if (blocks && blocks.length) buildBlocks(Object.assign({}, def, { blocks: blocks }), content, content, st);
    }
    function syncRows() {
      eachSurface(function (st) {
        st.sheetBlocks.forEach(function (blk) {
          let any = false;
          blk.rows.forEach(function (r) {
            const shown = r.ids.some(function (id) { const n = doc.getElementById(id); return !!n && !itemHidden(n) && (!r.gates[id] || (!!r.content.classList && r.content.classList.contains(r.gates[id]))); });
            if (r.el.hidden === shown) r.el.hidden = !shown;
            if (shown) any = true;
          });
          if (blk.el.hidden === any) blk.el.hidden = !any;
        });
      });
    }
    function buildSheet(sid, b, st) {
      const UI = win.UI;
      // without UI.overlay a block stays where it is (inline) - a sheet nobody can open would hide it
      if (!UI || typeof UI.overlay !== 'function') return;
      const def = config.sheets[sid], within = doc.getElementById(def.trigger.within), trigger = within && within.querySelector(def.trigger.selector);
      if (!trigger || !doc.getElementById(def.content)) { if (missing.indexOf(sid) < 0) missing.push(sid); return; }
      let h = sheetCache[sid];
      if (!h || h.trigger !== trigger) {
        h = { def: def, trigger: trigger, popup: trigger.getAttribute('aria-haspopup'), el: el('div', 'overlay ph-sheet', { id: def.host, role: 'dialog', 'aria-label': say(def.i18n, def.label) }) };   // popup: what the trigger had BEFORE UI.overlay marked it
        h.el.hidden = true;
        h.overlay = UI.overlay(trigger, h.el, { toggleOnClick: false, onClose: function () { if (sheetOpen(def)) trigger.click(); } });
        trigger.addEventListener('click', syncSheets);
        sheetCache[sid] = h;
      }
      h.trigger.setAttribute('aria-haspopup', 'dialog');   // UI.overlay set it when the host was made; release() took it away again (the trigger opens an inline block above 768px, not a dialog)
      b.stack.appendChild(h.el);
      const content = take(def.content, h.el);
      if (def.blocks && content) buildBlocks(def, h.el, content, st);
      if (def.steppers && content) decorateSteppers(def, st);
      st.sheets.push(h);
    }
    // surfaces(tab): the SURFACE REGISTRY (config.surfaces) in its order. mode 'phone' (the layout is on, b = what the layout built: the stack the sheet hosts go into) or 'inline' (768px and up, b = null: only a surface whose
    // switch `inlineOn` is true, and only a host that needs no stack). A surface's state exists as soon as it applies (its flag is set whether or not a host could be built, as `ph` always was).
    function buildSurfaces(tab, b, mode) {
      Object.keys(config.surfaces || {}).forEach(function (name) {
        const sf = config.surfaces[name];
        if (sf.tabs.indexOf(tab) < 0) return;
        if (mode === 'inline' && sf.inlineOn !== true) return;
        const host = (sf.hosts || {})[mode];
        if (!host) return;
        const st = surfaceState[name] = { name: name, mode: mode, flag: sf.flag || null, sheets: [], sheetBlocks: [], rowHosts: [], groupHosts: [], decorated: [], rowObserver: null, lockObserver: null };
        if (host.kind === 'sheet' && b) buildSheet(host.id, b, st);
        else if (host.kind === 'overlay') buildOverlay(host.id, st, host);
        else if (host.kind === 'group') buildGroup(host, st);
        else if (host.kind === 'content') buildContent(host, st);
        // host kind 'pane' (the trails): the layout's sub-tab pane holds the rows; nothing to build here
      });
    }
    function setSurfaceFlags() {
      const names = Object.keys(surfaceState);
      if (!names.length) return;
      html.classList.add('sr');
      names.forEach(function (n) { if (surfaceState[n].flag) html.classList.add(surfaceState[n].flag); });
    }
    function removeSurfaceFlags() {
      Object.keys(surfaceState).forEach(function (n) { if (surfaceState[n].flag) html.classList.remove(surfaceState[n].flag); delete surfaceState[n]; });
      html.classList.remove('sr');
    }

    // config.follow: an element that moved out of a block follows the `hidden` of the block it left (sketch.js still shows and hides the block). Only while the layout is on; release() puts the follower back.
    //   'hide'    (a string entry, or mode 'hide'): the follower is hidden when the block is.
    //   'disable' ({ of, mode: 'disable', reason }): the follower stays shown and is aria-disabled with the reason (UI.setDisabled) while the block is hidden. UI.stepper does nothing while its root is disabled.
    const disabledFollowers = new Map();   // id -> the title attribute it had before the engine disabled it (null = none)
    // a string of the bilingual dictionary (ui-i18n.js) in the current language, else the German text the config carries
    function say(key, fallback) { const i = win.uiI18n; return key && i && i.has(key) ? i.t(key) : fallback; }
    function followSpec(v) { return typeof v === 'string' ? { of: v, mode: 'hide' } : v; }
    function syncFollows() {
      if (!applied || !config.follow) return;
      Object.keys(config.follow).forEach(function (id) {
        const f = followSpec(config.follow[id]), node = doc.getElementById(id), src = doc.getElementById(f.of);
        if (!(node && src && moved.has(id))) return;
        if (f.mode === 'disable') {
          const UI = win.UI;
          if (!UI || typeof UI.setDisabled !== 'function') return;
          if (src.hidden) {
            if (!disabledFollowers.has(id)) disabledFollowers.set(id, node.getAttribute('title'));
            UI.setDisabled(node, say(f.i18n, f.reason));
          } else if (disabledFollowers.has(id)) unfollowDisable(id, node);
        } else if (node.hidden !== src.hidden) node.hidden = src.hidden;
      });
    }
    function unfollowDisable(id, node) {
      const UI = win.UI, title = disabledFollowers.get(id);
      disabledFollowers.delete(id);
      if (UI && typeof UI.setDisabled === 'function') UI.setDisabled(node, null);
      if (title === null) node.removeAttribute('title'); else node.setAttribute('title', title);   // setDisabled leaves an empty title where there was none
    }

    // apply(tab) = layout(tab) + surfaces(tab). Below 768px for a covered tab the layout is built (build(): the page layout, then the surfaces in their phone hosts) and every surface of the tab is applied;
    // at 768px and up (or for a tab that is not covered) the layout is released and only a surface whose inline switch is on is applied (none: every switch is off).
    function apply(tab) {
      const t = config.tabs[tab];
      if (!mq.matches || !t || !t.covered) { release(); surfacesInline(tab); return false; }
      if (applied === tab && built) { setInnerHeight(); return true; }
      if (applied || inlineTab) release();
      keepFocus(function () {
        built = build(tab);
        if (!built) { restoreAll(); return; }
        applied = tab;
        if (firstApplyState === null) firstApplyState = doc.readyState || null;
        html.classList.add('ph');
        setSurfaceFlags();
        layoutSwitched();
        html.style.setProperty('--panel-h', t.panelH + 'px');
        setInnerHeight();
        show(remembered[tab] || t.defaultSubtab);
        syncSheets();
        syncFollows();
        syncRows();
      });
      return applied === tab;
    }

    // surfaces(tab) without the layout: the surfaces of the tab whose inline switch is on, in their inline hosts (none today). Idempotent for the same tab.
    function surfacesInline(tab) {
      if (inlineTab === tab) return false;
      if (inlineTab) release();
      const on = Object.keys(config.surfaces || {}).some(function (n) { const sf = config.surfaces[n]; return sf.tabs.indexOf(tab) >= 0 && sf.inlineOn === true && (sf.hosts || {}).inline; });
      if (!on) return false;
      keepFocus(function () {
        buildSurfaces(tab, null, 'inline');
        inlineTab = tab;
        setSurfaceFlags();
        syncRows(); syncLocks();
      });
      return true;
    }

    function release() {
      if (!applied && !built && !moved.size && !inlineTab && !Object.keys(surfaceState).length) return false;
      keepFocus(function () {
        // an open sheet closes first (its close also closes the block's own state), then the blocks go back
        eachSurface(function (st) { st.sheets.forEach(function (h) { if (h.overlay.isOpen) h.overlay.close(false); }); });
        if (config.follow) Object.keys(config.follow).forEach(function (id) {
          const n = moved.has(id) ? doc.getElementById(id) : null;
          if (!n) return;
          if (disabledFollowers.has(id)) unfollowDisable(id, n); else if (followSpec(config.follow[id]).mode !== 'disable' && n.hidden) n.hidden = false;
        });
        if (built && built.labelsSaved) built.labelsSaved.forEach(function (o) {
          [['aria-label', o.label], ['title', o.title], ['data-i18n', o.i18n]].forEach(function (a) { if (a[1] === null) o.node.removeAttribute(a[0]); else o.node.setAttribute(a[0], a[1]); });
        });
        eachSurface(function (st) { if (st.rowObserver) st.rowObserver.disconnect(); });
        restoreAll();
        eachSurface(function (st) {
          undecorateSteppers(st);
          st.sheetBlocks.forEach(function (blk) { if (blk.el.parentNode) blk.el.parentNode.removeChild(blk.el); });
          st.rowHosts.forEach(function (h) { h.classList.remove('ph-sheet-rows'); });
          (st.groupHosts || []).forEach(function (h) { if (h.parentNode) h.parentNode.removeChild(h); });
        });
        if (built) {
          built.proxied.forEach(function (node) { delete node.focus; });
          if (built.openerSaved) {
            const o = built.openerSaved;
            [['aria-label', o.label], ['title', o.title], ['data-i18n', o.i18n]].forEach(function (a) { if (a[1] === null) o.node.removeAttribute(a[0]); else o.node.setAttribute(a[0], a[1]); });
          }
          if (built.settingsRow && built.settingsRow.parentNode) built.settingsRow.parentNode.removeChild(built.settingsRow);
          if (built.sheetRow && built.sheetRow.parentNode) built.sheetRow.parentNode.removeChild(built.sheetRow);
          if (built.stack.parentNode) built.stack.parentNode.removeChild(built.stack);
        }
        // UI.overlay marked every sheet's trigger aria-haspopup="dialog" and cannot undo it: above 768px the trigger opens the inline block again, so the attribute goes (or the value it had before comes back)
        Object.keys(sheetCache).forEach(function (sid) { const h = sheetCache[sid]; if (h.popup === null || h.popup === undefined) h.trigger.removeAttribute('aria-haspopup'); else h.trigger.setAttribute('aria-haspopup', h.popup); });
        const hadLayout = !!built;
        built = null;
        applied = null;
        inlineTab = null;
        removeSurfaceFlags();
        html.classList.remove('ph');
        html.style.removeProperty('--panel-h');
        html.style.removeProperty('--ph-inner-h');
        if (hadLayout) layoutSwitched();   // the views look at the final state (no html.ph)
      });
      return true;
    }

    function show(sid) {
      if (!built || !applied) return false;
      const t = config.tabs[applied];
      if (t.subtabs.indexOf(sid) < 0) return false;
      // a control that is parked cannot keep the focus (it is display: none now): the focus goes to the sub-tab button that was used, like on any tab bar
      const had = doc.activeElement;
      let lost = false;
      built.order.forEach(function (id) {
        const pane = built.panes[id], btn = built.buttons[id];
        if (id === sid) {
          if (pane.parentNode !== built.slot) built.slot.appendChild(pane);
          btn.setAttribute('aria-current', 'true');
        } else {
          if (pane.parentNode !== built.park) { if (had && pane.contains(had)) lost = true; built.park.appendChild(pane); }
          btn.removeAttribute('aria-current');
        }
      });
      built.slot.setAttribute('aria-labelledby', 'ph-subtab-' + sid);
      if (lost) built.buttons[sid].focus();
      remembered[applied] = sid;
      config.subtabs[sid].rows.forEach(function (row) { row.items.forEach(function (it) { afterShow(it.id); }); });
      return true;
    }
    // views whose UI state belongs to one arrangement (config.layoutSwitch): told when the phone layout is built or released
    function layoutSwitched() {
      (config.layoutSwitch || []).forEach(function (h) { const g = win[h[0]]; if (g && typeof g[h[1]] === 'function') g[h[1]](); });
    }
    // the view that made an element may want to look again once it has moved into a visible place (config.afterShow)
    function afterShow(id) {
      const hook = config.afterShow && config.afterShow[id], g = hook && win[hook[0]];
      if (g && typeof g[hook[1]] === 'function') g[hook[1]]();
    }

    // nav.js writes html[data-tab] in every show(), the first one on DOMContentLoaded; uiNav.current() already says 'form' before that (its default), which may not be the tab the URL asks for
    function currentTab() { return html.getAttribute('data-tab') || null; }
    function sync(tab) { return apply(tab || currentTab()); }

    function start() {
      if (started) return;
      started = true;
      doc.addEventListener('tabchange', function (e) { sync(e && e.detail && e.detail.tab); });
      const onMq = function () { sync(); };
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
      if (win.addEventListener) { win.addEventListener('resize', onMq); win.addEventListener('orientationchange', onMq); }
      if (win.UI && typeof win.UI.onSync === 'function') win.UI.onSync(function () { syncSheets(); syncFollows(); });
      if (currentTab()) sync();
    }

    function state() {
      return { applied: applied, sub: applied ? remembered[applied] || null : null, moved: Array.from(moved.keys()), missing: missing.slice(), firstApplyState: firstApplyState, remembered: Object.assign({}, remembered), surfaces: Object.keys(surfaceState), surfaceTab: inlineTab || applied };
    }
    return { apply: apply, release: release, show: show, sync: sync, start: start, state: state };
  }

  const api = { createPhone: createPhone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined' && typeof window !== 'undefined' && root.PHONE_CONFIG) {
    root.uiPhone = createPhone(document, window, root.PHONE_CONFIG);
    root.uiPhone.start();
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
