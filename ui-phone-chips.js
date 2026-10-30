/*
 * The Spuren view of the phone layout (phone layout, commit 2): one chip per face trail, and a stepper for the SELECTED trail. UI only.
 *
 * The MODEL is the existing list #face-colors-list (sketch.js renderFaceColorsPanel() renders one .fc-row per trail: a swatch, a label "Trail k · m faces", a "default" tag and, when the sheet is
 * coloured by a harmony, the per-trail stepper: two buttons around "n/N"). Nothing here changes or clones those rows: this file READS them (the colour of the swatch, the numbers of the label and of the
 * counter) and shows its own small view, and the two stepper buttons FORWARD their click to the row's own buttons, so the colour is changed by the same handlers as ever.
 *
 *   trailModel(rows, state)   PURE. rows = [{ key, color, faceCount, k, n, stepper }] (readRows() makes them from the DOM) -> { empty, chips, selected, label, count, canStep }. The selection is UI state (not saved):
 *                             by KEY while the trail is still there, else the index clamped into 0..rows-1 (the first trail by default).
 *   trailSignature(rows, sel) a string: the view is rebuilt only when it changed (UI.onSync ticks; no MutationObserver).
 *   createChips(doc, win, opts)  the DOM part: makes #ph-trail-chips and #ph-trail-stepper (put in a hidden holder at once, ui-phone.js moves them into the panel and back), rebuilds on sync()/refresh().
 *   selectedTrail()           { index, key, color, faceCount } or null.
 *   highlightFor(ctx)         PURE. The trail to outline on the canvas: { sheet, key } or null. ctx = { phone, tab, shown, rows, selection, sheet }: only while the phone layout is on, the tab is Farbe, the
 *                             Spuren pane is the one SHOWN (its chips are in the panel slot), and the model has rows (Fill off, a refused or empty sheet give none); the key is the selected trail's (the
 *                             selection is clamped, so a vanished trail gives the clamped one). The view passes it to window.setFaceSelected(sheet, key | null) (sketch.js: the own slot faceSelected,
 *                             never faceHover) only when it CHANGED, on every UI tick, after every click that reaches the document (a sub-tab switch redraws nothing) and, deferred, after a resize or a tab
 *                             change (the engine releases or applies in its own listener). The view holds no reference into the model: the key is read from row.dataset.key.
 *
 *   hoverStep(state, ev)      PURE (patterns C0b-5, the hover of the model rows kept on the chips). state = { key }: the trail whose row got a forwarded `mouseenter` (null = none). ev = { type: 'enter', key,
 *                             pointerType } | { type: 'leave', key } | { type: 'clear' } (a rebuild of the chip bar, the surface released, the group hidden, the tab left) | { type: 'click', key } | { type: 'forget' }. -> { state, send: [{ type: 'mouseenter' |
 *                             'mouseleave', key }] }. Only a MOUSE pointer enters (a touch or a pen never does: the mouse events a tap emulates must not leave a hover); an enter on another trail leaves the first.
 *                             The view sends each event to the model row, looked up FRESHLY by its key at that moment (a plain MouseEvent that does not bubble: sketch.js's own listeners set and clear faceHover,
 *                             this view never writes it); the hover wins over the selection while it lasts (faceHighlightKeyFor), the selection shows again when the hover ends.
 *                             A CLICK MUST WORK AT ONCE (patterns T1): a click rebuilds the chip bar, and the browser then fires a pointerenter on the NEW chip under the resting mouse, whose hover would show the
 *                             outline the click just switched off. So a click on the chip a MOUSE hovers sets state.ignore = its key (a touch or keyboard click has no hover and sets nothing): the next enter
 *                             of that key is ignored (no mouseenter, no hover) until its pointer LEAVES it (state.ignore is cleared by the leave of that key, by the enter of ANOTHER chip, by 'forget': the chip
 *                             is gone after a rebuild, the surface released or the group hidden). 'clear' keeps it (the click's own rebuild clears the hover and must not drop the flag). Another chip's hover
 *                             works at once. The state is { key } while nothing is ignored, { key, ignore } while a chip is.
 *
 *   outlineStep(state, ev)    PURE (patterns T1, a second click on the selected chip switches the OUTLINE off). state = { outline, sheet, ph } (view state, never saved; outline defaults to ON). ev = { type: 'click',
 *                             same } (a click on a chip: the SELECTED one toggles the outline, an unselected one is selected and outlines) | { type: 'look', active, sheet, ph } (every look of the view: active = the
 *                             trails surface is applied, the tab is Farbe and the group is shown, i.e. Fill is on; the outline goes back ON when it is not active (released, the tab left, Fill off), when the active
 *                             sheet changed since the last look or when html.ph changed (the layout was built or released: a resize across 768px)) | { type: 'rows', gone } (the selected trail is not in the rows any
 *                             more: the clamped trail is selected and outlines). The SELECTION is not part of it: with the outline OFF the chip stays selected (black), the stepper still acts on that trail, and
 *                             highlightFor() gives null (ctx.outline === false), which the view passes on as setFaceSelected(null, null). The hover (faceHover) never reads it and still wins while it lasts.
 *                             The selected chip's aria-pressed says the outline: 'true' = ON.
 *
 * The German texts are keyed (data-i18n): trails.none, trails.label.one / .other, trails.prev, trails.next, trails.group.
 */
