// Morph stage d3 (task 022): the IMAGE test of the conclusive filter. core/spatial-morph.js spatialMorphPairingFrame (the frame of a pairing from the render's building blocks, no globals, no drawing),
// spatialMorphFrameDangling / FrameSeamGaps, spatialMorphImageKey, spatialMorphTestPairingImage, spatialMorphRunPortion; and sketch.js' wiring (timelineImage*), cut out of the real file and run in a vm.
//   1. EQUALITY with the real render: the pure frame equals the frame core/spatial-morph-render.js draws (1e-6 px), for all 512 pairings of square / order 4 / D4, 11+19 against 5+11, at t = 0.1 .. 0.9, in two modes
//   2. the numbers of the case: 128 pass the score, the image test keeps exactly the 64 without loose ends (nodeMiss > 0 for all of them: the old strictness would have kept none)
//   3. seam gaps are counted (synthetic: no real case has one)   4. deduplication (a picture is tested once)   5. portions (clock stub), cache and restart   6. free line ends: no image test   7. texts and pins
//   node tools/morph/test-spatial-morph-pairing-image.js
//   SPATIAL_MORPH_JS / SKETCH_JS=/path/to/mutated/file.js node tools/morph/test-spatial-morph-pairing-image.js        (sabotage runs)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const M = require(process.env.SPATIAL_MORPH_JS || path.join(ROOT, 'core', 'spatial-morph.js'));
const { makeRenderWorld } = require('./render-harness.js');
const SK = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 300)); } };
const J = (x) => JSON.stringify(x);
const cut = (name) => { const m = SK.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('not in sketch.js: ' + name); return m[0]; };
const NAMES = ['timelineEnrichPairingCandidates', 'timelineConclusiveContext', 'timelineConclusiveFree', 'timelineConclusiveView', 'timelineImageEnv', 'timelineImageCheckNew', 'timelineImageSignature', 'timelineImageCheckStop',
  'timelineImageResult', 'timelineImageCheckStep', 'timelineImageCheckSchedule', 'timelineConclusiveImageStage', 'timelineConclusiveRowImage'];
const BUDGET_LINE = (SK.match(/const timelineImageBudgetMs = [^;]+;/) || [''])[0];
const TS = [0.1, 0.25, 0.5, 0.75, 0.9];
const MODES = [['linear', 0], ['radial', 0]];

// ---- the world: square, order 4, D4 (rotation_reflection6); start orbits 11+19, end orbits 5+11 ----
const w = makeRenderWorld('square', 4, 3, 'rotation_reflection6'); w.baseConnections([]);
const table = w.get("computeThemeLineOrbitTable('rotation_reflection6')"), pair = (id) => table.orbits[id].pairs[0];
const idA = w.addKeyframeLayer([11, 19].map(pair)), idB = w.addKeyframeLayer([5, 11].map(pair)); w.setTimeline([idA, idB]);
w.set(BUDGET_LINE + '\n' + NAMES.map(cut).join('\n') + '\nlet timelineImageCheck = timelineImageCheckNew();');
const cands = []; for (const perm of [[0, 1], [1, 0]]) for (const f0 of [false, true]) for (const f1 of [false, true]) for (let g0 = 0; g0 < 8; g0++) for (let g1 = 0; g1 < 8; g1++) cands.push({ perm, flips: [f0, f1], members: [g0, g1] });
const setPairing = (c) => w.set(`timeline.segmentPairings[0] = ${J(c.perm)}; timeline.segmentFlips[0] = ${J(c.flips)}; timeline.segmentMembers[0] = ${J(c.members)};`);
const ctxNow = () => w.get('timelineConclusiveContext(0)');
const envFor = (mode, ang) => { w.setMorph({ enabled: true, mode, angleDeg: ang }); return w.get('timelineImageEnv(timelineConclusiveContext(0))'); };

