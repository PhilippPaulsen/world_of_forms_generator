/*
 * tools/ui/test-export-name.js - task 144: the name of the files of the Download dialog and the `title` of the export JSON.
 *   1. exportFileBase(): the cleaning table;  2. exportFileStem() / exportFileName(): empty = the old names, the stem replaces 'world_of_forms' in every default name (PNG, JSON, SVG, the animation ZIPs)
 *   3. buildExportData(): `title` only while a name is set, `name` (the grid name) untouched;  4. the session: settings.exportName roundtrip, written only when set (no schema bump)
 *   5. the dialog: markup, i18n, the UI file.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.message)); process.exit(1); });

function ctxWith(name) {
    const saved = [], downloads = [];
    const ctx = vm.createContext({ console, saveCanvas: (n, e) => saved.push(n + '.' + e), URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, Blob: function () {},
        document: { createElement: () => { const a = { click() { downloads.push(a.download); } }; return a; }, body: { appendChild() {}, removeChild() {} } } });
    vm.runInContext(`let exportName = ${JSON.stringify(name === undefined ? '' : name)};`, ctx);
    vm.runInContext(read('core/export.js'), ctx, { filename: 'core/export.js' });
    return { ctx, saved, downloads, set: v => vm.runInContext(`exportName = ${JSON.stringify(v)};`, ctx), call: src => vm.runInContext(src, ctx) };
}
const W = ctxWith('');
const base = raw => W.ctx.exportFileBase(raw);

console.log('== 1. exportFileBase ==');
const table = [
    ['Mein Muster', 'Mein-Muster'], ['  spaced   out  ', 'spaced-out'], ['a/b\\c:d*e?f"g<h>i|j', 'a-b-c-d-e-f-g-h-i-j'], ['..hidden', 'hidden'], ['-lead and trail-', 'lead-and-trail'],
    ['Größe ä ö ü ß', 'Größe-ä-ö-ü-ß'], ['日本語 パターン', '日本語-パターン'], ['tab\there\nnewline', 'tab-here-newline'], ['bell\u0007x\u0000y', 'bellxy'],
    ['con', '_con'], ['NUL', '_NUL'], ['com1', '_com1'], ['LPT9.txt', '_LPT9.txt'], ['console', 'console'], ['report.', 'report'],
    ['', ''], ['   ', ''], ['///', ''], ['...', ''], ['---', ''], ['​﻿', ''], [null, ''], [undefined, ''], [42, ''], [{}, ''],
    ['x'.repeat(100), 'x'.repeat(60)], ['a b '.repeat(40), ('a-b-'.repeat(15)).replace(/-$/, '')], ['😀'.repeat(70), '😀'.repeat(60)],
    ['é', 'é'], ['zero​width', 'zerowidth'], ['rtl‮override', 'rtloverride'],
];
for (const [i, o] of table) check(`${JSON.stringify(i)} -> ${JSON.stringify(o)}`, base(i) === o, JSON.stringify(base(i)));
check('the result never contains a path separator, a control character, a colon or a leading dot, whatever the input (400 random strings)', (() => {
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; const pool = 'ab /\\:*?"<>|.-\u0000\t\nä​😀 CON';
    for (let n = 0; n < 400; n++) { let s = ''; const len = Math.floor(rnd() * 90); for (let k = 0; k < len; k++) s += Array.from(pool)[Math.floor(rnd() * Array.from(pool).length)]; const r = base(s);
        if (/[\/\\:*?"<>|\u0000-\u001f]/.test(r) || /^[-.\s]/.test(r) || /[-.\s]$/.test(r) || Array.from(r).length > 60 || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(r)) return false; }
    return true; })());

console.log('\n== 2. file names ==');
{
    const e = ctxWith('');
    check('empty name: the stem is the old one (world_of_forms)', e.call('exportFileStem()') === 'world_of_forms');
    check('empty name: the default names are unchanged (json, svg, both zips)', ['world_of_forms.json', 'world_of_forms.svg', 'world_of_forms_animation.zip', 'world_of_forms_animation_svg.zip'].every(n => e.call(`exportFileName(${JSON.stringify(n)})`) === n));
    e.call('exportPNG()'); check('empty name: the PNG is saved as world_of_forms.png', e.saved[0] === 'world_of_forms.png', e.saved[0]);
    e.set('Mein Muster / 1');
    check('a name: the stem is the cleaned name', e.call('exportFileStem()') === 'Mein-Muster-1');
    check('a name: json, svg and both animation ZIPs take it ("<name>_animation.zip", "<name>_animation_svg.zip")', ['.json', '.svg', '_animation.zip', '_animation_svg.zip'].every(x => e.call(`exportFileName('world_of_forms${x}')`) === 'Mein-Muster-1' + x));
    check('a file name that is not one of the defaults is left alone', e.call("exportFileName('other.zip')") === 'other.zip' && e.call('exportFileName(5)') === 5);
    e.call('exportPNG()'); check('a name: the PNG is saved under it', e.saved[1] === 'Mein-Muster-1.png', e.saved[1]);
    e.call("downloadBlob('x', 'world_of_forms_animation.zip', 'application/zip'); downloadBlob('x', 'world_of_forms.json', 'application/json')");
    check('downloadBlob() names the download with it (the animation export calls downloadBlob with its default name)', e.downloads.join() === 'Mein-Muster-1_animation.zip,Mein-Muster-1.json', e.downloads.join());
    e.set('///'); check('a name with nothing usable left falls back to the old stem', e.call('exportFileStem()') === 'world_of_forms');
}
const src = read('core/export.js');
check('buildExportData: `title` is written only while a name is set, after `name`, trimmed and at most 80 characters; `name` stays the grid name', /data\.name = baseKeys\.name;\s*\n[^\n]*\n\s*if \(typeof exportName === 'string' && exportName\.trim\(\)\) data\.title = exportName\.trim\(\)\.slice\(0, 80\);/.test(src) && (src.match(/data\.name = /g) || []).length === 1);

console.log('\n== 4. the session ==');
{
    const F = require('../session/fixtures.js'), S = require('../session/scenarios.js');
    const { world, uiOf, snapOf, fakeHooks, applyInto, same } = S;
    const text = (w, name) => { w.run(`exportName = ${JSON.stringify(name)};`); return w.sb.serializeSession(w.sb.buildSessionSnapshot(w.sb.collectSessionState(uiOf(w, 'none', 6)), 1)).text; };
    const w = world('square', 3, 5, 'none');
    const t0 = text(w, ''), t1 = text(w, 'Mein Muster');
    check('no name: no key in the snapshot (the text is the one written before the field existed)', !t0.includes('exportName'));
    check('a name: settings.exportName, after uiMode, the schema is still 2', JSON.parse(t1).settings.exportName === 'Mein Muster' && JSON.parse(t1).schema === 2 && w.get('SESSION_SCHEMA_VERSION') === 2);
    const snap = JSON.parse(t1);
    const t = world('square', 3, 5, 'none'); t.run("exportName = 'old';");
    const r = applyInto(t, snap, fakeHooks(t, null, uiOf(t, 'none', 6)));
    check('apply restores the name', r.ok === true && t.get('exportName') === 'Mein Muster');
    const t2 = world('square', 3, 5, 'none'); t2.run("exportName = 'old';");
    const noName = JSON.parse(t0); const r2 = applyInto(t2, noName, fakeHooks(t2, null, uiOf(t2, 'none', 6)));
    check('a snapshot WITHOUT the field restores no name (an old session must not keep the name of the page it is restored into)', r2.ok === true && t2.get('exportName') === '');
    for (const bad of [5, null, {}, [], true]) { const b = JSON.parse(t1); b.settings.exportName = bad; const t3 = world('square', 3, 5, 'none'); const r3 = applyInto(t3, b, fakeHooks(t3, null, uiOf(t3, 'none', 6))); if (!(r3.ok === true && t3.get('exportName') === '')) { check('a bad value ' + JSON.stringify(bad) + ' restores no name', false); } }
    check('bad values (5, null, {}, [], true) restore no name and never fail the apply', true);
    const long = JSON.parse(t1); long.settings.exportName = '  a\u0000b   c ' + 'x'.repeat(200); const t4 = world('square', 3, 5, 'none'); applyInto(t4, long, fakeHooks(t4, null, uiOf(t4, 'none', 6)));
    check('a long or dirty name is normalised (control characters and runs of blanks, 80 characters)', t4.get('exportName').length === 80 && !/[\u0000-\u001f]/.test(t4.get('exportName')) && t4.get('exportName').startsWith('a b c'), JSON.stringify(t4.get('exportName')).slice(0, 40));
    const cap = w.get('SESSION_APPLY_CAPTURED');
    check('exportName is CAPTURED (apply writes it, the rollback holds it)', cap.includes('exportName') && !w.get('SESSION_APPLY_UNTOUCHED').includes('exportName'));
    let allBack = 0; const steps = ['A:base', 'A:layers', 'A:timeline', 'B:capture', 'B:settings', 'B:grid', 'B:base', 'B:layers', 'B:net', 'C:shapeAndInputs', 'C:symmetry', 'C:toggles', 'C:net', 'C:layers', 'C:timeline', 'C:finish'];
    for (const st of steps) { const t5 = world('square', 3, 5, 'none'); t5.run("exportName = 'keep';"); const rr = applyInto(t5, snap, fakeHooks(t5, null, uiOf(t5, 'none', 6)), { beforeStep(n) { if (n === st) throw new Error('fault'); } }); if (rr.ok === false && t5.get('exportName') === 'keep') allBack++; }
    check(`a fault before each of ${steps.length} steps rolls the name back`, allBack === steps.length, allBack);
}

console.log('\n== 5. the dialog ==');
{
    const html = read('index.html'), dict = require('../../ui-i18n.js').DICT;
    check('index.html: the Download dialog has a text input #export-name (maxlength 80) with a label that has a data-i18n key, before the format buttons', /<div id="export-overlay"[\s\S]*?<label[^>]*for="export-name"[^>]*data-i18n="export\.name\.label"[\s\S]*?<input type="text" id="export-name" maxlength="80"[^>]*>[\s\S]*?class="format-options"/.test(html));
    check('the keys exist in both languages (label, placeholder)', ['export.name.label', 'export.name.placeholder'].every(k => dict[k] && dict[k].de && dict[k].en));
    check('ui-export.js is loaded after ui-rail.js with the page version', /ui-rail\.js\?v=(\w+)"><\/script>[\s\S]*?<script src="ui-export\.js\?v=\1"/.test(html));
    check('sketch.js is untouched by the task (the names come from core/export.js downloadBlob / exportPNG)', require('child_process').execSync('git diff --stat main -- sketch.js', { cwd: ROOT }).toString().trim() === '');
}
console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? 'PASS' : 'FAIL');
process.exit(failures === 0 ? 0 : 1);
