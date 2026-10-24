// Guard for the pairing view of the timeline sheet (sheets redesign, commit 5b): the pure model in ui-phone-pairing.js (chips, clamping, the enabled states, the segment options, one versus several segments, the
// selection following the End line through ▲ ▼), both languages from the REAL dictionary, the places it is wired (index.html loads it between the timeline view and the config, the sources of the model it forwards to and
// the premises the selection rule rests on, the CSS that shows it only under html.ph, the engine's release of aria-haspopup). The DOM part (forwarding to exactly the right model button of the right row, once; the
// model rebuilt after every action; release) runs in tools/ui/test-phone-engine.js with the real ui.js. No browser.
//   node tools/ui/test-phone-pairing.js
//   UI_PHONE_PAIRING_JS=... UI_I18N_JS=... INDEX_HTML=... STYLE_CSS=... SKETCH_JS=... UI_PHONE_JS=... PHONE_CONFIG_JS=... node tools/ui/test-phone-pairing.js        (sabotage runs)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const SRC = read('UI_PHONE_PAIRING_JS', 'ui-phone-pairing.js');
const M = require(process.env.UI_PHONE_PAIRING_JS || path.join(ROOT, 'ui-phone-pairing.js'));
const HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css'), SKETCH = read('SKETCH_JS', 'sketch.js'), ENGINE = read('UI_PHONE_JS', 'ui-phone.js');
const CONFIG = require(process.env.PHONE_CONFIG_JS || path.join(ROOT, 'ui-phone-config.js')).config;

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };
const J = x => JSON.stringify(x);

// the real dictionary, in a vm
const ctx = vm.createContext({ window: {}, document: undefined, console });
vm.runInContext(read('UI_I18N_JS', 'ui-i18n.js'), ctx, { filename: 'ui-i18n.js' });
const I = ctx.window.uiI18n || vm.runInContext('typeof uiI18n !== "undefined" ? uiI18n : window.uiI18n', ctx);
const tr = lang => (key, p) => { I.setLang(lang); return I.t(key, p); };

const rows = (spec) => spec.map(r => ({ upOff: !!r[0], downOff: !!r[1], variant: r[2] ? { k: r[2][0], c: r[2][1], prevOff: false, nextOff: false } : null }));
const model = (n, extra) => Object.assign({ segCount: 1, segValue: 0, rows: rows(Array.from({ length: n }, (_, i) => [i === 0, i === n - 1, [1, 12]])), resetHidden: true }, extra || {});

