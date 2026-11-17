// Task 084 (entry 2): the per-draw writers repaired here write the DOM only when the value CHANGES. The REAL code of each site runs on a DOM stub with write counters:
//   1. ui-lines.js        aria-pressed / aria-expanded of #btn-toggle-lines            (whole file in a vm)
//   2. ui-net.js          aria-valuenow / aria-valuetext of #net-strength-value, #net-focus-value   (the sync block, cut out of the real file)
//   3. ui-farbe.js        #farbe-anchor-register-display, #farbe-anchor-hue-context-dreieck text, #farbe-harmony-select disabled   (the statements, cut out)
//   4. sketch.js          updateFaceColorsPanel (#face-colors-group hidden) and netControlsSync (#net-group, #net-field-btn title, #net-field-hint / -info, #net-size-hint, #net-macro-row / -hint)
// For each: a repeated call with unchanged input writes 0 times; a REAL change is written exactly (not suppressed): the value shown afterwards is the new one.
//   node tools/ui/test-draw-writes.js
//   SKETCH_JS=... UI_LINES_JS=... UI_NET_JS=... UI_FARBE_JS=... node tools/ui/test-draw-writes.js        (sabotage runs on copies)
// What is NOT covered (reported in reports/084.md): the Stepper buttons (UI.setDisabled flip-flop between ui-farbe.js and the stepper's own refresh: two writers, not a repeated value).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;

// ---- a DOM stub that counts writes: every property / attribute assignment is one write, whether or not the value changed (like the MutationObserver in the browser) ----
const writes = {};
const bump = (id, k) => { writes[id + '.' + k] = (writes[id + '.' + k] || 0) + 1; };
const total = () => Object.values(writes).reduce((a, b) => a + b, 0);
const reset = () => Object.keys(writes).forEach(k => delete writes[k]);
function mkEl(id) {
    const st = { hidden: false, disabled: false, title: '', textContent: '', innerHTML: '' };
    const e = { id, attrs: {}, dataset: {}, classList: { toggle() { }, add() { }, remove() { } },
        getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; },
        setAttribute(k, v) { bump(id, 'attr:' + k); this.attrs[k] = String(v); },
        hasAttribute(k) { return this.attrs[k] !== undefined; }, removeAttribute(k) { delete this.attrs[k]; },
        addEventListener(t, f) { (this.handlers = this.handlers || {})[t] = f; }, closest() { return null; } };
    ['hidden', 'disabled', 'title', 'textContent', 'innerHTML'].forEach(p => Object.defineProperty(e, p, { get() { return st[p]; }, set(v) { bump(id, p); st[p] = v; } }));
    e.elt = e; e.html = function (t) { this.innerHTML = t; return this; };   // p5 wrapper: .html() replaces the content = a write
    return e;
}
const strip = s => s;   // the sources are read as they are; the cut-outs below use markers

// ================= 1. ui-lines.js (the whole file) =================
{
    const src = read('UI_LINES_JS', 'ui-lines.js');
    const els = { 'btn-toggle-lines': mkEl('btn'), 'line-weight-group': mkEl('group'), 'line-weight-input': mkEl('input'), 'line-weight-value': mkEl('out') };
    els['line-weight-input'].value = '2';
    let sync = null;
    const sb = { document: { getElementById: id => els[id] || null }, lineStyle: { visible: true, weight: 2 }, LINE_WEIGHT: { min: 1, max: 8 }, UI: { onSync: f => { sync = f; } }, redraw() { }, Number, isFinite, Math };
    vm.createContext(sb);
    vm.runInContext(src, sb);
    reset(); sync(); sync(); sync();
    check('(1) ui-lines.js: three syncs with unchanged state write nothing (aria-pressed, aria-expanded): 0', total() === 0, J(writes));
    reset(); vm.runInContext('lineStyle = { visible: false, weight: 2 };', sb); sync();
    check('(1) a real change (lines off) IS written: aria-pressed "false", exactly one write', writes['btn.attr:aria-pressed'] === 1 && els['btn-toggle-lines'].attrs['aria-pressed'] === 'false', J([writes, els['btn-toggle-lines'].attrs]));
    reset(); sync(); check('(1) and the next sync writes 0 again', total() === 0, J(writes));
    reset(); vm.runInContext('lineStyle = { visible: true, weight: 2 };', sb); sync();
    check('(1) back on: aria-pressed "true" is written once', writes['btn.attr:aria-pressed'] === 1 && els['btn-toggle-lines'].attrs['aria-pressed'] === 'true', J(writes));
    reset(); els['btn-toggle-lines'].handlers.click(); sync(); sync();
    check('(1) the click that opens the slider writes aria-expanded "true" exactly once (a real change), the syncs after it 0', writes['btn.attr:aria-expanded'] === 1 && els['btn-toggle-lines'].attrs['aria-expanded'] === 'true' && !writes['btn.attr:aria-pressed'], J(writes));
}

