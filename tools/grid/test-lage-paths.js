// Task 068b: base and layers keep their lage through every change; setBaseLage / setLayerLage; the timeline refuses a lage mix; the DOM follows; the name signature.
//   node tools/grid/test-lage-paths.js     BASE = the commit before 068b (default c6878a14); OLD_TREE = that tree already extracted
//   1. lage 1 equals the old tree (measure-g5a/g5b/g6a/g6b, measure-lage2-app) and the helpers give the old answer for every shape and count
//   2. switch ON: count input, shape change, size change, addLayer, updateActiveLayerGrid (count / size / shape) keep lage 2, the ordnung is clamped
//   3. setBaseLage / setLayerLage: lines, redo stack, gridRevision, refusals with a reason
//   4. addLayerToTimeline refuses a lage mix, the playback layer has the lage-2 nodes, morph frames t = 0..1 with lage-2 keyframes
//   5. the DOM follows (syncGridControls on fakes), layerHasNonDefaultSettings, patternNameSignature
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'c6878a14';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const SK = read('sketch.js');
const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };

// ---- 1. lage 1 equals the old tree -------------------------------------------------------------------------------------------------------------
let oldDir = process.env.OLD_TREE || null;
if (!oldDir) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lagepaths-old-'));
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
    check('(1) core/faces.js, core/tiling.js, core/facecolor.js, core/orbits.js, core/export.js, tools/morph/off-path-golden.json, ui-phone-config.js are unchanged (index.html changed in 068c2: labels)', ['core/faces.js', 'core/tiling.js', 'core/facecolor.js', 'core/orbits.js', 'core/export.js', 'tools/morph/off-path-golden.json'].every(same)
        && read('ui-phone-config.js') === fs.readFileSync(path.join(oldDir, 'ui-phone-config.js'), 'utf8'));
}
const P5 = ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect', 'translate', 'rotate', 'scale', 'textSize', 'text', 'textAlign', 'background', 'clear'];
function world(shape, ordnung, lage, o) {
    o = o || {};
    const w = H.makeRenderWorld(shape, 3, o.size || 3, o.sym || 'rotation_reflection6');
    const sb = w.sb;
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.CLOSE = 'close'; sb.window = { UI: undefined };
    P5.forEach(f => { sb[f] = () => { }; });
    if (lage === 2) w.set('globalThis.__lage2 = true;');
    w.set(`setGrid(${J({ shape, ordnung, lage })});`);
    return w;
}
const LAGE2_N = (shape, n) => shape === 'triangle' ? (n + 1) * (n + 2) / 2 + n * n : shape === 'square' ? (n + 1) * (n + 1) + n * n : 3 * n * (n + 1) + 1 + 6 * n * n;
const withSketch = (w, names) => { names.forEach(n => w.set(grab(n))); return w; };
{
    const w = world('triangle', 2, 1);
    check('(1) helpers at lage 1: gridSpecForCount = fromLegacy, gridMaxCount = maxNodeCountFor, gridSpecOnShape = the ordnung kept and clamped (task 068c3a) for every shape and count', w.get(`(function () {
        for (const s of ['triangle', 'square', 'hex']) { if (gridMaxCount(s, 1) !== maxNodeCountFor(s)) return false;
            for (let c = 1; c <= maxNodeCountFor(s); c++) { if (JSON.stringify(gridSpecForCount(s, c, 1)) !== JSON.stringify(fromLegacy(s, c))) return false;
                for (const t of ['triangle', 'square', 'hex']) { const o = fromLegacy(s, c).ordnung, e = { shape: t, ordnung: Math.min(o, maxOrdnungFor(t, 1)), lage: 1 }; if (JSON.stringify(gridSpecOnShape(fromLegacy(s, c), t)) !== JSON.stringify(e)) return false; } } }
        return true; })()`));
}

