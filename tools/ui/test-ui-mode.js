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
    check('the two constants of core/state.js: a new visitor starts simple, a saved session without the field reads advanced (decision F1)', dflt === 'simple' && legacy === 'advanced');
}

console.log('\n== the Plus button ==');
function plusPage(initial, lang) {
    const a = { title: 'T', 'aria-label': 'T', 'aria-pressed': 'x' }, cl = new Set(), h = {}, docL = {};
    const btn = { a, cl, h, focused: 0, classList: { toggle: (c, on) => { on ? cl.add(c) : cl.delete(c); } }, getAttribute: k => a[k], setAttribute: (k, v) => { a[k] = v; }, addEventListener: (t, f) => { h[t] = f; }, focus() { this.focused++; } };
    const attrs = {};
    const document = { readyState: 'complete', documentElement: { setAttribute: (k, v) => { attrs[k] = v; } },
        dispatchEvent: e => { (docL.modechange || []).forEach(f => f(e)); }, addEventListener: (t, f) => { (docL[t] = docL[t] || []).push(f); },
        getElementById: id => id === 'btn-mode-plus' ? btn : null };
    const D = { 'mode.plus.off': { de: 'Weitere Bedienelemente: aus', en: 'More controls: off' }, 'mode.plus.on': { de: 'Weitere Bedienelemente: an', en: 'More controls: on' }, 'mode.advancedActive': { de: 'Erweiterte Einstellungen aktiv', en: 'Advanced settings active' } };
    const win = { UI: { onSync() {}, lang, t: k => D[k][(win.uiI18n && win.uiI18n.lang) || win.UI.lang] }, sessionWriter: { markDirty() {} } };
    const ctx = vm.createContext({ window: win, document, location: { search: '' }, CustomEvent: function (t, o) { this.detail = o.detail; }, URLSearchParams, console });
    vm.runInContext(`let uiMode = '${initial}'; let additionalLayers = []; let timeline = null; let curveType = { kind: 'straight' };`, ctx);
    vm.runInContext(read('ui-mode.js'), ctx, { filename: 'ui-mode.js' });
    return { btn, attrs, win, ctx, mode: () => vm.runInContext('uiMode', ctx) };
}
{
    const p = plusPage('simple', 'de'), b = p.btn;
    check('simple: not pressed, not filled, the name says "aus" (title = aria-label)', b.a['aria-pressed'] === 'false' && !b.cl.has('active') && b.a.title === 'Weitere Bedienelemente: aus' && b.a['aria-label'] === b.a.title);
    b.h.click();
    check('a click switches to advanced: pressed, filled, "an", the global and the attribute follow, the focus stays on the button', p.mode() === 'advanced' && p.attrs['data-mode'] === 'advanced' && b.a['aria-pressed'] === 'true' && b.cl.has('active') && b.a.title === 'Weitere Bedienelemente: an' && b.focused === 1);
    b.h.click();
    check('a second click switches back to simple', p.mode() === 'simple' && b.a['aria-pressed'] === 'false' && !b.cl.has('active') && b.a.title === 'Weitere Bedienelemente: aus' && b.focused === 2);
    p.win.UI.lang = 'en'; p.win.uiModeApi.syncButton();
    check('a language change re-sets the name on the next tick: "More controls: off"', b.a.title === 'More controls: off' && b.a['aria-label'] === 'More controls: off');
    b.h.click();
    check('...and "More controls: on" in English', b.a.title === 'More controls: on');
    vm.runInContext("uiMode = 'simple';", p.ctx); p.win.uiModeApi.syncButton();
    check('a change of the global from outside (a session restore) updates the button on the next tick', b.a['aria-pressed'] === 'false' && !b.cl.has('active'));
    // task 138: UI.lang is copied at load; the LIVE language is uiI18n.lang
    const p3 = plusPage('simple', 'de'); p3.win.uiI18n = { lang: 'en' }; p3.win.uiModeApi.syncButton();
    check('the name follows uiI18n.lang (live) even while UI.lang is still the value copied at load', p3.btn.a.title === 'More controls: off', p3.btn.a.title);
    p3.win.uiI18n.lang = 'de'; p3.win.uiModeApi.syncButton();
    check('...and back to German', p3.btn.a.title === 'Weitere Bedienelemente: aus');
    const p2 = plusPage('advanced', 'de');
    check('at load in advanced: pressed and filled', p2.btn.a['aria-pressed'] === 'true' && p2.btn.cl.has('active') && p2.btn.a.title === 'Weitere Bedienelemente: an');
    const html = read('index.html');
    const tag = (/<button id="btn-mode-plus"[^>]*>/.exec(html) || [''])[0];
    check('the markup: a button.icon-btn.mode-plus, type=button, aria-pressed, a title and aria-label with the default text, the same 18px ring (circle r=10) with a plus as Help, BEFORE Help in the header', /class="icon-btn mode-plus"/.test(tag) && /type="button"/.test(tag) && /aria-pressed="false"/.test(tag) && /title="Weitere Bedienelemente: aus"/.test(tag) && /aria-label="Weitere Bedienelemente: aus"/.test(tag)
        && /id="btn-mode-plus"[\s\S]*?<circle cx="12" cy="12" r="10"><\/circle><path d="M12 8v8M8 12h8"[\s\S]*?id="btn-help"/.test(html) && !/btn-mode-simple|btn-mode-advanced|mode-switch/.test(html.replace(/btn-mode-(none|spiegeling|drehling)/g, '')));
    check('the Help overlay explains the Plus (data-i18n="help.plus")', /<li data-i18n="help\.plus">Plus:/.test(html));
}

