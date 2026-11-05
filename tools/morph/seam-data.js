// Data set and metrics for the EDGE-CROSSING patterns of the spatial morph (morph stage d2; not a test: the glob tools/*/test-*.js does not pick it up). Used by test-spatial-morph-edges.js.
// The maintainer's correction: patterns whose lines stay inside one tile ("islands") cannot show a defect at the tile edge; what matters are patterns whose lines RUN ACROSS the outer polygon edge, so that
// after tiling every boundary endpoint continues in the neighbouring tile copy at the same world point. This file
//   - selects those from the 258 corpus patterns (tools/color/corpus.js) and builds hand-made ones (symmetry none, order 5) on the real lattices;
//   - builds the keyframe pairs: K0 = the pattern; K1 by (i) a CLOSED deformation (interior nodes moved, boundary nodes slid along their edge in step with their partners across the tile edges and across
//     the symmetry copies, so K1 is itself a seamless pattern), (ii) an EDGE CHANGE (one boundary node moved onto another edge or a corner), (iii) a node LEAVING the edge plus an interior node moving ONTO it,
//     (iv) another pattern of the same shape, order, symmetry mode and line count; with 2 and with 3 keyframes;
//   - measures on the REAL drawn segments (the segment collector, as in stage c): M1 seam continuity (endpoint pairs from different tile copies that coincide in the earlier keyframe's normal frame: do they
//     still coincide in the morph frame?), M1c the same restricted to the pairs that ALSO coincide in the later keyframe's own normal frame (a pair the keyframe itself separates cannot be asked to stay
//     together), M2 / M2c the same for pairs inside one tile copy (a node shared by lines, or by symmetry copies), M3 the morph frame at p = 0 / 1 against the normal frame of the keyframe, call for call.
'use strict';
const path = require('path');
const { makeRenderWorld } = require('./render-harness.js');
const M = require(process.env.SPATIAL_MORPH_JS || path.join(__dirname, '..', '..', 'core', 'spatial-morph.js'));

const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mulv = (T, p) => ({ x: T.a * p.x + T.c * p.y + T.e, y: T.b * p.x + T.d * p.y + T.f });
const inv = (T) => { const det = T.a * T.d - T.b * T.c; const a = T.d / det, b = -T.b / det, c = -T.c / det, d = T.a / det; return { a, b, c, d, e: -(a * T.e + c * T.f), f: -(b * T.e + d * T.f) }; };
const MODES = [['linear', 0], ['linear', 45], ['linear', 90], ['radial', 0], ['bilinear', 0]];
const PS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];

// ---------- frames and pairs ----------
function endpoints(frame) { const o = []; frame.forEach((s, k) => { o.push({ x: s.x1, y: s.y1, k, e: 1 }, { x: s.x2, y: s.y2, k, e: 2 }); }); return o; }
// endpoint pairs that coincide (tol) in `frame`: 'cross' = from different tile copies, 'inside' = the same tile copy, different segments; tile = floor(segment index / segsPerTile)
function pairsOf(frame, segsPerTile, tol) {
    tol = tol || 1e-6;
    const pts = endpoints(frame), cell = new Map(), out = { pts, cross: [], inside: [] };
    pts.forEach((p, i) => {
        const cx = Math.floor(p.x / tol / 8), cy = Math.floor(p.y / tol / 8);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            const l = cell.get((cx + dx) + ',' + (cy + dy)); if (!l) continue;
            for (const j of l) { const q = pts[j]; if (q.k === p.k || dist(p, q) > tol) continue; (Math.floor(q.k / segsPerTile) !== Math.floor(p.k / segsPerTile) ? out.cross : out.inside).push([j, i]); }
        }
        const kk = cx + ',' + cy; if (cell.has(kk)) cell.get(kk).push(i); else cell.set(kk, [i]);
    });
    return out;
}
const posIn = (P, frame, i) => { const m = P.pts[i], s = frame[m.k]; return m.e === 1 ? { x: s.x1, y: s.y1 } : { x: s.x2, y: s.y2 }; };
// the pairs of `list` whose members coincide (<= 1e-6) in every one of `frames`
const coincident = (P, list, frames) => list.filter(([a, b]) => frames.every((f) => dist(posIn(P, f, a), posIn(P, f, b)) <= 1e-6));
function gaps(P, frame, list) {
    let broken = 0, worst = 0;
    for (const [a, b] of list) { const d = dist(posIn(P, frame, a), posIn(P, frame, b)); if (d > 1e-6) broken++; if (d > worst) worst = d; }
    return { n: list.length, broken, worst };
}
const maxdiff = (A, B) => { if (A.length !== B.length) return Infinity; let m = 0; for (let k = 0; k < A.length; k++) for (const e of ['x1', 'y1', 'x2', 'y2']) m = Math.max(m, Math.abs(A[k][e] - B[k][e])); return m; };
const at = (w, p, seg) => { w.set(`timeline.elapsedMs = ${((seg || 0) + p) * 2000};`); return w.frame(); };
// the NORMAL frame of one keyframe layer drawn alone (layer enabled, base empty, morph off), then everything restored
function layerNormal(w, id) {
    w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 });
    const keep = w.get('connections'); w.baseConnections([]);
    w.set(`additionalLayers[${id}].enabled = true;`); const f = w.frame(); w.set(`additionalLayers[${id}].enabled = false;`);
    w.baseConnections(keep); return f;
}

