// Task 082: Farbfehler beim Groessenwechsel (X, Y) -> (X', Y') — Messung (Typ R, read-only).
//   node tools/grid/measure-color-resize.js   -> JSON summary on stdout
// Measures:
//   1. 3 shapes (triangle, square, hex) x ordnung 2..4 x lage 1/2 x 5 line sets (sym, ring, rnd1, rnd2, rnd3; fixed seed),
//      real palette assignment (every trail gets a unique non-gray color).
//   2. 14 size pairs (28 directed transitions): X=Y (3<->5, 5<->7, 3<->7) and X!=Y (3/5, 5/3, 5/7, 7/8, 8/7, 3/9, 9/3) back and forth.
//   3. Per transition and per shape: kept color share (via scaled interior point, no re-assignment) and classification of every deviation into:
//      (a) face set differs (vanished, merged/split, or newly created; with old/new face counts),
//      (b) face present (1-to-1 geometry, same face count), but wrong color assigned (0.01 px faceTrailKey rounding split or collinear zero-area spike jump),
//      (c) other (_mapTrailKeys boxes.find without area-sorting on nested disjoint components).
//   4. Numeric proof of the causes of (a) in core/faces.js (FACE_EPSILON = 0.5 px in snapOrCreateNode/_nearestInBuckets, collinear denom ~ 0 in segmentIntersection/splitSegments, atan2 tie in _buildFaceAdjacency).
'use strict';
const path = require('path');
const H = require(path.join(__dirname, '..', 'morph', 'render-harness.js'));
const J = JSON.stringify;

const SHAPES = ['triangle', 'square', 'hex'];
const ORDNUNGEN = [2, 3, 4];
const LAGEN = [1, 2];
const MODE = 'rotation_reflection6';

const SIZES = [
    [3, 3], [5, 5], [7, 7],
    [3, 5], [5, 3], [5, 7],
    [7, 8], [8, 7], [3, 9], [9, 3]
];