console.log('\n== advancedActive (the dot) ==');
{
    const A = page('', 'simple').api.advancedActive;
    const base = () => ({ additionalLayers: [], timeline: null, shapeSizeFactorX: null, shapeSizeFactorY: null, currentShape: 'hex', symmetryMode: 'rotation_reflection6', curveType: { kind: 'straight' }, freeEndpointsEnabled: false,
        altNetSeed: null, baseNetTransform: null, baseLastHarmonyType: null, baseDistributionStrategy: null, lineStyle: { visible: true, weight: 2 }, spatialMorph: { enabled: false, mode: 'linear', angleDeg: 0 } });
    check('the default state (what a new visitor has) is not advanced', A(base()) === false);
    check('garbage in is false, never a throw', [undefined, null, 5, 'x', [], {}].every(v => A(v) === false));
    const one = (name, patch, want) => check(`${name}: ${want ? 'advanced' : 'not advanced'}`, A(Object.assign(base(), patch)) === want);
    one('a layer', { additionalLayers: [{}] }, true);
    one('a timeline', { timeline: { keyframeLayerIds: [] } }, true);
    one('size 5 x 5 (the same twice)', { shapeSizeFactorX: 5, shapeSizeFactorY: 5 }, false);
    one('size 5 x 3', { shapeSizeFactorX: 5, shapeSizeFactorY: 3 }, true);
    one('the hexagon with the 3-fold (rotation_reflection3)', { symmetryMode: 'rotation_reflection3' }, true);
    one('the hexagon with rotation3', { symmetryMode: 'rotation3' }, true);
    one('the triangle with a 3-fold mode (not set under Mehr: the fold choice is the hexagon\'s)', { currentShape: 'triangle', symmetryMode: 'rotation_reflection3' }, false);
    one('curve', { curveType: { kind: 'curve' } }, true);
    one('free', { curveType: { kind: 'free' } }, true);
    one('free endpoints', { freeEndpointsEnabled: true }, true);
    one('an alternative net seed', { altNetSeed: { seed: 1 } }, true);
    one('Sin, both axes, single (what the simple view makes)', { baseNetTransform: { x: { kind: 'trig', w: 0.5 }, y: 'same', repeat: false, macro: undefined, domain: undefined } }, false);
    one('Geo with a focus of 0', { baseNetTransform: { x: { kind: 'geometric', w: 1, focus: 0 }, y: 'same', repeat: false } }, false);
    one('a net with a focus', { baseNetTransform: { x: { kind: 'trig', w: 0.5, focus: 0.3 }, y: 'same', repeat: false } }, true);
    one('a net with alternate', { baseNetTransform: { x: { kind: 'geometric', w: 1, alternate: true }, y: 'same' } }, true);
    one('a net on one axis', { baseNetTransform: { x: { kind: 'trig', w: 0.5 }, y: { kind: 'trig', w: 0.2 } } }, true);
    one('a tiled net', { baseNetTransform: { x: { kind: 'trig', w: 0.5 }, y: 'same', repeat: true } }, true);
    one('a field net', { baseNetTransform: { x: { kind: 'trig', w: 0.5 }, y: 'same', repeat: false, domain: 'field' } }, true);
    one('a macro', { baseNetTransform: { x: { kind: 'trig', w: 0.5 }, y: 'same', macro: 3 } }, true);
    one('a Moebius net', { baseNetTransform: { kind: 'projective', family: '\u25a1N', a: 2, b: 3, format: 'full' } }, true);
    one('a regular net spec', { baseNetTransform: { regular: true } }, false);
    for (const h of ['2', '3', '4']) one('harmony ' + h, { baseLastHarmonyType: h }, false);
    for (const h of ['B', 'W', 'S', 'V', 'custom']) one('harmony ' + h, { baseLastHarmonyType: h }, true);
    one('strategy cyclic', { baseDistributionStrategy: 'cyclic' }, false);
    for (const st of ['area', 'symmetry', 'rings']) one('strategy ' + st, { baseDistributionStrategy: st }, true);
    one('lines off', { lineStyle: { visible: false, weight: 2 } }, true);
    one('line weight 3', { lineStyle: { visible: true, weight: 3 } }, true);
    one('the morph on', { spatialMorph: { enabled: true, mode: 'linear', angleDeg: 0 } }, true);
    // the dot on the page
    const q = plusPage('simple', 'de'), qb = q.btn;
    check('simple, nothing advanced: no dot, the plain name', !qb.cl.has('has-state') && qb.a.title === 'Weitere Bedienelemente: aus');
    vm.runInContext("additionalLayers = [{}];", q.ctx); q.win.uiModeApi.syncButton();
    check('simple + a layer: the dot, and the sentence in the title and the aria-label', qb.cl.has('has-state') && qb.a.title === 'Weitere Bedienelemente: aus (Erweiterte Einstellungen aktiv)' && qb.a['aria-label'] === qb.a.title);
    qb.h.click();
    check('advanced mode: no dot even with the layer (nothing is hidden), the plain "an"', !qb.cl.has('has-state') && qb.a.title === 'Weitere Bedienelemente: an');
    qb.h.click(); vm.runInContext("additionalLayers = [];", q.ctx); q.win.uiModeApi.syncButton();
    check('back to simple without a layer: the dot is gone again', !qb.cl.has('has-state') && qb.a.title === 'Weitere Bedienelemente: aus');
}

