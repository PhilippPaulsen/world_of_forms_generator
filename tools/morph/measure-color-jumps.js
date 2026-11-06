// Measurement (not a test: the glob tools/*/test-*.js does not pick it up; test-spatial-morph-color.js uses measureJumps()): how much does the FILL COLOUR of a morph face jump between neighbouring
// values of the progress p, next to how far the line endpoints move in the same step. Per tile the faces of step k are matched to the faces of step k - 1 (nearest area centroid whose polygon contains the
// other's centroid, area ratio within 0.5 .. 2; a face without such a partner is "not assignable"); jump = largest channel difference of the two fills (sRGB bytes).
//   node tools/morph/measure-color-jumps.js [--step 0.02] [--pairs dense-8,dense-12,dense-16,coloured] [--modes linear,radial]
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
const M = require(path.join(ROOT, 'core', 'spatial-morph.js'));   // (the real file; SPATIAL_MORPH_JS only changes the world's copy)
const J = JSON.stringify;

const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function randConns(r, n, N) { const out = [], seen = new Set(); let g = 0; while (out.length < n && g++ < 1000) { const a = 1 + Math.floor(r() * N * N), b = 1 + Math.floor(r() * N * N); if (a === b || seen.has(a + ',' + b) || seen.has(b + ',' + a)) continue; seen.add(a + ',' + b); out.push([a, b]); } return out; }

// the pairs: three DENSE pairs (square, order 4, 8 / 12 / 16 random lines per keyframe, fixed seeds: the pairs of the 006a3 coverage measurement) and one COLOURED pair (order 3, no symmetry, every face of both keyframes has its own hue)
const K0 = [[1, 5], [2, 8], [3, 7], [4, 6], [1, 9]], K1 = [[1, 9], [2, 6], [4, 8], [5, 9], [3, 7]];
const PAIRS = {
  'dense-8': { N: 4, sym: 'rotation_reflection6', seed: 1, n: 8 }, 'dense-12': { N: 4, sym: 'rotation_reflection6', seed: 1, n: 12 }, 'dense-16': { N: 4, sym: 'rotation_reflection6', seed: 1, n: 16 },
  coloured: { N: 3, sym: 'none', k0: K0, k1: K1, colour: true },
};
const STUB = `
  var __polys = [], __cur = null, __fill = null, __tiles = [], __stack = [];
  push = () => { __stack.push(__fill); }; pop = () => { __fill = __stack.pop(); }; noStroke = () => { }; stroke = () => { }; noFill = () => { };
  fill = (c) => { __fill = c; }; beginShape = () => { __cur = []; }; vertex = (x, y) => { __cur.push([x, y]); };
  endShape = () => { __polys.push({ fill: __fill, pts: __cur }); __cur = null; }; var CLOSE = 'close';
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
  const k0 = sp.k0 || randConns(r, sp.n, sp.N), k1 = sp.k1 || randConns(r, sp.n, sp.N);
  const w = makeRenderWorld('square', sp.N, 3, sp.sym);
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
    w.set(`timeline.elapsedMs = ${p * 2000}; __polys.length = 0; __tiles.length = 0;`);
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
module.exports = { measureJumps, PAIRS };

if (require.main === module) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
  const step = +arg('--step', '0.02');
  const pairs = arg('--pairs', 'dense-8,dense-12,dense-16,coloured').split(','), modes = arg('--modes', 'linear,radial').split(',');
  console.log('pair | mode | faces | not assignable | faces with jump > 12 | largest jump | worst p | largest line-endpoint move (px) | at p | jumps where the tile did not move');
  for (const pair of pairs) for (const mode of modes) {
    const r = measureJumps(pair, mode, step);
    console.log([r.pair, r.mode, r.faces, (r.unmatchedShare * 100).toFixed(1) + ' %', r.over12, r.maxJump, r.worstP, r.maxLineMove, r.worstLineP, r.stillJumps + ' of ' + r.stillFaces].join(' | '));
  }
}
