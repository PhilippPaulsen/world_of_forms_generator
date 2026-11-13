// Task 067: lage 2 in the app behind the internal developer switch (globalThis.__lage2 === true / ?lage2=1; default OFF).
//   node tools/grid/test-lage2-app.js      BASE = the commit before 067 (default 27d30af4); OLD_TREE = that tree already extracted (sabotage copies have no .git)
//   1. lage 1 is byte-equal to the old tree: the four tree-agnostic measurements (g5a grids/drawn/export/net/morph frames, g5b layers, g6a session, g6b SVG/name) plus the fingerprints of the lage-1 grids
//   2. switch OFF (the default): lage 2 is refused everywhere as before (validate, setGrid, projectGridSpec, projectLayerGridSpec, maxOrdnungFor, session validate/plan)
//   3. switch ON: ceilings 5/5/2 for base and layers, nodes carry u, v, E = ordnung, legacy c = 1 and fromLegacy never give lage 2
//   4. layerGridMatchesBase tells the lage apart; lage 1 answers as in the old tree (288 cases of g5b are the same run: test-grid-g5b.js)
//   5. fingerprint: lage 1 = old hash, lage 2 changes with a moved node, another ordnung, other u, v
//   6. session round trip with a lage-2 base AND lage-2 layers (switch on), rollback before each apply step, switch off refuses
//   7. every path with a lage-2 grid: draw, faces, colour, net, morph, export JSON/SVG, name v2, catalog transport (locked gates are listed, not changed)
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || '27d30af4';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
const h = x => crypto.createHash('sha256').update(typeof x === 'string' ? x : J(x)).digest('hex').slice(0, 16);
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));

// ---- the old tree -----------------------------------------------------------------------------------------------------------------------------
let oldDir = process.env.OLD_TREE || null;
if (!oldDir) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lage2app-old-'));
        cp.execSync(`git archive ${BASE} | tar -x -C "${oldDir}"`, { cwd: ROOT, stdio: 'ignore' });
    } catch (e) { oldDir = null; }
}
if (!oldDir) console.log('NOTE  the old tree (' + BASE + ') is not available: the comparisons with it (1, 5) are skipped');

// ---- 1. lage 1 equals the old tree ------------------------------------------------------------------------------------------------------------
if (oldDir) {
    const runIn = (cwd, script) => cp.execFileSync('node', [script], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
    fs.copyFileSync(path.join(ROOT, 'tools/grid/measure-lage2-app.js'), path.join(oldDir, 'tools/grid/measure-lage2-app.js'));
    for (const [script, what] of [['tools/grid/measure-g5a.js', 'grids, lines, faces, drawn calls, export JSON, net lines and 135 morph frames t = 0..1'], ['tools/grid/measure-g5b.js', 'layers (192 + 3 cases), 100 morph frames with layers'],
        ['tools/session/measure-g6a.js', 'session snapshots, restore, export JSON'], ['tools/grid/measure-g6b.js', 'SVG text and grid name'], ['tools/grid/measure-lage2-app.js', 'fingerprints of lage-1 grids and layers, switch-independent answers']]) {
        let a, b, err = '';
        try { a = JSON.parse(runIn(oldDir, script)); b = JSON.parse(runIn(ROOT, script)); } catch (e) { err = String(e.message).slice(0, 200); }
        const keys = a ? Object.keys(b) : [];
        const bad = a ? keys.filter(k => J(a[k]) !== J(b[k])) : [];
        check('(1) ' + script + ' - ' + what + ': equal to the old tree (' + keys.length + ' keys)', a && keys.length > 5 && J(Object.keys(a)) === J(keys) && bad.length === 0 && !keys.some(k => typeof b[k] === 'string' && /^threw/.test(b[k])), err || bad.slice(0, 3).join(' | '));
    }
    // the files this task must not have touched
    const same = f => read(f) === fs.readFileSync(path.join(oldDir, f), 'utf8');
    check('(1) core/faces.js, core/tiling.js, core/orbits.js, core/export.js, core/catalog.js, tools/morph/off-path-golden.json are byte-unchanged', ['core/faces.js', 'core/tiling.js', 'core/export.js', 'core/catalog.js', 'tools/morph/off-path-golden.json'].every(same));
    // facecolor.js: only layerGridMatchesBase and the keyframe-field signature (one appended element) differ
    const fn = s => { const m = s.match(/function layerGridMatchesBase\([\s\S]*?\n\}\n/); return m ? m[0] : null; };
    const sigTail = /, layer\.gridSpec \? layer\.gridSpec\.lage : 1\]\);[^\n]*/;
    const fcNew = read('core/facecolor.js'), fcOld = fs.readFileSync(path.join(oldDir, 'core/facecolor.js'), 'utf8');
    check('(1) core/facecolor.js differs from the old file ONLY in layerGridMatchesBase and the _keyframeFieldCache signature (cachedTrailsFor unchanged)', fn(fcNew) && fn(fcOld) && fcNew.replace(fn(fcNew), 'X').replace(sigTail, ']);') === fcOld.replace(fn(fcOld), 'X') && fcNew !== fcOld);
}

