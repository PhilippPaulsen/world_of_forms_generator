/**
 * core/color.js
 * Roadmap Group D, step 1 (Ostwald color-harmony system): the color engine -
 * color-space conversion, Ostwald's v/w/s (full color / white / black)
 * model over a 24-hue reference circle, and an extensible registry of
 * named harmony rules. Part of the portable "core" module set (see
 * CLAUDE.md): PURE - no p5, no DOM, no live-app globals - so it is
 * testable headlessly (tools/color/test-color.js) and safe to copy verbatim
 * into other sites embedding this engine. Nothing in the app loads or
 * calls this file yet (Phase 1 of the plan: engine only; applying colors to
 * detected faces, core/faces.js, and any UI are later phases).
 *
 * ---- Design decisions (from the Group D design session, verified by
 *      measurement, not assumed) ----
 *
 *  - v/w/s -> display color is mixed in LINEAR LIGHT (physical/additive
 *    mixture), not in Oklab/Lab. Ostwald's system is DEFINED by rotating-
 *    disc (additive) mixtures of a full color with white and black, so
 *    linear-light mixing is the faithful implementation; measured against
 *    Oklab mixing it differs by Oklab dE 0.08-0.31 (just-noticeable is
 *    ~0.02) - i.e. Oklab mixing would be a different color system, not a
 *    better rendering of this one. Oklab/Oklch is used here ONLY to
 *    construct the reference hue circle (evenly spaced hues at a common
 *    lightness/chroma) and for hue interpolation between anchors.
 *  - Cost is not a concern: ~0.1 microseconds per color (linear-light mix +
 *    sRGB encode) on the measured machine; a pattern has tens of faces and
 *    a handful of face orbits.
 *
 * ---- VERIFICATION STATUS (read before trusting any constant here) ----
 * Each Ostwald-derived datum below carries a `verified` marker:
 *   verified: false        - NOT confirmed against any source consulted so
 *                            far; carried over from the earlier exploration
 *                            or from memory. DO NOT treat as fact. Check the
 *                            primary text (Ostwald's Farbenlehre/Farbenfibel)
 *                            before relying on it, as was done for 1.4's
 *                            Fig. 4.
 *   verified: 'secondary'  - supported by a secondary source consulted in
 *                            the design session (Wikipedia's "Ostwald color
 *                            system", Wilhelm-Ostwald-Park/-Gesellschaft
 *                            pages, a private German write-up), NOT yet by
 *                            Ostwald's own text.
 * Nothing in this file is verified against a primary source ('primary').
 * Specifically:
 *   - 24 hues in 8 groups of 3, opposite hues complementary (hue 1 <->
 *     hue 13) ........................................ 'secondary'
 *   - colors formed by disc (additive) mixture ....... 'secondary'
 *   - "Weissgleich"/"Schwarzgleich" rows = lines of constant white /
 *     constant black in the triangle ................. 'secondary'
 *   - 4-chords: hues 25 apart on the 100-part circle (one worked example
 *     found, hues 08/33/58/83) = 6 apart on 24 ........ 'secondary' (one
 *     example only)
 *   - the 8 gray letters a c e g i l n p exist ........ 'secondary'
 *   - the PERCENTAGE VALUES of the letter steps ......... false
 *   - reading of a two-letter code (which letter = white, which = black,
 *     and black = 1 - value of the second letter) ...... false
 *   - the definition of the "Schattenreihe" (shadow series) as the line
 *     from the full color toward a gray on the white-black edge
 *     (constant w:s ratio); the TERM is confirmed as existing, its
 *     definition is not ........................................ false
 *   - that these series/chords are what Ostwald calls harmonious (he does;
 *     the exact rules are not confirmed here) ......... false
 * The reference hue circle itself is an APPROXIMATION (evenly spaced Oklch
 * hues at one L/C) - Ostwald's circle is defined psychophysically by
 * complementarity, see the test for how well this approximation meets it -
 * and is marked calibrated: false. A later calibration pass replaces the
 * `hues` table (per-hue linear/srgb anchors, or a full lookup) without any
 * consumer changing: consumers only call resolveColor()/generateHarmonyPalette().
 */

