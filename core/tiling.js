/**
 * core/tiling.js
 * Plane tessellation per net type - Ostwald's "unlimited surfaces".
 * Part of the portable "core" module set (see CLAUDE.md). This is
 * where roadmap 1.3(b)/1.9 (offset overlays, generalized to N sheets)
 * hook in: drawShapeCell() takes which connection set to draw, so each
 * tile*() function calls it once for the base sheet unconditionally,
 * then once per enabled entry in additionalLayers at that layer's own
 * shifted tile anchor. curveType stays shared across every sheet (see
 * the 1.3(b)/1.9/1.4-A design sessions: a plate-wide stylistic choice,
 * not a per-connection or per-sheet property) - symmetryMode no longer
 * does (Roadmap 1.12 stage 5): each additionalLayers[] entry carries its
 * own symmetryMode (addLayer()/core/state.js), threaded through
 * drawShapeCell()'s own symmetryModeOverride parameter down to
 * drawConnectionWithSymmetry() exactly the way shapeOverride already is
 * (stage 4 part 2) - shape and symmetryMode are the two per-sheet axes
 * drawConnectionWithSymmetry() itself branches on, curveType isn't. Also
 * relevant to 1.1/1.2/1.12 (alternative net construction, cross-order/
 * cross-net combination).
 *
 * Roadmap 1.10a: each tile*() function also takes an optional cellFaces
 * param (drawTessellation()'s computeCellFaces(connections) result, or
 * null when the base sheet's face-fill toggle is off) and an optional
 * layerCellFaces map (additional-layer index -> its own computeCellFaces()
 * result, only for layers with their own showFaces on - see
 * additionalLayers[].showFaces in state.js/addLayer()); when set, each
 * draws via core/faces.js's drawFaceFillsAtTile() at each tile position
 * BEFORE that sheet's own drawShapeCell() call, so face fills render
 * behind that sheet's own line/node drawing (1.10 design session, point
 * 7 - "pro Blatt/Sheet unabhängig", no cross-layer fill in 1.10a).
 */

// ----------------- GRID & TILING -------------------------------
// Roadmap 1.12 stage 4 part 2: the one genuinely new dispatch primitive
// this stage needs - a small lookup replacing every hand-written
// if(shape==='hex')...else-if...else chain that previously always
// branched on the single global currentShape. Used both for the base
// sheet (tileFor(currentShape), byte-identical in effect to the old
// inline chain) and, new, for each layer's own shape
// (tileFor(layer.shape)) - the actual structural change this stage
// makes: which tile*() function runs for a given sheet is no longer
// decided once globally, but per sheet.
function tileFor(shape) {
    return shape === 'hex' ? tileHex : shape === 'square' ? tileSquare : tileTriangle;
}

