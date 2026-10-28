// Guard for the Info card sections (sheets redesign, commit 6b): the markup of #info-card (the pattern-name row and two closed <details>, "Netz" and "Zeitleiste", one <p> per statement, each with its
// dictionary key), the dictionary texts (German = the markup, English present, the two statements that were left out are NOT there), the CSS of the card (wide variant, scroll, the summary's size and
// ring, the spacing scale, nothing phone-specific outside the phone block) and the two small changes of ui.js / ui-rail.js (summary in the Tab loop, the `fit` option). Source text and the dictionary
// module only; the card itself was opened in the browser pane (see the commit message). No browser here.
//   node tools/ui/test-info-card.js
//   INDEX_HTML=... UI_I18N_JS=... STYLE_CSS=... UI_JS=... UI_RAIL_JS=... node tools/ui/test-info-card.js        (sabotage runs)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css'), UI_SRC = read('UI_JS', 'ui.js'), RAIL = read('UI_RAIL_JS', 'ui-rail.js');
const I = require(process.env.UI_I18N_JS || path.join(ROOT, 'ui-i18n.js'));
const DICT = I.DICT;

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const NET = ['info.net.scope', 'info.net.kinds', 'info.net.domain', 'info.net.field', 'info.net.focus', 'info.net.macro', 'info.net.alternate', 'info.net.locks'];
const TL = ['info.tl.keyframes', 'info.tl.net', 'info.tl.pairing', 'info.tl.remove'];
const ALL = ['info.net.title'].concat(NET, ['info.tl.title'], TL);

const htmlNoComments = HTML.replace(/<!--[\s\S]*?-->/g, '');
const cardMatch = /<div id="info-card"([^>]*)>([\s\S]*?)\n  <\/div>\n/.exec(htmlNoComments);
const card = cardMatch ? cardMatch[2] : '';

console.log('== the markup ==');
T('markup', () => {
    check('#info-card exists once, is the dialog the Info button opens (aria-controls), keeps role dialog, its name key and hidden, and is overlay-wide', !!cardMatch && (htmlNoComments.match(/id="info-card"/g) || []).length === 1 && /aria-controls="info-card"/.test(htmlNoComments) && /class="overlay overlay-wide"/.test(cardMatch[1]) && /role="dialog"/.test(cardMatch[1]) && /data-i18n="info\.card"/.test(cardMatch[1]) && /\bhidden\b/.test(cardMatch[1]));
    check('the pattern-name row stays as it was: #pattern-name-group with its label and #pattern-name-status, before the sections', /<div class="control-group" id="pattern-name-group">\s*<label>Pattern Name<\/label>\s*<span id="pattern-name-status"><\/span>\s*<\/div>/.test(card) && card.indexOf('pattern-name-group') < card.indexOf('<details'));
    const details = card.match(/<details\b[^>]*>/g) || [];
    check('exactly two <details> (Netz, Zeitleiste), none open by default', details.length === 2 && details.every(d => !/\bopen\b/.test(d)) && /id="info-net"/.test(details[0]) && /id="info-tl"/.test(details[1]), details.join(' '));
    const sec = id => { const m = new RegExp('<details class="info-section" id="' + id + '">([\\s\\S]*?)</details>').exec(card); return m ? m[1] : ''; };
    const parts = body => ({ summary: (/<summary data-i18n="([^"]+)">([^<]*)<\/summary>/.exec(body) || []), ps: [...body.matchAll(/<p data-i18n="([^"]+)">([^<]*)<\/p>/g)].map(m => [m[1], unesc(m[2])]), allP: (body.match(/<p\b/g) || []).length });
    const n = parts(sec('info-net')), t = parts(sec('info-tl'));
    check('Netz: the summary is info.net.title and the paragraphs are, in this order, ' + NET.join(', '), n.summary[1] === 'info.net.title' && n.ps.map(p => p[0]).join() === NET.join() && n.allP === NET.length);
    check('Zeitleiste: the summary is info.tl.title and the paragraphs are, in this order, ' + TL.join(', '), t.summary[1] === 'info.tl.title' && t.ps.map(p => p[0]).join() === TL.join() && t.allP === TL.length);
    const withKey = (card.match(/data-i18n="info\.(?:net|tl)\.[a-z]+"/g) || []).length;
    check('every paragraph and summary of the sections carries its own key (' + ALL.length + '), and nothing in the card has text without one (no stray text outside the tags above)', withKey === ALL.length && card.replace(/<[^>]*>/g, '|').split('|').map(x => x.trim()).filter(Boolean).every(x => x === 'Pattern Name' || ALL.some(k => unesc(x) === DICT[k].de)));
    const german = [n.summary.slice(1), ...n.ps, t.summary.slice(1), ...t.ps];
    check('the German of every summary and paragraph in the markup equals the dictionary German of its key (' + german.length + ')', german.length === ALL.length && german.every(([k, txt]) => DICT[k] && DICT[k].de === unesc(txt)), german.filter(([k, txt]) => !(DICT[k] && DICT[k].de === unesc(txt))).map(x => x[0]).join());
});

