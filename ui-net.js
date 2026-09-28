/*
 * The Netz nav row (UI rework 4c): Aus | Sin | Tan | Geo, the strength stepper, and the "Mehr" overlay. It wires
 * markup that already exists in index.html to the EXISTING net logic in sketch.js (initNetControls()) - the net
 * controls are moved, not duplicated:
 *
 *   kinds      the .net-kind-btn buttons (Aus = the regular net). sketch.js's handlers run as before and keep the
 *              'active' class; aria-checked follows it. When a net is switched on from Aus, sketch.js applies the
 *              defaults (both axes, Field) and, for Sin/Tan, at least 4 nodes - and says so (a toast).
 *   strength   a stepper around the existing range input #net-strength-input, which still carries the value in
 *              percent exactly as the slider did (strength = value / 100); #net-strength-value is the display
 *              (sketch.js writes it: 0.5, or x3.2 for Geo). 0.1 per tap, hold to repeat, arrow keys on the display.
 *              A value off the 0.1 grid (0.86) is shown as it is with two decimals and is NEVER rounded on load; the
 *              next tap goes to the next grid value in that direction (0.9 up, 0.8 down).
 *   More       the whole existing #net-group (X/Y, Single/Tiled/Field, Macro, Focus, Net lines, Reverse/Alternate)
 *              plus exact two-decimal fields for strength and focus, in a popover (bottom sheet on the phone).
 *
 * The net applies to the SQUARE on the BASE sheet only. Everywhere else the whole row stays visible and is
 * aria-disabled with the reason (a tap shows it); it is never hidden. Aus disables the strength (it has no effect
 * then); strength 0 is NOT off - the stepper stays enabled there.
 *
 * The German texts below are the reasons for now; the dictionary (data-i18n keys) comes in a later phase.
 */