function drawTessellation() {
    // Computed once per redraw (not per tile - see computeCellFaces()'s
    // own cost) when the base sheet's face-fill toggle is on (roadmap
    // 1.10a step 5/6's rendering hookup); each tile*() function draws
    // this same face set at every tile position via drawFaceFillsAtTile().
    const cellFaces = showFaces ? computeCellFaces(connections, nodes, faceAssignmentsFor('base')) : null;
    const layerCellFaces = computeLayerCellFaces();
    tileFor(currentShape)(cellFaces, layerCellFaces);

    // Roadmap 1.12 stage 1: an additional layer whose OWN scale differs
    // from the base's gets its own independent tile pass (own v1/v2,
    // own latticeIJBounds()) instead of riding the base's tile loop -
    // drawAdditionalLayers() (called from inside the base tile*() calls
    // above) only shifts a layer's cell by (offsetX,offsetY) at each
    // BASE tile position, which is the wrong pitch for a smaller/larger
    // shape: a half-linear-scale shape has a quarter the area, so one
    // draw per base-tile only covers roughly a quarter of what its own
    // correctly-pitched tessellation would (1.12 stage-1 design
    // session). Same-scale layers stay handled inside the base's own
    // loop via drawAdditionalLayers() (see its own updated guard) -
    // unaffected, and still the cheaper path for the common case.
    additionalLayers.forEach((layer, i) => {
        if (!layer.enabled) return;
        // Roadmap 1.12 stage 3: also routed to the independent pass
        // whenever this layer's own rotation is nonzero, even at matching
        // scale - a rotated-but-same-scale layer riding the base's own
        // tile loop (drawAdditionalLayers()) would get rotated CONTENT
        // pasted onto the base's UNROTATED tile positions, not a true
        // rigid rotation.
        // Roadmap 1.12 stage 4 part 2: also routed to the independent
        // pass whenever this layer's own shape differs from the base's -
        // there is no "base loop" a differently-shaped layer could ride
        // through even in principle (tileHex()'s hexagonal lattice math
        // is not a parametrization of tileTriangle()'s). Re-verified via
        // De Morgan's law with this third term added (not assumed to
        // "just extend"): NOT(scale===base AND rotation===0 AND
        // shape===base's shape) === (scale!==base OR rotation!==0 OR
        // shape!==base's shape) - drawAdditionalLayers()'s own guard
        // below is exactly this, preserving the "every enabled layer
        // drawn exactly once" invariant those two guards have always
        // maintained.
        if (layer.shapeSizeFactor === shapeSizeFactor && (layer.rotation || 0) === 0 && layer.shape === currentShape) return; // handled inside the base's own tile loop instead
        // Roadmap 1.12 stage 1 (node-resolution fix): reads this layer's
        // own PERSISTED outerCorners/centroid/nodes (populated once by
        // addLayer(), see its own comment) instead of calling
        // layerGrid() fresh here - a fresh call would silently discard
        // any free-endpoint node (1.3(a)) added to this layer, since
        // _subdivide*Interior() restarts node ids at 1 on every call,
        // never the SAME array a previous click's push() landed in.
        // Roadmap 1.12 stage 2: offsetX/offsetY threaded through too -
        // previously omitted here entirely, so a differently-scaled
        // layer's own offset (already settable via the existing 1.9
        // offset UI, already exported) had silently NO rendering effect
        // at all - see each tile*() function's own override-branch fix.
        // Roadmap 1.12 stage 3: rotation threaded through the same way -
        // this layer's own rotation angle (degrees, about the shared
        // centroid), read by each tile*() function's own override branch
        // to rotate its outerCorners once (see there).
        // Roadmap 1.12 stage 4 part 2: shape threaded through too - used
        // both for the tileFor() dispatch just below AND inside each
        // tile*() function's own mirrorAxisDir()/drawConnectionWithSymmetry()
        // calls (see core/symmetry.js), so a layer's own reflection axis
        // and rotation-angle set are derived from ITS OWN shape, not the
        // base's.
        // Roadmap 1.12 stage 5 (symmetryMode axis) part 1: symmetryMode
        // threaded through too, same pass-through role as shape above but
        // narrower - it only ever reaches drawConnectionWithSymmetry()
        // (via each tile*() function's own symmetryModeOverride, see
        // there), never tileFor() or anything computing tile POSITIONS,
        // since symmetryMode has no bearing on where tiles are, only on
        // what's drawn within one (see each tile*() function's own
        // symmetryModeOverride comment).
        // Roadmap 1.8 Stage B (connections morph): layer._morphNodes/
        // _morphConnections (sketch.js's applyLayerConnectionsMorphFrame())
        // take priority over this layer's own persisted nodes/connections
        // whenever set - the interpolated render substitute for an
        // in-progress Start-to-End connections morph, recomputed once per
        // draw() call (not per tile, see that function's own comment).
        // null/undefined (every layer without an active connections morph,
        // and this same layer between Set Start/End and the next Play/
        // scrub) falls back to the layer's own live nodes/connections,
        // byte-identical to before this stage.
        const override = { outerCorners: layer.outerCorners, centroid: layer.centroid, connections: layer._morphConnections || layer.connections, nodes: layer._morphNodes || layer.nodes, offsetX: layer.offsetX, offsetY: layer.offsetY, rotation: layer.rotation, shape: layer.shape, symmetryMode: layer.symmetryMode };
        const thisLayerFaces = (layerCellFaces && layerCellFaces.has(i)) ? layerCellFaces.get(i) : null;
        tileFor(layer.shape)(thisLayerFaces, null, override);
    });
}

// Same "compute once per redraw" reasoning as drawTessellation()'s own
// cellFaces, generalized to additional layers: only layers that are
// both enabled and have their own showFaces on get computed at all: a
// disabled layer already draws nothing, and most layers won't have
// face-fill on. Returns null when no layer needs it, so drawAdditionalLayers()
// can skip the per-tile Map lookup entirely in the common case.
// Roadmap 1.12 stage 1: a layer whose own scale differs from the
// base's is EXCLUDED here even when its own showFaces is on -
// computeCellFaces()/collectCellSegments() (core/faces.js) resolve node
// positions via the GLOBAL nodes/centroid (drawShapeCell()'s own
// nodes.find(...) and the untranslated `centroid` collection anchor),
// which is only correct for a layer sharing the base's exact grid.
// Computing it anyway would silently produce wrong (or, since the
// layer's own node ids may not even exist in the global nodes array,
// empty) face data - refusing is the same "don't silently compute
// wrong" principle as the cross-layer guard in sketch.js's
// computeCrossLayerFacesFlow(). A per-layer face-fill for a genuinely
// independent grid is a real follow-on gap, not fixed here - see the
// 1.12 stage-1 design/implementation notes.
function computeLayerCellFaces() {
    // Roadmap 1.12 stage 3: rotation excluded here too, same principle
    // as the scale exclusion below - computeCellFaces()/
    // collectCellSegments() (core/faces.js) call drawShapeCell() with no
    // rotation-awareness at all (not threaded there in this stage), so a
    // rotated layer's face-fill would be silently computed against its
    // UNROTATED content. Left deliberately unfixed here, extending the
    // already-on-record "per-layer face-fill for a genuinely independent
    // grid is a real follow-on gap" note from stage 1 to also cover
    // rotation, rather than threading rotation through faces.js in this
    // pass.
    const active = additionalLayers.filter(l => l.enabled && l.showFaces && l.shapeSizeFactor === shapeSizeFactor && (l.rotation || 0) === 0);
    if (active.length === 0) return null;
    const map = new Map();
    additionalLayers.forEach((layer, i) => {
        // Roadmap 1.12 stage 1 (node-resolution fix): layer.nodes passed
        // through explicitly - computeCellFaces() no longer silently
        // resolves this layer's connections against the global nodes
        // array. The shapeSizeFactor guard above is unchanged (a
        // separate, still-latent gap for a same-scale-different-order
        // layer - not reachable via any shipped UI yet, flagged in the
        // 1.12 stage-1 node-resolution-fix design session, not fixed
        // here).
        if (layer.enabled && layer.showFaces && layer.shapeSizeFactor === shapeSizeFactor && (layer.rotation || 0) === 0) map.set(i, computeCellFaces(layer.connections, layer.nodes, faceAssignmentsFor(i)));
    });
    return map;
}

