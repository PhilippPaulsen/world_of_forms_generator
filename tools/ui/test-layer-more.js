// Guard for the layer "Mehr" toggle (layers, 5d step 1): the rarely used controls of the active layer sit behind ONE inline toggle. Source text of index.html, style.css, sketch.js and the
// core/session*.js files, plus the dot rule and the toggle's logic in a vm. No browser.
//   node tools/ui/test-layer-more.js
//   INDEX_HTML=... STYLE_CSS=... SKETCH_JS=... node tools/ui/test-layer-more.js        (sabotage runs)
//
// Why. A new layer copies the base's shape, symmetry, node count and size; the timeline rejects keyframes with another shape, symmetry, size or node count and ignores a keyframe's offset and
// rotation; Farbe excludes a layer with another size or rotation. So the layer's shape, node count, size, symmetry, fold, align, offset, mesh presets and rotation controls are rarely useful and
// took a row each. They are behind the "..." of the layer table, rail and strip (layerApi.toggleMore; the old toggle button #btn-more-layer and its row are gone), closed by default, visible only while a layer is active. The wrapper #layer-more-panel has its OWN `hidden`; every group inside keeps the
// `hidden` that updateOffsetControls() writes (shown only for a layer): a group is visible only when both are off, and the two never write each other's attribute.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const HTML = read('INDEX_HTML', 'index.html');
const CSS = read('STYLE_CSS', 'style.css');
const SKETCH = read('SKETCH_JS', 'sketch.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 140)); } };
const topFn = (src, name) => { const m = new RegExp('^function ' + name + '\\(', 'm').exec(src); if (!m) return null; const end = src.indexOf('\n}\n', m.index); return end < 0 ? null : src.slice(m.index, end + 3); };

console.log('== the dot rule: layerHasNonDefaultSettings(layer, base) ==');
T('dot', () => {
    const fn = topFn(SKETCH, 'layerHasNonDefaultSettings');
    check('the helper is a top-level function of sketch.js', !!fn);
    if (!fn) return;
    const sb = {}; vm.createContext(sb); vm.runInContext(fn, sb);
    const f = (l, b) => vm.runInContext('layerHasNonDefaultSettings', sb)(l, b);
    const base = { shape: 'triangle', symmetryMode: 'rotation_reflection6', nodeCount: 3, shapeSizeFactor: 5 };
    const fresh = () => ({ shape: 'triangle', symmetryMode: 'rotation_reflection6', nodeCount: 3, shapeSizeFactor: 5, offsetX: 0, offsetY: 0, rotation: 0 });
    check('a fresh layer (a copy of the base, offset 0, rotation 0) has no dot', f(fresh(), base) === false);
    check('a layer without a rotation field (older snapshots) has no dot', (() => { const l = fresh(); delete l.rotation; return f(l, base) === false; })());
    for (const [k, v] of [['offsetX', 12], ['offsetY', -3], ['rotation', 15], ['shape', 'square'], ['symmetryMode', 'rotation3'], ['nodeCount', 4], ['shapeSizeFactor', 3]])
        check(`${k} = ${JSON.stringify(v)} gives the dot`, f(Object.assign(fresh(), { [k]: v }), base) === true);
    check('a negative zero offset and a rotation of 0 give no dot', f(Object.assign(fresh(), { offsetX: -0, rotation: 0 }), base) === false);
    check('it compares against the base\'s CURRENT values (a layer equal to a changed base has no dot)', f(Object.assign(fresh(), { shape: 'hex', nodeCount: 5 }), { shape: 'hex', symmetryMode: 'rotation_reflection6', nodeCount: 5, shapeSizeFactor: 5 }) === false);
    check('no layer or no base gives no dot (and does not throw)', f(null, base) === false && f(fresh(), null) === false);
});

console.log('\n== the toggle and the wrapper: visibility never fights ==');
T('sync', () => {
    const m = /    function syncLayerMore\(\) \{[\s\S]*?\n    \}\n/.exec(SKETCH);
    const md = /    function layerMoreDot\(\) \{[\s\S]*?\n    \}\n/.exec(SKETCH);   // the dot rule: its own function, read by layerApi.moreState() (the layer views show the dot)
    check('syncLayerMore() is found in setup()', !!m);
    check('layerMoreDot(), the dot rule, is found in setup()', !!md);
    if (!m || !md) return;
    const sb = { layerMorePanel: { hidden: true }, layerMoreOpen: false, activeLayer: 'base', additionalLayers: [], currentShape: 'triangle', symmetryMode: 'm', nodeCount: 3, shapeSizeFactor: 5,
        layerHasNonDefaultSettings: vm.runInContext('(' + topFn(SKETCH, 'layerHasNonDefaultSettings').replace(/^function layerHasNonDefaultSettings/, 'function') + ')', vm.createContext({})) };
    vm.createContext(sb); vm.runInContext(md[0] + m[0], sb);
    const run = () => vm.runInContext('syncLayerMore()', sb);
    const st = () => ({ panel: !sb.layerMorePanel.hidden, dot: vm.runInContext('layerMoreDot()', sb) });
    const layer = () => ({ shape: 'triangle', symmetryMode: 'm', nodeCount: 3, shapeSizeFactor: 5, offsetX: 0, offsetY: 0, rotation: 0 });
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    run(); check('the base is active: no panel (closed)', eq(st(), { panel: false, dot: false }), JSON.stringify(st()));
    sb.additionalLayers = [layer(), layer()]; sb.activeLayer = 0; run();
    check('a layer is active, closed: the panel is not there', eq(st(), { panel: false, dot: false }), JSON.stringify(st()));
    sb.layerMoreOpen = true; run();
    check('...opened: the panel is there', eq(st(), { panel: true, dot: false }), JSON.stringify(st()));
    sb.activeLayer = 1; run();
    check('a layer switch keeps it open (the state survives)', eq(st(), { panel: true, dot: false }), JSON.stringify(st()));
    sb.activeLayer = 'base'; run();
    check('back to the base: the panel is gone, although the state is still "open" (the wrapper does not show an empty block)', eq(st(), { panel: false, dot: false }), JSON.stringify(st()));
    sb.additionalLayers.splice(1, 1); sb.activeLayer = 0; run();
    check('after a layer is removed and another is active: it is open again, not stuck hidden', eq(st(), { panel: true, dot: false }), JSON.stringify(st()));
    sb.additionalLayers = []; sb.activeLayer = 'base'; run();
    check('after the last layer is removed: gone', eq(st(), { panel: false, dot: false }), JSON.stringify(st()));
    sb.layerMoreOpen = false; sb.additionalLayers = [Object.assign(layer(), { rotation: 30 })]; sb.activeLayer = 0; run();
    check('a rotated layer, closed: the dot is on (layerMoreDot), the panel is not shown', eq(st(), { panel: false, dot: true }), JSON.stringify(st()));
    sb.additionalLayers[0].rotation = 0; run();
    check('...rotation back to 0: the dot is off', st().dot === false);
    sb.additionalLayers[0].nodeCount = 4; run();
    check('...a different node count: the dot is on again', st().dot === true);
    sb.activeLayer = 'base'; run();
    check('the dot is off with the base active', st().dot === false);
    // a stale activeLayer index (no such layer) is treated like the base, not a crash
    sb.activeLayer = 7; run();
    check('an activeLayer with no such layer is treated like the base (no throw, nothing shown, no dot)', st().panel === false && st().dot === false);
});

console.log('\n== the markup ==');
const markup = HTML.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' ')).replace(/<script[\s\S]*?<\/script>/g, m => m.replace(/[^\n]/g, ' '));
check('the wrapper starts hidden (closed), and the old toggle row and its button are GONE from the markup: no #layer-more-row, no #btn-more-layer', /<div id="layer-more-panel" hidden>/.test(markup) && !/layer-more-row|btn-more-layer/.test(markup));