// ================= 2. ui-net.js (the aria block of sync) =================
{
    const src = read('UI_NET_JS', 'ui-net.js');
    const a = src.indexOf('    const sp = (parseInt(strengthInput.value, 10)'), b = src.indexOf("setAria(focusDisplay, 'aria-valuetext', focusDisplay.textContent);");
    check('(2) the aria block is found in ui-net.js', a > 0 && b > a);
    if (a > 0 && b > a) {
        const block = src.slice(a, b + "setAria(focusDisplay, 'aria-valuetext', focusDisplay.textContent);".length);
        const sd = mkEl('strength'), fd = mkEl('focus'); sd.textContent = '0.5'; fd.textContent = '0.0'; reset();
        const sb = { strengthInput: { value: '50' }, focusInput: { value: '0' }, strengthDisplay: sd, focusDisplay: fd, parseInt, String };
        vm.createContext(sb);
        const run = () => vm.runInContext('(function () {' + block + '\n})()', sb);
        run(); reset(); run(); run(); run();
        check('(2) ui-net.js: three syncs with unchanged values write nothing (4 aria attributes): 0', total() === 0, J(writes));
        sb.strengthInput.value = '80'; sd.textContent = '0.8'; reset(); run();
        check('(2) a real change (strength 0.8) IS written: aria-valuenow "0.8" and aria-valuetext "0.8", one write each, focus untouched', writes['strength.attr:aria-valuenow'] === 1 && writes['strength.attr:aria-valuetext'] === 1 && total() === 2 && sd.attrs['aria-valuenow'] === '0.8' && sd.attrs['aria-valuetext'] === '0.8', J([writes, sd.attrs]));
    }
}

