/**
 * tools/color/test-anchor-neutral.js (task 153)
 * The neutral anchor ("-" in the hue stepper: white, gray, black): a NEW anchor is neutral (both views, hueIndex stays 1..24, register default untouched); the optional anchor field
 * `neutral` is written only when true, round-trips through the session, an anchor without it (every session from before task 153) stays a hue anchor, a bad value reads as absent,
 * hueIndex 0 is still refused (an older build must keep accepting what this one writes: nothing outside 1..24 is ever written).
 */
'use strict';
const S = require('../session/scenarios.js');
const F = require('../session/fixtures.js');
const { clone, J } = F;
const { world, uiOf, snapOf, fakeHooks, applyInto } = S;
let fails = 0, n = 0;
function check(name, ok, d) { n++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${d !== undefined ? '  [' + d + ']' : ''}`); }
const w = world('square', 3, 5, 'none');
w.run('uiMode = "advanced";');
const a0 = w.run("JSON.stringify(newFaceAnchor())");
check('a new anchor is neutral, hueIndex 1, register 0 in Erweitert', a0 === '{"hueIndex":1,"registerIndex":0,"neutral":true}', a0);
w.run('uiMode = "simple";');
check('in Einfach: register 6 ("ia") and neutral', w.run("JSON.stringify(newFaceAnchor())") === '{"hueIndex":1,"registerIndex":6,"neutral":true}');
check('anchorFor creates the neutral anchor lazily (base)', w.run("(baseFaceAnchor = null, anchorFor('base').neutral)") === true);
// session
w.run("baseFaceAnchor = { hueIndex: 5, registerIndex: 2, neutral: true };");
let snap = snapOf(w, uiOf(w, 'none', 6));
check('the snapshot carries neutral: true', J(snap.base.faceAnchor) === '{"hueIndex":5,"registerIndex":2,"neutral":true}', J(snap.base.faceAnchor));
const into = world('square', 3, 5, 'none');
let r = applyInto(into, snap, fakeHooks(into, null, uiOf(into, 'none', 6)));
check('it round-trips (restore into another page)', r.ok === true && into.run('JSON.stringify(baseFaceAnchor)') === '{"hueIndex":5,"registerIndex":2,"neutral":true}', r.ok === true ? into.run('JSON.stringify(baseFaceAnchor)') : J(r).slice(0, 100));
w.run("baseFaceAnchor = { hueIndex: 5, registerIndex: 2 };");
snap = snapOf(w, uiOf(w, 'none', 6));
check('a hue anchor (no neutral) is written WITHOUT the field, byte as before', J(snap.base.faceAnchor) === '{"hueIndex":5,"registerIndex":2}');
const old = clone(snap);
const t2 = world('square', 3, 5, 'none');
r = applyInto(t2, old, fakeHooks(t2, null, uiOf(t2, 'none', 6)));
check('an anchor without the field restores as a hue anchor (no neutral)', r.ok === true && t2.run('JSON.stringify(baseFaceAnchor)') === '{"hueIndex":5,"registerIndex":2}');
for (const bad of [false, 1, 'true', null, {}, []]) {
    const s2 = clone(snap); s2.base.faceAnchor.neutral = bad;
    const t3 = world('square', 3, 5, 'none');
    const r3 = applyInto(t3, s2, fakeHooks(t3, null, uiOf(t3, 'none', 6)));
    check(`a bad neutral ${J(bad)} reads as absent, not an error`, r3.ok === true && t3.run('JSON.stringify(baseFaceAnchor)') === '{"hueIndex":5,"registerIndex":2}');
}
const s4 = clone(snap); s4.base.faceAnchor.hueIndex = 0;
check('hueIndex 0 is still refused by the validator (the neutral state is a flag, never a hue)', w.sb.validateSession(Object.assign(clone(s4), { savedAt: 1 })).ok === false);
const s5 = clone(snap); s5.base.faceAnchor.neutral = true;
const v = w.sb.validateSession(Object.assign(clone(s5), { savedAt: 1 }));
check('validate keeps neutral: true', v.ok && v.snapshot.base.faceAnchor.neutral === true);
console.log(`${n - fails}/${n} checks passed`);
process.exit(fails ? 1 : 0);