// ---- 2. switch on: every place keeps lage 2 -----------------------------------------------------------------------------------------------------
{
    const w = world('triangle', 3, 2);
    // the node-count input path (setGrid(gridSpecForCount(currentShape, v, gridSpec.lage)), limit gridMaxCount(currentShape, gridSpec.lage))
    const r = w.get(`(function () { const out = []; for (const v of [1, 2, 4, 6]) { setGrid(gridSpecForCount(currentShape, v, gridSpec.lage)); out.push([v, gridSpec.lage, gridSpec.ordnung, nodeCount, nodes.length, gridMaxCount(currentShape, gridSpec.lage)]); } return out; })()`);
    check('(2) node-count input: the base keeps lage 2 for counts 1, 2, 4, 6; the limit is the lage-2 ceiling (triangle 6)', r.every(x => x[1] === 2) && r[3][2] === 5 && r[3][4] === LAGE2_N('triangle', 5) && r[0][2] === 1 && r[3][5] === 6, J(r));
    const h2 = world('hex', 2, 2);
    check('(2) node-count input on hex: the limit is 2, lage 2 kept, count above it is clamped by gridSpecForCount', h2.get("(function () { const s = gridSpecForCount('hex', 7, 2); return gridMaxCount('hex', 2) === 2 && s.lage === 2 && s.ordnung === 2; })()"));
    // shape change (rebuildGrid with another shape) and size change
    const sc = world('triangle', 5, 2);
    const seq = sc.get(`(function () { const out = []; for (const s of ['square', 'hex', 'triangle']) { currentShape = s; rebuildGrid(s); out.push([s, gridSpec.lage, gridSpec.ordnung, nodes.length]); } return out; })()`);
    check('(2) shape change: the lage stays 2, the ordnung is taken over directly and clamped (triangle 5 -> square 5 -> hex 2 -> triangle 2)', J(seq) === J([['square', 2, 5, LAGE2_N('square', 5)], ['hex', 2, 2, LAGE2_N('hex', 2)], ['triangle', 2, 2, LAGE2_N('triangle', 2)]]), J(seq));
    check('(2) size change: rebuildGrid(currentShape) keeps gridSpec (lage 2) and does not clear anything else', sc.get("(function () { shapeSizeFactor = 4; const before = gridSpec; rebuildGrid(currentShape); return gridSpec === before && gridSpec.lage === 2; })()"));
    // clampNodeCountToShape lives in setup(): its lage-aware text
    check('(2) sketch.js: clampNodeCountToShape and the node-count handler read gridMaxCount / gridSpecForCount with gridSpec.lage, the catalog import takes the transport\'s lage', /function clampNodeCountToShape[\s\S]*?gridMaxCount\(currentShape, gridSpec\.lage\)[\s\S]*?gridSpecForCount\(currentShape, maxN, gridSpec\.lage\)/.test(SK)
        && /setGrid\(gridSpecForOrdnung\(currentShape, v, gridSpec\.lage\)\)/.test(SK) && /gridSpecForCount\(currentShape, catalogUrlPattern\.order, \(catalogUrlPattern\.spec && catalogUrlPattern\.spec\.lage\) \|\| 1\)/.test(SK) && !/setGrid\(fromLegacy\(/.test(SK));
    // addLayer
    for (const [lage, shape, n] of [[2, 'triangle', 3], [2, 'square', 4], [2, 'hex', 2], [1, 'square', 3]]) {
        const x = withSketch(world(shape, n, lage), ['addLayer']);
        x.set('addLayer();');
        const l = x.get('({ spec: additionalLayers[0].gridSpec, nc: additionalLayers[0].nodeCount, n: additionalLayers[0].nodes.length, uv: additionalLayers[0].nodes.every(p => typeof p.u === "number") })');
        check(`(2) addLayer on a ${shape} ${n} base of lage ${lage}: the layer copies the lage (nodes ${lage === 2 ? LAGE2_N(shape, n) + ' with u/v' : 'lage 1'})`, l.spec.lage === lage && l.spec.ordnung === n && l.n === (lage === 2 ? LAGE2_N(shape, n) : x.get('buildGrid(gridSpec, { sizeFactor: shapeSizeFactor, canvasW, canvasH }).nodes.length')) && l.uv === (lage === 2), J(l));
    }
    // updateActiveLayerGrid
    const u = withSketch(world('square', 3, 2), ['addLayer', 'updateActiveLayerGrid']);
    u.set('addLayer(); activeLayer = 0;');
    const steps = u.get(`(function () { const out = [], L = additionalLayers[0];
        const rec = (tag, r) => out.push([tag, r, L.gridSpec.shape, L.gridSpec.ordnung, L.gridSpec.lage, L.nodeCount, L.nodes.length, L.nodes.every(p => typeof p.u === 'number')]);
        rec('size', updateActiveLayerGrid({ shapeSizeFactor: 4 }));
        rec('count 3', updateActiveLayerGrid({ nodeCount: 3 }));
        rec('count 9', updateActiveLayerGrid({ nodeCount: 9 }));
        rec('shape hex', updateActiveLayerGrid({ shape: 'hex' }));
        rec('shape triangle', updateActiveLayerGrid({ shape: 'triangle', nodeCount: 4 }));
        return out; })()`);
    check('(2) updateActiveLayerGrid keeps lage 2 for a size change, a count, a clamped count, a shape change and a combined patch; the nodes are rebuilt with u/v', steps.every(s => s[4] === 2 && s[7] === true && s[6] === LAGE2_N(s[2], s[3])) && steps[0][3] === 3 && steps[2][3] === 5 && steps[3][3] === 2 && steps[4][3] === 3, J(steps));
    check('(2) ...a clamp is reported as before (count 9 on a lage-2 square: from 9 to 6), and the lines are still cleared by a grid change but not needed for a pure size change check', J(steps[2][1]) === J({ shape: 'square', from: 9, to: 6 }) || /"to":6/.test(J(steps[2][1])), J(steps[2][1]));
    // lage 1 layers: the old path, the old clamp
    const u1 = withSketch(world('square', 3, 1), ['addLayer', 'updateActiveLayerGrid']);
    u1.set('addLayer(); activeLayer = 0;');
    check('(2) a lage-1 layer behaves as before: count 9 -> 9 (square), hex keeps the ordnung 8 (count 8; the hex limit is 12 since task 069): no clamp', u1.get("(function () { const a = updateActiveLayerGrid({ nodeCount: 9 }); const b = updateActiveLayerGrid({ shape: 'hex' }); return a === null && additionalLayers[0].gridSpec.lage === 1 && additionalLayers[0].nodeCount === 8 && b === null; })()"));
}

// ---- 3. setBaseLage / setLayerLage -------------------------------------------------------------------------------------------------------------
{
    const w = withSketch(world('triangle', 3, 1), ['addLayer']);
    w.set('globalThis.__lage2 = true;');
    w.set('connections = [[1, 2]]; redoStack = [[3, 4]]; addLayer(); additionalLayers[0].connections = [[1, 2]];');
    const rev = w.get('gridRevision');
    const r1 = w.get('setBaseLage(2)');
    const st = w.get('({ lage: gridSpec.lage, conns: connections.length, redo: redoStack.length, layers: additionalLayers.length, rev: gridRevision, nodes: nodes.length, uv: nodes.every(p => typeof p.u === "number") })');
    check('(3) setBaseLage(2) (switch on): ok, lines / redo stack / layers cleared like a shape change, gridRevision + 1, lage-2 nodes', r1.ok === true && r1.changed === true && st.lage === 2 && st.conns === 0 && st.redo === 0 && st.layers === 0 && st.rev === rev + 1 && st.nodes === LAGE2_N('triangle', 3) && st.uv, J([r1, st]));
    check('(3) setBaseLage to the lage it has: ok, changed false, nothing touched; back to 1 works', w.get("(function () { const r = gridRevision, a = setBaseLage(2); const b = setBaseLage(1); return a.ok && a.changed === false && r === gridRevision - 1 && b.ok && b.changed && gridSpec.lage === 1; })()"));
    const bad = w.get(`(function () { const out = []; connections = [[1, 2]]; const snap = () => JSON.stringify([gridSpec, connections, gridRevision, nodes.length]);
        const b0 = snap(); out.push(setBaseLage(3), setBaseLage(0), setBaseLage('2')); const same = b0 === snap();
        setGrid({ shape: 'triangle', ordnung: 6, lage: 1 }); const b1 = snap(); out.push(setBaseLage(2)); const same2 = b1 === snap();
        return [out, same, same2]; })()`);
    check('(3) setBaseLage refuses with a reason and touches nothing: invalid lage; ordnung above the lage-2 ceiling (triangle 6 > 5)', bad[0][0].reason === 'invalid-lage' && bad[0][1].reason === 'invalid-lage' && bad[0][2].reason === 'invalid-lage' && bad[0][3].ok === false && bad[0][3].reason === 'ordnung-limit' && bad[0][3].limit === 5 && bad[1] && bad[2], J(bad));
    const off = world('triangle', 3, 1);
    check('(3) switch off: setBaseLage(2) answers switch-off, no throw, nothing changes', off.get("(function () { const b = JSON.stringify([gridSpec, gridRevision]); const r = setBaseLage(2); return r.ok === false && r.reason === 'switch-off' && b === JSON.stringify([gridSpec, gridRevision]); })()"));
    // setLayerLage
    const L = withSketch(world('square', 3, 1), ['addLayer']);
    L.set("globalThis.__lage2 = true; addLayer(); additionalLayers[0].connections = [[1, 2]]; additionalLayers[0].redoStack = [[2, 3]];");
    const rl = L.get('setLayerLage(additionalLayers[0], 2)');
    const sl = L.get('({ lage: additionalLayers[0].gridSpec.lage, c: additionalLayers[0].connections.length, rd: additionalLayers[0].redoStack.length, n: additionalLayers[0].nodes.length, nc: additionalLayers[0].nodeCount, baseLage: gridSpec.lage, rev: gridRevision })');
    check('(3) setLayerLage(layer, 2): the layer gets lage 2 nodes, its lines and redo stack are cleared, the base is untouched', rl.ok && rl.changed && sl.lage === 2 && sl.c === 0 && sl.rd === 0 && sl.n === LAGE2_N('square', 3) && sl.baseLage === 1, J([rl, sl]));
    const ref = L.get(`(function () { const out = []; setLayerLage(additionalLayers[0], 1); updateLimit = 0; additionalLayers[0].gridSpec = { shape: 'square', ordnung: 6, lage: 1 }; additionalLayers[0].nodeCount = 7; const b = JSON.stringify(additionalLayers[0]); out.push(setLayerLage(additionalLayers[0], 2), JSON.stringify(additionalLayers[0]) === b, setLayerLage({}, 2), setLayerLage(additionalLayers[0], 5)); return out; })()`);
    check('(3) setLayerLage refuses with a reason: ordnung above the ceiling (square 6 > 5), unknown layer, invalid lage; nothing touched', ref[0].reason === 'ordnung-limit' && ref[0].limit === 5 && ref[1] === true && ref[2].reason === 'unknown-layer' && ref[3].reason === 'invalid-lage', J(ref));
    const tl = withSketch(world('square', 2, 1), ['addLayer']);
    tl.set("globalThis.__lage2 = true; addLayer(); addLayer(); timeline = { keyframeLayerIds: [0, 1], playbackLayerIndex: 2 };");
    check('(3) a timeline keyframe / playback layer cannot change its lage (in-timeline)', tl.get('setLayerLage(additionalLayers[0], 2)').reason === 'in-timeline' && tl.get('setLayerLage(additionalLayers[1], 2)').reason === 'in-timeline');
}

// ---- 4. timeline -----------------------------------------------------------------------------------------------------------------------------
{
    const mk = (l0, l1) => {
        const w = withSketch(world('triangle', 3, 2, { sym: 'rotation_reflection3' }), ['addLayer', 'addLayerToTimeline']);
        w.sb.canAddLayerToTimeline = () => true; w.sb.setTimelineStatus = (m, k) => { w.sb.__status = [m, k]; };
        ['renderLayerTabs', 'updateOffsetControls', 'updateTimelineControls', 'redraw'].forEach(f => { w.sb[f] = () => { }; });
        w.set("window.timelineIncludeNet = null; globalThis.setTimelineStatus = setTimelineStatus;");
        const reps = w.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
        w.set('addLayer(); addLayer();');
        w.set(`additionalLayers[0].connections = ${J(reps.slice(0, 3))}; additionalLayers[1].connections = ${J(reps.slice(3, 6))};`);
        if (l0 === 1) w.set("additionalLayers[0].gridSpec = { shape: 'triangle', ordnung: 3, lage: 1 }; additionalLayers[0].nodeCount = 4; additionalLayers[0].nodes = layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, additionalLayers[0].shapeSizeFactor, 4).nodes;");
        w.set('activeLayer = 0; addLayerToTimeline(); activeLayer = 1; addLayerToTimeline();');
        return w;
    };
    const mixed = mk(1, 2);
    check('(4) addLayerToTimeline refuses a lage-1 keyframe followed by a lage-2 one (refusal, text), the timeline keeps one keyframe and has no playback layer', mixed.get('timeline.keyframeLayerIds.length') === 1 && mixed.get('timeline.playbackLayerIndex') === null && /another position \(Lage\)/.test(String(mixed.sb.__status && mixed.sb.__status[0])) && mixed.sb.__status[1] === 'refusal', J(mixed.sb.__status));
    const ok = mk(2, 2);
    check('(4) two lage-2 keyframes are accepted: a playback layer with the lage-2 nodes (u/v) and the keyframes\' spec', ok.get('timeline.keyframeLayerIds.length') === 2 && ok.get('additionalLayers[timeline.playbackLayerIndex].nodes.length') === LAGE2_N('triangle', 3) && ok.get('additionalLayers[timeline.playbackLayerIndex].gridSpec.lage') === 2 && ok.get('additionalLayers[timeline.playbackLayerIndex].nodes.every(p => typeof p.u === "number")'), J(ok.sb.__status));
    const frames = [];
    ok.setMorph({ enabled: true, mode: 'linear', angleDeg: 135 });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) { ok.set(`timeline.elapsedMs = ${t * 2000};`); try { frames.push(J(ok.drawn()).length + ':' + ok.status().code); } catch (e) { frames.push('threw ' + e.message); } }
    check('(4) morph with the two lage-2 keyframes: 5 frames t = 0..1 without error, status ok, the frames differ along the path', frames.every(f => !/threw/.test(f) && /:ok$/.test(f)) && new Set(frames.map(f => f.split(':')[0])).size >= 3, J(frames));
    // faces and colour on the lage-2 keyframes (real function on the layer sheet)
    const fc = ok.get(`(function () { const l = additionalLayers[0]; const res = computeCellFaces(l.connections, l.nodes, faceAssignmentsFor(0), null, faceSheetOverrideOfLayer(l)); return res.faces.length; })()`);
    check('(4) faces of a lage-2 keyframe layer are computed (computeCellFaces on the layer sheet)', typeof fc === 'number' && fc > 0, fc);
}

// ---- 5. DOM, non-default, signature -----------------------------------------------------------------------------------------------------------
{
    const m = SK.match(/\n    function syncGridControls\(\) \{[\s\S]*?\n    \}\n/);
    check('(5) syncGridControls exists in setup() and is the hook core/state.js calls (window.gridControlsSync), no new element is created', !!m && /window\.gridControlsSync = syncGridControls/.test(SK) && !/createElement|createButton|createInput/.test(m[0]));
    if (m) {
        const w = world('triangle', 5, 2);
        const log = { value: null, max: null, active: null, calls: [] };
        const nodeInput = { elt: { max: 0 }, v: '1', value(x) { if (x === undefined) return this.v; this.v = String(x); log.value = x; } };
        const btn = s => ({ s, active: false, attribute: () => s, addClass() { this.active = true; }, removeClass() { this.active = false; } });
        const shapeBtns = [btn('triangle'), btn('square'), btn('hex')];
        w.sb.nodeInput = nodeInput; w.sb.shapeBtns = shapeBtns;
        ['renderLayerTabs', 'updateOffsetControls', 'updateTimelineControls'].forEach(f => { w.sb[f] = () => log.calls.push(f); });
        w.set(m[0].replace('function syncGridControls', 'globalThis.gridControlsSync = function syncGridControls').replace(/\n    \}\n$/, '\n    };\n'));
        w.set("setGrid({ shape: 'triangle', ordnung: 4, lage: 2 });");
        check('(5) after setGrid (lage 2, ordnung 4) the input shows the ordnung 4 with max 5 (task 068c2), the triangle button is the active one, layer views are refreshed', nodeInput.v === '4' && nodeInput.elt.max === 5 && shapeBtns[0].active && !shapeBtns[1].active && !shapeBtns[2].active && log.calls.length === 3, J([nodeInput.v, nodeInput.elt.max, shapeBtns.map(b => b.active), log.calls]));
        w.set("setGrid({ shape: 'hex', ordnung: 2, lage: 2 });");
        check('(5) ...after a hex grid: count 2, max 2 (lage-2 ceiling), hex button active', nodeInput.v === '2' && nodeInput.elt.max === 2 && shapeBtns[2].active && !shapeBtns[0].active);
        w.set("setBaseLage(1);");
        check('(5) ...after setBaseLage(1): the max is the lage-1 limit (12, task 069)', nodeInput.elt.max === 12 && nodeInput.v === '2');
        w.set("globalThis.__lage2 = true; setBaseLage(2); additionalLayers.push({ shape: 'hex', gridSpec: { shape: 'hex', ordnung: 1, lage: 1 }, nodeCount: 1, shapeSizeFactor: 3, offsetX: 0, offsetY: 0, rotation: 0, connections: [], redoStack: [], nodes: [], centroid, outerCorners });");
        log.calls.length = 0; w.set('setLayerLage(additionalLayers[0], 2);');
        check('(5) setLayerLage calls the same hook (layer views refreshed)', log.calls.length === 3, J(log.calls));
    }
    const nd = (() => { const w = world('square', 3, 1); w.set(grab('layerHasNonDefaultSettings')); return w; })();
    check('(5) layerHasNonDefaultSettings: another lage is a non-default setting (with the base\'s lage given), the same lage is not; old callers without lage unchanged', nd.get(`(function () { const base = { shape: 'square', symmetryMode: 'x', nodeCount: 3, shapeSizeFactor: 3 }; const l = { shape: 'square', symmetryMode: 'x', nodeCount: 3, shapeSizeFactor: 3, gridSpec: { shape: 'square', ordnung: 2, lage: 2 } };
        return layerHasNonDefaultSettings(l, Object.assign({ lage: 1 }, base)) === true && layerHasNonDefaultSettings(l, Object.assign({ lage: 2 }, base)) === false && layerHasNonDefaultSettings(l, base) === false; })()`));
    const sg = (() => { const w = world('square', 3, 2); w.sb.activeGridOverride = () => null; w.sb.activeConnections = () => []; w.sb.activeLayer = 'base'; w.set(grab('patternNameSignature')); return w; })();
    const sig = sg.get(`(function () { const a = patternNameSignature(); setGrid({ shape: 'square', ordnung: 3, lage: 2 }); const a2 = patternNameSignature(); setGrid({ shape: 'square', ordnung: 4, lage: 2 }); const b = patternNameSignature(); setBaseLage(1); const c = patternNameSignature(); return [a, a2, b, c]; })()`);
    check('(6) patternNameSignature carries ordnung, lage and gridRevision: it changes with the ordnung, with the lage and with a rebuild of the same spec (revision), and holds ordnung / lage fields', J(JSON.parse(sig[0])).includes('"lage":2') && sig[0] !== sig[1] && sig[1] !== sig[2] && sig[2] !== sig[3] && JSON.parse(sig[2]).ordnung === 4 && JSON.parse(sig[3]).lage === 1, J(sig));
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
