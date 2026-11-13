// Task 068c3a: a shape change keeps the ORDNUNG (clamped to the new shape's maximum in the lage), the lage stays, the notice says what was cleared and the dialog asks first when layers
// or the timeline would go with it.
//   node tools/grid/test-shape-change.js     BASE = the commit before 068c3a (default f5ca44fd); OLD_TREE = that tree already extracted
//   1. no shape change: byte-equal to the old tree (measure-g5a/g5b/g6a/g6b, measure-lage2-app)
//   2. base: every ordered pair of shapes x ordnung 1..12 x lage 1/2 (switch on): ordnung = min(old, max), lage kept, the grid = a freshly built grid of that shape and ordnung
//   3. layer: the same through updateActiveLayerGrid({ shape }), with the clamp report; a legacyC1 state drops the marker
//   4. the handler (real text from sketch.js, run on fakes): the change, the notice, the dialog only with layers / timeline, cancel changes nothing, same-shape click as before
//   5. texts de/en
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'f5ca44fd';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const SK = read('sketch.js');
const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };

// ---- 1. old tree --------------------------------------------------------------------------------------------------------------------------------
let oldDir = process.env.OLD_TREE || null;
if (!oldDir) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shapechange-old-'));
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
        check('(1) ' + script + ' equals the old tree without a shape change (' + keys.length + ' keys)', a && keys.length > 5 && bad.length === 0, err || bad.slice(0, 3).join(' | '));
    }
    const same = f => read(f) === fs.readFileSync(path.join(oldDir, f), 'utf8');
    check('(1) core/faces.js, core/tiling.js, core/facecolor.js, off-path-golden, ui-phone-config.js are unchanged (state.js: task 072d removed the switch, pinned in test-lage2-free.js)',
        ['core/faces.js', 'core/tiling.js', 'core/facecolor.js', 'tools/morph/off-path-golden.json', 'ui-phone-config.js'].every(same));   // index.html changed in 068c3b (the info sentence)
}
const P5 = ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect', 'translate', 'rotate', 'scale', 'textSize', 'text', 'textAlign', 'background', 'clear'];
function world(shape, spec, o) {
    const w = H.makeRenderWorld(shape, 3, 3, 'rotation_reflection6');
    const sb = w.sb;
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.CLOSE = 'close'; sb.window = (o && o.window) || { UI: undefined };
    P5.forEach(f => { sb[f] = () => { }; });
    if (spec) w.set(`currentShape = ${J(spec.shape)}; setGrid(${J(spec)});`);
    return w;
}
const withSketch = (w, names) => { names.forEach(n => w.set(grab(n))); return w; };
const SHAPES = ['triangle', 'square', 'hex'];
const MAXO = { 1: { triangle: 12, square: 12, hex: 12 }, 2: { triangle: 12, square: 12, hex: 9 } };

// ---- 2. base --------------------------------------------------------------------------------------------------------------------------------------
{
    let n = 0, bad = [], clamped = 0;
    for (const lage of [1, 2]) for (const a of SHAPES) for (const b of SHAPES) {
        if (a === b) continue;
        for (let o = 1; o <= MAXO[lage][a]; o++) {
            const w = withSketch(world(a, { shape: a, ordnung: o, lage }), ['shapeChangePlan']);
            w.set('connections = [[1, 2]];');
            const plan = w.get(`shapeChangePlan(${J(b)})`);
            w.set(`currentShape = ${J(b)}; rebuildGrid(${J(b)});`);
            const want = Math.min(o, MAXO[lage][b]);
            const got = w.get('JSON.stringify([gridSpec, nodes, centroid, outerCorners, connections, additionalLayers.length])');
            const fresh = world(b, { shape: b, ordnung: want, lage }).get('JSON.stringify([gridSpec, nodes, centroid, outerCorners, [], 0])');
            n++; if (want < o) clamped++;
            if (got !== fresh || J(plan.to) !== J({ shape: b, ordnung: want, lage }) || J(plan.clamped) !== J(want < o ? { from: o, to: want } : null) || plan.same !== false) bad.push(`L${lage} ${a}${o}->${b}`);
        }
    }
    check(`(2) base, ${n} cases (ordered pairs x ordnung 1..max x lage 1/2): ordnung = min(old, max of the new shape), lage kept, the grid (spec, nodes, centroid, corners) = a fresh grid of that shape and ordnung, lines cleared; plan.clamped in ${clamped} cases`, bad.length === 0 && n > 60, bad.slice(0, 5).join(' | '));
    const w = world('square', { shape: 'square', ordnung: 1, lage: 1 });
    w.set("projectGridSpec(fromLegacy('square', 1)); rebuildGrid('square');");
    const before = w.get('gridSpec.legacyC1 === true');
    w.set("currentShape = 'hex'; rebuildGrid('hex');");
    check('(2) the examples: a legacyC1 square (c 1) -> hex gives ordnung 1 without the marker (7 nodes); square ordnung 1 (4 nodes) -> hex ordnung 1', before && w.get('gridSpec.ordnung === 1 && gridSpec.legacyC1 === undefined && gridSpec.lage === 1 && nodes.length === 7'));
    const w2 = world('triangle', { shape: 'triangle', ordnung: 6, lage: 1 });
    w2.set("currentShape = 'square'; rebuildGrid('square');");
    const a1 = w2.get('gridSpec.ordnung');
    w2.set("currentShape = 'square'; setGrid({ shape: 'square', ordnung: 12, lage: 1 }); currentShape = 'triangle'; rebuildGrid('triangle');");
    check('(2) triangle 6 -> square 6; square 12 -> triangle 12 (task 069: the same ceiling on every shape, lage 1 clamps no more)', a1 === 6 && w2.get('gridSpec.ordnung === 12 && gridSpec.shape === "triangle"'));
    check('(2) no shape change (same shape, size, input, lage API) stays as it was: rebuildGrid(same shape) keeps gridSpec incl. legacyC1', (() => { const x = world('triangle', null); x.set("projectGridSpec(fromLegacy('triangle', 1)); rebuildGrid('triangle');"); return x.get('gridSpec.legacyC1 === true && nodes.length === 3'); })());
}

