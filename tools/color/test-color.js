/**
 * tools/color/test-color.js
 * Headless tests for core/color.js (Roadmap Group D, step 1). Plain Node,
 * no dependencies: `node tools/color/test-color.js` - prints every check,
 * a summary of the measured values, and exits non-zero on any failure.
 *
 * core/color.js is loaded into a BARE vm context (no window/document/p5,
 * no console) - if it referenced any live-app global at load or call time
 * these tests would throw, which is itself the purity check.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'core', 'color.js'), 'utf8'), ctx, { filename: 'core/color.js' });
// Top-level const/let are not properties of the context's global object;
// collect everything under test through one evaluated expression.
const C = vm.runInContext(`({
  srgbToLinear, linearToSrgb8, linearToOklab, oklabToLinear, oklchToLinear, linearToOklch,
  linearToHex, hexToLinear, linearInGamut, hueFullColorLinear, hueAnchorLinear,
  resolveColor, registerHarmonyRule, getHarmonyRule, listHarmonyRules, harmonyRuleParams,
  generateHarmonyPalette, buildOklchReferenceRing,
  OSTWALD_REFERENCE_SYSTEM, OSTWALD_GRAY_LETTERS, HARMONY_MIN_FULL_COLOR,
  HARMONY_SHADOW_V_TOP, HARMONY_SHADOW_V_BOTTOM
})`, ctx);

let failures = 0, checks = 0;
const measured = {};
function check(name, ok, detail) {
    checks++;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`);
}
function throws(fn) { try { fn(); return false; } catch (e) { return true; } }
const maxAbs = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const chroma = lin => { const o = C.linearToOklab(lin); return Math.hypot(o[1], o[2]); };
const mix = (cs, ws) => [0, 1, 2].map(i => cs.reduce((s, c, k) => s + c[i] * ws[k], 0));

const SYS = C.OSTWALD_REFERENCE_SYSTEM;
const N = SYS.hues.length;

// ---------------- 1. round-trip accuracy --------------------------------
console.log('\n== 1. round-trip accuracy ==');
{
    let bad = 0;
    for (let c = 0; c <= 255; c++) if (C.linearToSrgb8(C.srgbToLinear(c)) !== c) bad++;
    check('sRGB8 -> linear -> sRGB8 exact for all 256 values', bad === 0, `${bad} mismatches`);

    let worstLab = 0, worstLch = 0;
    for (let r = 0; r <= 1.0001; r += 0.05) for (let g = 0; g <= 1.0001; g += 0.05) for (let b = 0; b <= 1.0001; b += 0.05) {
        const lin = [r, g, b];
        worstLab = Math.max(worstLab, maxAbs(lin, C.oklabToLinear(C.linearToOklab(lin))));
        const lch = C.linearToOklch(lin);
        if (lch[1] > 1e-3) worstLch = Math.max(worstLch, maxAbs(lin, C.oklchToLinear(lch[0], lch[1], lch[2])));
    }
    measured.oklabRoundTrip = worstLab; measured.oklchRoundTrip = worstLch;
    check('linear -> Oklab -> linear over a 21^3 grid', worstLab < 1e-5, `max abs error ${worstLab.toExponential(2)}`);
    check('linear -> Oklch -> linear over the same grid', worstLch < 1e-5, `max abs error ${worstLch.toExponential(2)}`);

    let hexBad = 0;
    for (let r = 0; r < 256; r += 5) for (let g = 0; g < 256; g += 5) for (let b = 0; b < 256; b += 5) {
        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        if (C.linearToHex(C.hexToLinear(hex)) !== hex) hexBad++;
    }
    check('hex -> linear -> hex exact over a 52^3 grid', hexBad === 0, `${hexBad} mismatches`);
    check('hexToLinear rejects a malformed color', throws(() => C.hexToLinear('#12345')));
}

// ---------------- 2. reference hue ring ---------------------------------
console.log('\n== 2. reference 24-hue ring (Oklch, C=0.10) ==');
{
    check('24 anchors, numbered 1..24', N === 24 && SYS.hues.every((h, i) => h.index === i + 1));
    check('every anchor uses L=0.72, C=0.10', SYS.hues.every(h => h.oklch[0] === 0.72 && h.oklch[1] === 0.10));
    check('hue angle steps are exactly 15 degrees (decreasing: yellow -> orange -> red -> ...)',
        SYS.hues.every((h, i) => { const next = SYS.hues[(i + 1) % N]; return Math.abs((((h.oklch[2] - next.oklch[2]) % 360) + 360) % 360 - 15) < 1e-9; }));
    check('8 groups of 3 named by the source glosses', SYS.hues[0].name === 'Yellow 1' && SYS.hues[4].name === 'Orange 2' && SYS.hues[23].name === 'Leaf green 3');

    const inGamut = SYS.hues.filter(h => C.linearInGamut(C.hueAnchorLinear(h))).length;
    measured.ringInGamut = inGamut;
    check('all 24 full colors inside sRGB gamut', inGamut === 24, `${inGamut}/24`);

    // Complementarity: opposite hues (i, i+12) mixed 50/50 in linear light
    // (a disc mixture) should be nearly neutral. Threshold 0.03 in Oklab
    // chroma (just-noticeable is ~0.02; the ring's own chroma is 0.10).
    const residual = [];
    for (let i = 0; i < 12; i++) residual.push(chroma(mix([C.hueAnchorLinear(SYS.hues[i]), C.hueAnchorLinear(SYS.hues[i + 12])], [0.5, 0.5])));
    measured.complementResidualMax = Math.max(...residual);
    measured.complementResidualMean = residual.reduce((a, b) => a + b, 0) / 12;
    check('opposite hues mix to near-neutral (residual chroma <= 0.03 for all 12 pairs)', Math.max(...residual) <= 0.03,
        `max ${measured.complementResidualMax.toFixed(4)}, mean ${measured.complementResidualMean.toFixed(4)}`);
    // Non-vacuity: NON-opposite neighbors must NOT mix to neutral.
    const neighbor = chroma(mix([C.hueAnchorLinear(SYS.hues[0]), C.hueAnchorLinear(SYS.hues[6])], [0.5, 0.5]));
    check('control: hues 6 apart do NOT mix to neutral (residual chroma > 0.03)', neighbor > 0.03, neighbor.toFixed(4));
}

// ---------------- 3. resolveColor ---------------------------------------
console.log('\n== 3. resolveColor ==');
{
    const white = C.resolveColor(SYS, { hue: 3, w: 1, s: 0 }), black = C.resolveColor(SYS, { hue: 3, w: 0, s: 1 });
    check('w=1 gives white, any hue', white.hex === '#ffffff');
    check('s=1 gives black, any hue', black.hex === '#000000');
    const full = C.resolveColor(SYS, { hue: 7, w: 0, s: 0 });
    check('w=s=0 gives exactly the hue anchor', full.hex === C.linearToHex(C.hueAnchorLinear(SYS.hues[7])) && full.v === 1);
    const gray = C.resolveColor(SYS, { hue: 0, w: 0.5, s: 0.5 });
    check('50/50 white/black mixes in LINEAR light (0.5 linear = #bcbcbc, not #808080)', gray.hex === '#bcbcbc', gray.hex);
    check('v = 1 - w - s', Math.abs(C.resolveColor(SYS, { hue: 2, w: 0.2, s: 0.3 }).v - 0.5) < 1e-12);
    check('rejects w+s > 1', throws(() => C.resolveColor(SYS, { hue: 0, w: 0.6, s: 0.6 })));
    check('rejects negative w or s', throws(() => C.resolveColor(SYS, { hue: 0, w: -0.1, s: 0.2 })) && throws(() => C.resolveColor(SYS, { hue: 0, w: 0.2, s: -0.1 })));
    check('rejects non-finite input', throws(() => C.resolveColor(SYS, { hue: NaN, w: 0, s: 0 })) && throws(() => C.resolveColor(SYS, { hue: 0, w: Infinity, s: 0 })));
    check('hue is a ring position: 24 == 0 and -1 == 23',
        C.resolveColor(SYS, { hue: 24, w: 0.1, s: 0.1 }).hex === C.resolveColor(SYS, { hue: 0, w: 0.1, s: 0.1 }).hex &&
        C.resolveColor(SYS, { hue: -1, w: 0.1, s: 0.1 }).hex === C.resolveColor(SYS, { hue: 23, w: 0.1, s: 0.1 }).hex);
    const a = C.linearToOklab(C.hueFullColorLinear(SYS, 4)), b = C.linearToOklab(C.hueFullColorLinear(SYS, 5)), m = C.linearToOklab(C.hueFullColorLinear(SYS, 4.5));
    check('fractional hue interpolates between neighbors in Oklab (midpoint = mean)', maxAbs(m, a.map((v, i) => (v + b[i]) / 2)) < 1e-5);  // tolerance = Oklab matrix round-trip accuracy (~3e-7), not exact inverses
    check('fractional hue at an integer returns the anchor exactly', maxAbs(C.hueFullColorLinear(SYS, 9), C.hueAnchorLinear(SYS.hues[9])) === 0);

    // Gamut over the WHOLE triangle x all hues: convex combinations of
    // in-gamut corners must never leave the gamut (no clipping anywhere).
    let outside = 0, count = 0;
    for (let h = 0; h < N; h++) for (let w = 0; w <= 1.0001; w += 0.05) for (let s = 0; w + s <= 1.0001; s += 0.05) {
        const c = C.resolveColor(SYS, { hue: h, w: Math.min(w, 1), s: Math.min(s, 1 - Math.min(w, 1)) });
        count++;
        if (!C.linearInGamut(c.linear, 1e-9) || c.srgb8.some(x => x < 0 || x > 255)) outside++;
    }
    check('every triangle point of every hue resolves inside sRGB gamut', outside === 0, `${outside} outside of ${count}`);
    measured.gamutPointsChecked = count;

    // Speed (informational; generous bound so it is not flaky).
    const t0 = process.hrtime.bigint();
    let sink = 0;
    for (let i = 0; i < 100000; i++) sink += C.resolveColor(SYS, { hue: i % 24, w: 0.2, s: 0.3 }).srgb8[0];
    const usPerCall = Number(process.hrtime.bigint() - t0) / 1e3 / 100000;
    measured.resolveColorMicroseconds = usPerCall;
    check('resolveColor() cost is negligible (< 20 microseconds per call)', usPerCall < 20 && sink > 0, `${usPerCall.toFixed(2)} us`);
}

// ---------------- 4. registry ------------------------------------------
console.log('\n== 4. harmony-rule registry ==');
{
    const ids = C.listHarmonyRules().map(r => r.id);
    check('four built-in rules registered, in order', JSON.stringify(ids) === JSON.stringify(['isotint', 'isotone', 'shadow-series', 'tetrad']), ids.join(','));
    check('rules expose param axes with resolved counts (hue = 24, level = 8; tetrad level = 4)',
        JSON.stringify(C.harmonyRuleParams(C.getHarmonyRule('isotint'), SYS).map(p => p.count)) === '[24,8]' &&
        JSON.stringify(C.harmonyRuleParams(C.getHarmonyRule('tetrad'), SYS).map(p => p.count)) === '[24,4]');
    check('duplicate rule id is refused', throws(() => C.registerHarmonyRule({ id: 'isotint', label: 'x', params: [{ id: 'a', count: 1 }], generate: () => [] })));
    check('malformed rules are refused',
        throws(() => C.registerHarmonyRule({ id: 'bad1', label: 'x', params: [], generate: () => [] })) &&
        throws(() => C.registerHarmonyRule({ id: 'bad2', label: 'x', params: [{ id: 'a', count: 0 }], generate: () => [] })) &&
        throws(() => C.registerHarmonyRule({ id: 'bad3', label: 'x', params: [{ id: 'a', count: 2 }] })) &&
        throws(() => C.registerHarmonyRule({ label: 'x', params: [{ id: 'a', count: 2 }], generate: () => [] })));
    check('generateHarmonyPalette rejects unknown rule / bad slots / bad idx',
        throws(() => C.generateHarmonyPalette('nope', [0, 0], 3)) &&
        throws(() => C.generateHarmonyPalette('isotint', [0, 0], 0)) &&
        throws(() => C.generateHarmonyPalette('isotint', [0], 3)) &&
        throws(() => C.generateHarmonyPalette('isotint', [24, 0], 3)) &&
        throws(() => C.generateHarmonyPalette('isotint', [0, 8], 3)) &&
        throws(() => C.generateHarmonyPalette('isotint', [0.5, 0], 3)));
    // Extensibility: a NEW rule is one registerHarmonyRule() call - the
    // validated entry point picks it up with no other change.
    C.registerHarmonyRule({ id: 'test-complement', label: 'test', verified: false, params: [{ id: 'hue', label: 'Hue', count: s => s.hues.length }],
        generate: (idx, sys, slots) => Array.from({ length: slots }, (_, j) => ({ hue: idx[0] + 12 * (j % 2), w: 0.1, s: 0.1 })) });
    const pal = C.generateHarmonyPalette('test-complement', [3], 3);
    check('a newly registered rule works through generateHarmonyPalette() unchanged', pal.length === 3 && pal[0].hue === 3 && pal[1].hue === 15 && pal[2].hue === 3);
    C.registerHarmonyRule({ id: 'test-wrong-count', label: 'test', verified: false, params: [{ id: 'a', count: 1 }], generate: () => [{ hue: 0, w: 0, s: 0 }] });
    check('output contract enforced: a rule returning != slots colors is caught', throws(() => C.generateHarmonyPalette('test-wrong-count', [0], 4)));
}

// ---------------- 5. per-rule properties --------------------------------
console.log('\n== 5. rule properties over every hue x level x slot count ==');
{
    const SLOTS = [1, 2, 3, 4, 5, 8, 12];
    const EPS = 1e-12;
    const stat = { isotint: 0, isotone: 0, shadow: 0, tetrad: 0 };
    let bad = { valid: 0, len: 0, isotintConstW: 0, isotintMono: 0, isotoneConstS: 0, isotoneMono: 0, shadowRatio: 0, shadowMono: 0, shadowV: 0, minV: 0, tetHues: 0, tetConst: 0, tetCycle: 0, tetLevels: 0 };
    const white = SYS.grayScale.white;

    for (const slots of SLOTS) for (let h = 0; h < N; h++) {
        // isotints
        for (let k = 0; k < 8; k++) {
            const p = C.generateHarmonyPalette('isotint', [h, k], slots); stat.isotint++;
            if (p.length !== slots) bad.len++;
            if (!p.every(c => c.w >= 0 && c.s >= 0 && c.w + c.s <= 1 + EPS && c.hue === h)) bad.valid++;
            if (!p.every(c => c.w === white[k])) bad.isotintConstW++;
            if (slots > 1 && !p.every((c, i) => i === 0 || c.s > p[i - 1].s)) bad.isotintMono++;
            if (!p.every(c => c.v >= C.HARMONY_MIN_FULL_COLOR - 1e-9)) bad.minV++;
        }
        // isotones
        for (let k = 0; k < 8; k++) {
            const p = C.generateHarmonyPalette('isotone', [h, k], slots); stat.isotone++;
            if (p.length !== slots) bad.len++;
            if (!p.every(c => c.w >= 0 && c.s >= 0 && c.w + c.s <= 1 + EPS && c.hue === h)) bad.valid++;
            if (!p.every(c => Math.abs(c.s - (1 - white[k])) < EPS)) bad.isotoneConstS++;
            if (slots > 1 && !p.every((c, i) => i === 0 || c.w > p[i - 1].w)) bad.isotoneMono++;
            if (!p.every(c => c.v >= C.HARMONY_MIN_FULL_COLOR - 1e-9)) bad.minV++;
        }
        // shadow series
        for (let k = 0; k < 8; k++) {
            const p = C.generateHarmonyPalette('shadow-series', [h, k], slots); stat.shadow++;
            if (p.length !== slots) bad.len++;
            if (!p.every(c => c.w >= 0 && c.s >= 0 && c.w + c.s <= 1 + EPS && c.hue === h)) bad.valid++;
            // constant ratio w : (w + s) = g for every color that is not pure full color
            if (!p.every(c => (c.w + c.s) < EPS || Math.abs(c.w / (c.w + c.s) - white[k]) < 1e-9)) bad.shadowRatio++;
            if (slots > 1 && !p.every((c, i) => i === 0 || c.v < p[i - 1].v)) bad.shadowMono++;
            if (!p.every(c => c.v <= C.HARMONY_SHADOW_V_TOP + 1e-9 && c.v >= C.HARMONY_SHADOW_V_BOTTOM - 1e-9)) bad.shadowV++;
        }
        // tetrad
        SYS.fullColorLevels.pairs.forEach((pair, lv) => {
            const p = C.generateHarmonyPalette('tetrad', [h, lv], slots); stat.tetrad++;
            if (p.length !== slots) bad.len++;
            const w = white[SYS.grayScale.letters.indexOf(pair[0])], s = 1 - white[SYS.grayScale.letters.indexOf(pair[1])];
            if (!p.every(c => c.w === w && Math.abs(c.s - s) < EPS)) bad.tetConst++;
            if (!p.every((c, j) => Math.abs(c.hue - (h + 6 * (j % 4))) < EPS)) bad.tetHues++;
            if (slots > 4 && !p.every((c, j) => j < 4 || c.hex === p[j % 4].hex)) bad.tetCycle++;
            if (!p.every(c => c.w >= 0 && c.s >= 0 && c.w + c.s <= 1 + EPS)) bad.valid++;
        });
    }
    check('every generated color is a valid triangle point, every palette has exactly `slots` colors', bad.valid === 0 && bad.len === 0, `valid-failures ${bad.valid}, length-failures ${bad.len}`);
    check('isotint: white content constant (exactly) across each series', bad.isotintConstW === 0);
    check('isotint: black content strictly increasing along each series', bad.isotintMono === 0);
    check('isotone: black content constant across each series', bad.isotoneConstS === 0);
    check('isotone: white content strictly increasing along each series', bad.isotoneMono === 0);
    check('shadow series: white:(white+black) ratio constant along each series (tol 1e-9)', bad.shadowRatio === 0);
    check('shadow series: full-color share strictly decreasing, within [0.10, 0.85]', bad.shadowMono === 0 && bad.shadowV === 0);
    check('isotint/isotone keep >= 2% full color in every color (hue stays identifiable)', bad.minV === 0);
    check('tetrad: (w, s) constant across the chord, matching each level pair', bad.tetConst === 0);
    check('tetrad: hues are base + 6k (mod 24); slots beyond 4 cycle the same four colors', bad.tetHues === 0 && bad.tetCycle === 0);
    measured.palettesChecked = stat;

    // Complementarity of the tetrad (the requested confirmation): within a
    // 4-chord, colors 0/2 and 1/3 are OPPOSITE hues at identical (w, s) and
    // must mix to near-neutral; colors 0/1 (6 apart) must not.
    let worst = 0, worstAdj = Infinity, pairsChecked = 0;
    for (let h = 0; h < N; h++) for (let lv = 0; lv < SYS.fullColorLevels.pairs.length; lv++) {
        const p = C.generateHarmonyPalette('tetrad', [h, lv], 4);
        for (const [i, j] of [[0, 2], [1, 3]]) { worst = Math.max(worst, chroma(mix([p[i].linear, p[j].linear], [0.5, 0.5]))); pairsChecked++; }
        // adjacent chord members, only meaningful when the color is not close to gray:
        worstAdj = Math.min(worstAdj, chroma(mix([p[0].linear, p[1].linear], [0.5, 0.5])));
    }
    measured.tetradOppositeResidualMax = worst;
    check('tetrad: opposite chord members (0/2, 1/3) mix to near-neutral, residual chroma <= 0.03', worst <= 0.03, `max ${worst.toFixed(4)} over ${pairsChecked} pairs`);
    // Control: the level with the most full color (pa) must show a clearly larger residual for adjacent members.
    const ctrl = C.generateHarmonyPalette('tetrad', [0, 0], 4);
    const adjResidual = chroma(mix([ctrl[0].linear, ctrl[1].linear], [0.5, 0.5]));
    check('control: adjacent chord members (6 hues apart) do NOT mix to neutral at the cleanest level', adjResidual > 0.03, adjResidual.toFixed(4));
}

// ---------------- 6. verification markers (no silent upgrade) -----------
console.log('\n== 6. verification markers ==');
{
    check('gray-letter percentages are marked verified:false', SYS.grayScale.verified === false);
    check('the full-color level list (two-letter reading) is marked verified:false', SYS.fullColorLevels.verified === false);
    check('the reference ring is marked calibrated:false', SYS.calibrated === false);
    const flags = Object.fromEntries(C.listHarmonyRules().filter(r => !r.id.startsWith('test-')).map(r => [r.id, r.verified]));
    check('shadow series (definition unconfirmed) and isotone (two-letter reading) are verified:false',
        flags['shadow-series'] === false && flags['isotone'] === false, JSON.stringify(flags));
    check("no rule and no datum claims a 'primary' verification",
        !Object.values(flags).includes('primary') && SYS.grayScale.verified !== 'primary' && SYS.fullColorLevels.verified !== 'primary');
    check('every built-in rule declares a verified marker (false or "secondary")',
        Object.values(flags).every(v => v === false || v === 'secondary'));
}

// ---------------- summary ------------------------------------------------
console.log('\n== measured values ==');
console.log(JSON.stringify(measured, null, 2));
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
