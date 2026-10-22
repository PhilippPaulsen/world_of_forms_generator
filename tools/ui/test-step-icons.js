// Guard for the stepper arrows (phone layout, commit 5): no emoji-prone triangle characters in the app, and the SVG chevrons that replace them. The Node test of a source tree: no browser.
//   node tools/ui/test-step-icons.js
//   SKETCH_JS=... node tools/ui/test-step-icons.js        (sabotage runs)
//
// Why. iOS draws U+25C0 (left-pointing triangle) and U+25B6 (right-pointing triangle) as blue emoji squares: the previous / next buttons of the pairing editor's variant stepper and of the Face Colors
// per-trail stepper (both built in sketch.js) showed them. They are inline SVG chevrons now (sketch.js pairingStepIcon(): the UI's 20px icon style, stroke and currentColor, aria-hidden, focusable false;
// the box is as wide as the old glyph, 13px and 11.45px, so the buttons keep their size). The name stays on the button (UI.name: aria-label and title), the handlers are the old ones.
// Not changed on purpose: the up / down triangles U+25B2 and U+25BC of the pairing editor's row buttons (they are not emoji characters: grey text on iOS).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };

// ---- 1. the app's markup and scripts: no left / right pointing triangle in any spelling ----------------------------------------------------------------------------------------------------------
// The app = every .html / .js / .mjs / .css file outside tools/, docs/, node_modules and .git (the tests, the notes and the data are not what a phone renders). ALLOWED EXCEPTIONS: none for U+25C0 / U+25B6.
// (Allowed and listed: U+25B2 and U+25BC, the two row buttons of the pairing editor in sketch.js; they are not emoji.)
function walk(dir, out) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.git' || (dir === ROOT && (e.name === 'tools' || e.name === 'docs'))) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out); else if (/\.(html|js|mjs|css)$/.test(e.name)) out.push(p);
    }
    return out;
}
const SPELLINGS = [/\u25C0/, /\u25B6/, /\\u\{?25c0\}?/i, /\\u\{?25b6\}?/i, /&#x?0*(25c0|9664);?/i, /&#x?0*(25b6|9654);?/i, /\\0*25c0(?![0-9a-f])/i, /\\0*25b6(?![0-9a-f])/i];
const EXCEPTIONS = {};   // file -> number of lines allowed to hold one (none)
T('scan', () => {
    const files = walk(ROOT, []);
    const hits = [];
    // the sabotage runs replace sketch.js through SKETCH_JS: that text is scanned in place of the file
    for (const f of files) {
        const rel = path.relative(ROOT, f);
        const text = rel === 'sketch.js' ? SKETCH : fs.readFileSync(f, 'utf8');
        text.split('\n').forEach((l, i) => { if (SPELLINGS.some(re => re.test(l))) hits.push(rel + ':' + (i + 1)); });
    }
    const allowed = hits.filter(h => EXCEPTIONS[h.split(':')[0]]);
    check('no file of the app (' + files.length + ' .html / .js / .mjs / .css files) spells U+25C0 or U+25B6: as a character, \\u25C0, \\u{25C0}, &#9664; / &#x25C0;, or a CSS escape; allowed exceptions: none', hits.length - allowed.length === 0, hits.join(', ') || 'none found');
    const tri = (SKETCH.match(/\\u25B2|\\u25BC/g) || []).length;
    check('the up / down triangles U+25B2 / U+25BC stay as text (not emoji): exactly the two row buttons of the pairing editor, in sketch.js', tri === 2 && /up\.textContent = '\\u25B2'/.test(SKETCH) && /down\.textContent = '\\u25BC'/.test(SKETCH));
});

// ---- 2. the helper ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function extract(src, head) {
    const i = src.indexOf(head);
    if (i < 0) return '';
    let d = 0, j = src.indexOf('{', i);
    for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
    return '';
}
const HELPER = extract(SKETCH, 'function pairingStepIcon(');
T('helper', () => {
    check('sketch.js has ONE helper pairingStepIcon(dir), a top-level function (defined where the row builders live, before faceColorsStepper) and its name is not a p5 member', HELPER.length > 100 && (SKETCH.match(/function pairingStepIcon\(/g) || []).length === 1 && SKETCH.indexOf('function pairingStepIcon(') < SKETCH.indexOf('function faceColorsStepper(') && !/^(create|arrow|line)/i.test('pairingStepIcon'));
    const ctx = vm.createContext({}); vm.runInContext(HELPER, ctx);
    const icon = d => vm.runInContext('pairingStepIcon(' + JSON.stringify(d) + ')', ctx);
    const parse = s => { const a = {}; (s.match(/\s([A-Za-z-]+)="([^"]*)"/g) || []).forEach(x => { const m = /\s([A-Za-z-]+)="([^"]*)"/.exec(x); a[m[1]] = m[2]; }); return a; };
    for (const [dir, w, cx, path] of [['left', 13, 11.5, 'M15 5 L8 12 L15 19'], ['right', 11.45, 12.5, 'M9 5 L16 12 L9 19']]) {
        const s = icon(dir), a = parse(s), vb = (a.viewBox || '').split(' ').map(Number);
        check(`${dir}: an inline <svg> in the 20px icon style: height 20, stroke currentColor, fill none, stroke-width 2, aria-hidden="true", focusable="false", the chevron path, no text node`, /^<svg /.test(s) && /<\/svg>$/.test(s) && a.height === '20' && a.stroke === 'currentColor' && a.fill === 'none' && a['stroke-width'] === '2' && a['aria-hidden'] === 'true' && a.focusable === 'false' && s.includes('d="' + path + '"') && !/>[^<]+</.test(s.replace(/<path[^>]*\/>/, '')), s);
        check(`${dir}: the box is ${w}px wide (the old glyph's width: the button keeps its size) and the viewBox is centred on the chevron (centre ${cx})`, Number(a.width) === w && Math.abs(vb[0] + vb[2] / 2 - cx) < 0.01 && Math.abs(vb[2] - w * 1.2) < 0.01 && vb[1] === 0 && vb[3] === 24, a.width + ' / ' + a.viewBox);
    }
    check('the helper returns markup only (no U+25C0 / U+25B6, no title or label of its own: the button has the name)', !/[\u25C0\u25B6]/.test(icon('left') + icon('right')) && !/aria-label|<title/.test(icon('left') + icon('right')));
});

// ---- 3. the four spots ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
T('spots', () => {
    check('the pairing variant stepper: prevBtn and nextBtn get innerHTML = pairingStepIcon("left" / "right") (not textContent); classes, UI.name and the click handlers are the old ones', /prevBtn\.className = 'layer-btn pairing-move-btn pairing-variant-prev';\s*prevBtn\.innerHTML = pairingStepIcon\('left'\);\s*UI\.name\(prevBtn, 'Previous variant of this End line[^']*(\\'[^']*)*'\);\s*prevBtn\.addEventListener\('click', \(\) => \{\s*const v = variants\[\(vIdx - 1 \+ vCount\) % vCount\];\s*setTimelineMember\(seg, endIdx, v\.g, v\.f\);/.test(SKETCH) && /nextBtn\.className = 'layer-btn pairing-move-btn pairing-variant-next';\s*nextBtn\.innerHTML = pairingStepIcon\('right'\);\s*UI\.name\(nextBtn, 'Next variant of this End line[^']*(\\'[^']*)*'\);\s*nextBtn\.addEventListener\('click', \(\) => \{\s*const v = variants\[\(vIdx \+ 1\) % vCount\];\s*setTimelineMember\(seg, endIdx, v\.g, v\.f\);/.test(SKETCH));
    check('the Face Colors stepper: faceColorsStepper() builds its buttons with innerHTML = pairingStepIcon(...) and is called with "left" and "right"; UI.name(b, title) and the click handler (onStep(delta)) are the old ones', /const mk = \(txt, delta\) => \{\s*const b = document\.createElement\('button'\);\s*b\.className = 'layer-btn pairing-move-btn';\s*b\.innerHTML = pairingStepIcon\(txt\);\s*UI\.name\(b, title\);\s*b\.addEventListener\('click', \(\) => onStep\(delta\)\);/.test(SKETCH) && /wrap\.appendChild\(mk\('left', -1\)\);\s*wrap\.appendChild\(cnt\);\s*wrap\.appendChild\(mk\('right', 1\)\);/.test(SKETCH));
    // run faceColorsStepper with a small fake DOM: two buttons, an icon in each, no text, a name, a click that steps
    const fn = extract(SKETCH, 'function faceColorsStepper(');
    const made = [];
    const mkEl = tag => { const e = { tag, className: '', innerHTML: '', textContent: '', dataset: {}, children: [], handlers: {}, appendChild(c) { this.children.push(c); return c; }, addEventListener(t, f) { this.handlers[t] = f; } }; made.push(e); return e; };
    const named = [], steps = [];
    const ctx = vm.createContext({ document: { createElement: mkEl }, UI: { name: (el, t) => named.push([el, t]) }, pairingStepIcon: new Function(HELPER + '\nreturn pairingStepIcon;')() });
    vm.runInContext(fn + '\nthis.faceColorsStepper = faceColorsStepper;', ctx);
    const wrap = ctx.faceColorsStepper(1, 3, 'Pick another color', d => steps.push(d));
    const btns = wrap.children.filter(c => c.tag === 'button');
    check('faceColorsStepper(): two buttons, the first holds the left chevron and the second the right one (SVG, no text), both are named (UI.name) and step -1 / +1 on a click', btns.length === 2 && /^<svg /.test(btns[0].innerHTML) && /^<svg /.test(btns[1].innerHTML) && btns[0].innerHTML.includes('M15 5 L8 12 L15 19') && btns[1].innerHTML.includes('M9 5 L16 12 L9 19') && btns.every(b => b.textContent === '') && named.length === 2 && named.every(n => n[1] === 'Pick another color') && (btns[0].handlers.click(), btns[1].handlers.click(), steps.join() === '-1,1'));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
