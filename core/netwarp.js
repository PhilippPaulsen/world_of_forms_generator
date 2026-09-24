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
function netMacroOptions(E) {
    const out = [];
    if (!(E >= 3) || E > NETWARP_MAX_E) return out;
    for (let m = 3; m <= E; m++) if (E % m === 0) out.push(m);
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

// spec: {x: axis, y: axis | 'same'} (null/undefined = no warp). frame: {c0, v1, v2}. Returns a
// ready warp object or null when the spec changes nothing (so the sink stays untouched and the
// output is byte-identical to a build without this module).
function makeNetWarp(spec, frame, E) {
    if (!spec || !frame) return null;
    const ax = spec.x, ay = spec.y === 'same' ? spec.x : spec.y;
    const fx = netAxisLaw(ax, E, spec.macro), fy = netAxisLaw(ay, E, spec.macro);
    if (!fx && !fy) return null;
    const { c0, v1, v2 } = frame;
    const det = v1.x * v2.y - v2.x * v1.y;
    if (!det) return null;
    return { fx, fy, altX: !!(ax && ax.alternate), altY: !!(ay && ay.alternate), repeat: !!spec.repeat, c0, v1, v2, det };
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

// Tile coordinates (s,t) of a point in the warp's frame: (0..1, 0..1) is the net's own tile.
function netWarpTileCoords(warp, pt) {
    const dx = pt.x - warp.c0.x, dy = pt.y - warp.c0.y;
    return { s: (dx * warp.v2.y - dy * warp.v2.x) / warp.det, t: (warp.v1.x * dy - warp.v1.y * dx) / warp.det };
}
// Whether a warp is a CLOSED net (one tile, no repetition) and whether a point lies inside it.
function netWarpIsClosed(warp) { return !!warp && !warp.repeat; }
function netWarpInsideNet(warp, pt) { const c = netWarpTileCoords(warp, pt); return c.s >= 0 && c.s <= 1 && c.t >= 0 && c.t <= 1; }

function applyNetWarp(warp, pt) {
    const dx = pt.x - warp.c0.x, dy = pt.y - warp.c0.y;
    const s = (dx * warp.v2.y - dy * warp.v2.x) / warp.det;
    const t = (warp.v1.x * dy - warp.v1.y * dx) / warp.det;
    let x = pt.x, y = pt.y;
    if (warp.fx) { const d = _netWarpAxis(warp.fx, warp.altX, s) - s; x += d * warp.v1.x; y += d * warp.v1.y; }
    if (warp.fy) { const d = _netWarpAxis(warp.fy, warp.altY, t) - t; x += d * warp.v2.x; y += d * warp.v2.y; }
    return { x, y };
}

// ---- Phase 2: the live base warp, its inverse, and the export description ----

// The ready warp for the CURRENT base sheet (null = regular net or a shape the warp does not apply
// to). Unlike activeNetWarp - installed only for the duration of one drawTessellation() - this is
// what UI code, face detection and export use to ask "is a warp in force right now".
function netWarpBaseNow() { return baseNetTransform ? netWarpForBase(baseNetTransform, currentShape, outerCorners, nodeCount) : null; }
function netWarpActive() { return netWarpBaseNow() !== null; }

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
    if (warp.fx) { const d = _netWarpAxisInverse(warp.fx, warp.altX, s) - s; x += d * warp.v1.x; y += d * warp.v1.y; }
    if (warp.fy) { const d = _netWarpAxisInverse(warp.fy, warp.altY, t) - t; x += d * warp.v2.x; y += d * warp.v2.y; }
    return { x, y };
}

// meta.netTransform (export): the warp fully described, so the warped IMAGE is reproducible from
// the JSON. geometry.nodes/edges stay REGULAR (topology; SpaceHarmony's importer reads only those),
// hence geometryIsRegular; faces are not exported on a warped net (facesOmitted) - same "refuse
// visibly rather than export stale data" rule as the curve case, but flagged instead of silent.
// Resolved per axis (y 'same' expanded); `a` (trig angle, radians) and `R`/`q` (geometric) are
// derived values, written so a reader need not know the constants.
function netTransformExportData(spec, E) {
    const ax = spec.x, ay = spec.y === 'same' ? spec.x : spec.y;
    const describe = axis => {
        if (!axis || axis.kind === 'uniform' || !axis.w) return { kind: 'uniform' };
        if (axis.kind === 'trig') {
            const w = Math.max(-1, Math.min(1, axis.w));
            return { kind: 'trig', law: w < 0 ? 'sinus' : 'tangens', w, a: w < 0 ? -w * NETWARP_A_SIN : w * NETWARP_A_TAN };
        }
        // q is per MACRO cell (Em = E when not nested)
        return { kind: 'geometric', w: axis.w, R: Math.exp(axis.w), q: eff.macro >= 2 ? Math.exp(axis.w / (eff.macro - 1)) : null, alternate: !!axis.alternate };
    };
    const eff = netMacroEffective(spec.macro, E);
    const result = {
        version: 1, interpretation: true, domain: spec.repeat ? 'per-tile' : 'single', repeat: !!spec.repeat, E, macro: eff.macro, micro: eff.micro,
        x: describe(ax), y: describe(ay),
        constants: { A_SIN: NETWARP_A_SIN, A_TAN: NETWARP_A_TAN },
        geometryIsRegular: true, facesOmitted: true
    };
    if (spec.macro !== undefined && spec.macro !== null && !eff.valid) result.macroIgnored = { requested: spec.macro, reason: eff.reason };
    return result;
}
// The inverse of netTransformExportData(): the spec (as baseNetTransform holds it) from an
// exported meta.netTransform. Only kind/w/alternate/repeat are read - everything else is derived.
function netTransformFromExport(exported) {
    if (!exported || exported.version !== 1) return null;
    const axis = a => (!a || a.kind === 'uniform') ? { kind: 'uniform', w: 0 } : { kind: a.kind, w: a.w, alternate: !!a.alternate };
    // repeat: an export from before the closed-net option has neither field and was drawn repeated
    const repeat = exported.repeat !== undefined ? !!exported.repeat : exported.domain !== 'single';
    const spec = { x: axis(exported.x), y: axis(exported.y), repeat };
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
