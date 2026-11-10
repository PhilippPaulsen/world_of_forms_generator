// Guard for the plain table texts that go through the dictionary (task 044): ui-form.js, ui-layer.js, ui-layers.js, ui-net.js, ui-timeline.js. The German stays CHARACTER-EQUAL to the old tables
// (OLD below = the tables as they were before task 044; a function entry for n = 0, 1, 2, 5), with the dictionary (German), after a language switch to English (a getter, not a frozen string) and
// without the dictionary (the fallback written in the script); the English reads as specified.
//   node tools/ui/test-i18n-tables.js
//   UI_I18N_JS=... UI_FORM_JS=... UI_LAYER_JS=... UI_LAYERS_JS=... UI_NET_JS=... UI_TIMELINE_JS=... node tools/ui/test-i18n-tables.js      (sabotage runs)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const ENVS = { 'ui-form.js': 'UI_FORM_JS', 'ui-layer.js': 'UI_LAYER_JS', 'ui-layers.js': 'UI_LAYERS_JS', 'ui-net.js': 'UI_NET_JS', 'ui-timeline.js': 'UI_TIMELINE_JS' };
const src = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };

const OLD = {
 "ui-form.js": {
  "reason.node.min": "Mindestens 1 Knoten.",
  "reason.node.min.trig": "Sin und Tan brauchen mindestens 4 Knoten.",
  "reason.size.min": "Kleinste Größe: 1.",
  "reason.size.max": "Größte Größe: 9.",
  "reason.size.field.min": "Im Feld-Netz sind nur ungerade Größen von 3 bis 9 möglich; 3 ist die kleinste.",
  "reason.fold.hex": "Die Zähligkeit (3 oder 6) gilt nur beim Sechseck.",
  "reason.fold.rotation": "Die Zähligkeit gilt nur mit Drehung.",
  "more.label": "Mehr",
  "more.label.fold3": "Mehr – aktive Zähligkeit: 3"
 },
 "ui-layer.js": {
  "reason.node.min": "Mindestens 1 Knoten.",
  "reason.size.min": "Kleinste Größe: 1.",
  "reason.size.max": "Größte Größe: 9."
 },
 "ui-layers.js": {
  "layers.dia.add": [
   [
    0,
    "Ebene 0 zur Zeitleiste hinzufügen"
   ],
   [
    1,
    "Ebene 1 zur Zeitleiste hinzufügen"
   ],
   [
    2,
    "Ebene 2 zur Zeitleiste hinzufügen"
   ],
   [
    5,
    "Ebene 5 zur Zeitleiste hinzufügen"
   ]
  ],
  "layers.dia.remove": [
   [
    0,
    "Ebene 0 aus der Zeitleiste entfernen"
   ],
   [
    1,
    "Ebene 1 aus der Zeitleiste entfernen"
   ],
   [
    2,
    "Ebene 2 aus der Zeitleiste entfernen"
   ],
   [
    5,
    "Ebene 5 aus der Zeitleiste entfernen"
   ]
  ],
  "layers.dia.none": "Ebene zur Zeitleiste hinzufügen",
  "layers.dia.in": "in der Zeitleiste",
  "layers.dia.out": "nicht in der Zeitleiste",
  "layers.x.none": "Ebene entfernen",
  "layers.chip.inactive": "nicht aktiv",
  "layers.eye.kf.on": "Keyframe, zusätzlich sichtbar",
  "layers.x.name": [
   [
    0,
    "Ebene 0 entfernen"
   ],
   [
    1,
    "Ebene 1 entfernen"
   ],
   [
    2,
    "Ebene 2 entfernen"
   ],
   [
    5,
    "Ebene 5 entfernen"
   ]
  ],
  "layers.add": "Ebene hinzufügen"
 },
 "ui-net.js": {
  "reason.net.notApplicable": "Netz gilt für das Quadrat, Basis-Ebene.",
  "reason.net.needsKind": "Die Stärke gilt für Sin, Tan und Geo.",
  "reason.strength.max": "Größte Stärke: 1,0.",
  "reason.strength.min": "Kleinste Stärke: 0,0.",
  "reason.strength.exact": "Die Stärke liegt zwischen 0,00 und 1,00.",
  "reason.focus.max": "Größter Fokus: 1,0.",
  "reason.focus.min": "Kleinster Fokus: −1,0.",
  "reason.focus.exact": "Der Fokus liegt zwischen −1,00 und 1,00."
 },
 "ui-timeline.js": {
  "timeline.scrub": "Zeitleiste",
  "timeline.net.auto.on": "Netz aufnehmen: automatisch (an)",
  "timeline.net.auto.off": "Netz aufnehmen: automatisch (aus)",
  "timeline.net.always": "Netz aufnehmen: immer",
  "timeline.net.never": "Netz aufnehmen: nie",
  "timeline.net.still": "das Netz bewegt sich nicht mit der Zeitleiste",
  "timeline.clear.title": "Zeitleiste entfernen?",
  "timeline.clear.text": "Alle Keyframes, Linienzuordnungen und Netz-Schnappschüsse der Zeitleiste werden verworfen. Die Ebenen selbst bleiben erhalten. Das lässt sich nicht rückgängig machen.",
  "timeline.dia.title": [
   [
    0,
    "Ebene 0 aus der Zeitleiste entfernen?"
   ],
   [
    1,
    "Ebene 1 aus der Zeitleiste entfernen?"
   ],
   [
    2,
    "Ebene 2 aus der Zeitleiste entfernen?"
   ],
   [
    5,
    "Ebene 5 aus der Zeitleiste entfernen?"
   ]
  ]
 }
};
const EN = {
 "ui-form.js": {
  "reason.node.min": "At least 1 node.",
  "reason.node.min.trig": "Sin and Tan need at least 4 nodes.",
  "reason.size.min": "Smallest size: 1.",
  "reason.size.max": "Largest size: 9.",
  "reason.size.field.min": "In the field net only odd sizes from 3 to 9 are possible; 3 is the smallest.",
  "reason.fold.hex": "The fold (3 or 6) applies to the hexagon only.",
  "reason.fold.rotation": "The fold applies with rotation only.",
  "more.label": "More",
  "more.label.fold3": "More – active fold: 3"
 },
 "ui-layer.js": {
  "reason.node.min": "At least 1 node.",
  "reason.size.min": "Smallest size: 1.",
  "reason.size.max": "Largest size: 9."
 },
 "ui-layers.js": {
  "layers.dia.add": "Add layer 2 to timeline",
  "layers.dia.remove": "Remove layer 2 from timeline",
  "layers.dia.none": "Add layer to timeline",
  "layers.dia.in": "in the timeline",
  "layers.dia.out": "not in the timeline",
  "layers.x.none": "Remove layer",
  "layers.chip.inactive": "not active",
  "layers.eye.kf.on": "Keyframe, also visible",
  "layers.x.name": "Remove layer 2",
  "layers.add": "Add layer"
 },
 "ui-net.js": {
  "reason.net.notApplicable": "The net applies to the square, base layer.",
  "reason.net.needsKind": "The strength applies to Sin, Tan and Geo.",
  "reason.strength.max": "Largest strength: 1.0.",
  "reason.strength.min": "Smallest strength: 0.0.",
  "reason.strength.exact": "The strength is between 0.00 and 1.00.",
  "reason.focus.max": "Largest focus: 1.0.",
  "reason.focus.min": "Smallest focus: −1.0.",
  "reason.focus.exact": "The focus is between −1.00 and 1.00."
 },
 "ui-timeline.js": {
  "timeline.scrub": "Timeline",
  "timeline.net.auto.on": "Record net: automatic (on)",
  "timeline.net.auto.off": "Record net: automatic (off)",
  "timeline.net.always": "Record net: always",
  "timeline.net.never": "Record net: never",
  "timeline.net.still": "the net does not move with the timeline",
  "timeline.clear.title": "Remove timeline?",
  "timeline.clear.text": "All keyframes, line pairings and net snapshots of the timeline will be discarded. The layers themselves are kept. This cannot be undone.",
  "timeline.dia.title": "Remove layer 2 from timeline?"
 }
};   // a function entry is read at n = 2