console.log('== 1. equality with the real render ==');
let ctx = ctxNow(), GE = ctx.groupElements;
const survivors = [];
T('equality', () => {
  let frames = 0, bad = 0, worst = 0, segs = 0; const t0 = Date.now();
  for (const [mode, ang] of MODES) {
    const env = envFor(mode, ang);
    for (const c of cands) {
      setPairing(c);
      const paired = M.spatialMorphPairedLines(ctx.layerA, ctx.layerB, c.perm, c.flips, c.members, GE);
      for (const t of TS) {
        w.set(`timeline.elapsedMs = ${t * 2000};`);
        const real = w.frame(), mine = M.spatialMorphPairingFrame(Object.assign({}, env, { from: paired.from, to: paired.to, progress: t }));
        frames++;
        if (!mine || mine.length !== real.length) { bad++; continue; }
        let d = 0; for (let k = 0; k < real.length; k++) d = Math.max(d, Math.abs(real[k].x1 - mine[k].x1), Math.abs(real[k].y1 - mine[k].y1), Math.abs(real[k].x2 - mine[k].x2), Math.abs(real[k].y2 - mine[k].y2));
        segs += real.length; worst = Math.max(worst, d); if (d > 1e-6) bad++;
      }
    }
  }
  console.log(`      ${frames} frames compared (${cands.length} pairings x ${TS.length} times x ${MODES.length} modes), ${segs} segments, worst difference ${worst.toExponential(2)} px, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  check(`the pure frame equals the real render's frame at 1e-6 px for all ${frames} frames (512 pairings x 5 times x modes linear:0 and radial:0), same number of segments in the same order`, frames === 5120 && bad === 0, `${bad} differ, worst ${worst}`);
  const env = envFor('bilinear', 0);
  setPairing(cands[0]); const p0 = M.spatialMorphPairedLines(ctx.layerA, ctx.layerB, cands[0].perm, cands[0].flips, cands[0].members, GE);
  const real = w.frame(), mine = M.spatialMorphPairingFrame(Object.assign({}, env, { from: p0.from, to: p0.to, progress: null }));
  check('bilinear (the static blend, no progress): equal as well, and the test uses one time position for it', env.times.length === 1 && env.times[0] === null && mine.length === real.length && real.every((s, k) => Math.abs(s.x1 - mine[k].x1) < 1e-6 && Math.abs(s.y2 - mine[k].y2) < 1e-6));
});

console.log('\n== 2. the numbers of the case ==');
T('numbers', () => {
  const env = envFor('linear', 0);
  const kept = M.spatialMorphFilterPairingCandidates(ctx.layerA, ctx.layerB, cands, { poly: ctx.poly, groupElements: GE });
  const t0 = process.hrtime.bigint(); let frames = 0;
  const res = kept.kept.map((c) => { const p = M.spatialMorphPairedLines(ctx.layerA, ctx.layerB, c.perm, c.flips, c.members, GE); const r = M.spatialMorphTestPairingImage(env, p, {}); frames += r.frames; return { c, r }; });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const pass = res.filter((x) => x.r.pass), fail = res.filter((x) => !x.r.pass);
  console.log(`      score stage keeps ${kept.kept.length} of ${cands.length}; image test (no early stop): ${pass.length} pass, ${fail.length} fail; ${frames} frames in ${ms.toFixed(0)} ms = ${(ms / frames).toFixed(2)} ms per frame, ${(ms / res.length).toFixed(1)} ms per candidate`);
  check('stage 1 (score: dangling and boundaryMiss only) keeps 128 of the 512', kept.kept.length === 128 && kept.dropped === 384);
  check('the image test keeps exactly 64 of those 128 and drops 64', pass.length === 64 && fail.length === 64);
  check('the 64 that fall have 24 loose ends at t = 0.1 and 0.9 and none at 0.25, 0.5, 0.75 (a test at t = 0.5 alone keeps all 128); no frame has a seam gap', fail.every((x) => x.r.dangling.join() === '24,0,0,0,24' && x.r.gaps.every((g) => g === 0)) && pass.every((x) => x.r.dangling.every((d) => d === 0)));
  check('every one of the 64 that stay has nodeMiss > 0 (12): the old strictness, "nodeMiss must be 0", would have kept none', pass.every((x) => x.c.score.nodeMiss === 12 && x.c.score.dangling === 0 && x.c.score.boundaryMiss === 0));
  const one = M.spatialMorphTestPairingImage(env, M.spatialMorphPairedLines(ctx.layerA, ctx.layerB, fail[0].c.perm, fail[0].c.flips, fail[0].c.members, GE), { stopAtFirst: true });
  check('stopAtFirst stops at the first bad frame (t = 0.1: one frame)', !one.pass && one.frames === 1);
  // the real render agrees: the same counts on the REAL frames of the 128
  let agree = 0; for (const x of res) { setPairing(x.c); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); const d = TS.map((t) => { w.set(`timeline.elapsedMs = ${t * 2000};`); return M.spatialMorphFrameDangling(w.frame(), 600, 600).n; }); if (J(d) === J(x.r.dangling)) agree++; }
  check('on the real frames of the 128 the loose ends equal the pure frames\' counts at every time (128 of 128)', agree === 128, agree);
});

