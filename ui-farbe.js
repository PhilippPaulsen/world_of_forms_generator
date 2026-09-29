/*
 * The Farbe nav row (UI rework 4d): the harmony rule choice, the axis steppers, and the "Mehr" overlay. It wires
 * markup that already exists in index.html to the EXISTING face-color logic in sketch.js/core/color.js/
 * core/facecolor.js - nothing is duplicated:
 *
 *   rules      a segmented row of the four harmony rules (core/color.js's registry; a fixed, stable set) driving
 *              the hidden #face-colors-rule <select>, exactly the way the Netz row's strength stepper drives its
 *              hidden #net-strength-input: a click sets the select's value and dispatches 'change', which is the
 *              SAME event initFaceColorsPanel() already listens for. isotone and shadow-series are unverified
 *              (core/color.js): selectable, greyed (.unverified), the reason stays in the tooltip - never disabled
 *              for that alone.
 *   axes       #face-colors-axes, sketch.js's own "<- value ->" rows (built by renderFaceColorsPanel(), unchanged),
 *              relocated into this row and only restyled to its height/spacing.
 *   More       "Spread colors", "Reset colors", the unassigned-trails note and the cross-layer overlay note -
 *              moved into #more-farbe unchanged (ids and handlers untouched).
 *
 * Eligibility: this row applies to the base sheet and eligible layers, exactly as sketch.js already decides
 * (faceFillsUnavailableReason()) - PLUS a row-level condition of its own: face fill itself must be on
 * (activeShowFaces()), since switching to the Farbe tab must never switch it on. Either way the whole row stays
 * visible and aria-disabled with the reason; never hidden. Fill being off additionally puts a small dot on the
 * old toolbar's fill button (#btn-toggle-faces) while the Farbe tab is open, pointing at the fix.
 *
 * updateFaceColorsPanel() (sketch.js) only rebuilds the rule/axis DOM while its panel is VISIBLE (activeShowFaces());
 * it is called again at the top of sync() below so this row always reads this frame's state, not stale DOM from
 * whenever the panel (in the old toolbar) was last shown.
 *
 * The German texts below are the reasons for now; the dictionary (data-i18n keys) comes in a later phase.
 */
