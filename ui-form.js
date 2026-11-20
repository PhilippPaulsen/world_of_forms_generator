/*
 * The Form nav row (UI rework 4b): shapes, node and size steppers, the
 * symmetry choice and its "More" overlay. It wires markup that already
 * exists in index.html to the EXISTING elements and handlers - no second
 * copy of any input or state:
 *
 *   shapes     the old .shape-icon-btn buttons moved here (sketch.js's handlers run as before);
 *              aria-pressed follows their 'active' class
 *   steppers   number + stacked chevrons around the existing #node-count-input / #shape-size-input: the chevrons
 *              set the value and dispatch 'input' and 'change' (ui.js), so sketch.js reacts exactly as to typing.
 *              The fields stay typable; an out-of-range number is clamped with a toast.
 *   symmetry   TWO independent toggles, Drehung (rotation) and Spiegelung (mirror), both on by default (= Spiegeling).
 *              Their state is read from sketch.js's symmetryCategory (window.symmetryUi): a click flips ONE half through
 *              the pure symmetryToggle() of core/symmetry-toggles.js and hands the category to symmetryUi.setCategory,
 *              the only writer of the raw mode. Both off is "none", only the mirror on is "reflection_only" (both valid).
 *   fold       the hexagon's 3-/6-fold choice, under More (now the only thing there). Default 6 (sketch.js:
 *              symmetryFold = 6); a catalog back-link that sets 3-fold is respected (sketch.js bestEffortCategoryFold).
 *              The More button's dot means "the fold is 3" (hexagon with Drehung).
 *
 * The sync function (registered with UI.onSync) re-reads the state; ui.js calls it on every redraw (sketch.js draw())
 * and after symmetry changes; it only writes an attribute when the value actually changed. Nothing here is ever hidden: a control that is not available
 * is aria-disabled.
 *
 * The German texts below are the reasons/notes for now; the dictionary (data-i18n keys) comes in a later phase.
 */
