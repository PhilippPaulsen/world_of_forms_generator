// G2 (task 057): GridSpec facade over the Lage-1 builders. Compares against the PREVIOUS core/forms.js (git, BASE env, default
// 159beb7b = main before 057) byte for byte, then checks the adapter, the validator, rebuildGrid() and setGrid().
//   node tools/grid/test-gridspec-facade.js     FORMS_JS / STATE_JS = paths of mutated copies (sabotage runs)
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || '159beb7b';
const newForms = fs.readFileSync(process.env.FORMS_JS || path.join(ROOT, 'core/forms.js'), 'utf8');
const stateSrc = fs.readFileSync(process.env.STATE_JS || path.join(ROOT, 'core/state.js'), 'utf8');
const oldForms = cp.execFileSync('git', ['show', BASE + ':core/forms.js'], { cwd: ROOT, encoding: 'utf8' });
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const ctx = src => { const sb = { Math, console, Number, Object, Error, Map, JSON }; vm.createContext(sb); vm.runInContext(src, sb); return sb; };
const O = ctx(oldForms), N = ctx(newForms);
const J = JSON.stringify;
const shapes = ['triangle', 'square', 'hex'];
const oldB = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };
const ev = (sb, s) => vm.runInContext(s, sb);

// (1) byte-equal Lage-1 output, c = 1..7 (and square to 13), several sizes, with and without a center
let n1 = 0, bad1 = 0;
for (const shape of shapes) for (let c = 1; c <= (shape === 'square' ? 13 : 7); c++) for (const sf of [1, 3, 5, 9]) for (const center of [undefined, { x: 280, y: 310 }]) {
    let r;
    try { r = N.buildGrid(N.fromLegacy(shape, c), { sizeFactor: sf, canvasW: 600, canvasH: 600, center }); } catch (e) { bad1++; n1++; continue; }
    const old = ev(O, `${oldB[shape]}(${c}, ${sf}, 600, 600, ${J(center)})`);
    n1++; if (J(old) !== J({ nodes: r.nodes, centroid: r.centroid, outerCorners: r.outerCorners })) bad1++;
}
check('(1) buildGrid(fromLegacy) byte-equal to the old builders (' + n1 + ' grids)', bad1 === 0, bad1);
check('(1) the three builders themselves unchanged (source of each function identical to BASE)',
    shapes.every(s => ev(O, oldB[s] + '.toString()') === ev(N, oldB[s] + '.toString()')) && ['layerGrid', 'alignLayerToBase', '_alignmentConditionMet', '_subdivideTriangleInterior', '_subdivideSquareInterior', '_subdivideHexInterior'].every(f => ev(O, f + '.toString()') === ev(N, f + '.toString()')));

