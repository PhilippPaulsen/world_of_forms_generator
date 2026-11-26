// Task 113: the face fills of LAYERS on the base grid under the hexagon Field (netWarpBlocksFaces: the clause `refineFaces && !morphRefine`, which refused every layer sheet, is gone; the gridMatchesBase rule of the square and the triangle holds).
//   node tools/grid/test-net-field-hex-layer-faces.js      sabotage runs (section 8): NETWARP_JS, SKETCH_JS (mutated copies): every one must fail
//   1. a layer with the SAME lines as the base draws the same face polygons as the base (set equality, 6 decimals; sizes 3 4 5 6 8 9: even and odd); a layer with OTHER lines draws the polygons that the base draws for those lines
//   2. the colours of a layer's faces are those of the same lines without a net (the colour work runs before the refinement)
//   3. a layer that is offset, rotated, of another size or not on the base grid draws no faces (netWarpBlocksFaces, computeCellFaces, the drawn polygons); the base is never refused
//   4. the reason text: the hexagon-only sentence is gone from sketch.js (a base-grid layer under the hexagon Field has none); the sentence for a layer off the base grid stays
//   5. a timeline playback layer (on the base grid) draws faces; the spatial morph is unchanged (status netActive, every tile has faces)
//   6. square and triangle byte-equal to main: netWarpBlocksFaces for every sheet kind x size, and the polygons of a base-grid layer
//   7. Single and Tiled hexagon nets and no net: a layer's faces as on main
const fs = require('fs'), path = require('path'), os = require('os'), { execSync, spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js')), S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const CHILD = !!(process.env.NETWARP_JS || process.env.SKETCH_JS);
const MODE = 'rotation_reflection6', HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; };', MAIN = '08ce8cee';
const STUB = 'var __polys = [], __cur = null; push = function () { }; pop = function () { }; noStroke = function () { }; stroke = function () { }; noFill = function () { }; fill = function () { }; strokeWeight = function () { }; CLOSE = "close"; beginShape = function () { __cur = []; }; vertex = function (x, y) { __cur.push([x, y]); }; endShape = function () { __polys.push(__cur); __cur = null; };';
const FILES = {}; if (process.env.NETWARP_JS) FILES['core/netwarp.js'] = process.env.NETWARP_JS;
const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const mk = (shape, files, stub) => { const w = H.makeRenderWorld(shape, 3, 3, MODE, files === undefined ? FILES : files); w.set(HOOK); if (stub !== false) w.set(STUB); return w; };
const FIELD = { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.56 }, repeat: false, domain: 'field' };
const NETS = { field: FIELD, none: null, single: Object.assign({}, FIELD, { domain: 'single' }), tiled: Object.assign({}, FIELD, { domain: 'tiled', repeat: true }) };
const setup = (w, shape, X, net, nBase) => {
    w.set(`currentShape = ${J(shape)}; projectGridSpec({ shape: ${J(shape)}, ordnung: 3, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${X}); symmetryMode = ${J(MODE)};
        baseNetTransform = ${J(net)}; baseNetAnimation = null; additionalLayers = []; timeline = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; showFaces = true; rebuildGrid(currentShape);
        connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, ${nBase});`);
    return w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
};
const key = P => P.map(p => p[0].toFixed(5) + ',' + p[1].toFixed(5)).join(';'), inC = P => P.some(p => p[0] >= 0 && p[0] <= 600 && p[1] >= 0 && p[1] <= 600);
const drawn = (w, baseLines, layerSpec, shape, size) => { const all = setup(w, shape, size, NETS.field, 10); void all; return null; };
// polygons drawn for: the base lines `bl` (array of pairs or []), and one layer with `layer` (options for S.addLayer, or null)
const polys = (w, shape, X, net, bl, layer) => {
    const all = setup(w, shape, X, net, 10);
    w.set(`connections = ${J(bl === 'all' ? all.slice(0, 10) : bl === 'A' ? all.slice(2, 8) : [])}; additionalLayers = [];`);
    if (layer) S.addLayer(w.ctx, Object.assign({ shape, order: 3, size: X, mode: MODE, showFaces: true }, layer, { connections: layer.lines === 'all' ? all.slice(0, 10) : layer.lines === 'A' ? all.slice(2, 8) : all.slice(0, 4) }));
    w.set('__polys.length = 0; drawTessellation();'); return w.get('__polys.slice()');
};

