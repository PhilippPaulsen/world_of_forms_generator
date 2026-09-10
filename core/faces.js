/**
 * core/faces.js
 * Roadmap 1.10a: face (enclosed-region) detection for a single sheet's
 * symmetry-expanded connections, and the simple symmetry-orbit
 * coloring built on top of it. Part of the portable "core" module set
 * (see CLAUDE.md).
 *
 * Two tiers, clearly separated below:
 *  - Pure geometry (dedup, intersection, node-snapping, the half-edge
 *    face-walk, symmetry-orbit color assignment, findFaces() itself) -
 *    zero p5 dependency, uses Math.* not p5's global aliases, same
 *    portability standard as core/forms.js. Testable headlessly with
 *    plain segment arrays, with no canvas/DOM/live app state involved.
 *  - Live-app glue (collectCellSegments(), computeCellFaces(),
 *    drawFaceFillsAtTile()) - bridges into the app's actual rendering
 *    pipeline (drawShapeCell(), segmentCollector, toTileLocal()) so the
 *    segments fed into the pure geometry below can never drift from
 *    what's actually drawn on screen, and so face fills tessellate
 *    exactly like the lines do.
 *
 * Scope for this pass (1.10a, see the 1.10 design session): one
 * sheet's symmetry-expanded base cell only - not tessellated across
 * the canvas (colors ride along with the existing per-tile rendering
 * transform instead, see core/tiling.js), not merged across layers
 * (1.9's overlay sheets - deferred to a later 1.10b session, since
 * cross-layer crossings need a materially different, offset-aware
 * local-neighborhood analysis), and straight-line-only (curveAmount
 * assumed 0 - see core/curves.js's segmentCollector comment).
 */

// ----------------- LIVE-APP GLUE ---------------------------------

// Renders one sheet's connections through the existing symmetry/tiling
// pipeline exactly as normal, but in segment-collection mode instead
// of drawing - so this can never produce geometry inconsistent with
// what's on screen. tileCentroid = centroid (not a tessellated tile
// position) is the deliberate choice for "the base symmetry cell":
// toTileLocal(n, centroid, false) is the identity transform (see
// core/state.js), so collected segment endpoints land in exactly the
// same coordinate space as the live nodes[] array's own (x,y) values -
// required for node-snapping (see snapOrCreateNode()) to work without
// any extra coordinate translation.
//
// Calls drawShapeCell() once PER connection (rather than once for the
// whole connSet) purely to tag each collected segment with connIndex -
// which base connection's own rotation/reflection orbit produced it.
// This produces byte-for-byte the same segments in the same order as a
// single drawShapeCell(connSet, ...) call would (drawShapeCell just
// loops over connSet calling drawConnectionWithSymmetry once per entry
// either way - see core/tiling.js), so it's a pure bookkeeping addition,
// not a behavior change. connIndex is what orbitColor()/findFaces() use
// for symmetry-orbit face coloring (1.10 design session, point 6): all
// copies of one base connection - its full rotation/reflection orbit -
// get the same connIndex and so the same color.
function collectCellSegments(connSet) {
    const tagged = [];
    connSet.forEach((conn, connIndex) => {
        if (conn.length !== 2) return; // mirror drawShapeCell's own completeness filter
        segmentCollector = [];
        drawShapeCell([conn], centroid, false);
        segmentCollector.forEach(seg => tagged.push({ ...seg, connIndex }));
        segmentCollector = null;
    });
    return tagged;
}

// Roadmap 1.10b-i: the mesh lattice basis (v1/v2) for the CURRENT shape,
// for decomposeLatticeOffset()/neighborhoodRadiusTiles(). Deliberately
// duplicates the small per-shape v1/v2 formulas already inline in
// core/tiling.js's tileTriangle()/tileSquare()/tileHex() rather than
// refactoring those three already-shipped, tested functions to expose a
// shared helper - see the 1.10b design session, point 2b, for hex's
// basis derivation (b1=(hexW, hexH/2), b2=(0, hexH) - reproduces
// tileHex()'s column/row-with-parity loop exactly, verified in the
// neighborhood-radius numeric check).
function _meshBasisVectors() {
    if (currentShape === 'square') {
        const s = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y);
        return { v1: { x: s, y: 0 }, v2: { x: 0, y: s } };
    } else if (currentShape === 'hex') {
        const side = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y);
        const hexW = side * 1.5, hexH = sqrt(3) * side;
        return { v1: { x: hexW, y: hexH / 2 }, v2: { x: 0, y: hexH } };
    } else { // triangle
        const s = dist(outerCorners[1].x, outerCorners[1].y, outerCorners[2].x, outerCorners[2].y);
        const h = (sqrt(3) / 2) * s;
        return { v1: { x: s, y: 0 }, v2: { x: s / 2, y: h } };
    }
}

// Roadmap 1.10b-i: R, the current shape's circumradius (max distance
// from centroid to any point any symmetry-expanded segment can reach) -
// see neighborhoodRadiusTiles(). Computed from outerCorners (every real
// node, and hence every rotation/reflection copy, is bounded within the
// sub-polygon - core/forms.js's buildTriangleGrid()/buildSquareGrid()/
// buildHexGrid() all place nodes as convex combinations scaled <=1 from
// outerCorners, verified directly in the numeric check rather than
// assumed).
function _shapeCircumradius() {
    let R = 0;
    outerCorners.forEach(c => { R = Math.max(R, dist(centroid.x, centroid.y, c.x, c.y)); });
    return R;
}

// Roadmap 1.10b-i: the fixed vertical offset between the triangle net's
// two co-existing sub-lattices - tileTriangle() (core/tiling.js:211-221)
// draws centerUp = anchor+(s/2,-h/3) AND centerDown = anchor+(s/2,+h/3)
// at every (i,j) anchor, so centerDown = centerUp + (0, 2h/3): a FIXED
// vector, not any integer combination of v1/v2 (each sub-lattice is its
// own v1/v2-periodic copy, just offset from the other by this constant).
// Square/hex have no second orientation - tileSquare()/tileHex() always
// call drawShapeCell() with flip180=false - so this only matters for
// triangle; v2.y is h for triangle's own basis (see _meshBasisVectors()).
function _triangleUpDownOffset(v2) {
    return { x: 0, y: (2 * v2.y) / 3 };
}

// Roadmap 1.10b-i: a layer's "down"-oriented cells sit at a DIFFERENT
// effective position than its "up"-oriented cells (shifted by
// _triangleUpDownOffset()), so the shared neighborhood radius must be
// sized for whichever orientation pairing against the (fixed, "up")
// representative base cell is farthest away - verified empirically
// (not assumed) that the "down" pairing can be the binding case, not
// always "up": a numeric check found a residual where the "up" pairing
// still had a full ring of margin (empirical K=1 vs predicted K=2) while
// the "down" pairing's margin was exactly zero (empirical K=2 == predicted
// K=2) - i.e. the up/down interaction genuinely consumes slack that a
// naive same-orientation-only analysis would have missed.
function _effectiveResidualMagnitude(residual, v2) {
    const mag = Math.hypot(residual.x, residual.y);
    if (currentShape !== 'triangle') return mag;
    const d = _triangleUpDownOffset(v2);
    const magWithFlip = Math.hypot(residual.x + d.x, residual.y + d.y);
    return Math.max(mag, magWithFlip);
}

