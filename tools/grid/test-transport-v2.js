// G6b (task 063): export v2 and the pattern transport v2 (URL / paste).
//   node tools/grid/test-transport-v2.js     BASE = the commit before 063 (default b3dcd67e); OLD_TREE = that tree already extracted (sabotage copies have no .git)
//   1. SVG: the geometry text equals the old tree for 69 cases (3 shapes x order x 4 symmetry modes x lines/faces, free ends, morph frames); a <title> with the grid name is the ONLY addition,
//      escaped; no name -> byte-identical
//   2. export v2: formatVersion 2, meta.grid, nodes with zahl/u/v, lineKeys, name; no nodeCount / orbitIds / patternName / themeLineOrbits anywhere; layers the same contract;
//      line -> key -> connection round trip draws the same pattern; free lines and reduced modes give null
//   3. URL / paste v2: valid patterns of all shapes load equal to their source; wrong version, bad tokens, bad grid, old fields in v2 input: refused, nothing mutated
//   4. unsorted tokens are accepted and sorted numerically (duplicates kept, capital partners normalized)
//   5. messages de / en; the legacy reader (decision B): old links still load, identical to the old tree; it never writes, never rescues a v2 input; its pin (G7 removes it)
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'b3dcd67e';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });
const S = require('../session/scenarios.js'), H = require('../morph/render-harness.js');

let oldDir = process.env.OLD_TREE || null;
if (!oldDir) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g6b-old-'));
        cp.execSync(`git archive ${BASE} | tar -x -C "${oldDir}"`, { cwd: ROOT, stdio: 'ignore' });
    } catch (e) { oldDir = null; }
}
const oldRead = f => fs.readFileSync(path.join(oldDir, f), 'utf8');
if (!oldDir) console.log('NOTE  the old tree (' + BASE + ') is not available: the comparisons with it are skipped');
const TITLE = /  <title>[^\n]*<\/title>\n/;

// ---- 1. SVG ---------------------------------------------------------------------------------------------------------------------------------------------
if (oldDir) {
    fs.copyFileSync(path.join(ROOT, 'tools/grid/measure-g6b.js'), path.join(oldDir, 'tools/grid/measure-g6b.js'));
    const run = cwd => JSON.parse(cp.execFileSync('node', ['tools/grid/measure-g6b.js'], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 }));
    const o = run(oldDir), n = run(ROOT), keys = Object.keys(n);
    check('(0) the SVG measurement ran: nothing threw, same keys in both trees', keys.length === 69 && keys.every(k => typeof n[k] === 'object') && J(Object.keys(o)) === J(keys));
    check('(1) the SVG geometry text (the SVG without its <title> line) equals the old tree for all ' + keys.length + ' cases: lines, faces, free ends, morph frames, every shape', keys.every(k => n[k].plain === o[k].plain), keys.filter(k => n[k].plain !== o[k].plain).slice(0, 3).join(' | '));
    check('(1) without a systematic name the SVG is byte-identical to the old one (no title); the old tree has no title at all', keys.every(k => o[k].title === null) && keys.filter(k => !n[k].title).every(k => n[k].raw === o[k].raw) && keys.filter(k => !n[k].title).length > 20);
    const named = keys.filter(k => n[k].title), reduced = keys.filter(k => /\/(rotation3|none)\//.test(k)), free = keys.filter(k => k.startsWith('free/'));
    check('(1) a title carries the grid name for main-group patterns (' + named.length + ' cases); none for reduced modes and free ends', named.length >= 20 && named.every(k => /^<title>\d+[dq*]1\/(3|4|6)\* \S+<\/title>$/.test(n[k].title)) && reduced.every(k => !n[k].title) && free.every(k => !n[k].title));
}
{
    const w = H.makeRenderWorld('hex', 3, 3, 'rotation_reflection6');
    w.baseConnections(w.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())').slice(0, 3));
    const sb = w.sb; sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.lineColor = '#000000';
    ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect'].forEach(nm => { sb[nm] = () => { }; });
    sb.CLOSE = 'close';
    const real = w.get('generateSVGString()'), name = w.get('svgPatternNameNow()');
    check('(1) the title is the grid name of the export (same state)', !!name && real.includes('<title>' + name + '</title>\n') && w.get('buildExportData().name') === name, name);
    w.run("svgPatternNameNow = function () { return '<a&b\\u0304\"\\'>'; };");
    const svg = w.get('generateSVGString()'), m = TITLE.exec(svg);
    check('(1) the name is escaped in the metadata: < > & " \' and the combining overline come out safe, nothing raw leaks', !!m && m[0] === "  <title>&lt;a&amp;b̄&quot;&apos;&gt;</title>\n" && !/<a&b/.test(svg) && (svg.match(/<title>/g) || []).length === 1, m && m[0]);
    check('(1) escaping is a plain function of the text (no double escaping of an already escaped &amp;)', w.get("_xmlEscape('&amp;')") === '&amp;amp;' && w.get("_xmlEscape('plain')") === 'plain');
}

