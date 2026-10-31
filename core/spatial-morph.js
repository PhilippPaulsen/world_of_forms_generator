/*
 * core/spatial-morph.js
 * The weight mathematics (stage a1), the GEOMETRY (stage a2), the PARAMETERS as data (stage b) and the pure helpers of the render hook (stage c) of the STATIC, LINES-ONLY spatial morph: keyframe layers sit at the corners of a region of the 2D tessellation, and every point
 * of it (a tile centroid, or a point on a tile seam) is a blend of them with its own weights. This file turns a point into four corner weights and blends four corner
 * points with them. Nothing else: the keyframes' line alignment and the boundary anchoring come in stage a2, the render hook in stage c.
 * Pure: explicit arguments, plain data in and out, no globals, no p5, no DOM, no timers, no input is changed. Every top-level name starts with spatialMorph (the file is a
 * classic script in the browser, where a top-level name is a global shared with p5 and the other scripts). Tested in tools/morph/test-spatial-morph.js.
 *
 * Derived from the prototype core/spatialMorph.js (worktree world_of_forms_morph_v2, branch prototype/spatial-morph-v2) with its wave OFF: computeSpatialMorphScalar(),
 * computeSpatialMorphWeight(), computeSpatialMorphBilinearWeights(), applySpatialMorphPhase() with phase 0 and ping-pong off (= a clamp), smoothCosineWeight(), bilerpPoint().
 * Left out on purpose (not part of the static case): phaseT, ping-pong, spatialFrequency ("spread": it only enters the ping-pong branch, cos((spread*u + phase)*2pi)),
 * the wave speed, the modulo wrap, the aligned sample point (dead code in the prototype).
 *
 * THE SPAN (explicit bounds, passed in by the caller): { scalarMin, scalarMax, minX, maxX, minY, maxY }.
 *   linear and radial use scalarMin / scalarMax: the smallest and largest value of spatialMorphScalar() over the tiles. bilinear uses minX / maxX / minY / maxY: the extent of the tiles.
 *   (the prototype keeps both in one object and stores the scalar bounds in xMin / xMax for the 1D modes; here they have their own names.) How the caller freezes the span is a
 *   render concern: the prototype scans all tile centroids that lie strictly inside the canvas (0, W) x (0, H) once per lattice (shape, size, mode, angle) and keeps the
 *   result (computeSpatialMorphSpan / getFrozenSpatialMorphSpan); the first and the last tile centroids of the scan define the corners, NOT the canvas edges.
 *
 * THE MODES
 *   'linear'   angleDeg in degrees, in canvas coordinates (x to the right, y DOWN): the weight grows along the direction (cos a, sin a). 0 = left to right, 90 = top to bottom,
 *              180 = right to left, 270 = bottom to top, 45 = towards the lower right. Any finite angle works (the UI will offer steps of 45); a multiple of 90 is exact.
 *              scalar = x * cos a + y * sin a;   u = clamp01((scalar - scalarMin) / (scalarMax - scalarMin));   v = 0.
 *   'radial'   scalar = distance of the point from options.center (the canvas centre in the prototype); u as above;   v = 0. The bounds are the nearest and the farthest TILE
 *              (not 0 and the corner distance): u is 0 at the nearest and 1 at the farthest tile centroid.
 *   'bilinear' u = clamp01((x - minX) / (maxX - minX)),  v = clamp01((y - minY) / (maxY - minY)).
 *   A zero or negative span, a NaN, an infinity or a missing bound gives 0 for that coordinate (the prototype does the same); a point outside the bounds is clamped to 0 or 1.
 *   An unknown mode is 'linear'; a missing or non-finite angle is 0.
 * THE WEIGHTS: su = spatialMorphSmooth(u), sv = spatialMorphSmooth(v), w00 = (1-su)(1-sv), w10 = su(1-sv), w01 = (1-su)sv, w11 = su sv  (K00 top left, K10 top right, K01 bottom
 * left, K11 bottom right). In the 1D modes v is 0, so the weights are (1-su, su, 0, 0): the prototype uses K01 = K00 and K11 = K10 there, which blends the same. They sum to 1.
 * The weights depend ONLY on the point and the span (and the angle / centre): two callers that evaluate the same world point get the same numbers, which is what keeps the
 * seams between tiles closed.
 */

const spatialMorphModes = Object.freeze(['linear', 'radial', 'bilinear']);

// A number clamped to [0, 1]; anything that is not a finite number is 0 (a NaN or an infinity must never travel on).
function spatialMorphClamp01(t) {
    if (typeof t !== 'number' || !Number.isFinite(t)) return 0;
    return t < 0 ? 0 : (t > 1 ? 1 : t);
}

// The smooth weight 0.5 * (1 - cos(pi * t)) of a t clamped to [0, 1]: 0 at 0, 0.5 at 0.5, 1 at 1, and a zero slope at both ends (so the speed of a blend does not jump at a cell edge).
function spatialMorphSmooth(t) {
    return 0.5 * (1.0 - Math.cos(spatialMorphClamp01(t) * Math.PI));
}

// 'linear' | 'radial' | 'bilinear'; anything else is 'linear'.
function spatialMorphNormalizeMode(mode) {
    if (mode === 'radial') return 'radial';
    if (mode === 'bilinear') return 'bilinear';
    return 'linear';
}

