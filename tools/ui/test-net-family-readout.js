// Task 111 (F1): the name of the net family in the Netz readout (square: □N, triangle: △N, hexagon: *N; Hinterreiter vol. II p. 10 / p. 14). Only for a Field and only while a net is active; readoutText() is unchanged.
//   node tools/ui/test-net-family-readout.js      sabotage runs (section 6): the test runs ITSELF against mutated copies via UI_NET_READOUT_JS, UI_NET_JS, SKETCH_JS, UI_I18N_JS
//   1. the pure function readoutFamily(shape, domain, active, t): name only for domain field AND active; Single, Tiled, an inactive net, an unknown shape give ''
//   2. the real readout line of ui-net.js (its sync block run on the render world's state): "△N · Feld: ..." for the three shapes at several sizes, de and en; Off / Single / Tiled: the old line, no name
//   3. the dictionary: six keys in de and en, the three marks belong to their shape, the three sentences name the page (10 / 14) and the net
//   4. readoutText() byte-equal to main for every domain x n x m x cut x hex (the line the name is put in front of)
//   5. #net-field-info (real initNetControls): the sentence of the shape at an active Field net, de and en, after the old english paragraph; none without a Field net; the old sentence is untouched
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), { spawnSync, execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const CHILD = !!(process.env.UI_NET_READOUT_JS || process.env.UI_NET_JS || process.env.SKETCH_JS || process.env.UI_I18N_JS);
const { makeRenderWorld } = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const MODEL = require(process.env.UI_NET_READOUT_JS || path.join(ROOT, 'ui-net-readout.js'));
const NET = fs.readFileSync(process.env.UI_NET_JS || path.join(ROOT, 'ui-net.js'), 'utf8');
const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const NET_IIFE = (SKETCH.match(/\(function initNetControls\(\) \{[\s\S]*?\n    \}\)\(\);/) || [''])[0];
const ictx = vm.createContext({ window: {}, document: undefined, console }); ictx.window.document = undefined;
vm.runInContext(fs.readFileSync(process.env.UI_I18N_JS || path.join(ROOT, 'ui-i18n.js'), 'utf8'), ictx, { filename: 'ui-i18n.js' });
const I = vm.runInContext('typeof uiI18n !== "undefined" ? uiI18n : window.uiI18n', ictx);
const T = lang => (k, p) => { I.setLang(lang); return I.t(k, p); };
const MARK = { square: '□N', triangle: '△N', hex: '*N' }, PAGE = { square: 'S. 10', triangle: 'S. 14', hex: 'S. 14' }, PAGE_EN = { square: 'p. 10', triangle: 'p. 14', hex: 'p. 14' };

// ---- 1. the pure function ----------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0;
    for (const lang of ['de', 'en']) for (const shape of ['square', 'triangle', 'hex', 'circle', undefined, '']) for (const dom of ['field', 'tiled', 'single', 'x', undefined]) for (const active of [true, false, undefined]) {
        n++; const got = MODEL.readoutFamily(shape, dom, active, T(lang)), want = dom === 'field' && active && MARK[shape] ? MARK[shape] : '';
        if (got !== want) note('family', [lang, shape, dom, active, got]);
    }
    check(`(1) readoutFamily: the mark of the shape for a Field with an active net, '' for Single, Tiled, an inactive net and an unknown shape (${n} calls, de and en)`, !bad.first && n === 2 * 6 * 5 * 3, J(bad));
}

