// Task 106 (N2a-2): the Field of the SQUARE at every size 3..9 (even too), the triangle and the hexagon at odd sizes only - the controls, texts and the Timeline guard.
//   node tools/ui/test-net-even-ui.js      sabotage runs (section 6): the test runs ITSELF against mutated copies via NETWARP_JS, SKETCH_JS, UI_FORM_JS, UI_I18N_JS, UI_NET_JS
//   1. hint table (shape x size x event): toast, Field or Single, button state, hint key and text, button title - every key present in de AND en, the right one in the right case
//   2. the optimum hint (Hinterreiter II p. 17: 7 to 12 meshes for squares) only in #net-field-info, only for the square in a Field, only outside 7..12; the readout line is the old one
//   3. the Shape Size stepper (ui-form.js sizeCompute): the square's Field steps by one (3..9), triangle / hexagon in odd twos, without a Field by one
//   4. the Timeline guard: netAnimationCompat table, timelineNetSegment / timelineNetSummary say why
//   5. netDomainEffective callers: every caller passes the shape; a caller without it can never open the triangle or the hexagon at an even size
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

// ---- 1. hint table ---------------------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const KEYS = ['reason.size.fieldSq.min', 'note.net.fieldMinSize', 'net.hint.fieldMin', 'net.domain.field.titleSq', 'net.hint.optimum', 'info.net.field', 'net.hint.fieldOdd', 'note.net.fieldOddSizeNoNet', 'note.size.fieldNetNoNet', 'reason.size.field.min', 'note.size.field', 'note.size.fieldNet'];
    const missing = KEYS.filter(k => !HAS(k)); if (missing.length) note('keys', missing);
    let n = 0;
    for (const [X, Y] of [[3, 3], [4, 4], [3, 4], [4, 3], [5, 5], [6, 5], [8, 8], [9, 9], [2, 2], [2, 5], [1, 1], [1, 3]]) {   // square
        const r = run('square', X, Y); n++; const ok = X >= 3 && Y >= 3;
        if (ok) {
            if (r.domain !== 'field' || r.warp !== 'field') note('sqField', [X, Y, r.domain, r.warp]);
            if (r.btnDisabled || !r.hintHidden || r.toasts !== '') note('sqOk', [X, Y, r.btnDisabled, r.hintHidden, r.toasts]);
            if (r.btnTitle !== T('de', 'net.domain.field.titleSq') && r.btnTitle !== '') note('sqTitle', [X, Y, r.btnTitle]);
        } else {
            if (r.domain === 'field' || r.warp === 'field') note('sqSingle', [X, Y, r.domain, r.warp]);
            if (!r.btnDisabled || r.hintHidden || r.hintKey !== 'net.hint.fieldMin' || r.hintText !== T('de', 'net.hint.fieldMin')) note('sqHint', [X, Y, r.btnDisabled, r.hintHidden, r.hintKey, r.hintText]);
            if (!r.toasts.includes(T('de', 'note.net.fieldMinSize', { size: X === Y ? X : X + '/' + Y, kept: X === Y ? X : X + '/' + Y }))) note('sqToast', [X, Y, r.toasts]);
            if (r.btnTitle !== 'Field needs Shape Size 3 or more in X and Y') note('sqBtnTitle', [X, Y, r.btnTitle]);
        }
    }
    // task 108 / 109: the triangle and the hexagon take every size 3..9; their tables are in test-net-triangle-even-ui.js and test-net-hex-even-ui.js
    check(`(1) hint table: square 3..9 (also even) is a Field, a size below 3 is Single with note.net.fieldMinSize / net.hint.fieldMin / its own title; the triangle and the hexagon: test-net-triangle-even-ui.js, test-net-hex-even-ui.js; all 12 keys in de and en (${n} runs)`, !bad.first && n === 12, J(bad));
}

