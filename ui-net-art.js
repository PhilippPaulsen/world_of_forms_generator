/*
 * The Netzart model of the Netz row (task 122, 3C-3): which net kind ("Netzart", Hinterreiter vol. II) the stepper offers for which SHAPE, how it steps, why a stop is blocked, and the
 * suggestions for the Moebius net (3C). Pure (no DOM, no globals except what is passed in): ui-net.js reads it on every UI tick; tools/ui/test-netart-model.js pins it.
 *
 * THE TABLE (one place; 3C-2 adds the triangle by changing one entry of AVAIL.n3c):
 *   off  "-"   no net                                  all shapes
 *   n1   "1"   Netzart 1, Barenscharen (matrix 1.1)    all shapes (square: Single / Tiled / Field; triangle and hexagon: Field only - the Netz row's own rule)
 *   n3c  "3C"  Netzart 3, variant C, the Moebius net   square only (family square-N); the triangle follows in 3C-2, the hexagon lacks the omission rule (Messung 7)
 * Every other Netzart (2, 3A, 3B, 4, 5 to 10) is listed with a reason (LATER) and never a stop. A reason is a KEY of ui-i18n.js, never a text.
 */
(function (root) {
  'use strict';
  const ART = [
    { id: 'off', short: '—', matrix: null },
    { id: 'n1', short: '1', matrix: '1.1' },
    { id: 'n3c', short: '3C', matrix: '2.2' }
  ];
  const SHAPES = ['square', 'triangle', 'hex'];
  const OK = { ok: true };
  const AVAIL = {
    off: { square: OK, triangle: OK, hex: OK },
    n1: { square: OK, triangle: OK, hex: OK },
    n3c: { square: OK, triangle: { ok: false, reason: 'net.art.reason.n3c.triangle' }, hex: { ok: false, reason: 'net.art.reason.n3c.hex' } }
  };
  // the Netzarten that are not built, with the reason (ui-i18n keys); the stepper names the first one when it is asked past 3C
  const LATER = [
    { id: 'n2', label: '2', reason: 'net.art.later.n2' },
    { id: 'n3ab', label: '3A, 3B', reason: 'net.art.later.n3ab' },
    { id: 'n4', label: '4', reason: 'net.art.later.n4' },
    { id: 'n5', label: '5–10', reason: 'net.art.later.n5' }
  ];
  const A_MIN = 2, B_MAX = 12, SUGGEST_B_MAX = 9, W_LO = 7, W_HI = 12, STRETCH_MAX = 2, SUGGEST_MAX = 8;

  function known(shape) { return SHAPES.indexOf(shape) >= 0; }
  function availability(id, shape) { const row = AVAIL[id]; return row && known(shape) ? row[shape] : { ok: false, reason: 'net.art.reason.shape' }; }
  // the stepper stops for a shape, with their state
  function entries(shape) { return ART.map(function (a) { const v = availability(a.id, shape); return { id: a.id, short: a.short, matrix: a.matrix, ok: v.ok, reason: v.ok ? null : v.reason }; }); }
  function indexOf(id) { for (let i = 0; i < ART.length; i++) if (ART[i].id === id) return i; return 0; }
  // the next stop: { to: id } or { to: null, reason: key } (blocked: the chevron says why). dir +1 / -1.
  function step(shape, current, dir) {
    const i = indexOf(current), j = i + (dir > 0 ? 1 : -1);
    if (j < 0) return { to: null, reason: 'net.art.reason.min' };
    if (j >= ART.length) return { to: null, reason: LATER[0].reason, later: true };
    const v = availability(ART[j].id, shape);
    return v.ok ? { to: ART[j].id } : { to: null, reason: v.reason };
  }
  function later() { return LATER.slice(); }
  // the 3C parameters: a in 2..b-1, b in a+1..12 (the core's range); a step that would leave it is blocked with a reason key
  function stepA(a, b, dir) {
    const n = a + (dir > 0 ? 1 : -1);
    if (n < A_MIN) return { to: null, reason: 'net.art.reason.aMin' };
    if (n >= b) return { to: null, reason: 'net.art.reason.aMax' };
    return { to: n };
  }
  function stepB(a, b, dir) {
    const n = b + (dir > 0 ? 1 : -1);
    if (n > B_MAX) return { to: null, reason: 'net.art.reason.bMax' };
    if (n <= a) return { to: null, reason: 'net.art.reason.bMin' };
    return { to: n };
  }
  // hints for a measured net (info = netProjectiveInfo): a warning is only a note, the choice stays free
  function warnings(info) {
    if (!info || !info.valid) return { stretch: false, wLow: false, wHigh: false };
    return { stretch: info.stretch > STRETCH_MAX + 1e-9, wLow: info.W < W_LO - 1e-9, wHigh: info.W > W_HI + 1e-9 };
  }
  // The suggestions at the ACTUAL canvas: every (a, b, format) with b <= 9, W in 7..12 and a stretch of at most 2 (Messung 6), best stretch first; at most 8.
  // api = { spec(a, b, format), info(spec, W, H) } = netProjectiveSpec / netProjectiveInfo of core/netwarp.js. { list, best }: with no suggestion `best` is the least stretched
  // combination with b <= 9 (a hint, not a choice made).
  function suggest(api, W, H) {
    const all = [];
    ['full', 'half'].forEach(function (format) {
      for (let b = A_MIN + 1; b <= SUGGEST_B_MAX; b++) for (let a = A_MIN; a < b; a++) {
        const info = api.info(api.spec(a, b, format), W, H);
        if (info && info.valid) all.push({ a: a, b: b, format: format, W: info.W, stretch: info.stretch });
      }
    });
    const mid = (W_LO + W_HI) / 2, order = function (x, y) { return x.stretch - y.stretch || Math.abs(x.W - mid) - Math.abs(y.W - mid) || x.b - y.b || x.a - y.a; };
    const good = all.filter(function (c) { return c.W >= W_LO - 1e-9 && c.W <= W_HI + 1e-9 && c.stretch <= STRETCH_MAX + 1e-9; }).sort(order);
    const best = all.slice().sort(order)[0] || null;
    return { list: good.slice(0, SUGGEST_MAX), all: good.length, best: best };
  }
  // the default when 3C is switched on: the first suggestion, else the least stretched
  function defaultFor(api, W, H) { const s = suggest(api, W, H); return s.list[0] || s.best || { a: 2, b: 5, format: 'full' }; }
  // "6", "6.75" or, in German, "6,75": W has at most two decimals, the stretch one
  function num(v, d, lang) { const s = (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toString(); return lang === 'de' ? s.replace('.', ',') : s; }
  function summary(info, lang) { return info && info.valid ? { W: num(info.W, 2, lang), stretch: num(info.stretch, 1, lang) } : null; }
  const api = { ART: ART, SHAPES: SHAPES, AVAIL: AVAIL, LATER: LATER, entries: entries, availability: availability, step: step, later: later, stepA: stepA, stepB: stepB, warnings: warnings, suggest: suggest, defaultFor: defaultFor, summary: summary, num: num, limits: { A_MIN: A_MIN, B_MAX: B_MAX, SUGGEST_B_MAX: SUGGEST_B_MAX, W_LO: W_LO, W_HI: W_HI, STRETCH_MAX: STRETCH_MAX } };
  root.netArt = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