// ================= 3. ui-farbe.js (the guarded statements) =================
{
    const src = read('UI_FARBE_JS', 'ui-farbe.js');
    const cut = (from, toMarker) => { const a = src.indexOf(from); if (a < 0) return null; const b = src.indexOf(toMarker, a); return b < 0 ? null : src.slice(a, src.indexOf('\n', b)); };
    const regBlock = cut('const registerText =', '// task 084: only when the text changes');
    const hueBlock = cut('const hueContextText =', '// task 084: only when the text changes');
    const disBlock = cut('if (harmonySelect && harmonySelect.disabled !==', '// task 084: only when it changes');
    check('(3) the three statements are found in ui-farbe.js', !!(regBlock && hueBlock && disBlock));
    if (regBlock && hueBlock && disBlock) {
        const rd = mkEl('register'), hc = mkEl('hue'), hs = mkEl('harmony');
        const sb = { a: { registerIndex: 2, hueIndex: 5 }, registerDisplay: rd, anchorHueContextDreieck: hc, harmonySelect: hs, loadingAny: null, FARBORGEL_REGISTER_ORDER: ['A', 'B', 'C'], T: { 'anchor.hue.context': h => 'Hue ' + h }, String };
        vm.createContext(sb);
        const run = () => { [regBlock, hueBlock, disBlock].forEach(bl => vm.runInContext('(function () {' + bl + '\n})()', sb)); };
        run(); reset(); run(); run(); run();
        check('(3) ui-farbe.js: three runs with unchanged state write nothing (register text, hue context, harmony select): 0', total() === 0, J(writes));
        reset(); sb.a = { registerIndex: 1, hueIndex: 5 }; sb.loadingAny = 'loading'; run();
        check('(3) real changes ARE written: register "B" (1 write), harmony select disabled (1 write), hue context untouched', writes['register.textContent'] === 1 && rd.textContent === 'B' && writes['harmony.disabled'] === 1 && hs.disabled === true && !writes['hue.textContent'], J([writes, rd.textContent]));
        reset(); sb.a = { registerIndex: null, hueIndex: 6 }; sb.loadingAny = null; run();
        check('(3) register "–", hue context "Hue 6", select enabled again: one write each', writes['register.textContent'] === 1 && rd.textContent === '–' && writes['hue.textContent'] === 1 && hc.textContent === 'Hue 6' && writes['harmony.disabled'] === 1 && hs.disabled === false, J(writes));
    }
}

