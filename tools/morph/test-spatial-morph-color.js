// Guard for the COLOUR of the faces of the spatial morph (morph stage 006b): core/spatial-morph-render.js spatialMorphRenderCornerField() / FaceColors() and the pure helpers of core/spatial-morph.js
// (spatialMorphDefaultCornerPalettes, FaceSamplePoints, FaceRanks, MixLinear). Runs the REAL core files in a vm (tools/morph/render-harness.js) with p5 stand-ins that record every fill.
// The measures (not "the polygon is closed"; every one is a check below):
//   a. COLOURED keyframes (one assignment per face, a hue each): every tile of the frame at p = 0.5 has MORE THAN ONE distinct fill colour;
//   b. the colours at p = 0 and p = 1 are the colours of the keyframe layers: for every face the distance (largest channel difference, sRGB bytes) to the nearest colour of that keyframe's field; the
//      threshold is stated at the check (a rounding error of the linear-light mix is 1, a face that lies across two keyframe faces mixes both colours: only a share of the faces may exceed it);
//   c. the gradient over 21 values of p is CONTINUOUS: the largest jump of the frame's area-weighted mean colour between neighbouring values of p is reported and bounded by the total change / 4;
//   d. UNCOLOURED keyframes give the default palettes of their corners, not a uniform gray: at p = 0 every fill is a colour of palette 0 (or the mix of two of them), at p = 1 of palette 1;
//   plus: the mixing space is LINEAR LIGHT (uniform fields A and B, a tile with 0 < w < 1: the fill is linearToHex((1 - t) A + t B), which is not the sRGB mean); no keyframe store is written or created,
//   faceAssignmentsFor / applyAssignmentsLazily / ensureDefaultGrayFill are never called; the corner fields are cached (no rebuild for the same frame) and rebuilt when an assignment changes;
//   the pure helpers; Single / Tiled nets stay without faces; the status text "Morph faces: field net only" is unchanged; new top-level names carry the prefix spatialMorph[A-Z].
//   node tools/morph/test-spatial-morph-color.js            (--print prints the measured numbers)
//   SPATIAL_MORPH_RENDER_JS=/path/to/sabotaged-copy.js node tools/morph/test-spatial-morph-color.js        (sabotage runs)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
const M = require(path.join(ROOT, 'core', 'spatial-morph.js'));

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
  var __gray = 0, __lazy = 0, __assign = 0, __cf = computeCellFaces, __cfStores = [];
  { const g = ensureDefaultGrayFill; ensureDefaultGrayFill = function () { __gray++; return g.apply(this, arguments); }; }
  { const l = applyAssignmentsLazily; applyAssignmentsLazily = function () { __lazy++; return l.apply(this, arguments); }; }
  { const a = faceAssignmentsFor; faceAssignmentsFor = function () { __assign++; return a.apply(this, arguments); }; }
  computeCellFaces = function (c, n, st) { if (st) __cfStores.push(1); return __cf.apply(this, arguments); };
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
  const w = makeRenderWorld('square', 3, 3, o.sym);
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
    check(`p = ${p}: at least 85 % of the faces are within 2 (largest channel difference, sRGB bytes) of a colour of keyframe ${p} (2 = the rounding of the linear mix with margin; the rest straddle two faces of the keyframe's cell and mix neighbouring colours, measured 100 % at p = 0 and 90 % at p = 1)`, exact >= 0.85, (exact * 100).toFixed(1) + ' %');
    check(`p = ${p}: no face is further than 6 from a colour of keyframe ${p} (measured 0 and 3: a straddling face mixes colours that are 1 hue step apart; anything above 6 would be a colour of another corner or the default gray)`, Math.max(...dOwn) <= 6, 'max ' + Math.max(...dOwn));
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

// ---- d. uncoloured keyframes: the default palettes ------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== d. uncoloured keyframes: the default palettes, not gray ==');
T('d', () => {
  const w = mk({ colored: false, net: null });
  const hex = (c) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
  const pal = M.spatialMorphDefaultCornerPalettes.map((p) => p.map(hex));
  [0, 1].forEach((p) => {
    w.at(p);
    const fills = w.get('__polys').map((q) => q.fill);
    const inPal = fills.filter((f) => pal[p].includes(f)).length / fills.length;
    const nearPal = fills.filter((f) => Math.min(...pal[p].map((c) => dist(f, c))) <= 2).length / fills.length;
    const gray = fills.filter((f) => rgb(f)[0] === rgb(f)[1] && rgb(f)[1] === rgb(f)[2]).length;
    say('p', p, 'in palette', inPal.toFixed(3), 'near', nearPal.toFixed(3), 'gray', gray, 'distinct', new Set(fills).size);
    check(`p = ${p}: at least 90 % of the fills are exactly a colour of the default palette ${p} (corner ${p})`, inPal >= 0.9, (inPal * 100).toFixed(1) + ' %');
    check(`p = ${p}: no fill is a gray (r = g = b) and the frame has several colours`, gray === 0 && new Set(fills).size > 2, J({ gray, distinct: new Set(fills).size }));
  });
  const mid = mk({ colored: false, net: null }); mid.at(0.5);
  check('p = 0.5: the default palettes blend (fills that are in neither palette exist), still no gray', mid.get('__polys').some((q) => !pal[0].includes(q.fill) && !pal[1].includes(q.fill)) && mid.get('__polys').every((q) => !(rgb(q.fill)[0] === rgb(q.fill)[1] && rgb(q.fill)[1] === rgb(q.fill)[2])));
  const mixed = mk({ colored: false, net: null }); mixed.run(COLOR(1, 12, false)); mixed.at(0);
  check('one keyframe coloured, the other not: the uncoloured one (corner 0) still gives its default palette at p = 0', mixed.get('__polys').filter((q) => pal[0].includes(q.fill)).length / mixed.get('__polys').length >= 0.9);
});

