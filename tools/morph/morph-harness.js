// Test harness for the spatial morph (stage a2). NOT a test (the glob tools/*/test-*.js does not pick it up): the tests in this folder require it.
// It is the render stage in miniature, so the pure functions of core/spatial-morph.js can be measured on REAL tilings:
//   makeWorld(shape, order, sf, W)  runs the real core files (forms, symmetry, curves, tiling) in a vm, with a recording drawShapeCell(), and returns the tile transforms
//                                   (tileC, flip180) that core/tiling.js really produces, the base cell polygon (outerCorners) and the real toTileLocal() of core/state.js.
//   symOps(world, symMode)          the symmetry operations of one tile (a port of the prototype's _buildSpatialMorphSymOps(): the same rotation lists per shape and mode).
//   toWorld(world, tile, op, ...)   canonical cell point -> world point: toTileLocal, then rotateAround, then reflectAcrossLine (the prototype's _transformCanonicalToWorld()).
//   morphTile(M, world, cfg, prepared, tile, force)   one tile's drawn segments: a1 weights at the tile centroid, a2 anchoring, with the edge weights taken at the world image of the edge midpoint.
//   buildClosedCorners(M, world, symMode, seed)   four corner line sets whose boundary endpoints have a PARTNER on the neighbouring tile in all four keyframes (see below).
//   measureSeams(M, world, cfg, corners)   the seam drift of a morph: see the comment there.
// The pure functions are taken from the module `M` that the caller loads (so a sabotaged copy can be measured with the same harness).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const CORE_SRC = ['forms', 'symmetry', 'curves', 'tiling'].map((f) => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n;\n');
const STATE_SRC = fs.readFileSync(path.join(ROOT, 'core', 'state.js'), 'utf8');
const TO_TILE_LOCAL = /function toTileLocal\(n, tileC, flip180, rotationDeg = 0\) \{[\s\S]*?\n\}\n/.exec(STATE_SRC)[0];
const TILE_FN = { square: 'tileSquare', triangle: 'tileTriangle', hex: 'tileHex' };
const GRID_FN = { square: 'buildSquareGrid', triangle: 'buildTriangleGrid', hex: 'buildHexGrid' };

function makeWorld(shape, order, sf, W) {
    const sb = {
        Math, console, width: W, height: W, canvasW: W, canvasH: W, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, sqrt: Math.sqrt, abs: Math.abs,
        cos: Math.cos, sin: Math.sin, atan2: Math.atan2, PI: Math.PI, radians: (d) => d * Math.PI / 180, additionalLayers: [], activeNetWarp: null, currentShape: shape, tiles: [],
    };
    vm.createContext(sb);
    vm.runInContext(CORE_SRC, sb, { filename: 'core (forms, symmetry, curves, tiling)' });
    vm.runInContext(TO_TILE_LOCAL, sb, { filename: 'core/state.js toTileLocal' });
    const g = sb[GRID_FN[shape]](order, sf, W, W);
    sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners; sb.connections = [];
    sb.drawShapeCell = (cs, tc, fl, na, rot) => sb.tiles.push({ tileC: { x: tc.x, y: tc.y }, flip180: !!fl, rot: rot || 0 });
    sb.drawAdditionalLayers = () => { };
    vm.runInContext(TILE_FN[shape] + '(null, null, undefined)', sb);
    return { shape, order, sf, W, sb, tiles: sb.tiles, poly: g.outerCorners, ctr: g.centroid, center: { x: W / 2, y: W / 2 } };
}

// the prototype's symmetry operation list per shape and symmetry mode
function symOps(world, mode) {
    const shape = world.shape;
    let rot = [];
    const r3 = mode === 'rotation3' || mode === 'rotation_reflection3', r6 = mode === 'rotation6' || mode === 'rotation_reflection6';
    if (shape === 'square') { if (r3 || r6) rot = [90, 180, 270]; }
    else if (shape === 'triangle') { if (r3 || r6) rot = [120, 240]; }
    else if (r3) rot = [120, 240];
    else if (r6) rot = [60, 120, 180, 240, 300];
    const refl = mode === 'reflection_only' || mode === 'rotation_reflection3' || mode === 'rotation_reflection6';
    const axisDir = refl ? world.sb.mirrorAxisDir(world.poly, world.ctr, shape) : null;
    const ops = [{ angle: 0, reflected: false }];
    rot.forEach((a) => ops.push({ angle: a, reflected: false }));
    if (refl) { ops.push({ angle: 0, reflected: true }); if (mode !== 'reflection_only') rot.forEach((a) => ops.push({ angle: a, reflected: true })); }
    return { ops, axisDir };
}