// ---- 2. export v2 ----------------------------------------------------------------------------------------------------------------------------------------
const sortedSegs = w => J(w.frame().map(s => [s.x1, s.y1, s.x2, s.y2].map(v => Math.round(v * 100) / 100)).map(a => J(a)).sort());
const specOf = (shape, c) => ({ shape, ordnung: shape === 'hex' ? c : c - 1, lage: 1 });
{
    let bad = [], n = 0, rtBad = [], legacyKeys = 0;
    for (const shape of ['triangle', 'square', 'hex']) for (const c of [3, 4]) {
        const w = H.makeRenderWorld(shape, c, 3, 'rotation_reflection6');
        const reps = w.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
        const conns = reps.filter((_, i) => i % 3 === 0).slice(0, 6);
        w.baseConnections(conns);
        const ex = JSON.parse(J(w.get('buildExportData()'))), text = J(ex), spec = specOf(shape, c);
        n++;
        const ok = ex.formatVersion === 2 && J(ex.meta.grid) === J(spec) && !('nodeCount' in ex.meta) && ex.geometry.edges.length === conns.length && ex.geometry.lineKeys.length === conns.length
            && ex.geometry.lineKeys.every(t => typeof t === 'string') && typeof ex.name === 'string' && ex.name.startsWith(spec.ordnung + { triangle: 'd', square: 'q', hex: '*' }[shape] + '1/')
            && ex.geometry.nodes.every(nd => Number.isInteger(nd.zahl) && typeof nd.u === 'number' && typeof nd.v === 'number');
        if (!ok) bad.push(shape + c);
        if (/"nodeCount"|"orbitIds"|"themeLineOrbits"|"patternName"/.test(text)) legacyKeys++;
        // line -> key -> connection: the same pattern is drawn from the representatives of the keys
        const pairs = ex.geometry.lineKeys.map(t => w.get(`pairForLineKey(getLineKeyTable(${J(spec)}, GRID_V2), parseLineKey(${J(t)}), GRID_V2)`));
        const w2 = H.makeRenderWorld(shape, c, 3, 'rotation_reflection6');
        w2.baseConnections(pairs);
        // key level, always: the representative of a key has that key. Drawing level where the app's own drawing is orbit-invariant: NOT square ordnung 3 (c = 4), where 4 of the 8
        // members of an orbit draw differently in the app already (measured; the legacy orbit table has the same partition) - reported in reports/063.md
        const keyBack = pairs.map(p => (p ? w.get(`formatLineKey(lineKeyForPair(getLineKeyTable(${J(spec)}, GRID_V2), ${p[0]}, ${p[1]}, GRID_V2))`) : null));
        if (pairs.some(p => !p) || J(keyBack) !== J(ex.geometry.lineKeys)) rtBad.push(shape + c + ':key');
        else if (!(shape === 'square' && c === 4) && sortedSegs(w) !== sortedSegs(w2)) rtBad.push(shape + c + ':draw');
    }
    check('(2) export v2 (' + n + ' base patterns): formatVersion 2, meta.grid, nodes with zahl/u/v, lineKeys per edge, name; geometry x/y of the nodes as before', bad.length === 0, bad.join(' '));
    check('(2) no nodeCount, orbitIds, patternName or themeLineOrbits anywhere in a v2 export', legacyKeys === 0, legacyKeys);
    check('(2) round trip line -> key -> representative connection: the representative has the key (all ' + n + ' patterns) and draws exactly the same pattern (all but square c = 4, see the comment)', rtBad.length === 0, rtBad.join(' '));
}
{
    // layers: the same contract, with their own grid; a free line and a reduced mode give null
    const w = H.makeRenderWorld('hex', 3, 3, 'rotation_reflection6');
    w.baseConnections(w.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())').slice(0, 2));
    S.addLayer(w.ctx, { shape: 'square', order: 3, size: 3, connections: [[1, 2], [2, 6]], mode: 'rotation_reflection6', showFaces: false });
    S.addLayer(w.ctx, { shape: 'triangle', order: 1, size: 3, connections: [[1, 2]], mode: 'rotation_reflection6', showFaces: false });
    S.addLayer(w.ctx, { shape: 'hex', order: 2, size: 3, connections: [[1, 2]], mode: 'rotation3', showFaces: false });
    const ex = JSON.parse(J(w.get('buildExportData()'))), L = ex.geometry.layers;
    check('(2) layers carry grid (their own spec, legacyC1 for c = 1), nodes with zahl/u/v, lineKeys and name; no nodeCount', L.length === 3 && J(L[0].grid) === J({ shape: 'square', ordnung: 2, lage: 1 }) && J(L[1].grid) === J({ shape: 'triangle', ordnung: 1, lage: 1, legacyC1: true }) && L.every(l => !('nodeCount' in l) && !('patternName' in l) && !('themeLineOrbits' in l) && Array.isArray(l.lineKeys) && l.lineKeys.length === l.edges.length && l.nodes.every(nd => Number.isInteger(nd.zahl))), J(L.map(l => l.grid)));
    check('(2) layer lines are keyed in the layer\'s own grid (a square layer on a hex base: square tokens, name 2q1/4*)', L[0].lineKeys.every(t => /^\d{2}[a-n]~?$/.test(t)) && /^2q1\/4\* /.test(L[0].name), J([L[0].lineKeys, L[0].name]));
    check('(2) a layer in a reduced mode (rotation3) has null keys and a null name', L[2].lineKeys.every(t => t === null) && L[2].name === null);
    const w2 = H.makeRenderWorld('square', 3, 3, 'rotation_reflection6');
    w2.baseConnections([[1, 2], [3, 6]]);
    w2.run('nodes.push({ id: nodes.length + 1, x: 41.25, y: 99.5, free: true }); connections.push([1, nodes.length]);');
    const e2 = JSON.parse(J(w2.get('buildExportData()')));
    check('(2) a free line has no key and the whole pattern no name (null), the other lines keep theirs', e2.geometry.lineKeys.length === 3 && e2.geometry.lineKeys[2] === null && e2.geometry.lineKeys[0] !== null && e2.name === null && !e2.geometry.nodes.find(nd => nd.id === 10 && nd.zahl !== undefined));
    const w3 = H.makeRenderWorld('square', 3, 3, 'rotation3');
    w3.baseConnections([[1, 2]]);
    const e3 = JSON.parse(J(w3.get('buildExportData()')));
    check('(2) a reduced symmetry mode (rotation3) gives null keys and a null name', e3.geometry.lineKeys[0] === null && e3.name === null);
    const w4 = H.makeRenderWorld('square', 3, 3, 'rotation_reflection6');
    const e4 = JSON.parse(J(w4.get('buildExportData()')));
    check('(2) no lines: empty lineKeys and a null name', e4.geometry.lineKeys.length === 0 && e4.name === null);
}

