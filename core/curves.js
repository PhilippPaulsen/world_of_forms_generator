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

// Roadmap 1.5-A ('free' clothing): noise-construction constants, same
// "aesthetic, not primary-source-derived, tunable later" status as the
// CURVE_ASYM_* constants above. FREE_NUM_COMPONENTS is fixed (not
// roughness-dependent) - roughness instead scales FREQUENCY continuously
// (see _freeNoiseComponents()), per the 1.5 design session's point 5:
// one continuous parameter spanning geometric<->naturalistic, not a
// hardcoded binary style switch. FREE_SAMPLES_PER_CYCLE/MIN/MAX_SAMPLES
// size the chord-sampling resolution to the highest noise frequency in
// play, so high-roughness curves stay visually resolved without an
// unbounded piece count.
const FREE_NUM_COMPONENTS = 3;
const FREE_ROUGHNESS_FREQ_SCALE = 2.5;
const FREE_SAMPLES_PER_CYCLE = 12;
const FREE_MIN_SAMPLES = 8;
const FREE_MAX_SAMPLES = 150;

function _lerp(p1, p2, t) {
    return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
}

// Canonical string key for an unordered node-id pair - same convention
// as core/orbits.js's _pairKey()/core/faces.js's _undirectedKey(),
// reimplemented locally rather than cross-called for the same
// portability/no-cross-file-private-helper-dependency reason those two
// files already reimplement it independently of each other. Used by
// _connectionSeed() below so a connection drawn [3,7] or [7,3] (click
// order) derives the identical per-connection seed either way.
function _canonicalPairKey(a, b) {
    return a < b ? a + '-' + b : b + '-' + a;
}

// Roadmap 1.5-A: small, dependency-free 32-bit string hash (FNV-1a) -
// deterministic, pure function of its input string. Used only to turn
// (globalSeed, canonicalPairKey) into a per-connection integer seed,
// not as the noise generator itself (see _mulberry32()/
// _freeNoiseComponents() for that).
function _fnv1aHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

// Roadmap 1.5-A: the per-connection seed derivation the design session
// specified - hash(globalSeed, canonicalPairKey(id1, id2)). A pure
// function of (globalSeed, id1, id2) alone, so the identical connection
// (same two node ids, regardless of click order) always derives the
// identical seed, and hence the identical noise pattern, wherever it's
// drawn - required for every symmetry/tessellation copy of one base
// connection to show the SAME underlying wiggle, just transformed (see
// buildCurvePieces()'s 'free' branch and mirrorCurveType() below).
function _connectionSeed(globalSeed, id1, id2) {
    return _fnv1aHash(`${globalSeed || 0}:${_canonicalPairKey(id1, id2)}`);
}

// Roadmap 1.5-A: small deterministic PRNG (mulberry32 - public-domain,
// widely reproduced algorithm), seeded once per call. Used ONLY to
// derive a small, FIXED set of noise-component parameters from a seed
// (see _freeNoiseComponents()) - never advanced per sample point - so
// the actual noise function stays a pure function of (components, t),
// not a stateful sequential generator. That's what makes noise(t)
// evaluable at any t independently (needed for arbitrary chord
// sampling density) rather than only in a fixed left-to-right sequence.
function _mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Roadmap 1.5-A: derives FREE_NUM_COMPONENTS {freq, phase, weight}
// triples from a seed - called once per drawn connection-copy (not per
// sample point), so the actual per-sample noise evaluation
// (_evalFreeNoise()) stays cheap. `roughness` (continuous, unclamped
// below 0 - negative treated as 0) scales frequency only: higher
// roughness -> higher-frequency components -> more, smaller oscillations
// per unit chord length ("naturalistic"); roughness near 0 -> a few
// slow harmonics, close to a single smooth wave ("geometric") - one
// continuous knob spanning both named styles, not two hardcoded modes
// (1.5 design session, point 5). weight decays per component (1/(i+1),
// like natural harmonic falloff) independent of roughness, keeping the
// lowest component visually dominant at every roughness level. A small
// per-component frequency jitter (from the same seeded rand()) avoids
// perfectly-integer-harmonic, overly regular spacing.
function _freeNoiseComponents(seed, roughness) {
    const rand = _mulberry32(seed);
    const freqMultiplier = 1 + Math.max(0, roughness || 0) * FREE_ROUGHNESS_FREQ_SCALE;
    const components = [];
    for (let i = 0; i < FREE_NUM_COMPONENTS; i++) {
        const jitter = (rand() - 0.5) * 0.6;
        components.push({
            freq: (i + 1 + jitter) * freqMultiplier,
            phase: rand() * Math.PI * 2,
            weight: 1 / (i + 1)
        });
    }
    return components;
}

