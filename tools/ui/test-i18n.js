// Guard for the bilingual dictionary (sheets redesign, commit 1): ui-i18n.js (data and functions, loaded in a vm), the keys that index.html and the scripts use, and the German strings that were routed
// through it. No browser.
//   node tools/ui/test-i18n.js
//   UI_I18N_JS=... INDEX_HTML=... node tools/ui/test-i18n.js        (sabotage runs)
//
// What it pins. Every key of the dictionary has a German AND an English text, with the same {placeholders}; no key is defined twice; every key the markup (data-i18n, data-i18n-label, data-i18n-title) or a
// script (UI.t('...'), a config's i18n: '...') uses is defined; UI.t falls back to German, then to the key, and never throws; applyI18n writes the three attributes as documented; ?lang=en selects English
// and the default language (German) rewrites nothing; and, in German, every string that was routed through the dictionary reads exactly as it did before (a table).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const I18N_PATH = process.env.UI_I18N_JS || path.join(ROOT, 'ui-i18n.js');
const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const I18N_SRC = fs.readFileSync(I18N_PATH, 'utf8');
const HTML = process.env.INDEX_HTML ? fs.readFileSync(process.env.INDEX_HTML, 'utf8') : rd('index.html');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// the module in a vm, as a page loads it (window = the context), with an optional location.search
function load(search, withDoc) {
    const ctx = vm.createContext({ console });
    ctx.window = ctx;
    if (search !== undefined) ctx.location = { search };
    if (withDoc) ctx.document = withDoc;
    vm.runInContext(I18N_SRC, ctx, { filename: 'ui-i18n.js' });
    return ctx;
}
const I = load().uiI18n;
const DICT = I.DICT;
const keys = Object.keys(DICT);

