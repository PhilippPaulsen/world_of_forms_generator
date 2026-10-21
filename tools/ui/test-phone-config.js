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
    t.subtabs.forEach(s => { const st = cfg.subtabs[s]; if (st && st.rows) st.rows.forEach(r => r.items.forEach(it => out.push(it.id))); });
    return out;
};

console.log('== the real config ==');
T('real', () => {
    const problems = validate(config, { ids: idSet });
    check('validate(config, the ids of index.html) finds nothing', problems.length === 0, problems.join(' ; ') || 'no problems');
    check('the query is the phone query (max-width: 767px) - the one ui.js calls SHEET_QUERY', config.query === '(max-width: 767px)' && /SHEET_QUERY = '\(max-width: 767px\)'/.test(read('UI_JS', 'ui.js')));
    check('three tabs: form, farbe, netz; ONLY Form is covered (1a and 1b), Farbe and Netz release to their original places', Object.keys(config.tabs).join() === 'form,farbe,netz' && config.tabs.form.covered === true && config.tabs.farbe.covered === false && config.tabs.netz.covered === false);
    const labels = tab => config.tabs[tab].subtabs.map(s => config.subtabs[s].label).join(' | ');
    check('the sub-tabs of each tab (the targets): Form: Raster | Ebenen | Zeit; Farbe: Harmonie | Spuren | Ebenen | Zeit; Netz: Art | Achsen | Ebenen | Zeit', labels('form') === 'Raster | Ebenen | Zeit' && labels('farbe') === 'Harmonie | Spuren | Ebenen | Zeit' && labels('netz') === 'Art | Achsen | Ebenen | Zeit', labels('form') + ' / ' + labels('farbe') + ' / ' + labels('netz'));
    check('"ebenen" and "zeit" are defined ONCE (one entry each) and listed by every tab', ['ebenen', 'zeit'].every(s => Object.keys(config.subtabs).filter(k => k === s).length === 1 && Object.keys(config.tabs).every(t => config.tabs[t].subtabs.includes(s))));
    check('the sub-tabs of Farbe and Netz that are not shared are STUBS (no rows); Form\'s three have rows', ['harmonie', 'spuren', 'art', 'achsen'].every(s => config.subtabs[s].stub === true && !config.subtabs[s].rows) && ['raster', 'ebenen', 'zeit'].every(s => !config.subtabs[s].stub && config.subtabs[s].rows.length >= 1));
    check('the panel is 104px: two rows of 48 and an 8px gap; the stack chrome is 48 + 56 + 44 + 8 + 104 = 260', config.tabs.form.panelH === 104 && chromeH(config, 'form') === 260);
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
    mut('a covered tab with a stub sub-tab', c => { c.tabs.form.subtabs.push('art'); }, /covered, but sub-tab art is a stub/);
    mut('a sub-tab that is not defined', c => { c.tabs.form.subtabs.push('nirgends'); }, /nirgends is not defined/);
    mut('a sub-tab listed twice in a tab', c => { c.tabs.form.subtabs.push('zeit'); }, /zeit is listed twice/);
    mut('an uncovered tab with content in a sub-tab of its own', c => { c.subtabs.art = { label: 'Art', rows: [{ items: [{ id: 'btn-undo', w: 48 }] }] }; }, /not covered, but sub-tab art has content/);
    mut('an uncovered tab with a tool row', c => { c.tabs.netz.toolRow = 'form'; }, /not covered, but has a tool row/);
    mut('a stub with rows', c => { c.subtabs.harmonie.rows = [{ items: [{ id: 'btn-undo', w: 48 }] }]; }, /a stub has no rows/);
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
    check('--ph-header-h, --ph-toolrow-h, --ph-subtabs-h, --ph-gap, --panel-h in the CSS are the sizes of the config (48, 56, 44, 8, 104)', tok('ph-header-h') === S.header + 'px' && tok('ph-toolrow-h') === S.toolRow + 'px' && tok('ph-subtabs-h') === S.subtabs + 'px' && tok('ph-gap') === S.gap + 'px' && tok('panel-h') === config.tabs.form.panelH + 'px', [tok('ph-header-h'), tok('ph-toolrow-h'), tok('ph-subtabs-h'), tok('ph-gap'), tok('panel-h')].join(' '));
    check('--chrome-h is the sum of those five (header + tool row + sub-tab row + gap + panel)', tok('chrome-h') === 'calc(var(--ph-header-h) + var(--ph-toolrow-h) + var(--ph-subtabs-h) + var(--ph-gap) + var(--panel-h))', tok('chrome-h'));
    check('the coarse target is forced to 48px while the phone layout is on (a mouse at a narrow width gets the same boxes)', tok('target') === '48px' && S.target === 48);
    check('the canvas: --canvas-ratio 1; --canvas-h = min(100vw / ratio, the viewport height - --chrome-h); --canvas-w = --canvas-h x ratio', tok('canvas-ratio') === '1' && tok('canvas-h') === 'min(calc(100vw / var(--canvas-ratio)), calc(var(--ph-h) - var(--chrome-h)))' && tok('canvas-w') === 'calc(var(--canvas-h) * var(--canvas-ratio))', tok('canvas-h'));
    check('the viewport height is svh where it exists and the pixel fallback (--ph-inner-h, set from window.innerHeight by the script) elsewhere', tok('ph-h') === 'var(--ph-inner-h, 100vh)' && /@supports \(height: 100svh\)\s*\{\s*html\.ph\s*\{\s*--ph-h:\s*100svh;/.test(CSS) && /--ph-inner-h/.test(ENGINE) && /innerHeight/.test(ENGINE));
    check('the canvas box uses --canvas-w and --canvas-h and no margin (the 2px frame is drawn inside the bitmap; the bitmap, the sketch and the pointer mapping are not touched)', /html\.ph \.canvas-row #canvas-container \{[^}]*width: var\(--canvas-w\);[^}]*height: var\(--canvas-h\);[^}]*margin: 0;/.test(CSS));
});

console.log('\n== the script tags ==');
T('tags', () => {
    const tags = []; htmlNoComments.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g, (m, s) => { tags.push(s); return m; });
    const at = n => tags.findIndex(s => s.startsWith(n + '?') || s === n);
    const ver = n => (tags[at(n)] || '').split('?v=')[1];
    check('ui-phone-config.js and ui-phone.js are loaded, config first', at('ui-phone-config.js') >= 0 && at('ui-phone.js') === at('ui-phone-config.js') + 1);
    check('both come after ui-layers.js, ui-timeline.js and ui-rail.js (the strips are filled, the handlers bound) - and after nav.js', ['ui-layers.js', 'ui-timeline.js', 'ui-rail.js', 'nav.js'].every(n => at(n) >= 0 && at(n) < at('ui-phone-config.js')));
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
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
