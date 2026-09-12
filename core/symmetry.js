/**
 * core/symmetry.js
 * Ostwald's symmetry-group engine: point-transform primitives
 * (rotateAround/reflectVerticallyAround) and the per-shape rotation/
 * reflection application (drawConnectionWithSymmetry). Part of the
 * portable "core" module set (see CLAUDE.md) - this is where
 * roadmap 1.9 (higher-order combinatorics) and 1.11 (Burnside/Pólya
 * enumeration) will need to hook in, since both operate on exactly
 * this rotation/reflection group structure.
 *
 * drawConnectionWithSymmetry() currently draws directly (via
 * drawCurvedBezier) rather than returning the transformed-copy data;
 * that's a deliberate scope boundary for this move, not an oversight -
 * see the module-split discussion for why that question is deferred
 * to 1.3(b)'s own design instead of being folded into this refactor.
 */

function rotateAround(pt, center, angleDeg) {
    const rad = radians(angleDeg);
    const dx = pt.x - center.x;
    const dy = pt.y - center.y;
    return {
        x: center.x + dx * cos(rad) - dy * sin(rad),
        y: center.y + dx * sin(rad) + dy * cos(rad)
    };
}

// Roadmap 1.2-B: coordinate-free reflection across an arbitrary line
// through `center`, given a UNIT direction vector `dir` for that line -
// p' = center + 2*((p-center)·dir)*dir - (p-center). reflectVerticallyAround()
// below is the special case dir=(0,1) (a vertical line) - the only case
// reachable today, since all three axis-aligned grid builders happen to
// have a vertical mirror axis. This general form is the fix flagged in
// the 1.2-B design session's point 6: reflectVerticallyAround() alone
// mirrors across the WRONG axis for an arbitrarily rotated polygon from
// completeEdgeToRegularPolygon() (1.2-A) - verified concretely against a
// synthetic rotated triangle (not yet reachable via the UI - that's
// 1.2-C's job to wire up), where the old vertical-only formula gives a
// visibly wrong result and this general one gives the correct mirror
// image. Not yet wired into drawConnectionWithSymmetry() below, which
// has no per-shape mirror-axis direction to pass yet.
function reflectAcrossLine(pt, center, dir) {
    const dx = pt.x - center.x, dy = pt.y - center.y;
    const dot = dx * dir.x + dy * dir.y;
    return {
        x: center.x + 2 * dot * dir.x - dx,
        y: center.y + 2 * dot * dir.y - dy
    };
}

function reflectVerticallyAround(pt, center) {
    return reflectAcrossLine(pt, center, { x: 0, y: 1 });
}

// ----------------- DRAWING LINES + SYMMETRY ---------------------
// Roadmap 1.5-A: id1/id2 (the connection's real node ids, from
// core/tiling.js's drawShapeCell()) are passed straight through to
// EVERY drawCurvedBezier() call below - base, every rotated copy, and
// every reflected copy - unchanged, regardless of which transform
// produced that call's own p1/p2. This is what makes every symmetry/
// tessellation copy of one base connection derive the SAME per-
// connection seed (core/curves.js's _connectionSeed()), and hence show
// the same underlying 'free' noise pattern, just transformed along with
// the geometry - not independently re-rolled per copy (verified in the
// 1.5-A implementation report).
function drawConnectionWithSymmetry(p1, p2, center, id1, id2) {
    // Linienfarbe und Füllung werden im draw() global gesetzt
    strokeWeight(2);
    // Roadmap 1.4-A: curveType replaces the old bare curveAmount number
    // (core/curves.js). Rotated copies below reuse curveType UNCHANGED -
    // rotation preserves a curve's LOCAL (chord-relative) leaning, same
    // as the pre-1.4-A code leaving curveAmount unchanged for rotations.
    // Reflected copies use mirrorCurveType(curveType) instead of the old
    // numeric negation (-curveAmount) - see that function's own comment
    // in core/curves.js for why only `leaning` needs to flip.
    drawCurvedBezier(p1, p2, curveType, id1, id2);

    // Choose rotation set per shape, ignore incompatible modes gracefully
    let rotAngles = [];
    if (currentShape === 'square') {
        if (symmetryMode === 'rotation3' || symmetryMode === 'rotation6') rotAngles = [90, 180, 270];
        if (symmetryMode === 'rotation_reflection3' || symmetryMode === 'rotation_reflection6') rotAngles = [90, 180, 270];
    } else if (currentShape === 'triangle') {
        if (symmetryMode === 'rotation3' || symmetryMode === 'rotation6') rotAngles = [120, 240];
        if (symmetryMode === 'rotation_reflection3' || symmetryMode === 'rotation_reflection6') rotAngles = [120, 240];
    } else { // hex
        if (symmetryMode === 'rotation3') rotAngles = [120, 240];
        if (symmetryMode === 'rotation6') rotAngles = [60, 120, 180, 240, 300];
        if (symmetryMode === 'rotation_reflection3') rotAngles = [120, 240];
        if (symmetryMode === 'rotation_reflection6') rotAngles = [60, 120, 180, 240, 300];
    }

    // Rotations
    rotAngles.forEach(a => {
        const sR = rotateAround(p1, center, a);
        const eR = rotateAround(p2, center, a);
        drawCurvedBezier(sR, eR, curveType, id1, id2);
    });

    // Reflection(s)
    if (symmetryMode === 'reflection_only') {
        const sRef = reflectVerticallyAround(p1, center);
        const eRef = reflectVerticallyAround(p2, center);
        drawCurvedBezier(sRef, eRef, mirrorCurveType(curveType), id1, id2);
    }
    if (symmetryMode === 'rotation_reflection3' || symmetryMode === 'rotation_reflection6') {
        const sRef = reflectVerticallyAround(p1, center);
        const eRef = reflectVerticallyAround(p2, center);
        drawCurvedBezier(sRef, eRef, mirrorCurveType(curveType), id1, id2);
        rotAngles.forEach(a => {
            const sR = rotateAround(p1, center, a);
            const eR = rotateAround(p2, center, a);
            const sRR = reflectVerticallyAround(sR, center);
            const eRR = reflectVerticallyAround(eR, center);
            drawCurvedBezier(sRR, eRR, mirrorCurveType(curveType), id1, id2);
        });
    }
}
