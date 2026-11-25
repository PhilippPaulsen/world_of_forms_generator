/*
 * The interface mode (task 133). 'advanced' = every control, 'simple' = the few self-explanatory ones. A VIEW setting: it never changes what is drawn.
 *
 *   html[data-mode="simple" | "advanced"]   written here (the same pattern as html[data-tab] in nav.js); style.css hides [data-level="advanced"] under simple
 *   uiMode (core/state.js)                  the one state; saved in the session as settings.uiMode (core/session.js), restored by core/session-apply.js
 *   ?mode=simple | advanced                 a valid value wins over the session and over the default (applyQuery(), called by sketch.js after the restore)
 *   order at a page load                    ?mode > the restored session > UI_MODE_NEW_VISITOR (a session without the field restores UI_MODE_LEGACY)
 *
 *   window.uiModeApi = { MODES, get(), set(mode), applyQuery([search]), parseModeParam(search), advancedActive(state), syncDot() }
 *   advancedActive(state)  true when a setting is on that the simple view cannot show (layers, timeline, X != Y, 3-fold, curve / free, a net beyond law + strength, Dreieck colours, a
 *                          distribution, a line style, the morph): the Erweitert button gets a dot while the mode is simple. No reset, no switch (task 133, plan 3.4).
 *   'modechange' on document, detail { mode }: fired when the attribute changes (a click, ?mode=, a session restore - sync() runs on every UI.onSync tick).
 *
 * UI only: no generator state except the one global uiMode is read or written here.
 */
