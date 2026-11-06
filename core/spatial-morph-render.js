/**
 * core/spatial-morph-render.js
 * Morph stage c: the render hook of the static, lines-only spatial morph. core/tiling.js drawTessellation() calls spatialMorphTryDraw() as its FIRST statement (typeof-guarded: a page or test
 * that does not load this file, the gallery and the two protected netwarp tests among them, runs the old code unchanged); when it returns true the frame is the morph and drawTessellation()
 * returns, when it returns false the existing code runs line for line. With the switch off (spatialMorph.enabled !== true, core/state.js) it costs one call per frame and one property read.
 *
 * WHAT IT DRAWS (maintainer decisions): the keyframe layers' lines blended across the tessellation, as the prototype does it - the base sheet, the other layers, the timeline's playback layer,
 * the face fills are drawn when the keyframes show faces, the lines are straight, the sheet is a square and there is NO net or a FIELD net (stages f1 / f1b, see FACES below; coloured from the corner keyframes' colour fields, stage 006b, see FACE COLOUR), with a Single or Tiled net NOT; the net warp IS applied to the lines; the node dots, the net-line overlay and the cross-layer fills that draw() adds after drawTessellation() are untouched. No wave.
 * FOLLOWING THE TIMELINE (stage d): linear and radial with a timeline of two or more keyframes draw the ACTIVE SEGMENT of the timeline's progress (timeline.elapsedMs: the playback, the scrub bar):
 * the front of core/spatial-morph.js spatialMorphFrontWeight() wanders across the surface in the direction of the angle (radial: from the centre outward), behind it the LATER keyframe, ahead of it
 * the earlier one; at progress 0 only keyframe i shows (for keyframes whose boundary endpoints change their edge: with those endpoints projected onto the edge, as in the prototype, stage d2c), at the end of segment i the frame is the start of segment i + 1. Bilinear, and every case without a timeline, is the STATIC blend of stage c. The morph is drawn on the FIRST KEYFRAME LAYER'S OWN grid (stage d2: its persisted outerCorners / centroid / shape / symmetryMode / size, exactly what core/tiling.js hands tileFor() for that layer's normal frame), not the base sheet's; a keyframe layer's own offset and rotation are IGNORED (its lines are taken in its grid as resolveConnectionsToCoords() reads them), as in the prototype.
 *
 * HOW (no change to the tile loops): the tile functions of core/tiling.js are called ONCE with an empty layer override while drawShapeCell() is temporarily replaced by a recorder, so the
 * lattice, the tile centres, the flips and the mirror axis are exactly the ones the normal frame uses; the recorder is put back in a finally. The recorded tiles are then drawn here: per
 * tile the a1 weights at the tile centre, the a2 anchored endpoints (a boundary endpoint that slides on a cell edge uses the weights of the shared edge), the symmetry copies in the order of
 * core/symmetry.js drawConnectionWithSymmetry(), through drawCurvedBezier() with the current curve style (so curves, free lines and the line colour / weight are the normal frame's).
 *
 * PRE-CONDITIONS and the STATUS: with the switch on, the morph needs two keyframe layers of the same shape and line count (the timeline's, else the layers in index order, else the base sheet
 * and one layer). If they are not there the normal frame is drawn and spatialMorphStatus().code says why: 'needsTwoKeyframes', 'shapeMismatch', 'lineCountMismatch', 'parameterMismatch' (the keyframes differ in symmetry mode or size factor; the timeline requires them equal), 'alignmentFailed'
 * (resolveTimelineKeyframeCoords() refused), 'renderError' (something threw; nothing escapes). 'ok' = drawn, 'netActive' = drawn and a net warp is in force (the net warps the LINES: activeNetWarp is set around the draw and restored in the finally; with no net or a FIELD net the faces are drawn too, stages f1 / f1b, coloured by stage 006b), 'netFacesNeedField' = the same with a Single or Tiled net while the keyframes show faces (lines only, no faces),
 * 'off' = the switch is off. The status is read-only data for the UI of a later stage; this file writes no text. The SVG export (svgPathCollector set) always gets the normal pattern.
 *
 * Depends on (call-time, all optional-checked): core/state.js globals, core/tiling.js tileFor(), core/symmetry.js, core/curves.js, core/spatial-morph.js, and from sketch.js
 * resolveTimelineKeyframeCoords() / resolveConnectionsToCoords(). Every top-level name starts with spatialMorph.
 */

const spatialMorphRenderState = {
    status: { code: 'off', keyframes: 0, mode: 'linear', progress: null, segment: null, seamOpen: null },
    spanKey: null,
    span: null,
    spanComputes: 0,     // how often the span was (re)computed: the freeze is visible to the tests
    frames: 0,           // morph frames drawn
    seamCheck: true,     // stage e1: switch of the seam-open check (the tests turn it off to prove it changes no frame)
    seamChecks: 0,       // how often the seam-open check was COMPUTED (not looked up): the cache is visible to the tests
    seamHits: 0,         // how often it came from the cache
    seamCache: new Map(),   // content signature -> { open, boundary, checked, unmatched }
    seamLastMs: 0,       // the duration of the last computation (ms), for the page measurement
    colorCache: new Map(),   // morph stage 006b: corner key -> { sig, value } (the colour field of a corner keyframe)
    colorBuilds: 0,          // how often a corner field was BUILT (not looked up): the cache is visible to the tests
    paletteLin: [],          // the default corner palettes in linear light (built on first use)
    faceStats: null,     // morph stage f1: { tiles, tilesWithFaces, faces } of the last morph frame (all 0 when no face was asked for or the net is no FIELD warp)
};

