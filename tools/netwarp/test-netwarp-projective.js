/**
 * tools/netwarp/test-netwarp-projective.js
 * Task 121 (3C-1): the projective net (Moebius net, square family, core/netwarp.js "projective"). The prototype H of tools/grid/measure-3c.js is the
 * counterpart: its formulas are written out again here (independent of core/).
 *
 *   node tools/netwarp/test-netwarp-projective.js
 *
 *  1. The map equals the prototype (full and half, non-square canvases); the edit tile lies in the picture.
 *  2. Lines: the cut (netWarpSplitSegment) is the exact clip with the region; image of the cut = chord; the sink draws nothing for [].
 *  3. The real pipeline (drawTessellation): every drawn line lies in the canvas, equals the image of the exact cut; tile loop = b x b (half b x b/2).
 *  4. Faces: polygon edges are exact chords (collinear under the inverse), tiles outside draw nothing, every coordinate is finite and bounded (a >= 2).
 *  5. Inverse, hit test, free endpoint (netWarpFieldLocal), the 3 x 3 matrix of the export.
 *  6. W and the tile counts against Messung 2 / 5 (tools/grid/measure-3c.js, reports/120-messung.md); a = 1 and bad specs are refused visibly.
 *  7. Timeline: 3C <-> 3C interpolates (exact at the ends), everything else is refused with a reason.
 *  8. Export (version 2) round trip; session validator (new: accepts / refuses; main's validator rejects a 3C spec visibly).
 *  9. Off path: with no net and with every legacy spec the drawing is byte-identical to main.
 * 10. Sabotages S1 to S10: each must turn at least one check red.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = 'e0063493';   // main at the start of task 121 (the validator and the drawing of main)
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export', 'farborgel-bridge'];
const readNew = f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8');
const readOld = f => execSync(`git show ${BASE}:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
const NEW = {}, OLD = {};
FILES.concat(['session']).forEach(f => { NEW[f] = readNew(f); OLD[f] = readOld(f); });
const join = set => FILES.map(f => set[f]).join('\n');
const mut = (src, from, to) => { if (!src.includes(from)) throw new Error('sabotage text not found: ' + from.slice(0, 60)); return src.replace(from, to); };

let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const WX = 600;
function makeSb(src, cw, ch) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        line: (a, b, c, d) => sb.lines.push([a, b, c, d]), bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, stroke: () => { }, noFill: () => { }, CLOSE: 'close',
        fill: c => { sb._fill = c; }, beginShape: () => { sb._cur = []; }, vertex: (x, y) => { sb._cur.push({ x, y }); }, endShape: () => { sb.polys.push({ fill: sb._fill, pts: sb._cur }); sb._cur = null; },
        document: { body: {} }, getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }), showNodes: true, width: cw, height: ch, canvasW: cw, canvasH: ch, showFaces: false,
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, activeNetWarp: null, lineColor: '#000000', altNetSeed: null,
        currentShape: 'square', shapeSizeFactor: 3, nodeCount: 4, symmetryMode: 'none', timeline: null, activeLayer: 'base',
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, lines: [], polys: []
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb); vm.runInContext(src, sb);
    const g = sb.buildSquareGrid(4, 3, cw, ch); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
    return sb;
}
const CONNS = [[1, 16], [4, 13], [2, 8], [8, 15], [15, 9], [9, 2], [1, 4], [5, 12]];
const proto = (a, b, half, W, H) => (p, q) => { const v = p + q, x = (p - q) / v, y = (1 / a - 1 / v) / (1 / a - 1 / b); return { x: (half ? x : (x + 1) / 2) * W, y: (1 - y) * H }; };   // measure-3c.js H, written out again
const inRegion = (a, b, half, p, q, tol = 1e-7) => p >= -tol && q >= -tol && p + q >= a - tol && p + q <= b + tol && (!half || p >= q - tol);
const CASES = [[2, 4, 'full', 800, 600], [3, 6, 'half', 600, 600], [2, 5, 'full', 1200, 600], [4, 8, 'full', 600, 900], [2, 6, 'half', 500, 600], [2, 3, 'full', 600, 600], [11, 12, 'half', 700, 500]];

// the whole suite on one source set; returns [{name, ok, detail}]
function suite(set, opts = {}) {
    const res = [];
    const check = (name, ok, detail) => res.push({ name, ok: !!ok, detail });
    const guard = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw: ' + String(e && e.message || e).slice(0, 80) + ')', false); } };
    const SRC = join(set);
    const build = (a, b, fmt, cw, ch) => { const sb = makeSb(SRC, cw, ch); sb.baseNetTransform = sb.netProjectiveSpec(a, b, fmt); sb.connections = CONNS.map(c => c.slice()); return sb; };
    const warpOf = sb => sb.netWarpForBase(sb.baseNetTransform, 'square', sb.outerCorners, sb.nodeCount, sb.shapeSizeFactor);
    const regPt = (sb, w, p, q) => sb.projective_pt = (() => { const P = w.projective, F = w.frame; return { x: F.c0.x + (p - P.i0) * F.v1.x + (q - P.j0) * F.v2.x, y: F.c0.y + (p - P.i0) * F.v1.y + (q - P.j0) * F.v2.y }; })();

    // ---- 1. the map equals the prototype ----
    guard('1', () => {
        let worst = 0, n = 0, bad = 0;
        for (const [a, b, fmt, cw, ch] of CASES) {
            const sb = build(a, b, fmt, cw, ch), w = warpOf(sb), half = fmt === 'half', H = proto(a, b, half, cw, ch);
            if (!w) { bad++; continue; }
            for (let k = 0; k < 400; k++) {
                const p = rnd() * (b + 1), q = rnd() * (b + 1); if (p + q < a) continue;
                const r = sb.applyNetWarp(w, regPt(sb, w, p, q)), e = H(p, q); worst = Math.max(worst, Math.hypot(r.x - e.x, r.y - e.y) / Math.max(1, Math.abs(e.y) / ch)); n++;
            }
        }
        check('1. applyNetWarp equals the prototype H (full and half, 7 canvases)', bad === 0 && n > 1000 && worst < 1e-6, `${n} points, worst ${worst.toExponential(2)}`);
    });
    guard('1b', () => {
        let ok = true, det = '';
        for (const [a, b, fmt, cw, ch] of CASES) {
            const sb = build(a, b, fmt, cw, ch), w = warpOf(sb), F = w.frame, P = w.projective;
            const centre = { x: F.c0.x + 0.5 * F.v1.x + 0.5 * F.v2.x, y: F.c0.y + 0.5 * F.v1.y + 0.5 * F.v2.y }, im = sb.applyNetWarp(w, centre);
            const inCanvas = im.x >= 0 && im.x <= cw && im.y >= 0 && im.y <= ch && sb.netWarpInsideNet(w, im);
            if (!inCanvas) { ok = false; det = `${a},${b},${fmt}: edit tile (${P.i0},${P.j0}) centre at ${im.x.toFixed(1)},${im.y.toFixed(1)}`; }
        }
        check('1b. the edit tile (node dots, hit test) lies inside the picture', ok, det);
    });

    // ---- 2. the cut ----
    guard('2', () => {
        let bad = 0, n = 0, drawnTotal = 0, emptyTotal = 0, worstChord = 0;
        for (const [a, b, fmt, cw, ch] of CASES) {
            const sb = build(a, b, fmt, cw, ch), w = warpOf(sb), P = w.projective, half = fmt === 'half', H = proto(a, b, half, cw, ch);
            for (let k = 0; k < 600; k++) {
                const p1 = [rnd() * (b + 2) - 1, rnd() * (b + 2) - 1], p2 = [rnd() * (b + 2) - 1, rnd() * (b + 2) - 1];
                const R1 = regPt(sb, w, p1[0], p1[1]), R2 = regPt(sb, w, p2[0], p2[1]), cut = sb.netWarpSplitSegment(w, R1, R2); n++;
                // sample the true segment: the points inside the region must be exactly the clipped part
                const inside = []; for (let i = 0; i <= 400; i++) { const t = i / 400, p = p1[0] + t * (p2[0] - p1[0]), q = p1[1] + t * (p2[1] - p1[1]); if (inRegion(a, b, half, p, q, 0)) inside.push(t); }
                if (cut.length === 0) { emptyTotal++; if (inside.length > 2) bad++; continue; }
                drawnTotal++;
                const A = sb.projective_pt && null, ends = cut.map(c => { const F = w.frame, dx = c.x - F.c0.x, dy = c.y - F.c0.y; return { p: (dx * F.v2.y - dy * F.v2.x) / F.det + P.i0, q: (F.v1.x * dy - F.v1.y * dx) / F.det + P.j0 }; });
                if (!ends.every(e => inRegion(a, b, half, e.p, e.q, 1e-7))) { bad++; continue; }
                if (inside.length) {
                    const tp = t => p1[0] + t * (p2[0] - p1[0]), tq = t => p1[1] + t * (p2[1] - p1[1]), len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
                    const e0 = Math.hypot(ends[0].p - tp(inside[0]), ends[0].q - tq(inside[0])), e1 = Math.hypot(ends[1].p - tp(inside[inside.length - 1]), ends[1].q - tq(inside[inside.length - 1]));
                    if (Math.max(e0, e1) > len / 400 + 1e-6) bad++;
                }
                // the image of an inner point lies on the chord of the images of the ends
                const IA = sb.applyNetWarp(w, cut[0]), IB = sb.applyNetWarp(w, cut[1]), mid = sb.applyNetWarp(w, { x: (cut[0].x + cut[1].x) / 2, y: (cut[0].y + cut[1].y) / 2 }), L = Math.hypot(IB.x - IA.x, IB.y - IA.y);
                if (L > 1e-6) { const d = Math.abs((mid.x - IA.x) * (IB.y - IA.y) - (mid.y - IA.y) * (IB.x - IA.x)) / L; worstChord = Math.max(worstChord, d); }
            }
        }
        check('2. the cut = the exact clip with the region (both ends on or inside, covers every inside sample, [] only when outside)', bad === 0 && drawnTotal > 500 && emptyTotal > 200, `${n} segments, ${drawnTotal} drawn, ${emptyTotal} outside, ${bad} bad`);
        check('2b. the image of the midpoint of a cut lies on the chord of its ends (<= 1e-8 px)', worstChord < 1e-8, `worst ${worstChord.toExponential(2)} px`);
    });
    guard('2c', () => {
        const sb = build(2, 4, 'full', 800, 600), w = warpOf(sb), P = w.projective;
        // the sink: a segment entirely at v < a draws nothing and collects nothing; one across v = a ends exactly on v = a
        sb.activeNetWarp = w; sb.lines = []; const col = []; sb.segmentCollector = col;
        sb.drawCurvedBezier(regPt(sb, w, 0.2, 0.3), regPt(sb, w, 1.0, 0.4), { kind: 'straight' }, 1, 2);
        const none = col.length === 0;
        sb.drawCurvedBezier(regPt(sb, w, 1.0, 0.0), regPt(sb, w, 2.0, 1.0), { kind: 'straight' }, 1, 2);
        const one = col.length === 1, c = col[0], pxA = proto(2, 4, false, 800, 600);
        const endOk = one && (Math.hypot(c.x1 - pxA(1.5, 0.5).x, c.y1 - pxA(1.5, 0.5).y) < 1e-6 || Math.hypot(c.x2 - pxA(1.5, 0.5).x, c.y2 - pxA(1.5, 0.5).y) < 1e-6);
        sb.segmentCollector = null; sb.activeNetWarp = null;
        check('2c. the sink: a segment outside draws nothing; across v = a it ends exactly on v = a', none && one && endOk, `outside ${col.length === 1 ? 'nothing' : 'drew'}, across ${one}`);
    });

    guard('2d', () => {
        const sb = build(2, 4, 'full', 800, 600), w = warpOf(sb); sb.activeNetWarp = w; const svg = []; sb.svgPathCollector = svg; let threw = null;
        try { sb.drawCurvedBezier(regPt(sb, w, 0.2, 0.3), regPt(sb, w, 1.0, 0.4), { kind: 'straight' }, 1, 2); sb.drawCurvedBezier(regPt(sb, w, 1.0, 0.0), regPt(sb, w, 2.0, 1.0), { kind: 'straight' }, 1, 2); } catch (e) { threw = e; }
        sb.svgPathCollector = null; sb.activeNetWarp = null;
        check('2d. the sink, SVG path: a segment outside adds no path (and does not throw), one across v = a adds one M..L path', !threw && svg.length === 1 && /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/.test(svg[0]), threw ? String(threw).slice(0, 60) : svg.join(' | '));
    });

    // ---- 3. the pipeline ----
    guard('3', () => {
        for (const [a, b, fmt, cw, ch] of [CASES[0], CASES[1], CASES[2], CASES[3]]) {
            const sb = build(a, b, fmt, cw, ch), w = warpOf(sb), half = fmt === 'half', calls = [], orig = sb.drawCurvedBezier;
            sb.drawCurvedBezier = function (p1, p2, ct, i1, i2) { const i0 = sb.lines.length; orig.call(this, p1, p2, ct, i1, i2); calls.push({ p1, p2, from: i0, to: sb.lines.length }); };
            sb.lines = []; sb.drawTessellation(); sb.drawCurvedBezier = orig;
            let outside = 0, offcut = 0, nonFinite = 0;
            const eps = 1e-6;
            for (const l of sb.lines) { if (!l.every(Number.isFinite)) nonFinite++; if (l[0] < -eps || l[0] > cw + eps || l[2] < -eps || l[2] > cw + eps || l[1] < -eps || l[1] > ch + eps || l[3] < -eps || l[3] > ch + eps) outside++; }
            for (const c of calls) {
                const cut = sb.netWarpSplitSegment(w, c.p1, c.p2), want = cut.length < 2 ? 0 : 1;
                if (c.to - c.from !== want) { offcut++; continue; }
                if (want) { const A = sb.applyNetWarp(w, cut[0]), B = sb.applyNetWarp(w, cut[1]), l = sb.lines[c.from]; if (Math.hypot(l[0] - A.x, l[1] - A.y) > 1e-9 || Math.hypot(l[2] - B.x, l[3] - B.y) > 1e-9) offcut++; }
            }
            check(`3. ${a},${b} ${fmt} ${cw}x${ch}: ${sb.lines.length} lines drawn, all finite and inside the canvas, each = the image of its exact cut`, sb.lines.length > 20 && nonFinite === 0 && outside === 0 && offcut === 0, `outside ${outside}, off-cut ${offcut}, non-finite ${nonFinite}`);
        }
    });
    guard('3b', () => {
        // the tile loop: the tiles the sink is asked about = the lattice rectangle (b x b, half: b x ceil(b/2)), counted as distinct tiles of the base node 1 -> 16 diagonal
        for (const [a, b, fmt, cw, ch] of [CASES[0], CASES[1], CASES[3]]) {
            const sb = build(a, b, fmt, cw, ch), w = warpOf(sb), P = w.projective, tiles = new Set();
            sb.connections = [[1, 16]]; const orig = sb.drawCurvedBezier;
            sb.drawCurvedBezier = function (p1, p2, ct, i1, i2) { const F = w.frame, dx = (p1.x + p2.x) / 2 - F.c0.x, dy = (p1.y + p2.y) / 2 - F.c0.y; tiles.add(Math.floor((dx * F.v2.y - dy * F.v2.x) / F.det + P.i0) + ',' + Math.floor((F.v1.x * dy - F.v1.y * dx) / F.det + P.j0)); return orig.call(this, p1, p2, ct, i1, i2); };
            sb.drawTessellation(); sb.drawCurvedBezier = orig;
            check(`3b. ${a},${b} ${fmt}: the tile loop visits exactly ${P.nx} x ${P.ny} tiles`, tiles.size === P.nx * P.ny, `${tiles.size}`);
        }
    });

    // ---- 4. faces ----
    guard('4', () => {
        for (const [a, b, fmt, cw, ch] of [CASES[0], CASES[1], CASES[2]]) {
            const sb = build(a, b, fmt, cw, ch), w = warpOf(sb); sb.showFaces = true; sb.connections = [[1, 16], [4, 13], [1, 4], [13, 16], [2, 15], [8, 9]];
            sb.polys = []; sb.drawTessellation();
            const polys = sb.polys.filter(p => p.pts.length >= 3);
            let nonFinite = 0, far = 0, bent = 0;
            for (const p of polys) {
                for (const v of p.pts) { if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) nonFinite++; else if (v.x < (fmt === 'half' ? -cw : 0) - 1e-6 || v.x > cw + 1e-6 || v.y < -1.0001 * ch || v.y > 4.0001 * ch + 1) far++; }   // half: the tiles on the axis p = q reach left of the frame (x down to -W), cut by the canvas
                for (let i = 0; i < p.pts.length; i++) {   // an edge is the exact image of the regular edge: its midpoint's preimage is collinear with the preimages of its ends
                    const A = p.pts[i], B = p.pts[(i + 1) % p.pts.length], pa = sb.invertNetWarp(w, A), pb = sb.invertNetWarp(w, B), pm = sb.invertNetWarp(w, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
                    const L = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1, d = Math.abs((pm.x - pa.x) * (pb.y - pa.y) - (pm.y - pa.y) * (pb.x - pa.x)) / L;
                    if (d > 1e-6 * Math.max(1, L)) bent++;
                }
            }
            check(`4. ${a},${b} ${fmt}: ${polys.length} face polygons, all finite, within -1 H .. 4 H, every edge an exact chord`, polys.length > 10 && nonFinite === 0 && far === 0 && bent === 0, `non-finite ${nonFinite}, far ${far}, bent ${bent}`);
        }
    });
    guard('4b', () => {
        const sb = build(2, 4, 'full', 800, 600), w = warpOf(sb), F = w.frame, P = w.projective, ctr = sb.centroid;
        const tileC = (i, j) => ({ x: ctr.x + (i - P.i0) * F.v1.x + (j - P.j0) * F.v2.x, y: ctr.y + (i - P.i0) * F.v1.y + (j - P.j0) * F.v2.y });
        let want = 0, got = 0, wrong = [];
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
            const outside = i + j + 2 <= 2 || i + j >= 4, r = sb.netWarpTileOutsideCanvas(w, tileC(i, j), false); want += outside ? 1 : 0; got += r ? 1 : 0; if (r !== outside) wrong.push(`${i},${j}`);
        }
        check('4b. netWarpTileOutsideCanvas: tiles with v_max <= a or v_min >= b skip their fills (2,4: 7 of 16), the others not', wrong.length === 0, `want ${want}, got ${got}, wrong ${wrong.join(' ')}`);
    });
    guard('4c', () => {
        const sb = build(2, 4, 'full', 800, 600), w = warpOf(sb);
        const finite = [[0, 0], [0, 1e-9], [-0.5, 0.2], [0.0005, 0.0003], [-3, -3]].every(([p, q]) => { const r = sb.applyNetWarp(w, regPt(sb, w, p, q)); return Number.isFinite(r.x) && Number.isFinite(r.y); });
        check('4c. applyNetWarp is finite at the vanishing line (v = 0, v < 0)', finite);
    });

    // ---- 5. inverse, hit test, free endpoint, matrix ----
    guard('5', () => {
        let worst = 0, n = 0;
        for (const [a, b, fmt, cw, ch] of CASES) {
            const sb = build(a, b, fmt, cw, ch), w = warpOf(sb);
            for (let k = 0; k < 300; k++) { const p = rnd() * (b + 1), q = rnd() * (b + 1); if (p + q < a) continue; const R = regPt(sb, w, p, q), I = sb.invertNetWarp(w, sb.applyNetWarp(w, R)); worst = Math.max(worst, Math.hypot(I.x - R.x, I.y - R.y) / Math.hypot(w.frame.v1.x, w.frame.v1.y)); n++; }
        }
        check('5. invertNetWarp(applyNetWarp(P)) = P (full and half)', n > 1000 && worst < 1e-9, `${n} points, worst ${worst.toExponential(2)} tiles`);
    });
    guard('5b', () => {
        let ok = true, det = '', n = 0;
        for (const [a, b, fmt, cw, ch] of CASES) {
            const sb = build(a, b, fmt, cw, ch), w = warpOf(sb), half = fmt === 'half', P = w.projective;
            for (let k = 0; k < 200; k++) {
                const X = rnd() * cw, Y = rnd() * ch, click = { x: X, y: Y }, inside = sb.netWarpInsideNet(w, click), loc = sb.netWarpFieldLocal(w, click);
                // the click in lattice coordinates, independently: invert the 3 x 3 matrix of the export
                const ex = sb.netTransformExportData(sb.baseNetTransform, 3, 3, undefined, 'square'), M = ex.homography.rows;
                const det3 = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
                const inv = [[(M[1][1] * M[2][2] - M[1][2] * M[2][1]), (M[0][2] * M[2][1] - M[0][1] * M[2][2]), (M[0][1] * M[1][2] - M[0][2] * M[1][1])], [(M[1][2] * M[2][0] - M[1][0] * M[2][2]), (M[0][0] * M[2][2] - M[0][2] * M[2][0]), (M[0][2] * M[1][0] - M[0][0] * M[1][2])], [(M[1][0] * M[2][1] - M[1][1] * M[2][0]), (M[0][1] * M[2][0] - M[0][0] * M[2][1]), (M[0][0] * M[1][1] - M[0][1] * M[1][0])]].map(r => r.map(v => v / det3));
                const hx = inv[0][0] * X + inv[0][1] * Y + inv[0][2], hy = inv[1][0] * X + inv[1][1] * Y + inv[1][2], hw = inv[2][0] * X + inv[2][1] * Y + inv[2][2], pp = hx / hw, qq = hy / hw;
                const want = inRegion(a, b, half, pp, qq, 1e-9); n++;
                if (inside !== want && Math.abs((pp + qq) - a) > 1e-6 && Math.abs((pp + qq) - b) > 1e-6 && Math.abs(pp) > 1e-6 && Math.abs(qq) > 1e-6 && Math.abs(pp - qq) > 1e-6) { ok = false; det = `${a},${b},${fmt}: hit test ${inside} vs matrix ${want}`; }
                if (want && inside) {
                    if (!loc) { ok = false; det = 'no local'; continue; }
                    const F = w.frame, ti = Math.floor(pp), tj = Math.floor(qq), lp = pp - ti, lq = qq - tj;
                    if (Math.abs(loc.local.l - lp) > 1e-7 || Math.abs(loc.local.m - lq) > 1e-7 || loc.tile.i !== Math.min(ti, P.nx - 1) - P.i0 || loc.tile.j !== Math.min(tj, P.ny - 1) - P.j0) { ok = false; det = `${a},${b},${fmt}: local ${JSON.stringify(loc.local)} tile ${JSON.stringify(loc.tile)} vs ${lp},${lq}`; }
                    // a click inside the edit tile comes back exactly through the map
                    if (loc.tile.i === 0 && loc.tile.j === 0) { const back = sb.applyNetWarp(w, loc); if (Math.hypot(back.x - X, back.y - Y) > 1e-6) { ok = false; det = `${a},${b},${fmt}: edit-tile click does not come back`; } }
                }
            }
        }
        check('5b. hit test and netWarpFieldLocal agree with the inverse of the exported 3 x 3 matrix (tile, local, edit-tile round trip)', ok && n > 1000, det || `${n} clicks`);
    });

    // ---- 6. W and the tile counts ----
    guard('6', () => {
        const ROWS = [[2, 4, 'full', 6, 16, 9], [3, 6, 'half', 6.75, 18, 10], [2, 5, 'full', 10.5, 25, 14], [3, 6, 'full', 13.5, 36, 18], [4, 8, 'full', 24, 64, 30], [2, 6, 'half', 8, 18, 11], [3, 7, 'half', 10, 21, 0], [4, 7, 'full', 16.5, 49, 0]];
        let ok = true, det = '';
        for (const [a, b, fmt, W, tiles, withArea] of ROWS) {
            const sb = makeSb(SRC, 600, 600), info = sb.netProjectiveInfo(sb.netProjectiveSpec(a, b, fmt), 600, 600), f = (b * b - a * a) / 2 / (fmt === 'half' ? 2 : 1);
            const nt = info.tiles.x * info.tiles.y;
            if (!info.valid || Math.abs(info.W - f) > 1e-9 || Math.abs(info.W - W) > 1e-9 || (tiles && nt !== (fmt === 'half' ? b * Math.ceil(b / 2) : tiles)) || (withArea && info.tilesWithArea !== withArea)) { ok = false; det += ` ${a},${b},${fmt}: W ${info.W} tiles ${nt} area ${info.tilesWithArea};`; }
        }
        check('6. W = (b^2 - a^2)/2 (half /2) and the tile counts equal Messung 2 and 5', ok, det);
        const sb = makeSb(SRC, 600, 600), bad = [[1, 4, 'full'], [2, 2, 'full'], [3, 2, 'full'], [2.5, 4, 'full'], [2, 13, 'full'], [2, 4, 'x'], [0, 4, 'full']];
        check('6b. a = 1, a >= b, a non-integer, b > 12, bad format are refused visibly (reason, no warp)', bad.every(([a, b, f]) => { const sp = Object.assign(sb.netProjectiveSpec(a, b, 'full'), { format: f }); const e = sb.netProjectiveEffective(sp, 'square'); return !e.valid && typeof e.reason === 'string' && e.reason.length > 5 && sb.netWarpForBase(sp, 'square', sb.outerCorners, 4, 3) === null; }));   // task 127 pin (old -> new): the hexagon has its own 3C now (test-netwarp-projective-hex.js); it was refused here (task 124: the hexagon stays refused)
        const ex = sb.netTransformExportData(Object.assign(sb.netProjectiveSpec(1, 4, 'full')), 3, 3, undefined, 'square');
        check('6c. an invalid spec exports projectiveIgnored (a = 1: Fig. 148 is a ROADMAP note)', ex.projectiveIgnored && /at least 2/.test(ex.projectiveIgnored.reason), JSON.stringify(ex.projectiveIgnored));
    });

    // ---- 7. timeline ----
    guard('7', () => {
        const sb = makeSb(SRC, 600, 600), S = sb.netProjectiveSpec, A = S(2, 4, 'full'), B = S(3, 6, 'full'), HF = S(2, 4, 'half');
        const REG = { regular: true }, FIELD = { x: { kind: 'trig', w: -1 }, y: 'same', domain: 'field' }, SINGLE = { x: { kind: 'trig', w: 0.5 }, y: 'same' }, TILED = { x: { kind: 'trig', w: 0.5 }, y: 'same', repeat: true };
        const ok1 = sb.netAnimationCompat(A, B).ok && sb.netAnimationCompat(B, A).ok;
        const l0 = sb.netLerpSpecs(A, B, 0), l1 = sb.netLerpSpecs(A, B, 1), lh = sb.netLerpSpecs(A, B, 0.5);
        check('7. 3C <-> 3C interpolates; exact at the ends; in between a, b real and the spec valid', ok1 && l0.a === 2 && l0.b === 4 && l1.a === 3 && l1.b === 6 && lh.a === 2.5 && lh.b === 5 && lh.interp === true && sb.netProjectiveEffective(lh, 'square').valid && sb.netWarpForBase(lh, 'square', sb.outerCorners, 4, 3) !== null);
        const refused = [[A, REG], [REG, A], [A, null], [A, FIELD], [FIELD, A], [A, SINGLE], [TILED, A], [A, HF], [HF, A]].map(([x, y]) => sb.netAnimationCompat(x, y));
        check('7b. 3C <-> Regular / Field / Single / Tiled / other format is refused with a reason, netLerpSpecs gives null', refused.every(r => !r.ok && typeof r.reason === 'string' && r.reason.length > 10) && sb.netLerpSpecs(A, REG, 0.5) === null && sb.netLerpSpecs(FIELD, A, 0.5) === null);
        check('7c. the legacy pairs are unchanged (Field <-> Field ok, regular <-> Single ok, Field <-> Single refused)', sb.netAnimationCompat(FIELD, FIELD).ok && sb.netAnimationCompat(REG, SINGLE).ok && !sb.netAnimationCompat(FIELD, SINGLE).ok);
    });

    // ---- 8. export and session ----
    guard('8', () => {
        const sb = makeSb(SRC, 800, 600), A = sb.netProjectiveSpec(3, 6, 'half'), ex = sb.netTransformExportData(A, 3, 3, undefined, 'square'), json = JSON.parse(JSON.stringify(ex)), back = sb.netTransformFromExport(json);
        check('8. export: version 2, kind projective, geometryIsRegular, faces mapping, no fieldBase / gridShiftPx; round trip gives the spec', json.version === 2 && json.kind === 'projective' && json.geometryIsRegular === true && json.facesOmitted === false && json.layerFacesOmitted === true && typeof json.facesMapping === 'string' && json.fieldBase === undefined && json.gridShiftPx === undefined && json.W === 6.75 && JSON.stringify(back) === JSON.stringify(A), JSON.stringify(back));
        const lerp = sb.netLerpSpecs(sb.netProjectiveSpec(2, 4, 'full'), sb.netProjectiveSpec(3, 6, 'full'), 0.5), back2 = sb.netTransformFromExport(JSON.parse(JSON.stringify(sb.netTransformExportData(lerp, 3, 3, undefined, 'square'))));
        check('8b. an interpolated frame exports and reads back valid (interp kept)', back2 && back2.interp === true && back2.a === lerp.a && sb.netProjectiveEffective(back2, 'square').valid);
        const legacy = sb.netTransformExportData({ x: { kind: 'trig', w: -0.5 }, y: 'same', repeat: false }, 3, 1, undefined, 'square');
        check('8c. a legacy export is still version 1', legacy.version === 1 && legacy.kind === undefined);
        const sess = new vm.Script(set.session), ctx = vm.createContext({ console }); sess.runInContext(ctx);
        const V = (spec) => { try { vm.runInContext('_vNetSpec(' + JSON.stringify(spec) + ', "t")', ctx); return null; } catch (e) { return String(e); } };
        const good = [A, sb.netProjectiveSpec(2, 4, 'full'), lerp];
        const badSpecs = [sb.netProjectiveSpec(1, 4, 'full'), sb.netProjectiveSpec(4, 4, 'full'), sb.netProjectiveSpec(5, 4, 'full'), sb.netProjectiveSpec(2, 13, 'full'), Object.assign(sb.netProjectiveSpec(2, 4, 'full'), { format: 'x' }), Object.assign(sb.netProjectiveSpec(2, 4, 'full'), { family: 'XN' }), sb.netProjectiveSpec(2.5, 4, 'full'), Object.assign(sb.netProjectiveSpec(2, 4, 'full'), { interp: 'yes' })];
        check('8d. the session validator accepts valid 3C specs and refuses a = 1, a >= b, b > 12, format, family, non-integers', good.every(g => V(g) === null) && badSpecs.every(g => V(g) !== null), badSpecs.map(g => V(g) === null ? 'ACCEPTED ' + JSON.stringify(g) : '').join(''));
        check('8e. the legacy specs still validate', V({ x: { kind: 'trig', w: -1 }, y: 'same', domain: 'field' }) === null && V({ regular: true }) === null);
    });
    if (!opts.noOld) guard('8f', () => {
        const ctx = vm.createContext({ console }); new vm.Script(OLD.session).runInContext(ctx);
        const sb = makeSb(SRC, 600, 600), r = (() => { try { vm.runInContext('_vNetSpec(' + JSON.stringify(sb.netProjectiveSpec(2, 4, 'full')) + ', "t")', ctx); return null; } catch (e) { return String(e); } })();
        check('8f. the validator of main (' + BASE + ') REJECTS a 3C spec visibly (no schema bump needed)', r !== null && /must be/.test(r), String(r).slice(0, 80));
    });

    // ---- 9. off path ----
    if (!opts.noOld) guard('9', () => {
        const SRC_OLD = join(OLD);
        const specs = [null, { x: { kind: 'trig', w: -0.8 }, y: 'same', domain: 'field' }, { x: { kind: 'trig', w: 0.6 }, y: { kind: 'geometric', w: 0.7 }, repeat: false }, { x: { kind: 'trig', w: 0.5 }, y: 'same', repeat: true }, { x: { kind: 'geometric', w: 1, alternate: true }, y: 'same', repeat: true, macro: 2 }];
        let same = 0, total = 0, det = '';
        for (const spec of specs) for (const faces of [false, true]) for (const R of [3, 5]) {
            const out = [SRC, SRC_OLD].map(src => { const sb = makeSb(src, 600, 600); sb.shapeSizeFactor = R; const g = sb.buildSquareGrid(4, R, 600, 600); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners; sb.baseNetTransform = spec; sb.connections = CONNS.map(c => c.slice()); sb.showFaces = faces; sb.lines = []; sb.polys = []; sb.drawTessellation(); return JSON.stringify([sb.lines, sb.polys]); });
            total++; if (out[0] === out[1]) same++; else det = JSON.stringify(spec) + ' faces ' + faces + ' R ' + R;
        }
        check('9. off path: no net and every legacy spec (Field, Single, Tiled; faces on/off; sizes 3, 5) draw byte-identical to main', same === total && total === 20, `${same}/${total} ${det}`);
    });

    // ---- the net lines overlay ----
    guard('10', () => {
        let ok = true, det = '', n = 0;
        for (const [a, b, fmt, cw, ch] of CASES.slice(0, 4)) {
            const sb = build(a, b, fmt, cw, ch), w = warpOf(sb), half = fmt === 'half', lines = sb.netGridLines(sb.baseNetTransform, sb.outerCorners, 3, { x0: 0, y0: 0, x1: cw, y1: ch }, { closed: true, domain: 'field', fieldTiles: 1 });
            const macro = lines.filter(l => l.level === 'macro').length;
            for (const l of lines) {
                n++; if (![l.x1, l.y1, l.x2, l.y2].every(Number.isFinite) || l.x1 < -1e-6 || l.x2 > cw + 1e-6 || l.y1 < -1e-6 || l.y2 > ch + 1e-6 || l.x2 < -1e-6 || l.x1 > cw + 1e-6 || l.y1 > ch + 1e-6 || l.y2 < -1e-6) { ok = false; det = `${a},${b} line leaves the canvas`; continue; }
                const A = sb.invertNetWarp(w, { x: l.x1, y: l.y1 }), B = sb.invertNetWarp(w, { x: l.x2, y: l.y2 }), F = w.frame, P = w.projective;
                const co = pt => { const dx = pt.x - F.c0.x, dy = pt.y - F.c0.y; return { p: (dx * F.v2.y - dy * F.v2.x) / F.det + P.i0, q: (F.v1.x * dy - F.v1.y * dx) / F.det + P.j0 }; }, ca = co(A), cb = co(B);
                const lat = l.axis === 'v' ? Math.abs(ca.p - cb.p) < 1e-7 : Math.abs(ca.q - cb.q) < 1e-7;
                if (!lat || !inRegion(a, b, half, ca.p, ca.q, 1e-6) || !inRegion(a, b, half, cb.p, cb.q, 1e-6)) { ok = false; det = `${a},${b},${fmt}: ${l.axis} line off lattice or region`; }
            }
            if (macro < b) { ok = false; det = `${a},${b},${fmt}: only ${macro} macro lines`; }
        }
        check('10. netGridLines: lines p = const, q = const, cut with the region, inside the canvas, finite', ok && n > 80, det || `${n} lines`);
    });
    return res;
}

// ================= run =================
let failures = 0, checks = 0;
const base = suite(NEW);
base.forEach(r => { checks++; if (!r.ok) failures++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail !== undefined && r.detail !== '' ? '  [' + r.detail + ']' : ''}`); });

console.log('== sabotages: each must turn at least one check red ==');
const SAB = [
    ['S1  Y formula with a and b swapped', s => { s.netwarp = mut(s.netwarp, 'P.H * P.a * (P.b - v) / ((P.b - P.a) * v)', 'P.H * P.b * (P.a - v) / ((P.a - P.b) * v) + 0.5 * P.H'); }],
    ['S2  edit tile fixed at (0, 0)', s => { s.netwarp = mut(s.netwarp, 'return { i: best.i, j: best.j };\n}', 'return { i: 0, j: 0 };\n}'); }],
    ['S3  sink without the new line (empty cut)', s => { s.curves = mut(s.curves, "        if (split && split.length < 2) return;   // task 121: a segment entirely outside the 3C net's region draws and collects nothing\n", ''); }],
    ['S4  cut only at v >= a, not at v <= b', s => { s.netwarp = mut(s.netwarp, '[-1, -1, b]', '[0, 0, 1]'); }],
    ['S5  netAnimationCompat lets 3C <-> regular pass', s => { s.netwarp = mut(s.netwarp, 'if (!(pf && pt)) return { ok: false', 'if (false) return { ok: false'); }],
    ['S6  inverse without the half-format formula', s => { s.netwarp = mut(s.netwarp, 'p = P.half ? (v + X * v / P.W) / 2 : X * v / P.W', 'p = X * v / P.W'); }],
    ['S7  export without version 2', s => { s.netwarp = mut(s.netwarp, "version: 2, kind: 'projective'", "version: 1, kind: 'projective'"); }],
    ['S8  session validator without a < b', s => { s.session = mut(s.session, '!(o.a < o.b)', 'false'); }],
    ['S9  the projective branch always taken (off path)', s => { s.netwarp = mut(s.netwarp, "if (spec.kind === 'projective') return _netProjectiveWarp(spec, frame);", "if (true) return _netProjectiveWarp(spec, frame);"); }],
    ['S10 tile hook never skips', s => { s.netwarp = mut(s.netwarp, 'return vmax <= P.a + _PROJ_TOL', 'return false && vmax <= P.a + _PROJ_TOL'); }]
];
for (const [name, fn] of SAB) {
    const set = Object.assign({}, NEW); let red = [];
    try { fn(set); red = suite(set, { noOld: false }).filter(r => !r.ok).map(r => r.name.slice(0, 40)); } catch (e) { red = ['sabotage setup: ' + e.message]; }
    checks++; const ok = red.length > 0 && !red[0].startsWith('sabotage setup'); if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  [red: ${red.length}${red.length ? ' - ' + red.slice(0, 3).join(' | ') : ''}]`);
}
console.log(`\n${checks - failures}/${checks} passed${failures ? ', ' + failures + ' FAILED' : ''}`);
process.exit(failures ? 1 : 0);
