// Guard for the outline of the selected trail (patterns block, commit B): core/state.js's own slot faceSelected, core/facecolor.js faceHighlightKeyFor() (hover first, then the selection, per sheet),
// sketch.js's window.setFaceSelected (redraw only on a change, never touches faceHover) and the places that must keep nulling ONLY faceHover. The chip view's lifecycle is tested in
// tools/ui/test-phone-engine.js ('farbe-highlight') and its pure model in tools/ui/test-phone-chips.js. Source text and two functions cut out of the files; no browser.
//   node tools/ui/test-face-highlight.js
//   SKETCH_JS=... STATE_JS=... FACECOLOR_JS=... UI_PHONE_CHIPS_JS=... node tools/ui/test-face-highlight.js        (sabotage runs)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const SKETCH = read('SKETCH_JS', 'sketch.js'), STATE = read('STATE_JS', 'core/state.js'), FC = read('FACECOLOR_JS', 'core/facecolor.js'), CHIPS = read('UI_PHONE_CHIPS_JS', 'ui-phone-chips.js');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };
const fnText = (src, name) => { const i = src.search(new RegExp('function ' + name + '\\(')); if (i < 0) return ''; let d = 0, k = src.indexOf('{', i); for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } return ''; };

console.log('== faceHighlightKeyFor ==');
T('key', () => {
    const f = fnText(FC, 'faceHighlightKeyFor');
    check('the function is in core/facecolor.js', f.length > 40);
    const run = (vars, sheet) => { const ctx = vm.createContext(Object.assign({}, vars)); vm.runInContext(f + '\nthis.__r = faceHighlightKeyFor(' + JSON.stringify(sheet) + ');', ctx); return ctx.__r; };
    const H = (sheet, key) => ({ sheet, key }), N = null;
    check('nothing hovered, nothing selected: null', run({ faceHover: N, faceSelected: N }, 'base') === null);
    check('hover only: its key on its sheet, null on another sheet', run({ faceHover: H('base', 'h'), faceSelected: N }, 'base') === 'h' && run({ faceHover: H('base', 'h'), faceSelected: N }, 0) === null);
    check('selected only: its key on its sheet (base and a layer index, 0 included), null elsewhere', run({ faceHover: N, faceSelected: H('base', 's') }, 'base') === 's' && run({ faceHover: N, faceSelected: H(0, 's0') }, 0) === 's0' && run({ faceHover: N, faceSelected: H(1, 's1') }, 1) === 's1' && run({ faceHover: N, faceSelected: H(1, 's1') }, 'base') === null && run({ faceHover: N, faceSelected: H(1, 's1') }, 0) === null);
    check('both on the SAME sheet: the hover wins (the selection is not lost, it shows again when the hover ends)', run({ faceHover: H('base', 'h'), faceSelected: H('base', 's') }, 'base') === 'h');
    check('both on DIFFERENT sheets: each sheet gets its own key', run({ faceHover: H('base', 'h'), faceSelected: H(1, 's') }, 'base') === 'h' && run({ faceHover: H('base', 'h'), faceSelected: H(1, 's') }, 1) === 's');
    check('a sheet that matches neither: null', run({ faceHover: H('base', 'h'), faceSelected: H(1, 's') }, 2) === null);
    check('a page or a test without core/state.js (no faceSelected at all): the hover still works and nothing throws', run({ faceHover: H('base', 'h') }, 'base') === 'h' && run({ faceHover: N }, 'base') === null);
    check('a layer index 0 and the string "0" are different sheets (strict equality)', run({ faceHover: N, faceSelected: H(0, 's') }, '0') === null);
});

console.log('\n== core/state.js ==');
T('state', () => {
    const s = strip(STATE);
    check('the slot is declared once, next to faceHover, as null: let faceSelected = null;', (s.match(/let faceSelected = null;/g) || []).length === 1 && s.indexOf('let faceHover = null;') < s.indexOf('let faceSelected = null;') && s.indexOf('let faceSelected = null;') - s.indexOf('let faceHover = null;') < 80);
    check('the only change to existing core logic: the grid resets still null faceHover alone (faceSelected is corrected by the chip view on its next tick)', (s.match(/faceHover = null/g) || []).length >= 3 && !/faceSelected\s*=(?!=)/.test(s.replace('let faceSelected = null;', '')));
});

