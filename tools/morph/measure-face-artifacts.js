// Task 094 (Typ R, nur messen): artefact detector for the FACES of the spatial morph and of the timeline animation.
//   node tools/morph/measure-face-artifacts.js run   [--variant base|rel|col|repair] [--shard i/n] [--seqs K] [--out file.json] [--only morph|anim]
//   node tools/morph/measure-face-artifacts.js sum   file.json ...           (aggregate: prints the tables of reports/094.md)
//   node tools/morph/measure-face-artifacts.js image  file.json N [outdir]   (PNG of the N worst frames, gaps red, overlaps blue)
//   node tools/morph/measure-face-artifacts.js one <cfgIndex> <net:none|field> <seed> <tIndex> [variant] [out.png]
// Everything runs on the REAL core files in a vm (tools/morph/render-harness.js, scene building as test-spatial-morph-faces.js). core/faces.js is only READ;
// the variants (FACE_EPSILON 0.05 / 0.5 / 2, and the prototype repairs 'rel' = relative epsilon, 'col' = collinear splitting + trig-free angle sort, 'repair' = both) are
// text patches of a COPY written to the OS temp dir and loaded through coreOverrides. Nothing in the repo is changed.
//   Checks per frame: (1) face count / blips, (2) coverage (area sum, raster gaps / overlaps), (3) invalid polygons, (4) continuity (centroid, colour), (5) 1e-9 px jitter, (6) FACE_EPSILON.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const W = 600, NT = 41, SEG_MS = 2000;

// ---------------------------------------------------------------------------------------------------- variants of core/faces.js (copies)
const FACES_SRC = fs.readFileSync(path.join(ROOT, 'core', 'faces.js'), 'utf8');
function patch(src, from, to) { if (!src.includes(from)) throw new Error('patch anchor missing: ' + from.slice(0, 60)); return src.replace(from, () => to); }
function variantSource(v) {
    let s = FACES_SRC;
    const eps = /^eps(.+)$/.exec(v);
    if (eps) return patch(s, 'const FACE_EPSILON = 0.5;', `const FACE_EPSILON = ${eps[1]};`);
    if (v === 'base') return s;
    if (v === 'old') return require('child_process').execSync('git show d693a1d9:core/faces.js', { cwd: ROOT, maxBuffer: 1 << 26 }).toString();   // task 095: core/faces.js of main before the repair
    if (v === 'rel' || v === 'repair') {
        // (1) FACE_EPSILON relative to the size of the geometry: 1e-3 of the bounding-box diagonal of the segments handed to findFaces() (0.5 px stays the floor for a 500 px diagonal)
        s = patch(s, 'const FACE_EPSILON = 0.5;', 'let FACE_EPSILON = 0.5;');
        s = patch(s, 'function findFaces(segments, realNodes) {\n', `function findFaces(segments, realNodes) {
    { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const g of segments) { x0 = Math.min(x0, g.x1, g.x2); x1 = Math.max(x1, g.x1, g.x2); y0 = Math.min(y0, g.y1, g.y2); y1 = Math.max(y1, g.y1, g.y2); }
      const diag = Math.hypot(x1 - x0, y1 - y0); if (diag > 0 && isFinite(diag)) FACE_EPSILON = Math.max(1e-9, 1e-3 * diag); }
`);
    }
    if (v === 'col' || v === 'repair') {
        // (2a) collinear / T-junction splitting with the shared tolerance: an endpoint that lies within FACE_EPSILON of ANOTHER segment's interior splits that segment there
        s = patch(s, `    const edgeMap = new Map();
    const edgeMeta = new Map();
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];`, `    for (let i = 0; i < segments.length; i++) {
        for (let j = 0; j < segments.length; j++) {
            if (i === j) continue;
            const a = segments[i], b = segments[j];
            const dx = a.x2 - a.x1, dy = a.y2 - a.y1, L2 = dx * dx + dy * dy; if (L2 < 1e-18) continue;
            for (const [px, py] of [[b.x1, b.y1], [b.x2, b.y2]]) {
                const t = ((px - a.x1) * dx + (py - a.y1) * dy) / L2;
                if (t <= 0 || t >= 1) continue;
                const qx = a.x1 + t * dx, qy = a.y1 + t * dy;
                if (Math.hypot(px - qx, py - qy) <= FACE_EPSILON) breaks[i].push(t);
            }
        }
    }
    const edgeMap = new Map();
    const edgeMeta = new Map();
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];`);
        // (2b) angle sort without trig: half-plane + cross product, ties (same direction) by distance
        s = patch(s, `        const angleAB = (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 360) % 360;
        const angleBA = (Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI + 360) % 360;
        adjacency[aId].push({ neighborId: bId, angleDeg: angleAB });
        adjacency[bId].push({ neighborId: aId, angleDeg: angleBA });
    });
    Object.keys(adjacency).forEach(id => adjacency[id].sort((x, y) => x.angleDeg - y.angleDeg));`, `        adjacency[aId].push({ neighborId: bId, dx: b.x - a.x, dy: b.y - a.y });
        adjacency[bId].push({ neighborId: aId, dx: a.x - b.x, dy: a.y - b.y });
    });
    const half = (e) => (e.dy > 0 || (e.dy === 0 && e.dx > 0)) ? 0 : 1;
    Object.keys(adjacency).forEach(id => adjacency[id].sort((x, y) => { const hx = half(x), hy = half(y); if (hx !== hy) return hx - hy; const c = x.dx * y.dy - x.dy * y.dx; if (c !== 0) return c > 0 ? -1 : 1; return Math.hypot(x.dx, x.dy) - Math.hypot(y.dx, y.dy); }));`);
    }
    return s;
}
const tmpFiles = {};
function variantFile(v) {
    if (v === 'base') return process.env.FACES_JS || undefined;   // task 095: FACES_JS = another copy of core/faces.js for the base variant (the old file, sabotage copies)
    if (!tmpFiles[v]) { const p = path.join(os.tmpdir(), `faces094-${process.pid}-${v}.js`); fs.writeFileSync(p, variantSource(v)); tmpFiles[v] = p; }
    return tmpFiles[v];
}
process.on('exit', () => { for (const p of Object.values(tmpFiles)) try { fs.unlinkSync(p); } catch (e) { } });

