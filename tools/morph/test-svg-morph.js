/**
 * tools/morph/test-svg-morph.js
 * Task 036: the SVG export draws the spatial morph frame of the current progress (core/spatial-morph-render.js spatialMorphTryDraw no longer stops at svgPathCollector) and the face-polygon collector of
 * core/export.js no longer triggers the p5 warning "You just changed the value of ... which was a p5 function".
 *
 *   node tools/morph/test-svg-morph.js
 *   SVGMORPH_SABOTAGE=abort|status|t|restore node tools/morph/test-svg-morph.js     (sabotage runs on temp copies of the core files; the repo files are never written)
 *
 *  1. Morph on, t = 0 / 0.25 / 0.5 / 1, linear and radial, coloured keyframes: SVG path coordinates = the line() calls of the live morph frame (canvas stand-ins), polygon count, fill hex, vertex count, area
 *     and order = the fill / beginShape / vertex / endShape calls; line weight (slider) and lines off (024) act. Plus a case with an active net field (activeNetWarp.field set during the frame): the SVG coordinates
 *     are the WARPED frame's (and differ from the same morph without the net). Not exported, known gap (own task): the net overlay lines (drawNetLinesOverlay).
 *  2. Morph off, keyframes without morph, and a morph whose pre-condition fails (normal frame): the SVG is byte-identical to the tree before (git show BASE of both files).
 *  3. The export draws nothing on the live canvas (0 drawing calls on the stand-ins) and leaves the morph status, the frame counter and the face statistics as they were.
 *  4. No p5 warning: with a stand-in of p5's guard (accessor properties whose setter counts the warning) the new export makes 0 warnings (the old one made some); the original accessors are back after the
 *     export, also after an exception; a world without the five names gets its absence back.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const SAB = process.env.SVGMORPH_SABOTAGE || '';
const { makeRenderWorld } = require('./render-harness.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('uncaughtException', (e) => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });
const J = (x) => JSON.stringify(x);
const BASE = '8ad40398';   // main before task 036

// ---- file copies (old tree, sabotage) -----------------------------------------------------------------------------------------------------------------------------------------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'svgmorph-'));
const gitShow = (rel) => execSync(`git show ${BASE}:${rel}`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
const mustReplace = (s, a, b) => { if (!s.includes(a)) throw new Error('sabotage anchor missing: ' + a); return s.replace(a, b); };
const tmpFile = (name, src) => { const p = path.join(TMP, name); fs.writeFileSync(p, src); return p; };
const OLD = { 'core/export.js': tmpFile('old-export.js', gitShow('core/export.js')), 'core/spatial-morph-render.js': tmpFile('old-render.js', gitShow('core/spatial-morph-render.js')) };
let NEW = {};
{
    let ex = fs.readFileSync(path.join(ROOT, 'core/export.js'), 'utf8'), rd = fs.readFileSync(path.join(ROOT, 'core/spatial-morph-render.js'), 'utf8');
    if (SAB === 'abort') rd = mustReplace(rd, "    try {\n        if (typeof tileFor !== 'function'", "    if (exporting) return false;\n    try {\n        if (typeof tileFor !== 'function'");
    if (SAB === 'status') rd = mustReplace(rd, 'if (keep) { rs.status = keep.status; rs.frames = keep.frames; rs.faceStats = keep.faceStats; }', '');
    if (SAB === 't') rd = mustReplace(rd, 'return spatialMorphRenderDraw(sm);', 'if (exporting && timeline) timeline.elapsedMs = 0; return spatialMorphRenderDraw(sm);');
    if (SAB === 'restore') ex = mustReplace(ex, 'if (orig[i]) put(n, orig[i]); else delete g[n];', '');
    NEW = { 'core/export.js': tmpFile('new-export.js', ex), 'core/spatial-morph-render.js': tmpFile('new-render.js', rd) };
}
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignore */ } });

