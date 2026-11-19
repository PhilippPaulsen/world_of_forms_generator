// Task 099 (Typ R, nur messen): the scene of the user's three pictures (reports/logs/099-eingabe/): a square sheet (ordnung 6 = legacy order 7, size 5, rotation_reflection6), in every cell the cell border and ONE free square
// in the middle (layer 1: edge 1/3 of the cell, layer 2: edge 2/3), faces on in both layers. The user's file session.json is a geometry EXPORT (formatVersion 1 or 2: nodes, no connections, no layers, no timeline), so the scene is rebuilt
// from the pictures: border = orbit of the edge 1-7, square 1 = edge 17-19 (nodes (2,2)-(2,4)), square 2 = edge 9-13 ((1,1)-(1,5)).
//   node tools/morph/measure-scene-099.js frames [variant] [outprefix]     both paths at t = 0, .25, .5, .75, 1: pictures and the faces of the cell at t = 0.5
//   exports: build, frameAt, analyse, png
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const STUB = `
  var __polys = [], __cur = null, __style = { fill: null, stroke: 'S' }, __stack = [], __calls = [];
  push = () => { __stack.push(JSON.stringify(__style)); }; pop = () => { __style = JSON.parse(__stack.pop()); };
  noStroke = () => { __style.stroke = null; }; stroke = (c) => { __style.stroke = c; }; noFill = () => { __style.fill = null; };
  fill = (c) => { __style.fill = c; };
  beginShape = () => { __cur = []; }; vertex = (x, y) => { __cur.push([x, y]); };
  endShape = (m) => { __polys.push({ f: __style.fill, p: __cur }); __cur = null; };
  var CLOSE = 'close';
  var __fres = []; { const f = findFaces; findFaces = function () { const r = f.apply(this, arguments); __fres.push(r); return r; }; }`;
