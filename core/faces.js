/**
 * core/faces.js
 * Roadmap 1.10a: face (enclosed-region) detection for a single sheet's
 * symmetry-expanded connections, and the simple symmetry-orbit
 * coloring built on top of it. Part of the portable "core" module set
 * (see CLAUDE.md).
 *
 * Two tiers, clearly separated below:
 *  - Pure geometry (dedup, intersection, node-snapping, the half-edge
 *    face-walk, findFaces() itself) - zero p5 dependency, uses Math.*
 *    not p5's global aliases, same portability standard as
 *    core/forms.js. Testable headlessly with plain segment arrays,
 *    with no canvas/DOM/live app state involved.
 *  - Live-app glue (collectCellSegments()) - bridges into the app's
 *    actual rendering pipeline (drawShapeCell(), segmentCollector) so
 *    the segments fed into the pure geometry below can never drift
 *    from what's actually drawn on screen.
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
function collectCellSegments(connSet) {
    segmentCollector = [];
    drawShapeCell(connSet, centroid, false);
    const segments = segmentCollector;
    segmentCollector = null;
    return segments;
}

// ----------------- PURE GEOMETRY ----------------------------------

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

// Registry of nodes actually referenced while splitting segments, keyed
// by id, seeded from the sheet's real nodes (from state.js's nodes[] -
// passed in explicitly, never read as a global, to keep this module
// p5/live-app independent per the file docblock) but populated lazily:
// a real node only gets an entry once some breakpoint actually snaps to
// it, and synthetic ids ('s0', 's1', ...) are string-prefixed so they
// can never collide with real nodes' plain integer ids.
function createNodeRegistry(realNodes) {
    return { realNodes: realNodes || [], byId: new Map(), nextSyntheticId: 0 };
}

// Snaps a breakpoint (segment endpoint or intersection point) onto an
// existing node within FACE_EPSILON - checking already-registered nodes
// first (so repeated visits to the same point, e.g. an intersection
// computed once per participating segment, always resolve to the same
// id regardless of visit order), then the sheet's real nodes, else
// registers a new synthetic node at that exact point.
function snapOrCreateNode(point, registry) {
    for (const n of registry.byId.values()) {
        if (Math.hypot(n.x - point.x, n.y - point.y) <= FACE_EPSILON) return n.id;
    }
    for (const n of registry.realNodes) {
        if (Math.hypot(n.x - point.x, n.y - point.y) <= FACE_EPSILON) {
            registry.byId.set(n.id, { id: n.id, x: n.x, y: n.y });
            return n.id;
        }
    }
    const id = 's' + (registry.nextSyntheticId++);
    registry.byId.set(id, { id, x: point.x, y: point.y });
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
            const key = String(a) < String(b) ? a + '|' + b : b + '|' + a;
            if (!edgeMap.has(key)) edgeMap.set(key, [a, b]);
        }
    }
    return { nodes: Array.from(registry.byId.values()), edges: Array.from(edgeMap.values()) };
}
