/*
 * core/spatial-morph.js
 * The weight mathematics of the STATIC, LINES-ONLY spatial morph (morph stage a1): keyframe layers sit at the corners of a region of the 2D tessellation, and every point
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        spatialMorphModes, spatialMorphClamp01, spatialMorphSmooth, spatialMorphNormalizeMode, spatialMorphDirection, spatialMorphScalar,
        spatialMorphUnit, spatialMorphUnitCoords, spatialMorphCornerWeights, spatialMorphBlendPoint,
    };
}