function toWorld(world, tile, op, axisDir, p) {
    const sb = world.sb;
    let w = sb.toTileLocal(p, tile.tileC, tile.flip180, tile.rot || 0);
    if (op.angle) w = sb.rotateAround(w, tile.tileC, op.angle);
    if (op.reflected && axisDir) w = sb.reflectAcrossLine(w, tile.tileC, axisDir);
    return w;
}

// the span the weights are normalised over: the extremes over all tile centroids (the render stage will do the same with its own tile list)
function makeSpan(M, world, mode, angleDeg) {
    const cs = world.tiles.map((t) => t.tileC);
    const opts = { angleDeg, center: world.center };
    if (M.spatialMorphNormalizeMode(mode) === 'bilinear') {
        return { minX: Math.min(...cs.map((c) => c.x)), maxX: Math.max(...cs.map((c) => c.x)), minY: Math.min(...cs.map((c) => c.y)), maxY: Math.max(...cs.map((c) => c.y)) };
    }
    const sc = cs.map((c) => M.spatialMorphScalar(mode, c, opts));
    return { scalarMin: Math.min(...sc), scalarMax: Math.max(...sc) };
}

// one tile: the segments it draws, in the prototype's order (every line, every symmetry operation). cfg = { mode, angleDeg, span, symMode }.
// force = constant weights (a baseline: every tile and every edge uses the same four weights) or undefined for the spatial morph.
function morphTile(M, world, cfg, prepared, tile, force) {
    const so = cfg.sym || symOps(world, cfg.symMode);
    const opts = { angleDeg: cfg.angleDeg, center: world.center };
    const weightsAt = (pt) => force || M.spatialMorphCornerWeights(cfg.mode, pt, cfg.span, opts);
    const wTile = weightsAt(tile.tileC);
    const out = [];
    prepared.forEach((pl, i) => {
        so.ops.forEach((op, s) => {
            const ends = ['a', 'b'].map((e) => {
                const d = pl[e];
                const wEdge = d.onBoundary && d.moved ? (cfg.edgeFromTile ? wTile : weightsAt(toWorld(world, tile, op, so.axisDir, d.sample))) : null;   // edgeFromTile: a NEGATIVE CONTROL (the tile's weights for the edge ends)
                return toWorld(world, tile, op, so.axisDir, M.spatialMorphAnchoredPoint(d, wTile, wEdge));
            });
            out.push({ line: i, op: s, a: ends[0], b: ends[1] });
        });
    });
    return out;
}

// ---- a deterministic random source (so every run, and the sabotage runs, see the same numbers)
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function distToSegment(p, v, w) {
    const dx = w.x - v.x, dy = w.y - v.y, l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - v.x) * dx + (p.y - v.y) * dy) / l2));
    return Math.hypot(p.x - (v.x + t * dx), p.y - (v.y + t * dy));
}

function tileWorldPoly(world, tile) { return world.poly.map((p) => world.sb.toTileLocal(p, tile.tileC, tile.flip180, tile.rot || 0)); }

// pairs of tiles that share an edge: [{ a, b, v, w }] (a, b: indices into world.tiles; v, w: the shared world edge)
function neighbourPairs(world) {
    const polys = world.tiles.map((t) => tileWorldPoly(world, t));
    const R = Math.max(...world.poly.map((p) => Math.hypot(p.x - world.ctr.x, p.y - world.ctr.y)));
    const pairs = [];
    for (let a = 0; a < world.tiles.length; a++) {
        for (let b = a + 1; b < world.tiles.length; b++) {
            if (Math.hypot(world.tiles[a].tileC.x - world.tiles[b].tileC.x, world.tiles[a].tileC.y - world.tiles[b].tileC.y) > 2 * R + 1e-6) continue;
            const shared = polys[a].filter((p) => polys[b].some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6));
            if (shared.length === 2) pairs.push({ a, b, v: shared[0], w: shared[1] });
        }
    }
    return pairs;
}

// the inverse of toTileLocal for the plain (rot = 0 or any rot) tile transform: world point -> canonical cell point
function fromTile(world, tile, p) {
    let x = p.x - tile.tileC.x, y = p.y - tile.tileC.y;
    if (tile.rot) { const r = -tile.rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; }
    if (tile.flip180) { x = -x; y = -y; }
    return { x: world.ctr.x + x, y: world.ctr.y + y };
}