// ---- 2. the optimum hint -------------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    for (const lang of ['de', 'en']) {
        LANG = lang;
        for (const [X, Y] of [[3, 3], [3, 4], [4, 3], [4, 4], [5, 5], [6, 5], [8, 8], [9, 9], [3, 5], [5, 3]]) {
            const r = run('square', X, Y), w_ = X * Y, want = w_ < 7 || w_ > 12, text = T(lang, 'net.hint.optimum', { w: w_ });
            if (r.infoHidden) note('infoHidden', [lang, X, Y]);
            if (want !== r.info.includes(text)) note('optimum', [lang, X, Y, w_, want, r.info.slice(-80)]);
            if (!want && /Hinterreiter|Maschen|meshes/.test(r.info.replace(/Hinterreiter's/g, ''))) note('extra', [lang, X, Y]);
        }
        for (const shape of ['triangle', 'hex']) for (const [X, Y] of [[3, 3], [5, 5], [9, 9], [3, 5]]) { const r = run(shape, X, Y); if (/Hinterreiter|Maschen|7 to 12|7 bis 12/.test(r.info)) note('triOptimum', [lang, shape, X, Y]); }
    }
    LANG = 'de';
    // the readout line is the old one (byte-equal to main for odd sizes): no optimum text, the same words at an even size
    const RO = require(path.join(ROOT, 'ui-net-readout.js'));
    const ro = (lang, n, m) => RO.readoutText('field', n, (k, p) => T(lang, k, p), m);
    const readouts = [ro('de', 5, 5) === 'Feld: 5 × 5 Kacheln', ro('en', 5, 5) === 'Field: 5 × 5 tiles', ro('de', 4, 4) === 'Feld: 4 × 4 Kacheln', ro('de', 4, 3) === 'Feld: 4 × 3 Kacheln', ro('en', 3, 6) === 'Field: 3 × 6 tiles', ro('de', 5, 5).indexOf('Maschen') < 0];
    if (!readouts.every(Boolean)) note('readout', readouts);
    const SRC_NET = fs.readFileSync(process.env.UI_NET_JS || path.join(ROOT, 'ui-net.js'), 'utf8');
    if (!/netDomainEffective\(\{ domain: 'field' \}, netSizeFactors\(\), currentShape\)\.ignored === null/.test(SRC_NET)) note('uiNetShape', 'ui-net.js readout fieldOk does not pass the shape');
    check('(2) optimum hint (square Field, X * Y outside 7..12): in #net-field-info, de and en, never in the triangle / hexagon, never for 3x3, 3x4, 4x3 (9, 12, 12), not in the readout (old words: "Feld: 4 × 4 Kacheln"); ui-net.js reads the shape', !bad.first, J(bad));
}

// ---- 3. the stepper --------------------------------------------------------------------------------------------------------------------------------------
{
    const FORM = fs.readFileSync(process.env.UI_FORM_JS || path.join(ROOT, 'ui-form.js'), 'utf8');
    const cut = FORM.slice(FORM.indexOf('  function fieldActive()'), FORM.indexOf('  function sizeRange('));
    const T_ = { 'reason.size.field.min': 'FMIN', 'reason.size.fieldSq.min': 'SQMIN', 'reason.size.max': 'MAX', 'reason.size.min': 'MIN', 'reason.size.ratio': 'RATIO', 'note.size.field': (a, b) => 'NOTE' + a + b };
    function stepper(shape, open, X, Y, field, axis, dir) {
        const c = vm.createContext({ currentShape: shape, baseNetTransform: field ? { domain: 'field' } : null, sizeLockIsOpen: () => open, gridSizeX: () => X, gridSizeY: () => Y, T: T_, console,
            sizeAxisRange: (ax, other) => { let min = null, max = null; for (let v = 1; v <= 9; v++) { if (Math.max(v, other) <= 3 * Math.min(v, other)) { if (min === null) min = v; max = v; } } return { min, max }; },
            sizeInput: { value: String(X) }, sizeYInput: { value: String(Y) }, parseInt, Math, typeof: undefined });
        vm.runInContext(cut + '\nthis.__c = sizeCompute;', c);
        return J(c.__c(dir, axis));
    }
    const cases = [
        // square, Field, lock closed (X = Y): steps of one, 3..9
        [stepper('square', false, 3, 3, true, 'x', 1), { to: 4 }], [stepper('square', false, 4, 4, true, 'x', 1), { to: 5 }], [stepper('square', false, 5, 5, true, 'x', -1), { to: 4 }], [stepper('square', false, 4, 4, true, 'x', -1), { to: 3 }],
        [stepper('square', false, 3, 3, true, 'x', -1), { to: null, reason: 'SQMIN' }], [stepper('square', false, 9, 9, true, 'x', 1), { to: null, reason: 'MAX' }], [stepper('square', false, 8, 8, true, 'x', 1), { to: 9 }],
        // square, Field, lock open: per axis, ratio <= 1:3
        [stepper('square', true, 3, 4, true, 'x', 1), { to: 4 }], [stepper('square', true, 3, 4, true, 'y', 1), { to: 5 }], [stepper('square', true, 3, 4, true, 'y', -1), { to: 3 }], [stepper('square', true, 4, 3, true, 'y', -1), { to: null, reason: 'SQMIN' }],
        [stepper('square', true, 3, 9, true, 'y', 1), { to: null, reason: 'MAX' }], [stepper('square', true, 3, 9, true, 'x', 1), { to: 4 }], [stepper('square', true, 3, 9, true, 'x', -1), { to: null, reason: 'SQMIN' }], [stepper('square', true, 3, 8, true, 'y', 1), { to: 9 }],
        // triangle (task 108) and hexagon (task 109): steps of one
        [stepper('triangle', false, 5, 5, true, 'x', 1), { to: 6 }], [stepper('hex', false, 5, 5, true, 'x', -1), { to: 4 }], [stepper('triangle', false, 3, 3, true, 'x', -1), { to: null, reason: 'SQMIN' }], [stepper('hex', true, 3, 5, true, 'x', 1), { to: 4 }],
        [stepper('hex', true, 3, 5, true, 'y', 1), { to: 6 }], [stepper('triangle', false, 9, 9, true, 'x', 1), { to: null, reason: 'MAX' }],
        // no Field: steps of one on every shape
        [stepper('square', false, 4, 4, false, 'x', 1), { to: 5 }], [stepper('triangle', true, 3, 5, false, 'x', 1), { to: 4 }], [stepper('hex', false, 2, 2, false, 'x', -1), { to: 1 }],
    ];
    const bad = cases.map(([got, want], i) => [i, got, J(want)]).filter(([, a, b]) => a !== b);
    check(`(3) sizeCompute: the square's Field steps by one from 3 to 9 (lock closed and open, SQMIN below 3, MAX above 9), the triangle / hexagon keep odd twos with their notes, no Field steps by one (${cases.length} cases)`, bad.length === 0 && cases.length >= 22, J(bad));
}

// ---- 4. the Timeline guard -------------------------------------------------------------------------------------------------------------------------------
{
    const w = makeRenderWorld('square', 3, 3, 'rotation_reflection6', FILES);
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const FIELD = { x: { kind: 'trig', w: -0.8 }, y: 'same', repeat: false, domain: 'field' }, FIELD2 = { x: { kind: 'trig', w: 0.5 }, y: 'same', repeat: false, domain: 'field' };
    const REG = { regular: true }, TILED = { x: { kind: 'trig', w: -0.8 }, y: 'same', repeat: true, domain: 'tiled' }, SINGLE = { x: { kind: 'trig', w: -0.8 }, y: 'same', repeat: false };
    const setSize = (X, Y) => w.set(`currentShape = 'square'; shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; setGridSize(${X}, ${Y}); baseNetTransform = null; timeline = null;`);
    const compat = (a, b) => w.get(`(function () { const r = netAnimationCompat(${J(a)}, ${J(b)}); return [r.ok, r.reason]; })()`);
    const HALF = /half a tile/;
    const rows = [
        // [size, from, to, expected ok, reason test]
        [[4, 4], REG, FIELD, false, HALF], [[4, 4], FIELD, REG, false, HALF], [[3, 4], REG, FIELD, false, HALF], [[4, 3], FIELD, REG, false, HALF], [[6, 5], REG, FIELD, false, HALF],   // Aus <-> Field at an even size
        [[4, 4], FIELD, FIELD2, true], [[3, 4], FIELD, FIELD2, true], [[8, 8], FIELD, FIELD, true],                                                                                      // Field <-> Field, same size
        [[4, 4], FIELD, TILED, false, /domain differs/], [[4, 4], TILED, FIELD, false, /domain differs/], [[4, 4], FIELD, SINGLE, false, /domain differs/],                                // another domain
        [[5, 5], REG, FIELD, true], [[3, 5], REG, FIELD, true], [[5, 5], FIELD, FIELD2, true],                                                                                            // odd sizes: as on main
        [[4, 4], REG, TILED, true], [[4, 4], REG, SINGLE, true], [[4, 4], REG, REG, true],                                                                                              // no Field involved: unchanged
        [[2, 2], REG, FIELD, true],                                                                                                                                                     // size 2: a Field is not read there (Single): nothing to guard
    ];
    for (const [[X, Y], a, b, ok, re] of rows) {
        setSize(X, Y); const [got, reason] = compat(a, b);
        if (got !== ok) note('compat', [X, Y, J(a).slice(0, 30), J(b).slice(0, 30), got, reason]);
        else if (re && !re.test(String(reason))) note('reason', [X, Y, reason]);
        if (ok && reason !== null) note('okReason', [X, Y, reason]);
    }
    // timelineNetSegment / timelineNetSummary on a coupled timeline (two keyframes, a net state each)
    const tl = (X, Y, states) => { setSize(X, Y); w.set(`timeline = { keyframeLayerIds: [0, 1], playbackLayerIndex: null, segmentDurationsMs: [2000], segmentPairings: [null], segmentFlips: [null], segmentMembers: [null], netStates: ${J(states)}, currentFrame: { segmentIndex: 0, localT: 0.5 }, netLive: true };`); return w.get('({ coupled: timelineNetCoupled(), seg: (function () { const s = timelineNetSegment(); return [s.spec === null, s.reason]; })(), sum: timelineNetSummary() })'); };
    for (const [X, Y] of [[4, 4], [3, 4]]) { const r = tl(X, Y, [REG, FIELD]); if (!r.coupled || r.seg[0] !== true || !HALF.test(String(r.seg[1])) || r.sum.state !== 'incompatible' || !HALF.test(r.sum.text) || !/author net is shown/.test(r.sum.text)) note('timelineBlocked', [X, Y, r.seg, r.sum && r.sum.state]); }
    for (const [X, Y] of [[4, 4], [5, 5]]) { const r = tl(X, Y, [FIELD, FIELD2]); if (!r.coupled || r.seg[0] !== false || r.sum.state !== 'animated') note('timelineField', [X, Y, r.seg, r.sum && r.sum.state]); }
    { const r = tl(5, 5, [REG, FIELD]); if (r.seg[0] !== false || r.sum.state !== 'animated') note('timelineOdd', [r.seg, r.sum && r.sum.state]); }
    check(`(4) Timeline guard: Aus <-> Field at an even size cannot be interpolated (reason "half a tile", the summary says the author net is shown), Field <-> Field, other domains, odd sizes and nets without a Field as on main (${rows.length} compat rows + 5 timelines)`, !bad.first, J(bad));
}

// ---- 5. callers of netDomainEffective --------------------------------------------------------------------------------------------------------------------------
{
    const read = f => { const env = { 'core/netwarp.js': process.env.NETWARP_JS, 'sketch.js': process.env.SKETCH_JS, 'ui-net.js': process.env.UI_NET_JS, 'core/state.js': process.env.STATE_SABOTAGE_FILE }[f]; return fs.readFileSync(env || path.join(ROOT, f), 'utf8'); };
    const FILES_ = ['core/netwarp.js', 'core/state.js', 'core/export.js', 'core/tiling.js', 'core/spatial-morph-render.js', 'sketch.js', 'ui-net.js', 'ui-form.js', 'gallery-render.js'];
    // the top-level arguments of the call that starts at index i (after the opening parenthesis), brackets and braces respected
    const argsOf = (text, i) => { const out = []; let depth = 0, cur = ''; for (let k = i; k < text.length; k++) { const c = text[k]; if (c === '(' || c === '{' || c === '[') depth++; if (c === ')' || c === '}' || c === ']') { if (depth === 0) { out.push(cur.trim()); return out; } depth--; } if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += c; } return out; };
    const calls = [];
    for (const f of FILES_) { const text = read(f), re = /netDomainEffective\(/g; let m;
        while ((m = re.exec(text))) { const lineStart = text.lastIndexOf('\n', m.index) + 1, line = text.slice(lineStart, text.indexOf('\n', m.index)); if (/^\s*(\/\/|\*)/.test(line) || /function netDomainEffective/.test(line)) continue;
            const args = argsOf(text, m.index + m[0].length), lineNo = text.slice(0, m.index).split('\n').length; calls.push([f, lineNo, line.trim().slice(0, 120), args.length >= 3 && /^(currentShape|'square'|'triangle'|'hex'|shape)$/.test(args[2])]); } }
    const noShape = calls.filter(c => !c[3]);
    console.log('REPORT netDomainEffective callers (file:line, passes the shape):', J(calls.map(c => [c[0] + ':' + c[1], c[3]])));
    // and the function itself: no or an unknown shape reads the conservative rule (an even count is never a Field), the triangle (task 108), the hexagon (task 109) and the square take it
    { const wd = makeRenderWorld('square', 3, 3, 'rotation_reflection6', FILES), ok = (shape) => wd.get(`netDomainEffective({ domain: 'field' }, { x: 4, y: 4 }${shape === undefined ? '' : ', ' + J(shape)}).ignored === null`);
      check('(5b) netDomainEffective at 4/4: no shape, null, "" and an unknown shape refuse the even Field, triangle and hexagon refuse it, the square takes it', !ok() && !ok(null) && !ok('') && !ok('circle') && ok('triangle') && ok('hex') && ok('square')); }
    check(`(5) every netDomainEffective caller passes the shape (${calls.length} callers in core/, sketch.js, ui-*.js, gallery-render.js)`, calls.length >= 8 && noShape.length === 0, J(noShape));
}

// ---- 6. sabotage runs ----------------------------------------------------------------------------------------------------------------------------------------
if (!CHILD) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evenui106-'));
    const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
    const SAB = [
        ['an unknown or missing shape is read as the square', 'NETWARP_JS', 'core/netwarp.js', "const sq = shape === 'square', evenOk = (sq || shape === 'triangle' || shape === 'hex') && n % 2 === 0;", "const sq = shape !== 'triangle' && shape !== 'hex', evenOk = (sq || shape === 'triangle' || shape === 'hex') && n % 2 === 0;"],
        ['floor 2 by default', 'NETWARP_JS', 'core/netwarp.js', 'let netFieldMinTiles = 3;', 'let netFieldMinTiles = 2;'],
        ['Timeline guard removed (Aus <-> Field at an even size interpolates)', 'NETWARP_JS', 'core/netwarp.js', "if (dom === 'field' && A.any !== B.any && typeof currentShape", "if (false && dom === 'field' && A.any !== B.any && typeof currentShape"],
        ['stepper: the square steps in twos in a Field (lock open)', 'UI_FORM_JS', 'ui-form.js', "      if (fieldActive() && fieldAnySize()) {   // task 106 / 108: the square's and the triangle's Field: steps of one", "      if (false && fieldActive() && fieldAnySize()) {   // task 106 / 108: the square's and the triangle's Field: steps of one"],
        ['stepper: the square steps in twos in a Field (lock closed)', 'UI_FORM_JS', 'ui-form.js', "    if (fieldActive() && fieldAnySize()) {   // task 106 / 108: the square's and the triangle's Field, lock closed", "    if (false && fieldActive() && fieldAnySize()) {   // task 106 / 108: the square's and the triangle's Field, lock closed"],
        ['hint key net.hint.fieldMin missing', 'UI_I18N_JS', 'ui-i18n.js', "'net.hint.fieldMin': {", "'net.hint.fieldMinX': {"],
        ['hint key net.hint.optimum without its english text', 'UI_I18N_JS', 'ui-i18n.js', "en: 'According to Hinterreiter (vol. II, p. 17) square nets work best with 7 to 12 meshes; this net has {w}.'", "en: ''"],
        ['the optimum hint in the size hint instead of #net-field-info', 'SKETCH_JS', 'sketch.js', "if (active && isField) htmlOnce(fieldInfo, `Field: macro", "if (active && isField) htmlOnce(sizeHint, `Field: macro"],
        ['the hint line keeps the odd text on the square', 'SKETCH_JS', 'sketch.js', "const hk = evenShape ? 'net.hint.fieldMin' : 'net.hint.fieldOdd';", "const hk = 'net.hint.fieldOdd';"],
        ['the shape rule of the controls reads every shape as the square', 'SKETCH_JS', 'sketch.js', "sqShape = currentShape === 'square', evenShape = sqShape || currentShape === 'triangle' || currentShape === 'hex';", "sqShape = true, evenShape = true;"],
        ['the readout of ui-net.js does not pass the shape (an even square reads as Single)', 'UI_NET_JS', 'ui-net.js', "netDomainEffective({ domain: 'field' }, netSizeFactors(), currentShape).ignored === null", "netDomainEffective({ domain: 'field' }, netSizeFactors()).ignored === null"],
        ['a caller forgets the shape (core/state.js resize hint)', 'STATE_CALLER', 'core/state.js', "netDomainEffective(sp, netSizeFactors(), currentShape)", "netDomainEffective(sp, netSizeFactors())"],
    ];
    let red = 0; const notRed = [];
    SAB.forEach(([name, envKey, file, from, to], i) => {
        const src = rd(file); if (src.split(from).length !== 2) { notRed.push([name, 'pattern not found once']); return; }
        const f = path.join(dir, 'sab' + i + '-' + path.basename(file)); fs.writeFileSync(f, src.replace(from, () => to));
        const env = Object.assign({}, process.env); if (envKey === 'STATE_CALLER') env.NETWARP_JS = path.join(ROOT, 'core', 'netwarp.js'); else env[envKey] = f;
        if (envKey === 'STATE_CALLER') env.STATE_SABOTAGE_FILE = f;
        const r = spawnSync(process.execPath, [__filename], { env, encoding: 'utf8', maxBuffer: 1 << 26 });
        if (r.status !== 0) red++; else notRed.push([name, 'still green']);
    });
    check(`(6) ${SAB.length} sabotage runs on mutated copies: every one fails the test`, red === SAB.length && notRed.length === 0, J(notRed));
}
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
