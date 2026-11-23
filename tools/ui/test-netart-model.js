/**
 * tools/ui/test-netart-model.js - task 122: the Netzart model (ui-net-art.js): the table per shape, the stepper stops and their reasons, the 3C parameter steps, the warnings, the
 * suggestions at the actual canvas (against Messung 6 of reports/120-messung.md), and the table against the core (available <=> the core builds a warp).
 *   node tools/ui/test-netart-model.js
 * Sabotages S1, S5, S6 (the rest of S1 to S8 is in tools/ui/test-netart-sketch.js): each must turn a check red.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const MODEL = fs.readFileSync(path.join(ROOT, 'ui-net-art.js'), 'utf8'), CORE = fs.readFileSync(path.join(ROOT, 'core', 'netwarp.js'), 'utf8');
const load = src => { const sb = { console, module: { exports: {} } }; vm.createContext(sb); vm.runInContext(src, sb); return sb.module.exports; };
const loadCore = () => { const sb = { console }; vm.createContext(sb); vm.runInContext(CORE, sb); return sb; };
const mut = (s, a, b) => { if (!s.includes(a)) throw new Error('sabotage text not found: ' + a); return s.replace(a, b); };
const key = l => l.map(c => c.a + ',' + c.b + (c.format === 'half' ? 'h' : '')).join('  ');

function suite(modelSrc) {
  const res = [], check = (name, ok, detail) => res.push({ name, ok: !!ok, detail });
  const guard = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw: ' + String(e.message).slice(0, 80) + ')', false); } };
  const M = load(modelSrc), core = loadCore(), api = { spec: core.netProjectiveSpec, info: core.netProjectiveInfo };
  guard('1', () => {
    const e = s => M.entries(s).map(x => x.id + ':' + (x.ok ? 'ok' : 'no')).join(' ');
    check('1. the table: square -, 1, 3C all available', e('square') === 'off:ok n1:ok n3c:ok', e('square'));
    check('1b. triangle: 3C available (task 124); hexagon: 3C blocked, with a reason key', e('triangle') === 'off:ok n1:ok n3c:ok' && e('hex') === 'off:ok n1:ok n3c:no' && M.entries('hex')[2].reason === 'net.art.reason.n3c.hex', e('triangle') + ' | ' + e('hex'));
    check('1c. an unknown shape: nothing but the reason (no throw)', M.entries('circle').every(x => !x.ok && x.reason === 'net.art.reason.shape'));
  });
  guard('2', () => {
    const s = (sh, c, d) => JSON.stringify(M.step(sh, c, d));
    check('2. steps on the square: - > 1 > 3C, back; the ends say why', s('square', 'off', 1) === '{"to":"n1"}' && s('square', 'n1', 1) === '{"to":"n3c"}' && s('square', 'n3c', -1) === '{"to":"n1"}' && s('square', 'n1', -1) === '{"to":"off"}' && M.step('square', 'off', -1).to === null && M.step('square', 'off', -1).reason === 'net.art.reason.min', s('square', 'off', -1));
    const past = M.step('square', 'n3c', 1);
    check('2b. past 3C: blocked, the reason names the Netzarten that are not built', past.to === null && past.reason === 'net.art.later.n2' && past.later === true);
    check('2c. triangle: 1 -> 3C is a stop; hexagon: 1 -> 3C is blocked with the 3C reason, not a stop', M.step('triangle', 'n1', 1).to === 'n3c' && M.step('hex', 'n1', 1).to === null && M.step('hex', 'n1', 1).reason === 'net.art.reason.n3c.hex');
    check('2d. the Netzarten that are not built are listed (2, 3A/3B, 4, 5 to 10), none is a stop', M.later().length === 4 && M.later().every(x => x.reason.startsWith('net.art.later.')) && !M.ART.some(a => a.id.startsWith('n2')));
  });
  guard('3', () => {
    check('3. a: 2 .. b-1', M.stepA(2, 4, -1).to === null && M.stepA(2, 4, -1).reason === 'net.art.reason.aMin' && M.stepA(3, 4, 1).to === null && M.stepA(3, 4, 1).reason === 'net.art.reason.aMax' && M.stepA(2, 4, 1).to === 3 && M.stepA(3, 5, -1).to === 2);
    check('3b. b: a+1 .. 12', M.stepB(3, 4, -1).to === null && M.stepB(3, 4, -1).reason === 'net.art.reason.bMin' && M.stepB(2, 12, 1).to === null && M.stepB(2, 12, 1).reason === 'net.art.reason.bMax' && M.stepB(2, 4, 1).to === 5 && M.stepB(2, 5, -1).to === 4);
    const all = []; for (const [a, b] of [[2, 3], [2, 4], [5, 9], [11, 12]]) { for (const d of [1, -1]) { const r = M.stepA(a, b, d), q = M.stepB(a, b, d); if (r.to !== null) all.push(core.netProjectiveEffective(core.netProjectiveSpec(r.to, b, 'full'), 'square').valid); if (q.to !== null) all.push(core.netProjectiveEffective(core.netProjectiveSpec(a, q.to, 'full'), 'square').valid); } }
    check('3d. the triangle takes a >= 1: a = 1 is a stop, below it the reason names a >= 1; the square still stops at 2', M.stepA(2, 4, -1, 'triangle').to === 1 && M.stepA(1, 4, -1, 'triangle').to === null && M.stepA(1, 4, -1, 'triangle').reason === 'net.art.reason.aMin1' && M.stepA(2, 4, -1, 'square').to === null && M.stepA(2, 4, -1).reason === 'net.art.reason.aMin');
    check('3e. the half format is not offered on the triangle (the reason key), both are on the square', M.formatAvail('triangle', 'half').ok === false && M.formatAvail('triangle', 'half').reason === 'net.art.reason.n3c.triHalf' && M.formatAvail('triangle', 'full').ok && M.formatAvail('square', 'half').ok && M.formatAvail('square', 'full').ok);
    check('3c. every step the model allows is a spec the core accepts', all.length > 0 && all.every(Boolean), String(all.length));
  });
  guard('4', () => {
    const w = (a, b, f, W, H) => M.warnings(core.netProjectiveInfo(core.netProjectiveSpec(a, b, f), W, H));
    const x = w(2, 4, 'full', 800, 600), y = w(3, 7, 'half', 600, 600);
    check('4. 2,4 full at 4:3 (stretch 2.73, W 6): both warnings; 3,7 half at 1:1 (W 10, stretch 1.64): none', x.stretch && x.wLow && !x.wHigh && !y.stretch && !y.wLow && !y.wHigh, JSON.stringify([x, y]));
    const t = (a, b, W, H) => M.warnings(core.netProjectiveInfo(core.netProjectiveSpec(a, b, 'full', '\u25b3N'), W, H), 'triangle');
    check('4c. the triangle: W 8 to 16 is the optimum (1,3 W 8 and 3,5 W 16 do not warn about W, 1,2 W 3 warns low, 4,8 W 48 high); the square keeps 7 to 12', !t(1, 3, 600, 600).wLow && !t(1, 3, 600, 600).wHigh && !t(3, 5, 900, 600).wHigh && t(1, 2, 600, 600).wLow && t(4, 8, 600, 600).wHigh && M.limitsFor('triangle').wLo === 8 && M.limitsFor('triangle').wHi === 16 && M.limitsFor('square').wLo === 7 && M.limitsFor('square').wHi === 12);
    check('4b. a high W (4,8 full, W 24) warns, the choice is not blocked', w(4, 8, 'full', 600, 900).wHigh === true);
  });
  guard('5', () => {
    // Messung 6, reports/120-messung.md: "brauchbar" (W 7 to 12, stretch <= 2, b <= 9) per frame ratio, squares
    const want = { 0.5: '', 0.67: '2,7h', 1: '2,6h  3,7h  4,8h', 1.5: '3,7h  4,7h  4,8h  5,8h  6,9h', 2: '2,5  4,7h  4,8h  5,8h  6,8h  6,9h' };
    const bad = [];
    for (const r of [0.5, 0.67, 1, 1.5, 2]) {
      const got = M.suggest(api, Math.round(r * 600), 600).list.slice().sort((p, q) => (p.format === q.format ? 0 : p.format === 'full' ? -1 : 1) || p.b - q.b || p.a - q.a), exp = want[r];
      const gk = key(got.filter(c => true)), ek = exp;
      // the model caps at 8 and sorts by stretch: compare as sets
      const gs = new Set(gk ? gk.split('  ') : []), es = new Set(ek ? ek.split('  ') : []);
      if (gs.size !== es.size || [...es].some(k => !gs.has(k))) bad.push(`${r}: got [${gk}] want [${ek}]`);
    }
    check('5. suggestions at the frame ratios 1:2, 2:3, 1:1, 3:2, 2:1 equal the "brauchbar" table of Messung 6', bad.length === 0, bad.join(' ; '));
    const a = M.suggest(api, 600, 600), b = M.suggest(api, 1200, 600);
    check('5b. the suggestions follow the ACTUAL canvas (1:1 differs from 2:1)', key(a.list) !== key(b.list) && a.list.length > 0 && b.list.length > 0);
    const none = M.suggest(api, 300, 600);
    check('5c. no suggestion at 1:2: an empty list and a least-stretched hint', none.list.length === 0 && none.best && none.best.b <= 9 && none.best.stretch > 2, JSON.stringify(none.best));
    check('5d. every suggestion obeys the limits (b <= 9, W 7..12, stretch <= 2) and at most 8 are given', [M.suggest(api, 600, 600), M.suggest(api, 800, 600), M.suggest(api, 1200, 600)].every(s => s.list.length <= 8 && s.list.every(c => c.b <= 9 && c.W >= 7 && c.W <= 12 && c.stretch <= 2 + 1e-9)));
    // the triangle (task 124): reports/120-messung.md measurement 6 recomputed with the sqrt 3 reference (tools/grid/measure-3c-triangle.js); a >= 1, W 8 to 16, full format only
    const wantT = { 0.5: '', 0.75: '1,3  1,4', 1: '1,3  2,4', 1.5: '2,4  3,5', 2: '2,4  3,5' }, badT = [];
    for (const r of [0.5, 0.75, 1, 1.5, 2]) {
      const got = M.suggest(api, Math.round(r * 600), 600, 'triangle').list, gs = new Set(key(got) ? key(got).split('  ') : []), es = new Set(wantT[r] ? wantT[r].split('  ') : []);
      if (gs.size !== es.size || [...es].some(k => !gs.has(k))) badT.push(`${r}: got [${key(got)}] want [${wantT[r]}]`);
    }
    check('5f. triangle suggestions at the frame ratios 1:2, 3:4, 1:1, 3:2, 2:1 equal the recomputed table (full format only)', badT.length === 0, badT.join(' ; '));
    check('5g. every triangle suggestion obeys the limits (full, W 8..16, stretch <= 2, b <= 9, a >= 1) and is a spec the core accepts on the triangle', [M.suggest(api, 600, 600, 'triangle'), M.suggest(api, 900, 600, 'triangle'), M.suggest(api, 1200, 600, 'triangle')].every(s => s.list.length > 0 && s.list.every(c => c.format === 'full' && c.b <= 9 && c.a >= 1 && c.W >= 8 && c.W <= 16 && c.stretch <= 2 + 1e-9 && core.netProjectiveEffective(core.netProjectiveSpec(c.a, c.b, c.format, '\u25b3N'), 'triangle').valid)));
    const dt = M.defaultFor(api, 900, 600, 'triangle');
    check('5h. the default on the triangle is a valid triangle spec (full)', dt.format === 'full' && core.netProjectiveEffective(core.netProjectiveSpec(dt.a, dt.b, dt.format, '\u25b3N'), 'triangle').valid);
    const d = M.defaultFor(api, 800, 600);
    check('5e. the default for 3C is a valid spec (the first suggestion, else the least stretched)', core.netProjectiveEffective(core.netProjectiveSpec(d.a, d.b, d.format), 'square').valid);
  });
  guard('6', () => {
    const spec = core.netProjectiveSpec(2, 4, 'full');
    for (const sh of ['square', 'triangle', 'hex']) {
      const corners = sh === 'square' ? [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] : sh === 'triangle' ? [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 86 }] : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 1 }];
      const built = core.netWarpForBase(spec, sh, corners, 4, 3) !== null, listed = M.entries(sh)[2].ok;
      check(`6. the table agrees with the core on ${sh}: 3C available <=> a warp is built`, built === listed, `core ${built}, table ${listed}`);
    }
  });
  guard('7', () => {
    check('7. the matrix cells are only tooltips data (1.1 for Netzart 1, 2.2 for 3C), the stop texts are "-", "1", "3C"', M.ART.map(a => a.short).join('|') === '—|1|3C' && M.ART[1].matrix === '1.1' && M.ART[2].matrix === '2.2');
    const tfake = (k, p) => k + JSON.stringify(p);
    check('7c. measureLine (task 123): the text of the measures for a valid net, null for an invalid one', M.measureLine(core.netProjectiveInfo(core.netProjectiveSpec(3, 7, 'half'), 600, 600), 'de', tfake) === 'net.3c.info{"w":"10","s":"1,6"}' && M.measureLine({ valid: false }, 'de', tfake) === null);
    check('7b. numbers in the language of the UI', M.summary({ valid: true, W: 6.75, stretch: 2.7345 }, 'de').W === '6,75' && M.summary({ valid: true, W: 6, stretch: 2.7345 }, 'de').stretch === '2,7' && M.summary({ valid: true, W: 6.75, stretch: 2.04 }, 'en').stretch === '2');
  });
  return res;
}

let failures = 0, checks = 0;
suite(MODEL).forEach(r => { checks++; if (!r.ok) failures++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail !== undefined && r.detail !== '' ? '  [' + r.detail + ']' : ''}`); });
console.log('== sabotages: each must turn at least one check red ==');
const SAB = [
  ['S1  the table blocks 3C on the triangle', s => mut(s, 'triangle: OK, hex:', "triangle: { ok: false, reason: 'net.art.reason.n3c.hex' }, hex:")],
  ['S5  the suggestions ignore the canvas ratio', s => mut(s, 'api.info(api.spec(a, b, format, lim.family), W, H)', 'api.info(api.spec(a, b, format, lim.family), 600, 600)')],
  ['S10 the triangle uses the square\'s W range', s => mut(s, 'wLo: 8, wHi: 16', 'wLo: 7, wHi: 12')],
  ['S11 the triangle offers the half format', s => mut(s, "formats: ['full'] }", "formats: ['full', 'half'] }")],
  ['S12 the triangle stops at a = 2', s => mut(s, "aMin: 1, aMinReason: 'net.art.reason.aMin1'", "aMin: 2, aMinReason: 'net.art.reason.aMin1'")],
  ['S6  b may be <= a', s => mut(s, 'if (n <= a) return', 'if (false) return')],
  ['S9  a step past 3C is a stop (no reason)', s => mut(s, "if (j >= ART.length) return { to: null, reason: LATER[0].reason, later: true };", "if (j >= ART.length) return { to: 'n3c' };")]
];
for (const [name, fn] of SAB) {
  let red = []; try { red = suite(fn(MODEL)).filter(r => !r.ok).map(r => r.name.slice(0, 40)); } catch (e) { red = ['sabotage setup: ' + e.message]; }
  checks++; const ok = red.length > 0 && !red[0].startsWith('sabotage setup'); if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  [red: ${red.length}${red.length ? ' - ' + red.slice(0, 3).join(' | ') : ''}]`);
}
console.log(`\n${checks - failures}/${checks} passed${failures ? ', ' + failures + ' FAILED' : ''}`);
process.exit(failures ? 1 : 0);