// ---- 3. layer ---------------------------------------------------------------------------------------------------------------------------------------
{
    let n = 0, bad = [];
    for (const lage of [1, 2]) for (const a of SHAPES) for (const b of SHAPES) {
        if (a === b) continue;
        for (let o = 1; o <= MAXO[lage][a]; o++) {
            const w = withSketch(world('square', { shape: 'square', ordnung: 3, lage }), ['addLayer', 'updateActiveLayerGrid']);
            w.set(`addLayer(); activeLayer = 0; additionalLayers[0].connections = [[1, 2]]; globalThis.__t = updateActiveLayerGrid({ shape: ${J(a)}, ordnung: ${o} }); additionalLayers[0].connections = [[1, 2]];`);
            const rep = w.get(`updateActiveLayerGrid({ shape: ${J(b)} })`);
            const want = Math.min(o, MAXO[lage][b]);
            const got = w.get('JSON.stringify([additionalLayers[0].gridSpec, additionalLayers[0].nodes, additionalLayers[0].nodeCount, additionalLayers[0].connections.length])');
            const fresh = w.get(`(function () { const spec = { shape: ${J(b)}, ordnung: ${want}, lage: ${lage} }; const g = layerGridForSpec(outerCorners, centroid, currentShape, shapeSizeFactor, additionalLayers[0].shapeSizeFactor, spec, spec.shape, canvasW, canvasH); return JSON.stringify([spec, g.nodes, toLegacy(spec), 0]); })()`);
            n++;
            const wantRep = want < o ? { shape: b, from: b === 'hex' ? o : o + 1, to: b === 'hex' ? want : want + 1 } : null;
            if (got !== fresh || J(rep) !== J(wantRep)) bad.push(`L${lage} ${a}${o}->${b} ${J(rep)}`);
        }
    }
    check(`(3) layer, ${n} cases: updateActiveLayerGrid({ shape }) keeps the ordnung (clamped), the lage, builds the fresh grid of the layer's own shape, clears the lines; the clamp report is {shape, from, to} in the internal count`, bad.length === 0 && n > 60, bad.slice(0, 4).join(' | '));
    const w = withSketch(world('square', { shape: 'square', ordnung: 3, lage: 1 }), ['addLayer', 'updateActiveLayerGrid']);
    w.set("addLayer(); activeLayer = 0; projectLayerGridSpec(additionalLayers[0], fromLegacy('square', 1));");
    w.set("updateActiveLayerGrid({ shape: 'hex' });");
    check('(3) a legacyC1 layer (square c 1) -> hex: ordnung 1 without the marker', w.get("additionalLayers[0].gridSpec.ordnung === 1 && additionalLayers[0].gridSpec.legacyC1 === undefined && additionalLayers[0].nodes.length === 7"));
    // explicit counts still win (align, catalog): { shape, nodeCount }
    check('(3) a patch with an explicit count / ordnung is not touched: { shape: hex, nodeCount: 5 } -> hex ordnung 5; { shape: triangle, ordnung: 2 } -> triangle ordnung 2', (() => { const x = withSketch(world('square', { shape: 'square', ordnung: 3, lage: 1 }), ['addLayer', 'updateActiveLayerGrid']); x.set('addLayer(); activeLayer = 0; updateActiveLayerGrid({ shape: "hex", nodeCount: 5 });'); const a = x.get('additionalLayers[0].gridSpec.ordnung'); x.set('updateActiveLayerGrid({ shape: "triangle", ordnung: 2 });'); return a === 5 && x.get('additionalLayers[0].gridSpec.ordnung') === 2; })());
}

