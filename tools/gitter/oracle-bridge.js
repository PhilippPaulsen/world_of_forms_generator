// Task 059 (G4): test helper, NOT a test (the glob tools/*/test-*.js does not pick it up). Loads the real core files into a vm (FORMS_JS / SYMMETRY_JS / ORBITS_JS
// replace one with a sabotaged copy) and drives the UNCHANGED Orakel tools/gitter/measure-name-rule.js with the core's answers, so the oracle's own report
// (12 grid counts, 299 node numbers of 7 figures, 240 table rows of 6 tables, uniqueness) is produced from the CORE and can be compared line for line.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const ORACLE_FILE = path.join(__dirname, 'measure-name-rule.js');
const rd = (f, env) => fs.readFileSync(env || path.join(ROOT, f), 'utf8');
const ptKey = (x, y) => Math.round(x * 1e6) + ',' + Math.round(y * 1e6);

function loadCore() {
    const sb = { Math, console, Number, Object, Error, Set, Map, WeakMap, JSON, radians: d => d * Math.PI / 180, degrees: r => r * 180 / Math.PI, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, atan2: Math.atan2, PI: Math.PI, dist: (a, b, c, d) => Math.hypot(c - a, d - b) };
    vm.createContext(sb);
    vm.runInContext(rd('core/forms.js', process.env.FORMS_JS), sb);
    vm.runInContext(rd('core/symmetry.js', process.env.SYMMETRY_JS), sb);
    vm.runInContext(rd('core/orbits.js', process.env.ORBITS_JS), sb);
    const g = n => vm.runInContext(n, sb);
    const V2 = {}, LAT = { allowLage2: true };
    const api = {
        sb, V2, LAT, get: g,
        latticeNodes: grid => g('buildGridNodes')(grid, LAT),
        table: grid => g('computeLineKeyTable')(g('buildGridNodes')(grid, LAT), grid, V2),
        numbered: grid => g('numberGridNodes')(g('buildGridNodes')(grid, LAT), grid),
    };
    return api;
}

// the oracle with its pairOrbits()/buildGrid() answering from the core; returns { log: [lines], bad, plain: same run of the untouched oracle }
function runOracle(core) {
    const src = fs.readFileSync(ORACLE_FILE, 'utf8');
    if (!src.includes('function pairOrbits(g) {') || !src.includes('function buildGrid(shape, ordnung, lage) {')) throw new Error('oracle layout changed');
    const make = (patch) => {
        let code = src;
        if (patch) code = code.replace('function pairOrbits(g) {', 'function pairOrbits(g) { if (globalThis.__po) return globalThis.__po(g);')
            .replace('function buildGrid(shape, ordnung, lage) {', 'function buildGrid(shape, ordnung, lage) { const r = __origBuild(shape, ordnung, lage); if (globalThis.__bg) globalThis.__bg(r); return r; }\nfunction __origBuild(shape, ordnung, lage) {');
        code += '\nmodule.exports.run = run;';
        const log = [];
        const sb = { require: { main: null }, module: { exports: {} }, process: { env: {}, argv: [] }, console: { log: (...a) => log.push(a.join(' ')) }, Math, Map, Set, Number, Array, JSON, Error, Object, String, parseInt, Infinity, NaN };
        sb.globalThis = sb; vm.createContext(sb); vm.runInContext(code, sb);
        return { sb, log };
    };
    const plain = make(false); const bad0 = plain.sb.module.exports.run(false);
    const patched = make(true), cache = {};
    const tab = (shape, n, lage) => { const k = shape + n + lage; return cache[k] || (cache[k] = { table: core.table({ shape, ordnung: n, lage }), num: core.numbered({ shape, ordnung: n, lage }) }); };
    patched.sb.__po = (g) => tab(g.shape, g.ordnung, g.lage).table.entries.map(e => ({ z1: e.key.z1, z2: e.key.z2, letter: e.key.buchstabe, bar: e.key.gegen, achiral: e.spiegelgleich, anomalies: e.anomalies, name: e.token }));
    patched.sb.__bg = (r) => {
        const { num } = tab(r.shape, r.ordnung, r.lage), byKey = new Map(num.nodes.map((nd, i) => [ptKey(num.points[i].x, num.points[i].y), nd.zahl]));
        r.nodes.forEach(nd => { const z = byKey.get(ptKey(nd.x, nd.y)); nd.zahl = z === undefined ? -1 : z; });
    };
    const bad1 = patched.sb.module.exports.run(false);
    return { plain: plain.log, core: patched.log, badPlain: bad0, badCore: bad1 };
}
module.exports = { loadCore, runOracle, ptKey, ROOT };
