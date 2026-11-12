// G7a (task 064): the catalog v2 - generator, manifest, codec, Formorgel, backfill.
//   node tools/gallery/test-catalog-v2.js     BASE = the commit before 064 (default 59338562); sabotage runs work on a COPY of the repo tree (this file runs from its own ../..)
//   1. manifest: every path exists, no duplicates (path, or grid + lines), the catalog is exactly the planned scope, the committed files equal a fresh generation byte for byte
//   2. per shape x ordnung: the preview file = the page's renderer (gallery-render.js on the live core) = what the entry's generator link resolves to; link and paste round trip
//   3. names: the catalog name of every entry = formatGridName of its source = the export name of the live generator for the same pattern
//   4. the codec: one source (core/catalog.js), reversible paths, numeric token order, lage in the path, the viewer refuses old / mismatching records
//   5. backfill: every row mapped (or listed), the old catalog and the old CSV untouched
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || '59338562';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });
const { generateCatalogV2, planGrid, SHAPES, ORDNUNGEN } = require('./generate-v2.js');
const { convertBackfill } = require('./convert-backfill.js');
const H = require('../morph/render-harness.js');

// the page's core: the scripts of gallery.html that matter for rendering, in its order
const html = read('gallery.html');
const scripts = [...html.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/g)].map(m => m[1].replace(/\?.*$/, '')).filter(s => !/^(https?:)?\/\//.test(s) && !/combinations|gallery\.js$/.test(s));
const page = vm.createContext({ console, Math, JSON, URLSearchParams });
scripts.forEach(f => vm.runInContext(read(f), page, { filename: f }));
const P = code => vm.runInContext(code, page);

const manifestText = read('gallery/v2/manifest.jsonl');
const entries = manifestText.split('\n').filter(Boolean).map(l => JSON.parse(l));

// ---- 1. the manifest ---------------------------------------------------------------------------------------------------------------------------------
{
    const missing = entries.filter(e => !fs.existsSync(path.join(ROOT, e.path)));
    check('(1) 0 missing manifest paths (' + entries.length + ' entries)', missing.length === 0 && entries.length > 200, missing.slice(0, 2).map(e => e.path).join(' | '));
    const byPath = new Set(entries.map(e => e.path)), byKey = new Set(entries.map(e => J([e.grid, e.lines])));
    check('(1) 0 duplicate paths and 0 duplicate (grid, lines) keys', byPath.size === entries.length && byKey.size === entries.length);
    const onDisk = []; const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach(f => { if (f.isDirectory()) walk(d + '/' + f.name); else if (f.name.endsWith('.svg')) onDisk.push(d + '/' + f.name); });
    walk('gallery/v2');
    check('(1) no orphan files: every SVG under gallery/v2 is in the manifest', onDisk.length === entries.length && onDisk.every(p => byPath.has(p)), onDisk.length + ' files');
    check('(1) every record has the v2 shape (path, grid {shape, ordnung, lage 1}, group, lines, count, rendererVersion) and NO orbitIds / groupToken / symmetryMode (an old record is not smuggled in)',
        entries.every(e => Object.keys(e).sort().join() === 'count,grid,group,lines,path,rendererVersion' && Object.keys(e.grid).sort().join() === 'lage,ordnung,shape' && e.grid.lage === 1 && e.count === e.lines.length && e.rendererVersion === '2-catalog-v2'));
    // the scope: every shape x ordnung 1..3, k = 1 complete, k = 2 by the fixed rule
    let scopeBad = [];
    for (const shape of SHAPES) for (const ordnung of ORDNUNGEN) {
        const spec = { shape, ordnung, lage: 1 }, tb = P(`getLineKeyTable(${J(spec)}, GRID_V2)`), tokens = tb.entries.map(e => e.token);
        const mine = entries.filter(e => e.grid.shape === shape && e.grid.ordnung === ordnung);
        const k1 = mine.filter(e => e.count === 1).map(e => e.lines[0]), k2 = mine.filter(e => e.count === 2).map(e => e.lines.join('+'));
        const want2 = planGrid(tokens).filter(x => x.k === 2).map(x => x.tokens.join('+'));
        if (J(k1) !== J(tokens)) scopeBad.push(shape + ordnung + ':k1');
        if (J(k2) !== J(want2)) scopeBad.push(shape + ordnung + ':k2');
        if (mine.length !== tokens.length + want2.length) scopeBad.push(shape + ordnung + ':n');
    }
    check('(1) scope = 3 shapes x ordnung 1..3 (lage 1): k = 1 complete (every line key of the grid, in table order), k = 2 exactly the fixed rule (neighbour pairs + first/last); nothing else', scopeBad.length === 0, scopeBad.join(' '));
    // the committed catalog = a fresh generation, byte for byte
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-v2-'));
    generateCatalogV2(tmp);
    const bad = entries.filter(e => !fs.existsSync(path.join(tmp, e.path)) || fs.readFileSync(path.join(tmp, e.path), 'utf8') !== fs.readFileSync(path.join(ROOT, e.path), 'utf8'));
    check('(1) the committed SVGs equal a fresh generation byte for byte (' + entries.length + ' files), and so does the manifest', bad.length === 0 && fs.readFileSync(path.join(tmp, 'gallery/v2/manifest.jsonl'), 'utf8') === manifestText, bad.slice(0, 2).map(e => e.path).join(' | '));
    const bytes = entries.reduce((a, e) => a + fs.statSync(path.join(ROOT, e.path)).size, 0);
    console.log(`INFO  catalog scope: ${entries.length} SVG files, ${(bytes / 1024).toFixed(1)} KB, manifest ${manifestText.length} bytes`);
}

// ---- 2. preview = page renderer = link ------------------------------------------------------------------------------------------------------------
const dOf = svg => [...svg.matchAll(/ d="([^"]*)"/g)].map(m => m[1]);
{
    const sketch = read('sketch.js');
    const fnSrc = name => { const m = sketch.match(new RegExp('\\nfunction ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n')); return m ? m[0] : ''; };
    const constSrc = name => { const m = sketch.match(new RegExp('\\nconst ' + name + ' = [^\\n]*\\n')); return m ? m[0] : ''; };
    const parseCtx = vm.createContext({ URLSearchParams, console: { warn() { } } });
    ['core/forms.js', 'core/symmetry.js', 'core/orbits.js', 'core/catalog.js'].forEach(f => vm.runInContext(read(f), parseCtx));
    vm.runInContext(constSrc('CATALOG_URL_SHAPES') + constSrc('CATALOG_URL_MODES') + ['isWellFormedCatalogPattern', 'legacyCatalogReader', 'parseCatalogUrlV2', 'parseCatalogUrlParams', 'parseClipboardCatalogPattern', 'resolveCatalogPatternConnections'].map(fnSrc).join('') + '\nlet catalogTransportRejection = null;\n', parseCtx);
    const PC = code => vm.runInContext(code, parseCtx);
    let bad = [], n = 0;
    const states = new Map();
    for (const e of entries) {
        n++;
        const ck = e.grid.shape + e.grid.ordnung;
        if (!states.has(ck)) states.set(ck, P(`buildOrbitTable(${J(e.grid.shape)}, ${e.grid.ordnung})`));
        const st = states.get(ck);
        // (a) the file = the page's renderer on the live core (same paths in the same order)
        const idx = e.lines.map(t => st.tokens.indexOf(t));
        page.__st = st; page.__idx = idx;
        const live = P('renderSingleCellSVG(__st, __idx)');
        const fileD = dOf(fs.readFileSync(path.join(ROOT, e.path), 'utf8'));
        if (idx.some(i => i < 0) || J(fileD) !== J(dOf(live)) || fileD.length === 0) { bad.push(e.path + ':file'); continue; }
        // (b) the entry's links: URL and paste parse back to the entry's own lines, and resolve to the representative pairs the renderer drew
        const url = PC(`catalogLinkV2(${J(e)}, {})`), urlNew = PC(`catalogLinkV2(${J(e)}, { layer: 'new' })`), paste = PC(`catalogPasteV2(${J(e)})`);
        const pu = JSON.parse(J(PC(`parseCatalogUrlParams(${J(url.slice(url.indexOf('?')))})`))), pn = JSON.parse(J(PC(`parseCatalogUrlParams(${J(urlNew.slice(urlNew.indexOf('?')))})`))), pp = JSON.parse(J(PC(`parseClipboardCatalogPattern(${J(paste)})`)));
        if (!pu || !pn || !pp || J(pu.tokens) !== J(e.lines) || J(pp.tokens) !== J(e.lines) || pn.layer !== 'new' || pu.layer !== null || pu.shape !== e.grid.shape || pu.spec.ordnung !== e.grid.ordnung || /orbitIds/.test(url + paste)) { bad.push(e.path + ':link'); continue; }
        const conns = JSON.parse(J(PC(`resolveCatalogPatternConnections(parseCatalogUrlParams(${J(url.slice(url.indexOf('?')))}))`)));
        const want = idx.map(i => JSON.parse(J(P(`pairForLineKey(__st.table, __st.table.entries[${i}].key, GRID_V2)`))));
        if (J(conns) !== J(want)) bad.push(e.path + ':pairs');
    }
    check('(2) for all ' + n + ' entries (every shape and ordnung): the preview file = the page renderer on the live core (same path data), the "Open in generator" / "New layer" / "Copy pattern" links parse back to the entry\'s lines (no orbitIds) and resolve to the pairs the preview drew', bad.length === 0, bad.slice(0, 3).join(' | '));
}

// ---- 3. names -------------------------------------------------------------------------------------------------------------------------------------------
{
    let bad = [], n = 0;
    for (const e of entries) {
        const keys = e.lines.map(t => P(`parseLineKey(${J(t)})`));
        const want = P(`formatGridName(${J(e.grid)}, ${J(keys)}, { gitterV2: true, symmetryMode: 'rotation_reflection6' })`), got = P(`catalogNameV2(${J(e.grid)}, ${J(e.lines)})`);
        if (!want || want !== got) bad.push(e.path + ' ' + got + ' vs ' + want);
        n++;
    }
    check('(3) the catalog name of every entry (' + n + ') is formatGridName of its source: "{ordnung}{d|q|*}1/{group} {tokens}"', bad.length === 0 && n === entries.length, bad.slice(0, 2).join(' | '));
    // and the live generator names the same pattern the same way (export v2 name) - one per shape and ordnung
    let nb = [], nc = 0;
    for (const shape of SHAPES) for (const ordnung of ORDNUNGEN) {
        const e = entries.find(x => x.grid.shape === shape && x.grid.ordnung === ordnung && x.count === 2) || entries.find(x => x.grid.shape === shape && x.grid.ordnung === ordnung && x.count === 1);   // triangle / square ordnung 1 has a single line
        if (!e) continue;
        const c = shape === 'hex' ? ordnung : ordnung + 1;
        const w = H.makeRenderWorld(shape, c, 3, 'rotation_reflection6');
        const conns = e.lines.map(t => P(`pairForLineKey(getLineKeyTable(${J(e.grid)}, GRID_V2), parseLineKey(${J(t)}), GRID_V2)`));
        w.baseConnections(JSON.parse(J(conns)));
        const live = w.get('buildExportData().name');
        nc++; if (live !== P(`catalogNameV2(${J(e.grid)}, ${J(e.lines)})`)) nb.push(shape + ordnung + ': ' + live);
    }
    check('(3) the live generator\'s export name for the same pattern equals the catalog name (' + nc + ' patterns: every shape x ordnung)', nb.length === 0 && nc === 9, nb.join(' | '));
}

// ---- 4. the codec ----------------------------------------------------------------------------------------------------------------------------------------
{
    const rt = entries.every(e => { const b = P(`parseCatalogPathV2(${J(e.path)})`); return b && J(JSON.parse(J(b.grid))) === J(e.grid) && J(JSON.parse(J(b.tokens))) === J(e.lines); });
    check('(4) the codec is reversible for every path: parseCatalogPathV2(path) = the entry\'s grid and lines', rt);
    check('(4) the path has the layout gallery/v2/{shape}/{ordnung}/lage{lage}/k{count}/{3|4|6}star/{segment}.svg (lage in the path, the bar written "-")', entries.every(e => e.path.startsWith(`gallery/v2/${e.grid.shape}/${e.grid.ordnung}/lage${e.grid.lage}/k${e.count}/${{ triangle: 3, square: 4, hex: 6 }[e.grid.shape]}star/`)) && entries.some(e => e.lines.some(t => t.endsWith('~')) && e.path.includes('-')) && !entries.some(e => /[~+]/.test(e.path)));
    const sorted = P("catalogSortedTokensV2(['65a', '12.11a', '21a', '21a'])");
    check('(4) tokens are sorted NUMERICALLY (compareLineKeys), duplicates kept: 21a 21a 65a 12.11a, not the string order 12.11a 21a 21a 65a', J(sorted) === J(['21a', '21a', '65a', '12.11a']) && P("catalogPathV2({ shape: 'hex', ordnung: 3, lage: 1 }, catalogSortedTokensV2(['65a', '12.11a']))") === 'gallery/v2/hex/3/lage1/k2/6star/65a_12.11a.svg');
    check('(4) a lage-2 grid has its own path (lage in the path: two grids never share a file)', P("catalogPathV2({ shape: 'square', ordnung: 2, lage: 2 }, ['11e'])") !== P("catalogPathV2({ shape: 'square', ordnung: 2, lage: 1 }, ['11e'])") && /\/lage2\//.test(P("catalogPathV2({ shape: 'square', ordnung: 2, lage: 2 }, ['11e'])")));
    // one source: gallery.js and the tools carry no path template or name builder of their own
    const g = read('gallery.js'), tools = ['tools/gallery/generate-v2.js', 'tools/gallery/convert-backfill.js'].map(read).join('\n');
    check('(4) gallery.js has no codec of its own (no gallery/v2 path template, no k${count} segment, no name builder): it calls catalogPathV2 / catalogNameV2 / catalogLinkV2 / catalogPasteV2 from core/catalog.js', !/gallery\/v2\/\$\{|`gallery\/|k\$\{|star['`]/.test(g.replace(/const CATALOG_V2_(MANIFEST|BACKFILL) = [^\n]*\n/g, '')) && !/function (catalogPathV2|catalogNameV2|catalogLinkV2|catalogPasteV2|catalogSortedTokensV2|parseCatalogPathV2)\b/.test(g) && /catalogPathV2\(/.test(g) && /catalogNameV2\(/.test(g) && /catalogLinkV2\(/.test(g) && /catalogPasteV2\(/.test(g));
    check('(4) the tools use the codec through core/catalog.js only (catalogEntryV2), no own template', /catalogEntryV2/.test(tools) && !/k\$\{|star`|'star'/.test(tools) && /'core\/catalog\.js'/.test(read('tools/gallery/renderSingleCellSVG.js')));
    // the viewer refuses what is not v2 (extracted normalizeEntryV2 from gallery.js)
    const fnSrc = name => { const m = g.match(new RegExp('\\nfunction ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n')); return m ? m[0] : ''; };
    vm.runInContext(fnSrc('normalizeEntryV2'), page);
    const norm = o => { try { return P(`normalizeEntryV2(${J(o)})`); } catch (e) { return 'refused'; } };
    const oldRec = { path: 'gallery/triangle/3/k2/D3/0+1.svg', shape: 'triangle', order: 3, symmetryMode: 'rotation_reflection6', groupToken: 'D3', count: 2, orbitIds: [0, 1], isSample: false, rendererVersion: '1.11-catalog-v1' };
    const good = entries[5], other = Object.assign({}, good, { path: entries[6].path }), bad2 = Object.assign({}, good, { count: 9 }), noGrid = Object.assign({}, good); delete noGrid.grid;
    check('(4) the viewer accepts a v2 record and refuses an old orbitIds record, a path that does not match its grid and lines, a wrong count and a record without grid',
        norm(good) !== 'refused' && norm(good).shape === good.grid.shape && norm(good).order === good.grid.ordnung && [oldRec, other, bad2, noGrid, null, 'x'].every(r => norm(r) === 'refused'));
    check('(4) the viewer reads gallery/v2/manifest.jsonl and gallery/v2/ostwald-backfill.csv, not the old files', /const CATALOG_V2_MANIFEST = 'gallery\/v2\/manifest\.jsonl';/.test(g) && /const CATALOG_V2_BACKFILL = 'gallery\/v2\/ostwald-backfill\.csv';/.test(g) && !/fetch\('gallery\/(manifest|ostwald)/.test(g));
}

// ---- 5. backfill and the untouched old catalog --------------------------------------------------------------------------------------------------------
{
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-v2-'));
    fs.mkdirSync(path.join(tmp, 'gallery/v2'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'gallery/v2/manifest.jsonl'), path.join(tmp, 'gallery/v2/manifest.jsonl'));
    const r = convertBackfill(tmp);
    const oldRows = read('gallery/ostwald-backfill.csv').split('\n').filter(Boolean).slice(1);
    check('(5) backfill: every row of gallery/ostwald-backfill.csv is mapped to a v2 key path that exists in the manifest (' + r.mapped.length + '/' + oldRows.length + '), none unmapped, none lost', r.mapped.length === oldRows.length && r.unmapped.length === 0 && r.mapped.every(m => m.inCatalog), J(r.unmapped));
    const out = fs.readFileSync(path.join(tmp, 'gallery/v2/ostwald-backfill.csv'), 'utf8'), committed = read('gallery/v2/ostwald-backfill.csv');
    check('(5) the committed gallery/v2/ostwald-backfill.csv equals the conversion; labels and urls are the old rows\' own', out === committed && oldRows.every((row, i) => committed.split('\n')[i + 1].split(',').slice(1).join(',') === row.split(',').slice(1).join(',')));
    // the badge path of a catalog entry is its v2 path: every mapped path is a manifest entry
    const manifestPaths = new Set(entries.map(e => e.path));
    check('(5) every backfill path is a catalog entry of the viewer (the badge is found by entryCatalogPath)', committed.split('\n').slice(1).filter(Boolean).every(row => manifestPaths.has(row.split(',')[0])));
    let untouched = true;
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        const changed = cp.execFileSync('git', ['diff', '--name-only', BASE, '--', 'gallery/', ':!gallery/v2'], { cwd: ROOT, encoding: 'utf8' }).trim();
        untouched = changed === '';
        check('(5) the old catalog (every file under gallery/ outside gallery/v2, the manifest and the old CSV included) is unchanged against ' + BASE, untouched, changed.slice(0, 120));
    } catch (e) { console.log('NOTE  ' + BASE + ' is not available: the old-catalog check is skipped'); }
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
