// Guard for the Form row's two independent symmetry toggles (patterns block, commit A1): the REAL ui-form.js, ui.js and core/symmetry-toggles.js are loaded into a vm with a small fake DOM and a
// symmetryUi that behaves like sketch.js's (category + fold in, the raw mode out through the real symmetryModeFor). No browser. The pure helpers are in tools/ui/test-symmetry-toggles.js.
//   node tools/ui/test-symmetry-wiring.js
//   UI_FORM_JS=... SYMMETRY_TOGGLES_JS=... INDEX_HTML=... UI_I18N_JS=... node tools/ui/test-symmetry-wiring.js        (sabotage runs)
//
// What is pinned. Drehung (#btn-sym-rotation) and Spiegelung (#btn-sym-mirror, renamed from #btn-sym-rotation-mirror) are native buttons with aria-pressed in a role="group"; a click flips ONE half
// through symmetryToggle() and hands the category to symmetryUi.setCategory (the only writer of the raw mode); all four states are valid, "none" included; the default is both pressed; #more-form holds
// only the fold, whose dot means "the fold is 3" (hexagon with Drehung) and nothing else.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const FORM = read('UI_FORM_JS', 'ui-form.js'), UIJS = read('UI_JS', 'ui.js'), SYM = read('SYMMETRY_TOGGLES_JS', 'core/symmetry-toggles.js'), HTML = read('INDEX_HTML', 'index.html'), I18N = read('UI_I18N_JS', 'ui-i18n.js');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const noComments = HTML.replace(/<!--[\s\S]*?-->/g, '');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };

// ---- a fake DOM, just enough for ui-form.js's symmetry part --------------------------------------------------------------------------------------------------------
function makeEl(id, attrs) {
    const a = Object.assign({}, attrs || {}), handlers = {}, cls = new Set(String(a.class || '').split(/\s+/).filter(Boolean));
    delete a.class;
    const el = {
        id, dataset: {}, style: {}, handlers, hidden: false, textContent: '', tabIndex: 0,
        getAttribute: k => (k in a ? a[k] : null), setAttribute: (k, v) => { a[k] = String(v); }, removeAttribute: k => { delete a[k]; },
        classList: { contains: c => cls.has(c), toggle: (c, on) => { const want = on === undefined ? !cls.has(c) : !!on; if (want) cls.add(c); else cls.delete(c); return want; }, add: c => cls.add(c), remove: c => cls.delete(c) },
        addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
        click() { const e = { type: 'click', target: el, preventDefault() { }, stopPropagation() { } }; (handlers.click || []).forEach(h => h(e)); },
        querySelectorAll: () => [],
    };
    return el;
}

// sketch.js's symmetry state as the UI sees it: category + fold in, the raw mode out (through the REAL symmetryModeFor); the raw writes are counted
function build(o) {
    o = o || {};
    const els = {};
    ['btn-sym-rotation', 'btn-sym-mirror', 'btn-more-form', 'btn-fold-opt-3', 'btn-fold-opt-6', 'ov-fold-hint', 'ov-fold', 'more-form'].forEach(id => {
        els[id] = makeEl(id, id.startsWith('btn-fold-opt') ? { role: 'radio', 'aria-checked': 'false', title: id.endsWith('3') ? '3-zählig' : '6-zählig' }
            : id === 'btn-sym-rotation' || id === 'btn-sym-mirror' ? { class: 'icon-btn sym-toggle active', 'aria-pressed': 'true' } : id === 'btn-more-form' ? { title: 'Mehr', 'aria-label': 'Mehr' } : {});
    });
    els['ov-fold'].querySelectorAll = () => [els['btn-fold-opt-3'], els['btn-fold-opt-6']];
    const docHandlers = {};
    const document = { visibilityState: 'visible', activeElement: null, getElementById: () => null, addEventListener: (t, fn) => { (docHandlers[t] = docHandlers[t] || []).push(fn); },
        querySelector: s => (s[0] === '#' ? els[s.slice(1)] || null : null), querySelectorAll: () => [] };
    const ctx = vm.createContext({ document, console, Event: class { constructor(t, i) { this.type = t; Object.assign(this, i); } }, MutationObserver: class { observe() { } }, setTimeout, clearTimeout, performance: { now: () => 0 } });
    ctx.window = ctx;
    vm.runInContext(SYM, ctx, { filename: 'symmetry-toggles.js' });
    vm.runInContext(UIJS, ctx, { filename: 'ui.js' });
    const syncs = [];
    ctx.UI.onSync = fn => { syncs.push(fn); };
    ctx.UI.overlay = () => { };
    const st = { category: o.category || 'spiegeling', fold: o.fold || 6, writes: [], raw: null };
    ctx.currentShape = o.shape || 'hex';
    const rawNow = () => ctx.symmetryModeFor(ctx.currentShape, st.category, st.fold);
    ctx.symmetryUi = {
        category: () => st.category, fold: () => st.fold,
        setCategory: c => { st.category = c; st.raw = rawNow(); st.writes.push(['category', c, st.raw]); sync(); },
        setFold: f => { st.fold = f; st.raw = rawNow(); st.writes.push(['fold', f, st.raw]); sync(); },
    };
    const sync = () => syncs.forEach(f => f());
    vm.runInContext(FORM, ctx, { filename: 'ui-form.js' });
    sync();
    return { ctx, els, st, sync, rot: els['btn-sym-rotation'], mir: els['btn-sym-mirror'], more: els['btn-more-form'] };
}
const pressed = e => e.getAttribute('aria-pressed') + '/' + (e.classList.contains('active') ? 'active' : 'plain');