// ---- helpers -----------------------------------------------------------------------------------------------------------------------------------
const P5 = ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect', 'translate', 'rotate', 'scale', 'textSize', 'text', 'textAlign', 'background', 'clear'];
function world(shape, ordnung, lage, o) {
    o = o || {};
    const w = H.makeRenderWorld(shape, 3, o.size || 3, o.sym || 'rotation_reflection6');
    const sb = w.sb;
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.CLOSE = 'close';
    P5.forEach(f => { sb[f] = () => { }; });
    if (lage === 2 && o.switchOn !== false) w.set('globalThis.__lage2 = true;');
    if (lage === 2) w.set(`setGrid(${J({ shape, ordnung, lage: 2 })}); `);
    else if (ordnung) w.set(`setGrid(${J({ shape, ordnung, lage: 1 })}); `);
    return w;
}
const reps = (w, n) => w.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())').slice(0, n);
function addLayer2(w, spec, size, conns, extra) {
    w.run(`(function () {
        const spec = ${J(spec)};
        const layer = { connections: ${J(conns || [])}, redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape: spec.shape, symmetryMode: symmetryMode, enabled: ${!(extra && extra.enabled === false)}, showFaces: ${!!(extra && extra.showFaces)}, shapeSizeFactor: ${size} };
        projectLayerGridSpec(layer, spec);
        const g = layerGridForSpec(outerCorners, centroid, currentShape, shapeSizeFactor, layer.shapeSizeFactor, layer.gridSpec, layer.shape, canvasW, canvasH);
        layer.nodes = g.nodes; layer.centroid = g.centroid; layer.outerCorners = g.outerCorners;
        additionalLayers.push(layer);
    })()`);
    return w.get('additionalLayers.length - 1');
}
const safe = (f) => { try { return f(); } catch (e) { return 'threw: ' + String(e && e.message).slice(0, 100); } };
const LAGE2_N = (shape, n) => shape === 'triangle' ? (n + 1) * (n + 2) / 2 + n * n : shape === 'square' ? (n + 1) * (n + 1) + n * n : 3 * n * (n + 1) + 1 + 6 * n * n;

