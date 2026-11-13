// Task 071: #pattern-name-status shows the v2 name for main-group patterns (the same name the export carries), with a tooltip; every other case keeps the old name.
//   node tools/grid/test-name-display.js     BASE = the commit before 071 (default 1b8362e9); OLD_TREE = that tree already extracted
//   1. nothing but the display changes: measure scripts equal the old tree; core/orbits.js only gained gridCodeFor and gridDisplayNameFor
//   2. gridDisplayNameFor: every shape, ordnung 1..12 (lage 2 to 12 / 12 / 9): ascii = the export name, display normalises to it, overline and aA exist, round trip through parseGridName
//   3. the real updatePatternNameStatus on fakes: main group -> v2 + tooltip; reduced symmetry, free endpoint, no line -> the old behaviour and no tooltip
//   4. cache: the name follows a line, the ordnung, the lage, the shape, the symmetry mode, the language; the info line and the name field share the grid code
//   5. tooltip texts de/en; the time per call
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || '1b8362e9';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const B = require(path.join(ROOT, 'tools', 'gitter', 'oracle-bridge.js'));
const SK = read('sketch.js');
const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const dict = (() => { const src = read('ui-i18n.js'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2], en: k[3] }; return m; })();
const tIn = ui => (key, vars) => { const e = dict[key]; if (!e) return key; return e[ui.lang].replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] !== undefined ? vars[k] : '{' + k + '}'); };

// ---- 1. old tree -------------------------------------------------------------------------------------------------------------------------------
let oldDir = process.env.OLD_TREE || null;
if (!oldDir) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'namedisplay-old-'));
        cp.execSync(`git archive ${BASE} | tar -x -C "${oldDir}"`, { cwd: ROOT, stdio: 'ignore' });
    } catch (e) { oldDir = null; }
}
if (!oldDir) console.log('NOTE  the old tree is not available: the comparison with it is skipped');
else {
    const run = (cwd, script) => cp.execFileSync('node', [script], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
    for (const script of ['tools/grid/measure-g5a.js', 'tools/grid/measure-g5b.js', 'tools/session/measure-g6a.js', 'tools/grid/measure-g6b.js', 'tools/grid/measure-lage2-app.js']) {
        let a, b, err = '';
        try { a = JSON.parse(run(oldDir, script)); b = JSON.parse(run(ROOT, script)); } catch (e) { err = String(e.message).slice(0, 200); }
        const keys = a ? Object.keys(b) : [], bad = a ? keys.filter(k => J(a[k]) !== J(b[k])) : [];
        check('(1) ' + script + ' equals the old tree (' + keys.length + ' keys): export, session, SVG, grids, lines, morph frames unchanged', a && keys.length > 5 && bad.length === 0, err || bad.slice(0, 3).join(' | '));
    }
    const same = f => read(f) === fs.readFileSync(path.join(oldDir, f), 'utf8');
    check('(1) core/*.js except orbits.js, tools/morph/off-path-golden.json and ui-phone-config.js are unchanged (export, session, catalog, faces, tiling, facecolor, forms, state)', fs.readdirSync(path.join(ROOT, 'core')).filter(f => /\.js$/.test(f) && f !== 'orbits.js' && f !== 'symmetry.js' && f !== 'glossary.js' && f !== 'forms.js' && f !== 'state.js' && f !== 'session.js' && f !== 'export.js' && f !== 'glossary.js').every(f => same('core/' + f)) && same('tools/morph/off-path-golden.json') && same('ui-phone-config.js'));
    const strip = s => s.replace(/\/\/ The grid code of the v2 name[\s\S]*?\n\}\n/, '').replace(/\/\/ Task 071: the name as the page DISPLAYS it[\s\S]*?\n\}\n/, '').replace(/\/\/ Task 072c: the name of a pattern in the mode[\s\S]*?\n\}\n/, '').replace(/\/\/ Task 072c2: the number n of sectors[\s\S]*?\n\}\n/, '').replace(', _pts: new Map(list.map((nd, i) => [nd.id, pts[i]]))', '');
    check('(1) core/orbits.js only gained gridCodeFor and gridDisplayNameFor (every other line equal to the old file); the old name functions are all still there (pairToOrbitId is a local of computeThemeLineOrbits)', strip(read('core/orbits.js')).replace(/beyondCeiling/g, 'allowLage2').replace(/        if \(lage !== 1 && lage !== 2\) return bad\('lage must be 1 or 2'\);[^\n]*\n        const spec = \{ shape, ordnung, lage \};/, "        if (lage !== 1) return bad(lage === 2 ? 'lage 2 is not available yet' : 'lage must be 1');\n        const spec = { shape, ordnung, lage: 1 };") === fs.readFileSync(path.join(oldDir, 'core/orbits.js'), 'utf8') && ['computeThemeLineName', 'formatThemeLineName', 'computeThemeLineOrbitTable', 'computeThemeLineOrbits'].every(n => new RegExp('function ' + n + '\\(').test(read('core/orbits.js'))));
}
const P5 = ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect', 'translate', 'rotate', 'scale', 'textSize', 'text', 'textAlign', 'background', 'clear'];
function world(shape, spec, mode, ui) {
    const w = H.makeRenderWorld(shape, 3, 3, mode || 'rotation_reflection6');
    const sb = w.sb;
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.CLOSE = 'close'; sb.window = { UI: ui };
    if (ui) sb.UI = ui;
    P5.forEach(f => { sb[f] = () => { }; });
    if (spec) w.set(`currentShape = ${J(spec.shape)}; setGrid(${J(spec)}); symmetryMode = ${J(mode || 'rotation_reflection6')};`);
    return w;
}
const SHAPES = ['triangle', 'square', 'hex'], LM = { triangle: 12, square: 12, hex: 9 };
const normalize = d => d.replace(/\u0304/g, '~').replace(/([A-Z])/g, c => '').replace(/\u0304/g, '');   // overline -> ~, the capital of aA dropped (the lower-case letter before it stays)

