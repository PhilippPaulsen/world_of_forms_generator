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
 * CLOSED NET vs REPEAT (spec.repeat). The app's outer tiling (Shape Size, core/tiling.js's tile loop)
 * would repeat that one warped unit across the canvas - a "wallpaper" that looks flat, and not what
 * Hinterreiter's Fig. 14/15 show: ONE closed, self-terminating net. So by default (repeat off) the
 * tile loops cover only the net's own rectangle (tiling.js: closedNetActive()) and the base sheet
 * visits a single tile; Shape Size keeps its meaning (the net's size: 1 fills the canvas). repeat: true
 * restores the repeated tiling, where `alternate` (tile-seam parity) applies. F itself is the same
 * in both modes - only which tiles are drawn differs. Layers: an offset layer's tiles may reach past
 * the net rectangle, where F applies a neighbouring tile's law that a closed net does not have; how to
 * resolve that (clip or not) is a phase 3 decision - it degrades to "drawn, warped by that law".
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
 * FIELD (spec.domain = 'field', Model 2 - Hinterreiter's Netzart 1.1, Fig. 8.1/8.2). The law governs the WHOLE
 * repeated span instead of restarting in every tile: the R x R tiles of the outer tiling (R = Shape Size, odd,
 * 3..9; the base tile is the CENTRAL macro cell) are R macro cells whose boundaries follow the law across the
 * field, and the clicked tile is drawn in each of them as an affine (per-axis scale) copy: with h = (R-1)/2,
 * sigma = s + h in [0,R], P_k = R*f(k/R) (f = the smooth law for R macro cells) and
 * F(sigma) = P_k + (sigma-k)*(P_{k+1}-P_k), k = floor(sigma) clamped to [0,R-1] (linear extension outside the
 * field, so F stays a bijection with a closed-form inverse per tile). A node at local position l of tile k lands at
 * P_k + l*w_k, w_k = P_{k+1}-P_k. Because F is affine inside every tile, lines map to lines and crossings to
 * crossings; F is odd about the field centre (= the central tile's centre = the centroid), so the exact commutation
 * with the square's symmetry group holds for the whole field. `repeat` (the earlier boolean) is the legacy spelling:
 * domain absent -> repeat ? 'tiled' : 'single'. An invalid field (R even, < 3, > 9) is IGNORED visibly
 * (netDomainEffective(); export domainIgnored) and falls back to the legacy reading. Intra-tile `macro` does not
 * apply in a field (the micro grid is the clicked tile's own, uniform per tile). A trig axis's `focus` DOES apply in a field: the widest
 * (sinus) / narrowest (tangens) tile moves to field position (1+c)/2 (each tile stays an affine copy; the field is no longer odd).
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
 * SCOPE. The base square sheet only (axis-aligned or rotated square frame; triangle and hex ignore
 * a set warp, on purpose - Netzart 1 is Parallelenschar + Parallelenschar at right angles), straight
 * lines only (the UI turns curve/free mode off while a warp is in force). Additional layers are drawn
 * through the same position-based F.
 *
 * FACES ARE REFUSED, NOT APPROXIMATED, on a warped net (measured: the mean gap between F(crossing) and
 * the crossing of the mapped chords is 4.9% of a tile, max 22%; and the face keys assume the
 * translation/symmetry equivalence the warp removes). computeCellFaces()/computeCrossLayerFaces()
 * return nothing, drawTessellation() skips fills, buildExportData() omits the face lists and says so
 * in meta.netTransform.facesOmitted, the Face Colors panel and the cross-layer status say why.
 * Warp-aware detection would mean re-deriving orbit keys for a non-periodic net: a project of its own.
 *
 * FREE ENDPOINTS (1.3(a)) are stored in REGULAR space and drawn through F like every node, so a click
 * is stored at F^-1(click) (invertNetWarp()) and lands where it was clicked. Changing the warp later
 * moves them with the net, as any node moves.
 */

const NETWARP_A_SIN = 1.3;   // provisional cap, tuned with the UI (outer/inner mesh cos(1.3) = 0.27)
const NETWARP_A_TAN = 1.2;   // provisional cap (outer/inner mesh sec^2(1.2) = 7.6)

// ---- Nested net: macro grid x uniform micro grid (Group E / 1.6, phase 2) ----
// The macro law (the trig/geometric law above) fixes `macro` (Em) unequal macro cells per axis; every macro
// cell is subdivided UNIFORMLY into micro = E/Em cells, so a tile still has E = Em*micro divisions and the
// node array stays FLAT and unchanged (ids, connections, symmetry group, orbits, faces): only the position
// function changes. F(t) = M_k + u*(M_{k+1}-M_k) for s = t*Em, k = floor(s) (clamped to Em-1), u = s-k, with
// M_k = f(k/Em) the macro law sampled at the macro points (geometric: q = R^(1/(Em-1)) at the macro level).
// F is odd about the tile centre whenever f is (the samples are symmetric), so the exact commutation with
// the square's symmetry group carries over unchanged (measured 4.3e-14 px, Em=3, micro=2). micro = 1 (the
// default, macro = E) returns the smooth law itself - byte-identical to before this change. Note Em = 2 puts
// a trig law's macro points on its fixed points (0, 1/2, 1): no visible effect; use Em >= 3.
// The upper bound on E is the measured node-count headroom (Group E phase 1 measurement: the orbit table for
// a square is 53 ms at 13 nodes per axis (E = 12), 99.4 ms at 15 (E = 14) - marginal); a spec beyond it is
// IGNORED (macro falls back to E), visibly: netMacroEffective() says why and the export flags it.
const NETWARP_MAX_E = 14;
function netMacroEffective(macro, E) {
    const def = { macro: E, micro: 1, valid: true, reason: null };
    if (macro === undefined || macro === null) return def;
    let reason = null;
    if (!Number.isInteger(macro) || macro < 1) reason = 'macro must be a positive integer';
    else if (E > NETWARP_MAX_E) reason = `E = ${E} exceeds the verified ceiling ${NETWARP_MAX_E}`;
    else if (E % macro !== 0) reason = `macro ${macro} does not divide E = ${E}`;
    if (reason) return { macro: E, micro: 1, valid: false, reason };
    return { macro, micro: E / macro, valid: true, reason: null };
}

// The macro values a UI can offer for E divisions: the divisors of E that are >= 3 (a trig law's macro
// points at Em = 1 or 2 are its fixed points - no effect), up to and including E itself (= smooth, no
// nesting). Empty beyond the verified ceiling. [E] alone means no nesting is possible for this E.
// The macro counts the UI offers for E divisions per tile. Default (no spec): the divisors >= 3, because Em = 2 puts a trig
// law's only interior macro point on its fixed point 1/2 (measured: |M1 - 1/2| <= 1.1e-16 for sinus and tangens at every
// strength, so the axis comes out perfectly uniform - a no-op). The geometric law has no such fixed point: Em = 2 is a real
// two-cell split (widths 1/(1+R) : R/(1+R), the ratio is R itself); neither has a trig law WITH FOCUS (its window is off-centre,
// M1 = f(1/2) != 1/2), so Em = 2 is offered when EVERY warped axis is one of those - `spec` = the net spec {x, y} (y 'same' = x).
// With a symmetric trig axis in play Em = 2 would silently flatten that axis. E must still be divisible (netMacroEffective()).
function netSpecMacro2Real(spec) {
    if (!spec) return false;
    const axes = [spec.x, spec.y === 'same' ? spec.x : spec.y].filter(a => a && a.kind !== 'uniform' && a.w);
    return axes.length > 0 && axes.every(a => a.kind === 'geometric' || (a.kind === 'trig' && netFocusOf(a) !== 0));
}
function netMacroOptions(E, spec) {
    const out = [];
    if (!(E >= 3) && !(E === 2 && netSpecMacro2Real(spec))) return out;
    if (E > NETWARP_MAX_E) return out;
    const from = netSpecMacro2Real(spec) ? 2 : 3;
    for (let m = from; m <= E; m++) if (E % m === 0) out.push(m);
    return out;
}

// f: [0,1] -> [0,1] for one axis spec {kind, w, alternate}; null = identity. E = divisions per tile,
// macro = macro divisions (optional; see above). A nested law carries f.pl = {M, Em} (its macro samples), which
// is what makes its inverse closed-form per macro segment.
function netAxisLaw(axis, E, macro) {
    const eff = netMacroEffective(macro, E);
    const smooth = _netSmoothLaw(axis, eff.macro);
    if (!smooth || eff.micro === 1) return smooth;
    const Em = eff.macro, M = Array.from({ length: Em + 1 }, (_, k) => smooth(k / Em));
    const f = l => {
        const s = l * Em; let k = Math.floor(s);
        if (k < 0) k = 0; else if (k > Em - 1) k = Em - 1;
        return M[k] + (s - k) * (M[k + 1] - M[k]);
    };
    f.pl = { M, Em };
    return f;
}

// The focus of a trig axis, clamped to [-1,1]; 0 = the symmetric law (also for any non-trig axis: focus is trig-only).
function netFocusOf(axis) {
    if (!axis || axis.kind !== 'trig') return 0;
    const c = Number(axis.focus);
    return Number.isFinite(c) ? Math.max(-1, Math.min(1, c)) : 0;
}
// The smooth single-level law (unchanged since phase 1). E = divisions per tile (macro count when nested).
function _netSmoothLaw(axis, E) {
    if (!axis || axis.kind === 'uniform' || !axis.w) return null;
    if (axis.kind === 'trig') {
        const w = Math.max(-1, Math.min(1, axis.w));
        const a = (w < 0 ? -w * NETWARP_A_SIN : w * NETWARP_A_TAN);
        if (a < 1e-6) return null;
        const c = netFocusOf(axis);
        if (c === 0) { // the symmetric law, unchanged (a separate branch, so focus 0 is byte-identical to before focus existed)
            if (w < 0) { const sa = Math.sin(a); return l => (Math.sin(a * (2 * l - 1)) / sa + 1) / 2; }
            const ta = Math.tan(a); return l => (Math.tan(a * (2 * l - 1)) / ta + 1) / 2;
        }
        // Focus c in [-1,1]: the window of the trig function is shifted so its extreme sits at u = c (tile position (1+c)/2):
        //   f = (g(a'(u - c)) + g(a'(1 + c))) / (g(a'(1 - c)) + g(a'(1 + c))),   u = 2l - 1,   a' = a / (1 + |c|)
        // f(0) = 0 and f(1) = 1 by construction. The rescale keeps the window's half-width a'(1 + |c|) = a - the same as the
        // symmetric law's, i.e. below pi/2 across the whole strength range (max 1.3 sinus / 1.2 tangens), so g stays monotone and
        // the window never folds. f is no longer odd about the tile centre.
        const ap = a / (1 + Math.abs(c)), g = w < 0 ? Math.sin : Math.tan, lo = g(ap * (1 + c)), den = g(ap * (1 - c)) + lo;
        return l => (g(ap * (2 * l - 1 - c)) + lo) / den;
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

// ---- Field domain (Model 2): the law over the whole repeated span ----
const NETWARP_MAX_FIELD_TILES = 9;   // = the largest Shape Size the UI offers
// Task 105 (N2a-1) / 106 (N2a-2): the Field on an EVEN tile count per axis of the SQUARE. The model: the field rectangle is the canvas [0, W] x [0, H]; on an even axis the mesh line sits at the canvas centre, so the picture of the net is moved
// by T = e/2 (+ direction) against the plain grid (picture = F(p + T), p regular): the tiles of the field are lo = n/2 tiles left and hi = n/2 - 1 right of the base tile, and the regular-space field rectangle is [0, W] - T
// (warp.c0/v1/v2, core/tiling.js untouched). Task 106: (task 109: the hexagon takes every size 3..9 too, like the triangle) (task 108: the TRIANGLE takes every size 3..9 too, WITHOUT a shift: its Field is a covering parallelogram of odd Rx x Ry meshes found by a search, so the parity of X, Y does not touch the warp); netDomainEffective() takes the shape as its third argument and WITHOUT a known shape reads the conservative rule (odd counts only).
// netFieldMinTiles = the smallest field axis of the square (the UI floor 3); only the tests and measurement scripts set it to 2 (a plain global `let`, like faceRepairCollinear in core/faces.js): no URL, session, import or UI path writes it.
let netFieldMinTiles = 3;

// Which domain a spec asks for and which it gets: 'single' (one closed tile), 'tiled' (the wallpaper) or 'field'.
// Rt = the outer tile count along an axis (Shape Size) - only the field needs it. A spec without `domain` reads its
// legacy `repeat` boolean. An invalid request is IGNORED (falls back to the legacy reading), visibly: `ignored`.
// Task 086: `Rt` is a number (the same count on both axes: every pre-086 caller) or {x, y} (the tile counts of a non-square area, see
// netSizeFactors() in core/state.js). A bare number equal to the live shapeSizeFactor on a NON-square base means "the base's size": the
// base sheet's callers that still pass shapeSizeFactor (core/tiling.js drawTessellation) read the same {x, y} as everybody else.
function _netRt(Rt) {
    if (typeof Rt === 'number' && typeof gridIsSquare === 'function' && !gridIsSquare() && Rt === shapeSizeFactor && typeof netSizeFactors === 'function') Rt = netSizeFactors();
    if (Rt && typeof Rt === 'object') return { x: Rt.x, y: Rt.y };
    return { x: Rt, y: Rt };
}
// Task 106: `shape` ('square' | 'triangle' | 'hex'): an even count is a Field on the square (counts netFieldMinTiles..9) on the triangle (3..9, task 108) and on the hexagon (3..9, task 109); a missing or unknown shape reads the conservative rule (odd 3..9).
function netDomainEffective(spec, Rt, shape) {
    const legacy = spec && spec.repeat ? 'tiled' : 'single';
    const req = spec ? spec.domain : undefined;
    if (req === undefined || req === null) return { domain: legacy, ignored: null };
    if (req === 'single' || req === 'tiled') return { domain: req, ignored: null };
    let reason = null;
    if (req !== 'field') reason = `unknown domain '${req}'`;
    else {
        const R = _netRt(Rt), two = R.x !== R.y;
        for (const n of [R.x, R.y]) {
            const sq = shape === 'square', evenOk = (sq || shape === 'triangle' || shape === 'hex') && n % 2 === 0;   // task 106: an even count is a field on the square; task 108: and on the triangle; task 109: and on the hexagon (floor 3, no shift; the hexagon search reads neither X nor Y)
            if (!Number.isInteger(n)) reason = 'a field needs an integer tile count (Shape Size)';
            else if (n < (sq ? netFieldMinTiles : 3)) reason = 'a field needs at least 3 tiles (Shape Size 3, 5, 7 or 9): a trig law has no effect on 1 or 2 macro cells';
            else if (n % 2 === 0 && !evenOk) reason = two ? 'a field needs an odd tile count on both axes (X and Y odd: 3, 5, 7 or 9) so the base tile is the central cell' : 'a field needs an odd tile count (odd Shape Size) so the base tile is the central cell';
            else if (n > NETWARP_MAX_FIELD_TILES) reason = `a field of ${n} tiles exceeds the ceiling ${NETWARP_MAX_FIELD_TILES}`;
            if (reason) break;
        }
    }
    if (reason) return { domain: legacy, ignored: { requested: req, reason } };
    return { domain: 'field', ignored: null };
}

// The field law for one axis: F(sigma), sigma in tile units over [0,Rt] (the field), P_k = Rt*f(k/Rt), piecewise
// linear, linearly extended beyond the field. null = identity. F.field = {P, Rt} (its inverse is closed form).
function netFieldLaw(axis, Rt) {
    // A trig axis's focus moves the widest/narrowest TILE off the field centre (P_k = Rt*f(k/Rt) stays strictly increasing and
    // F stays piecewise linear, so every tile is still a per-axis affine copy and Step A's exactness does not depend on it);
    // it only costs the field's oddness about the centroid, i.e. the rot90/rot180/mirror symmetry of the whole image.
    const smooth = _netSmoothLaw(axis, Rt);
    if (!smooth) return null;
    const P = Array.from({ length: Rt + 1 }, (_, k) => Rt * smooth(k / Rt));
    const F = sigma => {
        let k = Math.floor(sigma);
        if (k < 0) k = 0; else if (k > Rt - 1) k = Rt - 1;
        return P[k] + (sigma - k) * (P[k + 1] - P[k]);
    };
    F.field = { P, Rt };
    return F;
}
// F^-1 in tile coordinates (base tile = [0,1]): find the tile whose boundary samples bracket the target, invert the line.
function _netFieldAxisInverse(f, sOut, h) {
    const { P, Rt } = f.field, y = sOut + h;
    let lo = 0, hi = Rt - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (P[mid] <= y) lo = mid; else hi = mid - 1; }
    const w = P[lo + 1] - P[lo];
    return lo + (w > 0 ? (y - P[lo]) / w : 0) - h;
}

// spec: {x: axis, y: axis | 'same'} (null/undefined = no warp). frame: {c0, v1, v2}. Rt: the outer tile count
// (Shape Size), needed only for domain 'field'. Returns a ready warp object or null when the spec changes nothing
// (so the sink stays untouched and the output is byte-identical to a build without this module).
function makeNetWarp(spec, frame, E, Rt) {
    if (!spec || !frame) return null;
    if (spec.kind === 'projective') return _netProjectiveWarp(spec, frame);   // task 121 (3C-1): the Moebius net; every other spec has no `kind` and takes the path below unchanged
    const dom = netDomainEffective(spec, Rt, 'square');   // task 106: a warp built here is the square's (netWarpForBase routes the triangle and the hexagon to their own builders)
    const ax = spec.x, ay = spec.y === 'same' ? spec.x : spec.y;
    const isField = dom.domain === 'field';
    const R = isField ? _netRt(Rt) : null;
    const fx = isField ? netFieldLaw(ax, R.x) : netAxisLaw(ax, E, spec.macro), fy = isField ? netFieldLaw(ay, R.y) : netAxisLaw(ay, E, spec.macro);
    if (!fx && !fy && !spec.keep) return null;   // `keep` (an animation frame that happens to be exactly regular): stay a warp - closed net, domain and locks do not flicker
    const { c0, v1, v2 } = frame;
    const det = v1.x * v2.y - v2.x * v1.y;
    if (!det) return null;
    if (isField && (R.x !== R.y || R.x % 2 === 0)) {
        // Task 086: a Rx x Ry field. core/tiling.js (byte-equal) reads warp.c0/v1/v2 with field {h, Rt} as ONE Rt x Rt square; here the whole field
        // rectangle sits in c0/v1/v2 (h = 0, Rt = 1 make closedNetRectCorners() return it as is) and the base tile moves to warp.frame, which
        // every function below reads through _netFrame().
        // task 105: hx, hy = tiles left / below the base tile (= (n - 1) / 2 for an odd count, n / 2 for an even one: Math.floor(n / 2)); an even axis adds hix / hiy (tiles right / above) and the half-tile shift tx / ty
        const hx = Math.floor(R.x / 2), hy = Math.floor(R.y / 2), evX = R.x % 2 === 0, evY = R.y % 2 === 0;
        const fc0 = { x: c0.x - hx * v1.x - hy * v2.x, y: c0.y - hx * v1.y - hy * v2.y }, fv1 = { x: R.x * v1.x, y: R.x * v1.y }, fv2 = { x: R.y * v2.x, y: R.y * v2.y };
        const evenKeys = (evX || evY) ? { hix: R.x - 1 - hx, hiy: R.y - 1 - hy, tx: evX ? 0.5 : 0, ty: evY ? 0.5 : 0 } : null;
        return { fx, fy, altX: false, altY: false, repeat: false, domain: 'field', field: Object.assign({ Rt: 1, h: 0, Rx: R.x, Ry: R.y, hx, hy }, evenKeys), frame: { c0, v1, v2, det }, domainIgnored: dom.ignored, c0: fc0, v1: fv1, v2: fv2, det: fv1.x * fv2.y - fv2.x * fv1.y, ...(evenKeys ? { shiftVec: { x: evenKeys.tx * v1.x + evenKeys.ty * v2.x, y: evenKeys.tx * v1.y + evenKeys.ty * v2.y } } : {}) };
    }
    return { fx, fy, altX: !isField && !!(ax && ax.alternate), altY: !isField && !!(ay && ay.alternate), repeat: dom.domain === 'tiled', domain: dom.domain, field: isField ? { Rt: R.x, h: (R.x - 1) / 2 } : null, domainIgnored: dom.ignored, c0, v1, v2, det };
}

function _netWarpAxis(f, alt, s) {
    const k = Math.floor(s), l = s - k;
    return (alt && (k & 1)) ? k + 1 - f(1 - l) : k + f(l);
}

// The warp for the base sheet as drawTessellation() uses it: square shapes only in Phase 1.
// Task 088: the triangle sheet's Field. The frame is the lattice parallelogram of the triangle grid (v1 = C - B, v2 = C - A; a mesh = a rhombus of two triangles, E1 x E2 = X x Y meshes, W = 2 X Y triangles),
// its base mesh c0 = centroid - 2/3 (v1 + v2) (the mesh that holds the base triangle). The Field is the SMALLEST odd (Rx, Ry) >= (X, Y), <= 21, whose parallelogram (centred on the base mesh) covers the whole
// canvas: its edge meshes are cut by the canvas edge. The law runs over Rx x Ry meshes, so every mesh is an affine copy and nothing kinks inside a mesh. Only a Field applies to the triangle (no Single / Tiled).
function _netTriangleField(spec, corners, Rt) {
    const dom = netDomainEffective(spec, Rt, 'triangle');
    if (dom.domain !== 'field' || !corners || corners.length !== 3) return null;   // a triangle sheet has exactly 3 outer corners
    const A = corners[0], B = corners[1], C = corners[2], v1 = { x: C.x - B.x, y: C.y - B.y }, v2 = { x: C.x - A.x, y: C.y - A.y };
    const cen = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 }, det = v1.x * v2.y - v2.x * v1.y;
    if (!det) return null;
    const base = { c0: { x: cen.x - (2 / 3) * (v1.x + v2.x), y: cen.y - (2 / 3) * (v1.y + v2.y) }, v1, v2 };
    const R = _netRt(Rt), W = typeof canvasW !== 'undefined' ? canvasW : 600, H = typeof canvasH !== 'undefined' ? canvasH : 600;
    const tc = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }].map(p => { const dx = p.x - base.c0.x, dy = p.y - base.c0.y; return { s: (dx * v2.y - dy * v2.x) / det, t: (v1.x * dy - v1.y * dx) / det }; });
    const covers = (Rx, Ry) => { const hx = (Rx - 1) / 2, hy = (Ry - 1) / 2; return tc.every(c => c.s >= -hx - 1e-9 && c.s <= Rx - hx + 1e-9 && c.t >= -hy - 1e-9 && c.t <= Ry - hy + 1e-9); };
    let best = null;
    for (let Rx = R.x | 1; Rx <= 21; Rx += 2) for (let Ry = R.y | 1; Ry <= 21; Ry += 2)   /* task 108: start at the next ODD count (an even X would give an even Rx and a half-integer hx) */ { if (best && Rx * Ry >= best.n) continue; if (covers(Rx, Ry)) best = { n: Rx * Ry, Rx, Ry }; }
    if (!best) best = { Rx: 21, Ry: 21 };
    const ax = spec.x, ay = spec.y === 'same' ? spec.x : spec.y, fx = netFieldLaw(ax, best.Rx), fy = netFieldLaw(ay, best.Ry);
    if (!fx && !fy && !spec.keep) return null;
    const hx = (best.Rx - 1) / 2, hy = (best.Ry - 1) / 2;
    const fc0 = { x: base.c0.x - hx * v1.x - hy * v2.x, y: base.c0.y - hx * v1.y - hy * v2.y }, fv1 = { x: best.Rx * v1.x, y: best.Rx * v1.y }, fv2 = { x: best.Ry * v2.x, y: best.Ry * v2.y };
    return { fx, fy, altX: false, altY: false, repeat: false, domain: 'field', field: { Rt: 1, h: 0, Rx: best.Rx, Ry: best.Ry, hx, hy }, meshes: { x: best.Rx, y: best.Ry }, frame: { c0: base.c0, v1, v2, det }, domainIgnored: null, c0: fc0, v1: fv1, v2: fv2, det: fv1.x * fv2.y - fv2.x * fv1.y };
}
// Task 089: the hexagon sheet's Field. *N = triangle net with lines left out: the App counts X x Y hexagons, a hexagon = 3 rhombus meshes of the FINE lattice (E1 x E2 = 3 X Y), f1 = (v1 + v2) / 3, f2 = (2 v2 - v1) / 3
// (v1 = c2 - c0, v2 = c4 - c0 of the hexagon's corners). Every hexagon corner is a node of that lattice anchored at the centroid. The base mesh starts at the centroid; the Field is the smallest odd (Rx, Ry) >= 3 (<= 27)
// whose parallelogram, centred on the base mesh, contains the four canvas corners, so its edge meshes are cut by the canvas edge. A hexagon crosses mesh boundaries: task 090 splits the base faces
// at those boundaries once (netWarpRefineFaces, called from computeCellFaces), so the per-vertex image is exact; layers and the morph (a `sheet` is given) stay refused.
function _netHexField(spec, corners, Rt) {
    const dom = netDomainEffective(spec, Rt, 'hex');
    if (dom.domain !== 'field' || !corners || corners.length !== 6) return null;   // a hexagon sheet has exactly 6 outer corners
    const v1 = { x: corners[2].x - corners[0].x, y: corners[2].y - corners[0].y }, v2 = { x: corners[4].x - corners[0].x, y: corners[4].y - corners[0].y };
    const f1 = { x: (v1.x + v2.x) / 3, y: (v1.y + v2.y) / 3 }, f2 = { x: (2 * v2.x - v1.x) / 3, y: (2 * v2.y - v1.y) / 3 }, det = f1.x * f2.y - f2.x * f1.y;
    if (!det) return null;
    const cen = { x: corners.reduce((a, p) => a + p.x, 0) / 6, y: corners.reduce((a, p) => a + p.y, 0) / 6 };
    const W = typeof canvasW !== 'undefined' ? canvasW : 600, H = typeof canvasH !== 'undefined' ? canvasH : 600;
    const tc = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }].map(p => { const dx = p.x - cen.x, dy = p.y - cen.y; return { s: (dx * f2.y - dy * f2.x) / det, t: (f1.x * dy - f1.y * dx) / det }; });
    let best = null;
    for (let Rx = 3; Rx <= 27; Rx += 2) for (let Ry = 3; Ry <= 27; Ry += 2) {
        if (best && Rx * Ry >= best.n) continue;
        const hx = (Rx - 1) / 2, hy = (Ry - 1) / 2;
        if (tc.every(c => c.s >= -hx - 1e-9 && c.s <= Rx - hx + 1e-9 && c.t >= -hy - 1e-9 && c.t <= Ry - hy + 1e-9)) best = { n: Rx * Ry, Rx, Ry };
    }
    if (!best) return null;   // no Field up to 27 x 27 covers the canvas: read as no net (never the case for the sizes 3..9)
    const ax = spec.x, ay = spec.y === 'same' ? spec.x : spec.y, fx = netFieldLaw(ax, best.Rx), fy = netFieldLaw(ay, best.Ry);
    if (!fx && !fy && !spec.keep) return null;
    const hx = (best.Rx - 1) / 2, hy = (best.Ry - 1) / 2;
    const fc0 = { x: cen.x - hx * f1.x - hy * f2.x, y: cen.y - hx * f1.y - hy * f2.y }, fv1 = { x: best.Rx * f1.x, y: best.Rx * f1.y }, fv2 = { x: best.Ry * f2.x, y: best.Ry * f2.y };
    return { fx, fy, altX: false, altY: false, repeat: false, domain: 'field', field: { Rt: 1, h: 0, Rx: best.Rx, Ry: best.Ry, hx, hy }, meshes: { x: best.Rx, y: best.Ry, facesPiecewise: true }, refineFaces: true, frame: { c0: cen, v1: f1, v2: f2, det }, domainIgnored: null, c0: fc0, v1: fv1, v2: fv2, det: fv1.x * fv2.y - fv2.x * fv1.y };
}
function netWarpForBase(spec, shape, corners, nodeCountValue, Rt) {
    if (spec && spec.kind === 'projective') {   // task 121: the square; task 124 (3C-2): the triangle (frame of _netTriangleField); task 127 (3C-4): the hexagon (frame of _netHexField); a family that does not fit the shape builds nothing
        if (!netProjectiveEffective(spec, shape).valid) return null;
        spec = netProjectiveForShape(spec, shape);
        if (shape === 'square' && corners && corners.length >= 4) return makeNetWarp(spec, { c0: corners[0], v1: { x: corners[1].x - corners[0].x, y: corners[1].y - corners[0].y }, v2: { x: corners[3].x - corners[0].x, y: corners[3].y - corners[0].y } }, -1, Rt);
        if (shape === 'triangle' && corners && corners.length === 3) { const A = corners[0], B = corners[1], C = corners[2]; return makeNetWarp(spec, { c0: { x: A.x + B.x - C.x, y: A.y + B.y - C.y }, v1: { x: C.x - B.x, y: C.y - B.y }, v2: { x: C.x - A.x, y: C.y - A.y } }, -1, Rt); }
        if (shape === 'hex' && corners && corners.length === 6) {   // task 127 (3C-4): the hexagon: the fine lattice of _netHexField (f1 = (v1 + v2) / 3, f2 = (2 v2 - v1) / 3, anchored at the centroid) is the triangle lattice (p, q) = (s, t)
            const v1 = { x: corners[2].x - corners[0].x, y: corners[2].y - corners[0].y }, v2 = { x: corners[4].x - corners[0].x, y: corners[4].y - corners[0].y };
            const cen = { x: corners.reduce((a, q) => a + q.x, 0) / 6, y: corners.reduce((a, q) => a + q.y, 0) / 6 };
            return makeNetWarp(spec, { c0: cen, v1: { x: (v1.x + v2.x) / 3, y: (v1.y + v2.y) / 3 }, v2: { x: (2 * v2.x - v1.x) / 3, y: (2 * v2.y - v1.y) / 3 } }, -1, Rt);
        }
        return null;
    }
    if (spec && shape === 'hex') return _netHexField(spec, corners, Rt);
    if (spec && shape === 'triangle') return _netTriangleField(spec, corners, Rt);
    if (!spec || shape !== 'square' || !corners || corners.length < 4) return null;
    const c0 = corners[0], c1 = corners[1], c3 = corners[3];
    // legacy signature (c = the legacy count): E comes from the one producer, getGridDivisions (an invalid c gives no warp, as c - 1 < 1 did)
    const E = Number.isInteger(nodeCountValue) && nodeCountValue >= 1 ? getGridDivisions(fromLegacy(shape, nodeCountValue)) : -1;
    return makeNetWarp(spec, { c0, v1: { x: c1.x - c0.x, y: c1.y - c0.y }, v2: { x: c3.x - c0.x, y: c3.y - c0.y } }, E, Rt);
}

