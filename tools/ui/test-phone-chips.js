// Guard for the pure part of the Spuren chip view (phone layout, commit 2): ui-phone-chips.js trailModel(), resolveSelection(), trailSignature(), readRows(). No browser; the DOM part (forwarding, rebuilding,
// the holder) is tested against the fake DOM in tools/ui/test-phone-engine.js.
//   node tools/ui/test-phone-chips.js
//   UI_PHONE_CHIPS_JS=... node tools/ui/test-phone-chips.js        (sabotage runs)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const FILE = process.env.UI_PHONE_CHIPS_JS || path.join(ROOT, 'ui-phone-chips.js');
const API = require(FILE);
const { trailModel, resolveSelection, trailSignature, readRows, labelFor, highlightFor, hoverStep } = API;

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };
const row = (key, color, faceCount, n, stepper) => ({ key, color, faceCount, n, stepper });

console.log('== the model ==');
T('model', () => {
    const rows = [row('a', 'rgb(1, 2, 3)', 6, 1, 3), row('b', 'rgb(4, 5, 6)', 1, 3, 3), row('c', 'rgb(7, 8, 9)', 12, null, 3)];
    const m = trailModel(rows, null);
    check('one chip per trail, numbered 1..N in the order of the rows, each with the colour of its row', m.chips.length === 3 && m.chips.map(c => c.number).join() === '1,2,3' && m.chips.map(c => c.color).join('|') === 'rgb(1, 2, 3)|rgb(4, 5, 6)|rgb(7, 8, 9)');
    check('with no selection yet the FIRST trail is selected (and only it)', m.selected.index === 0 && m.selected.key === 'a' && m.chips.map(c => c.selected).join() === 'true,false,false');
    check('the label is built from the model numbers: "Spur 1 · 6 Flächen"; one face is the singular "1 Fläche"', m.label === 'Spur 1 · 6 Flächen' && trailModel(rows, { key: 'b', index: 1 }).label === 'Spur 2 · 1 Fläche' && labelFor(3, 12) === 'Spur 3 · 12 Flächen');
    check('the counter is the row\'s own n/N; a trail with no colour yet shows a dash: "–/3"', m.count === '1/3' && trailModel(rows, { key: 'c', index: 2 }).count === '–/3');
    check('a row without a stepper (an uncoloured sheet): no counter, the stepper cannot step', (() => { const x = trailModel([row('a', 'red', 2, null, 0)], null); return x.count === '' && x.canStep === false && x.label === 'Spur 1 · 2 Flächen'; })());
    check('every chip has its own accessible label ("Spur k · m Flächen")', m.chips.every(c => /^Spur \d+ · \d+ Fl/.test(c.label)));
});

console.log('\n== the selection ==');
T('selection', () => {
    const rows = [row('a', 'x', 1, 1, 2), row('b', 'y', 2, 1, 2), row('c', 'z', 3, 1, 2)];
    check('a selected trail stays selected BY KEY when the rows change order (a new trail inserted before it)', (() => { const r2 = [row('n', 'q', 1, 1, 2)].concat(rows); const s = resolveSelection(r2, { key: 'b', index: 1 }); return s.key === 'b' && s.index === 2; })());
    check('when its trail is gone the index is CLAMPED into the new rows (3 trails, 3rd selected, 2 left: the 2nd)', (() => { const s = resolveSelection(rows.slice(0, 2), { key: 'c', index: 2 }); return s.index === 1 && s.key === 'b'; })());
    check('...and an index beyond the end of a single row is the first', resolveSelection([rows[0]], { key: 'zz', index: 7 }).index === 0);
    check('a negative or missing index gives the first trail', resolveSelection(rows, { key: 'nope', index: -4 }).index === 0 && resolveSelection(rows, undefined).index === 0 && resolveSelection(rows, {}).key === 'a');
    check('NO rows: the selection is empty (key null, index 0), the model is empty and has no selected chip', (() => { const m = trailModel([], { key: 'a', index: 2 }); return m.empty === true && m.chips.length === 0 && m.selected.key === null && m.selected.index === 0 && m.label === '' && m.count === '' && m.canStep === false; })());
    check('the state object given in is not changed (the model is pure)', (() => { const st = { key: 'c', index: 2 }; resolveSelection(rows.slice(0, 1), st); return st.key === 'c' && st.index === 2; })());
});

