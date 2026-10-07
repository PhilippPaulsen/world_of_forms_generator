// Wiring guard for the touch tap path (Phase 2, B2): source text of sketch.js and index.html, no browser.
//   node tools/ui/test-touch-wiring.js
//   SKETCH_JS=/path/to/mutated/sketch.js INDEX_HTML=/path/to/mutated/index.html node tools/ui/test-touch-wiring.js    (sabotage runs)
//
// What a real touch needs, and what silently breaks it: core/pointer-tap.js loaded before sketch.js; installTapInput() called once from setup();
// a defined, empty touchStarted that does not return false (p5 1.9.0 calls mousePressed at touchstart otherwise, and a `false` would prevent the
// default and block scrolling); pointerdown in the capture phase on the canvas container and the other three on window; no preventDefault anywhere
// in the tap code; mousePressed() asking the detector about the emulated mouse FIRST and then running the unchanged mouse path through pressAt();
// pressAt() taking its coordinates as arguments (no mouseX / mouseY left in it); tapPress() mapping client pixels the way p5 does, refreshing the
// Alt-net side preview BEFORE pressAt(). B4b adds: core/pick-node.js loaded before sketch.js; pickNodeAt used only in the tap path (tapPress -> touchHit ->
// pressAt's `hit`), never in the mouse path; the radius rule (free endpoints on: the fine radius, off: by pointer type); drawnHitNodes() read-only. The behaviour itself is tested in tools/ui/test-pointer-tap.js and checked in a browser pane.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const sketch = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const html = fs.readFileSync(process.env.INDEX_HTML || path.join(ROOT, 'index.html'), 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const count = (text, needle) => text.split(needle).length - 1;
const fn = (name) => { const m = sketch.match(new RegExp('\\nfunction ' + name + '\\(([^)]*)\\) \\{([\\s\\S]*?)\\n\\}\\n')); return m ? { args: m[1], body: m[2] } : null; };
const codeOnly = t => t.replace(/\/\/[^\n]*/g, '');

console.log('== index.html ==');
{
    const tag = /<script src="core\/pointer-tap\.js\?v=\w+"><\/script>/;
    const iTap = html.search(tag), iSketch = html.indexOf('<script src="sketch.js?v='), iWriter = html.indexOf('core/session-writer.js');
    check('core/pointer-tap.js is loaded with a ?v= (the cache-bust guard covers it)', iTap > 0);
    check('...before sketch.js (sketch.js calls createTapDetector from setup)', iTap > 0 && iSketch > iTap, `${iTap} < ${iSketch}`);
    check('...and after the session scripts, as one more core file ahead of sketch.js', iTap > iWriter && iWriter > 0);
    const iPick = html.search(/<script src="core\/pick-node\.js\?v=\w+"><\/script>/);
    check('core/pick-node.js is loaded with a ?v= (the cache-bust guard covers it)', iPick > 0);
    check('...before sketch.js (touchHit calls pickNodeAt and hitRadius at the first tap) and after pointer-tap.js', iPick > iTap && iSketch > iPick, `${iTap} < ${iPick} < ${iSketch}`);
    check('...and exactly once', count(html, 'core/pick-node.js') === 1);
    const versions = new Set([...html.matchAll(/\?v=(\d{8}[a-z]+)/g)].map(m => m[1]));
    check('one ?v= version in the whole file (the new tag is bumped with the rest)', versions.size === 1, [...versions].join());
}

