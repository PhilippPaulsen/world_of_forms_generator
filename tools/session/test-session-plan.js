/**
 * tools/session/test-session-plan.js
 * Phase 3 autosave, P1a: the validator rules added once the apply path was known (w + s <= 1, palette rule and axes) and
 * planSessionRestore() - rebuild every grid from a snapshot with the REAL builders and check it against the saved fingerprints.
 *
 *   node tools/session/test-session-plan.js
 *   SESSION_JS=/path/to/mutated/session.js node tools/session/test-session-plan.js    (sabotage runs)
 *
 * The oracle is the real code: core/state.js's rebuildGrid() / rebuildGridFromConstruction() run in a vm context and the plan must
 * reproduce their nodes, centroid and corners exactly; layers are compared with layerGrid() called with the arguments sketch.js
 * passes (and a source check pins those arguments). The last block is a DIFFERENTIAL FUZZ: whatever validateSession() accepts and
 * the plan accepts must then build its stores, check its palette rule and paint without throwing - the apply-time preconditions the
 * validator must know about. (The full apply is core/session-apply.js, P1b; this block covers the data half of it.)
 */
const F = require('./fixtures.js');
const { C, makeContext, peekState, SEL3, GRAY1, clone, J } = F;

let failures = 0, checks = 0;
function check(name, ok, detail) { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); }
const same = (a, b) => J(a) === J(b);
const pickNode = n => ({ id: n.id, x: n.x, y: n.y });
const CANVAS = 600;

// ---- a context with the real globals, a grid built by the REAL rebuildGrid(), and helpers ------------------------------------------
function world(shape, order, size, mode) {
    const ctx = makeContext({ state: true });
    ctx.run(`currentShape = ${J(shape)}; nodeCount = ${order}; shapeSizeFactor = ${size}; canvasW = ${CANVAS}; canvasH = ${CANVAS}; symmetryMode = ${J(mode || 'rotation_reflection6')}; rebuildGrid(currentShape);`);
    return ctx;
}
// a layer the way sketch.js builds one: layerGrid(<base>, ..., layer size, layer count, layer shape, canvasW, canvasH), free nodes appended
function addLayer(ctx, o) {
    ctx.run(`(function () {
        const layer = { connections: [], redoStack: [], offsetX: ${o.offsetX || 0}, offsetY: ${o.offsetY || 0}, rotation: ${o.rotation || 0}, shape: ${J(o.shape)}, symmetryMode: ${J(o.mode || 'rotation_reflection6')},
            enabled: true, showFaces: ${!!o.showFaces}, nodeCount: ${o.order}, shapeSizeFactor: ${o.size} };
        const grid = layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, layer.shapeSizeFactor, layer.nodeCount, layer.shape, canvasW, canvasH);
        layer.nodes = grid.nodes; layer.centroid = grid.centroid; layer.outerCorners = grid.outerCorners;
        ${o.free ? `layer.nodes.push({ id: layer.nodes.length + 1, x: ${o.free[0]}, y: ${o.free[1]}, free: true });` : ''}
        additionalLayers.push(layer);
    })()`);
}
const ids = (ctx, expr) => ctx.run(`${expr}.map(n => n.id)`);
function snapshotOf(ctx) { return ctx.sb.buildSessionSnapshot(peekState(ctx), 1700000000000); }
function planOf(ctx, snap, live) {
    const v = ctx.sb.validateSession(clone(snap));
    if (!v.ok) return { validate: v };
    return { validate: v, plan: ctx.sb.planSessionRestore(v.snapshot, live || { canvasW: CANVAS, canvasH: CANVAS }) };
}
function putConnections(ctx, pairs) { ctx.run(`connections = ${J(pairs)};`); }