// The status of the last frame (a copy). { code, keyframes, mode, progress, segment, seamOpen }, code one of spatialMorphStatusCodes. seamOpen (stage e1): the keyframes that are NOT seamless at the tile edge,
// as indices into additionalLayers (-1 = the base sheet), [] when every keyframe that takes part is seamless, null when it was not evaluated (the morph is off, or the code is not ok / bilinearStatic / netActive).
// The old text follows: progress = the local progress of the active segment (0..1, what the front
// used) and segment = its index, or null for a frame without them (static: bilinear, or no timeline, or no pair). keyframes = the keyframes of the timeline (linear / radial with a timeline) or of the blend.
function spatialMorphStatus() {
    const s = spatialMorphRenderState.status;
    return { code: s.code, keyframes: s.keyframes, mode: s.mode, progress: s.progress, segment: s.segment, seamOpen: Array.isArray(s.seamOpen) ? s.seamOpen.slice() : null };
}

// Forget the frozen span (the key already changes with the lattice, the projection and the canvas; this is for a caller that wants a recompute).
function spatialMorphInvalidateSpan() {
    spatialMorphRenderState.spanKey = null;
    spatialMorphRenderState.span = null;
}

function spatialMorphRenderSetStatus(code, keyframes, mode, progress, segment, seamOpen) {
    const s = spatialMorphRenderState.status;
    s.code = code; s.keyframes = keyframes || 0; s.mode = mode || 'linear';
    s.progress = typeof progress === 'number' ? progress : null; s.segment = typeof segment === 'number' ? segment : null;
    s.seamOpen = Array.isArray(seamOpen) ? seamOpen : null;
}

// Stage e1: which of the keyframes that take part (plan.ids: the active segment's two for linear / radial, up to four corners for bilinear) are NOT seamless at the tile edge. The tiles and the symmetry operations
// are the ones just recorded for the draw (the keyframes agree among themselves in shape, size and symmetry mode, or the plan would have said parameterMismatch), so nothing is recorded again. Each keyframe's
// verdict is cached by a signature of its content, shape, size factor, symmetry mode, canvas, polygon and tile count (spatialMorphRenderState.seamCache), so a redraw loop or the playback computes it once.
// -> an array of indices into additionalLayers (-1 = the base sheet), [] when all are seamless, null when the check is off or anything throws (it never throws and draws nothing).
function spatialMorphRenderSeamOpen(plan, src, tiles, sym) {
    const st = spatialMorphRenderState;
    if (st.seamCheck === false) return null;
    try {
        const axes = tiles.map((t) => (sym.hasReflection ? (t.axis || mirrorAxisDir()) : null));
        const world = { tileCount: tiles.length, opCount: sym.ops.length, toWorld: (p, t, o) => spatialMorphRenderToWorld(p, tiles[t], sym.ops[o], axes[t]) };
        const r6 = (v) => Math.round(v * 1e6) / 1e6;
        const open = [];
        for (const id of plan.ids) {
            const layer = id === 'base' ? null : additionalLayers[id];
            if (id !== 'base' && !layer) return null;
            const lines = resolveConnectionsToCoords(layer || { connections, nodes });
            const size = layer ? layer.shapeSizeFactor : shapeSizeFactor;
            const key = [src.shape, size, src.symmetryMode, canvasW, canvasH, tiles.length, src.outerCorners.map((p) => r6(p.x) + ',' + r6(p.y)).join(';'), lines.map((l) => r6(l.x1) + ',' + r6(l.y1) + ',' + r6(l.x2) + ',' + r6(l.y2)).join(';')].join('|');
            let verdict = st.seamCache.get(key);
            if (verdict === undefined) {
                const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                verdict = spatialMorphSeamOpen(lines, src.outerCorners, world);
                st.seamLastMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
                st.seamChecks++;
                if (st.seamCache.size >= 64) st.seamCache.clear();
                st.seamCache.set(key, verdict);
            } else st.seamHits++;
            if (verdict.open) open.push(id === 'base' ? -1 : id);
        }
        return open;
    } catch (e) {
        return null;
    }
}

// The segment and the local progress the timeline is at now (stage d): the timeline's own resolveTimelineSegment() when the page has it (the single source of the arithmetic), else the pure mirror.
// elapsedMs is clamped to [0, total] (a playing timeline keeps it so; a stale value never leaves the last segment). -> { segmentIndex, localT } or null
function spatialMorphRenderSegmentNow() {
    const durs = timeline.segmentDurationsMs;
    const total = (typeof totalTimelineDurationMs === 'function') ? totalTimelineDurationMs(timeline) : durs.reduce((a, b) => a + b, 0);
    const e = (typeof timeline.elapsedMs === 'number' && Number.isFinite(timeline.elapsedMs)) ? timeline.elapsedMs : 0;
    const elapsed = Math.max(0, Math.min(total, e));
    return (typeof resolveTimelineSegment === 'function') ? resolveTimelineSegment(timeline, elapsed) : spatialMorphSegmentAt(durs, elapsed);
}

function spatialMorphRenderLineCount(connList) {
    let n = 0;
    for (let i = 0; i < connList.length; i++) if (Array.isArray(connList[i]) && connList[i].length === 2) n++;
    return n;
}

// The node ids of the lines resolveConnectionsToCoords() returns for a sheet, in its order (a connection with a missing node is skipped there too): the ids a 'free' curve is seeded with.
function spatialMorphRenderLineIds(sheet) {
    const out = [];
    for (const conn of sheet.connections) {
        if (conn.length !== 2) continue;
        const n1 = sheet.nodes.find((n) => n.id === conn[0]);
        const n2 = sheet.nodes.find((n) => n.id === conn[1]);
        if (!n1 || !n2) continue;
        out.push([conn[0], conn[1]]);
    }
    return out;
}

