// Morph stage d3 (K3): the "Only conclusive pairings" switch of the pairing editor, its LOGIC without a browser. The real functions are cut out of sketch.js (timelineEnrichPairingCandidates,
// timelineConclusiveContext, timelineConclusiveView, and the ones the context goes through: resolveTimelineKeyframeCoords with its pairing / flips / members readers) and run in a vm with the real
// core/spatial-morph.js. Only layerGroupElements is a stub (it needs core/orbits.js).
//   1. OFF: the list is the candidates' own array   2. ON: the separating pairing drops out, the conclusive one stays   3. n >= 2: the segment's set flips (and members) enter the score
//   4. empty: no substitute list   5. free line ends: the note state and the unfiltered list   6. poly is passed (boundary ends are not free)   7. source pins: switch default OFF, i18n keys, markup, no persistence
//   node tools/morph/test-timeline-conclusive-filter.js
//   SKETCH_JS / SPATIAL_MORPH_JS=/path/to/mutated/file.js node tools/morph/test-timeline-conclusive-filter.js        (sabotage runs)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const CORE = fs.readFileSync(process.env.SPATIAL_MORPH_JS || path.join(ROOT, 'core', 'spatial-morph.js'), 'utf8');
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const M = require(process.env.SPATIAL_MORPH_JS || path.join(ROOT, 'core', 'spatial-morph.js'));

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 300)); } };
const J = (x) => JSON.stringify(x);
const layer = (nodes, connections, outerCorners) => ({ nodes: nodes.map(([id, x, y]) => ({ id, x, y })), connections, outerCorners: outerCorners || null });
const perms = (n) => n <= 1 ? [[0]] : perms(n - 1).flatMap((p) => Array.from({ length: n }, (_, k) => [...p.slice(0, k), n - 1, ...p.slice(k)]));

const cut = (name) => { const m = SKETCH.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); return m ? m[0] : null; };
const NAMES = ['timelineEnrichPairingCandidates', 'timelineConclusiveContext', 'timelineConclusiveFree', 'timelineConclusiveRowVariants', 'timelineConclusiveStep', 'timelineConclusiveView', 'resolveTimelineKeyframeCoords', 'resolveConnectionsToCoords', 'getSegmentPairing', 'isValidPairing', 'isValidFlips', 'getSegmentFlips',
  'applyFlipsToCoords', 'memberImageLines', 'sanitizeMembers', 'isValidMemberArray'];
function world(layers, tl, ge) {
  const sb = { additionalLayers: layers, timeline: tl, layerGroupElements: () => ge || null };
  vm.createContext(sb);
  vm.runInContext(CORE, sb);
  NAMES.forEach((n) => { const src = cut(n); if (!src) throw new Error('not found in sketch.js: ' + n); vm.runInContext(src, sb); });
  return { sb, run: (code) => vm.runInContext(code, sb) };
}
const tl = (flips, members) => ({ keyframeLayerIds: [0, 1], segmentPairings: [null], segmentFlips: [flips || null], segmentMembers: [members || null], segmentDurationsMs: [1000] });

const SQ = [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -100, y: 100 }];
const A = layer([[1, 0, 0], [2, 10, 0], [3, 0, 10]], [[1, 2], [2, 3], [3, 1]], SQ);
const B = layer([[1, 0, 0], [2, 0, 12], [3, -7, 0]], [[1, 2], [2, 3], [3, 1]], SQ);
const cands = (list) => ({ n: 3, orientation: false, items: list.map((perm, i) => ({ perm, displacement: 100 + i })) });
const ALL = perms(3), ID = ALL.findIndex((p) => J(p) === '[0,1,2]');
const view = (w, cand, on, seg) => w.run(`timelineConclusiveView(${J(cand)}, ${on}, timelineConclusiveContext(${seg || 0}))`);

console.log('== 1. OFF ==');
T('off', () => {
  const w = world([A, B], tl()), c = cands(ALL);
  w.sb.CAND = c;
  const v = w.run('timelineConclusiveView(CAND, false, timelineConclusiveContext(0))');
  check('OFF: state "off" and the list is the candidates\' OWN array (identical, not a copy), nothing scored', v.state === 'off' && v.items === c.items && v.kept === 6 && v.total === 6);
  const f = w.run('timelineConclusiveView(CAND, true, null)');
  check('ON without a context (segment does not resolve): the same, unfiltered', f.state === 'off' && f.items === c.items);
});

