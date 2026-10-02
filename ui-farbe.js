/*
 * The Farbe nav row: the Farborgel anchor (Kreis/Dreieck/steppers) and the 7 harmony triggers, plus the
 * distribution-strategy icons that live in the left rail (#farbe-strategy-group). The old "Mehr" overlay is gone
 * (its only remaining content, the cross-layer note, now sits beside #cross-layer-status - see index.html).
 *
 *   anchor     Kreis (hue ring)/Dreieck (register triangle) overlays + the hue/register steppers, all over the
 *              SAME anchorFor(sheet) state (core/facecolor.js) - never a second source of truth.
 *   view       Kreis and Dreieck are ALSO a two-state view switch: Kreis shows the 2/3/4 harmonies (hue-circle
 *              subdivisions), Dreieck shows B/W/S/V (series within the register triangle), in one shared slot.
 *              Clicking the trigger that is not the current view only switches the view; clicking the current
 *              one opens its overlay as before. Kreis is the default; the view follows the sheet's last-applied
 *              harmony on a sheet switch or any applyHarmony(); a dot on the other trigger marks "the active
 *              harmony is in the hidden family". Switching views never applies a harmony by itself.
 *   harmony    7 buttons (2/3/4/B/W/S/V) + a hidden fallback dropdown, all calling applyHarmony() (below), the
 *              one real consumer of the anchor - the REAL Farborgel engine end to end (core/farborgel-selection.mjs).
 *              The last-applied type is remembered per sheet (lastHarmonyTypeFor(), core/facecolor.js): an
 *              anchor change reapplies it live (afterAnchorChange(), below), and its button stays marked
 *              active (syncHarmonyActive(), below) until Reset Color or the old rule system take over.
 *   strategy   four icon radios in the rail (Zyklisch/Fläche/Symmetrie/Ringe) over distributionStrategyFor().
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

  const row = $('#nav-farbe');
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

  // ---- distribution strategy (Phase B-Farbstrategien step 2; moved from a stepper in this row to four icon
  // radios in the left rail in the layout round - same state, same persistence): which harmony member each
  // trail gets, cycling core/farborgel-bridge.js's own DISTRIBUTION_STRATEGIES. Persisted per sheet
  // (distributionStrategyFor()/setDistributionStrategyFor(), core/facecolor.js) - lazy, reset with the grid,
  // same lifecycle as lastHarmonyTypeFor(). Choosing one goes through afterStrategyChange() (reapply('strategy')) - the SAME live-
  // reapply path an anchor change already uses, not a second trigger - so it recolors the active harmony, or
  // (nothing applied yet) the gray default, exactly as the stepper did. UI.radiogroup() supplies the
  // aria-checked/roving-tabindex/arrow-key behavior and the .active (black fill) marking.
  const strategyGroupEl = $('#farbe-strategy-group');
  let strategyGroup = null;
  if (strategyGroupEl && typeof DISTRIBUTION_STRATEGIES !== 'undefined' && typeof UI !== 'undefined' && UI.radiogroup) {
    strategyGroup = UI.radiogroup(strategyGroupEl, function (r) {
      setDistributionStrategyFor(activeLayer, r.dataset.strategy);
      afterStrategyChange();
    });
  }
  function syncStrategy() {
    if (!strategyGroup || typeof distributionStrategyFor !== 'function') return;
    const strategy = distributionStrategyFor(activeLayer) || 'cyclic';
    strategyGroup.set(strategyGroup.radios.find(function (r) { return r.dataset.strategy === strategy; }) || null);
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

  // ---- view switch (layout round): which harmony family the shared slot shows. Registered BEFORE
  // UI.overlay() below attaches its own click toggle to the same two triggers, so a click on the trigger that
  // is not the current view can stop right here (stopImmediatePropagation) - it only switches the view; a click
  // on the current view's trigger falls through and opens/closes that trigger's overlay exactly as before.
  const HARMONY_FAMILY = { 2: 'circle', 3: 'circle', 4: 'circle', B: 'triangle', W: 'triangle', S: 'triangle', V: 'triangle' };
  const familyEls = { circle: $('#farbe-family-circle'), triangle: $('#farbe-family-triangle') };
  const familyTriggers = { circle: kreisTrigger, triangle: dreieckTrigger };
  let viewFamily = 'circle'; // Kreis is the default view
  function setViewFamily(f) { viewFamily = f; syncFamily(); }
  Object.keys(familyTriggers).forEach(function (f) {
    const btn = familyTriggers[f];
    if (!btn) return;
    UI.pressed(btn); // aria-pressed follows the .active class syncFamily() sets
    btn.addEventListener('click', function (e) {
      if (viewFamily !== f) { e.stopImmediatePropagation(); setViewFamily(f); }
    });
  });
  // The view FOLLOWS the sheet's applied harmony: whenever (sheet, last-applied type) differs from what the
  // previous sync saw and a harmony is in effect, show its family. A manual view switch persists otherwise
  // (neither value changes), and a sheet with no harmony yet leaves the view as it is.
  let followedSheet, followedType;
  function followHarmonyFamily() {
    const type = lastHarmonyTypeFor(activeLayer);
    if (activeLayer === followedSheet && type === followedType) return;
    followedSheet = activeLayer; followedType = type;
    if (type !== null && type !== undefined && HARMONY_FAMILY[type]) viewFamily = HARMONY_FAMILY[type];
  }
  function syncFamily() {
    const type = lastHarmonyTypeFor(activeLayer);
    const activeFamily = (type !== null && type !== undefined) ? HARMONY_FAMILY[type] : null;
    Object.keys(familyEls).forEach(function (f) {
      const el = familyEls[f], btn = familyTriggers[f];
      if (el && el.hidden !== (f !== viewFamily)) el.hidden = f !== viewFamily;
      if (btn && btn.classList.contains('active') !== (f === viewFamily)) btn.classList.toggle('active', f === viewFamily);
      // dot on the trigger of the HIDDEN family when the sheet's active harmony lives there
      const dot = f !== viewFamily && activeFamily === f;
      if (btn && btn.classList.contains('has-state') !== dot) btn.classList.toggle('has-state', dot);
    });
  }

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

    // Each trigger opens its own overlay (UI.overlay(), the same pattern #more-form/#more-netz
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
  // P3: THE one place a HarmonySelection is written into the active sheet. applyHarmony(type) (the 7 buttons and
  // the dropdown - the selection is regenerated from (anchor, type)) and the return handoff from the standalone
  // Farborgel page (a selection composed there - type CUSTOM_HARMONY_TYPE, kept in lastSelectionFor()) both end
  // here, so there is exactly one application path: the same store/trails resolution renderFaceColorsPanel()
  // uses, the same strategy + context, the same applyHarmonyToPattern() - nothing about ingestion differs but
  // where the selection came from. Returns { ok: true, sheet } or { ok: false, reason } (a reason code from
  // FARBORGEL_ACK_REASONS: the handoff turns it into an ack, the button path just ignores it as before).
  function applySelection(selection, type) {
    const { gridNodes, conns, sheet } = faceColorsGrid();
    const group = sheetGroupElements(gridNodes, sheet);
    if (!group) return { ok: false, reason: 'sheet-unavailable' };
    const facesResult = computeCellFaces(conns, gridNodes, null, null, sheet);
    const trails = computeFaceTrails(facesResult, group);
    if (!trails.length) return { ok: false, reason: 'no-trails' };
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
    // success - a thrown selection never reaches here) - the ONE place this is recorded, so a
    // direct button/dropdown click and an anchor-triggered reapply (below) are always in exact sync,
    // never two separately-maintained states. Type first, THEN the selection: setLastHarmonyTypeFor()
    // drops the stored selection for every type but 'custom'.
    setLastHarmonyTypeFor(activeLayer, type);
    if (type === CUSTOM_HARMONY_TYPE) setLastSelectionFor(activeLayer, JSON.parse(JSON.stringify(selection)));
    renderFaceColorsPanel();
    redraw();
    return { ok: true, sheet: activeLayer };
  }
  function applyHarmony(type) {
    if (typeof window.farborgelBuildHarmonySelection !== 'function') return; // the module script hasn't finished loading yet (rare)
    const a = anchorFor(activeLayer);
    if (!a) return;
    let selection;
    try { selection = window.farborgelBuildHarmonySelection(a, type); }
    catch (e) { UI.toast('Farborgel: ' + e.message); return; }
    applySelection(selection, type);
  }
  // P3: the selection currently behind a Farborgel-colored sheet - the stored one for a 'custom' sheet (it has no
  // recipe), else regenerated from (anchor, type) (a pure function of the two, see assignFarborgelSlot()'s
  // comment); null when the sheet is not Farborgel-colored. sketch.js's per-trail stepper reads it through
  // window.farborgelSelectionFor(), assignFarborgelSlot() below directly.
  function farborgelSelectionFor(sheet) {
    const type = lastHarmonyTypeFor(sheet);
    if (type === null || type === undefined) return null;
    if (type === CUSTOM_HARMONY_TYPE) return lastSelectionFor(sheet);
    const anchor = anchorFor(sheet);
    if (!anchor || typeof window.farborgelBuildHarmonySelection !== 'function') return null;
    try { return window.farborgelBuildHarmonySelection(anchor, type); } catch (e) { return null; }
  }
  window.farborgelSelectionFor = farborgelSelectionFor;
  // Phase B-Farbstrategien follow-up (gray-as-selection round): the gray-default sibling of
  // applyHarmony() above - same resolution (faceColorsGrid() -> group -> trails), same
  // strategy/context construction, the only difference is WHERE the colors come from (the one
  // real registered max-contrast-gray rule via buildMaxContrastGraySelection(), core/facecolor.js
  // - the SAME construction ensureDefaultGrayFill() itself uses, not a second formula) and the
  // provenance tag (ruleId: 'max-contrast-gray', never 'farborgel'). fillOnly is NOT set (defaults
  // to false) - unlike ensureDefaultGrayFill()'s own fill-only backfill role, this is an EXPLICIT
  // reapplication (the person just changed the strategy/anchor), so it overwrites every trail's
  // gray entry with the newly-chosen strategy's own ordering - exactly how applyHarmony() already
  // overwrites a Farborgel-colored sheet on every anchor change, not a new kind of behavior.
  // Deliberately never calls setLastHarmonyTypeFor() - this is not a Farborgel harmony, and
  // afterAnchorChange() below only reaches this branch while lastHarmonyTypeFor(sheet) is null.
  function applyGrayDefault() {
    const { gridNodes, conns, sheet } = faceColorsGrid();
    const group = sheetGroupElements(gridNodes, sheet);
    if (!group) return;
    const facesResult = computeCellFaces(conns, gridNodes, null, null, sheet);
    const trails = computeFaceTrails(facesResult, group);
    if (!trails.length) return;
    const selection = buildMaxContrastGraySelection(trails.length);
    const strategy = (typeof distributionStrategyFor === 'function' && distributionStrategyFor(activeLayer)) || 'cyclic';
    const context = { groupOpsCount: group.ops.length };
    if (strategy === 'rings' && typeof computeTrailRingDistances === 'function') {
      context.ringDistances = computeTrailRingDistances(facesResult, group, trails);
    }
    applyHarmonyToPattern(selection, faceAssignmentsFor(activeLayer), trails, strategy, context,
      { ruleId: 'max-contrast-gray', source: 'maxContrastGray' });
    renderFaceColorsPanel();
    redraw();
  }
  // Phase B-Farbstrategien follow-up (Reset-respects-strategy fix): exposed globally so sketch.js's
  // OWN, untouched Reset Color click handler (initFaceColorsPanel(), see its own comment on why this
  // file deliberately never adds a second listener there) can call it after resetFaceColors() -
  // without this, the very next passive render refills the sheet through ensureDefaultGrayFill()
  // alone, which is always-cyclic by design (its unattended, per-redraw role is unchanged by this),
  // silently dropping the sheet's sticky distributionStrategyFor() preference at the exact moment a
  // person would expect a fresh start to still honor it. Same cross-file convention this file
  // already consumes in the other direction (window.farborgelBuildHarmonySelection).
  window.applyGrayDefault = applyGrayDefault;

  // Phase B-Farbstrategien follow-up (per-trail override for Farborgel harmonies): a sibling of
  // core/facecolor.js's assignTrailSlot() for a Farborgel-colored trail, not a reuse of it -
  // assignTrailSlot() calls generateHarmonyPalette(palette.ruleId, ...), which throws for
  // 'farborgel' (not a core/color.js-registered rule - confirmed, that file registers only
  // isotint/isotone/shadow-series/tetrad/max-contrast-gray), and never sets displayColor, a field
  // a Farborgel entry needs (its calibrated Oklab-mixed color - re-resolving hue/w/s through
  // core/color.js's OWN OSTWALD_REFERENCE_SYSTEM would silently mute it, the exact bug Phase B4's
  // applyHarmonyToPattern() already fixed once for the initial application; an override must not
  // reintroduce it).
  //
  // No new persistent state: buildHarmonySelection(anchor, type) is a pure function (confirmed by
  // reading core/farborgel-selection.mjs - anchorField -> createComposition -> reduceComposition
  // -> createHarmonySelection, no hidden state) and afterAnchorChange() already re-applies on
  // every anchor/type change, so anchorFor(sheet) + lastHarmonyTypeFor(sheet) at override-click
  // time always regenerate the exact selection currently reflected in the store - the member list
  // is recomputed on demand here, not remembered a second time.
  //
  // Writes params.memberIndex (NOT params.slot) - confirmed live, not assumed, that .slot cannot
  // be reused here the way it is for gray. applyHarmonyToPattern()'s "always honored regardless
  // of strategy" treatment of params.slot is only meaningful when the series has one color per
  // trail (gray: M === N always, so a slot 0..N-1 IS a real area-rank Area/Symmetry/Rings can
  // bucket against). A Farborgel harmony's M (2..24) is almost always far smaller than N - caught
  // live: Dreier (M=3) on a 12-trail pattern has Area's own bucketSize = ceil(12/3) = 4, so EVERY
  // possible override value (0..2, assignFarborgelSlot()'s own real range) falls in bucket 0
  // regardless of which member was picked - the override LOOKED like it survived a strategy
  // switch only by the coincidence of the specific bucket size tested, not because the mechanism
  // actually honors it; a wider sweep showed every Farborgel override collapses into the lowest
  // bucket(s) under Area, a real, confirmed defect, not a one-off.
  // So the override instead gets EXACTLY a fresh entry's own shape (source: 'harmonySelection',
  // params.memberIndex, params.cardinality, params.strategy = the CURRENT strategy at click time) -
  // applyHarmonyToPattern() (core/farborgel-bridge.js) pins a trail's memberIndex when the existing
  // entry's strategy AND cardinality both match the new call: the override survives re-applying the
  // SAME harmony size under the SAME strategy (an anchor/hue/register change, the same Dreier button
  // clicked again), but resets to the new natural order on a strategy SWITCH or a different M - identical
  // to how an un-overridden Farborgel trail behaves. This is a WEAKER guarantee than gray's "survives any
  // later change" - a real, structural difference (M<N vs M=N), not something to paper over as equivalent.
  // CORRECTION (pin fix): until that pin existed, this survival only actually held for Zyklisch - under
  // Fläche/Ringe a re-application read the 0..M-1 memberIndex back as a rank and collapsed every trail
  // (including the overridden one) into member 0, and Symmetrie reshuffled them; the claim written here
  // before was true of the design, not of what the code did. It now holds for all four strategies.
  function assignFarborgelSlot(store, sheet, key, next) {
    const selection = farborgelSelectionFor(sheet); // P3: also a 'custom' (handed-back) selection, not only a regenerable one
    if (!selection) return null;
    if (!Number.isInteger(next) || next < 0 || next >= selection.members.length) {
      throw new Error(`assignFarborgelSlot: slot ${next} outside the series (0..${selection.members.length - 1})`);
    }
    const m = selection.members[next];
    const c = m.analyticalCoordinate;
    const hue = c.hueIndex === null ? FARBORGEL_GRAY_HUE_SUBSTITUTE : _farborgelHueToCoreHue(c.hueIndex);
    const strategy = (typeof distributionStrategyFor === 'function' && distributionStrategyFor(sheet)) || 'cyclic';
    setFaceAssignment(store, key, {
      hue, w: c.w, s: c.s, rule: 'farborgel',
      params: { source: 'harmonySelection', memberIndex: next, cardinality: selection.members.length, strategy },
      displayColor: m.srgb
    });
    return m;
  }
  window.assignFarborgelSlot = assignFarborgelSlot;

  // Group D Phase B4 follow-up: shared by every anchor-change site (Kreis/Dreieck/Register, the two
  // steppers) - if this sheet already has a last-applied harmony type, changing the anchor re-paints
  // the pattern with it immediately (matching the old rule engine's always-live feel,
  // applyFaceColorsPalette() on every axis step); otherwise (nothing applied yet) it's the same as
  // before - just refresh the UI (steppers/widgets/preview), no coloring happens on its own.
  // Phase B-Farbstrategien follow-up (gray-as-selection round): "nothing applied yet" no longer
  // means "no coloring happens" - a gray-default sheet now reapplies too (applyGrayDefault()),
  // so the distribution-strategy stepper (and, incidentally, the hue/register steppers, which a
  // gray fill ignores - re-running is a harmless no-op redraw for those) has a real, visible
  // effect on a sheet nobody has explicitly colored, not just on a Farborgel harmony.
  // P3: the reapply takes a REASON. A 'custom' sheet (a selection composed on the Farborgel page and handed back)
  // has no regeneration recipe, so: an ANCHOR change does nothing to it - silently reverting it to gray, or
  // regenerating something else, would destroy a composition the person made on purpose; it stays until an explicit
  // new harmony action replaces it (a harmony button, or another handoff) - while a STRATEGY change reapplies the
  // stored selection with the new distribution (the strategy decides which trail gets which member, not what the
  // members are). Every other sheet behaves exactly as before for both reasons.
  function reapply(reason) {
    const type = lastHarmonyTypeFor(activeLayer);
    if (type === CUSTOM_HARMONY_TYPE) {
      const stored = lastSelectionFor(activeLayer);
      if (reason === 'strategy' && stored) applySelection(stored, CUSTOM_HARMONY_TYPE);
    } else if (type !== null && type !== undefined) applyHarmony(type);
    else applyGrayDefault();
    sync();
  }
  function afterAnchorChange() { reapply('anchor'); }
  function afterStrategyChange() { reapply('strategy'); }
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

  // ---- return handoff from the standalone Farborgel page (Farborgel sub-page P3) -----------------------------------
  // A selection composed on the Farborgel page arrives through a localStorage "mailbox": the page writes
  // FARBORGEL_HANDOFF_KEY, the browser fires a `storage` event in every OTHER same-origin tab, and the one whose
  // id the envelope is addressed to (GENERATOR_TAB_ID, below) takes it. The envelope is untrusted cross-page input:
  // core/farborgel-bridge.js's parseFarborgelHandoff() validates it field by field (and drops replays through a
  // 20-id window) before anything reaches applyHarmonyToPattern(); a rejection is a console.warn plus a rejection
  // ack - never a throw into the render pipeline. A valid selection is applied through the SAME applySelection()
  // the 7 harmony buttons use, as type CUSTOM_HARMONY_TYPE, to the sheet that is ACTIVE when it arrives (what the
  // person sees on coming back - not the sheet the link was opened from, which may have been deleted or reordered
  // since). Then the ack is written, and the handoff key removed (each side cleans up the other's key).
  // A background tab still receives `storage` events; if the browser has frozen or discarded this tab the page
  // simply times out on its side - degraded, not silent. Tested in Chromium only (see INTEGRATION_INTERFACE.md).
  const handledHandoffIds = [];
  function ackHandoff(id, ok, detail) {
    try { localStorage.setItem(FARBORGEL_ACK_KEY, JSON.stringify(buildFarborgelAck(id, ok, detail))); }
    catch (e) { console.warn('Farborgel handoff: could not write the acknowledgement -', e && e.message); }
  }
  function removeHandoffKey() { try { localStorage.removeItem(FARBORGEL_HANDOFF_KEY); } catch (e) { /* storage gone: nothing to clean */ } }
  function receiveFarborgelSelection(selection) {
    // Same eligibility the 7 buttons have: they are disabled (aria-disabled + a reason) when face fill is off or the
    // sheet cannot show faces. A handoff cannot be "disabled", so it is refused - and the ack says why.
    if (typeof activeShowFaces !== 'function' || !activeShowFaces()) return { ok: false, reason: 'fill-off' };
    if (typeof faceFillsUnavailableReason === 'function' && faceFillsUnavailableReason()) return { ok: false, reason: 'sheet-unavailable' };
    return applySelection(selection, CUSTOM_HARMONY_TYPE);
  }
  function onFarborgelHandoffEvent(e) {
    if (e.key !== FARBORGEL_HANDOFF_KEY || GENERATOR_TAB_ID === null) return;
    let parsed;
    try { parsed = parseFarborgelHandoff(e.newValue, GENERATOR_TAB_ID, handledHandoffIds); }
    catch (err) { console.warn('Farborgel handoff: could not read the message -', err && err.message); return; }
    if (!parsed.ok) {
      if (parsed.code === 'not-for-me' || parsed.code === 'empty' || parsed.code === 'duplicate') return; // not an error: not ours / our own removal / a replay
      console.warn(`Farborgel handoff rejected (${parsed.code}): ${parsed.detail}`);
      if (parsed.addressed) { ackHandoff(parsed.id, false, parsed.code); removeHandoffKey(); }
      return;
    }
    rememberFarborgelHandoffId(handledHandoffIds, parsed.id);
    let result;
    try { result = receiveFarborgelSelection(parsed.selection); }
    catch (err) { console.warn('Farborgel handoff: applying the selection failed -', err && err.message); result = { ok: false, reason: 'internal-error' }; }
    if (!result.ok) console.warn(`Farborgel handoff not applied: ${result.reason}`);
    ackHandoff(parsed.id, result.ok, result.ok ? result.sheet : result.reason);
    removeHandoffKey();
  }
  window.addEventListener('storage', onFarborgelHandoffEvent);

  // ---- Farborgel page link (Farborgel sub-page P2): #btn-farborgel (index.html, a plain <a target="_blank">)
  // is kept pointing at the page PRE-FILLED with the active sheet's anchor - `?hue=9&reg=pa`, built by the pure
  // farborgelPageUrl() (core/farborgel-bridge.js). Updated on EVERY sync, not at click time: the anchor changes
  // while this page stays open, and a click-time update would miss middle-click / ctrl-cmd-click / "copy link" /
  // a touch long-press, none of which fire the click handler the pre-fill would hang off. The comparison keeps
  // it to a plain string compare per frame. Independent of the row's eligibility (`why`): the link works with
  // fill off, on any sheet. Only the active sheet's anchor is read - nothing is written back (the return trip
  // is a later phase).
  // P3: this generator tab's identity for the return handoff - generated ONCE per page load and added to the link as
  // `from=<12 hex>`; the Farborgel page addresses its handoff to it, so with several generator tabs open only the
  // one that opened the page reacts. A reload is a new identity on purpose: the state it held is gone anyway.
  const GENERATOR_TAB_ID = typeof farborgelNewTabId === 'function' ? farborgelNewTabId() : null;
  const farborgelLink = $('#btn-farborgel');
  function syncFarborgelLink() {
    if (!farborgelLink || typeof farborgelPageUrl !== 'function' || typeof anchorFor !== 'function') return;
    const url = farborgelPageUrl(anchorFor(activeLayer), GENERATOR_TAB_ID);
    if (farborgelLink.getAttribute('href') !== url) farborgelLink.setAttribute('href', url);
  }

  // ---- sync (on every redraw) ------------------------------------------------------------------------------------
  function sync() {
    if (typeof updateFaceColorsPanel === 'function') updateFaceColorsPanel(); // this frame's trail-list DOM, not stale
    syncFarborgelLink();
    syncAnchor();
    syncAnchorPreview();
    syncAnchorWidgets();
    followHarmonyFamily();
    syncFamily();
    syncHarmonyActive();
    syncStrategy();
    const why = reason();
    [kreisTrigger, dreieckTrigger].forEach(function (b) { if (b) UI.setDisabled(b, why); });
    Object.keys(harmonyBtns).forEach(function (type) { if (harmonyBtns[type]) UI.setDisabled(harmonyBtns[type], why); });
    [hueStepperRoot, registerStepperRoot].forEach(function (root) {
      if (root) root.querySelectorAll('.stepper-btn').forEach(function (b) { UI.setDisabled(b, why); });
    });
    if (harmonySelect) harmonySelect.disabled = !!why;
    if (strategyGroup) strategyGroup.radios.forEach(function (r) { UI.setDisabled(r, why); });
    // Reset Color keeps sketch.js's own, untouched click handler (a DOM relocation, not new logic) - this
    // only dims it to match the row's eligibility; a click while "disabled" still runs resetFaceColors(),
    // which is a harmless no-op on an already-empty/default store. Not gated with UI.guard() like the 7
    // harmony buttons above, to avoid a second listener next to sketch.js's real one.
    if (resetBtn) UI.setDisabled(resetBtn, why);
    if (why) {
      [kreisOverlay, dreieckOverlay].forEach(function (ov) { if (ov && ov.isOpen) ov.close(false); });
    }

    const dotOn = why === T['reason.fill.off'] && window.uiNav && uiNav.current() === 'farbe';
    if (fillBtn && fillBtn.classList.contains('needs-attn') !== dotOn) fillBtn.classList.toggle('needs-attn', dotOn);
  }

  document.addEventListener('tabchange', sync); // the fill-button dot depends on which tab is current

  UI.onSync(sync);
})();