console.log('\n== the signature ==');
T('signature', () => {
    const rows = [row('a', 'x', 1, 1, 2), row('b', 'y', 2, 1, 2)];
    const s0 = trailSignature(rows, { key: 'a', index: 0 }, null);
    check('the same rows and selection give the same signature', s0 === trailSignature(rows.map(r => Object.assign({}, r)), { key: 'a', index: 0 }, null));
    check('a changed colour, a changed counter, a changed face count, a changed selection and a changed reason each change it', [[rows.map((r, i) => i ? row('b', 'CHANGED', 2, 1, 2) : r), { key: 'a', index: 0 }, null], [rows.map((r, i) => i ? row('b', 'y', 2, 2, 2) : r), { key: 'a', index: 0 }, null], [rows.map((r, i) => i ? row('b', 'y', 9, 1, 2) : r), { key: 'a', index: 0 }, null], [rows, { key: 'b', index: 1 }, null], [rows, { key: 'a', index: 0 }, 'Fläche füllen einschalten']].every(a => trailSignature(a[0], a[1], a[2]) !== s0));
});

console.log('\n== reading the model rows ==');
T('read', () => {
    const node = (o) => Object.assign({ children: [], dataset: {}, style: {}, textContent: '' }, o);
    const mkRow = (key, bg, label, cnt) => { const sw = node({ style: { backgroundColor: bg } }), lab = node({ textContent: label }), c = cnt ? node({ textContent: cnt.text, dataset: { k: String(cnt.k), c: String(cnt.c) } }) : null; return { dataset: { key }, querySelector(sel) { return sel === '.fc-swatch' ? sw : sel === '.fc-label' ? lab : sel === '.pairing-variant-count' ? c : null; } }; };
    const list = { children: [mkRow('k1', 'rgb(10, 20, 30)', 'Trail 1 · 6 faces', { text: '2/3', k: 2, c: 3 }), mkRow('k2', 'rgb(1, 1, 1)', 'Trail 2 · 1 face', { text: '–/3', k: 1, c: 3 }), mkRow('k3', 'red', 'Trail 3 · 4 faces', null)] };
    const rows = readRows(list);
    check('readRows reads the key (data-key), the swatch colour, the face count of the label and the counter (n, N) of each .fc-row', JSON.stringify(rows) === JSON.stringify([{ key: 'k1', color: 'rgb(10, 20, 30)', faceCount: 6, n: 2, stepper: 3 }, { key: 'k2', color: 'rgb(1, 1, 1)', faceCount: 1, n: null, stepper: 3 }, { key: 'k3', color: 'red', faceCount: 4, n: null, stepper: 0 }]), JSON.stringify(rows));
    check('no list, or an empty one, gives no rows', readRows(null).length === 0 && readRows({ children: [] }).length === 0);
});