console.log('\n== 2. ON: conclusive stays, separating drops out ==');
T('on', () => {
  const w = world([A, B], tl()), c = cands(ALL); w.sb.CAND = c;
  const v = w.run('timelineConclusiveView(CAND, true, timelineConclusiveContext(0))');
  check('state "ok"; of the 6 permutations (no flips set) the list holds those that keep every node whole, with their score', v.state === 'ok' && v.items.length === v.kept && v.kept > 0 && v.kept < 6 && v.total === 6 && v.items.every((it) => it.score && it.score.dangling === 0 && it.score.nodeMiss === 0), v.kept);
  check('the order is the filter\'s: best score first (displacement field of the candidate does not decide)', v.items.every((it, i) => i === 0 || v.items[i - 1].score.dist <= it.score.dist));
  check('the candidates themselves were not changed (no flips / members / score fields written into them)', c.items.every((it) => !('score' in it) && !('flips' in it) && !('members' in it)));
});

console.log('\n== 3. n >= 2: the set flips enter the score ==');
T('flips', () => {
  const c = cands(ALL);
  const none = world([A, B], tl()); none.sb.CAND = c;
  const vNone = none.run('timelineConclusiveView(CAND, true, timelineConclusiveContext(0))');
  const flipped = world([A, B], tl([true, true, true])); flipped.sb.CAND = c;
  const ctx = flipped.run('timelineConclusiveContext(0)');
  const vFlip = flipped.run('timelineConclusiveView(CAND, true, timelineConclusiveContext(0))');
  check('the context carries the segment\'s flips as the render resolves them', J(ctx.flips) === '[true,true,true]' && ctx.members === null && J(ctx.poly) === J(SQ));
  check('the identity pairing is conclusive without flips and separates once every End line is set reversed (then [2,1,0] is the conclusive one): in the first list and not in the second, and the other way round', vNone.items.some((it) => J(it.perm) === '[0,1,2]') && !vFlip.items.some((it) => J(it.perm) === '[0,1,2]') && !vNone.items.some((it) => J(it.perm) === '[2,1,0]') && vFlip.items.some((it) => J(it.perm) === '[2,1,0]'));
  check('the kept candidates of the flipped segment carry those flips (the filter scored the pairing that will be drawn)', vFlip.items.length > 0 && vFlip.items.every((it) => J(it.flips) === '[true,true,true]'));
  const en = none.run('timelineEnrichPairingCandidates([{ perm: [0, 1], displacement: 5 }, { perm: [0], flips: [true], members: [2] }], [true, false], [1, 0])');
  check('enrichment: a candidate without flips / members gets the segment\'s, one with its own keeps them, extra fields stay; the input is not changed', J(en) === J([{ perm: [0, 1], displacement: 5, flips: [true, false], members: [1, 0] }, { perm: [0], flips: [true], members: [2] }]));
  // members: a group element that swaps nodes 2 and 3 of the End layer, set on End line 0
  const ge = { groupOrder: 2, perms: [new Map(), new Map([[1, 1], [2, 3], [3, 2]])] };
  const mem = world([A, B], tl(null, [1, 0, 0]), ge); mem.sb.CAND = c;
  const mctx = mem.run('timelineConclusiveContext(0)'), mv = mem.run('timelineConclusiveView(CAND, true, timelineConclusiveContext(0))');
  const direct = mem.run(`spatialMorphFilterPairingCandidates(additionalLayers[0], additionalLayers[1], CAND.items.map((p) => Object.assign({}, p, { flips: null, members: [1, 0, 0] })), { poly: additionalLayers[0].outerCorners, groupElements: layerGroupElements() })`);
  check('members set on the segment: the context has them and the group elements; the view equals the filter called with those members', J(mctx.members) === '[1,0,0]' && !!mctx.groupElements && J(mv.items.map((i) => i.perm)) === J(direct.kept.map((i) => i.perm)));
});

console.log('\n== 4. empty ==');
T('empty', () => {
  const w = world([A, B], tl()); const all = cands(ALL); w.sb.CAND = all;
  const good = w.run('timelineConclusiveView(CAND, true, timelineConclusiveContext(0))').items.map((i) => J(i.perm));
  const c = cands(ALL.filter((p) => !good.includes(J(p)))); w.sb.CAND = c;
  const v = w.run('timelineConclusiveView(CAND, true, timelineConclusiveContext(0))');
  check('only separating pairings in the list: state "empty", items [] (no substitute list), kept 0, total = the list', c.items.length > 0 && v.state === 'empty' && Array.isArray(v.items) && v.items.length === 0 && v.kept === 0 && v.total === c.items.length);
});