// ---- 1. the validator rules found by looking at the apply path ----------------------------------------------------------------------
console.log('== 1. validator: colour triangle and palette rule ==');
{
    const ctx = world('triangle', 3, 3);
    putConnections(ctx, [[1, 2]]);
    ctx.run(`baseFaceAssignments.set('k', { hue: 0, w: 0.2, s: 0.2, rule: 'farborgel', params: null, displayColor: null });`);
    const base = snapshotOf(ctx);
    const withAssign = (w, s) => { const o = clone(base); o.base.faceAssignments[0][1].w = w; o.base.faceAssignments[0][1].s = s; return ctx.sb.validateSession(o); };
    check('w 0.6 + s 0.6 (outside the colour triangle) is rejected', !withAssign(0.6, 0.6).ok, withAssign(0.6, 0.6).detail);
    check('w 0.5 + s 0.5 (on the edge) is accepted', withAssign(0.5, 0.5).ok);
    check('w + s = 1 + 1e-10 is accepted (resolveColor tolerates 1e-9)', withAssign(0.5, 0.5 + 1e-10).ok);
    check('w + s = 1 + 1e-8 is rejected', !withAssign(0.5, 0.5 + 1e-8).ok);
    check('the rule is the one resolveColor enforces: every pair the validator accepts resolves, every pair it rejects (w + s) throws there',
        (() => { let agree = 0, n = 0; for (const [w, s] of [[0, 0], [1, 0], [0, 1], [0.5, 0.5], [0.7, 0.3], [0.7, 0.4], [0.9, 0.9], [0.5, 0.5 + 5e-10], [0.5, 0.5 + 5e-9]]) { n++; let r = true; try { ctx.sb.resolveColor(ctx.sb.REF || ctx.run('OSTWALD_REFERENCE_SYSTEM'), { hue: 0, w, s }); } catch (e) { r = false; } if (r === withAssign(w, s).ok) agree++; } return agree === n; })());

    const withPalette = pal => { const o = clone(base); o.base.facePalette = pal; return ctx.sb.validateSession(o); };
    check("palette: ruleId null with no axes is accepted", withPalette({ ruleId: null, idx: [], overrides: [] }).ok);
    check("palette: a registered rule with a fitting idx is accepted ('isotint', [1, 2])", withPalette({ ruleId: 'isotint', idx: [1, 2], overrides: [] }).ok);
    check("palette: 'max-contrast-gray' [0] is accepted, [2] (axis has 2 values) is rejected", withPalette({ ruleId: 'max-contrast-gray', idx: [0], overrides: [] }).ok && !withPalette({ ruleId: 'max-contrast-gray', idx: [2], overrides: [] }).ok);
    for (const bad of ['nope', 'farborgel', 'constructor', '__proto__', 'toString', ''])
        check(`palette: ruleId ${J(bad)} is rejected`, !withPalette({ ruleId: bad, idx: [0], overrides: [] }).ok);
    check('palette: idx with the wrong length is rejected', !withPalette({ ruleId: 'isotint', idx: [1], overrides: [] }).ok && !withPalette({ ruleId: 'isotint', idx: [1, 2, 3], overrides: [] }).ok);
    check('palette: an idx entry past the axis size is rejected', !withPalette({ ruleId: 'isotint', idx: [9999, 0], overrides: [] }).ok);
    // names that exist on Object.prototype / Function.prototype / Map - a lookup by object key or `in` would FIND them
    const PROTO_NAMES = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__defineGetter__', '__lookupGetter__', 'prototype', 'length', 'name', 'call', 'apply', 'bind', 'get', 'set', 'has', 'size'];
    check(`palette: none of ${PROTO_NAMES.length} prototype-chain names is accepted as a rule id`, PROTO_NAMES.every(n => !withPalette({ ruleId: n, idx: [0, 0], overrides: [] }).ok && !withPalette({ ruleId: n, idx: [0], overrides: [] }).ok && !withPalette({ ruleId: n, idx: [], overrides: [] }).ok),
        PROTO_NAMES.filter(n => withPalette({ ruleId: n, idx: [0, 0], overrides: [] }).ok).join(','));
    check('...and the reason names the rule id, not an incidental TypeError ("is not a registered rule")', PROTO_NAMES.concat(['nope']).every(n => /is not a registered rule/.test(withPalette({ ruleId: n, idx: [0, 0], overrides: [] }).detail || '')));
    // the other places a stored string selects something: all must reject the same names
    const rejects = (mut) => PROTO_NAMES.every(n => { const o = clone(base); mut(o, n); return !ctx.sb.validateSession(o).ok; });
    check('lastHarmonyType, distributionStrategy, curve kind and shape reject every prototype-chain name', rejects((o, n) => { o.base.lastHarmonyType = n; }) && rejects((o, n) => { o.base.distributionStrategy = n; })
        && rejects((o, n) => { o.settings.curveType.kind = n; }) && rejects((o, n) => { o.settings.shape = n; }));
    // assignment rule ids are provenance only: nothing resolves them through a registry (every lookup in the code base is getHarmonyRule(palette.ruleId), a Map),
    // so any short string is accepted AND inert - the painted colours do not depend on it
    const paint = (rule) => { const o = clone(base); o.base.faceAssignments = [['kk', { hue: 3, w: 0.2, s: 0.2, rule, params: null, displayColor: null }]]; const v = ctx.sb.validateSession(o); if (!v.ok) return 'rejected: ' + v.detail; const st = new Map(); ctx.sb.setFaceAssignment(st, 'kk', v.snapshot.base.faceAssignments[0][1]); return J(ctx.sb.resolveColor(ctx.run('OSTWALD_REFERENCE_SYSTEM'), st.get('kk'))); };
    const ref = paint('farborgel');
    check('assignment rule ids from the prototype chain are accepted and inert: the resolved colour equals the one under rule "farborgel"', PROTO_NAMES.every(n => paint(n) === ref), PROTO_NAMES.filter(n => paint(n) !== ref).join(','));
    check("a trail key named like a prototype property ('__proto__', 'constructor') is plain data in a Map: accepted, and survives a round trip", ['__proto__', 'constructor', 'toString'].every(k => {
        const o = clone(base); o.base.faceAssignments = [[k, { hue: 0, w: 0.1, s: 0.1, rule: null, params: null, displayColor: null }]]; o.base.facePalette = { ruleId: null, idx: [], overrides: [[k, 1]] };
        const v = ctx.sb.validateSession(o); if (!v.ok) return false;
        const m = new Map(v.snapshot.base.faceAssignments); const pm = new Map(v.snapshot.base.facePalette.overrides);
        return m.has(k) && pm.get(k) === 1 && m.size === 1 && m.get(k).hue === 0 && ({}).polluted === undefined;
    }));
    // fails closed: without the registry a palette with a rule cannot be checked, so it is refused (null stays fine)
    { const vm = require('vm'), fs = require('fs'), path = require('path');
      const bare = vm.createContext({ console }); vm.runInContext(fs.readFileSync(process.env.SESSION_JS || path.join(F.ROOT, 'core', 'session.js'), 'utf8'), bare);
      const mk = pal => { const o = clone(base); o.base.facePalette = pal; return vm.runInContext(`validateSession(${J(o)})`, bare); };
      check('without core/color.js a palette with a rule is rejected (fails closed), a null rule is not affected by it', !mk({ ruleId: 'isotint', idx: [1, 2], overrides: [] }).ok && /cannot be checked/.test(mk({ ruleId: 'isotint', idx: [1, 2], overrides: [] }).detail || '')); }
    check('every accepted palette generates a palette (generateHarmonyPalette does not throw)', ['isotint', 'isotone', 'shadow-series', 'tetrad'].every(id => {
        const axes = ctx.run(`harmonyRuleParams(getHarmonyRule(${J(id)}), OSTWALD_REFERENCE_SYSTEM).map(p => p.count)`);
        const idx = axes.map(c => c - 1);
        const ok = withPalette({ ruleId: id, idx, overrides: [] }).ok;
        let gen = true; try { ctx.sb.generateHarmonyPalette(id, idx, 3); } catch (e) { gen = false; }
        return ok && gen;
    }));
}

