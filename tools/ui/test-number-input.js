// Guard for typed decimal numbers (phone layout, commit 3c): UI.normalizeNumber() of the REAL ui.js in a vm, the exact fields' handler of ui-net.js extracted and run, and the inventory of typed
// number fields of index.html with the place that parses each. No browser.
//   node tools/ui/test-number-input.js
//   UI_JS=... UI_NET_JS=... INDEX_HTML=... STYLE_CSS=... node tools/ui/test-number-input.js        (sabotage runs)
//
// Why. The German iOS decimal pad types a comma ("0,35"). A <input type="number"> under <html lang="en"> gives value "" for it on iOS Safari (the typed text never reaches the script), so the two
// exact fields (#net-strength-exact, #net-focus-exact) are type="text" inputmode="decimal" now, and their handler reads the text through UI.normalizeNumber() before its parseFloat.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const UI_SRC = read('UI_JS', 'ui.js'), NET = read('UI_NET_JS', 'ui-net.js'), HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css'), SKETCH = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

// the real ui.js, in a vm with the little DOM it touches at load
function loadUI() {
    const noop = () => { };
    const el = () => ({ addEventListener: noop, setAttribute: noop, getAttribute: () => null, appendChild: noop, classList: { add: noop, remove: noop }, style: {}, dataset: {} });
    const document = { visibilityState: 'visible', activeElement: null, body: el(), getElementById: () => null, createElement: el, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop };
    const ctx = vm.createContext({ document, console, Event: class { }, MutationObserver: class { observe() { } }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop, performance: { now: () => 0 } });
    ctx.window = ctx;
    vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    return ctx.UI;
}

console.log('== the helper: inputs and outputs ==');
const TABLE = [
    // typed, normalized string, what parseFloat reads from it (NaN = the field falls back to its previous value, as for any text that is not a number)
    ['0,35', '0.35', 0.35], ['0.35', '0.35', 0.35], ['-0,5', '-0.5', -0.5], ['-0.5', '-0.5', -0.5], ['1,', '1.', 1], [',5', '.5', 0.5], ['1.', '1.', 1], ['.5', '.5', 0.5],
    ['1,2,3', '', NaN], ['1.2,3', '', NaN], ['1,2.3', '', NaN], ['1.234,5', '', NaN], ['1.2.3', '', NaN], ['0,35 ', '0.35', 0.35], ['  0,35', '0.35', 0.35], [' -0,5 ', '-0.5', -0.5],
    ['', '', NaN], ['   ', '', NaN], ['abc', 'abc', NaN], ['0.35abc', '0.35abc', 0.35], ['1', '1', 1], ['-1', '-1', -1], ['0', '0', 0], ['1,00', '1.00', 1], ['-', '-', NaN], [',', '.', NaN], ['−0,5', '−0.5', NaN],
];
T('table', () => {
    const UI = loadUI();
    const same = (a, b) => Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b));
    for (const [typed, norm, num] of TABLE) {
        const got = UI.normalizeNumber(typed), n = parseFloat(got);
        check(`${JSON.stringify(typed)} -> ${JSON.stringify(norm)} -> ${Number.isNaN(num) ? 'NaN (rejected / fallback)' : num}`, got === norm && same(n, num), JSON.stringify(got) + ' -> ' + n);
    }
    check('null and undefined are the empty text (the fallback), a number is its text', UI.normalizeNumber(null) === '' && UI.normalizeNumber(undefined) === '' && UI.normalizeNumber(0.35) === '0.35' && UI.normalizeNumber(-2) === '-2');
    check('the helper is on UI, pure (the same answer twice, nothing stored) and takes no element', typeof UI.normalizeNumber === 'function' && UI.normalizeNumber('0,5') === UI.normalizeNumber('0,5') && UI.normalizeNumber.length === 1);
});

