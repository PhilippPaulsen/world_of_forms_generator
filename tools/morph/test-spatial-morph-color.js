// Guard for the COLOUR of the faces of the spatial morph (morph stages 006b / 010): core/spatial-morph-render.js spatialMorphRenderCornerField() / FaceColors() and the pure helpers of core/spatial-morph.js
// (spatialMorphFaceSamples, PolygonContains, RasterizeField, RasterSample, MixLinear). Runs the REAL core files in a vm (tools/morph/render-harness.js) with p5 stand-ins that record every fill.
// The measures (not "the polygon is closed"; every one is a check below):
//   a. COLOURED keyframes (one assignment per face, a hue each): every tile of the frame at p = 0.5 has MORE THAN ONE distinct fill colour;
//   b. the colours at p = 0 and p = 1 are the colours of the keyframe layers: for every face the distance (largest channel difference, sRGB bytes) to the nearest colour of that keyframe's field; the
//      threshold is stated at the check;
//   c. the gradient over 21 values of p is CONTINUOUS (mean colour), and (stage 010) no face JUMPS: tools/morph/measure-color-jumps.js follows the faces of every tile from p to p + 0.02; the number of
//      faces with a jump above 12 and the largest jump are bounded by the measurement (thresholds at the checks);
//   e. (stage 010) a GRAY IS A FILL: with keyframes whose fill is the default gray (a store filled by a normal frame, or a layer that was never drawn), the colour of every face at p = 0 and p = 1 equals the colour
//      of the NORMAL image of that layer (computeCellFaces() with the layer's store), and there is no replacement palette;
//   plus: the mixing space is LINEAR LIGHT (uniform fields A and B, a tile with 0 < w < 1: the fill is linearToHex((1 - t) A + t B), which is not the sRGB mean); no keyframe store is written or created, no
//   store function ever gets a REAL store (only copies), faceAssignmentsFor is never called; the corner fields are cached and rebuilt when an assignment changes; the pure helpers; Single / Tiled nets stay
//   without faces; the status text "Morph faces: field net only" is unchanged; new top-level names carry the prefix spatialMorph[A-Z].
//   node tools/morph/test-spatial-morph-color.js            (--print prints the measured numbers)
//   SPATIAL_MORPH_RENDER_JS=/path/to/sabotaged-copy.js node tools/morph/test-spatial-morph-color.js        (sabotage runs)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
const M = require(path.join(ROOT, 'core', 'spatial-morph.js'));
const { measureJumps, measureCoverage } = require('./measure-color-jumps.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 500)); } };
const J = (x) => JSON.stringify(x);
const PRINT = process.argv.includes('--print');
const say = (...a) => { if (PRINT) console.log('   #', ...a); };

const K0 = [[1, 5], [2, 8], [3, 7], [4, 6], [1, 9]], K1 = [[1, 9], [2, 6], [4, 8], [5, 9], [3, 7]];
const NETS = { field: { x: { kind: 'trig', w: 0.3 }, y: 'same', repeat: false, domain: 'field' }, tiled: { x: { kind: 'trig', w: -0.4 }, y: 'same', repeat: true, domain: 'tiled' } };
// p5 stand-ins that record the fills, tile by tile (the marker wraps spatialMorphRenderFillFaces()), and count the calls that would touch a store
const STUB = `
  var __polys = [], __cur = null, __fill = null, __tiles = [], __stack = [];
  push = () => { __stack.push(__fill); }; pop = () => { __fill = __stack.pop(); }; noStroke = () => { }; stroke = () => { }; noFill = () => { };
  fill = (c) => { __fill = c; };
  beginShape = () => { __cur = []; }; vertex = (x, y) => { __cur.push([x, y]); };
  endShape = (m) => { __polys.push({ fill: __fill, pts: __cur }); __cur = null; };
  var CLOSE = 'close';
  { const f = spatialMorphRenderFillFaces; spatialMorphRenderFillFaces = function () { const a = __polys.length; const r = f.apply(this, arguments); __tiles.push({ a, b: __polys.length }); return r; }; }
  var __gray = 0, __lazy = 0, __assign = 0, __real = 0, __cf = computeCellFaces, __cap = [];
  const __isReal = (st) => st === baseFaceAssignments || additionalLayers.some((l) => l.faceAssignments === st);   // the base's or a layer's OWN store object (not a copy)
  { const g = ensureDefaultGrayFill; ensureDefaultGrayFill = function (st) { __gray++; if (__isReal(st)) __real++; return g.apply(this, arguments); }; }
  { const l = applyAssignmentsLazily; applyAssignmentsLazily = function (r, st) { __lazy++; if (__isReal(st)) __real++; return l.apply(this, arguments); }; }
  { const a = faceAssignmentsFor; faceAssignmentsFor = function () { __assign++; return a.apply(this, arguments); }; }
  computeCellFaces = function (c, n, st) { if (st && __isReal(st)) __real++; return __cf.apply(this, arguments); };
  { const f = spatialMorphRenderFaceColors; spatialMorphRenderFaceColors = function (res, fields, w) { const r = f.apply(this, arguments); __cap.push({ res: { nodes: res.nodes, faces: res.faces.map((q) => ({ nodeIds: q.nodeIds, color: q.color })) }, colors: r }); return r; }; }
`;
// colours a keyframe layer: one assignment per face of its cell (the keys are the faces' trail keys), hue = base + face number; `uniform` gives every face the SAME hue
const COLOR = (layer, hue0, uniform) => `(function () {
  const L = additionalLayers[${layer}], sh = faceSheetOverrideOfLayer(L);
  const border = sh.outerCorners.map((p, k) => ({ id: -1000001 - k, x: p.x, y: p.y, free: true }));
  const conns = L.connections.map((c) => c.slice()); border.forEach((n, k) => conns.push([n.id, border[(k + 1) % border.length].id]));
  const res = computeCellFaces(conns, L.nodes.concat(border), null, null, sh);
  const keys = computeFaceTrailKeys(res, sheetGroupElements(L.nodes, sh));
  L.faceAssignments = new Map();
  keys.forEach((k, i) => { if (k) setFaceAssignment(L.faceAssignments, k, { hue: (${hue0} + ${uniform ? 0 : 1} * i) % 24, w: 0.2, s: 0.3, rule: 'test', params: null }); });
  return res.faces.map((f, i) => L.faceAssignments.has(keys[i]) ? resolveColor(OSTWALD_REFERENCE_SYSTEM, L.faceAssignments.get(keys[i])).hex : null).filter(Boolean);
})()`;
function mk(o) {
  o = Object.assign({ net: null, colored: true, uniform: false, K: [K0, K1], sym: 'none' }, o);   // no symmetry: every face is its own trail, so a store can give every face its own colour
  const w = makeRenderWorld(o.shape || 'square', o.N || 3, 3, o.sym);
  w.set(STUB);
  w.baseConnections(o.K[0]);
  const ids = o.K.map((k) => w.addKeyframeLayer(k));
  ids.forEach((i) => w.set(`additionalLayers[${i}].showFaces = true;`));
  w.setTimeline(ids);
  if (o.net) w.set(`baseNetTransform = ${J(NETS[o.net])};`);
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  w.colors = [];
  if (o.colored) ids.forEach((i, n) => w.colors.push(w.run(COLOR(i, n === 0 ? 0 : 12, o.uniform))));
  w.at = (p) => { w.set(`timeline.elapsedMs = ${p * 2000}; __polys.length = 0; __tiles.length = 0;`); w.drawn(); return w.get('__polys').map((q) => q.fill); };
  return w;
}
const byTile = (w) => { const polys = w.get('__polys'), tiles = w.get('__tiles'); return tiles.map((t) => polys.slice(t.a, t.b)); };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const dist = (a, b) => Math.max(...rgb(a).map((v, k) => Math.abs(v - rgb(b)[k])));
const polyArea = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
const meanColor = (w) => { const polys = w.get('__polys'); let A = 0; const acc = [0, 0, 0]; polys.forEach((q) => { const a = polyArea(q.pts), c = rgb(q.fill); A += a; for (let k = 0; k < 3; k++) acc[k] += a * c[k]; }); return acc.map((v) => v / A); };

// ---- a. coloured keyframes: more than one colour in every tile --------------------------------------------------------------------------------------------------------------------------------------
console.log('== a. coloured keyframes: several colours in every tile ==');
T('a', () => {
  const w = mk({ net: 'field' }); w.at(0.5);
  const tiles = byTile(w), st = w.get('spatialMorphRenderState.faceStats');
  const counts = tiles.map((t) => new Set(t.map((q) => q.fill)).size);
  say('tiles', tiles.length, 'distinct per tile min/max', Math.min(...counts), Math.max(...counts), 'keyframe colours', w.colors.map((c) => c.length));
  check('both keyframes are coloured (a colour per face) and the morph drew faces in every tile', w.colors.every((c) => c.length > 3) && tiles.length === st.tiles && st.tilesWithFaces === st.tiles, J({ colors: w.colors.map((c) => c.length), tiles: st.tiles }));
  check('p = 0.5, field net: EVERY tile has more than one distinct fill colour', counts.length > 0 && counts.every((n) => n > 1), 'min ' + Math.min(...counts));
  const w2 = mk({ net: null }); w2.at(0.5);
  check('p = 0.5, no net: every tile has more than one distinct fill colour, all fills are #rrggbb', byTile(w2).every((t) => new Set(t.map((q) => q.fill)).size > 1) && w2.get('__polys').every((q) => /^#[0-9a-f]{6}$/.test(q.fill)));
});

// ---- b. p = 0 and p = 1 are the keyframes' colours --------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== b. p = 0 / p = 1: the colours of the keyframe layers ==');
T('b', () => {
  const w = mk({ net: null });
  [0, 1].forEach((p) => {
    w.at(p);
    const fills = w.get('__polys').map((q) => q.fill);
    const own = w.colors[p], other = w.colors[1 - p];
    const dOwn = fills.map((f) => Math.min(...own.map((c) => dist(f, c))));
    const dOther = fills.map((f) => Math.min(...other.map((c) => dist(f, c))));
    const exact = dOwn.filter((d) => d <= 2).length / fills.length;
    say('p', p, 'faces', fills.length, 'share within 2:', exact.toFixed(4), 'max distance to own', Math.max(...dOwn), 'median', dOwn.slice().sort((a, b) => a - b)[Math.floor(dOwn.length / 2)], 'nearest other-keyframe colour mean', (dOther.reduce((a, b) => a + b, 0) / dOther.length).toFixed(1));
    check(`p = ${p}: at least ${p === 0 ? 95 : 65} % of the faces are within 2 (largest channel difference, sRGB bytes) of a colour of keyframe ${p} (2 = the rounding of the linear mix with margin; the face colour is the AREA MEAN of the field, so a face that does not coincide with a face of the keyframe mixes its neighbours: measured 100 % at p = 0, 70 % at p = 1, where the morph projects boundary endpoints onto the edge, stage d2c)`, exact >= (p === 0 ? 0.95 : 0.65), (exact * 100).toFixed(1) + ' %');
    check(`p = ${p}: no face is further than 12 from a colour of keyframe ${p} (measured 0 and 9: a straddling face mixes colours a few hue steps apart; 12 is the floor of the jump test below; a colour of another corner is 45 away on average)`, Math.max(...dOwn) <= 12, 'max ' + Math.max(...dOwn));
    const nearOther = fills.filter((f, i) => dOther[i] <= 2 && dOwn[i] > 2).length;
    check(`p = ${p}: and (almost) none sits on a colour of the OTHER keyframe only`, nearOther / fills.length < 0.02, nearOther + ' of ' + fills.length);
  });
});

// ---- c. continuity over 21 values of p -------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== c. the gradient over 21 values of p ==');
T('c', () => {
  const w = mk({ net: null });
  const means = [];
  for (let i = 0; i <= 20; i++) { w.at(i / 20); means.push(meanColor(w)); }
  const jumps = means.slice(1).map((m, i) => Math.max(...m.map((v, k) => Math.abs(v - means[i][k]))));
  const total = Math.max(...means[20].map((v, k) => Math.abs(v - means[0][k])));
  const worst = Math.max(...jumps);
  say('total change of the mean colour', total.toFixed(1), 'jumps', jumps.map((j) => j.toFixed(1)).join(' '));
  check('the mean colour of the frame moves from keyframe 0 to keyframe 1 (total change > 10 of 255)', total > 40, total.toFixed(1));
  check('21 values of p: the largest jump of the mean colour between neighbouring values is below 1/4 of the total change (a linear gradient would be 1/20; a jump would be near the total)', worst < total / 4, 'largest ' + worst.toFixed(1) + ' of total ' + total.toFixed(1));
  check('...and every step moves in one direction on the channel that changes most (no flicker)', (() => { const k = [0, 1, 2].sort((a, b) => Math.abs(means[20][b] - means[0][b]) - Math.abs(means[20][a] - means[0][a]))[0]; const sg = Math.sign(means[20][k] - means[0][k]); return means.slice(1).every((m, i) => (m[k] - means[i][k]) * sg > -1.5); })());
});

// ---- c2. no face jumps (the pair with few, large faces) -----------------------------------------------------------------------------------------------------------------------------------------------
console.log('== c2. the faces do not jump between neighbouring values of p ==');
T('c2', () => {
  // THRESHOLD, from the measurement (tools/morph/measure-color-jumps.js, step 0.02, all 121 tiles, reports/010.md): with UNIFORM corner fields the largest jump of a face in one step is 11 (the legitimate change of
  // the mix: the front moves the weight of a tile by up to ~0.07 per step between two colours that are 165 apart), so 12 is the line. Before the stage-010 fix the coloured pair had faces above it (linear 0,
  // radial 3-4, largest jump 12 / 16); after it none, the largest jump is 8. Dense pairs (8 to 16 lines, order 4) are NOT bounded here: see reports/010.md, their residue is open.
  ['linear', 'radial'].forEach((mode) => {
    const r = measureJumps('coloured', mode, 0.02);
    say(mode, J(r));
    check(`coloured pair, ${mode}, 50 steps of 0.02: no face jumps by more than 12 (the floor of the mix is 11), the largest jump is ${r.maxJump}`, r.over12 === 0 && r.maxJump <= 12, J({ over12: r.over12, maxJump: r.maxJump, worstP: r.worstP }));
  });
  const lin = measureJumps('coloured', 'linear', 0.02);
  check('coloured pair, linear: a tile whose polygons did not move between two steps does not change colour (0 faces changed by more than 2)', lin.stillFaces > 1000 && lin.stillJumps === 0, J({ still: lin.stillJumps + ' of ' + lin.stillFaces }));
});

// ---- e. a gray is a fill ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== e. a gray is a fill: p = 0 / p = 1 are the NORMAL image of the layer ==');
const KG = [[[2, 6], [6, 8], [8, 4], [4, 2], [2, 8], [4, 6]], [[2, 6], [6, 8], [8, 4], [4, 2], [2, 5], [5, 8]]];   // a diamond with a cross (four bounded faces in the cell) / with two spokes (two); no endpoint changes its edge, so the morph faces at p = 0 and p = 1 are the layers' own
// the normal frame's faces of a layer: computeCellFaces() with the layer's store (drawn = the real store, as the app does it; else a throwaway copy) -> [{ poly, color }] in cell coordinates
const NORMAL = (i, drawn) => `(function () { const L = additionalLayers[${i}]; const st = ${drawn ? '(L.faceAssignments = L.faceAssignments || new Map())' : 'new Map(L.faceAssignments || [])'};
  const r = computeCellFaces(L.connections, L.nodes, st, null, faceSheetOverrideOfLayer(L)); const by = new Map(r.nodes.map((n) => [n.id, n]));
  return r.faces.map((f) => ({ poly: f.nodeIds.map((id) => by.get(id)).map((n) => [n.x, n.y]), color: f.color })); })()`;
const gray = (h) => { const c = rgb(h); return c[0] === c[1] && c[1] === c[2]; };
const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i][1] > pt[1]) !== (poly[j][1] > pt[1]) && pt[0] < (poly[j][0] - poly[i][0]) * (pt[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; return c; };
T('e', () => {
  [['stores filled by a normal frame', true], ['layers never drawn', false]].forEach(([what, drawn]) => {
    const w = mk({ colored: false, K: KG });
    const normal = [0, 1].map((i) => w.run(NORMAL(i, drawn)));
    if (drawn) normal.forEach((n, i) => w.run(NORMAL(i, true)));   // (the first pass above already filled the stores when drawn)
    [0, 1].forEach((p) => {
      w.set('__cap.length = 0;'); w.at(p);
      const cap = w.get('__cap[0]');   // the first tile: the faces of the cell and the colours the morph gave them
      const by = new Map(cap.res.nodes.map((n) => [n.id, n]));
      let compared = 0, worst = 0, grays = 0;
      cap.res.faces.forEach((f, i) => {
        const pts = f.nodeIds.map((id) => by.get(id)).map((n) => [n.x, n.y]);
        const m = [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
        const nf = normal[p].find((q) => inPoly(m, q.poly));
        if (!nf) return;
        compared++; worst = Math.max(worst, dist(cap.colors[i], nf.color)); if (gray(cap.colors[i])) grays++;
      });
      say(what, 'p', p, 'normal faces', normal[p].length, 'morph faces inside them', compared, 'worst distance', worst, 'gray', grays);
      check(`${what}, p = ${p}: the layer has ${normal[p].length} bounded faces in the normal image, every morph face inside one has ITS colour (largest channel difference ${worst} <= 2; the rounding of the mix)`, normal[p].length >= 2 && compared >= normal[p].length && worst <= 2, J({ compared, worst }));
      check(`${what}, p = ${p}: those colours are grays (r = g = b): the default fill of the layer, no palette colour`, compared > 0 && grays === compared, grays + ' of ' + compared);
    });
  });
  check('the prototype palette is gone: core/spatial-morph.js no longer exports spatialMorphDefaultCornerPalettes', M.spatialMorphDefaultCornerPalettes === undefined);
  // a gray layer keeps its gray when the other keyframe is coloured; the coloured one is not turned gray
  const mix = mk({ colored: false, K: KG }); mix.run(COLOR(1, 12, false)); mix.at(0);
  const f0 = mix.get('__polys').map((q) => q.fill);
  check('one keyframe gray, the other coloured: at p = 0 every face is gray (keyframe 0), at p = 1 not all faces are gray (keyframe 1 is coloured)', f0.every(gray) && (mix.at(1), mix.get('__polys').some((q) => !gray(q.fill))));
});

// ---- the mixing space is linear light --------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== the mixing space ==');
T('linear', () => {
  const w = mk({ colored: false, net: null });
  // uniform fields: every texel of corner 0 is A, of corner 1 is B (replace the fields the renderer samples)
  const A = '#d97742', B = '#347ea8';
  w.set(`{ const orig = spatialMorphRenderCornerField; spatialMorphRenderCornerField = function (id, k) { const v = orig.apply(this, arguments); if (!v) return v; const lin = cssColorToLinear(${J([A, B])}[k]); return { raster: Object.assign({}, v.raster, { cells: v.raster.cells.map(() => lin) }) }; }; }`);
  const lin = (h) => w.run(`cssColorToLinear('${h}')`);
  let nLin = 0, nMid = 0, nSrgb = 0;
  const seen = new Set();
  [0.3, 0.5, 0.7].forEach((p) => { w.at(p); w.get('__polys').forEach((q) => seen.add(q.fill)); });   // three progress values: tiles inside the front band show different t
  const a = lin(A), b = lin(B);
  [...seen].forEach((f) => {
    if (f === A || f === B) return;
    const c = rgb(f);
    const t = (w.run(`srgbToLinear(${c[0]})`) - a[0]) / (b[0] - a[0]);
    if (t <= 0.02 || t >= 0.98) return;
    nMid++;
    const hexLin = w.run(`linearToHex(${J(a.map((v, k) => (1 - t) * v + t * b[k]))})`);
    const hexSrgb = '#' + rgb(A).map((v, k) => Math.round((1 - t) * v + t * rgb(B)[k]).toString(16).padStart(2, '0')).join('');
    if (dist(f, hexLin) <= 1) nLin++;
    if (dist(f, hexSrgb) <= 1) nSrgb++;
  });
  say('fills', seen.size, 'between A and B', nMid, 'match the linear mix', nLin, 'match the sRGB mix', nSrgb);
  check('uniform fields A and B: the fills between them lie on the LINEAR-light mix (all three channels within 1 of linearToHex((1 - t) A + t B))', nMid >= 3 && nLin === nMid, nLin + ' of ' + nMid);
  check('...and they are not on the sRGB mean (the two differ by more than 1 for these colours)', nSrgb < nMid, nSrgb + ' of ' + nMid);
});

// ---- no store is written ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== keyframe stores and cache ==');
T('stores', () => {
  const w = mk({ net: 'field' });
  const snap = () => w.run(`JSON.stringify([additionalLayers.map((l) => [l.faceAssignments ? [...l.faceAssignments] : null, Object.keys(l)]), [...baseFaceAssignments]])`);
  const before = snap();
  w.at(0.3); w.at(0.7);
  check('coloured keyframes: the stores (and the key sets of the layer objects) are deep-equal before and after two frames', snap() === before);
  check('...faceAssignmentsFor is never called and no store function (computeCellFaces, applyAssignmentsLazily, ensureDefaultGrayFill) ever gets a REAL store: only copies', w.get('__assign') === 0 && w.get('__real') === 0, J({ assign: w.get('__assign'), real: w.get('__real'), lazy: w.get('__lazy'), gray: w.get('__gray') }));
  const u = mk({ colored: false, net: null });
  const sb = u.run(`JSON.stringify([additionalLayers.map((l) => Object.keys(l)), baseFaceAssignments.size, additionalLayers.map((l) => 'faceAssignments' in l)])`);
  u.at(0.5);
  check('uncoloured keyframes (the gray fill is computed on a copy): no store is created on the layers (no faceAssignments key appears), the base store stays empty', u.run(`JSON.stringify([additionalLayers.map((l) => Object.keys(l)), baseFaceAssignments.size, additionalLayers.map((l) => 'faceAssignments' in l)])`) === sb && u.get('__real') === 0);
  const c = mk({ net: null });
  c.at(0.2); const b1 = c.get('spatialMorphRenderState.colorBuilds');
  c.at(0.4); c.at(0.9);
  check('the corner fields are cached: three frames of the same keyframes build them once (2 corners)', b1 === 2 && c.get('spatialMorphRenderState.colorBuilds') === 2, 'builds ' + c.get('spatialMorphRenderState.colorBuilds'));
  c.run(COLOR(0, 5, false)); c.at(0.4);
  check('...and a changed assignment rebuilds the field of that keyframe only', c.get('spatialMorphRenderState.colorBuilds') === 3, 'builds ' + c.get('spatialMorphRenderState.colorBuilds'));
});

// ---- the pure helpers -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== the pure helpers ==');
T('helpers', () => {
  const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const s = M.spatialMorphFaceSamples(sq);
  const mean = (f) => s.reduce((a, q) => a + q.w * f(q), 0);
  check('face samples: 4 triangles x 3 points, weights sum to 1, the weighted mean is the centre and the weighted mean of x^2 is that of the square (the 3-point rule is exact for degree 2: 100/3)', s.length === 12 && Math.abs(s.reduce((a, q) => a + q.w, 0) - 1) < 1e-12 && Math.abs(mean((q) => q.x) - 5) < 1e-9 && Math.abs(mean((q) => q.x * q.x) - 100 / 3) < 1e-9);
  check('face samples: a polygon without area gives its vertex mean, junk gives none', J(M.spatialMorphFaceSamples([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }])) === '[{"x":2,"y":2,"w":1}]' && M.spatialMorphFaceSamples([]).length === 0 && M.spatialMorphFaceSamples([{ x: NaN, y: 0 }, sq[1], sq[2]]).length === 0);
  check('polygon contains: inside / outside / concave notch', M.spatialMorphPolygonContains(sq, 5, 5) && !M.spatialMorphPolygonContains(sq, 11, 5) && !M.spatialMorphPolygonContains([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 5, y: 2 }, { x: 0, y: 10 }], 5, 8));
  const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  const r = M.spatialMorphRasterizeField([{ poly: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 10 }, { x: 0, y: 10 }], lin: [1, 0, 0] }, { poly: [{ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 5, y: 5 }], lin: [0, 1, 0] }], box, 10);
  check('raster: left half red, upper right green, lower right empty (null); a point outside is clamped to the nearest texel; no extent gives null', J(M.spatialMorphRasterSample(r, 2, 2)) === '[1,0,0]' && J(M.spatialMorphRasterSample(r, 7, 2)) === '[0,1,0]' && M.spatialMorphRasterSample(r, 7, 8) === null && J(M.spatialMorphRasterSample(r, -5, 2)) === '[1,0,0]' && M.spatialMorphRasterizeField([], { minX: 0, minY: 0, maxX: 0, maxY: 1 }, 10) === null && M.spatialMorphRasterSample(null, 1, 1) === null);
  const c = [[0, 0, 0], [1, 1, 1], null, [0.5, 0, 0]];
  check('mix: weights normalised over the entries that have a colour and a weight above 0; none -> null; inputs unchanged', J(M.spatialMorphMixLinear(c, [0.5, 0.5, 0, 0])) === '[0.5,0.5,0.5]' && J(M.spatialMorphMixLinear(c, [0, 1, 0.3, 0])) === '[1,1,1]' && M.spatialMorphMixLinear(c, [0, 0, 1, 0]) === null && M.spatialMorphMixLinear(null, []) === null && J(c) === '[[0,0,0],[1,1,1],null,[0.5,0,0]]');
});

