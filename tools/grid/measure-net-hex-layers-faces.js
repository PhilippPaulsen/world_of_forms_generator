// Task 112 (measurement, nothing in the tree is changed): the face fills of LAYERS under the hexagon Field. Today netWarpBlocksFaces() refuses every layer sheet on the hexagon Field
// (`w.refineFaces === true && sheet.morphRefine !== true`); a COPY of core/netwarp.js without that one clause is loaded through the render harness and measured:
//   node tools/grid/measure-net-hex-layers-faces.js [time|exact]      time: frame time with faces for 0, 1, 2, 3, 5 layers on the base grid, sizes 3/3 5/5 8/8 9/9, locked (main) against unlocked (copy)
//                                                                       exact: a layer that carries the SAME lines as the base draws the same face polygons as the base (set equality, 6 decimals), cover and overlap of the canvas
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..', '..'), J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const MODE = 'rotation_reflection6', HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; };';
const STUB = 'var __polys = [], __cur = null; push = function () { }; pop = function () { }; noStroke = function () { }; stroke = function () { }; noFill = function () { }; fill = function () { }; strokeWeight = function () { }; CLOSE = "close"; beginShape = function () { __cur = []; }; vertex = function (x, y) { __cur.push([x, y]); }; endShape = function () { __polys.push(__cur); __cur = null; };';
const src = fs.readFileSync(path.join(ROOT, 'core', 'netwarp.js'), 'utf8'), CLAUSE = '(w.refineFaces === true && sheet.morphRefine !== true) || ';
if (src.split(CLAUSE).length !== 2) throw new Error('lock clause not found once');
const PATCHED = path.join(os.tmpdir(), 'netwarp-112-unlocked.js'); fs.writeFileSync(PATCHED, src.replace(CLAUSE, ''));
const COUNT = STUB.replace('vertex = function (x, y) { __cur.push([x, y]); };', 'vertex = function () { };').replace('__polys.push(__cur); __cur = null;', '__n++; __cur = null;') + ' var __n = 0;';   // time mode: count the polygons, do not keep them (memory)
const mk = (files, stub) => { const w = H.makeRenderWorld('hex', 3, 3, MODE, files); w.set(HOOK); if (stub) w.set(stub === 'count' ? COUNT : STUB); return w; };
const FIELD = { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.56 }, repeat: false, domain: 'field' };
const setup = (w, X, nBase, layers, same) => {
    w.set(`currentShape = 'hex'; projectGridSpec({ shape: 'hex', ordnung: 3, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${X}); symmetryMode = ${J(MODE)};
        baseNetTransform = ${J(FIELD)}; baseNetAnimation = null; additionalLayers = []; timeline = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; showFaces = true; rebuildGrid(currentShape);
        connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, ${nBase});`);
    const all = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
    for (let k = 0; k < layers; k++) S.addLayer(w.ctx, { shape: 'hex', order: 3, size: X, mode: MODE, connections: same ? all.slice(0, nBase) : all.slice(k + 1, k + 1 + nBase), showFaces: true });
};
const med = a => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
const mode = process.argv[2] || 'time';
if (mode === 'time') {
    const W = { main: mk(undefined, 'count'), open: mk({ 'core/netwarp.js': PATCHED }, 'count') };   // p5 drawing stubs (as in the tests); the polygons are dropped before every frame
    for (const X of (process.argv[3] || '3,5,8,9').split(',').map(Number)) for (const layers of [0, 1, 2, 3, 5]) {
        const row = { size: X + '/' + X, layers };
        for (const k of ['main', 'open']) { const w = W[k]; setup(w, X, 10, layers, false); w.set('drawTessellation();'); const t = []; for (let i = 0; i < 3; i++) { const t0 = process.hrtime.bigint(); w.set('drawTessellation();'); t.push(Number(process.hrtime.bigint() - t0) / 1e6); } row[k] = Math.round(med(t)); }
        console.log(J(row));
    }
} else {
    const area = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
    const key = P => P.map(p => p[0].toFixed(5) + ',' + p[1].toFixed(5)).join(';');
    const polys = (w, base, lay, X) => { setup(w, X, 10, lay, true); w.set(`${base ? '' : 'connections = [];'} __polys.length = 0; ${base ? '' : 'additionalLayers.forEach(l => l.enabled = true);'} drawTessellation();`); return w.get('__polys.slice()'); };
    const w = mk({ 'core/netwarp.js': PATCHED }, true), wm = mk(undefined, true);
    for (const X of [3, 4, 5, 6, 8, 9]) {
        const b = polys(w, true, 0, X), l = polys(w, false, 1, X), lm = polys(wm, false, 1, X), inC = P => P.some(p => p[0] >= 0 && p[0] <= 600 && p[1] >= 0 && p[1] <= 600);
        const kb = new Set(b.filter(inC).map(key)), kl = new Set(l.filter(inC).map(key));
        console.log(J({ size: X, basePolys: b.length, layerPolysOpen: l.length, layerPolysLocked: lm.length, inCanvasBase: kb.size, inCanvasLayer: kl.size, missingInLayer: [...kb].filter(k => !kl.has(k)).length, extraInLayer: [...kl].filter(k => !kb.has(k)).length }));
    }
}
