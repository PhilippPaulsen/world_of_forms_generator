/**
 * core/tiling.js
 * Plane tessellation per net type - Ostwald's "unlimited surfaces".
 * Part of the portable "core" module set (see CLAUDE.md). This is
 * where roadmap 1.3(b)/1.9 (offset overlays, generalized to N sheets)
 * hook in: drawShapeCell() takes which connection set to draw, so each
 * tile*() function calls it once for the base sheet unconditionally,
 * then once per enabled entry in additionalLayers at that layer's own
 * shifted tile anchor. drawConnectionWithSymmetry()/drawCurvedBezier()
 * are untouched by this - every sheet shares the same symmetryMode/
 * curveType/currentShape (see the 1.3(b)/1.9 design sessions for why
 * that's shared rather than per-sheet - reconfirmed for curveType in
 * the 1.4-A design session, same reasoning: a plate-wide stylistic
 * choice, not a per-connection property). Also relevant to 1.1/1.2/1.12
 * (alternative net construction, cross-order/cross-net combination).
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
function drawTessellation() {
    // Computed once per redraw (not per tile - see computeCellFaces()'s
    // own cost) when the base sheet's face-fill toggle is on (roadmap
    // 1.10a step 5/6's rendering hookup); each tile*() function draws
    // this same face set at every tile position via drawFaceFillsAtTile().
    const cellFaces = showFaces ? computeCellFaces(connections) : null;
    const layerCellFaces = computeLayerCellFaces();
    if (currentShape === 'hex') tileHex(cellFaces, layerCellFaces);
    else if (currentShape === 'square') tileSquare(cellFaces, layerCellFaces);
    else tileTriangle(cellFaces, layerCellFaces);

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
        if (layer.shapeSizeFactor === shapeSizeFactor) return; // handled inside the base's own tile loop instead
        const grid = layerGrid(outerCorners, centroid, currentShape, shapeSizeFactor, layer.shapeSizeFactor, layer.nodeCount);
        const override = { outerCorners: grid.outerCorners, centroid: grid.centroid, connections: layer.connections };
        const thisLayerFaces = (layerCellFaces && layerCellFaces.has(i)) ? layerCellFaces.get(i) : null;
        if (currentShape === 'hex') tileHex(thisLayerFaces, null, override);
        else if (currentShape === 'square') tileSquare(thisLayerFaces, null, override);
        else tileTriangle(thisLayerFaces, null, override);
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
    const active = additionalLayers.filter(l => l.enabled && l.showFaces && l.shapeSizeFactor === shapeSizeFactor);
    if (active.length === 0) return null;
    const map = new Map();
    additionalLayers.forEach((layer, i) => {
        if (layer.enabled && layer.showFaces && layer.shapeSizeFactor === shapeSizeFactor) map.set(i, computeCellFaces(layer.connections));
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

function drawShapeCell(connSet, tileCentroid, flip180 = false) {
    for (const conn of connSet) {
        if (conn.length === 2) {
            const n1 = nodes.find(n => n.id === conn[0]);
            const n2 = nodes.find(n => n.id === conn[1]);
            if (!n1 || !n2) continue;
            const p1 = toTileLocal(n1, tileCentroid, flip180);
            const p2 = toTileLocal(n2, tileCentroid, flip180);
            // Roadmap 1.5-A: n1.id/n2.id passed through so
            // core/curves.js's buildCurvePieces() can derive a per-
            // connection seed for kind:'free' - p1/p2 are already-
            // transformed tile-local coordinates and can't be reversed
            // back into node ids (not stable across this same
            // connection's other tessellated/symmetry copies), so the
            // real ids have to be threaded through from here, the place
            // they're naturally still available.
            drawConnectionWithSymmetry(p1, p2, tileCentroid, n1.id, n2.id);
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
        if (layer.shapeSizeFactor !== shapeSizeFactor) return;
        const layerTileC = layerTileCentroid(tileCentroid, layer);
        if (layerCellFaces && layerCellFaces.has(i)) drawFaceFillsAtTile(layerCellFaces.get(i), layerTileC, flip180);
        drawShapeCell(layer.connections, layerTileC, flip180);
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
    const oc = override ? override.outerCorners : outerCorners;
    const ctr = override ? override.centroid : centroid;
    const connSet = override ? override.connections : connections;
    const c0 = oc[0], c2 = oc[2], c4 = oc[4];
    const v1 = { x: c2.x - c0.x, y: c2.y - c0.y };
    const v2 = { x: c4.x - c0.x, y: c4.y - c0.y };
    const b = latticeIJBounds(v1, v2, ctr, coveredRectCorners(), 3);
    for (let i = b.iMin; i <= b.iMax; i++) {
        for (let j = b.jMin; j <= b.jMax; j++) {
            const tileC = { x: ctr.x + i * v1.x + j * v2.x, y: ctr.y + i * v1.y + j * v2.y };
            if (cellFaces) drawFaceFillsAtTile(cellFaces, tileC, false);
            drawShapeCell(connSet, tileC, false);
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
    const oc = override ? override.outerCorners : outerCorners;
    const ctr = override ? override.centroid : centroid;
    const connSet = override ? override.connections : connections;
    const c0 = oc[0], c1 = oc[1], c3 = oc[3];
    const v1 = { x: c1.x - c0.x, y: c1.y - c0.y };
    const v2 = { x: c3.x - c0.x, y: c3.y - c0.y };
    const b = latticeIJBounds(v1, v2, ctr, coveredRectCorners(), 3);
    for (let i = b.iMin; i <= b.iMax; i++) {
        for (let j = b.jMin; j <= b.jMax; j++) {
            const tileC = { x: ctr.x + i * v1.x + j * v2.x, y: ctr.y + i * v1.y + j * v2.y };
            if (cellFaces) drawFaceFillsAtTile(cellFaces, tileC, false);
            drawShapeCell(connSet, tileC, false);
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
    const offsetX = 0;
    const offsetY = 0;

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
    const oc = override ? override.outerCorners : outerCorners;
    const ctr = override ? override.centroid : centroid;
    const connSet = override ? override.connections : connections;

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
                x: B.x + i * v1.x + j * v2.x + offsetX,
                y: B.y + i * v1.y + j * v2.y + offsetY
            };

            // Aufrechtes Dreieck
            const centerUp = { x: anchor.x + upOffset.x, y: anchor.y + upOffset.y };
            if (cellFaces) drawFaceFillsAtTile(cellFaces, centerUp, false);
            drawShapeCell(connSet, centerUp, false);
            if (!override) drawAdditionalLayers(centerUp, false, layerCellFaces);

            // Umgedrehtes Dreieck
            const centerDown = { x: anchor.x + downOffset.x, y: anchor.y + downOffset.y };
            if (cellFaces) drawFaceFillsAtTile(cellFaces, centerDown, true);
            drawShapeCell(connSet, centerDown, true);
            if (!override) drawAdditionalLayers(centerDown, true, layerCellFaces);
        }
    }
}