// ---------------------------------------------------------------------------------------------------- scene
const STUB = `
  var __polys = [], __cur = null, __style = { fill: null, stroke: 'S' }, __stack = [], __jit = 0, __seed = 1;
  push = () => { __stack.push(JSON.stringify(__style)); }; pop = () => { __style = JSON.parse(__stack.pop()); };
  noStroke = () => { __style.stroke = null; }; stroke = (c) => { __style.stroke = c; }; noFill = () => { __style.fill = null; };
  fill = (c) => { __style.fill = c; };
  beginShape = () => { __cur = []; }; vertex = (x, y) => { __cur.push([x, y]); };
  endShape = (m) => { __polys.push({ f: __style.fill, p: __cur }); __cur = null; };
  var CLOSE = 'close';
  const __rnd = () => { __seed = (__seed * 1664525 + 1013904223) >>> 0; return (__seed / 4294967296) * 2 - 1; };
  { const f = spatialMorphRenderTileFaces; if (typeof f === 'function') spatialMorphRenderTileFaces = function (lines, s, sheet) {
      if (__jit) lines = lines.map((ln) => ln.map((p) => ({ x: p.x + __rnd() * __jit, y: p.y + __rnd() * __jit })));
      return f.call(this, lines, s, sheet); }; }
`;
const NET_A = { x: { kind: 'trig', w: -0.8 }, y: 'same', repeat: false, domain: 'field' }, NET_B = { x: { kind: 'trig', w: -0.3 }, y: 'same', repeat: false, domain: 'field' };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function keyframes(ids, seed) {
    const r = rng(seed * 7919 + 17), K = [];
    for (let k = 0; k < 2; k++) {
        const n = 3 + Math.floor(r() * 3), set = new Set(), conns = [];
        let guard = 0;
        while (conns.length < n && guard++ < 200) { const a = ids[Math.floor(r() * ids.length)], b = ids[Math.floor(r() * ids.length)]; const key = Math.min(a, b) + '-' + Math.max(a, b); if (a === b || set.has(key)) continue; set.add(key); conns.push([a, b]); }
        K.push(conns);
    }
    return K;
}
// the matrix: 11 sheets per shape x two nets
const SHAPES = ['square', 'triangle', 'hex'];
const CONFIGS = [];
for (const shape of SHAPES) {
    for (const sym of ['none', 'rotation3', 'rotation6', 'rotation_reflection3', 'rotation_reflection6', 'reflection_only']) CONFIGS.push({ shape, order: 3, size: 3, sym });
    for (const order of [2, 4, 5]) CONFIGS.push({ shape, order, size: 3, sym: 'rotation_reflection6' });
    for (const size of [5, 7]) CONFIGS.push({ shape, order: 3, size, sym: 'none' });
    // a non-square area (X x Y = 7 x 5, size: [7, 5] is supported by build()) is NOT in the matrix: its keyframe layers give 'lineCountMismatch' without the app's own layer path (reports/094.md)
}
function build(cfg, net, seed, mode, variant, extraSeedFiles) {
    const files = variantFile(variant) ? { 'core/faces.js': variantFile(variant) } : undefined;
    const w = makeRenderWorld(cfg.shape, cfg.order, Array.isArray(cfg.size) ? Math.min(...cfg.size) : cfg.size, cfg.sym, files);
    if (Array.isArray(cfg.size)) { w.set(`setGridSize(${cfg.size[0]}, ${cfg.size[1]}); width = canvasW; height = canvasH;`); }
    w.dims = [w.get('canvasW'), w.get('canvasH')];
    w.set(STUB);
    const ids = w.get('nodes.filter((n) => !n.free).map((n) => n.id)');
    const K = keyframes(ids, seed);
    if (mode === 'morph') {
        w.baseConnections(K[0]);
        const L = K.map((k) => w.addKeyframeLayer(k));
        L.forEach((i) => w.set(`additionalLayers[${i}].showFaces = true;`));
        w.setTimeline(L);
        if (net === 'field') { w.set(`baseNetTransform = ${JSON.stringify(NET_A)}; timeline.netStates = ${JSON.stringify([NET_A, NET_B])}; timeline.netLive = true;`); }
        w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
        w.set('if (typeof spatialMorphRenderGrow === "function") spatialMorphRenderGrow = (p) => p;');   // task 103: the detectors want the EXACT face polygons; task 096 draws them grown by 0.3 px (measurement trap)
    } else {   // the animation: timeline playback of the connection morph WITHOUT the spatial morph (playback layer, normal face pass)
        w.baseConnections([]);
        const L = K.map((k) => w.addKeyframeLayer(k));
        L.forEach((i) => w.set(`additionalLayers[${i}].showFaces = true;`));   // the playback layer shows faces exactly when EVERY keyframe layer does (core/tiling.js layerShowsFaces)
        S.addLayer(w.ctx, { shape: cfg.shape, order: cfg.order, size: cfg.size, mode: cfg.sym, connections: [], playback: true, enabled: true });
        const pb = w.get('additionalLayers.length - 1');
        w.set(`additionalLayers[${pb}].showFaces = true;`);
        w.setTimeline(L, { playbackLayerIndex: pb });
        w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 });
    }
    w.cfg = cfg; w.mode = mode; w.K = K;
    return w;
}
function frameAt(w, t, jit, seed) {
    const code = `timeline.elapsedMs = ${t} * ${SEG_MS}; timeline.currentFrame = { segmentIndex: 0, localT: ${t} }; __polys.length = 0; __jit = ${jit || 0}; __seed = ${(seed || 1) >>> 0};` +
        (w.mode === 'anim' ? ' applyTimelineFrame();' : '') + ' drawTessellation(); __jit = 0;';
    w.set(code);
    return w.get('__polys');
}

