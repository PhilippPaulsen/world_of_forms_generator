/**
 * tools/color/test-anchor.js
 * Headless verification for Group D Phase B2 (Farborgel generator
 * integration): the per-sheet anchor state model - core/facecolor.js's
 * anchorFor()/newFaceAnchor(), core/state.js's baseFaceAnchor and its reset
 * on grid rebuild, and core/farborgel-bridge.js's FARBORGEL_REGISTER_ORDER.
 *
 *   node tools/color/test-anchor.js
 *
 * Unlike the other core/ test files, this one loads core/state.js itself
 * (not a hand-built stand-in object) specifically so rebuildGrid()/
 * rebuildGridFromConstruction()'s reset behavior is exercised for REAL,
 * not assumed from reading the source - the same rigor the design session
 * asked for ("verify against the real precedent, don't assume").
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');

const CORE = ['forms', 'state', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'orbits', 'color', 'facecolor', 'farborgel-bridge'];
const SRC = CORE.map(f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');

function makeSandbox() {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs,
        dist: (a, b, c, d) => Math.hypot(c - a, d - b), console
    };
    vm.createContext(sb);
    vm.runInContext(SRC, sb);
    return sb;
}

let failures = 0, checks = 0;
function check(name, ok, detail) {
    checks++; if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ------------------------------------------------------------------------
console.log('== 1. newFaceAnchor() default shape ==');
{
    const sb = makeSandbox();
    const a = vm.runInContext('newFaceAnchor()', sb);
    check('default anchor is exactly {hueIndex:1, registerIndex:0}', same(a, { hueIndex: 1, registerIndex: 0 }), JSON.stringify(a));
    check('default hueIndex is a valid Farborgel hue (1-24, not core/color.js\'s 0-based convention)', a.hueIndex === 1);
}

console.log('\n== 2. anchorFor(): lazy per-sheet creation matches facePaletteFor()\'s pattern ==');
{
    const sb = makeSandbox();
    vm.runInContext('additionalLayers.push({}, {})', sb); // two bare layer stand-ins, exactly what facePaletteFor()/anchorFor() need (a truthy layer object)

    check('baseFaceAnchor starts null (fresh grid, nothing has asked for it yet)', vm.runInContext('baseFaceAnchor', sb) === null);
    const base1 = vm.runInContext('anchorFor(\'base\')', sb);
    check('first anchorFor(\'base\') call creates it (no longer null)', vm.runInContext('baseFaceAnchor', sb) !== null);
    const base2 = vm.runInContext('anchorFor(\'base\')', sb);
    check('anchorFor(\'base\') returns the SAME object on a second call (lazy singleton, not a fresh one per call)', base1 === base2);

    const layer0a = vm.runInContext('anchorFor(0)', sb);
    const layer0b = vm.runInContext('anchorFor(0)', sb);
    check('anchorFor(0) is also a lazy singleton', layer0a === layer0b);
    check('anchorFor(0) is stored ON the layer object itself (layer.faceAnchor), like layer.facePalette', vm.runInContext('additionalLayers[0].faceAnchor', sb) === layer0a);

    const layer1 = vm.runInContext('anchorFor(1)', sb);
    check('anchorFor(1) (a second layer) is a distinct object from anchorFor(0)', layer1 !== layer0a);
    check('anchorFor(2) (no such layer) returns null, like facePaletteFor()', vm.runInContext('anchorFor(2)', sb) === null);
}

console.log('\n== 3. independence: setting one sheet\'s anchor never touches another\'s ==');
{
    const sb = makeSandbox();
    vm.runInContext('additionalLayers.push({}, {})', sb);
    const base = vm.runInContext('anchorFor(\'base\')', sb);
    const l0 = vm.runInContext('anchorFor(0)', sb);
    const l1 = vm.runInContext('anchorFor(1)', sb);

    base.hueIndex = 7; base.registerIndex = 3;
    l0.hueIndex = 19; l0.registerIndex = 22;
    l1.hueIndex = 24; l1.registerIndex = null; // the Wert (hue-only) state

    check('base anchor holds its own values after siblings were mutated', base.hueIndex === 7 && base.registerIndex === 3, JSON.stringify(base));
    check('layer 0 anchor holds its own values after base/layer 1 were mutated', l0.hueIndex === 19 && l0.registerIndex === 22, JSON.stringify(l0));
    check('layer 1 anchor holds its own values, including a null (hue-only) register', l1.hueIndex === 24 && l1.registerIndex === null, JSON.stringify(l1));
    check('re-fetching each sheet\'s anchor returns the SAME mutated object, not a reset default',
        vm.runInContext('anchorFor(\'base\')', sb) === base && vm.runInContext('anchorFor(0)', sb) === l0 && vm.runInContext('anchorFor(1)', sb) === l1);
}

console.log('\n== 4. reset on grid rebuild (the REAL rebuildGrid()/rebuildGridFromConstruction(), not a source-text guess) ==');
{
    const sb = makeSandbox();
    vm.runInContext('additionalLayers.push({}, {})', sb);
    const base = vm.runInContext('anchorFor(\'base\')', sb);
    const l0 = vm.runInContext('anchorFor(0)', sb);
    base.hueIndex = 13; l0.hueIndex = 6;

    vm.runInContext('rebuildGrid(\'triangle\')', sb);
    check('rebuildGrid(): baseFaceAnchor is reset to null', vm.runInContext('baseFaceAnchor', sb) === null);
    check('rebuildGrid(): additionalLayers is a fresh empty array (the old layer\'s anchor is discarded with it)', vm.runInContext('additionalLayers.length', sb) === 0);
    const baseAfter = vm.runInContext('anchorFor(\'base\')', sb);
    check('a fresh anchorFor(\'base\') after rebuildGrid() is the default shape again, not the pre-rebuild mutation',
        same(baseAfter, { hueIndex: 1, registerIndex: 0 }) && baseAfter !== base, JSON.stringify(baseAfter));

    // Same check for the OTHER rebuild entry point (alternative net construction, core/state.js 1.2-C) -
    // both reset call sites were edited together; this proves the second one for real too, not by inspection.
    vm.runInContext('additionalLayers.push({})', sb);
    const base2 = vm.runInContext('anchorFor(\'base\')', sb);
    base2.hueIndex = 20;
    vm.runInContext('rebuildGridFromConstruction({x:0,y:0}, {x:100,y:0}, 3, 1)', sb);
    check('rebuildGridFromConstruction(): baseFaceAnchor is reset to null', vm.runInContext('baseFaceAnchor', sb) === null);
    check('rebuildGridFromConstruction(): additionalLayers is a fresh empty array too', vm.runInContext('additionalLayers.length', sb) === 0);
    const baseAfter2 = vm.runInContext('anchorFor(\'base\')', sb);
    check('a fresh anchorFor(\'base\') after rebuildGridFromConstruction() is the default shape again',
        same(baseAfter2, { hueIndex: 1, registerIndex: 0 }), JSON.stringify(baseAfter2));
}

console.log('\n== 5. FARBORGEL_REGISTER_ORDER: independently re-derived, not copy-pasted ==');
{
    const sb = makeSandbox();
    const fromModule = vm.runInContext('FARBORGEL_REGISTER_ORDER', sb);
    check('exactly 28 registers (the atlas\'s own documented count)', fromModule.length === 28, fromModule.length);

    // Re-run color-harmony/ColorHarmonyEngine.js's OWN buildTriangle() filter independently, against its
    // real SCALE table, rather than trusting core/farborgel-bridge.js's copy of the result.
    const SCALE = [
        ['a', 0.8913], ['c', 0.5623], ['e', 0.3548], ['g', 0.2239],
        ['i', 0.1413], ['l', 0.0891], ['n', 0.0562], ['p', 0.0355]
    ].map(([letter, value]) => ({ letter, value }));
    const EPSILON = 1e-10;
    const rederived = [];
    for (const white of SCALE) for (const black of SCALE) if (black.value - white.value > EPSILON) rederived.push(white.letter + black.letter);
    check('FARBORGEL_REGISTER_ORDER matches an independent re-derivation of buildTriangle()\'s own filter, in order',
        same(fromModule, rederived), rederived.join(','));

    check('frozen (a stepper must not accidentally mutate the shared order)', Object.isFrozen(fromModule));
}

console.log('\n== 6. register-index stepper arithmetic walks the real 28-entry order (spot-checked, not just "increments") ==');
{
    const sb = makeSandbox();
    const order = vm.runInContext('FARBORGEL_REGISTER_ORDER', sb);
    const N = order.length;
    // The exact wraparound formula the Farbe-tab stepper (ui-farbe.js) uses: (idx + delta + N) % N.
    const step = (idx, delta) => (idx + delta + N) % N;

    check('index 0 is register "ca" (the atlas\'s lightest white / darkest-relative-black start)', order[0] === 'ca');
    check('index 27 (the last) is register "pn"', order[27] === 'pn');
    check('stepping +1 from 0 lands on index 1, "ea"', step(0, 1) === 1 && order[step(0, 1)] === 'ea');
    check('stepping -1 from 0 WRAPS to index 27, "pn" (not -1 or a throw)', step(0, -1) === 27 && order[step(0, -1)] === 'pn');
    check('stepping +1 from 27 (the last) WRAPS to index 0, "ca"', step(27, 1) === 0 && order[step(27, 1)] === 'ca');
    check('stepping +1 from 9 lands on index 10, "ig" -> "la" is index 10 per the real order', order[step(9, 1)] === order[10] && order[10] === 'la');
}

// ------------------------------------------------------------------------
console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