// The keyframes' lines aligned to K0's order and orientation, chained through resolveTimelineKeyframeCoords() (pairing, flips, symmetry-orbit members) as the prototype does:
// segment 0 gives K0 and K1, segment 1 gives K2 in K0's order, segment 2 gives K3. -> { ok, corners, lineIds, keyframeCount } | { ok: false }
function spatialMorphRenderAlign(plan, mode, realTimeline) {
    if (typeof resolveTimelineKeyframeCoords !== 'function' || typeof resolveConnectionsToCoords !== 'function') return { ok: false };
    const bilinear = spatialMorphNormalizeMode(mode) === 'bilinear';
    if (plan.source === 'base') {
        const baseSheet = { connections, nodes };
        const layer = additionalLayers[plan.ids[1]];
        const kf = [resolveConnectionsToCoords(baseSheet), resolveConnectionsToCoords(layer)];
        const ch = spatialMorphChooseCorners(kf, mode);
        return ch.ok ? { ok: true, corners: ch, lineIds: spatialMorphRenderLineIds(baseSheet), keyframeCount: 2 } : { ok: false };
    }
    const ids = bilinear ? plan.ids : plan.ids.slice(0, 2);
    const segCount = ids.length - 1;
    let desc;
    if (!bilinear && plan.source === 'keyframes' && realTimeline) {
        desc = realTimeline;   // linear / radial: the timeline's own first segment, with its pairing, flips and members
    } else {
        desc = { keyframeLayerIds: ids, segmentDurationsMs: new Array(segCount).fill(2000), segmentPairings: new Array(segCount).fill(null), segmentFlips: new Array(segCount).fill(null), segmentMembers: new Array(segCount).fill(null) };
        if (realTimeline && Array.isArray(realTimeline.keyframeLayerIds)) {
            for (let s = 0; s < segCount; s++) {
                if (realTimeline.keyframeLayerIds[s] === ids[s] && realTimeline.keyframeLayerIds[s + 1] === ids[s + 1]) {
                    desc.segmentPairings[s] = realTimeline.segmentPairings ? realTimeline.segmentPairings[s] : null;
                    desc.segmentFlips[s] = realTimeline.segmentFlips ? realTimeline.segmentFlips[s] : null;
                    desc.segmentMembers[s] = realTimeline.segmentMembers ? realTimeline.segmentMembers[s] : null;
                }
            }
        }
    }
    const seg0 = resolveTimelineKeyframeCoords(desc, 0);
    if (!seg0 || !seg0.ok) return { ok: false };
    const n = seg0.from.length;
    const kf = [seg0.from, seg0.to];
    if (bilinear && ids.length >= 3) {
        // which authored line of the current keyframe corresponds to row i of K0, and whether it is reversed relative to K0[i]
        let curIdx = Array.from({ length: n }, (_, i) => (seg0.perm ? seg0.perm[i] : i));
        let curFlip = Array.from({ length: n }, (_, i) => (seg0.flips ? !!seg0.flips[curIdx[i]] : false));
        const seg1 = resolveTimelineKeyframeCoords(desc, 1);
        if (seg1 && seg1.ok && seg1.to.length === n) {
            const K2 = new Array(n), nextIdx = new Array(n), nextFlip = new Array(n);
            for (let i = 0; i < n; i++) {
                const j1 = curIdx[i];
                const c = seg1.to[j1];
                K2[i] = curFlip[i] ? { x1: c.x2, y1: c.y2, x2: c.x1, y2: c.y1 } : { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 };
                const j2 = seg1.perm ? seg1.perm[j1] : j1;
                nextIdx[i] = j2;
                nextFlip[i] = curFlip[i] !== (seg1.flips ? !!seg1.flips[j2] : false);
            }
            kf.push(K2);
            curIdx = nextIdx; curFlip = nextFlip;
            if (ids.length >= 4) {
                const seg2 = resolveTimelineKeyframeCoords(desc, 2);
                if (seg2 && seg2.ok && seg2.to.length === n) {
                    const K3 = new Array(n);
                    for (let i = 0; i < n; i++) {
                        const c = seg2.to[curIdx[i]];
                        K3[i] = curFlip[i] ? { x1: c.x2, y1: c.y2, x2: c.x1, y2: c.y1 } : { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 };
                    }
                    kf.push(K3);
                }
            }
        }
    }
    const ch = spatialMorphChooseCorners(kf, mode);
    if (!ch.ok) return { ok: false };
    return { ok: true, corners: ch, lineIds: spatialMorphRenderLineIds(additionalLayers[ids[0]]), keyframeCount: ch.keyframeCount };
}

// The sheet whose lattice, shape and symmetry mode the morph is drawn on (stage d2): the first keyframe layer's OWN persisted outerCorners / centroid / shape / symmetryMode, exactly what core/tiling.js
// drawTessellation() hands tileFor() when it draws that layer's normal frame (the independent pass), NOT the base sheet's (they differ whenever a keyframe layer has another symmetry mode or size
// factor than the base). The base sheet itself when the plan is the base fallback or the layer has no persisted grid. -> { outerCorners, centroid, nodes, shape, symmetryMode, nodeCount, sizeFactor }
function spatialMorphRenderSource(plan) {
    const layer = (plan && plan.ids && plan.ids[0] !== 'base') ? additionalLayers[plan.ids[0]] : null;
    if (!layer || !Array.isArray(layer.outerCorners) || layer.outerCorners.length < 3 || !layer.centroid) return { outerCorners, centroid, nodes, shape: currentShape, symmetryMode, nodeCount, sizeFactor: shapeSizeFactor };
    return { outerCorners: layer.outerCorners, centroid: layer.centroid, nodes: layer.nodes || nodes, shape: layer.shape || currentShape, symmetryMode: layer.symmetryMode || symmetryMode, nodeCount: layer.nodeCount || nodeCount, sizeFactor: layer.shapeSizeFactor || shapeSizeFactor };
}

