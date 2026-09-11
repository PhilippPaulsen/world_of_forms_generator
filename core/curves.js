/**
 * core/curves.js
 * Curve substitution for straight theme lines. Part of the portable
 * "core" module set (see CLAUDE.md). Roadmap 1.4-A: a parametric curve
 * engine replacing the old single curveAmount number with a curveType
 * struct - fold count (open-ended, not capped at 3 - see ROADMAP.md's
 * 1.4 entry, corrected against Ostwald's primary text rather than the
 * earlier "18 cases" reconstruction), symmetric/asymmetric, left-/
 * right-leaning, and a continuous strength. 1.4-B (the actual named
 * cases wired to UI) and 1.4-C (compound lines) build on this but are
 * NOT this pass - `kind: 'compound'` is a recognized value in the type
 * but throws "not implemented" if actually reached (see
 * buildCurvePieces()), and there's deliberately no UI here.
 *
 * Two sections, same split as core/faces.js: CURVE TYPE MODEL (the
 * curveType struct's own logic - mirrorCurveType(), buildCurvePieces()'s
 * geometry - kept together since, unlike faces.js/orbits.js, this file
 * has never claimed p5-independence: it already used p5's sqrt()/abs()
 * globals before this pass and keeps doing so here, for consistency
 * with itself rather than introducing a second convention) and CURVE
 * RENDERING (drawCurvedBezier() - the triple-mode draw/SVG-collect/
 * segment-collect dispatch, unchanged in spirit from before).
 *
 * Triple-mode: draws to the canvas normally, or - when state.js's
 * svgPathCollector is set to an array - appends SVG path data instead
 * of drawing, so exportSVG() can reuse the exact same geometry/symmetry
 * code path as the on-screen render (see core/export.js); or - when
 * segmentCollector is set - appends a raw straight-chord {x1,y1,x2,y2}
 * segment instead, for roadmap 1.10a's face-detection (see
 * core/faces.js). segmentCollector is checked first and always
 * collects the straight p1->p2 chord regardless of curveType - see
 * the state.js comment on segmentCollector for why (unchanged: still
 * straight-line-only, curve-aware face detection is still out of scope).
 */

// ----------------- CURVE TYPE MODEL ---------------------------------

// Offset-magnitude scale, unchanged from the pre-1.4-A code's own
// scaleF: strength=25 (the old binary "on" value) produces the exact
// same visual magnitude as before, keeping the eventual UI migration
// (1.4-B) a pure relabeling of the same numeric range rather than a
// rescale.
const CURVE_SCALE_F = 0.01;

// Aesthetic constants for the asymmetric ("leaning") constructions
// below - NOT derived from any primary source (see ROADMAP.md's 1.4
// entry: Ostwald's own text doesn't specify how asymmetry is
// constructed, only that it exists as a dimension), chosen to be
// visibly distinct from the symmetric case without being extreme.
// Tunable later; not an external contract anything depends on yet.
const CURVE_ASYM_SHIFT_1FOLD = 0.15;   // fold=1: peak shift, fraction of chord
const CURVE_ASYM_SHIFT_2FOLD = 0.08;   // fold=2: control-point shift, fraction of chord
const CURVE_ASYM_SKEW_EXPONENT = 1.6;  // fold>=3: lobe-boundary spacing skew

function _lerp(p1, p2, t) {
    return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
}

// Monotonic reparametrization of [0,1] used to skew lobe-boundary
// spacing for asymmetric fold>=3 curves: compresses boundaries toward
// the p1 end (denser, smaller lobes there) and stretches them toward
// p2 (sparser, larger lobes), while keeping the endpoints fixed at 0/1
// exactly - t_i values stay a valid increasing sequence for any fold.
//
// Deliberately NOT parametrized by curveType.leaning (an earlier draft
// of this file tried that and failed its own reflection regression
// test - see the 1.4-A implementation report): peak/lobe skew is a
// property of WHICH ENDPOINT (p1 vs p2, i.e. click order) a theme-line
// leans toward, which is topological and unaffected by either rotation
// or reflection (reflectVerticallyAround/rotateAround move p1 and p2,
// they never swap which one is "p1"). `leaning` instead controls ONLY
// the perpendicular bulge side - an embedding-relative property that
// DOES need to flip under reflection (see mirrorCurveType()) - keeping
// these two concerns decoupled is what makes the reflection case come
// out geometrically correct.
function _skewParam(u, exponent) {
    return Math.pow(u, exponent);
}