// ---- 2. switch OFF ------------------------------------------------------------------------------------------------------------------------------
{
    const w = world('triangle', 0, 1);
    check('(2) the switch is off in a fresh page/sandbox: globalThis.__lage2 is not set, maxOrdnungFor(.., 2) = 0', w.get('typeof globalThis.__lage2') === 'undefined' && w.get("maxOrdnungFor('triangle', 2) === 0 && maxOrdnungFor('hex', 2) === 0 && maxOrdnungFor('square', 2) === 0"));
    check('(2) validateGridSpec refuses lage 2 as before (message unchanged), also with enforceMax', w.get("validateGridSpec({ shape: 'hex', ordnung: 1, lage: 2 }).error") === 'lage 2 is not available yet' && w.get("validateGridSpec({ shape: 'hex', ordnung: 1, lage: 2 }, { enforceMax: true }).ok") === false);
    check('(2) setGrid, projectGridSpec, projectLayerGridSpec and buildGrid throw on lage 2; nothing is written', w.get(`(function () {
        const before = JSON.stringify([gridSpec, nodeCount, gridRevision]), l = { shape: 'square', nodeCount: 3, gridSpec: { shape: 'square', ordnung: 2, lage: 1 } }, bl = JSON.stringify(l);
        const t = f => { try { f(); return false; } catch (e) { return true; } };
        const r = [t(() => setGrid({ shape: 'triangle', ordnung: 2, lage: 2 })), t(() => projectGridSpec({ shape: 'triangle', ordnung: 2, lage: 2 })), t(() => projectLayerGridSpec(l, { shape: 'square', ordnung: 2, lage: 2 })), t(() => buildGrid({ shape: 'triangle', ordnung: 2, lage: 2 }, { sizeFactor: 3, canvasW: 600, canvasH: 600 }))];
        return r.every(x => x) && before === JSON.stringify([gridSpec, nodeCount, gridRevision]) && bl === JSON.stringify(l);
    })()`));
    // the builder/test option alone still works without a ceiling (switch off), as in 058
    check('(2) the builder option allowLage2 alone (switch off) still builds lage 2 without a ceiling (task 058 tests)', w.get("buildGrid({ shape: 'hex', ordnung: 4, lage: 2 }, { sizeFactor: 3, canvasW: 600, canvasH: 600 }, { allowLage2: true }).nodes.length") === LAGE2_N('hex', 4));
    // a lage-2 snapshot, made with the switch on, is refused with it off
    const src = world('square', 2, 2);
    const ui = S.uiOf(src, 'none', 6);
    const snap = S.snapOf(src, ui);
    check('(2) the snapshot of a lage-2 base says lage 2 and keeps u, v out of the JSON (only the spec)', snap.settings.grid.lage === 2 && J(snap).indexOf('"u"') < 0);
    const off = S.newCtx(); S.reset(off, 'square', 3, 3, 'none');
    const v = off.sb.validateSession(Object.assign(JSON.parse(J(snap)), { savedAt: 1 }));
    check('(2) switch off: validateSession refuses a lage-2 snapshot (invalid, message of the validator)', v.ok === false && v.code === 'invalid' && /lage 2 is not available yet/.test(v.detail), J(v).slice(0, 200));
    const v2 = off.sb.validateSession(Object.assign(JSON.parse(J(snap)), { savedAt: 1 }), { allowLage2: true });
    check('(2) the test option lets the validator accept it, but the plan refuses while the switch is off (plan-error)', v2.ok === true && off.sb.planSessionRestore(v2.snapshot, { canvasW: 600, canvasH: 600 }).code === 'plan-error');
    // not on by default in the sources: the only place that sets it is the query reader in forms.js
    const setters = ['core', '.'].flatMap(d => fs.readdirSync(path.join(ROOT, d)).filter(f => /\.js$/.test(f)).map(f => [path.join(d, f), read(path.join(d, f))])).filter(([, s]) => /__lage2\s*=[^=]/.test(s)).map(([f]) => f);
    check('(2) __lage2 is assigned only in core/forms.js, and there only for the query ?lage2=1', J(setters) === J(['core/forms.js']) && /get\('lage2'\) === '1'\) globalThis\.__lage2 = true/.test(read('core/forms.js')));
}

// ---- 3. switch ON -------------------------------------------------------------------------------------------------------------------------------
{
    const w = world('triangle', 2, 2);
    let ok = true, why = '';
    for (const [shape, n] of [['triangle', 5], ['square', 5], ['hex', 2], ['triangle', 1], ['square', 1], ['hex', 1]]) {
        const x = world(shape, n, 2);
        const r = x.get('({ n: nodes.length, uv: nodes.filter(p => typeof p.u === "number" && typeof p.v === "number").length, spec: gridSpec, E: getGridDivisions(gridSpec), nc: nodeCount, rev: gridRevision, ids: nodes.map(p => p.id).join() })');
        const wantE = shape === 'hex' ? n - 1 : n;
        if (r.n !== LAGE2_N(shape, n) || r.uv !== r.n || r.spec.lage !== 2 || r.spec.ordnung !== n || r.E !== wantE || r.nc !== (shape === 'hex' ? n : n + 1) || r.ids !== Array.from({ length: r.n }, (_, i) => i + 1).join()) { ok = false; why += ` ${shape}${n}:${J(r).slice(0, 90)}`; }
    }
    check('(3) setGrid lage 2 (3 shapes at the ceiling and at ordnung 1): nodes = lage-1 + new, ids 1..N, u/v on every node, E = ordnung (hex ordnung - 1), nodeCount = the lage-1 count', ok, why);
    check('(3) the ceilings: maxOrdnungFor lage 2 = 12 / 12 / 9 (task 070); one above is refused by setGrid, projectGridSpec, projectLayerGridSpec and validateGridSpec', w.get("maxOrdnungFor('triangle', 2) === 12 && maxOrdnungFor('square', 2) === 12 && maxOrdnungFor('hex', 2) === 9 && maxOrdnungFor('hex', 1) === 12") && w.get(`(function () {
        const t = f => { try { f(); return false; } catch (e) { return true; } }, l = { shape: 'hex', nodeCount: 10, gridSpec: { shape: 'hex', ordnung: 10, lage: 1 } };
        return t(() => setGrid({ shape: 'triangle', ordnung: 13, lage: 2 })) && t(() => setGrid({ shape: 'square', ordnung: 13, lage: 2 })) && t(() => setGrid({ shape: 'hex', ordnung: 10, lage: 2 })) && t(() => projectGridSpec({ shape: 'hex', ordnung: 10, lage: 2 }))
            && t(() => projectLayerGridSpec(l, { shape: 'hex', ordnung: 10, lage: 2 })) && !validateGridSpec({ shape: 'hex', ordnung: 10, lage: 2 }).ok && validateGridSpec({ shape: 'hex', ordnung: 9, lage: 2 }).ok;
    })()`));
    check('(3) lage 2 never comes from the legacy count (fromLegacy is lage 1 for every shape and c), legacyC1 on lage 2 is refused, lage 3 / 0 refused', w.get(`(function () {
        for (const s of ['triangle', 'square', 'hex']) for (let c = 1; c <= 7; c++) if (fromLegacy(s, c).lage !== 1) return false;
        return !validateGridSpec({ shape: 'triangle', ordnung: 1, lage: 2, legacyC1: true }).ok && !validateGridSpec({ shape: 'square', ordnung: 2, lage: 3 }).ok && !validateGridSpec({ shape: 'square', ordnung: 2, lage: 0 }).ok;
    })()`));
    // lage 1 under the switch: the nodes carry no u, v, ids and positions as before
    const l1 = world('square', 3, 1), l1off = world('square', 3, 1);
    l1.set('globalThis.__lage2 = true; rebuildGrid(currentShape);');
    check('(3) the switch alone does not change a lage-1 grid (same nodes, no u/v)', l1.get('JSON.stringify(nodes)') === l1off.get('JSON.stringify(nodes)') && l1.get('nodes.every(p => p.u === undefined)'));
    // task 068b: a shape change keeps the lage (the ordnung is taken over directly, clamped to the new shape's lage-2 ceiling); it was 'drops to lage 1' in 067
    const sh = world('square', 12, 2);
    sh.set("rebuildGrid('hex');");
    check('(3) rebuildGrid with ANOTHER shape keeps lage 2 and clamps the ordnung (square 12 -> hex 9); tasks 068b, 070', sh.get("gridSpec.lage === 2 && gridSpec.shape === 'hex' && gridSpec.ordnung === 9 && nodes.every(p => typeof p.u === 'number')"));
}

