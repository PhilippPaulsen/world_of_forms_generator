// Task 092: the net-lines overlay (netGridLines, drawNetLinesOverlay) of the triangle and hexagon Field: the MESH lines (s, t = integer in the base mesh's frame), mapped, clipped to the canvas. Before: a triangle has 3 corners,
// netGridLines read corners[3] and threw inside draw() (the rest of the frame - frame and nodes - vanished).
//   node tools/grid/test-net-lines-overlay.js      sabotage runs: NETWARP_JS (mutated copy of core/netwarp.js)
//   1. triangle 3/5, 5/5, 7/5, 9/9 and hexagon 5/5, 9/9 x sinus, geometric: lines > 0, all inside the canvas, every line lies on its mapped mesh line (< 1e-9 px)
//   2. the real drawNetLinesOverlay (cut out of sketch.js) draws exactly those lines for the triangle and the hexagon and does not throw
//   3. the square's overlay (with and without a Field, Single, Tiled) is byte-equal to main; a triangle without a Field gives no lines and no error
//   4. opts.diagonal (pictures only) adds diagonal lines and leaves the mesh lines as they are
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const { makeRenderWorld } = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const FILES = process.env.NETWARP_JS ? { 'core/netwarp.js': process.env.NETWARP_JS } : undefined;
const world = (shape, files) => makeRenderWorld(shape, 3, 3, 'rotation_reflection6', files === undefined ? FILES : files);
const setup = (w, shape, X, Y, spec) => w.set(`currentShape = ${J(shape)}; projectGridSpec({ shape: ${J(shape)}, ordnung: 4, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y}); rebuildGrid(currentShape); baseNetTransform = ${J(spec)};`);
const fieldSpec = (law) => ({ x: law, y: 'same', repeat: false, domain: 'field' });
const LAWS = { sinus: { kind: 'trig', w: -0.7 }, geometric: { kind: 'geometric', w: Math.log(4) } };
const OPTS = `(function () { const nw = netWarpBaseNow(); if (!nw) return null; const f = nw.field; return { closed: true, domain: 'field', fieldTiles: f.Rx !== undefined ? { x: f.Rx, y: f.Ry } : f.Rt, frame: nw.meshes ? nw.frame : undefined }; })()`;

