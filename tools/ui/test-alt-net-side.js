// Guard for the side of the alternative net construction (Roadmap 1.2-C): sideOfLine(p, q, m) takes a POINT as its third parameter and the two callers that refresh
// altNetPending.previewSide (mouseMoved() and tapPress()) used to pass x and y as two arguments, so m.y was undefined, the cross product was NaN and the side was always -1.
// Source text of sketch.js, plus vm runs of the REAL functions extracted from it and of core/forms.js. No browser.
//   node tools/ui/test-alt-net-side.js
//   SKETCH_JS=/path/to/mutated/sketch.js node tools/ui/test-alt-net-side.js        (sabotage runs)
//
// What it pins.
//   1. sideOfLine itself: a point on one side of PQ gives +1, the other -1, a point ON the line (cross product 0) gives +1 (`cross >= 0`); the sign is the one
//      completeEdgeToRegularPolygon(P, Q, n, side) uses: the polygon built with side = sideOfLine(P, Q, m) lies on m's side of PQ (n = 3, 4, 6, any direction of PQ).
//   2. Every call of sideOfLine has exactly THREE arguments and the definition exactly three parameters (the call that had four arguments is what this guards against).
//   3. mouseMoved() and tapPress() flip previewSide across the line PQ (the mouse path with { x: mouseX, y: mouseY }, the tap with the tap's own point), and only while the
//      construction has its second point.
//   4. The whole flow with the REAL handleAltNetClick: P, Q, a pointer above PQ, the third click: rebuildGridFromConstruction gets that side; below PQ: the other one.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const FORMS = fs.readFileSync(path.join(ROOT, 'core', 'forms.js'), 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 160)); } };
const codeOnly = t => t.replace(/\/\/[^\n]*/g, '');
const fnSrc = name => { const m = SKETCH.match(new RegExp('\\nfunction ' + name + '\\(([^)]*)\\) \\{[\\s\\S]*?\\n\\}\\n')); return m ? { args: m[1], text: m[0] } : null; };

// ---- 2. every call has three arguments (a balanced scan: commas at depth 0 of the parentheses, braces and brackets) ----
function calls(text, name) {
    const out = []; const re = new RegExp('(?<![A-Za-z0-9_$.])' + name + '\\(', 'g'); let m;
    while ((m = re.exec(text))) {
        if (/function\s+$/.test(text.slice(0, m.index))) continue;   // the definition
        let i = m.index + m[0].length, depth = 1, commas = 0, any = false;
        for (; i < text.length && depth > 0; i++) {
            const c = text[i];
            if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--;
            else if (c === ',' && depth === 1) commas++;
            if (depth > 0 && !/\s/.test(c)) any = true;
        }
        out.push({ args: any ? commas + 1 : 0, line: text.slice(0, m.index).split('\n').length, text: text.slice(m.index, i) });
    }
    return out;
}

console.log('== sideOfLine ==');
const side = fnSrc('sideOfLine');
check('sideOfLine exists once at the top level of sketch.js, with exactly three parameters (p, q, m)', !!side && side.args.split(',').map(s => s.trim()).filter(Boolean).length === 3 && side.args === 'p, q, m' && (SKETCH.match(/function sideOfLine\(/g) || []).length === 1, side && side.args);
const cs = calls(codeOnly(SKETCH), 'sideOfLine');
check('sideOfLine is called exactly twice (mouseMoved and tapPress), and EVERY call has exactly three arguments', cs.length === 2 && cs.every(c => c.args === 3), cs.map(c => c.args + ' args: ' + c.text).join(' | '));
check('...the mouse call passes { x: mouseX, y: mouseY } and the tap call the tap\'s point p', cs.length === 2 && /\{ x: mouseX, y: mouseY \}\)$/.test(cs[0].text) && /, p\)$/.test(cs[1].text), cs.map(c => c.text).join(' | '));
check('the scanner finds a four-argument call (what it guards against)', calls('x = sideOfLine(a, b, c, d); y = sideOfLine(a, b, { x: 1, y: 2 });', 'sideOfLine').map(c => c.args).join() === '4,3');

