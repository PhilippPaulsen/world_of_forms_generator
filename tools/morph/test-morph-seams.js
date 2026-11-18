// Task 096: the seams of the spatial morph's face fills: the DRAWING of an opaque fill is its face grown by 0.3 px (core/spatial-morph-render.js spatialMorphRenderGrow, spatialMorphRenderFillFaces, spatialMorphRenderFillOpaque).
//   1. the alpha helper (#rrggbb, #rgb, #rrggbbaa, rgb(), rgba(), hsl(), hsla(), alpha 1 and < 1, unknown / unparsable / non-strings: NOT opaque) and the named constants
//   2. spatialMorphRenderGrow as a pure function: offset, miter limit, orientation, splitters / degenerate polygons unchanged, input not touched
//   3. a morph frame: every drawn polygon is its exact face moved outwards by at most offset x miter limit (same count, order, fill, vertex count); no contour (stroke) at all; the p5 style is back, also after an exception
//   4. translucent fills, unknown formats and splitters are drawn exactly (not grown), opaque neighbours grown
//   5. nothing in the DATA is grown: the face result is byte-equal before and after the draw, and the SVG export (svgPathCollector set) draws the exact faces: generateSVGString byte-equal to main before this task (d7271e2b)
//   6. the STATIC path (drawFaceFillsAtTile, morph off) is unchanged: the whole call log is byte-equal to main before this task
//   node tools/morph/test-morph-seams.js        sabotage runs: SPATIAL_MORPH_RENDER_JS=/copy.js, FACES_JS=/copy.js (static path)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
const { seamRule, SEAM_MAX, OFFSET, MITER } = require('./seam-rule.js');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify, sha = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
const BASE = 'd7271e2b';
const OLD_FILE = path.join(os.tmpdir(), `smr096-${process.pid}.js`);
fs.writeFileSync(OLD_FILE, execSync(`git show ${BASE}:core/spatial-morph-render.js`, { cwd: ROOT, maxBuffer: 1 << 26 }));
process.on('exit', () => { try { fs.unlinkSync(OLD_FILE); } catch (e) { } });
const STUB = `
  var __polys = [], __cur = null, __style = { fill: null, stroke: null }, __stack = [], __depth = 0, __throwAt = 0, __v = 0, __ops = [];
  push = () => { __stack.push(JSON.stringify(__style)); __depth++; }; pop = () => { __style = JSON.parse(__stack.pop()); __depth--; };
  noStroke = () => { __style.stroke = null; __ops.push('noStroke'); }; noFill = () => { __style.fill = null; }; fill = (c) => { __style.fill = c; __ops.push('fill'); };
  stroke = (c) => { __style.stroke = c; __ops.push('stroke'); };
  beginShape = () => { __cur = []; }; vertex = (x, y) => { __v++; if (__throwAt && __v >= __throwAt) throw new Error('vertex'); __cur.push([x, y]); };
  endShape = (m) => { __polys.push({ fill: __style.fill, stroke: __style.stroke, pts: __cur }); __cur = null; };
  var CLOSE = 'close';`;
const K0 = [[1, 5], [2, 8], [3, 7], [4, 6], [1, 9]], K1 = [[1, 9], [2, 6], [4, 8], [5, 9], [3, 7]];
function mk(o) {
  o = Object.assign({ morph: true, net: null, files: undefined, exact: false }, o);
  const files = Object.assign({}, process.env.FACES_JS ? { 'core/faces.js': process.env.FACES_JS } : {}, o.files);   // FACES_JS: a sabotage copy of core/faces.js (the static path)
  const w = makeRenderWorld('square', 3, 3, 'rotation_reflection3', files);
  w.set(STUB);
  w.baseConnections(K0);
  const ids = [K0, K1].map((k) => w.addKeyframeLayer(k));
  ids.forEach((i) => w.set(`additionalLayers[${i}].showFaces = ${o.morph};`));
  w.setTimeline(ids);
  if (o.net) w.set(`baseNetTransform = ${J(o.net)};`);
  if (!o.morph) w.set('showFaces = true;');
  w.setMorph({ enabled: o.morph, mode: 'linear', angleDeg: 0 });
  if (o.exact) w.set('spatialMorphRenderGrow = (p) => p;');
  return w;
}
const polys = (w) => w.get('__polys');
const FIELD = { x: { kind: 'trig', w: 0.3 }, y: 'same', repeat: false, domain: 'field' };
const frame = (w) => { w.set('timeline.elapsedMs = 1000; timeline.currentFrame = { segmentIndex: 0, localT: 0.5 }; __polys.length = 0; drawTessellation();'); return polys(w); };
const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i].x * q.y - q.x * p[i].y; } return a / 2; };

