/**
 * forms.js
 * 
 * Contains the shape-specific grid generation logic.
 * Each function is responsible for defining the node system for a specific shape.
 */

function buildTriangleGrid(nodeCount, shapeSizeFactor, canvasW, canvasH) {
    let nodes = [];
    let id = 1;

    let base = shapeSizeFactor * 30;
    let h = (base * sqrt(3)) / 2;

    let shapeCenterX = canvasW / 2;
    let shapeCenterY = canvasH / 2;

    const A = { x: shapeCenterX, y: shapeCenterY - h / 2 };
    const B = { x: shapeCenterX - base / 2, y: shapeCenterY + h / 2 };
    const C = { x: shapeCenterX + base / 2, y: shapeCenterY + h / 2 };

    for (let i = 0; i < nodeCount; i++) {
        let t = (nodeCount <= 1) ? 0 : i / (nodeCount - 1);
        for (let j = 0; j <= i; j++) {
            let s = (i === 0) ? 0 : j / i;
            let x = (1 - t) * A.x + t * ((1 - s) * B.x + s * C.x);
            let y = (1 - t) * A.y + t * ((1 - s) * B.y + s * C.y);
            nodes.push({ id: id++, x, y });
        }
    }

    const centroid = {
        x: (A.x + B.x + C.x) / 3,
        y: (A.y + B.y + C.y) / 3,
    };

    return { nodes, centroid, outerCorners: [A, B, C] };
}

function buildSquareGrid(nodeCount, shapeSizeFactor, canvasW, canvasH) {
    let nodes = [];
    let idCounter = 1;
    const squareSize = canvasW / shapeSizeFactor;
    const step = squareSize / (nodeCount - 1);

    const startX = canvasW / 2 - squareSize / 2;
    const startY = canvasH / 2 - squareSize / 2;

    for (let i = 0; i < nodeCount; i++) {
        for (let j = 0; j < nodeCount; j++) {
            nodes.push({
                x: startX + i * step,
                y: startY + j * step,
                id: idCounter++,
            });
        }
    }

    const centroid = { x: canvasW / 2, y: canvasH / 2 };
    const outerCorners = [
        { x: startX, y: startY },
        { x: startX + squareSize, y: startY },
        { x: startX + squareSize, y: startY + squareSize },
        { x: startX, y: startY + squareSize },
    ];

    return { nodes, centroid, outerCorners };
}

function buildHexGrid(nodeCount, shapeSizeFactor, canvasW, canvasH) {
    let nodes = [];
    let outerCorners = [];
    
    const shapeHeight = canvasH / shapeSizeFactor;
    const side = shapeHeight / sqrt(3);
    const cx = canvasW / 2;
    const topY = (canvasH / 2) - shapeHeight / 2;

    outerCorners.push({ x: cx - side / 2, y: topY });
    outerCorners.push({ x: cx + side / 2, y: topY });
    outerCorners.push({ x: cx + side, y: topY + (sqrt(3) / 2) * side });
    outerCorners.push({ x: cx + side / 2, y: topY + sqrt(3) * side });
    outerCorners.push({ x: cx - side / 2, y: topY + sqrt(3) * side });
    outerCorners.push({ x: cx - side, y: topY + (sqrt(3) / 2) * side });

    let sumX = 0, sumY = 0;
    for (let c of outerCorners) { sumX += c.x; sumY += c.y; }
    const centroid = { x: sumX / 6, y: sumY / 6 };

    function getScaledCorners(scale) {
        let arr = [];
        for (let i = 0; i < 6; i++) {
            let ox = outerCorners[i].x;
            let oy = outerCorners[i].y;
            let x = centroid.x + (ox - centroid.x) * scale;
            let y = centroid.y + (oy - centroid.y) * scale;
            arr.push({ x, y });
        }
        return arr;
    }

    function addRingRecursive(r, scale) {
        let ringCorners = getScaledCorners(scale);

        for (let i = 0; i < 6; i++) {
            nodes.push({ x: ringCorners[i].x, y: ringCorners[i].y, id: nodes.length + 1 });
        }

        let bridgingCount = r - 1;
        for (let c = 0; c < 6; c++) {
            let c1 = ringCorners[c];
            let c2 = ringCorners[(c + 1) % 6];
            for (let seg = 1; seg <= bridgingCount; seg++) {
                let t = seg / (bridgingCount + 1);
                let mx = c1.x + t * (c2.x - c1.x);
                let my = c1.y + t * (c2.y - c1.y);
                nodes.push({ x: mx, y: my, id: nodes.length + 1 });
            }
        }

        if (r === 1) {
            nodes.push({ x: centroid.x, y: centroid.y, id: nodes.length + 1 });
        }

        if (r > 1) {
            let subScale = scale * (r - 1) / r;
            addRingRecursive(r - 1, subScale);
        }
    }

    addRingRecursive(nodeCount, 1.0);

    return { nodes, centroid, outerCorners };
}
