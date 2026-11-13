// G3 (task 058): the pure lage-2 builder (core/forms.js buildGridNodes / projectGridNodes / buildGrid with {beyondCeiling:true}) and
// core/symmetry.js canonicalGridFrame, measured against the Orakel tools/gitter/measure-name-rule.js (matched by COORDINATES, never by ids).
//   node tools/grid/test-lage2-builder.js        FORMS_JS / SYMMETRY_JS = mutated copies (sabotage runs); BASE = git commit of the old forms.js (default 4ab7654d)
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || '4ab7654d';
const rd = (f, env) => fs.readFileSync(env || path.join(ROOT, f), 'utf8');
const O = require('../gitter/measure-name-rule.js');
const FORM_COUNTS = eval(fs.readFileSync(path.join(ROOT, 'tools/gitter/measure-name-rule.js'), 'utf8').match(/const FORM_COUNTS = (\[[\s\S]*?\n\]);/)[1]);
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const mk = (srcs) => { const sb = { Math, console, Number, Object, Error, Set, Map, JSON, radians: d => d * Math.PI / 180, degrees: r => r * 180 / Math.PI, cos: Math.cos, sin: Math.sin, dist: (a, b, c, d) => Math.hypot(c - a, d - b), sqrt: Math.sqrt, atan2: Math.atan2, PI: Math.PI }; vm.createContext(sb); srcs.forEach(s => vm.runInContext(s, sb)); return sb; };
const N = mk([rd('core/forms.js', process.env.FORMS_JS), rd('core/symmetry.js', process.env.SYMMETRY_JS), rd('core/orbits.js')]);
const OLD = mk([cp.execFileSync('git', ['show', BASE + ':core/forms.js'], { cwd: ROOT, encoding: 'utf8' })]);
const ev = (sb, s) => vm.runInContext(s, sb);
const shapes = ['triangle', 'square', 'hex'], MODE = { triangle: 'rotation_reflection3', square: 'rotation_reflection3', hex: 'rotation_reflection6' };
const VIEW = { sizeFactor: 3, canvasW: 600, canvasH: 600 }, ALL = { beyondCeiling: true };
const grid = (shape, n, lage, view, extra) => N.buildGrid({ shape, ordnung: n, lage }, Object.assign({}, VIEW, view), ALL);
const L1 = { triangle: n => (n + 1) * (n + 2) / 2, square: n => (n + 1) * (n + 1), hex: n => 3 * n * (n + 1) + 1 };
const ADD = { triangle: n => n * n, square: n => n * n, hex: n => 6 * n * n };
const sameSet = (A, B, tol) => { if (A.length !== B.length) return false; const used = new Array(B.length).fill(false); for (const a of A) { let f = -1; for (let j = 0; j < B.length; j++) if (!used[j] && Math.hypot(a.x - B[j].x, a.y - B[j].y) < tol) { f = j; break; } if (f < 0) return false; used[f] = true; } return true; };
const matchIdx = (pts, ref, tol) => pts.map(p => { let b = -1, d = Infinity; ref.forEach((r, j) => { const e = Math.hypot(p.x - r.x, p.y - r.y); if (e < d) { d = e; b = j; } }); return d < tol ? b : -1; });

