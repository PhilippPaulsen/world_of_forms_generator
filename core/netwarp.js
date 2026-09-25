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
 * apply in a field (the micro grid is the clicked tile's own, uniform per tile).
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
// two-cell split (widths 1/(1+R) : R/(1+R), the ratio is R itself), so Em = 2 is offered too - but only when EVERY axis that
// is actually warped is geometric (`spec` = the net spec {x, y}; y 'same' = x): with a trig axis in play Em = 2 would silently
// flatten that axis. E must still be divisible by the offered count (netMacroEffective()).
function netSpecAllGeometric(spec) {
    if (!spec) return false;
    const axes = [spec.x, spec.y === 'same' ? spec.x : spec.y].filter(a => a && a.kind !== 'uniform' && a.w);
    return axes.length > 0 && axes.every(a => a.kind === 'geometric');
}
function netMacroOptions(E, spec) {
    const out = [];
    if (!(E >= 3) && !(E === 2 && netSpecAllGeometric(spec))) return out;
    if (E > NETWARP_MAX_E) return out;
    const from = netSpecAllGeometric(spec) ? 2 : 3;
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

// The smooth single-level law (unchanged since phase 1). E = divisions per tile (macro count when nested).
function _netSmoothLaw(axis, E) {
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

// ---- Field domain (Model 2): the law over the whole repeated span ----
const NETWARP_MAX_FIELD_TILES = 9;   // = the largest Shape Size the UI offers

// Which domain a spec asks for and which it gets: 'single' (one closed tile), 'tiled' (the wallpaper) or 'field'.
// Rt = the outer tile count along an axis (Shape Size) - only the field needs it. A spec without `domain` reads its
// legacy `repeat` boolean. An invalid request is IGNORED (falls back to the legacy reading), visibly: `ignored`.
function netDomainEffective(spec, Rt) {
    const legacy = spec && spec.repeat ? 'tiled' : 'single';
    const req = spec ? spec.domain : undefined;
    if (req === undefined || req === null) return { domain: legacy, ignored: null };
    if (req === 'single' || req === 'tiled') return { domain: req, ignored: null };
    let reason = null;
    if (req !== 'field') reason = `unknown domain '${req}'`;
    else if (!Number.isInteger(Rt)) reason = 'a field needs an integer tile count (Shape Size)';
    else if (Rt < 3) reason = 'a field needs at least 3 tiles (Shape Size 3, 5, 7 or 9): a trig law has no effect on 1 or 2 macro cells';
    else if (Rt % 2 === 0) reason = 'a field needs an odd tile count (odd Shape Size) so the base tile is the central cell';
    else if (Rt > NETWARP_MAX_FIELD_TILES) reason = `a field of ${Rt} tiles exceeds the ceiling ${NETWARP_MAX_FIELD_TILES}`;
    if (reason) return { domain: legacy, ignored: { requested: req, reason } };
    return { domain: 'field', ignored: null };
}

// The field law for one axis: F(sigma), sigma in tile units over [0,Rt] (the field), P_k = Rt*f(k/Rt), piecewise
// linear, linearly extended beyond the field. null = identity. F.field = {P, Rt} (its inverse is closed form).
function netFieldLaw(axis, Rt) {
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
    const dom = netDomainEffective(spec, Rt);
    const ax = spec.x, ay = spec.y === 'same' ? spec.x : spec.y;
    const isField = dom.domain === 'field';
    const fx = isField ? netFieldLaw(ax, Rt) : netAxisLaw(ax, E, spec.macro), fy = isField ? netFieldLaw(ay, Rt) : netAxisLaw(ay, E, spec.macro);
    if (!fx && !fy) return null;
    const { c0, v1, v2 } = frame;
    const det = v1.x * v2.y - v2.x * v1.y;
    if (!det) return null;
    return { fx, fy, altX: !isField && !!(ax && ax.alternate), altY: !isField && !!(ay && ay.alternate), repeat: dom.domain === 'tiled', domain: dom.domain, field: isField ? { Rt, h: (Rt - 1) / 2 } : null, domainIgnored: dom.ignored, c0, v1, v2, det };
}

function _netWarpAxis(f, alt, s) {
    const k = Math.floor(s), l = s - k;
    return (alt && (k & 1)) ? k + 1 - f(1 - l) : k + f(l);
}

// The warp for the base sheet as drawTessellation() uses it: square shapes only in Phase 1.
function netWarpForBase(spec, shape, corners, nodeCountValue, Rt) {
    if (!spec || shape !== 'square' || !corners || corners.length < 4) return null;
    const c0 = corners[0], c1 = corners[1], c3 = corners[3];
    return makeNetWarp(spec, { c0, v1: { x: c1.x - c0.x, y: c1.y - c0.y }, v2: { x: c3.x - c0.x, y: c3.y - c0.y } }, nodeCountValue - 1, Rt);
}

// Tile coordinates (s,t) of a point in the warp's frame: (0..1, 0..1) is the net's own tile.
function netWarpTileCoords(warp, pt) {
    const dx = pt.x - warp.c0.x, dy = pt.y - warp.c0.y;
    return { s: (dx * warp.v2.y - dy * warp.v2.x) / warp.det, t: (warp.v1.x * dy - warp.v1.y * dx) / warp.det };
}
// Whether a warp is a CLOSED net (one tile, no repetition) and whether a point lies inside it.
function netWarpIsClosed(warp) { return !!warp && !warp.repeat; }
function netWarpInsideNet(warp, pt) {
    const c = netWarpTileCoords(warp, pt);
    if (warp.field) { const h = warp.field.h; return c.s >= -h && c.s <= h + 1 && c.t >= -h && c.t <= h + 1; } // the whole field
    return c.s >= 0 && c.s <= 1 && c.t >= 0 && c.t <= 1;
}

function applyNetWarp(warp, pt) {
    const dx = pt.x - warp.c0.x, dy = pt.y - warp.c0.y;
    const s = (dx * warp.v2.y - dy * warp.v2.x) / warp.det;
    const t = (warp.v1.x * dy - warp.v1.y * dx) / warp.det;
    let x = pt.x, y = pt.y;
    if (warp.field) { // Model 2: one law over the whole field (sigma = tile coordinate + h), affine inside each tile
        const h = warp.field.h;
        if (warp.fx) { const d = warp.fx(s + h) - h - s; x += d * warp.v1.x; y += d * warp.v1.y; }
        if (warp.fy) { const d = warp.fy(t + h) - h - t; x += d * warp.v2.x; y += d * warp.v2.y; }
        return { x, y };
    }
    if (warp.fx) { const d = _netWarpAxis(warp.fx, warp.altX, s) - s; x += d * warp.v1.x; y += d * warp.v1.y; }
    if (warp.fy) { const d = _netWarpAxis(warp.fy, warp.altY, t) - t; x += d * warp.v2.x; y += d * warp.v2.y; }
    return { x, y };
}

// ---- Phase 2: the live base warp, its inverse, and the export description ----

// The ready warp for the CURRENT base sheet (null = regular net or a shape the warp does not apply
// to). Unlike activeNetWarp - installed only for the duration of one drawTessellation() - this is
// what UI code, face detection and export use to ask "is a warp in force right now".
function netWarpBaseNow() { return baseNetTransform ? netWarpForBase(baseNetTransform, currentShape, outerCorners, nodeCount, shapeSizeFactor) : null; }
function netWarpActive() { return netWarpBaseNow() !== null; }
// Whether face detection/fills are refused for a sheet under the CURRENT warp: on a FIELD the base sheet's faces are exact
// (F is affine inside every tile: faces are detected once on the regular cell, then mapped per tile), so only layers
// (`sheet` given: offset layers cross tile boundaries) stay refused; every other warp (Single, Tiled: F smooth inside the
// tile) refuses all faces.
function netWarpBlocksFaces(sheet) { const w = netWarpBaseNow(); return w !== null && (!w.field || !!sheet); }

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
    const dx = pt.x - warp.c0.x, dy = pt.y - warp.c0.y;
    const s = (dx * warp.v2.y - dy * warp.v2.x) / warp.det;
    const t = (warp.v1.x * dy - warp.v1.y * dx) / warp.det;
    let x = pt.x, y = pt.y;
    if (warp.field) { // closed form per tile of the field law
        const h = warp.field.h;
        if (warp.fx) { const d = _netFieldAxisInverse(warp.fx, s, h) - s; x += d * warp.v1.x; y += d * warp.v1.y; }
        if (warp.fy) { const d = _netFieldAxisInverse(warp.fy, t, h) - t; x += d * warp.v2.x; y += d * warp.v2.y; }
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
    const h = warp.field.h, c = netWarpTileCoords(warp, pt);
    const sr = warp.fx ? _netFieldAxisInverse(warp.fx, c.s, h) : c.s, tr = warp.fy ? _netFieldAxisInverse(warp.fy, c.t, h) : c.t;
    let i = Math.floor(sr), j = Math.floor(tr);
    if (i > h) i = h; if (j > h) j = h; if (i < -h) i = -h; if (j < -h) j = -h;   // a click exactly on the field's far edge
    const l = sr - i, m = tr - j;
    return { x: warp.c0.x + l * warp.v1.x + m * warp.v2.x, y: warp.c0.y + l * warp.v1.y + m * warp.v2.y, tile: { i, j }, local: { l, m } };
}

// meta.netTransform (export): the warp fully described, so the warped IMAGE is reproducible from
// the JSON. geometry.nodes/edges stay REGULAR (topology; SpaceHarmony's importer reads only those),
// hence geometryIsRegular; faces are not exported on a warped net (facesOmitted) - same "refuse
// visibly rather than export stale data" rule as the curve case, but flagged instead of silent.
// Resolved per axis (y 'same' expanded); `a` (trig angle, radians) and `R`/`q` (geometric) are
// derived values, written so a reader need not know the constants.
function netTransformExportData(spec, E, Rt) {
    const ax = spec.x, ay = spec.y === 'same' ? spec.x : spec.y;
    const describe = axis => {
        if (!axis || axis.kind === 'uniform' || !axis.w) return { kind: 'uniform' };
        if (axis.kind === 'trig') {
            const w = Math.max(-1, Math.min(1, axis.w));
            return { kind: 'trig', law: w < 0 ? 'sinus' : 'tangens', w, a: w < 0 ? -w * NETWARP_A_SIN : w * NETWARP_A_TAN };
        }
        // q is per MACRO cell (Em = E when not nested; the tile count Rt in a field)
        const qCount = isField ? Rt : eff.macro;
        return { kind: 'geometric', w: axis.w, R: Math.exp(axis.w), q: qCount >= 2 ? Math.exp(axis.w / (qCount - 1)) : null, alternate: !isField && !!axis.alternate };
    };
    const dom = netDomainEffective(spec, Rt), isField = dom.domain === 'field';
    const eff = isField ? { macro: E, micro: 1, valid: true } : netMacroEffective(spec.macro, E);
    const result = {
        version: 1, interpretation: true, domain: dom.domain === 'tiled' ? 'per-tile' : dom.domain, repeat: dom.domain === 'tiled', E, macro: eff.macro, micro: eff.micro,
        x: describe(ax), y: describe(ay),
        constants: { A_SIN: NETWARP_A_SIN, A_TAN: NETWARP_A_TAN },
        geometryIsRegular: true, facesOmitted: true
    };
    if (spec.macro !== undefined && spec.macro !== null && !eff.valid) result.macroIgnored = { requested: spec.macro, reason: eff.reason };
    if (isField) {
        // Faces: exact on a field (affine per tile) - the BASE faces are exported in regular central-cell coordinates, the space of
        // geometry.nodes/edges; layers stay omitted (offset layers cross tile boundaries).
        result.facesOmitted = false; result.layerFacesOmitted = true;
        result.facesMapping = 'regular central cell; each tile is the image under the per-tile affine map given by tileBoundaries';
        result.fieldTiles = Rt;   // the outer tile count = the number of macro cells per axis
        const ay = spec.y === 'same' ? spec.x : spec.y, bounds = axis => { const f = netFieldLaw(axis, Rt); return Array.from({ length: Rt + 1 }, (_, k) => f ? f.field.P[k] : k); };
        result.tileBoundaries = { unit: 'tiles', x: bounds(spec.x), y: bounds(ay) };   // P_k: where the tile boundaries sit in the field
        if (spec.macro !== undefined && spec.macro !== null) result.macroIgnored = { requested: spec.macro, reason: 'intra-tile macro does not apply in a field (the micro grid is the clicked tile\'s own)' };
    }
    if (dom.ignored) result.domainIgnored = dom.ignored;
    return result;
}
// The inverse of netTransformExportData(): the spec (as baseNetTransform holds it) from an
// exported meta.netTransform. Only kind/w/alternate/repeat are read - everything else is derived.
function netTransformFromExport(exported) {
    if (!exported || exported.version !== 1) return null;
    const axis = a => (!a || a.kind === 'uniform') ? { kind: 'uniform', w: 0 } : { kind: a.kind, w: a.w, alternate: !!a.alternate };
    // repeat: an export from before the closed-net option has neither field and was drawn repeated
    const isField = exported.domain === 'field';
    const repeat = isField ? false : (exported.repeat !== undefined ? !!exported.repeat : exported.domain !== 'single');
    const spec = { x: axis(exported.x), y: axis(exported.y), repeat };
    if (isField) spec.domain = 'field';
    if (Number.isInteger(exported.micro) && exported.micro > 1 && Number.isInteger(exported.macro)) spec.macro = exported.macro; // absent = not nested
    return spec;
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
    if (!corners || corners.length < 4 || !(E >= 1)) return [];
    const c0 = corners[0], c1 = corners[1], c3 = corners[3];
    const v1 = { x: c1.x - c0.x, y: c1.y - c0.y }, v2 = { x: c3.x - c0.x, y: c3.y - c0.y };
    const det = v1.x * v2.y - v2.x * v1.y;
    if (!det) return [];
    const ax = spec ? spec.x : null, ay = spec ? (spec.y === 'same' ? spec.x : spec.y) : null;
    if (opts.domain === 'field' && opts.fieldTiles >= 3) {
        // Model 2: macro lines = the tile boundaries P_k, micro lines = the clicked tile's own E divisions inside each
        const Rt = opts.fieldTiles, h = (Rt - 1) / 2, fxF = netFieldLaw(ax, Rt), fyF = netFieldLaw(ay, Rt), out = [];
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
