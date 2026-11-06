/*
 * The Morph button and block (morph stage e2a). UI only: the model is the project's morph block (core/state.js spatialMorph), read through window.getSpatialMorph() and written through window.setSpatialMorph(patch)
 * (sketch.js, stage e1), and the status of the last frame, window.spatialMorphStatus() (core/spatial-morph-render.js). This view keeps NO reference into the model: it reads a copy on every UI.onSync tick and writes the
 * DOM only when a signature of what it shows changed. Nothing here draws, saves or reads the timeline.
 *
 *   button    "Morph", an icon button next to "..." in each of the three layer views (the strip: eye, diamond, "...", Morph, x; the rail: the same order in its action group; the table's foot: "+", "...", Morph). Enabled whatever
 *             sheet is active (the morph is a project setting), the dot of the Form "Mehr" button (.nav-more.has-state) while the morph is on. The views are built ONCE by ui-layers.js (their action groups are static cells; only the
 *             layer chips are rebuilt), so the buttons are inserted once; ensureButtons() runs again on every tick and adds one only where a view has none (never twice), and does nothing before the views exist.
 *   block     #morph-group (index.html): row 1 on/off + the three modes (radiogroup), row 2 the angle stepper (ALWAYS there with its height: operable for linear, dimmed and aria-disabled for radial and bilinear, never hidden: nothing below it moves), row 3 the status line (one line, reserved height).
 *             Its open state is the class mo-open on the group (like ts-open of the timeline group): the buttons flip it, the engine's sheet follows it below 768px (config.sheets.morph), the CSS shows the block under the canvas from
 *             768px. Escape inside the block closes it from 768px (below, the sheet does) and gives the focus back to the visible button.
 *   status    one line of at most 40 characters: the error codes first, then "seam open", then "net warps lines" / "faces in the morph only with a field net" / "bilinear without time progress"; nothing for 'off' and 'ok'. The texts are the dictionary's (morph.status.*).
 *
 * The pure model (the status text and its priority, the angle step and wrap, the angle label, the signature) loads without a DOM (tools/ui/test-morph-view.js).
 */
