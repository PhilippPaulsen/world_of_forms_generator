/*
 * The Farbe nav row: the Farborgel anchor (Kreis/Dreieck/steppers), the 7 harmony triggers, and the "Mehr"
 * overlay (now just the cross-layer note - Group D Phase B4 follow-up removed the old rule-engine row and
 * the Register button/overlay entirely, not just hidden them; see index.html's own comments on #nav-farbe/
 * #more-farbe for what changed and why).
 *
 *   anchor     Kreis (hue ring)/Dreieck (register triangle) overlays + the hue/register steppers, all over the
 *              SAME anchorFor(sheet) state (core/facecolor.js) - never a second source of truth.
 *   harmony    7 buttons (2/3/4/B/W/S/V) + a hidden fallback dropdown, all calling applyHarmony() (below), the
 *              one real consumer of the anchor - the REAL Farborgel engine end to end (core/farborgel-selection.mjs).
 *              The last-applied type is remembered per sheet (lastHarmonyTypeFor(), core/facecolor.js): an
 *              anchor change reapplies it live (afterAnchorChange(), below), and its button stays marked
 *              active (syncHarmonyActive(), below) until Reset Color or the old rule system take over.
 *
 * Eligibility: this row applies to the base sheet and eligible layers, exactly as sketch.js already decides
 * (faceFillsUnavailableReason()) - PLUS a row-level condition of its own: face fill itself must be on
 * (activeShowFaces()), since switching to the Farbe tab must never switch it on. Either way the whole row stays
 * visible and aria-disabled with the reason; never hidden. Fill being off additionally puts a small dot on the
 * old toolbar's fill button (#btn-toggle-faces) while the Farbe tab is open, pointing at the fix.
 *
 * updateFaceColorsPanel() (sketch.js) still rebuilds the STILL-VISIBLE per-trail list (#face-colors-list)
 * while its panel is VISIBLE (activeShowFaces()); it is called again at the top of sync() below so this row
 * always reads this frame's state, not stale DOM from whenever the panel was last shown.
 *
 * The German texts below are the reasons for now; the dictionary (data-i18n keys) comes in a later phase.
 */