console.log('\n== 3. seam gaps are counted (synthetic: no real case has one) ==');
T('seams', () => {
  const tiles = [], polys = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { tiles.push({ c: { x: i + 0.5, y: j + 0.5 } }); polys.push([{ x: i, y: j }, { x: i + 1, y: j }, { x: i + 1, y: j + 1 }, { x: i, y: j + 1 }]); }
  const poly = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], layout = M.spatialMorphFrameLayout(tiles, polys, poly, { x: 0.5, y: 0.5 });
  check('3 x 3 unit tiles: only the middle one is inner (all four edges have a neighbour)', J(layout.inner) === J([false, false, false, false, true, false, false, false, false]));
  const frame = (rightStart) => tiles.map((t, k) => (k === 4 ? { x1: 1.3, y1: 1.5, x2: 2, y2: 1.5 } : k === 5 ? { x1: rightStart.x, y1: rightStart.y, x2: 2.5, y2: 1.7 } : { x1: t.c.x - 0.1, y1: t.c.y, x2: t.c.x + 0.1, y2: t.c.y + 0.1 }));
  const ok = M.spatialMorphFrameSeamGaps(frame({ x: 2, y: 1.5 }), layout), open = M.spatialMorphFrameSeamGaps(frame({ x: 2.1, y: 1.5 }), layout);
  check('the middle tile\'s segment ends on its right edge: with a partner end of the right tile at the same world point 0 gaps (1 boundary end asked), moved 0.1 away: 1 gap', ok.need === 1 && ok.gaps === 0 && open.need === 1 && open.gaps === 1, J([ok, open]));
  const env = { times: [0.5], layout, w: 3, h: 3 };
  check('the dangling counter: two segments meeting end to end have none, a stray segment two ends (inside the 1 px inset)', M.spatialMorphFrameDangling([{ x1: 10, y1: 10, x2: 50, y2: 10 }, { x1: 50, y1: 10, x2: 50, y2: 60 }], 200).n === 2 && M.spatialMorphFrameDangling([{ x1: 10, y1: 10, x2: 50, y2: 10 }, { x1: 50.0005, y1: 10, x2: 50, y2: 60 }], 200).n === 2 && M.spatialMorphFrameDangling([{ x1: 10, y1: 10, x2: 50, y2: 10 }, { x1: 50.01, y1: 10, x2: 50, y2: 60 }], 200).n === 4);
});

