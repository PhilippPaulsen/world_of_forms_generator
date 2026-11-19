// Task 092 (point 3): the readout names the net that is valid NOW. After a size change the domain button still says 'field' until the next draw() (netControlsSync resets it); the readout used to show "Feld: 3 x 4 Kacheln"
// for one tick. Here nothing draws: the state is read right after the change.
//   node tools/grid/test-net-readout-tick.js      sabotage runs: UI_NET_READOUT_JS, UI_NET_JS (mutated copies)
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const { makeRenderWorld } = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const MODEL = require(process.env.UI_NET_READOUT_JS || path.join(ROOT, 'ui-net-readout.js'));
const NET = fs.readFileSync(process.env.UI_NET_JS || path.join(ROOT, 'ui-net.js'), 'utf8');
const ictx = vm.createContext({ window: {}, document: undefined, console }); ictx.window.document = undefined;
vm.runInContext(fs.readFileSync(path.join(ROOT, 'ui-i18n.js'), 'utf8'), ictx, { filename: 'ui-i18n.js' });
const I = vm.runInContext('typeof uiI18n !== "undefined" ? uiI18n : window.uiI18n', ictx), de = (k, p) => { I.setLang('de'); return I.t(k, p); };
check('(1) the pure model: a Field the size no longer allows reads as Single; a valid Field, Tiled, Single and an unknown fieldOk are unchanged', MODEL.readoutDomain('field', false) === 'single' && MODEL.readoutDomain('field', true) === 'field' && MODEL.readoutDomain('field', undefined) === 'field' && MODEL.readoutDomain('tiled', false) === 'tiled' && MODEL.readoutDomain('single', false) === 'single');
// the real state: a Field net at 3/3, the domain button on 'field'; resizeBase(3, 4) (nothing draws): the text is the one of Single
const bad = [];
for (const shape of ['square', 'triangle', 'hex']) {
    const w = makeRenderWorld(shape, 3, 3, 'rotation_reflection6');
    w.set(`currentShape = ${J(shape)}; projectGridSpec({ shape: ${J(shape)}, ordnung: 4, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(3, 3); rebuildGrid(currentShape); baseNetTransform = { x: { kind: 'trig', w: -0.6 }, y: 'same', repeat: false, domain: 'field' };`);
    w.set('var canvasSizeSync = function () { width = canvasW; height = canvasH; };');
    const text = (active) => { const fieldOk = w.get("netDomainEffective({ domain: 'field' }, netSizeFactors()).ignored === null"), dom = MODEL.readoutDomain(active, fieldOk); return MODEL.readoutText(dom, 3, de, 4); };
    const before = text('field'); w.run('resizeBase(3, 4)'); const stateStill = w.get("baseNetTransform.domain"); const after = text('field');
    if (!/^Feld: /.test(before) || stateStill !== 'field' || !/^Einzeln/.test(after)) bad.push([shape, before, stateStill, after]);
}
check('(2) right after resizeBase(3, 4) (the state still says Field, no draw ran): the readout text is "Einzeln: ein Netz", at 3/3 "Feld: ..."', bad.length === 0, J(bad));
check('(3) ui-net.js reads the domain through netReadout.readoutDomain with the field-valid flag (netDomainEffective over netSizeFactors and the shape, task 106)', /netReadout\.readoutDomain\(d \? d\.dataset\.domain : 'single', typeof netDomainEffective === 'function' && typeof netSizeFactors === 'function' \? netDomainEffective\(\{ domain: 'field' \}, netSizeFactors\(\), currentShape\)\.ignored === null : undefined\)/.test(NET));
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
