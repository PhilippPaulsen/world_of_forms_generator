// Task 068c3b: the lage by a second click on the ACTIVE shape button (base and layer), the dot, aria-label / title, the notices, the dialog, the info sentence.
//   node tools/grid/test-lage-click.js     BASE = the commit before 068c3b (default acaf3bda); OLD_TREE = that tree already extracted
//   1. switch off / everything else: byte-equal to the old tree (measure scripts), protected files unchanged, the p5 handler count unchanged
//   2. base handler (the real text from sketch.js on fakes): lage 1 <-> 2 for the 3 shapes, ordnung kept, lines / redo stack cleared, gridRevision + 1, notices; refusals; the dialog; switch off
//   3. layer: toggleLayerLage (lage, lines, timeline lock, ceiling, switch off) and the handler branch
//   4. DOM: the dot class, aria-label and title of ui-form.js / ui-layer.js (real functions on fakes), de/en
//   5. the dot's measures against the shape symbols at 36 / 48 px; the info sentence; texts
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'acaf3bda';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const SK = read('sketch.js');
const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const dict = (() => { const src = read('ui-i18n.js'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2], en: k[3] }; return m; })();
const tIn = lang => (key, vars) => { const e = dict[key]; if (!e) return key; return e[lang || 'de'].replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] !== undefined ? vars[k] : '{' + k + '}'); };

