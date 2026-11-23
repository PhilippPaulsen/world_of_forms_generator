/**
 * tools/netwarp/test-netwarp-projective-triangle.js
 * Task 124 (3C-2): the projective net (Moebius net) on the TRIANGLE sheet, family triangle-N, full format only, a >= 1 (the square keeps a >= 2). core/netwarp.js, core/session.js.
 * Counterpart: the prototype formulas written out again here (independent of core/) and tools/grid/measure-3c-triangle.js (W and the stretch).
 *
 *   node tools/netwarp/test-netwarp-projective-triangle.js
 *
 *  1. The map equals the prototype H (the same homography as the square); the edit tile is the UPPER triangle of a mesh, inside the region, and carries the base triangle.
 *  2. Pipeline (drawTessellation on a triangle sheet): every line finite, inside the canvas, equal to the image of its exact cut; a = 1 included.
 *  3. Faces: every polygon edge an exact chord, no coordinate outside the canvas (a = 1: 1,3 and 1,4), the exact equality case v_max = a skips the tile (no float rim), every tile in or out as the lattice says.
 *  4. W = b^2 - a^2 triangles, tilesWithArea = W (no half tile), the stretch (diagonals p-q : p+q against 1 : sqrt 3) equals the independent computation.
 *  5. Inverse, hit test, free endpoint; validity: the triangle takes a >= 1 and the full format only, the square a >= 2, the hexagon none; the family follows the shape.
 *  6. Timeline: triangle <-> triangle interpolates; square <-> triangle is refused (family differs), whatever the format.
 *  7. Export (version 2, family, tileShape, the same homography), round trip, session validator (accepts a = 1, refuses a = 0, bad family), main's validator.
 *  8. Off path: no net, the triangle Field and the square 3C draw byte-identical to main.
 *  9. Overlay lines: the third family p + q = const ('d').
 * 10. Sabotages S1 to S11: each must turn at least one check red.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = '8fac0c91';   // main at the start of task 124 (square 3C exists there: the byte-identity of its drawing and export is pinned)
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export', 'farborgel-bridge'];
const readNew = f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8');
const readOld = f => execSync(`git show ${BASE}:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
const NEW = {}, OLD = {};
FILES.concat(['session']).forEach(f => { NEW[f] = readNew(f); OLD[f] = readOld(f); });
const join = set => FILES.map(f => set[f]).join('\n');
const mut = (src, from, to) => { if (!src.includes(from)) throw new Error('sabotage text not found: ' + from.slice(0, 60)); return src.replace(from, to); };
const TRI = '△N', SQ = '□N', S3 = Math.sqrt(3);

let seed = 24; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function makeSb(src, cw, ch, shape) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        line: (a, b, c, d) => sb.lines.push([a, b, c, d]), bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, stroke: () => { }, noFill: () => { }, CLOSE: 'close',
        fill: c => { sb._fill = c; }, beginShape: () => { sb._cur = []; }, vertex: (x, y) => { sb._cur.push({ x, y }); }, endShape: () => { sb.polys.push({ fill: sb._fill, pts: sb._cur }); sb._cur = null; },
        document: { body: {} }, getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }), showNodes: true, width: cw, height: ch, canvasW: cw, canvasH: ch, showFaces: false,
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, activeNetWarp: null, lineColor: '#000000', altNetSeed: null,
        currentShape: shape, shapeSizeFactor: 3, nodeCount: 4, symmetryMode: 'none', timeline: null, activeLayer: 'base',
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, lines: [], polys: []
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb); vm.runInContext(src, sb);
    const g = shape === 'triangle' ? sb.buildTriangleGrid(4, 3, cw, ch) : sb.buildSquareGrid(4, 3, cw, ch); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
    return sb;
}
// connections = the grid edges (nodes at the least distance): faces are the small cells
function edgeConnections(sb) {
    const ns = sb.nodes; let dmin = Infinity; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) dmin = Math.min(dmin, Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y));
    const out = []; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) if (Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y) < dmin * 1.05) out.push([ns[i].id, ns[j].id]);
    return out;
}
const proto = (a, b, W, H) => (p, q) => { const v = p + q; return { x: W * p / v, y: H * a * (b - v) / ((b - a) * v) }; };   // the prototype H (measure-3c-triangle.js), full format
const inRegion = (a, b, p, q, tol = 1e-7) => p >= -tol && q >= -tol && p + q >= a - tol && p + q <= b + tol;
// independent W and stretch (the same computation as tools/grid/measure-3c-triangle.js: triangles with all three vertices in the region, centroid, diamond extents, times sqrt 3)
function refInfo(a, b, W, H) {
    const px = proto(a, b, W, H), e = 1e-4; let n = 0, st = 1;
    for (let i = 0; i < b; i++) for (let j = 0; j < b; j++) for (const up of [0, 1]) {
        const v = up ? [[i + 1, j], [i, j + 1], [i + 1, j + 1]] : [[i, j], [i + 1, j], [i, j + 1]], vs = v.map(P => P[0] + P[1]);
        if (Math.min(...vs) < a || Math.max(...vs) > b) continue; n++;
        const c = [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3], A = px(c[0] - e, c[1] + e), B = px(c[0] + e, c[1] - e), C = px(c[0] - e, c[1] - e), D = px(c[0] + e, c[1] + e);
        const asp = Math.abs(B.x - A.x) / Math.abs(D.y - C.y) * S3; st = Math.max(st, asp, 1 / asp);
    }
    return { W: n, stretch: st };
}
const CASES = [[2, 4, 800, 600], [3, 6, 600, 600], [1, 3, 600, 600], [1, 4, 900, 600], [3, 5, 1200, 600], [11, 12, 700, 500], [2, 3, 600, 900]];

function suite(set, opts = {}) {
    const res = [];
    const check = (name, ok, detail) => res.push({ name, ok: !!ok, detail });
    const guard = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw: ' + String(e && e.message || e).slice(0, 90) + ')', false); } };
    const SRC = join(set);
    const build = (a, b, cw, ch, family) => { const sb = makeSb(SRC, cw, ch, 'triangle'); sb.baseNetTransform = sb.netProjectiveSpec(a, b, 'full', family === undefined ? TRI : family); sb.connections = edgeConnections(sb); return sb; };
    const warpOf = sb => sb.netWarpForBase(sb.baseNetTransform, 'triangle', sb.outerCorners, sb.nodeCount, sb.shapeSizeFactor);
    const regPt = (w, p, q) => { const P = w.projective, F = w.frame; return { x: F.c0.x + (p - P.i0) * F.v1.x + (q - P.j0) * F.v2.x, y: F.c0.y + (p - P.i0) * F.v1.y + (q - P.j0) * F.v2.y }; };
    const latt = (w, pt) => { const F = w.frame, P = w.projective, dx = pt.x - F.c0.x, dy = pt.y - F.c0.y; return { p: (dx * F.v2.y - dy * F.v2.x) / F.det + P.i0, q: (F.v1.x * dy - F.v1.y * dx) / F.det + P.j0 }; };

    // ---- 1. the map ----
    guard('1', () => {
        let worst = 0, n = 0, bad = 0;
        for (const [a, b, cw, ch] of CASES) {
            const sb = build(a, b, cw, ch), w = warpOf(sb), H = proto(a, b, cw, ch);
            if (!w) { bad++; continue; }
            for (let k = 0; k < 300; k++) { const p = rnd() * (b + 1), q = rnd() * (b + 1); if (p + q < a) continue; const r = sb.applyNetWarp(w, regPt(w, p, q)), e = H(p, q); worst = Math.max(worst, Math.hypot(r.x - e.x, r.y - e.y) / Math.max(1, Math.abs(e.y) / ch)); n++; }
        }
        check('1. applyNetWarp on the triangle sheet equals the prototype H (7 canvases, a = 1 included)', bad === 0 && n > 1000 && worst < 1e-6, `${n} points, worst ${worst.toExponential(2)}`);
    });
    guard('1b', () => {
        let ok = true, det = '';
        for (const [a, b, cw, ch] of CASES) {
            const sb = build(a, b, cw, ch), w = warpOf(sb), P = w.projective, I = P.i0, J = P.j0;
            const upperIn = I + J + 1 >= a && I + J + 2 <= b;   // the edit tile is the UPPER triangle of mesh (I, J): all three vertices in the region
            const base = sb.centroid, im = sb.applyNetWarp(w, base), e = proto(a, b, cw, ch)(I + 2 / 3, J + 2 / 3);   // the base triangle's centre is the upper triangle's centre
            const inCanvas = im.x >= 0 && im.x <= cw && im.y >= 0 && im.y <= ch && sb.netWarpInsideNet(w, im);
            if (!upperIn || !inCanvas || Math.hypot(im.x - e.x, im.y - e.y) > 1e-6) { ok = false; det = `${a},${b}: edit mesh (${I},${J}) upperIn ${upperIn} inCanvas ${inCanvas}`; }
        }
        check('1b. the edit tile is the upper triangle of a mesh inside the region and carries the base triangle (centre of the base triangle = image of (I + 2/3, J + 2/3))', ok, det);
    });

    // ---- 2. pipeline ----
    guard('2', () => {
        for (const [a, b, cw, ch] of [CASES[0], CASES[2], CASES[3], CASES[4]]) {
            const sb = build(a, b, cw, ch), w = warpOf(sb), calls = [], orig = sb.drawCurvedBezier;
            sb.drawCurvedBezier = function (p1, p2, ct, i1, i2) { const i0 = sb.lines.length; orig.call(this, p1, p2, ct, i1, i2); calls.push({ p1, p2, from: i0, to: sb.lines.length }); };
            sb.lines = []; sb.drawTessellation(); sb.drawCurvedBezier = orig;
            let outside = 0, offcut = 0, nonFinite = 0; const eps = 1e-6;
            for (const l of sb.lines) { if (!l.every(Number.isFinite)) nonFinite++; if (l[0] < -eps || l[0] > cw + eps || l[2] < -eps || l[2] > cw + eps || l[1] < -eps || l[1] > ch + eps || l[3] < -eps || l[3] > ch + eps) outside++; }
            for (const c of calls) {
                const cut = sb.netWarpSplitSegment(w, c.p1, c.p2), want = cut.length < 2 ? 0 : 1;
                if (c.to - c.from !== want) { offcut++; continue; }
                if (want) { const A = sb.applyNetWarp(w, cut[0]), B = sb.applyNetWarp(w, cut[1]), l = sb.lines[c.from]; if (Math.hypot(l[0] - A.x, l[1] - A.y) > 1e-9 || Math.hypot(l[2] - B.x, l[3] - B.y) > 1e-9) offcut++; }
            }
            check(`2. ${a},${b} ${cw}x${ch}: ${sb.lines.length} lines drawn, all finite and inside the canvas, each = the image of its exact cut`, sb.lines.length > 20 && nonFinite === 0 && outside === 0 && offcut === 0, `outside ${outside}, off-cut ${offcut}, non-finite ${nonFinite}`);
        }
    });

    // ---- 3. faces ----
    guard('3', () => {
        for (const [a, b, cw, ch] of [CASES[0], CASES[2], CASES[3], CASES[4]]) {
            const sb = build(a, b, cw, ch), w = warpOf(sb); sb.showFaces = true;
            sb.polys = []; sb.drawTessellation();
            const polys = sb.polys.filter(p => p.pts.length >= 3);
            let nonFinite = 0, out = 0, bent = 0; const eps = 1e-6;
            for (const p of polys) {
                for (const v of p.pts) { if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) nonFinite++; else if (v.x < -eps || v.x > cw + eps || v.y < -eps || v.y > ch + eps) out++; }
                for (let i = 0; i < p.pts.length; i++) {
                    const A = p.pts[i], B = p.pts[(i + 1) % p.pts.length], pa = sb.invertNetWarp(w, A), pb = sb.invertNetWarp(w, B), pm = sb.invertNetWarp(w, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
                    const L = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1, d = Math.abs((pm.x - pa.x) * (pb.y - pa.y) - (pm.y - pa.y) * (pb.x - pa.x)) / L;
                    if (d > 1e-6 * Math.max(1, L)) bent++;
                }
            }
            check(`3. ${a},${b} ${cw}x${ch}: ${polys.length} face polygons, all finite, NONE outside the canvas, every edge an exact chord`, polys.length > 10 && nonFinite === 0 && out === 0 && bent === 0, `non-finite ${nonFinite}, outside ${out}, bent ${bent}`);
        }
    });
    guard('3b', () => {
        // every triangle tile in range: skipped exactly when it lies outside the region (v_max <= a or v_min >= b); v_max = a is the exact equality case (no float rim)
        let wrong = [], want = 0, got = 0;
        for (const [a, b, cw, ch] of [CASES[0], CASES[2], CASES[3], CASES[1]]) {
            const sb = build(a, b, cw, ch), w = warpOf(sb);
            for (let I = 0; I < b; I++) for (let J = 0; J < b; J++) {
                // the centres of the two triangles of the mesh (I, J) in lattice coordinates: the upper (I + 2/3, J + 2/3), the lower (I + 1/3, J + 1/3) (what tileTriangle places as the up tile and, turned by 180 degrees, the down tile one mesh up)
                const up = regPt(w, I + 2 / 3, J + 2 / 3), down = regPt(w, I + 1 / 3, J + 1 / 3);
                const upOut = !(I + J + 1 >= a && I + J + 2 <= b), downOut = !(I + J >= a && I + J + 1 <= b);
                const ru = sb.netWarpTileOutsideCanvas(w, up, false), rd = sb.netWarpTileOutsideCanvas(w, down, true);
                want += (upOut ? 1 : 0) + (downOut ? 1 : 0); got += (ru ? 1 : 0) + (rd ? 1 : 0);
                if (ru !== upOut) wrong.push(`${a},${b} up ${I},${J}`); if (rd !== downOut) wrong.push(`${a},${b} down ${I},${J}`);
            }
        }
        check('3b. netWarpTileOutsideCanvas on the triangle: a tile is skipped exactly when outside the region (the lower triangle of mesh (0,0) at a = 1 included)', wrong.length === 0, `want ${want} got ${got} wrong ${wrong.slice(0, 4).join('; ')}`);
    });

    // ---- 4. W and the stretch ----
    guard('4', () => {
        let ok = true, det = '';
        for (const [a, b, cw, ch] of [[2, 4, 600, 600], [3, 6, 600, 600], [1, 3, 600, 600], [3, 5, 900, 600], [1, 4, 900, 600], [4, 9, 800, 600], [2, 4, 1200, 600], [11, 12, 600, 600]]) {
            const sb = makeSb(SRC, cw, ch, 'triangle'), info = sb.netProjectiveInfo(sb.netProjectiveSpec(a, b, 'full', TRI), cw, ch), ref = refInfo(a, b, cw, ch);
            if (!info.valid || info.W !== b * b - a * a || info.W !== ref.W || info.tilesWithArea !== info.W || Math.abs(info.stretch - ref.stretch) > 1e-3) { ok = false; det += ` ${a},${b} ${cw}x${ch}: W ${info.W} (${b * b - a * a}) area ${info.tilesWithArea} stretch ${info.stretch} (${ref.stretch})`; }
        }
        check('4. W = b^2 - a^2 triangles (2,4: 12, 3,6: 27, 1,3: 8, 3,5: 16), tilesWithArea = W (no half tile), the stretch equals the independent computation', ok, det);
        const sb = makeSb(SRC, 600, 600, 'triangle'), s = (a, b, cw, ch) => sb.netProjectiveInfo(sb.netProjectiveSpec(a, b, 'full', TRI), cw, ch).stretch;
        check('4b. the table of the plan (stretch at 1:1: 1,3 1.54, 2,4 1.98; 3:2: 2,4 1.32; 2:1: 3,5 1.30)', Math.abs(s(1, 3, 600, 600) - 1.54) < 0.01 && Math.abs(s(2, 4, 600, 600) - 1.98) < 0.01 && Math.abs(s(2, 4, 900, 600) - 1.32) < 0.01 && Math.abs(s(3, 5, 1200, 600) - 1.30) < 0.01, [s(1, 3, 600, 600), s(2, 4, 600, 600), s(2, 4, 900, 600), s(3, 5, 1200, 600)].map(x => x.toFixed(3)).join(' '));
        const sq = sb.netProjectiveInfo(sb.netProjectiveSpec(2, 4, 'full'), 600, 600);
        check('4c. the square is unchanged: W 6, 9 tiles with area, stretch 2.73 at 4:3', sq.W === 6 && sq.tilesWithArea === 9 && Math.abs(sb.netProjectiveInfo(sb.netProjectiveSpec(2, 4, 'full'), 800, 600).stretch - 2.73) < 0.01);
    });

    // ---- 5. inverse, hit test, validity ----
    guard('5', () => {
        let worst = 0, n = 0, hit = 0, hitBad = 0;
        for (const [a, b, cw, ch] of CASES) {
            const sb = build(a, b, cw, ch), w = warpOf(sb);
            for (let k = 0; k < 200; k++) {
                const p = rnd() * (b + 1), q = rnd() * (b + 1); if (p + q < a) continue; const R = regPt(w, p, q), I = sb.invertNetWarp(w, sb.applyNetWarp(w, R)); worst = Math.max(worst, Math.hypot(I.x - R.x, I.y - R.y) / Math.hypot(w.frame.v1.x, w.frame.v1.y)); n++;
                const X = rnd() * cw, Y = rnd() * ch, click = { x: X, y: Y }; if (!sb.netWarpInsideNet(w, click)) continue;
                const loc = sb.netWarpFieldLocal(w, click); hit++; if (!loc) { hitBad++; continue; }
                if (loc.tile.i === 0 && loc.tile.j === 0) { const back = sb.applyNetWarp(w, loc); if (Math.hypot(back.x - X, back.y - Y) > 1e-6) hitBad++; }
            }
        }
        check('5. invertNetWarp(applyNetWarp(P)) = P; every click in the picture is inside the net, has a local point, and the edit-tile click comes back', n > 800 && worst < 1e-9 && hit > 500 && hitBad === 0, `${n} points worst ${worst.toExponential(2)}, ${hit} clicks, ${hitBad} bad`);
    });
    guard('5b', () => {
        const sb = makeSb(SRC, 600, 600, 'triangle'), S = sb.netProjectiveSpec, E = (sp, sh) => sb.netProjectiveEffective(sp, sh);
        check('5b. the triangle takes the FULL format only (half refused with a reason, no warp)', !E(S(3, 6, 'half', TRI), 'triangle').valid && /full format/.test(E(S(3, 6, 'half', TRI), 'triangle').reason) && E(S(3, 6, 'full', TRI), 'triangle').valid);
        check('5c. a >= 1 on the triangle (1,3 and 1,4 valid), a = 0, a >= b, b > 12, non-integers refused; the SQUARE still takes a >= 2 only', E(S(1, 3, 'full', TRI), 'triangle').valid && E(S(1, 4, 'full', TRI), 'triangle').valid && !E(S(0, 3, 'full', TRI), 'triangle').valid && !E(S(3, 3, 'full', TRI), 'triangle').valid && !E(S(2, 13, 'full', TRI), 'triangle').valid && !E(S(1.5, 4, 'full', TRI), 'triangle').valid && !E(S(1, 4, 'full', SQ), 'square').valid && E(S(2, 4, 'full', SQ), 'square').valid);
        check('5d. the hexagon has no 3C; the triangle and square family follow the shape (a stale family is renamed: a square spec on the triangle sheet gives the triangle net, and vice versa)', !E(S(2, 4, 'full', TRI), 'hex').valid && sb.netWarpForBase(S(2, 4, 'full', TRI), 'hex', sb.outerCorners, 4, 3) === null
            && E(S(2, 4, 'full', SQ), 'triangle').valid && E(S(2, 4, 'full', TRI), 'square').valid && !E(S(1, 4, 'full', TRI), 'square').valid);
        const t = makeSb(SRC, 600, 600, 'triangle'), w1 = t.netWarpForBase(S(1, 3, 'full', SQ), 'triangle', t.outerCorners, 4, 3), w2 = t.netWarpForBase(S(1, 3, 'full', TRI), 'triangle', t.outerCorners, 4, 3);
        check('5e. a stale family builds the same warp as the right one (the family follows the shape)', w1 && w2 && JSON.stringify(w1.projective) === JSON.stringify(w2.projective) && w1.projective.i0 === w2.projective.i0);
    });

    // ---- 6. timeline ----
    guard('6', () => {
        const sb = makeSb(SRC, 600, 600, 'triangle'), S = sb.netProjectiveSpec, A = S(1, 3, 'full', TRI), B = S(3, 6, 'full', TRI), SQa = S(2, 4, 'full', SQ), SQh = S(2, 4, 'half', SQ);
        const l0 = sb.netLerpSpecs(A, B, 0), l1 = sb.netLerpSpecs(A, B, 1), lh = sb.netLerpSpecs(A, B, 0.5);
        check('6. triangle <-> triangle interpolates; exact at the ends; in between a, b real, family kept, the spec valid and drawn', sb.netAnimationCompat(A, B).ok && l0.a === 1 && l0.b === 3 && l1.a === 3 && l1.b === 6 && lh.a === 2 && lh.b === 4.5 && lh.family === TRI && lh.interp === true && sb.netWarpForBase(lh, 'triangle', sb.outerCorners, 4, 3) !== null);
        const r = [[SQa, A], [A, SQa], [SQh, A], [A, SQh]].map(([x, y]) => sb.netAnimationCompat(x, y));
        check('6b. square <-> triangle is refused with the reason "the 3C family differs", whatever the format; netLerpSpecs gives null', r.every(x => !x.ok && /the 3C family differs/.test(x.reason)) && sb.netLerpSpecs(SQa, A, 0.5) === null);
        check('6c. triangle 3C <-> Regular / Field is refused (the earlier reason)', !sb.netAnimationCompat(A, { regular: true }).ok && !sb.netAnimationCompat({ x: { kind: 'trig', w: -1 }, y: 'same', domain: 'field' }, A).ok);
    });

    // ---- 7. export and session ----
    guard('7', () => {
        const sb = makeSb(SRC, 800, 600, 'triangle'), S = sb.netProjectiveSpec, A = S(2, 4, 'full', TRI), ex = sb.netTransformExportData(A, 3, 3, undefined, 'triangle'), json = JSON.parse(JSON.stringify(ex)), back = sb.netTransformFromExport(json);
        const sqEx = sb.netTransformExportData(S(2, 4, 'full', SQ), 3, 3, undefined, 'square');
        check('7. export: version 2, family triangle, tileShape triangle, geometryIsRegular, the SAME homography as the square (2,4); round trip gives the spec', json.version === 2 && json.kind === 'projective' && json.family === TRI && json.tileShape === 'triangle' && json.geometryIsRegular === true && /triangle/.test(json.facesMapping) && JSON.stringify(json.homography.rows) === JSON.stringify(sqEx.homography.rows) && back && back.family === TRI && back.a === 2 && back.b === 4 && back.format === 'full', JSON.stringify(back));
        check('7b. the export of a stale family on the sheet names the sheet\'s family; a half-format triangle spec exports projectiveIgnored', sb.netTransformExportData(S(2, 4, 'full', SQ), 3, 3, undefined, 'triangle').family === TRI && !!sb.netTransformExportData(S(3, 6, 'half', TRI), 3, 3, undefined, 'triangle').projectiveIgnored);
        const sess = new vm.Script(set.session), ctx = vm.createContext({ console }); sess.runInContext(ctx);
        const V = spec => { try { vm.runInContext('_vNetSpec(' + JSON.stringify(spec) + ', "t")', ctx); return null; } catch (e) { return String(e); } };
        const good = [S(1, 3, 'full', TRI), S(1, 4, 'full', TRI), S(3, 6, 'full', TRI), S(3, 6, 'half', TRI), S(2, 4, 'full', SQ), sb.netLerpSpecs(S(1, 3, 'full', TRI), S(3, 6, 'full', TRI), 0.5)];
        const bad = [S(0, 3, 'full', TRI), S(3, 3, 'full', TRI), S(1, 4, 'full', SQ), S(2, 13, 'full', TRI), Object.assign(S(2, 4, 'full', TRI), { family: 'X' }), Object.assign(S(2, 4, 'full', TRI), { family: undefined }), Object.assign(S(2, 4, 'full', TRI), { format: 'x' }), Object.assign(S(1.5, 4, 'full', TRI), {})];
        check('7c. the session validator accepts the triangle family (a = 1, a half-format spec the core refuses visibly) and refuses a = 0, a >= b, the square at a = 1, a bad family or format, non-integers', good.every(g => V(g) === null) && bad.every(g => V(g) !== null), good.map(g => V(g) ? 'REFUSED ' + JSON.stringify(g) + V(g) : '').join('') + bad.map(g => V(g) === null ? 'ACCEPTED ' + JSON.stringify(g) : '').join(''));
    });
    if (!opts.noOld) guard('7d', () => {
        const ctx = vm.createContext({ console }); new vm.Script(OLD.session).runInContext(ctx);
        const sb = makeSb(SRC, 600, 600, 'triangle'), run = spec => { try { vm.runInContext('_vNetSpec(' + JSON.stringify(spec) + ', "t")', ctx); return null; } catch (e) { return String(e); } };
        const r = run(sb.netProjectiveSpec(1, 3, 'full', TRI));
        check('7d. the validator of main (' + BASE + ') REFUSES a triangle spec (a = 1 and the family): a visible rejection, never a wrong picture', r !== null && /must be/.test(r), String(r).slice(0, 80));
    });

    // ---- 8. off path ----
    if (!opts.noOld) guard('8', () => {
        const SRC_OLD = join(OLD);
        const tri = [null, { x: { kind: 'trig', w: -0.8 }, y: 'same', domain: 'field' }, { x: { kind: 'geometric', w: 0.7 }, y: { kind: 'trig', w: 0.5 }, domain: 'field' }];
        const sq = [{ x: { kind: 'trig', w: -0.8 }, y: 'same', domain: 'field' }, { x: { kind: 'trig', w: 0.6 }, y: 'same', repeat: false }, { kind: 'projective', a: 2, b: 4, format: 'full', family: SQ }, { kind: 'projective', a: 3, b: 6, format: 'half', family: SQ }, { kind: 'projective', a: 2, b: 5, format: 'full', family: SQ }];
        let same = 0, total = 0, det = '';
        const draw = (src, shape, spec, faces) => { const sb = makeSb(src, 600, 600, shape); sb.baseNetTransform = spec; sb.connections = edgeConnections(sb); sb.showFaces = faces; sb.lines = []; sb.polys = []; sb.drawTessellation(); return JSON.stringify({ l: sb.lines, p: sb.polys }); };
        for (const [shape, specs] of [['triangle', tri], ['square', sq]]) for (const spec of specs) for (const faces of [false, true]) {
            let a, b; try { a = draw(SRC, shape, spec, faces); b = draw(SRC_OLD, shape, spec, faces); } catch (e) { a = 'X' + e.message; b = ''; }
            total++; if (a === b) same++; else det += ` ${shape} ${JSON.stringify(spec).slice(0, 40)} faces ${faces}`;
        }
        const exNew = sb => JSON.stringify(sb.netTransformExportData(sq[2], 3, 3, undefined, 'square')), sbN = makeSb(SRC, 600, 600, 'square'), sbO = makeSb(SRC_OLD, 600, 600, 'square');
        check('8. off path: no net, the triangle Field, the square Field and Single and the SQUARE 3C (full, half; faces on/off) draw byte-identical to main', same === total && total === 16, `${same}/${total}${det}`);
        check('8b. the square 3C export is byte-identical to main', exNew(sbN) === exNew(sbO) && sbN.netProjectiveInfo(sq[2], 600, 600).W === sbO.netProjectiveInfo(sq[2], 600, 600).W);
    });

    // ---- 9. overlay ----
    guard('9', () => {
        let ok = true, det = '', n = 0, nd = 0;
        for (const [a, b, cw, ch] of CASES.slice(0, 4)) {
            const sb = build(a, b, cw, ch), w = warpOf(sb), lines = sb.netGridLines(sb.baseNetTransform, sb.outerCorners, 3, { x0: 0, y0: 0, x1: cw, y1: ch }, { closed: true, domain: 'field', fieldTiles: 1 });
            for (const l of lines) {
                n++; if (![l.x1, l.y1, l.x2, l.y2].every(Number.isFinite) || Math.min(l.x1, l.x2) < -1e-6 || Math.max(l.x1, l.x2) > cw + 1e-6 || Math.min(l.y1, l.y2) < -1e-6 || Math.max(l.y1, l.y2) > ch + 1e-6) { ok = false; det = `${a},${b} line leaves the canvas`; continue; }
                const ca = latt(w, sb.invertNetWarp(w, { x: l.x1, y: l.y1 })), cb = latt(w, sb.invertNetWarp(w, { x: l.x2, y: l.y2 }));
                const lat = l.axis === 'v' ? Math.abs(ca.p - cb.p) < 1e-7 : l.axis === 'h' ? Math.abs(ca.q - cb.q) < 1e-7 : Math.abs((ca.p + ca.q) - (cb.p + cb.q)) < 1e-7;
                if (l.axis === 'd') nd++;
                if (!lat || !inRegion(a, b, ca.p, ca.q, 1e-6) || !inRegion(a, b, cb.p, cb.q, 1e-6)) { ok = false; det = `${a},${b}: ${l.axis} line off lattice or region`; }
            }
        }
        check('9. netGridLines on the triangle: p = const, q = const and the Baren p + q = const (axis d), cut with the region, inside the canvas', ok && n > 100 && nd > 8, det || `${n} lines, ${nd} Baren`);
    });
    return res;
}

// ================= run =================
let failures = 0, checks = 0;
const base = suite(NEW);
base.forEach(r => { checks++; if (!r.ok) failures++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail !== undefined && r.detail !== '' ? '  [' + r.detail + ']' : ''}`); });

console.log('== sabotages: each must turn at least one check red ==');
const SAB = [
    ['S1  the triangle stretch without the sqrt 3 reference', s => { s.netwarp = mut(s.netwarp, '* (tri ? Math.sqrt(3) : 1)', '* 1'); }],
    ['S2  edit tile = the farthest mesh (not the one nearest the middle)', s => { s.netwarp = mut(s.netwarp, 'd < best.d))', 'd > best.d))'); }],
    ['S3  the half format allowed on the triangle', s => { s.netwarp = mut(s.netwarp, "else if (tri && spec.format !== 'full') reason =", "else if (false && spec.format !== 'full') reason ="); }],
    ['S4  tile hook never skips', s => { s.netwarp = mut(s.netwarp, 'return vmax <= P.a + _PROJ_TOL', 'return false && vmax <= P.a + _PROJ_TOL'); }],
    ['S5  netAnimationCompat lets square <-> triangle pass', s => { s.netwarp = mut(s.netwarp, 'if (from.family !== to.family) return', 'if (false) return'); }],
    ['S6  export without tileShape', s => { s.netwarp = mut(s.netwarp, "if (tri) out.tileShape = 'triangle';", ''); }],
    ['S7  session validator without the family check', s => { s.session = mut(s.session, "if (o.family !== '\\u25a1N' && !tri) throw", 'if (false) throw'); }],
    ['S8  a >= 2 on the triangle too', s => { s.netwarp = mut(s.netwarp, "return family === '\\u25b3N' ? 1 : 2;", 'return 2;'); }],
    ['S9  the family does not follow the shape (stale family kept)', s => { s.netwarp = mut(s.netwarp, '        spec = netProjectiveForShape(spec, shape);\n', ''); }],
    ['S10 the projective branch always taken (off path)', s => { s.netwarp = mut(s.netwarp, "if (spec.kind === 'projective') return _netProjectiveWarp(spec, frame);", "if (true) return _netProjectiveWarp(spec, frame);"); }],
    ['S11 cut only at v >= a, not at v <= b', s => { s.netwarp = mut(s.netwarp, '[-1, -1, b]', '[0, 0, 1]'); }]
];
for (const [name, fn] of SAB) {
    const set = Object.assign({}, NEW); let red = [];
    try { fn(set); red = suite(set, { noOld: false }).filter(r => !r.ok).map(r => r.name.slice(0, 40)); } catch (e) { red = ['sabotage setup: ' + e.message]; }
    checks++; const ok = red.length > 0 && !red[0].startsWith('sabotage setup'); if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  [red: ${red.length}${red.length ? ' - ' + red.slice(0, 3).join(' | ') : ''}]`);
}
console.log(`\n${checks - failures}/${checks} passed${failures ? ', ' + failures + ' FAILED' : ''}`);
process.exit(failures ? 1 : 0);