// Task 086: the BASE tile's frame {c0, v1, v2, det} (a Rx x Ry field keeps it in warp.frame, see makeNetWarp) and a field's half-extents [hx, hy].
function _netFrame(warp) { return warp.frame || warp; }
function _netFieldH(warp) { const f = warp.field; return f.Rx !== undefined ? [f.hx, f.hy] : [f.h, f.h]; }
// Task 105: tiles right / above the base tile per axis (= hx, hy on an odd axis) and the picture shift T (regular-space vector, null without an even axis).
function _netFieldHi(warp) { const f = warp.field; return f.hix !== undefined ? [f.hix, f.hiy] : _netFieldH(warp); }
function _netShiftVec(warp) { return warp.shiftVec || null; }   // set by makeNetWarp for an even axis only (one property read on the hot path of applyNetWarp: an odd warp carries no such key)
// the regular-space reading of an IMAGE-space point (the picture is F(p + T)): the point minus T (a plain copy without a shift)
function _netBackShift(warp, pt) { const T = _netShiftVec(warp); return T ? { x: pt.x - T.x, y: pt.y - T.y } : pt; }
// Tile coordinates (s,t) of a point in the warp's frame: (0..1, 0..1) is the net's own tile.
function netWarpTileCoords(warp, pt) {
    const F = _netFrame(warp), dx = pt.x - F.c0.x, dy = pt.y - F.c0.y;
    return { s: (dx * F.v2.y - dy * F.v2.x) / F.det, t: (F.v1.x * dy - F.v1.y * dx) / F.det };
}
// Whether a warp is a CLOSED net (one tile, no repetition) and whether a point lies inside it.
function netWarpIsClosed(warp) { return !!warp && !warp.repeat; }
function netWarpInsideNet(warp, pt) {
    if (warp.projective) return _netProjInside(warp, pt);
    const c = netWarpTileCoords(warp, warp.field ? _netBackShift(warp, pt) : pt);   // pt is an image-space point (a click)
    if (warp.field) { const [hx, hy] = _netFieldH(warp), [ux, uy] = _netFieldHi(warp); return c.s >= -hx && c.s <= ux + 1 && c.t >= -hy && c.t <= uy + 1; } // the whole field
    return c.s >= 0 && c.s <= 1 && c.t >= 0 && c.t <= 1;
}

