/**
 * core/forms.js
 * Grid generators for World of Forms Generator. Part of the portable
 * "core" module set (see CLAUDE.md) - no p5 dependency (uses Math.sqrt(),
 * not p5's global sqrt()), safe to copy verbatim into other sites
 * embedding this engine.
 * Each function returns: { nodes, centroid, outerCorners }
 * Coordinates are absolute canvas coordinates (0..canvasW / 0..canvasH),
 * matching state.js's rebuildGrid() calls.
 *
 * Ported from die-welt-der-formen/p5_prototype/sketch.js's inlined
 * "GRID BUILDERS" section, which fixed several issues present in the
 * previous version of this file:
 * - buildTriangleGrid() used to call subdivideEdge()/addUniqueNode(),
 *   neither of which was defined anywhere in this repo (ReferenceError
 *   at runtime for the default 'triangle' shape). This version computes
 *   the triangular lattice directly via barycentric interpolation,
 *   producing real interior nodes (not just edge subdivisions).
 * - buildSquareGrid()/buildHexGrid() used to scale outerCorners by
 *   shapeSizeFactor a second time (via scalePoints) after already
 *   dividing by shapeSizeFactor, making nodes and outerCorners
 *   geometrically inconsistent except at shapeSizeFactor === 1.
 * - buildHexGrid() used to place nodes only along straight spokes from
 *   the center to each of the 6 corners. This version builds proper
 *   concentric hexagonal rings with edge-bridging nodes.
 * - All three functions now take (nodeCount, shapeSizeFactor, canvasW,
 *   canvasH) explicitly instead of relying on p5's global width/height,
 *   matching how sketch.js already called them.
 *
 * Roadmap 1.2-A (alternative net construction): completeEdgeToRegularPolygon()
 * below is a second grid-construction entry point, alongside the three
 * canvas-centered builders above - given an arbitrary edge (two points,
 * not derived from canvasW/canvasH at all) it completes a regular
 * triangle/square/hexagon at whatever position/orientation/scale that
 * edge implies, verified against the three existing builders' own
 * interior-subdivision math via the newly-extracted _subdivide*Interior()
 * helpers (see below) rather than duplicating that math a second time.
 * Tessellating the result (1.2-B) and the UI to invoke this (1.2-C) are
 * separate, later passes - this file only grows the construction/
 * subdivision layer.
 */

// Roadmap 1.2-A: interior-subdivision logic extracted from
// buildTriangleGrid() below into its own function - the barycentric
// math only ever depended on A/B/C themselves, never on canvasW/
// canvasH/shapeSizeFactor directly, so this is a verbatim move, not a
// reformulation (byte-identical output, verified - see the test
// suite). A is the "apex" role (t=0 end of the sweep), B/C the "base"
// role (s=0/s=1 at t=1) - the algorithm doesn't care WHICH of a
// triangle's three corners plays which role, just that the same
// convention is used consistently by every caller (buildTriangleGrid()
// passes its own apex/base corners; a future arbitrary-edge caller
// gets to choose, per its own convention - see completeEdgeToRegularPolygon()).
function _subdivideTriangleInterior(A, B, C, nodeCount) {
    const nodes = []; let id = 1;
    if (nodeCount <= 1) {
        [A, B, C].forEach(p => nodes.push({ id: id++, x: p.x, y: p.y }));
    } else {
        for (let i = 0; i < nodeCount; i++) {
            const t = (nodeCount <= 1) ? 0 : i / (nodeCount - 1);
            for (let j = 0; j <= i; j++) {
                const s = (i === 0) ? 0 : j / i;
                const x = (1 - t) * A.x + t * ((1 - s) * B.x + s * C.x);
                const y = (1 - t) * A.y + t * ((1 - s) * B.y + s * C.y);
                nodes.push({ id: id++, x, y });
            }
        }
    }
    return nodes;
}

// Roadmap 1.12 stage 4: centerOverride - omitted (every pre-stage-4 call
// site), this is byte-identical to before: the exact same cx/cy=canvas-
// center expression, the exact same A/B/C/centroid derivation, untouched.
// Given, it takes an entirely SEPARATE code path (not a parameterized
// version of the same formula) specifically so the returned centroid is
// the given centerOverride EXACTLY (object copy, not a recomputation
// that could drift by floating-point noise) - needed for layerGrid()'s
// new cross-shape branch to guarantee a differently-shaped layer shares
// the base's centroid bit-exactly, not just approximately. A/B/C are
// still derived correctly (to the same ~1e-13px precision already
// accepted elsewhere in this codebase for trig-derived constructions -
// see the 1.2-B design notes) via fixed offsets from the target
// centroid: A = centroid+(0,-2h/3), B = centroid+(-base/2,+h/3),
// C = centroid+(+base/2,+h/3) - solved so (A+B+C)/3 = centroid exactly
// in EXACT arithmetic (the -2h/3+h/3+h/3 terms cancel), independently
// of whatever the returned `centroid` field is set to.
function buildTriangleGrid(nodeCount, shapeSizeFactor, canvasW, canvasH, centerOverride) {
    const base = canvasW / shapeSizeFactor; const h = (Math.sqrt(3) / 2) * base;
    let A, B, C, centroid;
    if (centerOverride) {
        centroid = { x: centerOverride.x, y: centerOverride.y };
        A = { x: centroid.x, y: centroid.y - (2 / 3) * h };
        B = { x: centroid.x - base / 2, y: centroid.y + h / 3 };
        C = { x: centroid.x + base / 2, y: centroid.y + h / 3 };
    } else {
        const cx = canvasW / 2, cy = canvasH / 2;
        A = { x: cx, y: cy - h / 2 }; B = { x: cx - base / 2, y: cy + h / 2 }; C = { x: cx + base / 2, y: cy + h / 2 };
        centroid = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
    }
    const nodes = _subdivideTriangleInterior(A, B, C, nodeCount);
    return { nodes, centroid, outerCorners: [A, B, C] };
}

