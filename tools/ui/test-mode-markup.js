/*
 * tools/ui/test-mode-markup.js - task 133: which controls the simple mode keeps (index.html data-level) and the CSS rule that hides the rest.
 * The two lists below ARE the inventory of the plan (_Plaene/A3-plan-basis-experten-modus.md, section 2, with the decisions F5 to F8): a control moves between
 * the modes by editing one list here and one data-level in index.html, nothing else.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.message)); process.exit(1); });

// ids that carry data-level="advanced" (hidden in simple at every width). #timeline-group has none: it is collapsed unless the Mehr of the (advanced) timeline strip is open.
const ADVANCED = ['btn-size-lock', 'nav-size-y-stepper', 'btn-more-form', 'btn-toggle-lines', 'line-weight-group', 'btn-paste-pattern', 'layer-table', 'layer-strip', 'layer-rail', 'timeline-strip', 'morph-group',
    'btn-open-dreieck', 'farbe-family-triangle', 'farbe-anchor-register-stepper', 'farbe-strategy-group', 'btn-farborgel', 'net-3c', 'btn-more-netz',
    'btn-toggle-curve', 'btn-toggle-free', 'btn-toggle-free-endpoints', 'btn-alternative-net', 'btn-restart', 'export-json', 'export-anim',
    'curve-fold-group', 'curve-strength-group', 'free-roughness-group', 'free-controls-group'];
// hidden from 768px up only (the phone sheet that holds the other buttons keeps its opener)
const WIDE = ['btn-more-rail'];
// ids that stay in simple: no data-level on them or on any ancestor
const SIMPLE = ['tab-form', 'tab-farbe', 'tab-netz', 'btn-help', 'btn-undo', 'btn-redo', 'btn-random', 'btn-toggle-nodes', 'btn-toggle-faces', 'btn-gallery', 'btn-info', 'btn-save', 'btn-clear',
    'nav-shapes', 'nav-node-stepper', 'node-count-input', 'nav-size-stepper', 'shape-size-input', 'nav-symmetry', 'btn-sym-rotation', 'btn-sym-mirror',
    'nav-anchor-views', 'btn-open-kreis', 'farbe-family-circle', 'btn-harmony-2', 'btn-harmony-3', 'btn-harmony-4', 'farbe-anchor-hue-stepper', 'farbe-anchor-hue-input', 'btn-face-colors-reset',
    'net-art-stepper', 'nav-kinds', 'net-strength-stepper', 'export-png', 'export-svg', 'export-overlay'];

const html = read('index.html');
// a tiny tag-stack parse: comments, scripts and styles out, then every start tag with its ancestors
const src = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const VOID = new Set(['input', 'br', 'img', 'hr', 'meta', 'link', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'use', 'stop']);
const nodes = {}, stack = [];
for (const m of src.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g)) {
    const [, close, tag, attrs, selfc] = m, t = tag.toLowerCase();
    if (close) { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === t) { stack.length = i; break; } continue; }
    const id = (/\bid="([^"]+)"/.exec(attrs) || [])[1], level = (/\bdata-level="([^"]+)"/.exec(attrs) || [])[1];
    const node = { tag: t, id, level, parent: stack[stack.length - 1] || null };
    if (id) nodes[id] = node;
    if (!VOID.has(t) && !selfc) stack.push(node);
}
const chain = n => { const out = []; for (let c = n; c; c = c.parent) if (c.level) out.push(c.level + '@' + (c.id || c.tag)); return out; };

check('the markup parse found the page (the controls of the three tabs)', ['nav-form', 'nav-farbe', 'nav-netz', 'layer-strip', 'timeline-strip'].every(i => nodes[i]), Object.keys(nodes).length + ' ids');
const missing = ADVANCED.filter(i => !nodes[i]);
check('every id of the ADVANCED list exists in index.html', missing.length === 0, missing.join(' '));
check('each of them carries data-level="advanced" itself', ADVANCED.every(i => nodes[i] && nodes[i].level === 'advanced'), ADVANCED.filter(i => !nodes[i] || nodes[i].level !== 'advanced').join(' '));
check('btn-more-rail carries data-level="advanced-wide" (hidden from 768px up only)', WIDE.every(i => nodes[i] && nodes[i].level === 'advanced-wide'));
const all = [...html.matchAll(/data-level="([^"]*)"/g)];
check('no other data-level value, and no data-level on an element outside the two lists', all.every(m => m[1] === 'advanced' || m[1] === 'advanced-wide') && all.length === ADVANCED.length + WIDE.length, all.length + ' of ' + (ADVANCED.length + WIDE.length));
const miss2 = SIMPLE.filter(i => !nodes[i]);
check('every id of the SIMPLE list exists in index.html', miss2.length === 0, miss2.join(' '));
const bad = SIMPLE.filter(i => nodes[i] && chain(nodes[i]).length);
check('no element of the SIMPLE list, and none of its ancestors, is marked', bad.length === 0, bad.map(i => i + ' <- ' + chain(nodes[i]).join(',')).join('; '));
check('the shapes (all three), Ordnung, Größe, Drehung, Spiegelung, Kreis 2/3/4, Anker Farbton, Netzart, Gesetz, Stärke are in the SIMPLE list (the plan, section 2.5)',
    ['nav-shapes', 'nav-node-stepper', 'nav-size-stepper', 'btn-sym-rotation', 'btn-sym-mirror', 'btn-harmony-2', 'btn-harmony-3', 'btn-harmony-4', 'farbe-anchor-hue-stepper', 'net-art-stepper', 'nav-kinds', 'net-strength-stepper'].every(i => SIMPLE.includes(i)));
check('no ancestor of an ADVANCED element is itself ADVANCED-marked twice over without need (a marked element inside a marked one is redundant)', ADVANCED.every(i => !chain(nodes[i].parent || { }).length));
const advCount = ADVANCED.length + WIDE.length;
check(`${advCount} marked elements, ${SIMPLE.length} listed simple ones`, advCount === 30 && SIMPLE.length >= 30);

console.log('\n== the CSS ==');
const css = read('style.css').replace(/\/\*[\s\S]*?\*\//g, '');
check('one rule hides [data-level="advanced"] under html[data-mode="simple"], at every width (not inside a media query), with display: none !important',
    /^html\[data-mode="simple"\] \[data-level="advanced"\] \{ display: none !important; \}/m.test(css));
const wide = /@media \(min-width: 768px\) \{\s*html\[data-mode="simple"\] \[data-level="advanced-wide"\] \{ display: none !important; \}\s*\}/.test(css);
check('one rule hides [data-level="advanced-wide"] from 768px up only', wide);
const at = css.indexOf('html[data-mode="simple"] [data-level="advanced"]'), phoneStart = css.indexOf('@media (max-width: 767px)');
check('the rules come before the phone and surface blocks (the tools/ui/test-phone-config.js regions are not touched) and never mention html.ph', at > 0 && at < css.indexOf('html.ph') && !/html\[data-mode[^{]*\.ph/.test(css), phoneStart);
check('the mode selector appears in no other rule yet (the layout work comes in its own commit)', (css.match(/html\[data-mode=/g) || []).length === 2);

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? 'PASS' : 'FAIL');
process.exit(failures === 0 ? 0 : 1);