(function () {
  // reasons and notes (key -> text); the whole sentences with a number go through the dictionary (task 043), the others move later
  // a sentence of the bilingual dictionary (ui-i18n.js) in the current language, else the German text written here
  const tr = function (key, params, fallback) { const i = window.uiI18n; return i && i.has(key) ? i.t(key, params) : fallback; };
  const T = {
    get 'reason.node.min'() { return tr('reason.node.min', null, 'Niedrigste Ordnung: 1.'); },
    'reason.node.min.trig': function (n) { return tr('reason.node.min.trig', { n: n }, 'Sin und Tan brauchen mindestens Ordnung ' + n + '.'); },
    'reason.node.max.square': function (n) { return tr('reason.node.max.square', { n: n }, 'Höchste Ordnung beim Quadrat: ' + n + '.'); },
    'reason.node.max.other': function (n) { return tr('reason.node.max.other', { n: n }, 'Höchste Ordnung bei dieser Form: ' + n + '.'); },
    get 'reason.size.min'() { return tr('reason.size.min', null, 'Kleinste Größe: 1.'); },
    get 'reason.size.max'() { return tr('reason.size.max', null, 'Größte Größe: 9.'); },
    get 'reason.size.ratio'() { return tr('size.ratio.max', null, 'Seitenverhältnis höchstens 1:3'); },
    get 'reason.size.lock'() { return tr('size.lock', null, 'Seitenverhältnis koppeln (Quadrat)'); },
    get 'reason.size.field.min'() { return tr('reason.size.field.min', null, 'Im Feld-Netz sind nur ungerade Größen von 3 bis 9 möglich; 3 ist die kleinste.'); },
    get 'reason.size.fieldSq.min'() { return tr('reason.size.fieldSq.min', null, 'Im Feld-Netz ist 3 die kleinste Größe.'); },   // task 106: the square's Field (any size 3..9)
    'note.size.field': function (from, to) { return tr('note.size.field', { from: from, to: to }, 'Feld-Netz: nur ungerade Größen, deshalb ' + from + ' → ' + to + '.'); },
    get 'reason.fold.hex'() { return tr('reason.fold.hex', null, 'Die Zähligkeit (3 oder 6) gilt nur beim Sechseck.'); },
    get 'reason.fold.rotation'() { return tr('reason.fold.rotation', null, 'Die Zähligkeit gilt nur mit Drehung.'); },
    get 'more.label'() { return tr('more.form', null, 'Mehr'); },
    get 'more.label.fold3'() { return tr('more.label.fold3', null, 'Mehr – aktive Zähligkeit: 3'); },
  };

  const $ = function (s) { return document.querySelector(s); };

  // ---- shapes: aria-pressed follows the old 'active' class -----------------
  document.querySelectorAll('.shape-icon-btn').forEach(function (b) { UI.pressed(b); });

  // ---- lage (task 068c3b): the active shape button of a lage-2 base carries a dot (class lage-2) and says "Dreieck, Lage 2. Erneut klicken: Lage 1" ----------
  // The second click on the active button changes the lage (sketch.js toggleBaseLage). The hint "Erneut klicken" only shows where the click can work (ordnung within the lage-2 ceiling).
  const SHAPE_NAME = { triangle: 'Dreieck', square: 'Quadrat', hex: 'Sechseck' };
  const SHAPE_KEY = { triangle: 'shape.triangle', square: 'shape.square', hex: 'shape.hex' };
  function lageText(name, n, m) { return tr('shape.lage.state', { name: name, n: n, m: m }, name + ', Lage ' + n + '. Erneut klicken: Lage ' + m); }
  function syncLage() {
    if (typeof gridSpec === 'undefined') return;
    document.querySelectorAll('.shape-icon-btn').forEach(function (b) {
      const shape = b.getAttribute('data-shape'), on = b.classList.contains('active');
      const dot = on && gridSpec.lage === 2;
      if (b.classList.contains('lage-2') !== dot) b.classList.toggle('lage-2', dot);
      let text = tr(SHAPE_KEY[shape], null, SHAPE_NAME[shape]);
      if (on) {
        if (gridSpec.lage === 2) text = lageText(text, 2, 1);
        else if (gridSpec.ordnung <= maxOrdnungFor(shape, 2)) text = lageText(text, 1, 2);
      }
      UI.name(b, text);
    });
  }

  // ---- steppers -------------------------------------------------------------
  const nodeInput = $('#node-count-input'), sizeInput = $('#shape-size-input'), sizeYInput = $('#shape-size-y-input');

  function fieldActive() {
    return typeof baseNetTransform !== 'undefined' && !!baseNetTransform && baseNetTransform.domain === 'field';
  }
  // task 106: the SQUARE's Field takes every size 3..9 (even ones too: steps of one); task 108: so does the TRIANGLE's; task 109: and the hexagon's (the odd-twos branches below remain for an unknown shape only)
  function fieldAnySize() { return typeof currentShape !== 'undefined' && (currentShape === 'square' || currentShape === 'triangle' || currentShape === 'hex'); }
  // A Sin or Tan net needs at least 4 nodes (at 3 the law sits on its fixed points and shows no effect), so the stepper
  // does not go below 4 while one is active (sketch.js raises a lower count when the kind is chosen, and says so).
  function trigNetActive() {
    if (typeof baseNetTransform === 'undefined' || !baseNetTransform) return false;
    const x = baseNetTransform.x, y = baseNetTransform.y;
    return (x && x.kind === 'trig') || (y && y !== 'same' && y.kind === 'trig');
  }
  function nodeMin() { return trigNetActive() ? (typeof gridMinOrdnungTrig === 'function' ? gridMinOrdnungTrig(currentShape) : 3) : 1; }   // task 068c2: the value is the ordnung (Sin/Tan: E >= 3, i.e. 3 / 3 / 4)
  function nodeMinMsg() { return trigNetActive() ? T['reason.node.min.trig'](nodeMin()) : T['reason.node.min']; }
  function nodeMax() { return typeof gridMaxOrdnung === 'function' ? gridMaxOrdnung(currentShape, typeof gridSpec !== 'undefined' ? gridSpec.lage : 1) : 12; }
  function nodeMaxMsg(max) { return (currentShape === 'square' ? T['reason.node.max.square'] : T['reason.node.max.other'])(max); }

  // dir +1 = the up chevron, -1 = the down chevron
  function nodeCompute(dir) {
    const cur = parseInt(nodeInput.value, 10) || 1;
    const max = nodeMax();
    const to = cur + dir;
    if (to < nodeMin()) return { to: null, reason: nodeMinMsg() };
    if (to > max) return { to: null, reason: nodeMaxMsg(max) };
    return { to: to };
  }
  function nodeRange() {
    const max = nodeMax();
    return { min: nodeMin(), max: max, minMsg: nodeMinMsg(), maxMsg: nodeMaxMsg(max) };
  }

  // Shape Size: 1..9. While a Field net is active on an unknown shape only odd sizes 3..9 are valid (task 106 / 108: the square's and the triangle's Field take every size 3..9, steps of one), so the
  // stepper moves in twos then - and says so; it never produces an even size there. Without a Field it steps by 1
  // (an even size is fine for Single/Tiled and for no net). A TYPED even size in a Field is left to sketch.js, which
  // resets the domain to Single with a visible note (the size itself never changes).
  // Task 080: the width (X) and the height (Y) stepper. While the lock is open (or the area is not square) a count is limited by validateGridSize against the other one (sketch.js sizeAxisRange: 1..9 and at
  // most 1:3, no second table); while it is locked the width is the old stepper (it sets X = Y) and the Field rule below applies.
  function sizeLimits(axis) {
    const open = typeof sizeLockIsOpen === 'function' && sizeLockIsOpen();
    if (!open) return { min: 1, max: 9, openLimit: false };
    const other = axis === 'x' ? gridSizeY() : gridSizeX(), r = sizeAxisRange(axis, other);
    return { min: r.min, max: r.max, openLimit: true };
  }
  function sizeCompute(dir, axis) {
    axis = axis || 'x';
    const input = axis === 'y' ? sizeYInput : sizeInput;
    const cur = parseInt(input.value, 10) || 1;
    const lim = sizeLimits(axis);
    if (lim.openLimit) {
      if (fieldActive() && fieldAnySize()) {   // task 106 / 108: the square's and the triangle's Field: steps of one, 3..9 per axis, within 1 : 3 against the other axis
        const to = cur + dir;
        if (to < 3) return { to: null, reason: T['reason.size.fieldSq.min'] };
        if (to > 9) return { to: null, reason: T['reason.size.max'] };
        if (to < lim.min) return { to: null, reason: T['reason.size.ratio'] };
        if (to > lim.max) return { to: null, reason: T['reason.size.ratio'] };
        return { to: to };
      }
      if (fieldActive()) {   // task 086: a Field spans X x Y tiles, each axis odd 3..9 by itself (ratio <= 1:3 always holds): odd steps of two per axis (an unknown shape since task 109)
        const to = cur % 2 === 0 ? cur + dir : cur + 2 * dir;
        if (to < 3) return { to: null, reason: T['reason.size.field.min'] };
        if (to > 9) return { to: null, reason: T['reason.size.max'] };
        if (to < lim.min) return { to: null, reason: T['reason.size.ratio'] };
        if (to > lim.max) return { to: null, reason: T['reason.size.ratio'] };
        return { to: to, note: Math.abs(to - cur) === 2 ? T['note.size.field'](cur, to) : undefined };
      }
      const to = cur + dir;
      if (to < lim.min) return { to: null, reason: lim.min > 1 ? T['reason.size.ratio'] : T['reason.size.min'] };
      if (to > lim.max) return { to: null, reason: lim.max < 9 ? T['reason.size.ratio'] : T['reason.size.max'] };
      return { to: to };
    }
    if (fieldActive() && fieldAnySize()) {   // task 106 / 108: the square's and the triangle's Field, lock closed (X = Y): steps of one, 3..9
      const to = cur + dir;
      if (to < 3) return { to: null, reason: T['reason.size.fieldSq.min'] };
      if (to > 9) return { to: null, reason: T['reason.size.max'] };
      return { to: to };
    }
    if (fieldActive()) {
      const to = cur % 2 === 0 ? cur + dir : cur + 2 * dir; // an even size cannot occur in a Field of an unknown shape, but never step onto one
      if (to < 3) return { to: null, reason: T['reason.size.field.min'] };
      if (to > 9) return { to: null, reason: T['reason.size.max'] };
      return { to: to, note: Math.abs(to - cur) === 2 ? T['note.size.field'](cur, to) : undefined };
    }
    const to = cur + dir;
    if (to < 1) return { to: null, reason: T['reason.size.min'] };
    if (to > 9) return { to: null, reason: T['reason.size.max'] };
    return { to: to };
  }
  function sizeRange(axis) {
    const lim = sizeLimits(axis || 'x');
    return { min: lim.min, max: lim.max, minMsg: lim.min > 1 ? T['reason.size.ratio'] : T['reason.size.min'], maxMsg: lim.max < 9 ? T['reason.size.ratio'] : T['reason.size.max'] };
  }

  const steppers = [];
  document.querySelectorAll('.nav-form .stepper').forEach(function (root) {
    const input = root.querySelector('input');
    const isNode = input === nodeInput, isY = input === sizeYInput;
    steppers.push(UI.stepper(root, { input: input, compute: isNode ? nodeCompute : isY ? function (d) { return sizeCompute(d, 'y'); } : function (d) { return sizeCompute(d, 'x'); }, range: isNode ? nodeRange : isY ? function () { return sizeRange('y'); } : function () { return sizeRange('x'); } }));
  });

  // ---- symmetry: two independent toggles (Drehung, Spiegelung) + the hexagon's fold under More ------------------
  const rotBtn = $('#btn-sym-rotation'), mirBtn = $('#btn-sym-mirror');
  const fold3 = $('#btn-fold-opt-3'), fold6 = $('#btn-fold-opt-6'), foldHint = $('#ov-fold-hint');
  const moreBtn = $('#btn-more-form');

  // Native buttons: UI.guard runs the click once (Enter and Space on a focused button are a click; the keyboard bridge in ui.js adds a mousedown that nothing here listens to).
  [[rotBtn, 'rotation'], [mirBtn, 'mirror']].forEach(function (p) {
    UI.guard(p[0], function () { symmetryUi.setCategory(symmetryToggle(symmetryUi.category(), p[1])); });
  });
  function setToggle(btn, on) {
    const v = on ? 'true' : 'false';
    if (btn.getAttribute('aria-pressed') !== v) btn.setAttribute('aria-pressed', v);
    if (btn.classList.contains('active') !== on) btn.classList.toggle('active', on);
  }
  const foldGroup = UI.radiogroup($('#ov-fold'), function (r) { symmetryUi.setFold(r === fold3 ? 3 : 6); });

  function syncSymmetry() {
    if (!window.symmetryUi) return;
    const cat = symmetryUi.category(), fold = symmetryUi.fold();
    setToggle(rotBtn, symmetryHasRotation(cat));
    setToggle(mirBtn, symmetryHasMirror(cat));
    // fold: the option matching the stored fold is checked; the group is aria-disabled unless the hexagon has rotation
    const applies = symmetryFoldApplies(cat, currentShape);
    const reason = applies ? null : (currentShape !== 'hex' ? T['reason.fold.hex'] : T['reason.fold.rotation']);
    UI.setDisabled(fold3, reason);
    UI.setDisabled(fold6, reason);
    foldGroup.set(fold === 3 ? fold3 : fold6);
    if (foldHint.hidden !== applies) foldHint.hidden = applies;
    if (!applies && foldHint.textContent !== reason) foldHint.textContent = reason;
    // the More button says when the fold it holds is not the default (3, hexagon with Drehung)
    const three = applies && fold === 3;
    // task 080: on the phone the lock and the height stepper live under More, so the dot also says "the area is not square" (X != Y)
    const dot = three || (!!document.documentElement && document.documentElement.classList.contains('ph') && typeof gridIsSquare === 'function' && !gridIsSquare());
    if (moreBtn.classList.contains('has-state') !== dot) moreBtn.classList.toggle('has-state', dot);
    const label = T[three ? 'more.label.fold3' : 'more.label'];
    if (moreBtn.getAttribute('aria-label') !== label) { moreBtn.setAttribute('aria-label', label); moreBtn.setAttribute('title', label); }
  }

  // ---- Task 080: the aspect-ratio lock and the height stepper ---------------------------------------------------------------------------
  // The lock is UI state only (sketch.js sizeLockIsOpen(): open while the area is not square or after a click; never saved). Locked = aria-pressed "true" (closed padlock), the height stepper aria-disabled and
  // showing X. Unlocked: the height is its own count. From 768px both sit in #nav-form behind the width stepper; on the phone (html.ph) they are moved into #more-form (#ov-size), and back.
  const lockBtn = $('#btn-size-lock'), yStepper = $('#nav-size-y-stepper'), ovSize = $('#ov-size'), ovSizeSection = $('#ov-size-section');
  const sizeHome = yStepper ? yStepper.nextSibling : null;   // the divider behind the height stepper: the place to go back to
  if (lockBtn) UI.guard(lockBtn, function () { window.sizeLockToggle(); });
  function placeSizeControls() {
    if (!lockBtn || !yStepper || !ovSize) return;   // a page (or a test world) without the controls
    const phone = document.documentElement.classList.contains('ph');
    if (phone && lockBtn.parentNode !== ovSize) { ovSize.appendChild(lockBtn); ovSize.appendChild(yStepper); ovSizeSection.hidden = false; }
    else if (!phone && lockBtn.parentNode === ovSize) { sizeHome.parentNode.insertBefore(lockBtn, sizeHome); sizeHome.parentNode.insertBefore(yStepper, sizeHome); ovSizeSection.hidden = true; }
  }
  placeSizeControls();
  if (lockBtn && yStepper && typeof MutationObserver === 'function') new MutationObserver(placeSizeControls).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  function syncSize() {
    if (!lockBtn || !yStepper || !sizeYInput) return;
    const open = typeof sizeLockIsOpen === 'function' && sizeLockIsOpen();
    const pressed = open ? 'false' : 'true';
    if (lockBtn.getAttribute('aria-pressed') !== pressed) lockBtn.setAttribute('aria-pressed', pressed);
    UI.setDisabled(yStepper, open ? null : T['reason.size.lock']);
    if (typeof gridSizeX === 'function') {
      if (document.activeElement !== sizeInput && sizeInput.value !== String(gridSizeX())) sizeInput.value = String(gridSizeX());
      if (document.activeElement !== sizeYInput && sizeYInput.value !== String(gridSizeY())) sizeYInput.value = String(gridSizeY());
    }
  }

  UI.overlay(moreBtn, $('#more-form'), { onOpen: syncSymmetry });

  UI.onSync(function () {
    syncSize();
    steppers.forEach(function (s) { s.refresh(); });
    syncSymmetry();
    syncLage();
  });
})();