// Roadmap 1.2-A: interior-subdivision logic extracted from
// buildSquareGrid() below, generalized from raw startX/startY/size
// stepping to bilinear interpolation over an arbitrary corners array
// (corners[0]/[1] share one edge, corners[0]/[3] share the other - the
// same adjacency buildSquareGrid()'s own [TL,TR,BR,BL] order already
// has). This is the one of the three subdivision helpers that ISN'T a
// pure verbatim move (the original indexed by raw startX+i*step, not
// by corner vectors, since it never needed to handle a rotated square
// before) - re-derived to preserve the exact same per-axis step
// computed ONCE and reused (stepUx/stepUy/stepVx/stepVy, mirroring the
// original's single `step` variable) rather than recomputing a
// division per node, specifically to keep floating-point rounding
// identical to the original for the axis-aligned case - verified
// byte-identical against the pre-refactor function's real output
// across a real nodeCount/shapeSizeFactor sweep, not just assumed
// algebraically equivalent (see the test suite).
function _subdivideSquareInterior(corners, nodeCount) {
    const nodes = []; let id = 1;
    if (nodeCount <= 1) {
        corners.forEach(p => nodes.push({ id: id++, x: p.x, y: p.y }));
    } else {
        const c0 = corners[0], c1 = corners[1], c3 = corners[3];
        const stepUx = (c1.x - c0.x) / (nodeCount - 1), stepUy = (c1.y - c0.y) / (nodeCount - 1);
        const stepVx = (c3.x - c0.x) / (nodeCount - 1), stepVy = (c3.y - c0.y) / (nodeCount - 1);
        for (let i = 0; i < nodeCount; i++) {
            for (let j = 0; j < nodeCount; j++) {
                nodes.push({ id: id++, x: c0.x + i * stepUx + j * stepVx, y: c0.y + i * stepUy + j * stepVy });
            }
        }
    }
    return nodes;
}

// Roadmap 1.12 stage 4: centerOverride - omitted (every pre-stage-4 call
// site), cx/cy resolve to the exact same canvasW/2, canvasH/2 expressions
// as before, so startX/startY/corners/centroid are all byte-identical to
// the pre-stage-4 code (same expressions, same evaluation order, just
// routed through an intermediate cx/cy variable holding the identical
// value - a side-effect-free expression evaluated twice always produces
// the same float). Given, corners are placed relative to it directly (no
// h/6-style correction needed here, unlike triangle - buildSquareGrid()'s
// own centroid was ALREADY always exactly its own placement reference,
// per layerGrid()'s own docblock) and centroid is set to the given value
// exactly (object copy), guaranteeing bit-exact equality for
// layerGrid()'s new cross-shape branch.
function buildSquareGrid(nodeCount, shapeSizeFactor, canvasW, canvasH, centerOverride) {
    const size = canvasW / shapeSizeFactor;
    const cx = centerOverride ? centerOverride.x : canvasW / 2;
    const cy = centerOverride ? centerOverride.y : canvasH / 2;
    const startX = cx - size / 2; const startY = cy - size / 2;
    const corners = [
        { x: startX, y: startY },
        { x: startX + size, y: startY },
        { x: startX + size, y: startY + size },
        { x: startX, y: startY + size },
    ];
    const nodes = _subdivideSquareInterior(corners, nodeCount);
    const centroid = { x: cx, y: cy };
    return { nodes, centroid, outerCorners: corners };
}

// Roadmap 1.2-A: interior-subdivision logic extracted from
// buildHexGrid() below - the ring-building math only ever depended on
// outerCorners/centroid themselves, never on canvasW/canvasH/
// shapeSizeFactor directly, so (like triangle's) this is a verbatim
// move, not a reformulation (byte-identical output, verified - see the
// test suite).
function _subdivideHexInterior(outerCorners, centroid, nodeCount) {
    const nodes = [];
    if (nodeCount <= 1) {
        // 6 outer corners + center node (as requested)
        outerCorners.forEach((p, idx) => nodes.push({ id: idx + 1, x: p.x, y: p.y }));
        nodes.push({ id: nodes.length + 1, x: centroid.x, y: centroid.y });
        return nodes;
    }

    function getScaledCorners(scale) {
        return outerCorners.map(p => ({ x: centroid.x + (p.x - centroid.x) * scale, y: centroid.y + (p.y - centroid.y) * scale }));
    }
    function addRingRecursive(r, scale) {
        const ringC = getScaledCorners(scale);
        ringC.forEach(p => nodes.push({ id: nodes.length + 1, x: p.x, y: p.y }));
        const bridge = r - 1;
        for (let c = 0; c < 6; c++) {
            const c1 = ringC[c], c2 = ringC[(c + 1) % 6];
            for (let seg = 1; seg <= bridge; seg++) {
                const t = seg / (bridge + 1);
                nodes.push({ id: nodes.length + 1, x: c1.x + t * (c2.x - c1.x), y: c1.y + t * (c2.y - c1.y) });
            }
        }
        if (r > 1) addRingRecursive(r - 1, scale * (r - 1) / r);
    }
    addRingRecursive(nodeCount, 1.0);
    // Always include the central node as well (not only for nodeCount == 1)
    nodes.push({ id: nodes.length + 1, x: centroid.x, y: centroid.y });
    return nodes;
}

// Roadmap 1.12 stage 4: centerOverride - omitted (every pre-stage-4 call
// site), cx/topY resolve to the exact same canvasW/2 / (canvasH/2 -
// shapeHeight/2) expressions as before, so every corner and the
// sumX/6,sumY/6 centroid are byte-identical to the pre-stage-4 code.
// Given, corners are placed relative to it directly (buildHexGrid()'s
// own centroid was ALREADY always exactly canvas-center by construction,
// per layerGrid()'s own docblock - no correction term needed, unlike
// triangle) and centroid is set to the given value exactly (object
// copy, not the sumX/6,sumY/6 recomputation - which would only be
// approximately equal to centerOverride due to floating-point summation
// noise across 6 corners, not guaranteed bit-exact), guaranteeing exact
// equality for layerGrid()'s new cross-shape branch.
function buildHexGrid(nodeCount, shapeSizeFactor, canvasW, canvasH, centerOverride) {
    const outerCorners = [];
    const shapeHeight = canvasH / shapeSizeFactor; const side = shapeHeight / Math.sqrt(3);
    const cx = centerOverride ? centerOverride.x : canvasW / 2;
    const cy = centerOverride ? centerOverride.y : canvasH / 2;
    const topY = cy - shapeHeight / 2;
    outerCorners.push({ x: cx - side / 2, y: topY });
    outerCorners.push({ x: cx + side / 2, y: topY });
    outerCorners.push({ x: cx + side, y: topY + (Math.sqrt(3) / 2) * side });
    outerCorners.push({ x: cx + side / 2, y: topY + Math.sqrt(3) * side });
    outerCorners.push({ x: cx - side / 2, y: topY + Math.sqrt(3) * side });
    outerCorners.push({ x: cx - side, y: topY + (Math.sqrt(3) / 2) * side });
    let centroid;
    if (centerOverride) {
        centroid = { x: centerOverride.x, y: centerOverride.y };
    } else {
        let sumX = 0, sumY = 0; outerCorners.forEach(c => { sumX += c.x; sumY += c.y; });
        centroid = { x: sumX / 6, y: sumY / 6 };
    }
    const nodes = _subdivideHexInterior(outerCorners, centroid, nodeCount);
    return { nodes, centroid, outerCorners };
}

