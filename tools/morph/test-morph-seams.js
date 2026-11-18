// Task 096: the seams of the spatial morph's face fills (core/spatial-morph-render.js spatialMorphRenderFillFaces, spatialMorphRenderFillOpaque, spatialMorphSeamWidth).
//   1. the alpha helper: #rrggbb, #rgb, #rrggbbaa, rgb(), rgba(), hsl(), hsla() with alpha 1 and < 1; unknown or unparsable formats are NOT opaque (no contour = the old drawing)
//   2. a morph frame: every opaque fill has a contour in its OWN colour, width spatialMorphSeamWidth (0.5 .. 0.75, round joins); the p5 style is back after the call, also when a vertex call throws
//   3. translucent fills (rgba alpha < 1) and unknown formats are drawn WITHOUT contour, opaque neighbours with
//   4. no strokeWeight / stroke in the environment: the old drawing, no error
//   5. the STATIC path (drawFaceFillsAtTile, morph off) is unchanged: byte-equal call log against the render file of main before this task (d7271e2b) and no contour
//   node tools/morph/test-morph-seams.js        sabotage runs: SPATIAL_MORPH_RENDER_JS=/copy.js, FACES_JS=/copy.js (static path)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify, sha = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
const BASE = 'd7271e2b';
const OLD_FILE = path.join(os.tmpdir(), `smr096-${process.pid}.js`);
fs.writeFileSync(OLD_FILE, execSync(`git show ${BASE}:core/spatial-morph-render.js`, { cwd: ROOT, maxBuffer: 1 << 26 }));
process.on('exit', () => { try { fs.unlinkSync(OLD_FILE); } catch (e) { } });

const STUB = (withStroke) => `
  var __polys = [], __cur = null, __style = { fill: null, stroke: null, weight: null, join: null }, __stack = [], __depth = 0, __throwAt = 0, __v = 0, __ops = [];
  push = () => { __stack.push(JSON.stringify(__style)); __depth++; }; pop = () => { __style = JSON.parse(__stack.pop()); __depth--; };
  noStroke = () => { __style.stroke = null; __ops.push('noStroke'); }; noFill = () => { __style.fill = null; }; fill = (c) => { __style.fill = c; __ops.push('fill'); };
  ${withStroke ? "stroke = (c) => { __style.stroke = c; __ops.push('stroke'); }; strokeWeight = (w) => { __style.weight = w; }; strokeJoin = (j) => { __style.join = j; }; var ROUND = 'round';" : "stroke = (c) => { __style.stroke = c; __ops.push('stroke'); }; strokeWeight = undefined; strokeJoin = undefined;"}
  beginShape = () => { __cur = []; }; vertex = (x, y) => { __v++; if (__throwAt && __v >= __throwAt) throw new Error('vertex'); __cur.push([x, y]); };
  endShape = (m) => { __polys.push({ fill: __style.fill, stroke: __style.stroke, weight: __style.weight, join: __style.join, n: __cur.length }); __cur = null; };
  var CLOSE = 'close';`;
const K0 = [[1, 5], [2, 8], [3, 7], [4, 6], [1, 9]], K1 = [[1, 9], [2, 6], [4, 8], [5, 9], [3, 7]];
function mk(o) {
  o = Object.assign({ stroke: true, morph: true, net: null, files: undefined }, o);
  const files = Object.assign({}, process.env.FACES_JS ? { 'core/faces.js': process.env.FACES_JS } : {}, o.files);   // FACES_JS: a sabotage copy of core/faces.js (the static path)
  const w = makeRenderWorld('square', 3, 3, 'rotation_reflection3', files);
  w.set(STUB(o.stroke));
  w.baseConnections(K0);
  const ids = [K0, K1].map((k) => w.addKeyframeLayer(k));
  ids.forEach((i) => w.set(`additionalLayers[${i}].showFaces = ${o.morph};`));
  w.setTimeline(ids);
  if (o.net) w.set(`baseNetTransform = ${J(o.net)};`);
  if (!o.morph) w.set('showFaces = true;');
  w.setMorph({ enabled: o.morph, mode: 'linear', angleDeg: 0 });
  return w;
}
const polys = (w) => w.get('__polys');
const FIELD = { x: { kind: 'trig', w: 0.3 }, y: 'same', repeat: false, domain: 'field' };

