// Task 108 (T1): the Field of the TRIANGLE at every size 3..9 (even too, no shift), the hexagon at odd sizes only, the square as in task 106 - the controls, texts, stepper.
//   node tools/ui/test-net-triangle-even-ui.js      sabotage runs (section 6): the test runs ITSELF against mutated copies via NETWARP_JS, SKETCH_JS, UI_FORM_JS, UI_I18N_JS
//   1. hint table (shape x size): triangle Field 3..9 (toast-free, enabled, own title), size < 3 no net with note.net.fieldMinSizeNoNet / net.hint.fieldMin; the square keeps its texts (the hexagon: test-net-hex-even-ui.js); keys in de AND en
//   2. the optimum hint (7..12 meshes) never appears for the triangle (nor the hexagon), still for the square
//   3. the size stepper: triangle Field steps by one 3..9 (lock closed and open), hexagon keeps odd twos, square as before
//   4. the size-change note at a size below 3: triangle note.size.fieldNetNoNetMin, hexagon note.size.fieldNetNoNet, square note.size.fieldNet
//   5. text rules: titleEven / info.net.field / the new notes say nothing about shift, half mesh or odd; the hexagon texts are word for word the old ones
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const CHILD = !!(process.env.NETWARP_JS || process.env.SKETCH_JS || process.env.UI_FORM_JS || process.env.UI_I18N_JS || process.env.UI_NET_JS);
const { makeRenderWorld } = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const FILES = {}; if (process.env.NETWARP_JS) FILES['core/netwarp.js'] = process.env.NETWARP_JS;
const NET_IIFE = (SKETCH.match(/\(function initNetControls\(\) \{[\s\S]*?\n    \}\)\(\);/) || [''])[0];

const ictx = vm.createContext({ window: {}, document: undefined, console }); ictx.window.document = undefined;
vm.runInContext(fs.readFileSync(process.env.UI_I18N_JS || path.join(ROOT, 'ui-i18n.js'), 'utf8'), ictx, { filename: 'ui-i18n.js' });
const I = vm.runInContext('typeof uiI18n !== "undefined" ? uiI18n : window.uiI18n', ictx);
let LANG = 'de';
const T = (lang, k, p) => { I.setLang(lang); return I.t(k, p); };
const HAS = k => ['de', 'en'].every(l => { const v = T(l, k, { size: 4, kept: 4, w: 16 }); return typeof v === 'string' && v.length > 0 && v !== k; }) && T('de', k, { size: 4, kept: 4, w: 16 }) !== T('en', k, { size: 4, kept: 4, w: 16 });   // an empty english text falls back to the german one: the two must differ
function fakeEl(dataset) {
    let val = '0', html = ''; const cls = new Set();
    const elt = { dataset: dataset || {}, hidden: false, disabled: false, title: '', textContent: '', innerHTML: '', addEventListener() { }, dispatchEvent() { },
        classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, on) => { const want = on === undefined ? !cls.has(c) : !!on; if (want) cls.add(c); else cls.delete(c); return want; } } };
    const p = { elt, press: null, inputFn: null, value(v) { if (v === undefined) return val; val = String(v); return p; }, html(s) { if (s === undefined) return html; html = s; elt.textContent = s; return p; }, mousePressed(fn) { p.press = fn; return p; }, input(fn) { p.inputFn = fn; return p; } };
    return p;
}
function run(shape, X, Y) {
    const w = makeRenderWorld(shape, 3, 3, 'rotation_reflection6', FILES); const sb = w.sb, els = new Map();
    w.set(`currentShape = ${J(shape)}; projectGridSpec({ shape: ${J(shape)}, ordnung: 4, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y}); rebuildGrid(currentShape); baseNetTransform = null;`);
    const kinds = ['regular', 'sinus', 'tangens', 'geometric'].map(k => fakeEl({ kind: k })), axes = ['both', 'x', 'y'].map(a => fakeEl({ axes: a })), domains = ['single', 'tiled', 'field'].map(d => fakeEl({ domain: d }));
    sb.select = id => { if (!els.has(id)) els.set(id, fakeEl()); return els.get(id); }; sb.selectAll = s => (s === '.net-kind-btn' ? kinds : s === '.net-axes-btn' ? axes : s === '.net-domain-btn' ? domains : []);
    const toasts = []; sb.UI = { toast(t) { toasts.push(t); }, t: (k, p) => T(LANG, k, p) }; sb.nodeInput = null; sb.curveBtn = null; sb.freeBtn = null; sb.faceBtn = null; sb.updateCurveTypeControls = () => { };
    sb.window = sb; sb.say = (id, text) => { toasts.push(text); }; sb.setNetAnimationStatus = () => { }; sb.syncNetAnimationLock = () => { }; sb.redraw = () => { }; sb.sessionFlushNow = () => { };
    sb.document = Object.assign(sb.document || {}, { body: {}, createElement: () => ({ style: {}, classList: { add() { }, toggle() { } }, addEventListener() { }, appendChild() { } }) });
    vm.runInContext('var adoptNetState = null; var netControlsSync = null; var netLinesOn = false; var syncNetControls = null;', sb); vm.runInContext(NET_IIFE, sb, { filename: 'sketch.js initNetControls' });
    kinds[0].press(); kinds[1].press(); const inp = els.get('#net-strength-input'); inp.value('50'); inp.inputFn(); sb.netControlsSync();
    const fb = els.get('#net-field-btn'), fh = els.get('#net-field-hint'), fi = els.get('#net-field-info');
    return { toasts: toasts.join(' | '), domain: w.get('baseNetTransform ? (baseNetTransform.domain || null) : null'), btnDisabled: fb.elt.disabled, btnTitle: fb.elt.title, hintHidden: fh.elt.hidden, hintKey: fh.elt.dataset.i18n, hintText: fh.elt.textContent, info: fi.elt.textContent, infoHidden: fi.elt.hidden, warp: w.get('(function () { const x = netWarpBaseNow(); return x ? x.domain : null; })()') };
}


