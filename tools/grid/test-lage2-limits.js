// Task 070: the lage-2 ceiling comes from the measurement (tools/gitter/measure-lage2-limits.js): triangle 12, square 12, hexagon 9 (it was 5 / 5 / 2, a precaution).
//   node tools/grid/test-lage2-limits.js     BASE = the commit before 070 (default 0701da35); OLD_TREE = that tree already extracted
//   1. everything inside the old lage-2 limits and all of lage 1 is byte-equal to the old tree; what may differ is named
//   2. ONE table (LAGE2_MAX), every consumer reads it: validator, stepper max, clamps, setBaseLage / setLayerLage, session validator, the refusal text
//   3. the new lage-2 grids (triangle / square 6..12, hex 3..9): valid, group closure, line keys and node numbers against the Orakel by coordinates, unique tokens, round trips
//   4. the second click up to the new limit, the refusal one above with the right numbers, the shape change at lage 2 (the ordnung stays, clamped to the shape's limit)
//   5. session round trip with the highest ordnung per shape (base lage 2 and a lage-2 layer); the validator one above
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || '0701da35';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const B = require(path.join(ROOT, 'tools', 'gitter', 'oracle-bridge.js')), O = require(path.join(ROOT, 'tools', 'gitter', 'measure-name-rule.js'));
const SHAPES = ['triangle', 'square', 'hex'];
const LM = { triangle: 12, square: 12, hex: 9 };
const L1N = (shape, n) => shape === 'triangle' ? (n + 1) * (n + 2) / 2 : shape === 'square' ? (n + 1) * (n + 1) : 3 * n * (n + 1) + 1;
const L2N = (shape, n) => L1N(shape, n) + (shape === 'hex' ? 6 * n * n : n * n);
const SK = read('sketch.js');
const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };

