// Guard for the render hook of the spatial morph (morph stage c): core/spatial-morph-render.js and the one guarded line at the top of drawTessellation() in core/tiling.js.
// Everything runs on the REAL core files in a vm (tools/morph/render-harness.js); a frame is read from segmentCollector (the chords) or from the line() / bezier() calls (what is drawn).
// Properties (every one is a check below):
//   1. the pure helpers (keyframe planning with its status codes, the symmetry operations = core/symmetry.js, the span, its key);
//   2. the hook is ONE added line: the rest of core/tiling.js is byte-identical to the tree before stage c (sha256), it is the first statement of drawTessellation() and typeof-guarded (the gallery
//      loads tiling.js without state.js and without this file); the eight functions the two protected netwarp tests cut out of sketch.js are untouched and name no morph global; no hotkey, no event handler;
//   3. SWITCH OFF: the default is off, the status says 'off', and 30 patterns (12 corpus, 6 with layers, 6 with a timeline paused and at progress values, 3 with a net warp, 3 with curves) draw exactly what
//      the tree before the hook drew (a hash of every line() / bezier() call, OFF_GOLDEN, taken from core/tiling.js of commit c432056c);
//   4. SWITCH ON: identical keyframes give the normal frame, call for call (3 shapes x symmetry families x 3 modes x 2 / 3 / 4 keyframes, curves and free lines too); with different keyframes the tiles at
//      the extremes of the span draw exactly the keyframe's own pattern; the seams of the REAL drawn segments stay closed (max drift reported);
//   5. the status codes of every pre-condition failure (the normal frame is drawn, nothing throws, nothing is logged), the net, the timeline, the faces, the SVG export, the JSON export;
//   6. the span is frozen per lattice; the recorder is always put back.
//   node tools/morph/test-spatial-morph-render.js
//   SPATIAL_MORPH_JS=... SPATIAL_MORPH_RENDER_JS=... TILING_JS=... STATE_JS=... SKETCH_JS=... node tools/morph/test-spatial-morph-render.js        (sabotage runs)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const { makeRenderWorld } = require('./render-harness.js');
const { offPathScript } = require('./off-path-script.js');
const H = require('./morph-harness.js');
const M = require(process.env.SPATIAL_MORPH_JS || path.join(ROOT, 'core', 'spatial-morph.js'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const TILING_SRC = fs.readFileSync(process.env.TILING_JS || path.join(ROOT, 'core', 'tiling.js'), 'utf8');
const RENDER_SRC = fs.readFileSync(process.env.SPATIAL_MORPH_RENDER_JS || path.join(ROOT, 'core', 'spatial-morph-render.js'), 'utf8');
const SKETCH_SRC = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const STATE_SRC = fs.readFileSync(process.env.STATE_JS || path.join(ROOT, 'core', 'state.js'), 'utf8');
const SPECS = JSON.parse(read('tools/morph/off-path-specs.json'));

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw)', false, String(e && e.stack).slice(0, 400)); } };
const J = (x) => JSON.stringify(x);
const same = (a, b) => J(a) === J(b);
const hashOf = (x) => sha(J(x)).slice(0, 16);

// ---- the tree before stage c (commit c432056c): pins ------------------------------------------------------------------------------------------------------------------------------------------
const PIN = {
  tilingBefore: 'b33c97b80a8c89f5a1d1a6b0712be3715de419de16afc77b3da57988a1614446',
  protectedBodies: 'be4bb9036e806619d0897acdf086777423845a31e0b07a35e1bfc220ce5d6c8e',
};
// the segment-call hash of every one of the 30 OFF patterns, from core/tiling.js of c432056c (node tools/morph/off-path-tool.js --hashes with TILING_JS = `git show c432056c:core/tiling.js`)
const OFF_GOLDEN = {
  'corpus-0': 'e343be8f86931b24', 'corpus-10': '9b147512407b68bd', 'corpus-38': 'aad3411535e0abfe', 'corpus-63': '5714242a4189e783', 'corpus-89': '6e36170e63ad9b79', 'corpus-119': 'e88892575374fe58', 'corpus-144': 'b21a7aee8f618373', 'corpus-172': '7eb2f8f4bc01565b', 'corpus-201': '40ca93a30130d4ca',
  'corpus-230': '266f25836f2f5479', 'corpus-5': '6d6b4adf1e1e0dc7', 'corpus-100': 'a76a14d0c915db5d', 'layers-offset': '21bdd633105ff203', 'layers-rotated': 'e9453a0a7402586f', 'layers-scaled': '91ecb6192a18de3b', 'layers-hex-on-square': '2d948bddee3a3eb4', 'layers-two': 'd8b3c32db0ae4b68',
  'layers-triangle-on-hex': '14facb6171f3dfc0', 'timeline-2kf-start': '084b6d392eb97213', 'timeline-3kf-paused-05': '66cc09fd1d12eff1', 'timeline-2kf-play-25': 'e911f67779c336d0', 'timeline-2kf-play-50': '6075ac4506d12b55', 'timeline-3kf-play-60': 'f15c32786a36bf02',
  'timeline-3kf-play-90': 'bab1fff6669c4964', 'net-sin-field': '42478f528dbb6f01', 'net-tiled': '67333a2973ad283d', 'net-geo': '2e0014a254d58cfa', 'curve-fold2': '1c7e84fa3fe6af89', 'curve-fold1-sym': '9161d68fec71f7d2', 'free-seeded': '4581b0a793e10509',
};

// ---- 1. the pure helpers --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('== 1. the pure helpers ==');
T('helpers', () => {
  const P = M.spatialMorphPlanKeyframes;
  const lay = (shape, n, extra) => Object.assign({ shape, lineCount: n }, extra || {});
  check('the status codes are the documented list and frozen', same(M.spatialMorphStatusCodes, ['off', 'ok', 'netActive', 'needsTwoKeyframes', 'shapeMismatch', 'lineCountMismatch', 'alignmentFailed', 'renderError']) && Object.isFrozen(M.spatialMorphStatusCodes));
  check('plan: two layers of the same shape and count are keyframes; a timeline order is kept', same(P([lay('square', 3), lay('square', 3), lay('square', 3)], { mode: 'bilinear', timelineIds: [2, 0] }).ids, [2, 0, 1]) && same(P([lay('square', 3), lay('square', 3)], { mode: 'linear', timelineIds: [1, 0] }).ids, [1, 0]));
  const codes = [
    ['no layers and nothing else', [], {}, 'needsTwoKeyframes'], ['one layer, no base', [lay('square', 3)], { mode: 'bilinear' }, 'needsTwoKeyframes'],
    ['one layer with no lines', [lay('square', 0), lay('square', 3)], { mode: 'bilinear' }, 'needsTwoKeyframes'], ['playback layers do not count', [lay('square', 3, { isPlayback: true }), lay('square', 3)], { mode: 'linear' }, 'needsTwoKeyframes'],
    ['two layers of different shapes (bilinear)', [lay('square', 3), lay('hex', 3)], { mode: 'bilinear' }, 'shapeMismatch'], ['two layers of different shapes (linear)', [lay('square', 3), lay('hex', 3)], { mode: 'linear' }, 'shapeMismatch'],
    ['two layers with other counts (bilinear)', [lay('square', 3), lay('square', 4)], { mode: 'bilinear' }, 'lineCountMismatch'], ['two layers with other counts (radial)', [lay('square', 3), lay('square', 4)], { mode: 'radial' }, 'lineCountMismatch'],
    ['a layer and a base of another count', [lay('square', 3)], { mode: 'bilinear', base: { shape: 'square', lineCount: 4 } }, 'needsTwoKeyframes'],
  ];
  codes.forEach(([what, layers, o, code]) => { const r = P(layers, o); check(`plan: ${what} -> ${code}`, r.ok === false && r.code === code, J(r)); });
  check('plan: one layer and a matching base sheet is a pair (the base is keyframe 0)', same(P([lay('square', 3)], { mode: 'bilinear', base: { shape: 'square', lineCount: 3 } }), { ok: true, ids: ['base', 0], source: 'base' }));
  check('plan: garbage never throws', [undefined, null, 'x', [null], [{}], [5]].every((l) => { try { return P(l, undefined).ok === false; } catch (e) { return false; } }));
  // the operations = what drawConnectionWithSymmetry() draws
  const w = makeRenderWorld('square', 3, 3, 'none');
  let ok = true, bad = '';
  for (const shape of ['square', 'triangle', 'hex']) for (const mode of ['none', 'reflection_only', 'rotation3', 'rotation6', 'rotation_reflection3', 'rotation_reflection6']) {
    const calls = w.run(`(function () { const out = []; const real = drawCurvedBezier; drawCurvedBezier = (p1, p2, ct) => out.push([p1.x, p1.y, ct && ct.leaning]); try { drawConnectionWithSymmetry({ x: 310, y: 280 }, { x: 330, y: 301 }, { x: 300, y: 300 }, 1, 2, { x: 0, y: 1 }, ${J(shape)}, ${J(mode)}); } finally { drawCurvedBezier = real; } return out.length; })()`);
    const ops = M.spatialMorphSymmetryOps(shape, mode);
    if (ops.ops.length !== calls || ops.hasReflection !== (mode === 'reflection_only' || mode.startsWith('rotation_reflection'))) { ok = false; bad = shape + '/' + mode + ' ' + ops.ops.length + ' vs ' + calls; }
  }
  check('the symmetry operations: for 3 shapes x 6 modes the number of copies equals what core/symmetry.js draws, and the reflection flag is right', ok, bad);
  check('the operations come in drawing order: identity, rotations, the reflection, the reflected rotations', same(M.spatialMorphSymmetryOps('hex', 'rotation_reflection6').ops.map((o) => (o.reflected ? 'm' : '') + o.angle), ['0', '60', '120', '180', '240', '300', 'm0', 'm60', 'm120', 'm180', 'm240', 'm300']));
  // span
  const grid = []; for (let i = -2; i <= 8; i++) for (let j = -2; j <= 8; j++) grid.push({ x: i * 100 + 50, y: j * 100 + 50 });
  const sp = M.spatialMorphSpanFromCentroids('linear', grid, 600, 600, { angleDeg: 0 });
  check('span (linear 0): the scan takes only the centroids strictly inside the canvas: x from 50 to 550', sp.scalarMin === 50 && sp.scalarMax === 550 && sp.minX === 50 && sp.maxX === 550 && sp.minY === 50 && sp.maxY === 550, J(sp));
  const sb = M.spatialMorphSpanFromCentroids('bilinear', grid, 600, 600, {});
  check('span (bilinear): the x and y extent of the same centroids', sb.minX === 50 && sb.maxX === 550 && sb.minY === 50 && sb.maxY === 550);
  const sr = M.spatialMorphSpanFromCentroids('radial', grid, 600, 600, {});
  check('span (radial): the nearest and the farthest centroid from the canvas centre', Math.abs(sr.scalarMin - Math.hypot(50, 50)) < 1e-12 && Math.abs(sr.scalarMax - Math.hypot(250, 250)) < 1e-12, J(sr));
  const coarse = [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 0, y: 600 }, { x: 600, y: 600 }];
  check('span: coarse grids whose centroids lie ON the canvas edge fall back to the closed canvas; no usable range gives 0..W', M.spatialMorphSpanFromCentroids('bilinear', coarse, 600, 600, {}).maxX === 600 && same(M.spatialMorphSpanFromCentroids('linear', [{ x: 5, y: 5 }], 600, 600, {}), { scalarMin: 0, scalarMax: 600, minX: 0, maxX: 600, minY: 0, maxY: 600 }));
  check('span: garbage never throws and gives a finite span', [undefined, [], [null], [{ x: NaN, y: 1 }]].every((c) => { const s = M.spatialMorphSpanFromCentroids('linear', c, NaN, undefined, null); return Object.values(s).every(Number.isFinite); }));
  const k = (o) => M.spatialMorphSpanKey(o.mode, o.angle, o.shape, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], o.W, 600, [{ x: 1, y: 2 }, { x: 3, y: 4 }]);
  const base = { mode: 'linear', angle: 45, shape: 'square', W: 600 };
  check('span key: the same input the same key; another mode, angle (linear), shape, canvas or lattice gives another; the angle does not matter outside linear',
    k(base) === k(Object.assign({}, base)) && k(base) !== k(Object.assign({}, base, { mode: 'radial' })) && k(base) !== k(Object.assign({}, base, { angle: 90 })) && k(base) !== k(Object.assign({}, base, { shape: 'hex' })) && k(base) !== k(Object.assign({}, base, { W: 601 }))
    && k(Object.assign({}, base, { mode: 'radial', angle: 1 })) === k(Object.assign({}, base, { mode: 'radial', angle: 2 })) && M.spatialMorphSpanKey('linear', 0, 's', [], 600, 600, [{ x: 1, y: 2 }]) !== M.spatialMorphSpanKey('linear', 0, 's', [], 600, 600, [{ x: 1, y: 2 }, { x: 1, y: 2 }]));
  // the exact rule for an unmoved endpoint
  const d = M.spatialMorphPrepareEndpoint([{ x: 0.1 + 0.2, y: 7.3 }, { x: 0.1 + 0.2, y: 7.3 }, { x: 0.1 + 0.2, y: 7.3 }, { x: 0.1 + 0.2, y: 7.3 }], [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
  const p = M.spatialMorphAnchoredPoint(d, { w00: 0.1, w10: 0.7, w01: 0.15, w11: 0.05 }, null);
  check('an endpoint that does not move is returned as it is (the same doubles), whatever the weights: a blend of four equal points could differ by an ulp and the morph of equal keyframes must be the normal frame', p.x === 0.1 + 0.2 && p.y === 7.3);
});

// ---- 2. the hook is one line ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\n== 2. what changed in the existing files ==');
T('pins', () => {
  const HOOK = "    if (typeof spatialMorphTryDraw === 'function' && spatialMorphTryDraw()) return;";
  const lines = TILING_SRC.split('\n');
  const hookLines = lines.filter((l) => l.includes('spatialMorph'));
  check('core/tiling.js names the morph in exactly ONE line: the guarded call', hookLines.length === 1 && hookLines[0].startsWith(HOOK), hookLines.length + ' lines');
  const rest = lines.filter((l) => !l.includes('spatialMorph')).join('\n');
  check('...and without that line the file is byte-for-byte core/tiling.js of c432056c (sha256)', sha(rest) === PIN.tilingBefore, sha(rest).slice(0, 12));
  const m = /function drawTessellation\(\) \{\n([^\n]*)\n/.exec(TILING_SRC);
  check('the guarded call is the FIRST statement of drawTessellation() and returns when the morph was drawn', !!m && m[1].startsWith(HOOK));
  // the gallery: tiling.js alone, no state.js, no render file: the line must not throw and must not return
  const bare = vm.createContext({});
  let threw = null, took = null;
  const hookText = (hookLines[0] || '').trim().replace(/\s*return;.*$/, ' return true;');   // the line AS WRITTEN in the file, run in a context that has none of the page's globals
  try { took = vm.runInContext('(function () { ' + hookText + ' return false; })()', bare); } catch (e) { threw = e; }
  check('in a page without core/state.js and without core/spatial-morph-render.js (the gallery) the line does nothing: no ReferenceError, no early return', threw === null && took === false, threw && threw.message);
  // sketch.js
  const grab = (name) => { const mm = SKETCH_SRC.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!mm) throw new Error('cannot extract ' + name); return mm[0]; };
  const NAMES = ['applyTimelineFrame', 'applyLayerConnectionsMorphFrame', 'resolveTimelineKeyframeCoords', 'resolveTimelineSegment', 'totalTimelineDurationMs', 'setTimelineProgress', 'toggleTimelinePlayback', 'previewTimelineSegmentMidpoint'];
  const bodies = NAMES.map(grab).join('\n');
  check('the eight functions the protected netwarp tests cut out of sketch.js are byte-identical to c432056c (sha256) and name no morph global', sha(bodies) === PIN.protectedBodies && !/spatialMorph/.test(bodies), sha(bodies).slice(0, 12));
  check('sketch.js does not mention the morph at all in this stage (the hook lives in core/)', !/spatialMorph/.test(SKETCH_SRC));
  check('the render file has no hotkey, no keyPressed, no event handler, no DOM access and no block comment inside a function body',
    !/keyPressed|keyCode|\bkey\b\s*===|addEventListener|document\.|window\.|localStorage|sessionStorage|setTimeout|setInterval/.test(RENDER_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')));
  const topLevel = (src) => { const s = src.replace(/\/\*[\s\S]*?\*\//g, (x) => x.replace(/[^\n]/g, ' ')); const out = []; s.split('\n').forEach((line) => { let mm; if ((mm = /^(?:async\s+)?function\s*\*?\s*([\w$]+)/.exec(line)) || (mm = /^(?:const|let|var)\s+([\w$]+)/.exec(line)) || (mm = /^class\s+([\w$]+)/.exec(line))) out.push(mm[1]); }); return out; };
  const names = topLevel(RENDER_SRC);
  check(`every top-level name of the render file starts with spatialMorph (${names.length}: ${names.join(', ')})`, names.length > 0 && names.every((n) => /^spatialMorph[A-Z]/.test(n)), names.filter((n) => !/^spatialMorph[A-Z]/.test(n)).join());
  const DATA = JSON.parse(read('tools/ui/p5-names-1.9.0.json'));
  const { makeReader } = require(path.join(ROOT, 'tools', 'ui', 'p5-names-reader.js'));
  const R = makeReader(DATA);
  check('none of them is a p5 member, constant or global function (the frozen list)', names.every((n) => R.kindOf(n) === null && !DATA.members.includes(n) && !DATA.constants.includes(n) && !DATA.globalFunctions.includes(n)));
  const html = read('index.html');
  const tags = [...html.matchAll(/<script src="([^"?]+)\?v=([^"]+)"><\/script>/g)].map((x) => x[1]);
  check('index.html loads core/spatial-morph-render.js once, after core/spatial-morph.js and before core/session.js; gallery.html loads neither', tags.filter((t) => t === 'core/spatial-morph-render.js').length === 1 && tags.indexOf('core/spatial-morph-render.js') > tags.indexOf('core/spatial-morph.js') && tags.indexOf('core/spatial-morph-render.js') < tags.indexOf('core/session.js') && !/spatial-morph/.test(read('gallery.html')));
  const vs = new Set(); for (const f of ['index.html', 'gallery.html', 'color-harmony/ui/index.html']) [...read(f).matchAll(/\?v=(\d{8}[a-z]+)/g)].forEach((x) => vs.add(x[1]));
  check('the three HTML files carry one ?v= string', vs.size === 1, [...vs].join());
  const dflt = /^let spatialMorph = (\{[^}]*\});/m.exec(STATE_SRC);
  check('the switch is OFF by default (core/state.js)', !!dflt && Function('return ' + dflt[1])().enabled === false, dflt && dflt[1]);
});

// ---- 3. the switch OFF ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\n== 3. switch OFF: nothing changes ==');
T('off', () => {
  const worst = [];
  let n = 0, equal = 0;
  const seen = new Set();
  SPECS.forEach((s) => {
    const w = makeRenderWorld(s.shape, s.order, s.size, s.mode);
    w.run(offPathScript(s));
    const h = hashOf(w.drawn());
    n++; seen.add(h);
    if (OFF_GOLDEN[s.id] === h) equal++; else worst.push(s.id);
    if (w.status().code !== 'off' || w.get('spatialMorph.enabled') !== false) worst.push(s.id + ':status');
  });
  check(`${n} patterns (12 corpus, 6 with layers, 6 with a timeline, 3 with a net warp, 3 with curves) draw exactly what the tree before the hook drew: the hash of every line() / bezier() call equals OFF_GOLDEN (${equal}/${n}, ${seen.size} distinct)`, equal === n && n === 30 && seen.size === 30, worst.slice(0, 4).join(','));
  check('OFF_GOLDEN covers every pattern of the spec file and nothing else', same(Object.keys(OFF_GOLDEN).sort(), SPECS.map((s) => s.id).sort()) && SPECS.length === 30);
  const PX = JSON.parse(read('tools/morph/off-path-golden.json')).pixelHashes;
  check('the browser pixel golden (tools/morph/off-path-golden.json, recorded at c432056c) lists the same 30 patterns, each with a hash', same(Object.keys(PX).sort(), SPECS.map((s) => s.id).sort()) && Object.values(PX).every((v) => /^[0-9a-f]{1,8}:\d+$/.test(v)));
  // the render file absent (a page that does not load it): the same frames
  const s = SPECS.find((x) => x.id === 'layers-two');
  const w = makeRenderWorld(s.shape, s.order, s.size, s.mode);
  w.run(offPathScript(s));
  const h1 = hashOf(w.drawn());
  w.run('spatialMorphTryDraw = undefined; delete globalThis.spatialMorphTryDraw;');
  check('...and the same frames when the render file is not loaded at all (the typeof guard)', hashOf(w.drawn()) === h1 && w.get("typeof spatialMorphTryDraw") === 'undefined');
  check('with the switch off the hook returns false and leaves drawShapeCell() alone', (() => { const w2 = makeRenderWorld('square', 3, 3, 'none'); return w2.get('spatialMorphTryDraw()') === false && w2.get('drawShapeCell.name') === 'drawShapeCell'; })());
});

// ---- 4. the switch ON -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\n== 4. switch ON: identical keyframes are the normal frame ==');
const CONNS = { square: [[1, 5], [2, 8], [3, 7]], triangle: [[1, 5], [2, 6], [3, 4]], hex: [[1, 10], [3, 14], [5, 20]] };
const ALT = { square: [[1, 9], [2, 6], [4, 8]], triangle: [[1, 6], [2, 5], [3, 5]], hex: [[2, 11], [4, 15], [6, 21]] };
T('identical', () => {
  let cases = 0, equalCases = 0, firstBad = '';
  for (const shape of ['square', 'triangle', 'hex']) for (const sym of ['none', 'reflection_only', 'rotation_reflection3', 'rotation3']) for (const kfCount of [2, 3, 4]) {
    const w = makeRenderWorld(shape, 3, 3, sym);
    w.baseConnections(CONNS[shape]);
    const normal = hashOf(w.drawn());
    const ids = []; for (let i = 0; i < kfCount; i++) ids.push(w.addKeyframeLayer(CONNS[shape]));
    w.setTimeline(ids);
    for (const mode of ['linear', 'radial', 'bilinear']) {
      w.setMorph({ enabled: true, mode, angleDeg: mode === 'linear' ? 135 : 0 });
      const h = hashOf(w.drawn()); cases++;
      if (h === normal && w.status().code === 'ok') equalCases++; else if (!firstBad) firstBad = `${shape}/${sym}/${kfCount}kf/${mode} ${w.status().code}`;
    }
  }
  check(`identical keyframes: the morph draws EXACTLY the normal frame, call for call (${equalCases}/${cases}: 3 shapes x 4 symmetry modes x 2/3/4 keyframes x linear/radial/bilinear)`, equalCases === cases, firstBad);
  // curves and free lines (the chord is not enough: the drawn calls)
  let curveOk = 0, curveN = 0, bad = '';
  const curves = [{ kind: 'curve', fold: 2, symmetric: false, leaning: 'left', strength: 25 }, { kind: 'curve', fold: 1, symmetric: true, leaning: 'left', strength: 25 }, { kind: 'free', seed: 123456789, roughness: 1, strength: 25, visible: true }];
  for (const ct of curves) for (const sym of ['none', 'rotation_reflection3']) {
    const w = makeRenderWorld('square', 3, 3, sym);
    w.baseConnections(CONNS.square); w.set(`curveType = ${J(ct)};`);
    const normal = hashOf(w.drawn());
    const a = w.addKeyframeLayer(CONNS.square), b = w.addKeyframeLayer(CONNS.square); w.setTimeline([a, b]);
    w.setMorph({ enabled: true, mode: 'bilinear', angleDeg: 0 });
    curveN++; if (hashOf(w.drawn()) === normal) curveOk++; else bad = ct.kind + '/' + sym;
  }
  check(`curves and free lines: the morph of identical keyframes is the normal frame call for call, the free curve seeded by the same node ids (${curveOk}/${curveN})`, curveOk === curveN, bad);
  // different keyframes really differ
  const w = makeRenderWorld('square', 3, 3, 'none');
  w.baseConnections(CONNS.square);
  const a = w.addKeyframeLayer(CONNS.square), b = w.addKeyframeLayer(ALT.square); w.setTimeline([a, b]);
  const normal = hashOf(w.drawn());
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  check('different keyframes give a different frame (the morph is not the normal frame)', hashOf(w.drawn()) !== normal && w.status().code === 'ok');
  const f = w.frame();
  check('the morph frame has one chord per tile x line x copy, all finite', f.length > 0 && f.every((s) => [s.x1, s.y1, s.x2, s.y2].every(Number.isFinite)));
});

// keyframe layers whose lines are the a2 test corner sets (custom nodes; every boundary endpoint slides on ITS OWN edge between the keyframes, which is the case the seam guarantee covers)
function cornerLayers(w, built, which) {
  return which.map((k) => {
    const nodes = [], conns = [];
    built.corners[k].forEach((l, i) => { nodes.push({ id: 2 * i + 1, x: l.x1, y: l.y1 }, { id: 2 * i + 2, x: l.x2, y: l.y2 }); conns.push([2 * i + 1, 2 * i + 2]); });
    const id = w.addKeyframeLayer(conns);
    w.set(`additionalLayers[${id}].nodes = ${J(nodes)};`);
    return { id, nodes, conns };
  });
}
T('extremes', () => {
  for (const shape of ['square', 'triangle', 'hex']) for (const sym of ['none', 'rotation_reflection3']) {
    const a2 = H.makeWorld(shape, 3, 3, 600);
    const built = H.buildClosedCorners(M, a2, sym, 500 + shape.length);
    const w = makeRenderWorld(shape, 3, 3, sym);
    const L = cornerLayers(w, built, ['k00', 'k10']);
    w.setTimeline(L.map((l) => l.id));
    // the normal frames of the two keyframe patterns: the base sheet holds the pattern (its own nodes), no morph
    const asBase = (l) => { w.set(`nodes = ${J(l.nodes)}; connections = ${J(l.conns)};`); return w.frame(); };
    const F0 = asBase(L[0]), F1 = asBase(L[1]);
    w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
    const Mf = w.frame();
    const tiles = w.get('spatialMorphRenderRecordTiles()');
    const polys = tiles.map((t) => w.get(`outerCorners.map(p => toTileLocal(p, ${J(t.c)}, ${t.flip}, ${t.rot}))`));
    const lines = built.lines, ops = M.spatialMorphSymmetryOps(shape, sym).ops.length, G = lines * ops;
    let at0 = 0, at1 = 0, bad0 = 0, bad1 = 0, middle = 0, worst = 0;
    tiles.forEach((tile, t) => {
      // a tile is "deep" at an end when its centre AND the midpoints of all its edges have weight exactly 1 there (a boundary endpoint takes the weights of the edge it slides on, so a tile next to the
      // transition already shows a little of the other keyframe on its edge: by design, it keeps the seam closed)
      const at = (p) => w.get(`spatialMorphCornerWeights('linear', ${J(p)}, spatialMorphRenderState.span, { angleDeg: 0, center: { x: 300, y: 300 } })`);
      const pts = [tile.c].concat(polys[t].map((p, i) => { const q = polys[t][(i + 1) % polys[t].length]; return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; }));
      const ws = pts.map(at);
      const wt = { w00: ws.every((x) => x.w00 === 1) ? 1 : 0, w10: ws.every((x) => x.w10 === 1) ? 1 : 0 };
      const grp = (arr) => arr.slice(t * G, (t + 1) * G);
      const dist = (x, y) => x.reduce((m, s, i) => Math.max(m, Math.abs(s.x1 - y[i].x1), Math.abs(s.y1 - y[i].y1), Math.abs(s.x2 - y[i].x2), Math.abs(s.y2 - y[i].y2)), 0);
      if (wt.w00 === 1) { at0++; const d = dist(grp(Mf), grp(F0)); worst = Math.max(worst, d); if (d > 1e-9) bad0++; }
      else if (wt.w10 === 1) { at1++; const d = dist(grp(Mf), grp(F1)); worst = Math.max(worst, d); if (d > 1e-9) bad1++; }
      else middle++;
    });
    check(`${shape}/${sym}: the ${at0} tiles whose centre and edges are all at weight 0 draw exactly keyframe 0's own pattern and the ${at1} at weight 1 exactly keyframe 1's (worst ${worst.toExponential(1)} px); the ${middle} tiles between them are blends`, at0 > 0 && at1 > 0 && middle > 0 && bad0 === 0 && bad1 === 0 && Mf.length === F0.length && worst <= 1e-9, `${bad0},${bad1}`);
  }
});

// ---- the seams of the REAL drawn segments ----------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\n== seams on the real drawn segments ==');
const MODES = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => ['linear', a]).concat([['radial', 0], ['bilinear', 0]]);
const SEAM = [];
T('seams', () => {
  for (const shape of ['square', 'triangle', 'hex']) for (const sym of ['none', 'reflection_only', 'rotation_reflection3']) {
    const a2 = H.makeWorld(shape, 3, 3, 600);
    const built = H.buildClosedCorners(M, a2, sym, 300 + shape.length);
    const w = makeRenderWorld(shape, 3, 3, sym);
    const ids = cornerLayers(w, built, ['k00', 'k10', 'k01', 'k11']).map((l) => l.id);
    w.setTimeline(ids);
    const tiles = w.get('spatialMorphRenderRecordTiles()');
    const polys = tiles.map((t) => w.get(`outerCorners.map(p => toTileLocal(p, ${J(t.c)}, ${t.flip}, ${t.rot}))`));
    const R = Math.max(...a2.poly.map((p) => Math.hypot(p.x - a2.ctr.x, p.y - a2.ctr.y)));
    const pairs = [];
    for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
      if (Math.hypot(tiles[i].c.x - tiles[j].c.x, tiles[i].c.y - tiles[j].c.y) > 2 * R + 1e-6) continue;
      const sh = polys[i].filter((p) => polys[j].some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6));
      if (sh.length === 2) pairs.push({ a: i, b: j, v: sh[0], w: sh[1] });
    }
    const lines = built.lines, ops = M.spatialMorphSymmetryOps(shape, sym).ops.length, G = lines * ops;
    const ends = (frame, t, v, ww) => { const o = []; for (let k = t * G; k < (t + 1) * G; k++) for (const e of [1, 2]) { const p = { x: frame[k]['x' + e], y: frame[k]['y' + e] }; if (H.distToSegment(p, v, ww) <= 1e-6) o.push({ k, e, p }); } return o; };
    // the pairing: the frame of the K0 pattern alone (all four keyframes equal to K0) - its seam endpoints coincide in pairs
    const setNodes = (i, src) => w.set(`additionalLayers[${i}].nodes = ${J(src)};`);
    const nodesOf = (k) => { const nd = []; built.corners[k].forEach((l, i) => { nd.push({ id: 2 * i + 1, x: l.x1, y: l.y1 }, { id: 2 * i + 2, x: l.x2, y: l.y2 }); }); return nd; };
    w.setMorph({ enabled: true, mode: 'bilinear', angleDeg: 0 });
    [1, 2, 3].forEach((i) => setNodes(ids[i], nodesOf('k00')));
    const base = w.frame();
    [['k10', 1], ['k01', 2], ['k11', 3]].forEach(([k, i]) => setNodes(ids[i], nodesOf(k)));
    const match = [];
    let unmatched = 0;
    for (const p of pairs) {
      const eA = ends(base, p.a, p.v, p.w), eB = ends(base, p.b, p.v, p.w), used = new Set();
      for (const oa of eA) {
        let best = -1, bd = Infinity;
        eB.forEach((ob, j) => { if (used.has(j)) return; const d = Math.hypot(oa.p.x - ob.p.x, oa.p.y - ob.p.y); if (d < bd) { bd = d; best = j; } });
        if (best < 0 || bd > 1e-9) { unmatched++; continue; }
        used.add(best); match.push([oa, eB[best]]);
      }
      unmatched += eB.length - used.size;
    }
    const modes = sym === 'reflection_only' ? [['linear', 45], ['radial', 0], ['bilinear', 0]] : MODES;
    const rows = [];
    for (const [mode, angleDeg] of modes) {
      w.setMorph({ enabled: true, mode, angleDeg });
      const f = w.frame();
      let drift = 0, moved = 0;
      match.forEach(([oa, ob]) => { const a = f[oa.k]['x' + oa.e], aY = f[oa.k]['y' + oa.e], b = f[ob.k]['x' + ob.e], bY = f[ob.k]['y' + ob.e]; drift = Math.max(drift, Math.hypot(a - b, aY - bY)); moved = Math.max(moved, Math.hypot(a - oa.p.x, aY - oa.p.y)); });
      rows.push({ mode, angleDeg, drift, moved, count: f.length });
    }
    SEAM.push({ shape, sym, rows, pairs: pairs.length, seamPoints: match.length, unmatched, status: w.status().code });
    const worst = Math.max(...rows.map((r) => r.drift)), moved = Math.min(...rows.map((r) => r.moved));
    check(`${shape} / ${sym}: ${rows.length} modes, ${tiles.length} tiles, ${pairs.length} tile pairs, ${match.length} seam points on the real drawn segments, ${unmatched} unmatched; worst drift ${worst.toExponential(1)} px (limit 1e-9); the morph moves seam points by up to ${moved.toFixed(0)} px or more`,
      match.length > 0 && unmatched === 0 && worst <= 1e-9 && moved > 1 && rows.every((r) => r.count === tiles.length * G), J(rows.map((r) => r.drift.toExponential(1))));
  }
  console.log('      worst drift per shape / symmetry on the real drawn segments (px): ' + SEAM.map((s) => `${s.shape}/${s.sym} ${Math.max(...s.rows.map((r) => r.drift)).toExponential(1)}`).join('  '));
});

// ---- 5. pre-conditions, status, interplay --------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\n== 5. status codes and interplay ==');
function errorSpy(w) { const log = []; w.sb.console = { error: (...a) => log.push(a.join(' ')), warn: (...a) => log.push(a.join(' ')), log: () => { } }; return log; }
T('status', () => {
  const mk = (shape, sym) => { const w = makeRenderWorld(shape || 'square', 3, 3, sym || 'none'); w.baseConnections(CONNS.square); return w; };
  const cases = [];
  // 1 needsTwoKeyframes: no layers at all
  let w = mk(); w.setMorph({ enabled: true, mode: 'bilinear', angleDeg: 0 }); cases.push(['no layers, no timeline', w, 'needsTwoKeyframes']);
  // one layer
  w = mk(); w.addKeyframeLayer([[1, 5], [2, 8]]); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); cases.push(['one layer whose line count is not the base sheet\'s', w, 'needsTwoKeyframes']);
  // shape mismatch
  w = mk(); { const a = w.addKeyframeLayer(CONNS.square), b = w.addKeyframeLayer([[1, 4], [2, 6]], { shape: 'hex', order: 2 }); w.setTimeline([a, b]); } w.setMorph({ enabled: true, mode: 'bilinear', angleDeg: 0 }); cases.push(['two keyframes of different shapes', w, 'shapeMismatch']);
  // count mismatch
  w = mk(); { const a = w.addKeyframeLayer(CONNS.square), b = w.addKeyframeLayer([[1, 5], [2, 8]]); w.setTimeline([a, b]); } w.setMorph({ enabled: true, mode: 'radial', angleDeg: 0 }); cases.push(['two keyframes with other line counts', w, 'lineCountMismatch']);
  // alignment failed: the timeline names a layer that is not there
  w = mk(); { const a = w.addKeyframeLayer(CONNS.square), b = w.addKeyframeLayer(ALT.square); w.setTimeline([a, b]); w.set('additionalLayers[1].connections = [[1, 5], [2, 8], [3, 999]];'); } w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); cases.push(['a keyframe line whose node is gone', w, 'alignmentFailed']);
  for (const [what, world, code] of cases) {
    const log = errorSpy(world);
    const h = hashOf(world.drawn());
    const st = world.status();
    world.set('spatialMorph.enabled = false;'); const hOff = hashOf(world.drawn()); world.set('spatialMorph.enabled = true;');
    check(`${what}: status '${code}', the NORMAL frame is drawn (the same as with the switch off), nothing is logged`, st.code === code && st.keyframes === 0 && h === hOff && log.length === 0, J(st));
  }
  // renderError: something throws inside the morph
  w = mk(); { const a = w.addKeyframeLayer(CONNS.square), b = w.addKeyframeLayer(ALT.square); w.setTimeline([a, b]); }
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  w.set('const __real = tileFor; let __n = 0; tileFor = function (shape) { if (__n++ === 0) throw new Error("boom"); return __real(shape); };');
  let threw = null; try { w.drawn(); } catch (e) { threw = e; }
  check("an exception inside the morph never escapes: the normal frame is drawn instead and the status is 'renderError'", threw === null && w.status().code === 'renderError', (threw && threw.message) + ' ' + w.status().code);
  check('...and the recorder is put back (drawShapeCell() is the real one)', w.get('drawShapeCell.toString().includes("for (const conn of connSet)")') === true);
  w.set('tileFor = __real;');
  // recorder restored when the tile function itself throws mid-record
  w = mk(); { const a = w.addKeyframeLayer(CONNS.square), b = w.addKeyframeLayer(ALT.square); w.setTimeline([a, b]); }
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  w.set('const __realTile = tileSquare; let __m = 0; tileSquare = function () { if (__m++ === 0) throw new Error("tile"); return __realTile.apply(this, arguments); };');
  let t2 = null; try { w.drawn(); } catch (e) { t2 = e; }
  const afterThrow = w.get('drawShapeCell.toString().includes("for (const conn of connSet)")');
  w.set('tileSquare = __realTile;');
  check("drawShapeCell() is restored in a finally: a tile function that throws while recording leaves the real one in place, the call returns and the status is 'renderError'", afterThrow === true && t2 === null && w.status().code === 'renderError', (t2 && t2.message) + ' ' + w.status().code);
  // ok / netActive / off
  w = mk(); { const a = w.addKeyframeLayer(CONNS.square), b = w.addKeyframeLayer(ALT.square); w.setTimeline([a, b]); }
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); w.drawn();
  check("a drawn morph: status 'ok' with the keyframe count and the mode", same(w.status(), { code: 'ok', keyframes: 2, mode: 'linear' }), J(w.status()));
  w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 }); w.drawn();
  check("switching it off: status 'off'", w.status().code === 'off');
});