// The unit direction { x, y } of an angle in degrees (canvas coordinates, y down): exact for the multiples of 90, cos / sin otherwise; a non-finite angle is 0 degrees.
function spatialMorphDirection(angleDeg) {
    const a = (typeof angleDeg === 'number' && Number.isFinite(angleDeg)) ? angleDeg : 0;
    const norm = ((a % 360) + 360) % 360;
    if (norm === 0) return { x: 1, y: 0 };
    if (norm === 90) return { x: 0, y: 1 };
    if (norm === 180) return { x: -1, y: 0 };
    if (norm === 270) return { x: 0, y: -1 };
    const rad = (a * Math.PI) / 180;
    return { x: Math.cos(rad), y: Math.sin(rad) };
}

// The scalar a 1D mode projects a point on: linear = x cos a + y sin a, radial = the distance from options.center (default the origin), bilinear = x (the prototype's value, unused by
// the weights). options = { angleDeg, center: { x, y } }. May be NaN for a NaN point; spatialMorphUnit() turns that into 0.
function spatialMorphScalar(mode, point, options) {
    const m = spatialMorphNormalizeMode(mode);
    const p = point || {};
    const o = options || {};
    if (m === 'radial') {
        const c = o.center || {};
        const cx = (typeof c.x === 'number' && Number.isFinite(c.x)) ? c.x : 0;
        const cy = (typeof c.y === 'number' && Number.isFinite(c.y)) ? c.y : 0;
        return Math.hypot(p.x - cx, p.y - cy);
    }
    if (m === 'bilinear') return p.x;
    const d = spatialMorphDirection(o.angleDeg);
    return p.x * d.x + p.y * d.y;
}

// (value - lo) / (hi - lo) clamped to [0, 1]; a span that is not positive, or any value that is not a finite number, gives 0.
function spatialMorphUnit(value, lo, hi) {
    const span = hi - lo;
    if (!(span > 0)) return 0;
    const raw = (value - lo) / span;
    return Number.isFinite(raw) ? spatialMorphClamp01(raw) : 0;
}

// The unit coordinates { u, v } of a point over a span (see the header), BEFORE the smoothing. options = { angleDeg, center }.
function spatialMorphUnitCoords(mode, point, span, options) {
    const m = spatialMorphNormalizeMode(mode);
    const s = span || {};
    const p = point || {};
    if (m === 'bilinear') {
        return { u: spatialMorphUnit(p.x, s.minX, s.maxX), v: spatialMorphUnit(p.y, s.minY, s.maxY) };
    }
    return { u: spatialMorphUnit(spatialMorphScalar(m, p, options), s.scalarMin, s.scalarMax), v: 0 };
}

// The four corner weights { w00, w10, w01, w11 } of a point: the unit coordinates, smoothed, as the product of the two 1D weights (see the header). They sum to 1.
function spatialMorphCornerWeights(mode, point, span, options) {
    const uv = spatialMorphUnitCoords(mode, point, span, options);
    const su = spatialMorphSmooth(uv.u);
    const sv = spatialMorphSmooth(uv.v);
    return { w00: (1 - su) * (1 - sv), w10: su * (1 - sv), w01: (1 - su) * sv, w11: su * sv };
}

// The blend { x, y } of four corner points p00, p10, p01, p11 with weights { w00, w10, w01, w11 }, in the prototype's order of operations (bilerpPoint).
function spatialMorphBlendPoint(p00, p10, p01, p11, w) {
    return {
        x: w.w00 * p00.x + w.w10 * p10.x + w.w01 * p01.x + w.w11 * p11.x,
        y: w.w00 * p00.y + w.w10 * p10.y + w.w01 * p01.y + w.w11 * p11.y,
    };
}

// =====================================================================================================================================================================================
// STAGE a2: the geometry. Which line endpoints sit at the four corners, how a whole line set is blended, and how an endpoint on the OUTER POLYGON EDGE stays seamless between
// neighbouring tiles. Derived from the prototype's resolveSpatialMorphCornerKeyframes(), _prepareSpatialMorphLines(), findContainingOuterEdge(), projectPointToSegment() and the
// boundary branch of drawSpatialMorphCell(). The render stage (c) stays responsible for what needs the page: aligning the keyframe layers through the PROTECTED sketch.js function
// resolveTimelineKeyframeCoords() (pairing, flips, members), freezing the span, the tile transforms (toTileLocal, the symmetry operations) and ignoring the layers' own offset, rotation
// and scale (the prototype draws every keyframe with the sheet's own grid; the timeline requires the same shape, order, size and symmetry mode of its keyframes, not the same offset).
//
// A LINE is { x1, y1, x2, y2 } in canvas pixels (the layer's own node coordinates, as resolveConnectionsToCoords() makes them); a LINE SET is an array of lines; the CORNERS are
// { k00, k10, k01, k11 }, four line sets of the same length (K00 top left, K10 top right, K01 bottom left, K11 bottom right).
//
// THE ANCHORING RULE (the prototype's, exact): an endpoint has four positions, one per corner. It is ON THE BOUNDARY when any of the four lies within tol (1 px) of an edge of the outer
// polygon (outerCorners: the corners of the base cell, 3 / 4 / 6 of them, consecutive); it is MOVED when its four positions are not all equal (largest pairwise distance > 1e-4 px).
//   not on the boundary          -> the four positions are blended with the weights of the TILE (the tile centroid).
//   on the boundary, not moved   -> it stays at its position (corner K00's).
//   on the boundary and moved    -> the four positions are first PROJECTED onto the one edge that contains them (clamped to the edge), then blended with the weights of the EDGE:
//                                   the weights evaluated at the world image of the MIDPOINT of that edge (under the tile's transform and the symmetry operation being drawn),
//                                   NOT at the tile centroid and not at the endpoint itself. Two tiles that share an edge see the same world midpoint, so every endpoint that slides
//                                   on that edge gets the same weights from both sides: the seam stays closed (measured in tools/morph/test-spatial-morph-seams.js).
// The edge that contains the four positions is the one with the most positions within tol; ties go to the edge that holds K00's position, then to the smaller sum of distances, then
// to the lower index (findContainingOuterEdge).
// =====================================================================================================================================================================================