// Roadmap 1.2-B: the current shape's own two lattice vectors (v1,v2),
// matching each tile*() function's own corner-derived basis exactly
// (same corners, same convention - no longer independently re-derived
// scalar spacing that had to be "kept in sync manually"). Used by the
// "1 mesh-width" overlay-offset presets - see sketch.js setup(). This
// changed shape - from {x,y} (two independent axis-aligned scalars) to
// {v1,v2} (two 2D vectors) - because a single scalar-per-axis mesh
// width only made sense for an axis-aligned net; the two call sites in
// sketch.js were updated to match (see 1.2-B implementation notes).
function getMeshWidth() {
    if (currentShape === 'square') {
        const c0 = outerCorners[0], c1 = outerCorners[1], c3 = outerCorners[3];
        return {
            v1: { x: c1.x - c0.x, y: c1.y - c0.y },
            v2: { x: c3.x - c0.x, y: c3.y - c0.y }
        };
    } else if (currentShape === 'hex') {
        const c0 = outerCorners[0], c2 = outerCorners[2], c4 = outerCorners[4];
        return {
            v1: { x: c2.x - c0.x, y: c2.y - c0.y },
            v2: { x: c4.x - c0.x, y: c4.y - c0.y }
        };
    } else { // triangle
        const A = outerCorners[0], B = outerCorners[1], C = outerCorners[2];
        return {
            v1: { x: C.x - B.x, y: C.y - B.y },
            v2: { x: C.x - A.x, y: C.y - A.y }
        };
    }
}

// Roadmap 1.12 stage 1 (node-resolution fix): nodeArr defaults to the
// base's own global `nodes` - every pre-existing call site that omits
// it (core/faces.js's base-sheet calls, any future base-only caller)
// is byte-identical. Callers drawing a LAYER's own connections
// (drawAdditionalLayers(), the tile*() functions' override branch) pass
// that layer's own persisted node array explicitly - previously this
// always resolved against the global nodes regardless of which layer
// was being drawn, so a layer's connections (referencing that layer's
// own node ids) could silently resolve to the wrong (or no) node,
// producing geometrically wrong content within that layer's own tile
// cells (verified concretely before this fix: a connection spanning
// one full base edge rendered 2x too long inside a half-scale layer's
// own tile).
// Roadmap 1.12 stage 3: rotationDeg/mirrorAxisOverride - both default to
// byte-identical-to-before-this-stage values (0 / undefined) for every
// pre-existing call site. rotationDeg is threaded into toTileLocal()
// (rotates this layer's own node content); mirrorAxisOverride is
// threaded into drawConnectionWithSymmetry() (this layer's own true
// mirror axis for reflection copies) - both computed ONCE per tile*()
// call by the caller (not re-derived per connection here), see each
// tile*() function's own comment.
// Roadmap 1.12 stage 4 part 2: shapeOverride - undefined/omitted (every
// pre-stage-4-part-2 call site) falls back to drawConnectionWithSymmetry()'s
// own currentShape default, byte-identical to before. Threaded through
// to drawConnectionWithSymmetry() so a differently-shaped layer's own
// rotAngles set is used, not the base's.
// Roadmap 1.12 stage 5 (symmetryMode axis) part 1: symmetryModeOverride -
// undefined/omitted (every pre-stage-5 call site) falls back to
// drawConnectionWithSymmetry()'s own global-symmetryMode default, byte-
// identical to before. Same pass-through-only role as shapeOverride
// directly above - this function never branches on it itself, only
// forwards it.
function drawShapeCell(connSet, tileCentroid, flip180 = false, nodeArr = nodes, rotationDeg = 0, mirrorAxisOverride, shapeOverride, symmetryModeOverride) {
    for (const conn of connSet) {
        if (conn.length === 2) {
            const n1 = nodeArr.find(n => n.id === conn[0]);
            const n2 = nodeArr.find(n => n.id === conn[1]);
            if (!n1 || !n2) continue;
            const p1 = toTileLocal(n1, tileCentroid, flip180, rotationDeg);
            const p2 = toTileLocal(n2, tileCentroid, flip180, rotationDeg);
            // Roadmap 1.5-A: n1.id/n2.id passed through so
            // core/curves.js's buildCurvePieces() can derive a per-
            // connection seed for kind:'free' - p1/p2 are already-
            // transformed tile-local coordinates and can't be reversed
            // back into node ids (not stable across this same
            // connection's other tessellated/symmetry copies), so the
            // real ids have to be threaded through from here, the place
            // they're naturally still available.
            drawConnectionWithSymmetry(p1, p2, tileCentroid, n1.id, n2.id, mirrorAxisOverride, shapeOverride, symmetryModeOverride);
        }
    }
}

