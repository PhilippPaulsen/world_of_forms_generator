/**
 * tools/color/test-gray-fill.js (task 149)
 * core/facecolor.js joins grayTones into the rule's idx in ONE place (_grayRuleIdx): the default gray fill (buildMaxContrastGraySelection), applyPaletteToTrails, assignTrailSlot and
 * spreadPaletteToUnassigned all follow the global; other rules are untouched; 0 = the legacy ladder.
 */
'use strict';
const S = require('../session/scenarios.js');
let fails = 0, n = 0;
function check(name, ok, d) { n++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${d !== undefined ? '  [' + d + ']' : ''}`); }
const w = S.world('square', 3, 5, 'none');
const ws = (sel) => sel.members.map(m => m.analyticalCoordinate.w);
const sel = (t, k) => { w.run(`grayTones = ${t};`); return ws(w.sb.buildMaxContrastGraySelection(k)); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check('grayTones 0: 8 trails get the legacy ladder (0.89 .. 0.035)', eq(sel(0, 8), [0.89, 0.56, 0.35, 0.22, 0.14, 0.089, 0.056, 0.035]));
check('grayTones 8: white (1) first, black (0) last, c e g i l n between', eq(sel(8, 8), [1, 0.56, 0.35, 0.22, 0.14, 0.089, 0.056, 0]));
check('grayTones 2 / 3 / 4', eq(sel(2, 2), [1, 0]) && eq(sel(3, 3), [1, 0.14, 0]) && eq(sel(4, 4), [1, 0.35, 0.089, 0]));
check('more trails than tones: cyclic over the ladder (3 tones, 7 trails)', eq(sel(3, 7), [1, 0.14, 0, 1, 0.14, 0, 1]));
check('fewer trails than tones: spread over the ladder (8 tones, 3 trails: white .. black)', (() => { const r = sel(8, 3); return r[0] === 1 && r[2] === 0; })());
w.run('grayTones = 4;');
const trails = [0, 1, 2, 3].map(i => ({ key: 'k' + i }));
const out = w.run(`(function () { const store = new Map(); const pal = { ruleId: 'max-contrast-gray', idx: [0], overrides: new Map() };
  const r = applyPaletteToTrails(store, ${JSON.stringify(trails)}, pal);
  const a = r.colors.map(c => c.hex);
  const one = assignTrailSlot(store, pal, 'k1', 3, 4).hex;
  return { a, one, w: Array.from(store.values()).map(e => e.w) }; })()`);
check('applyPaletteToTrails with idx [0] follows grayTones (4: white, e, l, black)', eq(out.a, ['#ffffff', '#a0a0a0', '#545454', '#000000']), out.a.join(' '));
check('assignTrailSlot reads the same ladder (slot 3 of 4 = black)', out.one === '#000000');
w.run('grayTones = 0;');
const leg = w.run(`(function () { const pal = { ruleId: 'max-contrast-gray', idx: [0], overrides: new Map() }; return applyPaletteToTrails(new Map(), ${JSON.stringify(trails)}, pal).colors.map(c => c.hex); })()`);
check('grayTones 0: the same call gives the legacy letters (a e l p)', eq(leg, ['#f2f2f2', '#a0a0a0', '#545454', '#353535']), leg.join(' '));
check('other rules are untouched by _grayRuleIdx', w.run("JSON.stringify(_grayRuleIdx('isotint', [3, 1]))") === '[3,1]');
console.log(`${n - fails}/${n} checks passed`);
process.exit(fails ? 1 : 0);
