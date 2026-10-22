// Guard for the pure part of the Spuren chip view (phone layout, commit 2): ui-phone-chips.js trailModel(), resolveSelection(), trailSignature(), readRows(). No browser; the DOM part (forwarding, rebuilding,
// the holder) is tested against the fake DOM in tools/ui/test-phone-engine.js.
//   node tools/ui/test-phone-chips.js
//   UI_PHONE_CHIPS_JS=... node tools/ui/test-phone-chips.js        (sabotage runs)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const FILE = process.env.UI_PHONE_CHIPS_JS || path.join(ROOT, 'ui-phone-chips.js');
const API = require(FILE);
const { trailModel, resolveSelection, trailSignature, readRows, labelFor } = API;

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

console.log('\n== the file ==');
T('source', () => {
    const src = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    check('the view never clones the model rows (no cloneNode) and does not watch the DOM (no MutationObserver): it rebuilds from a signature on UI.onSync ticks', !/cloneNode|MutationObserver/.test(src) && /UI\.onSync/.test(src) && /trailSignature/.test(src));
    check('the stepper buttons FORWARD to the row\'s own .pairing-move-btn (b.click()), not to a function of their own', /querySelectorAll\('\.pairing-move-btn'\)/.test(src) && /b\.click\(\)/.test(src));
    check('the German texts are keyed: every T key has a data-i18n use or a key lookup', ['trails.none', 'trails.group', 'trails.prev', 'trails.next', 'trails.label.one', 'trails.label.other'].every(k => src.includes("'" + k + "'")));
    check('it exposes the selected trail for the later highlight commit (selectedTrail) and builds no highlight (no mouseenter, no redraw)', /selectedTrail/.test(src) && !/mouseenter|redraw\(|faceHover/.test(src));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