// ----------------- COLOR-SPACE CONVERSION -------------------------------
// "linear" = linear-light sRGB, [r,g,b], nominal range 0..1 (values outside
// the range mean out of sRGB gamut). "srgb8" = gamma-encoded 0..255 integers.

// sRGB EOTF (IEC 61966-2-1): one gamma-encoded channel 0..255 -> linear 0..1.
function srgbToLinear(c255) {
    const c = c255 / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Inverse: one linear channel -> gamma-encoded integer 0..255, clamped to
// gamut (out-of-range input clips, it never wraps).
function linearToSrgb8(x) {
    const clamped = Math.min(1, Math.max(0, x));
    const v = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(v * 255);
}

// Oklab (Bjorn Ottosson, 2020; public domain reference implementation):
// linear sRGB <-> Oklab [L, a, b]. Used for hue-circle construction and
// interpolation only (see the header on why NOT for v/w/s mixing).
function linearToOklab(rgb) {
    const r = rgb[0], g = rgb[1], b = rgb[2];
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
}

function oklabToLinear(lab) {
    const L = lab[0], a = lab[1], b = lab[2];
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
}

// Oklch (L, chroma, hue in DEGREES) <-> linear sRGB.
function oklchToLinear(L, C, hDeg) {
    const h = hDeg * Math.PI / 180;
    return oklabToLinear([L, C * Math.cos(h), C * Math.sin(h)]);
}
function linearToOklch(rgb) {
    const lab = linearToOklab(rgb);
    const C = Math.hypot(lab[1], lab[2]);
    const hDeg = ((Math.atan2(lab[2], lab[1]) * 180 / Math.PI) % 360 + 360) % 360;
    return [lab[0], C, hDeg];
}

// "#rrggbb" (lowercase) from linear sRGB, clipped to gamut.
function linearToHex(rgb) {
    return '#' + rgb.map(x => linearToSrgb8(x).toString(16).padStart(2, '0')).join('');
}
function hexToLinear(hex) {
    const m = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
    if (!m) throw new Error(`hexToLinear: not a #rrggbb color: "${hex}"`);
    return [1, 2, 3].map(i => srgbToLinear(parseInt(m[i], 16)));
}

// The colors the app puts on faces are CSS strings: '#rrggbb' (an assigned color,
// resolveColor().hex) or 'hsl(h, s%, l%)' (core/faces.js orbitColor()'s default).
// -> linear sRGB. An hsl() color is first quantized to 8-bit sRGB, the way the canvas
// does when it fills with it, so the linear value is that of the DISPLAYED color.
function cssColorToLinear(str) {
    if (/^#[0-9a-fA-F]{6}$/.test(str)) return hexToLinear(str);
    const m = /^hsl\(\s*(-?[\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i.exec(str);
    if (!m) throw new Error(`cssColorToLinear: unsupported color "${str}"`);
    const h = (((+m[1]) % 360) + 360) % 360 / 360, s = +m[2] / 100, l = +m[3] / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => srgbToLinear(Math.round(v * 255)));
}

// True if every linear channel lies within 0..1 (+- eps for float noise).
function linearInGamut(rgb, eps = 1e-4) {
    return rgb.every(x => x >= -eps && x <= 1 + eps);
}

function _colorLerp(a, b, t) {
    return a.map((v, i) => v + (b[i] - v) * t);
}

// ----------------- REFERENCE COLOR SYSTEM (data) ------------------------

// Ostwald's 24 hues = 8 named groups x 3. Names are the ENGLISH glosses
// found in the secondary source consulted (three yellows, three oranges,
// three reds, three violets, three ultramarine blues, three ice blues,
// three sea greens, three foliage greens) - the German group names were
// deliberately not added from memory. verified: 'secondary'.
const OSTWALD_HUE_GROUPS = ['Yellow', 'Orange', 'Red', 'Violet', 'Ultramarine blue', 'Ice blue', 'Sea green', 'Leaf green'];

// The 8 gray steps of the physically realizable gray scale (letters a..p,
// every second step of a finer 15/16-step scale). That these 8 letters
// exist is 'secondary'.
const OSTWALD_GRAY_LETTERS = ['a', 'c', 'e', 'g', 'i', 'l', 'n', 'p'];

// White content (reflectance, 0..1) of each gray letter, a = lightest.
// verified: false -- these percentages (89 56 35 22 14 8.9 5.6 3.5) come
// from the earlier exploration/memory, NOT from any source checked in the
// design session (the pages consulted state that the steps are
// logarithmic but give no numbers). They are constants of a log series
// (ratio ~0.63 per step) and are used only to define discrete "levels"
// for the harmony rules; replace/confirm before treating as Ostwald's.
const OSTWALD_GRAY_WHITE_CONTENT_UNVERIFIED = [0.89, 0.56, 0.35, 0.22, 0.14, 0.089, 0.056, 0.035];

// Builds the 24-hue reference ring: hue anchors at evenly spaced Oklch
// hues, all at one lightness and chroma. The hue NUMBER (1..24, Ostwald's
// numbering) increases in the direction yellow -> orange -> red -> violet
// -> blue -> green, which is DEcreasing Oklch hue angle. `angle2` is the
// Oklch angle of hue 2 (the center of the yellow group). Reference values,
// not calibrated: calibrated: false (see header).
function buildOklchReferenceRing(L, C, angle2) {
    const hues = [];
    for (let i = 1; i <= 24; i++) {
        const angle = (((angle2 - 15 * (i - 2)) % 360) + 360) % 360;
        const sub = ((i - 1) % 3) + 1;
        hues.push({
            index: i,
            name: `${OSTWALD_HUE_GROUPS[Math.floor((i - 1) / 3)]} ${sub}`,
            oklch: [L, C, angle]
        });
    }
    return hues;
}

// The reference system. Consumers never read this table directly - they go
// through resolveColor()/generateHarmonyPalette() - so a future calibrated
// atlas only has to supply anchors in one of the forms hueAnchorLinear()
// accepts (oklch | srgb | linear), or a different `hues` length.
//
//  hues            24 full-color (Vollfarbe) anchors. Hue POSITION is a
//                  0-based, fractional-capable ring coordinate (position
//                  p <-> Ostwald hue number p + 1); see resolveColor().
//  white / black   corner colors, linear sRGB. IDEAL (1,1,1)/(0,0,0) for the
//                  reference version; a calibrated system would set these
//                  to the practical white/black (letters a / p).
//  grayScale       letters + white contents (see the UNVERIFIED constant).
//  fullColorLevels the discrete (white letter, black letter) pairs the
//                  chord rule offers for a "clean full color", as letter
//                  pairs; w = white content of the first letter, s = 1 -
//                  white content of the second letter. verified: false
//                  (two-letter code reading unconfirmed; 'na' as a "clear
//                  full color" appears in a secondary source, the rest of
//                  the list is a plausible choice, not Ostwald's).
//  mix             how v/w/s are combined: 'linear-light' (see header).
const OSTWALD_REFERENCE_SYSTEM = {
    id: 'ostwald-reference-24',
    version: 1,
    calibrated: false,
    hues: buildOklchReferenceRing(0.72, 0.10, 100),
    white: [1, 1, 1],
    black: [0, 0, 0],
    grayScale: {
        verified: false,
        letters: OSTWALD_GRAY_LETTERS,
        white: OSTWALD_GRAY_WHITE_CONTENT_UNVERIFIED
    },
    fullColorLevels: {
        verified: false,
        pairs: [['p', 'a'], ['n', 'a'], ['l', 'a'], ['i', 'a']]
    },
    mix: 'linear-light'
};

// ----------------- resolveColor() --------------------------------------

// Linear-sRGB of one hue anchor, whichever form it is stored in - the seam
// that keeps the data model open to calibration (oklch for the reference
// ring; srgb8 or linear for measured atlas values).
function hueAnchorLinear(anchor) {
    if (anchor.linear) return anchor.linear.slice();
    if (anchor.srgb) return anchor.srgb.map(srgbToLinear);
    if (anchor.oklch) return oklchToLinear(anchor.oklch[0], anchor.oklch[1], anchor.oklch[2]);
    throw new Error('hueAnchorLinear: anchor has none of linear/srgb/oklch');
}

// Full color (Vollfarbe) at a hue position, linear sRGB. `hue` is a ring
// position: 0-based, any real number, taken modulo the ring size (so
// negative and >= n work); integer positions return the anchor exactly,
// fractional ones interpolate between neighbors in Oklab.
function hueFullColorLinear(system, hue) {
    const n = system.hues.length;
    const pos = ((hue % n) + n) % n;
    const i0 = Math.floor(pos);
    const t = pos - i0;
    const a = hueAnchorLinear(system.hues[i0]);
    if (t < 1e-9) return a;
    const b = hueAnchorLinear(system.hues[(i0 + 1) % n]);
    return oklabToLinear(_colorLerp(linearToOklab(a), linearToOklab(b), t));
}

// The one function consumers use: an Ostwald color specification
// {hue, w, s} (v = 1 - w - s implied) -> a displayable color.
//  hue  ring position (see hueFullColorLinear())
//  w,s  white and black content, each >= 0, w + s <= 1 (a tiny float
//       tolerance is accepted and clamped; anything else throws - the
//       triangle has no meaning outside itself)
// Mixing is in linear light (header). Returns
//  { hue, w, s, v, linear:[r,g,b], srgb8:[r,g,b], hex:'#rrggbb',
//    fullColorInGamut }  -- fullColorInGamut is about the hue's anchor: the
//  mixture of an in-gamut full color with the (in-gamut) corners is itself
//  always in gamut.
function resolveColor(system, spec) {
    const EPS = 1e-9;
    let w = spec.w, s = spec.s;
    if (!Number.isFinite(spec.hue) || !Number.isFinite(w) || !Number.isFinite(s)) {
        throw new Error('resolveColor: hue, w and s must be finite numbers');
    }
    if (w < -EPS || s < -EPS || w + s > 1 + EPS) {
        throw new Error(`resolveColor: (w=${w}, s=${s}) is outside the triangle (need w>=0, s>=0, w+s<=1)`);
    }
    w = Math.max(0, w); s = Math.max(0, s);
    const v = Math.max(0, 1 - w - s);
    const V = hueFullColorLinear(system, spec.hue);
    const linear = [0, 1, 2].map(i => v * V[i] + w * system.white[i] + s * system.black[i]);
    return {
        hue: spec.hue, w, s, v,
        linear,
        srgb8: linear.map(linearToSrgb8),
        hex: linearToHex(linear),
        fullColorInGamut: linearInGamut(V)
    };
}

// ----------------- HARMONY-RULE REGISTRY --------------------------------
// A harmony rule is a plain object:
//   { id, label, verified, note?,
//     params:   [{ id, label, count }]            // discrete axes
//     generate: (idx, system, slots) => [{hue,w,s}, ...] }
//  - `count` is a positive integer, or a function (system) => integer, so a
//    rule can follow the system's own size (e.g. hue axis = number of hues).
//  - each param axis is what one k/c stepper will step through later (one
//    stepper per axis, not one flat list of all combinations).
//  - generate() is a PURE, DETERMINISTIC function of (idx, system, slots)
//    and returns EXACTLY `slots` color specifications (the caller distributes
//    them over however many things it colors; a rule with fewer natural
//    colors than slots cycles).
// New rules are added by registerHarmonyRule() alone - no consumer changes.

const _harmonyRules = new Map();

function registerHarmonyRule(rule) {
    if (!rule || typeof rule.id !== 'string' || !rule.id) throw new Error('registerHarmonyRule: rule.id must be a non-empty string');
    if (_harmonyRules.has(rule.id)) throw new Error(`registerHarmonyRule: duplicate rule id "${rule.id}"`);
    if (typeof rule.label !== 'string') throw new Error(`registerHarmonyRule("${rule.id}"): label must be a string`);
    if (typeof rule.generate !== 'function') throw new Error(`registerHarmonyRule("${rule.id}"): generate must be a function`);
    if (!Array.isArray(rule.params) || rule.params.length === 0) throw new Error(`registerHarmonyRule("${rule.id}"): params must be a non-empty array`);
    rule.params.forEach(p => {
        if (typeof p.id !== 'string' || !(typeof p.count === 'function' || (Number.isInteger(p.count) && p.count >= 1))) {
            throw new Error(`registerHarmonyRule("${rule.id}"): each param needs a string id and count = positive integer or function`);
        }
    });
    _harmonyRules.set(rule.id, rule);
    return rule;
}

function getHarmonyRule(id) {
    return _harmonyRules.get(id) || null;
}

// Registered rules in registration order.
function listHarmonyRules() {
    return Array.from(_harmonyRules.values());
}

// The rule's param axes with `count` resolved against a system:
// [{id, label, count}].
function harmonyRuleParams(rule, system) {
    return rule.params.map(p => ({
        id: p.id, label: p.label,
        count: typeof p.count === 'function' ? p.count(system) : p.count
    }));
}

// Validated entry point: runs one rule for a chosen index per param axis
// and a slot count, checks the rule's output contract, and resolves every
// color. Returns [{hue,w,s,v,linear,srgb8,hex,fullColorInGamut}].
function generateHarmonyPalette(ruleId, idx, slots, system = OSTWALD_REFERENCE_SYSTEM) {
    const rule = getHarmonyRule(ruleId);
    if (!rule) throw new Error(`generateHarmonyPalette: unknown rule "${ruleId}"`);
    if (!Number.isInteger(slots) || slots < 1) throw new Error('generateHarmonyPalette: slots must be a positive integer');
    const params = harmonyRuleParams(rule, system);
    if (!Array.isArray(idx) || idx.length !== params.length) {
        throw new Error(`generateHarmonyPalette("${ruleId}"): idx needs ${params.length} entries (one per param axis)`);
    }
    idx.forEach((k, i) => {
        if (!Number.isInteger(k) || k < 0 || k >= params[i].count) {
            throw new Error(`generateHarmonyPalette("${ruleId}"): idx[${i}] (${params[i].id}) must be an integer in 0..${params[i].count - 1}, got ${k}`);
        }
    });
    const specs = rule.generate(idx, system, slots);
    if (!Array.isArray(specs) || specs.length !== slots) {
        throw new Error(`generateHarmonyPalette("${ruleId}"): rule returned ${Array.isArray(specs) ? specs.length : 'a non-array'}, expected exactly ${slots} colors`);
    }
    return specs.map(spec => resolveColor(system, spec));
}

// ----------------- BUILT-IN RULES ---------------------------------------

// Aesthetic floor (NOT from any source): series never run all the way into
// the white-black edge; at least this much full color stays in every
// generated color so its hue remains identifiable at the end of a series.
const HARMONY_MIN_FULL_COLOR = 0.02;

// Shadow-series extent along the line from the full color toward the gray
// (v = full-color share). Aesthetic, not from any source: from 85% down to
// 10% full color.
const HARMONY_SHADOW_V_TOP = 0.85;
const HARMONY_SHADOW_V_BOTTOM = 0.10;

// `n` values evenly spread over [lo, hi], inclusive at both ends; a single
// value sits at the midpoint.
function _evenSpread(lo, hi, n) {
    if (n === 1) return [(lo + hi) / 2];
    const out = [];
    for (let i = 0; i < n; i++) out.push(lo + (hi - lo) * i / (n - 1));
    return out;
}

const _hueAxis = { id: 'hue', label: 'Hue', count: system => system.hues.length };
const _levelAxis = { id: 'level', label: 'Level', count: system => system.grayScale.white.length };

// Isotints (Weissgleiche): constant WHITE content w (a line parallel to the
// black-full-color side of the triangle), black content s varying from 0
// up to the most the triangle allows (keeping HARMONY_MIN_FULL_COLOR of
// full color). Axes: hue x white level (gray letter -> w). Term:
// 'secondary'; the discrete levels come from the UNVERIFIED letter values.
registerHarmonyRule({
    id: 'isotint',
    label: 'Isotints (Weißgleiche)',
    verified: 'secondary',
    note: 'constant white content w; levels use the unverified gray-letter percentages',
    params: [_hueAxis, { ..._levelAxis, label: 'White level' }],
    generate(idx, system, slots) {
        const hue = idx[0];
        const w = system.grayScale.white[idx[1]];
        const sMax = 1 - w - HARMONY_MIN_FULL_COLOR;
        return _evenSpread(0, sMax, slots).map(s => ({ hue, w, s }));
    }
});

// Isotones (Schwarzgleiche): constant BLACK content s, white content w
// varying. Black content of level k is s = 1 - (white content of gray
// letter k) - the two-letter-code reading, verified: false (see header).
registerHarmonyRule({
    id: 'isotone',
    label: 'Isotones (Schwarzgleiche)',
    verified: false,
    note: 'constant black content s; s = 1 - gray-letter value is the UNVERIFIED two-letter-code reading',
    params: [_hueAxis, { ..._levelAxis, label: 'Black level' }],
    generate(idx, system, slots) {
        const hue = idx[0];
        const s = 1 - system.grayScale.white[idx[1]];
        const wMax = 1 - s - HARMONY_MIN_FULL_COLOR;
        return _evenSpread(0, wMax, slots).map(w => ({ hue, w, s }));
    }
});

// Shadow series (Schattenreihe): constant RATIO w : s - the line from the
// full color toward one gray on the white-black edge; every color on it is
// the full color plus the same gray, in growing amount. The gray g is the
// white share of that gray (w = (1 - v)*g, s = (1 - v)*(1 - g)), taken from
// the gray-letter white contents. verified: false - the TERM is confirmed as
// existing, THIS definition of it is not (see header).
registerHarmonyRule({
    id: 'shadow-series',
    label: 'Shadow series (Schattenreihe)',
    verified: false,
    note: 'constant w:s ratio (line from the full color to the white-black edge); definition unconfirmed',
    params: [_hueAxis, { ..._levelAxis, label: 'Gray (w : s ratio)' }],
    generate(idx, system, slots) {
        const hue = idx[0];
        const g = system.grayScale.white[idx[1]];
        // v from TOP down to BOTTOM as the series darkens.
        return _evenSpread(HARMONY_SHADOW_V_TOP, HARMONY_SHADOW_V_BOTTOM, slots).map(v => ({
            hue, w: (1 - v) * g, s: (1 - v) * (1 - g)
        }));
    }
});

// Chord of hues at one fixed (w, s): base hue plus (ring size / count) *
// k for k = 0..count-1, i.e. tetrad = 6 apart on 24, triad = 8, complement
// = 12. Axes: base hue x full-color level (a letter pair -> (w, s)). Slots
// beyond the chord size cycle through the chord's colors. The 6-of-24
// spacing for four-chords has ONE worked secondary-source example
// (hues 08/33/58/83 on a 100-part circle = 25 apart); the level list is
// unverified (see OSTWALD_REFERENCE_SYSTEM.fullColorLevels).
function _hueChordRule(id, label, count, verified, note) {
    return {
        id, label, verified, note,
        params: [
            _hueAxis,
            { id: 'level', label: 'Full-color level', count: system => system.fullColorLevels.pairs.length }
        ],
        generate(idx, system, slots) {
            const base = idx[0];
            const [wLetter, sLetter] = system.fullColorLevels.pairs[idx[1]];
            const white = system.grayScale.white;
            const letters = system.grayScale.letters;
            const w = white[letters.indexOf(wLetter)];
            const s = 1 - white[letters.indexOf(sLetter)];
            const step = system.hues.length / count;
            const out = [];
            for (let j = 0; j < slots; j++) out.push({ hue: base + step * (j % count), w, s });
            return out;
        }
    };
}
registerHarmonyRule(_hueChordRule('tetrad', 'Tetrad (Vierklang)', 4, 'secondary', '4-chord = 6 apart on 24 hues (one worked secondary-source example); level list unverified'));