function edgeOfAll(world, pts, tol) {
    const n = world.poly.length;
    for (let e = 0; e < n; e++) if (pts.every((p) => distToSegment(p, world.poly[e], world.poly[(e + 1) % n]) <= tol)) return e;
    return -1;
}

// PARTNER-CLOSED corner line sets. A boundary endpoint of the base cell has, in the neighbouring tile, a partner at the same world point; the seam can only close if the pattern HAS that
// partner endpoint, in all four keyframes at once (otherwise there is nothing on the other side to meet). So: seed one boundary endpoint (four positions, one per keyframe, all on one
// edge, sliding differently in each keyframe) per edge, then close the set: for every symmetry operation g of the tile and every neighbour B of a tile A, the world point of g(P) on
// A, taken back into B's cell by the inverse of B's own tile transform, is another boundary endpoint (tuple of four positions). Repeat until nothing new appears.
// Lines: every boundary endpoint is one end of a line whose other end is an interior point (random in each keyframe, well inside); about every fifth line has two boundary ends (each boundary endpoint is used by exactly one line); plus some
// interior-only lines, and static boundary endpoints (the same place in all four keyframes). Returns { k00, k10, k01, k11 } (arrays of { x1, y1, x2, y2 }) and { tuples }.
function buildClosedCorners(M, world, symMode, seed, options) {
    const rnd = rng(seed);
    const n = world.poly.length;
    const so = symOps(world, symMode);
    const polyPoint = (e, t) => { const v = world.poly[e], w = world.poly[(e + 1) % n]; return { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }; };
    const tuples = [];
    const same = (t, u) => t.every((p, k) => Math.hypot(p.x - u[k].x, p.y - u[k].y) < 1e-7);
    const add = (t) => { if (!tuples.some((u) => same(t, u))) { tuples.push(t); return true; } return false; };
    for (let e = 0; e < n; e++) {
        add([0, 1, 2, 3].map(() => polyPoint(e, 0.15 + 0.7 * rnd())));                              // a sliding endpoint (different place in each keyframe)
        if (e % 2 === 0) { const t = 0.2 + 0.6 * rnd(); add([0, 1, 2, 3].map(() => polyPoint(e, t))); }   // a static one (same place in all four)
    }
    // one representative tile per tile type (flip180), the one nearest to the middle, and its neighbours
    const pairs = neighbourPairs(world);
    const mid = world.center;
    const reps = [false, true].map((f) => {
        const cand = world.tiles.map((t, i) => ({ t, i })).filter((o) => o.t.flip180 === f);
        if (!cand.length) return null;
        cand.sort((p, q) => Math.hypot(p.t.tileC.x - mid.x, p.t.tileC.y - mid.y) - Math.hypot(q.t.tileC.x - mid.x, q.t.tileC.y - mid.y));
        return cand[0].i;
    }).filter((i) => i !== null);
    for (let guard = 0; guard < ((options && options.closure === false) ? 0 : 40); guard++) {   // closure: false is a NEGATIVE CONTROL (seeds only: no endpoint has a partner)
        let grew = false;
        for (const t of tuples.slice()) {
            for (const A of reps) {
                const nb = pairs.filter((p) => p.a === A || p.b === A).map((p) => (p.a === A ? p.b : p.a));
                for (const op of so.ops) {
                    const W = t.map((p) => toWorld(world, world.tiles[A], op, so.axisDir, p));
                    for (const B of nb) {
                        const Q = W.map((p) => fromTile(world, world.tiles[B], p));
                        if (edgeOfAll(world, Q, 1e-7) < 0) continue;
                        if (add(Q)) grew = true;
                    }
                }
            }
        }
        if (!grew) break;
        if (tuples.length > 400) throw new Error('closure did not terminate');
    }
    const interior = () => [0, 1, 2, 3].map(() => {
        const a = Math.floor(rnd() * n), b = (a + 1 + Math.floor(rnd() * (n - 1))) % n;
        const r1 = 0.1 + 0.3 * rnd(), r2 = 0.1 + 0.3 * rnd();
        return { x: world.ctr.x + r1 * (world.poly[a].x - world.ctr.x) + r2 * (world.poly[b].x - world.ctr.x), y: world.ctr.y + r1 * (world.poly[a].y - world.ctr.y) + r2 * (world.poly[b].y - world.ctr.y) };
    });
    const lines = [];
    for (let i = 0; i < tuples.length; i++) {   // every boundary endpoint is used exactly once (a doubly used one would have one partner for two ends and look like an unmatched seam point)
        if (i % 5 === 4 && i + 1 < tuples.length) { lines.push([tuples[i], tuples[i + 1]]); i++; } else lines.push([tuples[i], interior()]);
    }
    for (let i = 0; i < 3; i++) lines.push([interior(), interior()]);
    const corners = { k00: [], k10: [], k01: [], k11: [] };
    const names = ['k00', 'k10', 'k01', 'k11'];
    lines.forEach(([p, q]) => names.forEach((nm, k) => corners[nm].push({ x1: p[k].x, y1: p[k].y, x2: q[k].x, y2: q[k].y })));
    return { corners, tuples: tuples.length, lines: lines.length };
}

