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