// (1) lage 1 byte-equal to the old builders, and no lage-2 leak
{
    let n1 = 0, bad = 0, leak = 0;
    const B = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };
    for (const shape of shapes) for (let c = 1; c <= (shape === 'square' ? 13 : 7); c++) for (const sf of [1, 3, 9]) for (const center of [undefined, { x: 280, y: 310 }]) {
        const old = ev(OLD, `${B[shape]}(${c}, ${sf}, 600, 600, ${J(center)})`);
        const r = N.buildGrid(N.fromLegacy(shape, c), { sizeFactor: sf, canvasW: 600, canvasH: 600, center });
        n1++; if (J(old) !== J({ nodes: r.nodes, centroid: r.centroid, outerCorners: r.outerCorners })) bad++;
        if (r.nodes.some(nd => 'u' in nd || 'v' in nd)) leak++;
    }
    check('(1) lage 1 byte-equal to the old builders (' + n1 + ' grids), no u/v fields on lage-1 nodes', bad === 0 && leak === 0, bad + '/' + leak);
    let ids = 0, n2 = 0;
    for (const shape of shapes) for (let n = 1; n <= 8; n++) {
        const c = N.toLegacy({ shape, ordnung: n, lage: 1 }), old = ev(OLD, `${B[shape]}(${c}, 3, 600, 600)`), g = grid(shape, n, 2);
        n2++; if (J(old.nodes) !== J(g.nodes.slice(0, old.nodes.length).map(nd => ({ id: nd.id, x: nd.x, y: nd.y }))) || J(old.outerCorners) !== J(g.outerCorners) || J(old.centroid) !== J(g.centroid)) ids++;
    }
    check('(1) lage 2: the lage-1 nodes (id, x, y, order), centroid and corners are exactly the old builder\'s; new nodes only appended (' + n2 + ' grids)', ids === 0, ids);
    check('(1) default validateGridSpec / buildGrid (task 072d: no switch; was: refuse lage 2) build lage 2 within the ceiling and refuse one above it; beyondCeiling lifts the ceiling', N.validateGridSpec({ shape: 'hex', ordnung: 1, lage: 2 }).ok === true && shapes.every(s => { try { N.buildGrid({ shape: s, ordnung: 2, lage: 2 }, VIEW); } catch (e) { return false; } try { N.buildGrid({ shape: s, ordnung: N.maxOrdnungFor(s, 2) + 1, lage: 2 }, VIEW); return false; } catch (e) { return /exceeds/.test(e.message); } }) && N.validateGridSpec({ shape: 'hex', ordnung: 1, lage: 2 }, { beyondCeiling: true }).ok);
    check('(1) with the switch: ordnung 0, unknown shape, lage 3, legacyC1 still refused', [{ shape: 'hex', ordnung: 0, lage: 2 }, { shape: 'x', ordnung: 1, lage: 2 }, { shape: 'hex', ordnung: 1, lage: 3 }, { shape: 'square', ordnung: 1, lage: 2, legacyC1: true }].every(s => !N.validateGridSpec(s, ALL).ok));
}

// (2) formulas, ids, unique integer keys, n = 1..8, all shapes
{
    let bad = '';
    for (const shape of shapes) for (let n = 1; n <= 8; n++) {
        const g = grid(shape, n, 2), want = L1[shape](n) + ADD[shape](n), uv = N.buildGridNodes({ shape, ordnung: n, lage: 2 }, ALL);
        const keys = new Set(uv.map(p => p.u6 + ',' + p.v6));
        if (g.nodes.length !== want) bad += ` ${shape}${n}:count ${g.nodes.length}/${want}`;
        if (keys.size !== uv.length) bad += ` ${shape}${n}:dupkeys`;
        if (!g.nodes.every((nd, i) => nd.id === i + 1 && nd.u === uv[i].u6 / 6 && nd.v === uv[i].v6 / 6 && Number.isInteger(uv[i].u6) && Number.isInteger(uv[i].v6))) bad += ` ${shape}${n}:ids/uv`;
        if (N.buildGridNodes({ shape, ordnung: n, lage: 1 }).length !== L1[shape](n)) bad += ` ${shape}${n}:L1`;
    }
    check('(2) node counts: triangle L1 + n^2, square L1 + n^2, hex L1 + 6n^2 (n = 1..8), ids consecutive, integer keys (denominator 6) unique', bad === '', bad);
    check('(2) hex ordnung 1: 7 lage-1 nodes (centre included), 13 in lage 2', N.buildGridNodes({ shape: 'hex', ordnung: 1, lage: 1 }).length === 7 && grid('hex', 1, 2).nodes.length === 13);
    check('(2) mesh centres sit at thirds (triangle/hex) or halves (square): u6 mod 6 in {2,4} resp. 3', N.buildGridNodes({ shape: 'triangle', ordnung: 4, lage: 2 }, ALL).slice(15).every(p => [2, 4].includes(p.u6 % 6)) && N.buildGridNodes({ shape: 'square', ordnung: 4, lage: 2 }, ALL).slice(25).every(p => p.u6 % 6 === 3 && p.v6 % 6 === 3));
    // lage-1 (u,v) are the lattice coordinates of the legacy nodes: projection reproduces the legacy x, y
    let worst = 0;
    for (const shape of shapes) for (let n = 1; n <= 7; n++) {
        const g1 = N.buildGrid({ shape, ordnung: n, lage: 1 }, VIEW), uv = N.buildGridNodes({ shape, ordnung: n, lage: 1 });
        const pr = N.projectGridNodes(uv, { shape, ordnung: n, outerCorners: g1.outerCorners, centroid: g1.centroid });
        pr.forEach((p, i) => { worst = Math.max(worst, Math.hypot(p.x - g1.nodes[i].x, p.y - g1.nodes[i].y)); });
    }
    check('(2) projectGridNodes(u, v) reproduces the legacy lage-1 coordinates, node by node (max error ' + worst.toExponential(1) + ' px)', worst < 1e-9, worst);
}

