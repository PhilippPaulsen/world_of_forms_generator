/**
 * tools/color/test-anchor-widgets.js
 * Headless verification for Group D Phase B3 (Farborgel generator
 * integration): the pure geometry behind the Kreis (hue-ring) and Dreieck
 * (register-triangle) widgets - core/farborgel-bridge.js's hueRingPoints()/
 * registerTrianglePoints(). Both functions are plain math (no DOM), loaded
 * the same way test-anchor.js loads core/facecolor.js.
 *
 *   node tools/color/test-anchor-widgets.js
 *
 * ui-farbe.js's DOM/SVG-building and click/keyboard wiring around these
 * functions is browser-only and verified separately (real browser check,
 * not headless - see the Phase B3 report).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');

const CORE = ['forms', 'state', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'orbits', 'color', 'facecolor', 'farborgel-bridge'];
const SRC = CORE.map(f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');

function makeSandbox() {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs,
        dist: (a, b, c, d) => Math.hypot(c - a, d - b), console
    };
    vm.createContext(sb);
    vm.runInContext(SRC, sb);
    return sb;
}

let failures = 0, checks = 0;
function check(name, ok, detail) {
    checks++; if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`);
}
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const sb = makeSandbox();

// ------------------------------------------------------------------------
console.log('== 1. hueRingPoints(): 24 evenly spaced points, hueIndex 1 at 12 o\'clock, clockwise ==');
{
    const pts = vm.runInContext('hueRingPoints(0, 0, 100)', sb);
    check('exactly 24 points (one per Farborgel hue)', pts.length === 24, pts.length);
    check('hueIndex 1..24 in order, no gaps or duplicates', pts.every((p, i) => p.hueIndex === i + 1));

    const h1 = pts.find(p => p.hueIndex === 1);
    check('hueIndex 1 is at angle 0 (straight up: x=0, y=-r)', close(h1.angle, 0) && close(h1.x, 0) && close(h1.y, -100), JSON.stringify(h1));

    const h7 = pts.find(p => p.hueIndex === 7);
    // 24 steps of 15 degrees; hueIndex 7 is 6 steps in = 90 degrees = due "right" (x=+r, y=0) under x=cx+sin*r, y=cy-cos*r
    check('hueIndex 7 is a quarter turn clockwise (90deg: x=+r, y=0)', close(h7.angle, Math.PI / 2) && close(h7.x, 100) && close(h7.y, 0), JSON.stringify(h7));

    const h13 = pts.find(p => p.hueIndex === 13);
    check('hueIndex 13 is half way round (180deg: x=0, y=+r, straight down)', close(h13.angle, Math.PI) && close(h13.x, 0) && close(h13.y, 100), JSON.stringify(h13));

    check('every point lies exactly on the circle of radius r (independently recomputed distance from center)',
        pts.every(p => close(Math.hypot(p.x - 0, p.y - 0), 100, 1e-6)));

    // Center/radius are real parameters, not hardcoded - a different center/radius must translate/scale correctly.
    const pts2 = vm.runInContext('hueRingPoints(50, -20, 10)', sb);
    const h1b = pts2.find(p => p.hueIndex === 1);
    check('a different center/radius scales and translates correctly (hueIndex 1 at cx, cy-r)', close(h1b.x, 50) && close(h1b.y, -30), JSON.stringify(h1b));
}

console.log('\n== 2. registerTrianglePoints(): the real 28-register right-triangle layout ==');
{
    const pts = vm.runInContext('registerTrianglePoints(0, 0, 10, 10)', sb);
    const order = vm.runInContext('FARBORGEL_REGISTER_ORDER', sb);
    check('exactly 28 points, one per FARBORGEL_REGISTER_ORDER entry, same order', pts.length === 28 && pts.every((p, i) => p.label === order[i]));
    check('registerIndex matches the point\'s position in FARBORGEL_REGISTER_ORDER', pts.every((p, i) => p.registerIndex === i));

    // Row distribution: independently recomputed via the white/black letter-index distance, not copy-pasted
    // from the implementation - a right triangle of 7 rows, sizes 1,2,3,4,5,6,7 (sum 28).
    const LETTER_INDEX = { a: 0, c: 1, e: 2, g: 3, i: 4, l: 5, n: 6, p: 7 };
    const expectedRow = label => 6 - (LETTER_INDEX[label[0]] - LETTER_INDEX[label[1]] - 1);
    check('every point\'s row matches an independent recomputation from its own label', pts.every(p => p.row === expectedRow(p.label)));
    const rowCounts = {};
    pts.forEach(p => { rowCounts[p.row] = (rowCounts[p.row] || 0) + 1; });
    check('row sizes are exactly 1,2,3,4,5,6,7 (rows 0..6) - the real 28-cell right triangle, not an arbitrary grid',
        JSON.stringify(rowCounts) === JSON.stringify({ 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7 }), JSON.stringify(rowCounts));

    // Spot-check known registers against hand computation (not the implementation's own formula restated).
    const spot = { ca: { row: 6, white: 1, black: 0 }, pa: { row: 0, white: 7, black: 0 }, pn: { row: 6, white: 7, black: 6 }, ga: { row: 4, white: 3, black: 0 } };
    let spotOk = true, spotDetail = [];
    for (const [label, exp] of Object.entries(spot)) {
        const p = pts.find(q => q.label === label);
        const ok = p && p.row === exp.row;
        spotDetail.push(`${label}:row=${p && p.row}(want ${exp.row})`);
        if (!ok) spotOk = false;
    }
    check('spot-checked registers (ca, pa, pn, ga) land on their hand-computed rows', spotOk, spotDetail.join(', '));

    // Geometry sanity: row 0 (the single most-extreme pair, "pa") is nearest cy; row 6 (7 cells, adjacent
    // letters) is furthest - y = cy + row*rowSpacing, so y increases monotonically with row.
    check('y increases monotonically with row (cy + row*rowSpacing)', pts.every(p => close(p.y, 0 + p.row * 10)));
    // Within a row, points are centered around cx (x = cx + (black - row/2)*colSpacing): the row's x values
    // must be symmetric around cx.
    let symmetryOk = true;
    for (let row = 0; row <= 6; row++) {
        const xs = pts.filter(p => p.row === row).map(p => p.x).sort((a, b) => a - b);
        const mid = (xs[0] + xs[xs.length - 1]) / 2;
        if (!close(mid, 0, 1e-6)) symmetryOk = false;
    }
    check('each row\'s points are horizontally centered on cx (mirrors TriangleView.mjs\'s own centering)', symmetryOk);
}

// ------------------------------------------------------------------------
console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
