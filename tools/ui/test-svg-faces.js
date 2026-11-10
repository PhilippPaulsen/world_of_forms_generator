/**
 * tools/ui/test-svg-faces.js
 * Task 035: the SVG export writes the face fills (core/export.js: generateSVGString collects fill/beginShape/vertex/endShape of drawTessellation()).
 *
 *   node tools/ui/test-svg-faces.js
 *   SVGFACES_SABOTAGE=restore|order|off|alpha node tools/ui/test-svg-faces.js     (sabotage runs on in-memory copies of core/export.js; files are never written)
 *
 *  1. Faces off: the SVG is byte-identical to the one of core/export.js before the task (git show BASE).
 *  2. Faces on (plain, with a layer, assigned colours, net field, playback in between): polygon count, fill hex and order equal the fill/beginShape/vertex/endShape calls the canvas path gets;
 *     the polygon area of every one equals the canvas polygon's; fill-opacity equals the alpha of the colour.
 *  3. Layering: background, face group, line group, nodes, frame. Lines off: faces stay, no line group; the line weight follows lineStyle.
 *  4. p5 functions restored after the export, also when drawTessellation() throws; the SVG build calls no canvas drawing function; svgPathCollector is reset after an exception.
 *  5. Colour parser: hex, rgb(a), hsl(a) (alpha -> opacity).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const SAB = process.env.SVGFACES_SABOTAGE || '';
const { makeRenderWorld } = require('../morph/render-harness.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });
const BASE = '1e635820';   // the tree before the task
const oldExport = execSync(`git show ${BASE}:core/export.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
let newExport = fs.readFileSync(path.join(ROOT, 'core/export.js'), 'utf8');
const mustReplace = (s, a, b) => { if (!s.includes(a)) throw new Error('sabotage anchor missing: ' + a); return s.replace(a, b); };
if (SAB === 'restore') newExport = mustReplace(newExport, 'names.forEach((n, i) => { if (had[i]) g[n] = saved[i]; else delete g[n]; });', '');
if (SAB === 'order') {
    // lines before faces: move the face group after the line group
    const a = newExport.indexOf('    // Task 035: face fills between'), b = newExport.indexOf('    // Task 024: lines off');
    const faces = newExport.slice(a, b);
    newExport = newExport.slice(0, a) + newExport.slice(b);
    newExport = mustReplace(newExport, '    if (showNodes) {\n        svg += `  <g fill="#000000">', faces + '    if (showNodes) {\n        svg += `  <g fill="#000000">');
}
if (SAB === 'off') newExport = mustReplace(newExport, 'if (polys.length) {', 'if (true) {');
if (SAB === 'alpha') newExport = mustReplace(newExport, "const op = sp.opacity < 1 ?", "const op = false ?");
const CONNS = [[1, 5], [2, 8], [3, 7]], ALT = [[1, 9], [2, 6], [4, 8]];

function mk(src, o) {
    o = o || {};
    const w = makeRenderWorld(o.shape || 'square', o.order || 3, 3, o.sym || 'rotation_reflection3', {});
    const sb = w.sb;
    w.run(src);
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' });
    sb.lineColor = '#000000';
    // canvas stand-ins: record every call the p5 functions would get
    sb.__canvas = [];
    ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect'].forEach(n => { sb[n] = (...a) => sb.__canvas.push([n, ...a]); });
    sb.CLOSE = 'close';
    if (o.conns) w.baseConnections(o.conns);
    else {   // a dense base: the first orbit representatives of the real orbit table (closed faces exist)
        w.baseConnections(w.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())').slice(0, o.n || 7));
    }
    w.run('showFaces = ' + (o.faces === false ? 'false' : 'true') + ';');
    return w;
}
const svgOf = w => w.get('generateSVGString()');
// the polygons the canvas path gets: fill state at endShape, skipping the outline (noFill) ones
function canvasPolys(w) {
    const sb = w.sb; sb.__canvas.length = 0; w.run('drawTessellation()');
    const out = []; let f = null, cur = null;
    sb.__canvas.forEach(c => {
        if (c[0] === 'fill') f = c[1]; else if (c[0] === 'noFill') f = null; else if (c[0] === 'beginShape') cur = []; else if (c[0] === 'vertex') cur.push([c[1], c[2]]);
        else if (c[0] === 'endShape') { if (f !== null) out.push({ fill: f, pts: cur }); cur = null; }
    });
    return out;
}
const area = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
const svgPolys = svg => [...svg.matchAll(/<polygon points="([^"]*)" fill="([^"]*)"(?: fill-opacity="([^"]*)")?/g)].map(m => ({ pts: m[1].split(' ').map(p => p.split(',').map(Number)), hex: m[2], op: m[3] === undefined ? 1 : +m[3] }));
const hexOf = (w, c) => w.get(`_svgColorSpec(${JSON.stringify(c)})`);

console.log('== 1. faces off: byte-identical to the tree before ==');
for (const o of [{}, { shape: 'hex', order: 3, sym: 'rotation_reflection6' }, { shape: 'triangle', order: 5, sym: 'rotation_reflection3' }]) {
    const a = mk(oldExport, { ...o, faces: false }), b = mk(newExport, { ...o, faces: false });
    const sa = svgOf(a), sb2 = svgOf(b);
    check(`${o.shape || 'square'}: showFaces off, SVG equals old export.js (${sa.length} bytes)`, sa === sb2 && !/<polygon/.test(sb2) && /<path/.test(sb2));
}
{   // nodes on too
    const a = mk(oldExport, { faces: false }), b = mk(newExport, { faces: false });
    a.run('showNodes = true; nodes.length;'); b.run('showNodes = true;');
    check('showNodes on, faces off: still identical', svgOf(a) === svgOf(b));
}

console.log('== 2. faces on: polygons equal the canvas calls ==');
function compare(label, w) {
    const ref = canvasPolys(w), svg = svgOf(w), sp = svgPolys(svg);
    let same = ref.length === sp.length && ref.length > 0, aOk = true, cOk = true, oOk = true, minOp = 1, hexes = new Set();
    ref.forEach((r, i) => {
        const s = sp[i]; if (!s) { same = false; return; }
        const spec = hexOf(w, r.fill);
        if (s.hex !== spec.hex) cOk = false;
        if (Math.abs(s.op - (spec.opacity < 1 ? +spec.opacity.toFixed(3) : 1)) > 1e-9) oOk = false;
        if (Math.abs(area(s.pts) - area(r.pts)) > 0.5 + 2e-3 * area(r.pts)) aOk = false;   // toFixed(2) rounding only
        if (s.pts.length !== r.pts.length) aOk = false;
        minOp = Math.min(minOp, s.op); hexes.add(s.hex);
    });
    check(`${label}: ${ref.length} polygons = ${sp.length} in the SVG, count > 0`, same);
    check(`${label}: fill hex of every polygon, in drawing order`, same && cOk, [...hexes].slice(0, 3).join(','));
    check(`${label}: vertex count and area of every polygon equal the canvas polygon`, same && aOk);
    check(`${label}: fill-opacity equals the colour alpha`, same && oOk, 'min ' + minOp);
    return { svg, n: ref.length };
}
const R = {};
R.plain = compare('plain', mk(newExport));
{   // size report: the dense square pattern with faces on / off
    const off = svgOf(mk(newExport, { faces: false }));
    console.log(`INFO  size, dense square pattern: faces off ${off.length} bytes; faces on ${R.plain.svg.length} bytes, ${R.plain.n} polygons (+${R.plain.svg.length - off.length} bytes, ${((R.plain.svg.length - off.length) / R.plain.n).toFixed(1)} per polygon)`);
}
{   // with a layer
    const w = mk(newExport); const id = w.addKeyframeLayer(ALT, { showFaces: true }); w.run(`additionalLayers[${id}].enabled = true;`);
    R.layer = compare('with a layer', w);
}
{   // assigned colours (hex from the colour system)
    const w = mk(newExport), sb = w.sb;
    w.run('baseFaceAssignments = new Map();');
    w.run(`(function () { const res = computeCellFaces(connections, nodes), group = getGroupElementsCached(nodes, centroid, currentShape, symmetryMode, outerCorners), trails = computeFaceTrails(res, group);
        trails.forEach((t, i) => setFaceAssignment(baseFaceAssignments, t.key, { hue: (i * 5) % 24, w: 0.1, s: 0.2, rule: null, params: null })); })()`);
    R.assigned = compare('assigned colours', w);
    check('assigned colours: more than one distinct fill hex', new Set(svgPolys(R.assigned.svg).map(p => p.hex)).size > 1);
}
{   // net field
    const w = mk(newExport); w.run('baseNetTransform = { x: { kind: "trig", w: -0.8 }, y: "same", domain: "field" };');
    R.field = compare('net field (sinus)', w);
}
{   // playback in between
    const w = mk(newExport);
    const a = w.addKeyframeLayer(CONNS, { showFaces: true }), b = w.addKeyframeLayer(ALT, { showFaces: true }), pb = w.addKeyframeLayer(CONNS, { isTimelinePlayback: true, enabled: true, showFaces: true });
    w.setTimeline([a, b], { playbackLayerIndex: pb });
    w.run('timeline.elapsedMs = 1000; applyTimelineFrame();');
    R.playback = compare('playback at t = 0.5', w);
}
{   // alpha through the real path: a polygon with an hsla fill
    const w = mk(newExport);
    w.run('(function(){ const o = drawFaceFillsAtTile; drawFaceFillsAtTile = function (r, c, f) { r = Object.assign({}, r, { faces: r.faces.map(function (q) { return Object.assign({}, q, { color: "hsla(200, 50%, 40%, 0.65)" }); }) }); return o(r, c, f); }; })();');
    const sp = svgPolys(svgOf(w));
    check('hsla face colour: polygons carry fill-opacity 0.65', sp.length > 0 && sp.every(p => Math.abs(p.op - 0.65) < 1e-9 && /^#[0-9a-f]{6}$/.test(p.hex)));
}

console.log('== 3. layering and lines ==');
{
    const w = mk(newExport); w.run('showNodes = true;');
    const svg = svgOf(w);
    const ix = s => svg.indexOf(s);
    const order = [ix('<rect x="0" y="0" width="600" height="600" fill="'), ix('<polygon'), ix('<g stroke="#000000"'), ix('<circle'), ix('stroke-width="4"')];
    check('order: background, faces, lines, nodes, frame', order.every(x => x >= 0) && order.every((x, i) => i === 0 || x > order[i - 1]), order.join('<'));
    w.run('lineStyle = { visible: false, weight: 2 };');
    const off = svgOf(w);
    check('lines off: polygons stay, no <path>, no line group', (off.match(/<polygon/g) || []).length === svgPolys(svg).length && !/<path/.test(off) && !/<g stroke="#000000"/.test(off));
    w.run('lineStyle = { visible: true, weight: 5 };');
    check('line weight follows the slider (5)', /<g stroke="#000000" stroke-width="5" fill="none">/.test(svgOf(w)));
}

console.log('== 4. p5 functions restored, no canvas calls ==');
{
    const w = mk(newExport), sb = w.sb;
    const names = ['fill', 'noFill', 'beginShape', 'vertex', 'endShape'];
    const before = names.map(n => sb[n]);
    sb.__canvas.length = 0; svgOf(w);
    const drawCalls = sb.__canvas.filter(c => ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'ellipse', 'rect'].includes(c[0]));
    check('after the export the five p5 functions are the originals', names.every((n, i) => sb[n] === before[i]));
    check('the SVG build made no fill / shape / ellipse / rect call on the canvas', drawCalls.length === 0, drawCalls.length);
    // an exception inside drawTessellation()
    w.run('var __orig = drawFaceFillsAtTile; drawFaceFillsAtTile = function () { fill("#123456"); throw new Error("boom"); };');
    let thrown = null; try { svgOf(w); } catch (e) { thrown = e; }
    check('exception: it propagates', thrown && /boom/.test(thrown.message));
    check('exception: the five p5 functions are the originals again', names.every((n, i) => sb[n] === before[i]));
    check('exception: svgPathCollector is reset (null)', w.get('svgPathCollector') === null);
    w.run('drawFaceFillsAtTile = __orig;');
    check('after the exception a normal export works again', svgPolys(svgOf(w)).length > 0);
}

console.log('== 5. colour parser ==');
{
    const w = mk(newExport); const P = c => hexOf(w, c);
    check('#rgb / #rrggbb / #rrggbbaa', P('#abc').hex === '#aabbcc' && P('#A0B0C0').hex === '#a0b0c0' && P('#a0b0c080').hex === '#a0b0c0' && Math.abs(P('#a0b0c080').opacity - 128 / 255) < 1e-9);
    check('rgb / rgba', P('rgb(255, 0, 10)').hex === '#ff000a' && P('rgba(0,0,0,0.25)').opacity === 0.25);
    check('hsl / hsla (red, green, grey, alpha)', P('hsl(0, 100%, 50%)').hex === '#ff0000' && P('hsl(120, 100%, 25%)').hex === '#008000' && P('hsl(0, 0%, 70%)').hex === '#b3b3b3' && P('hsla(240, 100%, 50%, 0.65)').opacity === 0.65);
}

console.log(`\n${checks - failures}/${checks} checks passed${SAB ? '  (sabotage: ' + SAB + ')' : ''}`);
process.exit(failures ? 1 : 0);
