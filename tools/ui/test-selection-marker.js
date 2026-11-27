// Task 182: the start node of an open line is marked (red, 8 px) as long as it is the start, the hover is only for the mouse, and none of it is in an image export.
// The REAL functions of sketch.js run in a vm on stubs (openStartId, installTapInput, pressAt for the cancel/finish cases); draw() and the export handlers are pinned by their text.
//   node tools/ui/test-selection-marker.js
//   SKETCH_JS=/path/to/another/sketch.js node tools/ui/test-selection-marker.js      (sabotage run: a copy WITHOUT the change must FAIL)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const src = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const fn = name => { const a = src.indexOf('\nfunction ' + name + '(') + 1; if (a < 1) return null; const b = src.indexOf('\n}\n', a); const one = src.indexOf('\n', a); const end = src.slice(a, one).trimEnd().endsWith('}') && !src.slice(a, one).trimEnd().endsWith('{') ? one : b + 2; return src.slice(a, end); };

// 1. openStartId
const osSrc = fn('openStartId');
check('openStartId() exists in sketch.js', !!osSrc);
const sbx = {}; vm.createContext(sbx);
if (osSrc) vm.runInContext(osSrc, sbx);
const os = c => (sbx.openStartId ? sbx.openStartId(c) : undefined);
check('no connection: no start', os([]) === null);
check('[1]: start 1', os([[1]]) === 1);
check('[1,2]: no start', os([[1, 2]]) === null);
check('[[1,2],[3]]: start 3', os([[1, 2], [3]]) === 3);
check('[[3],[1,2]]: a one-id entry that is not the last one is no start', os([[3], [1, 2]]) === null);
check('a free node as start (id above the grid ids)', os([[1, 2], [99]]) === 99);

// 2. with the real pressAt: cancel / finish / undo / redo / second sheet
const a = src.indexOf('\nfunction pressAt(') + 1, b = src.indexOf('\n}\n', a) + 3;
const pressAtSrc = src.slice(a, b);
function world(layer) {
    const w = { connections: [], layers: [{ connections: [] }], redo: [], nodes: [1, 2, 3, 4].map(i => ({ id: i, x: i * 100, y: i * 100 })) };
    const sb = {
        width: 600, height: 600, altNetActive: false, handleAltNetClick() { }, freeEndpointsEnabled: false, activeLayer: layer ? 0 : 'base', additionalLayers: w.layers,
        activeNodes: () => w.nodes, netWarpBaseNow: () => null, netWarpIsClosed: () => false, netWarpInsideNet: () => true, layerFreeNodeFromClick: (l, p) => p, netWarpFieldLocal: (n, p) => p, invertNetWarp: (n, p) => p,
        window: { say() { } }, activeConnections: () => (layer ? w.layers[0].connections : w.connections), clearActiveRedoStack: () => { w.redo = []; }, redraw() { },
    };
    vm.createContext(sb); vm.runInContext(pressAtSrc, sb); if (osSrc) vm.runInContext(osSrc, sb);
    w.sb = sb; w.click = id => sb.pressAt(300, 300, 'mouse', { id }); w.start = () => (sb.openStartId ? sb.openStartId(sb.activeConnections()) : undefined);
    return w;
}
{
    const w = world();
    w.click(2); check('open line [2]: marked 2', w.start() === 2);
    w.click(2); check('cancel (second click on the same node): no mark', w.start() === null);
    w.click(2); w.click(3); check('line finished: no mark', w.start() === null && J(w.connections) === J([[2, 3]]));
    w.click(1); check('a new start: marked 1', w.start() === 1);
    const popped = w.connections.pop(); w.redo.push(popped);   // undo takes the open entry
    check('undo removes the open start: no mark', w.start() === null);
    w.connections.push(w.redo.pop());                          // redo brings it back
    check('redo brings it back: marked 1 again', w.start() === 1);
}
{
    const w = world(true), base = []; w.sb.additionalLayers[0].connections = [];
    w.click(3); check('active sheet (layer 0) with an open line: marked 3', w.start() === 3);
    w.sb.activeLayer = 'base'; w.sb.activeConnections = () => base;
    check('switched to the base sheet (no open line there): no mark; the layer keeps its own open start', w.start() === null && (w.sb.openStartId || (() => 0))(w.layers[0].connections) === 3);
    w.sb.activeLayer = 0; w.sb.activeConnections = () => w.layers[0].connections;
    check('back on the layer: marked 3 again (the start stayed open on its sheet)', w.start() === 3);
}