(function (root) {
  'use strict';
  const MODES = ['linear', 'radial', 'bilinear'];
  const ANGLE_STEP = 45;
  const ERROR_CODES = ['needsTwoKeyframes', 'shapeMismatch', 'lineCountMismatch', 'parameterMismatch', 'alignmentFailed', 'renderError'];
  const NOTE_CODES = ['netActive', 'netFacesNeedField', 'bilinearStatic'];
  const MAX_STATUS = 40;
  // the German texts (the fallback; the dictionary has both languages under the same keys, ui-i18n.js)
  const T = {
    'morph.status.needsTwoKeyframes': 'Zwei Keyframe-Ebenen nötig',
    'morph.status.shapeMismatch': 'Keyframes: Form verschieden',
    'morph.status.lineCountMismatch': 'Keyframes: Linienzahl verschieden',
    'morph.status.parameterMismatch': 'Keyframes: Größe/Symmetrie verschieden',
    'morph.status.alignmentFailed': 'Zuordnung nicht möglich',
    'morph.status.renderError': 'Morph nicht darstellbar',
    'morph.status.netActive': 'Netz verzerrt Linien',
    'morph.status.netFacesNeedField': 'Flächen im Morph nur bei Feld-Netz',
    'morph.status.bilinearStatic': 'Bilinear: ohne Zeitverlauf',
    'morph.status.seamOpen': 'Naht offen: Ebene {layers}',
    'morph.status.base': 'Basis',
    'morph.button': 'Morph',
    'morph.angle.value': '{deg}°',
    'morph.angle.linearOnly': 'Winkel: nur bei linear',
  };
  let say = function (key, params) {   // the dictionary's text when it has one (the page loads ui-i18n.js first), else the German fallback above
    const i = root.uiI18n;
    let s = i && typeof i.has === 'function' && i.has(key) ? i.t(key, params) : T[key];
    if (typeof s !== 'string') s = String(key);
    if (params && !(i && i.has && i.has(key))) Object.keys(params).forEach(function (k) { s = s.replace('{' + k + '}', params[k]); });
    return s;
  };

  // ---- the pure model -----------------------------------------------------------------------------------------------------------------------------
  // The angle one step on (dir +1 / -1) from `angle`, on the 45 degree grid and wrapped to 0..315 (a block angle that is not on the grid, from a restore or the console, is snapped first).
  function stepAngle(angle, dir) {
    const a = typeof angle === 'number' && isFinite(angle) ? angle : 0;
    const snapped = Math.round(a / ANGLE_STEP) * ANGLE_STEP;
    return (((snapped + (dir < 0 ? -ANGLE_STEP : ANGLE_STEP)) % 360) + 360) % 360;
  }
  function angleLabel(angle) { return say('morph.angle.value', { deg: typeof angle === 'number' && isFinite(angle) ? String(Math.round(angle * 100) / 100) : '0' }); }
  function parseAngle(text) { const v = parseFloat(String(text)); return isFinite(v) ? v : 0; }
  // The layer number a status index names: the running number the layer chips show (layerTable.layerDisplayNumber) when the table is there, else index + 1; -1 is the base sheet.
  function layerName(index, layers) {
    if (index === -1) return say('morph.status.base');
    const lt = root.layerTable;
    const n = lt && typeof lt.layerDisplayNumber === 'function' && Array.isArray(layers) ? lt.layerDisplayNumber(layers, index) : null;
    return String(n !== null && n !== undefined ? n : index + 1);
  }
  // The status line for a status object { code, seamOpen } (spatialMorphStatus()): '' for off / ok; otherwise the FIRST that applies: an error code, a non-empty seamOpen, netActive / bilinearStatic.
  function statusText(status, layers) {
    if (!status || typeof status !== 'object') return '';
    const code = status.code;
    if (ERROR_CODES.indexOf(code) >= 0) return say('morph.status.' + code);
    if (Array.isArray(status.seamOpen) && status.seamOpen.length) return say('morph.status.seamOpen', { layers: status.seamOpen.map(function (i) { return layerName(i, layers); }).join(', ') });
    if (NOTE_CODES.indexOf(code) >= 0) return say('morph.status.' + code);
    return '';
  }
  // A string that changes exactly when what the view shows would: compared on every tick before anything is written.
  function signature(block, text, lang) {
    const b = block || {};
    return [b.enabled ? 1 : 0, b.mode, b.angleDeg, text, lang || ''].join('|');
  }
  const api = { MODES: MODES, ANGLE_STEP: ANGLE_STEP, MAX_STATUS: MAX_STATUS, ERROR_CODES: ERROR_CODES, NOTE_CODES: NOTE_CODES, T: T, stepAngle: stepAngle, angleLabel: angleLabel, parseAngle: parseAngle, statusText: statusText, signature: signature, layerName: layerName,
    setSay: function (f) { say = f; } };
  root.uiMorph = api;

  // ---- the DOM ------------------------------------------------------------------------------------------------------------------------------------
  if (typeof document === 'undefined' || !document.getElementById || typeof UI === 'undefined') return;
  const group = document.getElementById('morph-group');
  if (!group) return;
  const toggle = document.getElementById('morph-toggle'), modesEl = document.getElementById('morph-modes'), angleEl = document.getElementById('morph-angle'), angleInput = document.getElementById('morph-angle-input'), statusEl = document.getElementById('morph-status');
  const radios = MODES.map(function (m) { return document.getElementById('morph-mode-' + m); });
  const html = document.documentElement;
  const angleStops = [angleInput].concat(Array.prototype.slice.call(angleEl.querySelectorAll('.stepper-btn')));   // the three focus stops of the angle row
  function set(patch) { if (typeof window.setSpatialMorph === 'function') window.setSpatialMorph(patch); }
  function blockNow() { return typeof window.getSpatialMorph === 'function' ? window.getSpatialMorph() : { enabled: false, mode: 'linear', angleDeg: 0 }; }
  function statusNow() { return typeof window.spatialMorphStatus === 'function' ? window.spatialMorphStatus() : null; }
  function layersNow() { return typeof additionalLayers !== 'undefined' ? additionalLayers : []; }

  // ---- the buttons in the three layer views ---------------------------------------------------------------------------------------------------
  let open = group.classList.contains('mo-open');
  const buttons = [];
  function makeButton(view) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn lt-morph nav-more' + (view === 'table' ? '' : ' lr-morph');
    b.dataset.morphView = view;
    b.setAttribute('aria-controls', 'morph-group');
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    b.setAttribute('data-i18n', 'morph.button');
    UI.name(b, say('morph.button'));
    b.addEventListener('click', function () { setOpen(!open); });
    buttons.push(b);
    return b;
  }
  // Where each view keeps its action cells: the strip and the rail have .lr-g2 (eye, diamond, "...", x: the button goes before the x), the table's foot (.lt-foot: "+", "...": the button is the third cell).
  function ensureButtons() {
    [['strip', 'layer-strip', '.lr-g2', '.lr-x'], ['rail', 'layer-rail', '.lr-g2', '.lr-x'], ['table', 'layer-table', '.lt-foot', null]].forEach(function (v) {
      const host = document.getElementById(v[1]), g = host && host.querySelector(v[2]);
      if (!g || g.querySelector('.lt-morph')) return;   // the view is not built yet: nothing is touched; or it has its button
      const b = makeButton(v[0]);
      const before = v[3] ? g.querySelector(v[3]) : null;
      if (before) g.insertBefore(b, before); else g.appendChild(b);
      lastSig = null;   // the new button gets its state at once
    });
    for (let i = buttons.length - 1; i >= 0; i--) if (!document.body.contains(buttons[i])) buttons.splice(i, 1);
  }
  function visibleButton() { for (let i = 0; i < buttons.length; i++) if (buttons[i].offsetParent !== null) return buttons[i]; return buttons[0] || null; }
  function setOpen(v) {
    open = !!v;
    group.classList.toggle('mo-open', open);
    buttons.forEach(function (b) { b.setAttribute('aria-expanded', open ? 'true' : 'false'); });
    if (open && root.layerTable && typeof root.layerTable.revealPanel === 'function' && !html.classList.contains('ph')) root.layerTable.revealPanel(group);
  }
  // Escape inside the block closes it from 768px and returns the focus to the button; below 768px the sheet (UI.overlay) owns Escape
  group.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !open || html.classList.contains('ph')) return;
    e.preventDefault();
    setOpen(false);
    const b = visibleButton(); if (b && b.focus) b.focus();
  });

  // ---- the controls -------------------------------------------------------------------------------------------------------------------------------
  toggle.addEventListener('click', function () { set({ enabled: !blockNow().enabled }); sync(); });
  radios.forEach(function (r, i) { if (r) r.addEventListener('click', function () { set({ mode: MODES[i] }); sync(); }); });
  // a radio group: arrows move the selection (and the focus) like the Netz kinds
  if (modesEl) modesEl.addEventListener('keydown', function (e) {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0);
    if (!dir) return;
    e.preventDefault();
    const cur = Math.max(0, MODES.indexOf(blockNow().mode)), next = (cur + dir + MODES.length) % MODES.length;
    set({ mode: MODES[next] }); sync();
    if (radios[next]) radios[next].focus();
  });
  // the angle stepper: UI.stepper with a compute() of its own (45 degree grid, wrap at 360); the input only displays "135°" and the stepper writes it back through the change event
  UI.stepper(angleEl, {
    input: angleInput, noTyping: true, readonly: true, keyEl: angleEl,
    compute: function (dir) { return { to: stepAngle(blockNow().angleDeg, dir) }; },
    format: angleLabel,
  });
  angleInput.addEventListener('change', function () { set({ angleDeg: parseAngle(angleInput.value) }); sync(); });

  // ---- the tick -----------------------------------------------------------------------------------------------------------------------------------
  let lastSig = null;
  function sync() {
    ensureButtons();
    const block = blockNow(), text = statusText(statusNow(), layersNow()), lang = root.uiI18n && root.uiI18n.lang ? root.uiI18n.lang : '';
    const sig = signature(block, text, lang);
    if (sig === lastSig) return;
    lastSig = sig;
    const on = !!block.enabled;
    if (toggle.getAttribute('aria-pressed') !== (on ? 'true' : 'false')) toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (toggle.classList.contains('active') !== on) toggle.classList.toggle('active', on);
    radios.forEach(function (r, i) {
      if (!r) return;
      const sel = MODES[i] === block.mode;
      if (r.getAttribute('aria-checked') !== (sel ? 'true' : 'false')) r.setAttribute('aria-checked', sel ? 'true' : 'false');
      if (r.classList.contains('active') !== sel) r.classList.toggle('active', sel);
      const ti = sel ? '0' : '-1';   // a radiogroup is ONE tab stop (the selected radio); the arrow keys move inside it
      if (r.getAttribute('tabindex') !== ti) r.setAttribute('tabindex', ti);
    });
    const linear = block.mode === 'linear';
    // the angle row keeps its place and height in every mode (stage e2b): for radial and bilinear it is aria-disabled (dimmed by the CSS, no pointer, the reason as its title), without a focus stop
    UI.setDisabled(angleEl, linear ? '' : say('morph.angle.linearOnly'));
    angleStops.forEach(function (e) { if (linear) { if (e.hasAttribute('tabindex')) e.removeAttribute('tabindex'); } else if (e.getAttribute('tabindex') !== '-1') e.setAttribute('tabindex', '-1'); });
    const label = angleLabel(block.angleDeg);
    if (angleInput.value !== label) angleInput.value = label;
    angleEl.style.setProperty('--morph-angle', (typeof block.angleDeg === 'number' && isFinite(block.angleDeg) ? block.angleDeg : 0) + 'deg');
    const shown = text.length > MAX_STATUS ? text.slice(0, MAX_STATUS - 1) + '…' : text;
    if (statusEl.textContent !== shown) statusEl.textContent = shown;
    if (text) { if (statusEl.title !== text) statusEl.title = text; } else if (statusEl.hasAttribute('title')) statusEl.removeAttribute('title');
    buttons.forEach(function (b) { if (b.classList.contains('has-state') !== on) b.classList.toggle('has-state', on); });
  }
  UI.onSync(sync);
  sync();
})(typeof window !== 'undefined' ? window : globalThis);