// ---------------------------------------------------------------------------------------------------- geometry
function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }
function bbox(p) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; } return [x0, y0, x1, y1]; }
function clipRect(p, CW, CH) {   // Sutherland-Hodgman against [0,CW]x[0,CH]
    let out = p;
    for (const [axis, lim, keepLess] of [[0, 0, false], [0, CW, true], [1, 0, false], [1, CH, true]]) {
        const inp = out; out = [];
        const inside = (q) => keepLess ? q[axis] <= lim : q[axis] >= lim;
        for (let i = 0; i < inp.length; i++) {
            const a = inp[i], b = inp[(i + 1) % inp.length], ia = inside(a), ib = inside(b);
            if (ia) out.push(a);
            if (ia !== ib) { const t = (lim - a[axis]) / (b[axis] - a[axis]); out.push(axis === 0 ? [lim, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), lim]); }
        }
        if (out.length === 0) break;
    }
    return out;
}
function segCross(a, b, c, d) {   // proper crossing of ab and cd
    const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function selfIntersects(p) {
    const n = p.length; if (n > 80) return false;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segCross(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return true; }
    return false;
}
const RS = 2;   // coverage raster: 2 px samples at an irregular offset (no sample sits on a lattice line)
const OFX = 0.3712, OFY = 0.6139;
function rasterize(polys, CW, CH) {   // -> Uint8Array(RNx*RNy) cover count (even-odd per polygon)
    const RNx = Math.ceil(CW / RS), RNy = Math.ceil(CH / RS);
    const cnt = new Uint8Array(RNx * RNy);
    for (const p of polys) {
        const n = p.length, b = bbox(p);
        const r0 = Math.max(0, Math.ceil((b[1] - OFY) / RS)), r1 = Math.min(RNy - 1, Math.floor((b[3] - OFY) / RS));
        for (let r = r0; r <= r1; r++) {
            const y = OFY + r * RS, xs = [];
            for (let i = 0; i < n; i++) { const a = p[i], c = p[(i + 1) % n]; if ((a[1] <= y) !== (c[1] <= y)) xs.push(a[0] + (y - a[1]) / (c[1] - a[1]) * (c[0] - a[0])); }
            xs.sort((u, v) => u - v);
            for (let k = 0; k + 1 < xs.length; k += 2) { const c0 = Math.max(0, Math.ceil((xs[k] - OFX) / RS)), c1 = Math.min(RNx - 1, Math.floor((xs[k + 1] - OFX) / RS)); for (let c = c0; c <= c1; c++) { const i = r * RNx + c; if (cnt[i] < 255) cnt[i]++; } }
        }
    }
    return cnt;
}
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const v = parseInt(m[1], 16); return [v >> 16, (v >> 8) & 255, v & 255]; };