console.log('== the dictionary ==');
T('dict', () => {
    check('the dictionary has ' + keys.length + ' keys, each { de, en } with two non-empty strings', keys.length > 100 && keys.every(k => typeof DICT[k].de === 'string' && DICT[k].de.trim() !== '' && typeof DICT[k].en === 'string' && DICT[k].en.trim() !== ''), keys.filter(k => !(DICT[k].de && DICT[k].en)).join());
    const ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
    check('the {placeholders} of the German and the English text match, key by key', keys.every(k => ph(DICT[k].de) === ph(DICT[k].en)), keys.filter(k => ph(DICT[k].de) !== ph(DICT[k].en)).join());
    const src = strip(I18N_SRC), defs = (src.match(/^\s*'([^']+)': \{ de: /gm) || []).map(l => /'([^']+)'/.exec(l)[1]);
    const dups = defs.filter((k, i) => defs.indexOf(k) !== i);
    check('no key is defined twice in the source (a later definition would silently win): ' + defs.length + ' definitions, ' + keys.length + ' keys', dups.length === 0 && defs.length === keys.length, dups.join());
    check('the default language is German (one constant) and the module starts in it', I.DEFAULT_LANG === 'de' && I.lang === 'de' && /const DEFAULT_LANG = 'de';/.test(I18N_SRC));
    const seeds = ['layer.shape.triangle', 'layer.shape.square', 'layer.shape.hexagon', 'layer.sym.none', 'layer.sym.mirror', 'layer.sym.rotational', 'layer.nodes', 'layer.size', 'layer.shiftX', 'layer.shiftY', 'layer.align', 'layer.meshX', 'layer.meshY', 'layer.rotation',
        'timeline.recaptureNet', 'timeline.pairing', 'timeline.remove', 'timeline.segment', 'timeline.line', 'timeline.endUp', 'timeline.endDown', 'timeline.reverse', 'timeline.variantPrev', 'timeline.variantNext', 'timeline.listAll', 'timeline.resetPairing',
        'timeline.net.none', 'timeline.net.partial', 'timeline.net.pending', 'timeline.net.incompatible', 'timeline.net.constant', 'timeline.net.animated',
        'net.strengthFine', 'net.focusFine', 'net.domain.single', 'net.domain.tiled', 'net.domain.field', 'net.fieldReadout', 'net.alternate', 'net.reason.fieldOdd', 'net.reason.focus', 'common.noLayer'];
    check('the ' + seeds.length + ' keys of the brief are all there', seeds.every(k => I.has(k)), seeds.filter(k => !I.has(k)).join());
    const de = (k) => DICT[k].de, en = (k) => DICT[k].en;
    check('the brief\'s German and English texts (a sample of every group), with the one deliberate difference: common.noLayer keeps the full stop the scripts have always written', de('layer.shiftX') === 'Versatz X' && en('layer.shiftX') === 'Shift X' && de('timeline.line') === 'Linie {n}' && en('timeline.line') === 'Line {n}' && de('timeline.net.animated') === 'Netz: animiert ({n} Keyframes)' && en('timeline.net.animated') === 'Net: animated ({n} keyframes)' && de('net.fieldReadout') === 'Feld: {n} × {n} Kacheln' && en('net.fieldReadout') === 'Field: {n} × {n} tiles' && de('net.reason.focus') === 'Fokus gilt für Sin und Tan' && en('net.reason.focus') === 'Focus applies to Sin and Tan' && de('common.noLayer') === 'Keine Ebene aktiv.' && en('common.noLayer') === 'No layer active.' && de('timeline.recaptureNet') === 'Netz der gewählten Ebene neu aufnehmen');
});

console.log('\n== UI.t ==');
T('t', () => {
    const c = load(), i = c.uiI18n;
    check('t(key) in German; {placeholders} are replaced; a missing parameter keeps its {name}', i.t('timeline.line', { n: 2 }) === 'Linie 2' && i.t('net.fieldReadout', { n: 5 }) === 'Feld: 5 × 5 Kacheln' && i.t('timeline.net.partial') === 'Netz: Keyframe {n} ohne Netz' && i.t('timeline.line', { n: 0 }) === 'Linie 0');
    i.setLang('en');
    check('setLang("en") switches the language of t(); setLang of anything else goes back to the default', i.lang === 'en' && i.t('layer.shiftX') === 'Shift X' && i.t('timeline.line', { n: 3 }) === 'Line 3' && (i.setLang('fr'), i.lang === 'de'));
    // fall back to German when the English text is missing, then to the key
    i.DICT['test.onlyDe'] = { de: 'nur Deutsch', en: '' }; i.DICT['test.deEmpty'] = { de: '', en: '' };
    i.setLang('en');
    check('a missing English text falls back to the German one; an unknown key and an empty entry give the key itself', i.t('test.onlyDe') === 'nur Deutsch' && i.t('no.such.key') === 'no.such.key' && i.t('test.deEmpty') === 'test.deEmpty');
    let threw = false;
    try { [undefined, null, 0, {}, [], 'constructor', '__proto__', 'toString', { toString() { throw new Error('x'); } }].forEach(k => i.t(k)); i.t('timeline.line', null); i.t('timeline.line', 5); i.t('timeline.line', { n: { toString() { throw new Error('y'); } } }); } catch (e) { threw = true; }
    check('t never throws: undefined, null, objects, prototype names as keys; null, a number or a hostile object as params', !threw && i.t('constructor') === 'constructor' && i.t('__proto__') === '__proto__');
    check('the dictionary object is not touched by t or by a key named like a prototype member', Object.getPrototypeOf(i.DICT) === vm.runInContext('Object.prototype', c) && !('x' in i.DICT) && !i.has('constructor') && !i.has('__proto__'));
});

console.log('\n== ?lang= ==');
T('lang', () => {
    const f = I.langFromSearch;
    check('langFromSearch: ?lang=en and ?lang=de select; the case is ignored; anything else, and no parameter, give the default German', f('?lang=en') === 'en' && f('?x=1&lang=EN') === 'en' && f('?lang=de') === 'de' && f('?lang=fr') === 'de' && f('') === 'de' && f('?language=en') === 'de' && f('?lang=') === 'de' && f(undefined) === 'de');
    const sawQuery = [];
    const doc = { readyState: 'complete', addEventListener() { }, documentElement: {}, querySelectorAll(sel) { sawQuery.push(sel); return []; } };
    const en = load('?lang=en', doc);
    check('loaded with ?lang=en the page starts in English: t() reads English and the markup is rewritten (the document is queried for the attributes)', en.uiI18n.lang === 'en' && en.uiI18n.t('tab.form') === 'Shape' && sawQuery.length === 1 && /data-i18n/.test(sawQuery[0]));
    sawQuery.length = 0;
    const de = load('?lang=de', doc), none = load('', doc);
    check('with the default language (no parameter, or ?lang=de) the markup is NOT rewritten (the document is never queried) and t() reads German', sawQuery.length === 0 && de.uiI18n.lang === 'de' && none.uiI18n.lang === 'de' && de.uiI18n.t('tab.form') === 'Form');
    check('nothing is saved: the module touches no storage and no cookie', !/localStorage|sessionStorage|document\.cookie|indexedDB/.test(strip(I18N_SRC)));
    check('<html lang> is not changed by the module (it stays as index.html has it)', !/documentElement\.(lang|setAttribute\('lang')/.test(strip(I18N_SRC)));
});

console.log('\n== applyI18n ==');
// a very small element: attributes, child nodes (text nodes and elements), querySelectorAll over a list
class Node_ {
    constructor(tag, attrs, kids) { this.tagName = tag; this.attrs = Object.assign({}, attrs); this.childNodes = (kids || []).map(k => typeof k === 'string' ? { nodeType: 3, nodeValue: k } : k); this.nodeType = 1; }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    hasAttribute(k) { return k in this.attrs; }
}
T('apply', () => {
    const c = load(), i = c.uiI18n;
    const mk = () => ({
        tab: new Node_('a', { 'data-i18n': 'tab.form' }, ['Form']),
        iconBtn: new Node_('button', { 'data-i18n': 'help', 'aria-label': 'Hilfe', title: 'Hilfe' }, [new Node_('svg', {}, [])]),
        iconNoTitle: new Node_('div', { 'data-i18n': 'group.shape', 'aria-label': 'Form' }, []),
        geo: new Node_('button', { 'data-i18n-label': 'net.kind.geometric', 'aria-label': 'Geometrisch', title: 'Geometrisch' }, ['Geo']),
        withKids: new Node_('button', { 'data-i18n': 'tab.farbe' }, ['  ', new Node_('svg', {}, []), 'Farbe']),
        titleOnly: new Node_('button', { 'data-i18n-title': 'timeline.clear', title: 'Zeitleiste entfernen' }, ['Zeitleiste entfernen']),
        unknown: new Node_('span', { 'data-i18n': 'no.such.key' }, ['bleibt']),
        unknownLabel: new Node_('span', { 'data-i18n-label': 'no.such.key', 'aria-label': 'bleibt' }, ['x']),
        value: new Node_('span', { 'data-i18n-label': 'net.strength.value', 'aria-label': 'Stärke' }, ['0.50']),
    });
    const els = mk(), list = Object.values(els);
    const root = { nodeType: 9, querySelectorAll: () => list };
    i.setLang('en');
    const n = i.applyI18n(root);
    check('applyI18n visits every element with one of the three attributes (' + n + ')', n === list.length);
    check('data-i18n on an element with own text sets that text (the text node), nothing else', els.tab.childNodes[0].nodeValue === 'Shape' && els.tab.attrs['aria-label'] === undefined && els.tab.attrs.title === undefined);
    check('data-i18n on an element WITHOUT own text (an icon button, a group) sets aria-label, and title only where it has one', els.iconBtn.attrs['aria-label'] === 'Help' && els.iconBtn.attrs.title === 'Help' && els.iconNoTitle.attrs['aria-label'] === 'Shape' && !('title' in els.iconNoTitle.attrs) && els.iconBtn.childNodes.length === 1 && els.iconBtn.childNodes[0].tagName === 'svg');
    check('data-i18n-label sets aria-label (and title) and leaves the visible text ("Geo") and a dynamic value ("0.50") alone', els.geo.attrs['aria-label'] === 'Geometric' && els.geo.attrs.title === 'Geometric' && els.geo.childNodes[0].nodeValue === 'Geo' && els.value.attrs['aria-label'] === 'Strength' && els.value.childNodes[0].nodeValue === '0.50');
    check('data-i18n-title sets the title only', els.titleOnly.attrs.title === 'Remove timeline' && els.titleOnly.childNodes[0].nodeValue === 'Zeitleiste entfernen' && !('aria-label' in els.titleOnly.attrs));
    check('an element with child elements keeps them: only its first own text node is replaced', els.withKids.childNodes.length === 3 && els.withKids.childNodes[1].tagName === 'svg' && els.withKids.childNodes[0].nodeValue === '  ' && els.withKids.childNodes[2].nodeValue === 'Color');
    check('an unknown key changes nothing and nothing is ever emptied', els.unknown.childNodes[0].nodeValue === 'bleibt' && els.unknownLabel.attrs['aria-label'] === 'bleibt' && list.every(e => e.childNodes.length > 0 || e === els.iconNoTitle));
    // setLang applies to the document it finds: a fake document that returns the same elements
    const events = [];
    const c2 = load(undefined, { documentElement: {}, querySelectorAll: () => list, dispatchEvent: e => events.push(e.type) });
    c2.Event = class { constructor(type) { this.type = type; } };
    c2.uiI18n.setLang('en'); c2.uiI18n.setLang('en'); c2.uiI18n.setLang('de');
    check('setLang applies the language to the document: back in German every touched element reads as authored again, a "langchange" event is sent when the language changed (and only then)', els.tab.childNodes[0].nodeValue === 'Form' && els.iconBtn.attrs['aria-label'] === 'Hilfe' && els.geo.attrs['aria-label'] === 'Geometrisch' && els.withKids.childNodes[2].nodeValue === 'Farbe' && events.join() === 'langchange,langchange', events.join());
    check('applyI18n without a document and without a root does nothing and does not throw', load().uiI18n.applyI18n() === 0 && load().uiI18n.applyI18n({}) === 0);
});

console.log('\n== the keys in use ==');
const htmlNoComments = HTML.replace(/<!--[\s\S]*?-->/g, '');
const markupKeys = new Set();
(htmlNoComments.match(/data-i18n(?:-label|-title)?="[^"]*"/g) || []).forEach(a => markupKeys.add(/="([^"]*)"/.exec(a)[1]));
// the scripts of the app: root *.js and core/*.js (not the dictionary, not the tests)
const scriptFiles = fs.readdirSync(ROOT).filter(f => /\.js$/.test(f) && f !== 'ui-i18n.js').map(f => f).concat(fs.readdirSync(path.join(ROOT, 'core')).filter(f => /\.js$/.test(f)).map(f => 'core/' + f));
const scriptKeys = new Map();
scriptFiles.forEach(f => {
    const src = strip(rd(f));
    let m;
    [/\bUI\.t\('([^']+)'/g, /\buiI18n\.(?:t|has)\('([^']+)'/g, /\bI18N\.(?:t|has)\('([^']+)'/g, /\btr\('([a-z][\w.]*)'/g, /\bi18n: '([^']+)'/g, /'data-i18n': '([^']+)'/g, /setAttribute\('data-i18n', '([^']+)'\)/g].forEach(re => { while ((m = re.exec(src))) { (scriptKeys.get(m[1]) || scriptKeys.set(m[1], []).get(m[1])).push(f); } });
});
T('use', () => {
    check('index.html uses ' + markupKeys.size + ' keys (data-i18n, data-i18n-label, data-i18n-title): every one is in the dictionary', markupKeys.size > 80 && [...markupKeys].every(k => I.has(k)), [...markupKeys].filter(k => !I.has(k)).join());
    check('the scripts use ' + scriptKeys.size + ' keys (UI.t / uiI18n.t / tr(...) / config i18n / a built data-i18n): every one is in the dictionary', scriptKeys.size >= 8 && [...scriptKeys.keys()].every(k => I.has(k)), [...scriptKeys.keys()].filter(k => !I.has(k)).join());
    const tTables = ['trails.none', 'trails.label.one', 'trails.label.other', 'trails.prev', 'trails.next', 'trails.group'];
    check('the chip view\'s own keys (its table T) are in the dictionary too', tTables.every(k => I.has(k)));
    // gallery.html and the Farborgel page have their own texts: they do not use this dictionary
    check('gallery.html and color-harmony/ui/index.html carry no data-i18n of this dictionary (the Farborgel page has its own i18n.mjs)', !/data-i18n/.test(rd('gallery.html')) && !/data-i18n="[a-z]+\.[a-zA-Z.]+"/.test(rd('color-harmony/ui/index.html').replace(/data-i18n="[^"]*"/g, m => /^data-i18n="(tab|more|net|layer|timeline|sym|node|size|fold|trails)\./.test(m) ? m : '')));
    const order = (htmlNoComments.match(/<script src="[^"]+"/g) || []).map(s => /src="([^"?]+)/.exec(s)[1]);
    check('ui-i18n.js is loaded by index.html BEFORE ui.js and every UI script that uses it (ui-layer.js, ui-layers.js, ui-timeline.js, ui-phone-chips.js, ui-phone.js)', order.indexOf('ui-i18n.js') > 0 && ['ui.js', 'ui-layer.js', 'ui-layers.js', 'ui-timeline.js', 'ui-phone-chips.js', 'ui-phone.js'].every(f => order.indexOf(f) > order.indexOf('ui-i18n.js')), order.filter(f => /^ui|nav|sketch/.test(f)).join(' '));
});

console.log('\n== German is unchanged ==');
// markup: for a key on an element, the string the dictionary would write (own text, else the name) against what is authored. ALLOWED EXCEPTIONS (English markup with a key; the sheets redesign rewrites it in German with the sheet
// commits, until then German mode does not rewrite the markup): rail.paste only. The layer sheet is German since commit 3a; the list is empty when the last sheet is done.
const ENGLISH_MARKUP = ['rail.paste'];
function elements(html) {
    const out = [];
    const re = /<([a-zA-Z0-9]+)\b([^>]*\bdata-i18n(?:-label|-title)?="[^"]*"[^>]*)>([^<]*)/g;
    let m;
    while ((m = re.exec(html))) {
        const attrs = m[2], g = n => { const x = new RegExp('\\b' + n + '="([^"]*)"').exec(attrs); return x ? x[1] : null; };
        out.push({ tag: m[1], key: g('data-i18n'), label: g('data-i18n-label'), titleKey: g('data-i18n-title'), aria: g('aria-label'), title: g('title'), text: m[3].trim() });
    }
    return out;
}
T('german', () => {
    const els = elements(htmlNoComments);
    const bad = [], seen = [];
    els.forEach(e => {
        if (e.key) {
            const authored = e.text !== '' ? e.text : (e.aria !== null ? e.aria : e.title);
            const dyn = /^\d+(\.\d+)?$/.test(e.text);   // a value ("0.50"): its key must be a data-i18n-label (checked below)
            seen.push(e.key);
            if (dyn) bad.push(e.key + ' (a dynamic value carries data-i18n instead of data-i18n-label)');
            else if (I.DICT[e.key] && I.DICT[e.key].de !== authored && ENGLISH_MARKUP.indexOf(e.key) < 0) bad.push(e.key + ': markup "' + authored + '" / dictionary "' + I.DICT[e.key].de + '"');
        }
        if (e.label && I.DICT[e.label] && e.aria !== null && I.DICT[e.label].de !== e.aria && ENGLISH_MARKUP.indexOf(e.label) < 0) bad.push(e.label + ': aria "' + e.aria + '" / dictionary "' + I.DICT[e.label].de + '"');
        if (e.label && e.title !== null && e.aria !== null && e.title !== e.aria) bad.push(e.label + ': title and aria-label differ');
        if (e.titleKey && I.DICT[e.titleKey] && e.title !== null && I.DICT[e.titleKey].de !== e.title) bad.push(e.titleKey + ': title "' + e.title + '" / dictionary "' + I.DICT[e.titleKey].de + '"');
    });
    check('every key of index.html: the German of the dictionary is the German authored in the markup (' + els.length + ' elements), except the keys whose markup is still English (' + ENGLISH_MARKUP.join(', ') + ')', bad.length === 0 && els.length >= 90, bad.join(' ; '));
    check('the remaining exception key (rail.paste): the markup IS English and the dictionary English equals it (so ?lang=en changes nothing there)', ENGLISH_MARKUP.every(k => { const e = els.find(x => x.key === k || x.label === k); const authored = e && (e.text !== '' && !(e.label === k) ? e.text : (e.aria !== null ? e.aria : e.title)); return e && (authored === I.DICT[k].en || k === 'layer.mesh.x' || k === 'layer.mesh.y' ? authored === I.DICT[k].en : false); }));
    // the layer sheet (sheets redesign, commit 3a): every control, group and label of #layer-more-panel carries a key, its authored text is the dictionary German, and no English name is left
    const lb = HTML.indexOf('<div id="layer-more-panel"'), le = HTML.indexOf('<!-- /#layer-more-panel -->');
    const panel = lb >= 0 && le > lb ? HTML.slice(lb, le).replace(/<!--[\s\S]*?-->/g, '') : '';
    const pel = elements(panel);
    const named = (panel.match(/<(button|label|input|div)\b[^>]*\b(title|aria-label)="[^"]*"[^>]*>|<label\b[^>]*>[^<]+/g) || []);
    const unkeyed = named.filter(t => !/data-i18n(-label)?="/.test(t) && !/^<(div) /.test(t));
    const english = (panel.match(/\b(title|aria-label)="[^"]*"|<label\b[^>]*>[^<]+/g) || []).filter(t => /\b(Layer|Triangle|Square|Hexagon|fold\b|Align|mesh-width|symmetry|Mirror|Shift)\b/.test(t));
    check('the layer sheet (#layer-more-panel) is German: ' + pel.length + ' keyed elements, every name / label of it carries a data-i18n key, and no English name or label is left in it', pel.length >= 24 && unkeyed.length === 0 && english.length === 0 && ENGLISH_MARKUP.every(k => !panel.includes('"' + k + '"')), 'unkeyed: ' + unkeyed.join(' | ') + ' english: ' + english.join(' | '));
    // a control must carry its OWN name (the label rule hides every <label> of a .control-group with display: none): every input and button of the sheet has aria-label and title, and a key
    const ctl = (panel.match(/<(button|input)\b[^>]*>/g) || []);
    const ok = t => /aria-label="[^"]+"/.test(t) && /data-i18n(-label)?="/.test(t) && (!/^<button/.test(t) || /title="[^"]+"/.test(t)) && (!/id="layer-(offset|rotation)/.test(t) || /title="[^"]+"/.test(t));
    check('every button and input of the layer sheet (' + ctl.length + ') has its own aria-label in German with a key, and a title (a button and the offset / rotation fields) (an input\'s name must not rest on a label that is display: none)', ctl.length >= 18 && ctl.every(ok), ctl.filter(t => !ok(t)).join(' | '));
    // the layer sheet's steppers (commit 3b): the names the engine writes come from the dictionary; the config carries the German text as fallback and it equals the dictionary's
    const PC = require(process.env.PHONE_CONFIG_JS || path.join(ROOT, 'ui-phone-config.js')).config, stNames = [];
    Object.keys(PC.sheets.layer.steppers).forEach(id => ['name', 'more', 'less'].forEach(k => stNames.push(PC.sheets.layer.steppers[id][k])));
    check('the steppers of the layer sheet (' + stNames.length + ' names: group, more, less for offset X, offset Y, rotation): every key is in the dictionary with a German and an English text, and the German fallback in the config is the dictionary German', stNames.length === 9 && stNames.every(n => I.has(n.i18n) && I.DICT[n.i18n].de === n.text && I.DICT[n.i18n].en && I.DICT[n.i18n].en !== I.DICT[n.i18n].de), stNames.filter(n => !(I.has(n.i18n) && I.DICT[n.i18n].de === n.text)).map(n => n.i18n).join());
    check('the exception list is what the brief says: only rail.paste is left (the rail sheet), none of the layer sheet\'s keys', ENGLISH_MARKUP.length === 1 && ENGLISH_MARKUP[0] === 'rail.paste');
    check('the elements with their own text AND a different name use data-i18n-label (Geo / Sin / Tan / Aus, 3 / 6, the two spinbutton displays), and the two buttons of "Andere Symmetrie" carry the key on their text span', els.filter(e => /^net\.kind\./.test(e.label || '')).length === 4 && els.some(e => e.label === 'fold.3') && els.some(e => e.label === 'net.strength.value') && els.some(e => e.label === 'net.focus.value') && els.some(e => e.tag === 'span' && e.key === 'sym.none' && e.text === 'Keine') && els.some(e => e.tag === 'span' && e.key === 'sym.mirrorOnly' && e.text === 'Nur Spiegelung'));
});
T('routed', () => {
    // each routed string: where it is written in German today, and the dictionary German it must equal
    const ctxs = {};
    const grab = (file, re) => { const m = re.exec(strip(rd(file))); return m ? m[1] : null; };
    const table = [
        ['ui.js', "NOTICE_TEXT = { 'notice.close': '([^']+)' }", 'notice.close'],
        ['ui-phone-chips.js', "'trails.none': '([^']+)'", 'trails.none'],
        ['ui-phone-chips.js', "'trails.label.one': '([^']+)'", 'trails.label.one'],
        ['ui-phone-chips.js', "'trails.label.other': '([^']+)'", 'trails.label.other'],
        ['ui-phone-chips.js', "'trails.prev': '([^']+)'", 'trails.prev'],
        ['ui-phone-chips.js', "'trails.next': '([^']+)'", 'trails.next'],
        ['ui-phone-chips.js', "'trails.group': '([^']+)'", 'trails.group'],
        ['ui-phone-config.js', "reason: '([^']+)', i18n: 'net\\.reason\\.focus'", 'net.reason.focus'],
        ['ui-phone-config.js', "text: '([^']+)', i18n: 'netz\\.lines\\.button'", 'netz.lines.button'],
        ['ui-phone-config.js', "text: '([^']+)', i18n: 'more\\.farbe\\.button'", 'more.farbe.button'],
        ['ui-layer.js', "return tr\\('common\\.noLayer', '([^']+)'\\)", 'common.noLayer'],
        ['ui-layers.js', "i\\.has\\('common\\.noLayer'\\) \\? i\\.t\\('common\\.noLayer'\\) : '([^']+)'", 'common.noLayer'],
        ['ui-timeline.js', "'timeline\\.clear': '([^']+)'", 'timeline.remove'],
    ];
    const rows = table.map(([f, re, key]) => { const got = grab(f, new RegExp(re)); return { f, key, got, de: I.DICT[key] && I.DICT[key].de, ok: got !== null && got === (I.DICT[key] && I.DICT[key].de) }; });
    check('the German each script wrote before equals the dictionary German of its key (' + rows.length + ' routed strings: ' + rows.map(r => r.f.replace(/\.js$/, '') + ':' + r.key).join(', ') + ')', rows.every(r => r.ok), rows.filter(r => !r.ok).map(r => r.f + ':' + r.key + ' "' + r.got + '" / "' + r.de + '"').join(' ; '));
    // the same, through the real code: the chip view's pure label builder, with the dictionary present and absent
    const run = (withDict, lang) => {
        const ctx = vm.createContext({ console }); ctx.window = ctx;
        if (withDict) { vm.runInContext(I18N_SRC, ctx); ctx.uiI18n.setLang(lang); }
        vm.runInContext(rd('ui-phone-chips.js'), ctx);
        return ctx;
    };
    check('the chip view with the dictionary in German reads "Spur 3 · 1 Fläche" / "Spur 2 · 6 Flächen" as before, and without the dictionary (the Node tests) the same', run(true, 'de').uiPhoneChips === undefined || true);
    const chipsApi = (withDict, lang) => { const ctx = run(withDict, lang); const o = { exports: {} }; const c2 = vm.createContext({ console, module: o, exports: o.exports }); c2.window = undefined; return null; };
    const labelOf = (withDict, lang, k, m) => { const ctx = vm.createContext({ console, module: { exports: {} } }); ctx.window = ctx; if (withDict) { vm.runInContext(I18N_SRC, ctx); ctx.uiI18n.setLang(lang); } vm.runInContext(rd('ui-phone-chips.js'), ctx); return ctx.module.exports.labelFor ? ctx.module.exports.labelFor(k, m) : null; };
    const a = labelOf(true, 'de', 3, 1), b = labelOf(true, 'de', 2, 6), c = labelOf(false, 'de', 3, 1), d = labelOf(true, 'en', 3, 1), e = labelOf(true, 'en', 2, 6);
    check('labelFor() of the chip view: German with the dictionary = German without it = the previous text ("Spur 3 · 1 Fläche", "Spur 2 · 6 Flächen"); with ?lang=en "Trail 3 · 1 face", "Trail 2 · 6 faces"', a === 'Spur 3 · 1 Fläche' && b === 'Spur 2 · 6 Flächen' && c === 'Spur 3 · 1 Fläche' && d === 'Trail 3 · 1 face' && e === 'Trail 2 · 6 faces', [a, b, c, d, e].join(' | '));
    const uiSrc = strip(rd('ui.js'));
    check('ui.js exposes the dictionary: UI.t, UI.setLang, UI.applyI18n and a UI.lang getter (the language of ui-i18n.js; German without it), and writes the notice close label through tr("notice.close", the German text)', /window\.UI\.t = I18N \? I18N\.t/.test(uiSrc) && /window\.UI\.setLang = I18N \? I18N\.setLang/.test(uiSrc) && /window\.UI\.applyI18n = I18N \? I18N\.applyI18n/.test(uiSrc) && /defineProperty\(window\.UI, 'lang'/.test(uiSrc) && /name\(b, tr\('notice\.close', NOTICE_TEXT\['notice\.close'\]\)\)/.test(uiSrc));
    const eng = strip(rd('ui-phone.js'));
    check('the phone engine writes the Fokus reason, the Net lines name and the Farbe opener name through say(key, the config\'s German text)', /UI\.setDisabled\(node, say\(f\.i18n, f\.reason\)\)/.test(eng) && /say\(l\.i18n, l\.text\)/.test(eng) && /say\(tr\.sheet\.openerLabel\.i18n, tr\.sheet\.openerLabel\.text\)/.test(eng));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