// ---------- the context of a pattern: lattice, tiles, transforms ----------
function transformsOf(w) {   // the affine map canonical cell -> world of every (tile, op), read from the real render functions
    const raw = w.run(`(function () { const tiles = spatialMorphRenderRecordTiles(); const sym = spatialMorphSymmetryOps(currentShape, symmetryMode);
        return tiles.map((tile) => { const axisDir = sym.hasReflection ? (tile.axis || mirrorAxisDir()) : null; return sym.ops.map((op) => [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }].map((p) => spatialMorphRenderToWorld(p, tile, op, axisDir))); }); })()`);
    return raw.map((ops) => ops.map(([o, ex, ey]) => ({ a: ex.x - o.x, b: ex.y - o.y, c: ey.x - o.x, d: ey.y - o.y, e: o.x, f: o.y })));
}
function context(shape, order, size, sym, conns) {
    const w = makeRenderWorld(shape, order, size, sym);
    w.baseConnections(conns);
    const poly = w.get('outerCorners'), nodes = w.get('nodes'), centroid = w.get('centroid'), byId = new Map(nodes.map((n) => [n.id, n]));
    const tiles = w.get('spatialMorphRenderRecordTiles()');
    const ops = w.run('spatialMorphSymmetryOps(currentShape, symmetryMode).ops.length');
    const Ts = transformsOf(w);
    const f0 = w.frame(), spt = f0.length / tiles.length;
    const polys = tiles.map((t) => w.get(`outerCorners.map(p => toTileLocal(p, ${JSON.stringify(t.c)}, ${t.flip}, ${t.rot}))`));
    const Rr = Math.max(...poly.map((p) => dist(p, centroid)));
    const nbr = tiles.map(() => new Set());
    for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
        if (dist(tiles[i].c, tiles[j].c) > 2 * Rr + 1e-6) continue;
        const s2 = polys[i].filter((p) => polys[j].some((q) => dist(p, q) < 1e-6));
        if (s2.length === 2) { nbr[i].add(j); nbr[j].add(i); }
    }
    const inner = tiles.map((_, i) => nbr[i].size === poly.length);   // a tile whose every edge is shared with a listed tile
    return { shape, order, size, sym, conns, w, poly, nodes, centroid, byId, tiles, ops, Ts, f0, spt, polys, inner };
}
const posOf = (c, id) => { const n = c.byId.get(id); return { x: n.x, y: n.y }; };