console.log('\n== the dictionary ==');
T('dictionary', () => {
    check('the ' + ALL.length + ' keys exist with a German and an English text, and the English is not the German', ALL.every(k => I.has(k) && DICT[k].de.trim() && DICT[k].en.trim() && DICT[k].en !== DICT[k].de), ALL.filter(k => !I.has(k)).join());
    const infoKeys = Object.keys(DICT).filter(k => /^info\.(net|tl)\./.test(k));
    check('no other info.net.* / info.tl.* key exists (info.net.size was left out: it is not verified)', infoKeys.sort().join() === ALL.slice().sort().join(), infoKeys.join());
    check('the statements have no {placeholders} (the card is static text)', ALL.every(k => !/\{\w+\}/.test(DICT[k].de) && !/\{\w+\}/.test(DICT[k].en)));
    check('info.net.scope is the shortened sentence, in both languages', DICT['info.net.scope'].de === 'Das Netz stellst du auf der Basis-Ebene (Quadrat) ein. Es verzerrt die Maschenweiten des Rasters.' && DICT['info.net.scope'].en === 'You set the net on the base layer (square). It warps the mesh widths of the grid.');
    const all = ALL.map(k => DICT[k].de + ' ' + DICT[k].en).join(' ') + ' ' + htmlNoComments;
    check('the left-out claims are not on the page or in the card: the sentence about Hinterreiter\'s figures and the size statement ("kleineres Netz" / "smaller net")', !/Hinterreiter/.test(ALL.map(k => DICT[k].de + ' ' + DICT[k].en).join(' ')) && !/kleineres Netz|smaller net/.test(all));
    check('the Netz section says what was checked: focus keeps only the main diagonal mirror, Field needs an odd size from 3 to 9, the macro divisor starts at 3 (2 for Geometric), the pairing list sorts by Σd² up to 5 lines', /Hauptdiagonale/.test(DICT['info.net.focus'].de) && /main diagonal/.test(DICT['info.net.focus'].en) && /3 bis 9/.test(DICT['info.net.field'].de) && /3 to 9/.test(DICT['info.net.field'].en) && /ab 3/.test(DICT['info.net.macro'].de) && /from 3/.test(DICT['info.net.macro'].en) && /bis 5 Linien/.test(DICT['info.tl.pairing'].de) && /up to 5 lines/.test(DICT['info.tl.pairing'].en));
    check('the words the card quotes are the app\'s own: "Aus, regelmäßiges Netz" / "Off, regular net" (net.kind.off), "Kacheln spiegeln" / "mirror alternate tiles" (net.alternate), "Alle Zuordnungen" / "All pairings" (timeline.listAll)', DICT['info.net.locks'].de.indexOf(DICT['net.kind.off'].de) > 0 && DICT['info.net.locks'].en.indexOf(DICT['net.kind.off'].en) > 0 && DICT['info.tl.net'].de.indexOf(DICT['net.alternate'].de) > 0 && DICT['info.tl.net'].en.toLowerCase().indexOf(DICT['net.alternate'].en.toLowerCase()) > 0 && DICT['info.tl.pairing'].de.indexOf(DICT['timeline.listAll'].de) > 0 && DICT['info.tl.pairing'].en.indexOf(DICT['timeline.listAll'].en) > 0);
});

