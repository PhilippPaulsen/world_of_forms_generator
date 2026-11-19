// Task 107 (throwaway prototype, NOT repo code): triangle and hexagon Field at EVEN sizes. Reads the real core files in the render harness and patches core/netwarp.js IN MEMORY only:
//   model A = lift the gate (even n allowed for 'triangle'/'hex') and let the triangle search start at the next odd count; nothing else changes (Rx, Ry stay odd, no shift T).
//   node tools/grid/measure-net-tri-hex-even.js [shape]     writes a table to stdout
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const MODE = 'rotation_reflection6', HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; };';
let src = fs.readFileSync(path.join(ROOT, 'core', 'netwarp.js'), 'utf8');
const rep = (a, b) => { if (!src.includes(a)) throw new Error('patch anchor missing: ' + a.slice(0, 50)); src = src.replace(a, b); };
rep("const sq = shape === 'square', evenOk = sq && n % 2 === 0;", "const sq = shape === 'square', evenOk = n % 2 === 0;");
rep('for (let Rx = R.x; Rx <= 21; Rx += 2) for (let Ry = R.y; Ry <= 21; Ry += 2)', 'for (let Rx = R.x | 1; Rx <= 21; Rx += 2) for (let Ry = R.y | 1; Ry <= 21; Ry += 2)');
const PATCHED = path.join(require('os').tmpdir(), 'netwarp-107-model-a.js'); fs.writeFileSync(PATCHED, src);
const FILES = { 'core/netwarp.js': PATCHED };
const world = shape => { const w = H.makeRenderWorld(shape, 3, 3, MODE, FILES); w.set(HOOK); return w; };
const setup = (w, shape, X, Y, spec) => w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: 3, lage: 1 })}); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600;
    setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; baseNetTransform = ${J(spec)}; baseNetAnimation = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base';
    baseFaceAssignments = new Map(); baseFacePalette = null; baseFaceAnchor = null; showFaces = false; rebuildGrid(currentShape);
    connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 8);`);
const law = { kind: 'trig', w: -0.8 }, spec = { x: law, y: { kind: 'trig', w: 0.56 }, repeat: false, domain: 'field' };
const shapes = process.argv[2] ? [process.argv[2]] : ['triangle', 'hex'];
const out = {};
for (const shape of shapes) {
    const w = world(shape);
    for (const [X, Y] of [[3, 3], [4, 4], [3, 4], [4, 3], [5, 5], [6, 6], [5, 6], [6, 5], [7, 7], [8, 8], [9, 9], [2, 4], [4, 2], [3, 5], [4, 6], [8, 9], [9, 8]]) {
        setup(w, shape, X, Y, spec);
        const r = w.get(`(function () {
            const wp = netWarpBaseNow(); const R = { canvas: [canvasW, canvasH], ctr: [Math.round(centroid.x * 100) / 100, Math.round(centroid.y * 100) / 100] };
            R.offCanvasCentre = Math.round(Math.hypot(centroid.x - canvasW / 2, centroid.y - canvasH / 2) * 100) / 100;
            if (!wp) { R.none = true; R.dom = netDomainEffective(baseNetTransform, _netSize(), currentShape); return R; }
            const f = wp.field; R.Rx = f.Rx; R.Ry = f.Ry; R.oddField = f.Rx % 2 === 1 && f.Ry % 2 === 1;
            let cov = true; for (let ix = 0; ix < 60; ix++) for (let iy = 0; iy < 60; iy++) if (!netWarpInsideNet(wp, { x: (ix + 0.5) / 60 * canvasW, y: (iy + 0.5) / 60 * canvasH })) cov = false; R.cov = cov;
            let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let inv = 0;
            for (let i = 0; i < 200; i++) { const p = { x: rnd() * canvasW, y: rnd() * canvasH }, q = applyNetWarp(wp, invertNetWarp(wp, p)); inv = Math.max(inv, Math.hypot(q.x - p.x, q.y - p.y)); } R.inv = inv;
            const ctr = { x: canvasW / 2, y: canvasH / 2 }; let mir = 0, rot = 0, mirC = 0;
            const ang = currentShape === 'hex' ? 60 : 120;
            for (let ix = 1; ix <= 7; ix++) for (let iy = 1; iy <= 7; iy++) { const p = { x: ix / 8 * canvasW, y: iy / 8 * canvasH }, q = applyNetWarp(wp, p);
                const m = applyNetWarp(wp, { x: 2 * centroid.x - p.x, y: p.y }); mir = Math.max(mir, Math.hypot(m.x - (2 * centroid.x - q.x), m.y - q.y));
                const a = applyNetWarp(wp, rotateAround(p, centroid, ang)), b = rotateAround(q, centroid, ang); rot = Math.max(rot, Math.hypot(a.x - b.x, a.y - b.y)); }
            R.mir = Math.round(mir * 10) / 10; R.rot = Math.round(rot * 10) / 10;
            // distance of the field centre (centre of the Rx x Ry parallelogram image under the identity) from the centroid
            const F = wp.frame, mid = { x: F.c0.x + (0.5) * F.v1.x + 0.5 * F.v2.x, y: F.c0.y + 0.5 * F.v1.y + 0.5 * F.v2.y }; R.fieldCentreOff = Math.round(Math.hypot(mid.x - centroid.x, mid.y - centroid.y) * 100) / 100;
            if (currentShape === 'hex') { let nc = 0, on = 0, strad = 0, nh = 0; const mw = { v1: { x: outerCorners[2].x - outerCorners[0].x, y: outerCorners[2].y - outerCorners[0].y }, v2: { x: outerCorners[4].x - outerCorners[0].x, y: outerCorners[4].y - outerCorners[0].y } };
                for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) { const sh = { x: i * mw.v1.x + j * mw.v2.x, y: i * mw.v1.y + j * mw.v2.y }, ce = { x: centroid.x + sh.x, y: centroid.y + sh.y }; if (ce.x < 0 || ce.x > canvasW || ce.y < 0 || ce.y > canvasH) continue; nh++;
                    const cs = outerCorners.map(p => netWarpTileCoords(wp, { x: p.x + sh.x, y: p.y + sh.y })); cs.forEach(c => { nc++; if (Math.abs(c.s - Math.round(c.s)) < 1e-6 && Math.abs(c.t - Math.round(c.t)) < 1e-6) on++; }); }
                R.nodePct = 100 * on / nc; R.hexInCanvas = nh; }
            let split = 0, sc = 0; for (let i = 0; i < 200; i++) { const p1 = { x: rnd() * canvasW, y: rnd() * canvasH }, p2 = { x: rnd() * canvasW, y: rnd() * canvasH }, pts = netWarpSplitSegment(wp, p1, p2); if (!pts) continue; sc++; const m = pts.map(p => applyNetWarp(wp, p));
                for (let k = 1; k < 20; k++) { const t = k / 20, q = applyNetWarp(wp, { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }); let best = 1e9; for (let j = 0; j + 1 < m.length; j++) { const a = m[j], b = m[j + 1], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, u = L ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L)) : 0; best = Math.min(best, Math.hypot(q.x - (a.x + u * dx), q.y - (a.y + u * dy))); } split = Math.max(split, best); } }
            R.split = split;
            showFaces = true; R.blocks = netWarpBlocksFaces(); R.faces = computeCellFaces(connections, nodes, null).faces.length; showFaces = false;
            return R;
        })()`);
        out[`${shape} ${X}/${Y}`] = r;
        const fmt = r.none ? 'NO WARP ' + J(r.dom) : `Rx×Ry ${r.Rx}×${r.Ry} cov=${r.cov} inv=${r.inv.toExponential(1)} split=${r.split.toExponential(1)} mir=${r.mir} rot=${r.rot} fieldCentreOff=${r.fieldCentreOff}` + (r.nodePct !== undefined ? ` nodes=${r.nodePct.toFixed(1)}% hexInCanvas=${r.hexInCanvas}` : '') + ` faces=${r.faces}`;
        console.log(`${shape} ${X}/${Y}  centroid-offset-from-canvas-centre=${r.offCanvasCentre}px  ${fmt}`);
    }
}
fs.writeFileSync(path.join(ROOT, 'reports', 'logs', '107-prototype.json'), J(out, null, 1));

// ---- section 2 (hex only): is netWarpTileOutsideCanvas still conservative at even sizes? Brute force: a tile flagged outside must have ALL mapped boundary samples (80 per edge) outside the canvas (1 px); and frame time.
if (shapes.includes('hex')) {
    const w = world('hex');
    for (const [X, Y] of [[3, 3], [5, 5], [4, 4], [6, 6], [8, 8], [4, 3], [6, 5], [9, 9]]) {
        setup(w, 'hex', X, Y, spec);
        const r = w.get(`(function () {
            const wp = netWarpBaseNow(), mw = { v1: { x: outerCorners[2].x - outerCorners[0].x, y: outerCorners[2].y - outerCorners[0].y }, v2: { x: outerCorners[4].x - outerCorners[0].x, y: outerCorners[4].y - outerCorners[0].y } };
            let tiles = 0, flagged = 0, falsePos = 0, missed = 0;
            for (let i = -16; i <= 16; i++) for (let j = -16; j <= 16; j++) {
                const ce = { x: centroid.x + i * mw.v1.x + j * mw.v2.x, y: centroid.y + i * mw.v1.y + j * mw.v2.y }, sh = { x: ce.x - centroid.x, y: ce.y - centroid.y };
                let inside = false;
                for (let e = 0; e < 6 && !inside; e++) { const a = outerCorners[e], b = outerCorners[(e + 1) % 6]; for (let k = 0; k <= 80; k++) { const t = k / 80, q = applyNetWarp(wp, { x: a.x + sh.x + t * (b.x - a.x), y: a.y + sh.y + t * (b.y - a.y) }); if (q.x >= -1 && q.x <= canvasW + 1 && q.y >= -1 && q.y <= canvasH + 1) { inside = true; break; } } }
                const f = netWarpTileOutsideCanvas(wp, ce, false, 1); tiles++; if (f) flagged++; if (f && inside) falsePos++; if (!f && !inside) missed++;
            }
            return { tiles, flagged, falsePos, notFlaggedButOutside: missed };
        })()`);
        const t = []; for (let i = 0; i < 3; i++) { const t0 = process.hrtime.bigint(); w.frame(); t.push(Number(process.hrtime.bigint() - t0) / 1e6); } t.sort((a, b) => a - b);
        console.log(`hex ${X}/${Y} tile-skip: ${J(r)}  frame(faces off) median-of-3 ${t[1].toFixed(0)} ms`);
    }
}

// ---- section 3: all pairs 3..9 x 3..9 within 1:3: largest (Rx, Ry), covered, any pair without a warp
for (const shape of shapes) {
    const w = world(shape); let maxX = 0, maxY = 0, n = 0, none = [], uncov = [], evenOnly = { maxX: 0, maxY: 0, n: 0 };
    for (let X = 3; X <= 9; X++) for (let Y = 3; Y <= 9; Y++) {
        if (Math.max(X, Y) > 3 * Math.min(X, Y)) continue;
        setup(w, shape, X, Y, spec);
        const r = w.get('(function () { const wp = netWarpBaseNow(); if (!wp) return null; let cov = true; for (let ix = 0; ix < 40; ix++) for (let iy = 0; iy < 40; iy++) if (!netWarpInsideNet(wp, { x: (ix + .5) / 40 * canvasW, y: (iy + .5) / 40 * canvasH })) cov = false; return { Rx: wp.field.Rx, Ry: wp.field.Ry, cov }; })()');
        n++; if (!r) { none.push([X, Y]); continue; } if (!r.cov) uncov.push([X, Y]);
        maxX = Math.max(maxX, r.Rx); maxY = Math.max(maxY, r.Ry); if (X % 2 === 0 || Y % 2 === 0) { evenOnly.n++; evenOnly.maxX = Math.max(evenOnly.maxX, r.Rx); evenOnly.maxY = Math.max(evenOnly.maxY, r.Ry); }
    }
    console.log(`sweep ${shape}: ${n} pairs, max Rx ${maxX}, max Ry ${maxY} (limit ${shape === 'hex' ? 27 : 21}), pairs without warp ${J(none)}, uncovered ${J(uncov)}, pairs with an even axis ${evenOnly.n} (max ${evenOnly.maxX}x${evenOnly.maxY})`);
}

// ---- section 4: two places that would misread an even triangle / hexagon Field if only the gate were lifted (read from the code, confirmed here)
for (const shape of shapes) {
    const w = world(shape); setup(w, shape, 4, 4, spec);
    const r = w.get(`(function () { const ex = netTransformExportData(baseNetTransform, nodeCount - 1, { x: 4, y: 4 }, netWarpBaseNow().meshes, currentShape);
        return { fieldBase: ex.fieldBase || null, gridShiftPx: ex.gridShiftPx || null, fieldTiles: ex.fieldTiles, fieldMeshes: ex.fieldMeshes, compatRegularToField: netAnimationCompat({ regular: true }, baseNetTransform) }; })()`);
    console.log(`${shape} 4/4 export + timeline compat:`, J(r));
}
