/**
 * tools/gitter/measure-rotation-names.js
 * Task 072a: names of the Drehlinge (pure rotation, mode "nur Drehung") measured against the Hinterreiter source (docs/quellen/05-07.png, not committed).
 * Pure functions, node only, no core/, no sketch.js. It reuses the grid / group / full-group oracle of tools/gitter/measure-name-rule.js (task 054) by require (that file only exports).
 *
 *   node tools/gitter/measure-rotation-names.js            prints the measurement, exit 0
 *   node tools/gitter/measure-rotation-names.js --strict   exit 1 when an internal consistency check fails (not when the source differs: that is the measurement)
 *
 * Definitions (all unordered pairs of grid nodes, as in 054):
 *   full orbit  = orbit of a pair under the whole main group (K rotations + K mirrors) = one Drehling of the source tables ("Familie z1 z2, Buchstabe").
 *   rot orbit   = orbit under the K rotations only. A full orbit is ONE rot orbit (geometrically achiral) or TWO rot orbits R and its mirror image mR (index 2).
 *   sector type of a node = the sector (Teildreieck) it lies in is a rotated copy of S0 (+1, S0 = the shaded one: clockwise edge = corner axis) or of its mirror image S0' (-1); 0 = on an axis (or the centre).
 *   handedness h of a rot orbit (proposal): z1 != z2: h = type of the z1 end; if that end lies on an axis: sign of the angle from the z1 end to the z2 end (0 = collinear with the centre).
 *                                           z1 == z2: h = the common type of both ends; different types or on an axis: 0 (achiral).
 *   proposed name of a rot orbit: z1 != z2: digits in the order of the handedness (h > 0: z1 z2, h < 0: z2 z1); z1 == z2 (chiral): h > 0 plain, h < 0 with an underline mark "_" after the first digit
 *                                  (the source underlines one of the two equal digits, 07.png); letter and bar are those of the full orbit (054); achiral: the full name unchanged (aA).
 */
'use strict';

const M = require('./measure-name-rule.js');
const { buildGrid, pairOrbits, nodeAt, fold, familyName, SHAPE } = M;
const TAU = 2 * Math.PI, EPS = 1e-9;
const wrap2pi = (a) => ((a % TAU) + TAU) % TAU;
const SHAPES = ['triangle', 'square', 'hex'];
const SHAPE_NAME = { triangle: 'Dreieck', square: 'Quadrat', hex: 'Sechseck' };
const strict = process.argv.includes('--strict');
let internalBad = 0;
const log = (...a) => console.log(...a);

// ---------------------------------------------------------------- group elements (rotation by k, mirror j), same frame as the oracle (S0 = [alpha0, alpha0 + w])
function rotEl(K, k) { const c = Math.cos(TAU * k / K), s = Math.sin(TAU * k / K); return { mirror: false, k, f: (x, y) => [c * x - s * y, s * x + c * y] }; }
function mirEl(shape, j) { const { K, alpha0 } = SHAPE[shape], p = alpha0 + j * Math.PI / K, c = Math.cos(2 * p), s = Math.sin(2 * p); return { mirror: true, j, f: (x, y) => [c * x + s * y, s * x - c * y] }; }

