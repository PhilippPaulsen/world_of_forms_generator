// Task 068c2: the steppers' value is the ORDNUNG (triangle 1..6, square 1..12, hex 1..7; lage 2: 5/5/2), the legacy count c stays an internal bridge.
//   node tools/grid/test-ordnung-stepper.js     BASE = the commit before 068c2 (default e47bce44); OLD_TREE = that tree already extracted
//   1. everything byte-equal to the old tree (measure-g5a/g5b/g6a/g6b, measure-lage2-app)
//   2. the map old count c -> new ordnung: same spec and same grid for 3 shapes x every old value; c = 1 (legacyC1) shows as ordnung 1 with the same geometry
//   3. limits and clamps, base input path and layer path (updateActiveLayerGrid({ ordnung })) against the old count path
//   4. Sin/Tan minimum measured against the E >= 3 rule of core/netwarp.js
//   5. read-outs (info line, tooltips, input value/max) on fakes; texts de/en; the protected "Knoten" texts stay
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'e47bce44';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const SK = read('sketch.js');
const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };

// ---- 1. old tree ---------------------------------------------------------------------------------------------------------------------------------
let oldDir = process.env.OLD_TREE || null;
if (!oldDir) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ordnung-old-'));
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
    check('(1) core/faces.js, core/tiling.js, core/facecolor.js, core/orbits.js, core/export.js, core/state.js, core/session*.js, off-path-golden, ui-phone-config.js are unchanged', ['core/faces.js', 'core/tiling.js', 'core/facecolor.js', 'core/orbits.js', 'core/export.js', 'core/state.js', 'core/session.js', 'core/session-apply.js', 'tools/morph/off-path-golden.json', 'ui-phone-config.js'].every(same));
}
const P5 = ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect', 'translate', 'rotate', 'scale', 'textSize', 'text', 'textAlign', 'background', 'clear'];
function world(shape, spec, o) {
    const w = H.makeRenderWorld(shape, 3, 3, 'rotation_reflection6');
    const sb = w.sb;
    sb.document = (o && o.document) || { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.CLOSE = 'close'; sb.window = { UI: undefined };
    P5.forEach(f => { sb[f] = () => { }; });
    if (o && o.lage2) w.set('globalThis.__lage2 = true;');
    if (spec) w.set(`setGrid(${J(spec)});`);
    return w;
}
const withSketch = (w, names) => { names.forEach(n => w.set(grab(n))); return w; };
const SHAPES = ['triangle', 'square', 'hex'];

// ---- 2. the map old count -> new ordnung -----------------------------------------------------------------------------------------------------------
{
    const w = world('triangle');
    check('(2) helpers: countForOrdnung / ordnungForCount are inverse for ordnung >= 1 (triangle/square c = o + 1, hex c = o); c = 1 shows as ordnung 1', w.get(`(function () {
        for (const s of ['triangle', 'square', 'hex']) { for (let o = 1; o <= 13; o++) if (ordnungForCount(s, countForOrdnung(s, o)) !== o) return false; }
        return ordnungForCount('triangle', 1) === 1 && ordnungForCount('square', 1) === 1 && ordnungForCount('hex', 1) === 1 && countForOrdnung('hex', 3) === 3 && countForOrdnung('square', 3) === 4; })()`));
    check('(2) limits at lage 1: gridMaxOrdnung = 6 / 12 / 7 = the old count ceilings (7 / 13 / 7) minus the offset; maxOrdnungFor agrees', w.get("gridMaxOrdnung('triangle', 1) === 6 && gridMaxOrdnung('square', 1) === 12 && gridMaxOrdnung('hex', 1) === 7 && maxNodeCountFor('triangle') === 7 && maxNodeCountFor('square') === 13 && maxNodeCountFor('hex') === 7"));
    // every old value c -> the same grid through the new ordnung; the OLD path is fromLegacy(shape, c) + buildGrid
    let bad = [], n = 0;
    for (const shape of SHAPES) {
        const max = w.get(`maxNodeCountFor(${J(shape)})`);
        for (let c = 1; c <= max; c++) {
            const o = w.get(`ordnungForCount(${J(shape)}, ${c})`);
            const oldSpec = w.get(`fromLegacy(${J(shape)}, ${c})`), newSpec = w.get(`gridSpecForOrdnung(${J(shape)}, ${o}, 1)`);
            const g = spec => w.get(`JSON.stringify(buildGrid(${J(spec)}, { sizeFactor: 3, canvasW: 600, canvasH: 600 }))`);
            const a = JSON.parse(g(oldSpec)), b = JSON.parse(g(newSpec));
            n++;
            // the grid object carries the spec fields; compare nodes, centroid and corners (the legacy c = 1 marker is the only difference of the spec)
            const pos = nd => J(nd.map(p => [p.x, p.y]).sort());   // c = 1 of the square numbers its 4 corners cyclically, the raster of ordnung 1 by rows: the POSITIONS are the same, the ids are not (a legacyC1 state keeps its own spec, so its ids stay)
            const same = c >= 2 || shape === 'hex' ? J(a.nodes) === J(b.nodes) : pos(a.nodes) === pos(b.nodes);
            if (!same || J([a.centroid, a.outerCorners]) !== J([b.centroid, b.outerCorners]) || (c >= 2 || shape === 'hex' ? J(oldSpec) !== J(newSpec) : false)) bad.push(shape + c + '->' + o);
        }
    }
    check(`(2) every old value c (3 shapes x 1..max, ${n} cases) -> the new ordnung gives the same nodes, centroid and corners; for c >= 2 (and every hex) the same spec; c = 1 (legacyC1) has the same node POSITIONS (the square numbers its corners cyclically, ids differ, so a legacyC1 state keeps its own spec)`, n === 7 + 13 + 7 && bad.length === 0, bad.slice(0, 4).join(' | '));
    // a legacyC1 state shows ordnung 1 and still loads / builds
    const l = world('square');
    l.set("projectGridSpec(fromLegacy('square', 1)); rebuildGrid('square');");
    check('(2) a legacyC1 state (square c = 1): gridSpec.ordnung = 1 (what the input shows), nodeCount 1, 4 nodes; the session snapshot keeps legacyC1 and restores', l.get('gridSpec.ordnung === 1 && gridSpec.legacyC1 === true && nodeCount === 1 && nodes.length === 4')
        && (() => { const snap = JSON.parse(J(require(path.join(ROOT, 'tools/session/scenarios.js')).snapOf(l.ctx, require(path.join(ROOT, 'tools/session/scenarios.js')).uiOf(l.ctx, 'none', 6)))); return snap.settings.grid.legacyC1 === true && snap.settings.grid.ordnung === 1; })());
    // the base input path (the handler's body): setGrid(gridSpecForOrdnung(shape, v, lage)) = the old setGrid(fromLegacy(shape, c))
    let bad2 = [];
    for (const shape of SHAPES) for (let o = 1; o <= w.get(`gridMaxOrdnung(${J(shape)}, 1)`); o++) {
        const a = world(shape, null), b = world(shape, null);
        a.set(`currentShape = ${J(shape)}; setGrid(fromLegacy(${J(shape)}, countForOrdnung(${J(shape)}, ${o})));`);
        b.set(`currentShape = ${J(shape)}; setGrid(gridSpecForOrdnung(${J(shape)}, ${o}, gridSpec.lage));`);
        if (a.get('JSON.stringify([gridSpec, nodeCount, nodes])') !== b.get('JSON.stringify([gridSpec, nodeCount, nodes])')) bad2.push(shape + o);
    }
    check('(3) base input path: setGrid(gridSpecForOrdnung) = the old setGrid(fromLegacy(count)) for every ordnung of the new scale (spec, nodeCount, nodes)', bad2.length === 0, bad2.join(','));
    check('(3) over the limit the ordnung is clamped (triangle 9 -> 6, square 20 -> 12, hex 9 -> 7), 0 / negative -> 1; lage 2 (switch on): 5 / 5 / 2', w.get("gridSpecForOrdnung('triangle', 9, 1).ordnung === 6 && gridSpecForOrdnung('square', 20, 1).ordnung === 12 && gridSpecForOrdnung('hex', 9, 1).ordnung === 7 && gridSpecForOrdnung('hex', 0, 1).ordnung === 1")
        && world('triangle', null, { lage2: true }).get("gridSpecForOrdnung('triangle', 9, 2).ordnung === 5 && gridSpecForOrdnung('square', 9, 2).ordnung === 5 && gridSpecForOrdnung('hex', 9, 2).ordnung === 2 && gridMaxOrdnung('hex', 2) === 2"));
    check('(3) with the switch off lage 2 falls back to the lage-1 limit for the input max (gridMaxOrdnung(.., 2) = 6 / 12 / 7)', w.get("gridMaxOrdnung('triangle', 2) === 6 && gridMaxOrdnung('square', 2) === 12 && gridMaxOrdnung('hex', 2) === 7"));
    // the layer path: updateActiveLayerGrid({ ordnung: o }) = the old updateActiveLayerGrid({ nodeCount: c })
    let bad3 = [];
    for (const shape of SHAPES) {
        const mk = () => { const x = withSketch(world(shape, null), ['addLayer', 'updateActiveLayerGrid']); x.set('addLayer(); activeLayer = 0;'); return x; };
        for (let o = 1; o <= 14; o++) {
            const a = mk(), b = mk();
            const ra = a.get(`updateActiveLayerGrid({ nodeCount: countForOrdnung(${J(shape)}, ${o}) })`), rb = b.get(`updateActiveLayerGrid({ ordnung: ${o} })`);
            const d = x => x.get('JSON.stringify([additionalLayers[0].gridSpec, additionalLayers[0].nodeCount, additionalLayers[0].nodes, additionalLayers[0].connections])');
            if (d(a) !== d(b) || J(ra) !== J(rb)) bad3.push(shape + o);
        }
    }
    check('(3) layer input path: updateActiveLayerGrid({ ordnung: o }) = the old ({ nodeCount: c }) for o = 1..14 on all shapes (spec, nodes, clamp report, lines cleared)', bad3.length === 0, bad3.slice(0, 5).join(','));
    const sk2 = withSketch(world('square', { shape: 'square', ordnung: 3, lage: 2 }, { lage2: true }), ['addLayer', 'updateActiveLayerGrid']);
    sk2.set('addLayer(); activeLayer = 0;');
    const r2 = sk2.get('(function () { const a = updateActiveLayerGrid({ ordnung: 4 }); const s1 = additionalLayers[0].gridSpec; const b = updateActiveLayerGrid({ ordnung: 9 }); return [a, s1, b, additionalLayers[0].gridSpec]; })()');
    check('(3) layer path on lage 2: ordnung 4 kept at lage 2; 9 is clamped to 5 (clamp report in the internal count: from 10 to 6)', r2[1].ordnung === 4 && r2[1].lage === 2 && r2[3].ordnung === 5 && r2[3].lage === 2 && r2[2] && r2[2].from === 10 && r2[2].to === 6, J(r2));
}

// ---- 4. Sin/Tan minimum ------------------------------------------------------------------------------------------------------------------------
{
    const w = world('triangle');
    const r = w.get(`(function () { const bad = []; for (const s of ['triangle', 'square', 'hex']) for (let o = 1; o <= gridMaxOrdnung(s, 1); o++) {
        const spec = gridSpecForOrdnung(s, o, 1), c = countForOrdnung(s, o), E = getGridDivisions(spec), okByCount = c >= 4, okByE = E >= 3, okByMin = o >= gridMinOrdnungTrig(s);
        if (okByCount !== okByE || okByE !== okByMin) bad.push(s + o); } return bad; })()`);
    check('(4) the Sin/Tan minimum: for every shape and ordnung "old count c >= 4" = "E = getGridDivisions >= 3 (core/netwarp.js)" = "ordnung >= gridMinOrdnungTrig" (triangle 3, square 3, hex 4)', r.length === 0 && w.get("gridMinOrdnungTrig('triangle') === 3 && gridMinOrdnungTrig('square') === 3 && gridMinOrdnungTrig('hex') === 4"), J(r));
    check('(4) ui-form.js: the stepper minimum of a Sin/Tan net is gridMinOrdnungTrig, the limit gridMaxOrdnung; the message takes the ordnung; sketch.js sets the input to the ordnung minimum and says from/to', /function nodeMin\(\) \{ return trigNetActive\(\) \? \(typeof gridMinOrdnungTrig === 'function' \? gridMinOrdnungTrig\(currentShape\) : 3\) : 1; \}/.test(read('ui-form.js')) && /gridMaxOrdnung\(currentShape/.test(read('ui-form.js')) && /T\['reason\.node\.min\.trig'\]\(nodeMin\(\)\)/.test(read('ui-form.js'))
        && /const minO = gridMinOrdnungTrig\(currentShape\);[\s\S]*?\{ from: gridSpec\.ordnung, to: minO \}[\s\S]*?nodeInput\.value\(minO\)/.test(SK));
}

// ---- 5. read-outs and texts --------------------------------------------------------------------------------------------------------------------
{
    // getGridNodeCount = the number of nodes the builder makes
    const w = world('triangle', null, { lage2: true });
    const r = w.get(`(function () { const bad = []; for (const s of ['triangle', 'square', 'hex']) for (const lage of [1, 2]) for (let o = 1; o <= (lage === 2 ? (s === 'hex' ? 2 : 5) : 7); o++) { const spec = { shape: s, ordnung: o, lage }; if (getGridNodeCount(spec) !== buildGridNodes(spec, { allowLage2: true }).length) bad.push(s + o + 'L' + lage); }
        for (const s of ['triangle', 'square']) if (getGridNodeCount({ shape: s, ordnung: 1, lage: 1, legacyC1: true }) !== buildGridNodes({ shape: s, ordnung: 1, lage: 1, legacyC1: true }).length) bad.push(s + 'c1'); return bad; })()`);
    check('(5) getGridNodeCount equals the node list of buildGridNodes for 3 shapes x ordnung 1..7 x lage 1/2 and the legacyC1 marker', r.length === 0, J(r));
    // updateGridInfoLine on fake elements
    const els = {};
    const mkEl = (id, extra) => { const e = Object.assign({ id, textContent: '', attrs: {}, getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, closest() { return els['layer-stepper']; } }, extra || {}); els[id] = e; return e; };
    mkEl('grid-info-status'); mkEl('nav-node-stepper'); mkEl('layer-stepper'); mkEl('layer-node-count-input');
    const doc = { body: {}, getElementById: id => els[id] || null };
    const x = withSketch(world('triangle', { shape: 'triangle', ordnung: 2, lage: 1 }, { document: doc, lage2: true }), ['updateGridInfoLine']);
    x.set("activeLayer = 'base';");
    x.set('updateGridInfoLine();');
    check('(5) info line (de fallback): "Gitter: 2d1 · Knoten: 6", stepper tooltip "Ordnung 2: 6 Knoten"', els['grid-info-status'].textContent === 'Gitter: 2d1 · Knoten: 6' && els['nav-node-stepper'].attrs.title === 'Ordnung 2: 6 Knoten', J([els['grid-info-status'].textContent, els['nav-node-stepper'].attrs]));
    x.set("setGrid({ shape: 'square', ordnung: 3, lage: 2 }); updateGridInfoLine();");
    check('(5) lage 2 square 3: "Gitter: 3q2 · Knoten: 25" (16 + 9), tooltip "Ordnung 3: 25 Knoten"', els['grid-info-status'].textContent === 'Gitter: 3q2 · Knoten: 25' && els['nav-node-stepper'].attrs.title === 'Ordnung 3: 25 Knoten', els['grid-info-status'].textContent);
    x.set("addLayer = undefined;");
    x.set(`additionalLayers.push({ shape: 'hex', gridSpec: { shape: 'hex', ordnung: 2, lage: 1 }, nodeCount: 2 }); activeLayer = 0; updateGridInfoLine();`);
    check('(5) active layer: the line and the layer stepper tooltip show the layer\'s grid ("Gitter: 2*1 · Knoten: 19", "Ordnung 2: 19 Knoten"); the base tooltip stays the base\'s', els['grid-info-status'].textContent === 'Gitter: 2*1 · Knoten: 19' && els['layer-stepper'].attrs.title === 'Ordnung 2: 19 Knoten' && els['nav-node-stepper'].attrs.title === 'Ordnung 3: 25 Knoten', J([els['grid-info-status'].textContent, els['layer-stepper'].attrs, els['nav-node-stepper'].attrs]));
    check('(5) updatePatternNameStatus calls updateGridInfoLine first; #pattern-name-status itself is untouched (old name)', /function updatePatternNameStatus\(\) \{\s*const statusEl = select\('#pattern-name-status'\);\s*if \(!statusEl\) return;\s*updateGridInfoLine\(\);/.test(SK));
    // texts
    const dict = (() => { const src = read('ui-i18n.js'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2], en: k[3] }; return m; })();
    const keys = Object.keys(dict).filter(k => /^(node\.|layer\.node\.|layer\.nodes$|reason\.node\.|note\.net\.minNodes$|tip\.order$)/.test(k));
    check('(5) the stepper texts (node.*, layer.node.*, layer.nodes, reason.node.*, note.net.minNodes, tip.order): German says Ordnung, English says order, neither says Knoten / nodes (apart from the tooltip\'s count)', keys.length >= 15 && keys.every(k => (/Ordnung/.test(dict[k].de) && /[Oo]rder/.test(dict[k].en)) && !/Knoten|nodes\b|node\b/.test(dict[k].de.replace('Knoten', k === 'tip.order' ? '' : 'Knoten') + (k === 'tip.order' ? '' : dict[k].en)) || k === 'tip.order'), keys.filter(k => !/Ordnung/.test(dict[k].de)).join(','));
    check('(5) tip.order and info.grid.line carry the count word: "Ordnung {o}: {n} Knoten" / "Order {o}: {n} nodes", "Gitter: {name} · Knoten: {n}" / "Grid: {name} · Nodes: {n}"', dict['tip.order'].de === 'Ordnung {o}: {n} Knoten' && dict['tip.order'].en === 'Order {o}: {n} nodes' && dict['info.grid.line'].de === 'Gitter: {name} · Knoten: {n}' && dict['info.grid.line'].en === 'Grid: {name} · Nodes: {n}');
    const html = read('index.html');
    const stepper = html.slice(html.indexOf('id="nav-node-stepper"'), html.indexOf('id="nav-size-stepper"')), lstep = html.slice(html.indexOf('for="layer-node-count-input"'), html.indexOf('layer-shape-size-input') > 0 ? html.indexOf('id="layer-shape-size-group"') : undefined);
    check('(5) index.html: both steppers carry Ordnung (label, group, input, chevrons), no "Knoten"; the default value is 2 (the old 3 = ordnung 2); the node VISIBILITY texts stay (#btn-toggle-nodes "Toggle Nodes", more.farbe.button with "Knoten")', /Ordnung/.test(stepper) && !/Knoten/.test(stepper) && /Ordnung/.test(lstep) && !/Knoten/.test(lstep) && /id="node-count-input" min="1" max="7" value="2"/.test(html)
        && /id="btn-toggle-nodes"[^>]*title="Toggle Nodes"/.test(html) && /Mehr: Farben zurücksetzen, Knoten, Farborgel/.test(read('ui-i18n.js')));
    check('(5) the markup German equals the dictionary German for the stepper keys (test-i18n core), and the info line element exists without a control', /<span id="grid-info-status"><\/span>/.test(html) && !/<(button|input)[^>]*grid-info-status/.test(html));
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