// ---- 2. plan vs the real rebuildGrid() ---------------------------------------------------------------------------------------------
console.log('\n== 2. plan equals the real rebuildGrid() ==');
{
    let total = 0, ok = 0, bad = [];
    for (const shape of ['triangle', 'square', 'hex']) for (let order = 1; order <= Math.min(C.makeSheet(shape, 3, 'rotation_reflection6').sb.maxNodeCountFor(shape), 7); order++) for (const size of [1, 3, 5, 9]) {
        total++;
        const ctx = world(shape, order, size);
        const g = ctx.get('nodes');
        if (g.length >= 2) putConnections(ctx, [[1, g.length]]);
        const snap = snapshotOf(ctx), r = planOf(ctx, snap);
        const real = { nodes: ctx.get('nodes').map(pickNode), centroid: ctx.get('centroid'), corners: ctx.get('outerCorners').map(c => ({ x: c.x, y: c.y })) };
        if (r.plan && r.plan.ok && same(r.plan.plan.base.nodes, real.nodes) && same(r.plan.plan.base.centroid, { x: real.centroid.x, y: real.centroid.y }) && same(r.plan.plan.base.outerCorners, real.corners)) ok++;
        else bad.push(`${shape}/${order}/${size}: ${r.plan ? r.plan.code + ' ' + r.plan.detail : r.validate.detail}`);
    }
    check(`the plan reproduces the real base grid exactly: shape x order x size`, ok === total, `${ok}/${total}${bad.length ? ' | ' + bad[0] : ''}`);
}