// ---- 3. + 4. URL / paste v2 -------------------------------------------------------------------------------------------------------------------------------
const sketch = read('sketch.js');
const fnSrc = (src, name) => { const m = src.match(new RegExp('\\nfunction ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n')); return m ? m[0] : ''; };
const constSrc = (src, name) => { const m = src.match(new RegExp('\\nconst ' + name + ' = [^\\n]*\\n')); return m ? m[0] : ''; };
const parserSrc = (src, names) => constSrc(src, 'CATALOG_URL_SHAPES') + constSrc(src, 'CATALOG_URL_MODES') + names.map(n => fnSrc(src, n)).join('') + '\nlet catalogTransportRejection = null;\n';
const NEW_NAMES = ['isWellFormedCatalogPattern', 'legacyCatalogReader', 'parseCatalogUrlV2', 'parseCatalogUrlParams', 'parseClipboardCatalogPattern', 'resolveCatalogPatternConnections'];
const T = S.world('hex', 3, 3, 'rotation_reflection6');
T.sb.URLSearchParams = URLSearchParams; T.sb.console = { warn() { }, log() { }, error() { } };
T.run(parserSrc(sketch, NEW_NAMES));
const parseUrl = q => { T.run('catalogTransportRejection = null;'); const p = T.get(`parseCatalogUrlParams(${J(q)})`); return { p: p ? JSON.parse(J(p)) : null, rej: T.get('catalogTransportRejection') }; };
const parsePaste = t => { T.run('catalogTransportRejection = null;'); const p = T.get(`parseClipboardCatalogPattern(${J(t)})`); return { p: p ? JSON.parse(J(p)) : null, rej: T.get('catalogTransportRejection') }; };
const tableOf = spec => T.get(`getLineKeyTable(${J(spec)}, GRID_V2)`);
const urlOf = (spec, keys, opts) => T.get(`formatTransportUrlV2(${J(spec)}, ${J(keys)}, ${J(opts || {})})`);
const pasteOf = (spec, keys) => T.get(`formatTransportPasteV2(${J(spec)}, ${J(keys)})`);
const STATE = () => T.get('JSON.stringify({ connections, nodes, gridSpec, gridRevision, additionalLayers, currentShape, nodeCount })');
{
    let nOk = 0, bad = [], layerOk = true;
    const before = STATE();
    for (const shape of ['triangle', 'square', 'hex']) for (const ordnung of [1, 2, 3]) {
        const spec = { shape, ordnung, lage: 1 }, tb = tableOf(spec), entries = tb.entries;
        const pick = [entries[0], entries[Math.floor(entries.length / 2)], entries[entries.length - 1], entries[0]];   // a duplicate on purpose
        const keys = pick.map(e => e.key);
        const u = parseUrl(urlOf(spec, keys, {})), u2 = parseUrl(urlOf(spec, keys, { layer: 'new' })), pp = parsePaste(pasteOf(spec, keys));
        const exp = JSON.parse(J(keys.slice().sort((a, b) => T.get(`compareLineKeys(${J(a)}, ${J(b)})`))));
        const c = shape === 'hex' ? ordnung : ordnung + 1;
        if (!(u.p && u.p.v2 && J(u.p.spec) === J(spec) && J(u.p.keys) === J(exp) && u.p.order === c && u.p.symmetryMode === 'rotation_reflection6' && u.p.layer === null && u2.p && u2.p.layer === 'new' && pp.p && J(pp.p.keys) === J(exp) && pp.p.layer === undefined)) { bad.push(shape + ordnung + ':parse'); continue; }
        // equal to the source: the resolved connections draw the same pattern as the source connections
        const resolved = JSON.parse(J(T.get(`resolveCatalogPatternConnections(parseCatalogUrlParams(${J(urlOf(spec, keys, {}))}))`)));
        const wl = H.makeRenderWorld(shape, c, 3, 'rotation_reflection6'), ws = H.makeRenderWorld(shape, c, 3, 'rotation_reflection6');
        wl.baseConnections(resolved); ws.baseConnections(pick.map(e => e.pairs[0]));
        const back = resolved.map(p => T.get(`formatLineKey(lineKeyForPair(getLineKeyTable(${J(spec)}, GRID_V2), ${p[0]}, ${p[1]}, GRID_V2))`)), want = u.p.tokens;
        const fa = sortedSegs(wl), fb = sortedSegs(ws);
        if (J(back) !== J(want)) { bad.push(shape + ordnung + ':keys'); continue; }
        if (!(shape === 'square' && ordnung === 3) && (fa !== fb || fa.length < 10)) { bad.push(shape + ordnung + ':draw'); continue; }
        nOk++;
    }
    check('(3) valid v2 URLs and pastes of all 3 shapes x ordnung 1..3 parse (layer=new kept on the URL, none on paste) and the resolved connections have the keys they came from and draw the same pattern as their source (' + nOk + '/9; the drawing comparison skips square ordnung 3, see (2))', nOk === 9 && bad.length === 0, bad.join(' '));
    check('(3) parsing mutates nothing (connections, nodes, gridSpec, gridRevision, layers, shape)', STATE() === before);
}
{
    const spec = { shape: 'square', ordnung: 3, lage: 1 }, tb = tableOf(spec), good = tb.entries[2].token, good2 = tb.entries[5].token;
    const q = o => '?' + new URLSearchParams(Object.assign({ v: '2', shape: 'square', ordnung: '3', lage: '1', group: '4*', lines: good + ',' + good2 }, o)).toString();
    const before = STATE();
    const cases = [
        ['v=1 (an older version)', q({ v: '1' }), 'version'], ['v=3 (a newer version)', q({ v: '3' }), 'version'], ['v= empty', q({ v: '' }), 'version'], ['v=2x', q({ v: '2x' }), 'version'],
        ['an unknown token', q({ lines: good + ',99z' }), 'invalid'], ['one bad token among valid ones (nothing half-loaded)', q({ lines: good + ',' + good2 + ',zz9' }), 'invalid'],
        ['a token that does not exist in THIS grid (hex family in a square)', q({ lines: good + ',65a~' }), 'invalid'], ['an empty token', q({ lines: good + ',,' + good2 }), 'invalid'],
        ['no lines', q({ lines: '' }), 'invalid'], ['too many lines (501)', q({ lines: new Array(501).fill(good).join(',') }), 'invalid'], ['an over-long token', q({ lines: good + ',1234567890123a' }), 'invalid'],
        ['ordnung 0', q({ ordnung: '0' }), 'invalid'], ['ordnung above the ceiling (13)', q({ ordnung: '13' }), 'invalid'], ['ordnung 1.5', q({ ordnung: '1.5' }), 'invalid'], ['ordnung 03 (not canonical)', q({ ordnung: '03' }), 'invalid'],
        ['lage 2 (locked)', q({ lage: '2' }), 'invalid'], ['no lage', q({ lage: '' }), 'invalid'], ['a foreign shape', q({ shape: 'pentagon' }), 'invalid'], ['group of another shape (6*)', q({ group: '6*' }), 'invalid'], ['group missing', q({ group: '' }), 'invalid'],
        ['an old orbitIds field in a v2 link', q({ orbitIds: '0,1' }), 'invalid'], ['an old order field in a v2 link', q({ order: '3' }), 'invalid'], ['an old symmetryMode field in a v2 link', q({ symmetryMode: 'rotation6' }), 'invalid'],
    ];
    const bad = [];
    for (const [name, url, code] of cases) { const r = parseUrl(url); if (r.p !== null || !r.rej || r.rej.code !== code) bad.push(name + ' -> ' + J(r.rej)); }
    check('(3) ' + cases.length + ' refused v2 URLs (wrong version, bad tokens, bad grid, lage 2, wrong group, old fields in a v2 link): null with the right code (version / invalid)', bad.length === 0, bad.slice(0, 3).join(' | '));
    check('(3) valid control: the same link with good tokens parses (the refusals above are not an artefact of the URL)', parseUrl(q({})).p !== null && parseUrl(q({})).rej === null);
    const pv = [
        ['paste version 1', J({ version: 1, grid: { shape: 'square', ordnung: 3, lage: 1 }, group: '4*', lines: [good] }), 'version'], ['paste version "2"', J({ version: '2', grid: { shape: 'square', ordnung: 3, lage: 1 }, group: '4*', lines: [good] }), 'version'],
        ['paste version null', J({ version: null, orbitIds: [0], shape: 'square', order: 3, symmetryMode: 'rotation6' }), 'version'],
        ['paste v2 with an orbitIds field', J({ version: 2, grid: { shape: 'square', ordnung: 3, lage: 1 }, group: '4*', lines: [good], orbitIds: [0] }), 'invalid'],
        ['paste v2 with an unknown token', J({ version: 2, grid: { shape: 'square', ordnung: 3, lage: 1 }, group: '4*', lines: [good, '99z'] }), 'invalid'], ['paste v2 lage 2', J({ version: 2, grid: { shape: 'square', ordnung: 3, lage: 2 }, group: '4*', lines: [good] }), 'invalid'],
        ['paste v2 grid with an extra field', J({ version: 2, grid: { shape: 'square', ordnung: 3, lage: 1, nodeCount: 4 }, group: '4*', lines: [good] }), 'invalid'], ['paste v2 without a grid', J({ version: 2, group: '4*', lines: [good] }), 'invalid'],
        ['paste v2 lines not an array', J({ version: 2, grid: { shape: 'square', ordnung: 3, lage: 1 }, group: '4*', lines: good }), 'invalid'], ['paste v2 ordnung as a string', J({ version: 2, grid: { shape: 'square', ordnung: '3', lage: 1 }, group: '4*', lines: [good] }), 'invalid'],
    ];
    const badP = [];
    for (const [name, text, code] of pv) { const r = parsePaste(text); if (r.p !== null || !r.rej || r.rej.code !== code) badP.push(name + ' -> ' + J(r.rej)); }
    check('(3) ' + pv.length + ' refused v2 pastes (wrong version incl. a version-less shape with version null, old fields, bad tokens, lage 2, bad grid): null with the right code', badP.length === 0, badP.slice(0, 3).join(' | '));
    check('(3) none of the refusals touched anything (still no mutation after ' + (cases.length + pv.length) + ' refused inputs)', STATE() === before);
    check('(3) not JSON / not an object stay quiet nulls (no rejection code)', ['not json', '[1,2]', '3', 'null', ''].every(t => { const r = parsePaste(t); return r.p === null && r.rej === null; }));
}
{
    // (4) unsorted tokens -> sorted numerically; capital partner normalized; duplicates kept
    const spec = { shape: 'hex', ordnung: 5, lage: 1 }, tb = tableOf(spec), tokens = tb.entries.map(e => e.token);
    const shuffled = tokens.slice().reverse();
    const url = '?' + new URLSearchParams({ v: '2', shape: 'hex', ordnung: '5', lage: '1', group: '6*', lines: shuffled.join(',') }).toString();
    const r = parseUrl(url), rp = parsePaste(J({ version: 2, grid: spec, group: '6*', lines: shuffled }));
    check('(4) tokens given in reverse order are accepted and come back in the table order (numeric compareLineKeys), both transports', r.p && J(r.p.tokens) === J(tokens) && rp.p && J(rp.p.tokens) === J(tokens), r.rej && J(r.rej));
    const stringOrder = tokens.slice().sort();
    check('(4) the order is NUMERIC, not the string order of the tokens (this grid has families with two-digit numbers, where they differ)', J(stringOrder) !== J(tokens) && r.p && J(r.p.tokens) !== J(stringOrder));
    const sg = tb.entries.find(e => e.spiegelgleich), cap = sg.token.replace(/([a-n])(~?)$/, (m, l, t) => l.toUpperCase() + t);
    const rc = parseUrl('?' + new URLSearchParams({ v: '2', shape: 'hex', ordnung: '5', lage: '1', group: '6*', lines: cap + ',' + sg.token }).toString());
    check('(4) a capital Spiegeling partner (' + cap + ') is normalized to the lower-case key; the duplicate stays (2 lines)', rc.p && rc.p.tokens.length === 2 && rc.p.tokens[0] === sg.token && rc.p.tokens[1] === sg.token, J(rc.rej));
    const nonSg = tb.entries.find(e => !e.spiegelgleich), capBad = nonSg.token.replace(/([a-n])(~?)$/, (m, l, t) => l.toUpperCase() + t);
    check('(4) a capital letter on a line that is not spiegelgleich is refused', parseUrl('?' + new URLSearchParams({ v: '2', shape: 'hex', ordnung: '5', lage: '1', group: '6*', lines: capBad }).toString()).p === null);
}

