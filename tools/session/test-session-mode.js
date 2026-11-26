/*
 * tools/session/test-session-mode.js - task 133: the interface mode ('simple' | 'advanced') in the session snapshot.
 *  1. core/state.js declares the global and its two constants; the default of a page without a session is the one constant UI_MODE_NEW_VISITOR
 *  2. the snapshot ALWAYS carries settings.uiMode (right after netTransform), the schema stays 2
 *  3. both modes round-trip build -> serialize -> validate -> plan -> apply
 *  4. a snapshot without the field (written before the modes) or with a bad value is valid and restores 'advanced' (UI_MODE_LEGACY), also into a page that was 'simple'
 *  5. unknown keys next to it are dropped; a failed apply rolls the mode back (same value) at every step; the global is on the captured list
 */
'use strict';
const F = require('./fixtures.js');
const S = require('./scenarios.js');
const { clone, J } = F;
const { same, newCtx, world, uiOf, snapOf, fakeHooks, applyInto } = S;
let failures = 0, checks = 0;
function check(name, ok, detail) { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); }
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.message)); process.exit(1); });
const setMode = (ctx, m) => ctx.run(`uiMode = ${J(m)};`);
const getMode = ctx => ctx.get('uiMode');
const text = (ctx, ui) => ctx.sb.serializeSession(ctx.sb.buildSessionSnapshot(ctx.sb.collectSessionState(ui), 1)).text;

console.log('== 1. the state ==');
{
    const state = F.read('core/state.js');
    check('core/state.js declares UI_MODES = [simple, advanced] and `let uiMode`', /const UI_MODES = Object\.freeze\(\['simple', 'advanced'\]\)/.test(state) && /^let uiMode = UI_MODE_NEW_VISITOR;/m.test(state));
    const w = world('square', 3, 5, 'none');
    check('a fresh world holds UI_MODE_NEW_VISITOR, and both constants are one of the two names', getMode(w) === w.get('UI_MODE_NEW_VISITOR') && ['simple', 'advanced'].includes(w.get('UI_MODE_NEW_VISITOR')) && ['simple', 'advanced'].includes(w.get('UI_MODE_LEGACY')));
    check('the legacy mode is advanced (a saved session from before the modes must not lose a control)', w.get('UI_MODE_LEGACY') === 'advanced');
}

console.log('\n== 2. the snapshot ==');
for (const m of ['simple', 'advanced']) {
    const w = world('square', 3, 5, 'none'); w.run('connections = [[1, 6], [2, 9]];'); setMode(w, m);
    const ui = uiOf(w, 'none', 6), t = text(w, ui), s = JSON.parse(t);
    const keys = Object.keys(s.settings);
    check(`mode ${m}: settings.uiMode is written, right after netTransform, the schema is still 2`, s.settings.uiMode === m && keys.at(-1) === 'grayTones' && keys.at(-2) === 'uiMode' && keys.at(-3) === 'netTransform' && s.schema === 2 && w.get('SESSION_SCHEMA_VERSION') === 2);
}
{
    const w = world('square', 3, 5, 'none'); setMode(w, 'bogus');
    check('a bogus live value is written as advanced (never copied through)', JSON.parse(text(w, uiOf(w, 'none', 6))).settings.uiMode === 'advanced');
}

console.log('\n== 3. round trip ==');
for (const [from, to] of [['simple', 'advanced'], ['advanced', 'simple']]) {
    const a = world('hex', 3, 3, 'none'); a.run('connections = [[1, 6]];'); setMode(a, from);
    const ua = uiOf(a, 'none', 6), snap = snapOf(a, ua);
    const b = world('hex', 3, 3, 'none'); setMode(b, to);
    const hb = fakeHooks(b, snap, uiOf(b, 'none', 6));
    const r = applyInto(b, snap, hb);
    check(`${from} saved, page was ${to}: apply ok, the page is ${from}, the snapshot built from it is identical`, r.ok === true && getMode(b) === from && same(snapOf(b, hb.symmetryUi), snap), r.ok === true ? getMode(b) : J(r).slice(0, 100));
}
{
    const lay = newCtx(); S.layeredAltNet(lay, {}); setMode(lay, 'simple');
    const lui = uiOf(lay, 'spiegeling', 6), lsnap = snapOf(lay, lui);
    const lt = world('square', 4, 1, 'none'); const lh = fakeHooks(lt, lsnap, uiOf(lt, 'none', 6));
    const lr = applyInto(lt, lsnap, lh);
    check('the heaviest layered scenario round-trips with the mode simple (snapshot identical, hooks in order)', lr.ok === true && same(snapOf(lt, lh.symmetryUi), lsnap) && getMode(lt) === 'simple');
}