T('side values', () => {
    const sb = vm.createContext({ Math });
    vm.runInContext(side.text, sb);
    const S = (p, q, m) => vm.runInContext('sideOfLine(' + JSON.stringify(p) + ',' + JSON.stringify(q) + ',' + JSON.stringify(m) + ')', sb);
    const P = { x: 100, y: 200 }, Q = { x: 300, y: 200 };   // PQ points to +x
    check('PQ along +x: a point with SMALLER y (above on the screen) gives -1, one with LARGER y (below) gives +1', S(P, Q, { x: 200, y: 100 }) === -1 && S(P, Q, { x: 200, y: 300 }) === 1);
    check('a point ON the line (cross product 0) gives +1, also beyond P and Q', S(P, Q, { x: 200, y: 200 }) === 1 && S(P, Q, { x: 50, y: 200 }) === 1 && S(P, Q, P) === 1 && S(P, Q, Q) === 1);
    check('reversing the direction (Q to P) swaps the sides', S(Q, P, { x: 200, y: 100 }) === 1 && S(Q, P, { x: 200, y: 300 }) === -1);
    check('a point object is required: the old call with x and y as two arguments gives -1 for both sides (the defect, reproduced)', vm.runInContext('[sideOfLine({x:100,y:200},{x:300,y:200},200,100), sideOfLine({x:100,y:200},{x:300,y:200},200,300)]', sb).join() === '-1,-1');
    // the sign convention is completeEdgeToRegularPolygon's: the polygon built with side = sideOfLine(P, Q, m) lies on m's side
    const fb = vm.createContext({ Math, console }); vm.runInContext(FORMS, fb); vm.runInContext(side.text, fb);
    let bad = [], n = 0;
    for (const nn of [3, 4, 6]) for (let a = 0; a < 360; a += 30) {
        const p = { x: 300, y: 300 }, q = { x: 300 + 120 * Math.cos(a * Math.PI / 180), y: 300 + 120 * Math.sin(a * Math.PI / 180) };
        for (const m of [{ x: 300 + 80 * Math.cos((a + 90) * Math.PI / 180), y: 300 + 80 * Math.sin((a + 90) * Math.PI / 180) }, { x: 300 + 80 * Math.cos((a - 90) * Math.PI / 180), y: 300 + 80 * Math.sin((a - 90) * Math.PI / 180) }]) {
            fb.p = p; fb.q = q; fb.m = m; fb.nn = nn;
            const r = vm.runInContext('(() => { const s = sideOfLine(p, q, m); const c = completeEdgeToRegularPolygon(p, q, nn, s).center; return { s, centerSide: sideOfLine(p, q, c), other: sideOfLine(p, q, completeEdgeToRegularPolygon(p, q, nn, -s).center) }; })()', fb);
            n++; if (r.centerSide !== r.s || r.other === r.s) bad.push(nn + '/' + a);
        }
    }
    check('the polygon built with the side the pointer is on lies on the pointer\'s side of PQ (n = 3, 4, 6; PQ every 30 degrees; both sides): ' + n + ' cases', n === 72 && bad.length === 0, bad.join(' '));
});

