'use strict';

/**
 * Ostwald historical structure, realized as a contemporary screen color model.
 * Oklab is the sole mixing space; historical pigment/disc colors are not reproduced.
 * All `lab` arrays mean Oklab, never CIELAB. No framework or browser state is used.
 */
const EPSILON = 1e-10;
const SCALE = Object.freeze([
  ['a', 0.8913], ['c', 0.5623], ['e', 0.3548], ['g', 0.2239],
  ['i', 0.1413], ['l', 0.0891], ['n', 0.0562], ['p', 0.0355]
].map(([letter, value]) => Object.freeze({ letter, value })));
const GROUPS = Object.freeze([
  'Yellow', 'Orange / Kreß', 'Red', 'Violet',
  'Ultramarine / Blue', 'Ice Blue', 'Sea Green', 'Leaf Green'
]);
const WHITE = Object.freeze([1, 0, 0]);
const BLACK = Object.freeze([0, 0, 0]);

/** Require a dense three-component array of finite numbers. */
function vector(value, name) {
  if (!Array.isArray(value) || value.length !== 3 ||
      ![0, 1, 2].every(i => Number.isFinite(value[i]))) {
    throw new TypeError(`${name} must be an array of three finite numbers`);
  }
}

/** Validate geometry; normalize only roundoff within EPSILON. */
function coordinates(w, s) {
  if (!Number.isFinite(w) || !Number.isFinite(s)) {
    throw new TypeError('w and s must be finite numbers');
  }
  if (w < -EPSILON || s < -EPSILON || w + s > 1 + EPSILON) {
    throw new RangeError('Require w >= 0, s >= 0 and w + s <= 1');
  }
  w = Math.max(0, w);
  s = Math.max(0, s);
  const total = w + s;
  if (total > 1) { w /= total; s /= total; }
  return { w, s, v: Math.max(0, 1 - w - s) };
}

/** Validate the one-based, discrete 24-part hue coordinate. */
function validateHue(hueIndex) {
  if (!Number.isInteger(hueIndex) || hueIndex < 1 || hueIndex > 24) {
    throw new RangeError('hueIndex must be an integer in 1..24');
  }
}

/** Inverse sRGB transfer function, with input in gamma-encoded 0..255. */
function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB bytes -> linear sRGB -> Oklab; Ottosson's 2021 matrices (public domain).
 * https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab
 */
function srgbToOklab(rgb) {
  const [r, g, b] = rgb.map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  ];
}

/** Oklab -> linear sRGB; do not clip the Oklab mixing coordinates. */
function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ];
}

/** Deterministic gamut policy: clamp linear channels, encode sRGB, round to bytes. */
function oklabToRgb(lab) {
  const linear = oklabToLinear(lab);
  if (!linear.every(Number.isFinite)) {
    throw new RangeError('Oklab conversion overflow: coordinates are too large');
  }
  return linear.map(channel => {
    const c = Math.min(1, Math.max(0, channel));
    const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(255 * encoded);
  });
}

/** Internal anchor adapter: future calibrated anchors may supply Oklab or sRGB. */
function anchorLab(anchor) {
  if (anchor.lab) return anchor.lab.slice();
  if (anchor.rgb) return srgbToOklab(anchor.rgb);
  const [L, C, degrees] = anchor.oklch;
  const radians = degrees * Math.PI / 180;
  return [L, C * Math.cos(radians), C * Math.sin(radians)];
}

/** Internal builder is the only source of full-color references. */
function buildHueReferences(n) {
  // Contemporary Oklab construction, NOT historical Ostwald pigment/disc colors.
  // Replace individual anchors here for future calibration without changing the API.
  return Array.from({ length: n }, (_, i) => {
    const anchor = { oklch: [0.72, 0.10, 115 - i * 360 / n], calibrated: false };
    const lab = anchorLab(anchor);
    return {
      index: i + 1, rgb: oklabToRgb(lab), lab,
      group: GROUPS[Math.floor(i * 8 / n)], calibrated: anchor.calibrated
    };
  });
}

/** Create one complete discrete field using an explicit reference circle. */
function makeField(hueIndex, white, black, circle) {
  return {
    hueIndex,
    ...OstwaldColor.mix(circle[hueIndex - 1].lab, white.value, 1 - black.value),
    label: `${hueIndex}${white.letter}${black.letter}`
  };
}

