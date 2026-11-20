/*
 * The readout line of the Netz sheet (sheets redesign, commit 4a): ONE line under the domain buttons that says what the chosen domain does with the shape size, in the current language
 * ("Feld: 5 x 5 Kacheln", "Gekachelt: 5 x 5", "Einzeln: ein Netz"). The model is pure (no DOM, no globals): the domain and the shape size n in, the text out, through a translate function
 * (UI.t of ui-i18n.js: key + { n }). ui-net.js reads the active domain button and `shapeSizeFactor` (core/state.js) on every UI tick and writes the text into #net-readout, which only the phone CSS shows.
 * The long explanations (the hints sketch.js writes) are parked on the phone and move to the Info card in a later commit.
 */
(function (root) {
  'use strict';
  const KEYS = { single: 'net.readout.single', tiled: 'net.readout.tiled', field: 'net.readout.field' };
  // a domain this model does not know reads like Single (the default net); the dictionary key of its line
  function readoutKey(domain) { return Object.prototype.hasOwnProperty.call(KEYS, domain) ? KEYS[domain] : KEYS.single; }
  // n = the shape size (1..9): anything else is read as 1; t(key, { n }) = the translation
  // task 086: m = the height count of a non-square Field ("Feld: 3 × 5 Kacheln"); absent or equal to n it is the square line, byte-equal to before
  function readoutText(domain, n, t, m, cut, hex) {
    const v = Math.round(Number(n)), vn = Number.isFinite(v) && v >= 1 ? v : 1, w = Math.round(Number(m));
    if (cut && readoutKey(domain) === KEYS.field && Number.isFinite(w) && w >= 1) return t(hex ? 'net.readout.fieldCutHex' : 'net.readout.fieldCut', { n: vn, m: w });   // task 088: a Field that covers the canvas with cut edge meshes (the triangle)
    if (readoutKey(domain) === KEYS.field && Number.isFinite(w) && w >= 1 && w !== vn) return t('net.readout.field2', { n: vn, m: w });
    return t(readoutKey(domain), { n: vn });
  }
  // task 092: the domain the readout names. The active domain button is only updated by the next draw() (sketch.js netControlsSync resets a Field at an invalid size to Single there), so right after a size change the
  // button still says 'field': a Field that the size no longer allows (fieldOk false) is read as Single at once.
  function readoutDomain(activeDomain, fieldOk) { return activeDomain === 'field' && fieldOk === false ? 'single' : activeDomain; }
  // task 111: the name of the net family the SHAPE determines (Hinterreiter vol. II: square net, p. 10; triangle net and hexagon net, p. 14), written in front of the readout line. Only for a Field and only while a net
  // is active (`active`: the kind is not Off); every other domain, an inactive net and an unknown shape give ''. A separate pure function: readoutText() above is unchanged (its lines are pinned).
  const FAMILY_KEYS = { square: 'net.family.square', triangle: 'net.family.triangle', hex: 'net.family.hex' };
  function readoutFamily(shape, domain, active, t) {
    if (domain !== 'field' || !active || !Object.prototype.hasOwnProperty.call(FAMILY_KEYS, shape)) return '';
    return t(FAMILY_KEYS[shape]);
  }
  const api = { readoutKey: readoutKey, readoutText: readoutText, readoutDomain: readoutDomain, readoutFamily: readoutFamily, KEYS: KEYS, FAMILY_KEYS: FAMILY_KEYS };
  root.netReadout = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
