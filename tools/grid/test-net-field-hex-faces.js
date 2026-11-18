// Task 090: the face fills under the HEXAGON Field (netWarpRefineFaces: the faces of the base cell are split once at the mesh boundaries, so the per-vertex image is exact; netWarpTileOutsideCanvas skips tiles outside the canvas).
//   node tools/grid/test-net-field-hex-faces.js      sabotage runs: NETWARP_JS, FACES_JS, EXPORT_JS (mutated copies)
//   1. 16 sizes x 4 laws x 2 symmetry configs: the face fills inside the canvas are the same with and without the tile skip (area sum, polygon set), cover the canvas (no gap / overlap), polygons simple, one orientation
//   2. exactness: the refined polygon's image = the image of the regular edge (samples along every edge, < 1e-9 px); the refinement adds vertices for an asymmetric pattern, none for the triangle; the colours are those of Aus
//   3. every other case (square, triangle with and without a Field, hexagon without a Field, Single, Tiled, Aus) is byte-equal to main and to the same code without the two hooks
//   4. export: the hexagon Field writes faces (facesOmitted false, facesMapping says split), the triangle's flags unchanged; the layers' reason says Base sheet only
//   7. core/faces.js differs from main by the two hooks only
//   5. time per frame with faces (skip) against Aus with faces: <= 1.5 x
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; };';
const STUB = 'var __polys = [], __cur = null; push = function () { }; pop = function () { }; noStroke = function () { }; stroke = function () { }; noFill = function () { }; fill = function () { }; strokeWeight = function () { }; CLOSE = "close"; beginShape = function () { __cur = []; }; vertex = function (x, y) { __cur.push([x, y]); }; endShape = function () { __polys.push(__cur); };';
const on = k => !process.env.ONLY || process.env.ONLY.split(',').includes(k);   // ONLY=2,4 runs sections 2 and 4 (sabotage runs)
const FILES = {}; if (process.env.NETWARP_JS) FILES['core/netwarp.js'] = process.env.NETWARP_JS; if (process.env.FACES_JS) FILES['core/faces.js'] = process.env.FACES_JS;
const world = (shape, sym, files, ord) => { const w = H.makeRenderWorld(shape, ord || 3, 3, sym || 'none', files === undefined ? FILES : files); w.set(HOOK); w.set(STUB); return w; };
const setup = (w, shape, X, Y, spec, sym, n, ord, pick) => w.set(`currentShape = ${J(shape)}; projectGridSpec({ shape: ${J(shape)}, ordnung: ${ord || 3}, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y});
    symmetryMode = ${J(sym)}; baseNetTransform = ${J(spec)}; baseNetAnimation = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; showFaces = false; rebuildGrid(currentShape);
    connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())${pick ? `.filter((c, i) => i % ${pick} === 1)` : `.slice(0, ${n})`};`);
const fieldSpec = (law) => ({ x: law, y: law.kind === 'trig' ? { kind: 'trig', w: -law.w * 0.7 } : law, repeat: false, domain: 'field' });
const LAWS = { sinus: { kind: 'trig', w: -0.8 }, tangens: { kind: 'trig', w: 0.6 }, geometric: { kind: 'geometric', w: Math.log(4) }, regular: { kind: 'uniform', w: 0 } };
const draw = (w, skip) => { w.set(`__polys.length = 0; var __keep = netWarpTileOutsideCanvas; ${skip ? '' : 'netWarpTileOutsideCanvas = function () { return false; };'} drawTessellation(); netWarpTileOutsideCanvas = __keep;`); return w.get('__polys.slice()'); };
const area = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const clip = (P, W, H_) => { let o = P; const cut = (inside, inter) => { const inp = o; o = []; for (let i = 0; i < inp.length; i++) { const a = inp[i], b = inp[(i + 1) % inp.length], ia = inside(a), ib = inside(b); if (ia) { o.push(a); if (!ib) o.push(inter(a, b)); } else if (ib) o.push(inter(a, b)); } };
    cut(p => p[0] >= 0, (a, b) => { const t = (0 - a[0]) / (b[0] - a[0]); return [0, a[1] + t * (b[1] - a[1])]; }); cut(p => p[0] <= W, (a, b) => { const t = (W - a[0]) / (b[0] - a[0]); return [W, a[1] + t * (b[1] - a[1])]; });
    cut(p => p[1] >= 0, (a, b) => { const t = (0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), 0]; }); cut(p => p[1] <= H_, (a, b) => { const t = (H_ - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), H_]; }); return o; };