// ---- 2. gridDisplayNameFor ----------------------------------------------------------------------------------------------------------------------
{
    const core = B.loadCore();
    let n = 0, bad = [], bars = 0, caps = 0, rt = [];
    for (const lage of [1, 2]) for (const shape of SHAPES) for (let o = 1; o <= (lage === 1 ? 12 : LM[shape]); o++) {
        if (shape === 'hex' && o > 8 && lage === 1 && o % 2) continue;   // keep the run short: hex 9, 11 skipped at lage 1
        const w = world(shape, { shape, ordnung: o, lage });
        const reps = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
        if (!reps.length) continue;
        const pick = [0, Math.floor(reps.length / 3), Math.floor(reps.length / 2), reps.length - 1].map(i => reps[i]);
        w.set(`connections = ${J(pick)};`);
        const r = w.get('gridDisplayNameFor(baseGridSpecNow(), connections, symmetryMode)');
        const exp = w.get('buildExportData().name');
        n++;
        if (!r || r.ascii !== exp || r.display.replace(/\u0304/g, '~').replace(/(?<=[a-n])[A-N]/g, '') !== r.ascii || r.grid !== o + { triangle: 'd', square: 'q', hex: '*' }[shape] + lage || r.group !== { triangle: '3*', square: '4*', hex: '6*' }[shape]) bad.push(`L${lage} ${shape}${o}: ${r && r.display} / ${exp}`);
        else { bars += /\u0304/.test(r.display) ? 1 : 0; caps += /[a-n][A-N]/.test(r.display) ? 1 : 0; const back = core.get('parseGridName')(r.ascii, core.V2); if (!back || back.grid.ordnung !== o || back.grid.lage !== lage || back.keys.length !== pick.length) rt.push(`${shape}${o}L${lage}`); }
    }
    check(`(2) ${n} grids (3 shapes, ordnung 1..12, lage 1 and 2 to 12/12/9, 4 lines each): the display name = the export name (core/export.js buildExportData().name, ascii) once overline and capital are normalised; the grid code and group are right`, bad.length === 0 && n > 40, bad.slice(0, 3).join(' | '));
    check(`(2) the display form is used: ${bars} names carry an overline, ${caps} a capital letter (aA); every ascii name round-trips through parseGridName`, bars > 0 && caps > 0 && rt.length === 0, rt.join(','));
    const w = world('square', { shape: 'square', ordnung: 4, lage: 1 });
    check('(2) gridCodeFor: "4q1", "3*2", "12d1"; null for lage 3 / ordnung 0 / unknown shape', w.get("gridCodeFor({ shape: 'square', ordnung: 4, lage: 1 }) === '4q1' && gridCodeFor({ shape: 'hex', ordnung: 3, lage: 2 }) === '3*2' && gridCodeFor({ shape: 'triangle', ordnung: 12, lage: 1 }) === '12d1' && gridCodeFor({ shape: 'hex', ordnung: 3, lage: 3 }) === null && gridCodeFor({ shape: 'hex', ordnung: 0, lage: 1 }) === null && gridCodeFor({ shape: 'x', ordnung: 1, lage: 1 }) === null"));
    const reps = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
    w.set(`connections = ${J(reps.slice(2, 4))};`);
    check('(2) gridDisplayNameFor refuses (null): reduced symmetry modes, a free endpoint, no line, a pair that is no lattice pair', ['rotation3', 'reflection_only', 'none'].every(m => w.get(`gridDisplayNameFor(baseGridSpecNow(), connections, ${J(m)}) === null`)) && w.get("gridDisplayNameFor(baseGridSpecNow(), [], 'rotation_reflection6') === null && gridDisplayNameFor(baseGridSpecNow(), [[1, 999]], 'rotation_reflection6') === null"));
}

