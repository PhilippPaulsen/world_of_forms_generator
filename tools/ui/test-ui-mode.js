/*
 * tools/ui/test-ui-mode.js - task 133: ui-mode.js (html[data-mode], ?mode=, the order ?mode > session > default).
 * Runs ui-mode.js in a vm with a stub document; the global `uiMode` is a `let` of the same context, as core/state.js makes it in the page.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.message)); process.exit(1); });

function page(search, initial, opts) {
    opts = opts || {};
    const attrs = {}, events = [], syncFns = [];
    const document = { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } }, dispatchEvent: e => { events.push(e.detail.mode); } };
    const win = { UI: opts.noUI ? undefined : { onSync: fn => syncFns.push(fn) }, sessionWriter: { dirty: 0, markDirty() { this.dirty++; } } };
    const ctx = vm.createContext({ window: win, document, location: { search }, CustomEvent: function (t, o) { this.type = t; this.detail = o.detail; }, URLSearchParams, console });
    vm.runInContext(`let uiMode = ${JSON.stringify(initial)};`, ctx);
    vm.runInContext(read('ui-mode.js'), ctx, { filename: 'ui-mode.js' });
    return { ctx, attrs, events, syncFns, win, api: win.uiModeApi, mode: () => vm.runInContext('uiMode', ctx), setGlobal: v => vm.runInContext(`uiMode = ${JSON.stringify(v)};`, ctx) };
}

console.log('== parseModeParam ==');
{
    const p = page('', 'advanced'), f = p.api.parseModeParam;
    check('simple / advanced are read from the query, with or without other parameters, with or without the leading ?', f('?mode=simple') === 'simple' && f('mode=advanced') === 'advanced' && f('?lang=en&mode=simple&x=1') === 'simple');
    check('anything else is null (case, whitespace, empty, unknown, the old English names, missing)', ['?mode=', '?mode=Simple', '?mode=%20simple', '?mode=basic', '?mode=expert', '?mode=0', '?lang=en', '', undefined, null].every(s => f(s) === null));
    check('a repeated parameter reads the first one', f('?mode=simple&mode=advanced') === 'simple' && f('?mode=bogus&mode=simple') === null);
}

console.log('\n== at load ==');
{
    let p = page('?mode=simple', 'advanced');
    check('?mode=simple at load: the global and the attribute are simple, one modechange', p.mode() === 'simple' && p.attrs['data-mode'] === 'simple' && p.events.length === 1 && p.events[0] === 'simple');
    p = page('?mode=bogus', 'simple');
    check('an invalid ?mode= is ignored: the global is kept, the attribute follows it', p.mode() === 'simple' && p.attrs['data-mode'] === 'simple');
    p = page('', 'advanced');
    check('without ?mode= the attribute follows the global', p.attrs['data-mode'] === 'advanced');
    p = page('', 'garbage');
    check('a garbage global reads as advanced (nothing hidden)', p.attrs['data-mode'] === 'advanced' && p.api.get() === 'advanced');
    p = page('', 'simple', { noUI: true });
    check('without window.UI the script still works (no onSync registration)', p.attrs['data-mode'] === 'simple' && p.syncFns.length === 0);
    p = page('', 'simple');
    check('one sync function is registered with UI.onSync', p.syncFns.length === 1);
}

console.log('\n== set / sync ==');
{
    const p = page('', 'advanced');
    check('set("simple"): returns true, global + attribute + event, the session writer is told', p.api.set('simple') === true && p.mode() === 'simple' && p.attrs['data-mode'] === 'simple' && p.events.at(-1) === 'simple' && p.win.sessionWriter.dirty === 1);
    const n = p.events.length;
    check('set("simple") again: no new event', p.api.set('simple') === true && p.events.length === n);
    check('set() with anything but the two names is refused and changes nothing', ['x', '', null, undefined, 'Simple', 1].every(v => p.api.set(v) === false) && p.mode() === 'simple' && p.attrs['data-mode'] === 'simple' && p.events.length === n);
    p.setGlobal('advanced');
    check('a change of the global from outside (a session restore) shows at the next sync tick: attribute + one event', p.syncFns[0]() === true && p.attrs['data-mode'] === 'advanced' && p.events.at(-1) === 'advanced');
    const m = p.events.length;
    check('the next tick with nothing changed fires nothing', p.syncFns[0]() === false && p.events.length === m);
}

console.log('\n== the order ?mode > session > default ==');
{
    const state = read('core/state.js');
    const dflt = /const UI_MODE_NEW_VISITOR = '(\w+)'/.exec(state)[1], legacy = /const UI_MODE_LEGACY = '(\w+)'/.exec(state)[1];
    // no session, no query: the global is the default
    let p = page('', dflt); p.api.applyQuery();
    check('no session, no ?mode=: the default of a new visitor (UI_MODE_NEW_VISITOR)', p.mode() === dflt && p.attrs['data-mode'] === dflt);
    // a restored session sets the global, then applyQuery runs (sketch.js)
    p = page('', dflt); p.setGlobal('advanced'); p.api.applyQuery();
    check('a restored session (advanced) with no ?mode= stays advanced', p.mode() === 'advanced' && p.attrs['data-mode'] === 'advanced');
    p = page('', 'advanced'); p.setGlobal('simple'); p.api.applyQuery();
    check('a restored session (simple) with no ?mode= stays simple', p.mode() === 'simple' && p.attrs['data-mode'] === 'simple');
    p = page('?mode=advanced', dflt); p.setGlobal('simple'); const q = p.api.applyQuery();
    check('?mode=advanced wins over a restored session that says simple', q === 'advanced' && p.mode() === 'advanced' && p.attrs['data-mode'] === 'advanced');
    p = page('?mode=simple', dflt); p.setGlobal('advanced'); p.api.applyQuery();
    check('?mode=simple wins over a restored session that says advanced', p.mode() === 'simple' && p.attrs['data-mode'] === 'simple');
    p = page('?mode=nonsense', dflt); p.setGlobal('simple'); p.api.applyQuery();
    check('an invalid ?mode= does not beat the session', p.mode() === 'simple');
    check('the two constants of core/state.js are in the two names (the legacy one is advanced)', ['simple', 'advanced'].includes(dflt) && legacy === 'advanced');
}

console.log('\n== wiring ==');
{
    const html = read('index.html'), sk = read('sketch.js');
    const iUI = html.indexOf('src="ui.js?'), iMode = html.indexOf('src="ui-mode.js?'), iSketch = html.indexOf('src="sketch.js?');
    check('index.html loads ui-mode.js after core/state.js and ui.js (UI.onSync exists)', iMode > iUI && iUI > html.indexOf('src="core/state.js?'));
    const iR = sk.indexOf('if (restoreSessionAtStartup()) {'), iQ = sk.indexOf('window.uiModeApi.applyQuery()');
    check('sketch.js applies ?mode= after the session restore chain', iR > 0 && iQ > iR);
    check('sketch.js has no block comment added around it (the old source-text tests strip comments with a regex)', !/\/\*[\s\S]{0,80}uiModeApi/.test(sk));
}
console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? 'PASS' : 'FAIL');
process.exit(failures === 0 ? 0 : 1);