// ---------- qualification: >= 4 canonical endpoints on the outer edge (1 px) and a partner for every boundary endpoint of an inner tile copy ----------
function qualify(c) {
    let nb = 0; c.conns.forEach((cn) => cn.forEach((id) => { if (M.spatialMorphOnEdge(posOf(c, id), c.poly, 1)) nb++; }));
    if (nb < 4) return { qualifies: false, nb, need: 0, ok: 0 };
    const P = pairsOf(c.f0, c.spt, 1e-6), has = new Set(); P.cross.forEach(([a, b]) => { has.add(a); has.add(b); });
    let need = 0, ok = 0;
    P.pts.forEach((p, i) => { const t = Math.floor(p.k / c.spt); if (!c.inner[t]) return; if (!M.spatialMorphOnEdge({ x: p.x, y: p.y }, c.polys[t], 1e-6)) return; need++; if (has.has(i)) ok++; });
    return { qualifies: need > 0 && ok === need, nb, need, ok };
}
// the 258 corpus patterns (tools/color/corpus.js: orbit representatives of 10 shape x order x symmetry configs) that qualify: [{ shape, order, mode, conns, key, index }]
function corpusQualifying() {
    const C = require('../color/corpus.js'), out = [];
    C.buildPatterns().forEach((pt, index) => {
        const conns = pt.ids.map((i) => pt.sh.reps[i].slice());
        const c = context(pt.sh.shape, pt.sh.order, 3, pt.sh.mode, conns);
        const q = qualify(c);
        out.push({ shape: pt.sh.shape, order: pt.sh.order, size: 3, mode: pt.sh.mode, conns, key: [pt.sh.shape, pt.sh.order, pt.sh.mode].join('/'), index, nb: q.nb, qualifies: q.qualifies });
    });
    return out;
}

// ---------- hand-built edge-crossing patterns (symmetry none) ----------
function partnerClasses(c) {   // boundary lattice ids grouped by the world point they share with a neighbouring tile (ops = 1)
    const ids = c.nodes.filter((n) => M.spatialMorphOnEdge({ x: n.x, y: n.y }, c.poly, 1e-6)).map((n) => n.id);
    const parent = new Map(ids.map((id) => [id, id])); const find = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x; };
    const reps = [false, true].map((f) => c.tiles.map((t, i) => i).filter((i) => c.inner[i] && c.tiles[i].flip === f)[0]).filter((x) => x !== undefined);
    const Rr = Math.max(...c.poly.map((p) => dist(p, c.centroid)));
    for (const ta of reps) for (let tb = 0; tb < c.tiles.length; tb++) {
        if (tb === ta || dist(c.tiles[ta].c, c.tiles[tb].c) > 2.2 * Rr) continue;
        for (const u of ids) { const Wu = mulv(c.Ts[ta][0], posOf(c, u)); for (const v of ids) if (dist(Wu, mulv(c.Ts[tb][0], posOf(c, v))) < 1e-6) parent.set(find(u), find(v)); }
    }
    const cls = new Map(); ids.forEach((id) => { const r = find(id); if (!cls.has(r)) cls.set(r, []); cls.get(r).push(id); });
    return [...cls.values()];
}
function handBuilt(shape, order, size, seed, wantLines) {
    const base = context(shape, order, size, 'none', []);
    const r = rng(seed), classes = partnerClasses(base);
    const interior = base.nodes.filter((n) => !M.spatialMorphOnEdge({ x: n.x, y: n.y }, base.poly, 1e-6)).map((n) => n.id);
    for (let attempt = 0; attempt < 200; attempt++) {
        const pick = [], cl = classes.map((x, i) => i).sort(() => r() - 0.5).slice(0, 2 + Math.floor(r() * 3));
        cl.forEach((i) => pick.push(...classes[i]));
        const conns = [], seen = new Set();
        const add = (a, b) => { if (a === b) return; const k = a < b ? a + '-' + b : b + '-' + a; if (!seen.has(k)) { seen.add(k); conns.push([a, b]); } };
        pick.forEach((u) => add(u, interior[Math.floor(r() * interior.length)]));
        for (let k = 0; k < 2 + Math.floor(r() * 3); k++) add(interior[Math.floor(r() * interior.length)], interior[Math.floor(r() * interior.length)]);
        if (wantLines && conns.length !== wantLines) continue;
        const c = context(shape, order, size, 'none', conns);
        const q = qualify(c);
        if (q.qualifies) return { shape, order, size, mode: 'none', conns, nb: q.nb };
    }
    return null;
}

