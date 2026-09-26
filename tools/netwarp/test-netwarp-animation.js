/**
 * tools/netwarp/test-netwarp-animation.js
 * Roadmap 1.6 / Group E x 1.8: the standalone net animation, Stage 1 (same-family lerp of strength / focus).
 *
 *   node tools/netwarp/test-netwarp-animation.js
 *
 *  1. What is refused at Set Start / Set End (domain, macro, Alternate, law family) and what is allowed, with the reason named.
 *  2. The lerp: exact at t = 0 and t = 1; the midpoint of opposite-sign same-law strengths (sinus <-> tangens, +w <-> -w) is the
 *     EXACT regular net (identity), also on a Field, also in the real drawing.
 *  3. Author / live separation - the Stage A regression class: the frames never write into baseNetTransform, an edit during
 *     playback lands in the author spec and survives every later frame, and the frame depends only on (Start, End, t).
 *  4. Export describes the drawn frame while live (with animationFrame), the author net otherwise.
 *  5. The wiring: hit-test/overlay/export/drawing read netTransformNow(); the UI hook that ends a paused preview on an author edit.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export'];
const SRC = FILES.map(f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const SKETCH = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
const grab = name => { const m = SKETCH.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const ANIM_SRC = ['ensureNetAnimation', 'captureNetAnimationEnd', 'applyNetAnimationFrame', 'toggleNetAnimationPlayback', 'setNetAnimationProgress'].map(grab).join('\n');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const W = 600;
function makeSb(src, order, sf, mode) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        line: (a, b, c, d) => sb.lines.push([a, b, c, d]), bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, stroke: () => { }, noFill: () => { }, CLOSE: 'close',
        fill: c => { sb._fill = c; }, beginShape: () => { sb._cur = []; }, vertex: (x, y) => { sb._cur.push({ x, y }); }, endShape: () => { sb.polys.push({ fill: sb._fill, pts: sb._cur }); sb._cur = null; },
        document: { body: {} }, getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }), showNodes: true, width: W, height: W, showFaces: false,
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, activeNetWarp: null, lineColor: '#000000', altNetSeed: null,
        currentShape: 'square', shapeSizeFactor: sf, nodeCount: order, symmetryMode: mode, timeline: null, activeLayer: 'base',
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, lines: [], polys: []
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb); vm.runInContext(src, sb);
    const g = sb.buildSquareGrid(order, sf, W, W); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
    return sb;
}

let seed = 4; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const S = (kind, w, extra) => ({ x: { kind, w, ...(extra || {}) }, y: 'same', repeat: false });
const F = (ax) => ({ x: ax, y: 'same', domain: 'field' });
function mk(order, R, mode) {
    const sb = makeSb(SRC, order, R, mode || 'none');
    sb.status = []; sb.now = 0; sb.redrawCount = 0;
    sb.millis = () => sb.now; sb.syncAnimationLoopState = () => { }; sb.redraw = () => { sb.redrawCount++; }; sb.setNetAnimationStatus = t => sb.status.push(t);
    vm.runInContext(ANIM_SRC, sb);
    return sb;
}
const ident = (sb, spec, n = 300) => { const w = sb.makeNetWarp(spec, { c0: { x: 240, y: 240 }, v1: { x: 120, y: 0 }, v2: { x: 0, y: 120 } }, 3, 5); if (!w) return 'null'; let m = 0; for (let i = 0; i < n; i++) { const p = { x: rnd() * 700 - 50, y: rnd() * 700 - 50 }, q = sb.applyNetWarp(w, p); m = Math.max(m, Math.hypot(q.x - p.x, q.y - p.y)); } return m; };

// ============ 1. refused / allowed ============
console.log('== 1. Set Start / Set End compatibility ==');
{
    const sb = mk(4, 5), c = (a, b) => sb.netAnimationCompat(a, b);
    const refused = (a, b, frag) => { const r = c(a, b); return !r.ok && String(r.reason).includes(frag); };
    check('refused, naming the reason: a different domain (single vs field, tiled vs single)', refused(S('trig', -1), F({ kind: 'trig', w: -1 }), 'domain') && refused({ ...S('trig', -1), repeat: true }, S('trig', -1), 'domain'));
    check('refused: different macro cells (3 vs none); in a Field the macro does not count', refused({ ...S('trig', -1), macro: 3 }, S('trig', -1), 'macro') && c({ ...F({ kind: 'trig', w: -1 }), macro: 3 }, F({ kind: 'trig', w: -0.5 })).ok);
    check('refused: Alternate tiles differs on an axis with a law', refused(S('geometric', 1, { alternate: true }), S('geometric', 1.4), 'Alternate'));
    check('refused: law family differs (trig vs geometric), on X and on Y', refused(S('trig', -1), S('geometric', 1), 'family') && refused({ x: { kind: 'trig', w: -1 }, y: { kind: 'trig', w: -1 }, repeat: false }, { x: { kind: 'trig', w: -1 }, y: { kind: 'geometric', w: 1 }, repeat: false }, 'Y axis'));
    check('allowed: sinus <-> tangens, +w <-> -w geometric, other strength, other focus', c(S('trig', -1), S('trig', 1)).ok && c(S('geometric', 1.2), S('geometric', -1.2)).ok && c(S('trig', -0.3), S('trig', -1)).ok && c(S('trig', -1), S('trig', -1, { focus: 0.6 })).ok);
    check('allowed: a regular net (null / {regular:true} / a w = 0 axis) with any domain and family: it is w = 0 of the other side', c(null, F({ kind: 'trig', w: -1 })).ok && c({ regular: true }, S('geometric', 1)).ok && c(S('trig', -1), null).ok && c({ x: { kind: 'uniform', w: 0 }, y: 'same', repeat: false }, S('trig', -1)).ok);
    check('every refusal carries a non-empty reason; ok has none', [c(S('trig', -1), S('geometric', 1)), c(S('trig', -1), F({ kind: 'trig', w: -1 }))].every(r => !r.ok && r.reason.length > 10) && c(S('trig', -1), S('trig', 1)).reason === null);
}

// ============ 2. the lerp ============
console.log('\n== 2. the lerp ==');
{
    const sb = mk(4, 5), fr = { c0: { x: 240, y: 240 }, v1: { x: 120, y: 0 }, v2: { x: 0, y: 120 } };
    let bad = 0, n = 0;
    for (const [a, b] of [[S('trig', -1), S('trig', 0.6)], [S('geometric', 1.2), S('geometric', -0.7)], [S('trig', -0.5, { focus: 0.4 }), S('trig', -1, { focus: -0.6 })], [F({ kind: 'trig', w: -1 }), F({ kind: 'trig', w: 0.4, focus: 0.5 })], [{ x: { kind: 'trig', w: -1 }, y: { kind: 'trig', w: 0.5 }, repeat: false }, { x: { kind: 'trig', w: 0.2 }, y: { kind: 'trig', w: -0.9 }, repeat: false }]]) {
        for (const [t, ref] of [[0, a], [1, b]]) {
            const wl = sb.makeNetWarp(sb.netLerpSpecs(a, b, t), fr, 3, 5), wr = sb.makeNetWarp(ref, fr, 3, 5);
            for (let i = 0; i < 150; i++) { const p = { x: rnd() * 700 - 50, y: rnd() * 700 - 50 }; n++; if (JSON.stringify(sb.applyNetWarp(wl, p)) !== JSON.stringify(sb.applyNetWarp(wr, p))) bad++; }
        }
    }
    check(`t = 0 is EXACTLY the Start warp and t = 1 EXACTLY the End warp (applyNetWarp, JSON-identical): ${n} points, 5 pairs (plain, geometric, focus, Field, per-axis)`, bad === 0);
    let mid = 0;
    for (const s of [0.3, 0.6, 1]) { mid = Math.max(mid, ident(sb, sb.netLerpSpecs(S('trig', -s), S('trig', s), 0.5)), ident(sb, sb.netLerpSpecs(F({ kind: 'trig', w: -s }), F({ kind: 'trig', w: s }), 0.5)), ident(sb, sb.netLerpSpecs(S('geometric', 1.1 * s), S('geometric', -1.1 * s), 0.5))); }
    check(`the midpoint of opposite-sign same-law strengths is the EXACT regular net: identity to ${mid} px (sinus <-> tangens, Field, geometric +w <-> -w)`, mid === 0);
    const fs = [0.1, 0.25, 0.5, 0.75, 0.9].map(t => ident(sb, sb.netLerpSpecs(S('trig', -1), S('trig', 1), t)));
    check('...and it is NOT the identity elsewhere (t = 0.1 .. 0.9 except 0.5 move points by >= 1 px)', [0, 1, 3, 4].every(i => fs[i] >= 1) && fs[2] === 0, fs.map(v => (+v).toFixed(1)).join(' / '));
    const spec = sb.netLerpSpecs(S('trig', -1), S('trig', 0.6), 0.25);
    check('an interpolated spec is an ordinary law spec (w = (1-t)*wa + t*wb), keeps domain/macro, and asks to stay a warp even at w = 0', Math.abs(spec.x.w - (0.75 * -1 + 0.25 * 0.6)) < 1e-15 && spec.keep === true && sb.netLerpSpecs({ ...S('trig', -1), macro: 3 }, { ...S('trig', 0.5), macro: 3 }, 0.3).macro === 3 && sb.netLerpSpecs(F({ kind: 'trig', w: -1 }), F({ kind: 'trig', w: 1 }), 0.4).domain === 'field');
    check('an incompatible pair is not interpolated (null)', sb.netLerpSpecs(S('trig', -1), S('geometric', 1), 0.5) === null);
    // a regular net faded to a warp
    const wf = sb.makeNetWarp(sb.netLerpSpecs(null, F({ kind: 'trig', w: -1 }), 0.5), fr, 3, 5), wt = sb.makeNetWarp(F({ kind: 'trig', w: -0.5 }), fr, 3, 5); let dd = 0;
    for (let i = 0; i < 100; i++) { const p = { x: rnd() * 600, y: rnd() * 600 }, a = sb.applyNetWarp(wf, p), b = sb.applyNetWarp(wt, p); dd = Math.max(dd, Math.hypot(a.x - b.x, a.y - b.y)); }
    check('Regular -> Sinus 1.00 at t = 0.5 is the Sinus 0.50 net, and it stays a Field', dd < 1e-9 && wf.field !== null);
}

// ============ 3. the real drawing at the midpoint ============
console.log('\n== 3. real pipeline ==');
{
    const conns = [[1, 16], [4, 13], [2, 8], [8, 15], [15, 9], [9, 2]];
    const run = (setup) => { const sb = mk(4, 5, 'rotation_reflection6'); sb.connections = conns.map(c => c.slice()); setup(sb); sb.lines = []; sb.drawTessellation(); return sb; };
    const key = l => l.map(v => v.toFixed(6)).join(',');
    const reg = run(sb => { sb.baseNetTransform = null; }), mid = run(sb => { sb.baseNetTransform = F({ kind: 'trig', w: -1 }); sb.baseNetAnimation = { from: F({ kind: 'trig', w: -1 }), to: F({ kind: 'trig', w: 1 }), durationMs: 2000, elapsedMs: 1000, playing: false, live: true, t: 0.5 }; });
    const regSet = new Set(reg.lines.map(key));
    check(`Field, Sinus 1.00 <-> Tangens 1.00 at t = 0.5: every drawn line is a line of the regular net (${mid.lines.length} lines; the regular drawing covers the canvas plus a margin, ${reg.lines.length})`, mid.lines.length > 0 && mid.lines.every(l => regSet.has(key(l))));
    const ends = [0, 1].map(t => run(sb => { sb.baseNetTransform = null; sb.baseNetAnimation = { from: F({ kind: 'trig', w: -1 }), to: F({ kind: 'trig', w: 0.5 }), durationMs: 1, elapsedMs: 0, playing: false, live: true, t }; }));
    const refs = [F({ kind: 'trig', w: -1 }), F({ kind: 'trig', w: 0.5 })].map(sp => run(sb => { sb.baseNetTransform = sp; }));
    check('t = 0 and t = 1 draw exactly the Start and the End net (every line() call) - with an unrelated author net set', JSON.stringify(ends[0].lines) === JSON.stringify(refs[0].lines) && JSON.stringify(ends[1].lines) === JSON.stringify(refs[1].lines));
    const notLive = run(sb => { sb.baseNetTransform = F({ kind: 'trig', w: -0.4 }); sb.baseNetAnimation = { from: F({ kind: 'trig', w: -1 }), to: F({ kind: 'trig', w: 1 }), live: false, t: 0.9 }; }), author = run(sb => { sb.baseNetTransform = F({ kind: 'trig', w: -0.4 }); });
    check('an animation that is not live draws the author net (byte-identical to no animation at all)', JSON.stringify(notLive.lines) === JSON.stringify(author.lines));
}

// ============ 4. author / live separation ============
console.log('\n== 4. author net vs live frame ==');
{
    const sb = mk(4, 5, 'none'); sb.connections = [[1, 16], [4, 13], [2, 8]];
    sb.baseNetTransform = F({ kind: 'trig', w: -1 });
    check('Set Start captures the author net; Set End refuses an incompatible net and keeps the Start (message names the reason)', sb.captureNetAnimationEnd('from') === true && (sb.baseNetTransform = S('trig', 1), sb.captureNetAnimationEnd('to')) === false && /domain differs/.test(sb.status[sb.status.length - 1]) && sb.baseNetAnimation.to === null);
    sb.baseNetTransform = F({ kind: 'trig', w: 1 }); check('...and accepts the compatible one', sb.captureNetAnimationEnd('to') === true && sb.baseNetAnimation.from && sb.baseNetAnimation.to);
    sb.baseNetTransform = F({ kind: 'trig', w: -0.3, focus: 0.2 });   // the author's own edit, unrelated to Start/End
    const authorRef = sb.baseNetTransform, authorJSON = JSON.stringify(sb.baseNetTransform), fromJSON = JSON.stringify(sb.baseNetAnimation.from), toJSON = JSON.stringify(sb.baseNetAnimation.to);
    sb.toggleNetAnimationPlayback();
    check('Play: live and playing, the author spec object is untouched', sb.baseNetAnimation.playing && sb.baseNetAnimation.live && sb.baseNetTransform === authorRef && JSON.stringify(sb.baseNetTransform) === authorJSON);
    let intact = true, lastT = -1, monotone = true;
    for (let f = 0; f <= 40; f++) {
        sb.now = f * 50; sb.applyNetAnimationFrame();
        sb.lines = []; sb.drawTessellation(); sb.netWarpBaseNow(); sb.netWarpActive();
        if (sb.baseNetTransform !== authorRef || JSON.stringify(sb.baseNetTransform) !== authorJSON || JSON.stringify(sb.baseNetAnimation.from) !== fromJSON || JSON.stringify(sb.baseNetAnimation.to) !== toJSON) intact = false;
        if (sb.baseNetAnimation.t < lastT) monotone = false; lastT = sb.baseNetAnimation.t;
    }
    check('over 41 frames of playback (draw + netWarpBaseNow every frame) baseNetTransform is the SAME object with the same content, Start and End unchanged', intact);
    check('progress runs 0 -> 1 monotonically and playback stops at the end', monotone && Math.abs(lastT - 1) < 1e-12 && sb.baseNetAnimation.playing === false);
    // an edit DURING playback
    sb.baseNetAnimation.playing = true; sb.baseNetAnimation.startTime = sb.now; sb.baseNetAnimation.elapsedMs = 0;
    sb.now += 500; sb.applyNetAnimationFrame(); const frameBefore = JSON.stringify(sb.netTransformNow());
    sb.baseNetTransform = F({ kind: 'trig', w: -0.9, focus: 0.7 });   // what the strength/focus sliders do (commit()): author only
    let ok = true; for (let f = 0; f < 8; f++) { sb.now += 50; sb.applyNetAnimationFrame(); sb.lines = []; sb.drawTessellation(); if (JSON.stringify(sb.baseNetTransform) !== JSON.stringify(F({ kind: 'trig', w: -0.9, focus: 0.7 }))) ok = false; }
    check('an author edit during playback lands in baseNetTransform and survives 8 further frames (not clobbered by the live frame)', ok && sb.baseNetAnimation.playing);
    const at = t => { sb.baseNetAnimation.playing = false; sb.baseNetAnimation.live = true; sb.baseNetAnimation.t = t; return JSON.stringify(sb.netTransformNow()); };
    const f1 = at(0.4); sb.baseNetTransform = S('geometric', 2); const f2 = at(0.4); sb.baseNetTransform = null; const f3 = at(0.4);
    check('the frame depends only on (Start, End, t): the same t gives the same net whatever the author spec is (even null)', f1 === f2 && f2 === f3);
    // pause + scrub + author edit
    sb.baseNetTransform = F({ kind: 'trig', w: -0.5 }); sb.setNetAnimationProgress(0.5);
    check('scrub: paused, live at t = 0.5, the frame shown differs from the author net', sb.baseNetAnimation.live && !sb.baseNetAnimation.playing && sb.baseNetAnimation.t === 0.5 && JSON.stringify(sb.netTransformNow()) !== JSON.stringify(sb.baseNetTransform));
    sb.baseNetAnimation.live = false;   // what commit() does for an author edit while NOT playing
    check('after an author edit of a paused preview the author net is shown again', JSON.stringify(sb.netTransformNow()) === JSON.stringify(sb.baseNetTransform));
    sb.baseNetAnimation = null; sb.baseNetTransform = null; sb.toggleNetAnimationPlayback();
    check('Play without a captured Start and End says so and does nothing', /Set Start and Set End first/.test(sb.status[sb.status.length - 1]) && sb.baseNetAnimation === null);
}

// negative control: a netTransformNow() that DID write the frame back (the Stage A bug class) is caught by the same checks
{
    const BAD = SRC.replace("return netLerpSpecs(a.from, a.to, a.t || 0) || baseNetTransform;", "baseNetTransform = netLerpSpecs(a.from, a.to, a.t || 0) || baseNetTransform; return baseNetTransform;");
    check('negative control: the source really contains the line the mutation replaces', BAD !== SRC);
    const sb = makeSb(BAD, 4, 5, 'none'); sb.millis = () => sb.now; sb.now = 0; sb.syncAnimationLoopState = () => { }; sb.redraw = () => { }; sb.setNetAnimationStatus = () => { }; vm.runInContext(ANIM_SRC, sb);
    sb.baseNetTransform = F({ kind: 'trig', w: -1 }); sb.captureNetAnimationEnd('from'); sb.baseNetTransform = F({ kind: 'trig', w: 1 }); sb.captureNetAnimationEnd('to');
    sb.baseNetTransform = F({ kind: 'trig', w: -0.3 }); const ref = sb.baseNetTransform, json = JSON.stringify(ref);
    sb.toggleNetAnimationPlayback(); sb.now = 500; sb.applyNetAnimationFrame(); sb.netWarpBaseNow();
    check('...with that mutation the author spec IS clobbered (the object or its content changes) - so the separation checks above are real', sb.baseNetTransform !== ref || JSON.stringify(sb.baseNetTransform) !== json);
}

// ============ 5. export ============
console.log('\n== 5. export ==');
{
    const sb = mk(4, 5, 'none'); sb.connections = [[1, 16], [4, 13], [2, 8]];
    sb.baseNetTransform = F({ kind: 'trig', w: -0.4 });
    const ex = () => JSON.parse(JSON.stringify(sb.buildExportData(null))).meta.netTransform;
    const authorEx = ex();
    sb.baseNetAnimation = { from: F({ kind: 'trig', w: -1 }), to: F({ kind: 'trig', w: 0.5 }), durationMs: 1000, elapsedMs: 0, playing: false, live: false, t: 0.5 };
    check('not live: the export describes the author net, unchanged, no animationFrame', JSON.stringify(ex()) === JSON.stringify(authorEx) && ex().animationFrame === undefined);
    sb.baseNetAnimation.live = true; const frameEx = ex();
    const want = sb.netTransformExportData(sb.netLerpSpecs(sb.baseNetAnimation.from, sb.baseNetAnimation.to, 0.5), 3, 5);
    check('live: the export describes the DRAWN frame (w = -0.25 at t = 0.5) with animationFrame = 0.5, not the author net', frameEx.x.w === -0.25 && frameEx.animationFrame === 0.5 && JSON.stringify({ ...frameEx, animationFrame: undefined }) === JSON.stringify({ ...JSON.parse(JSON.stringify(want)), animationFrame: undefined }) && frameEx.x.w !== authorEx.x.w);
    sb.baseNetAnimation.t = 0; sb.baseNetAnimation.live = true; sb.baseNetAnimation.from = { regular: true }; sb.baseNetAnimation.to = F({ kind: 'trig', w: -1 }); sb.baseNetAnimation.t = 0;
    check('a frame that is exactly regular (regular Start at t = 0) still exports as a warp of uniform axes, not as "no warp"', ex().x.kind === 'uniform');
}

// ============ 6. wiring ============
console.log('\n== 6. wiring ==');
{
    const strip = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
    const tiling = strip('core/tiling.js'), netwarp = strip('core/netwarp.js'), exportSrc = strip('core/export.js'), state = strip('core/state.js');
    check('drawTessellation(), netWarpBaseNow() and the export read netTransformNow(); the state declares baseNetAnimation and rebuildGrid() clears it', /netWarpForBase\(netTransformNow\(\)/.test(tiling) && /const spec = netTransformNow\(\)/.test(netwarp) && /netTransformExportData\(netTransformNow\(\)/.test(exportSrc) && /let baseNetAnimation = null/.test(state) && (state.match(/baseNetAnimation = null/g) || []).length === 3);
    const noFrameWrite = !/baseNetTransform\s*=\s*[^;]*netTransformNow|baseNetTransform\s*=\s*netLerpSpecs/.test(SKETCH + netwarp + tiling);
    check('nothing assigns the computed frame to baseNetTransform (the only writers are the author controls)', noFrameWrite);
    check('sketch.js: the overlay and the face-colour signature use the frame; draw() applies the animation frame; commit() ends a paused preview on an author edit', /netGridLines\(netTransformNow\(\)/.test(SKETCH) && /applyNetAnimationFrame\(\);   \/\/ the net animation's progress/.test(SKETCH) && /baseNetAnimation\.live && !baseNetAnimation\.playing\) baseNetAnimation\.live = false/.test(SKETCH) && /baseNetAnimation\.playing\);\n\}|\|\| !!\(baseNetAnimation && baseNetAnimation\.playing\)/.test(SKETCH));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