const pa = markup.indexOf('<div id="layer-more-panel"');
// find the end of the wrapper by depth counting
let depth = 0, end = -1;
for (const m of markup.slice(pa).matchAll(/<(\/?)div\b/g)) { depth += m[1] ? -1 : 1; if (depth === 0) { end = pa + m.index; break; } }
const panel = markup.slice(pa, end);
const idsIn = html => [...html.matchAll(/<div class="control-group" id="([^"]+)"/g)].map(m => m[1]);
const GROUPS = ['layer-shape-group', 'layer-node-count-group', 'layer-shape-size-group', 'layer-mode-group', 'layer-fold-group', 'layer-align-group', 'layer-offset-x-group', 'layer-offset-y-group', 'layer-mesh-preset-group', 'layer-rotation-group'];
check('the wrapper holds the ten groups, flat, in the order shape, node count, size, symmetry, fold, align, offset X, offset Y, mesh presets, rotation', JSON.stringify(idsIn(panel)) === JSON.stringify(GROUPS), idsIn(panel).join(' '));
const CONTROLS = ['layer-node-count-input', 'layer-shape-size-input', 'layer-offset-x-input', 'layer-offset-y-input', 'layer-rotation-input', 'btn-align-to-base', 'btn-mesh-preset-x', 'btn-mesh-preset-y'];
check('...and so are the controls of those groups (the inputs, Align to base, the two mesh presets) and the .layer-shape-icon-btn / .layer-mode-btn / .layer-fold-btn buttons', CONTROLS.every(id => panel.includes('id="' + id + '"')) && (panel.match(/layer-shape-icon-btn/g) || []).length >= 3 && (panel.match(/layer-mode-btn/g) || []).length >= 3 && (panel.match(/layer-fold-btn/g) || []).length >= 2);
const groupDepths = []; { let d = 0; for (const m of panel.matchAll(/<(\/?)div\b([^>]*)>/g)) { if (m[1]) { d--; continue; } if (/class="control-group"/.test(m[2])) groupDepths.push(d); d++; } }
check('the groups inside are not nested in another wrapper (each of the ten is a DIRECT child of the wrapper: one block per group)', groupDepths.length === GROUPS.length && groupDepths.every(d => d === 1), groupDepths.join(','));
const LAYER_ROW = ['timeline-group', 'btn-clear-timeline', 'timeline-keyframe-list', 'timeline-net-state', 'timeline-pairing', 'timeline-status'];
const outside = markup.slice(0, pa) + markup.slice(end);
check('the timeline group ("Zeitleiste entfernen", the keyframe list, the net status, the pairing editor, the status line) is OUTSIDE the wrapper (ids unchanged), and the old layer row, its buttons and its status line are gone from the markup', LAYER_ROW.every(id => outside.includes('id="' + id + '"') && !panel.includes('id="' + id + '"')) && ['layer-row-group', 'layer-row', 'btn-layer-base', 'layer-tabs', 'btn-add-layer', 'paste-pattern-status', 'btn-add-to-timeline', 'btn-timeline-include-net', 'btn-remove-timeline', 'timeline-playback-controls', 'btn-timeline-play', 'timeline-progress-input'].every(id => !markup.includes('id="' + id + '"')));
check('the wrapper is not preceded by a toggle: nothing of the old toggle row is left before it', !markup.includes('layer-more-row') && pa > 0);

