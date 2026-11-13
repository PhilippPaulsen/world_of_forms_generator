/**
 * tools/gitter/measure-group-notation.js
 * Task 072b: Hinterreiter's group notation (index 2 / II / = / 3 / III / 4 / 6, axis position signs) measured on the orbits of node pairs under every subgroup of the main group.
 * Pure functions, node only, no core/, no sketch.js; the grid / full-group oracle comes from tools/gitter/measure-name-rule.js (task 054) by require.
 *
 *   node tools/gitter/measure-group-notation.js            prints the measurement, exit 0
 *   node tools/gitter/measure-group-notation.js --strict   exit 1 when an internal check fails (not when the source differs)
 *
 * Model (frame of the oracle: S0 = [alpha0, alpha0 + w], w = pi / K, clockwise edge = corner axis, step = one rotation of 2 w):
 *   subgroup H = rotations r^k (k in rots) + mirrors m_j (axis at alpha0 + j w; j even = corner-corner axis, j odd = side-middle axis).
 *   H-orbit O inside a full-group orbit F = (z1, z2, letter, bar).
 *   index class j of an H-orbit (source: primary 2 / 3, secondary II / III, tertiary =): the generating stroke has its z1 end in S0; the other classes follow "im Uhrzeigersinn" (S. 71):
 *       s = number of 2 w steps (counter-clockwise) from S0 to the sector of the z1 end of a pair with that end in a (+) sector (S0 type); j = (-s) mod m, m = K / (number of rotations in H).
 *       a pair whose z1 end is in a (-) sector is reflected by m_0 first (turning the sheet: 48d_j is the mirror image of 84d_j, S. 40); in H-orbits WITH a mirror only the (+) pairs count.
 *   case of the letter: H without mirror: lower case, "aA" when the orbit is invariant under a mirror layout (source: sign before the letter, Tabelle 9); H with mirror: upper case when the orbit is the union of two rotation orbits, "aA" when it is one.
 *   digit order: H without mirror: handedness of task 072a (z1 z2 or z2 z1, underline before the second digit for z1 = z2); H with mirror: z1 z2.
 */
'use strict';

const M = require('./measure-name-rule.js');
const { buildGrid, pairOrbits, nodeAt, familyName, SHAPE } = M;
const TAU = 2 * Math.PI, EPS = 1e-9;
const wrap2pi = (a) => ((a % TAU) + TAU) % TAU;
const strict = process.argv.includes('--strict');
let internalBad = 0;
const log = (...a) => console.log(...a);
const SHAPE_NAME = { triangle: 'Dreieck', square: 'Quadrat', hex: 'Sechseck' };