function applyNetWarp(warp, pt) {
    if (warp.projective) return _netProjApply(warp, pt);   // task 121
    const W = _netFrame(warp);
    const dx = pt.x - W.c0.x, dy = pt.y - W.c0.y;
    const s = (dx * W.v2.y - dy * W.v2.x) / W.det;
    const t = (W.v1.x * dy - W.v1.y * dx) / W.det;
    let x = pt.x, y = pt.y;
    if (warp.field) { // Model 2: one law over the whole field (sigma = tile coordinate + h per axis), affine inside each tile
        const [hx, hy] = _netFieldH(warp), T = warp.shiftVec;
        if (T) { x += T.x; y += T.y; }   // task 105: the picture of an even axis is moved by e/2 (once, here)
        if (warp.fx) { const d = warp.fx(s + hx) - hx - s; x += d * W.v1.x; y += d * W.v1.y; }
        if (warp.fy) { const d = warp.fy(t + hy) - hy - t; x += d * W.v2.x; y += d * W.v2.y; }
        return { x, y };
    }
    if (warp.fx) { const d = _netWarpAxis(warp.fx, warp.altX, s) - s; x += d * warp.v1.x; y += d * warp.v1.y; }
    if (warp.fy) { const d = _netWarpAxis(warp.fy, warp.altY, t) - t; x += d * warp.v2.x; y += d * warp.v2.y; }
    return { x, y };
}

