// Task 022 (measurement): what the image test costs on the case square / order 4 / D4, 11+19 against 5+11 (512 pairings). Real frames of the pure function spatialMorphPairingFrame, the real page state
// (sketch.js timelineImageEnv cut out and run in the render harness), no repo file is written.
//   node tools/morph/measure-image-test.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const M = require(path.join(ROOT, 'core', 'spatial-morph.js'));
const { makeRenderWorld } = require('./render-harness.js');
const SK = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
const cut = (n) => SK.match(new RegExp(`function ${n}\\([\\s\\S]*?\\n\\}\\n`))[0];
const w = makeRenderWorld('square', 4, 3, 'rotation_reflection6'); w.baseConnections([]);
const table = w.get("computeThemeLineOrbitTable('rotation_reflection6')"), pair = (id) => table.orbits[id].pairs[0];
const a = w.addKeyframeLayer([11, 19].map(pair)), b = w.addKeyframeLayer([5, 11].map(pair)); w.setTimeline([a, b]);
['timelineConclusiveContext', 'timelineImageEnv'].forEach((n) => w.set(cut(n)));
w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
const ctx = w.get('timelineConclusiveContext(0)'), GE = ctx.groupElements;
const cands = []; for (const perm of [[0, 1], [1, 0]]) for (const f0 of [false, true]) for (const f1 of [false, true]) for (let g0 = 0; g0 < 8; g0++) for (let g1 = 0; g1 < 8; g1++) cands.push({ perm, flips: [f0, f1], members: [g0, g1] });
const ms = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;
let t = process.hrtime.bigint(); const env = w.get('timelineImageEnv(timelineConclusiveContext(0))'); const envMs = ms(t);
const paired = (c) => M.spatialMorphPairedLines(ctx.layerA, ctx.layerB, c.perm, c.flips, c.members, GE);
for (let k = 0; k < 20; k++) M.spatialMorphTestPairingImage(env, paired(cands[k]), {});   // warm up
// ms per frame and per candidate (5 frames, no early stop), on the 128 the score keeps
t = process.hrtime.bigint(); const kept = M.spatialMorphFilterPairingCandidates(ctx.layerA, ctx.layerB, cands, { poly: ctx.poly, groupElements: GE }); const scoreMs = ms(t);
const full = (list) => { const t0 = process.hrtime.bigint(); let frames = 0, pass = 0; list.forEach((c) => { const r = M.spatialMorphTestPairingImage(env, paired(c), {}); frames += r.frames; if (r.pass) pass++; }); return { ms: ms(t0), frames, pass }; };
const early = (list) => { const t0 = process.hrtime.bigint(); let frames = 0, pass = 0; list.forEach((c) => { const r = M.spatialMorphTestPairingImage(env, paired(c), { stopAtFirst: true }); frames += r.frames; if (r.pass) pass++; }); return { ms: ms(t0), frames, pass }; };
const keyOf = (c) => M.spatialMorphImageKey(ctx.layerA, ctx.layerB, c.perm, c.flips, c.members, GE);
const uniq = (list) => { const seen = new Set(), out = []; list.forEach((c) => { const k = keyOf(c); if (!seen.has(k)) { seen.add(k); out.push(c); } }); return out; };
const A = full(kept.kept), B = early(kept.kept), U = uniq(kept.kept), C = early(U), D = early(uniq(cands));
console.log(`env (tiles, span, layout): ${envMs.toFixed(1)} ms once; score stage for 512 pairings: ${scoreMs.toFixed(1)} ms`);
console.log(`${kept.kept.length} score survivors, no dedupe, all 5 frames: ${A.ms.toFixed(0)} ms = ${(A.ms / A.frames).toFixed(2)} ms per frame, ${(A.ms / kept.kept.length).toFixed(1)} ms per candidate (${A.frames} frames, ${A.pass} pass)`);
console.log(`${kept.kept.length} score survivors, no dedupe, stop at the first bad frame: ${B.ms.toFixed(0)} ms (${B.frames} frames, ${B.pass} pass)`);
console.log(`${U.length} distinct images among the survivors, stop at first bad frame: ${C.ms.toFixed(0)} ms (${C.frames} frames, ${C.pass} pass)`);
console.log(`all 512 pairings WITHOUT the score stage: ${uniq(cands).length} distinct images, stop at first bad frame: ${D.ms.toFixed(0)} ms (${D.frames} frames, ${D.pass} pass)`);
const m5 = early(kept.kept.slice(0, 1)); void m5;