// ---- 3. alternative nets ----------------------------------------------------------------------------------------------------------------
console.log('\n== 3. alternative net (rebuildGridFromConstruction) ==');
{
    let total = 0, ok = 0, bad = [];
    for (const [shape, n] of [['triangle', 3], ['square', 4], ['hex', 6]]) for (const side of [1, -1]) for (const order of [2, 3, 4]) {
        total++;
        const ctx = makeContext({ state: true });
        ctx.run(`currentShape = ${J(shape)}; nodeCount = ${order}; shapeSizeFactor = 3; canvasW = ${CANVAS}; canvasH = ${CANVAS}; symmetryMode = 'rotation_reflection6'; rebuildGridFromConstruction({ x: 120, y: 230 }, { x: 310, y: 260 }, ${n}, ${side});`);
        putConnections(ctx, [[1, 2]]);
        const snap = snapshotOf(ctx), r = planOf(ctx, snap);
        const real = ctx.get('nodes').map(pickNode);
        if (snap.settings.altNetSeed && r.plan && r.plan.ok && same(r.plan.plan.base.nodes, real) && same(r.plan.plan.base.centroid, { x: ctx.get('centroid').x, y: ctx.get('centroid').y })) ok++;
        else bad.push(`${shape}/${side}/${order}: ${r.plan ? r.plan.code + ' ' + r.plan.detail : r.validate.detail}`);
    }
    check('the plan reproduces the real alternative-net grid (3 shapes x 2 sides x 3 orders)', ok === total, `${ok}/${total}${bad.length ? ' | ' + bad[0] : ''}`);
}

// ---- 4. layers ---------------------------------------------------------------------------------------------------------------------------
console.log('\n== 4. layers ==');
{
    const ctx = world('hex', 3, 5);
    putConnections(ctx, [[1, 2]]);
    const layers = [];
    for (const shape of ['triangle', 'square', 'hex']) for (const [order, size] of [[3, 5], [2, 3], [4, 1]]) layers.push({ shape, order, size, offsetX: 12, offsetY: -7, rotation: 33, free: [14.5, 99.25] });
    layers.forEach(l => addLayer(ctx, l));
    const snap = snapshotOf(ctx), r = planOf(ctx, snap);
    check('base + 9 layers (3 shapes x 3 sizes/orders, with free endpoints) validate and plan', r.plan && r.plan.ok, r.plan && !r.plan.ok ? r.plan.detail : '');
    const live = ctx.get('additionalLayers');
    check('every layer plan has the same nodes (grid then free), centroid and corners as the live layer', r.plan.ok && live.every((l, i) => same(r.plan.plan.layers[i].nodes, l.nodes.map(n => n.free ? { id: n.id, x: n.x, y: n.y, free: true } : pickNode(n))) && same(r.plan.plan.layers[i].outerCorners, l.outerCorners.map(c => ({ x: c.x, y: c.y })))));
    check('free endpoint nodes come after the grid nodes and carry free: true', r.plan.ok && r.plan.plan.layers.every(l => l.nodes[l.nodes.length - 1].free === true && l.nodes.slice(0, -1).every(n => n.free !== true)));
    const same1 = world('hex', 3, 5); addLayer(same1, { shape: 'hex', order: 3, size: 5 });
    check('a same-shape, same-size, same-order layer has exactly the base nodes (independent oracle)', same(snapshotOf(same1) && planOf(same1, snapshotOf(same1)).plan.plan.layers[0].nodes, planOf(same1, snapshotOf(same1)).plan.plan.base.nodes));
}