(function () {
  const T = { 'reason.fill.off': 'Fläche füllen einschalten' };
  const $ = function (s) { return document.querySelector(s); };

  const row = $('#nav-farbe'), panel = $('#more-farbe'), moreBtn = $('#btn-more-farbe');
  const ruleSelect = $('#face-colors-rule'), ruleBtns = Array.prototype.slice.call(row.querySelectorAll('.fc-rule-btn'));
  const fillBtn = $('#btn-toggle-faces');

  // ---- anchor (Group D Phase B2): the atlas position a future Weiß/Schwarz/Schatten/Wert selection will
  // read from (Phase B4 - not built yet, so these steppers have no effect on the pattern's colors right
  // now). Per-sheet, exactly like the rule/axes above: anchorFor(activeLayer) (core/facecolor.js), reset
  // with the grid. The two rows reuse sketch.js's faceColorsStepper() verbatim (same "<n>/<c>" chrome as
  // the rule axes above) - built ONCE here, then just refreshed on every sync() (not rebuilt - the
  // onStep closures always resolve anchorFor(activeLayer) fresh, so a sheet switch never needs new
  // buttons, only a re-read of that sheet's own numbers, the same querySelector('.pairing-variant-count')
  // update sketch.js's own per-trail slot stepper already uses).
  //
  // Register count: matches core/farborgel-bridge.js's FARBORGEL_REGISTER_ORDER.length (28), kept as a
  // plain number here rather than referencing that array directly - farborgel-bridge.js isn't loaded in
  // the browser yet (Phase A only exercised it headlessly; Phase B4 is its first real UI consumer, and is
  // also when a register's letter label becomes worth showing here). tools/color/test-anchor.js cross-
  // checks this same count and the wraparound arithmetic against the real array.
  const ANCHOR_HUE_COUNT = 24, ANCHOR_REGISTER_COUNT = 28;
  const anchorHueRow = $('#farbe-anchor-hue-row'), anchorRegisterRow = $('#farbe-anchor-register-row');
  let anchorHueStepper = null, anchorRegisterStepper = null;
  if (anchorHueRow && anchorRegisterRow && typeof anchorFor === 'function' && typeof faceColorsStepper === 'function') {
    anchorHueStepper = faceColorsStepper(0, ANCHOR_HUE_COUNT, 'Anker: Farbton (1–24, Farborgel-Zählung)', function (delta) {
      const a = anchorFor(activeLayer);
      if (!a) return;
      a.hueIndex = ((a.hueIndex - 1 + delta + ANCHOR_HUE_COUNT) % ANCHOR_HUE_COUNT) + 1;
      sync();
    });
    anchorHueRow.appendChild(anchorHueStepper);
    anchorRegisterStepper = faceColorsStepper(0, ANCHOR_REGISTER_COUNT, 'Anker: Register (Atlas-Position)', function (delta) {
      const a = anchorFor(activeLayer);
      if (!a || a.registerIndex === null) return; // hue-only state (Wert, Phase B4): no register axis to step
      a.registerIndex = (a.registerIndex + delta + ANCHOR_REGISTER_COUNT) % ANCHOR_REGISTER_COUNT;
      sync();
    });
    anchorRegisterRow.appendChild(anchorRegisterStepper);
  }
  // Reads the active sheet's own anchor into the two steppers' displayed counts - called from sync() below,
  // same cadence as everything else in this row (every redraw), but touches only two textContent writes
  // (no rebuild) unless there is no active sheet's anchor to show (defensive; anchorFor() is null only for
  // a layer index that no longer exists, which sync()'s own eligibility check already guards against).
  function syncAnchor() {
    if (!anchorHueStepper || typeof anchorFor !== 'function') return;
    const a = anchorFor(activeLayer);
    const hCnt = anchorHueStepper.querySelector('.pairing-variant-count');
    const rCnt = anchorRegisterStepper.querySelector('.pairing-variant-count');
    if (!a) {
      if (hCnt) hCnt.textContent = `–/${ANCHOR_HUE_COUNT}`;
      if (rCnt) rCnt.textContent = `–/${ANCHOR_REGISTER_COUNT}`;
      return;
    }
    if (hCnt) hCnt.textContent = `${a.hueIndex}/${ANCHOR_HUE_COUNT}`;
    if (rCnt) rCnt.textContent = a.registerIndex === null ? `–/${ANCHOR_REGISTER_COUNT}` : `${a.registerIndex + 1}/${ANCHOR_REGISTER_COUNT}`;
  }

  function reason() {
    if (typeof activeShowFaces !== 'function' || !activeShowFaces()) return T['reason.fill.off'];
    return (typeof faceFillsUnavailableReason === 'function' && faceFillsUnavailableReason()) || null;
  }

  // ---- rules: a radiogroup driving the hidden <select> ----------------------------------------------------------
  const ruleGroup = UI.radiogroup($('.nav-rules'), function (btn) {
    ruleSelect.value = btn.dataset.rule;
    ruleSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // ---- sync (on every redraw) ------------------------------------------------------------------------------------
  function sync() {
    if (typeof updateFaceColorsPanel === 'function') updateFaceColorsPanel(); // this frame's rule/axis DOM, not stale
    syncAnchor();
    const why = reason();
    ruleBtns.forEach(function (b) { UI.setDisabled(b, why); });
    UI.setDisabled(moreBtn, why);
    if (row.classList.contains('row-disabled') !== !!why) row.classList.toggle('row-disabled', !!why);
    if (why && panel && !panel.hidden) { const ov = row.__overlay; if (ov) ov.close(false); }
    ruleGroup.set(ruleSelect.value ? ruleBtns.find(function (b) { return b.dataset.rule === ruleSelect.value; }) : null);

    const dotOn = why === T['reason.fill.off'] && window.uiNav && uiNav.current() === 'farbe';
    if (fillBtn && fillBtn.classList.contains('needs-attn') !== dotOn) fillBtn.classList.toggle('needs-attn', dotOn);
  }

  const overlay = UI.overlay(moreBtn, panel, { onOpen: sync });
  row.__overlay = overlay; // so sync() can close it when the row becomes disabled while it is open
  document.addEventListener('tabchange', sync); // the fill-button dot depends on which tab is current

  UI.onSync(sync);
})();