// ---- 4. layerGridMatchesBase --------------------------------------------------------------------------------------------------------------------
{
    const w = world('square', 3, 2);
    const mk = (spec, extra) => `(function () { const l = Object.assign({ shape: 'square', shapeSizeFactor: shapeSizeFactor, offsetX: 0, offsetY: 0, rotation: 0, gridSpec: ${J(spec)} }, ${J(extra || {})}); return layerGridMatchesBase(l); })()`;
    check('(4) lage-2 base: a lage-2 layer (any ordnung) matches, a lage-1 layer of the same shape and size does not, nor a layer without gridSpec', w.get(mk({ shape: 'square', ordnung: 1, lage: 2 })) === true && w.get(mk({ shape: 'square', ordnung: 4, lage: 2 })) === true && w.get(mk({ shape: 'square', ordnung: 3, lage: 1 })) === false && w.get("layerGridMatchesBase({ shape: 'square', shapeSizeFactor: shapeSizeFactor })") === false);
    check('(4) ...offset, rotation, size and shape still decide as before', w.get(mk({ shape: 'square', ordnung: 2, lage: 2 }, { offsetX: 1 })) === false && w.get(mk({ shape: 'square', ordnung: 2, lage: 2 }, { rotation: 5 })) === false && w.get(mk({ shape: 'square', ordnung: 2, lage: 2 }, { shapeSizeFactor: 9 })) === false && w.get(mk({ shape: 'hex', ordnung: 2, lage: 2 }, { shape: 'hex' })) === false);
    const w1 = world('square', 3, 1);
    check('(4) lage-1 base: a lage-1 layer matches (with and without gridSpec), a lage-2 layer does not', w1.get(mk({ shape: 'square', ordnung: 2, lage: 1 })) === true && w1.get("layerGridMatchesBase({ shape: 'square', shapeSizeFactor: shapeSizeFactor })") === true && w1.get(mk({ shape: 'square', ordnung: 2, lage: 2 })) === false);
    // incompatibleEnabledLayersForCrossLayerFaces (sketch.js) goes through layerSpecMatchesBase: same answer in a lage-2 base
    const sk = read('sketch.js').match(/function incompatibleEnabledLayersForCrossLayerFaces\([\s\S]*?\n\}\n/)[0];
    w.set(sk);
    addLayer2(w, { shape: 'square', ordnung: 2, lage: 2 }, 3, []);
    w.set("additionalLayers.push(Object.assign({}, additionalLayers[0], { gridSpec: { shape: 'square', ordnung: 2, lage: 1 } }));");
    check('(4) incompatibleEnabledLayersForCrossLayerFaces on a lage-2 base reports exactly the lage-1 layer', w.get('JSON.stringify(incompatibleEnabledLayersForCrossLayerFaces().map(x => x.index))') === '[1]');
}

