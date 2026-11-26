/**
 * tools/netwarp/test-netwarp-projective-hex.js
 * Task 127 (3C-4): the projective net (Moebius net) on the HEXAGON sheet, family *N, full format only, a >= 2, omission class cls 0..2. core/netwarp.js, core/session.js.
 * Counterpart: the prototype tools/grid/measure-3c-hex.js (independent of core/), reports/125.md.
 *
 *   node tools/netwarp/test-netwarp-projective-hex.js
 *
 *  1. The map equals the prototype H; the edit tile's centre has i - j = cls (mod 3) and the base hexagon's centroid maps to the image of that centre.
 *  2. Pipeline (drawTessellation on a hexagon sheet): every line finite, inside the canvas, equal to the image of its exact cut.
 *  3. Faces: finite, inside the canvas, every polygon edge an exact chord.
 *  4. W = (b^2 - a^2)/6 (sum of the hexagon area shares) per (a, b, cls); stretch = independent computation.
 *  5. Geometry: 20000 segments and the honeycomb edges stay exact chords (<= 1e-9 px).
 *  6. Omission rule: the overlay's macro lines are the honeycomb (no end point is a centre of the class, valence 3).
 *  7. Inverse, hit test (the clicked point comes back through the tile offset), validity (half refused, a >= 2, cls 0..2, the family follows the shape).
 *  8. Timeline: same class interpolates, other class and other family are refused, the class survives the lerp.
 *  9. Export round trip, session validator (main's validator throws on *N: pinned), off path (square 3C, triangle 3C, hexagon Field byte-identical to main).
 * 10. Figures: Fig. 165 (3,7 full, cls 1) against docs/quellen/152.png (untracked; skipped without the file).
 * 11. Sabotages S1 to S9: each must turn at least one check red.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = '796b7a41';   // main at the start of task 127 (square and triangle 3C exist there: byte-identity of their drawing is pinned)
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export', 'farborgel-bridge'];
const readNew = f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8');
const readOld = f => execSync(`git show ${BASE}:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
const NEW = {}, OLD = {};
FILES.concat(['session']).forEach(f => { NEW[f] = readNew(f); OLD[f] = readOld(f); });
const join = set => FILES.map(f => set[f]).join('\n');
const mut = (src, from, to) => { if (!src.includes(from)) throw new Error('sabotage text not found: ' + from.slice(0, 60)); return src.replace(from, to); };
const HEX = '*N', SQ = '□N', TRI = '△N', S3 = Math.sqrt(3);
const mod3 = n => ((n % 3) + 3) % 3;

let seed = 127; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
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
    const g = shape === 'hex' ? sb.buildHexGrid(4, 3, cw, ch) : shape === 'triangle' ? sb.buildTriangleGrid(4, 3, cw, ch) : sb.buildSquareGrid(4, 3, cw, ch);
    sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
    return sb;
}
function edgeConnections(sb) {
    const ns = sb.nodes; let dmin = Infinity; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) dmin = Math.min(dmin, Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y));
    const out = []; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) if (Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y) < dmin * 1.05) out.push([ns[i].id, ns[j].id]);
    return out;
}
const proto = (a, b, W, H) => (p, q) => { const v = p + q; return { x: W * p / v, y: H * a * (b - v) / ((b - a) * v) }; };   // the prototype H, full format
const inRegion = (a, b, p, q, tol = 1e-7) => p >= -tol && q >= -tol && p + q >= a - tol && p + q <= b + tol;
const RING = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
// independent W and stretch (the same computation as tools/grid/measure-3c-hex.js)
function clip(poly, planes) { for (const [A, B, C] of planes) { const o = []; for (let i = 0; i < poly.length; i++) { const P = poly[i], Q = poly[(i + 1) % poly.length], dp = A * P[0] + B * P[1] + C, dq = A * Q[0] + B * Q[1] + C; if (dp >= 0) o.push(P); if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); o.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]); } } poly = o; if (!poly.length) return poly; } return poly; }
const area = poly => { let s = 0; for (let i = 0; i < poly.length; i++) { const P = poly[i], Q = poly[(i + 1) % poly.length]; s += P[0] * Q[1] - Q[0] * P[1]; } return Math.abs(s) / 2; };
function refInfo(a, b, cls, W, H) {
    const planes = [[1, 0, 0], [0, 1, 0], [1, 1, -a], [-1, -1, b]], px = proto(a, b, W, H); let Wh = 0, n = 0, st = 1;
    for (let i = -2; i <= b + 2; i++) for (let j = -2; j <= b + 2; j++) {
        if (mod3(i - j) !== cls) continue;
        const poly = RING.map(([di, dj]) => [i + di, j + dj]), ar = area(clip(poly, planes)); if (ar < 1e-9) continue;
        Wh += ar / 3; n++;
        if (ar < 0.75 || poly.some(q => q[0] + q[1] < 0.2)) continue;
        const pts = poly.map(q => px(q[0], q[1])), xs = pts.map(q => q.x), ys = pts.map(q => q.y), asp = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys)) / (2 / S3); st = Math.max(st, asp, 1 / asp);
    }
    return { W: Wh, n, stHex: st };
}
const CASES = [[3, 7, 600, 600], [2, 4, 800, 600], [4, 8, 900, 600], [3, 9, 600, 900], [2, 5, 600, 600], [5, 9, 1200, 600], [2, 12, 700, 500]];

function suite(set) {
    const res = [];
    const check = (name, ok, detail) => res.push({ name, ok: !!ok, detail });
    const guard = (name, fn) => { try { fn(); } catch (e) { check(name + ' (threw: ' + String(e && e.message || e).slice(0, 90) + ')', false); } };
    const SRC = join(set);
    const build = (a, b, cw, ch, cls = 0) => { const sb = makeSb(SRC, cw, ch, 'hex'); sb.baseNetTransform = sb.netProjectiveSpec(a, b, 'full', HEX, cls); sb.connections = edgeConnections(sb); return sb; };
    const warpOf = sb => sb.netWarpForBase(sb.baseNetTransform, 'hex', sb.outerCorners, sb.nodeCount, sb.shapeSizeFactor);
    const regPt = (w, p, q) => { const P = w.projective, F = w.frame; return { x: F.c0.x + (p - P.i0) * F.v1.x + (q - P.j0) * F.v2.x, y: F.c0.y + (p - P.i0) * F.v1.y + (q - P.j0) * F.v2.y }; };
    const latt = (w, pt) => { const F = w.frame, P = w.projective, dx = pt.x - F.c0.x, dy = pt.y - F.c0.y; return { p: (dx * F.v2.y - dy * F.v2.x) / F.det + P.i0, q: (F.v1.x * dy - F.v1.y * dx) / F.det + P.j0 }; };

    guard('1', () => {
        let worst = 0, n = 0, bad = 0;
        for (const [a, b, cw, ch] of CASES) for (const cls of [0, 1, 2]) {
            const sb = build(a, b, cw, ch, cls), w = warpOf(sb), H = proto(a, b, cw, ch);
            if (!w) { bad++; continue; }
            for (let k = 0; k < 120; k++) { const p = rnd() * (b + 1), q = rnd() * (b + 1); if (p + q < a) continue; const r = sb.applyNetWarp(w, regPt(w, p, q)), e = H(p, q); worst = Math.max(worst, Math.hypot(r.x - e.x, r.y - e.y) / Math.max(1, Math.abs(e.y))); n++; }
        }
        check('1. applyNetWarp on the hexagon sheet equals the prototype H (7 canvases x 3 classes)', bad === 0 && n > 1500 && worst < 1e-6, `${n} points, worst ${worst.toExponential(2)}`);
    });
    guard('1b', () => {
        let ok = true, det = '';
        for (const [a, b, cw, ch] of CASES) for (const cls of [0, 1, 2]) {
            const sb = build(a, b, cw, ch, cls), w = warpOf(sb), P = w.projective, I = P.i0, J = P.j0;
            const im = sb.applyNetWarp(w, sb.centroid), e = proto(a, b, cw, ch)(I, J);   // the base hexagon's centroid is the lattice point (I, J)
            if (mod3(I - J) !== cls || P.cls !== cls || !P.hex || Math.hypot(im.x - e.x, im.y - e.y) > 1e-6 || !(I + J >= a - 1)) { ok = false; det = `${a},${b} cls ${cls}: centre (${I},${J})`; }
        }
        check('1b. the edit tile is a hexagon whose centre has i - j = cls (mod 3), near the net, and the centroid maps to the image of the centre', ok, det);
    });

    guard('2', () => {
        for (const [a, b, cw, ch, cls] of [[3, 7, 600, 600, 1], [2, 4, 800, 600, 0], [4, 8, 900, 600, 2], [3, 9, 600, 900, 0]]) {
            const sb = build(a, b, cw, ch, cls), w = warpOf(sb), calls = [], orig = sb.drawCurvedBezier;
            sb.drawCurvedBezier = function (p1, p2, ct, i1, i2) { const i0 = sb.lines.length; orig.call(this, p1, p2, ct, i1, i2); calls.push({ p1, p2, from: i0, to: sb.lines.length }); };
            sb.lines = []; sb.drawTessellation(); sb.drawCurvedBezier = orig;
            let outside = 0, offcut = 0, nonFinite = 0; const eps = 1e-6;
            for (const l of sb.lines) { if (!l.every(Number.isFinite)) nonFinite++; if (l[0] < -eps || l[0] > cw + eps || l[2] < -eps || l[2] > cw + eps || l[1] < -eps || l[1] > ch + eps || l[3] < -eps || l[3] > ch + eps) outside++; }
            for (const c of calls) {
                const cut = sb.netWarpSplitSegment(w, c.p1, c.p2), want = cut.length < 2 ? 0 : 1;
                if (c.to - c.from !== want) { offcut++; continue; }
                if (want) { const A = sb.applyNetWarp(w, cut[0]), B = sb.applyNetWarp(w, cut[1]), l = sb.lines[c.from]; if (Math.hypot(l[0] - A.x, l[1] - A.y) > 1e-9 || Math.hypot(l[2] - B.x, l[3] - B.y) > 1e-9) offcut++; }
            }
            check(`2. ${a},${b} cls ${cls} ${cw}x${ch}: ${sb.lines.length} lines drawn, all finite and inside the canvas, each = the image of its exact cut`, sb.lines.length > 20 && nonFinite === 0 && outside === 0 && offcut === 0, `outside ${outside}, off-cut ${offcut}, non-finite ${nonFinite}`);
        }
    });

    guard('3', () => {
        for (const [a, b, cw, ch, cls] of [[3, 7, 600, 600, 1], [2, 4, 800, 600, 0], [3, 9, 600, 900, 0]]) {
            const sb = build(a, b, cw, ch, cls), w = warpOf(sb); sb.showFaces = true;
            sb.polys = []; sb.drawTessellation();
            const polys = sb.polys.filter(p => p.pts.length >= 3);
            let nonFinite = 0, out = 0, bent = 0, big = 0; const eps = 1e-6;   // the rim cuts hexagons (the triangle's does not): a polygon may reach beyond the canvas, the canvas cuts it; every coordinate must stay moderate (Skia loses its antialiasing beyond ~8000 px, task 121)
            for (const p of polys) {
                for (const v of p.pts) { if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) nonFinite++; else big = Math.max(big, Math.abs(v.x), Math.abs(v.y)); if (v.x < -eps || v.x > cw + eps || v.y < -eps || v.y > ch + eps) out++; }
                for (let i = 0; i < p.pts.length; i++) {
                    const A = p.pts[i], B = p.pts[(i + 1) % p.pts.length], pa = sb.invertNetWarp(w, A), pb = sb.invertNetWarp(w, B), pm = sb.invertNetWarp(w, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
                    const L = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1, d = Math.abs((pm.x - pa.x) * (pb.y - pa.y) - (pm.y - pa.y) * (pb.x - pa.x)) / L;
                    if (d > 1e-6 * Math.max(1, L)) bent++;
                }
            }
            let wholly = 0; for (const p of polys) { if (p.pts.every(v => v.x < 0) || p.pts.every(v => v.x > cw) || p.pts.every(v => v.y < 0) || p.pts.every(v => v.y > ch)) wholly++; }
            check(`3. ${a},${b} cls ${cls}: ${polys.length} face polygons, all finite, every coordinate < 8000 px, some reach beyond the rim (cut hexagons), every edge an exact chord (polygons wholly outside the canvas of a boundary tile are drawn and clipped: counted, not an error)`, polys.length > 5 && nonFinite === 0 && big < 8000 && out > 0 && bent === 0, `non-finite ${nonFinite}, largest ${big.toFixed(0)}, reaching beyond ${out}, bent ${bent}, wholly outside (clipped) ${wholly}`);
        }
    });

    guard('4', () => {
        let ok = true, det = '', n = 0;
        for (const [a, b] of [[2, 4], [3, 7], [4, 8], [3, 9], [5, 9], [2, 12], [2, 5]]) for (const cls of [0, 1, 2]) {
            const sb = build(a, b, 600, 600, cls), info = sb.netProjectiveInfo(sb.baseNetTransform, 600, 600), ref = refInfo(a, b, cls, 600, 600), f = (b * b - a * a) / 6; n++;
            if (!info.valid || Math.abs(info.W - f) > 1e-9 || Math.abs(info.W - ref.W) > 1e-9 || info.tilesWithArea !== ref.n || Math.abs(info.stretchHex - ref.stHex) > 1e-9 || info.stretch < info.stretchHex - 1e-12) { ok = false; det += ` ${a},${b},${cls}: W ${info.W} (${f}) n ${info.tilesWithArea}/${ref.n} st ${info.stretchHex}/${ref.stHex};`; }
        }
        check('4. W = (b^2 - a^2)/6 for every class (Fig. 165: 3,7 = 6.67; Fig. 166 half is not built), tilesWithArea and the hexagon stretch equal the independent computation', ok && n === 21, det);
    });

    guard('5', () => {
        let worst = 0, n = 0;
        const sb = build(2, 6, 600, 900), w = warpOf(sb), P = w.projective;
        const dl = (Q, A, B) => { const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy); return L < 1e-9 ? 0 : Math.abs((Q.x - A.x) * dy - (Q.y - A.y) * dx) / L; };
        for (let k = 0; k < 20000; k++) {
            const p1 = { x: sb.centroid.x + (rnd() - 0.5) * 900, y: sb.centroid.y + (rnd() - 0.5) * 900 }, p2 = { x: sb.centroid.x + (rnd() - 0.5) * 900, y: sb.centroid.y + (rnd() - 0.5) * 900 }, cut = sb.netWarpSplitSegment(w, p1, p2);
            if (cut.length < 2) continue; n++;
            const A = sb.applyNetWarp(w, cut[0]), B = sb.applyNetWarp(w, cut[1]);
            for (const t of [0.17, 0.5, 0.83]) worst = Math.max(worst, dl(sb.applyNetWarp(w, { x: cut[0].x + t * (cut[1].x - cut[0].x), y: cut[0].y + t * (cut[1].y - cut[0].y) }), A, B));
        }
        check('5. 20000 random segments: the image of every segment point lies on the chord of the end points images (<= 1e-9 px)', n > 4000 && worst < 1e-9, `${n} cut segments, worst ${worst.toExponential(2)} px`);
    });

    guard('6', () => {
        let ok = true, det = '', total = 0;
        for (const cls of [0, 1, 2]) {
            const sb = build(3, 9, 600, 600, cls), w = warpOf(sb), lines = sb.netGridLines(sb.baseNetTransform, sb.outerCorners, 1, null, { closed: true });
            const macro = lines.filter(l => l.level === 'macro'), val = new Map();
            for (const l of macro) {
                total++;
                const ca = latt(w, sb.invertNetWarp(w, { x: l.x1, y: l.y1 })), cb = latt(w, sb.invertNetWarp(w, { x: l.x2, y: l.y2 }));
                // an edge of the honeycomb: a lattice edge cut with the region; the full ones end at integer points that are no centre
                for (const c of [ca, cb]) { const i = Math.round(c.p), j = Math.round(c.q); if (Math.abs(c.p - i) < 1e-6 && Math.abs(c.q - j) < 1e-6) { if (mod3(i - j) === cls) { ok = false; det = `cls ${cls}: end point (${i},${j}) is a centre`; } const k = i + ',' + j; val.set(k, (val.get(k) || 0) + 1); } }
            }
            let interior3 = 0, interiorBad = 0;
            for (const [k, v] of val) { const [i, j] = k.split(',').map(Number); if (i >= 1 && j >= 1 && i + j >= 5 && i + j <= 7) { if (v === 3) interior3++; else interiorBad++; } }
            if (interiorBad || interior3 < 6) { ok = false; det = `cls ${cls}: valence 3 at ${interior3} interior points, ${interiorBad} others`; }
        }
        check('6. the overlay macro lines are the honeycomb: no end point is a hexagon centre of the class, every interior lattice point has valence 3', ok && total > 60, det || `${total} lines`);
    });

    guard('7', () => {
        let worst = 0, n = 0, hit = 0, hitBad = 0;
        for (const [a, b, cw, ch] of [CASES[0], CASES[1], CASES[3]]) for (const cls of [0, 1, 2]) {
            const sb = build(a, b, cw, ch, cls), w = warpOf(sb), P = w.projective, F = w.frame;
            const v1h = { x: 2 * F.v1.x - F.v2.x, y: 2 * F.v1.y - F.v2.y }, v2h = { x: F.v1.x + F.v2.x, y: F.v1.y + F.v2.y };   // the hexagon lattice
            for (let k = 0; k < 150; k++) {
                const p = rnd() * (b + 1), q = rnd() * (b + 1); if (p + q < a + 0.05 || p + q > b - 0.05) continue;
                const pt = regPt(w, p, q), img = sb.applyNetWarp(w, pt), back = sb.invertNetWarp(w, img); n++;
                worst = Math.max(worst, Math.hypot(back.x - pt.x, back.y - pt.y) / Math.hypot(F.v1.x, F.v1.y));
                if (!sb.netWarpInsideNet(w, img)) { hitBad++; continue; }
                const lc = sb.netWarpFieldLocal(w, img); hit++;
                if (!lc) { hitBad++; continue; }
                const tx = lc.x + lc.tile.i * v1h.x + lc.tile.j * v2h.x, ty = lc.y + lc.tile.i * v1h.y + lc.tile.j * v2h.y, im2 = sb.applyNetWarp(w, { x: tx, y: ty });
                if (!Number.isInteger(Math.round(lc.tile.i * 3) / 3) || Math.abs(lc.tile.i - Math.round(lc.tile.i)) > 1e-9 || Math.hypot(im2.x - img.x, im2.y - img.y) > 1e-6 * Math.max(1, cw)) hitBad++;
                const l = lc.local; if (l.l * l.l + l.m * l.m + l.l * l.m > 1 + 1e-9) hitBad++;   // inside the hexagon (distance to its centre <= side 1 at the circumcircle in the lattice metric)
            }
        }
        check('7. invertNetWarp(applyNetWarp(P)) = P; every click in the picture gives a free point in the NEAREST hexagon of the class (inside its circumcircle) that is drawn back under the click through its tile offset', n > 300 && worst < 1e-9 && hit > 300 && hitBad === 0, `${n} points worst ${worst.toExponential(2)}, ${hit} clicks, ${hitBad} bad`);
    });
    guard('7b', () => {
        const sb = makeSb(SRC, 600, 600, 'hex'), S = sb.netProjectiveSpec, E = (sp, sh) => sb.netProjectiveEffective(sp, sh);
        check('7b. the hexagon takes the FULL format only (half refused with a reason, no warp), a >= 2, a >= b and b > 12 refused, cls 0..2 only',
            !E(S(3, 7, 'half', HEX), 'hex').valid && /full format/.test(E(S(3, 7, 'half', HEX), 'hex').reason) && E(S(3, 7, 'full', HEX), 'hex').valid && !E(S(1, 4, 'full', HEX), 'hex').valid && !E(S(3, 3, 'full', HEX), 'hex').valid && !E(S(2, 13, 'full', HEX), 'hex').valid
            && E(S(3, 7, 'full', HEX, 2), 'hex').valid && !E(Object.assign(S(3, 7, 'full', HEX), { cls: 3 }), 'hex').valid && sb.netWarpForBase(S(3, 7, 'half', HEX), 'hex', sb.outerCorners, 4, 3) === null);
        const fam = sp => sb.netProjectiveForShape(sp, 'hex').family;
        check('7c. the family follows the shape: a square or triangle spec on the hexagon sheet is renamed to *N (cls 0), a hexagon spec on the square sheet to the square family (no cls)', fam(S(2, 4, 'full', SQ)) === HEX && sb.netProjectiveForShape(S(2, 4, 'full', TRI), 'hex').cls === 0 && sb.netProjectiveForShape(S(3, 7, 'full', HEX, 1), 'square').family === SQ && !('cls' in sb.netProjectiveForShape(S(3, 7, 'full', HEX, 1), 'square')) && E(S(2, 4, 'full', SQ), 'hex').valid);
        const h = makeSb(SRC, 600, 600, 'hex'), w1 = h.netWarpForBase(S(3, 7, 'full', SQ), 'hex', h.outerCorners, 4, 3), w2 = h.netWarpForBase(S(3, 7, 'full', HEX), 'hex', h.outerCorners, 4, 3);
        check('7d. a stale family builds the same warp as the right one on the hexagon sheet', w1 && w2 && JSON.stringify(w1.projective) === JSON.stringify(w2.projective));
    });

    guard('8', () => {
        const sb = makeSb(SRC, 600, 600, 'hex'), S = sb.netProjectiveSpec, C = (x, y) => sb.netAnimationCompat(x, y);
        const same = C(S(3, 7, 'full', HEX, 1), S(4, 8, 'full', HEX, 1)), other = C(S(3, 7, 'full', HEX, 0), S(3, 7, 'full', HEX, 1)), fam = C(S(3, 7, 'full', HEX), S(2, 4, 'full', TRI)), fam2 = C(S(2, 4, 'full', SQ), S(3, 7, 'full', HEX));
        const mid = sb.netLerpSpecs(S(3, 7, 'full', HEX, 2), S(4, 9, 'full', HEX, 2), 0.5), end0 = sb.netLerpSpecs(S(3, 7, 'full', HEX, 2), S(4, 9, 'full', HEX, 2), 0), end1 = sb.netLerpSpecs(S(3, 7, 'full', HEX, 2), S(4, 9, 'full', HEX, 2), 1);
        check('8. timeline: hexagon <-> hexagon of the same class interpolates (a, b linear, exact ends, class kept); another class, square <-> hexagon and triangle <-> hexagon are refused', same.ok && !other.ok && /omission class/.test(other.reason) && !fam.ok && /family differs/.test(fam.reason) && !fam2.ok && mid.cls === 2 && mid.a === 3.5 && mid.b === 8 && end0.a === 3 && end1.b === 9 && sb.netProjectiveEffective(mid, 'hex').valid);
    });

    guard('9', () => {
        const sb = makeSb(SRC, 600, 600, 'hex'), S = sb.netProjectiveSpec;
        sb.canvasW = 600; sb.canvasH = 600;
        const ex = sb.netTransformExportData(S(3, 7, 'full', HEX, 1), 'hex'), back = sb.netTransformFromExport(JSON.parse(JSON.stringify(ex)));
        check('9. export (version 2, family *N, cls, tileShape hexagon, the same homography) and the round trip', ex.version === 2 && ex.family === HEX && ex.cls === 1 && ex.tileShape === 'hexagon' && ex.W > 6.6 && ex.W < 6.7 && JSON.stringify(back) === JSON.stringify(S(3, 7, 'full', HEX, 1)) && ex.homography.rows.length === 3 && !('cls' in sb.netTransformExportData(S(3, 7, 'full', SQ), 'square')));
        const se = (src, spec) => { const c = {}; vm.createContext(c); vm.runInContext(src, c); try { c._vNetSpec(spec, 'net'); return true; } catch (e) { return false; } };
        const ok1 = se(set.session, S(3, 7, 'full', HEX, 2)), no1 = se(set.session, Object.assign(S(3, 7, 'full', HEX), { cls: 3 })), no2 = se(set.session, Object.assign(S(3, 7, 'full', SQ), { cls: 1 })), no3 = se(set.session, Object.assign(S(3, 7, 'full', HEX), { family: 'XN' })), no4 = se(set.session, S(1, 7, 'full', HEX)), ok2 = se(set.session, S(3, 7, 'full', HEX));
        check('9b. the session validator accepts *N (cls 0..2, or none), refuses cls 3, cls on another family, a bad family and a = 1; main\'s validator throws on *N (a visible rejection)', ok1 && ok2 && !no1 && !no2 && !no3 && !no4 && !se(OLD.session, S(3, 7, 'full', HEX, 2)));
    });

    guard('9c', () => {   // off path: nothing changes without a hexagon 3C net
        const run = (src, shape, net) => { const sb = makeSb(src, 600, 600, shape); sb.baseNetTransform = typeof net === 'function' ? net(sb) : net; sb.connections = edgeConnections(sb); sb.lines = []; sb.drawTessellation(); return JSON.stringify(sb.lines); };
        const fld = { x: { kind: 'trig', w: 0.6 }, y: 'same', domain: 'field' };
        let same = true, det = '';
        for (const [shape, net, nm] of [['square', sb => sb.netProjectiveSpec(2, 4, 'full', SQ), 'square 3C'], ['triangle', sb => sb.netProjectiveSpec(2, 4, 'full', TRI), 'triangle 3C'], ['hex', fld, 'hexagon Field'], ['triangle', fld, 'triangle Field'], ['square', null, 'regular'], ['hex', null, 'regular hex']]) {
            const a = run(join(NEW), shape, net), b = run(join(OLD), shape, net); if (a !== b || a.length < 10) { same = false; det += ' ' + nm; }
        }
        check('9c. off path: square 3C, triangle 3C, the Fields and a regular net draw the same lines as main', same, det);
    });

    guard('10', () => {   // Fig. 165 (a = 3, b = 7, full, cls 1) in the frame of the printed figure
        const file = path.join(ROOT, 'docs', 'quellen', '152.png');
        if (!fs.existsSync(file)) { check('10. (skipped: docs/quellen/152.png is not in this tree)', true); return; }
        const { readPng } = require('../grid/png-read.js'), im = readPng(file), Wp = im.w, Hp = im.h, fr = { left: 95, right: 412.5, top: 244, bottom: 677.5 };
        const lum = (x, y) => { const c = im.at(x, y); return (c[0] + c[1] + c[2]) / 3; };
        const hit = (x, y) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { if (dx * dx + dy * dy > 16) continue; const xi = Math.round(x) + dx, yi = Math.round(y) + dy; if (xi >= 0 && yi >= 0 && xi < Wp && yi < Hp && lum(xi, yi) > 140) return true; } return false; };
        const share = cls => {
            const cw = 1000 * (fr.bottom - fr.top) / (fr.right - fr.left), ch = 1000, sb = build(3, 7, cw, ch, cls), lines = sb.netGridLines(sb.baseNetTransform, sb.outerCorners, 1, null, { closed: true }).filter(l => l.level === 'macro').map(l => [l.x1, l.y1, l.x2, l.y2]);
            let n = 0, h = 0;   // canvas x (X, 0..W) -> figure y downwards, canvas y (a at the bottom) -> figure x from the left
            for (const l of lines) { const len = Math.hypot(l[2] - l[0], l[3] - l[1]), k = Math.max(2, Math.ceil(len / 3)); for (let i = 0; i <= k; i++) { const t = i / k, X = l[0] + t * (l[2] - l[0]), Y = l[1] + t * (l[3] - l[1]), fx = fr.left + (1 - Y / ch) * (fr.right - fr.left), fy = fr.top + (X / cw) * (fr.bottom - fr.top); if (fx < fr.left + 8 || fx > fr.right - 8 || fy < fr.top + 8 || fy > fr.bottom - 8) continue; n++; if (hit(fx, fy)) h++; } }
            return h / n;
        };
        const s1 = share(1), s0 = share(0);
        check('10. Fig. 165 (3,7 full): the net lines (overlay, honeycomb) of cls 1 lies on the printed white lines (>= 80 % of the samples within 4 px) and clearly better than cls 0', s1 >= 0.8 && s1 > s0 + 0.1, `cls 1 ${(100 * s1).toFixed(1)} %, cls 0 ${(100 * s0).toFixed(1)} %`);
    });
    return res;
}

// ================= run =================
let failures = 0, checks = 0;
const base = suite(NEW);
base.forEach(r => { checks++; if (!r.ok) failures++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail !== undefined && r.detail !== '' ? '  [' + r.detail + ']' : ''}`); });

console.log('== sabotages: each must turn at least one check red ==');
const SAB = [
    ['S1  the edit tile takes the wrong class (centre i - j != cls)', s => { s.netwarp = mut(s.netwarp, "if ((((i - j) % 3) + 3) % 3 !== cls) continue;\n            const ar = _projArea(_projClipPoly(ring.map(", "if ((((i - j) % 3) + 3) % 3 === cls) continue;\n            const ar = _projArea(_projClipPoly(ring.map("); }],
    ['S2  cls ignored in the warp (always 0)', s => { s.netwarp = mut(s.netwarp, 'hexa ? (spec.cls | 0) : undefined', 'hexa ? 0 : undefined'); }],
    ['S3  _netProjTileOutside without vmax <= a', s => { s.netwarp = mut(s.netwarp, 'return vmax <= P.a + _PROJ_TOL', 'return false && vmax <= P.a + _PROJ_TOL'); }],
    ['S4  *N missing in the session validator', s => { s.session = mut(s.session, "if (o.family !== '\\u25a1N' && !tri && !hexa) throw", "if (o.family !== '\\u25a1N' && !tri) throw"); }],
    ['S5  the export drops cls (the snapshot sabotage lives in test-netwarp-family-snapshot.js)', s => { s.netwarp = mut(s.netwarp, 'if (hexa) out.cls = spec.cls | 0;', ''); }],
    ['S6  the timeline ignores cls', s => { s.netwarp = mut(s.netwarp, "(from.cls | 0) !== (to.cls | 0)", 'false'); }],
    ['S7  the half format allowed on the hexagon', s => { s.netwarp = mut(s.netwarp, "else if (hexa && spec.format !== 'full') reason", "else if (false && spec.format !== 'full') reason"); }],
    ['S8  the overlay draws the full triangle lattice (no omission)', s => { s.netwarp = mut(s.netwarp, "if ((((i + di - (j + dj)) % 3) + 3) % 3 === P.cls) continue; add(i, j", "add(i, j"); }],
    ['S9  the local point is taken in the wrong hexagon (class ignored)', s => { s.netwarp = mut(s.netwarp, "if ((((i - j) % 3) + 3) % 3 !== P.cls) continue;\n            const x = r.p - i", "const x = r.p - i"); }]
];
for (const [name, fn] of SAB) {
    const set = Object.assign({}, NEW); let red = [];
    try { fn(set); red = suite(set).filter(r => !r.ok).map(r => r.name.slice(0, 40)); } catch (e) { red = ['sabotage setup: ' + e.message]; }
    checks++; const ok = red.length > 0 && !red[0].startsWith('sabotage setup'); if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  [red: ${red.length}${red.length ? ' - ' + red.slice(0, 3).join(' | ') : ''}]`);
}
console.log(`\n${checks - failures}/${checks} passed${failures ? ', ' + failures + ' FAILED' : ''}`);
process.exit(failures ? 1 : 0);