// ---- 5. messages, the legacy reader ----------------------------------------------------------------------------------------------------------------------------
{
    const i18n = read('ui-i18n.js');
    const ver = i18n.match(/'note\.catalog\.version': \{ de: '([^']+)', en: '([^']+)' \}/), inv = i18n.match(/'note\.catalog\.invalid': \{ de: '([^']+)', en: '([^']+)' \}/);
    check('(5) the two refusal notes exist in German and English (non-empty, different, different from each other)', !!ver && !!inv && ver[1].length > 30 && ver[2].length > 30 && ver[1] !== ver[2] && inv[1] !== inv[2] && ver[1] !== inv[1]);
    check('(5) sketch.js says them for a refused link (setup) and a refused paste, through UI.t with static keys', /UI\.t\('note\.catalog\.version'\)/.test(sketch) && /UI\.t\('note\.catalog\.invalid'\)/.test(sketch) && /if \(catalogTransportRejection\) \{[^\n]*say\('catalog', catalogRejectionText\(catalogTransportRejection\), 'warn'\)/.test(sketch) && /say\('paste', catalogTransportRejection \? catalogRejectionText\(catalogTransportRejection\)/.test(sketch));
    // the old format: still loads through the legacy reader, identical to the old tree
    const urls = ['?shape=square&order=3&symmetryMode=rotation_reflection6&orbitIds=0,1', '?shape=hex&order=2&symmetryMode=rotation_reflection3&orbitIds=32,33&layer=new', '?shape=triangle&order=9&symmetryMode=rotation_reflection6&orbitIds=0', '?shape=square&order=3&symmetryMode=rotation_reflection6&orbitIds=0,x', '?shape=pentagon&order=3&symmetryMode=none&orbitIds=1', '?shape=hex', '', '?shape=hex&order=2&symmetryMode=none&orbitIds=1&layer=zzz'];
    const pastes = [J({ shape: 'square', order: 3, symmetryMode: 'rotation_reflection6', orbitIds: [0, 1] }), J({ shape: 'hex', order: 2, symmetryMode: 'none', orbitIds: [] }), J({ shape: 'hex', order: 2, symmetryMode: 'none', orbitIds: [1, -1] }), '{}', 'nope', J({ shape: 'hex', order: 2, symmetryMode: 'none', orbitIds: [1], version: undefined })];
    let diffLegacy = [];
    if (oldDir) {
        const O = S.world('hex', 3, 3, 'rotation_reflection6');
        O.sb.URLSearchParams = URLSearchParams; O.sb.console = { warn() { }, log() { }, error() { } };
        O.run(parserSrc(oldRead('sketch.js'), ['isWellFormedCatalogPattern', 'parseCatalogUrlParams', 'parseClipboardCatalogPattern']));
        for (const u of urls) { const a = O.get(`parseCatalogUrlParams(${J(u)})`), b = parseUrl(u).p; if (J(a) !== J(b)) diffLegacy.push(u); }
        for (const t of pastes) { const a = O.get(`parseClipboardCatalogPattern(${J(t)})`), b = parsePaste(t).p; if (J(a) !== J(b)) diffLegacy.push(t.slice(0, 40)); }
        check('(5) old-format links and pastes (' + (urls.length + pastes.length) + ' inputs, valid and malformed) parse exactly as in the old tree - the Formorgel links keep loading through the legacy reader', diffLegacy.length === 0 && parseUrl(urls[0]).p && parseUrl(urls[0]).p.orbitIds.length === 2 && parseUrl(urls[1]).p.layer === 'new', diffLegacy.slice(0, 2).join(' | '));
    }
    check('(5) a malformed OLD-format input is a quiet null (no rejection code: it is not a v2 input)', [urls[2], urls[3], urls[4], urls[5], urls[6]].every(u => { const r = parseUrl(u); return r.p === null && r.rej === null; }) === false ? false : parseUrl(urls[3]).p === null && parseUrl(urls[3]).rej === null);
    // the legacy reader never rescues a v2 input
    const legacyOld = '?shape=square&order=3&symmetryMode=rotation_reflection6&orbitIds=0,1';
    const rescue = [parseUrl('?v=2&shape=square&order=3&symmetryMode=rotation_reflection6&orbitIds=0,1'), parseUrl('?v=1&shape=square&order=3&symmetryMode=rotation_reflection6&orbitIds=0,1'), parseUrl('?v=2&' + legacyOld.slice(1)),
        parsePaste(J({ version: 2, shape: 'square', order: 3, symmetryMode: 'rotation_reflection6', orbitIds: [0, 1] })), parsePaste(J({ version: 1, shape: 'square', order: 3, symmetryMode: 'rotation_reflection6', orbitIds: [0, 1] })), parsePaste(J({ version: 3, shape: 'square', order: 3, symmetryMode: 'rotation_reflection6', orbitIds: [0, 1] }))];
    check('(5) the legacy reader refuses everything that carries a v2 marker (v=, version): old fields in a v2 / v1 / v3 input are rejected, never loaded as the old format', rescue.every(r => r.p === null && r.rej), rescue.map(r => J(r.rej)).join(' | '));
    check('(5) the v2 writers write no old format (no orbitIds in a v2 URL or paste)', !/orbitIds/.test(urlOf({ shape: 'hex', ordnung: 2, lage: 1 }, [tableOf({ shape: 'hex', ordnung: 2, lage: 1 }).entries[0].key], {})) && !/orbitIds/.test(pasteOf({ shape: 'hex', ordnung: 2, lage: 1 }, [tableOf({ shape: 'hex', ordnung: 2, lage: 1 }).entries[0].key])));
    // the pin: legacyCatalogReader exists and is called only at the parser entries.  G7 removes it and REVERSES this pin (the reader and both calls gone).
    const code = sketch.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const calls = [...code.matchAll(/legacyCatalogReader\(/g)].length, inUrl = /function parseCatalogUrlParams\([\s\S]*?\n\}\n/.exec(code), inPaste = /function parseClipboardCatalogPattern\([\s\S]*?\n\}\n/.exec(code);
    check('(5) PIN (task 063, decision B; G7 removes legacyCatalogReader and reverses this pin): the reader is defined once and called only in parseCatalogUrlParams and parseClipboardCatalogPattern', /\nfunction legacyCatalogReader\(source\) \{/.test(code) && calls === 3 && /legacyCatalogReader\(\{ params \}\)/.test(inUrl[0]) && /legacyCatalogReader\(\{ obj \}\)/.test(inPaste[0]), 'calls+definition = ' + calls);
    const lr = fnSrc(sketch, 'legacyCatalogReader');
    check('(5) the legacy reader guards on the v2 markers and holds no v2 or writing code', /if \(params\.has\('v'\)\) return null;/.test(lr) && /obj\.version !== undefined\) return null;/.test(lr) && !/parseTransportV2|formatTransport|writeText|URLSearchParams\(\{/.test(lr));
    // task 064 (G7a) reversed the 063 pin 'gallery.js untouched': the Formorgel now WRITES v2 (core/catalog.js), so the legacy reader is only for links made before; G7b removes it
    const gal = read('gallery.js');
    check('(5) G7a: the Formorgel writes v2 (catalogLinkV2 / catalogPasteV2) and no orbitIds; the legacy reader stays for older links until G7b', /catalogLinkV2\(entry, extra\)/.test(gal) && /catalogPasteV2\(entry\)/.test(gal) && !/orbitIds:\s|orbitIds\.join/.test(gal.replace(/\/\/[^\n]*/g, '')));
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
