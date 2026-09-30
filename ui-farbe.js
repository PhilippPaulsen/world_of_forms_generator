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
  // Group D Phase B4 follow-up: the rule buttons/axes moved from #nav-farbe into #more-farbe (a position
  // change, see index.html's own comment there) - queried from panel now, not row.
  const ruleSelect = $('#face-colors-rule'), ruleBtns = Array.prototype.slice.call(panel.querySelectorAll('.fc-rule-btn'));
  const fillBtn = $('#btn-toggle-faces');

  // ---- anchor steppers (Group D Phase B4 follow-up): real .stepper widgets (UI.stepper()) - the SAME
  // markup/CSS Form's node-count/shape-size steppers use, no text label (the pattern's own fill colors
  // already show the result, per the person's own reasoning). Hue mirrors node-count-input exactly (a
  // real number input, `readonly` since typing was never part of this control's contract - only
  // ArrowUp/Down and the chevrons step it, same as before; readonly keeps the exact visual structure
  // while preventing an unclamped typed value). Register mirrors the net-strength stepper's own pattern
  // (a .stepper-display text span backed by a hidden range input), since its value is a letter-pair code
  // (FARBORGEL_REGISTER_ORDER, core/farborgel-bridge.js), not a plain number.
  const ANCHOR_HUE_COUNT = 24, ANCHOR_REGISTER_COUNT = 28;
  const hueStepperRoot = $('#farbe-anchor-hue-stepper'), hueInput = $('#farbe-anchor-hue-input');
  const registerStepperRoot = $('#farbe-anchor-register-stepper'), registerInput = $('#farbe-anchor-register-input'), registerDisplay = $('#farbe-anchor-register-display');
  let hueStepperApi = null, registerStepperApi = null;
  if (hueStepperRoot && hueInput && registerStepperRoot && registerInput && registerDisplay && typeof anchorFor === 'function' && typeof UI !== 'undefined' && UI.stepper) {
    hueInput.readOnly = true;
    hueStepperApi = UI.stepper(hueStepperRoot, {
      input: hueInput,
      noTyping: true,
      compute: function (dir) {
        const cur = parseInt(hueInput.value, 10) || 1;
        return { to: ((cur - 1 + dir + ANCHOR_HUE_COUNT) % ANCHOR_HUE_COUNT) + 1 }; // a hue RING: always wraps, never blocked
      }
    });
    hueInput.addEventListener('change', function () {
      const a = anchorFor(activeLayer);
      if (!a) return;
      const v = parseInt(hueInput.value, 10);
      if (!isNaN(v)) a.hueIndex = v;
      sync();
    });

    registerStepperApi = UI.stepper(registerStepperRoot, {
      input: registerInput,
      noTyping: true,
      keyEl: registerDisplay, // the hidden range input itself is never focused - the visible text is
      compute: function (dir) {
        const cur = parseInt(registerInput.value, 10) || 0;
        return { to: (cur + dir + ANCHOR_REGISTER_COUNT) % ANCHOR_REGISTER_COUNT };
      }
    });
    registerInput.addEventListener('change', function () {
      const a = anchorFor(activeLayer);
      if (!a) return;
      const v = parseInt(registerInput.value, 10);
      if (!isNaN(v)) a.registerIndex = v;
      sync();
    });
  }
  // Reads the active sheet's own anchor into the two steppers - called from sync() below, same cadence as
  // before. Writes hueInput.value/registerInput.value directly (not through UI.stepper()'s own setValue(),
  // which dispatches input/change and would re-trigger the listeners above pointlessly) and refreshes the
  // register's own text display plus both steppers' chevron disabled-state (their compute() never blocks,
  // so refresh() here is mostly about keeping them in sync after an EXTERNAL anchor change - Kreis/Dreieck/
  // Register, a sheet switch - not something typed into these fields themselves).
  function syncAnchor() {
    if (!hueInput || typeof anchorFor !== 'function') return;
    const a = anchorFor(activeLayer);
    if (!a) return; // no active sheet's anchor to show - sync() below's own eligibility check already guards this
    if (parseInt(hueInput.value, 10) !== a.hueIndex) hueInput.value = String(a.hueIndex);
    if (a.registerIndex !== null && parseInt(registerInput.value, 10) !== a.registerIndex) registerInput.value = String(a.registerIndex);
    // Register shows the real atlas code (e.g. "pa"), not the 0-based index - FARBORGEL_REGISTER_ORDER
    // (core/farborgel-bridge.js, built in B2) is the same array the register widgets already index into;
    // registerIndex itself is untouched, this only changes the label. Hue stays numeric (1-24).
    registerDisplay.textContent = a.registerIndex === null ? '–'
      : (typeof FARBORGEL_REGISTER_ORDER !== 'undefined' ? FARBORGEL_REGISTER_ORDER[a.registerIndex] : String(a.registerIndex));
    if (hueStepperApi) hueStepperApi.refresh();
    if (registerStepperApi) registerStepperApi.refresh();
  }

  // ---- anchor preview (Phase B4 follow-up): a plain color swatch of the anchor itself - independent of
  // any harmony type, pure display, reusing .fc-swatch's existing look from the old rule panel. Resolved
  // via Farborgel's OWN calibrated display pipeline (window.farborgelAnchorDisplayColor(),
  // core/farborgel-selection.mjs -> color-harmony/ui/DisplayCalibration.mjs's historicalToDisplay()) - the
  // SAME Oklab-mixed, gamut-mapped color applyHarmonyToPattern() now actually paints with (Phase B4
  // follow-up #2), not core/color.js's older resolveColor() - a preview using that system would show a
  // muted color the pattern itself no longer produces once a harmony using this anchor is applied.
  const anchorPreviewEls = [$('#farbe-anchor-preview'), $('#farbe-anchor-preview-kreis'), $('#farbe-anchor-preview-dreieck'), $('#farbe-anchor-preview-register')].filter(Boolean);
  function syncAnchorPreview() {
    if (!anchorPreviewEls.length) return;
    const a = anchorFor(activeLayer);
    let bg = 'transparent';
    if (a && typeof window.farborgelAnchorDisplayColor === 'function') {
      try {
        const rgb = window.farborgelAnchorDisplayColor(a);
        bg = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
      } catch (e) { bg = 'transparent'; } // e.g. registerIndex null (Wert's hue-only state, Phase B4+): nothing real to preview yet
    }
    anchorPreviewEls.forEach(function (el) { if (el.style.background !== bg) el.style.background = bg; });
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

  // Group D Phase B4: each widget now lives in its OWN overlay (#overlay-kreis/-dreieck/-register, opened
  // by its own #nav-farbe row-2 button) instead of sharing one view-mode-switched section - see index.html's
  // own comment on that row. anchorHueContext is now two elements (Dreieck's and Register's own overlays
  // each show it, since both depend on the current hue) instead of one shared label.
  const anchorKreisSvg = $('#farbe-anchor-kreis'), anchorDreieckSvg = $('#farbe-anchor-dreieck'), anchorRegisterList = $('#farbe-anchor-register-list');
  const anchorHueContextDreieck = $('#farbe-anchor-hue-context-dreieck'), anchorHueContextRegister = $('#farbe-anchor-hue-context-register');
  const kreisTrigger = $('#btn-open-kreis'), dreieckTrigger = $('#btn-open-dreieck'), registerTrigger = $('#btn-open-register');
  const kreisPanel = $('#overlay-kreis'), dreieckPanel = $('#overlay-dreieck'), registerPanel = $('#overlay-register');
  let anchorKreisGroup = null, anchorDreieckGroup = null, anchorRegisterGroup = null;
  let kreisOverlay = null, dreieckOverlay = null, registerOverlay = null;

  if (anchorKreisSvg && anchorDreieckSvg && anchorRegisterList && kreisTrigger && dreieckTrigger && registerTrigger &&
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

    // Each trigger opens its own overlay (UI.overlay(), the same pattern #more-form/#more-netz/#more-farbe
    // already use - focus/Escape/click-outside all come free). onOpen: sync() so the widget reflects this
    // frame's anchor even if nothing else has redrawn since the panel was last open.
    kreisOverlay = UI.overlay(kreisTrigger, kreisPanel, { onOpen: sync });
    dreieckOverlay = UI.overlay(dreieckTrigger, dreieckPanel, { onOpen: sync });
    registerOverlay = UI.overlay(registerTrigger, registerPanel, { onOpen: sync });
  }

  // Refreshes which point/row is marked active in each of the three widgets, plus the hue-context hints -
  // called from sync() below, same cadence as syncAnchor(). A selection inside a widget does NOT close its
  // overlay (matching #more-farbe's own rule-selection precedent and #more-form's symmetry-selection
  // precedent - see index.html's comment on the three overlays); only Escape/outside-click/the trigger
  // again, or the row becoming disabled (sync() below), closes them.
  function syncAnchorWidgets() {
    if (!anchorKreisGroup) return;
    const a = anchorFor(activeLayer);

    anchorHueContextDreieck.textContent = a ? 'für Farbton ' + a.hueIndex + '/24' : '';
    anchorHueContextRegister.textContent = anchorHueContextDreieck.textContent;

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

  // ---- harmony rail + dropdown (Group D Phase B4): the first real consumer of the anchor - calls the
  // REAL Farborgel engine (core/farborgel-selection.mjs's buildHarmonySelection(), which calls the real,
  // unmodified reduceComposition()/createHarmonySelection()) and writes the result through Phase A's
  // applyHarmonyToPattern(), using the SAME store/trails resolution renderFaceColorsPanel() already uses
  // (faceColorsGrid() -> sheetGroupElements() -> computeFaceTrails() -> faceAssignmentsFor()). One
  // function, two trigger kinds (7 buttons, 1 dropdown) - no duplicated logic.
  const harmonyBtns = { 2: $('#btn-harmony-2'), 3: $('#btn-harmony-3'), 4: $('#btn-harmony-4'), B: $('#btn-harmony-b'), W: $('#btn-harmony-w'), S: $('#btn-harmony-s'), V: $('#btn-harmony-v') };
  const harmonySelect = $('#farbe-harmony-select');
  const resetBtn = $('#btn-face-colors-reset');
  function applyHarmony(type) {
    if (typeof window.farborgelBuildHarmonySelection !== 'function') return; // the module script hasn't finished loading yet (rare)
    const a = anchorFor(activeLayer);
    if (!a) return;
    const { gridNodes, conns, sheet } = faceColorsGrid();
    const group = sheetGroupElements(gridNodes, sheet);
    if (!group) return;
    const trails = computeFaceTrails(computeCellFaces(conns, gridNodes, null, null, sheet), group);
    if (!trails.length) return;
    let selection;
    try { selection = window.farborgelBuildHarmonySelection(a, type); }
    catch (e) { UI.toast('Farborgel: ' + e.message); return; }
    applyHarmonyToPattern(selection, faceAssignmentsFor(activeLayer), trails);
    renderFaceColorsPanel();
    redraw();
  }
  Object.keys(harmonyBtns).forEach(function (type) {
    const b = harmonyBtns[type];
    if (b) UI.guard(b, function () { applyHarmony(type); });
  });
  if (harmonySelect) {
    harmonySelect.addEventListener('change', function () {
      if (!harmonySelect.value) return;
      applyHarmony(harmonySelect.value);
      harmonySelect.value = ''; // back to the placeholder - this is an action trigger, not a persistent choice
    });
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
    syncAnchorPreview();
    syncAnchorWidgets();
    const why = reason();
    ruleBtns.forEach(function (b) { UI.setDisabled(b, why); });
    UI.setDisabled(moreBtn, why);
    [kreisTrigger, dreieckTrigger, registerTrigger].forEach(function (b) { if (b) UI.setDisabled(b, why); });
    Object.keys(harmonyBtns).forEach(function (type) { if (harmonyBtns[type]) UI.setDisabled(harmonyBtns[type], why); });
    [hueStepperRoot, registerStepperRoot].forEach(function (root) {
      if (root) root.querySelectorAll('.stepper-btn').forEach(function (b) { UI.setDisabled(b, why); });
    });
    if (harmonySelect) harmonySelect.disabled = !!why;
    // Reset Color keeps sketch.js's own, untouched click handler (a DOM relocation, not new logic) - this
    // only dims it to match the row's eligibility; a click while "disabled" still runs resetFaceColors(),
    // which is a harmless no-op on an already-empty/default store. Not gated with UI.guard() like the 7
    // harmony buttons above, to avoid a second listener next to sketch.js's real one.
    if (resetBtn) UI.setDisabled(resetBtn, why);
    // row-disabled dims #face-colors-axes (style.css) - toggled on panel now, not row, since axes moved
    // into #more-farbe (the buttons themselves are already individually disabled via ruleBtns above; axes
    // has no per-control disabling of its own, hence the container-level class).
    if (panel.classList.contains('row-disabled') !== !!why) panel.classList.toggle('row-disabled', !!why);
    if (why) {
      [row.__overlay, kreisOverlay, dreieckOverlay, registerOverlay].forEach(function (ov) { if (ov && ov.isOpen) ov.close(false); });
    }
    ruleGroup.set(ruleSelect.value ? ruleBtns.find(function (b) { return b.dataset.rule === ruleSelect.value; }) : null);

    const dotOn = why === T['reason.fill.off'] && window.uiNav && uiNav.current() === 'farbe';
    if (fillBtn && fillBtn.classList.contains('needs-attn') !== dotOn) fillBtn.classList.toggle('needs-attn', dotOn);
  }

  const overlay = UI.overlay(moreBtn, panel, { onOpen: sync });
  row.__overlay = overlay; // so sync() can close it when the row becomes disabled while it is open
  document.addEventListener('tabchange', sync); // the fill-button dot depends on which tab is current

  UI.onSync(sync);
})();