// ---------------------------------------------------------------------------------------------------- per frame
function analyseFrame(polys, dims) {
    const CW = dims ? dims[0] : W, CH = dims ? dims[1] : W;
    const P = [];   // polygons that cover a positive area of the canvas (a polygon that only touches the border does not count: 1e-9 px would flip it)
    let total = polys.length;
    let areaSum = 0, small = 0, dup = 0, selfX = 0, nonFinite = 0;
    const clippedForRaster = [];
    for (const q of polys) {
        const pts = q.p;
        if (pts.length < 3) { P.push({ p: pts, f: q.f, bad: true, area: 0, c: null }); small++; continue; }
        if (!pts.every((v) => Number.isFinite(v[0]) && Number.isFinite(v[1]))) { P.push({ p: pts, f: q.f, bad: true, area: 0, c: null }); nonFinite++; continue; }
        const b = bbox(pts); if (b[2] < 0 || b[0] > CW || b[3] < 0 || b[1] > CH) continue;
        const cl = clipRect(pts, CW, CH); const ca = cl.length >= 3 ? Math.abs(polyArea(cl)) : 0;
        if (ca < 1e-6) continue;
        const a = Math.abs(polyArea(pts));
        let cx = 0, cy = 0, A2 = 0; for (let i = 0; i < pts.length; i++) { const u = pts[i], v = pts[(i + 1) % pts.length], cr = u[0] * v[1] - v[0] * u[1]; A2 += cr; cx += (u[0] + v[0]) * cr; cy += (u[1] + v[1]) * cr; }
        const q2 = { p: pts, f: q.f, area: a, clipped: ca, c: Math.abs(A2) > 1e-12 ? [cx / (3 * A2), cy / (3 * A2)] : [pts[0][0], pts[0][1]] };
        P.push(q2); areaSum += ca; clippedForRaster.push(cl);
        if (a < 0.25) small++;
        let d = false; for (let i = 0; i < pts.length && !d; i++) for (let j = i + 1; j < pts.length; j++) { if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < 1e-6) { d = true; break; } }
        if (d) dup++;
        if (selfIntersects(pts)) selfX++;
    }
    const cnt = rasterize(clippedForRaster, CW, CH);
    let gaps = 0, over = 0; for (let i = 0; i < cnt.length; i++) { if (cnt[i] === 0) gaps++; else if (cnt[i] > 1) over++; }
    return { P, total, n: P.length, areaSum, areaDelta: areaSum - CW * CH, gapPx2: gaps * RS * RS, overPx2: over * RS * RS, small, dup, selfX, nonFinite, cnt };
}
// match faces of two frames by centroid (nearest, mutual) -> array a -> index in b or -1
function matchFaces(A, B, radius) {
    const G = 16, grid = new Map();
    B.forEach((q, j) => { if (!q.c) return; const k = Math.floor(q.c[0] / G) + ',' + Math.floor(q.c[1] / G); (grid.get(k) || grid.set(k, []).get(k)).push(j); });
    const nearest = (c, grid2, list, r) => { let best = -1, bd = r; const gx = Math.floor(c[0] / G), gy = Math.floor(c[1] / G), k = Math.ceil(r / G); for (let dx = -k; dx <= k; dx++) for (let dy = -k; dy <= k; dy++) { const L = grid2.get((gx + dx) + ',' + (gy + dy)); if (!L) continue; for (const j of L) { const d = Math.hypot(list[j].c[0] - c[0], list[j].c[1] - c[1]); if (d < bd) { bd = d; best = j; } } } return best; };
    const gridA = new Map(); A.forEach((q, i) => { if (!q.c) return; const k = Math.floor(q.c[0] / G) + ',' + Math.floor(q.c[1] / G); (gridA.get(k) || gridA.set(k, []).get(k)).push(i); });
    return A.map((q, i) => { if (!q.c) return -1; const j = nearest(q.c, grid, B, radius); if (j < 0) return -1; const back = nearest(B[j].c, gridA, A, radius); return back === i ? j : -1; });
}
// the face set differs: counts, or faces with an area > 5 px^2 that have no partner within 3 px
function setDiff(A, B) {
    const a = A.P.filter((q) => q.c && q.area > 5), b = B.P.filter((q) => q.c && q.area > 5);
    const m = matchFaces(a, b, 3); const unA = m.filter((x) => x < 0).length;
    return { count: A.n !== B.n, unmatched: unA, differs: A.n !== B.n || unA > 0 };
}

