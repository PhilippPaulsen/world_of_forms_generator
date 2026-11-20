// Task 109 (H1): the Field of the HEXAGON at every size 3..9 (even too, no shift): the triangle (108) and the square (106) as before - the controls, texts, stepper.
//   node tools/ui/test-net-hex-even-ui.js      sabotage runs (section 7): the test runs ITSELF against mutated copies via NETWARP_JS, SKETCH_JS, UI_FORM_JS, UI_I18N_JS
//   1. hint table (shape x size): hexagon Field 3..9 (toast-free, enabled, own title), size < 3 no net with note.net.fieldMinSizeNoNet / net.hint.fieldMin; triangle and square unchanged; keys in de AND en
//   2. the optimum hint (7..12 meshes) never appears for the hexagon (nor the triangle), still for the square
//   3. the size stepper: hexagon Field steps by one 3..9 (lock closed and open, limits 3 and 9), triangle and square as before, an UNKNOWN shape keeps the odd twos
//   4. the size-change note at a size below 3: hexagon and triangle note.size.fieldNetNoNetMin, square note.size.fieldNet; 3 -> 4 -> 5 on the hexagon says nothing about the net
//   5. text rules: info.net.field is the new short text in ui-i18n and index.html; the new texts say nothing about shift, half mesh or odd; NO reachable path (three shapes x sizes 1..9) shows an old odd text, only an unknown shape does
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
    const w = makeRenderWorld(shape === 'circle' ? 'hex' : shape, 3, 3, 'rotation_reflection6', FILES); const sb = w.sb, els = new Map(); const gshape = shape === 'circle' ? 'hex' : shape;   // 'circle' = an unknown shape on a hexagon grid
    w.set(`currentShape = ${J(gshape)}; projectGridSpec({ shape: ${J(gshape)}, ordnung: 4, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y}); rebuildGrid(currentShape); baseNetTransform = null;`);
    const kinds = ['regular', 'sinus', 'tangens', 'geometric'].map(k => fakeEl({ kind: k })), axes = ['both', 'x', 'y'].map(a => fakeEl({ axes: a })), domains = ['single', 'tiled', 'field'].map(d => fakeEl({ domain: d }));
    sb.select = id => { if (!els.has(id)) els.set(id, fakeEl()); return els.get(id); }; sb.selectAll = s => (s === '.net-kind-btn' ? kinds : s === '.net-axes-btn' ? axes : s === '.net-domain-btn' ? domains : []);
    const toasts = []; sb.UI = { toast(t) { toasts.push(t); }, t: (k, p) => T(LANG, k, p) }; sb.nodeInput = null; sb.curveBtn = null; sb.freeBtn = null; sb.faceBtn = null; sb.updateCurveTypeControls = () => { };
    sb.window = sb; sb.say = (id, text) => { toasts.push(text); }; sb.setNetAnimationStatus = () => { }; sb.syncNetAnimationLock = () => { }; sb.redraw = () => { }; sb.sessionFlushNow = () => { };
    sb.document = Object.assign(sb.document || {}, { body: {}, createElement: () => ({ style: {}, classList: { add() { }, toggle() { } }, addEventListener() { }, appendChild() { } }) });
    vm.runInContext('var adoptNetState = null; var netControlsSync = null; var netLinesOn = false; var syncNetControls = null;', sb); vm.runInContext(NET_IIFE, sb, { filename: 'sketch.js initNetControls' });
    kinds[0].press(); kinds[1].press(); const inp = els.get('#net-strength-input'); inp.value('50'); inp.inputFn(); if (shape === 'circle') w.set("currentShape = 'circle'; baseGridDivisions = function () { return 3; };");   // an unknown shape is not a state the app reaches (fromLegacy throws); the controls are asked as if it were sb.netControlsSync();
    const fb = els.get('#net-field-btn'), fh = els.get('#net-field-hint'), fi = els.get('#net-field-info');
    return { toasts: toasts.join(' | '), domain: w.get('baseNetTransform ? (baseNetTransform.domain || null) : null'), btnDisabled: fb.elt.disabled, btnTitle: fb.elt.title, hintHidden: fh.elt.hidden, hintKey: fh.elt.dataset.i18n, hintText: fh.elt.textContent, info: fi.elt.textContent, infoHidden: fi.elt.hidden, warp: w.get('(function () { const x = netWarpBaseNow(); return x ? x.domain : null; })()') };
}



