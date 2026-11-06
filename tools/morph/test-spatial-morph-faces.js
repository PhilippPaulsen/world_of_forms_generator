// Guard for the FACES of the spatial morph (morph stage f1 / f1b, no colour yet): core/spatial-morph-render.js spatialMorphRenderFacesWanted() / TileFaces() / FillFaces() and the status code 'netFacesNeedField'.
// Everything runs on the REAL core files in a vm (tools/morph/render-harness.js) with p5 stand-ins that record the fills (push / pop depth and style, noStroke / fill / beginShape / vertex / endShape).
// The oracles of the task (every one is a check below):
//   1. faces OFF, or a Single / Tiled net, or a curved line type, or a shape that is not a square: no face is computed or drawn (computeCellFaces is never called), and the lines are the lines of the tree
//      BEFORE this stage (pinned hashes LINES_BEFORE); stage f1b: WITHOUT a net the faces ARE drawn (square, faces on, straight lines), unwarped;
//   2. switch OFF: the morph code adds nothing (no computeCellFaces call, no fill) and the whole call log of the normal frame is the one of the tree before (pinned hash OFF_BEFORE); the 30 patterns
//      of the OFF proof are checked by test-spatial-morph-render.js (OFF_GOLDEN);
//   3. FIELD net on: every tile has faces (> 0), every face is a closed polygon (CLOSE, >= 3 distinct vertices, finite, non-zero area), the fills are colours (stage 006b: the default palettes for uncoloured keyframes, see test-spatial-morph-color.js);
//   4. free line ends: the lines are not touched by the face pass (deep-equal before / after), the number of free ends of a frame is the same with faces on and off, and a free end is cut regularly;
//   5. activeNetWarp, the p5 style stack and segmentCollector are exactly as before the draw, also when an exception is thrown (in a fill, in computeCellFaces);
//   6. core/tiling.js and core/faces.js are byte-identical to the tree before this stage (sha256);
//   7. no keyframe store is written (the stores before / after are deep-equal; faceAssignmentsFor, applyAssignmentsLazily and ensureDefaultGrayFill are never called);
//   plus: computeCellFaces runs on REGULAR coordinates (activeNetWarp is null during the call) and the polygons are warped at the end; the status texts (Single / Tiled: "Flächen im Morph nur bei Feld-Netz",
//   Field: no "Flächen folgen"); new top-level names carry the prefix spatialMorph[A-Z].
//   node tools/morph/test-spatial-morph-faces.js           (--print-pins prints LINES_BEFORE and OFF_BEFORE for the tree given in SPATIAL_MORPH_RENDER_JS)
//   SPATIAL_MORPH_RENDER_JS=/path/to/sabotaged-copy.js node tools/morph/test-spatial-morph-faces.js        (sabotage runs)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
const M = require(path.join(ROOT, 'core', 'spatial-morph.js'));

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 500)); } };
const J = (x) => JSON.stringify(x);
const same = (a, b) => J(a) === J(b);
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const hashOf = (x) => sha(J(x)).slice(0, 16);
const PRINT = process.argv.includes('--print-pins');

// ---- pins: the tree before this stage (3108480a) ----------------------------------------------------------------------------------------------------------------------------------------------
const PIN_FILES = {
  'core/tiling.js': 'ca6b9c1c77c7d7973f3deb61a1218dff991351e6bed3e5f1ed06c1de5501aa77',
  'core/faces.js': 'aebc7ceab383339f4e589d53c9e8a9679575466f01b7899fa0b4a6404e611235',
};
// the hash of every line() / bezier() call of the morph frame in these scenes, taken from core/spatial-morph-render.js of 3108480a (node ... --print-pins with SPATIAL_MORPH_RENDER_JS = that file)
const LINES_BEFORE = { 'field-faces-off': '5d37aa20c703d3d2', 'field-faces-on': '5d37aa20c703d3d2', 'tiled-faces-on': '15fe329eabaada62', 'single-faces-on': '9c6fa7396bb0297c', 'nonet-faces-on': 'f8dc63cc0a2e678f', 'curve-field-faces-on': '4f53cda18c2baa0c' };
// the hash of the whole call log (lines AND fills) of the NORMAL frame (switch off) with a field net and faces on, same tree
const OFF_BEFORE = '0df057907c45df12';