// ================= 4. sketch.js =================
const SK = read('SKETCH_JS', 'sketch.js');
{   // updateFaceColorsPanel
    const m = SK.match(/\nfunction updateFaceColorsPanel\([\s\S]*?\n\}\n/);
    check('(4) updateFaceColorsPanel is found in sketch.js', !!m);
    if (m) {
        const g = mkEl('face-colors-group'), note = mkEl('overlay-note');
        const sb = { document: { getElementById: id => id === 'face-colors-group' ? g : id === 'face-colors-overlay-note' ? note : null }, visible: true, activeShowFaces: () => sb.visible, faceColorsSignature: 'x', faceHover: null, crossLayerResult: null, crossLayerResultSignature: null, crossLayerConfigSignature: () => 's', faceColorsSig: () => 'x', renderFaceColorsPanel() { } };
        vm.createContext(sb); vm.runInContext(m[0], sb);
        const call = () => vm.runInContext('updateFaceColorsPanel()', sb);
        g.hidden = true; call(); reset(); call(); call(); call();   // visible: the first call shows it
        check('(4) updateFaceColorsPanel: three calls with the panel state unchanged write #face-colors-group.hidden 0 times', !writes['face-colors-group.hidden'], J(writes));
        reset(); sb.visible = false; call();
        check('(4) a real change (Fill off) IS written: hidden true, exactly once', writes['face-colors-group.hidden'] === 1 && g.hidden === true, J(writes));
        reset(); call(); call(); check('(4) and again 0 while it stays hidden', !writes['face-colors-group.hidden'], J(writes));
        reset(); sb.visible = true; call(); check('(4) back on: hidden false, exactly once', writes['face-colors-group.hidden'] === 1 && g.hidden === false, J(writes));
    }
}
{   // netControlsSync: the real initNetControls IIFE, with the setup() closures stubbed
    const a = SK.indexOf('    (function initNetControls() {'), b = SK.indexOf('\n    })();', a);
    check('(4) the initNetControls block is found in sketch.js', a > 0 && b > a);
    if (a > 0 && b > a) {
        const block = SK.slice(a, b + '\n    })();'.length);
        const ids = ['net-group', 'net-strength-input', 'net-strength-value', 'net-strength-row', 'net-focus-row', 'net-focus-input', 'net-focus-value', 'net-focus-hint', 'net-geo-row', 'net-reverse-btn', 'net-alternate-btn', 'net-size-hint', 'net-field-btn', 'net-field-hint', 'net-field-info', 'net-macro-row', 'net-macro-buttons', 'net-macro-hint', 'net-lines-btn'];
        const els = {}; ids.forEach(id => { const e = mkEl(id); e.mousePressed = () => { }; e.input = () => { }; e.value = () => 0; e.removeClass = () => { }; els[id] = e; });
        els['net-field-btn'].elt.title = 'Field: the law spans all tiles'; els['net-macro-buttons'].elt.appendChild = () => { };
        const sb = { select: s => els[s.replace('#', '')] || null, selectAll: () => [], document: { createElement: () => mkEl('created') }, window: {}, Math, Number, Object, String, JSON,
            curveBtn: null, freeBtn: null, faceBtn: null, nodeInput: null, say() { }, lockBtn() { }, updateCurveTypeControls() { }, redraw() { }, netLinesOn: false,
            currentShape: 'square', activeLayer: 'base', shapeSizeFactor: 3, nodeCount: 5, gridSpec: { ordnung: 5 }, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, timeline: null,
            netWarpActive: () => !!sb.baseNetTransform, netDomainEffective: (s, R) => { const ok = n => n % 2 === 1 && n >= 3 && n <= 9; return { ignored: (R && typeof R === 'object' ? ok(R.x) && ok(R.y) : ok(R)) ? null : 'even' }; }, /* task 086: R is the tile counts {x, y} now (was a number) */ baseGridDivisions: () => 4, netMacroOptions: () => [4], netMacroEffective: () => ({ valid: true }), netSpecMacro2Real: () => false,
            layerGridMatchesBase: () => true, additionalLayers: [], gridMinOrdnungTrig: () => 3, stateDomain: undefined };
        vm.createContext(sb);
        vm.runInContext('var netControlsSync = null, adoptNetState = null; var render = undefined;', sb);
        let err = null;
        try { vm.runInContext(block.replace('let adoptNetState = null;', ''), sb); } catch (e) { err = e; }
        check('(4) the initNetControls block runs on the stub', !err && typeof vm.runInContext('netControlsSync', sb) === 'function', err && String(err.stack).slice(0, 400));
        if (!err && typeof vm.runInContext('netControlsSync', sb) === 'function') {
            const call = () => vm.runInContext('netControlsSync()', sb);
            call(); reset(); call(); call(); call();
            check('(4) netControlsSync (net off): three calls with unchanged state write NOTHING (#net-group, #net-field-btn title, #net-field-hint, #net-field-info, #net-size-hint, #net-macro-row, #net-macro-hint): 0', total() === 0, J(writes));
            // a real change: size 4 (even: Field is not available) -> field hint shown, title changes, once; then 0
            reset(); sb.shapeSizeFactor = 4; call();
            check('(4) a real change (Shape Size 4, Field not available) IS written: the field hint is shown (hidden false), the Field button title changes, once each', writes['net-field-hint.hidden'] === 1 && els['net-field-hint'].hidden === false && writes['net-field-btn.title'] === 1 && els['net-field-btn'].title.startsWith('Field needs an odd'), J([writes, els['net-field-btn'].title]));
            reset(); call(); call(); check('(4) and the next calls write 0 again', total() === 0, J(writes));
            // net on (Field, size 3): the group info text is written once, not on every call
            reset(); sb.shapeSizeFactor = 3; sb.baseNetTransform = { x: { kind: 'trig', w: -0.5 }, y: 'same', domain: 'field', repeat: false }; call();
            const firstOn = Object.assign({}, writes);
            check('(4) net on (Field, size 3): the Field info is shown (hidden false) and its text is written once', firstOn['net-field-info.hidden'] === 1 && els['net-field-info'].hidden === false && firstOn['net-field-info.innerHTML'] === 1, J(firstOn));
            reset(); call(); call(); call();
            check('(4) net on: three more calls write 0 (hidden flags and the info text)', total() === 0, J(writes));
            reset(); sb.baseNetTransform = null; call();
            check('(4) net off again: the info is hidden again (a real change, once)', writes['net-field-info.hidden'] === 1 && els['net-field-info'].hidden === true, J(writes));
        }
    }
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
