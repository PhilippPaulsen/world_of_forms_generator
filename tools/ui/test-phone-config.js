// Guard for the phone layout's DATA and its CSS (phone layout, commit 1a): ui-phone-config.js (pure data + validate()), the script tags in index.html and the phone block of style.css. No browser.
//   node tools/ui/test-phone-config.js
//   PHONE_CONFIG_JS=... INDEX_HTML=... STYLE_CSS=... UI_PHONE_JS=... node tools/ui/test-phone-config.js        (sabotage runs)
//
// What it pins. (1) validate() of the real config against the ids of index.html finds nothing: every control id exists in index.html (once) or is created by a named script, a control is listed at most once per tab,
// every row fits the 343px of a 375px phone (and the 288px of a 320px one with the narrow widths), a panel holds two rows, the tool row fits, the shared sub-tabs resolve in every tab that lists them, and a tab
// that is not covered has stubs only (stubs are validated as stubs). (2) validate() itself is not blind: a copy of the config with a control twice, a row of 344px, three rows, an id that is nowhere, a stub in a
// covered tab, a missing sub-tab, content in an uncovered tab ... each gives its own problem. (3) The wrapper ids that were added to index.html (#nav-shapes ...) exist once and no other listed control sits inside
// one (the engine moves a listed element with everything in it). (4) The numbers of the config are the numbers of the CSS tokens (--ph-header-h ... --panel-h, --chrome-h) and the canvas formula is the one the
// plan fixed. (5) The two scripts are loaded in index.html after ui-layers.js, ui-timeline.js and ui-rail.js, config before engine, with the page's ?v=. (6) The phone CSS: from the marker comment to the end
// of style.css every rule is inside @media (max-width: 767px) and every selector starts with `html.ph`; nothing above the marker mentions `html.ph` or a `.ph-` class.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const CFG_PATH = process.env.PHONE_CONFIG_JS || path.join(ROOT, 'ui-phone-config.js');
const HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css'), ENGINE = read('UI_PHONE_JS', 'ui-phone.js');
const API = require(CFG_PATH);
const { config, validate, chromeH } = API;

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };
const clone = o => JSON.parse(JSON.stringify(o));

const htmlNoComments = HTML.replace(/<!--[\s\S]*?-->/g, '');
const ids = []; htmlNoComments.replace(/\bid="([^"]+)"/g, (m, id) => { ids.push(id); return m; });
const idSet = new Set(ids);
const controlsOf = (cfg, tab) => {
    const t = cfg.tabs[tab], out = [];
    const tr = cfg.toolRows[t.toolRow]; if (tr) { tr.groups.forEach(g => g.forEach(id => out.push(id))); tr.end.forEach(id => out.push(id)); if (tr.sheet) tr.sheet.items.forEach(id => out.push(id)); }
    t.subtabs.forEach(s => { const st = cfg.subtabs[s]; if (st && st.rows) st.rows.forEach(r => r.items.forEach(it => { if (it.id) out.push(it.id); (it.also || []).forEach(x => out.push(x)); })); });
    return out;
};

console.log('== the real config ==');
T('real', () => {
    const problems = validate(config, { ids: idSet });
    check('validate(config, the ids of index.html) finds nothing', problems.length === 0, problems.join(' ; ') || 'no problems');
    check('the query is the phone query (max-width: 767px) - the one ui.js calls SHEET_QUERY', config.query === '(max-width: 767px)' && /SHEET_QUERY = '\(max-width: 767px\)'/.test(read('UI_JS', 'ui.js')));
    check('three tabs: form, farbe, netz, ALL covered (Form 1a / 1b, Farbe commit 2, Netz commit 3)', Object.keys(config.tabs).join() === 'form,farbe,netz' && Object.keys(config.tabs).every(t => config.tabs[t].covered === true));
    const labels = tab => config.tabs[tab].subtabs.map(s => config.subtabs[s].label).join(' | ');
    check('the sub-tabs of each tab (the targets): Form: Raster | Ebenen | Zeit; Farbe: Harmonie | Spuren | Ebenen | Zeit; Netz: Art | Achsen | Ebenen | Zeit', labels('form') === 'Raster | Ebenen | Zeit' && labels('farbe') === 'Harmonie | Spuren | Ebenen | Zeit' && labels('netz') === 'Art | Achsen | Ebenen | Zeit', labels('form') + ' / ' + labels('farbe') + ' / ' + labels('netz'));
    check('"ebenen" and "zeit" are defined ONCE (one entry each) and listed by every tab', ['ebenen', 'zeit'].every(s => Object.keys(config.subtabs).filter(k => k === s).length === 1 && Object.keys(config.tabs).every(t => config.tabs[t].subtabs.includes(s))));
    check('every sub-tab has rows now (no stub is left: all tabs are covered)', Object.keys(config.subtabs).every(s => !config.subtabs[s].stub && config.subtabs[s].rows.length >= 1) && Object.keys(config.subtabs).join() === 'raster,ebenen,zeit,harmonie,spuren,art,achsen');
    check('the panel is 104px: two rows of 48 and an 8px gap; the stack chrome is 40 + 8 + 64 + 44 + 8 + 104 = 268', config.tabs.form.panelH === 104 && chromeH(config, 'form') === 268, String(chromeH(config, 'form')));
    const f = controlsOf(config, 'form');
    check('Form: the tool row is Undo, Redo, Random | Nodes, Fill | More; the sheet gets the Formorgel link, Paste Pattern, Info, Download, Clear', JSON.stringify(config.toolRows.form.groups) === '[["btn-undo","btn-redo","btn-random"],["btn-toggle-nodes","btn-toggle-faces"]]' && config.toolRows.form.end.join() === 'btn-more-rail' && config.toolRows.form.sheet.items.join() === 'btn-gallery,btn-paste-pattern,btn-info,btn-save,btn-clear' && config.toolRows.form.sheet.id === 'more-rail');
    check('Raster: row 1 = the shapes and the symmetry radios, row 2 = the node stepper, the size stepper and the form "Mehr" button (its own #more-form sheet, NOT merged with the rail\'s)', JSON.stringify(config.subtabs.raster.rows.map(r => r.items.map(i => i.id))) === '[["nav-shapes","nav-symmetry"],["nav-node-stepper","nav-size-stepper","btn-more-form"]]');
    check('Ebenen is the layer strip as it is (a 104px block), Zeit the timeline strip as it is (one row)', JSON.stringify(config.subtabs.ebenen.rows.map(r => r.items.map(i => i.id + ':' + (i.h || 48)))) === '[["layer-strip:104"]]' && JSON.stringify(config.subtabs.zeit.rows.map(r => r.items.map(i => i.id + ':' + (i.h || 48)))) === '[["timeline-strip:48"]]');
    const widths = config.subtabs.raster.rows.map(r => r.items.reduce((a, i) => a + i.w, 0) + 8 * (r.items.length - 1));
    check('the Raster rows are 272 and 298px at the design widths (fit 343), 272 and 282px with the narrow widths (fit 288)', widths.join() === '272,298' && config.subtabs.raster.rows.map(r => r.items.reduce((a, i) => a + (i.wMin || i.w), 0) + 8 * (r.items.length - 1)).join() === '272,282');
    check('every control of Form is listed exactly once (' + f.length + ' ids)', new Set(f).size === f.length);
    check('every control id of the config is in index.html exactly once', f.every(id => ids.filter(x => x === id).length === 1), f.filter(id => ids.filter(x => x === id).length !== 1).join(','));
});

console.log('\n== validate() is not blind (copies of the config) ==');
T('mutants', () => {
    const env = { ids: idSet };
    const mut = (name, fn, re) => {
        const c = clone(config); fn(c);
        const p = validate(c, env);
        check(`validate rejects: ${name}`, p.some(m => re.test(m)), p.join(' ; ') || 'no problem found');
    };
    mut('a control listed twice in one tab (the size stepper again in Zeit)', c => { c.subtabs.zeit.rows[0].items.push({ id: 'nav-size-stepper', w: 117 }); }, /listed twice/);
    mut('a control in the tool row AND in a row (Undo in Raster)', c => { c.subtabs.raster.rows[0].items.push({ id: 'btn-undo', w: 48 }); }, /btn-undo is listed twice/);
    mut('a control of the sheet also in the tool row', c => { c.toolRows.form.groups[0].push('btn-save'); }, /btn-save is listed twice/);
    mut('a row 344px wide (the shapes widened by 16)', c => { c.subtabs.raster.rows[0].items[0].w = 160 + 72; }, /row 1 is 344px wide|more than the 343px/);
    mut('a row that fits 375 but not 320 even with its narrow widths (no wMin on the steppers)', c => { c.subtabs.raster.rows[1].items.forEach(i => { delete i.wMin; }); }, /even with its narrow widths/);
    mut('three rows in a sub-tab', c => { c.subtabs.raster.rows.push({ items: [{ id: 'btn-sym-none', w: 48 }] }); }, /3 rows, the panel holds two|rows are .*high/);
    mut('a block 160px high', c => { c.subtabs.ebenen.rows[0].items[0].h = 160; }, /rows are 160px high|rows, the panel holds two/);
    mut('an id that is nowhere (neither in index.html nor created by a named script)', c => { c.subtabs.raster.rows[0].items.push({ id: 'btn-does-not-exist', w: 10 }); }, /neither in index\.html nor created/);
    mut('a covered tab with a stub sub-tab', c => { c.subtabs.stubby = { label: 'S', stub: true }; c.tabs.form.subtabs.push('stubby'); }, /covered, but sub-tab stubby is a stub/);
    mut('a sub-tab that is not defined', c => { c.tabs.form.subtabs.push('nirgends'); }, /nirgends is not defined/);
    mut('a sub-tab listed twice in a tab', c => { c.tabs.form.subtabs.push('zeit'); }, /zeit is listed twice/);
    mut('an uncovered tab with content in a sub-tab of its own', c => { c.subtabs.other = { label: 'O', rows: [{ items: [{ id: 'btn-undo', w: 48 }] }] }; c.tabs.netz = { covered: false, subtabs: ['other'] }; }, /not covered, but sub-tab other has content/);
    mut('an uncovered tab with a tool row', c => { c.tabs.netz.covered = false; }, /not covered, but has a tool row/);
    mut('a stub with rows', c => { c.subtabs.stubby = { label: 'S', stub: true, rows: [{ items: [{ id: 'btn-undo', w: 48 }] }] }; }, /a stub has no rows/);
    mut('a default sub-tab that the tab does not list', c => { c.tabs.form.defaultSubtab = 'art'; }, /defaultSubtab/);
    mut('a panel height that is not two rows', c => { c.tabs.form.panelH = 120; }, /panelH 120/);
    mut('a tool row too wide (a seventh icon: 6 x 48 + ... + 48 > 343)', c => { c.toolRows.form.end.push('btn-sym-none'); c.toolRows.form.groups[1].push('btn-help'); }, /the tool row is \d+px wide/);
    mut('a tool row that is not defined', c => { c.tabs.form.toolRow = 'nope'; }, /tool row nope is not defined/);
    mut('an afterShow hook for an unknown id', c => { c.afterShow['nobody'] = ['x', 'y']; }, /afterShow: id nobody is unknown/);
    mut('a fluid strip that shares its row with a button', c => { c.subtabs.zeit.rows[0].items.push({ id: 'btn-sym-none', w: 48 }); }, /timeline-strip is fluid but has a width or shares its row/);
    mut('a fluid strip given a width', c => { c.subtabs.zeit.rows[0].items[0].w = 200; }, /is fluid but has a width/);
    mut('a shared sub-tab defined a second time (the timeline strip in "zeit" and in "zeit2")', c => { c.subtabs.zeit2 = clone(c.subtabs.zeit); }, /timeline-strip is defined by two sub-tabs/);
    mut('a wrong query', c => { c.query = '(max-width: 800px)'; }, /query must be/);
    // the accepted created-by-script id produces NO problem about that id
    const ok = clone(config); ok.createdByScript['btn-made'] = 'ui-x.js'; ok.subtabs.raster.rows[0].items.push({ id: 'btn-made', w: 8 }); ok.subtabs.raster.rows[0].items[0].w = 100;
    check('an id created by a named script is accepted (no "neither in index.html" problem)', !validate(ok, env).some(m => /btn-made/.test(m)), validate(ok, env).join(' ; '));
});