console.log('== the default and the four states ==');
T('default', () => {
    const b = build();
    check('default (category spiegeling): both toggles pressed, and the class "active" follows (the black fill)', b.rot.getAttribute('aria-pressed') === 'true' && b.mir.getAttribute('aria-pressed') === 'true' && b.rot.classList.contains('active') && b.mir.classList.contains('active'), pressed(b.rot) + ' ' + pressed(b.mir));
    check('the toggles are native buttons with aria-pressed: no role="radio" and no aria-checked is set on them', b.rot.getAttribute('role') === null && b.mir.getAttribute('role') === null && b.rot.getAttribute('aria-checked') === null && b.mir.getAttribute('aria-checked') === null);
});
T('four states', () => {
    // from the default, walk all four states with real clicks; the raw mode comes out of the real symmetryModeFor
    const b = build({ shape: 'hex', fold: 6 }), seen = [];
    const state = () => b.st.category + '|' + pressed(b.rot) + '|' + pressed(b.mir) + '|' + b.st.raw;
    b.rot.click(); seen.push(state());                  // spiegeling -> mirror (Drehung off)
    b.mir.click(); seen.push(state());                  // mirror -> none (Spiegelung off)
    b.rot.click(); seen.push(state());                  // none -> drehling (Drehung on)
    b.mir.click(); seen.push(state());                  // drehling -> spiegeling (Spiegelung on)
    check('spiegeling -> (Drehung) mirror -> (Spiegelung) none -> (Drehung) drehling -> (Spiegelung) spiegeling, with the matching aria-pressed and raw mode (hexagon, fold 6)',
        JSON.stringify(seen) === JSON.stringify(['mirror|false/plain|true/active|reflection_only', 'none|false/plain|false/plain|none', 'drehling|true/active|false/plain|rotation6', 'spiegeling|true/active|true/active|rotation_reflection6']), seen.join(' ; '));
    check('exactly one setCategory per click (4 clicks, 4 writes, none of them a fold write)', b.st.writes.length === 4 && b.st.writes.every(w => w[0] === 'category'), JSON.stringify(b.st.writes.map(w => w[0])));
});
T('every state, every transition', () => {
    const all = ['none', 'drehling', 'mirror', 'spiegeling'], want = { none: [false, false], drehling: [true, false], mirror: [false, true], spiegeling: [true, true] };
    const bad = [];
    all.forEach(from => ['rot', 'mir'].forEach(which => {
        const b = build({ category: from, shape: 'square' });
        const before = [b.rot.getAttribute('aria-pressed') === 'true', b.mir.getAttribute('aria-pressed') === 'true'];
        if (before[0] !== want[from][0] || before[1] !== want[from][1]) bad.push(from + ': initial state ' + before);
        b[which].click();
        const after = [b.rot.getAttribute('aria-pressed') === 'true', b.mir.getAttribute('aria-pressed') === 'true'];
        const exp = which === 'rot' ? [!want[from][0], want[from][1]] : [want[from][0], !want[from][1]];
        if (after[0] !== exp[0] || after[1] !== exp[1] || b.st.writes.length !== 1) bad.push(from + ' + ' + which + ' -> ' + after + ' (' + b.st.writes.length + ' writes)');
    }));
    check('all 8 transitions (four states x two toggles): exactly ONE half flips, the other keeps its state, one write each', bad.length === 0, bad.join(' ; '));
});
T('none valid', () => {
    ['triangle', 'square', 'hex'].forEach(s => {
        const b = build({ shape: s, category: 'spiegeling' });
        b.rot.click(); b.mir.click();
        check('both off on the ' + s + ': category none, raw mode "none", both toggles unpressed, nothing rejected', b.st.category === 'none' && b.st.raw === 'none' && pressed(b.rot) === 'false/plain' && pressed(b.mir) === 'false/plain', b.st.category + ' ' + b.st.raw);
    });
});
T('raw ids', () => {
    const b = build({ shape: 'hex', fold: 3 });
    b.rot.click(); b.rot.click();
    check('hexagon fold 3: Drehung off and on again gives rotation_reflection3 back (the toggles never touch the fold)', b.st.fold === 3 && b.st.raw === 'rotation_reflection3' && b.st.writes.every(w => w[0] === 'category'), b.st.raw);
    const sq = build({ shape: 'square' }); sq.mir.click();
    check('square: Spiegelung off leaves the rotation mode, on again the spiegeling mode', sq.st.raw === 'rotation3' && (sq.mir.click(), sq.st.raw === 'rotation_reflection6'), sq.st.raw);
});
T('state follows', () => {
    const b = build({ category: 'drehling', shape: 'triangle' });
    check('a state set from outside (a restore, a paste, a catalog link) shows on the next sync: drehling = Drehung pressed only', pressed(b.rot) === 'true/active' && pressed(b.mir) === 'false/plain');
    b.st.category = 'mirror'; b.sync();
    check('...mirror (reflection_only) = Spiegelung pressed only; ...none = both off', pressed(b.rot) === 'false/plain' && pressed(b.mir) === 'true/active' && (b.st.category = 'none', b.sync(), pressed(b.rot) === 'false/plain' && pressed(b.mir) === 'false/plain'));
});
T('once', () => {
    const b = build();
    const types = o => Object.keys(o.handlers).sort().join();
    check('each toggle has ONE listener, on click: a keyboard activation (Enter, Space) is the browser\'s click, and the bridge\'s extra mousedown reaches nothing here', types(b.rot) === 'click,pointerdown,pointerleave,pointercancel,pointerup'.split(',').sort().join() && b.rot.handlers.click.length === 1 && b.mir.handlers.click.length === 1 && !b.rot.handlers.keydown && !b.rot.handlers.mousedown && !b.mir.handlers.keydown && !b.mir.handlers.mousedown, types(b.rot));
    b.rot.click();
    check('one click = one write', b.st.writes.length === 1);
});