console.log('\n== 4. snapshots from before the modes, and bad values ==');
{
    const a = world('hex', 3, 3, 'none'); setMode(a, 'simple');
    const snap = snapOf(a, uiOf(a, 'none', 6));
    const old = clone(snap); delete old.settings.uiMode;
    const t = world('hex', 3, 3, 'none'); setMode(t, 'simple');
    const r = applyInto(t, old, fakeHooks(t, null, uiOf(t, 'none', 6)));
    check('a snapshot WITHOUT the field validates and restores advanced into a page that was simple', r.ok === true && getMode(t) === 'advanced', r.ok === true ? getMode(t) : J(r).slice(0, 100));
    for (const bad of ['x', '', 'SIMPLE', 'Simple ', 5, null, true, {}, [], ['simple']]) {
        const s2 = clone(snap); s2.settings.uiMode = bad;
        const t2 = world('hex', 3, 3, 'none'); setMode(t2, 'simple');
        const r2 = applyInto(t2, s2, fakeHooks(t2, null, uiOf(t2, 'none', 6)));
        check(`a bad value ${J(bad)} is not an error: restores advanced`, r2.ok === true && getMode(t2) === 'advanced');
    }
    const s3 = clone(snap); s3.settings.extraThing = 1; s3.settings.uiMode = 'simple';
    const v = a.sb.validateSession(Object.assign(clone(s3), { savedAt: 1 }));
    check('unknown keys of settings are dropped, the mode is kept', v.ok && !('extraThing' in v.snapshot.settings) && v.snapshot.settings.uiMode === 'simple');
}

console.log('\n== 5. rollback and classification ==');
{
    const a = world('triangle', 3, 3, 'rotation6'); setMode(a, 'simple');
    const snapAdv = (() => { const x = world('triangle', 3, 3, 'rotation6'); setMode(x, 'advanced'); return snapOf(x, uiOf(x, 'none', 6)); })();
    const steps = ['A:base', 'A:layers', 'A:timeline', 'B:capture', 'B:settings', 'B:grid', 'B:base', 'B:layers', 'B:net', 'C:shapeAndInputs', 'C:symmetry', 'C:toggles', 'C:net', 'C:layers', 'C:timeline', 'C:finish'];
    let back = 0, detail = '';
    for (const step of steps) {
        const t = world('triangle', 3, 3, 'rotation6'); setMode(t, 'simple');
        const rr = applyInto(t, snapAdv, fakeHooks(t, null, uiOf(t, 'none', 6)), { beforeStep(name) { if (name === step) throw new Error('fault at ' + name); } });
        if (rr.ok === false && rr.rolledBack === true && getMode(t) === 'simple') back++; else if (!detail) detail = step + ' ' + J(rr).slice(0, 80);
    }
    check(`a fault before each of ${steps.length} steps rolls back: the mode is simple again every time`, back === steps.length, detail);
    const cap = a.get('SESSION_APPLY_CAPTURED'), unt = a.get('SESSION_APPLY_UNTOUCHED');
    check('uiMode is CAPTURED (apply writes it) and not on the left-alone list; captureSessionGlobals() returns it', cap.includes('uiMode') && !unt.includes('uiMode') && 'uiMode' in a.sb.captureSessionGlobals());
    check('collectSessionState() hands the live value over', a.sb.collectSessionState(uiOf(a, 'none', 6)).uiMode === 'simple');
}
console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? 'PASS' : 'FAIL');
process.exit(failures === 0 ? 0 : 1);
