// Task 079 (B3): a pattern on an X x Y area (X != Y) survives the session round trip, the JSON / SVG export and the transport (link and paste); X = Y stays as it was.
//   node tools/grid/test-session-format.js     mutated copies (sabotage runs): STATE_JS, SESSION_JS, SESSION_APPLY_JS, EXPORT_JS (tools/session/fixtures.js), ORBITS_JS (the render harness override), SKETCH_JS (the transport parsers cut out of sketch.js)
//   1. snapshot: size {x, y} only for X != Y (none for a square), validated; plan: the canvas must belong to the size, a square snapshot loads into a non-square page
//   2. round trip: 3 shapes x ordnung 1..3 x lage 1/2 x 6 formats (3/5, 5/3, 5/7, 3/9, 7/8 triangle, 8/7 hexagon): snapshot -> apply into another world = identical snapshot AND export, with layers, free points,
//      colours (and a timeline); the target's canvas, X, Y and the canvas hook follow; invalid sizes are refused without a mutation
//   3. export: meta.size only for X != Y (a square export has no size key); the SVG is W x H (width, height, viewBox, frame)
//   4. transport: link and paste carry size=XxY (only for X != Y) and come back equal; invalid sizes, a bad token next to a good one: refused, nothing mutated
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const SK = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const MODE = 'rotation_reflection6', SHAPES = ['triangle', 'square', 'hex'], R3 = Math.sqrt(3);
const FORMATS = [[3, 5], [5, 3], [5, 7], [3, 9], [7, 8], [8, 7]];
const wantW = (sh, X, Y) => { if (X === Y) return 600; const e = 600 / Math.min(X, Y); return X < Y ? 600 : sh === 'hex' ? X * R3 / 2 * e : X * e; };
const wantH = (sh, X, Y) => { if (X === Y) return 600; const e = 600 / Math.min(X, Y); return Y < X ? 600 : sh === 'triangle' ? Y * R3 / 2 * e : Y * e; };
const HOOK = 'var hookCalls = 0; var canvasSizeSync = function () { width = canvasW; height = canvasH; hookCalls++; };';
const worlds = {};
const FILES = process.env.ORBITS_JS ? { 'core/orbits.js': process.env.ORBITS_JS } : undefined;   // sabotage runs (the other core copies go in through the env of tools/session/fixtures.js)
const W = (shape) => { if (!worlds[shape]) { worlds[shape] = H.makeRenderWorld(shape, 3, 3, MODE, FILES); worlds[shape].set(HOOK); worlds[shape].sb.document = { body: {} }; worlds[shape].sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); } return worlds[shape]; };
const setup = (w, shape, ord, lage, X, Y) => w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: ord, lage })}); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = []; redoStack = []; baseNetTransform = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; baseFaceAnchor = null; baseLastHarmonyType = null; baseLastSelection = null; baseDistributionStrategy = null; spatialMorph = { enabled: false, mode: 'linear', angleDeg: 0 }; showNodes = true; showFaces = false; freeEndpointsEnabled = false; lineColor = '#000000'; curveType = { kind: 'straight' }; rebuildGrid(currentShape);`);
const addLayer = (w, o) => w.set(`(function () {
    const layer = { connections: ${J(o.connections || [])}, redoStack: [], offsetX: ${o.offsetX || 0}, offsetY: ${o.offsetY || 0}, rotation: ${o.rotation || 0}, shape: ${J(o.shape)}, symmetryMode: ${J(MODE)}, enabled: ${o.enabled !== false}, showFaces: false, shapeSizeFactor: ${o.size} };
    projectLayerGridSpec(layer, ${J({ shape: o.shape, ordnung: o.ord, lage: o.lage || 1 })});
    const grid = layerGridForSpec(outerCorners, centroid, currentShape, shapeSizeFactor, layer.shapeSizeFactor, layer.gridSpec, layer.shape, canvasW, canvasH, gridShortSideArg());
    layer.nodes = grid.nodes; layer.centroid = grid.centroid; layer.outerCorners = grid.outerCorners;
    ${o.free ? `layer.nodes.push({ id: layer.nodes.length + 1, x: ${o.free[0]}, y: ${o.free[1]}, free: true });` : ''}
    ${o.playback ? 'layer.isTimelinePlayback = true;' : ''}
    additionalLayers.push(layer);
})()`);
const state = (w) => w.get('JSON.stringify([canvasW, canvasH, shapeSizeFactor, shapeSizeFactorX, shapeSizeFactorY, nodes, connections, additionalLayers.length, gridSpec, currentShape])');

// ---- 1 + 2. snapshots and the round trip ------------------------------------------------------------------------------------------------------------------
{
    let cases = 0, bad = { snap: 0, exp: 0, canvas: 0, size: 0, hook: 0, ok: 0, nosize: 0, free: 0 };
    for (const shape of SHAPES) {
        const w = W(shape);
        for (const lage of [1, 2]) for (let ord = 1; ord <= 3; ord++) for (const [X, Y] of FORMATS) {
            setup(w, shape, ord, lage, X, Y);
            const nn = w.get('nodes.length');
            w.set(`nodes.push({ id: ${nn + 1}, x: 301.5, y: 288.25, free: true }); connections = [[1, 2], [2, 3], [1, ${nn + 1}]]; redoStack = [[1, 3]]; freeEndpointsEnabled = true;`);
            addLayer(w, { shape, ord, lage, size: 3, offsetX: 30, offsetY: -18, rotation: 17, connections: [[1, 2]], free: [310.5, 299.75] });
            addLayer(w, { shape: shape === 'square' ? 'hex' : 'square', ord: Math.min(ord, 2), size: 2, connections: [[1, 2]] });
            if (ord >= 2) { try { S.colorBase(w.ctx, { type: 'custom' }); } catch (e) { } }
            const ui = S.uiOf(w.ctx, 'spiegeling', 6), snap = S.snapOf(w.ctx, ui), exp = S.exportOf(w.ctx);
            cases++;
            if (!snap.settings.size || snap.settings.size.x !== X || snap.settings.size.y !== Y || snap.settings.canvas.w !== wantW(shape, X, Y) || snap.settings.canvas.h !== wantH(shape, X, Y) || snap.settings.shapeSizeFactor !== Math.min(X, Y)) bad.size++;
            if (!exp.meta.size || exp.meta.size.x !== X || exp.meta.size.y !== Y || exp.meta.shapeSizeFactor !== Math.min(X, Y)) bad.exp++;
            // into another world (another shape, a square size, another mode)
            const target = S.world(shape === 'hex' ? 'triangle' : 'hex', 4, 1, 'none'); target.run(HOOK);
            const tui = S.uiOf(target, 'none', 6), hooks = S.fakeHooks(target, snap, tui);
            const ap = S.applyInto(target, snap, hooks);
            if (!(ap && ap.ok)) { bad.ok++; if (!bad.first) bad.first = [shape, lage, ord, X, Y, J(ap).slice(0, 300), String(J(S.planFor(target, snap))).slice(0, 400)]; continue; }
            if (!S.safe(() => S.same(S.snapOf(target, tui), snap))) bad.snap++;
            if (!S.safe(() => S.same(S.exportOf(target), exp))) bad.exp++;
            if (target.get('canvasW') !== wantW(shape, X, Y) || target.get('canvasH') !== wantH(shape, X, Y) || target.get("typeof width === 'undefined' ? -1 : width") !== wantW(shape, X, Y) || target.get("typeof height === 'undefined' ? -1 : height") !== wantH(shape, X, Y)) bad.canvas++;
            if (target.get('[gridSizeX(), gridSizeY(), shapeSizeFactor, gridIsSquare()]').join() !== [X, Y, Math.min(X, Y), false].join()) bad.size++;
            if (target.get('hookCalls') < 1) bad.hook++;
            if (hooks.stale) bad.snap++;
            const fr = target.get('nodes.filter(n => n.free).length'), fl = target.get('additionalLayers[0].nodes.filter(n => n.free).length');
            if (fr !== 1 || fl !== 1) bad.free++;
        }
    }
    check(`(2) ${cases} cases (3 shapes x ordnung 1..3 x lage 1/2 x 6 formats): the snapshot carries size {x, y}, the canvas of that area and shapeSizeFactor = min; the export meta.size`, cases === 3 * 2 * 3 * 6 && bad.size === 0, J(bad));
    check('(2) snapshot -> apply into another world (another shape, a square, another mode): applied, identical snapshot, hooks ran on final globals, free points of the base and of a layer back', bad.ok === 0 && bad.snap === 0 && bad.free === 0, J(bad));
    check('(2) ... and the identical export; the target\'s canvas, p5 size, X, Y follow and the canvas hook ran', bad.exp === 0 && bad.canvas === 0 && bad.hook === 0, J(bad));

    // a timeline and colours, one format per shape
    let tlOk = 0, tlN = 0;
    for (const shape of SHAPES) for (const [X, Y] of [[3, 5], [8, 7]]) {
        const w = W(shape); setup(w, shape, 2, 1, X, Y);
        const conns = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 3)');
        w.set(`connections = ${J([conns[2]])};`);
        const k1 = w.addKeyframeLayer([conns[0]]), k2 = w.addKeyframeLayer([conns[1]]);
        addLayer(w, { shape, ord: 2, size: Math.min(X, Y), playback: true });
        w.setTimeline([k1, k2], { playbackLayerIndex: 2 });
        w.set('additionalLayers[0]._timelineSavedEnabled = true; additionalLayers[1]._timelineSavedEnabled = true; timeline.segmentPairings = [[1, 0]]; timeline.segmentFlips = [null]; timeline.segmentMembers = [null];');
        w.set('connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 4);'); S.colorBase(w.ctx, {});
        const ui = S.uiOf(w.ctx, 'spiegeling', 6), snap = S.snapOf(w.ctx, ui), exp = S.exportOf(w.ctx);
        const target = S.world('square', 3, 3, 'none'); target.run(HOOK);
        const tui = S.uiOf(target, 'none', 6), ap = S.applyInto(target, snap, S.fakeHooks(target, snap, tui));
        tlN++; if (ap && ap.ok && S.safe(() => S.same(S.snapOf(target, tui), snap)) && S.safe(() => S.same(S.exportOf(target), exp)) && target.get('timeline.keyframeLayerIds.length') === 2) tlOk++;
    }
    check(`(2) a timeline with two keyframes, a playback layer and real colours (${tlN} cases, 3 shapes x 3/5 and 8/7): the round trip is identical (snapshot and export)`, tlN === 6 && tlOk === tlN, tlOk + '/' + tlN);

    // a square base: no size anywhere; an old snapshot (no size) loads as a square, also into a non-square page
    const ws = W('square'); setup(ws, 'square', 3, 1, 3, 3); ws.set('connections = [[1, 5], [2, 8]];');
    const uis = S.uiOf(ws.ctx, 'spiegeling', 6), snapS = S.snapOf(ws.ctx, uis), expS = S.exportOf(ws.ctx);
    check('(3) a square base (X = Y): no size key in the snapshot, none in the export meta', !('size' in snapS.settings) && !('size' in expS.meta));
    const wn = S.world('square', 3, 3, 'none'); wn.run(HOOK); wn.run('setGridSize(3, 5);');
    const uiN = S.uiOf(wn, 'none', 6), apS = S.applyInto(wn, snapS, S.fakeHooks(wn, snapS, uiN));
    check('(1) a snapshot without size (old file / square) loads as a square into a page that is 3/5 now: canvas 600 x 600, X = Y, identical snapshot', apS && apS.ok && wn.get('[canvasW, canvasH, gridIsSquare()]').join() === '600,600,true' && S.safe(() => S.same(S.snapOf(wn, uiN), snapS)), J(apS).slice(0, 160) + wn.get('[canvasW, canvasH, gridIsSquare()]'));

    // refused without a mutation: size not within 1 : 3, x = 0 / 10, a size that does not match shapeSizeFactor or the canvas
    setup(W('square'), 'square', 2, 1, 3, 5); const w5 = W('square'); w5.set('connections = [[1, 2]];');
    const ui5 = S.uiOf(w5.ctx, 'spiegeling', 6), snap5 = S.snapOf(w5.ctx, ui5);
    const tamper = (f) => { const o = JSON.parse(J(snap5)); f(o.settings); return o; };
    const tg = S.world('hex', 3, 4, 'none'); tg.run(HOOK); const before = tg.get('JSON.stringify([canvasW, canvasH, shapeSizeFactor, shapeSizeFactorX, shapeSizeFactorY, nodes, connections, gridSpec])');
    const cases2 = [
        ['1:4 (2/9)', s => { s.size = { x: 2, y: 9 }; s.shapeSizeFactor = 2; s.canvas = { w: 600, h: 2700 }; }, 'invalid'],
        ['x = 0', s => { s.size = { x: 0, y: 5 }; }, 'invalid'], ['x = 10', s => { s.size = { x: 10, y: 5 }; }, 'invalid'], ['size as a string', s => { s.size = '3x5'; }, 'invalid'], ['y missing', s => { s.size = { x: 3 }; }, 'invalid'],
        ['size does not match shapeSizeFactor', s => { s.size = { x: 4, y: 5 }; }, 'invalid'], ['canvas of another size (3/5 claims 600 x 600)', s => { s.canvas = { w: 600, h: 600 }; }, 'canvas-mismatch'],
    ];
    const res2 = cases2.map(([name, f, code]) => { const r = S.planFor(tg, tamper(f)); const got = !r.v.ok ? 'invalid' : (r.p.ok ? 'ok' : r.p.code); return [name, got === code, got]; });
    check('(1) refused (not valid / canvas-mismatch), never applied: ' + cases2.map(c => c[0]).join('; '), res2.every(r => r[1]), J(res2.filter(r => !r[1])));
    check('(1) the planning and validating wrote nothing into the target world', tg.get('JSON.stringify([canvasW, canvasH, shapeSizeFactor, shapeSizeFactorX, shapeSizeFactorY, nodes, connections, gridSpec])') === before);
    const sq = tamper(s => { s.size = { x: 4, y: 4 }; s.shapeSizeFactor = 4; });
    const rsq = S.planFor(tg, sq);
    check('(1) size x = y is read as a square (the key is dropped by the validator)', rsq.v.ok && !('size' in rsq.v.snapshot.settings));
}

// ---- 3. SVG -------------------------------------------------------------------------------------------------------------------------------------------
{
    let n = 0, bad = 0;
    for (const shape of SHAPES) for (const [X, Y] of [[3, 5], [5, 3], [5, 7], [8, 7]]) {
        const w = W(shape); setup(w, shape, 2, 1, X, Y); w.set('connections = [[1, 2], [2, 3]];');
        const svg = w.get('generateSVGString()'), Wp = wantW(shape, X, Y), Hp = wantH(shape, X, Y);
        n++;
        const num = (re) => { const m = svg.match(re); return m ? parseFloat(m[1]) : NaN; };
        if (Math.abs(num(/<svg [^>]*width="([\d.]+)"/) - Wp) > 1e-6 || Math.abs(num(/<svg [^>]*height="([\d.]+)"/) - Hp) > 1e-6 || !new RegExp(`viewBox="0 0 ${String(Wp).replace('.', '\\.')} ${String(Hp).replace('.', '\\.')}"`).test(svg)
            || (svg.match(new RegExp(`<rect x="0" y="0" width="${String(Wp).replace('.', '\\.')}" height="${String(Hp).replace('.', '\\.')}"`, 'g')) || []).length !== 2) bad++;
    }
    check(`(3) SVG of ${n} non-square patterns: width, height, viewBox and both frame rects are W x H`, n === 12 && bad === 0, bad);
    const w = W('square'); setup(w, 'square', 2, 1, 3, 3); w.set('connections = [[1, 2]];');
    check('(3) a square pattern: 600 x 600 as before', /width="600" height="600" viewBox="0 0 600 600"/.test(w.get('generateSVGString()')));
}

// ---- 4. transport ---------------------------------------------------------------------------------------------------------------------------------------
{
    const w = W('square'); setup(w, 'square', 2, 1, 3, 3);
    const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
    w.sb.URLSearchParams = URLSearchParams; w.sb.console = { warn() { } };
    w.set('var catalogTransportRejection = null;\n' + ['parseCatalogUrlV2', 'parseCatalogUrlParams', 'parseClipboardCatalogPattern'].map(grab).join('\n'));
    const spec = { shape: 'square', ordnung: 2, lage: 1 };
    const keys = w.get(`(function () { const t = getLineKeyTable(${J(spec)}); const ks = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.slice(0, 3).map(o => lineKeyForPair(t, o.pairs[0][0], o.pairs[0][1])); return ks; })()`);
    w.sb.__keys = keys; w.sb.__spec = spec;
    const url = (opts) => w.get(`formatTransportUrlV2(__spec, __keys, ${J(opts || {})})`), paste = (opts) => w.get(`formatTransportPasteV2(__spec, __keys, ${J(opts || {})})`);
    const st0 = state(w);
    const u35 = url({ size: { x: 3, y: 5 } }), u33 = url({ size: { x: 3, y: 3 } }), uNone = url();
    check('(4) the link writes size=XxY only for X != Y (3/5: size=3x5; 3/3 and none: no size parameter, the old string)', /[?&]size=3x5(&|$)/.test(u35) && !/size/.test(u33) && !/size/.test(uNone) && u33 === uNone, u35);
    const p35 = paste({ size: { x: 3, y: 5 } }), p33 = paste({ size: { x: 3, y: 3 } });
    check('(4) the paste text has "size":{"x":3,"y":5} for 3/5 only (3/3: the old text)', JSON.parse(p35).size.x === 3 && JSON.parse(p35).size.y === 5 && !('size' in JSON.parse(p33)) && p33 === paste());
    w.sb.__u35 = u35; w.sb.__p35 = p35; w.sb.__uNone = uNone;
    const parsedU = w.get('parseCatalogUrlParams(__u35)'), parsedP = w.get('parseClipboardCatalogPattern(__p35)'), parsedN = w.get('parseCatalogUrlParams(__uNone)');
    check('(4) link round trip: size {3, 5}, the same keys and tokens; paste round trip: the same; no size parameter: a square (no size)', parsedU && parsedU.size && parsedU.size.x === 3 && parsedU.size.y === 5 && J(parsedU.keys) === J(parsedP.keys) && parsedP.size.x === 3 && parsedP.size.y === 5 && parsedN && !('size' in parsedN) && J(parsedN.keys) === J(parsedU.keys));
    check('(4) the parsing mutated nothing (canvas, X, Y, nodes, lines)', state(w) === st0);
    // refused: nothing returned, nothing mutated
    const base = u35.replace(/[?&]size=3x5/, '');
    const bads = ['size=2x9', 'size=0x3', 'size=10x3', 'size=3x', 'size=3x5x7', 'size=x5', 'size=1x4', 'size=3X5', 'size=03x5', 'size=-3x5', 'size=3x5&size=1x4'];
    const rej = bads.map(b => { const q = (base.includes('?') ? base + '&' : base + '?') + b; w.sb.__q = q; const r = w.get('parseCatalogUrlParams(__q)'); return [b, r === null && w.get('catalogTransportRejection && catalogTransportRejection.code') === 'invalid']; });
    check('(4) links refused with "invalid": ' + bads.join(', '), rej.every(r => r[1]), J(rej.filter(r => !r[1])));
    const badPaste = [{ x: 2, y: 9 }, { x: 0, y: 3 }, { x: 10, y: 3 }, { x: 3 }, '3x5', [3, 5], { x: 3, y: 5, z: 1 }, { x: 1.5, y: 3 }];
    const rejP = badPaste.map(sz => { const o = JSON.parse(p35); o.size = sz; w.sb.__t = J(o); const r = w.get('parseClipboardCatalogPattern(__t)'); return [J(sz), r === null && w.get('catalogTransportRejection && catalogTransportRejection.code') === 'invalid']; });
    check('(4) pastes refused with "invalid": ' + badPaste.map(J).join(' '), rejP.every(r => r[1]), J(rejP.filter(r => !r[1])));
    // a good size next to a bad token: the whole input is refused
    w.sb.__mix = u35.replace(/lines=[^&]*/, 'lines=zz9'); const rm = w.get('parseCatalogUrlParams(__mix)');
    const o = JSON.parse(p35); o.lines = ['zz9']; w.sb.__mp = J(o); const rmp = w.get('parseClipboardCatalogPattern(__mp)');
    check('(4) a valid size with a bad line token (link and paste): refused as a whole', rm === null && rmp === null && w.get('catalogTransportRejection.code') === 'invalid');
    check('(4) no refused input mutated anything', state(w) === st0);
    // the export JSON carries the grid and the keys a paste needs: export -> transport text -> the same pattern
    setup(w, 'square', 2, 1, 3, 5); w.set('connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.slice(0, 3).map(o => o.pairs[0].slice());');
    const exp = S.exportOf(w.ctx), sz = exp.meta.size;
    const keysE = exp.lineKeys || (exp.meta && exp.meta.lineKeys);
    const back = w.get(`(function () { const t = getLineKeyTable(gridSpec); const ks = connections.map(c => lineKeyForPair(t, c[0], c[1])); return parseClipboardCatalogPattern(formatTransportPasteV2(gridSpec, ks, { size: { x: gridSizeX(), y: gridSizeY() } })); })()`);
    check('(4) export (meta.size, grid) -> paste text -> the same pattern: size 3/5, same grid, same number of lines', sz && back && back.size.x === sz.x && back.size.y === sz.y && back.spec.ordnung === exp.meta.grid.ordnung && back.keys.length === 3);
    // setup() applies the size of a link: the source line is there and runs after the parse
    const iApply = SK.indexOf('catalogUrlPattern.size) { setGridSize(');
    check('(4) setup(): setGridSize(size) runs only inside `if (catalogUrlPattern)` (a pattern the parser accepted), after the shape and spec are set', iApply > SK.indexOf('if (catalogUrlPattern) {', SK.indexOf('const catalogUrlPattern = parseCatalogUrlParams')) && iApply > 0);
}

console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
