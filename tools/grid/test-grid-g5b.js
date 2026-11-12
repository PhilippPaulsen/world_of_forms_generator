// G5b (task 061): every layer carries its OWN GridSpec (layer.gridSpec); layer.nodeCount is only its projection (core/forms.js projectLayerGridSpec).
//   node tools/grid/test-grid-g5b.js     BASE = the commit before 061 (default 0342061c); OLD_TREE = a directory with that tree already extracted (sabotage copies have no .git)
//   1. old tree vs working tree, tools/grid/measure-g5b.js: layer geometry, drawn calls, segments, export JSON, alt net, morph frames with layers under a net: equal
//   2. source scan: exactly ONE write of a member `.nodeCount` (core/forms.js), no nodeCount key in the layer literals (addLayer, addLayerToTimeline, session restore)
//   3. updateActiveLayerGrid (old and new text, same inputs): same layers, same clamp report; layer.gridSpec and nodeCount agree
//   4. layerSpecMatchesBase tells shape and lage apart (lage 2 through allowLage2), not ordnung; layerGridMatchesBase (core/facecolor.js) is byte-unchanged and behaves as before;
//      incompatibleEnabledLayersForCrossLayerFaces equals the old one on every lage-1 case
//   5. projectLayerGridSpec validates before writing; layer E equals the old c - 1
//   6. session round trip with layers and a timeline, rollback at every step
//   7. corner-field cache signature: same geometry -> same signature and colours, another spec -> another signature
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || '0342061c';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });

let oldDir = process.env.OLD_TREE || null;
if (!oldDir) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g5b-old-'));
        cp.execSync(`git archive ${BASE} | tar -x -C "${oldDir}"`, { cwd: ROOT, stdio: 'ignore' });
    } catch (e) { oldDir = null; }
}
const oldRead = f => fs.readFileSync(path.join(oldDir, f), 'utf8');
if (!oldDir) console.log('NOTE  the old tree (' + BASE + ') is not available: the comparisons against it (1, 3, 4) are skipped');

// ---- 1. behaviour against the old tree -----------------------------------------------------------------------------------------------------
if (oldDir) {
    fs.copyFileSync(path.join(ROOT, 'tools/grid/measure-g5b.js'), path.join(oldDir, 'tools/grid/measure-g5b.js'));
    const run = cwd => JSON.parse(cp.execFileSync('node', ['tools/grid/measure-g5b.js'], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 }));
    const o = run(oldDir), n = run(ROOT), keys = Object.keys(n);
    const diff = ks => ks.filter(k => J(o[k]) !== J(n[k]));
    const lay = keys.filter(k => k.startsWith('layers/')), alt = keys.filter(k => k.startsWith('altnet/')), mor = keys.filter(k => k.startsWith('morph/'));
    check('(0) the measurement ran: nothing threw, same keys in both trees', keys.every(k => typeof n[k] !== 'string') && J(Object.keys(o)) === J(keys));
    check('(1) layer geometry, drawn calls, segments and export JSON equal the old tree (' + lay.length + ' cases: 3 base shapes x c 2/3 x layer shape x order 1..4 x size 3/5, with and without a square net)', lay.length === 192 && diff(lay).length === 0, diff(lay).slice(0, 3).join(' | '));
    check('(1) alt-net bases with layers equal the old tree (' + alt.length + ' cases)', alt.length === 3 && diff(alt).length === 0, diff(alt).slice(0, 3).join(' | '));
    check('(2) morph frames t = 0 .25 .5 .75 1 with keyframe layers of another order, with and without a net, equal the old tree (' + mor.length * 5 + ' frames)', mor.length === 20 && diff(mor).length === 0, diff(mor).slice(0, 3).join(' | '));
    const M = k => J(n['morph/square/' + k + '/linear']);
    check('(2) the controls are not vacuous: the net changes the morph frames, the layer order changes them, and a macro changes them only where E (the layer\'s own order) lets it: order 5 (E 4), not order 3 (E 2 = the default)', M('net/5') !== M('nonet/5') && M('net/3') !== M('net/5') && M('macro/5') !== M('net/5') && M('macro/3') === M('net/3'));
}