const inCanvasArea = (polys, W, H_) => polys.reduce((s, P) => { let x0 = 1e18, x1 = -1e18, y0 = 1e18, y1 = -1e18; for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } if (x1 < 0 || x0 > W || y1 < 0 || y0 > H_) return s; return s + Math.abs(area(clip(P, W, H_))); }, 0);
const segX = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < -1e-9 && o(c, d, a) * o(c, d, b) < -1e-9; };
const simple = P => { const n = P.length; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return false; } return true; };

// ---- 1 ----
if (on('1')) {
    const bad = {}, note = (k, v) => { bad[k] = (bad[k] || 0) + 1; if (!bad.first) bad.first = [k, v]; }; let n = 0;
    for (const [sym, nc] of [['rotation6', 20], ['rotation_reflection6', 10]]) {
        const w = world('hex', sym);
        for (const X of [3, 5, 7, 9]) for (const Y of [3, 5, 7, 9]) for (const [ln, law] of Object.entries(LAWS)) {
            setup(w, 'hex', X, Y, fieldSpec(law), sym, nc); w.set('showFaces = true;'); n++;
            const W = w.get('canvasW'), H_ = w.get('canvasH'), a = draw(w, true), b = draw(w, false);
            const A = inCanvasArea(a, W, H_), B = inCanvasArea(b, W, H_);
            if (a.length === 0) note('empty', [sym, X, Y, ln]);
            if (Math.abs(A - B) > 1e-9 * W * H_) note('lost', [sym, X, Y, ln, A, B]);
            if (Math.abs(A - W * H_) > 1e-6 * W * H_) note('cover', [sym, X, Y, ln, A, W * H_]);
            if (a.length >= b.length && a.length > 0 && b.length > a.length) note('skipcount', [sym, X, Y, ln]);
            if (a.length > b.length) note('moreWithSkip', [sym, X, Y, ln]);
            if (X + Y <= 10 && ln === 'sinus') { const sg = a.filter(P => P.length >= 3).map(P => Math.sign(area(P))), nz = sg.filter(s => s !== 0); if (new Set(nz).size > 1) note('orientation', [sym, X, Y]); if (!a.filter(P => { const c = clip(P, W, H_); return c.length >= 3; }).slice(0, 400).every(simple)) note('simple', [sym, X, Y]); }
        }
    }
    {   // ordnung 2, a rotation-only pattern: faces DO cross the mesh lines there (reported in (2)); the fills in the canvas must be the same with and without the skip
        const w = world('hex', 'rotation3', undefined, 2);
        for (const [X, Y] of [[3, 5]]) for (const ln of ['sinus', 'geometric']) { setup(w, 'hex', X, Y, fieldSpec(LAWS[ln]), 'rotation3', 0, 2, 3); w.set('showFaces = true;'); n++;
            const W = w.get('canvasW'), H_ = w.get('canvasH'), a = draw(w, true), b = draw(w, false); if (!a.length) note('empty5', [X, Y, ln]); if (Math.abs(inCanvasArea(a, W, H_) - inCanvasArea(b, W, H_)) > 1e-9 * W * H_) note('lost5', [X, Y, ln]); }
    }
    check(`(1) 16 sizes x 4 laws x 2 symmetry configs + 2 ordnung-2 cases (${n} cases): the fills in the canvas equal those without the tile skip (0 px2), cover the canvas, one orientation, simple polygons`, n === 130 && !bad.first, J(bad));
}

// ---- 2 ----
if (on('2')) {
    const w = world('hex', 'rotation3', undefined, 2); let maxD = 0, added = 0, colorsOk = true, facesN = 0;
    for (const [X, Y] of [[3, 5], [5, 5], [7, 9]]) {
        setup(w, 'hex', X, Y, fieldSpec(LAWS.sinus), 'rotation3', 0, 2, 3);
        const r = w.get(`(function () {
            const wp = netWarpBaseNow(), saved = activeNetWarp; activeNetWarp = null; const plain = computeCellFaces(connections, nodes, new Map()); activeNetWarp = wp; const ref = computeCellFaces(connections, nodes, new Map()); activeNetWarp = saved;
            const pl = new Map(plain.nodes.map(n => [n.id, n])), rf = new Map(ref.nodes.map(n => [n.id, n])); let maxD = 0, add = 0, colors = true;
            plain.faces.forEach((f, i) => { const g = ref.faces[i]; add += g.nodeIds.length - f.nodeIds.length; if (f.color !== g.color) colors = false;
                const mp = g.nodeIds.map(id => applyNetWarp(wp, rf.get(id)));
                for (let k = 0; k < f.nodeIds.length; k++) { const a = pl.get(f.nodeIds[k]), b = pl.get(f.nodeIds[(k + 1) % f.nodeIds.length]);
                    for (let j = 0; j <= 12; j++) { const t = j / 12, q = applyNetWarp(wp, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }); let best = 1e9;
                        for (let m = 0; m < mp.length; m++) { const u = mp[m], v = mp[(m + 1) % mp.length], dx = v.x - u.x, dy = v.y - u.y, L = dx * dx + dy * dy, s = L ? Math.max(0, Math.min(1, ((q.x - u.x) * dx + (q.y - u.y) * dy) / L)) : 0; best = Math.min(best, Math.hypot(q.x - (u.x + s * dx), q.y - (u.y + s * dy))); }
                        maxD = Math.max(maxD, best); } } });
            return { maxD, add, colors, faces: plain.faces.length };
        })()`);
        maxD = Math.max(maxD, r.maxD); added += r.add; colorsOk = colorsOk && r.colors; facesN += r.faces;
    }
    check(`(2) exactness: the image of every regular face edge lies on the refined polygon's image (max ${maxD.toExponential(2)} px < 1e-9), the refinement added ${added} vertices (ordnung 2, rotation-only pattern; at ordnung 3 no face crosses a mesh line: 0 vertices needed), the colours are those of Aus (${facesN} faces)`, maxD < 1e-9 && added > 0 && colorsOk);
    const wt = world('triangle', 'none'); setup(wt, 'triangle', 5, 5, fieldSpec(LAWS.sinus), 'none', 6);
    check('(2b) the triangle Field is not on the new path (no refineFaces flag): the triangle stays on the affine path', wt.get('netWarpBaseNow().refineFaces') === undefined);
}