// ---- 4. the handler -----------------------------------------------------------------------------------------------------------------------------
{
    const dict = (() => { const src = read('ui-i18n.js'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2], en: k[3] }; return m; })();
    const a0 = SK.indexOf('shapeBtns.forEach(btn => {'), b0 = SK.indexOf('// Shape size (Number Input)');
    check('(4) the handler block is found in sketch.js setup()', a0 > 0 && b0 > a0);
    const block = SK.slice(a0, b0);
    const mk = (spec, setup, lang) => {
        const log = { said: [], dialogs: [], calls: [] };
        const t = (key, vars) => { const e = dict[key]; if (!e) return key; return e[lang || 'de'].replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] !== undefined ? vars[k] : '{' + k + '}'); };
        const win = { UI: { t }, say: (k, text, kind) => log.said.push([k, text, kind]), timelineConfirm: o => log.dialogs.push(o) };
        const w = withSketch(world(spec.shape, spec, { window: win }), ['shapeChangePlan', 'shapeLossWhat', 'shapeChangeText', 'sayShapeChange', 'toggleBaseLage', 'sayLage', 'sayLageRefusal']);
        w.sb.UI = win.UI;
        const mkBtn = s => ({ s, active: s === spec.shape, handler: null, mousePressed(f) { this.handler = f; }, attribute: () => s, addClass() { this.active = true; }, removeClass() { this.active = false; }, hasClass() { return this.active; }, elt: { focus() { } } });
        const btns = SHAPES.map(mkBtn);
        Object.assign(w.sb, { shapeBtns: btns, syncGridControls: () => log.calls.push('sync'), renderLayerTabs() { }, updateOffsetControls() { }, updateTimelineControls() { }, updateSymmetryModeControl() { }, cancelAltNetConstruction() { }, redraw() { }, clampNodeCountToShape() { log.calls.push('clamp'); } });
        w.set(block);
        if (setup) w.set(setup);
        return { w, btns, log };
    };
    const click = (x, s) => x.btns.find(b => b.s === s).handler();
    const active = x => x.btns.filter(b => b.active).map(b => b.s).join();
    // no layers: changes at once, the notice names the lines and the clamp
    let x = mk({ shape: 'square', ordnung: 12, lage: 2 }, 'connections = [[1, 2]];');
    click(x, 'hex');
    check('(4) lage 2 square 12 with a line -> hex: no dialog, ordnung 9 (clamped to the lage-2 ceiling of the hex, task 070), the notice "Ordnung auf 9 begrenzt (höchstens 9 bei dieser Form). Geleert: Linien." (info), the controls sync, hex is active',
        x.log.dialogs.length === 0 && x.w.get('gridSpec.ordnung') === 9 && x.w.get('currentShape') === 'hex' && x.w.get('connections.length') === 0 && J(x.log.said) === J([['shape-change', 'Ordnung auf 9 begrenzt (höchstens 9 bei dieser Form). Geleert: Linien.', 'info']]) && x.log.calls.includes('sync') && !x.log.calls.includes('clamp') && active(x) === 'hex', J([x.log, active(x)]));
    x = mk({ shape: 'triangle', ordnung: 3, lage: 2 }, 'connections = [[1, 2]]; baseFaceAssignments.set("k", {});');
    click(x, 'square');
    check('(4) lage 2 triangle 3 -> square: lage stays 2, ordnung 3 (no clamp note), what is cleared: "Geleert: Linien und Farben."', x.w.get('gridSpec.lage') === 2 && x.w.get('gridSpec.ordnung') === 3 && x.log.said.length === 1 && x.log.said[0][1] === 'Geleert: Linien und Farben.', J(x.log.said));
    x = mk({ shape: 'square', ordnung: 3, lage: 1 }, '');
    click(x, 'triangle');
    check('(4) nothing to clear and no clamp: no notice at all', x.log.said.length === 0 && x.w.get('gridSpec.shape') === 'triangle');
    // layers / timeline: the dialog first
    x = mk({ shape: 'square', ordnung: 4, lage: 1 }, "connections = [[1, 2]]; additionalLayers.push({ shape: 'square', connections: [], nodes: [] }); additionalLayers.push({ shape: 'square', connections: [], nodes: [] }); timeline = { keyframeLayerIds: [0, 1] };");
    const before = x.w.get('JSON.stringify([gridSpec, currentShape, connections, additionalLayers.length, timeline])');
    click(x, 'hex');
    check('(4) with layers and a timeline: the dialog opens first ("Form wechseln?", the text names Linien, Ebenen und Zeitleiste, "Wechseln"), nothing has changed yet (spec, lines, layers, timeline, active button)',
        x.log.dialogs.length === 1 && x.log.dialogs[0].title === 'Form wechseln?' && /Linien, Ebenen und Zeitleiste/.test(x.log.dialogs[0].text) && x.log.dialogs[0].confirmLabel === 'Wechseln' && x.w.get('JSON.stringify([gridSpec, currentShape, connections, additionalLayers.length, timeline])') === before && active(x) === 'square' && x.log.said.length === 0, J(x.log.dialogs[0]));
    check('(4) cancel (the dialog never calls onConfirm) leaves everything unchanged', x.w.get('JSON.stringify([gridSpec, currentShape, connections, additionalLayers.length, timeline])') === before && active(x) === 'square');
    x.log.dialogs[0].onConfirm();
    check('(4) confirm: the change happens (hex ordnung 4, layers and timeline gone), the notice says what was cleared', x.w.get('gridSpec.shape === "hex" && gridSpec.ordnung === 4 && additionalLayers.length === 0 && timeline === null') && active(x) === 'hex' && x.log.said.length === 1 && /Geleert: Linien, Ebenen und Zeitleiste\./.test(x.log.said[0][1]), J(x.log.said));
    // a click on the active shape: task 068c3b - no longer a silent rebuild, it is the lage (tools/grid/test-lage-click.js); with layers it asks first
    x = mk({ shape: 'square', ordnung: 4, lage: 1 }, "connections = [[1, 2]];");
    click(x, 'square');
    check('(4) a click on the shape that is already active (task 068c3b) is the lage: no shape notice, no silent rebuild of lage 1 (the lines go with the lage change: lage 2 now)', x.w.get('gridSpec.lage === 2 && gridSpec.ordnung === 4 && connections.length === 0') && x.log.dialogs.length === 0 && x.log.said.length === 1 && x.log.said[0][0] === 'lage-change', J(x.log.said));
    // English
    x = mk({ shape: 'square', ordnung: 12, lage: 2 }, "connections = [[1, 2]]; additionalLayers.push({ shape: 'square', connections: [], nodes: [] });", 'en');
    click(x, 'hex');
    check('(4) English: "Change shape?", "Changing the shape discards lines and layers. This cannot be undone.", then "Order limited to 9 (at most 9 for this shape). Cleared: lines and layers."', x.log.dialogs[0].title === 'Change shape?' && x.log.dialogs[0].text === 'Changing the shape discards lines and layers. This cannot be undone.' && (x.log.dialogs[0].onConfirm(), x.log.said[0][1] === 'Order limited to 9 (at most 9 for this shape). Cleared: lines and layers.'), J([x.log.dialogs[0].text, x.log.said]));
    // the layer handler text
    check('(4) layer shape buttons: the clamp and the cleared lines are said through shapeChangeText (no dialog: a layer change clears only that layer\'s lines), the input follows', /const clamp = updateActiveLayerGrid\(\{ shape: btn\.attribute\('data-shape'\) \}\);[\s\S]*?layerNodeCountInput\.value\(ordnungForCount\(clamp\.shape, clamp\.to\)\)[\s\S]*?shapeChangeText\(/.test(SK));
}

// ---- 5. texts ----------------------------------------------------------------------------------------------------------------------------------
{
    const src = read('ui-i18n.js');
    const keys = ['shape.lost.lines', 'shape.lost.layers', 'shape.lost.timeline', 'shape.lost.colors', 'shape.lost.and', 'note.shape.clamp', 'note.shape.cleared', 'shape.confirm.title', 'shape.confirm.text', 'shape.confirm.go'];
    check('(5) the ten keys exist in German and English (non-empty, different)', keys.every(k => { const m = new RegExp("'" + k.replace(/\./g, '\\.') + "': \\{ de: '([^']+)', en: '([^']+)' \\}").exec(src); return m && m[1] !== m[2]; }));
    check('(5) the old shape-change notes are gone (no "Shape changed to" text in the base handler; the layer handler uses shapeChangeText)', !/Shape changed to \$\{currentShape\}/.test(SK) && !/Layer shape changed to/.test(SK));
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
