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
  function readoutText(domain, n, t) {
    const v = Math.round(Number(n));
    return t(readoutKey(domain), { n: Number.isFinite(v) && v >= 1 ? v : 1 });
  }
  const api = { readoutKey: readoutKey, readoutText: readoutText, KEYS: KEYS };
  root.netReadout = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