// Roadmap 1.10b-i: every (centroid-relative offset, flip180) tile anchor
// within a Chebyshev-K neighborhood around `residual` (i,j in [-K,K] over
// the mesh basis v1/v2). Triangle contributes TWO anchors per (i,j) -
// centerUp (flip180=false) and centerDown (flip180=true, shifted by
// _triangleUpDownOffset()) - mirroring tileTriangle()'s own per-anchor
// structure exactly (core/tiling.js:211-221); square/hex contribute one
// (flip180 always false, matching tileSquare()/tileHex()).
function _neighborhoodTileAnchors(residual, K, v1, v2) {
    const anchors = [];
    const zero = { x: 0, y: 0 };
    const d = currentShape === 'triangle' ? _triangleUpDownOffset(v2) : zero;
    for (let i = -K; i <= K; i++) {
        for (let j = -K; j <= K; j++) {
            const lattice = { x: i * v1.x + j * v2.x, y: i * v1.y + j * v2.y };
            anchors.push({ offset: { x: residual.x + lattice.x, y: residual.y + lattice.y }, flip180: false });
            if (currentShape === 'triangle') {
                anchors.push({ offset: { x: residual.x + d.x + lattice.x, y: residual.y + d.y + lattice.y }, flip180: true });
            }
        }
    }
    return anchors;
}

// Roadmap 1.10b-i: the shared setup for cross-layer gathering - the mesh
// basis, each active layer's offset decomposition (decomposeLatticeOffset()),
// and ONE shared neighborhood radius K sized to the largest effective
// residual across all layers (neighborhoodRadiusTiles() with a larger
// input is still a safe - just possibly generous - bound for layers with
// smaller residuals, so one shared K is correct, not merely convenient).
// Both collectCrossLayerSegments() and computeCrossLayerFaces()'s real-
// node gathering build on a plan from this same function, so they can
// never disagree about which tiles are in play.
//
// layers: [{ sheetId, connections, offsetX, offsetY }, ...] - already
// filtered to enabled layers by the caller; sheetId is caller-supplied
// (e.g. an additionalLayers[] index) so cross-layer face provenance can
// reference it directly (design session, points 5/9).
function _planCrossLayerNeighborhood(layers) {
    const { v1, v2 } = _meshBasisVectors();
    const R = _shapeCircumradius();
    const M = (Math.hypot(v1.x, v1.y) + Math.hypot(v2.x, v2.y)) / 2;
    const decomposedLayers = layers.map(layer => {
        const { residual } = decomposeLatticeOffset(v1, v2, layer.offsetX, layer.offsetY);
        return {
            sheetId: layer.sheetId,
            connections: layer.connections,
            residual,
            effectiveResidualMag: _effectiveResidualMagnitude(residual, v2)
        };
    });
    let maxResidualMag = 0;
    decomposedLayers.forEach(l => { maxResidualMag = Math.max(maxResidualMag, l.effectiveResidualMag); });
    const K = neighborhoodRadiusTiles(R, M, maxResidualMag);
    return { v1, v2, R, M, K, decomposedLayers };
}

// Roadmap 1.10b-i (design session point 3): gathers segments from the
// base sheet AND every given additional layer, across the shared bounded
// tile neighborhood from _planCrossLayerNeighborhood(), tagged with
// {sheetId, connIndex} - sheetId distinguishes which SHEET a segment
// came from (base, or a caller-supplied layer identifier), layered on
// top of 1.10a's existing per-connection connIndex tagging
// (collectCellSegments()) - needed because a cross-layer face can be
// bordered by segments from different SHEETS, not just different
// connections within one sheet (design session, point 5).
//
// Reuses drawShapeCell()/segmentCollector exactly as collectCellSegments()
// does - just called once per tile anchor in the neighborhood instead of
// always at the single untranslated centroid position - so gathered
// geometry can never drift from what drawShapeCell() would actually
// render at that tile.
function collectCrossLayerSegments(baseConnSet, layers) {
    const plan = _planCrossLayerNeighborhood(layers);
    const tagged = [];

    function gatherSheet(sheetId, connSet, residual) {
        const anchors = _neighborhoodTileAnchors(residual, plan.K, plan.v1, plan.v2);
        anchors.forEach(({ offset, flip180 }) => {
            const tileC = { x: centroid.x + offset.x, y: centroid.y + offset.y };
            connSet.forEach((conn, connIndex) => {
                if (conn.length !== 2) return; // mirror drawShapeCell's own completeness filter
                segmentCollector = [];
                drawShapeCell([conn], tileC, flip180);
                segmentCollector.forEach(seg => tagged.push({ ...seg, sheetId, connIndex }));
                segmentCollector = null;
            });
        });
    }

    gatherSheet('base', baseConnSet, { x: 0, y: 0 });
    plan.decomposedLayers.forEach(layer => gatherSheet(layer.sheetId, layer.connections, layer.residual));

    return tagged;
}

// ----------------- PURE GEOMETRY ----------------------------------

// Roadmap 1.10b-i: decomposes an additional layer's (offsetX, offsetY)
// into a whole-lattice-step part (an exact integer combination of the
// mesh basis vectors v1/v2 - a translation the base sheet's own infinite
// tessellation is invariant under, since that's literally what "one mesh
// step" means) plus a residual smaller than one step in the (i,j) lattice
// basis. Centered rounding (Math.round, not Math.floor) deliberately -
// it picks the *nearest* of the 4 lattice points bounding the residual's
// fundamental parallelogram rather than always the same corner, which
// materially shrinks the residual's worst-case Euclidean magnitude (see
// the 1.10b design session, point 2b/2c) - verified empirically to matter
// for neighborhoodRadiusTiles() below staying tight across the full
// residual domain, not just a hand-picked case.
//
// v1/v2 passed in explicitly (not read as globals) to keep this pure and
// shape-agnostic - see _meshBasisVectors() for the live-app glue that
// supplies them for the current shape.
function decomposeLatticeOffset(v1, v2, offsetX, offsetY) {
    const det = v1.x * v2.y - v2.x * v1.y;
    const i_raw = (offsetX * v2.y - offsetY * v2.x) / det;
    const j_raw = (offsetY * v1.x - offsetX * v1.y) / det;
    const i = Math.round(i_raw), j = Math.round(j_raw);
    const wholeOffset = { x: i * v1.x + j * v2.x, y: i * v1.y + j * v2.y };
    const residual = { x: offsetX - wholeOffset.x, y: offsetY - wholeOffset.y };
    return { i, j, wholeOffset, residual };
}

