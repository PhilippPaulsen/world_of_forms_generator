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
 *   sheets         config.sheets: blocks that become bottom sheets (UI.overlay) while the layout is on; see buildSheets().
 *   start()        listens: 'tabchange' on document (nav.js), the media query, resize / orientationchange; applies for the current tab.
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
      b.toolRow = el('div', 'ph-toolrow', { id: 'ph-toolrow', role: 'group', 'aria-label': 'Werkzeuge' });
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
      b.subtabs = el('nav', 'ph-subtabs', { id: 'ph-subtabs', 'aria-label': 'Unterbereiche' });
      t.subtabs.forEach(function (sid) {
        const btn = el('button', 'ph-subtab', { type: 'button', id: 'ph-subtab-' + sid, 'aria-controls': 'ph-slot' });
        btn.textContent = config.subtabs[sid].label;
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
            opener.setAttribute('aria-label', tr.sheet.openerLabel.text); opener.setAttribute('title', tr.sheet.openerLabel.text);
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
        node.setAttribute('aria-label', l.text); node.setAttribute('title', l.text);
        if (l.i18n) node.setAttribute('data-i18n', l.i18n);
      });
      buildSheets(t, b);
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
    function syncSheets() {
      if (!built || !built.sheets) return;
      built.sheets.forEach(function (h) {
        const want = sheetOpen(h.def);
        if (want && !h.overlay.isOpen) h.overlay.open();
        else if (!want && h.overlay.isOpen) h.overlay.close(!!(doc.activeElement && h.el.contains(doc.activeElement)));
      });
    }
    function buildSheets(t, b) {
      b.sheets = [];
      const UI = win.UI;
      if (!(t.sheets && t.sheets.length)) return;
      // without UI.overlay a block stays where it is (inline) - a sheet nobody can open would hide it
      if (!UI || typeof UI.overlay !== 'function') return;
      t.sheets.forEach(function (sid) {
        const def = config.sheets[sid], within = doc.getElementById(def.trigger.within), trigger = within && within.querySelector(def.trigger.selector);
        if (!trigger || !doc.getElementById(def.content)) { if (missing.indexOf(sid) < 0) missing.push(sid); return; }
        let h = sheetCache[sid];
        if (!h || h.trigger !== trigger) {
          h = { def: def, trigger: trigger, el: el('div', 'overlay ph-sheet', { id: def.host, role: 'dialog', 'aria-label': def.label }) };
          h.el.hidden = true;
          h.overlay = UI.overlay(trigger, h.el, { toggleOnClick: false, onClose: function () { if (sheetOpen(def)) trigger.click(); } });
          trigger.addEventListener('click', syncSheets);
          sheetCache[sid] = h;
        }
        b.stack.appendChild(h.el);
        take(def.content, h.el);
        b.sheets.push(h);
      });
    }

    // config.follow: an element that moved out of a block follows the `hidden` of the block it left (sketch.js still shows and hides the block). Only while the layout is on; release() puts the follower back.
    //   'hide'    (a string entry, or mode 'hide'): the follower is hidden when the block is.
    //   'disable' ({ of, mode: 'disable', reason }): the follower stays shown and is aria-disabled with the reason (UI.setDisabled) while the block is hidden. UI.stepper does nothing while its root is disabled.
    const disabledFollowers = new Map();   // id -> the title attribute it had before the engine disabled it (null = none)
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
            UI.setDisabled(node, f.reason);
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

    function apply(tab) {
      const t = config.tabs[tab];
      if (!mq.matches || !t || !t.covered) { release(); return false; }
      if (applied === tab && built) { setInnerHeight(); return true; }
      if (applied) release();
      keepFocus(function () {
        built = build(tab);
        if (!built) { restoreAll(); return; }
        applied = tab;
        if (firstApplyState === null) firstApplyState = doc.readyState || null;
        html.classList.add('ph');
        html.style.setProperty('--panel-h', t.panelH + 'px');
        setInnerHeight();
        show(remembered[tab] || t.defaultSubtab);
        syncSheets();
        syncFollows();
      });
      return applied === tab;
    }

    function release() {
      if (!applied && !built && !moved.size) return false;
      keepFocus(function () {
        // an open sheet closes first (its close also closes the block's own state), then the blocks go back
        if (built && built.sheets) built.sheets.forEach(function (h) { if (h.overlay.isOpen) h.overlay.close(false); });
        if (config.follow) Object.keys(config.follow).forEach(function (id) {
          const n = moved.has(id) ? doc.getElementById(id) : null;
          if (!n) return;
          if (disabledFollowers.has(id)) unfollowDisable(id, n); else if (followSpec(config.follow[id]).mode !== 'disable' && n.hidden) n.hidden = false;
        });
        if (built && built.labelsSaved) built.labelsSaved.forEach(function (o) {
          [['aria-label', o.label], ['title', o.title], ['data-i18n', o.i18n]].forEach(function (a) { if (a[1] === null) o.node.removeAttribute(a[0]); else o.node.setAttribute(a[0], a[1]); });
        });
        restoreAll();
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
        built = null;
        applied = null;
        html.classList.remove('ph');
        html.style.removeProperty('--panel-h');
        html.style.removeProperty('--ph-inner-h');
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
      config.subtabs[sid].rows.forEach(function (row) {
        row.items.forEach(function (it) {
          const hook = config.afterShow && config.afterShow[it.id], g = hook && win[hook[0]];
          if (g && typeof g[hook[1]] === 'function') g[hook[1]]();
        });
      });
      return true;
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
      return { applied: applied, sub: applied ? remembered[applied] || null : null, moved: Array.from(moved.keys()), missing: missing.slice(), firstApplyState: firstApplyState, remembered: Object.assign({}, remembered) };
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