console.log('\n== the wiring ==');
check('the old toggle is gone from sketch.js: no layerMoreBtn, no click listener for #btn-more-layer; the "..." of the layer views flips the state through layerApi.toggleMore (layerMoreOpen = !layerMoreOpen; syncLayerMore();)', !/layerMoreBtn|layerMoreRow|btn-more-layer/.test(SKETCH) && /toggleMore\(\) \{ layerMoreOpen = !layerMoreOpen; syncLayerMore\(\); \}/.test(SKETCH));
check('no p5 mousePressed binding (or select()) for the toggle', !/layerMoreBtn\.mousePressed|btn-more-layer'\)\.mousePressed|select\('#btn-more-layer'\)/.test(SKETCH));
check('the state starts closed (let layerMoreOpen = false) and is a plain variable, not saved: nothing in core/session*.js knows it', /let layerMoreOpen = false;/.test(SKETCH) && !['session.js', 'session-apply.js', 'session-store.js', 'session-writer.js'].some(f => /layerMore|layer-more/.test(fs.readFileSync(path.join(ROOT, 'core', f), 'utf8'))));
const writers = [...SKETCH.matchAll(/layerMorePanel\.hidden\s*=[^=]/g)].length;
check('syncLayerMore() is the only writer of the wrapper\'s hidden (one write, in it)', writers === 1 && /function syncLayerMore\(\) \{[\s\S]*?layerMorePanel\.hidden = /.test(SKETCH), writers + ' writes');
check('updateOffsetControls() calls syncLayerMore() after it has written the groups\' own hidden, and draw() keeps the wrapper current', /\n        syncLayerMore\(\);[^\n]*\n    \}\n\n    \/\/ Roadmap 1.8 Stage A: populates/.test(SKETCH) && /if \(window\.syncLayerMore\) window\.syncLayerMore\(\);/.test(SKETCH));
check('updateOffsetControls() still writes each group\'s own hidden for the ten groups and the values into the inputs (restore fills them while the wrapper is closed)', ['offsetXGroup', 'offsetYGroup', 'meshPresetGroup', 'shapeGroup', 'modeGroup', 'alignGroup', 'nodeCountGroup', 'shapeSizeGroup', 'rotationGroup'].every(g => new RegExp(g + '\\.elt\\.hidden = !showOffsets').test(SKETCH)) && /offsetXInput\.value\(layer\.offsetX\)/.test(SKETCH) && /layerRotationInput\.value\(layer\.rotation \|\| 0\)/.test(SKETCH));

console.log('\n== the CSS ==');
const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
check('the wrapper is display: contents (its groups stay flex items of #controls-container) and [hidden] is restated so that it still hides', /#layer-more-panel\s*\{\s*display:\s*contents;\s*\}/.test(css) && /#layer-more-panel\[hidden\]\s*\{\s*display:\s*none;\s*\}/.test(css));

check('the old toggle row rule is gone from style.css (#layer-more-row)', !/layer-more-row/.test(css));

console.log('\n== 1b-1: the layer controls reuse the Form row\'s patterns ==');
{
    const LAYER_JS = read('UI_LAYER_JS', 'ui-layer.js');
    const group = id => { const i = panel.indexOf('id="' + id + '"'); let d = 0, start = panel.lastIndexOf('<div', i); for (const m of panel.slice(start).matchAll(/<(\/?)div\b/g)) { d += m[1] ? -1 : 1; if (d === 0) return panel.slice(start, start + m.index + 6); } return ''; };
    // the two steppers: the Form row's wrapper around the EXISTING inputs
    for (const [gid, inputId, kind] of [['layer-node-count-group', 'layer-node-count-input', 'node'], ['layer-shape-size-group', 'layer-shape-size-input', 'size']]) {
        const g = group(gid);
        check(`${kind}: the existing input #${inputId} sits inside the Form row's .stepper wrapper (.stepper-icon, the input with inputmode="none", .stepper-chevrons with two .stepper-btn)`,
            /<div class="stepper"[^>]*role="group"/.test(g) && /class="ico stepper-icon"/.test(g) && new RegExp('<input type="number" id="' + inputId + '"[^>]*inputmode="none"').test(g) && /<div class="stepper-chevrons">/.test(g) && (g.match(/<button class="stepper-btn"/g) || []).length === 2 && /data-dir="1"/.test(g) && /data-dir="-1"/.test(g));
        check(`${kind}: the group, the input and both chevrons have an aria-label, a title and a data-i18n key`, /<div class="stepper"[^>]*aria-label="[^"]+"[^>]*data-i18n="[^"]+"/.test(g) && new RegExp('id="' + inputId + '"[^>]*aria-label="[^"]+"[^>]*data-i18n="[^"]+"').test(g) && [...g.matchAll(/<button class="stepper-btn"[^>]*>/g)].every(m => /title="[^"]+"/.test(m[0]) && /aria-label="[^"]+"/.test(m[0]) && /data-i18n="[^"]+"/.test(m[0])));
        check(`${kind}: the old <label for="${inputId}"> and the id are still there (nothing renamed or removed)`, new RegExp('<label for="' + inputId + '">').test(g) && g.includes('id="' + inputId + '"'));
    }
    check('the node-count note (#layer-node-count-note) is GONE (it was written by nothing since the notices; the limit goes to a notice)', !group('layer-node-count-group').includes('layer-node-count-note') && !HTML.includes('layer-node-count-note'));
    // the shape icon row
    const sg = group('layer-shape-group');
    const shapeBtns = [...sg.matchAll(/<button class="layer-shape-icon-btn icon-btn"[^>]*>[\s\S]*?<\/button>/g)].map(m => m[0]);
    check('shape: three .layer-shape-icon-btn.icon-btn (triangle, square, hex) in a .nav-cluster, each with the Form row\'s 18 px .ico icon, aria-pressed, aria-label, title and a data-i18n key',
        /class="icon-row nav-cluster nav-shapes"/.test(sg) && shapeBtns.length === 3 && ['triangle', 'square', 'hex'].every((sh, i) => shapeBtns[i].includes('data-shape="' + sh + '"')) && shapeBtns.every(b => /class="ico" width="18" height="18"/.test(b) && /aria-pressed="false"/.test(b) && /aria-label="[^"]+"/.test(b) && /title="[^"]+"/.test(b) && /data-i18n="[^"]+"/.test(b)));
    // fold, align, mesh: icon buttons
    const fg = group('layer-fold-group');
    const foldBtns = [...fg.matchAll(/<button class="layer-fold-btn layer-btn icon-btn"[^>]*>[^<]*<\/button>/g)].map(m => m[0]);
    check('fold: two .layer-fold-btn buttons (now also .icon-btn, the numeral buttons of the Farbe row) with data-fold 3 / 6, aria-pressed, an aria-label that contains the visible numeral, title and data-i18n',
        foldBtns.length === 2 && ['3', '6'].every((n, i) => foldBtns[i].includes('data-fold="' + n + '"') && new RegExp('aria-label="[^"]*' + n + '[^"]*"').test(foldBtns[i]) && new RegExp('>\\s*' + n + '\\s*<').test(foldBtns[i]) && /aria-pressed="false"/.test(foldBtns[i]) && /data-i18n(-label)?="[^"]+"/.test(foldBtns[i])));   // commit 1 of the sheets redesign: a button with its own text AND a different name carries data-i18n-label
    const iconOnly = id => { const m = new RegExp('<button id="' + id + '"[^>]*>[\\s\\S]*?</button>').exec(panel); return m ? m[0] : ''; };
    for (const id of ['btn-align-to-base', 'btn-mesh-preset-x', 'btn-mesh-preset-y']) {
        const b = iconOnly(id);
        check(`#${id} is an icon-only .icon-btn (the Form row's .ico icon, no text) with aria-label, title and a data-i18n key; the id and the .layer-btn class are kept`,
            /class="layer-btn icon-btn"/.test(b) && /class="ico" width="18" height="18"/.test(b) && b.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]+>/g, '').trim() === '' && /aria-label="[^"]+"/.test(b) && /title="[^"]+"/.test(b) && /data-i18n="[^"]+"/.test(b));
    }
    // the ids and classes the handlers use, unchanged
    check('every id and class sketch.js binds is unchanged: #layer-node-count-input, #layer-shape-size-input, #btn-align-to-base, #btn-mesh-preset-x / -y, .layer-shape-icon-btn[data-shape], .layer-fold-btn[data-fold] (the two note spans #layer-node-count-note and #align-to-base-status are gone: their messages are notices)',
        ['layer-node-count-input', 'layer-shape-size-input', 'btn-align-to-base', 'btn-mesh-preset-x', 'btn-mesh-preset-y'].every(id => panel.includes('id="' + id + '"')) && !panel.includes('layer-node-count-note') && !panel.includes('align-to-base-status') &&
        /select\('#layer-node-count-input'\)/.test(SKETCH) && /select\('#layer-shape-size-input'\)/.test(SKETCH) && /selectAll\('\.layer-shape-icon-btn'\)/.test(SKETCH) && /selectAll\('\.layer-fold-btn'\)/.test(SKETCH) && /select\('#btn-align-to-base'\)/.test(SKETCH));
    // no new p5 binding; the new file is plain
    const code = LAYER_JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    check('ui-layer.js has no p5 binding of its own (no mousePressed, no select()) and wires the EXISTING inputs through UI.stepper and UI.pressed', !/mousePressed|\bselect\(/.test(code) && /UI\.stepper\(/.test(code) && /UI\.pressed\(/.test(code) && /UI\.onSync\(/.test(code));
    check('sketch.js binds exactly the 41 p5 mousePressed handlers (47 before the cleanup removed the six of the old layer row and timeline buttons: Add to Timeline, Remove Timeline, Play, Base, + Layer, Include net; a new binding must be a decision: change this number on purpose)', (SKETCH.match(/\.mousePressed\(/g) || []).length === 41, String((SKETCH.match(/\.mousePressed\(/g) || []).length));
    check('index.html loads ui-layer.js after ui-form.js (its input listener must come before sketch.js\'s own, which p5 adds in setup()) and before ui-net.js', (() => { const a = HTML.indexOf('src="ui-form.js'), b = HTML.indexOf('src="ui-layer.js'), c = HTML.indexOf('src="ui-net.js'); return a > 0 && b > a && c > b; })());
    // the CSS the panel needs from the Form row's rules
    check('the panel restates the three Form-row rules that are scoped to .nav-row or lose inside .control-group: the icon button size, the stepper\'s number field, the cluster gap; the fold numerals use the button default font like the Farbe numerals', /#layer-more-panel \.icon-btn,\s*#layer-more-panel \.layer-fold-btn \{[^}]*width: var\(--target\)[^}]*height: var\(--target\)/.test(css) && /#layer-more-panel \.stepper input\[type="number"\] \{[^}]*width: 2\.4ch[^}]*border: 0/.test(css) && /#layer-more-panel \.nav-cluster \{ gap: var\(--gap\); \}/.test(css) && /#layer-more-panel \.layer-fold-btn \{ font-size: 13\.3333px; font-weight: 400; \}/.test(css));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