// ---- 2. one write of layer.nodeCount -------------------------------------------------------------------------------------------------------
{
    const files = [];
    const walk = (d, rx) => fs.readdirSync(path.join(ROOT, d)).forEach(f => { if (rx.test(f)) files.push(path.join(d, f)); });
    walk('core', /\.js$/); walk('.', /^(sketch|gallery|gallery-render|nav|ui[\w-]*)\.js$/);
    const writes = [];
    for (const f of files) read(f).split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        const re = /\.nodeCount\s*(=(?!=)|\+\+|--|\+=|-=|\*=|\/=)/g;
        if (re.test(code)) writes.push(f + ':' + (i + 1));
    });
    check('(3) exactly one write of a member `.nodeCount` in core/, sketch.js, ui*.js, gallery*.js: projectLayerGridSpec in core/forms.js', writes.length === 1 && /^core[\\/]forms\.js:/.test(writes[0]), writes.join(' | '));
    const body = (src, name) => { const m = src.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}\\n')); return m ? m[0].split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n') : ''; };
    const lit = /(^|[^.\w$])nodeCount\s*[:,]/;
    const sk = read('sketch.js'), sa = read('core/session-apply.js');
    check('(3) the layer literals of addLayer(), addLayerToTimeline() and the session restore carry no nodeCount key; each calls projectLayerGridSpec',
        body(sk, 'addLayer') && !lit.test(body(sk, 'addLayer')) && !lit.test(body(sk, 'addLayerToTimeline')) && !lit.test(body(sa, '_buildSessionObjects'))
        && /projectLayerGridSpec\(layer, fromLegacy\(currentShape, nodeCount\)\)/.test(body(sk, 'addLayer')) && /projectLayerGridSpec\(playbackLayer, /.test(body(sk, 'addLayerToTimeline')) && /projectLayerGridSpec\(layer, Object\.assign\(\{\}, l\.grid\)\)/.test(body(sa, '_buildSessionObjects')));
    check('(3) updateActiveLayerGrid takes the patch\'s nodeCount out of the Object.assign and writes the spec instead', /const \{ nodeCount: patchCount, \.\.\.patchRest \} = patch;\s*Object\.assign\(layer, patchRest\);/.test(sk) && /projectLayerGridSpec\(layer, fromLegacy\(layer\.shape, layerCount\)\)/.test(body(sk, 'updateActiveLayerGrid')));
}

// ---- helpers for sandboxes ------------------------------------------------------------------------------------------------------------------
const FILES = ['forms', 'state'];
const sandbox = (readFn, extra) => {
    const sb = { Math, console, Number, Object, Error, Map, JSON, Array, radians: x => x * Math.PI / 180, cos: Math.cos, sin: Math.sin };
    vm.createContext(sb);
    vm.runInContext(FILES.map(f => readFn('core/' + f + '.js')).join('\n') + (extra || ''), sb);
    return sb;
};
const grab = (src, name) => { const m = src.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };

// ---- 3. updateActiveLayerGrid: old text vs new text ------------------------------------------------------------------------------------------
if (oldDir) {
    const mk = (readFn) => { const sb = sandbox(readFn, '\n' + grab(readFn('sketch.js'), 'updateActiveLayerGrid')); vm.runInContext("currentShape = 'square'; shapeSizeFactor = 3; canvasW = 600; canvasH = 600; rebuildGrid('square'); additionalLayers = []; activeLayer = 0;", sb); return sb; };
    const O = mk(oldRead), N = mk(read);
    const mkLayer = (shape, c, newTree) => `(function(){ const L = { connections: [[1,2]], redoStack: [[3,4]], offsetX: 0, offsetY: 0, rotation: 0, shape: '${shape}', symmetryMode: 'none', enabled: true, showFaces: false, shapeSizeFactor: 3 }; ${newTree ? `projectLayerGridSpec(L, fromLegacy('${shape}', ${c}));` : `L.nodeCount = ${c};`} const g = layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, 3, L.nodeCount, L.shape, canvasW, canvasH); L.nodes = g.nodes; L.centroid = g.centroid; L.outerCorners = g.outerCorners; additionalLayers = [L]; })()`;
    const dump = sb => vm.runInContext('(function(){ const l = additionalLayers[0]; const o = Object.assign({}, l); delete o.gridSpec; return JSON.stringify(o); })()', sb);
    let n3 = 0, bad3 = [], badSpec = [];
    const patches = [{ nodeCount: 1 }, { nodeCount: 2 }, { nodeCount: 5 }, { nodeCount: 7 }, { nodeCount: 8 }, { nodeCount: 13 }, { nodeCount: 99 }, { shapeSizeFactor: 5 }, { shape: 'hex' }, { shape: 'triangle', nodeCount: 4 }, { shape: 'hex', nodeCount: 13 }, { shape: 'square', shapeSizeFactor: 7, nodeCount: 6 }, {}];
    for (const shape of ['triangle', 'square', 'hex']) for (const c of [1, 3, 6]) for (const p of patches) {
        vm.runInContext(mkLayer(shape, c, false), O); vm.runInContext(mkLayer(shape, c, true), N);
        const a = vm.runInContext('updateActiveLayerGrid(' + J(p) + ')', O), b = vm.runInContext('updateActiveLayerGrid(' + J(p) + ')', N);
        n3++;
        if (J(a) !== J(b) || dump(O) !== dump(N)) bad3.push(shape + c + J(p));
        const ok = vm.runInContext('(function(){ const l = additionalLayers[0]; return toLegacy(l.gridSpec) === l.nodeCount && l.gridSpec.shape === l.shape; })()', N);
        if (!ok) badSpec.push(shape + c + J(p));
    }
    check('(3) updateActiveLayerGrid: layers (geometry, connections, nodeCount, shape, size) and the clamp report equal the old text for ' + n3 + ' (layer x patch) cases, incl. clamps and shape switches', bad3.length === 0, bad3.slice(0, 3).join(' | '));
    check('(3) afterwards layer.gridSpec agrees with layer.nodeCount and layer.shape in every case', badSpec.length === 0, badSpec.slice(0, 3).join(' | '));
}

