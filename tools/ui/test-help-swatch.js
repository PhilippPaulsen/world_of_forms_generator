// Guard for fix F2: the help "?" button in the top bar and the anchor-colour swatch of the Farbe row look the same at 768px and up as on the phone.
//   help (#btn-help): frameless (no border, no fill), a muted icon (--color-secondary), a --target hit area (36px fine, 48px coarse), a subtle hover at a fine pointer, the keyboard ring of every button; ONE generic rule
//   (.app-header .icon-btn) outside the phone media query, the phone rule only sets the 40px size.
//   swatch (#farbe-anchor-preview): a --target square with the buttons' radius, the colour filling it, the .fc-swatch frame; ONE generic rule, the phone has no copy of it.
// Names, ids, titles and labels stay (markup and dictionary). Reads style.css, index.html, ui-i18n.js, ui-farbe.js.
//   node tools/ui/test-help-swatch.js
//   STYLE_CSS=... INDEX_HTML=... node tools/ui/test-help-swatch.js        (sabotage runs)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const rd = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const CSS = rd('STYLE_CSS', 'style.css').replace(/\/\*[\s\S]*?\*\//g, '');
const HTML = rd('INDEX_HTML', 'index.html');
const I18N = rd('UI_I18N_JS', 'ui-i18n.js');
const FARBE = rd('UI_FARBE_JS', 'ui-farbe.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };

// ---- a small CSS reader: [{ selector, decls, media }] in source order (@media nested one level or more; other at-rules skipped) ------------------------------------------------------------------------
function readRules(css) {
  const rules = [];
  (function block(text, media) {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i); if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const body = text.slice(open + 1, j - 1);
      if (/^@media/i.test(head)) block(body, (media + ' ' + head.replace(/^@media\s*/i, '')).trim());
      else if (!head.startsWith('@')) {
        const decls = {};
        body.split(';').forEach((d) => { const k = d.indexOf(':'); if (k > 0) decls[d.slice(0, k).trim().toLowerCase()] = d.slice(k + 1).trim(); });
        head.split(',').forEach((sel) => { if (sel.trim()) rules.push({ selector: sel.trim().replace(/\s+/g, ' '), decls, media }); });
      }
      i = j;
    }
  })(css, '');
  return rules;
}
const RULES = readRules(CSS);
const by = (sel, media) => RULES.filter((r) => r.selector === sel && (media === undefined || r.media === media));
const phoneAt = RULES.findIndex((r) => /^html\.ph\b/.test(r.selector));
const PHONE = RULES.filter((r) => /max-width:\s*767px/.test(r.media));

console.log('== the help button: markup, names ==');
{
  const m = /<button id="btn-help"[^>]*>/.exec(HTML);
  check('#btn-help is a button with class icon-btn, title="Hilfe", aria-label="Hilfe" and data-i18n="help" (id, names and the German text unchanged)', !!m && /class="icon-btn"/.test(m[0]) && /title="Hilfe"/.test(m[0]) && /aria-label="Hilfe"/.test(m[0]) && /data-i18n="help"/.test(m[0]) && /type="button"/.test(m[0]), m && m[0]);
  check('the English name is in the dictionary only: help = Hilfe / Help', /'help': \{ de: 'Hilfe', en: 'Help' \}/.test(I18N));
  check('the help dialog is wired as before: sketch.js binds #btn-help (mousePressed) and ui-rail.js runs UI.dialog on #help-overlay with #btn-help and #close-help (focus in, Escape, focus back)', /select\('#btn-help'\)/.test(rd('SKETCH_JS', 'sketch.js')) && /UI\.dialog\(\$\('#help-overlay'\), \$\('#btn-help'\), \$\('#close-help'\)\)/.test(rd('UI_RAIL_JS', 'ui-rail.js')));
}

