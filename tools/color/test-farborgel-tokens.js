/**
 * tools/color/test-farborgel-tokens.js
 * Drift guard for Farborgel sub-page P4 (visual alignment): color-harmony/ui/tokens.css is a DELIBERATE COPY of the
 * generator's design tokens, fonts and .stepper chrome (the Farborgel imports nothing from the generator, and
 * loading the generator's whole style.css was measured and rejected). A copy can silently drift - this test is what
 * makes that loud, in the same spirit as test-esm-cachebust.js:
 *
 *   node tools/color/test-farborgel-tokens.js
 *
 *   1. every custom property in tokens.css equals the generator's (style.css :root; --background / --hover-bg from
 *      index.html's inline :root) - and the generator still declares each one
 *   2. every top-level generator token is either copied or on an explicit NOT_COPIED list (a NEW generator token
 *      fails here until someone decides - that is the point)
 *   3. the `pointer: fine` override of --target is identical
 *   4. every rule copied into tokens.css (.ico, .stepper*) has identical declarations in style.css, and the generator
 *      has no @media variant of it that the copy would miss
 *   5. fonts: same family name, the shared faces point at the same files with the same weight/style, those font
 *      files are byte-identical, and the metrics fallback face matches
 *   6. styles.css really uses the tokens: its type sizes are the generator's three, its own @font-face blocks and the
 *      old "Suisse Intl" family are gone, no literal font sizes, chrome buttons size from --target / --radius
 *   7. index.html loads tokens.css before styles.css, both with the project's one shared version
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
let failures = 0, checks = 0;
function check(name, ok, detail) {
    checks++; if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`);
}
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ---- a small CSS reader: rules with their @media context, declarations as ordered [prop, value] pairs ----
const norm = s => s.replace(/\s+/g, ' ').trim();
const normValue = v => norm(v).replace(/#([0-9a-f]{3,8})\b/gi, (m, h) => '#' + h.toLowerCase()).replace(/\s*!important/i, ' !important');
function parseDecls(body) {
    const out = []; let depth = 0, cur = '';
    for (const ch of body) {
        if (ch === '(') depth++; if (ch === ')') depth--;
        if (ch === ';' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map(d => d.trim()).filter(Boolean).map(d => { const i = d.indexOf(':'); return [d.slice(0, i).trim(), normValue(d.slice(i + 1))]; });
}
function parseCss(src) {
    src = src.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [];
    (function walk(text, media) {
        let i = 0;
        while (i < text.length) {
            let j = i; while (j < text.length && text[j] !== '{' && text[j] !== ';') j++;
            if (j >= text.length) break;
            if (text[j] === ';') { i = j + 1; continue; }
            const prelude = norm(text.slice(i, j));
            let depth = 1, k = j + 1;
            while (k < text.length && depth > 0) { if (text[k] === '{') depth++; else if (text[k] === '}') depth--; k++; }
            const body = text.slice(j + 1, k - 1);
            if (/^@media/i.test(prelude)) walk(body, norm(prelude.slice(6)));
            else if (/^@font-face/i.test(prelude)) rules.push({ media, selector: '@font-face', decls: parseDecls(body) });
            else if (!/^@/.test(prelude)) rules.push({ media, selector: prelude, decls: parseDecls(body) });
            i = k;
        }
    })(src, null);
    return rules;
}
const declMap = decls => new Map(decls);            // last declaration wins, like the cascade within one rule
const sameDecls = (a, b) => { const A = declMap(a), B = declMap(b); return A.size === B.size && [...A].every(([k, v]) => B.get(k) === v); };

const gen = parseCss(read('style.css'));
const far = parseCss(read('color-harmony/ui/tokens.css'));
const farStyles = parseCss(read('color-harmony/ui/styles.css'));
const indexHtml = read('index.html');
const inlineStyle = (indexHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [])[1] || '';
const genInline = parseCss(inlineStyle);

const topRoot = rules => { const m = new Map(); rules.filter(r => r.selector === ':root' && r.media === null).forEach(r => r.decls.forEach(([k, v]) => { if (k.startsWith('--')) m.set(k, v); })); return m; };
const genTokens = topRoot(gen), genInlineTokens = topRoot(genInline), farTokens = topRoot(far);
const INLINE_TOKENS = ['--background', '--hover-bg'];   // defined in the generator's index.html inline <style>, not in style.css

console.log('== 1. tokens equal the generator\'s ==');
{
    const wrong = [], missing = [];
    for (const [k, v] of farTokens) {
        const src = INLINE_TOKENS.includes(k) ? genInlineTokens : genTokens;
        if (!src.has(k)) missing.push(k); else if (src.get(k) !== v) wrong.push(`${k}: copy "${v}" vs generator "${src.get(k)}"`);
    }
    check(`${farTokens.size} custom properties copied; the generator still declares every one`, missing.length === 0, missing.join(', '));
    check('...and each has the generator\'s exact value', wrong.length === 0, wrong.join(' | '));
    check('the two tokens that live in index.html\'s inline <style> (not style.css) are covered', INLINE_TOKENS.every(k => farTokens.has(k) && genInlineTokens.has(k)));
    check('--bar-h is still derived from --target (60px mouse / 72px touch) in both', farTokens.get('--bar-h') === 'calc(var(--target) + 24px)' && genTokens.get('--bar-h') === farTokens.get('--bar-h'));
}

console.log('\n== 2. every generator token is copied or consciously not ==');
{
    // Tokens the Farborgel does NOT take, with the reason. A NEW generator token is neither here nor in tokens.css:
    // the test fails, and whoever added it has to decide which list it belongs on.
    const NOT_COPIED = {
        '--canvas-max': 'the generator\'s canvas layout', '--canvas-size': 'the generator\'s canvas layout', '--nav-h': 'the generator\'s nav-row layout',
        '--rail-gap': 'the generator\'s canvas rail layout', '--rail-group-gap': 'the generator\'s canvas rail layout',
        '--line-color': 'the generator\'s pattern-line color (set from JS for the p5 canvas; the Farborgel has no pattern canvas)',
        '--canvas-ratio': 'the generator\'s canvas layout (task 078: W / H of a non-square canvas)', '--canvas-avail': 'the generator\'s canvas layout (task 078)', '--canvas-w': 'the generator\'s canvas layout (task 078)', '--canvas-h': 'the generator\'s canvas layout (task 078)',
        '--canvas-w0': 'the generator\'s canvas layout (task 078b)', '--canvas-hfit': 'the generator\'s canvas layout (task 078b: window-height limit, set from JS)', '--canvas-wu': 'the generator\'s canvas layout (task 078b: sketch width in units, set from JS)'
    };
    const open = [...genTokens.keys()].filter(k => !farTokens.has(k) && !(k in NOT_COPIED));
    check(`${genTokens.size} generator tokens: ${farTokens.size - INLINE_TOKENS.length} copied, ${Object.keys(NOT_COPIED).length} declined with a reason, none undecided`, open.length === 0, open.join(', '));
    const stale = Object.keys(NOT_COPIED).filter(k => !genTokens.has(k) && !gen.some(r => r.decls.some(([p]) => p === k)));
    check('...and nothing on the declined list has been removed from the generator (the list stays honest)', stale.length === 0, stale.join(', '));
}

console.log('\n== 3. the pointer: fine override ==');
{
    const find = rules => rules.filter(r => r.selector === ':root' && r.media && /pointer:\s*fine/.test(r.media));
    const g = find(gen), f = find(far);
    check('both declare a (pointer: fine) override of :root', g.length >= 1 && f.length === 1);
    check('...with the same --target (36px mouse, 48px touch default)', declMap(f[0].decls).get('--target') === '36px' && g.some(r => declMap(r.decls).get('--target') === '36px') && farTokens.get('--target') === '48px' && genTokens.get('--target') === '48px');
}

console.log('\n== 4. copied rules ==');
{
    // a copied rule is at top level or inside @media (hover: hover) (the generator's :hover rules sit behind it since Phase 2 track A: no sticky hover on touch)
    const COPY_MEDIA = [null, '(hover: hover)'];
    const copied = far.filter(r => r.selector !== ':root' && r.selector !== '@font-face' && COPY_MEDIA.includes(r.media));
    const diff = [], missing = [], mediaVariant = [];
    for (const r of copied) {
        const same = gen.filter(g => g.selector === r.selector && g.media === r.media);
        if (!same.length) { missing.push(r.selector); continue; }
        const merged = same.flatMap(g => g.decls);          // a selector can appear twice in the generator; the cascade merges them
        if (!sameDecls(r.decls, merged)) diff.push(r.selector);
        if (gen.some(g => g.selector === r.selector && g.media !== null && !far.some(f => f.selector === r.selector && f.media === g.media))) mediaVariant.push(r.selector);
    }
    check(`${copied.length} rules copied (.ico, .stepper, .stepper::after, .stepper-icon, .stepper-chevrons, .stepper-btn..., .stepper-display...): each still exists in style.css`, missing.length === 0 && copied.length >= 10, missing.join(', '));
    check('...and has IDENTICAL declarations (every property and value)', diff.length === 0, diff.join(', '));
    check('...and the generator has added no @media variant of any of them that the copy would miss', mediaVariant.length === 0, mediaVariant.join(', '));
    check('the copy includes the pieces the stepper needs to look right: the chevron rules and the display', ['.stepper-chevrons', '.stepper-btn', '.stepper-btn .ico', '.stepper-display'].every(sel => copied.some(r => r.selector === sel)));
}

console.log('\n== 5. fonts ==');
{
    // Task 130: Suisse Int'l is NOT in the repository (licence). Both style sheets declare the faces with absolute URLs on the website's server.
    const BASE = 'https://bachmann-paulsen.de/fonts/';
    const faces = rules => rules.filter(r => r.selector === '@font-face').map(r => { const d = declMap(r.decls); const url = (d.get('src') || '').match(/url\(\s*["']?([^"')]+)["']?\s*\)/); return { family: (d.get('font-family') || '').replace(/["']/g, ''), url: url ? url[1] : null, local: /local\(/.test(d.get('src') || ''), weight: d.get('font-weight'), style: d.get('font-style') || 'normal', display: d.get('font-display'), fmt: /format\(\s*["']woff2["']\s*\)/.test(d.get('src') || ''), d }; });
    const G = faces(gen), F = faces(far);
    const key = f => f.weight + '/' + f.style;
    check('the family name is "SuisseIntl" on every face with a file, in the generator and in the Farborgel (not "Suisse Intl")', G.filter(f => f.url).length >= 2 && F.filter(f => f.url).length >= 4 && [...G, ...F].filter(f => !f.local).every(f => f.family === 'SuisseIntl'), [...new Set([...G, ...F].map(f => f.family))].join(', '));
    check('every face with a file points at ' + BASE + 'suisseintl-<cut>.woff2 (lower case, absolute, no local path), with format("woff2") and font-display: swap', [...G, ...F].filter(f => f.url).every(f => /^https:\/\/bachmann-paulsen\.de\/fonts\/suisseintl-[a-z]+\.woff2$/.test(f.url) && f.fmt && f.display === 'swap'), [...G, ...F].filter(f => f.url && !f.url.startsWith(BASE)).map(f => f.url).join(', '));
    const EXPECT_G = { '400/normal': 'book', '600/normal': 'semibold' };
    const EXPECT_F = { '400/normal': 'book', '600/normal': 'semibold', '700/normal': 'bold', '400/italic': 'bookit' };
    const eq = (faceList, exp) => { const got = {}; faceList.filter(f => f.url).forEach(f => { got[key(f)] = f.url.slice(BASE.length + 'suisseintl-'.length, -'.woff2'.length); }); return JSON.stringify(Object.keys(exp).sort().map(k => [k, exp[k]])) === JSON.stringify(Object.keys(got).sort().map(k => [k, got[k]])); };
    check('the generator declares exactly Book 400, Semibold 600', eq(G, EXPECT_G), G.filter(f => f.url).map(f => key(f) + ' ' + f.url).join('; '));
    check('the Farborgel declares exactly Book 400, Semibold 600, Bold 700 and Book Italic 400 (the Bold file is uploaded by the owner; see reports/130.md)', eq(F, EXPECT_F), F.filter(f => f.url).map(f => key(f) + ' ' + f.url).join('; '));
    const sharedBad = G.filter(g => g.url).filter(g => !F.some(f => f.url === g.url && key(f) === key(g)));
    check('the Farborgel uses the SAME URL as the generator for the shared cuts (Book, Semibold)', sharedBad.length === 0, sharedBad.map(f => f.url).join(', '));
    const gfb = G.find(x => x.local), ffb = F.find(x => x.local);
    check('the metrics fallback face ("SuisseIntl Fallback": Arial, size-adjust and overrides) is identical', !!gfb && !!ffb && gfb.family === ffb.family && sameDecls(gfb.d, ffb.d));
    const stack = '"SuisseIntl", "SuisseIntl Fallback", system-ui, "Helvetica Neue", Arial, sans-serif';
    check('--font-ui is the same in both and is: ' + stack, genTokens.get('--font-ui') === stack && farTokens.get('--font-ui') === stack);
    check('no font file is left in assets/fonts or color-harmony/ui/assets/fonts', ['assets/fonts', 'color-harmony/ui/assets/fonts'].every(d => !fs.existsSync(path.join(ROOT, d)) || fs.readdirSync(path.join(ROOT, d)).every(n => !/\.(woff2?|otf|ttf)$/i.test(n))));
}

console.log('\n== 6. styles.css really uses the tokens ==');
{
    const stylesSrc = read('color-harmony/ui/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const root = farStyles.filter(r => r.selector === ':root' && r.media === null).flatMap(r => r.decls);
    const rootMap = declMap(root);
    check('its three type sizes ARE the generator\'s: --text-primary = --fs-tab (18), --text-ui = --size-base (16), --text-meta = --size-secondary (12)',
        rootMap.get('--text-primary') === 'var(--fs-tab)' && rootMap.get('--text-ui') === 'var(--size-base)' && rootMap.get('--text-meta') === 'var(--size-secondary)'
        && genTokens.get('--fs-tab') === '18px' && genTokens.get('--size-base') === '16px' && genTokens.get('--size-secondary') === '12px');
    check('...the page font is the generator\'s stack (var(--font-ui))', rootMap.get('font-family') === 'var(--font-ui)');
    check('no @font-face in styles.css (the faces live in tokens.css) and the old "Suisse Intl" family name is gone from both files', !/@font-face/.test(stylesSrc) && !/Suisse Intl/.test(stylesSrc) && !/Suisse Intl/.test(read('color-harmony/ui/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '')));
    check('styles.css does not redefine a copied token (it only ALIASES them): none of --target / --radius / --bar-h / --gap / --icon / --gutter is set there', !farStyles.some(r => r.decls.some(([k]) => ['--target', '--radius', '--bar-h', '--gap', '--icon', '--gutter', '--size-base', '--size-secondary', '--fs-tab', '--font-ui'].includes(k))));
    check('no literal font-size in px anywhere in styles.css (every size goes through the three tokens)', !/font-size:\s*[0-9.]+px/.test(stylesSrc), (stylesSrc.match(/font-size:\s*[0-9.]+px/g) || []).join(' '));
    const baseButton = farStyles.find(r => r.selector === 'button' && r.media === null);
    const bd = declMap(baseButton.decls);
    check('the base button is sized and rounded by the generator\'s tokens (min-width/min-height var(--target), border-radius var(--radius))', bd.get('min-width') === 'var(--target)' && bd.get('min-height') === 'var(--target)' && bd.get('border-radius') === 'var(--radius)');
    check('the old flat touch rule (pointer: coarse -> button min-height 44px) and the stale "Generator reference" alignment note are gone', !/pointer:\s*coarse\s*\)\s*\{\s*button\s*\{\s*min-height:\s*44px/.test(stylesSrc) && !/Generator reference/.test(read('color-harmony/ui/styles.css').replace(/\(replaces[^)]*\)/i, '')));
    const hdr = farStyles.find(r => r.selector === '.site-header' && r.media === null), tb = farStyles.find(r => r.selector === '.toolbar' && r.media === null);
    check('header and toolbar are one --bar-h tall (min-height var(--bar-h))', declMap(hdr.decls).get('min-height') === 'var(--bar-h)' && declMap(tb.decls).get('min-height') === 'var(--bar-h)');
    check('the header is 60px at every width: no padding left over from the old 84px header (the min-width:1500px block once added padding-top:32px, which made it 63px with the title off-centre)', !farStyles.some(r => r.selector === '.site-header' && r.media !== null && /min-width/.test(r.media) && r.decls.some(([k]) => /^padding/.test(k))), farStyles.filter(r => r.selector === '.site-header' && r.media).map(r => r.media).join(' | '));
    check('the "Forschungsinstrument / 6B.1" development label is gone: no .edition rule, no research i18n key, no .edition element in app.mjs', !/\.edition/.test(stylesSrc) && !/research:\s*\[/.test(read('color-harmony/ui/i18n.mjs')) && !/edition|t\('research'/.test(read('color-harmony/ui/app.mjs')) && !/Forschungsinstrument|Research instrument/.test(read('color-harmony/ui/i18n.mjs') + read('color-harmony/ui/app.mjs')));
    const copiedSelectors = far.filter(r => r.selector !== ':root' && r.selector !== '@font-face').map(r => r.selector);
    const redefined = [...new Set(farStyles.filter(r => copiedSelectors.includes(r.selector)).map(r => r.selector))];
    check('styles.css never REDEFINES a rule copied from the generator (.ico, .stepper*): the stepper look stays the generator\'s, this page only adds around it', redefined.length === 0, redefined.join(', '));
    check('the navigator is the stepper (P4 step 2): the old "‹ 01 ›" rules - borderless 32px buttons, a bold hue, its own focus ring - are gone', !/\.code-navigator button/.test(stylesSrc) && !/\.code-hue \.code-value/.test(stylesSrc) && !/\.code-value:focus-visible/.test(stylesSrc));
    check('the phone layout starts where the generator\'s does: no max-width:700px left, the breakpoint is max-width:767px', !/max-width:\s*700px/.test(stylesSrc) && /max-width:\s*767px/.test(stylesSrc));
    check('the two breakpoints that encode real content constraints are untouched (1050px: the 1060px register grid; 1500px: large-screen padding)', /max-width:\s*1050px/.test(stylesSrc) && /min-width:\s*1500px/.test(stylesSrc));
}

console.log('\n== 7. loading ==');
{
    const html = read('color-harmony/ui/index.html');
    const t = html.indexOf('tokens.css'), s = html.indexOf('styles.css');
    check('color-harmony/ui/index.html links tokens.css BEFORE styles.css (the aliases in styles.css need the tokens)', t > 0 && s > 0 && t < s);
    const vt = (html.match(/tokens\.css\?v=([0-9]{8}[a-z]+)/) || [])[1], vs = (html.match(/styles\.css\?v=([0-9]{8}[a-z]+)/) || [])[1], vg = (indexHtml.match(/style\.css\?v=([0-9]{8}[a-z]+)/) || [])[1];
    check('...both with the project\'s ONE shared version (the same as the generator\'s style.css)', !!vt && vt === vs && vt === vg, `${vt} ${vs} ${vg}`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
