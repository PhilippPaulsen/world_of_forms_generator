// Guard for the touch CSS (Phase 2, track A): source text of style.css and the inline <style> blocks of index.html, no browser.
//   node tools/ui/test-touch-css.js
//   STYLE_CSS=/path/to/mutated/style.css INDEX_HTML=/path/to/mutated/index.html node tools/ui/test-touch-css.js     (sabotage runs)
//
// What a touch screen needs from the CSS, and what silently breaks it:
//   - every :hover rule inside @media (hover: hover). On a touch screen a tap leaves :hover set (sticky hover: a button stays grey, the icon tooltip stays on screen)
//     until the next tap elsewhere. The rules stay in place (their order against .active rules matters); the focus-visible and .active rules stay OUTSIDE the query,
//     the pressed state and the keyboard focus are the feedback on touch;
//   - touch-action: manipulation (never none: none would stop scrolling and pinch zoom) on the canvas container and the canvas and on buttons; the viewport meta keeps
//     zoom enabled; no -webkit-touch-callout / user-select on the canvas and the stepper buttons means a long press opens the iOS image / selection menu;
//   - fields at 16px or more on a coarse pointer (iOS zooms the page into a field below 16px);
//   - .overlay.sheet: max-height 80dvh AFTER the 80vh fallback (80vh is the large viewport on iOS, taller than the visible screen).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const css = fs.readFileSync(process.env.STYLE_CSS || path.join(ROOT, 'style.css'), 'utf8');
const html = fs.readFileSync(process.env.INDEX_HTML || path.join(ROOT, 'index.html'), 'utf8');
const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const norm = t => t.replace(/\s+/g, ' ').trim();

// Walk the blocks of a stylesheet: [{ header, parents:[at-rule headers], body }] for every block, comments blanked first.
function blocks(text) {
    const src = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    const out = [], stack = []; let i = 0, headStart = 0;
    while (i < src.length) {
        const c = src[i];
        if (c === '{') { const header = norm(src.slice(headStart, i)); stack.push({ header, start: i + 1 }); headStart = i + 1; }
        else if (c === '}') { const b = stack.pop(); if (b) out.push({ header: b.header, parents: stack.map(s => s.header), body: src.slice(b.start, i) }); headStart = i + 1; }
        else if (c === ';' && !stack.length) headStart = i + 1;
        i++;
    }
    return out;
}
const inHoverMedia = b => b.parents.some(p => /^@media\s*\(\s*hover:\s*hover\s*\)$/.test(p));
const isRule = b => !/^@/.test(b.header);
const sheets = { 'style.css': blocks(css), 'index.html inline <style>': blocks(inline) };

console.log('== :hover ==');
for (const [name, bl] of Object.entries(sheets)) {
    const hov = bl.filter(b => isRule(b) && /:hover/.test(b.header));
    const bare = hov.filter(b => !inHoverMedia(b));
    check(`${name}: has :hover rules at all (the scan found them)`, hov.length >= (name === 'style.css' ? 10 : 5), hov.length + ' rules');
    check(`${name}: no bare :hover - every :hover rule is inside @media (hover: hover)`, bare.length === 0, bare.length ? bare.map(b => b.header).join(' | ').slice(0, 160) : hov.length + ' rules, all behind the query');
    const mixed = bl.filter(b => isRule(b) && inHoverMedia(b) && /:(focus|focus-visible|focus-within|active)\b/.test(b.header));
    check(`${name}: nothing with :focus / :focus-visible / :active is inside the hover query (a selector list that mixes them must be split)`, mixed.length === 0, mixed.map(b => b.header).join(' | ').slice(0, 160) || 'none');
}
const tip = sheets['style.css'].find(b => isRule(b) && /^\.icon-btn\[title\]:hover::after$/.test(b.header));
check('the icon-button tooltip (.icon-btn[title]:hover::after) exists and is behind the query', !!tip && inHoverMedia(tip));