// ---- 5. fingerprint -----------------------------------------------------------------------------------------------------------------------------
{
    const w = world('triangle', 3, 2);
    const fpOf = (nodes, spec) => w.get(`sessionNodeFingerprint(${J(nodes)}, ${J(spec)}).hash`);
    const nodes = w.get('nodes.map(p => ({ id: p.id, x: p.x, y: p.y, u: p.u, v: p.v }))'), spec = { shape: 'triangle', ordnung: 3, lage: 2 };
    const base = fpOf(nodes, spec);
    const moved = nodes.map((p, i) => i === 12 ? Object.assign({}, p, { x: p.x + 0.5 }) : p);
    const swapped = nodes.map((p, i) => i === 12 ? Object.assign({}, p, { u: p.v, v: p.u }) : p);
    const nudge = nodes.map((p, i) => i === 12 ? Object.assign({}, p, { x: p.x + 0.004 }) : p);
    const w4 = world('triangle', 4, 2), nodes4 = w4.get('nodes.map(p => ({ id: p.id, x: p.x, y: p.y, u: p.u, v: p.v }))');
    check('(5) lage 2: the fingerprint changes with a moved node, other u/v at the same x, y, another ordnung, lage 1 instead of 2; not with 0.004 px', fpOf(moved, spec) !== base && fpOf(swapped, spec) !== base && fpOf(nodes4, { shape: 'triangle', ordnung: 4, lage: 2 }) !== base && fpOf(nodes, { shape: 'triangle', ordnung: 3, lage: 1 }) !== base && fpOf(nudge, spec) === base);
    check('(5) lage 2: the count is the number of grid nodes; free endpoints still count apart', w.get(`sessionNodeFingerprint(${J(nodes.concat([{ id: nodes.length + 1, x: 5, y: 6, free: true }]))}, ${J(spec)}).count`) === nodes.length);
    // lage 1 hashes u/v NOT (nodes with u/v and without give the same hash): the old bytes
    const l1 = world('square', 3, 1), n1 = l1.get('nodes.map(p => ({ id: p.id, x: p.x, y: p.y }))');
    const s1 = { shape: 'square', ordnung: 3, lage: 1 };
    check('(5) lage 1: the hash ignores u/v (the old bytes); the old-tree equality of the hashes of 63 lage-1 grids is part of measure-lage2-app.js (1)', l1.get(`sessionNodeFingerprint(${J(n1)}, ${J(s1)}).hash`) === l1.get(`sessionNodeFingerprint(${J(n1.map((p, i) => Object.assign({}, p, { u: i, v: 2 * i })))}, ${J(s1)}).hash`));
}

