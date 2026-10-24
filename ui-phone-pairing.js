/*
 * The line-pairing view of the timeline sheet (sheets redesign, commit 5b). UI only. Under the phone layout, while the pairing toggle of the sheet is on (ui-phone-timeline.js puts the class ph-tl-editor-open on
 * #timeline-group), the sheet shows THIS instead of the interim editor of commit 5a:
 *
 *   in the icon row   a native <select> "1→2", "2→3" ... (84 x 48, after the pairing toggle) that switches the segment; shown only while the model has at least two segments
 *   row 1             one 48px chip per line (Start line) of the selected segment, the selected one black, scrolling sideways when there are more than six
 *   row 2             [▲ end up][▼ end down][⇄ reverse] | [‹ variant][k/c][› variant]
 *   row 3             [reset the pairing]
 *
 * The MODEL is the existing, hidden line-pairing editor (#timeline-pairing and what sketch.js renders into it: renderTimelinePairingEditor()). Nothing here changes or clones it. sketch.js REBUILDS the editor's rows (and the
 * segment select's options) after EVERY change - synchronously, in the same call stack as the click that caused it (updateTimelineControls()) - so this view holds NO reference to anything inside it: it keeps two numbers
 * (the selected line, UI state, not saved) and, at click time, looks up the model's elements afresh: the selected row of #timeline-pairing-list, and in that row its buttons. Each of its own buttons FORWARDS a click to exactly
 * one of them (▲ ▼ ⇄ ‹ ›), the reset icon to #btn-timeline-pairing-reset, the select sets #timeline-pairing-segment and dispatches `change`. A model button that is disabled (the first row has no ▲) makes the view's button
 * aria-disabled; a model without the button (no variant stepper for a row with one variant, a hidden reset button because the pairing is the default) makes it disabled with a reason.
 *
 * What a row IS: the model lists the Start lines (row r = Start line r + 1) with the End line assigned to each (perm[r]); ▲ / ▼ swap the End assignment of row r with row r - 1 / r + 1. The chips are the rows, so after ▲ the
 * End line the user was looking at is on row r - 1: the selection FOLLOWS that End line (the view reads perm from sketch.js's timelineSegmentInfo() before and after: window.timelinePairingPerm; without it, one row up or down).
 *
 *   phonePairingModel({ m, selected, open })  PURE. m = what readModel() reads of the model: { segCount, segValue, rows: [{ upOff, downOff, variant: null | { k, c, prevOff, nextOff } }], resetHidden } ->
 *                                             { open, count, selected, segment: { shown, value, options }, chips, up, down, flip, variant: { enabled, prevEnabled, nextEnabled, text }, reset: { enabled, reason } } (reason = a dictionary key)
 *   followSelection(action, selected, count, before, after)  PURE: where the selection is after a forwarded action
 *   modelSignature(vm, lang)                  a string: the view is rebuilt only when it changed (UI.onSync ticks; no MutationObserver)
 *   createPairingView(doc, win, opts)         the DOM part
 *
 * The texts are the dictionary's (ui-i18n.js): timeline.line {n}, endUp, endDown, reverse, variantPrev, variantNext, resetPairing, segment, pairing, pairingDefault.
 */