console.log('\n== what must stay outside the query ==');
const outside = (sel) => sheets['style.css'].some(b => isRule(b) && !inHoverMedia(b) && b.header.split(',').map(norm).includes(sel));
check('.stepper-btn:focus-visible survives, outside the query', outside('.stepper-btn:focus-visible'));
check('.stepper-display:focus-visible survives, outside the query', outside('.stepper-display:focus-visible'));
check('the global a / button / input / select :focus-visible rule survives, outside the query', sheets['style.css'].some(b => isRule(b) && !inHoverMedia(b) && /button:focus-visible/.test(b.header) && /select:focus-visible/.test(b.header)));
check('the .active states (.opt.active) are outside the query', outside('.opt.active'));
check('the .active states (.icon-btn.active, .layer-btn.active in index.html) are outside the query', ['.icon-btn.active', '.layer-btn.active'].every(sel => sheets['index.html inline <style>'].some(b => isRule(b) && !inHoverMedia(b) && b.header.split(',').map(norm).includes(sel))));

console.log('\n== touch-action, callout, selection ==');
const ruleOf = (bl, sel) => bl.filter(b => isRule(b) && b.header.split(',').map(norm).includes(sel));
const decl = (b, prop, val) => new RegExp('(^|[;\\s])' + prop.replace(/[-]/g, '\\-') + '\\s*:\\s*' + val + '\\s*(;|$)').test(b.body);
const style = sheets['style.css'];
check('touch-action: manipulation on #canvas-container and on the canvas', ['#canvas-container', '#canvas-container canvas'].every(sel => ruleOf(style, sel).some(b => decl(b, 'touch-action', 'manipulation'))));
check('touch-action: manipulation on buttons', ruleOf(style, 'button').some(b => decl(b, 'touch-action', 'manipulation')));
check('touch-action is never none (it would stop scrolling and pinch zoom), in style.css, the inline styles and the page script that sets styles', !/touch-action\s*:\s*none/.test(css) && !/touch-action\s*:\s*none/.test(inline) && !/touchAction\s*=\s*['"]none/.test(html));
check('the canvas: -webkit-touch-callout: none and user-select: none', ruleOf(style, '#canvas-container canvas').some(b => decl(b, '-webkit-touch-callout', 'none') && decl(b, 'user-select', 'none') && decl(b, '-webkit-user-select', 'none')));
check('the stepper buttons: -webkit-touch-callout: none and user-select: none (holding them is a long press)', ruleOf(style, '.stepper-btn').some(b => decl(b, '-webkit-touch-callout', 'none') && decl(b, 'user-select', 'none') && decl(b, '-webkit-user-select', 'none')));
const vp = (html.match(/<meta name="viewport"[^>]*>/) || [''])[0];
check('the viewport meta keeps zoom enabled (no user-scalable=no, no maximum-scale)', !!vp && !/user-scalable\s*=\s*(no|0)/i.test(vp) && !/maximum-scale/i.test(vp), vp.slice(0, 90));

console.log('\n== 16px fields, the sheet ==');
const coarse = style.filter(b => /^@media\s*\(\s*pointer:\s*coarse\s*\)$/.test(b.header));
const fieldRule = style.find(b => isRule(b) && b.parents.some(p => /^@media\s*\(\s*pointer:\s*coarse\s*\)$/.test(p)) && /(^|,)\s*select\s*(,|$)/.test(b.header) && /textarea/.test(b.header) && /input:not\(\[type="range"\]\)/.test(b.header));
check('on a coarse pointer: select, textarea and input (not range) get font-size max(16px, 1em)', !!fieldRule && /font-size\s*:\s*max\(\s*16px\s*,\s*1em\s*\)/.test(fieldRule.body), coarse.length + ' coarse blocks');
const sheetRule = style.find(b => isRule(b) && b.header === '.overlay.sheet');
const mh = sheetRule ? [...sheetRule.body.matchAll(/max-height\s*:\s*([^;]+);/g)].map(m => norm(m[1])) : [];
check('.overlay.sheet: max-height 80vh first (fallback), 80dvh after it', mh.length === 2 && mh[0] === '80vh' && mh[1] === '80dvh', mh.join(' , '));

console.log('\n== the coarse-pointer minimum target (commit B) ==');
{
    const isCoarse = b => b.parents.some(p => /^@media\s*\(\s*pointer:\s*coarse\s*\)$/.test(p));
    const find = (bl, sel, pred) => bl.filter(b => isRule(b) && isCoarse(b) && b.header.split(',').map(norm).includes(sel) && (!pred || pred(b)));
    const has = (bl, sel, props) => find(bl, sel).some(b => Object.entries(props).every(([k, v]) => decl(b, k, v)));
    const inl = sheets['index.html inline <style>'];
    const T = 'var\\(--target\\)';
    check('.app-tabs a: min-width --target (the "Netz" tab was 47.8px)', has(style, '.app-tabs a', { 'min-width': T, 'justify-content': 'center' }));
    for (const sel of ['.icon-btn', '.layer-btn', '.layer-remove-btn', '.format-btn', '.dialog-content button'])
        check(`${sel}: border-box, min-width and min-height --target`, has(style, sel, { 'box-sizing': 'border-box', 'min-width': T, 'min-height': T }));
    check('.layer-btn and .layer-remove-btn: flex none, no wrapping text (no squeezing to 11px)', ['.layer-btn', '.layer-remove-btn'].every(sel => has(style, sel, { flex: 'none', 'white-space': 'nowrap' })));
    check('the layer row wraps: .icon-row flex-wrap, #layer-tabs display: contents, .layer-tab flex none', has(style, '.icon-row', { 'flex-wrap': 'wrap' }) && has(style, '#layer-tabs', { display: 'contents' }) && has(style, '.layer-tab', { flex: 'none' }));
    check('the timeline keyframe list and the pairing rows wrap', has(style, '#timeline-keyframe-list', { 'flex-wrap': 'wrap' }) && has(style, '.pairing-row', { 'flex-wrap': 'wrap' }));
    check('.layer-btn.pairing-move-btn: min-width --target (out-ranks .pairing-move-btn { min-width: 24px })', has(style, '.layer-btn.pairing-move-btn', { 'min-width': T }));
    check('number fields and selects: min-height --target', has(style, 'select', { 'min-height': T }) && has(style, '.control-group input[type="number"]', { 'min-height': T }));
    check('a stepper\'s value (number field and display) is --target wide and high, with "html" and ">" so it out-ranks the base rules', has(style, 'html .stepper > input[type="number"]', { width: T, 'min-width': T, 'align-self': 'stretch' }) && has(style, 'html .stepper > .stepper-display', { width: T, 'min-width': T, 'align-self': 'stretch' }));
    const cb = 'input[type="checkbox"].layer-enable-checkbox';
    check('the layer checkbox: --target hit area, custom box (appearance none), selector out-ranks index.html\'s checkbox rule', has(style, cb, { appearance: 'none', width: T, height: T }) && find(style, cb + '::before').length === 1 && find(style, cb + ':checked::before').length === 1 && find(style, cb + ':checked::after').length === 1);
    check('range inputs (index.html inline): --target high, the track drawn by the pseudo-element (6px), a 28px thumb', has(inl, 'input[type="range"]', { height: T, background: 'transparent' }) && has(inl, 'input[type="range"]::-webkit-slider-runnable-track', { height: '6px' }) && has(inl, 'input[type="range"]::-webkit-slider-thumb', { width: '28px', height: '28px' }) && has(inl, 'input[type="range"]::-moz-range-thumb', { width: '28px', height: '28px' }));
    const outside = ['.layer-btn', '.layer-remove-btn', '.icon-btn', '.format-btn', '.pairing-row', '.icon-row'].filter(sel => style.concat(inl).some(b => isRule(b) && !isCoarse(b) && !b.parents.some(p => /pointer/.test(p)) && b.header.split(',').map(norm).includes(sel) && (/min-(width|height)\s*:\s*var\(--target\)/.test(b.body) || /flex-wrap\s*:\s*wrap/.test(b.body))));
    check('fine pointer unchanged: no top-level rule sets min-width / min-height --target or flex-wrap on those selectors (all of it is inside the coarse query)', outside.length === 0, outside.join(', ') || 'none');
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