// ---- 4. the spec comparison, layerGridMatchesBase, incompatibleEnabledLayersForCrossLayerFaces ---------------------------------------------------
{
    const sb = sandbox(read);
    const sq = { shape: 'square', ordnung: 3, lage: 1 };
    const l2 = { shape: 'square', ordnung: 2, lage: 2 };
    check('(4) layerSpecMatchesBase: same shape and lage match, any ordnung (order is deliberately not compared)', sb.layerSpecMatchesBase(sq, { shape: 'square', ordnung: 1, lage: 1 }) === true && sb.layerSpecMatchesBase(sq, sq) === true);
    check('(4) ...another shape does not match', ['triangle', 'hex'].every(s => sb.layerSpecMatchesBase({ shape: s, ordnung: 3, lage: 1 }, sq) === false));
    check('(4) ...another lage does not match (a lage-2 spec built with allowLage2 in the builder, which setGrid/projectLayerGridSpec still refuse)',
        (() => { const g = sb.buildGrid(l2, { sizeFactor: 3, canvasW: 600, canvasH: 600 }, { allowLage2: true }); return g.grid.lage === 2 && sb.layerSpecMatchesBase(l2, sq) === false && sb.layerSpecMatchesBase(sq, l2) === false && sb.layerSpecMatchesBase(l2, { shape: 'square', ordnung: 5, lage: 2 }) === true; })());
    const fcNew = read('core/facecolor.js'), fcOld = oldDir ? oldRead('core/facecolor.js') : fcNew;
    // task 067: layerGridMatchesBase (lage) and the _keyframeFieldCache signature (lage) were changed on purpose; everything else (cachedTrailsFor included) is still byte-unchanged
    { const strip = s => s.replace(/function layerGridMatchesBase\([\s\S]*?\n\}\n/, 'X').replace(/, layer\.gridSpec \? layer\.gridSpec\.lage : 1\]\);[^\n]*/, ']);');
      check('(4) core/facecolor.js is byte-unchanged apart from layerGridMatchesBase and the keyframe-field signature (task 067)', strip(fcNew) === strip(fcOld)); }
    if (oldDir) {
        const mk = (readFn) => { const s2 = sandbox(readFn, '\n' + grab(readFn('core/facecolor.js'), 'layerGridMatchesBase') + '\n' + grab(readFn('sketch.js'), 'incompatibleEnabledLayersForCrossLayerFaces')); return s2; };
        const O = mk(oldRead), N = mk(read);
        let n = 0, bad = [];
        for (const baseShape of ['triangle', 'square', 'hex']) for (const lshape of ['triangle', 'square', 'hex']) for (const size of [3, 5]) for (const rot of [0, 30]) for (const off of [0, 12]) for (const en of [true, false]) for (const c of [1, 3]) {
            const set = `currentShape = '${baseShape}'; shapeSizeFactor = 3; additionalLayers = [{ shape: '${lshape}', nodeCount: ${c}, shapeSizeFactor: ${size}, rotation: ${rot}, offsetX: ${off}, offsetY: 0, enabled: ${en} }];`;
            const newSet = set.replace('additionalLayers = [{', 'additionalLayers = [{ gridSpec: fromLegacy(\'' + lshape + '\', ' + c + '),');
            vm.runInContext(set + `projectGridSpec(fromLegacy('${baseShape}', 2));`, O); vm.runInContext(newSet + `projectGridSpec(fromLegacy('${baseShape}', 2));`, N);
            const a = vm.runInContext('JSON.stringify([incompatibleEnabledLayersForCrossLayerFaces().map(x => x.index), layerGridMatchesBase(additionalLayers[0])])', O);
            const b = vm.runInContext('JSON.stringify([incompatibleEnabledLayersForCrossLayerFaces().map(x => x.index), layerGridMatchesBase(additionalLayers[0])])', N);
            n++; if (a !== b) bad.push(set.slice(0, 80));
        }
        check('(4) incompatibleEnabledLayersForCrossLayerFaces and layerGridMatchesBase give the old answer on all ' + n + ' lage-1 cases (shape, size, rotation, offset, enabled)', bad.length === 0, bad.slice(0, 2).join(' | '));
        // a layer whose own spec has another lage IS flagged now (it cannot be built yet, but the comparison must tell)
        vm.runInContext("currentShape = 'square'; shapeSizeFactor = 3; projectGridSpec(fromLegacy('square', 3)); additionalLayers = [{ shape: 'square', nodeCount: 3, shapeSizeFactor: 3, rotation: 0, offsetX: 0, offsetY: 0, enabled: true, gridSpec: { shape: 'square', ordnung: 2, lage: 2 } }, { shape: 'square', nodeCount: 3, shapeSizeFactor: 3, rotation: 0, offsetX: 0, offsetY: 0, enabled: true }];", N);
        check('(4) a layer with a lage-2 gridSpec is reported incompatible, a lage-1 layer of the same shape and size is not', vm.runInContext('JSON.stringify(incompatibleEnabledLayersForCrossLayerFaces().map(x => x.index))', N) === '[0]');
    }
}

