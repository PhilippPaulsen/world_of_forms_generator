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