// ---- 1. old tree ----------------------------------------------------------------------------------------------------------------------------
let oldDir = process.env.OLD_TREE || null;
if (!oldDir) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lageclick-old-'));
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
    check('(1) core/*.js (task 069 changed only the ceiling table in forms.js), tools/morph/off-path-golden.json and ui-phone-config.js are unchanged (setBaseLage / setLayerLage are only used)', fs.readdirSync(path.join(ROOT, 'core')).filter(f => /\.js$/.test(f) && f !== 'forms.js' && f !== 'orbits.js' && f !== 'export.js' && f !== 'glossary.js' && f !== 'symmetry.js' && f !== 'state.js' && f !== 'session.js').every(f => same('core/' + f)) && same('tools/morph/off-path-golden.json') && same('ui-phone-config.js'));
    const cnt = (s, rx) => (s.match(rx) || []).length;
    check('(1) the p5 handler count of sketch.js is unchanged (a branch in the existing handlers, no new one)', cnt(SK, /\.mousePressed\(/g) === cnt(fs.readFileSync(path.join(oldDir, 'sketch.js'), 'utf8'), /\.mousePressed\(/g));
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
const NAMES = ['shapeChangePlan', 'shapeLossWhat', 'shapeChangeText', 'sayShapeChange', 'toggleBaseLage', 'toggleLayerLage', 'sayLage', 'sayLageRefusal'];
const SHAPES = ['triangle', 'square', 'hex'];
const mk = (spec, setup, o) => {
    o = o || {};
    const log = { said: [], dialogs: [], calls: [] };
    const win = { UI: { t: tIn(o.lang) }, say: (k, text, kind) => log.said.push([k, text, kind]), timelineConfirm: d => log.dialogs.push(d) };
    const w = world(spec.shape, spec, { window: win, switchOff: o.switchOff });
    w.sb.UI = win.UI;
    NAMES.forEach(n => w.set(grab(n)));
    w.set(grab('addLayer')); w.set(grab('updateActiveLayerGrid'));
    const mkBtn = s => ({ s, active: s === spec.shape, handler: null, mousePressed(f) { this.handler = f; }, attribute: () => s, addClass() { this.active = true; }, removeClass() { this.active = false; }, hasClass() { return this.active; }, elt: { focus() { } } });
    const btns = SHAPES.map(mkBtn);
    Object.assign(w.sb, { shapeBtns: btns, syncGridControls: () => log.calls.push('sync'), renderLayerTabs() { }, updateOffsetControls() { }, updateTimelineControls() { }, updateSymmetryModeControl() { }, cancelAltNetConstruction() { }, redraw() { log.calls.push('redraw'); } });
    const a0 = SK.indexOf('shapeBtns.forEach(btn => {'), b0 = SK.indexOf('// Shape size (Number Input)');
    w.set(SK.slice(a0, b0));
    // the hook of core/state.js
    w.sb.gridControlsSync = () => log.calls.push('hook');
    if (setup) w.set(setup);
    return { w, btns, log, click: s => btns.find(b => b.s === s).handler() };
};
const st = x => x.w.get('JSON.stringify([gridSpec, connections, redoStack, additionalLayers.length, timeline, gridRevision])');

// ---- 2. base ----------------------------------------------------------------------------------------------------------------------------------
{
    for (const [shape, ord] of [['triangle', 3], ['square', 3], ['hex', 2]]) {
        const x = mk({ shape, ordnung: ord, lage: 1 }, 'connections = [[1, 2]]; redoStack = [[2, 3]];');
        const rev = x.w.get('gridRevision');
        x.click(shape);
        const a = x.w.get('({ lage: gridSpec.lage, ord: gridSpec.ordnung, c: connections.length, r: redoStack.length, rev: gridRevision, nodes: nodes.every(p => typeof p.u === "number") })');
        check(`(2) ${shape} ${ord}, second click on the active button: lage 2, ordnung kept, lines and redo stack cleared, gridRevision + 1, lage-2 nodes, the notice "Lage 2: Linien geleert. Erneut klicken: zurück zu Lage 1." (info), a redraw, the shape button stays active`,
            a.lage === 2 && a.ord === ord && a.c === 0 && a.r === 0 && a.rev === rev + 1 && a.nodes && J(x.log.said) === J([['lage-change', 'Lage 2: Linien geleert. Erneut klicken: zurück zu Lage 1.', 'info']]) && x.log.calls.includes('redraw') && x.btns.find(b => b.s === shape).active, J([a, x.log.said]));
        x.log.said.length = 0; x.w.set('connections = [[1, 3]];');
        x.click(shape);
        check(`(2) ${shape}: the next click goes back to lage 1 (notice "Lage 1: Linien geleert. Erneut klicken: Lage 2."), ordnung kept`, x.w.get('gridSpec.lage === 1 && gridSpec.ordnung === ' + ord) && x.log.said[0][1] === 'Lage 1: Linien geleert. Erneut klicken: Lage 2.');
        x.log.said.length = 0; x.click(shape); x.log.said.length = 0; x.click(shape);
        check(`(2) ${shape}: with nothing to clear the notice is only "Lage 1. Erneut klicken: Lage 2."`, x.log.said[0][1] === 'Lage 1. Erneut klicken: Lage 2.', J(x.log.said));
    }
    // refusals: ordnung above the lage-2 ceiling
    for (const [shape, ord, limit] of [['hex', 10, 9], ['hex', 11, 9], ['hex', 12, 9]]) {
        const x = mk({ shape, ordnung: ord, lage: 1 }, 'connections = [[1, 2]];');
        const before = st(x);
        x.click(shape);
        check(`(2) ${shape} ${ord} (above the lage-2 ceiling ${limit}, task 070): the click changes nothing, no dialog, the warning "Lage 2 gibt es nur bis Ordnung ${limit} (Dreieck 12, Quadrat 12, Sechseck 9)."`,
            st(x) === before && x.log.dialogs.length === 0 && J(x.log.said) === J([['lage-change', `Lage 2 gibt es nur bis Ordnung ${limit} (Dreieck 12, Quadrat 12, Sechseck 9).`, 'warn']]), J(x.log.said));
    }
    // the dialog
    let x = mk({ shape: 'square', ordnung: 3, lage: 1 }, "connections = [[1, 2]]; additionalLayers.push({ shape: 'square', connections: [], nodes: [] }); additionalLayers.push({ shape: 'square', connections: [], nodes: [] }); timeline = { keyframeLayerIds: [0, 1] };");
    let before = st(x);
    x.click('square');
    check('(2) with layers and a timeline the dialog comes first ("Lage wechseln?", "Beim Wechsel gehen Linien, Ebenen und Zeitleiste verloren ...", "Wechseln"), nothing changed, no notice yet', x.log.dialogs.length === 1 && x.log.dialogs[0].title === 'Lage wechseln?' && /^Beim Wechsel gehen Linien, Ebenen und Zeitleiste verloren/.test(x.log.dialogs[0].text) && x.log.dialogs[0].confirmLabel === 'Wechseln' && st(x) === before && x.log.said.length === 0, J(x.log.dialogs[0]));
    check('(2) cancel leaves the state unchanged', st(x) === before);
    x.log.dialogs[0].onConfirm();
    check('(2) confirm: lage 2, layers and timeline gone, the notice names what was cleared', x.w.get('gridSpec.lage === 2 && additionalLayers.length === 0 && timeline === null') && x.log.said[0][1] === 'Lage 2: Linien, Ebenen und Zeitleiste geleert. Erneut klicken: zurück zu Lage 1.', J(x.log.said));
    // no dialog for a refusal, even with layers
    x = mk({ shape: 'hex', ordnung: 10, lage: 1 }, "additionalLayers.push({ shape: 'square', connections: [], nodes: [] });");
    x.click('hex');
    check('(2) a refused change (ordnung above the ceiling) with layers asks nothing: the warning only', x.log.dialogs.length === 0 && x.log.said.length === 1 && x.log.said[0][2] === 'warn');
    // no switch (task 072d: this was "switch off: the click does nothing"; the gate is gone, the click is answered)
    x = mk({ shape: 'square', ordnung: 3, lage: 1 }, "connections = [[1, 2]]; additionalLayers.push({ shape: 'square', connections: [], nodes: [] });", { switchOff: true });
    before = st(x);
    x.click('square');
    check('(2) no switch: the click on the active shape is answered without any flag (the question about the layers, or the change): it is no longer ignored (reversed from "switch off: does nothing")', st(x) !== before || x.log.dialogs.length === 1, J([x.log.dialogs.length, x.log.said.length]));
    // English
    x = mk({ shape: 'triangle', ordnung: 3, lage: 1 }, 'connections = [[1, 2]];', { lang: 'en' });
    x.click('triangle');
    check('(2) English notice "Position 2: lines cleared. Click again: back to position 1."', x.log.said[0][1] === 'Position 2: lines cleared. Click again: back to position 1.', J(x.log.said));
    x = mk({ shape: 'hex', ordnung: 10, lage: 1 }, '', { lang: 'en' });
    x.click('hex');
    check('(2) English refusal "Position 2 is only available up to order 9 (triangle 12, square 12, hexagon 9)."', x.log.said[0][1] === 'Position 2 is only available up to order 9 (triangle 12, square 12, hexagon 9).', J(x.log.said));
    // a shape change keeps the lage (068c3a) and the old rebuild is gone for the active shape
    x = mk({ shape: 'square', ordnung: 3, lage: 2 }, '');
    x.click('triangle');
    check('(2) a change to ANOTHER shape at lage 2 keeps lage 2 (task 068c3a), the click on the active shape no longer rebuilds', x.w.get('gridSpec.lage === 2 && gridSpec.shape === "triangle" && gridSpec.ordnung === 3') && !/rebuildGrid\(currentShape\);\s*syncGridControls\(\);\s*sayShapeChange[\s\S]{0,40}if \(plan\.same/.test(SK) && /if \(plan\.same\) \{ toggleBaseLage\(\); return; \}/.test(SK));
}

// ---- 3. layer ---------------------------------------------------------------------------------------------------------------------------------
{
    const lay = (shape, ord, lage, setup, o) => { const x = mk({ shape: 'square', ordnung: 3, lage: 1 }, 'addLayer(); activeLayer = 0;', o); x.w.set(`updateActiveLayerGrid({ shape: ${J(shape)}, ordnung: ${ord} });` + (lage === 2 ? ' setLayerLage(additionalLayers[0], 2);' : '') + ' additionalLayers[0].connections = [[1, 2]];' + (setup || '')); x.log.said.length = 0; return x; };
    let x = lay('hex', 2, 1);
    x.w.set('toggleLayerLage(additionalLayers[0]);');
    const a = x.w.get('({ lage: additionalLayers[0].gridSpec.lage, ord: additionalLayers[0].gridSpec.ordnung, c: additionalLayers[0].connections.length, n: additionalLayers[0].nodes.length, base: gridSpec.lage })');
    check('(3) toggleLayerLage: a hex layer ordnung 2 -> lage 2 (43 nodes), lines cleared, the base untouched, notice "Lage 2: Linien geleert. ..."', a.lage === 2 && a.ord === 2 && a.c === 0 && a.n === 43 && a.base === 1 && x.log.said[0][1] === 'Lage 2: Linien geleert. Erneut klicken: zurück zu Lage 1.', J([a, x.log.said]));
    x.w.set('toggleLayerLage(additionalLayers[0]);');
    check('(3) ...and back to lage 1 (19 nodes)', x.w.get('additionalLayers[0].gridSpec.lage === 1 && additionalLayers[0].nodes.length === 19'));
    x = lay('hex', 10, 1);
    const b0 = x.w.get('JSON.stringify(additionalLayers[0])');
    x.w.set('toggleLayerLage(additionalLayers[0]);');
    check('(3) a layer above the ceiling (hex 10): nothing changes, the ceiling text', x.w.get('JSON.stringify(additionalLayers[0])') === b0 && x.log.said[0][1].startsWith('Lage 2 gibt es nur bis Ordnung 9'), J(x.log.said));
    x = lay('square', 2, 1, ' timeline = { keyframeLayerIds: [0, 1], playbackLayerIndex: null };');
    const b1 = x.w.get('JSON.stringify(additionalLayers[0])');
    x.w.set('toggleLayerLage(additionalLayers[0]);');
    check('(3) a timeline layer is locked: nothing changes, "Die Ebene gehört zur Zeitleiste; ihre Lage ist gesperrt." (warn)', x.w.get('JSON.stringify(additionalLayers[0])') === b1 && J(x.log.said) === J([['lage-change', 'Die Ebene gehört zur Zeitleiste; ihre Lage ist gesperrt.', 'warn']]), J(x.log.said));
    x = lay('square', 2, 1, '', { switchOff: true });
    const b2 = x.w.get('JSON.stringify(additionalLayers[0])');
    x.w.set('toggleLayerLage(additionalLayers[0]);');
    check('(3) no switch: the layer click changes the layer\'s lage without any flag (reversed from "switch off: does nothing")', x.w.get('JSON.stringify(additionalLayers[0])') !== b2);
    check('(3) the layer handler: the ACTIVE shape button calls toggleLayerLage before any shape change; no dialog (only that layer\'s lines are cleared)', /if \(additionalLayers\[activeLayer\] && additionalLayers\[activeLayer\]\.shape === btn\.attribute\('data-shape'\)\) \{ toggleLayerLage\(additionalLayers\[activeLayer\]\); return; \}/.test(SK) && !/function toggleLayerLage[\s\S]*?timelineConfirm[\s\S]*?\n\}\n/.test(SK.match(/function toggleLayerLage[\s\S]*?\n\}\n/)[0] + 'x') );
}

// ---- 4. DOM ------------------------------------------------------------------------------------------------------------------------------------
{
    const run = (file, which, ctxExtra, lang) => {
        const src = read(file);
        const a = src.indexOf('const SHAPE_NAME'), b = src.indexOf('\n  }\n', src.indexOf('function syncLage', a)) + 5;
        const code = src.slice(a, b) + '\nthis.syncLage = syncLage;';
        const btns = SHAPES.map(s => ({ s, cls: new Set(s === ctxExtra.active ? ['active'] : []), name: null, getAttribute(k) { return k === 'data-shape' ? this.s : null; }, classList: null }));
        btns.forEach(b => { b.classList = { contains: c => b.cls.has(c), toggle: (c, on) => { if (on) b.cls.add(c); else b.cls.delete(c); } }; });
        const sandbox = Object.assign({ tr: file === 'ui-form.js' ? (key, params, fb) => dict[key] ? tIn(lang)(key, params) : fb : (key, fb, params) => dict[key] ? tIn(lang)(key, params) : fb, UI: { name: (el, text) => { el.name = text; } },
            document: { querySelectorAll: () => btns }, layer: () => ctxExtra.layer || null }, ctxExtra.globals);
        vm.createContext(sandbox);
        vm.runInContext(code, sandbox);
        sandbox.syncLage();
        return btns;
    };
    const sw = () => ({ maxOrdnungFor: (s, l) => l === 2 ? { triangle: 12, square: 12, hex: 9 }[s] : 12 });   // task 072d: no switch any more
    const form = (spec, on, lang) => run('ui-form.js', 'form', { active: spec.shape, globals: Object.assign({ gridSpec: spec }, sw(on)) }, lang);
    let b = form({ shape: 'triangle', ordnung: 3, lage: 1 }, true);
    check('(4) form row, lage 1 within the ceiling: no dot; the active button says "Dreieck, Lage 1. Erneut klicken: Lage 2", the others their plain names', !b[0].cls.has('lage-2') && b[0].name === 'Dreieck, Lage 1. Erneut klicken: Lage 2' && b[1].name === 'Quadrat' && b[2].name === 'Sechseck', J(b.map(x => x.name)));
    b = form({ shape: 'square', ordnung: 3, lage: 2 }, true);
    check('(4) lage 2: the dot class on the active button only, "Quadrat, Lage 2. Erneut klicken: Lage 1"', b[1].cls.has('lage-2') && !b[0].cls.has('lage-2') && !b[2].cls.has('lage-2') && b[1].name === 'Quadrat, Lage 2. Erneut klicken: Lage 1', J(b.map(x => x.name)));
    b = form({ shape: 'hex', ordnung: 10, lage: 1 }, true);
    check('(4) above the ceiling (hex 10): no dot and no "Erneut klicken" (the click cannot work): plain "Sechseck"', !b[2].cls.has('lage-2') && b[2].name === 'Sechseck');
    b = form({ shape: 'triangle', ordnung: 3, lage: 1 }, false);
    check('(4) no switch: the hint "Erneut klicken" is there without any flag (reversed from "switch off: plain names")', b.every(x => !x.cls.has('lage-2')) && J(b.map(x => x.name)) === J(['Dreieck, Lage 1. Erneut klicken: Lage 2', 'Quadrat', 'Sechseck']));
    b = form({ shape: 'triangle', ordnung: 3, lage: 1 }, true, 'en');
    check('(4) English: "Triangle, position 1. Click again: position 2", "Square", "Hexagon"', J(b.map(x => x.name)) === J(['Triangle, position 1. Click again: position 2', 'Square', 'Hexagon']), J(b.map(x => x.name)));
    const L = (spec, on, tl, lang) => run('ui-layer.js', 'layer', { active: spec.shape, layer: { gridSpec: spec, shape: spec.shape }, globals: Object.assign({ layerGridSpecOf: l => l.gridSpec, timeline: tl, additionalLayers: [] }, sw(on)) }, lang);
    let lb = L({ shape: 'hex', ordnung: 2, lage: 2 }, true, null);
    check('(4) layer buttons: the dot follows the layer\'s lage 2 ("Sechseck, Lage 2. Erneut klicken: Lage 1")', lb[2].cls.has('lage-2') && lb[2].name === 'Sechseck, Lage 2. Erneut klicken: Lage 1' && lb[0].name === 'Dreieck', J(lb.map(x => x.name)));
    lb = L({ shape: 'hex', ordnung: 2, lage: 1 }, true, null);
    check('(4) layer lage 1: no dot, the hint "Lage 1. Erneut klicken: Lage 2"', !lb[2].cls.has('lage-2') && lb[2].name === 'Sechseck, Lage 1. Erneut klicken: Lage 2');
    const lay = { gridSpec: { shape: 'square', ordnung: 2, lage: 2 }, shape: 'square' };
    const lt = run('ui-layer.js', 'layer', { active: 'square', layer: lay, globals: Object.assign({ layerGridSpecOf: l => l.gridSpec, timeline: { keyframeLayerIds: [0], playbackLayerIndex: null }, additionalLayers: [lay] }, sw(true)) });
    check('(4) a timeline layer keeps its dot but shows no "Erneut klicken" (locked): "Quadrat"', lt[1].cls.has('lage-2') && lt[1].name === 'Quadrat', J(lt.map(x => x.name)));
    const lo = run('ui-layer.js', 'layer', { active: 'square', layer: null, globals: Object.assign({ layerGridSpecOf: l => l.gridSpec, additionalLayers: [] }, sw(true)) });
    check('(4) no active layer: no dot, plain names', lo.every(x => !x.cls.has('lage-2')) && lo[1].name === 'Quadrat');
    check('(4) both files call syncLage from the UI.onSync tick; aria-pressed stays with UI.pressed', /syncSymmetry\(\);\s*syncLage\(\);/.test(read('ui-form.js')) && /s\.refresh\(\); \}\); syncLage\(\); \}\);/.test(read('ui-layer.js')) && /forEach\(function \(b\) \{ UI\.pressed\(b\); \}\)/.test(read('ui-form.js')));
}

