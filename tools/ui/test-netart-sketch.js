/**
 * tools/ui/test-netart-sketch.js - task 122: the Netz panel of sketch.js (initNetControls(), the IIFE inside setup()) under the Netzart stepper. The IIFE is cut out of the REAL sketch.js and run with stubs for p5
 * (select / selectAll record the handlers), so what runs is the shipped code: netArtSet('off' | 'n1' | '3c'), the memory of Netzart 1, the guards that keep the panel from rewriting a 3C spec.
 *   node tools/ui/test-netart-sketch.js
 *   SKETCH_JS=... node tools/ui/test-netart-sketch.js        (a mutated copy)
 * Sabotages S2, S3, S4, S7, S8 (+ S10, S11): each must turn at least one check red (S1, S5, S6, S9: tools/ui/test-netart-model.js).
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8'), CORE = fs.readFileSync(path.join(ROOT, 'core', 'netwarp.js'), 'utf8');
const J = JSON.stringify, mut = (s, a, b) => { if (!s.includes(a)) throw new Error('sabotage text not found: ' + a.slice(0, 70)); return s.replace(a, b); };

function cutIife(src) {
  const a = src.indexOf('(function initNetControls() {'), b = src.indexOf('\n    })();', a);
  if (a < 0 || b < 0) throw new Error('initNetControls() not found');
  return src.slice(a, b + '\n    })();'.length);
}
function makeWorld(sketchSrc) {
  const sb = { console }; vm.createContext(sb); vm.runInContext(CORE, sb);
  const handlers = {}, locks = [], redraws = { n: 0 };
  const mkEl = (extra) => { const cls = new Set(); const el = Object.assign({ hidden: false, title: '', textContent: '', disabled: false, dataset: {}, classList: { toggle: (c, on) => { on === undefined ? (cls.has(c) ? cls.delete(c) : cls.add(c)) : (on ? cls.add(c) : cls.delete(c)); }, contains: c => cls.has(c), add: c => cls.add(c), remove: c => cls.delete(c) }, innerHTML: '', appendChild() { } }, extra || {}); return el; };
  const mk = (sel, extra) => { const o = { sel, elt: mkEl(extra), _v: '50', value(v) { if (v === undefined) return this._v; this._v = String(v); return this; }, html() { return this; }, mousePressed(f) { (handlers[sel] = handlers[sel] || []).push(f); }, input(f) { (handlers[sel + ':input'] = handlers[sel + ':input'] || []).push(f); }, removeClass() { }, addClass() { }, class() { } }; return o; };
  const kinds = ['regular', 'sinus', 'tangens', 'geometric'].map(k => mk('.net-kind-btn:' + k, { dataset: { kind: k } })), axes = ['both', 'x', 'y'].map(k => mk('.net-axes-btn:' + k, { dataset: { axes: k } })), doms = ['single', 'tiled', 'field'].map(k => mk('.net-domain-btn:' + k, { dataset: { domain: k } }));
  const cache = {};
  Object.assign(sb, {
    select: sel => cache[sel] || (cache[sel] = mk(sel)), selectAll: sel => sel === '.net-kind-btn' ? kinds : sel === '.net-axes-btn' ? axes : sel === '.net-domain-btn' ? doms : [],
    window: {}, document: { createElement: () => mkEl() }, baseNetTransform: null, baseNetAnimation: null, timeline: null, netLinesOn: false, currentShape: 'square', activeLayer: 'base', additionalLayers: [], nodeCount: 4, shapeSizeFactor: 3,
    outerCorners: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }], curveType: { kind: 'straight' }, gridSpec: { ordnung: 3 }, nodeInput: null,
    curveBtn: mk('curve'), freeBtn: mk('free'), faceBtn: mk('face'), say: () => { }, redraw: () => { redraws.n++; }, updateCurveTypeControls: () => { }, layerGridMatchesBase: () => true,
    lockBtn: (b, r) => locks.push([b.sel, r]), netSizeFactors: () => ({ x: 3, y: 3 }), baseGridDivisions: () => 3, gridMinOrdnungTrig: () => 3, fromLegacy: (s, n) => n, getGridDivisions: g => g - 1, canvasW: 600, canvasH: 600
  });
  // the identifiers the IIFE writes to and reads: all through one proxy over the sandbox (unknown names throw, so a missing stub is visible)
  const prox = new Proxy(sb, { has: (t, k) => typeof k === 'string' && k in t, get: (t, k) => (k === Symbol.unscopables ? undefined : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
  // declarations of sketch.js outside the IIFE that it assigns to (let adoptNetState / netControlsSync): provided as sandbox slots
  sb.adoptNetState = null; sb.netControlsSync = null;
  const code = cutIife(sketchSrc);
  new Function('__w', 'with (__w) { ' + code + ' }')(prox);
  return { sb, handlers, locks, redraws, kinds, doms, spec: () => J(sb.baseNetTransform), sync: () => sb.netControlsSync(), set: (a, p) => sb.window.netArtSet(a, p) };
}

function suite(sketchSrc) {
  const res = [], check = (name, ok, detail) => res.push({ name, ok: !!ok, detail });
  const guard = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw: ' + String(e && e.message).slice(0, 100) + ')', false); } };
  const P3 = { a: 2, b: 4, format: 'full' };
  guard('1', () => {
    const w = makeWorld(sketchSrc), S = w.sb;
    check('1. the hook exists: window.netArtSet, netControlsSync, adoptNetState', typeof S.window.netArtSet === 'function' && typeof S.netControlsSync === 'function' && typeof S.adoptNetState === 'function');
    w.set('n1');
    const n1 = S.baseNetTransform;
    check('1b. "1" from "-": a Netzart 1 spec (sinus, both axes), no kind, field or single domain', n1 && n1.kind === undefined && n1.x.kind === 'trig' && n1.x.w < 0 && n1.y === 'same', w.spec());
    w.set('3c', P3);
    check('1c. "3C": exactly the spec of core/netwarp.js (nothing added: no repeat, domain, macro)', w.spec() === J(S.netProjectiveSpec(2, 4, 'full')), w.spec());
    w.sync(); w.sync();
    check('1d. netControlsSync() under 3C leaves the spec alone, twice', w.spec() === J(S.netProjectiveSpec(2, 4, 'full')), w.spec());
    w.set('off');
    check('1e. "-": no net', S.baseNetTransform === null);
  });
  guard('2', () => {
    const w = makeWorld(sketchSrc), S = w.sb; w.set('n1'); w.set('3c', P3); const before = w.spec();
    w.handlers['.net-kind-btn:sinus'][0]();   // a Netzart 1 control while 3C is chosen (programmatic: the CSS hides it)
    check('2. a Netzart 1 kind button pressed under 3C does not replace the 3C spec (commit guard)', w.spec() === before, w.spec());
  });
  guard('3', () => {
    const w = makeWorld(sketchSrc); w.set('n1'); w.set('3c', P3); const before = w.spec();
    w.handlers['.net-domain-btn:tiled'][0]();
    check('3. the domain button under 3C writes nothing into the 3C spec (setDomain guard: no repeat / domain keys)', w.spec() === before, w.spec());
  });
  guard('4', () => {
    const w = makeWorld(sketchSrc); w.set('3c', P3); w.sync();
    const face = w.locks.filter(l => l[0] === 'face').pop(), curve = w.locks.filter(l => l[0] === 'curve').pop();
    check('4. under 3C the face fill is NOT locked (base sheet), curve and free are locked with the net reason', face && face[1] === null && curve && /Off while a net transform is active/.test(curve[1]), J([face, curve]));
    const w2 = makeWorld(sketchSrc); w2.set('3c', P3); w2.sb.activeLayer = 0; w2.sb.additionalLayers = [{}]; w2.sb.layerGridMatchesBase = () => false; w2.locks.length = 0; w2.sync();
    const f2 = w2.locks.filter(l => l[0] === 'face').pop();
    check('4b. a layer that is not on the base grid: the face fill is locked with the 3C reason', f2 && typeof f2[1] === 'string' && /3C/.test(f2[1]), J(f2));
  });
  guard('5', () => {
    const w = makeWorld(sketchSrc), S = w.sb; w.set('3c', P3);
    ['fieldHint', 'fieldInfo', 'macroRow'].length;   // the notes of Netzart 1 are hidden under 3C: the sandbox elements record `hidden`
    w.sync();
    const hiddenRows = ['#net-field-hint', '#net-field-info', '#net-macro-row', '#net-macro-hint', '#net-size-hint', '#net-focus-row', '#net-geo-row'].map(sel => w.sb.select(sel).elt.hidden);
    check('5. the Netzart 1 notes and rows (field hint and info, macro, size hint, focus, geo) are hidden under 3C', hiddenRows.every(Boolean), J(hiddenRows));
    check('5b. the group carries the class net-3c-on under 3C and loses it again for Netzart 1', w.sb.select('#net-group').elt.classList.contains('net-3c-on') && (() => { w.set('n1'); w.sync(); return !w.sb.select('#net-group').elt.classList.contains('net-3c-on'); })());
  });
  guard('6', () => {
    const w = makeWorld(sketchSrc), S = w.sb; w.set('n1');
    w.handlers['.net-kind-btn:tangens'][0]();   // law tangens
    S.window.x = 1; const lawBefore = J(S.baseNetTransform.x);
    w.set('3c', P3); w.set('n1');
    check('6. 1 -> 3C -> 1: the law (tangens) and its strength come back', J(S.baseNetTransform && S.baseNetTransform.x) === lawBefore && S.baseNetTransform.x.w > 0, J(S.baseNetTransform));
    w.set('off'); w.set('n1');
    check('6b. 1 -> - -> 1: the same memory', J(S.baseNetTransform && S.baseNetTransform.x) === lawBefore, J(S.baseNetTransform));
  });
  guard('7', () => {
    const w = makeWorld(sketchSrc), S = w.sb; w.set('n1'); w.handlers['.net-kind-btn:tangens'][0](); const lawBefore = J(S.baseNetTransform.x);
    S.baseNetTransform = S.netProjectiveSpec(3, 6, 'full'); S.adoptNetState();   // a restored session with a 3C net (session-apply writes the spec, then calls adoptNetState)
    w.set('n1');
    check('7. adoptNetState() under 3C keeps the memory of Netzart 1 (the law is not reset)', J(S.baseNetTransform && S.baseNetTransform.x) === lawBefore, J(S.baseNetTransform));
  });
  guard('8', () => {
    const w = makeWorld(sketchSrc), S = w.sb; w.set('3c', P3);
    check('8. "1" with no Netzart 1 memory starts from the defaults (sinus), not from nothing', (w.set('n1'), S.baseNetTransform && S.baseNetTransform.x.kind === 'trig'));
  });
  guard('9', () => {
    const w = makeWorld(sketchSrc), S = w.sb; S.timeline = { netLive: true, playing: false }; S.baseNetAnimation = { live: true, playing: false };
    w.set('3c', P3);
    check('9. an author change of the net ends a paused timeline / animation frame (like commit() does)', S.timeline.netLive === false && S.baseNetAnimation.live === false);
    const n = w.redraws.n; w.set('3c', { a: 3, b: 6, format: 'half' });
    check('9b. a 3C change redraws and writes the new spec', w.redraws.n > n && w.spec() === J(S.netProjectiveSpec(3, 6, 'half')));
  });
  guard('10', () => {
    const src = sketchSrc.replace(/\/\/[^\n]*/g, '');
    check('10. the source: no block comment was added (the old tests strip comments with a regex), the eight protected functions are byte-equal to main (checked by test-resize-format)', (sketchSrc.match(/\/\*/g) || []).length <= 1);
  });
  return res;
}