console.log('\n== window.setFaceSelected in sketch.js ==');
T('setter', () => {
    const f = fnText(SKETCH, 'setFaceSelected'), sk = strip(SKETCH);
    check('the function exists once and is exported: window.setFaceSelected = setFaceSelected', f.length > 80 && (sk.match(/function setFaceSelected\(/g) || []).length === 1 && /window\.setFaceSelected = setFaceSelected;/.test(sk));
    const body = strip(f);
    check('it returns BEFORE redraw() when the value did not change, and calls redraw() once', body.indexOf('if (same) return false;') > 0 && body.indexOf('if (same) return false;') < body.indexOf('redraw()') && (body.match(/redraw\(\)/g) || []).length === 1);
    check('it never touches faceHover', !/faceHover/.test(body));
    const mk = () => { const calls = []; const ctx = vm.createContext({ faceSelected: null, redraw: () => calls.push('redraw') }); vm.runInContext(f + '\nthis.set = setFaceSelected;', ctx); return { ctx, calls }; };
    const a = mk();
    check('set: a change stores { sheet, key } and redraws once; the same value again: no redraw, returns false', a.ctx.set('base', 'k') === true && JSON.stringify(a.ctx.faceSelected) === '{"sheet":"base","key":"k"}' && a.calls.length === 1 && a.ctx.set('base', 'k') === false && a.calls.length === 1);
    check('another key, another sheet (0 is a layer): each is a change and redraws', a.ctx.set('base', 'j') === true && a.ctx.set(0, 'j') === true && a.ctx.faceSelected.sheet === 0 && a.calls.length === 3);
    check('clear: key null (or undefined) empties the slot and redraws once; clearing an empty slot does nothing', a.ctx.set(null, null) === true && a.ctx.faceSelected === null && a.calls.length === 4 && a.ctx.set('base', null) === false && a.ctx.set(0, undefined) === false && a.calls.length === 4);
});

console.log('\n== what keeps nulling only faceHover ==');
T('hover', () => {
    const sk = strip(SKETCH), render = strip(fnText(SKETCH, 'renderFaceColorsPanel')), update = strip(fnText(SKETCH, 'updateFaceColorsPanel')), init = strip(fnText(SKETCH, 'initFaceColorsPanel'));
    check('renderFaceColorsPanel still nulls faceHover and does not mention faceSelected', /faceHover = null/.test(render) && !/faceSelected/.test(render));
    check('updateFaceColorsPanel still nulls faceHover (panel hidden) and does not mention faceSelected', /faceHover = null/.test(update) && !/faceSelected/.test(update));
    check('the hover handlers (mouseenter, mouseleave, the list\'s mouseleave) write faceHover only', /mouseenter', \(\) => \{ faceHover = \{ sheet, key: t\.key \}; redraw\(\); \}/.test(render) && !/faceSelected/.test(init));
    const writes = [...sk.matchAll(/faceSelected\s*=(?!=)/g)].length;
    check('sketch.js writes faceSelected in ONE place (setFaceSelected)', writes === 1, String(writes));
    const others = ['ui-phone-chips.js', 'ui-phone.js', 'ui-phone-timeline.js', 'ui-phone-pairing.js', 'ui-farbe.js', 'ui.js', 'ui-layers.js'].filter(f => /faceSelected/.test(strip(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
    check('no UI script writes the slot directly: they call window.setFaceSelected', others.length === 0, others.join());
});

console.log('\n== the chip view ==');
T('view', () => {
    const c = strip(CHIPS);
    check('it calls window.setFaceSelected (and only that) and never mentions faceHover', /win\.setFaceSelected\(/.test(c) && !/faceHover/.test(c) && (c.match(/setFaceSelected\(/g) || []).length === 1);
    check('it calls it only when the wanted outline CHANGED (compares with what it last passed)', /if \(same\) return false;[\s\S]{0,80}outlined = want;/.test(c));
    check('the triggers: UI tick (sync), every document click, deferred after a resize and after a tabchange; no MutationObserver', /doc\.addEventListener\('click'/.test(c) && /doc\.addEventListener\('tabchange'/.test(c) && /win\.addEventListener\('resize'/.test(c) && !/MutationObserver/.test(c));
    check('the active sheet comes from window.activeLayerNow, which ui-phone-timeline.js defines', /win\.activeLayerNow/.test(c) && /window\.activeLayerNow = function/.test(strip(fs.readFileSync(path.join(ROOT, 'ui-phone-timeline.js'), 'utf8'))));
    check('release is covered: the chips count as shown only while they are not in their hidden holder and no ancestor is hidden (a parked pane, the holder after release), and only while the trails surface is applied (html.sr-trails, set and removed by the engine: C0b-2; it was html.ph)', /n === holder \|\| n\.hidden/.test(c) && /html\.classList\.contains\('sr-trails'\)/.test(c) && !/html\.classList\.contains\('ph'\)/.test(c));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