// ---- the scene -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const K0 = [[1, 5], [2, 8], [3, 7], [4, 6], [1, 9]], K1 = [[1, 9], [2, 6], [4, 8], [5, 9], [3, 7]];
const KF = { square: [[[1, 5], [2, 8], [3, 7]], [[1, 9], [2, 6], [4, 8]]], triangle: [[[1, 5], [2, 6], [3, 4]], [[1, 6], [2, 5], [3, 5]]], hex: [[[1, 10], [3, 14], [5, 20]], [[2, 11], [4, 15], [6, 21]]] };
const NETS = {
  field: { x: { kind: 'trig', w: 0.3 }, y: 'same', repeat: false, domain: 'field' },
  tiled: { x: { kind: 'trig', w: -0.4 }, y: 'same', repeat: true, domain: 'tiled' },
  single: { x: { kind: 'trig', w: 0.3 }, y: 'same', repeat: false },
};
// p5 stand-ins: the style (fill, stroke) with a push / pop stack, the recorded polygons, a way to make endShape throw
const STUB = `
  var __depth = 0, __polys = [], __cur = null, __style = { fill: null, stroke: 'S' }, __stack = [], __endThrows = 0, __vertexCalls = 0;
  push = () => { __stack.push(JSON.stringify(__style)); __depth++; };
  pop = () => { __style = JSON.parse(__stack.pop()); __depth--; };
  noStroke = () => { __style.stroke = null; }; stroke = (c) => { __style.stroke = c; }; noFill = () => { __style.fill = null; };
  fill = (c) => { __style.fill = c; };
  beginShape = () => { __cur = []; }; vertex = (x, y) => { __vertexCalls++; __cur.push([x, y]); };
  endShape = (m) => { if (__endThrows && __polys.length + 1 >= __endThrows) throw new Error('endShape'); __polys.push({ fill: __style.fill, pts: __cur, close: m }); __cur = null; };
  var CLOSE = 'close';
  var __cf = computeCellFaces, __cfCalls = 0, __cfWarpNull = [], __cfThrowAt = 0;
  computeCellFaces = function () { __cfCalls++; __cfWarpNull.push(activeNetWarp === null); if (__cfThrowAt && __cfCalls === __cfThrowAt) throw new Error('cf'); return __cf.apply(this, arguments); };
  var __gray = 0, __lazy = 0, __assign = 0;
  { const g = ensureDefaultGrayFill; ensureDefaultGrayFill = function () { __gray++; return g.apply(this, arguments); }; }
  { const l = applyAssignmentsLazily; applyAssignmentsLazily = function () { __lazy++; return l.apply(this, arguments); }; }
  { const a = faceAssignmentsFor; faceAssignmentsFor = function () { __assign++; return a.apply(this, arguments); }; }
`;
function mk(o) {
  o = Object.assign({ net: null, faces: true, morph: true, shape: 'square', sym: 'rotation_reflection3', K: [K0, K1], baseFaces: false }, o);
  const w = makeRenderWorld(o.shape, 3, 3, o.sym);
  w.set(STUB);
  w.baseConnections(o.K[0]);
  const ids = o.K.map((k) => w.addKeyframeLayer(k));
  ids.forEach((i) => w.set(`additionalLayers[${i}].showFaces = ${!!o.faces};`));
  w.setTimeline(ids);
  if (o.net) w.set(`baseNetTransform = ${J(NETS[o.net])};`);
  if (o.baseFaces) w.set('showFaces = true;');
  w.setMorph({ enabled: o.morph, mode: 'linear', angleDeg: 0 });
  return w;
}
const polys = (w) => w.get('__polys');
const stats = (w) => w.get('spatialMorphRenderState.faceStats');
const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };

const SCENES = {
  'field-faces-off': () => mk({ net: 'field', faces: false }), 'field-faces-on': () => mk({ net: 'field' }), 'tiled-faces-on': () => mk({ net: 'tiled' }),
  'single-faces-on': () => mk({ net: 'single' }), 'nonet-faces-on': () => mk({ net: null }),
  'curve-field-faces-on': () => { const w = mk({ net: 'field' }); w.set("curveType = { kind: 'fold', fold: 1, leaning: 0.5 };"); return w; },
};
if (PRINT) {
  const out = {};
  Object.keys(SCENES).forEach((k) => { const w = SCENES[k](); out[k] = hashOf(w.drawn()); });
  const wo = mk({ net: 'field', morph: false, baseFaces: true });
  const calls = wo.drawn(); out.OFF_BEFORE = hashOf([calls, polys(wo)]);
  console.log(J(out));
  process.exit(0);
}

// ---- 1. faces off / no field net: nothing is computed or drawn, the lines are the lines of before -------------------------------------------------------------------------------------------
console.log('== 1. no faces unless: keyframes show faces, straight curve, FIELD net ==');
T('no-faces cases', () => {
  const cases = [['field-faces-off', 'faces OFF on the keyframes (field net)'], ['tiled-faces-on', 'a Tiled net'], ['single-faces-on', 'a Single net'], ['curve-field-faces-on', 'a curved line type (field net)']];
  cases.forEach(([id, what]) => {
    const w = SCENES[id](); const h = hashOf(w.drawn());
    check(`${what}: no face is computed (computeCellFaces never called) or drawn, no fill`, w.get('__cfCalls') === 0 && polys(w).length === 0 && stats(w).faces === 0, J({ calls: w.get('__cfCalls'), polys: polys(w).length, stats: stats(w) }));
    check(`${what}: the line()/bezier() calls are those of the tree before this stage`, h === LINES_BEFORE[id], h);
  });
  const w = SCENES['field-faces-on'](); const h = hashOf(w.drawn());
  check('field net WITH faces: the lines are still those of the tree before this stage (the fills only come in addition)', h === LINES_BEFORE['field-faces-on'], h);
  const wBase = mk({ net: 'field', faces: false, baseFaces: true });
  wBase.drawn();
  check('only the BASE sheet shows faces (the keyframe layers do not): no faces in the morph', wBase.get('__cfCalls') === 0 && polys(wBase).length === 0);
  const wOne = mk({ net: 'field' }); wOne.set('additionalLayers[1].showFaces = false;'); wOne.drawn();
  check('one of the two keyframes does not show faces: none', wOne.get('__cfCalls') === 0 && polys(wOne).length === 0);
});

// ---- 2. switch off ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== 2. switch OFF: the morph code adds nothing ==');
T('off', () => {
  const w = mk({ net: 'field', morph: false, baseFaces: false, faces: false }); w.drawn();
  check('switch off, no sheet shows faces: computeCellFaces is never called and nothing is filled', w.get('__cfCalls') === 0 && polys(w).length === 0 && w.status().code === 'off');
  const wo = mk({ net: 'field', morph: false, baseFaces: true }); const calls = wo.drawn(); const h = hashOf([calls, polys(wo)]);
  check('switch off, field net, base faces on: the whole call log (lines and fills) of the normal frame is that of the tree before this stage', h === OFF_BEFORE, h);
  check('...and the morph state was not touched (faceStats stays null, the status says off)', wo.get('spatialMorphRenderState.faceStats') === null && wo.status().code === 'off');
});