const spatialMorphBoundaryTolerance = 1.0;      // px: how close to an outer edge an endpoint counts as lying on it (the prototype's SPATIAL_MORPH_BOUNDARY_EPS)
const spatialMorphSamePointTolerance = 1e-4;    // px: below this spread the four positions of an endpoint are one point (SPATIAL_MORPH_SAME_PT_EPS)

// A finite number or 0 (garbage in, finite out).
function spatialMorphNumber(v) {
    return (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
}

function spatialMorphIsLine(l) {
    return l !== null && typeof l === 'object' && ['x1', 'y1', 'x2', 'y2'].every((k) => typeof l[k] === 'number');
}

// Checks the four corner line sets; never throws. { ok: true, count } or { ok: false, code, detail } with code one of
// 'not-object' (no corners object), 'missing-corner' (detail: the name), 'not-array' (detail: the name), 'empty' (no lines at all), 'count-mismatch' (detail: the counts),
// 'bad-line' (detail: 'k01[2]': not an object with the four numbers), 'bad-number' (detail: 'k01[2].x1': NaN or an infinity).
function spatialMorphValidateCorners(corners) {
    if (corners === null || typeof corners !== 'object') return { ok: false, code: 'not-object', detail: typeof corners };
    const names = ['k00', 'k10', 'k01', 'k11'];
    for (const n of names) {
        if (!(n in corners)) return { ok: false, code: 'missing-corner', detail: n };
        if (!Array.isArray(corners[n])) return { ok: false, code: 'not-array', detail: n };
    }
    const count = corners.k00.length;
    const lens = names.map((n) => corners[n].length);
    if (lens.some((l) => l !== count)) return { ok: false, code: 'count-mismatch', detail: lens.join(',') };
    if (count === 0) return { ok: false, code: 'empty', detail: '0' };
    for (const n of names) {
        for (let i = 0; i < count; i++) {
            const l = corners[n][i];
            if (!spatialMorphIsLine(l)) return { ok: false, code: 'bad-line', detail: n + '[' + i + ']' };
            for (const k of ['x1', 'y1', 'x2', 'y2']) if (!Number.isFinite(l[k])) return { ok: false, code: 'bad-number', detail: n + '[' + i + '].' + k };
        }
    }
    return { ok: true, count };
}

// WHICH layers are the keyframes, as the prototype chooses them. layers = array indexed like additionalLayers of { shape, lineCount, isPlayback } (lineCount: the number of lines as
// resolveConnectionsToCoords() counts them; isPlayback: the prototype's isTimelinePlayback). options = { mode, timelineIds, base, fillFromLayers }.
// BILINEAR mode (resolveSpatialMorphCornerKeyframes), up to four layers:
//   1. the timeline's keyframe ids (when there are at least two), in order: the first one that is not a playback layer and has lines is the REFERENCE; every later one with the same
//      shape and line count is taken, up to four.
//   2. fillFromLayers (default true, the prototype's behaviour): with fewer than four, the other layers in index order that match the reference (or, with no reference yet, the first
//      layer that is not a playback layer) are added. Pass false to use timeline keyframes only.
//   3. with fewer than two so far and exactly ONE layer that is not a playback layer, options.base = { shape, lineCount } (the base sheet) is keyframe 0 and that layer keyframe 1
//      when they match; the id is the string 'base'.
// LINEAR and RADIAL mode (resolveSpatialMorphKeyframes) use exactly TWO keyframes and no shape or count filter: the timeline's first two ids when it has at least two; otherwise the
// first two layers that are not playback layers; otherwise the base fallback of rule 3. (The caller's alignment then fails for layers that do not match: the pair is not checked here.)
// Returns { ok: true, ids, source } (source: 'keyframes' | 'layers' | 'base') or { ok: false, code: 'no-pair' }. The caller aligns the lines of these layers (stage c).
function spatialMorphSelectKeyframeLayers(layers, options) {
    const L = Array.isArray(layers) ? layers : [];
    const o = options || {};
    const usable = (i) => Number.isInteger(i) && i >= 0 && i < L.length && L[i] !== null && typeof L[i] === 'object' && !L[i].isPlayback;
    const count = (i) => (Number.isFinite(L[i].lineCount) ? L[i].lineCount : 0);
    const tl = Array.isArray(o.timelineIds) && o.timelineIds.length >= 2 ? o.timelineIds : null;
    const users = [];
    for (let i = 0; i < L.length; i++) if (usable(i)) users.push(i);
    const baseFallback = () => {
        const b = o.base;
        if (users.length === 1 && b && typeof b === 'object' && b.lineCount > 0 && b.lineCount === count(users[0]) && b.shape === L[users[0]].shape) {
            return { ok: true, ids: ['base', users[0]], source: 'base' };
        }
        return { ok: false, code: 'no-pair' };
    };
    if (spatialMorphNormalizeMode(o.mode) !== 'bilinear') {
        if (tl && usable(tl[0]) && usable(tl[1]) && tl[0] !== tl[1]) return { ok: true, ids: [tl[0], tl[1]], source: 'keyframes' };
        if (users.length >= 2) return { ok: true, ids: [users[0], users[1]], source: 'layers' };
        return baseFallback();
    }
    const ids = [];
    if (tl) {
        const first = tl.find((id) => usable(id) && count(id) > 0);
        if (first !== undefined) {
            for (let i = 0; i < tl.length && ids.length < 4; i++) {
                const id = tl[i];
                if (!usable(id)) continue;
                if (count(id) === count(first) && L[id].shape === L[first].shape && !ids.includes(id)) ids.push(id);
            }
        }
    }
    if (ids.length < 4 && o.fillFromLayers !== false) {
        let ref = ids.length > 0 ? ids[0] : (users.length > 0 ? users[0] : -1);
        if (ref >= 0 && count(ref) > 0) {
            for (let i = 0; i < L.length && ids.length < 4; i++) {
                if (!usable(i) || ids.includes(i)) continue;
                if (count(i) === count(ref) && L[i].shape === L[ref].shape) ids.push(i);
            }
        }
    }
    if (ids.length >= 2) return { ok: true, ids, source: tl && ids.some((id) => tl.includes(id)) ? 'keyframes' : 'layers' };
    return baseFallback();
}

// THE CORNER RULE: from the ALIGNED line sets of the keyframes (K0, K1, K2, K3: the lines in K0's order and orientation, the caller's job) to the four corners.
// BILINEAR: 2 keyframes: K00 = K0, K10 = K1, K01 = K0, K11 = K1 (a morph along x only: the same as the uniform timeline morph); 3: K01 = K2, K11 = K1; 4: all four; more than four: the
// first four. LINEAR and RADIAL (any other mode, as a1 normalises it) use only K0 and K1 whatever is given (the prototype's resolveSpatialMorphKeyframes): K01 = K0, K11 = K1; a third
// keyframe must not take part there, it would change which endpoints count as moved.
// The arrays are the SAME arrays (nothing is copied; k01 and k00 may be one array). Returns { ok, k00, k10, k01, k11, keyframeCount } or { ok: false, code: 'too-few-keyframes' }.
function spatialMorphChooseCorners(keyframes, mode) {
    const K = Array.isArray(keyframes) ? keyframes.filter((k) => Array.isArray(k)) : [];
    if (K.length < 2) return { ok: false, code: 'too-few-keyframes' };
    const bil = spatialMorphNormalizeMode(mode) === 'bilinear';
    const k2 = bil && K.length >= 3 ? K[2] : null;
    const k3 = bil && K.length >= 4 ? K[3] : null;
    return { ok: true, k00: K[0], k10: K[1], k01: k2 || K[0], k11: k3 || K[1], keyframeCount: bil ? Math.min(4, K.length) : 2 };
}

// The blend of a whole line set at one set of weights { w00, w10, w01, w11 }: both endpoints of every line, with the stage a1 blend; returns NEW lines, the corners are not changed.
// When the corners are the two-keyframe form (k01 IS k00 and k11 IS k10, the same arrays) the result is the timeline's own interpolation, bit for bit: lerp(a, b, t) =
// t * (b - a) + a with t = w10 + w11 (core: applyLayerConnectionsMorphFrame). A non-finite coordinate counts as 0.
function spatialMorphBlendLines(corners, w) {
    const c = corners || {};
    const k00 = Array.isArray(c.k00) ? c.k00 : [];
    const n = k00.length;
    const w4 = w || {};
    const uniform = c.k01 === c.k00 && c.k11 === c.k10;
    const t = spatialMorphNumber(w4.w10) + spatialMorphNumber(w4.w11);
    const wt = { w00: spatialMorphNumber(w4.w00), w10: spatialMorphNumber(w4.w10), w01: spatialMorphNumber(w4.w01), w11: spatialMorphNumber(w4.w11) };
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
        const a = k00[i] || {};
        if (uniform) {
            const b = (Array.isArray(c.k10) && c.k10[i]) || {};
            const lerp = (p, q) => t * (spatialMorphNumber(q) - spatialMorphNumber(p)) + spatialMorphNumber(p);
            out[i] = { x1: lerp(a.x1, b.x1), y1: lerp(a.y1, b.y1), x2: lerp(a.x2, b.x2), y2: lerp(a.y2, b.y2) };
        } else {
            const b = (Array.isArray(c.k10) && c.k10[i]) || {}, d = (Array.isArray(c.k01) && c.k01[i]) || {}, e = (Array.isArray(c.k11) && c.k11[i]) || {};
            const pt = (l, kx, ky) => ({ x: spatialMorphNumber(l[kx]), y: spatialMorphNumber(l[ky]) });
            const p1 = spatialMorphBlendPoint(pt(a, 'x1', 'y1'), pt(b, 'x1', 'y1'), pt(d, 'x1', 'y1'), pt(e, 'x1', 'y1'), wt);
            const p2 = spatialMorphBlendPoint(pt(a, 'x2', 'y2'), pt(b, 'x2', 'y2'), pt(d, 'x2', 'y2'), pt(e, 'x2', 'y2'), wt);
            out[i] = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
        }
    }
    return out;
}