// ---- the mixing space is linear light --------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== the mixing space ==');
T('linear', () => {
  const w = mk({ colored: false, net: null });
  // uniform fields: every face of keyframe 0 is A, every face of keyframe 1 is B (replace the fields the renderer samples)
  const A = '#d97742', B = '#347ea8';
  w.set(`{ const orig = spatialMorphRenderCornerField; spatialMorphRenderCornerField = function (id, k) { const v = orig.apply(this, arguments); if (!v) return v; const col = ${J([A, B])}[k]; return { colored: true, field: v.field.map((e) => Object.assign({}, e, { lin: cssColorToLinear(col) })) }; }; }`);
  const lin = (h) => w.run(`cssColorToLinear('${h}')`);
  // the tile weights are not exposed: derive t from the fill itself and compare with the linear and the sRGB mix at that t
  let nLin = 0, nMid = 0, nSrgb = 0;
  const seen = new Set();
  [0.3, 0.5, 0.7].forEach((p) => { w.at(p); w.get('__polys').forEach((q) => seen.add(q.fill)); });   // three progress values: tiles inside the front band show different t
  const fills = [...seen];
  // find t by least squares in linear light on one channel and check all three channels agree with linear (not with sRGB)
  const a = lin(A), b = lin(B);
  fills.forEach((f) => {
    if (f === A || f === B) return;
    const c = rgb(f);
    const t = (w.run(`srgbToLinear(${c[0]})`) - a[0]) / (b[0] - a[0]);
    if (t <= 0.02 || t >= 0.98) return;
    nMid++;
    const mixLin = a.map((v, k) => (1 - t) * v + t * b[k]);
    const hexLin = w.run(`linearToHex(${J(mixLin)})`);
    const hexSrgb = '#' + rgb(A).map((v, k) => Math.round((1 - t) * v + t * rgb(B)[k]).toString(16).padStart(2, '0')).join('');
    if (dist(f, hexLin) <= 1) nLin++;
    if (dist(f, hexSrgb) <= 1) nSrgb++;
  });
  say('fills', fills.length, 'between A and B', nMid, 'match the linear mix', nLin, 'match the sRGB mix', nSrgb);
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
  check('...faceAssignmentsFor, applyAssignmentsLazily and ensureDefaultGrayFill are never called, computeCellFaces never gets a store', w.get('__assign') === 0 && w.get('__lazy') === 0 && w.get('__gray') === 0 && w.get('__cfStores.length') === 0, J({ a: w.get('__assign'), l: w.get('__lazy'), g: w.get('__gray'), s: w.get('__cfStores.length') }));
  const u = mk({ colored: false, net: null });
  const sb = u.run(`JSON.stringify([additionalLayers.map((l) => Object.keys(l)), baseFaceAssignments.size, additionalLayers.map((l) => 'faceAssignments' in l)])`);
  u.at(0.5);
  check('uncoloured keyframes: no store is created on the layers (no faceAssignments key appears), the base store stays empty', u.run(`JSON.stringify([additionalLayers.map((l) => Object.keys(l)), baseFaceAssignments.size, additionalLayers.map((l) => 'faceAssignments' in l)])`) === sb);
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
  const P = M.spatialMorphDefaultCornerPalettes;
  check('four palettes of five sRGB byte triples (the prototype\'s _DEFAULT_CORNER_PALETTES), frozen', P.length === 4 && P.every((p) => p.length === 5 && p.every((c) => c.length === 3 && c.every((x) => Number.isInteger(x) && x >= 0 && x <= 255))) && Object.isFrozen(P) && Object.isFrozen(P[0]) && Object.isFrozen(P[0][0]) && J(P[0][0]) === '[217,119,66]' && J(P[3][4]) === '[142,88,136]');
  const s = M.spatialMorphFaceSamplePoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
  check('face sample points: the vertex mean first, then 35 % of the way to every vertex (5 points)', s.length === 5 && J(s[0]) === '{"x":5,"y":5}' && Math.abs(s[1].x - (0.65 * 5)) < 1e-12 && Math.abs(s[3].x - (0.65 * 5 + 3.5)) < 1e-12 && M.spatialMorphFaceSamplePoints([]).length === 0 && M.spatialMorphFaceSamplePoints([{ x: NaN, y: 0 }]).length === 0);
  check('face ranks: largest area first, ties keep their order, junk counts as 0', J(M.spatialMorphFaceRanks([4, 9, 4])) === '[1,0,2]' && J(M.spatialMorphFaceRanks([NaN, 1])) === '[1,0]' && J(M.spatialMorphFaceRanks(null)) === '[]');
  const c = [[0, 0, 0], [1, 1, 1], null, [0.5, 0, 0]];
  check('mix: weights normalised over the entries that have a colour and a weight above 0; none -> null; inputs unchanged', J(M.spatialMorphMixLinear(c, [0.5, 0.5, 0, 0])) === '[0.5,0.5,0.5]' && J(M.spatialMorphMixLinear(c, [0, 1, 0.3, 0])) === '[1,1,1]' && M.spatialMorphMixLinear(c, [0, 0, 1, 0]) === null && M.spatialMorphMixLinear(null, []) === null && J(c) === '[[0,0,0],[1,1,1],null,[0.5,0,0]]');
});

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