// ---------------------------------------------------------------- group elements
function rotEl(K, k) { const c = Math.cos(TAU * k / K), s = Math.sin(TAU * k / K); return { mirror: false, f: (x, y) => [c * x - s * y, s * x + c * y] }; }
function mirEl(shape, j) { const { K, alpha0 } = SHAPE[shape], p = alpha0 + j * Math.PI / K, c = Math.cos(2 * p), s = Math.sin(2 * p); return { mirror: true, f: (x, y) => [c * x + s * y, s * x - c * y] }; }
function groupsOf(shape) {
    const { K } = SHAPE[shape], all = [...Array(K).keys()], R = (ks) => ks.map((k) => rotEl(K, k)), Mi = (js) => js.map((j) => mirEl(shape, j));
    const G = (id, src, mode, rots, mirs, layout) => ({ id, src, mode, rots, mirs, layout, K, m: K / rots.length, els: [...R(rots), ...Mi(mirs)] });
    if (shape === 'triangle') return [
        G('C3', 'Drehling, 3-zählig (kein Index in der Quelle)', 'rotation3 / rotation6', all, [], ''),
        G('D3', 'volle Gruppe 3* (Spiegeling)', 'rotation_reflection3 / 6', all, all, ''),
        G('Z2', 'nur Spiegelung, eine Achse (Ecke - Seitenmitte)', 'reflection_only', [0], [0], '')];
    if (shape === 'square') return [
        G('C4', 'd4: vierzähliger Drehling', 'rotation3 / rotation6', all, [], ''),
        G('C2', 'd2 / dII: zweizähliger Drehling', 'kein Modus', [0, 2], [], ''),
        G('D4', 'D4: volle Gruppe 4* (Spiegeling)', 'rotation_reflection3 / 6', all, all, ''),
        G('D2x', 'D2 mit Zeichen ⊠ (Achsen in den Diagonalen)', 'kein Modus', [0, 2], [0, 2], 'x'),
        G('D2+', 'D2 mit Zeichen ⌗ (Achsen bar zu den Seiten)', 'kein Modus', [0, 2], [1, 3], '+'),
        G('Z2x', 'nur Spiegelung, Achse durch Ecken', 'reflection_only', [0], [0], 'x'),
        G('Z2+', 'nur Spiegelung, Achse durch Seitenmitten', 'reflection_only', [0], [1], '+')];
    return [
        G('C6', 'e6: sechszähliger Drehling', 'rotation6', all, [], ''),
        G('C3', 'e3 / eIII: dreizähliger Drehling', 'rotation3', [0, 2, 4], [], ''),
        G('C2', 'e2 / eII / e=: zweizähliger Drehling', 'kein Modus', [0, 3], [], ''),
        G('D6', 'E6: volle Gruppe 6* (Spiegeling)', 'rotation_reflection6', all, all, ''),
        G('D3x', 'E3 mit Zeichen ⊹ (Achsen durch Ecken)', 'rotation_reflection3', [0, 2, 4], [0, 2, 4], 'x'),
        G('D3+', 'E3 mit Zeichen ‡ (Achsen durch Seitenmitten)', 'rotation_reflection3', [0, 2, 4], [1, 3, 5], '+'),
        G('D2', 'E2 / EII / E= (Hauptstellung Fig. 119)', 'kein Modus', [0, 3], [0, 3], ''),
        G('Z2x', 'nur Spiegelung, Achse durch Ecken', 'reflection_only', [0], [0], 'x'),
        G('Z2+', 'nur Spiegelung, Achse durch Seitenmitten', 'reflection_only', [0], [1], '+')];
}
const INDEX = {   // [unicode, ascii] by (rotations of the group, class j); full group: the number of the fold
    full: { triangle: ['', ''], square: ['₄', '4'], hex: ['₆', '6'] },
    sub: { '2/4': [['₂', '2'], ['ᵢᵢ', 'II']], '3/6': [['₃', '3'], ['ᵢᵢᵢ', 'III']], '2/6': [['₂', '2'], ['ᵢᵢ', 'II'], ['₌', '=']] },
};
function indexOf(shape, H, j) {
    if (H.m === 1) return INDEX.full[shape];
    const t = INDEX.sub[H.rots.length + '/' + H.K];
    return t ? t[j] : ['m' + j, 'm' + j];
}

// ---------------------------------------------------------------- geometry of an end
function sectorInfo(g, nd) {
    const r = Math.hypot(nd.x, nd.y);
    if (r < EPS) return { onAxis: true, type: 0 };
    const w = g.w, u = wrap2pi(Math.atan2(nd.y, nd.x) - g.alpha0) % (2 * w);
    if (u < 1e-9 || Math.abs(u - w) < 1e-9 || Math.abs(u - 2 * w) < 1e-9) return { onAxis: true, type: 0 };
    return { onAxis: false, type: u < w ? 1 : -1 };
}
function angleFromTo(e, f) {
    if (Math.hypot(e.x, e.y) < EPS || Math.hypot(f.x, f.y) < EPS) return null;
    let d = wrap2pi(Math.atan2(f.y, f.x) - Math.atan2(e.y, e.x)); if (d > Math.PI + 1e-9) d -= TAU;
    return d;
}
function handedness(g, o, A, B) {   // task 072a
    if (o.z1 !== o.z2) {
        const E = A.zahl === o.z1 ? A : B, F = E === A ? B : A, s = sectorInfo(g, E);
        if (!s.onAxis) return s.type;
        const d = angleFromTo(E, F);
        if (d === null || Math.abs(d) < 1e-9 || Math.abs(Math.abs(d) - Math.PI) < 1e-9) return 0;
        return d > 0 ? 1 : -1;
    }
    const a = sectorInfo(g, A), b = sectorInfo(g, B);
    return (!a.onAxis && !b.onAxis && a.type === b.type) ? a.type : 0;
}
function stepsOf(g, e) { const th = wrap2pi(Math.atan2(e.y, e.x) - g.alpha0); return Math.floor(th / (2 * g.w) + 1e-9); }