// ---- 5. tampering is detected -----------------------------------------------------------------------------------------------------------
console.log('\n== 5. mismatches ==');
{
    const ctx = world('square', 3, 5);
    putConnections(ctx, [[1, 5]]);
    addLayer(ctx, { shape: 'triangle', order: 3, size: 3 });
    const snap = snapshotOf(ctx);
    const plan = mut => { const o = clone(snap); mut(o); const v = ctx.sb.validateSession(o); return v.ok ? ctx.sb.planSessionRestore(v.snapshot, { canvasW: CANVAS, canvasH: CANVAS }) : { ok: false, code: 'validate', detail: v.detail }; };
    check('the untouched snapshot plans', plan(() => { }).ok);
    let r = plan(o => { o.settings.shapeSizeFactor = 7; });
    check('another base size (grid algorithm inputs changed) -> grid-mismatch on the base', !r.ok && r.code === 'grid-mismatch' && /base/.test(r.detail), r.detail);
    r = plan(o => { o.base.nodeCheck.hash = '00000000'; });
    check('a different node fingerprint (the algorithm itself changed) -> grid-mismatch', !r.ok && r.code === 'grid-mismatch');
    r = plan(o => { o.layers[0].shapeSizeFactor = 4; });
    check('a layer of another size -> grid-mismatch naming layers[0]', !r.ok && r.code === 'grid-mismatch' && /layers\[0\]/.test(r.detail), r.detail);
    r = plan(o => { o.layers[0].shape = 'hex'; });
    check('a layer of another shape -> grid-mismatch', !r.ok && r.code === 'grid-mismatch');
    r = ctx.sb.planSessionRestore(ctx.sb.validateSession(clone(snap)).snapshot, { canvasW: 300, canvasH: 300 });
    check('another live canvas -> canvas-mismatch (createCanvas has already run)', !r.ok && r.code === 'canvas-mismatch', r.detail);
    check('no live canvas given -> canvas-mismatch, not a throw', (x => !x.ok && x.code === 'canvas-mismatch')(ctx.sb.planSessionRestore(ctx.sb.validateSession(clone(snap)).snapshot, undefined)));
    const altCtx = makeContext({ state: true });
    altCtx.run(`currentShape = 'hex'; nodeCount = 3; shapeSizeFactor = 3; canvasW = ${CANVAS}; canvasH = ${CANVAS}; symmetryMode = 'rotation_reflection6'; rebuildGridFromConstruction({ x: 100, y: 200 }, { x: 300, y: 240 }, 6, 1); connections = [[1, 2]];`);
    const altSnap = snapshotOf(altCtx);
    const altPlan = mut => { const o = clone(altSnap); mut(o); const v = altCtx.sb.validateSession(o); return v.ok ? altCtx.sb.planSessionRestore(v.snapshot, { canvasW: CANVAS, canvasH: CANVAS }) : { ok: false, code: 'validate', detail: v.detail }; };
    check('alt net: the untouched snapshot plans', altPlan(() => { }).ok);
    r = altPlan(o => { o.settings.shape = 'square'; });
    check('alt net: a polygon that does not belong to the shape -> plan-error', !r.ok && r.code === 'plan-error', r.detail);
    r = altPlan(o => { o.settings.altNetSeed.side = -1; });
    check('alt net: the other side of PQ builds a different grid -> grid-mismatch', !r.ok && r.code === 'grid-mismatch');
    // plan-level node existence check (the validator only knows the saved count, the plan knows the rebuilt sheet)
    const v = ctx.sb.validateSession(clone(snap)); const bad = clone(v.snapshot); bad.base.connections = [[1, 999]];
    r = ctx.sb.planSessionRestore(bad, { canvasW: CANVAS, canvasH: CANVAS });
    check('a connection naming a node the rebuilt sheet does not have is rejected by the plan even if it skipped the validator', !r.ok, r.detail);
    // a stored shape named like a prototype property must not select anything (the plan used to index an object literal by st.shape)
    { const v0 = ctx.sb.validateSession(clone(snap)).snapshot;
      const names = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'];
      const results = names.map(n => { const o = clone(v0); o.settings.shape = n; return ctx.sb.planSessionRestore(o, { canvasW: CANVAS, canvasH: CANVAS }); });
      check('a shape named like a prototype property is refused by the plan with "unknown shape" (not selected, not an incidental TypeError)', results.every(r => !r.ok && r.code === 'plan-error' && r.detail === 'unknown shape'), results.map(r => r.detail).join(' | ').slice(0, 160));
      const alt = names.map(n => { const o = clone(v0); o.settings.shape = n; o.settings.altNetSeed = { p: { x: 1, y: 2 }, q: { x: 50, y: 2 }, side: 1, n: 6 }; return ctx.sb.planSessionRestore(o, { canvasW: CANVAS, canvasH: CANVAS }); });
      check('...and with an alternative net too (n cannot match an unknown shape)', alt.every(r => !r.ok && r.code === 'plan-error'), alt.map(r => r.detail).join(' | ').slice(0, 160)); }
    // never throws
    let threw = 0;
    for (const x of [undefined, null, 0, '', [], {}, { settings: null }, { settings: { canvas: { w: 600, h: 600 } } }, { settings: { canvas: { w: 600, h: 600 }, shape: 'hex', nodeCount: 3, shapeSizeFactor: 3 }, base: null }]) {
        try { ctx.sb.planSessionRestore(x, { canvasW: CANVAS, canvasH: CANVAS }); } catch (e) { threw++; }
        try { ctx.sb.planSessionRestore(x, null); } catch (e) { threw++; }
    }
    check('planSessionRestore never throws on malformed input', threw === 0, threw);
    // forms.js absent
    const bare = makeContext({ state: false });
    const noForms = require('vm').createContext({ console });
    require('vm').runInContext(require('fs').readFileSync(require('path').join(F.ROOT, 'core', 'session.js'), 'utf8'), noForms);
    r = require('vm').runInContext(`planSessionRestore(${J(snap)}, { canvasW: ${CANVAS}, canvasH: ${CANVAS} })`, noForms);
    check('without core/forms.js the plan says so (plan-error), it does not throw', !r.ok && r.code === 'plan-error', r.detail);
    check('(the session module alone loads without the other core files)', bare.get('typeof planSessionRestore') === 'function');
}

