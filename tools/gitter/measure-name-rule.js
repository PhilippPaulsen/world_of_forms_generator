/**
 * tools/gitter/measure-name-rule.js
 * Task 054: measurement of the Hinterreiter naming rule (node numbers, families, letters) against the source images (docs/quellen/, not committed).
 * Pure functions, node only, no dependency on sketch.js or core/ (the grid is rebuilt here from the rule of reports/052.md part A).
 *
 *   node tools/gitter/measure-name-rule.js            prints the measurement, exit 0 (a measurement, not a test)
 *   node tools/gitter/measure-name-rule.js --strict   exit 1 when a rule deviates from the source
 *   MEASURE_SABOTAGE=tie|radius|letters|bar|side node tools/gitter/measure-name-rule.js   one rule deliberately wrong (in memory): the measurement must turn red
 *
 * Model (all lengths in units of ONE smallest mesh edge; angles counter-clockwise, y up):
 *   grid(shape, ordnung, lage): shape 'triangle' | 'square' | 'hex'; ordnung = divisions per side; lage 1 | 2 (2 = 1 plus the centres of all smallest meshes).
 *   group: the main group only (triangle 3*, square 4*, hex 6*): K rotations and K mirror lines, 2K sectors ("Teildreiecke") of width w = pi/K.
 *   S0 (the shaded sector) = [alpha0, alpha0 + w]: its clockwise edge is a corner axis (C ray), its counter-clockwise edge a side-midpoint axis (M ray).
 *   node number (Knotenzahl) = rank of the node orbit by x (distance from the centre perpendicular to the side = projection on the M ray of S0), ties by y (from the M axis to the corner axis).
 *   pair orbit (Familie, Drehling) = orbit of an unordered node pair under the group; family = (z1, z2) with z1 >= z2.
 *   letter = number n of sectors the straight segment touches, seen from the end z1 moved into S0; letters at equal spacing in 'abcdefghiklmn' (triangle a e i n, square a d g k n, hex a c e g i l n);
 *   bar (Ueberstrich) = the segment runs counter-clockwise from S0 (only when no clockwise reading of the same orbit exists).
 *   achiral (Drehling = Spiegeling, capital letter too) = a mirror maps the pair onto itself, or both nodes lie in one side of the net (Gesetz 1a/1b/1c of the source).
 */
'use strict';

const TAU = 2 * Math.PI, EPS = 1e-9;
const ALPHABET = 'abcdefghiklmn';   // no j: a..i, k, l, m, n = 13 letters, a = 1 ... n = 13
const SHAPE = {
    triangle: { K: 3, alpha0: 0 },               // corners at 0, 120, 240 degrees
    square: { K: 4, alpha0: Math.PI / 4 },       // axis-parallel square: corners (C rays) at 45 degrees, side middles (M rays) at 0, 90, ...
    hex: { K: 6, alpha0: 0 },                    // corners at 0, 60, ... degrees
};
const SAB = process.env.MEASURE_SABOTAGE || '';
const key = (x, y) => Math.round(x * 1e6) + ',' + Math.round(y * 1e6);
const wrap2pi = (a) => ((a % TAU) + TAU) % TAU;