// THE SEAM MEASUREMENT. For every pair of neighbouring tiles (A, B) with the shared world edge (v, w):
//   1. at a CONSTANT mixed weight (0.1, 0.2, 0.3, 0.4 for all tiles and edges: a plain tessellation) pair every endpoint of A that lies on the edge (within 1e-6) with the endpoint of B
//      that lies at the same place (within 1e-9); this is the pairing by construction (partner-closed input) and says how many seams there are to close; an endpoint without a partner is
//      counted as `unmatched`; the same pairing must hold at the four pure keyframes (checked: `baselineWorst`).
//   2. in the spatial morph (weights from the tile centroids and the shared edge midpoints) compute the distance between the two members of every pair: the DRIFT.
// Returns { tilePairs, seamPoints, unmatched, baselineWorst, maxDrift, maxMove }.
function measureSeams(M, world, cfg, corners) {
    const prepared = M.spatialMorphPrepareLines(corners, world.poly);
    const so = symOps(world, cfg.symMode);
    const c = Object.assign({}, cfg, { sym: so });
    const drawAll = (force) => world.tiles.map((t) => morphTile(M, world, c, prepared, t, force));
    const mixed = drawAll({ w00: 0.1, w10: 0.2, w01: 0.3, w11: 0.4 });
    const corner = [{ w00: 1, w10: 0, w01: 0, w11: 0 }, { w00: 0, w10: 1, w01: 0, w11: 0 }, { w00: 0, w10: 0, w01: 1, w11: 0 }, { w00: 0, w10: 0, w01: 0, w11: 1 }].map(drawAll);
    const spatial = drawAll(undefined);
    const ends = (segs, v, w) => {
        const o = [];
        segs.forEach((s) => ['a', 'b'].forEach((e) => { if (distToSegment(s[e], v, w) <= 1e-6) o.push({ key: s.line + '.' + s.op + '.' + e, line: s.line, op: s.op, e }); }));
        return o;
    };
    const nOps = so.ops.length;
    const at = (segs, o) => segs[o.line * nOps + o.op][o.e];   // morphTile() lists every line, then every operation
    let seamPoints = 0, unmatched = 0, baselineWorst = 0, maxDrift = 0, maxMove = 0;
    const pairs = neighbourPairs(world);
    for (const p of pairs) {
        const eA = ends(mixed[p.a], p.v, p.w), eB = ends(mixed[p.b], p.v, p.w);
        const used = new Set();
        for (const oa of eA) {
            const pa = at(mixed[p.a], oa);
            let best = null, bd = Infinity;
            eB.forEach((ob, j) => { if (used.has(j)) return; const d = Math.hypot(pa.x - at(mixed[p.b], ob).x, pa.y - at(mixed[p.b], ob).y); if (d < bd) { bd = d; best = j; } });
            if (best === null || bd > 1e-9) { unmatched++; continue; }
            used.add(best);
            const ob = eB[best];
            seamPoints++;
            corner.forEach((cs) => { const a = at(cs[p.a], oa), b = at(cs[p.b], ob); baselineWorst = Math.max(baselineWorst, Math.hypot(a.x - b.x, a.y - b.y)); });
            const a = at(spatial[p.a], oa), b = at(spatial[p.b], ob);
            maxDrift = Math.max(maxDrift, Math.hypot(a.x - b.x, a.y - b.y));
            const k = at(corner[0][p.a], oa);
            maxMove = Math.max(maxMove, Math.hypot(a.x - k.x, a.y - k.y));   // how far the spatial morph moved this seam point from the pure K00 pattern: the measurement is not trivial
        }
        unmatched += eB.length - used.size;
    }
    return { tilePairs: pairs.length, seamPoints, unmatched, baselineWorst, maxDrift, maxMove };
}

module.exports = { makeWorld, symOps, toWorld, makeSpan, morphTile, rng, neighbourPairs, buildClosedCorners, measureSeams, distToSegment, tileWorldPoly };