// ---- 1. exactness --------------------------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0;
    const w = mk('hex');
    for (const X of CHILD ? [4, 5] : [3, 4, 5, 6, 8, 9]) for (const lines of ['all', 'A']) {
        const b = polys(w, 'hex', X, NETS.field, lines, null), l = polys(w, 'hex', X, NETS.field, 'none', { lines }); n++;
        const kb = new Set(b.filter(inC).map(key)), kl = new Set(l.filter(inC).map(key));
        if (!kb.size) note('empty', [X, lines]); if ([...kb].some(k => !kl.has(k)) || [...kl].some(k => !kb.has(k))) note('differs', [X, lines, kb.size, kl.size]);
        if (b.length !== l.length) note('count', [X, lines, b.length, l.length]);
    }
    check(`(1) a layer on the base grid draws the same face polygons as the base for the same lines (${n} cases: sizes 3 4 5 6 8 9 x all lines / a subset; 6 decimals, counts equal)`, !bad.first && (CHILD || n === 12), J(bad));
}

// ---- 3. layers off the base grid ---------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    const w = mk('hex'); let n = 0;
    for (const X of [4, 5]) for (const [name, layer] of [['offset', { offsetX: 20, offsetY: -10 }], ['rotated', { rotation: 17 }], ['both', { offsetX: -30, offsetY: 25, rotation: 90 }]]) {
        n++; const p = polys(w, 'hex', X, NETS.field, 'none', Object.assign({ lines: 'all' }, layer));
        const r = w.get('(function () { const l = additionalLayers[0]; return { blocks: netWarpBlocksFaces({ gridMatchesBase: layerGridMatchesBase(l) }), match: layerGridMatchesBase(l), faces: computeCellFaces(l.connections, l.nodes, null, null, faceSheetOverrideOfLayer(l)).faces.length }; })()');
        if (p.length !== 0 || !r.blocks || r.match || r.faces !== 0) note(name, [X, p.length, J(r)]);
    }
    for (const X of [4, 5]) { setup(w, 'hex', X, NETS.field, 10); const r = w.get('({ base: netWarpBlocksFaces(), baseNull: netWarpBlocksFaces(null), grid: netWarpBlocksFaces({ gridMatchesBase: true }), off: netWarpBlocksFaces({ gridMatchesBase: false }), none: netWarpBlocksFaces({}), morph: netWarpBlocksFaces({ gridMatchesBase: true, morphRefine: true }), morphOff: netWarpBlocksFaces({ gridMatchesBase: false, morphRefine: true }) })'); n++;
        if (r.base || r.baseNull || r.grid || !r.off || !r.none || r.morph || !r.morphOff) note('table', [X, J(r)]); }
    check(`(3) a layer that is offset, rotated or both draws no faces, the base and a base-grid sheet are not refused, a sheet off the base grid is (${n} cases)`, !bad.first && n === 8, J(bad));
}

// ---- 4. the reason text -----------------------------------------------------------------------------------------------------------------------------------
{
    const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
    if (/hexagon Field are drawn for the Base sheet only/.test(SKETCH)) note('hexSentence', 'sketch.js still says "Base sheet only" for the hexagon Field');
    if (/nw\.refineFaces && activeLayer !== 'base'/.test(SKETCH)) note('hexRule', 'the hexagon-only rule of faceFillsUnavailableReason is still there');
    if (!/Face fills on a Field are drawn for the Base sheet and for layers on the base grid \(same shape and size, no offset, no rotation\)/.test(SKETCH)) note('general', 'the general sentence for a layer off the base grid is gone');
    check('(4) sketch.js: the hexagon-only sentence "Base sheet only" and its rule are gone; the general sentence for a layer off the base grid stays', !bad.first, J(bad));
}

