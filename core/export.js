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

// Angle-sorted adjacency list for one connection set, shared by the
// base sheet and every additional layer below - same algorithm
// either way, just fed a different connSet/edges list.
function computeAdjacency(completeConnections, nodeById) {
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

    return adjacency;
}

// Builds the exportable state as plain data: the un-tessellated,
// un-symmetry-expanded base cell (nodes/connections are never mutated
// by drawConnectionWithSymmetry - that only computes transient copies
// at render time), plus an angle-sorted adjacency list per node so a
// later face-detection pass (see README "Flächenfärbung") can walk the
// minimal enclosed cycles without needing any structural change here.
//
// Roadmap 1.9 (generalizing 1.3(b)'s single geometry.overlay object):
// geometry.layers is additive and only present when at least one
// additional layer is enabled - geometry.nodes/edges/adjacency (the
// base sheet) are unchanged either way, so formatVersion stays 1 and
// existing consumers (e.g. SpaceHarmony's 2D import) that only look
// for formatVersion===1 + geometry.nodes/edges keep working
// unmodified. Renaming/reshaping the singular geometry.overlay object
// from 1.3(b) into a plural geometry.layers array is safe here and
// now, before anything external depends on it - grepped the whole
// project tree in the 1.9 design session and found no reference to
// geometry.overlay outside this file's own previous version. Each
// layer's adjacency is computed independently over its own edges, not
// merged across layers or with the base sheet's - a true cross-sheet
// merge needs the offset-shifted intersection geometry 1.10's line-
// intersection detection is scoped to compute, not this step; this
// just exports enough raw data (every enabled layer's own edges plus
// its offset) for that later pass to use.
function buildExportData() {
    // Mirror the same completeness filter drawShapeCell() already applies -
    // a connection started by one click and never finished stays [id] (length 1).
    const completeConnections = connections.filter(c => c.length === 2);
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const adjacency = computeAdjacency(completeConnections, nodeById);

    const data = {
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

    const enabledLayers = additionalLayers.filter(layer => layer.enabled);
    if (enabledLayers.length > 0) {
        data.geometry.layers = enabledLayers.map(layer => {
            const completeLayerConnections = layer.connections.filter(c => c.length === 2);
            return {
                offsetX: layer.offsetX,
                offsetY: layer.offsetY,
                edges: completeLayerConnections.map(c => [c[0], c[1]]),
                adjacency: computeAdjacency(completeLayerConnections, nodeById)
            };
        });
    }

    return data;
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