console.log('\n== 4. deduplication ==');
T('dedupe', () => {
  const keys = new Map(); cands.forEach((c) => { const k = M.spatialMorphImageKey(ctx.layerA, ctx.layerB, c.perm, c.flips, c.members, GE); (keys.get(k) || keys.set(k, []).get(k)).push(c); });
  console.log(`      ${cands.length} pairings = ${keys.size} distinct image keys (the set of start / end line pairs); the measured number of distinct FRAMES is 56, which only the frames themselves can tell`);
  check('512 pairings give 128 distinct keys (every key shared by 4 pairings)', keys.size === 128 && [...keys.values()].every((l) => l.length === 4), keys.size);
  let diff = 0, n = 0; w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  const sig = (f) => f.map((s) => [s.x1, s.y1, s.x2, s.y2].map((v) => Math.round(v * 1e3)).join(',')).sort().join(';');
  for (const [, list] of [...keys].filter((_, i) => i % 8 === 0)) { const fr = list.map((c) => { setPairing(c); return TS.map((t) => { w.set(`timeline.elapsedMs = ${t * 2000};`); return sig(w.frame()); }).join('|'); }); n++; if (new Set(fr).size !== 1) diff++; }
  check('the key is sound: pairings with the same key draw the same frame at all five times (16 keys sampled, all members of each compared on the real render)', n === 16 && diff === 0, `${diff} of ${n} differ`);
  w.set('timelineImageCheck = timelineImageCheckNew();');
  const ctx2 = ctxNow(); w.sb.CTXQ = ctx2; w.sb.CANDS = cands;
  w.set('CANDS.forEach((c) => timelineImageResult(CTXQ, c));');
  const C = w.get('({ total: timelineImageCheck.total, queued: timelineImageCheck.job.queue.length, distinct: new Set(timelineImageCheck.job.queue).size })');
  check('the controller queues one job per picture: 512 asks, 128 queued, no key twice', C.total === 128 && C.queued === 128 && C.distinct === 128, J(C));
  w.set('while (timelineImageCheck.job.i < timelineImageCheck.job.queue.length) timelineImageCheckStep(timelineImageCheck.job.queue[timelineImageCheck.job.i++]);');
  const r = w.get('CANDS.map((c) => timelineImageResult(CTXQ, c))'), c2 = w.get('({ tested: timelineImageCheck.tested, cache: timelineImageCheck.cache.size })');
  check('after the run every candidate has a result, the image test ran 128 times (not 512), and equal pictures share the result', r.every((x) => x === true || x === false) && c2.tested === 128 && c2.cache === 128);
  const stagePass = w.get('(function () { const v = timelineConclusiveView({ n: 2, orientation: false, items: CANDS }, true, CTXQ); const s = timelineConclusiveImageStage(v, CTXQ); return { state: v.state, kept: v.kept, shown: s.items.length, pending: s.pending }; })()');
  check('the editor\'s stage with the cache full: score state "ok", 128 kept by the score, 64 shown, nothing pending', stagePass.state === 'ok' && stagePass.kept === 128 && stagePass.shown === 64 && stagePass.pending === 0, J(stagePass));
});

