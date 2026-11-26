// Task 095: the collinear repair of core/faces.js (switch faceRepairCollinear, default false) and its use in the spatial morph only (core/spatial-morph-render.js spatialMorphRenderTileFaces).
//   1. synthetic collinear overlap (the cell of the 094 hole, a triangle): the switch ON gives faces that tile the cell exactly; OFF is the old code (result byte-equal to core/faces.js of main d693a1d9)
//   2. switch OFF: the 258-pattern corpus of tools/color/corpus.js gives a byte-equal face result (hash), face count and trail keys as the old file
//   3. the morph: seed 5015 (triangle, rotation6, t#23): a hole of at most 100 px2 (the old file: more than 50 000), and the switch is back to false after every frame, also after an exception
//   4. the keyframes' colour fields (computeCellFaces from spatialMorphRenderCornerField) never run with the switch ON and give the same results as the old file; the morph's cell faces run ON
//   5. 1e-9 px jitter: the face count stays stable on a set of collinear cases (synthetic cell x 100 seeds, the seed-5015 frames t#20..#26)
//   6. the default is false; nested calls restore the value they read
//   node tools/morph/test-face-collinear.js        sabotage runs: FACES_JS=/copy/of/faces.js, SPATIAL_MORPH_RENDER_JS=/copy/of/spatial-morph-render.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), crypto = require('crypto'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const A = require('./measure-face-artifacts.js');
const C = require('../color/corpus.js');
const BASE = 'd693a1d9';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify, sha = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
const NEW_SRC = fs.readFileSync(process.env.FACES_JS || path.join(ROOT, 'core', 'faces.js'), 'utf8');
const OLD_SRC = execSync(`git show ${BASE}:core/faces.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
const OLD_FILE = path.join(os.tmpdir(), `faces095-old-${process.pid}.js`); fs.writeFileSync(OLD_FILE, OLD_SRC);
process.on('exit', () => { try { fs.unlinkSync(OLD_FILE); } catch (e) { } });
const hasSwitch = /let faceRepairCollinear/.test(NEW_SRC);

// ---- 1. synthetic cell (through the morph's own cell face pass, spatialMorphRenderTileFaces) --------------------------------------------------------------------------------------------------
// The cell of the 094 hole (triangle, rotation6, size 3): lines along the cell border (partly collinear and overlapping) plus one vertical through the apex. The old file returns NO face for it.
const P = { a: [200, 386.60254037844385], b: [400, 386.60254037844385], c: [300, 213.39745962155615] };
const LINES = [[P.a, P.b], [[250, 300], P.c], [[300, 386.60254037844385], [250, 386.60254037844385]], [P.c, [350, 300]], [[275, 256.69872981077805], P.a]].map((l) => l.map((p) => ({ x: p[0], y: p[1] })));
const LINES_V = LINES.concat([[{ x: 300, y: 213.39745962155615 }, { x: 300, y: 386.60254037844385 }]]);
const CI = A.CONFIGS.findIndex((c) => c.shape === 'triangle' && c.sym === 'rotation6' && c.order === 3 && c.size === 3);
const cellArea = 0.5 * 200 * 173.20508075688772;
const sumArea = (r) => r.faces.reduce((s, f) => s + f.area, 0);
// mode: 'morph' = spatialMorphRenderTileFaces as it is; 'off' = the same call with the switch forced OFF at the computeCellFaces call (= the old behaviour of the new file)
function tileFaces(variant, lines, mode) {
    const w = A.build(A.CONFIGS[CI], 'none', 5015, 'morph', variant);
    if (mode === 'off') w.set('{ const f = computeCellFaces; computeCellFaces = function () { if (typeof faceRepairCollinear !== "undefined") faceRepairCollinear = false; return f.apply(this, arguments); }; }');
    return JSON.parse(w.get(`JSON.stringify(spatialMorphRenderTileFaces(${JSON.stringify(lines)}, spatialMorphRenderSource({ ids: [0] }), null))`));
}
{
    const oldR = tileFaces('old', LINES, 'morph'), offR = tileFaces('base', LINES, 'off'), onR = tileFaces('base', LINES, 'morph');
    const oldV = tileFaces('old', LINES_V, 'morph'), offV = tileFaces('base', LINES_V, 'off'), onV = tileFaces('base', LINES_V, 'morph');
    check('1a. the old file on the collinear cell: no face at all (the hole)', oldR.faces.length === 0, `faces ${oldR.faces.length}`);
    check('1b. switch OFF: byte-equal to the old file (both line sets)', J(offR) === J(oldR) && J(offV) === J(oldV));
    check('1c. switch ON, border lines only: one face, the whole cell (area < 1e-6 relative)', onR.faces.length === 1 && Math.abs(sumArea(onR) - cellArea) < 1e-6 * cellArea, `faces ${onR.faces.length}, ${sumArea(onR).toFixed(3)} of ${cellArea.toFixed(3)}`);
    check('1d. switch ON, with the vertical through the apex (the sheet\'s rotation6 makes it 3 medians): 6 equal faces that fill the cell exactly', onV.faces.length === 6 && onV.faces.every((f) => Math.abs(f.area - cellArea / 6) < 1e-6 * cellArea) && Math.abs(sumArea(onV) - cellArea) < 1e-6 * cellArea, `faces ${onV.faces.length}, ${sumArea(onV).toFixed(3)}`);
    // no collinearity: a square with both diagonals (a free cell of a small square sheet): ON = OFF as face sets
    const w = A.build(A.CONFIGS[0], 'none', 3, 'morph', 'base'), oc = w.get('spatialMorphRenderSource({ ids: [0] }).outerCorners.map((p) => [p.x, p.y])');
    const diag = [[oc[0], oc[2]], [oc[1], oc[3]]].map((l) => l.map((p) => ({ x: p[0], y: p[1] })));
    const d1 = tileFaces2(0, diag, 'off'), d2 = tileFaces2(0, diag, 'morph');
    check('1e. no collinear case (square cell, both diagonals): ON gives the same faces as OFF', d1.faces.length === 4 && J(d1.faces.map((f) => +f.area.toFixed(6)).sort()) === J(d2.faces.map((f) => +f.area.toFixed(6)).sort()), d1.faces.length + ' / ' + d2.faces.length);
}
function tileFaces2(ci, lines, mode) {
    const w = A.build(A.CONFIGS[ci], 'none', 3, 'morph', 'base');
    if (mode === 'off') w.set('{ const f = computeCellFaces; computeCellFaces = function () { if (typeof faceRepairCollinear !== "undefined") faceRepairCollinear = false; return f.apply(this, arguments); }; }');
    return JSON.parse(w.get(`JSON.stringify(spatialMorphRenderTileFaces(${JSON.stringify(lines)}, spatialMorphRenderSource({ ids: [0] }), null))`));
}
// ---- 2. corpus, switch off ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const CORE = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'farborgel-bridge', 'glossary'];
    const src = (faces) => CORE.map((f) => f === 'faces' ? faces : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
    const SN = src(NEW_SRC), SO = src(OLD_SRC), pats = C.buildPatterns(SO);
    const sheets = new Map(); let nSame = 0, nCount = 0, nKeys = 0, n = 0, defaultOff = true;
    for (const p of pats) {
        const [shape, order, mode] = p.sh.label.split('/'), k = p.sh.label;
        if (!sheets.has(k)) sheets.set(k, C.makeSheet(shape, +order, mode, SN));
        const sn = sheets.get(k), ro = p.res, rn = sn.faces(p.ids);
        n++; if (J(ro) === J(rn)) nSame++; if (ro.faces.length === rn.faces.length) nCount++;
        if (J(p.sh.sb.computeFaceTrails(ro, p.sh.group).map((t) => t.key).sort()) === J(sn.sb.computeFaceTrails(rn, sn.group).map((t) => t.key).sort())) nKeys++;
        if (hasSwitch && vm.runInContext('faceRepairCollinear', sn.sb) !== false) defaultOff = false;
    }
    check(`2a. corpus: ${n} patterns (switch default): face result byte-equal ${nSame}/${n}, face count ${nCount}/${n}, trail keys ${nKeys}/${n}`, n === 258 && nSame === n && nCount === n && nKeys === n);
    check('6a. the switch exists and its default is false', hasSwitch && defaultOff && /let faceRepairCollinear = false;/.test(NEW_SRC));
}
// ---- 3. the morph, seed 5015 -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const w = A.build(A.CONFIGS[CI], 'none', 5015, 'morph', 'base'); const a = A.analyseFrame(A.frameAt(w, 23 / 40), w.dims);
    check('3a. seed 5015, t#23: gap at most 100 px2', a.gapPx2 <= 100 && a.n > 0, `gap ${a.gapPx2}, n ${a.n}`);
    const wo = A.build(A.CONFIGS[CI], 'none', 5015, 'morph', 'old'); const ao = A.analyseFrame(A.frameAt(wo, 23 / 40), wo.dims);
    check('3b. the same frame with the old faces.js: the hole is there (> 50 000 px2), so the test measures the repair', ao.gapPx2 > 50000, `gap ${ao.gapPx2}`);
    check('3c. the switch is false again after the frame', !hasSwitch || w.get('faceRepairCollinear') === false);
    if (hasSwitch) {
        w.set('{ const f = computeCellFaces; computeCellFaces = function () { if (faceRepairCollinear) throw new Error("boom"); return f.apply(this, arguments); } }');
        w.set('segmentCollector = null;'); let threw = false; try { A.frameAt(w, 0.5); } catch (e) { threw = true; }
        check('3d. an exception inside the cell faces does not leave the switch on', w.get('faceRepairCollinear') === false, 'threw ' + threw);
    }
}
// ---- 4. colour fields stay OFF and unchanged -------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const rec = (variant) => {
        const w = A.build(A.CONFIGS[CI], 'none', 5015, 'morph', variant);
        w.set(`{ const f = computeCellFaces; var __calls = []; computeCellFaces = function () { const r = f.apply(this, arguments); const st = new Error().stack; __calls.push({ field: st.includes('spatialMorphRenderCornerField'), on: typeof faceRepairCollinear !== 'undefined' ? faceRepairCollinear : null, h: JSON.stringify(r).length + ':' + r.faces.length }); return r; }; }`);
        A.frameAt(w, 0.3); A.frameAt(w, 0.8); return JSON.parse(w.get('JSON.stringify(__calls)'));
    };
    const nw = rec('base'), od = rec('old');
    const fieldsN = nw.filter((c) => c.field), fieldsO = od.filter((c) => c.field);
    check('4a. the colour fields are built through computeCellFaces (calls found) and never with the switch ON', fieldsN.length > 0 && fieldsN.every((c) => c.on === false || c.on === null), `${fieldsN.length} calls, on: ${J([...new Set(fieldsN.map((c) => c.on))])}`);
    check('4b. the colour fields give the same results as the old file (call by call)', fieldsN.length === fieldsO.length && J(fieldsN.map((c) => c.h)) === J(fieldsO.map((c) => c.h)));
    check('4c. the morph\'s own cell faces run with the switch ON', hasSwitch && nw.filter((c) => !c.field && c.on === true).length > 0, J(nw.filter((c) => !c.field).map((c) => c.on)));
}
const seg = (p, q) => ({ x1: p[0], y1: p[1], x2: q[0], y2: q[1] });
const CELL_SEGS = LINES_V.map((l) => seg([l[0].x, l[0].y], [l[1].x, l[1].y])).concat([seg(P.c, P.a), seg(P.a, P.b), seg(P.b, P.c)]);
function faceVm(src, on) { const sb = { console, Math }; vm.createContext(sb); vm.runInContext(src + (on === undefined ? '' : `\nfaceRepairCollinear = ${on};`) + '\nvar __f = findFaces;', sb); return sb; }
const run = (sb, segs) => sb.__f(segs.map((g) => Object.assign({}, g)), []);
// ---- 5. jitter -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    let bad = 0, cnt = new Set();
    for (let s = 1; s <= 100; s++) {
        let st = s * 2654435761 >>> 0; const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296 * 2 - 1; };
        const sb = faceVm(NEW_SRC, hasSwitch ? true : undefined);
        const r = run(sb, CELL_SEGS.map((g) => ({ x1: g.x1 + rnd() * 1e-9, y1: g.y1 + rnd() * 1e-9, x2: g.x2 + rnd() * 1e-9, y2: g.y2 + rnd() * 1e-9 })));
        cnt.add(r.faces.length); if (Math.abs(sumArea(r) - cellArea) > 1e-6 * cellArea) bad++;
    }
    check('5a. synthetic collinear cell, 100 jitters of 1e-9 px: one face count, the faces always fill the cell', cnt.size === 1 && bad === 0, `counts ${[...cnt]}, bad ${bad}`);
    const count = (variant) => { const w = A.build(A.CONFIGS[CI], 'none', 5015, 'morph', variant); let unstable = 0; for (let i = 20; i <= 26; i++) { const t = i / 40, a = A.analyseFrame(A.frameAt(w, t), w.dims); for (let s = 1; s <= 3; s++) { const b = A.analyseFrame(A.frameAt(w, t, 1e-9, 77 * s + i), w.dims); if (b.n !== a.n) unstable++; } } return unstable; };
    const uNew = count('base'), uOld = count('old');
    check('5b. seed 5015, t#20..#26 x 3 jitters of 1e-9 px (21 comparisons): the old file changes the face count in at least 15, the repaired one in at most 6', uOld >= 15 && uNew <= 6, `old ${uOld}, new ${uNew}`);
}
// ---- 6b. nesting -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const w = A.build(A.CONFIGS[CI], 'none', 5015, 'morph', 'base');
    const r = w.get(`(function () { faceRepairCollinear = true; const lines = [[{ x: 0, y: 0 }, { x: 10, y: 10 }]]; const s = spatialMorphRenderSource({ ids: [0] }); spatialMorphRenderTileFaces(lines, s, null); const afterOn = faceRepairCollinear; faceRepairCollinear = false; spatialMorphRenderTileFaces(lines, s, null); return { afterOn, afterOff: faceRepairCollinear }; })()`);
    check('6b. spatialMorphRenderTileFaces restores the value it read (true stays true, false stays false)', hasSwitch && r.afterOn === true && r.afterOff === false, J(r));
}
// ---- 6c. the angle sort: counter-clockwise from +x without trig; the atan2 version folds an angle of -1e-17 rad to 0 (360 - 5.7e-16 rounds to 360)
{
    const mkAdj = (src, on) => { const sb = { console, Math }; vm.createContext(sb); vm.runInContext(src + (on === undefined ? '' : `\nfaceRepairCollinear = ${on};`) + '\nvar __a = _buildFaceAdjacency;', sb); return sb.__a; };
    const nodes = [{ id: 'o', x: 0, y: 0 }, { id: 'a', x: 1, y: -1e-17 }, { id: 'b', x: 0, y: 1 }, { id: 'c', x: -1, y: 0 }, { id: 'd', x: 0, y: -1 }, { id: 'e', x: 1, y: 1e-17 }];
    const edges = [['o', 'a'], ['o', 'b'], ['o', 'c'], ['o', 'd'], ['o', 'e']];
    const order = (adj) => adj.o.map((e) => e.neighborId).join('');
    check('6c. switch ON: the edges around a node are in exact counter-clockwise order (e a: +1e-17 first, -1e-17 last)', hasSwitch && order(mkAdj(NEW_SRC, true)(nodes, edges)) === 'ebcda', hasSwitch ? order(mkAdj(NEW_SRC, true)(nodes, edges)) : '-');
    const g = [{ id: 'o', x: 0, y: 0 }, { id: 'a', x: 3, y: 4 }, { id: 'b', x: -2, y: 5 }, { id: 'c', x: -7, y: -1 }, { id: 'd', x: 4, y: -9 }];
    const ge = [['o', 'a'], ['o', 'b'], ['o', 'c'], ['o', 'd']];
    check('6d. generic directions: ON and OFF give the same order, OFF is the old order', order(mkAdj(NEW_SRC, true)(g, ge)) === order(mkAdj(NEW_SRC, false)(g, ge)) && J(mkAdj(NEW_SRC, hasSwitch ? false : undefined)(g, ge)) === J(mkAdj(OLD_SRC)(g, ge)));
}
console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
