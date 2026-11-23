/**
 * tools/ui/test-netz-grund.js - task 126: a 3C spec that draws NO net on the current shape (half format on the triangle, a = 1 on the square, any 3C on the hexagon) says why where the person sees it.
 *   node tools/ui/test-netz-grund.js
 *  1. Fall 1 (square 3C half -> triangle) and Fall 2 (triangle 3C a = 1 -> square): the hint exists, its short and its full text are in the dictionary, German and English, not a raw key, not empty.
 *  2. Every spec the core refuses has a hint with texts, every spec it accepts has none (all shapes, formats, families, a, b); a non-3C spec never.
 *  3. The notice state (hintSig): a shape change is a new state, a change of a inside the same reason is not.
 *  5. The phone (P7): the sign button in row 2 of the Art panel (config, markup, CSS, tap).
 *  4. The code that shows it (source of ui-net.js, index.html, style.css): the short line is TEXT (not a tooltip only), shown while there is a hint, the notice is keyed and cleared, synced on every tick.
 * Sabotages S1 to S12: each must turn at least one check red.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = { art: rd('ui-net-art.js'), net: rd('ui-net.js'), html: rd('index.html'), cfg: rd('ui-phone-config.js'), css: rd('style.css'), i18n: rd('ui-i18n.js'), core: rd('core/netwarp.js') };
const mut = (s, a, b) => { if (!s.includes(a)) throw new Error('sabotage text not found: ' + a.slice(0, 70)); return s.replace(a, b); };
const SQ = '□N', TRI = '△N';
const ph = s => (String(s).match(/\{[A-Za-z]+\}/g) || []).sort().join(',');

function suite(S) {
  const res = [], check = (name, ok, detail) => res.push({ name, ok: !!ok, detail });
  const guard = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw: ' + String(e && e.message).slice(0, 90) + ')', false); } };
  const w = { console, module: { exports: {} }, window: {} }; vm.createContext(w); vm.runInContext(S.i18n, w);
  const dict = (w.window.uiI18n || w.module.exports).DICT;
  const m = { console, module: { exports: {} } }; vm.createContext(m); vm.runInContext(S.art, m); const M = m.module.exports;
  const core = { console }; vm.createContext(core); vm.runInContext(S.core, core);
  const api = { effective: core.netProjectiveEffective, forShape: core.netProjectiveForShape };
  const text = (k, lang) => { const e = dict[k]; return e ? String(e[lang] || '') : ''; };
  const okText = k => ['de', 'en'].every(l => { const t = text(k, l); return t.trim().length > 0 && t !== k && !/\{[A-Za-z]+\}/.test(t); });
  const spec = (a, b, f, fam) => core.netProjectiveSpec(a, b, f, fam);

  guard('1', () => {
    const h1 = M.invalidHint(api, spec(3, 7, 'half', SQ), 'triangle'), h2 = M.invalidHint(api, spec(1, 3, 'full', TRI), 'square');
    check('1. Fall 1 (a half-format spec on the triangle): the hint is triHalf, short and full text in DE and EN', h1 && h1.id === 'triHalf' && okText(h1.key) && okText(h1.shortKey), JSON.stringify(h1));
    check('1b. Fall 2 (a = 1 on the square): the hint is aMin, short and full text in DE and EN', h2 && h2.id === 'aMin' && okText(h2.key) && okText(h2.shortKey), JSON.stringify(h2));
    check('1c. the short line is short (at most 34 characters, the width of its line) and says the rule; the full text tells what to do', h1 && h2 && text(h1.shortKey, 'de').length <= 34 && text(h1.shortKey, 'en').length <= 34 && text(h2.shortKey, 'de').length <= 34 && text(h2.shortKey, 'en').length <= 34 && /„ganz“/.test(text(h1.key, 'de')) && /“full”/.test(text(h1.key, 'en')) && /2/.test(text(h2.key, 'de')));
    check('1d. the same specs on a shape that takes them: no hint (the triangle takes a = 1, the square the half format)', M.invalidHint(api, spec(1, 3, 'full', TRI), 'triangle') === null && M.invalidHint(api, spec(3, 7, 'half', SQ), 'square') === null);
  });
  guard('2', () => {
    let n = 0, bad = [];
    for (const sh of ['square', 'triangle', 'hex', 'circle']) for (const f of ['full', 'half']) for (const fam of [SQ, TRI]) for (const a of [0, 1, 2, 3, 12]) for (const b of [1, 2, 3, 4.5, 12, 13]) {
      const sp = spec(a, b, f, fam), valid = api.effective(api.forShape(sp, sh), sh).valid, h = M.invalidHint(api, sp, sh); n++;
      if (valid !== (h === null)) bad.push(`${sh} ${f} ${fam} ${a},${b}: valid ${valid} hint ${h && h.id}`);
      else if (h && !(okText(h.key) && okText(h.shortKey))) bad.push(`${sh} ${f} ${fam} ${a},${b}: text of ${h.id} missing`);
    }
    check('2. every spec the core refuses has a hint with a DE and an EN text, every spec it accepts has none', bad.length === 0 && n > 400, `${n} specs ${bad.slice(0, 3).join('; ')}`);
    check('2b. a spec that is not a 3C spec (Netzart 1, regular, null) never has a hint', [null, undefined, { regular: true }, { x: { kind: 'trig', w: 1 }, y: 'same' }].every(sp => M.invalidHint(api, sp, 'triangle') === null));
    check('2c. every hint key and short key is in the dictionary with the same {placeholders} in DE and EN', Object.values(M.HINTS).every(h => [h.key, h.shortKey].every(k => dict[k] && ph(dict[k].de) === ph(dict[k].en))));
  });
  guard('3', () => {
    const h1 = M.invalidHint(api, spec(3, 7, 'half', SQ), 'triangle'), h2 = M.invalidHint(api, spec(1, 3, 'full', SQ), 'square'), h2b = M.invalidHint(api, spec(0, 3, 'full', SQ), 'square');
    check('3. the notice state: none = empty; a shape change is a NEW state; a change of a inside the same reason is not', M.hintSig(null, 'square') === '' && M.hintSig(h1, 'triangle') !== M.hintSig(h2, 'square') && M.hintSig(h2, 'square') === M.hintSig(h2b, 'square') && M.hintSig(h1, 'triangle') !== M.hintSig(h1, 'square'));
  });
  guard('4', () => {
    const net = S.net, html = S.html, css = S.css;
    check('4. ui-net.js asks the model (invalidHint) with the core\'s own validity and writes the SHORT TEXT into the line (setText), not only a title', /netArt\.invalidHint\(\{ effective: netProjectiveEffective, forShape: forShape0 \}, cur, currentShape\)/.test(net) && /setText\(reasonEl, hintShort\)/.test(net));
    check('4b. the line is shown while there is a hint and hidden otherwise (setHidden(reasonEl, !hint))', /setHidden\(reasonEl, !hint\)/.test(net));
    check('4c. the notice is keyed, shown when the state changes and cleared when it ends; the state is compared on every sync', /if \(hs !== lastHintSig\)/.test(net) && /window\.say\('net-3c-invalid', hintFull, 'warn'\)/.test(net) && /UI\.notifyClear\('net-3c-invalid'\)/.test(net));
    check('4d. the sign, the measure line and the Mehr note carry the full sentence', /if \(hint\) \{ warnShow\(hintFull\); setText\(measureEl, hintFull\); setText\(noteEl, hintFull\);/.test(net));
    const i = html.indexOf('id="net-3c"'), j = html.indexOf('id="btn-more-netz"'), k = html.indexOf('id="net-3c-reason"');
    check('4e. index.html: #net-3c-reason sits in the 3C cluster, next to the sign, and starts hidden', i > 0 && k > i && k < j && /id="net-3c-reason"[^>]*\bhidden\b/.test(html));
    check('4f. style.css: the line is one line with an ellipsis and is not hidden by a rule of its own (only [hidden])', /\.net-3c-reason \{[^}]*white-space: nowrap[^}]*text-overflow: ellipsis/.test(css) && !/\.net-3c-reason \{[^}]*display: none/.test(css));
    check('4g. the stretch and W warnings stay with the sign alone (no reason line for them)', !/setText\(reasonEl, (w|warn|ml)\b/.test(net));
  });
  guard('5', () => {
    const net = S.net, html = S.html, css = S.css, cfg = S.cfg;
    check('5. the phone sign button: in index.html (a button, starts hidden, next to the line), shown only with a hint, label and tooltip carry the full sentence', /<button id="net-3c-reason-btn"[^>]*\bhidden\b/.test(html) && /setHidden\(reasonBtn, !hint\)/.test(net) && /setAria\(reasonBtn, 'aria-label', hintFull\)/.test(net) && /reasonBtn\.title = hintFull/.test(net));
    check('5b. a tap shows the notice again with the full sentence (say on click, only while the button is shown)', /reasonBtn\.addEventListener\('click', function \(\) \{ if \(!reasonBtn\.hidden && window\.say\) window\.say\('net-3c-invalid', reasonBtn\.title, 'warn'\); \}\)/.test(net));
    check('5c. the phone config places it in row 2 of the Art panel in the slot of Reverse and the format (no third row, the panel stays 104px)', /\{ id: 'net-reverse-btn', w: 104, also: \['net-format', 'net-3c-reason-btn'\] \}/.test(cfg) && /panelH: 104/.test(cfg));
    check('5d. style.css: never shown above 768px (display none), shown 48px under html.ph only while it is not hidden, and it makes room for itself in row 2 (the one .layer-btn of the row, Reverse, steps aside)', /\n#net-3c-reason-btn \{ display: none; \}/.test(css) && /html\.ph #net-3c-reason-btn:not\(\[hidden\]\) \{[^}]*display: inline-flex[^}]*width: var\(--target\)/.test(css) && /html\.ph \.ph-row:has\(> #net-3c-reason-btn:not\(\[hidden\]\)\) > button\.layer-btn \{ display: none; \}/.test(css));
  });
  return res;
}

let failures = 0, checks = 0;
suite(SRC).forEach(r => { checks++; if (!r.ok) failures++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail !== undefined && r.detail !== '' ? '  [' + r.detail + ']' : ''}`); });
console.log('== sabotages: each must turn at least one check red ==');
const SAB = [
  ['S1  the short line is never written', s => { s.net = mut(s.net, 'setText(reasonEl, hintShort);', "setText(reasonEl, '');"); }],
  ['S2  the line stays hidden (tooltip only)', s => { s.net = mut(s.net, 'setHidden(reasonEl, !hint);', 'setHidden(reasonEl, true);'); }],
  ['S3  the notice state ignores the shape (no new notice after a shape change)', s => { s.art = mut(s.art, "return hint ? hint.id + '|' + shape : '';", "return hint ? hint.id : '';"); }],
  ['S4  Fall 2: no reason for a below the minimum', s => { s.art = mut(s.art, "spec.a < limitsFor(shape).aMin - 1e-9", 'false'); }],
  ['S5  Fall 1: no reason for the half format on the triangle', s => { s.art = mut(s.art, "shape === 'triangle' && spec.format !== 'full'", 'false'); }],
  ['S6  a short text is missing from the dictionary', s => { s.i18n = mut(s.i18n, "    'net.3c.invalid.short.aMin': { de: 'Am Quadrat ist a mindestens 2.', en: 'On the square a is at least 2.' },\n", ''); }],
  ['S7  a hint for a spec the core accepts', s => { s.art = mut(s.art, 'if (core.effective(sp, shape).valid) return null;', ''); }],
  ['S8  the notice is never cleared', s => { s.net = mut(s.net, "UI.notifyClear('net-3c-invalid')", 'void 0'); }],
  ['S10 the phone button is never shown', s => { s.net = mut(s.net, 'setHidden(reasonBtn, !hint);', 'setHidden(reasonBtn, true);'); }],
  ['S11 a tap does nothing', s => { s.net = mut(s.net, "window.say('net-3c-invalid', reasonBtn.title, 'warn')", 'void 0'); }],
  ['S12 the phone config has no place for the button', s => { s.cfg = mut(s.cfg, "also: ['net-format', 'net-3c-reason-btn']", "also: ['net-format']"); }],
  ['S9  the state is not re-read on every sync (only the first time)', s => { s.net = mut(s.net, 'if (hs !== lastHintSig)', 'if (lastHintSig === null)'); }]
];
for (const [name, fn] of SAB) {
  const set = Object.assign({}, SRC); let red = [];
  try { fn(set); red = suite(set).filter(r => !r.ok).map(r => r.name.slice(0, 40)); } catch (e) { red = ['sabotage setup: ' + e.message]; }
  checks++; const ok = red.length > 0 && !red[0].startsWith('sabotage setup'); if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  [red: ${red.length}${red.length ? ' - ' + red.slice(0, 3).join(' | ') : ''}]`);
}
console.log(`\n${checks - failures}/${checks} passed${failures ? ', ' + failures + ' FAILED' : ''}`);
process.exit(failures ? 1 : 0);
