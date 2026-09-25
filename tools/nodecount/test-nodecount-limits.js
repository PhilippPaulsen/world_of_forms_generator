// Shape-dependent Node Count limits (square 13, triangle/hex 7): core/forms.js NODE_COUNT_MAX / maxNodeCountFor(),
// the shape-aware catalog validator, alignLayerToBase() (was hard-coded 2..5) and updateActiveLayerGrid()'s clamp.
// sketch.js functions are lifted by source (no DOM); the UI wiring is checked in the browser, plus source-string checks below.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) pass++; else { fail++; console.log('FAIL', name, detail === undefined ? '' : detail); } };
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i); const st = j; for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); };

const forms = read('core/forms.js'), sketch = read('sketch.js');
const sb = { Math, console }; vm.createContext(sb);
vm.runInContext(forms, sb);
vm.runInContext(`const CATALOG_URL_SHAPES = ['triangle','square','hex']; const CATALOG_URL_MODES = ['none','rotation6'];\n` + grab(sketch, 'isWellFormedCatalogPattern'), sb);
const ev = s => vm.runInContext(s, sb);

// 1. the table
check('limits: square 13, triangle 7, hex 7', ev(`maxNodeCountFor('square')`) === 13 && ev(`maxNodeCountFor('triangle')`) === 7 && ev(`maxNodeCountFor('hex')`) === 7);
check('unknown shape falls back to 7', ev(`maxNodeCountFor('x')`) === 7);

// 2. catalog validator, per shape
const ok = (shape, order) => ev(`isWellFormedCatalogPattern(${JSON.stringify(shape)}, ${order}, 'none', [0])`);
check('validator: square 13 accepted, 14 refused', ok('square', 13) && !ok('square', 14));
check('validator: hex 7 accepted, 8 refused', ok('hex', 7) && !ok('hex', 8));
check('validator: triangle 7 accepted, 8 refused (a uniform 13 would have accepted it)', ok('triangle', 7) && !ok('triangle', 8) && !ok('hex', 13));
check('validator: 0 and non-integers still refused', !ok('square', 0) && !ev(`isWellFormedCatalogPattern('square', 3.5, 'none', [0])`) && !ev(`isWellFormedCatalogPattern('square', '7', 'none', [0])`));
check('validator: unknown shape still refused', !ok('pentagon', 3));

// 3. alignLayerToBase: same answers where the old bound (5) already found one, and any NEW answer is genuine
const refAlign = (b, bn, shape) => { for (let n = 2; n <= 5; n++) for (let s = 1; s <= b; s++) if (ev(`_alignmentConditionMet(${b},${bn},${s},${n},'${shape}')`)) return { achievable: true, shapeSizeFactor: s, nodeCount: n }; return { achievable: false }; };
let same = 0, newly = 0, bad = 0, stillNo = 0;
for (const shape of ['triangle', 'square', 'hex']) for (let b = 1; b <= 9; b++) for (let bn = 1; bn <= ev(`maxNodeCountFor('${shape}')`); bn++) {
    const old = refAlign(b, bn, shape), now = ev(`alignLayerToBase(${b},${bn},1,3,'${shape}')`);
    if (old.achievable) { if (JSON.stringify(old) === JSON.stringify(now)) same++; else bad++; }
    else if (now.achievable) { newly++; if (!(now.nodeCount > 5 && now.nodeCount <= ev(`maxNodeCountFor('${shape}')`) && ev(`_alignmentConditionMet(${b},${bn},${now.shapeSizeFactor},${now.nodeCount},'${shape}')`))) bad++; }
    else stillNo++;
}
check('align: every case the old 2..5 search solved gives the identical answer', bad === 0, bad);
console.log(`  align: ${same} unchanged, ${newly} newly solvable (node count 6..limit), ${stillNo} still not achievable`);
check('align: some cases became solvable (the old bound was stale)', newly > 0);
let above7 = 0, hexTriAbove7 = 0;
for (const shape of ['triangle', 'square', 'hex']) for (let b = 1; b <= 9; b++) for (let bn = 1; bn <= 13; bn++) { const r = ev(`alignLayerToBase(${b},${bn},1,3,'${shape}')`); if (r.achievable && r.nodeCount > 7) { if (shape === 'square') above7++; else hexTriAbove7++; } }
check('align: square can now answer with a node count above 7 (up to 13); triangle/hex never do', above7 > 0 && hexTriAbove7 === 0, above7 + '/' + hexTriAbove7);

// 4. updateActiveLayerGrid clamps to the layer's OWN shape and reports it
const s2 = { Math, console, activeLayer: 0, additionalLayers: [{ shape: 'square', nodeCount: 13, shapeSizeFactor: 1, connections: [[0, 1]], redoStack: [] }], outerCorners: [], centroid: { x: 300, y: 300 }, currentShape: 'square', shapeSizeFactor: 5, canvasW: 600, canvasH: 600 };
vm.createContext(s2); vm.runInContext(forms, s2);
vm.runInContext(`function layerGrid() { return { nodes: [], centroid: {x:0,y:0}, outerCorners: [] }; }\n` + grab(sketch, 'updateActiveLayerGrid'), s2);
const r1 = vm.runInContext(`updateActiveLayerGrid({ shape: 'hex' })`, s2);
check('layer square 13 -> hex: clamped to 7 and reported', r1 && r1.from === 13 && r1.to === 7 && r1.shape === 'hex' && s2.additionalLayers[0].nodeCount === 7, JSON.stringify(r1));
const r2 = vm.runInContext(`updateActiveLayerGrid({ shape: 'square', nodeCount: 13 })`, s2);
check('layer hex 7 -> square, node count 13 set: accepted, no clamp', r2 === null && s2.additionalLayers[0].nodeCount === 13);
const r3 = vm.runInContext(`updateActiveLayerGrid({ shape: 'triangle' })`, s2);
check('layer square 13 -> triangle: clamped to 7', r3 && r3.to === 7 && s2.additionalLayers[0].nodeCount === 7);
const r4 = vm.runInContext(`updateActiveLayerGrid({ nodeCount: 5 })`, s2);
check('within the limit: no clamp', r4 === null && s2.additionalLayers[0].nodeCount === 5);

// 5. UI wiring present in the source (no DOM test exists for sketch.js - the real-browser run covers behaviour)
check('base shape switch calls the clamp before rebuildGrid', /clampNodeCountToShape\('Shape'\);\s*rebuildGrid\(currentShape\)/.test(sketch));
check('base input and layer input read the shape table, no literal 7 clamp left', !/v > 7\) v = 7/.test(sketch) && (sketch.match(/maxNodeCountFor\(/g) || []).length >= 6);
check('no hard-coded 2..5 in alignLayerToBase', !/nodeCount <= 5/.test(forms));

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
