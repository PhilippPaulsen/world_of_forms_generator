// Guard for the cleanup that removed the old layer, timeline and message DOM (steps 1 to 4): what is gone stays gone, what is kept stays, the mechanisms that were deliberately left stay. Source
// text of index.html, style.css and every script of the app (not tools/). No browser.
//   node tools/ui/test-cleanup.js
//   INDEX_HTML=... STYLE_CSS=... SKETCH_JS=... EXTRA_FILE=<a js or html file that is scanned as well> node tools/ui/test-cleanup.js        (sabotage runs)
//
// What it pins.
//   1. Every REMOVED id (and the two removed classes) is absent from index.html, style.css and every .js / .mjs / .html file of the app outside tools/ and node_modules - comments included,
//      so a later edit cannot bring one back by accident. Each entry says where it lived.
//   2. sketch.js and the ui scripts do not select, look up or query a removed id (select, selectAll, optionalSelect, getElementById, querySelector).
//   3. Every KEPT id is in index.html exactly once: the layer "Mehr" wrapper with its ten groups and their controls, the timeline group (the keyframe list, the net status, the pairing editor, the
//      status line, "Zeitleiste entfernen"), the layer table, rail and strip, the timeline strip, the notices, the dialogs, the Netz sheet's notes that are still written, Paste Pattern.
//   4. The kept CSS is still there (.layer-btn, .layer-tab and .layer-remove-btn - the keyframe list uses them -, the group's collapsed rule, #timeline-net-state, #layer-more-panel, .legacy-controls).
//   5. The mechanisms that were deliberately kept stay (the maintainer's decision: UI removed, mechanism kept; ask before deleting): the net animation functions and hooks, updateCrossLayerStatus,
//      the layer animation functions and their null-safe selects, the old symmetry mode and fold buttons (.legacy-controls) and their handlers, renderLayerTabs as an empty function.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css'), SKETCH = read('SKETCH_JS', 'sketch.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 160)); } };

// the app's files: every .js / .mjs / .html outside tools/, node_modules, .git; index.html, style.css and sketch.js may come from the environment (sabotage runs)
function walk(dir, out) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'tools' || e.name === 'docs') continue;
        const f = path.join(dir, e.name);
        if (e.isDirectory()) walk(f, out);
        else if (/\.(js|mjs|html)$/.test(e.name) && !/\.test\.mjs$/.test(e.name) && !/^test(\.mjs)?$/.test(e.name)) out.push(f);
    }
    return out;
}
const FILES = walk(ROOT, []).map(f => ({ name: path.relative(ROOT, f), text: f === path.join(ROOT, 'index.html') ? HTML : f === path.join(ROOT, 'sketch.js') ? SKETCH : fs.readFileSync(f, 'utf8') }));
if (process.env.EXTRA_FILE) FILES.push({ name: 'EXTRA:' + path.basename(process.env.EXTRA_FILE), text: fs.readFileSync(process.env.EXTRA_FILE, 'utf8') });
const mentions = (text, token) => new RegExp('(^|[^A-Za-z0-9_-])' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^A-Za-z0-9_-])').test(text);

// id (or class), where it lived
const REMOVED = [
    ['layer-row-group', 'index.html: the control group of the old layer row'],
    ['layer-row', 'index.html: the old layer row (Base, the tabs, "+ Layer")'],
    ['btn-layer-base', 'index.html: the old Base button'],
    ['layer-tabs', 'index.html: the span the old layer tabs were built into'],
    ['btn-add-layer', 'index.html: the old "+ Layer" button'],
    ['paste-pattern-status', 'index.html: the old Paste Pattern status line (its messages are notices)'],
    ['layer-more-row', 'index.html: the old row of the layer "Mehr" toggle'],
    ['btn-more-layer', 'index.html: the old layer "Mehr" toggle (the "..." of the layer views replaced it)'],
    ['layer-node-count-note', 'index.html: the layer node-count limit note (a notice now)'],
    ['align-to-base-status', 'index.html: the Align to base status span (a notice now)'],
    ['btn-add-to-timeline', 'index.html: the old Add to Timeline button (the diamonds replaced it)'],
    ['btn-timeline-include-net', 'index.html: the old Include net button (the strip\'s switch replaced it)'],
    ['btn-remove-timeline', 'index.html: the old Remove Timeline button ("Zeitleiste entfernen" replaced it)'],
    ['timeline-playback-controls', 'index.html: the old Play row'],
    ['btn-timeline-play', 'index.html: the old Play button (the strip\'s Play replaced it)'],
    ['timeline-progress-input', 'index.html: the old progress slider (the strip\'s scrub bar replaced it)'],
    ['timeline-net-warning', 'index.html: the Include net warning text (the dot and the title of the strip\'s switch replaced it)'],
    ['net-free-note', 'index.html: the free-endpoint note of the Netz sheet (a notice now)'],
    ['net-field-note', 'index.html: the Field note of the Netz sheet (a notice now)'],
    ['net-macro-note', 'index.html: the Macro note of the Netz sheet (a notice now)'],
    ['net-locks-note', 'index.html: the long net-lock note under the canvas (reasons on the controls since commit 11)'],
    ['node-count-note', 'index.html: the second fixed toast that overlapped the stack (notices since commit 10)'],
    ['layer-enable-checkbox', 'style.css and sketch.js: the class of the old layer tab\'s checkbox (the eye replaced it)'],
    ['limit-note', 'style.css and index.html: the class of the note spans'],
];

