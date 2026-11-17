// Task 085: Netz bei nicht quadratischer Flaeche (X != Y) — Bestand und Messung (Typ R, read-only).
//   node tools/grid/measure-net-format.js   -> JSON summary on stdout
// Measures (without touching any repo file; prototype tests run on in-memory copies in a vm sandbox):
//   1. Current behaviour at X != Y for Single, Tiled, Field, Alt-Net, Timeline net snapshots, Export, and UI sync
//      (including the discrepancy between _netSize() = NaN in netWarpBaseNow() and shapeSizeFactor = min(X,Y) in drawTessellation / export / sketch.js).
//   2. 3(a) Congruence of Single and Tiled across (X, Y) -> (X', Y') transitions (X, Y in 1..9, ratio <= 1:3)
//      for all 3 shapes (as-shipped and with non-square-shape warp copy).
//   3. 3(b) Prototype copy with two field counts (Rt1, Rt2) in netDomainEffective / netFieldLaw / makeNetWarp / closedNetRectCorners:
//      tests where a field E1 x E2 (Rt1 x Rt2) succeeds (exact macro tiles, canvas border [0,W]x[0,H], affine per tile, inverse, faces)
//      and where it breaks (tiling.js closedNetRectCorners scalar f.Rt/f.h, even Rt1/Rt2 half-tile shift & mid-tile kink, triangle/hex X=Y 600px exception,
//      triangle row stagger & hex 4/3 column overlap).
//   4. 3(c) Table of all valid (X, Y) pairs (1..9, ratio <= 1:3, 69 pairs) and which (E1, E2) macro-tile counts give whole macro tiles on W x H per shape.
'use strict';

const path = require('path');
const H = require(path.join(__dirname, '..', 'morph', 'render-harness.js'));
const J = JSON.stringify;

const SHAPES = ['triangle', 'square', 'hex'];
const MODE = 'rotation_reflection6';
const R3 = Math.sqrt(3);

const f6 = (x) => Math.round(x * 1e6) / 1e6;
const f4 = (x) => Math.round(x * 1e4) / 1e4;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

// All valid (X, Y) in 1..9 with max(X, Y) <= 3 * min(X, Y)
const ALL_VALID_XY = [];
for (let x = 1; x <= 9; x++) {
    for (let y = 1; y <= 9; y++) {
        if (Math.max(x, y) <= 3 * Math.min(x, y)) ALL_VALID_XY.push([x, y]);
    }
}

const TRANSITION_PAIRS = [
    [[3, 3], [3, 5]], [[3, 5], [3, 3]],
    [[3, 5], [5, 3]], [[5, 3], [3, 5]],
    [[3, 3], [5, 3]], [[5, 3], [3, 3]],
    [[3, 3], [3, 9]], [[3, 9], [9, 3]],
    [[5, 5], [5, 7]], [[5, 7], [7, 5]],
    [[5, 7], [3, 5]], [[7, 8], [8, 7]],
    [[2, 4], [4, 8]], [[1, 3], [3, 9]],
    [[2, 3], [6, 9]], [[4, 4], [2, 6]]
];

const worlds = {};
function getWorld(shape) {
    if (!worlds[shape]) {
        worlds[shape] = H.makeRenderWorld(shape, 4, 3, MODE);
        worlds[shape].set('var canvasSizeSync = function () { width = canvasW; height = canvasH; };');
    }
    return worlds[shape];
}

function setupWorld(w, shape, ord, lage, X, Y) {
    w.set(`
        currentShape = ${J(shape)};
        projectGridSpec(${J({ shape, ordnung: ord, lage })});
        shapeSizeFactorX = null; shapeSizeFactorY = null;
        canvasW = 600; canvasH = 600; width = 600; height = 600;
        setGridSize(${X}, ${Y});
        symmetryMode = ${J(MODE)};
        connections = []; redoStack = [];
        baseNetTransform = null; baseNetAnimation = null;
        additionalLayers = []; timeline = null; altNetSeed = null;
        activeLayer = 'base';
        baseFaceAssignments = new Map(); baseFacePalette = null; baseFaceAnchor = null;
        baseLastHarmonyType = null; baseLastSelection = null; baseDistributionStrategy = null;
        spatialMorph = { enabled: false, mode: 'linear', angleDeg: 0 };
        rebuildGrid(currentShape);
    `);
}

const segKey = (s) => {
    const r = (v) => Math.round(v * 1000);
    const a = [r(s.x1), r(s.y1)], b = [r(s.x2), r(s.y2)];
    return (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a]).join(';');
};

const mapper = (c1, c2, f) => (p) => ({
    x: c2[0] / 2 + (p.x - c1[0] / 2) * f,
    y: c2[1] / 2 + (p.y - c1[1] / 2) * f
});