// ---- 5. projectLayerGridSpec, layer E ---------------------------------------------------------------------------------------------------------
{
    const sb = sandbox(read);
    const L = { shape: 'square', nodeCount: 4, gridSpec: { shape: 'square', ordnung: 3, lage: 1 } };
    let e1 = null, e2 = null, e3 = null;
    try { sb.projectLayerGridSpec(L, { shape: 'square', ordnung: 2, lage: 2 }); } catch (e) { e1 = e.message; }
    try { sb.projectLayerGridSpec(L, { shape: 'hex', ordnung: 2, lage: 1 }); } catch (e) { e2 = e.message; }
    try { sb.projectLayerGridSpec(L, { shape: 'square', ordnung: 0, lage: 1 }); } catch (e) { e3 = e.message; }
    check('(5) projectLayerGridSpec refuses lage 2, a spec of another shape and an invalid ordnung BEFORE writing anything', !!e1 && !!e2 && !!e3 && L.nodeCount === 4 && L.gridSpec.ordnung === 3, [e1, e2, e3].join(' | '));
    sb.projectLayerGridSpec(L, { shape: 'square', ordnung: 5, lage: 1 });
    check('(5) a valid spec sets gridSpec and the derived nodeCount together (square ordnung 5 -> c 6)', L.nodeCount === 6 && L.gridSpec.ordnung === 5);
    let bad = [];
    for (const shape of ['triangle', 'square', 'hex']) for (let c = 1; c <= 7; c++) {
        const lay = { shape }; sb.projectLayerGridSpec(lay, sb.fromLegacy(shape, c));
        if (sb.getGridDivisions(sb.layerGridSpecOf(lay)) !== c - 1 || lay.nodeCount !== c) bad.push(shape + c);
        if (sb.getGridDivisions(sb.layerGridSpecOf({ shape, nodeCount: c })) !== c - 1) bad.push('fallback ' + shape + c);
    }
    check('(5) the layer\'s E (getGridDivisions of its own spec, also for a layer object without gridSpec) is the old c - 1 for 3 shapes x c = 1..7', bad.length === 0, bad.join(' '));
}