// ---- Net animation (Stage 1: same-family lerp of the continuous parameters) ----
// The author spec (baseNetTransform) is what the controls edit; the frame that is DRAWN, hit-tested, overlaid and exported is
// netTransformNow(): the author spec, or - while the animation is `live` - the lerp of its captured Start and End at progress
// `t`. It is computed on demand and never written back (the Stage-A layer animation once overwrote the edited state on every
// redraw; here the two are separate values by construction).
// What can be animated: the continuous parameters w (strength; sinus <-> tangens passes through w = 0, the exact regular net) and
// focus, per axis. What cannot - refused at Set Start / Set End, visibly: a different domain (Single / Tiled / Field: different
// geometry), different macro cells, a different `alternate`, a different law FAMILY on an axis (trig vs geometric). A regular
// axis (uniform or w = 0) counts as w = 0 of the other side's family, and a regular net (no spec) is compatible with any domain.
function _netAnimNorm(spec) {
    if (!spec || spec.regular) return { x: { kind: 'uniform', w: 0 }, y: { kind: 'uniform', w: 0 }, ysame: true, any: true, dom: null, macro: null };   // {regular: true} = a captured regular net
    const ax = spec.x || { kind: 'uniform', w: 0 }, ysame = spec.y === 'same' || !spec.y;
    return { x: ax, y: ysame ? ax : spec.y, ysame, any: false, dom: spec.domain === 'field' ? 'field' : (spec.repeat ? 'tiled' : 'single'), macro: spec.macro === undefined || spec.macro === null ? null : spec.macro, repeat: !!spec.repeat, domain: spec.domain };
}
function _netAnimFamily(a) { return (!a || a.kind === 'uniform' || !a.w) ? null : a.kind; }
function netAnimationCompat(from, to) {
    if (_netIsProjective(from) || _netIsProjective(to)) return _netProjCompat(from, to);   // task 121
    const A = _netAnimNorm(from), B = _netAnimNorm(to);
    if (!A.any && !B.any && A.dom !== B.dom) return { ok: false, reason: `the domain differs (${A.dom} vs ${B.dom}) - a different geometry cannot be interpolated` };
    const dom = A.any ? B.dom : A.dom;
    // task 106: at an even size of the square a Field moves the picture by half a tile against a Regular net (a captured {regular: true}), so the two cannot be interpolated (a jump at t = 0+); Field <-> Field is fine
    if (dom === 'field' && A.any !== B.any && typeof currentShape !== 'undefined' && currentShape === 'square' && typeof netSizeFactors === 'function') {
        const Rs = netSizeFactors();
        if ((Rs.x % 2 === 0 || Rs.y % 2 === 0) && netDomainEffective({ domain: 'field' }, Rs, 'square').ignored === null) return { ok: false, reason: 'at an even size a Field moves the picture by half a tile against a Regular net, so the two cannot be interpolated' };
    }
    if (dom !== 'field' && !A.any && !B.any && A.macro !== B.macro) return { ok: false, reason: `the macro cells differ (${A.macro === null ? 'none' : A.macro} vs ${B.macro === null ? 'none' : B.macro})` };
    for (const axis of ['x', 'y']) {
        const fa = _netAnimFamily(A[axis]), fb = _netAnimFamily(B[axis]);
        if (fa && fb && fa !== fb) return { ok: false, reason: `the law family differs on the ${axis.toUpperCase()} axis (${fa} vs ${fb})` };
        if (fa && fb && !!A[axis].alternate !== !!B[axis].alternate) return { ok: false, reason: `Alternate tiles differs on the ${axis.toUpperCase()} axis` };
    }
    return { ok: true, reason: null };
}
function netLerpSpecs(from, to, t) {
    if (!netAnimationCompat(from, to).ok) return null;
    if (_netIsProjective(from)) return Object.assign({ kind: 'projective', a: (1 - t) * from.a + t * to.a, b: (1 - t) * from.b + t * to.b, format: from.format, family: from.family, interp: true }, from.family === '*N' ? { cls: from.cls | 0 } : {});   // task 121: a, b real in between; task 127: the hexagon family keeps its class
    const A = _netAnimNorm(from), B = _netAnimNorm(to), base = A.any ? B : A;
    const lerp = (a, b) => (1 - t) * a + t * b;   // exactly a at t = 0 and exactly b at t = 1
    const axis = (a, b) => {
        const fam = _netAnimFamily(a) || _netAnimFamily(b);
        if (!fam) return { kind: 'uniform', w: 0 };
        const wa = _netAnimFamily(a) ? a.w : 0, wb = _netAnimFamily(b) ? b.w : 0, out = { kind: fam, w: lerp(wa, wb) };
        if (fam === 'trig') { const fa = _netAnimFamily(a) ? (a.focus || 0) : 0, fb = _netAnimFamily(b) ? (b.focus || 0) : 0, f = lerp(fa, fb); if (f) out.focus = f; }
        const alt = _netAnimFamily(a) ? a : b; if (alt.alternate) out.alternate = true;
        return out;
    };
    const x = axis(A.x, B.x), y = (A.ysame && B.ysame) ? 'same' : axis(A.y, B.y);
    const spec = { x, y, repeat: base.any ? false : base.repeat, keep: true };
    if (!base.any && base.domain === 'field') spec.domain = 'field';
    if (!base.any && base.macro !== null && base.dom !== 'field') spec.macro = base.macro;
    return spec;
}
// ---- Timeline-coupled net (Case B1): the net follows the layer-keyframe Timeline's own clock ----
// timeline.netStates is parallel to timeline.keyframeLayerIds: one captured net (a spec, {regular: true}, or null = none) PER KEYFRAME,
// so segment k lerps netStates[k] -> netStates[k+1] with the same localT as the pattern morph, and two neighbouring segments share
// their boundary state (the net cannot jump where the pattern does not). The coupling is active only with >= 2 keyframes and a state
// at EVERY keyframe; otherwise the net is not driven (the author net shows) and the Timeline status says which keyframe lacks one.
// Reads timeline.currentFrame = {segmentIndex, localT} (written by sketch.js's applyTimelineFrame()), like playbackCrossfadeColors().
// A snapshot of the AUTHOR net for capture: a clone of the spec, or {regular: true} for a regular net.
function netSpecSnapshot() {
    if (!baseNetTransform) return { regular: true };
    const spec = JSON.parse(JSON.stringify(baseNetTransform));
    return (_netIsProjective(spec) && typeof currentShape !== 'undefined') ? netProjectiveForShape(spec, currentShape) : spec;   // task 127: the family follows the shape: a spec written before a shape change is captured with the family it is DRAWN with (else a valid pair is refused with "family differs")
}
function timelineNetCoupled() {
    const tl = timeline;
    return !!(tl && tl.netStates && tl.keyframeLayerIds.length >= 2 && tl.netStates.length === tl.keyframeLayerIds.length && tl.netStates.every(s => !!s));
}
// {spec, reason}: the lerp of the current segment's two captured nets, or why there is none (an incompatible neighbouring pair, e.g.
// after an inner keyframe was removed) - the caller then shows the author net and says why.
function timelineNetSegment() {
    if (!timelineNetCoupled() || !timeline.currentFrame) return { spec: null, reason: null };
    const { segmentIndex, localT } = timeline.currentFrame, A = timeline.netStates[segmentIndex], B = timeline.netStates[segmentIndex + 1];
    if (!A || !B) return { spec: null, reason: null };
    const c = netAnimationCompat(A, B);
    if (!c.ok) return { spec: null, reason: `the net states of keyframes ${segmentIndex + 1} and ${segmentIndex + 2} cannot be interpolated: ${c.reason}` };
    return { spec: netLerpSpecs(A, B, localT), reason: null };
}
// Which keyframes lack a net state (1-based), for the Timeline status; [] when none do (or there are no states at all).
function timelineNetMissing() {
    const tl = timeline;
    if (!tl || !tl.netStates || !tl.netStates.some(s => !!s)) return [];
    return tl.keyframeLayerIds.map((_, i) => (tl.netStates[i] ? 0 : i + 1)).filter(Boolean);
}
// The net that is in force RIGHT NOW. Priority: the Timeline (coupled: its live frame, else the author net - the standalone
// animation is locked out while coupled), then the standalone animation's live frame, then the author spec (see the blocks above).
function netTransformNow() {
    if (timelineNetCoupled()) {
        if (!timeline.netLive) return baseNetTransform;
        return timelineNetSegment().spec || baseNetTransform;
    }
    // The standalone animation branch: kept and tested but with no UI entry point any more (see sketch.js "NET ANIMATION"); baseNetAnimation stays null,
    // so this falls through to the author net.
    const a = baseNetAnimation;
    if (!a || !a.live || !a.from || !a.to) return baseNetTransform;
    return netLerpSpecs(a.from, a.to, a.t || 0) || baseNetTransform;
}
// Whether the AUTHOR net is a real warp right now (a Regular net, or a shape the warp does not apply to, is not).
// Task 086: the tile counts the net reads: {x, y} from netSizeFactors() (core/state.js, the one source); sandboxes without core/state.js read shapeSizeFactor as before.
function _netSize() { return typeof netSizeFactors === 'function' ? netSizeFactors() : { x: shapeSizeFactor, y: shapeSizeFactor }; }
function netAuthorWarpActive() { return !!(baseNetTransform && netWarpForBase(baseNetTransform, currentShape, outerCorners, nodeCount, _netSize())); }
// "Include net" on Add to Timeline: `override` = null (automatic) or true/false (chosen by the person). Automatic = ON exactly when a net warp
// is active at that moment. The toggle flips the shown value; choosing the automatic value again returns to automatic.
function timelineIncludeNetValue(override) { return override === null || override === undefined ? netAuthorWarpActive() : !!override; }
function timelineIncludeNetToggle(override) { const next = !timelineIncludeNetValue(override); return next === netAuthorWarpActive() ? null : next; }
// The state of the Timeline's net, for the persistent indicator: {state, text}, or null without a timeline.
//   none / partial / incompatible (orange or red: the net is NOT animated), pending (waiting for a second keyframe), constant (informational:
//   every pair of keyframes has the same net), animated (green).
function timelineNetSummary() {
    const tl = timeline;
    if (!tl || !tl.keyframeLayerIds.length) return null;
    const n = tl.keyframeLayerIds.length, st = tl.netStates || [];
    const missing = tl.keyframeLayerIds.map((_, i) => (st[i] ? 0 : i + 1)).filter(Boolean);
    if (missing.length === n) return { state: 'none', text: 'Net NOT animated: no keyframe has a net captured. Turn on "Include net" when adding a keyframe, or use the "Net" button on a keyframe.' };
    if (missing.length) return { state: 'partial', text: `Net NOT animated: keyframe${missing.length > 1 ? 's' : ''} ${missing.join(', ')} ${missing.length > 1 ? 'have' : 'has'} no net captured. Use ${missing.length > 1 ? 'their' : 'its'} "Net" button.` };
    if (n < 2) return { state: 'pending', text: 'Net captured. Add a second keyframe with a net to animate it.' };
    let constant = true;
    for (let k = 0; k + 1 < n; k++) {
        const c = netAnimationCompat(st[k], st[k + 1]);
        if (!c.ok) return { state: 'incompatible', text: `Net NOT animated between keyframes ${k + 1} and ${k + 2}: ${c.reason}. The author net is shown there.` };
        if (JSON.stringify(netLerpSpecs(st[k], st[k + 1], 0)) !== JSON.stringify(netLerpSpecs(st[k], st[k + 1], 1))) constant = false;
    }
    if (constant) return { state: 'constant', text: 'Net constant: every keyframe has the same net, so it does not change. Capture a different net on a keyframe to animate it.' };
    return { state: 'animated', text: `Net animated with the timeline (${n} keyframes).` };
}
// meta.netTransform.animationFrame & co. for the export: null when the drawn net is the author net.
function netAnimationExportInfo() {
    if (timelineNetCoupled() && timeline.netLive && timelineNetSegment().spec && timeline.currentFrame) {
        const total = timeline.segmentDurationsMs.reduce((x, y) => x + y, 0);
        return { animationFrame: total > 0 ? timeline.elapsedMs / total : 0, animationSource: 'timeline', segmentIndex: timeline.currentFrame.segmentIndex, localT: timeline.currentFrame.localT };
    }
    if (!timelineNetCoupled() && baseNetAnimation && baseNetAnimation.live && baseNetAnimation.from && baseNetAnimation.to) return { animationFrame: baseNetAnimation.t || 0 };
    return null;
}

// ---- Exact images of straight segments under a FIELD warp ----
// F is piecewise affine on a field: its kinks lie on the tile-boundary lines s = k / t = k of the base frame (integer tile
// coordinates, k = -h+1 .. h; beyond the field's edge tiles F continues with the edge slope and has no further kink). A
// segment that stays inside one base tile maps to a straight chord EXACTLY; one that crosses a boundary maps to a POLYLINE
// whose vertices are the images of the crossing points, so drawing the single chord between the mapped endpoints is off by
// up to a third of a tile (measured: 15.2 px on a 120 px tile). Base-sheet segments never cross (each copy stays in its own
// tile), only layers - offset, rotated or scaled - do. Returns null when nothing needs splitting (not a field, or no crossing:
// the caller keeps its single chord, byte-identical to before), else the REGULAR-space points [p1, ...crossings, p2] in order.
// A crossing counts only when the segment lies strictly on both sides of the line (1e-9 of a tile): a segment along or merely
// touching a boundary is not split. A corner (s and t both integers at one point) yields one point.
function netWarpSplitSegment(warp, p1, p2) {
    if (!warp || !warp.field) return null;
    if (warp.projective) return _netProjCut(warp, p1, p2);   // task 121: the exact cut with the net's region ([] = outside), not a tile split
    const a = netWarpTileCoords(warp, p1), b = netWarpTileCoords(warp, p2), [hx, hy] = _netFieldH(warp), ux = warp.field.hix === undefined ? hx : warp.field.hix, uy = warp.field.hiy === undefined ? hy : warp.field.hiy, EPS = 1e-9, ts = [];
    const axis = (u0, u1, law, h, up) => {   // p1, p2 are REGULAR points (no shift): the inner tile boundaries are k = -h + 1 .. up
        if (!law) return;
        const lo = Math.min(u0, u1), hi = Math.max(u0, u1);
        for (let k = Math.max(-h + 1, Math.floor(lo)); k <= Math.min(up, Math.ceil(hi)); k++) if (lo < k - EPS && hi > k + EPS) ts.push((k - u0) / (u1 - u0));
    };
    axis(a.s, b.s, warp.fx, hx, ux); axis(a.t, b.t, warp.fy, hy, uy);
    if (!ts.length) return null;
    ts.sort((x, y) => x - y);
    const pts = [p1];
    ts.forEach((t, i) => { if (i === 0 || t - ts[i - 1] > 1e-12) pts.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }); });
    pts.push(p2);
    return pts;
}

// ---- Phase 2: the live base warp, its inverse, and the export description ----

// The ready warp for the CURRENT base sheet (null = regular net or a shape the warp does not apply
// to). Unlike activeNetWarp - installed only for the duration of one drawTessellation() - this is
// what UI code, face detection and export use to ask "is a warp in force right now".
function netWarpBaseNow() { const spec = netTransformNow(); return spec ? netWarpForBase(spec, currentShape, outerCorners, nodeCount, _netSize()) : null; }
function netWarpActive() { return netWarpBaseNow() !== null; }
// Whether face detection/fills are refused for a sheet under the CURRENT warp: on a FIELD the base sheet's faces are exact
// (F is affine inside every tile: faces are detected once on the regular cell, then mapped per tile). A LAYER (`sheet` given) is
// exact only when its grid IS the base's (sheet.gridMatchesBase: same shape and size, offset 0, rotation 0 - every timeline
// playback layer): its segments never leave a base tile. Any other layer (offset/rotated/other size) crosses tile boundaries and
// stays refused; every other warp (Single, Tiled: F smooth inside the tile) refuses all faces. Task 113: this holds for the hexagon Field too (until then a hexagon Field refused EVERY layer sheet, `refineFaces && !morphRefine`, a
// scope decision of tasks 090 / 091, not a measured obstacle: reports/112.md); the refinement netWarpRefineFaces() runs at the end of computeCellFaces() for any sheet, and a base-grid layer shares the base's mesh frame.
function netWarpBlocksFaces(sheet) { const w = netWarpBaseNow(); return w !== null && (!w.field || (!!sheet && !sheet.gridMatchesBase)); }

// F^-1: the regular-space point whose image under the warp is `pt` (each axis law is strictly
// increasing on [0,1], so a bisection per axis finds it; tiles are located by floor as in
// applyNetWarp()). Used to create a free endpoint at the position that was clicked: a stored free
// node is a REGULAR-space point and is drawn through F like every other node.
function _netWarpAxisInverse(f, alt, sOut) {
    const k = Math.floor(sOut), l = sOut - k;
    const flip = alt && (k & 1);
    const target = flip ? 1 - l : l;
    let li;
    if (f.pl) {
        // nested law: piecewise linear, so the inverse is closed form per macro segment - find the segment
        // whose macro samples bracket the target, then invert the line (no iteration, no evaluation of f)
        const { M, Em } = f.pl;
        let lo = 0, hi = Em - 1;
        while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (M[mid] <= target) lo = mid; else hi = mid - 1; }
        const seg = M[lo + 1] - M[lo];
        li = (lo + (seg > 0 ? (target - M[lo]) / seg : 0)) / Em;
    } else {
        let lo = 0, hi = 1;
        for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) < target) lo = mid; else hi = mid; }
        li = (lo + hi) / 2;
    }
    return k + (flip ? 1 - li : li);
}
function invertNetWarp(warp, pt) {
    if (warp.projective) return _netProjInvert(warp, pt);   // task 121
    if (warp.field) pt = _netBackShift(warp, pt);   // task 105: pt is an image-space point; the picture is F(p + T), so T goes first (once, here)
    const W = _netFrame(warp);
    const dx = pt.x - W.c0.x, dy = pt.y - W.c0.y;
    const s = (dx * W.v2.y - dy * W.v2.x) / W.det;
    const t = (W.v1.x * dy - W.v1.y * dx) / W.det;
    let x = pt.x, y = pt.y;
    if (warp.field) { // closed form per tile of the field law
        const [hx, hy] = _netFieldH(warp);
        if (warp.fx) { const d = _netFieldAxisInverse(warp.fx, s, hx) - s; x += d * W.v1.x; y += d * W.v1.y; }
        if (warp.fy) { const d = _netFieldAxisInverse(warp.fy, t, hy) - t; x += d * W.v2.x; y += d * W.v2.y; }
        return { x, y };
    }
    if (warp.fx) { const d = _netWarpAxisInverse(warp.fx, warp.altX, s) - s; x += d * warp.v1.x; y += d * warp.v1.y; }
    if (warp.fy) { const d = _netWarpAxisInverse(warp.fy, warp.altY, t) - t; x += d * warp.v2.x; y += d * warp.v2.y; }
    return { x, y };
}