function compareFrames(oldSegs, newSegs, map, c1, c2) {
    const newSet = new Set(newSegs.map(segKey));
    let oldInOverlap = 0, matchedInOverlap = 0, maxMinDist = 0;
    for (const s of oldSegs) {
        if (![s.x1, s.x2].every(v => v >= -1e-7 && v <= c1[0] + 1e-7) ||
            ![s.y1, s.y2].every(v => v >= -1e-7 && v <= c1[1] + 1e-7)) continue;
        const p = map({ x: s.x1, y: s.y1 }), q = map({ x: s.x2, y: s.y2 });
        if (![p.x, q.x].every(v => v >= -1e-7 && v <= c2[0] + 1e-7) ||
            ![p.y, q.y].every(v => v >= -1e-7 && v <= c2[1] + 1e-7)) continue;
        oldInOverlap++;
        const m = { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
        if (newSet.has(segKey(m))) {
            matchedInOverlap++;
        } else {
            let best = Infinity;
            for (const ns of newSegs) {
                const d1 = Math.max(Math.hypot(p.x - ns.x1, p.y - ns.y1), Math.hypot(q.x - ns.x2, q.y - ns.y2));
                const d2 = Math.max(Math.hypot(p.x - ns.x2, p.y - ns.y2), Math.hypot(q.x - ns.x1, q.y - ns.y1));
                best = Math.min(best, d1, d2);
            }
            if (best > maxMinDist) maxMinDist = best;
        }
    }
    const mappedAll = oldSegs.map(s => {
        const p = map({ x: s.x1, y: s.y1 }), q = map({ x: s.x2, y: s.y2 });
        return segKey({ x1: p.x, y1: p.y, x2: q.x, y2: q.y });
    });
    const newAll = newSegs.map(segKey);
    const sA = new Set(mappedAll), sB = new Set(newAll);
    const exactFullSet = sA.size === sB.size && [...sA].every(k => sB.has(k));
    return {
        oldCount: oldSegs.length,
        newCount: newSegs.length,
        oldInOverlap,
        matchedInOverlap,
        maxMissPx: f6(maxMinDist),
        exactFullSet
    };
}

const out = {};

// ============================================================================
// 1. IST-ZUSTAND BEI X != Y: Widerspruch zwischen _netSize() (NaN) und shapeSizeFactor (min(X,Y))
// ============================================================================
{
    const w = getWorld('square');
    const istCases = {};
    for (const [X, Y] of [[3, 3], [3, 5], [5, 3], [5, 7], [4, 5], [2, 6]]) {
        setupWorld(w, 'square', 3, 1, X, Y);
        w.set(`
            connections = [[1, 6], [2, 5]];
            showFaces = true;
            baseNetTransform = { x: { kind: 'trig', w: -0.8 }, y: 'same', domain: 'field' };
        `);
        const stateInfo = w.get(`({
            shapeSizeFactor,
            netSizeFactor: netSizeFactor(),
            _netSize: _netSize(),
            netWarpBaseNowDomain: netWarpBaseNow() ? netWarpBaseNow().domain : null,
            netWarpBaseNowField: netWarpBaseNow() ? netWarpBaseNow().field : null,
            netWarpBaseNowIgnored: netWarpBaseNow() ? netWarpBaseNow().domainIgnored : null,
            drawTessWarpDomain: (function () {
                const nw = netWarpForBase(netTransformNow(), currentShape, outerCorners, nodeCount, shapeSizeFactor);
                return nw ? { domain: nw.domain, field: nw.field, ignored: nw.domainIgnored } : null;
            })(),
            exportNetTransform: (function () {
                const ex = netTransformExportData(netTransformNow(), baseGridDivisions(), shapeSizeFactor);
                return { domain: ex.domain, fieldTiles: ex.fieldTiles || null, domainIgnored: ex.domainIgnored || null, facesOmitted: ex.facesOmitted };
            })(),
            facesDetectedCount: computeCellFaces(connections, nodes, null).faces.length,
            netBlocksFaces: netWarpBlocksFaces()
        })`);
        w.set('showFaces = false;');
        const segs = w.frame();
        const mismatch = w.get(`(function () {
            const nwDraw = netWarpForBase(netTransformNow(), currentShape, outerCorners, nodeCount, shapeSizeFactor);
            const nwDots = netWarpBaseNow();
            let maxDiff = 0;
            for (const nd of nodes) {
                const pDraw = nwDraw ? applyNetWarp(nwDraw, nd) : nd;
                const pDot = nwDots ? applyNetWarp(nwDots, nd) : nd;
                maxDiff = Math.max(maxDiff, Math.hypot(pDraw.x - pDot.x, pDraw.y - pDot.y));
            }
            return maxDiff;
        })()`);
        const ys = segs.flatMap(s => [s.y1, s.y2]);
        const xs = segs.flatMap(s => [s.x1, s.x2]);
        istCases[`${X}/${Y}`] = {
            canvas: [w.get('canvasW'), w.get('canvasH')],
            shapeSizeFactor: stateInfo.shapeSizeFactor,
            _netSize: String(stateInfo._netSize),
            netWarpBaseNow_domain: stateInfo.netWarpBaseNowDomain,
            drawTessellation_domain: stateInfo.drawTessWarpDomain.domain,
            drawTessellation_fieldTiles: stateInfo.drawTessWarpDomain.field ? stateInfo.drawTessWarpDomain.field.Rt : null,
            export_domain: stateInfo.exportNetTransform.domain,
            export_fieldTiles: stateInfo.exportNetTransform.fieldTiles,
            facesDetected: stateInfo.facesDetectedCount,
            dotVsLineEndpointMaxDiffPx: f4(mismatch),
            drawnSegments: segs.length,
            drawnSpanX: [f4(Math.min(...xs)), f4(Math.max(...xs))],
            drawnSpanY: [f4(Math.min(...ys)), f4(Math.max(...ys))]
        };
    }
    out.section2_istAtNonSquare = istCases;
}

// ============================================================================
// 2. 3(a): EINZEL (single) UND GEKACHELT (tiled) BEIM WECHSEL (X,Y) -> (X',Y')
// ============================================================================
{
    const specs = {
        single_trig: { x: { kind: 'trig', w: -0.8, focus: 0.25 }, y: { kind: 'trig', w: 0.6, focus: -0.2 }, repeat: false, domain: 'single' },
        single_geo_nested: { x: { kind: 'geometric', w: Math.log(4) }, y: 'same', macro: 3, repeat: false, domain: 'single' },
        tiled_trig: { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.6 }, repeat: true, domain: 'tiled' },
        tiled_geo_alt: { x: { kind: 'geometric', w: Math.log(4), alternate: true }, y: { kind: 'geometric', w: -Math.log(3), alternate: true }, repeat: true, domain: 'tiled' }
    };

    const res3a = {};
    for (const shape of SHAPES) {
        const w = getWorld(shape);
        const shapeSummary = {
            transitionsTested: 0,
            single: { totalSegments: 0, matchedSegments: 0, fullFrameCongruentTransitions: 0, maxMissPx: 0 },
            tiled: {
                overlapSegments: 0,
                overlapMatched: 0,
                sameAspectTransitions: 0,
                sameAspectFullCongruent: 0,
                diffAspectTransitions: 0,
                diffAspectFullCongruent: 0,
                maxMissPx: 0
            },
            examples: {}
        };
        for (const [specName, spec] of Object.entries(specs)) {
            const isSingle = spec.domain === 'single';
            for (const [[X1, Y1], [X2, Y2]] of TRANSITION_PAIRS) {
                setupWorld(w, shape, 3, 1, X1, Y1);
                const conns = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 3)');
                w.set(`connections = ${J(conns)}; baseNetTransform = ${J(spec)};`);
                const c1 = w.get('[canvasW, canvasH]');
                const f0 = w.frame();
                const f = Math.min(X1, Y1) / Math.min(X2, Y2);
                w.get(`resizeBase(${X2}, ${Y2})`);
                const c2 = w.get('[canvasW, canvasH]');
                const f1 = w.frame();
                const cmp = compareFrames(f0, f1, mapper(c1, c2, f), c1, c2);
                shapeSummary.transitionsTested++;
                if (isSingle) {
                    shapeSummary.single.totalSegments += cmp.oldCount;
                    shapeSummary.single.matchedSegments += cmp.matchedInOverlap;
                    if (cmp.exactFullSet && cmp.oldCount === cmp.newCount) shapeSummary.single.fullFrameCongruentTransitions++;
                    shapeSummary.single.maxMissPx = Math.max(shapeSummary.single.maxMissPx, cmp.maxMissPx);
                } else {
                    shapeSummary.tiled.overlapSegments += cmp.oldInOverlap;
                    shapeSummary.tiled.overlapMatched += cmp.matchedInOverlap;
                    shapeSummary.tiled.maxMissPx = Math.max(shapeSummary.tiled.maxMissPx, cmp.maxMissPx);
                    const sameAspect = X1 * Y2 === X2 * Y1;
                    if (sameAspect) {
                        shapeSummary.tiled.sameAspectTransitions++;
                        if (cmp.exactFullSet) shapeSummary.tiled.sameAspectFullCongruent++;
                    } else {
                        shapeSummary.tiled.diffAspectTransitions++;
                        if (cmp.exactFullSet) shapeSummary.tiled.diffAspectFullCongruent++;
                    }
                }
                if (specName === 'single_trig' || specName === 'tiled_geo_alt') {
                    const key = `${specName}:${X1}/${Y1}->${X2}/${Y2}`;
                    if (['3/3->3/5', '3/5->5/3', '2/3->6/9', '1/3->3/9'].includes(`${X1}/${Y1}->${X2}/${Y2}`)) {
                        shapeSummary.examples[key] = cmp;
                    }
                }
            }
        }
        res3a[shape] = shapeSummary;
    }
    out.section3a_singleAndTiled = res3a;
}