function loadT(file, withDict, lang) {
    const text = src(ENVS[file], file);
    const a = text.indexOf('const tr = '), b = text.indexOf('\n  };', text.indexOf('const T = {', a));
    if (a < 0 || b < 0) throw new Error(file + ': no "const tr" / T table found');
    const ctx = vm.createContext({ console });
    ctx.window = ctx; ctx.root = ctx;
    if (withDict) {
        vm.runInContext(src('UI_I18N_JS', 'ui-i18n.js'), ctx, { filename: 'ui-i18n.js' });
        if (lang) ctx.uiI18n.setLang(lang);
    }
    return vm.runInContext('(function (window, root) {\n' + text.slice(a, b + 5) + '\nreturn T;\n})(this, this)', ctx, { filename: file });
}
const read = (T, key, want) => Array.isArray(want) ? want.map(p => [p[0], T[key](p[0])]) : T[key];
const same = (got, want) => JSON.stringify(got) === JSON.stringify(want);

console.log('== German equals the old tables (dictionary on, dictionary off) ==');
Object.keys(OLD).forEach(file => {
    let TD, TF;
    try { TD = loadT(file, true); TF = loadT(file, false); } catch (e) { check(file + ': table loads', false, String(e.message).slice(0, 200)); return; }
    const badD = [], badF = [];
    Object.keys(OLD[file]).forEach(key => {
        if (!same(read(TD, key, OLD[file][key]), OLD[file][key])) badD.push(key);
        if (!same(read(TF, key, OLD[file][key]), OLD[file][key])) badF.push(key);
    });
    check(file + ': ' + Object.keys(OLD[file]).length + ' entries, dictionary German = old text', badD.length === 0, badD.join(', '));
    check(file + ': the fallback written in the script = old text', badF.length === 0, badF.join(', '));
});