// Free endpoint on a FIELD (option b): a click anywhere inside the field is mapped back, through the closed-form
// inverse, into the CENTRAL tile's own coordinates - the node is then drawn as a scaled copy in every tile, like the
// rest of the clicked pattern. Returns the regular-space position inside the central tile plus which tile was
// clicked, or null (not a field, or outside it: nothing to attach to).
function netWarpFieldLocal(warp, pt) {
    if (!warp || !warp.field || !netWarpInsideNet(warp, pt)) return null;
    if (warp.projective) return _netProjLocal(warp, pt);   // task 121
    const [hx, hy] = _netFieldH(warp), [ux, uy] = _netFieldHi(warp), W = _netFrame(warp), c = netWarpTileCoords(warp, _netBackShift(warp, pt));   // pt: an image-space click (task 105: minus T)
    const sr = warp.fx ? _netFieldAxisInverse(warp.fx, c.s, hx) : c.s, tr = warp.fy ? _netFieldAxisInverse(warp.fy, c.t, hy) : c.t;
    let i = Math.floor(sr), j = Math.floor(tr);
    if (i > ux) i = ux; if (j > uy) j = uy; if (i < -hx) i = -hx; if (j < -hy) j = -hy;   // a click exactly on the field's far edge
    const l = sr - i, m = tr - j;
    return { x: W.c0.x + l * W.v1.x + m * W.v2.x, y: W.c0.y + l * W.v1.y + m * W.v2.y, tile: { i, j }, local: { l, m } };
}

// meta.netTransform (export): the warp fully described, so the warped IMAGE is reproducible from
// the JSON. geometry.nodes/edges stay REGULAR (topology; SpaceHarmony's importer reads only those),
// hence geometryIsRegular; faces are not exported on a warped net (facesOmitted) - same "refuse
// visibly rather than export stale data" rule as the curve case, but flagged instead of silent.
// Resolved per axis (y 'same' expanded); `a` (trig angle, radians) and `R`/`q` (geometric) are
// derived values, written so a reader need not know the constants.
function isFieldOf(spec, Rt, shape) { return netDomainEffective(spec, Rt, shape).domain === 'field'; }
function netTransformExportData(spec, E, Rt, meshes, shape) {   // task 106: shape = the sheet's shape (core/export.js passes currentShape); without it the conservative rule applies
    if (spec && spec.kind === 'projective') return _netProjExportData(spec, shape);   // task 121: version 2
    const ax = spec.x, ay = spec.y === 'same' ? spec.x : spec.y;
    const R = isFieldOf(spec, Rt, shape) ? _netRt(Rt) : null;
    const describe = (axis, Rax) => {
        if (!axis || axis.kind === 'uniform' || !axis.w) return { kind: 'uniform' };
        if (axis.kind === 'trig') {
            const w = Math.max(-1, Math.min(1, axis.w));
            const c = netFocusOf(axis), a0 = w < 0 ? -w * NETWARP_A_SIN : w * NETWARP_A_TAN;
            // focus only when set (an axis without one exports exactly as before); `a` is the ANGLE USED (rescaled by 1/(1+|c|) under a focus)
            return c === 0 ? { kind: 'trig', law: w < 0 ? 'sinus' : 'tangens', w, a: a0 } : { kind: 'trig', law: w < 0 ? 'sinus' : 'tangens', w, focus: c, a: a0 / (1 + Math.abs(c)), alternate: !isField && !!axis.alternate };
        }
        // q is per MACRO cell (Em = E when not nested; the tile count Rt in a field)
        const qCount = isField ? Rax : eff.macro;
        return { kind: 'geometric', w: axis.w, R: Math.exp(axis.w), q: qCount >= 2 ? Math.exp(axis.w / (qCount - 1)) : null, alternate: !isField && !!axis.alternate };
    };
    const dom = netDomainEffective(spec, Rt, shape), isField = dom.domain === 'field';
    const eff = isField ? { macro: E, micro: 1, valid: true } : netMacroEffective(spec.macro, E);
    const result = {
        version: 1, interpretation: true, domain: dom.domain === 'tiled' ? 'per-tile' : dom.domain, repeat: dom.domain === 'tiled', E, macro: eff.macro, micro: eff.micro,
        x: describe(ax, R && R.x), y: describe(ay, R && R.y),
        constants: { A_SIN: NETWARP_A_SIN, A_TAN: NETWARP_A_TAN },
        geometryIsRegular: true, facesOmitted: true
    };
    if (spec.macro !== undefined && spec.macro !== null && !eff.valid) result.macroIgnored = { requested: spec.macro, reason: eff.reason };
    if (isField) {
        // Faces: exact on a field (affine per tile) - the BASE faces are exported in regular central-cell coordinates, the space of
        // geometry.nodes/edges; layers stay omitted (offset layers cross tile boundaries).
        result.facesOmitted = false; result.layerFacesOmitted = true;
        result.facesMapping = meshes && meshes.facesPiecewise ? 'regular central cell; a face crosses mesh boundaries: its image in a tile is the polygon with its edges split at the mesh boundaries (the lines of tileBoundaries), each piece under the affine map of its mesh' : 'regular central cell; each tile is the image under the per-tile affine map given by tileBoundaries';   // task 090: hexagon
        if (shape === 'square' && (R.x % 2 === 0 || R.y % 2 === 0)) {   // task 108: the square only (the triangle's even sizes have no shift); task 105 (only an even axis, i.e. only with netFieldEven): where the base tile sits in the field and by how many px the picture is moved against the plain grid; nothing else reads these
            const lo = n => Math.floor(n / 2), e = typeof GRID_SHORT_SIDE !== 'undefined' ? GRID_SHORT_SIDE / Math.min(R.x, R.y) : null;
            result.fieldBase = { x: { lo: lo(R.x), hi: R.x - 1 - lo(R.x) }, y: { lo: lo(R.y), hi: R.y - 1 - lo(R.y) } };
            if (e !== null) result.gridShiftPx = { x: R.x % 2 === 0 ? e / 2 : 0, y: R.y % 2 === 0 ? e / 2 : 0 };
        }
        result.fieldTiles = R.x === R.y ? R.x : { x: R.x, y: R.y };   // the outer tile count = the number of macro cells per axis (one number for X = Y)
        if (meshes) result.fieldMeshes = { x: meshes.x, y: meshes.y };   // task 088 (triangle): the meshes the law really runs over (the Field covers the canvas, edge meshes cut)
        const ay = spec.y === 'same' ? spec.x : spec.y, bounds = (axis, n) => { const f = netFieldLaw(axis, n); return Array.from({ length: n + 1 }, (_, k) => f ? f.field.P[k] : k); };
        result.tileBoundaries = { unit: 'tiles', x: bounds(spec.x, meshes ? meshes.x : R.x), y: bounds(ay, meshes ? meshes.y : R.y) };   // P_k: where the tile boundaries sit in the field
        if (spec.macro !== undefined && spec.macro !== null) result.macroIgnored = { requested: spec.macro, reason: 'intra-tile macro does not apply in a field (the micro grid is the clicked tile\'s own)' };
    }
    if (dom.ignored) result.domainIgnored = dom.ignored;
    return result;
}
// The inverse of netTransformExportData(): the spec (as baseNetTransform holds it) from an
// exported meta.netTransform. Only kind/w/alternate/repeat are read - everything else is derived.
function netTransformFromExport(exported) {
    if (exported && exported.version === 2) return exported.kind === 'projective' && (exported.family === '□N' || exported.family === '△N' || exported.family === '*N') ? Object.assign(netProjectiveSpec(exported.a, exported.b, exported.format, exported.family, exported.cls), exported.interp === true ? { interp: true } : {}) : null;   // task 121; task 124: the triangle family
    if (!exported || exported.version !== 1) return null;
    const axis = a => (!a || a.kind === 'uniform') ? { kind: 'uniform', w: 0 } : (a.kind === 'trig' && a.focus) ? { kind: a.kind, w: a.w, focus: a.focus, alternate: !!a.alternate } : { kind: a.kind, w: a.w, alternate: !!a.alternate };
    // repeat: an export from before the closed-net option has neither field and was drawn repeated
    const isField = exported.domain === 'field';
    const repeat = isField ? false : (exported.repeat !== undefined ? !!exported.repeat : exported.domain !== 'single');
    const spec = { x: axis(exported.x), y: axis(exported.y), repeat };
    if (isField) spec.domain = 'field';
    if (Number.isInteger(exported.micro) && exported.micro > 1 && Number.isInteger(exported.macro)) spec.macro = exported.macro; // absent = not nested
    return spec;
}

// Task 090: the base faces under the hexagon Field. A face polygon (regular coordinates of the base cell) crosses the mesh boundaries (the lines s, t = integer of the fine lattice, in the warp's base frame): its edges are
// split there ONCE (extra, collinear vertices on the same face), so mapping each vertex with applyNetWarp() gives the exact image (F is affine inside a mesh) - every tile sits the same way to the fine lattice
// (the hexagon lattice is a sublattice of it), and the polygons are placed per vertex by drawFaceFillsAtTile(). A no-op for every other warp (`refineFaces` is only set by _netHexField) and for none.
// Called at the end of computeCellFaces(); the colour work has run on the unrefined result already (identity of the faces and of their colours is untouched).
function netWarpRefineFaces(result, warp) {
    if (!warp || warp.refineFaces !== true || !warp.frame || !result || !result.faces || !result.faces.length) return result;
    const F = warp.frame, nodes = result.nodes.slice(), byId = new Map(nodes.map(n => [n.id, n])), made = new Map();
    let nextId = nodes.reduce((m, n) => (typeof n.id === 'number' && n.id > m ? n.id : m), 0) + 1;
    const coords = p => { const dx = p.x - F.c0.x, dy = p.y - F.c0.y; return { s: (dx * F.v2.y - dy * F.v2.x) / F.det, t: (F.v1.x * dy - F.v1.y * dx) / F.det }; };
    const EPS = 1e-9;
    const nodeAt = (x, y) => { const key = Math.round(x * 1e6) + ',' + Math.round(y * 1e6); if (!made.has(key)) { const n = { id: nextId++, x, y, synthetic: true }; made.set(key, n); nodes.push(n); } return made.get(key).id; };
    const faces = result.faces.map(face => {
        const ids = face.nodeIds, out = [];
        for (let i = 0; i < ids.length; i++) {
            const a = byId.get(ids[i]), b = byId.get(ids[(i + 1) % ids.length]);
            out.push(ids[i]);
            const ca = coords(a), cb = coords(b), ts = [];
            for (const [u0, u1] of [[ca.s, cb.s], [ca.t, cb.t]]) {
                const lo = Math.min(u0, u1), hi = Math.max(u0, u1);
                for (let k = Math.floor(lo) + 1; k <= Math.ceil(hi) - 1; k++) if (lo < k - EPS && hi > k + EPS) ts.push((k - u0) / (u1 - u0));
            }
            ts.sort((x, y) => x - y);
            ts.forEach((t, j) => { if (j === 0 || t - ts[j - 1] > 1e-12) out.push(nodeAt(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y))); });
        }
        return Object.assign({}, face, { nodeIds: out });
    });
    return Object.assign({}, result, { nodes, faces });
}