// ============================================================================
// 3. 3(b): FELD MIT ZWEI WERTEN (Rt1, Rt2) IN EINER IN-MEMORY-KOPIE
// ============================================================================
{
    const patchNetwarp2D = `
        function _normRt2(Rt) {
            if (Array.isArray(Rt)) return [Rt[0], Rt[1]];
            return [Rt, Rt];
        }
        function netDomainEffective2D(spec, Rt, allowEven) {
            const legacy = spec && spec.repeat ? 'tiled' : 'single';
            const req = spec ? spec.domain : undefined;
            if (req === undefined || req === null) return { domain: legacy, ignored: null };
            if (req === 'single' || req === 'tiled') return { domain: req, ignored: null };
            const [Rx, Ry] = _normRt2(Rt);
            let reason = null;
            if (req !== 'field') reason = 'unknown domain';
            else if (!Number.isInteger(Rx) || !Number.isInteger(Ry)) reason = 'non-integer (Rx, Ry)';
            else if (Rx < 3 || Ry < 3) reason = 'Rx < 3 or Ry < 3 (trig law has no effect on 1 or 2 macro cells)';
            else if (!allowEven && (Rx % 2 === 0 || Ry % 2 === 0)) reason = 'Rx or Ry is even (central tile would not sit on integer tile grid)';
            else if (Rx > 9 || Ry > 9) reason = 'Rx or Ry > 9';
            if (reason) return { domain: legacy, ignored: { requested: req, reason } };
            return { domain: 'field', ignored: null, Rx, Ry };
        }
        function makeNetWarp2D(spec, frame, E, Rt, opts) {
            if (!spec || !frame) return null;
            const allowEven = !!(opts && opts.allowEven);
            const scalarMode = opts && opts.scalarRtMode;
            const dom = netDomainEffective2D(spec, Rt, allowEven);
            const [Rx, Ry] = _normRt2(Rt);
            const ax = spec.x, ay = spec.y === 'same' ? spec.x : spec.y;
            const isField = dom.domain === 'field';
            const fx = isField ? netFieldLaw(ax, Rx) : netAxisLaw(ax, E, spec.macro);
            const fy = isField ? netFieldLaw(ay, Ry) : netAxisLaw(ay, E, spec.macro);
            if (!fx && !fy && !spec.keep) return null;
            const { c0, v1, v2 } = frame;
            const det = v1.x * v2.y - v2.x * v1.y;
            if (!det) return null;
            const hx = (Rx - 1) / 2, hy = (Ry - 1) / 2;
            const scalarRt = scalarMode === 'max' ? Math.max(Rx, Ry) : Math.min(Rx, Ry);
            const scalarH = (scalarRt - 1) / 2;
            return {
                fx, fy,
                altX: !isField && !!(ax && ax.alternate),
                altY: !isField && !!(ay && ay.alternate),
                repeat: dom.domain === 'tiled',
                domain: dom.domain,
                field: isField ? { Rt: scalarRt, h: scalarH, Rx, Ry, hx, hy } : null,
                domainIgnored: dom.ignored,
                c0, v1, v2, det
            };
        }
        applyNetWarp = function(warp, pt) {
            const dx = pt.x - warp.c0.x, dy = pt.y - warp.c0.y;
            const s = (dx * warp.v2.y - dy * warp.v2.x) / warp.det;
            const t = (warp.v1.x * dy - warp.v1.y * dx) / warp.det;
            let x = pt.x, y = pt.y;
            if (warp.field) {
                const hx = warp.field.hx !== undefined ? warp.field.hx : warp.field.h;
                const hy = warp.field.hy !== undefined ? warp.field.hy : warp.field.h;
                if (warp.fx) { const d = warp.fx(s + hx) - hx - s; x += d * warp.v1.x; y += d * warp.v1.y; }
                if (warp.fy) { const d = warp.fy(t + hy) - hy - t; x += d * warp.v2.x; y += d * warp.v2.y; }
                return { x, y };
            }
            if (warp.fx) { const d = _netWarpAxis(warp.fx, warp.altX, s) - s; x += d * warp.v1.x; y += d * warp.v1.y; }
            if (warp.fy) { const d = _netWarpAxis(warp.fy, warp.altY, t) - t; x += d * warp.v2.x; y += d * warp.v2.y; }
            return { x, y };
        };
        invertNetWarp = function(warp, pt) {
            const dx = pt.x - warp.c0.x, dy = pt.y - warp.c0.y;
            const s = (dx * warp.v2.y - dy * warp.v2.x) / warp.det;
            const t = (warp.v1.x * dy - warp.v1.y * dx) / warp.det;
            let x = pt.x, y = pt.y;
            if (warp.field) {
                const hx = warp.field.hx !== undefined ? warp.field.hx : warp.field.h;
                const hy = warp.field.hy !== undefined ? warp.field.hy : warp.field.h;
                if (warp.fx) { const d = _netFieldAxisInverse(warp.fx, s, hx) - s; x += d * warp.v1.x; y += d * warp.v1.y; }
                if (warp.fy) { const d = _netFieldAxisInverse(warp.fy, t, hy) - t; x += d * warp.v2.x; y += d * warp.v2.y; }
                return { x, y };
            }
            if (warp.fx) { const d = _netWarpAxisInverse(warp.fx, warp.altX, s) - s; x += d * warp.v1.x; y += d * warp.v1.y; }
            if (warp.fy) { const d = _netWarpAxisInverse(warp.fy, warp.altY, t) - t; x += d * warp.v2.x; y += d * warp.v2.y; }
            return { x, y };
        };
        netWarpInsideNet = function(warp, pt) {
            const c = netWarpTileCoords(warp, pt);
            if (warp.field) {
                const hx = warp.field.hx !== undefined ? warp.field.hx : warp.field.h;
                const hy = warp.field.hy !== undefined ? warp.field.hy : warp.field.h;
                return c.s >= -hx && c.s <= hx + 1 && c.t >= -hy && c.t <= hy + 1;
            }
            return c.s >= 0 && c.s <= 1 && c.t >= 0 && c.t <= 1;
        };
        netWarpSplitSegment = function(warp, p1, p2) {
            if (!warp || !warp.field) return null;
            const a = netWarpTileCoords(warp, p1), b = netWarpTileCoords(warp, p2), EPS = 1e-9, ts = [];
            const hx = warp.field.hx !== undefined ? warp.field.hx : warp.field.h;
            const hy = warp.field.hy !== undefined ? warp.field.hy : warp.field.h;
            const axis = (u0, u1, law, hAxis) => {
                if (!law) return;
                const lo = Math.min(u0, u1), hi = Math.max(u0, u1);
                for (let k = Math.max(-hAxis + 1, Math.floor(lo)); k <= Math.min(hAxis, Math.ceil(hi)); k++) {
                    if (lo < k - EPS && hi > k + EPS) ts.push((k - u0) / (u1 - u0));
                }
            };
            axis(a.s, b.s, warp.fx, hx); axis(a.t, b.t, warp.fy, hy);
            if (!ts.length) return null;
            ts.sort((x, y) => x - y);
            const pts = [p1];
            ts.forEach((t, i) => { if (i === 0 || t - ts[i - 1] > 1e-12) pts.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }); });
            pts.push(p2);
            return pts;
        };
    `;

    function makeProtoWorld(patchTilingRect) {
        const w = H.makeRenderWorld('square', 4, 3, MODE);
        w.set('var canvasSizeSync = function () { width = canvasW; height = canvasH; };');
        w.set(patchNetwarp2D);
        if (patchTilingRect) {
            w.set(`
                closedNetRectCorners = function() {
                    const f = activeNetWarp.field;
                    const hx = f && f.hx !== undefined ? f.hx : (f ? f.h : 0);
                    const hy = f && f.hy !== undefined ? f.hy : (f ? f.h : 0);
                    const Rx = f && f.Rx !== undefined ? f.Rx : (f ? f.Rt : 1);
                    const Ry = f && f.Ry !== undefined ? f.Ry : (f ? f.Rt : 1);
                    const { c0, v1, v2 } = f
                        ? {
                            c0: {
                                x: activeNetWarp.c0.x - hx * activeNetWarp.v1.x - hy * activeNetWarp.v2.x,
                                y: activeNetWarp.c0.y - hx * activeNetWarp.v1.y - hy * activeNetWarp.v2.y
                            },
                            v1: { x: Rx * activeNetWarp.v1.x, y: Rx * activeNetWarp.v1.y },
                            v2: { x: Ry * activeNetWarp.v2.x, y: Ry * activeNetWarp.v2.y }
                        }
                        : activeNetWarp;
                    const m = maxLayerOffset();
                    const pts = [c0, { x: c0.x + v1.x, y: c0.y + v1.y }, { x: c0.x + v1.x + v2.x, y: c0.y + v1.y + v2.y }, { x: c0.x + v2.x, y: c0.y + v2.y }];
                    const cx = (pts[0].x + pts[2].x) / 2, cy = (pts[0].y + pts[2].y) / 2, EPS = 1e-6;
                    return pts.map(p => {
                        const ux = Math.sign(p.x - cx), uy = Math.sign(p.y - cy), len = Math.hypot(p.x - cx, p.y - cy) || 1;
                        return { x: p.x - (p.x - cx) / len * EPS + ux * m.x, y: p.y - (p.y - cy) / len * EPS + uy * m.y };
                    });
                };
            `);
        }
        return w;
    }

    const oddPairs = [
        [3, 5], [5, 3], [3, 7], [7, 3], [3, 9], [9, 3],
        [5, 7], [7, 5], [5, 9], [9, 5], [7, 9], [9, 7]
    ];
    const spec2D = { x: { kind: 'trig', w: -0.9 }, y: { kind: 'trig', w: 0.7 }, domain: 'field' };
    const sqOddResults = {};
    const wUnpatched = makeProtoWorld(false);
    const wPatched = makeProtoWorld(true);

    for (const [X, Y] of oddPairs) {
        const runOn = (w, scalarMode) => {
            setupWorld(w, 'square', 3, 1, X, Y);
            w.set(`connections = [[1, 6], [2, 5], [5, 11]]; showFaces = false; baseNetTransform = ${J(spec2D)};`);
            return w.get(`(function() {
                const spec = ${J(spec2D)}, X = ${X}, Y = ${Y}, scalarMode = ${J(scalarMode)};
                const c0 = outerCorners[0], c1 = outerCorners[1], c3 = outerCorners[3];
                const frame = { c0, v1: { x: c1.x - c0.x, y: c1.y - c0.y }, v2: { x: c3.x - c0.x, y: c3.y - c0.y } };
                const warp = makeNetWarp2D(spec, frame, 3, [X, Y], { scalarRtMode: scalarMode });
                const oldNow = netWarpBaseNow;
                netWarpBaseNow = () => warp;
                let tileCalls = 0;
                const origCell = drawShapeCell;
                drawShapeCell = function(...a) { tileCalls++; return origCell.apply(this, a); };
                const segs = [];
                segmentCollector = segs;
                activeNetWarp = warp;
                try { _drawTessellationCore(); } finally {
                    activeNetWarp = null;
                    segmentCollector = null;
                    drawShapeCell = origCell;
                    netWarpBaseNow = oldNow;
                }
                const xs = segs.flatMap(s => [s.x1, s.x2]), ys = segs.flatMap(s => [s.y1, s.y2]);
                const outsideLines = segs.filter(s =>
                    s.x1 < -1e-6 || s.x2 < -1e-6 || s.x1 > canvasW + 1e-6 || s.x2 > canvasW + 1e-6 ||
                    s.y1 < -1e-6 || s.y2 < -1e-6 || s.y1 > canvasH + 1e-6 || s.y2 > canvasH + 1e-6
                ).length;
                let maxInvErr = 0;
                for (let ix = 0; ix <= 10; ix++) for (let iy = 0; iy <= 10; iy++) {
                    const pt = { x: (ix / 10) * canvasW, y: (iy / 10) * canvasH };
                    const back = applyNetWarp(warp, invertNetWarp(warp, pt));
                    maxInvErr = Math.max(maxInvErr, Math.hypot(pt.x - back.x, pt.y - back.y));
                }
                const e = 600 / Math.min(X, Y);
                const Px = warp.fx.field.P, Py = warp.fy.field.P;
                const b0 = applyNetWarp(warp, { x: 0, y: 0 }), b1 = applyNetWarp(warp, { x: canvasW, y: canvasH });
                const borderErr = Math.max(Math.hypot(b0.x, b0.y), Math.hypot(b1.x - canvasW, b1.y - canvasH));
                const ctr = { x: canvasW / 2, y: canvasH / 2 };
                let maxMirrorErr = 0, maxRot180Err = 0, maxRot90Diff = 0;
                const symWarp = makeNetWarp2D({ x: { kind: 'trig', w: -0.8 }, y: 'same', domain: 'field' }, frame, 3, [X, Y]);
                for (let ix = 1; ix <= 5; ix++) for (let iy = 1; iy <= 5; iy++) {
                    const p = { x: (ix / 6) * canvasW, y: (iy / 6) * canvasH };
                    const wp = applyNetWarp(symWarp, p);
                    const mx = applyNetWarp(symWarp, { x: 2 * ctr.x - p.x, y: p.y });
                    const my = applyNetWarp(symWarp, { x: p.x, y: 2 * ctr.y - p.y });
                    const r180 = applyNetWarp(symWarp, { x: 2 * ctr.x - p.x, y: 2 * ctr.y - p.y });
                    maxMirrorErr = Math.max(maxMirrorErr, Math.hypot(mx.x - (2 * ctr.x - wp.x), mx.y - wp.y), Math.hypot(my.x - wp.x, my.y - (2 * ctr.y - wp.y)));
                    maxRot180Err = Math.max(maxRot180Err, Math.hypot(r180.x - (2 * ctr.x - wp.x), r180.y - (2 * ctr.y - wp.y)));
                    const r90a = applyNetWarp(symWarp, rotateAround(p, ctr, 90));
                    const r90b = rotateAround(wp, ctr, 90);
                    maxRot90Diff = Math.max(maxRot90Diff, Math.hypot(r90a.x - r90b.x, r90a.y - r90b.y));
                }
                const f4 = v => Math.round(v * 1e4) / 1e4;
                const f6 = v => Math.round(v * 1e6) / 1e6;
                return {
                    canvas: [canvasW, canvasH],
                    expectedTiles: X * Y,
                    drawnTiles: tileCalls,
                    outsideLines,
                    spanX: [f4(Math.min(...xs)), f4(Math.max(...xs))],
                    spanY: [f4(Math.min(...ys)), f4(Math.max(...ys))],
                    maxInvErrPx: f6(maxInvErr),
                    borderCornerErrPx: f6(borderErr),
                    maxMirrorErrPx: f6(maxMirrorErr),
                    maxRot180ErrPx: f6(maxRot180Err),
                    maxRot90DiffPx: f4(maxRot90Diff),
                    macroWidthsX: Px.slice(1).map((v, i) => f4((v - Px[i]) * e)),
                    macroWidthsY: Py.slice(1).map((v, i) => f4((v - Py[i]) * e))
                };
            })()`);
        };

        sqOddResults[`${X}x${Y}`] = {
            unpatchedTiling_minRt: runOn(wUnpatched, 'min'),
            unpatchedTiling_maxRt: runOn(wUnpatched, 'max'),
            patchedTiling_RxRy: runOn(wPatched, 'min')
        };
    }

    // 3(b).2: What breaks on Square when Rt1 or Rt2 is EVEN (e.g. 4x5, 2x3, 4x6, 6x5)?
    const sqEvenResults = {};
    for (const [X, Y] of [[4, 5], [2, 3], [4, 6], [6, 5]]) {
        setupWorld(wPatched, 'square', 3, 1, X, Y);
        sqEvenResults[`${X}x${Y}`] = wPatched.get(`(function() {
            const X = ${X}, Y = ${Y}, spec = ${J(spec2D)};
            const c0 = outerCorners[0], c1 = outerCorners[1], c3 = outerCorners[3];
            const frame = { c0, v1: { x: c1.x - c0.x, y: c1.y - c0.y }, v2: { x: c3.x - c0.x, y: c3.y - c0.y } };
            const warp = makeNetWarp2D(spec, frame, 3, [X, Y], { allowEven: true });
        const p0 = applyNetWarp(warp, c0);
            const p2 = applyNetWarp(warp, outerCorners[2]);
            const pMid = applyNetWarp(warp, centroid);
            const chordMid = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
            const midTileKinkPx = Math.hypot(pMid.x - chordMid.x, pMid.y - chordMid.y);
            // Neighbor tile i = -1 (s in [-1, 0], crossing sigma = 1 when X = 4, hx = 1.5 -> s = -0.5)
            const n0 = { x: c0.x - frame.v1.x, y: c0.y };
            const n2 = { x: c1.x - frame.v1.x, y: c3.y };
            const nMid = { x: (n0.x + n2.x) / 2, y: (n0.y + n2.y) / 2 };
            const wn0 = applyNetWarp(warp, n0), wn2 = applyNetWarp(warp, n2), wnMid = applyNetWarp(warp, nMid);
            const midTileKinkNeighborPx = Math.hypot(wnMid.x - (wn0.x + wn2.x) / 2, wnMid.y - (wn0.y + wn2.y) / 2);
            // Geometric law on central tile [0, 1] when X is even
            const warpGeo = makeNetWarp2D({ x: { kind: 'geometric', w: Math.log(4) }, y: 'same', domain: 'field' }, frame, 3, [X, Y], { allowEven: true });
            const gp0 = applyNetWarp(warpGeo, c0), gp2 = applyNetWarp(warpGeo, outerCorners[2]), gpMid = applyNetWarp(warpGeo, centroid);
            const midTileKinkGeoCentralPx = Math.hypot(gpMid.x - (gp0.x + gp2.x) / 2, gpMid.y - (gp0.y + gp2.y) / 2);
            const b = latticeIJBoundsCovering(frame.v1, frame.v2, centroid, [
                { x: 1e-6, y: 1e-6 }, { x: canvasW - 1e-6, y: 1e-6 },
                { x: canvasW - 1e-6, y: canvasH - 1e-6 }, { x: 1e-6, y: canvasH - 1e-6 }
            ]);
            return {
                hx: (X - 1) / 2,
                hy: (Y - 1) / 2,
                centralTileSpanInCanvasUnits: {
                    x: [c0.x / frame.v1.x, c1.x / frame.v1.x],
                    y: [c0.y / frame.v2.y, c3.y / frame.v2.y]
                },
                tilesIntersectingCanvas: [b.iMax - b.iMin + 1, b.jMax - b.jMin + 1],
                midTileKinkInCentralTileSymTrigPx: Math.round(midTileKinkPx * 1e4) / 1e4,
                midTileKinkInNeighborTileSymTrigPx: Math.round(midTileKinkNeighborPx * 1e4) / 1e4,
                midTileKinkInCentralTileGeoPx: Math.round(midTileKinkGeoCentralPx * 1e4) / 1e4
            };
        })()`);
    }

    // 3(b).3: What happens on Triangle and Hex when applying a 2D Field warp (Rt1, Rt2)?
    const triHexResults = {};
    for (const shape of ['triangle', 'hex']) {
        triHexResults[shape] = {};
        for (const [X, Y] of [[3, 3], [3, 5], [5, 3], [5, 7]]) {
            setupWorld(wPatched, shape, 3, 1, X, Y);
            triHexResults[shape][`${X}x${Y}`] = wPatched.get(`(function() {
                const shape = ${J(shape)}, X = ${X}, Y = ${Y}, spec = ${J(spec2D)}, R3 = Math.sqrt(3);
                const W = canvasW, H = canvasH;
                const e = 600 / Math.min(X, Y);
                const stepX = shape === 'hex' ? (R3 / 2) * e : e;
                const stepY = shape === 'triangle' ? (R3 / 2) * e : e;
                const c0Ortho = { x: W / 2 - stepX / 2, y: H / 2 - stepY / 2 };
                const frameOrtho = { c0: c0Ortho, v1: { x: stepX, y: 0 }, v2: { x: 0, y: stepY } };
                const warpOrtho = makeNetWarp2D(spec, frameOrtho, 3, [X, Y]);
                const mw = getMeshWidth();
                const c0Para = shape === 'triangle' ? outerCorners[1] : outerCorners[0];
                const hx = (X - 1) / 2, hy = (Y - 1) / 2;
                const orthoCorners = [
                    { x: c0Ortho.x - hx * stepX, y: c0Ortho.y - hy * stepY },
                    { x: c0Ortho.x + (hx + 1) * stepX, y: c0Ortho.y + (hy + 1) * stepY }
                ];
                const paraCorners = [
                    { x: c0Para.x - hx * mw.v1.x - hy * mw.v2.x, y: c0Para.y - hx * mw.v1.y - hy * mw.v2.y },
                    { x: c0Para.x + (hx + 1) * mw.v1.x - hy * mw.v2.x, y: c0Para.y + (hx + 1) * mw.v1.y - hy * mw.v2.y },
                    { x: c0Para.x + (hx + 1) * mw.v1.x + (hy + 1) * mw.v2.x, y: c0Para.y + (hx + 1) * mw.v1.y + (hy + 1) * mw.v2.y },
                    { x: c0Para.x - hx * mw.v1.x + (hy + 1) * mw.v2.x, y: c0Para.y - hx * mw.v1.y + (hy + 1) * mw.v2.y }
                ];
                const oc = outerCorners;
                const sSpanCentral = oc.map(p => (p.x - c0Ortho.x) / stepX);
                const tSpanCentral = oc.map(p => (p.y - c0Ortho.y) / stepY);
                const centralCrossesKinkX = Math.floor(Math.min(...sSpanCentral) + 1e-9) !== Math.floor(Math.max(...sSpanCentral) - 1e-9);
                const centralCrossesKinkY = Math.floor(Math.min(...tSpanCentral) + 1e-9) !== Math.floor(Math.max(...tSpanCentral) - 1e-9);
                const shiftStagger = shape === 'triangle' ? { x: mw.v2.x, y: mw.v2.y } : { x: mw.v1.x, y: mw.v1.y };
                const sSpanStagger = oc.map(p => (p.x + shiftStagger.x - c0Ortho.x) / stepX);
                const tSpanStagger = oc.map(p => (p.y + shiftStagger.y - c0Ortho.y) / stepY);
                const staggerCrossesKinkX = Math.floor(Math.min(...sSpanStagger) + 1e-9) !== Math.floor(Math.max(...sSpanStagger) - 1e-9);
                const staggerCrossesKinkY = Math.floor(Math.min(...tSpanStagger) + 1e-9) !== Math.floor(Math.max(...tSpanStagger) - 1e-9);
                const edgeP1 = { x: oc[1].x + shiftStagger.x, y: oc[1].y + shiftStagger.y };
                const edgeP2 = { x: oc[2].x + shiftStagger.x, y: oc[2].y + shiftStagger.y };
                const edgeMid = { x: (edgeP1.x + edgeP2.x) / 2, y: (edgeP1.y + edgeP2.y) / 2 };
                const wP1 = applyNetWarp(warpOrtho, edgeP1);
                const wP2 = applyNetWarp(warpOrtho, edgeP2);
                const wMid = applyNetWarp(warpOrtho, edgeMid);
                const staggerEdgeKinkPx = Math.hypot(wMid.x - (wP1.x + wP2.x) / 2, wMid.y - (wP1.y + wP2.y) / 2);
                const f4 = v => Math.round(v * 1e4) / 1e4;
                return {
                    canvas: [f4(W), f4(H)],
                    canvasInSteps: [f4(W / stepX), f4(H / stepY)],
                    orthoFieldRect: [
                        [f4(orthoCorners[0].x), f4(orthoCorners[0].y)],
                        [f4(orthoCorners[1].x), f4(orthoCorners[1].y)]
                    ],
                    orthoMatchesCanvasExactly: Math.abs(orthoCorners[0].x) < 1e-6 && Math.abs(orthoCorners[0].y) < 1e-6 && Math.abs(orthoCorners[1].x - W) < 1e-6 && Math.abs(orthoCorners[1].y - H) < 1e-6,
                    paraFieldXRange: [f4(Math.min(...paraCorners.map(p => p.x))), f4(Math.max(...paraCorners.map(p => p.x)))],
                    paraFieldYRange: [f4(Math.min(...paraCorners.map(p => p.y))), f4(Math.max(...paraCorners.map(p => p.y)))],
                    centralTileSRange: [f4(Math.min(...sSpanCentral)), f4(Math.max(...sSpanCentral))],
                    centralTileTRange: [f4(Math.min(...tSpanCentral)), f4(Math.max(...tSpanCentral))],
                    centralCrossesMacroBoundary: centralCrossesKinkX || centralCrossesKinkY,
                    staggeredCopyCrossesMacroBoundary: staggerCrossesKinkX || staggerCrossesKinkY,
                    staggeredEdgeKinkPx: f4(staggerEdgeKinkPx)
                };
            })()`);
        }
    }

    out.section3b_fieldPrototype = {
        squareOddPairs: sqOddResults,
        squareEvenPairs: sqEvenResults,
        triangleAndHex: triHexResults
    };
}

