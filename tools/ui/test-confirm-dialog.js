/*
 * tools/ui/test-confirm-dialog.js - task 143: UI.confirm (ui.js), the guard of Clear and Reset Color (ui-rail.js), the markup and the texts.
 * UI.confirm runs on DOM stubs (its source is cut out of ui.js); the guard is checked on the source text and in the browser (the Browser-Test of the task report).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.message)); process.exit(1); });

const ui = read('ui.js');
const src = ui.slice(ui.indexOf('// ---- UI.confirm:'), ui.indexOf('// ---- one sync entry point'));
function world(withMarkup) {
    const mk = () => { const el = { cls: new Set(['hidden']), l: {}, text: '', attrs: {}, classList: { add: c => el.cls.add(c), remove: c => el.cls.delete(c), contains: c => el.cls.has(c) },
        addEventListener(t, f) { (el.l[t] = el.l[t] || []).push(f); }, removeEventListener(t, f) { el.l[t] = (el.l[t] || []).filter(x => x !== f); },
        setAttribute(k, v) { el.attrs[k] = v; }, click() { (el.l.click || []).slice().forEach(f => f({ target: el })); }, get textContent() { return el.text; }, set textContent(v) { el.text = v; } }; return el; };
    const els = withMarkup ? { 'confirm-overlay': mk(), 'confirm-cancel': mk(), 'confirm-ok': mk(), 'confirm-title': mk(), 'confirm-text': mk() } : {};
    const calls = { dialog: 0 };
    const ctx = vm.createContext({ document: { getElementById: id => els[id] || null, createElement: () => mk() }, dialog: () => { calls.dialog++; }, Promise, console });
    vm.runInContext(src + '\n;this.confirmDialog = confirmDialog;', ctx);
    return { els, ctx, calls, run: o => ctx.confirmDialog(o) };
}
(async () => {
    let w = world(true); const focus = { n: 0 }; const trig = { focus() { focus.n++; }, offsetParent: {} };
    let p = w.run({ title: 'T', text: 'X', confirm: 'Löschen', trigger: trig });
    check('opening: the overlay is shown, title / text / confirm label are set, the dialog keyboard behaviour is wired once', !w.els['confirm-overlay'].cls.has('hidden') && w.els['confirm-title'].text === 'T' && w.els['confirm-text'].text === 'X' && w.els['confirm-ok'].text === 'Löschen' && w.calls.dialog === 1);
    w.els['confirm-ok'].click();
    check('confirm resolves true, closes, gives the focus back to the trigger', (await p) === true && w.els['confirm-overlay'].cls.has('hidden') && focus.n === 1);
    p = w.run({ title: 'T', text: 'X', confirm: 'C', trigger: trig }); w.els['confirm-cancel'].click();
    check('Cancel resolves false and closes', (await p) === false && w.els['confirm-overlay'].cls.has('hidden'));
    p = w.run({ title: 'T', text: 'X', confirm: 'C', trigger: trig }); w.els['confirm-overlay'].click();
    check('a click on the backdrop (the overlay itself) resolves false', (await p) === false);
    p = w.run({ title: 'T', text: 'X', confirm: 'C', trigger: trig });
    const second = await w.run({ title: 'U', text: 'Y', confirm: 'D', trigger: trig });
    check('a second call while one is open resolves false at once and does not change the open dialog', second === false && w.els['confirm-title'].text === 'T');
    w.els['confirm-cancel'].click(); await p;
    p = w.run({ title: 'A', text: 'B', confirm: 'C', trigger: trig }); w.els['confirm-ok'].click();
    check('listeners are removed after each use (a later dialog is not answered twice)', (await p) === true && (w.els['confirm-ok'].l.click || []).length === 0 && (w.els['confirm-cancel'].l.click || []).length === 0);
    const bare = world(false);
    check('without the markup (a reduced shell) it resolves true: the action is never blocked by a missing dialog', (await bare.run({ title: 'x' })) === true);

    console.log('\n== markup and wiring ==');
    const html = read('index.html'), rail = read('ui-rail.js');
    check('index.html has #confirm-overlay (dialog-overlay, hidden, aria-modal) with Cancel FIRST and the red confirm button after it', /<div id="confirm-overlay" class="dialog-overlay hidden" role="dialog" aria-modal="true">[\s\S]*?id="confirm-cancel"[\s\S]*?id="confirm-ok" class="dialog-danger"/.test(html));
    check('ui-rail.js guards Clear on the mousedown and Reset Color on the click, only when there is something to lose, and replays the event with a one-shot mark', /id: 'btn-clear', type: 'mousedown'[\s\S]*?activeConnections\(\)\.length > 0/.test(rail) && /id: 'btn-face-colors-reset', type: 'click'[\s\S]*?st\.size > 0/.test(rail) && /__confirmed/.test(rail) && /stopImmediatePropagation/.test(rail) && /\}, true\);/.test(rail));
    const dict = require('../../ui-i18n.js').DICT;
    check('the texts exist in both languages (clear, reset, confirm.cancel)', ['confirm.cancel', 'clear.title', 'clear.text', 'clear.confirm', 'reset.title', 'reset.text', 'reset.confirm'].every(k => dict[k] && dict[k].de && dict[k].en));
    check('the texts say it cannot be undone (Clear and Reset)', /nicht rückgängig/.test(dict['clear.text'].de) && /cannot be undone/.test(dict['clear.text'].en) && /nicht rückgängig/.test(dict['reset.text'].de) && /cannot be undone/.test(dict['reset.text'].en));
    let diff = ''; try { diff = execSync('git diff --stat main -- sketch.js core/', { cwd: ROOT }).toString().trim(); } catch (e) { diff = 'git?'; }
    check('sketch.js and core/ are untouched by the task (the guard lives in ui-rail.js, so the pinned files stay)', diff === '', diff);
    console.log(`\n${checks - failures}/${checks} checks passed`);
    console.log(failures === 0 ? 'PASS' : 'FAIL');
    process.exit(failures === 0 ? 0 : 1);
})();