// ---------------------------------------------------------------- orbits under a subgroup, inside the full orbits
function canonKey(g, els, i, j) {
    const N = g.nodes.length; let best = Infinity;
    for (const el of els) {
        const a = nodeAt(g, ...el.f(g.nodes[i].x, g.nodes[i].y)), b = nodeAt(g, ...el.f(g.nodes[j].x, g.nodes[j].y));
        if (!a || !b) throw new Error('grid not closed under the subgroup');
        const c = Math.min(a.id, b.id) * N + Math.max(a.id, b.id); if (c < best) best = c;
    }
    return best;
}
function hOrbits(g, full, H) {   // [{ F, pairs, key }]
    const out = [];
    for (const F of full) {
        const by = new Map();
        for (const [i, j] of F.pairs) { const k = canonKey(g, H.els, i, j); if (!by.has(k)) by.set(k, []); by.get(k).push([i, j]); }
        for (const [key, pairs] of by) out.push({ F, pairs, key });
    }
    return out;
}
// class j from a generating pair p0 of the full orbit (z1 end in the closed S0) and the group elements g = r^t m_0^eps that map p0 onto a pair q (the stabiliser of p0 gives several g):
//   eps = 0: the pair is a rotated copy of the generating pair, j = -t (clockwise steps); eps = 1: a turned copy (48d_j is the mirror image of 84d_j), j = t.
function elemsOf(shape) {
    const K = SHAPE[shape].K, m0 = mirEl(shape, 0), out = [];
    for (let t = 0; t < K; t++) out.push({ eps: 0, t, f: rotEl(K, t).f });
    for (let t = 0; t < K; t++) { const r = rotEl(K, t); out.push({ eps: 1, t, f: (x, y) => r.f(...m0.f(x, y)) }); }
    return out;
}
function genMap(g, shape, F) {   // F._gm: Map "i,j" -> [{eps, t}]
    if (F._gm) return F._gm;
    const w = g.w, inS0 = (e) => { if (Math.hypot(e.x, e.y) < EPS) return false; const th = wrap2pi(Math.atan2(e.y, e.x) - g.alpha0); return th <= w + 1e-9 || th > TAU - 1e-9; };
    let best = null;
    for (const [i, j] of F.pairs) {
        const A = g.nodes[i], B = g.nodes[j], ends = F.z1 === F.z2 ? [[A, B], [B, A]] : (A.zahl === F.z1 ? [[A, B]] : [[B, A]]);
        for (const [e, o] of ends) if (inS0(e)) { const th = wrap2pi(Math.atan2(e.y, e.x) - g.alpha0), th2 = wrap2pi(Math.atan2(o.y, o.x) - Math.atan2(e.y, e.x)), key = [Math.round((th > TAU - 1e-9 ? 0 : th) * 1e6), Math.round(th2 * 1e6), i, j]; if (!best || key.some((v, q) => v !== best.key[q] && (key.slice(0, q).every((u, r) => u === best.key[r]) && v < best.key[q]))) best = { key, i, j }; }
    }
    if (!best) throw new Error('no generating pair for ' + F.name);
    const A = g.nodes[best.i], B = g.nodes[best.j], gm = new Map();
    for (const el of elemsOf(shape)) {
        const a = nodeAt(g, ...el.f(A.x, A.y)), b = nodeAt(g, ...el.f(B.x, B.y)), k = Math.min(a.id, b.id) + ',' + Math.max(a.id, b.id);
        if (!gm.has(k)) gm.set(k, []); gm.get(k).push({ eps: el.eps, t: el.t });
    }
    F._gm = gm; return gm;
}
function classSet(g, shape, H, F, pairs, mode) {   // mode 'eps0': rotated copies only (preferred), falls back to turned copies; 'all': both
    const gm = genMap(g, shape, F), s0 = new Set(), s1 = new Set(), md = (v) => ((v % H.m) + H.m) % H.m;
    for (const [i, j] of pairs) for (const e of gm.get(Math.min(i, j) + ',' + Math.max(i, j))) (e.eps === 0 ? s0 : s1).add(e.eps === 0 ? md(-e.t) : md(e.t));
    return mode === 'all' ? [...new Set([...s0, ...s1])] : (s0.size ? [...s0] : [...s1]);
}
function nameOf(shape, g, H, ho, rotOrbitOf) {
    const F = ho.F, hasMirror = H.mirs.length > 0;
    let h = 0;
    if (!hasMirror) { const hs = new Set(ho.pairs.map(([i, j]) => handedness(g, F, g.nodes[i], g.nodes[j]))); h = [...hs][0]; if (hs.size !== 1) return { name: null, ambiguous: 'h' }; }
    // index class (generating pair of the full orbit, see classSet)
    const jset = classSet(g, shape, H, F, ho.pairs, 'eps0');
    if (!jset.length) return { name: null, ambiguous: 'j0' };
    const j = Math.min(...jset), ambiguousJ = jset.length > 1;
    // case of the letter
    let letter = F.letter, marker = '';
    if (hasMirror) {
        const rotEls = H.els.filter((e) => !e.mirror), subs = new Set(ho.pairs.map(([a, b]) => canonKey(g, rotEls, a, b)));
        letter = subs.size === 1 ? F.letter + F.letter.toUpperCase() : F.letter.toUpperCase();
    } else {
        // invariant under a mirror layout of the matching D group? (sign before the letter in Tabelle 9)
        const lay = [];
        for (const parity of [0, 1]) {
            const mirs = [...Array(H.K).keys()].filter((q) => q % 2 === parity).map((q) => mirEl(shape, q));
            const [a, b] = ho.pairs[0]; const own = canonKey(g, H.els, a, b);
            const m = mirs[0], im = nodeAt(g, ...m.f(g.nodes[a].x, g.nodes[a].y)), jm = nodeAt(g, ...m.f(g.nodes[b].x, g.nodes[b].y));
            if (canonKey(g, H.els, im.id, jm.id) === own) lay.push(parity === 0 ? 'x' : '+');
        }
        marker = lay.join('');
        if (lay.length) letter = F.letter + F.letter.toUpperCase();
    }
    let fam;
    if (F.z1 !== F.z2) fam = h < 0 ? familyName(F.z2, F.z1) : familyName(F.z1, F.z2);
    else fam = h < 0 ? (F.z1 >= 10 ? F.z1 + '._' + F.z2 : F.z1 + '_' + F.z2) : familyName(F.z1, F.z2);
    const idx = indexOf(shape, H, j), bar = F.bar ? '~' : '';
    return { name: { uni: `${H.layout ? (H.layout === 'x' ? '⊠' : '⌗') : ''}${marker}|${fam}${letter}${bar}${idx[0]}`, asc: `${H.layout}${marker}|${fam}${letter}${bar}${idx[1]}` }, j, ambiguousJ, h, nRot: hasMirror ? 0 : 0 };
}

