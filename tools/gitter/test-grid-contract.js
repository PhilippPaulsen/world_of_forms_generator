// G4 (task 059): the grid contract of core/forms.js numberGridNodes()/gridCanonicalPoint() and core/symmetry.js mainGroupSpec() against the Orakel
// tools/gitter/measure-name-rule.js, matched by COORDINATES (never by ids), and the unchanged lage-1 output of buildGrid().
//   node tools/gitter/test-grid-contract.js      FORMS_JS / SYMMETRY_JS / ORBITS_JS = mutated copies (sabotage runs); BASE = commit of the old files (default dd146481)
const cp = require('child_process');
const B = require('./oracle-bridge.js'), O = require('./measure-name-rule.js');
const core = B.loadCore(), G = core.get, LAT = core.LAT;
let pass = 0, fail = 0;
process.on('uncaughtException', e => { console.log('FAIL the test run itself crashed: ' + (e && e.message)); process.exit(1); });
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify, shapes = ['triangle', 'square', 'hex'], VIEW = { sizeFactor: 3, canvasW: 600, canvasH: 600 };
const BASE = process.env.BASE || 'dd146481';
const vm = require('vm');
const oldForms = cp.execFileSync('git', ['show', BASE + ':core/forms.js'], { cwd: B.ROOT, encoding: 'utf8' });
const OLD = { Math, console, Number, Object, Error, Set, Map, JSON }; vm.createContext(OLD); vm.runInContext(oldForms, OLD);
const oracleZahl = (shape, n, lage) => { const og = O.buildGrid(shape, n, lage); return { og, byKey: new Map(og.nodes.map(nd => [B.ptKey(nd.x, nd.y), nd])) }; };

// (6) lage 1 unchanged, numbering only on request
{
    const BF = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };
    let n1 = 0, bad = 0, leak = 0, numOk = 0;
    for (const shape of shapes) for (let c = 1; c <= (shape === 'square' ? 13 : 7); c++) for (const sf of [1, 3, 9]) for (const center of [undefined, { x: 280, y: 310 }]) {
        const old = vm.runInContext(`${BF[shape]}(${c}, ${sf}, 600, 600, ${J(center)})`, OLD), spec = G('fromLegacy')(shape, c);
        const r = G('buildGrid')(spec, { sizeFactor: sf, canvasW: 600, canvasH: 600, center }), rn = G('buildGrid')(spec, { sizeFactor: sf, canvasW: 600, canvasH: 600, center }, { numbered: true });
        n1++; if (J(old) !== J({ nodes: r.nodes, centroid: r.centroid, outerCorners: r.outerCorners })) bad++;
        if (r.nodes.some(nd => 'u' in nd || 'v' in nd || 'zahl' in nd)) leak++;
        if (rn.nodes.every((nd, i) => nd.id === old.nodes[i].id && nd.x === old.nodes[i].x && nd.y === old.nodes[i].y && Number.isInteger(nd.zahl) && nd.zahl >= 1) && J(rn.outerCorners) === J(old.outerCorners)) numOk++;
    }
    check('(6) lage-1 buildGrid byte-equal to ' + BASE + ' (' + n1 + ' grids), no zahl/u/v unless requested', bad === 0 && leak === 0, bad + '/' + leak);
    check('(6) with { numbered: true } the lage-1 nodes keep id, x, y exactly and gain u, v, zahl', numOk === n1, numOk + '/' + n1);
    check('(6) the lage-2 switch is still internal: default buildGrid/validateGridSpec refuse lage 2', shapes.every(s => !G('validateGridSpec')({ shape: s, ordnung: 2, lage: 2 }).ok));
}

