// Task 069: the lage-1 ceiling of the ordnung is 12 for EVERY shape (it was triangle 6, square 12, hex 7); lage 2 stays 5 / 5 / 2.
//   node tools/grid/test-ordnung12.js     BASE = the commit before 069 (default eedbd812); OLD_TREE = that tree already extracted
//   1. everything up to the old ceilings is byte-equal to the old tree; the files this task must not touch are unchanged
//   2. ONE source of the limit (core/forms.js NODE_COUNT_MAX), every consumer reads it: validator, stepper, clamps, session, catalog transport, messages, markup
//   3. ordnung 7..12 on all three shapes: valid grids (node formulas), group closure, line keys and node numbers against the Orakel (by coordinates), unique names, round trips
//   4. input path, shape change (the ordnung stays, no clamp at lage 1) for every pair of shapes and ordnung 1..12; lage 2 unchanged
//   5. session round trip with ordnung 12 (base, layers); the validator; the catalog transport up to 12
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'eedbd812';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const B = require(path.join(ROOT, 'tools', 'gitter', 'oracle-bridge.js')), O = require(path.join(ROOT, 'tools', 'gitter', 'measure-name-rule.js'));
const SHAPES = ['triangle', 'square', 'hex'];
const NODES = (shape, n) => shape === 'triangle' ? (n + 1) * (n + 2) / 2 : shape === 'square' ? (n + 1) * (n + 1) : 3 * n * (n + 1) + 1;

// ---- 1. old tree ----------------------------------------------------------------------------------------------------------------------------
let oldDir = process.env.OLD_TREE || null;
if (!oldDir) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ordnung12-old-'));
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
        check('(1) ' + script + ' equals the old tree (' + keys.length + ' keys)', a && keys.length > 5 && bad.length === 0, err || bad.slice(0, 3).join(' | '));
    }
    const same = f => read(f) === fs.readFileSync(path.join(oldDir, f), 'utf8');
    check('(1) core/*.js except forms.js, tools/morph/off-path-golden.json, ui-phone-config.js are unchanged', fs.readdirSync(path.join(ROOT, 'core')).filter(f => /\.js$/.test(f) && f !== 'forms.js' && f !== 'orbits.js').every(f => same('core/' + f)) && same('tools/morph/off-path-golden.json') && same('ui-phone-config.js'));
    // forms.js differs ONLY in the table and its comment
    const strip = s => s.replace(/\/\/ (?:Node Count ceiling per shape|The ONE table of the lage-1 ceiling)[\s\S]*?const NODE_COUNT_MAX = \{[^}]*\};/, 'TABLE').replace(/\/\/ (?:Task 067: the ceiling of the ordnung of a lage-2 grid|The ONE table of the lage-2 ceiling)[\s\S]*?const LAGE2_MAX = \{[^}]*\};/, 'TABLE2');   // task 070 changed the lage-2 table too
    check('(1) core/forms.js differs from the old file only in the NODE_COUNT_MAX table (and its comment)', strip(read('core/forms.js')) === strip(fs.readFileSync(path.join(oldDir, 'core/forms.js'), 'utf8')) && read('core/forms.js') !== fs.readFileSync(path.join(oldDir, 'core/forms.js'), 'utf8'));
}
const P5 = ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect', 'translate', 'rotate', 'scale', 'textSize', 'text', 'textAlign', 'background', 'clear'];
function world(shape, spec, on) {
    const w = H.makeRenderWorld(shape, 3, 3, 'rotation_reflection6');
    const sb = w.sb;
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.CLOSE = 'close'; sb.window = { UI: undefined };
    P5.forEach(f => { sb[f] = () => { }; });
    if (on !== false) w.set('globalThis.__lage2 = true;');
    if (spec) w.set(`currentShape = ${J(spec.shape)}; setGrid(${J(spec)});`);
    return w;
}