console.log('\n== the fold and the Mehr dot ==');
T('fold', () => {
    const f3 = 'btn-fold-opt-3', f6 = 'btn-fold-opt-6';
    const hex = build({ shape: 'hex', fold: 6 });
    check('hexagon, Drehung on, fold 6: the fold options are enabled and the Mehr dot is off', hex.els[f3].getAttribute('aria-disabled') === null && hex.els[f6].getAttribute('aria-disabled') === null && !hex.more.classList.contains('has-state'));
    hex.els[f3].click();
    check('fold 3 on the hexagon: the dot is on and the Mehr name says the fold is 3', hex.more.classList.contains('has-state') && hex.more.getAttribute('aria-label') === 'Mehr – aktive Zähligkeit: 3', hex.more.getAttribute('aria-label'));
    check('fold 3 was written as a fold (setFold), not as a category, and the raw mode follows: rotation_reflection3', hex.st.writes.length === 1 && hex.st.writes[0][0] === 'fold' && hex.st.raw === 'rotation_reflection3');
    hex.rot.click();
    check('fold 3 with Drehung off: the fold options are disabled with their reason (only with Drehung) and the dot goes off (the fold does not apply)', hex.els[f3].getAttribute('aria-disabled') === 'true' && hex.els[f3].dataset.reason === 'Die Zähligkeit gilt nur mit Drehung.' && !hex.more.classList.contains('has-state') && hex.more.getAttribute('aria-label') === 'Mehr', hex.els[f3].dataset.reason);
    hex.mir.click();
    check('...and with neither toggle on (none) the same reason, no dot', hex.st.category === 'none' && hex.els[f3].getAttribute('aria-disabled') === 'true' && !hex.more.classList.contains('has-state'));
    hex.rot.click();
    check('Drehung on again: the remembered fold 3 applies again and the dot returns', hex.st.fold === 3 && hex.more.classList.contains('has-state'));
    const sq = build({ shape: 'square', fold: 3 });
    check('square with a stored fold 3: the fold is disabled with the hexagon reason, no dot', sq.els[f3].dataset.reason === 'Die Zähligkeit (3 oder 6) gilt nur beim Sechseck.' && !sq.more.classList.contains('has-state'));
    ['none', 'mirror'].forEach(c => { const b = build({ shape: 'hex', fold: 6, category: c }); check('the dot is NOT shown for ' + c + ' (it used to say "other symmetry")', !b.more.classList.contains('has-state') && b.more.getAttribute('aria-label') === 'Mehr'); });
    const six = build({ shape: 'hex', fold: 6, category: 'drehling' });
    check('fold 6 (the default) with any toggles: no dot', !six.more.classList.contains('has-state'));
});