// The projection of a point on the segment v -> w, clamped to the segment: { x, y, t, dist } (t = 0..1 along the segment). A zero-length segment projects to v with t = 0.
// A non-finite coordinate anywhere gives null (no number is invented).
function spatialMorphProjectToSegment(pt, v, w) {
    if (!pt || !v || !w) return null;
    const all = [pt.x, pt.y, v.x, v.y, w.x, w.y];
    if (!all.every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
    const dx = w.x - v.x, dy = w.y - v.y;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return { x: v.x, y: v.y, t: 0, dist: Math.hypot(pt.x - v.x, pt.y - v.y) };
    const t = Math.max(0, Math.min(1, ((pt.x - v.x) * dx + (pt.y - v.y) * dy) / l2));
    const px = v.x + t * dx, py = v.y + t * dy;
    return { x: px, y: py, t, dist: Math.hypot(pt.x - px, pt.y - py) };
}

// The midpoint { x, y } of edge `index` of a polygon (the edge from poly[index] to poly[(index + 1) % n]); the origin for an invalid polygon or index.
function spatialMorphEdgeMidpoint(poly, index) {
    if (!Array.isArray(poly) || poly.length < 2 || !Number.isInteger(index) || index < 0 || index >= poly.length) return { x: 0, y: 0 };
    const v = poly[index], w = poly[(index + 1) % poly.length];
    if (!v || !w) return { x: 0, y: 0 };
    return { x: 0.5 * (spatialMorphNumber(v.x) + spatialMorphNumber(w.x)), y: 0.5 * (spatialMorphNumber(v.y) + spatialMorphNumber(w.y)) };
}

function spatialMorphTolerance(tol) {
    return (typeof tol === 'number' && Number.isFinite(tol) && tol >= 0) ? tol : spatialMorphBoundaryTolerance;
}

// Is the point on an edge of the outer polygon? The nearest edge (lowest index on a tie: a polygon corner belongs to two edges and gets the lower one) when its distance is at most
// tol (default 1 px; 0 means exactly on it; a negative or non-finite tol is the default). Returns { edge, t, dist, x, y } (t: the parameter along that edge, x / y: the foot point)
// or null: not on an edge, fewer than three polygon points, a non-finite coordinate.
function spatialMorphOnEdge(pt, poly, tol) {
    if (!pt || !Array.isArray(poly) || poly.length < 3) return null;
    const lim = spatialMorphTolerance(tol);
    let best = null;
    for (let i = 0; i < poly.length; i++) {
        const pr = spatialMorphProjectToSegment(pt, poly[i], poly[(i + 1) % poly.length]);
        if (!pr) return null;
        if (best === null || pr.dist < best.dist) best = { edge: i, t: pr.t, dist: pr.dist, x: pr.x, y: pr.y };
    }
    return best !== null && best.dist <= lim ? best : null;
}

// The ONE edge that contains the four positions of an endpoint (findContainingOuterEdge): the edge with the most positions within tol; ties: the edge that holds the first position,
// then the smaller sum of distances, then the lower index. Returns { edge, v, w, mid } or null (no polygon).
function spatialMorphFindContainingEdge(points, poly, tol) {
    if (!Array.isArray(points) || points.length === 0 || !Array.isArray(poly) || poly.length < 3) return null;
    const lim = spatialMorphTolerance(tol);
    let best = -1, bestCount = -1, bestFirst = false, bestSum = Infinity;
    for (let i = 0; i < poly.length; i++) {
        const v = poly[i], w = poly[(i + 1) % poly.length];
        let count = 0, sum = 0, first = false;
        for (let k = 0; k < points.length; k++) {
            const pr = spatialMorphProjectToSegment(points[k], v, w);
            const d = pr ? pr.dist : Infinity;
            sum += d;
            if (d <= lim) { count++; if (k === 0) first = true; }
        }
        if (count > bestCount || (count === bestCount && first && !bestFirst) || (count === bestCount && first === bestFirst && sum < bestSum)) { best = i; bestCount = count; bestFirst = first; bestSum = sum; }
    }
    if (best < 0) return null;
    const v = poly[best], w = poly[(best + 1) % poly.length];
    return { edge: best, v: { x: v.x, y: v.y }, w: { x: w.x, y: w.y }, mid: spatialMorphEdgeMidpoint(poly, best) };
}

// What the renderer has to know about ONE endpoint of ONE line, from its four positions (points = [K00, K10, K01, K11] positions as { x, y }): see the anchoring rule in the header.
//   { onBoundary, moved, edge: { edge, v, w, mid } | null, points (copies), edgePoints (the four positions projected on the edge when onBoundary and moved, else copies),
//     sample: the canonical point whose WORLD image the caller evaluates the edge weights at = the edge midpoint (the first position when there is no edge) }
// options = { tol, sameTol }.
function spatialMorphPrepareEndpoint(points, poly, options) {
    const o = options || {};
    const tol = spatialMorphTolerance(o.tol);
    const sameTol = (typeof o.sameTol === 'number' && Number.isFinite(o.sameTol) && o.sameTol >= 0) ? o.sameTol : spatialMorphSamePointTolerance;
    const pts = [0, 1, 2, 3].map((k) => { const p = (Array.isArray(points) && points[k]) || {}; return { x: spatialMorphNumber(p.x), y: spatialMorphNumber(p.y) }; });
    let spread = 0;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) spread = Math.max(spread, Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y));
    const onBoundary = pts.some((p) => spatialMorphOnEdge(p, poly, tol) !== null);
    const moved = spread > sameTol;
    const edge = onBoundary ? spatialMorphFindContainingEdge(pts, poly, tol) : null;
    let edgePoints = pts.map((p) => ({ x: p.x, y: p.y }));
    if (edge && moved) edgePoints = pts.map((p) => { const pr = spatialMorphProjectToSegment(p, edge.v, edge.w); return pr ? { x: pr.x, y: pr.y } : { x: p.x, y: p.y }; });
    return { onBoundary, moved, edge, points: pts, edgePoints, sample: edge ? { x: edge.mid.x, y: edge.mid.y } : { x: pts[0].x, y: pts[0].y } };
}