// ---- 3 and 4: the real mouseMoved, tapPress and handleAltNetClick in a vm ----
console.log('\n== mouseMoved, tapPress and the third click ==');
T('flow', () => {
    const need = ['sideOfLine', 'mouseMoved', 'tapPress', 'handleAltNetClick', 'shapeToN', 'cancelAltNetConstruction'].map(fnSrc);
    check('sideOfLine, mouseMoved, tapPress, handleAltNetClick, shapeToN and cancelAltNetConstruction are found', need.every(Boolean), need.map((f, i) => f ? '' : i).join(''));
    const rebuilds = [], presses = [], redraws = [];
    const sb = vm.createContext({
        Math, console, dist: (a, b, c, d) => Math.hypot(c - a, d - b), redraw: () => redraws.push(1), select: () => null,
        rebuildGridFromConstruction: (p, q, n, s) => rebuilds.push({ p, q, n, s }), renderLayerTabs() { }, updateOffsetControls() { }, updateTimelineControls() { },
        clientToSketch: (x, y) => ({ x, y }), pressAt: (x, y) => presses.push([x, y]), nodeHit: () => null,
    });
    vm.runInContext('let altNetActive = false, altNetPending = null, showNodes = false, mouseX = 0, mouseY = 0, currentShape = "triangle"; const MIN_EDGE_LENGTH = 20;\n' + need.map(f => f.text).join('\n'), sb);
    const run = c => vm.runInContext(c, sb);
    const pend = () => JSON.parse(run('JSON.stringify(altNetPending)'));
    const P = { x: 100, y: 300 }, Q = { x: 300, y: 300 };   // PQ along +x; smaller y is above on the screen
    run('altNetActive = true; altNetPending = null'); run(`handleAltNetClick(${P.x}, ${P.y})`); run(`handleAltNetClick(${Q.x}, ${Q.y})`);
    check('after the second click the preview side is the default +1 (a finger has no hover: this is what a tap sees before it lands)', pend().previewSide === 1 && pend().q.x === 300);
    run('mouseX = 200; mouseY = 150; mouseMoved()');
    check('mouseMoved with the pointer ABOVE PQ (smaller y) sets previewSide -1', pend().previewSide === -1);
    run('mouseX = 200; mouseY = 450; mouseMoved()');
    check('...BELOW PQ (larger y) sets +1: it flips back (it was always -1 before)', pend().previewSide === 1);
    run('mouseX = 250; mouseY = 100; mouseMoved()');
    check('...above again: -1 (it flips both ways, not once)', pend().previewSide === -1);
    run('altNetPending = { p: { x: 100, y: 300 } }; mouseX = 200; mouseY = 450; mouseMoved()');
    check('with only the first point (no q yet) mouseMoved writes no previewSide', !('previewSide' in pend()));
    run('altNetActive = false; altNetPending = { p: { x: 100, y: 300 }, q: { x: 300, y: 300 }, previewSide: 1 }; mouseX = 200; mouseY = 150; mouseMoved()');
    check('...and not while the construction is not active', pend().previewSide === 1);
    // the tap path
    run('altNetActive = true; altNetPending = { p: { x: 100, y: 300 }, q: { x: 300, y: 300 }, previewSide: 1 }'); presses.length = 0;
    run('tapPress({ x: 200, y: 150, pointerType: "touch" })');
    check('tapPress with the tap ABOVE PQ sets previewSide -1 BEFORE pressAt runs (pressAt got the tap position)', pend().previewSide === -1 && presses.length === 1 && presses[0][0] === 200 && presses[0][1] === 150);
    run('altNetPending.previewSide = -1; tapPress({ x: 200, y: 450, pointerType: "touch" })');
    check('...BELOW PQ sets +1', pend().previewSide === 1);
    run('altNetActive = false; altNetPending = null'); presses.length = 0; run('tapPress({ x: 10, y: 10, pointerType: "mouse" })');
    check('tapPress without a construction writes nothing and still presses once', presses.length === 1 && run('altNetPending') === null);
    // the whole flow with the real handleAltNetClick
    for (const [label, hover, want] of [['above PQ', { x: 200, y: 120 }, -1], ['below PQ', { x: 200, y: 480 }, 1]]) {
        rebuilds.length = 0; run('altNetActive = true; altNetPending = null; currentShape = "square"');
        run(`handleAltNetClick(${P.x}, ${P.y})`); run(`handleAltNetClick(${Q.x}, ${Q.y})`);
        run(`mouseX = ${hover.x}; mouseY = ${hover.y}; mouseMoved()`); run(`handleAltNetClick(${hover.x}, ${hover.y})`);
        check('mouse: P, Q, hover ' + label + ', the third click: rebuildGridFromConstruction(P, Q, 4, ' + want + ') and the construction ends', rebuilds.length === 1 && rebuilds[0].s === want && rebuilds[0].n === 4 && rebuilds[0].p.x === 100 && rebuilds[0].q.x === 300 && run('altNetPending') === null && run('altNetActive') === false, JSON.stringify(rebuilds));
    }
    for (const [label, tap, want] of [['above PQ', { x: 200, y: 120 }, -1], ['below PQ', { x: 200, y: 480 }, 1]]) {
        rebuilds.length = 0; run('altNetActive = true; altNetPending = null; currentShape = "hex"');
        run(`handleAltNetClick(${P.x}, ${P.y})`); run(`handleAltNetClick(${Q.x}, ${Q.y})`);
        presses.length = 0;
        // the real tapPress writes the side, then pressAt (here the real third-click handler) runs
        sb.pressAt = (x, y) => run(`handleAltNetClick(${x}, ${y})`);
        run(`tapPress({ x: ${tap.x}, y: ${tap.y}, pointerType: "touch" })`);
        check('touch: P, Q, the third TAP ' + label + ': the side is written from the tap position: rebuildGridFromConstruction(P, Q, 6, ' + want + ')', rebuilds.length === 1 && rebuilds[0].s === want && rebuilds[0].n === 6, JSON.stringify(rebuilds));
    }
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