// (3)/(2b) against the Orakel: point sets (by coordinates), node orbits, pair orbits
const ORACLE = {};
const orc = (shape, n, lage) => ORACLE[shape + n + lage] || (ORACLE[shape + n + lage] = O.buildGrid(shape, n, lage));
{
    let badSet = '', cnt = 0;
    for (const shape of shapes) for (let n = 1; n <= 8; n++) for (const lage of [1, 2]) {
        const g = N.buildGrid({ shape, ordnung: n, lage }, VIEW, ALL), fr = N.canonicalGridFrame({ shape, ordnung: n, centroid: g.centroid, outerCorners: g.outerCorners });
        const mine = g.nodes.map(nd => { const o = fr.toOracle(nd.x, nd.y); return { x: o.X, y: o.Y }; });
        cnt++; if (!sameSet(mine, orc(shape, n, lage).nodes, 1e-6)) badSet += ` ${shape}${n}/${lage}`;
    }
    check('(2) all shapes x lage 1/2 x n = 1..8 (' + cnt + ' grids): the canvas nodes mapped through canonicalGridFrame are exactly the Orakel\'s point set', badSet === '', badSet);
}
{
    let bad = '';
    for (const [shape, n, lage, label] of FORM_COUNTS) {
        const g = N.buildGrid({ shape, ordnung: n, lage }, VIEW, ALL), og = orc(shape, n, lage);
        const fr = N.canonicalGridFrame({ shape, ordnung: n, centroid: g.centroid, outerCorners: g.outerCorners });
        const idx = matchIdx(g.nodes.map(nd => { const o = fr.toOracle(nd.x, nd.y); return { x: o.X, y: o.Y }; }), og.nodes, 1e-6);
        if (idx.some(i => i < 0) || new Set(idx).size !== og.nodes.length) { bad += ` ${label}:nodes`; continue; }
        const ctx = g.nodes, ops = ev(N, `computeGroupElements`)(ctx, g.centroid, shape, MODE[shape], g.outerCorners);   // throws when the node set is not closed under the group
        // node orbits of the canvas side (union over the group perms) against the Orakel's zahl, node for node
        const parent = ctx.map((_, i) => i), find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; }, pos = new Map(ctx.map((nd, i) => [nd.id, i]));
        ops.perms.forEach(pm => pm.forEach((to, from) => { const a = find(pos.get(from)), b = find(pos.get(to)); if (a !== b) parent[a] = b; }));
        const orbitsHere = new Set(ctx.map((_, i) => find(i))).size;
        const zOf = i => og.nodes[idx[i]].zahl;
        let part = true; const byRoot = new Map();
        ctx.forEach((_, i) => { const r = find(i); if (!byRoot.has(r)) byRoot.set(r, zOf(i)); else if (byRoot.get(r) !== zOf(i)) part = false; });
        if (orbitsHere !== og.orbits.length || !part || new Set(byRoot.values()).size !== orbitsHere) bad += ` ${label}:node orbits ${orbitsHere}/${og.orbits.length}`;
        const po = ev(N, 'computeThemeLineOrbits')(ctx, g.centroid, shape, MODE[shape], g.outerCorners);
        const pairs = O.pairOrbits(og).length;
        if (po.orbits.length !== pairs || po.rawPairCount !== og.nodes.length * (og.nodes.length - 1) / 2) bad += ` ${label}:pair orbits ${po.orbits.length}/${pairs}`;
        // the pair partition itself: two canvas pairs share an orbit iff their Orakel images do
        const oPairOrbit = new Map(); O.pairOrbits(og).forEach((o, k) => o.pairs.forEach(([i, j]) => oPairOrbit.set(i + ',' + j, k)));
        const inv = []; idx.forEach((oi, ci) => { inv[oi] = ci; });
        let mism = 0;
        for (const [k, o] of po.orbits.entries()) for (const [a, b] of o.pairs) { const ia = idx[pos.get(a)], ib = idx[pos.get(b)], key = Math.min(ia, ib) + ',' + Math.max(ia, ib); const ok2 = oPairOrbit.get(key); if (o.pairs.length && ok2 === undefined) mism++; }
        const map = new Map(); for (const [k, o] of po.orbits.entries()) { const [a, b] = o.pairs[0]; const ia = idx[pos.get(a)], ib = idx[pos.get(b)]; const key = oPairOrbit.get(Math.min(ia, ib) + ',' + Math.max(ia, ib)); if (map.has(key)) mism++; map.set(key, k); }
        if (mism) bad += ` ${label}:pair partition`;
    }
    check('(2)/(3) the 12 reference grids: coordinates, node orbits (partition and number), pair orbits (number and partition) equal the Orakel; node set closed under 3*/4*/6* (computeGroupElements would throw)', bad === '', bad);
}
{   // (3) group closure of lage 2, n = 1..8 (hex up to 6 here, 7..8 in the load measurement), no throw, every perm a bijection
    let bad = '';
    for (const shape of shapes) for (let n = 1; n <= (shape === 'hex' ? 6 : 8); n++) {
        const g = grid(shape, n, 2);
        try { const ops = ev(N, 'computeGroupElements')(g.nodes, g.centroid, shape, MODE[shape], g.outerCorners); if (!ops.perms.every(pm => new Set(pm.values()).size === g.nodes.length)) bad += ` ${shape}${n}:perm`; if (ops.perms.length !== { triangle: 6, square: 8, hex: 12 }[shape]) bad += ` ${shape}${n}:order`; } catch (e) { bad += ` ${shape}${n}:${e.message.slice(0, 40)}`; }
    }
    check('(3) lage-2 node set closed under the main group (3* D3, 4* D4, 6* D6) for n = 1..8 (hex to 6); group orders 6/8/12', bad === '', bad);
}