// Roadmap 1.4-A: mirrors a curveType for a reflected copy - the
// generalization of the pre-1.4-A code's `-curveAmount` sign flip
// (core/symmetry.js used to negate the bare number for every reflected
// copy). Only `leaning` carries handedness in the new struct (fold/
// symmetric/strength/kind are all reflection-invariant - a curve's
// fold count, its symmetric-vs-asymmetric shape, and its strength
// don't change under a mirror, only which side it leans toward does),
// so this flips exactly that one field and nothing else. Verified
// geometrically for triangle/D3 in the 1.4-A implementation session:
// a rotated copy keeps the SAME local leaning (rotation preserves
// chord-relative handedness - drawConnectionWithSymmetry() calls
// drawCurvedBezier() with the curveType UNCHANGED for rotated copies,
// exactly as the old code left curveAmount unchanged for rotations),
// while a reflected copy's curve must have the OPPOSITE local leaning
// (a mirror image of a right-leaning curve IS left-leaning by
// definition - not a bug to avoid, the correct behavior for a true
// mirror pair/Spiegeling, docs/terminology.md Part A).
//
// kind==='straight' has no leaning to flip (returns curveType
// unchanged - still correct to call this on a straight connection,
// no special-casing needed at call sites). kind==='compound' passes
// through unchanged for now too - it has no implemented fields to flip
// yet (compound lines are 1.4-C, not this pass); revisit when a
// compound-specific handedness field (e.g. a meeting-angle sign) is
// actually added.
function mirrorCurveType(curveType) {
    if (!curveType || curveType.kind !== 'curve' || !curveType.leaning) return curveType;
    return {
        ...curveType,
        leaning: curveType.leaning === 'left' ? 'right' : 'left'
    };
}

// Roadmap 1.4-A: the actual geometry - given two endpoints and a
// curveType, returns an ordered array of "pieces" describing how to
// trace the connection from p1 to p2. Each piece is one of:
//   { type: 'line', to }                  - straight segment
//   { type: 'quad', control, to }         - quadratic-equivalent arc
//                                            (matches the pre-1.4-A
//                                            code's own single-control-
//                                            point construction exactly
//                                            for fold===1 symmetric)
//   { type: 'cubic', c1, c2, to }         - true cubic (fold===2's
//                                            two-independent-control-
//                                            point S-curve)
// drawCurvedBezier() below walks this SAME array for both canvas
// drawing and SVG-path collection, so the two can never drift apart -
// directly extending the pre-1.4-A dual-mode pattern (which had this
// property by construction, one function, one geometry computation,
// two output branches) rather than reworking it.
//
// fold===1: single piece, byte-identical geometry to the pre-1.4-A
// code when symmetric (peakT===0.5, the exact old midpoint - see the
// 1.4-A implementation report's regression test).
// fold===2: single cubic piece, two independent control points at
// (roughly) the chord's 1/3 and 2/3 points, offset in OPPOSITE
// perpendicular directions - a true S-curve, not two chained arcs
// (this is the one case NOT built via the general fold>=3 chaining
// below, per the 1.4-A design session: a real cubic reads as
// noticeably smoother than two small chained quadratics would).
// fold>=3: fold chained quadratic-equivalent arcs, one per lobe,
// alternating bulge direction, each spanning 1/fold of the chord (or
// an unevenly-skewed sub-span when asymmetric - see _skewParam()).
// Generalizes cleanly to any fold>=1 (fold===1 is literally the N=1
// case of this same per-lobe construction, though implemented as its
// own branch above for exact byte-identical-with-the-old-code
// regression testing rather than relying on the general loop
// collapsing to N=1 identically by coincidence).
//
// Practical ceiling (measured, not just asserted - see the 1.4-A
// implementation report): each lobe's own offset is
// (chord length / fold) * strength * CURVE_SCALE_F - i.e. it shrinks
// proportionally to 1/fold for a fixed strength, so at high fold
// values the curve visually converges back toward a straight line
// with imperceptibly small high-frequency wiggles well before any
// canvas/SVG performance limit is reached; the per-segment draw cost
// itself (one more bezier()/Q-command per lobe) stays cheap even at
// several dozen segments - real numbers in the implementation report,
// not asserted here.
function buildCurvePieces(p1, p2, curveType) {
    if (!curveType || curveType.kind === 'straight') {
        return [{ type: 'line', to: p2 }];
    }
    if (curveType.kind === 'compound') {
        throw new Error('buildCurvePieces: curveType.kind "compound" is not implemented yet (Roadmap 1.4-C)');
    }
    if (curveType.kind !== 'curve') {
        throw new Error(`buildCurvePieces: unknown curveType.kind "${curveType.kind}"`);
    }
    const fold = curveType.fold;
    if (!Number.isInteger(fold) || fold < 1) {
        throw new Error(`buildCurvePieces: curveType.fold must be a positive integer, got ${fold}`);
    }

    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const distLine = sqrt(dx * dx + dy * dy);
    if (distLine < 0.0001) return [{ type: 'line', to: p2 }]; // degenerate zero-length connection

    const nx = -dy / distLine, ny = dx / distLine;
    const sign = curveType.leaning === 'right' ? -1 : 1;
    const mag = (curveType.strength || 0) * CURVE_SCALE_F;
    if (mag < 0.0001) return [{ type: 'line', to: p2 }];

    // Asymmetric peak/lobe skew (below) always shifts toward the p1 end,
    // by a fixed convention - NOT toward `leaning`'s side. See
    // _skewParam()'s own comment: this keeps the asymmetric SHAPE
    // (a which-endpoint, click-order-relative property) decoupled from
    // `leaning` (a which-side-of-the-chord, embedding-relative
    // property) - only the latter needs to flip under reflection.

    if (fold === 1) {
        const peakT = curveType.symmetric ? 0.5 : 0.5 - CURVE_ASYM_SHIFT_1FOLD;
        const peak = _lerp(p1, p2, peakT);
        const offset = distLine * mag * sign;
        const control = { x: peak.x + nx * offset, y: peak.y + ny * offset };
        return [{ type: 'quad', control, to: p2 }];
    }

    if (fold === 2) {
        const shift = curveType.symmetric ? 0 : -CURVE_ASYM_SHIFT_2FOLD;
        const t1 = 1 / 3 + shift, t2 = 2 / 3 + shift;
        const offset = distLine * mag * sign;
        const b1 = _lerp(p1, p2, t1), b2 = _lerp(p1, p2, t2);
        const c1 = { x: b1.x + nx * offset, y: b1.y + ny * offset };
        const c2 = { x: b2.x - nx * offset, y: b2.y - ny * offset };
        return [{ type: 'cubic', c1, c2, to: p2 }];
    }

    // fold >= 3
    const boundaries = [];
    for (let i = 0; i <= fold; i++) {
        const u = i / fold;
        boundaries.push(curveType.symmetric ? u : _skewParam(u, CURVE_ASYM_SKEW_EXPONENT));
    }
    // Each piece implicitly starts where the previous one ended (p1 for
    // the first) - drawCurvedBezier() below walks the array that way,
    // so only each lobe's OWN end point and control point are needed
    // here, not its start.
    const pieces = [];
    for (let i = 0; i < fold; i++) {
        const segEnd = _lerp(p1, p2, boundaries[i + 1]);
        const segMidT = (boundaries[i] + boundaries[i + 1]) / 2;
        const peak = _lerp(p1, p2, segMidT);
        const segLen = distLine * (boundaries[i + 1] - boundaries[i]);
        const segSign = sign * (i % 2 === 0 ? 1 : -1);
        const offset = segLen * mag * segSign;
        const control = { x: peak.x + nx * offset, y: peak.y + ny * offset };
        pieces.push({ type: 'quad', control, to: segEnd });
    }
    return pieces;
}

