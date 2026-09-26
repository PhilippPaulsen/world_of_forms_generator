/**
 * tools/netwarp/test-netwarp-layerfaces.js
 * Roadmap 1.6 / Group E x 1.8 / Group D item 4: exact face fills on a FIELD warp for a layer whose grid IS the base grid (same shape and
 * size, offset 0, rotation 0 - every timeline playback layer). Its segments never leave a base tile, so its faces use the base's
 * Step-A mechanism (detect once on the regular cell, map per tile); the crossfade colours read regular-space keys and are unchanged.
 *
 *   node tools/netwarp/test-netwarp-layerfaces.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = '89c115fd';   // the last commit before layer faces on a Field
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor'];
const load = old => FILES.map(f => old ? execSync(`git show ${BASE}:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString() : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const SRC_NEW = load(false), SRC_OLD = load(true);
const SKETCH = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
const grab = name => { const m = SKETCH.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const MORPH_SRC = ['resolveConnectionsToCoords', 'ensureLayerMorphIds', 'applyLayerConnectionsMorphFrame'].map(grab).join('\n');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const W = 600, R = 5, ORDER = 4, MODE = 'rotation_reflection6';
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }


function makeSandbox(src, spec) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        line: (a, b, c, d) => sb.lines.push([a, b, c, d]), bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, noFill: () => { }, stroke: () => { }, CLOSE: 'close',
        fill: c => { sb._fill = c; }, beginShape: () => { sb._cur = []; }, vertex: (x, y) => { sb._cur.push({ x, y }); },
        endShape: () => { sb.drawnPolys.push({ fill: sb._fill, pts: sb._cur }); sb._cur = null; },
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: spec || null, baseNetAnimation: null, activeNetWarp: null, lineColor: '#000', altNetSeed: null,
        currentShape: 'square', shapeSizeFactor: R, nodeCount: ORDER, symmetryMode: MODE, width: W, height: W, showFaces: false,
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, activeLayer: 'base', timeline: null, drawnPolys: [], lines: []
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb);
    vm.runInContext(src + '\n' + MORPH_SRC, sb);
    const grid = sb.buildSquareGrid(ORDER, R, W, W);
    sb.nodes = grid.nodes; sb.centroid = grid.centroid; sb.outerCorners = grid.outerCorners;
    sb.REF = vm.runInContext('OSTWALD_REFERENCE_SYSTEM', sb);
    return sb;
}
const newLayer = (sb, extra) => {
    const g = sb.layerGrid(sb.outerCorners, sb.centroid, 'square', R, R, ORDER, 'square', W, W);
    const l = Object.assign({ connections: [], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape: 'square', symmetryMode: MODE, enabled: true, showFaces: false, nodeCount: ORDER, shapeSizeFactor: R, nodes: g.nodes, centroid: g.centroid, outerCorners: g.outerCorners }, extra || {});
    sb.additionalLayers.push(l); return l;
};
function setupTimeline(sb, idsList) {
    const kfs = idsList.map(() => newLayer(sb, { showFaces: true, enabled: false }));
    const P = newLayer(sb, { isTimelinePlayback: true });
    const tbl = sb.computeThemeLineOrbits(kfs[0].nodes, kfs[0].centroid, 'square', MODE, kfs[0].outerCorners);
    kfs.forEach((k, i) => { k.connections = idsList[i].map(j => tbl.orbits[j % tbl.orbits.length].pairs[0].slice()); });
    sb.timeline = { keyframeLayerIds: kfs.map((_, i) => i), playbackLayerIndex: kfs.length, segmentDurationsMs: kfs.slice(1).map(() => 2000), currentFrame: null };
    return { kfs, P, tbl };
}
const colorLayer = (sb, layer, rule, idx) => {
    const i = sb.additionalLayers.indexOf(layer), st = sb.faceAssignmentsFor(i), ov = sb.faceSheetOverrideOfLayer(layer), g = sb.sheetGroupElements(layer.nodes, ov);
    const trails = sb.computeFaceTrails(sb.computeCellFaces(layer.connections, layer.nodes, null, null, ov), g);
    const pal = sb.facePaletteFor(i); pal.ruleId = rule; pal.idx = idx.map((v, a) => v % sb.harmonyRuleParams(sb.getHarmonyRule(rule), sb.REF)[a].count);
    sb.applyPaletteToTrails(st, trails, pal);
    return trails;
};
const frame = (sb, S, seg, t) => {
    const A = S.kfs[seg], B = S.kfs[seg + 1];
    sb.applyLayerConnectionsMorphFrame(S.P, { fromConnections: sb.resolveConnectionsToCoords(A), toConnections: sb.resolveConnectionsToCoords(B) }, t);
    sb.timeline.currentFrame = { segmentIndex: seg, localT: t };
};
const distSeg = (p, s) => { const dx = s[2] - s[0], dy = s[3] - s[1], l = dx * dx + dy * dy; let t = l ? ((p.x - s[0]) * dx + (p.y - s[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (s[0] + t * dx), p.y - (s[1] + t * dy)); };
const area = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; };
const FIELD = { x: { kind: 'trig', w: -1 }, y: 'same', domain: 'field' };
const draw = sb => { sb.lines = []; sb.drawnPolys = []; sb.drawTessellation(); return { polys: sb.drawnPolys, lines: sb.lines }; };
// a timeline scene: two coloured keyframes, the playback layer at (seg 0, t)
function scene(src, spec, t) {
    const sb = makeSandbox(src, null), S = setupTimeline(sb, [[0, 1, 2, 3], [4, 5, 6, 7]]);
    colorLayer(sb, S.kfs[0], 'tetrad', [0, 2]); colorLayer(sb, S.kfs[1], 'isotint', [12, 3]);
    frame(sb, S, 0, t); sb.baseNetTransform = spec; return { sb, S };
}

// ============ 1. eligibility ============
console.log('== 1. eligibility ==');
{
    const sb = makeSandbox(SRC_NEW, FIELD), aligned = newLayer(sb), off = newLayer(sb, { offsetX: 30, offsetY: 30 }), rot = newLayer(sb, { rotation: 17 }), size = newLayer(sb, { shapeSizeFactor: R + 2 });
    const ov = l => sb.faceSheetOverrideOfLayer(l);
    check('layerGridMatchesBase: aligned yes; offset, rotation, other size no', sb.layerGridMatchesBase(aligned) && !sb.layerGridMatchesBase(off) && !sb.layerGridMatchesBase(rot) && !sb.layerGridMatchesBase(size));
    check('Field: netWarpBlocksFaces(sheet) is false for the aligned layer, true for the offset / rotated / other-size ones; the base sheet stays allowed', sb.netWarpBlocksFaces(ov(aligned)) === false && sb.netWarpBlocksFaces(ov(off)) === true && sb.netWarpBlocksFaces(ov(rot)) === true && sb.netWarpBlocksFaces(ov(size)) === true && sb.netWarpBlocksFaces() === false);
    sb.baseNetTransform = { ...FIELD, domain: 'single' };
    check('Single / Tiled: every sheet refused, aligned layers too', sb.netWarpBlocksFaces(ov(aligned)) === true && (sb.baseNetTransform = { ...FIELD, domain: 'tiled' }, sb.netWarpBlocksFaces(ov(aligned))) === true);
    sb.baseNetTransform = FIELD; sb.connections = [[1, 16], [4, 13], [2, 8], [8, 15], [15, 9], [9, 2]];
    check('cross-layer faces stay refused on a Field', sb.computeCrossLayerFaces(sb.connections, []).faces.length === 0);
}

// ============ 2. the investigation's before/after, real drawing ============
console.log('\n== 2. playback layer: before / after ==');
{
    for (const t of [0, 0.5]) {
        const o = scene(SRC_OLD, FIELD, t), n = scene(SRC_NEW, FIELD, t), plain = scene(SRC_NEW, null, t);
        const dO = draw(o.sb), dN = draw(n.sb), dP = draw(plain.sb);
        const savedSpec = n.sb.baseNetTransform; n.sb.baseNetTransform = null; const regular = n.sb.computeLayerCellFaces().get(n.sb.timeline.playbackLayerIndex); n.sb.baseNetTransform = savedSpec;
        console.log(`   t=${t}: without a warp ${dP.polys.length} fill polygons; previous commit on the Field ${dO.polys.length}; now ${dN.polys.length} (= ${regular.faces.length} faces x ${R * R} tiles)`);
        check(`t = ${t}: the previous commit filled NOTHING on the Field, now exactly faces x R x R polygons`, dO.polys.length === 0 && dP.polys.length > 0 && dN.polys.length === regular.faces.length * R * R && regular.faces.length > 0);
    }
}

// ============ 3. exactness ============
console.log('\n== 3. every tile copy is exact ==');
{
    let edges = 0, worst = 0, areaWorst = 0, tiles = 0, badColor = 0;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) for (const spec of [FIELD, { x: { kind: 'trig', w: 0.7, focus: -0.5 }, y: { kind: 'geometric', w: -1 }, domain: 'field' }]) {
        const { sb } = scene(SRC_NEW, spec, t), d = draw(sb), sp = sb.baseNetTransform;
        const saved = sp; sb.baseNetTransform = null; const regular = sb.computeLayerCellFaces().get(sb.timeline.playbackLayerIndex); sb.baseNetTransform = saved;
        const nf = regular.faces.length, P = ax => sb.netFieldLaw(ax, R).field.P, px = P(sp.x), py = P(sp.y === 'same' ? sp.x : sp.y), T = W / R;
        const by = new Map(regular.nodes.map(n => [n.id, n])), regArea = regular.faces.map(f => area(f.nodeIds.map(id => by.get(id))));
        // vertices vs drawn chords: chords of the PLAYBACK layer only (the base has none here)
        for (let ci = 0; ci < R * R; ci++) { const chunk = d.polys.slice(ci * nf, (ci + 1) * nf), i = Math.floor(ci / R), j = ci % R, k = (px[i + 1] - px[i]) * (py[j + 1] - py[j]);
            chunk.forEach((pl, fi) => { if (pl.fill !== d.polys[fi].fill) badColor++; areaWorst = Math.max(areaWorst, Math.abs(area(pl.pts) - regArea[fi] * k) / Math.max(1, regArea[fi] * k));
                for (let e = 0; e < pl.pts.length; e++) { const a = pl.pts[e], b = pl.pts[(e + 1) % pl.pts.length], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; edges++; worst = Math.max(worst, ...[a, mid, b].map(p => Math.min(...d.lines.map(s => distSeg(p, s))))); } }); tiles++; }
    }
    check(`every polygon edge lies ON a chord the real drawing emitted (both ends and the midpoint): ${edges} edges, worst ${worst.toExponential(1)} px (5 frames of the morph, two law pairs)`, worst < 1e-8);
    check(`each tile copy has exactly the regular area x (w_i/T)(w_j/T): ${tiles} tiles, worst relative ${areaWorst.toExponential(1)}`, areaWorst < 1e-9);
    check('all R x R copies of a face carry the same colour', badColor === 0);
}

// ============ 4. the crossfade colours ============
console.log('\n== 4. crossfade colours are unchanged by the warp ==');
{
    let same = 0, cnt = 0, varied = new Set();
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const w = scene(SRC_NEW, FIELD, t), p = scene(SRC_NEW, null, t);
        const fw = w.sb.computeLayerCellFaces().get(w.sb.timeline.playbackLayerIndex), fp = p.sb.computeLayerCellFaces().get(p.sb.timeline.playbackLayerIndex);
        cnt++; if (JSON.stringify(fw.faces.map(f => [f.nodeIds, f.color])) === JSON.stringify(fp.faces.map(f => [f.nodeIds, f.color]))) same++;
        fw.faces.forEach(f => varied.add(f.color));
        const d = draw(w.sb); const colors = new Set(d.polys.map(x => x.fill)); if (![...colors].every(c => fw.faces.some(f => f.color === c))) same--;
    }
    check(`the faces (ids and colours) at 5 morph frames are identical with and without the warp, and every drawn fill is one of those colours`, same === cnt, `${same}/${cnt}; ${varied.size} distinct colours over the morph`);
    check('the colours really change over the morph (the crossfade is active, not a constant)', varied.size > 3);
}

// ============ 5. still refused / defensive / regression ============
console.log('\n== 5. still refused, per-frame eligibility, regression ==');
{
    let bad = 0;
    for (const lay of [{ offsetX: 30, offsetY: 30 }, { rotation: 17 }, { shapeSizeFactor: R + 2 }]) {
        const o = makeSandbox(SRC_OLD, FIELD), n = makeSandbox(SRC_NEW, FIELD);
        [o, n].forEach(sb => { const l = newLayer(sb, { ...lay, showFaces: true }); l.connections = [[1, 16], [4, 13], [2, 8], [8, 15], [15, 9], [9, 2]]; });
        const dO = draw(o), dN = draw(n); if (dO.polys.length !== 0 || dN.polys.length !== 0 || JSON.stringify(dO.lines) !== JSON.stringify(dN.lines)) bad++;
    }
    check('an offset, a rotated and an other-size layer: still no fills on a Field, lines byte-identical to the previous commit', bad === 0);
    // Single / Tiled: no layer fills, unchanged
    let bad2 = 0;
    for (const dom of ['single', 'tiled']) { const o = makeSandbox(SRC_OLD, { ...FIELD, domain: dom }), n = makeSandbox(SRC_NEW, { ...FIELD, domain: dom }); [o, n].forEach(sb => { const l = newLayer(sb, { showFaces: true }); l.connections = [[1, 16], [4, 13], [2, 8], [8, 15], [15, 9], [9, 2]]; }); const dO = draw(o), dN = draw(n); if (dN.polys.length !== 0 || JSON.stringify(dO.lines) !== JSON.stringify(dN.lines)) bad2++; }
    check('Single and Tiled: layers still get no fills, lines byte-identical to the previous commit', bad2 === 0);
    // per-frame: the playback layer leaves the base grid mid-"animation" (offset) and comes back
    const { sb, S } = scene(SRC_NEW, FIELD, 0.5); const n0 = draw(sb).polys.length; S.P.offsetX = 20; const n1 = draw(sb).polys.length; S.P.offsetX = 0; const n2 = draw(sb).polys.length; S.P.rotation = 10; const n3 = draw(sb).polys.length; S.P.rotation = 0;
    check(`eligibility is re-read every frame: ${n0} polygons aligned, ${n1} with offset 20, ${n2} back at 0, ${n3} rotated`, n0 > 0 && n1 === 0 && n2 === n0 && n3 === 0);
    // an ordinary (non-playback) layer on the base grid: its own assignment colours are kept
    const q = makeSandbox(SRC_NEW, null), L = newLayer(q, { showFaces: true }); L.connections = [[1, 16], [4, 13], [2, 8], [8, 15], [15, 9], [9, 2]]; colorLayer(q, L, 'tetrad', [0, 2]);
    const plain = q.computeLayerCellFaces().get(0).faces.map(f => f.color); q.baseNetTransform = FIELD; const dq = draw(q), fw = q.computeLayerCellFaces().get(0).faces.map(f => f.color);
    check('an ordinary layer on the base grid is filled on a Field with its own assigned colours (same as without the warp)', JSON.stringify(plain) === JSON.stringify(fw) && dq.polys.length === fw.length * R * R && fw.length > 0);
    // base sheet + aligned layer together
    const b = makeSandbox(SRC_NEW, FIELD); b.showFaces = true; b.connections = [[1, 16], [4, 13], [2, 8], [8, 15], [15, 9], [9, 2]]; const bl = newLayer(b, { showFaces: true }); bl.connections = [[3, 7], [7, 14], [14, 10], [10, 3]];
    const nb = b.computeCellFaces(b.connections, b.nodes).faces.length, nl = b.computeLayerCellFaces().get(0).faces.length, db = draw(b);
    check(`base sheet and an aligned layer together: ${nb} + ${nl} faces x ${R * R} tiles = ${db.polys.length} polygons`, db.polys.length === (nb + nl) * R * R && nl > 0 && nb > 0);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