// (4) oriented pairs: handedness on screen == handedness in the Orakel frame (y mirror), plus fixed concrete pairs
{
    let bad = 0, tested = 0;
    for (const shape of shapes) for (const n of [2, 3, 4]) for (const flip of [false, true]) {
        const g = grid(shape, n, 2);
        const geo = flip ? { shape, ordnung: n, centroid: { x: g.centroid.x, y: 600 - g.centroid.y }, outerCorners: g.outerCorners.map(p => ({ x: p.x, y: 600 - p.y })) } : { shape, ordnung: n, centroid: g.centroid, outerCorners: g.outerCorners };
        const nodes = g.nodes.map(nd => ({ x: nd.x, y: flip ? 600 - nd.y : nd.y }));
        const fr = N.canonicalGridFrame(geo), c = geo.centroid;
        const O2 = nodes.map(p => fr.toOracle(p.x, p.y));
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
            const screen = (nodes[i].x - c.x) * (nodes[j].y - c.y) - (nodes[i].y - c.y) * (nodes[j].x - c.x);   // y down: positive = clockwise on screen
            const ora = O2[i].X * O2[j].Y - O2[i].Y * O2[j].X;                                                 // y up: positive = counter-clockwise
            if (Math.abs(screen) < 1e-6 || Math.abs(ora) < 1e-9) continue;
            tested++; if ((screen > 0) === (ora > 0)) bad++;   // clockwise on screen must be NEGATIVE in the Orakel
        }
    }
    check('(4) every oriented pair: counter-clockwise on screen = counter-clockwise in the Orakel frame, also for a vertically mirrored canvas (' + tested + ' pairs)', bad === 0 && tested > 1000, bad);
    // concrete pairs: triangle n = 2 lage 1 (canvas): apex A, B bottom-left, C bottom-right; Orakel corners at 0 / 120 / 240 degrees
    const g = grid('triangle', 2, 1), fr = N.canonicalGridFrame({ shape: 'triangle', ordnung: 2, centroid: g.centroid, outerCorners: g.outerCorners });
    const o0 = fr.toOracle(g.outerCorners[0].x, g.outerCorners[0].y), o1 = fr.toOracle(g.outerCorners[1].x, g.outerCorners[1].y), R = 2 / Math.sqrt(3);
    check('(4) triangle: apex -> Orakel (R, 0); bottom-left corner -> 120 degrees (counter-clockwise from the apex)', Math.abs(o0.X - R) < 1e-9 && Math.abs(o0.Y) < 1e-9 && Math.abs(o1.X + R / 2) < 1e-9 && Math.abs(o1.Y - R * Math.sqrt(3) / 2) < 1e-9, J([o0, o1]));
    const gs = grid('square', 4, 1), fs = N.canonicalGridFrame({ shape: 'square', ordnung: 4, centroid: gs.centroid, outerCorners: gs.outerCorners });
    const t = fs.toOracle(gs.outerCorners[0].x, gs.outerCorners[0].y), r = fs.toOracle(gs.outerCorners[1].x, gs.outerCorners[1].y);
    check('(4) square n = 4: canvas top-left -> Orakel (-2, +2) (y up), top-right -> (+2, +2)', Math.abs(t.X + 2) < 1e-9 && Math.abs(t.Y - 2) < 1e-9 && Math.abs(r.X - 2) < 1e-9 && Math.abs(r.Y - 2) < 1e-9, J([t, r]));
    const bk = fr.toCanvas(o1.X, o1.Y);
    check('(4) the frame round-trips: toCanvas(toOracle(p)) = p', Math.hypot(bk.x - g.outerCorners[1].x, bk.y - g.outerCorners[1].y) < 1e-9);
}

