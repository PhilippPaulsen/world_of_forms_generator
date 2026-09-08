/**
 * core/tiling.js
 * Plane tessellation per net type - Ostwald's "unlimited surfaces".
 * Part of the portable "core" module set (see CLAUDE.md). This is
 * where roadmap 1.3(b) (offset overlays / pattern combination) hooks
 * in: drawShapeCell() takes which connection set to draw, so each
 * tile*() function can call it twice per tile position - once for the
 * base sheet, once for the overlay sheet at a shifted tile anchor,
 * gated on overlayEnabled. drawConnectionWithSymmetry()/
 * drawCurvedBezier() are untouched by this - both sheets share the
 * same symmetryMode/curveAmount/currentShape (see the 1.3(b) design
 * session for why that's shared rather than per-sheet). Also relevant
 * to 1.1/1.2/1.12 (alternative net construction, cross-order/cross-net
 * combination).
 */

// ----------------- GRID & TILING -------------------------------
function drawTessellation() {
    if (currentShape === 'hex') tileHex();
    else if (currentShape === 'square') tileSquare();
    else tileTriangle();
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
            drawConnectionWithSymmetry(p1, p2, tileCentroid);
        }
    }
}

// Overlay sheet's tile anchor: same tileCentroid as the base sheet,
// shifted by the current overlay offset. Shared by all three tile*()
// functions below.
function overlayTileCentroid(tileCentroid) {
    return { x: tileCentroid.x + overlayOffsetX, y: tileCentroid.y + overlayOffsetY };
}

// --- HEX ---
function tileHex() {
    const side = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y);
    const hexW = side * 1.5;
    const hexH = sqrt(3) * side;
    const cols = ceil(width / hexW) + 6;
    const rows = ceil(height / hexH) + 6;
    for (let c = -3; c < cols; c++) {
        const xOff = c * hexW;
        for (let r = -3; r < rows; r++) {
            let yOff = r * hexH; if (c % 2) yOff += hexH * 0.5;
            const tileC = { x: centroid.x + xOff, y: centroid.y + yOff };
            drawShapeCell(connections, tileC, false);
            if (overlayEnabled) drawShapeCell(overlayConnections, overlayTileCentroid(tileC), false);
        }
    }
}

// --- SQUARE ---
function tileSquare() {
    const s = dist(outerCorners[0].x, outerCorners[0].y, outerCorners[1].x, outerCorners[1].y); // tile size
    const cols = ceil(width / s) + 6; const rows = ceil(height / s) + 6;
    for (let i = -4; i < cols; i++) {
        for (let j = -4; j < rows; j++) {
            const tileC = { x: centroid.x + i * s, y: centroid.y + j * s };
            drawShapeCell(connections, tileC, false);
            if (overlayEnabled) drawShapeCell(overlayConnections, overlayTileCentroid(tileC), false);
        }
    }
}

// --- TRIANGLE --- (triangular lattice, centroid-centered)
function tileTriangle() {
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

    // Schrittweiten mit manueller Justage
    const v1 = { x: s * (1 + horizontalAdjust), y: 0 }; // horizontale Schrittweite (angepasst)
    const v2 = { x: s / 2, y: h * (1 + verticalAdjust) }; // vertikale Schrittweite (angepasst)

    // Ursprung für das Gitter
    const B = outerCorners[1];
    const cols = ceil(width / (s * (1 + horizontalAdjust))) + 8;
    const rows = ceil(height / (h * (1 + verticalAdjust))) + 8;

    for (let j = -4; j < rows; j++) {
        for (let i = -4; i < cols; i++) {
            const anchor = {
                x: B.x + i * v1.x + j * v2.x + offsetX,
                y: B.y + i * v1.y + j * v2.y + offsetY
            };

            // Aufrechtes Dreieck
            const centerUp = { x: anchor.x + s / 2, y: anchor.y - h / 3 };
            drawShapeCell(connections, centerUp, false);
            if (overlayEnabled) drawShapeCell(overlayConnections, overlayTileCentroid(centerUp), false);

            // Umgedrehtes Dreieck
            const centerDown = { x: anchor.x + s / 2, y: anchor.y + h / 3 };
            drawShapeCell(connections, centerDown, true);
            if (overlayEnabled) drawShapeCell(overlayConnections, overlayTileCentroid(centerDown), true);
        }
    }
}
