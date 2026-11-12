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

// Roadmap 1.2-C: coordinate-free reflection across an arbitrary line
// through `center`, given a unit direction vector - the same fix
// core/symmetry.js's reflectAcrossLine()/mirrorAxisDir() apply to
// drawConnectionWithSymmetry(), mirrored here (same algorithm, not a
// third independently-derived formula) because this file's own
// docblock deliberately keeps its pure-geometry tier free of a
// core/symmetry.js dependency (portability). _reflectVerticallyAroundPure()
// above is unchanged and still used wherever the axis is genuinely
// vertical (the default axis-aligned builders - see _mirrorAxisDirPure()).
function _reflectAcrossLinePure(pt, center, dir) {
    const dx = pt.x - center.x, dy = pt.y - center.y;
    const dot = dx * dir.x + dy * dir.y;
    return {
        x: center.x + 2 * dot * dir.x - dx,
        y: center.y + 2 * dot * dir.y - dy
    };
}

// Roadmap 1.2-C: mirrors core/symmetry.js's mirrorAxisDir() exactly (see
// that function's own comment for why this specific axis choice is
// correct for any orientation) - takes outerCorners/centroid/shape as
// explicit parameters rather than reading globals, matching this file's
// existing "testable headlessly against synthetic node arrays"
// philosophy (computeThemeLineOrbits()'s own docblock).
function _mirrorAxisDirPure(outerCorners, centroid, shape) {
    let dir;
    if (shape === 'triangle') {
        dir = { x: outerCorners[0].x - centroid.x, y: outerCorners[0].y - centroid.y };
    } else { // square, hex
        const c0 = outerCorners[0], c1 = outerCorners[1];
        const mid = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 };
        dir = { x: mid.x - centroid.x, y: mid.y - centroid.y };
    }
    const len = Math.hypot(dir.x, dir.y);
    return { x: dir.x / len, y: dir.y / len };
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
// Roadmap 1.2-C: mirrorDir (this shape's actual mirror-axis direction,
// from _mirrorAxisDirPure()) replaces the hardcoded vertical axis
// _reflectVerticallyAroundPure() implicitly assumed - same reasoning as
// core/symmetry.js's drawConnectionWithSymmetry() fix, mirrored here.
function _buildGroupOps(rotAngles, hasReflection, mirrorDir) {
    const ops = [(p, c) => ({ x: p.x, y: p.y })]; // identity
    rotAngles.forEach(a => ops.push((p, c) => _rotateAroundPure(p, c, a)));
    if (hasReflection) {
        ops.push((p, c) => _reflectAcrossLinePure(p, c, mirrorDir));
        rotAngles.forEach(a => ops.push((p, c) => _reflectAcrossLinePure(_rotateAroundPure(p, c, a), c, mirrorDir)));
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
// Roadmap [orbits.js free-endpoint fix]: a free-endpoint node (1.3(a))
// is, by construction, not a member of the canonical symmetric grid this
// group acts on - its image under any non-trivial rotation/reflection
// generically lands nowhere near any real node (verified: only a free
// node placed exactly at the centroid, a fixed point of every op here,
// survives; any other position crashes _nearestOrbitNodeId() - see the
// design session's own headless verification). Excluding free nodes
// here, before pairs/permutations are built, keeps that throw's original
// meaning intact: it's still a real-bug detector for an actually
// asymmetric grid (a forms.js/_rotAnglesAndReflectionFor() sync bug),
// never a routine outcome of ordinary free-endpoint use. Orbit theory
// (and therefore 1.11's naming scheme) is philosophically scoped to the
// lawful/systematic grid only - Ostwald's own framing of free endpoints
// as "diminished lawfulness, i.e. greater freedom" means a free node
// having no orbit here is the correct outcome, not a gap. This also
// means nodeTotal/rawPairCount below describe the orbit-eligible domain
// this table actually covers, not the full live node count.
function computeThemeLineOrbits(nodes, centroid, shape, symmetryMode, outerCorners, eps = ORBIT_NODE_EPSILON) {
    const orbitNodes = nodes.filter(n => !n.free);
    const { rotAngles, hasReflection } = _rotAnglesAndReflectionFor(shape, symmetryMode);
    const groupToken = groupTokenFor(shape, symmetryMode);
    const mirrorDir = _mirrorAxisDirPure(outerCorners, centroid, shape);
    const ops = _buildGroupOps(rotAngles, hasReflection, mirrorDir);
    const groupOrder = ops.length;

    const pairs = [];
    for (let i = 0; i < orbitNodes.length; i++) {
        for (let j = i + 1; j < orbitNodes.length; j++) pairs.push([orbitNodes[i].id, orbitNodes[j].id]);
    }

    const perms = ops.map(op => _computeNodePermutation(orbitNodes, centroid, op, eps));

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

    return { shape, symmetryMode, groupToken, groupOrder, nodeTotal: orbitNodes.length, rawPairCount: pairs.length, orbits, pairToOrbitId };
}

// Roadmap 1.8 Stage D phase (iv): the group's own elements as data, for
// callers that need to APPLY a group element (not just partition pairs
// into orbits) - the line-pairing editor's per-End-line "member choice"
// (sketch.js's segmentMembers[]) maps an End line's node ids through
// element g. Same construction computeThemeLineOrbits() uses (and shares
// its private helpers), exposed without changing that function:
//  - ops[g](point, center): the g-th element as a coordinate transform.
//  - perms[g]: Map(node id -> node id), the permutation g induces on the
//    non-free nodes (a free-endpoint node has no orbit - see
//    computeThemeLineOrbits() - so it is absent from every perm; a caller
//    must treat "id not in perms[g]" as "this line has no member choice").
//  - element 0 is always the identity (_buildGroupOps() puts it first),
//    so "as clicked" is index 0; the index order is otherwise fixed by
//    (shape, symmetryMode) alone (identity, rotations, then - if the mode
//    has a reflection - the reflection and each rotation composed with
//    it), which is what makes a stored element index stable across
//    rebuilds of the same grid.
// Throws (via _nearestOrbitNodeId()) if the grid is not actually
// symmetric under the claimed group - a real bug, not routine input.
function computeGroupElements(nodes, centroid, shape, symmetryMode, outerCorners, eps = ORBIT_NODE_EPSILON) {
    const orbitNodes = nodes.filter(n => !n.free);
    const { rotAngles, hasReflection } = _rotAnglesAndReflectionFor(shape, symmetryMode);
    const mirrorDir = _mirrorAxisDirPure(outerCorners, centroid, shape);
    const ops = _buildGroupOps(rotAngles, hasReflection, mirrorDir);
    const perms = ops.map(op => _computeNodePermutation(orbitNodes, centroid, op, eps));
    return { groupOrder: ops.length, ops, perms, centroid };
}

// Cached wrapper - the timeline's per-frame path (resolveTimelineKeyframeCoords())
// would otherwise rebuild this 0.1-4.4ms structure (measured, hex order 3
// at the top) on every draw. Cache key: what actually determines the
// elements is NOT just (shape, order, symmetryMode): a layer's grid can
// be scaled or, for a 1.2 alternative-net construction, arbitrarily
// rotated, which changes both the node coordinates the permutations are
// snapped from and WHICH mirror axis _mirrorAxisDirPure() picks (element
// indices among the reflections depend on it). So the entry is keyed on
// the node array's identity (a WeakMap - one grid instance, garbage-
// collected with its layer; every grid rebuild allocates a fresh array)
// plus, within it, shape, symmetryMode, node count (a free endpoint
// pushed onto the array later invalidates the entry, harmlessly), the
// centroid and the first two outer corners (which fix the mirror axis).
const _groupElementsCache = new WeakMap();
function getGroupElementsCached(nodes, centroid, shape, symmetryMode, outerCorners) {
    const oc0 = outerCorners[0], oc1 = outerCorners[1] || oc0;
    const key = [shape, symmetryMode, nodes.length, centroid.x, centroid.y, oc0.x, oc0.y, oc1.x, oc1.y].join('|');
    let byKey = _groupElementsCache.get(nodes);
    if (!byKey) { byKey = new Map(); _groupElementsCache.set(nodes, byKey); }
    let hit = byKey.get(key);
    if (!hit) {
        hit = computeGroupElements(nodes, centroid, shape, symmetryMode, outerCorners);
        byKey.set(key, hit);
    }
    return hit;
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
function burnsideOrbitCount(nodes, centroid, shape, symmetryMode, outerCorners, eps = ORBIT_NODE_EPSILON) {
    // Roadmap [orbits.js free-endpoint fix]: mirrors computeThemeLineOrbits()'s
    // own free-node filter (see there) - this function isn't called from
    // any live code path today (test-only cross-check, per this file's
    // own docblock), but left unfiltered it would crash the same way if
    // ever run against a free-node-containing grid in the future.
    const orbitNodes = nodes.filter(n => !n.free);
    const { rotAngles, hasReflection } = _rotAnglesAndReflectionFor(shape, symmetryMode);
    const mirrorDir = _mirrorAxisDirPure(outerCorners, centroid, shape);
    const ops = _buildGroupOps(rotAngles, hasReflection, mirrorDir);
    const groupOrder = ops.length;

    const pairs = [];
    for (let i = 0; i < orbitNodes.length; i++) {
        for (let j = i + 1; j < orbitNodes.length; j++) pairs.push([orbitNodes[i].id, orbitNodes[j].id]);
    }

    let fixedSum = 0;
    ops.forEach(op => {
        const perm = _computeNodePermutation(orbitNodes, centroid, op, eps);
        let fixed = 0;
        pairs.forEach(([a, b]) => {
            const ia = perm.get(a), ib = perm.get(b);
            if (_pairKey(ia, ib) === _pairKey(a, b)) fixed++;
        });
        fixedSum += fixed;
    });

    return fixedSum / groupOrder;
}

// Roadmap 1.11-B: formats a computeThemeLineOrbits() table + a specific
// connection set into the naming grammar - structurally inspired by
// Hans Hinterreiter's real notation (Hart, G., "Hans Hinterreiter's
// Flowing Fields", Bridges 2024 - a documented example: `4*/6
// 98a+82a+52e+75a`, "4 basic segments, 6-fold rotational symmetry (no
// mirror), four segment codes"), but NOT a reconstruction of his
// undocumented digit+letter segment-coding convention (unpublished
// outside his own 800-page book) - see docs/terminology.md, Part B, for
// the full divergence note. `{count}*/{GroupToken} {orbitId}+...}`:
// GroupToken (e.g. 'C6') replaces Hinterreiter's bare rotational-order
// digit ('6') with the same explicit token computeThemeLineOrbits()
// already uses, self-documenting across all six symmetryMode values
// (his single published example only shows the unmarked pure-rotation
// case, not how he denoted reflection).
//
// Two deliberate departures from a literal segment listing, both
// documented here since they're real design choices, not incidental:
//  - orbit ids are sorted ascending, NOT listed in click/draw order.
//    Hinterreiter's own listing order is unknown, but a draw-order-
//    dependent name would mean the SAME resulting pattern gets a
//    DIFFERENT name depending on the sequence it was clicked in -
//    directly contradicting docs/terminology.md's own rationale for
//    this scheme ("unambiguous: the code alone reconstructs the
//    geometry"). Sorting makes the name a true invariant of the
//    constructed pattern, independent of interaction history.
//  - the id list is NOT deduplicated: `{count}` (docs/terminology.md's
//    Zweier/Dreier/Vierer - the literal number of theme-lines drawn,
//    not the number of distinct symmetry classes among them) always
//    equals the number of ids listed, even if two theme-lines happen to
//    land in the same orbit (e.g. `2*/D3 1+1`) - keeping the header
//    count and the list length consistent, and staying truthful to how
//    many lines were actually drawn rather than silently collapsing
//    them.
//
// Only complete ([id,id]) connections count, mirroring the same
// filter used everywhere else in this codebase (buildExportData()'s
// completeConnections, buildCrossLayerInput()'s baseConn, ...) - an
// in-progress single-click connection isn't a theme-line yet. Returns
// null (not a formal-looking-but-empty code like '0*/D3') when there
// are no complete connections - callers decide how to display "nothing
// drawn yet" (see sketch.js's updatePatternNameStatus()).
//
// Pure: table and connSet are both explicit parameters, no global
// reads - testable headlessly against a synthetic table exactly like
// computeThemeLineOrbits() itself.
function formatThemeLineName(table, connSet) {
    const completeConns = connSet.filter(c => c.length === 2);
    if (completeConns.length === 0) return null;
    const orbitIds = completeConns.map(([a, b]) => table.pairToOrbitId.get(_pairKey(a, b)));
    // Roadmap [orbits.js free-endpoint fix]: a connection touching a
    // free-endpoint node has no entry in table.pairToOrbitId - that node
    // was excluded from the table's own pairs (computeThemeLineOrbits()).
    // No systematic name applies to a sheet containing even one such
    // connection (see that function's own comment) - not a partial name
    // with the free-touching line silently dropped or fabricated, which
    // would violate this scheme's own "the code alone reconstructs the
    // geometry" contract (docs/terminology.md, Part B) for exactly the
    // connection it couldn't actually name.
    if (orbitIds.some(id => id === undefined)) return null;
    const sortedIds = [...orbitIds].sort((x, y) => x - y);
    return `${completeConns.length}*/${table.groupToken} ${sortedIds.join('+')}`;
}

// ----------------- LIVE-APP GLUE -----------------------------------

// Computes the theme-line orbit table for the CURRENT live grid -
// reads nodes/centroid/currentShape (core/state.js globals) exactly as
// core/faces.js's computeCellFaces() reads nodes/curveType, and
// symmetryMode the same way unless a different mode is passed in
// explicitly (`mode ||` rather than a same-named default parameter,
// which would shadow the global instead of reading it - a real JS
// default-parameter pitfall, avoided deliberately here).
//
// Caller's responsibility: nodes/centroid must already correspond to
// `currentShape` - i.e. rebuildGrid(currentShape) must have already run
// for whatever shape/order the caller wants a table for. This function
// does not (and, per the 1.11 design session, should not) rebuild the
// grid itself - rebuildGrid() clears connections/additionalLayers as a
// side effect (core/state.js:93-96), which no caller of an orbit-table
// lookup should trigger as a side effect of merely asking a question.
//
// Roadmap 1.12 stage 1: gridOverride ({nodes, centroid, outerCorners}),
// defaulting to the base globals when omitted (byte-identical to every
// pre-1.12 call site - the underlying computeThemeLineOrbits() already
// took everything as explicit parameters, so this is a small, low-risk
// extension of the thin live-glue wrapper only, not a change to the
// actual orbit algorithm). Lets a caller ask for a DIFFERENTLY-SCALED
// additional layer's own orbit table (its own layerGrid() result, see
// core/forms.js).
//
// Roadmap [orbits.js shape-mismatch fix]: shapeOverride - the
// docblock above used to claim a layer "still shares currentShape/
// symmetryMode with the base... only nodes/centroid/outerCorners
// vary here". That was true when this parameter was added (1.12
// stage 1, before a layer could have its own shape at all) and is
// exactly the assumption Roadmap 1.12 stage 4's per-layer shape
// control breaks: this function unconditionally passed the bare
// global currentShape (the BASE's shape) into computeThemeLineOrbits()
// even when gridOverride belonged to a layer with a genuinely
// different shape, so a triangle-shaped layer's nodes would be
// evaluated under a hex base's D6 group (or vice versa) - nodes that
// generally aren't symmetric under that group, correctly tripping
// _nearestOrbitNodeId()'s own "grid is not symmetric under the
// claimed group" throw (that throw itself is untouched and correct -
// see its own comment; the bug was always in what shape this caller
// handed it, not in the throw). shapeOverride omitted/undefined
// defaults to currentShape, byte-identical to every pre-existing call
// site (base-sheet calls, which correctly want the base's own shape
// regardless).
function computeThemeLineOrbitTable(mode, gridOverride, shapeOverride) {
    const activeMode = mode || symmetryMode;
    const activeShape = shapeOverride || currentShape;
    const grid = gridOverride || { nodes, centroid, outerCorners };
    return computeThemeLineOrbits(grid.nodes, grid.centroid, activeShape, activeMode, grid.outerCorners);
}

// Roadmap 1.11-B: the name for a specific connection set under the
// CURRENT live grid - thin glue over computeThemeLineOrbitTable() +
// formatThemeLineName(), mirroring computeThemeLineOrbitTable()'s own
// (mode, shapeOverride) passthrough. connSet is an explicit parameter
// (not read as a global) the same way core/faces.js's
// computeCellFaces(connSet) takes its connection set explicitly -
// callers pass either the base sheet's `connections` or one
// additionalLayers[i].connections (see sketch.js's activeConnections()),
// never assumed here.
function computeThemeLineName(connSet, mode, gridOverride, shapeOverride) {
    return formatThemeLineName(computeThemeLineOrbitTable(mode, gridOverride, shapeOverride), connSet);
}

// Roadmap 1.11-B (export integration): per-connection orbit assignments
// ({connIndex, orbitId}) for a specific connection set under the
// CURRENT live grid - what core/export.js's buildExportData() needs for
// geometry.themeLineOrbits, without reaching into this module's private
// _pairKey()/table internals itself (same "public API only" discipline
// export.js already keeps toward core/faces.js - it calls
// computeCellFaces(), never faces.js's own private helpers). connIndex
// matches the connection's position in the SAME filtered (complete-only)
// list the caller passes in, mirroring computeAdjacency()'s own
// completeConnections-relative indexing in export.js.
// Roadmap [orbits.js free-endpoint fix]: mirrors formatThemeLineName()'s
// own all-or-nothing decision - a connection touching a free-endpoint
// node (excluded from the table, see computeThemeLineOrbits()) has no
// resolvable orbitId. Returning null for the whole set rather than a
// partially-undefined array keeps this function self-protecting: a
// caller (core/export.js) doesn't need its own free-endpoint detection
// logic to avoid exporting a holed/inconsistent assignments array.
function computeThemeLineOrbitAssignments(connSet, mode, gridOverride, shapeOverride) {
    const table = computeThemeLineOrbitTable(mode, gridOverride, shapeOverride);
    const assignments = connSet
        .filter(c => c.length === 2)
        .map((c, connIndex) => ({ connIndex, orbitId: table.pairToOrbitId.get(_pairKey(c[0], c[1])) }));
    if (assignments.some(a => a.orbitId === undefined)) return null;
    return assignments;
}

// ----------------- LINE KEYS AND GRID NAMES (task 059, G4) --------------------------------------------------------------
// The semantic line key of a straight line between two nodes of a grid under the MAIN group (3*/4*/6*): { z1, z2, buchstabe, gegen }.
//   z1 >= z2 are the node numbers (Knotenzahlen, forms.js numberGridNodes) of the two ends; buchstabe = the number n of sectors the segment touches,
//   read from the end z1 moved into the shaded sector, as a letter in 'abcdefghiklmn' at equal spacing; gegen = the "Ueberstrich" (bar): the segment runs
//   counter-clockwise from the shaded sector (only when both nodes lie on no mirror axis and 1 < n < K + 1). "spiegelgleich" (Drehling = Spiegeling,
//   shown as aA) is a DERIVED property of the orbit, not part of the key. The key identifies the pair ORBIT within one grid {shape, ordnung, lage}.
// Reference implementation (kept unchanged): tools/gitter/measure-name-rule.js pairOrbits/readings/sameSide/letterFor/familyName.
// NOT the legacy path: computeThemeLineOrbits()/formatThemeLineName()/orbitIds above are untouched and stay in use; this is a parallel pure API behind
// GITTER_V2 (false: not reachable from the app, a test passes { gitterV2: true }). _pairKey's string order is never used for names.
const GITTER_V2 = false;
const _LK_ALPHABET = 'abcdefghiklmn';
function _lkGate(opts) { if (!GITTER_V2 && !(opts && opts.gitterV2 === true)) throw new Error('GITTER_V2 is off'); }
function _lkWrap(a) { return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); }
function _lkPtKey(x, y) { return Math.round(x * 1e6) + ',' + Math.round(y * 1e6); }
function lkFamilyName(z1, z2) { return (z1 >= 10 || z2 >= 10) ? z1 + '.' + z2 : '' + z1 + z2; }

// one reading of an unordered pair from the end e (moved into S0 by each group element): [{ n, dir }] (dir +1 counter-clockwise, -1 clockwise, 0 none / antipodal)
function _lkReadings(spec, els, e, o) {
    const out = [], TAU = 2 * Math.PI, EPS = 1e-9, w = spec.w;
    for (const el of els) {
        const [ex, ey] = el.f(e.x, e.y), [ox, oy] = el.f(o.x, o.y), re = Math.hypot(ex, ey), ro = Math.hypot(ox, oy);
        let u = 0;
        if (re > EPS) { u = _lkWrap(Math.atan2(ey, ex) - spec.alpha0); if (u > TAU - 1e-9) u = 0; if (u > w + 1e-9) continue; u /= w; }
        let n = 1, dir = 0;
        if (re > EPS && ro > EPS) {
            let d = _lkWrap(Math.atan2(oy, ox) - Math.atan2(ey, ex)); if (d > Math.PI + 1e-9) d -= TAU;
            if (Math.abs(d) < 1e-9) { n = 1; dir = 0; }
            else {
                if (Math.abs(Math.abs(d) - Math.PI) < 1e-9) { d = Math.PI; dir = 0; } else dir = d > 0 ? 1 : -1;
                const v = u + d / w, lo = Math.min(u, v), hi = Math.max(u, v);
                n = Math.max(1, Math.ceil(hi - 1e-9) - Math.floor(lo + 1e-9));
            }
        }
        out.push({ n, dir });
    }
    return out;
}

// compareLineKeys(a, b): NUMERIC z1, z2, then letter rank, then gegen (false before true). Never a string comparison of the tokens.
function compareLineKeys(a, b) {
    return (a.z1 - b.z1) || (a.z2 - b.z2) || (_LK_ALPHABET.indexOf(a.buchstabe) - _LK_ALPHABET.indexOf(b.buchstabe)) || ((a.gegen ? 1 : 0) - (b.gegen ? 1 : 0));
}
function _lkValidKey(k) {
    return !!k && Number.isInteger(k.z1) && Number.isInteger(k.z2) && k.z1 >= k.z2 && k.z2 >= 1 && typeof k.buchstabe === 'string' && k.buchstabe.length === 1 && _LK_ALPHABET.indexOf(k.buchstabe) >= 0 && typeof k.gegen === 'boolean';
}
// ASCII transport token: family (two digits when both numbers < 10, else z1.z2), letter, optional trailing "~" (bar). opts.display: the bar as a combining
// overline, and with opts.spiegelgleich the capital partner after the letter (aA = the confirmed double role). null for an invalid key.
function formatLineKey(key, opts) {
    if (!_lkValidKey(key)) return null;
    if (opts && opts.display) return lkFamilyName(key.z1, key.z2) + key.buchstabe + (opts.spiegelgleich ? key.buchstabe.toUpperCase() : '') + (key.gegen ? '̄' : '');
    return lkFamilyName(key.z1, key.z2) + key.buchstabe + (key.gegen ? '~' : '');
}
// Syntax only: the key of an ASCII token, or null. With opts.table (computeLineKeyTable result) the token must also EXIST there; only then a capital letter
// (the Spiegeling partner "65A") is normalized to the lower-case key, and only when that orbit is spiegelgleich. "~" is never added or removed.
function parseLineKey(token, opts) {
    if (typeof token !== 'string') return null;
    const m = /^(?:(\d)(\d)|(\d+)\.(\d+))([a-nA-N])(~?)$/.exec(token);
    if (!m) return null;
    const z1 = m[1] !== undefined ? +m[1] : +m[3], z2 = m[1] !== undefined ? +m[2] : +m[4];
    const cap = m[5] !== m[5].toLowerCase(), key = { z1, z2, buchstabe: m[5].toLowerCase(), gegen: m[6] === '~' };
    if (!_lkValidKey(key) || _LK_ALPHABET.indexOf(key.buchstabe) < 0) return null;
    if (!opts || !opts.table) return cap ? null : key;
    const e = opts.table.byToken.get(formatLineKey(key));
    if (!e) return null;
    if (cap && !e.spiegelgleich) return null;
    return key;
}

// computeLineKeyTable(nodes, grid, opts) -> table | null
//   nodes: grid nodes with id and either u, v (buildGrid with lage 2 / opts.numbered) or, with opts.geometry = { centroid, outerCorners }, canvas x, y;
//          free nodes (free: true) are left out. The node set must be the complete grid {shape, ordnung, lage} (else the group does not close: throws).
//   opts.symmetryMode: when given and not the full main group of the shape: null (a reduced mode has no systematic name).
//   table = { grid, group, entries: [{ key, token, spiegelgleich, size, pairs: [[idA, idB], ...], anomalies }] sorted by compareLineKeys, byToken, collisions, pairCount }
function computeLineKeyTable(nodes, grid, opts) {
    _lkGate(opts); opts = opts || {};
    const v = validateGridSpec(grid, { allowLage2: true });
    if (!v.ok) throw new Error('computeLineKeyTable: ' + v.error);
    if (opts.symmetryMode !== undefined && !isMainGroupMode(grid.shape, opts.symmetryMode)) return null;
    const spec = mainGroupSpec(grid.shape), els = mainGroupElements(grid.shape), num = numberGridNodes(nodes, grid, opts);
    const list = [], pts = [];
    num.nodes.forEach((nd, i) => { if (nd.zahl !== undefined) { list.push(nd); pts.push(num.points[i]); } });
    const N = list.length, apothem = mainGroupApothem(grid.shape, grid.ordnung), index = new Map(pts.map((p, i) => [_lkPtKey(p.x, p.y), i]));
    const perms = els.map(el => pts.map(p => { const [x, y] = el.f(p.x, p.y), j = index.get(_lkPtKey(x, y)); if (j === undefined) throw new Error('computeLineKeyTable: the node set is not closed under the main group ' + spec.name); return j; }));
    const canon = new Map();
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        let best = Infinity;
        for (const pm of perms) { const a = pm[i], b = pm[j], c = (a < b ? a : b) * N + (a < b ? b : a); if (c < best) best = c; }
        const l = canon.get(best); if (l) l.push([i, j]); else canon.set(best, [[i, j]]);
    }
    const isAxis = p => { const f = mainGroupFold(grid.shape, p.x, p.y); return f.r < 1e-9 || f.t < 1e-9 || Math.abs(f.t - spec.w) < 1e-9; };
    const sameSide = (a, b) => { const m0 = spec.alpha0 + spec.w; for (let i = 0; i < spec.K; i++) { const mx = Math.cos(m0 + 2 * Math.PI * i / spec.K), my = Math.sin(m0 + 2 * Math.PI * i / spec.K); if (Math.abs(a.x * mx + a.y * my - apothem) < 1e-7 && Math.abs(b.x * mx + b.y * my - apothem) < 1e-7) return true; } return false; };
    const entries = [];
    for (const pairs of canon.values()) {
        const [i, j] = pairs[0], A = list[i], B = list[j], pa = pts[i], pb = pts[j];
        const z1 = Math.max(A.zahl, B.zahl), z2 = Math.min(A.zahl, B.zahl), ends = [];
        if (A.zahl === z1) ends.push([pa, pb]);
        if ((B.zahl === z1 && A.zahl !== B.zahl) || (A.zahl === B.zahl)) ends.push([pb, pa]);
        const reads = []; ends.forEach(([e, o]) => _lkReadings(spec, els, e, o).forEach(r => reads.push(r)));
        const anomalies = [], ns = [...new Set(reads.map(r => r.n))];
        if (ns.length !== 1) anomalies.push('n differs: ' + ns.join('/'));
        const n = Math.min(...ns);
        const gegen = !isAxis(pa) && !isAxis(pb) && n > 1 && n < spec.K + 1 && reads.length > 0 && reads.every(r => r.dir > 0);
        let spiegelgleich = sameSide(pa, pb);
        if (!spiegelgleich) for (let g = spec.K; g < els.length && !spiegelgleich; g++) { const a = perms[g][i], b = perms[g][j]; if ((a === i && b === j) || (a === j && b === i)) spiegelgleich = true; }
        const key = { z1, z2, buchstabe: _LK_ALPHABET[Math.round((n - 1) * 12 / spec.K)], gegen };
        entries.push({ key, token: formatLineKey(key), spiegelgleich, size: pairs.length, pairs: pairs.map(([a, b]) => [list[a].id, list[b].id]), anomalies });
    }
    entries.sort((a, b) => compareLineKeys(a.key, b.key));
    const byToken = new Map(), collisions = [], pairIndex = new Map();
    entries.forEach((e, k) => { if (byToken.has(e.token)) collisions.push(e.token); else byToken.set(e.token, e); e.index = k; e.pairs.forEach(([a, b]) => pairIndex.set((a < b ? a + ',' + b : b + ',' + a), e)); });
    return { grid: { shape: grid.shape, ordnung: grid.ordnung, lage: grid.lage }, group: spec.name, entries, byToken, collisions, pairCount: N * (N - 1) / 2, _pairIndex: pairIndex, _zahl: new Map(list.map(nd => [nd.id, nd.zahl])) };
}
// the key of the line between node ids a and b (ids of the table's nodes), or null (free end, unknown id, a = b)
function lineKeyForPair(table, idA, idB, opts) {
    _lkGate(opts);
    if (!table || idA === idB) return null;
    const e = table._pairIndex.get(idA < idB ? idA + ',' + idB : idB + ',' + idA);
    return e ? Object.assign({}, e.key) : null;
}
// a representative ORIENTED pair [id of the end with the larger node number, id of the other] of the orbit with this key, or null
function pairForLineKey(table, key, opts) {
    _lkGate(opts);
    const e = table && _lkValidKey(key) ? table.byToken.get(formatLineKey(key)) : null;
    if (!e) return null;
    const [a, b] = e.pairs[0];
    return table._zahl.get(a) >= table._zahl.get(b) ? [a, b] : [b, a];
}
// the lattice-only table of a grid {shape, ordnung, lage}: its node ids are the builders' ids (buildGrid gives the same ids), cached per grid
const _LK_CACHE = new Map();
function getLineKeyTable(grid, opts) {
    _lkGate(opts);
    const ck = grid.shape + '|' + grid.ordnung + '|' + grid.lage + (grid.legacyC1 ? '|c1' : '');
    if (!_LK_CACHE.has(ck)) _LK_CACHE.set(ck, computeLineKeyTable(buildGridNodes(grid, { allowLage2: true }), grid, opts));
    return _LK_CACHE.get(ck);
}
const _LK_SHAPE_LETTER = { triangle: 'd', square: 'q', hex: '*' };
// "{ordnung}{d|q|*}{lage}/{3*|4*|6*} {token}[+{token}...]": tokens sorted numerically (compareLineKeys), duplicates kept (count = number of tokens).
// null when a key is missing/invalid (a free end or an incomplete line has no systematic name), the grid is not a main-group grid, or keys is empty.
function formatGridName(grid, keys, opts) {
    _lkGate(opts);
    if (!grid || !Object.prototype.hasOwnProperty.call(_LK_SHAPE_LETTER, grid.shape) || !Number.isInteger(grid.ordnung) || grid.ordnung < 1 || (grid.lage !== 1 && grid.lage !== 2)) return null;
    if (opts && opts.symmetryMode !== undefined && !isMainGroupMode(grid.shape, opts.symmetryMode)) return null;
    if (!Array.isArray(keys) || keys.length === 0 || !keys.every(_lkValidKey)) return null;
    const toks = keys.slice().sort(compareLineKeys).map(k => formatLineKey(k));
    return grid.ordnung + _LK_SHAPE_LETTER[grid.shape] + grid.lage + '/' + mainGroupSpec(grid.shape).name + ' ' + toks.join('+');
}
// -> { grid, group, keys, tokens, count } or null. The tokens are checked against the grid's computed table (getLineKeyTable); only then is a capital normalized.
function parseGridName(name, opts) {
    _lkGate(opts);
    if (typeof name !== 'string') return null;
    const m = /^(\d+)([dq*])([12])\/(3\*|4\*|6\*) (\S+)$/.exec(name);
    if (!m) return null;
    const shape = m[2] === 'd' ? 'triangle' : m[2] === 'q' ? 'square' : 'hex', grid = { shape, ordnung: +m[1], lage: +m[3] };
    if (!validateGridSpec(grid, { allowLage2: true }).ok || mainGroupSpec(shape).name !== m[4]) return null;
    const table = getLineKeyTable(grid, opts), keys = [];
    for (const tok of m[5].split('+')) { const k = parseLineKey(tok, { table }); if (!k) return null; keys.push(k); }
    for (let i = 1; i < keys.length; i++) if (compareLineKeys(keys[i - 1], keys[i]) > 0) return null;   // canonical order only
    return { grid, group: m[4], keys, tokens: keys.map(k => formatLineKey(k)), count: keys.length };
}

// ---- task 063 (G6b): the app-facing half of the v2 API - export keys and the pattern transport -----------------------------------------------------
// GITTER_V2 stays false (the gate of the parallel API); the app passes the explicit option instead: GRID_V2.
const GRID_V2 = Object.freeze({ gitterV2: true });
const TRANSPORT_V2_VERSION = 2, TRANSPORT_V2_MAX_LINES = 500, TRANSPORT_V2_MAX_TOKEN = 12;

// The line keys of a sheet's connections ([idA, idB] pairs of its own grid) and its grid name, for the v2 export. `spec` = the sheet's GridSpec.
// -> { tokens: [ascii token | null, ...] (one per connection), name: string | null }. null token: a free or unknown end (no systematic key), or a reduced symmetry
// mode (not the whole main group); name null unless EVERY connection has a key. Never throws: anything unexpected is "no key".
function gridLineKeysFor(spec, connections, symmetryMode) {
    const list = Array.isArray(connections) ? connections : [];
    const none = () => ({ tokens: list.map(() => null), name: null });
    try {
        if (!spec || !isMainGroupMode(spec.shape, symmetryMode)) return none();
        const table = getLineKeyTable(spec, GRID_V2);
        if (!table) return none();
        const keys = list.map(c => (Array.isArray(c) && c.length === 2 ? lineKeyForPair(table, c[0], c[1], GRID_V2) : null));
        const name = keys.length > 0 && keys.every(k => k) ? formatGridName(spec, keys, Object.assign({ symmetryMode }, GRID_V2)) : null;
        return { tokens: keys.map(k => (k ? formatLineKey(k) : null)), name };
    } catch (e) { return none(); }
}
// id -> { zahl, u, v } for the lattice nodes of a grid (node numbers of forms.js numberGridNodes, lattice coordinates u, v in lattice units); null when it cannot be built.
const _GN_CACHE = new Map();
function gridNodeNumbersFor(spec) {
    try {
        const ck = spec.shape + '|' + spec.ordnung + '|' + spec.lage + (spec.legacyC1 ? '|c1' : '');
        if (_GN_CACHE.has(ck)) return _GN_CACHE.get(ck);
        const lat = buildGridNodes(spec, { allowLage2: true }), num = numberGridNodes(lat, spec, { allowLage2: true });
        const m = new Map(num.nodes.map(n => [n.id, { zahl: n.zahl, u: n.u, v: n.v }]));
        _GN_CACHE.set(ck, m);
        return m;
    } catch (e) { return null; }
}

// ---- the pattern transport v2 (URL and paste share this) ----
// raw = { shape, ordnung, lage, group, lines } of plain values (the URL parser hands strings it has already matched, the paste parser what JSON gave): nothing is trusted.
// ALL tokens are checked against the grid's table before the caller does anything (this function mutates nothing); capital Spiegeling partners are normalized; the keys
// come back sorted NUMERICALLY (compareLineKeys), duplicates kept. Lage 2 is locked. -> { ok: true, pattern } | { ok: false, code: 'invalid', detail }
//   pattern = { v2: true, shape, spec, order (the legacy count the app's grid code takes), symmetryMode (the whole main group), group, keys, tokens }
function parseTransportV2(raw) {
    const bad = detail => ({ ok: false, code: 'invalid', detail });
    try {
        if (!raw || typeof raw !== 'object') return bad('not an object');
        const { shape, ordnung, lage, group, lines } = raw;
        if (shape !== 'triangle' && shape !== 'square' && shape !== 'hex') return bad('unknown shape');
        if (lage !== 1) return bad(lage === 2 ? 'lage 2 is not available yet' : 'lage must be 1');
        const spec = { shape, ordnung, lage: 1 };
        const v = validateGridSpec(spec, { enforceMax: true });
        if (!v.ok) return bad(v.error);
        if (group !== mainGroupSpec(shape).name) return bad('group must be ' + mainGroupSpec(shape).name + ' for ' + shape);
        if (!Array.isArray(lines) || lines.length < 1 || lines.length > TRANSPORT_V2_MAX_LINES) return bad('lines must be 1 to ' + TRANSPORT_V2_MAX_LINES + ' tokens');
        if (!lines.every(t => typeof t === 'string' && t.length >= 1 && t.length <= TRANSPORT_V2_MAX_TOKEN)) return bad('a line token is not a short string');
        const table = getLineKeyTable(spec, GRID_V2);
        if (!table) return bad('no line table for this grid');
        const keys = [];
        for (const tok of lines) { const k = parseLineKey(tok, { table }); if (!k) return bad('unknown line token ' + JSON.stringify(tok.slice(0, 12))); keys.push(k); }
        keys.sort(compareLineKeys);
        return { ok: true, pattern: { v2: true, shape, spec, order: toLegacy(spec), symmetryMode: 'rotation_reflection6', group, keys, tokens: keys.map(k => formatLineKey(k)) } };
    } catch (e) { return bad('unexpected failure (' + (e && e.message) + ')'); }
}
// the representative connection [idA, idB] of every key of a parsed pattern, in the grid of `spec` (a layer's own ids are the same lattice ids); throws for a key the grid lacks
function transportConnectionsV2(pattern) {
    const table = getLineKeyTable(pattern.spec, GRID_V2);
    return pattern.keys.map(k => { const p = pairForLineKey(table, k, GRID_V2); if (!p) throw new Error('line ' + formatLineKey(k) + ' does not exist in ' + pattern.shape + ' ordnung ' + pattern.spec.ordnung); return p; });
}
// the writers (nothing in the generator calls them yet; the catalog of G7 does): the v2 query string / paste text of a spec and its keys. Tokens sorted numerically.
function formatTransportUrlV2(spec, keys, opts) {
    const toks = keys.slice().sort(compareLineKeys).map(k => formatLineKey(k));
    const p = new URLSearchParams({ v: String(TRANSPORT_V2_VERSION), shape: spec.shape, ordnung: String(spec.ordnung), lage: String(spec.lage), group: mainGroupSpec(spec.shape).name, lines: toks.join(',') });
    if (opts && opts.layer === 'new') p.set('layer', 'new');
    return '?' + p.toString();
}
function formatTransportPasteV2(spec, keys) {
    return JSON.stringify({ version: TRANSPORT_V2_VERSION, grid: { shape: spec.shape, ordnung: spec.ordnung, lage: spec.lage }, group: mainGroupSpec(spec.shape).name, lines: keys.slice().sort(compareLineKeys).map(k => formatLineKey(k)) });
}