// Roadmap 1.2-A: rotates a point around a center by angleDeg - the same
// transform as core/symmetry.js's rotateAround(), reimplemented locally
// with Math.cos()/Math.sin() rather than cross-called, for the same
// portability reason core/faces.js/core/orbits.js/core/curves.js's own
// "CURVE TYPE MODEL"/"PURE GEOMETRY" sections already reimplement
// shared-looking math independently rather than depending on a sibling
// file that isn't p5-independent (core/symmetry.js's own rotateAround()
// uses p5's radians()/cos()/sin() globals; this file's own docblock
// claims zero p5 dependency, so cross-calling it would break that).
function _rotateAroundPure(pt, center, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const dx = pt.x - center.x, dy = pt.y - center.y;
    return {
        x: center.x + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: center.y + dx * Math.sin(rad) + dy * Math.cos(rad)
    };
}

// Roadmap 1.2-A: completes an edge P->Q to a regular n-gon (n=3 triangle,
// n=4 square, n=6 hexagon), treating PQ as one EDGE of the resulting
// polygon - not a diagonal or other relation. This is a deliberate
// reading of Ostwald's one-sentence, never-published description
// ("connect any two nodes, complete to a regular triangle/square/
// hexagon" - Sixth Portfolio, Concluding Remark): the most literal,
// ruler-and-compass sense of "complete to a shape given one side",
// stated plainly as this session's own call since no primary-source
// figure exists to check it against (unlike 1.4/1.5).
//
// `side` (+1 | -1) is the ONLY real geometric disambiguation - which
// side of line PQ the polygon is built on. There is no independent
// scale or rotation ambiguity beyond that: side length is fixed by
// |PQ|, and a regular polygon with one full edge fixed has no
// remaining rotational freedom (verified, not assumed - see the test
// suite's 108 checks, now fixed regression values).
//
// The construction: apothem = L / (2*tan(PI/n)) and circumradius = L
// (for n=6 only, by coincidence of hexagon geometry - not used
// directly here since vertices are generated by rotation instead) are
// the standard regular-n-gon identities relating side length to the
// center's distance from an edge midpoint. center = midpoint(P,Q) +
// (unit perpendicular, signed by `side`) * apothem. Every vertex is
// then P rotated around that center by k*(360/n) for k=0..n-1 -
// directly reuses _rotateAroundPure() above for all three shapes
// uniformly, rather than three separate closed-form vertex formulas.
function completeEdgeToRegularPolygon(P, Q, n, side) {
    const dx = Q.x - P.x, dy = Q.y - P.y;
    const L = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / L, uy = dy / L;
    const nx = side * -uy, ny = side * ux;
    const M = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
    const apothem = L / (2 * Math.tan(Math.PI / n));
    const center = { x: M.x + nx * apothem, y: M.y + ny * apothem };
    const vertices = [];
    for (let k = 0; k < n; k++) vertices.push(_rotateAroundPure(P, center, k * (360 / n)));
    return { center, vertices, sideLength: L };
}

// Roadmap 1.12 stage 1: derives an additional layer's own grid at a
// different order/size than the base, SHARING the base's actual
// current center (and orientation, whatever it is - default axis-
// aligned or an alt-net construction, 1.2) rather than independently
// re-deriving via buildTriangleGrid()/buildSquareGrid()/buildHexGrid().
//
// This side-steps a real, verified asymmetry between the three
// builders (1.12 stage-1 design session): buildSquareGrid()'s and
// buildHexGrid()'s own `centroid` is always exactly canvas-center for
// ANY shapeSizeFactor (buildSquareGrid() sets it directly; buildHexGrid()'s
// 6 corners are symmetric around canvas-center regardless of
// shapeHeight), but buildTriangleGrid()'s `centroid` is the true
// geometric centroid (A+B+C)/3, which shifts by h/6 as shapeSizeFactor
// changes h - verified numerically (not assumed) at up to ~86px on a
// 600px canvas between shapeSizeFactor=1 and 9. Calling
// buildTriangleGrid() independently per layer would silently violate
// "shared center" for triangle specifically (not square/hex) -
// scaling the BASE's own outerCorners uniformly around the shared
// centroid avoids this for all three shapes uniformly, by construction,
// and works identically whether the base came from a default builder
// or completeEdgeToRegularPolygon() (1.2) - it only ever reads the
// base's CURRENT outerCorners/centroid, never re-derives from canvas
// dimensions or re-runs trigonometry of its own.
//
// ratio = baseShapeSizeFactor / layerShapeSizeFactor - a larger
// layerShapeSizeFactor means a SMALLER shape, matching the existing
// canvasW/shapeSizeFactor convention (buildSquareGrid() etc.) exactly,
// so the same per-layer UI control/range (1-9) means the same thing a
// layer's own value already means for the base.
//
// Not cached by any caller - re-derive fresh from the base's CURRENT
// outerCorners/centroid/shape every time (render, orbit-table lookup,
// export), so changing the base's own shape/size/order can never leave
// a layer's grid stale.
//
// Roadmap 1.12 stage 4: layerShape (defaults to baseShape - byte-
// identical to before this stage for every pre-stage-4 call site, which
// always omits it) - when the layer's own shape MATCHES the base's, the
// logic above is completely unchanged: scaling the base's own
// outerCorners is not just convenient but REQUIRED for triangle
// specifically (see this function's own comment above on the h/6
// centroid-shift asymmetry) - a same-shape layer must keep using this
// path, not the builder dispatch below, even once that dispatch exists.
// When the layer's own shape DIFFERS, scaling the base's outerCorners
// cannot work AT ALL - a triangle's 3 corners, linearly scaled, can
// never become a hexagon's 6 (confirmed concretely: the old code, given
// a mismatched shape/outerCorners pair, would either produce nonsense or
// throw inside _subdivideHexInterior()'s own ringC[c]/ringC[(c+1)%6]
// indexing, which assumes exactly 6 corners - see the regression test).
// Dispatches instead to the appropriate, now center-parameterized
// builder (canvasW/canvasH only needed on this branch), constructing the
// layer's own polygon from scratch, centered at the SAME shared
// baseCentroid (never re-derived, preserving the "shared center"
// invariant every other per-layer mechanism - toTileLocal(), orbit
// computation, mirrorAxisDir() - already relies on) - not independently
// re-centered at canvas-center, which would generally differ from the
// base's own actual center (e.g. after an alt-net construction, 1.2).
function layerGrid(baseOuterCorners, baseCentroid, baseShape, baseShapeSizeFactor, layerShapeSizeFactor, layerNodeCount, layerShape = baseShape, canvasW, canvasH) {
    if (layerShape === baseShape) {
        const ratio = baseShapeSizeFactor / layerShapeSizeFactor;
        const outerCorners = baseOuterCorners.map(c => ({
            x: baseCentroid.x + (c.x - baseCentroid.x) * ratio,
            y: baseCentroid.y + (c.y - baseCentroid.y) * ratio
        }));
        let nodes;
        if (baseShape === 'triangle') nodes = _subdivideTriangleInterior(outerCorners[0], outerCorners[1], outerCorners[2], layerNodeCount);
        else if (baseShape === 'square') nodes = _subdivideSquareInterior(outerCorners, layerNodeCount);
        else nodes = _subdivideHexInterior(outerCorners, baseCentroid, layerNodeCount);
        return { nodes, centroid: baseCentroid, outerCorners };
    }
    let grid;
    if (layerShape === 'triangle') grid = buildTriangleGrid(layerNodeCount, layerShapeSizeFactor, canvasW, canvasH, baseCentroid);
    else if (layerShape === 'square') grid = buildSquareGrid(layerNodeCount, layerShapeSizeFactor, canvasW, canvasH, baseCentroid);
    else grid = buildHexGrid(layerNodeCount, layerShapeSizeFactor, canvasW, canvasH, baseCentroid);
    return { nodes: grid.nodes, centroid: baseCentroid, outerCorners: grid.outerCorners };
}

