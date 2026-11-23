/**
 * tools/ui/test-netz-i18n-keys.js - task 123: every dictionary key the Netz panel uses exists in German AND English (a missing key shows as the raw key, e.g. `net.art.reason.bMin`, because UI.t falls back to it).
 * Scope (the families the Netz panel shows): net.*, reason.net.*, reason.strength.*, reason.focus.*, note.net.*, group.netKind, subtab.art / achsen, more.netz.
 *   node tools/ui/test-netz-i18n-keys.js
 *  1. the keys written in the source of ui-net.js, ui-net-art.js, ui-net-readout.js, initNetControls() of sketch.js, the Netz markup of index.html (data-i18n*) and ui-phone-config.js
 *  2. the keys the model RETURNS (every reason of netArt.step / stepA / stepB / entries / later) and the dynamic families (net.art.name.<id>, net.art.tip.<id>)
 *  3. German and English both non-empty, the same {placeholders}
 *  4. the 3C timeline texts: every reason core/netwarp.js (_netProjCompat) can give has a key; the translated texts are not English any more and keep their numbers
 * Sabotages: a key removed, a key with no English, a placeholder lost, a core text changed.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const load = (i18nSrc, artSrc, coreSrc) => {
  const sb = { console, module: { exports: {} }, window: {} }; vm.createContext(sb); vm.runInContext(i18nSrc, sb);
  const dict = (sb.window.uiI18n || sb.module.exports).DICT;
  const art = (() => { const s2 = { console, module: { exports: {} } }; vm.createContext(s2); vm.runInContext(artSrc, s2); return s2.module.exports; })();
  const core = { console }; vm.createContext(core); vm.runInContext(coreSrc, core);
  return { dict, art, core };
};
const FAMILY = /^(net\.|reason\.(net|strength|focus)\.|note\.net\.|group\.netKind$|subtab\.(art|achsen)$|more\.netz$)/;
const ph = s => (String(s).match(/\{[A-Za-z]+\}/g) || []).sort().join(',');

function suite(i18nSrc, artSrc, coreSrc) {
  const res = [], check = (name, ok, detail) => res.push({ name, ok: !!ok, detail });
  const { dict, art, core } = load(i18nSrc, artSrc, coreSrc);
  // 1. keys written in the sources
  const slice = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); return i >= 0 && j > i ? src.slice(i, j) : ''; };
  const sk = rd('sketch.js'), html = rd('index.html');
  const sources = {
    'ui-net.js': rd('ui-net.js'), 'ui-net-art.js': artSrc, 'ui-net-readout.js': rd('ui-net-readout.js'),
    'sketch.js initNetControls': slice(sk, '(function initNetControls() {', '\n    })();'),
    'ui-phone-config.js': rd('ui-phone-config.js'),
    'index.html netz': slice(html, 'id="nav-netz"', '<!-- Group D Phase B4') + slice(html, 'id="more-netz"', 'id="net-readout"')
  };
  const keys = new Map();
  for (const [f, src] of Object.entries(sources)) {
    if (!src) { check('1. source found: ' + f, false); continue; }
    for (const m of src.matchAll(/['"`]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)['"`]/g)) if (FAMILY.test(m[1])) keys.set(m[1], f);
    for (const m of src.matchAll(/data-i18n(?:-label|-title)?="([^"]+)"/g)) if (FAMILY.test(m[1])) keys.set(m[1], f);
    for (const m of src.matchAll(/i18n: '([^']+)'/g)) if (FAMILY.test(m[1])) keys.set(m[1], f);
  }
  // 2. keys the model returns, and the dynamic families
  const model = art, ents = ['square', 'triangle', 'hex'].flatMap(sh => model.entries(sh)), reasons = new Set();
  ents.forEach(e => e.reason && reasons.add(e.reason));
  for (const sh of ['square', 'triangle', 'hex']) for (const id of ['off', 'n1', 'n3c']) for (const d of [1, -1]) { const r = model.step(sh, id, d); if (r.reason) reasons.add(r.reason); }
  for (let a = 1; a <= 13; a++) for (let b = 1; b <= 14; b++) for (const d of [1, -1]) { for (const r of [model.stepA(a, b, d), model.stepB(a, b, d)]) if (r.reason) reasons.add(r.reason); }
  model.later().forEach(l => reasons.add(l.reason));
  reasons.forEach(k => keys.set(k, 'model'));
  for (const a of model.ART) { keys.set('net.art.name.' + a.id, 'dynamic'); keys.set('net.art.tip.' + a.id, 'dynamic'); }
  ['half', 'full'].forEach(f => keys.set('net.3c.format.' + f, 'dynamic'));
  const missing = [...keys.keys()].filter(k => !dict[k]).sort(), noDe = [...keys.keys()].filter(k => dict[k] && !String(dict[k].de || '').trim()), noEn = [...keys.keys()].filter(k => dict[k] && !String(dict[k].en || '').trim());
  check(`1. every Netz key used by the code is in the dictionary (${keys.size} keys)`, missing.length === 0, missing.join(' '));
  check('2. every key has a German and an English text', noDe.length === 0 && noEn.length === 0, 'no DE: ' + noDe.join(' ') + ' no EN: ' + noEn.join(' '));
  const phBad = [...keys.keys()].filter(k => dict[k] && ph(dict[k].de) !== ph(dict[k].en));
  check('3. German and English have the same {placeholders}', phBad.length === 0, phBad.join(' '));
  check('3b. every reason the model returns is a dictionary key (not a text)', [...reasons].every(r => /^net\.[a-z0-9.]+$/i.test(r) && dict[r]), [...reasons].filter(r => !dict[r]).join(' '));
  // 4. the 3C timeline texts
  const S = core.netProjectiveSpec, REG = { regular: true }, FIELD = { x: { kind: 'trig', w: -1 }, y: 'same', domain: 'field' };
  const pairs = [[S(2, 4, 'full'), REG], [REG, S(2, 4, 'full')], [S(2, 4, 'full'), FIELD], [S(2, 4, 'full'), S(2, 4, 'half')], [S(2, 4, 'full'), Object.assign(S(2, 4, 'full'), { family: '*N' })]];
  const compat = pairs.map(([x, y]) => core.netAnimationCompat(x, y));
  check('4. every reason _netProjCompat gives has a dictionary key', compat.every(c => !c.ok && model.compatKey(c.reason) && dict[model.compatKey(c.reason).key]), compat.map(c => c.reason).filter(r => !model.compatKey(r)).join(' | '));
  const tr = lang => (k, p) => { const e = dict[k]; let s = e ? e[lang] : k; for (const [n, v] of Object.entries(p || {})) s = s.split('{' + n + '}').join(v); return s; };
  const wrap = r => `Net NOT animated between keyframes 1 and 2: ${r}. The author net is shown there.`, note = r => `Segment 1/2 (Layer 1 → Layer 2) | Net: the net states of keyframes 1 and 2 cannot be interpolated: ${r} - the author net is shown`;
  const ok4 = ['de', 'en'].every(l => compat.every(c => {
    const r = c.reason, a = model.tlText(wrap(r), tr(l)), b = model.tlText(note(r), tr(l)), tdt = tr(l);
    return a !== wrap(r) && !/cannot be interpolated|The author net/.test(l === 'de' ? a : '') && /1/.test(a) && /2/.test(a) && b !== note(r) && b.startsWith('Segment 1/2 (Layer 1 → Layer 2) | ') && !(l === 'de' && /cannot be interpolated|author net/.test(b));
  }));
  check('4b. the timeline summary and the frame note with a 3C reason are translated (DE and EN), the numbers stay', ok4);
  check('4c. a text without a 3C reason is returned unchanged', model.tlText('Net NOT animated: no keyframe has a net captured. Turn on "Include net".', tr('de')) === 'Net NOT animated: no keyframe has a net captured. Turn on "Include net".');
  return res;
}

const I18N = rd('ui-i18n.js'), ART = rd('ui-net-art.js'), CORE = rd('core/netwarp.js');
let failures = 0, checks = 0;
suite(I18N, ART, CORE).forEach(r => { checks++; if (!r.ok) failures++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`); });
console.log('== sabotages: each must turn at least one check red ==');
const mut = (s, a, b) => { if (!s.includes(a)) throw new Error('sabotage text not found: ' + a.slice(0, 60)); return s.replace(a, b); };
const SAB = [
  ['S1  a key removed (net.art.reason.bMin)', () => suite(mut(I18N, "    'net.art.reason.bMin': { de: 'b muss größer als a sein.', en: 'b must be larger than a.' },\n", ''), ART, CORE)],
  ['S4  a key without English (net.art.reason.bMax)', () => suite(mut(I18N, "en: 'b is at most 12.'", "en: ''"), ART, CORE)],
  ['S7  a placeholder lost in English (net.3c.info)', () => suite(mut(I18N, "en: 'W {w} · stretch {s}'", "en: 'W {w} · stretch'"), ART, CORE)],
  ['S8  a core text changed (the 3C format reason)', () => suite(I18N, ART, mut(CORE, 'the 3C format differs', 'the 3C layout differs'))],
  ['S9  the model returns a key nobody defined', () => suite(I18N, mut(ART, "reason: 'net.art.reason.bMax'", "reason: 'net.art.reason.bMaxx'"), CORE)]
];
for (const [name, fn] of SAB) {
  let red = []; try { red = fn().filter(r => !r.ok).map(r => r.name.slice(0, 44)); } catch (e) { red = ['sabotage setup: ' + e.message]; }
  checks++; const ok = red.length > 0 && !red[0].startsWith('sabotage setup'); if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  [red: ${red.length}${red.length ? ' - ' + red.slice(0, 2).join(' | ') : ''}]`);
}
console.log(`\n${checks - failures}/${checks} passed${failures ? ', ' + failures + ' FAILED' : ''}`);
process.exit(failures ? 1 : 0);