(function (root) {
  'use strict';

  const T = {
    'trails.none': 'Keine Flächen',
    'trails.label.one': 'Spur {k} · {m} Fläche',
    'trails.label.other': 'Spur {k} · {m} Flächen',
    'trails.prev': 'Vorherige Farbe dieser Spur',
    'trails.next': 'Nächste Farbe dieser Spur',
    'trails.group': 'Spuren'
  };
  const fill = (s, k, m) => s.replace('{k}', String(k)).replace('{m}', String(m));
  // a string of the bilingual dictionary (ui-i18n.js) in the current language; the German table above is the fallback (this file is also loaded without it, in a Node test)
  function tt(key, params) { const i = root.uiI18n; return i && i.has(key) ? i.t(key, params) : (params ? fill(T[key], params.k, params.m) : T[key]); }

  // ---- the pure part ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function labelFor(k, m) { return tt(m === 1 ? 'trails.label.one' : 'trails.label.other', { k: k, m: m }); }

  // state = { key, index }: the selected trail as the view last knew it. Returns the new selection {key, index} (clamped) for the rows.
  function resolveSelection(rows, state) {
    if (!rows.length) return { key: null, index: 0 };
    const st = state || {};
    if (st.key !== null && st.key !== undefined) { const at = rows.findIndex(r => r.key === st.key); if (at >= 0) return { key: rows[at].key, index: at }; }
    const index = Math.max(0, Math.min(rows.length - 1, Number.isInteger(st.index) ? st.index : 0));
    return { key: rows[index].key, index };
  }

  function trailModel(rows, state) {
    rows = rows || [];
    const sel = resolveSelection(rows, state);
    const chips = rows.map((r, i) => ({ index: i, number: i + 1, key: r.key, color: r.color, selected: i === sel.index && rows.length > 0, label: labelFor(i + 1, r.faceCount) }));
    const cur = rows[sel.index] || null;
    return {
      empty: rows.length === 0,
      chips,
      selected: rows.length ? sel : { key: null, index: 0 },
      label: cur ? labelFor(sel.index + 1, cur.faceCount) : '',
      count: cur && cur.stepper ? (cur.n === null ? '–' : String(cur.n)) + '/' + cur.stepper : '',
      canStep: !!(cur && cur.stepper)
    };
  }

  function highlightFor(ctx) {
    const c = ctx || {};
    if (!c.phone || c.tab !== 'farbe' || !c.shown) return null;
    const rows = c.rows || [];
    if (!rows.length) return null;
    const sel = resolveSelection(rows, c.selection);
    if (sel.key === null || sel.key === undefined) return null;
    if (c.outline === false) return null;   // the selection stays, only the outline is off (patterns T1); undefined = ON
    return { sheet: c.sheet === undefined || c.sheet === null ? 'base' : c.sheet, key: sel.key };
  }

  function hoverStep(state, ev) {
    const cur = state && state.key !== undefined && state.key !== null ? state.key : null, ign = state && state.ignore !== undefined && state.ignore !== null ? state.ignore : null;
    const mk = function (key, ig) { return ig === null ? { key: key } : { key: key, ignore: ig }; };
    const none = { state: mk(cur, ign), send: [] };
    if (!ev) return none;
    if (ev.type === 'enter') {
      if (ev.pointerType !== 'mouse' || ev.key === null || ev.key === undefined) return none;
      if (ign !== null && ev.key === ign) return none;   // the chip a click just rebuilt under the resting mouse: no hover until the pointer has left it
      if (cur === ev.key) return none;
      const send = cur !== null ? [{ type: 'mouseleave', key: cur }] : [];
      send.push({ type: 'mouseenter', key: ev.key });
      return { state: mk(ev.key, null), send: send };   // another chip entered: nothing is ignored any more
    }
    if (ev.type === 'leave') {
      const ig = ev.key !== undefined && ev.key === ign ? null : ign;
      return cur !== null && (ev.key === undefined || ev.key === cur) ? { state: mk(null, ig), send: [{ type: 'mouseleave', key: cur }] } : { state: mk(cur, ig), send: [] };
    }
    if (ev.type === 'clear') return cur !== null ? { state: mk(null, ign), send: [{ type: 'mouseleave', key: cur }] } : none;
    if (ev.type === 'click') return cur !== null && ev.key === cur ? { state: mk(cur, ev.key), send: [] } : none;
    if (ev.type === 'forget') return { state: mk(cur, null), send: [] };
    return none;
  }

  function outlineStep(state, ev) {
    const st = state || {}, cur = { outline: st.outline !== false, sheet: st.sheet === undefined ? null : st.sheet, ph: st.ph === undefined ? null : st.ph };
    if (!ev) return cur;
    if (ev.type === 'click') return { outline: ev.same ? !cur.outline : true, sheet: cur.sheet, ph: cur.ph };
    if (ev.type === 'rows') return { outline: ev.gone ? true : cur.outline, sheet: cur.sheet, ph: cur.ph };
    if (ev.type === 'look') {
      const sheet = ev.sheet === undefined ? null : ev.sheet, ph = ev.ph === undefined ? null : ev.ph;
      const reset = !ev.active || (cur.sheet !== null && sheet !== cur.sheet) || (cur.ph !== null && ph !== cur.ph);
      return { outline: reset ? true : cur.outline, sheet: sheet, ph: ph };
    }
    return cur;
  }

  function trailSignature(rows, sel, extra) {
    return JSON.stringify([(rows || []).map(r => [r.key, r.color, r.faceCount, r.n, r.stepper]), sel && sel.index, sel && sel.key, extra || null]);
  }

  // ---- reading the model rows (the DOM) ---------------------------------------------------------------------------------------------------------------------------------------------------
  // a row = .fc-row: .fc-swatch (inline background), .fc-label "Trail k · m face(s)", and, with a stepper, .pairing-variant > .pairing-move-btn x2 + .pairing-variant-count (data-k, data-c)
  function readRows(listEl) {
    const out = [];
    if (!listEl) return out;
    Array.prototype.forEach.call(listEl.children || [], function (row, i) {
      const sw = row.querySelector('.fc-swatch'), lab = row.querySelector('.fc-label'), cnt = row.querySelector('.pairing-variant-count');
      const m = lab && /(\d+)\s+face/.exec(lab.textContent || '');
      const color = (sw && sw.style && (sw.style.backgroundColor || sw.style.background)) || '';
      let n = null, c = 0;
      if (cnt) { c = parseInt(cnt.dataset && cnt.dataset.c, 10) || 0; const txt = cnt.textContent || ''; n = /^\d/.test(txt) ? parseInt(txt, 10) : null; }
      out.push({ key: (row.dataset && row.dataset.key) || String(i), color: color, faceCount: m ? parseInt(m[1], 10) : 0, n: n, stepper: c });
    });
    return out;
  }

  // ---- the DOM part -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function createChips(doc, win, opts) {
    opts = opts || {};
    const html = doc.documentElement;
    let selected = { key: null, index: 0 };
    let ostate = { outline: true, sheet: null, ph: null };   // the outline on/off (outlineStep); the selection above is independent of it
    let signature = null;
    let model = trailModel([], selected);

    function el(tag, cls, attrs) { const e = doc.createElement(tag); if (cls) e.className = cls; if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
    function text(key) { return tt(key); }
    const UI = win.UI;

    // the two containers live in a hidden holder until ui-phone.js moves them into the panel (the holder is `hidden`: nothing of them is visible or in the Tab order outside the phone layout)
    const holder = el('div', 'ph-chip-home', { id: 'ph-chip-home' });
    holder.hidden = true;
    const chips = el('div', 'ph-chips', { id: 'ph-trail-chips', role: 'group', 'aria-label': text('trails.group'), 'data-i18n': 'trails.group' });
    const stepper = el('div', 'ph-trail-stepper', { id: 'ph-trail-stepper', role: 'group', 'aria-label': text('trails.group') });
    function stepButton(cls, key, dir, path) {
      const b = el('button', 'icon-btn ph-trail-btn ' + cls, { type: 'button', 'data-i18n': key });
      b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="' + path + '"/></svg>';
      if (UI && UI.name) UI.name(b, text(key)); else { b.setAttribute('aria-label', text(key)); b.setAttribute('title', text(key)); }
      const go = function () { forward(dir); };
      if (UI && UI.guard) UI.guard(b, go); else b.addEventListener('click', go);
      return b;
    }
    const prev = stepButton('ph-trail-prev', 'trails.prev', -1, 'M15 5 L8 12 L15 19');
    const count = el('span', 'ph-trail-count', { 'aria-live': 'polite' });
    const next = stepButton('ph-trail-next', 'trails.next', 1, 'M9 5 L16 12 L9 19');
    const label = el('span', 'ph-trail-label');
    [prev, count, next, label].forEach(function (n) { stepper.appendChild(n); });
    holder.appendChild(chips);
    holder.appendChild(stepper);
    (opts.home || doc.body).appendChild(holder);

    function listEl() { return doc.getElementById('face-colors-list'); }
    function groupHidden() { const g = doc.getElementById('face-colors-group'); return !g || g.hidden; }
    // the rows the view may show: none while the panel is hidden (Fill is off: its rows are stale then)
    function currentRows() { return groupHidden() ? [] : readRows(listEl()); }
    function reasonNow() {
      if (typeof win.farbeReason === 'function') { const r = win.farbeReason(); if (r) return r; }
      return model.empty ? text('trails.none') : null;
    }

    // forwards a step to the model row's own button (the same handler as ever), then reads the rebuilt rows
    function forward(dir) {
      const rows = listEl() && listEl().children;
      const row = rows && rows[model.selected.index];
      if (!row) return;
      const btns = row.querySelectorAll('.pairing-move-btn');
      const b = btns[dir < 0 ? 0 : 1];
      if (b) b.click();
      refresh(true);
    }
    // a click on the SELECTED chip toggles the outline (the selection stays); a click on another chip selects it and outlines it
    function select(i) { const r = currentRows()[i]; if (!r) return; ostate = outlineStep(ostate, { type: 'click', same: r.key === selected.key }); selected = { key: r.key, index: i }; refresh(true); }

    // ---- the hover (a mouse over a chip does what a mouse over the model row does) ----------------------------------------------------------------------------------------------------------
    // the model row is looked up by its key when the event is sent (the rows are replaced whenever sketch.js rebuilds the panel; nothing is kept); a display:none row takes the event like any other
    let hover = { key: null };
    function rowByKey(key) { const l = listEl(); return l ? Array.prototype.find.call(l.children || [], function (r) { return r.dataset && r.dataset.key === key; }) || null : null; }
    function applyHover(ev) {
      const r = hoverStep(hover, ev);
      hover = r.state;
      r.send.forEach(function (m) {
        const row = rowByKey(m.key), Ev = win.MouseEvent;
        if (row && typeof Ev === 'function') row.dispatchEvent(new Ev(m.type, { bubbles: false, cancelable: false, view: win }));
      });
      return r.send.length > 0;
    }

    // ---- the outline of the selected trail on the canvas ---------------------------------------------------------------------------------------------------------------------------------
    // the chips are shown while they are NOT in their hidden holder and no ancestor is hidden: on the phone that is while the Spuren pane is the shown one (a parked pane sits in the hidden #ph-park, and after release() they are
    // back in their holder); where a surface host holds them at 768px and up it is while that host is not hidden (the Face Colors group is hidden with Fill off)
    function shownNow() { if (!chips.parentNode) return false; for (let n = chips; n; n = n.parentNode) { if (n === holder || n.hidden) return false; } return true; }
    function sheetNow() { return typeof win.activeLayerNow === 'function' ? win.activeLayerNow() : 'base'; }
    let outlined = null;   // what this view last passed to setFaceSelected: { sheet, key } or null
    function syncHighlight() {
      const phone = html.classList.contains('sr-trails'), tab = html.getAttribute('data-tab'), shown = phone && tab === 'farbe' && shownNow();   // the rows are read only when they can matter
      // the outline goes back ON when the surface is released, the tab is left, Fill is off, the active sheet changed or the layout was built or released (a sub-tab switch on the phone is none of these)
      const sheet = sheetNow();
      ostate = outlineStep(ostate, { type: 'look', active: phone && tab === 'farbe' && !groupHidden(), sheet: sheet, ph: html.classList.contains('ph') });
      if (!shown) { applyHover({ type: 'clear' }); applyHover({ type: 'forget' }); }   // the chips are away (Fill off, another tab, released): no hover is left on a row and no chip is ignored
      const want = highlightFor({ phone: phone, tab: tab, shown: shown, rows: shown ? currentRows() : [], selection: selected, sheet: sheet, outline: ostate.outline });
      const same = want === null ? outlined === null : (outlined !== null && outlined.sheet === want.sheet && outlined.key === want.key);
      if (same) return false;
      outlined = want;
      if (typeof win.setFaceSelected === 'function') win.setFaceSelected(want ? want.sheet : null, want ? want.key : null);
      return true;
    }

    function render() {
      let activeNode = null;
      applyHover({ type: 'clear' });   // the chips about to be replaced may be hovered: leave the row first (a removed element sends no pointerleave)
      // a chip that has the focus is replaced with the bar: the focus goes to the chip with the same index afterwards (a keyboard user who presses Enter on a chip stays on it)
      const focused = doc.activeElement && doc.activeElement.parentNode === chips ? doc.activeElement.getAttribute('data-index') : null;
      while (chips.firstChild) chips.removeChild(chips.firstChild);
      if (model.empty) {
        // at 768px and up the Face Colors group's own status line is parked: when faces are unavailable (curve or free mode, a Single or Tiled net, a hidden layer) the muted line says why, as the group did (sketch.js's text,
        // read as data through farbeReason); on the phone it stays "Keine Flächen"
        const why = !html.classList.contains('ph') && typeof win.farbeReason === 'function' ? win.farbeReason() : null;
        const none = el('span', 'ph-chips-empty', why ? { title: why } : { 'data-i18n': 'trails.none' });
        none.textContent = why || text('trails.none');
        chips.appendChild(none);
      } else {
        model.chips.forEach(function (c) {
          const b = el('button', 'ph-chip', { type: 'button', 'aria-pressed': c.selected && ostate.outline ? 'true' : 'false', 'aria-label': c.label, title: c.label, 'data-index': String(c.index) });
          if (c.selected) { b.className += ' active'; activeNode = b; }
          b.textContent = String(c.number);
          const bar = el('span', 'ph-chip-bar', { 'aria-hidden': 'true' });
          bar.style.background = c.color;
          b.appendChild(bar);
          const idx = c.index, key = c.key;
          b.addEventListener('click', function () { applyHover({ type: 'click', key: key }); select(idx); });
          b.addEventListener('pointerenter', function (e) { applyHover({ type: 'enter', key: key, pointerType: e.pointerType }); });
          b.addEventListener('pointerleave', function () { applyHover({ type: 'leave', key: key }); });
          chips.appendChild(b);
        });
      }
      if (focused !== null) { const again = Array.prototype.find.call(chips.children, function (c) { return c.getAttribute('data-index') === focused; }); if (again && typeof again.focus === 'function') { try { again.focus({ preventScroll: true }); } catch (e) { again.focus(); } } }
      if (hover.ignore !== undefined && !model.chips.some(function (c) { return c.key === hover.ignore; })) applyHover({ type: 'forget' });   // the ignored chip is gone with this rebuild
      count.textContent = model.count;
      label.textContent = model.label;
      const why = reasonNow();
      [prev, next].forEach(function (b) { if (UI && UI.setDisabled) UI.setDisabled(b, why || (model.canStep ? null : text('trails.none'))); });
      // the selected chip stays in view
      if (activeNode && typeof activeNode.scrollIntoView === 'function' && chips.scrollWidth > chips.clientWidth) { try { activeNode.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* older browsers: no options */ } }
    }

    // sync(): on every UI.onSync tick (cheap: a signature compare); refresh(force): after a tap or when the pane is shown
    function refresh(force) {
      const rows = currentRows();
      if (selected.key !== null && !rows.some(function (r) { return r.key === selected.key; })) ostate = outlineStep(ostate, { type: 'rows', gone: true });   // the selected trail vanished: the clamped one outlines
      selected = resolveSelection(rows, selected);
      const sig = trailSignature(rows, selected, [typeof win.farbeReason === 'function' ? win.farbeReason() : null, ostate.outline]);
      if (!force && sig === signature) { syncHighlight(); return false; }
      signature = sig;
      model = trailModel(rows, selected);
      render();
      syncHighlight();
      return true;
    }
    function sync() {
      if (!html.classList.contains('sr-trails') || html.getAttribute('data-tab') !== 'farbe') { syncHighlight(); return false; }   // nothing to keep up to date outside the Farbe phone layout (but a stale outline goes)
      return refresh(false);
    }
    function selectedTrail() {
      const rows = currentRows();
      const s = resolveSelection(rows, selected);
      const r = rows[s.index];
      return r ? { index: s.index, key: r.key, color: r.color, faceCount: r.faceCount } : null;
    }
    if (UI && UI.onSync) UI.onSync(sync);
    // a sub-tab switch, a Fill tap or a layer tap redraws nothing, so no tick comes: every click that reaches the document looks again (the engine's own click handler has run by then);
    // a resize and a tab change are followed by the engine's release / apply, which runs in ITS listener: look again after it (deferred)
    const defer = opts.defer || function (fn) { setTimeout(fn, 0); };
    if (doc.addEventListener) { doc.addEventListener('click', function () { syncHighlight(); }); doc.addEventListener('tabchange', function () { defer(syncHighlight); }); }
    if (win.addEventListener) { win.addEventListener('resize', function () { defer(syncHighlight); }); }
    refresh(true);
    return { sync: sync, syncHighlight: syncHighlight, outlined: function () { return outlined; }, outline: function () { return ostate.outline; }, refresh: function () { return refresh(true); }, selectedTrail: selectedTrail, select: select, forward: forward, hovered: function () { return hover.key; }, ignored: function () { return hover.ignore === undefined ? null : hover.ignore; }, applyHover: applyHover, model: function () { return model; }, nodes: { holder: holder, chips: chips, stepper: stepper, prev: prev, next: next, count: count, label: label } };
  }

  const api = { trailModel: trailModel, trailSignature: trailSignature, resolveSelection: resolveSelection, readRows: readRows, labelFor: labelFor, highlightFor: highlightFor, outlineStep: outlineStep, hoverStep: hoverStep, createChips: createChips, T: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined' && typeof window !== 'undefined' && document.body) {
    root.uiPhoneChips = createChips(document, window);
  }
})(typeof window !== 'undefined' ? window : this);