console.log('\n== sketch.js: installation ==');
const inst = fn('installTapInput'), press = fn('pressAt'), mp = fn('mousePressed'), tp = fn('tapPress'), c2s = fn('clientToSketch'), dhn = fn('drawnHitNodes'), th = fn('touchHit');
{
    check('installTapInput, pressAt, mousePressed, tapPress, clientToSketch, drawnHitNodes and touchHit all exist', !!(inst && press && mp && tp && c2s && dhn && th));
    const setup = (sketch.match(/\nfunction setup\(\) \{([\s\S]*?)\n\}\n/) || [, ''])[1];
    check('setup() calls installTapInput() once, right after createCanvas(...).noLoop()', count(codeOnly(setup), 'installTapInput()') === 1 && /createCanvas\(canvasW, canvasH\)\.parent\('canvas-container'\);\n\s*noLoop\(\);\n\s*installTapInput\(\);/.test(setup));
    const b = inst ? codeOnly(inst.body) : '';
    check('the old behaviour stays when the script is missing: return before anything is installed', /if \(typeof createTapDetector !== 'function'\) return;/.test(b) && b.indexOf('createTapDetector') < b.indexOf('touchStarted'));
    check('the detector gets a clock: performance.now()', /createTapDetector\(\{ now: \(\) => performance\.now\(\) \}\)/.test(b));
    check('pointerdown: capture phase, on the canvas container', /box\.addEventListener\('pointerdown', e => \{ tapDetector\.down\(e\); \}, true\);/.test(b) && /const box = document\.getElementById\('canvas-container'\);/.test(b));
    check('pointermove, pointerup and pointercancel: on window, feeding move / up / cancel', /window\.addEventListener\('pointermove', e => \{ tapDetector\.move\(e\); \}\);/.test(b) && /window\.addEventListener\('pointerup', e => \{ const tap = tapDetector\.up\(e\); if \(tap\) tapPress\(tap\); \}\);/.test(b) && /window\.addEventListener\('pointercancel', e => \{ tapDetector\.cancel\(e\); \}\);/.test(b));
    check('touchStarted is defined, empty, and does not return false', /window\.touchStarted = function \(\) \{ \};/.test(b) && !/return false/.test(b));
    check('no touch / pointer handler of the tap code calls preventDefault (scroll and pinch stay the browser\'s)', !/preventDefault/.test(codeOnly(inst.body + tp.body + c2s.body)));
    check('no other touchStarted / touchMoved / touchEnded is defined anywhere in sketch.js', count(codeOnly(sketch), 'touchStarted') === 1 && !/function touch(Moved|Ended)|touch(Moved|Ended) =/.test(codeOnly(sketch)));
    check('the detector lives in one top-level let', count(codeOnly(sketch), 'let tapDetector = null;') === 1);
}