console.log('\n== 5. free line ends ==');
T('free', () => {
  const specs = JSON.parse(rd('tools/morph/off-path-specs.json')), sp = specs.find((x) => x.curve && x.curve.kind === 'free');
  const ids = [...new Set(sp.connections.flat())], L = layer(ids.map((id, k) => [id, 10 + 15 * k, 20 + 7 * (k % 3)]), sp.connections, SQ);
  const w = world([L, L], tl()), c = cands(ALL); w.sb.CAND = c;
  const v = w.run('timelineConclusiveView(CAND, true, timelineConclusiveContext(0))');
  check('a layer with free line ends (six, off-path-specs "free-seeded"): state "free" and the list unfiltered (the candidates\' own array)', v.state === 'free' && v.items === c.items && v.kept === 6);
  const w2 = world([A, L], tl()); w2.sb.CAND = c;
  check('it is enough that ONE of the two layers has them', w2.run('timelineConclusiveView(CAND, true, timelineConclusiveContext(0))').state === 'free');
});

console.log('\n== 6. the polygon is passed ==');
T('poly', () => {
  const P = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const TA = layer([[1, 20, 20], [2, 60, 20], [3, 40, 60], [4, 0, 50], [5, 100, 50]], [[1, 2], [2, 3], [3, 1], [4, 5]], P);
  const TB = layer([[1, 22, 25], [2, 58, 24], [3, 44, 55], [4, 0, 40], [5, 100, 60]], [[1, 2], [2, 3], [3, 1], [4, 5]], P);
  const w = world([TA, TB], tl()); w.sb.CAND = { n: 4, orientation: false, items: [{ perm: [0, 1, 2, 3], displacement: 1 }] };
  const v = w.run('timelineConclusiveView(CAND, true, timelineConclusiveContext(0))');
  check('a triangle plus a line from edge to edge: the boundary ends are not free (poly = the start layer\'s outerCorners), so the filter applies and keeps the identity', w.run('timelineConclusiveContext(0)').poly === TA.outerCorners && v.state === 'ok' && v.kept === 1, v.state);
});

console.log('\n== 7. source pins ==');
T('pins', () => {
  const HTML = rd('index.html'), I18N = rd('ui-i18n.js');
  check('the model\'s button: aria-pressed="true" in the markup (ON at load), its text is the German label and carries the i18n key; no label / checkbox (the netwarp test forbids them in the timeline group)', /<button type="button" id="timeline-pairing-conclusive" class="layer-btn" aria-pressed="true" data-i18n="timeline\.conclusiveOnly">Nur schlüssige Zuordnungen<\/button>/.test(HTML) && !/id="timeline-pairing-conclusive"[^>]*type="checkbox"/.test(HTML));
  check('ONE state variable, ON at load, nothing stores it (no session field, no export, no storage call near it); the button only mirrors it and a click flips it', /let timelinePairingConclusive = true;/.test(SKETCH) && /timelinePairingConclusive = !timelinePairingConclusive;/.test(SKETCH) && (SKETCH.match(/let timelinePairingConclusive\b/g) || []).length === 1 && !/(localStorage|sessionStorage)[^\n]*onclusive/i.test(SKETCH) && !/onclusive[^\n]*(session|exportJson|serialize)/i.test(SKETCH.replace(/\/\/[^\n]*/g, '')) && /setAttribute\('aria-pressed', timelinePairingConclusive \? 'true' : 'false'\)/.test(SKETCH));
  check('the button is disabled when the filter cannot apply (no context: the segment does not resolve; free line ends)', /conclusiveBox\.elt\.disabled = !conclusiveCtx \|\| conclusiveFree;/.test(SKETCH));
  const upDown = SKETCH.slice(SKETCH.indexOf("const up = document.createElement('button');"), SKETCH.indexOf("const flip = document.createElement('button');"));
  check('▲ ▼ are NOT touched by the filter: their disabled state is still only the position (first / last row) and no filter name appears in their code', /up\.disabled = row === 0;/.test(upDown) && /down\.disabled = row === info\.n - 1;/.test(upDown) && !/onclusive/.test(upDown) && upDown.length > 400);
  check('‹ › are filtered: the stepper takes the conclusive targets (prev / next of timelineConclusiveStep), is disabled without one, and the count shows k (– for 0) of c', /timelineConclusiveRowVariants\(conclusiveCtx, info\.perm, info\.flips, info\.members, endIdx, variants\)/.test(SKETCH) && /if \(stp\) prevBtn\.disabled = prevTarget < 0;/.test(SKETCH) && /if \(stp\) nextBtn\.disabled = nextTarget < 0;/.test(SKETCH) && /variants\[prevTarget\]/.test(SKETCH) && /variants\[nextTarget\]/.test(SKETCH) && /stp\.k > 0 \? stp\.k : '\\u2013'/.test(SKETCH));
  const keys = ['timeline.conclusiveOnly', 'timeline.conclusiveCount', 'timeline.conclusiveNone', 'timeline.conclusiveFree'];
  check('the four texts exist in de and en; the German "none" text is the brief\'s', keys.every((k) => new RegExp(`'${k.replace('.', '\\.')}': \\{ de: '[^']+', en: '[^']+' \\}`).test(I18N)) && /Keine schlüssige Zuordnung\. Filter ausschalten, um alle zu sehen\./.test(I18N) && /Ebene hat freie Linienenden, Filter nicht anwendbar/.test(I18N));
  check('the list code uses the view\'s own order for state "ok" and sorts as before otherwise', /conclusiveView\.state === 'ok'\s*\n?\s*\? shown/.test(SKETCH) && /shown\.sort\(\(a, b\) => \(a\.displacement - b\.displacement\) \* dir \|\| cmpPerm\(a\.perm, b\.perm\)\)/.test(SKETCH));
  const bodies = NAMES.slice(0, 6).map(cut).join('\n');
  check('the six new functions touch no store and no DOM (no write to timeline / additionalLayers, no document / window / select)', !/\b(document|window|select|additionalLayers|segmentPairings\s*=|\.segmentFlips\s*=|\.segmentMembers\s*=)\b/.test(bodies.replace(/\/\/[^\n]*/g, '')));
});