// ---------------------------------------------------------------- grid
function gridNodes(shape, n, lage) {
    const pts = new Map();
    const add = (x, y) => { const k = key(x, y); if (!pts.has(k)) pts.set(k, { x, y }); };
    if (shape === 'triangle') {
        const R = n / Math.sqrt(3), c = [0, 1, 2].map((k) => [R * Math.cos(TAU * k / 3), R * Math.sin(TAU * k / 3)]);
        const at = (i, j) => [c[0][0] + (i / n) * (c[1][0] - c[0][0]) + (j / n) * (c[2][0] - c[0][0]), c[0][1] + (i / n) * (c[1][1] - c[0][1]) + (j / n) * (c[2][1] - c[0][1])];
        for (let i = 0; i <= n; i++) for (let j = 0; i + j <= n; j++) add(...at(i, j));
        if (lage === 2) {
            for (let i = 0; i < n; i++) for (let j = 0; i + j < n; j++) {   // up cells (i,j),(i+1,j),(i,j+1)
                const a = at(i, j), b = at(i + 1, j), d = at(i, j + 1); add((a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3);
            }
            for (let i = 0; i < n; i++) for (let j = 0; i + j < n - 1; j++) {   // down cells (i+1,j),(i,j+1),(i+1,j+1)
                const a = at(i + 1, j), b = at(i, j + 1), d = at(i + 1, j + 1); add((a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3);
            }
        }
    } else if (shape === 'square') {
        for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) add(i - n / 2, j - n / 2);
        if (lage === 2) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) add(i + 0.5 - n / 2, j + 0.5 - n / 2);
    } else if (shape === 'hex') {
        const P = (q, r) => [q + r / 2, r * Math.sqrt(3) / 2], inside = (q, r) => Math.abs(q) <= n && Math.abs(r) <= n && Math.abs(q + r) <= n;
        for (let q = -n; q <= n; q++) for (let r = -n; r <= n; r++) if (inside(q, r)) add(...P(q, r));
        if (lage === 2) {
            for (let q = -n - 1; q <= n; q++) for (let r = -n - 1; r <= n; r++) {
                const up = [[q, r], [q + 1, r], [q, r + 1]], dn = [[q + 1, r], [q, r + 1], [q + 1, r + 1]];
                [up, dn].forEach((t) => { if (t.every(([a, b]) => inside(a, b))) { const p = t.map(([a, b]) => P(a, b)); add((p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3); } });
            }
        }
    } else throw new Error('shape ' + shape);
    return [...pts.values()];
}
function apothem(shape, n) { return shape === 'triangle' ? n / (2 * Math.sqrt(3)) : shape === 'square' ? n / 2 : n * Math.sqrt(3) / 2; }

// ---------------------------------------------------------------- group (main group: K rotations + K mirror lines)
function makeGroup(shape) {
    const { K, alpha0 } = SHAPE[shape], els = [];
    for (let k = 0; k < K; k++) { const c = Math.cos(TAU * k / K), s = Math.sin(TAU * k / K); els.push({ mirror: false, f: (x, y) => [c * x - s * y, s * x + c * y] }); }
    for (let j = 0; j < K; j++) { const p = alpha0 + j * Math.PI / K, c = Math.cos(2 * p), s = Math.sin(2 * p); els.push({ mirror: true, f: (x, y) => [c * x + s * y, s * x - c * y] }); }
    return els;
}

// ---------------------------------------------------------------- node orbits and node numbers
// fold(): the representative of (x, y) in S0 as { r, t } (t = angle from the C ray, 0..w)
function fold(shape, x, y) {
    const { K, alpha0 } = SHAPE[shape], w = Math.PI / K, r = Math.hypot(x, y);
    if (r < EPS) return { r: 0, t: 0 };
    let t = wrap2pi(Math.atan2(y, x) - alpha0); t = t % (2 * w);
    if (t > w) t = 2 * w - t;
    if (t < 1e-12) t = 0;
    return { r, t };
}
// buildGrid(): { shape, ordnung, lage, nodes[{ id, x, y, orbit, zahl }], orbits[{ zahl, size, rep:{x,y} }], byKey, group, apothem }
function buildGrid(shape, ordnung, lage) {
    const { K, alpha0 } = SHAPE[shape], w = Math.PI / K, raw = gridNodes(shape, ordnung, lage);
    const nodes = raw.map((p, id) => ({ id, x: p.x, y: p.y }));
    const byKey = new Map(nodes.map((nd) => [key(nd.x, nd.y), nd]));
    const orbits = new Map();
    for (const nd of nodes) {
        const f = fold(shape, nd.x, nd.y), k = Math.round(f.r * 1e6) + '|' + Math.round(f.t * 1e6);
        if (!orbits.has(k)) orbits.set(k, { r: f.r, t: f.t, size: 0, x: f.r * Math.cos(w - f.t), y: f.r * Math.sin(w - f.t), nodes: [] });
        const o = orbits.get(k); o.size++; o.nodes.push(nd.id); nd.orbitKey = k;
    }
    // number = rank by x, then y (both compared at 1e-6)
    const list = [...orbits.values()].sort((a, b) => SAB === 'radius' ? (Math.round(a.r * 1e6) - Math.round(b.r * 1e6)) || (Math.round(a.y * 1e6) - Math.round(b.y * 1e6))
        : (Math.round(a.x * 1e6) - Math.round(b.x * 1e6)) || (SAB === 'tie' ? -1 : 1) * (Math.round(a.y * 1e6) - Math.round(b.y * 1e6)));
    list.forEach((o, i) => { o.zahl = i + 1; });
    nodes.forEach((nd) => { nd.zahl = orbits.get(nd.orbitKey).zahl; });
    return { shape, ordnung, lage, K, w, alpha0, nodes, byKey, orbits: list, group: makeGroup(shape), apothem: apothem(shape, ordnung) };
}
function nodeAt(g, x, y) { return g.byKey.get(key(x, y)) || null; }
function nearestNode(g, x, y) {
    let best = null, d = Infinity;
    for (const nd of g.nodes) { const e = Math.hypot(nd.x - x, nd.y - y); if (e < d) { d = e; best = nd; } }
    return { node: best, dist: d };
}

// ---------------------------------------------------------------- pair orbits, family, letter, bar, chirality
function letterFor(n, K) {
    const maxn = K + 1, step = SAB === 'letters' ? 1 : 12 / (maxn - 1);
    return ALPHABET[Math.round((n - 1) * step)];
}
// one reading of an unordered pair from the end `e` (moved into S0 by g): { n, dir } (dir +1 counter-clockwise, -1 clockwise, 0 none / antipodal)
function readings(g, e, o) {
    const out = [], { w, alpha0 } = g;
    for (const el of g.group) {
        const [ex, ey] = el.f(e.x, e.y), [ox, oy] = el.f(o.x, o.y);
        const re = Math.hypot(ex, ey), ro = Math.hypot(ox, oy);
        let u = 0;
        if (re > EPS) { u = wrap2pi(Math.atan2(ey, ex) - alpha0); if (u > TAU - 1e-9) u = 0; if (u > w + 1e-9) continue; u /= w; }
        let n = 1, dir = 0;
        if (re > EPS && ro > EPS) {
            let d = wrap2pi(Math.atan2(oy, ox) - Math.atan2(ey, ex)); if (d > Math.PI + 1e-9) d -= TAU;
            if (Math.abs(d) < 1e-9) { n = 1; dir = 0; }
            else {
                if (Math.abs(Math.abs(d) - Math.PI) < 1e-9) { d = Math.PI; dir = 0; } else dir = d > 0 ? 1 : -1;
                const v = u + d / w, lo = Math.min(u, v), hi = Math.max(u, v);
                n = Math.max(1, Math.ceil(hi - 1e-9) - Math.floor(lo + 1e-9));
            }
        }
        out.push({ n, dir });
    }
    return out;
}
function sameSide(g, a, b) {
    const m0 = g.alpha0 + g.w;
    for (let i = 0; i < g.K; i++) {
        const mx = Math.cos(m0 + TAU * i / g.K), my = Math.sin(m0 + TAU * i / g.K);
        if (Math.abs(a.x * mx + a.y * my - g.apothem) < 1e-7 && Math.abs(b.x * mx + b.y * my - g.apothem) < 1e-7) return true;
    }
    return false;
}
// pairOrbits(g) -> [{ z1, z2, pairs: [[idA, idB]...], letter, n, bar, achiral, side, anomalies, name }]
function pairOrbits(g) {
    const N = g.nodes.length, canon = new Map();
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        let best = Infinity;
        for (const el of g.group) {
            const a = nodeAt(g, ...el.f(g.nodes[i].x, g.nodes[i].y)), b = nodeAt(g, ...el.f(g.nodes[j].x, g.nodes[j].y));
            if (!a || !b) throw new Error('grid is not closed under the group');
            const c = Math.min(a.id, b.id) * N + Math.max(a.id, b.id); if (c < best) best = c;
        }
        if (!canon.has(best)) canon.set(best, []);
        canon.get(best).push([i, j]);
    }
    const res = [];
    for (const pairs of canon.values()) {
        const [i, j] = pairs[0], A = g.nodes[i], B = g.nodes[j];
        const z1 = Math.max(A.zahl, B.zahl), z2 = Math.min(A.zahl, B.zahl);
        const ends = [];
        if (A.zahl === z1) ends.push([A, B]);
        if (B.zahl === z1 && A.zahl !== B.zahl || (A.zahl === B.zahl)) ends.push([B, A]);
        const reads = []; ends.forEach(([e, o]) => readings(g, e, o).forEach((r) => reads.push(r)));
        const anomalies = [];
        const ns = [...new Set(reads.map((r) => r.n))];
        if (ns.length !== 1) anomalies.push('n differs: ' + ns.join('/'));
        const n = Math.min(...ns), onAxis = (nd) => { const f = fold(g.shape, nd.x, nd.y); return f.r < EPS || f.t < 1e-9 || Math.abs(f.t - g.w) < 1e-9; };
        // the bar tells the two orbits j = +m and j = -m apart: only where both nodes lie on no mirror axis and 1 < n < K + 1 (n = 1 and n = K + 1 each occur once)
        const bar = SAB === 'bar' ? reads.every((r) => r.dir > 0) : !onAxis(A) && !onAxis(B) && n > 1 && n < g.K + 1 && reads.length > 0 && reads.every((r) => r.dir > 0);
        let achiral = SAB === 'side' ? false : sameSide(g, A, B);
        const ids = new Set([A.id, B.id]);
        for (const el of g.group) {
            if (!el.mirror) continue;
            const a = nodeAt(g, ...el.f(A.x, A.y)), b = nodeAt(g, ...el.f(B.x, B.y));
            if (ids.has(a.id) && ids.has(b.id)) achiral = true;
        }
        const letter = letterFor(n, g.K);
        res.push({ z1, z2, pairs, n, letter, bar, achiral, anomalies, reads, name: familyName(z1, z2) + letter + (bar ? '~' : '') });
    }
    return res;
}
function familyName(z1, z2) { return (z1 >= 10 || z2 >= 10) ? z1 + '.' + z2 : '' + z1 + z2; }