console.log('\n== the exact fields\' handler (bindExact of ui-net.js, extracted and run with the real helper) ==');
function extract(src, head) {
    const i = src.indexOf(head);
    if (i < 0) return '';
    let d = 0, j = src.indexOf('{', i);
    for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
    return '';
}
const BIND = extract(NET, 'function bindExact(');
function field(lo, hi, startPct, why) {
    const UI0 = loadUI(), toasts = [], handlers = {};
    const carrier = { value: String(startPct), events: [], dispatchEvent(ev) { this.events.push(ev.type); return true; } };
    const input = { value: '', addEventListener: (t, f) => { handlers[t] = f; } };
    const UI = { normalizeNumber: UI0.normalizeNumber, toast: (m) => toasts.push(m) };
    const factory = new Function('UI', 'Event', BIND + '\nreturn bindExact;');
    const bind = factory(UI, class { constructor(type) { this.type = type; } });
    const show = bind(input, carrier, lo, hi, 'MSG', () => why || null);
    show();
    return { type: v => { input.value = v; handlers.change(); }, input, carrier, toasts, show };
}
T('exact', () => {
    check('the handler was found in ui-net.js', BIND.length > 200 && /UI\.normalizeNumber\(field\.value\)/.test(BIND));
    let f = field(0, 1, 50);
    check('the field shows the carrier as two decimals, with a dot: "0.50"', f.input.value === '0.50');
    f.type('0,35');
    check('strength: "0,35" -> the carrier holds 35 (whole percent), the field shows "0.35", no notice', f.carrier.value === '35' && f.input.value === '0.35' && f.toasts.length === 0 && f.carrier.events.join() === 'input,change', f.carrier.value + ' / ' + f.input.value);
    f.type('0.35');
    check('strength: "0.35" -> 35 as before', f.carrier.value === '35' && f.input.value === '0.35');
    f.type('0,7 ');
    check('strength: "0,7 " (a space after it) -> 70', f.carrier.value === '70' && f.input.value === '0.70');
    f.type('1,');
    check('strength: "1," reads as 1 (parseFloat of "1.") -> 100', f.carrier.value === '100' && f.input.value === '1.00');
    f.type(',5');
    check('strength: ",5" reads as 0.5 (parseFloat of ".5") -> 50', f.carrier.value === '50' && f.input.value === '0.50');
    f.type('1,5');
    check('strength: "1,5" is above the range: clamped to 1.00 with the existing notice (MSG), the carrier 100', f.carrier.value === '100' && f.input.value === '1.00' && f.toasts.join() === 'MSG');
    const g = field(-1, 1, 0);
    g.type('-0,5');
    check('focus: "-0,5" -> -50 (the minus stays), the field shows "-0.50"', g.carrier.value === '-50' && g.input.value === '-0.50', g.carrier.value + ' / ' + g.input.value);
    g.type('-1,5');
    check('focus: "-1,5" clamps to -1.00 with the notice', g.carrier.value === '-100' && g.input.value === '-1.00' && g.toasts.length === 1);
    for (const bad of ['1,2,3', '1.2,3', 'abc', '', '   ', '1.234,5']) {
        const h = field(-1, 1, 20); h.type(bad);
        check(`focus: ${JSON.stringify(bad)} is not a number: the carrier stays 20, the field is put back to "0.20", no event, no notice (the existing fallback)`, h.carrier.value === '20' && h.input.value === '0.20' && h.carrier.events.length === 0 && h.toasts.length === 0, h.carrier.value + ' / ' + h.input.value);
    }
    const r = field(0, 1, 50, 'Netz gilt nicht'); r.type('0,35');
    check('with a reason (the net does not apply) the typed value is refused with the reason, as before: the carrier is untouched', r.carrier.value === '50' && r.toasts.join() === 'Netz gilt nicht' && r.input.value === '0.50');
});