T('interplay', () => {
  const mk = (n, conns, alt) => { const w = makeRenderWorld('square', 3, 3, 'rotation_reflection3'); w.baseConnections(CONNS.square); const ids = []; for (let i = 0; i < n; i++) ids.push(w.addKeyframeLayer(i % 2 ? alt : conns)); w.setTimeline(ids); return w; };
  // the net
  let w = mk(2, CONNS.square, ALT.square);
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  const noNet = hashOf(w.drawn());
  w.set(`baseNetTransform = ${J({ x: { kind: 'trig', w: 0.3 }, y: 'same', repeat: false, domain: 'field' })};`);
  const withNet = hashOf(w.drawn());
  check("a net warp in force: the morph is drawn WITHOUT the net (the same frame as without it) and the status says 'netActive'", withNet === noNet && w.status().code === 'netActive', w.status().code);
  w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 });
  check('...with the switch off the same net warps the normal frame as before (the net is only ignored in morph mode)', hashOf(w.drawn()) !== noNet);
  // the timeline playing: the playback layer is not drawn, the morph does not depend on the progress
  w = mk(2, CONNS.square, ALT.square);
  w.set(`(function () { const pb = { connections: [], redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape: 'square', symmetryMode: 'rotation_reflection3', enabled: true, showFaces: false, nodeCount: 3, shapeSizeFactor: 3, isTimelinePlayback: true };
    const g = layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, 3, 3, 'square', canvasW, canvasH); pb.nodes = g.nodes; pb.centroid = g.centroid; pb.outerCorners = g.outerCorners; additionalLayers.push(pb); timeline.playbackLayerIndex = additionalLayers.length - 1; })();`);
  w.setMorph({ enabled: true, mode: 'bilinear', angleDeg: 0 });
  const frames = [0, 0.25, 0.5, 1].map((p) => { w.set(`timeline.elapsedMs = ${p} * totalTimelineDurationMs(timeline); timeline.playing = ${p === 0.5}; timeline.startTime = millis() - timeline.elapsedMs; applyTimelineFrame();`); return hashOf(w.drawn()); });
  check('the timeline paused or playing at four progress values: the morph frame is the same (static, independent of the progress); the playback layer is not drawn', new Set(frames).size === 1 && w.status().code === 'ok', J(frames));
  w.setMorph({ enabled: false, mode: 'bilinear', angleDeg: 0 });
  w.set('timeline.elapsedMs = 0.25 * totalTimelineDurationMs(timeline); applyTimelineFrame();'); const n0 = hashOf(w.drawn());
  w.set('timeline.elapsedMs = 0.75 * totalTimelineDurationMs(timeline); applyTimelineFrame();'); const n1 = hashOf(w.drawn());
  check('...while the normal frame still follows the progress (the timeline itself is untouched)', n0 !== n1);
  // faces are not drawn
  w = mk(2, CONNS.square, ALT.square);
  w.set('showFaces = true; baseFaceAssignments = new Map();'); w.set('let __faceCalls = 0; const __cf = computeCellFaces; computeCellFaces = function () { __faceCalls++; return __cf.apply(this, arguments); };');
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); w.drawn();
  check('face fills are not computed or drawn in morph mode (computeCellFaces is never called), also with Fill on', w.get('__faceCalls') === 0 && w.status().code === 'ok');
  w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 });
  // the SVG export
  w = mk(2, CONNS.square, ALT.square);
  Object.assign(w.sb, { document: { body: {} }, getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }) });
  const svgOff = w.get('generateSVGString()');
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  const svgOn = w.get('generateSVGString()');
  check('the SVG export with the switch on is the normal pattern (the same SVG as with the switch off), and it does not touch the status', svgOn === svgOff && svgOn.includes('<path') && w.status().code !== 'ok');
  // JSON export
  const strip = (d) => { delete d.exportedAt; return d; };
  w.setMorph({ enabled: false, mode: 'linear', angleDeg: 0 }); const jOff = J(strip(w.get('buildExportData(null)')));
  w.setMorph({ enabled: true, mode: 'radial', angleDeg: 30 }); const jOn = J(strip(w.get('buildExportData(null)')));
  check('the JSON export is the normal pattern and carries no morph block, switch on or off', jOn === jOff && !jOn.includes('spatialMorph'));
  // the morph reads the keyframe lines live: editing a keyframe layer changes the next frame; undo goes back
  w = mk(2, CONNS.square, ALT.square);
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  const live0 = hashOf(w.drawn());
  w.set('additionalLayers[0].connections.push([4, 6]);'); const bad = hashOf(w.drawn()), badStatus = w.status().code;
  w.set('additionalLayers[0].connections.pop();'); const back = hashOf(w.drawn());
  check("the keyframe lines are read live: with one more line in keyframe 0 the pre-condition fails at the next frame ('lineCountMismatch', the normal frame), and the morph frame is back, the same, once the edit is undone", bad !== live0 && badStatus === 'lineCountMismatch' && back === live0 && w.status().code === 'ok', badStatus);
  // free endpoints / layers with other offset or rotation: ignored
  w = makeRenderWorld('square', 3, 3, 'none'); w.baseConnections(CONNS.square);
  const a = w.addKeyframeLayer(CONNS.square), b = w.addKeyframeLayer(CONNS.square, { offsetX: 40, rotation: 30 }); w.setTimeline([a, b]);
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  const withOffset = hashOf(w.drawn());
  w.set('additionalLayers[1].offsetX = 0; additionalLayers[1].rotation = 0;');
  check("a keyframe layer's own offset and rotation are IGNORED by the morph (the frame is the same with and without them)", withOffset === hashOf(w.drawn()));
});