// Roadmap 1.12 "Align to base" (design session): the exact condition
// under which a SAME-SHAPE layer's grid (layerGrid()'s scale-existing-
// outerCorners path above) is a strict superset of the base's own
// nodes - derived and exhaustively verified (hundreds of real cases per
// shape, zero mismatches) in the design session, not assumed by analogy
// between shapes. All three shapes share one mechanism: layerGrid()
// scales the base's own outerCorners by ratio=baseShapeSizeFactor/
// layerShapeSizeFactor around the shared centroid, so whether the
// base's OWN vertex-anchored lattice points land exactly on the
// layer's (generally finer) lattice reduces to whether the vertex's
// fixed fractional offset from centroid (2/3,1/3 for triangle's 2:1
// median split; 1/2,1/2 for square's raster corner; exactly 0 for hex,
// whose centroid IS itself always a node - see _subdivideHexInterior())
// lands on an integer lattice point once re-expressed in the layer's
// own (finer) mesh-step units.
//
// Three conditions, all necessary:
// - Condition A (mesh-step commensurability): k = [layerShapeSizeFactor
//   * (layerNodeCount-1)] / [baseShapeSizeFactor*(baseNodeCount-1)] -
//   for hex, uses nodeCount directly (not nodeCount-1), since hex's own
//   mesh step formula (canvasH/(sqrt(3)*shapeSizeFactor*nodeCount), see
//   buildHexGrid()) already divides by nodeCount, not nodeCount-1 - must
//   be a positive integer.
// - Condition B (centroid-alignment): with D = k*(baseNodeCount-1) -
//   (layerNodeCount-1) [triangle/square] - a general identity that
//   always evaluates to an integer once Condition A holds - D must be
//   divisible by 3 for triangle, by 2 for square, and (since hex's
//   centroid offset is exactly zero) no condition is needed for hex at
//   all - verified: 0 mismatches out of 142 real hex cases satisfying
//   only Condition A.
// - Condition C (container size): layerShapeSizeFactor <=
//   baseShapeSizeFactor - a smaller-scaled (larger shapeSizeFactor)
//   layer's own boundary cannot physically contain the base's own
//   (larger) outer nodes, regardless of lattice alignment.
function _alignmentConditionMet(baseShapeSizeFactor, baseNodeCount, layerShapeSizeFactor, layerNodeCount, shape) {
    if (layerShapeSizeFactor > baseShapeSizeFactor) return false; // Condition C
    if (shape === 'hex') {
        const num = layerShapeSizeFactor * layerNodeCount;
        const den = baseShapeSizeFactor * baseNodeCount;
        return num % den === 0; // Condition A only - hex has no Condition B
    }
    if (baseNodeCount < 2) return false; // no meaningful mesh step to align to (degenerate corners-only base)
    const num = layerShapeSizeFactor * (layerNodeCount - 1);
    const den = baseShapeSizeFactor * (baseNodeCount - 1);
    if (num % den !== 0) return false; // Condition A
    const k = num / den;
    const D = k * (baseNodeCount - 1) - (layerNodeCount - 1);
    const divisor = shape === 'triangle' ? 3 : 2; // Condition B
    return D % divisor === 0;
}

// Node Count ceiling per shape. Triangle and hex stay at 7 (Group A, measured against hex: the orbit table costs ~3n^2
// nodes there, 40 ms at 7 but 87 ms at 9 and 199 ms at 11 on the measuring machine). The square has real headroom - its
// per-click cost was measured at ~29-39 ms at 13 (E = 12, drawing and face detection do not depend on the node count;
// only the orbit table does) - so it goes to 13, not 15 (15 adds one nesting option and a first click of 80 ms).
// Every place that bounds a node count reads this one table: the UI clamps (base and layer), the shape switches, the
// catalog-URL validator and alignLayerToBase().
const NODE_COUNT_MAX = { triangle: 7, square: 13, hex: 7 };
function maxNodeCountFor(shape) { return NODE_COUNT_MAX[shape] || 7; }

