// Task 180: a second click on the node that started a line closes nothing: no zero-length line [a, a] (task 161 report). The REAL pressAt() of sketch.js runs in a vm on stubs:
//   - click A, click A again: no line, the open start is gone, the redo stack is left alone (a cancel changes no line)
//   - click A, click B: exactly one line [A, B] (and the redo stack is cleared, as before)
//   - A A then B C: one line [B, C] (the cancelled start does not disturb the next one); an existing line [1, 2] stays; a layer behaves like the base; free end points do not trigger a cancel
//   - a random click protocol of 500 clicks on 4 nodes: never a line with equal ends
//   node tools/ui/test-click-same-node.js
//   SKETCH_JS=/path/to/another/sketch.js node tools/ui/test-click-same-node.js      (sabotage run: a copy WITHOUT the two lines must FAIL)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const src = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;

// pressAt as the file has it: from "function pressAt(" to the closing brace in column 0
const a = src.indexOf('\nfunction pressAt(') + 1;
const b = src.indexOf('\n}\n', a) + 3;
if (a < 1 || b < a) { console.log('FAIL pressAt() not found in sketch.js'); process.exit(1); }
const pressAtSrc = src.slice(a, b);

function world(opts) {
    opts = opts || {};
    const w = { redraws: 0, redoCleared: 0, connections: [], redoStack: opts.redo || [], layers: [{ connections: [], redoStack: opts.redo ? opts.redo.slice() : [] }], say: [] };
    const nodes = [1, 2, 3, 4].map(i => ({ id: i, x: i * 100, y: i * 100 }));
    w.nodes = nodes;
    const sb = {
        width: 600, height: 600, altNetActive: false, handleAltNetClick() { }, freeEndpointsEnabled: !!opts.free, activeLayer: opts.layer ? 0 : 'base', additionalLayers: w.layers,
        activeNodes: () => nodes, netWarpBaseNow: () => null, netWarpIsClosed: () => false, netWarpInsideNet: () => true,
        layerFreeNodeFromClick: (l, p) => p, netWarpFieldLocal: (n, p) => p, invertNetWarp: (n, p) => p,
        window: { say: (...x) => w.say.push(x) },
        activeConnections: () => (opts.layer ? w.layers[0].connections : w.connections),
        clearActiveRedoStack: () => { w.redoCleared++; if (opts.layer) w.layers[0].redoStack = []; else w.redoStack = []; },
        redraw: () => { w.redraws++; },
    };
    vm.createContext(sb);
    vm.runInContext(pressAtSrc, sb);
    w.sb = sb;
    w.click = id => sb.pressAt(300, 300, 'mouse', { id });
    w.conns = () => (opts.layer ? w.layers[0].connections : w.connections);
    w.redo = () => (opts.layer ? w.layers[0].redoStack : w.redoStack);
    return w;
}
const noNull = list => list.every(c => !(c.length === 2 && c[0] === c[1]));

