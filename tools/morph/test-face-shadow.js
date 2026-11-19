// Task 103: the shadow-line rule of core/faces.js (_dropShadowed, only with faceRepairCollinear = the spatial morph's cell faces): a segment drops out of the face finding when BOTH endpoints lie within
// FACE_EPSILON of the SAME strictly longer segment (length(host) > length(segment) + 1e-9).
//   1. long cell line + a line 0.3 px beside it: switch ON the whole area, switch OFF as before (byte-equal to main, and not the whole area)
//   2. a bridge between two DIFFERENT lines is not dropped; a line 0.6 px beside the host is not dropped; a line with only ONE end near the host is not dropped
//   3. equal-length parallel lines: both stay, in both list orders
//   4. chain of three lines: the same kept set and the same face set in all 6 orders
//   5. the case of task 102 (square rr6, order 5, size 3, pair 26): cell sum 40 000 (+-1), the old file 25 015
//   6. switch OFF (the default): the 258-pattern corpus (hash of the whole face result) and the 102 case are byte-equal to main; the rule is not even called
//   7. the drawn lines: the input list of findFaces and the lines of spatialMorphRenderTileFaces are unchanged after the run
//   node tools/morph/test-face-shadow.js        sabotage runs (tools/morph/sabotage-face-shadow.js): FACES_JS=/copy/of/faces.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const A = require('./measure-face-artifacts.js');
const C = require('../color/corpus.js');
const BASE = '4537c655';   // main before this task
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const NEW_SRC = fs.readFileSync(process.env.FACES_JS || path.join(ROOT, 'core', 'faces.js'), 'utf8');
const OLD_SRC = execSync(`git show ${BASE}:core/faces.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
const OLD_FILE = path.join(os.tmpdir(), `faces103-old-${process.pid}.js`); fs.writeFileSync(OLD_FILE, OLD_SRC);
process.on('exit', () => { try { fs.unlinkSync(OLD_FILE); } catch (e) { } });

const sg = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
const fvm = (src, on) => { const sb = { console, Math }; vm.createContext(sb); vm.runInContext(src + `\nfaceRepairCollinear = ${on};\nvar __f = findFaces, __d = typeof _dropShadowed === 'function' ? _dropShadowed : null;`, sb); return sb; };
const find = (src, on, segs) => fvm(src, on).__f(segs.map((s) => Object.assign({}, s)), []);
const area = (r) => r.faces.reduce((s, f) => s + f.area, 0);
const areas = (r) => r.faces.map((f) => +f.area.toFixed(6)).sort((a, b) => a - b);
const dropped = (segs) => { const d = fvm(NEW_SRC, true).__d; if (!d) return null; const a = segs.map((s) => Object.assign({}, s)); d(a); return a.map((s) => J(s)).sort(); };
const keySet = (segs) => segs.map((s) => J(s)).sort();
const SQ = [sg(200, 200, 400, 200), sg(400, 200, 400, 400), sg(400, 400, 200, 400), sg(200, 400, 200, 200)];   // a 200 x 200 cell

// ---- 1. long line + a line 0.3 px beside it ----------------------------------------------------------------------------------------------------------------------------------------------------
{
    const shadow = sg(400, 399.08, 399.69, 200);   // both ends within 0.5 of the cell border x = 400 (the line of task 102)
    const segs = SQ.concat([shadow]);
    const on = find(NEW_SRC, true, segs), off = find(NEW_SRC, false, segs), oldOn = find(OLD_SRC, true, segs), oldOff = find(OLD_SRC, false, segs);
    check('1a. switch ON: one face, the whole cell', on.faces.length === 1 && Math.abs(area(on) - 40000) < 1e-6, `${on.faces.length} faces, ${area(on)}`);
    check('1b. switch OFF: byte-equal to main (the rule is not applied)', J(off) === J(oldOff) && J(find(NEW_SRC, false, SQ)) === J(find(OLD_SRC, false, SQ)));
    check('1c. main loses area on this cell (the test measures the rule): OFF below the cell', area(off) < 40000 - 1, `${area(off)}`);
    const d = dropped(segs);
    check('1d. the shadow line is dropped, the four cell lines stay', d !== null && d.length === 4 && !d.includes(J(shadow)), d && d.length);
}
// ---- 2. no drop ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const bridge = sg(300, 200.2, 300, 399.8);   // both ends near, but near two DIFFERENT lines (y = 200 and y = 400, each 200 long, the bridge 199.6)
    const d1 = dropped(SQ.concat([bridge]));
    check('2a. a bridge between two different lines is not dropped', d1 !== null && d1.includes(J(bridge)) && d1.length === 5);
    const on = find(NEW_SRC, true, SQ.concat([bridge]));
    check('2b. ... and splits the cell into two faces', on.faces.length === 2 && Math.abs(area(on) - 40000) < 1e-6, `${on.faces.length}`);
    const far = sg(399.4, 210, 399.4, 390);   // 0.6 px beside the border: outside FACE_EPSILON
    const d2 = dropped(SQ.concat([far]));
    check('2c. a line 0.6 px beside the host is not dropped', d2 !== null && d2.includes(J(far)));
    const near = sg(399.8, 210, 399.8, 390);   // control: 0.2 px beside: dropped
    const d2b = dropped(SQ.concat([near]));
    check('2d. control: the same line 0.2 px beside the host is dropped', d2b !== null && !d2b.includes(J(near)));
    const one = sg(400, 300, 300, 300);   // one end on the border, the other far
    const d3 = dropped(SQ.concat([one]));
    check('2e. only one end near the host: not dropped', d3 !== null && d3.includes(J(one)));
    const one2 = sg(399.7, 210, 398.9, 390);   // one end 0.3, the other 1.1 from the border
    const d3b = dropped(SQ.concat([one2]));
    check('2f. one end 0.3, the other 1.1 px from the host: not dropped', d3b !== null && d3b.includes(J(one2)));
    const diag = sg(200, 200, 400, 400), tOne = sg(300, 300.2, 350, 300), tBoth = sg(250, 250.2, 350, 349.9);   // host = a diagonal: its bounding box holds both ends of the lines below
    check('2h. diagonal host: a line with one end near and one far (inside the host\'s box) is not dropped', (dropped([diag, tOne]) || []).includes(J(tOne)));
    check('2i. control: both ends within 0.5 of the diagonal: dropped', (dropped([diag, tBoth]) || [J(tBoth)]).length === 1 && !(dropped([diag, tBoth]) || [J(tBoth)]).includes(J(tBoth)));
    const long = sg(200, 200, 400, 200.4);   // a host-length rival is no host: equal length (within 1e-9) never drops
    check('2g. a line at least as long as every other (the longest) is never dropped', (dropped(SQ.concat([sg(200, 200.1, 400, 200.1)])) || []).length === 5);
}
// ---- 3. equal length ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const a = sg(0, 0, 100, 0), b = sg(0, 0.3, 100, 0.3);
    const d1 = dropped([a, b]), d2 = dropped([b, a]);
    check('3a. two equal-length parallel lines 0.3 px apart: both stay (both list orders)', d1 !== null && d1.length === 2 && d2.length === 2);
    const b2 = sg(0, 0.3, 100 + 1e-12, 0.3);   // longer by less than 1e-9: still equal
    check('3b. longer by less than 1e-9: still both stay', dropped([a, b2]).length === 2 && dropped([b2, a]).length === 2);
    const b3 = sg(0, 0.3, 100 + 1e-6, 0.3);   // longer by 1e-6: the longer one is a host
    check('3c. control: longer by 1e-6: the shorter one drops (both orders)', dropped([a, b3]).length === 1 && dropped([b3, a]).length === 1);
}
// ---- 4. chain of three, all orders ----------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const Cc = sg(0, 0, 140, 0), B = sg(10, 0.4, 130, 0.4), Aa = sg(20, 0.8, 120, 0.8);   // A within eps of B only, B within eps of C
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]], items = [Cc, B, Aa];
    const kept = new Set(), faceSets = new Set();
    for (const p of perms) {
        const list = p.map((i) => items[i]);
        kept.add(J(dropped(list)));
        const cell = [sg(-50, -50, 200, -50), sg(200, -50, 200, 50), sg(200, 50, -50, 50), sg(-50, 50, -50, -50)];
        faceSets.add(J(areas(find(NEW_SRC, true, cell.concat(list)))));
    }
    check('4a. chain A-B-C: the same kept set in all 6 orders', kept.size === 1 && !kept.has('null'), kept.size);
    check('4b. chain A-B-C: the same face set in all 6 orders', faceSets.size === 1, faceSets.size);
    check('4c. only the longest line is left', JSON.parse([...kept][0]).length === 1 && JSON.parse([...kept][0])[0] === J(Cc));
}
// ---- 5. the case of task 102 --------------------------------------------------------------------------------------------------------------------------------------------------------------------
const CASE = [[400, 399.08, 399.69, 200], [350, 400, 299.69, 300], [350, 250.31, 350.31, 400]].map((l) => [{ x: l[0], y: l[1] }, { x: l[2], y: l[3] }]);
function cellRun(faces) {
    const keep = process.env.FACES_JS; if (faces) process.env.FACES_JS = faces; else delete process.env.FACES_JS;
    try {
        const w = A.build(A.CONFIGS[8], 'none', 26, 'morph', 'base');
        const before = J(CASE);
        const r = JSON.parse(w.get(`JSON.stringify((function () { const s = spatialMorphRenderSource({ ids: ['base'] }); const lines = ${before}; const r = spatialMorphRenderTileFaces(lines, s, null); return { n: r.faces.length, sum: r.faces.reduce((p, f) => p + f.area, 0), same: JSON.stringify(lines) === ${J(before)}, h: JSON.stringify(r) }; })())`));
        return { r, w };
    } finally { if (keep === undefined) delete process.env.FACES_JS; else process.env.FACES_JS = keep; }
}
{
    const nw = cellRun(process.env.FACES_JS || null).r, od = cellRun(OLD_FILE).r;
    check('5a. the case of task 102: cell sum 40 000 (+-1)', Math.abs(nw.sum - 40000) <= 1, `${nw.sum} in ${nw.n} faces`);
    check('5b. ... the old file: 25 015 (the test measures the rule)', Math.abs(od.sum - 25015) <= 1, `${od.sum}`);
    check('5c. the lines handed to spatialMorphRenderTileFaces are unchanged (drawn lines untouched)', nw.same === true && od.same === true);
}
// ---- 6. switch OFF -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const CORE = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'farborgel-bridge', 'glossary'];
    const src = (faces) => CORE.map((f) => f === 'faces' ? faces : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
    const SN = src(NEW_SRC), SO = src(OLD_SRC), pats = C.buildPatterns(SO);
    const sheets = new Map(); let nSame = 0, n = 0, defaultOff = true;
    for (const p of pats) {
        const [shape, order, mode] = p.sh.label.split('/'), k = p.sh.label;
        if (!sheets.has(k)) sheets.set(k, C.makeSheet(shape, +order, mode, SN));
        const sn = sheets.get(k); n++;
        if (J(p.res) === J(sn.faces(p.ids))) nSame++;
        if (vm.runInContext('faceRepairCollinear', sn.sb) !== false) defaultOff = false;
    }
    check(`6a. corpus ${n} patterns (switch at its default): face result byte-equal to main ${nSame}/${n}`, n === 258 && nSame === n && defaultOff);
    // the rule is not called at all with the switch off
    const sb = fvm(NEW_SRC, false); let calls = 0;
    vm.runInContext('var __n = 0; if (__d) { const d = _dropShadowed; _dropShadowed = function () { __n++; return d.apply(this, arguments); }; }', sb);
    sb.__f(SQ.concat([sg(400, 399.08, 399.69, 200)]).map((s) => Object.assign({}, s)), []);
    check('6b. switch OFF: _dropShadowed is never called', vm.runInContext('__n', sb) === 0, vm.runInContext('__n', sb));
    const caseOff = (() => { const w = A.build(A.CONFIGS[8], 'none', 26, 'morph', 'base'); w.set('faceRepairCollinear = false; { const f = computeCellFaces; computeCellFaces = function () { faceRepairCollinear = false; return f.apply(this, arguments); }; }'); return w.get(`JSON.stringify((function () { const s = spatialMorphRenderSource({ ids: ['base'] }); const r = spatialMorphRenderTileFaces(${J(CASE)}, s, null); return r; })())`); })();
    const caseOld = (() => { const keep = process.env.FACES_JS; process.env.FACES_JS = OLD_FILE; try { const w = A.build(A.CONFIGS[8], 'none', 26, 'morph', 'base'); w.set('{ const f = computeCellFaces; computeCellFaces = function () { faceRepairCollinear = false; return f.apply(this, arguments); }; }'); return w.get(`JSON.stringify((function () { const s = spatialMorphRenderSource({ ids: ['base'] }); return spatialMorphRenderTileFaces(${J(CASE)}, s, null); })())`); } finally { if (keep === undefined) delete process.env.FACES_JS; else process.env.FACES_JS = keep; } })();
    check('6c. the case of 102 with the switch forced OFF: byte-equal to main', caseOff === caseOld, `${caseOff.length} / ${caseOld.length}`);
}
// ---- 7. input list untouched ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const segs = SQ.concat([sg(400, 399.08, 399.69, 200), sg(350, 400, 299.69, 300)]), before = J(segs), sb = fvm(NEW_SRC, true), arr = segs.map((s) => Object.assign({}, s));
    sb.__f(arr, []);
    check('7a. findFaces leaves the caller\'s segment list as it was (length and content)', J(arr) === before && arr.length === segs.length);
    const w = A.build(A.CONFIGS[8], 'none', 26, 'morph', 'base');
    const same = w.get(`(function () { const s = spatialMorphRenderSource({ ids: ['base'] }); const lines = ${J(CASE)}; const keep = JSON.stringify(lines); spatialMorphRenderTileFaces(lines, s, null); return JSON.stringify(lines) === keep && lines.length === 3; })()`);
    check('7b. the lines of the cell are unchanged after the cell faces', same === true);
}
console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