// ---- 1. old tree --------------------------------------------------------------------------------------------------------------------------
let oldDir = process.env.OLD_TREE || null;
if (!oldDir) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lage2limits-old-'));
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
    check('(1) core/*.js except forms.js, tools/morph/off-path-golden.json and ui-phone-config.js are unchanged (core/faces, tiling, facecolor, orbits, export, session, state included)', fs.readdirSync(path.join(ROOT, 'core')).filter(f => /\.js$/.test(f) && f !== 'forms.js' && f !== 'orbits.js' && f !== 'export.js' && f !== 'glossary.js' && f !== 'symmetry.js').every(f => same('core/' + f)) && same('tools/morph/off-path-golden.json') && same('ui-phone-config.js'));
    const strip = s => s.replace(/\/\/ (?:Task 067: the ceiling of the ordnung of a lage-2 grid|The ONE table of the lage-2 ceiling)[\s\S]*?const LAGE2_MAX = \{[^}]*\};/, 'TABLE');
    check('(1) core/forms.js differs from the old file ONLY in the LAGE2_MAX table (and its comment): the lage-1 table NODE_COUNT_MAX is untouched', strip(read('core/forms.js')) === strip(fs.readFileSync(path.join(oldDir, 'core/forms.js'), 'utf8')) && read('core/forms.js') !== fs.readFileSync(path.join(oldDir, 'core/forms.js'), 'utf8') && /const NODE_COUNT_MAX = \{ triangle: 13, square: 13, hex: 12 \};/.test(read('core/forms.js')));
    check('(1) sketch.js: the refusal text call of sayLageRefusal passes the table values (task 070; later tasks may change other parts of sketch.js)', /t\('reason\.lage2\.max', \{ n: r\.limit, t: maxOrdnungFor\('triangle', 2\)/.test(SK));
}
const P5 = ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect', 'translate', 'rotate', 'scale', 'textSize', 'text', 'textAlign', 'background', 'clear'];
function world(shape, spec, o) {
    o = o || {};
    const w = H.makeRenderWorld(shape, 3, 3, 'rotation_reflection6');
    const sb = w.sb;
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.CLOSE = 'close'; sb.window = o.window || { UI: undefined };
    P5.forEach(f => { sb[f] = () => { }; });
    if (o.on !== false) w.set('globalThis.__lage2 = true;');
    if (spec) w.set(`currentShape = ${J(spec.shape)}; setGrid(${J(spec)});`);
    return w;
}

// ---- 2. one table ------------------------------------------------------------------------------------------------------------------------
{
    const w = world('triangle', null);
    check('(2) maxOrdnungFor / gridMaxOrdnung at lage 2 (switch on) = 12 / 12 / 9; with the switch off 0 / the lage-1 limit; lage 1 stays 12 / 12 / 12', SHAPES.every(s => w.get(`maxOrdnungFor(${J(s)}, 2) === ${LM[s]} && gridMaxOrdnung(${J(s)}, 2) === ${LM[s]} && maxOrdnungFor(${J(s)}, 1) === 12`)) && world('triangle', null, { on: false }).get("maxOrdnungFor('hex', 2) === 0 && gridMaxOrdnung('hex', 2) === 12"));
    check('(2) the validator (switch on): each shape accepts its limit and refuses one above, at lage 2; the layer path (projectLayerGridSpec) and setGrid / projectGridSpec say the same', SHAPES.every(s => w.get(`(function () { const t = f => { try { f(); return false; } catch (e) { return true; } }, l = { shape: ${J(s)}, nodeCount: 3, gridSpec: { shape: ${J(s)}, ordnung: 3, lage: 1 } };
            return validateGridSpec({ shape: ${J(s)}, ordnung: ${LM[s]}, lage: 2 }).ok && !validateGridSpec({ shape: ${J(s)}, ordnung: ${LM[s] + 1}, lage: 2 }).ok && t(() => setGrid({ shape: ${J(s)}, ordnung: ${LM[s] + 1}, lage: 2 })) && t(() => projectGridSpec({ shape: ${J(s)}, ordnung: ${LM[s] + 1}, lage: 2 }))
                && t(() => projectLayerGridSpec(l, { shape: ${J(s)}, ordnung: ${LM[s] + 1}, lage: 2 })) && !t(() => projectLayerGridSpec(l, { shape: ${J(s)}, ordnung: ${LM[s]}, lage: 2 })); })()`)));
    const tables = [...fs.readdirSync(path.join(ROOT, 'core')).filter(f => /\.js$/.test(f)).map(f => 'core/' + f), 'sketch.js', 'ui-form.js', 'ui-layer.js', 'ui.js', 'gallery.js', 'ui-layers.js'].flatMap(f => (read(f).match(/\{\s*triangle:\s*\d+,\s*square:\s*\d+,\s*hex:\s*\d+\s*\}/g) || []).map(m => f + ' ' + m.replace(/\s+/g, ' '))).sort();
    check('(2) no second number table: only NODE_COUNT_MAX (13, 13, 12) and LAGE2_MAX (12, 12, 9) in core/forms.js', J(tables) === J(['core/forms.js { triangle: 13, square: 13, hex: 12 }', 'core/forms.js { triangle: 12, square: 12, hex: 9 }'].sort()), J(tables));
    const dict = (() => { const src = read('ui-i18n.js'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2], en: k[3] }; return m; })();
    check('(2) the refusal text is built from the table, not from fixed numbers: "... bis Ordnung {n} (Dreieck {t}, Quadrat {q}, Sechseck {h})." / "... up to order {n} (triangle {t}, square {q}, hexagon {h})."; sketch.js passes maxOrdnungFor(shape, 2) for t, q, h and n = the limit of the shape',
        dict['reason.lage2.max'].de === 'Lage 2 gibt es nur bis Ordnung {n} (Dreieck {t}, Quadrat {q}, Sechseck {h}).' && dict['reason.lage2.max'].en === 'Position 2 is only available up to order {n} (triangle {t}, square {q}, hexagon {h}).'
        && /n: r\.limit, t: maxOrdnungFor\('triangle', 2\), q: maxOrdnungFor\('square', 2\), h: maxOrdnungFor\('hex', 2\)/.test(SK) && !/beim Dreieck und Quadrat 5|5 for triangle/.test(SK + read('ui-i18n.js')));
    check('(2) the stepper max of a lage-2 base / layer is gridMaxOrdnung(shape, lage): ui-form.js, ui-layer.js and sketch.js read the helper, no literal 5 / 2', /gridMaxOrdnung\(currentShape, typeof gridSpec !== 'undefined' \? gridSpec\.lage : 1\)/.test(read('ui-form.js')) && /nodeInput\.elt\.max = gridMaxOrdnung\(currentShape, gridSpec\.lage\)/.test(SK));
}

