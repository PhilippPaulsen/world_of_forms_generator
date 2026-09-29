/**
 * tools/color/test-orbitcolor.js
 * Headless verification for core/faces.js's orbitColor() after the Phase B1
 * revision (evenly-spaced Ostwald grays, replacing the evenly-spaced HSL
 * hues it used before). No existing test called orbitColor() directly
 * before this - it was only exercised indirectly through face-detection
 * integration tests - so this is a new, focused unit-level check.
 *
 *   node tools/color/test-orbitcolor.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');

const sb = { console };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'core', 'color.js'), 'utf8'), sb, { filename: 'core/color.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'core', 'faces.js'), 'utf8'), sb, { filename: 'core/faces.js' });
const orbitColor = sb.orbitColor;
const resolveColor = sb.resolveColor;
const REF = vm.runInContext('OSTWALD_REFERENCE_SYSTEM', sb);
const LETTERS = vm.runInContext('OSTWALD_GRAY_LETTERS', sb);
const WHITE = vm.runInContext('OSTWALD_GRAY_WHITE_CONTENT_UNVERIFIED', sb);

let failures = 0, checks = 0;
function check(name, ok, detail) {
    checks++; if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`);
}
const grayHexAt = letterIdx => resolveColor(REF, { hue: 0, w: WHITE[letterIdx], s: 1 - WHITE[letterIdx] }).hex;

// ---------------- 1. format and "no orbit" fallback, unchanged -----------
console.log('== 1. format and fallback ==');
{
    check('null connIndex still returns the unchanged neutral-gray HSL fallback', orbitColor(null, 5) === 'hsl(0, 0%, 70%)');
    check('undefined connIndex likewise', orbitColor(undefined, 5) === 'hsl(0, 0%, 70%)');
    check('totalOrbits <= 0 likewise (defensive)', orbitColor(0, 0) === 'hsl(0, 0%, 70%)');
    const c = orbitColor(0, 3);
    check('a real orbit now returns a #rrggbb hex (resolveColor().hex), not hsl(...)', /^#[0-9a-f]{6}$/i.test(c), c);
}

// ---------------- 2. grayscale, not hue: every result IS a real gray -----
console.log('\n== 2. results are genuine grays (R=G=B) ==');
{
    let notGray = 0, total = 0;
    for (const totalOrbits of [1, 2, 3, 5, 8, 13, 16, 20, 50]) {
        for (let ci = 0; ci < totalOrbits; ci++) {
            total++;
            const hex = orbitColor(ci, totalOrbits);
            const r = hex.slice(1, 3), g = hex.slice(3, 5), b = hex.slice(5, 7);
            if (r !== g || g !== b) notGray++;
        }
    }
    check('every orbitColor() result across a spread of orbit counts is a true gray (R=G=B)', notGray === 0, `${notGray}/${total} not gray`);
}

// ---------------- 3. even distribution across the 8-letter scale ---------
console.log('\n== 3. even distribution, same modular logic as the old hue formula ==');
{
    // totalOrbits = 8: every one of the 8 letters exactly once, in order a..p
    const at8 = Array.from({ length: 8 }, (_, ci) => orbitColor(ci, 8));
    const want8 = LETTERS.map((_, i) => grayHexAt(i));
    check('totalOrbits=8: each connIndex 0..7 gets a DISTINCT letter, in a..p order', JSON.stringify(at8) === JSON.stringify(want8), at8.join(','));

    // totalOrbits=1: the single orbit gets letter 'a' (index 0, the formula's start)
    check('totalOrbits=1: the one orbit gets letter a (lightest)', orbitColor(0, 1) === grayHexAt(0));

    // totalOrbits=2: spread across the scale (indices 0 and 4), not adjacent letters
    check('totalOrbits=2: two orbits land on well-separated letters (idx 0 and 4), not adjacent ones',
        orbitColor(0, 2) === grayHexAt(0) && orbitColor(1, 2) === grayHexAt(4));

    // totalOrbits=20 (> 8 letters): cycles back through the scale, matching the old
    // formula's own behavior once totalOrbits exceeded the (much larger) 360-degree space -
    // same modular structure, just base 8 instead of base 360.
    const at20 = Array.from({ length: 20 }, (_, ci) => orbitColor(ci, 20));
    const distinct20 = new Set(at20).size;
    check('totalOrbits=20: cycles through the 8-letter scale more than once (not stuck on one gray)', distinct20 > 1 && distinct20 <= 8, `${distinct20} distinct grays over 20 orbits`);
    // Independently recomputed (not the implementation's own formula copy-pasted): idx = round(8*ci/20) mod 8.
    let idxMismatch = 0;
    at20.forEach((hex, ci) => {
        const expectedIdx = Math.round((8 * ci / 20) % 8) % 8;
        if (hex !== grayHexAt(expectedIdx)) idxMismatch++;
    });
    check('totalOrbits=20: every connIndex matches an independently recomputed expected letter index', idxMismatch === 0, `${idxMismatch}/20 mismatched`);
    // A full cycle back to letter index 0 happens when 8*ci/totalOrbits is a multiple of 8,
    // i.e. ci is a multiple of totalOrbits itself - ci=20 (out of this orbit count's own
    // range, but the formula is still well-defined there) recomputes to index 0 again.
    check('the formula returns to letter index 0 after a full cycle (ci = totalOrbits)', orbitColor(20, 20) === grayHexAt(0), orbitColor(20, 20));
}

// ---------------- 4. the rounding-to-8 edge case, found during design ----
console.log('\n== 4. Math.round(x % 8) landing on exactly 8 (out-of-bounds guard) ==');
{
    // totalOrbits=16, connIndex=15: 8*15/16 = 7.5, Math.round rounds .5 up to 8 -
    // without the extra "% n" after rounding this would read
    // OSTWALD_GRAY_WHITE_CONTENT_UNVERIFIED[8] (undefined) and throw inside resolveColor().
    let threw = null, result = null;
    try { result = orbitColor(15, 16); } catch (err) { threw = err; }
    check('totalOrbits=16, connIndex=15 (the exact round-to-8 case) does not throw', threw === null, threw && threw.message);
    check('...and wraps to letter a (index 0), not an out-of-bounds read', result === grayHexAt(0), result);

    // A broader sweep for any other (totalOrbits, connIndex) pair up to 200 that could
    // round to exactly n - confirms the fix generally, not just the one case found by hand.
    let anyThrew = 0;
    for (let totalOrbits = 1; totalOrbits <= 200; totalOrbits++) {
        for (let ci = 0; ci < totalOrbits; ci++) {
            try { orbitColor(ci, totalOrbits); } catch (err) { anyThrew++; }
        }
    }
    check('no (connIndex, totalOrbits) pair up to totalOrbits=200 throws', anyThrew === 0, `${anyThrew} threw`);
}

// ---------------- 5. grayScale.verified stays false ------------------------
console.log('\n== 5. the underlying data stays flagged unverified ==');
{
    check('OSTWALD_REFERENCE_SYSTEM.grayScale.verified is still false after being used as the default fill', REF.grayScale.verified === false);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
