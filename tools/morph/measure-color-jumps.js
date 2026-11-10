// Measurement (not a test: the glob tools/*/test-*.js does not pick it up; test-spatial-morph-color.js uses measureJumps()): how much does the FILL COLOUR of a morph face jump between neighbouring
// values of the progress p, next to how far the line endpoints move in the same step. Per tile the faces of step k are matched to the faces of step k - 1 (nearest area centroid whose polygon contains the
// other's centroid, area ratio within 0.5 .. 2; a face without such a partner is "not assignable"); jump = largest channel difference of the two fills (sRGB bytes).
// Task 013: the pairs exist for the three shapes (square: dense-8 / -12 / -16, coloured; hexagon: hex-dense-8 / -12 / -16, hex-coloured; triangle: tri-dense-6 / -9 / -12, tri-coloured), and the row also carries the
// COVERAGE of the cell by the morph's faces (sum of the face areas of a tile / the cell's area; 1 = no gap) and, for the worst tile, the same lines through the NORMAL image (coverageNormal).
//   node tools/morph/measure-color-jumps.js [--step 0.02] [--pairs dense-8,dense-12,dense-16,coloured] [--modes linear,radial]
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
const M = require(path.join(ROOT, 'core', 'spatial-morph.js'));   // (the real file; SPATIAL_MORPH_JS only changes the world's copy)
const J = JSON.stringify;

const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function randConns(r, n, ids) { const out = [], seen = new Set(); let g = 0; while (out.length < n && g++ < 1000) { const a = ids[Math.floor(r() * ids.length)], b = ids[Math.floor(r() * ids.length)]; if (a === b || seen.has(a + ',' + b) || seen.has(b + ',' + a)) continue; seen.add(a + ',' + b); out.push([a, b]); } return out; }

