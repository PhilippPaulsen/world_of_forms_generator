/*
 * The layer table (layer-table commit 1). UI only. A PURE VIEW of the sheets: it is rebuilt from additionalLayers, activeLayer and timeline (core/state.js globals) on every UI.onSync tick -
 * after a signature comparison, so nothing is built while nothing changed - and writes no state of its own. Every action goes through window.layerApi (sketch.js: the same call sequences the
 * old tab / "+ Layer" / remove handlers run), so the old layer row (still in the DOM, hidden by style.css at every width) and the views can never disagree.
 *
 *   rows      the Base first (only its chip: a stack icon), then one row per layer in additionalLayers order WITHOUT the timeline's playback layer. The chip shows a RUNNING number
 *             (layerDisplayNumber), not the array index + 1: the playback layer takes an array slot, and with the index the numbers jumped when it appeared or went away.
 *   chip      selects the sheet (layerApi.select). The active sheet's chip is black (.active, the existing icon-button state); a hidden layer's chip is dimmed.
 *   eye       layer.enabled, switchable for every layer, a timeline keyframe included (the timeline sets a keyframe to enabled = false; switching it on draws it IN ADDITION to the playback
 *             layer, which is intended: the Farbe tab says "tick its checkbox to show and edit its colors"). aria-pressed; the name line says "Keyframe, ausgeblendet / zusätzlich sichtbar".
 *   x         removes the layer (layerApi.remove). Asked first - a dialog like "Neu anfangen" (Cancel has the focus, Escape cancels) - only when the layer has lines or is a timeline keyframe
 *             (layerRemoveNeedsConfirm); an empty plain layer goes without.
 *   + / ...   a new layer (a copy of the base's shape, symmetry, node count and size) / the rare-settings block of the active layer (layerApi.toggleMore: the same open / closed state as the
 *             old toggle; the block stays inline below the canvas). "..." is disabled with a reason while the Base is active (UI.setDisabled: the reason is a toast on touch too).
 *   name line a reserved-height, aria-hidden line with the name and state of the last touched icon (pointerdown, focusin, mouse pointerover), refreshed on every tick; "Symbol antippen" while
 *             nothing was touched. The same pattern as the rail's Mehr row (ui-rail.js); mirrored here, not shared (ui-rail.js is not touched by this commit).
 *
 * The RAIL (layer-table commit 2) is a second view of the SAME model, for the widths where the table does not fit (a single column at the right gutter, 768px up to the table's
 * threshold, style.css): group 1 = the chips (the Base, the running numbers; "+" under them, outside the scrolling part so it stays reachable), a hairline, group 2 = the actions
 * of the ACTIVE sheet (eye, "...", x; a fourth button, the diamond, is a later commit). On the Base the actions stay and are disabled with the reason "Keine Ebene aktiv." so
 * nothing jumps. The rail has no name line (the black chip shows the active sheet; the names are the aria-label and title of every button). Table and rail are both built on every
 * tick; style.css shows ONE of them (display: none on the other: never both in the tab order or the accessibility tree).
 *
 * The STRIP (layer-table commit 4) is the third view, for the phone (below 768px): two rows under the canvas, built by the SAME function as the rail (buildNarrow): row 1 = the Base chip (fixed),
 * the layer chips (they scroll sideways) and "+" (fixed); row 2 = the actions of the active sheet, disabled with a reason on the Base. Exactly one of table, rail and strip shows at every width.
 *
 * The model (layerDisplayNumber, layerRemoveNeedsConfirm, layerTableModel, tableSignature, revealDelta) is pure and loadable without a DOM (tools/ui/test-layer-table.js). The German texts are keyed
 * (layers.*); the dictionary comes in a later phase.
 */