// ---- shapes: faces and colour for the hexagon (task 013) and the triangle -------------------------------------------------------------------------------------------------------------------------------
console.log('== shapes: faces and colour on the hexagon ==');
// the pairs: every line runs from a node ON the cell's edge (the same node in both keyframes, so no boundary endpoint changes its edge and the morph faces at p = 0 and p = 1 are the layers' own) to an INTERIOR node
// (a different one in each keyframe); every line touches the edge, so the cell has no isolated island (a region with a hole would be traced by its outer boundary only, a limit of core/faces.js findFaces()). Seeded.
const rngT = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function interiorPair(shape, N, seed, n) {
  const w = makeRenderWorld(shape, N, 3, 'none');
  const oc = w.get('outerCorners'), nd = w.get('nodes.filter((q) => !q.free)');
  const onEdge = (q) => oc.some((a, i) => { const b = oc[(i + 1) % oc.length], L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2, t = Math.max(0, Math.min(1, ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / L2)); return Math.hypot(q.x - (a.x + t * (b.x - a.x)), q.y - (a.y + t * (b.y - a.y))) < 1.5; });
  const inner = nd.filter((q) => !onEdge(q)).map((q) => q.id), edge = nd.filter(onEdge).map((q) => q.id);
  const r = rngT(seed), pick = (arr) => arr.splice(Math.floor(r() * arr.length), 1)[0];
  const e = edge.slice(), K0 = [], K1 = [];
  for (let i = 0; i < n && e.length; i++) { const b = pick(e); K0.push([b, inner[Math.floor(r() * inner.length)]]); K1.push([b, inner[Math.floor(r() * inner.length)]]); }
  return [K0, K1];
}
const BIG_FACE = 400;   // px2: 180 texels of the 1.5 px raster; below it the area mean reaches over the face's edge (measured: faces of 786 / 806 / 999 px2 exact, 184 px2 off by 8, 63 by 15, 39 by 27)
const SHAPE_SPECS = {
  hex: { N: 3, interiorN: 3, seed: 2, lines: 8, coloured: 'hex-coloured', dense: 'hex-dense-8', coverageMin: 0.995, jumpMax: 12 },
};
Object.keys(SHAPE_SPECS).forEach((shape) => T('shape ' + shape, () => {
  const sp = SHAPE_SPECS[shape];
  const K = interiorPair(shape, sp.interiorN, sp.seed, sp.lines);
  const w = mk({ shape, N: sp.interiorN, K, colored: true });
  w.at(0.5);
  const tiles = byTile(w), st = w.get('spatialMorphRenderState.faceStats');
  const closed = w.get('__polys').every((q) => q.pts.length >= 3 && new Set(q.pts.map((a) => a[0].toFixed(5) + ',' + a[1].toFixed(5))).size >= 3 && q.pts.every((a) => Number.isFinite(a[0]) && Number.isFinite(a[1])) && polyArea(q.pts) > 1e-6 && /^#[0-9a-f]{6}$/i.test(q.fill));
  say(shape, 'tiles', st.tiles, 'with faces', st.tilesWithFaces, 'faces', st.faces, 'status', w.status().code);
  check(`${shape}: a frame at p = 0.5 has faces in EVERY tile (${st.tiles} tiles), every face is a closed polygon with area and a #rrggbb fill, the status is ok`, st.tiles > 0 && st.tilesWithFaces === st.tiles && tiles.length === st.tiles && closed && w.status().code === 'ok', J(st));
  check(`${shape}: coloured keyframes give more than one colour in every tile`, tiles.every((t) => new Set(t.map((q) => q.fill)).size > 1));
  // every face lies in ITS tile: within the circumradius of the tile centre (+ 1 px)
  const tcs = w.get('spatialMorphRenderRecordTiles()').map((t) => t.c), R = w.get('Math.max(...outerCorners.map((p) => Math.hypot(p.x - centroid.x, p.y - centroid.y)))');
  const inTile = tiles.every((t, ti) => t.every((q) => q.pts.every((a) => Math.hypot(a[0] - tcs[ti].x, a[1] - tcs[ti].y) <= R + 1)));
  check(`${shape}: every face lies in its own tile (all vertices within the circumradius ${R.toFixed(1)} of the tile centre): the tile transform is applied`, tcs.length === tiles.length && inTile);
  const wn = mk({ shape, N: sp.interiorN, K, colored: true, net: 'field' }); wn.at(0.5);
  check(`${shape}: a net (Field) changes nothing (it has no warp on this shape): same status, same number of faces, same fills as without`, wn.status().code === w.status().code && wn.get('__polys').length === w.get('__polys').length && J(wn.get('__polys').map((q) => q.fill)) === J(w.get('__polys').map((q) => q.fill)));
  const off = mk({ shape, N: sp.interiorN, K, colored: true }); off.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 }); off.at(0.5);
  check(`${shape}: switch off: no corner field is built, no morph face is drawn (status off)`, off.get('spatialMorphRenderState.colorBuilds') === 0 && off.status().code === 'off');
  // coverage: sum of the face areas / the cell, 11 values of p; the same lines through the NORMAL path give the same number for the worst tile
  const cov = measureCoverage(sp.dense, 'radial');
  say(shape, 'coverage', J(cov));
  check(`${shape}: coverage of the cell (${sp.dense}, radial, 11 values of p, ${cov.tiles} tiles): smallest ${cov.min} >= ${sp.coverageMin} (measured 0.9974 .. 1 on all hexagon pairs; the gap is the known FACE_EPSILON limit of core/faces.js), no tile without faces`, cov.min >= sp.coverageMin && cov.noFaces === 0, J({ min: cov.min, noFaces: cov.noFaces }));
  check(`${shape}: ...and the same lines of the worst tile through the normal path (computeCellFaces) cover the same: ${cov.coverageNormal} = ${cov.min}`, Math.abs(cov.coverageNormal - cov.min) < 1e-3);
  // end colours = the normal image (a gray is a fill), both stores filled by a normal frame and never drawn
  [['stores filled by a normal frame', true], ['layers never drawn', false]].forEach(([what, drawn]) => {
    const g = mk({ shape, N: sp.interiorN, K, colored: false });
    const normal = [0, 1].map((i) => g.run(NORMAL(i, drawn)));
    [0, 1].forEach((p) => {
      g.set('__cap.length = 0;'); g.at(p);
      const cap = g.get('__cap[0]'), by = new Map(cap.res.nodes.map((n) => [n.id, n]));
      let compared = 0, big = 0, worst = 0, worstAll = 0, grays = 0;
      cap.res.faces.forEach((f, i) => {
        const pts = f.nodeIds.map((id) => by.get(id)).map((n) => [n.x, n.y]);
        const m = [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
        const ar = polyArea(pts);
        const nf = normal[p].find((q) => inPoly(m, q.poly) && Math.abs(polyArea(q.poly) / ar - 1) < 0.02);   // the same face: its vertex mean lies in it and the area agrees
        if (!nf) return;
        const d = dist(cap.colors[i], nf.color);
        compared++; worstAll = Math.max(worstAll, d); if (gray(cap.colors[i])) grays++;
        if (ar >= BIG_FACE) { big++; worst = Math.max(worst, d); }
      });
      say(shape, what, 'p', p, 'normal faces', normal[p].length, 'compared', compared, 'of them >= ' + BIG_FACE + ' px2', big, 'worst (big)', worst, 'worst (all)', worstAll, 'gray', grays);
      check(`${shape}, ${what}, p = ${p}: all ${normal[p].length} bounded faces of the normal image are found in the morph (same face: vertex mean inside, area within 2 %), and the ${big} of them with an area >= ${BIG_FACE} px2 have ITS colour (largest channel difference ${worst} <= 2); the smaller ones are the area mean of a raster of 1.5 px texels and mix their neighbours (largest difference of all ${worstAll}, reported, not bounded)`, compared === normal[p].length && big >= 2 && worst <= 2, J({ compared, big, worst, worstAll }));
      check(`${shape}, ${what}, p = ${p}: those colours are grays (the default fill), no palette`, compared > 0 && grays === compared, grays + ' of ' + compared);
    });
  });
  // no face jumps (the pair with few, large faces); the floor is measured on THIS shape with uniform corner fields
  ['linear', 'radial'].forEach((mode) => {
    const r = measureJumps(sp.coloured, mode, 0.02);
    say(shape, mode, J(r));
    check(`${shape}, coloured pair, ${mode}, 50 steps of 0.02: no face jumps by more than ${sp.jumpMax} (the floor of the mix on this shape is 11, uniform corner fields; measured largest jump ${r.maxJump}, not assignable ${(r.unmatchedShare * 100).toFixed(1)} %)`, r.over12 === 0 && r.maxJump <= sp.jumpMax && r.stillJumps === 0, J({ over12: r.over12, maxJump: r.maxJump, still: r.stillJumps }));
  });
}));