(function () {
  const T = {
    'reason.net.notApplicable': 'Netz gilt für das Quadrat, Basis-Ebene.',
    'reason.net.needsKind': 'Die Stärke gilt für Sin, Tan und Geo.',
    'reason.strength.max': 'Größte Stärke: 1,0.',
    'reason.strength.min': 'Kleinste Stärke: 0,0.',
    'reason.strength.exact': 'Die Stärke liegt zwischen 0,00 und 1,00.',
    'reason.focus.max': 'Größter Fokus: 1,0.',
    'reason.focus.min': 'Kleinster Fokus: −1,0.',
    'reason.focus.exact': 'Der Fokus liegt zwischen −1,00 und 1,00.',
  };
  const $ = function (s) { return document.querySelector(s); };

  const row = $('#nav-netz'), panel = $('#more-netz'), moreBtn = $('#btn-more-netz');
  const kindBtns = Array.prototype.slice.call(row.querySelectorAll('.net-kind-btn'));
  const strengthRoot = row.querySelector('.stepper');
  const strengthInput = $('#net-strength-input'), strengthDisplay = $('#net-strength-value');
  const focusRoot = panel.querySelector('#net-focus-row .stepper');
  const focusInput = $('#net-focus-input'), focusDisplay = $('#net-focus-value');
  const strengthExact = $('#net-strength-exact'), focusExact = $('#net-focus-exact');

  function applies() { return currentShape === 'square' && activeLayer === 'base'; }
  function kind() {
    const b = kindBtns.find(function (x) { return x.classList.contains('active'); });
    return b ? b.dataset.kind : 'regular';
  }
  function reasonAll() { return applies() ? null : T['reason.net.notApplicable']; }
  function reasonStrength() { return reasonAll() || (kind() === 'regular' ? T['reason.net.needsKind'] : null); }

  // ---- kinds: a radiogroup whose state sketch.js owns ------------------------------------------------------------
  kindBtns.forEach(function (b) { UI.checkedFromActive(b); });

  // A disabled kind must not reach sketch.js's p5 handler (a 'mousedown' listener): stop it on the way down.
  row.addEventListener('mousedown', function (e) {
    const b = e.target.closest && e.target.closest('.net-kind-btn[aria-disabled="true"]');
    if (b) e.stopPropagation();
  }, true);
  row.addEventListener('click', function (e) {
    const b = e.target.closest && e.target.closest('.net-kind-btn[aria-disabled="true"]');
    if (b) UI.showReason(b);
  });
  // Arrow keys move AND choose, like native radios (the choice itself is sketch.js's p5 handler: a 'mousedown').
  kindBtns.forEach(function (b, i) {
    b.addEventListener('keydown', function (e) {
      let j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % kindBtns.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + kindBtns.length) % kindBtns.length;
      if (j < 0) return;
      e.preventDefault();
      if (!applies()) return;
      kindBtns[j].focus();
      kindBtns[j].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    });
  });

  // ---- steppers on the percent range inputs ---------------------------------------------------------------------
  // p = the value in percent (strength 0..100, focus -100..100). One tap = the next multiple of 10 in that direction,
  // so a value off the grid (86) goes to 90 up and 80 down; the stored value is only changed by a tap.
  function gridStep(p, dir, lo, hi) {
    if (dir > 0) return p >= hi ? null : Math.min(hi, (Math.floor(p / 10) + 1) * 10);
    return p <= lo ? null : Math.max(lo, (Math.ceil(p / 10) - 1) * 10);
  }
  function strengthCompute(dir) {
    const why = reasonStrength();
    if (why) return { to: null, reason: why };
    const to = gridStep(parseInt(strengthInput.value, 10) || 0, dir, 0, 100);
    return to === null ? { to: null, reason: T[dir > 0 ? 'reason.strength.max' : 'reason.strength.min'] } : { to: to };
  }
  function focusCompute(dir) {
    const why = reasonAll();
    if (why) return { to: null, reason: why };
    const to = gridStep(parseInt(focusInput.value, 10) || 0, dir, -100, 100);
    return to === null ? { to: null, reason: T[dir > 0 ? 'reason.focus.max' : 'reason.focus.min'] } : { to: to };
  }
  const strengthStepper = UI.stepper(strengthRoot, { input: strengthInput, compute: strengthCompute, noTyping: true, keyEl: strengthDisplay });
  const focusStepper = UI.stepper(focusRoot, { input: focusInput, compute: focusCompute, noTyping: true, keyEl: focusDisplay });

  // ---- exact two-decimal fields (under More) ---------------------------------------------------------------------
  // The carrier holds whole percent, so two decimals are exact. A value outside the range is clamped with a toast;
  // anything that is not a number restores the current value.
  function bindExact(field, carrier, lo, hi, msg, reasonFn) {
    field.addEventListener('change', function () {
      const why = reasonFn();
      let v = parseFloat(String(field.value).replace(',', '.'));
      if (why || isNaN(v)) { show(); if (why) UI.toast(why, 4000); return; }
      if (v < lo || v > hi) { v = v < lo ? lo : hi; UI.toast(msg, 4000); }
      carrier.value = String(Math.round(v * 100));
      carrier.dispatchEvent(new Event('input', { bubbles: true }));
      carrier.dispatchEvent(new Event('change', { bubbles: true }));
      show();
    });
    function show() { field.value = ((parseInt(carrier.value, 10) || 0) / 100).toFixed(2); }
    return show;
  }
  const showStrengthExact = bindExact(strengthExact, strengthInput, 0, 1, T['reason.strength.exact'], reasonStrength);
  const showFocusExact = bindExact(focusExact, focusInput, -1, 1, T['reason.focus.exact'], reasonAll);

  function setLocked(field, why) {
    if (field.readOnly !== !!why) field.readOnly = !!why;
    UI.setDisabled(field, why);
  }

  // ---- the More overlay -------------------------------------------------------------------------------------------
  const overlay = UI.overlay(moreBtn, panel, { onOpen: sync });

  // ---- sync (on every redraw) ------------------------------------------------------------------------------------
  function sync() {
    const all = reasonAll();
    kindBtns.forEach(function (b) { UI.setDisabled(b, all); });
    UI.setDisabled(moreBtn, all);
    if (all && overlay.isOpen) overlay.close(false);
    strengthStepper.refresh();
    focusStepper.refresh();
    // spinbutton values for assistive technology
    const sp = (parseInt(strengthInput.value, 10) || 0) / 100, fp = (parseInt(focusInput.value, 10) || 0) / 100;
    strengthDisplay.setAttribute('aria-valuenow', String(sp));
    strengthDisplay.setAttribute('aria-valuetext', strengthDisplay.textContent);
    focusDisplay.setAttribute('aria-valuenow', String(fp));
    focusDisplay.setAttribute('aria-valuetext', focusDisplay.textContent);
    // exact fields follow the state unless being typed in
    if (document.activeElement !== strengthExact) showStrengthExact();
    if (document.activeElement !== focusExact) showFocusExact();
    setLocked(strengthExact, reasonStrength());
    setLocked(focusExact, all);
  }
  UI.onSync(sync);
})();