console.log('== English (the same table object, language switched after loading) ==');
Object.keys(EN).forEach(file => {
    let ctxT;
    try { ctxT = loadT(file, true, 'en'); } catch (e) { check(file + ': loads in English', false, String(e.message).slice(0, 200)); return; }
    const bad = [];
    Object.keys(EN[file]).forEach(key => {
        const got = typeof OLD[file][key] === 'object' ? ctxT[key](2) : ctxT[key];
        if (got !== EN[file][key]) bad.push(key + ': "' + got + '"');
    });
    check(file + ': ' + Object.keys(EN[file]).length + ' English texts as specified', bad.length === 0, bad.join(' ; '));
});
(function () {
    // a getter, not a frozen string: the same table object follows the language
    const ctx = vm.createContext({ console }); ctx.window = ctx; ctx.root = ctx;
    vm.runInContext(src('UI_I18N_JS', 'ui-i18n.js'), ctx);
    const text = src(ENVS['ui-net.js'], 'ui-net.js'), a = text.indexOf('const tr = '), b = text.indexOf('\n  };', text.indexOf('const T = {', a));
    const T = vm.runInContext('(function (window, root) {\n' + text.slice(a, b + 5) + '\nreturn T;\n})(this, this)', ctx);
    const de = T['reason.focus.min']; ctx.uiI18n.setLang('en'); const en = T['reason.focus.min']; ctx.uiI18n.setLang('de');
    check('ui-net.js: one T object gives German, then English after setLang, then German again', de === OLD['ui-net.js']['reason.focus.min'] && en === 'Smallest focus: \u22121.0.' && T['reason.focus.min'] === de, de + ' / ' + en);
})();

console.log('\n' + (failures ? 'FAIL' : 'PASS') + ': ' + (checks - failures) + '/' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
