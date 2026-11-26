/**
 * tools/session/test-session-gray.js (task 149)
 * settings.grayTones: always written (after uiMode, schema 2 unchanged), 2/3/4/8 round-trip, a snapshot WITHOUT the field or with a bad value restores 0 (the legacy ladder, so an old
 * session is drawn as before), unknown keys are still dropped, grayTones is a captured global (restorable on a failed apply) and the default of a page is 8.
 */
'use strict';
const F = require('./fixtures.js');
const S = require('./scenarios.js');
const { clone, J } = F;
const { world, uiOf, snapOf, fakeHooks, applyInto } = S;
let failures = 0, checks = 0;
function check(name, ok, detail) { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); }
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.message)); process.exit(1); });
const get = ctx => ctx.get('grayTones'), set = (ctx, v) => ctx.run(`grayTones = ${J(v)};`);

{
    const state = F.read('core/state.js');
    check('core/state.js: GRAY_TONES_DEFAULT = 8 and `let grayTones = GRAY_TONES_DEFAULT`', /const GRAY_TONES_DEFAULT = 8;/.test(state) && /^let grayTones = GRAY_TONES_DEFAULT;/m.test(state));
    const raw = require('vm').runInNewContext(state.replace(/^let /gm, 'var ').replace(/^const /gm, 'var ') + ';[GRAY_TONES_DEFAULT, grayTones]', {}, {});
    check('a page without a session starts at 8 (the real state.js, before the test worlds set the legacy 0)', raw[0] === 8 && raw[1] === 8);
}
for (const t of [0, 2, 3, 4, 8]) {
    const w = world('square', 3, 5, 'none'); w.run('connections = [[1, 6], [2, 9]];'); set(w, t);
    const snap = snapOf(w, uiOf(w, 'none', 6)), keys = Object.keys(snap.settings);
    check(`grayTones ${t}: written right after uiMode, the schema is still 2`, snap.settings.grayTones === t && keys.at(-1) === 'grayTones' && keys.at(-2) === 'uiMode' && snap.schema === 2);
    const into = world('square', 3, 5, 'none'); set(into, t === 8 ? 3 : 8);
    const r = applyInto(into, snap, fakeHooks(into, null, uiOf(into, 'none', 6)));
    check(`grayTones ${t} round-trips (the page it is restored into held another value)`, r.ok === true && get(into) === t, r.ok === true ? get(into) : J(r).slice(0, 100));
}
{
    const a = world('hex', 3, 3, 'none'); set(a, 8);
    const snap = snapOf(a, uiOf(a, 'none', 6));
    const old = clone(snap); delete old.settings.grayTones;
    const t = world('hex', 3, 3, 'none'); set(t, 8);
    const r = applyInto(t, old, fakeHooks(t, null, uiOf(t, 'none', 6)));
    check('a snapshot WITHOUT the field validates and restores 0 (the legacy ladder) into a page that held 8', r.ok === true && get(t) === 0, r.ok === true ? get(t) : J(r).slice(0, 100));
    for (const bad of [1, 5, 9, -2, '8', null, true, {}, [], 2.5, NaN]) {
        const s2 = clone(snap); s2.settings.grayTones = bad;
        const t2 = world('hex', 3, 3, 'none'); set(t2, 8);
        const r2 = applyInto(t2, s2, fakeHooks(t2, null, uiOf(t2, 'none', 6)));
        check(`a bad value ${J(bad)} is not an error: restores 0`, r2.ok === true && get(t2) === 0);
    }
    const s3 = clone(snap); s3.settings.extraThing = 1; s3.settings.grayTones = 4;
    const v = a.sb.validateSession(Object.assign(clone(s3), { savedAt: 1 }));
    check('unknown keys of settings are dropped, the tone count is kept', v.ok && !('extraThing' in v.snapshot.settings) && v.snapshot.settings.grayTones === 4);
    check('captureSessionGlobals() returns grayTones (a failed apply gives it back)', 'grayTones' in a.sb.captureSessionGlobals());
}
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