console.log('== what was removed is gone ==');
T('absent', () => {
    const hits = [];
    FILES.forEach(f => REMOVED.forEach(([id]) => { if (mentions(f.text, id)) hits.push(f.name + ': ' + id); }));
    check('none of the ' + REMOVED.length + ' removed ids / classes is mentioned in index.html, any other .html, or any .js / .mjs of the app (' + FILES.length + ' files, comments included)', hits.length === 0, hits.slice(0, 8).join(', ') || REMOVED.length + ' absent');
    const cssHits = REMOVED.filter(([id]) => mentions(CSS, id)).map(r => r[0]);
    check('none of them is in style.css (no rule, no selector, no comment)', cssHits.length === 0, cssHits.join(', ') || 'none');
    check('the ids the old rules used are not left in index.html\'s inline styles either (#layer-tabs, .layer-enable-checkbox, .limit-note, #btn-timeline-include-net ...)', !/#layer-tabs|layer-enable-checkbox|\.limit-note|#btn-timeline-include-net|#btn-add-to-timeline|#layer-row|#layer-more-row/.test(HTML));
    check('every removed entry says where it lived (the list is documentation: ' + REMOVED.length + ' entries, each with a place)', REMOVED.every(r => r.length === 2 && r[1].length > 10));
});
T('not selected', () => {
    const script = FILES.filter(f => f.name === 'sketch.js' || /^ui[-.].*\.js$/.test(f.name) || f.name === 'nav.js' || f.name.startsWith('EXTRA:'));
    const bad = [];
    script.forEach(f => REMOVED.forEach(([id]) => { if (new RegExp("(select|selectAll|optionalSelect|getElementById|querySelector|querySelectorAll|closest)\\(\\s*['\"`]#?\\.?" + id.replace(/[-]/g, '\\-') + "\\b").test(f.text)) bad.push(f.name + ': ' + id); }));
    check('sketch.js and the ui scripts select, look up or query none of the removed ids (select, selectAll, optionalSelect, getElementById, querySelector, closest)', bad.length === 0, bad.join(', ') || script.length + ' scripts');
    check('the ui scripts that exist are all scanned (sketch.js, ui.js, ui-form.js, ui-layer.js, ui-layers.js, ui-net.js, ui-rail.js, ui-timeline.js, ui-farbe.js, nav.js)', ['sketch.js', 'ui.js', 'ui-form.js', 'ui-layer.js', 'ui-layers.js', 'ui-net.js', 'ui-rail.js', 'ui-timeline.js', 'ui-farbe.js', 'nav.js'].every(n => FILES.some(f => f.name === n)));
});

console.log('\n== what was kept is still there ==');
T('kept ids', () => {
    const KEPT = [
        'layer-more-panel', 'layer-shape-group', 'layer-node-count-group', 'layer-shape-size-group', 'layer-mode-group', 'layer-fold-group', 'layer-align-group', 'layer-offset-x-group',
        'layer-offset-y-group', 'layer-mesh-preset-group', 'layer-rotation-group',
        'layer-node-count-input', 'layer-shape-size-input', 'btn-align-to-base', 'btn-mesh-preset-x', 'btn-mesh-preset-y', 'layer-offset-x-input', 'layer-offset-y-input', 'layer-rotation-input',
        'timeline-group', 'btn-clear-timeline', 'timeline-keyframe-list', 'timeline-net-state', 'timeline-status', 'timeline-pairing', 'timeline-pairing-segment', 'timeline-pairing-list',
        'timeline-pairing-metric', 'btn-timeline-pairing-reset', 'btn-timeline-pairing-browse', 'timeline-pairing-browser', 'timeline-pairing-sort', 'timeline-pairing-filter',
        'timeline-pairing-browser-count', 'timeline-pairing-browser-list',
        'layer-table', 'layer-rail', 'layer-strip', 'timeline-strip', 'ui-notices', 'layer-remove-overlay', 'timeline-confirm-overlay',
        'net-group', 'net-field-btn', 'net-field-info', 'net-field-hint', 'net-macro-hint', 'net-focus-hint', 'net-size-hint',
        'btn-paste-pattern',
    ];
    const count = id => (HTML.match(new RegExp('\\bid="' + id + '"', 'g')) || []).length;
    const bad = KEPT.filter(id => count(id) !== 1);
    check('every one of the ' + KEPT.length + ' kept ids is in index.html exactly once (the layer "Mehr" wrapper, its groups and controls, the timeline group, the layer table, rail and strip, the timeline strip, the notices, the dialogs, the Netz sheet\'s hints, Paste Pattern)', bad.length === 0, bad.join(', ') || KEPT.length + ' ids');
    const g = (HTML.match(/<div class="control-group" id="timeline-group">[\s\S]*?<span id="timeline-status"><\/span>\s*<\/div>/) || [''])[0];
    check('#timeline-group holds exactly the kept pieces, in order: "Zeitleiste entfernen", the keyframe list, the net status, the pairing editor, the status line - and nothing of the old row', ['btn-clear-timeline', 'timeline-keyframe-list', 'timeline-net-state', 'timeline-pairing', 'timeline-status'].map(id => g.indexOf('id="' + id + '"')).every((x, i, a) => x > 0 && (i === 0 || x > a[i - 1])) && !/<label>Timeline<\/label>/.test(g));
    check('the legacy symmetry mode and fold buttons are still in the markup, hidden: <div class="legacy-controls" hidden> with #btn-mode-spiegeling and #btn-fold-3', /<div class="legacy-controls" hidden>/.test(HTML) && /id="btn-mode-spiegeling"/.test(HTML) && /id="btn-fold-3"/.test(HTML));
});
T('kept css', () => {
    const css = CSS + '\n' + (HTML.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
    const has = re => re.test(css);
    check('.layer-btn (pairing, fold, align, mesh and net buttons), .layer-tab and .layer-remove-btn (the keyframe list entries) have their rules (inline styles of index.html and the coarse block of style.css)', has(/\.layer-btn\s*\{/) && has(/\.layer-tab\s*\{/) && has(/\.layer-remove-btn\s*\{/) && has(/\.layer-btn:disabled\s*\{/) && has(/\.layer-btn\[hidden\]/));
    check('#timeline-group:not(.ts-open) collapses the group; #timeline-net-state and its states, #layer-more-panel and .legacy-controls[hidden] keep their rules', has(/#timeline-group:not\(\.ts-open\)\s*\{\s*display:\s*none;\s*\}/) && has(/#timeline-net-state\s*\{/) && has(/#timeline-net-state\[data-state="animated"\]/) && has(/#layer-more-panel\s*\{\s*display:\s*contents;\s*\}/) && has(/\.legacy-controls\[hidden\]\s*\{\s*display:\s*none;\s*\}/));
    check('the Netz sheet\'s hint rules still list the notes that are written (#net-focus-hint, #net-size-hint, #net-macro-hint, #net-field-hint, #net-field-info) and no removed note', /#net-focus-hint, #net-size-hint, #net-macro-hint, #net-field-hint, #net-field-info\s*\{/.test(CSS));
});

console.log('\n== the mechanisms that were deliberately kept ==');
T('mechanisms', () => {
    const topFn = (src, name) => new RegExp('^function ' + name + '\\(', 'm').test(src);
    const FUNCS = ['setNetAnimationStatus', 'ensureNetAnimation', 'captureNetAnimationEnd', 'enforceNetAnimationLockout', 'toggleNetAnimationPlayback', 'setNetAnimationProgress', 'applyNetAnimationFrame',
        'updateCrossLayerStatus', 'ensureLayerAnimation', 'setActiveLayerAnimationStart', 'setActiveLayerAnimationEnd', 'setActiveLayerAnimationDuration', 'setActiveLayerAnimationProgress',
        'toggleActiveLayerAnimationPlayback', 'applyLayerAnimationFrame', 'applyLayerConnectionsMorphFrame', 'isAnythingAnimating', 'syncAnimationLoopState'];
    const missing = FUNCS.filter(f => !topFn(SKETCH, f));
    check('the net animation, cross-layer status and layer animation functions are still top-level functions of sketch.js (' + FUNCS.length + ')', missing.length === 0, missing.join(', ') || FUNCS.length + ' functions');
    check('the net animation hooks are still called where they were, each behind a guard (window.setNetAnimStatusText, window.syncNetAnimationDisplay, window.syncNetAnimationLock)', /if \(window\.setNetAnimStatusText\) window\.setNetAnimStatusText\(text\)/.test(SKETCH) && /window\.syncNetAnimationDisplay && baseNetAnimation\) window\.syncNetAnimationDisplay\(\)/.test(SKETCH) && /if \(window\.syncNetAnimationLock\) window\.syncNetAnimationLock\(\)/.test(SKETCH));
    check('the layer animation\'s null-safe selects (optionalSelect of #layer-animation-group and #layer-anim-connections-status) and the cross-layer status select are still in sketch.js, and renderLayerTabs is the empty function the callers name', /optionalSelect\('#layer-animation-group'\)/.test(SKETCH) && /optionalSelect\('#layer-anim-connections-status'\)/.test(SKETCH) && /optionalSelect\('#cross-layer-status'\)/.test(SKETCH) && /function renderLayerTabs\(\) \{ \}/.test(SKETCH));
    check('the old symmetry mode and fold buttons keep their handlers: selectAll(\'.mode-btn\') and selectAll(\'.fold-btn\') in sketch.js', /selectAll\('\.mode-btn'\)/.test(SKETCH) && /selectAll\('\.fold-btn'\)/.test(SKETCH));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