T('span', () => {
  const w = makeRenderWorld('square', 3, 3, 'none');
  const a = w.addKeyframeLayer(CONNS.square), b = w.addKeyframeLayer(ALT.square); w.setTimeline([a, b]);
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
  w.frame(); w.frame(); w.frame();
  const c1 = w.get('spatialMorphRenderState.spanComputes');
  check('the span is computed ONCE for a lattice: three frames, one computation', c1 === 1, c1);
  w.setMorph({ enabled: true, mode: 'linear', angleDeg: 45 }); w.frame();
  const c2 = w.get('spatialMorphRenderState.spanComputes');
  w.setMorph({ enabled: true, mode: 'radial', angleDeg: 45 }); w.frame();
  const c3 = w.get('spatialMorphRenderState.spanComputes');
  w.set("currentShape = 'hex'; nodeCount = 3; shapeSizeFactor = 3; rebuildGrid('hex');"); w.baseConnections([[1, 10]]);
  w.set('timeline = null; additionalLayers = [];'); const h1 = w.addKeyframeLayer([[1, 10], [3, 14]]), h2 = w.addKeyframeLayer([[2, 11], [4, 15]]); w.setTimeline([h1, h2]);
  w.frame(); const c4 = w.get('spatialMorphRenderState.spanComputes');
  w.frame(); const c5 = w.get('spatialMorphRenderState.spanComputes');
  w.run('spatialMorphInvalidateSpan()'); w.frame(); const c6 = w.get('spatialMorphRenderState.spanComputes');
  check('the span is recomputed when the angle, the mode, the shape (the grid) changes and when it is invalidated - and only then', c2 === 2 && c3 === 3 && c4 === 4 && c5 === 4 && c6 === 5, [c1, c2, c3, c4, c5, c6].join(','));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
