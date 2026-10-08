// Gallery smoke test: the gallery page must be able to open a catalog pattern. Headless, no browser.
//   node tools/gallery/test-gallery-smoke.js
//   GALLERY_ROOT=/path/to/clean/export node tools/gallery/test-gallery-smoke.js          (a clean export of any commit; the tag pre-ui-rework is expected to FAIL)
//   GALLERY_HTML=/path/to/other-gallery.html GALLERY_FILE_OVERRIDES='{"gallery-render.js":"/path/to/mutated.js"}' node ...      (sabotage runs)
//
// What it does. It reads the <script src> list of gallery.html, in its order, and loads exactly those local scripts into one vm context - gallery.js
// included, with a minimal DOM stub (gallery.js needs document, fetch and a clipboard) - so a script that is removed from or reordered in gallery.html breaks
// this test, and so does a global that a loaded core file reads but nothing on the page defines (the gallery never loads core/state.js; gallery-render.js is
// the shim that stands in for it). Then it does what a person does: waits for the manifest, opens four catalog patterns (gallery.js openDetailView() ->
// renderFullTessellationSVG()), builds the orbit table and its tile previews for the same shapes (renderOrbitGrid() -> renderSingleCellSVG(), which swallows
// a failing tile as the text "render failed"), and checks the two links of the detail view ("Open in generator" / "New layer" and "Copy pattern") parse
// with the generator's own parsers, extracted from sketch.js.
// Deliberately NOT loaded in the gallery: core/faces.js, core/facecolor.js, core/color.js and core/farborgel-bridge.js (the shim sets showFaces = false and
// additionalLayers = [], so core/tiling.js never reaches them). If a gallery feature ever needs them, the exclusion in this test (the script list it reads from
// gallery.html, and the "not loaded" assumption of test-gallery-globals.js) and the shim in gallery-render.js have to change together.
// Why: the shim lacked six globals from 629e7575 (2026-09-24) on, so every detail view and every custom-combinations preview failed on the live site while the
// grid (pre-rendered SVG files) looked fine; nothing executed the gallery's render path.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..', '..');
const ROOT = process.env.GALLERY_ROOT || REPO;
const overrides = process.env.GALLERY_FILE_OVERRIDES ? JSON.parse(process.env.GALLERY_FILE_OVERRIDES) : {};
const fileOf = rel => overrides[rel] || path.join(ROOT, rel);
const htmlPath = process.env.GALLERY_HTML || path.join(ROOT, 'gallery.html');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 120)); } };   // a check that crashes is a FAIL, not a crashed test

// ---- the DOM stub -------------------------------------------------------------------------------------------------------------------------------------
function makeDom() {
    const byId = new Map(), created = [], consoleErrors = [], clipboard = [];
    const mk = (tag, id) => {
        const base = { tagName: tag, id: id || '', children: [], dataset: {}, innerHTML: '', textContent: '', hidden: false, className: '', value: '', checked: false, href: '', onclick: null, type: '', title: '', listeners: {},
            style: new Proxy({}, { get: (t, k) => (k in t ? t[k] : ''), set: (t, k, v) => { t[k] = v; return true; } }),
            classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } } };
        base.appendChild = c => { base.children.push(c); return c; };
        base.append = (...c) => { base.children.push(...c); };
        base.addEventListener = (ev, fn) => { (base.listeners[ev] = base.listeners[ev] || []).push(fn); };
        base.removeChild = c => c;
        base.setAttribute = (k, v) => { base[k] = v; };
        base.getAttribute = k => base[k];
        base.querySelector = () => mk('div');
        base.querySelectorAll = () => [];
        const el = new Proxy(base, { get(t, k) { if (k in t) return t[k]; if (typeof k === 'symbol') return undefined; return function () { return undefined; }; }, set(t, k, v) { t[k] = v; return true; } });
        created.push(el);
        return el;
    };
    const document = {
        getElementById(id) { if (!byId.has(id)) byId.set(id, mk('div', id)); return byId.get(id); },
        createElement: tag => mk(tag), createDocumentFragment: () => mk('fragment'), createTextNode: text => ({ textContent: String(text), nodeType: 3 }),
        querySelector: () => mk('div'), querySelectorAll: () => [], addEventListener() { }, body: null, documentElement: null,
    };
    document.body = mk('body'); document.documentElement = mk('html');
    return { document, byId, created, consoleErrors, clipboard };
}