// ---------- K1 builders ----------
function pointInPoly(p, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside; } return inside; }
// (i) a CLOSED deformation: interior nodes moved, boundary nodes slid along their edge, corners fixed, and every coincidence of the K0 normal frame (across tile edges, inside a tile, through the symmetry
// copies) kept: alternating projection on the world images of the coincident endpoints of one representative inner tile per flip class (the tiling is periodic). -> { Q: Map id -> position, kind, valid, ... }
function deformClosed(c, seed, amp) {
    const r = rng(seed), ids = [...new Set([].concat(...c.conns))];
    const P = new Map(ids.map((id) => [id, posOf(c, id)])), kind = new Map();
    for (const id of ids) {
        const p = P.get(id), on = M.spatialMorphOnEdge(p, c.poly, 1e-6);
        if (!on) { kind.set(id, { t: 'in' }); continue; }
        const v = c.poly[on.edge], w2 = c.poly[(on.edge + 1) % c.poly.length], len = dist(v, w2);
        const corner = dist(p, v) < 1e-6 || dist(p, w2) < 1e-6;
        kind.set(id, corner ? { t: 'corner' } : { t: 'edge', dir: { x: (w2.x - v.x) / len, y: (w2.y - v.y) / len }, v, w: w2, len });
    }
    const spacing = amp || 0.25 * dist(c.poly[0], c.poly[1]) / c.order, Q = new Map();
    for (const id of ids) {
        const k = kind.get(id), p = P.get(id);
        if (k.t === 'corner') Q.set(id, { ...p });
        else if (k.t === 'edge') { const s = (r() * 2 - 1) * Math.min(spacing * 1.5, 0.35 * k.len); Q.set(id, { x: p.x + k.dir.x * s, y: p.y + k.dir.y * s }); }
        else Q.set(id, { x: p.x + (r() * 2 - 1) * spacing * 1.5, y: p.y + (r() * 2 - 1) * spacing * 1.5 });
    }
    const P0 = pairsOf(c.f0, c.spt, 1e-6), rel = [];
    const reps = new Set();
    for (const f of [false, true]) { const cand = c.tiles.map((t, i) => i).filter((i) => c.inner[i] && c.tiles[i].flip === f).sort((p, q) => dist(c.tiles[p].c, c.centroid) - dist(c.tiles[q].c, c.centroid)); if (cand.length) reps.add(cand[0]); }
    const meta = (i) => { const m = P0.pts[i], t = Math.floor(m.k / c.spt), j = m.k - t * c.spt, line = Math.floor(j / c.ops); return { t, op: j - line * c.ops, id: c.conns[line][m.e - 1] }; };
    for (const [i, j] of P0.cross.concat(P0.inside)) {
        if (!reps.has(Math.floor(P0.pts[i].k / c.spt)) && !reps.has(Math.floor(P0.pts[j].k / c.spt))) continue;
        const a = meta(i), b = meta(j); rel.push({ a, b, Ta: c.Ts[a.t][a.op], Tb: c.Ts[b.t][b.op], Tai: inv(c.Ts[a.t][a.op]), Tbi: inv(c.Ts[b.t][b.op]) });
    }
    let res = Infinity, it = 0;
    for (; it < 4000 && res > 1e-13; it++) {
        for (const q of rel) { const Wa = mulv(q.Ta, Q.get(q.a.id)), Wb = mulv(q.Tb, Q.get(q.b.id)), mid = { x: (Wa.x + Wb.x) / 2, y: (Wa.y + Wb.y) / 2 }; Q.set(q.a.id, mulv(q.Tai, mid)); Q.set(q.b.id, mulv(q.Tbi, mid)); }
        for (const id of ids) { const k = kind.get(id), p = P.get(id), q = Q.get(id); if (k.t === 'corner') Q.set(id, { ...p }); else if (k.t === 'edge') { const s = (q.x - p.x) * k.dir.x + (q.y - p.y) * k.dir.y; Q.set(id, { x: p.x + k.dir.x * s, y: p.y + k.dir.y * s }); } }
        res = 0; for (const q of rel) res = Math.max(res, dist(mulv(q.Ta, Q.get(q.a.id)), mulv(q.Tb, Q.get(q.b.id))));
    }
    let valid = res <= 1e-9;
    for (const id of ids) { const k = kind.get(id), q = Q.get(id); if (k.t === 'edge') { const tau = ((q.x - k.v.x) * k.dir.x + (q.y - k.v.y) * k.dir.y) / k.len; if (tau < 0.03 || tau > 0.97) valid = false; } else if (k.t === 'in' && !pointInPoly(q, c.poly)) valid = false; }
    let moved = 0; for (const id of ids) if (dist(Q.get(id), P.get(id)) > 1e-6) moved++;
    return { Q, kind, valid, residual: res, iterations: it, moved, nodes: ids.length, edgeNodes: ids.filter((id) => kind.get(id).t === 'edge').length };
}
// (ii) one boundary node moves onto ANOTHER edge or a corner; (iii) one boundary node leaves the edge (interior) and one interior node moves ONTO an edge. K1 is then not closed (the partner cannot follow).
function editEdge(c, base, seed, which) {
    const r = rng(seed), Q = new Map(base.Q), ids = [...Q.keys()];
    const edgeIds = ids.filter((id) => base.kind.get(id).t === 'edge'), inIds = ids.filter((id) => base.kind.get(id).t === 'in');
    const onEdge = (e, tau) => { const v = c.poly[e], w2 = c.poly[(e + 1) % c.poly.length]; return { x: v.x + tau * (w2.x - v.x), y: v.y + tau * (w2.y - v.y) }; };
    if (!edgeIds.length) return null;
    const u = edgeIds[Math.floor(r() * edgeIds.length)], info = {};
    if (which === 'ii') {
        const own = M.spatialMorphOnEdge(posOf(c, u), c.poly, 1e-6).edge, e2 = (own + 1 + Math.floor(r() * (c.poly.length - 1))) % c.poly.length;
        const toCorner = r() < 0.5; Q.set(u, toCorner ? { ...c.poly[e2] } : onEdge(e2, 0.3 + 0.4 * r())); info.node = u; info.toCorner = toCorner;
    } else {
        const p = posOf(c, u); Q.set(u, { x: p.x + 0.35 * (c.centroid.x - p.x), y: p.y + 0.35 * (c.centroid.y - p.y) }); info.leaving = u;
        if (inIds.length) { const v = inIds[Math.floor(r() * inIds.length)]; Q.set(v, onEdge(Math.floor(r() * c.poly.length), 0.3 + 0.4 * r())); info.arriving = v; }
    }
    return { Q, info };
}
// a keyframe layer from coordinates (custom nodes, one pair per line)
function addCoordLayer(w, lines) {
    const nodes = [], conns = []; lines.forEach((l, i) => { nodes.push({ id: 2 * i + 1, x: l.x1, y: l.y1 }, { id: 2 * i + 2, x: l.x2, y: l.y2 }); conns.push([2 * i + 1, 2 * i + 2]); });
    const id = w.addKeyframeLayer(conns); w.set(`additionalLayers[${id}].nodes = ${JSON.stringify(nodes)};`); return id;
}
const linesOf = (conns, Q) => conns.map(([a, b]) => ({ x1: Q.get(a).x, y1: Q.get(a).y, x2: Q.get(b).x, y2: Q.get(b).y }));

