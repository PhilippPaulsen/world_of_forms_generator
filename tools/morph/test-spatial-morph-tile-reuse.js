/**
 * tools/morph/test-spatial-morph-tile-reuse.js
 * Task 038: spatialMorphRenderDraw() (core/spatial-morph-render.js) computes the faces and the face colours of a tile ONCE per distinct input within a frame (spatialMorphRenderTileMemo(): key = the cell lines in
 * canonical coordinates + the corner weights + the mode; the tile position / flip / rotation and the net warp stay per tile in spatialMorphRenderFillFaces()). The memo lives for one frame only.
 *
 *   node tools/morph/test-spatial-morph-tile-reuse.js
 *   SPATIAL_MORPH_RENDER_JS=/path/to/sabotaged-copy.js node tools/morph/test-spatial-morph-tile-reuse.js        (sabotage runs; the sabotages of the report are in tools/morph/ in the task's scratch only)
 *
 *  1. The output equals the output WITHOUT reuse (main before task 038, git show, in a second world): every fill colour and vertex of the polygon lists, in order, and every line() / bezier() call;
 *     square, hexagon and triangle pairs (coloured and dense), linear and radial, several p including the drag step 0.01; with a net field; with a net field that CHANGES between frames; the SVG export
 *     (generateSVGString) with and without the net field; the morph status.
 *  2. Fewer computations: spatialMorphRenderTileFaces() runs for the distinct inputs only (a fraction of the tiles).
 *  3. Stateless: the same frame drawn twice computes the same number of times (nothing carried over), spatialMorphRenderState has no new member, the new top-level name carries the prefix spatialMorph[A-Z];
 *     a frame that throws half way leaves nothing behind: the next frame equals a fresh world's.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const os = require('os');
const { execSync } = require('child_process');
const { build, PAIRS } = require('./measure-color-jumps.js');
// the reference = core/spatial-morph-render.js of main BEFORE task 038 (git show), so a defect of the file under test cannot hide in both worlds; a sabotage copy (SPATIAL_MORPH_RENDER_JS) is only the world under test
const BASE = '13d141f1';
const BASE_FILE = path.join(os.tmpdir(), `spatial-morph-render-${BASE}-${process.pid}.js`);
fs.writeFileSync(BASE_FILE, execSync(`git show ${BASE}:core/spatial-morph-render.js`, { cwd: ROOT, maxBuffer: 1 << 26 }));
process.on('exit', () => { try { fs.unlinkSync(BASE_FILE); } catch (e) { } });
// both keyframes with the SAME lines but different colours: the tiles share their cell lines and differ in their weights (the colours differ with the weights)
PAIRS['same-lines'] = { N: 3, sym: 'none', k0: [[1, 5], [2, 8], [3, 7], [4, 6], [1, 9]], k1: [[1, 5], [2, 8], [3, 7], [4, 6], [1, 9]], colour: true };

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('uncaughtException', (e) => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });
const J = JSON.stringify;
const FIELD = (w) => ({ x: { kind: 'trig', w }, y: 'same', repeat: false, domain: 'field' });

const COUNT = 'var __nTF = 0, __nFC = 0; { const f = spatialMorphRenderTileFaces; spatialMorphRenderTileFaces = function () { __nTF++; return f.apply(this, arguments); }; const g = spatialMorphRenderFaceColors; spatialMorphRenderFaceColors = function () { __nFC++; return g.apply(this, arguments); }; }';
const SVGSTUB = (w) => { const sb = w.sb; sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.lineColor = '#000000'; ['strokeWeight', 'ellipse', 'rect'].forEach((n) => { if (!sb[n]) sb[n] = () => { }; }); };

function pair(name, mode, o) {
    o = o || {};
    const a = build(name, mode);   // a = the code under test
    const env = process.env.SPATIAL_MORPH_RENDER_JS; process.env.SPATIAL_MORPH_RENDER_JS = BASE_FILE;
    let b; try { b = build(name, mode); } finally { if (env === undefined) delete process.env.SPATIAL_MORPH_RENDER_JS; else process.env.SPATIAL_MORPH_RENDER_JS = env; }   // b = main before task 038
    a.set(COUNT);
    [a, b].forEach((w) => { SVGSTUB(w); if (o.net) w.set(`baseNetTransform = ${J(o.net)};`); w.set(`spatialMorph = Object.assign({}, spatialMorph, { angleDeg: ${mode === 'radial' ? 30 : 0} });`); });
    return { a, b };
}
const frame = (w, p) => { w.set(`timeline.elapsedMs = ${p * 2000}; __polys.length = 0; __tiles.length = 0; __lines.length = 0; __nTF = typeof __nTF === 'undefined' ? 0 : 0; __nFC = typeof __nFC === 'undefined' ? 0 : 0;`); const calls = w.drawn(); return { polys: J(w.get('__polys')), calls: J(calls), status: J(w.status()) }; };
const same = (A, B) => A.polys === B.polys && A.calls === B.calls && A.status === B.status;

// 1. output equal to the output without reuse
const CASES = [['same-lines', [0, 0.25, 0.5, 0.75, 1, 0.51]], ['coloured', [0, 0.25, 0.5, 0.75, 1, 0.51, 0.52]], ['hex-coloured', [0, 0.5, 1, 0.51]], ['tri-coloured', [0, 0.5, 1, 0.51]], ['dense-8', [0.5, 0.51]], ['hex-typical', [0.5, 0.51]], ['tri-typical', [0.5, 0.51]]];
for (const [name, ps] of CASES) for (const mode of ['linear', 'radial']) {
    const { a, b } = pair(name, mode);
    let ok = true, polys = 0, where = '';
    for (const p of ps) { const A = frame(a, p), B = frame(b, p); polys = JSON.parse(A.polys).length; if (!same(A, B)) { ok = false; where = String(p); break; } }
    check(`${name} ${mode}: polygons, fills, lines and status equal without the reuse (main before 038) at p = ${ps.join(' ')}`, ok && polys > 0, ok ? polys + ' polygons at the last p' : 'first difference at p = ' + where);
}
for (const mode of ['linear', 'radial']) {
    const { a, b } = pair('coloured', mode, { net: FIELD(0.3) });
    let ok = true;
    for (const p of [0, 0.5, 1]) { const A = frame(a, p), B = frame(b, p); if (!same(A, B)) ok = false; }
    check(`square coloured ${mode} with a net field: polygons and lines equal without the reuse (main before 038)`, ok && a.get('spatialMorphStatus().code') === 'netActive', a.get('spatialMorphStatus().code'));
    // the net CHANGES between two frames of the same p (a reuse that outlived a frame would show the old warp)
    frame(a, 0.5); frame(b, 0.5);
    [a, b].forEach((w) => w.set(`baseNetTransform = ${J(FIELD(0.6))};`));
    const A2 = frame(a, 0.5), B2 = frame(b, 0.5);
    check(`square coloured ${mode}: the net field changes between two frames of the same p: still equal (nothing carried over)`, same(A2, B2));
    // SVG export
    const svgA = a.get('generateSVGString()'), svgB = b.get('generateSVGString()');
    check(`square coloured ${mode} with a net field: the SVG export (generateSVGString) is byte-identical without the reuse (main before 038)`, typeof svgA === 'string' && svgA.length > 500 && svgA === svgB && /<polygon/.test(svgA), svgA.length + ' bytes');
}
for (const [name, mode] of [['hex-coloured', 'linear'], ['tri-coloured', 'radial']]) {
    const { a, b } = pair(name, mode);
    frame(a, 0.5); frame(b, 0.5);
    const svgA = a.get('generateSVGString()'), svgB = b.get('generateSVGString()');
    check(`${name} ${mode}: the SVG export is byte-identical without the reuse (main before 038)`, typeof svgA === 'string' && svgA === svgB && /<polygon/.test(svgA), svgA.length + ' bytes');
}

// 2. fewer computations
for (const [name, mode, max] of [['hex-typical', 'linear', 0.1], ['hex-typical', 'radial', 0.15], ['tri-typical', 'linear', 0.1], ['dense-8', 'linear', 0.1]]) {
    const { a } = pair(name, mode);
    a.set('timeline.elapsedMs = 1000; __nTF = 0; __nFC = 0;'); a.run('drawTessellation()');
    const tiles = a.get('spatialMorphRenderState.faceStats.tiles'), nTF = a.get('__nTF'), nFC = a.get('__nFC');
    check(`${name} ${mode}: spatialMorphRenderTileFaces / FaceColors run ${nTF} / ${nFC} times for ${tiles} tiles (at most ${Math.round(max * 100)} %)`, tiles > 0 && nTF > 0 && nTF <= max * tiles && nFC <= max * tiles);
}

// 3. stateless over frames; nothing left behind
{
    const { a } = pair('hex-typical', 'linear');
    const count = () => { a.set('__nTF = 0; __nFC = 0; timeline.elapsedMs = 1000;'); a.run('drawTessellation()'); return [a.get('__nTF'), a.get('__nFC')]; };
    const c1 = count(), c2 = count();
    check('the same frame drawn twice computes the same number of times (nothing carried over from the frame before)', c1[0] > 0 && J(c1) === J(c2), J(c1) + ' / ' + J(c2));
    const keys = Object.keys(a.get('spatialMorphRenderState')).sort().join(',');
    check('spatialMorphRenderState has no new member (no cache state outside the frame)', keys === 'colorBuilds,colorCache,faceStats,frames,seamCache,seamCheck,seamChecks,seamHits,seamLastMs,span,spanComputes,spanKey,status', keys);
    const src = fs.readFileSync(process.env.SPATIAL_MORPH_RENDER_JS || path.join(ROOT, 'core', 'spatial-morph-render.js'), 'utf8');
    const tops = [...src.matchAll(/^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    check('every top-level name of the file carries the prefix spatialMorph[A-Z]', tops.length > 20 && tops.every((n) => /^spatialMorph[A-Z]/.test(n)), tops.filter((n) => !/^spatialMorph[A-Z]/.test(n)).join(','));
    check('spatialMorphRenderTileMemo() makes a fresh memo and spatialMorphRenderDraw() drops it in its finally (clear())', /tileMemo = facesDrawn \? spatialMorphRenderTileMemo\(\) : null/.test(src) && /finally \{\s*if \(tileMemo\) tileMemo\.clear\(\);/.test(src));
}
{
    // a frame that throws half way (the 5th FillFaces call): the status says renderError and the next frame equals a fresh world's
    const { a } = pair('hex-typical', 'linear');
    a.set('var __ff = 0, __boom = true; { const f = spatialMorphRenderFillFaces; spatialMorphRenderFillFaces = function () { if (__boom && ++__ff === 5) throw new Error("boom"); return f.apply(this, arguments); }; }');
    a.set('timeline.elapsedMs = 1000;'); a.run('drawTessellation()');
    const err = a.get('spatialMorphStatus().code');
    a.set('__boom = false;');
    const A = frame(a, 0.5);
    const fresh = pair('hex-typical', 'linear').b;
    const B = frame(fresh, 0.5);
    check('a frame that throws half way: status renderError, and the next frame equals a fresh world\'s (nothing left behind)', err === 'renderError' && A.polys === B.polys && A.calls === B.calls, err);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
