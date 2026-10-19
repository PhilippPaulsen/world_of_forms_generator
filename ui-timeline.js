/*
 * The timeline strip (layer-table commit 6). UI only. A PURE VIEW of the timeline (core/state.js `timeline`, core/netwarp.js timelineNetSummary / netAuthorWarpActive), rebuilt on every UI.onSync
 * tick after a signature comparison, writing no state of its own: every action goes through window.layerApi (sketch.js). The strip sits under the canvas (a child of .canvas-row, directly
 * after #canvas-container) and holds, left to right:
 *
 *   Play        toggles the playback (layerApi.play: the old Play button's three calls). Disabled with a reason while the timeline has fewer than two keyframes.
 *   scrub bar   a real <input type="range"> (aria-label "Zeitleiste", aria-valuetext "NN %"), 0..1 over the whole sequence (layerApi.setProgress: the old progress input's calls). Its thumb
 *               follows the timeline on every tick - while it plays, from the clock - but is NOT overwritten while the person drags it or holds a key on it. One decorative diamond mark per
 *               keyframe (aria-hidden) at its time position: the cumulative segment durations over the total.
 *   Include net the ONE switch for how the NEXT diamond captures the net: null = automatic (on exactly while a net warp is active), true = always, false = never - the cycle of the old
 *               button, kept (core/netwarp.js timelineIncludeNetToggle). It stays operable without an active net (a keyframe set without one stores no net unless it is forced on).
 *               aria-pressed = the shown value; the title says it in words; a state dot while the Timeline's net is 'partial' or 'incompatible'.
 *   Mehr        shows or hides the old #timeline-group (the keyframe list with its "Net" and remove buttons, the net status, the line pairing editor, the status line) and the
 *               "Zeitleiste entfernen" button, which always asks first. Closed by default, not saved.
 *
 * The model (timelineMarks, timelineProgress, diamondPlan, includeNetState, netStateDot) is pure and loadable without a DOM (tools/ui/test-timeline-strip.js). diamondPlan is what the layer
 * views (ui-layers.js) use for their diamond; timelineConfirm is the one confirmation dialog they and the strip share. German texts, keyed (timeline.*).
 */