// ---------------------------------------------------------------- tables of the source: "21: aA" as tokens letter[~][*] (~ = bar, * = achiral, the capital partner)
const zOf = (fam) => fam.includes('.') ? Number(fam.split('.')[0]) : Number(fam[0]);   // first node number of a family name
function parseTable(text) {
    return text.trim().split('\n').map((l) => { const m = l.match(/^\s*(?:(\d):)?(\S+):\s*(.*)$/); return { only: m[1] || null, fam: m[2], tokens: m[3].split(',').map((s) => s.trim()).filter(Boolean) }; });
}
// a token set of the model for one family, in the table's notation; a chiral token of a family z1 = z2 has two equal readings (i and its bar), the bar is not distinguished there
function modelTokens(orbits, fam) {
    return orbits.filter((o) => familyName(o.z1, o.z2) === fam).map((o) => o.letter + ((o.bar && !(o.z1 === o.z2 && !o.achiral)) ? '~' : '') + (o.achiral ? '*' : '')).sort();
}
function normTokens(tokens, fam) {
    const same = fam.length === 2 ? fam[0] === fam[1] : fam.split('.')[0] === fam.split('.')[1];
    return tokens.map((t) => same && !t.includes('*') ? t.replace('~', '') : t).sort();
}
// compareTable(g, tableText, variant) -> { rows, hit, miss[], drehlinge: { source, model } }
function compareTable(g, tableText, variant, maxZahl) {
    const orbits = pairOrbits(g), rows = parseTable(tableText).filter((r) => (r.only === null || r.only === variant) && zOf(r.fam) <= maxZahl);
    const fams = new Set(orbits.map((o) => familyName(o.z1, o.z2)));
    let hit = 0, srcCount = 0, modCount = 0; const miss = [];
    for (const r of rows) {
        const src = normTokens(r.tokens, r.fam), mod = normTokens(modelTokens(orbits, r.fam), r.fam);
        srcCount += src.length; modCount += mod.length;
        if (JSON.stringify(src) === JSON.stringify(mod)) hit++; else miss.push({ fam: r.fam, source: src.join(','), model: mod.join(',') });
    }
    const inTable = new Set(rows.map((r) => r.fam)), extra = [...fams].filter((f) => !inTable.has(f) && zOf(f) <= maxZahl);
    const srcAchiral = rows.reduce((a, r) => a + r.tokens.filter((t) => t.includes('*')).length, 0);
    return { rows: rows.length, hit, miss, source: srcCount, srcAchiral, model: orbits.filter((o) => o.z1 <= maxZahl).length, extraFamilies: extra };
}