// (2) adapter roundtrip
let rt = 0;
for (const shape of shapes) for (let c = 1; c <= 13; c++) { try { if (N.toLegacy(N.fromLegacy(shape, c)) !== c) rt++; } catch (e) { rt++; } }
check('(2) toLegacy(fromLegacy(shape, c)) === c, c = 1..13, all shapes (incl. the c = 1 marker)', rt === 0, rt);
check('(2) hex ordnung = c from 1', [1, 2, 7].every(c => N.fromLegacy('hex', c).ordnung === c && N.toLegacy({ shape: 'hex', ordnung: c, lage: 1 }) === c));
check('(2) triangle/square c >= 2 -> ordnung c-1, and back', ['triangle', 'square'].every(s => [2, 3, 7, 13].every(c => N.fromLegacy(s, c).ordnung === c - 1 && !N.fromLegacy(s, c).legacyC1 && N.toLegacy({ shape: s, ordnung: c - 1, lage: 1 }) === c)));
const pts = ns => ns.map(n => [n.x, n.y]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
for (const s of ['triangle', 'square']) {
    const a = N.fromLegacy(s, 1), b = N.fromLegacy(s, 2);
    const ga = N.buildGrid(a, { sizeFactor: 3, canvasW: 600, canvasH: 600 }), gb = N.buildGrid(b, { sizeFactor: 3, canvasW: 600, canvasH: 600 });
    check('(2) ' + s + ' c = 1 special case: same ordnung 1 as c = 2 but marked, toLegacy 1 vs 2', a.ordnung === b.ordnung && a.legacyC1 === true && !b.legacyC1 && N.toLegacy(a) === 1 && N.toLegacy(b) === 2);
    check('(2) ' + s + ' c = 1 / c = 2: same corner point set (square: different order, so c = 1 must keep its own mapping) - and alignLayerToBase base c = 1 is refused, c = 2 is not',
        J(pts(ga.nodes)) === J(pts(gb.nodes)) && ev(N, `_alignmentConditionMet(3, 1, 3, 3, '${s}')`) === false && ev(N, `_alignmentConditionMet(3, 2, 3, 2, '${s}')`) === true);
}
check('(2) fromLegacy rejects unknown shape and nodeCount 0 / 1.5 / "3"', [['pentagon', 3], ['hex', 0], ['square', 1.5], ['square', '3']].every(([s, c]) => { try { N.fromLegacy(s, c); return false; } catch (e) { return true; } }));
check('(2) maxOrdnungFor: triangle 6, square 12, hex 7, lage 2 / unknown 0', N.maxOrdnungFor('triangle', 1) === 6 && N.maxOrdnungFor('square', 1) === 12 && N.maxOrdnungFor('hex') === 7 && N.maxOrdnungFor('hex', 2) === 0 && N.maxOrdnungFor('x', 1) === 0);

// (3) validator
const bad = (spec, re) => { const r = N.validateGridSpec(spec); return r.ok === false && re.test(r.error); };
check('(3) lage 2 rejected explicitly (all shapes), also by buildGrid', shapes.every(s => bad({ shape: s, ordnung: 1, lage: 2 }, /lage 2/)) && (() => { try { N.buildGrid({ shape: 'hex', ordnung: 1, lage: 2 }, { sizeFactor: 3, canvasW: 600, canvasH: 600 }); return false; } catch (e) { return /lage 2/.test(e.message); } })());
check('(3) ordnung 0 / negative / fractional / string rejected', [0, -1, 1.5, '2', null].every(o => bad({ shape: 'square', ordnung: o, lage: 1 }, /ordnung/)));
check('(3) unknown shape rejected (also missing, null spec)', bad({ shape: 'pentagon', ordnung: 1, lage: 1 }, /unknown shape/) && bad({ ordnung: 1, lage: 1 }, /unknown shape/) && N.validateGridSpec(null).ok === false);
check('(3) lage 0 / 3 / missing rejected', [0, 3, undefined].every(l => N.validateGridSpec({ shape: 'hex', ordnung: 1, lage: l }).ok === false));
check('(3) valid specs accepted; legacyC1 only on triangle/square ordnung 1', N.validateGridSpec({ shape: 'hex', ordnung: 7, lage: 1 }).ok && N.validateGridSpec({ shape: 'triangle', ordnung: 1, lage: 1, legacyC1: true }).ok && !N.validateGridSpec({ shape: 'hex', ordnung: 1, lage: 1, legacyC1: true }).ok && !N.validateGridSpec({ shape: 'square', ordnung: 2, lage: 1, legacyC1: true }).ok);
check('(3) enforceMax: square 12 ok, 13 refused; hex 8 refused', N.validateGridSpec({ shape: 'square', ordnung: 12, lage: 1 }, { enforceMax: true }).ok && !N.validateGridSpec({ shape: 'square', ordnung: 13, lage: 1 }, { enforceMax: true }).ok && !N.validateGridSpec({ shape: 'hex', ordnung: 8, lage: 1 }, { enforceMax: true }).ok);

// (4) rebuildGrid / setGrid in a state context, against the OLD rebuildGrid body run on the OLD builders
const oldState = cp.execFileSync('git', ['show', BASE + ':core/state.js'], { cwd: ROOT, encoding: 'utf8' });
const mk = (forms, st) => { const sb = { Math, console, Number, Error, Map, JSON, radians: x => x * Math.PI / 180, cos: Math.cos, sin: Math.sin }; vm.createContext(sb); vm.runInContext(forms + '\n' + st, sb); return sb; };
const OS = mk(oldForms, oldState), NS = mk(newForms, stateSrc);
const snap = sb => ev(sb, 'JSON.stringify({nodes, centroid, outerCorners, connections, additionalLayers, activeLayer, timeline, altNetSeed, baseNetAnimation, redoStack, faceHover, baseFacePalette})');
let n4 = 0, bad4 = 0;
for (const shape of shapes) for (let c = 1; c <= 7; c++) for (const sf of [1, 5, 9]) {
    const setup = `currentShape='${shape}'; nodeCount=${c}; shapeSizeFactor=${sf}; connections=[[1,2]]; redoStack=[[3,4]]; additionalLayers=[{x:1}]; activeLayer=0; timeline={a:1}; altNetSeed={p:1}; baseNetAnimation={x:1}; faceHover={k:1}; baseFacePalette={r:1}; rebuildGrid(currentShape);`;
    ev(OS, setup); ev(NS, setup); n4++;
    if (snap(OS) !== snap(NS)) bad4++;
}
check('(4) rebuildGrid: nodes, centroid, corners, lines, layers, timeline, redoStack etc. equal to the old behaviour (' + n4 + ' cases)', bad4 === 0, bad4);
ev(NS, `redoStack=[[3,4]]; rebuildGrid('hex');`);
check('(4) redoStack is still NOT cleared by rebuildGrid (existing gap, deliberately unchanged)', ev(NS, 'redoStack.length') === 1);
const r0 = ev(NS, 'gridRevision');
ev(NS, `rebuildGrid('square')`);
check('(4) rebuildGrid raises gridRevision by 1', ev(NS, 'gridRevision') === r0 + 1);
ev(NS, `setGrid({shape:'triangle', ordnung:4, lage:1})`);
check('(4) setGrid: sets shape, derived nodeCount (ordnung+1), raises gridRevision by exactly 1, builds the grid',
    ev(NS, 'currentShape') === 'triangle' && ev(NS, 'nodeCount') === 5 && ev(NS, 'gridRevision') === r0 + 2 && ev(NS, 'nodes.length') === 15, ev(NS, 'gridRevision') + '/' + ev(NS, 'nodeCount'));
const r1 = ev(NS, 'gridRevision');
ev(NS, `setGrid({shape:'square', ordnung:1, lage:1, legacyC1:true})`);
check('(4) setGrid with the c = 1 marker -> nodeCount 1', ev(NS, 'nodeCount') === 1 && ev(NS, 'gridRevision') === r1 + 1);
const before = snap(NS), rv = ev(NS, 'gridRevision');
let thrown = 0;
for (const s of [{ shape: 'hex', ordnung: 3, lage: 2 }, { shape: 'hex', ordnung: 0, lage: 1 }, { shape: 'pentagon', ordnung: 1, lage: 1 }]) { try { NS.setGrid(s); } catch (e) { thrown++; } }
check('(4) setGrid with an invalid spec throws and leaves state and gridRevision untouched', thrown === 3 && snap(NS) === before && ev(NS, 'gridRevision') === rv);
ev(NS, `nodeCount=3; shapeSizeFactor=3; rebuildGridFromConstruction({x:120,y:230},{x:310,y:260},4,1)`);
check('(4) rebuildGridFromConstruction raises gridRevision', ev(NS, 'gridRevision') === rv + 1);

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
