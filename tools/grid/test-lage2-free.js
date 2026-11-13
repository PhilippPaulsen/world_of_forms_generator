// Task 072d: lage 2 is free (the developer switch ?lage2=1 / globalThis.__lage2 of task 067 is gone); the ceiling LAGE2_MAX (12 / 12 / 9) is the only limit; the transport (URL, paste) loads lage 2.
//   node tools/grid/test-lage2-free.js     FORMS_JS / ORBITS_JS / SESSION_JS / SKETCH_JS replace one file by a (sabotaged) copy
//   1. no switch anywhere in the sources (core, page scripts, html), no ?lage2 reader, no 'switch-off' reason, no allowLage2 option, LAGE2_MAX is the ONE table
//   2. without any flag: setBaseLage / setLayerLage for the three shapes up to the ceiling, one above: ordnung-limit with the limit; the form change keeps the lage
//   3. the session: a lage-2 base and a lage-2 layer validate and plan without any flag; lage 3 and an order over the ceiling are refused
//   4. the export name with lage 2; the transport round trip (export -> paste / URL) for lage 2 of all shapes, the layer path (a new layer carries lage 2)
//   5. invalid transport input (lage 3, ordnung over the ceiling, an unknown token, a token of another lage) is refused with the code, and nothing is mutated
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const S = require('../session/scenarios.js'), H = require('../morph/render-harness.js');
const SKETCH = process.env.SKETCH_JS ? fs.readFileSync(process.env.SKETCH_JS, 'utf8') : read('sketch.js');
const fnSrc = (src, name) => { const m = src.match(new RegExp('\\nfunction ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const LM = { triangle: 12, square: 12, hex: 9 }, SHAPES = ['triangle', 'square', 'hex'];

// ---- 1. the sources -------------------------------------------------------------------------------------------------------------------------------
{
    const files = [...fs.readdirSync(path.join(ROOT, 'core')).filter(f => /\.js$/.test(f)).map(f => 'core/' + f), 'sketch.js', 'ui.js', 'ui-form.js', 'ui-layer.js', 'ui-layers.js', 'ui-i18n.js', 'gallery.js', 'gallery-render.js', 'index.html', 'gallery.html']
        .filter(f => fs.existsSync(path.join(ROOT, f)));
    const src = f => (process.env[{ 'core/forms.js': 'FORMS_JS', 'core/orbits.js': 'ORBITS_JS', 'core/session.js': 'SESSION_JS', 'sketch.js': 'SKETCH_JS' }[f]] ? fs.readFileSync(process.env[{ 'core/forms.js': 'FORMS_JS', 'core/orbits.js': 'ORBITS_JS', 'core/session.js': 'SESSION_JS', 'sketch.js': 'SKETCH_JS' }[f]], 'utf8') : read(f));
    const hit = files.filter(f => /__lage2|lage2SwitchOn|switch-off|allowLage2|enforceLage2|get\('lage2'\)|lage2=1/.test(src(f)));
    check('(1) no developer switch in core/*.js, sketch.js, the page scripts, i18n, gallery and the html pages: __lage2, lage2SwitchOn, switch-off, allowLage2, the ?lage2 reader (' + files.length + ' files)', hit.length === 0, J(hit));
    const tables = files.filter(f => /LAGE2_MAX\s*=/.test(src(f)));
    check('(1) LAGE2_MAX is defined once (core/forms.js), 12 / 12 / 9; every bound reads it through maxOrdnungFor(shape, 2)', J(tables) === J(['core/forms.js']) && /const LAGE2_MAX = \{ triangle: 12, square: 12, hex: 9 \};/.test(src('core/forms.js')));
    const w = H.makeRenderWorld('square', 3, 3, 'rotation_reflection6');
    check('(1) a fresh page: maxOrdnungFor(shape, 2) = 12 / 12 / 9 and gridMaxOrdnung the same; lage 3 and unknown 0', SHAPES.every(s => w.get(`maxOrdnungFor(${J(s)}, 2) === ${LM[s]} && gridMaxOrdnung(${J(s)}, 2) === ${LM[s]}`)) && w.get("maxOrdnungFor('hex', 3) === 0 && maxOrdnungFor('x', 2) === 0"));
}

// ---- 2. setBaseLage / setLayerLage / form change -------------------------------------------------------------------------------------------------
const P5 = ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect', 'translate', 'rotate', 'scale', 'textSize', 'text', 'textAlign', 'background', 'clear'];
function world(shape, ordnung, lage) {
    const w = H.makeRenderWorld(shape, 3, 3, 'rotation_reflection6'), sb = w.sb;
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.CLOSE = 'close'; sb.window = { UI: undefined };
    sb.URLSearchParams = URLSearchParams; sb.console = { warn() { }, log() { }, error() { } };
    P5.forEach(f => { sb[f] = () => { }; });
    w.set(`setGrid(${J({ shape, ordnung, lage })});`);
    return w;
}
{
    const bad = [];
    for (const shape of SHAPES) {
        const lim = LM[shape];
        const w = world(shape, lim, 1);
        const r = w.get('setBaseLage(2)');
        if (!(r.ok && r.changed && w.get('gridSpec.lage') === 2 && w.get('gridSpec.ordnung') === lim)) bad.push(shape + ' base at the limit: ' + J(r));
        const over = world(shape, lim + 1, 1);
        if (lim + 1 <= (shape === 'hex' ? 12 : 12)) { const ro = over.get('setBaseLage(2)'); if (!(ro.ok === false && ro.reason === 'ordnung-limit' && ro.limit === lim && over.get('gridSpec.lage') === 1)) bad.push(shape + ' base one above: ' + J(ro)); }
        const l = world(shape, 2, 1); l.set(fnSrc(read('sketch.js'), 'addLayer')); l.set('addLayer();');
        const lr = l.get('setLayerLage(additionalLayers[0], 2)');
        if (!(lr.ok && l.get('layerGridSpecOf(additionalLayers[0]).lage') === 2)) bad.push(shape + ' layer: ' + J(lr));
    }
    check('(2) without any flag: setBaseLage(2) up to the ceiling (12 / 12 / 9), one above refused with ordnung-limit and the limit, nothing changed; setLayerLage(layer, 2) works; never "switch-off"', bad.length === 0, bad.slice(0, 3).join(' | '));
    const bad2 = [];
    for (const shape of SHAPES) {
        const w = world(shape, 3, 2);
        const to = shape === 'triangle' ? 'square' : 'triangle';
        const kept = w.get(`(function () { const s = gridSpecOnShape(gridSpec, ${J(to)}); return s.lage; })()`);
        if (kept !== 2) bad2.push(shape + ' -> ' + to + ': lage ' + kept);
    }
    check('(2) the form change keeps lage 2 (gridSpecOnShape), without any flag', bad2.length === 0, bad2.join(' | '));
}

// ---- 3. the session -----------------------------------------------------------------------------------------------------------------------------
{
    const bad = [];
    for (const shape of SHAPES) {
        const src = world(shape, 2, 2);
        const ui = S.uiOf(src, 'none', 6), snap = JSON.parse(J(S.snapOf(src, ui))); snap.savedAt = 1;
        const fresh = S.newCtx(); S.reset(fresh, shape === 'hex' ? 'square' : 'hex', 3, 3, 'none');
        const v = fresh.sb.validateSession(JSON.parse(J(snap)));
        const pl = v.ok ? fresh.sb.planSessionRestore(v.snapshot, { canvasW: S.CANVAS, canvasH: S.CANVAS }) : null;
        if (!(v.ok && pl && pl.ok)) bad.push(shape + ': ' + J(v).slice(0, 80) + ' ' + J(pl && { ok: pl.ok, code: pl.code, detail: pl.detail }));
        const l3 = JSON.parse(J(snap)); l3.settings.grid.lage = 3;
        const over = JSON.parse(J(snap)); over.settings.grid.ordnung = LM[shape] + 1;
        if (fresh.sb.validateSession(l3).ok !== false || fresh.sb.validateSession(over).ok !== false) bad.push(shape + ': lage 3 / over the ceiling accepted');
    }
    check('(3) a lage-2 snapshot of every shape validates AND plans without any flag; lage 3 and an order over the ceiling are refused', bad.length === 0, bad.slice(0, 3).join(' | '));
}

// ---- 4. export name and transport ---------------------------------------------------------------------------------------------------------------
const T = H.makeRenderWorld('hex', 3, 3, 'rotation_reflection6');
T.sb.URLSearchParams = URLSearchParams; T.sb.console = { warn() { }, log() { }, error() { } };
T.sb.document = { body: {} }; T.sb.window = { UI: undefined };
T.run(['parseCatalogUrlV2', 'parseCatalogUrlParams', 'parseClipboardCatalogPattern', 'resolveCatalogPatternConnections'].map(n => fnSrc(SKETCH, n)).join('') + '\nlet catalogTransportRejection = null;\n');
const parseUrl = q => { T.run('catalogTransportRejection = null;'); const p = T.get(`parseCatalogUrlParams(${J(q)})`); return { p: p ? JSON.parse(J(p)) : null, rej: T.get('catalogTransportRejection') }; };
const parsePaste = t => { T.run('catalogTransportRejection = null;'); const p = T.get(`parseClipboardCatalogPattern(${J(t)})`); return { p: p ? JSON.parse(J(p)) : null, rej: T.get('catalogTransportRejection') }; };
const tableOf = spec => T.get(`getLineKeyTable(${J(spec)})`);
const urlOf = (spec, keys, opts) => T.get(`formatTransportUrlV2(${J(spec)}, ${J(keys)}, ${J(opts || {})})`);
const pasteOf = (spec, keys) => T.get(`formatTransportPasteV2(${J(spec)}, ${J(keys)})`);
const STATE = () => T.get('JSON.stringify({ connections, nodes, gridSpec, gridRevision, additionalLayers, currentShape, nodeCount })');
{
    const bad = [], names = [];
    for (const shape of SHAPES) for (const ordnung of [1, 2, 3]) {
        const spec = { shape, ordnung, lage: 2 }, tb = tableOf(spec), entries = tb.entries, pick = [entries[0], entries[Math.floor(entries.length / 2)], entries[entries.length - 1]], keys = pick.map(e => e.key);
        const exp = JSON.parse(J(keys.slice().sort((a, b) => T.get(`compareLineKeys(${J(a)}, ${J(b)})`))));
        const u = parseUrl(urlOf(spec, keys, {})), pp = parsePaste(pasteOf(spec, keys));
        if (!(u.p && u.p.spec && u.p.spec.lage === 2 && J(u.p.spec) === J(spec) && J(u.p.keys) === J(exp) && pp.p && pp.p.spec.lage === 2 && J(pp.p.keys) === J(exp))) { bad.push(shape + ordnung + ': ' + J(u.rej) + J(pp.rej)); continue; }
        // the resolved connections draw the pattern of the source: the export name of the source world carries the same grid and keys
        const w = world(shape, ordnung, 2), conns = JSON.parse(J(T.get(`resolveCatalogPatternConnections(parseCatalogUrlParams(${J(urlOf(spec, keys, {}))}))`)));
        w.baseConnections(conns);
        const name = w.get('buildExportData().name'); names.push(name);
        if (!name || name.split(' ')[0] !== ordnung + { triangle: 'd', square: 'q', hex: '*' }[shape] + '2/' + { triangle: '3*', square: '4*', hex: '6*' }[shape]) bad.push(shape + ordnung + ' export name ' + name);
    }
    check('(4) lage 2 round trip of all shapes (ordnung 1..3, ' + names.length + ' patterns): URL and paste give the spec with lage 2 and the sorted keys; the resolved lines export a name "{n}{d|q|*}2/{3*|4*|6*} ..."', bad.length === 0 && names.length === 9, bad.slice(0, 3).join(' | '));
    // the layer path: a new layer carries lage 2
    const w = world('square', 3, 1);
    ['addLayer', 'updateActiveLayerGrid', 'removeLayer', 'applyCatalogPatternToNewLayer', 'resolveCatalogPatternConnections'].forEach(n => { try { w.set(fnSrc(SKETCH, n)); } catch (e) { /* not needed */ } });
    const spec = { shape: 'hex', ordnung: 3, lage: 2 }, tb = tableOf(spec), keys = [tb.entries[0].key, tb.entries[tb.entries.length - 1].key];
    const pat = JSON.parse(J(T.get(`parseClipboardCatalogPattern(${J(pasteOf(spec, keys))})`)));
    w.set('var transportConnectionsV2_ok = true;');
    let ok = false, info = '';
    try { ok = w.get(`applyCatalogPatternToNewLayer(${J(pat)})`) === true; info = J([w.get('additionalLayers.length'), w.get('layerGridSpecOf(additionalLayers[0]).lage'), w.get('additionalLayers[0].connections.length')]); } catch (e) { info = String(e.message).slice(0, 150); }
    check('(4) the layer path: applyCatalogPatternToNewLayer with a lage-2 pattern gives a new layer on lage 2 with its lines', ok && info === J([1, 2, 2]), info);
}

// ---- 5. invalid transport input ----------------------------------------------------------------------------------------------------------------
{
    const spec = { shape: 'square', ordnung: 3, lage: 2 }, tb = tableOf(spec), good = tb.entries[0].token, other1 = tableOf({ shape: 'square', ordnung: 3, lage: 1 }).entries.map(e => e.token).find(t => !tb.byToken.has(t));
    const before = STATE();
    const q = o => 'v=2' + Object.entries(Object.assign({ shape: 'square', ordnung: '3', lage: '2', group: '4*', lines: good }, o)).map(([k, v]) => '&' + k + '=' + encodeURIComponent(v)).join('').replace(/^&v=2/, '');
    const cases = [
        ['lage 3', '?v=2&shape=square&ordnung=3&lage=3&group=4*&lines=' + good, 'invalid'],
        ['ordnung 13 on lage 2 (over the ceiling)', '?v=2&shape=square&ordnung=13&lage=2&group=4*&lines=' + good, 'invalid'],
        ['hex ordnung 10 on lage 2', '?v=2&shape=hex&ordnung=10&lage=2&group=6*&lines=' + good, 'invalid'],
        ['an unknown token', '?v=2&shape=square&ordnung=3&lage=2&group=4*&lines=' + good + ',99z', 'invalid'],
        ['a valid token followed by a bad one (nothing half-loaded)', '?v=2&shape=square&ordnung=3&lage=2&group=4*&lines=' + good + ',' + good + ',zz9', 'invalid'],
        ['lage missing', '?v=2&shape=square&ordnung=3&lage=&group=4*&lines=' + good, 'invalid'],
    ];
    if (other1) cases.push(['a token that exists only on lage 1 of this grid (' + other1 + ')', '?v=2&shape=square&ordnung=3&lage=2&group=4*&lines=' + other1, 'invalid']);
    const bad = [];
    for (const [name, url, code] of cases) { const r = parseUrl(url); if (r.p !== null || !r.rej || r.rej.code !== code) bad.push(name + ' -> ' + J(r.rej)); }
    const pastes = [
        ['paste lage 3', J({ version: 2, grid: { shape: 'square', ordnung: 3, lage: 3 }, group: '4*', lines: [good] })],
        ['paste ordnung 13 lage 2', J({ version: 2, grid: { shape: 'square', ordnung: 13, lage: 2 }, group: '4*', lines: [good] })],
        ['paste unknown token', J({ version: 2, grid: { shape: 'square', ordnung: 3, lage: 2 }, group: '4*', lines: [good, '99z'] })],
    ];
    for (const [name, text] of pastes) { const r = parsePaste(text); if (r.p !== null || !r.rej || r.rej.code !== 'invalid') bad.push(name + ' -> ' + J(r.rej)); }
    const control = parseUrl('?v=2&shape=square&ordnung=3&lage=2&group=4*&lines=' + good);
    check('(5) ' + (cases.length + pastes.length) + ' invalid inputs (lage 3, ordnung over the ceiling, unknown tokens, a token of lage 1 only, missing lage) are refused with the code "invalid" (the valid control parses), and the state is untouched', bad.length === 0 && control.p !== null && STATE() === before, bad.slice(0, 3).join(' | '));
}
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
