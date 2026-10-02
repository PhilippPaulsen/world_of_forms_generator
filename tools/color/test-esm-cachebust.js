/**
 * tools/color/test-esm-cachebust.js
 * Static verification of the ES-module cache-busting (P0 of the Farborgel sub-page work) and of the
 * "no reference to the gitignored engine.generated.mjs" guarantee.
 *
 *   node tools/color/test-esm-cachebust.js
 *
 * WHY: this project has no build step and GitHub Pages caches every file for minutes, so every local script
 * is loaded as `x.js?v=<version>` and CLAUDE.md says to bump that on every change. A script tag can carry
 * ?v=, but an ES module's own `import ... from './x.mjs'` cannot - so index.html and
 * color-harmony/ui/index.html each carry a <script type="importmap"> that maps every module of their graph to
 * the versioned URL. That is only worth anything while the map is COMPLETE and CONSISTENT; nothing else would
 * notice a module added to the graph without a map entry (it would silently load unversioned and go stale
 * after a deploy). This test walks the REAL import graph from each page's entry and checks it against the
 * REAL map in the REAL html - no copied lists.
 *
 *   1. every module reachable from the entry has a map entry, and the entry maps to the SAME file + ?v=<page version>
 *   2. no map entry is dead (points at a file that does not exist or is not reachable)
 *   3. one version string across index.html, gallery.html, color-harmony/ui/index.html (every ?v= in each)
 *   4. no import statement and no html file references engine.generated.mjs (a gitignored build artifact)
 *   5. every ESM file under color-harmony/ui imports only inside color-harmony/ui, or core/farborgel-engine.mjs
 *      (the one committed bridge to the engine) - the Farborgel stays a self-contained module
 *   6. core/farborgel-engine.mjs forwards its own ?v= to the engine files it fetches (they are not module
 *      imports, so no import map reaches them)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
let failures = 0, checks = 0;
function check(name, ok, detail) {
    checks++; if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`);
}
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

// ---- static ES import/export-from specifiers of one file (comments stripped first) ----
function specifiersOf(file) {
    const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    const out = [];
    const re = /(?:^|[;\s}])(?:import|export)\s*(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) out.push(m[1]);
    // A dynamic import() of a Node builtin (the wrapper's Node-only branch: import('node:fs/promises')) never
    // reaches a browser and no import map is involved. Any other dynamic import() is something this test (and
    // the map) could not see - flagged, not silently accepted.
    for (const m2 of src.matchAll(/\bimport\s*\(\s*(?:(['"])([^'"]+)\1)?/g)) {
        if (m2[2] && m2[2].startsWith('node:')) continue;
        out.push('<<dynamic import()>>');
    }
    return out;
}
function graphFrom(entryFile) {
    const seen = new Map(); // abs file -> [specifiers]
    const bad = [];
    const stack = [entryFile];
    while (stack.length) {
        const f = stack.pop();
        if (seen.has(f)) continue;
        const specs = specifiersOf(f);
        seen.set(f, specs);
        for (const s of specs) {
            if (s === '<<dynamic import()>>') { bad.push(`${rel(f)}: dynamic import() is invisible to this test and to the import map`); continue; }
            if (!s.startsWith('.')) { bad.push(`${rel(f)}: bare/absolute specifier "${s}"`); continue; }
            stack.push(path.resolve(path.dirname(f), s));
        }
    }
    return { files: seen, bad };
}

// ---- html: import map + every ?v= ----
function parseHtml(file) {
    const html = fs.readFileSync(file, 'utf8');
    const maps = [...html.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)];
    let imports = null;
    if (maps.length === 1) imports = JSON.parse(maps[0][1]).imports;
    const versions = [...html.matchAll(/\?v=([0-9]{8}[a-z]+)/g)].map(m => m[1]);
    return { html, mapCount: maps.length, imports, versions };
}

const PAGES = [
    { name: 'index.html (generator)', file: path.join(ROOT, 'index.html'), entry: path.join(ROOT, 'core/farborgel-selection.mjs') },
    { name: 'color-harmony/ui/index.html (standalone Farborgel)', file: path.join(ROOT, 'color-harmony/ui/index.html'), entry: path.join(ROOT, 'color-harmony/ui/app.mjs') },
];
const allVersions = new Set();

for (const page of PAGES) {
    console.log(`\n== ${page.name} ==`);
    const { html, mapCount, imports, versions } = parseHtml(page.file);
    versions.forEach(v => allVersions.add(v));
    const pageVersions = new Set(versions);
    check('exactly one <script type="importmap">', mapCount === 1, `${mapCount}`);
    check('the page uses exactly one ?v= version string throughout', pageVersions.size === 1, [...pageVersions].join(','));
    const VERSION = [...pageVersions][0];
    check('the module entry is loaded with the same ?v=', new RegExp(`<script type="module" src="[^"]*${path.basename(page.entry)}\\?v=${VERSION}"`).test(html));
    if (!imports) continue;

    const { files, bad } = graphFrom(page.entry);
    check('the import graph contains only static relative imports (nothing the map cannot cover)', bad.length === 0, bad.join('; '));

    // map keys/values are URLs relative to the HTML document
    const base = path.dirname(page.file);
    const keyFiles = new Map(Object.entries(imports).map(([k, v]) => [path.resolve(base, k), { key: k, value: v }]));
    const reachable = [...files.keys()].filter(f => f !== page.entry);

    const missing = reachable.filter(f => !keyFiles.has(f));
    check(`every module reachable from the entry (${reachable.length}) has an import-map entry`, missing.length === 0, missing.map(rel).join(', '));

    const wrong = reachable.filter(f => {
        const e = keyFiles.get(f);
        if (!e) return false;
        const [valPath, valQuery] = e.value.split('?');
        return path.resolve(base, valPath) !== f || valQuery !== `v=${VERSION}`;
    });
    check('each entry maps to the SAME file, versioned with the page version', wrong.length === 0, wrong.map(rel).join(', '));

    const dead = [...keyFiles.keys()].filter(f => !files.has(f) || !fs.existsSync(f));
    check('no dead import-map entry (every key is a real, reachable module)', dead.length === 0, dead.map(rel).join(', '));

    check('the page does not mention engine.generated.mjs', !/engine\.generated/.test(html));
    const importing = [...files.entries()].filter(([f, specs]) => specs.some(s => /engine\.generated/.test(s))).map(([f]) => rel(f));
    check('no module in the graph imports engine.generated.mjs (gitignored build artifact)', importing.length === 0, importing.join(', '));
}

console.log('\n== cross-page ==');
check('index.html, color-harmony/ui/index.html and gallery.html all carry ONE shared version', (() => {
    const g = parseHtml(path.join(ROOT, 'gallery.html')).versions; g.forEach(v => allVersions.add(v)); return allVersions.size === 1;
})(), [...allVersions].join(','));

console.log('\n== module boundary of the standalone Farborgel ==');
{
    const uiDir = path.join(ROOT, 'color-harmony/ui');
    const uiFiles = [];
    (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.mjs') && !/\.test\.mjs$|^test\.mjs$|engine\.generated/.test(e.name)) uiFiles.push(p); } })(uiDir);
    const ALLOWED = path.join(ROOT, 'core/farborgel-engine.mjs');
    const offenders = [];
    for (const f of uiFiles) for (const s of specifiersOf(f)) {
        if (!s.startsWith('.')) continue;
        const target = path.resolve(path.dirname(f), s);
        if (!(target.startsWith(uiDir + path.sep)) && target !== ALLOWED) offenders.push(`${rel(f)} -> ${s}`);
    }
    check(`${uiFiles.length} ui modules import only within color-harmony/ui, plus core/farborgel-engine.mjs`, offenders.length === 0, offenders.join('; '));
    const generated = uiFiles.filter(f => /engine\.generated/.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
    check('no ui module references engine.generated.mjs outside comments', generated.length === 0, generated.map(rel).join(', '));
}

console.log('\n== core/farborgel-engine.mjs forwards the version to the engine files ==');
{
    const src = fs.readFileSync(path.join(ROOT, 'core/farborgel-engine.mjs'), 'utf8');
    check('reads ?v= from its own import.meta.url', /new URL\(import\.meta\.url\)\.searchParams\.get\('v'\)/.test(src));
    check('sets it on the fetch URL of every engine file (browser branch only)', /if \(VERSION\) url\.searchParams\.set\('v', VERSION\);\s*\n\s*const res = await fetch\(url\)/.test(src));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
