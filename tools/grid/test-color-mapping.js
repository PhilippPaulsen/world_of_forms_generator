// Task 083: the re-keying of the face colours at a size change (core/state.js _mapTrailKeys, _rekeyColors): the smallest new face that contains a scaled interior point (class c), one old trail may take several
// new keys (class b), a new key belongs to one old key only; the dry run = the real run. The fixed cases are the examples of reports/082.md.   node tools/grid/test-color-mapping.js     STATE_JS = a mutated copy
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify, MODE = 'rotation_reflection6';
const worlds = {};
const W = (shape) => worlds[shape] || (worlds[shape] = H.makeRenderWorld(shape, 3, 3, MODE));
const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i].y > pt.y) !== (poly[j].y > pt.y) && pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) c = !c; return c; };
// the picture of the base sheet: every face with its trail key, colour, polygon, area, interior points
const picture = (w) => w.get(`(function () { const r = computeCellFaces(connections, nodes, baseFaceAssignments); const g = sheetGroupElements(nodes, null); const keys = computeFaceTrailKeys(r, g); const byId = new Map(r.nodes.map(n => [n.id, n]));
    return r.faces.map((f, i) => { const poly = f.nodeIds.map(id => ({ x: byId.get(id).x, y: byId.get(id).y })); return { key: keys[i], color: f.color, poly, area: Math.abs(f.area), samples: keys[i] === null ? [] : faceSamplePoints(poly) }; }); })()`);
const setup = (w, c) => {
    const [X, Y] = c.from;
    w.set(`currentShape = ${J(c.shape)}; projectGridSpec(${J({ shape: c.shape, ordnung: c.ord, lage: c.lage })}); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = ${J(c.conns)}; redoStack = []; baseNetTransform = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base'; baseFacePalette = null; baseFaceAnchor = null; baseLastHarmonyType = null; baseLastSelection = null; baseDistributionStrategy = null; spatialMorph = { enabled: false, mode: 'linear', angleDeg: 0 };
        (function () { const r = computeCellFaces(connections, nodes, null); const g = sheetGroupElements(nodes, null); const keys = computeFaceTrailKeys(r, g); baseFaceAssignments = new Map(); let i = 0; keys.forEach(k => { if (k !== null && !baseFaceAssignments.has(k)) { baseFaceAssignments.set(k, { hue: (i * 5) % 24, w: 0.1 + (i % 7) * 0.1, s: 0.1 + (Math.floor(i / 7) % 7) * 0.1, rule: 'tetrad', params: null, displayColor: null }); i++; } }); })();`);
};
// run one size change for real; -> { kept, total, wrong, rep (the real report), dry (the dry-run report) }
function run(c) {
    const w = W(c.shape); setup(w, c);
    const before = picture(w), [X1, Y1] = c.from, [X2, Y2] = c.to;
    const w1 = w.get('canvasW'), h1 = w.get('canvasH'), f = Math.min(X1, Y1) / Math.min(X2, Y2);
    const state0 = w.get('JSON.stringify([Array.from(baseFaceAssignments.keys()), nodes, canvasW, canvasH])');
    const dry = w.get(`resizeBase(${X2}, ${Y2}, { dryRun: true })`);
    const dryClean = w.get('JSON.stringify([Array.from(baseFaceAssignments.keys()), nodes, canvasW, canvasH])') === state0;
    const rep = w.get(`resizeBase(${X2}, ${Y2})`);
    const after = picture(w), w2 = w.get('canvasW'), h2 = w.get('canvasH');
    const scale = (p) => ({ x: w2 / 2 + (p.x - w1 / 2) * f, y: h2 / 2 + (p.y - h1 / 2) * f });
    const sorted = after.map(a => a).sort((a, b) => a.area - b.area);
    let kept = 0, total = 0, wrong = [];
    const colours = new Set(before.filter(b => b.key !== null).map(b => b.color));
    const oldSorted = before.map((b, i) => ({ b, i })).sort((x, y) => x.b.area - y.b.area);
    before.forEach((of, i) => {
        if (of.key === null || !of.samples.length) return;
        // an interior point of THIS face: not one that lies inside a smaller old face (the outer face of a nested pair has its centre in the inner one)
        const own = of.samples.find(sp => { const h = oldSorted.find(o => inPoly(sp, o.b.poly)); return h && h.i === i; });
        if (!own) return;
        total++;
        const p = scale(own), hit = sorted.find(a => inPoly(p, a.poly));   // the smallest new face that contains the scaled interior point
        if (hit && hit.color === of.color) kept++; else wrong.push(i);
    });
    return { kept, total, wrong, rep, dry, dryClean, distinct: colours.size, trails: new Set(before.map(b => b.key)).size };
}
const sameReport = (a, b) => J([a.kept, a.lost, a.hints]) === J([b.kept, b.lost, b.hints]) && a.changed === b.changed;