// Roadmap 1.10b-i: how many lattice steps (Chebyshev radius, i.e. a
// (2K+1)x(2K+1) tile window) are needed to guarantee catching every
// possible segment-segment crossing between a cell and another cell
// offset by up to `residualMag` from it, given the shape's own R
// (circumradius - the maximum distance from a cell's centroid to any
// point any of its symmetry-expanded segments can reach, since every
// node and hence every rotation/reflection copy is bounded within
// outerCorners) and M (mesh step magnitude, |v1|==|v2|).
//
// Derivation (1.10b design session, point 2c): two cells' segment
// footprints can only overlap if their centroid distance is < 2R (each
// cell's own reach). A cell at K lattice steps away is at Euclidean
// distance >= K*M (achieved along the primal lattice directions) - so
// K = ceil((2R + residualMag) / M) is a safe upper bound: beyond that
// many steps, centroid distance is provably >= 2R + residualMag >
// 2R, ruling out any overlap even in the worst case where the target
// cell is itself already offset by residualMag.
//
// This formula is PROVEN NEVER TO UNDERESTIMATE - the derivation above
// is a straightforward necessary-condition argument, not a heuristic.
// It is, however, measurably loose: empirical verification (real
// segment-segment intersection, real per-shape R/M from actual grids,
// the worst-case connection per shape - two outer corners, which is
// provably the maximum-reach case since a segment's distance from its
// own center is a convex function of position along it and therefore
// maximized at an endpoint) found this formula predicts one full ring
// more than is ever actually needed, in every one of 196 tested cases
// across all three shapes (base-vs-base, a full sweep of the residual's
// fundamental domain, and 8 concrete realistic offsets) - e.g. square/
// triangle/hex at residual=(0,0) all empirically need only K=1 (a 3x3
// window) while this formula predicts K=2 (5x5). Shipped as-is anyway
// (safety over speed) since it is the only one of the two with an actual
// correctness proof behind it - the empirically-tighter K=1 bound is a
// real, ready-made optimization for 1.10b-ii once real performance
// numbers (not this formula's a-priori safety margin) show it's needed.
function neighborhoodRadiusTiles(R, M, residualMag) {
    return Math.ceil((2 * R + residualMag) / M);
}

// Snapping/dedup tolerance in px. Small enough not to merge genuinely
// distinct nearby points, large enough to absorb floating-point noise
// from the rotation/reflection trig in drawConnectionWithSymmetry()
// (core/symmetry.js) - unrelated to and not copied from SpaceHarmony's
// EPSILON_SQ, which operates in that project's different (-0.5..0.5
// unit-cube) coordinate scale, not this app's pixel canvas.
const FACE_EPSILON = 0.5;

// Canonical string key for a segment, independent of endpoint order
// (so a connection drawn as [a,b] and a duplicate drawn as [b,a] -
// e.g. from clicking the same two nodes twice - collapse to the same
// key) and tolerant of FACE_EPSILON-scale float noise.
function _segmentKey(seg) {
    const round = (v) => Math.round(v / FACE_EPSILON) * FACE_EPSILON;
    let a = { x: round(seg.x1), y: round(seg.y1) };
    let b = { x: round(seg.x2), y: round(seg.y2) };
    if (a.x > b.x || (a.x === b.x && a.y > b.y)) { const t = a; a = b; b = t; }
    return a.x + ',' + a.y + '|' + b.x + ',' + b.y;
}

// Drops exact/near-duplicate segments (same two endpoints within
// FACE_EPSILON, either direction) before intersection detection - the
// duplicate-connection case identified in the 1.10 design session
// (mousePressed() doesn't prevent clicking the same two nodes twice).
function dedupeSegments(segments) {
    const seen = new Set();
    const result = [];
    for (const seg of segments) {
        const key = _segmentKey(seg);
        if (!seen.has(key)) {
            seen.add(key);
            result.push(seg);
        }
    }
    return result;
}

// Bounded-segment intersection (not infinite-line): returns null unless
// the crossing point actually lies on both segments (t and u in [0,1],
// with a small tolerance so touching-at-endpoint T-junctions - e.g. one
// segment's own endpoint lying exactly on another's interior - count).
// Parallel/collinear segments (denom ~ 0) return null rather than trying
// to represent an overlapping run as a single intersection point; this
// is a known v1 limitation (see the file-level docblock's containment-
// gap note) - it only matters for degenerate cases where two theme-line
// segments run exactly along the same line, which duplicate connections
// aside (already handled by dedupeSegments()), doesn't occur from normal
// symmetry-expanded straight chords in practice.
function segmentIntersection(a, b) {
    const x1 = a.x1, y1 = a.y1, x2 = a.x2, y2 = a.y2;
    const x3 = b.x1, y3 = b.y1, x4 = b.x2, y4 = b.y2;
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-9) return null;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / denom;
    const EPS_T = 1e-6;
    if (t < -EPS_T || t > 1 + EPS_T || u < -EPS_T || u > 1 + EPS_T) return null;
    return {
        t: Math.min(1, Math.max(0, t)),
        u: Math.min(1, Math.max(0, u)),
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
    };
}

// Roadmap 1.10b-ii-a: spatial-hash bucket key for a point, at
// FACE_EPSILON granularity - a bucket's width equals FACE_EPSILON, so
// two points within FACE_EPSILON of each other can never land more than
// one bucket apart on either axis (proof: buckets partition each axis
// into [(*k*-0.5)*FACE_EPSILON, (*k*+0.5)*FACE_EPSILON) intervals, so
// two points 2+ buckets apart on an axis are already >= FACE_EPSILON
// apart on that axis alone) - checking the 3x3 neighborhood of buckets
// (see _nearestInBuckets()) is therefore provably sufficient, not a
// heuristic radius.
function _bucketKey(x, y) {
    return Math.round(x / FACE_EPSILON) + ',' + Math.round(y / FACE_EPSILON);
}

// Registry of nodes actually referenced while splitting segments, keyed
// by id (registry.byId - unchanged external shape, still what
// splitSegments() reads at the end), seeded from the sheet's real nodes
// (from state.js's nodes[] - passed in explicitly, never read as a
// global, to keep this module p5/live-app independent per the file
// docblock) but populated lazily: a real node only gets a byId entry
// once some breakpoint actually snaps to it, and synthetic ids ('s0',
// 's1', ...) are string-prefixed so they can never collide with real
// nodes' plain integer ids.
//
// Roadmap 1.10b-ii-a: realNodes are pre-bucketed here (realNodeBuckets)
// rather than left as a flat array to scan - 1.10b-i's cross-layer
// neighborhoods can pass several thousand real nodes (every tile
// anchor's own translated copy of the base grid), so a linear scan over
// realNodes on every miss was its own hidden cost once the registry
// scan itself (see snapOrCreateNode()) was fixed. registeredBuckets
// mirrors byId's contents, bucketed, built up incrementally as points
// get registered.
function createNodeRegistry(realNodes) {
    const registry = {
        realNodes: realNodes || [],
        byId: new Map(),
        registeredBuckets: new Map(),
        realNodeBuckets: new Map(),
        nextSyntheticId: 0
    };
    registry.realNodes.forEach(n => {
        const key = _bucketKey(n.x, n.y);
        if (!registry.realNodeBuckets.has(key)) registry.realNodeBuckets.set(key, []);
        registry.realNodeBuckets.get(key).push(n);
    });
    return registry;
}