/** White-letter major, black-letter minor ordering; skip impossible pairs. */
function buildTriangle(hueIndex, circle) {
  const fields = [];
  for (const white of SCALE) {
    for (const black of SCALE) {
      if (black.value - white.value >= -EPSILON) {
        fields.push(makeField(hueIndex, white, black, circle));
      }
    }
  }
  return fields;
}

/** Validate an explicit reference circle, including RGB/Oklab agreement. */
function validateCircle(circle) {
  if (!Array.isArray(circle) || circle.length !== 24) {
    throw new TypeError('context.hueCircle must contain 24 ordered hue references');
  }
  for (let i = 0; i < 24; i++) {
    const hue = circle[i];
    if (!hue || hue.index !== i + 1) throw new Error('context.hueCircle indices must be ordered 1..24');
    vector(hue.lab, 'Hue lab');
    validateRgb(hue.rgb, oklabToRgb(hue.lab));
  }
}

/** Require exact integer display colors consistent with the declared Oklab. */
function validateRgb(rgb, expected) {
  vector(rgb, 'rgb');
  if (!rgb.every((c, i) => Number.isInteger(c) && c >= 0 && c <= 255 && c === expected[i])) {
    throw new Error('rgb must contain integer sRGB bytes matching lab');
  }
}

/** Validate the label, geometry and colors, returning a fresh canonical field. */
function validateField(field, circle) {
  if (!field || typeof field !== 'object') throw new TypeError('field must be a complete field object');
  validateHue(field.hueIndex);
  const match = typeof field.label === 'string' && /^([1-9]|1[0-9]|2[0-4])([acegilnp])([acegilnp])$/.exec(field.label);
  if (!match || Number(match[1]) !== field.hueIndex) throw new Error('Unknown field label or mismatched hueIndex');
  const white = SCALE.find(item => item.letter === match[2]);
  const black = SCALE.find(item => item.letter === match[3]);
  if (white.value > black.value) throw new Error('Unknown field: letter pair is outside the triangle');
  coordinates(field.w, field.s);
  const expected = makeField(field.hueIndex, white, black, circle);
  for (const key of ['w', 's', 'v']) {
    if (!Number.isFinite(field[key]) || Math.abs(field[key] - expected[key]) > EPSILON) {
      throw new Error(`field.${key} does not match its discrete letter coordinates`);
    }
  }
  vector(field.lab, 'Field lab');
  if (!field.lab.every((c, i) => Math.abs(c - expected.lab[i]) <= EPSILON)) {
    throw new Error('Field lab does not match the context hue and Oklab mixture');
  }
  validateRgb(field.rgb, expected.rgb);
  return expected;
}

/** Framework-independent contemporary realization of Ostwald's relational structure. */
class OstwaldColor {
  /**
   * Build a contemporary Oklab hue circle, not historical Ostwald pigment/disc colors.
   * Constant L=0.72, C=0.10, angles 115 - i*360/n degrees; fresh arrays each call.
   * @param {number} [n=24] Positive safe integer; only n=24 is used for field APIs.
   * @returns {Array<{index:number, rgb:number[], lab:number[], group:string, calibrated:boolean}>}
   * @throws {RangeError} If n is not a positive safe integer / valid JS array length.
   */
  static hueCircle(n = 24) {
    if (!Number.isSafeInteger(n) || n < 1 || n > 0xffffffff) {
      throw new RangeError('n must be a positive integer within the JavaScript array length limit');
    }
    return buildHueReferences(n);
  }

  /**
   * Return independent copies of the eight non-linear letter levels in a..p order.
   * The second letter encodes black as 1 - value.
   * @returns {Array<{letter:string, value:number}>} a,c,e,g,i,l,n,p and their values.
   */
  static letterScale() {
    return SCALE.map(item => ({ ...item }));
  }

  /**
   * Generate the 36 valid fields, including eight v=0 neutral boundary fields.
   * Order: white letter a,c,e,g,i,l,n,p outer; black letter same order inner.
   * @param {number} hueIndex One-based integer in 1..24.
   * @param {number} [steps=8] Exactly 8; other resolutions are not defined.
   * @returns {Array<{hueIndex:number,w:number,s:number,v:number,label:string,rgb:number[],lab:number[]}>}
   * @throws {RangeError} For invalid hueIndex or steps other than 8.
   */
  static triangle(hueIndex, steps = 8) {
    validateHue(hueIndex);
    if (steps !== 8) throw new RangeError('steps must be 8: only the eight discrete letter levels are defined');
    return buildTriangle(hueIndex, this.hueCircle());
  }