// ---- 6. sketch.js builds layer grids with the arguments the plan uses -----------------------------------------------------------------------
console.log('\n== 6. source check ==');
{
    const sk = F.read('sketch.js'), st = F.read('core/state.js');
    check('sketch.js: updateActiveLayerGrid() calls layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, layer.shapeSizeFactor, layer.nodeCount, layer.shape, canvasW, canvasH)',
        /function updateActiveLayerGrid[\s\S]{0,4000}?layerGrid\(outerCorners, centroid, currentShape, shapeSizeFactor, layer\.shapeSizeFactor, layer\.nodeCount, layer\.shape, canvasW, canvasH\)/.test(sk));
    check('sketch.js: the timeline playback layer is built with the same layerGrid() arguments', /layerGrid\(outerCorners, centroid, currentShape, shapeSizeFactor, playbackLayer\.shapeSizeFactor, playbackLayer\.nodeCount, playbackLayer\.shape, canvasW, canvasH\)/.test(sk));
    check('core/state.js: rebuildGrid() builds with (nodeCount, shapeSizeFactor, canvasW, canvasH)', /buildTriangleGrid\(nodeCount, shapeSizeFactor, canvasW, canvasH\)/.test(st) && /buildSquareGrid\(nodeCount, shapeSizeFactor, canvasW, canvasH\)/.test(st) && /buildHexGrid\(nodeCount, shapeSizeFactor, canvasW, canvasH\)/.test(st));
}