// Roadmap 1.10b-ii-a: finds the NEAREST entry to `point` within
// FACE_EPSILON among the given bucket map (checking the query point's
// own bucket plus its 8 neighbors - see _bucketKey()), or null if none
// qualifies. Ties (equal distance) broken by lowest id, as a string
// comparison - id is always either a real node's own id or a synthetic
// 'sN' string, both comparable this way; extremely unlikely to matter in
// practice (would need two DISTINCT already-registered points exactly
// equidistant from a query point) but a total order needs SOME
// tiebreak to stay well-defined.
//
// This is the deliberate canonical, order-independent rule chosen over
// any traversal-order-based one (1.10b-ii design session, point 3): for
// a fixed final set of candidate points, "nearest within epsilon" gives
// the same answer regardless of insertion order, bucket layout, or scan
// order - unlike "first match found while scanning in some order",
// which is what both the original linear scan (insertion-order-first)
// and a naive bucket-scan prototype (bucket-scan-order-first) actually
// did. Verified empirically (not assumed) that this matters: a query
// point can have two already-registered candidates both within
// FACE_EPSILON of it but MORE than FACE_EPSILON apart from each other
// (triangle inequality allows up to 2*FACE_EPSILON between them) - a
// genuinely ambiguous case that dense cross-layer neighborhoods hit in
// practice (see the 1.10b-ii-a investigation), where "first found" is
// order-dependent but "nearest" is not.
function _nearestInBuckets(point, bucketMap) {
    const bx = Math.round(point.x / FACE_EPSILON), by = Math.round(point.y / FACE_EPSILON);
    let best = null, bestDist = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const bucket = bucketMap.get((bx + dx) + ',' + (by + dy));
            if (!bucket) continue;
            for (const n of bucket) {
                const d = Math.hypot(n.x - point.x, n.y - point.y);
                if (d <= FACE_EPSILON && (best === null || d < bestDist || (d === bestDist && String(n.id) < String(best.id)))) {
                    best = n;
                    bestDist = d;
                }
            }
        }
    }
    return best;
}

// Roadmap 1.10b-ii-a: registers a node entry in both byId (the flat map
// splitSegments() reads at the end - unchanged) and registeredBuckets
// (for future _nearestInBuckets() lookups against this same entry).
function _registerInBuckets(registry, entry) {
    registry.byId.set(entry.id, entry);
    const key = _bucketKey(entry.x, entry.y);
    if (!registry.registeredBuckets.has(key)) registry.registeredBuckets.set(key, []);
    registry.registeredBuckets.get(key).push(entry);
}

// Canonical string key for an undirected edge, independent of endpoint
// order - shared by splitSegments() (building edgeMeta) and findFaces()
// (looking a boundary edge's meta back up), so both sides address the
// same edge the same way regardless of which id happens to come first.
function _undirectedKey(a, b) {
    return String(a) < String(b) ? a + '|' + b : b + '|' + a;
}

// Snaps a breakpoint (segment endpoint or intersection point) onto an
// existing node within FACE_EPSILON - the NEAREST already-registered
// node if one qualifies (so repeated visits to the same point, e.g. an
// intersection computed once per participating segment, always resolve
// to the same id regardless of visit order - see _nearestInBuckets()),
// then the sheet's nearest real node, else registers a new synthetic
// node at that exact point.
//
// Roadmap 1.10b-ii-a: spatial-hash bucketed (via _nearestInBuckets()),
// not a linear scan over the whole registry - the original linear scan
// here was found to dominate total cross-layer computation time by two
// orders of magnitude (a real, measured 106-155x more expensive than
// the O(S^2) pairwise segment-intersection test it was assumed to be
// secondary to), since its cost grew with the registry's own size on
// every call. Bucketing turns each call into O(1) amortized (a small,
// bounded number of nearby candidates, not the whole registry) -
// measured 53-89x total speedup on real cross-layer segment sets, with
// identical final face counts and areas on those same real sets (see
// the 1.10b-ii-a investigation) - and unblocks configurations (e.g. 3
// connections/sheet x 3 layers, 3600 segments) that previously did not
// complete in a practical amount of time at all.
function snapOrCreateNode(point, registry) {
    const existing = _nearestInBuckets(point, registry.registeredBuckets);
    if (existing) return existing.id;

    const real = _nearestInBuckets(point, registry.realNodeBuckets);
    if (real) {
        _registerInBuckets(registry, { id: real.id, x: real.x, y: real.y });
        return real.id;
    }

    const id = 's' + (registry.nextSyntheticId++);
    _registerInBuckets(registry, { id, x: point.x, y: point.y });
    return id;
}

// Preprocessing step (1.10 design session, point 3): finds every
// pairwise intersection among segments, splits each original segment
// into sub-segments at all its break points (its own two endpoints plus
// any intersection points along it, in order), and snaps every break
// point onto a node id via snapOrCreateNode() - producing the augmented
// node/edge set the half-edge face-walk (step 4/6) will run on. Segments
// should already be deduped (dedupeSegments()) before this runs; realNodes
// is optional (defaults to none, i.e. every break point becomes synthetic)
// so this stays testable with plain synthetic segment arrays.
//
// Also returns edgeMeta (undirected edge key -> {sheetId, connIndex} of
// the original segment that produced it, if collectCellSegments()/
// collectCrossLayerSegments() tagged one - see there) so findFaces() can
// assign each face's color (symmetry-orbit for a same-sheet face, or the
// distinct cross-sheet treatment - see _faceSheetSet()/CROSS_SHEET_COLOR)
// from the connections/sheets along its own boundary, without needing a
// second pass back over the raw segments.
//
// Roadmap 1.10b-ii-c: sheetId rides alongside connIndex in the SAME
// meta object (not a second parallel map) - collectCellSegments()
// (1.10a, single-sheet) never sets sheetId on its segments, so it comes
// through here as undefined for every edge, which is exactly the
// "no cross-sheet concept" behavior that path needs (see
// _faceSheetSet() - an edge with no sheetId is skipped, so a single-
// sheet graph's faces can never register as cross-sheet).
function splitSegments(segments, realNodes) {
    const registry = createNodeRegistry(realNodes);
    const breaks = segments.map(() => [0, 1]);
    for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
            const hit = segmentIntersection(segments[i], segments[j]);
            if (hit) {
                breaks[i].push(hit.t);
                breaks[j].push(hit.u);
            }
        }
    }
    const edgeMap = new Map();
    const edgeMeta = new Map();
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const tVals = [...new Set(breaks[i])].sort((a, b) => a - b);
        const ids = [];
        for (const t of tVals) {
            const px = seg.x1 + t * (seg.x2 - seg.x1);
            const py = seg.y1 + t * (seg.y2 - seg.y1);
            const id = snapOrCreateNode({ x: px, y: py }, registry);
            if (ids.length === 0 || ids[ids.length - 1] !== id) ids.push(id);
        }
        for (let k = 0; k < ids.length - 1; k++) {
            const a = ids[k], b = ids[k + 1];
            const key = _undirectedKey(a, b);
            if (!edgeMap.has(key)) {
                edgeMap.set(key, [a, b]);
                edgeMeta.set(key, { sheetId: seg.sheetId, connIndex: seg.connIndex });
            }
        }
    }
    return { nodes: Array.from(registry.byId.values()), edges: Array.from(edgeMap.values()), edgeMeta };
}