// the pairs: three DENSE pairs (square, order 4, 8 / 12 / 16 random lines per keyframe, fixed seeds: the pairs of the 006a3 coverage measurement) and one COLOURED pair (order 3, no symmetry, every face of both keyframes has its own hue)
const K0 = [[1, 5], [2, 8], [3, 7], [4, 6], [1, 9]], K1 = [[1, 9], [2, 6], [4, 8], [5, 9], [3, 7]];
const PAIRS = {
  'dense-8': { N: 4, sym: 'rotation_reflection6', seed: 1, n: 8 }, 'dense-12': { N: 4, sym: 'rotation_reflection6', seed: 1, n: 12 }, 'dense-16': { N: 4, sym: 'rotation_reflection6', seed: 1, n: 16 },
  coloured: { N: 3, sym: 'none', k0: K0, k1: K1, colour: true },
  // hexagon (order 3: 37 nodes) and triangle (order 5: 15 nodes): the dense pairs of the same kind, the coloured pairs on a few lines without symmetry
  'hex-dense-8': { shape: 'hex', N: 3, sym: 'rotation_reflection6', seed: 1, n: 8 }, 'hex-dense-12': { shape: 'hex', N: 3, sym: 'rotation_reflection6', seed: 1, n: 12 }, 'hex-dense-16': { shape: 'hex', N: 3, sym: 'rotation_reflection6', seed: 1, n: 16 },
  'hex-typical': { shape: 'hex', N: 3, sym: 'rotation_reflection6', seed: 1, n: 5 },   // the frame-time scene: 5 lines like the data pairs
  'hex-coloured': { shape: 'hex', N: 2, sym: 'none', k0: [[1, 10], [3, 14], [5, 17], [2, 12]], k1: [[2, 11], [4, 15], [6, 18], [7, 13]], colour: true },
  'tri-dense-6': { shape: 'triangle', N: 5, sym: 'rotation_reflection3', seed: 1, n: 6 }, 'tri-dense-9': { shape: 'triangle', N: 5, sym: 'rotation_reflection3', seed: 1, n: 9 }, 'tri-dense-12': { shape: 'triangle', N: 5, sym: 'rotation_reflection3', seed: 1, n: 12 },
  'tri-typical': { shape: 'triangle', N: 5, sym: 'rotation_reflection3', seed: 1, n: 5 },
  'tri-coloured': { shape: 'triangle', N: 4, sym: 'none', k0: [[1, 5], [2, 9], [3, 8]], k1: [[1, 9], [4, 6], [7, 10]], colour: true },
};
const STUB = `
  var __polys = [], __cur = null, __fill = null, __tiles = [], __stack = [];
  push = () => { __stack.push(__fill); }; pop = () => { __fill = __stack.pop(); }; noStroke = () => { }; stroke = () => { }; noFill = () => { };
  fill = (c) => { __fill = c; }; beginShape = () => { __cur = []; }; vertex = (x, y) => { __cur.push([x, y]); };
  endShape = () => { __polys.push({ fill: __fill, pts: __cur }); __cur = null; }; var CLOSE = 'close';
  var __lines = [];
  { const cap = (lines) => { __lines.push(lines.map((l) => [{ x: l[0].x, y: l[0].y }, { x: l[1].x, y: l[1].y }])); };
    if (typeof spatialMorphRenderTileMemo === 'function') { const mk = spatialMorphRenderTileMemo; spatialMorphRenderTileMemo = function () { const m = mk.apply(this, arguments), f = m.faces; m.faces = function (lines) { cap(lines); return f.apply(this, arguments); }; return m; }; }   // task 038: ONE capture per tile, as before the frame memo (the memo's hits do not reach spatialMorphRenderTileFaces)
    else { const tf = spatialMorphRenderTileFaces; spatialMorphRenderTileFaces = function (lines) { cap(lines); return tf.apply(this, arguments); }; } }
  { const f = spatialMorphRenderFillFaces; spatialMorphRenderFillFaces = function () { const a = __polys.length; const r = f.apply(this, arguments); __tiles.push({ a, b: __polys.length }); return r; }; }
`;
const COLOR = (layer, hue0) => `(function () {
  const L = additionalLayers[${layer}], sh = faceSheetOverrideOfLayer(L);
  const border = sh.outerCorners.map((p, k) => ({ id: -1000001 - k, x: p.x, y: p.y, free: true }));
  const conns = L.connections.map((c) => c.slice()); border.forEach((n, k) => conns.push([n.id, border[(k + 1) % border.length].id]));
  const res = computeCellFaces(conns, L.nodes.concat(border), null, null, sh);
  const keys = computeFaceTrailKeys(res, sheetGroupElements(L.nodes, sh));
  L.faceAssignments = new Map();
  keys.forEach((k, i) => { if (k) setFaceAssignment(L.faceAssignments, k, { hue: (${hue0} + i) % 24, w: 0.2, s: 0.3, rule: 'test', params: null }); });
})()`;
function build(name, mode) {
  const sp = PAIRS[name];
  const r = rng(sp.seed ? sp.seed * 7919 + sp.n : 1);
  const w = makeRenderWorld(sp.shape || 'square', sp.N, 3, sp.sym);
  const nodeIds = w.get('nodes.filter((n) => !n.free).map((n) => n.id)');
  const k0 = sp.k0 || randConns(r, sp.n, nodeIds), k1 = sp.k1 || randConns(r, sp.n, nodeIds);
  w.set(STUB); w.baseConnections(sp.k0 ? sp.k0 : []);
  const ids = [k0, k1].map((k) => w.addKeyframeLayer(k));
  ids.forEach((i) => w.set(`additionalLayers[${i}].showFaces = true;`));
  if (sp.colour) ids.forEach((i, n) => w.run(COLOR(i, n * 12)));
  w.setTimeline(ids); w.setMorph({ enabled: true, mode, angleDeg: 0 });
  return w;
}
const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const centroid = (pts) => { let x = 0, y = 0, a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], c = p[0] * q[1] - q[0] * p[1]; a += c; x += (p[0] + q[0]) * c; y += (p[1] + q[1]) * c; } return a ? [x / (3 * a), y / (3 * a)] : pts[0]; };
const inside = (pt, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { if ((pts[i][1] > pt[1]) !== (pts[j][1] > pt[1]) && pt[0] < (pts[j][0] - pts[i][0]) * (pt[1] - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) c = !c; } return c; };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const cdist = (a, b) => Math.max(...rgb(a).map((v, k) => Math.abs(v - rgb(b)[k])));
const prep = (poly) => { const pts = poly.pts, a = Math.abs(area(pts)); return { pts, a, c: centroid(pts), fill: poly.fill, samples: M.spatialMorphFaceSamples(pts.map((q) => ({ x: q[0], y: q[1] }))) }; };

// faces of one tile in two steps -> { jumps: [ { jump, ... } ], unmatched, total, still }  (still = the tile's polygons did not move at all between the steps)
function matchTile(prev, cur) {
  const P = prev.map(prep), C = cur.map(prep);
  const still = P.length === C.length && P.every((f, i) => f.pts.length === C[i].pts.length && f.pts.every((q, k) => Math.abs(q[0] - C[i].pts[k][0]) < 1e-9 && Math.abs(q[1] - C[i].pts[k][1]) < 1e-9));
  const jumps = []; let unmatched = 0;
  C.forEach((f) => {
    let best = null, bd = Infinity;
    P.forEach((g) => {
      if (f.a / g.a > 2 || f.a / g.a < 0.5) return;
      if (!inside(f.c, g.pts) && !inside(g.c, f.pts)) return;
      if (f.samples.reduce((a, q) => a + (inside([q.x, q.y], g.pts) ? q.w : 0), 0) < 0.5) return;   // overlap: half of the new face lies in the old one
      const d = Math.hypot(f.c[0] - g.c[0], f.c[1] - g.c[1]);
      if (d < bd) { bd = d; best = g; }
    });
    if (!best) { unmatched++; return; }
    jumps.push(cdist(f.fill, best.fill));
  });
  return { jumps, unmatched, total: C.length, still };
}

// pair x mode x p = 0 .. 1: { pair, mode, faces, matched, over12, maxJump, worstP, unmatchedShare, maxLineMove, stillJumps (jumps in tiles whose polygons did not move), steps }
function measureJumps(name, mode, step, opts) {
  opts = opts || {};
  const w = build(name, mode);
  if (opts.setup) w.set(opts.setup);   // code run in the world before the first step (the cause experiments)
  const n = Math.round(1 / step);
  let prevTiles = null, prevCalls = null;
  const row = { pair: name, mode, faces: 0, matched: 0, over12: 0, maxJump: 0, worstP: null, unmatched: 0, maxLineMove: 0, worstLineP: null, stillJumps: 0, stillFaces: 0, steps: n, tilesPerFrame: 0 };
  for (let k = 0; k <= n; k++) {
    const p = k / n;
    w.set(`timeline.elapsedMs = ${p * 2000}; __polys.length = 0; __tiles.length = 0; __lines.length = 0;`);
    const calls = w.drawn();
    const polys = w.get('__polys'), tiles = w.get('__tiles').map((t) => polys.slice(t.a, t.b));
    row.tilesPerFrame = tiles.length;
    if (prevTiles) {
      tiles.forEach((t, ti) => {
        if (!prevTiles[ti]) return;
        const m = matchTile(prevTiles[ti], t);
        row.faces += m.total; row.matched += m.jumps.length; row.unmatched += m.unmatched;
        m.jumps.forEach((j) => { if (j > 12) row.over12++; if (m.still) { row.stillFaces++; if (j > 2) row.stillJumps++; } if (j > row.maxJump) { row.maxJump = j; row.worstP = +p.toFixed(2); } });
      });
      for (let i = 0; i < Math.min(calls.length, prevCalls.length); i++) {
        const a = calls[i], b = prevCalls[i];
        if (a[0] !== b[0]) continue;
        for (let q = 1; q < Math.min(a.length, b.length); q++) if (typeof a[q] === 'number' && typeof b[q] === 'number') { const d = Math.abs(a[q] - b[q]); if (d > row.maxLineMove) { row.maxLineMove = d; row.worstLineP = +p.toFixed(2); } }
      }
    }
    prevTiles = tiles; prevCalls = calls;
    if (opts.onStep) opts.onStep(k, n);
  }
  row.unmatchedShare = row.faces ? +(row.unmatched / row.faces).toFixed(4) : 0;
  row.maxLineMove = +row.maxLineMove.toFixed(1);
  return row;
}

// COVERAGE: per tile the sum of the face areas / the area of the cell (1 = no gap), p = 0, 0.1 ... 1. The worst tile's lines are then run through the NORMAL path (computeCellFaces() on the same lines as ordinary
// base connections plus the border, nothing of the morph involved): the same coverage there means the gap is core/faces.js's (a known limit), not the morph's.
function measureCoverage(name, mode) {
  const w = build(name, mode);
  const cell = Math.abs(w.get('(function () { const c = outerCorners; let a = 0; for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; a += p.x * q.y - q.x * p.y; } return a / 2; })()'));
  const row = { pair: name, mode, tiles: 0, below: 0, min: 2, worstP: null, worstTile: null, over: 0, noFaces: 0 };
  let worst = null;
  for (let k = 0; k <= 10; k++) {
    const p = k / 10;
    w.set(`timeline.elapsedMs = ${p * 2000}; __polys.length = 0; __tiles.length = 0; __lines.length = 0;`);
    w.drawn();
    const polys = w.get('__polys'), tiles = w.get('__tiles'), lines = w.get('__lines');
    tiles.forEach((t, ti) => {
      const ps = polys.slice(t.a, t.b);
      row.tiles++;
      if (ps.length === 0) { row.noFaces++; return; }
      const c = ps.reduce((a, q) => a + Math.abs(area(q.pts)), 0) / cell;
      if (c < 0.999) row.below++;
      if (c > 1.001) row.over++;
      if (c < row.min) { row.min = c; row.worstP = p; row.worstTile = ti; worst = lines[ti]; }
    });
  }
  row.min = +row.min.toFixed(4);
  if (worst) {
    // the NORMAL path: the worst tile's lines as base connections (synthetic free nodes, the cell border as connections), computeCellFaces() with its defaults
    const sp = PAIRS[name];
    const n = makeRenderWorld(sp.shape || 'square', sp.N, 3, sp.sym);
    row.coverageNormal = n.run(`(function () {
      const lines = ${J(worst)}; const nn = nodes.slice(); const conns = [];
      lines.forEach((l, i) => { const a = { id: -1 - 2 * i, x: l[0].x, y: l[0].y, free: true }, b = { id: -2 - 2 * i, x: l[1].x, y: l[1].y, free: true }; nn.push(a, b); conns.push([a.id, b.id]); });
      const border = outerCorners.map((p, k) => ({ id: -1000001 - k, x: p.x, y: p.y, free: true })); border.forEach((b, k) => { nn.push(b); conns.push([b.id, border[(k + 1) % border.length].id]); });
      const res = computeCellFaces(conns, nn); const by = new Map(res.nodes.map((q) => [q.id, q]));
      let a = 0; res.faces.forEach((f) => { const pts = f.nodeIds.map((id) => by.get(id)); let s = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p.x * q.y - q.x * p.y; } a += Math.abs(s) / 2; });
      return a;
    })()`) / cell;
    row.coverageNormal = +row.coverageNormal.toFixed(4);
  }
  return row;
}
module.exports = { measureJumps, measureCoverage, build, PAIRS };

if (require.main === module) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
  const step = +arg('--step', '0.02');
  const pairs = arg('--pairs', 'dense-8,dense-12,dense-16,coloured').split(','), modes = arg('--modes', 'linear,radial').split(',');
  if (process.argv.includes('--coverage')) {
    console.log('pair | mode | tiles x 11 values of p | tiles below 0.999 | smallest coverage | at p | tile without faces | coverage of the same lines in the normal path');
    for (const pair of pairs) for (const mode of modes) { const r = measureCoverage(pair, mode); console.log([r.pair, r.mode, r.tiles, r.below, r.min, r.worstP, r.noFaces, r.coverageNormal].join(' | ')); }
    process.exit(0);
  }
  console.log('pair | mode | faces | not assignable | faces with jump > 12 | largest jump | worst p | largest line-endpoint move (px) | at p | jumps where the tile did not move');
  for (const pair of pairs) for (const mode of modes) {
    const r = measureJumps(pair, mode, step);
    console.log([r.pair, r.mode, r.faces, (r.unmatchedShare * 100).toFixed(1) + ' %', r.over12, r.maxJump, r.worstP, r.maxLineMove, r.worstLineP, r.stillJumps + ' of ' + r.stillFaces].join(' | '));
  }
}