// The tiles the normal frame would draw for a sheet (src, see spatialMorphRenderSource(); default the base sheet), in its order: [{ c, flip, rot, axis, shape, mode }]. The recorder replaces drawShapeCell() for the length of the call only.
function spatialMorphRenderRecordTiles(src) {
    const tiles = [];
    const real = drawShapeCell;
    const s = src || { outerCorners, centroid, nodes, shape: currentShape, symmetryMode };
    const emptyLayer = { outerCorners: s.outerCorners, centroid: s.centroid, connections: [], nodes: s.nodes, offsetX: 0, offsetY: 0, rotation: 0, shape: s.shape, symmetryMode: s.symmetryMode };
    drawShapeCell = function (connSet, tileCentroid, flip180, nodeArr, rotationDeg, mirrorAxisOverride, shapeOverride, symmetryModeOverride) {
        tiles.push({ c: { x: tileCentroid.x, y: tileCentroid.y }, flip: !!flip180, rot: rotationDeg || 0, axis: mirrorAxisOverride, shape: shapeOverride, mode: symmetryModeOverride });
    };
    try { tileFor(s.shape)(null, null, emptyLayer); } finally { drawShapeCell = real; }
    return tiles;
}

// A canonical cell point -> the world: the tile's transform, then the symmetry copy (core/symmetry.js order: rotate about the tile centre, then reflect across the mirror axis).
function spatialMorphRenderToWorld(p, tile, op, axisDir) {
    let w = toTileLocal(p, tile.c, tile.flip, tile.rot);
    if (op.angle) w = rotateAround(w, tile.c, op.angle);
    if (op.reflected && axisDir) w = reflectAcrossLine(w, tile.c, axisDir);
    return w;
}

// ---- FACES (morph stage f1; their colour: FACE COLOUR below) -------------------------------------------------------------------------------------------------------------------------------------------------
// The faces of a tile's morphed cell, found the way the prototype does it (_runSafeComputeCellFaces): the tile's interpolated lines become synthetic nodes and connections, a border polygon of the
// sheet's outer corners closes every region at the cell edge, computeCellFaces() runs on REGULAR coordinates (activeNetWarp = null for the call) with NO assignment store (null: nothing is read from or
// written to a keyframe's store, ensureDefaultGrayFill() is never reached) so the faces carry the default orbit grays, and the polygons are warped when they are drawn (a FIELD warp is affine inside
// every tile: spatialMorphRenderFillFaces()). Faces exist ONLY when the keyframes show faces, the curve type is straight, the sheet is a square and no net is in force or a FIELD warp is (without a net the polygons are drawn unwarped); anything else (a Single or Tiled net, other shapes) draws lines only, as before.
// Whether the keyframe sheets of the plan all show faces (the base sheet: showFaces, a layer: its own showFaces).
function spatialMorphRenderFacesWanted(plan) {
    if (typeof showFaces === 'undefined' || typeof additionalLayers === 'undefined') return false;
    const ids = (plan && Array.isArray(plan.ids)) ? plan.ids : [];
    return ids.length > 0 && ids.every((id) => (id === 'base' ? !!showFaces : !!(additionalLayers[id] && additionalLayers[id].showFaces)));
}

// The faces of one cell from its morphed lines [[{x,y}, {x,y}], ...] (canonical cell coordinates) -> { nodes, faces } ({ nodes: [], faces: [] } when there is nothing to say). Never throws, always puts
// activeNetWarp and segmentCollector back, never touches the inputs (s.nodes is copied, the lines are read only).
function spatialMorphRenderTileFaces(lines, s, sheet) {
    const none = { nodes: [], faces: [] };
    if (typeof computeCellFaces !== 'function' || !Array.isArray(lines) || lines.length === 0) return none;
    const savedWarp = activeNetWarp;
    const savedCollector = (typeof segmentCollector !== 'undefined') ? segmentCollector : null;
    try {
        activeNetWarp = null;
        if (typeof segmentCollector !== 'undefined') segmentCollector = null;
        // free: true keeps the synthetic nodes out of the symmetry group of the grid nodes (core/orbits.js filters them), so the real nodes alone fix the group
        const gridNodes = s.nodes.slice();
        const conns = [];
        lines.forEach((ln, i) => {
            if (Math.hypot(ln[1].x - ln[0].x, ln[1].y - ln[0].y) < 1e-9) return;   // a line that collapsed to a point has no face to bound
            const a = { id: -1 - 2 * i, x: ln[0].x, y: ln[0].y, free: true }, b = { id: -2 - 2 * i, x: ln[1].x, y: ln[1].y, free: true };
            gridNodes.push(a, b);
            conns.push([a.id, b.id]);
        });
        const border = s.outerCorners.map((p, k) => ({ id: -1000001 - k, x: p.x, y: p.y, free: true }));
        border.forEach((n, k) => { gridNodes.push(n); conns.push([n.id, border[(k + 1) % border.length].id]); });
        return computeCellFaces(conns, gridNodes, null, null, sheet) || none;
    } catch (e) {
        return none;
    } finally {
        activeNetWarp = savedWarp;
        if (typeof segmentCollector !== 'undefined') segmentCollector = savedCollector;
    }
}

