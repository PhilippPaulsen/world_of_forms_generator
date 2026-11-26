// Task 105 (N2a-1) measurements, not a test:  node tools/grid/measure-net-even.js [outdir]
//   A. frame time of the Field on ODD sizes, main (c8c51b5a, merge 105) against the working tree (drawTessellation via the harness, 10 orbit lines, median of 41, interleaved): the change must cost <= +3 %
//   B. the jump of the net picture against Aus at even sizes (px), 3 x 4 / 4 x 3 / 4 x 4 at the default size (600 px short side)
//   C. pictures (SVG): Fig. 14 sizes (4 columns x 3 rows) sinus and tangens, Aus (plain lines) next to the Field (mesh lines of netGridLines + the drawn frame); outdir/105-*.svg
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const J = JSON.stringify, MODE = 'rotation_reflection6', HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; };';
const out = process.argv[2] || path.join(os.tmpdir(), 'measure-net-even');
fs.mkdirSync(out, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mne-')), mainFile = path.join(dir, 'netwarp.js');
fs.writeFileSync(mainFile, execSync('git show c8c51b5a:core/netwarp.js', { cwd: ROOT, maxBuffer: 1 << 26 }));
const mk = files => { const w = H.makeRenderWorld('square', 3, 3, MODE, files); w.set(HOOK); return w; };
const setup = (w, X, Y, spec, conns) => w.set(`currentShape = 'square'; projectGridSpec({ shape: 'square', ordnung: 3, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600;
    setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = ${J(conns || [[1, 6], [2, 5]])}; redoStack = []; baseNetTransform = ${J(spec)}; baseNetAnimation = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base';
    baseFaceAssignments = new Map(); showFaces = false; rebuildGrid(currentShape); connections = ${J(conns || [[1, 6], [2, 5]])};`);
const SIN = { x: { kind: 'trig', w: -0.8 }, y: 'same', repeat: false, domain: 'field' }, TAN = { x: { kind: 'trig', w: 0.7 }, y: 'same', repeat: false, domain: 'field' };
const MIX = { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.6 }, repeat: false, domain: 'field' };
// A
{
    const wm = mk({ 'core/netwarp.js': mainFile }), wn = mk({}); const med = a => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
    console.log('A. frame time (ms, median of 41, interleaved): size, main, tree, tree/main');
    for (const [X, Y] of [[3, 3], [5, 5], [7, 7], [9, 9], [3, 5], [5, 9]]) {
        setup(wm, X, Y, MIX); setup(wn, X, Y, MIX); wm.frame(); wn.frame();
        const a = [], b = [];
        for (let i = 0; i < 41; i++) { let t = process.hrtime.bigint(); wm.frame(); a.push(Number(process.hrtime.bigint() - t) / 1e6); t = process.hrtime.bigint(); wn.frame(); b.push(Number(process.hrtime.bigint() - t) / 1e6); }
        const m = med(a), n = med(b); console.log(`   ${X}/${Y}  ${m.toFixed(2)}  ${n.toFixed(2)}  ${(100 * (n / m - 1)).toFixed(1)} %`);
    }
}
// B + C
{
    const w = mk({});
    console.log('B. jump of the picture against Aus (px) at the default size:');
    for (const [X, Y] of [[3, 4], [4, 3], [4, 4], [6, 5], [2, 5]]) {
        setup(w, X, Y, Object.assign({}, MIX, { keep: true, x: { kind: 'uniform', w: 0 }, y: 'same' }));
        const T = w.get('(function () { const wp = netWarpBaseNow(), p = { x: 100, y: 100 }, q = applyNetWarp(wp, p); return [q.x - p.x, q.y - p.y]; })()');
        console.log(`   ${X}/${Y}: e = ${600 / Math.min(X, Y)} px, jump (x, y) = (${T[0]}, ${T[1]}), canvas ${w.get('canvasW')} x ${w.get('canvasH')}`);
    }
    const svg = (name, X, Y, spec, field) => {
        setup(w, X, Y, field ? spec : null);
        const W = w.get('canvasW'), Hh = w.get('canvasH'), segs = w.frame();
        let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}"><rect width="100%" height="100%" fill="#fff"/><rect x="0.5" y="0.5" width="${W - 1}" height="${Hh - 1}" fill="none" stroke="#999"/>`;
        if (field) {
            const lines = w.get(`netGridLines(netTransformNow(), outerCorners, baseGridDivisions(), { x0: 0, y0: 0, x1: width, y1: height }, { closed: true, domain: 'field', fieldTiles: { x: ${X}, y: ${Y} } })`);
            lines.filter(l => l.level === 'macro').forEach(l => { s += `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#c00" stroke-width="1.5"/>`; });
        }
        segs.forEach(g => { s += `<line x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" stroke="#000" stroke-width="1"/>`; });
        fs.writeFileSync(path.join(out, name), s + '</svg>');
    };
    for (const [nm, spec] of [['sinus', SIN], ['tangens', TAN]]) { svg(`105-fig14-4x3-${nm}-feld.svg`, 4, 3, spec, true); svg(`105-fig14-3x4-${nm}-feld.svg`, 3, 4, spec, true); }
    svg('105-fig14-4x3-aus.svg', 4, 3, null, false); svg('105-fig14-4x4-aus.svg', 4, 4, null, false); svg('105-fig14-4x4-sinus-feld.svg', 4, 4, SIN, true);
    console.log('C. SVG written to', out);
}