// ---- (c) nested faces: the inner face must not take the outer face's colour -----------------------------------------------------------------------------------
const C = [
    { name: 'triangle ord 4 ring [[1,11],[5,8]] 3/3 -> 3/5', shape: 'triangle', ord: 4, lage: 1, conns: [[1, 11], [5, 8]], from: [3, 3], to: [3, 5] },
    { name: 'square ord 3 ring [[1,4],[6,7]] 3/3 -> 5/5', shape: 'square', ord: 3, lage: 1, conns: [[1, 4], [6, 7]], from: [3, 3], to: [5, 5] },
    { name: 'hex ord 2 ring [[1,12],[13,14]] 3/3 -> 3/5', shape: 'hex', ord: 2, lage: 1, conns: [[1, 12], [13, 14]], from: [3, 3], to: [3, 5] },
];
for (const c of C) {
    const r = run(c);
    check(`(c) ${c.name}: ${r.total} real-coloured faces (nested), every one keeps its own colour (${r.kept}/${r.total}), nothing is reported lost`, r.total >= 2 && r.kept === r.total && r.rep.lost.colorsCount === 0 && r.distinct >= 2, J({ kept: r.kept, total: r.total, lost: r.rep.lost, distinct: r.distinct }));
    check(`(c) ${c.name}: the dry run = the real run (kept, lost, hints) and changes nothing`, sameReport(r.dry, r.rep) && r.dryClean, J([r.dry.kept, r.dry.lost, r.rep.kept, r.rep.lost]));
}
// ---- (b) a trail that the 0.01 px key rounding splits in two keys (or two keys that become one) ----------------------------------------------------------------------
const B = [
    { name: 'triangle ord 4 lage 2 rnd2 [[16,26],[2,14],[1,8],[10,31]] 3/5 -> 3/3 (rounding 27187.5 / 100)', shape: 'triangle', ord: 4, lage: 2, conns: [[16, 26], [2, 14], [1, 8], [10, 31]], from: [3, 5], to: [3, 3] },
    { name: 'triangle ord 3 sym [[1,10],[1,2],[1,4],[1,5]] 5/3 -> 3/3 (one trail becomes two keys)', shape: 'triangle', ord: 3, lage: 1, conns: [[1, 10], [1, 2], [1, 4], [1, 5]], from: [5, 3], to: [3, 3] },
    { name: 'triangle ord 3 sym [[1,10],[1,2],[1,4],[1,5]] 3/3 -> 5/3 (two trails become one key)', shape: 'triangle', ord: 3, lage: 1, conns: [[1, 10], [1, 2], [1, 4], [1, 5]], from: [3, 3], to: [5, 3] },
];
for (const c of B) {
    const r = run(c);
    const split = c.name.includes('becomes two keys') || c.name.includes('rounding');
    check(`(b) ${c.name}: ${r.kept}/${r.total} faces keep their colour${split ? ' (the split trail colours both new keys)' : ' (two old keys, one new key: the larger overlap wins, the other colour is counted lost)'}`, split ? (r.total > 0 && r.kept === r.total) : (r.total > 0 && r.kept >= 1 && r.rep.lost.colorsCount >= 0), J({ kept: r.kept, total: r.total, lost: r.rep.lost }));
    check(`(b) ${c.name}: the dry run = the real run`, sameReport(r.dry, r.rep) && r.dryClean);
}
// the loss count follows the new mapping: what is not carried is counted lost, what is carried is not (dry run = real run, the number is the same)
{
    const r = run(B[2]);
    check('(b) two trails -> one key: the colour that finds no face is counted lost (the dialog would say it), kept + lost = the real groups', r.rep.lost.colorsCount >= 1 && r.rep.kept.colors + r.rep.lost.colorsCount === r.rep.lost.colorsTotal && r.dry.lost.colorsCount === r.rep.lost.colorsCount, J(r.rep.lost));
}
// ---- the map itself: smallest face first, a key goes to one old key, 1:N ---------------------------------------------------------------------------------------------
{
    const w = W('square'); setup(w, C[1]);
    const sq = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
    const snap = (faces) => ({ faces: faces.map(f => ({ key: f.key, poly: f.poly, area: f.area, samples: f.samples })) });
    // an outer face (200 x 200) with an inner face (50 x 50) in it: the sample of the inner old face lies in both; it must go to the inner one
    const oldS = snap([{ key: 'O', poly: sq(0, 0, 200), area: 40000 - 2500, samples: [{ x: 10, y: 10 }] }, { key: 'I', poly: sq(75, 75, 50), area: 2500, samples: [{ x: 100, y: 100 }] }]);
    const newS = snap([{ key: 'NO', poly: sq(0, 0, 200), area: 40000 - 2500, samples: [] }, { key: 'NI', poly: sq(75, 75, 50), area: 2500, samples: [] }]);
    w.sb.__a = oldS; w.sb.__b = newS; w.sb.__id = (p) => p;
    let m = w.get('_mapTrailKeys(__a, __b, __id)');
    check('(map) nested faces: the old inner face goes to the inner new face (the smaller one is hit first), the outer to the outer', m.get('I') === 'NI' && m.get('O') === 'NO', J([...m.entries()]));
    // one old key, samples in two new faces (the trail is split): both new keys are its
    const oldT = snap([{ key: 'T', poly: sq(0, 0, 100), area: 10000, samples: [{ x: 10, y: 10 }, { x: 90, y: 90 }] }]);
    const newT = snap([{ key: 'T1', poly: sq(0, 0, 50), area: 2500, samples: [] }, { key: 'T2', poly: sq(60, 60, 40), area: 1600, samples: [] }]);
    w.sb.__a = oldT; w.sb.__b = newT; m = w.get('_mapTrailKeys(__a, __b, __id)');
    check('(map) 1:N: one old trail whose samples fall in two new faces takes both new keys (get = the first, all = both, the pairs list both)', m.all.get('T').length === 2 && m.all.get('T').includes('T1') && m.all.get('T').includes('T2') && [...m.entries()].length === 2 && ['T1', 'T2'].includes(m.get('T')), J([...m.entries()]));
    // two old keys vote for one new key: the larger overlap wins, the other old key gets nothing (no key twice)
    const oldU = snap([{ key: 'A', poly: sq(0, 0, 40), area: 1600, samples: [{ x: 10, y: 10 }] }, { key: 'B', poly: sq(50, 0, 40), area: 1600, samples: [{ x: 60, y: 10 }, { x: 70, y: 10 }, { x: 80, y: 10 }] }]);
    const newU = snap([{ key: 'N', poly: sq(0, 0, 100), area: 10000, samples: [] }]);
    w.sb.__a = oldU; w.sb.__b = newU; m = w.get('_mapTrailKeys(__a, __b, __id)');
    check('(map) two old keys, one new key: the key with the most votes (B: 3 against 1) owns it, A gets none; no new key appears twice', m.get('B') === 'N' && !m.has('A') && [...m.entries()].every(([ok, nk], i, all) => all.filter(e => e[1] === nk).length === 1), J([...m.entries()]));
    // a tie goes to the smaller old key (deterministic)
    const oldV = snap([{ key: 'B', poly: sq(0, 0, 40), area: 1600, samples: [{ x: 10, y: 10 }] }, { key: 'A', poly: sq(50, 0, 40), area: 1600, samples: [{ x: 60, y: 10 }] }]);
    w.sb.__a = oldV; w.sb.__b = newU; m = w.get('_mapTrailKeys(__a, __b, __id)');
    check('(map) a tie in the votes goes to the smaller old key (A)', m.get('A') === 'N' && !m.has('B'), J([...m.entries()]));
}
// ---- no face that was carried before is lost now: the old _mapTrailKeys (the tree before 083) against the new one, face by face, over a grid of patterns and size changes -------------------------------------------
{
    const cp = require('child_process'), fs = require('fs');
    let oldFn = null;
    try { oldFn = cp.execFileSync('git', ['show', (process.env.BASE083 || '3bf3c903') + ':core/state.js'], { cwd: ROOT, encoding: 'utf8' }).match(/function _mapTrailKeys\([\s\S]*?\n\}\n/)[0].replace('function _mapTrailKeys', 'function _mapTrailKeysOld'); } catch (e) { oldFn = null; }
    if (!oldFn) console.log('NOTE  the tree before 083 is not available: the face-by-face comparison is skipped');
    else {
        const SIZES = [[3, 3], [5, 5], [7, 7], [3, 5], [5, 3], [5, 7], [8, 7], [9, 3]];
        let tot = 0, regress = 0, improved = 0, ex = [];
        for (const shape of ['triangle', 'square', 'hex']) {
            const w = H.makeRenderWorld(shape, 3, 3, MODE); w.set(oldFn); w.set('var canvasSizeSync = function () { width = canvasW; height = canvasH; };');
            for (const ord of [2, 3]) for (const lage of [1, 2]) {
                w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: ord, lage })}); setGridSize(3, 3); symmetryMode = ${J(MODE)};`);
                const n = w.get('nodes.length'), sym = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.slice(0, 4).map(o => o.pairs[0].slice())');
                const sets = [sym, [[1, n], [2, Math.max(3, n - 2)], [3, Math.max(4, n - 4)]]];
                for (const conns of sets) {
                    const snaps = {};
                    for (const [X, Y] of SIZES) {
                        w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: ord, lage })}); setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = ${J(conns)};`);
                        snaps[X + '/' + Y] = w.get('(function () { const r = computeCellFaces(connections, nodes, null); if (!r.faces.length) return null; const g = sheetGroupElements(nodes, null); const keys = computeFaceTrailKeys(r, g); return { w: canvasW, h: canvasH, snap: faceTrailSnapshot(r, g, keys) }; })()');
                    }
                    for (const A of SIZES) for (const B of SIZES) {
                        if (A.join() === B.join()) continue;
                        const s1 = snaps[A.join('/')], s2 = snaps[B.join('/')]; if (!s1 || !s2) continue;
                        const f = Math.min(...A) / Math.min(...B), scale = (p) => ({ x: s2.w / 2 + (p.x - s1.w / 2) * f, y: s2.h / 2 + (p.y - s1.h / 2) * f });
                        w.sb.__s1 = s1.snap; w.sb.__s2 = s2.snap; w.sb.__sc = scale;
                        const mo = w.get('_mapTrailKeysOld(__s1, __s2, __sc)'), mn = w.get('_mapTrailKeys(__s1, __s2, __sc)');
                        const own = (m) => { const c = new Map(); for (const [ok, nk] of m.entries()) if (!c.has(nk)) c.set(nk, ok); return c; };
                        const cOld = own(mo), cNew = own(mn);
                        const sorted = s2.snap.faces.slice().sort((a, b) => Math.abs(a.area) - Math.abs(b.area)), oldSorted = s1.snap.faces.map((b, i) => ({ b, i })).sort((x, y) => Math.abs(x.b.area) - Math.abs(y.b.area));
                        s1.snap.faces.forEach((of, i) => {
                            const mine = of.samples.find(sp => { const h = oldSorted.find(o => inPoly(sp, o.b.poly)); return h && h.i === i; }); if (!mine) return;
                            const p = scale(mine), hit = sorted.find(a => inPoly(p, a.poly)); tot++;
                            const ko = !!hit && cOld.get(hit.key) === of.key, kn = !!hit && cNew.get(hit.key) === of.key;
                            if (ko && !kn) { regress++; if (ex.length < 3) ex.push([shape, ord, lage, A.join('/'), B.join('/'), i]); }
                            if (!ko && kn) improved++;
                        });
                    }
                }
            }
        }
        check(`(diff) ${tot} old faces over 3 shapes x ordnung 2..3 x lage 1/2 x 2 line sets x 56 size changes: no face that kept its colour before loses it now (${regress} regressions), ${improved} faces gain it`, tot > 20000 && regress === 0, J(ex));
    }
}
console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