// ---- FACE COLOUR (morph stage 006b) --------------------------------------------------------------------------------------------------------------------------------------------------------
// The prototype's way (_buildCornerColorReferences / _sampleCornerColorForFace / drawSpatialMorphFaceFillsAtTile): every CORNER keyframe has a colour FIELD (its faces in the cell, each in its colour); a morph face is sampled
// in each corner's field at its centroid and 6 inner points, and the tile mixes the corner colours with ITS corner weights (weightsAt(tile centre)) in LINEAR LIGHT. A corner whose weight is 0 is not sampled
// (at progress 0 the frame is keyframe 0's colours exactly). A corner keyframe WITHOUT a colour of its own (no harmony applied, no assignment except the default grays) takes the prototype's default palette of its
// corner, by area rank. NOTHING is written to a keyframe's store: the faces come from computeCellFaces() with NO store (so no reconciliation and no ensureDefaultGrayFill()), the store is only READ
// (applyFaceAssignments() reads it, the store object is read straight from the layer, faceAssignmentsFor() would create a missing one), and the fields are cached here, not in the layer.

// The sheet ids of the four corners [K00, K10, K01, K11] ('base' or an index into additionalLayers), the way spatialMorphChooseCorners() fills them: two keyframes repeat on the 01 / 11 corners.
function spatialMorphRenderCornerIds(plan, mode, keyframeCount) {
    const ids = (plan && Array.isArray(plan.ids)) ? plan.ids : [];
    const bil = spatialMorphNormalizeMode(mode) === 'bilinear';
    return [ids[0], ids[1], bil && keyframeCount >= 3 ? ids[2] : ids[0], bil && keyframeCount >= 4 ? ids[3] : ids[1]];
}

// The cell a corner sheet colours: its connections, nodes, face store (read only, may be missing) and the sheet override computeCellFaces() needs (null for the base).
function spatialMorphRenderColorSheet(id) {
    if (id === 'base') return { connections, nodes, store: (typeof baseFaceAssignments !== 'undefined') ? baseFaceAssignments : null, sheet: null, id };
    const layer = additionalLayers[id];
    if (!layer || !Array.isArray(layer.connections) || !Array.isArray(layer.nodes)) return null;
    return { connections: layer.connections, nodes: layer.nodes, store: layer.faceAssignments || null, sheet: (typeof faceSheetOverrideOfLayer === 'function') ? faceSheetOverrideOfLayer(layer) : null, id };
}

// Does this corner sheet have a colour of its own? A harmony applied (lastHarmonyTypeFor), or a store entry that is not the default gray fill (rule 'max-contrast-gray') - the prototype's test.
function spatialMorphRenderHasColor(cs) {
    if (typeof lastHarmonyTypeFor === 'function' && lastHarmonyTypeFor(cs.id) !== null) return true;
    if (cs.store && cs.store.size > 0) for (const e of cs.store.values()) if (e && e.rule !== 'max-contrast-gray') return true;
    return false;
}

const spatialMorphRenderPaletteLin = (cornerIdx) => spatialMorphRenderState.paletteLin[cornerIdx % 4] || (spatialMorphRenderState.paletteLin[cornerIdx % 4] = spatialMorphDefaultCornerPalettes[cornerIdx % 4].map((c) => cssColorToLinear('#' + c.map((x) => x.toString(16).padStart(2, '0')).join(''))));

// The colour field of one corner: { colored, field: [{ poly, minX, maxX, minY, maxY, lin }] } (lin = linear light), cached by a signature of everything it depends on. null when it cannot be built.
// A COLOURED corner (a harmony or an assignment): the faces of the keyframe layer's own cell (the store's keys are the trail keys of THESE faces), coloured by its store. An UNCOLOURED corner: the faces of the
// corner's lines as the morph draws them (geo.lines[cornerIdx], projected endpoints included, so at p = 0 and p = 1 the field IS the morph's own faces), by area rank from the corner's default palette
// (the prototype builds this field from the interpolated corner geometry too).
function spatialMorphRenderCornerField(id, cornerIdx, geo) {
    const cs = spatialMorphRenderColorSheet(id);
    if (!cs || typeof computeCellFaces !== 'function' || typeof cssColorToLinear !== 'function') return null;
    const colored = spatialMorphRenderHasColor(cs);
    const lay = cs.sheet || { shape: currentShape, symmetryMode, outerCorners };
    const cornerLines = (!colored && geo && geo.lines) ? geo.lines[cornerIdx] : null;
    const sig = JSON.stringify([colored ? cs.connections : cornerLines, colored && cs.store ? [...cs.store] : null, colored, cornerIdx, lay.shape, lay.symmetryMode, cs.nodes.length, lay.outerCorners && lay.outerCorners[0]]);
    const st = spatialMorphRenderState;
    const key = String(id) + '#' + cornerIdx;
    const hit = st.colorCache.get(key);
    if (hit && hit.sig === sig) return hit.value;
    const savedWarp = activeNetWarp;
    const savedCollector = (typeof segmentCollector !== 'undefined') ? segmentCollector : null;
    let value = null;
    try {
        activeNetWarp = null;
        if (typeof segmentCollector !== 'undefined') segmentCollector = null;
        let res;
        if (colored) {
            // the cell closed by a border polygon of the sheet's outer corners (as the morph's own faces are, spatialMorphRenderTileFaces()), so every region has a colour; NO store: nothing is reconciled or filled in
            const gridNodes = cs.nodes.slice();
            const conns = cs.connections.filter((c) => Array.isArray(c) && c.length === 2).map((c) => c.slice());
            const oc = cs.sheet ? cs.sheet.outerCorners : outerCorners;
            const border = oc.map((p, k) => ({ id: -1000001 - k, x: p.x, y: p.y, free: true }));
            border.forEach((n, k) => { gridNodes.push(n); conns.push([n.id, border[(k + 1) % border.length].id]); });
            res = computeCellFaces(conns, gridNodes, null, null, cs.sheet);
            if (cs.store && typeof sheetGroupElements === 'function' && typeof applyFaceAssignments === 'function') {
                const group = sheetGroupElements(cs.nodes, cs.sheet);
                if (group) applyFaceAssignments(res, cs.store, group);   // reads the store, recolours the fresh faces
            }
        } else {
            res = geo && cornerLines ? spatialMorphRenderTileFaces(cornerLines, geo.s, geo.sheet) : { nodes: [], faces: [] };
        }
        const nodeById = new Map(res.nodes.map((n) => [n.id, n]));
        const ranks = spatialMorphFaceRanks(res.faces.map((f) => f.area));
        const pal = spatialMorphRenderPaletteLin(cornerIdx);
        const field = [];
        res.faces.forEach((f, i) => {
            const poly = f.nodeIds.map((nid) => nodeById.get(nid)).filter(Boolean).map((n) => ({ x: n.x, y: n.y }));
            if (poly.length < 3) return;
            const lin = colored ? cssColorToLinear(f.color) : pal[(ranks[i] + (f.connIndex || 0)) % pal.length];
            const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
            field.push({ poly, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), lin });
        });
        value = { colored, field };
    } catch (e) {
        value = null;
    } finally {
        activeNetWarp = savedWarp;
        if (typeof segmentCollector !== 'undefined') segmentCollector = savedCollector;
    }
    st.colorBuilds++;
    st.colorCache.set(key, { sig, value });
    return value;
}