(function () {
  const T = { 'reason.fill.off': 'Fläche füllen einschalten' };
  const $ = function (s) { return document.querySelector(s); };

  const row = $('#nav-farbe'), panel = $('#more-farbe'), moreBtn = $('#btn-more-farbe');
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
      afterAnchorChange();
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
      afterAnchorChange();
    });
  }

  // ---- distribution strategy stepper (Phase B-Farbstrategien step 2): which harmony member
  // each trail gets - same .stepper-display pattern as the register stepper above (a short
  // text label, not a number), cycling core/farborgel-bridge.js's own DISTRIBUTION_STRATEGIES
  // in order. Persisted per sheet (distributionStrategyFor()/setDistributionStrategyFor(),
  // core/facecolor.js) - lazy, reset with the grid, same lifecycle as lastHarmonyTypeFor().
  // Changing it goes through afterAnchorChange() - the SAME live-reapply path an anchor change
  // already uses, not a second trigger - so it only recolors when a harmony is already in
  // effect (lastHarmonyTypeFor() non-null), exactly matching every other control in this row.
  const STRATEGY_LABELS = { cyclic: 'Zyklisch', area: 'Fläche', symmetry: 'Symmetrie', rings: 'Ringe' };
  const strategyStepperRoot = $('#farbe-strategy-stepper'), strategyInput = $('#farbe-strategy-input'), strategyDisplay = $('#farbe-strategy-display');
  let strategyStepperApi = null;
  if (strategyStepperRoot && strategyInput && strategyDisplay && typeof DISTRIBUTION_STRATEGIES !== 'undefined' && typeof UI !== 'undefined' && UI.stepper) {
    strategyStepperApi = UI.stepper(strategyStepperRoot, {
      input: strategyInput,
      noTyping: true,
      keyEl: strategyDisplay,
      compute: function (dir) {
        const cur = parseInt(strategyInput.value, 10) || 0;
        return { to: (cur + dir + DISTRIBUTION_STRATEGIES.length) % DISTRIBUTION_STRATEGIES.length };
      }
    });
    strategyInput.addEventListener('change', function () {
      const idx = parseInt(strategyInput.value, 10) || 0;
      setDistributionStrategyFor(activeLayer, DISTRIBUTION_STRATEGIES[idx]);
      afterAnchorChange();
    });
  }
  function syncStrategy() {
    if (!strategyInput || typeof distributionStrategyFor !== 'function') return;
    const strategy = distributionStrategyFor(activeLayer) || 'cyclic';
    const idx = DISTRIBUTION_STRATEGIES.indexOf(strategy);
    if (idx >= 0 && parseInt(strategyInput.value, 10) !== idx) strategyInput.value = String(idx);
    strategyDisplay.textContent = STRATEGY_LABELS[strategy] || STRATEGY_LABELS.cyclic;
    if (strategyStepperApi) strategyStepperApi.refresh();
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
  const anchorPreviewEls = [$('#farbe-anchor-preview'), $('#farbe-anchor-preview-kreis'), $('#farbe-anchor-preview-dreieck')].filter(Boolean);
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

  // ---- anchor widgets (Group D Phase B3, Register removed in the B4 follow-up): a visual alternative to
  // the two numeric steppers above, over the SAME anchor state - never a second source of truth. Kreis: a
  // 24-point hue ring (hueRingPoints(), core/farborgel-bridge.js). Dreieck: the real 28-register triangle
  // (registerTrianglePoints(), same file) FOR THE CURRENT HUE. (Register - the same 28 registers as a
  // per-hue linear list - is gone: it duplicated what the register stepper above already provides inline.)
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

  // Group D Phase B4: each widget lives in its OWN overlay (#overlay-kreis/-dreieck, opened by its own
  // #nav-farbe row-2 button) instead of sharing one view-mode-switched section - see index.html's own
  // comment on that row.
  const anchorKreisSvg = $('#farbe-anchor-kreis'), anchorDreieckSvg = $('#farbe-anchor-dreieck');
  const anchorHueContextDreieck = $('#farbe-anchor-hue-context-dreieck');
  const kreisTrigger = $('#btn-open-kreis'), dreieckTrigger = $('#btn-open-dreieck');
  const kreisPanel = $('#overlay-kreis'), dreieckPanel = $('#overlay-dreieck');
  let anchorKreisGroup = null, anchorDreieckGroup = null;
  let kreisOverlay = null, dreieckOverlay = null;

  if (anchorKreisSvg && anchorDreieckSvg && kreisTrigger && dreieckTrigger &&
      typeof anchorFor === 'function' && typeof hueRingPoints === 'function' && typeof registerTrianglePoints === 'function') {
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
      afterAnchorChange();
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
      afterAnchorChange();
    });

    // Each trigger opens its own overlay (UI.overlay(), the same pattern #more-form/#more-netz/#more-farbe
    // already use - focus/Escape/click-outside all come free). onOpen: sync() so the widget reflects this
    // frame's anchor even if nothing else has redrawn since the panel was last open.
    kreisOverlay = UI.overlay(kreisTrigger, kreisPanel, { onOpen: sync });
    dreieckOverlay = UI.overlay(dreieckTrigger, dreieckPanel, { onOpen: sync });
  }

  // Refreshes which point is marked active in each of the two widgets, plus the hue-context hint - called
  // from sync() below, same cadence as syncAnchor(). A selection inside a widget does NOT close its overlay
  // (matching #more-form's symmetry-selection precedent - see index.html's comment on the two overlays);
  // only Escape/outside-click/the trigger again, or the row becoming disabled (sync() below), closes them.
  function syncAnchorWidgets() {
    if (!anchorKreisGroup) return;
    const a = anchorFor(activeLayer);

    anchorHueContextDreieck.textContent = a ? 'für Farbton ' + a.hueIndex + '/24' : '';

    if (!a) { anchorKreisGroup.set(null); anchorDreieckGroup.set(null); return; }

    const kreisPoints = Array.prototype.slice.call(anchorKreisSvg.querySelectorAll('[role="radio"]'));
    anchorKreisGroup.set(kreisPoints.find(function (g) { return parseInt(g.dataset.hueIndex, 10) === a.hueIndex; }) || null);

    const dreieckPoints = Array.prototype.slice.call(anchorDreieckSvg.querySelectorAll('[role="radio"]'));
    if (a.registerIndex === null) { anchorDreieckGroup.set(null); }
    else {
      anchorDreieckGroup.set(dreieckPoints.find(function (g) { return parseInt(g.dataset.registerIndex, 10) === a.registerIndex; }) || null);
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
    const facesResult = computeCellFaces(conns, gridNodes, null, null, sheet);
    const trails = computeFaceTrails(facesResult, group);
    if (!trails.length) return;
    let selection;
    try { selection = window.farborgelBuildHarmonySelection(a, type); }
    catch (e) { UI.toast('Farborgel: ' + e.message); return; }
    // Phase B-Farbstrategien step 2: the sheet's chosen distribution strategy (default
    // 'cyclic', today's original behavior) and its context - groupOpsCount for 'symmetry'
    // (core/farborgel-bridge.js's own bucket-ordering, see its comment); ringDistances for
    // 'rings' only, computed here (real geometry is only available at this call site, not
    // inside applyHarmonyToPattern() itself) and ONLY when that strategy is actually selected,
    // never paid for on the Cyclic/Area/Symmetry path.
    const strategy = (typeof distributionStrategyFor === 'function' && distributionStrategyFor(activeLayer)) || 'cyclic';
    const context = { groupOpsCount: group.ops.length };
    if (strategy === 'rings' && typeof computeTrailRingDistances === 'function') {
      context.ringDistances = computeTrailRingDistances(facesResult, group, trails);
    }
    applyHarmonyToPattern(selection, faceAssignmentsFor(activeLayer), trails, strategy, context);
    // Group D Phase B4 follow-up: remember this as the sheet's last-applied type (only on a real
    // success - a thrown selection above never reaches here) - the ONE place this is recorded, so a
    // direct button/dropdown click and an anchor-triggered reapply (below) are always in exact sync,
    // never two separately-maintained states.
    setLastHarmonyTypeFor(activeLayer, type);
    renderFaceColorsPanel();
    redraw();
  }
  // Group D Phase B4 follow-up: shared by every anchor-change site (Kreis/Dreieck/Register, the two
  // steppers) - if this sheet already has a last-applied harmony type, changing the anchor re-paints
  // the pattern with it immediately (matching the old rule engine's always-live feel,
  // applyFaceColorsPalette() on every axis step); otherwise (nothing applied yet) it's the same as
  // before - just refresh the UI (steppers/widgets/preview), no coloring happens on its own.
  function afterAnchorChange() {
    const type = lastHarmonyTypeFor(activeLayer);
    if (type !== null && type !== undefined) applyHarmony(type);
    sync();
  }
  Object.keys(harmonyBtns).forEach(function (type) {
    const b = harmonyBtns[type];
    if (!b) return;
    UI.guard(b, function () { applyHarmony(type); });
    // Group D Phase B4 follow-up: a plain one-shot action button has no built-in "pressed" state (unlike a
    // role="radio" choice) - UI.pressed() keeps aria-pressed in sync with the .active class syncHarmonyActive()
    // below toggles, the same helper .layer-btn's own active-invert buttons would use for a real toggle.
    UI.pressed(b);
  });
  if (harmonySelect) {
    harmonySelect.addEventListener('change', function () {
      if (!harmonySelect.value) return;
      applyHarmony(harmonySelect.value);
      harmonySelect.value = ''; // back to the placeholder - this is an action trigger, not a persistent choice
    });
  }
  // Group D Phase B4 follow-up: marks the sheet's last-applied harmony button (if any) the same black-fill
  // "active" every other persistent choice in this app uses (.icon-btn.active, index.html) - a NEW state to
  // show, not a pre-existing bug: these 7 buttons are one-shot actions (UI.guard() above), with nothing to
  // mark active, until lastHarmonyTypeFor() gave a sheet a real "currently in effect" concept to show.
  // Reads the SAME state afterAnchorChange()/applyHarmony() already maintain - no new data, just a new,
  // faithful display of it; clears itself automatically via sync() after Reset Color or the old rule system
  // clear lastHarmonyTypeFor() (core/facecolor.js), and is independent per sheet since that state already is.
  function syncHarmonyActive() {
    const type = lastHarmonyTypeFor(activeLayer);
    Object.keys(harmonyBtns).forEach(function (t) {
      const b = harmonyBtns[t];
      if (!b) return;
      const on = t === type;
      if (b.classList.contains('active') !== on) b.classList.toggle('active', on);
    });
  }

  // ---- sync (on every redraw) ------------------------------------------------------------------------------------
  function sync() {
    if (typeof updateFaceColorsPanel === 'function') updateFaceColorsPanel(); // this frame's trail-list DOM, not stale
    syncAnchor();
    syncAnchorPreview();
    syncAnchorWidgets();
    syncHarmonyActive();
    syncStrategy();
    const why = reason();
    UI.setDisabled(moreBtn, why);
    [kreisTrigger, dreieckTrigger].forEach(function (b) { if (b) UI.setDisabled(b, why); });
    Object.keys(harmonyBtns).forEach(function (type) { if (harmonyBtns[type]) UI.setDisabled(harmonyBtns[type], why); });
    [hueStepperRoot, registerStepperRoot, strategyStepperRoot].forEach(function (root) {
      if (root) root.querySelectorAll('.stepper-btn').forEach(function (b) { UI.setDisabled(b, why); });
    });
    if (harmonySelect) harmonySelect.disabled = !!why;
    // Reset Color keeps sketch.js's own, untouched click handler (a DOM relocation, not new logic) - this
    // only dims it to match the row's eligibility; a click while "disabled" still runs resetFaceColors(),
    // which is a harmless no-op on an already-empty/default store. Not gated with UI.guard() like the 7
    // harmony buttons above, to avoid a second listener next to sketch.js's real one.
    if (resetBtn) UI.setDisabled(resetBtn, why);
    if (why) {
      [row.__overlay, kreisOverlay, dreieckOverlay].forEach(function (ov) { if (ov && ov.isOpen) ov.close(false); });
    }

    const dotOn = why === T['reason.fill.off'] && window.uiNav && uiNav.current() === 'farbe';
    if (fillBtn && fillBtn.classList.contains('needs-attn') !== dotOn) fillBtn.classList.toggle('needs-attn', dotOn);
  }

  const overlay = UI.overlay(moreBtn, panel, { onOpen: sync });
  row.__overlay = overlay; // so sync() can close it when the row becomes disabled while it is open
  document.addEventListener('tabchange', sync); // the fill-button dot depends on which tab is current

  UI.onSync(sync);
})();