const KEYS_NEW = ['note.net.fieldMinSizeNoNet', 'note.size.fieldNetNoNetMin', 'net.domain.field.titleEven', 'info.net.field', 'net.hint.fieldMin'];
const KEYS_HEX = ['net.hint.fieldOdd', 'note.net.fieldOddSizeNoNet', 'note.size.fieldNetNoNet', 'reason.size.field.min', 'note.size.field', 'net.domain.field.title'];
const sz = (X, Y) => X === Y ? X : X + '/' + Y;
// ---- 1. hint table ---------------------------------------------------------------------------------------------------------------------------------------
let TABLE = [];
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const missing = KEYS_NEW.concat(KEYS_HEX).filter(k => !HAS(k)); if (missing.length) note('keys', missing);
    let n = 0;
    for (const [X, Y] of [[3, 3], [4, 4], [3, 4], [4, 3], [5, 5], [6, 5], [8, 8], [9, 9], [9, 3], [2, 2], [2, 5], [1, 1], [1, 3]]) {
        const r = run('triangle', X, Y); n++; const ok = X >= 3 && Y >= 3;
        TABLE.push(['triangle', sz(X, Y), ok ? 'Feld' : 'kein Netz', r.toasts || '-', r.hintKey, r.btnTitle.slice(0, 40)]);
        if (ok) {
            if (r.domain !== 'field' || r.warp !== 'field') note('triField', [X, Y, r.domain, r.warp]);
            if (r.btnDisabled || !r.hintHidden || r.toasts !== '') note('triOk', [X, Y, r.btnDisabled, r.hintHidden, r.toasts]);
            if (r.btnTitle !== T('de', 'net.domain.field.titleEven') && r.btnTitle !== '') note('triTitle', [X, Y, r.btnTitle]);
        } else {
            if (r.domain === 'field' || r.warp !== null) note('triNone', [X, Y, r.domain, r.warp]);
            if (!r.btnDisabled || r.hintHidden || r.hintKey !== 'net.hint.fieldMin' || r.hintText !== T('de', 'net.hint.fieldMin')) note('triHint', [X, Y, r.btnDisabled, r.hintHidden, r.hintKey, r.hintText]);
            if (!r.toasts.includes(T('de', 'note.net.fieldMinSizeNoNet', { size: sz(X, Y), kept: sz(X, Y) }))) note('triToast', [X, Y, r.toasts]);
            if (r.btnTitle !== 'Field needs Shape Size 3 or more in X and Y') note('triBtnTitle', [X, Y, r.btnTitle]);
        }
    }
    // task 109: the hexagon takes every size 3..9 too: its table is in test-net-hex-even-ui.js
    for (const [X, Y] of [[3, 3], [4, 4], [6, 5], [2, 2], [1, 3]]) {   // the square: as in task 106
        const r = run('square', X, Y); n++; const ok = X >= 3 && Y >= 3;
        if (ok !== (r.domain === 'field' && r.warp === 'field')) note('sq', [X, Y, r.domain, r.warp]);
        if (!ok && (r.hintKey !== 'net.hint.fieldMin' || !r.toasts.includes(T('de', 'note.net.fieldMinSize', { size: sz(X, Y), kept: sz(X, Y) })))) note('sqText', [X, Y, r.hintKey, r.toasts]);
    }
    LANG = 'en';   // the same table in english: the right english text in the right case
    for (const [X, Y] of [[4, 4], [2, 2]]) { const r = run('triangle', X, Y); if (X >= 3 ? r.toasts !== '' || r.btnTitle !== T('en', 'net.domain.field.titleEven') : !r.toasts.includes(T('en', 'note.net.fieldMinSizeNoNet', { size: X, kept: X })) || r.hintText !== T('en', 'net.hint.fieldMin')) note('triEn', [X, Y, r.toasts, r.hintText, r.btnTitle]); n++; }
    LANG = 'de';
    check(`(1) hint table (${n} runs): triangle 3..9 (also even) is a Field (no toast, enabled, own title), a size below 3 has no net with note.net.fieldMinSizeNoNet / net.hint.fieldMin; the square keeps its texts (the hexagon: test-net-hex-even-ui.js); all ${KEYS_NEW.length + KEYS_HEX.length} keys in de and en`, !bad.first && n === 13 + 5 + 2, J(bad));
    console.log('TABLE', J(TABLE));
}

