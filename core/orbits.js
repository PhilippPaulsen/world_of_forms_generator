/**
 * core/orbits.js
 * Roadmap 1.11-A: symmetry-orbit reduction for theme-lines (node-pairs)
 * within a single sheet - the "Zweier/Dreier/Vierer" combinatorics
 * (docs/terminology.md, Part A) that 1.11's naming scheme (Part B) is
 * built on. Part of the portable "core" module set (see CLAUDE.md).
 *
 * Scope, per the 1.11 design session: this reduces individual node-
 * pairs to symmetry-equivalence classes ("orbits") under the ACTIVE
 * dihedral/cyclic group for one shape+symmetryMode - not 1.9's N-sheet
 * offset overlay (a continuous parameter, not a discrete group element,
 * so it has no orbit structure of this kind), and not 1.10's rendered-
 * face topology (a distinct, already-confirmed-independent dependency).
 *
 * Two tiers, same separation as core/faces.js:
 *  - Pure geometry (group construction, node-permutation via coordinate
 *    snapping, union-find orbit partitioning, canonical indexing, the
 *    Burnside-lemma cross-check) - zero p5 dependency, uses Math.* not
 *    p5's global aliases, reimplemented independently of core/symmetry.js
 *    even where the algorithm is identical (rotateAround/
 *    reflectVerticallyAround), matching core/faces.js's own precedent
 *    (_buildFaceAdjacency's docblock) of not cross-depending on a
 *    p5-dependent sibling file for portability's sake.
 *  - Live-app glue (computeThemeLineOrbitTable()) - reads the live
 *    nodes/centroid/currentShape/symmetryMode globals, mirroring
 *    core/faces.js's computeCellFaces().
 *
 * Verified in the 1.11 design session (real computation, not estimate):
 * union-find orbit-tracing and the Burnside-lemma count agree exactly
 * across 12 real (shape, order) cases up to hex order 6 (127 nodes, 12
 * group elements, 8,001 raw pairs -> 726 orbits), each computing in
 * well under 30ms - no caching architecture needed here, unlike 1.10b's
 * rendering cost.
 */

// ----------------- PURE GEOMETRY ----------------------------------

// Snapping tolerance for "is this transformed point the same node as
// that one", in px. Verified empirically in the 1.11 design session:
// every tested (shape, order) grid is exactly symmetric under its own
// claimed group to within 1e-6px (floating-point noise only, no near-
// miss cases) - deliberately far tighter than core/faces.js's
// FACE_EPSILON (0.5px), which absorbs real geometric noise from
// segment-intersection math on arbitrary user-drawn lines. Here the
// input is always an EXACT rotation/reflection of an EXACT grid node,
// so a match should be near-exact; a miss at this tolerance means the
// grid genuinely isn't symmetric under the claimed group - a real bug,
// not noise - so _nearestOrbitNodeId() throws rather than silently
// snapping to the wrong node (see there).
const ORBIT_NODE_EPSILON = 1e-6;

function _rotateAroundPure(pt, center, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const dx = pt.x - center.x, dy = pt.y - center.y;
    return {
        x: center.x + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: center.y + dx * Math.sin(rad) + dy * Math.cos(rad)
    };
}

function _reflectVerticallyAroundPure(pt, center) {
    return { x: 2 * center.x - pt.x, y: pt.y };
}

// Reproduces core/symmetry.js's drawConnectionWithSymmetry() rotAngles/
// reflection-mode logic (lines 39-51 and the reflection ifs immediately
// after) as data instead of draw calls - kept in sync manually with that
// function, same "duplicated on purpose, documented" pattern already
// used between core/tiling.js's tile*() functions and getMeshWidth()/
// core/faces.js's _meshBasisVectors(). Any future change to
// drawConnectionWithSymmetry()'s group logic must be mirrored here too.
function _rotAnglesAndReflectionFor(shape, symmetryMode) {
    let rotAngles = [];
    if (shape === 'square') {
        if (symmetryMode === 'rotation3' || symmetryMode === 'rotation6') rotAngles = [90, 180, 270];
        if (symmetryMode === 'rotation_reflection3' || symmetryMode === 'rotation_reflection6') rotAngles = [90, 180, 270];
    } else if (shape === 'triangle') {
        if (symmetryMode === 'rotation3' || symmetryMode === 'rotation6') rotAngles = [120, 240];
        if (symmetryMode === 'rotation_reflection3' || symmetryMode === 'rotation_reflection6') rotAngles = [120, 240];
    } else { // hex
        if (symmetryMode === 'rotation3') rotAngles = [120, 240];
        if (symmetryMode === 'rotation6') rotAngles = [60, 120, 180, 240, 300];
        if (symmetryMode === 'rotation_reflection3') rotAngles = [120, 240];
        if (symmetryMode === 'rotation_reflection6') rotAngles = [60, 120, 180, 240, 300];
    }
    const hasReflection = symmetryMode === 'reflection_only'
        || symmetryMode === 'rotation_reflection3'
        || symmetryMode === 'rotation_reflection6';
    return { rotAngles, hasReflection };
}

