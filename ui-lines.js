/*
 * The Lines button (task 024): #btn-toggle-lines and the slider #line-weight-group. UI only; the state is lineStyle ({ visible, weight }, core/state.js),
 * which drawCurvedBezier() (core/curves.js) and generateSVGString() (core/export.js) read. Loaded after ui-rail.js (it needs UI.onSync) and kept out of sketch.js
 * on purpose (sketch.js is pinned by the morph tests, and its p5 handler count by test-layer-more.js).
 *
 * The click cycle: OFF -> ON (no slider) -> ON, slider open -> OFF (slider closed) -> ON ...
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
  let open = false, seen = lineStyle;

  function show() {
    if (!lineStyle.visible) open = false;
    btn.classList.toggle('active', !!lineStyle.visible);
    btn.setAttribute('aria-pressed', lineStyle.visible ? 'true' : 'false');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (group && group.hidden === open) group.hidden = !open;
    if (input && Number(input.value) !== lineStyle.weight) input.value = lineStyle.weight;
    if (out && out.textContent !== String(lineStyle.weight)) out.textContent = String(lineStyle.weight);
  }
  function set(next) { lineStyle = next; seen = next; show(); if (typeof redraw === 'function') redraw(); }

  btn.addEventListener('click', function () {
    if (!lineStyle.visible) set({ visible: true, weight: lineStyle.weight });
    else if (!open) { open = true; show(); }
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
  show();
})();