// ============================================================================
// 4. 3(c): WELCHE (E1, E2) SIND JE FORM BEI WELCHEM (X, Y) SINNVOLL?
// ============================================================================
{
    const oddDivisorsGe3 = (n) => {
        const d = [];
        for (let k = 3; k <= n; k += 2) if (n % k === 0) d.push(k);
        return d;
    };
    const allDivisorsGe2 = (n) => {
        const d = [];
        for (let k = 2; k <= n; k++) if (n % k === 0) d.push(k);
        return d;
    };

    const summaryByShape = {};
    for (const shape of SHAPES) {
        const w = getWorld(shape);
        const rows = [];
        let exactStepPairs = 0, centeredWholeMacroPairs = 0;
        for (const [X, Y] of ALL_VALID_XY) {
            setupWorld(w, shape, 3, 1, X, Y);
            const W = w.get('canvasW'), H = w.get('canvasH');
            const e = 600 / Math.min(X, Y);
            const stepX = shape === 'hex' ? (R3 / 2) * e : e;
            const stepY = shape === 'triangle' ? (R3 / 2) * e : e;
            const stepsW = W / stepX, stepsH = H / stepY;
            const intStepsW = Math.abs(stepsW - Math.round(stepsW)) < 1e-6;
            const intStepsH = Math.abs(stepsH - Math.round(stepsH)) < 1e-6;
            const oddX = X % 2 === 1 && X >= 3;
            const oddY = Y % 2 === 1 && Y >= 3;
            if (intStepsW && intStepsH) exactStepPairs++;
            const e1Odd = intStepsW && oddX ? oddDivisorsGe3(X) : [];
            const e2Odd = intStepsH && oddY ? oddDivisorsGe3(Y) : [];
            const wholeCentered = e1Odd.length > 0 && e2Odd.length > 0 && shape === 'square';
            if (wholeCentered) centeredWholeMacroPairs++;
            rows.push({
                xy: `${X}/${Y}`,
                W: f4(W),
                H: f4(H),
                steps: [f4(stepsW), f4(stepsH)],
                intSteps: intStepsW && intStepsH,
                oddXYGe3: oddX && oddY,
                oddE1Options: e1Odd,
                oddE2Options: e2Odd,
                allGeoDivisorsE1: intStepsW ? allDivisorsGe2(X) : [],
                allGeoDivisorsE2: intStepsH ? allDivisorsGe2(Y) : []
            });
        }
        summaryByShape[shape] = {
            totalValidXY: ALL_VALID_XY.length,
            exactStepPairs,
            oddGe3WithExactSteps: rows.filter(r => r.intSteps && r.oddXYGe3).map(r => r.xy),
            sampleRows: rows.filter(r => ['3/3', '3/5', '5/3', '3/7', '7/3', '3/9', '9/3', '5/5', '5/7', '7/5', '5/9', '9/5', '7/7', '7/9', '9/7', '9/9', '2/6', '4/4', '4/6', '7/8'].includes(r.xy))
        };
    }
    out.section3c_meaningfulE1E2 = summaryByShape;
}

process.stdout.write(J(out, null, 2) + '\n');