// ---- 5. the dot's measures; info sentence; texts ------------------------------------------------------------------------------------------------
{
    const css = read('style.css'), html = read('index.html');
    check('(5) style.css: .lage-2::after = the corner dot (top 5, right 5, currentColor), size = --target / 12 + 2 px (5 px at 36, 6 px at 48: it follows the button)', /\.shape-icon-btn\.lage-2::after, \.layer-shape-icon-btn\.lage-2::after \{\s*content: "";\s*position: absolute;\s*top: 5px;\s*right: 5px;\s*width: calc\(var\(--target\) \/ 12 \+ 2px\);[^\n]*\s*height: calc\(var\(--target\) \/ 12 \+ 2px\);\s*border-radius: 50%;\s*background: currentColor;\s*\}/.test(css) && (36 / 12 + 2 === 5) && (48 / 12 + 2 === 6));
    // symbol boxes from index.html (the 24-unit paths scaled to the 18 px icon, centred in the button)
    const boxes = { triangle: [3, 4.5, 21, 19.5], square: [4.5, 4.5, 19.5, 19.5], hex: [4, 3, 20, 21] };
    const rows = [];
    for (const [T, dot] of [[36, 5], [48, 6]]) for (const s of SHAPES) {
        const k = 18 / 24, off = (T - 18) / 2, [x0, y0, x1, y1] = boxes[s].map(v => v * k), sx1 = off + x1, sy0 = off + y0;
        const dx0 = T - 5 - dot, dy1 = 5 + dot;           // the dot: x from T-5-dot, y up to 5+dot
        const gap = Math.max(dx0 - sx1, sy0 - dy1);       // the larger of the horizontal and the vertical clearance (> 0: the boxes do not touch)
        rows.push([T, s, +gap.toFixed(2)]);
    }
    check('(5) measure: the dot clears every symbol box (triangle, square, hex) at 36 px (5 px dot) and 48 px (6 px dot): ' + rows.map(r => r.join('/')).join(' '), rows.every(r => r[2] > 0), J(rows));
    check('(5) the symbol paths in index.html are the ones measured (triangle M12 4.5 L21 19.5 H3, square 4.5..19.5, hex M12 3 .. 21)', /M12 4\.5 L21 19\.5 H3 Z/.test(html) && /x="4\.5" y="4\.5" width="15" height="15"/.test(html) && /M12 3 L20 7\.5 V16\.5 L12 21 L4 16\.5 V7\.5 Z/.test(html));
    check('(5) info card (task 071b): the sentence #info-lage is gone (markup and key info.lage); the operating hint lives in the aria-label / title of the shape button', !/id="info-lage"/.test(html) && !dict['info.lage']);
    const keys = ['shape.lage.state', 'reason.lage2.max', 'reason.lage.timeline', 'note.lage.2', 'note.lage.2.none', 'note.lage.1', 'note.lage.1.none', 'lage.confirm.title', 'lage.confirm.text'];
    check('(5) the ten new keys exist in German and English (non-empty, different)', keys.every(k => dict[k] && dict[k].de && dict[k].en && dict[k].de !== dict[k].en));
    check('(5) the grid line shows the lage through the name (2d1 -> 2d2): updateGridInfoLine takes the code from gridCodeFor (ordnung + d|q|* + lage; task 071: one function)', /code = gridCodeFor\(spec\)/.test(SK) && /spec\.ordnung \+ _LK_SHAPE_LETTER\[spec\.shape\] \+ spec\.lage/.test(read('core/orbits.js')));
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
