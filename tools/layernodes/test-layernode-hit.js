/**
 * tools/layernodes/test-layernode-hit.js
 * Layer node hit-testing / dots / new free endpoints (Roadmap 1.12 x 1.3(a)). A layer's nodes are STORED canonically but DRAWN at
 * D(n) = c + offset + Rot(n - c); the dots and the click hit-test used the stored position, so at offset (30,30) a click on the
 * drawn copy of node 6 selected node 11, and at rotation 90 the clicked pair drew the other diagonal.
 *
 *   node tools/layernodes/test-layernode-hit.js
 *
 *  1. D(n) (layerNodeDrawnPosition) against the REAL drawing: the identity copy of a layer connection is drawn between D(a) and
 *     D(b) - all shapes (also cross-shape layers), offsets, rotations, layer sizes, symmetry modes (756 configurations).
 *  2. The inverse round-trips; offset 0 / rotation 0 returns the stored position EXACTLY (byte-identical to before).
 *  3. Under a net warp the display/hit position is F(D(n)) and it is exactly the end of the layer line, also for lines the Field
 *     warp decomposes into a polyline (the two fixes are orthogonal).
 *  4. A NEW free endpoint lands where it was clicked (no warp, smooth warp, Field), on an offset + rotated layer.
 *  5. Storage untouched: the helpers never mutate a layer; the wiring in sketch.js; nothing else reads them.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export'];
const SRC = FILES.map(f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
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
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, activeNetWarp: null, lineColor: '#000000', altNetSeed: null,
        currentShape: 'square', shapeSizeFactor: sf, nodeCount: order, symmetryMode: mode, timeline: null, activeLayer: 'base',
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, lines: [], polys: []
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb); vm.runInContext(src, sb);
    const g = sb.buildSquareGrid(order, sf, W, W); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
    return sb;
}


let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function build(baseShape, layerShape, order, R, lay, mode, warpSpec) {
    const sb = makeSb(SRC, order, R, mode); sb.currentShape = baseShape;
    const g = baseShape === 'square' ? sb.buildSquareGrid(order, R, W, W) : baseShape === 'hex' ? sb.buildHexGrid(order, R, W, W) : sb.buildTriangleGrid(order, R, W, W);
    sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners; sb.baseNetTransform = warpSpec || null;
    const L = { connections: [], redoStack: [], offsetX: lay.ox || 0, offsetY: lay.oy || 0, rotation: lay.rot || 0, shape: layerShape, symmetryMode: mode, enabled: true, showFaces: false, nodeCount: lay.n || order, shapeSizeFactor: lay.s || R };
    const lg = sb.layerGrid(sb.outerCorners, sb.centroid, baseShape, R, L.shapeSizeFactor, L.nodeCount, layerShape, W, W); L.nodes = lg.nodes; L.centroid = lg.centroid; L.outerCorners = lg.outerCorners;
    sb.additionalLayers = [L]; sb.connections = []; return { sb, L };
}
function drawn(sb) { // every sink call: regular endpoints + the line() calls it produced
    const calls = [], orig = sb.drawCurvedBezier;
    sb.drawCurvedBezier = function (p1, p2, ct, a, b) { const i0 = sb.lines.length; orig.call(this, p1, p2, ct, a, b); calls.push({ p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y }, from: i0, to: sb.lines.length }); };
    sb.lines = []; sb.drawTessellation(); sb.drawCurvedBezier = orig; return calls;
}
const near = (p, q, t = 1e-7) => Math.hypot(p.x - q.x, p.y - q.y) < t;

// ============ 1. D(n) against the real drawing ============
console.log('== 1. D(n) against the real drawing ==');
{
    let n = 0, bad = 0, first = null;
    for (const [bs, ls] of [['square', 'square'], ['triangle', 'triangle'], ['hex', 'hex'], ['square', 'hex'], ['hex', 'triangle'], ['triangle', 'square']]) for (const order of [3, 4, 5]) for (const R of [1, 3, 5]) for (const lay of [{}, { ox: 30, oy: 30 }, { ox: -45, oy: 17 }, { rot: 17 }, { rot: 90 }, { rot: 33, ox: 20, oy: 50 }, { s: R + 2, ox: 12 }]) for (const mode of ['none', 'rotation_reflection6']) {
        const { sb, L } = build(bs, ls, order, R, lay, mode), c = sb.centroid;
        const sorted = L.nodes.slice().sort((a, b) => Math.hypot(b.x - c.x, b.y - c.y) - Math.hypot(a.x - c.x, a.y - c.y)), a = sorted[0], b = sorted[Math.floor(sorted.length / 2)];
        L.connections = [[a.id, b.id]]; const calls = drawn(sb), Da = sb.layerNodeDrawnPosition(L, a), Db = sb.layerNodeDrawnPosition(L, b); n++;
        if (!calls.some(s => (near(s.p1, Da) && near(s.p2, Db)) || (near(s.p1, Db) && near(s.p2, Da)))) { bad++; if (!first) first = [bs, ls, order, R, JSON.stringify(lay), mode].join(' '); }
    }
    check(`the shipped layerNodeDrawnPosition() equals a drawn copy of the layer connection in every configuration`, bad === 0, `${n - bad} of ${n}${first ? ', first miss: ' + first : ''}`);
    const { sb, L } = build('square', 'square', 4, 5, { ox: 30, oy: 30 }, 'none'), n6 = L.nodes.find(x => x.id === 6), n11 = L.nodes.find(x => x.id === 11);
    const d6 = sb.layerNodeDrawnPosition(L, n6), d11 = sb.layerNodeDrawnPosition(L, n11);
    check('the investigation\'s case: offset (30,30): node 6 (280,280) is drawn at (310,310), node 11 (320,320) at (350,350)', near(d6, { x: 310, y: 310 }, 1e-9) && near(d11, { x: 350, y: 350 }, 1e-9));
    const hit = (p) => L.nodes.find(nd => { const q = sb.layerNodeDrawnPosition(L, nd); return Math.hypot(p.x - q.x, p.y - q.y) < 18; });
    check('...so a click on the drawn copy of node 6 now selects node 6 (it selected node 11), on 11 selects 11 (it selected 16)', hit({ x: 310, y: 310 }).id === 6 && hit({ x: 350, y: 350 }).id === 11);
    const r90 = build('square', 'square', 4, 5, { rot: 90 }, 'none'), a6 = r90.L.nodes.find(x => x.id === 6), a11 = r90.L.nodes.find(x => x.id === 11), q6 = r90.sb.layerNodeDrawnPosition(r90.L, a6), q11 = r90.sb.layerNodeDrawnPosition(r90.L, a11);
    check('rotation 90: nodes 6 (280,280) / 11 (320,320) are drawn at (320,280) / (280,320) - the drawn line is the other diagonal - and the dots now show it', near(q6, { x: 320, y: 280 }, 1e-9) && near(q11, { x: 280, y: 320 }, 1e-9));
}

// ============ 2. inverse, byte-identity ============
console.log('\n== 2. inverse and byte-identity ==');
{
    let worst = 0, cnt = 0;
    for (const lay of [{ ox: 30, oy: 30 }, { ox: -45, oy: 17 }, { rot: 17 }, { rot: 90 }, { rot: 33, ox: 20, oy: 50 }, { rot: -140, ox: 5 }]) { const { sb, L } = build('square', 'square', 4, 5, lay, 'none'); for (let i = 0; i < 200; i++) { const q = { x: rnd() * 700 - 50, y: rnd() * 700 - 50 }, m = sb.layerNodeFromDrawn(L, q), r = sb.layerNodeDrawnPosition(L, m); worst = Math.max(worst, Math.hypot(r.x - q.x, r.y - q.y)); const n = { x: rnd() * 600, y: rnd() * 600 }, d = sb.layerNodeFromDrawn(L, sb.layerNodeDrawnPosition(L, n)); worst = Math.max(worst, Math.hypot(d.x - n.x, d.y - n.y)); cnt++; } }
    check(`layerNodeFromDrawn(D(n)) = n and D(inverse(q)) = q to ${worst.toExponential(1)} px (${cnt * 2} points, offset / rotation / both)`, worst < 1e-9);
    let exact = true, nn = 0;
    for (const [bs, ls] of [['square', 'square'], ['triangle', 'triangle'], ['hex', 'hex'], ['square', 'hex']]) for (const s of [undefined, 2]) { const { sb, L } = build(bs, ls, 4, 3, { s }, 'none'); L.nodes.forEach(nd => { const p = sb.layerNodeDrawnPosition(L, nd), q = sb.layerNodeFromDrawn(L, nd); nn++; if (p.x !== nd.x || p.y !== nd.y || q.x !== nd.x || q.y !== nd.y) exact = false; }); }
    check(`offset 0 / rotation 0: the stored position comes back EXACTLY (===), both directions, all shapes and layer sizes - byte-identical to before`, exact, `${nn} nodes`);
}

// ============ 3. orthogonality with the Field line decomposition ============
console.log('\n== 3. Field warp: F(D(n)) is exactly the end of the (decomposed) layer line ==');
{
    const FIELD = { x: { kind: 'trig', w: -1 }, y: 'same', domain: 'field' };
    let pairs = 0, polylines = 0, bad = 0, hitOk = 0;
    for (const R of [3, 5, 7]) for (const lay of [{ ox: 30, oy: 30 }, { ox: -45, oy: 17 }, { rot: 17 }, { rot: 33, ox: 20, oy: 50 }, { s: R + 2, rot: 10, ox: 12 }]) for (const spec of [FIELD, { x: { kind: 'trig', w: 0.7, focus: -0.5 }, y: { kind: 'geometric', w: -1 }, domain: 'field' }]) {
        const { sb, L } = build('square', 'square', 4, R, lay, 'none', spec), c = sb.centroid, W_ = sb.netWarpBaseNow();
        const idx = L.nodes.map((x, i) => i); for (let k = 0; k < 12; k++) { const a = L.nodes[idx[Math.floor(rnd() * idx.length)]], b = L.nodes[idx[Math.floor(rnd() * idx.length)]]; if (a.id === b.id) continue;
            L.connections = [[a.id, b.id]]; const calls = drawn(sb), Da = sb.layerNodeDrawnPosition(L, a), Db = sb.layerNodeDrawnPosition(L, b), Fa = sb.applyNetWarp(W_, Da), Fb = sb.applyNetWarp(W_, Db); pairs++;
            // the identity-copy call: its regular endpoints are D(a), D(b)
            const call = calls.find(s => (near(s.p1, Da) && near(s.p2, Db)) || (near(s.p1, Db) && near(s.p2, Da))); if (!call) { bad++; continue; }
            const ln = []; for (let i = call.from; i < call.to; i++) { ln.push({ x: sb.lines[i][0], y: sb.lines[i][1] }); if (i === call.to - 1) ln.push({ x: sb.lines[i][2], y: sb.lines[i][3] }); }
            if (ln.length > 2) polylines++;
            const forward = near(call.p1, Da), s0 = forward ? Fa : Fb, s1 = forward ? Fb : Fa;
            if (!(near(ln[0], s0, 1e-9) && near(ln[ln.length - 1], s1, 1e-9))) bad++;
            // the hit / dot position of node a IS the line's endpoint there
            if (near(ln[0], forward ? Fa : Fb, 1e-9)) hitOk++;
        }
    }
    check(`display/hit position F(D(n)) is exactly the endpoint of the drawn layer line (both ends, within 1e-9 px): ${pairs} pairs, ${polylines} of them drawn as decomposed polylines`, bad === 0 && polylines > 100, `bad ${bad}`);
}

// ============ 4. a new free endpoint lands where it was clicked ============
console.log('\n== 4. new free endpoints ==');
{
    let n = 0, worst = 0, oldWorst = 0;
    const specs = [null, { x: { kind: 'trig', w: -1 }, y: 'same', repeat: false }, { x: { kind: 'geometric', w: 1.1 }, y: 'same', domain: 'field' }, { x: { kind: 'trig', w: -1, focus: 0.5 }, y: 'same', domain: 'field' }];
    for (const R of [3, 5]) for (const lay of [{ ox: 30, oy: 30 }, { rot: 17 }, { rot: 90, ox: -20 }, { rot: 33, ox: 20, oy: 50 }]) for (const spec of specs) {
        const { sb, L } = build('square', 'square', 4, R, lay, 'none', spec), W_ = sb.netWarpBaseNow();
        for (let k = 0; k < 15; k++) {
            const click = { x: 60 + rnd() * 480, y: 60 + rnd() * 480 }, at = sb.layerFreeNodeFromClick(L, click, W_);
            L.nodes.push({ id: 9000 + k, x: at.x, y: at.y, free: true }); L.connections = [[9000 + k, L.nodes[0].id]];
            const calls = drawn(sb), D = sb.layerNodeDrawnPosition(L, L.nodes[L.nodes.length - 1]), Fd = W_ ? sb.applyNetWarp(W_, D) : D;
            const call = calls.find(s => near(s.p1, D) || near(s.p2, D)); n++;
            const ln0 = call ? { x: sb.lines[call.from][0], y: sb.lines[call.from][1] } : null, lnEnd = call ? { x: sb.lines[call.to - 1][2], y: sb.lines[call.to - 1][3] } : null;
            const drawnEnd = call && near(call.p1, D) ? ln0 : lnEnd;
            worst = Math.max(worst, Math.hypot(Fd.x - click.x, Fd.y - click.y), drawnEnd ? Math.hypot(drawnEnd.x - click.x, drawnEnd.y - click.y) : 1e9);
            oldWorst = Math.max(oldWorst, Math.hypot(sb.layerNodeDrawnPosition(L, { x: click.x, y: click.y }).x - click.x, sb.layerNodeDrawnPosition(L, { x: click.x, y: click.y }).y - click.y));
            L.nodes.pop(); L.connections = [];
        }
    }
    check(`a free endpoint created from a click is DRAWN at the click, to ${worst.toExponential(1)} px (${n} clicks: no warp, smooth warp, Field with and without a focus; offset, rotation, both)`, worst < 1e-6, worst);
    console.log(`   the old behaviour (storing the click as it is) would have drawn it up to ${oldWorst.toFixed(1)} px away`);
    check('control: without the conversion the node would have been drawn tens of px away', oldWorst > 30);
}

// ============ 5. storage untouched, wiring ============
console.log('\n== 5. storage untouched / wiring ==');
{
    const { sb, L } = build('square', 'square', 4, 5, { ox: 30, oy: 30, rot: 17 }, 'none'); const before = JSON.stringify(L.nodes);
    L.nodes.forEach(nd => { sb.layerNodeDrawnPosition(L, nd); sb.layerNodeFromDrawn(L, nd); }); sb.layerFreeNodeFromClick(L, { x: 100, y: 100 }, null);
    check('the helpers never mutate a layer (nodes byte-identical afterwards)', JSON.stringify(L.nodes) === before);
    const ui = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
    check('sketch.js: the dots, the hit-test and the free endpoint read through the helpers', /dotPos\(layerNodeDrawnPosition\(dotLayer, nd\)\)/.test(ui) && /layerNodeDrawnPosition\(hitLayer, nd\)/.test(ui) && /layerFreeNodeFromClick\(hitLayer,/.test(ui));
    const users = FILES.filter(f => f !== 'tiling').filter(f => /layerNodeDrawnPosition|layerNodeFromDrawn|layerFreeNodeFromClick/.test(fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')));
    check('nothing in core/ except tiling.js uses them: export, orbits, faces, timeline morphing and Align to base stay storage-only readers', users.length === 0, users.join(','));
    const skUsers = ui.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n').match(/(layerNodeDrawnPosition|layerNodeFromDrawn|layerFreeNodeFromClick)\(/g).length;
    check('sketch.js uses them only at the three sites (dot, hit-test, free endpoint)', skUsers === 3, skUsers);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