const BORDER = [1, 7], SQ1 = [17, 19], SQ2 = [9, 13];
function build(mode, o) {
  o = Object.assign({ files: undefined, K: [[BORDER, SQ1], [BORDER, SQ2]], sym: 'rotation_reflection6', order: 7, size: 5 }, o);   // legacy order 7 = 7 x 7 nodes = ordnung 6 of the export
  const w = makeRenderWorld('square', o.order, o.size, o.sym, o.files);
  w.set(STUB);
  const K = o.K;
  if (mode === 'morph') {
    w.baseConnections(K[0]);
    const L = K.map((k) => w.addKeyframeLayer(k));
    L.forEach((i) => w.set(`additionalLayers[${i}].showFaces = true;`));
    w.setTimeline(L); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  } else {
    w.baseConnections([]);
    const L = K.map((k) => w.addKeyframeLayer(k));
    L.forEach((i) => w.set(`additionalLayers[${i}].showFaces = true;`));
    S.addLayer(w.ctx, { shape: 'square', order: o.order, size: o.size, mode: o.sym, connections: [], playback: true, enabled: true });
    const pb = w.get('additionalLayers.length - 1'); w.set(`additionalLayers[${pb}].showFaces = true;`);
    w.setTimeline(L, { playbackLayerIndex: pb }); w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 });
  }
  // the user's keyframe layers were SHOWN (drawn) before the animation: that fills their face stores with the default grays (dark #353535 for the square); a disabled layer that was never drawn has an empty store
  if (o.populate !== false) K.forEach((_, i) => w.set(`computeCellFaces(additionalLayers[${i}].connections, additionalLayers[${i}].nodes, faceAssignmentsFor(${i}), null, faceSheetOverrideOfLayer(additionalLayers[${i}]));`));
  w.mode = mode; return w;
}
function frameAt(w, t) {
  w.set(`timeline.elapsedMs = ${t} * 2000; timeline.currentFrame = { segmentIndex: 0, localT: ${t} }; __polys.length = 0; __fres.length = 0;` + (w.mode === 'anim' ? ' applyTimelineFrame();' : '') + ' drawTessellation();');
  return w.get('__polys');
}
function crc32(buf) { let c, crc = -1; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ -1) >>> 0; }
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (t, d) => { const b = Buffer.alloc(8 + d.length + 4); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (m) { const v = parseInt(m[1], 16); return [v >> 16, (v >> 8) & 255, v & 255]; } const g = /^hsl\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%\s*\)$/.exec(h || ''); if (g) { const l = Math.round(+g[1] * 2.55); return [l, l, l]; } return [255, 0, 255]; };
// the picture as the painter shows it (background #f2f2f2), the line segments are not drawn here: the faces only
function picture(polys, file) {
  const Wd = 600, img = Buffer.alloc(Wd * Wd * 3); for (let i = 0; i < Wd * Wd; i++) { img[i * 3] = 242; img[i * 3 + 1] = 242; img[i * 3 + 2] = 242; }
  for (const q of polys) {
    const p = q.p; if (p.length < 3) continue; const col = hexRgb(q.f);
    let y0 = Infinity, y1 = -Infinity; for (const v of p) { y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
    for (let y = Math.max(0, Math.ceil(y0 - 0.5)); y <= Math.min(Wd - 1, Math.floor(y1 - 0.5)); y++) {
      const yc = y + 0.5, xs = []; for (let i = 0; i < p.length; i++) { const u = p[i], v = p[(i + 1) % p.length]; if ((u[1] <= yc) !== (v[1] <= yc)) xs.push(u[0] + (yc - u[1]) / (v[1] - u[1]) * (v[0] - u[0])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(Wd - 1, Math.floor(xs[k + 1] - 0.5)); x++) { const o = (y * Wd + x) * 3; img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; }
    }
  }
  fs.writeFileSync(file, png(Wd, Wd, img)); return img;
}
// prototypes of core/facecolor.js in COPIES (OS temp dir), loaded through the harness' core overrides (the repo is not touched)
const os = require('os');
const FC_SRC = fs.readFileSync(path.join(ROOT, 'core', 'facecolor.js'), 'utf8');
const PROTOS = {
  // a sample point belongs to the INNERMOST (smallest) polygon of the field that contains it, not to the first one in the list (the cell face of a pattern with a free square inside is listed first and contains the square)
  inner: (t) => t.replace("if (cell) for (let i = 0; i < cell.length; i++) { const g = cell[i]; if (g.lin && p.x >= g.minX && p.x <= g.maxX && p.y >= g.minY && p.y <= g.maxY && pointInPolygon(p, g.poly)) return g; }\n    return null;",
    "let best = null;\n    if (cell) for (let i = 0; i < cell.length; i++) { const g = cell[i]; if (g.lin && p.x >= g.minX && p.x <= g.maxX && p.y >= g.minY && p.y <= g.maxY && pointInPolygon(p, g.poly) && (best === null || g.a < best.a)) best = g; }\n    return best;"),
};
const PARTNER = (t) => t
  .replace("    let best = -1, bd2 = Infinity;\n    const near2", "    let best = -1, bd2 = Infinity, bestLq = Infinity;\n    const near2")
  .replace("        if (d2 >= bd2) continue;   // only a nearer candidate can replace the best one: the (costly) inclusion tests run for those only, and only when the nearness test fails",
    "        if (d2 > bd2 + 1e-9) continue;   // only a nearer candidate can replace the best one (task 099 prototype: or one at the SAME distance whose area is closer: nested faces share their centroid)\n        if (best >= 0 && d2 >= bd2 - 1e-9 && Math.abs(Math.log(q)) >= bestLq) continue;")
  .replace("        bd2 = d2; best = i;\n    }", "        bd2 = d2; best = i; bestLq = Math.abs(Math.log(q));\n    }");
// partner: only the tie rule of _partnerOf; both: the innermost owner and the tie rule
PROTOS.partner = PARTNER;
PROTOS.both = (t) => PROTOS.inner(PARTNER(t));
const protoFiles = {};
function protoFiles099(v) { if (!v || v === 'base') return undefined; if (!protoFiles[v]) { const out = PROTOS[v](FC_SRC); if (out === FC_SRC) throw new Error('prototype anchor missing: ' + v); const p = path.join(os.tmpdir(), `facecolor099-${process.pid}-${v}.js`); fs.writeFileSync(p, out); protoFiles[v] = p; } return { 'core/facecolor.js': protoFiles[v] }; }
process.on('exit', () => { Object.values(protoFiles).forEach((p) => { try { fs.unlinkSync(p); } catch (e) { } }); });
module.exports = { protoFiles: protoFiles099, build, frameAt, picture, hexRgb, BORDER, SQ1, SQ2 };
if (require.main === module && process.argv[2] === 'frames') {
  const out = process.argv[4] || path.join(ROOT, 'reports', 'logs', '099-');
  const variant = process.argv[3] || 'base';
  for (const mode of ['morph', 'anim']) {
    const w = build(mode, { files: protoFiles099(variant) });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const polys = frameAt(w, t), img = picture(polys, `${out}${variant === 'base' ? '' : variant + '-'}${mode}-t${Math.round(t * 100)}.png`);
      const c = (x, y) => { const o = (y * 600 + x) * 3; return [img[o], img[o + 1], img[o + 2]].join(','); };
      console.log(mode, t, 'status', mode === 'morph' ? w.status().code : 'anim', 'polys', polys.length, 'centre pixel (300,300)', c(300, 300), 'cell border zone (240,300)', c(245, 300));
    }
  }
}