const KEYS_NEW = ['note.net.fieldMinSizeNoNet', 'note.size.fieldNetNoNetMin', 'net.domain.field.titleEven', 'info.net.field', 'net.hint.fieldMin'];
const KEYS_OLD = ['net.hint.fieldOdd', 'note.net.fieldOddSizeNoNet', 'note.size.fieldNetNoNet', 'reason.size.field.min', 'note.size.field', 'net.domain.field.title'];
const sz = (X, Y) => X === Y ? X : X + '/' + Y;
const OLD_TEXT = []; for (const l of ['de', 'en']) for (const k of KEYS_OLD) { const t = T(l, k, { size: '', kept: '', from: '', to: '' }).split(/\{|\}/)[0].slice(0, 25); if (t.length > 10) OLD_TEXT.push(t); }   // the first words of every old odd text
// ---- 1. hint table ---------------------------------------------------------------------------------------------------------------------------------------
let TABLE = [];
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const missing = KEYS_NEW.concat(KEYS_OLD).filter(k => !HAS(k)); if (missing.length) note('keys', missing);
    let n = 0;
    for (const shape of ['hex', 'triangle']) {
        for (const [X, Y] of [[3, 3], [4, 4], [3, 4], [4, 3], [5, 5], [6, 5], [6, 6], [8, 8], [9, 9], [9, 3]]) {
            const r = run(shape, X, Y); n++; TABLE.push([shape, sz(X, Y), 'Feld', r.toasts || '-', r.hintKey, r.btnTitle.slice(0, 40)]);
            if (r.domain !== 'field' || r.warp !== 'field') note('field', [shape, X, Y, r.domain, r.warp]);
            if (r.btnDisabled || !r.hintHidden || r.toasts !== '') note('ok', [shape, X, Y, r.btnDisabled, r.hintHidden, r.toasts]);
            if (r.btnTitle !== T('de', 'net.domain.field.titleEven') && r.btnTitle !== '') note('title', [shape, X, Y, r.btnTitle]);
        }
        for (const [X, Y] of [[2, 2], [2, 5], [1, 1], [1, 3]]) {
            const r = run(shape, X, Y); n++; TABLE.push([shape, sz(X, Y), 'kein Netz', r.toasts || '-', r.hintKey, r.btnTitle.slice(0, 40)]);
            if (r.domain === 'field' || r.warp !== null) note('none', [shape, X, Y, r.domain, r.warp]);
            if (!r.btnDisabled || r.hintHidden || r.hintKey !== 'net.hint.fieldMin' || r.hintText !== T('de', 'net.hint.fieldMin')) note('hint', [shape, X, Y, r.btnDisabled, r.hintHidden, r.hintKey, r.hintText]);
            if (!r.toasts.includes(T('de', 'note.net.fieldMinSizeNoNet', { size: sz(X, Y), kept: sz(X, Y) }))) note('toast', [shape, X, Y, r.toasts]);
            if (r.btnTitle !== 'Field needs Shape Size 3 or more in X and Y') note('btnTitle', [shape, X, Y, r.btnTitle]);
        }
    }
    for (const [X, Y] of [[3, 3], [4, 4], [6, 5], [2, 2], [1, 3]]) {   // the square: as in task 106
        const r = run('square', X, Y); n++; const ok = X >= 3 && Y >= 3;
        if (ok !== (r.domain === 'field' && r.warp === 'field')) note('sq', [X, Y, r.domain, r.warp]);
        if (!ok && (r.hintKey !== 'net.hint.fieldMin' || !r.toasts.includes(T('de', 'note.net.fieldMinSize', { size: sz(X, Y), kept: sz(X, Y) })))) note('sqText', [X, Y, r.hintKey, r.toasts]);
    }
    LANG = 'en';
    for (const [X, Y] of [[4, 4], [2, 2]]) { const r = run('hex', X, Y); if (X >= 3 ? r.toasts !== '' || r.btnTitle !== T('en', 'net.domain.field.titleEven') : !r.toasts.includes(T('en', 'note.net.fieldMinSizeNoNet', { size: X, kept: X })) || r.hintText !== T('en', 'net.hint.fieldMin')) note('hexEn', [X, Y, r.toasts, r.hintText, r.btnTitle]); n++; }
    LANG = 'de';
    check(`(1) hint table (${n} runs): hexagon and triangle 3..9 (also even) is a Field (no toast, enabled, own title), a size below 3 has no net with note.net.fieldMinSizeNoNet / net.hint.fieldMin; the square as in 106; all ${KEYS_NEW.length + KEYS_OLD.length} keys in de and en`, !bad.first && n === 28 + 5 + 2, J(bad));
    console.log('TABLE', J(TABLE));
}