// ---- 2. the optimum hint never for the triangle ----------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0;
    for (const lang of ['de', 'en']) {
        LANG = lang;
        for (const shape of ['triangle', 'hex']) for (const [X, Y] of [[3, 3], [4, 4], [3, 4], [4, 3], [5, 5], [6, 5], [8, 8], [9, 9], [3, 5], [5, 3]]) {
            const r = run(shape, X, Y); n++; const text = T(lang, 'net.hint.optimum', { w: X * Y });
            if (r.infoHidden) note('infoHidden', [lang, shape, X, Y]);
            if (r.info.includes(text) || /Hinterreiter|Maschen|7 to 12|7 bis 12|meshes/.test(r.info.replace(/Hinterreiter's/g, ''))) note('optimum', [lang, shape, X, Y, r.info.slice(-90)]);
        }
        const r = run('square', 9, 9); if (!r.info.includes(T(lang, 'net.hint.optimum', { w: 81 }))) note('squareLost', [lang]);   // the square still has it
    }
    LANG = 'de';
    check(`(2) the optimum hint never appears for the triangle or the hexagon (${n} runs, de and en), still for the square 9x9`, !bad.first && n >= 30, J(bad));
}

// ---- 3. the stepper --------------------------------------------------------------------------------------------------------------------------------------
{
    const FORM = fs.readFileSync(process.env.UI_FORM_JS || path.join(ROOT, 'ui-form.js'), 'utf8');
    const cut = FORM.slice(FORM.indexOf('  function fieldActive()'), FORM.indexOf('  function sizeRange('));
    const T_ = { 'reason.size.field.min': 'FMIN', 'reason.size.fieldSq.min': 'SQMIN', 'reason.size.max': 'MAX', 'reason.size.min': 'MIN', 'reason.size.ratio': 'RATIO', 'note.size.field': (a, b) => 'NOTE' + a + b };
    function stepper(shape, open, X, Y, field, axis, dir) {
        const c = vm.createContext({ currentShape: shape, baseNetTransform: field ? { domain: 'field' } : null, sizeLockIsOpen: () => open, gridSizeX: () => X, gridSizeY: () => Y, T: T_, console,
            sizeAxisRange: (ax, other) => { let min = null, max = null; for (let v = 1; v <= 9; v++) { if (Math.max(v, other) <= 3 * Math.min(v, other)) { if (min === null) min = v; max = v; } } return { min, max }; },
            sizeInput: { value: String(X) }, sizeYInput: { value: String(Y) }, parseInt, Math });
        vm.runInContext(cut + '\nthis.__c = sizeCompute;', c);
        return J(c.__c(dir, axis));
    }
    const cases = [
        [stepper('triangle', false, 3, 3, true, 'x', 1), { to: 4 }], [stepper('triangle', false, 4, 4, true, 'x', 1), { to: 5 }], [stepper('triangle', false, 5, 5, true, 'x', -1), { to: 4 }], [stepper('triangle', false, 4, 4, true, 'x', -1), { to: 3 }],
        [stepper('triangle', false, 3, 3, true, 'x', -1), { to: null, reason: 'SQMIN' }], [stepper('triangle', false, 9, 9, true, 'x', 1), { to: null, reason: 'MAX' }], [stepper('triangle', false, 8, 8, true, 'x', 1), { to: 9 }],
        [stepper('triangle', true, 3, 4, true, 'x', 1), { to: 4 }], [stepper('triangle', true, 3, 4, true, 'y', 1), { to: 5 }], [stepper('triangle', true, 3, 4, true, 'y', -1), { to: 3 }], [stepper('triangle', true, 4, 3, true, 'y', -1), { to: null, reason: 'SQMIN' }],
        [stepper('triangle', true, 3, 9, true, 'y', 1), { to: null, reason: 'MAX' }], [stepper('triangle', true, 3, 9, true, 'x', 1), { to: 4 }], [stepper('triangle', true, 3, 9, true, 'x', -1), { to: null, reason: 'SQMIN' }], [stepper('triangle', true, 3, 8, true, 'y', 1), { to: 9 }],
        [stepper('triangle', true, 6, 9, true, 'x', 1), { to: 7 }], [stepper('triangle', true, 3, 3, false, 'y', -1), { to: 2 }],
        // hexagon (task 109): steps of one
        [stepper('hex', false, 5, 5, true, 'x', 1), { to: 6 }], [stepper('hex', false, 5, 5, true, 'x', -1), { to: 4 }], [stepper('hex', false, 3, 3, true, 'x', -1), { to: null, reason: 'SQMIN' }], [stepper('hex', true, 3, 5, true, 'x', 1), { to: 4 }], [stepper('hex', false, 9, 9, true, 'x', 1), { to: null, reason: 'MAX' }],
        // square: as in 106
        [stepper('square', false, 4, 4, true, 'x', 1), { to: 5 }], [stepper('square', false, 3, 3, true, 'x', -1), { to: null, reason: 'SQMIN' }], [stepper('square', true, 3, 4, true, 'y', 1), { to: 5 }],
        // no Field: steps of one
        [stepper('triangle', false, 4, 4, false, 'x', 1), { to: 5 }], [stepper('hex', false, 2, 2, false, 'x', -1), { to: 1 }],
    ];
    const bad = cases.map(([got, want], i) => [i, got, J(want)]).filter(([, a, b]) => a !== b);
    check(`(3) sizeCompute: the triangle's Field steps by one from 3 to 9 (lock closed and open; SQMIN below 3, MAX above 9, ratio 1:3 respected), the hexagon (task 109) steps by one too, the square as in 106, no Field steps by one (${cases.length} cases)`, bad.length === 0 && cases.length >= 27, J(bad));
}

// ---- 4. the size-change note below 3 ---------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const fnText = SKETCH.slice(SKETCH.indexOf('function sizeChangeText(r) {'), SKETCH.indexOf('function saySizeChange'));
    for (const lang of ['de', 'en']) for (const [shape, key] of [['triangle', 'note.size.fieldNetNoNetMin'], ['hex', 'note.size.fieldNetNoNetMin'], ['square', 'note.size.fieldNet']]) {
        LANG = lang;
        const w = makeRenderWorld(shape, 3, 3, 'rotation_reflection6', FILES), sb = w.sb;
        w.set(`currentShape = ${J(shape)}; projectGridSpec({ shape: ${J(shape)}, ordnung: 4, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; setGridSize(3, 3); rebuildGrid(currentShape); baseNetTransform = { x: { kind: 'trig', w: -0.5 }, y: 'same', repeat: false, domain: 'field' };`);
        sb.window = sb; sb.UI = { t: (k, p) => T(lang, k, p) };
        let r = null; try { r = w.get('resizeBase(2, 2, {})'); } catch (e) { note('resize', [shape, String(e).slice(0, 80)]); continue; }
        vm.runInContext(fnText, sb); const text = vm.runInContext('(function (r) { return sizeChangeText(r); })', sb)(r);
        if (!r || !r.hints || r.hints.fieldNet !== true) note('hint', [lang, shape, r && r.hints]);
        else if (!text.includes(T(lang, key, { size: 2 }))) note('text', [lang, shape, key, text.slice(-80)]);
    }
    LANG = 'de';
    check('(4) size change 3 -> 2 with a Field: triangle says note.size.fieldNetNoNetMin, hexagon note.size.fieldNetNoNet, square note.size.fieldNet (de and en); 3 -> 4 on the triangle says nothing about the net', !bad.first, J(bad));
    // 3 -> 4 and 4 -> 5 on the triangle keep the Field: no field hint
    const w = makeRenderWorld('triangle', 3, 3, 'rotation_reflection6', FILES);
    w.set(`currentShape = 'triangle'; projectGridSpec({ shape: 'triangle', ordnung: 4, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; setGridSize(3, 3); rebuildGrid(currentShape); baseNetTransform = { x: { kind: 'trig', w: -0.5 }, y: 'same', repeat: false, domain: 'field' };`);
    const r1 = w.get('resizeBase(4, 4, {})'), r2 = w.get('resizeBase(5, 5, {})');
    check('(4b) triangle Field 3 -> 4 -> 5: no field-net hint (the Field is kept at every size)', r1.hints.fieldNet === false && r2.hints.fieldNet === false, J([r1.hints, r2.hints]));
}

// ---- 5. text rules ---------------------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    for (const lang of ['de', 'en']) for (const k of ['net.domain.field.titleEven', 'note.net.fieldMinSizeNoNet', 'note.size.fieldNetNoNetMin', 'info.net.field', 'net.hint.fieldMin']) {
        const t = T(lang, k, { size: 2, kept: 2 });
        if (/versatz|halbe|half|shift|ungerade ?[Gg]r/.test(t) && !(k === 'info.net.field')) note('wording', [lang, k, t]);
        if (k !== 'info.net.field' && /\bodd\b|ungerade/.test(t)) note('odd', [lang, k, t]);
    }
    // the hexagon texts word for word as on main
    const HEX = { 'net.hint.fieldOdd': ['Feld braucht ungerade Größen in X und Y (3, 5, 7, 9).', 'Field needs odd Shape Sizes in X and Y (3, 5, 7, 9).'], 'note.size.fieldNetNoNet': ['Feld-Netz gilt nur bei ungeraden Größen: bei Größe {size} kein Netz.', 'The field net applies only at odd sizes: at size {size} there is no net.'], 'reason.size.field.min': ['Im Feld-Netz sind nur ungerade Größen von 3 bis 9 möglich; 3 ist die kleinste.', 'In the field net only odd sizes from 3 to 9 are possible; 3 is the smallest.'] };
    for (const [k, [de, en]] of Object.entries(HEX)) { if (T('de', k, { size: '{size}' }) !== de.replace('{size}', '{size}') && T('de', k) !== de) note('hexDe', [k, T('de', k)]); if (T('en', k) !== en) note('hexEn', [k, T('en', k)]); }
    const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    if (!idx.includes(T('de', 'info.net.field'))) note('indexInfo', 'index.html static info.net.field differs from ui-i18n');
    check('(5) the new and changed texts name no shift or half mesh and no odd rule; the hexagon texts are the old ones word for word; index.html carries info.net.field', !bad.first, J(bad));
}