// ---- load exactly the script list of gallery.html ----------------------------------------------------------------------------------------------------
const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/g)].map(m => m[1].replace(/\?.*$/, '')).filter(s => !/^(https?:)?\/\//.test(s));
console.log('gallery.html loads, in order: ' + scripts.join(', '));

// One fresh page = one vm context with exactly gallery.html's scripts. Two of them: the render paths create implicit globals as they run (drawTessellation()
// assigns activeNetWarp, gallery-render.js assigns nodes, ...), so a path that runs after another can hide a global the shim lacks. The custom-combinations
// path gets its own page and runs first there; so does the detail view.
function bootPage() {
    const dom = makeDom();
    const sandbox = {
        console: { log() { }, warn() { }, info() { }, error: (...a) => { dom.consoleErrors.push(a.map(String).join(' ')); } },
        document: dom.document, setTimeout, clearTimeout, URLSearchParams, Promise,
        navigator: { clipboard: { writeText: async t => { dom.clipboard.push(t); } } },
        location: { href: 'http://localhost/gallery.html', search: '', pathname: '/gallery.html' },
        performance: { now: () => Date.now() },
        fetch: async url => {
            const file = fileOf(String(url));
            if (!fs.existsSync(file)) return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' };
            return { ok: true, status: 200, statusText: 'OK', text: async () => fs.readFileSync(file, 'utf8') };
        },
    };
    const ctx = vm.createContext(sandbox);
    ctx.window = ctx;
    const loadErrors = [];
    for (const rel of scripts) {
        try { vm.runInContext(fs.readFileSync(fileOf(rel), 'utf8'), ctx, { filename: rel }); } catch (e) { loadErrors.push({ rel, message: String(e.message).slice(0, 140) }); }
    }
    return { dom, ctx, run: code => vm.runInContext(code, ctx), loadErrors };
}
const pageC = bootPage();   // custom combinations first
const pageD = bootPage();   // detail view first
const { dom, ctx, run } = pageD;

console.log('\n== the page loads ==');
for (const rel of scripts) check('script loads: ' + rel, !pageC.loadErrors.some(e => e.rel === rel), (pageC.loadErrors.find(e => e.rel === rel) || {}).message);
check('a second fresh page loads the same scripts the same way', JSON.stringify(pageD.loadErrors) === JSON.stringify(pageC.loadErrors), pageD.loadErrors.length + ' errors');
check('the list contains the render shim and the page script (a test of nothing otherwise)', scripts.includes('gallery-render.js') && scripts.includes('gallery.js') && scripts.some(s => /^core\/tiling\.js$/.test(s)), scripts.length + ' scripts');

(async () => {
    // ---- the manifest ---------------------------------------------------------------------------------------------------------------------------------
    console.log('\n== the catalog ==');
    let status = '';
    for (let i = 0; i < 200; i++) { status = dom.byId.has('manifest-status') ? dom.byId.get('manifest-status').textContent : ''; if (/entries loaded|Failed/.test(status)) break; await new Promise(r => setTimeout(r, 50)); }
    check('gallery.js finished init: the manifest status says "N entries loaded"', /^\d+ entries loaded/.test(status), status.slice(0, 100));
    const manifestPath = fileOf('gallery/manifest.jsonl');
    const lines = fs.readFileSync(manifestPath, 'utf8').split('\n').filter(Boolean);
    const all = lines.map(l => JSON.parse(l));
    check('the status count is the manifest row count', status.startsWith(all.length + ' entries'), all.length);

    // four real catalog patterns: the first row of each shape and the last row of the manifest
    const picks = [];
    for (const shape of ['triangle', 'square', 'hex']) { const e = all.find(x => x.shape === shape); if (e) picks.push(e); }
    const lastRow = all[all.length - 1]; if (!picks.includes(lastRow)) picks.push(lastRow);
    check('four distinct catalog patterns picked', picks.length === 4 && new Set(picks.map(p => p.path)).size === 4, picks.map(p => p.shape + p.order + ' ' + p.orbitIds.join('+')).join(' | '));

    // the generator's own parsers, extracted from sketch.js (the same text the page runs)
    const sketch = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
    const fnSrc = name => { const m = sketch.match(new RegExp('\\nfunction ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n')); return m ? m[0] : ''; };
    const constSrc = name => { const m = sketch.match(new RegExp('\\nconst ' + name + ' = [^\\n]*\\n')); return m ? m[0] : ''; };
    const parseCtx = vm.createContext({ URLSearchParams, console: { warn() { } } });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'core/forms.js'), 'utf8'), parseCtx);
    const parserSrc = constSrc('CATALOG_URL_SHAPES') + constSrc('CATALOG_URL_MODES') + fnSrc('isWellFormedCatalogPattern') + fnSrc('parseCatalogUrlParams') + fnSrc('parseClipboardCatalogPattern');
    check('the generator\'s catalog parsers were found in sketch.js', ['CATALOG_URL_SHAPES', 'CATALOG_URL_MODES', 'function isWellFormedCatalogPattern', 'function parseCatalogUrlParams', 'function parseClipboardCatalogPattern'].every(s => parserSrc.includes(s)));
    vm.runInContext(parserSrc, parseCtx);

    // ---- the detail view: what a click on a tile does -------------------------------------------------------------------------------------------------
    console.log('\n== the detail view (openDetailView -> renderFullTessellationSVG) ==');
    for (const e of picks) {
        const label = `${e.shape} order ${e.order} orbits ${e.orbitIds.join('+')} (${e.symmetryMode})`;
        T('detail view ' + label, () => {
            ctx.__entry = e;
            run('openDetailView(__entry)');
            const c = dom.document.getElementById('detail-svg-container');
            check('detail view renders ' + label + ': an <svg> with paths, no error text', /<svg/.test(c.innerHTML) && /<path /.test(c.innerHTML) && !/Failed/.test(c.textContent), (c.textContent || '').slice(0, 90) || (c.innerHTML.match(/<path /g) || []).length + ' paths');
            // "Open in generator", "New layer" and "Copy pattern": one real example each
            const openUrl = dom.document.getElementById('detail-open-generator').href, layerUrl = dom.document.getElementById('detail-open-new-layer').href;
            const parsed = parseCtx.parseCatalogUrlParams(openUrl.slice(openUrl.indexOf('?')));
            check('Open in generator: ' + openUrl.slice(0, 70) + '... parses back to the same pattern', parsed && parsed.shape === e.shape && parsed.order === e.order && parsed.symmetryMode === e.symmetryMode && JSON.stringify(parsed.orbitIds) === JSON.stringify(e.orbitIds) && parsed.layer === null, JSON.stringify(parsed).slice(0, 80));
            const parsedLayer = parseCtx.parseCatalogUrlParams(layerUrl.slice(layerUrl.indexOf('?')));
            check('New layer link parses with layer=new', parsedLayer && parsedLayer.layer === 'new' && parsedLayer.shape === e.shape, layerUrl.slice(-30));
        });
    }
    // Copy pattern: click once on the first pick
    await (async () => {
        try {
            ctx.__entry = picks[0]; run('openDetailView(__entry)');
            dom.clipboard.length = 0;
            await dom.document.getElementById('detail-copy-pattern').onclick();
            const payload = dom.clipboard[0];
            const back = payload ? parseCtx.parseClipboardCatalogPattern(payload) : null;
            check('Copy pattern writes a payload the generator\'s Paste Pattern parser accepts, equal to the entry', !!back && back.shape === picks[0].shape && back.order === picks[0].order && back.symmetryMode === picks[0].symmetryMode && JSON.stringify(back.orbitIds) === JSON.stringify(picks[0].orbitIds), (payload || '').slice(0, 90));
        } catch (err) { check('Copy pattern', false, 'threw: ' + String(err.message).slice(0, 100)); }
    })();

    // ---- the custom combinations: orbit table tiles, a combination preview, and the generated k-combination grid (on its OWN fresh page) -----------------------
    console.log('\n== custom combinations, on a fresh page (buildOrbitTable -> renderOrbitGrid -> renderSingleCellSVG, generateCombinations -> renderComboGrid) ==');
    for (let i = 0, st = ''; i < 200 && !/entries loaded|Failed/.test(st); i++) { await new Promise(r => setTimeout(r, 50)); st = pageC.dom.byId.has('manifest-status') ? pageC.dom.byId.get('manifest-status').textContent : ''; }
    for (const e of picks) {
        const label = `${e.shape} order ${e.order} (${e.symmetryMode})`;
        T('orbit tiles ' + label, () => {
            pageC.ctx.__entry = e;
            const before = pageC.dom.created.length;
            pageC.run('orbitBuilderState = buildOrbitTable(__entry.shape, __entry.order, __entry.symmetryMode); renderOrbitGrid();');
            const previews = pageC.dom.created.slice(before).filter(el => el.className === 'orbit-tile-preview');
            const good = previews.filter(el => /<path /.test(el.innerHTML)).length, failed = previews.filter(el => /render failed/.test(el.textContent)).length;
            check('orbit tiles ' + label + ': every tile preview has paths, none says "render failed"', previews.length > 0 && good === previews.length && failed === 0, `${good}/${previews.length} drawn, ${failed} failed`);
            const k = Math.min(3, e.orbitIds.length);
            pageC.ctx.__ids = e.orbitIds.slice(0, k);
            const svg = pageC.run('renderSingleCellSVG(orbitBuilderState, __ids)');
            check('combination preview ' + label + ' (' + k + ' orbits) draws paths', /<path /.test(svg), (svg.match(/<path /g) || []).length + ' paths');
            // the generated k = 2 combinations of the first three orbits (needs tools/gallery/combinations.js)
            const n = Math.min(3, pageC.run('orbitBuilderState.table.orbits.length'));
            pageC.ctx.__n = n;
            const b2 = pageC.dom.created.length;
            pageC.run('selectedOrbitIds = new Set(Array.from({ length: __n }, (_, i) => i)); generateCombinations(2);');
            const cells = pageC.dom.created.slice(b2).filter(el => el.className === 'inline-preview');
            const drawn = cells.filter(el => /<path /.test(el.innerHTML)).length, failedCells = cells.filter(el => /Failed to render/.test(el.textContent)).length;
            const want = n * (n - 1) / 2;
            check('generated 2-combinations of the first ' + n + ' orbits of ' + label + ': ' + want + ' cells, all drawn', cells.length === want && drawn === want && failedCells === 0, `${drawn}/${cells.length} drawn, ${failedCells} failed`);
        });
    }

    console.log('\n== no console errors during all of it ==');
    const errs = pageC.dom.consoleErrors.concat(pageD.dom.consoleErrors);
    check('console.error was never called', errs.length === 0, errs[0] ? errs[0].slice(0, 100) : undefined);

    console.log(`\n${checks - failures}/${checks} checks passed`);
    console.log(failures ? 'FAIL' : 'PASS');
    process.exit(failures ? 1 : 0);
})();