// ---- 2. the optimum hint ---------------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0;
    for (const lang of ['de', 'en']) {
        LANG = lang;
        for (const shape of ['hex', 'triangle']) for (const [X, Y] of [[3, 3], [4, 4], [3, 4], [4, 3], [5, 5], [6, 5], [8, 8], [9, 9], [3, 5], [5, 3]]) {
            const r = run(shape, X, Y); n++; const text = T(lang, 'net.hint.optimum', { w: X * Y });
            if (r.infoHidden) note('infoHidden', [lang, shape, X, Y]);
            if (r.info.includes(text) || /Hinterreiter|Maschen|7 to 12|7 bis 12|meshes/.test(r.info.replace(/ ?(Net family|Netzfamilie) [^)]*\)\./g, '').replace(/Hinterreiter's/g, ''))) note('optimum', [lang, shape, X, Y, r.info.slice(-90)]);
        }
        const r = run('square', 9, 9); if (!r.info.includes(T(lang, 'net.hint.optimum', { w: 81 }))) note('squareLost', [lang]);
    }
    LANG = 'de';
    check(`(2) the optimum hint never appears for the hexagon or the triangle (${n} runs, de and en), still for the square 9x9`, !bad.first && n === 40, J(bad));
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
    const cases = [];
    for (const sh of ['hex', 'triangle']) cases.push(
        [stepper(sh, false, 3, 3, true, 'x', 1), { to: 4 }], [stepper(sh, false, 4, 4, true, 'x', 1), { to: 5 }], [stepper(sh, false, 5, 5, true, 'x', -1), { to: 4 }], [stepper(sh, false, 4, 4, true, 'x', -1), { to: 3 }],
        [stepper(sh, false, 3, 3, true, 'x', -1), { to: null, reason: 'SQMIN' }], [stepper(sh, false, 9, 9, true, 'x', 1), { to: null, reason: 'MAX' }], [stepper(sh, false, 8, 8, true, 'x', 1), { to: 9 }],
        [stepper(sh, true, 3, 4, true, 'x', 1), { to: 4 }], [stepper(sh, true, 3, 4, true, 'y', 1), { to: 5 }], [stepper(sh, true, 3, 4, true, 'y', -1), { to: 3 }], [stepper(sh, true, 4, 3, true, 'y', -1), { to: null, reason: 'SQMIN' }],
        [stepper(sh, true, 3, 9, true, 'y', 1), { to: null, reason: 'MAX' }], [stepper(sh, true, 3, 9, true, 'x', 1), { to: 4 }], [stepper(sh, true, 3, 9, true, 'x', -1), { to: null, reason: 'SQMIN' }], [stepper(sh, true, 3, 8, true, 'y', 1), { to: 9 }]);
    cases.push(
        // an UNKNOWN shape keeps the odd twos (the old branches are reachable for it only)
        [stepper('circle', false, 5, 5, true, 'x', 1), { to: 7, note: 'NOTE57' }], [stepper('circle', false, 3, 3, true, 'x', -1), { to: null, reason: 'FMIN' }], [stepper('circle', true, 3, 5, true, 'x', 1), { to: 5, note: 'NOTE35' }],
        // square as in 106, no Field: steps of one
        [stepper('square', false, 4, 4, true, 'x', 1), { to: 5 }], [stepper('square', false, 3, 3, true, 'x', -1), { to: null, reason: 'SQMIN' }],
        [stepper('hex', false, 4, 4, false, 'x', 1), { to: 5 }], [stepper('hex', false, 2, 2, false, 'x', -1), { to: 1 }], [stepper('triangle', true, 3, 3, false, 'y', -1), { to: 2 }]);
    const bad = cases.map(([got, want], i) => [i, got, J(want)]).filter(([, a, b]) => a !== b);
    check(`(3) sizeCompute: the hexagon's and the triangle's Field step by one from 3 to 9 (lock closed and open; SQMIN below 3, MAX above 9, ratio 1:3 respected), an unknown shape keeps the odd twos, the square as in 106, no Field steps by one (${cases.length} cases)`, bad.length === 0 && cases.length >= 38, J(bad));
}