(function () {
  'use strict';
  var MODES = ['simple', 'advanced'];
  var shown = null;

  function parseModeParam(search) {
    try { var v = new URLSearchParams(search || '').get('mode'); return MODES.indexOf(v) >= 0 ? v : null; } catch (e) { return null; }
  }
  function get() {
    return (typeof uiMode === 'string' && MODES.indexOf(uiMode) >= 0) ? uiMode : 'advanced';
  }
  function sync() {
    var m = get();
    if (m === shown) return false;
    shown = m;
    document.documentElement.setAttribute('data-mode', m);
    document.dispatchEvent(new CustomEvent('modechange', { detail: { mode: m } }));
    return true;
  }
  function set(m) {
    if (MODES.indexOf(m) < 0) return false;
    if (typeof uiMode !== 'undefined') uiMode = m;
    sync();
    try { if (window.sessionWriter) window.sessionWriter.markDirty(); } catch (e) { /* the next draw marks it anyway */ }
    return true;
  }
  function applyQuery(search) {
    var q = parseModeParam(search === undefined ? location.search : search);
    if (q) set(q); else sync();
    return q;
  }

  // ---- advancedActive: is a setting on that the simple view cannot show or change? ------------------------------------------------------------------------------
  // A pure function of a state-like object (the globals of core/state.js; the symmetry fold comes from `s.symmetryFold`). True = a dot on the Erweitert button while the
  // mode is simple. Nothing is reset and nothing switches the mode: the picture is always the whole pattern (plan A3, 3.4). The list is the plan's: every control of
  // index.html data-level="advanced" that holds a value is covered by one line here (the layer / timeline strips by "has layers" / "has a timeline").
  function netIsAdvanced(n) {
    if (!n || typeof n !== 'object') return false;
    if (n.kind === 'projective') return true;                                   // the Moebius net (Netzart 3C): a, b, format are advanced controls
    if (n.regular === true) return false;
    if (n.y !== undefined && n.y !== 'same') return true;                       // one axis only (Achsen)
    if (n.repeat === true || n.macro !== undefined || (n.domain !== undefined && n.domain !== 'single')) return true;   // Gekachelt / Feld / Macro
    var ax = [n.x, n.y && typeof n.y === 'object' ? n.y : null];
    return ax.some(function (a) { return a && ((typeof a.focus === 'number' && a.focus !== 0) || a.alternate === true); });   // Fokus, Alternieren
  }
  function advancedActive(s) {
    if (!s || typeof s !== 'object') return false;
    if (Array.isArray(s.additionalLayers) && s.additionalLayers.length > 0) return true;
    if (s.timeline) return true;
    if (typeof s.shapeSizeFactorX === 'number' && typeof s.shapeSizeFactorY === 'number' && s.shapeSizeFactorX !== s.shapeSizeFactorY) return true;
    if (s.currentShape === 'hex' && /^rotation(_reflection)?3$/.test(String(s.symmetryMode))) return true;   // the 3-fold, set under Mehr
    if (s.curveType && s.curveType.kind !== undefined && s.curveType.kind !== 'straight') return true;
    if (s.freeEndpointsEnabled === true || s.altNetSeed) return true;
    if (netIsAdvanced(s.baseNetTransform)) return true;
    if (s.baseLastHarmonyType !== null && s.baseLastHarmonyType !== undefined && ['2', '3', '4'].indexOf(String(s.baseLastHarmonyType)) < 0) return true;   // Dreieck families, a Farborgel selection
    if (s.baseDistributionStrategy !== null && s.baseDistributionStrategy !== undefined && s.baseDistributionStrategy !== 'cyclic') return true;
    if (s.lineStyle && (s.lineStyle.visible === false || s.lineStyle.weight !== 2)) return true;
    if (s.spatialMorph && s.spatialMorph.enabled === true) return true;
    return false;
  }
  function liveState() {   // the globals of core/state.js, each read only when it exists (a page without one of them just does not count it)
    return {
      additionalLayers: typeof additionalLayers !== 'undefined' ? additionalLayers : undefined, timeline: typeof timeline !== 'undefined' ? timeline : undefined,
      shapeSizeFactorX: typeof shapeSizeFactorX !== 'undefined' ? shapeSizeFactorX : undefined, shapeSizeFactorY: typeof shapeSizeFactorY !== 'undefined' ? shapeSizeFactorY : undefined,
      currentShape: typeof currentShape !== 'undefined' ? currentShape : undefined, symmetryMode: typeof symmetryMode !== 'undefined' ? symmetryMode : undefined,
      curveType: typeof curveType !== 'undefined' ? curveType : undefined, freeEndpointsEnabled: typeof freeEndpointsEnabled !== 'undefined' ? freeEndpointsEnabled : undefined,
      altNetSeed: typeof altNetSeed !== 'undefined' ? altNetSeed : undefined, baseNetTransform: typeof baseNetTransform !== 'undefined' ? baseNetTransform : undefined,
      baseLastHarmonyType: typeof baseLastHarmonyType !== 'undefined' ? baseLastHarmonyType : undefined,
      baseDistributionStrategy: typeof baseDistributionStrategy !== 'undefined' ? baseDistributionStrategy : undefined,
      lineStyle: typeof lineStyle !== 'undefined' ? lineStyle : undefined, spatialMorph: typeof spatialMorph !== 'undefined' ? spatialMorph : undefined
    };
  }
  var dotKey = null;
  // the dot: .has-state on the Erweitert button (the same corner dot as .nav-more.has-state, style.css) and the sentence in its title, only while the mode is simple
  function syncDot() {
    if (typeof document.getElementById !== 'function') return false;
    var b = document.getElementById('btn-mode-advanced');
    if (!b) return false;
    var on = get() === 'simple' && advancedActive(liveState());
    var lang = window.UI && typeof window.UI.lang === 'string' ? window.UI.lang : (window.UI && window.UI.lang && window.UI.lang()) || '';
    var key = (on ? '1' : '0') + lang;
    if (key === dotKey) return false;
    dotKey = key;
    b.classList.toggle('has-state', on);
    var t = window.UI && typeof window.UI.t === 'function' ? window.UI.t : null;
    var base = t ? t('mode.advanced.title') : b.getAttribute('title') || '';
    var note = t ? t('mode.advancedActive') : 'Erweiterte Einstellungen aktiv';
    b.setAttribute('title', on ? base + ' (' + note + ')' : base);
    return true;
  }

  // the switch in the header (index.html #mode-switch): aria-pressed follows the mode on every change; a click sets it. Bound at DOMContentLoaded (the markup comes
  // before the scripts, but the check keeps the file usable on a page without the switch).
  function bindSwitch() {
    if (typeof document.getElementById !== 'function') return;
    var root = document.getElementById('mode-switch');
    if (!root) return;
    var buttons = Array.prototype.slice.call(root.querySelectorAll('button[data-mode]'));
    function show() { buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === get() ? 'true' : 'false'); }); }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { set(b.getAttribute('data-mode')); b.focus(); });
    });
    document.addEventListener('modechange', function () { show(); dotKey = null; syncDot(); });
    show();
  }

  window.uiModeApi = { MODES: MODES, get: get, set: set, applyQuery: applyQuery, parseModeParam: parseModeParam, advancedActive: advancedActive, syncDot: syncDot };

  // as early as this script runs: the attribute and the global follow ?mode= (the session restore in setup() may replace the global; applyQuery() then puts the query back)
  var q0 = parseModeParam(location.search);
  if (q0 && typeof uiMode !== 'undefined') uiMode = q0;
  sync();
  if (typeof document.addEventListener === 'function') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindSwitch); else bindSwitch();
  }
  if (window.UI && typeof window.UI.onSync === 'function') window.UI.onSync(function () { var changed = sync(); syncDot(); return changed; });
})();