// ---- 3. the new grids -----------------------------------------------------------------------------------------------------------------------
{
    const core = B.loadCore();
    const bad = [], groupBad = [], nameBad = [], rtBad = [];
    let cases = 0, pairs = 0, twoDigit = 0, tokens = 0;
    const range = s => { const a = []; for (let n = (s === 'hex' ? 3 : 6); n <= LM[s]; n++) a.push(n); return a; };
    for (const shape of SHAPES) for (const n of range(shape)) {
        cases++;
        const w = world(shape, { shape, ordnung: LM[shape], lage: 1 });
        w.set(`setGrid({ shape: ${J(shape)}, ordnung: ${n}, lage: 2 });`);
        const nn = w.get('nodes.length');
        if (nn !== L2N(shape, n) || w.get('gridSpec.lage') !== 2 || w.get('gridSpec.ordnung') !== n || !w.get('nodes.every(p => typeof p.u === "number" && typeof p.v === "number")')) bad.push(`${shape}${n}:${nn}`);
        const ge = w.get('getGroupElementsCached(nodes, centroid, currentShape, symmetryMode, outerCorners).perms.length');
        if (ge !== (shape === 'square' ? 8 : shape === 'triangle' ? 6 : 12)) groupBad.push(`${shape}${n}:${ge}`);
        const grid = { shape, ordnung: n, lage: 2 }, og = O.buildGrid(shape, n, 2), oo = O.pairOrbits(og), t = core.table(grid), num = core.numbered(grid);
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
            if (J(core.get('parseLineKey')(core.get('formatLineKey')(e.key))) !== J(e.key)) rtBad.push(`${shape}${n}:${e.token}`);
        }
        const k0 = t.entries[Math.floor(t.entries.length / 2)].key, F = core.get('formatGridName'), P = core.get('parseGridName');
        const nm = F(grid, [k0], core.V2), back = P(nm, core.V2);
        if (!back || back.grid.lage !== 2 || back.grid.ordnung !== n || back.grid.shape !== shape || J(back.keys[0]) !== J(k0)) rtBad.push(`${shape}${n}:name ${nm}`);
    }
    check(`(3) ${cases} lage-2 grids (triangle / square 6..12, hex 3..9): node counts L1 + n^2 (hex L1 + 6n^2), lage 2 with u, v on every node`, bad.length === 0 && cases === 7 + 7 + 7, bad.join(','));
    check('(3) group closure: 6 / 8 / 12 elements on every grid', groupBad.length === 0, groupBad.join(','));
    check(`(3) line keys and node numbers equal the Orakel by coordinates for every pair (${pairs} oriented pairs, ${tokens} orbits), no collision, no duplicate token`, nameBad.length === 0 && pairs > 5e5, nameBad.slice(0, 4).join(' | ') + ' pairs ' + pairs);
    check(`(3) two-digit node numbers exist (${twoDigit} tokens), every key round-trips format -> parse, one grid name per grid round-trips with lage 2`, twoDigit > 0 && rtBad.length === 0, rtBad.slice(0, 4).join(' | '));
}