console.log('\n== the CSS ==');
T('css', () => {
    const css = strip(CSS);
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2].trim(), at: m.index }));
    const marker = (rules.find(r => /html\.ph\b/.test(r.sel)) || { at: -1 }).at;   // the first rule of the phone block (the comment that names it is stripped)
    const mine = rules.filter(r => /#info-card|\.info-sections?\b|\.info-section\b/.test(r.sel));
    check('the card has its rules (' + mine.length + ': #info-card, .info-sections, .info-section, its summary and paragraphs)', mine.length >= 10);
    check('all of them sit ABOVE the phone block and none mentions html.ph, a .ph- class or a media query of the phone: they are shared (the card is a popover at 768px and up, the sheet below)', marker > 0 && mine.every(r => r.at < marker && !/html\.ph|\.ph-/.test(r.sel)));
    const rule = sel => (mine.find(r => r.sel === sel) || { body: '' }).body;
    check('#info-card scrolls (overflow-y: auto) when an open section is longer than the popover (ui.js: fit)', /overflow-y:\s*auto/.test(rule('#info-card')));
    check('.overlay-wide is the 420px variant inside the viewport: max-width: min(92vw, 420px)', /\.overlay-wide\s*\{\s*max-width:\s*min\(92vw, 420px\);?\s*\}/.test(css));
    check('the phone keeps the bottom sheet that scrolls: .overlay.sheet has max-height 80dvh, overflow auto and max-width none (which wins over .overlay-wide: two classes against one)', /\.overlay\.sheet\s*\{[^}]*max-height:\s*80dvh;[^}]*overflow:\s*auto;/.test(css) && /\.overlay\.sheet\s*\{[^}]*max-width:\s*none;/.test(css));
    const sum = rule('.info-section > summary');
    check('the summary is --target high (36px, 48px under a coarse pointer: the variable\'s own values), a pointer cursor, no native marker', /min-height:\s*var\(--target\)/.test(sum) && /cursor:\s*pointer/.test(sum) && /list-style:\s*none/.test(sum) && /-webkit-details-marker/.test(css) && /--target:\s*48px/.test(css) && /--target:\s*36px/.test(css));
    check('the summary has the app\'s keyboard ring (2px solid var(--color-text), offset 2px) on :focus-visible', /outline:\s*2px solid var\(--color-text\)/.test(rule('.info-section > summary:focus-visible')) && /outline-offset:\s*2px/.test(rule('.info-section > summary:focus-visible')));
    check('the chevron turns when the section is open', /rotate\(-45deg\)/.test(rule('.info-section > summary::before')) && /rotate\(45deg\)/.test(rule('.info-section[open] > summary::before')));
    const spaces = []; mine.forEach(r => r.body.replace(/\b(gap|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?)\s*:\s*([^;]+)/g, (m, prop, val) => { val.trim().split(/\s+/).forEach(v => spaces.push(prop + ' ' + v)); return m; }));
    check('every gap, margin and padding of the card\'s rules is on the scale 0 / 4 / 8 / 16 / 32px (' + spaces.length + ' values)', spaces.length >= 3 && spaces.every(s => /\s(0|4px|8px|16px|32px)$/.test(s)), spaces.filter(s => !/\s(0|4px|8px|16px|32px)$/.test(s)).join());
});

console.log('\n== ui.js and ui-rail.js ==');
T('scripts', () => {
    const ui = strip(UI_SRC), rail = strip(RAIL);
    check('the Tab loop of UI.overlay includes <summary> (a card with only summaries would have no loop at all), and keeps its other members', /querySelectorAll\('button:not\(\[disabled\]\), input:not\(\[disabled\]\), select:not\(\[disabled\]\), textarea:not\(\[disabled\]\), a\[href\], summary, \[tabindex="0"\]'\)/.test(ui));
    check('open, Escape and the initial focus are as they were: the focus candidates are `[tabindex="0"], button:not([disabled])` with the panel itself as the fallback; Escape closes with the focus return; the trigger gets it back', /querySelectorAll\('\[tabindex="0"\], button:not\(\[disabled\]\)'\)/.test(ui) && /if \(first\) first\.focus\(\); else panel\.focus\(\);/.test(ui) && /if \(e\.key === 'Escape'\) \{ e\.stopPropagation\(\); close\(true\); return; \}/.test(ui) && /if \(returnFocus\) trigger\.focus\(\);/.test(ui));
    check('the `fit` option: as a popover the max-height is the room below the trigger (never below 120px), as the phone\'s sheet it is cleared; without the option nothing is set', /if \(opts && opts\.fit\) panel\.style\.maxHeight = Math\.max\(120, Math\.round\(window\.innerHeight - r\.bottom - 16\)\) \+ 'px';/.test(ui) && /panel\.classList\.add\('sheet'\); panel\.style\.top = ''; panel\.style\.left = ''; panel\.style\.maxHeight = '';/.test(ui) && (ui.match(/style\.maxHeight/g) || []).length === 2);
    check('only the Info card asks for it: UI.overlay($(\'#btn-info\'), $(\'#info-card\'), { fit: true }); the other overlays keep their options', /UI\.overlay\(\$\('#btn-info'\), \$\('#info-card'\), \{ fit: true \}\);/.test(rail) && /UI\.overlay\(\$\('#btn-more-rail'\), \$\('#more-rail'\), \{\}\)/.test(rail) && (rail.match(/fit: true/g) || []).length === 1);
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