const PAIRS_UNDIRECTED = [
    [[3, 3], [5, 5]], [[5, 5], [7, 7]], [[3, 3], [7, 7]],
    [[3, 3], [3, 5]], [[3, 3], [5, 3]], [[3, 5], [5, 3]],
    [[5, 5], [5, 7]], [[3, 5], [5, 7]],
    [[7, 7], [7, 8]], [[7, 7], [8, 7]], [[7, 8], [8, 7]],
    [[3, 3], [3, 9]], [[3, 3], [9, 3]], [[3, 9], [9, 3]]
];
const PAIRS = [];
for (const [a, b] of PAIRS_UNDIRECTED) PAIRS.push([a, b], [b, a]);

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        let t = (a += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function inPoly(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        if ((poly[i].y > pt.y) !== (poly[j].y > pt.y) &&
            pt.x < ((poly[j].x - poly[i].x) * (pt.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) c = !c;
    }
    return c;
}

// Known concentric disjoint ring pairs for class (c) + general symmetric ring/chord fallback
const CONCENTRIC_RINGS = {
    'triangle/3/2': [[1, 10], [17, 18]],
    'triangle/4/1': [[1, 11], [5, 8]],
    'square/2/2': [[1, 2], [10, 11]],
    'square/3/1': [[1, 4], [6, 7]],
    'square/4/1': [[1, 11], [12, 18]],
    'hex/2/1': [[1, 12], [13, 14]]
};

function buildLineSetsForConfig(w, shape, ord, lage) {
    w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: ord, lage })}); setGridSize(3, 3); symmetryMode = ${J(MODE)};`);
    const orbits = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
    const seen = new Set();
    const sets = [];
    const addSet = (name, conns) => {
        const key = conns.map(c => c.join('-')).slice().sort().join(';');
        seen.add(key);
        sets.push({ name, conns });
    };

    // 1. Canonical symmetric pattern: first 4 orbits
    addSet('sym', orbits.slice(0, Math.min(4, orbits.length)));

    // 2. Symmetric ring / nested pattern (or alternate symmetric subset when small)
    const ringKey = `${shape}/${ord}/${lage}`;
    if (CONCENTRIC_RINGS[ringKey]) {
        addSet('ring', CONCENTRIC_RINGS[ringKey]);
    } else if (orbits.length >= 6) {
        addSet('ring', [orbits[0], orbits[2], orbits[4], orbits[5]]);
    } else {
        addSet('ring', orbits.slice(0, Math.min(2, orbits.length)));
    }

    // 3..5. Three seeded random line sets with >= 1 face at 3/3
    const rng = mulberry32(shape.charCodeAt(0) * 1000 + ord * 100 + lage * 10 + 42);
    for (let s = 1; s <= 3; s++) {
        let chosen = null;
        for (let tries = 0; tries < 80; tries++) {
            const k = orbits.length <= 4 ? Math.max(2, (s % 3) + 2) : 4;
            const picked = [], used = new Set();
            while (picked.length < Math.min(k, orbits.length)) {
                const idx = Math.floor(rng() * orbits.length);
                if (!used.has(idx)) { used.add(idx); picked.push(orbits[idx]); }
            }
            const key = picked.map(c => c.join('-')).slice().sort().join(';');
            if (seen.has(key) && orbits.length > 4) continue;
            w.set(`connections = ${J(picked)};`);
            const fc = w.get('computeCellFaces(connections, nodes, null).faces.length');
            if (fc > 0) { chosen = picked; break; }
        }
        if (!chosen) chosen = orbits.slice(0, Math.min(3, orbits.length));
        addSet('rnd' + s, chosen);
    }
    return sets;
}

const worlds = {};
function W(shape) {
    if (!worlds[shape]) {
        worlds[shape] = H.makeRenderWorld(shape, 3, 3, MODE);
        worlds[shape].set('var canvasSizeSync = function () { width = canvasW; height = canvasH; };');
    }
    return worlds[shape];
}

const byShape = {};
const byShapeAndPair = {};
const faceCountDiffExamples = [];
const classExamples = { a: [], b: [], c: [] };

for (const shape of SHAPES) {
    const w = W(shape);
    byShape[shape] = {
        patterns: 0, transitions: 0, transitionsWithDiffFaceCount: 0, transitionsWithColorError: 0,
        oldFacesTotal: 0, keptFaces: 0,
        classA_total: 0, classA_vanished: 0, classA_mergedOrSplit: 0, classA_newlyCreated: 0,
        classB_total: 0, classB_round100: 0, classB_collinearSpike: 0,
        classC_total: 0
    };
    byShapeAndPair[shape] = {};
    for (const [p1, p2] of PAIRS) {
        const pk = `${p1[0]}/${p1[1]}->${p2[0]}/${p2[1]}`;
        byShapeAndPair[shape][pk] = {
            transitions: 0, diffFaceCountTransitions: 0,
            oldFaces: 0, keptFaces: 0,
            classA: 0, classA_newCreated: 0, classB: 0, classC: 0,
            sampleFaceCountChange: null
        };
    }

    for (const lage of LAGEN) {
        for (const ord of ORDNUNGEN) {
            const lineSets = buildLineSetsForConfig(w, shape, ord, lage);
            for (const ls of lineSets) {
                byShape[shape].patterns++;
                // Precompute snapshot at each of the 10 sizes
                const snapBySize = {};
                for (const [X, Y] of SIZES) {
                    const sk = `${X}/${Y}`;
                    w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: ord, lage })}); setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = ${J(ls.conns)};`);
                    snapBySize[sk] = w.get(`(function () {
                        const r = computeCellFaces(connections, nodes, null);
                        const g = sheetGroupElements(nodes, null);
                        const keys = r.faces.length ? computeFaceTrailKeys(r, g) : [];
                        const trails = r.faces.length ? computeFaceTrails(r, g) : [];
                        const snap = r.faces.length ? faceTrailSnapshot(r, g, keys) : null;
                        return { w: canvasW, h: canvasH, faceCount: r.faces.length, trailCount: trails.length, keys, trails, snap };
                    })()`);
                }

                for (const [[X1, Y1], [X2, Y2]] of PAIRS) {
                    const k1 = `${X1}/${Y1}`, k2 = `${X2}/${Y2}`, pk = `${k1}->${k2}`;
                    const s1 = snapBySize[k1], s2 = snapBySize[k2];
                    if (!s1.faceCount) continue;

                    byShape[shape].transitions++;
                    const pairRec = byShapeAndPair[shape][pk];
                    pairRec.transitions++;

                    if (s1.faceCount !== s2.faceCount) {
                        byShape[shape].transitionsWithDiffFaceCount++;
                        pairRec.diffFaceCountTransitions++;
                        if (!pairRec.sampleFaceCountChange) {
                            pairRec.sampleFaceCountChange = `${ord}/${lage}/${ls.name}: ${s1.faceCount}->${s2.faceCount}`;
                        }
                        if (faceCountDiffExamples.filter(e => e.shape === shape).length < 6) {
                            faceCountDiffExamples.push({
                                shape, ord, lage, pattern: ls.name, conns: ls.conns,
                                from: k1, to: k2, facesOld: s1.faceCount, facesNew: s2.faceCount,
                                trailsOld: s1.trailCount, trailsNew: s2.trailCount
                            });
                        }
                    }

                    const f = Math.min(X1, Y1) / Math.min(X2, Y2);
                    const scale = (p) => ({ x: s2.w / 2 + (p.x - s1.w / 2) * f, y: s2.h / 2 + (p.y - s1.h / 2) * f });

                    // Run the exact _mapTrailKeys of core/state.js
                    w.sb.__s1 = s1.snap; w.sb.__s2 = s2.snap; w.sb.__sc = scale;
                    const keyMap = w.get('_mapTrailKeys(__s1, __s2, __sc)');

                    // Unique palette assignment per trail in s1
                    const oldTrailColor = new Map();
                    s1.trails.forEach((t, idx) => oldTrailColor.set(t.key, 'C' + idx));
                    const newTrailColor = new Map();
                    for (const [ok, nk] of keyMap.entries()) {
                        if (oldTrailColor.has(ok) && !newTrailColor.has(nk)) {
                            newTrailColor.set(nk, oldTrailColor.get(ok));
                        }
                    }

                    // Sort s2 faces by area ascending so nested inner components match their true smallest polygon
                    const newFacesSorted = s2.snap
                        ? s2.snap.faces.map((nf, idx) => ({
                            nf, idx,
                            x0: Math.min(...nf.poly.map(p => p.x)), x1: Math.max(...nf.poly.map(p => p.x)),
                            y0: Math.min(...nf.poly.map(p => p.y)), y1: Math.max(...nf.poly.map(p => p.y))
                        })).sort((a, b) => a.nf.area - b.nf.area)
                        : [];

                    const hitNewFaceIndices = new Set();
                    let hadColorError = false;

                    s1.snap.faces.forEach((of, oIdx) => {
                        byShape[shape].oldFacesTotal++;
                        pairRec.oldFaces++;
                        const pt = of.samples[0];
                        const p = scale(pt);
                        const allHits = newFacesSorted.filter(b => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1 && inPoly(p, b.nf.poly));
                        const hit = allHits[0] || null;
                        if (hit) hitNewFaceIndices.add(hit.idx);

                        const oldCol = oldTrailColor.get(of.key);
                        const newCol = hit ? (newTrailColor.get(hit.nf.key) || 'GRAY') : 'NONE';
                        const areaRatio = hit ? (hit.nf.area / (of.area * f * f)) : 0;
                        const geomPreserved = !!hit && Math.abs(areaRatio - 1) <= 0.02;

                        if (geomPreserved && oldCol === newCol) {
                            byShape[shape].keptFaces++;
                            pairRec.keptFaces++;
                            return;
                        }

                        hadColorError = true;
                        const detail = {
                            shape, ord, lage, pattern: ls.name, conns: ls.conns,
                            from: k1, to: k2,
                            facesOld: s1.faceCount, facesNew: s2.faceCount,
                            trailsOld: s1.trailCount, trailsNew: s2.trailCount,
                            oldFaceIdx: oIdx, newFaceIdx: hit ? hit.idx : null,
                            posOld: [Math.round(pt.x * 10) / 10, Math.round(pt.y * 10) / 10],
                            posNew: [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10],
                            areaOldScaled: Math.round(of.area * f * f * 10) / 10,
                            areaNew: hit ? Math.round(hit.nf.area * 10) / 10 : 0,
                            verticesOld: of.poly.length, verticesNew: hit ? hit.nf.poly.length : 0,
                            oldColor: oldCol, newColor: newCol,
                            oldKeyHead: of.key.slice(0, 48),
                            newKeyHead: hit ? hit.nf.key.slice(0, 48) : null
                        };

                        if (!hit) {
                            byShape[shape].classA_total++;
                            byShape[shape].classA_vanished++;
                            pairRec.classA++;
                            if (classExamples.a.length < 8) classExamples.a.push(Object.assign({ sub: 'entfaellt' }, detail));
                        } else if (!geomPreserved || s1.faceCount !== s2.faceCount) {
                            byShape[shape].classA_total++;
                            byShape[shape].classA_mergedOrSplit++;
                            pairRec.classA++;
                            if (classExamples.a.length < 8) classExamples.a.push(Object.assign({ sub: !geomPreserved ? 'verschmilzt_oder_teilt' : 'flaechenmenge_geaendert' }, detail));
                        } else if (allHits.length > 1) {
                            // Nested disjoint component where _mapTrailKeys boxes.find hit the outer enclosing polygon first
                            byShape[shape].classC_total++;
                            pairRec.classC++;
                            if (classExamples.c.length < 8) classExamples.c.push(Object.assign({ sub: 'verschachtelte_komponente_boxes_find' }, detail));
                        } else {
                            byShape[shape].classB_total++;
                            pairRec.classB++;
                            if (of.poly.length === hit.nf.poly.length && s1.trailCount !== s2.trailCount) {
                                byShape[shape].classB_round100++;
                                if (classExamples.b.length < 8) classExamples.b.push(Object.assign({ sub: 'rundung_0.01px_faceTrailKey' }, detail));
                            } else {
                                byShape[shape].classB_collinearSpike++;
                                if (classExamples.b.length < 8) classExamples.b.push(Object.assign({ sub: 'kollinearer_dorn_oder_schluesselwechsel' }, detail));
                            }
                        }
                    });

                    // Newly created faces in s2 that no scaled old face interior point hit
                    const newCreated = s2.faceCount - hitNewFaceIndices.size;
                    if (newCreated > 0 && s2.faceCount > s1.faceCount) {
                        byShape[shape].classA_newlyCreated += newCreated;
                        pairRec.classA_newCreated += newCreated;
                    }
                    if (hadColorError) byShape[shape].transitionsWithColorError++;
                }
            }
        }
    }
}