// ---- unchanged: Single / Tiled, status text, names -------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== unchanged behaviour ==');
T('unchanged', () => {
  ['single', 'tiled'].forEach((n) => {
    const w = mk({ net: n === 'single' ? 'tiled' : 'tiled' }); if (n === 'single') w.set("baseNetTransform = { x: { kind: 'trig', w: 0.3 }, y: 'same', repeat: false };");
    w.at(0.5);
    check(`${n} net with coloured keyframes: still no faces, no fill, status netFacesNeedField, no corner field built`, w.get('__polys').length === 0 && w.status().code === 'netFacesNeedField' && w.get('spatialMorphRenderState.colorBuilds') === 0, w.status().code);
  });
  const off = mk({ net: 'field' }); off.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 }); off.at(0.5);
  check('switch off: no corner field is built, status off', off.get('spatialMorphRenderState.colorBuilds') === 0 && off.status().code === 'off');
  const ui = fs.readFileSync(path.join(ROOT, 'ui-i18n.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'ui-morph.js'), 'utf8');
  check('the status text for a Single / Tiled net is unchanged: "Morph faces: field net only" (en) and "Flächen im Morph nur bei Feld-Netz" (de) are still there', ui.includes('Morph faces: field net only') && ui.includes('Flächen im Morph nur bei Feld-Netz'));
  const src = fs.readFileSync(path.join(ROOT, 'core', 'spatial-morph-render.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'core', 'spatial-morph.js'), 'utf8');
  const tops = [...src.matchAll(/^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  check('every top-level name of the two files starts with spatialMorph', tops.length > 0 && tops.every((n) => /^spatialMorph[A-Z]/.test(n)), tops.filter((n) => !/^spatialMorph[A-Z]/.test(n)).join(' '));
});

console.log(`\n${checks - failures} of ${checks} checks passed`);
process.exit(failures ? 1 : 0);