// ---- 2. one source ------------------------------------------------------------------------------------------------------------------------------
{
    const files = [...fs.readdirSync(path.join(ROOT, 'core')).filter(f => /\.js$/.test(f)).map(f => 'core/' + f), 'sketch.js', 'ui-form.js', 'ui-layer.js', 'ui.js', 'gallery.js', 'gallery-render.js', 'ui-layers.js', 'ui-net.js'];
    const tables = files.flatMap(f => (read(f).match(/\{\s*triangle:\s*\d+,\s*square:\s*\d+,\s*hex:\s*\d+\s*\}/g) || []).map(m => f + ' ' + m.replace(/\s+/g, ' ')));
    check('(2) the limits live in ONE table per lage: core/forms.js NODE_COUNT_MAX { 13, 13, 12 } (counts) and LAGE2_MAX { 12, 12, 9 } (task 070); no other { triangle, square, hex } number table in core, sketch or ui', J(tables.sort()) === J(['core/forms.js { triangle: 13, square: 13, hex: 12 }', 'core/forms.js { triangle: 12, square: 12, hex: 9 }'].sort()), J(tables));
    const w = world('triangle', null);
    check('(2) lage 1: gridMaxOrdnung = maxOrdnungFor = 12 for every shape; the counts 13 / 13 / 12; lage 2 (switch on) 12 / 12 / 9', SHAPES.every(s => w.get(`gridMaxOrdnung(${J(s)}, 1) === 12 && maxOrdnungFor(${J(s)}, 1) === 12`)) && w.get("maxNodeCountFor('triangle') === 13 && maxNodeCountFor('square') === 13 && maxNodeCountFor('hex') === 12 && maxOrdnungFor('triangle', 2) === 12 && maxOrdnungFor('square', 2) === 12 && maxOrdnungFor('hex', 2) === 9 && gridMaxOrdnung('hex', 2) === 9"));
    check('(2) the validator (enforceMax): ordnung 12 accepted, 13 refused, for EACH of the three shapes; lage 2 above 12 / 12 / 9 refused', SHAPES.every(s => w.get(`validateGridSpec({ shape: ${J(s)}, ordnung: 12, lage: 1 }, { enforceMax: true }).ok && !validateGridSpec({ shape: ${J(s)}, ordnung: 13, lage: 1 }, { enforceMax: true }).ok`))
        && w.get("validateGridSpec({ shape: 'triangle', ordnung: 12, lage: 2 }).ok && !validateGridSpec({ shape: 'triangle', ordnung: 13, lage: 2 }).ok && validateGridSpec({ shape: 'hex', ordnung: 9, lage: 2 }).ok && !validateGridSpec({ shape: 'hex', ordnung: 10, lage: 2 }).ok"));
    const html = read('index.html');
    check('(2) markup: both order inputs max="12" (the shape and lage set the real max in sketch.js); the code fallbacks of ui-form.js / ui-layer.js are 12, not 7', /id="node-count-input" min="1" max="12"/.test(html) && /id="layer-node-count-input" min="1" max="12"/.test(html) && /gridMaxOrdnung\(currentShape, typeof gridSpec !== 'undefined' \? gridSpec\.lage : 1\) : 12; \}/.test(read('ui-form.js')) && /layerGridSpecOf\(L\)\.lage : 1\) : 12; \}/.test(read('ui-layer.js')));
    const dict = (() => { const src = read('ui-i18n.js'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2], en: k[3] }; return m; })();
    const fill = (t, n) => t.replace('{n}', n);
    check('(2) messages carry the number of the table, not a literal: "Höchste Ordnung beim Quadrat: 12." / "... bei dieser Form: 12." / English; the scripts pass the limit as {n}', fill(dict['reason.node.max.square'].de, 12) === 'Höchste Ordnung beim Quadrat: 12.' && fill(dict['reason.node.max.other'].de, 12) === 'Höchste Ordnung bei dieser Form: 12.' && fill(dict['reason.node.max.other'].en, 12) === 'Highest order for this shape: 12.'
        && /function nodeMaxMsg\(max\) \{ return \(currentShape === 'square' \? T\['reason\.node\.max\.square'\] : T\['reason\.node\.max\.other'\]\)\(max\); \}/.test(read('ui-form.js')) && !/\b(Höchste|Highest) order?\b.*\b7\b/.test(read('ui-i18n.js')));
    // the sketch.js clamps read the helpers (no literal limit)
    const SK = read('sketch.js');
    check('(2) sketch.js: the base input, the layer input, the clamp and the shape change read gridMaxOrdnung / gridMaxCount (no literal 7 / 12 / 13 limit)', (SK.match(/gridMaxOrdnung\(/g) || []).length >= 5 && (SK.match(/const maxN = gridMaxOrdnung\(/g) || []).length >= 2 && !/if \(v > (7|12|13)\) \{\s*show(Layer)?NodeCountNote/.test(SK));
}

// ---- 3. ordnung 7..12 -----------------------------------------------------------------------------------------------------------------------
{
    const core = B.loadCore();
    const bad = [], groupBad = [], nameBad = [], rtBad = [];
    let cases = 0, pairs = 0, twoDigit = 0, tokens = 0;
    for (const shape of SHAPES) for (let n = 7; n <= 12; n++) {
        cases++;
        const w = world(shape, { shape, ordnung: n, lage: 1 });
        const nn = w.get('nodes.length');
        if (nn !== NODES(shape, n) || w.get('gridSpec.ordnung') !== n || w.get('gridSpec.lage') !== 1) bad.push(`${shape}${n}:${nn}`);
        const K = { triangle: 3, square: 4, hex: 6 }[shape];
        const ge = w.get('getGroupElementsCached(nodes, centroid, currentShape, symmetryMode, outerCorners).perms.length');
        if (ge !== (shape === 'square' ? 8 : shape === 'triangle' ? 6 : 12)) groupBad.push(`${shape}${n}:${ge}`);
        // names against the Orakel, by coordinates
        const grid = { shape, ordnung: n, lage: 1 }, og = O.buildGrid(shape, n, 1), oo = O.pairOrbits(og), t = core.table(grid), num = core.numbered(grid);
        const idx = new Map(og.nodes.map((nd, i) => [B.ptKey(nd.x, nd.y), i])), idOf = new Map(num.nodes.map((nd, i) => [nd.id, i]));
        const toO = id => idx.get(B.ptKey(num.points[idOf.get(id)].x, num.points[idOf.get(id)].y));
        if (t.entries.length !== oo.length) { nameBad.push(`${shape}${n}:orbits ${t.entries.length}/${oo.length}`); continue; }
        if (t.collisions.length) nameBad.push(`${shape}${n}:collisions`);
        const oName = new Map(); oo.forEach(o => o.pairs.forEach(([i, j]) => oName.set(Math.min(i, j) + ',' + Math.max(i, j), o)));
        const seen = new Set();
        for (const e of t.entries) {
            tokens++; if (seen.has(e.token)) nameBad.push(`${shape}${n}:duplicate ${e.token}`); seen.add(e.token);
            if (/\d\.\d|\d{2}/.test(e.token)) twoDigit++;
            for (const [a, b] of e.pairs) {
                const oi = toO(a), oj = toO(b), o = oName.get(Math.min(oi, oj) + ',' + Math.max(oi, oj)); pairs++;
                if (!o || o.z1 !== e.key.z1 || o.z2 !== e.key.z2 || o.letter !== e.key.buchstabe || o.bar !== e.key.gegen || o.achiral !== e.spiegelgleich || o.name !== e.token) { nameBad.push(`${shape}${n}:${e.token}`); break; }
            }
            const f = core.get('formatLineKey'), p = core.get('parseLineKey');
            if (J(p(f(e.key))) !== J(e.key)) rtBad.push(`${shape}${n}:${e.token}`);
        }
        // the grid name round trip of one line
        const k0 = t.entries[Math.floor(t.entries.length / 2)].key, F = core.get('formatGridName'), P = core.get('parseGridName');
        const nm = F(grid, [k0], core.V2), back = P(nm, core.V2);
        if (!back || back.grid.ordnung !== n || back.grid.shape !== shape || J(back.keys[0]) !== J(k0)) rtBad.push(`${shape}${n}:name ${nm}`);
        if (pairs > 2e6) break;
    }
    check(`(3) ${cases} grids (3 shapes x ordnung 7..12): node counts = (n+1)(n+2)/2, (n+1)^2, 3n(n+1)+1, the spec and lage as set`, bad.length === 0 && cases === 18, bad.join(','));
    check('(3) group closure: the main group of every grid has 6 / 8 / 12 elements (getGroupElementsCached)', groupBad.length === 0, groupBad.join(','));
    check(`(3) line keys and node numbers equal the Orakel, by coordinates, for every pair (${pairs} oriented pairs, ${tokens} orbits): z1, z2, letter, bar, achirality and token; no collisions, no duplicate token`, nameBad.length === 0 && pairs > 1e5, nameBad.slice(0, 4).join(' | '));
    check(`(3) two-digit node numbers and tokens exist (${twoDigit} with "10.1"-style or two digits) and every key round-trips format -> parse; one grid name per grid round-trips (ordnung, shape, key)`, twoDigit > 0 && rtBad.length === 0, rtBad.slice(0, 4).join(' | '));
}

// ---- 4. input path, shape change -----------------------------------------------------------------------------------------------------------
{
    let bad = [], n = 0, bad2 = [];
    for (const a of SHAPES) {
        const w = world(a, null);
        for (let o = 1; o <= 12; o++) {
            const spec = w.get(`gridSpecForOrdnung(${J(a)}, ${o}, 1)`);
            n++; if (spec.ordnung !== o || spec.lage !== 1 || spec.shape !== a) bad.push(a + o);
        }
        if (w.get(`gridSpecForOrdnung(${J(a)}, 20, 1).ordnung`) !== 12) bad.push(a + '20');
    }
    check(`(4) the input path: gridSpecForOrdnung keeps every value 1..12 on every shape and clamps 20 to 12 (${n} values)`, bad.length === 0, bad.join(','));
    let pairsN = 0, clampedL1 = 0;
    for (const a of SHAPES) for (const b of SHAPES) {
        if (a === b) continue;
        for (const lage of [1, 2]) for (let o = 1; o <= (lage === 1 ? 12 : { triangle: 12, square: 12, hex: 9 }[a]); o++) {
            const w = world(a, { shape: a, ordnung: o, lage });
            w.set(`currentShape = ${J(b)}; rebuildGrid(${J(b)});`);
            const maxB = lage === 1 ? 12 : { triangle: 12, square: 12, hex: 9 }[b], want = Math.min(o, maxB);
            pairsN++; if (lage === 1 && want < o) clampedL1++;
            if (w.get('gridSpec.ordnung') !== want || w.get('gridSpec.lage') !== lage || w.get('nodes.length') !== (lage === 1 ? NODES(b, want) : w.get('nodes.length'))) bad2.push(`L${lage} ${a}${o}->${b}`);
        }
    }
    check(`(4) shape change for every ordered pair x ordnung 1..max x lage (${pairsN} cases): the ordnung stays (lage 1: never clamped, ${clampedL1} clamps; lage 2: 12 / 12 / 9 clamps), the lage stays, the node count is that of the new shape and ordnung`, bad2.length === 0 && clampedL1 === 0, bad2.slice(0, 4).join(' | '));
    const w = world('triangle', { shape: 'triangle', ordnung: 6, lage: 1 });
    check('(4) lage 2 (task 070: 12 / 12 / 9): setBaseLage accepts ordnung 12 on triangle and square and 9 on hex, refuses hex 10..12 with limit 9', ['triangle', 'square'].every(s => world(s, { shape: s, ordnung: 12, lage: 1 }).get('setBaseLage(2).ok') === true) && world('hex', { shape: 'hex', ordnung: 9, lage: 1 }).get('setBaseLage(2).ok') === true
        && [10, 11, 12].every(o => { const r = world('hex', { shape: 'hex', ordnung: o, lage: 1 }).get('setBaseLage(2)'); return r.ok === false && r.reason === 'ordnung-limit' && r.limit === 9; }));
}

// ---- 5. session, catalog -----------------------------------------------------------------------------------------------------------------------
{
    for (const [shape, lshape] of [['triangle', 'square'], ['hex', 'triangle'], ['square', 'hex']]) {
        const src = S.newCtx(); S.reset(src, shape, 3, 3, 'rotation_reflection6');
        src.run(`currentShape = ${J(shape)}; setGrid({ shape: ${J(shape)}, ordnung: 12, lage: 1 });`);
        const reps = src.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
        src.run(`connections = ${J(reps.slice(0, 5))};`);
        src.run(`(function () { const layer = { connections: [[1, 2]], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape: ${J(lshape)}, symmetryMode: symmetryMode, enabled: true, showFaces: false, shapeSizeFactor: 3 };
            projectLayerGridSpec(layer, { shape: ${J(lshape)}, ordnung: 12, lage: 1 }); const g = layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, 3, layer.nodeCount, layer.shape, canvasW, canvasH); layer.nodes = g.nodes; layer.centroid = g.centroid; layer.outerCorners = g.outerCorners; additionalLayers.push(layer); })();`);
        const ui = S.uiOf(src, 'none', 6), snap = S.snapOf(src, ui);
        const dst = S.newCtx(); S.reset(dst, shape === 'hex' ? 'square' : 'hex', 3, 3, 'none');
        const res = S.applyInto(dst, snap, S.fakeHooks(dst, snap, S.uiOf(dst, 'none', 6)), {});
        check(`(5) session round trip: ${shape} ordnung 12 base + ${lshape} ordnung 12 layer: validate, plan, apply; the state equals the source (snapshot, nodes, export JSON)`, res.ok === true && S.same(S.snapOf(dst, S.uiOf(dst, 'none', 6)), snap) && dst.run('gridSpec.ordnung') === 12 && dst.run('additionalLayers[0].gridSpec.ordnung') === 12 && J(S.exportOf(dst)) === J(S.exportOf(src)), J(res).slice(0, 200));
        const over = JSON.parse(J(snap)); over.settings.grid.ordnung = 13; over.savedAt = 1;
        const overL = JSON.parse(J(snap)); overL.layers[0].grid.ordnung = 13; overL.savedAt = 1;
        check(`(5) the session validator: ordnung 13 on the base and on a layer is refused (invalid), 12 is accepted (${shape})`, dst.sb.validateSession(over).ok === false && dst.sb.validateSession(overL).ok === false && dst.sb.validateSession(Object.assign(JSON.parse(J(snap)), { savedAt: 1 })).ok === true);
    }
    const w = world('triangle', null);
    const rows = SHAPES.map(s => { const x = world(s, { shape: s, ordnung: 12, lage: 1 }); const grp = { triangle: '3*', square: '4*', hex: '6*' }[s]; const t = x.get(`getLineKeyTable({ shape: ${J(s)}, ordnung: 12, lage: 1 }).entries[3].token`); return [s, grp, t]; });
    const okTransport = rows.map(([s, grp, tok]) => { const r = w.get(`parseTransportV2({ shape: ${J(s)}, ordnung: 12, lage: 1, group: ${J(grp)}, lines: [${J(tok)}] })`); const r13 = w.get(`parseTransportV2({ shape: ${J(s)}, ordnung: 13, lage: 1, group: ${J(grp)}, lines: [${J(tok)}] })`); return r.ok === true && r.pattern.spec.ordnung === 12 && r13.ok === false; });
    check('(5) catalog transport v2: ordnung 12 is accepted (all three shapes, one real line token each), 13 is refused', okTransport.every(Boolean), J(okTransport));
    check('(5) the link reader accepts three digits of ordnung (^[1-9]\\d{0,2}$) and the lage-1 only rule stays (lageRaw !== \'1\' rejected)', /\[1-9\]\\d\{0,2\}/.test(read('sketch.js')) && /lageRaw !== '1'/.test(read('sketch.js')));
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