// ---- 3 / 4. the real status function on fakes -----------------------------------------------------------------------------------------------------
{
    const ui = { lang: 'de' }; ui.t = tIn(ui);
    const els = {};
    const mkEl = id => { const e = { id, textContent: '', attrs: {}, htmlText: null, elt: null, html(t) { this.htmlText = t; return this; }, getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, hasAttribute(k) { return this.attrs[k] !== undefined; }, closest() { return els['stepper']; } }; e.elt = e; els[id] = e; return e; };
    mkEl('pattern-name-status'); mkEl('grid-info-status'); mkEl('nav-node-stepper'); mkEl('stepper'); mkEl('layer-node-count-input');
    const w = world('square', { shape: 'square', ordnung: 4, lage: 1 }, 'rotation_reflection6', ui);
    w.sb.document = { body: {}, getElementById: id => els[id] || null };
    w.sb.select = id => els[id.replace('#', '')] || null;
    w.set('let patternNameCacheSignature = null; let patternNameCacheValue = null; let patternNameCacheTip = null;');
    ['activeConnections', 'activeGridOverride', 'patternNameSignature', 'patternNameTooltip', 'updateGridInfoLine', 'updatePatternNameStatus'].forEach(nm => w.set(grab(nm)));
    const show = () => { w.set('updatePatternNameStatus();'); return { text: els['pattern-name-status'].htmlText, tip: els['pattern-name-status'].attrs.title, info: els['grid-info-status'].textContent }; };
    const reps = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
    let r = show();
    check('(3) no line: the old placeholder "No theme lines yet", no tooltip', r.text === 'No theme lines yet' && r.tip === undefined, J(r));
    w.set(`connections = ${J(reps.slice(10, 12))};`);
    r = show();
    const v2 = w.get('gridDisplayNameFor(baseGridSpecNow(), connections, symmetryMode).display');
    check('(3) main group (rotation_reflection6 on the square) with lines: the name field shows the v2 display name (' + v2 + '), a tooltip is set, the info line has the same grid code', r.text === v2 && /^4q1\/4\* /.test(r.text) && typeof r.tip === 'string' && r.tip.startsWith('4q1: Ordnung 4, Quadrat, Lage 1, Hauptgruppe 4*, 25 Knoten') && r.info === 'Gitter: 4q1 · Knoten: 25', J(r));
    check('(3) the tooltip names every distinct line: token, node numbers, letter and sectors; the bar and the capital where they apply', (() => { const tk = w.get('gridDisplayNameFor(baseGridSpecNow(), connections, symmetryMode).tokens'); return tk.every(t => r.tip.includes(t.display + ': Knotennummer ' + t.key.z1 + ', ' + t.key.z2 + '; Buchstabe ' + t.key.buchstabe)) && tk.every(t => (!!t.key.gegen) === r.tip.split('\n').find(l => l.startsWith(t.display)).includes('Überstrich: ')); })(), r.tip);
    // reduced symmetry: the old name, no tooltip
    const old = w.get(`computeThemeLineName(connections, 'reflection_only', undefined, undefined)`);
    w.set("symmetryMode = 'reflection_only';");
    r = show();
    check('(3) one mirror only (reflection_only; "nur Drehung" has had its own name since task 072c): the old name unchanged (computeThemeLineName), NO tooltip', r.text === w.get("computeThemeLineName(connections, undefined, undefined, undefined)") && !/^\d+[dq*][12]\//.test(r.text) && r.tip === undefined, J(r));
    w.set("symmetryMode = 'rotation_reflection6';"); show();
    // free endpoint
    w.set('nodes.push({ id: nodes.length + 1, x: 41.5, y: 99.5, free: true }); connections.push([1, nodes.length]);');
    r = show();
    check('(3) a free endpoint: the old message "Name unavailable (includes free endpoints)", no tooltip, no v2 call result', r.text === 'Name unavailable (includes free endpoints)' && r.tip === undefined, J(r));
    w.set('connections.pop(); nodes.pop();');
    r = show();
    check('(3) back to complete lines: the v2 name and the tooltip return', /^4q1\/4\* /.test(r.text) && typeof r.tip === 'string');
    // cache: follows line, ordnung, lage, shape, symmetry mode, language
    const names = [r.text];
    w.set(`connections = ${J(reps.slice(10, 13))};`); names.push(show().text);
    w.set("setGrid({ shape: 'square', ordnung: 5, lage: 1 }); connections = [];"); const reps5 = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())'); w.set(`connections = ${J(reps.slice(10, 12))};`); names.push(show().text);
    w.set("setGrid({ shape: 'square', ordnung: 4, lage: 2 }); connections = " + J(reps.slice(10, 12)) + ";"); names.push(show().text);
    w.set("currentShape = 'hex'; setGrid({ shape: 'hex', ordnung: 3, lage: 1 }); connections = [[1, 2]];"); names.push(show().text);
    check('(4) the cached name follows a new line, the ordnung, the lage and the shape (5 different names: ' + names.join(' | ') + ')', new Set(names).size === 5 && /^4q1/.test(names[0]) && /^4q1/.test(names[1]) && /^5q1/.test(names[2]) && /^4q2/.test(names[3]) && /^3\*1/.test(names[4]), J(names));
    w.set("currentShape = 'square'; setGrid({ shape: 'square', ordnung: 4, lage: 1 }); connections = " + J(reps.slice(10, 12)) + "; symmetryMode = 'rotation_reflection6';");
    const a = show().text; w.set("symmetryMode = 'reflection_only';"); const b = show().text; w.set("symmetryMode = 'rotation_reflection6';"); const c = show().text;
    check('(4) the symmetry mode: v2 -> old name -> v2 again (the signature carries the mode)', a !== b && a === c && /^4q1\/4\*/.test(a) && !/^\d+[dq*][12]\//.test(b), J([a, b, c]));
    // the lage alone (a session restore uses projectGridSpec: gridRevision is NOT bumped): the signature itself must carry it
    w.set("(function () { const spec = { shape: 'square', ordnung: 4, lage: 2 }; projectGridSpec(spec); nodes = buildGrid(spec, { sizeFactor: shapeSizeFactor, canvasW, canvasH }).nodes; })();");
    const lageOnly = show().text; w.set("(function () { const spec = { shape: 'square', ordnung: 4, lage: 1 }; projectGridSpec(spec); nodes = buildGrid(spec, { sizeFactor: shapeSizeFactor, canvasW, canvasH }).nodes; })();"); show();
    check('(4) the lage alone (state set like a session restore, gridRevision unchanged) changes the name: 4q2 against 4q1 (the signature carries the lage)', /^4q2\//.test(lageOnly) && /^4q1\//.test(a), lageOnly);
    const tipDe = els['pattern-name-status'].attrs.title; ui.lang = 'en'; r = show();
    check('(4) a language change re-builds the tooltip (the signature carries UI.lang): English "Grid 4q1: order 4, Square, position 1, main group 4*, 25 nodes." and "node numbers"', tipDe.startsWith('4q1: Ordnung 4') && r.tip !== tipDe && r.tip.startsWith('4q1: order 4, Square, position 1, main group 4*, 25 nodes') && /node number \d+, \d+; letter [a-n] \(\d+ sectors?\)/.test(r.tip) && r.text === a, r.tip);
    ui.lang = 'de';
    check('(4) the layer path: the name of an active layer is built from the layer\'s own spec and mode (hex layer of lage 2 on a square base)', (() => {
        w.set("additionalLayers = [{ shape: 'hex', symmetryMode: 'rotation_reflection6', gridSpec: { shape: 'hex', ordnung: 2, lage: 2 }, nodeCount: 2, connections: [], nodes: [], centroid, outerCorners, shapeSizeFactor: 3 }];");
        w.set("(function () { const g = layerGridForSpec(outerCorners, centroid, currentShape, shapeSizeFactor, 3, additionalLayers[0].gridSpec, 'hex', canvasW, canvasH); additionalLayers[0].nodes = g.nodes; additionalLayers[0].centroid = g.centroid; additionalLayers[0].outerCorners = g.outerCorners; })(); activeLayer = 0;");
        const tbl = w.get("computeThemeLineOrbits(additionalLayers[0].nodes, additionalLayers[0].centroid, 'hex', 'rotation_reflection6', additionalLayers[0].outerCorners).orbits.map(o => o.pairs[0].slice())");
        w.set(`additionalLayers[0].connections = ${J(tbl.slice(5, 7))};`);
        const t = show(); w.set("activeLayer = 'base'; additionalLayers = [];");
        return /^2\*2\/6\* /.test(t.text) && t.tip && t.tip.startsWith('2*2: Ordnung 2, Sechseck, Lage 2, Hauptgruppe 6*');
    })());
}

// ---- 5. time per call ----------------------------------------------------------------------------------------------------------------------------
{
    const w = world('hex', { shape: 'hex', ordnung: 12, lage: 1 });
    const reps = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
    w.set(`connections = ${J(reps.slice(100, 108))};`);
    const ms = f => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t) / 1e6; };
    const first = ms(() => w.get('gridDisplayNameFor(baseGridSpecNow(), connections, symmetryMode)'));
    const rep = ms(() => { for (let i = 0; i < 50; i++) w.get('gridDisplayNameFor(baseGridSpecNow(), connections, symmetryMode)'); }) / 50;
    const oldT = ms(() => w.get('computeThemeLineName(connections, undefined, undefined, undefined)'));
    console.log(`INFO  time per call, hex 12, 8 lines: v2 first call (table of the grid) ${first.toFixed(0)} ms, repeated ${rep.toFixed(2)} ms; the old name: ${oldT.toFixed(0)} ms per call`);
    check('(5) the budget: the first v2 call (the table of a hex 12 grid, once) under 1 s, every repeated call under 5 ms; the display is computed only when the signature changes (cache block of updatePatternNameStatus)', first < 1000 && rep < 5 && /if \(sig !== patternNameCacheSignature\) \{[\s\S]*?gridDisplayNameFor\([\s\S]*?patternNameCacheSignature = sig;/.test(SK), `${first} / ${rep}`);
}

check('(5) style.css: #pattern-name-status may break anywhere (overflow-wrap: anywhere): a long v2 name does not run out of the narrow phone card', /#pattern-name-status \{ overflow-wrap: anywhere; white-space: pre-line; \}/.test(read('style.css')));

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