console.log('\n== every typed number field of the page: where it is parsed ==');
// id -> [kind, who parses it, the parse call]. A decimal field must go through UI.normalizeNumber (the helper) where its parse is in a UI file; a field parsed in sketch.js is NOT changed here (reported).
const INVENTORY = {
    'net-strength-exact': ['decimal', 'ui-net.js bindExact', 'parseFloat(UI.normalizeNumber(...))'],
    'net-focus-exact': ['decimal', 'ui-net.js bindExact', 'parseFloat(UI.normalizeNumber(...))'],
    'layer-offset-x-input': ['decimal, may be negative', 'sketch.js', 'parseFloat(offsetXInput.value())'],
    'layer-offset-y-input': ['decimal, may be negative', 'sketch.js', 'parseFloat(offsetYInput.value())'],
    'layer-rotation-input': ['decimal, may be negative', 'sketch.js', 'setActiveLayerRotation(layerRotationInput.value())'],
    'timeline-pairing-filter': ['decimal', 'sketch.js', 'parseFloat(timelinePairingFilterInput.elt.value)'],
    'node-count-input': ['integer (inputmode none)', 'ui.js UI.stepper + sketch.js', 'parseInt'],
    'shape-size-input': ['integer (inputmode none)', 'ui.js UI.stepper + sketch.js', 'parseInt'],
    'layer-node-count-input': ['integer (inputmode none)', 'ui.js UI.stepper + sketch.js', 'parseInt'],
    'layer-shape-size-input': ['integer (inputmode none)', 'ui.js UI.stepper + sketch.js', 'parseInt'],
    'farbe-anchor-hue-input': ['integer (inputmode none)', 'ui.js UI.stepper (ui-farbe.js)', 'parseInt'],
};
T('inventory', () => {
    const html = HTML.replace(/<!--[\s\S]*?-->/g, '');
    const found = {};
    (html.match(/<input\b[^>]*>/g) || []).forEach(tag => { const t = /\btype="([a-z]+)"/.exec(tag), id = /\bid="([^"]+)"/.exec(tag); if (t && id && (t[1] === 'number' || t[1] === 'text')) found[id[1]] = t[1]; });
    check('the typed number / text fields of index.html are exactly the inventory (a new one must be added to the table with its parser): ' + Object.keys(INVENTORY).length, JSON.stringify(Object.keys(found).sort()) === JSON.stringify(Object.keys(INVENTORY).sort()), Object.keys(found).filter(k => !INVENTORY[k]).concat(Object.keys(INVENTORY).filter(k => !found[k])).join());
    const tag = id => (html.match(new RegExp('<input\\b[^>]*\\bid="' + id + '"[^>]*>')) || [''])[0];
    check('the two exact fields are type="text" with inputmode="decimal" (the typed text reaches the script; the decimal pad stays)', ['net-strength-exact', 'net-focus-exact'].every(id => /\btype="text"/.test(tag(id)) && /\binputmode="decimal"/.test(tag(id)) && /\bclass="exact-field"/.test(tag(id)) && !/\bmin=|\bmax=|\bstep=/.test(tag(id))));
    // C0b-4: at 768px and up the user can type neither: the strength field is PARKED (the Netz surface's inline host does not build it, its section is hidden) and the Fokus field is wrapped into a readonly stepper with no keyboard;
    // both stay in the DOM as the carriers bindExact serves (the phone sheet's steppers and programmatic changes still write them)
    const PC = require(process.env.PHONE_CONFIG_JS || path.join(ROOT, 'ui-phone-config.js')), ih = PC.config.surfaces.netz.hosts.inline;
    check('the two exact fields are not typable at 768px and up: the inline host parks net-strength-exact (park), wraps net-focus-exact into a stepper that is noTyping (readonly, no keyboard), and the CSS hides the strength section (#more-netz.ph-sheet-rows > .overlay-section)', (ih.park || []).join() === 'net-strength-exact' && (ih.steppers || []).join() === 'net-focus-exact' && PC.config.overlays.netz.steppers['net-focus-exact'].noTyping === true && /html\.sr-netz #more-netz\.ph-sheet-rows > \.overlay-section, html\.sr-netz #more-netz\.ph-sheet-rows > #net-group \{ display: none; \}/.test(CSS));
    check('every other field keeps its type="number" and its inputmode exactly as it was: offsets and rotation none given (the iOS pads have no minus), the pairing filter decimal, the integer fields none', Object.keys(INVENTORY).filter(id => !/exact$/.test(id)).every(id => found[id] === 'number') && !/inputmode/.test(tag('layer-offset-x-input') + tag('layer-offset-y-input') + tag('layer-rotation-input')) && /inputmode="decimal"/.test(tag('timeline-pairing-filter')) && ['node-count-input', 'shape-size-input', 'layer-node-count-input', 'layer-shape-size-input', 'farbe-anchor-hue-input'].every(id => /inputmode="none"/.test(tag(id))));
    const net = strip(NET);
    check('ui-net.js: the only parse of a typed text goes through the helper; no hand-made comma replacement is left, no other parseFloat / Number() of a field', /parseFloat\(UI\.normalizeNumber\(field\.value\)\)/.test(net) && (net.match(/parseFloat\(/g) || []).length === 1 && !/replace\(','/.test(net) && !/\bNumber\(/.test(net));
    // the fields parsed in sketch.js: not changed by this commit (a field that moves to a UI file must be added to the helper's users)
    const sk = strip(SKETCH);
    check('NOT changed here (sketch.js parses them; the commit leaves sketch.js alone): the offsets, the rotation and the pairing filter are still parsed there, by parseFloat on the raw value', /offsetXInput\.value\(\)\) \|\| 0/.test(sk) && /offsetYInput\.value\(\)\) \|\| 0/.test(sk) && /setActiveLayerRotation\(layerRotationInput\.value\(\)\)/.test(sk) && /parseFloat\(timelinePairingFilterInput\.elt\.value\)/.test(sk) && !/normalizeNumber/.test(sk));
    check('the integer fields (stepper typing path in ui.js: parseInt) do not take a decimal and do not use the helper', !/normalizeNumber/.test(strip(UI_SRC).slice(strip(UI_SRC).indexOf('function stepper('), strip(UI_SRC).indexOf('function pressed('))));
});

console.log('\n== the exact fields keep their look as text fields ==');
T('css', () => {
    check('the inline rule of index.html that styled them as number fields (font, border, 60 x 40) names them too: `.control-group input[type="number"], .control-group input.exact-field`', /\.control-group input\[type="number"\],\s*\.control-group input\.exact-field/.test(HTML));
    check('the coarse-pointer min-height rule of style.css names them too (the Fokus field is inside .control-group)', /\.control-group input\[type="number"\],\s*\.control-group input\.exact-field,\s*select \{ min-height: var\(--target\); \}/.test(CSS));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