// Task 090: whether the tile at `tileCentroid` (placed like drawFaceFillsAtTile() places it) lies entirely outside the canvas under the hexagon Field, so its face fills need not be drawn. The image of the tile's hexagon is
// piecewise affine; its vertices are the 6 corners, the crossings of its edges with the mesh lines and its centre (the centre of the hexagon is a lattice node), so the bounding box of those mapped points is that of the image.
// A no-op (false) for every other warp. 1 px margin.
function netWarpTileOutsideCanvas(warp, tileCentroid, flip180, margin) {
    if (warp && warp.projective) return _netProjTileOutside(warp, tileCentroid, flip180);   // task 121
    if (!warp || warp.refineFaces !== true || !warp.frame || typeof outerCorners === 'undefined' || typeof toTileLocal !== 'function') return false;
    const F = warp.frame, W = typeof canvasW !== 'undefined' ? canvasW : 600, H = typeof canvasH !== 'undefined' ? canvasH : 600;
    const loc = outerCorners.map(p => toTileLocal(p, tileCentroid, flip180)), pts = loc.slice();
    pts.push({ x: tileCentroid.x, y: tileCentroid.y });
    const co = p => { const dx = p.x - F.c0.x, dy = p.y - F.c0.y; return { s: (dx * F.v2.y - dy * F.v2.x) / F.det, t: (F.v1.x * dy - F.v1.y * dx) / F.det }; };
    for (let i = 0; i < loc.length; i++) {
        const a = loc[i], b = loc[(i + 1) % loc.length], ca = co(a), cb = co(b);
        for (const [u0, u1] of [[ca.s, cb.s], [ca.t, cb.t]]) {
            const lo = Math.min(u0, u1), hi = Math.max(u0, u1);
            for (let k = Math.floor(lo) + 1; k <= Math.ceil(hi) - 1; k++) if (lo < k - 1e-9 && hi > k + 1e-9) { const t = (k - u0) / (u1 - u0); pts.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }); }
        }
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { const q = applyNetWarp(warp, p); if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
    const m = typeof margin === 'number' ? margin : 1;   // task 091: the morph passes a conservative margin (a morph polygon may leave its tile's frame)
    return x1 < -m || x0 > W + m || y1 < -m || y0 > H + m;
}

// ---- Net-line overlay (display aid): the actual grid lines of the warped net ----

