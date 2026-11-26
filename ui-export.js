/*
 * The name field of the Download dialog (task 144): #export-name in #export-overlay. UI only; the state is the global exportName (core/state.js, raw text), saved in the session as
 * settings.exportName (core/session.js) and read by core/export.js (exportFileStem(): cleaned for the file system, empty = the old names world_of_forms.*; buildExportData(): `title`).
 *   - typing writes exportName and tells the autosave writer (a change of the name alone does not redraw);
 *   - a session restore (or anything else) that replaced the value shows in the field on the next UI tick (the field is not touched while it has the focus);
 *   - the placeholder shows the file name that an empty field gives, in the current language (the stem is the same in both).
 * Loaded after ui-rail.js (it needs UI.onSync); kept out of sketch.js on purpose (pinned by tests).
 */
(function () {
  const input = document.getElementById('export-name');
  if (!input || typeof exportName === 'undefined') return;
  let seen = exportName, phKey = null;
  function show() {
    if (document.activeElement !== input && input.value !== exportName) input.value = exportName;
    const l = (typeof window !== 'undefined' && window.uiI18n) ? window.uiI18n.lang : '', key = l;
    if (key !== phKey && typeof UI !== 'undefined' && UI.t) { phKey = key; input.setAttribute('placeholder', UI.t('export.name.placeholder')); }
  }
  input.addEventListener('input', function () {
    exportName = input.value; seen = exportName;
    try { if (window.sessionWriter) window.sessionWriter.markDirty(); } catch (e) { /* the next draw marks it anyway */ }
  });
  if (typeof UI !== 'undefined' && UI.onSync) UI.onSync(function () {
    if (exportName !== seen) { seen = exportName; }   // replaced from outside (a session restore): the field follows
    show();
  });
  show();
})();
