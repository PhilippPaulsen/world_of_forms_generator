// Guard for the sentence tables that go through the dictionary (task 043): the German text stays CHARACTER-EQUAL to the old hard-coded functions (reference copies below) for n / k = 0, 1, 2, 5,
// with the dictionary (German) AND without it (the fallback written in the script), and the English reads as specified, with singular and plural in separate keys.
//   node tools/ui/test-i18n-sentences.js
//   UI_I18N_JS=... UI_FORM_JS=... UI_LAYER_JS=... UI_LAYERS_JS=... UI_TIMELINE_JS=... node tools/ui/test-i18n-sentences.js      (sabotage runs)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const src = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };

// ---- the OLD German, as it stood before task 043 (reference) ----
const OLD = {
    form: {
        'reason.node.min.trig': function (n) { return 'Sin und Tan brauchen mindestens Ordnung ' + n + '.'; },   // task 068c2: a function of the ordnung (was a static text)
        'reason.node.max.square': function (n) { return 'Höchste Ordnung beim Quadrat: ' + n + '.'; },
        'reason.node.max.other': function (n) { return 'Höchste Ordnung bei dieser Form: ' + n + '.'; },
        'note.size.field': function (from, to) { return 'Feld-Netz: nur ungerade Größen, deshalb ' + from + ' → ' + to + '.'; }
    },
    layer: {
        'reason.node.max.square': function (n) { return 'Höchste Ordnung beim Quadrat: ' + n + '.'; },
        'reason.node.max.other': function (n) { return 'Höchste Ordnung bei dieser Form: ' + n + '.'; }
    },
    layers: {
        'layers.remove.title': function (n) { return 'Ebene ' + n + ' entfernen?'; },
        'layers.remove.lines': function (k) { return (k === 1 ? 'Die eine Linie dieser Ebene geht' : 'Die ' + k + ' Linien dieser Ebene gehen') + ' verloren. Das lässt sich nicht rückgängig machen.'; },
        'layers.remove.keyframe': function (k) { return 'Diese Ebene ist ein Keyframe der Timeline' + (k ? ' und hat ' + (k === 1 ? 'eine Linie' : k + ' Linien') : '') + '. Sie wird entfernt, ihr Keyframe verlässt die Timeline, und die Linienzuordnungen der angrenzenden Segmente gehen verloren. Das lässt sich nicht rückgängig machen.'; }
    },
    timeline: {
        'timeline.dia.text': function (k) { return 'Die Linienzuordnung ' + (k === 1 ? 'des angrenzenden Segments geht' : 'von ' + k + ' angrenzenden Segmenten geht') + ' verloren (Zuordnung, Umkehrung und Symmetrie-Variante der Linien). Die Ebene selbst bleibt erhalten. Das lässt sich nicht rückgängig machen.'; }
    }
};
const FILES = { form: ['UI_FORM_JS', 'ui-form.js'], layer: ['UI_LAYER_JS', 'ui-layer.js'], layers: ['UI_LAYERS_JS', 'ui-layers.js'], timeline: ['UI_TIMELINE_JS', 'ui-timeline.js'] };
const ARGS = {
    form: { 'reason.node.min.trig': [[3], [4]], 'reason.node.max.square': [[0], [1], [2], [5]], 'reason.node.max.other': [[0], [1], [2], [5]], 'note.size.field': [[1, 3], [3, 5], [0, 2], [5, 7]] },
    layer: { 'reason.node.max.square': [[0], [1], [2], [5]], 'reason.node.max.other': [[0], [1], [2], [5]] },
    layers: { 'layers.remove.title': [[0], [1], [2], [5]], 'layers.remove.lines': [[0], [1], [2], [5]], 'layers.remove.keyframe': [[0], [1], [2], [5]] },
    timeline: { 'timeline.dia.text': [[0], [1], [2], [5]] }
};

// the T table of a script, evaluated alone: from its `const tr =` helper to the end of the object literal; `withDict` = the dictionary is on window / root (else the fallback text runs)
function loadT(which, withDict, lang) {
    const text = src(FILES[which][0], FILES[which][1]);
    const a = text.indexOf('const tr = '), b = text.indexOf('\n  };', text.indexOf('const T = {', a));
    if (a < 0 || b < 0) throw new Error(FILES[which][1] + ': no "const tr" / T table found');
    const ctx = vm.createContext({ console });
    ctx.window = ctx; ctx.root = ctx;
    if (withDict) {
        vm.runInContext(src('UI_I18N_JS', 'ui-i18n.js'), ctx, { filename: 'ui-i18n.js' });
        if (lang) ctx.uiI18n.setLang(lang);
    }
    return vm.runInContext('(function (window, root) {\n' + text.slice(a, b + 5) + '\nreturn T;\n})(this, this)', ctx, { filename: FILES[which][1] });
}

