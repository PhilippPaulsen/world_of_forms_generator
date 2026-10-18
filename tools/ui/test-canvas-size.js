// Guard for the canvas size below 768px (the canvas fix before layer-table commit 2): source text of style.css and index.html. No browser.
//   node tools/ui/test-canvas-size.js
//   STYLE_CSS=... INDEX_HTML=... node tools/ui/test-canvas-size.js        (sabotage runs)
//
// What it pins. The canvas is a SQUARE of --canvas-size (560px, or the row when that is narrower) at every width. From 768px the canvas row is a grid and the container sits in its middle
// column. Below 768px the row is a wrapping flex row and the container used to take `flex: 0 0 100%`: flex-basis beats the container's own width, so from 593px (the row, 100vw - 32px, wider than
// 560px) it filled the row while its height stayed --canvas-size, and the 1200 x 1200 bitmap was stretched to row x 560 (712 x 560 at 744px). The fix: the basis is min(--canvas-size, 100%) and the
// two side margins are what is left of the row, so the container is centred AND its outer size stays 100% (the rail rows, and in the Farbe tab the groups that are display: contents, still wrap below
// it instead of joining its line). Up to 592px every term is 0 or 100%: the old rule. The numbers are measured in the browser (tools/ui/measure-layout.js at 375 / 768 / 1100 / 1440 and the widths
// around the change); this file pins the rule and the arithmetic.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const CSS = read('STYLE_CSS', 'style.css');
const HTML = read('INDEX_HTML', 'index.html');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 140)); } };

const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
// the balanced-brace body of every block that starts with the given header
function media(text, header) {
    const out = [];
    let at = 0;
    for (;;) {
        const i = text.indexOf(header, at);
        if (i < 0) break;
        let depth = 0, j = text.indexOf('{', i), k = j;
        for (; k < text.length; k++) { if (text[k] === '{') depth++; else if (text[k] === '}') { depth--; if (!depth) break; } }
        out.push(text.slice(j + 1, k));
        at = k;
    }
    return out;
}
const rules = text => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].split(',').map(s => s.trim().replace(/\s+/g, ' ')), body: m[2].trim() }));
const decls = body => { const o = {}; for (const d of body.split(';')) { const i = d.indexOf(':'); if (i > 0) o[d.slice(0, i).trim()] = d.slice(i + 1).trim().replace(/\s+/g, ' '); } return o; };
const BOX = '.canvas-row #canvas-container';
const PHONES = media(css, '@media (max-width: 767px)'), DESKS = media(css, '@media (min-width: 768px)');
const PR = rules(PHONES.join('\n')), DR = rules(DESKS.join('\n'));
let top = css;
for (const blk of PHONES.concat(DESKS)) top = top.replace(blk, '');
const boxRules = PR.filter(r => r.sel.includes(BOX));
const box = boxRules.length === 1 ? decls(boxRules[0].body) : {};

const BASIS = 'min(var(--canvas-size), 100%)';
const MARGIN = 'calc((100% - min(var(--canvas-size), 100%)) / 2)';