console.log('== the pure model ==');
T('model-chips', () => {
    const v = M.phonePairingModel({ m: model(4), selected: 0, open: true });
    check('one chip per line, numbered from the row index (1..4), the first selected by default', v.count === 4 && J(v.chips) === J([{ n: 1, selected: true }, { n: 2, selected: false }, { n: 3, selected: false }, { n: 4, selected: false }]) && v.selected === 0);
    check('the selected line is the one asked for (3: chip 3 only)', J(M.phonePairingModel({ m: model(4), selected: 2, open: true }).chips.map(c => c.selected)) === J([false, false, true, false]));
    check('the selection is CLAMPED when the number of lines changes: 3 selected of 4, then of 2 lines -> the last (2); negative or fractional input -> the first', M.phonePairingModel({ m: model(2), selected: 3, open: true }).selected === 1 && M.phonePairingModel({ m: model(4), selected: -5, open: true }).selected === 0 && M.phonePairingModel({ m: model(4), selected: 2.7, open: true }).selected === 2);
    const e = M.phonePairingModel({ m: model(0), selected: 3, open: true });
    check('no lines: no chips, selected -1, ▲ ▼ ⇄ ‹ › and reset all disabled (the reset without a reason)', e.count === 0 && e.chips.length === 0 && e.selected === -1 && !e.up.enabled && !e.down.enabled && !e.flip.enabled && !e.variant.enabled && !e.variant.prevEnabled && !e.reset.enabled && e.reset.reason === null && e.variant.text === '\u2013');
    check('without any input the model is the empty one (no throw)', M.phonePairingModel().count === 0 && M.phonePairingModel({}).segment.shown === false);
});
T('model-enabled', () => {
    const m = model(3);
    const first = M.phonePairingModel({ m: m, selected: 0, open: true }), mid = M.phonePairingModel({ m: m, selected: 1, open: true }), last = M.phonePairingModel({ m: m, selected: 2, open: true });
    check('▲ is disabled on the first row, ▼ on the last, both enabled between (they mirror the model\'s own disabled attributes)', !first.up.enabled && first.down.enabled && mid.up.enabled && mid.down.enabled && last.up.enabled && !last.down.enabled);
    const odd = M.phonePairingModel({ m: Object.assign(model(3), { rows: [{ upOff: true, downOff: true, variant: null }, { upOff: false, downOff: true, variant: null }, { upOff: false, downOff: false, variant: null }] }), selected: 0, open: true });
    check('the model\'s buttons decide, not the position: row 1 disabled both ways stays disabled both ways', !odd.up.enabled && !odd.down.enabled);
    check('⇄ is enabled whenever there is a selected line', first.flip.enabled && mid.flip.enabled && last.flip.enabled);
    check('the variant text is the selected row\'s k/c from the model ("3/12"); both buttons follow the model\'s disabled state', M.phonePairingModel({ m: model(2, { rows: [{ upOff: true, downOff: false, variant: { k: 3, c: 12, prevOff: false, nextOff: true } }, { upOff: false, downOff: true, variant: null }] }), selected: 0, open: true }).variant.text === '3/12' && !M.phonePairingModel({ m: model(2, { rows: [{ upOff: true, downOff: false, variant: { k: 3, c: 12, prevOff: false, nextOff: true } }, { upOff: false, downOff: true, variant: null }] }), selected: 0, open: true }).variant.nextEnabled);
    const nov = M.phonePairingModel({ m: model(2, { rows: [{ upOff: true, downOff: false, variant: null }, { upOff: false, downOff: true, variant: null }] }), selected: 1, open: true });
    check('a row with no variant stepper in the model (one variant): "1/1", both variant buttons disabled', nov.variant.text === '1/1' && !nov.variant.enabled && !nov.variant.prevEnabled && !nov.variant.nextEnabled);
});
T('model-reset', () => {
    const def = M.phonePairingModel({ m: model(3, { resetHidden: true }), selected: 1, open: true }), chg = M.phonePairingModel({ m: model(3, { resetHidden: false }), selected: 1, open: true });
    check('the model hides its reset button (the pairing is the default): the icon is disabled with the reason timeline.pairingDefault', !def.reset.enabled && def.reset.reason === 'timeline.pairingDefault');
    check('the model shows it: the icon is enabled, no reason', chg.reset.enabled && chg.reset.reason === null);
});
T('model-segments', () => {
    const one = M.phonePairingModel({ m: model(3, { segCount: 1 }), selected: 0, open: true }), three = M.phonePairingModel({ m: model(3, { segCount: 3, segValue: 1 }), selected: 0, open: true }), none = M.phonePairingModel({ m: model(0, { segCount: 0 }), selected: 0, open: true });
    check('ONE segment: the select is not shown (the options exist, "1→2")', one.segment.shown === false && one.segment.options.length === 1 && one.segment.options[0].label === '1\u21922');
    check('THREE segments: shown, options "1→2", "2→3", "3→4" with the values 0, 1, 2 (the label from the position, not from the model\'s "Segment 1: Layer 3 → Layer 1"), the model\'s value selected', three.segment.shown === true && J(three.segment.options) === J([{ value: '0', label: '1\u21922' }, { value: '1', label: '2\u21923' }, { value: '2', label: '3\u21924' }]) && three.segment.value === '1');
    check('no segment: not shown, no options; a value out of range is clamped into the options (a segment dropped meanwhile)', none.segment.shown === false && none.segment.options.length === 0 && M.phonePairingModel({ m: model(3, { segCount: 2, segValue: 9 }), selected: 0, open: true }).segment.value === '1');
});
T('model-follow', () => {
    // the selection follows the End line: perm[row] = End line of Start line `row`; the model's ▲ / ▼ swap the End lines of two neighbouring rows
    const swap = (perm, a, b) => { const q = perm.slice(); [q[a], q[b]] = [q[b], q[a]]; return q; };
    const perms = [[0, 1, 2, 3], [3, 0, 2, 1], [1, 3, 0, 2]];
    const ok = perms.every(p0 => [1, 2, 3].every(r => { const after = swap(p0, r, r - 1); return M.followSelection('up', r, 4, p0, after) === r - 1 && after[r - 1] === p0[r]; }) && [0, 1, 2].every(r => { const after = swap(p0, r, r + 1); return M.followSelection('down', r, 4, p0, after) === r + 1 && after[r + 1] === p0[r]; }));
    check('▲ and ▼: on every row of three real permutations the selection ends on the row that now holds the End line it was on', ok);
    check('⇄, ‹, ›, reset and the segment change keep the row', ['flip', 'prev', 'next', 'reset'].every(a => M.followSelection(a, 2, 4, [0, 1, 2, 3], [0, 1, 2, 3]) === 2));
    check('a move the model refused (the permutation did not change): the selection stays on its row', M.followSelection('up', 2, 4, [0, 1, 2, 3], [0, 1, 2, 3]) === 2 && M.followSelection('down', 0, 4, [3, 2, 1, 0], [3, 2, 1, 0]) === 0);
    check('without the permutation: one row up or down, clamped at both ends', M.followSelection('up', 1, 4, null, null) === 0 && M.followSelection('up', 0, 4, null, null) === 0 && M.followSelection('down', 2, 4, undefined, undefined) === 3 && M.followSelection('down', 3, 4, null, null) === 3);
    check('an unusable permutation (the End line is gone) falls back to one row', M.followSelection('down', 1, 4, [0, 1, 2, 3], [7, 7, 7, 7]) === 2);
});
T('model-signature', () => {
    const base = M.phonePairingModel({ m: model(3), selected: 1, open: true }), s0 = M.modelSignature(base, 'de');
    const diffs = {
        'the language': M.modelSignature(base, 'en'), 'the open state': M.modelSignature(M.phonePairingModel({ m: model(3), selected: 1, open: false }), 'de'), 'the selection': M.modelSignature(M.phonePairingModel({ m: model(3), selected: 2, open: true }), 'de'),
        'the number of lines': M.modelSignature(M.phonePairingModel({ m: model(4), selected: 1, open: true }), 'de'), 'the reset state': M.modelSignature(M.phonePairingModel({ m: model(3, { resetHidden: false }), selected: 1, open: true }), 'de'),
        'the segment count': M.modelSignature(M.phonePairingModel({ m: model(3, { segCount: 2 }), selected: 1, open: true }), 'de'), 'a variant number': M.modelSignature(M.phonePairingModel({ m: model(3, { rows: rows([[true, false, [1, 12]], [false, false, [2, 12]], [false, true, [1, 12]]]) }), selected: 1, open: true }), 'de'),
    };
    check('the signature changes with every part of the view state (' + Object.keys(diffs).join(', ') + ') and is equal for equal states', Object.keys(diffs).every(k => diffs[k] !== s0) && s0 === M.modelSignature(M.phonePairingModel({ m: model(3), selected: 1, open: true }), 'de'));
});

