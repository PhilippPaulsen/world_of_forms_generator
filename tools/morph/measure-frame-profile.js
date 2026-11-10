// Measurement (task 037; not a test: the glob tools/*/test-*.js does not pick it up). Frame profile of the spatial morph in Node: where do the milliseconds of ONE drawTessellation() go?
// Phases (wrapped inside the vm; the wrappers only take two clock readings, the functions run unchanged):
//   faces  = spatialMorphRenderTileFaces   (computeCellFaces per tile)         colour = spatialMorphRenderFaceColors (correspondence + raster; 'raster' = the part of it in ...Raster, when that exists)
//   draw   = spatialMorphRenderFillFaces   (fill / beginShape / vertex / toTileLocal per face)    fields = spatialMorphRenderCornerFields (cached across frames: first frame only)
//   lines  = total - faces - colour - draw - fields (line geometry, drawCurvedBezier into the p5 stand-ins)
// Runs against the tree it lives in (ROOT = two levels up), so the same file is copied into a worktree of an older commit to measure that stand.
//   node tools/morph/measure-frame-profile.js [--drag 10] [--json] [--cases hex-typical,tri-typical,...] [--modes linear,radial]
// A case = a pair of tools/morph/measure-color-jumps.js (two keyframe layers, one timeline segment, symmetry as in the pair). "drag" = <n> consecutive frames at p = 0.50, 0.51, ... (step 0.01);
// playing at 60 fps over a 2000 ms segment is a step of 0.0083, the same pipeline (Node has no timer). "cold" = the first frame after the world is built (colour fields get built).
// Variants: faces ON (the keyframe layers show faces) and faces OFF (lines only), and "normal" = morph switched OFF with the same layers' first keyframe as base lines (no spatial path).
'use strict';
const path = require('path');
const { build, PAIRS } = require('./measure-color-jumps.js');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const DRAG = +arg('drag', 10);
const CASES = (arg('cases', 'square-dense-8,coloured,hex-typical,hex-dense-8,hex-coloured,tri-typical,tri-dense-6,tri-coloured')).split(',').map((c) => (c === 'square-dense-8' ? 'dense-8' : c));
const MODES = arg('modes', 'linear,radial').split(',');
const JSON_OUT = process.argv.includes('--json');
const DISTINCT = process.argv.includes('--distinct');

// --distinct: per frame the number of DISTINCT inputs of spatialMorphRenderTileFaces (the tile's cell lines in canonical coordinates, rounded to 1e-6) and the share of the tiles whose input
// was already seen in the frame BEFORE (step 0.01): the upper bound of what a per-tile reuse (lever a) and a cross-frame cache (lever b) can save. Numbers only, nothing is cached.
function distinct(name, mode) {
    const w = build(name, mode);
    w.set(`var __keys = []; { const f = spatialMorphRenderTileFaces; spatialMorphRenderTileFaces = function (lines) { __keys.push(JSON.stringify(lines.map((l) => l.map((q) => [Math.round(q.x * 1e6), Math.round(q.y * 1e6)])))); return f.apply(this, arguments); }; }`);
    let prev = null; const rows = [];
    for (let k = 0; k < Math.min(DRAG, 10); k++) {
        w.set(`timeline.elapsedMs = ${(0.5 + 0.01 * k) * 2000}; __keys.length = 0;`);
        w.run('drawTessellation()');
        const keys = w.get('__keys.slice()'), set = new Set(keys);
        rows.push({ tiles: keys.length, distinct: set.size, hit: prev ? keys.filter((x) => prev.has(x)).length / keys.length : null });
        prev = set;
    }
    const hits = rows.filter((r) => r.hit !== null).map((r) => r.hit);
    return { case: name, mode, tiles: rows[0].tiles, distinct: Math.round(mean(rows.map((r) => r.distinct))), crossFrameHit: +(mean(hits)).toFixed(3) };
}


function instrument(w) {
    w.sb.__now = () => Number(process.hrtime.bigint()) / 1e6;
    w.set(`
      var __P = { faces: 0, color: 0, draw: 0, raster: 0, fields: 0, tiles: 0 };
      var __wrap = (name, key, count) => { if (typeof globalThis[name] !== 'function') return; const f = globalThis[name]; globalThis[name] = function () { const t = __now(); try { return f.apply(this, arguments); } finally { __P[key] += __now() - t; if (count) __P.tiles++; } }; };
      __wrap('spatialMorphRenderTileFaces', 'faces', true); __wrap('spatialMorphRenderFaceColors', 'color'); __wrap('spatialMorphRenderFillFaces', 'draw');
      __wrap('spatialMorphRenderFaceColorsRaster', 'raster'); __wrap('spatialMorphRenderCornerFields', 'fields');
      var __frame = function () { __P.faces = __P.color = __P.draw = __P.raster = __P.fields = __P.tiles = 0; __calls.length = 0; const t = __now(); drawTessellation(); const total = __now() - t; return Object.assign({ total }, __P, { polys: __polys.length }); };
    `);
}
const frame = (w) => w.run('__polys.length = 0; __tiles.length = 0; __lines.length = 0; __frame()');
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const r1 = (x) => +x.toFixed(1);

function measure(name, mode, variant) {
    const w = build(name, mode);
    instrument(w);
    if (variant === 'faces-off') w.run('additionalLayers.forEach((l) => { l.showFaces = false; });');
    if (variant === 'normal') w.setMorph({ enabled: false });
    const set = (p) => w.set(`timeline.elapsedMs = ${p * 2000};`);
    set(0.5);
    const cold = frame(w);
    const rows = [];
    for (let k = 0; k < DRAG; k++) { set(0.5 + 0.01 * k); rows.push(frame(w)); }
    const col = (key) => rows.map((r) => r[key]);
    const lines = rows.map((r) => r.total - r.faces - r.color - r.draw - r.fields);
    const status = w.get("spatialMorphStatus().code");
    return { case: name, mode, variant, status, tiles: rows[0].tiles, polys: rows[0].polys, cold: r1(cold.total), total: r1(mean(col('total'))), totalMax: r1(Math.max(...col('total'))), lines: r1(mean(lines)), faces: r1(mean(col('faces'))), color: r1(mean(col('color'))), raster: r1(mean(col('raster'))), draw: r1(mean(col('draw'))), fields: r1(mean(col('fields'))) };
}

if (DISTINCT) {
    for (const c of CASES) for (const m of MODES) { try { console.log(JSON.stringify(distinct(c, m))); } catch (e) { console.log(JSON.stringify({ case: c, mode: m, error: String(e && e.message).slice(0, 200) })); } }
    process.exit(0);
}
const out = [];
for (const c of CASES) {
    if (!PAIRS[c]) { console.error('unknown case ' + c); continue; }
    for (const mode of MODES) {
        const variants = PAIRS[c].colour || c.endsWith('typical') || c.includes('dense') ? ['faces-on', 'faces-off'] : ['faces-on'];
        for (const v of variants) {
            try { const r = measure(c, mode, v); out.push(r); if (!JSON_OUT) console.log(JSON.stringify(r)); } catch (e) { console.log(JSON.stringify({ case: c, mode, variant: v, error: String(e && e.message).slice(0, 200) })); }
        }
    }
}
if (JSON_OUT) console.log(JSON.stringify(out, null, 1));