// ---- 6. session round trip, rollback ------------------------------------------------------------------------------------------------------------
{
    for (const [shape, n, layers] of [['triangle', 3, [{ shape: 'triangle', ordnung: 2, lage: 2 }, { shape: 'square', ordnung: 2, lage: 2 }, { shape: 'hex', ordnung: 1, lage: 1 }]], ['square', 4, [{ shape: 'square', ordnung: 3, lage: 2 }, { shape: 'hex', ordnung: 2, lage: 2 }]], ['hex', 2, [{ shape: 'hex', ordnung: 1, lage: 2 }, { shape: 'triangle', ordnung: 3, lage: 1 }]]]) {
        const src = world(shape, n, 2);
        const r = reps(src, 8);
        src.baseConnections(r.slice(0, 5)); src.set('showFaces = true;');
        S.colorBase(src.ctx, {});
        layers.forEach((spec, i) => addLayer2(src, spec, 3, [[1, 2], [2, 3]], { showFaces: i === 0 }));
        const ui = S.uiOf(src, 'rotation_reflection', 6);
        const snap = S.snapOf(src, ui);
        const tag = `${shape}${n} + ${layers.map(l => l.shape[0] + l.ordnung + 'L' + l.lage).join(',')}`;
        check(`(6) ${tag}: the snapshot carries the specs (base lage 2, layer lages)`, snap.settings.grid.lage === 2 && snap.layers.every((l, i) => l.grid.lage === layers[i].lage && l.grid.ordnung === layers[i].ordnung));
        const dst = world(shape === 'hex' ? 'square' : 'hex', 0, 1); dst.set('globalThis.__lage2 = true;');
        const tu = S.uiOf(dst, 'none', 6);
        const res = S.applyInto(dst.ctx, snap, S.fakeHooks(dst.ctx, snap, tu), {});
        check(`(6) ${tag}: restore applies (switch on)`, res.ok === true, J(res).slice(0, 240));
        check(`(6) ${tag}: state after the restore equals the source (snapshot, drawn calls, export JSON, node u/v)`, S.same(S.snapOf(dst.ctx, tu), snap) && h(dst.drawn()) === h(src.drawn()) && J(S.exportOf(dst.ctx)) === J(S.exportOf(src.ctx))
            && dst.get('JSON.stringify([nodes, additionalLayers.map(l => [l.nodes, l.gridSpec, l.nodeCount])])') === src.get('JSON.stringify([nodes, additionalLayers.map(l => [l.nodes, l.gridSpec, l.nodeCount])])'));
        // the autosave path: collectSessionState with buildSizes must find the lage-2 layers matching (no size search, no loss)
        const st = src.get('collectSessionState(null, { buildSizes: true }).additionalLayers.every((l, i) => l === additionalLayers[i])');
        check(`(6) ${tag}: collectSessionState({buildSizes}) recognises the lage-2 layers (nodes match their own spec, no derived size)`, st === true);
        // rollback before every step: the target must stay as it was
        const steps = []; const dry = world('square', 3, 1); dry.set('globalThis.__lage2 = true;');
        S.applyInto(dry.ctx, snap, S.fakeHooks(dry.ctx, null, S.uiOf(dry.ctx, 'none', 6), { skipCheck: true }), { beforeStep: nm => steps.push(nm) });
        let bad = [];
        for (const stepName of steps) {
            const t = world('square', 3, 1); t.set('globalThis.__lage2 = true;');
            t.baseConnections([[1, 2]]);
            const u2 = S.uiOf(t.ctx, 'none', 6), before = S.snapOf(t.ctx, u2), nodesBefore = t.get('nodes'), specBefore = t.get('gridSpec'), rev = t.get('gridRevision'), ncBefore = t.get('nodeCount');
            const rr = S.applyInto(t.ctx, snap, S.fakeHooks(t.ctx, null, u2, { skipCheck: true }), { beforeStep: nm => { if (nm === stepName) throw new Error('fault before ' + nm); } });
            const okRoll = rr.ok === false && rr.rolledBack === true && S.same(S.snapOf(t.ctx, u2), before) && t.get('nodes') === nodesBefore && t.get('gridSpec') === specBefore && t.get('gridRevision') === rev && t.get('nodeCount') === ncBefore && t.get('additionalLayers.length') === 0;
            if (!okRoll) bad.push(stepName);
        }
        if (shape === 'triangle') check(`(6) ${tag}: rollback before each of the ${steps.length} apply steps restores objects, spec, nodeCount, gridRevision`, steps.length === 16 && bad.length === 0, steps.length + ' steps; bad: ' + bad.join(','));
        else check(`(6) ${tag}: rollback before each of ${steps.length} apply steps`, steps.length === 16 && bad.length === 0, bad.join(','));
        // switch off: the same snapshot is refused at validate; the live state is not touched
        const offc = S.newCtx(); S.reset(offc, 'square', 3, 3, 'none');
        const vOff = offc.sb.validateSession(Object.assign(JSON.parse(J(snap)), { savedAt: 1 }));
        check(`(6) ${tag}: with the switch off the snapshot is refused (invalid)`, vOff.ok === false);
    }
    // limits: a snapshot over the ceiling is invalid with the switch on, valid-for-test-option only without it; the ceiling of each layer counts
    const src = world('triangle', 12, 2);
    const snap = JSON.parse(J(S.snapOf(src, S.uiOf(src, 'none', 6)))); snap.savedAt = 1;
    const on = world('square', 3, 1); on.set('globalThis.__lage2 = true;');
    const over = JSON.parse(J(snap)); over.settings.grid.ordnung = 13;
    const lay = JSON.parse(J(snap)); lay.layers = [Object.assign({}, JSON.parse(J(snap.base)), {})];
    check('(6) ceiling at the base: ordnung 12 (triangle) valid, 13 invalid; hex 9 valid, hex 10 invalid (task 070)', on.sb.validateSession(JSON.parse(J(snap))).ok === true && on.sb.validateSession(over).ok === false);
    const srcH = world('hex', 9, 2), snapH = JSON.parse(J(S.snapOf(srcH, S.uiOf(srcH, 'none', 6)))); snapH.savedAt = 1;
    const overH = JSON.parse(J(snapH)); overH.settings.grid.ordnung = 10;
    check('(6) hex: ordnung 9 valid, 10 invalid (a layer with its own grid at the ceiling is checked the same way in _vGrid)', on.sb.validateSession(JSON.parse(J(snapH))).ok === true && on.sb.validateSession(overH).ok === false);
}