// ---- 2. the real readout line ------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0, named = 0;
    const start = NET.indexOf('    if (readoutEl && window.netReadout) {'), endTag = '      if (readoutEl.textContent !== line) readoutEl.textContent = line;\n    }', end = NET.indexOf(endTag, start);
    if (start < 0 || end < 0) note('block', 'the readout block of ui-net.js was not found');
    const BLOCK = start < 0 || end < 0 ? '' : NET.slice(start, end + endTag.length);
    for (const shape of ['square', 'triangle', 'hex']) {
        const w = makeRenderWorld(shape, 3, 3, 'rotation_reflection6'); w.sb.window = w.sb; w.sb.netReadout = MODEL;
        for (const [X, Y] of [[3, 3], [4, 4], [3, 5], [6, 5], [9, 9]]) for (const kind of ['field', 'tiled', 'single', 'off']) for (const lang of ['de', 'en']) {
            w.set(`currentShape = ${J(shape)}; projectGridSpec({ shape: ${J(shape)}, ordnung: 4, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y}); rebuildGrid(currentShape);
                baseNetTransform = ${kind === 'off' ? 'null' : J(kind === 'field' ? { x: { kind: 'trig', w: -0.5 }, y: 'same', repeat: false, domain: 'field' } : kind === 'tiled' ? { x: { kind: 'trig', w: -0.5 }, y: 'same', repeat: true, domain: 'tiled' } : { x: { kind: 'trig', w: -0.5 }, y: 'same', repeat: false })};`);
            const el = { textContent: '' }, dom = kind === 'off' ? 'single' : kind;
            w.sb.__run = vm.runInContext(`(function ($, readoutEl, UI) { ${BLOCK} })`, w.sb);
            w.sb.__run(() => ({ dataset: { domain: dom } }), el, { t: T(lang) }); n++;
            const line = el.textContent, fieldValid = w.get("netDomainEffective({ domain: 'field' }, netSizeFactors(), currentShape).ignored === null"), want = kind === 'field' && fieldValid && w.get('netWarpActive()') ? MARK[shape] + ' · ' : null;
            if (want) { named++; if (!line.startsWith(want) || !line.slice(want.length).startsWith(lang === 'de' ? 'Feld: ' : 'Field: ')) note('named', [shape, X, Y, lang, line]); }
            else if (line.includes('·') || /[□△]N|\*N/.test(line)) note('unnamed', [shape, X, Y, kind, lang, line]);
        }
    }
    check(`(2) the readout line of ui-net.js: "${'△N'} · Feld: ..." in front of the Field line (${named} named of ${n} runs: 3 shapes x 5 sizes x Field / Tiled / Single / Off x de / en), no name for Tiled, Single, Off`, !bad.first && n === 120 && named >= 25, J(bad) + ` n=${n} named=${named}`);
}

// ---- 3. the dictionary ---------------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    for (const lang of ['de', 'en']) for (const shape of ['square', 'triangle', 'hex']) {
        const t = T(lang), mark = t('net.family.' + shape), info = t('net.family.info.' + shape);
        if (mark !== MARK[shape]) note('mark', [lang, shape, mark]); if (!info.includes(MARK[shape]) || !info.includes(lang === 'de' ? PAGE[shape] : PAGE_EN[shape])) note('info', [lang, shape, info]);
        if (/versatz|halbe|shift|half/i.test(info)) note('wording', [lang, shape]);
    }
    const expect = { de: { square: 'Netzfamilie □N (Quadratnetz, Hinterreiter Band II, S. 10).', triangle: 'Netzfamilie △N (Dreiecknetz, Hinterreiter Band II, S. 14).', hex: 'Netzfamilie *N (Sechsecknetz, Hinterreiter Band II, S. 14).' },
        en: { square: 'Net family □N (square net, Hinterreiter vol. II, p. 10).', triangle: 'Net family △N (triangle net, Hinterreiter vol. II, p. 14).', hex: 'Net family *N (hexagon net, Hinterreiter vol. II, p. 14).' } };
    for (const lang of ['de', 'en']) for (const shape of ['square', 'triangle', 'hex']) if (T(lang)('net.family.info.' + shape) !== expect[lang][shape]) note('text', [lang, shape, T(lang)('net.family.info.' + shape)]);
    { const SRC = fs.readFileSync(process.env.UI_I18N_JS || path.join(ROOT, 'ui-i18n.js'), 'utf8');   // an english text that is missing falls back to the german one: read the entries themselves
      for (const k of ['net.family.square', 'net.family.triangle', 'net.family.hex', 'net.family.info.square', 'net.family.info.triangle', 'net.family.info.hex']) { const m = new RegExp("'" + k.replace(/\./g, '\\.') + "': \\{ de: '[^']+', en: '[^']+' \\}").exec(SRC); if (!m) note('entry', k); } }
    check('(3) six keys in de and en: the three marks (□N, △N, *N) and the three sentences with the page of the source (10 / 14), as approved', !bad.first, J(bad));
}