// 1. A, A
{
    const w = world({ redo: [[3, 4]] });
    w.click(1);
    check('click A: an open start [A] (nothing drawn, one entry)', J(w.conns()) === J([[1]]));
    const cleared = w.redoCleared;
    w.click(1);
    check('click A, click A again: no line at all, the open start is gone', J(w.conns()) === J([]), J(w.conns()));
    check('...no line with equal ends', noNull(w.conns()));
    check('...the redo stack is NOT touched by the cancel (the first click had cleared it: it stays empty, no further clear)', w.redoCleared === cleared && J(w.redo()) === J([]));
    check('...and the canvas is redrawn once more', w.redraws === 2);
}
// a cancel with a filled redo stack: the stack stays (build it AFTER the first click, as undo would)
{
    const w = world();
    w.click(1);
    w.redoStack = [[7, 8]];
    const cleared = w.redoCleared;
    w.click(1);
    check('a cancel leaves a non-empty redo stack alone (no clearActiveRedoStack call, stack unchanged)', w.redoCleared === cleared && J(w.redo()) === J([[7, 8]]) && J(w.conns()) === J([]));
}
// 2. A, B
{
    const w = world();
    w.click(1); w.click(2);
    check('click A, click B: exactly one line [A, B]', J(w.conns()) === J([[1, 2]]), J(w.conns()));
    check('...and the redo stack was cleared by the add, as before', w.redoCleared === 2);
}
// 3. A A B C
{
    const w = world();
    w.click(1); w.click(1); w.click(2); w.click(3);
    check('A A then B C: one line [B, C] (the cancelled start does not disturb the next line)', J(w.conns()) === J([[2, 3]]), J(w.conns()));
}
// A, B, C, C: a finished line, then a cancelled start
{
    const w = world();
    w.click(1); w.click(2); w.click(3); w.click(3);
    check('A B then C C: the line [A, B] stays, the second C cancels the open start', J(w.conns()) === J([[1, 2]]), J(w.conns()));
}
// 4. an existing line [1,2], click 1, click 1
{
    const w = world();
    w.connections.push([1, 2]);
    w.click(1); w.click(1);
    check('an existing line [1,2]: click 1, click 1 leaves exactly [[1,2]]', J(w.conns()) === J([[1, 2]]), J(w.conns()));
    w.click(2); w.click(2);
    check('...and the same on the other end of an existing line', J(w.conns()) === J([[1, 2]]), J(w.conns()));
}
// 5. free end points
{
    const w = world({ free: true });
    w.sb.pressAt(10, 10, 'mouse', { id: null }); w.sb.pressAt(500, 500, 'mouse', { id: null });
    check('free end points: two clicks into empty space make two NEW nodes and one line (no false cancel)', w.nodes.length === 6 && w.conns().length === 1 && w.conns()[0][0] !== w.conns()[0][1], J(w.conns()));
    const w2 = world({ free: true });
    w2.sb.pressAt(10, 10, 'mouse', { id: null }); const first = w2.conns()[0][0];
    w2.click(first);
    check('free end points: a click on the free node that started the line cancels the start', J(w2.conns()) === J([]), J(w2.conns()));
}
// 6. a layer
{
    const w = world({ layer: true });
    w.click(2); w.click(2);
    check('a layer (active layer 0): the same cancel, no line on the layer, nothing on the base', J(w.conns()) === J([]) && J(w.connections) === J([]));
    w.click(2); w.click(3);
    check('a layer: click 2, click 3 makes the line [2,3] on the layer only', J(w.conns()) === J([[2, 3]]) && J(w.connections) === J([]));
}
// 7. a random click protocol
{
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const w = world();
    let ok = true, last = null;
    for (let i = 0; i < 500; i++) { w.click(1 + Math.floor(rnd() * 4)); if (!noNull(w.conns())) ok = false; }
    check('500 random clicks on 4 nodes: never a line with equal ends', ok && noNull(w.conns()), J(w.conns().filter(c => c[0] === c[1])));
    check('...every entry is a complete pair except at most the last open start', w.conns().every((c, i, arr) => c.length === 2 || (i === arr.length - 1 && c.length === 1)));
}
// source pins: the guard is the first thing after activeConnections(), before the push and before clearActiveRedoStack(); an // comment, no block comment
{
    const i0 = pressAtSrc.indexOf('const conns = activeConnections();');
    const g = pressAtSrc.indexOf('conns[conns.length - 1].length === 1 && conns[conns.length - 1][0] === foundId');
    const push = pressAtSrc.indexOf('conns.push([foundId])'), clr = pressAtSrc.indexOf('clearActiveRedoStack()');
    check('source: the same-node guard stands right after activeConnections() and before the push and before clearActiveRedoStack()', i0 > 0 && g > i0 && g < push && g < clr, [i0, g, push, clr].join(' '));
    check('source: the cancel is conns.pop(); redraw(); return; (it adds nothing)', /\{ conns\.pop\(\); redraw\(\); return; \}/.test(pressAtSrc));
    check('source: the comment is a // line naming task 180, there is no block comment in pressAt()', /\/\/ task 180:/.test(pressAtSrc) && !/\/\*/.test(pressAtSrc));
}
console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
