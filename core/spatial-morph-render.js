/**
 * core/spatial-morph-render.js
 * Morph stage c: the render hook of the static, lines-only spatial morph. core/tiling.js drawTessellation() calls spatialMorphTryDraw() as its FIRST statement (typeof-guarded: a page or test
 * that does not load this file, the gallery and the two protected netwarp tests among them, runs the old code unchanged); when it returns true the frame is the morph and drawTessellation()
 * returns, when it returns false the existing code runs line for line. With the switch off (spatialMorph.enabled !== true, core/state.js) it costs one call per frame and one property read.
 *
 * WHAT IT DRAWS (maintainer decisions): the keyframe layers' lines blended across the tessellation, as the prototype does it - the base sheet, the other layers, the timeline's playback layer,
 * the face fills and the net warp are NOT drawn; the node dots, the net-line overlay and the cross-layer fills that draw() adds after drawTessellation() are untouched. Static: no wave, no
 * phase. A keyframe layer's own offset, rotation and scale are IGNORED (its lines are taken in the sheet's own grid, as resolveConnectionsToCoords() reads them), as in the prototype.
 *
 * HOW (no change to the tile loops): the tile functions of core/tiling.js are called ONCE with an empty layer override while drawShapeCell() is temporarily replaced by a recorder, so the
 * lattice, the tile centres, the flips and the mirror axis are exactly the ones the normal frame uses; the recorder is put back in a finally. The recorded tiles are then drawn here: per
 * tile the a1 weights at the tile centre, the a2 anchored endpoints (a boundary endpoint that slides on a cell edge uses the weights of the shared edge), the symmetry copies in the order of
 * core/symmetry.js drawConnectionWithSymmetry(), through drawCurvedBezier() with the current curve style (so curves, free lines and the line colour / weight are the normal frame's).
 *
 * PRE-CONDITIONS and the STATUS: with the switch on, the morph needs two keyframe layers of the same shape and line count (the timeline's, else the layers in index order, else the base sheet
 * and one layer). If they are not there the normal frame is drawn and spatialMorphStatus().code says why: 'needsTwoKeyframes', 'shapeMismatch', 'lineCountMismatch', 'alignmentFailed'
 * (resolveTimelineKeyframeCoords() refused), 'renderError' (something threw; nothing escapes). 'ok' = drawn, 'netActive' = drawn and a net warp is in force (the morph ignores the net),
 * 'off' = the switch is off. The status is read-only data for the UI of a later stage; this file writes no text. The SVG export (svgPathCollector set) always gets the normal pattern.
 *
 * Depends on (call-time, all optional-checked): core/state.js globals, core/tiling.js tileFor(), core/symmetry.js, core/curves.js, core/spatial-morph.js, and from sketch.js
 * resolveTimelineKeyframeCoords() / resolveConnectionsToCoords(). Every top-level name starts with spatialMorph.
 */

const spatialMorphRenderState = {
    status: { code: 'off', keyframes: 0, mode: 'linear' },
    spanKey: null,
    span: null,
    spanComputes: 0,     // how often the span was (re)computed: the freeze is visible to the tests
    frames: 0,           // morph frames drawn
};

// The status of the last frame (a copy). { code, keyframes, mode }, code one of spatialMorphStatusCodes.
function spatialMorphStatus() {
    const s = spatialMorphRenderState.status;
    return { code: s.code, keyframes: s.keyframes, mode: s.mode };
}

// Forget the frozen span (the key already changes with the lattice, the projection and the canvas; this is for a caller that wants a recompute).
function spatialMorphInvalidateSpan() {
    spatialMorphRenderState.spanKey = null;
    spatialMorphRenderState.span = null;
}

