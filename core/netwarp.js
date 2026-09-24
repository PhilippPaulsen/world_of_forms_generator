/**
 * core/netwarp.js
 * Roadmap 1.6 / Group E, Netzart 1 (Hinterreiter, "Die Kunst der reinen Form", Band 2): the
 * net transform. Ostwald's closing remark in the sixth Mappe (patterns on the regular nets carry
 * over to less regular ones, straight lines staying straight, only length ratios changing) and
 * Hinterreiter's Quadratnetz with non-uniform spacing of its two Parallelenscharen.
 *
 * ARCHITECTURE. The pattern is built entirely in REGULAR coordinates - nodes, connections,
 * symmetry copies, tiling, orbits, layer alignment are all untouched. The warp F(x,y) =
 * (f(x), g(y)) is applied once, to the two endpoints of every emitted segment, at the drawing
 * sink drawCurvedBezier() (canvas, SVG export and the segment collector all pass through it).
 * Straight chords between mapped endpoints keep "node points exact, lines straight". It is NOT
 * a remap of nodes[]: with f != g a rotated copy of a remapped node would not be a node.
 *
 * DOMAIN. Per tile: in the frame of the base square (c0, v1 = c1-c0, v2 = c3-c0) a point has tile
 * coordinates (s,t); with k = floor(s), l = s-k the warped coordinate is k + f(l), f(0)=0, f(1)=1.
 * The tile lattice and every tile-boundary node stay where they are (confirmed against the
 * book: one figure IS the complete repeat unit).
 *
 * LAWS (interpretation: true - Hinterreiter gives descriptions and example figures, not
 * equations; these are this project's own closed forms matching the described BEHAVIOUR, checked
 * for monotone mesh widths, not a transcription of his construction). With u = 2l-1:
 *   sinus    f = (sin(a u)/sin a + 1)/2      meshes shrink toward the tile edge (Fig. 14, N>)
 *   tangens  f = (tan(a u)/tan a + 1)/2      meshes grow toward the tile edge   (Fig. 15, N<)
 *   geometric f = (q^(E l) - 1)/(q^E - 1)    E divisions, consecutive meshes in ratio q (Fig. 60/61's
 *            zigzag, read as the geometric progression it produces - not simulated)
 * One signed scalar per axis, w in [-1,1] (geometric: any real):
 *   trig:      w<0 sinus, a = -w*A_SIN;  w>0 tangens, a = w*A_TAN;  w=0 uniform
 *   geometric: w = ln R, R = last mesh / first mesh; q = R^(1/(E-1)), so R stays meaningful when
 *              the node count (E) changes; w=0 uniform
 *
 * SEAMS. A geometric series is asymmetric, so with the plain per-tile domain widths jump by
 * about q^E at every tile seam. `alternate: true` mirrors every odd tile (f -> 1 - f(1-l)) so
 * widths run continuously across seams. interpretation: true - the book's tiling-sequence figures
 * (tiles 1-19, p. 94) alternate orientation between neighbouring tiles to avoid visible seams,
 * but there for LINE MOTIFS, not shown to govern a spacing function. Hence a separate, default-off
 * option. Inert for the trig laws (their f is odd about the tile centre, so the mirror is f itself).
 *
 * SYMMETRY. Rotation by 90 degrees about the tile centre commutes with F only when f = g and f is
 * odd about the centre: true for the trig laws with equal axes, not for the geometric series
 * (measured in tools/netwarp/test-netwarp.js). A net that breaks the symmetry does so on purpose;
 * the pattern stays valid because it is built in regular space.
 *
 * Phase 1 scope: the base square sheet only (axis-aligned or rotated square frame), straight
 * lines. Face fills are NOT supported on a warped net (measured: the mean gap between F(crossing)
 * and the crossing of the mapped chords is 4.9% of a tile, max 22%) - drawTessellation() skips
 * face detection while a warp is active. No UI, hit-testing or export yet.
 */

const NETWARP_A_SIN = 1.3;   // provisional cap, tuned with the UI (outer/inner mesh cos(1.3) = 0.27)
const NETWARP_A_TAN = 1.2;   // provisional cap (outer/inner mesh sec^2(1.2) = 7.6)

// f: [0,1] -> [0,1] for one axis spec {kind, w, alternate}; null = identity. E = divisions per tile.
function netAxisLaw(axis, E) {
    if (!axis || axis.kind === 'uniform' || !axis.w) return null;
    if (axis.kind === 'trig') {
        const w = Math.max(-1, Math.min(1, axis.w));
        const a = (w < 0 ? -w * NETWARP_A_SIN : w * NETWARP_A_TAN);
        if (a < 1e-6) return null;
        if (w < 0) { const sa = Math.sin(a); return l => (Math.sin(a * (2 * l - 1)) / sa + 1) / 2; }
        const ta = Math.tan(a); return l => (Math.tan(a * (2 * l - 1)) / ta + 1) / 2;
    }
    if (axis.kind === 'geometric') {
        if (!(E >= 2)) return null;
        const lq = axis.w / (E - 1);                       // ln q
        if (Math.abs(lq) < 1e-9) return null;
        const den = Math.expm1(E * lq);
        return l => Math.expm1(E * l * lq) / den;
    }
    return null;
}

// spec: {x: axis, y: axis | 'same'} (null/undefined = no warp). frame: {c0, v1, v2}. Returns a
// ready warp object or null when the spec changes nothing (so the sink stays untouched and the
// output is byte-identical to a build without this module).
function makeNetWarp(spec, frame, E) {
    if (!spec || !frame) return null;
    const ax = spec.x, ay = spec.y === 'same' ? spec.x : spec.y;
    const fx = netAxisLaw(ax, E), fy = netAxisLaw(ay, E);
    if (!fx && !fy) return null;
    const { c0, v1, v2 } = frame;
    const det = v1.x * v2.y - v2.x * v1.y;
    if (!det) return null;
    return { fx, fy, altX: !!(ax && ax.alternate), altY: !!(ay && ay.alternate), c0, v1, v2, det };
}

function _netWarpAxis(f, alt, s) {
    const k = Math.floor(s), l = s - k;
    return (alt && (k & 1)) ? k + 1 - f(1 - l) : k + f(l);
}

// The warp for the base sheet as drawTessellation() uses it: square shapes only in Phase 1.
function netWarpForBase(spec, shape, corners, nodeCountValue) {
    if (!spec || shape !== 'square' || !corners || corners.length < 4) return null;
    const c0 = corners[0], c1 = corners[1], c3 = corners[3];
    return makeNetWarp(spec, { c0, v1: { x: c1.x - c0.x, y: c1.y - c0.y }, v2: { x: c3.x - c0.x, y: c3.y - c0.y } }, nodeCountValue - 1);
}

function applyNetWarp(warp, pt) {
    const dx = pt.x - warp.c0.x, dy = pt.y - warp.c0.y;
    const s = (dx * warp.v2.y - dy * warp.v2.x) / warp.det;
    const t = (warp.v1.x * dy - warp.v1.y * dx) / warp.det;
    let x = pt.x, y = pt.y;
    if (warp.fx) { const d = _netWarpAxis(warp.fx, warp.altX, s) - s; x += d * warp.v1.x; y += d * warp.v1.y; }
    if (warp.fy) { const d = _netWarpAxis(warp.fy, warp.altY, t) - t; x += d * warp.v2.x; y += d * warp.v2.y; }
    return { x, y };
}
