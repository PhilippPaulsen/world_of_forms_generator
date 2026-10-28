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
 *   selectedTrail()           { index, key, color, faceCount } or null: for the highlight of a later commit (not built here).
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
    function select(i) { const r = currentRows()[i]; if (!r) return; selected = { key: r.key, index: i }; refresh(true); }

    function render() {
      let activeNode = null;
      while (chips.firstChild) chips.removeChild(chips.firstChild);
      if (model.empty) {
        const none = el('span', 'ph-chips-empty', { 'data-i18n': 'trails.none' });
        none.textContent = text('trails.none');
        chips.appendChild(none);
      } else {
        model.chips.forEach(function (c) {
          const b = el('button', 'ph-chip', { type: 'button', 'aria-pressed': c.selected ? 'true' : 'false', 'aria-label': c.label, title: c.label, 'data-index': String(c.index) });
          if (c.selected) { b.className += ' active'; activeNode = b; }
          b.textContent = String(c.number);
          const bar = el('span', 'ph-chip-bar', { 'aria-hidden': 'true' });
          bar.style.background = c.color;
          b.appendChild(bar);
          const idx = c.index;
          b.addEventListener('click', function () { select(idx); });
          chips.appendChild(b);
        });
      }
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
      selected = resolveSelection(rows, selected);
      const sig = trailSignature(rows, selected, typeof win.farbeReason === 'function' ? win.farbeReason() : null);
      if (!force && sig === signature) return false;
      signature = sig;
      model = trailModel(rows, selected);
      render();
      return true;
    }
    function sync() {
      if (!html.classList.contains('ph') || html.getAttribute('data-tab') !== 'farbe') return false;   // nothing to keep up to date outside the Farbe phone layout
      return refresh(false);
    }
    function selectedTrail() {
      const rows = currentRows();
      const s = resolveSelection(rows, selected);
      const r = rows[s.index];
      return r ? { index: s.index, key: r.key, color: r.color, faceCount: r.faceCount } : null;
    }
    if (UI && UI.onSync) UI.onSync(sync);
    refresh(true);
    return { sync: sync, refresh: function () { return refresh(true); }, selectedTrail: selectedTrail, select: select, forward: forward, model: function () { return model; }, nodes: { holder: holder, chips: chips, stepper: stepper, prev: prev, next: next, count: count, label: label } };
  }

  const api = { trailModel: trailModel, trailSignature: trailSignature, resolveSelection: resolveSelection, readRows: readRows, labelFor: labelFor, createChips: createChips, T: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined' && typeof window !== 'undefined' && document.body) {
    root.uiPhoneChips = createChips(document, window);
  }
})(typeof window !== 'undefined' ? window : this);