// 3. hoverOn follows the last pointer type: mouse -> touch -> mouse (the REAL installTapInput on stubs)
{
    const isrc = fn('installTapInput');
    check('installTapInput() found', !!isrc);
    const handlers = { box: {}, win: {} };
    const sb = {
        createTapDetector: () => ({ down() { }, move() { }, up: () => null, cancel() { } }), performance: { now: () => 0 }, tapPress() { }, hoverOn: true,
        document: { getElementById: () => ({ addEventListener: (t, f) => { handlers.box[t] = f; } }) },
        window: { addEventListener: (t, f) => { handlers.win[t] = f; } },
    };
    vm.createContext(sb); vm.runInContext(isrc, sb); sb.installTapInput();
    const on = () => vm.runInContext('hoverOn', sb);
    check('start: hover on', on() === true);
    handlers.win.pointermove({ pointerType: 'mouse' }); check('mouse move: hover on', on() === true);
    handlers.box.pointerdown({ pointerType: 'touch' }); check('touch down: hover off', on() === false);
    handlers.win.pointermove({ pointerType: 'touch' }); check('touch move: still off', on() === false);
    handlers.box.pointerdown({ pointerType: 'pen' }); check('pen down: off (pen like touch)', on() === false);
    handlers.win.pointermove({ pointerType: 'pen' }); check('pen move: off', on() === false);
    handlers.win.pointermove({ pointerType: 'mouse' }); check('mouse again (hybrid device): hover is back', on() === true);
    handlers.box.pointerdown({ pointerType: 'mouse' }); check('mouse down: on', on() === true);
}

// 4. source pins: draw(), export, flicker
const drawA = src.indexOf('const hovered = '), drawB = src.indexOf('pop();', src.indexOf('dotLayer.nodes.forEach'));
const drawSrc = src.slice(drawA, drawB);
check('draw(): the hover is only picked when hoverOn and not markerHidden', /const hovered = \(hoverOn && !markerHidden\) \? pickNodeAt\(/.test(drawSrc));
check('draw(): selectedId = openStartId(activeConnections()) unless markerHidden', /const selectedId = markerHidden \? null : openStartId\(activeConnections\(\)\);/.test(drawSrc));
check('draw(): both dot loops colour hover OR start red', (drawSrc.match(/nd\.id === hoverId \|\| .*nd\.id === selectedId\)? \? color\(220, 0, 0\)/g) || []).length === 2);
check('draw(): the start dot is 8 px, every other 6 px; the size never reads hoverId (no flicker 8/6 on one node)', (drawSrc.match(/ellipse\(p\.x, p\.y, [^;]*selectedId \? 8 : 6/g) || []).length === 2 && !/ellipse\([^;]*hoverId/.test(drawSrc));
check('draw(): on the base sheet the start marker is for the base dots only (gray dots behind an active layer stay gray)', /activeLayer === 'base' && nd\.id === selectedId/.test(drawSrc));
const png = src.indexOf("pngBtn.mousePressed(() => {");
check('PNG export: markerHidden = true + redraw() before exportPNG(), reset in a finally (+ redraw)', /markerHidden = true; redraw\(\);[^\n]*\n\s*try \{ exportPNG\(\); \} finally \{ markerHidden = false; redraw\(\); \}/.test(src.slice(png, png + 600)));
const ser = src.indexOf('try { res = await runAnimationExport');
const serTxt = ser < 0 ? '' : src.slice(src.lastIndexOf('markerHidden = true;', ser) - 5, ser + 400);
check('PNG series: markerHidden = true before runAnimationExport, reset in a finally (also on error / cancel) + redraw', /markerHidden = true;[^\n]*\n\s*let res;\n\s*try \{ res = await runAnimationExport\(env, opts\); \} finally \{ markerHidden = false; redraw\(\); \}/.test(serTxt), serTxt.slice(0, 200));
check('the switches are declared once: let hoverOn = true, markerHidden = false', (src.match(/let hoverOn = true, markerHidden = false;/g) || []).length === 1);
check('no block comment was added to sketch.js (the old source-text tests strip comments by regex)', !/\/\*\*?[^\n]*task 182/.test(src));
check('pressAt() itself is unchanged by task 182 (no hoverOn / markerHidden / selectedId in it)', !/hoverOn|markerHidden|selectedId/.test(pressAtSrc));
console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