// ----------------- CURVE RENDERING -----------------------------------
function drawCurvedBezier(p1, p2, curveType) {
    if (segmentCollector) {
        segmentCollector.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
        return;
    }

    const pieces = buildCurvePieces(p1, p2, curveType);

    if (svgPathCollector) {
        let d = `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
        pieces.forEach(piece => {
            if (piece.type === 'line') {
                d += ` L ${piece.to.x.toFixed(2)} ${piece.to.y.toFixed(2)}`;
            } else if (piece.type === 'quad') {
                d += ` Q ${piece.control.x.toFixed(2)} ${piece.control.y.toFixed(2)} ${piece.to.x.toFixed(2)} ${piece.to.y.toFixed(2)}`;
            } else if (piece.type === 'cubic') {
                d += ` C ${piece.c1.x.toFixed(2)} ${piece.c1.y.toFixed(2)} ${piece.c2.x.toFixed(2)} ${piece.c2.y.toFixed(2)} ${piece.to.x.toFixed(2)} ${piece.to.y.toFixed(2)}`;
            }
        });
        svgPathCollector.push(d);
        return;
    }

    // Die Linien sollen immer ungefüllt sein, aber noFill() nicht global setzen!
    // Wir setzen fill/stroke im draw() global, daher hier keine Änderung.
    let cur = p1;
    pieces.forEach(piece => {
        if (piece.type === 'line') {
            line(cur.x, cur.y, piece.to.x, piece.to.y);
        } else if (piece.type === 'quad') {
            // Same "cubic with both control points collapsed to one
            // point == quadratic" equivalence the pre-1.4-A code relied
            // on (p5 has no native quadratic bezier() call).
            bezier(cur.x, cur.y, piece.control.x, piece.control.y, piece.control.x, piece.control.y, piece.to.x, piece.to.y);
        } else if (piece.type === 'cubic') {
            bezier(cur.x, cur.y, piece.c1.x, piece.c1.y, piece.c2.x, piece.c2.y, piece.to.x, piece.to.y);
        }
        cur = piece.to;
    });
}