// ---------------------------------------------------------------------------------------------------- one sequence (cfg, net, seed, mode)
const COL_STEP = 40;
// random keyframes often give DIFFERENT line counts after the symmetry expansion ('lineCountMismatch': the morph needs equal counts): the seed is advanced (seed + 1000 k) until the base variant accepts the pair
function acceptedSeed(cfg, net, seed, mode) {
    if (mode !== 'morph') return { seed, tries: 0 };
    for (let k = 0; k < 40; k++) {
        const w = build(cfg, net, seed + 1000 * k, mode, 'base'); frameAt(w, 0.5);
        if (w.status().code === (net === 'field' ? 'netActive' : 'ok')) return { seed: seed + 1000 * k, tries: k };
    }
    return { seed, tries: -1 };
}
function runSequence(cfg, net, seed0, mode, opt) {
    const seed0_ = seed0;
    const acc = acceptedSeed(cfg, net, seed0, mode), seed = acc.seed;
    const w = build(cfg, net, seed, mode, opt.variant || 'base');
    const wEps = (opt.eps === false) ? null : ['eps0.05', 'eps2'].map((v) => build(cfg, net, seed, mode, v));
    const wJit = build(cfg, net, seed, mode, opt.variant || 'base');
    const frames = [], res = { cfg, net, seed, seed0: seed0_, mode, tries: acc.tries, status: null, frames: [] };
    for (let i = 0; i < NT; i++) {
        const t = i / (NT - 1);
        const polys = frameAt(w, t);
        const fa = analyseFrame(polys, w.dims);
        if (i === 0 || i === NT - 1 || i === 20) res.status = res.status || (mode === 'morph' ? w.status().code : 'anim');
        frames.push(fa);
        const rec = { i, n: fa.n, total: fa.total, areaDelta: +fa.areaDelta.toFixed(3), gapPx2: fa.gapPx2, overPx2: fa.overPx2, small: fa.small, dup: fa.dup, selfX: fa.selfX, nonFinite: fa.nonFinite };
        // (5) jitter 1e-9 px
        const fj = analyseFrame(frameAt(wJit, t, 1e-9, 1000 + i), w.dims);
        const sj = setDiff(fa, fj); rec.jit = sj.differs ? 1 : 0; rec.jitCount = sj.count ? 1 : 0;
        // (6) FACE_EPSILON
        if (wEps) { const f1 = analyseFrame(frameAt(wEps[0], t), w.dims), f2 = analyseFrame(frameAt(wEps[1], t), w.dims); const d1 = setDiff(fa, f1), d2 = setDiff(fa, f2); rec.eps005 = d1.differs ? 1 : 0; rec.eps2 = d2.differs ? 1 : 0; rec.n005 = f1.n; rec.n2 = f2.n; }
        res.frames.push(rec);
        if (opt.keepLast) opt.keepLast(i, fa);
    }
    // (1)/(4) sequence-level: count changes, blips, unmatched, centroid second difference, colour spikes
    let changes = 0, blips = 0, appear = 0, d2big = 0, d2max = 0, stepMax = 0, colJump = 0, colSpike = 0, matchedTot = 0, stepJump = 0;
    const events = [];
    for (let i = 1; i < NT; i++) {
        if (frames[i].n !== frames[i - 1].n) { changes++; if (i + 1 < NT && frames[i + 1].n === frames[i - 1].n) { blips++; events.push({ i, kind: 'blip', d: frames[i].n - frames[i - 1].n }); } }
    }
    const M = [];   // M[i] = match of frames[i] faces (area > 5) -> frames[i+1]
    const big = frames.map((f) => f.P.filter((q) => q.c && q.area > 5));
    for (let i = 0; i + 1 < NT; i++) M.push(matchFaces(big[i], big[i + 1], 30));
    for (let i = 0; i + 1 < NT; i++) {
        M[i].forEach((j, a) => {
            if (j < 0) { if (big[i][a].area > 20) appear++; return; }
            matchedTot++;
            const st = Math.hypot(big[i + 1][j].c[0] - big[i][a].c[0], big[i + 1][j].c[1] - big[i][a].c[1]); stepMax = Math.max(stepMax, st); if (st > 2) stepJump++;
            const ca = hexRgb(big[i][a].f), cb = hexRgb(big[i + 1][j].f);
            if (ca && cb && Math.max(Math.abs(ca[0] - cb[0]), Math.abs(ca[1] - cb[1]), Math.abs(ca[2] - cb[2])) > COL_STEP) { colJump++; const nx = i + 2 < NT ? M[i + 1][j] : -1; if (nx >= 0) { const cc = hexRgb(big[i + 2][nx].f); if (cc && Math.max(Math.abs(ca[0] - cc[0]), Math.abs(ca[1] - cc[1]), Math.abs(ca[2] - cc[2])) <= COL_STEP) colSpike++; } }
            if (i + 1 < NT - 1) { const nx = M[i + 1][j]; if (nx >= 0) { const c0 = big[i][a].c, c1 = big[i + 1][j].c, c2 = big[i + 2][nx].c; const d2 = Math.hypot(c2[0] - 2 * c1[0] + c0[0], c2[1] - 2 * c1[1] + c0[1]); d2max = Math.max(d2max, d2); if (d2 > 2) { d2big++; } } }
        });
    }
    res.seq = { changes, blips, appear, matchedTot, stepJump, stepMax: +stepMax.toFixed(2), d2big, d2max: +d2max.toFixed(2), colJump, colSpike };
    // area / count per frame for the worst-frame choice
    res.ok = true;
    return res;
}

