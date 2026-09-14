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
