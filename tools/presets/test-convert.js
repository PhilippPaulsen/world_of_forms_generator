/**
 * tools/presets/test-convert.js
 * Task 159: tools/presets/convert.js. Self-contained (no files outside the repo): the exports are written by the real buildExportData() from worlds
 * built in a vm (a pattern with a null edge, a duplicate edge and an orphan colour entry added on purpose), converted, loaded back and exported again.
 *   node tools/presets/test-convert.js
 * The roundtrip is exact for the faces (nodes and colour per face); numbers of the net block are compared with 1e-9 (the geometric net differs by 1e-16
 * in tileBoundaries after the log/exp trip). The pixel comparison (fresh build against loaded) is a browser measurement, task 163 / reports/163.md.
 */
const { convertExport, exportAfterLoad, netSpecOf, cleanEdges } = require('./convert.js');
const S = require('../session/scenarios.js');

let checks = 0, failures = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const J = JSON.stringify;
const near = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => near(x, b[i]));
    if (a && typeof a === 'object') return b && typeof b === 'object' && J(Object.keys(a).sort()) === J(Object.keys(b).sort()) && Object.keys(a).every(k => near(a[k], b[k]));
    return a === b;
};

// an export as the Studio writes it: square 4, size 3, the given lines (with a null edge and a duplicate), gray fill of the legacy ladder, an orphan entry
function makeExport(mode, net, extraLines) {
    const ctx = S.newCtx();   // ordnung 4 (the 5 x 5 node grid the candidates use), not fromLegacy(square, 4)
    ctx.run(`currentShape = 'square'; projectGridSpec({ shape: 'square', ordnung: 4, lage: 1 }); shapeSizeFactor = 3; canvasW = 600; canvasH = 600; symmetryMode = ${J(mode)}; curveType = { kind: 'straight' };
        showNodes = false; freeEndpointsEnabled = false; lineColor = '#000000'; redoStack = []; rebuildGrid(currentShape);`);
    ctx.run(`showFaces = true; connections = ${J([[5, 25], [5, 11]].concat(extraLines || [], [[14, 14], [25, 5]]))}; baseNetTransform = ${J(net)}; grayTones = 0;
        (function () { const g = sheetGroupElements(nodes, null); const fr = computeCellFaces(connections, nodes, null, null, null); const tr = computeFaceTrails(fr, g);
          ensureDefaultGrayFill(baseFaceAssignments, tr);
          setFaceAssignment(baseFaceAssignments, '99999,99999;88888,88888;77777,77777', { hue: 0, w: 0.5, s: 0.5, rule: 'max-contrast-gray', params: null, displayColor: null }); })();`);
    const d = ctx.sb.buildExportData(null);
    return JSON.parse(J(d));
}
const faceSig = e => J(e.geometry.faces.map(f => f.nodeIds.join(',') + ':' + f.color));

const NETS = {
    none: null,
    trig: { x: { kind: 'trig', w: -1 }, y: 'same', repeat: false, domain: 'field' },
    geometric: { x: { kind: 'geometric', w: 2.0794415416798357 }, y: 'same', repeat: false, domain: 'field' },
    projective: { kind: 'projective', family: '□N', a: 3, b: 7, format: 'half' },
};
for (const mode of ['rotation3', 'rotation_reflection6']) for (const nk of Object.keys(NETS)) {
    const label = `${mode} / net ${nk}`;
    let exp, r, back;
    try {
        exp = makeExport(mode, NETS[nk]);
        r = convertExport(exp, { grau: 'alt' });
        back = exportAfterLoad(r.text);
    } catch (e) { check(label + ': convert and load', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); continue; }
    check(label + ': the faces after load equal the exported faces (nodes and colour)', faceSig(exp) === faceSig(back), exp.geometry.faces.length + ' faces');
    check(label + ': net block equal (1e-9)', near(exp.meta.netTransform, back.meta.netTransform));
    check(label + ': the cleaned lines are exported, no null edge, no duplicate', J(back.geometry.edges) === J([[5, 25], [5, 11]]), J(back.geometry.edges));
    check(label + ': report counts the null edge, the duplicate and the orphan colour', r.report.nullEdges === 1 && r.report.duplicateEdges === 1 && r.report.orphanColors === 1, J(r.report));
    const sn = JSON.parse(r.text);
    check(label + ': uiMode simple is written explicitly, grayTones 0, no anchor (alt)', sn.settings.uiMode === 'simple' && sn.settings.grayTones === 0 && sn.base.faceAnchor === null);
    check(label + ': no orphan entry in the session', sn.base.faceAssignments.every(([k]) => !k.startsWith('99999')) && sn.base.faceAssignments.length === r.report.trails);
    check(label + ': deterministic (two runs give the same text)', convertExport(exp, { grau: 'alt' }).text === r.text);
}

