// Task 074 (size step 1): a size change of the base keeps the lines and the free endpoints (scaled), the alt net (seed scaled) and the redo stack; layers, timeline and colours are still cleared,
// asked first and said after. resizeBase() (core/state.js) is the one write.
//   node tools/grid/test-resize-base.js      BASE = the commit before 074 (default e1a6e7ac); OLD_TREE = that tree already extracted
//   1. nothing without a size change moves: measure scripts byte-equal to the old tree, protected files unchanged
//   2. old (rebuild with the lines cleared) against new: every shape x ordnung 1..6 x lage 1/2 x 72 size pairs: ids, line pairs, nodes = scaled nodes (0 px), names equal, the drawing = the rebuilt
//      drawing (hash) and = the scaled old drawing (100 % of the segments inside the canvas)
//   3. free endpoints: position = scaled place (0 px), never outside the form after it was inside before
//   4. alt net: the scaled seed gives the scaled net (0 px); seed, lines and free points kept
//   5. nets: Single and Tiled 100 % congruent, Field odd -> recomputed (= rebuild), even -> Single (netDomainEffective)
//   6. redo stack: kept as it is (decision in reports/074.md), every id in it still names a node
//   7. what is lost stays lost (layers, timeline, colours, palette, anchor, net animation); same size and an invalid size touch nothing
//   8. session round trip after a size change
//   9. the handler (real text from sketch.js on fakes): lines only -> no dialog and the short notice; layers / timeline / colours -> dialog first, cancel changes nothing, texts de/en
//  10. sources: the handler calls resizeBase and no other write of shapeSizeFactor is left in sketch.js
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'e1a6e7ac';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
const hash = x => crypto.createHash('sha256').update(typeof x === 'string' ? x : J(x)).digest('hex').slice(0, 16);
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const SK = read('sketch.js');
const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const MODE = 'rotation_reflection6', SHAPES = ['triangle', 'square', 'hex'], SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

// ---- 1. old tree ----------------------------------------------------------------------------------------------------------------------------------
let oldDir = process.env.OLD_TREE || null;
if (!oldDir && !process.env.NO_OLD) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resize-old-'));
        cp.execSync(`git archive ${BASE} | tar -x -C "${oldDir}"`, { cwd: ROOT, stdio: 'ignore' });
    } catch (e) { oldDir = null; }
}
if (!oldDir) console.log('NOTE  the old tree is not available: the comparison with it is skipped');
else {
    const run = (cwd, script) => cp.execFileSync('node', [script], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
    for (const script of ['tools/grid/measure-g5a.js', 'tools/grid/measure-g5b.js', 'tools/session/measure-g6a.js', 'tools/grid/measure-g6b.js', 'tools/grid/measure-lage2-app.js', 'tools/grid/measure-size-change.js']) {
        let a, b, err = '';
        try { a = JSON.parse(run(oldDir, script)); b = JSON.parse(run(ROOT, script)); } catch (e) { err = String(e.message).slice(0, 200); }
        const keys = a ? Object.keys(b) : [], bad = a ? keys.filter(k => J(a[k]) !== J(b[k])) : [];
        check('(1) ' + script + ' equals the old tree (rebuildGrid and every case without resizeBase unchanged; ' + keys.length + ' keys)', a && keys.length > 3 && bad.length === 0, err || bad.slice(0, 3).join(' | '));
    }
    const same = f => read(f) === fs.readFileSync(path.join(oldDir, f), 'utf8');
    check('(1) core/faces.js, core/tiling.js, core/facecolor.js, tools/morph/off-path-golden.json, core/session*.js, core/export.js unchanged',
        ['core/faces.js', 'core/tiling.js', 'core/facecolor.js', 'tools/morph/off-path-golden.json', 'core/session.js', 'core/session-apply.js', 'core/export.js'].every(same));
    const PROT = ['applyTimelineFrame', 'applyLayerConnectionsMorphFrame', 'resolveTimelineKeyframeCoords', 'resolveTimelineSegment', 'totalTimelineDurationMs', 'setTimelineProgress', 'toggleTimelinePlayback', 'previewTimelineSegmentMidpoint'];
    const oldSK = fs.readFileSync(path.join(oldDir, 'sketch.js'), 'utf8');
    const grabIn = (src, name) => { const m = src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); return m ? m[0] : null; };
    check('(1) the eight protected functions of sketch.js are byte-equal to the old tree', PROT.every(n => grabIn(SK, n) && grabIn(SK, n) === grabIn(oldSK, n)));
}