// ---------------------------------------------------------------- measurement of one grid under every subgroup
function measureNet(shape, n, lage) {
    const g = buildGrid(shape, n, lage), full = pairOrbits(g), groups = groupsOf(shape), res = { shape, n, lage, full: full.length, groups: {} };
    for (const H of groups) {
        const ho = hOrbits(g, full, H), hist = {}, per = new Map();
        ho.forEach((o) => per.set(o.F, (per.get(o.F) || 0) + 1));
        per.forEach((c) => { hist[c] = (hist[c] || 0) + 1; });
        const names = new Map(); let ambig = 0, nameless = 0;
        for (const o of ho) {
            const r = nameOf(shape, g, H, o);
            if (!r.name) { nameless++; continue; }
            if (r.ambiguousJ) ambig++;
            names.set(r.name.asc, (names.get(r.name.asc) || 0) + 1);
        }
        res.groups[H.id] = { orbits: ho.length, hist, collisions: [...names].filter(([, c]) => c > 1).map(([k, c]) => k + ' x' + c), ambig, nameless, names: names.size };
    }
    res.g = g; res.fullOrbits = full;
    return res;
}

// ================================================================ run
const section = (t) => log('\n== ' + t + ' ==');
const NETS = [['triangle', 3, 2, '3.Dreieck 2. Lage'], ['triangle', 4, 2, '4.Dreieck 2. Lage'], ['square', 4, 2, '4.Quadrat 2. Lage'], ['square', 5, 2, '5.Quadrat 2. Lage'], ['hex', 3, 1, '3.Sechseck 1. Lage'], ['hex', 4, 1, '4.Sechseck 1. Lage'], ['hex', 2, 2, '2.Sechseck 2. Lage']];
const ALL = [];
for (const shape of ['triangle', 'square', 'hex']) for (let lage = 1; lage <= 2; lage++) { const maxN = lage === 1 ? 8 : (shape === 'hex' ? 4 : 6); for (let n = 1; n <= maxN; n++) ALL.push([shape, n, lage]); }