console.log('\n== the texts: the real dictionary ==');
T('i18n', () => {
    const de = tr('de'), en = tr('en');
    const keys = Object.keys(M.T);
    check('every German fallback of the view is exactly the dictionary\'s German (' + keys.length + ' keys), and every key has an English text that differs from it where the languages differ', keys.every(k => I.has(k) && (I.setLang('de'), I.t(k, { n: '{n}' }) === M.T[k]) && en(k, { n: '{n}' }).length > 0));
    check('the new key: "Zuordnung ist Standard" / "Pairing is the default"', de('timeline.pairingDefault') === 'Zuordnung ist Standard' && en('timeline.pairingDefault') === 'Pairing is the default');
    check('the names of the icons in English: Line 3, Move end up, Move end down, Reverse direction, Previous variant, Next variant, Reset pairing, Segment', en('timeline.line', { n: 3 }) === 'Line 3' && en('timeline.endUp') === 'Move end up' && en('timeline.endDown') === 'Move end down' && en('timeline.reverse') === 'Reverse direction' && en('timeline.variantPrev') === 'Previous variant' && en('timeline.variantNext') === 'Next variant' && en('timeline.resetPairing') === 'Reset pairing' && en('timeline.segment') === 'Segment');
    I.setLang('de');
});

console.log('\n== where it is wired ==');
T('wiring', () => {
    const order = ['ui-timeline.js', 'ui-phone-timeline.js', 'ui-phone-pairing.js', 'ui-phone-config.js', 'ui-phone.js'].map(f => HTML.indexOf('src="' + f + '?v='));
    check('index.html loads ui-phone-pairing.js with a ?v= after ui-timeline.js and ui-phone-timeline.js (the icon row it puts the select into) and before ui-phone-config.js', order.every(i => i > 0) && order.every((x, i) => !i || x > order[i - 1]), order.join());
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    check('no MutationObserver and no polling timer: the view refreshes on UI ticks and after a click, by a signature compare', !/MutationObserver|setInterval|setTimeout|requestAnimationFrame/.test(code) && /UI\.onSync\(sync\)/.test(code) && /modelSignature\(vm/.test(code));
    check('the view holds NO reference to anything inside the model: no model element is kept in a variable of the view (every lookup is inside a function, at click time or tick time)', !/^ {4}(const|let|var) [^=\n]+= doc\.getElementById\('(timeline-pairing|btn-timeline-pairing)/m.test(code) && !/^ {4}(const|let|var) (row|rowEl|btn|button)\b/m.test(code) && /function modelRows\(\) \{ return kids\(doc\.getElementById\('timeline-pairing-list'\)\)/.test(code) && /const row = modelRows\(\)\[selected\]/.test(code));
    check('every forwarding is ONE click on one model element: ▲ ▼ ⇄ ‹ › on a button of the selected row, reset on #btn-timeline-pairing-reset, the select sets #timeline-pairing-segment and dispatches change (no loop over rows or buttons)', (code.match(/\.click\(\)/g) || []).length === 2 && !/forEach\([^)]*\.click|\.map\([^)]*\.click/.test(code) && /m\.value = seg\.value/.test(code) && /m\.dispatchEvent\(ev\)/.test(code));
    check('a dead control is not added: the list icon "Alle Zuordnungen" (timeline.listAll) comes in 5c, nothing in the view or the config mentions it', !/listAll|Alle Zuordnungen|All pairings/.test(code) && !/listAll/.test(J(CONFIG.sheets.timeline)));
    check('the view never touches sketch.js\'s state: no assignment to the timeline, no call of a sketch.js function except the read of timelineSegmentInfo', !/timeline\.(segment|keyframe)[A-Za-z]* *=[^=]/.test(code) && (code.match(/timelineSegmentInfo\(/g) || []).length === 1 && !/moveTimelinePairing|setTimelinePairing|commitTimelineSegmentPairing|resetTimelinePairing/.test(code));
    const cfg = J(CONFIG.sheets.timeline);
    check('the config names the four containers of the view, and no id of the old editor (it is the model: parked by the CSS, in no row)', ['ph-tl-chips', 'ph-tl-moves', 'ph-tl-variant', 'ph-tl-reset'].every(id => cfg.indexOf(id) > 0 && CONFIG.createdByScript[id] === 'ui-phone-pairing.js') && cfg.indexOf('timeline-pairing') < 0 && cfg.indexOf('ph-tl-') > 0);
});
T('model-premises', () => {
    // what sketch.js renders is what the view reads and forwards to: its classes, the order of the buttons in a row and the rule of ▲ ▼
    const render = SKETCH.slice(SKETCH.indexOf('function renderTimelinePairingEditor()'), SKETCH.indexOf('window.renderTimelinePairingEditor = renderTimelinePairingEditor'));
    check('a row is a div.pairing-row; its buttons are appended in the order ▲, ▼, ⇄ (the view takes the first three buttons of a row in that order) and then the variant stepper span.pairing-variant', /r\.className = 'pairing-row'/.test(render) && render.indexOf('r.appendChild(up)') < render.indexOf('r.appendChild(down)') && render.indexOf('r.appendChild(down)') < render.indexOf('r.appendChild(flip)') && render.indexOf('r.appendChild(flip)') < render.indexOf('r.appendChild(stepper)') && /up\.disabled = row === 0/.test(render) && /down\.disabled = row === info\.n - 1/.test(render) && /pairing-flip-btn/.test(render));
    check('the variant stepper has .pairing-variant-prev, .pairing-variant-count (data-k, data-c = the numbers the view shows) and .pairing-variant-next, and exists only for a row with more than one variant', /pairing-variant-prev/.test(render) && /pairing-variant-next/.test(render) && /countEl\.dataset\.k = String\(vIdx \+ 1\)/.test(render) && /countEl\.dataset\.c = String\(vCount\)/.test(render) && /if \(vCount > 1\)/.test(render));
    check('the reset button is hidden while the pairing is the default (the view\'s "Zuordnung ist Standard"), the segment select\'s options are rebuilt on every render and its value is the segment', /timelinePairingResetBtn\.elt\.hidden = info\.isDefault/.test(render) && /sel\.innerHTML = ''/.test(render) && /sel\.value = String\(seg\)/.test(render) && /timelinePairing(Panel|Segment)/.test(render));
    check('▲ / ▼ SWAP the End assignment of the row with its neighbour\'s (so the End line moves to the neighbouring row and the selection follows it) and the commit re-renders the editor synchronously (updateTimelineControls -> renderTimelinePairingEditor): the view can read the new state in the same call stack', /\[perm\[row\], perm\[other\]\] = \[perm\[other\], perm\[row\]\]/.test(SKETCH) && /function commitTimelineSegmentPairing[\s\S]*?updateTimelineControls\(\);/.test(SKETCH) && /function updateTimelineControls\(\)[\s\S]*?renderTimelinePairingEditor\(\);/.test(SKETCH) && /function resetTimelinePairing[\s\S]*?updateTimelineControls\(\);/.test(SKETCH));
    check('the segment select\'s own change handler reads its value and re-renders (what the view\'s dispatch triggers)', /timelinePairingSegmentSelect\.elt\.addEventListener\('change', \(\) => \{\s*timelinePairingSegment = parseInt\(timelinePairingSegmentSelect\.elt\.value, 10\) \|\| 0;/.test(SKETCH) && /timelinePairingResetBtn\.elt\.addEventListener\('click', \(\) => resetTimelinePairing\(timelinePairingSegment\)\)/.test(SKETCH));
    check('timelineSegmentInfo(segment) (the permutation the selection follows) is a global function of sketch.js with { ok, perm }', /\nfunction timelineSegmentInfo\(segmentIndex\)/.test(SKETCH) && /perm,/.test(SKETCH.slice(SKETCH.indexOf('function timelineSegmentInfo'), SKETCH.indexOf('function timelineSegmentInfo') + 4000)));
});
T('css', () => {
    const marker = CSS.indexOf('=== Phone layout ('), block = CSS.slice(marker), body = block.slice(block.indexOf('*/') + 2);
    // a tolerant rule reader: selector, body and the media queries around it
    const rs = []; let depth = 0, at = [], i = 0, start = 0, stack = [];
    for (; i < body.length; i++) {
        const c = body[i];
        if (c === '/' && body[i + 1] === '*') { const e = body.indexOf('*/', i + 2); i = e + 1; start = i + 1; continue; }
        if (c === '{') { const head = body.slice(start, i).trim(); if (head[0] === '@') { stack.push(head); } else { const e = body.indexOf('}', i); rs.push({ sel: head.replace(/\s+/g, ' '), body: body.slice(i + 1, e), at: stack.slice() }); i = e; } start = i + 1; }
        else if (c === '}') { stack.pop(); start = i + 1; }
    }
    const mine = rs.filter(r => /ph-tl-(segment|chips?|moves|variant|vcount)|#timeline-pairing/.test(r.sel));
    check('the pairing view\'s rules (' + mine.length + ') all start with html.ph and sit in the phone media query (maybe a nested one for the narrow phone), none above the phone block', mine.length >= 8 && mine.every(r => r.at[0] === '@media (max-width: 767px)' && r.sel.split(',').every(x => /^\s*html\.ph[\s\[.#:]/.test(x))) && !/ph-tl-(segment|chips|moves|variant|vcount)/.test(CSS.slice(0, marker)));
    const one = sel => rs.filter(r => r.sel === sel);
    check('the old editor is PARKED: html.ph #timeline-pairing { display: none }', one('html.ph #timeline-pairing').length === 1 && /display:\s*none/.test(one('html.ph #timeline-pairing')[0].body));
    const seg = one('html.ph .ph-tl-segment')[0];
    check('the segment select is 84px wide and --target high, a 1px frame, 16px type (no iOS zoom), no native look (an own chevron)', !!seg && /width:\s*84px/.test(seg.body) && /height:\s*var\(--target\)/.test(seg.body) && /font-size:\s*16px/.test(seg.body) && /appearance:\s*none/.test(seg.body) && /border:\s*1px solid var\(--color-text\)/.test(seg.body) && one('html.ph .ph-tl-segment[hidden]').length === 1);
    const chips = one('html.ph .ph-tl-chips')[0];
    check('the chips scroll sideways (overflow-x: auto, no scrollbar) and take the row\'s width (flex 1 1 0, min-width 0)', !!chips && /overflow-x:\s*auto/.test(chips.body) && /flex:\s*1 1 0/.test(chips.body) && /min-width:\s*0/.test(chips.body) && /scrollbar-width:\s*none/.test(chips.body));
    const vc = one('html.ph .ph-tl-vcount')[0], vs = one('html.ph .ph-tl-variant .ph-tl-sep')[0];
    check('the k/c cell is 34px wide and centred; the hairline of the variant group has no margin of its own (the 8px gaps give the 323px)', !!vc && /width:\s*34px/.test(vc.body) && /text-align:\s*center/.test(vc.body) && !!vs && /margin:\s*0\b/.test(vs.body));
    const nar = rs.filter(r => r.sel === 'html.ph .ph-tl-variant .ph-tl-sep' && r.at.length === 2);
    check('below 355px (323 + 32: the row wraps there) the hairline in front of the variant group is hidden, so a wrapped second line does not start with it', nar.length === 1 && nar[0].at[1] === '@media (max-width: 354px)' && /display:\s*none/.test(nar[0].body));
    const wrap = rs.filter(r => /\.ph-sheet-row-wrap/.test(r.sel));
    check('a wrap row wraps whenever it does not fit (not only below 340px: the layer sheet\'s 328px row overflowed at 340 to 359px, the pairing row\'s 323px at 340 to 354px)', wrap.length === 1 && wrap[0].at.length === 1 && /flex-wrap:\s*wrap/.test(wrap[0].body));
    check('every gap, margin and padding of the view\'s rules is on the scale (var(--sp-N), 0, a calc of them): no px value', mine.every(r => (r.body.match(/\b(gap|margin|padding)[a-z-]*:\s*[^;]+/g) || []).every(d => !/\d+px/.test(d))));
    const icons = one('html.ph #ph-tl-icons')[0];
    check('the icon row has 8px gaps (var(--sp-2)) since the select joined it: 286px', !!icons && /gap:\s*var\(--sp-2\)/.test(icons.body));
});
T('release-popup', () => {
    const code = ENGINE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    check('the engine remembers what the trigger had before UI.overlay marked it (aria-haspopup), takes the mark away at release (or puts the old value back) and puts it back with every apply', /popup: trigger\.getAttribute\('aria-haspopup'\)/.test(code) && /h\.trigger\.removeAttribute\('aria-haspopup'\)/.test(code) && /h\.trigger\.setAttribute\('aria-haspopup', h\.popup\)/.test(code) && /h\.trigger\.setAttribute\('aria-haspopup', 'dialog'\)/.test(code));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