// (5) size, translation, canvas y mirror leave u, v (and the Orakel coordinates of every id) unchanged
{
    let bad = '';
    for (const shape of shapes) for (const n of [1, 3, 5]) {
        const base = grid(shape, n, 2), fb = N.canonicalGridFrame({ shape, ordnung: n, centroid: base.centroid, outerCorners: base.outerCorners });
        const ref = base.nodes.map(nd => fb.toOracle(nd.x, nd.y));
        const variants = [{ sizeFactor: 1 }, { sizeFactor: 9 }, { canvasW: 900, canvasH: 400, sizeFactor: 2 }, { center: { x: 123, y: 457 } }];
        variants.forEach((v, vi) => {
            const g = grid(shape, n, 2, v), f = N.canonicalGridFrame({ shape, ordnung: n, centroid: g.centroid, outerCorners: g.outerCorners });
            g.nodes.forEach((nd, i) => { const o = f.toOracle(nd.x, nd.y); if (nd.u !== base.nodes[i].u || nd.v !== base.nodes[i].v || Math.hypot(o.X - ref[i].X, o.Y - ref[i].Y) > 1e-6) bad += ` ${shape}${n}v${vi}#${i}`; });
        });
        // y mirror of the canvas: project the SAME (u, v) with mirrored corners -> mirrored points, the frame handles the winding
        const uv = N.buildGridNodes({ shape, ordnung: n, lage: 2 }, ALL), mc = { x: base.centroid.x, y: 600 - base.centroid.y }, moc = base.outerCorners.map(p => ({ x: p.x, y: 600 - p.y }));
        const pm = N.projectGridNodes(uv, { shape, ordnung: n, outerCorners: moc, centroid: mc }), fm = N.canonicalGridFrame({ shape, ordnung: n, centroid: mc, outerCorners: moc });
        pm.forEach((nd, i) => { const o = fm.toOracle(nd.x, nd.y); if (nd.u !== base.nodes[i].u || nd.v !== base.nodes[i].v || Math.abs(nd.x - base.nodes[i].x) > 1e-9 || Math.abs(nd.y - (600 - base.nodes[i].y)) > 1e-9) bad += ` ${shape}${n}mirror#${i}`; });
        if (!fm.mirrored && shape !== 'hex' && false) bad += 'x';
        if (fm.mirrored === fb.mirrored) bad += ` ${shape}${n}:winding not detected`;
    }
    check('(5) size, translation, canvas size and a vertical canvas mirror change neither u, v nor the Orakel coordinates of any id', bad === '', bad.slice(0, 200));
}