// Angle-sorted adjacency over the augmented (real+synthetic) node/edge
// set from splitSegments() - same convention as core/export.js's
// computeAdjacency() (angleDeg via atan2, normalized to [0,360)), but
// reimplemented with Math.atan2/Math.PI instead of p5's degrees()/
// atan2() global aliases, and taking nodes/edges as plain parameters
// instead of reading the live app's nodes/connections globals - keeping
// this module p5/live-app independent per the file docblock. Not reused
// directly from export.js for that reason, even though the algorithm
// is identical.
// Roadmap 1.10b-i: connected components of the (faceNodes, edges) graph,
// via plain BFS - O(V+E), negligible next to splitSegments()'s O(S^2)
// intersection cost. Added because findFaces()'s outer-face filter
// assumes a single connected component with exactly one unbounded face;
// a graph spanning multiple disconnected tile clusters (the normal case
// for 1.10b's cross-layer neighborhoods, and already a latent,
// documented gap for 1.10a's own single-sheet case - e.g. two
// never-crossing connections in one cell) needs that filter applied
// PER component, not once globally - see findFaces() below. Returns an
// array of node-id Sets, one per component; every faceNodes entry
// belongs to exactly one.
function _connectedComponents(faceNodes, edges) {
    const adj = new Map();
    faceNodes.forEach(n => adj.set(n.id, []));
    edges.forEach(([a, b]) => { adj.get(a).push(b); adj.get(b).push(a); });

    const visited = new Set();
    const components = [];
    faceNodes.forEach(start => {
        if (visited.has(start.id)) return;
        const comp = new Set();
        const queue = [start.id];
        visited.add(start.id);
        while (queue.length) {
            const cur = queue.shift();
            comp.add(cur);
            adj.get(cur).forEach(nb => {
                if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
            });
        }
        components.push(comp);
    });
    return components;
}

function _buildFaceAdjacency(faceNodes, edges) {
    const nodeById = new Map(faceNodes.map(n => [n.id, n]));
    const adjacency = {};
    faceNodes.forEach(n => { adjacency[n.id] = []; });
    edges.forEach(([aId, bId]) => {
        const a = nodeById.get(aId), b = nodeById.get(bId);
        const angleAB = (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 360) % 360;
        const angleBA = (Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI + 360) % 360;
        adjacency[aId].push({ neighborId: bId, angleDeg: angleAB });
        adjacency[bId].push({ neighborId: aId, angleDeg: angleBA });
    });
    Object.keys(adjacency).forEach(id => adjacency[id].sort((x, y) => x.angleDeg - y.angleDeg));
    return adjacency;
}

// The half-edge/rotation-system neighbor lookup at the heart of the
// face-walk: given the directed half-edge (arrivingFrom -> atNode), the
// next half-edge of the SAME face's boundary continues to whichever
// neighbor sits immediately after arrivingFrom in atNode's own angle-
// sorted list (wrapping around) - the standard planar-graph face-
// tracing rule (see e.g. DCEL construction from a rotation system).
function _nextAroundFace(adjacency, atNode, arrivingFrom) {
    const list = adjacency[atNode];
    const idx = list.findIndex(e => e.neighborId === arrivingFrom);
    return list[(idx + 1) % list.length].neighborId;
}

// Traces every face boundary in the graph by walking each of the 2*E
// directed half-edges exactly once (skipping ones already consumed by
// an earlier walk) via _nextAroundFace() until the walk returns to its
// own starting half-edge. For a connected graph this produces exactly
// one boundary per face (Euler's V-E+F=2), including the single
// unbounded outer face - _signedArea()'s sign is what separates that
// one out afterwards in findFaces(), not this function. A tree/dangling
// branch (no cycle) still traces as one single all-encompassing
// boundary that revisits its cut vertices - not filtered out here, left
// to findFaces()'s zero-area check.
function _traceAllFaceBoundaries(faceNodes, edges, adjacency) {
    const visited = new Set();
    const boundaries = [];
    const halfEdges = [];
    edges.forEach(([a, b]) => { halfEdges.push([a, b]); halfEdges.push([b, a]); });
    for (const [startU, startV] of halfEdges) {
        const startKey = startU + '>' + startV;
        if (visited.has(startKey)) continue;
        const boundary = [];
        let u = startU, v = startV;
        while (true) {
            visited.add(u + '>' + v);
            boundary.push(u);
            const w = _nextAroundFace(adjacency, v, u);
            u = v; v = w;
            if (u === startU && v === startV) break;
        }
        boundaries.push(boundary);
    }
    return boundaries;
}

// Shoelace formula over a face boundary (an ordered, non-repeated list
// of node ids - see _traceAllFaceBoundaries()). Sign is what findFaces()
// uses to separate the outer face from bounded ones (see there); this
// consistent-rotation-system walk gives every bounded face one winding
// sign and the single unbounded face the opposite sign, for a connected
// graph. Magnitude is the face's area, in the same px^2 units as the
// canvas.
function _signedArea(boundaryIds, nodeById) {
    let sum = 0;
    for (let i = 0; i < boundaryIds.length; i++) {
        const p1 = nodeById.get(boundaryIds[i]);
        const p2 = nodeById.get(boundaryIds[(i + 1) % boundaryIds.length]);
        sum += (p1.x * p2.y - p2.x * p1.y);
    }
    return sum / 2;
}

// A face's symmetry orbit = the connIndex most represented among the
// edges on its own boundary (majority vote, ties broken toward the
// lower connIndex for determinism) - "a starting point, not a real
// graph-coloring" per the design session (point 6): a face bordered by
// segments from more than one base connection just gets the most-common
// one, not a blend. Returns null if no edge on the boundary carries meta
// (e.g. synthetic test segments that never set connIndex) - orbitColor()
// falls back to a neutral color in that case.
//
// Roadmap 1.10b-ii-c: edgeMeta entries are now {sheetId, connIndex}
// objects (see splitSegments()), so this only extracts .connIndex - the
// algorithm itself is unchanged. Only ever called on a face that's
// already been confirmed NOT genuinely cross-sheet (see
// _faceSheetSet()/findFaces()), so every tagged edge here belongs to at
// most one sheet anyway - no sheetId filtering needed at this point.
function _majorityConnIndex(boundary, edgeMeta) {
    const counts = new Map();
    for (let i = 0; i < boundary.length; i++) {
        const u = boundary[i], v = boundary[(i + 1) % boundary.length];
        const meta = edgeMeta.get(_undirectedKey(u, v));
        if (!meta || meta.connIndex === undefined || meta.connIndex === null) continue;
        const ci = meta.connIndex;
        counts.set(ci, (counts.get(ci) || 0) + 1);
    }
    let best = null, bestCount = -1;
    for (const [ci, count] of counts) {
        if (count > bestCount || (count === bestCount && ci < best)) { best = ci; bestCount = count; }
    }
    return best;
}

