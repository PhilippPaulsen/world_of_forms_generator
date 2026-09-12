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
}

// Same "compute once per redraw" reasoning as drawTessellation()'s own
// cellFaces, generalized to additional layers: only layers that are
// both enabled and have their own showFaces on get computed at all: a
// disabled layer already draws nothing, and most layers won't have
// face-fill on. Returns null when no layer needs it, so drawAdditionalLayers()
// can skip the per-tile Map lookup entirely in the common case.
function computeLayerCellFaces() {
    const active = additionalLayers.filter(l => l.enabled && l.showFaces);
    if (active.length === 0) return null;
    const map = new Map();
    additionalLayers.forEach((layer, i) => {
        if (layer.enabled && layer.showFaces) map.set(i, computeCellFaces(layer.connections));
    });
    return map;
}

// One mesh-width per axis for the current shape, matching each
// tile*() function's own spacing math below (kept in sync manually,
// same pattern as buildExportData()'s "mirror the completeness filter"
// comment in core/export.js). Used by the "1 mesh-width" overlay-
// offset presets - see sketch.js setup().
function getMeshWidth() {
    if (currentShape === 'square') {
        const s = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y);
        return { x: s, y: s };
    } else if (currentShape === 'hex') {
        const side = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y);
        return { x: side * 1.5, y: sqrt(3) * side };
    } else { // triangle
        const s = dist(outerCorners[1].x, outerCorners[1].y, outerCorners[2].x, outerCorners[2].y);
        const h = (sqrt(3) / 2) * s;
        return { x: s, y: h };
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

// --- HEX ---
function tileHex(cellFaces, layerCellFaces) {
    const side = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y);
    const hexW = side * 1.5;
    const hexH = sqrt(3) * side;
    const maxOffset = maxLayerOffset();
    const extraCols = ceil(maxOffset.x / hexW);
    const extraRows = ceil(maxOffset.y / hexH);
    const cols = ceil(width / hexW) + 6 + extraCols;
    const rows = ceil(height / hexH) + 6 + extraRows;
    for (let c = -3 - extraCols; c < cols; c++) {
        const xOff = c * hexW;
        for (let r = -3 - extraRows; r < rows; r++) {
            let yOff = r * hexH; if (c % 2) yOff += hexH * 0.5;
            const tileC = { x: centroid.x + xOff, y: centroid.y + yOff };
            if (cellFaces) drawFaceFillsAtTile(cellFaces, tileC, false);
            drawShapeCell(connections, tileC, false);
            drawAdditionalLayers(tileC, false, layerCellFaces);
        }
    }
}

// --- SQUARE ---
function tileSquare(cellFaces, layerCellFaces) {
    const s = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y); // tile size
    const maxOffset = maxLayerOffset();
    const extraCols = ceil(maxOffset.x / s);
    const extraRows = ceil(maxOffset.y / s);
    const cols = ceil(width / s) + 6 + extraCols; const rows = ceil(height / s) + 6 + extraRows;
    for (let i = -4 - extraCols; i < cols; i++) {
        for (let j = -4 - extraRows; j < rows; j++) {
            const tileC = { x: centroid.x + i * s, y: centroid.y + j * s };
            if (cellFaces) drawFaceFillsAtTile(cellFaces, tileC, false);
            drawShapeCell(connections, tileC, false);
            drawAdditionalLayers(tileC, false, layerCellFaces);
        }
    }
}

// --- TRIANGLE --- (triangular lattice, centroid-centered)
function tileTriangle(cellFaces, layerCellFaces) {
    // Justage-Parameter für das Dreieck-Tiling:
    // Passe horizontalAdjust und verticalAdjust manuell an, um die horizontale/vertikale Abstände zwischen den Dreiecken zu feintunen.
    // Justage-Parameter für das Dreieck-Tiling (Reset auf 0 für exakte Mathematik)
    const horizontalAdjust = 0.0;
    const verticalAdjust = 0.0;

    const s = dist(outerCorners[1].x, outerCorners[1].y, outerCorners[2].x, outerCorners[2].y);
    const h = (sqrt(3) / 2) * s;

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
    const A = outerCorners[0], B = outerCorners[1], C = outerCorners[2];
    const v1 = { x: (C.x - B.x) * (1 + horizontalAdjust), y: (C.y - B.y) * (1 + horizontalAdjust) };
    const v2 = { x: (C.x - A.x) * (1 + verticalAdjust), y: (C.y - A.y) * (1 + verticalAdjust) };

    // Fixed per-tile offsets (computed once, not per iteration) from the
    // anchor corner B to this triangle's own up/down cell centers -
    // replaces the previous hardcoded (s/2,-h/3)/(s/2,+h/3). upOffset is
    // simply the triangle's own (centroid - B) vector; downOffset's
    // exact relationship to it, (2/3)v2-(1/3)v1, was solved against the
    // old hardcoded formula and verified numerically (1.2-B design
    // session) before being committed here.
    const upOffset = { x: centroid.x - B.x, y: centroid.y - B.y };
    const downOffset = {
        x: upOffset.x + (2 / 3) * v2.x - (1 / 3) * v1.x,
        y: upOffset.y + (2 / 3) * v2.y - (1 / 3) * v1.y
    };

    // Loop-margin for shifted additional layers (see maxLayerOffset()) -
    // approximated the same way the base loop already sizes cols/rows:
    // i's step is treated as s (X), j's as h (Y), ignoring v2.x's s/2
    // cross-term, matching the existing approximation rather than
    // introducing new, inconsistent precision.
    const maxOffset = maxLayerOffset();
    const extraCols = ceil(maxOffset.x / (s * (1 + horizontalAdjust)));
    const extraRows = ceil(maxOffset.y / (h * (1 + verticalAdjust)));
    const cols = ceil(width / (s * (1 + horizontalAdjust))) + 8 + extraCols;
    const rows = ceil(height / (h * (1 + verticalAdjust))) + 8 + extraRows;

    for (let j = -4 - extraRows; j < rows; j++) {
        for (let i = -4 - extraCols; i < cols; i++) {
            const anchor = {
                x: B.x + i * v1.x + j * v2.x + offsetX,
                y: B.y + i * v1.y + j * v2.y + offsetY
            };

            // Aufrechtes Dreieck
            const centerUp = { x: anchor.x + upOffset.x, y: anchor.y + upOffset.y };
            if (cellFaces) drawFaceFillsAtTile(cellFaces, centerUp, false);
            drawShapeCell(connections, centerUp, false);
            drawAdditionalLayers(centerUp, false, layerCellFaces);

            // Umgedrehtes Dreieck
            const centerDown = { x: anchor.x + downOffset.x, y: anchor.y + downOffset.y };
            if (cellFaces) drawFaceFillsAtTile(cellFaces, centerDown, true);
            drawShapeCell(connections, centerDown, true);
            drawAdditionalLayers(centerDown, true, layerCellFaces);
        }
    }
}