// One additional layer's tile anchor: same tileCentroid as the base
// sheet, shifted by that layer's own (offsetX, offsetY) - independent
// per layer relative to the base grid, not chained (see 1.9 design
// session). Shared by all three tile*() functions below.
function layerTileCentroid(tileCentroid, layer) {
    return { x: tileCentroid.x + layer.offsetX, y: tileCentroid.y + layer.offsetY };
}

// Draws every enabled additional layer at one base tile position -
// the loop each tile*() function calls once per orientation, right
// after its own unconditional base-sheet drawShapeCell() call.
// layerCellFaces (computeLayerCellFaces() result, or null) supplies
// each layer's own precomputed faces, drawn at that SAME layer's own
// shifted tile anchor (not the base tileCentroid) right before that
// layer's own drawShapeCell() call, same "fill behind lines" ordering
// as the base sheet.
function drawAdditionalLayers(tileCentroid, flip180 = false, layerCellFaces = null) {
    additionalLayers.forEach((layer, i) => {
        if (!layer.enabled) return;
        // Roadmap 1.12 stage 1: a layer whose own scale differs from
        // the base's is drawn by its own independent tile pass instead
        // (see drawTessellation()) - riding the base's tile loop here
        // would use the base's (wrong) pitch for it.
        // Roadmap 1.12 stage 3: same for a layer whose own rotation is
        // nonzero, even at matching scale - see drawTessellation()'s own
        // comment for why (and for this condition being that guard's
        // exact logical complement, preserving "drawn exactly once").
        // Roadmap 1.12 stage 4 part 2: same for a layer whose own shape
        // differs from the base's - re-verified via De Morgan's law
        // (not assumed) that this third term keeps this guard the exact
        // complement of drawTessellation()'s own updated condition, see
        // there.
        if (layer.shapeSizeFactor !== shapeSizeFactor || (layer.rotation || 0) !== 0 || layer.shape !== currentShape) return;
        const layerTileC = layerTileCentroid(tileCentroid, layer);
        if (layerCellFaces && layerCellFaces.has(i)) drawFaceFillsAtTile(layerCellFaces.get(i), layerTileC, flip180);
        // Roadmap 1.12 stage 1 (node-resolution fix): this layer's own
        // persisted nodes, not the base's - even a same-scale layer can
        // have its own different nodeCount (interior density), whose
        // connections reference ITS OWN node ids, not the base's.
        // Roadmap 1.12 stage 5 (symmetryMode axis) part 1: this layer's
        // own symmetryMode, threaded as the 8th (symmetryModeOverride)
        // argument - rotationDeg/mirrorAxisOverride/shapeOverride stay at
        // their defaults (0/undefined/undefined) deliberately: the guard
        // above already guarantees this layer's rotation is 0 and its
        // shape matches the base's, so omitting them still resolves
        // correctly (undefined shapeOverride falls back to currentShape,
        // which the guard has already confirmed equals layer.shape).
        // symmetryMode has no such guard - a layer can ride this same
        // fast path with a genuinely different symmetryMode, since (see
        // drawTessellation()'s own override object comment) it never
        // affects tile POSITIONS, only what's drawn at one - so it's the
        // one axis here that always needs passing explicitly, never
        // omitted.
        // Roadmap 1.8 Stage B (connections morph): same _morphConnections/
        // _morphNodes substitution as drawTessellation()'s own override
        // object above - see that comment.
        drawShapeCell(layer._morphConnections || layer.connections, layerTileC, flip180, layer._morphNodes || layer.nodes, 0, undefined, undefined, layer.symmetryMode);
    });
}

// Largest |offsetX|/|offsetY| among enabled additional layers. Each
// tile*() function's loop bounds are sized to cover the canvas for
// the base sheet (offset 0,0) only - a shifted layer's own rendered
// positions are that same loop window translated by its offset, so
// without widening the loop by this margin a large enough offset
// pushes the shifted layer's coverage past the canvas edge opposite
// the shift direction, leaving a gap there (bug found before 1.10).
// Widening both bounds by the same margin (rather than only the side
// a given layer's sign would strictly need) correctly covers every
// enabled layer at once regardless of sign, including several layers
// offset in different directions simultaneously.
function maxLayerOffset() {
    const enabled = additionalLayers.filter(l => l.enabled);
    return {
        x: enabled.length ? Math.max(...enabled.map(l => Math.abs(l.offsetX))) : 0,
        y: enabled.length ? Math.max(...enabled.map(l => Math.abs(l.offsetY))) : 0
    };
}

