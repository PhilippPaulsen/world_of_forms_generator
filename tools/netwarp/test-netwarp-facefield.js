/**
 * tools/netwarp/test-netwarp-facefield.js
 * Roadmap 1.6 / Group E, Step A for the FIELD warp: exact face fills. Faces are detected ONCE on the regular
 * central cell, then every tile's copy is the image of that polygon under F (affine inside each tile).
 *
 *   node tools/netwarp/test-netwarp-facefield.js
 *
 *  1. Eligibility: faces on a valid field's base sheet == the regular faces exactly (detection on regular
 *     coordinates, also with the warp installed); Single / Tiled / invalid field / layers / cross-layer stay refused.
 *  2. The real drawing: R x R copies of every face; every polygon edge lies ON a drawn (warped) chord; per-tile
 *     area = regular area x (w_i/T)(w_j/T) exactly (no gaps, no overlaps); every copy has the same colour.
 *  3. NEGATIVE CONTROL for the activeNetWarp switch-off: with the guard removed the detection runs on warped
 *     segments and the fills miss the lines - proving the guard is what makes the result right.
 *  4. Colour assignments survive a change of law, strength, axes and domain (they live on the regular cell's
 *     geometry); a change of Shape Size does NOT (the keys are pixel geometry and the grid rebuild clears them).
 *  5. Export: facesOmitted false + layerFacesOmitted + facesMapping on a field, base faces in regular cell
 *     coordinates; every other warp still omits.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export'];
const SRC = FILES.map(f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const GUARD = "const savedWarp = activeNetWarp; activeNetWarp = null;\n    let segments;\n    try { segments = collectCellSegments(connSet, gridNodes, sheet); } finally { activeNetWarp = savedWarp; }";
if (!SRC.includes(GUARD)) throw new Error('the activeNetWarp guard text changed - update the negative control');
const SRC_NOGUARD = SRC.replace(GUARD, 'const segments = collectCellSegments(connSet, gridNodes, sheet);');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const W = 600;
function makeSb(src, order, sf, mode) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        line: (a, b, c, d) => sb.lines.push([a, b, c, d]), bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, stroke: () => { }, noFill: () => { }, CLOSE: 'close',
        fill: c => { sb._fill = c; }, beginShape: () => { sb._cur = []; }, vertex: (x, y) => { sb._cur.push({ x, y }); }, endShape: () => { sb.polys.push({ fill: sb._fill, pts: sb._cur }); sb._cur = null; },
        document: { body: {} }, getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }), showNodes: true, width: W, height: W, showFaces: false,
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, activeNetWarp: null, lineColor: '#000000', altNetSeed: null,
        currentShape: 'square', shapeSizeFactor: sf, nodeCount: order, symmetryMode: mode, timeline: null, activeLayer: 'base',
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, lines: [], polys: []
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb); vm.runInContext(src, sb);
    const g = sb.buildSquareGrid(order, sf, W, W); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
    return sb;
}
let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const randConns = (sb, n) => { const ids = sb.nodes.map(x => x.id), out = []; while (out.length < n) { const a = ids[Math.floor(rnd() * ids.length)], b = ids[Math.floor(rnd() * ids.length)]; if (a !== b) out.push([a, b]); } return out; };
const FIELD = { x: { kind: 'trig', w: -1 }, y: 'same', domain: 'field' };
const distSeg = (p, s) => { const dx = s[2] - s[0], dy = s[3] - s[1], L = dx * dx + dy * dy; let t = L ? ((p.x - s[0]) * dx + (p.y - s[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (s[0] + t * dx), p.y - (s[1] + t * dy)); };
const area = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; };

// ============ 1. eligibility ============
console.log('== 1. eligibility ==');
{
    const sb = makeSb(SRC, 4, 3, 'rotation_reflection6'); seed = 4; sb.connections = randConns(sb, 4); sb.showFaces = true;
    const regular = sb.computeCellFaces(sb.connections, sb.nodes), n0 = regular.faces.length;
    check('control: a regular net has faces', n0 > 0, `${n0} faces`);
    const withSpec = spec => { sb.baseNetTransform = spec; return sb.computeCellFaces(sb.connections, sb.nodes); };
    check('a valid field: the base sheet\'s faces equal the regular faces exactly (detected on regular coordinates)', JSON.stringify(withSpec(FIELD)) === JSON.stringify(regular));
    sb.baseNetTransform = FIELD; sb.activeNetWarp = sb.netWarpBaseNow();
    check('...also while the warp is INSTALLED (as inside drawTessellation()), and the warp is restored afterwards', JSON.stringify(sb.computeCellFaces(sb.connections, sb.nodes)) === JSON.stringify(regular) && sb.activeNetWarp !== null && sb.activeNetWarp.field !== null);
    sb.activeNetWarp = null;
    check('Single and Tiled warps stay refused (no faces)', withSpec({ ...FIELD, domain: 'single' }).faces.length === 0 && withSpec({ ...FIELD, domain: 'tiled' }).faces.length === 0 && withSpec({ x: FIELD.x, y: 'same', repeat: true }).faces.length === 0);
    const ev = makeSb(SRC, 4, 4, 'rotation_reflection6'); ev.connections = sb.connections; ev.baseNetTransform = FIELD;
    check('an invalid field (Shape Size 4) falls back to Single and stays refused', ev.netWarpBaseNow().field === null && ev.computeCellFaces(ev.connections, ev.nodes).faces.length === 0);
    sb.baseNetTransform = FIELD;
    const layerSheet = { shape: 'square', symmetryMode: 'rotation_reflection6', centroid: sb.centroid, outerCorners: sb.outerCorners };
    check('a layer (sheet override) stays refused on a field', sb.computeCellFaces(sb.connections, sb.nodes, null, null, layerSheet).faces.length === 0);
    check('cross-layer faces stay refused on a field', sb.computeCrossLayerFaces(sb.connections, []).faces.length === 0);
    for (const spec of [{ x: { kind: 'geometric', w: 1.6 }, y: 'same', domain: 'field' }, { x: { kind: 'trig', w: 0.6 }, y: { kind: 'geometric', w: -1.1 }, domain: 'field' }, { x: { kind: 'trig', w: 0.4 }, y: { kind: 'uniform', w: 0 }, domain: 'field' }])
        if (JSON.stringify(withSpec(spec)) !== JSON.stringify(regular)) check('any law pair is eligible', false);
    check('any law pair is eligible: geometric, mixed trig/geometric per axis, one axis uniform - same faces', true);
    sb.baseNetTransform = { x: { kind: 'trig', w: 0 }, y: 'same', domain: 'field' }; check('a field with w = 0 is no warp at all: faces as regular', sb.computeCellFaces(sb.connections, sb.nodes).faces.length === n0);
}

// ============ 2. the real drawing ============
function run(src, R, order, spec, mode, conns) {
    const sb = makeSb(src, order, R, mode); seed = 40 + R + order; sb.connections = conns || randConns(sb, 4); sb.showFaces = true; sb.baseNetTransform = spec;
    sb.lines = []; sb.polys = []; sb.drawTessellation();
    const saved = sb.baseNetTransform; sb.baseNetTransform = null; const regular = sb.computeCellFaces(sb.connections, sb.nodes); sb.baseNetTransform = saved;
    return { sb, regular, lines: sb.lines, polys: sb.polys };
}
console.log('\n== 2. the real drawing: every tile copy exact ==');
{
    let cfgs = 0, badCount = 0, worst = 0, edges = 0, areaWorst = 0, badColor = 0, checkedTiles = 0;
    for (const R of [3, 5, 7]) for (const order of [3, 4]) for (const spec of [FIELD, { x: { kind: 'geometric', w: 1.4 }, y: 'same', domain: 'field' }, { x: { kind: 'trig', w: 0.7 }, y: { kind: 'geometric', w: -1 }, domain: 'field' }]) for (const mode of ['rotation_reflection6', 'none']) {
        const { sb, regular, lines, polys } = run(SRC, R, order, spec, mode); cfgs++;
        const nf = regular.faces.length; if (polys.length !== nf * R * R) { badCount++; continue; }
        const w = sb.netWarpBaseNow(), T = 600 / R, h = (R - 1) / 2, P = ax => sb.netFieldLaw(ax, R).field.P;
        const px = P(spec.x), py = P(spec.y === 'same' ? spec.x : spec.y);
        const regArea = regular.faces.map(f => area(f.nodeIds.map(id => regular.nodes.find(n => n.id === id))));
        for (let ci = 0; ci < R * R; ci++) {
            const chunk = polys.slice(ci * nf, (ci + 1) * nf), i = Math.floor(ci / R), j = ci % R, sxr = (px[i + 1] - px[i]), syr = (py[j + 1] - py[j]);
            chunk.forEach((pl, fi) => {
                if (pl.fill !== polys[fi].fill) badColor++;
                areaWorst = Math.max(areaWorst, Math.abs(area(pl.pts) - regArea[fi] * sxr * syr) / Math.max(1, regArea[fi] * sxr * syr));
                for (let k = 0; k < pl.pts.length; k++) { const a = pl.pts[k], b = pl.pts[(k + 1) % pl.pts.length], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; edges++; worst = Math.max(worst, ...[a, mid, b].map(p => Math.min(...lines.map(s => distSeg(p, s))))); }
            }); checkedTiles++;
        }
    }
    check('exactly faces x R x R polygons are filled (9 / 25 / 49 copies of every face)', badCount === 0, `${cfgs} configurations (R 3/5/7, Node Count 3/4, 3 law pairs, 2 modes)`);
    check('every polygon edge (both ends and the midpoint) lies ON a chord the real drawing emitted', worst < 1e-8, `${edges} edges, worst ${worst.toExponential(1)} px`);
    check('each tile copy has exactly the regular area x (w_i/T)(w_j/T) - no gaps, no overlaps (affine area scaling)', areaWorst < 1e-9, `${checkedTiles} tiles, worst relative ${areaWorst.toExponential(1)}`);
    check('all R x R copies of a face carry the same fill colour', badColor === 0);
}

// ============ 3. negative control ============
console.log('\n== 3. negative control: without the activeNetWarp switch-off the fills are wrong ==');
{
    let worstGood = 0, worstBad = 0, cfgs = 0, badRuns = 0;
    for (const R of [3, 5]) for (const order of [3, 4]) {
        const conns = order === 4 ? [[1, 16], [4, 13], [2, 8], [8, 15], [15, 9], [9, 2]] : [[1, 9], [3, 7], [2, 6], [6, 8], [8, 4], [4, 2]];   // a motif that encloses faces
        for (const [src, tag] of [[SRC, 'good'], [SRC_NOGUARD, 'bad']]) {
            const { lines, polys } = run(src, R, order, FIELD, 'rotation_reflection6', conns); cfgs++; if (polys.length === 0) badRuns += 100;
            let worst = 0; for (const pl of polys) for (const p of pl.pts) worst = Math.max(worst, Math.min(...lines.map(s => distSeg(p, s))));
            if (tag === 'good') worstGood = Math.max(worstGood, worst); else { worstBad = Math.max(worstBad, worst); if (order === 4 && worst < 0.5) badRuns++; }
        }
    }
    check('with the guard every polygon vertex is on a drawn chord (<= 1e-8 px)', worstGood < 1e-8, worstGood.toExponential(1));
    check('WITHOUT the guard (detection on warped segments, then warped again) the vertices miss the lines by whole pixels in every Node Count 4 configuration (Node Count 3 sits on the law\'s fixed points and can coincide)', badRuns === 0 && worstBad > 1, `worst miss ${worstBad.toFixed(2)} px`);
}

// ============ 4. colour assignments ============
console.log('\n== 4. colour assignments across law / strength / axes / domain / Shape Size ==');
{
    const sb = makeSb(SRC, 4, 3, 'rotation_reflection6'); seed = 61; sb.connections = randConns(sb, 5); sb.showFaces = true;
    const regular = sb.computeCellFaces(sb.connections, sb.nodes), group = sb.sheetGroupElements(sb.nodes, null), trails = sb.computeFaceTrails(regular, group);
    const store = sb.baseFaceAssignments, palette = [{ hue: 3, w: 0.1, s: 0.1 }, { hue: 9, w: 0.2, s: 0.1 }, { hue: 15, w: 0.3, s: 0.1 }, { hue: 21, w: 0.1, s: 0.2 }];
    trails.forEach((t, i) => sb.setFaceAssignment(store, t.key, palette[i % 4]));
    const before = JSON.stringify([...store.entries()]);
    const colors = spec => { sb.baseNetTransform = spec; const r = sb.computeCellFaces(sb.connections, sb.nodes, store); return JSON.stringify(r.faces.map(f => [f.nodeIds.length, f.color])); };
    const ref = colors(null), assigned = JSON.parse(ref).filter(f => /^#/.test(f[1])).length;
    check('control: the assignments recolour faces of the regular net', assigned > 0 && trails.length > 1, `${assigned} of ${JSON.parse(ref).length} faces coloured, ${trails.length} trails`);
    const specs = [FIELD, { x: { kind: 'trig', w: -0.3 }, y: 'same', domain: 'field' }, { x: { kind: 'trig', w: 0.9 }, y: 'same', domain: 'field' }, { x: { kind: 'geometric', w: 1.5 }, y: 'same', domain: 'field' }, { x: { kind: 'trig', w: 0.6 }, y: { kind: 'geometric', w: -1.1 }, domain: 'field' }];
    check('the SAME colours after every change of law, strength and per-axis laws on a field', specs.every(s => colors(s) === ref));
    check('...and back on a regular net; the store itself is untouched', colors(null) === ref && JSON.stringify([...store.entries()]) === before);
    // the panel path: the trail list (keys) is identical under any field warp
    sb.baseNetTransform = FIELD; const tA = sb.computeFaceTrails(sb.computeCellFaces(sb.connections, sb.nodes, store), group).map(t => t.key), tB = (sb.baseNetTransform = { x: { kind: 'geometric', w: 1.5 }, y: 'same', domain: 'field' }, sb.computeFaceTrails(sb.computeCellFaces(sb.connections, sb.nodes, store), group).map(t => t.key));
    check('the trail keys (what the Face Colors panel lists) do not depend on the warp', JSON.stringify(tA) === JSON.stringify(tB) && JSON.stringify(tA) === JSON.stringify(trails.map(t => t.key)));
    // Shape Size: NOT preserved
    const big = makeSb(SRC, 4, 5, 'rotation_reflection6'); big.connections = sb.connections; big.baseFaceAssignments = store; big.baseNetTransform = null;
    const r5 = big.computeCellFaces(big.connections, big.nodes, store);
    check('a change of Shape Size does NOT keep them: the keys are pixel geometry, so at Shape Size 5 none of the Shape-Size-3 assignments applies (and the real UI rebuilds the grid, which clears connections and assignments)', r5.faces.filter(f => /^#/.test(f.color)).length === 0 && /baseFaceAssignments = new Map\(\)/.test(fs.readFileSync(path.join(ROOT, 'core', 'state.js'), 'utf8').split('function rebuildGrid')[1]));
}

// ============ 5. export ============
console.log('\n== 5. export ==');
{
    const sb = makeSb(SRC, 4, 3, 'rotation_reflection6'); seed = 71; sb.connections = randConns(sb, 4);
    const reg = (() => { sb.baseNetTransform = null; const d = sb.buildExportData(null); delete d.exportedAt; return d; })();
    const ex = spec => { sb.baseNetTransform = spec; const d = JSON.parse(JSON.stringify(sb.buildExportData(null))); delete d.exportedAt; return d; };
    const f = ex(FIELD), nt = f.meta.netTransform;
    check('field: facesOmitted false, layerFacesOmitted true, facesMapping set', nt.facesOmitted === false && nt.layerFacesOmitted === true && /central cell/.test(nt.facesMapping));
    check('field: the base faces are exported in regular central-cell coordinates - the same faces/faceNodes as the regular export', JSON.stringify(f.geometry.faces) === JSON.stringify(reg.geometry.faces) && JSON.stringify(f.geometry.faceNodes) === JSON.stringify(reg.geometry.faceNodes) && f.geometry.faces.length > 0);
    check('Single / Tiled: facesOmitted stays true and no faces are exported (unchanged)', [{ ...FIELD, domain: 'single' }, { ...FIELD, domain: 'tiled' }].every(s => { const d = ex(s); return d.meta.netTransform.facesOmitted === true && !('layerFacesOmitted' in d.meta.netTransform) && !('faces' in d.geometry); }));
    sb.baseNetTransform = FIELD; sb.additionalLayers = [{ connections: [[1, 16]], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape: 'square', symmetryMode: 'rotation_reflection6', enabled: true, showFaces: true, nodeCount: 4, shapeSizeFactor: 3, nodes: sb.nodes, centroid: sb.centroid, outerCorners: sb.outerCorners }];
    const dl = JSON.parse(JSON.stringify(sb.buildExportData(null)));
    check('layers stay omitted on a field, the base faces stay', !('faces' in dl.geometry.layers[0]) && dl.geometry.faces.length > 0);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
