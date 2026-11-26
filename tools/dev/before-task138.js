/*
 * tools/dev/before-task138.js - task 142b: core/session-store.js as it was BEFORE task 138 (the href comparison ignores ?lang=).
 * The old "core unchanged against the base of task NNN" tests compare files with a historic tree; task 138 changed this one file on purpose, so they compare it through this
 * function: it removes exactly the three things task 138 added (the _sessionStripLang / _sessionSameHref block, the call in sessionShouldRestore, a half sentence of the header).
 */
module.exports = function beforeTask138(text) {
    return text
        .replace(/\/\/ task 138: the language is a VIEW setting[\s\S]*?function _sessionSameHref\([^\n]*\n/, '')
        .replace('!_sessionSameHref(o.snapshotHref, o.currentHref)', '_sessionStripHash(o.snapshotHref) !== _sessionStripHash(o.currentHref)')
        .replace(' (the comparison also ignores a `lang` parameter, task 138)', '');
};
