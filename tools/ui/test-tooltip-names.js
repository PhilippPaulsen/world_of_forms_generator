// Guard for the tooltips and the control names (tooltips step 1): the REAL ui.js in a vm (UI.name and UI.setDisabled), then the source text of style.css, index.html and sketch.js. No browser.
//   node tools/ui/test-tooltip-names.js
//   UI_JS=... STYLE_CSS=... INDEX_HTML=... SKETCH_JS=... node tools/ui/test-tooltip-names.js        (sabotage runs)
//
// Why. A button showed TWO tooltips on a mouse hover: the browser's native title tooltip and a black CSS bubble (.icon-btn[title]:hover::after). The bubble is gone; the native
// title is the one tooltip. A title is also the only name many icon-only buttons had (an accessible name falls back to the title), and a title is a description for assistive
// technology, not the name. So: a control with NO visible text of its own (an icon, a glyph such as x or an arrow, an unlabelled field) has an aria-label with the text of
// its title (UI.name sets both); a control WITH visible text is named by that text, keeps its title as a description and gets no aria-label (WCAG 2.5.3, label in name).
// UI.setDisabled swaps the title for the reason on a disabled control and must never touch the aria-label: the name survives every disable / enable.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const UI_SRC = read('UI_JS', 'ui.js');
const CSS = read('STYLE_CSS', 'style.css');
const HTML = read('INDEX_HTML', 'index.html');
const SKETCH = read('SKETCH_JS', 'sketch.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 120)); } };

// ---- 1. behaviour: the real ui.js, a fake element ---------------------------------------------------------------------------------------------------------------
function makeEl(attrs) {
    const a = Object.assign({}, attrs || {}), writes = [];
    return {
        dataset: {}, writes,
        getAttribute: k => (k in a ? a[k] : null),
        setAttribute: (k, v) => { writes.push(k); a[k] = String(v); },
        removeAttribute: k => { delete a[k]; },
        addEventListener() { },
    };
}
function loadUI() {
    const document = { visibilityState: 'visible', getElementById: () => null, addEventListener() { } };
    const ctx = vm.createContext({ document, console, Event: class { }, MutationObserver: class { observe() { } }, setTimeout, clearTimeout, setInterval, clearInterval, performance: { now: () => 0 } });
    ctx.window = ctx;
    vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    return ctx.UI;
}

console.log('== UI.name and UI.setDisabled ==');
T('ui', () => {
    const UI = loadUI();
    check('UI.name exists', typeof UI.name === 'function');

    const el = makeEl();
    UI.name(el, 'Undo');
    check('UI.name sets the title and the aria-label to the same text', el.getAttribute('title') === 'Undo' && el.getAttribute('aria-label') === 'Undo');
    const n = el.writes.length; UI.name(el, 'Undo');
    check('UI.name with the same text writes nothing (it runs on every frame for the Play / Pause buttons)', el.writes.length === n, el.writes.length - n + ' writes');
    UI.name(el, 'Pause');
    check('UI.name with a new text replaces both', el.getAttribute('title') === 'Pause' && el.getAttribute('aria-label') === 'Pause');
    check('UI.name(null, ...) does nothing and does not throw', (() => { try { UI.name(null, 'x'); UI.name(undefined, 'x'); return true; } catch (e) { return false; } })());

    // an aria-label set BEFORE disabling survives disable, enable and a second disable unchanged; the title switches between the name and the reason
    const b = makeEl({ title: 'Toggle Curve', 'aria-label': 'Toggle Curve' });
    const seq = [];
    const snap = tag => seq.push({ tag, title: b.getAttribute('title'), aria: b.getAttribute('aria-label'), disabled: b.getAttribute('aria-disabled') });
    snap('start');
    UI.setDisabled(b, 'Off while a net transform is active'); snap('disabled');
    UI.setDisabled(b, null); snap('enabled');
    UI.setDisabled(b, 'Off while a net transform is active'); snap('disabled again');
    UI.setDisabled(b, null); snap('enabled again');
    check('the aria-label is the same at every step: before, disabled, enabled, disabled again, enabled again', seq.every(s => s.aria === 'Toggle Curve'), seq.map(s => s.aria).join(' | '));
    check('the title is the name, then the reason, then the name, then the reason, then the name', seq.map(s => s.title).join('|') === ['Toggle Curve', 'Off while a net transform is active', 'Toggle Curve', 'Off while a net transform is active', 'Toggle Curve'].join('|'), seq.map(s => s.title).join(' | '));
    check('aria-disabled is set while the reason shows and removed after', seq.map(s => s.disabled).join('|') === [null, 'true', null, 'true', null].join('|'));
    check('the aria-label is never written by setDisabled (no write to it after the start)', (() => { const c = makeEl({ title: 'N', 'aria-label': 'N' }); UI.setDisabled(c, 'why'); UI.setDisabled(c, null); UI.setDisabled(c, 'why2'); return !c.writes.includes('aria-label'); })());

    // a new name while a reason is showing: the title stays the reason, the new name comes back on enable
    const d = makeEl({ title: 'Play', 'aria-label': 'Play' });
    UI.setDisabled(d, 'No keyframes yet');
    UI.name(d, 'Pause');
    check('UI.name on a control that shows a reason: the title stays the reason, the aria-label is the new name', d.getAttribute('title') === 'No keyframes yet' && d.getAttribute('aria-label') === 'Pause');
    UI.setDisabled(d, null);
    check('...and on enable the title is the new name, not the old one', d.getAttribute('title') === 'Pause' && d.getAttribute('aria-label') === 'Pause', d.getAttribute('title'));
});

// ---- 2. source text -------------------------------------------------------------------------------------------------------------------------------------------
const inline = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('\n== no CSS tooltip: the native title is the one tooltip ==');
for (const [name, text] of [['style.css', CSS], ['index.html inline <style>', inline]]) {
    const c = strip(text);
    check(`${name}: no rule shows the title as generated content (content: attr(...))`, !/content\s*:\s*attr\(/.test(c));
    check(`${name}: no rule selects on [title] or data-tooltip`, !/\[\s*title\b/.test(c) && !/data-tooltip/.test(c));
    check(`${name}: no .icon-btn:hover::after bubble`, !/\.icon-btn[^{]*:hover[^{]*::after/.test(c) && !/\.icon-btn[^{]*::after[^{]*:hover/.test(c));
}

console.log('\n== index.html: every control without visible text has an aria-label ==');
{
    const blank = re => m => m.replace(/[^\n]/g, ' ');   // comments first: a comment may mention <script> tags
    const body = HTML.replace(/<!--[\s\S]*?-->/g, blank()).replace(/<script[\s\S]*?<\/script>/g, blank()).replace(/<style[\s\S]*?<\/style>/g, blank());
    const lineOf = i => body.slice(0, i).split('\n').length;
    const labelFor = new Set([...body.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(m => m[1]));
    const iconOnly = [], iconNamed = [], textTitle = [];
    for (const m of body.matchAll(/<(button|a)\b([^>]*)>/g)) {
        const end = body.indexOf('</' + m[1] + '>', m.index + m[0].length);
        const inner = body.slice(m.index + m[0].length, end).replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
        const attrs = m[2], hasName = /\baria-label(ledby)?="[^"]+"/.test(attrs);
        const id = (attrs.match(/\bid="([^"]+)"/) || [])[1] || (attrs.match(/\bclass="([^"]+)"/) || [])[1] || m[1];
        if (!inner) { (hasName ? iconNamed : iconOnly).push(`${id}@${lineOf(m.index)}`); }
        else if (/\btitle="/.test(attrs)) textTitle.push({ id, hasAria: /\baria-label="/.test(attrs), line: lineOf(m.index) });
    }
    check('the scan found the icon-only buttons and links (not an empty result)', iconNamed.length >= 40, iconNamed.length + ' named');
    check('every <button> / <a> with no visible text (an icon) has an aria-label', iconOnly.length === 0, iconOnly.length ? 'WITHOUT: ' + iconOnly.join(', ') : iconNamed.length + ' icon-only controls, all named');

    const fields = [];
    for (const m of body.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
        const attrs = m[2], type = (attrs.match(/\btype="([^"]+)"/) || [, 'text'])[1];
        if (type === 'hidden' || /\bhidden\b(?!=)/.test(attrs.replace(/"[^"]*"/g, '""')) && /aria-hidden="true"/.test(attrs) || /display\s*:\s*none/.test(attrs)) continue;   // a state carrier: hidden and aria-hidden, or display:none (the stepper's range input, the canvas size slider)
        const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
        const wrapped = (() => { const before = body.slice(0, m.index); return before.lastIndexOf('<label') > before.lastIndexOf('</label>'); })();
        fields.push({ id: id || '(no id)', named: /\baria-label(ledby)?="[^"]+"/.test(attrs) || (id && labelFor.has(id)) || wrapped, line: lineOf(m.index) });
    }
    const unnamed = fields.filter(f => !f.named);
    check('the scan found the form fields', fields.length >= 8, fields.length + ' fields');
    check('every input / select has an aria-label or a <label>', unnamed.length === 0, unnamed.length ? 'WITHOUT: ' + unnamed.map(f => f.id + '@' + f.line).join(', ') : fields.length + ' fields, all named');

    const titled = [];
    for (const m of body.matchAll(/<(span|div|img|svg|p|h[1-6])\b([^>]*\btitle="[^"]*"[^>]*)>/g)) {
        const end = body.indexOf('</' + m[1] + '>', m.index + m[0].length);
        const inner = body.slice(m.index + m[0].length, end).replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
        if (!inner && !/\baria-label="[^"]+"/.test(m[2])) titled.push(`${m[1]}@${lineOf(m.index)}`);
    }
    check('no empty element (a colour swatch) carries only a title: it has role="img" and an aria-label', titled.length === 0, titled.join(', ') || 'none');
    check('the three anchor-preview swatches are role="img" with an aria-label', ['farbe-anchor-preview', 'farbe-anchor-preview-kreis', 'farbe-anchor-preview-dreieck'].every(id => new RegExp('<span id="' + id + '"[^>]*\\brole="img"[^>]*\\baria-label="Anker-Vorschau"').test(body)));

    // controls with visible text: named by the text; the title is a description and there is NO aria-label (the harmony and net buttons that already had a label of their own are not in this list)
    const TEXT_BUTTONS = ['btn-layer-base', 'btn-add-layer', 'btn-paste-pattern', 'btn-add-to-timeline', 'btn-timeline-include-net', 'btn-remove-timeline', 'btn-align-to-base', 'btn-mesh-preset-x', 'btn-mesh-preset-y',
        'btn-compute-cross-layer', 'export-png', 'export-json', 'export-svg', 'net-field-btn', 'net-lines-btn', 'net-reverse-btn', 'net-alternate-btn', 'btn-fold-3', 'btn-fold-6'];
    const found = TEXT_BUTTONS.map(id => textTitle.find(t => t.id === id));
    check('the text buttons with a title are all found (the list is current)', found.every(Boolean), TEXT_BUTTONS.filter((id, i) => !found[i]).join(', ') || TEXT_BUTTONS.length + ' buttons');
    check('...and none of them has an aria-label: the visible text is the name, the title the description', found.filter(Boolean).every(t => !t.hasAria), found.filter(t => t && t.hasAria).map(t => t.id).join(', ') || 'none');
}

console.log('\n== sketch.js: the dynamic title sites ==');
{
    const code = SKETCH.split('\n').map(l => l.replace(/^\s*\/\/.*$/, ''));
    const sites = [];
    code.forEach((l, i) => { if (/\.title\s*=[^=]|\.attribute\(\s*'title'|setAttribute\(\s*'title'|dataset\.title\s*=/.test(l)) sites.push({ line: i + 1, text: l.trim() }); });
    // raw title sites that are allowed to stay: a control with visible text (the title is a description), a disabled reason, a span that is not a control
    const ALLOWED = [
        [/^b\.title = smooth \?/, 'macro cell button: visible text (4x2)'],
        [/^locked\.forEach\(b => \{ b\.elt\.dataset\.title = b\.elt\.title; \}\);/, 'remembers the static title of the Curve / Free / Face buttons'],
        [/^fieldBtn\.elt\.title = fieldOk \?/, 'Field: visible text, the reason when it is not available'],
        [/^\[curveBtn, freeBtn\][\s\S]*b\.elt\.title = active \?/, 'Curve / Free: the reason while a net transform is active; the name is the static aria-label'],
        [/^faceBtn\.elt\.title = /, 'Face fill: the reason; the name is the static aria-label'],
        [/^fieldBtn\.elt\.dataset\.title = fieldBtn\.elt\.title;/, 'restores the Field title'],
        [/^includeNetBtn\.attribute\('title'/, 'Include net: visible text'],
        [/^alignBtn\.attribute\('title'/, 'Align to base: visible text'],
        [/^btn\.title = 'Edit Layer '/, 'layer tab: visible text "Layer 2"'],
        [/^netBtn\.title = /, 'timeline keyframe "Net": visible text'],
        [/^countEl\.title = /, 'the "2/5" counter: a span that is not a control, its text is its content'],
        [/^btn\.title = cand\.orientation/, 'pairing candidate row: visible text'],
        [/^addToTimelineBtn\.attribute\('title'/, 'Add to Timeline: visible text'],
    ];
    const stray = sites.filter(s => !ALLOWED.some(([re]) => re.test(s.text)));
    check('the scan found the raw title sites (not an empty result)', sites.length >= 12, sites.length + ' sites');
    check('every raw title assignment in sketch.js is a control with visible text, a disabled reason or a non-control span (a new one must be decided: icon-only -> UI.name, text -> add it here)', stray.length === 0, stray.length ? stray.map(s => s.line + ': ' + s.text.slice(0, 70)).join(' | ') : sites.length + ' sites, all allowed');
    const unused = ALLOWED.filter(([re]) => !sites.some(s => re.test(s.text)));
    check('...and every entry of that list still exists (no stale entries)', unused.length === 0, unused.map(u => u[1]).join('; ') || 'none');

    const NAMED = [
        [/UI\.name\(animPlayBtn\.elt, playing \? 'Pause' : 'Play'\)/, 'layer animation Play / Pause'],
        [/UI\.name\(timelinePlayBtn\.elt, playing \? 'Pause' : 'Play'\)/, 'timeline Play / Pause'],
        [/UI\.name\(checkbox, 'Show\/Hide Layer '/, 'layer checkbox'],
        [/UI\.name\(removeBtn, 'Remove Layer '/, 'remove layer (x)'],
        [/UI\.name\(removeBtn, `Remove Layer \$\{layerIndex \+ 1\} from the timeline/, 'remove keyframe (x)'],
        [/UI\.name\(up, 'Swap this End assignment with the row above'\)/, 'End row up'],
        [/UI\.name\(down, 'Swap this End assignment with the row below'\)/, 'End row down'],
        [/UI\.name\(flip, flipped \?/, 'End row reverse'],
        [/UI\.name\(prevBtn, 'Previous variant/, 'previous variant'],
        [/UI\.name\(nextBtn, 'Next variant/, 'next variant'],
        [/UI\.name\(b, title\);/, 'face colour stepper (the two arrows)'],
    ];
    const missing = NAMED.filter(([re]) => !re.test(SKETCH));
    check('the icon-only and glyph-only dynamic controls are named with UI.name (title and aria-label together)', missing.length === 0, missing.map(m => m[1]).join(', ') || NAMED.length + ' sites');
    check('none of them sets a raw title any more', !/\b(removeBtn|checkbox|up|down|flip|prevBtn|nextBtn)\.title\s*=[^=]/.test(SKETCH) && !/(animPlayBtn|timelinePlayBtn)\.attribute\('title'/.test(SKETCH));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
