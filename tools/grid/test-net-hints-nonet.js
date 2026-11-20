// Task 092 (point 2): the hint at an even size says what is true. Square: a Single net is drawn ("Einzelnetz"); triangle and hexagon have no Single net: "kein Netz".
//   node tools/grid/test-net-hints-nonet.js      sabotage runs: SKETCH_JS, UI_I18N_JS (mutated copies)
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const { makeRenderWorld } = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const NET_IIFE = (SKETCH.match(/\(function initNetControls\(\) \{[\s\S]*?\n    \}\)\(\);/) || [''])[0];
function fakeEl(dataset) {
    let val = '0', html = ''; const cls = new Set();
    const elt = { dataset: dataset || {}, hidden: false, disabled: false, title: '', textContent: '', innerHTML: '', addEventListener() { }, dispatchEvent() { },
        classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, on) => { const want = on === undefined ? !cls.has(c) : !!on; if (want) cls.add(c); else cls.delete(c); return want; } } };
    const p = { elt, press: null, inputFn: null, value(v) { if (v === undefined) return val; val = String(v); return p; }, html(s) { if (s === undefined) return html; html = s; elt.textContent = s; return p; }, mousePressed(fn) { p.press = fn; return p; }, input(fn) { p.inputFn = fn; return p; } };
    return p;
}
function run(shape, X, Y) {
    const w = makeRenderWorld(shape, 3, 3, 'rotation_reflection6'); const sb = w.sb, els = new Map();
    w.set(`currentShape = ${J(shape)}; projectGridSpec({ shape: ${J(shape)}, ordnung: 4, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y}); rebuildGrid(currentShape); baseNetTransform = null;`);
    const kinds = ['regular', 'sinus', 'tangens', 'geometric'].map(k => fakeEl({ kind: k })), axes = ['both', 'x', 'y'].map(a => fakeEl({ axes: a })), domains = ['single', 'tiled', 'field'].map(d => fakeEl({ domain: d }));
    sb.select = id => { if (!els.has(id)) els.set(id, fakeEl()); return els.get(id); }; sb.selectAll = s => (s === '.net-kind-btn' ? kinds : s === '.net-axes-btn' ? axes : s === '.net-domain-btn' ? domains : []);
    const toasts = []; sb.UI = { toast(t) { toasts.push(t); }, t: null }; sb.nodeInput = null; sb.curveBtn = null; sb.freeBtn = null; sb.faceBtn = null; sb.updateCurveTypeControls = () => { };
    sb.window = sb; sb.say = (id, text) => { toasts.push(text); }; sb.setNetAnimationStatus = () => { }; sb.syncNetAnimationLock = () => { }; sb.redraw = () => { }; sb.sessionFlushNow = () => { };
    sb.document = Object.assign(sb.document || {}, { body: {}, createElement: () => ({ style: {}, classList: { add() { }, toggle() { } }, addEventListener() { }, appendChild() { } }) });
    vm.runInContext('var adoptNetState = null; var netControlsSync = null; var netLinesOn = false; var syncNetControls = null;', sb); vm.runInContext(NET_IIFE, sb, { filename: 'sketch.js initNetControls' });
    kinds[0].press(); kinds[1].press(); const inp = els.get('#net-strength-input'); inp.value('50'); inp.inputFn(); sb.netControlsSync();
    return toasts.join(' | ');
}
const sq = run('square', 2, 2), tri = run('triangle', 2, 2)   /* task 108: 4/4 is a Field of the triangle now; the triangle's no-net case is a size below 3 */, hex = run('hex', 2, 2)   /* task 109: 3/4 is a Field of the hexagon now; its no-net case is a size below 3 */;
check('(1) square at a size below 3 (task 106: 4/4 is a Field of the square now, no hint; task 108: and of the triangle: its no-net case is 2/2): the hint says "Einzelnetz" (a Single net is drawn); triangle and hexagon: "kein Netz" and not "Einzelnetz"', /Einzelnetz/.test(sq) && /kein Netz/.test(tri) && !/Einzelnetz/.test(tri) && /kein Netz/.test(hex) && !/Einzelnetz/.test(hex), J([sq, tri, hex]));
const ictx = vm.createContext({ window: {}, document: undefined, console }); ictx.window.document = undefined;
vm.runInContext(fs.readFileSync(process.env.UI_I18N_JS || path.join(ROOT, 'ui-i18n.js'), 'utf8'), ictx, { filename: 'ui-i18n.js' });
const I = vm.runInContext('typeof uiI18n !== "undefined" ? uiI18n : window.uiI18n', ictx), tr = (lang, k, p) => { I.setLang(lang); return I.t(k, p); };
check('(2) dictionary (de / en): note.net.fieldOddSizeNoNet and note.size.fieldNetNoNet say there is no net; the square keys are unchanged',
    tr('de', 'note.size.fieldNetNoNet', { size: '3/4' }) === 'Feld-Netz gilt nur bei ungeraden Größen: bei Größe 3/4 kein Netz.' && tr('en', 'note.size.fieldNetNoNet', { size: '3/4' }) === 'The field net applies only at odd sizes: at size 3/4 there is no net.'
    && /bei 4 gibt es hier kein Netz\. Die Größe bleibt 4\./.test(tr('de', 'note.net.fieldOddSizeNoNet', { size: 4, kept: 4 })) && /at 4 there is no net here\. The size stays 4\./.test(tr('en', 'note.net.fieldOddSizeNoNet', { size: 4, kept: 4 }))
    && tr('de', 'note.size.fieldNet', { size: 4 }) === 'Feld-Netz gilt bei Größe 4 als Einzel.' && /deshalb Einzelnetz/.test(tr('de', 'note.net.fieldOddSize', { size: 4, kept: 4 })));
const sk = SKETCH;
check('(3) the size-change hint (resizeBase hints.fieldNet) names the no-net text for the triangle and the hexagon', /currentShape !== 'square' \? t\('note\.size\.fieldNetNoNet'/.test(sk) && /t\('note\.size\.fieldNet'/.test(sk) && /t\('note\.size\.fieldNetNoNetMin'/.test(sk));
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