// ================================================================ TEST DATA (read from the source images, docs/quellen/)
// Tables: "fam: tokens"; token = letter, then ~ (Ueberstrich), then * (the capital partner is listed: Drehling = Spiegeling). "N:fam" = only the Nth net (4./5. Quadrat, 3./4. Sechseck).
// Bars on a chiral token of a family z1 = z2 (the source writes i or ī for the same Drehling) are not compared.
const TABLE_TRIANGLE_3 = `
21: a*
22: e*
31: a*
32: a,i*
33: e*
41: a*
42: a*,e
43: a,i*
44: e*
51: a
52: a,e,i
53: a,e,i
54: a,e,i
55: e*,e~*,i,n*
61: a*
62: a*,e
63: a,i*
64: a*,e
65: a*,e*,i
66: e*`;   // 07.png, Tabelle 1: Die Elementarformen des dritten Dreiecks (37 Drehlinge)
const TABLE_TRIANGLE_4 = `
21: a*
22: e*
31: a*
32: a,i*
33: e*
41: a*
42: a*,e
43: a,i*
44: e*
51: a
52: a,e,i
53: a,e,i
54: a,e,i
55: e*,e~*,i,n*
61: a*
62: a*,e
63: a,i*
64: a*,e
65: a,e,i
66: e*
71: a*
72: a,i*
73: a*,e
74: a,i*
75: a,e,i
76: a,i*
77: e*
81: a
82: a,e,i
83: a,e,i
84: a,e,i
85: a,e,e~,i,i~,n
86: a,e,i
87: a*,e,i
88: e*,e~*,i,n*
91: a*
92: a*,e
93: a,i*
94: a*,e
95: a,e,i
96: a*,e
97: a*,i*
98: a*,e*,i
99: e*`;   // 08.png, Tabelle 2: Die Elementarformen des vierten Dreiecks (94 Drehlinge)
const TABLE_SQUARE = `
21: a*
22: d*,k*
31: a*
32: a,g
33: d*,k*
41: a*
42: a*,d,k*
43: a,g
44: d*,k*
51: a
52: a,d,g,k
53: a,d,g,k
54: a,d,g,k
55: d*,d~*,g,k*,k~*,n
61: a*
62: a*,d,k*
63: a,g
64: a*,d,k*
65: a,d,g,k
66: d*,k*
71: a*
72: a,g
73: a*,d,k*
74: a,g
75: a,d,g,k
76: a,g
77: d*,k*
81: a
82: a,d,g,k
83: a,d,g,k
84: a,d,g,k
85: a,d,d~,g,g~,k,k~,n
86: a,d,g,k
4:87: a*,d,g,k
5:87: a,d,g,k
88: d*,d~*,g,k*,k~*,n
91: a*
92: a*,d,k*
93: a,g
94: a*,d,k*
95: a,d,g,k
96: a*,d,k*
4:97: a*,g
5:97: a,g
4:98: a*,d*,g,k
5:98: a,d,g,k
99: d*,k*
10.1: a
10.2: a,d,g,k
10.3: a,d,g,k
10.4: a,d,g,k
10.5: a,d,d~,g,g~,k,k~,n
10.6: a,d,g,k
10.7: a,d,g,k
10.8: a,d,d~,g,g~,k,k~,n
10.9: a,d,g,k
10.10: d*,d~*,g,k*,k~*,n
11.1: a
11.2: a,d,g,k
11.3: a,d,g,k
11.4: a,d,g,k
11.5: a,d,d~,g,g~,k,k~,n
11.6: a,d,g,k
11.7: a,d,g,k
11.8: a,d,d~,g,g~,k,k~,n
11.9: a,d,g,k
11.10: a*,d,d~*,g,g~,k,k~,n
11.11: d*,d~*,g,k*,k~*,n
12.1: a*
12.2: a*,d,k*
12.3: a,g
12.4: a*,d,k*
12.5: a,d,g,k
12.6: a*,d,k*
12.7: a,g
12.8: a,d,g,k
12.9: a*,d,k*
12.10: a*,d*,g,k
12.11: a*,d*,g,k
12.12: d*,k*`;   // 034.png, Tabelle 7: Die vierzaehligen Drehlinge des 4. bzw. 5. Quadrates (261 / 125 Drehlinge laut Quelle)
const TABLE_HEX = `
21: a*
22: c*,g*,l*
31: a*
32: a,e,i
33: c*,g*,l*
41: a*
42: a*,c,g,l*
43: a,e,i
44: c*,g*,l*
51: a
52: a,c,e,g,i,l
53: a,c,e,g,i,l
54: a,c,e,g,i,l
55: c*,c~*,e,g*,g~*,i,l*,l~*,n
61: a*
62: a*,c,g,l*
63: a,e,i
64: a*,c,g,l*
3:65: a*,c*,e,g,i,l
4:65: a,c,e,g,i,l
66: c*,g*,l*
71: a*
72: a,e,i
73: a*,c,g,l*
74: a,e,i
75: a,c,e,g,i,l
76: a,e,i
77: c*,g*,l*
81: a
82: a,c,e,g,i,l
83: a,c,e,g,i,l
84: a,c,e,g,i,l
85: a,c,c~,e,e~,g,g~,i,i~,l,l~,n
86: a,c,e,g,i,l
87: a*,c,e,g,i,l
88: c*,c~*,e,g*,g~*,i,l*,l~*,n`;   // 053.png, Tabelle 10: Die sechszaehligen Elementarformen des dritten bzw. vierten Sechsecknetzes (Familien 91..99 stehen auf S. 54, nicht vorhanden)
// 4*/76 stands in the source as "4*/ 76: a,e,i" and "2*/ 76: aA,e,i" (2nd hex, 2nd Lage): the row above is the 4th hex.
// Form counts (Drehlinge) of the source: [shape, ordnung, lage, label, source]
const FORM_COUNTS = [
    ['triangle', 3, 2, '3.△ (2. Lage)', 37], ['triangle', 4, 2, '4.△ (2. Lage)', 94], ['triangle', 5, 2, '5.△ (2. Lage)', 196],
    ['triangle', 6, 1, '6.△ (1. Lage)', 72], ['triangle', 7, 1, '7.△ (1. Lage)', 116], ['triangle', 8, 1, '8.△ (1. Lage)', 180],
    ['square', 4, 2, '4.□ (2. Lage)', 125], ['square', 5, 2, '5.□ (2. Lage)', 261], ['square', 6, 1, '6.□ (1. Lage)', 171],
    ['hex', 3, 1, '3.* (1. Lage)', 71], ['hex', 4, 1, '4.* (1. Lage)', 180], ['hex', 2, 2, '2.* (2. Lage)', 94],
];
// Drehlinge that are at the same time Spiegelinge ("gleichzeitig"), stated by the source: [shape, ordnung, lage, label, source]
const BOTH_COUNTS = [['triangle', 3, 2, '3.△ (07.png)', 19], ['triangle', 4, 2, '4.△ (08.png)', 37], ['square', 4, 2, '4.□ (034.png)', 44], ['square', 5, 2, '5.□ (034.png)', 64]];
// Table comparisons: [label, shape, ordnung, lage, table, variant, max node number]
const TABLE_RUNS = [
    ['Tabelle 1: 3.△ 2. Lage', 'triangle', 3, 2, TABLE_TRIANGLE_3, null, 6],
    ['Tabelle 2: 4.△ 2. Lage', 'triangle', 4, 2, TABLE_TRIANGLE_4, null, 9],
    ['Tabelle 7: 4.□ 2. Lage', 'square', 4, 2, TABLE_SQUARE, '4', 9],
    ['Tabelle 7: 5.□ 2. Lage', 'square', 5, 2, TABLE_SQUARE, '5', 12],
    ['Tabelle 10: 3.* 1. Lage', 'hex', 3, 1, TABLE_HEX, '3', 6],
    ['Tabelle 10: 4.* 1. Lage (Familien bis 88)', 'hex', 4, 1, TABLE_HEX, '4', 8],
];