console.log('== the rule below 768px ==');
T('rule', () => {
    check('exactly one rule for the canvas container in all @media (max-width: 767px) blocks', boxRules.length === 1, boxRules.length + ' rule(s) in ' + PHONES.length + ' phone block(s)');
    check('flex: 0 0 min(var(--canvas-size), 100%) - a basis the size of the canvas, never the whole row (and no shrink)', box.flex === '0 0 ' + BASIS, box.flex);
    check('margin-left and margin-right are both half of what is left of the row: calc((100% - min(var(--canvas-size), 100%)) / 2)', box['margin-left'] === MARGIN && box['margin-right'] === MARGIN, box['margin-left'] + ' | ' + box['margin-right']);
    check('order: 0 stays (test-rail-groups.js: the canvas keeps order 0 on the phone)', box.order === '0', box.order);
    check('the rule sets nothing else (no width, height, max-width, margin shorthand, aspect-ratio that could undo the square)', JSON.stringify(Object.keys(box).sort()) === JSON.stringify(['flex', 'margin-left', 'margin-right', 'order']), Object.keys(box).join(','));
    check('the old rule (flex: 0 0 100% on the container) is gone', !PR.some(r => r.sel.includes(BOX) && /flex:\s*0 0 100%/.test(r.body)) && !/#canvas-container[^{}]*\{[^{}]*flex:\s*0 0 100%/.test(top));
    check('no rule outside the phone block sets the container\'s flex or margins under .canvas-row (the same rule would then apply from 768px, where the row is a grid)', !PR.length || ![...rules(top), ...DR].some(r => r.sel.includes(BOX) && /\b(flex|margin)/.test(r.body)));
});

console.log('\n== the size token and the container ==');
T('token', () => {
    check('--canvas-max is 560px and --canvas-size is min(var(--canvas-max), calc(100vw - 2 * var(--gutter)))', /--canvas-max:\s*560px/.test(css) && /--canvas-size:\s*min\(var\(--canvas-max\),\s*calc\(100vw - 2 \* var\(--gutter\)\)\)/.test(css));
    check('--gutter is 16px (the row\'s side padding below 768px is var(--gutter): 100vw - 32px is the row)', /--gutter:\s*16px/.test(css) && /\.canvas-row\s*\{[^{}]*padding:\s*0 var\(--gutter\)/.test(top));
    const inline = (HTML.match(/#canvas-container\s*\{[^{}]*\}/g) || []).join('\n');
    check('index.html: the container is --canvas-size wide AND high (a square), flex: none, margin var(--gap) 0', /width:\s*var\(--canvas-size\)/.test(inline) && /height:\s*var\(--canvas-size\)/.test(inline) && /flex:\s*none/.test(inline) && /margin:\s*var\(--gap\) 0/.test(inline));
    check('index.html: the canvas fills its container (width and height 100%), so a square container is a square canvas', /#canvas-container canvas\s*\{[^{}]*width:\s*100% !important[^{}]*height:\s*100% !important/.test(HTML));
    check('from 768px the container sits in the grid\'s middle column (grid-column: 2) and the phone rule is not repeated there', DR.some(r => r.sel.includes(BOX)) === false && /\.canvas-row #canvas-container\s*\{[^{}]*grid-column:\s*2/.test(top));
});

console.log('\n== the arithmetic of the rule (the widths the rule is for) ==');
T('arithmetic', () => {
    // the browser's evaluation of the three terms for a viewport width w (the row is w - 2 * 16 below 768px)
    const eval_ = w => { const row = w - 32, size = Math.min(560, w - 32), basis = Math.min(size, row), margin = (row - basis) / 2; return { row, size, basis, margin }; };
    let outerOk = true, squareOk = true, bound = true, zero = true, centred = true;
    for (let w = 300; w <= 767; w++) {
        const e = eval_(w);
        if (Math.abs(e.basis + 2 * e.margin - e.row) > 1e-9) outerOk = false;
        if (e.basis !== e.size) squareOk = false;
        if (e.basis > 560) bound = false;
        if (w <= 592 && e.margin !== 0) zero = false;
        if (w >= 593 && Math.abs(e.margin - (w - 32 - 560) / 2) > 1e-9) centred = false;
    }
    check('basis + both margins = the row at every width 300..767 (the container\'s OUTER size stays 100%: nothing else joins its line)', outerOk);
    check('the basis is the canvas size (560px, or the row when narrower) at every width: the square the container\'s height already is', squareOk && bound);
    check('up to 592px both margins are 0 (nothing changes on a phone; 375px: a 343px canvas at 16px)', zero, 'w=375: ' + JSON.stringify(eval_(375)));
    check('from 593px the canvas is centred: margin = (w - 32 - 560) / 2, so the canvas starts at 16 + margin (16.5 at 593, 20 at 600, 60 at 680, 92 at 744, 103.5 at 767)', centred && eval_(744).margin === 76 && eval_(767).margin === 87.5 && eval_(593).margin === 0.5);
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
