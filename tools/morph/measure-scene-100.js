// Task 100: the scene of task 099 for the three shapes: in every cell the cell border and ONE free figure in the middle (a similar copy of the cell: square, triangle, hexagon) in two sizes (1/3 and 2/3 of the cell),
// faces on in both layers; morph (path A) and timeline playback (path B). Counts the figure faces by colour at t = 0, .25, .5, .75, 1: dark (#353535 +- 2 per channel) / bg-coloured (#f2f2f2 +- 2) / other.
//   node tools/morph/measure-scene-100.js table [variant]       exports: build, table
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const SC = require('./measure-scene-099.js');
const STUB = `
  var __polys = [], __cur = null, __style = { fill: null, stroke: 'S' }, __stack = [];
  push = () => { __stack.push(JSON.stringify(__style)); }; pop = () => { __style = JSON.parse(__stack.pop()); };
  noStroke = () => { }; stroke = () => { }; noFill = () => { }; fill = (c) => { __style.fill = c; };
  beginShape = () => { __cur = []; }; vertex = (x, y) => { __cur.push([x, y]); };
  endShape = () => { __polys.push({ f: __style.fill, p: __cur }); __cur = null; };
  var CLOSE = 'close';`;
// the grid order in which the figure's corners (centroid + s (corner - centroid), s = 1/3 and 2/3) are all nodes, found by looking
const ORDERS = {};
function discover(shape) {
  if (ORDERS[shape]) return ORDERS[shape];
  for (let order = 2; order <= 14; order++) {
    const w = makeRenderWorld(shape, order, 5, 'rotation_reflection6');
    const oc = w.get('outerCorners.map((p) => [p.x, p.y])'), c = w.get('[centroid.x, centroid.y]'), nodes = w.get('nodes.map((n) => [n.id, n.x, n.y])');
    const idAt = (x, y) => { const n = nodes.find((q) => Math.abs(q[1] - x) < 1e-6 && Math.abs(q[2] - y) < 1e-6); return n ? n[0] : null; };
    const fig = (s) => oc.map((p) => idAt(c[0] + s * (p[0] - c[0]), c[1] + s * (p[1] - c[1])));
    const f1 = fig(1 / 3), f2 = fig(2 / 3), border = oc.map((p) => idAt(p[0], p[1]));
    if (f1.every((x) => x !== null) && f2.every((x) => x !== null) && border.every((x) => x !== null)) return (ORDERS[shape] = { order, border, f1, f2 });
  }
  throw new Error('no order for ' + shape);
}
function build(shape, mode, o) {
  o = Object.assign({ files: undefined, sym: 'rotation_reflection6', size: 5 }, o);
  const d = discover(shape), K = [[[d.border[0], d.border[1]], [d.f1[0], d.f1[1]]], [[d.border[0], d.border[1]], [d.f2[0], d.f2[1]]]];
  const w = makeRenderWorld(shape, d.order, o.size, o.sym, o.files);
  w.set(STUB);
  if (mode === 'morph') {
    w.baseConnections(K[0]); const L = K.map((k) => w.addKeyframeLayer(k)); L.forEach((i) => w.set(`additionalLayers[${i}].showFaces = true;`));
    w.setTimeline(L); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  } else {
    w.baseConnections([]); const L = K.map((k) => w.addKeyframeLayer(k)); L.forEach((i) => w.set(`additionalLayers[${i}].showFaces = true;`));
    S.addLayer(w.ctx, { shape, order: d.order, size: o.size, mode: o.sym, connections: [], playback: true, enabled: true });
    const pb = w.get('additionalLayers.length - 1'); w.set(`additionalLayers[${pb}].showFaces = true;`);
    w.setTimeline(L, { playbackLayerIndex: pb }); w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 });
  }
  K.forEach((_, i) => w.set(`computeCellFaces(additionalLayers[${i}].connections, additionalLayers[${i}].nodes, faceAssignmentsFor(${i}), null, faceSheetOverrideOfLayer(additionalLayers[${i}]));`));   // the layers were shown before: their face stores are filled
  w.mode = mode; w.shape = shape; w.cellArea = w.get('(function () { const p = outerCorners; let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i].x * q.y - q.x * p[i].y; } return Math.abs(a) / 2; })()');
  return w;
}
function frameAt(w, t) {
  w.set(`timeline.elapsedMs = ${t} * 2000; timeline.currentFrame = { segmentIndex: 0, localT: ${t} }; __polys.length = 0;` + (w.mode === 'anim' ? ' applyTimelineFrame();' : '') + ' drawTessellation();');
  return w.get('__polys');
}
const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; };
const near = (rgb, v) => rgb && rgb.every((c) => Math.abs(c - v) <= 2);
function classify(polys, cellArea) {
  const c = { dark: 0, bg: 0, other: 0 };
  polys.filter((q) => area(q.p) < 0.9 * cellArea).forEach((q) => { const rgb = SC.hexRgb(q.f); if (near(rgb, 0x35)) c.dark++; else if (near(rgb, 0xf2)) c.bg++; else c.other++; });
  return c;
}
const TS = [0, 0.25, 0.5, 0.75, 1];
function table(shape, files) {
  const out = {};
  for (const mode of ['morph', 'anim']) {
    const w = build(shape, mode, { files }); out[mode] = TS.map((t) => { const polys = frameAt(w, t); const c = classify(polys, w.cellArea); c.n = c.dark + c.bg + c.other; return c; });
  }
  return out;
}
const fmt = (r) => r.map((c) => `${c.dark}/${c.bg}/${c.other}`).join('  ');
module.exports = { build, frameAt, table, classify, discover, fmt, TS };
if (require.main === module && process.argv[2] === 'table') {
  const variant = process.argv[3] || 'base', files = SC.protoFiles(variant), res = {};
  for (const shape of ['square', 'triangle', 'hex']) { const r = table(shape, files); res[shape] = r; console.log(shape.padEnd(9), variant.padEnd(8), 'morph (dark/bg/other at t 0,.25,.5,.75,1):', fmt(r.morph), '| anim:', fmt(r.anim)); }
  if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(res));
}
