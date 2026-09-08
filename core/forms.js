/**
 * core/forms.js
 * Grid generators for World of Forms Generator. Part of the portable
 * "core" module set (see CLAUDE.md) - no p5 dependency (uses Math.sqrt(),
 * not p5's global sqrt()), safe to copy verbatim into other sites
 * embedding this engine.
 * Each function returns: { nodes, centroid, outerCorners }
 * Coordinates are absolute canvas coordinates (0..canvasW / 0..canvasH),
 * matching state.js's rebuildGrid() calls.
 *
 * Ported from die-welt-der-formen/p5_prototype/sketch.js's inlined
 * "GRID BUILDERS" section, which fixed several issues present in the
 * previous version of this file:
 * - buildTriangleGrid() used to call subdivideEdge()/addUniqueNode(),
 *   neither of which was defined anywhere in this repo (ReferenceError
 *   at runtime for the default 'triangle' shape). This version computes
 *   the triangular lattice directly via barycentric interpolation,
 *   producing real interior nodes (not just edge subdivisions).
 * - buildSquareGrid()/buildHexGrid() used to scale outerCorners by
 *   shapeSizeFactor a second time (via scalePoints) after already
 *   dividing by shapeSizeFactor, making nodes and outerCorners
 *   geometrically inconsistent except at shapeSizeFactor === 1.
 * - buildHexGrid() used to place nodes only along straight spokes from
 *   the center to each of the 6 corners. This version builds proper
 *   concentric hexagonal rings with edge-bridging nodes.
 * - All three functions now take (nodeCount, shapeSizeFactor, canvasW,
 *   canvasH) explicitly instead of relying on p5's global width/height,
 *   matching how sketch.js already called them.
 */

function buildTriangleGrid(nodeCount, shapeSizeFactor, canvasW, canvasH) {
    const nodes = []; let id = 1;
    const base = canvasW / shapeSizeFactor; const h = (Math.sqrt(3) / 2) * base;
    const cx = canvasW / 2, cy = canvasH / 2;
    const A = { x: cx, y: cy - h / 2 }, B = { x: cx - base / 2, y: cy + h / 2 }, C = { x: cx + base / 2, y: cy + h / 2 };

    if (nodeCount <= 1) {
        [A, B, C].forEach(p => nodes.push({ id: id++, x: p.x, y: p.y }));
    } else {
        for (let i = 0; i < nodeCount; i++) {
            const t = (nodeCount <= 1) ? 0 : i / (nodeCount - 1);
            for (let j = 0; j <= i; j++) {
                const s = (i === 0) ? 0 : j / i;
                const x = (1 - t) * A.x + t * ((1 - s) * B.x + s * C.x);
                const y = (1 - t) * A.y + t * ((1 - s) * B.y + s * C.y);
                nodes.push({ id: id++, x, y });
            }
        }
    }
    const centroid = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
    return { nodes, centroid, outerCorners: [A, B, C] };
}

function buildSquareGrid(nodeCount, shapeSizeFactor, canvasW, canvasH) {
    const nodes = []; let id = 1; const size = canvasW / shapeSizeFactor; const startX = canvasW / 2 - size / 2; const startY = canvasH / 2 - size / 2;
    const corners = [
        { x: startX, y: startY },
        { x: startX + size, y: startY },
        { x: startX + size, y: startY + size },
        { x: startX, y: startY + size },
    ];
    if (nodeCount <= 1) {
        corners.forEach(p => nodes.push({ id: id++, x: p.x, y: p.y }));
    } else {
        const step = size / (nodeCount - 1);
        for (let i = 0; i < nodeCount; i++) {
            for (let j = 0; j < nodeCount; j++) {
                nodes.push({ id: id++, x: startX + i * step, y: startY + j * step });
            }
        }
    }
    const centroid = { x: canvasW / 2, y: canvasH / 2 };
    return { nodes, centroid, outerCorners: corners };
}

function buildHexGrid(nodeCount, shapeSizeFactor, canvasW, canvasH) {
    const nodes = []; const outerCorners = [];
    const shapeHeight = canvasH / shapeSizeFactor; const side = shapeHeight / Math.sqrt(3);
    const cx = canvasW / 2; const topY = (canvasH / 2) - shapeHeight / 2;
    outerCorners.push({ x: cx - side / 2, y: topY });
    outerCorners.push({ x: cx + side / 2, y: topY });
    outerCorners.push({ x: cx + side, y: topY + (Math.sqrt(3) / 2) * side });
    outerCorners.push({ x: cx + side / 2, y: topY + Math.sqrt(3) * side });
    outerCorners.push({ x: cx - side / 2, y: topY + Math.sqrt(3) * side });
    outerCorners.push({ x: cx - side, y: topY + (Math.sqrt(3) / 2) * side });
    let sumX = 0, sumY = 0; outerCorners.forEach(c => { sumX += c.x; sumY += c.y; });
    const centroid = { x: sumX / 6, y: sumY / 6 };

    if (nodeCount <= 1) {
        // 6 outer corners + center node (as requested)
        outerCorners.forEach((p, idx) => nodes.push({ id: idx + 1, x: p.x, y: p.y }));
        nodes.push({ id: nodes.length + 1, x: centroid.x, y: centroid.y });
        return { nodes, centroid, outerCorners };
    }

    function getScaledCorners(scale) {
        return outerCorners.map(p => ({ x: centroid.x + (p.x - centroid.x) * scale, y: centroid.y + (p.y - centroid.y) * scale }));
    }
    function addRingRecursive(r, scale) {
        const ringC = getScaledCorners(scale);
        ringC.forEach(p => nodes.push({ id: nodes.length + 1, x: p.x, y: p.y }));
        const bridge = r - 1;
        for (let c = 0; c < 6; c++) {
            const c1 = ringC[c], c2 = ringC[(c + 1) % 6];
            for (let seg = 1; seg <= bridge; seg++) {
                const t = seg / (bridge + 1);
                nodes.push({ id: nodes.length + 1, x: c1.x + t * (c2.x - c1.x), y: c1.y + t * (c2.y - c1.y) });
            }
        }
        if (r > 1) addRingRecursive(r - 1, scale * (r - 1) / r);
    }
    addRingRecursive(nodeCount, 1.0);
    // Always include the central node as well (not only for nodeCount == 1)
    nodes.push({ id: nodes.length + 1, x: centroid.x, y: centroid.y });
    return { nodes, centroid, outerCorners };
}