(function (root) {
  'use strict';
  const T = {
    'layers.table': 'Ebenen',
    'layers.rail': 'Ebenen',
    'layers.strip': 'Ebenen',
    'layers.eye.none': 'Ebene sichtbar',
    'layers.dia.add': function (n) { return 'Ebene ' + n + ' zur Zeitleiste hinzufügen'; },
    'layers.dia.remove': function (n) { return 'Ebene ' + n + ' aus der Zeitleiste entfernen'; },
    'layers.dia.none': 'Ebene zur Zeitleiste hinzufügen',
    'layers.dia.in': 'in der Zeitleiste',
    'layers.dia.out': 'nicht in der Zeitleiste',
    'layers.x.none': 'Ebene entfernen',
    'layers.base': 'Basis',
    'layers.layer': function (n) { return 'Ebene ' + n; },
    'layers.chip.active': 'aktiv',
    'layers.chip.inactive': 'nicht aktiv',
    'layers.eye.name': function (n) { return 'Ebene ' + n + ' sichtbar'; },
    'layers.eye.on': 'sichtbar',
    'layers.eye.off': 'ausgeblendet',
    'layers.eye.kf.off': 'Keyframe, ausgeblendet',
    'layers.eye.kf.on': 'Keyframe, zusätzlich sichtbar',
    'layers.x.name': function (n) { return 'Ebene ' + n + ' entfernen'; },
    'layers.add': 'Ebene hinzufügen',
    'layers.more': 'Ebenen-Einstellungen',
    'layers.more.open': 'offen',
    'layers.more.closed': 'geschlossen',
    get 'layers.more.none'() { const i = root.uiI18n; return i && i.has('common.noLayer') ? i.t('common.noLayer') : 'Keine Ebene aktiv.'; },
    'layers.hint': 'Symbol antippen',
    'layers.remove.title': function (n) { return 'Ebene ' + n + ' entfernen?'; },
    'layers.remove.lines': function (k) { return (k === 1 ? 'Die eine Linie dieser Ebene geht' : 'Die ' + k + ' Linien dieser Ebene gehen') + ' verloren. Das lässt sich nicht rückgängig machen.'; },
    'layers.remove.keyframe': function (k) { return 'Diese Ebene ist ein Keyframe der Timeline' + (k ? ' und hat ' + (k === 1 ? 'eine Linie' : k + ' Linien') : '') + '. Sie wird entfernt, ihr Keyframe verlässt die Timeline, und die Linienzuordnungen der angrenzenden Segmente gehen verloren. Das lässt sich nicht rückgängig machen.'; },
  };

  // ---- the pure model ---------------------------------------------------------------------------------------------------------------------------
  // The running number of the layer at `index`: its place among the layers that are NOT the timeline's playback layer (1-based); null for the playback layer itself or a bad index.
  function layerDisplayNumber(layers, index) {
    if (!Array.isArray(layers) || typeof index !== 'number' || !layers[index] || layers[index].isTimelinePlayback) return null;
    let n = 0;
    for (let i = 0; i <= index; i++) if (!layers[i].isTimelinePlayback) n++;
    return n;
  }
  function isKeyframe(timeline, index) { return !!(timeline && Array.isArray(timeline.keyframeLayerIds) && timeline.keyframeLayerIds.indexOf(index) >= 0); }
  // Does removing this layer need a confirmation? Only when it has lines or is a timeline keyframe (index = its array index).
  function layerRemoveNeedsConfirm(layer, timeline, index) {
    const lines = layer && Array.isArray(layer.connections) ? layer.connections.length : 0;
    const keyframe = isKeyframe(timeline, index);
    return { confirm: lines > 0 || keyframe, lines: lines, keyframe: keyframe };
  }
  // state: { layers, active ('base' | index), timeline, moreOpen, moreDot }
  function layerTableModel(st) {
    const layers = st.layers || [], active = st.active, timeline = st.timeline || null;
    const cells = {};
    const rows = [{ key: 'base', kind: 'base', index: 'base', active: active === 'base', number: null, hidden: false, keyframe: false }];
    cells['chip:base'] = { name: T['layers.base'], state: active === 'base' ? T['layers.chip.active'] : T['layers.chip.inactive'], label: T['layers.base'] };
    layers.forEach(function (layer, i) {
      if (layer.isTimelinePlayback) return;
      const n = layerDisplayNumber(layers, i), kf = isKeyframe(timeline, i), visible = !!layer.enabled;
      rows.push({ key: 'l' + i, kind: 'layer', index: i, active: active === i, number: n, hidden: !visible, visible: visible, keyframe: kf });
      const nm = T['layers.layer'](n);
      cells['chip:' + i] = { name: nm, state: active === i ? T['layers.chip.active'] : T['layers.chip.inactive'], label: nm };
      cells['eye:' + i] = { name: nm, state: kf ? (visible ? T['layers.eye.kf.on'] : T['layers.eye.kf.off']) : (visible ? T['layers.eye.on'] : T['layers.eye.off']), label: T['layers.eye.name'](n) };
      cells['dia:' + i] = { name: nm, state: kf ? T['layers.dia.in'] : T['layers.dia.out'], label: kf ? T['layers.dia.remove'](n) : T['layers.dia.add'](n) };
      cells['x:' + i] = { name: T['layers.x.name'](n), state: '', label: T['layers.x.name'](n) };
    });
    cells.add = { name: T['layers.add'], state: '', label: T['layers.add'] };
    const noLayer = !(typeof active === 'number' && layers[active] && !layers[active].isTimelinePlayback);
    cells.more = { name: T['layers.more'], state: noLayer ? T['layers.more.none'] : (st.moreOpen ? T['layers.more.open'] : T['layers.more.closed']), label: T['layers.more'] };
    const more = { disabled: noLayer, reason: noLayer ? T['layers.more.none'] : null, open: !!st.moreOpen && !noLayer, dot: !!st.moreDot && !noLayer };
    // the actions of the ACTIVE sheet, for the rail (index null on the Base: present and disabled with the reason, so nothing jumps)
    const n = noLayer ? null : layerDisplayNumber(layers, active), visible = noLayer ? false : !!layers[active].enabled;
    const actions = {
      index: noLayer ? null : active,
      eye: { disabled: noLayer, reason: noLayer ? T['layers.more.none'] : null, label: noLayer ? T['layers.eye.none'] : T['layers.eye.name'](n), visible: visible },
      dia: { disabled: noLayer, reason: noLayer ? T['layers.more.none'] : null, filled: noLayer ? false : isKeyframe(timeline, active), label: noLayer ? T['layers.dia.none'] : (isKeyframe(timeline, active) ? T['layers.dia.remove'](n) : T['layers.dia.add'](n)) },
      more: more,
      x: { disabled: noLayer, reason: noLayer ? T['layers.more.none'] : null, label: noLayer ? T['layers.x.none'] : T['layers.x.name'](n) },
    };
    return { rows: rows, cells: cells, more: more, actions: actions };
  }
  // How far to scroll a scrolling column so that a child stays inside it (0 when it already is): the child's top / bottom and the column's top / bottom, all in the same coordinates.
  function revealDelta(childTop, childBottom, viewTop, viewBottom) {
    if (childTop < viewTop) return childTop - viewTop;
    if (childBottom > viewBottom) return Math.min(childBottom - viewBottom, childTop - viewTop);
    return 0;
  }
  // A string that changes exactly when the model would: compared on every tick before anything is built.
  function tableSignature(st) {
    let s = String(st.active) + '|' + (st.moreOpen ? 1 : 0) + (st.moreDot ? 1 : 0) + '|';
    const layers = st.layers || [];
    for (let i = 0; i < layers.length; i++) s += (layers[i].isTimelinePlayback ? 'p' : (layers[i].enabled ? 'v' : 'h') + (isKeyframe(st.timeline, i) ? 'k' : '')) + ',';
    return s;
  }
  // How far the page must scroll so that the WHOLE rare-settings block (the union rectangle of its visible groups, and the viewport height in; the scroll in px out) is inside the viewport: 0 when it
  // is, negative when it starts above the top, positive when it ends below the bottom. A block taller than the viewport cannot fit: its top edge goes to the viewport top with an 8px margin.
  const PANEL_MARGIN = 8;
  function panelRevealDelta(rect, viewportHeight) {
    if (rect.bottom - rect.top > viewportHeight) return rect.top - PANEL_MARGIN;
    return revealDelta(rect.top, rect.bottom, 0, viewportHeight);
  }
  root.layerTable = { layerDisplayNumber: layerDisplayNumber, layerRemoveNeedsConfirm: layerRemoveNeedsConfirm, layerTableModel: layerTableModel, tableSignature: tableSignature, revealDelta: revealDelta, panelRevealDelta: panelRevealDelta, T: T };

  // ---- the DOM ----------------------------------------------------------------------------------------------------------------------------------
  if (typeof document === 'undefined' || !document.getElementById || typeof UI === 'undefined') return;
  const table = document.getElementById('layer-table');
  if (!table) return;
  const rail = document.getElementById('layer-rail');   // the narrow view (commit 2); a page without it just has the table
  const strip = document.getElementById('layer-strip');   // the phone view (commit 4)

  const ICON = {
    stack: '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3 L21 8 L12 13 L3 8 Z"/><path d="M3 12 L12 17 L21 12"/><path d="M3 16 L12 21 L21 16"/></svg>',
    eyeOn: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>',
    diaOn: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 L21 12 L12 21 L3 12 Z"/></svg>',
    diaOff: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 L21 12 L12 21 L3 12 Z"/></svg>',
    plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5 V19 M5 12 H19"/></svg>',
    more: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
  };
  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function cell(cls, key, handler) {
    const b = el('button', 'icon-btn lt-cell ' + cls);
    b.type = 'button';
    b.dataset.key = key;
    if (handler) b.addEventListener('click', handler);
    return b;
  }

  const baseEl = el('div', 'lt-row lt-base'), rowsEl = el('div', 'lt-rows'), footEl = el('div', 'lt-foot'), nameEl = el('p', 'lt-name');   // the Base row and the foot are fixed; only rowsEl (the layer rows) scrolls
  nameEl.id = 'layer-table-name';
  nameEl.setAttribute('aria-hidden', 'true');
  const nameLabel = el('span', 'lt-name-label'), nameState = el('span', 'lt-name-state');
  nameEl.appendChild(nameLabel); nameEl.appendChild(nameState);

  function api() { return root.layerApi; }
  function indexOf(b) { const k = b.dataset.key || ''; const v = k.slice(k.indexOf(':') + 1); return v === 'base' ? 'base' : parseInt(v, 10); }
  function layersNow() { return (typeof additionalLayers !== 'undefined') ? additionalLayers : []; }
  function addLayerNow() { if (api()) api().add(); sync(); }
  function moreNow() { if (api()) api().toggleMore(); sync(); if (lastModel && lastModel.more.open) revealPanel(document.getElementById('layer-more-panel')); }
  // A collapsible block opens in the controls container, below the layer view and the tool rail's rows: on a phone it can start at or below the fold. When it opens, scroll the page just enough to
  // bring the WHOLE block into view (the union of the visible children of `panel`; one that is taller than the viewport is aligned to the top with a margin); smooth unless the user prefers reduced
  // motion; nothing when it is already inside. The focus stays on the toggle (window.scrollBy moves no focus); nothing happens on close. The ONE implementation: the layer block ("...", here) and the
  // timeline's "Mehr" group (ui-timeline.js, through layerTable.revealPanel) both call it.
  function revealPanel(panel) {
    if (!panel || !panel.children || typeof window === 'undefined' || !window.scrollBy) return;
    let top = Infinity, bottom = -Infinity;
    for (let i = 0; i < panel.children.length; i++) {
      const c = panel.children[i];
      if (c.hidden || !c.getClientRects || !c.getClientRects().length) continue;
      const r = c.getBoundingClientRect();
      if (r.top < top) top = r.top;
      if (r.bottom > bottom) bottom = r.bottom;
    }
    const vh = window.innerHeight || 0;
    if (!vh || top === Infinity) return;
    const delta = panelRevealDelta({ top: top, bottom: bottom }, vh);
    if (!delta) return;
    window.scrollBy({ top: delta, behavior: scrollBehavior() });
  }
  // 'smooth' unless the user prefers reduced motion: the ONE place that decides it (the page reveal above and the table's row reveal below use it)
  function scrollBehavior() {
    const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return reduced ? 'auto' : 'smooth';
  }
  root.layerTable.revealPanel = revealPanel;

  // the add and more cells (the foot) are static: built once
  const addBtn = cell('lt-add', 'add', addLayerNow);
  addBtn.innerHTML = ICON.plus;
  const moreBtn = cell('lt-more', 'more', null);
  moreBtn.innerHTML = ICON.more;
  moreBtn.classList.add('nav-more');
  moreBtn.setAttribute('aria-controls', 'layer-more-panel');
  UI.guard(moreBtn, moreNow);   // the one click listener of "...": while it is disabled (the Base is active) a click shows the reason instead
  footEl.appendChild(addBtn); footEl.appendChild(moreBtn);
  table.appendChild(baseEl); table.appendChild(rowsEl); table.appendChild(footEl); table.appendChild(nameEl);
  UI.name(addBtn, T['layers.add']);
  UI.name(moreBtn, T['layers.more']);

  // The narrow views: the rail (commit 2, a column at the right gutter) and the strip (commit 4, two rows under the canvas below 768px). The SAME structure and class names; style.css lays them out.
  // Group 1 = the Base chip (fixed), the scrolling column with the layer chips, "+" (fixed); group 2 = the actions of the active sheet. Static cells are built once; the chips with the rows.
  const views = {};
  const tableView = { name: 'table', chips: rowsEl, horizontal: false, lastActive: null, smooth: true };   // the table's scrolling layer rows, revealed like the narrow views' chips (not in `views`: it has no group structure of its own)
  function buildNarrow(name, container) {
    const v = { name: name, container: container, horizontal: name === 'strip', lastActive: null };
    v.base = cell('lt-chip lr-chip lr-base', 'chip:base', null);   // outside the scrolling column, like "+": it never scrolls out of view
    v.base.addEventListener('click', chipHandler(v.base));
    v.chips = el('div', 'lr-chips');
    v.add = cell('lt-add lr-add', 'add', addLayerNow);
    v.add.innerHTML = ICON.plus;
    const group1 = el('div', 'lr-group lr-g1'), group2 = el('div', 'lr-group lr-g2');
    v.eye = cell('lr-eye', 'eye', null);
    v.more = cell('lt-more lr-more', 'more', null);
    v.more.innerHTML = ICON.more;
    v.more.classList.add('nav-more');
    v.more.setAttribute('aria-controls', 'layer-more-panel');
    v.dia = cell('lr-dia', 'dia', null);
    v.x = cell('lr-x', 'x', null);
    v.x.innerHTML = ICON.x;
    UI.guard(v.eye, function () {
      const i = lastModel ? lastModel.actions.index : null, layers = layersNow();
      if (api() && i !== null && layers[i]) api().setEnabled(i, !layers[i].enabled);
      sync();
    });
    UI.guard(v.dia, function () { const i = lastModel ? lastModel.actions.index : null; if (i !== null) diamondClick(i, name); });
    UI.guard(v.more, moreNow);
    UI.guard(v.x, function () { const i = lastModel ? lastModel.actions.index : null; if (i !== null) askRemove(i, name); });
    group1.appendChild(v.base); group1.appendChild(v.chips); group1.appendChild(v.add);
    group2.appendChild(v.eye); group2.appendChild(v.dia); group2.appendChild(v.more); group2.appendChild(v.x);   // eye, diamond, "...", x
    container.appendChild(group1); container.appendChild(group2);
    UI.name(v.add, T['layers.add']);
    UI.name(v.more, T['layers.more']);
    UI.name(v.eye, T['layers.eye.none']);
    UI.name(v.dia, T['layers.dia.none']);
    UI.name(v.x, T['layers.x.none']);
    views[name] = v;
  }
  if (rail) buildNarrow('rail', rail);
  if (strip) buildNarrow('strip', strip);

  // ---- the remove dialog (like "Neu anfangen") --------------------------------------------------------------------------------------------------
  const overlay = document.getElementById('layer-remove-overlay'), cancelBtn = document.getElementById('cancel-layer-remove'), confirmBtn = document.getElementById('confirm-layer-remove');
  const titleEl = document.getElementById('layer-remove-title'), textEl = document.getElementById('layer-remove-text');
  let pendingIndex = null, pendingView = 'table', wasCancelled = true, lastModel = null;
  const focusProxy = { setAttribute: function () { }, focus: function () { focusAfterDialog(); } };
  if (overlay && cancelBtn && confirmBtn) {
    UI.dialog(overlay, focusProxy, cancelBtn);
    cancelBtn.addEventListener('click', function () { wasCancelled = true; overlay.classList.add('hidden'); });
    confirmBtn.addEventListener('click', function () {
      wasCancelled = false;
      overlay.classList.add('hidden');
      const idx = pendingIndex; pendingIndex = null;
      if (idx !== null && api()) api().remove(idx);
      sync();
    });
  }
  function activeChipKey() { return lastModel ? 'chip:' + (lastModel.rows.filter(function (r) { return r.active; })[0] || { index: 'base' }).index : 'chip:base'; }
  function focusActiveChip(view) { const b = findCell(activeChipKey(), view) || findCell('chip:base', view); if (b && b.focus) b.focus(); }
  function focusAfterDialog() {
    // cancelled: back to the x that opened it (the table's x of that row, the rail's or the strip's x); removed: the active sheet's chip in the same view (the removed row is gone)
    const view = pendingView;
    const want = wasCancelled && pendingIndex !== null ? (view === 'table' ? 'x:' + pendingIndex : 'x') : activeChipKey();
    const b = findCell(want, view) || findCell('chip:base', view);
    pendingIndex = null;
    if (b && b.focus) b.focus();
  }
  function findCell(key, view) {
    const v = views[view];
    if (v) {
      const fixed = [v.base, v.add, v.eye, v.dia, v.more, v.x];
      for (let f = 0; f < fixed.length; f++) if (fixed[f].dataset.key === key) return fixed[f];
      const cs = v.chips.children;
      for (let c = 0; c < cs.length; c++) if (cs[c].dataset.key === key) return cs[c];
      return null;
    }
    const all = [baseEl].concat(Array.prototype.slice.call(rowsEl.children));   // the Base row, then the scrolling layer rows
    for (let r = 0; r < all.length; r++) { const kids = all[r].children; for (let c = 0; c < kids.length; c++) if (kids[c].dataset.key === key) return kids[c]; }
    return null;
  }
  // The diamond of the layer at `index` (in a narrow view: the active layer). An outline diamond selects that layer and adds it to the timeline with the CURRENT Base net (layerApi.addToTimeline =
  // addLayerToTimeline, which returns nothing: a refusal leaves the layer out of the timeline, so the diamond stays outline, and its message is a notice from sketch.js's setTimelineStatus).
  // A filled one takes the keyframe out of the timeline; it asks first only when that discards a user-set line pairing (diamondPlan).
  function diamondClick(index, view) {
    const plan = root.timelineModel && root.timelineModel.diamondPlan(layersNow(), typeof timeline !== 'undefined' ? timeline : null, index);
    if (!plan || !api()) return;
    if (plan.action === 'add') {
      api().select(index);
      api().addToTimeline();   // a refusal is told by sketch.js (setTimelineStatus: a notice); the diamond just reflects the state below - it fills only when the layer became a keyframe
      sync();
      return;
    }
    const remove = function () { api().removeKeyframe(index); sync(); };
    if (!plan.needsConfirm || !root.timelineConfirm) { remove(); return; }
    const n = layerDisplayNumber(layersNow(), index), tm = root.timelineModel.T;
    root.timelineConfirm({
      title: tm['timeline.dia.title'](n), text: tm['timeline.dia.text'](plan.segments.length), confirmLabel: tm['timeline.confirm.remove'], onConfirm: remove,
      returnFocus: function () { const b = findCell(view === 'table' ? 'dia:' + index : 'dia', view); if (b && b.focus) b.focus(); },
    });
  }
  function askRemove(index, view) {
    const layers = layersNow();
    const layer = layers[index];
    if (!layer || !api()) return;
    const need = layerRemoveNeedsConfirm(layer, typeof timeline !== 'undefined' ? timeline : null, index);
    if (!need.confirm || !overlay) { api().remove(index); sync(); focusActiveChip(view); return; }   // the removed row is gone: the focus goes to the active sheet's chip
    pendingIndex = index; pendingView = view || 'table'; wasCancelled = true;
    const n = layerDisplayNumber(layers, index);
    titleEl.textContent = T['layers.remove.title'](n);
    overlay.setAttribute('aria-label', T['layers.remove.title'](n).replace(/\?$/, ''));
    textEl.textContent = need.keyframe ? T['layers.remove.keyframe'](need.lines) : T['layers.remove.lines'](need.lines);
    overlay.classList.remove('hidden');
  }

  // ---- rows: built when the structure changes, patched in place otherwise (a keyboard user keeps the focus) -------------------------------------------
  let structKey = null, sigNow = null, lastActiveKey = null;
  function chipHandler(chip) { return function () { if (api()) api().select(indexOf(chip)); sync(); }; }
  function buildRow(row, host) {   // host: an existing row element to fill (the Base row, built once); otherwise a new one
    const r = host || el('div', 'lt-row');
    r.dataset.row = row.key;
    const chip = cell('lt-chip', 'chip:' + row.index, null);
    chip.addEventListener('click', chipHandler(chip));
    r.appendChild(chip);
    if (row.kind === 'layer') {
      const eye = cell('lt-eye', 'eye:' + row.index, function () {
        const i = indexOf(eye), layers = layersNow();
        if (api() && layers[i]) api().setEnabled(i, !layers[i].enabled);
        sync();
      });
      const dia = cell('lt-dia', 'dia:' + row.index, function () { diamondClick(indexOf(dia), 'table'); });
      const x = cell('lt-x', 'x:' + row.index, function () { askRemove(indexOf(x), 'table'); });
      r.appendChild(eye); r.appendChild(dia); r.appendChild(x);
    }
    return r;
  }
  function buildRailChip(row) {
    const chip = cell('lt-chip lr-chip', 'chip:' + row.index, null);
    chip.addEventListener('click', chipHandler(chip));
    return chip;
  }
  function setIf(e, attr, v) { if (e.getAttribute(attr) !== v) e.setAttribute(attr, v); }
  function patchChip(b, row, info) {
    if (b.classList.contains('active') !== row.active) b.classList.toggle('active', row.active);
    if (b.classList.contains('is-hidden') !== !!row.hidden) b.classList.toggle('is-hidden', !!row.hidden);
    if (row.active) setIf(b, 'aria-current', 'true'); else if (b.getAttribute('aria-current') !== null) b.removeAttribute('aria-current');
    const body = row.kind === 'base' ? 'stack' : String(row.number);
    if (b.dataset.body !== body) { b.dataset.body = body; if (row.kind === 'base') b.innerHTML = ICON.stack; else b.textContent = body; }
    if (info && b.dataset.label !== info.label) { b.dataset.label = info.label; UI.name(b, info.label); }
  }
  function patchRow(r, row, model) {
    const kids = r.children;
    for (let c = 0; c < kids.length; c++) {
      const b = kids[c], key = b.dataset.key, kind = key.slice(0, key.indexOf(':')), info = model.cells[key];
      if (kind === 'chip') {
        patchChip(b, row, info);
        continue;
      } else if (kind === 'eye') {
        const want = row.visible ? 'on' : 'off';
        if (b.dataset.body !== want) { b.dataset.body = want; b.innerHTML = row.visible ? ICON.eyeOn : ICON.eyeOff; }
        setIf(b, 'aria-pressed', row.visible ? 'true' : 'false');
      } else if (kind === 'dia') {
        const dwant = row.keyframe ? 'on' : 'off';
        if (b.dataset.body !== dwant) { b.dataset.body = dwant; b.innerHTML = row.keyframe ? ICON.diaOn : ICON.diaOff; }
      } else if (kind === 'x') {
        if (b.dataset.body !== 'x') { b.dataset.body = 'x'; b.innerHTML = ICON.x; }
      }
      if (info && b.dataset.label !== info.label) { b.dataset.label = info.label; UI.name(b, info.label); }
    }
  }
  function focusedKey(container) {
    const a = typeof document.activeElement !== 'undefined' ? document.activeElement : null;
    return a && container.contains && container.contains(a) && a.dataset ? a.dataset.key : null;
  }
  // keep the active chip inside a view's scrolling column (a click on iOS does not focus a button, so the browser's own scroll-into-view does not run); the strip scrolls sideways. ONE function for the
  // rail, the strip and the table: in the table the chip is the first child of a row, and the column (v.smooth) scrolls with scrollBy and the shared behaviour - never the window, never the focus.
  function revealActive(v) {
    const col = v && v.chips;
    if (!col || !col.getBoundingClientRect) return;
    let active = null;
    const cs = col.children;
    for (let c = 0; c < cs.length; c++) {
      const k = cs[c].classList.contains('active') ? cs[c] : (cs[c].children && cs[c].children[0]);
      if (k && k.classList && k.classList.contains('active')) active = k;
    }
    if (!active) return;
    const cr = active.getBoundingClientRect(), vr = col.getBoundingClientRect();
    const cstyle = typeof getComputedStyle === 'function' ? getComputedStyle(col) : null;
    if (v.horizontal) {
      const pad = (cstyle ? parseFloat(cstyle.paddingLeft) : 0) || 0;
      const d = revealDelta(cr.left, cr.right, vr.left + pad, vr.right - pad);
      if (d) col.scrollLeft += d;
    } else {
      const pad = (cstyle ? parseFloat(cstyle.paddingTop) : 0) || 0;
      const d = revealDelta(cr.top, cr.bottom, vr.top + pad, vr.bottom - pad);
      if (!d) return;
      if (v.smooth && col.scrollBy) col.scrollBy({ top: d, behavior: scrollBehavior() }); else col.scrollTop += d;
    }
  }
  function renderNarrow(v, model, rebuilt, focusKey) {
    const rs = model.rows;   // rs[0] is the Base (the fixed chip); the scrolling column holds the layers only
    if (rebuilt) {
      v.chips.textContent = '';
      rs.slice(1).forEach(function (row) { v.chips.appendChild(buildRailChip(row)); });
    }
    patchChip(v.base, rs[0], model.cells['chip:base']);
    const cs = v.chips.children;
    for (let i = 0; i < cs.length; i++) patchChip(cs[i], rs[i + 1], model.cells[cs[i].dataset.key]);
    const a = model.actions;
    const want = a.index === null || a.eye.visible ? 'on' : 'off';
    if (v.eye.dataset.body !== want) { v.eye.dataset.body = want; v.eye.innerHTML = want === 'on' ? ICON.eyeOn : ICON.eyeOff; }
    setIf(v.eye, 'aria-pressed', a.eye.visible ? 'true' : 'false');
    if (v.eye.dataset.label !== a.eye.label) { v.eye.dataset.label = a.eye.label; UI.name(v.eye, a.eye.label); }
    UI.setDisabled(v.eye, a.eye.reason);
    const dwant = a.dia.filled ? 'on' : 'off';
    if (v.dia.dataset.body !== dwant) { v.dia.dataset.body = dwant; v.dia.innerHTML = a.dia.filled ? ICON.diaOn : ICON.diaOff; }
    if (v.dia.dataset.label !== a.dia.label) { v.dia.dataset.label = a.dia.label; UI.name(v.dia, a.dia.label); }
    UI.setDisabled(v.dia, a.dia.reason);
    if (v.x.dataset.label !== a.x.label) { v.x.dataset.label = a.x.label; UI.name(v.x, a.x.label); }
    UI.setDisabled(v.x, a.x.reason);
    setIf(v.more, 'aria-expanded', model.more.open ? 'true' : 'false');
    if (v.more.classList.contains('has-state') !== model.more.dot) v.more.classList.toggle('has-state', model.more.dot);
    UI.setDisabled(v.more, model.more.reason);
    if (rebuilt && focusKey) { const b = findCell(focusKey, v.name); if (b && b.focus) b.focus(); }
    const key = activeChipKey();
    if (rebuilt || key !== v.lastActive) { v.lastActive = key; revealActive(v); }
  }
  function render(model) {
    const key = model.rows.map(function (r) { return r.key; }).join(',');
    const rebuilt = key !== structKey;
    const focusKeys = {};
    if (rebuilt) {
      const focused = focusedKey(table);
      Object.keys(views).forEach(function (n) { focusKeys[n] = focusedKey(views[n].container); });
      structKey = key;
      rowsEl.textContent = '';
      model.rows.slice(1).forEach(function (row) { rowsEl.appendChild(buildRow(row)); });   // model.rows[0] is the Base: its row stays (built once, below)
      if (!baseEl.children.length) buildRow(model.rows[0], baseEl);
      if (focused) { const b = findCell(focused, 'table'); if (b && b.focus) b.focus(); }
    }
    patchRow(baseEl, model.rows[0], model);
    const rs = rowsEl.children;
    for (let i = 0; i < rs.length; i++) patchRow(rs[i], model.rows[i + 1], model);
    const rowKey = activeChipKey();   // the active row stays inside the scroller (after "+", a chip click, the keyboard, a remove, a restore)
    if (rebuilt || rowKey !== tableView.lastActive) { tableView.lastActive = rowKey; revealActive(tableView); }
    // the foot
    setIf(moreBtn, 'aria-expanded', model.more.open ? 'true' : 'false');
    if (moreBtn.classList.contains('has-state') !== model.more.dot) moreBtn.classList.toggle('has-state', model.more.dot);
    UI.setDisabled(moreBtn, model.more.reason);
    Object.keys(views).forEach(function (n) { renderNarrow(views[n], model, rebuilt, focusKeys[n]); });
  }

  // ---- the name line (the table only: the rail has none) -------------------------------------------------------------------------------------------
  let last = null;
  function refreshName() {
    const info = last && lastModel ? lastModel.cells[last] : null;
    const label = info ? info.name : T['layers.hint'], state = info && info.state ? ' · ' + info.state : '';
    if (nameLabel.textContent !== label) nameLabel.textContent = label;
    if (nameState.textContent !== state) nameState.textContent = state;
  }
  function touched(e) {
    const b = e.target && e.target.closest ? e.target.closest('.lt-cell') : null;
    if (!b || !table.contains(b)) return;
    last = b.dataset.key;
    refreshName();
  }
  table.addEventListener('pointerdown', touched, true);
  table.addEventListener('focusin', touched);
  table.addEventListener('pointerover', function (e) { if (e.pointerType === 'mouse') touched(e); });

  // ---- the tick -----------------------------------------------------------------------------------------------------------------------------------
  function readState() {
    const a = api(), more = a && a.moreState ? a.moreState() : null;   // the layer "Mehr" state; before sketch.js has set layerApi up: closed, no dot
    return {
      layers: typeof additionalLayers !== 'undefined' ? additionalLayers : [],
      active: typeof activeLayer !== 'undefined' ? activeLayer : 'base',
      timeline: typeof timeline !== 'undefined' ? timeline : null,
      moreOpen: !!(more && more.open),
      moreDot: !!(more && more.dot),
    };
  }
  function sync() {
    const st = readState(), sig = tableSignature(st);
    if (sig !== sigNow) { sigNow = sig; lastModel = layerTableModel(st); render(lastModel); }
    refreshName();
  }
  UI.onSync(sync);
  function revealAllActive() { Object.keys(views).forEach(function (n) { revealActive(views[n]); }); revealActive(tableView); }   // a view may have been hidden when the active chip changed
  root.layerTable.revealActive = revealAllActive;   // ui-phone.js: the strip lost its scroll position when it moved into the panel
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', revealAllActive);
  sync();
})(typeof window !== 'undefined' ? window : globalThis);