// Roadmap 1.10b-ii-c: the set of distinct sheetIds tagged among a face's
// own boundary edges (untagged edges - e.g. from 1.10a's single-sheet
// collectCellSegments(), which never sets sheetId - skipped, same as
// _majorityConnIndex()). findFaces() uses this to decide whether a face
// is genuinely cross-sheet: size 0 or 1 -> same-sheet (or no info at
// all), the existing per-sheet orbit-color mechanism applies unchanged;
// size >= 2 -> the face's boundary is only closed BECAUSE at least two
// different sheets crossed there, so it gets the distinct cross-sheet
// treatment (CROSS_SHEET_COLOR) instead - a strict PRESENCE rule
// (design session point 1), not a majority/threshold one: even a single
// edge from a second sheet among many from a first is enough, since the
// face wouldn't exist as a separate region at all without that second
// sheet's contribution - a proportion-based rule would misattribute it
// to whichever sheet happens to contribute more edges, which isn't
// meaningfully "whose face" it is.
function _faceSheetSet(boundary, edgeMeta) {
    const sheets = new Set();
    for (let i = 0; i < boundary.length; i++) {
        const u = boundary[i], v = boundary[(i + 1) % boundary.length];
        const meta = edgeMeta.get(_undirectedKey(u, v));
        if (!meta || meta.sheetId === undefined || meta.sheetId === null) continue;
        sheets.add(meta.sheetId);
    }
    return sheets;
}

// Deterministic, evenly-hued color per orbit (base connection index) -
// the "symmetry-orbit palette" (design session point 6): every face
// generated by the same base connection's rotation/reflection copies
// gets the same hue, spaced 360/totalOrbits degrees apart around the
// color wheel so adjacent orbits stay visually distinct even for a
// handful of connections. Faces with no identifiable orbit (see
// _majorityConnIndex()) get a neutral gray rather than an arbitrary hue.
function orbitColor(connIndex, totalOrbits) {
    if (connIndex === null || connIndex === undefined || totalOrbits <= 0) return 'hsl(0, 0%, 70%)';
    const hue = Math.round((360 * connIndex / totalOrbits) % 360);
    return `hsl(${hue}, 65%, 55%)`;
}

// Roadmap 1.10b-ii-c: color for a genuinely cross-sheet face (boundary
// spans >=2 distinct sheets - see _faceSheetSet()). Extends orbitColor()'s
// existing "no clean single-orbit attribution" gray-fallback convention
// (hsl(0,0%,70%)) rather than introducing a competing palette concept -
// same hue-less family, but at a distinguishably DARKER lightness so a
// cross-sheet face reads as visually distinct from the (in practice
// never hit with real, always-tagged segments) "no orbit info at all"
// fallback, not just a coincidentally identical gray.
const CROSS_SHEET_COLOR = 'hsl(0, 0%, 40%)';

// Orchestrates the full pipeline (1.10 design session, points 2-4, 6 and
// 9): dedupe -> intersection-split/snap -> angle-sorted adjacency ->
// half-edge face-walk -> drop each connected component's own unbounded
// outer face -> symmetry-orbit color assignment. realNodes is optional
// (see splitSegments()); segments need not be pre-deduped - this calls
// dedupeSegments() itself, so findFaces(collectCellSegments(connSet)) is
// a complete, single-call pipeline for the live app (see
// computeCellFaces()).
//
// Roadmap 1.10b-i: the outer-face filter is applied PER CONNECTED
// COMPONENT (_connectedComponents()), not once globally as 1.10a
// originally shipped it. This is a fix to already-shipped 1.10a
// behavior, not new-for-1.10b logic: a graph with multiple disconnected
// components (e.g. two never-crossing connections in one 1.10a sheet,
// already possible before any of 1.10b existed) was always handled
// incorrectly - the old code's ambiguous-case fallback dropped only the
// SINGLE largest-|area| trace across the WHOLE graph, not each
// component's own outer face, silently keeping stray outer regions as
// if they were real bounded faces in every component but the one with
// the largest trace. 1.10b's cross-layer neighborhoods make multi-
// component graphs the norm rather than a rare edge case, which is what
// surfaced this needing an actual fix rather than a footnote (1.10b
// design session, point 3).
//
// For a graph with exactly one component, this produces byte-identical
// results to the pre-fix code (the per-component sign-based/largest-
// area logic, scoped to that single component, is the same computation
// over the same data) - verified via regression against every 1.10a
// synthetic test case.
//
// Remaining known v1 limitation (design session point 9, still not
// solved by the component fix, documented rather than silently
// mishandled): TRUE nested/disjoint bounded faces sharing no vertex at
// all - e.g. a small closed loop fully enclosed within a larger one,
// with no shared vertex - are two SEPARATE connected components by
// definition (no edge connects them), so the component fix treats each
// as its own independent graph and correctly drops each one's own outer
// face - but has no way to know one component's "outer" region is
// actually the OTHER component's interior. Both ends up counted as
// bounded faces instead of the inner one being recognized as nested
// inside the outer one. Still not a mathematically guaranteed
// containment analysis - just no longer wrong about which trace is
// which component's own outer face.
function findFaces(segments, realNodes) {
    const deduped = dedupeSegments(segments);
    const { nodes: faceNodes, edges, edgeMeta } = splitSegments(deduped, realNodes);
    if (edges.length === 0) return { nodes: faceNodes, faces: [] };

    const nodeById = new Map(faceNodes.map(n => [n.id, n]));
    const adjacency = _buildFaceAdjacency(faceNodes, edges);
    const boundaries = _traceAllFaceBoundaries(faceNodes, edges, adjacency);

    const traced = boundaries
        .map(boundary => ({ boundary, area: _signedArea(boundary, nodeById) }))
        .filter(f => Math.abs(f.area) > 1e-6); // drop degenerate zero-area tree-branch traces

    if (traced.length === 0) return { nodes: faceNodes, faces: [] };

    const components = _connectedComponents(faceNodes, edges);
    const componentOf = new Map();
    components.forEach((comp, idx) => comp.forEach(id => componentOf.set(id, idx)));

    let bounded = [];
    components.forEach((comp, idx) => {
        const compTraced = traced.filter(f => componentOf.get(f.boundary[0]) === idx);
        if (compTraced.length === 0) return; // this component's only trace(s) were degenerate (zero-area) - nothing bounded here

        const positive = compTraced.filter(f => f.area > 0);
        const negative = compTraced.filter(f => f.area < 0);
        let compBounded;
        if (positive.length === 1 && negative.length >= 1) {
            compBounded = negative;
        } else if (negative.length === 1 && positive.length >= 1) {
            compBounded = positive;
        } else {
            // Ambiguous within this component (every trace shares one
            // sign, or more than one of each) - fall back to dropping
            // the single largest-|area| trace IN THIS COMPONENT, the
            // documented v1 heuristic above, now correctly scoped.
            compTraced.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
            compBounded = compTraced.slice(1);
        }
        // concat(), not push(...compBounded) - spreading a large array as
        // individual push() arguments hits V8's internal call-argument
        // limit (throws "Maximum call stack size exceeded", NOT true
        // recursion) once compBounded is big enough - a real crash found
        // live at ~7,200 cross-layer segments (1.10b-ii-b investigation),
        // not merely a performance concern. concat() takes the array as
        // one argument, no such limit.
        bounded = bounded.concat(compBounded);
    });

    const totalOrbits = deduped.reduce((max, s) =>
        (typeof s.connIndex === 'number' ? Math.max(max, s.connIndex + 1) : max), 0);
    // Roadmap 1.10b-ii-c: cross-sheet check first (strict presence rule,
    // see _faceSheetSet()) - only a confirmed same-sheet (or no-info)
    // face falls through to the existing per-sheet majority-orbit
    // mechanism. sheets rides on every face (not just cross-sheet ones)
    // as provenance for rendering/export (design session points 2/4).
    const faces = bounded.map(f => {
        const sheetSet = _faceSheetSet(f.boundary, edgeMeta);
        const isCrossSheet = sheetSet.size >= 2;
        const connIndex = isCrossSheet ? null : _majorityConnIndex(f.boundary, edgeMeta);
        return {
            nodeIds: f.boundary,
            area: Math.abs(f.area),
            connIndex,
            sheets: Array.from(sheetSet),
            color: isCrossSheet ? CROSS_SHEET_COLOR : orbitColor(connIndex, totalOrbits)
        };
    });
    return { nodes: faceNodes, faces };
}

