/**
 * tools/netwarp/test-netlines.js
 * The net-line overlay's geometry (core/netwarp.js netGridLines()): the lines of the warped net itself.
 *
 *   node tools/netwarp/test-netlines.js
 *
 *  1. The already measured case (Sinus, strength 1.00, Node Count 7, Shape Size 1, Both axes): the vertical
 *     lines sit at 0, 62.70, 169.27, 300, 430.73, 537.30, 600 px - gaps 62.70/106.57/130.73/130.73/106.57/62.70,
 *     the horizontal ones likewise; the regular raster gives 100 x 6.
 *  2. Every line lies where applyNetWarp() puts the regular lattice line (random frames, incl. a rotated
 *     square, every law, alternate parity).
 *  3. Closed net: lines only over the net rectangle (E+1 per axis); repeat/regular: they cover the view.
 *  4. Levels: with micro = k, lines i % k == 0 are 'macro', the rest 'micro' (the seam for nesting).
 *  5. Lines are edge to edge (span the net / the view) and axis-aligned for an axis-aligned frame.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const sb = { Math, console, baseNetTransform: null, currentShape: 'square', outerCorners: null, nodeCount: 7 };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'core', 'netwarp.js'), 'utf8'), sb);
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const square = (x0, y0, size, rot = 0) => { const c = Math.cos(rot), s = Math.sin(rot); const P = (u, v) => ({ x: x0 + u * c - v * s, y: y0 + u * s + v * c }); return [P(0, 0), P(size, 0), P(size, size), P(0, size)]; };
const uniq = a => [...new Set(a.map(v => +v.toFixed(6)))].sort((p, q) => p - q);
const gaps = a => a.slice(1).map((v, i) => +(v - a[i]).toFixed(2));
const VIEW = { x0: 0, y0: 0, x1: 600, y1: 600 };

console.log('== 1. the measured case ==');
{
    const spec = { x: { kind: 'trig', w: -1 }, y: 'same', repeat: false }, C = square(0, 0, 600);
    const L = sb.netGridLines(spec, C, 6, VIEW, { closed: true });
    const vx = uniq(L.filter(l => l.axis === 'v').map(l => l.x1)), hy = uniq(L.filter(l => l.axis === 'h').map(l => l.y1));
    console.log('   vertical x:', vx.map(v => +v.toFixed(2)).join(', '), '\n   gaps:', gaps(vx).join(', '));
    const EXP = [0, 62.6998, 169.2663, 300, 430.7337, 537.3002, 600];
    check('vertical lines at the measured positions (to 1e-3 px)', vx.length === 7 && vx.every((v, i) => near(v, EXP[i], 1e-3)));
    check('gaps 62.70, 106.57, 130.73, 130.73, 106.57, 62.70', JSON.stringify(gaps(vx)) === JSON.stringify([62.7, 106.57, 130.73, 130.73, 106.57, 62.7]));
    check('horizontal lines the same (Both axes)', hy.length === 7 && hy.every((v, i) => near(v, EXP[i], 1e-3)));
    const R = sb.netGridLines(null, C, 6, VIEW, { closed: false });
    check('regular raster: 100 px gaps', JSON.stringify(gaps(uniq(R.filter(l => l.axis === 'v' && l.x1 >= 0 && l.x1 <= 600).map(l => l.x1)))) === JSON.stringify([100, 100, 100, 100, 100, 100]));
}

console.log('\n== 2. lines == applyNetWarp() of the regular lattice ==');
{
    let worst = 0, n = 0;
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const SPECS = [{ x: { kind: 'trig', w: -0.9 }, y: 'same' }, { x: { kind: 'trig', w: 0.7 }, y: 'same' }, { x: { kind: 'geometric', w: 1.3, alternate: true }, y: { kind: 'trig', w: 0.5 } }, { x: { kind: 'geometric', w: -1, alternate: true }, y: 'same', repeat: true }];
    for (const spec of SPECS) for (const rot of [0, 0.4]) for (const E of [3, 6]) {
        const C = square(200 + rnd() * 50, 180 + rnd() * 50, 120 + rnd() * 80, rot);
        const warp = sb.netWarpForBase(spec, 'square', C, E + 1);
        const L = sb.netGridLines(spec, C, E, VIEW, { closed: !spec.repeat });
        for (const l of L) {
            // a point on the line, mapped from the regular lattice line through the same tile coordinates
            const t0 = sb.netWarpTileCoords(warp || { c0: C[0], v1: { x: C[1].x - C[0].x, y: C[1].y - C[0].y }, v2: { x: C[3].x - C[0].x, y: C[3].y - C[0].y }, det: (C[1].x - C[0].x) * (C[3].y - C[0].y) - (C[3].x - C[0].x) * (C[1].y - C[0].y) }, { x: l.x1, y: l.y1 });
            const ts = sb.netWarpTileCoords(warp || { c0: C[0], v1: { x: C[1].x - C[0].x, y: C[1].y - C[0].y }, v2: { x: C[3].x - C[0].x, y: C[3].y - C[0].y }, det: (C[1].x - C[0].x) * (C[3].y - C[0].y) - (C[3].x - C[0].x) * (C[1].y - C[0].y) }, { x: l.x2, y: l.y2 });
            const coord = l.axis === 'v' ? t0.s : t0.t, coord2 = l.axis === 'v' ? ts.s : ts.t;
            n++; worst = Math.max(worst, Math.abs(coord - coord2)); // both ends share the line's coordinate
        }
        // cross-check with applyNetWarp: warp the regular lattice points, their tile coordinate must be a line's
        if (warp) for (let i = 0; i <= E; i++) for (const [axis, vec] of [['v', 1], ['h', 3]]) {
            const p = { x: C[0].x + (i / E) * (C[vec].x - C[0].x), y: C[0].y + (i / E) * (C[vec].y - C[0].y) };
            const q = sb.applyNetWarp(warp, p), c = sb.netWarpTileCoords(warp, q);
            const want = axis === 'v' ? c.s : c.t;
            const has = L.some(l => l.axis === axis && Math.abs((axis === 'v' ? sb.netWarpTileCoords(warp, { x: l.x1, y: l.y1 }).s : sb.netWarpTileCoords(warp, { x: l.x1, y: l.y1 }).t) - want) < 1e-9);
            n++; if (!has) worst = Math.max(worst, 1);
        }
    }
    check('both ends of every line share its tile coordinate, and every warped lattice point lies on a drawn line', worst < 1e-9, `${n} checks, worst ${worst.toExponential(1)} (axis-aligned and rotated frames, 4 laws, alternate)`);
}

console.log('\n== 3. closed vs repeat coverage ==');
{
    const C = square(240, 240, 120), E = 4;
    const closed = sb.netGridLines({ x: { kind: 'trig', w: -0.8 }, y: 'same' }, C, E, VIEW, { closed: true });
    check('closed: E+1 vertical and E+1 horizontal lines, all inside the net rectangle', closed.filter(l => l.axis === 'v').length === E + 1 && closed.filter(l => l.axis === 'h').length === E + 1 && closed.every(l => [l.x1, l.x2].every(v => v >= 240 - 1e-9 && v <= 360 + 1e-9) && [l.y1, l.y2].every(v => v >= 240 - 1e-9 && v <= 360 + 1e-9)));
    const rep = sb.netGridLines({ x: { kind: 'trig', w: -0.8 }, y: 'same', repeat: true }, C, E, VIEW, { closed: false });
    const vx = uniq(rep.filter(l => l.axis === 'v').map(l => l.x1));
    check('repeat: the lines cover the whole view and repeat with the tile pitch', vx[0] <= 0 && vx[vx.length - 1] >= 600 && vx.filter(v => v >= 0 && v <= 600).length > 5 * E && near(vx[5] - vx[0], vx[5 + E] - vx[E], 1e-9), `${vx.length} distinct verticals`);
    check('repeat lines are edge to edge (span beyond the view)', rep.filter(l => l.axis === 'v').every(l => Math.min(l.y1, l.y2) <= 0 && Math.max(l.y1, l.y2) >= 600));
}

console.log('\n== 4. levels (the macro/micro seam) ==');
{
    const C = square(0, 0, 600), L = sb.netGridLines(null, C, 6, VIEW, { closed: true, micro: 2 });
    const v = L.filter(l => l.axis === 'v').sort((a, b) => a.x1 - b.x1);
    check('micro = 2: lines 0,2,4,6 are macro, 1,3,5 micro', v.map(l => l.level).join(',') === 'macro,micro,macro,micro,macro,micro,macro');
    check('default micro = 1: every line is macro', sb.netGridLines(null, C, 6, VIEW, { closed: true }).every(l => l.level === 'macro'));
}

console.log('\n== 5. degenerate input ==');
check('no corners / E < 1 gives no lines', sb.netGridLines(null, null, 6, VIEW, {}).length === 0 && sb.netGridLines(null, square(0, 0, 100), 0, VIEW, {}).length === 0);

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
