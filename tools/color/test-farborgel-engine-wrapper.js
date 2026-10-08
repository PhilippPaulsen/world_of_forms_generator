/**
 * tools/color/test-farborgel-engine-wrapper.js
 * Headless verification for Group D Phase B4: core/farborgel-engine.mjs, the hand-written ESM
 * wrapper that stands in for color-harmony/ui/build.js's gitignored, uncommitted
 * engine.generated.mjs (see that file's own docblock for why it exists at all).
 *
 *   node tools/color/test-farborgel-engine-wrapper.js
 *
 * core/farborgel-engine.mjs uses fetch() against file:// URLs, which Node's native fetch does
 * NOT support (confirmed directly: `import('./core/farborgel-engine.mjs')` from Node throws
 * "fetch failed") - it only ever runs in a real browser, over http(s), by design (this project's
 * whole verification workflow already requires a local server, never file://, same as
 * color-harmony/ui's own README). So this test cannot execute the wrapper file itself; instead it
 * proves the wrapper's ALGORITHM produces output identical to a REAL run of build.js, two ways:
 *
 *   1. The module list: build.js's own `modules` array (source-parsed, not retyped) must match
 *      core/farborgel-engine.mjs's own MODULE_NAMES (also source-parsed) - if Farborgel adds,
 *      removes or reorders an engine module, this fails loudly instead of drifting silently.
 *   2. The exports: build.js is actually RUN (regenerating the real engine.generated.mjs),
 *      imported, and its ColorSpace/default exports are deep-compared - key sets AND real function
 *      calls (hueCircle(), triangle(1), grayAxis()) - against an independent reconstruction that
 *      uses the wrapper's own require()/module.exports factory algorithm (copied here verbatim,
 *      swapping fetch() for a synchronous fs.readFileSync of the same 4 real files - the only
 *      difference Node's file:// limitation forces).
 *
 * A real browser load of core/farborgel-engine.mjs itself is verified separately (not headlessly -
 * see the Phase B4 report).
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..', '..');

let failures = 0, checks = 0;
function check(name, ok, detail) {
    checks++; if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
    // ---------------- 1. module list stays in sync with build.js's own ------------------------
    console.log('== 1. module list matches build.js\'s own, source-parsed from both files ==');
    const buildJsSrc = fs.readFileSync(path.join(ROOT, 'color-harmony/ui/build.js'), 'utf8');
    const buildModulesMatch = buildJsSrc.match(/const modules = \[([^\]]*)\]/);
    check('build.js\'s own `modules` array is parseable from its source', !!buildModulesMatch, buildModulesMatch && buildModulesMatch[0]);
    const buildModules = buildModulesMatch[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
    check('build.js lists exactly the 4 expected engine modules', same(buildModules, ['ColorSpace', 'HarmonyGrammar', 'CompoundHarmony', 'ColorHarmonyEngine']), buildModules.join(','));

    const wrapperSrc = fs.readFileSync(path.join(ROOT, 'core/farborgel-engine.mjs'), 'utf8');
    const wrapperNamesMatch = wrapperSrc.match(/const MODULE_NAMES = \[([^\]]*)\]/);
    check('core/farborgel-engine.mjs\'s own MODULE_NAMES is parseable from its source', !!wrapperNamesMatch, wrapperNamesMatch && wrapperNamesMatch[0]);
    const wrapperNames = wrapperNamesMatch[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
    const wrapperModules = wrapperNames.map(n => n.replace(/\.js$/, ''));
    check('core/farborgel-engine.mjs\'s module list (order and names) matches build.js\'s exactly', same(wrapperModules, buildModules), wrapperModules.join(','));

    // ---------------- 2. real build.js output vs. an independent fs-based reconstruction ------
    console.log('\n== 2. exports match a REAL run of build.js (not assumed) ==');
    const { build } = require(path.join(ROOT, 'color-harmony/ui/build.js'));
    build(); // regenerates the real (gitignored, disposable) engine.generated.mjs
    const generatedPath = path.join(ROOT, 'color-harmony/ui/engine.generated.mjs');
    check('build.js actually wrote engine.generated.mjs', fs.existsSync(generatedPath));
    const real = await import(pathToFileURL(generatedPath).href + '?t=' + Date.now());

    // Independent reconstruction: the wrapper's own require()/module.exports algorithm, copied
    // verbatim from core/farborgel-engine.mjs, with fs.readFileSync standing in for fetch() (the
    // one piece Node's file:// limitation forces to differ from the real, browser-only wrapper).
    const engineDir = path.join(ROOT, 'color-harmony');
    const sources = {};
    for (const name of wrapperNames) sources['./' + name] = fs.readFileSync(path.join(engineDir, name), 'utf8');
    const cache = {};
    function requireEngine(id) {
        if (!(id in sources)) throw new Error('unknown engine module ' + id);
        if (!cache[id]) {
            const module = { exports: {} };
            cache[id] = module;
            const factory = new Function('module', 'exports', 'require', sources[id]);
            factory(module, module.exports, requireEngine);
        }
        return cache[id].exports;
    }
    const reconstructed = { ColorSpace: requireEngine('./ColorSpace.js'), default: requireEngine('./ColorHarmonyEngine.js') };

    check('ColorSpace: same exported key set', same(Object.keys(real.ColorSpace).sort(), Object.keys(reconstructed.ColorSpace).sort()));
    check('default (engine class): same static method/property names', same(
        Object.getOwnPropertyNames(real.default).filter(k => k !== 'length' && k !== 'name' && k !== 'prototype').sort(),
        Object.getOwnPropertyNames(reconstructed.default).filter(k => k !== 'length' && k !== 'name' && k !== 'prototype').sort()
    ));

    // Functional spot-checks: not just names - the same real calls give byte-identical results.
    check('hueCircle() results match', same(real.default.hueCircle(), reconstructed.default.hueCircle()));
    check('grayAxis() results match', same(real.default.grayAxis(), reconstructed.default.grayAxis()));
    check('triangle(1) (the real 28-register atlas for hue 1) results match', same(real.default.triangle(1), reconstructed.default.triangle(1)));
    check('triangle(1) really has 28 entries (sanity: this is exercising the real engine, not a stub)', real.default.triangle(1).length === 28, real.default.triangle(1).length);

    console.log(`\n${checks - failures}/${checks} checks passed`);
    if (failures > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