section('2a. Quellenindex -> Gruppe in der App (core/symmetry.js symmetryMode) -> Untergruppe der Hauptgruppe');
for (const shape of ['triangle', 'square', 'hex']) groupsOf(shape).forEach((H) => log(`${SHAPE_NAME[shape].padEnd(9)} ${H.id.padEnd(4)} ${H.src.padEnd(52)} symmetryMode: ${H.mode.padEnd(26)} Drehungen ${H.rots.length}, Spiegelachsen ${H.mirs.length}, Indexklassen m = ${H.m}`));

section('2b. Bahnen der Knotenpaare je Untergruppe (die sieben Netze der Quelle; voll = Bahnen der Hauptgruppe)');
const nets = NETS.map(([s, n, l, label]) => ({ label, ...measureNet(s, n, l) }));
for (const r of nets) log(`${r.label.padEnd(20)} voll ${String(r.full).padStart(4)} | ` + Object.entries(r.groups).map(([id, v]) => `${id} ${v.orbits} (${Object.entries(v.hist).map(([k, c]) => c + 'x' + k).join(' ')})`).join(' | '));

section('2c. Zahlen der Quelle gegen die Rechnung (Drehlinge / Spiegelinge / Formen / zugleich)');
const SRC = [['hex', 3, 1, '3.Sechseck (S. 54)', 71, 41, 112, 30], ['hex', 4, 1, '4.Sechseck (S. 54)', 180, 126, 306, 54], ['hex', 2, 2, '2.Sechseck 2. Lage (S. 55)', 94, 59, 153, 35]];
for (const [shape, n, lage, label, d, sp, fo, both] of SRC) {
    const r = nets.find((x) => x.shape === shape && x.n === n && x.lage === lage), ach = r.fullOrbits.filter((o) => o.achiral).length;
    const ok = r.full === d && r.full - ach === sp && 2 * r.full - ach === fo && ach === both;
    if (!ok) internalBad++;
    log(`${ok ? 'gleich' : 'ABWEICHUNG'}  ${label}: Quelle ${d} / ${sp} / ${fo} / ${both}, gerechnet ${r.full} / ${r.full - ach} / ${2 * r.full - ach} / ${ach}`);
}
{   const r = nets.find((x) => x.label === '4.Quadrat 2. Lage'), ach = r.fullOrbits.filter((o) => o.achiral).length; log(`4.Quadrat (034.png): Drehlinge 125, zugleich 44, Spiegelinge 81, Formen 206: gerechnet ${r.full} / ${ach} / ${r.full - ach} / ${2 * r.full - ach}`); }
log('Zahl der zweizähligen / dreizähligen Formen: in den lesbaren Seiten nicht genannt (S. 43-46, 49-51, 56-59, 63-67, 70, 74-77 fehlen); nur die Tabellen 9 (S. 47/48) und 11 (S. 68/69) sind da, Zeile für Zeile nicht ausgezählt.');