// ---- 6. sabotage runs ----------------------------------------------------------------------------------------------------------------------------------------
if (!CHILD) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evenui108-'));
    const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
    const SAB = [
        ['size 2 opens the triangle Field', 'NETWARP_JS', 'core/netwarp.js', "else if (n < (sq ? netFieldMinTiles : 3))", "else if (n < (sq || shape === 'triangle' ? 2 : 3))"],
        ['stepper: the triangle steps in odd twos (lock closed)', 'UI_FORM_JS', 'ui-form.js', "function fieldAnySize() { return typeof currentShape !== 'undefined' && (currentShape === 'square' || currentShape === 'triangle' || currentShape === 'hex'); }", "function fieldAnySize() { return typeof currentShape !== 'undefined' && (currentShape === 'square' || currentShape === 'hex'); }"],
        ['hint key note.net.fieldMinSizeNoNet without english', 'UI_I18N_JS', 'ui-i18n.js', "en: 'Field needs size 3 or more in X and Y; at {size} there is no net here. The size stays {kept}.' },\n    'note.net.fieldMinSize'", "en: '' },\n    'note.net.fieldMinSize'"],
        ['key note.size.fieldNetNoNetMin missing', 'UI_I18N_JS', 'ui-i18n.js', "'note.size.fieldNetNoNetMin': {", "'note.size.fieldNetNoNetMinX': {"],
        ['title text mentions the odd rule', 'UI_I18N_JS', 'ui-i18n.js', "en: 'Field: the law spans all tiles; each tile is a scaled copy of the clicked pattern (size 3 to 9)'", "en: 'Field: the law spans all tiles at odd sizes; each tile is a scaled copy of the clicked pattern (size 3 to 9)'"],
        ['the optimum hint also for the triangle', 'SKETCH_JS', 'sketch.js', "const optHint = sqShape && window.UI", "const optHint = evenShape && window.UI"],
        ['the triangle keeps the odd hint line', 'SKETCH_JS', 'sketch.js', "const hk = evenShape ? 'net.hint.fieldMin' : 'net.hint.fieldOdd';", "const hk = sqShape || currentShape === 'hex' ? 'net.hint.fieldMin' : 'net.hint.fieldOdd';"],
        ['the triangle size-change note is the hexagon one', 'SKETCH_JS', 'sketch.js', "currentShape !== 'square' ? t('note.size.fieldNetNoNetMin'", "false ? t('note.size.fieldNetNoNetMin'"],
    ];
    let red = 0; const notRed = [];
    SAB.forEach(([name, envKey, file, from, to], i) => {
        const src = rd(file); if (src.split(from).length !== 2) { notRed.push([name, 'pattern not found once']); return; }
        const f = path.join(dir, 'sab' + i + '-' + path.basename(file)); fs.writeFileSync(f, src.replace(from, () => to));
        const env = Object.assign({}, process.env); env[envKey] = f;
        const r = spawnSync(process.execPath, [__filename], { env, encoding: 'utf8', maxBuffer: 1 << 26 });
        if (r.status !== 0) red++; else notRed.push([name, 'still green']);
    });
    check(`(6) ${SAB.length} sabotage runs on mutated copies: every one fails the test`, red === SAB.length && notRed.length === 0, J(notRed));
}
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
