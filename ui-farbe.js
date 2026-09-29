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

  // ---- anchor widgets (Group D Phase B3): a visual/text alternative to the two numeric steppers above,
  // over the SAME anchor state - never a second source of truth. Kreis: a 24-point hue ring (hueRingPoints(),
  // core/farborgel-bridge.js - now loaded in the browser for the first time, this widget's real consumer).
  // Dreieck: the real 28-register triangle (registerTrianglePoints(), same file) FOR THE CURRENT HUE.
  // Register: the same 28 registers (FARBORGEL_REGISTER_ORDER) as a per-hue text list - a design choice
  // made this phase (not the full 24x28/672-cell atlas Farborgel's own standalone tool shows, since Kreis
  // already owns hue selection here - see the Phase B3 report). Switching view mode never touches the
  // anchor, only which of the three containers is visible (anchorViewMode is UI-only state).
  //
  // Both SVG widgets reuse color-harmony/ui/components/dom.mjs's activateSVG() pattern (role="button"/here
  // "radio", a hit-target circle bigger than the visible face, Enter/Space -> click, an appended <title> for
  // native SVG accessibility) - reimplemented locally, not imported (per the Phase B3 design: no ESM import).
  // Keyboard arrow-navigation is UI.radiogroup() itself, reused verbatim on the SVG <g> elements exactly as
  // it already is on plain <button>s elsewhere in this file - it only touches attributes/classes/tabIndex,
  // which work identically on any DOM element, SVG included.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  // hitR: a bigger transparent circle, easier to hit/tap than the visible face - same "hit target larger
  // than the visible control" idea as this project's existing swatch rows, just circular instead of a row.
  function anchorPoint(cx, cy, label, hitR, faceR) {
    const g = svgEl('g', { class: 'anchor-point', role: 'radio', 'aria-checked': 'false', tabindex: '-1' });
    g.appendChild(svgEl('circle', { class: 'anchor-point-hit', cx: cx, cy: cy, r: hitR }));
    g.appendChild(svgEl('circle', { class: 'anchor-point-face', cx: cx, cy: cy, r: faceR }));
    if (label !== null) {
      const t = svgEl('text', { x: cx, y: cy });
      t.textContent = label;
      g.appendChild(t);
    }
    // UI.radiogroup() below attaches its own 'click' listener per radio (native semantics for a <button>,
    // but a plain SVG <g> fires no click on Enter/Space by itself) - bridge that gap by dispatching a real
    // click, which radiogroup's listener then handles exactly like a pointer click.
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    });
    return g;
  }

  const anchorKreisSvg = $('#farbe-anchor-kreis'), anchorDreieckSvg = $('#farbe-anchor-dreieck'), anchorRegisterList = $('#farbe-anchor-register-list');
  const anchorViewModeRow = $('#farbe-anchor-view-mode'), anchorHueContext = $('#farbe-anchor-hue-context');
  const anchorViewBtns = { kreis: $('#btn-anchor-view-kreis'), dreieck: $('#btn-anchor-view-dreieck'), register: $('#btn-anchor-view-register') };
  let anchorViewMode = 'kreis'; // UI-only: which of the three is showing, never part of the anchor itself
  let anchorKreisGroup = null, anchorDreieckGroup = null, anchorRegisterGroup = null, anchorViewModeGroup = null;

  if (anchorKreisSvg && anchorDreieckSvg && anchorRegisterList && anchorViewModeRow &&
      typeof anchorFor === 'function' && typeof hueRingPoints === 'function' && typeof registerTrianglePoints === 'function' && typeof FARBORGEL_REGISTER_ORDER !== 'undefined') {
    // Kreis: built once - the ring's geometry never changes, only which point ends up marked active.
    hueRingPoints(120, 120, 95).forEach(function (p) {
      const g = anchorPoint(p.x, p.y, String(p.hueIndex), 15, 11);
      g.dataset.hueIndex = String(p.hueIndex);
      const title = svgEl('title'); title.textContent = 'Farbton ' + p.hueIndex; g.appendChild(title);
      anchorKreisSvg.appendChild(g);
    });
    anchorKreisGroup = UI.radiogroup(anchorKreisSvg, function (r) {
      const a = anchorFor(activeLayer);
      if (!a) return;
      a.hueIndex = parseInt(r.dataset.hueIndex, 10);
      sync();
    });

    // Dreieck: also built once (the triangle's 28 positions are fixed; only the active slot and what hue
    // it currently represents change - the latter is shown via anchorHueContext, not a rebuild).
    registerTrianglePoints(120, 24, 32, 26).forEach(function (p) {
      const g = anchorPoint(p.x, p.y, null, 15, 11);
      g.dataset.registerIndex = String(p.registerIndex);
      const title = svgEl('title'); title.textContent = 'Register ' + p.label + ' (' + (p.registerIndex + 1) + '/28)'; g.appendChild(title);
      anchorDreieckSvg.appendChild(g);
    });
    anchorDreieckGroup = UI.radiogroup(anchorDreieckSvg, function (r) {
      const a = anchorFor(activeLayer);
      if (!a || a.registerIndex === null) return; // hue-only state (Wert, Phase B4): no register axis to set
      a.registerIndex = parseInt(r.dataset.registerIndex, 10);
      sync();
    });

    // Register: the SAME 28 registers as Dreieck, as plain <button> rows (native Enter/Space, no bridge needed).
    FARBORGEL_REGISTER_ORDER.forEach(function (label, registerIndex) {
      const rowEl = document.createElement('button');
      rowEl.type = 'button'; rowEl.className = 'anchor-register-row';
      rowEl.setAttribute('role', 'radio'); rowEl.setAttribute('aria-checked', 'false'); rowEl.tabIndex = -1;
      rowEl.dataset.registerIndex = String(registerIndex);
      const num = document.createElement('span'); num.textContent = (registerIndex + 1) + '/28';
      const lab = document.createElement('span'); lab.textContent = label;
      rowEl.appendChild(num); rowEl.appendChild(lab);
      anchorRegisterList.appendChild(rowEl);
    });
    anchorRegisterGroup = UI.radiogroup(anchorRegisterList, function (r) {
      const a = anchorFor(activeLayer);
      if (!a || a.registerIndex === null) return;
      a.registerIndex = parseInt(r.dataset.registerIndex, 10);
      sync();
    });

    // View-mode picker: a UI-only choice (anchorViewMode) - never writes to the anchor itself.
    anchorViewModeGroup = UI.radiogroup(anchorViewModeRow, function (r) {
      anchorViewMode = r === anchorViewBtns.dreieck ? 'dreieck' : r === anchorViewBtns.register ? 'register' : 'kreis';
      syncAnchorWidgets();
    });
    anchorViewModeGroup.set(anchorViewBtns.kreis); // Kreis is the default view on first render
  }

  // Refreshes which point/row is marked active in whichever view is showing, plus the view-mode picker
  // itself and the hue-context hint - called from sync() below, same cadence as syncAnchor(). Switching
  // anchorViewMode never mutates anchorFor(activeLayer); this function only ever READS it.
  function syncAnchorWidgets() {
    if (!anchorKreisGroup) return;
    const a = anchorFor(activeLayer);

    // toggleAttribute(), not the .hidden property: SVGSVGElement doesn't reflect .hidden the way
    // HTMLElement does (an assignment to it silently no-ops in at least some browsers), so
    // anchorKreisSvg/anchorDreieckSvg would otherwise get stuck showing - found by real browser testing.
    anchorKreisSvg.toggleAttribute('hidden', anchorViewMode !== 'kreis');
    anchorDreieckSvg.toggleAttribute('hidden', anchorViewMode !== 'dreieck');
    anchorRegisterList.toggleAttribute('hidden', anchorViewMode !== 'register');
    anchorHueContext.toggleAttribute('hidden', anchorViewMode === 'kreis' || !a);
    if (a && anchorViewMode !== 'kreis') anchorHueContext.textContent = 'für Farbton ' + a.hueIndex + '/24';

    anchorViewModeGroup.set(anchorViewMode === 'dreieck' ? anchorViewBtns.dreieck : anchorViewMode === 'register' ? anchorViewBtns.register : anchorViewBtns.kreis);

    if (!a) { anchorKreisGroup.set(null); anchorDreieckGroup.set(null); anchorRegisterGroup.set(null); return; }

    const kreisPoints = Array.prototype.slice.call(anchorKreisSvg.querySelectorAll('[role="radio"]'));
    anchorKreisGroup.set(kreisPoints.find(function (g) { return parseInt(g.dataset.hueIndex, 10) === a.hueIndex; }) || null);

    const dreieckPoints = Array.prototype.slice.call(anchorDreieckSvg.querySelectorAll('[role="radio"]'));
    const registerRows = Array.prototype.slice.call(anchorRegisterList.querySelectorAll('[role="radio"]'));
    if (a.registerIndex === null) { anchorDreieckGroup.set(null); anchorRegisterGroup.set(null); }
    else {
      anchorDreieckGroup.set(dreieckPoints.find(function (g) { return parseInt(g.dataset.registerIndex, 10) === a.registerIndex; }) || null);
      anchorRegisterGroup.set(registerRows.find(function (r) { return parseInt(r.dataset.registerIndex, 10) === a.registerIndex; }) || null);
    }
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
    syncAnchorWidgets();
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