// ---------------------------------------------------------------- node-number figures of the source
// A figure = { id, shape, n, lage, units: 'px' (image pixels of the zoomed crop, y down) | 'lat' (lattice steps read off the figure, y up), center, corner, points: [[x, y, label], ...] }.
// center / corner = the figure's centre node and one corner node, in the same units; the similarity (rotation + scale) from the figure to the model is derived from them, a mirror image does not matter (the group has mirrors).
// points = the NODE positions as read from the image, with the number printed at them (labels stand beside their node; where two nodes were possible the lattice decided).
const L = (rows) => { const out = []; for (const [b, list] of rows) for (const [a, lab] of list) out.push([a, b, lab]); return out; };
const FIGURES = [
    { id: 'Fig. 11 (03.△ 2. Lage, 05.png)', shape: 'triangle', n: 3, lage: 2, units: 'px', center: [645, 525], corner: [155, 520], points: [
        [645, 525, 1], [485, 525, 2], [725, 385, 2], [720, 665, 2], [565, 385, 3], [810, 520, 3], [565, 665, 3], [325, 520, 4], [805, 245, 4], [800, 815, 4],
        [400, 385, 5], [640, 240, 5], [890, 390, 5], [885, 670, 5], [410, 665, 5], [640, 805, 5], [155, 520, 6], [890, 110, 6], [880, 950, 6]] },
    { id: 'Fig. 9 (4.△ 2. Lage, 04.png)', shape: 'triangle', n: 4, lage: 2, units: 'px', center: [625, 525], corner: [145, 520], points: [
        [625, 525, 1], [500, 525, 2], [680, 420, 2], [685, 630, 2], [560, 420, 3], [745, 525, 3], [560, 630, 3], [380, 525, 4], [745, 320, 4], [745, 740, 4],
        [615, 320, 5], [440, 420, 5], [440, 630, 5], [810, 420, 5], [810, 630, 5], [630, 745, 5], [265, 520, 6], [805, 215, 6], [805, 850, 6],
        [870, 525, 7], [500, 318, 7], [505, 742, 7], [680, 215, 8], [320, 425, 8], [320, 630, 8], [870, 320, 8], [870, 745, 8], [685, 845, 8], [145, 520, 9], [878, 110, 9], [868, 948, 9]] },
    { id: 'Fig. 36 (4.□ 2. Lage, 026.png)', shape: 'square', n: 4, lage: 2, units: 'lat', center: [0, 0], corner: [0, 4], points: L([
        [4, [[0, 9]]], [3, [[-1, 8], [1, 8], [0, 6]]], [2, [[-2, 7], [-1, 5], [0, 4], [1, 5], [2, 7]]], [1, [[-3, 8], [-2, 5], [-1, 3], [0, 2], [1, 3], [2, 5], [3, 8]]],
        [0, [[-4, 9], [-3, 6], [-2, 4], [-1, 2], [0, 1], [1, 2], [2, 4], [3, 6], [4, 9]]], [-1, [[-3, 8], [-2, 5], [-1, 3], [0, 2], [1, 3], [2, 5], [3, 8]]],
        [-2, [[-2, 7], [-1, 5], [0, 4], [1, 5], [2, 7]]], [-3, [[-1, 8], [1, 8], [0, 6]]], [-4, [[0, 9]]]]) },
    { id: 'Fig. 45 (5.□ 2. Lage, 033.png)', shape: 'square', n: 5, lage: 2, units: 'lat', center: [0, 0], corner: [0, 5], points: L([
        [5, [[0, 12]]], [4, [[-1, 11], [0, 9], [1, 11]]], [3, [[-2, 10], [-1, 8], [0, 6], [1, 8], [2, 10]]], [2, [[-3, 10], [-2, 7], [-1, 5], [0, 4], [1, 5], [2, 7], [3, 10]]],
        [1, [[-4, 11], [-3, 8], [-2, 5], [-1, 3], [0, 2], [1, 3], [2, 5], [3, 8], [4, 11]]], [0, [[-5, 12], [-4, 9], [-3, 6], [-2, 4], [-1, 2], [0, 1], [1, 2], [2, 4], [3, 6], [4, 9], [5, 12]]],
        [-1, [[-4, 11], [-3, 8], [-2, 5], [-1, 3], [0, 2], [1, 3], [2, 5], [3, 8], [4, 11]]], [-2, [[-3, 10], [-2, 7], [-1, 5], [0, 4], [1, 5], [2, 7], [3, 10]]],
        [-3, [[-2, 10], [-1, 8], [0, 6], [1, 8], [2, 10]]], [-4, [[-1, 11], [0, 9], [1, 11]]], [-5, [[0, 12]]]]) },
    { id: 'Fig. 46 (6.□ 1. Lage, 033.png)', shape: 'square', n: 6, lage: 1, units: 'lat', center: [0, 0], corner: [0, 6], points: L([
        [6, [[0, 10]]], [5, [[-1, 9], [1, 9]]], [4, [[-2, 8], [0, 6], [2, 8]]], [3, [[-3, 7], [-1, 5], [1, 5], [3, 7]]], [2, [[-4, 8], [-2, 4], [0, 3], [2, 4], [4, 8]]],
        [1, [[-5, 9], [-3, 5], [-1, 2], [1, 2], [3, 5], [5, 9]]], [0, [[-6, 10], [-4, 6], [-2, 3], [0, 1], [2, 3], [4, 6], [6, 10]]], [-1, [[-5, 9], [-3, 5], [-1, 2], [1, 2], [3, 5], [5, 9]]],
        [-2, [[-4, 8], [-2, 4], [0, 3], [2, 4], [4, 8]]], [-3, [[-3, 7], [-1, 5], [1, 5], [3, 7]]], [-4, [[-2, 8], [0, 6], [2, 8]]], [-5, [[-1, 9], [1, 9]]], [-6, [[0, 10]]]]) },
    { id: 'Fig. 82 (3.* 1. Lage, 052.png)', shape: 'hex', n: 3, lage: 1, units: 'px', center: [565, 495], corner: [990, 500], points: [
        [565, 495, 1], [425, 490, 2], [705, 495, 2], [500, 370, 2], [640, 372, 2], [500, 615, 2], [630, 615, 2],
        [570, 245, 3], [360, 365, 3], [775, 375, 3], [355, 610, 3], [780, 620, 3], [565, 735, 3], [430, 245, 4], [710, 245, 4], [285, 490, 4], [850, 495, 4], [415, 740, 4], [705, 740, 4],
        [500, 120, 5], [640, 125, 5], [285, 235, 5], [215, 365, 5], [850, 255, 5], [925, 375, 5], [215, 610, 5], [285, 735, 5], [840, 745, 5], [920, 620, 5], [490, 860, 5], [635, 860, 5],
        [355, 115, 6], [790, 125, 6], [140, 490, 6], [990, 500, 6], [355, 860, 6], [780, 860, 6]] },
    { id: 'Fig. 83 (4.* 1. Lage, 052.png)', shape: 'hex', n: 4, lage: 1, units: 'px', center: [580, 495], corner: [1005, 495], points: [
        [580, 495, 1], [470, 495, 2], [690, 495, 2], [525, 400, 2], [635, 400, 2], [525, 590, 2], [635, 590, 2],
        [575, 310, 3], [415, 400, 3], [745, 405, 3], [415, 595, 3], [740, 595, 3], [575, 690, 3], [350, 495, 4], [795, 495, 4], [465, 305, 4], [690, 305, 4], [470, 690, 4], [690, 690, 4],
        [360, 305, 5], [800, 305, 5], [305, 400, 5], [855, 400, 5], [305, 590, 5], [855, 590, 5], [360, 685, 5], [800, 685, 5], [525, 210, 5], [635, 210, 5], [525, 780, 5], [635, 780, 5],
        [250, 495, 6], [910, 495, 6], [415, 210, 6], [745, 210, 6], [415, 780, 6], [745, 780, 6],
        [575, 115, 7], [575, 875, 7], [245, 310, 7], [910, 310, 7], [245, 685, 7], [910, 685, 7],
        [465, 110, 8], [690, 115, 8], [295, 210, 8], [855, 205, 8], [195, 395, 8], [965, 395, 8], [195, 595, 8], [955, 590, 8], [300, 775, 8], [855, 790, 8], [465, 880, 8], [690, 880, 8],
        [130, 495, 9], [1005, 495, 9], [355, 115, 9], [800, 110, 9], [360, 870, 9], [795, 870, 9]] },
];
const CORNER_ANGLE = { triangle: 0, square: Math.PI / 4, hex: 0 };
// checkFigure(fig) -> { n, equal, deviations[{ at, label, model }], maxSnap (in smallest-mesh edges), labelOfOrbit conflicts, bijection }
function checkFigure(fig) {
    const g = buildGrid(fig.shape, fig.n, fig.lage), sgn = fig.units === 'lat' ? 1 : -1;
    const vec = (p) => [p[0] - fig.center[0], sgn * (p[1] - fig.center[1])];
    const kv = vec(fig.corner), R = Math.max(...g.nodes.map((nd) => Math.hypot(nd.x, nd.y)));
    const rot = CORNER_ANGLE[fig.shape] - Math.atan2(kv[1], kv[0]), sc = R / Math.hypot(kv[0], kv[1]), c = Math.cos(rot), s = Math.sin(rot);
    const res = { n: fig.points.length, equal: 0, deviations: [], maxSnap: 0, nodesCovered: 0, conflicts: [] };
    const labelsOf = new Map(), seen = new Set();
    for (const [px, py, label] of fig.points) {
        const v = vec([px, py]), m = [sc * (c * v[0] - s * v[1]), sc * (s * v[0] + c * v[1])], q = nearestNode(g, m[0], m[1]);
        res.maxSnap = Math.max(res.maxSnap, q.dist); seen.add(q.node.id);
        if (q.node.zahl === label) res.equal++; else res.deviations.push({ at: [px, py], label, model: q.node.zahl });
        if (!labelsOf.has(q.node.zahl)) labelsOf.set(q.node.zahl, new Set());
        labelsOf.get(q.node.zahl).add(label);
    }
    res.nodesCovered = seen.size; res.nodes = g.nodes.length;
    for (const [z, set] of labelsOf) if (set.size > 1) res.conflicts.push(`${z}: ${[...set].join('/')}`);
    return res;
}