console.log('== German equals the old functions (dictionary on, dictionary off) ==');
Object.keys(OLD).forEach(which => {
    let TD, TF;
    try { TD = loadT(which, true); TF = loadT(which, false); } catch (e) { check(which + ': table loads', false, String(e.message).slice(0, 200)); return; }
    Object.keys(OLD[which]).forEach(key => {
        const bad = [], badF = [];
        ARGS[which][key].forEach(args => {
            const want = OLD[which][key].apply(null, args);
            const got = TD[key].apply(null, args), gotF = TF[key].apply(null, args);
            if (got !== want) bad.push(args.join(',') + ': "' + got + '"');
            if (gotF !== want) badF.push(args.join(',') + ': "' + gotF + '"');
        });
        check(FILES[which][1] + ' ' + key + ': dictionary German = old text for ' + ARGS[which][key].map(a => a.join('/')).join(' | '), bad.length === 0, bad.join(' ; '));
        check(FILES[which][1] + ' ' + key + ': the fallback written in the script = old text', badF.length === 0, badF.join(' ; '));
    });
});

console.log('== English ==');
(function () {
    const F = loadT('form', true, 'en'), L = loadT('layer', true, 'en'), Y = loadT('layers', true, 'en'), M = loadT('timeline', true, 'en');
    const eq = (name, got, want) => check(name, got === want, got === want ? undefined : '"' + got + '"');
    eq('reason.node.max.square (form)', F['reason.node.max.square'](5), 'Highest order for the square: 5.');
    eq('reason.node.max.other (form)', F['reason.node.max.other'](12), 'Highest order for this shape: 12.');
    eq('reason.node.max.square (layer)', L['reason.node.max.square'](5), 'Highest order for the square: 5.');
    eq('reason.node.max.other (layer)', L['reason.node.max.other'](12), 'Highest order for this shape: 12.');
    eq('note.size.field', F['note.size.field'](3, 5), 'Field net: odd sizes only, so 3 → 5.');
    eq('layers.remove.title', Y['layers.remove.title'](2), 'Remove layer 2?');
    eq('layers.remove.lines, k = 1', Y['layers.remove.lines'](1), 'The one line of this layer will be lost. This cannot be undone.');
    eq('layers.remove.lines, k = 5', Y['layers.remove.lines'](5), 'The 5 lines of this layer will be lost. This cannot be undone.');
    const tail = ' It will be removed, its keyframe leaves the timeline, and the line pairings of the adjacent segments will be lost. This cannot be undone.';
    eq('layers.remove.keyframe, k = 0', Y['layers.remove.keyframe'](0), 'This layer is a keyframe of the timeline.' + tail);
    eq('layers.remove.keyframe, k = 1', Y['layers.remove.keyframe'](1), 'This layer is a keyframe of the timeline and has one line.' + tail);
    eq('layers.remove.keyframe, k = 5', Y['layers.remove.keyframe'](5), 'This layer is a keyframe of the timeline and has 5 lines.' + tail);
    eq('timeline.dia.text, k = 1', M['timeline.dia.text'](1), 'The line pairing of the adjacent segment will be lost (pairing, reversal and symmetry variant of the lines). The layer itself is kept. This cannot be undone.');
    eq('timeline.dia.text, k = 3', M['timeline.dia.text'](3), 'The line pairings of 3 adjacent segments will be lost (pairing, reversal and symmetry variant of the lines). The layer itself is kept. This cannot be undone.');
    const none = [F['reason.node.max.square'](5), F['note.size.field'](3, 5), Y['layers.remove.lines'](5), Y['layers.remove.keyframe'](5), M['timeline.dia.text'](3)];
    check('no {placeholder} is left in any English sentence', none.every(s => !/[{}]/.test(s)), none.filter(s => /[{}]/.test(s)).join(' ; '));
})();

console.log('\n' + (failures ? 'FAIL' : 'PASS') + ': ' + (checks - failures) + '/' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
