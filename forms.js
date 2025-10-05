/**
 * forms.js
 * Modular shape generators for World of Forms Generator
 * Each function returns: { nodes, outerCorners }
 * All coordinates are centered around (0, 0)
 */

// === UNIVERSAL HELPERS ====================================

function scalePoints(points, factor) {
  return points.map(p => ({ x: p.x * factor, y: p.y * factor }));
}

function centerPoints(points) {
  const cx = points.reduce((a, p) => a + p.x, 0) / points.length;
  const cy = points.reduce((a, p) => a + p.y, 0) / points.length;
  return points.map(p => ({ x: p.x - cx, y: p.y - cy }));
}

// === TRIANGLE ==============================================

function buildTriangleGrid(nodeCount, shapeSizeFactor) {
    let nodes = [];
    let idCounter = { value: 1 };
    const centerX = width / 2;
    const centerY = height / 2;

    const baseSize = 150 * shapeSizeFactor;
    const heightTri = (Math.sqrt(3) / 2) * baseSize;

    // Definiere gleichseitiges Dreieck zentriert auf Canvas
    const corners = [
        { x: 0, y: -heightTri / 2 },              // oben
        { x: -baseSize / 2, y: heightTri / 2 },   // unten links
        { x: baseSize / 2, y: heightTri / 2 }     // unten rechts
    ];

    // Unterteile jede Kante gleichmäßig
    if (nodeCount > 0) {
        for (let i = 0; i < corners.length; i++) {
            const next = corners[(i + 1) % corners.length];
            subdivideEdge(corners[i], next, nodeCount, nodes, idCounter);
        }
    }
    addUniqueNode(nodes, corners[0], idCounter);

    // Zentriere alle Punkte
    nodes = nodes.map(p => ({
        x: p.x + centerX,
        y: p.y + centerY,
        id: p.id
    }));

    const shiftedCorners = corners.map(p => ({
        x: p.x + centerX,
        y: p.y + centerY
    }));

    // Rückgabe für das zentrale Dreieck
    return {
        nodes,
        centroid: { x: centerX, y: centerY },
        outerCorners: shiftedCorners,
        baseSize,
        heightTri
    };
}

// === SQUARE ================================================

function buildSquareGrid(nodeCount, shapeSizeFactor) {
  const size = 100 / shapeSizeFactor;

  let outerCorners = [
    { x: -size / 2, y: -size / 2 },
    { x: size / 2, y: -size / 2 },
    { x: size / 2, y: size / 2 },
    { x: -size / 2, y: size / 2 }
  ];

  outerCorners = scalePoints(outerCorners, shapeSizeFactor);

  // generate evenly spaced nodes
  let nodes = [];
  let id = 1;
  for (let i = 0; i < nodeCount; i++) {
    for (let j = 0; j < nodeCount; j++) {
      const x = -size / 2 + (i / (nodeCount - 1)) * size;
      const y = -size / 2 + (j / (nodeCount - 1)) * size;
      nodes.push({ x, y, id: id++ });
    }
  }

  return { nodes, outerCorners };
}

// === HEXAGON ===============================================

function buildHexGrid(nodeCount, shapeSizeFactor) {
  const side = 50 / shapeSizeFactor;
  const h = Math.sqrt(3) * side / 2;

  let outerCorners = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i - Math.PI / 6;
    outerCorners.push({ x: Math.cos(angle) * side, y: Math.sin(angle) * side });
  }

  outerCorners = scalePoints(outerCorners, shapeSizeFactor);

  // generate radial nodes toward center
  const centroid = { x: 0, y: 0 };
  let nodes = [];
  let id = 1;
  for (let r = 1; r <= nodeCount; r++) {
    const scale = r / nodeCount;
    for (let i = 0; i < 6; i++) {
      const a = outerCorners[i];
      const x = centroid.x + (a.x - centroid.x) * scale;
      const y = centroid.y + (a.y - centroid.y) * scale;
      nodes.push({ x, y, id: id++ });
    }
  }
  nodes.push({ x: 0, y: 0, id: id++ });

  return { nodes, outerCorners };
}