// ---- world -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const K0 = [[1, 5], [2, 8], [3, 7], [4, 6], [1, 9]], K1 = [[1, 9], [2, 6], [4, 8], [5, 9], [3, 7]];
const FIELD = { x: { kind: 'trig', w: 0.3 }, y: 'same', repeat: false, domain: 'field' };
const DRAWFN = ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'ellipse', 'rect', 'line', 'bezier'];
// colours a keyframe layer: one assignment per face of its cell, a hue each (as tools/morph/test-spatial-morph-color.js)
const COLOR = (layer, hue0) => `(function () {
  const L = additionalLayers[${layer}], sh = faceSheetOverrideOfLayer(L);
  const border = sh.outerCorners.map((p, k) => ({ id: -1000001 - k, x: p.x, y: p.y, free: true }));
  const conns = L.connections.map((c) => c.slice()); border.forEach((n, k) => conns.push([n.id, border[(k + 1) % border.length].id]));
  const res = computeCellFaces(conns, L.nodes.concat(border), null, null, sh);
  const keys = computeFaceTrailKeys(res, sheetGroupElements(L.nodes, sh));
  L.faceAssignments = new Map();
  keys.forEach((k, i) => { if (k) setFaceAssignment(L.faceAssignments, k, { hue: (${hue0} + i) % 24, w: 0.2, s: 0.3, rule: 'test', params: null }); });
})()`;