// ---- 1. helper and constants -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const w = mk({});
  const T = [['#336699', true], ['#369', true], ['#336699ff', true], ['#336699FF', true], ['#336699cc', false], ['#369f', true], ['#369c', false], ['rgb(10, 20, 30)', true], ['rgb(10 20 30)', true], ['rgb(10 20 30 / 50%)', false], ['rgb(10 20 30 / 1)', true],
    ['rgba(10, 20, 30, 1)', true], ['rgba(10,20,30,0.65)', false], ['rgba(10,20,30,100%)', true], ['rgba(10,20,30,50%)', false], ['hsl(0, 0%, 40%)', true], ['hsl(120 50% 50%)', true], ['hsla(0, 0%, 40%, 1)', true], ['hsla(0, 0%, 40%, 0.65)', false],
    ['red', false], ['', false], ['rgb(1,2)', false], ['rgba(1,2,3,x)', false], ['#12', false], ['#gggggg', false], ['#12345', false], [null, false], [undefined, false], [{ r: 1 }, false], [123, false]];
  const bad = T.filter(([c, ok]) => w.run(`spatialMorphRenderFillOpaque(${J(c)})`) !== ok).map((x) => J(x[0]));
  check(`1. alpha helper: ${T.length} formats (hex 3/4/6/8, rgb, rgba, hsl, hsla, alpha 1 and < 1, unknown, unparsable, non-strings)`, bad.length === 0, bad.join(' | '));
  const c = w.get('[spatialMorphSeamWidth, spatialMorphSeamMiterLimit, spatialMorphSeamMinArea]');
  check('1b. named constants: width 0.6 (offset 0.3 per side), miter limit 1.6 (a vertex moves at most 0.48 px), splitters below 1 px2 are not grown', c[0] === OFFSET * 2 && c[1] === MITER && c[2] === 1, J(c));
}
// ---- 2. the grow function --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const w = mk({});
  const grow = (pts, d) => w.run(`spatialMorphRenderGrow(${J(pts)}, ${d === undefined ? OFFSET : d})`);
  const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], sqr = sq.slice().reverse();
  const a = grow(sq), b = grow(sqr);
  check('2a. a 10 x 10 square: every corner moves by 0.3 x sqrt 2 = 0.424 along the diagonal, outwards, the area is 10.6 squared; same for the other orientation', a.length === 4 && a.every((p, i) => Math.abs(p.x - (sq[i].x === 0 ? -OFFSET : 10 + OFFSET)) < 1e-9 && Math.abs(p.y - (sq[i].y === 0 ? -OFFSET : 10 + OFFSET)) < 1e-9) && Math.abs(Math.abs(area(a)) - 10.6 * 10.6) < 1e-9 && Math.abs(Math.abs(area(b)) - 10.6 * 10.6) < 1e-9, J(a));
  // a sharp corner (10 degrees): the miter would be 0.3 / sin(5 deg) = 3.4 px; it is cut at 0.48
  const tip = [{ x: 0, y: 0 }, { x: 100, y: 17.6327 }, { x: 100, y: -17.6327 }], g = grow(tip);
  const moves = g.map((p, i) => Math.hypot(p.x - tip[i].x, p.y - tip[i].y));
  check('2b. a 10 degree corner: no vertex moves more than offset x miter limit (0.48 px), no spike', moves.every((m) => m <= SEAM_MAX + 1e-9) && moves[0] > 0.2, J(moves));
  const thin = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 0.02 }, { x: 0, y: 0.02 }];
  check('2c. a splitter (area 0.8 px2 < 1) and a polygon with a zero area are returned unchanged (the same points)', J(grow(thin)) === J(thin) && J(grow([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }])) === J([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }]));
  check('2d. fewer than 3 points, d = 0 or a negative d: unchanged', J(grow([{ x: 1, y: 1 }, { x: 2, y: 2 }])) === J([{ x: 1, y: 1 }, { x: 2, y: 2 }]) && J(grow(sq, 0)) === J(sq) && J(grow(sq, -1)) === J(sq) && J(grow([])) === '[]');
  const dup = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], gd = grow(dup);
  check('2e. a duplicated vertex (zero-length edge): same count, finite, every move within the limit, outwards', gd.length === 5 && gd.every((p, i) => Number.isFinite(p.x) && Number.isFinite(p.y) && Math.hypot(p.x - dup[i].x, p.y - dup[i].y) <= SEAM_MAX + 1e-9) && Math.abs(area(gd)) > 100);
  const input = J(sq); w.run(`(function () { const p = ${input}; spatialMorphRenderGrow(p, ${OFFSET}); globalThis.__after = JSON.stringify(p); })()`);
  check('2f. the input is not touched, the output is a new array of new points', w.get('__after') === input && a !== sq);
}
// ---- 3. a morph frame ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
for (const net of [null, FIELD]) {
  const g = frame(mk({ net })), e = frame(mk({ net, exact: true })), r = seamRule(g, e);
  check(`3. morph frame${net ? ' under a Field net' : ''}: ${g.length} drawn polygons are the exact faces moved outwards by at most ${SEAM_MAX} px (${r.grown} grown, largest move ${r.worst && r.worst.toFixed(3)}), no contour`, g.length > 100 && r.ok && r.grown > g.length * 0.9 && g.every((q) => q.stroke === null), r.why);
}
{
  const w = mk({}); const res = { nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 10, y: 0 }, { id: 3, x: 10, y: 10 }], faces: [0, 1, 2, 3].map(() => ({ nodeIds: [1, 2, 3], color: '#101010' })) };
  w.set('__style = { fill: "F0", stroke: "S0" }; __throwAt = 5; __v = 0;');
  let threw = false; try { w.run(`spatialMorphRenderFillFaces(${J(res)}, { c: { x: 0, y: 0 }, flip: false, rot: 0 }, null, null)`); } catch (e) { threw = true; }
  check('3b. a vertex call that throws: the exception passes, the style stack is back (depth 0) and the style is as before the call', threw && w.get('__depth') === 0 && J(w.get('__style')) === J({ fill: 'F0', stroke: 'S0' }));
  const wf = mk({}); frame(wf);
  check('3c. after a whole frame the style stack is back (depth 0)', wf.get('__depth') === 0 && wf.status().code === 'ok');
}
// ---- 4. translucent, unknown, splitters --------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const w = mk({});
  const big = (k) => ({ nodeIds: [1, 2, 3, 4], color: '#101010', k });
  const res = { nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 10, y: 0 }, { id: 3, x: 10, y: 10 }, { id: 4, x: 0, y: 10 }, { id: 5, x: 20, y: 0 }, { id: 6, x: 60, y: 0 }, { id: 7, x: 60, y: 0.02 }, { id: 8, x: 20, y: 0.02 }],
    faces: [big(0), big(1), big(2), big(3), big(4), big(5), { nodeIds: [5, 6, 7, 8], color: '#101010' }] };
  const colors = ['#aa0000', 'rgba(10,20,30,0.65)', '#00aa00', 'hsla(0, 0%, 40%, 0.5)', 'banana', 'hsl(0, 0%, 40%)', '#0000aa'];
  const draw = (x) => { x.set('__polys.length = 0;'); const n = x.run(`spatialMorphRenderFillFaces(${J(res)}, { c: { x: 0, y: 0 }, flip: false, rot: 0 }, null, ${J(colors)})`); return { n, P: polys(x) }; };
  const { n, P } = draw(w), E = draw(mk({ exact: true })).P;
  const grown = (i) => P[i].pts.some((p, k) => Math.abs(p[0] - E[i].pts[k][0]) > 1e-9 || Math.abs(p[1] - E[i].pts[k][1]) > 1e-9);
  check('4. mixed colours: #rrggbb and hsl() are grown, rgba < 1, hsla < 1 and an unknown format are drawn exactly; a splitter (#0000aa, 0.8 px2) is drawn exactly', n === 7 && P.length === 7 && grown(0) && !grown(1) && grown(2) && !grown(3) && !grown(4) && grown(5) && !grown(6), J([0, 1, 2, 3, 4, 5, 6].map(grown)));
  check('4b. no polygon has a contour', P.every((q) => q.stroke === null));
}
// ---- 5. data and export --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const w = mk({});
  const res = { nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 10, y: 0 }, { id: 3, x: 10, y: 10 }, { id: 4, x: 0, y: 10 }], faces: [{ nodeIds: [1, 2, 3, 4], color: '#101010' }] };
  w.set(`var __res = ${J(res)};`); const before = w.get('JSON.stringify(__res)');
  w.run('spatialMorphRenderFillFaces(__res, { c: { x: 5, y: 5 }, flip: false, rot: 0 }, null, null)');
  check('5. the face result is byte-equal before and after the draw (nothing in the data is grown)', w.get('JSON.stringify(__res)') === before);
  const SVGSTUB = (x) => { const sb = x.sb; sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.lineColor = '#000000'; ['strokeWeight', 'ellipse', 'rect'].forEach((n) => { if (!sb[n]) sb[n] = () => { }; }); };
  for (const net of [null, FIELD]) {
    const a = mk({ net }), b = mk({ net, files: { 'core/spatial-morph-render.js': OLD_FILE } });
    [a, b].forEach((x) => { SVGSTUB(x); x.set('timeline.elapsedMs = 1000; timeline.currentFrame = { segmentIndex: 0, localT: 0.5 };'); });
    const sa = a.get('generateSVGString()'), sb2 = b.get('generateSVGString()');
    check(`5b. SVG export${net ? ' under a Field net' : ''}: byte-equal to main before this task (${sa.length} bytes, ${(sa.match(/<polygon/g) || []).length} polygons: the exact faces)`, typeof sa === 'string' && sa === sb2 && (sa.match(/<polygon/g) || []).length > 50);
    check('5c. ...and a canvas frame afterwards is grown again (the export did not leave the switch off)', (() => { const g = frame(a), e = frame(mk({ net, exact: true })); const r = seamRule(g, e); return r.ok && r.grown > 0; })());
  }
}
// ---- 6. the static path ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
  const log = (files) => {
    const w = mk({ morph: false, files });
    w.baseConnections(w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map((o) => o.pairs[0]).slice(0, 8)'));
    w.set('__polys.length = 0; __ops.length = 0;');
    const calls = w.drawn(); return { calls, polys: polys(w), ops: w.get('__ops').slice() };
  };
  const a = log(undefined), b = log({ 'core/spatial-morph-render.js': OLD_FILE, 'core/faces.js': path.join(ROOT, 'core', 'faces.js') });
  check('6. static pattern (morph off, base faces on): the whole call log (lines, fills, p5 style ops) is byte-equal to the render file of main before this task', a.polys.length > 0 && sha(J(a)) === sha(J(b)), a.polys.length + ' polygons');
  check('6b. ...and no polygon of the static path is grown or has a contour (every one is a face of the pattern)', a.polys.length > 0 && a.polys.every((q) => q.stroke === null));
}
console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
