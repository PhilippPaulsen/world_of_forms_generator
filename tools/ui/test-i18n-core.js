// Guard for the core texts that go through the dictionary (task 050): the two net-kind notes of sketch.js (applyNetKindChoice) and the harmony-rule labels of core/color.js.
// German stays CHARACTER-EQUAL to the old text with the dictionary (de) AND without it (the fallback written in sketch.js); the English reads as specified; the parameters are named.
//   node tools/ui/test-i18n-core.js
//   UI_I18N_JS=... SKETCH_JS=... COLOR_JS=... node tools/ui/test-i18n-core.js      (sabotage runs on copies)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const src = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };

// ---- the OLD German of sketch.js (reference) ----
const oldMin = from => `Sin und Tan brauchen mindestens 4 Knoten; Knoten von ${from} auf 4 gesetzt.`;
const oldOdd = R => `Feld braucht eine ungerade Größe (3, 5, 7, 9); ${R} passt nicht, deshalb Einzelnetz. Die Größe bleibt ${R}.`;

// applyNetKindChoice cut out of sketch.js and run alone with stubs; mode: 'none' (no UI: fallback), 'de', 'en'
const sk = src('SKETCH_JS', 'sketch.js');
const a = sk.indexOf('function applyNetKindChoice('), b = sk.indexOf('\n        function commit()', a);
check('sketch.js: applyNetKindChoice found', a > 0 && b > a);
function run(mode, kind, fromRegular, nodeCount, R) {
    const ctx = vm.createContext({ console }); ctx.window = ctx; ctx.Event = function () {};
    const toasts = [];
    if (mode !== 'none') {
        vm.runInContext(src('UI_I18N_JS', 'ui-i18n.js'), ctx, { filename: 'ui-i18n.js' });
        ctx.uiI18n.setLang(mode);
        ctx.UI = { t: (k, p) => ctx.uiI18n.t(k, p), toast: m => toasts.push(m) };
    } else ctx.UI = { toast: m => toasts.push(m) };
    Object.assign(ctx, { ui: {}, shapeSizeFactor: R, nodeCount, nodeInput: { value() {}, elt: { dispatchEvent() {} } }, setDomain() {}, netDomainEffective: () => ({ ignored: R % 2 ? null : 'even' }) });
    vm.runInContext(sk.slice(a, b) + '\napplyNetKindChoice(' + JSON.stringify(kind) + ', ' + fromRegular + ');', ctx, { filename: 'sketch.js' });
    return toasts[0];
}
console.log('== German equals the old text (dictionary on, dictionary off) ==');
[2, 3].forEach(n => { const w = oldMin(n); check('minNodes from ' + n + ': dictionary de = old', run('de', 'sinus', false, n, 5) === w, run('de', 'sinus', false, n, 5)); check('minNodes from ' + n + ': fallback = old', run('none', 'tangens', false, n, 5) === w, run('none', 'tangens', false, n, 5)); });
[2, 4, 6].forEach(R => { const w = oldOdd(R); check('fieldOddSize ' + R + ': dictionary de = old', run('de', 'geo', true, 9, R) === w, run('de', 'geo', true, 9, R)); check('fieldOddSize ' + R + ': fallback = old', run('none', 'geo', true, 9, R) === w, run('none', 'geo', true, 9, R)); });
console.log('== English ==');
check('minNodes en', run('en', 'sinus', false, 3, 5) === 'Sin and Tan need at least 4 nodes; nodes changed from 3 to 4.', run('en', 'sinus', false, 3, 5));
check('fieldOddSize en', run('en', 'geo', true, 9, 4) === 'Field needs an odd size (3, 5, 7, 9); 4 does not fit, so single net. The size stays 4.', run('en', 'geo', true, 9, 4));
check('no {placeholder} is left in the English notes', !/[{}]/.test(run('en', 'sinus', false, 3, 5) + run('en', 'geo', true, 9, 4)));

// ---- core/color.js rules ----
const ctx = vm.createContext({ console }); ctx.window = ctx;
vm.runInContext(src('UI_I18N_JS', 'ui-i18n.js'), ctx, { filename: 'ui-i18n.js' });
vm.runInContext(src('COLOR_JS', 'core/color.js') + '\n;this.__rules = listHarmonyRules();', ctx, { filename: 'color.js' });
const rules = Object.fromEntries(ctx.__rules.map(r => [r.id, r]));
const T = ctx.uiI18n;
const WANT = [
    ['isotint', r => r, 'Isotints (Weißgleiche)', 'Isotints'],
    ['isotone', r => r, 'Isotones (Schwarzgleiche)', 'Black (isotints)'],
    ['shadow-series', r => r, 'Shadow series (Schattenreihe)', 'Shadow series'],
    ['max-contrast-gray', r => r.params.find(p => p.id === 'direction'), 'Richtung', 'Direction']
];
console.log('== core/color.js: label stays the German text, key gives de = label and the English ==');
WANT.forEach(([id, pick, de, en]) => {
    const o = rules[id] && pick(rules[id]);
    check(id + ': label unchanged', !!o && o.label === de, o && o.label);
    check(id + ': has an i18n key in the dictionary', !!o && !!o.i18n && T.has(o.i18n), o && o.i18n);
    T.setLang('de'); const gotDe = o && o.i18n ? T.t(o.i18n) : null;
    T.setLang('en'); const gotEn = o && o.i18n ? T.t(o.i18n) : null; T.setLang('de');
    check(id + ': dictionary de = label (character-equal)', gotDe === de, gotDe);
    check(id + ': English = ' + en, gotEn === en, gotEn);
});
console.log('\n' + (failures ? 'FAIL' : 'PASS') + ': ' + (checks - failures) + '/' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