// ---- 3. field net: faces in every tile, closed polygons, default grays -----------------------------------------------------------------------------------------------------------------
console.log('== 3. FIELD net on: faces in every tile ==');
T('field faces', () => {
  const w = SCENES['field-faces-on'](); w.drawn();
  const st = stats(w), ps = polys(w);
  check('every tile has faces (tiles with faces == tiles > 0) and there are more faces than tiles (the lines cut the cells)', st.tiles > 0 && st.tilesWithFaces === st.tiles && st.faces > st.tiles && ps.length === st.faces, J(st));
  let bad = '';
  ps.forEach((p, i) => {
    const distinct = new Set(p.pts.map((q) => q[0].toFixed(6) + ',' + q[1].toFixed(6))).size;
    if (p.close !== 'close' || p.pts.length < 3 || distinct < 3 || !p.pts.every((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])) || area(p.pts) < 1e-6) bad = bad || `#${i} ${J(p)}`;
  });
  check('every face is a closed polygon: endShape(CLOSE), at least 3 distinct finite vertices, non-zero area', ps.length > 0 && bad === '', bad.slice(0, 200));
  check('the fills are #rrggbb colours of the default palettes (stage 006b), not one uniform gray', ps.every((p) => /^#[0-9a-f]{6}$/i.test(p.fill)) && new Set(ps.map((p) => p.fill)).size > 1 && !ps.every((p) => /^#([0-9a-f]{2})\1\1$/i.test(p.fill)), [...new Set(ps.map((p) => p.fill))].join(' '));
  check("the status is 'netActive' (faces drawn: no 'Flächen folgen')", w.status().code === 'netActive');
  // the sweep: the square (the only shape with a net warp) in every symmetry family and two sizes; triangle and hex have no net warp, so no Field and no faces
  let sweepBad = '', cases = 0;
  for (const sym of ['none', 'reflection_only', 'rotation3', 'rotation6', 'rotation_reflection3', 'rotation_reflection6']) for (const size of [3, 5]) {
    const s2 = makeRenderWorld('square', 3, size, sym); s2.set(STUB); s2.baseConnections(KF.square[0]);
    const ids = KF.square.map((k) => s2.addKeyframeLayer(k)); ids.forEach((i) => s2.set(`additionalLayers[${i}].showFaces = true;`)); s2.setTimeline(ids);
    s2.set(`baseNetTransform = ${J(NETS.field)};`); s2.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); s2.drawn(); cases++;
    const t = stats(s2);
    if (!(t.tiles > 0 && t.tilesWithFaces === t.tiles && t.faces >= t.tiles && polys(s2).every((p) => p.pts.length >= 3 && p.close === 'close'))) sweepBad += ` ${sym}/${size}:${J(t)}`;
  }
  check(`square, every symmetry family x sizes 3 and 5 (${cases} cases): faces in every tile, only closed polygons`, sweepBad === '', sweepBad.slice(0, 300));
  let noShape = '';
  for (const shape of ['triangle', 'hex']) { const s3 = mk({ net: 'field', shape, sym: 'none', K: KF[shape] }); s3.drawn(); if (s3.get('__cfCalls') !== 0 || polys(s3).length !== 0) noShape += ' ' + shape; }
  check('triangle and hex have no net warp (netWarpForBase is square only): no Field, no face is computed', noShape === '', noShape);
  // the polygons are warped at the END: the same cell without the warp has other vertices, and computeCellFaces saw REGULAR coordinates
  check('computeCellFaces runs on regular coordinates: activeNetWarp is null during every call', w.get('__cfCalls') === st.tiles + w.get('spatialMorphRenderState.colorBuilds') && w.get('__cfWarpNull.every(Boolean)'), J({ calls: w.get('__cfCalls'), tiles: st.tiles, builds: w.get('spatialMorphRenderState.colorBuilds') }));
  const regular = w.get(`(function () { const s = spatialMorphRenderSource({ ids: [0] }); return s.outerCorners.map((p) => [p.x, p.y]); })()`);
  const inside = ps.every((p) => p.pts.every((q) => q[0] >= -1e-6 && q[0] <= 600 + 1e-6 && q[1] >= -1e-6 && q[1] <= 600 + 1e-6));
  check('the warped polygons stay on the canvas', inside && regular.length >= 3);
});