// Roadmap 1.12 "Align to base": searches the layer's own reachable
// parameter space (shapeSizeFactor 1..baseShapeSizeFactor - Condition C
// folded directly into the search range rather than checked separately;
// nodeCount 2..maxNodeCountFor(shape), matching #layer-node-count-input's
// own real UI bounds - searching beyond what the UI can actually express
// would produce an unusable suggestion; this used to be a hard-coded 5,
// stale since Group A raised the UI limit to 7) for the SMALLEST valid (shapeSizeFactor,
// nodeCount) pair satisfying _alignmentConditionMet() above - "smallest"
// meaning fewest nodes first (nodeCount ascending), then coarsest scale
// (shapeSizeFactor ascending) as the tiebreak, a simple and deterministic
// notion of minimality. layerCurrentShapeSizeFactor/layerCurrentNodeCount
// are accepted for signature symmetry with this file's other layer-
// facing functions (explicit-parameters-only, no global reads - same
// "testable headlessly" standard as layerGrid() itself) but are not
// themselves searched over; the trivial already-aligned case (the
// layer's current values already satisfy the condition) is simply the
// first match this same search would find on its own, nothing special-
// cased. Returns {achievable:false} - never an inexact "closest match"
// - when no pair within these bounds satisfies the condition, matching
// this codebase's established "refuse rather than compute wrong"
// precedent (core/tiling.js's computeLayerCellFaces(), sketch.js's
// incompatibleEnabledLayersForCrossLayerFaces()).
function alignLayerToBase(baseShapeSizeFactor, baseNodeCount, layerCurrentShapeSizeFactor, layerCurrentNodeCount, shape) {
    for (let nodeCount = 2; nodeCount <= maxNodeCountFor(shape); nodeCount++) {
        for (let shapeSizeFactor = 1; shapeSizeFactor <= baseShapeSizeFactor; shapeSizeFactor++) {
            if (_alignmentConditionMet(baseShapeSizeFactor, baseNodeCount, shapeSizeFactor, nodeCount, shape)) {
                return { achievable: true, shapeSizeFactor, nodeCount };
            }
        }
    }
    return { achievable: false };
}

// ---------------------------------------------------------------------------------------------------------------------
// GridSpec facade (task 057, G2). A GridSpec {shape, ordnung, lage} names a grid by its order (mesh divisions per edge for
// triangle/square, rings for hex) and position (lage). This is a thin wrapper over the three Lage-1 builders above; their
// output is unchanged. `nodeCount` (the legacy count c) stays as the derived internal bridge (core/tiling.js still reads it).
//   hex:               ordnung = c,     toLegacy = ordnung
//   triangle/square:   c >= 2 -> ordnung = c - 1, toLegacy = ordnung + 1
//   triangle/square c = 1 is NOT invertible: it yields the same corner nodes as c = 2 but behaves differently (alignLayerToBase
//   refuses it, the square net has E = 0 instead of 1). It stays a legacy special case, carried as the marker legacyC1:true on
//   an ordnung-1 spec, so fromLegacy/toLegacy/buildGrid reproduce it exactly. Lage 2 is never derived from legacy and is
//   rejected by validateGridSpec until a later task builds it.
const GRID_SHAPES = ['triangle', 'square', 'hex'];

// -> { ok: true } | { ok: false, error: <message> }. opts.enforceMax: also reject ordnung > maxOrdnungFor(shape, lage).
// opts.allowLage2 (task 058, G3): internal switch for the pure builders and their tests only - the app (setGrid, rebuildGrid) never
// passes it, so lage 2 stays rejected there until a later task releases it.
function validateGridSpec(spec, opts) {
    if (!spec || typeof spec !== 'object') return { ok: false, error: 'GridSpec must be an object' };
    if (GRID_SHAPES.indexOf(spec.shape) < 0) return { ok: false, error: 'unknown shape: ' + String(spec.shape) };
    if (spec.lage === 2 && ((opts && opts.allowLage2 === true) || lage2SwitchOn())) {
        if (!Number.isInteger(spec.ordnung) || spec.ordnung < 1) return { ok: false, error: 'ordnung must be an integer >= 1, got ' + String(spec.ordnung) };
        if (spec.legacyC1 !== undefined) return { ok: false, error: 'legacyC1 belongs to lage 1 only' };
        // task 067: with the developer switch on the ceiling (LAGE2_MAX) always applies; the builder/test option alone (switch off) keeps its old freedom unless enforceMax is asked for
        if (((opts && opts.enforceMax) || lage2SwitchOn()) && spec.ordnung > maxOrdnungFor(spec.shape, spec.lage)) return { ok: false, error: 'ordnung ' + spec.ordnung + ' exceeds ' + maxOrdnungFor(spec.shape, spec.lage) + ' for ' + spec.shape + ' lage 2' };
        return { ok: true };
    }
    if (spec.lage !== 1) return { ok: false, error: spec.lage === 2 ? 'lage 2 is not available yet' : 'invalid lage: ' + String(spec.lage) };
    if (!Number.isInteger(spec.ordnung) || spec.ordnung < 1) return { ok: false, error: 'ordnung must be an integer >= 1, got ' + String(spec.ordnung) };
    if (spec.legacyC1 !== undefined && !(spec.legacyC1 === true && spec.shape !== 'hex' && spec.ordnung === 1)) return { ok: false, error: 'legacyC1 is only valid for triangle/square at ordnung 1' };
    if (opts && opts.enforceMax && spec.ordnung > maxOrdnungFor(spec.shape, spec.lage)) return { ok: false, error: 'ordnung ' + spec.ordnung + ' exceeds ' + maxOrdnungFor(spec.shape, spec.lage) + ' for ' + spec.shape };
    return { ok: true };
}

// Task 067: the internal developer switch of lage 2 (no UI yet, task 068). OFF by default: lage 2 is rejected exactly as before. ON when
// globalThis.__lage2 === true (set by the page for the query ?lage2=1 below, or by hand in the console / a test). Read afresh on every call.
function lage2SwitchOn() {
    return typeof globalThis !== 'undefined' && globalThis.__lage2 === true;
}
if (typeof location !== 'undefined' && typeof URLSearchParams === 'function' && typeof globalThis !== 'undefined') {
    try { if (new URLSearchParams(location.search).get('lage2') === '1') globalThis.__lage2 = true; } catch (e) { /* no query, switch stays off */ }
}
// Task 067: the ceiling of the ordnung of a lage-2 grid (base AND layers; the browser load table of the task, node load see reports/058.md).
const LAGE2_MAX = { triangle: 5, square: 5, hex: 2 };