console.log('\n== the wrapper ids in index.html ==');
T('wrappers', () => {
    // the element span of an id: from its opening tag to the matching close of the same tag name (div), comments already stripped
    const span = id => {
        const m = new RegExp('<([a-z0-9]+)\\b[^>]*\\bid="' + id + '"[^>]*>').exec(htmlNoComments); if (!m) return null;
        const tag = m[1], re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'g'); re.lastIndex = m.index + m[0].length;
        let depth = 1, r; while ((r = re.exec(htmlNoComments))) { depth += r[1] ? -1 : (/\/>$/.test(r[0]) ? 0 : 1); if (!depth) return htmlNoComments.slice(m.index, re.lastIndex); }
        return null;
    };
    const wrappers = ['nav-shapes', 'nav-symmetry', 'nav-node-stepper', 'nav-size-stepper'];
    check('the four wrapper ids exist once each in index.html (added in 1a: markup, no handler or class changed)', wrappers.every(id => ids.filter(x => x === id).length === 1));
    const all = new Set(Object.keys(config.tabs).flatMap(t => controlsOf(config, t)));
    const nested = [];
    all.forEach(id => { const s = span(id); if (!s) return; all.forEach(o => { if (o !== id && new RegExp('\\bid="' + o + '"').test(s)) nested.push(o + ' in ' + id); }); });
    check('no listed control sits INSIDE another listed one (the engine moves an element with everything in it)', nested.length === 0, nested.join(', ') || 'none');
    const sh = span('nav-shapes') || '';
    check('#nav-shapes holds the three shape buttons; #nav-symmetry the two symmetry radios (the wrappers are the elements the Form row had)', (sh.match(/data-shape=/g) || []).length === 3 && /btn-sym-rotation"/.test(span('nav-symmetry') || '') && /btn-sym-rotation-mirror"/.test(span('nav-symmetry') || ''));
    check('#nav-node-stepper holds #node-count-input, #nav-size-stepper #shape-size-input', /id="node-count-input"/.test(span('nav-node-stepper') || '') && /id="shape-size-input"/.test(span('nav-size-stepper') || ''));
});