// ---- 3b. no net: faces too, unwarped (stage f1b) -------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== 3b. NO net: faces in every tile, drawn as computed ==');
T('no net faces', () => {
  const w = SCENES['nonet-faces-on'](); const h = hashOf(w.drawn());
  const st = stats(w), ps = polys(w);
  check('no net: every tile has faces (> 0) and there are more faces than tiles, one fill per face', st.tiles > 0 && st.tilesWithFaces === st.tiles && st.faces > st.tiles && ps.length === st.faces, J(st));
  check('...every face is a closed polygon (CLOSE, >= 3 distinct finite vertices, non-zero area), filled with #rrggbb colours', ps.length > 0 && ps.every((p) => p.close === 'close' && p.pts.length >= 3 && new Set(p.pts.map((q) => q[0].toFixed(6) + ',' + q[1].toFixed(6))).size >= 3 && p.pts.every((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])) && area(p.pts) > 1e-6 && /^#[0-9a-f]{6}$/i.test(p.fill)));
  check('...computeCellFaces ran once per tile on regular coordinates (activeNetWarp null), no net was installed, the status is ok', w.get('__cfCalls') === st.tiles + w.get('spatialMorphRenderState.colorBuilds') && w.get('__cfWarpNull.every(Boolean)') && w.status().code === 'ok' && w.get('activeNetWarp') === null, w.status().code);
  check('...the lines are those of the tree before (the fills come in addition)', h === LINES_BEFORE['nonet-faces-on'], h);
  // UNWARPED: the faces of a cell tile the cell exactly, so the polygons sum to tiles x cell area and span exactly the union of the tile cells; any distortion (scale or shift) breaks one of the two
  const geo = w.get(`(function () { const tl = spatialMorphRenderRecordTiles(); const cells = tl.map((t) => outerCorners.map((p) => toTileLocal(p, t.c, t.flip, t.rot))); return { n: tl.length, cells: cells.map((c) => c.map((p) => [p.x, p.y])) }; })()`);
  const cellArea = geo.cells.map((c) => area(c)).reduce((a, b) => a + b, 0);
  const sum = ps.reduce((a, p) => a + area(p.pts), 0);
  const box = (list) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; list.forEach((q) => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }); return [x0, y0, x1, y1]; };
  const bp = box([].concat(...ps.map((p) => p.pts))), bc = box([].concat(...geo.cells));
  check('no net: the polygons are NOT distorted - their areas sum to the cell areas and their extent is the extent of the tile cells', geo.n === st.tiles && Math.abs(sum - cellArea) < 1e-6 * cellArea && bp.every((v, i) => Math.abs(v - bc[i]) < 1e-6), J({ sum: Math.round(sum), cellArea: Math.round(cellArea), bp, bc }));
  // activeNetWarp / style restored as for the field net
  const r = SCENES['nonet-faces-on'](); r.set("const __sent = { __sentinel: 1 }; activeNetWarp = __sent; __style = { fill: 'F0', stroke: 'S0' };"); const sty = r.get('JSON.stringify(__style)'); r.run('spatialMorphTryDraw()');
  check('no net: activeNetWarp, the p5 style stack and the style are as before the draw', r.get('activeNetWarp === __sent') && r.get('__depth') === 0 && r.get('JSON.stringify(__style)') === sty);
  const nf = mk({ net: null, faces: false }); nf.drawn();
  check('no net, faces OFF on the keyframes: no face', nf.get('__cfCalls') === 0 && polys(nf).length === 0);
  let noShape = '';
  for (const shape of ['triangle', 'hex']) { const s3 = mk({ net: null, shape, sym: 'none', K: KF[shape] }); s3.drawn(); if (s3.get('__cfCalls') !== 0 || polys(s3).length !== 0) noShape += ' ' + shape; }
  check('no net, triangle and hex: no face (a square-sheet feature)', noShape === '', noShape);
  check('Single and Tiled stay without faces and say netFacesNeedField (the Field net, netActive, is checked in section 3)', ['single', 'tiled'].every((n) => { const x = mk({ net: n }); x.drawn(); return x.status().code === 'netFacesNeedField' && x.get('__cfCalls') === 0 && polys(x).length === 0; }));
});