// ---- 4. the size-change note below 3 ---------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const fnText = SKETCH.slice(SKETCH.indexOf('function sizeChangeText(r) {'), SKETCH.indexOf('function saySizeChange'));
    const mkw = (shape, lang) => { const w = makeRenderWorld(shape, 3, 3, 'rotation_reflection6', FILES), sb = w.sb;
        w.set(`currentShape = ${J(shape)}; projectGridSpec({ shape: ${J(shape)}, ordnung: 4, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; setGridSize(3, 3); rebuildGrid(currentShape); baseNetTransform = { x: { kind: 'trig', w: -0.5 }, y: 'same', repeat: false, domain: 'field' };`);
        sb.window = sb; sb.UI = { t: (k, p) => T(lang, k, p) }; return w; };
    for (const lang of ['de', 'en']) for (const [shape, key] of [['hex', 'note.size.fieldNetNoNetMin'], ['triangle', 'note.size.fieldNetNoNetMin'], ['square', 'note.size.fieldNet']]) {
        LANG = lang; const w = mkw(shape, lang); let r = null; try { r = w.get('resizeBase(2, 2, {})'); } catch (e) { note('resize', [shape, String(e).slice(0, 80)]); continue; }
        vm.runInContext(fnText, w.sb); const text = vm.runInContext('(function (r) { return sizeChangeText(r); })', w.sb)(r);
        if (!r || !r.hints || r.hints.fieldNet !== true) note('hint', [lang, shape, r && r.hints]); else if (!text.includes(T(lang, key, { size: 2 }))) note('text', [lang, shape, key, text.slice(-80)]);
        if (key === 'note.size.fieldNetNoNetMin' && OLD_TEXT.some(t => text.includes(t))) note('oldText', [lang, shape]);
    }
    LANG = 'de';
    check('(4) size change 3 -> 2 with a Field: hexagon and triangle say note.size.fieldNetNoNetMin, square note.size.fieldNet (de and en); no old odd text', !bad.first, J(bad));
    const w = mkw('hex', 'de'); const r1 = w.get('resizeBase(4, 4, {})'), r2 = w.get('resizeBase(5, 5, {})');
    check('(4b) hexagon Field 3 -> 4 -> 5: no field-net hint (the Field is kept at every size)', r1.hints.fieldNet === false && r2.hints.fieldNet === false, J([r1.hints, r2.hints]));
}

