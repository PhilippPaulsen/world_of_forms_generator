// G7b (task 066): the removal of the old catalog paths is complete and nothing that is still alive lost its function.
//   node tools/gitter/test-legacy-consumers.js     ROOT_OVERRIDE = a copy of the repo tree (sabotage runs)
//   1. REMOVED names have no consumer left (code, comments aside): legacyCatalogReader, isWellFormedCatalogPattern, CATALOG_URL_SHAPES / _MODES, computeThemeLineOrbitAssignments,
//      GITTER_V2 / GRID_V2 / gitterV2, assertNotDegenerateOrder, catalogRelativePath, buildManifestEntry, createShapeOrderRenderer, and the old orbitIds URL / paste fields in sketch.js
//   2. KEPT names still exist and work (live consumers): computeThemeLineName (the name display #pattern-name-status in sketch.js), formatThemeLineName, computeThemeLineOrbitTable,
//      computeThemeLineOrbits (group elements, morph tests, measure scripts), pairToOrbitId / _pairKey: the legacy name of a small pattern is still produced
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.ROOT_OVERRIDE || path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = f => read(f).split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).map(l => l.replace(/\s\/\/.*$/, '')).join('\n');

// ---- 1. removed names ----------------------------------------------------------------------------------------------------------------------------------
const live = fs.readdirSync(ROOT).filter(f => /^(sketch|gallery|gallery-render|nav|ui[\w-]*)\.js$/.test(f)).concat(fs.readdirSync(path.join(ROOT, 'core')).filter(f => f.endsWith('.js')).map(f => 'core/' + f));
const gone = ['legacyCatalogReader', 'isWellFormedCatalogPattern', 'CATALOG_URL_SHAPES', 'CATALOG_URL_MODES', 'computeThemeLineOrbitAssignments', 'GITTER_V2', 'GRID_V2', 'gitterV2', '_lkGate'];
const left = [];
for (const f of live) { const c = code(f); for (const n of gone) if (new RegExp('\\b' + n + '\\b').test(c)) left.push(f + ':' + n); }
check('(1) no live file (core/, sketch.js, ui*.js, gallery*.js) still contains a removed name (' + gone.join(', ') + ')', left.length === 0, left.join(' | '));
const toolsGone = ['assertNotDegenerateOrder', 'catalogRelativePath', 'buildManifestEntry', 'createShapeOrderRenderer', 'sortedOrbitIdsSegment'];
const tleft = [];
const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach(e => { const rel = d + '/' + e.name; if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'logs') walk(rel); } else if (/\.js$/.test(e.name) && rel !== 'tools/gitter/test-legacy-consumers.js') { const c = code(rel); for (const n of toolsGone) if (new RegExp('\\b' + n + '\\b').test(c)) tleft.push(rel + ':' + n); } });
walk('tools');
check('(1) no tool still contains the removed generator / path names (' + toolsGone.join(', ') + ')', tleft.length === 0, tleft.join(' | '));
const sk = code('sketch.js');
const skNoStrings = sk.replace(/'[^'\n]*'/g, "''").replace(/`[^`]*`/g, '``');
check('(1) sketch.js reads no orbitIds field any more: it is only NAMED inside quoted strings (the refusal of the old format in the v2 parsers), never used as an identifier', !/orbitIds/.test(skNoStrings) && /params\.has\('orbitIds'\)/.test(sk) && /hasOwnProperty\.call\(obj, 'orbitIds'\)/.test(sk));
check('(1) the old catalog and its tools are gone (gallery/ holds v2 only; no tools/gallery generate.js / catalogPath.js)', fs.readdirSync(path.join(ROOT, 'gallery')).join() === 'v2' && !fs.existsSync(path.join(ROOT, 'tools/gallery/generate.js')) && !fs.existsSync(path.join(ROOT, 'tools/gallery/catalogPath.js')));

// ---- 2. kept names work ----------------------------------------------------------------------------------------------------------------------------------
{
    const sb = { Math, console, Number, Object, Error, Set, Map, WeakMap, JSON, radians: d => d * Math.PI / 180, degrees: r => r * 180 / Math.PI, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, atan2: Math.atan2, dist: (a, b, c, d) => Math.hypot(c - a, d - b) };
    vm.createContext(sb);
    ['core/forms.js', 'core/symmetry.js', 'core/orbits.js'].forEach(f => vm.runInContext(read(f), sb));
    const E = c => vm.runInContext(c, sb);
    const names = ['computeThemeLineName', 'formatThemeLineName', 'computeThemeLineOrbitTable', 'computeThemeLineOrbits', 'groupTokenFor', 'computeGroupElements', '_pairKey'];
    check('(2) the kept legacy functions exist in core/orbits.js: ' + names.join(', '), names.every(n => E(`typeof ${n}`) === 'function'), names.filter(n => E(`typeof ${n}`) !== 'function').join(','));
    check('(2) sketch.js still calls computeThemeLineName for the name display (#pattern-name-status), so the wrapper must stay until the UI step', /computeThemeLineName\(/.test(sk) && /pattern-name-status/.test(read('index.html')) );
    const g = E(`buildGrid({ shape: 'triangle', ordnung: 2, lage: 1 }, { sizeFactor: 1.3, canvasW: 300, canvasH: 300 })`);
    sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners; sb.currentShape = 'triangle'; sb.symmetryMode = 'rotation_reflection6';
    const table = E('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners)');
    sb.__c = [table.orbits[0].pairs[0], table.orbits[2].pairs[0]];
    const name = E('computeThemeLineName(__c)');
    check('(2) the legacy name of a two-line pattern is still produced: "2*/D3 0+2"', name === '2*/D3 0+2', name);
    check('(2) pairToOrbitId is still part of the legacy table (orbit id of a pair)', table.pairToOrbitId instanceof sb.Map && table.pairToOrbitId.size === table.orbits.reduce((a, o) => a + o.pairs.length, 0));
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