// ---- 4. readoutText unchanged ---------------------------------------------------------------------------------------------------------------------------
if (!CHILD) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fam111-')), f = path.join(dir, 'ui-net-readout.js');
    fs.writeFileSync(f, execSync('git show main:ui-net-readout.js', { cwd: ROOT, maxBuffer: 1 << 24 }));
    const OLD = require(f); let n = 0; const diffs = [];
    for (const dom of ['field', 'tiled', 'single', 'x', undefined]) for (const nn of [1, 3, 4, 5, 9, 12, 0, 'a']) for (const m of [undefined, 3, 4, 5, 9, 27]) for (const cut of [false, true, undefined]) for (const hex of [false, true, undefined]) for (const lang of ['de', 'en']) {
        n++; if (OLD.readoutText(dom, nn, T(lang), m, cut, hex) !== MODEL.readoutText(dom, nn, T(lang), m, cut, hex)) diffs.push([dom, nn, m, cut, hex, lang]);
    }
    check(`(4) readoutText() byte-equal to main for every domain x n x m x cut x hex x language (${n} calls); readoutDomain and readoutKey too`, !diffs.length && ['field', 'tiled', 'single', 'x'].every(d => OLD.readoutKey(d) === MODEL.readoutKey(d)) && OLD.readoutDomain('field', false) === MODEL.readoutDomain('field', false), J(diffs.slice(0, 3)));
}

// ---- 5. #net-field-info -------------------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0, withFam = 0;
    function fakeEl(dataset) { let val = '0', html = ''; const cls = new Set();
        const elt = { dataset: dataset || {}, hidden: false, disabled: false, title: '', textContent: '', innerHTML: '', addEventListener() { }, dispatchEvent() { }, classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, on) => { const want = on === undefined ? !cls.has(c) : !!on; if (want) cls.add(c); else cls.delete(c); return want; } } };
        const p = { elt, press: null, inputFn: null, value(v) { if (v === undefined) return val; val = String(v); return p; }, html(s) { if (s === undefined) return html; html = s; elt.textContent = s; return p; }, mousePressed(fn) { p.press = fn; return p; }, input(fn) { p.inputFn = fn; return p; } }; return p; }
    const info = (shape, X, Y, lang, field) => {
        const w = makeRenderWorld(shape, 3, 3, 'rotation_reflection6'), sb = w.sb, els = new Map();
        w.set(`currentShape = ${J(shape)}; projectGridSpec({ shape: ${J(shape)}, ordnung: 4, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y}); rebuildGrid(currentShape); baseNetTransform = null;`);
        const kinds = ['regular', 'sinus', 'tangens', 'geometric'].map(k => fakeEl({ kind: k })), axes = ['both', 'x', 'y'].map(a => fakeEl({ axes: a })), domains = ['single', 'tiled', 'field'].map(d => fakeEl({ domain: d }));
        sb.select = id => { if (!els.has(id)) els.set(id, fakeEl()); return els.get(id); }; sb.selectAll = s => (s === '.net-kind-btn' ? kinds : s === '.net-axes-btn' ? axes : s === '.net-domain-btn' ? domains : []);
        sb.UI = { toast() { }, t: T(lang) }; sb.nodeInput = null; sb.curveBtn = null; sb.freeBtn = null; sb.faceBtn = null; sb.updateCurveTypeControls = () => { };
        sb.window = sb; sb.say = () => { }; sb.setNetAnimationStatus = () => { }; sb.syncNetAnimationLock = () => { }; sb.redraw = () => { }; sb.sessionFlushNow = () => { };
        sb.document = Object.assign(sb.document || {}, { body: {}, createElement: () => ({ style: {}, classList: { add() { }, toggle() { } }, addEventListener() { }, appendChild() { } }) });
        vm.runInContext('var adoptNetState = null; var netControlsSync = null; var netLinesOn = false; var syncNetControls = null;', sb); vm.runInContext(NET_IIFE, sb, { filename: 'sketch.js initNetControls' });
        kinds[0].press(); if (field) { kinds[1].press(); const inp = els.get('#net-strength-input'); inp.value('50'); inp.inputFn(); } sb.netControlsSync();
        const fi = els.get('#net-field-info'); return { text: fi.elt.textContent, hidden: fi.elt.hidden };
    };
    const OLD = /Face fills are exact on a Field and work for the base sheet and for layers on the base grid \(same shape and size, no offset, no rotation - every timeline playback layer\); other layers are not filled\./;
    for (const shape of ['square', 'triangle', 'hex']) for (const [X, Y] of [[3, 3], [4, 4], [5, 3]]) for (const lang of ['de', 'en']) {
        n++; const on = info(shape, X, Y, lang, true), off = info(shape, X, Y, lang, false), sentence = T(lang)('net.family.info.' + shape);
        if (on.hidden || !OLD.test(on.text) || !on.text.trimEnd().endsWith(sentence)) note('on', [shape, X, Y, lang, on.text.slice(-120)]); else withFam++;
        if (!off.hidden && off.text.includes(sentence)) note('off', [shape, X, Y, lang]);
        if (/Net family|Netzfamilie/.test(off.text)) note('offText', [shape, X, Y, lang]);
    }
    check(`(5) #net-field-info: with an active Field net the sentence of the shape stands after the old paragraph (${withFam} of ${n} runs: 3 shapes x 3 sizes x de / en), the old english sentence is unchanged, no sentence without a net`, !bad.first && n === 18 && withFam === n, J(bad));
}