  /**
   * Mix v*V + w*[1,0,0] + s*[0,0,0] componentwise exclusively in Oklab.
   * Clip only linear sRGB output before gamma encoding and integer rounding.
   * @param {number[]} fullColorLab Finite Oklab [L,a,b]; out-of-gamut values allowed.
   * @param {number} w White share >=0, with w+s<=1 (roundoff tolerance 1e-10).
   * @param {number} s Black share >=0, with w+s<=1 (roundoff tolerance 1e-10).
   * @returns {{w:number,s:number,v:number,lab:number[],rgb:number[]}} Unclipped Oklab and display RGB.
   * @throws {TypeError|RangeError} For malformed Lab, nonfinite shares, invalid geometry or overflow.
   */
  static mix(fullColorLab, w, s) {
    vector(fullColorLab, 'fullColorLab (Oklab)');
    // Validate convertibility even for an endpoint with zero full-color contribution.
    oklabToRgb(fullColorLab);
    const shares = coordinates(w, s);
    const lab = fullColorLab.map((c, i) => shares.v * c + shares.w * WHITE[i] + shares.s * BLACK[i]);
    return { ...shares, lab, rgb: oklabToRgb(lab) };
  }

  /**
   * Find other discrete fields at constant w, s or v, plus 24-part hue chords.
   * Regular circle relationships are translated into a contemporary programmatic
   * form; this API is not claimed to be a historical formulation by Ostwald.
   * @param {object} field Complete field object from the specified data basis.
   * @param {object} [context={}] Explicit data basis; omitted members use defaults.
   * @param {object[]} [context.hueCircle] Exactly 24 ordered references with index/rgb/lab.
   * @param {object[]} [context.triangle] Nonempty subset of same-hue discrete fields,
   * including field; must agree with hueCircle. Input order determines series order.
   * @returns {{isotints:object[],isotones:object[],shadowSeries:object[],hueHarmonies:object[]}}
   * Series exclude the selected field. Hue objects have type and complete fields,
   * excluding the selected hue: complementary [+12], triad [+8,+16], tetrad [+6,+12,+18].
   * @throws {TypeError|RangeError|Error} For invalid data, unknown fields, duplicates,
   * inconsistent colors/coordinates, wrong-hue triangles or unknown context keys.
   */
  static harmonies(field, context = {}) {
    if (!context || typeof context !== 'object' || Array.isArray(context) ||
        Object.keys(context).some(key => !['hueCircle', 'triangle'].includes(key))) {
      throw new TypeError('context must be an object with only hueCircle and/or triangle');
    }
    const circle = context.hueCircle === undefined ? this.hueCircle() : context.hueCircle;
    validateCircle(circle);
    const selected = validateField(field, circle);
    const source = context.triangle === undefined ? buildTriangle(selected.hueIndex, circle) : context.triangle;
    if (!Array.isArray(source) || source.length === 0) throw new TypeError('context.triangle must be a nonempty array');
    const labels = new Set();
    const fields = [];
    for (const candidate of source) {
      const valid = validateField(candidate, circle);
      if (valid.hueIndex !== selected.hueIndex) throw new Error('context.triangle must contain only the selected hue');
      if (labels.has(valid.label)) throw new Error('context.triangle contains duplicate fields');
      labels.add(valid.label);
      fields.push(valid);
    }
    if (!labels.has(selected.label)) throw new Error('Unknown field: not present in context.triangle');
    const series = key => fields
      .filter(item => item.label !== selected.label && Math.abs(item[key] - selected[key]) <= EPSILON)
      .map(item => ({ ...item, rgb: item.rgb.slice(), lab: item.lab.slice() }));
    const white = SCALE.find(item => item.letter === selected.label.slice(-2, -1));
    const black = SCALE.find(item => item.letter === selected.label.slice(-1));
    const chords = [['complementary', [12]], ['triad', [8, 16]], ['tetrad', [6, 12, 18]]];
    return {
      isotints: series('w'), isotones: series('s'), shadowSeries: series('v'),
      hueHarmonies: chords.map(([type, offsets]) => ({
        type,
        fields: offsets.map(offset => makeField((selected.hueIndex - 1 + offset) % 24 + 1, white, black, circle))
      }))
    };
  }
}

module.exports = OstwaldColor;