// ---- 4. the second click, the refusal, the shape change ---------------------------------------------------------------------------------------
{
    const dict = (() => { const src = read('ui-i18n.js'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2], en: k[3] }; return m; })();
    const tIn = lang => (key, vars) => { const e = dict[key]; if (!e) return key; return e[lang || 'de'].replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] !== undefined ? vars[k] : '{' + k + '}'); };
    const NAMES = ['shapeChangePlan', 'shapeLossWhat', 'shapeChangeText', 'sayShapeChange', 'toggleBaseLage', 'toggleLayerLage', 'sayLage', 'sayLageRefusal', 'addLayer', 'updateActiveLayerGrid'];
    const a0 = SK.indexOf('shapeBtns.forEach(btn => {'), b0 = SK.indexOf('// Shape size (Number Input)');
    const mk = (spec, setup, lang) => {
        const log = { said: [], dialogs: [] };
        const win = { UI: { t: tIn(lang) }, say: (k, text, kind) => log.said.push([k, text, kind]), timelineConfirm: d => log.dialogs.push(d) };
        const w = world(spec.shape, spec, { window: win });
        w.sb.UI = win.UI; NAMES.forEach(n => w.set(grab(n)));
        const mkBtn = s => ({ s, active: s === spec.shape, handler: null, mousePressed(f) { this.handler = f; }, attribute: () => s, addClass() { this.active = true; }, removeClass() { this.active = false; }, hasClass() { return this.active; }, elt: { focus() { } } });
        const btns = SHAPES.map(mkBtn);
        Object.assign(w.sb, { shapeBtns: btns, syncGridControls() { }, renderLayerTabs() { }, updateOffsetControls() { }, updateTimelineControls() { }, updateSymmetryModeControl() { }, cancelAltNetConstruction() { }, redraw() { } });
        w.set(SK.slice(a0, b0)); if (setup) w.set(setup);
        return { w, log, click: s => btns.find(b => b.s === s).handler() };
    };
    for (const shape of SHAPES) {
        const lim = LM[shape];
        let x = mk({ shape, ordnung: lim, lage: 1 }, 'connections = [[1, 2]];');
        x.click(shape);
        check(`(4) ${shape} lage 1 ordnung ${lim} (the new limit): the second click gives lage 2 (${L2N(shape, lim)} nodes), the ordnung stays, the lines are cleared, the notice says so`, x.w.get('gridSpec.lage === 2 && gridSpec.ordnung === ' + lim + ' && connections.length === 0 && nodes.length === ' + L2N(shape, lim)) && x.log.said.length === 1 && x.log.said[0][1] === 'Lage 2: Linien geleert. Erneut klicken: zurück zu Lage 1.', J(x.log.said));
        if (lim < 12) {
            x = mk({ shape, ordnung: lim + 1, lage: 1 }, 'connections = [[1, 2]];');
            const before = x.w.get('JSON.stringify([gridSpec, connections, gridRevision])');
            x.click(shape);
            check(`(4) ${shape} lage 1 ordnung ${lim + 1} (one above): no change, the warning "Lage 2 gibt es nur bis Ordnung ${lim} (Dreieck 12, Quadrat 12, Sechseck 9)."`, x.w.get('JSON.stringify([gridSpec, connections, gridRevision])') === before && J(x.log.said) === J([['lage-change', `Lage 2 gibt es nur bis Ordnung ${lim} (Dreieck 12, Quadrat 12, Sechseck 9).`, 'warn']]), J(x.log.said));
        }
    }
    let x = mk({ shape: 'hex', ordnung: 12, lage: 1 }, ''); x.click('hex');
    check('(4) hex 12 (lage 1): refused with limit 9; the same text in English', x.log.said[0][1] === 'Lage 2 gibt es nur bis Ordnung 9 (Dreieck 12, Quadrat 12, Sechseck 9).' && (() => { const y = mk({ shape: 'hex', ordnung: 11, lage: 1 }, '', 'en'); y.click('hex'); return y.log.said[0][1] === 'Position 2 is only available up to order 9 (triangle 12, square 12, hexagon 9).'; })());
    // shape change at lage 2: the ordnung stays, clamped to the shape's limit, the lage stays
    let bad = [], n = 0;
    for (const a of SHAPES) for (const b of SHAPES) {
        if (a === b) continue;
        for (let o = 1; o <= LM[a]; o++) {
            const y = mk({ shape: a, ordnung: o, lage: 2 }, '');
            y.click(b);
            const want = Math.min(o, LM[b]); n++;
            if (y.w.get('gridSpec.ordnung') !== want || y.w.get('gridSpec.lage') !== 2 || y.w.get('nodes.length') !== L2N(b, want)) bad.push(`${a}${o}->${b}`);
        }
    }
    check(`(4) shape change at lage 2 (${n} cases, every ordered pair x ordnung 1..limit): the ordnung stays, clamped to 12 / 12 / 9, the lage stays 2, the nodes are those of lage 2`, bad.length === 0, bad.slice(0, 4).join(' | '));
    const y = mk({ shape: 'square', ordnung: 12, lage: 2 }, 'connections = [[1, 2]];'); y.click('hex');
    check('(4) the clamp is told: square 12 -> hex at lage 2: "Ordnung auf 9 begrenzt (höchstens 9 bei dieser Form). Geleert: Linien."', y.log.said[0][1] === 'Ordnung auf 9 begrenzt (höchstens 9 bei dieser Form). Geleert: Linien.', J(y.log.said));
    // layer
    const l = mk({ shape: 'square', ordnung: 3, lage: 1 }, 'addLayer(); activeLayer = 0;');
    const rs = SHAPES.map(s => { l.w.set(`updateActiveLayerGrid({ shape: ${J(s)}, ordnung: ${LM[s]} }); additionalLayers[0].connections = [[1, 2]];`); l.log.said.length = 0; l.w.set('toggleLayerLage(additionalLayers[0]);'); return [s, l.w.get('additionalLayers[0].gridSpec.lage'), l.w.get('additionalLayers[0].nodes.length'), l.log.said.length, l.w.get('setLayerLage(additionalLayers[0], 1).ok')]; });
    check('(4) a layer at the limit of its shape goes to lage 2 and back (setLayerLage / toggleLayerLage): ' + J(rs.map(r => r[0] + ':' + r[2])), rs.every(r => r[1] === 2 && r[2] === L2N(r[0], LM[r[0]]) && r[3] === 1 && r[4] === true), J(rs));
    const l2 = mk({ shape: 'square', ordnung: 3, lage: 1 }, 'addLayer(); activeLayer = 0; updateActiveLayerGrid({ shape: "hex", ordnung: 10 });');
    const r10 = l2.w.get('setLayerLage(additionalLayers[0], 2)');
    check('(4) a hex layer at ordnung 10 is refused (ordnung-limit, limit 9), nothing touched', r10.ok === false && r10.reason === 'ordnung-limit' && r10.limit === 9 && l2.w.get('additionalLayers[0].gridSpec.lage') === 1);
}

