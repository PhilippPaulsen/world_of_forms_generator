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
  // a string of the bilingual dictionary (ui-i18n.js) in the current language, else the German text written here
  const tr = function (key, fallback, params) { const i = window.uiI18n; return i && i.has(key) ? i.t(key, params) : fallback; };
  const T = {
    get 'reason.none'() { return tr('common.noLayer', 'Keine Ebene aktiv.'); },
    get 'reason.node.min'() { return tr('reason.node.min', 'Niedrigste Ordnung: 1.'); },
    'reason.node.max.square': function (n) { return tr('reason.node.max.square', 'Höchste Ordnung beim Quadrat: ' + n + '.', { n: n }); },
    'reason.node.max.other': function (n) { return tr('reason.node.max.other', 'Höchste Ordnung bei dieser Form: ' + n + '.', { n: n }); },
    get 'reason.size.min'() { return tr('reason.size.min', 'Kleinste Größe: 1.'); },
    get 'reason.size.max'() { return tr('reason.size.max', 'Größte Größe: 9.'); },
  };
  const $ = function (s) { return document.querySelector(s); };
  const nodeInput = $('#layer-node-count-input'), sizeInput = $('#layer-shape-size-input');
  if (!nodeInput || !sizeInput) return;

  // the active layer (a normal layer, not the base), or null
  function layer() {
    return typeof activeLayer !== 'undefined' && activeLayer !== 'base' && typeof additionalLayers !== 'undefined' && additionalLayers[activeLayer] || null;
  }
  function nodeMax() { const L = layer(); return typeof gridMaxOrdnung === 'function' ? gridMaxOrdnung(L ? L.shape : 'triangle', L && typeof layerGridSpecOf === 'function' ? layerGridSpecOf(L).lage : 1) : 7; }   // task 068c2: the ordnung
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

  // lage (task 068c3b): the active layer-shape button of a lage-2 layer carries the dot (class lage-2) and says "Dreieck, Lage 2. Erneut klicken: Lage 1"; the second click changes the lage
  // (sketch.js toggleLayerLage). No hint on a timeline layer (its lage is locked) or above the lage-2 ceiling.
  const SHAPE_NAME = { triangle: 'Dreieck', square: 'Quadrat', hex: 'Sechseck' };
  const SHAPE_KEY = { triangle: 'layer.shape.triangle', square: 'layer.shape.square', hex: 'layer.shape.hex' };
  function lageText(name, n, m) { return tr('shape.lage.state', name + ', Lage ' + n + '. Erneut klicken: Lage ' + m, { name: name, n: n, m: m }); }
  function inTimeline(L) {
    if (typeof timeline === 'undefined' || !timeline) return false;
    const i = additionalLayers.indexOf(L);
    return timeline.keyframeLayerIds.indexOf(i) >= 0 || timeline.playbackLayerIndex === i;
  }
  function syncLage() {
    if (typeof layerGridSpecOf !== 'function' || typeof lage2SwitchOn !== 'function') return;
    const L = layer(), spec = L ? layerGridSpecOf(L) : null;
    document.querySelectorAll('.layer-shape-icon-btn').forEach(function (b) {
      const shape = b.getAttribute('data-shape'), on = !!L && b.classList.contains('active');
      const dot = on && spec.lage === 2;
      if (b.classList.contains('lage-2') !== dot) b.classList.toggle('lage-2', dot);
      let text = tr(SHAPE_KEY[shape], SHAPE_NAME[shape]);
      if (on && lage2SwitchOn() && !inTimeline(L)) {
        if (spec.lage === 2) text = lageText(text, 2, 1);
        else if (spec.ordnung <= maxOrdnungFor(shape, 2)) text = lageText(text, 1, 2);
      }
      UI.name(b, text);
    });
  }

  UI.onSync(function () { steppers.forEach(function (s) { s.refresh(); }); syncLage(); });
})();
