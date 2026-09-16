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

// Roadmap 1.2-C: the CURRENT shape's own mirror-axis direction, derived
// from its actual (possibly rotated) outerCorners/centroid rather than
// assuming vertical - this is the wiring 1.2-B's own docblock flagged as
// still missing ("not yet wired into drawConnectionWithSymmetry()").
// A regular n-gon has n valid mirror axes; this picks ONE (through
// outerCorners[0] itself for triangle - the vertex-to-opposite-edge-
// midpoint axis; through the midpoint of edge (outerCorners[0],
// outerCorners[1]) for square/hex - an edge-midpoint-to-edge-midpoint
// axis) - WHICH one doesn't matter for correctness (any of the n axes,
// combined with the rotation copies drawConnectionWithSymmetry() already
// draws, recovers the full dihedral group correctly), only that it's a
// TRUE axis of the polygon at its actual current orientation, not a
// fixed vertical line. Verified (1.2-C implementation) to reduce to
// exactly (0,+-1) - i.e. byte-compatible with the old hardcoded vertical
// axis via reflectAcrossLine()'s own sign-invariance - for all three
// default axis-aligned builders, across a real shapeSizeFactor/
// nodeCount/canvas sweep, not just the one config checked by hand here.
// Roadmap 1.12 stage 3: outerCornersOverride/centroidOverride let a
// differently-rotated layer's own independent tile pass (core/tiling.js)
// compute ITS OWN true mirror axis, instead of always reading the
// globals - undefined/omitted is byte-identical to before this stage,
// since every pre-existing call site omits both. A rotated layer's own
// outerCorners (already rotated about the shared centroid by the time
// this is called - see each tile*() function's own comment) plugged
// into this SAME, otherwise-unchanged formula correctly gives that
// layer's own rotated axis - this function was already purely a
// function of geometry (1.2-C's own point), so no new logic was needed
// here, only parameterizing what was previously hardcoded to the
// globals.
// Roadmap 1.12 stage 4 part 2: shapeOverride - undefined/omitted (every
// pre-stage-4-part-2 call site) falls back to the global currentShape,
// byte-identical to before. A cross-shape layer's own independent tile
// pass (core/tiling.js) passes its own shape here instead, since this
// function branches on shape to pick WHICH axis-derivation formula
// applies (vertex-to-centroid for triangle; edge-midpoint-to-centroid
// for square/hex) - using the base's shape for a differently-shaped
// layer would pick the wrong formula entirely, not just a wrong angle.
function mirrorAxisDir(outerCornersOverride, centroidOverride, shapeOverride) {
    const oc = outerCornersOverride || outerCorners;
    const ctr = centroidOverride || centroid;
    const shape = shapeOverride || currentShape;
    let dir;
    if (shape === 'triangle') {
        dir = { x: oc[0].x - ctr.x, y: oc[0].y - ctr.y };
    } else { // square, hex
        const c0 = oc[0], c1 = oc[1];
        const mid = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 };
        dir = { x: mid.x - ctr.x, y: mid.y - ctr.y };
    }
    const len = Math.hypot(dir.x, dir.y);
    return { x: dir.x / len, y: dir.y / len };
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
// Roadmap 1.12 stage 3: mirrorAxisOverride - undefined/omitted (every
// pre-existing call site) falls back to mirrorAxisDir()'s own base-
// global computation, byte-identical to before this stage. A rotated
// layer's own independent tile pass (core/tiling.js) passes its own
// true mirror axis here instead - computed ONCE per tile*() call (not
// per connection), reused for every connection/tile that call draws.
// Rotational symmetry copies (rotAngles.forEach below) need NO such
// override: rotateAround(p1, center, a) composes correctly regardless
// of any ambient pre-rotation of p1/center - a 120 degree copy is still
// a valid 120 degree copy whichever way the whole tile is oriented.
// Only reflection is orientation-dependent, which is why only the axis
// (not the rotation angles themselves) needs threading through.
// Roadmap 1.12 stage 4 part 2: shapeOverride - undefined/omitted (every
// pre-stage-4-part-2 call site) falls back to the global currentShape,
// byte-identical to before. This is the genuinely NEW gap stage 3 never
// needed to touch: rotAngles below is a table keyed by shape (which
// rotation angles are even valid for this shape's own symmetry group),
// not just an angle stage 3's own rotationDeg could rotate - a
// differently-shaped layer needs ITS OWN valid rotAngles set, not the
// base's.
// Roadmap 1.12 stage 5 (symmetryMode axis) part 1: symmetryModeOverride -
// undefined/omitted (every pre-stage-5 call site) falls back to the
// global symmetryMode, byte-identical to before. Supersedes this
// function's own former claim that "symmetryMode itself stays global/
// shared (confirmed correct in the stage-4 design session)" - that
// conclusion was scoped to a narrower question (does a differently-
// shaped layer render correctly UNDER the shared mode - yes, once the
// shape used for this table's lookup is the layer's own) and never
// evaluated whether a layer should be able to choose its OWN mode, which
// is what this stage adds. Read once into a local `mode` below (not
// re-read from the global at each of the 11 comparison sites this
// function has) so every rotAngles/reflection decision within one call
// consistently uses the SAME resolved value, the same "compute once,
// reuse" discipline mirrorAxisOverride/shapeOverride already follow here.
function drawConnectionWithSymmetry(p1, p2, center, id1, id2, mirrorAxisOverride, shapeOverride, symmetryModeOverride) {
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

    const shape = shapeOverride || currentShape;
    const mode = symmetryModeOverride || symmetryMode;
    // Choose rotation set per shape, ignore incompatible modes gracefully
    let rotAngles = [];
    if (shape === 'square') {
        if (mode === 'rotation3' || mode === 'rotation6') rotAngles = [90, 180, 270];
        if (mode === 'rotation_reflection3' || mode === 'rotation_reflection6') rotAngles = [90, 180, 270];
    } else if (shape === 'triangle') {
        if (mode === 'rotation3' || mode === 'rotation6') rotAngles = [120, 240];
        if (mode === 'rotation_reflection3' || mode === 'rotation_reflection6') rotAngles = [120, 240];
    } else { // hex
        if (mode === 'rotation3') rotAngles = [120, 240];
        if (mode === 'rotation6') rotAngles = [60, 120, 180, 240, 300];
        if (mode === 'rotation_reflection3') rotAngles = [120, 240];
        if (mode === 'rotation_reflection6') rotAngles = [60, 120, 180, 240, 300];
    }

    // Rotations
    rotAngles.forEach(a => {
        const sR = rotateAround(p1, center, a);
        const eR = rotateAround(p2, center, a);
        drawCurvedBezier(sR, eR, curveType, id1, id2);
    });

    // Reflection(s) - Roadmap 1.2-C: mirrorAxisDir() (this shape's own
    // actual mirror axis, computed once per call) replaces the hardcoded
    // reflectVerticallyAround() at all three sites below, so a rotated
    // net from completeEdgeToRegularPolygon() reflects across ITS true
    // axis rather than a fixed vertical line - byte-compatible with the
    // old behavior for every default (axis-aligned) shape, since
    // mirrorAxisDir() reduces to exactly (0,+-1) there (verified).
    if (mode === 'reflection_only' || mode === 'rotation_reflection3' || mode === 'rotation_reflection6') {
        const axisDir = mirrorAxisOverride || mirrorAxisDir();
        const sRef = reflectAcrossLine(p1, center, axisDir);
        const eRef = reflectAcrossLine(p2, center, axisDir);
        drawCurvedBezier(sRef, eRef, mirrorCurveType(curveType), id1, id2);
        if (mode !== 'reflection_only') {
            rotAngles.forEach(a => {
                const sR = rotateAround(p1, center, a);
                const eR = rotateAround(p2, center, a);
                const sRR = reflectAcrossLine(sR, center, axisDir);
                const eRR = reflectAcrossLine(eR, center, axisDir);
                drawCurvedBezier(sRR, eRR, mirrorCurveType(curveType), id1, id2);
            });
        }
    }
}