// ---- 3 ----
if (on('3')) {
    let mainFiles = null; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wof090-'));
    try { mainFiles = {}; for (const f of ['netwarp', 'state', 'export', 'spatial-morph-render', 'faces']) { const p = path.join(dir, f + '.js'); fs.writeFileSync(p, execSync(`git show a51af63b:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 })); mainFiles['core/' + f + '.js'] = p; } } catch (e) { mainFiles = null; }
    // the same faces.js without the two hooks
    const cur = fs.readFileSync(process.env.FACES_JS || path.join(ROOT, 'core', 'faces.js'), 'utf8').split('\n').filter(l => !/netWarpTileOutsideCanvas\(activeNetWarp/.test(l)).map(l => l.replace("return typeof netWarpRefineFaces === 'function' ? netWarpRefineFaces(result, activeNetWarp) : result;", 'return result;'));
    const nohook = path.join(dir, 'faces-nohook.js'); fs.writeFileSync(nohook, cur.join('\n'));
    const mk = (shape, sym, kind) => {
        if (kind === 'now') return world(shape, sym, FILES);
        if (kind === 'nohook') return world(shape, sym, Object.assign({}, FILES, { 'core/faces.js': nohook }));
        const keep = {}; for (const k of ['STATE_JS', 'EXPORT_JS', 'SPATIAL_MORPH_RENDER_JS']) keep[k] = process.env[k];
        process.env.STATE_JS = mainFiles['core/state.js']; process.env.EXPORT_JS = mainFiles['core/export.js']; process.env.SPATIAL_MORPH_RENDER_JS = mainFiles['core/spatial-morph-render.js'];
        const wm = H.makeRenderWorld(shape, 3, 3, sym, { 'core/netwarp.js': mainFiles['core/netwarp.js'], 'core/faces.js': mainFiles['core/faces.js'] }); wm.set(HOOK); wm.set(STUB);
        for (const k of Object.keys(keep)) { if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k]; } return wm;
    };
    const probe = (w2) => w2.get(`(function () { __polys.length = 0; drawTessellation(); const ex = buildExportData(null); delete ex.exportedAt; return JSON.stringify({ polys: __polys, ex }); })()`);
    const bad = {}; let n = 0;
    const specs = [null, { x: { kind: 'trig', w: 0.7 }, y: 'same', repeat: false, domain: 'single' }, { x: { kind: 'trig', w: -0.7 }, y: 'same', repeat: true, domain: 'tiled' }, fieldSpec(LAWS.sinus)];
    for (const shape of ['square', 'triangle', 'hex']) for (const [kindA, kindB] of [['now', 'main'], ['now', 'nohook']]) { const wa = mk(shape, 'rotation_reflection6', kindA), wb = mk(shape, 'rotation_reflection6', kindB);
        for (const sz of [3, 5]) for (const spec of specs) { if (shape === 'hex' && spec && spec.domain === 'field') continue; if (kindB === 'main' && shape === 'hex' && false) continue;
            for (const w2 of [wa, wb]) { setup(w2, shape, sz, sz, spec, 'rotation_reflection6', 3); w2.set('showFaces = true;'); } n++; if (probe(wa) !== probe(wb)) bad[`${shape}-${kindB}`] = (bad[`${shape}-${kindB}`] || 0) + 1; } }
    check(`(3) square, triangle (with and without a Field), hexagon without a Field (Single, Tiled, Aus), faces on (${n} cases): the fills and the export are byte-equal to main and to the code without the two hooks`, n === 44 && !bad.first && Object.keys(bad).length === 0, J(bad));
}

// ---- 4 ----
if (on('4')) {
    const w = world('hex', 'rotation_reflection6'); setup(w, 'hex', 5, 5, fieldSpec(LAWS.sinus), 'rotation_reflection6', 3); w.set('showFaces = true;');
    const ex = w.get('buildExportData(null)'), nt = ex.meta.netTransform;
    const wt = world('triangle', 'rotation_reflection6'); setup(wt, 'triangle', 5, 5, fieldSpec(LAWS.sinus), 'rotation_reflection6', 3); const nt2 = wt.get('buildExportData(null).meta.netTransform');
    const SK = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
    check('(4) export: the hexagon Field writes faces (geometry.faces, facesOmitted false, facesMapping names the split), the triangle keeps its mapping text; the layers reason says Base sheet only',
        nt.facesOmitted === false && Array.isArray(ex.geometry.faces) && ex.geometry.faces.length > 0 && /split/.test(nt.facesMapping) && nt2.facesOmitted === false && /per-tile affine map/.test(nt2.facesMapping) && /hexagon Field are drawn for the Base sheet only/.test(SK),
        J([nt.facesOmitted, nt.facesMapping && nt.facesMapping.slice(0, 40)]));
}

// ---- 5 ----
if (on('5')) {
    const w = world('hex', 'rotation_reflection6'); const rep = {}; let worst = 0;
    for (const [X, Y] of [[3, 5], [5, 5], [7, 5], [9, 9]]) {
        setup(w, 'hex', X, Y, fieldSpec(LAWS.sinus), 'rotation_reflection6', 10); w.set('showFaces = true;');
        const med = (spec, skip) => { w.set(`baseNetTransform = ${J(spec)};`); const a = []; for (let i = 0; i < 5; i++) { const t0 = process.hrtime.bigint(); draw(w, skip); a.push(Number(process.hrtime.bigint() - t0) / 1e6); } a.sort((p, q) => p - q); return a[2]; };
        const f = med(fieldSpec(LAWS.sinus), true), aus = med(null, true); rep[`${X}/${Y}`] = { fieldFacesMs: Math.round(f), ausFacesMs: Math.round(aus), ratio: Math.round(100 * f / aus) / 100 }; if (X + Y >= 10) worst = Math.max(worst, f / aus);
    }
    console.log('REPORT frame time with faces (ms, 10 orbits, D6):', J(rep));
    check(`(5) time per frame with faces in the hexagon Field <= 1.5 x Aus with faces (worst of 5/5, 7/5, 9/9: ${worst.toFixed(2)})`, worst <= 1.5);
}
// ---- 7. core/faces.js differs from main (a51af63b) by the two documented hooks only ----
if (on('7')) {
    let diff = null; try { diff = execSync('git diff -U0 a51af63b -- core/faces.js', { cwd: ROOT }).toString(); } catch (e) { }
    if (diff === null) check('(7) git or a51af63b is not available here: skipped', true);
    else {
        const added = diff.split('\n').filter(l => /^\+[^+]/.test(l)), removed = diff.split('\n').filter(l => /^-[^-]/.test(l));
        // task 095: since then faces.js also carries the collinear repair behind the switch faceRepairCollinear: 67 ADDED lines, none removed, against 7307ec7e (pin: was 0 added; before, `added.length === 2`)
        let d95 = null; try { d95 = execSync('git diff -U0 7307ec7e -- core/faces.js', { cwd: ROOT }).toString().split('\n'); } catch (e) { }
        check('(7b) core/faces.js against 7307ec7e (task 095): exactly 67 added lines (59 + 8 marker lines), none removed, the switch defaults to false', d95 === null || (d95.filter(l => /^\+[^+]/.test(l)).length === 67 && d95.filter(l => /^-[^-]/.test(l)).length === 0 && /^\+let faceRepairCollinear = false;$/m.test(d95.join('\n'))));
        check('(7) core/faces.js: exactly the two hooks plus the 67 lines of task 095 (netWarpRefineFaces at the end of computeCellFaces replaces `return result;`, netWarpTileOutsideCanvas in drawFaceFillsAtTile)',
            added.length === 2 + 67 && removed.length === 1 && /netWarpRefineFaces\(result, activeNetWarp\)/.test(added.join('')) && /netWarpTileOutsideCanvas\(activeNetWarp, tileCentroid, flip180\)/.test(added.join('')) && /^-\s+return result;$/.test(removed[0]), J({ added: added.length, removed: removed }));
    }
}
console.log(`${pass}/${pass + fail} checks passed`);
if (fail) process.exit(1);