// ---- worlds ----------------------------------------------------------------------------------------------------------------------------------------
const worlds = {};
const W = (shape) => worlds[shape] || (worlds[shape] = H.makeRenderWorld(shape, 3, 3, MODE));
const setup = (w, shape, ord, lage, size) => w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: ord, lage })}); shapeSizeFactor = ${size}; symmetryMode = ${J(MODE)}; connections = []; redoStack = []; baseNetTransform = null; additionalLayers = []; timeline = null; altNetSeed = null; spatialMorph = { enabled: false, mode: 'linear', angleDeg: 0 }; rebuildGrid(currentShape);`);
const state = (w) => JSON.parse(w.get('JSON.stringify({ nodes, centroid, outerCorners, connections, redoStack, altNetSeed })'));
const CX = 300, CY = 300;
const scaleP = (p, f) => ({ x: CX + (p.x - CX) * f, y: CY + (p.y - CY) * f });
const segKey = (s) => { const r = (v) => Math.round(v * 1000); const a = [r(s.x1), r(s.y1)], b = [r(s.x2), r(s.y2)]; return (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a]).join(';'); };
const inside = (s) => [s.x1, s.y1, s.x2, s.y2].every((v) => v >= 0 && v <= 600);
function mapMatch(oldSegs, newSegs, f) {
    const set = new Set(newSegs.map(segKey)); let n = 0, k = 0;
    for (const s of oldSegs) { const p = scaleP({ x: s.x1, y: s.y1 }, f), q = scaleP({ x: s.x2, y: s.y2 }, f), m = { x1: p.x, y1: p.y, x2: q.x, y2: q.y }; if (!inside(m)) continue; n++; if (set.has(segKey(m))) k++; }
    return { n, k };
}
function pointInPoly(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { if ((poly[i].y > p.y) !== (poly[j].y > p.y) && p.x < ((poly[j].x - poly[i].x) * (p.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) c = !c; } return c; }
const nameOf = (w, spec) => w.get(`(function () { const r = gridDisplayNameFor(${J(spec)}, connections.filter(c => c.every(id => !nodes.find(n => n.id === id).free)), ${J(MODE)}); return r ? r.ascii : null; })()`);

// ---- 2. + 3. old against new, free endpoints -------------------------------------------------------------------------------------------------------
{
    const missCases = {};
    let pairs = 0, badNodes = 0, badIds = 0, badNames = 0, badScratch = 0, badFree = 0, outsideAfter = 0, insideBefore = 0, segN = 0, segK = 0, framePairs = 0, maxRes = 0, maxFree = 0, noRedoOK = 0;
    const t0 = Date.now();
    for (const shape of SHAPES) {
        const w = W(shape);
        for (const lage of [1, 2]) for (let ord = 1; ord <= 6; ord++) {
            const spec = { shape, ordnung: ord, lage };
            const frames = ord === 2 || ord === 3;   // the drawing is compared for two orders (cost); nodes, ids, names, free points for all
            for (const a of SIZES) {
                setup(w, shape, ord, lage, a);
                const g0 = state(w), nn = g0.nodes.length;
                const p0 = { x: g0.centroid.x + 0.37 * (g0.outerCorners[0].x - g0.centroid.x), y: g0.centroid.y + 0.37 * (g0.outerCorners[0].y - g0.centroid.y) };
                const conns = [[1, 2], [2, 3], [1, nn], [3, nn + 1]];
                w.set(`connections = ${J(conns)}; redoStack = [[1, 3], [2, ${nn + 1}]]; nodes.push({ id: ${nn + 1}, x: ${p0.x}, y: ${p0.y}, free: true });`);
                const name0 = nameOf(w, spec); let f0 = null; if (frames) { w.set(`connections = ${J(conns.slice(0, 3))};`); f0 = w.frame(); w.set(`connections = ${J(conns)};`); }
                const nodes0 = state(w).nodes;
                for (const b of SIZES) {
                    if (a === b) continue;
                    pairs++;
                    setup(w, shape, ord, lage, a);
                    w.set(`connections = ${J(conns)}; redoStack = [[1, 3], [2, ${nn + 1}]]; nodes.push({ id: ${nn + 1}, x: ${p0.x}, y: ${p0.y}, free: true });`);
                    const r = w.get(`resizeBase(${b})`), s1 = state(w), f = a / b;
                    // the new = the old grid scaled (0 px); the rebuilt grid at the new size = the same nodes
                    const grid1 = s1.nodes.filter(n => !n.free);
                    const res = Math.max(...nodes0.filter(n => !n.free).map((n, i) => dist(scaleP(n, f), grid1[i])));
                    maxRes = Math.max(maxRes, res);
                    if (!(res < 1e-9) || grid1.length !== nn) badNodes++;
                    setup(w, shape, ord, lage, b);
                    const scratch = state(w);
                    if (J(scratch.nodes) !== J(grid1)) badScratch++;
                    if (J(s1.connections) !== J(conns) || s1.nodes.map(n => n.id).join() !== nodes0.map(n => n.id).join()) badIds++;
                    // free endpoint
                    const fr = s1.nodes.find(n => n.free), want = scaleP(p0, f);
                    if (!fr || dist(fr, want) > 1e-9) badFree++; else maxFree = Math.max(maxFree, dist(fr, want));
                    if (pointInPoly(p0, g0.outerCorners)) { insideBefore++; if (!pointInPoly(fr, scratch.outerCorners)) outsideAfter++; }
                    if (!r.changed || r.kept.lines !== conns.length || r.kept.free !== 1) badIds++;
                    // names and the drawing
                    setup(w, shape, ord, lage, a); w.set(`connections = ${J(conns)}; nodes.push({ id: ${nn + 1}, x: ${p0.x}, y: ${p0.y}, free: true });`); w.get(`resizeBase(${b})`);
                    if (nameOf(w, spec) !== name0) badNames++;
                    if (frames) {
                        framePairs++;
                        w.set(`connections = ${J(conns.slice(0, 3))};`);
                        const f1 = w.frame();
                        setup(w, shape, ord, lage, b); w.set(`connections = ${J(conns.slice(0, 3))}; nodes.push({ id: ${nn + 1}, x: ${want.x}, y: ${want.y}, free: true });`);
                        if (hash(w.frame()) !== hash(f1)) badScratch++;
                        const m = mapMatch(f0, f1, f); segN += m.n; segK += m.k; if (m.k !== m.n) { const key = shape + '/' + ord + '/' + lage; missCases[key] = (missCases[key] || 0) + (m.n - m.k); }
                    }
                    noRedoOK++;
                }
            }
        }
    }
    check(`(2) ${pairs} (shape x ordnung x lage x size pair): nodes = scaled old nodes (max rest ${maxRes.toExponential(1)} px) and = the grid rebuilt at the new size, ids and line pairs kept`, pairs === 3 * 12 * 72 && badNodes === 0 && badIds === 0 && badScratch === 0, `nodes ${badNodes} ids ${badIds} scratch ${badScratch}`);
    check(`(2) the name of the pattern is the same before and after (${pairs} pairs)`, badNames === 0, badNames);
    check(`(2) the drawing after resizeBase = the drawing of a rebuild with the same lines (hash, ${framePairs} pairs) and the scaled old drawing is in it: ${segK}/${segN} segments`, segN > 1000 && segK === segN, `${segK}/${segN} ${J(missCases)}`);
    check(`(3) free endpoint = the scaled place (max ${maxFree.toExponential(1)} px) in all ${pairs} pairs; of ${insideBefore} points inside before, ${outsideAfter} outside after`, badFree === 0 && insideBefore > 1000 && outsideAfter === 0, `${badFree} ${outsideAfter}`);
    console.log(`INFO  matrix ${(Date.now() - t0) / 1000} s`);
}

// ---- 4. alt net ----------------------------------------------------------------------------------------------------------------------------------------
{
    let n = 0, bad = 0, badSeed = 0, badKept = 0;
    const NSIDES = { triangle: 3, square: 4, hex: 6 };
    for (const shape of SHAPES) {
        const w = W(shape);
        for (const [a, b] of [[4, 2], [2, 4], [3, 6], [6, 3], [5, 7], [1, 9], [9, 1]]) {
            setup(w, shape, 2, 1, a);
            const P = { x: 220, y: 260 }, Q = { x: 330, y: 250 };
            w.set(`rebuildGridFromConstruction(${J(P)}, ${J(Q)}, ${NSIDES[shape]}, 1); connections = [[1, 2], [2, 3]]; redoStack = [[1, 3]]; nodes.push({ id: 90, x: 301.5, y: 302.5, free: true });`);
            const g0 = state(w);
            w.get(`resizeBase(${b})`);
            const g1 = state(w), f = a / b;
            n++;
            // the reference: the net rebuilt from the scaled edge
            w.set(`rebuildGridFromConstruction(${J(scaleP(P, f))}, ${J(scaleP(Q, f))}, ${NSIDES[shape]}, 1);`);
            const ref = state(w);
            const grid1 = g1.nodes.filter(x => !x.free);
            const res = Math.max(...g0.nodes.filter(x => !x.free).map((p, i) => dist(scaleP(p, f), grid1[i])), ...g0.outerCorners.map((p, i) => dist(scaleP(p, f), g1.outerCorners[i])));
            if (!(res < 1e-7) || J(grid1) !== J(ref.nodes)) bad++;
            if (!g1.altNetSeed || dist(g1.altNetSeed.p, scaleP(P, f)) > 1e-9 || dist(g1.altNetSeed.q, scaleP(Q, f)) > 1e-9 || g1.altNetSeed.n !== NSIDES[shape] || g1.altNetSeed.side !== 1) badSeed++;
            const fr = g1.nodes.find(x => x.free);
            if (J(g1.connections) !== J([[1, 2], [2, 3]]) || J(g1.redoStack) !== J([[1, 3]]) || !fr || fr.id !== 90 || dist(fr, scaleP({ x: 301.5, y: 302.5 }, f)) > 1e-9) badKept++;
        }
    }
    check(`(4) alt net: ${n} cases (3 shapes x 7 size pairs): nodes and corners = the scaled net (0 px) and = the net rebuilt from the scaled edge`, n === 21 && bad === 0, bad);
    check('(4) the seed is kept and scaled (p, q, n, side), lines, redo stack and the free point (id kept, scaled) stay', badSeed === 0 && badKept === 0, `${badSeed} ${badKept}`);
}

// ---- 5. nets (square) -----------------------------------------------------------------------------------------------------------------------------
{
    const w = W('square');
    const specs = { single: { x: { kind: 'trig', w: -1 }, y: 'same', repeat: false }, tiled: { x: { kind: 'trig', w: -1 }, y: 'same', repeat: true }, field: { x: { kind: 'trig', w: -1 }, y: 'same', repeat: false, domain: 'field' } };
    const res = {};
    for (const dom of Object.keys(specs)) {
        let n = 0, k = 0, pairs = 0, badScratch = 0, badDomain = 0;
        for (const a of SIZES) for (const b of SIZES) {
            if (a === b) continue;
            const mk = (size, resize) => { setup(w, 'square', 3, 1, resize ? a : size); w.set(`connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 3); baseNetTransform = ${J(specs[dom])};`); const f0 = resize ? w.frame() : null; if (resize) w.get(`resizeBase(${b})`); return { f: w.frame(), f0, eff: w.get('netDomainEffective(baseNetTransform, shapeSizeFactor)') }; };
            const viaResize = mk(b, true), scratch = mk(b, false);
            pairs++;
            if (hash(viaResize.f) !== hash(scratch.f)) badScratch++;
            if (dom !== 'field') { const m = mapMatch(viaResize.f0, viaResize.f, a / b); n += m.n; k += m.k; }
            const odd = b % 2 === 1 && b >= 3;
            if (dom === 'field' && (odd ? viaResize.eff.domain !== 'field' : (viaResize.eff.domain !== 'single' || !viaResize.eff.ignored))) badDomain++;
        }
        res[dom] = { n, k, pairs, badScratch, badDomain };
    }
    check(`(5) Single: the scaled old drawing is ${res.single.k}/${res.single.n} in the new one (100 %), = a rebuild (${res.single.pairs} pairs)`, res.single.n > 100 && res.single.k === res.single.n && res.single.badScratch === 0, J(res.single));
    check(`(5) Tiled: ${res.tiled.k}/${res.tiled.n} (100 %), = a rebuild (${res.tiled.pairs} pairs)`, res.tiled.n > 1000 && res.tiled.k === res.tiled.n && res.tiled.badScratch === 0, J(res.tiled));
    check(`(5) Field: new size odd (3, 5, 7, 9) -> a field, recomputed = a rebuild; even or below 3 -> Single with the "ignored" reason, = a rebuild (${res.field.pairs} pairs)`, res.field.badScratch === 0 && res.field.badDomain === 0, J(res.field));
    w.set('baseNetTransform = null;');
}

// ---- 6. redo stack ----------------------------------------------------------------------------------------------------------------------------------
{
    const w = W('hex'); setup(w, 'hex', 3, 1, 3);
    const nn = w.get('nodes.length');
    w.set(`nodes.push({ id: ${nn + 1}, x: 310.25, y: 290.5, free: true }); connections = [[1, 2], [2, 3], [3, ${nn + 1}]];`);
    // the undo button does redo.push(conns.pop()); the redo button the reverse (sketch.js): run both on the real arrays
    w.set('redoStack.push(connections.pop());');
    const before = w.get('JSON.stringify([connections, redoStack])');
    w.get('resizeBase(5)');
    check('(6) the redo stack is kept as it is (a popped pair with a free endpoint: the id still names the scaled node)', w.get('JSON.stringify([connections, redoStack])') === before && w.get(`redoStack.every(c => c.every(id => nodes.some(n => n.id === id)))`));
    w.set('connections.push(redoStack.pop());');
    check('(6) redo after the size change restores the line: 3 lines, the last one reaches the free endpoint', w.get('connections.length') === 3 && w.get(`connections[2][1] === ${nn + 1}`) && w.get(`nodes.find(n => n.id === ${nn + 1}).free === true`));
    check('(6) another pair of undo / redo steps on the new size works (undo then redo = the same lines)', (() => { const c0 = w.get('JSON.stringify(connections)'); w.set('redoStack.push(connections.pop()); connections.push(redoStack.pop());'); return w.get('JSON.stringify(connections)') === c0; })());
}

// ---- 7. what is lost, same size, invalid size ------------------------------------------------------------------------------------------------------
{
    const w = W('square'); setup(w, 'square', 3, 1, 3);
    S.addLayer(w.ctx, { shape: 'square', order: 3, size: 3, offsetX: 30, offsetY: -30, rotation: 17, connections: [[1, 2]] });
    w.set(`connections = [[1, 2]]; baseFaceAssignments.set('k', 1); baseFacePalette = { ruleId: 'x' }; baseFaceAnchor = { hueIndex: 1, registerIndex: 2 }; baseLastHarmonyType = 'x'; baseLastSelection = [1]; baseDistributionStrategy = 'area';
        baseNetAnimation = { from: null }; activeLayer = 0; timeline = { keyframeLayerIds: [0], playbackLayerIndex: null }; symmetryMode = 'rotation3'; freeEndpointsEnabled = true; showFaces = true; baseNetTransform = ${J({ x: { kind: 'trig', w: -1 }, y: 'same' })};`);
    const rev = w.get('gridRevision'), r = w.get('resizeBase(7)');
    check('(7) layers, timeline, colours, palette, anchor, harmony, selection, strategy, net animation are cleared; activeLayer is base', w.get('additionalLayers.length === 0 && timeline === null && baseFaceAssignments.size === 0 && baseFacePalette === null && baseFaceAnchor === null && baseLastHarmonyType === null && baseLastSelection === null && baseDistributionStrategy === null && baseNetAnimation === null && activeLayer === "base"'));
    check('(7) kept: lines, symmetry mode, free-endpoint switch, face switch, the net spec; gridRevision +1 or more; the result names the loss', w.get('connections.length === 1 && symmetryMode === "rotation3" && freeEndpointsEnabled === true && showFaces === true && baseNetTransform !== null') && w.get('gridRevision') > rev && r.lost.layers === 1 && r.lost.timeline === true && r.lost.colors === true && r.changed === true && r.from === 3 && r.to === 7);
    const snap = w.get('JSON.stringify([nodes, connections, gridRevision, shapeSizeFactor])');
    const same = w.get('resizeBase(7)');
    check('(7) same size: nothing is touched (nodes, lines, revision, size) and nothing is reported', same.changed === false && w.get('JSON.stringify([nodes, connections, gridRevision, shapeSizeFactor])') === snap && !same.lost.layers && !same.lost.timeline && !same.lost.colors);
    let thrown = 0;
    for (const bad of [0, 10, 2.5, '3', NaN, -1, null, undefined, Infinity]) { try { w.get(`resizeBase(${bad === undefined ? 'undefined' : typeof bad === 'string' ? J(bad) : String(bad)})`); } catch (e) { thrown++; } }
    check('(7) an invalid size (0, 10, 2.5, "3", NaN, -1, null, undefined, Infinity) throws before anything changes', thrown === 9 && w.get('JSON.stringify([nodes, connections, gridRevision, shapeSizeFactor])') === snap, thrown);
}

// ---- 8. session round trip -------------------------------------------------------------------------------------------------------------------------
{
    const w = W('square'); setup(w, 'square', 3, 1, 3);
    const nn = w.get('nodes.length');
    w.set(`nodes.push({ id: ${nn + 1}, x: 333.5, y: 271.25, free: true }); connections = [[1, 2], [2, ${nn + 1}], [1, 3]]; redoStack = [[2, 3]]; freeEndpointsEnabled = true;`);
    w.get('resizeBase(7)');
    const ui = S.uiOf(w.ctx, 'spiegeling', 6), snap = S.snapOf(w.ctx, ui), exp = S.exportOf(w.ctx);
    check('(8) the snapshot carries the new size, the grid spec, the lines, the redo stack and the scaled free point', snap.settings.shapeSizeFactor === 7 && J(snap.base.connections) === J([[1, 2], [2, nn + 1], [1, 3]]) && J(snap.base.redoStack) === J([[2, 3]]) && snap.base.freeNodes && snap.base.freeNodes.length === 1 && Math.abs(snap.base.freeNodes[0].x - (300 + (333.5 - 300) * 3 / 7)) < 1e-9, J(snap.base).slice(0, 200));
    const target = S.world('hex', 4, 1, 'none'), tui = S.uiOf(target, 'none', 6), hooks = S.fakeHooks(target, snap, tui);
    const r = S.applyInto(target, snap, hooks);
    check('(8) apply into another world restores it without a rebuild: snapshot and export are identical', r.ok && S.safe(() => S.same(S.snapOf(target, tui), snap)) && S.safe(() => S.same(S.exportOf(target), exp)) && target.get('shapeSizeFactor') === 7, J(r).slice(0, 200));
    check('(8) the export says the new size and the line count', exp.meta && exp.meta.shapeSizeFactor === 7, J(exp.meta && exp.meta.shapeSizeFactor));
}

// ---- 9. the handler on fakes -----------------------------------------------------------------------------------------------------------------------
{
    const dict = (() => { const src = read('ui-i18n.js'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2], en: k[3] }; return m; })();
    const a0 = SK.indexOf('shapeInput.input(() => {'), b0 = SK.indexOf('// Node count (Number Input)');
    check('(9) the size handler block is found in sketch.js setup()', a0 > 0 && b0 > a0);
    const block = SK.slice(a0, b0).slice(0, SK.slice(a0, b0).lastIndexOf('}'));   // without the closing brace of `if (shapeInput) {`
    const P5 = ['fill', 'noFill', 'push', 'pop', 'stroke', 'noStroke', 'strokeWeight', 'ellipse', 'line', 'bezier'];
    const mk = (size, setupCode, lang) => {
        const log = { said: [], dialogs: [], calls: [] };
        const t = (key, vars) => { const e = dict[key]; if (!e) return key; return e[lang || 'de'].replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] !== undefined ? vars[k] : '{' + k + '}'); };
        const win = { UI: { t }, say: (k, text, kind) => log.said.push([k, text, kind]), timelineConfirm: o => log.dialogs.push(o) };
        const w = H.makeRenderWorld('square', 3, size, MODE);
        w.sb.document = { body: {} }; w.sb.window = win; w.sb.UI = win.UI; P5.forEach(f => { if (!w.sb[f]) w.sb[f] = () => { }; });
        ['sizeChangePlan', 'sizeChangeText', 'saySizeChange', 'shapeLossWhat'].forEach(n => w.set(grab(n)));
        const input = { v: String(size), handler: null, value(x) { if (x === undefined) return this.v; this.v = String(x); return this; }, input(f) { this.handler = f; } };
        Object.assign(w.sb, { shapeInput: input, renderLayerTabs() { log.calls.push('tabs'); }, updateOffsetControls() { }, updateTimelineControls() { log.calls.push('tl'); }, redraw() { log.calls.push('redraw'); } });
        w.set(block);
        if (setupCode) w.set(setupCode);
        return { w, input, log };
    };
    const type = (x, v) => { x.input.v = String(v); x.input.handler(); };
    // lines only: no dialog, the short notice
    let x = mk(3, 'connections = [[1, 2]];');
    type(x, 5);
    check('(9) lines only: no dialog; size 5, the lines kept; notice "Größe 3 -> 5. Linien erhalten." (info); the field shows 5', x.log.dialogs.length === 0 && x.w.get('shapeSizeFactor') === 5 && x.w.get('connections.length') === 1 && J(x.log.said) === J([['size-change', 'Größe 3 -> 5. Linien erhalten.', 'info']]) && x.input.v === '5', J(x.log.said));
    x = mk(3, 'connections = [[1, 2]]; nodes.push({ id: 99, x: 300, y: 320, free: true });');
    type(x, 2);
    check('(9) lines and a free point: "Größe 3 -> 2. Linien und freie Punkte erhalten."', J(x.log.said) === J([['size-change', 'Größe 3 -> 2. Linien und freie Punkte erhalten.', 'info']]), J(x.log.said));
    x = mk(3, '');
    type(x, 4);
    check('(9) an empty pattern: no dialog, only "Größe 3 -> 4."', x.log.dialogs.length === 0 && J(x.log.said) === J([['size-change', 'Größe 3 -> 4.', 'info']]), J(x.log.said));
    // same size, NaN, clamp
    x = mk(3, 'connections = [[1, 2]];');
    const rev = x.w.get('gridRevision');
    type(x, 3); type(x, 'abc'); type(x, '');
    check('(9) the same size, a half-typed value and an empty field change nothing and say nothing', x.w.get('gridRevision') === rev && x.w.get('shapeSizeFactor') === 3 && x.log.said.length === 0 && x.log.dialogs.length === 0);
    type(x, 12); const a1 = x.w.get('shapeSizeFactor'); type(x, -4); const a2 = x.w.get('shapeSizeFactor');
    check('(9) the clamp 1..9 stays (12 -> 9, -4 -> 1)', a1 === 9 && a2 === 1, a1 + ' ' + a2);
    // layers / timeline / colours: the dialog first
    for (const [what, code, words] of [['a layer', "additionalLayers.push({ shape: 'square', connections: [], nodes: [] });", 'Ebenen'], ['a timeline', "timeline = { keyframeLayerIds: [], playbackLayerIndex: null };", 'Zeitleiste'], ['a colour assignment', "baseFaceAssignments.set('k', 1);", 'Farben']]) {
        x = mk(3, 'connections = [[1, 2]]; ' + code);
        const before = x.w.get('JSON.stringify([connections, additionalLayers.length, !!timeline, baseFaceAssignments.size, shapeSizeFactor, nodes.length])');
        type(x, 5);
        check(`(9) with ${what}: the dialog "Größe ändern?" opens first, the text names ${words}, "Ändern"; nothing has changed yet`, x.log.dialogs.length === 1 && x.log.dialogs[0].title === 'Größe ändern?' && x.log.dialogs[0].text.includes(words) && /gehen .* verloren/.test(x.log.dialogs[0].text) && x.log.dialogs[0].confirmLabel === 'Ändern' && x.w.get('JSON.stringify([connections, additionalLayers.length, !!timeline, baseFaceAssignments.size, shapeSizeFactor, nodes.length])') === before && x.log.said.length === 0, J(x.log.dialogs.map(d => d.text)));
        x.log.dialogs[0].returnFocus();   // cancel: the dialog closes without onConfirm, the focus hook runs
        check(`(9) cancel with ${what}: nothing changed and the field goes back to 3`, x.input.v === '3' && x.w.get('JSON.stringify([connections, additionalLayers.length, !!timeline, baseFaceAssignments.size, shapeSizeFactor, nodes.length])') === before && x.log.said.length === 0);
        type(x, 5); x.log.dialogs[1].onConfirm();
        check(`(9) confirm with ${what}: size 5, the line kept, the loss gone, the notice "Größe 3 -> 5. Linien erhalten. Geleert: ${words}."`, x.w.get('shapeSizeFactor') === 5 && x.w.get('connections.length') === 1 && x.w.get('additionalLayers.length === 0 && timeline === null && baseFaceAssignments.size === 0') && x.log.said.length === 1 && x.log.said[0][1] === `Größe 3 -> 5. Linien erhalten. Geleert: ${words}.` && x.input.v === '5', J(x.log.said));
    }
    x = mk(3, "connections = [[1, 2]]; additionalLayers.push({ shape: 'square', connections: [], nodes: [] }); timeline = { keyframeLayerIds: [], playbackLayerIndex: null }; baseFaceAssignments.set('k', 1);", 'en');
    type(x, 6);
    check('(9) English dialog: "Change size?", "Changing the size discards layers, timeline and colors. This cannot be undone.", "Change"', x.log.dialogs[0].title === 'Change size?' && /^Changing the size discards layers, timeline and colou?rs\. This cannot be undone\.$/.test(x.log.dialogs[0].text) && x.log.dialogs[0].confirmLabel === 'Change', x.log.dialogs[0].text);
    x.log.dialogs[0].onConfirm();
    check('(9) English notice: "Size 3 -> 6. Lines kept. Cleared: layers, timeline and colours."', /^Size 3 -> 6\. Lines kept\. Cleared: layers, timeline and colou?rs\.$/.test(x.log.said[0][1]), x.log.said[0] && x.log.said[0][1]);
    check('(9) the text keys exist in German and English (non-empty, different)', ['size.confirm.title', 'size.confirm.text', 'size.confirm.go', 'note.size.head', 'note.size.kept', 'size.kept.lines', 'size.kept.free'].every(k => dict[k] && dict[k].de && dict[k].en && dict[k].de !== dict[k].en));
}

// ---- 10. sources ----------------------------------------------------------------------------------------------------------------------------------
{
    const code = SK.split('\n').filter(l => !/^\s*\/\//.test(l));
    const writes = code.filter(l => /(^|[^.\w])shapeSizeFactor\s*=[^=]/.test(l.replace(/\/\/.*$/, '')));
    check('(10) sketch.js writes shapeSizeFactor once: the input\'s initial read (setup); the handler goes through resizeBase', writes.length === 1 && /parseInt\(shapeInput\.value\(\)\)/.test(writes[0]) && /resizeBase\(v\)/.test(SK), writes.join(' | ').slice(0, 200));
    const st = read('core/state.js');
    check('(10) core/state.js: rebuildGrid and setGrid do not write the size; resizeBase is the only function that sets it', (st.match(/shapeSizeFactor\s*=[^=]/g) || []).length === 3 && /function resizeBase\(neu\)/.test(st), (st.match(/shapeSizeFactor\s*=[^=]/g) || []).length);
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