console.log('\n== sketch.js: the press paths ==');
{
    const m = mp ? codeOnly(mp.body).split('\n').map(l => l.trim()).filter(Boolean) : [];
    check('mousePressed(e) takes the event', mp && mp.args === 'e');
    check('mousePressed first asks whether this is the emulated mouse of the last tap (client coordinates of the event)', m[0] === 'if (tapDetector && e && tapDetector.consumeEmulatedMouse(e.clientX, e.clientY)) return;', m[0]);
    check('...then runs the mouse path unchanged: pressAt(mouseX, mouseY, \'mouse\'), nothing else', m.length === 2 && m[1] === "pressAt(mouseX, mouseY, 'mouse');", m.join(' | '));
    const pb = press ? codeOnly(press.body) : '';
    check('pressAt(x, y, pointerType, hit) takes its coordinates as arguments, and the tap path\'s resolved node as an optional fourth', press && press.args === 'x, y, pointerType, hit');
    check('pressAt contains no mouseX / mouseY (a tap would read the stale mouse position)', press && !/mouseX|mouseY/.test(pb));
    check('pressAt keeps the old logic in the old order: bounds, Alt-net, nearest-first loop with the 18-unit radius, closed-net refusal, free endpoint, connection', press && /^\s*if \(x < 0 \|\| x > width \|\| y < 0 \|\| y > height\) return;\n\s*if \(altNetActive\) \{ handleAltNetClick\(x, y\); return; \}/.test(pb) && /dist\(x, y, p\.x, p\.y\) < 18/.test(pb) && /netWarpInsideNet\(netWarp, \{ x: x, y: y \}\)/.test(pb) && /invertNetWarp\(netWarp, \{ x: x, y: y \}\)/.test(pb) && /clearActiveRedoStack\(\);/.test(pb) && pb.indexOf('handleAltNetClick') < pb.indexOf('dist(x, y') && pb.indexOf('dist(x, y') < pb.indexOf('freeEndpointsEnabled') && pb.indexOf('newId') < pb.indexOf('conns.push'));
    check('the only caller of pressAt with a pointer-type string for the mouse is mousePressed; tapPress passes the tap\'s own type', count(codeOnly(sketch), "pressAt(mouseX, mouseY, 'mouse')") === 1 && tp && /pressAt\(p\.x, p\.y, tap\.pointerType, touchHit\(p\.x, p\.y, tap\.pointerType\)\);/.test(codeOnly(tp.body)));
    const t = tp ? codeOnly(tp.body).split('\n').map(l => l.trim()).filter(Boolean) : [];
    check('tapPress maps client pixels to sketch units first, refreshes the Alt-net side preview, and only then presses', t.length === 3 && t[0] === 'const p = clientToSketch(tap.x, tap.y);' && /^if \(altNetActive && altNetPending && altNetPending\.q !== undefined\) altNetPending\.previewSide = sideOfLine\(altNetPending\.p, altNetPending\.q, p\.x, p\.y\);$/.test(t[1]) && t[2] === 'pressAt(p.x, p.y, tap.pointerType, touchHit(p.x, p.y, tap.pointerType));', t.join(' | '));
    check('...with the same condition mouseMoved() uses for the preview, so the mouse path and the tap path update the same thing', /if \(altNetActive && altNetPending && altNetPending\.q !== undefined\) \{\n\s*altNetPending\.previewSide = sideOfLine\(altNetPending\.p, altNetPending\.q, mouseX, mouseY\);/.test(sketch));
    const c = c2s ? codeOnly(c2s.body) : '';
    check('clientToSketch is p5\'s own mapping: (client - rect) / (scrollWidth / width), the canvas inside the container', /\(clientX - r\.left\) \/ sx/.test(c) && /\(clientY - r\.top\) \/ sy/.test(c) && /cv\.scrollWidth \/ width \|\| 1/.test(c) && /cv\.scrollHeight \/ height \|\| 1/.test(c) && /#canvas-container canvas/.test(c));
}

console.log('\n== sketch.js: the nearest-node pick for touch and pen (B4b) ==');
{
    const cs = codeOnly(sketch), pb = press ? codeOnly(press.body) : '';
    check('pickNodeAt is called exactly once in sketch.js, inside touchHit', count(cs, 'pickNodeAt(') === 1 && th && count(codeOnly(th.body), 'pickNodeAt(') === 1);
    check('touchHit is called exactly once, from tapPress (the tap path) - never from mousePressed or pressAt', count(cs, 'touchHit(') === 2 /* the definition and the call */ && tp && count(codeOnly(tp.body), 'touchHit(') === 1 && mp && !/touchHit|pickNodeAt|hitRadius|drawnHitNodes/.test(codeOnly(mp.body)) && !/touchHit|pickNodeAt|hitRadius|drawnHitNodes/.test(pb));
    check('pressAt takes the resolved node from `hit` and keeps its own loop for the mouse: "if (hit) foundId = hit.id; else for (...)"', /if \(hit\) foundId = hit\.id;\n\s*else for \(let nd of activeNodeArr\)/.test(pb) && count(pb, 'foundId = hit.id') === 1);
    check('pressAt\'s mouse loop is untouched: layerNodeDrawnPosition, applyNetWarp, dist < 18, first match breaks', /else for \(let nd of activeNodeArr\) \{ const q = hitLayer \? layerNodeDrawnPosition\(hitLayer, nd\) : nd; const p = netWarp \? applyNetWarp\(netWarp, q\) : q; if \(dist\(x, y, p\.x, p\.y\) < 18\) \{ foundId = nd\.id; break; \} \}/.test(pb));
    check('the pressAt calls: one with the mouse (3 arguments), one from tapPress (4 arguments), no others', count(cs, "pressAt(mouseX, mouseY, 'mouse')") === 1 && count(cs, 'pressAt(p.x, p.y, tap.pointerType, touchHit(') === 1 && count(cs, 'pressAt(') === 3 /* the definition and the two calls */, String(count(cs, 'pressAt(')));
    const t = th ? codeOnly(th.body) : '';
    check('touchHit falls back to the old loop when core/pick-node.js is missing (returns undefined before using it)', /if \(typeof pickNodeAt !== 'function' \|\| typeof hitRadius !== 'function'\) return undefined;/.test(t) && t.indexOf("typeof pickNodeAt") < t.indexOf('pickNodeAt(drawnHitNodes()'));
    check('the radius: free endpoints on -> the fine radius (hitRadius(\'mouse\')), off -> by pointer type', /const radius = freeEndpointsEnabled \? hitRadius\('mouse', scale\) : hitRadius\(pointerType, scale\);/.test(t));
    check('the scale is the canvas\'s own css px per sketch unit, as clientToSketch measures it (scrollWidth / width)', /cv\.scrollWidth \/ width/.test(t) && /#canvas-container canvas/.test(t));
    check('the pick runs over drawnHitNodes() at the tap position and returns { id } (null when none)', /pickNodeAt\(drawnHitNodes\(\), x, y, radius\)/.test(t) && /return \{ id: n \? n\.id : null \};/.test(t));
    const d = dhn ? codeOnly(dhn.body) : '';
    check('drawnHitNodes mirrors the loop of pressAt: activeNodes(), netWarpBaseNow(), the active layer, layerNodeDrawnPosition, applyNetWarp', /const arr = activeNodes\(\), netWarp = netWarpBaseNow\(\), hitLayer = activeLayer === 'base' \? null : additionalLayers\[activeLayer\];/.test(d) && /const q = hitLayer \? layerNodeDrawnPosition\(hitLayer, nd\) : nd; const p = netWarp \? applyNetWarp\(netWarp, q\) : q;/.test(d));
    check('drawnHitNodes is read-only: it maps to NEW objects { id, x, y } and writes nothing', /return \{ id: nd\.id, x: p\.x, y: p\.y \};/.test(d) && !/\.push\(|\.splice\(|\.sort\(|\w\.(x|y|id) =[^=]|\+\+|--/.test(d));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
