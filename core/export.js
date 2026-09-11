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
//
// Roadmap 1.10a: geometry.faces / geometry.layers[].faces (per-sheet
// symmetry-orbit-colored bounded faces, from core/faces.js's
// findFaces()) are additive the same way, gated only on curveAmount===0
// (v1 is straight-line-only - see core/faces.js's computeCellFaces())
// rather than on the showFaces display toggle, since export should
// capture the pattern's actual structure independent of what's
// currently visible on screen. geometry.faceNodes / geometry.layers[].
// faceNodes (each face's own real+synthetic node set, with x/y) ride
// alongside so a consumer can resolve every id a face's nodeIds
// references - face detection can introduce synthetic intersection
// nodes (see splitSegments()) that aren't in geometry.nodes at all.
// Re-checked at implementation time (not assumed from the design
// session): grepped SpaceHarmony's whole tree - its only 2D-import
// consumers are importFlatForm() (FormGeneratorCore.js, reads only
// geometry.centroid/outerCorners/nodes/edges, explicitly does NOT
// process geometry.adjacency and computes form.faces itself via its
// own 3D _validateForm(), entirely independent of anything this export
// provides) and _isFlat2DExport() (App.js, checks only formatVersion===1
// + Array.isArray(geometry.nodes)) - neither touches geometry.faces or
// geometry.layers, so this addition is safe and formatVersion stays 1.
// Roadmap 1.10b-ii-c: crossLayerData - {latticeBasis, nodes, faces}
// (computeCrossLayerFaces()'s own result shape, minus its top-level
// `faces` field's implicit sheet attribution already living on each
// face) or null/undefined - is passed in as a PARAMETER rather than
// read from a global, unlike every other piece of state this function
// reads (connections, additionalLayers, nodes, ...). Reason: the
// cross-layer compute result (crossLayerResult) is sketch.js-owned
// state (added in 1.10b-ii-b, a UI-flow concern - the synchronous
// Compute button's own result cache), and CLAUDE.md's module map is
// explicit that core/* must never depend on sketch.js (dependencies
// point one way). The caller (sketch.js's export-JSON button handler)
// is what already knows whether a valid, non-stale result exists -
// see exportJSON() below, which just forwards whatever it's given.
function buildExportData(crossLayerData) {
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
            const layerData = {
                offsetX: layer.offsetX,
                offsetY: layer.offsetY,
                edges: completeLayerConnections.map(c => [c[0], c[1]]),
                adjacency: computeAdjacency(completeLayerConnections, nodeById)
            };
            if (curveAmount === 0) {
                const layerFacesResult = computeCellFaces(completeLayerConnections);
                layerData.faceNodes = layerFacesResult.nodes;
                layerData.faces = layerFacesResult.faces;
            }
            // Roadmap 1.11-B: patternName/themeLineOrbits - additive the
            // same way faceNodes/faces above are, but NOT gated on
            // curveAmount===0: unlike face detection, theme-line orbit
            // reduction only depends on which NODES a connection joins
            // (core/orbits.js's computeThemeLineOrbits()), not on how the
            // line between them is drawn - a curved connection between
            // the same two nodes belongs to the exact same orbit as a
            // straight one. Omitted entirely (not present as null) when
            // this layer has no complete connections yet, same
            // "nothing to export" convention as the top-level case below.
            if (completeLayerConnections.length > 0) {
                layerData.patternName = computeThemeLineName(completeLayerConnections);
                layerData.themeLineOrbits = computeThemeLineOrbitAssignments(completeLayerConnections);
            }
            return layerData;
        });
    }

    if (curveAmount === 0) {
        const facesResult = computeCellFaces(completeConnections);
        data.geometry.faceNodes = facesResult.nodes;
        data.geometry.faces = facesResult.faces;
    }

    // Roadmap 1.11-B: base sheet's own patternName (top-level, per the
    // 1.11 design session's proposal - doesn't belong to `geometry`
    // specifically, same rationale as generator/exportedAt living at the
    // top level) + geometry.themeLineOrbits (per-connection orbit ids,
    // connIndex relative to completeConnections - see
    // computeThemeLineOrbitAssignments()'s own comment). Computed
    // directly here via core/orbits.js's live-app glue, unlike
    // crossLayerData below - no external parameter needed, since (unlike
    // the cross-layer compute result) there's no expensive/user-
    // triggered/staleness-tracked state to thread through: nodes/
    // currentShape/symmetryMode/connections are exactly what this
    // function already reads directly. Per-shape/curveAmount guard not
    // needed here either, for the same reason as the per-layer addition
    // above.
    if (completeConnections.length > 0) {
        data.patternName = computeThemeLineName(completeConnections);
        data.geometry.themeLineOrbits = computeThemeLineOrbitAssignments(completeConnections);
    }

    // Roadmap 1.10b-ii-c: geometry.crossLayer - additive the same way as
    // geometry.faces/geometry.layers before it, present only when the
    // caller actually has a valid (non-stale) result to give (see the
    // crossLayerData param comment above). Doesn't belong to any single
    // sheet (base or one layer), so it rides at the top level of
    // geometry rather than nested under one - {latticeBasis, nodes,
    // faces}, reusing computeCrossLayerFaces()'s own node id scheme
    // (sheetId:anchorIdx:nodeId / synthetic 'sN') as-is, since a
    // consumer resolving a cross-layer face's nodeIds needs exactly
    // this same set. Re-verified at implementation time against
    // SpaceHarmony's actual current importFlatForm()/_isFlat2DExport()
    // (not assumed from 1.10a/1.9's own re-checks): same conclusion -
    // importFlatForm() reads only geometry.centroid/outerCorners/nodes/
    // edges, _isFlat2DExport() checks only formatVersion===1 +
    // Array.isArray(geometry.nodes) - neither touches geometry.faces,
    // geometry.layers, or (now) geometry.crossLayer, so this stays
    // fully additive and formatVersion stays 1.
    if (crossLayerData) {
        data.geometry.crossLayer = crossLayerData;
    }

    return data;
}

// crossLayerData: forwarded as-is to buildExportData() - see its own
// param comment for why this is passed in rather than read from a
// global (sketch.js's export-JSON button handler is the actual caller
// in practice, deciding whether a valid result exists to pass).
function exportJSON(crossLayerData) {
    const data = buildExportData(crossLayerData);
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