// ---- 4. Numeric proofs of cause (a) in core/faces.js ----
const causeProofs = {};
{
    // Proof 1: FACE_EPSILON = 0.5 px in snapOrCreateNode / _nearestInBuckets on hex ord=4 lage=1 sym
    const wHex = W('hex');
    const hexProof = {};
    for (const [X, Y] of [[3, 3], [3, 5], [5, 3], [4, 4], [5, 5], [5, 7], [7, 7]]) {
        wHex.set(`currentShape = 'hex'; projectGridSpec({ shape: 'hex', ordnung: 4, lage: 1 }); setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 4);`);
        const info = wHex.get(`(function () {
            const ded = dedupeSegments(collectCellSegments(connections, nodes, null));
            const sp = splitSegments(ded, nodes);
            const r = computeCellFaces(connections, nodes, null);
            let minD = Infinity;
            for (let i = 0; i < sp.nodes.length; i++) {
                for (let j = i + 1; j < sp.nodes.length; j++) {
                    const d = Math.hypot(sp.nodes[i].x - sp.nodes[j].x, sp.nodes[i].y - sp.nodes[j].y);
                    if (d < minD) minD = d;
                }
            }
            return { e: Math.round(gridEdge(${X}, ${Y}) * 10) / 10, splitNodes: sp.nodes.length, splitEdges: sp.edges.length, faces: r.faces.length, minSplitNodeDistPx: Math.round(minD * 10000) / 10000 };
        })()`);
        hexProof[`${X}/${Y}`] = info;
    }
    causeProofs.hex_ord4_lage1_epsilon = hexProof;

    // Proof 2: Collinear segments (denom ~ 0 in segmentIntersection) + atan2 tie in _buildFaceAdjacency on triangle ord=3 lage=1 sym
    const wTri = W('triangle');
    const triProof = {};
    for (const [X, Y] of [[3, 3], [3, 5], [5, 3], [5, 5], [7, 7], [7, 8], [3, 9], [9, 3]]) {
        wTri.set(`currentShape = 'triangle'; projectGridSpec({ shape: 'triangle', ordnung: 3, lage: 1 }); setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 4);`);
        const info = wTri.get(`(function () {
            const ded = dedupeSegments(collectCellSegments(connections, nodes, null));
            const sp = splitSegments(ded, nodes);
            const adj = _buildFaceAdjacency(sp.nodes, sp.edges);
            const r = computeCellFaces(connections, nodes, null);
            return {
                canvas: [ Math.round(canvasW * 10) / 10, Math.round(canvasH * 10) / 10 ],
                e: Math.round(gridEdge(${X}, ${Y}) * 10) / 10,
                splitNodes: sp.nodes.length, splitEdges: sp.edges.length,
                faces: r.faces.length,
                node1NeighborsAt60Deg: adj['1'].filter(x => Math.abs(x.angleDeg - 60) < 1e-9).map(x => ({ id: x.neighborId, angleDeg: x.angleDeg })),
                node10NeighborsAt240Deg: adj['10'].filter(x => Math.abs(x.angleDeg - 240) < 1e-9).map(x => ({ id: x.neighborId, angleDeg: x.angleDeg }))
            };
        })()`);
        triProof[`${X}/${Y}`] = info;
    }
    causeProofs.triangle_ord3_lage1_collinear = triProof;
}

const out = { byShape, byShapeAndPair, faceCountDiffExamples, classExamples, causeProofs };
process.stdout.write(J(out, null, 2) + '\n');