// ---- 5. session --------------------------------------------------------------------------------------------------------------------------------
{
    for (const [shape, lshape] of [['triangle', 'square'], ['hex', 'triangle'], ['square', 'hex']]) {
        const src = S.newCtx(); S.reset(src, shape, 3, 3, 'rotation_reflection6');
        src.run('globalThis.__lage2 = true;');
        src.run(`currentShape = ${J(shape)}; setGrid({ shape: ${J(shape)}, ordnung: ${LM[shape]}, lage: 2 });`);
        const reps = src.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
        src.run(`connections = ${J(reps.slice(0, 5))};`);
        src.run(`(function () { const layer = { connections: [[1, 2]], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape: ${J(lshape)}, symmetryMode: symmetryMode, enabled: true, showFaces: false, shapeSizeFactor: 3 };
            projectLayerGridSpec(layer, { shape: ${J(lshape)}, ordnung: ${LM[lshape]}, lage: 2 }); const g = layerGridForSpec(outerCorners, centroid, currentShape, shapeSizeFactor, 3, layer.gridSpec, layer.shape, canvasW, canvasH); layer.nodes = g.nodes; layer.centroid = g.centroid; layer.outerCorners = g.outerCorners; additionalLayers.push(layer); })();`);
        const ui = S.uiOf(src, 'none', 6), snap = S.snapOf(src, ui);
        const dst = S.newCtx(); S.reset(dst, shape === 'hex' ? 'square' : 'hex', 3, 3, 'none'); dst.run('globalThis.__lage2 = true;');
        const res = S.applyInto(dst, snap, S.fakeHooks(dst, snap, S.uiOf(dst, 'none', 6)), {});
        check(`(5) session round trip: ${shape} ${LM[shape]} lage 2 base + ${lshape} ${LM[lshape]} lage 2 layer: validate, plan, apply; the state equals the source (snapshot, nodes with u/v, export JSON)`, res.ok === true && S.same(S.snapOf(dst, S.uiOf(dst, 'none', 6)), snap) && dst.run('gridSpec.lage') === 2 && dst.run('additionalLayers[0].gridSpec.lage') === 2 && dst.run('additionalLayers[0].nodes.length') === L2N(lshape, LM[lshape]) && J(S.exportOf(dst)) === J(S.exportOf(src)), J(res).slice(0, 200));
        const over = JSON.parse(J(snap)); over.settings.grid.ordnung = LM[shape] + 1; over.savedAt = 1;
        const overL = JSON.parse(J(snap)); overL.layers[0].grid.ordnung = LM[lshape] + 1; overL.savedAt = 1;
        check(`(5) the session validator: ordnung ${LM[shape] + 1} on the ${shape} base and ${LM[lshape] + 1} on the ${lshape} layer (lage 2) are refused, the limits accepted`, dst.sb.validateSession(over).ok === false && dst.sb.validateSession(overL).ok === false && dst.sb.validateSession(Object.assign(JSON.parse(J(snap)), { savedAt: 1 })).ok === true);
        const off = S.newCtx(); S.reset(off, 'square', 3, 3, 'none');
        check(`(5) with the switch off the same snapshot is refused (${shape} / ${lshape})`, off.sb.validateSession(Object.assign(JSON.parse(J(snap)), { savedAt: 1 })).ok === false);
    }
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