// The descriptors of a whole corner set: one { a, b } per line (the two endpoints), in the corners' order. The caller validates the corners first (spatialMorphValidateCorners).
function spatialMorphPrepareLines(corners, poly, options) {
    const c = corners || {};
    const k00 = Array.isArray(c.k00) ? c.k00 : [];
    const pos = (set, i, kx, ky) => { const l = (Array.isArray(set) && set[i]) || {}; return { x: l[kx], y: l[ky] }; };
    return k00.map((_, i) => ({
        a: spatialMorphPrepareEndpoint([pos(c.k00, i, 'x1', 'y1'), pos(c.k10, i, 'x1', 'y1'), pos(c.k01, i, 'x1', 'y1'), pos(c.k11, i, 'x1', 'y1')], poly, options),
        b: spatialMorphPrepareEndpoint([pos(c.k00, i, 'x2', 'y2'), pos(c.k10, i, 'x2', 'y2'), pos(c.k01, i, 'x2', 'y2'), pos(c.k11, i, 'x2', 'y2')], poly, options),
    }));
}

// The canonical position { x, y } of one prepared endpoint. wTile = the weights at the TILE (its centroid), wEdge = the weights at the world image of desc.sample (the edge midpoint).
// Not on the boundary: blend with wTile. On the boundary and not moved: the fixed position. On the boundary and moved: blend the edge points with wEdge; without a usable wEdge the
// fixed position of K00 (never wTile: the tile's weights would open the seam).
function spatialMorphAnchoredPoint(desc, wTile, wEdge) {
    const d = desc || { onBoundary: false, moved: false, points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], edgePoints: [{ x: 0, y: 0 }] };
    const okW = (w) => w && typeof w === 'object' && ['w00', 'w10', 'w01', 'w11'].every((k) => typeof w[k] === 'number' && Number.isFinite(w[k]));
    if (!d.onBoundary) return (d.moved && okW(wTile)) ? spatialMorphBlendPoint(d.points[0], d.points[1], d.points[2], d.points[3], wTile) : { x: d.points[0].x, y: d.points[0].y };   // not moved: the position itself (a blend of four equal points could differ by an ulp)
    if (!d.moved || !okW(wEdge)) return { x: d.edgePoints[0].x, y: d.edgePoints[0].y };
    return spatialMorphBlendPoint(d.edgePoints[0], d.edgePoints[1], d.edgePoints[2], d.edgePoints[3], wEdge);
}