// ---- 1. helper -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const w = mk({});
  const T = [['#336699', true], ['#369', true], ['#336699ff', true], ['#336699FF', true], ['#336699cc', false], ['#369f', true], ['#369c', false], ['rgb(10, 20, 30)', true], ['rgb(10 20 30)', true], ['rgb(10 20 30 / 50%)', false], ['rgb(10 20 30 / 1)', true],
    ['rgba(10, 20, 30, 1)', true], ['rgba(10,20,30,0.65)', false], ['rgba(10,20,30,100%)', true], ['rgba(10,20,30,50%)', false], ['hsl(0, 0%, 40%)', true], ['hsl(120 50% 50%)', true], ['hsla(0, 0%, 40%, 1)', true], ['hsla(0, 0%, 40%, 0.65)', false],
    ['red', false], ['', false], ['rgb(1,2)', false], ['rgba(1,2,3,x)', false], ['#12', false], ['#gggggg', false], [null, false], [undefined, false], [{ r: 1 }, false], [123, false]];
  const bad = T.filter(([c, ok]) => w.run(`spatialMorphRenderFillOpaque(${J(c)})`) !== ok).map((x) => J(x[0]));
  check(`1. alpha helper: ${T.length} formats (hex 3/4/6/8, rgb, rgba, hsl, hsla, alpha 1 and < 1, unknown, unparsable, non-strings)`, bad.length === 0, bad.join(' | '));
  const sw = w.get('spatialMorphSeamWidth');
  check('1b. the width is the named constant spatialMorphSeamWidth, 0.5 <= width <= 0.75 (0.6)', sw >= 0.5 && sw <= 0.75 && sw === 0.6, sw);
}
// ---- 2. a morph frame ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
for (const net of [null, FIELD]) {
  const w = mk({ net }); w.set('timeline.elapsedMs = 1000; timeline.currentFrame = { segmentIndex: 0, localT: 0.5 }; __polys.length = 0; drawTessellation();');
  const P = polys(w), sw = w.get('spatialMorphSeamWidth');
  const ok = P.length > 100 && P.every((q) => q.stroke === q.fill && q.weight === sw && q.join === 'round' && /^#[0-9a-f]{6}$/i.test(q.fill));
  check(`2. morph frame${net ? ' under a Field net' : ''}: ${P.length} polygons, each with the contour in its OWN colour, width ${sw}, round joins`, ok, J(P.find((q) => !(q.stroke === q.fill && q.weight === sw && q.join === 'round'))));
  check('2b. the p5 style stack is back (depth 0) and the ambient stroke is as before the frame', w.get('__depth') === 0 && w.status().code === (net ? 'netActive' : 'ok'));
}
{
  const w = mk({});
  const res = { nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 10, y: 0 }, { id: 3, x: 10, y: 10 }], faces: [0, 1, 2, 3].map(() => ({ nodeIds: [1, 2, 3], color: '#101010' })) };
  w.set('__style = { fill: "F0", stroke: "S0", weight: 7, join: "miter" }; __throwAt = 5; __v = 0;');
  let threw = false; try { w.run(`spatialMorphRenderFillFaces(${J(res)}, { c: { x: 0, y: 0 }, flip: false, rot: 0 }, null, null)`); } catch (e) { threw = true; }
  check('2c. a vertex call that throws inside spatialMorphRenderFillFaces: the exception passes, the style stack is back (depth 0), the style is as before the call', threw && w.get('__depth') === 0 && J(w.get('__style')) === J({ fill: 'F0', stroke: 'S0', weight: 7, join: 'miter' }), J(w.get('__style')) + ' depth ' + w.get('__depth'));
}
// ---- 3. translucent and unknown ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const w = mk({});
  const res = { nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 10, y: 0 }, { id: 3, x: 10, y: 10 }, { id: 4, x: 0, y: 10 }], faces: [0, 1, 2, 3, 4, 5].map(() => ({ nodeIds: [1, 2, 3], color: '#101010' })) };
  const colors = ['#aa0000', 'rgba(10,20,30,0.65)', '#00aa00', 'hsla(0, 0%, 40%, 0.5)', 'banana', 'hsl(0, 0%, 40%)'];
  w.set('__polys.length = 0;');
  const n = w.run(`spatialMorphRenderFillFaces(${J(res)}, { c: { x: 0, y: 0 }, flip: false, rot: 0 }, null, ${J(colors)})`);
  const P = polys(w);
  check('3. mixed colours: opaque ones (#rrggbb, hsl) have the contour in their colour, rgba < 1, hsla < 1 and an unknown format have none', n === 6 && P.length === 6 && P[0].stroke === '#aa0000' && P[1].stroke === null && P[2].stroke === '#00aa00' && P[3].stroke === null && P[4].stroke === null && P[5].stroke === 'hsl(0, 0%, 40%)', J(P.map((q) => q.stroke)));
  check('3b. no polygon is stroked in a colour other than its fill', P.every((q) => q.stroke === null || q.stroke === q.fill));
}
// ---- 4. no stroke functions ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const w = mk({});
  const res = { nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 10, y: 0 }, { id: 3, x: 10, y: 10 }], faces: [0, 1].map(() => ({ nodeIds: [1, 2, 3], color: '#101010' })) };
  w.set('__polys.length = 0; var __sw = strokeWeight; strokeWeight = undefined;');
  let err = null, n = 0; try { n = w.run(`spatialMorphRenderFillFaces(${J(res)}, { c: { x: 0, y: 0 }, flip: false, rot: 0 }, null, null)`); } catch (e) { err = e.message; }
  w.set('strokeWeight = __sw;');
  const P = polys(w);
  check('4. an environment without strokeWeight: no error, the faces are drawn, no contour (the old drawing)', err === null && n === 2 && P.length === 2 && P.every((q) => q.stroke === null), String(err));
}
// ---- 5. the static path ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const log = (files) => {
    const w = mk({ morph: false, files });
    w.baseConnections(w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map((o) => o.pairs[0]).slice(0, 8)'));
    w.set('__polys.length = 0; __ops.length = 0;');
    const calls = w.drawn(); return { calls, polys: polys(w), ops: w.get('__ops').slice() };
  };
  const a = log(undefined), b = log({ 'core/spatial-morph-render.js': OLD_FILE, 'core/faces.js': path.join(ROOT, 'core', 'faces.js') });
  check('5. static pattern (morph off, base faces on): the whole call log (lines, fills, p5 style ops) is byte-equal to the render file of main before task 096', a.polys.length > 0 && sha(J(a)) === sha(J(b)), a.polys.length + ' polygons');
  check('5b. ...and no polygon of the static path has a contour', a.polys.length > 0 && a.polys.every((q) => q.stroke === null));
}
console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
