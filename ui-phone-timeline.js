/*
 * The timeline sheet's icon row and readout (sheets redesign, commit 5a). UI only. Under the phone layout the timeline "Mehr" sheet (#timeline-group, a bottom sheet since commit 1b of the phone layout)
 * shows ONE row of three icon buttons and ONE readout line instead of the old keyframe list, status span and net box; the existing line-pairing editor shows below them while the pairing toggle is on
 * (until commit 5b replaces it).
 *
 * The MODEL is the existing, hidden timeline controls. Nothing here changes or clones them: the three buttons are this file's own elements and FORWARD their clicks to the model controls, so every
 * action goes through the handlers that have always run:
 *
 *   netrec   "Netz der gewählten Ebene neu aufnehmen": the "Net" button of the keyframe of the layer selected in the Ebenen panel in the (hidden) keyframe list #timeline-keyframe-list
 *            (sketch.js renderTimelineKeyframeList(): one .layer-tab per keyframe in sequence order, its first button is "Net"). Disabled with a reason when the base or a layer that is no keyframe is selected.
 *   pairing  a UI toggle (aria-pressed, not saved, off again whenever the sheet closes): it puts the class ph-tl-editor-open on #timeline-group, which opens the gate of the editor's row (ui-phone-config.js,
 *            `gate`). Disabled with a reason below two keyframes (no segment).
 *   trash    "Zeitleiste entfernen": a click on #btn-clear-timeline, whose handler (ui-timeline.js) ALWAYS asks first (Abbrechen keeps the timeline). Disabled with a reason while there is no keyframe.
 *
 * The readout is one German line from the SAME source the strip's Include-net dot uses (core/netwarp.js timelineNetSummary(): none, partial, pending, incompatible, constant, animated); {n} is the number of
 * the keyframes without a net for `partial` ("2" or "2, 3": derived from timeline.netStates exactly as the summary does) and the number of keyframes for `animated` (timeline.keyframeLayerIds.length).
 *
 *   phoneTimelineModel(input)   PURE. input = { tl, summary, active, pairingOpen } (tl = the timeline or null, summary = timelineNetSummary() or null, active = the active layer: an index or 'base') ->
 *                               { count, readout: { key, params } | null, netrec: { enabled, reason, pos }, pairing: { enabled, reason, pressed }, trash: { enabled, reason } } (reason = a dictionary key).
 *   modelSignature(m, lang)     a string: the view is rebuilt only when it changed (UI.onSync ticks; no MutationObserver).
 *   createTimelineView(doc, win, opts)  the DOM part: makes #ph-tl-icons and #ph-tl-readout in a hidden holder (ui-phone.js moves them into the sheet and back), refreshes on sync().
 *
 * The texts are the dictionary's (ui-i18n.js): timeline.recaptureNet, timeline.pairing, timeline.remove, timeline.net.*, timeline.notKeyframe, timeline.noKeyframes, timeline.need2.
 */