(function (root) {
  'use strict';
  const T = {
    'timeline.strip': 'Zeitleiste',
    'timeline.play': 'Abspielen',
    'timeline.pause': 'Pause',
    'timeline.scrub': 'Zeitleiste',
    'timeline.need2': 'Mindestens zwei Keyframes nötig',
    'timeline.net.auto.on': 'Netz aufnehmen: automatisch (an)',
    'timeline.net.auto.off': 'Netz aufnehmen: automatisch (aus)',
    'timeline.net.always': 'Netz aufnehmen: immer',
    'timeline.net.never': 'Netz aufnehmen: nie',
    'timeline.more': 'Zeitleiste: Mehr',
    'timeline.clear': 'Zeitleiste entfernen',
    'timeline.confirm.cancel': 'Abbrechen',
    'timeline.confirm.remove': 'Entfernen',
    'timeline.clear.title': 'Zeitleiste entfernen?',
    'timeline.clear.text': 'Alle Keyframes, Linienzuordnungen und Netz-Schnappschüsse der Zeitleiste werden verworfen. Die Ebenen selbst bleiben erhalten. Das lässt sich nicht rückgängig machen.',
    'timeline.dia.title': function (n) { return 'Ebene ' + n + ' aus der Zeitleiste entfernen?'; },
    'timeline.dia.text': function (k) { return 'Die Linienzuordnung ' + (k === 1 ? 'des angrenzenden Segments geht' : 'von ' + k + ' angrenzenden Segmenten geht') + ' verloren (Zuordnung, Umkehrung und Symmetrie-Variante der Linien). Die Ebene selbst bleibt erhalten. Das lässt sich nicht rückgängig machen.'; },
  };

  // ---- the pure model ---------------------------------------------------------------------------------------------------------------------------
  // One mark per keyframe: { index: its layer's array index, number: its place in the sequence (1-based), frac: its time position 0..1 }. The first keyframe is at 0, each next one after the
  // cumulative duration of the segments before it; the last is at 1. With no segment yet (one keyframe) the total is 0 and the mark sits at 0.
  function timelineMarks(tl) {
    if (!tl || !Array.isArray(tl.keyframeLayerIds)) return [];
    const d = Array.isArray(tl.segmentDurationsMs) ? tl.segmentDurationsMs : [];
    let total = 0;
    for (let i = 0; i < d.length; i++) total += d[i];
    let acc = 0;
    return tl.keyframeLayerIds.map(function (id, i) {
      const m = { index: id, number: i + 1, frac: total > 0 ? Math.min(1, acc / total) : 0 };
      acc += d[i] || 0;
      return m;
    });
  }
  // The thumb's position 0..1: while it plays from the clock (nowMs - startTime), else elapsedMs, over the whole sequence's duration.
  function timelineProgress(tl, nowMs) {
    if (!tl || !Array.isArray(tl.segmentDurationsMs)) return 0;
    let total = 0;
    for (let i = 0; i < tl.segmentDurationsMs.length; i++) total += tl.segmentDurationsMs[i];
    if (!(total > 0)) return 0;
    const t = tl.playing ? nowMs - tl.startTime : tl.elapsedMs;
    return Math.max(0, Math.min(1, t / total));
  }
  // The diamond of the layer at `index`: null for a missing layer or the playback layer (it never is a row). Filled = the layer is a keyframe; action = what a click does: 'add' (the layer
  // becomes the next keyframe) or 'remove' (it leaves the timeline). needsConfirm / segments: removing a keyframe merges or drops the segments NEXT to it (spliceKeyframeOutOfTimeline: an
  // interior keyframe merges its two segments into one fresh default, the first or the last drops its one), and what is lost is a user-set pairing - a non-null segmentPairings,
  // segmentFlips or segmentMembers entry of such a segment (the defaults are stored as null).
  function diamondPlan(layers, tl, index) {
    const layer = Array.isArray(layers) ? layers[index] : null;
    if (!layer || layer.isTimelinePlayback) return null;
    const pos = tl && Array.isArray(tl.keyframeLayerIds) ? tl.keyframeLayerIds.indexOf(index) : -1;
    if (pos < 0) return { filled: false, action: 'add', needsConfirm: false, segments: [] };
    const count = Array.isArray(tl.segmentDurationsMs) ? tl.segmentDurationsMs.length : 0;
    const adjacent = [];
    if (pos - 1 >= 0 && pos - 1 < count) adjacent.push(pos - 1);
    if (pos < count) adjacent.push(pos);
    const set = function (a, s) { return Array.isArray(a) && a[s] !== null && a[s] !== undefined; };
    const lost = adjacent.filter(function (s) { return set(tl.segmentPairings, s) || set(tl.segmentFlips, s) || set(tl.segmentMembers, s); });
    return { filled: true, action: 'remove', needsConfirm: lost.length > 0, segments: lost };
  }
  // The Include net switch: override = null (automatic) | true | false, authorActive = whether a net warp is active now. The shown value is the override, or the automatic value.
  function includeNetState(override, authorActive) {
    const auto = override === null || override === undefined;
    const on = auto ? !!authorActive : !!override;
    const mode = auto ? 'auto' : (override ? 'always' : 'never');
    const title = auto ? (on ? T['timeline.net.auto.on'] : T['timeline.net.auto.off']) : (override ? T['timeline.net.always'] : T['timeline.net.never']);
    return { on: on, mode: mode, title: title };
  }
  // The state dot of the Include net switch: the Timeline's net is not (fully) animated because a keyframe has none or two do not match.
  function netStateDot(summary) { return !!summary && (summary.state === 'partial' || summary.state === 'incompatible'); }
  root.timelineModel = { timelineMarks: timelineMarks, timelineProgress: timelineProgress, diamondPlan: diamondPlan, includeNetState: includeNetState, netStateDot: netStateDot, T: T };

  // ---- the DOM ----------------------------------------------------------------------------------------------------------------------------------
  if (typeof document === 'undefined' || !document.getElementById || typeof UI === 'undefined') return;
  function api() { return root.layerApi; }
  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  // ---- the confirmation dialog (shared with the diamonds of ui-layers.js): timelineConfirm({ title, text, confirmLabel, onConfirm, returnFocus }) ----
  const overlay = document.getElementById('timeline-confirm-overlay'), cancelBtn = document.getElementById('cancel-timeline-confirm'), confirmBtn = document.getElementById('confirm-timeline-confirm');
  const titleEl = document.getElementById('timeline-confirm-title'), textEl = document.getElementById('timeline-confirm-text');
  let pending = null, wasCancelled = true;
  if (overlay && cancelBtn && confirmBtn) {
    UI.dialog(overlay, { setAttribute: function () { }, focus: function () { const p = pending; pending = null; if (p && p.returnFocus) p.returnFocus(); } }, cancelBtn);
    cancelBtn.addEventListener('click', function () { wasCancelled = true; overlay.classList.add('hidden'); });
    confirmBtn.addEventListener('click', function () {
      wasCancelled = false;
      const p = pending;
      overlay.classList.add('hidden');
      if (p && p.onConfirm) p.onConfirm();
    });
    root.timelineConfirm = function (opts) {
      pending = opts; wasCancelled = true;
      titleEl.textContent = opts.title;
      overlay.setAttribute('aria-label', opts.title.replace(/\?$/, ''));
      textEl.textContent = opts.text;
      confirmBtn.textContent = opts.confirmLabel || T['timeline.confirm.remove'];
      overlay.classList.remove('hidden');
    };
  }

  const strip = document.getElementById('timeline-strip');
  if (!strip) return;
  const group = document.getElementById('timeline-group');
  const ICON = {
    play: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M7 5 L19 12 L7 19 Z"/></svg>',
    pause: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>',
    sine: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12 C5 3 9 3 12 12 C15 21 19 21 22 12"/></svg>',
    more: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
    mark: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 2 L22 12 L12 22 L2 12 Z"/></svg>',
  };
  function btn(cls, icon) { const b = el('button', 'icon-btn ts-btn ' + cls); b.type = 'button'; b.innerHTML = icon; return b; }
  const playBtn = btn('ts-play', ICON.play);
  const bar = el('div', 'ts-bar'), marksEl = el('div', 'ts-marks'), input = el('input', 'ts-range');
  marksEl.setAttribute('aria-hidden', 'true');
  input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '0.001'; input.value = '0';
  input.setAttribute('aria-label', T['timeline.scrub']);
  input.setAttribute('aria-valuetext', '0 %');
  bar.appendChild(marksEl); bar.appendChild(input);
  const netBtn = btn('ts-net', ICON.sine);
  netBtn.setAttribute('aria-pressed', 'false');
  const moreBtn = btn('ts-more nav-more', ICON.more);
  moreBtn.setAttribute('aria-expanded', 'false');
  if (group) moreBtn.setAttribute('aria-controls', 'timeline-group');
  strip.appendChild(playBtn); strip.appendChild(bar); strip.appendChild(netBtn); strip.appendChild(moreBtn);
  UI.name(playBtn, T['timeline.play']);
  UI.name(moreBtn, T['timeline.more']);
  UI.name(netBtn, T['timeline.net.auto.off']);

  let tlNow = null, interacting = false, moreOpen = false, sigNow = null, marksKey = null, lastNet = '', lastPlaying = null, lastValue = null;
  function timelineNow() { return typeof timeline !== 'undefined' ? timeline : null; }
  function clock() { return typeof millis === 'function' ? millis() : (typeof performance !== 'undefined' ? performance.now() : 0); }
  function sync() { /* assigned below */ }

  UI.guard(playBtn, function () { if (api()) api().play(); sync(); });
  UI.guard(input, function () { });   // a click on the disabled scrub bar shows its reason
  input.addEventListener('input', function () {
    if (UI.isDisabled(input)) { input.value = '0'; return; }
    const p = parseFloat(input.value);
    if (api()) api().setProgress(p);
    lastValue = input.value;   // what the person set is what the thumb shows: the tick does not overwrite it, and the spoken value follows at once
    setIf(input, 'aria-valuetext', Math.round(p * 100) + ' %');
    sync();
  });
  // the thumb is not overwritten while the person drags it or holds a key on it
  input.addEventListener('pointerdown', function () { interacting = true; });
  input.addEventListener('keydown', function () { interacting = true; });
  ['pointerup', 'pointercancel', 'keyup', 'blur'].forEach(function (t) { input.addEventListener(t, function () { interacting = false; }); });
  if (typeof window !== 'undefined' && window.addEventListener) { window.addEventListener('pointerup', function () { interacting = false; }); window.addEventListener('pointercancel', function () { interacting = false; }); }
  netBtn.addEventListener('click', function () { if (api()) api().toggleIncludeNet(); sync(); });
  function setMore(open) {
    moreOpen = !!open;
    moreBtn.setAttribute('aria-expanded', moreOpen ? 'true' : 'false');
    if (group) group.classList.toggle('ts-open', moreOpen);
  }
  // opening brings the WHOLE group into view with the layer block's reveal (ui-layers.js: layerTable.revealPanel, the one implementation); closing scrolls nothing
  moreBtn.addEventListener('click', function () { setMore(!moreOpen); sync(); if (moreOpen && group && root.layerTable && root.layerTable.revealPanel) root.layerTable.revealPanel(group); });

  // "Zeitleiste entfernen": inside the old group, always asks first
  const clearBtn = document.getElementById('btn-clear-timeline');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (!root.timelineConfirm) { if (api()) api().clearTimeline(); sync(); return; }
      root.timelineConfirm({
        title: T['timeline.clear.title'], text: T['timeline.clear.text'], confirmLabel: T['timeline.clear'],
        onConfirm: function () { if (api()) api().clearTimeline(); sync(); },
        returnFocus: function () { if (typeof clearBtn.focus === 'function' && !clearBtn.hidden) clearBtn.focus(); else moreBtn.focus(); },
      });
    });
  }

  function setIf(e, a, v) { if (e.getAttribute(a) !== v) e.setAttribute(a, v); }
  function rebuildMarks(marks) {
    marksEl.textContent = '';
    marks.forEach(function (m) {
      const s = el('span', 'ts-mark');
      s.setAttribute('aria-hidden', 'true');
      s.setAttribute('style', '--f:' + m.frac);
      s.dataset.index = String(m.index);
      s.innerHTML = ICON.mark;
      marksEl.appendChild(s);
    });
  }
  sync = function () {
    const tl = timelineNow();
    const n = tl && Array.isArray(tl.keyframeLayerIds) ? tl.keyframeLayerIds.length : 0;
    const playable = n >= 2;
    const mk = tl ? n + ':' + tl.keyframeLayerIds.join(',') + ':' + (tl.segmentDurationsMs || []).join(',') : '';
    if (mk !== marksKey) { marksKey = mk; rebuildMarks(timelineMarks(tl)); }
    // play and the scrub bar: disabled with a reason below two keyframes
    const reason = playable ? null : T['timeline.need2'];
    UI.setDisabled(playBtn, reason);
    UI.setDisabled(input, reason);
    const playing = !!(tl && tl.playing);
    if (playing !== lastPlaying) { lastPlaying = playing; playBtn.innerHTML = playing ? ICON.pause : ICON.play; UI.name(playBtn, playing ? T['timeline.pause'] : T['timeline.play']); }
    // the thumb
    if (!interacting) {
      const p = playable ? timelineProgress(tl, clock()) : 0;
      const v = String(Math.round(p * 1000) / 1000);
      if (v !== lastValue) { lastValue = v; input.value = v; setIf(input, 'aria-valuetext', Math.round(p * 100) + ' %'); }
    }
    // Include net: the shown value, its words, the dot
    const ov = api() && api().includeNet ? api().includeNet() : null;
    const active = typeof netAuthorWarpActive === 'function' ? netAuthorWarpActive() : false;
    const st = includeNetState(ov, active);
    const dot = netStateDot(typeof timelineNetSummary === 'function' ? timelineNetSummary() : null);
    const key = st.mode + '|' + st.on + '|' + dot;
    if (key !== lastNet) {
      lastNet = key;
      setIf(netBtn, 'aria-pressed', st.on ? 'true' : 'false');
      if (netBtn.classList.contains('active') !== st.on) netBtn.classList.toggle('active', st.on);
      if (netBtn.classList.contains('has-state') !== dot) netBtn.classList.toggle('has-state', dot);
      UI.name(netBtn, st.title);
    }
    if (clearBtn) { const want = !tl; if (clearBtn.hidden !== want) clearBtn.hidden = want; }
  };
  UI.onSync(sync);
  setMore(false);
  sync();
})(typeof window !== 'undefined' ? window : globalThis);