section('2d. Zerfall: eine Bahn der Drehgruppe C_K -> wie viele Bahnen der Untergruppe (alle 40 Gitter)');
{
    const acc = {};
    for (const [shape, n, lage] of ALL) {
        const g = buildGrid(shape, n, lage), full = pairOrbits(g), gs = groupsOf(shape), top = gs.find((H) => H.mirs.length === 0 && H.m === 1);
        const topO = hOrbits(g, full, top);
        for (const H of gs.filter((x) => x.mirs.length === 0 && x.m > 1)) {
            const ho = hOrbits(g, full, H), key = `${shape} ${top.id} -> ${H.id}`; acc[key] = acc[key] || {};
            // children of each top orbit: the H orbits whose first pair lies in it
            const topKey = new Map(); topO.forEach((o, idx) => o.pairs.forEach(([a, b]) => topKey.set(a + ',' + b, idx)));
            const kids = new Map(); ho.forEach((o) => { const t = topKey.get(o.pairs[0][0] + ',' + o.pairs[0][1]); kids.set(t, (kids.get(t) || 0) + 1); });
            kids.forEach((c) => { acc[key][c] = (acc[key][c] || 0) + 1; });
        }
    }
    Object.entries(acc).forEach(([k, h]) => log(`${k}: ${Object.entries(h).map(([c, v]) => v + ' Bahnen -> ' + c).join(', ')}`));
}

section('3a. Probe: die Familie der Quelle (S. 40/41, 60-62, 71-73) in allen Untergruppen');
function probe(shape, n, lage, fam, letter, label) {
    const g = buildGrid(shape, n, lage), full = pairOrbits(g), F = full.filter((o) => familyName(o.z1, o.z2) === fam && o.letter === letter);
    log(`${label}: ${F.length} volle Bahn(en) ${fam}${letter}`);
    F.forEach((f) => {
        const line = [];
        for (const H of groupsOf(shape).filter((x) => !x.id.startsWith('Z2'))) {
            const ho = hOrbits(g, [f], H), nm = ho.map((o) => nameOf(shape, g, H, o)).map((r) => r.name ? r.name.uni.split('|') : ['?', '?']);
            line.push(`${H.id}: ${nm.map((x) => x[0] + x[1]).join(' ')}`);
        }
        log('  ' + line.join(' ; '));
    });
}
probe('square', 4, 2, '84', 'd', '4.Quadrat 2. Lage (S. 40: 84d4, 84d2, 84dII, 48d2, 48dII; S. 41: 84D2 mit ⊠ / ⌗, 84DII)');
probe('hex', 4, 1, '84', 'e', '4.Sechseck 1. Lage (S. 60: 84e3, 84eIII, 48e3, 48eIII; 84E3 mit ⊹ / ‡; S. 71: 84e2, 84eII, 84e=)');

section('3b. Eindeutigkeit des Namens (Achsenzeichen, Zahlenstellen, Buchstabe samt Gross-/Kleinschreibung, Überstrich, Index, drehgleiche Klasse) je Untergruppe, alle 40 Gitter');
const tot = {};
for (const [shape, n, lage] of ALL) {
    const r = measureNet(shape, n, lage);
    for (const [id, v] of Object.entries(r.groups)) { if (id.startsWith('Z2')) continue; const t = tot[shape + ' ' + id] = tot[shape + ' ' + id] || { grids: 0, orbits: 0, collGrids: 0, coll: 0, ambig: 0, nameless: 0, ex: [] }; t.grids++; t.orbits += v.orbits; t.ambig += v.ambig; t.nameless += v.nameless; if (v.collisions.length) { t.collGrids++; t.coll += v.collisions.length; if (t.ex.length < 3) t.ex.push(`${n}/${lage}: ${v.collisions.slice(0, 2).join(' ')}`); } }
}
Object.entries(tot).forEach(([k, t]) => log(`${k.padEnd(12)} ${String(t.orbits).padStart(6)} Bahnen in ${t.grids} Gittern: ${t.collGrids === 0 ? 'eindeutig' : 'KOLLISIONEN in ' + t.collGrids + ' Gittern (' + t.coll + ' Namen)'}; Klasse j nicht eindeutig: ${t.ambig}; ohne Namen: ${t.nameless}` + (t.ex.length ? '  z. B. ' + t.ex.join(' | ') : '')));