// (6) other regular-polygon geometries: alt-net (completeEdgeToRegularPolygon, both sides) and layerGrid same-/cross-shape
{
    let bad = '', cases = 0;
    const closed = (shape, n, geo, label) => {
        const fr = N.canonicalGridFrame({ shape, ordnung: n, centroid: geo.centroid, outerCorners: geo.outerCorners });
        const uv = N.buildGridNodes({ shape, ordnung: n, lage: 2 }, ALL), pr = N.projectGridNodes(uv, { shape, ordnung: n, outerCorners: geo.outerCorners, centroid: geo.centroid });
        cases++;
        try { ev(N, 'computeGroupElements')(pr, geo.centroid, shape, MODE[shape], geo.outerCorners); } catch (e) { bad += ` ${label}:not closed`; return; }
        if (!sameSet(pr.map(nd => { const o = fr.toOracle(nd.x, nd.y); return { x: o.X, y: o.Y }; }), orc(shape, n, 2).nodes, 1e-6)) bad += ` ${label}:oracle set`;
    };
    for (const [shape, k] of [['triangle', 3], ['square', 4], ['hex', 6]]) for (const side of [1, -1]) for (const n of [2, 3]) {
        const e = ev(N, `completeEdgeToRegularPolygon({ x: 120, y: 230 }, { x: 310, y: 260 }, ${k}, ${side})`);
        closed(shape, n, { centroid: e.center, outerCorners: e.vertices }, `alt-${shape}${n}/${side}`);
    }
    for (const [bs, ls] of [['triangle', 'hex'], ['hex', 'square'], ['square', 'triangle'], ['square', 'square'], ['triangle', 'triangle']]) for (const n of [2, 4]) {
        const b = N.buildGrid({ shape: bs, ordnung: 3, lage: 1 }, VIEW), c = N.toLegacy({ shape: ls, ordnung: n, lage: 1 });
        const lg = N.layerGrid(b.outerCorners, b.centroid, bs, 3, 2, c, ls, 600, 600);
        closed(ls, n, lg, `layer-${bs}->${ls}${n}`);
    }
    check('(6) lage 2 on alt-net geometries (both sides, rotated/mirrored) and on layerGrid geometries (same-shape and cross-shape): group-closed and equal to the Orakel (' + cases + ' cases) - builder level only; layerGrid itself still returns lage 1', bad === '', bad);
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
