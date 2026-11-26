/*
 * The Lines button (task 024): #btn-toggle-lines and the slider #line-weight-group. UI only; the state is lineStyle ({ visible, weight }, core/state.js),
 * which drawCurvedBezier() (core/curves.js) and generateSVGString() (core/export.js) read. Loaded after ui-rail.js (it needs UI.onSync) and kept out of sketch.js
 * on purpose (sketch.js is pinned by the morph tests, and its p5 handler count by test-layer-more.js).
 *
 * The click cycle: OFF -> ON (no slider) -> ON, slider open -> OFF (slider closed) -> ON ...
 *   In the SIMPLE view (ui-mode.js, task 143) the slider is not offered: the button is a plain switch, ON <-> OFF, and its name says "Linien an/aus" (the advanced name adds the width).
 *   class 'active' (ui-rail.js mirrors it into aria-pressed) = lines on; aria-expanded = slider open. The slider's open/closed state is not saved.
 * A session restore (core/session-apply.js) assigns a NEW lineStyle object: a different object than this file wrote last means an outside change, so the slider
 * closes and the controls follow (on the next draw tick). The button is a plain click listener (like the other ui-rail buttons); in the phone layout it sits in
 * the rail's "Mehr" sheet, which this click does not close (it is in neither of ui-rail.js's close lists), so the slider can be used there.
 */
(function () {
  const btn = document.getElementById('btn-toggle-lines');
  const group = document.getElementById('line-weight-group');
  const input = document.getElementById('line-weight-input');
  const out = document.getElementById('line-weight-value');
  if (!btn || typeof lineStyle === 'undefined') return;
  let open = false, seen = lineStyle, nameKey = null;
  const simple = function () { return typeof uiMode !== 'undefined' && uiMode === 'simple'; };
  // the name (title and aria-label) follows the view and the language; written only when it changes (show() runs on every sync)
  function syncName() {
    const l = (typeof window !== 'undefined' && window.uiI18n) ? window.uiI18n.lang : '', key = (simple() ? 's' : 'a') + l;
    if (typeof UI === 'undefined' || !UI.t) return;
    nameKey = key;
    const text = UI.t(simple() ? 'lines.toggle' : 'lines.button');   // compared with the element itself: ui-i18n.js rewrites the markup name at load for a language other than German
    if (btn.getAttribute('title') !== text) btn.setAttribute('title', text);
    if (btn.getAttribute('aria-label') !== text) btn.setAttribute('aria-label', text);
  }

  function show() {
    if (!lineStyle.visible || simple()) open = false;
    syncName();
    btn.classList.toggle('active', !!lineStyle.visible);
    // task 084: write an attribute only when its value changes (show() runs on every sync)
    const pressed = lineStyle.visible ? 'true' : 'false', expanded = open ? 'true' : 'false';
    if (btn.getAttribute('aria-pressed') !== pressed) btn.setAttribute('aria-pressed', pressed);
    if (btn.getAttribute('aria-expanded') !== expanded) btn.setAttribute('aria-expanded', expanded);
    if (group && group.hidden === open) group.hidden = !open;
    if (input && Number(input.value) !== lineStyle.weight) input.value = lineStyle.weight;
    if (out && out.textContent !== String(lineStyle.weight)) out.textContent = String(lineStyle.weight);
  }
  function set(next) { lineStyle = next; seen = next; show(); if (typeof redraw === 'function') redraw(); }

  btn.addEventListener('click', function () {
    if (!lineStyle.visible) set({ visible: true, weight: lineStyle.weight });
    else if (!open && !simple()) { open = true; show(); }
    else { open = false; set({ visible: false, weight: lineStyle.weight }); }
  });
  if (input) input.addEventListener('input', function () {
    const w = Number(input.value);
    if (!isFinite(w)) return;
    set({ visible: lineStyle.visible, weight: Math.min(LINE_WEIGHT.max, Math.max(LINE_WEIGHT.min, w)) });
  });
  if (typeof UI !== 'undefined' && UI.onSync) UI.onSync(function () {
    if (lineStyle !== seen) { seen = lineStyle; open = false; }   // a session restore (or anything else) replaced the state
    show();
  });
  if (typeof document.addEventListener === 'function') document.addEventListener('modechange', show);   // the view changes the name and closes the slider at once (a mode switch redraws nothing, so no UI tick comes)
  show();
})();