// ---- 7. differential fuzz: accepted by validate AND plan => must build, resolve its palette and paint without throwing --------------------------
console.log('\n== 7. differential fuzz ==');
{
    // a rich base: hex order 3, several connections, real gray + Farborgel entries, a registry palette with overrides, a layer
    const ctx = world('hex', 3, 5);
    const orbits = ctx.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0])');
    putConnections(ctx, [orbits[3], orbits[30], orbits[34], orbits[54]].map(p => p.slice()));
    ctx.run(`(function () {
        const res = computeCellFaces(connections, nodes, null);
        const group = getGroupElementsCached(nodes, centroid, currentShape, symmetryMode, outerCorners);
        const trails = computeFaceTrails(res, group);
        applyHarmonyToPattern(${J(GRAY1)}, baseFaceAssignments, trails, 'cyclic', undefined, { ruleId: 'max-contrast-gray', source: 'maxContrastGray', fillOnly: true });
        applyHarmonyToPattern(${J(SEL3)}, baseFaceAssignments, trails.slice(0, Math.ceil(trails.length / 2)), 'area', undefined);
        baseFacePalette = newFacePalette(); baseFacePalette.ruleId = 'tetrad'; baseFacePalette.idx = [2, 1]; baseFacePalette.overrides.set(trails[0].key, 1);
        baseFaceAnchor = { hueIndex: 9, registerIndex: 12 }; baseLastHarmonyType = 'custom'; baseLastSelection = ${J(SEL3)}; baseDistributionStrategy = 'area';
    })()`);
    addLayer(ctx, { shape: 'hex', order: 3, size: 5, showFaces: true, free: [7.5, 3.25] });
    const snap = snapshotOf(ctx);
    const baseText = J(snap);
    check('the fuzz base validates and plans', (r => r.plan && r.plan.ok)(planOf(ctx, snap)));

    // what applying does to the data half: stores through setFaceAssignment, the palette's rule through generateHarmonyPalette, a paint
    function applyData(v, plan) {
        const sb = ctx.sb, sheets = [v.base].concat(v.layers);
        sheets.forEach((sh, i) => {
            const store = new Map();
            sh.faceAssignments.forEach(([k, a]) => sb.setFaceAssignment(store, k, a));
            if (sh.facePalette && sh.facePalette.ruleId) sb.generateHarmonyPalette(sh.facePalette.ruleId, sh.facePalette.idx, 3);
            if (i === 0) {
                const conns = sh.connections.filter(c => c.length === 2);
                sb.computeCellFaces(conns, plan.base.nodes, store);
            }
        });
    }
    const rand = C.rng(20261006), baseObj = JSON.parse(baseText);
    const paths = [];
    (function walk(o, p) { if (o && typeof o === 'object') for (const k of Object.keys(o)) { paths.push(p.concat([k])); walk(o[k], p.concat([k])); } })(baseObj, []);
    const junk = [null, 'x', '', -1, 0, 1, 2, 24, 25, 1.5, 0.5, 0.9, 1e308, -1e308, 1e-300, [], {}, true, false, 'nope', 'constructor', '__proto__', 'farborgel', 'isotint', 'tetrad', 'max-contrast-gray', [1, 2, 3], [0, 0], [0], { a: 1 }, 99999, -0.5, 'custom', '3', 'W', 'rings', 'area'];
    let accepted = 0, planned = 0, threw = [], N = 4000;
    for (let i = 0; i < N; i++) {
        const o = clone(baseObj), applied = [];
        const nm = 1 + Math.floor(rand() * 3);
        for (let m = 0; m < nm; m++) {
            const p = paths[Math.floor(rand() * paths.length)];
            let t = o; for (let d = 0; d < p.length - 1 && t; d++) t = t[p[d]];
            if (!t || typeof t !== 'object') continue;
            const k = p[p.length - 1], act = Math.floor(rand() * 3);
            if (act === 0) { delete t[k]; applied.push(p.join('/') + ' deleted'); } else { const jv = junk[Math.floor(rand() * junk.length)]; t[k] = jv; applied.push(p.join('/') + ' = ' + J(jv)); }
        }
        const v = ctx.sb.validateSession(o);
        if (!v.ok) continue;
        accepted++;
        const pl = ctx.sb.planSessionRestore(v.snapshot, { canvasW: CANVAS, canvasH: CANVAS });
        if (!pl.ok) continue;
        planned++;
        try { applyData(v.snapshot, pl.plan); } catch (e) { if (threw.length < 5) threw.push((e && e.message || String(e)).slice(0, 90) + ' <= ' + applied.join('; ').slice(0, 160)); else threw.push(null); }
    }
    check(`${N} mutations: nothing the validator AND the plan accept throws when its stores are built, its palette generated and the base painted`, threw.length === 0, `${accepted} validated, ${planned} planned${threw.length ? ' | ' + threw.filter(Boolean).join(' || ') : ''}`);
    check('the fuzz is not vacuous (plenty accepted, plenty rejected)', accepted > 200 && accepted < N - 500 && planned > 100, `${accepted} accepted, ${planned} planned of ${N}`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