// The four corner fields of a frame [K00, K10, K01, K11] (a corner that repeats another sheet shares its field; one that cannot be built is null).
function spatialMorphRenderCornerFields(cornerIds, keyframeCount, mode, geo) {
    const bil = spatialMorphNormalizeMode(mode) === 'bilinear';
    const needed = [true, true, bil && keyframeCount >= 3, bil && keyframeCount >= 4];   // the 01 / 11 corners of a two-keyframe blend repeat 00 / 10 with weight 0: no field is built for them
    return cornerIds.map((id, k) => (id === undefined || !needed[k] ? null : spatialMorphRenderCornerField(id, k, geo)));
}

// A corner field sampled at the points of one face: the mean linear colour of the points that fall in a field face, or null when none does.
function spatialMorphRenderSampleField(cf, samples) {
    if (!cf) return null;
    const acc = [0, 0, 0];
    let n = 0;
    for (const p of samples) {
        for (const e of cf.field) {
            if (p.x < e.minX || p.x > e.maxX || p.y < e.minY || p.y > e.maxY) continue;
            if (pointInPolygon(p, e.poly)) { acc[0] += e.lin[0]; acc[1] += e.lin[1]; acc[2] += e.lin[2]; n++; break; }
        }
    }
    return n ? [acc[0] / n, acc[1] / n, acc[2] / n] : null;
}

// The colours of the faces of one tile: ['#rrggbb', ...] parallel to res.faces, or null when nothing can be said (the caller then keeps the faces' own colours). w = the tile's corner weights.
function spatialMorphRenderFaceColors(res, fields, w) {
    try {
        if (!res || !res.faces || res.faces.length === 0) return null;
        const weights = [w.w00, w.w10, w.w01, w.w11];
        const nodeById = new Map(res.nodes.map((n) => [n.id, n]));
        const ranks = spatialMorphFaceRanks(res.faces.map((f) => f.area));
        return res.faces.map((face, i) => {
            const pts = face.nodeIds.map((nid) => nodeById.get(nid)).filter(Boolean);
            const samples = spatialMorphFaceSamplePoints(pts);
            const cols = weights.map((wk, k) => {
                if (!(wk > 0)) return null;
                const lin = spatialMorphRenderSampleField(fields[k], samples);
                if (lin) return lin;
                const pal = spatialMorphRenderPaletteLin(k);   // a miss (a sample outside the corner's field): the corner's default palette by rank
                return pal[(ranks[i] + (face.connIndex || 0)) % pal.length];
            });
            const mix = spatialMorphMixLinear(cols, weights);
            return mix ? linearToHex(mix) : face.color;
        });
    } catch (e) {
        return null;
    }
}

// Fills the faces of one tile (the same tile transform as its lines, then the warp of the field net) -> the number of faces drawn. colors (optional) = the fill of every face, parallel to the faces; without it the face's
// own colour (the default orbit color). ONE push() with its pop() in a finally: the p5 style is back whatever happens.
function spatialMorphRenderFillFaces(res, tile, warp, colors) {
    const faces = res && res.faces;
    if (!faces || faces.length === 0) return 0;
    const byId = new Map(res.nodes.map((n) => [n.id, n]));
    push();
    try {
        noStroke();
        faces.forEach((face, fi) => {
            fill(colors && colors[fi] ? colors[fi] : face.color);
            beginShape();
            face.nodeIds.forEach((id) => {
                const p = toTileLocal(byId.get(id), tile.c, tile.flip, tile.rot);
                const q = warp ? applyNetWarp(warp, p) : p;
                vertex(q.x, q.y);
            });
            endShape(CLOSE);
        });
    } finally {
        pop();
    }
    return faces.length;
}