section('3c. Achsenlage und Indexklasse: Spiegelbahn = Drehbahn + ihr Spiegelbild, gleiche Klasse (⊠ / ⊹ / Hauptstellung) oder andere (⌗ / ‡)');
for (const [shape, n, lage] of [['square', 4, 2], ['square', 5, 2], ['hex', 3, 1], ['hex', 4, 1], ['hex', 2, 2]]) {
    const g = buildGrid(shape, n, lage), full = pairOrbits(g), line = [];
    for (const H of groupsOf(shape).filter((x) => x.mirs.length && x.m > 1 && x.m < x.K)) {
        let same = 0, diff = 0, other = 0;
        for (const o of hOrbits(g, full, H)) {
            if (o.F.achiral) continue;   // generic orbits only (no stabiliser): one class per pair
            const js = new Set(classSet(g, shape, H, o.F, o.pairs, 'all'));
            if (js.size === 1) same++; else if (js.size === 2) diff++; else other++;
        }
        line.push(`${H.id}: ${same} Bahnen mit einer Klasse, ${diff} mit zwei verschiedenen, ${other} sonst`);
    }
    log(`${SHAPE_NAME[shape]} ${n}/${lage}: ` + line.join('; '));
}

section('4a. Gesetz 1c als aA (Entscheidung): Rotation-Namen der vollen Drehgruppe, 1c-Bahnen ohne Unterscheidung der beiden Händigkeiten');
{
    let c1 = 0, grids = 0;
    for (const [shape, n, lage] of ALL) {
        const g = buildGrid(shape, n, lage), full = pairOrbits(g), top = groupsOf(shape).find((H) => H.mirs.length === 0 && H.m === 1);
        const ho = hOrbits(g, full, top), per = new Map(); ho.forEach((o) => per.set(o.F, (per.get(o.F) || 0) + 1));
        let k = 0; full.forEach((F) => { if (F.achiral && per.get(F) === 2) k++; });
        if (k) grids++; c1 += k;
    }
    log(`${c1} Bahnen in ${grids} Gittern: zwei Drehbahnen, Name beider "aA" (Quelle) - der Name trifft dann zwei verschiedene Bahnen (gewollte Mehrdeutigkeit, 11 % der aA-Bahnen).`);
}
section('4b. Zusammenfassung zweier spiegelgleicher Drehlinge zu 52A (nur Anzeige): ist sie genau?');
{
    let ok = 0, bad = 0;
    for (const [shape, n, lage] of ALL) {
        const g = buildGrid(shape, n, lage), full = pairOrbits(g), top = groupsOf(shape).find((H) => H.mirs.length === 0 && H.m === 1);
        const ho = hOrbits(g, full, top), by = new Map(); ho.forEach((o) => { if (!by.has(o.F)) by.set(o.F, []); by.get(o.F).push(o); });
        by.forEach((list, F) => {
            if (list.length !== 2) return;
            const [a, b] = list.map((o) => nameOf(shape, g, top, o).name.asc.split('|')[1]);
            const strip = (s) => s.replace('_', '').split('').sort().join('');
            if (a !== b && strip(a.replace(/[~]/g, '')) === strip(b.replace(/[~]/g, ''))) ok++; else bad++;
        });
    }
    log(`${ok} Paare (R, Spiegelbild) tragen dieselbe Ziffern-, Buchstaben- und Indexfolge bis auf die Reihenfolge der Ziffern bzw. den Unterstrich: ${bad === 0 ? 'Zusammenfassung zu Grossbuchstaben ist eindeutig' : bad + ' Ausnahmen'}.`);
    if (bad) internalBad++;
}

section('4c. Volle Gruppe: Namen der Quelle (Index, Spiegeling gross) gegen den heutigen App-Namen');
{
    let chiral = 0, both = 0;
    for (const [shape, n, lage] of ALL) { const full = pairOrbits(buildGrid(shape, n, lage)); full.forEach((o) => { if (o.achiral) both++; else chiral++; }); }
    log(`In 40 Gittern: ${chiral} volle Bahnen chiral (Quelle: Spiegeling, Gross-Buchstabe: 52A), ${both} zugleich Drehling und Spiegeling (aA). Heutiger Name: chirale Bahnen klein (52a), Gruppe als Stern (/4*). Quelle: 4□/ 84D₄ (Quadrat), 4*/ 54g₆ (Sechseck; Index auch kurz nach dem Schrägstrich: 4*/₆ 59a + 58c), Dreieck ohne Index.`);
}

log(`\nInterne Prüfungen (Zahlen der Quelle S. 54/55): ${internalBad === 0 ? 'alle gleich' : internalBad + ' Abweichungen'}`);
if (strict && internalBad) process.exit(1);