(function (root) {
  'use strict';

  // the German fallback of every key this file uses (the dictionary has them all; this keeps the model usable without it)
  const T = {
    'timeline.recaptureNet': 'Netz der gewählten Ebene neu aufnehmen',
    'timeline.pairing': 'Linienzuordnung',
    'timeline.remove': 'Zeitleiste entfernen',
    'timeline.notKeyframe': 'Gewählte Ebene ist kein Keyframe',
    'timeline.noKeyframes': 'Noch keine Keyframes',
    'timeline.need2': 'Mindestens zwei Keyframes nötig',
    'timeline.net.none': 'Netz: nicht animiert',
    'timeline.net.partial': 'Netz: Keyframe {n} ohne Netz',
    'timeline.net.pending': 'Netz: zweiten Keyframe hinzufügen',
    'timeline.net.incompatible': 'Netz: nicht animierbar',
    'timeline.net.constant': 'Netz: gleich in allen Keyframes',
    'timeline.net.animated': 'Netz: animiert ({n} Keyframes)',
  };
  const READOUT_KEYS = { none: 'timeline.net.none', partial: 'timeline.net.partial', pending: 'timeline.net.pending', incompatible: 'timeline.net.incompatible', constant: 'timeline.net.constant', animated: 'timeline.net.animated' };

  // ---- the pure model -------------------------------------------------------------------------------------------------------------------------------
  function keyframeCount(tl) { return tl && Array.isArray(tl.keyframeLayerIds) ? tl.keyframeLayerIds.length : 0; }
  // the numbers (1-based) of the keyframes that have no net captured: the same rule as timelineNetSummary()
  function missingNets(tl) {
    const st = tl && Array.isArray(tl.netStates) ? tl.netStates : [];
    return (tl && Array.isArray(tl.keyframeLayerIds) ? tl.keyframeLayerIds : []).map(function (_, i) { return st[i] ? 0 : i + 1; }).filter(Boolean);
  }
  function readoutOf(tl, summary) {
    if (!keyframeCount(tl) || !summary || !Object.prototype.hasOwnProperty.call(READOUT_KEYS, summary.state)) return null;
    const key = READOUT_KEYS[summary.state];
    if (summary.state === 'partial') return { key: key, params: { n: missingNets(tl).join(', ') } };
    if (summary.state === 'animated') return { key: key, params: { n: keyframeCount(tl) } };
    return { key: key, params: {} };
  }
  function phoneTimelineModel(input) {
    const inp = input || {}, tl = inp.tl || null, n = keyframeCount(tl);
    const active = inp.active, pos = n && typeof active === 'number' ? tl.keyframeLayerIds.indexOf(active) : -1;
    const netrec = n === 0 ? { enabled: false, reason: 'timeline.noKeyframes', pos: -1 } : (pos < 0 ? { enabled: false, reason: 'timeline.notKeyframe', pos: -1 } : { enabled: true, reason: null, pos: pos });
    const canPair = n >= 2;
    return {
      count: n,
      readout: readoutOf(tl, inp.summary),
      netrec: netrec,
      pairing: { enabled: canPair, reason: canPair ? null : 'timeline.need2', pressed: canPair && !!inp.pairingOpen },
      trash: n === 0 ? { enabled: false, reason: 'timeline.noKeyframes' } : { enabled: true, reason: null },
    };
  }
  function modelSignature(m, lang) {
    return JSON.stringify([lang || '', m.count, m.readout, m.netrec, m.pairing, m.trash]);
  }

  // ---- the DOM part ---------------------------------------------------------------------------------------------------------------------------------
  const ICON = {
    // a sine wave with a record dot
    netrec: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 14 C5 5 9 5 12 14 C14 20 17 20 19 17"/><circle cx="20" cy="6" r="2.2" fill="currentColor" stroke="none"/></svg>',
    // two lines that cross (the pairing of start and end lines)
    pairing: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6 H8 L16 18 H21"/><path d="M3 18 H8 L16 6 H21"/></svg>',
    // a bin
    trash: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7 H20"/><path d="M9 7 V4 H15 V7"/><path d="M6 7 L7 20 H17 L18 7"/><path d="M10 11 V16"/><path d="M14 11 V16"/></svg>',
  };

  function createTimelineView(doc, win, opts) {
    opts = opts || {};
    const html = doc.documentElement, UI = win.UI;
    let pairingOpen = false, signature = null, model = phoneTimelineModel({});

    function el(tag, cls, attrs) { const e = doc.createElement(tag); if (cls) e.className = cls; if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
    function text(key, params) {
      if (win.UI && typeof win.UI.t === 'function' && win.uiI18n && win.uiI18n.has(key)) return win.UI.t(key, params);
      const s = T[key] || key;
      return params ? s.replace(/\{(\w+)\}/g, function (m, k) { return params[k] !== undefined ? params[k] : m; }) : s;
    }
    function group() { return doc.getElementById('timeline-group'); }

    // the two containers live in a hidden holder until ui-phone.js moves them into the sheet (the holder is `hidden`: nothing of them is visible or in the Tab order outside the phone layout)
    const holder = el('div', 'ph-tl-home', { id: 'ph-tl-home' });
    holder.hidden = true;
    const icons = el('div', 'ph-tl-icons', { id: 'ph-tl-icons', role: 'group', 'aria-label': text('timeline.strip'), 'data-i18n': 'timeline.strip' });
    function iconButton(cls, key, svg) {
      const b = el('button', 'icon-btn ph-tl-btn ' + cls, { type: 'button', 'data-i18n': key });
      b.innerHTML = svg;
      if (UI && UI.name) UI.name(b, text(key)); else { b.setAttribute('aria-label', text(key)); b.setAttribute('title', text(key)); }
      return b;
    }
    function sep() { return el('span', 'ph-tl-sep', { 'aria-hidden': 'true' }); }
    const netrecBtn = iconButton('ph-tl-netrec', 'timeline.recaptureNet', ICON.netrec);
    const pairingBtn = iconButton('ph-tl-pairing', 'timeline.pairing', ICON.pairing);
    pairingBtn.setAttribute('aria-pressed', 'false');
    const trashBtn = iconButton('ph-tl-trash', 'timeline.remove', ICON.trash);
    [netrecBtn, sep(), pairingBtn, sep(), trashBtn].forEach(function (n) { icons.appendChild(n); });
    const readoutEl = el('p', 'ph-tl-readout', { id: 'ph-tl-readout', 'aria-live': 'polite' });
    holder.appendChild(icons);
    holder.appendChild(readoutEl);
    (opts.home || doc.body).appendChild(holder);

    // ---- what the model is made of: read-only reads of the timeline, the net summary and the active layer (globals of core/state.js, core/netwarp.js and sketch.js) ----
    function read() {
      const g = opts.read || win;
      const tl = typeof g.timelineState === 'function' ? g.timelineState() : null;
      return { tl: tl, summary: typeof g.timelineSummary === 'function' ? g.timelineSummary() : null, active: typeof g.activeLayerNow === 'function' ? g.activeLayerNow() : 'base' };
    }

    // ---- forwarding: the model controls' own handlers do the work ----
    function forwardNetrec() {
      const r = read(), m = phoneTimelineModel({ tl: r.tl, summary: r.summary, active: r.active, pairingOpen: pairingOpen });
      if (!m.netrec.enabled) return false;
      const list = doc.getElementById('timeline-keyframe-list'), tab = list && list.children && list.children[m.netrec.pos], b = tab && tab.querySelector('button');
      if (!b) return false;
      b.click();
      refresh(true);
      return true;
    }
    function forwardTrash() {
      const b = doc.getElementById('btn-clear-timeline');
      if (!b) return false;
      b.click();   // ui-timeline.js: the confirmation always asks first
      return true;
    }
    function setPairing(open) {
      pairingOpen = !!open;
      const g = group();
      if (g && g.classList) { if (pairingOpen) g.classList.add('ph-tl-editor-open'); else g.classList.remove('ph-tl-editor-open'); }
    }
    function togglePairing() { if (model.pairing.enabled) setPairing(!pairingOpen); refresh(true); }
    if (UI && UI.guard) { UI.guard(netrecBtn, forwardNetrec); UI.guard(pairingBtn, togglePairing); UI.guard(trashBtn, forwardTrash); }
    else { netrecBtn.addEventListener('click', forwardNetrec); pairingBtn.addEventListener('click', togglePairing); trashBtn.addEventListener('click', forwardTrash); }

    function why(key) { return key ? text(key) : null; }
    function render() {
      [[netrecBtn, model.netrec], [pairingBtn, model.pairing], [trashBtn, model.trash]].forEach(function (p) {
        if (UI && UI.setDisabled) UI.setDisabled(p[0], p[1].enabled ? null : why(p[1].reason));
      });
      pairingBtn.setAttribute('aria-pressed', model.pairing.pressed ? 'true' : 'false');
      if (model.pairing.pressed) { if (pairingBtn.className.indexOf('active') < 0) pairingBtn.className += ' active'; } else pairingBtn.className = pairingBtn.className.replace(/\s*\bactive\b/, '');
      const t = model.readout ? text(model.readout.key, model.readout.params) : '';
      if (readoutEl.textContent !== t) readoutEl.textContent = t;
    }
    // sync(): on every UI.onSync tick (cheap: a signature compare); refresh(force): after a tap
    function refresh(force) {
      const g = group();
      // the sheet closed (the group lost ts-open) or the pairing became impossible: the toggle is off again
      if (pairingOpen && ((g && g.classList && !g.classList.contains('ts-open')) || !(read().tl && keyframeCount(read().tl) >= 2))) setPairing(false);
      const r = read();
      model = phoneTimelineModel({ tl: r.tl, summary: r.summary, active: r.active, pairingOpen: pairingOpen });
      const sig = modelSignature(model, win.UI && win.UI.lang);
      if (!force && sig === signature) return false;
      signature = sig;
      render();
      return true;
    }
    function sync() {
      if (!html.classList.contains('sr-timeline')) { if (pairingOpen) setPairing(false); return false; }   // nothing to keep up to date outside the phone layout
      return refresh(false);
    }
    if (UI && UI.onSync) UI.onSync(sync);
    // UI.onSync ticks only when the sketch redraws, and closing and reopening the sheet redraws nothing: without a tick in between, the group would have ts-open again when the next tick looks and the toggle would still be on.
    // Every close of the sheet (the "..." button, Escape, the scrim, a tap outside, a width change) is a click on the strip's "..." (ui-phone.js onClose), and a click bubbles to the document after ui-timeline.js has flipped ts-open
    if (doc.addEventListener) doc.addEventListener('click', function () { sync(); });
    refresh(true);
    // the arrangement changed (the phone layout built or released: ui-phone.js config.layoutSwitch): the pairing toggle is UI state of one arrangement and is off again
    function reset() { if (pairingOpen) setPairing(false); return refresh(true); }
    return { sync: sync, reset: reset, refresh: function () { return refresh(true); }, model: function () { return model; }, forwardNetrec: forwardNetrec, forwardTrash: forwardTrash, togglePairing: togglePairing, nodes: { holder: holder, icons: icons, netrec: netrecBtn, pairing: pairingBtn, trash: trashBtn, readout: readoutEl } };
  }

  const api = { phoneTimelineModel: phoneTimelineModel, modelSignature: modelSignature, readoutOf: readoutOf, missingNets: missingNets, createTimelineView: createTimelineView, T: T, READOUT_KEYS: READOUT_KEYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined' && typeof window !== 'undefined' && document.body) {
    // read-only access to the page's own state: `timeline` (core/state.js), timelineNetSummary() (core/netwarp.js) and `activeLayer` (sketch.js) are globals of classic scripts, not window properties
    window.timelineState = function () { return typeof timeline !== 'undefined' ? timeline : null; };
    window.timelineSummary = function () { return typeof timelineNetSummary === 'function' ? timelineNetSummary() : null; };
    window.activeLayerNow = function () { return typeof activeLayer !== 'undefined' ? activeLayer : 'base'; };
    root.uiPhoneTimeline = createTimelineView(document, window);
  }
})(typeof window !== 'undefined' ? window : this);