(function (root) {
  'use strict';

  // the German fallback of every key this file uses (the dictionary has them all; this keeps the model usable without it)
  const T = {
    'timeline.pairing': 'Linienzuordnung',
    'timeline.segment': 'Segment',
    'timeline.line': 'Linie {n}',
    'timeline.endUp': 'Ende nach oben',
    'timeline.endDown': 'Ende nach unten',
    'timeline.reverse': 'Richtung umkehren',
    'timeline.variantPrev': 'Vorherige Variante',
    'timeline.variantNext': 'Nächste Variante',
    'timeline.resetPairing': 'Zuordnung zurücksetzen',
    'timeline.pairingDefault': 'Zuordnung ist Standard',
  };

  // ---- the pure model -------------------------------------------------------------------------------------------------------------------------------
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function phonePairingModel(input) {
    const inp = input || {}, m = inp.m || { segCount: 0, segValue: 0, rows: [], resetHidden: true }, rows = Array.isArray(m.rows) ? m.rows : [], n = rows.length;
    const sel = n ? clamp(inp.selected | 0, 0, n - 1) : -1, row = n ? rows[sel] : null;
    const segCount = m.segCount | 0, options = [];
    for (let i = 0; i < segCount; i++) options.push({ value: String(i), label: (i + 1) + '→' + (i + 2) });
    const v = row && row.variant ? row.variant : null;
    return {
      open: !!inp.open,
      count: n,
      selected: sel,
      segment: { shown: segCount >= 2, value: String(clamp(m.segValue | 0, 0, Math.max(0, segCount - 1))), options: options },
      chips: rows.map(function (_, i) { return { n: i + 1, selected: i === sel }; }),
      up: { enabled: !!row && !row.upOff },
      down: { enabled: !!row && !row.downOff },
      flip: { enabled: !!row },
      variant: { enabled: !!v, prevEnabled: !!v && !v.prevOff, nextEnabled: !!v && !v.nextOff, text: v ? v.k + '/' + v.c : (row ? '1/1' : '–') },
      reset: row ? (m.resetHidden ? { enabled: false, reason: 'timeline.pairingDefault' } : { enabled: true, reason: null }) : { enabled: false, reason: null },
    };
  }
  // where the selection is after a forwarded action: up / down move the End assignment to the neighbouring row, so the selection goes with the End line (before / after = the permutation of the segment, perm[row] = the
  // End line of Start line `row`); without the permutation it moves one row; everything else keeps the row
  function followSelection(action, selected, count, before, after) {
    if (action !== 'up' && action !== 'down') return selected;
    if (Array.isArray(before) && Array.isArray(after) && selected >= 0 && selected < before.length) {
      const i = after.indexOf(before[selected]);
      if (i >= 0) return i;
    }
    return clamp(selected + (action === 'up' ? -1 : 1), 0, Math.max(0, count - 1));
  }
  function modelSignature(vm, lang) {
    return JSON.stringify([lang || '', vm.open, vm.count, vm.selected, vm.segment, vm.up, vm.down, vm.flip, vm.variant, vm.reset]);
  }

  // ---- the DOM part ---------------------------------------------------------------------------------------------------------------------------------
  const ICON = {
    up: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7 L18 16 H6 Z" fill="currentColor"/></svg>',
    down: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17 L18 8 H6 Z" fill="currentColor"/></svg>',
    swap: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9 H18 M14 5 L18 9 L14 13 M19 15 H6 M10 11 L6 15 L10 19"/></svg>',
    left: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 7 L9 12 L14 17"/></svg>',
    right: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 7 L15 12 L10 17"/></svg>',
    reset: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8 A7 7 0 1 1 5 12"/><path d="M6 4 V8 H10"/></svg>',
  };

  function createPairingView(doc, win, opts) {
    opts = opts || {};
    const html = doc.documentElement, UI = win.UI;
    let selected = 0, signature = null, vm = phonePairingModel({}), lastCount = -1, lastLang = null, optionsKey = null;

    function el(tag, cls, attrs) { const e = doc.createElement(tag); if (cls) e.className = cls; if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
    function text(key, params) {
      if (win.UI && typeof win.UI.t === 'function' && win.uiI18n && win.uiI18n.has(key)) return win.UI.t(key, params);
      const s = T[key] || key;
      return params ? s.replace(/\{(\w+)\}/g, function (m, k) { return params[k] !== undefined ? params[k] : m; }) : s;
    }
    function kids(node) { return Array.prototype.slice.call(node && node.children ? node.children : []); }
    function group() { return doc.getElementById('timeline-group'); }
    function name(b, key, params) { const s = text(key, params); if (UI && UI.name) UI.name(b, s); else { b.setAttribute('aria-label', s); b.setAttribute('title', s); } }

    // ---- what the model is read from: the hidden editor (read afresh every time, never kept) ----
    function isOff(b) { return !!b && !!(b.disabled || (b.hasAttribute && b.hasAttribute('disabled'))); }
    function modelRows() { return kids(doc.getElementById('timeline-pairing-list')).filter(function (r) { return /\bpairing-row\b/.test(r.className || ''); }); }
    function rowButtons(row) { return kids(row).filter(function (c) { return c.tagName === 'BUTTON'; }); }
    function pick(row, which) {
      if (!row) return null;
      const bs = rowButtons(row), v = kids(row).filter(function (c) { return /\bpairing-variant\b/.test(c.className || ''); })[0], vk = kids(v);
      if (which === 'up') return bs[0] || null;
      if (which === 'down') return bs[1] || null;
      if (which === 'flip') return bs[2] || null;
      if (which === 'prev') return vk.filter(function (c) { return /pairing-variant-prev/.test(c.className || ''); })[0] || null;
      if (which === 'next') return vk.filter(function (c) { return /pairing-variant-next/.test(c.className || ''); })[0] || null;
      if (which === 'count') return vk.filter(function (c) { return /pairing-variant-count/.test(c.className || ''); })[0] || null;
      return null;
    }
    function segSelect() { return doc.getElementById('timeline-pairing-segment'); }
    function readModel(withRows) {
      const sel = segSelect(), panel = doc.getElementById('timeline-pairing'), reset = doc.getElementById('btn-timeline-pairing-reset');
      const segCount = sel ? (sel.options ? sel.options.length : kids(sel).length) : 0;
      const m = { segCount: panel && panel.hidden ? 0 : segCount, segValue: sel ? parseInt(sel.value, 10) || 0 : 0, rows: [], resetHidden: !reset || !!reset.hidden };
      if (withRows && !(panel && panel.hidden)) m.rows = modelRows().map(function (row) {   // sketch.js hides the panel without clearing its rows when there is no segment: stale rows are no rows
        const cnt = pick(row, 'count'), prev = pick(row, 'prev'), next = pick(row, 'next');
        return { upOff: isOff(pick(row, 'up')), downOff: isOff(pick(row, 'down')), variant: cnt ? { k: parseInt(cnt.dataset ? cnt.dataset.k : '1', 10) || 1, c: parseInt(cnt.dataset ? cnt.dataset.c : '1', 10) || 1, prevOff: isOff(prev), nextOff: isOff(next) } : null };
      });
      return m;
    }
    function permNow() { const f = opts.perm || win.timelinePairingPerm; const sel = segSelect(); return typeof f === 'function' ? f(sel ? parseInt(sel.value, 10) || 0 : 0) : null; }

    // ---- the view's own elements: made in a hidden holder (ui-phone.js moves them into the sheet), the select goes into the icon row ----
    const home = doc.getElementById('ph-tl-home') || (function () { const h = el('div', 'ph-tl-home', { id: 'ph-tl-home' }); h.hidden = true; (opts.home || doc.body).appendChild(h); return h; })();
    function iconButton(id, cls, key, svg) {
      const b = el('button', 'icon-btn ph-tl-btn ' + cls, { type: 'button', 'data-i18n': key });
      if (id) b.setAttribute('id', id);
      b.innerHTML = svg;
      name(b, key);
      return b;
    }
    const chips = el('div', 'ph-tl-chips', { id: 'ph-tl-chips', role: 'group', 'data-i18n': 'timeline.pairing' });
    name(chips, 'timeline.pairing');
    const moves = el('div', 'ph-tl-moves', { id: 'ph-tl-moves' });
    const upBtn = iconButton(null, 'ph-tl-up', 'timeline.endUp', ICON.up), downBtn = iconButton(null, 'ph-tl-down', 'timeline.endDown', ICON.down), flipBtn = iconButton(null, 'ph-tl-flip', 'timeline.reverse', ICON.swap);
    [upBtn, downBtn, flipBtn].forEach(function (b) { moves.appendChild(b); });
    const variant = el('div', 'ph-tl-variant', { id: 'ph-tl-variant' });
    const vSep = el('span', 'ph-tl-sep', { 'aria-hidden': 'true' });
    const prevBtn = iconButton(null, 'ph-tl-prev', 'timeline.variantPrev', ICON.left), nextBtn = iconButton(null, 'ph-tl-next', 'timeline.variantNext', ICON.right);
    const count = el('span', 'ph-tl-vcount');
    [vSep, prevBtn, count, nextBtn].forEach(function (n) { variant.appendChild(n); });
    const resetBtn = iconButton('ph-tl-reset', 'ph-tl-reset', 'timeline.resetPairing', ICON.reset);
    const seg = el('select', 'ph-tl-segment', { 'data-i18n-label': 'timeline.segment' });
    name(seg, 'timeline.segment');
    seg.hidden = true;
    [chips, moves, variant, resetBtn].forEach(function (n) { home.appendChild(n); });
    const icons = doc.getElementById('ph-tl-icons'), toggle = icons && kids(icons).filter(function (c) { return /\bph-tl-pairing\b/.test(c.className || ''); })[0];
    if (icons && toggle) icons.insertBefore(seg, toggle.nextSibling); else home.appendChild(seg);

    // ---- forwarding: a click on the model's own button, found afresh ----
    function openNow() { const g = group(); return !!(g && g.classList && g.classList.contains('ph-tl-editor-open')); }
    function forward(action) {
      const row = modelRows()[selected];
      if (!row) return false;
      const b = pick(row, action);
      if (!b || isOff(b)) return false;
      const before = (action === 'up' || action === 'down') ? permNow() : null;
      b.click();
      // the model re-rendered, synchronously: what is selected now (the End line moved with the click)
      const rowsNow = modelRows().length;
      selected = followSelection(action, selected, rowsNow, before, before ? permNow() : null);
      refresh(true);
      return true;
    }
    function forwardReset() {
      const b = doc.getElementById('btn-timeline-pairing-reset');
      if (!b || b.hidden || isOff(b)) return false;
      b.click();
      refresh(true);
      return true;
    }
    function selectChip(i) { selected = i; refresh(true); }
    function chooseSegment() {
      const m = segSelect();
      if (!m) return;
      m.value = seg.value;
      const ev = typeof win.Event === 'function' ? new win.Event('change', { bubbles: true }) : { type: 'change', bubbles: true };
      m.dispatchEvent(ev);   // sketch.js: the segment changes, the preview parks at its midpoint, the editor is rebuilt
      refresh(true);
    }
    const guard = function (b, fn) { if (UI && UI.guard) UI.guard(b, fn); else b.addEventListener('click', fn); };
    guard(upBtn, function () { forward('up'); });
    guard(downBtn, function () { forward('down'); });
    guard(flipBtn, function () { forward('flip'); });
    guard(prevBtn, function () { forward('prev'); });
    guard(nextBtn, function () { forward('next'); });
    guard(resetBtn, forwardReset);
    seg.addEventListener('change', chooseSegment);

    // ---- rendering ----
    // aria-disabled without a reason (the model's own buttons have none: a boundary) or with one (UI.setDisabled: the title and what a tap says)
    function setOff(b, off, reasonKey) {
      if (off && reasonKey) { if (UI && UI.setDisabled) UI.setDisabled(b, text(reasonKey)); else b.setAttribute('aria-disabled', 'true'); return; }
      if (off) { if (UI && UI.setDisabled) UI.setDisabled(b, null); b.setAttribute('aria-disabled', 'true'); return; }
      if (UI && UI.setDisabled) UI.setDisabled(b, null);
      b.removeAttribute('aria-disabled');
    }
    function renderChips() {
      const lang = win.UI && win.UI.lang;
      if (vm.count !== lastCount || lang !== lastLang) {
        kids(chips).forEach(function (c) { chips.removeChild(c); });
        vm.chips.forEach(function (c, i) {
          const b = el('button', 'icon-btn ph-tl-btn ph-tl-chip', { type: 'button' });
          b.textContent = String(c.n);
          name(b, 'timeline.line', { n: c.n });
          guard(b, function () { selectChip(i); });
          chips.appendChild(b);
        });
        lastCount = vm.count; lastLang = lang;
      }
      kids(chips).forEach(function (b, i) {
        const on = !!vm.chips[i] && vm.chips[i].selected;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on) { if (b.className.indexOf(' active') < 0) b.className += ' active'; } else b.className = b.className.replace(/\s*\bactive\b/, '');
      });
    }
    function renderSegment() {
      seg.hidden = !vm.segment.shown;
      const key = JSON.stringify(vm.segment.options);
      if (key !== optionsKey) {
        optionsKey = key;
        while (seg.firstChild) seg.removeChild(seg.firstChild);
        vm.segment.options.forEach(function (o) { const op = el('option', '', { value: o.value }); op.textContent = o.label; seg.appendChild(op); });
      }
      if (seg.value !== vm.segment.value) seg.value = vm.segment.value;
    }
    function render() {
      renderSegment();
      renderChips();
      setOff(upBtn, !vm.up.enabled); setOff(downBtn, !vm.down.enabled); setOff(flipBtn, !vm.flip.enabled);
      setOff(prevBtn, !vm.variant.prevEnabled); setOff(nextBtn, !vm.variant.nextEnabled);
      if (count.textContent !== vm.variant.text) count.textContent = vm.variant.text;
      setOff(resetBtn, !vm.reset.enabled, vm.reset.reason);
    }
    // sync(): on every UI.onSync tick and after every click on the document (a cheap signature compare); refresh(force): after a tap of this view
    function refresh(force) {
      const open = openNow(), m = readModel(open);
      vm = phonePairingModel({ m: m, selected: selected, open: open });
      if (vm.selected >= 0) selected = vm.selected;
      const sig = modelSignature(vm, win.UI && win.UI.lang);
      if (!force && sig === signature) return false;
      signature = sig;
      render();
      return true;
    }
    function sync() {
      if (!html.classList.contains('ph')) return false;   // nothing to keep up to date outside the phone layout
      return refresh(false);
    }
    if (UI && UI.onSync) UI.onSync(sync);
    if (doc.addEventListener) doc.addEventListener('click', function () { sync(); });
    refresh(true);
    return { sync: sync, refresh: function () { return refresh(true); }, model: function () { return vm; }, selected: function () { return selected; }, forward: forward, nodes: { home: home, chips: chips, moves: moves, up: upBtn, down: downBtn, flip: flipBtn, variant: variant, prev: prevBtn, next: nextBtn, count: count, reset: resetBtn, segment: seg } };
  }

  const api = { phonePairingModel: phonePairingModel, followSelection: followSelection, modelSignature: modelSignature, createPairingView: createPairingView, T: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined' && typeof window !== 'undefined' && document.body) {
    // read-only access to the page's own state: the permutation of a segment (timelineSegmentInfo(), a global function of sketch.js)
    window.timelinePairingPerm = function (segment) { try { const info = typeof timelineSegmentInfo === 'function' ? timelineSegmentInfo(segment) : null; return info && info.ok && Array.isArray(info.perm) ? info.perm.slice() : null; } catch (e) { return null; } };
    root.uiPhonePairing = createPairingView(document, window);
  }
})(typeof window !== 'undefined' ? window : this);