function spatialMorphRenderSetStatus(code, keyframes, mode) {
    const s = spatialMorphRenderState.status;
    s.code = code; s.keyframes = keyframes || 0; s.mode = mode || 'linear';
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

// The tiles the normal frame would draw for the base sheet, in its order: [{ c, flip, rot, axis, shape, mode }]. The recorder replaces drawShapeCell() for the length of the call only.
function spatialMorphRenderRecordTiles() {
    const tiles = [];
    const real = drawShapeCell;
    const emptyLayer = { outerCorners, centroid, connections: [], nodes, offsetX: 0, offsetY: 0, rotation: 0, shape: currentShape, symmetryMode };
    drawShapeCell = function (connSet, tileCentroid, flip180, nodeArr, rotationDeg, mirrorAxisOverride, shapeOverride, symmetryModeOverride) {
        tiles.push({ c: { x: tileCentroid.x, y: tileCentroid.y }, flip: !!flip180, rot: rotationDeg || 0, axis: mirrorAxisOverride, shape: shapeOverride, mode: symmetryModeOverride });
    };
    try { tileFor(currentShape)(null, null, emptyLayer); } finally { drawShapeCell = real; }
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
    const infos = additionalLayers.map((l) => ({ shape: l.shape, lineCount: spatialMorphRenderLineCount(l.connections), isPlayback: !!l.isTimelinePlayback }));
    const base = { shape: currentShape, lineCount: spatialMorphRenderLineCount(connections) };
    const tlIds = (timeline && Array.isArray(timeline.keyframeLayerIds)) ? timeline.keyframeLayerIds : null;
    const plan = spatialMorphPlanKeyframes(infos, { mode, timelineIds: tlIds, base });
    if (!plan.ok) { spatialMorphRenderSetStatus(plan.code, 0, mode); return false; }
    const aligned = spatialMorphRenderAlign(plan, mode, timeline);
    if (!aligned.ok || !spatialMorphValidateCorners(aligned.corners).ok) { spatialMorphRenderSetStatus('alignmentFailed', 0, mode); return false; }

    const tiles = spatialMorphRenderRecordTiles();
    if (tiles.length === 0) { spatialMorphRenderSetStatus('renderError', aligned.keyframeCount, mode); return false; }
    const centroids = tiles.map((t) => t.c);
    const center = { x: canvasW / 2, y: canvasH / 2 };
    const key = spatialMorphSpanKey(mode, angleDeg, currentShape, outerCorners, canvasW, canvasH, centroids);
    const st = spatialMorphRenderState;
    if (st.span === null || st.spanKey !== key) {
        st.span = spatialMorphSpanFromCentroids(mode, centroids, canvasW, canvasH, { angleDeg, center });
        st.spanKey = key;
        st.spanComputes++;
    }
    const span = st.span;
    const opts = { angleDeg, center };
    const prepared = spatialMorphPrepareLines(aligned.corners, outerCorners);
    const lineIds = aligned.lineIds;
    const sym = spatialMorphSymmetryOps(currentShape, symmetryMode);
    const mirrored = sym.hasReflection ? mirrorCurveType(curveType) : curveType;

    let started = false;
    try {
        strokeWeight(2);
        for (let t = 0; t < tiles.length; t++) {
            const tile = tiles[t];
            const axisDir = sym.hasReflection ? (tile.axis || mirrorAxisDir()) : null;
            const wTile = spatialMorphCornerWeights(mode, tile.c, span, opts);
            for (let i = 0; i < prepared.length; i++) {
                const pl = prepared[i];
                const id = lineIds[i] || [0, 0];
                for (let s = 0; s < sym.ops.length; s++) {
                    const op = sym.ops[s];
                    const ends = [pl.a, pl.b].map((d) => {
                        const wEdge = (d.onBoundary && d.moved) ? spatialMorphCornerWeights(mode, spatialMorphRenderToWorld(d.sample, tile, op, axisDir), span, opts) : null;
                        return spatialMorphRenderToWorld(spatialMorphAnchoredPoint(d, wTile, wEdge), tile, op, axisDir);
                    });
                    started = true;
                    drawCurvedBezier(ends[0], ends[1], op.reflected ? mirrored : curveType, id[0], id[1]);
                }
            }
        }
    } catch (e) {
        spatialMorphRenderSetStatus('renderError', aligned.keyframeCount, mode);
        return started;   // partly drawn: do not draw the normal frame over it
    }
    st.frames++;
    spatialMorphRenderSetStatus((typeof netWarpActive === 'function' && netWarpActive()) ? 'netActive' : 'ok', aligned.keyframeCount, mode);
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