// ---------- one case: pattern x K1 builder x number of keyframes ----------
// pat = { shape, order, size, mode, conns, other?, other2? } (other / other2: patterns of the same kind for case iv). -> { w, ids, c } | { skip }
function buildCase(pat, kcase, seeds, nk) {
    const c = context(pat.shape, pat.order, pat.size || 3, pat.mode, pat.conns);
    const d1 = deformClosed(c, seeds[0]); if (!d1.valid) return { skip: 'deformation not closed (residual ' + d1.residual + ')' };
    let K1;
    if (kcase === 'i') K1 = { lines: linesOf(pat.conns, d1.Q) };
    else if (kcase === 'ii' || kcase === 'iii') { const e = editEdge(c, d1, seeds[0] + 100, kcase); if (!e) return { skip: 'no boundary node to edit' }; K1 = { lines: linesOf(pat.conns, e.Q), info: e.info }; }
    else { if (!pat.other) return { skip: 'no second pattern' }; K1 = { conns: pat.other.conns }; }
    let K2 = null;
    if (nk === 3) { if (kcase === 'iv') { if (!pat.other2) return { skip: 'no third pattern' }; K2 = { conns: pat.other2.conns }; } else { const d2 = deformClosed(c, seeds[1]); if (!d2.valid) return { skip: 'K2 not closed' }; K2 = { lines: linesOf(pat.conns, d2.Q) }; } }
    const w = makeRenderWorld(pat.shape, pat.order, pat.size || 3, pat.mode); w.baseConnections(pat.conns);
    const mk = (k) => (k.conns ? w.addKeyframeLayer(k.conns) : addCoordLayer(w, k.lines));
    const ids = [w.addKeyframeLayer(pat.conns), mk(K1)].concat(K2 ? [mk(K2)] : []);
    w.setTimeline(ids);
    return { w, ids, c, info: K1.info };
}
// The endpoint invariants of the boundary rule (stage d2b, kept by stage d2c), on the aligned corners of every segment of a case: for every endpoint the displacement between w = 0 and w = 1e-6 and between w = 1 - 1e-6 and w = 1
// as the render draws it (exactEnds false: jumpLow / jumpHigh) and with exact ends (jumpExactLow / jumpExactHigh: what the front path did until stage d2c, where w = 0 / 1 are the keyframes' own positions: the
// reason they are off), and for every line the length at w = 0.01 against the shorter of its two keyframe lines.
// -> { endpoints, jumpLow, jumpHigh, jumpExactLow, jumpExactHigh, lines, minRatio, below90, below90NotLinear }
function endpointInvariants(w, nk) {
    const out = { endpoints: 0, jumpLow: 0, jumpHigh: 0, jumpExactLow: 0, jumpExactHigh: 0, lines: 0, minRatio: Infinity, below90: 0, below90NotLinear: 0 };
    const W = (x) => ({ w00: 1 - x, w10: x, w01: 0, w11: 0 }), len = (l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
    for (let seg = 0; seg < nk - 1; seg++) {
        const r = w.run(`(function () { const r = resolveTimelineKeyframeCoords(timeline, ${seg}); return { from: r.from, to: r.to }; })()`), poly = w.get('outerCorners');
        const prep = M.spatialMorphPrepareLines(M.spatialMorphChooseCorners([r.from, r.to], 'linear'), poly);
        const at = (d, x, exact) => { const x2 = x === 0 || x === 1 ? x : x; const wt = W(x2); return M.spatialMorphAnchoredPoint(d, wt, wt, exact); };
        prep.forEach((pl, i) => {
            for (const e of ['a', 'b']) for (const exact of [false, true]) {
                const d = pl[e]; out.endpoints++;
                const lo = dist(at(d, 0, exact), at(d, 1e-6, exact)), hi = dist(at(d, 1 - 1e-6, exact), at(d, 1, exact));
                if (exact) { out.jumpExactLow = Math.max(out.jumpExactLow, lo); out.jumpExactHigh = Math.max(out.jumpExactHigh, hi); }
                else { out.jumpLow = Math.max(out.jumpLow, lo); out.jumpHigh = Math.max(out.jumpHigh, hi); }
            }
            const wt = W(0.01), line = M.spatialMorphAnchoredLine(pl, wt, wt, wt), shorter = Math.min(len(r.from[i]), len(r.to[i]));
            out.lines++;
            if (shorter > 0) {
                const ratio = len(line) / shorter, a = r.from[i], b = r.to[i];
                const lin = Math.hypot((a.x2 + 0.01 * (b.x2 - a.x2)) - (a.x1 + 0.01 * (b.x1 - a.x1)), (a.y2 + 0.01 * (b.y2 - a.y2)) - (a.y1 + 0.01 * (b.y1 - a.y1)));   // the plain linear blend of the two keyframe lines
                out.minRatio = Math.min(out.minRatio, ratio);
                if (ratio < 0.9) { out.below90++; if (Math.abs(len(line) - lin) > 1e-6) out.below90NotLinear++; }   // a line that is short because the plain linear blend of its two keyframes is short is not the rule's doing
            }
        });
    }
    return out;
}
// M1 / M1c / M2 / M2c / M3 over modes and progress values. rows: { mode, seg, p, m1, m1c, m2, m2c: [broken, n, worst], m3? }
function runCase(pat, kcase, nk, seeds, modes, ps) {
    const b = buildCase(pat, kcase, seeds, nk); if (b.skip) return { skip: b.skip };
    const { w, ids, c } = b, normals = ids.map((id) => layerNormal(w, id)), rows = [];
    const inv = endpointInvariants(w, nk);
    for (const [mode, ang] of (modes || MODES)) {
        w.setMorph({ enabled: true, mode, angleDeg: ang });
        const segs = mode === 'bilinear' ? [null] : (nk === 3 ? [0, 1] : [0]);
        for (const seg of segs) {
            const keyN = mode === 'bilinear' ? normals : [normals[seg], normals[seg + 1]];
            const P = pairsOf(keyN[0], c.spt, 1e-6), closedX = coincident(P, P.cross, keyN), closedI = coincident(P, P.inside, keyN);
            for (const p of (mode === 'bilinear' ? [0] : (ps || PS))) {
                const f = mode === 'bilinear' ? at(w, 0, 0) : at(w, p, seg);
                const g = (list) => { const x = gaps(P, f, list); return [x.broken, x.n, x.worst]; };
                const r = { mode: mode + (mode === 'linear' ? ang : ''), seg, p, m1: g(P.cross), m1c: g(closedX), m2: g(P.inside), m2c: g(closedI) };
                if (mode !== 'bilinear' && (p === 0 || p === 1)) r.m3 = maxdiff(f, normals[seg + (p === 1 ? 1 : 0)]);
                rows.push(r);
            }
        }
    }
    return { rows, inv };
}
// The INDEPENDENT oracle of the seam-open check (stage e1): the keyframe layer drawn alone as a normal frame (the real drawn segments), its boundary endpoints of inner tiles looked up for a partner of another
// tile copy at the same world point. A layer that has the base sheet's size and symmetry mode (the tile list is the base's). -> { open, need, ok }
function frameSeamOpen(w, id) {
    const f = layerNormal(w, id);
    const poly = w.get('outerCorners'), centroid = w.get('centroid'), tiles = w.get('spatialMorphRenderRecordTiles()');
    const polys = tiles.map((t) => w.get(`outerCorners.map(p => toTileLocal(p, ${JSON.stringify(t.c)}, ${t.flip}, ${t.rot}))`));
    const Rr = Math.max(...poly.map((p) => dist(p, centroid))), nbr = tiles.map(() => new Set());
    for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
        if (dist(tiles[i].c, tiles[j].c) > 2 * Rr + 1e-6) continue;
        if (polys[i].filter((p) => polys[j].some((q) => dist(p, q) < 1e-6)).length === 2) { nbr[i].add(j); nbr[j].add(i); }
    }
    const spt = f.length / tiles.length, P = pairsOf(f, spt, 1e-6), has = new Set();
    P.cross.forEach(([a, b]) => { has.add(a); has.add(b); });
    let need = 0, ok = 0;
    P.pts.forEach((p, i) => { const t = Math.floor(p.k / spt); if (nbr[t].size !== poly.length) return; if (!M.spatialMorphOnEdge({ x: p.x, y: p.y }, polys[t], 1e-6)) return; need++; if (has.has(i)) ok++; });
    return { open: ok !== need, need, ok };
}
module.exports = { frameSeamOpen, endpointInvariants, M, makeRenderWorld, rng, dist, MODES, PS, pairsOf, coincident, gaps, maxdiff, at, layerNormal, context, qualify, corpusQualifying, handBuilt, partnerClasses, deformClosed, editEdge, addCoordLayer, linesOf, buildCase, runCase, posOf };