// Largest admissible ordnung for shape/lage; 0 = none (unknown shape, or a lage that is not available: lage 2 only while the switch is on).
function maxOrdnungFor(shape, lage) {
    if (GRID_SHAPES.indexOf(shape) < 0) return 0;
    if (lage === 2) return lage2SwitchOn() ? LAGE2_MAX[shape] : 0;
    if ((lage === undefined ? 1 : lage) !== 1) return 0;
    const c = maxNodeCountFor(shape);
    return shape === 'hex' ? c : c - 1;
}

// Task 068b: lage-keeping helpers. The UI counts in the LEGACY count c (nodeCount); a lage-2 grid has the same c as the lage-1 grid it extends.
// gridSpecForCount: the spec of `shape` at count c in `lage` (lage 1: exactly fromLegacy; lage 2: the ordnung of that count, clamped to LAGE2_MAX).
function gridSpecForCount(shape, count, lage) {
    const s = fromLegacy(shape, count);
    if (lage !== 2) return s;
    const max = maxOrdnungFor(shape, 2);
    return { shape, ordnung: Math.max(1, max ? Math.min(s.ordnung, max) : s.ordnung), lage: 2 };
}
// The largest count the input may take in `lage` (lage 1: the shape's NODE_COUNT_MAX; lage 2: the count of the lage-2 ceiling).
function gridMaxCount(shape, lage) {
    const m = lage === 2 ? maxOrdnungFor(shape, 2) : 0;
    return m ? (shape === 'hex' ? m : m + 1) : maxNodeCountFor(shape);
}
// The base's spec on ANOTHER shape. Lage 1: the legacy count moves over (as before); lage 2: the ordnung is taken over directly, clamped to the new shape's lage-2 ceiling.
function gridSpecOnShape(spec, shape) {
    if (spec.lage === 2 && maxOrdnungFor(shape, 2)) return { shape, ordnung: Math.min(spec.ordnung, maxOrdnungFor(shape, 2)), lage: 2 };
    return fromLegacy(shape, toLegacy(spec));
}

function fromLegacy(shape, c) {
    if (GRID_SHAPES.indexOf(shape) < 0) throw new Error('fromLegacy: unknown shape: ' + String(shape));
    if (!Number.isInteger(c) || c < 1) throw new Error('fromLegacy: nodeCount must be an integer >= 1, got ' + String(c));
    if (shape === 'hex') return { shape, ordnung: c, lage: 1 };
    if (c === 1) return { shape, ordnung: 1, lage: 1, legacyC1: true };
    return { shape, ordnung: c - 1, lage: 1 };
}

// The legacy count c of the LAGE-1 grid a spec is built on (lage 2 extends exactly that grid). opts as validateGridSpec.
function toLegacy(spec, opts) {
    const v = validateGridSpec(spec, opts);
    if (!v.ok) throw new Error('toLegacy: ' + v.error);
    if (spec.shape === 'hex') return spec.ordnung;
    return spec.legacyC1 === true ? 1 : spec.ordnung + 1;
}

// Task 060 (G5a): the divisions E per tile and axis of the base grid - the ONE producer every net/export consumer asks (it replaces the
// scattered `nodeCount - 1`). triangle/square: ordnung (also on lage 2, which extends the same lage-1 grid); hex: ordnung - 1; the legacy
// c = 1 spec: 0 (no warp, as before). Equal to the old E = c - 1 for every shape and c.
function getGridDivisions(spec) {
    return toLegacy(spec, { allowLage2: true }) - 1;
}

// E of the live base grid: the base's GridSpec as its derived legacy projection (global nodeCount, set only by core/state.js projectGridSpec)
// goes through getGridDivisions. Sandboxes that load forms/netwarp/export without state.js only provide currentShape + nodeCount.
function baseGridDivisions() {
    return getGridDivisions(fromLegacy(currentShape, nodeCount));
}
// The base's GridSpec in the same sandbox-safe way (task 063: the export names it); equal to core/state.js gridSpec in the app.
function baseGridSpecNow() {
    // task 067: a lage-2 base (core/state.js gridSpec) is returned as it is - fromLegacy never yields lage 2. Only when it agrees with the legacy globals; every lage-1 case is the old one.
    if (typeof gridSpec !== 'undefined' && gridSpec && gridSpec.lage === 2 && gridSpec.shape === currentShape && lage2SwitchOn() && toLegacy(gridSpec) === nodeCount) return gridSpec;
    return fromLegacy(currentShape, nodeCount);
}

// Task 061 (G5b): every additional layer carries its OWN GridSpec (layer.gridSpec); layer.nodeCount is its derived legacy projection.
// projectLayerGridSpec is the ONLY write of layer.nodeCount (as core/state.js projectGridSpec is for the base): it validates first
// (lage 2 only while the developer switch is on, within LAGE2_MAX) and refuses a spec of another shape than layer.shape (shape and spec never drift).
function projectLayerGridSpec(layer, spec) {
    const c = toLegacy(spec);
    if (spec.shape !== layer.shape) throw new Error('projectLayerGridSpec: spec shape ' + spec.shape + ' differs from layer.shape ' + layer.shape);
    layer.gridSpec = spec;
    layer.nodeCount = c;
}
// The spec of a layer: its own gridSpec, or - for a layer object built without one (test fixtures, an old object) - the one its shape and
// legacy count give. Read only.
function layerGridSpecOf(layer) {
    return layer.gridSpec || fromLegacy(layer.shape, layer.nodeCount);
}
// Whether a layer's grid TYPE is the base's: same shape and same lage (neither size, offset, rotation nor ordnung: a layer of another
// ordnung may still share the base lattice, see core/facecolor.js layerGridMatchesBase, which this does not replace). allowLage2 specs
// are distinguished too, although lage 2 cannot be set yet.
function layerSpecMatchesBase(layerSpec, baseSpec) {
    return layerSpec.shape === baseSpec.shape && layerSpec.lage === baseSpec.lage;
}

