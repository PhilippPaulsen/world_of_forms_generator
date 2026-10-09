// Guard for the canvas rail's five groups (rail rearrangement, commit 1): source text of index.html, style.css, ui-rail.js and sketch.js. No browser.
//   node tools/ui/test-rail-groups.js
//   INDEX_HTML=... STYLE_CSS=... SKETCH_JS=... UI_RAIL_JS=... node tools/ui/test-rail-groups.js        (sabotage runs)
//
// What it pins. The rail is A undo, redo, random | B points, curves, fill | More | C the catalog link (Formorgel; Farborgel in the Farbe tab), Paste Pattern | D info, download | E clear, each a
// .rail-group. The DOM order is the visual order (so the tab order is too): the ONLY `order` on the tablet / desktop rail is More's (it is the last item there, so its popover hangs under the
// rail). Which controls show in which tab is decided by CSS (html[data-tab]; nav.js sets it) and is computed here from the rules, not copied. The links are <a> elements that need border-box (a link
// is content-box: 48 + the border made them 50px). Paste Pattern is an icon in the rail (Form tab only). Nothing here may add a p5 mousePressed binding: the buttons are the same elements
// sketch.js wires by id.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const HTML = read('INDEX_HTML', 'index.html');
const CSS = read('STYLE_CSS', 'style.css');
const SKETCH = read('SKETCH_JS', 'sketch.js');
const RAILJS = read('UI_RAIL_JS', 'ui-rail.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 140)); } };

// ---- the rail markup -----------------------------------------------------------------------------------------------------------------------------------------------------------
const a = HTML.indexOf('<div class="canvas-row">'), b = HTML.indexOf('<div class="main-container">');
const rail = a >= 0 && b > a ? HTML.slice(a, b) : '';
// depth-aware reading of the groups: [{ id, cls, ids: [element ids in DOM order] }]
function groups(markup) {
    const out = [];
    const re = /<div\b([^>]*\bclass="[^"]*\brail-group\b[^"]*"[^>]*)>/g;
    let m;
    while ((m = re.exec(markup))) {
        let depth = 1, i = re.lastIndex;
        const tag = /<(\/?)div\b/g; tag.lastIndex = i;
        let t;
        while (depth && (t = tag.exec(markup))) { depth += t[1] ? -1 : 1; i = tag.lastIndex; }
        const inner = markup.slice(re.lastIndex, i);
        out.push({ id: (m[1].match(/\bid="([^"]+)"/) || [])[1], cls: (m[1].match(/\bclass="([^"]+)"/) || [])[1], ids: [...inner.matchAll(/<(?:button|a)\b[^>]*\bid="([^"]+)"/g)].map(x => x[1]) });
    }
    return out;
}
const G = groups(rail);
const byId = id => G.find(g => g.id === id);

console.log('== the markup: groups, order, membership ==');
T('markup', () => {
    check('the canvas row and its rail were found', rail.includes('class="rail-left"') && rail.includes('id="canvas-container"'));
    check('the groups are, in DOM order: A, B, More, C, D, E, the strategies, Reset Color', JSON.stringify(G.map(g => g.id)) === JSON.stringify(['rail-group-a', 'rail-group-b', 'rail-group-more', 'rail-group-c', 'rail-group-d', 'rail-group-e', 'farbe-strategy-group', 'rail-group-reset']), G.map(g => g.id).join(' '));
    const want = {
        'rail-group-a': ['btn-undo', 'btn-redo', 'btn-random'],
        'rail-group-b': ['btn-toggle-nodes', 'btn-toggle-curve', 'btn-toggle-faces'],   // Toggle Curve stays here until it moves into More (next commit)
        'rail-group-more': ['btn-more-rail'],
        'rail-group-c': ['btn-gallery', 'btn-farborgel', 'btn-paste-pattern'],
        'rail-group-d': ['btn-info', 'btn-save'],
        'rail-group-e': ['btn-clear'],
        'farbe-strategy-group': ['btn-strategy-cyclic', 'btn-strategy-area', 'btn-strategy-symmetry', 'btn-strategy-rings'],
        'rail-group-reset': ['btn-face-colors-reset'],
    };
    for (const id of Object.keys(want)) check(`${id}: ${want[id].join(', ')}`, byId(id) && JSON.stringify(byId(id).ids) === JSON.stringify(want[id]), byId(id) && byId(id).ids.join(', '));
    const all = [...rail.matchAll(/<(?:button|a)\b[^>]*\bid="([^"]+)"/g)].map(x => x[1]);
    check('every rail button / link is in a group, once (no stray rail button)', all.length === new Set(all).size && all.length === G.reduce((n, g) => n + g.ids.length, 0), all.length + ' controls');
    // the wrappers: .rail-top = A + B + More (B and More inside .rail-bm), .rail-bottom = C + D + E + the Farbe groups
    const top = rail.slice(rail.indexOf('class="rail-top"'), rail.indexOf('class="rail-bottom"')), bottom = rail.slice(rail.indexOf('class="rail-bottom"'));
    check('.rail-top holds A and .rail-bm (B + More); .rail-bottom holds C, D, E and the two Farbe groups', top.includes('id="rail-group-a"') && /class="rail-bm"[\s\S]*id="rail-group-b"[\s\S]*id="rail-group-more"/.test(top) && !top.includes('rail-group-c') && ['rail-group-c', 'rail-group-d', 'rail-group-e', 'farbe-strategy-group', 'rail-group-reset'].every(id => bottom.includes(id)) && !bottom.includes('rail-group-more'));
    check('the old .rail-break spans and the old .button-group are gone (no forced-break element is left)', !/rail-break|button-group/.test(HTML) && !/rail-break|\.button-group/.test(CSS));
    check('the Farbe-only groups keep rail-farbe-only; the strategy group keeps role="radiogroup"', /id="farbe-strategy-group" class="rail-group rail-farbe-only" role="radiogroup"/.test(rail) && /id="rail-group-reset" class="rail-group rail-farbe-only"/.test(rail));
});

console.log('\n== the links and Paste Pattern ==');
T('links', () => {
    const tag = id => (rail.match(new RegExp('<(?:a|button)\\b[^>]*\\bid="' + id + '"[^>]*>')) || [''])[0];
    const attr = (t, n) => (t.match(new RegExp('\\b' + n + '="([^"]*)"')) || [])[1];
    const gal = tag('btn-gallery'), far = tag('btn-farborgel');
    check('Formorgel: an <a> to gallery.html in a new tab (noopener), title = aria-label "Formorgel (öffnet in neuem Tab)", data-i18n', /^<a /.test(gal) && attr(gal, 'href') === 'gallery.html' && attr(gal, 'target') === '_blank' && attr(gal, 'rel') === 'noopener' && attr(gal, 'title') === 'Formorgel (öffnet in neuem Tab)' && attr(gal, 'aria-label') === attr(gal, 'title') && !!attr(gal, 'data-i18n'), gal.slice(0, 80));
    check('Farborgel: an <a> to color-harmony/ui/index.html, id and class "icon-btn rail-farbe-only" unchanged, new tab (noopener), title = aria-label "Farborgel (öffnet in neuem Tab)", data-i18n', /^<a /.test(far) && attr(far, 'href') === 'color-harmony/ui/index.html' && attr(far, 'class') === 'icon-btn rail-farbe-only' && attr(far, 'target') === '_blank' && attr(far, 'rel') === 'noopener' && attr(far, 'title') === 'Farborgel (öffnet in neuem Tab)' && attr(far, 'aria-label') === attr(far, 'title') && !!attr(far, 'data-i18n'), far.slice(0, 80));
    check('...and in the order id, class, href, target, rel (the regex of tools/color/test-farborgel-prefill.js reads it that way)', /<a id="btn-farborgel"[^>]*class="[^"]*rail-farbe-only[^"]*"[^>]*target="_blank"[^>]*rel="noopener"/.test(HTML));
    const pas = tag('btn-paste-pattern');
    check('Paste Pattern: a <button type="button"> icon (class "icon-btn rail-form-only"), with title, aria-label and data-i18n, an svg and no visible text', /^<button /.test(pas) && attr(pas, 'type') === 'button' && attr(pas, 'class') === 'icon-btn rail-form-only' && !!attr(pas, 'title') && attr(pas, 'aria-label') === attr(pas, 'title') && !!attr(pas, 'data-i18n') && /id="btn-paste-pattern"[\s\S]*?<svg[\s\S]*?<\/svg>\s*<\/button>/.test(rail));
    check('...it is no longer in the layer row; the status line #paste-pattern-status still is (the handler writes it)', !/layer-btn"[^>]*id="btn-paste-pattern"|id="btn-paste-pattern"[^>]*layer-btn/.test(HTML) && HTML.indexOf('id="paste-pattern-status"') > HTML.indexOf('id="btn-add-layer"') && HTML.indexOf('id="btn-paste-pattern"') < HTML.indexOf('id="paste-pattern-status"'));
    check('sketch.js still wires Paste Pattern by id (select(\'#btn-paste-pattern\')) and writes #paste-pattern-status: no handler lookup changed', /select\('#btn-paste-pattern'\)/.test(SKETCH) && /select\('#paste-pattern-status'\)/.test(SKETCH));
});

console.log('\n== the CSS: per-tab visibility, computed from the rules ==');
const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const railCss = css.slice(css.indexOf(':root {\n  --rail-gap'), css.indexOf('a:focus-visible, button:focus-visible'));
// balanced-brace blocks of a given @media header inside the rail CSS
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
const DESKS = media(railCss, '@media (min-width: 768px)'), PHONES = media(railCss, '@media (max-width: 767px)');
const DESK = DESKS.join('\n'), PHONE = PHONES.join('\n');
let top = railCss;
for (const blk of DESKS.concat(PHONES)) top = top.replace(blk, '');
const rules = text => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].split(',').map(s => s.trim().replace(/\s+/g, ' ')), body: m[2].trim() }));
const TOP = rules(top), DRULES = rules(DESK), PRULES = rules(PHONE);
const find = (rs, sel) => rs.filter(r => r.sel.includes(sel));
T('visibility', () => {
    check('the rail CSS was found', railCss.length > 500 && TOP.length > 5 && DRULES.length > 3 && PRULES.length > 3, `${TOP.length} / ${DRULES.length} / ${PRULES.length} rules`);
    const farbeOnly = find(TOP, 'html:not([data-tab="farbe"]) .rail-farbe-only'), formOnly = find(TOP, 'html:not([data-tab="form"]) .rail-form-only');
    check('.rail-farbe-only is hidden outside the Farbe tab (html:not([data-tab="farbe"]))', farbeOnly.length === 1 && /display:\s*none/.test(farbeOnly[0].body));
    check('.rail-form-only (new) is hidden outside the Form tab, right next to it', formOnly.length === 1 && /display:\s*none/.test(formOnly[0].body) && railCss.indexOf('.rail-form-only') > railCss.indexOf('.rail-farbe-only'));
    const farbeHide = TOP.filter(r => /display:\s*none/.test(r.body) && r.sel.some(s => s.startsWith('html[data-tab="farbe"] ')));
    const hiddenInFarbe = new Set(farbeHide.flatMap(r => r.sel.map(s => s.replace('html[data-tab="farbe"] ', '').replace(/^#/, ''))));
    // a group hidden as a whole, or a single control
    const ids = [...new Set(G.flatMap(g => g.ids))];
    const visible = tab => {
        const out = [];
        for (const g of G) {
            if (tab !== 'farbe' && /rail-farbe-only/.test(g.cls)) continue;
            if (tab === 'farbe' && hiddenInFarbe.has(g.id)) continue;
            const items = g.ids.filter(id => {
                const el = (rail.match(new RegExp('<(?:a|button)\\b[^>]*\\bid="' + id + '"[^>]*>')) || [''])[0];
                const cls = (el.match(/\bclass="([^"]*)"/) || [, ''])[1];
                if (tab !== 'farbe' && /rail-farbe-only/.test(cls)) return false;
                if (tab !== 'form' && /rail-form-only/.test(cls)) return false;
                if (tab === 'farbe' && hiddenInFarbe.has(id)) return false;
                return true;
            });
            if (items.length) out.push(items);
        }
        return out;
    };
    const flat = tab => visible(tab).map(g => g.join(' ')).join(' | ');
    check('Form: A | B | C (Formorgel, Paste Pattern) | D | E | More (More is the last item on the desktop through CSS order)', flat('form') === 'btn-undo btn-redo btn-random | btn-toggle-nodes btn-toggle-curve btn-toggle-faces | btn-more-rail | btn-gallery btn-paste-pattern | btn-info btn-save | btn-clear', flat('form'));
    check('Netz: as Form, without Paste Pattern', flat('netz') === 'btn-undo btn-redo btn-random | btn-toggle-nodes btn-toggle-curve btn-toggle-faces | btn-more-rail | btn-gallery | btn-info btn-save | btn-clear', flat('netz'));
    check('Farbe: points, fill | Farborgel (in the link\'s place) | info, download | the strategies | Reset Color; A, E, More, Curve and the Formorgel link are hidden', flat('farbe') === 'btn-toggle-nodes btn-toggle-faces | btn-farborgel | btn-info btn-save | btn-strategy-cyclic btn-strategy-area btn-strategy-symmetry btn-strategy-rings | btn-face-colors-reset', flat('farbe'));
    check('the Formorgel link is shown in Form and Netz, the Farborgel link only in Farbe; Paste Pattern only in Form', ['form', 'netz'].every(t => flat(t).includes('btn-gallery') && !flat(t).includes('btn-farborgel')) && flat('farbe').includes('btn-farborgel') && !flat('farbe').includes('btn-gallery') && flat('form').includes('btn-paste-pattern') && !flat('netz').includes('btn-paste-pattern') && !flat('farbe').includes('btn-paste-pattern'));
    check('Farbe still hides Undo, Redo, Random, Clear and More (as a whole group each: a hidden group leaves no gap)', ['rail-group-a', 'rail-group-e', 'rail-group-more'].every(id => hiddenInFarbe.has(id)) && hiddenInFarbe.has('btn-toggle-curve'));
});

console.log('\n== the CSS: order, spacing, links, phone ==');
T('layout', () => {
    // the order exceptions: DOM order = visual order everywhere except More on the desktop
    const orders = (rs) => rs.filter(r => /(^|;|\s)order\s*:/.test(r.body)).map(r => r.sel.join(','));
    check('on the tablet / desktop the ONLY rule with `order` is #rail-group-more (the last item); the Farbe `order: 1` of Info and Download is gone', JSON.stringify(orders(DRULES)) === JSON.stringify(['#rail-group-more']) && orders(TOP).length === 0, orders(DRULES).concat(orders(TOP)).join(' ; ') || 'none');
    check('...More\'s `order` is positive (it goes after every other group) and its margin is the rail gap, not the group gap, with no hairline', find(DRULES, '#rail-group-more').some(r => /order:\s*[1-9]/.test(r.body) && /margin-top:\s*var\(--rail-gap\)/.test(r.body)) && find(DRULES, '#rail-group-more::before').some(r => /display:\s*none/.test(r.body)));
    check('on the phone no group has an `order` (the rows are the wrappers; the canvas keeps order: 0)', JSON.stringify(orders(PRULES)) === JSON.stringify(['.canvas-row #canvas-container']), orders(PRULES).join(' ; ') || 'none');
    check('there is no per-button margin-top rule left: the spacing is on .rail-group (a gap inside, a margin above, a hairline in the margin)', !TOP.concat(DRULES, PRULES).some(r => r.sel.some(s => /^#btn-/.test(s) && !/::|:/.test(s)) && /margin-top/.test(r.body)) && find(TOP, '.rail-group').some(r => /flex-direction:\s*column/.test(r.body) && /gap:\s*var\(--rail-gap\)/.test(r.body) && /margin-top:\s*var\(--rail-group-gap\)/.test(r.body)) && find(DRULES, '.rail-group::before').some(r => /height:\s*1px/.test(r.body)));
    check('the first visible group has the row\'s top margin and no hairline: group A, and group B in the Farbe tab', find(DRULES, '#rail-group-a').some(r => /margin-top:\s*var\(--gap\)/.test(r.body)) && DRULES.some(r => r.sel.includes('html[data-tab="farbe"] #rail-group-b') && /margin-top:\s*var\(--gap\)/.test(r.body)) && DRULES.some(r => r.sel.includes('#rail-group-a::before') && r.sel.includes('html[data-tab="farbe"] #rail-group-b::before') && /display:\s*none/.test(r.body)));
    check('the wrappers are transparent on the desktop (display: contents: .rail-top, .rail-bm, .rail-bottom)', TOP.some(r => ['.rail-top', '.rail-bm', '.rail-bottom'].every(s => r.sel.includes(s)) && /display:\s*contents/.test(r.body)));
    // the links
    const btn = TOP.filter(r => r.sel.includes('.canvas-row .icon-btn'));
    check('.canvas-row .icon-btn is border-box with the --target size (an <a> is content-box: 48 + border made the links 50px)', btn.length === 1 && /box-sizing:\s*border-box/.test(btn[0].body) && /width:\s*var\(--target\)/.test(btn[0].body) && /height:\s*var\(--target\)/.test(btn[0].body));
    check('...and .icon-btn is display: flex in index.html (the links lay out like the buttons: flex, centred, same hover and active states)', /\n    \.icon-btn \{[^}]*display:\s*flex;[^}]*\}/.test(HTML) && /\.icon-btn:hover/.test(HTML) && /\.icon-btn\.active/.test(HTML));
    // the phone
    check('phone: .rail-left is display: contents; .rail-top and .rail-bottom are the rows (flex, wrap, 100% wide); .rail-bm keeps B and More together (flex: none)', find(PRULES, '.rail-left').some(r => /display:\s*contents/.test(r.body)) && PRULES.some(r => r.sel.includes('.rail-top') && r.sel.includes('.rail-bottom') && /display:\s*flex/.test(r.body) && /flex-wrap:\s*wrap/.test(r.body) && /flex:\s*0 0 100%/.test(r.body)) && find(PRULES, '.rail-bm').some(r => /display:\s*flex/.test(r.body) && /flex:\s*none/.test(r.body)));
    check('phone: a group is a row with the row gap and no margin; no extra gap between groups', find(PRULES, '.rail-group').some(r => /flex-direction:\s*row/.test(r.body) && /gap:\s*var\(--gap\)/.test(r.body) && /margin-top:\s*0/.test(r.body)));
    check('phone, Farbe: the rows are not forced (display: contents), so B, Farborgel and D share a line and the strategies the next', PRULES.some(r => r.sel.includes('html[data-tab="farbe"] .rail-top') && r.sel.includes('html[data-tab="farbe"] .rail-bottom') && /display:\s*contents/.test(r.body)));
    check('the rail CSS has no `flex-wrap` outside the phone block (the desktop rail, Farbe included, is one column with no wrap)', !TOP.concat(DRULES).some(r => /flex-wrap/.test(r.body)));
});

console.log('\n== wiring: no new binding, nothing moved out of reach ==');
T('wiring', () => {
    check('ui-rail.js has no p5 mousePressed binding and no select()', !/mousePressed|\bselect\(/.test(RAILJS));
    check('the rail markup has no inline handler (onclick and the like)', !/\son[a-z]+\s*=/.test(rail));
    check('no CSS rule restyles the rail by an id of a button that moved (#btn-clear, #btn-save, #btn-info, #btn-random)', !/#btn-(clear|save|info|random|undo|redo)\b/.test(railCss));
    check('every id the rail had before is still in the document exactly once', ['btn-undo', 'btn-redo', 'btn-clear', 'btn-random', 'btn-toggle-nodes', 'btn-toggle-curve', 'btn-toggle-faces', 'btn-info', 'btn-save', 'btn-more-rail', 'btn-gallery', 'btn-farborgel', 'btn-paste-pattern', 'btn-face-colors-reset', 'btn-strategy-cyclic', 'btn-strategy-area', 'btn-strategy-symmetry', 'btn-strategy-rings', 'farbe-strategy-group', 'farbe-harmony-select', 'paste-pattern-status'].every(id => (HTML.match(new RegExp('\\bid="' + id + '"', 'g')) || []).length === 1));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
