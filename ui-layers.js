/*
 * The layer table (layer-table commit 1). UI only. A PURE VIEW of the sheets: it is rebuilt from additionalLayers, activeLayer and timeline (core/state.js globals) on every UI.onSync tick -
 * after a signature comparison, so nothing is built while nothing changed - and writes no state of its own. Every action goes through window.layerApi (sketch.js: the same call sequences the
 * old tab / "+ Layer" / remove handlers run), so the old layer row (still in the DOM, hidden by style.css where the table shows) and the table can never disagree.
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
 * The model (layerDisplayNumber, layerRemoveNeedsConfirm, layerTableModel, tableSignature) is pure and loadable without a DOM (tools/ui/test-layer-table.js). The German texts are keyed
 * (layers.*); the dictionary comes in a later phase.
 */
(function (root) {
  'use strict';
  const T = {
    'layers.table': 'Ebenen',
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
    'layers.more.none': 'Keine Ebene aktiv.',
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
      cells['x:' + i] = { name: T['layers.x.name'](n), state: '', label: T['layers.x.name'](n) };
    });
    cells.add = { name: T['layers.add'], state: '', label: T['layers.add'] };
    const noLayer = !(typeof active === 'number' && layers[active] && !layers[active].isTimelinePlayback);
    cells.more = { name: T['layers.more'], state: noLayer ? T['layers.more.none'] : (st.moreOpen ? T['layers.more.open'] : T['layers.more.closed']), label: T['layers.more'] };
    return { rows: rows, cells: cells, more: { disabled: noLayer, reason: noLayer ? T['layers.more.none'] : null, open: !!st.moreOpen && !noLayer, dot: !!st.moreDot && !noLayer } };
  }
  // A string that changes exactly when the model would: compared on every tick before anything is built.
  function tableSignature(st) {
    let s = String(st.active) + '|' + (st.moreOpen ? 1 : 0) + (st.moreDot ? 1 : 0) + '|';
    const layers = st.layers || [];
    for (let i = 0; i < layers.length; i++) s += (layers[i].isTimelinePlayback ? 'p' : (layers[i].enabled ? 'v' : 'h') + (isKeyframe(st.timeline, i) ? 'k' : '')) + ',';
    return s;
  }
  root.layerTable = { layerDisplayNumber: layerDisplayNumber, layerRemoveNeedsConfirm: layerRemoveNeedsConfirm, layerTableModel: layerTableModel, tableSignature: tableSignature, T: T };

  // ---- the DOM ----------------------------------------------------------------------------------------------------------------------------------
  if (typeof document === 'undefined' || !document.getElementById || typeof UI === 'undefined') return;
  const table = document.getElementById('layer-table');
  if (!table) return;

  const ICON = {
    stack: '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3 L21 8 L12 13 L3 8 Z"/><path d="M3 12 L12 17 L21 12"/><path d="M3 16 L12 21 L21 16"/></svg>',
    eyeOn: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>',
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

  const rowsEl = el('div', 'lt-rows'), footEl = el('div', 'lt-foot'), nameEl = el('p', 'lt-name');
  nameEl.id = 'layer-table-name';
  nameEl.setAttribute('aria-hidden', 'true');
  const nameLabel = el('span', 'lt-name-label'), nameState = el('span', 'lt-name-state');
  nameEl.appendChild(nameLabel); nameEl.appendChild(nameState);

  function api() { return root.layerApi; }
  function indexOf(b) { const k = b.dataset.key || ''; const v = k.slice(k.indexOf(':') + 1); return v === 'base' ? 'base' : parseInt(v, 10); }

  // the add and more cells (the foot) are static: built once
  const addBtn = cell('lt-add', 'add', function () { if (api()) api().add(); sync(); });
  addBtn.innerHTML = ICON.plus;
  const moreBtn = cell('lt-more', 'more', null);
  moreBtn.innerHTML = ICON.more;
  moreBtn.classList.add('nav-more');
  moreBtn.setAttribute('aria-controls', 'layer-more-panel');
  UI.guard(moreBtn, function () { if (api()) api().toggleMore(); sync(); });   // the one click listener of "...": while it is disabled (the Base is active) a click shows the reason instead
  footEl.appendChild(addBtn); footEl.appendChild(moreBtn);
  table.appendChild(rowsEl); table.appendChild(footEl); table.appendChild(nameEl);
  UI.name(addBtn, T['layers.add']);
  UI.name(moreBtn, T['layers.more']);

  // ---- the remove dialog (like "Neu anfangen") --------------------------------------------------------------------------------------------------
  const overlay = document.getElementById('layer-remove-overlay'), cancelBtn = document.getElementById('cancel-layer-remove'), confirmBtn = document.getElementById('confirm-layer-remove');
  const titleEl = document.getElementById('layer-remove-title'), textEl = document.getElementById('layer-remove-text');
  let pendingIndex = null, wasCancelled = true, lastModel = null;
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
  function focusActiveChip() { const b = findCell(activeChipKey()) || findCell('chip:base'); if (b && b.focus) b.focus(); }
  function focusAfterDialog() {
    // cancelled: back to the x that opened it; removed: the active sheet's chip (the removed row is gone)
    const want = wasCancelled && pendingIndex !== null ? 'x:' + pendingIndex : activeChipKey();
    const b = findCell(want) || findCell('chip:base');
    pendingIndex = null;
    if (b && b.focus) b.focus();
  }
  function findCell(key) {
    const all = rowsEl.children;
    for (let r = 0; r < all.length; r++) { const kids = all[r].children; for (let c = 0; c < kids.length; c++) if (kids[c].dataset.key === key) return kids[c]; }
    return null;
  }
  function askRemove(index) {
    const layers = (typeof additionalLayers !== 'undefined') ? additionalLayers : [];
    const layer = layers[index];
    if (!layer || !api()) return;
    const need = layerRemoveNeedsConfirm(layer, typeof timeline !== 'undefined' ? timeline : null, index);
    if (!need.confirm || !overlay) { api().remove(index); sync(); focusActiveChip(); return; }   // the removed row is gone: the focus goes to the active sheet's chip
    pendingIndex = index; wasCancelled = true;
    const n = layerDisplayNumber(layers, index);
    titleEl.textContent = T['layers.remove.title'](n);
    overlay.setAttribute('aria-label', T['layers.remove.title'](n).replace(/\?$/, ''));
    textEl.textContent = need.keyframe ? T['layers.remove.keyframe'](need.lines) : T['layers.remove.lines'](need.lines);
    overlay.classList.remove('hidden');
  }

  // ---- rows: built when the structure changes, patched in place otherwise (a keyboard user keeps the focus) -------------------------------------------
  let structKey = null, sigNow = null;
  function buildRow(row) {
    const r = el('div', 'lt-row');
    r.dataset.row = row.key;
    const chip = cell('lt-chip', 'chip:' + row.index, function () { if (api()) api().select(indexOf(chip)); sync(); });
    r.appendChild(chip);
    if (row.kind === 'layer') {
      const eye = cell('lt-eye', 'eye:' + row.index, function () {
        const i = indexOf(eye), layers = (typeof additionalLayers !== 'undefined') ? additionalLayers : [];
        if (api() && layers[i]) api().setEnabled(i, !layers[i].enabled);
        sync();
      });
      const x = cell('lt-x', 'x:' + row.index, function () { askRemove(indexOf(x)); });
      r.appendChild(eye); r.appendChild(x);
    }
    return r;
  }
  function setIf(e, attr, v) { if (e.getAttribute(attr) !== v) e.setAttribute(attr, v); }
  function patchRow(r, row, model) {
    const kids = r.children;
    for (let c = 0; c < kids.length; c++) {
      const b = kids[c], key = b.dataset.key, kind = key.slice(0, key.indexOf(':')), info = model.cells[key];
      if (kind === 'chip') {
        if (b.classList.contains('active') !== row.active) b.classList.toggle('active', row.active);
        if (b.classList.contains('is-hidden') !== !!row.hidden) b.classList.toggle('is-hidden', !!row.hidden);
        if (row.active) setIf(b, 'aria-current', 'true'); else if (b.getAttribute('aria-current') !== null) b.removeAttribute('aria-current');
        const body = row.kind === 'base' ? 'stack' : String(row.number);
        if (b.dataset.body !== body) { b.dataset.body = body; if (row.kind === 'base') b.innerHTML = ICON.stack; else b.textContent = body; }
      } else if (kind === 'eye') {
        const want = row.visible ? 'on' : 'off';
        if (b.dataset.body !== want) { b.dataset.body = want; b.innerHTML = row.visible ? ICON.eyeOn : ICON.eyeOff; }
        setIf(b, 'aria-pressed', row.visible ? 'true' : 'false');
      } else if (kind === 'x') {
        if (b.dataset.body !== 'x') { b.dataset.body = 'x'; b.innerHTML = ICON.x; }
      }
      if (info && b.dataset.label !== info.label) { b.dataset.label = info.label; UI.name(b, info.label); }
    }
  }
  function render(model) {
    const key = model.rows.map(function (r) { return r.key; }).join(',');
    if (key !== structKey) {
      const focused = typeof document.activeElement !== 'undefined' && document.activeElement && table.contains && table.contains(document.activeElement) ? document.activeElement.dataset.key : null;
      structKey = key;
      rowsEl.textContent = '';
      model.rows.forEach(function (row) { rowsEl.appendChild(buildRow(row)); });
      if (focused) { const b = findCell(focused); if (b && b.focus) b.focus(); }
    }
    const rs = rowsEl.children;
    for (let i = 0; i < rs.length; i++) patchRow(rs[i], model.rows[i], model);
    // the foot
    setIf(moreBtn, 'aria-expanded', model.more.open ? 'true' : 'false');
    if (moreBtn.classList.contains('has-state') !== model.more.dot) moreBtn.classList.toggle('has-state', model.more.dot);
    UI.setDisabled(moreBtn, model.more.reason);
  }

  // ---- the name line ----------------------------------------------------------------------------------------------------------------------------
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
    const more = document.getElementById('btn-more-layer');
    return {
      layers: typeof additionalLayers !== 'undefined' ? additionalLayers : [],
      active: typeof activeLayer !== 'undefined' ? activeLayer : 'base',
      timeline: typeof timeline !== 'undefined' ? timeline : null,
      moreOpen: !!more && more.getAttribute('aria-expanded') === 'true',
      moreDot: !!more && more.classList.contains('has-state'),
    };
  }
  function sync() {
    const st = readState(), sig = tableSignature(st);
    if (sig !== sigNow) { sigNow = sig; lastModel = layerTableModel(st); render(lastModel); }
    refreshName();
  }
  UI.onSync(sync);
  sync();
})(typeof window !== 'undefined' ? window : globalThis);