// Roadmap 1.2-B: shared tile-loop bounds helper, replacing each shape's
// own ad hoc "ceil(width/spacing)+fixed margin" heuristic (only valid
// for axis-aligned spacing) - maps the corners of the rectangle that
// must be covered into (i,j) lattice-index space via the inverse of the
// 2x2 basis matrix [v1 v2] (det = v1.x*v2.y - v2.x*v1.y, nonzero for any
// two non-parallel edge vectors of a simple regular polygon), then takes
// the integer floor/ceil range per axis, widened by marginTiles. This
// generalizes correctly to ANY v1/v2 (not just axis-aligned), and was
// verified (1.2-B design session) to reproduce the same on-canvas tile
// count as the prior per-shape scalar heuristics for the axis-aligned
// default case.
function latticeIJBounds(v1, v2, origin, rectCorners, marginTiles) {
    const det = v1.x * v2.y - v2.x * v1.y;
    let iMin = Infinity, iMax = -Infinity, jMin = Infinity, jMax = -Infinity;
    rectCorners.forEach(P => {
        const dx = P.x - origin.x, dy = P.y - origin.y;
        const i = (v2.y * dx - v2.x * dy) / det;
        const j = (-v1.y * dx + v1.x * dy) / det;
        if (i < iMin) iMin = i; if (i > iMax) iMax = i;
        if (j < jMin) jMin = j; if (j > jMax) jMax = j;
    });
    const bounds = {
        iMin: floor(iMin) - marginTiles, iMax: ceil(iMax) + marginTiles,
        jMin: floor(jMin) - marginTiles, jMax: ceil(jMax) + marginTiles,
    };
    return clampTileCount(bounds);
}

// Roadmap 1.2-B: safety cap on total tile count. An arbitrarily small
// polygon (from completeEdgeToRegularPolygon(), 1.2-A/future 1.2-C)
// could otherwise demand tens of thousands of tiles - a 3px edge on a
// 600x600 canvas needs roughly 44,000 (measured directly in the 1.2-B
// design session) - each incurring a full drawShapeCell()/
// drawConnectionWithSymmetry() pass, further multiplied by up to 12
// symmetry copies: genuinely pathological render time, not just "a lot
// of tiles". When the requested i/j range would exceed MAX_TILES, both
// axes are scaled down proportionally around their own center
// (preserving the aspect ratio of the needed coverage) so the total
// count is clamped rather than silently hanging the browser - the
// pattern may then under-cover the canvas, which is the safer failure
// mode; console.warn() flags it so it isn't a silent, mysterious gap.
const MAX_TILES = 4000;
function clampTileCount(bounds) {
    const iCount = bounds.iMax - bounds.iMin + 1;
    const jCount = bounds.jMax - bounds.jMin + 1;
    const total = iCount * jCount;
    if (total <= MAX_TILES) return bounds;
    const scale = Math.sqrt(MAX_TILES / total);
    const iCenter = (bounds.iMin + bounds.iMax) / 2, jCenter = (bounds.jMin + bounds.jMax) / 2;
    const iHalf = Math.max(1, Math.round((iCount * scale) / 2));
    const jHalf = Math.max(1, Math.round((jCount * scale) / 2));
    console.warn(`Tiling: requested tile count ${total} exceeds safety cap ${MAX_TILES} - clamping to fit. The pattern may not fully cover the canvas.`);
    return {
        iMin: Math.round(iCenter - iHalf), iMax: Math.round(iCenter + iHalf),
        jMin: Math.round(jCenter - jHalf), jMax: Math.round(jCenter + jHalf),
    };
}

