// Guard for the readout line of the Netz sheet (sheets redesign, commit 4a): the pure model in ui-net-readout.js (domain + shape size -> the dictionary text), its two languages, and the places it is wired
// (ui-net.js writes #net-readout on every UI tick, index.html has the element and loads the model before ui-net.js, the CSS shows it only under html.ph). No browser.
//   node tools/ui/test-net-readout.js
//   UI_NET_READOUT_JS=... UI_NET_JS=... UI_I18N_JS=... INDEX_HTML=... STYLE_CSS=... node tools/ui/test-net-readout.js        (sabotage runs)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const MODEL = require(process.env.UI_NET_READOUT_JS || path.join(ROOT, 'ui-net-readout.js'));
const NET = read('UI_NET_JS', 'ui-net.js'), HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css'), SKETCH = read('SKETCH_JS', 'sketch.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };

// the real dictionary, in a vm (UI.t of ui-i18n.js)
const ctx = vm.createContext({ window: {}, document: undefined, console });
ctx.window.document = undefined;
vm.runInContext(read('UI_I18N_JS', 'ui-i18n.js'), ctx, { filename: 'ui-i18n.js' });
const I = ctx.window.uiI18n || ctx.uiI18n || vm.runInContext('typeof uiI18n !== "undefined" ? uiI18n : window.uiI18n', ctx);
const tIn = lang => (key, p) => { I.setLang(lang); return I.t(key, p); };

console.log('== the model ==');
T('model', () => {
    check('the three domains have their own dictionary key: net.readout.single / .tiled / .field', MODEL.readoutKey('single') === 'net.readout.single' && MODEL.readoutKey('tiled') === 'net.readout.tiled' && MODEL.readoutKey('field') === 'net.readout.field');
    check('an unknown, empty or missing domain reads like Single (the default net) and never throws', ['x', '', undefined, null, 'toString', '__proto__'].every(d => MODEL.readoutKey(d) === 'net.readout.single'));
    const de = tIn('de'), en = tIn('en');
    check('German, n = 5: "Feld: 5 × 5 Kacheln", "Gekachelt: 5 × 5", "Einzeln: ein Netz"', MODEL.readoutText('field', 5, de) === 'Feld: 5 × 5 Kacheln' && MODEL.readoutText('tiled', 5, de) === 'Gekachelt: 5 × 5' && MODEL.readoutText('single', 5, de) === 'Einzeln: ein Netz', [MODEL.readoutText('field', 5, de), MODEL.readoutText('tiled', 5, de), MODEL.readoutText('single', 5, de)].join(' | '));
    check('English, n = 3: "Field: 3 × 3 tiles", "Tiled: 3 × 3", "Single: one net"', MODEL.readoutText('field', 3, en) === 'Field: 3 × 3 tiles' && MODEL.readoutText('tiled', 3, en) === 'Tiled: 3 × 3' && MODEL.readoutText('single', 3, en) === 'Single: one net');
    const all = [];
    for (const d of ['single', 'tiled', 'field']) for (let n = 1; n <= 9; n++) for (const t of [de, en]) all.push(MODEL.readoutText(d, n, t));
    check('every domain x every shape size 1..9 x both languages gives a text with no placeholder left and no "undefined" (' + all.length + ' texts)', all.length === 54 && all.every(x => typeof x === 'string' && x.length > 3 && !/[{}]|undefined|NaN/.test(x)));
    check('the number is the shape size: the text of n = 7 holds 7 twice (Field, Tiled) and a Single text holds no number', /7.*7/.test(MODEL.readoutText('field', 7, de)) && /7.*7/.test(MODEL.readoutText('tiled', 7, en)) && !/\d/.test(MODEL.readoutText('single', 7, de)));
    check('a shape size that is not a whole number 1..9 is read as such or as 1 (0, NaN, "x", negative -> 1; "7" -> 7; 4.6 -> 5) and the model never throws', [0, NaN, 'x', -3, undefined, null].every(n => MODEL.readoutText('field', n, de) === 'Feld: 1 × 1 Kacheln') && MODEL.readoutText('field', '7', de) === 'Feld: 7 × 7 Kacheln' && MODEL.readoutText('tiled', 4.6, de) === 'Gekachelt: 5 × 5');
    check('the model is pure: it takes the translate function it is given (a stub gets the key and { n }) and touches no global', (() => { const got = []; MODEL.readoutText('tiled', 4, (k, p) => { got.push(k, JSON.stringify(p)); return ''; }); return got.join() === 'net.readout.tiled,{"n":4}'; })() && !/\b(document|window\.[a-z]|UI\.)/.test(fs.readFileSync(process.env.UI_NET_READOUT_JS || path.join(ROOT, 'ui-net-readout.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/typeof window[^;]*;?/g, '')));
});

console.log('\n== where it is wired ==');
T('wiring', () => {
    const order = (HTML.replace(/<!--[\s\S]*?-->/g, '').match(/<script src="[^"]+"/g) || []).map(s => /src="([^"?]+)/.exec(s)[1]);
    check('index.html loads ui-net-readout.js before ui-net.js (and after ui-i18n.js: the model is pure, the text comes from the dictionary)', order.indexOf('ui-net-readout.js') > 0 && order.indexOf('ui-net-readout.js') < order.indexOf('ui-net.js'), order.filter(f => /ui-net|i18n/.test(f)).join());
    check('#net-readout is a <p class="net-readout" aria-live="polite"> inside #more-netz, after #net-group', /<div id="more-netz"[\s\S]*<p id="net-readout" class="net-readout" aria-live="polite"><\/p>\s*<\/div>/.test(HTML.replace(/<!--[\s\S]*?-->/g, '')));
    check('ui-net.js writes it on every UI tick (sync): the active .net-domain-btn and shapeSizeFactor (core/state.js, read-only) go through netReadout.readoutText with UI.t; the element is only written when the text changed', /const d = \$\('\.net-domain-btn\.active'\)/.test(NET) && /netReadout\.readoutText\(d \? d\.dataset\.domain : 'single', shapeSizeFactor, UI\.t\)/.test(NET) && /if \(readoutEl\.textContent !== text\) readoutEl\.textContent = text/.test(NET));
    check('shapeSizeFactor is the global of core/state.js that sketch.js changes (a read, not an export: sketch.js is unchanged by this commit)', /^let shapeSizeFactor = /m.test(fs.readFileSync(path.join(ROOT, 'core', 'state.js'), 'utf8')) && /shapeSizeFactor = /.test(SKETCH));
    const marker = CSS.indexOf('=== Phone layout (');
    check('above 768px the line is not shown: `.net-readout { display: none }` sits above the phone block', /\n\.net-readout \{ display: none; \}/.test(CSS.slice(0, marker)));
    const rule = /html\.ph #net-readout \{([^}]*)\}/.exec(CSS.slice(marker));
    check('under html.ph it is ONE line of 20px, 14px type, muted (color-secondary), no wrapping: html.ph #net-readout in the phone block', !!rule && /display:\s*block/.test(rule[1]) && /height:\s*20px/.test(rule[1]) && /font-size:\s*14px/.test(rule[1]) && /line-height:\s*20px/.test(rule[1]) && /color:\s*var\(--color-secondary\)/.test(rule[1]) && /white-space:\s*nowrap/.test(rule[1]));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