let failures = 0, checks = 0;
suite(SKETCH).forEach(r => { checks++; if (!r.ok) failures++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail !== undefined && r.detail !== '' ? '  [' + r.detail + ']' : ''}`); });
if (!process.env.SKETCH_JS) {
  console.log('== sabotages: each must turn at least one check red ==');
  const SAB = [
    ['S2  commit() without its 3C guard', s => mut(s, "            if (is3C()) { afterAuthorEdit(); return; }   // task 122: a Netzart 1 control must not replace a 3C spec\n", '')],
    ['S3  setDomain() writes into a 3C spec', s => mut(s, 'if (baseNetTransform && !is3C()) {', 'if (baseNetTransform) {')],
    ['S4  faceOk of the 3C branch false (the 121 gap: faces locked under 3C)', s => mut(s, 'const faceOk3 = active && (activeLayer', 'const faceOk3 = false && active && (activeLayer')],
    ['S7  adoptNetState() resets the memory under 3C', s => mut(s, "            if (is3C()) { render(); return; }   // task 122: a restored 3C net keeps the Netzart 1 memory of this panel\n", '')],
    ['S8  3C -> 1 loses the law (memory not restored)', s => mut(s, "if (memo) { ui.axes = memo.axes;", "if (false) { ui.axes = memo.axes;")],
    ['S10 the 3C branch of netControlsSync is missing (Field notes and macro under 3C)', s => mut(s, '            if (on3C) {   // task 122:', '            if (false) {   // task 122:')],
    ['S11 the hook does not end a paused timeline frame', s => mut(s, "            if (timeline && timeline.netLive && !timeline.playing) timeline.netLive = false;\n            render(); netControlsSync(); redraw(); if (window.syncNetAnimationDisplay)", "            render(); netControlsSync(); redraw(); if (window.syncNetAnimationDisplay)")]
  ];
  for (const [name, fn] of SAB) {
    let red = []; try { red = suite(fn(SKETCH)).filter(r => !r.ok).map(r => r.name.slice(0, 44)); } catch (e) { red = ['sabotage setup: ' + e.message]; }
    checks++; const ok = red.length > 0 && !red[0].startsWith('sabotage setup'); if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  [red: ${red.length}${red.length ? ' - ' + red.slice(0, 2).join(' | ') : ''}]`);
  }
}
console.log(`\n${checks - failures}/${checks} passed${failures ? ', ' + failures + ' FAILED' : ''}`);
process.exit(failures ? 1 : 0);