{
    const bad = {}, note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0;
    for (const [shape, sizes] of [['triangle', [[3, 5], [5, 5], [7, 5], [9, 9]]], ['hex', [[5, 5], [9, 9]]]]) {
        const w = world(shape);
        for (const [X, Y] of sizes) for (const [ln, law] of Object.entries(LAWS)) {
            setup(w, shape, X, Y, fieldSpec(law)); n++;
            const r = w.get(`(function () { let L; try { L = netGridLines(netTransformNow(), outerCorners, baseGridDivisions(), { x0: 0, y0: 0, x1: width, y1: height }, ${OPTS}); } catch (e) { return { err: String(e) }; }
                const nw = netWarpBaseNow(), F = _netFrame(nw), [hx, hy] = _netFieldH(nw); let inside = true, worst = 0;
                L.forEach(l => { for (const p of [{ x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 }]) if (p.x < -1e-9 || p.x > width + 1e-9 || p.y < -1e-9 || p.y > height + 1e-9) inside = false;
                    // the line lies on ONE mesh line: the frame coordinate s (v) / t (h) of the preimage is the same integer - h at both ends and the middle
                    const pts = [{ x: l.x1, y: l.y1 }, { x: (l.x1 + l.x2) / 2, y: (l.y1 + l.y2) / 2 }, { x: l.x2, y: l.y2 }].map(p => netWarpTileCoords(nw, invertNetWarp(nw, p)));
                    const u = pts.map(c => (l.axis === 'v' ? c.s : c.t) + (l.axis === 'v' ? hx : hy)); const k = Math.round(u[0]); worst = Math.max(worst, ...u.map(x => Math.abs(x - k))); });
                return { n: L.length, inside, worst, v: L.filter(l => l.axis === 'v').length, h: L.filter(l => l.axis === 'h').length, micro: L.filter(l => l.level === 'micro').length }; })()`);
            if (r.err) { note('threw', [shape, X, Y, r.err]); continue; }
            if (!(r.n > 0 && r.v > 0 && r.h > 0)) note('empty', [shape, X, Y, ln, J(r)]); if (!r.inside) note('outside', [shape, X, Y, ln]); if (r.worst > 1e-9) note('offline', [shape, X, Y, ln, r.worst]); if (r.micro) note('micro', [shape, X, Y]);
        }
    }
    check(`(1) triangle 3/5 ... 9/9, hexagon 5/5, 9/9 x 2 laws (${n} cases): mesh lines (> 0 in both directions, no subdivisions), inside the canvas, on their mapped mesh line (< 1e-9 px)`, n === 12 && !bad.first, J(bad));
}
{
    // (2) the real drawNetLinesOverlay
    const SK = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8'), m = SK.match(/function drawNetLinesOverlay\(\) \{[\s\S]*?\n\}\n/);
    const bad = []; 
    for (const [shape, X, Y] of [['triangle', 5, 5], ['triangle', 3, 5], ['hex', 5, 5], ['square', 5, 5]]) {
        const w = world(shape); setup(w, shape, X, Y, fieldSpec(LAWS.sinus));
        w.set(`var netLinesOn = true, __lines = 0; push = function () { }; pop = function () { }; strokeWeight = function () { }; stroke = function () { }; line = function () { __lines++; };`);
        w.set(m[0]);
        let err = null; try { w.set('drawNetLinesOverlay();'); } catch (e) { err = String(e).slice(0, 80); }
        const want = w.get(`netGridLines(netTransformNow(), outerCorners, baseGridDivisions(), { x0: 0, y0: 0, x1: width, y1: height }, ${OPTS}).length`);
        if (err || w.get('__lines') !== want || !(want > 0)) bad.push([shape, X, Y, err, w.get('__lines'), want]);
    }
    check('(2) drawNetLinesOverlay (from sketch.js) draws the lines of netGridLines for the triangle, hexagon and square and does not throw', bad.length === 0, J(bad));
}
{
    // (3) square byte-equal to main, a triangle without a Field: no lines, no error
    let mainSrc = null; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wof092-'));
    try { mainSrc = path.join(dir, 'netwarp.js'); fs.writeFileSync(mainSrc, execSync('git show 59710e59:core/netwarp.js', { cwd: ROOT, maxBuffer: 1 << 26 })); } catch (e) { mainSrc = null; }
    const bad = {}; let n = 0;
    if (mainSrc) {
        const specs = [fieldSpec(LAWS.sinus), fieldSpec(LAWS.geometric), { x: LAWS.sinus, y: 'same', repeat: false, domain: 'single' }, { x: LAWS.sinus, y: 'same', repeat: true, domain: 'tiled' }, null];
        const wa = world('square'), wb = world('square', { 'core/netwarp.js': mainSrc });
        for (const sz of [3, 5, 7]) for (const spec of specs) for (const [k, optsCode] of [['field', OPTS], ['plain', '{ closed: true }'], ['none', '{}']]) { setup(wa, 'square', sz, sz, spec); setup(wb, 'square', sz, sz, spec); n++;
            const code = `(function () { try { return JSON.stringify(netGridLines(netTransformNow(), outerCorners, baseGridDivisions(), { x0: 0, y0: 0, x1: width, y1: height }, ${optsCode} || { closed: true })); } catch (e) { return 'ERR'; } })()`;
            if (wa.get(code) !== wb.get(code)) bad.square = (bad.square || 0) + 1; }
    }
    const wt = world('triangle'); setup(wt, 'triangle', 5, 5, { x: LAWS.sinus, y: 'same', repeat: false, domain: 'single' });
    const t = wt.get(`(function () { try { return netGridLines(netTransformNow(), outerCorners, baseGridDivisions(), { x0: 0, y0: 0, x1: width, y1: height }, { closed: true }).length; } catch (e) { return 'ERR'; } })()`);
    check(`(3) square overlay (${n} cases: Field, Single, Tiled, none; three option sets) byte-equal to main; a triangle without a Field: no lines, no error`, n === 45 && !bad.square && t === 0, J([bad, t]));
}
{
    const w = world('triangle'); setup(w, 'triangle', 5, 5, fieldSpec(LAWS.sinus));
    const r = w.get(`(function () { const o = ${OPTS}; const a = netGridLines(netTransformNow(), outerCorners, baseGridDivisions(), { x0: 0, y0: 0, x1: width, y1: height }, o), b = netGridLines(netTransformNow(), outerCorners, baseGridDivisions(), { x0: 0, y0: 0, x1: width, y1: height }, Object.assign({ diagonal: true }, o));
        return { mesh: a.length, withDiag: b.length, diag: b.filter(l => l.axis === 'd').length, same: JSON.stringify(b.filter(l => l.axis !== 'd')) === JSON.stringify(a) }; })()`);
    check('(4) opts.diagonal (pictures only) adds diagonal lines and leaves the mesh lines as they are', r.diag > 0 && r.same && r.withDiag === r.mesh + r.diag, J(r));
}
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
