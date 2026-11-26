/**
 * tools/color/test-gray-tones.js (task 149)
 * The gray ladders of the default gray fill (rule max-contrast-gray, hidden axis `tones`): 2/3/4/8 tones with true white and true black ends and the Ostwald letters
 * between them; 0 = the legacy ladder (unchanged); a caller that knows only the first axis stays valid; fewer trails than tones spread evenly, more are cyclic;
 * direction reverses; the session field (settings.grayTones) reads absent/bad as 0.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'core', 'color.js'), 'utf8'), ctx, { filename: 'core/color.js' });
const C = vm.runInContext('({ generateHarmonyPalette, harmonyRuleParams, getHarmonyRule, OSTWALD_REFERENCE_SYSTEM })', ctx);
let fails = 0, n = 0;
function check(name, ok, d) { n++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${d !== undefined ? '  [' + d + ']' : ''}`); }
const hexes = (idx, slots) => C.generateHarmonyPalette('max-contrast-gray', idx, slots).map(c => c.hex);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const LEG = ['#f2f2f2', '#c5c5c5', '#a0a0a0', '#818181', '#696969', '#545454', '#434343', '#353535'];
check('legacy [0] = the old 8 ladder', eq(hexes([0], 8), LEG), hexes([0], 8).join(' '));
check('legacy [0,0] equals [0] for 1..12 slots', Array.from({ length: 12 }, (_, i) => i + 1).every(k => eq(hexes([0], k), hexes([0, 0], k))));
check('legacy still cyclic beyond 8', eq(hexes([0], 10), Array.from({ length: 10 }, (_, i) => LEG[i % 8])))
check('stepper axes unchanged: one axis (direction)', C.harmonyRuleParams(C.getHarmonyRule('max-contrast-gray'), C.OSTWALD_REFERENCE_SYSTEM).length === 1);
const L8 = ['#ffffff', '#c5c5c5', '#a0a0a0', '#818181', '#696969', '#545454', '#434343', '#000000'];
check('2 tones: white, black', eq(hexes([0, 2], 2), ['#ffffff', '#000000']), hexes([0, 2], 2).join(' '));
check('3 tones: white, i, black', eq(hexes([0, 3], 3), ['#ffffff', '#696969', '#000000']), hexes([0, 3], 3).join(' '));
check('4 tones: white, e, l, black', eq(hexes([0, 4], 4), ['#ffffff', '#a0a0a0', '#545454', '#000000']), hexes([0, 4], 4).join(' '));
check('8 tones: white, c..n, black', eq(hexes([0, 8], 8), L8), hexes([0, 8], 8).join(' '));
check('steps between the ends are the legacy letters (c e g i l n)', L8.slice(1, 7).every((h, i) => h === LEG[i + 1]));
const w8 = C.generateHarmonyPalette('max-contrast-gray', [0, 8], 8);
check('ends are exact: white w1 s0, black w0 s1', w8[0].w === 1 && w8[0].s === 0 && w8[7].w === 0 && w8[7].s === 1);
check('more trails than tones: cyclic', eq(hexes([0, 3], 7), ['#ffffff', '#696969', '#000000', '#ffffff', '#696969', '#000000', '#ffffff']), hexes([0, 3], 7).join(' '));
check('8 tones, 4 trails: spread over the ladder (white .. black)', hexes([0, 8], 4)[0] === '#ffffff' && hexes([0, 8], 4)[3] === '#000000', hexes([0, 8], 4).join(' '));
check('8 tones, 2 trails: white, black', eq(hexes([0, 8], 2), ['#ffffff', '#000000']));
check('one trail: 2 tones white, 3 tones i', hexes([0, 2], 1)[0] === '#ffffff' && hexes([0, 3], 1)[0] === '#696969');
check('direction 1 reverses the order', eq(hexes([1, 4], 4), hexes([0, 4], 4).slice().reverse()));
check('invalid tones refused', [1, 5, 9].every(t => { try { hexes([0, t], 3); return false; } catch (e) { return true; } }));
check('too many entries refused', (() => { try { hexes([0, 8, 8], 3); return false; } catch (e) { return true; } })());
check('other rules unchanged: isotint idx length still strict', (() => { try { C.generateHarmonyPalette('isotint', [0], 3); return false; } catch (e) { return true; } })());

const sctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'core', 'session.js'), 'utf8'), sctx, { filename: 'core/session.js' });
const norm = vm.runInContext('_grayTonesNormalize', sctx);
check('session normalizer: 2/3/4/8 kept, others 0', [2, 3, 4, 8].every(t => norm(t) === t) && [undefined, null, 0, 1, 5, '8', 16].every(t => norm(t) === 0));
console.log(`${n - fails}/${n} checks passed`);
process.exit(fails ? 1 : 0);
