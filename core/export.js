/**
 * core/export.js
 * Export/serialization: PNG, JSON (buildExportData - the documented
 * prerequisite for roadmap 1.10's face-detection pass), and SVG. Part
 * of the portable "core" module set (see CLAUDE.md).
 */

// ----------------- EXPORT ----------------------------------------
function exportPNG() {
    saveCanvas('world_of_forms', 'png');
}

function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Builds the exportable state as plain data: the un-tessellated,
// un-symmetry-expanded base cell (nodes/connections are never mutated
// by drawConnectionWithSymmetry - that only computes transient copies
// at render time), plus an angle-sorted adjacency list per node so a
// later face-detection pass (see README "Flächenfärbung") can walk the
// minimal enclosed cycles without needing any structural change here.
function buildExportData() {
    // Mirror the same completeness filter drawShapeCell() already applies -
    // a connection started by one click and never finished stays [id] (length 1).
    const completeConnections = connections.filter(c => c.length === 2);
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    const adjacency = {};
    nodes.forEach(n => { adjacency[n.id] = []; });

    completeConnections.forEach((conn, edgeIndex) => {
        const [aId, bId] = conn;
        const a = nodeById.get(aId), b = nodeById.get(bId);
        if (!a || !b) return;
        const angleAB = (degrees(atan2(b.y - a.y, b.x - a.x)) + 360) % 360;
        const angleBA = (degrees(atan2(a.y - b.y, a.x - b.x)) + 360) % 360;
        adjacency[aId].push({ neighborId: bId, edgeIndex, angleDeg: angleAB });
        adjacency[bId].push({ neighborId: aId, edgeIndex, angleDeg: angleBA });
    });

    Object.keys(adjacency).forEach(id => {
        adjacency[id].sort((x, y) => x.angleDeg - y.angleDeg);
    });

    return {
        formatVersion: 1,
        generator: "World of Forms Generator",
        exportedAt: new Date().toISOString(),
        meta: {
            shapeType: currentShape,
            shapeSizeFactor,
            nodeCount,
            symmetryMode,
            curveAmount,
            lineColor
        },
        geometry: {
            centroid: { x: centroid.x, y: centroid.y },
            outerCorners: outerCorners.map(c => ({ x: c.x, y: c.y })),
            nodes: nodes.map(n => ({ id: n.id, x: n.x, y: n.y })),
            edges: completeConnections.map(c => [c[0], c[1]]),
            adjacency
        }
    };
}

function exportJSON() {
    const data = buildExportData();
    downloadBlob(JSON.stringify(data, null, 2), 'world_of_forms.json', 'application/json');
}

// Renders the full visible tessellation (same scope as the PNG export -
// see plan discussion) by reusing drawTessellation() unchanged in SVG
// collection mode, so the vector output can never drift from what's
// actually on screen.
function generateSVGString() {
    svgPathCollector = [];
    drawTessellation();
    const paths = svgPathCollector;
    svgPathCollector = null;

    const w = width, h = height;
    const bgColor = getComputedStyle(document.body).getPropertyValue('--panel-bg-color') || '#ffffff';

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
    svg += `  <rect x="0" y="0" width="${w}" height="${h}" fill="${bgColor.trim() || '#ffffff'}" />\n`;
    svg += `  <g stroke="${lineColor}" stroke-width="2" fill="none">\n`;
    paths.forEach(d => { svg += `    <path d="${d}" />\n`; });
    svg += `  </g>\n`;
    if (showNodes) {
        svg += `  <g fill="#000000">\n`;
        nodes.forEach(nd => { svg += `    <circle cx="${nd.x.toFixed(2)}" cy="${nd.y.toFixed(2)}" r="3" />\n`; });
        svg += `  </g>\n`;
    }
    // Canvas frame, matching draw()'s rect(0,0,width,height) at strokeWeight(4).
    svg += `  <rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="${lineColor}" stroke-width="4" />\n`;
    svg += `</svg>\n`;
    return svg;
}

function exportSVG() {
    downloadBlob(generateSVGString(), 'world_of_forms.svg', 'image/svg+xml');
}