// (1) node numbers equal the Orakel's: every shape x both lagen x n = 1..8, by coordinates
{
    let bad = '', cases = 0, nodesChecked = 0;
    for (const shape of shapes) for (const lage of [1, 2]) for (let n = 1; n <= 8; n++) {
        const g = G('buildGrid')({ shape, ordnung: n, lage }, VIEW, { allowLage2: true, numbered: true }), fr = G('canonicalGridFrame')({ shape, ordnung: n, centroid: g.centroid, outerCorners: g.outerCorners });
        const { og, byKey } = oracleZahl(shape, n, lage); cases++;
        let ok = g.nodes.length === og.nodes.length;
        for (const nd of g.nodes) { const o = fr.toOracle(nd.x, nd.y), m = byKey.get(B.ptKey(o.X, o.Y)); nodesChecked++; if (!m || m.zahl !== nd.zahl) ok = false; }
        const orbits = new Set(g.nodes.map(nd => nd.zahl)).size;
        if (!ok || orbits !== og.orbits.length || Math.max(...g.nodes.map(nd => nd.zahl)) !== og.orbits.length) bad += ` ${shape}${n}/${lage}`;
    }
    check('(1) node numbers of 3 shapes x 2 lagen x n = 1..8 equal the Orakel\'s at every node, same orbit count (' + cases + ' grids, ' + nodesChecked + ' nodes)', bad === '', bad.slice(0, 200));
    check('(1) numberGridNodes: the orbits list is ranked 1..k with the right sizes (hex n = 1: centre = 1 of size 1; 6 corners = 2)', (r => r.orbits.length === 2 && r.orbits[0].size === 1 && r.orbits[1].size === 6)(core.numbered({ shape: 'hex', ordnung: 1, lage: 1 })));
}

// (2) size, translation, canvas, y flip and rotation do not change the numbers
{
    let bad = '';
    for (const shape of shapes) for (const [n, lage] of [[2, 2], [3, 1], [4, 2]]) {
        const ref = G('buildGrid')({ shape, ordnung: n, lage }, VIEW, { allowLage2: true, numbered: true });
        for (const v of [{ sizeFactor: 1 }, { sizeFactor: 9, canvasW: 900, canvasH: 500 }, { center: { x: 90, y: 410 } }]) {
            const g = G('buildGrid')({ shape, ordnung: n, lage }, Object.assign({}, VIEW, v), { allowLage2: true, numbered: true });
            if (!g.nodes.every((nd, i) => nd.zahl === ref.nodes[i].zahl && nd.u === ref.nodes[i].u && nd.v === ref.nodes[i].v)) bad += ` ${shape}${n}/${lage}${J(v)}`;
            // the canvas path (x, y through the frame) gives the same numbers as the lattice path
            const nn = G('numberGridNodes')(g.nodes.map(nd => ({ id: nd.id, x: nd.x, y: nd.y })), { shape, ordnung: n, lage }, { geometry: g });
            if (!nn.nodes.every((nd, i) => nd.zahl === ref.nodes[i].zahl)) bad += ` ${shape}${n}/${lage}${J(v)}:canvas`;
        }
        // y flip of the canvas (mirrored picture) and an alt-net rotation: same set of numbers by coordinates
        const flip = { centroid: { x: ref.centroid.x, y: 600 - ref.centroid.y }, outerCorners: ref.outerCorners.map(p => ({ x: p.x, y: 600 - p.y })) };
        const fn = G('numberGridNodes')(ref.nodes.map(nd => ({ id: nd.id, x: nd.x, y: 600 - nd.y })), { shape, ordnung: n, lage }, { geometry: flip });
        const sorted = a => J(a.map(nd => nd.zahl).sort((x, y) => x - y)), sizeOf = a => J(a.orbits.map(o => o.size));
        if (sorted(fn.nodes) !== sorted(ref.nodes)) bad += ` ${shape}${n}/${lage}:flip`;
        const e = G('completeEdgeToRegularPolygon')({ x: 120, y: 230 }, { x: 310, y: 260 }, { triangle: 3, square: 4, hex: 6 }[shape], -1);
        const alt = G('projectGridNodes')(G('buildGridNodes')({ shape, ordnung: n, lage }, LAT), { shape, ordnung: n, outerCorners: e.vertices, centroid: e.center });
        const an = G('numberGridNodes')(alt, { shape, ordnung: n, lage }, { geometry: { centroid: e.center, outerCorners: e.vertices } });
        const oracle = oracleZahl(shape, n, lage), fr = G('canonicalGridFrame')({ shape, ordnung: n, centroid: e.center, outerCorners: e.vertices });
        if (!an.nodes.every(nd => { const o = fr.toOracle(nd.x, nd.y), m = oracle.byKey.get(B.ptKey(o.X, o.Y)); return m && m.zahl === nd.zahl; }) || sizeOf(an) !== sizeOf(ref.nodes.length ? G('numberGridNodes')(ref.nodes, { shape, ordnung: n, lage }) : null)) bad += ` ${shape}${n}/${lage}:alt`;
    }
    check('(2) size, canvas size, translation, a vertical canvas flip and a rotated/mirrored alt-net polygon leave every node number unchanged (equal to the Orakel\'s by coordinates)', bad === '', bad.slice(0, 200));
    let worst = 0;
    for (const shape of shapes) for (let n = 1; n <= 6; n++) {
        const g = G('buildGrid')({ shape, ordnung: n, lage: 2 }, VIEW, { allowLage2: true }), fr = G('canonicalGridFrame')({ shape, ordnung: n, centroid: g.centroid, outerCorners: g.outerCorners });
        for (const nd of g.nodes) { const o = fr.toOracle(nd.x, nd.y), c = G('gridCanonicalPoint')(shape, n, nd.u, nd.v); worst = Math.max(worst, Math.hypot(o.X - c.X, o.Y - c.Y)); }
    }
    check('(3) gridCanonicalPoint(u, v) is exactly the canvas node seen through canonicalGridFrame (max ' + worst.toExponential(1) + ')', worst < 1e-9, worst);
}

