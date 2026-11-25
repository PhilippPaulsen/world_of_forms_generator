/*
 * The interface mode (task 133). 'advanced' = every control, 'simple' = the few self-explanatory ones. A VIEW setting: it never changes what is drawn.
 *
 *   html[data-mode="simple" | "advanced"]   written here (the same pattern as html[data-tab] in nav.js); style.css hides [data-level="advanced"] under simple
 *   uiMode (core/state.js)                  the one state; saved in the session as settings.uiMode (core/session.js), restored by core/session-apply.js
 *   ?mode=simple | advanced                 a valid value wins over the session and over the default (applyQuery(), called by sketch.js after the restore)
 *   order at a page load                    ?mode > the restored session > UI_MODE_NEW_VISITOR (a session without the field restores UI_MODE_LEGACY)
 *
 *   window.uiModeApi = { MODES, get(), set(mode), applyQuery([search]), parseModeParam(search) }
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
    document.addEventListener('modechange', show);
    show();
  }

  window.uiModeApi = { MODES: MODES, get: get, set: set, applyQuery: applyQuery, parseModeParam: parseModeParam };

  // as early as this script runs: the attribute and the global follow ?mode= (the session restore in setup() may replace the global; applyQuery() then puts the query back)
  var q0 = parseModeParam(location.search);
  if (q0 && typeof uiMode !== 'undefined') uiMode = q0;
  sync();
  if (typeof document.addEventListener === 'function') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindSwitch); else bindSwitch();
  }
  if (window.UI && typeof window.UI.onSync === 'function') window.UI.onSync(sync);
})();