// ---------------------------------------------------------------- sector type and handedness
function sectorInfo(g, nd) {
    const r = Math.hypot(nd.x, nd.y);
    if (r < EPS) return { onAxis: true, type: 0 };
    const w = g.w, u = wrap2pi(Math.atan2(nd.y, nd.x) - g.alpha0) % (2 * w);
    if (u < 1e-9 || Math.abs(u - w) < 1e-9 || Math.abs(u - 2 * w) < 1e-9) return { onAxis: true, type: 0 };
    return { onAxis: false, type: u < w ? 1 : -1 };
}
function angleFromTo(e, f) {   // signed angle of the vector f relative to e in (-pi, pi]; null when one is the centre
    if (Math.hypot(e.x, e.y) < EPS || Math.hypot(f.x, f.y) < EPS) return null;
    let d = wrap2pi(Math.atan2(f.y, f.x) - Math.atan2(e.y, e.x)); if (d > Math.PI + 1e-9) d -= TAU;
    return d;
}
// handedness of the rot orbit that contains the pair (A, B) of the full orbit o
function handedness(g, o, A, B) {
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
function rotName(o, h) {
    const bar = o.bar ? '~' : '';
    if (h === 0) return o.name;
    if (o.z1 !== o.z2) return familyName(h > 0 ? o.z1 : o.z2, h > 0 ? o.z2 : o.z1) + o.letter + bar;
    const fam = h > 0 ? familyName(o.z1, o.z2) : (o.z1 >= 10 ? o.z1 + '_.' + o.z2 : o.z1 + '_' + o.z2);
    return fam + o.letter + bar;
}

// ---------------------------------------------------------------- orbits of pairs under a subgroup H (list of elements), inside the full orbits
// canonKey(g, H, i, j): the smallest ordered image pair id under H
function canonKey(g, H, i, j) {
    const N = g.nodes.length; let best = Infinity;
    for (const el of H) {
        const a = nodeAt(g, ...el.f(g.nodes[i].x, g.nodes[i].y)), b = nodeAt(g, ...el.f(g.nodes[j].x, g.nodes[j].y));
        if (!a || !b) throw new Error('grid not closed under the subgroup');
        const c = Math.min(a.id, b.id) * N + Math.max(a.id, b.id); if (c < best) best = c;
    }
    return best;
}
// splitInfo(g, full, H) -> { orbits, hist: {1: n, 2: n, ...} (full orbits splitting into that many H orbits), byFull: [keys] }
function splitInfo(g, full, H) {
    let orbits = 0; const hist = {}, byFull = [];
    for (const o of full) {
        const keys = new Map();
        for (const [i, j] of o.pairs) { const k = canonKey(g, H, i, j); if (!keys.has(k)) keys.set(k, []); keys.get(k).push([i, j]); }
        orbits += keys.size; hist[keys.size] = (hist[keys.size] || 0) + 1; byFull.push(keys);
    }
    return { orbits, hist, byFull };
}

// ---------------------------------------------------------------- measurement of one grid
function measureGrid(shape, n, lage, opt) {
    const g = buildGrid(shape, n, lage), K = g.K, full = pairOrbits(g), rots = [...Array(K).keys()].map((k) => rotEl(K, k));
    const sp = splitInfo(g, full, rots);
    const res = { shape, n, lage, nodes: g.nodes.length, full: full.length, rot: sp.orbits, hist: sp.hist, achiralOracle: 0, achiralGeo: 0, only1c: 0, geoOnly: 0, mismatchH: 0, inconsistentH: 0, notOpposite: 0,
        collisions: [], names: 0, cats: {}, examples1c: [], exceptions: [] };
    const names = new Map();
    full.forEach((o, idx) => {
        const keys = sp.byFull[idx], geoAchiral = keys.size === 1;
        if (o.achiral) res.achiralOracle++;
        if (geoAchiral) res.achiralGeo++;
        if (o.achiral && !geoAchiral) { res.only1c++; if (res.examples1c.length < 4) res.examples1c.push(o.name); }
        if (!o.achiral && geoAchiral) { res.geoOnly++; res.exceptions.push('geometrisch achiral, Quelle chiral: ' + o.name); }
        // handedness: computed per pair, must be one value per rot orbit, opposite for the two rot orbits, 0 exactly for geometric achirality
        const hs = [];
        for (const [, pairs] of keys) {
            const set = new Set(pairs.map(([i, j]) => handedness(g, o, g.nodes[i], g.nodes[j])));
            if (set.size !== 1) { res.inconsistentH++; res.exceptions.push('h nicht Bahninvariante: ' + o.name); }
            hs.push([...set][0]);
        }
        if (geoAchiral ? hs[0] !== 0 : (hs.length !== 2 || hs[0] === 0 || hs[1] === 0 || hs[0] + hs[1] !== 0)) { res.mismatchH++; if (res.exceptions.length < 12) res.exceptions.push(`h gegen Brute-Force: ${o.name} h=${hs.join('/')} Bahnen=${keys.size}`); }
        // categories of the full orbit (for the exception table)
        const E = g.nodes[o.pairs[0][0]], F = g.nodes[o.pairs[0][1]], onAx = sectorInfo(g, E).onAxis || sectorInfo(g, F).onAxis;
        const cat = (o.z1 === o.z2 ? 'z1=z2' : 'z1>z2') + (onAx ? ' Achse' : ' frei') + ' -> ' + (geoAchiral ? '1' : '2') + ' Bahn' + (geoAchiral ? '' : 'en');
        res.cats[cat] = (res.cats[cat] || 0) + 1;
        // names (geometric handedness decides, not the capital letter)
        hs.forEach((h) => { const nm = rotName(o, geoAchiral ? 0 : h), pr = names.get(nm); names.set(nm, (pr || 0) + 1); });
    });
    res.names = names.size;
    res.collisions = [...names].filter(([, c]) => c > 1).map(([k, c]) => k + 'x' + c);
    if (res.rot !== names.size + res.collisions.reduce((a, s) => a + Number(s.split('x')[1]) - 1, 0)) res.mismatchH++;
    // the formula rot = 2 full - achiral (geometric)
    res.formulaOk = res.rot === 2 * res.full - res.achiralGeo;
    return res;
}

// ---------------------------------------------------------------- source data (read from the images, see reports/054.md)
const SOURCE = [   // [shape, n, lage, label, Drehlinge (full orbits), zugleich Spiegelinge, image]
    ['triangle', 3, 2, '3.Dreieck (07.png, Tabelle 1)', 37, 19], ['triangle', 4, 2, '4.Dreieck (08.png, Tabelle 2)', 94, 37],
    ['square', 4, 2, '4.Quadrat (034.png, Tabelle 7)', 125, 44], ['square', 5, 2, '5.Quadrat (034.png, Tabelle 7; Text 261/64)', 262, 65],
];

// ================================================================ run
function section(t) { log('\n== ' + t + ' =='); }
const ROWS = [];
for (const shape of SHAPES) {
    for (let lage = 1; lage <= 2; lage++) {
        const maxN = lage === 1 ? 8 : (shape === 'hex' ? 4 : 6);
        for (let n = 1; n <= maxN; n++) ROWS.push([shape, n, lage]);
    }
}
section('1. Bahnen je Form, Ordnung (Lage 1: 1..8, Lage 2: Dreieck/Quadrat 1..6, Sechseck 1..4)');
log('Form    n Lage  Knoten  voll  nurDreh  zerfallen  achiral(geo)  achiral(Quelle 054)  nur durch Gesetz 1c  2*voll-achiral(geo)=nurDreh  h-Fehler  Kollisionen');
const results = [];
const t0 = Date.now();
for (const [shape, n, lage] of ROWS) {
    const r = measureGrid(shape, n, lage); results.push(r);
    const bad = r.mismatchH || r.inconsistentH || !r.formulaOk || r.collisions.length;
    if (bad) internalBad++;
    log(`${SHAPE_NAME[shape].padEnd(8)}${String(n).padStart(2)} ${lage}     ${String(r.nodes).padStart(5)}  ${String(r.full).padStart(5)}  ${String(r.rot).padStart(7)}  ${String(r.rot - r.full).padStart(9)}  ${String(r.achiralGeo).padStart(12)}  ${String(r.achiralOracle).padStart(19)}  ${String(r.only1c).padStart(19)}  ${r.formulaOk ? 'ja' : 'NEIN'}                             ${String(r.mismatchH + r.inconsistentH).padStart(5)}     ${r.collisions.length}`);
}
log(`(Rechenzeit ${((Date.now() - t0) / 1000).toFixed(1)} s)`);

section('2. Hypothese: Bahn voll -> 2 Drehling-Bahnen (nicht Spiegeling) oder 1 (Spiegeling)');
const tot = results.reduce((a, r) => { a.full += r.full; a.rot += r.rot; a.one += r.hist[1] || 0; a.two += r.hist[2] || 0; a.more += Object.keys(r.hist).filter((k) => k > 2).length; a.achGeo += r.achiralGeo; a.achSrc += r.achiralOracle; a.c1 += r.only1c; a.geoOnly += r.geoOnly; return a; }, { full: 0, rot: 0, one: 0, two: 0, more: 0, achGeo: 0, achSrc: 0, c1: 0, geoOnly: 0 });
log(`${results.length} Gitter, ${tot.full} volle Bahnen: ${tot.one} bleiben eine Drehling-Bahn, ${tot.two} zerfallen in genau zwei, ${tot.more} Gitter mit mehr als zwei (Index der Drehgruppe ist 2: nie mehr).`);
log(`Geometrisch achiral (Drehspiegelung bildet die Bahn auf sich ab): ${tot.achGeo}; Spiegelinge nach Quelle/054 (aA, mit Gesetz 1c): ${tot.achSrc}; davon nur durch Gesetz 1c (geometrisch chiral): ${tot.c1}; geometrisch achiral, Quelle chiral: ${tot.geoOnly}.`);
const catAll = {}; results.forEach((r) => Object.entries(r.cats).forEach(([k, v]) => { catAll[k] = (catAll[k] || 0) + v; }));
Object.entries(catAll).sort().forEach(([k, v]) => log(`  ${k}: ${v}`));
const some1c = results.filter((r) => r.only1c).slice(0, 6);
log('Beispiele fuer Gesetz 1c (Strich in einer Netzseite, geometrisch zwei Drehling-Bahnen, in der Quelle aA): ' + (some1c.map((r) => `${SHAPE_NAME[r.shape]} ${r.n}/${r.lage}: ${r.only1c} (${r.examples1c.join(' ')})`).join('; ') || 'keine'));
const exc = results.filter((r) => r.exceptions.length);
log(exc.length ? 'Ausnahmen:\n  ' + exc.map((r) => `${SHAPE_NAME[r.shape]} ${r.n}/${r.lage}: ${r.exceptions.slice(0, 4).join(' | ')}`).join('\n  ') : 'Ausnahmen gegen die Gruppentheorie (h-Regel, Bahninvarianz, Gegensinn der zwei Bahnen): keine.');

section('3. Namensvorschlag (Zahlenstellen in Zugrichtung, Unterstrich bei z1 = z2, Buchstabe und Ueberstrich der vollen Bahn)');
const coll = results.filter((r) => r.collisions.length);
log(`Eindeutigkeit: ${results.length - coll.length} von ${results.length} Gitter ohne Kollision (Name = (Zahlenstellen in Reihenfolge, Buchstabe, Ueberstrich, Unterstrich)); Namen = Bahnen in allen.` + (coll.length ? ' KOLLISIONEN: ' + coll.map((r) => `${r.shape} ${r.n}/${r.lage}: ${r.collisions.slice(0, 5).join(' ')}`).join('; ') : ''));
{   // sample: 3. Dreieck 2. Lage, rot names next to the full names
    const g = buildGrid('triangle', 3, 2), full = pairOrbits(g), rots = [0, 1, 2].map((k) => rotEl(3, k)), sp = splitInfo(g, full, rots), out = [];
    full.forEach((o, idx) => {
        const keys = [...sp.byFull[idx].values()].map((pairs) => handedness(g, o, g.nodes[pairs[0][0]], g.nodes[pairs[0][1]]));
        out.push(`${o.name}${o.achiral ? '*' : ''}${keys.length === 2 ? ' -> ' + keys.map((h) => rotName(o, h)).join(' + ') : ''}`);
    });
    log('3.Dreieck 2. Lage (Tabelle 1), volle Bahn -> Drehling-Bahnen (* = aA nach Quelle): ' + out.filter((s) => /^(5[1-5]|3[1-3]|21)/.test(s)).join('; '));
}

section('4. Gegen die Quelle: Zahl der Drehlinge');
log('Quelle zaehlt je Tabellenzeile EINE Bahn der vollen Gruppe als Drehling; der spiegelgleiche Drehling (23a zu 32a) steht nicht eigens in der Tabelle, sondern als Spiegeling (Gross-Buchstabe: 32a + 23a).');
log('Netz                                   Drehlinge(Quelle)  gerechnet voll  zugleich Spiegeling(Quelle)  Spiegelinge=Drehl.-zugleich  Formen(Quelle)=Dr+Sp  nurDreh(geo)  nurDreh(Quelle-aA)=2*voll-aA');
for (const [shape, n, lage, label, d, both] of SOURCE) {
    const r = results.find((x) => x.shape === shape && x.n === n && x.lage === lage) || measureGrid(shape, n, lage);
    log(`${label.padEnd(38)} ${String(d).padStart(8)}           ${String(r.full).padStart(8)}        ${String(both).padStart(8)} (gerechnet ${r.achiralOracle})      ${String(d - both).padStart(8)}              ${String(2 * d - both).padStart(8)}          ${String(r.rot).padStart(8)}      ${String(2 * r.full - r.achiralOracle).padStart(8)}`);
}
log('Lesart: Formen (Quelle) = Drehlinge + Spiegelinge = (aA) + 2 * (chirale), das ist die Zahl der Bahnen unter reiner Drehung, wenn jede chirale Bahn in genau zwei Drehling-Bahnen zerfaellt. 3.Dreieck: 19 + 2*18 = 55 (Quelle S. 7: 55 Formen).');

section('5. Ueberstrich-Richtung und schraffiertes Teildreieck (Orakel gegen S. 5/7)');
{   // coordinates: triangle 3, S0 = [0, 60 deg] in the oracle frame (corners at 0/120/240 degrees); the figure of the source (Fig. 11) has its corners at 180/60/-60 degrees
    const g = buildGrid('triangle', 3, 2), full = pairOrbits(g).filter((o) => o.z1 === 5 && o.z2 === 5);
    log('Orakel: S0 = [alpha0, alpha0 + 60 Grad], im Uhrzeigersinn zuerst die Eckachse (C), gegen den Uhrzeigersinn die Seitenmittenachse (M); Ueberstrich = Strich laeuft gegen den Uhrzeigersinn aus S0 (054).');
    log('Fig. 11 (05.png), Pfeil "Teildreieck": das Dreieck neben dem Knoten 4 unterhalb der Waagerechten Mitte - linke Ecke (180 Grad, Eckachse); der Sektor [180, 240 Grad] hat die Eckachse am Uhrzeigersinn-Rand und die Seitenmitte bei 240 Grad am Gegenuhrzeigersinn-Rand: Lage wie S0 im Orakel (um 180 Grad gedreht, Drehung aendert nichts).');
    log('Familie 55 (3.Dreieck 2. Lage), Bahnen der vollen Gruppe mit Ueberstrich (e/e~):' + full.map((o) => ` ${o.name}${o.bar ? '(Gegensinn)' : ''}${o.achiral ? '*' : ''}`).join(''));
    const eb = full.find((o) => o.letter === 'e' && o.bar), ec = full.find((o) => o.letter === 'e' && !o.bar);
    if (eb && ec) {
        const cx = (o) => { const [i, j] = o.pairs[0]; const a = g.nodes[i], b = g.nodes[j]; const f = fold('triangle', a.x, a.y); return [a, b, f]; };
        const toS0 = (a, b) => { const th = wrap2pi(Math.atan2(a.y, a.x) - g.alpha0), k = Math.floor(th / (2 * g.w) + 1e-9), c = Math.cos(-k * 2 * g.w), s = Math.sin(-k * 2 * g.w), R = (p) => ({ x: c * p.x - s * p.y, y: s * p.x + c * p.y }); return [R(a), R(b)]; };
        const show = (o) => { const reps = o.pairs.map(([i, j]) => [g.nodes[i], g.nodes[j]]).filter(([a]) => { const s = sectorInfo(g, a); return !s.onAxis && s.type === 1; })[0]; const [a, b] = toS0(reps[0], reps[1]), d = angleFromTo(a, b), pol = (p) => `${Math.hypot(p.x, p.y).toFixed(3)} / ${(wrap2pi(Math.atan2(p.y, p.x)) * 180 / Math.PI).toFixed(1)} Grad`; return `Ende in S0 [0, 60 Grad] (r / Winkel) ${pol(a)} nach ${pol(b)}: Drehung des Zuges ${(d * 180 / Math.PI).toFixed(1)} Grad = ${d > 0 ? 'gegen' : 'im'} Uhrzeigersinn`; };
        log('  Beleg e : ' + show(ec)); log('  Beleg e~: ' + show(eb));
    }
    log('Ergebnis: die Lage von S0 stimmt mit dem Bild ueberein; das Bild zeigt aber KEINEN eingezeichneten Linienzug e oder e~, die Zuordnung "e = im Uhrzeigersinn" ist nur der Satz auf S. 7 (nicht am Beispiel pruefbar). Bestaetigt als Textdefinition, offen als Bildbeleg.');
}

section('6. Andere Modi (Untergruppen der Hauptgruppe; Bahnen der Knotenpaare, Zerfall je voller Bahn)');
const MODES = (shape) => {
    const { K } = SHAPE[shape], R = (ks) => ks.map((k) => rotEl(K, k)), Mi = (js) => js.map((j) => mirEl(shape, j)), all = [...Array(K).keys()];
    const out = [['volle Gruppe (Referenz)', [...R(all), ...Mi(all)]], ['nur Drehung (C' + K + ')', R(all)]];
    if (shape === 'hex') { out.push(['3-fach (C3, rotation3)', R([0, 2, 4])], ['3-fach + Spiegelung durch Ecken (D3)', [...R([0, 2, 4]), ...Mi([0, 2, 4])]], ['3-fach + Spiegelung durch Seitenmitten (D3)', [...R([0, 2, 4]), ...Mi([1, 3, 5])]]); }
    if (shape === 'triangle') out.push(['nur Spiegelung (eine Achse, Ecke-Seitenmitte)', [...R([0]), ...Mi([0])]]);
    else out.push(['nur Spiegelung, Achse durch Ecken', [...R([0]), ...Mi([0])]], ['nur Spiegelung, Achse durch Seitenmitten', [...R([0]), ...Mi([1])]]);
    return out;
};
for (const [shape, n, lage] of [['triangle', 3, 2], ['square', 4, 2], ['hex', 3, 1], ['hex', 2, 2]]) {
    const g = buildGrid(shape, n, lage), full = pairOrbits(g), line = [];
    for (const [label, H] of MODES(shape)) { const s = splitInfo(g, full, H); line.push(`${label}: ${s.orbits} Bahnen (Zerfall ${Object.entries(s.hist).map(([k, v]) => v + 'x' + k).join(' ')})`); }
    log(`${SHAPE_NAME[shape]} ${n}/${lage} (${full.length} volle Bahnen): ` + line.join('; '));
}
log('Schreibweise der Quelle fuer diese Modi: auf den Seiten 5-7 nicht vorhanden (dort nur volle Gruppe und der spiegelgleiche Drehling); Indizes und Achsenlagen siehe 054 (nicht gelesen in 072a).');

log(`\nInterne Pruefungen (h-Regel gegen Brute-Force, Formel, Kollisionen): ${internalBad === 0 ? 'alle gleich' : internalBad + ' Gitter mit Abweichung'}`);
if (strict && internalBad) process.exit(1);