// view = {sizeFactor, canvasW, canvasH, center?}. -> { grid: {shape, ordnung, lage}, nodes, centroid, outerCorners }.
// opts.numbered (task 059): every node also carries u, v and its semantic node number zahl (numberGridNodes), for lage 1 as well as lage 2.
// Lage 1: exactly the output of the three builders (no extra fields). Lage 2 (only with opts.allowLage2): the lage-1 nodes
// unchanged (same ids, x, y, order), then the centres of the smallest meshes appended with the next ids; every node of a lage-2
// grid also carries u, v (see buildGridNodes).
function buildGrid(spec, view, opts) {
    const v = validateGridSpec(spec, opts);
    if (!v.ok) throw new Error('buildGrid: ' + v.error);
    const c = toLegacy(spec, opts);
    const build = spec.shape === 'triangle' ? buildTriangleGrid : spec.shape === 'square' ? buildSquareGrid : buildHexGrid;
    const g = build(c, view.sizeFactor, view.canvasW, view.canvasH, view.center);
    const grid = { shape: spec.shape, ordnung: spec.ordnung, lage: spec.lage };
    if (spec.legacyC1 === true) grid.legacyC1 = true;
    if (spec.lage !== 2 && !(opts && opts.numbered === true)) return { grid, nodes: g.nodes, centroid: g.centroid, outerCorners: g.outerCorners };
    const nodes = gridNodesWithUV(g, spec, opts);
    if (opts && opts.numbered === true) return { grid, nodes: numberGridNodes(nodes, grid).nodes, centroid: g.centroid, outerCorners: g.outerCorners };
    return { grid, nodes, centroid: g.centroid, outerCorners: g.outerCorners };
}

// Task 067: the nodes of ANY lage-1 grid g = { nodes, centroid, outerCorners } (a base builder, an alt-net subdivision, layerGrid()) of `spec` with u, v on
// every node and, for lage 2, the mesh centres appended (ids after the lage-1 ids, projected onto g's own corners). Lage-1 nodes keep id, x, y.
function gridNodesWithUV(g, spec, opts) {
    const uv = buildGridNodes(spec, opts);
    const n1 = g.nodes.length;
    if (uv.length < n1 || uv.some((p, i) => i < n1 && p.id !== g.nodes[i].id)) throw new Error('buildGrid: lage-1 node order does not match the lattice order');
    const nodes = g.nodes.map((nd, i) => ({ id: nd.id, x: nd.x, y: nd.y, u: uv[i].u, v: uv[i].v }));
    const extra = projectGridNodes(uv.slice(n1), { shape: spec.shape, ordnung: spec.ordnung, outerCorners: g.outerCorners, centroid: g.centroid });
    extra.forEach(nd => nodes.push(nd));
    return nodes;
}
// Task 067: the grid of a LAYER of `spec` - layerGrid() on the spec's legacy count, plus the lage-2 nodes. Lage 1: exactly layerGrid()'s result.
function layerGridForSpec(baseOuterCorners, baseCentroid, baseShape, baseShapeSizeFactor, layerShapeSizeFactor, spec, layerShape, canvasW, canvasH) {
    const lg = layerGrid(baseOuterCorners, baseCentroid, baseShape, baseShapeSizeFactor, layerShapeSizeFactor, toLegacy(spec), layerShape, canvasW, canvasH);
    if (spec.lage !== 2) return lg;
    return { nodes: gridNodesWithUV(lg, spec), centroid: lg.centroid, outerCorners: lg.outerCorners };
}

// ---------------------------------------------------------------------------------------------------------------------
// Lage 2 (task 058, G3): the lattice of a grid in dimensionless coordinates u, v (units of ONE smallest mesh edge), pure - no
// canvas, no pixels. Keys are integers scaled by LAGE2_DEN = 6 (u6 = 6u): the mesh centres sit at thirds (triangle meshes) or
// halves (square meshes) of an edge, so equality is exact integer equality, never a rounded pixel comparison.
//   triangle: P = A + u (B - A) / n + v (C - A) / n   (A, B, C = outerCorners[0..2]); 0 <= u, v, u + v <= n
//   square:   P = c0 + u (c1 - c0) / n + v (c3 - c0) / n; 0 <= u, v <= n
//   hex:      P = centre + u D2 + v D1, D_k = (outerCorners[k] - centre) / n (axial); |u|, |v|, |u + v| <= n
// Lage 1 comes first, in exactly the order and with exactly the ids the lage-1 builders produce (1..N1); lage 2 appends the mesh
// centres (up meshes, then down meshes; hex: scanned by q, r) with the following ids, duplicates dropped by their integer key.
const LAGE2_DEN = 6;
const _HEX_DIRS = [[-1, 1], [0, 1], [1, 0], [1, -1], [0, -1], [-1, 0]];   // axial direction of outerCorners[k] (k = 0..5)

// -> [{ id, u6, v6, u, v }]; opts as validateGridSpec (lage 2 needs { allowLage2: true }).
function buildGridNodes(spec, opts) {
    const v = validateGridSpec(spec, opts);
    if (!v.ok) throw new Error('buildGridNodes: ' + v.error);
    const n = spec.ordnung, D = LAGE2_DEN, out = [], seen = new Set();
    const add = (U, V) => {
        const k = U + ',' + V;
        if (seen.has(k)) return;
        seen.add(k);
        out.push({ id: out.length + 1, u6: U, v6: V, u: U / D, v: V / D });
    };
    // ---- lage 1, in the legacy builders' order
    if (spec.shape === 'triangle') {
        if (spec.legacyC1 === true) { add(0, 0); add(D, 0); add(0, D); }
        else for (let i = 0; i <= n; i++) for (let j = 0; j <= i; j++) add((i - j) * D, j * D);
    } else if (spec.shape === 'square') {
        if (spec.legacyC1 === true) { add(0, 0); add(D, 0); add(D, D); add(0, D); }
        else for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) add(i * D, j * D);
    } else {
        for (let r = n; r >= 1; r--) {
            for (let k = 0; k < 6; k++) add(r * _HEX_DIRS[k][0] * D, r * _HEX_DIRS[k][1] * D);
            for (let k = 0; k < 6; k++) {
                const a = _HEX_DIRS[k], b = _HEX_DIRS[(k + 1) % 6];
                for (let seg = 1; seg <= r - 1; seg++) add((r * a[0] + seg * (b[0] - a[0])) * D, (r * a[1] + seg * (b[1] - a[1])) * D);
            }
        }
        add(0, 0);
    }
    if (spec.lage !== 2) return out;
    // ---- lage 2: the centres of the smallest meshes
    if (spec.shape === 'triangle') {
        for (let i = 0; i < n; i++) for (let j = 0; i + j < n; j++) add(i * D + 2, j * D + 2);            // up mesh (i,j),(i+1,j),(i,j+1): centre (i+1/3, j+1/3)
        for (let i = 0; i < n; i++) for (let j = 0; i + j < n - 1; j++) add(i * D + 4, j * D + 4);        // down mesh (i+1,j),(i,j+1),(i+1,j+1): centre (i+2/3, j+2/3)
    } else if (spec.shape === 'square') {
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) add(i * D + 3, j * D + 3);
    } else {
        const inside = (a, b) => Math.abs(a) <= n && Math.abs(b) <= n && Math.abs(a + b) <= n;
        for (let q = -n - 1; q <= n; q++) for (let r = -n - 1; r <= n; r++) {
            if (inside(q, r) && inside(q + 1, r) && inside(q, r + 1)) add(q * D + 2, r * D + 2);
            if (inside(q + 1, r) && inside(q, r + 1) && inside(q + 1, r + 1)) add(q * D + 4, r * D + 4);
        }
    }
    return out;
}