// ---- 5. text rules and the old texts -----------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    for (const lang of ['de', 'en']) for (const k of ['net.domain.field.titleEven', 'note.net.fieldMinSizeNoNet', 'note.size.fieldNetNoNetMin', 'info.net.field', 'net.hint.fieldMin']) {
        const t = T(lang, k, { size: 2, kept: 2 });
        if (/versatz|halbe|half|shift/i.test(t)) note('wording', [lang, k, t]); if (/\bodd\b|ungerade/.test(t)) note('odd', [lang, k, t]);
    }
    if (T('de', 'info.net.field') !== 'Feld: ein Gesetz über alle Kacheln; Größe 3 bis 9.' || T('en', 'info.net.field') !== 'Field: one law across all tiles; size 3 to 9.') note('infoText', [T('de', 'info.net.field'), T('en', 'info.net.field')]);
    const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); if (!idx.includes(T('de', 'info.net.field'))) note('indexInfo', 'index.html static info.net.field differs from ui-i18n');
    // no reachable path of the three shapes shows an old odd text: every size 1..9 pair, the toasts, hint line and title
    let n = 0;
    for (const shape of ['hex', 'triangle', 'square']) for (let X = 1; X <= 9; X += 1) for (const Y of [1, 2, 3, 4, 6, 9]) { if (Math.max(X, Y) > 3 * Math.min(X, Y)) continue; const r = run(shape, X, Y); n++;
        const all = [r.toasts, r.hintText, r.btnTitle].join(' | '); if (/ungerade|odd Shape Size|only at odd|odd sizes/.test(all)) note('reachableOld', [shape, X, Y, all.slice(0, 120)]); }
    // an UNKNOWN shape still reads them: evenShape names exactly the three shapes, the old keys stay in the fallback branches (an unknown shape is not a state the app reaches: fromLegacy throws)
    { const rx = /evenShape = ([^;]*);/g; let m, shapes = []; while ((m = rx.exec(SKETCH))) shapes.push(m[1]);
      if (!shapes.length || !shapes.every(t => /square|sqShape/.test(t) && /triangle/.test(t) && /hex/.test(t) && !/circle|true/.test(t))) note('evenShapeDef', shapes);
      for (const k of ['net.hint.fieldOdd', 'note.net.fieldOddSizeNoNet']) if (!SKETCH.includes("'" + k + "'")) note('fallbackGone', k); }
    check(`(5) info.net.field = "Feld: ein Gesetz über alle Kacheln; Größe 3 bis 9." (de and en, index.html carries it); no shift / half-mesh / odd wording in the new texts; no reachable path of the three shapes (${n} runs) shows an old odd text; the old keys stay in the fallback for an unknown shape (evenShape names the three shapes only)`, !bad.first && n >= 80, J(bad));
}

// ---- 6. sabotage runs ----------------------------------------------------------------------------------------------------------------------------------------
if (!CHILD) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evenui109s-')); const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
    const GATE = "(sq || shape === 'triangle' || shape === 'hex') && n % 2 === 0";
    const SAB = [
        ['the hexagon gets odd sizes only again (gate)', 'NETWARP_JS', 'core/netwarp.js', GATE, "(sq || shape === 'triangle') && n % 2 === 0"],
        ['size 2 opens the hexagon Field', 'NETWARP_JS', 'core/netwarp.js', "else if (n < (sq ? netFieldMinTiles : 3))", "else if (n < (sq || shape === 'hex' ? 2 : 3))"],
        ['stepper: the hexagon steps in odd twos', 'UI_FORM_JS', 'ui-form.js', "(currentShape === 'square' || currentShape === 'triangle' || currentShape === 'hex'); }", "(currentShape === 'square' || currentShape === 'triangle'); }"],
        ['hint key note.net.fieldMinSizeNoNet without english', 'UI_I18N_JS', 'ui-i18n.js', "en: 'Field needs size 3 or more in X and Y; at {size} there is no net here. The size stays {kept}.' },\n    'note.net.fieldMinSize'", "en: '' },\n    'note.net.fieldMinSize'"],
        ['key note.size.fieldNetNoNetMin missing', 'UI_I18N_JS', 'ui-i18n.js', "'note.size.fieldNetNoNetMin': {", "'note.size.fieldNetNoNetMinX': {"],
        ['info.net.field names the odd rule again', 'UI_I18N_JS', 'ui-i18n.js', "Größe 3 bis 9.', en: 'Field: one law across all tiles; size 3 to 9.'", "ungerade Größe 3 bis 9.', en: 'Field: one law across all tiles; odd size 3 to 9.'"],
        ['the optimum hint also for the hexagon', 'SKETCH_JS', 'sketch.js', "const optHint = sqShape && window.UI", "const optHint = evenShape && window.UI"],
        ['the hexagon keeps the odd hint line', 'SKETCH_JS', 'sketch.js', "evenShape = sqShape || currentShape === 'triangle' || currentShape === 'hex';", "evenShape = sqShape || currentShape === 'triangle';"],
        ['the hexagon size-change note is the old one', 'SKETCH_JS', 'sketch.js', "parts.push(currentShape !== 'square' ? t('note.size.fieldNetNoNetMin'", "parts.push(currentShape === 'triangle' ? t('note.size.fieldNetNoNetMin'"],
        ['an unknown shape reads as evenShape', 'SKETCH_JS', 'sketch.js', "evenShape = sqShape || currentShape === 'triangle' || currentShape === 'hex';", "evenShape = true;"],
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
