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
 *   symmetry   ONE exclusive choice with two options - rotation, or rotation + mirror (the default) - derived from
 *              sketch.js's symmetryCategory (window.symmetryUi) through the pure mapping in
 *              core/symmetry-toggles.js. "None" and "mirror only" are under More ("Andere Symmetrie"): while one
 *              of them is current, neither main option is checked and the More button shows a dot.
 *   fold       the hexagon's 3-/6-fold choice, under More. Default 6 (sketch.js: symmetryFold = 6); a catalog
 *              back-link that sets 3-fold is respected (sketch.js bestEffortCategoryFold).
 *
 * The sync function (registered with UI.onSync) re-reads the state; ui.js calls it on every redraw (sketch.js draw())
 * and after symmetry changes; it only writes an attribute when the value actually changed. Nothing here is ever hidden: a control that is not available
 * is aria-disabled.
 *
 * The German texts below are the reasons/notes for now; the dictionary (data-i18n keys) comes in a later phase.
 */
(function () {
  // reasons and notes (key -> text); moved into the dictionary later
  const T = {
    'reason.node.min': 'Mindestens 1 Knoten.',
    'reason.node.min.trig': 'Sin und Tan brauchen mindestens 4 Knoten.',
    'reason.node.max.square': function (n) { return 'Höchstens ' + n + ' Knoten beim Quadrat.'; },
    'reason.node.max.other': function (n) { return 'Höchstens ' + n + ' Knoten bei Dreieck und Sechseck.'; },
    'reason.size.min': 'Kleinste Größe: 1.',
    'reason.size.max': 'Größte Größe: 9.',
    'reason.size.field.min': 'Im Feld-Netz sind nur ungerade Größen von 3 bis 9 möglich; 3 ist die kleinste.',
    'note.size.field': function (from, to) { return 'Feld-Netz: nur ungerade Größen, deshalb ' + from + ' → ' + to + '.'; },
    'reason.fold.hex': 'Die Zähligkeit (3 oder 6) gilt nur beim Sechseck.',
    'reason.fold.rotation': 'Die Zähligkeit gilt nur mit Drehung.',
    'more.label': 'Mehr',
    'more.label.none': 'Mehr – aktive Symmetrie: keine',
    'more.label.mirror': 'Mehr – aktive Symmetrie: nur Spiegelung',
  };

  const $ = function (s) { return document.querySelector(s); };

  // ---- shapes: aria-pressed follows the old 'active' class -----------------
  document.querySelectorAll('.shape-icon-btn').forEach(function (b) { UI.pressed(b); });

  // ---- steppers -------------------------------------------------------------
  const nodeInput = $('#node-count-input'), sizeInput = $('#shape-size-input');

  function fieldActive() {
    return typeof baseNetTransform !== 'undefined' && !!baseNetTransform && baseNetTransform.domain === 'field';
  }
  // A Sin or Tan net needs at least 4 nodes (at 3 the law sits on its fixed points and shows no effect), so the stepper
  // does not go below 4 while one is active (sketch.js raises a lower count when the kind is chosen, and says so).
  function trigNetActive() {
    if (typeof baseNetTransform === 'undefined' || !baseNetTransform) return false;
    const x = baseNetTransform.x, y = baseNetTransform.y;
    return (x && x.kind === 'trig') || (y && y !== 'same' && y.kind === 'trig');
  }
  function nodeMin() { return trigNetActive() ? 4 : 1; }
  function nodeMinMsg() { return trigNetActive() ? T['reason.node.min.trig'] : T['reason.node.min']; }
  function nodeMax() { return typeof maxNodeCountFor === 'function' ? maxNodeCountFor(currentShape) : 7; }
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

  // Shape Size: 1..9. While a Field net is active only odd sizes 3..9 are valid (a Field needs an odd size), so the
  // stepper moves in twos then - and says so; it never produces an even size there. Without a Field it steps by 1
  // (an even size is fine for Single/Tiled and for no net). A TYPED even size in a Field is left to sketch.js, which
  // resets the domain to Single with a visible note (the size itself never changes).
  function sizeCompute(dir) {
    const cur = parseInt(sizeInput.value, 10) || 1;
    if (fieldActive()) {
      const to = cur % 2 === 0 ? cur + dir : cur + 2 * dir; // an even size cannot occur in a Field, but never step onto one
      if (to < 3) return { to: null, reason: T['reason.size.field.min'] };
      if (to > 9) return { to: null, reason: T['reason.size.max'] };
      return { to: to, note: Math.abs(to - cur) === 2 ? T['note.size.field'](cur, to) : undefined };
    }
    const to = cur + dir;
    if (to < 1) return { to: null, reason: T['reason.size.min'] };
    if (to > 9) return { to: null, reason: T['reason.size.max'] };
    return { to: to };
  }
  function sizeRange() { return { min: 1, max: 9, minMsg: T['reason.size.min'], maxMsg: T['reason.size.max'] }; }

  const steppers = [];
  document.querySelectorAll('.nav-form .stepper').forEach(function (root) {
    const input = root.querySelector('input');
    const isNode = input === nodeInput;
    steppers.push(UI.stepper(root, { input: input, compute: isNode ? nodeCompute : sizeCompute, range: isNode ? nodeRange : sizeRange }));
  });

  // ---- symmetry: one exclusive choice + "Andere Symmetrie" + fold, under More ------------------------------------
  const rotBtn = $('#btn-sym-rotation'), rotMirBtn = $('#btn-sym-rotation-mirror');
  const noneBtn = $('#btn-sym-none'), mirrorOnlyBtn = $('#btn-sym-mirror-only');
  const fold3 = $('#btn-fold-opt-3'), fold6 = $('#btn-fold-opt-6'), foldHint = $('#ov-fold-hint');
  const moreBtn = $('#btn-more-form');

  const mainGroup = UI.radiogroup($('.nav-symmetry'), function (r) {
    symmetryUi.setCategory(symmetryCategoryForVisible(r === rotBtn ? 'rotation' : 'rotation+mirror'));
  });
  const otherGroup = UI.radiogroup($('#ov-sym-other'), function (r) {
    symmetryUi.setCategory(r === noneBtn ? 'none' : 'mirror');
  });
  const foldGroup = UI.radiogroup($('#ov-fold'), function (r) { symmetryUi.setFold(r === fold3 ? 3 : 6); });

  function syncSymmetry() {
    if (!window.symmetryUi) return;
    const cat = symmetryUi.category(), fold = symmetryUi.fold(), vis = symmetryVisibleState(cat);
    mainGroup.set(vis === 'rotation' ? rotBtn : vis === 'rotation+mirror' ? rotMirBtn : null);
    otherGroup.set(cat === 'none' ? noneBtn : cat === 'mirror' ? mirrorOnlyBtn : null);
    // fold: the option matching the stored fold is checked; the group is aria-disabled unless the hexagon has rotation
    const applies = symmetryFoldApplies(cat, currentShape);
    const reason = applies ? null : (currentShape !== 'hex' ? T['reason.fold.hex'] : T['reason.fold.rotation']);
    UI.setDisabled(fold3, reason);
    UI.setDisabled(fold6, reason);
    foldGroup.set(fold === 3 ? fold3 : fold6);
    if (foldHint.hidden !== applies) foldHint.hidden = applies;
    if (!applies && foldHint.textContent !== reason) foldHint.textContent = reason;
    // the More button says when a symmetry it holds is active (until the info card names the mode)
    const other = vis === 'other';
    if (moreBtn.classList.contains('has-state') !== other) moreBtn.classList.toggle('has-state', other);
    const label = T[other ? (cat === 'none' ? 'more.label.none' : 'more.label.mirror') : 'more.label'];
    if (moreBtn.getAttribute('aria-label') !== label) { moreBtn.setAttribute('aria-label', label); moreBtn.setAttribute('title', label); }
  }

  UI.overlay(moreBtn, $('#more-form'), { onOpen: syncSymmetry });

  UI.onSync(function () {
    steppers.forEach(function (s) { s.refresh(); });
    syncSymmetry();
  });
})();