// u, v -> x, y for a grid whose outer corners are given (any regular polygon of that shape: default, layerGrid, alt-net).
// geometry = { shape, ordnung, outerCorners, centroid }; nodes as buildGridNodes returns them. Keeps id, u, v and adds x, y.
function projectGridNodes(uvNodes, geometry) {
    const oc = geometry.outerCorners, n = geometry.ordnung, ctr = geometry.centroid;
    let base, e1, e2;
    if (geometry.shape === 'triangle') { base = oc[0]; e1 = { x: (oc[1].x - oc[0].x) / n, y: (oc[1].y - oc[0].y) / n }; e2 = { x: (oc[2].x - oc[0].x) / n, y: (oc[2].y - oc[0].y) / n }; }
    else if (geometry.shape === 'square') { base = oc[0]; e1 = { x: (oc[1].x - oc[0].x) / n, y: (oc[1].y - oc[0].y) / n }; e2 = { x: (oc[3].x - oc[0].x) / n, y: (oc[3].y - oc[0].y) / n }; }
    else { base = ctr; e1 = { x: (oc[2].x - ctr.x) / n, y: (oc[2].y - ctr.y) / n }; e2 = { x: (oc[1].x - ctr.x) / n, y: (oc[1].y - ctr.y) / n }; }
    return uvNodes.map(p => ({ id: p.id, x: base.x + p.u * e1.x + p.v * e2.x, y: base.y + p.u * e1.y + p.v * e2.y, u: p.u, v: p.v }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Semantic node numbers (task 059, G4). The node number (Knotenzahl, "zahl") is the rank of the node ORBIT under the main group (3*/4*/6*,
// core/symmetry.js mainGroupSpec) by x = the distance from the centre perpendicular to the side (projection on the M ray of the shaded sector S0),
// ties by y (from the M axis towards the corner axis). Reference implementation: tools/gitter/measure-name-rule.js buildGrid(); ids stay the builders' ids.
// Everything works in the CANONICAL frame (y up, smallest mesh edge = 1):
//   gridCanonicalPoint(shape, n, u, v)  the canonical point of lattice coordinates (u, v) - exactly the point canonicalGridFrame() gives the canvas node
//   _gridOraclePoints(nodes, grid, opts)  per node its canonical point: from opts.geometry ({ shape, ordnung, centroid, outerCorners } - the canvas
//                                         position, screen handedness kept) or else from the node's u, v; null for free nodes and nodes without either
function gridCanonicalPoint(shape, n, u, v) {
    if (shape === 'triangle') { const R = n / Math.sqrt(3), c = [0, 1, 2].map(k => [R * Math.cos(2 * Math.PI * k / 3), R * Math.sin(2 * Math.PI * k / 3)]);
        return { X: c[0][0] + (u / n) * (c[1][0] - c[0][0]) + (v / n) * (c[2][0] - c[0][0]), Y: c[0][1] + (u / n) * (c[1][1] - c[0][1]) + (v / n) * (c[2][1] - c[0][1]) }; }
    if (shape === 'square') return { X: u - n / 2, Y: n / 2 - v };
    if (shape === 'hex') return { X: u + v / 2, Y: v * Math.sqrt(3) / 2 };
    throw new Error('gridCanonicalPoint: unknown shape: ' + String(shape));
}
function _gridOraclePoints(nodes, grid, opts) {
    const geo = opts && opts.geometry, fr = geo ? canonicalGridFrame({ shape: grid.shape, ordnung: grid.ordnung, centroid: geo.centroid, outerCorners: geo.outerCorners }) : null;
    return nodes.map(nd => {
        if (nd.free) return null;
        if (fr) { const o = fr.toOracle(nd.x, nd.y); return { x: o.X, y: o.Y }; }
        if (typeof nd.u !== 'number' || typeof nd.v !== 'number') return null;
        const o = gridCanonicalPoint(grid.shape, grid.ordnung, nd.u, nd.v); return { x: o.X, y: o.Y };
    });
}
// -> { nodes: copies of the input with zahl added (free / unplaced nodes copied without), orbits: [{ zahl, size, r, t, x, y }], points }
function numberGridNodes(nodes, grid, opts) {
    const v = validateGridSpec(grid, { allowLage2: true });
    if (!v.ok) throw new Error('numberGridNodes: ' + v.error);
    const points = _gridOraclePoints(nodes, grid, opts), w = mainGroupSpec(grid.shape).w, orbits = new Map(), keyOf = new Array(nodes.length);
    nodes.forEach((nd, i) => {
        const p = points[i]; if (!p) return;
        const f = mainGroupFold(grid.shape, p.x, p.y), k = Math.round(f.r * 1e6) + '|' + Math.round(f.t * 1e6);
        if (!orbits.has(k)) orbits.set(k, { r: f.r, t: f.t, size: 0, x: f.r * Math.cos(w - f.t), y: f.r * Math.sin(w - f.t) });
        orbits.get(k).size++; keyOf[i] = k;
    });
    const list = [...orbits.values()].sort((a, b) => (Math.round(a.x * 1e6) - Math.round(b.x * 1e6)) || (Math.round(a.y * 1e6) - Math.round(b.y * 1e6)));
    list.forEach((o, i) => { o.zahl = i + 1; });
    return { nodes: nodes.map((nd, i) => keyOf[i] === undefined ? Object.assign({}, nd) : Object.assign({}, nd, { zahl: orbits.get(keyOf[i]).zahl })), orbits: list.map(o => ({ zahl: o.zahl, size: o.size, r: o.r, t: o.t, x: o.x, y: o.y })), points };
}
