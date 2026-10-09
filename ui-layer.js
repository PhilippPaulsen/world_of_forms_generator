/*
 * The layer controls behind the layer "Mehr" toggle (layers, 5d, step 1b-1): the node-count and size steppers and the aria-pressed state of the layer's shape and fold
 * buttons. UI only. It wires markup that already exists in index.html (#layer-more-panel) to the EXISTING inputs and handlers - no second copy of any input or state - the
 * way ui-form.js does it for the Form row, with the same building blocks (ui.js: UI.stepper, UI.pressed, UI.onSync) and the same markup and CSS (.stepper, .stepper-btn,
 * .nav-cluster, .ico):
 *
 *   steppers   number + stacked chevrons around the existing #layer-node-count-input and #layer-shape-size-input: the chevrons set the value and dispatch 'input' and
 *              'change' (ui.js), so sketch.js's handlers (updateActiveLayerGrid(), which clears THIS layer's lines and rebuilds its grid) react exactly as to typing. The
 *              fields stay typable (inputmode="none"); an out-of-range number is clamped with a toast BEFORE the sketch reads it (this file runs before setup(), so its
 *              listener comes first). The node count's limit is maxNodeCountFor(the layer's own shape), the same source as the Form row's (there: the base's shape).
 *              The size is 1..9. The Form row's "odd sizes only while a Field net is active" rule is about the BASE's Shape Size and the base net; a layer's size is not
 *              tied to it (sketch.js clamps a layer's size to 1..9 only), so it is not applied here.
 *   shape,     the buttons stay what they were (p5 mousePressed handlers in sketch.js, class 'active' = the state); aria-pressed follows the 'active' class (UI.pressed),
 *   fold       as the Form row's shape buttons do.
 *
 * The sync function (UI.onSync, called on every draw()) re-reads the layer and updates the chevrons' disabled state; it writes an attribute only when the value changed.
 * The German texts are the reasons for now, copied from ui-form.js (the dictionary, data-i18n, comes in a later phase).
 */
(function () {
  const T = {
    'reason.none': 'Keine Ebene aktiv.',
    'reason.node.min': 'Mindestens 1 Knoten.',
    'reason.node.max.square': function (n) { return 'Höchstens ' + n + ' Knoten beim Quadrat.'; },
    'reason.node.max.other': function (n) { return 'Höchstens ' + n + ' Knoten bei Dreieck und Sechseck.'; },
    'reason.size.min': 'Kleinste Größe: 1.',
    'reason.size.max': 'Größte Größe: 9.',
  };
  const $ = function (s) { return document.querySelector(s); };
  const nodeInput = $('#layer-node-count-input'), sizeInput = $('#layer-shape-size-input');
  if (!nodeInput || !sizeInput) return;

  // the active layer (a normal layer, not the base), or null
  function layer() {
    return typeof activeLayer !== 'undefined' && activeLayer !== 'base' && typeof additionalLayers !== 'undefined' && additionalLayers[activeLayer] || null;
  }
  function nodeMax() { const L = layer(); return typeof maxNodeCountFor === 'function' ? maxNodeCountFor(L ? L.shape : 'triangle') : 7; }
  function nodeMaxMsg(max) { const L = layer(); return (L && L.shape === 'square' ? T['reason.node.max.square'] : T['reason.node.max.other'])(max); }

  // dir +1 = the up chevron, -1 = the down chevron
  function nodeCompute(dir) {
    if (!layer()) return { to: null, reason: T['reason.none'] };
    const cur = parseInt(nodeInput.value, 10) || 1, max = nodeMax(), to = cur + dir;
    if (to < 1) return { to: null, reason: T['reason.node.min'] };
    if (to > max) return { to: null, reason: nodeMaxMsg(max) };
    return { to: to };
  }
  function nodeRange() { const max = nodeMax(); return { min: 1, max: max, minMsg: T['reason.node.min'], maxMsg: nodeMaxMsg(max) }; }
  function sizeCompute(dir) {
    if (!layer()) return { to: null, reason: T['reason.none'] };
    const to = (parseInt(sizeInput.value, 10) || 1) + dir;
    if (to < 1) return { to: null, reason: T['reason.size.min'] };
    if (to > 9) return { to: null, reason: T['reason.size.max'] };
    return { to: to };
  }
  function sizeRange() { return { min: 1, max: 9, minMsg: T['reason.size.min'], maxMsg: T['reason.size.max'] }; }

  const steppers = [
    UI.stepper(nodeInput.closest('.stepper'), { input: nodeInput, compute: nodeCompute, range: nodeRange }),
    UI.stepper(sizeInput.closest('.stepper'), { input: sizeInput, compute: sizeCompute, range: sizeRange }),
  ];

  // shape and fold: aria-pressed follows the 'active' class that sketch.js's handlers (and updateOffsetControls) set
  document.querySelectorAll('.layer-shape-icon-btn, .layer-fold-btn').forEach(function (b) { UI.pressed(b); });

  UI.onSync(function () { steppers.forEach(function (s) { s.refresh(); }); });
})();