// ---- 6. sabotage runs ---------------------------------------------------------------------------------------------------------------------------------------
if (!CHILD) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fam111s-')), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
    const SAB = [
        ['the triangle reads the square mark', 'UI_NET_READOUT_JS', 'ui-net-readout.js', "triangle: 'net.family.triangle'", "triangle: 'net.family.square'"],
        ['the name also with an inactive net (Art Aus)', 'UI_NET_READOUT_JS', 'ui-net-readout.js', "if (domain !== 'field' || !active ||", "if (domain !== 'field' ||"],
        ['the name also for Tiled and Single', 'UI_NET_READOUT_JS', 'ui-net-readout.js', "if (domain !== 'field' || !active ||", "if (!active ||"],
        ['an unknown shape gets a name', 'UI_NET_READOUT_JS', 'ui-net-readout.js', "|| !Object.prototype.hasOwnProperty.call(FAMILY_KEYS, shape)) return '';\n    return t(FAMILY_KEYS[shape]);", ") return '';\n    return t(FAMILY_KEYS[shape] || FAMILY_KEYS.square);"],
        ['readoutText carries the name itself (the pinned line changes)', 'UI_NET_READOUT_JS', 'ui-net-readout.js', "return t(readoutKey(domain), { n: vn });\n  }", "return (domain === 'field' ? '\\u25a1N \\u00b7 ' : '') + t(readoutKey(domain), { n: vn });\n  }"],
        ['ui-net.js does not pass the active flag (always inactive)', 'UI_NET_JS', 'ui-net.js', "typeof netWarpActive === 'function' && netWarpActive(), UI.t)", "false, UI.t)"],
        ['ui-net.js writes the name behind the line', 'UI_NET_JS', 'ui-net.js', "line = family ? family + ' \\u00b7 ' + text : text;", "line = family ? text + ' \\u00b7 ' + family : text;"],
        ['the english sentence of the hexagon is missing', 'UI_I18N_JS', 'ui-i18n.js', "en: 'Net family *N (hexagon net, Hinterreiter vol. II, p. 14).'", "en: ''"],
        ['the mark key of the hexagon is missing in en', 'UI_I18N_JS', 'ui-i18n.js', "'net.family.hex': { de: '*N', en: '*N' }", "'net.family.hex': { de: '*N' }"],
        ['the sentence of #net-field-info is removed', 'SKETCH_JS', 'sketch.js', "${optHint}${famHint}`);", "${optHint}`);"],
        ['the sentence also without a Field net', 'SKETCH_JS', 'sketch.js', "const famHint = evenShape && window.UI && UI.t ? ' ' + UI.t('net.family.info.' + currentShape) : '';", "const famHint = evenShape && window.UI && UI.t ? ' ' + UI.t('net.family.info.' + currentShape) : ''; if (!isField) htmlOnce(fieldInfo, UI.t('net.family.info.' + currentShape));"],
    ];
    let red = 0; const notRed = [];
    SAB.forEach(([name, envKey, file, from, to], i) => {
        const src = rd(file); if (src.split(from).length !== 2) { notRed.push([name, 'pattern not found once']); return; }
        const f = path.join(dir, 'sab' + i + '-' + path.basename(file)); fs.writeFileSync(f, src.replace(from, () => to));
        const r = spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { [envKey]: f }), encoding: 'utf8', maxBuffer: 1 << 26 });
        if (r.status !== 0) red++; else notRed.push([name, 'still green']);
    });
    check(`(6) ${SAB.length} sabotage runs on mutated copies: every one fails the test`, red === SAB.length && notRed.length === 0, J(notRed));
}
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