// Roadmap 1.11 design session: a canonical group-structure token
// ('D4'/'C3'/'Z2'/'C1'/...) derived from the ACTUAL (rotAngles,
// hasReflection) pair rather than the raw symmetryMode string -
// deliberate, not incidental. core/symmetry.js:41-42/44-45 shows
// triangle/square give byte-identical rotAngles for 'rotation3' and
// 'rotation6' (both collapse to that shape's own natural rotational
// order), so those two mode strings produce the SAME orbit table for
// those two shapes; naming by raw mode string would wrongly assign two
// different names/tokens to geometrically identical patterns. n here is
// the rotational order INCLUDING identity (rotAngles.length + 1); with
// reflection the group is dihedral of order 2n (D-n), without it cyclic
// of order n (C-n) - n===1 is the two degenerate cases (trivial group /
// a single mirror), labeled C1/Z2 rather than C1/D1 to read naturally.
function groupTokenFor(shape, symmetryMode) {
    const { rotAngles, hasReflection } = _rotAnglesAndReflectionFor(shape, symmetryMode);
    const n = rotAngles.length + 1;
    if (hasReflection) return n === 1 ? 'Z2' : 'D' + n;
    return n === 1 ? 'C1' : 'C' + n;
}

// Builds the group as a list of point-transform functions - identity,
// each rotation, (if hasReflection) the reflection, and each rotation
// composed with the reflection - exactly mirroring
// drawConnectionWithSymmetry()'s own draw calls for every symmetryMode:
// rotAngles=[] + hasReflection=false ('none') gives [identity] alone
// (the trivial group - matches that mode drawing no copies at all);
// rotAngles=[] + hasReflection=true ('reflection_only') gives
// [identity, reflect] (order 2 - matches that mode's single mirror
// copy, no rotations); non-empty rotAngles with hasReflection=false
// ('rotation3'/'rotation6') gives the pure rotation subgroup; non-empty
// rotAngles with hasReflection=true gives the full dihedral group.
function _buildGroupOps(rotAngles, hasReflection) {
    const ops = [(p, c) => ({ x: p.x, y: p.y })]; // identity
    rotAngles.forEach(a => ops.push((p, c) => _rotateAroundPure(p, c, a)));
    if (hasReflection) {
        ops.push((p, c) => _reflectVerticallyAroundPure(p, c));
        rotAngles.forEach(a => ops.push((p, c) => _reflectVerticallyAroundPure(_rotateAroundPure(p, c, a), c)));
    }
    return ops;
}

// Snaps a transformed point onto the nearest existing node within
// ORBIT_NODE_EPSILON - deliberately a plain linear scan, not the
// spatial-hash bucketing core/faces.js's snapOrCreateNode() needed
// (1.10b-ii-a): measured live in the 1.11 design session that even the
// largest planned order (hex order 6: 127 nodes x 12 group elements =
// 1,524 lookups) completes in ~27ms total with this exact approach - no
// evidence of a bottleneck at this scale, unlike the thousands-of-real-
// nodes cross-layer neighborhoods that motivated bucketing there.
// Throws rather than returning null/a wrong id on a miss: a miss here
// means the grid isn't actually symmetric under the claimed group (a
// real bug in forms.js or in _rotAnglesAndReflectionFor()'s sync with
// core/symmetry.js), not float noise to shrug off - see
// ORBIT_NODE_EPSILON's own comment.
function _nearestOrbitNodeId(pt, nodes, eps) {
    let best = null, bestDist = Infinity;
    for (const n of nodes) {
        const d = Math.hypot(n.x - pt.x, n.y - pt.y);
        if (d < bestDist) { bestDist = d; best = n; }
    }
    if (best === null || bestDist > eps) {
        throw new Error(
            `orbits.js: no node within ${eps}px of (${pt.x}, ${pt.y}) - ` +
            `grid is not symmetric under the claimed group (nearest was ${bestDist}px away)`
        );
    }
    return best.id;
}

// The permutation of node ids one group element induces: apply the
// transform to every node's real coordinates, snap each result back to
// its node id. Turns a geometric transform into a concrete Map(id ->
// id) that _pairOrbits() below can apply directly to node-pairs.
function _computeNodePermutation(nodes, centroid, op, eps) {
    const perm = new Map();
    nodes.forEach(n => {
        const img = op(n, centroid);
        perm.set(n.id, _nearestOrbitNodeId(img, nodes, eps));
    });
    return perm;
}