// ================================================================ run
function run(strict) {
    let bad = 0; const log = (...a) => console.log(...a);
    log('== 1. Formenzahlen (Bahnen der Knotenpaare = Drehlinge) ==');
    for (const [shape, n, lage, label, src] of FORM_COUNTS) {
        const g = buildGrid(shape, n, lage), o = pairOrbits(g), ok = o.length === src;
        if (!ok) bad++;
        log(`${ok ? 'gleich' : 'ABWEICHUNG'}  ${label}: Quelle ${src}, gerechnet ${o.length}; ${g.nodes.length} Knoten, ${g.orbits.length} Knotenzahlen`);
    }
    log('\n== 1b. Knotenzahlen gegen die Abbildungen (Position gegen gedruckte Zahl) ==');
    for (const fig of FIGURES) {
        const r = checkFigure(fig), ok = r.deviations.length === 0 && r.conflicts.length === 0;
        if (!ok) bad++;
        log(`${ok ? 'gleich' : 'ABWEICHUNG'}  ${fig.id}: ${r.equal}/${r.n} Zahlen gleich, ${r.nodesCovered}/${r.nodes} Knoten abgelesen, groesste Abweichung Bildpunkt-Knoten ${r.maxSnap.toFixed(2)} Maschen` + (r.conflicts.length ? '; widerspruechlich: ' + r.conflicts.join(' ') : ''));
        r.deviations.forEach((d) => log(`    bei ${d.at.join(',')}: Bild ${d.label}, Modell ${d.model}`));
    }
    log('\n== 2. Familien und Buchstaben gegen die Tabellen ==');
    for (const [label, shape, n, lage, table, variant, maxZ] of TABLE_RUNS) {
        const g = buildGrid(shape, n, lage), c = compareTable(g, table, variant, maxZ);
        log(`${label}: ${c.hit}/${c.rows} Familien gleich (${(100 * c.hit / c.rows).toFixed(1)} %); Drehlinge Tabelle ${c.source} (davon ${c.srcAchiral} mit Grossbuchstaben), Modell ${c.model}` + (c.extraFamilies.length ? `; Modellfamilien ohne Tabellenzeile: ${c.extraFamilies.join(' ')}` : ''));
        c.miss.forEach((m) => log(`    ${m.fam}: Quelle [${m.source}]  Modell [${m.model}]`));
        if (c.hit !== c.rows || c.extraFamilies.length) bad++;
    }
    log('\n== 2b. Drehlinge, die zugleich Spiegelinge sind (Gesetz 1a/1b/1c) ==');
    for (const [shape, n, lage, label, src] of BOTH_COUNTS) {
        const o = pairOrbits(buildGrid(shape, n, lage)), got = o.filter((x) => x.achiral).length, ok = got === src;
        if (!ok) bad++;
        log(`${ok ? 'gleich' : 'ABWEICHUNG'}  ${label}: Quelle ${src}, gerechnet ${got} (von ${o.length})`);
    }
    log('\n== 3. Eindeutigkeit (z1, z2, Buchstabe, Ueberstrich) je Bahn ==');
    for (const [shape, n, lage, label] of FORM_COUNTS) {
        const o = pairOrbits(buildGrid(shape, n, lage)), by = new Map();
        o.forEach((x) => by.set(x.name, (by.get(x.name) || 0) + 1));
        const coll = [...by].filter(([, c]) => c > 1), anom = o.filter((x) => x.anomalies.length);
        if (coll.length || anom.length) bad++;
        log(`${coll.length === 0 ? 'eindeutig' : 'KOLLISION'}  ${label}: ${o.length} Bahnen, ${by.size} Namen` + (coll.length ? '; ' + coll.map(([k, c]) => k + 'x' + c).join(' ') : '') + (anom.length ? `; ${anom.length} Bahnen mit uneinheitlichem n` : ''));
    }
    log(`\nAbweichungen von der Quelle: ${bad}` + (SAB ? `  (Sabotage: ${SAB})` : ''));
    return bad;
}
if (require.main === module) {
    const bad = run(process.argv.includes('--strict'));
    if (process.argv.includes('--strict') && bad) process.exit(1);
}

module.exports = { FIGURES, checkFigure, SHAPE, ALPHABET, gridNodes, buildGrid, nodeAt, nearestNode, makeGroup, fold, pairOrbits, letterFor, familyName, parseTable, compareTable, modelTokens, normTokens, apothem };