// ---- 4. free line ends ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== 4. free line ends ==');
T('free ends', () => {
  const dangling = (frame) => { const m = new Map(); const add = (x, y) => { const k = x.toFixed(4) + ',' + y.toFixed(4); m.set(k, (m.get(k) || 0) + 1); }; frame.forEach((s) => { add(s.x1, s.y1); add(s.x2, s.y2); }); let n = 0; m.forEach((c) => { if (c === 1) n++; }); return n; };
  const on = mk({ net: 'field', sym: 'none' }), off = mk({ net: 'field', sym: 'none', faces: false });
  const fOn = on.frame(), fOff = off.frame();
  check('the segments of the frame (what the collector sees) are the same with faces on and off, so is the number of free ends', same(fOn, fOff) && dangling(fOn) === dangling(fOff) && dangling(fOn) > 0, J({ on: dangling(fOn), off: dangling(fOff) }));
  check('...and the face pass ran in that frame (faces were computed)', stats(on).faces > 0 && stats(off).faces === 0);
  // the face pass on its own: the inputs are not touched, a free end is cut regularly
  const r = on.get(`(function () {
    const s = spatialMorphRenderSource(null);
    const lines = [[{ x: 250, y: 250 }, { x: 330, y: 250 }], [{ x: 300, y: 220 }, { x: 300, y: 330 }], [{ x: 210, y: 380 }, { x: 260, y: 350 }]];   // the first two cross; the third is free at both ends
    const before = JSON.stringify(lines), nodesBefore = JSON.stringify(s.nodes), nLen = s.nodes.length, w0 = activeNetWarp;
    const res = spatialMorphRenderTileFaces(lines, s, null);
    const has = (p) => res.nodes.some((n) => Math.hypot(n.x - p.x, n.y - p.y) < 1e-6);
    return { same: JSON.stringify(lines) === before && JSON.stringify(s.nodes) === nodesBefore && s.nodes.length === nLen, warp: activeNetWarp === w0, faces: res.faces.length, freeCut: has(lines[2][0]) && has(lines[2][1]), crossCut: res.nodes.some((n) => Math.hypot(n.x - 300, n.y - 250) < 1e-6) };
  })()`);
  check('the face pass leaves the lines and the grid nodes untouched, restores activeNetWarp, cuts the crossing and keeps both free ends as nodes', r.same && r.warp && r.faces > 0 && r.freeCut && r.crossCut, J(r));
});

// ---- 5. state restored, also on exceptions -----------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== 5. activeNetWarp, p5 style, segmentCollector ==');
T('restore', () => {
  const w = mk({ net: 'field' });
  w.set("const __sent = { __sentinel: 1 }; activeNetWarp = __sent; __style = { fill: 'F0', stroke: 'S0' };");
  const styleBefore = w.get('JSON.stringify(__style)');
  w.run('spatialMorphTryDraw()');
  check('a normal face frame: activeNetWarp is the same object, the p5 style stack is empty again and the style is as before', w.get('activeNetWarp === __sent') && w.get('__depth') === 0 && w.get('JSON.stringify(__style)') === styleBefore && w.status().code === 'netActive');
  const e = mk({ net: 'field' });
  e.set("const __sent = { __sentinel: 1 }; activeNetWarp = __sent; __style = { fill: 'F0', stroke: 'S0' }; __endThrows = 5;");
  const styleE = e.get('JSON.stringify(__style)');
  e.run('spatialMorphTryDraw()');
  check('an exception while a face is filled: renderError, activeNetWarp is the same object, the style stack is empty and the style is as before', e.status().code === 'renderError' && e.get('activeNetWarp === __sent') && e.get('__depth') === 0 && e.get('JSON.stringify(__style)') === styleE, J({ code: e.status().code, depth: e.get('__depth') }));
  const c = mk({ net: 'field' });
  c.set('const __sent = { __sentinel: 1 }; activeNetWarp = __sent; __cfThrowAt = 3;');   // calls 1 and 2 build the two corner colour fields, call 3 is the first tile
  c.run('spatialMorphTryDraw()');
  const ref = mk({ net: 'field' }); ref.drawn();
  const refPolys = polys(ref), cPolys = polys(c);
  const rest = cPolys.length > 0 && cPolys.length < refPolys.length && cPolys.every((p, i) => same(p, refPolys[refPolys.length - cPolys.length + i]));
  check('computeCellFaces throws for the first tile: no renderError, that tile has no faces, the others are drawn and WARPED exactly as without the exception, activeNetWarp is restored', c.status().code === 'netActive' && c.get('activeNetWarp === __sent') && rest, J({ code: c.status().code, n: cPolys.length, ref: refPolys.length }));
  const k = mk({ net: 'field' });
  k.set("segmentCollector = []; const __segs = segmentCollector;");
  k.run('spatialMorphTryDraw()');
  check('segmentCollector is the same array after the face pass (the collector of an export or of a frame read is not lost)', k.get('segmentCollector === __segs'));
});