// ----------------- LIVE-APP GLUE (rendering) ----------------------

// Complete pipeline for the live app: collects one sheet's connections
// through the real rendering pipeline (collectCellSegments()) and runs
// findFaces() over them. Straight-line-only for v1 (1.10 design session,
// point 5) - returns no faces at all rather than computing against
// curved geometry when curveAmount is set, since the UI keeps the face-
// fill and curve toggles mutually exclusive (step 6/6) but this defends
// the computation itself against that combination too, independent of
// the UI state.
function computeCellFaces(connSet) {
    if (curveAmount !== 0) return { nodes: [], faces: [] };
    const segments = collectCellSegments(connSet);
    return findFaces(segments, nodes);
}

// Roadmap 1.10b-i: every real (non-synthetic) node's own translated
// position at every tile anchor for one sheet within the neighborhood -
// needed so a crossing that happens to land exactly on a real grid node
// (at ANY tile position in the neighborhood, not just the untranslated
// one) snaps to that node's identity instead of spuriously becoming a
// synthetic point (design session, point 4's "new wrinkle not present
// in 1.10a": a real node id is no longer unambiguous once the same id
// appears at multiple different absolute positions across the
// neighborhood, so each instance gets its own id here, scoped by
// sheetId and which anchor it came from - never reused as a bare
// integer id, so it can never collide with collectCrossLayerSegments()'s
// own real node ids from a DIFFERENT tile). Reuses toTileLocal() (the
// exact same transform drawShapeCell() uses internally) rather than
// hand-rolling the flip180 math, so this can never drift from where the
// segments themselves actually are.
function _neighborhoodRealNodes(sheetId, residual, K, v1, v2) {
    const anchors = _neighborhoodTileAnchors(residual, K, v1, v2);
    const realNodes = [];
    anchors.forEach(({ offset, flip180 }, anchorIdx) => {
        const tileC = { x: centroid.x + offset.x, y: centroid.y + offset.y };
        nodes.forEach(n => {
            const p = toTileLocal(n, tileC, flip180);
            realNodes.push({ id: sheetId + ':' + anchorIdx + ':' + n.id, x: p.x, y: p.y });
        });
    });
    return realNodes;
}

// Roadmap 1.10b-i (design session points 3-4): the complete cross-layer
// pipeline entry point - collectCrossLayerSegments() (base + every given
// layer, one shared bounded neighborhood) plus every tile's own
// translated real nodes, run through findFaces() in exactly ONE call.
//
// Gather-once/run-once, deliberately NOT pairwise per sheet-pair (design
// session, point 3): a genuine 3-or-more-sheet simultaneous crossing
// only resolves to one correctly-shared node if every pairwise
// intersection among the segments meeting there is computed within the
// SAME splitSegments() pass - which is exactly what findFaces() already
// does for any flat segment list, reused entirely unmodified here.
// Running separate pairwise passes (base x layer1, base x layer2, ...)
// and stitching afterward would each only ever see 2 of the 3 converging
// segments, reconstructing inconsistent local graphs with no principled
// way to reconcile them - so this function exists specifically to never
// do that, not merely to be a convenience wrapper.
//
// Same straight-line-only guard as computeCellFaces() - curveAmount is a
// single value shared by every sheet (confirmed against core/symmetry.js
// in the design session, point 2a), so one top-level check covers base
// and every layer at once.
//
// layers: [{ sheetId, connections, offsetX, offsetY }, ...] - already
// filtered to enabled layers by the caller.
//
// Roadmap 1.10b-ii-c: also returns latticeBasis ({v1, v2}, from the same
// plan already computed here) alongside {nodes, faces} - the computed
// face set is anchored at the origin (base at residual (0,0)); both
// drawCrossLayerFaceFillsAcrossCanvas() (replicating it across the
// visible canvas by simple translation) and buildExportData()'s
// geometry.crossLayer need this same basis, so it rides along on the
// result rather than being recomputed a second time by each caller.
function computeCrossLayerFaces(baseConnSet, layers) {
    if (curveAmount !== 0) return { nodes: [], faces: [], latticeBasis: null };

    const plan = _planCrossLayerNeighborhood(layers);
    const segments = collectCrossLayerSegments(baseConnSet, layers);

    // concat(), not push(...bigArray) - see findFaces()'s bounded.concat()
    // comment for why (V8's call-argument limit, a real crash found live
    // during the 1.10b-ii-b investigation at large cross-layer
    // neighborhoods, not a performance nicety).
    let realNodes = _neighborhoodRealNodes('base', { x: 0, y: 0 }, plan.K, plan.v1, plan.v2);
    plan.decomposedLayers.forEach(layer => {
        realNodes = realNodes.concat(_neighborhoodRealNodes(layer.sheetId, layer.residual, plan.K, plan.v1, plan.v2));
    });

    const result = findFaces(segments, realNodes);
    result.latticeBasis = { v1: plan.v1, v2: plan.v2 };
    return result;
}