// The lines of the net itself - one vertical and one horizontal line (in the warp's own frame) through
// every lattice position, drawn edge to edge, at the WARPED positions - so a person can SEE the unequal
// raster instead of inferring it from node dots or theme lines. A display aid only: it is not part of any
// export and never touches nodes or connections.
//
//   spec    baseNetTransform or null (null/identity = the regular, uniform raster)
//   corners the base sheet's outerCorners (the frame: c0, v1 = c1-c0, v2 = c3-c0)
//   E       divisions per tile and axis (nodeCount - 1)
//   view    {x0,y0,x1,y1}: the visible rectangle (repeat mode covers it; closed mode ignores it)
//   opts    {closed: one tile only (the net rectangle), micro: lines whose index i % micro != 0 are
//           level 'micro' (default: the spec's own micro = E/macro, 1 when not nested = every line 'macro')}
// Returns [{level: 'macro'|'micro', axis: 'v'|'h', x1, y1, x2, y2}], canvas coordinates. Positions come
// from the same per-axis function applyNetWarp() uses (so `alternate` parity and repeat are honoured).
function netGridLines(spec, corners, E, view, opts = {}) {
    if (spec && spec.kind === 'projective') return _netProjGridLines(spec, corners, E);   // task 121
    if ((!opts.frame && (!corners || corners.length < 4)) || !(E >= 1)) return [];
    let c0, v1, v2;
    if (opts.frame) { c0 = opts.frame.c0; v1 = opts.frame.v1; v2 = opts.frame.v2; }   // task 088: the base mesh of the triangle / hexagon (task 092: read BEFORE corners[3]: a triangle has 3 corners, the old order threw)
    else { c0 = corners[0]; const c1 = corners[1], c3 = corners[3]; v1 = { x: c1.x - c0.x, y: c1.y - c0.y }; v2 = { x: c3.x - c0.x, y: c3.y - c0.y }; }
    const det = v1.x * v2.y - v2.x * v1.y;
    if (!det) return [];
    const ax = spec ? spec.x : null, ay = spec ? (spec.y === 'same' ? spec.x : spec.y) : null;
    const ft = opts.fieldTiles, fR = opts.domain === 'field' && ft ? (typeof ft === 'object' ? ft : { x: ft, y: ft }) : null;
    if (opts.frame) {
        // Task 092: the triangle / hexagon Field: the MESH lines of the field (s, t = integer in the base mesh's frame, mapped by the law, clipped to the view); the subdivisions "E per tile" have no meaning there (a mesh is
        // not the tile). opts.diagonal (pictures only): also the lattice diagonal of every mesh (the polyline through the mapped nodes).
        if (!fR || !(fR.x >= 3 && fR.y >= 3)) return [];
        const hx = (fR.x - 1) / 2, hy = (fR.y - 1) / 2, fxF = netFieldLaw(ax, fR.x), fyF = netFieldLaw(ay, fR.y), out = [];
        const at = (s, t) => ({ x: c0.x + s * v1.x + t * v2.x, y: c0.y + s * v1.y + t * v2.y });
        const clip = (a, b) => {   // Liang-Barsky against the view rectangle (no view: unclipped)
            if (!view) return [a, b];
            let t0 = 0, t1 = 1; const dx = b.x - a.x, dy = b.y - a.y;
            for (const [p, q] of [[-dx, a.x - view.x0], [dx, view.x1 - a.x], [-dy, a.y - view.y0], [dy, view.y1 - a.y]]) {
                if (p === 0) { if (q < 0) return null; } else { const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } }
            }
            return [{ x: a.x + t0 * dx, y: a.y + t0 * dy }, { x: a.x + t1 * dx, y: a.y + t1 * dy }];
        };
        const add = (a, b, axis, level) => { const c = clip(a, b); if (c) out.push({ level, axis, x1: c[0].x, y1: c[0].y, x2: c[1].x, y2: c[1].y }); };
        for (let k = 0; k <= fR.x; k++) { const s = (fxF ? fxF(k) : k) - hx; add(at(s, -hy), at(s, hy + 1), 'v', 'macro'); }
        for (let k = 0; k <= fR.y; k++) { const t = (fyF ? fyF(k) : k) - hy; add(at(-hx, t), at(hx + 1, t), 'h', 'macro'); }
        if (opts.diagonal) {
            const P = (a, b) => at((fxF ? fxF(a) : a) - hx, (fyF ? fyF(b) : b) - hy);
            for (let m = 1; m < fR.x + fR.y; m++) for (let k = Math.max(0, m - fR.y); k < Math.min(fR.x, m); k++) add(P(k + 1, m - k - 1), P(k, m - k), 'd', 'macro');
        }
        return out;
    }
    if (fR && fR.x >= 2 && fR.y >= 2 && (fR.x !== fR.y || fR.x % 2 === 0) && (fR.x >= 3 || fR.x % 2 === 0) && (fR.y >= 3 || fR.y % 2 === 0)) {
        // Task 086: a Rx x Ry field: the vertical lines run over the x tiles, the horizontal ones over the y tiles
        // Task 105: an even axis (only with netFieldEven): n / 2 tiles left of the base tile, n / 2 - 1 right of it, and the picture is moved by half a tile (tx, ty), exactly as applyNetWarp() does
        const hx = Math.floor(fR.x / 2), hy = Math.floor(fR.y / 2), ux = fR.x - 1 - hx, uy = fR.y - 1 - hy, tx = fR.x % 2 === 0 ? 0.5 : 0, ty = fR.y % 2 === 0 ? 0.5 : 0, fxF = netFieldLaw(ax, fR.x), fyF = netFieldLaw(ay, fR.y), out = [];
        const at = (s, t) => ({ x: c0.x + s * v1.x + t * v2.x, y: c0.y + s * v1.y + t * v2.y });
        for (let k = 0; k <= fR.x; k++) for (let j = 0; j < (k === fR.x ? 1 : E); j++) {
            const sig = k + j / E, s = (fxF ? fxF(sig) : sig) - hx + tx, a = at(s, -hy + ty), b = at(s, uy + 1 + ty), lv = j === 0 ? 'macro' : 'micro';
            out.push({ level: lv, axis: 'v', x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        }
        for (let k = 0; k <= fR.y; k++) for (let j = 0; j < (k === fR.y ? 1 : E); j++) {
            const sig = k + j / E, t = (fyF ? fyF(sig) : sig) - hy + ty, c = at(-hx + tx, t), d = at(ux + 1 + tx, t), lv = j === 0 ? 'macro' : 'micro';
            out.push({ level: lv, axis: 'h', x1: c.x, y1: c.y, x2: d.x, y2: d.y });
        }
        return out;
    }
    if (fR && fR.x >= 3) {
        // Model 2: macro lines = the tile boundaries P_k, micro lines = the clicked tile's own E divisions inside each
        const Rt = fR.x, h = (Rt - 1) / 2, fxF = netFieldLaw(ax, Rt), fyF = netFieldLaw(ay, Rt), out = [];
        const at = (s, t) => ({ x: c0.x + s * v1.x + t * v2.x, y: c0.y + s * v1.y + t * v2.y });
        for (let k = 0; k <= Rt; k++) for (let j = 0; j < (k === Rt ? 1 : E); j++) {
            const sig = k + j / E, lv = j === 0 ? 'macro' : 'micro';
            const s = (fxF ? fxF(sig) : sig) - h, t = (fyF ? fyF(sig) : sig) - h, a = at(s, -h), b = at(s, h + 1), c = at(-h, t), d = at(h + 1, t);
            out.push({ level: lv, axis: 'v', x1: a.x, y1: a.y, x2: b.x, y2: b.y });
            out.push({ level: lv, axis: 'h', x1: c.x, y1: c.y, x2: d.x, y2: d.y });
        }
        return out;
    }
    const macro = spec ? spec.macro : undefined;
    const fx = netAxisLaw(ax, E, macro), fy = netAxisLaw(ay, E, macro);
    const altX = !!(ax && ax.alternate), altY = !!(ay && ay.alternate);
    // micro = lines per macro cell: from the spec's nesting unless the caller overrides it
    const micro = Math.max(1, Math.round(opts.micro || netMacroEffective(macro, E).micro));
    const coords = P => { const dx = P.x - c0.x, dy = P.y - c0.y; return { s: (dx * v2.y - dy * v2.x) / det, t: (v1.x * dy - v1.y * dx) / det }; };
    let sLo, sHi, tLo, tHi;
    if (opts.closed) { sLo = 0; sHi = 1; tLo = 0; tHi = 1; }
    else {
        const cs = [{ x: view.x0, y: view.y0 }, { x: view.x1, y: view.y0 }, { x: view.x1, y: view.y1 }, { x: view.x0, y: view.y1 }].map(coords);
        sLo = Math.floor(Math.min(...cs.map(c => c.s))) - 1; sHi = Math.ceil(Math.max(...cs.map(c => c.s))) + 1;
        tLo = Math.floor(Math.min(...cs.map(c => c.t))) - 1; tHi = Math.ceil(Math.max(...cs.map(c => c.t))) + 1;
    }
    const warp = (f, alt, s) => f ? _netWarpAxis(f, alt, s) : s;
    const level = idx => ((((idx % E) + E) % E) % micro === 0) ? 'macro' : 'micro';
    const at = (s, t) => ({ x: c0.x + s * v1.x + t * v2.x, y: c0.y + s * v1.y + t * v2.y });
    const out = [];
    for (let idx = Math.round(sLo * E); idx <= Math.round(sHi * E); idx++) {
        const s = warp(fx, altX, idx / E), a = at(s, tLo), b = at(s, tHi);
        out.push({ level: level(idx), axis: 'v', x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    for (let idx = Math.round(tLo * E); idx <= Math.round(tHi * E); idx++) {
        const t = warp(fy, altY, idx / E), a = at(sLo, t), b = at(sHi, t);
        out.push({ level: level(idx), axis: 'h', x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return out;
}

// ---- Task 121 (3C-1): the projective net (Moebius net, Hinterreiter Netzart 3C), family square-N ----
// The picture is the image of the square lattice (p, q) under ONE homography H (plan: tasks/121-3c-projektiv.md, tools/grid/measure-3c.js
// is the prototype). The pattern is built in regular space as ever; with the tile coordinates (s, t) of the base frame {c0, v1, v2} a point has the
// lattice coordinates (p, q) = (s + i0, t + j0), (i0, j0) = the EDIT TILE (the visible tile that the node dots, the hit test and free endpoints work in; the
// picture does not depend on it: every tile carries the same pattern). The net is the region p, q >= 0, a <= v <= b with v = p + q (half format: also
// p >= q); the frame is the canvas (W x H). With v = p + q:
//   full  X = W p / v        half  X = W (p - q) / v        Y = H a (b - v) / ((b - a) v)        (a at the bottom, b at the top)
//   inverse: v = a b / (Y/H (b - a) + a), p = X v / W (full) | (v + X v / W) / 2 (half), q = v - p.
// Straight lines stay straight: a chord between two mapped endpoints IS the image of the segment, so the sink only has to CUT a segment with the net's
// region (netWarpSplitSegment returns the exact cut, [] = outside; v < a is the vanishing side, nothing is drawn there). Faces are placed per vertex (exact).
// The marker fields (repeat false, field {Rt: 1, h: 0}, c0/v1/v2 = the lattice rectangle [0,b] x [0,b]) let core/tiling.js and core/faces.js serve it unchanged.
// a >= 2 is enforced: only a = 1 has a tile that touches the vanishing line (v = 0), where coordinates run to 8e5 px and the canvas loses its antialiasing (measured,
// tasks/121-3c-projektiv.md section 3); a = 1 = ROADMAP.
const NETWARP_PROJ_MAX_B = 12;
const NETWARP_PROJ_EPS = 1e-3;
function _netIsProjective(spec) { return !!spec && spec.kind === 'projective'; }
// task 124: the family follows the shape (square □N, triangle △N); the triangle takes a >= 1 and the full format only (its rim lies on triangle edges: the middle axis p = q cuts triangles, Messung 120/3)
function netProjectiveFamilyFor(shape) { return shape === 'triangle' ? '\u25b3N' : shape === 'hex' ? '*N' : '\u25a1N'; }   // task 127: the hexagon's family is *N (the omission rule: reports/125.md)
function netProjectiveAMin(family) { return family === '\u25b3N' ? 1 : 2; }
// task 127: `cls` (0, 1, 2) = the omission class of the hexagon family *N: the hexagon centres are the lattice points with i - j = cls (mod 3); 0 = the symmetric derivation (Hinterreiter p. 14), 1 and 2 mirror images; no key for the other families
function netProjectiveSpec(a, b, format, family, cls) {
    const fam = family === '\u25b3N' ? '\u25b3N' : family === '*N' ? '*N' : '\u25a1N', out = { kind: 'projective', a, b, format: format === 'half' ? 'half' : 'full', family: fam };
    if (fam === '*N') out.cls = cls === 1 || cls === 2 ? cls : 0;
    return out;
}
// {valid, reason}: an invalid spec is IGNORED visibly (no warp; the export flags it), never half-applied.
// The family FOLLOWS THE SHAPE (no user switch): for a square or triangle sheet the shape decides, the spec's own `family` is only what it was written with (a shape change leaves it stale; netProjectiveForShape renames it).
function netProjectiveForShape(spec, shape) {
    if (!_netIsProjective(spec) || (shape !== 'square' && shape !== 'triangle' && shape !== 'hex')) return spec;
    const fam = netProjectiveFamilyFor(shape);
    if (spec.family === fam) return spec;
    const out = Object.assign({}, spec, { family: fam });   // task 127: the hexagon family carries cls (0 when renamed to it), the others none
    if (fam === '*N') { if (out.cls === undefined) out.cls = 0; } else delete out.cls;
    return out;
}
function netProjectiveEffective(spec, shape) {
    let reason = null;
    const known = shape === 'square' || shape === 'triangle' || shape === 'hex';
    const fam = known ? netProjectiveFamilyFor(shape) : (spec && spec.family), tri = fam === '\u25b3N', hexa = fam === '*N', amin = netProjectiveAMin(fam);
    if (!_netIsProjective(spec)) reason = 'not a projective net spec';
    else if (shape !== undefined && !known) reason = 'the 3C net exists for the square, the triangle and the hexagon only';
    else if (fam !== '\u25a1N' && fam !== '\u25b3N' && fam !== '*N') reason = 'family must be \u25a1N, \u25b3N or *N';
    else if (spec.format !== 'full' && spec.format !== 'half') reason = 'format must be full or half';
    else if (tri && spec.format !== 'full') reason = 'the 3C net on the triangle exists in the full format only (the middle axis cuts triangles)';
    else if (hexa && spec.format !== 'full') reason = 'the 3C net on the hexagon exists in the full format only for now';   // task 127: the half format is not built (it cuts hexagons along the middle axis; reports/125.md)
    else if (hexa && spec.cls !== undefined && !(spec.cls === 0 || spec.cls === 1 || spec.cls === 2)) reason = 'the omission class cls must be 0, 1 or 2';
    else if (!Number.isFinite(spec.a) || !Number.isFinite(spec.b)) reason = 'a and b must be numbers';
    else if (spec.interp !== true && (!Number.isInteger(spec.a) || !Number.isInteger(spec.b))) reason = 'a and b must be whole numbers';
    else if (spec.a < amin - 1e-9) reason = tri ? 'a must be at least 1' : 'a must be at least 2 (a = 1 puts the tile at the vanishing line into the picture: not built, see ROADMAP)';
    else if (!(spec.a < spec.b)) reason = 'a must be smaller than b';
    else if (spec.b > NETWARP_PROJ_MAX_B + 1e-9) reason = `b exceeds ${NETWARP_PROJ_MAX_B}`;
    return reason ? { valid: false, reason } : { valid: true, reason: null };
}
function _projPlanes(a, b, half) { const h = [[1, 0, 0], [0, 1, 0], [1, 1, -a], [-1, -1, b]]; if (half) h.push([1, -1, 0]); return h; }   // keep A p + B q + C >= 0
function _projClipPoly(poly, planes) {
    for (const [A, B, C] of planes) {
        const out = [];
        for (let i = 0; i < poly.length; i++) {
            const P = poly[i], Q = poly[(i + 1) % poly.length], dp = A * P[0] + B * P[1] + C, dq = A * Q[0] + B * Q[1] + C;
            if (dp >= 0) out.push(P);
            if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]); }
        }
        poly = out; if (!poly.length) return poly;
    }
    return poly;
}
function _projArea(poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const P = poly[i], Q = poly[(i + 1) % poly.length]; s += P[0] * Q[1] - Q[0] * P[1]; } return Math.abs(s) / 2; }
// the pixel of the lattice point (p, q): the one map of the module (v < eps is clamped to eps so every result is finite; only reached by a point off the net)
function _projPx(P, p, q) {
    let v = p + q;
    if (v < NETWARP_PROJ_EPS) { if (v > 0) { const k = NETWARP_PROJ_EPS / v; p *= k; q *= k; } else { p = q = NETWARP_PROJ_EPS / 2; } v = p + q; }
    return { x: (P.half ? P.W * (p - q) : P.W * p) / v, y: P.H * P.a * (P.b - v) / ((P.b - P.a) * v) };
}
// the lattice point (p, q) of the pixel (X, Y)
function _projPQ(P, X, Y) {
    const den = Y / P.H * (P.b - P.a) + P.a, v = P.a * P.b / (den > 1e-12 ? den : 1e-12), p = P.half ? (v + X * v / P.W) / 2 : X * v / P.W;
    return { p, q: v - p, v };
}
// the lattice point (p, q) of a REGULAR point, in the edit tile's frame
function _projReg(warp, pt) {
    const F = warp.frame, dx = pt.x - F.c0.x, dy = pt.y - F.c0.y, P = warp.projective;
    return { p: (dx * F.v2.y - dy * F.v2.x) / F.det + P.i0, q: (F.v1.x * dy - F.v1.y * dx) / F.det + P.j0 };
}
function _projRegPoint(warp, s, t) { const F = warp.frame; return { x: F.c0.x + s * F.v1.x + t * F.v2.x, y: F.c0.y + s * F.v1.y + t * F.v2.y }; }
// the edit tile: the tile with the largest area inside the net, ties to the one nearest the middle of the picture
function _netProjEditTile(a, b, half, tri, cls) {
    const planes = _projPlanes(a, b, half), nx = Math.ceil(b - 1e-9), ny = half ? Math.ceil(b / 2 - 1e-9) : nx, vm = 2 * a * b / (a + b), mp = half ? 0.75 * vm : vm / 2, mq = half ? 0.25 * vm : vm / 2;
    let best = { i: 0, j: 0, ar: -1, d: Infinity };
    if (cls !== undefined) {   // task 127: the hexagon: the tile whose CENTRE (i, j) has i - j = cls (mod 3), largest area inside the net, ties to the middle; (i, j) is the centre (lattice coordinates p = s + i, q = t + j of the centroid-anchored frame)
        const ring = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]], R = Math.ceil(b) + 1;
        for (let i = -1; i <= R; i++) for (let j = -1; j <= R; j++) {
            if ((((i - j) % 3) + 3) % 3 !== cls) continue;
            const ar = _projArea(_projClipPoly(ring.map(([di, dj]) => [i + di, j + dj]), planes)), d = Math.hypot(i - mp, j - mq);
            if (ar > best.ar + 1e-9 || (Math.abs(ar - best.ar) <= 1e-9 && d < best.d)) best = { i, j, ar, d };
        }
        return { i: best.i, j: best.j };
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        // task 124: on the triangle the edit tile is the UPPER triangle of the mesh (i, j) - the mesh holds the base triangle (1,0), (0,1), (1,1) - so its area and distance are those of that triangle
        const poly = tri ? [[i + 1, j], [i, j + 1], [i + 1, j + 1]] : [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const ar = _projArea(_projClipPoly(poly, planes)), d = tri ? Math.hypot(i + 2 / 3 - mp, j + 2 / 3 - mq) : Math.hypot(i + 0.5 - mp, j + 0.5 - mq);
        if (ar > best.ar + 1e-9 || (Math.abs(ar - best.ar) <= 1e-9 && d < best.d)) best = { i, j, ar, d };
    }
    return { i: best.i, j: best.j };
}
function _netProjectiveWarp(spec, frame) {
    const tri = spec.family === '\u25b3N', hexa = spec.family === '*N';
    if (!netProjectiveEffective(spec, hexa ? 'hex' : tri ? 'triangle' : 'square').valid) return null;
    const { c0, v1, v2 } = frame, det = v1.x * v2.y - v2.x * v1.y;
    if (!det) return null;
    const a = spec.a, b = spec.b, half = spec.format === 'half', ed = _netProjEditTile(a, b, half, tri, hexa ? (spec.cls | 0) : undefined);
    const W = typeof canvasW !== 'undefined' ? canvasW : 600, H = typeof canvasH !== 'undefined' ? canvasH : 600;
    const rc0 = { x: c0.x - ed.i * v1.x - ed.j * v2.x, y: c0.y - ed.i * v1.y - ed.j * v2.y }, ry = half ? b / 2 : b;
    const rv1 = { x: b * v1.x, y: b * v1.y }, rv2 = { x: ry * v2.x, y: ry * v2.y };
    return { projective: Object.assign({ a, b, half, W, H, i0: ed.i, j0: ed.j, nx: Math.ceil(b - 1e-9), ny: half ? Math.ceil(b / 2 - 1e-9) : Math.ceil(b - 1e-9) }, hexa ? { hex: true, cls: spec.cls | 0 } : {}), fx: null, fy: null, altX: false, altY: false, repeat: false, domain: 'field', field: { Rt: 1, h: 0 }, domainIgnored: null, frame: { c0, v1, v2, det }, c0: rc0, v1: rv1, v2: rv2, det: rv1.x * rv2.y - rv2.x * rv1.y };
}
function _netProjApply(warp, pt) { const r = _projReg(warp, pt); return _projPx(warp.projective, r.p, r.q); }
function _netProjInvert(warp, pt) { const P = warp.projective, r = _projPQ(P, pt.x, pt.y); return _projRegPoint(warp, r.p - P.i0, r.q - P.j0); }
const _PROJ_TOL = 1e-9;
function _netProjInside(warp, pt) {
    const P = warp.projective, r = _projPQ(P, pt.x, pt.y);
    return r.v >= P.a - _PROJ_TOL && r.v <= P.b + _PROJ_TOL && r.p >= -_PROJ_TOL && r.q >= -_PROJ_TOL && (!P.half || r.p >= r.q - _PROJ_TOL);
}
// a click on the picture -> the edit tile's own coordinates (the node is then drawn as a copy in every tile): like netWarpFieldLocal() of a Field
function _netProjLocal(warp, pt) {
    const P = warp.projective, r = _projPQ(P, pt.x, pt.y);
    if (P.hex) {   // task 127: the hexagon whose centre (class cls) is nearest in the lattice metric (60 degrees: d^2 = x^2 + y^2 + x y); the free point is the position inside THAT hexagon, relative to its centre
        let ci = 0, cj = 0, bd = Infinity;
        for (let i = Math.floor(r.p) - 2; i <= Math.floor(r.p) + 3; i++) for (let j = Math.floor(r.q) - 2; j <= Math.floor(r.q) + 3; j++) {
            if ((((i - j) % 3) + 3) % 3 !== P.cls) continue;
            const x = r.p - i, y = r.q - j, d = x * x + y * y + x * y;
            if (d < bd) { bd = d; ci = i; cj = j; }
        }
        const l = r.p - ci, m = r.q - cj, at = _projRegPoint(warp, l, m), di = ci - P.i0, dj = cj - P.j0;
        return { x: at.x, y: at.y, tile: { i: (di - dj) / 3, j: (di + 2 * dj) / 3 }, local: { l, m } };   // the tile index in the hexagon lattice (v1 = 2 f1 - f2, v2 = f1 + f2) relative to the edit tile
    }
    let i = Math.floor(r.p), j = Math.floor(r.q);
    if (i > P.nx - 1) i = P.nx - 1; if (j > P.ny - 1) j = P.ny - 1; if (i < 0) i = 0; if (j < 0) j = 0;
    const l = r.p - i, m = r.q - j, at = _projRegPoint(warp, l, m);
    return { x: at.x, y: at.y, tile: { i: i - P.i0, j: j - P.j0 }, local: { l, m } };
}
// Cyrus-Beck: the part t0..t1 of the lattice segment (pa,qa)-(pb,qb) inside the planes, or null
function _projCutParams(pa, qa, pb, qb, planes) {
    let t0 = 0, t1 = 1;
    for (const [A, B, C] of planes) {
        let g0 = A * pa + B * qa + C, g1 = A * pb + B * qb + C;
        if (g0 < 0 && g0 >= -_PROJ_TOL) g0 = 0; if (g1 < 0 && g1 >= -_PROJ_TOL) g1 = 0;   // a segment ON a rim line (float noise) stays
        if (g0 < 0 && g1 < 0 && g1 < -_PROJ_TOL) return null;
        if (g0 < 0 || g1 < 0) { const t = g0 / (g0 - g1); if (g0 < 0) { if (t > t0) t0 = t; } else if (t < t1) t1 = t; }
    }
    return t0 > t1 - 1e-12 && (t0 > 0 || t1 < 1) ? null : [t0, t1];
}
function _netProjCut(warp, p1, p2) {
    const P = warp.projective, A = _projReg(warp, p1), B = _projReg(warp, p2), c = _projCutParams(A.p, A.q, B.p, B.q, _projPlanes(P.a, P.b, P.half));
    if (!c) return [];
    if (c[0] === 0 && c[1] === 1) return [p1, p2];
    const at = t => ({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
    return [c[0] === 0 ? p1 : at(c[0]), c[1] === 1 ? p2 : at(c[1])];
}
// a tile entirely outside the net region draws no face fill (the corners give the extremes: v, p and q are linear)
function _netProjTileOutside(warp, tileCentroid, flip180) {
    if (typeof outerCorners === 'undefined' || typeof toTileLocal !== 'function') return false;
    const P = warp.projective;
    let vmin = Infinity, vmax = -Infinity, pmax = -Infinity, qmax = -Infinity, dmax = -Infinity;
    for (const c of outerCorners) { const r = _projReg(warp, toTileLocal(c, tileCentroid, flip180)), v = r.p + r.q; if (v < vmin) vmin = v; if (v > vmax) vmax = v; if (r.p > pmax) pmax = r.p; if (r.q > qmax) qmax = r.q; if (r.p - r.q > dmax) dmax = r.p - r.q; }
    return vmax <= P.a + _PROJ_TOL || vmin >= P.b - _PROJ_TOL || pmax <= _PROJ_TOL || qmax <= _PROJ_TOL || (P.half && dmax <= _PROJ_TOL);
}
// the net's own lines for the overlay: p = i + k/E and q = j + k/E, cut exactly with the region; macro at k = 0
function _netProjGridLines(spec, corners, E) {
    const tri = !!corners && corners.length === 3, hexa = !!corners && corners.length === 6;   // the sheet decides (a triangle has 3 outer corners, a hexagon 6), not the spec's family
    spec = netProjectiveForShape(spec, hexa ? 'hex' : tri ? 'triangle' : 'square');
    if (!corners || corners.length < (tri ? 3 : 4) || !(E >= 1)) return [];
    const warp = (tri || hexa) ? netWarpForBase(spec, hexa ? 'hex' : 'triangle', corners, undefined, 1)   // task 124: the triangle's frame (c0 = A + B - C, v1 = C - B, v2 = C - A) and its validity are those of netWarpForBase
        : _netProjectiveWarp(spec, { c0: corners[0], v1: { x: corners[1].x - corners[0].x, y: corners[1].y - corners[0].y }, v2: { x: corners[3].x - corners[0].x, y: corners[3].y - corners[0].y } });
    if (!warp) return [];
    const P = warp.projective, planes = _projPlanes(P.a, P.b, P.half), out = [], hi = P.b;
    const add = (pa, qa, pb, qb, axis, level) => {
        const c = _projCutParams(pa, qa, pb, qb, planes);
        if (!c) return;
        const A = _projPx(P, pa + c[0] * (pb - pa), qa + c[0] * (qb - qa)), B = _projPx(P, pa + c[1] * (pb - pa), qa + c[1] * (qb - qa));
        out.push({ level, axis, x1: A.x, y1: A.y, x2: B.x, y2: B.y });
    };
    if (P.hex) {   // task 127: the hexagon's net: the macro lines are the edges of the honeycomb (lattice edges whose end points are no hexagon centre), the micro lines the fine triangle lattice
        for (let i = -2; i <= Math.ceil(P.b) + 1; i++) for (let j = -2; j <= Math.ceil(P.b) + 1; j++) {
            if ((((i - j) % 3) + 3) % 3 === P.cls) continue;
            for (const [di, dj, ax] of [[1, 0, 'v'], [0, 1, 'h'], [1, -1, 'd']]) { if ((((i + di - (j + dj)) % 3) + 3) % 3 === P.cls) continue; add(i, j, i + di, j + dj, ax, 'macro'); }
        }
        for (let k = 0; k <= Math.ceil(P.b * E - 1e-9); k++) { if (k % E === 0) continue; const u = k / E; add(u, 0, u, hi, 'v', 'micro'); add(0, u, hi, u, 'h', 'micro'); add(u, 0, 0, u, 'd', 'micro'); }
        return out;
    }
    for (let k = 0; k <= Math.ceil(P.b * E - 1e-9); k++) { const u = k / E; add(u, 0, u, hi, 'v', k % E === 0 ? 'macro' : 'micro'); add(0, u, hi, u, 'h', k % E === 0 ? 'macro' : 'micro'); if (tri) add(u, 0, 0, u, 'd', k % E === 0 ? 'macro' : 'micro'); }   // the triangle's third family p + q = u is the Baren (a triangle edge)
    return out;
}
// The numbers a UI needs (3C-3) and the tests pin: W (meshes) = area of the region, the tile counts, the stretch of the picture meshes (largest / smallest aspect over the meshes with at least a quarter inside, Messung 6), the edit tile.
function netProjectiveInfo(spec, Wpx, Hpx) {
    const tri = !!spec && spec.family === '\u25b3N', hexa = !!spec && spec.family === '*N', eff = netProjectiveEffective(spec, hexa ? 'hex' : tri ? 'triangle' : 'square');
    if (!eff.valid) return { valid: false, reason: eff.reason };
    const a = spec.a, b = spec.b, half = spec.format === 'half', planes = _projPlanes(a, b, half), nx = Math.ceil(b - 1e-9), ny = half ? Math.ceil(b / 2 - 1e-9) : nx;
    const P = { a, b, half, W: Wpx, H: Hpx }, e = 1e-4;
    if (hexa) {   // task 127: W = sum of the area shares of the hexagons (6 triangles = 3 meshes each) = (b^2 - a^2) / 6; the stretch (an INTERPRETATION, reports/125.md): the image box of a whole hexagon against 2 : sqrt3, the maximum over the hexagons with at least a quarter of their area inside, and the measure of task 124 on the fine triangles, whichever is larger
        const cls = spec.cls | 0, ring = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]], R = Math.ceil(b) + 2;
        let Wh = 0, withAreaH = 0, st = 1, fine = 1;
        for (let i = -2; i <= R; i++) for (let j = -2; j <= R; j++) {
            if ((((i - j) % 3) + 3) % 3 !== cls) continue;
            const poly = ring.map(([di, dj]) => [i + di, j + dj]), ar = _projArea(_projClipPoly(poly, planes));
            if (ar < 1e-9) continue;
            Wh += ar / 3; withAreaH++;
            if (ar < 0.25 * 3 || poly.some(q => q[0] + q[1] < 0.2)) continue;
            const pts = poly.map(q => _projPx(P, q[0], q[1])), xs = pts.map(q => q.x), ys = pts.map(q => q.y), asp = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys)) / (2 / Math.sqrt(3));
            st = Math.max(st, asp, 1 / asp);
        }
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (const cell of [[[i + 1, j], [i, j + 1], [i + 1, j + 1]], [[i, j], [i + 1, j], [i, j + 1]]]) {
            const poly = _projClipPoly(cell, planes); if (_projArea(poly) < 0.125) continue;
            const cx = poly.reduce((u, q) => u + q[0], 0) / poly.length, cy = poly.reduce((u, q) => u + q[1], 0) / poly.length;
            const A = _projPx(P, cx - e, cy + e), B = _projPx(P, cx + e, cy - e), C = _projPx(P, cx - e, cy - e), D = _projPx(P, cx + e, cy + e), asp = Math.abs(B.x - A.x) / Math.abs(D.y - C.y) * Math.sqrt(3);
            fine = Math.max(fine, asp, 1 / asp);
        }
        return { valid: true, reason: null, W: Wh, tiles: { x: nx, y: ny }, tilesWithArea: withAreaH, stretch: Math.max(st, fine), stretchHex: st, stretchFine: fine, editTile: _netProjEditTile(a, b, half, false, cls) };
    }
    let W = 0, withArea = 0, stretch = 1;
    // task 124: on the triangle W counts TRIANGLES (a mesh = 2): W = b^2 - a^2; the picture's regular mesh is the rhombus with the diagonals p + q (1) and p - q (sqrt 3), so the aspect is taken against 1 : sqrt 3
    // (an interpretation of Hinterreiter p. 17, not proved against the figure); a triangle counts for the stretch with at least a quarter of its area inside
    const cells = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        if (tri) { cells.push([[i + 1, j], [i, j + 1], [i + 1, j + 1]]); cells.push([[i, j], [i + 1, j], [i, j + 1]]); }
        else cells.push([[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]);
    }
    const unit = tri ? 0.5 : 1;
    for (const cell of cells) {
        const poly = _projClipPoly(cell, planes), ar = _projArea(poly);
        if (ar < 1e-9) continue;
        W += tri ? 2 * ar : ar; withArea++;
        if (ar < 0.25 * unit) continue;
        const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length, cy = poly.reduce((s, q) => s + q[1], 0) / poly.length;
        const A = _projPx(P, cx - e, cy + e), B = _projPx(P, cx + e, cy - e), C = _projPx(P, cx - e, cy - e), D = _projPx(P, cx + e, cy + e);
        const asp = Math.abs(B.x - A.x) / Math.abs(D.y - C.y) * (tri ? Math.sqrt(3) : 1); stretch = Math.max(stretch, asp, 1 / asp);
    }
    return { valid: true, reason: null, W, tiles: { x: nx, y: ny }, tilesWithArea: withArea, stretch, editTile: _netProjEditTile(a, b, half, tri) };
}
function _netProjExportData(spec, shape) {
    spec = netProjectiveForShape(spec, shape);
    const tri = spec.family === '\u25b3N', hexa = spec.family === '*N', eff = netProjectiveEffective(spec, shape), W = typeof canvasW !== 'undefined' ? canvasW : 600, H = typeof canvasH !== 'undefined' ? canvasH : 600;
    const out = { version: 2, kind: 'projective', interpretation: true, family: spec.family, a: spec.a, b: spec.b, format: spec.format, geometryIsRegular: true, facesOmitted: false, layerFacesOmitted: true, canvas: { w: W, h: H } };
    if (hexa) out.cls = spec.cls | 0;   // task 127
    if (spec.interp === true) out.interp = true;
    if (!eff.valid) { out.projectiveIgnored = { reason: eff.reason }; return out; }
    const info = netProjectiveInfo(spec, W, H), half = spec.format === 'half', c = H * spec.a / (spec.b - spec.a);
    out.orientation = hexa ? 'the lattice lines p + q = const (edges of the fine triangle lattice, the Baren) run horizontally in the picture' : tri ? 'the lattice lines p + q = const (triangle edges, the Baren) run horizontally in the picture' : 'diagonal (lattice turned 45 degrees against the frame)';   // task 124: the triangle lattice has no 45 degree turn
    out.W = info.W; out.tiles = info.tiles; out.editTile = info.editTile;
    out.homography = { note: 'pixel = (r0 / r2, r1 / r2) with (r0, r1, r2) = rows . (p, q, 1); lattice coordinates (p, q) = (s + i, t + j) of the base frame; region p, q >= 0, a <= p + q <= b' + (half ? ', p >= q' : ''), rows: [half ? [W, -W, 0] : [W, 0, 0], [-c, -c, c * spec.b], [1, 1, 0]] };
    if (hexa) { out.tileShape = 'hexagon'; out.omission = 'the fine triangle lattice (p, q) loses the lattice points with p - q = cls (mod 3) and their edges: the hexagon centres (Hinterreiter II p. 14: Auslassen von Linien)'; }
    if (tri) out.tileShape = 'triangle';   // task 124: a tile is a triangle (the mesh = two); the square's export is unchanged
    out.facesMapping = hexa ? 'regular base hexagon; every hexagon tile is the image of the regular hexagon under the one homography of lattice coordinates (p, q) = (s + i, t + j) of the centroid-anchored fine lattice: polygon edges stay straight' : tri ? 'regular base triangle; every triangle tile (upright, or turned by 180 degrees) is the image of the regular triangle under the one homography of lattice coordinates (p, q) = (s + i, t + j): polygon edges stay straight'
        : 'regular central cell; every tile is the image of the regular tile under the one homography of lattice coordinates (p, q) = (s + i, t + j): polygon edges stay straight';
    return out;
}
function _netProjCompat(from, to) {
    const pf = _netIsProjective(from), pt = _netIsProjective(to);
    if (!(pf && pt)) return { ok: false, reason: 'a 3C net (Möbiusnetz) is turned 45° against the grid and cannot be interpolated with a Regular, Field, Single or Tiled net' };
    if (from.family !== to.family) return { ok: false, reason: `the 3C family differs (${from.family} vs ${to.family})` };   // task 124: first - a square and a triangle net never interpolate, whatever their format
    if (from.family === '*N' && (from.cls | 0) !== (to.cls | 0)) return { ok: false, reason: `the 3C omission class differs (${from.cls | 0} vs ${to.cls | 0})` };   // task 127: two hexagon nets with other hexagon centres do not interpolate
    if (from.format !== to.format) return { ok: false, reason: `the 3C format differs (${from.format} vs ${to.format})` };
    return { ok: true, reason: null };
}