// ---- 6. the protected files --------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== 6. core/tiling.js and core/faces.js unchanged ==');
T('pins', () => {
  Object.keys(PIN_FILES).forEach((rel) => check(`${rel} is byte-identical to the tree before this stage (sha256)`, sha(fs.readFileSync(path.join(ROOT, rel), 'utf8')) === PIN_FILES[rel], sha(fs.readFileSync(path.join(ROOT, rel), 'utf8')).slice(0, 12)));
  const src = fs.readFileSync(process.env.SPATIAL_MORPH_RENDER_JS || path.join(ROOT, 'core', 'spatial-morph-render.js'), 'utf8');
  const names = [...src.matchAll(/^(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  check('every top-level name of core/spatial-morph-render.js starts with spatialMorph + capital letter', names.length > 0 && names.every((n) => /^spatialMorph[A-Z]/.test(n)), names.filter((n) => !/^spatialMorph[A-Z]/.test(n)).join(','));
});

// ---- 7. no store is written ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== 7. keyframe stores ==');
T('stores', () => {
  const w = mk({ net: 'field' });
  const snap = () => w.get(`JSON.stringify({ base: Array.from(baseFaceAssignments.entries()), layers: additionalLayers.map((l) => ({ fa: l.faceAssignments ? Array.from(l.faceAssignments.entries()) : null, keys: Object.keys(l).sort() })) })`);
  w.set('baseFaceAssignments = new Map([["k", { color: "#123456" }]]);');
  const before = snap();
  w.drawn();
  w.setMorph({ enabled: true, mode: 'bilinear', angleDeg: 0 }); w.drawn();
  check('the stores of the base and of the keyframe layers (and the keys of the layer objects) are deep-equal before and after morph frames with faces', snap() === before && stats(w).faces >= 0);
  check('faceAssignmentsFor, applyAssignmentsLazily and ensureDefaultGrayFill are never called by the morph path', w.get('__assign') === 0 && w.get('__lazy') === 0 && w.get('__gray') === 0, J({ assign: w.get('__assign'), lazy: w.get('__lazy'), gray: w.get('__gray') }));
});

// ---- the status texts ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== status texts ==');
T('status', () => {
  const codeOf = (id) => { const w = SCENES[id](); w.drawn(); return w.status().code; };
  check("Single net + faces asked: 'netFacesNeedField'; Tiled net + faces asked: 'netFacesNeedField'; Field net + faces: 'netActive'", codeOf('single-faces-on') === 'netFacesNeedField' && codeOf('tiled-faces-on') === 'netFacesNeedField' && codeOf('field-faces-on') === 'netActive');
  const noFaces = mk({ net: 'tiled', faces: false }); noFaces.drawn();
  check("a Tiled net with NO faces asked: plain 'netActive' (the faces note only comes when faces were asked for)", noFaces.status().code === 'netActive');
  const code = (c) => M.spatialMorphStatusCodes.includes(c);
  check("'netFacesNeedField' is a documented status code", code('netFacesNeedField'));
  const dict = fs.readFileSync(path.join(ROOT, 'ui-i18n.js'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'ui-morph.js'), 'utf8');
  check('de / en in the dictionary: Flächen im Morph nur bei Feld-Netz / Morph faces: field net only', dict.includes("'morph.status.netFacesNeedField': { de: 'Flächen im Morph nur bei Feld-Netz', en: 'Morph faces: field net only' }"));
  check('the German fallback of ui-morph.js says the same, and no status text says "Flächen folgen" or "faces follow" any more', ui.includes("'morph.status.netFacesNeedField': 'Flächen im Morph nur bei Feld-Netz'") && !/Flächen folgen|faces follow/.test(dict + ui));
});

console.log(failures === 0 ? `\n${checks}/${checks} checks passed` : `\n${failures} of ${checks} checks FAILED`);
process.exit(failures === 0 ? 0 : 1);