// grays: abbild keeps the distribution and the order, neu8 recolours cyclic
{
    const exp = makeExport('rotation_reflection6', NETS.none, [[1, 25], [3, 23]]);
    const alt = JSON.parse(convertExport(exp, { grau: 'alt' }).text).base.faceAssignments;
    const ab = convertExport(exp, { grau: 'abbild' }), abs = JSON.parse(ab.text);
    const oldW = new Map(alt), newW = new Map(abs.base.faceAssignments);
    const keys = alt.map(x => x[0]);
    const distinctOld = Array.from(new Set(keys.map(k => oldW.get(k).w))).sort((a, b) => b - a);
    const distinctNew = Array.from(new Set(keys.map(k => newW.get(k).w))).sort((a, b) => b - a);
    check('abbild: same number of distinct tones as before', distinctOld.length === distinctNew.length, distinctOld.length + ' tones');
    const mono = keys.every(a => keys.every(b => (oldW.get(a).w > oldW.get(b).w) === (newW.get(a).w > newW.get(b).w) && (oldW.get(a).w === oldW.get(b).w) === (newW.get(a).w === newW.get(b).w)));
    check('abbild: same trails share a tone, the light-to-dark order is unchanged', mono);
    check('abbild: grayTones 8, anchor neutral: true, uiMode simple', abs.settings.grayTones === 8 && abs.base.faceAnchor && abs.base.faceAnchor.neutral === true && abs.settings.uiMode === 'simple');
    check('abbild: every tone is gray (hue 0) of rule max-contrast-gray', abs.base.faceAssignments.every(([, a]) => a.hue === 0 && a.rule === 'max-contrast-gray'));
    const back = exportAfterLoad(ab.text);
    check('abbild: loads and exports (faces present, same count)', back.geometry.faces.length === exp.geometry.faces.length);
    const n8 = convertExport(exp, { grau: 'neu8' }), n8s = JSON.parse(n8.text);
    check('neu8: grayTones 8, neutral anchor, one entry per trail', n8s.settings.grayTones === 8 && n8s.base.faceAnchor.neutral === true && n8s.base.faceAssignments.length === n8.report.trails);
    const white = abs.base.faceAssignments.some(([, a]) => a.w === 1) || n8s.base.faceAssignments.some(([, a]) => a.w === 1);
    check('the 8-tone ladder reaches true white', white);
}

// units and errors
check('netSpecOf: the macro of a field is dropped, of a tiled net kept', netSpecOf({ x: { kind: 'uniform' }, y: { kind: 'uniform' }, domain: 'field', macro: 4 }).macro === undefined && netSpecOf({ x: { kind: 'trig', w: 0.5 }, y: { kind: 'trig', w: 0.5 }, domain: 'tiled', macro: 2 }).macro === 2);
check('netSpecOf: different axes keep y, equal axes say same', netSpecOf({ x: { kind: 'trig', w: 0.5 }, y: { kind: 'geometric', w: 1 }, domain: 'single' }).y.kind === 'geometric' && netSpecOf({ x: { kind: 'trig', w: 0.5 }, y: { kind: 'trig', w: 0.5 }, domain: 'single' }).y === 'same');
check('netSpecOf: null in, null out; an unknown axis kind throws', netSpecOf(null) === null && (() => { try { netSpecOf({ x: { kind: 'x' }, y: { kind: 'x' } }); return false; } catch (e) { return true; } })());
const ce = cleanEdges([[1, 2], [2, 1], [3, 3], [4, 5]]);
check('cleanEdges: null edge and reversed duplicate go, order kept', J(ce.edges) === J([[1, 2], [4, 5]]) && ce.nullEdges === 1 && ce.duplicates === 1);
{
    const exp = makeExport('rotation3', null);
    const throws = f => { try { f(); return false; } catch (e) { return true; } };
    check('an unknown --grau value throws', throws(() => convertExport(exp, { grau: 'x' })));
    const noCol = JSON.parse(J(exp)); noCol.meta.faceColoring.base = noCol.meta.faceColoring.base.slice(2);
    check('a current trail without a colour entry throws (it would render differently)', throws(() => convertExport(noCol, { grau: 'alt' })));
    const lay = JSON.parse(J(exp)); lay.geometry.layers = [{}];
    check('an export with layers throws', throws(() => convertExport(lay)));
    const coloured = JSON.parse(J(exp)); coloured.meta.faceColoring.base.forEach(e => { e.rule = 'triad'; });
    check('abbild refuses non-gray entries', throws(() => convertExport(coloured, { grau: 'abbild' })) && !throws(() => convertExport(coloured, { grau: 'alt' })));
}
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