console.log('\n== the face-fill reasons in the simple view ==');
{
    const sk = read('sketch.js');
    const m = sk.match(/function faceFillsUnavailableReason\(\) \{[\s\S]*?\n\}\n/);
    check('the function is found in sketch.js', !!m);
    const run = (mode, nw, curve) => {
        const ctx = vm.createContext({ netWarpBaseNow: () => nw, curveType: { kind: curve }, activeLayer: 'base', additionalLayers: [], UI: { t: k => 'T:' + k }, console });
        vm.runInContext(`let uiMode = '${mode}';`, ctx);
        vm.runInContext(m[0], ctx);
        return vm.runInContext('faceFillsUnavailableReason()', ctx);
    };
    check('simple + a Single net: the Off sentence (dictionary key), no word of "Field" or "Mehr"', run('simple', { field: false }, 'straight') === 'T:reason.fill.netSimple');
    check('advanced + a Single net: the old sentence, unchanged (it names Field)', /Use Field/.test(run('advanced', { field: false }, 'straight')));
    check('simple + curve: the advanced-view sentence', run('simple', null, 'curve') === 'T:reason.fill.curveSimple');
    check('advanced + curve: the old sentence, unchanged (under Mehr)', /under Mehr/.test(run('advanced', null, 'curve')));
    check('simple, straight lines, no net: no reason', run('simple', null, 'straight') === null);
}

console.log('\n== wiring ==');
{
    const ff = read('ui-farbe.js'), ap = read('color-harmony/ui/app.mjs');
    check('task 138: the Farbe-tab link to the Farborgel adds &lang=en only while the Studio is English (German adds nothing: the URLs and their tests stay as they were)', /farborgelPageUrl\(anchorFor\(activeLayer\), GENERATOR_TAB_ID\) \+ \(window\.uiI18n && window\.uiI18n\.lang === 'en' \? '&lang=en' : ''\)/.test(ff));
    check('task 138: the Farborgel page opens in English for ?lang=en and keeps DEFAULT_LOCALE otherwise (it never throws)', /get\('lang'\)==='en'\?transition\(state,\{type:'locale',value:'en'\}\):state/.test(ap) && /withLocale\(createState\(anchorOverridesFromSearch/.test(ap));
    const dict = require('../../ui-i18n.js').DICT;
    check('task 138: the five help keys exist in both languages and the markup uses each once', ['help.what', 'help.title', 'help.use1', 'help.use2', 'help.use3', 'help.plus'].every(k => dict[k] && dict[k].de && dict[k].en && (read('index.html').match(new RegExp('data-i18n="' + k.replace('.', '\\.') + '"', 'g')) || []).length === 1));

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
