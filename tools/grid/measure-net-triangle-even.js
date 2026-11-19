// Task 108: frame time of the triangle Field, main (6857f36c) against the tree: odd sizes (must be within +3 %), and the even sizes next to their odd neighbours (reported).
//   node tools/grid/measure-net-triangle-even.js
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const MODE = 'rotation_reflection6', HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; };';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tri108m-')), mainFile = path.join(dir, 'netwarp.js');
fs.writeFileSync(mainFile, execSync('git show 6857f36c:core/netwarp.js', { cwd: ROOT, maxBuffer: 1 << 26 }));
const mk = files => { const w = H.makeRenderWorld('triangle', 3, 3, MODE, files); w.set(HOOK); return w; };
const W = { main: mk({ 'core/netwarp.js': mainFile }), tree: mk({}) };
const spec = { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.56 }, repeat: false, domain: 'field' };
const setup = (w, X, Y) => w.set(`currentShape = 'triangle'; projectGridSpec({ shape: 'triangle', ordnung: 3, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600;
    setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; baseNetTransform = ${J(spec)}; baseNetAnimation = null; additionalLayers = []; timeline = null; baseFaceAssignments = new Map(); showFaces = false; rebuildGrid(currentShape);
    connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 10);`);
const med = a => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
const time = (w, X, Y, n) => { setup(w, X, Y); w.frame(); const t = []; for (let i = 0; i < n; i++) { const t0 = process.hrtime.bigint(); w.frame(); t.push(Number(process.hrtime.bigint() - t0) / 1e6); } return med(t); };
for (const [X, Y] of [[3, 3], [5, 5], [7, 5], [9, 9], [4, 4], [6, 6], [8, 8], [4, 3]]) {
    const odd = X % 2 === 1 && Y % 2 === 1; let a = [], b = [];
    for (let r = 0; r < 5; r++) { a.push(time(W.main, X, Y, 5)); b.push(time(W.tree, X, Y, 5)); }   // interleaved rounds, median of medians
    const ma = med(a), mb = med(b);
    console.log(`${X}/${Y} ${odd ? 'odd ' : 'even'}  main ${odd ? ma.toFixed(1) : '(no net)'} ms   tree ${mb.toFixed(1)} ms` + (odd ? `   ${(100 * (mb / ma - 1)).toFixed(1)} %` : ''));
}