console.log('\n== 5. portions, cache, restart ==');
T('portions', () => {
  // the pure runner, clock stub: every item costs 10 ms
  let clock = 0; const now = () => clock, done = [];
  const job = { queue: Array.from({ length: 10 }, (_, k) => k), i: 0 }, sizes = [];
  while (true) { const t0 = clock; const r = M.spatialMorphRunPortion(job, (x) => { done.push(x); clock += 10; }, 25, now); sizes.push([r.processed, clock - t0]); if (r.done) break; }
  check('budget 25 ms, items of 10 ms: portions of 3 items (30 ms = the budget plus ONE item, never more), the last one smaller; every item once, in order', J(sizes.map((s) => s[0])) === J([3, 3, 3, 1]) && sizes.every((s) => s[1] <= 25 + 10) && J(done) === J([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  check('a portion always processes at least one item (a zero budget still progresses); an empty queue returns done', (() => { const j = { queue: [1, 2], i: 0 }; const r = M.spatialMorphRunPortion(j, () => { }, 0, now); return r.processed === 1 && !r.done && M.spatialMorphRunPortion({ queue: [], i: 0 }, () => { }, 25, now).done; })());
  // the controller with a timer stub and a clock stub: real jobs (the 128 survivors' pictures), each portion at most the budget plus one candidate
  w.set('timelineImageCheck = timelineImageCheckNew();');
  const ctx3 = ctxNow(); w.sb.CTXQ = ctx3; w.sb.CANDS = cands;
  const budget = w.get('timelineImageBudgetMs');
  w.set('CANDS.forEach((c) => timelineImageResult(CTXQ, c));');
  // a fake clock: every picture costs 10 "ms" (the step is wrapped), so the portion sizes are deterministic; the real time is only printed
  w.set('var FAKE = 0; var STEP0 = timelineImageCheckStep; timelineImageCheckStep = function (k) { STEP0(k); FAKE += 10; };');
  const timers = []; let progress = 0; const widths = [];
  w.sb.SETT = (fn) => { timers.push(fn); return timers.length; };
  w.sb.NOW = () => w.get('FAKE');
  w.sb.PROG = () => { progress++; };
  w.set('timelineImageCheckSchedule(SETT, NOW, PROG);');
  let portions = 0, realMax = 0, realSum = 0;
  while (timers.length) { const fn = timers.shift(); const f0 = w.get('FAKE'), t0 = process.hrtime.bigint(); fn(); const ms = Number(process.hrtime.bigint() - t0) / 1e6; realMax = Math.max(realMax, ms); realSum += ms; widths.push(w.get('FAKE') - f0); portions++; }
  const d = w.get('({ done: timelineImageCheck.done, total: timelineImageCheck.total, left: timelineImageCheck.job.queue.length - timelineImageCheck.job.i })');
  console.log(`      ${portions} portions for ${d.total} pictures (fake clock), real time ${realSum.toFixed(0)} ms in all, longest portion ${realMax.toFixed(1)} ms (budget ${budget} ms)`);
  check('the scheduler runs all queued pictures in portions of 3 (25 ms budget, 10 ms per picture: 30 = the budget plus ONE picture, never more), one timer per portion, onProgress after each', d.done === d.total && d.left === 0 && portions === Math.ceil(d.total / 3) && widths.every((x) => x <= budget + 10) && widths.slice(0, -1).every((x) => x === 30) && progress === portions, J({ portions, widths: widths.slice(0, 4), progress }));
  w.set('timelineImageCheckStep = STEP0;');
  check('while a timer is pending a second schedule call does nothing (one chain at a time)', (() => { w.set('timelineImageCheck = timelineImageCheckNew(); CANDS.forEach((c) => timelineImageResult(CTXQ, c));'); const t = []; w.sb.SETT2 = (fn) => { t.push(fn); return t.length; }; const a = w.get('timelineImageCheckSchedule(SETT2, NOW, PROG)'), b = w.get('timelineImageCheckSchedule(SETT2, NOW, PROG)'); return a === true && b === false && t.length === 1; })());
  // restart: a changed layer (the signature) clears the cache and the old job's timer does nothing
  w.set('timelineImageCheck = timelineImageCheckNew(); CANDS.slice(0, 4).forEach((c) => timelineImageResult(CTXQ, c));');
  const t2 = []; w.sb.SETT3 = (fn) => { t2.push(fn); return t2.length; };
  let prog2 = 0; w.sb.PROG3 = () => { prog2++; };
  w.set('timelineImageCheckSchedule(SETT3, NOW, PROG3);');
  w.set('additionalLayers[1].connections = additionalLayers[1].connections.slice().reverse();');
  const ctx4 = ctxNow(); w.sb.CTX4 = ctx4;
  w.set('timelineImageResult(CTX4, CANDS[0]);');
  t2.shift()();
  const st = w.get('({ done: timelineImageCheck.done, cache: timelineImageCheck.cache.size, total: timelineImageCheck.total })');
  check('the layers changed: the next ask starts a new cache (nothing carried over), the old job\'s timer finds a different state and does nothing (no error, no progress call)', prog2 === 0 && st.cache === 0 && st.done === 0 && st.total === 1, J(st));
  w.set('additionalLayers[1].connections = additionalLayers[1].connections.slice().reverse();');
  w.set('timelineImageCheck = timelineImageCheckNew();');
  const s1 = w.get('timelineImageSignature(timelineConclusiveContext(0))'); w.setMorph({ enabled: true, mode: 'radial', angleDeg: 0 }); const s2 = w.get('timelineImageSignature(timelineConclusiveContext(0))'); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  check('the signature also changes with the morph mode (a result is only valid for the mode it was measured in)', s1 !== s2 && s1 === w.get('timelineImageSignature(timelineConclusiveContext(0))'));
});

console.log('\n== 6. free line ends: no image test ==');
T('free', () => {
  const f = makeRenderWorld('square', 4, 3, 'rotation_reflection6'); f.baseConnections([]);
  const probe = f.addKeyframeLayer([[10, 14]]), L0 = f.get('additionalLayers[' + probe + ']'), inner = L0.nodes.filter((n) => !M.spatialMorphOnEdge(n, L0.outerCorners));
  let best = null; for (const a of inner) for (const b of inner) { const dd = Math.hypot(a.x - b.x, a.y - b.y); if (!best || dd > best.d) best = { a, b, d: dd }; }
  const a = f.addKeyframeLayer([[best.a.id, best.b.id]]), b = f.addKeyframeLayer([[best.a.id, best.b.id]]); f.setTimeline([a, b]);
  f.set(BUDGET_LINE + '\n' + NAMES.map(cut).join('\n') + '\nlet timelineImageCheck = timelineImageCheckNew();');
  f.set('CAND = { n: 1, orientation: false, items: [{ perm: [0] }] };');
  const r = f.get('(function () { const c = timelineConclusiveContext(0); const v = timelineConclusiveView(CAND, true, c); const s = timelineConclusiveImageStage(v, c); return { state: v.state, same: s.items === v.items, total: timelineImageCheck.total, queue: timelineImageCheck.job.queue.length }; })()');
  check('a layer with real free line ends (the diagonal between opposite inner nodes: 4 free ends on the closed set): state "free", the list unfiltered, nothing queued, no image test', r.state === 'free' && r.same && r.total === 0 && r.queue === 0, J(r));
});

console.log('\n== 7. texts and pins ==');
T('pins', () => {
  const I18N = rd('ui-i18n.js'), HTML = rd('index.html');
  check('the checking text exists in de and en with {done} and {total}; the count text is "{kept} von {total} schlüssig"', /'timeline\.conclusiveChecking': \{ de: 'wird geprüft \{done\} von \{total\}', en: 'checking \{done\} of \{total\}' \}/.test(I18N) && /'timeline\.conclusiveCount': \{ de: '\{kept\} von \{total\} schlüssig'/.test(I18N));
  check('the editor shows "checking" while pictures are pending and the count afterwards: the note takes the stage\'s pending / done / total and its kept items', /conclusiveStage\.pending > 0/.test(SK) && /UI\.t\('timeline\.conclusiveChecking', \{ done: conclusiveStage\.done, total: conclusiveStage\.total \}\)/.test(SK) && /UI\.t\('timeline\.conclusiveCount', \{ kept: conclusiveStage\.items\.length, total: conclusiveView\.total \}\)/.test(SK));
  check('the steppers use the image test (the score\'s booleans narrowed by timelineConclusiveRowImage), the list its stage; after every portion the editor re-renders (the schedule gets renderTimelinePairingEditor)', /timelineConclusiveRowImage\(conclusiveCtx, info\.perm/.test(SK) && /timelineConclusiveImageStage\(conclusiveView, conclusiveCtxB\)/.test(SK) && /timelineImageCheckSchedule\(setTimeout, \(\) => performance\.now\(\), renderTimelinePairingEditor\)/.test(SK));
  const draw = SK.slice(SK.indexOf('function draw()'), SK.indexOf('function draw()') + 6000);
  const imgSrc = NAMES.slice(4).map(cut).join('\n');
  check('draw() and the render path are not touched: no image-test name in draw(), none in the render file; the test code has no timer of its own except the injected one', !/timelineImage|spatialMorphTestPairingImage/.test(draw) && !/timelineImage|spatialMorphTestPairingImage|spatialMorphPairingFrame/.test(rd('core/spatial-morph-render.js')) && !/setTimeout\(|requestIdleCallback/.test(imgSrc.replace(/\/\/[^\n]*/g, '')));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