// The rectangle every tile*() function's loop must cover: the canvas,
// widened by maxLayerOffset() on every side. offsetX/offsetY are
// absolute pixel-space vectors (layerTileCentroid() adds them
// directly, regardless of shape orientation), so widening the canvas
// RECT itself by that many pixels before the lattice-inverse mapping
// generalizes the old per-shape extraCols/extraRows heuristic to an
// arbitrary (non-axis-aligned) v1/v2 - see maxLayerOffset()'s own
// comment for why a shifted layer needs this margin at all.
function coveredRectCorners() {
    const m = maxLayerOffset();
    const x0 = -m.x, y0 = -m.y, x1 = width + m.x, y1 = height + m.y;
    return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

// --- HEX ---
// Roadmap 1.2-B: v1/v2 derived directly from the hex's own corners
// (outerCorners' established top-left-then-clockwise order, see
// forms.js's buildHexGrid()) rather than the previous scalar
// hexW/hexH + column-parity stagger ("offset coordinates") - a true
// parallelogram lattice basis, generalizing to an arbitrarily rotated
// hex from completeEdgeToRegularPolygon(). Verified (1.2-B design
// session) that this basis is numerically equal to the well-known
// flat-top-hex lattice vectors (hexW,hexH/2)/(0,hexH), and that the
// resulting on-canvas tile-position SET is identical to the old
// parity-offset scheme's own (loop order differs - the two schemes
// enumerate the same lattice differently - so tiles are compared as a
// set, not by loop index).
// Roadmap 1.12 stage 1: `override` ({outerCorners, centroid, connections})
// lets this same tile-loop implementation draw a differently-scaled
// layer's own grid (see drawTessellation()) instead of the base sheet's
// - omitted (undefined), this is byte-identical to the pre-1.12 base-
// sheet call. drawAdditionalLayers() is skipped entirely when override
// is set: a layer's own independent tile pass has no further layers of
// its own to draw.
function tileHex(cellFaces, layerCellFaces, override) {
    const ctr = override ? override.centroid : centroid;
    const connSet = override ? override.connections : connections;
    const nodeArr = override ? override.nodes : nodes;
    // Roadmap 1.12 stage 2: this layer's own independent-pass offset -
    // 0 for the base sheet (override undefined), byte-identical to
    // before this stage. Applied AFTER the i*v1+j*v2 lattice sum below
    // (to the final tile center only), NOT to `ctr` here - `ctr` also
    // feeds latticeIJBounds() as the bounds origin, which must stay
    // UNSHIFTED: coveredRectCorners()'s margin (maxLayerOffset(), which
    // already includes this layer's own offset unconditionally) already
    // pads the covered rect generously enough for the unshifted-origin
    // bounds to still fully cover the canvas once every resulting tile
    // gets this same constant shift - the same "unshifted bounds +
    // padded rect + shift applied only at render time" strategy 1.9's
    // own layerTileCentroid() already uses for same-scale layers.
    const layerOffsetX = override ? override.offsetX : 0;
    const layerOffsetY = override ? override.offsetY : 0;
    // Roadmap 1.12 stage 3: this layer's own rotation (degrees, about
    // the shared centroid `ctr`) - 0 for the base sheet, byte-identical
    // to before this stage. outerCorners rotated ONCE here via the
    // existing, unmodified rotateAround() (core/symmetry.js) - feeds the
    // v1/v2 derivation below unchanged, so the tile LATTICE itself (not
    // just its content) rotates. `ctr` itself is NOT rotated - it's the
    // shared pivot point, invariant under a rotation about itself.
    // mirrorAxisOverride derived from this SAME (possibly rotated) `oc`,
    // computed once here and reused for every drawShapeCell() call below
    // - a non-rotated layer's own outerCorners still give the exact same
    // direction as the base's (layerGrid()'s uniform positive scaling
    // from the shared centroid preserves direction), so this is correct
    // and harmless to compute unconditionally, not just when rotated.
    const rotationDeg = override ? (override.rotation || 0) : 0;
    // Roadmap 1.12 stage 4 part 2: this layer's own shape - undefined
    // for the base sheet (override undefined), byte-identical to
    // before this stage (mirrorAxisDir()/drawConnectionWithSymmetry()
    // both default an omitted shapeOverride to the global currentShape).
    const shapeOverride = override ? override.shape : undefined;
    // Roadmap 1.12 stage 5 (symmetryMode axis) part 1: this layer's own
    // symmetryMode - undefined for the base sheet (override undefined),
    // byte-identical to before this stage (drawConnectionWithSymmetry()
    // defaults an omitted symmetryModeOverride to the global symmetryMode).
    // Pure pass-through, mirroring shapeOverride directly above - not
    // used anywhere else in this function (unlike shapeOverride, which
    // also feeds mirrorAxisDir() below), since the tile LATTICE itself
    // (v1/v2/tileC) never depends on symmetryMode - only the CONTENT
    // drawShapeCell() draws at each tileC does.
    const symmetryModeOverride = override ? override.symmetryMode : undefined;
    const oc = override
        ? (rotationDeg ? override.outerCorners.map(c => rotateAround(c, override.centroid, rotationDeg)) : override.outerCorners)
        : outerCorners;
    const mirrorAxisOverride = override ? mirrorAxisDir(oc, override.centroid, shapeOverride) : undefined;
    const c0 = oc[0], c2 = oc[2], c4 = oc[4];
    const v1 = { x: c2.x - c0.x, y: c2.y - c0.y };
    const v2 = { x: c4.x - c0.x, y: c4.y - c0.y };
    const b = latticeIJBounds(v1, v2, ctr, coveredRectCorners(), 3);
    for (let i = b.iMin; i <= b.iMax; i++) {
        for (let j = b.jMin; j <= b.jMax; j++) {
            const tileC = { x: ctr.x + i * v1.x + j * v2.x + layerOffsetX, y: ctr.y + i * v1.y + j * v2.y + layerOffsetY };
            if (cellFaces) drawFaceFillsAtTile(cellFaces, tileC, false);
            drawShapeCell(connSet, tileC, false, nodeArr, rotationDeg, mirrorAxisOverride, shapeOverride, symmetryModeOverride);
            if (!override) drawAdditionalLayers(tileC, false, layerCellFaces);
        }
    }
}

// --- SQUARE ---
// Roadmap 1.2-B: v1/v2 derived directly from the square's own corners
// (outerCorners' [TL,TR,BR,BL] order, matching _subdivideSquareInterior()
// in forms.js's own c0/c1/c3 adjacency convention) rather than the
// previous single axis-aligned scalar `s` - generalizes to an
// arbitrarily rotated square from completeEdgeToRegularPolygon().
// Verified byte-identical to the prior scalar formula's own tile
// positions for the axis-aligned case (0 diff, not just near-exact).
// Roadmap 1.12 stage 1: see tileHex()'s own comment for `override`.
function tileSquare(cellFaces, layerCellFaces, override) {
    const ctr = override ? override.centroid : centroid;
    const connSet = override ? override.connections : connections;
    const nodeArr = override ? override.nodes : nodes;
    // Roadmap 1.12 stage 2: see tileHex()'s own comment for why this is
    // applied after the i*v1+j*v2 sum, not to `ctr` (the unshifted
    // latticeIJBounds() origin).
    const layerOffsetX = override ? override.offsetX : 0;
    const layerOffsetY = override ? override.offsetY : 0;
    // Roadmap 1.12 stage 3: see tileHex()'s own comment for this layer's
    // own rotation, the rotated outerCorners, and mirrorAxisOverride.
    // Roadmap 1.12 stage 4 part 2: see tileHex()'s own comment for
    // shapeOverride.
    const rotationDeg = override ? (override.rotation || 0) : 0;
    const shapeOverride = override ? override.shape : undefined;
    // Roadmap 1.12 stage 5 (symmetryMode axis) part 1: see tileHex()'s
    // own comment for symmetryModeOverride.
    const symmetryModeOverride = override ? override.symmetryMode : undefined;
    const oc = override
        ? (rotationDeg ? override.outerCorners.map(c => rotateAround(c, override.centroid, rotationDeg)) : override.outerCorners)
        : outerCorners;
    const mirrorAxisOverride = override ? mirrorAxisDir(oc, override.centroid, shapeOverride) : undefined;
    const c0 = oc[0], c1 = oc[1], c3 = oc[3];
    const v1 = { x: c1.x - c0.x, y: c1.y - c0.y };
    const v2 = { x: c3.x - c0.x, y: c3.y - c0.y };
    const b = latticeIJBounds(v1, v2, ctr, coveredRectCorners(), 3);
    for (let i = b.iMin; i <= b.iMax; i++) {
        for (let j = b.jMin; j <= b.jMax; j++) {
            const tileC = { x: ctr.x + i * v1.x + j * v2.x + layerOffsetX, y: ctr.y + i * v1.y + j * v2.y + layerOffsetY };
            if (cellFaces) drawFaceFillsAtTile(cellFaces, tileC, false);
            drawShapeCell(connSet, tileC, false, nodeArr, rotationDeg, mirrorAxisOverride, shapeOverride, symmetryModeOverride);
            if (!override) drawAdditionalLayers(tileC, false, layerCellFaces);
        }
    }
}

// --- TRIANGLE --- (triangular lattice, centroid-centered)
// Roadmap 1.12 stage 1: see tileHex()'s own comment for `override`.
function tileTriangle(cellFaces, layerCellFaces, override) {
    // Justage-Parameter für das Dreieck-Tiling:
    // Passe horizontalAdjust und verticalAdjust manuell an, um die horizontale/vertikale Abstände zwischen den Dreiecken zu feintunen.
    // Justage-Parameter für das Dreieck-Tiling (Reset auf 0 für exakte Mathematik)
    const horizontalAdjust = 0.0;
    const verticalAdjust = 0.0;

    // --- Manuelle Verschiebung des gesamten Musters ---
    // Reset auf 0, da das Gitter relativ zu "B" (zentrales Dreieck) aufgebaut wird.
    // Roadmap 1.12 stage 2: renamed from offsetX/offsetY (this function's
    // own long-standing, currently-inert manual debug knob) to
    // patternShiftX/patternShiftY specifically to avoid colliding with
    // the REAL per-layer offsetX/offsetY (additionalLayers[i].offsetX/
    // offsetY) introduced below for the independent-pass fix - these are
    // two unrelated concepts that happened to share a name.
    const patternShiftX = 0;
    const patternShiftY = 0;

    // Roadmap 1.2-B: v1/v2 derived directly from the triangle's own
    // corners (A=apex, B=left-base, C=right-base - outerCorners' own
    // convention, see forms.js's buildTriangleGrid()) rather than the
    // previous hardcoded (s,0)/(s/2,h) literals - generalizes to an
    // arbitrarily rotated/scaled triangle from
    // completeEdgeToRegularPolygon() (1.2-A), not just the canvas-
    // centered axis-aligned default. Verified to reproduce the prior
    // hardcoded formula's own tile positions to within ~1e-13 (floating-
    // point noise from sqrt(3)-derived term ordering, not a logic
    // difference) for the axis-aligned case - see the regression test.
    // horizontalAdjust/verticalAdjust (manual tuning knobs, currently
    // inert at 0.0) now scale the WHOLE derived vector rather than one
    // axis specifically, since a general v1/v2 has no privileged
    // "horizontal"/"vertical" component to scale independently - a
    // no-op at their current 0.0 values (x*(1+0) is exact), but a
    // scoping note for whoever revisits them.
    const ctr = override ? override.centroid : centroid;
    const connSet = override ? override.connections : connections;
    const nodeArr = override ? override.nodes : nodes;
    // Roadmap 1.12 stage 2: this layer's own independent-pass offset -
    // 0 for the base sheet, applied to centerUp/centerDown below (the
    // final per-tile-and-orientation center) AFTER the i*v1+j*v2 sum via
    // `anchor`, never to B (latticeIJBounds()'s own unshifted origin) -
    // same reasoning as tileHex()'s own comment.
    const layerOffsetX = override ? override.offsetX : 0;
    const layerOffsetY = override ? override.offsetY : 0;
    // Roadmap 1.12 stage 3: see tileHex()'s own comment for this layer's
    // own rotation, the rotated outerCorners, and mirrorAxisOverride.
    // Rotating A/B/C here (before v1/v2/upOffset/downOffset are derived)
    // rotates B too - the SAME B latticeIJBounds() below uses as its
    // origin, so the tile lattice's own anchor point rotates along with
    // v1/v2, consistently.
    // Roadmap 1.12 stage 4 part 2: see tileHex()'s own comment for
    // shapeOverride.
    const rotationDeg = override ? (override.rotation || 0) : 0;
    const shapeOverride = override ? override.shape : undefined;
    // Roadmap 1.12 stage 5 (symmetryMode axis) part 1: see tileHex()'s
    // own comment for symmetryModeOverride.
    const symmetryModeOverride = override ? override.symmetryMode : undefined;
    const oc = override
        ? (rotationDeg ? override.outerCorners.map(c => rotateAround(c, override.centroid, rotationDeg)) : override.outerCorners)
        : outerCorners;
    const mirrorAxisOverride = override ? mirrorAxisDir(oc, override.centroid, shapeOverride) : undefined;

    const A = oc[0], B = oc[1], C = oc[2];
    const v1 = { x: (C.x - B.x) * (1 + horizontalAdjust), y: (C.y - B.y) * (1 + horizontalAdjust) };
    const v2 = { x: (C.x - A.x) * (1 + verticalAdjust), y: (C.y - A.y) * (1 + verticalAdjust) };

    // Fixed per-tile offsets (computed once, not per iteration) from the
    // anchor corner B to this triangle's own up/down cell centers -
    // replaces the previous hardcoded (s/2,-h/3)/(s/2,+h/3). upOffset is
    // simply the triangle's own (centroid - B) vector; downOffset's
    // exact relationship to it, (2/3)v2-(1/3)v1, was solved against the
    // old hardcoded formula and verified numerically (1.2-B design
    // session) before being committed here.
    const upOffset = { x: ctr.x - B.x, y: ctr.y - B.y };
    const downOffset = {
        x: upOffset.x + (2 / 3) * v2.x - (1 / 3) * v1.x,
        y: upOffset.y + (2 / 3) * v2.y - (1 / 3) * v1.y
    };

    // Roadmap 1.2-B: bounds via the same shared latticeIJBounds() helper
    // square/hex use, replacing the previous per-axis scalar
    // approximation (which ignored v2.x's s/2 cross-term). anchor's own
    // origin is B, not centroid - latticeIJBounds() is origin-agnostic,
    // so B is passed directly as the origin here.
    const b = latticeIJBounds(v1, v2, B, coveredRectCorners(), 4);

    for (let j = b.jMin; j <= b.jMax; j++) {
        for (let i = b.iMin; i <= b.iMax; i++) {
            const anchor = {
                x: B.x + i * v1.x + j * v2.x + patternShiftX,
                y: B.y + i * v1.y + j * v2.y + patternShiftY
            };

            // Aufrechtes Dreieck
            const centerUp = { x: anchor.x + upOffset.x + layerOffsetX, y: anchor.y + upOffset.y + layerOffsetY };
            if (cellFaces) drawFaceFillsAtTile(cellFaces, centerUp, false);
            drawShapeCell(connSet, centerUp, false, nodeArr, rotationDeg, mirrorAxisOverride, shapeOverride, symmetryModeOverride);
            if (!override) drawAdditionalLayers(centerUp, false, layerCellFaces);

            // Umgedrehtes Dreieck
            const centerDown = { x: anchor.x + downOffset.x + layerOffsetX, y: anchor.y + downOffset.y + layerOffsetY };
            if (cellFaces) drawFaceFillsAtTile(cellFaces, centerDown, true);
            drawShapeCell(connSet, centerDown, true, nodeArr, rotationDeg, mirrorAxisOverride, shapeOverride, symmetryModeOverride);
            if (!override) drawAdditionalLayers(centerDown, true, layerCellFaces);
        }
    }
}