console.log('\n== config and CSS agree ==');
T('css', () => {
    const tok = n => { const m = new RegExp('--' + n + ':\\s*([^;]+);').exec(CSS.slice(CSS.indexOf('=== Phone layout ('))); return m ? m[1].trim() : null; };
    const S = config.sizes;
    check('--ph-header-h, --ph-toolrow-h, --ph-subtabs-h, --panel-h in the CSS are the sizes of the config (40, 64, 44, 104)', tok('ph-header-h') === S.header + 'px' && tok('ph-toolrow-h') === S.toolRow + 'px' && tok('ph-subtabs-h') === S.subtabs + 'px' && tok('panel-h') === config.tabs.form.panelH + 'px', [tok('ph-header-h'), tok('ph-toolrow-h'), tok('ph-subtabs-h'), tok('panel-h')].join(' '));
    check('--chrome-h is the sum of the six zones (header + 8 above the canvas + tool row + sub-tab row + 8 above the panel + panel) = the config\'s chromeH', tok('chrome-h') === 'calc(var(--ph-header-h) + var(--sp-2) + var(--ph-toolrow-h) + var(--ph-subtabs-h) + var(--sp-2) + var(--panel-h))' && S.gap === config.scale[1] && chromeH(config, 'form') === S.header + S.gap + S.toolRow + S.subtabs + S.gap + config.tabs.form.panelH, tok('chrome-h'));
    check('the coarse target is forced to 48px while the phone layout is on (a mouse at a narrow width gets the same boxes)', tok('target') === '48px' && S.target === 48);
    check('the canvas: --canvas-ratio 1; --canvas-h = min((100vw - 2 x --sp-3) / ratio, the viewport height - --chrome-h); --canvas-w = --canvas-h x ratio', tok('canvas-ratio') === '1' && tok('canvas-h') === 'min(calc((100vw - 2 * var(--sp-3)) / var(--canvas-ratio)), calc(var(--ph-h) - var(--chrome-h)))' && tok('canvas-w') === 'calc(var(--canvas-h) * var(--canvas-ratio))', tok('canvas-h'));
    check('the viewport height is svh where it exists and the pixel fallback (--ph-inner-h, set from window.innerHeight by the script) elsewhere', tok('ph-h') === 'var(--ph-inner-h, 100vh)' && /@supports \(height: 100svh\)\s*\{\s*html\.ph\s*\{\s*--ph-h:\s*100svh;/.test(CSS) && /--ph-inner-h/.test(ENGINE) && /innerHeight/.test(ENGINE));
    check('the canvas box uses --canvas-w and --canvas-h and no margin (the 2px frame is drawn inside the bitmap; the bitmap, the sketch and the pointer mapping are not touched)', /html\.ph \.canvas-row #canvas-container \{[^}]*width: var\(--canvas-w\);[^}]*height: var\(--canvas-h\);[^}]*margin: 0;/.test(CSS));
});

console.log('\n== the spacing scale ==');
T('scale', () => {
    const body = CSS.slice(CSS.indexOf('=== Phone layout ('));
    // the style rules of the phone block (a brace-aware parse, comments out); defined again below for the CSS section, hence a local copy
    const parse = text => { const t = text.replace(/\/\*[\s\S]*?\*\//g, ''), out = []; (function walk(s, at) { let i = 0; while (i < s.length) { const o = s.indexOf('{', i); if (o < 0) break; const prelude = s.slice(i, o).trim(); let d = 1, j = o + 1; while (j < s.length && d) { if (s[j] === '{') d++; else if (s[j] === '}') d--; j++; } const inner = s.slice(o + 1, j - 1); if (prelude.startsWith('@')) { if (/^@(media|supports)/.test(prelude)) walk(inner, at.concat(prelude)); } else out.push({ sel: prelude, at, body: inner }); i = j; } })(t, []); return out; };
    const rs = parse(body.slice(body.indexOf('*/') + 2));
    const tokenOf = n => { const m = new RegExp('--sp-' + n + ':\\s*([^;]+);').exec(body); return m ? m[1].trim() : null; };
    check('the four spacings --sp-1 .. --sp-4 are 4, 8, 16 and 32px, the config\'s scale; the config\'s gap is --sp-2 and its gutter --sp-3', [1, 2, 3, 4].every(n => tokenOf(n) === config.scale[n - 1] + 'px') && config.scale.join() === '4,8,16,32' && config.sizes.gap === 8 && config.sizes.gutter === 16 && config.sizes.rowGap === 8, [1, 2, 3, 4].map(tokenOf).join(' '));
    const decls = [];   // [selector, property, value] of every padding, margin and gap declaration of the phone rules
    rs.forEach(r => r.body.split(';').forEach(d => { const m = /^\s*([a-z-]+)\s*:\s*([\s\S]+?)\s*$/.exec(d); if (m && /^(padding|margin)(-(top|right|bottom|left|block|inline)(-(start|end))?)?$|^(row-gap|column-gap|gap)$/.test(m[1])) decls.push([r.sel, m[1], m[2]]); }));
    const words = v => { const out = []; let d = 0, cur = ''; for (const c of v) { if (c === '(') d++; if (c === ')') d--; if (/\s/.test(c) && !d) { if (cur) out.push(cur); cur = ''; } else cur += c; } if (cur) out.push(cur); return out; };
    const fromScale = w => w === '0' || /^var\(--sp-[1-4]\)$/.test(w) || (/^calc\(/.test(w) && /var\(--sp-[1-4]\)/.test(w) && !/[0-9.]+(px|em|rem|%)|var\((?!--sp-[1-4]\))/.test(w));
    const bad = []; decls.forEach(([sel, prop, val]) => words(val).forEach(w => { if (!fromScale(w)) bad.push(sel + ' { ' + prop + ': ' + val + ' } -> ' + w); }));
    check('EVERY padding, margin and gap of the html.ph rules is 0, a --sp-N token or a calc of tokens (' + decls.length + ' declarations)', bad.length === 0 && decls.length >= 15, bad.join(' ; ') || decls.length + ' declarations, all from the scale');
    // the canvas's left margin is the buttons' gutter: the same value (16px) in the canvas row, the tool row, the sub-tab row and the panel
    const inline = sel => { const r = rs.find(x => x.sel === sel && !x.at.slice(1).length); const m = r && /padding:\s*([^;]+);/.exec(r.body); const w = m ? words(m[1]) : []; return w.length === 3 ? w[1] : w.length === 2 ? w[1] : w[0]; };
    const gutters = ['html.ph .canvas-row', 'html.ph .ph-toolrow', 'html.ph .ph-subtabs', 'html.ph .ph-slot'].map(inline);
    check('the canvas\'s left margin equals the buttons\' left gutter: the canvas row, the tool row, the sub-tab row and the panel all have the inline padding var(--sp-3) = 16px', gutters.every(g => g === 'var(--sp-3)') && tokenOf(3) === '16px', gutters.join(' '));
    const row = rs.find(r => r.sel === 'html.ph .canvas-row');
    check('the canvas is LEFT aligned (justify-content: flex-start), not centred, and 8px under the header (padding-top var(--sp-2))', !!row && /justify-content:\s*flex-start/.test(row.body) && /padding:\s*var\(--sp-2\) var\(--sp-3\) 0/.test(row.body));
    check('the width limit takes both margins off: 100vw - 2 x --sp-3 (a width-limited canvas has 16px on the right as well)', /--canvas-h:\s*min\(calc\(\(100vw - 2 \* var\(--sp-3\)\)/.test(body));
    const hdr = rs.filter(r => /^html\.ph \.app-header(\s|$)/.test(r.sel));
    check('the header is --ph-header-h (40px) high and the Help icon has a 40px hit area (width, height and the coarse minimum)', hdr.some(r => /height:\s*var\(--ph-header-h\)/.test(r.body)) && hdr.some(r => /min-height:\s*var\(--ph-header-h\)/.test(r.body) && /min-width:\s*var\(--ph-header-h\)/.test(r.body)));
    const tr = rs.find(r => r.sel === 'html.ph .ph-toolrow');
    check('the tool row is 64px = padding var(--sp-2) + 48 + var(--sp-2), its hairline an inset shadow (it takes no room)', !!tr && /height:\s*var\(--ph-toolrow-h\)/.test(tr.body) && /padding:\s*var\(--sp-2\) var\(--sp-3\)/.test(tr.body) && /box-shadow:\s*inset 0 -1px 0 var\(--color-hairline\)/.test(tr.body) && !/border-bottom/.test(tr.body));
});

console.log('\n== the sheets (commit 1b) ==');
T('sheets', () => {
    const LAYERS = read('UI_LAYERS_JS', 'ui-layers.js'), TIMELINE = read('UI_TIMELINE_JS', 'ui-timeline.js');
    check('two sheets, "layer" and "timeline", and every tab lists both', Object.keys(config.sheets).join() === 'layer,timeline' && ['form', 'farbe', 'netz'].every(t => config.tabs[t].sheets.join() === 'layer,timeline'));
    const L = config.sheets.layer, M = config.sheets.timeline;
    check('the layer sheet hosts #layer-more-panel, opened by the .lt-more button of #layer-strip, open = the block is not hidden; the timeline sheet hosts #timeline-group, opened by .ts-more of #timeline-strip, open = class ts-open', L.content === 'layer-more-panel' && L.trigger.within === 'layer-strip' && L.trigger.selector === '.lt-more' && L.open.notHidden === true && M.content === 'timeline-group' && M.trigger.within === 'timeline-strip' && M.trigger.selector === '.ts-more' && M.open.hasClass === 'ts-open');
    check('the contents and trigger containers exist once in index.html; the host ids do not (a script makes the hosts)', [L.content, M.content, L.trigger.within, M.trigger.within].every(id => ids.filter(x => x === id).length === 1) && !idSet.has(L.host) && !idSet.has(M.host) && L.host !== M.host);
    check('the labels (the dialogs\' names) are German and not empty: "Ebenen-Einstellungen", "Zeitleiste: Mehr"', L.label === 'Ebenen-Einstellungen' && M.label === 'Zeitleiste: Mehr');
    check('the triggers exist in the scripts that make them: ui-layers.js makes the strip\'s button with the classes "lt-more lr-more" (its click runs layerApi.toggleMore, which flips #layer-more-panel\'s hidden), ui-timeline.js makes "ts-more nav-more" and toggles ts-open on #timeline-group', /cell\('lt-more lr-more'/.test(LAYERS) && /toggleMore\(\)/.test(LAYERS) && /btn\('ts-more nav-more'/.test(TIMELINE) && /group\.classList\.toggle\('ts-open'/.test(TIMELINE));
    check('#layer-more-panel starts hidden in index.html (the state the sheet follows)', /<div id="layer-more-panel" hidden>/.test(htmlNoComments));
    // a block that contains the strip or a listed control would be moved with it
    const span = id => { const m = new RegExp('<([a-z0-9]+)\\b[^>]*\\bid="' + id + '"[^>]*>').exec(htmlNoComments); if (!m) return ''; const tag = m[1], re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'g'); re.lastIndex = m.index + m[0].length; let depth = 1, r; while ((r = re.exec(htmlNoComments))) { depth += r[1] ? -1 : 1; if (!depth) return htmlNoComments.slice(m.index, re.lastIndex); } return ''; };
    const listed = new Set(controlsOf(config, 'form'));
    const inside = []; [L.content, M.content].forEach(c => listed.forEach(id => { if (new RegExp('\\bid="' + id + '"').test(span(c))) inside.push(id + ' in ' + c); }));
    check('no listed control (strip, tool row, panel) sits INSIDE a sheet\'s block: moving the block would take it along', inside.length === 0, inside.join(', ') || 'none');
    check('the four contextual groups the rail\'s sheet takes along are in index.html once and claimed by the tool row\'s sheet (settings)', JSON.stringify(config.toolRows.form.sheet.settings) === '["curve-fold-group","curve-strength-group","free-roughness-group","free-controls-group"]' && config.toolRows.form.sheet.settings.every(id => ids.filter(x => x === id).length === 1));
});
T('keyboard', () => {
    const tag = id => { const m = new RegExp('<input\\b[^>]*\\bid="' + id + '"[^>]*>').exec(htmlNoComments); return m ? m[0] : ''; };
    check('the pairing filter (a non-negative decimal, "max Σd²") asks for the decimal pad: inputmode="decimal"', /inputmode="decimal"/.test(tag('timeline-pairing-filter')) && /min="0"/.test(tag('timeline-pairing-filter')));
    check('the layer offsets and the rotation can be NEGATIVE, and the numeric / decimal pads of iOS have no minus sign: they carry no inputmode (the full keyboard is the default of type=number); a future inputmode here would lose the function', ['layer-offset-x-input', 'layer-offset-y-input', 'layer-rotation-input'].every(id => tag(id) && !/inputmode=/.test(tag(id))));
    check('the node and size inputs keep inputmode="none" (steppers are the input; no keyboard)', /inputmode="none"/.test(tag('node-count-input')) && /inputmode="none"/.test(tag('shape-size-input')) && /inputmode="none"/.test(tag('layer-node-count-input')) && /inputmode="none"/.test(tag('layer-shape-size-input')));
});
T('sheet-mutants', () => {
    const env = { ids: idSet };
    const mut = (name, fn, re) => { const c = clone(config); fn(c); const p = validate(c, env); check(`validate rejects: ${name}`, p.some(m => re.test(m)), p.join(' ; ') || 'no problem found'); };
    mut('a tab that lists a sheet nobody defines', c => { c.tabs.form.sheets.push('nirgends'); }, /sheet nirgends is not defined/);
    mut('a sheet whose block is also a row item (the layer block in Zeit)', c => { c.subtabs.zeit.rows.push({ items: [{ id: 'layer-more-panel', w: 48 }] }); }, /layer-more-panel is listed twice/);
    mut('a sheet whose content is not in index.html', c => { c.sheets.layer.content = 'layer-gone'; }, /layer-gone is neither in index\.html/);
    mut('a host id that index.html already has (the script would make a second element with it)', c => { c.sheets.layer.host = 'canvas-container'; }, /its host id canvas-container is in index\.html/);
    mut('a sheet without a label', c => { c.sheets.timeline.label = ''; }, /sheet timeline: no label/);
    mut('a sheet without a trigger selector', c => { delete c.sheets.layer.trigger.selector; }, /sheet layer: no trigger/);
    mut('a trigger container that is nowhere', c => { c.sheets.layer.trigger.within = 'no-strip'; }, /trigger container no-strip is unknown/);
    mut('a sheet that does not say how to read its state', c => { c.sheets.timeline.open = {}; }, /open must be/);
    mut('a contextual group of the rail\'s sheet that is nowhere', c => { c.toolRows.form.sheet.settings.push('nope-group'); }, /nope-group is neither in index\.html/);
    mut('a contextual group listed twice (also in a row)', c => { c.subtabs.zeit.rows.push({ items: [{ id: 'curve-fold-group', w: 48 }] }); }, /curve-fold-group is listed twice/);
    mut('a sheet that no tab lists (never built, never checked)', c => { c.tabs.form.sheets = ['layer']; c.tabs.farbe.sheets = ['layer']; c.tabs.netz.sheets = ['layer']; }, /sheet timeline is defined but no tab lists it/);
    mut('one block claimed by two sheets (the timeline sheet hosts the layer block as well)', c => { c.sheets.timeline.content = 'layer-more-panel'; }, /layer-more-panel is listed twice/);
});

console.log('\n== the Farbe tab (commit 2) ==');
T('farbe', () => {
    const F = config.tabs.farbe, tr = config.toolRows.farbe, H = config.subtabs.harmonie, SP = config.subtabs.spuren;
    check('Farbe: covered, a 104px panel, the sub-tabs Harmonie | Spuren | Ebenen | Zeit, Harmonie first, the same two sheets as Form; the stack chrome is the same 268', F.covered === true && F.panelH === 104 && F.subtabs.join() === 'harmonie,spuren,ebenen,zeit' && F.defaultSubtab === 'harmonie' && F.toolRow === 'farbe' && chromeH(config, 'farbe') === 268);
    check('the tool row: Fill | the strategy radiogroup (ONE wrapper of four icons) | More at the end; 334px of the 343 (6 icons, 4px gaps in the group, two hairlines)', JSON.stringify(tr.groups) === '[["btn-toggle-faces"],["farbe-strategy-group"]]' && tr.icons['farbe-strategy-group'] === 4 && JSON.stringify(tr.end) === '["btn-more-rail"]' && (6 * 48 + 3 * 4 + 2 * 17) === 334);
    check('the More sheet gets Reset Color, Nodes, the Farborgel link, Info and Download (what the Farbe rail showed besides Fill and the strategies); the opener has a Farbe name with a data-i18n key', JSON.stringify(tr.sheet.items) === '["btn-face-colors-reset","btn-toggle-nodes","btn-farborgel","btn-info","btn-save"]' && tr.sheet.id === 'more-rail' && tr.sheet.opener === 'btn-more-rail' && /^Mehr: /.test(tr.sheet.openerLabel.text) && /^more\./.test(tr.sheet.openerLabel.i18n) && !tr.sheet.settings);
    check('Undo, Redo, Random, Clear and the Formorgel link are NOT in Farbe\'s config (they are hidden in Farbe today: style.css hides their groups for html[data-tab=farbe])', ['btn-undo', 'btn-redo', 'btn-random', 'btn-clear', 'btn-gallery', 'btn-paste-pattern'].every(id => !controlsOf(config, 'farbe').includes(id)) && /html\[data-tab="farbe"\] #rail-group-a,[\s\S]*?#rail-group-e,[\s\S]*?#rail-group-more,[\s\S]*?#btn-gallery \{ display: none; \}/.test(CSS));
    const row = r => r.items.reduce((a, i) => a + (i.w || 0), 0) + 8 * (r.items.length - 1), rowMin = r => r.items.reduce((a, i) => a + (i.wMin || i.w || 0), 0) + 8 * (r.items.length - 1);
    check('Harmonie row 1 = Kreis + Dreieck (104), a hairline, ONE slot for the two harmony clusters (216, four buttons: the circle\'s three share it): 337px, scrolls from 340px down; row 2 = the two steppers and the 48px swatch: 298px, 282 with the narrow widths', H.rows.length === 2 && H.rows[0].items.map(i => i.id || 'sep').join() === 'nav-anchor-views,sep,farbe-family-triangle' && H.rows[0].items[2].also.join() === 'farbe-family-circle' && row(H.rows[0]) === 337 && H.rows[0].scroll === true && H.rows[1].items.map(i => i.id).join() === 'farbe-anchor-hue-stepper,farbe-anchor-register-stepper,farbe-anchor-preview' && row(H.rows[1]) === 298 && rowMin(H.rows[1]) === 282 && !H.rows[1].scroll);
    check('Spuren: two fluid rows, the chips and the stepper of the selected trail; both ids are made by ui-phone-chips.js (createdByScript)', SP.rows.length === 2 && SP.rows[0].items[0].id === 'ph-trail-chips' && SP.rows[0].items[0].fluid && SP.rows[1].items[0].id === 'ph-trail-stepper' && SP.rows[1].items[0].fluid && config.createdByScript['ph-trail-chips'] === 'ui-phone-chips.js' && config.createdByScript['ph-trail-stepper'] === 'ui-phone-chips.js' && config.afterShow['ph-trail-chips'].join() === 'uiPhoneChips,refresh');
    check('every control of Farbe is listed once (' + controlsOf(config, 'farbe').length + ' ids) and every one of them that index.html holds is there exactly once', (() => { const f = controlsOf(config, 'farbe'); return new Set(f).size === f.length && f.filter(id => !config.createdByScript[id]).every(id => ids.filter(x => x === id).length === 1); })());
    check('the wrapper #nav-anchor-views is in index.html once, holds the two anchor views (Kreis, Dreieck) and no other listed control', ids.filter(x => x === 'nav-anchor-views').length === 1 && /id="nav-anchor-views"[^>]*>\s*<button id="btn-open-kreis"[\s\S]*?<button id="btn-open-dreieck"/.test(htmlNoComments));
    check('the Farbe strategy radiogroup keeps its radio semantics: role radiogroup on the wrapper, four role=radio buttons (moved whole, not button by button)', /<div id="farbe-strategy-group"[^>]*role="radiogroup"/.test(htmlNoComments) && (htmlNoComments.match(/id="btn-strategy-[a-z]+"[^>]*role="radio"/g) || []).length === 4);
    check('the strategy wrapper also appears in the tool row only: no strategy button is listed on its own', !controlsOf(config, 'farbe').some(id => /^btn-strategy-/.test(id)));
});
T('farbe-mutants', () => {
    const env = { ids: idSet };
    const mut = (name, fn, re) => { const c = clone(config); fn(c); const p = validate(c, env); check(`validate rejects (Farbe): ${name}`, p.some(m => re.test(m)), p.join(' ; ') || 'no problem found'); };
    mut('a control listed twice (Info also in the harmony panel)', c => { c.subtabs.harmonie.rows[1].items.push({ id: 'btn-info', w: 48 }); }, /btn-info is listed twice/);
    mut('a control of the sheet also in the tool row (Nodes)', c => { c.toolRows.farbe.groups[0].push('btn-toggle-nodes'); }, /btn-toggle-nodes is listed twice/);
    mut('a row over 343px (the anchor views widened by 8)', c => { c.subtabs.harmonie.rows[0].items[0].w = 112; }, /row 1 is 345px wide, more than the 343px/);
    mut('a row that does not fit 288px with no scroll flag (the harmony row)', c => { delete c.subtabs.harmonie.rows[0].scroll; }, /even with its narrow widths/);
    mut('a scroll flag on a row that fits (the steppers row)', c => { c.subtabs.harmonie.rows[1].scroll = true; }, /marked scroll but fits/);
    mut('the second harmony cluster forgotten (the circle cluster not in `also`: it stays behind in the Farbe row)', c => { c.subtabs.harmonie.rows[0].items[2].also = ['farbe-family-nowhere']; }, /farbe-family-nowhere is neither in index\.html/);
    mut('a separator with an id', c => { c.subtabs.harmonie.rows[0].items[1].id = 'btn-info'; }, /a separator has a width and no id/);
    mut('a separator without a width', c => { delete c.subtabs.harmonie.rows[0].items[1].w; }, /a separator has a width and no id/);
    mut('a fluid chip container that shares its row', c => { c.subtabs.spuren.rows[0].items.push({ id: 'btn-info', w: 48 }); }, /ph-trail-chips is fluid but has a width or shares its row/);
    mut('a chip container that no script makes (createdByScript lost)', c => { delete c.createdByScript['ph-trail-chips']; }, /ph-trail-chips is neither in index\.html nor created by a named script/);
    mut('the tool row too wide: the strategy wrapper counted as 5 icons and a fourth group icon', c => { c.toolRows.farbe.icons['farbe-strategy-group'] = 5; c.toolRows.farbe.groups[0].push('btn-toggle-nodes'); c.toolRows.farbe.sheet.items = c.toolRows.farbe.sheet.items.filter(i => i !== 'btn-toggle-nodes'); }, /the tool row is \d+px wide/);
    mut('the Farbe tab with a stub sub-tab', c => { c.subtabs.harmonie = { label: 'Harmonie', stub: true }; }, /covered, but sub-tab harmonie is a stub/);
    mut('Farbe without a default sub-tab it lists', c => { c.tabs.farbe.defaultSubtab = 'art'; }, /defaultSubtab/);
});

console.log('\n== the Netz tab (commit 3) ==');
T('netz', () => {
    const N = config.tabs.netz, tr = config.toolRows.netz, A = config.subtabs.art, X = config.subtabs.achsen;
    check('Netz: covered, a 104px panel, the sub-tabs Art | Achsen | Ebenen | Zeit (no "Feld": the domain and Macro stay in #more-netz), Art first, the same two sheets; the chrome is the same 268', N.covered === true && N.panelH === 104 && N.subtabs.join() === 'art,achsen,ebenen,zeit' && N.defaultSubtab === 'art' && N.toolRow === 'netz' && chromeH(config, 'netz') === 268);
    check('the tool row: Undo, Redo | Nodes, Net lines, Fill | More at the end: 6 icons, 4px inside a group, two hairlines = 334px of the 343', JSON.stringify(tr.groups) === '[["btn-undo","btn-redo"],["btn-toggle-nodes","net-lines-btn","btn-toggle-faces"]]' && JSON.stringify(tr.end) === '["btn-more-rail"]' && (6 * 48 + 3 * 4 + 2 * 17) === 334 && !tr.icons);
    check('the rail\'s sheet gets Random, the catalog link, Info, Download and Clear (Paste Pattern is Form only), plus the Curve / Free settings groups like Form\'s; More keeps its own name (no openerLabel)', JSON.stringify(tr.sheet.items) === '["btn-random","btn-gallery","btn-info","btn-save","btn-clear"]' && JSON.stringify(tr.sheet.settings) === JSON.stringify(config.toolRows.form.sheet.settings) && tr.sheet.opener === 'btn-more-rail' && !tr.sheet.openerLabel);
    const w = r => r.items.reduce((a, i) => a + (i.w || 0), 0) + 8 * (r.items.length - 1), wMin = r => r.items.reduce((a, i) => a + (i.wMin || i.w || 0), 0) + 8 * (r.items.length - 1);
    check('Art: row 1 = the four kinds (4 x 60 + 3 gaps = 264), row 2 = the strength stepper (117), the panel\'s own More (48) and Reverse LAST (74; sketch.js shows it for Geo only, so More keeps its place with Sin, Tan, Aus and Geo): 117 + 8 + 48 + 8 + 74 = 255px, 247 with the narrow stepper; both fit 288 - nothing scrolls', A.rows.length === 2 && A.rows[0].items.map(i => i.id + ':' + i.w).join() === 'nav-kinds:264' && A.rows[1].items.map(i => i.id).join() === 'net-strength-stepper,btn-more-netz,net-reverse-btn' && w(A.rows[0]) === 264 && w(A.rows[1]) === 255 && wMin(A.rows[1]) === 247 && !A.rows.some(r => r.scroll));
    check('Achsen: row 1 = Both / X / Y (158px measured at a coarse pointer: 52 + 48 + 48 + 2 gaps), row 2 = the Fokus stepper (117); no row scrolls', X.rows.length === 2 && X.rows[0].items[0].id === 'net-axes-row' && X.rows[0].items[0].w === 158 && X.rows[1].items.map(i => i.id).join() === 'net-focus-stepper' && X.rows[1].items[0].w === 117 && !X.rows.some(r => r.scroll));
    check('follow: the Fokus stepper follows #net-focus-row (sketch.js shows that row for Sin and Tan only) in mode "disable": it stays shown and is disabled with the reason "Fokus gilt für Sin und Tan"', JSON.stringify(config.follow) === '{"net-focus-stepper":{"of":"net-focus-row","mode":"disable","reason":"Fokus gilt für Sin und Tan","i18n":"net.reason.focus"}}' && JSON.stringify(API.followSpec('x')) === '{"of":"x","mode":"hide"}');
    check('labels: Net lines has its own name while the Netz tool row is on: "Netzlinien zeigen" with a data-i18n key; no other tool row has labels', JSON.stringify(tr.labels) === '{"net-lines-btn":{"text":"Netzlinien zeigen","i18n":"netz.lines.button"}}' && !config.toolRows.form.labels && !config.toolRows.farbe.labels);
    const f = controlsOf(config, 'netz');
    check('every control of Netz is listed once (' + f.length + ' ids) and each is in index.html exactly once', new Set(f).size === f.length && f.every(id => ids.filter(x => x === id).length === 1), f.filter(id => ids.filter(x => x === id).length !== 1).join());
    const span = id => { const m = new RegExp('<([a-z0-9]+)\\b[^>]*\\bid="' + id + '"[^>]*>').exec(htmlNoComments); if (!m) return ''; const tag = m[1], re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'g'); re.lastIndex = m.index + m[0].length; let depth = 1, r; while ((r = re.exec(htmlNoComments))) { depth += r[1] ? -1 : 1; if (!depth) return htmlNoComments.slice(m.index, re.lastIndex); } return ''; };
    check('#nav-kinds is the radiogroup of the four kind buttons (role=radiogroup, four .net-kind-btn with role=radio: Aus, Sin, Tan, Geo); #net-strength-stepper holds #net-strength-value and the two chevrons', /id="nav-kinds"[^>]*role="radiogroup"/.test(htmlNoComments) && ['regular', 'sinus', 'tangens', 'geometric'].every(k => new RegExp('net-kind-btn[^>]*data-kind="' + k + '"[^>]*role="radio"').test(span('nav-kinds'))) && /id="net-strength-value"/.test(span('net-strength-stepper')) && (span('net-strength-stepper').match(/class="stepper-btn"/g) || []).length === 2);
    check('the Fokus stepper sits INSIDE #net-focus-row (the block sketch.js shows and hides) next to the exact field, which does NOT move; #net-geo-row keeps Reverse and Alternate in the markup (only Reverse is moved at run time: it has its own hidden in sketch.js)', /id="net-focus-stepper"/.test(span('net-focus-row')) && /id="net-focus-exact"/.test(span('net-focus-row')) && !new RegExp('id="net-focus-exact"').test(span('net-focus-stepper')) && /id="net-reverse-btn"/.test(span('net-geo-row')) && /id="net-alternate-btn"/.test(span('net-geo-row')));
    check('Net lines keeps what it has: id net-lines-btn, the title, the text "Net lines" (its accessible name; the phone CSS empties it visually, not in the DOM), in #net-group where it is at 768px and up', /<button class="layer-btn" id="net-lines-btn" title="Draw the net's own grid lines[^"]*">Net lines<\/button>/.test(htmlNoComments) && /id="net-lines-btn"/.test(span('net-group')));
    check('the wrapper ids added to index.html exist once: nav-kinds, net-strength-stepper, net-focus-stepper', ['nav-kinds', 'net-strength-stepper', 'net-focus-stepper'].every(id => ids.filter(x => x === id).length === 1));
});
T('netz-mutants', () => {
    const env = { ids: idSet };
    const mut = (name, fn, re) => { const c = clone(config); fn(c); const p = validate(c, env); check(`validate rejects (Netz): ${name}`, p.some(m => re.test(m)), p.join(' ; ') || 'no problem found'); };
    mut('a control listed twice (Undo again in the Achsen panel)', c => { c.subtabs.achsen.rows[1].items.push({ id: 'btn-undo', w: 48 }); }, /btn-undo is listed twice/);
    mut('a control of the sheet also in the tool row (Random)', c => { c.toolRows.netz.groups[0].push('btn-random'); }, /btn-random is listed twice/);
    mut('a row over 343px (the four kinds 80px wide each: 344 would not fit, 352 does not)', c => { c.subtabs.art.rows[0].items[0].w = 352; }, /row 1 is 352px wide, more than the 343px/);
    mut('the strength row over 343px (Reverse 200px)', c => { c.subtabs.art.rows[1].items[2].w = 200; }, /row 2 is \d+px wide, more than the 343px/);
    mut('the tool row too wide (a seventh icon)', c => { c.toolRows.netz.groups[1].push('btn-help'); }, /the tool row is \d+px wide/);
    mut('a third row in a Netz panel', c => { c.subtabs.achsen.rows.push({ items: [{ id: 'btn-info', w: 48 }] }); }, /3 rows, the panel holds two|rows are .*high/);
    mut('a kind button / id that index.html does not have (the wrapper id lost)', c => { c.subtabs.art.rows[0].items[0].id = 'nav-kinds-gone'; }, /nav-kinds-gone is neither in index\.html/);
    mut('a follower whose source is nowhere', c => { c.follow['net-focus-stepper'] = 'net-focus-nowhere'; }, /follow: .* is unknown/);
    mut('a follower that follows itself', c => { c.follow['net-focus-stepper'] = 'net-focus-stepper'; }, /follows itself/);
    mut('a follower (object form) that follows itself', c => { c.follow['net-focus-stepper'].of = 'net-focus-stepper'; }, /follows itself/);
    mut('a follow mode that does not exist', c => { c.follow['net-focus-stepper'].mode = 'vanish'; }, /unknown mode vanish/);
    mut('a disabled follower without a reason', c => { delete c.follow['net-focus-stepper'].reason; }, /disabled but has no reason/);
    mut('a disabled follower with a blank reason', c => { c.follow['net-focus-stepper'].reason = '  '; }, /disabled but has no reason/);
    mut('a label for a control that is not in that tool row', c => { c.toolRows.netz.labels['btn-help'] = { text: 'Hilfe', i18n: 'x' }; }, /btn-help is not in that tool row/);
    mut('a label without text', c => { c.toolRows.netz.labels['net-lines-btn'].text = ''; }, /net-lines-btn has no text/);
    mut('a label without a data-i18n key', c => { delete c.toolRows.netz.labels['net-lines-btn'].i18n; }, /no data-i18n key/);
    mut('the Netz tab without a tool row', c => { delete c.tabs.netz.toolRow; }, /tool row undefined is not defined/);
    mut('the Netz tab not covered but with content', c => { c.tabs.netz.covered = false; }, /not covered, but/);
});
T('netz-sources', () => {
    const SK = read('SKETCH_JS', 'sketch.js'), NET = read('UI_NET_JS', 'ui-net.js');
    const sk = SK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    check('sketch.js (UNCHANGED by commit 3) still provides what the Netz panel relies on: the group shown for the square on the base, Reverse hidden unless Geo, the Fokus row hidden unless Sin / Tan, Net lines a toggle of netLinesOn on its own id, the kinds / axes handlers on the classes', /group\.elt\.hidden = !\(currentShape === 'square' && activeLayer === 'base'\)/.test(sk) && /reverseBtn\.elt\.hidden = !geo/.test(sk) && /focusRow\.elt\.hidden = !trig/.test(sk) && /select\('#net-lines-btn'\)/.test(sk) && /linesBtn\.mousePressed\(\(\) => \{ netLinesOn = !netLinesOn; linesBtn\.elt\.classList\.toggle\('active', netLinesOn\)/.test(sk) && /selectAll\('\.net-kind-btn'\), axesBtns = selectAll\('\.net-axes-btn'\)/.test(sk) && /select\('#net-reverse-btn'\)/.test(sk) && /select\('#net-focus-row'\)/.test(sk));
    check('ui-net.js: the guard of a disabled net control sits on the DOCUMENT (the kind buttons, the axes buttons and Reverse live in the phone panel, outside #nav-netz) and covers all three; the sync disables axes and Reverse with the reason', /document\.addEventListener\('mousedown'[\s\S]*?GUARDED[\s\S]*?\}, true\)/.test(NET) && /const GUARDED = '\.net-kind-btn\[aria-disabled="true"\], \.net-axes-btn\[aria-disabled="true"\], #net-reverse-btn\[aria-disabled="true"\]'/.test(NET) && /document\.addEventListener\('click'[\s\S]*?UI\.showReason/.test(NET) && !/row\.addEventListener\('(mousedown|click)'/.test(NET) && /axesBtns\.forEach\(function \(b\) \{ UI\.setDisabled\(b, all\); \}\)/.test(NET) && /UI\.setDisabled\(reverseBtn, all\)/.test(NET));
    check('ui-net.js (commit 3b): the Fokus exact field says and keeps the same as the disabled Fokus stepper: reasonFocus() = the net reason, else the root\'s own aria-disabled reason; the field\'s change handler and its lock use it', /function reasonFocus\(\) \{ return reasonAll\(\) \|\| \(UI\.isDisabled\(focusRoot\) \? focusRoot\.dataset\.reason/.test(NET) && /T\['reason\.focus\.exact'\], reasonFocus\)/.test(NET) && /setLocked\(focusExact, reasonFocus\(\)\)/.test(NET));
    check('ui-net.js: a change of the Fokus root\'s aria-disabled (the engine marks it in the middle of a UI tick, after ui-net\'s own sync) runs the sync at once: a MutationObserver on focusRoot (attributeFilter aria-disabled), so the exact field is locked / unlocked without waiting for a redraw', /new MutationObserver\(sync\)\.observe\(focusRoot, \{ attributes: true, attributeFilter: \['aria-disabled'\] \}\)/.test(NET));
    check('ui-net.js: the Fokus stepper is NOT disabled by ui-net.js itself (only the engine, through the config, marks its root): no setDisabled on focusRoot', !/setDisabled\(focusRoot/.test(NET));
});

console.log('\n== the script tags ==');
T('tags', () => {
    const tags = []; htmlNoComments.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g, (m, s) => { tags.push(s); return m; });
    const at = n => tags.findIndex(s => s.startsWith(n + '?') || s === n);
    const ver = n => (tags[at(n)] || '').split('?v=')[1];
    check('ui-phone-config.js and ui-phone.js are loaded, config first', at('ui-phone-config.js') >= 0 && at('ui-phone.js') === at('ui-phone-config.js') + 1);
    check('both come after ui-layers.js, ui-timeline.js and ui-rail.js (the strips are filled, the handlers bound) - and after nav.js', ['ui-layers.js', 'ui-timeline.js', 'ui-rail.js', 'nav.js'].every(n => at(n) >= 0 && at(n) < at('ui-phone-config.js')));
    check('ui-phone-chips.js is loaded after ui-farbe.js (UI.onSync order: the model rows are rebuilt before the view reads them) and before ui-phone-config.js, with the page\'s ?v=', at('ui-phone-chips.js') > at('ui-farbe.js') && at('ui-phone-chips.js') < at('ui-phone-config.js') && ver('ui-phone-chips.js') === ver('sketch.js'), at('ui-farbe.js') + ' < ' + at('ui-phone-chips.js') + ' < ' + at('ui-phone-config.js'));
    check('they carry the same ?v= as sketch.js (one version string for the page)', ver('ui-phone-config.js') && ver('ui-phone-config.js') === ver('sketch.js') && ver('ui-phone.js') === ver('sketch.js'), ver('ui-phone.js') + ' / ' + ver('sketch.js'));
    check('the engine listens to nav.js\'s own signal: the tabchange event, whose detail is { tab } (nav.js dispatches it)', /addEventListener\('tabchange'/.test(ENGINE) && /new CustomEvent\('tabchange', \{ detail: \{ tab: tab \} \}\)/.test(read('NAV_JS', 'nav.js')));
    check('nothing was added to nav.js: it still has no reference to the phone layout', !/phone|\bph\b|uiPhone/i.test(read('NAV_JS', 'nav.js')));
});

console.log('\n== the phone CSS ==');
// A brace-aware parse of a CSS text without comments: [{ sel, at: [the at-rule preludes around it] }] for every style rule.
function rules(text) {
    const t = text.replace(/\/\*[\s\S]*?\*\//g, ''), out = [];
    (function walk(s, at) {
        let i = 0;
        while (i < s.length) {
            const o = s.indexOf('{', i); if (o < 0) break;
            const prelude = s.slice(i, o).trim();
            let d = 1, j = o + 1; while (j < s.length && d) { if (s[j] === '{') d++; else if (s[j] === '}') d--; j++; }
            const body = s.slice(o + 1, j - 1);
            if (prelude.startsWith('@')) { if (/^@(media|supports)/.test(prelude)) walk(body, at.concat(prelude)); }   // @font-face and @keyframes are not style rules of ours
            else out.push({ sel: prelude, at, body });
            i = j;
        }
    })(t, []);
    return out;
}
T('css', () => {
    const marker = CSS.indexOf('=== Phone layout (');
    check('the phone block starts at the marker comment "=== Phone layout (" and is the LAST thing in style.css', marker > 0 && CSS.indexOf('=== Phone layout (', marker + 1) < 0);
    const before = CSS.slice(0, marker).replace(/\/\*[\s\S]*?\*\//g, ''), block = CSS.slice(marker);
    check('nothing above the block mentions html.ph or a .ph- class: no phone rule hides outside the gate', !/html\.ph\b|\.ph-[a-z]|#ph-/.test(before));
    const rs = rules(block.slice(block.indexOf('*/') + 2));
    check('the block has rules (' + rs.length + ')', rs.length > 20);
    const outside = rs.filter(r => r.at[0] !== '@media (max-width: 767px)');
    check('EVERY rule of the block is inside @media (max-width: 767px)', outside.length === 0, outside.map(r => r.sel).slice(0, 5).join(' ; ') || 'all ' + rs.length);
    const bad = rs.filter(r => r.sel.split(',').some(s => !/^\s*html\.ph(\s|$|\[|\.|:)/.test(s)));
    check('EVERY selector of the block starts with html.ph', bad.length === 0, bad.map(r => r.sel).slice(0, 5).join(' ; ') || 'all ' + rs.length);
    const nested = rs.filter(r => r.at.length > 1).map(r => r.at.slice(1).join(' > '));
    check('the only at-rules nested in the phone media query are narrower width queries and @supports (' + [...new Set(nested)].join(', ') + ')', nested.every(a => /^@media \(max-width: \d+px\)$|^@supports \(height: 100svh\)$/.test(a)));
    const gate = rs.filter(r => /^html\.ph\s*$/.test(r.sel) && !r.at.slice(1).length);
    check('the tokens sit on html.ph (the custom properties of the layout exist only while the layout is on)', gate.length >= 1 && /--chrome-h/.test(gate[0].body));
    check('the Form nav row and the rail are display: none while the layout is on (their controls are in the panel)', rs.some(r => /html\.ph \.nav-rows/.test(r.sel) && /html\.ph \.rail-left/.test(r.sel) && /display: none/.test(r.body)));
    const hid = rs.filter(r => /\.ph-park/.test(r.sel));
    check('the parking container is display: none (hidden: out of the Tab order and the accessibility tree)', hid.length === 1 && /display: none/.test(hid[0].body) && /\[hidden\]/.test(hid[0].sel) && /b\.park\.hidden = true/.test(ENGINE));
    // ---- commit 1b ----
    const above = rules(CSS.slice(0, marker));
    const clips = above.filter(r => r.sel.split(',').some(x => /^\s*(html|body)\s*$/.test(x)) && /overflow(-y)?:\s*hidden/.test(r.body));
    check('NOTHING above the phone block clips the page: no rule on html or body sets overflow hidden (Farbe, Netz and the widths from 768 scroll as before)', clips.length === 0, clips.map(r => r.sel).join(' ; ') || 'none');
    const clip = rs.filter(r => /overflow(-y)?:\s*hidden/.test(r.body) && r.sel.split(',').some(x => /^\s*html\.ph(\s+body)?\s*$/.test(x)));
    check('the page is clipped only by `html.ph, html.ph body { height: var(--ph-h); min-height: 0; overflow: hidden }` inside the phone media query: the viewport height, no page scroll, and only while the layout is on', clip.length === 1 && clip[0].sel.replace(/\s+/g, ' ') === 'html.ph, html.ph body' && clip[0].at.join() === '@media (max-width: 767px)' && /height:\s*var\(--ph-h\)/.test(clip[0].body) && /min-height:\s*0/.test(clip[0].body), clip.map(r => r.sel + ' @ ' + r.at.join()).join(' ; '));
    check('every `overflow: hidden` of the phone block sits on a selector with html.ph (a stray one in a sheet or a dialog rule would clip content)', rs.filter(r => /overflow(-x|-y)?:\s*hidden/.test(r.body)).every(r => r.sel.split(',').every(x => /^\s*html\.ph/.test(x))));
    check('the leftover controls container takes no room while the layout is on: html.ph .main-container { display: none }', rs.some(r => r.sel === 'html.ph .main-container' && /display:\s*none/.test(r.body)));
    const dlg = rs.filter(r => r.sel === 'html.ph .dialog-content');
    check('a dialog never gets taller than the screen and scrolls inside: html.ph .dialog-content { max-height: calc(var(--ph-h) - 2 x var(--sp-3)); overflow-y: auto } - once, in the phone media query', dlg.length === 1 && dlg[0].at.join() === '@media (max-width: 767px)' && /max-height:\s*calc\(var\(--ph-h\) - 2 \* var\(--sp-3\)\)/.test(dlg[0].body) && /overflow-y:\s*auto/.test(dlg[0].body) && /box-sizing:\s*border-box/.test(dlg[0].body), dlg.map(r => r.body.trim()).join(' | '));
    const btnRule = rs.filter(r => r.sel === 'html.ph .dialog-content button');
    check('every dialog button is --target (48px) high while the layout is on, whatever the pointer: html.ph .dialog-content button { min-height: var(--target) } (once, in the phone media query; the coarse rule above gave a finger 48 and a mouse at a phone width 41)', btnRule.length === 1 && btnRule[0].at.join() === '@media (max-width: 767px)' && /min-height:\s*var\(--target\)/.test(btnRule[0].body), btnRule.map(r => r.body.trim()).join(' | '));
    check('the dialogs a sheet opens are UI.dialog dialogs: they are aria-modal (what UI.overlay\'s outside-tap rule looks for) - ui.js sets it and the rule names it', /setAttribute\('aria-modal', 'true'\)/.test(read('UI_JS', 'ui.js')) && /closest\('\[aria-modal="true"\](, \.notice)?'\)/.test(read('UI_JS', 'ui.js')));
    check('commit 4: UI.overlay\'s outside-tap rule also leaves a tap on a notice alone (`.notice`): the notice lies over an open sheet under the phone layout, and dismissing it must not close the sheet', /closest\('\[aria-modal="true"\], \.notice'\)/.test(read('UI_JS', 'ui.js')));
    const sheetCss = rules(CSS.slice(0, marker)).filter(r => r.sel === '.overlay.sheet');
    check('the sheets scroll: UI.overlay\'s `.overlay.sheet` (above the block, shared with every overlay) has max-height 80dvh (80vh before it) and overflow auto', sheetCss.length === 1 && /max-height:\s*80vh;[\s\S]*max-height:\s*80dvh/.test(sheetCss[0].body) && /overflow:\s*auto/.test(sheetCss[0].body));
    const shs = rs.filter(r => /\.ph-sheet|#more-rail/.test(r.sel));
    check('the sheet rules of the block (.ph-sheet, #more-rail .more-settings) all start with html.ph and sit in the phone media query (' + shs.length + ' rules)', shs.length >= 3 && shs.every(r => r.sel.split(',').every(x => /^\s*html\.ph(\s|\[)/.test(x)) && r.at[0] === '@media (max-width: 767px)'), shs.map(r => r.sel).join(' ; '));
    check('the sheet host is laid out as rows that wrap, on the scale: html.ph .ph-sheet { flex-direction: row; flex-wrap: wrap; gap: var(--sp-3) }', shs.some(r => r.sel === 'html.ph .ph-sheet' && /flex-direction:\s*row/.test(r.body) && /flex-wrap:\s*wrap/.test(r.body) && /gap:\s*var\(--sp-3\)/.test(r.body)));
    // ---- commit 2 ----
    const stab = rs.filter(r => r.sel === 'html.ph .ph-subtabs');
    check('the sub-tab row\'s gap is 24px = calc(var(--sp-3) + var(--sp-2)) in every tab (the header tabs keep 32); no narrower gap below 340px - the row scrolls instead (overflow-x: auto)', stab.length === 1 && /gap:\s*calc\(var\(--sp-3\) \+ var\(--sp-2\)\)/.test(stab[0].body) && /overflow-x:\s*auto/.test(stab[0].body) && !rs.some(r => r.sel === 'html.ph .ph-subtabs' && r.at.length > 1) && !/var\(--sp-4\)/.test(stab[0].body));
    check('a sub-tab button has no side padding (the labels are 24px apart, the first starts at the gutter) and keeps its hit area through an ::after of half the gap on each side', rs.some(r => r.sel === 'html.ph .ph-subtab' && /padding:\s*0;/.test(r.body)) && rs.some(r => r.sel === 'html.ph .ph-subtab::after' && /left:\s*calc\(-1 \* \(var\(--sp-2\) \+ var\(--sp-1\)\)\)/.test(r.body)));
    const chipCss = rs.filter(r => /\.ph-chip\b/.test(r.sel));
    check('the chip rules are all html.ph in the phone media query: a 48px square (var(--target)), the selected chip black, a 4px colour bar at the bottom edge (' + chipCss.length + ' rules)', chipCss.length >= 3 && chipCss.every(r => /^html\.ph /.test(r.sel) && r.at[0] === '@media (max-width: 767px)') && rs.some(r => r.sel === 'html.ph .ph-chip' && /width:\s*var\(--target\)/.test(r.body) && /height:\s*var\(--target\)/.test(r.body)) && rs.some(r => r.sel === 'html.ph .ph-chip.active' && /background:\s*var\(--color-text\)/.test(r.body)) && rs.some(r => r.sel === 'html.ph .ph-chip-bar' && /height:\s*4px/.test(r.body) && /bottom:\s*0/.test(r.body)));
    check('the rail\'s sheet in Farbe hides Form\'s first row (Curve ... Neu anfangen) only for html.ph[data-tab="farbe"]: the Form sheet keeps it', rs.some(r => r.sel === 'html.ph[data-tab="farbe"] #more-rail > .more-row:not(.more-extra)' && /display:\s*none/.test(r.body)));
    check('the chip holder needs no CSS of its own and nothing above the phone block names a chip: it is hidden by its attribute outside the layout', !/ph-chip|ph-trail/.test(CSS.slice(0, marker)));
    // ---- commit 3 ----
    const hdr = rs.filter(r => /app-header/.test(r.sel));
    check('the header is the 40px rule in EVERY tab: the html.ph .app-header rules carry no [data-tab] (Form, Farbe and Netz are all covered), so the 72px of the coarse Farbe / Netz header is gone under html.ph', hdr.length >= 2 && hdr.every(r => !/data-tab/.test(r.sel)) && hdr.some(r => /height:\s*var\(--ph-header-h\)/.test(r.body)) && !rs.some(r => /data-tab="netz"/.test(r.sel) && /height|overflow|display: none/.test(r.body)));
    check('the page clip (overflow hidden, the viewport height) has no [data-tab] either: no tab scrolls under html.ph', rs.filter(r => /overflow(-y)?:\s*hidden/.test(r.body) && /^html\.ph/.test(r.sel) && /body/.test(r.sel)).every(r => !/data-tab/.test(r.sel)) && rs.some(r => r.sel.replace(/\s+/g, ' ') === 'html.ph, html.ph body'));
    const lines = rs.filter(r => /net-lines-btn/.test(r.sel));
    check('Net lines as an icon: ONLY in the tool row (html.ph .ph-toolrow #net-lines-btn), 48 x 48, its text emptied with font-size 0, the icon a ::before drawn with a mask of an inline SVG data URI (two wavy lines in currentColor, so the active state inverts it); all inside the phone media query (' + lines.length + ' rules)', lines.length === 2 && lines.every(r => /^html\.ph \.ph-toolrow #net-lines-btn(::before)?$/.test(r.sel) && r.at[0] === '@media (max-width: 767px)') && lines.some(r => r.sel === 'html.ph .ph-toolrow #net-lines-btn' && /font-size:\s*0/.test(r.body) && /width:\s*var\(--target\)/.test(r.body) && /height:\s*var\(--target\)/.test(r.body)) && lines.some(r => /::before$/.test(r.sel) && /background-color:\s*currentColor/.test(r.body) && /mask:\s*url\("data:image\/svg\+xml/.test(r.body) && /-webkit-mask:\s*url\("data:image\/svg\+xml/.test(r.body)));
    check('nothing above the phone block touches #net-lines-btn\'s look except its old rules: no ::before, no font-size 0 (768px and up keep the text button)', !/net-lines-btn[^{]*::before|#net-lines-btn[^{]*\{[^}]*font-size:\s*0/.test(CSS.slice(0, marker)));
    check('an element sketch.js hides (Reverse, the Fokus stepper) stays hidden in the panel whatever display its class gives it: html.ph .ph-slot [hidden] { display: none }', rs.some(r => r.sel === 'html.ph .ph-slot [hidden]' && /display:\s*none/.test(r.body)));
    check('the kind buttons are 60px wide in the panel and the text buttons (Both / X / Y, Reverse) are --target high: html.ph .ph-slot .net-kind-btn { width: 60px }, html.ph .ph-slot .layer-btn { min-height: var(--target) }', rs.some(r => r.sel === 'html.ph .ph-slot .net-kind-btn' && /width:\s*60px/.test(r.body)) && rs.some(r => r.sel === 'html.ph .ph-slot .layer-btn' && /min-height:\s*var\(--target\)/.test(r.body)));
    // ---- commit 4: the notices ----
    const nrules = rs.filter(r => /\.notices\b/.test(r.sel));
    const N = nrules.find(r => r.sel === 'html.ph .notices'), NO = nrules.find(r => r.sel === 'html.ph.overlay-open .notices');
    check('the notices rules: exactly TWO, `html.ph .notices` and `html.ph.overlay-open .notices`, both inside @media (max-width: 767px) (the block guard above); nothing else of the stack is restyled (no .notice rule in the block)', nrules.length === 2 && !!N && !!NO && nrules.every(r => r.at.length === 1 && r.at[0] === '@media (max-width: 767px)') && !rs.some(r => /\.notice(\b|-)/.test(r.sel) && !/\.notices\b/.test(r.sel)));
    check('while an overlay is open the stack goes to the TOP of the canvas: top = header + 8px (var(--ph-header-h) + var(--sp-2)), no transform, derived from the variables (no pixel value)', !!NO && /top:\s*calc\(var\(--ph-header-h\) \+ var\(--sp-2\)\)/.test(NO.body) && /transform:\s*none/.test(NO.body) && !/\d+px/.test(NO.body.replace(/var\(--[a-z0-9-]+\)/g, '')) && rs.indexOf(NO) > rs.indexOf(N));
    check('its anchor is derived from the layout variables: top = header + 8px above the canvas + --canvas-h - 8px (the bottom edge 8px above the canvas bottom), no fixed pixel value', !!N && /top:\s*calc\(var\(--ph-header-h\) \+ var\(--sp-2\) \+ var\(--canvas-h\) - var\(--sp-2\)\)/.test(N.body) && !/\d+px/.test(N.body.replace(/var\(--[a-z0-9-]+\)/g, '')));
    check('it grows UPWARD from that edge (translateY(-100%)), is as wide as the canvas (--canvas-w) at its left edge (--sp-3, the gutter), and lets go of the bottom anchor (bottom: auto)', !!N && /transform:\s*translateY\(-100%\)/.test(N.body) && /width:\s*var\(--canvas-w\)/.test(N.body) && /left:\s*var\(--sp-3\)/.test(N.body) && /bottom:\s*auto/.test(N.body));
    const base = rules(CSS.slice(0, marker)).filter(r => r.sel === '.notices');
    check('above the block the stack keeps its bottom anchor for 768px and up (and for every tab the layout does not apply to): `.notices { bottom: calc(16px + env(safe-area-inset-bottom, 0px)) }`, z-index 60', base.length === 1 && /bottom:\s*calc\(16px \+ env\(safe-area-inset-bottom, 0px\)\)/.test(base[0].body) && /z-index:\s*60/.test(base[0].body) && base[0].at.length === 0);
});


console.log('\n== the layer sheet in rows (sheets redesign, commit 3a) ==');
T('layer-rows', () => {
    const sh = config.sheets.layer, rowsFlat = [].concat.apply([], sh.blocks);
    const rowW = (row, key) => row.items.reduce((a, i) => a + (key === 'min' && i.wMin ? i.wMin : i.w), 0) + 8 * (row.items.length - 1);
    check('the layer sheet is data: two blocks (5 rows: 3 + 2), the ten .control-group wrappers of #layer-more-panel, each once, every id in index.html once', sh.blocks.length === 2 && sh.blocks[0].length === 3 && sh.blocks[1].length === 2 && rowsFlat.reduce((a, r) => a + r.items.length, 0) === 10 && rowsFlat.every(r => r.items.every(i => ids.filter(x => x === i.id).length === 1 && /^layer-.*-group$/.test(i.id))));
    check('the rows at 375 (343 available): 328 (3 shapes + 3 modes), 242 (node + size steppers), 104 (fold), 184 (offset X, offset Y, align: the typed fields are 60px until commit 3b), 172 (mesh x2 + rotation field)', rowsFlat.map(r => rowW(r)).join() === '328,242,104,184,172', rowsFlat.map(r => rowW(r)).join());
    check('at 320 (288 available) only the first row does not fit (328): it is the one row with wrap; the steppers have wMin 109 (242 -> 226) and everything else fits as it is', rowsFlat.filter(r => rowW(r, 'min') > 288).length === 1 && rowsFlat.filter(r => r.wrap).length === 1 && rowsFlat[0].wrap === true && rowW(rowsFlat[1], 'min') === 226);
    const API2 = API, H = (o) => API2.sheetHeight(config, 'layer', o);
    check('the expected height of the sheet at 375: 16 + 104 + 16 + 104 + 16 = 256 (the fold row collapsed), 312 with the fold row (hexagon layer); at 320 the wrap row adds 56: 312 / 368', H({ hide: ['layer-fold-group'] }) === 256 && H() === 312 && H({ narrow: true, hide: ['layer-fold-group'] }) === 312 && H({ narrow: true }) === 368, [H({ hide: ['layer-fold-group'] }), H(), H({ narrow: true, hide: ['layer-fold-group'] }), H({ narrow: true })].join());
    check('the base active: every group hidden = no rows and no blocks left: the height is only the padding (32)', H({ hide: [].concat.apply([], sh.blocks.map(b => [].concat.apply([], b.map(r => r.items.map(i => i.id))))) }) === 32);
    check('the engine knows no layer control: ui-phone.js names none of the ten group ids (the rows are data)', !/layer-[a-z-]*-group|layer-more-panel|btn-align|btn-mesh/.test(ENGINE.replace(/\/\/.*$/gm, '')) , (ENGINE.match(/layer-[a-z-]*-group/g) || []).join());
    check('the engine moves the groups whole with take() and does not clone them: buildBlocks() has no cloneNode and no innerHTML', (() => { const b = /function buildBlocks[\s\S]*?\n    }\n/.exec(ENGINE); return !!b && !/cloneNode|innerHTML/.test(b[0]) && /take\(it\.id, r\)/.test(b[0]); })());
    check('sketch.js still decides what shows: it shows and hides each of the ten groups through the `hidden` attribute (elt.hidden) the rows follow (and the fold group by the layer\'s own shape)', ['offsetXGroup', 'offsetYGroup', 'meshPresetGroup', 'shapeGroup', 'modeGroup', 'foldGroup', 'alignGroup', 'nodeCountGroup', 'shapeSizeGroup', 'rotationGroup'].every(v => new RegExp(v + '\\.elt\\.hidden = ').test(read('SKETCH_JS', 'sketch.js'))) && /foldGroup\.elt\.hidden = layer\.shape !== 'hex'/.test(read('SKETCH_JS', 'sketch.js')));
});
T('layer-rows-mutants', () => {
    const env = { ids: idSet };
    const mut = (name, fn, re) => { const c = clone(config); fn(c); const p = validate(c, env); check(`validate rejects: ${name}`, p.some(m => re.test(m)), p.join(' ; ') || 'no problem found'); };
    mut('a control listed twice in the layer sheet (the align group again in row 2 of block 2)', c => { c.sheets.layer.blocks[1][1].items.push({ id: 'layer-align-group', w: 48 }); }, /layer-align-group is listed twice/);
    mut('a control of the sheet also in a panel row of the tab (the rotation group in Raster)', c => { c.subtabs.raster.rows[0].items.push({ id: 'layer-rotation-group', w: 48 }); }, /layer-rotation-group is listed twice/);
    mut('a row 344px wide (the shape group widened by 16)', c => { c.sheets.layer.blocks[0][0].items[0].w = 176; }, /344px wide|more than the 343px/);
    mut('a row that does not fit 320px and does not wrap (the wrap flag removed from row 1)', c => { delete c.sheets.layer.blocks[0][0].wrap; }, /even with its narrow widths/);
    mut('a row marked wrap that fits 320px anyway (the fold row)', c => { c.sheets.layer.blocks[0][2].wrap = true; }, /is marked wrap but fits/);
    mut('the offset row with steppers 117px wide and no narrow width (117 + 117 + 48 + 16 = 298 > 288 at 320px)', c => { c.sheets.layer.blocks[1][0].items = [{ id: 'layer-offset-x-group', w: 117 }, { id: 'layer-offset-y-group', w: 117 }, { id: 'layer-align-group', w: 48 }]; }, /even with its narrow widths|and does not wrap/);
    mut('an id that is not in index.html', c => { c.sheets.layer.blocks[1][1].items.push({ id: 'layer-nirgends-group', w: 10 }); }, /neither in index\.html nor created/);
    mut('an empty row', c => { c.sheets.layer.blocks[0].push({ items: [] }); }, /is empty/);
    mut('an empty block', c => { c.sheets.layer.blocks.push([]); }, /has no rows/);
    mut('an item without a width', c => { delete c.sheets.layer.blocks[1][1].items[1].w; }, /has no width/);
    mut('a wMin above its w', c => { c.sheets.layer.blocks[0][1].items[0].wMin = 200; }, /wMin above its w/);
    mut('blocks that is not a list', c => { c.sheets.layer.blocks = 'rows'; }, /blocks must be a non-empty list/);
});
T('layer-rows-css', () => {
    const marker = CSS.indexOf('=== Phone layout ('), block = CSS.slice(marker), rs = rules(block.slice(block.indexOf('*/') + 2));
    const find = sel => rs.filter(r => r.sel.replace(/\s+/g, ' ') === sel);
    const inPhone = r => r.at[0] === '@media (max-width: 767px)';
    const sheetRules = rs.filter(r => /\.ph-sheet-(rows|block|row)/.test(r.sel) || /#layer-more-panel/.test(r.sel));
    check('the rows\' rules (' + sheetRules.length + ') all start with html.ph and sit in the phone media query; nothing above the block names a row, a block or the sheet\'s wrap class', sheetRules.length >= 8 && sheetRules.every(r => inPhone(r) && r.sel.split(',').every(x => /^\s*html\.ph[\s\[.]/.test(x))) && !/ph-sheet-(rows|block|row)/.test(CSS.slice(0, marker)));
    check('the sheet is a column of blocks 16px apart: html.ph .ph-sheet.ph-sheet-rows { flex-direction: column; gap: var(--sp-3) } (the timeline sheet, which has no blocks, keeps its wrapping row)', find('html.ph .ph-sheet.ph-sheet-rows').length === 1 && /flex-direction:\s*column/.test(find('html.ph .ph-sheet.ph-sheet-rows')[0].body) && /gap:\s*var\(--sp-3\)/.test(find('html.ph .ph-sheet.ph-sheet-rows')[0].body));
    check('a block is a column of rows 8px apart (gap: var(--sp-2)), a row a flex row, left aligned, 8px between its items', /flex-direction:\s*column/.test(find('html.ph .ph-sheet-block')[0].body) && /gap:\s*var\(--sp-2\)/.test(find('html.ph .ph-sheet-block')[0].body) && /flex-direction:\s*row/.test(find('html.ph .ph-sheet-row')[0].body) && /justify-content:\s*flex-start/.test(find('html.ph .ph-sheet-row')[0].body) && /gap:\s*var\(--sp-2\)/.test(find('html.ph .ph-sheet-row')[0].body));
    check('a collapsed row and block take no room: html.ph .ph-sheet-block[hidden], html.ph .ph-sheet-row[hidden] { display: none } (the gap goes with them)', rs.some(r => /\.ph-sheet-block\[hidden\]/.test(r.sel) && /\.ph-sheet-row\[hidden\]/.test(r.sel) && /display:\s*none/.test(r.body)));
    check('a group in a row stays hidden when sketch.js hides it: html.ph .ph-sheet-row .control-group[hidden] { display: none } beats the row rule', find('html.ph .ph-sheet-row .control-group[hidden]').length === 1 && /display:\s*none/.test(find('html.ph .ph-sheet-row .control-group[hidden]')[0].body));
    check('a group in a row is a flex row of its own (the label is display: none by the label rule), left aligned, no margin or padding', /flex-direction:\s*row/.test(find('html.ph .ph-sheet-row .control-group')[0].body) && /margin:\s*0/.test(find('html.ph .ph-sheet-row .control-group')[0].body) && /padding:\s*0/.test(find('html.ph .ph-sheet-row .control-group')[0].body) && /label[^{]*\{\s*display:\s*none/.test(CSS.slice(0, marker)));
    check('the typed fields are 60 x --target (48px at a coarse pointer): html.ph .ph-sheet-row .control-group > input[type="number"]', find('html.ph .ph-sheet-row .control-group > input[type="number"]').length === 1 && /width:\s*60px/.test(find('html.ph .ph-sheet-row .control-group > input[type="number"]')[0].body) && /height:\s*var\(--target\)/.test(find('html.ph .ph-sheet-row .control-group > input[type="number"]')[0].body));
    const wrap = rs.filter(r => /\.ph-sheet-row-wrap/.test(r.sel)), nar = rs.filter(r => r.at.length > 1 && /max-width: 339px/.test(r.at[1]) && /#layer-more-panel \.stepper/.test(r.sel));
    check('below 340px the wrap row wraps (flex-wrap: wrap, in a nested @media (max-width: 339px) only) and the sheet\'s steppers give up 8px (40px field)', wrap.length === 1 && wrap[0].at[1] === '@media (max-width: 339px)' && /flex-wrap:\s*wrap/.test(wrap[0].body) && nar.length === 1 && /width:\s*40px/.test(nar[0].body));
    check('the steppers of the sheet are as wide as the Form row\'s: the field is --target wide (html.ph #layer-more-panel .stepper > input[type="number"]: an id rule of the layer block would win over a class)', rs.some(r => r.sel === 'html.ph #layer-more-panel .stepper > input[type="number"]' && /width:\s*var\(--target\)/.test(r.body) && r.at.length === 1));
    check('every length in those rules is on the scale (0, var(--sp-N), --target, 60px, 40px): no other px value in a gap, margin or padding', sheetRules.every(r => { const m = r.body.match(/\b(gap|margin|padding)[a-z-]*:\s*[^;]+/g) || []; return m.every(d => !/\d+px/.test(d)); }));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
