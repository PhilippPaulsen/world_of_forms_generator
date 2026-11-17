// Task 090, step 2: pre-checks for the hexagon Field faces (netWarpRefineFaces): (1) counter-check on the triangle (the refinement adds nothing: same polygons as the affine path), (2) frame time with faces, (3) vertices added.
//   node tools/grid/measure-net-hex-faces.js   -> JSON on stdout
'use strict';
const path = require('path');
const H = require(path.join(__dirname, '..', 'morph', 'render-harness.js'));
const J = JSON.stringify, MODE = 'rotation_reflection6';
const SPEC = { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.6 }, repeat: false, domain: 'field' };
const STUB = 'var __polys = [], __cur = null; push = function () { }; pop = function () { }; noStroke = function () { }; stroke = function () { }; noFill = function () { }; fill = function () { }; strokeWeight = function () { }; CLOSE = "close"; beginShape = function () { __cur = []; }; vertex = function (x, y) { __cur.push([x, y]); }; endShape = function () { __polys.push(__cur); };';
const worlds = {};
const W = (shape) => { if (!worlds[shape]) { worlds[shape] = H.makeRenderWorld(shape, 3, 3, MODE); worlds[shape].set('var canvasSizeSync = function () { width = canvasW; height = canvasH; };'); worlds[shape].set(STUB); } return worlds[shape]; };
const setup = (w, shape, X, Y, spec, n) => w.set(`currentShape = ${J(shape)}; projectGridSpec({ shape: ${J(shape)}, ordnung: 3, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y});
    symmetryMode = ${J(MODE)}; baseNetTransform = ${J(spec)}; baseNetAnimation = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; showFaces = false; rebuildGrid(currentShape);
    connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, ${n});`);
const out = { triangleCounterCheck: {}, hexRefine: {}, frameMs: {} };
// 1. the triangle: refine with the Field warp flagged refineFaces = true: no vertex is added, the polygons are identical
{
    const w = W('triangle');
    for (const [X, Y] of [[3, 5], [5, 5], [7, 5]]) {
        setup(w, 'triangle', X, Y, SPEC, 8);
        out.triangleCounterCheck[`${X}/${Y}`] = w.get(`(function () {
            const wp = netWarpBaseNow(), saved = activeNetWarp; activeNetWarp = Object.assign({}, wp, { refineFaces: true });
            let plain, refined; try { refined = computeCellFaces(connections, nodes, null); activeNetWarp = Object.assign({}, wp); plain = computeCellFaces(connections, nodes, null); } finally { activeNetWarp = saved; }
            let maxD = 0, addedVerts = 0; const pl = new Map(plain.nodes.map(n => [n.id, n])), rf = new Map(refined.nodes.map(n => [n.id, n]));
            plain.faces.forEach((f, i) => { const g = refined.faces[i]; addedVerts += g.nodeIds.length - f.nodeIds.length; f.nodeIds.forEach((id, k) => { const a = pl.get(id), b = rf.get(g.nodeIds[k]); maxD = Math.max(maxD, Math.hypot(a.x - b.x, a.y - b.y)); }); });
            return { faces: plain.faces.length, facesRefined: refined.faces.length, addedVertices: addedVerts, maxDiffPx: maxD };
        })()`);
    }
}
// 2 + 3. the hexagon
{
    const w = W('hex');
    for (const [X, Y] of [[3, 5], [5, 5], [7, 5], [9, 9]]) {
        setup(w, 'hex', X, Y, SPEC, 10);
        const t = (spec, faces) => { w.set(`baseNetTransform = ${J(spec)}; showFaces = ${faces};`); const a = []; for (let i = 0; i < 5; i++) { const t0 = process.hrtime.bigint(); w.set('__polys.length = 0; drawTessellation();'); a.push(Number(process.hrtime.bigint() - t0) / 1e6); } a.sort((p, q) => p - q); return Math.round(a[2] * 10) / 10; };
        const noFaces = t(SPEC, false), withFaces = t(SPEC, true), regFaces = t(null, true);
        out.frameMs[`${X}/${Y}`] = { fieldNoFaces: noFaces, fieldWithFaces: withFaces, noNetWithFaces: regFaces };
        w.set(`baseNetTransform = ${J(SPEC)}; showFaces = true;`);
        out.hexRefine[`${X}/${Y}`] = w.get(`(function () { const wp = netWarpBaseNow(), saved = activeNetWarp; activeNetWarp = wp; let r; try { r = computeCellFaces(connections, nodes, null); } finally { activeNetWarp = saved; }
            activeNetWarp = null; const plain = computeCellFaces(connections, nodes, null); activeNetWarp = saved;
            return { facesRegular: plain.faces.length, facesRefined: r.faces.length, verticesRegular: plain.faces.reduce((a, f) => a + f.nodeIds.length, 0), verticesRefined: r.faces.reduce((a, f) => a + f.nodeIds.length, 0), blocked: netWarpBlocksFaces() }; })()`);
    }
}
process.stdout.write(J(out, null, 1) + '\n');