console.log('\n== 8. the row stepper (‹ k/c ›) over the conclusive variants ==');
T('step', () => {
  const w = world([A, B], tl());
  const st = (ok, cur) => w.run(`timelineConclusiveStep(${J(ok)}, ${cur})`);
  check('4 variants, 1 not conclusive: at 2 of 3 (current = index 2) the neighbours skip the index 1', J(st([true, false, true, true], 2)) === J({ k: 2, c: 3, prev: 0, next: 3 }));
  check('the current variant is not conclusive: k is 0 ("–"), ‹ goes to the previous conclusive one, › to the next, both in the row\'s own order, cyclic', J(st([true, false, true, true], 1)) === J({ k: 0, c: 3, prev: 0, next: 2 }) && J(st([false, true, true, false], 3)) === J({ k: 0, c: 2, prev: 2, next: 1 }));
  check('wrap-around: from the last conclusive one › goes to the first and ‹ from the first to the last', J(st([true, false, true], 2)) === J({ k: 2, c: 2, prev: 0, next: 0 }) && J(st([true, false, true], 0)).includes('"prev":2') && J(st([true, false, true], 0)).includes('"next":2'));
  check('the only conclusive one is the current one: c 1, no target either way; none conclusive: c 0, k 0, no target', J(st([false, true, false], 1)) === J({ k: 1, c: 1, prev: -1, next: -1 }) && J(st([false, false], 0)) === J({ k: 0, c: 0, prev: -1, next: -1 }));
  const ge = { groupOrder: 2, perms: [new Map(), new Map([[1, 1], [2, 3], [3, 2]])] };
  const w2 = world([A, B], tl(), ge); const ctx = w2.run('timelineConclusiveContext(0)');
  w2.sb.CTX = ctx;
  const ok = w2.run('timelineConclusiveRowVariants(CTX, [0, 1, 2], [false, false, false], [0, 0, 0], 0, [{ g: 0, f: false }, { g: 0, f: true }, { g: 1, f: false }])');
  const want = [{ g: 0, f: false }, { g: 0, f: true }, { g: 1, f: false }].map((v) => { const s = M.spatialMorphScorePairing(A, B, [0, 1, 2], [v.f, false, false], [v.g, 0, 0], { poly: ctx.poly, groupElements: ge }); return s.dangling === 0 && s.nodeMiss === 0 && s.boundaryMiss === 0; });
  check('timelineConclusiveRowVariants: reversing only End line 0 splits a node (not conclusive), the unchanged variant is; the booleans equal the score of the whole pairing with that variant set (incl. a group element)', J(ok) === J(want) && ok[0] === true && ok[1] === false, J(ok));
  check('the context always carries the group elements when the layer has them (a variant may name an element although the segment has no members yet)', !!ctx.groupElements && ctx.members === null);
  const before = J([A, B]); w2.run('timelineConclusiveRowVariants(CTX, [0, 1, 2], [false, false, false], [0, 0, 0], 0, [{ g: 0, f: true }])');
  check('pure: the layers and the arguments are unchanged', J([A, B]) === before);
});

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