// ---------------------------------------------------------------------------------------------------- run
function argOf(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
function runMain() {
    const variant = argOf('--variant', 'base'), shard = (argOf('--shard', '0/1')).split('/').map(Number), seqs = +argOf('--seqs', 5), out = argOf('--out', null), only = argOf('--only', null);
    const jobs = [];
    CONFIGS.forEach((cfg, ci) => {
        ['none', 'field'].forEach((net, ni) => {
            if (only !== 'anim') for (let j = 0; j < seqs; j++) jobs.push({ ci, net, mode: 'morph', seed: ((ci * 2 + ni) * seqs + j) % 30 + 1 });
        });
        if (only !== 'morph') for (let j = 0; j < Math.max(2, Math.floor(seqs / 2)); j++) jobs.push({ ci, net: 'none', mode: 'anim', seed: (ci * 3 + j) % 30 + 1 });
    });
    const mine = jobs.filter((_, k) => k % shard[1] === shard[0]);
    const results = [];
    for (const j of mine) {
        const cfg = CONFIGS[j.ci];
        try { const r = runSequence(cfg, j.net, j.seed, j.mode, { variant, eps: process.env.NOEPS ? false : undefined }); r.ci = j.ci; results.push(r); }
        catch (e) { results.push({ ci: j.ci, cfg, net: j.net, seed: j.seed, mode: j.mode, ok: false, error: String(e && e.stack).slice(0, 300) }); }
    }
    const o = JSON.stringify({ variant, shard, results });
    if (out) fs.writeFileSync(out, o); else console.log(o);
}
module.exports = { CONFIGS, acceptedSeed, build, frameAt, analyseFrame, runSequence, rasterize, variantSource, variantFile, W, NT, setDiff, polyArea };
if (require.main === module) { const cmd = process.argv[2]; if (cmd === 'run') runMain(); else require('./measure-face-artifacts-report.js').main(cmd, process.argv.slice(3)); }