// One prepared line as a line { x1, y1, x2, y2 }: the endpoints may lie on different edges, so each has its own edge weights.
function spatialMorphAnchoredLine(prepared, wTile, wEdgeA, wEdgeB) {
    const p = prepared || {};
    const a = spatialMorphAnchoredPoint(p.a, wTile, wEdgeA), b = spatialMorphAnchoredPoint(p.b, wTile, wEdgeB);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

// =====================================================================================================================================================================================
// STAGE b: the PARAMETERS of the morph as data. core/state.js holds them in one project-level object { enabled, mode, angleDeg } (the let spatialMorph), core/session.js saves and checks
// them, core/session-apply.js restores them; these three pure functions are the only place that knows the defaults and the rules, so the saver, the checker and the tests agree.
//   enabled  boolean, default false. mode  'linear' | 'radial' | 'bilinear', default 'linear' (anything else is 'linear'). angleDeg  any finite number of degrees, default 0 (used by
//   linear only; a negative, fractional or 360+ value is kept as it is, -0 becomes 0; a NaN, an infinity or a non-number is 0).
// Nothing else is a parameter of the first version (no speed, spread, wave, ping-pong, faces).
// =====================================================================================================================================================================================

// A fresh default object each call (callers may keep and change it).
function spatialMorphDefaults() {
    return { enabled: false, mode: 'linear', angleDeg: 0 };
}

// Any value -> a NEW normalised parameter object: a missing, malformed or wrong-typed field falls back to its own default (field by field); the input is not changed and nothing throws.
function spatialMorphNormalize(v) {
    const d = spatialMorphDefaults();
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return d;
    return {
        enabled: v.enabled === true,
        mode: (typeof v.mode === 'string' && spatialMorphModes.includes(v.mode)) ? v.mode : d.mode,
        angleDeg: (typeof v.angleDeg === 'number' && Number.isFinite(v.angleDeg)) ? (v.angleDeg === 0 ? 0 : v.angleDeg) : d.angleDeg,
    };
}

// Are two parameter values the same after normalising? (spatialMorphEqual(x, undefined) is "is x the defaults".)
function spatialMorphEqual(a, b) {
    const x = spatialMorphNormalize(a), y = spatialMorphNormalize(b);
    return x.enabled === y.enabled && x.mode === y.mode && x.angleDeg === y.angleDeg;
}

// =====================================================================================================================================================================================
// STAGE c: pure helpers for the render hook (core/spatial-morph-render.js does the drawing; everything here is data in, data out).
// =====================================================================================================================================================================================

// The status codes the render hook reports (read by stage e, no UI text now). 'off': the switch is off. 'ok': the morph was drawn. 'netActive': the morph was drawn WITHOUT the net
// that is in force (the prototype ignores the net as well). The others: the normal frame was drawn instead ('renderError': something threw).
const spatialMorphStatusCodes = Object.freeze(['off', 'ok', 'netActive', 'needsTwoKeyframes', 'shapeMismatch', 'lineCountMismatch', 'alignmentFailed', 'renderError']);

// Which layers are the keyframes AND why not (the pre-conditions of the morph): spatialMorphSelectKeyframeLayers() plus the rule of the maintainers: the keyframes have the SAME shape and
// the same line count. layers = [{ shape, lineCount, isPlayback }], options as for the selection ({ mode, timelineIds, base }). A layer with no lines is not a keyframe.
//   -> { ok: true, ids, source } | { ok: false, code: 'needsTwoKeyframes' | 'shapeMismatch' | 'lineCountMismatch' }
function spatialMorphPlanKeyframes(layers, options) {
    const L = Array.isArray(layers) ? layers : [];
    const o = options || {};
    const sel = spatialMorphSelectKeyframeLayers(L, o);
    const info = (id) => (id === 'base' ? o.base : L[id]);
    if (sel.ok) {
        const ref = info(sel.ids[0]);
        for (const id of sel.ids) {
            const l = info(id);
            if (!l || !ref) return { ok: false, code: 'needsTwoKeyframes' };
            if (l.shape !== ref.shape) return { ok: false, code: 'shapeMismatch' };
            if (l.lineCount !== ref.lineCount) return { ok: false, code: 'lineCountMismatch' };
        }
        return sel;
    }
    // why not: look at the first two layers that could be keyframes (in the timeline's order when there is one)
    const tl = Array.isArray(o.timelineIds) && o.timelineIds.length >= 2 ? o.timelineIds : null;
    const order = [];
    (tl || []).forEach((id) => { if (!order.includes(id)) order.push(id); });
    for (let i = 0; i < L.length; i++) if (!order.includes(i)) order.push(i);
    const usable = order.filter((i) => Number.isInteger(i) && i >= 0 && i < L.length && L[i] && typeof L[i] === 'object' && !L[i].isPlayback && Number.isFinite(L[i].lineCount) && L[i].lineCount > 0);
    if (usable.length < 2) return { ok: false, code: 'needsTwoKeyframes' };
    const a = L[usable[0]], b = L[usable[1]];
    if (a.shape !== b.shape) return { ok: false, code: 'shapeMismatch' };
    if (a.lineCount !== b.lineCount) return { ok: false, code: 'lineCountMismatch' };
    return { ok: false, code: 'needsTwoKeyframes' };
}

// The symmetry operations a tile draws for a shape and a symmetry mode, in the order core/symmetry.js drawConnectionWithSymmetry() draws them: the identity, the rotations, then (with a
// reflection) the reflection and the reflected rotations. -> { ops: [{ angle, reflected }], hasReflection }
function spatialMorphSymmetryOps(shape, mode) {
    let rot = [];
    const r3 = mode === 'rotation3' || mode === 'rotation_reflection3', r6 = mode === 'rotation6' || mode === 'rotation_reflection6';
    if (shape === 'square') { if (r3 || r6) rot = [90, 180, 270]; }
    else if (shape === 'triangle') { if (r3 || r6) rot = [120, 240]; }
    else if (shape === 'hex') { if (r3) rot = [120, 240]; else if (r6) rot = [60, 120, 180, 240, 300]; }
    const hasReflection = mode === 'reflection_only' || mode === 'rotation_reflection3' || mode === 'rotation_reflection6';
    const ops = [{ angle: 0, reflected: false }];
    rot.forEach((a) => ops.push({ angle: a, reflected: false }));
    if (hasReflection) {
        ops.push({ angle: 0, reflected: true });
        if (mode !== 'reflection_only') rot.forEach((a) => ops.push({ angle: a, reflected: true }));
    }
    return { ops, hasReflection };
}

// The SPAN (see the header) of a set of tile centroids, as the prototype scans it: the centroids strictly inside the canvas (0, W) x (0, H) first, then the closed canvas, then all of them;
// the first scan whose scalar range (linear / radial) or x range (bilinear) is wider than 1e-3 wins; nothing wide enough gives { 0..W, 0..H }. For the y range the prototype keeps 0..H
// when the centroids have none. mode as for spatialMorphScalar (an unknown mode is linear); options = { angleDeg, center } (the centre of radial: the canvas centre).
function spatialMorphSpanFromCentroids(mode, centroids, canvasW, canvasH, options) {
    const m = spatialMorphNormalizeMode(mode);
    const W = (typeof canvasW === 'number' && Number.isFinite(canvasW) && canvasW > 0) ? canvasW : 600;
    const H = (typeof canvasH === 'number' && Number.isFinite(canvasH) && canvasH > 0) ? canvasH : 600;
    const o = options || {};
    const opts = { angleDeg: o.angleDeg, center: o.center || { x: W / 2, y: H / 2 } };
    const EPS = 1e-3;
    const list = Array.isArray(centroids) ? centroids.filter((c) => c && Number.isFinite(c.x) && Number.isFinite(c.y)) : [];
    const scan = (pred) => {
        let minS = Infinity, maxS = -Infinity, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let k = 0; k < list.length; k++) {
            const c = list[k];
            if (!pred(c)) continue;
            const v = m === 'bilinear' ? c.x : spatialMorphScalar(m, c, opts);
            if (v < minS) minS = v; if (v > maxS) maxS = v;
            if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x;
            if (c.y < minY) minY = c.y; if (c.y > maxY) maxY = c.y;
        }
        return { minS, maxS, minX, maxX, minY, maxY };
    };
    const make = (r) => ({
        scalarMin: r.minS, scalarMax: r.maxS, minX: r.minX, maxX: r.maxX,
        minY: (r.maxY - r.minY > EPS) ? r.minY : 0, maxY: (r.maxY - r.minY > EPS) ? r.maxY : H,
    });
    const wide = (r) => r.maxS - r.minS > EPS && r.maxX - r.minX > EPS;
    const strict = scan((c) => c.x > EPS && c.x < W - EPS && c.y > EPS && c.y < H - EPS);
    if (wide(strict)) return make(strict);
    const closed = scan((c) => c.x >= -EPS && c.x <= W + EPS && c.y >= -EPS && c.y <= H + EPS);
    if (wide(closed)) return make(closed);
    const all = scan(() => true);
    if (wide(all)) return make(all);
    return { scalarMin: 0, scalarMax: W, minX: 0, maxX: W, minY: 0, maxY: H };
}