console.log('\n== the outline of the selected trail (commit B) ==');
T('highlight', () => {
    const rows = [row('a', 'x', 1, 1, 2), row('b', 'y', 2, 1, 2), row('c', 'z', 3, 1, 2)];
    const ctx = over => Object.assign({ phone: true, tab: 'farbe', shown: true, rows, selection: { key: 'b', index: 1 }, sheet: 'base' }, over || {});
    const J = JSON.stringify;
    check('the selected trail of the active sheet: { sheet: base, key: b }', J(highlightFor(ctx())) === J({ sheet: 'base', key: 'b' }));
    check('the first trail is outlined as soon as the pane shows (no selection yet)', J(highlightFor(ctx({ selection: null }))) === J({ sheet: 'base', key: 'a' }) && J(highlightFor(ctx({ selection: {} }))) === J({ sheet: 'base', key: 'a' }));
    check('the sheet follows the ACTIVE sheet: a layer index is passed through, a missing sheet is the base', J(highlightFor(ctx({ sheet: 1 }))) === J({ sheet: 1, key: 'b' }) && highlightFor(ctx({ sheet: 0 })).sheet === 0 && highlightFor(ctx({ sheet: undefined })).sheet === 'base' && highlightFor(ctx({ sheet: null })).sheet === 'base');
    check('CLEARED when the Spuren pane is not the shown panel (another sub-tab, a closed phone panel)', highlightFor(ctx({ shown: false })) === null);
    check('CLEARED when the tab is not Farbe (Form, Netz, none)', ['form', 'netz', null, undefined, ''].every(t => highlightFor(ctx({ tab: t })) === null));
    check('CLEARED when the phone layout is off (release: widening to 768px and up)', highlightFor(ctx({ phone: false })) === null && highlightFor(ctx({ phone: undefined })) === null);
    check('CLEARED when there are no rows: Fill off (the panel is hidden), a refused sheet, no faces', highlightFor(ctx({ rows: [] })) === null && highlightFor(ctx({ rows: null })) === null && highlightFor(ctx({ rows: undefined })) === null);
    check('a trail that vanished: the CLAMPED trail is outlined (3 trails, c selected, 2 left: b; one left: a)', J(highlightFor(ctx({ rows: rows.slice(0, 2), selection: { key: 'c', index: 2 } }))) === J({ sheet: 'base', key: 'b' }) && highlightFor(ctx({ rows: rows.slice(0, 1), selection: { key: 'c', index: 2 } })).key === 'a');
    check('the selection survives a reorder BY KEY (a new trail inserted before it)', highlightFor(ctx({ rows: [row('n', 'q', 1, 1, 2)].concat(rows), selection: { key: 'b', index: 1 } })).key === 'b');
    check('the view holds no reference into the model: the result is a fresh plain object of the key and the sheet only', (() => { const r = highlightFor(ctx()); return Object.keys(r).sort().join() === 'key,sheet' && r !== rows[1]; })());
    check('no context at all, or a broken one, is simply null (never throws)', highlightFor() === null && highlightFor(null) === null && highlightFor({}) === null);
    check('the input is not changed (the model is pure)', (() => { const sel = { key: 'c', index: 2 }, rs = rows.slice(0, 2); highlightFor(ctx({ rows: rs, selection: sel })); return sel.key === 'c' && sel.index === 2 && rs.length === 2; })());
});

console.log('\n== the hover (C0b-5: a mouse over a chip does what a mouse over the model row does) ==');
T('hover', () => {
    const N = { key: null }, J = JSON.stringify, enter = (key, pt) => ({ type: 'enter', key, pointerType: pt === undefined ? 'mouse' : pt }), E = k => ({ type: 'mouseenter', key: k }), L = k => ({ type: 'mouseleave', key: k });
    check('a MOUSE enters a chip: the state is its key and ONE mouseenter is sent', J(hoverStep(N, enter('a'))) === J({ state: { key: 'a' }, send: [E('a')] }));
    check('entering the same chip again sends nothing (no double hover)', J(hoverStep({ key: 'a' }, enter('a'))) === J({ state: { key: 'a' }, send: [] }));
    check('moving to another chip LEAVES the first and enters the second, in that order', J(hoverStep({ key: 'a' }, enter('b'))) === J({ state: { key: 'b' }, send: [L('a'), E('b')] }));
    check('a TOUCH or a PEN never enters (the mouse events a tap emulates must not leave a hover): nothing is sent, the state is as it was, even while another chip is hovered; an event with no pointerType at all is no mouse either', ['touch', 'pen', '', null, 'Mouse'].every(pt => J(hoverStep(N, enter('a', pt))) === J({ state: N, send: [] }) && J(hoverStep({ key: 'x' }, enter('a', pt))) === J({ state: { key: 'x' }, send: [] })) && J(hoverStep(N, { type: 'enter', key: 'a' })) === J({ state: N, send: [] }));
    check('leaving the hovered chip sends ONE mouseleave and clears the state; the leave of another chip (a stale event) and a leave with nothing hovered send nothing', J(hoverStep({ key: 'a' }, { type: 'leave', key: 'a' })) === J({ state: N, send: [L('a')] }) && J(hoverStep({ key: 'a' }, { type: 'leave', key: 'b' })) === J({ state: { key: 'a' }, send: [] }) && J(hoverStep(N, { type: 'leave', key: 'a' })) === J({ state: N, send: [] }));
    check('CLEAR (the chip bar is rebuilt, the surface released, the group hidden, the tab left) while a chip is hovered sends the mouseleave and clears; with nothing hovered it sends nothing', J(hoverStep({ key: 'a' }, { type: 'clear' })) === J({ state: N, send: [L('a')] }) && J(hoverStep(N, { type: 'clear' })) === J({ state: N, send: [] }));
    check('after a rebuild the SAME chip can be entered again (the state was cleared): enter a, clear, enter a gives enter, leave, enter', (() => { let st = N; const out = []; [enter('a'), { type: 'clear' }, enter('a')].forEach(ev => { const r = hoverStep(st, ev); st = r.state; r.send.forEach(m => out.push(m.type + ':' + m.key)); }); return out.join() === 'mouseenter:a,mouseleave:a,mouseenter:a' && st.key === 'a'; })());
    check('a key may be any string (a trail key has commas and semicolons) and the key 0-like values are kept: "27000,30000;30000,35196" and "0" are real keys; null and undefined are no chip', J(hoverStep(N, enter('27000,30000;30000,35196'))).indexOf('27000,30000;30000,35196') > 0 && hoverStep(N, enter('0')).state.key === '0' && J(hoverStep(N, enter(null))) === J({ state: N, send: [] }) && J(hoverStep(N, enter(undefined))) === J({ state: N, send: [] }));
    check('pure: the state object is not changed, an unknown event or no event is a no-op, no state at all is "nothing hovered"', (() => { const st = { key: 'a' }; hoverStep(st, enter('b')); return st.key === 'a' && J(hoverStep(st, { type: 'wiggle' })) === J({ state: { key: 'a' }, send: [] }) && J(hoverStep(st)) === J({ state: { key: 'a' }, send: [] }) && J(hoverStep(undefined, enter('a'))) === J({ state: { key: 'a' }, send: [E('a')] }); })());
    check('the hover changes nothing of the selection model: the model of a hovered view is the same (the hover is not part of trailModel or the signature)', J(trailModel([row('a', 'x', 1, 1, 2)], null)) === J(trailModel([row('a', 'x', 1, 1, 2)], null)) && trailSignature([row('a', 'x', 1, 1, 2)], { key: 'a', index: 0 }) === trailSignature([row('a', 'x', 1, 1, 2)], { key: 'a', index: 0 }));
});