// main group
{
    const names = shapes.map(s => G('mainGroupSpec')(s).name).join(' '), Ks = shapes.map(s => G('mainGroupSpec')(s).K).join(',');
    check('(2) mainGroupSpec: 3* / 4* / 6*, K 3/4/6, unknown shape throws', names === '3* 4* 6*' && Ks === '3,4,6' && (() => { try { G('mainGroupSpec')('pentagon'); return false; } catch (e) { return true; } })());
    check('(2) isMainGroupMode: the full group only (hex rotation_reflection6; triangle/square rotation_reflection3|6); reduced modes are not', G('isMainGroupMode')('hex', 'rotation_reflection6') && !G('isMainGroupMode')('hex', 'rotation_reflection3') && !G('isMainGroupMode')('hex', 'rotation6') && G('isMainGroupMode')('triangle', 'rotation_reflection3') && !G('isMainGroupMode')('square', 'reflection_only') && !G('isMainGroupMode')('square', 'none'));
    const og = O.makeGroup('hex'), mg = G('mainGroupElements')('hex');
    check('(2) mainGroupElements = the Orakel\'s group (2K elements, same images of a test point, mirrors flagged)', ['triangle', 'square', 'hex'].every(s => { const a = O.makeGroup(s), b = G('mainGroupElements')(s); return a.length === b.length && a.every((el, i) => el.mirror === b[i].mirror && Math.hypot(...el.f(0.7, 0.3).map((v, k) => v - b[i].f(0.7, 0.3)[k])) < 1e-12); }) && og.length === mg.length);
    check('(2) mainGroupFold = the Orakel\'s fold', shapes.every(s => [[0.3, 0.9], [-1.2, 0.4], [0, 0], [2, -1]].every(([x, y]) => { const a = O.fold(s, x, y), b = G('mainGroupFold')(s, x, y); return Math.abs(a.r - b.r) < 1e-12 && Math.abs(a.t - b.t) < 1e-12; })));
    check('(2) mainGroupApothem = the Orakel\'s apothem', shapes.every(s => [1, 3, 8].every(n => Math.abs(O.apothem(s, n) - G('mainGroupApothem')(s, n)) < 1e-12)));
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