// Roadmap 1.10b-ii-b: a cheap prediction of how many segments
// computeCrossLayerFaces() would gather, WITHOUT actually gathering them
// (no per-tile-anchor drawShapeCell() calls) - used to size the soft
// time warning before the user commits to what's now (post 1.10b-ii-a's
// spatial-hash fix) a sub-second-to-few-seconds synchronous compute,
// rather than the tens-of-seconds-to-incomplete cost that originally
// motivated considering a Worker. EXACT (verified against real
// collectCrossLayerSegments() output at 1,200/2,400/3,600 segments, not
// just a bound), since every sheet shares the same K and copy count -
// callers must pass only already-complete ([id,id]) connection counts,
// matching what collectCrossLayerSegments() itself filters to.
//
// copiesPerConnection is measured via one real, cheap collectCellSegments()
// probe call (a single throwaway connection between the first two real
// nodes) instead of duplicating core/symmetry.js's rotAngles/reflection
// logic a second time to compute it by formula - stays correct if
// symmetryMode or the current shape's copy count ever changes, at the
// cost of one tiny real segment-collection call (O(copies), not O(S^2) -
// negligible next to what it's predicting).
//
// layers: same shape computeCrossLayerFaces() takes - already filtered
// to enabled layers by the caller.
function estimateCrossLayerSegmentCount(baseConnCount, layers) {
    const layerConnCount = layers.reduce((sum, l) => sum + l.connections.length, 0);
    if (nodes.length < 2 || (baseConnCount + layerConnCount) === 0) return 0;

    const probe = collectCellSegments([[nodes[0].id, nodes[1].id]]);
    const copiesPerConnection = probe.length;

    const plan = _planCrossLayerNeighborhood(layers);
    const anchorsPerSheet = (2 * plan.K + 1) * (2 * plan.K + 1) * (currentShape === 'triangle' ? 2 : 1);

    return anchorsPerSheet * copiesPerConnection * (baseConnCount + layerConnCount);
}

// Draws one sheet's already-computed faces (computeCellFaces() result)
// at one tessellated tile position, using the exact same toTileLocal()
// transform drawShapeCell() uses for lines - so face fills line up with
// the lines/nodes exactly, at every tile, both orientations included
// (flip180, for the triangle net's alternating up/down cells). Callers
// (core/tiling.js's tile*() functions) are expected to call this BEFORE
// drawShapeCell() at the same tile position, so fills render behind the
// line/node drawing (1.10 design session, point 7).
function drawFaceFillsAtTile(facesResult, tileCentroid, flip180) {
    const { nodes: faceNodes, faces } = facesResult;
    if (!faces || !faces.length) return;
    const nodeById = new Map(faceNodes.map(n => [n.id, n]));
    // push()/pop(): noStroke()/fill() are ambient p5 drawing-style state,
    // not scoped to this call - draw()'s own stroke(lineColor)/noFill()
    // (set once before drawTessellation(), see sketch.js) must survive
    // this function so the line drawing that follows (drawShapeCell(),
    // called right after this per tile*() function) still renders
    // strokes instead of silently going invisible.
    push();
    noStroke();
    faces.forEach(face => {
        fill(face.color);
        beginShape();
        face.nodeIds.forEach(id => {
            const n = nodeById.get(id);
            const p = toTileLocal(n, tileCentroid, flip180);
            vertex(p.x, p.y);
        });
        endShape(CLOSE);
    });
    pop();
}

// Roadmap 1.10b-ii-c: converts an hsl(...) color string (orbitColor()'s/
// CROSS_SHEET_COLOR's own format) to hsla(...) with the given alpha -
// used only by drawCrossLayerFaceFillsAcrossCanvas() below, so cross-
// layer fills read as a translucent overlay (lines and per-sheet fills
// underneath stay legible) without changing orbitColor()/CROSS_SHEET_COLOR
// themselves, which 1.10a's per-sheet rendering still needs fully opaque.
function _withAlpha(hslColor, alpha) {
    return hslColor.replace('hsl(', 'hsla(').replace(/\)$/, `, ${alpha})`);
}

// Roadmap 1.10b-ii-c (design session point 2): replicates one computed
// cross-layer face set across the WHOLE visible canvas by simple vector
// translation (i*v1 + j*v2 for every integer (i,j) within a bounded
// window) - generalizing maxLayerOffset()'s "widen the loop to cover
// shifted content" logic (core/tiling.js), but simpler here: there's no
// per-layer offset margin to add, since v1/v2 themselves ARE the
// replication step, not an extra shift on top of it.
//
// Unlike drawFaceFillsAtTile() (1.10a, per-sheet), this does NOT use
// toTileLocal() - facesResult.nodes are already absolute canvas
// coordinates from the neighborhood computation itself (see
// _neighborhoodRealNodes()/collectCrossLayerSegments()), anchored at the
// origin (base sheet's own residual is always (0,0)) - so replicating
// them is a plain "add i*v1+j*v2 to every coordinate", not a centroid-
// relative placement.
//
// Rendered as its own separate pass, on TOP of drawTessellation()'s
// entire per-sheet fill+line output (not interleaved into the tile*()
// loops the way per-sheet fills are) - the simplest safe integration
// that doesn't touch those already-shipped, tested functions, and
// guarantees cross-layer regions are never hidden underneath an opaque
// per-sheet fill (which would defeat the point of highlighting them).
// Drawn at reduced alpha (_withAlpha(), ~0.65) specifically so the line
// strokes it sits on top of stay legible through it - a deliberate,
// documented deviation from 1.10a's "fills strictly behind lines"
// convention, made because interleaving cross-layer fills into that
// per-tile choreography would require restructuring the tile*()
// functions' existing draw order.
//
// Known v1 caveat, not silently glossed over: the computed face set can
// include crossings between two DIFFERENT layers that don't involve the
// base sheet's tiles at all (the gather-once/run-once pass tests every
// segment against every other regardless of sheet - see
// computeCrossLayerFaces()'s own comment). This replication scheme
// attributes every face to "the base tile at the origin" and repeats
// that one full set at each (i,j) - correct for base-vs-layer crossings
// by construction (translation invariance - the design session's
// original argument), but a layer-vs-layer-only crossing near the edge
// of the K-neighborhood has no base tile to anchor its own translation
// to, and could in principle be slightly mis-replicated (missed or
// doubled at a neighborhood boundary) in that specific case. Not
// resolved here - flagged for a future pass if it turns out to matter
// in practice.
function drawCrossLayerFaceFillsAcrossCanvas(facesResult) {
    if (!facesResult || !facesResult.faces || !facesResult.faces.length || !facesResult.latticeBasis) return;
    const { nodes: faceNodes, faces, latticeBasis } = facesResult;
    const { v1, v2 } = latticeBasis;
    const nodeById = new Map(faceNodes.map(n => [n.id, n]));

    const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y);
    const cols = Math.ceil(width / m1) + 6;
    const rows = Math.ceil(height / m2) + 6;

    push();
    noStroke();
    for (let i = -cols; i <= cols; i++) {
        for (let j = -rows; j <= rows; j++) {
            const dx = i * v1.x + j * v2.x;
            const dy = i * v1.y + j * v2.y;
            faces.forEach(face => {
                fill(_withAlpha(face.color, 0.65));
                beginShape();
                face.nodeIds.forEach(id => {
                    const n = nodeById.get(id);
                    vertex(n.x + dx, n.y + dy);
                });
                endShape(CLOSE);
            });
        }
    }
    pop();
}