// Roadmap 1.5-A: the actual noise value at parameter t in [0,1] - a
// normalized (roughly [-1,1]) weighted sum of the seed-derived sine
// components, tapered by a sin(pi*t) envelope that forces the value to
// exactly 0 at t=0 and t=1. The envelope isn't cosmetic: Ostwald's own
// text requires "the node points themselves are held exact" - without
// it, the raw sine sum is generally nonzero at the endpoints (no reason
// for seed-derived phases to happen to vanish there), so the perturbed
// path would visibly detach from the actual node position, a real
// correctness bug for a THEME line, not just a cosmetic wobble - caught
// by this file's own regression test (see the 1.5-A implementation
// report) requiring buildCurvePieces()'s free path to end exactly at
// p2. Pure function of (components, t) only, as required for
// reproducibility (1.5 design session, point 2) - no p5 random(), no
// module-level mutable state.
function _evalFreeNoise(components, t) {
    let sum = 0, totalWeight = 0;
    components.forEach(c => {
        sum += c.weight * Math.sin(2 * Math.PI * c.freq * t + c.phase);
        totalWeight += c.weight;
    });
    const raw = totalWeight > 0 ? sum / totalWeight : 0;
    const envelope = Math.sin(Math.PI * t);
    return raw * envelope;
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
//
// Roadmap 1.5-A: extended to kind==='free' too, and the guard's old
// `!curveType.leaning` short-circuit is removed - a real, previously-
// dormant correctness gap, found while designing 'free's own mirroring
// (never manifested for 'curve' because sketch.js's toggle always sets
// leaning:'left' explicitly, never null). The geometric reason a flip
// is required even for null: buildCurvePieces() recomputes the
// perpendicular (nx,ny) fresh from whichever p1/p2 a given call
// receives; for a reflected copy, reflectVerticallyAround's specific
// mirror axis (negate x, keep y) means that freshly-recomputed
// perpendicular comes out as the NEGATIVE of the true reflected
// perpendicular vector, regardless of what leaning was set to,
// including null. Skipping the flip when leaning is null (the old
// behavior) left reflected copies of a null-leaning curve rendering on
// the geometrically wrong side - never reachable via the current UI,
// but a latent bug for any future null-leaning caller. Fixed by
// resolving null to its already-implicit default ('left', matching
// buildCurvePieces()'s own `leaning === 'right' ? -1 : 1` sign formula)
// before flipping, so mirroring is always well-defined. Re-verified
// this doesn't change behavior for any already-shipped (non-null)
// case - see the 1.5-A test suite.
function mirrorCurveType(curveType) {
    if (!curveType || (curveType.kind !== 'curve' && curveType.kind !== 'free')) return curveType;
    const currentLeaning = curveType.leaning || 'left';
    return {
        ...curveType,
        leaning: currentLeaning === 'left' ? 'right' : 'left'
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
//
// Roadmap 1.5-A: id1/id2 (the connection's own real node ids) are new,
// optional-in-signature-but-required-for-kind:'free' parameters - every
// other kind ignores them entirely. They can't be recovered from p1/p2
// themselves (already-transformed tile-local coordinates, not stable
// across a connection's own rotated/reflected/tessellated copies), so
// callers must thread them through explicitly - see core/symmetry.js's
// drawConnectionWithSymmetry() and core/tiling.js's drawShapeCell(),
// the two places real ids are naturally available.
function buildCurvePieces(p1, p2, curveType, id1, id2) {
    if (!curveType || curveType.kind === 'straight') {
        return [{ type: 'line', to: p2 }];
    }
    if (curveType.kind === 'compound') {
        throw new Error('buildCurvePieces: curveType.kind "compound" is not implemented yet (Roadmap 1.4-C)');
    }
    if (curveType.kind !== 'curve' && curveType.kind !== 'free') {
        throw new Error(`buildCurvePieces: unknown curveType.kind "${curveType.kind}"`);
    }

    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const distLine = sqrt(dx * dx + dy * dy);
    if (distLine < 0.0001) return [{ type: 'line', to: p2 }]; // degenerate zero-length connection

    const nx = -dy / distLine, ny = dx / distLine;
    // Roadmap 1.5-A: null/undefined leaning now resolves to 'left'
    // explicitly here too (was already the DE FACTO behavior via
    // `=== 'right' ? -1 : 1`'s own fallthrough - unchanged for 'curve';
    // shared verbatim by 'free' below so both kinds use the identical
    // sign convention mirrorCurveType() assumes).
    const sign = (curveType.leaning || 'left') === 'right' ? -1 : 1;
    const mag = (curveType.strength || 0) * CURVE_SCALE_F;
    if (mag < 0.0001) return [{ type: 'line', to: p2 }];

    if (curveType.kind === 'free') {
        // Roadmap 1.5-A: chord-sampling noise construction. Per-
        // connection seed (see _connectionSeed()) makes this connection's
        // own wiggle differ from every other connection's, while staying
        // IDENTICAL across every symmetry/tessellation copy of THIS SAME
        // connection (same id1/id2 passed regardless of which transformed
        // p1/p2 a given call received - see core/symmetry.js). `sign` here
        // plays the exact same dual role it does for kind:'curve': the
        // sign convention mirrorCurveType() must be able to flip for
        // reflected copies to come out as true mirror images (proven by
        // the same nx/ny-recomputed-from-local-chord argument that
        // motivated 'curve's own sign handling - reflectVerticallyAround's
        // specific mirror axis means a freshly-recomputed perpendicular is
        // the NEGATIVE of the true reflected one, independent of whether
        // the offset comes from a fixed fold formula or a noise function),
        // and (since the noise itself isn't perfectly zero-mean in
        // general, given the per-component random phase/frequency jitter)
        // a real, if subtle, visible left/right characteristic - not
        // purely invisible bookkeeping.
        const connSeed = _connectionSeed(curveType.seed, id1, id2);
        const components = _freeNoiseComponents(connSeed, curveType.roughness);
        const maxFreq = components[components.length - 1].freq;
        const K = Math.min(FREE_MAX_SAMPLES, Math.max(FREE_MIN_SAMPLES, Math.ceil(maxFreq * FREE_SAMPLES_PER_CYCLE)));

        // Roadmap 1.5-A: click-order invariance needs MORE than an
        // order-independent seed - _connectionSeed(id1,id2) is already
        // canonical, but core/tiling.js's drawShapeCell() looks up n1/n2
        // (and hence which physical point becomes p1 vs p2) from
        // conn[0]/conn[1] directly, so a connection drawn [A,B] vs [B,A]
        // reaches this function with p1/p2 (and dx/dy/nx/ny) actually
        // SWAPPED. Found live (not just theorized) via this file's own
        // browser regression check - see the 1.5-A implementation
        // report. Two things flip together when p1/p2 swap: (1) the
        // physical point at fraction t from the "later" id1 is the same
        // point as fraction (1-t) from the canonical-first id - so the
        // noise must be sampled at (1-t) instead of t; (2) the freshly-
        // recomputed (nx,ny) itself negates when the chord direction
        // reverses (same fact 'curve's own sign handling and
        // mirrorCurveType() already rely on), so the noise value must
        // ALSO be negated to compensate - one flip alone reproduces a
        // different (subtly mirrored-in-parameter-space) curve, not the
        // same one; both together exactly cancel out, verified by the
        // regression test comparing full [id1,id2] vs [id2,id1] builds
        // point-for-point, not just comparing seeds.
        const forward = id1 <= id2;
        const pieces = [];
        for (let i = 1; i <= K; i++) {
            const t = i / K;
            const noiseT = forward ? t : 1 - t;
            const noiseSign = forward ? 1 : -1;
            const noiseVal = noiseSign * _evalFreeNoise(components, noiseT);
            const base = _lerp(p1, p2, t);
            const offset = distLine * mag * sign * noiseVal;
            pieces.push({ type: 'line', to: { x: base.x + nx * offset, y: base.y + ny * offset } });
        }
        // "heimliches Gesetz" ("hidden law"): curveType.visible controls
        // whether the underlying straight theme-line is ALSO drawn,
        // alongside the free stroke, or stays hidden (default - the
        // notable "hidden law" effect Ostwald names is the hidden case,
        // so an unset/falsy `visible` hides the construction line rather
        // than showing it by default). When visible, a 'moveto' piece
        // (see drawCurvedBezier()) starts a genuinely separate subpath
        // back at p1 before tracing the plain chord to p2 - two distinct
        // visual strokes from one buildCurvePieces() call, both still
        // going through the exact same draw/SVG-collect dual-mode walk.
        if (curveType.visible) {
            pieces.push({ type: 'moveto', to: p1 });
            pieces.push({ type: 'line', to: p2 });
        }
        return pieces;
    }

    // kind === 'curve' from here on.
    const fold = curveType.fold;
    if (!Number.isInteger(fold) || fold < 1) {
        throw new Error(`buildCurvePieces: curveType.fold must be a positive integer, got ${fold}`);
    }

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
// Roadmap 1.5-A: id1/id2 added (see buildCurvePieces()'s own comment) -
// passed straight through, unused by this function itself.
function drawCurvedBezier(p1, p2, curveType, id1, id2) {
    if (segmentCollector) {
        segmentCollector.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
        return;
    }

    const pieces = buildCurvePieces(p1, p2, curveType, id1, id2);

    if (svgPathCollector) {
        let d = `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
        pieces.forEach(piece => {
            if (piece.type === 'line') {
                d += ` L ${piece.to.x.toFixed(2)} ${piece.to.y.toFixed(2)}`;
            } else if (piece.type === 'quad') {
                d += ` Q ${piece.control.x.toFixed(2)} ${piece.control.y.toFixed(2)} ${piece.to.x.toFixed(2)} ${piece.to.y.toFixed(2)}`;
            } else if (piece.type === 'cubic') {
                d += ` C ${piece.c1.x.toFixed(2)} ${piece.c1.y.toFixed(2)} ${piece.c2.x.toFixed(2)} ${piece.c2.y.toFixed(2)} ${piece.to.x.toFixed(2)} ${piece.to.y.toFixed(2)}`;
            } else if (piece.type === 'moveto') {
                // Roadmap 1.5-A: starts a genuinely separate subpath
                // within the SAME <path> d string - SVG paths natively
                // support multiple M commands in one d attribute, used
                // here so kind:'free' with visible:true can trace both
                // the wiggle AND the plain reference chord from one
                // buildCurvePieces() call/one drawCurvedBezier() call.
                d += ` M ${piece.to.x.toFixed(2)} ${piece.to.y.toFixed(2)}`;
            }
        });
        svgPathCollector.push(d);
        return;
    }

    // Die Linien sollen immer ungefüllt sein, aber noFill() nicht global setzen!
    // Wir setzen fill/stroke im draw() global, daher hier keine Änderung.
    let cur = p1;
    pieces.forEach(piece => {
        if (piece.type === 'moveto') {
            // Canvas needs no explicit "pen up" - each line()/bezier()
            // call already draws independently - just reposition the
            // walk cursor for whatever piece comes next.
            cur = piece.to;
            return;
        }
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