console.log('\n== markup (index.html) ==');
T('markup', () => {
    const tag = id => { const m = new RegExp('<button[^>]*\\bid="' + id + '"[^>]*>').exec(noComments); return m ? m[0] : ''; };
    const rot = tag('btn-sym-rotation'), mir = tag('btn-sym-mirror');
    check('two toggle buttons in the Form row: aria-pressed="true" by default, class sym-toggle, no role="radio", no aria-checked', [rot, mir].every(t => t && /aria-pressed="true"/.test(t) && /\bsym-toggle\b/.test(t) && !/role="radio"/.test(t) && !/aria-checked/.test(t)));
    check('Drehung: title and aria-label "Drehung", data-i18n sym.rotation; Spiegelung: title and aria-label "Spiegelung", data-i18n sym.mirror',
        /title="Drehung" aria-label="Drehung" data-i18n="sym\.rotation"/.test(rot) && /title="Spiegelung" aria-label="Spiegelung" data-i18n="sym\.mirror"/.test(mir));
    const grp = (/<div id="nav-symmetry"[^>]*>/.exec(noComments) || [''])[0];
    check('#nav-symmetry is role="group" with a name (aria-label + data-i18n group.symmetry), no longer a radiogroup', /role="group"/.test(grp) && /aria-label="Symmetrie"/.test(grp) && /data-i18n="group\.symmetry"/.test(grp) && !/radiogroup/.test(grp), grp);
    check('the old id is gone from every shipped page and script: no btn-sym-rotation-mirror anywhere', !/btn-sym-rotation-mirror/.test(HTML) && !/btn-sym-rotation-mirror/.test(FORM) && ['index.html', 'ui-phone-config.js', 'ui-phone.js', 'sketch.js', 'style.css'].every(f => !/btn-sym-rotation-mirror/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
    const more = (/<div id="more-form"[\s\S]*?\n  <\/div>/.exec(noComments) || [''])[0];
    check('#more-form exists with the fold only: no "Andere Symmetrie", no btn-sym-none / btn-sym-mirror-only / ov-sym-other, no "Keine", no "Nur Spiegelung"', more.length > 100 && /id="ov-fold"/.test(more) && /id="btn-fold-opt-3"/.test(more) && !/Andere Symmetrie|btn-sym-|ov-sym|Nur Spiegelung|>Keine</.test(more), more.length + ' chars');
    check('the Mehr button #btn-more-form and its overlay stay (A2 removes them)', /id="btn-more-form"[^>]*aria-controls="more-form"/.test(noComments) && /id="more-form"/.test(noComments));
    check('the hidden legacy buttons stay: #btn-mode-none / spiegeling / drehling, #btn-fold-3 / 6', ['btn-mode-none', 'btn-mode-spiegeling', 'btn-mode-drehling', 'btn-fold-3', 'btn-fold-6'].every(id => new RegExp('id="' + id + '"').test(noComments)));
    const form = strip(FORM);
    check('ui-form.js has no leftover of the exclusive pair: no radiogroup for the symmetry, no aria-checked on the toggles, no symmetryVisibleState / symmetryCategoryForVisible', !/mainGroup|otherGroup|noneBtn|mirrorOnlyBtn|rotMirBtn|symmetryVisibleState|symmetryCategoryForVisible/.test(form) && !/rotBtn[^;]*aria-checked|mirBtn[^;]*aria-checked/.test(form));
    check('ui-form.js never writes the raw mode: no symmetryMode assignment, no setMode, the toggles call symmetryUi.setCategory(symmetryToggle(...)) only', !/symmetryMode\s*=(?!=)/.test(form) && /symmetryUi\.setCategory\(symmetryToggle\(/.test(form) && (form.match(/symmetryUi\.setCategory\(/g) || []).length === 1);
    check('the fold handler calls setFold only (it does not write the category)', /symmetryUi\.setFold\(r === fold3 \? 3 : 6\)/.test(form));
});
T('dictionary', () => {
    const ctx = vm.createContext({ window: {}, document: undefined, console }); ctx.window = ctx;
    vm.runInContext(I18N, ctx, { filename: 'ui-i18n.js' });
    const I = ctx.uiI18n, dict = I && I.DICT;
    check('sym.rotation: Drehung / Rotation; sym.mirror: Spiegelung / Mirror (Ostwald\'s German terms in the German text)', !!dict && dict['sym.rotation'] && dict['sym.rotation'].de === 'Drehung' && dict['sym.rotation'].en === 'Rotation' && dict['sym.mirror'] && dict['sym.mirror'].de === 'Spiegelung' && dict['sym.mirror'].en === 'Mirror', dict ? '' : 'dictionary not found');
    check('the keys of the removed controls are gone from the dictionary: sym.none, sym.mirrorOnly, sym.other, sym.rotationMirror', !!dict && ['sym.none', 'sym.mirrorOnly', 'sym.other', 'sym.rotationMirror'].every(k => !(k in dict)));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