// The key a frozen span is valid for: the lattice (shape, polygon, canvas, number and ends of the tile list) and the projection (mode, angle for linear). Same key = same span, so the
// render hook computes it once; a rebuilt grid, another shape, size, mode, angle or canvas gives another key. Pure string.
function spatialMorphSpanKey(mode, angleDeg, shape, polygon, canvasW, canvasH, centroids) {
    const m = spatialMorphNormalizeMode(mode);
    const a = m === 'linear' ? spatialMorphNumber(angleDeg) : 0;
    const r = (v) => Math.round(spatialMorphNumber(v) * 100);
    const poly = (Array.isArray(polygon) ? polygon : []).map((p) => (p ? r(p.x) + ',' + r(p.y) : '-')).join(';');
    const list = Array.isArray(centroids) ? centroids : [];
    const f = list[0] || {}, l = list[list.length - 1] || {};
    return [m, a, String(shape), poly, r(canvasW), r(canvasH), list.length, r(f.x), r(f.y), r(l.x), r(l.y)].join('|');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        spatialMorphModes, spatialMorphClamp01, spatialMorphSmooth, spatialMorphNormalizeMode, spatialMorphDirection, spatialMorphScalar,
        spatialMorphUnit, spatialMorphUnitCoords, spatialMorphCornerWeights, spatialMorphBlendPoint,
        spatialMorphBoundaryTolerance, spatialMorphSamePointTolerance, spatialMorphNumber, spatialMorphIsLine, spatialMorphValidateCorners, spatialMorphSelectKeyframeLayers, spatialMorphChooseCorners,
        spatialMorphBlendLines, spatialMorphProjectToSegment, spatialMorphEdgeMidpoint, spatialMorphTolerance, spatialMorphOnEdge, spatialMorphFindContainingEdge, spatialMorphPrepareEndpoint,
        spatialMorphPrepareLines, spatialMorphAnchoredPoint, spatialMorphAnchoredLine,
        spatialMorphDefaults, spatialMorphNormalize, spatialMorphEqual,
        spatialMorphStatusCodes, spatialMorphPlanKeyframes, spatialMorphSymmetryOps, spatialMorphSpanFromCentroids, spatialMorphSpanKey,
    };
}