console.log('\n== the file ==');
T('source', () => {
    const src = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    check('the view never clones the model rows (no cloneNode) and does not watch the DOM (no MutationObserver): it rebuilds from a signature on UI.onSync ticks', !/cloneNode|MutationObserver/.test(src) && /UI\.onSync/.test(src) && /trailSignature/.test(src));
    check('the stepper buttons FORWARD to the row\'s own .pairing-move-btn (b.click()), not to a function of their own', /querySelectorAll\('\.pairing-move-btn'\)/.test(src) && /b\.click\(\)/.test(src));
    check('the German texts are keyed: every T key has a data-i18n use or a key lookup', ['trails.none', 'trails.group', 'trails.prev', 'trails.next', 'trails.label.one', 'trails.label.other'].every(k => src.includes("'" + k + "'")));
    check('it exposes the selected trail (selectedTrail) and never writes the hover or redraws itself: no assignment to faceHover, no redraw() call (the hover reaches sketch.js as a forwarded mouseenter / mouseleave on the model row, C0b-5)', /selectedTrail/.test(src) && !/redraw\(|faceHover\s*=[^=]/.test(src) && /'mouseenter'/.test(src) && /'mouseleave'/.test(src));
});

T('gate', () => {
    const src = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    check('the view is on while the TRAILS surface is applied: sync() and the highlight read html.sr-trails (the engine\'s flag, C0b-2) together with the Farbe tab, not html.ph', (src.match(/classList\.contains\('sr-trails'\)/g) || []).length === 2 && (src.match(/classList\.contains\('ph'\)/g) || []).length === 1);
    check('...html.ph is read once, only to choose the text of the EMPTY line: at 768px and up (no ph) the muted line says why faces are unavailable (farbeReason, sketch.js\'s text as data); on the phone it stays "Keine Flächen"', /const why = !html\.classList\.contains\('ph'\) && typeof win\.farbeReason === 'function' \? win\.farbeReason\(\) : null;/.test(src));
    check('shownNow() = the container is not in its hidden holder and no ancestor is hidden (a parked pane, the holder after release; at 768px and up the host\'s own hidden state); it no longer looks for #ph-slot', /function shownNow\(\) \{ if \(!chips\.parentNode\) return false; for \(let n = chips; n; n = n\.parentNode\) \{ if \(n === holder \|\| n\.hidden\) return false; \} return true; \}/.test(src) && !/ph-slot/.test(src));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
