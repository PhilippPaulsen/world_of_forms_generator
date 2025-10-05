/**
 * forms.js
 * 
 * Contains the shape-specific grid generation logic.
 * Each function is responsible for defining the node system for a specific shape.
 */

function buildTriangleGrid(nodeCount, shapeSizeFactor, canvasW, canvasH) {
    let nodes = [];
    let id = 1;

    let base = (canvasW / shapeSizeFactor) * 0.8;
    let h = (base * sqrt(3)) / 2;

    let shapeCenterX = canvasW / 2;
    let shapeCenterY = canvasH / 2;

    const A = { x: shapeCenterX, y: shapeCenterY - h / 2 };
    const B = { x: shapeCenterX - base / 2, y: shapeCenterY + h / 2 };
    const C = { x: shapeCenterX + base / 2, y: shapeCenterY + h / 2 };

    for (let i = 0; i < nodeCount; i++) {
        let t = (nodeCount <= 1) ? 0.5 : i / (nodeCount - 1);
        for (let j = 0; j <= i; j++) {
            let s = (i === 0) ? 0.5 : j / i;
            let p_x = lerp(B.x, C.x, s);
            let p_y = lerp(B.y, C.y, s);
            let final_x = lerp(A.x, p_x, t);
            let final_y = lerp(A.y, p_y, t);
            nodes.push({ id: id++, x: final_x, y: final_y });
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
    const step = (nodeCount > 1) ? squareSize / (nodeCount - 1) : 0;

    const startX = canvasW / 2 - squareSize / 2;
    const startY = canvasH / 2 - squareSize / 2;

    for (let i = 0; i < nodeCount; i++) {
        for (let j = 0; j < nodeCount; j++) {
            nodes.push({
                x: startX + j * step,
                y: startY + i * step,
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
    let idCounter = 1;
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

    // Add center node
    if (nodeCount > 0) {
        nodes.push({ id: idCounter++, x: centroid.x, y: centroid.y });
    }

    // Add concentric rings
    for (let i = 1; i < nodeCount; i++) {
        const scale = i / (nodeCount - 1);
        let ringCorners = outerCorners.map(c => ({
            x: lerp(centroid.x, c.x, scale),
            y: lerp(centroid.y, c.y, scale)
        }));

        // Add nodes on the edges of the ring
        for (let j = 0; j < 6; j++) {
            const p1 = ringCorners[j];
            const p2 = ringCorners[(j + 1) % 6];
            // The number of segments on each edge of the inner rings can be `i`
            for (let k = 0; k < i; k++) {
                const t = k / i;
                nodes.push({
                    id: idCounter++,
                    x: lerp(p1.x, p2.x, t),
                    y: lerp(p1.y, p2.y, t)
                });
            }
        }
    }
    // Add the outermost ring corners
    if (nodeCount > 1) {
        outerCorners.forEach(c => {
            nodes.push({ id: idCounter++, x: c.x, y: c.y });
        });
    }

    // A simple way to ensure all expected nodes are there for higher counts
    if (nodeCount > 1) {
        let finalNodes = [{ id: 1, x: centroid.x, y: centroid.y }];
        let finalId = 2;
        for (let i = 1; i < nodeCount; i++) {
            const scale = i / (nodeCount-1);
            let ringCorners = outerCorners.map(c => ({ x: lerp(centroid.x, c.x, scale), y: lerp(centroid.y, c.y, scale) }));
            for(let j=0; j<6; j++) {
                const p1 = ringCorners[j];
                const p2 = ringCorners[(j+1)%6];
                for(let k=0; k<i; k++) {
                    const t = k/i;
                    finalNodes.push({id: finalId++, x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t)});
                }
            }
        }
        nodes = finalNodes;
    }

    return { nodes, centroid, outerCorners };
}