if (!CHILD) {
    // ---- 2. colours ------------------------------------------------------------------------------------------------------------------------------------------
    {
        const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0;
        const w = mk('hex', undefined, false);
        const colours = (net, X) => { const all = setup(w, 'hex', X, net, 10); S.addLayer(w.ctx, { shape: 'hex', order: 3, size: X, mode: MODE, showFaces: true, connections: all.slice(2, 8) });
            return w.get(`(function () { showFaces = true; const l = additionalLayers[0], r = computeCellFaces(l.connections, l.nodes, new Map(), null, faceSheetOverrideOfLayer(l)); return r.faces.map(f => [f.color === undefined ? null : f.color, f.key === undefined ? null : f.key]).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1); })()`); };
        for (const X of [3, 4, 5, 8]) { n++; const a = colours(NETS.field, X), b = colours(null, X); if (!a.length || J(a) !== J(b)) note('colours', [X, a.length, b.length]); }
        check(`(2) the faces of a layer sheet under the hexagon Field carry the same colours and keys as without a net (${n} sizes; the colour work runs before the refinement)`, !bad.first && n === 4, J(bad));
    }
    // ---- 5. playback layer and the spatial morph ----------------------------------------------------------------------------------------------------------
    {
        const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; };
        const w = mk('hex'); setup(w, 'hex', 5, NETS.field, 4);
        S.addLayer(w.ctx, { shape: 'hex', order: 3, size: 5, mode: MODE, connections: w.get('connections').map(p => p.slice()), playback: true, showFaces: true, enabled: true });
        w.set('__polys.length = 0; drawTessellation();'); const pp = w.get('__polys.length'); if (!(pp > 0)) note('playback', pp);
        const STUBM = fs.readFileSync(path.join(ROOT, 'tools', 'morph', 'test-spatial-morph-faces.js'), 'utf8').match(/const STUB = `([\s\S]*?)`;/);
        for (const X of [4, 5]) {
            const wm = H.makeRenderWorld('hex', 3, 3, 'rotation_reflection3', FILES); wm.set(HOOK); if (STUBM) wm.set(STUBM[1]);
            wm.set(`currentShape = 'hex'; projectGridSpec({ shape: 'hex', ordnung: 3, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${X}); symmetryMode = 'rotation_reflection3'; additionalLayers = []; timeline = null; showFaces = false; rebuildGrid(currentShape);`);
            const K0 = [[1, 10], [3, 14], [5, 20]], K1 = [[2, 11], [4, 15], [6, 21]]; wm.baseConnections(K0); const ids = [K0, K1].map(k => wm.addKeyframeLayer(k)); ids.forEach(i => wm.set(`additionalLayers[${i}].showFaces = true;`)); wm.setTimeline(ids);
            wm.set(`baseNetTransform = ${J({ x: { kind: 'trig', w: -0.8 }, y: 'same', repeat: false, domain: 'field' })};`); wm.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); wm.frame();
            const st = wm.get('spatialMorphRenderState.faceStats'); if (wm.status().code !== 'netActive' || !st || !(st.tiles > 0) || st.tilesWithFaces !== st.tiles) note('morph', [X, wm.status().code, J(st)]);
        }
        check('(5) a timeline playback layer draws faces under the hexagon Field; the spatial morph is unchanged (netActive, every tile has faces; sizes 4 and 5)', !bad.first, J(bad));
    }
    // ---- 6 / 7. square, triangle and the other nets byte-equal to main ----------------------------------------------------------------------------------------
    {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hexlay113-')), f = path.join(dir, 'netwarp.js'); fs.writeFileSync(f, execSync(`git show ${MAIN}:core/netwarp.js`, { cwd: ROOT, maxBuffer: 1 << 26 }));
        const bad = {}; const note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0, n7 = 0;
        const sheets = '[null, {}, { gridMatchesBase: true }, { gridMatchesBase: false }, { gridMatchesBase: true, morphRefine: true }, { gridMatchesBase: false, morphRefine: true }, { morphRefine: true }]';
        for (const shape of ['square', 'triangle']) { const a = mk(shape, undefined), b = mk(shape, { 'core/netwarp.js': f });
            for (const X of [3, 4, 5, 6, 9]) { setup(a, shape, X, NETS.field, 6); setup(b, shape, X, NETS.field, 6); n++;
                const ra = a.get(`${sheets}.map(s => netWarpBlocksFaces(s))`), rb = b.get(`${sheets}.map(s => netWarpBlocksFaces(s))`); if (J(ra) !== J(rb)) note('table', [shape, X, J(ra), J(rb)]);
                for (const lay of [{ lines: 'A' }, { lines: 'all', offsetX: 20, offsetY: -10 }]) { const pa = polys(a, shape, X, NETS.field, 'none', lay), pb = polys(b, shape, X, NETS.field, 'none', lay); n++; if (J(pa) !== J(pb)) note('polys', [shape, X, J(lay)]); } } }
        for (const net of ['none', 'single', 'tiled']) { const a = mk('hex', undefined), b = mk('hex', { 'core/netwarp.js': f });
            for (const X of [3, 4, 5]) for (const lay of [{ lines: 'A' }, { lines: 'all', rotation: 17 }]) { n7++; const pa = polys(a, 'hex', X, NETS[net], 'none', lay), pb = polys(b, 'hex', X, NETS[net], 'none', lay); if (J(pa) !== J(pb)) note('hexOther', [net, X, J(lay)]); } }
        check(`(6) square and triangle with a Field: netWarpBlocksFaces for 7 sheet kinds and the polygons of a base-grid and an offset layer byte-equal to main ${MAIN} (${n} cases)`, !bad.first && n === 30, J(bad));
        check(`(7) hexagon without a net, with a Single or Tiled net: a layer's polygons byte-equal to main (${n7} cases)`, !bad.first && n7 === 18, J(bad));
    }
    // ---- 8. sabotage runs ---------------------------------------------------------------------------------------------------------------------------------------
    {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hexlay113s-')), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
        const GATE = "(!!sheet && !sheet.gridMatchesBase)";
        const SAB = [
            ['the old clause is back (every hexagon layer refused)', 'NETWARP_JS', 'core/netwarp.js', GATE, "(!!sheet && ((w.refineFaces === true && sheet.morphRefine !== true) || !sheet.gridMatchesBase))"],
            ['a layer off the base grid is freed', 'NETWARP_JS', 'core/netwarp.js', GATE, "false"],
            ['the grid rule is inverted (only layers OFF the base grid get faces)', 'NETWARP_JS', 'core/netwarp.js', GATE, "(!!sheet && !!sheet.gridMatchesBase)"],
            ['the tile skip skips every tile (the layer loses its polygons)', 'NETWARP_JS', 'core/netwarp.js', "    return x1 < -m || x0 > W + m || y1 < -m || y0 > H + m;", "    return true;"],
            ['the hexagon-only sentence is back in sketch.js', 'SKETCH_JS', 'sketch.js', "    if (curveType.kind !== 'straight') return 'Face fills need straight lines", "    if (nw && nw.refineFaces && activeLayer !== 'base') return 'Face fills on a hexagon Field are drawn for the Base sheet only (task 090).';\n    if (curveType.kind !== 'straight') return 'Face fills need straight lines"],
        ];
        let red = 0; const notRed = [];
        SAB.forEach(([name, envKey, file, from, to], i) => { const src = rd(file); if (src.split(from).length !== 2) { notRed.push([name, 'pattern not found once']); return; }
            const f = path.join(dir, 'sab' + i + '-' + path.basename(file)); fs.writeFileSync(f, src.replace(from, () => to));
            const r = spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { [envKey]: f }), encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) red++; else notRed.push([name, 'still green']); });
        check(`(8) ${SAB.length} sabotage runs on mutated copies: every one fails the test`, red === SAB.length && notRed.length === 0, J(notRed));
    }
}
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
