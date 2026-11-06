/**
 * core/spatial-morph-render.js
 * Morph stage c: the render hook of the static, lines-only spatial morph. core/tiling.js drawTessellation() calls spatialMorphTryDraw() as its FIRST statement (typeof-guarded: a page or test
 * that does not load this file, the gallery and the two protected netwarp tests among them, runs the old code unchanged); when it returns true the frame is the morph and drawTessellation()
 * returns, when it returns false the existing code runs line for line. With the switch off (spatialMorph.enabled !== true, core/state.js) it costs one call per frame and one property read.
 *
 * WHAT IT DRAWS (maintainer decisions): the keyframe layers' lines blended across the tessellation, as the prototype does it - the base sheet, the other layers, the timeline's playback layer,
 * the face fills are NOT drawn (faces and colour in the morph: not yet implemented); the net warp IS applied to the lines (see NET WARP below); the node dots, the net-line overlay and the cross-layer fills that draw() adds after drawTessellation() are untouched. No wave.
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
 * (resolveTimelineKeyframeCoords() refused), 'renderError' (something threw; nothing escapes). 'ok' = drawn, 'netActive' = drawn and a net warp is in force (the net warps the LINES: activeNetWarp is set around the draw and restored in the finally; faces and colour are not yet part of the morph),
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

        strokeWeight(2);
        for (let t = 0; t < tiles.length; t++) {
            const tile = tiles[t];
            const axisDir = sym.hasReflection ? (tile.axis || mirrorAxisDir()) : null;
            const wTile = weightsAt(tile.c);
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
    spatialMorphRenderSetStatus((typeof netWarpActive === 'function' && netWarpActive()) ? 'netActive' : (mode === 'bilinear' ? 'bilinearStatic' : 'ok'), keyframes, mode, progress, segment, spatialMorphRenderSeamOpen(plan, s, tiles, sym));
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