function spatialMorphRenderDraw(sm) {
    const mode = spatialMorphNormalizeMode(sm.mode);
    const angleDeg = spatialMorphNumber(sm.angleDeg);
    const infos = additionalLayers.map((l) => ({ shape: l.shape, lineCount: spatialMorphRenderLineCount(l.connections), isPlayback: !!l.isTimelinePlayback, symmetryMode: l.symmetryMode, sizeFactor: l.shapeSizeFactor }));
    const base = { shape: currentShape, lineCount: spatialMorphRenderLineCount(connections), symmetryMode, sizeFactor: shapeSizeFactor };
    const tlIds = (timeline && Array.isArray(timeline.keyframeLayerIds)) ? timeline.keyframeLayerIds : null;
    // Stage d: linear and radial with a timeline of two or more keyframes follow its progress through the ACTIVE SEGMENT (earlier keyframe K_i, later K_i+1, aligned by the timeline's own pairing, flips and
    // members of that segment). Bilinear, and every case without a timeline, stays the static blend of stage c.
    let progress = null, segment = null, plan = null, aligned = null, keyframes = 0;
    if (mode !== 'bilinear' && tlIds && tlIds.length >= 2 && Array.isArray(timeline.segmentDurationsMs) && timeline.segmentDurationsMs.length === tlIds.length - 1) {
        const seg = spatialMorphRenderSegmentNow();
        if (seg) {
            segment = seg.segmentIndex; progress = seg.localT; keyframes = tlIds.length;
            const a = tlIds[segment], b = tlIds[segment + 1];
            if (!additionalLayers[a] || !additionalLayers[b]) { spatialMorphRenderSetStatus('alignmentFailed', keyframes, mode, progress, segment); return false; }
            plan = spatialMorphPlanKeyframes(infos, { mode, timelineIds: [a, b], base });
            if (!plan.ok) { spatialMorphRenderSetStatus(plan.code, keyframes, mode, progress, segment); return false; }
            const res = (typeof resolveTimelineKeyframeCoords === 'function') ? resolveTimelineKeyframeCoords(timeline, segment) : null;
            const ch = (res && res.ok) ? spatialMorphChooseCorners([res.from, res.to], mode) : { ok: false };
            aligned = ch.ok ? { ok: true, corners: ch, lineIds: spatialMorphRenderLineIds(additionalLayers[a]), keyframeCount: 2 } : { ok: false };
        }
    }
    if (!aligned) {
        plan = spatialMorphPlanKeyframes(infos, { mode, timelineIds: tlIds, base });
        if (!plan.ok) { spatialMorphRenderSetStatus(plan.code, 0, mode); return false; }
        aligned = spatialMorphRenderAlign(plan, mode, timeline);
        keyframes = aligned.keyframeCount || 0;
    }
    if (!aligned.ok || !spatialMorphValidateCorners(aligned.corners).ok) { spatialMorphRenderSetStatus('alignmentFailed', keyframes, mode, progress, segment); return false; }

    const s = spatialMorphRenderSource(plan);
    const hasWarp = typeof activeNetWarp !== 'undefined';
    const prevWarp = hasWarp ? activeNetWarp : null;
    if (hasWarp) {
        activeNetWarp = (typeof netWarpForBase === 'function' && typeof netTransformNow === 'function')
            ? netWarpForBase(netTransformNow(), s.shape, s.outerCorners, s.nodeCount, s.sizeFactor)
            : null;
    }
    let tiles, sym, started = false;
    let facesAsked = false, warpField = false;   // faces wanted (keyframes show faces, straight curve) / the warp in force is a FIELD warp: both needed for faces
    try {
        tiles = spatialMorphRenderRecordTiles(s);
        if (tiles.length === 0) { spatialMorphRenderSetStatus('renderError', keyframes, mode, progress, segment); return false; }
        const centroids = tiles.map((t) => t.c);
        const center = { x: canvasW / 2, y: canvasH / 2 };
        const key = spatialMorphSpanKey(mode, angleDeg, s.shape, s.outerCorners, canvasW, canvasH, centroids);
        const st = spatialMorphRenderState;
        if (st.span === null || st.spanKey !== key) {
            st.span = spatialMorphSpanFromCentroids(mode, centroids, canvasW, canvasH, { angleDeg, center });
            st.spanKey = key;
            st.spanComputes++;
        }
        const span = st.span;
        const opts = { angleDeg, center };
        // the weights at a world point: the front at the segment's progress (linear / radial with a timeline), else the static weights of stage c; either depends only on the POINT, the span and the progress, so two
        // tiles that share an edge get the same weights for an endpoint that slides on it and the seam stays closed
        const fopts = { angleDeg, center, progress, band: spatialMorphFrontBand };
        const weightsAt = progress === null ? (pt) => spatialMorphCornerWeights(mode, pt, span, opts) : (pt) => spatialMorphFrontCornerWeights(mode, pt, span, fopts);
        const prepared = spatialMorphPrepareLines(aligned.corners, s.outerCorners);
        const lineIds = aligned.lineIds;
        sym = spatialMorphSymmetryOps(s.shape, s.symmetryMode);
        const mirrored = sym.hasReflection ? mirrorCurveType(curveType) : curveType;
        facesAsked = spatialMorphRenderFacesWanted(plan) && curveType.kind === 'straight' && s.shape === 'square';   // the faces are a square-sheet feature (the net warp is too)
        warpField = !!(hasWarp && activeNetWarp && activeNetWarp.field);
        const noNet = hasWarp && !activeNetWarp;   // no net in force: the polygons are drawn as computed (activeNetWarp stays null)
        const facesDrawn = facesAsked && (noNet || warpField);   // a Single or Tiled net: lines only (status netFacesNeedField)
        const faceSheet = (plan.ids && plan.ids[0] !== 'base') ? { shape: s.shape, symmetryMode: s.symmetryMode, centroid: s.centroid, outerCorners: s.outerCorners, gridMatchesBase: true } : null;   // the field warp in force was built for THIS grid, so its faces are exact
        const faceStats = { tiles: 0, tilesWithFaces: 0, faces: 0 };
        spatialMorphRenderState.faceStats = faceStats;
        // morph stage 006b: the colour fields of the corner keyframes; geo = the corners' own lines (unit weights: the keyframe's lines as the morph draws them at p = 0 / p = 1), for an uncoloured corner
        const unit = [{ w00: 1, w10: 0, w01: 0, w11: 0 }, { w00: 0, w10: 1, w01: 0, w11: 0 }, { w00: 0, w10: 0, w01: 1, w11: 0 }, { w00: 0, w10: 0, w01: 0, w11: 1 }];
        const geoOf = () => ({ s, sheet: faceSheet, lines: unit.map((wk) => prepared.map((pl) => [pl.a, pl.b].map((d) => spatialMorphAnchoredPoint(d, wk, (d.onBoundary && d.moved) ? wk : null, false)))) });
        const cornerFields = facesDrawn ? spatialMorphRenderCornerFields(spatialMorphRenderCornerIds(plan, mode, aligned.keyframeCount), aligned.keyframeCount, mode, geoOf()) : null;

        strokeWeight(2);
        for (let t = 0; t < tiles.length; t++) {
            const tile = tiles[t];
            const axisDir = sym.hasReflection ? (tile.axis || mirrorAxisDir()) : null;
            const wTile = weightsAt(tile.c);
            if (facesDrawn) {
                // the cell's lines in canonical coordinates (the identity operation: symmetry copies are made by computeCellFaces()), behind this tile's lines
                const cellLines = prepared.map((pl) => [pl.a, pl.b].map((d) => {
                    const wEdge = (d.onBoundary && d.moved) ? weightsAt(spatialMorphRenderToWorld(d.sample, tile, sym.ops[0], null)) : null;
                    return spatialMorphAnchoredPoint(d, wTile, wEdge, false);
                }));
                const tileFaces = spatialMorphRenderTileFaces(cellLines, s, faceSheet);
                const n = spatialMorphRenderFillFaces(tileFaces, tile, activeNetWarp, spatialMorphRenderFaceColors(tileFaces, cornerFields, wTile));
                faceStats.tiles++;
                if (n > 0) { faceStats.tilesWithFaces++; faceStats.faces += n; }
            }
            for (let i = 0; i < prepared.length; i++) {
                const pl = prepared[i];
                const id = lineIds[i] || [0, 0];
                for (let k = 0; k < sym.ops.length; k++) {
                    const op = sym.ops[k];
                    const ends = [pl.a, pl.b].map((d) => {
                        const wEdge = (d.onBoundary && d.moved) ? weightsAt(spatialMorphRenderToWorld(d.sample, tile, op, axisDir)) : null;
                        // exactEnds is OFF (stage d2c, measured): with it the endpoint of a boundary endpoint whose keyframe positions are not on one edge jumps from its keyframe position to its projection on the edge as soon as
                        // the front reaches it (up to 200 px between two frames), the front at p = 0.5 differs from the prototype's static blend at the canvas edge and loose line ends appear at intermediate p. Without it the
                        // frames at p = 0 and p = 1 show such endpoints PROJECTED onto the edge, as the prototype's blend does (ROADMAP "Spatial morph: staged plan", stage d2c).
                        return spatialMorphRenderToWorld(spatialMorphAnchoredPoint(d, wTile, wEdge, false), tile, op, axisDir);
                    });
                    started = true;
                    drawCurvedBezier(ends[0], ends[1], op.reflected ? mirrored : curveType, id[0], id[1]);
                }
            }
        }
    } catch (e) {
        spatialMorphRenderSetStatus('renderError', keyframes, mode, progress, segment);
        return started;   // partly drawn: do not draw the normal frame over it
    } finally {
        if (hasWarp) activeNetWarp = prevWarp;
    }
    spatialMorphRenderState.frames++;
    const netOn = typeof netWarpActive === 'function' && netWarpActive();
    spatialMorphRenderSetStatus(netOn ? ((facesAsked && !warpField) ? 'netFacesNeedField' : 'netActive') : (mode === 'bilinear' ? 'bilinearStatic' : 'ok'), keyframes, mode, progress, segment, spatialMorphRenderSeamOpen(plan, s, tiles, sym));
    return true;
}

// The hook. true = the morph frame was drawn (drawTessellation() returns), false = draw the normal frame. Never throws.
function spatialMorphTryDraw() {
    const sm = (typeof spatialMorph !== 'undefined') ? spatialMorph : null;
    if (!sm || sm.enabled !== true) {
        if (spatialMorphRenderState.status.code !== 'off') spatialMorphRenderSetStatus('off', 0, 'linear');
        return false;
    }
    if (typeof svgPathCollector !== 'undefined' && svgPathCollector) return false;   // the SVG export draws the normal pattern
    try {
        if (typeof tileFor !== 'function' || typeof drawCurvedBezier !== 'function' || typeof spatialMorphPlanKeyframes !== 'function' || typeof additionalLayers === 'undefined') {
            spatialMorphRenderSetStatus('renderError', 0, 'linear');
            return false;
        }
        return spatialMorphRenderDraw(sm);
    } catch (e) {
        spatialMorphRenderSetStatus('renderError', 0, 'linear');
        return false;
    }
}