console.log('\n== the help button: one generic rule ==');
{
  const g = by('.app-header .icon-btn', '');
  const d = g.length === 1 ? g[0].decls : {};
  check('exactly one rule `.app-header .icon-btn` outside every @media (every width)', g.length === 1);
  check('it is frameless and fill-less: border: 0 and background: transparent', d.border === '0' && d.background === 'transparent', JSON.stringify([d.border, d.background]));
  check('...with a muted icon colour: color: var(--color-secondary)', d.color === 'var(--color-secondary)', d.color);
  check('...and a hit area of the token: width and height var(--target) (36px fine, 48px coarse), never a fixed size', d.width === 'var(--target)' && d.height === 'var(--target)', JSON.stringify([d.width, d.height]));
  check('the radius is the buttons\' (var(--radius)) and the position stays at the right (margin-left: auto)', d['border-radius'] === 'var(--radius)' && d['margin-left'] === 'auto');
  const h = by('.app-header .icon-btn:hover');
  check('a subtle hover at a FINE pointer only: `.app-header .icon-btn:hover { background: var(--hover-bg) }` inside @media (hover: hover) and nowhere else', h.length === 1 && /^\(hover:\s*hover\)$/.test(h[0].media) && h[0].decls.background === 'var(--hover-bg)', JSON.stringify(h.map((r) => [r.media, r.decls])));
  const out = RULES.filter((r) => /\.app-header|#btn-help/.test(r.selector) && /^(none|0)\b/.test((r.decls.outline || '').trim()));
  check('no rule of the header or of #btn-help removes the keyboard ring (no outline: none / 0)', out.length === 0, out.map((r) => r.selector).join(' | '));
  const ring = by('button:focus-visible');
  const ringAll = RULES.filter((r) => /(^|,|\s)button:focus-visible$/.test(r.selector) && /^2px solid var\(--color-text\)/.test(r.decls.outline || ''));
  check('the ring is the app\'s: the global `button:focus-visible { outline: 2px solid var(--color-text); outline-offset: 2px }` is there and reaches the help button', ringAll.length >= 1 && ringAll.every((r) => r.media === '') && !HTML.includes('#btn-help:focus') && ringAll[0].decls['outline-offset'] === '2px', JSON.stringify(ringAll.map((r) => r.decls)));
}

console.log('\n== the help button on the phone: shared, not duplicated ==');
{
  const p = PHONE.filter((r) => r.selector === 'html.ph .app-header .icon-btn');
  const d = p.length === 1 ? p[0].decls : {};
  check('one phone rule `html.ph .app-header .icon-btn` (the 40px size: width, height, min-width, min-height = var(--ph-header-h))', p.length === 1 && ['width', 'height', 'min-width', 'min-height'].every((k) => d[k] === 'var(--ph-header-h)'), JSON.stringify(d));
  check('it does NOT repeat the frame, the fill or the colour (they are the generic rule\'s): no border, background or color in it', p.length === 1 && !('border' in d) && !('background' in d) && !('color' in d) && !('outline' in d), Object.keys(d).join());
  check('nothing else of the phone block names the help button or the header icon', PHONE.filter((r) => /btn-help/.test(r.selector) || (/\.app-header \.icon-btn/.test(r.selector) && r.selector !== 'html.ph .app-header .icon-btn')).length === 0);
}

console.log('\n== the swatch: markup, names, colour logic ==');
{
  const m = /<span id="farbe-anchor-preview"[^>]*>/.exec(HTML);
  check('#farbe-anchor-preview is a span.fc-swatch, role="img", title and aria-label "Anker-Vorschau" (id and names unchanged)', !!m && /class="fc-swatch"/.test(m[0]) && /role="img"/.test(m[0]) && /title="Anker-Vorschau"/.test(m[0]) && /aria-label="Anker-Vorschau"/.test(m[0]), m && m[0]);
  const iS = HTML.indexOf('id="farbe-anchor-preview"'), iR = HTML.indexOf('id="farbe-anchor-register-stepper"'), iB = HTML.indexOf('class="nav-break"', iS), between = HTML.slice(HTML.indexOf('>', iS) + 1, iB);
  check('it stays the LAST visible item of the Farbe row (after the register stepper; only the zero-height nav-break follows it): the order of the row is unchanged', iR > 0 && iR < iS && iB > iS && !/<(button|input|select|div|span)\b/.test(between.replace(/<\/span>\s*<span\s*$/, '')), between.trim().slice(0, 60));
  check('the colour logic is untouched: ui-farbe.js still sets `el.style.background` of the three previews from window.farborgelAnchorDisplayColor()', /anchorPreviewEls = \[\$\('#farbe-anchor-preview'\)/.test(FARBE) && /el\.style\.background = bg/.test(FARBE) && /farborgelAnchorDisplayColor/.test(FARBE));
}

console.log('\n== the swatch: one generic rule ==');
{
  const g = by('#farbe-anchor-preview', '');
  const d = g.length === 1 ? g[0].decls : {};
  check('exactly one rule `#farbe-anchor-preview` outside every @media', g.length === 1);
  check('a --target square: width and height var(--target) (36px fine, 48px coarse), box-sizing: border-box, never a fixed pixel size', d.width === 'var(--target)' && d.height === 'var(--target)' && d['box-sizing'] === 'border-box' && !/\d+px/.test((d.width || '') + (d.height || '')), JSON.stringify([d.width, d.height, d['box-sizing']]));
  check('the buttons\' radius (var(--radius)) and flex: none (it never shrinks in the row)', d['border-radius'] === 'var(--radius)' && d.flex === 'none');
  const fc = by('.fc-swatch', '');
  check('it keeps a FRAME: the base `.fc-swatch` gives 1px solid #888 and no rule for #farbe-anchor-preview removes it (no border: 0 / none)', fc.length === 1 && /^1px solid #888/.test(fc[0].decls.border || '') && !('border' in d) && !RULES.some((r) => /#farbe-anchor-preview$/.test(r.selector) && /^(0|none)\b/.test((r.decls.border || '').trim())), JSON.stringify(fc.map((r) => r.decls.border)));
  check('the colour fills it: no background in the rule (the inline style of ui-farbe.js is the only source)', !('background' in d) && !('background-color' in d));
  check('the phone has NO copy of it: no phone rule names #farbe-anchor-preview (the generic rule is shared)', PHONE.filter((r) => /farbe-anchor-preview/.test(r.selector)).length === 0 && RULES.filter((r) => /farbe-anchor-preview/.test(r.selector)).length === 1, RULES.filter((r) => /farbe-anchor-preview/.test(r.selector)).map((r) => r.media + ' ' + r.selector).join(' | '));
  check('the other two previews (#farbe-anchor-preview-kreis / -dreieck in the overlays) are not touched by it: the rule names the id exactly', RULES.filter((r) => /farbe-anchor-preview-(kreis|dreieck)/.test(r.selector)).length === 0);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