function mk(files, o) {
    o = Object.assign({ net: null, mode: 'linear', colored: true, morph: true, K: [K0, K1] }, o);
    const w = makeRenderWorld(o.shape || 'square', 3, 3, 'none', { 'core/spatial-morph-render.js': files['core/spatial-morph-render.js'] });
    const sb = w.sb;
    w.run(fs.readFileSync(files['core/export.js'], 'utf8'));   // the export under test replaces the loaded one
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.lineColor = '#000000';
    sb.__canvas = [];
    ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect'].forEach((n) => { sb[n] = (...a) => sb.__canvas.push([n, ...a]); });
    sb.CLOSE = 'close';
    w.baseConnections(o.K[0] || K0);
    const ids = o.K.map((k) => w.addKeyframeLayer(k));
    ids.forEach((i) => w.set(`additionalLayers[${i}].showFaces = true;`));
    w.set('showFaces = true;');
    if (ids.length >= 2) w.setTimeline(ids);
    if (o.net) w.set(`baseNetTransform = ${J(o.net)};`);
    if (o.colored) ids.forEach((i, n) => w.run(COLOR(i, n === 0 ? 0 : 12)));
    w.setMorph({ enabled: o.morph, mode: o.mode, angleDeg: o.mode === 'radial' ? 30 : 0 });
    w.at = (t) => w.set(`timeline.elapsedMs = ${t * 2000};`);
    w.svg = () => w.get('generateSVGString()');
    return w;
}
// the live frame: the line() / bezier() calls and the polygons (fill state at endShape), as the canvas gets them
function liveFrame(w) {
    const sb = w.sb; sb.__canvas.length = 0; sb.__calls.length = 0;
    w.run('drawTessellation()');
    const polys = []; let f = null, cur = null;
    sb.__canvas.forEach((c) => {
        if (c[0] === 'fill') f = c[1]; else if (c[0] === 'noFill') f = null; else if (c[0] === 'beginShape') cur = []; else if (c[0] === 'vertex') cur.push([c[1], c[2]]);
        else if (c[0] === 'endShape') { if (f !== null) polys.push({ fill: f, pts: cur }); cur = null; }
    });
    const lines = sb.__calls.slice();
    sb.__canvas.length = 0; sb.__calls.length = 0;
    return { lines, polys };
}
const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
const svgPolys = (svg) => [...svg.matchAll(/<polygon points="([^"]*)" fill="([^"]*)"(?: fill-opacity="([^"]*)")?/g)].map((m) => ({ pts: m[1].split(' ').map((p) => p.split(',').map(Number)), hex: m[2] }));
const svgPaths = (svg) => [...svg.matchAll(/<path d="([^"]*)"/g)].map((m) => m[1].match(/-?\d+(?:\.\d+)?/g).map(Number));
const hexOf = (w, c) => w.get(`_svgColorSpec(${J(c)})`).hex;

// ---- 1. the morph frame in the SVG ------------------------------------------------------------------------------------------------------------------------------------------------------------
function compare(label, w) {
    const live = liveFrame(w), svg = w.svg(), paths = svgPaths(svg), polys = svgPolys(svg);
    let lineOk = live.lines.length > 0 && live.lines.length === paths.length, coordOk = lineOk, maxd = 0;
    if (lineOk) live.lines.forEach((c, i) => {
        const a = c.slice(1), p = paths[i];
        const ends = c[0] === 'line' ? a : [a[0], a[1], a[a.length - 2], a[a.length - 1]];
        const got = c[0] === 'line' ? p : [p[0], p[1], p[p.length - 2], p[p.length - 1]];
        if (ends.length !== got.length) { coordOk = false; return; }
        ends.forEach((v, k) => { const d = Math.abs(v - got[k]); maxd = Math.max(maxd, d); if (d > 0.0051) coordOk = false; });
    });
    let polyOk = live.polys.length > 0 && live.polys.length === polys.length, hexOk = polyOk, shapeOk = polyOk;
    if (polyOk) live.polys.forEach((r, i) => {
        const s = polys[i];
        if (s.hex !== hexOf(w, r.fill)) hexOk = false;
        if (s.pts.length !== r.pts.length || Math.abs(area(s.pts) - area(r.pts)) > 0.5 + 2e-3 * area(r.pts)) shapeOk = false;
    });
    check(`${label}: ${live.lines.length} lines = ${paths.length} paths, coordinates equal the frame's line calls (max ${maxd.toFixed(4)})`, lineOk && coordOk);
    check(`${label}: ${live.polys.length} polygons = ${polys.length}, fill hex in drawing order`, polyOk && hexOk, new Set(polys.map((p) => p.hex)).size + ' hex');
    check(`${label}: vertex count and area of every polygon equal the frame's`, polyOk && shapeOk);
    return { svg, live };
}
console.log('== 1. morph on: the SVG is the frame of the current t ==');
const seen = new Set();
for (const mode of ['linear', 'radial']) {
    for (const t of [0, 0.25, 0.5, 1]) {
        const w = mk(NEW, { mode, net: FIELD }); w.at(t);
        const r = compare(`${mode} t=${t} (coloured)`, w);
        seen.add(r.svg);
        if (t === 0.5 && mode === 'linear') check('the morph frame had faces (more than one fill hex in the SVG)', new Set(svgPolys(r.svg).map((p) => p.hex)).size > 1);
    }
}
check('the SVGs of the four progress values differ (t is honoured; linear and radial together)', seen.size >= 6, seen.size + ' distinct of 8');
{   // without a net: faces and lines too
    const w = mk(NEW, {}); w.at(0.5); compare('no net, linear t=0.5', w);
}
{   // the active net field: the frame is warped and the SVG follows
    const w = mk(NEW, { net: FIELD }); w.at(0.5);
    w.set('let __fieldSeen = 0, __warpSeen = 0; { const o = drawCurvedBezier; drawCurvedBezier = function () { if (activeNetWarp) { __warpSeen++; if (activeNetWarp.field) __fieldSeen++; } return o.apply(this, arguments); }; }');
    const r = compare('net field, linear t=0.5', w);
    const seenField = w.get('__fieldSeen'), seenWarp = w.get('__warpSeen');
    const plain = mk(NEW, {}); plain.at(0.5);
    check('during the morph frame activeNetWarp.field is set (the lines were warped), status netActive', seenField > 0 && seenField === seenWarp && w.status().code === 'netActive', seenField + '/' + seenWarp);
    check('the net-field SVG differs from the same morph without the net (coordinates and polygons are the warped ones)', r.svg !== plain.svg() && J(svgPaths(r.svg)) !== J(svgPaths(plain.svg())));
    const w2 = mk(NEW, { net: FIELD, mode: 'radial' }); w2.at(0.25); compare('net field, radial t=0.25', w2);
}
{   // lines off (024) and the line weight
    const w = mk(NEW, { net: FIELD }); w.at(0.5);
    const on = w.svg();
    w.run('lineStyle = { visible: false, weight: 2 };');
    const off = w.svg();
    check('lines off: the morph polygons stay, no <path>, no line group', svgPolys(off).length === svgPolys(on).length && svgPolys(off).length > 0 && !/<path/.test(off) && !/<g stroke="#000000"/.test(off));
    w.run('lineStyle = { visible: true, weight: 5 };');
    const w5 = w.svg();
    check('line weight follows the slider (5), the morph paths are the same', /<g stroke="#000000" stroke-width="5" fill="none">/.test(w5) && J(svgPaths(w5)) === J(svgPaths(on)));
}

// ---- 2. no morph: byte-identical to the tree before ---------------------------------------------------------------------------------------------------------------------------------------
console.log('== 2. morph off / keyframes without morph: byte-identical to the tree before ==');
for (const [label, o] of [['morph off, keyframes and timeline present', { morph: false }], ['morph off, net field', { morph: false, net: FIELD }], ['morph off, hex', { morph: false, shape: 'hex' }]]) {
    const a = mk(OLD, o), b = mk(NEW, o); a.at(0.5); b.at(0.5);
    const sa = a.svg(), sb2 = b.svg();
    check(`${label}: SVG equals the old tree's (${sa.length} bytes)`, sa === sb2 && /<path/.test(sb2));
}
{   // keyframes only as layers, no timeline, morph never switched on
    const mkNo = (files) => { const w = makeRenderWorld('square', 3, 3, 'none', { 'core/spatial-morph-render.js': files['core/spatial-morph-render.js'] }); w.run(fs.readFileSync(files['core/export.js'], 'utf8')); const sb = w.sb; sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.lineColor = '#000000'; w.baseConnections(K0); w.addKeyframeLayer(K1); w.run('showFaces = true;'); return w; };
    const sa = mkNo(OLD).get('generateSVGString()'), sb2 = mkNo(NEW).get('generateSVGString()');
    check('keyframe layer without timeline and without morph: identical', sa === sb2);
}
{   // morph on but the pre-condition fails (one keyframe): the normal frame, as before
    const o = { K: [], colored: false };   // the base and ONE layer would still morph; with none the plan says needsTwoKeyframes
    const a = mk(OLD, o), b = mk(NEW, o);
    const sa = a.svg(), sb2 = b.svg();
    b.run('drawTessellation()');
    check('morph on, pre-condition fails (needsTwoKeyframes): the normal frame, SVG identical to the old one', sa === sb2 && b.status().code === 'needsTwoKeyframes' && /<path/.test(sb2), J({ same: sa === sb2, code: b.status().code, la: sa.length, lb: sb2.length }));
}

// ---- 3. no canvas drawing, status untouched -----------------------------------------------------------------------------------------------------------------------------------------------
console.log('== 3. the export does not draw and does not change the status ==');
for (const mode of ['linear', 'radial']) {
    const w = mk(NEW, { mode, net: FIELD }); w.at(0.5); w.run('drawTessellation()');   // a live frame first: the status is 'netActive'
    const st0 = J(w.status()), fr0 = w.get('spatialMorphRenderState.frames'), fs0 = J(w.get('spatialMorphRenderState.faceStats'));
    w.sb.__canvas.length = 0; w.sb.__calls.length = 0;
    const svg = w.svg();
    const drawn = w.sb.__canvas.filter((c) => DRAWFN.includes(c[0])).length + w.sb.__calls.length;
    check(`${mode}: the export made 0 drawing calls on the canvas stand-ins (and the SVG has ${svgPaths(svg).length} paths)`, drawn === 0 && svgPaths(svg).length > 0, drawn);
    check(`${mode}: status, frame counter and face statistics are the same before and after (${JSON.parse(st0).code})`, J(w.status()) === st0 && w.get('spatialMorphRenderState.frames') === fr0 && J(w.get('spatialMorphRenderState.faceStats')) === fs0);
}
{   // a status that is NOT what the export would write: 'off' before (never drawn), still 'off' after, though the SVG is a morph frame
    const w = mk(NEW, {}); w.at(0.5);
    const st0 = J(w.status()); w.svg();
    check('never drawn live (status off): after the export still off, frames 0', J(w.status()) === st0 && w.status().code === 'off' && w.get('spatialMorphRenderState.frames') === 0);
}
{   // exception during the export: status restored too, collector reset
    const w = mk(NEW, { net: FIELD }); w.at(0.5); w.run('drawTessellation()');
    const st0 = J(w.status());
    w.set('const __ob = drawCurvedBezier; drawCurvedBezier = function () { throw new Error("boom"); };');
    const r = w.svg(); void r;
    check('drawCurvedBezier throws inside the morph export: status unchanged (the morph swallows it), svgPathCollector reset', J(w.status()) === st0 && w.get('svgPathCollector') === null);
}

// ---- 4. no p5 warning ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== 4. no p5 warning, restoration ==');
const NAMES = ['fill', 'noFill', 'beginShape', 'vertex', 'endShape'];
// p5 global mode (stand-in): each function is an accessor property; assigning calls the setter, which warns
function p5Guard(w) {
    const sb = w.sb; sb.__warn = 0; sb.__orig = {};
    NAMES.forEach((n) => {
        const fn = (...a) => sb.__canvas.push([n, ...a]); sb.__orig[n] = { get: () => fn, set: () => { sb.__warn++; }, configurable: true, enumerable: true };
        delete sb[n]; Object.defineProperty(sb, n, sb.__orig[n]);
    });
    return NAMES.map((n) => Object.getOwnPropertyDescriptor(sb, n));
}
{
    const wOld = mk(OLD, { morph: false }); p5Guard(wOld); wOld.svg();
    check('stand-in is faithful: the OLD export (assignments) triggers the warning', wOld.sb.__warn >= NAMES.length * 2, wOld.sb.__warn);
    const w = mk(NEW, { net: FIELD }); w.at(0.5); const before = p5Guard(w);
    w.svg();
    check('the NEW export triggers 0 warnings (also with the morph and its faces)', w.sb.__warn === 0, w.sb.__warn);
    const after = NAMES.map((n) => Object.getOwnPropertyDescriptor(w.sb, n));
    check('after the export the five original accessors are back (same get / set)', after.every((d, i) => d && d.get === before[i].get && d.set === before[i].set));
    w.set('var __o = drawFaceFillsAtTile; drawFaceFillsAtTile = function () { fill("#123456"); throw new Error("boom"); };'); w.set('showFaces = true;');
    let thrown = null; try { w.set('spatialMorph.enabled = false;'); w.svg(); } catch (e) { thrown = e; }
    const after2 = NAMES.map((n) => Object.getOwnPropertyDescriptor(w.sb, n));
    check('exception: it propagates, the accessors are back, svgPathCollector is null, still 0 warnings', thrown && /boom/.test(thrown.message) && after2.every((d, i) => d && d.get === before[i].get && d.set === before[i].set) && w.get('svgPathCollector') === null && w.sb.__warn === 0);
}
{   // a world without the five names: absent afterwards
    const w = mk(NEW, { net: FIELD }); w.at(0.5);
    NAMES.forEach((n) => { delete w.sb[n]; });
    const svg = w.svg();
    check('world without fill / noFill / beginShape / vertex / endShape: the export runs (paths and polygons) and the names are absent again', svgPaths(svg).length > 0 && svgPolys(svg).length > 0 && NAMES.every((n) => !Object.prototype.hasOwnProperty.call(w.sb, n)));
}
{   // source check: no plain assignment to the p5 names in the collector
    const src = fs.readFileSync(path.join(ROOT, 'core/export.js'), 'utf8'), fn = src.slice(src.indexOf('function _svgCollectFacePolygons'), src.indexOf('function generateSVGString'));
    check('source: _svgCollectFacePolygons assigns no p5 name directly (defineProperty only)', !/\bg\[n\]\s*=[^=]/.test(fn.replace(/catch \(e\) \{ g\[n\] = [^}]*\}/, '')) && /Object\.defineProperty/.test(fn));
}

console.log(`\n${checks - failures}/${checks} checks passed${SAB ? '  (sabotage: ' + SAB + ')' : ''}`);
process.exit(failures ? 1 : 0);