// Canonical string key for an unordered node-pair - same convention as
// core/faces.js's _undirectedKey(), reimplemented here rather than
// shared for the same portability-independence reason as the rest of
// this file's pure section.
function _pairKey(a, b) {
    return a < b ? a + '-' + b : b + '-' + a;
}

// Roadmap 1.11 design session: the PRIMARY orbit-computation algorithm.
// Burnside's lemma (see burnsideOrbitCount() below) only yields a
// count, not which pairs group together - naming needs the actual
// partition, so union-find over the group's induced permutations is
// the real work here; the lemma is a cross-check on this result, not a
// second way of arriving at it (see burnsideOrbitCount()'s own
// comment).
//
// nodes/centroid/shape/symmetryMode are all explicit parameters (not
// read as globals) so this stays testable headlessly with synthetic
// node arrays, same standard as core/faces.js's findFaces(). Orbits are
// canonically indexed by sorting each orbit's own pairs by _pairKey()
// (deterministic order within an orbit), then sorting the orbits
// themselves by their own first (smallest) pair's key - fully
// reproducible from (shape, order, symmetryMode) alone, no arbitrary
// insertion-order dependence.
function computeThemeLineOrbits(nodes, centroid, shape, symmetryMode, eps = ORBIT_NODE_EPSILON) {
    const { rotAngles, hasReflection } = _rotAnglesAndReflectionFor(shape, symmetryMode);
    const groupToken = groupTokenFor(shape, symmetryMode);
    const ops = _buildGroupOps(rotAngles, hasReflection);
    const groupOrder = ops.length;

    const pairs = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) pairs.push([nodes[i].id, nodes[j].id]);
    }

    const perms = ops.map(op => _computeNodePermutation(nodes, centroid, op, eps));

    const parent = new Map(pairs.map(([a, b]) => [_pairKey(a, b), _pairKey(a, b)]));
    const pairById = new Map(pairs.map(([a, b]) => [_pairKey(a, b), [a, b]]));
    function find(x) { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; }
    function union(x, y) { const rx = find(x), ry = find(y); if (rx !== ry) parent.set(rx, ry); }

    perms.forEach(perm => {
        pairs.forEach(([a, b]) => {
            const ia = perm.get(a), ib = perm.get(b);
            union(_pairKey(a, b), _pairKey(ia, ib));
        });
    });

    const membersByRoot = new Map();
    pairs.forEach(([a, b]) => {
        const key = _pairKey(a, b);
        const root = find(key);
        if (!membersByRoot.has(root)) membersByRoot.set(root, []);
        membersByRoot.get(root).push(pairById.get(key));
    });

    const orbitsUnsorted = Array.from(membersByRoot.values()).map(members => {
        members.sort((p, q) => _pairKey(p[0], p[1]) < _pairKey(q[0], q[1]) ? -1 : 1);
        return members;
    });
    orbitsUnsorted.sort((a, b) => {
        const ka = _pairKey(a[0][0], a[0][1]), kb = _pairKey(b[0][0], b[0][1]);
        return ka < kb ? -1 : (ka > kb ? 1 : 0);
    });

    const pairToOrbitId = new Map();
    const orbits = orbitsUnsorted.map((members, orbitId) => {
        members.forEach(([a, b]) => pairToOrbitId.set(_pairKey(a, b), orbitId));
        return { orbitId, pairs: members };
    });

    return { shape, symmetryMode, groupToken, groupOrder, nodeTotal: nodes.length, rawPairCount: pairs.length, orbits, pairToOrbitId };
}

// Roadmap 1.11 design session: Burnside's lemma applied directly
// (|orbits| = average, over every group element g, of |Fix(g)| - the
// count of pairs g maps to themselves) - an INDEPENDENT count computed
// via a different route than computeThemeLineOrbits()'s union-find
// partitioning, kept as a standing regression cross-check (the two are
// asserted equal for all 12 known real cases - see the test suite).
// Deliberately not called from computeThemeLineOrbits() itself: once
// verified by tests, this is redundant work to pay for on every real
// call, not a live consistency guard - see this file's own docblock.
function burnsideOrbitCount(nodes, centroid, shape, symmetryMode, eps = ORBIT_NODE_EPSILON) {
    const { rotAngles, hasReflection } = _rotAnglesAndReflectionFor(shape, symmetryMode);
    const ops = _buildGroupOps(rotAngles, hasReflection);
    const groupOrder = ops.length;

    const pairs = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) pairs.push([nodes[i].id, nodes[j].id]);
    }

    let fixedSum = 0;
    ops.forEach(op => {
        const perm = _computeNodePermutation(nodes, centroid, op, eps);
        let fixed = 0;
        pairs.forEach(([a, b]) => {
            const ia = perm.get(a), ib = perm.get(b);
            if (_pairKey(ia, ib) === _pairKey(a, b)) fixed++;
        });
        fixedSum += fixed;
    });

    return fixedSum / groupOrder;
}