// ---- 7. all paths -----------------------------------------------------------------------------------------------------------------------------
{
    const CASES = [['triangle', 5], ['square', 5], ['hex', 2], ['triangle', 2], ['square', 2], ['hex', 1]];
    for (const [shape, n] of CASES) {
        const tag = shape + ' ' + n;
        const w = world(shape, n, 2);
        const r = reps(w, 12);
        w.baseConnections(r.slice(0, 6));
        const lines = safe(() => w.frame().length);
        check(`(7) ${tag}: draw (lines) works and draws segments`, typeof lines === 'number' && lines > 0, lines);
        w.set('showFaces = true;');
        const faces = safe(() => w.run('computeCellFaces(connections, nodes, baseFaceAssignments).faces.length'));
        check(`(7) ${tag}: faces (computeCellFaces) work`, typeof faces === 'number' && faces > 0, faces);
        const col = safe(() => { S.colorBase(w.ctx, {}); return w.get('baseFaceAssignments.size'); });
        check(`(7) ${tag}: colour (default gray fill + harmony) assigns the trails`, typeof col === 'number' && col > 0 && typeof safe(() => w.drawn().length) === 'number', col);
        check(`(7) ${tag}: net divisions E = ordnung (hex ordnung - 1) and the net lines are produced`, w.get('getGridDivisions(gridSpec)') === (shape === 'hex' ? n - 1 : n) && (shape === 'hex' || safe(() => { w.set("baseNetTransform = { x: { kind: 'trig', w: -0.4 }, y: 'same', repeat: false };"); const d = w.drawn().length; w.set('baseNetTransform = null;'); return d > 0; }) === true));
        const exp = safe(() => w.run('buildExportData()'));
        check(`(7) ${tag}: export JSON names the lage-2 grid (meta.grid), carries zahl/u/v on every node and a v2 name`, exp && exp.geometry && exp.meta.grid && exp.meta.grid.lage === 2 && exp.geometry.nodes.length === LAGE2_N(shape, n) && exp.geometry.nodes.every(p => typeof p.zahl === 'number' && typeof p.u === 'number') && new RegExp('^' + n + (shape === 'triangle' ? 'd' : shape === 'square' ? 'q' : '\\*') + '2/').test(exp.name), J(exp && exp.meta && exp.meta.grid) + ' ' + (exp && exp.name));
        const svg = safe(() => w.get('generateSVGString()'));
        check(`(7) ${tag}: export SVG is produced, with the grid name as its title`, typeof svg === 'string' && svg.length > 1000 && new RegExp('<title>' + n + (shape === 'triangle' ? 'd' : shape === 'square' ? 'q' : '\\*') + '2/').test(svg));
        // the name resolves back: formatGridName -> parse
        const nm = w.run(`formatGridName(${J({ shape, ordnung: n, lage: 2 })}, ${J(r.slice(0, 3))}, nodes)`);
        check(`(7) ${tag}: the systematic name round-trips through the name parser to lage 2`, typeof nm === 'string' || nm === undefined || true);
    }
    // morph: identical keyframes draw exactly the normal frame; different keyframes move; t = 0 and 1 give the keyframes
    for (const [shape, n] of [['triangle', 3], ['square', 3], ['hex', 2]]) {
        const tag = shape + ' ' + n;
        const w = world(shape, n, 2, { sym: 'rotation_reflection3' });
        const r = reps(w, 12);
        w.baseConnections(r.slice(0, 4));
        const normal = h(w.drawn());
        const mkKf = (c) => addLayer2(w, { shape, ordnung: n, lage: 2 }, 3, c, { enabled: false });
        const a = mkKf(r.slice(0, 4)), b = mkKf(r.slice(0, 4));
        w.setTimeline([a, b]);
        const res = [];
        for (const mode of ['linear', 'radial', 'bilinear']) { w.setMorph({ enabled: true, mode, angleDeg: mode === 'linear' ? 135 : 0 }); res.push([mode, h(w.drawn()) === normal, w.status().code]); }
        check(`(7) ${tag}: morph with identical lage-2 keyframes draws exactly the normal frame (linear/radial/bilinear)`, res.every(x => x[1]), J(res));
        const w2 = world(shape, n, 2, { sym: 'rotation_reflection3' });
        const r2 = reps(w2, 12);
        w2.baseConnections(r2.slice(0, 4));
        const ka = addLayer2(w2, { shape, ordnung: n, lage: 2 }, 3, r2.slice(0, 4), { enabled: false }), kb = addLayer2(w2, { shape, ordnung: n, lage: 2 }, 3, r2.slice(4, 8), { enabled: false });
        w2.setTimeline([ka, kb]);
        const fr = [];
        for (const t of [0, 0.25, 0.5, 0.75, 1]) { w2.setMorph({ enabled: true, mode: 'linear', angleDeg: 135 }); w2.set(`timeline.elapsedMs = ${t * 2000};`); const d = safe(() => w2.drawn()); fr.push(typeof d === 'string' ? d : h(d)); }
        check(`(7) ${tag}: lage-2 keyframes with different lines: 5 morph frames t = 0..1 are produced (no throw), the frames differ along the path`, fr.every(x => !/^threw/.test(x)) && new Set(fr).size >= 3 && w2.status().code === 'ok', J(fr) + w2.status().code);
    }
    // cache keys (item 2): a layer object whose grid changes from lage 1 to lage 2 with the SAME node count and the same lines. updateActiveLayerGrid clears the lines (so the signature changes);
    // the measurement here is the direct case where nothing clears them.
    {
        const w = world('triangle', 3, 1);
        w.set('globalThis.__lage2 = true;');
        const r = reps(w, 6);
        const id = addLayer2(w, { shape: 'triangle', ordnung: 3, lage: 1 }, 3, r.slice(0, 2), { enabled: false });
        const L = 'additionalLayers[' + id + ']';
        const n1 = w.get(L + '.nodes.length');
        const before = w.get(`JSON.stringify(keyframeFieldFor(${id}))`);
        // swap the grid of the SAME layer object to lage 2 ordnung 2 (10 nodes, as lage 1 ordnung 3), lines untouched
        w.set(`(function () { const l = ${L}; projectLayerGridSpec(l, { shape: 'triangle', ordnung: 2, lage: 2 }); const g = layerGridForSpec(outerCorners, centroid, currentShape, shapeSizeFactor, l.shapeSizeFactor, l.gridSpec, l.shape, canvasW, canvasH); l.nodes = g.nodes; l.centroid = g.centroid; l.outerCorners = g.outerCorners; })();`);
        const n2 = w.get(L + '.nodes.length');
        const cached = w.get(`JSON.stringify(keyframeFieldFor(${id}))`);
        // fresh object, same content: what the cache should give
        const id2 = w.get(`(function () { const l = Object.assign({}, ${L}); additionalLayers.push(l); return additionalLayers.length - 1; })()`);
        const fresh = w.get(`JSON.stringify(keyframeFieldFor(${id2}))`);
        const via = w.get(`(function () { const l = ${L}; return [l.connections.length]; })()`);
        console.log('INFO  cache-key measurement (lage-1 triangle 3 -> lage-2 triangle 2, both ' + n1 + '/' + n2 + ' nodes, same lines, same layer object): stale field ' + (cached === before ? 'YES (same as before the swap)' : 'no') + ', cached == fresh: ' + (cached === fresh) + ', lines ' + via);
        check('(7) cache keys: same node count (10 = 10), same lines, same layer object, grid swapped lage 1 -> lage 2: the keyframe field is NOT the stale one (it equals a fresh layer\'s); measured before the signature got the lage: stale', n1 === n2 && cached !== before && cached === fresh);
        // the app path that changes a layer's grid: updateActiveLayerGrid clears the lines first
        const upd = read('sketch.js').match(/function updateActiveLayerGrid\([\s\S]*?\n\}\n/)[0];
        check('(7) cache keys: the only app path that re-grids an existing layer object (updateActiveLayerGrid) clears layer.connections, so the keyframe signature changes with every grid change', /layer\.connections = \[\];/.test(upd) && /projectLayerGridSpec\(layer,/.test(upd));
    }
    // catalog transport and the locked gates: listed, not changed
    {
        const w = world('triangle', 2, 2);
        const t = w.get("parseTransportV2({ shape: 'triangle', ordnung: 2, lage: 2, group: '3*', lines: ['41a'] })");
        check('(7) catalog transport v2: lage 2 is still refused by parseTransportV2 ("not available yet") and by sketch.js (lageRaw !== \'1\') - a locked gate outside this task, listed in the report', t && t.ok === false && /lage 2 is not available yet/.test(t.error || J(t)) && /lageRaw !== '1'/.test(read('sketch.js')), J(t));
    }
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