// ---- 6. session round trip and rollback with layers and a timeline -------------------------------------------------------------------------
{
    const S = require('../session/scenarios.js'), Hh = require('../morph/render-harness.js');
    const { uiOf, snapOf, fakeHooks, applyInto, same } = S;
    const src = Hh.makeRenderWorld('square', 3, 3, 'none');
    src.baseConnections([[1, 5], [2, 8], [3, 7]]);
    const a = src.addKeyframeLayer([[1, 5], [2, 8], [3, 7]], { order: 4 }), b = src.addKeyframeLayer([[1, 9], [2, 6], [4, 8]], { order: 4 });
    S.addLayer(src.ctx, { shape: 'hex', order: 2, size: 3, connections: [[1, 2]], mode: 'none' });
    S.addLayer(src.ctx, { shape: 'square', order: 4, size: 3, connections: [], mode: 'none', enabled: false, playback: true });
    src.setTimeline([a, b], { playbackLayerIndex: src.get('additionalLayers.length - 1') });
    const snap = snapOf(src.ctx, uiOf(src.ctx, 'spiegeling', 6));
    const target = Hh.makeRenderWorld('hex', 2, 5, 'none'), tui = uiOf(target.ctx, 'none', 6);
    const r = applyInto(target.ctx, snap, fakeHooks(target.ctx, snap, tui));
    const specs = w => w.get('JSON.stringify(additionalLayers.map(l => [l.shape, l.nodeCount, l.gridSpec]))');
    check('(6) apply restores every layer through its own gridSpec: the specs equal the source\'s, nodeCount follows, the snapshot (layers and timeline) round-trips', r.ok === true && specs(target) === specs(src) && same(snapOf(target.ctx, tui), snap) && target.get('additionalLayers.every(l => toLegacy(l.gridSpec) === l.nodeCount && l.gridSpec.shape === l.shape)') === true && target.get('additionalLayers.length') === 4, r.ok ? '' : J(r).slice(0, 160));
    const steps = []; const dry = Hh.makeRenderWorld('hex', 2, 5, 'none');
    applyInto(dry.ctx, snap, fakeHooks(dry.ctx, null, uiOf(dry.ctx, 'none', 6), { skipCheck: true }), { beforeStep: n => steps.push(n) });
    let badRb = [], nRb = 0;
    for (const stepName of steps) {
        const t = Hh.makeRenderWorld('hex', 2, 5, 'none'), tu = uiOf(t.ctx, 'none', 6);
        S.addLayer(t.ctx, { shape: 'triangle', order: 3, size: 3, connections: [[1, 2]], mode: 'none' });
        const pre = { layers: t.get('additionalLayers'), spec: t.get('additionalLayers[0].gridSpec'), nc: t.get('additionalLayers[0].nodeCount'), rev: t.get('gridRevision'), gs: t.get('gridSpec') };
        const res = applyInto(t.ctx, snap, fakeHooks(t.ctx, null, tu, { skipCheck: true }), { beforeStep: n => { if (n === stepName) throw new Error('fault before ' + n); } });
        nRb++;
        const ok = res.ok === false && res.rolledBack === true && t.get('additionalLayers') === pre.layers && t.get('additionalLayers[0].gridSpec') === pre.spec && t.get('additionalLayers[0].nodeCount') === pre.nc && t.get('gridRevision') === pre.rev && t.get('gridSpec') === pre.gs;
        if (!ok) badRb.push(stepName);
    }
    check('(6) a fault before each of the ' + nRb + ' apply steps rolls back to the same layers array with the same layer.gridSpec objects and nodeCount, gridRevision untouched', nRb >= 6 && badRb.length === 0, badRb.join(' '));
}

// ---- 7. cache signatures -------------------------------------------------------------------------------------------------------------------
{
    const Hh = require('../morph/render-harness.js');
    const sigOf = (w, id) => w.get(`(function () { const cs = spatialMorphRenderColorSheet(${id}); return spatialMorphRenderCornerSig(${id}, cs, cs.sheet || { shape: currentShape, symmetryMode, outerCorners }); })()`);
    const build = order => { const w = Hh.makeRenderWorld('triangle', 3, 3, 'none'); w.baseConnections([[1, 5], [2, 6], [3, 4]]); w.addKeyframeLayer([[1, 2]], { order }); return w; };
    const w1 = build(1), w2 = build(1), w3 = build(2);
    const fieldOf = (w) => J(w.get('(function () { const f = spatialMorphRenderCornerField(0, 0); return f ? { raster: f.raster, n: f.polys ? f.polys.length : 0 } : null; })()'));
    check('(7) the same geometry gives the same cache signature and the same colour field (two worlds, triangle layer c 1)', sigOf(w1, 0) === sigOf(w2, 0) && fieldOf(w1) === fieldOf(w2) && fieldOf(w1) !== 'null');
    check('(7) another layer spec gives another signature even where shape, node count and corner agree (triangle c 1 = legacy marker, c 2 = ordnung 1: both 3 nodes)', w1.get('additionalLayers[0].nodes.length') === w3.get('additionalLayers[0].nodes.length') && sigOf(w1, 0) !== sigOf(w3, 0));
    const base1 = sigOf(w1, "'base'");
    w1.run("setGrid({ shape: 'triangle', ordnung: 3, lage: 1 })");
    check('(7) the base signature follows the base spec after a topology change (setGrid to another ordnung)', sigOf(w1, "'base'") !== base1);
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
