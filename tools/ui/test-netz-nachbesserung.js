/**
 * tools/ui/test-netz-nachbesserung.js - task 123 (Nachbesserung 3C-UI), source tests of the Netz row and its sync:
 *  1. the format buttons are icon-only: an SVG (aria-hidden), no text, aria-label + title from the dictionary, radiogroup behaviour (role radio, aria-checked kept by ui-net.js)
 *  2. the warn sign #net-3c-info is hidden by default, an image with a name set by ui-net.js, and the row has no "W . stretch" text any more; the measures live in #net-3c-measure under Mehr
 *  3. Reverse and the axes are locked with a reason under 3C (ui-net.js), the axes row is no longer hidden by the sync, the strength / focus exact fields name their own reason
 *  4. the Fokus stepper's reason (phone config) is true for Aus, Geo and 3C alike
 *  5. the 3C timeline texts are translated where the UI shows them (sketch.js: syncTimelineNetUi, setTimelineStatus) and applyTimelineFrame is untouched
 *  6. a, b and the Netzart stepper share one display width (CSS)
 * Sabotages S2 (Reverse stays active under 3C), S3 (an icon button without aria-label), S5 (the old Fokus reason), S6 (the warn sign always shown), S10 (the translation hook missing).
 *   node tools/ui/test-netz-nachbesserung.js
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = { html: rd('index.html'), net: rd('ui-net.js'), cfg: rd('ui-phone-config.js'), css: rd('style.css'), sk: rd('sketch.js'), dict: rd('ui-i18n.js') };
const mut = (o, k, a, b) => { if (!o[k].includes(a)) throw new Error('sabotage text not found: ' + a.slice(0, 60)); return Object.assign({}, o, { [k]: o[k].replace(a, b) }); };

function suite(S) {
  const res = [], check = (n, ok, d) => res.push({ name: n, ok: !!ok, detail: d });
  const fmt = (S.html.match(/<div id="net-format"[\s\S]*?<\/div>/) || [''])[0], btns = fmt.match(/<button[\s\S]*?<\/button>/g) || [];
  check('1. two format buttons, each: svg aria-hidden, no text, role radio, aria-checked, aria-label + title + data-i18n-label / -title', btns.length === 2 && btns.every(b => /<svg[^>]*aria-hidden="true"/.test(b) && !/>[^<>\s][^<>]*<\/button>/.test(b.replace(/<svg[\s\S]*?<\/svg>/, '')) && /role="radio"/.test(b) && /aria-checked="(true|false)"/.test(b) && /aria-label="[^"]+"/.test(b) && /title="[^"]+"/.test(b) && /data-i18n-label="net\.3c\.format\.(full|half)Title"/.test(b) && /data-i18n-title="net\.3c\.format\.(full|half)Title"/.test(b)), btns.length);
  check('1b. the two icons differ: the whole rectangle and the right half with a dashed middle axis', /M4 6 H20 V18 H4 Z/.test(btns[0] || '') && /M12 6 H20 V18 H12 Z/.test(btns[1] || '') && /stroke-dasharray/.test(btns[1] || ''));
  check('1c. ui-net.js keeps the radiogroup state (active class, aria-checked) and locks the buttons', /bt\.classList\.toggle\('active', on\); setAria\(bt, 'aria-checked'/.test(S.net) && /UI\.setDisabled\(bt, why3 \|\| all \|\| \(fb\.ok \? null : tt\(fb\.reason\)\)\)/.test(S.net));
  const warn = (S.html.match(/<span id="net-3c-info"[^>]*>/) || [''])[0];
  check('2. the warn sign is hidden by default, role img, in the row; ui-net.js names it (aria-label, title) only with a warning', /\bhidden\b/.test(warn) && /role="img"/.test(warn) && /warnShow = function \(text\) \{ setHidden\(infoEl, !text\); if \(text\) \{ setAria\(infoEl, 'aria-label', text\)/.test(S.net));
  check('2b. the row no longer writes "W . stretch" (no textContent of the info element), the measures go to #net-3c-measure and the note', !/setText\(infoEl/.test(S.net) && /setText\(measureEl, ml\)/.test(S.net) && /id="net-3c-measure"/.test(S.html) && /net\.3c\.measure\.title/.test(S.html));
  check('2c. under 3C the phone readout line carries the warning sign in front of "W . stretch" only when there is a warning', /line3 = \(warn\.length \? '\\u26a0 ' : ''\) \+ ml;/.test(S.net));
  check('3. Reverse is locked with the reason under 3C (aria-disabled via UI.setDisabled)', /UI\.setDisabled\(reverseBtn, all \|\| \(artNow\(\) === 'n3c' \? tt\('net\.art\.reason\.needsN1\.reverse'\) : null\)\)/.test(S.net));
  check('3b. the axes buttons are locked with their reason under 3C and the sync no longer hides the axes row', /UI\.setDisabled\(b, all \|\| \(artNow\(\) === 'n3c' \? tt\('net\.art\.reason\.needsN1\.axes'\) : null\)\)/.test(S.net) && !/setHidden\(ar, is3\)/.test(S.net) && /#net-group\.net-3c-on #net-axes-row/.test(S.css));
  check('3c. the exact fields name their own reason (strength, focus)', /tt\('net\.art\.reason\.needsN1\.strength'\)/.test(S.net) && /tt\('net\.art\.reason\.needsN1\.focus'\)/.test(S.net));
  check('4. the Fokus stepper\'s reason (phone config and dictionary) no longer says "Sin und Tan" alone', /reason: 'Der Fokus gilt für Netzart 1 mit Sin und Tan\.'/.test(S.cfg) && !/Fokus gilt für Sin und Tan/.test(S.cfg + S.dict));
  const protectedOk = ['applyTimelineFrame'].every(n => { const i = S.sk.indexOf('function ' + n + '('); return i > 0 && !/netArt\.tlText/.test(S.sk.slice(i, S.sk.indexOf('\n}\n', i))); });
  check('5. the 3C timeline texts are translated in syncTimelineNetUi and setTimelineStatus, not in applyTimelineFrame', /netStateEl\.html\(window\.netArt && window\.UI && UI\.t \? netArt\.tlText\(sum\.text, UI\.t\)/.test(S.sk) && /if \(window\.netArt && window\.UI && UI\.t && msg\) msg = netArt\.tlText\(msg, UI\.t\)/.test(S.sk) && protectedOk);
  check('5b. the 3C face lock is the dictionary text', /UI\.t\('net\.3c\.lock\.face'\)/.test(S.sk));
  check('6. the Netzart, a and b displays share one min-width', /#net-art-value, #net-a-value, #net-b-value \{ min-width: 2\.5ch; \}/.test(S.css) && /\.net-format-btn \{ width: var\(--target\);/.test(S.css));
  return res;
}
let failures = 0, checks = 0;
suite(SRC).forEach(r => { checks++; if (!r.ok) failures++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail !== undefined ? '  [' + r.detail + ']' : ''}`); });
console.log('== sabotages: each must turn at least one check red ==');
const SAB = [
  ['S2  Reverse stays active under 3C', () => mut(SRC, 'net', "UI.setDisabled(reverseBtn, all || (artNow() === 'n3c' ? tt('net.art.reason.needsN1.reverse') : null));", 'UI.setDisabled(reverseBtn, all);')],
  ['S3  a format icon button without aria-label', () => mut(SRC, 'html', ' aria-label="Format: halb, bis zur Mittelachse"', '')],
  ['S5  the old Fokus reason back', () => mut(SRC, 'cfg', "reason: 'Der Fokus gilt für Netzart 1 mit Sin und Tan.'", "reason: 'Fokus gilt für Sin und Tan'")],
  ['S6  the warn sign always shown (not hidden by default)', () => mut(SRC, 'html', '<span id="net-3c-info" class="net-3c-warn" role="img" hidden>', '<span id="net-3c-info" class="net-3c-warn" role="img">')],
  ['S10 the timeline translation hook missing', () => mut(SRC, 'sk', 'if (window.netArt && window.UI && UI.t && msg) msg = netArt.tlText(msg, UI.t);', '')],
  ['S11 the axes row hidden again under 3C', () => mut(SRC, 'net', "{ const dr = $('#net-domain-row'); if (dr) setHidden(dr, is3); }", "{ const dr = $('#net-domain-row'), ar = $('#net-axes-row'); if (dr) setHidden(dr, is3); if (ar) setHidden(ar, is3); }")]
];
for (const [name, fn] of SAB) {
  let red = []; try { red = suite(fn()).filter(r => !r.ok).map(r => r.name.slice(0, 44)); } catch (e) { red = ['sabotage setup: ' + e.message]; }
  checks++; const ok = red.length > 0 && !red[0].startsWith('sabotage setup'); if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  [red: ${red.length}${red.length ? ' - ' + red.slice(0, 2).join(' | ') : ''}]`);
}
console.log(`\n${checks - failures}/${checks} passed${failures ? ', ' + failures + ' FAILED' : ''}`);
process.exit(failures ? 1 : 0);
