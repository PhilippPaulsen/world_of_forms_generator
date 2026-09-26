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
    // Roadmap 1.12 stage 1 pass 2 (node-resolution fix, export path):
    // keys initialized from nodeById itself (whichever node set was
    // actually passed in), not always the base's global `nodes` - the
    // latter is byte-identical for the base sheet's own call (nodeById
    // there IS built from `nodes`), but was a real, separate bug for a
    // layer's own call: a layer with MORE nodes than the base would hit
    // adjacency[aId].push(...) below on an id never initialized here
    // (TypeError on undefined), and a layer with FEWER would carry
    // extra, meaningless base-only keys that don't belong to it at all.
    nodeById.forEach((n, id) => { adjacency[id] = []; });

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
// findFaces()) are additive the same way, gated only on
// curveType.kind==='straight' (Roadmap 1.4-A: was curveAmount===0 -
// v1 is straight-line-only - see core/faces.js's computeCellFaces())
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
            // Roadmap 1.5-B: this object-shorthand already captured
            // whatever curveType currently holds since 1.4-A, so no code
            // change was needed to export kind:'free's own seed/
            // roughness/visible fields - re-verified for real at 1.5-B
            // implementation time (not just predicted from the 1.5-A
            // design session): ran a real export with a full 'free'
            // curveType (seed/roughness/visible all set) through
            // SpaceHarmony's actual importFlatForm() and confirmed
            // point/line/face counts and 2D-export detection are
            // unaffected, same as every prior meta.* re-check in this
            // series - meta.* still isn't read by that importer at all,
            // regardless of curveType's shape.
            curveType,
            lineColor,
            // Roadmap 1.2-C: null unless the current net came from
            // rebuildGridFromConstruction() (core/state.js), in which
            // case {p,q,side,n} - the exact inputs that reproduce this
            // net's own geometry. Additive, not required for visual
            // fidelity (geometry.outerCorners/nodes already fully
            // describe the shape) - purely construction-history
            // reproducibility, same object-shorthand pattern as
            // curveType above. Re-verified against SpaceHarmony's real
            // importFlatForm()/_isFlat2DExport() with actual alt-net
            // data, same as every prior meta.* addition in this series -
            // that importer still doesn't read meta.* at all.
            altNetSeed
        },
        geometry: {
            centroid: { x: centroid.x, y: centroid.y },
            outerCorners: outerCorners.map(c => ({ x: c.x, y: c.y })),
            nodes: nodes.map(n => ({ id: n.id, x: n.x, y: n.y })),
            edges: completeConnections.map(c => [c[0], c[1]]),
            adjacency
        }
    };

    // Roadmap 1.6 / Group E phase 2: meta.netTransform - present ONLY while a warp is in force, so every
    // regular export is byte-identical to before (formatVersion stays 1). geometry.nodes/edges stay
    // regular; the face lists below are omitted on a warped net (see netTransformExportData()).
    const netWarped = netWarpActive();
    // the DRAWN net (the animation frame while one is live), not the author spec; animationFrame says which progress it is
    if (netWarped) { data.meta.netTransform = netTransformExportData(netTransformNow(), nodeCount - 1, shapeSizeFactor); if (baseNetAnimation && baseNetAnimation.live) data.meta.netTransform.animationFrame = baseNetAnimation.t || 0; }

    const enabledLayers = additionalLayers.filter(layer => layer.enabled);
    const layerFaceStores = []; // Group D Phase 4: filled per exported layer below, for meta.faceColoring
    if (enabledLayers.length > 0) {
        data.geometry.layers = enabledLayers.map((layer, layerIdx) => {
            const completeLayerConnections = layer.connections.filter(c => c.length === 2);
            // Roadmap 1.12 stage 1 pass 2 (node-resolution fix, export
            // path): this layer's OWN persisted nodes, not the base's -
            // same bug class the prior pass fixed for rendering/
            // interaction/live pattern-name display, found here
            // separately since export.js wasn't touched by that pass.
            // A layer's own connections reference ITS OWN node ids
            // (assigned by _subdivide*Interior() starting at 1 for
            // that layer's own nodeCount), which the base's nodeById
            // either resolves to the wrong (differently-positioned)
            // node of the same id, or - once a layer's own node count
            // exceeds the base's - finds nothing at all.
            const layerNodeById = new Map(layer.nodes.map(n => [n.id, n]));
            const layerGridOverride = { nodes: layer.nodes, centroid: layer.centroid, outerCorners: layer.outerCorners };
            const layerData = {
                // This layer's own real node positions, mirroring the
                // top-level geometry.nodes - without this, a consumer has
                // no way to resolve `edges`' node ids to real coordinates
                // at all once a layer's own grid differs from the base's
                // (same ids, different positions, or ids the base's own
                // node set doesn't even contain).
                nodes: layer.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })),
                // Roadmap 1.12 stage 2 (export extension, distinct from
                // the offsetX/offsetY-rendering fix this stage otherwise
                // makes): this layer's own outerCorners/centroid/
                // shapeSizeFactor/nodeCount, mirroring the top-level
                // geometry.outerCorners/centroid/meta.shapeSizeFactor/
                // meta.nodeCount. A pre-existing gap from stage 1, not
                // introduced here: without these, a consumer has no way
                // to derive this layer's own lattice vectors (v1/v2, its
                // actual tiling pitch) at all - `nodes`/`edges` alone
                // only describe its single un-tessellated cell, not how
                // that cell repeats. Harmless/redundant for a same-scale
                // layer (identical to the top-level fields already
                // exported) but necessary for a differently-scaled one.
                outerCorners: layer.outerCorners.map(c => ({ x: c.x, y: c.y })),
                centroid: { x: layer.centroid.x, y: layer.centroid.y },
                // Roadmap 1.12 stage 4 (export gap, flagged during the
                // orbits.js shape-mismatch fix, built separately here):
                // this layer's own shape - every sibling field above/
                // below already describes how this layer's own geometry
                // is placed/scaled, but nothing previously said WHAT
                // shape it actually is once that can differ from the
                // base's own meta.shapeType. No fallback default (unlike
                // rotation's `|| 0`) - unlike rotation, which guards a
                // hypothetical older-layer-object rehydration path, this
                // app has no import/rehydration mechanism of its own
                // (checked directly, not assumed) and addLayer() has set
                // .shape unconditionally on every layer since stage 4,
                // so every real layer object reaching this point already
                // has it.
                shape: layer.shape,
                // Roadmap 1.12 stage 5 (symmetryMode axis) part 2: this
                // layer's own symmetryMode, same precedent/reasoning as
                // shape directly above (added now that a layer has one,
                // Phase 1) - no fallback default needed for the identical
                // reason shape has none: addLayer() has set it
                // unconditionally on every layer since Phase 1, and this
                // app has no import/rehydration mechanism of its own.
                symmetryMode: layer.symmetryMode,
                shapeSizeFactor: layer.shapeSizeFactor,
                nodeCount: layer.nodeCount,
                offsetX: layer.offsetX,
                offsetY: layer.offsetY,
                // Roadmap 1.12 stage 3: this layer's own rotation
                // (degrees, about the shared centroid) - same status as
                // offsetX/offsetY: a render-time placement parameter,
                // not baked into the exported nodes/outerCorners above
                // (which stay canonical/unrotated, per the stage-3
                // design's own point 1). A consumer wanting this layer's
                // actual rendered position applies rotation about
                // centroid first, then offsetX/offsetY - the same
                // reconstruction responsibility offsetX/offsetY already
                // placed on a consumer. Defaults to 0 for any layer
                // created before this field existed (addLayer() always
                // sets it now, but a layer object built by hand - e.g.
                // an older saved session re-hydrated some other way -
                // may not have it).
                rotation: layer.rotation || 0,
                edges: completeLayerConnections.map(c => [c[0], c[1]]),
                adjacency: computeAdjacency(completeLayerConnections, layerNodeById)
            };
            if (curveType.kind === 'straight' && !netWarped) {
                // Group D Phase 4: this layer's assignment store (undefined
                // for a layer that never had one) recolors its assigned
                // faces (face.color = resolved hex) and tags them with
                // face.colorSpec; unassigned faces are untouched.
                // Group D follow-up: the layer's OWN shape/symmetryMode/mirror axis
                // (faceSheetOverrideOfLayer) - before this its faces were expanded
                // under the BASE's mode and shape (a defect predating Group D),
                // mismatching the exported edges of any layer with its own.
                const layerFacesResult = computeCellFaces(completeLayerConnections, layer.nodes, layer.faceAssignments || null, null, faceSheetOverrideOfLayer(layer));
                layerData.faceNodes = layerFacesResult.nodes;
                layerData.faces = layerFacesResult.faces;
            }
            // Roadmap 1.11-B: patternName/themeLineOrbits - additive the
            // same way faceNodes/faces above are, but NOT gated on
            // curveType.kind: unlike face detection, theme-line orbit
            // reduction only depends on which NODES a connection joins
            // (core/orbits.js's computeThemeLineOrbits()), not on how the
            // line between them is drawn - a curved connection between
            // the same two nodes belongs to the exact same orbit as a
            // straight one. Omitted entirely (not present as null) when
            // this layer has no complete connections yet, same
            // "nothing to export" convention as the top-level case below.
            // Roadmap [orbits.js free-endpoint fix]: computeThemeLineName()
            // now returns null when this layer's connections include a
            // free-endpoint node (no orbit under the fixed group by
            // construction), not just when nothing's drawn - compute
            // first, then gate BOTH fields together on a non-null name,
            // so an unnameable pattern stays fully omitted rather than
            // exporting an explicit null or a holed themeLineOrbits
            // array, same "additive, present-only-when-valid" convention
            // this file already uses for every other optional field.
            // Roadmap [orbits.js shape-mismatch fix]: layer.shape passed
            // explicitly as the new shapeOverride argument - previously
            // omitted, so this layer's orbit table was silently computed
            // under the BASE's own currentShape (crashing outright for a
            // genuinely shape-mismatched layer, e.g. a triangle layer on
            // a hex base - see core/orbits.js's own comment). layer is
            // already in scope here, so no new plumbing is needed.
            // Roadmap 1.12 stage 5 (symmetryMode axis) part 2: layer.
            // symmetryMode passed explicitly as the mode argument (same
            // "layer is already in scope, no new plumbing" note as
            // shapeOverride above) - previously always `undefined`, so
            // this layer's exported patternName/themeLineOrbits were
            // silently computed under the BASE's own symmetryMode
            // (design session finding, harmless only because every layer
            // shared the one global value before Phase 1).
            if (completeLayerConnections.length > 0) {
                const layerPatternName = computeThemeLineName(completeLayerConnections, layer.symmetryMode, layerGridOverride, layer.shape);
                if (layerPatternName) {
                    layerData.patternName = layerPatternName;
                    layerData.themeLineOrbits = computeThemeLineOrbitAssignments(completeLayerConnections, layer.symmetryMode, layerGridOverride, layer.shape);
                }
            }
            layerFaceStores.push({ layerIndex: layerIdx, store: layer.faceAssignments });
            return layerData;
        });
    }

    if (curveType.kind === 'straight' && !netWarpBlocksFaces()) {   // a FIELD warp keeps its base faces (regular cell coordinates)
        const facesResult = computeCellFaces(completeConnections, nodes, baseFaceAssignments);
        data.geometry.faceNodes = facesResult.nodes;
        data.geometry.faces = facesResult.faces;
    }

    // Roadmap 1.10a / Group D Phase 4: meta.faceColoring - additive, present
    // ONLY when at least one sheet has a face-color assignment, so every
    // unassigned pattern exports byte-identically to before (formatVersion
    // stays 1). Assigned faces additionally carry face.colorSpec and export
    // face.color as the resolved #rrggbb (unassigned faces keep orbitColor()'s
    // hsl string, no colorSpec) - see core/facecolor.js. Extra JSON keys under
    // meta/geometry.faces, in the same category as every earlier additive
    // field (SpaceHarmony's importFlatForm()/_isFlat2DExport() read only
    // formatVersion + geometry.centroid/outerCorners/nodes/edges - re-confirmed
    // by grep in the Phase 4 session, not re-run against SpaceHarmony itself,
    // which is out of Group D's scope).
    // NB layerIndex (in meta.faceColoring.layers[]) is the position in the EXPORTED
    // geometry.layers array - enabled layers only, in tab order - NOT the layer's tab
    // index: with layer 2 disabled, tab 3 exports as layerIndex 1. A disabled layer's
    // geometry is not exported, and neither are its color assignments (they stay in
    // the app). Consumers resolve a layer by geometry.layers[layerIndex].
    const faceColoring = faceColoringExportData(baseFaceAssignments, layerFaceStores);
    if (faceColoring) data.meta.faceColoring = faceColoring;

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
    // function already reads directly. Per-shape/curveType guard not
    // needed here either, for the same reason as the per-layer addition
    // above.
    // Roadmap [orbits.js free-endpoint fix]: same gate-on-non-null-name
    // treatment as the per-layer case above - a free-endpoint-inclusive
    // base sheet omits both fields entirely rather than exporting an
    // explicit null.
    if (completeConnections.length > 0) {
        const basePatternName = computeThemeLineName(completeConnections);
        if (basePatternName) {
            data.patternName = basePatternName;
            data.geometry.themeLineOrbits = computeThemeLineOrbitAssignments(completeConnections);
        }
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
        // Roadmap 1.6: node dots sit where the canvas draws them - through the warp when one is in force.
        const nodeWarp = netWarpBaseNow();
        nodes.forEach(nd => { const p = nodeWarp ? applyNetWarp(nodeWarp, nd) : nd; svg += `    <circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3" />\n`; });
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
