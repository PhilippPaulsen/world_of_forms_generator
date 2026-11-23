// Task 120 (3C-0, Typ R): Prototyp der Moebius-Homographie und Messungen 2 bis 7. Importiert nichts aus core/.
// node tools/grid/measure-3c.js            -> Tabellen auf stdout (reports/120-messung.md ist genau diese Ausgabe)
'use strict';
// ---------- Modell ----------
// Quadratgitter (p,q), Maschen = Einheitsquadrate; Ausschnitt p,q >= 0, a <= p+q <= b (ganz) bzw. zusaetzlich p >= q (halb: x in [0,1], Rand T1).
const H = (a, b) => (p, q) => { const v = p + q; return { x: (p - q) / v, y: (1 / a - 1 / v) / (1 / a - 1 / b), v }; };
const clip = (poly, A, B, C) => { // behalte A*p + B*q + C >= 0
  const out = []; for (let i = 0; i < poly.length; i++) { const P = poly[i], Q = poly[(i + 1) % poly.length], dp = A * P[0] + B * P[1] + C, dq = A * Q[0] + B * Q[1] + C;
    if (dp >= 0) out.push(P); if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]); } } return out; };
const area = poly => { let s = 0; for (let i = 0; i < poly.length; i++) { const P = poly[i], Q = poly[(i + 1) % poly.length]; s += P[0] * Q[1] - Q[0] * P[1]; } return Math.abs(s) / 2; };
const BIG = [[-60, -60], [60, -60], [60, 60], [-60, 60]];
const regionHalfplanes = (a, b, fmt) => { const h = [[1, 0, 0], [0, 1, 0], [1, 1, -a], [-1, -1, b]]; if (fmt === 'halb') h.push([1, -1, 0]); return h; };
const clipAll = (poly, hs) => { for (const [A, B, C] of hs) { poly = clip(poly, A, B, C); if (!poly.length) return poly; } return poly; };
// Liniensysteme einer Familie: P (p ganzzahlig), Q, S (p+q in step*Z+off), T (p-q in step*Z+off)
const FAM = {
  '□N':  [{ P: 1, Q: 1 }],
  'DN':  [{ S: [1, 0], T: [1, 0] }],
  'HDN': [{ S: [2, 0], T: [2, 0] }, { S: [2, 1], T: [2, 1] }],
  '□MN': [{ P: 1, S: [1, 0] }, { P: 1, T: [1, 0] }, { Q: 1, S: [1, 0] }, { Q: 1, T: [1, 0] }],
  '△TN': [{ P: 1, Q: 1, S: [1, 0], T: [1, 0] }],
  '△GN': [{ P: 1, Q: 1, S: [2, 0], T: [2, 0] }, { P: 1, Q: 1, S: [2, 1], T: [2, 1] }],
  '△N':  [{ P: 1, Q: 1, S: [1, 0] }, { P: 1, Q: 1, T: [1, 0] }],
  '△MN': [{ P: 1, S: [2, 0], T: [2, 0] }, { P: 1, S: [2, 1], T: [2, 1] }, { Q: 1, S: [2, 0], T: [2, 0] }, { Q: 1, S: [2, 1], T: [2, 1] }],
};
const K = { '□N': 1, 'DN': 2, 'HDN': 1 / 2, '□MN': 1, '△TN': 4, '△GN': 2, '△N': 2, '△MN': 1, '*N': 1 / 3, '*MN': 1 / 6 };
const formula = (fam, a, b, fmt) => K[fam] / 2 * (b * b - a * a) / (fmt === 'halb' ? 2 : 1);
// Maschenzahl durch ZAEHLEN: je Masche (Schlitzvektor) Flaeche im Ausschnitt / Flaeche der ganzen Masche
function countMeshes(sys, a, b, fmt) {
  const rng = (lo, hi) => { const r = []; for (let i = lo; i <= hi; i++) r.push(i); return r; };
  const hs = regionHalfplanes(a, b, fmt), R = b + 1;
  const PL = sys.P ? rng(-1, R) : [null], QL = sys.Q ? rng(-1, R) : [null];
  const so = sys.S ? sys.S[1] : 0, ss = sys.S ? sys.S[0] : 1, to = sys.T ? sys.T[1] : 0, ts = sys.T ? sys.T[0] : 1;
  const SL = sys.S ? rng(Math.floor((a - so) / ss) - 1, Math.ceil((b - so) / ss) + 1) : [null], TL = sys.T ? rng(Math.floor((-b - to) / ts) - 1, Math.ceil((b - to) / ts) + 1) : [null];
  let W = 0, n = 0, full = 0, half = 0, other = 0;
  for (const i of PL) for (const j of QL) for (const s of SL) for (const t of TL) {
    const cons = []; if (i !== null) cons.push([1, 0, -i], [-1, 0, i + 1]); if (j !== null) cons.push([0, 1, -j], [0, -1, j + 1]);
    if (s !== null) cons.push([1, 1, -(so + s * ss)], [-1, -1, so + (s + 1) * ss]); if (t !== null) cons.push([1, -1, -(to + t * ts)], [-1, 1, to + (t + 1) * ts]);
    const face = clipAll(BIG, cons); const fa = area(face); if (fa < 1e-9) continue;
    const inR = clipAll(face, hs), ia = area(inR); if (ia < 1e-9) continue;
    const f = ia / fa; W += f; n++; if (Math.abs(f - 1) < 1e-9) full++; else if (Math.abs(f - 0.5) < 1e-9) half++; else other++;
  }
  return { W, n, full, half, other };
}
const hdr = (t) => console.log('\n## ' + t + '\n');
const row = a => console.log('| ' + a.join(' | ') + ' |');
const tbl = (cols) => { row(cols); row(cols.map(() => '---')); };
const f2 = v => (Math.round(v * 100) / 100).toString().replace('.', ',');

console.log('# Messung 120 (3C-0): Moebiusnetz, projektiver Prototyp\nErzeugt von `node tools/grid/measure-3c.js`; Modell H(p,q) = ((p-q)/(p+q), (1/a - 1/(p+q))/(1/a - 1/b)), Ausschnitt p,q >= 0, a <= p+q <= b (halb: p >= q).');

// ---------- Messung 2 ----------
hdr('Messung 2: W durch Zaehlen der Maschen gegen Quelle S. 48 bis 52 und Formel');
const SRC = [ // [Familie, Fig., a, b, Format, Quelle-W]
  ['□N', '148', 1, 4, 'ganz', 7.5], ['□N', '149', 2, 4, 'ganz', 6], ['□N', '150', 3, 6, 'halb', 6.8],
  ['DN', '151', 1, 3, 'ganz', 8], ['DN', '152', 2, 4, 'halb', 6], ['HDN', '153', 3, 7, 'ganz', 10],
  ['□MN', '154', 2, 4, 'ganz', 6], ['□MN', '155', 2, 4, 'ganz', 6], ['△TN', '156', 2, 4, 'halb', 12],
  ['△GN', '157/158', 2, 4, 'ganz', 12], ['△N', '159/160', 2, 4, 'ganz', 12], ['△N', '161/162', 3, 6, 'halb', 13.5],
  ['△MN', '163/164', 2, 6, 'halb', 8], ['*N', '165', 3, 7, 'ganz', 6.7], ['*N', '166/167', 3, 9, 'halb', 6], ['*MN', '168/169', 4, 12, 'halb', 5.3],
];
tbl(['Familie', 'Fig.', 'a,b', 'Format', 'Quelle W', 'Formel', 'Zaehlung (Varianten)', 'Maschen: ganz/halb/sonst', 'Befund']);
const wCount = (fam, a, b, fmt) => {
  if (fam === '*N') { const t = countMeshes(FAM['△N'][0], a, b, fmt); return { vals: [t.W / 6], note: 'Annahme: Sechseck = 6 Dreiecke des △N, Auslassregel nicht modelliert' , mesh: t }; }
  if (fam === '*MN') { const t = countMeshes(FAM['△MN'][0], a, b, fmt); return { vals: [t.W / 6], note: 'Annahme: Sechseck = 6 △MN-Maschen, Auslassregel nicht modelliert', mesh: t }; }
  const ts = FAM[fam].map(s => countMeshes(s, a, b, fmt)); return { vals: ts.map(t => t.W), mesh: ts[0], note: '' };
};
for (const [fam, fig, a, b, fmt, src] of SRC) {
  const c = wCount(fam, a, b, fmt), fo = formula(fam, a, b, fmt), uniq = [...new Set(c.vals.map(v => f2(v)))];
  const ok = c.vals.every(v => Math.abs(v - fo) < 1e-6) && Math.abs(fo - src) < 0.06 + (src === 6.8 ? 0.1 : 0);
  row([fam, fig, a + ',' + b, fmt, f2(src), f2(fo), uniq.join(' / '), c.mesh.full + '/' + c.mesh.half + '/' + c.mesh.other, (ok ? 'bestaetigt' : 'ABWEICHUNG') + (c.note ? '; ' + c.note : '')]);
}
console.log('\nNicht abbildbar im Prototyp: die Auslassregel der Sechsecknetze (*N, *MN, S. 52) und welche der "zwei Loesungen" das Bild zeigt; es wird nur gezaehlt, nicht gezeichnet.');

// ---------- Messung 3 ----------
hdr('Messung 3: Randmaschen');
console.log('Quadrat □N, Maschen des Ausschnitts nach Anteil (ganz = 1, halb = 0,5):\n');
tbl(['a,b', 'Format', 'W', 'ganze Maschen', 'halbe Maschen', 'andere', 'Anteil der halben an W', 'halbe unten (v=a)', 'halbe oben (v=b)', 'halbe an T1-Achse']);
for (const [a, b, fmt] of [[1, 4, 'ganz'], [2, 4, 'ganz'], [3, 6, 'ganz'], [3, 6, 'halb'], [2, 6, 'ganz'], [2, 5, 'halb'], [3, 7, 'halb'], [4, 7, 'ganz']]) {
  const t = countMeshes(FAM['□N'][0], a, b, fmt), halfCells = t.half;
  // halbe unten: Maschen i+j = a-1 (Antidiagonale p+q=a), oben: i+j = b-1; an T1: Maschen i = j (halb)
  let bot = 0, top = 0, axis = 0; for (let i = 0; i <= b; i++) for (let j = 0; j <= b; j++) { const cell = clipAll(clipAll([[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], regionHalfplanes(a, b, fmt)), []); const ar = area(cell); if (Math.abs(ar - 0.5) < 1e-9) { if (i + j === a - 1) bot++; else if (i + j === b - 1) top++; else if (i === j && fmt === 'halb') axis++; else axis += 0; } }
  row([a + ',' + b, fmt, f2(t.W), t.full, t.half, t.other, f2(halfCells * 0.5 / t.W * 100) + ' %', bot, top, axis]);
}
console.log('\nDreieck der App (60-Grad-Gitter; Rahmen v1 = C-B, v2 = C-A, Netzknoten ganzzahlig in (s,t)):\n');
{
  const A = [0, 0], B = [1, 0], C = [0.5, Math.sqrt(3) / 2], v1 = [C[0] - B[0], C[1] - B[1]], v2 = [C[0] - A[0], C[1] - A[1]];
  const len = v => Math.hypot(v[0], v[1]), ang = Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (len(v1) * len(v2))) * 180 / Math.PI;
  const dS = [v1[0] - v2[0], v1[1] - v2[1]], dT = [v1[0] + v2[0], v1[1] + v2[1]];
  tbl(['Grösse', 'Wert']);
  row(['Winkel zwischen v1 und v2', f2(ang) + ' Grad']); row(['|v1|, |v2|', f2(len(v1)) + ', ' + f2(len(v2))]);
  row(['Richtung p+q = const (v1 - v2): Länge je Gitterschritt', f2(len(dS)) + ' = Dreieckskante? ' + (Math.abs(len(dS) - len(v1)) < 1e-9 ? 'JA' : 'nein')]);
  row(['Richtung p-q = const (v1 + v2): Länge je Gitterschritt', f2(len(dT)) + ' = Dreieckskante? ' + (Math.abs(len(dT) - len(v1)) < 1e-9 ? 'JA' : 'nein (lange Rautendiagonale)')]);
  for (const [a, b, fmt] of [[2, 4, 'ganz'], [3, 6, 'ganz'], [3, 6, 'halb'], [2, 6, 'halb']]) {
    // jede Dreieckskante des Gitters: Segmente zwischen Gitterpunkten mit Differenz (1,0), (0,1), (1,-1); Rand p+q=a, b sowie p=0, q=0 aus solchen Segmenten?
    const t = countMeshes(FAM['△N'][0], a, b, fmt); // △N mit Baren = alle Dreiecke des Gitters
    row(['△N (Baren) a,b=' + a + ',' + b + ' ' + fmt, 'W=' + f2(t.W) + '; ganze Dreiecke ' + t.full + ', halbe ' + t.half + ', andere ' + t.other + (fmt === 'halb' ? ' (T1-Rand p=q liegt NICHT auf einer Dreieckskante, wenn andere/halbe > 0)' : '')]);
  }
}

// ---------- Messung 4 ----------
hdr('Messung 4: Kachelmuster unter H (Linien und Flaechen), Abweichung in px');
{
  const a = 2, b = 4, h = H(a, b), PXW = 600, PXH = 900; // Canvas 600 x 900 (1:1,5), ganzes Format
  const px = (p, q) => { const r = h(p, q); return [(r.x + 1) / 2 * PXW, (1 - r.y) * PXH]; };
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  // Strecken: lange Gitterstrecken ueber Kachelgrenzen, innere Sehnen einer Kachel, freie Knoten; Endpunkte im Ausschnitt (v in [a, b])
  const inRegion = () => { for (;;) { const p = rnd() * b, q = rnd() * b, v = p + q; if (v >= a && v <= b) return [p, q]; } };
  let maxLine = 0, maxCross = 0, n = 0;
  for (let k = 0; k < 20000; k++) {
    const P = inRegion(), Q = inRegion(), A = px(P[0], P[1]), B = px(Q[0], Q[1]);
    for (let s = 1; s < 8; s++) { const t = s / 8, X = px(P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])); // Bild eines Punktes der Strecke gegen die Sehne
      const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, d = Math.abs((X[0] - A[0]) * dy - (X[1] - A[1]) * dx) / L; maxLine = Math.max(maxLine, d); }
    // Teilung an Kachelgrenzen: Streckenzug der Stuecke je Kachel gegen die Gesamtsehne
    const ts = [0, 1]; for (const [u0, u1] of [[P[0], Q[0]], [P[1], Q[1]]]) for (let g = Math.ceil(Math.min(u0, u1)); g <= Math.floor(Math.max(u0, u1)); g++) if (u0 !== u1) { const t = (g - u0) / (u1 - u0); if (t > 0 && t < 1) ts.push(t); }
    ts.sort((x, y) => x - y); for (const t of ts) { const X = px(P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])), dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1; maxCross = Math.max(maxCross, Math.abs((X[0] - A[0]) * dy - (X[1] - A[1]) * dx) / L); }
    n++;
  }
  // Flaechen: Polygon einer Kachel, Kanten als Sehnen; gemeinsame Kante zweier Nachbarkacheln: gleiche Endpunkte -> Spalt 0; Vergleich mit affiner Kachelabbildung (Feld heute)
  const polys = []; for (let i = 0; i < b; i++) for (let j = 0; j < b; j++) { if (i + j + 2 <= a || i + j >= b) continue; polys.push([i, j]); }
  // Muster-Polygon in der Kachel: unregelmaessiges Fuenfeck (relativ 0..1)
  const pent = [[0.1, 0.05], [0.9, 0.2], [0.8, 0.85], [0.4, 0.95], [0.05, 0.6]];
  let maxEdge = 0, maxAff = 0, gap = 0;
  for (const [i, j] of polys) {
    const lo = pent.map(([u, w]) => [i + u, j + w]);
    if (lo.some(([p, q]) => p + q < a || p + q > b)) continue; // nur ganz im Ausschnitt liegende Muster
    for (let e = 0; e < lo.length; e++) { const P = lo[e], Q = lo[(e + 1) % lo.length], A = px(P[0], P[1]), B = px(Q[0], Q[1]); for (let s = 1; s < 8; s++) { const t = s / 8, X = px(P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])), dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy); maxEdge = Math.max(maxEdge, Math.abs((X[0] - A[0]) * dy - (X[1] - A[1]) * dx) / L); } }
    // affine Naeherung (3 Kachelecken (i,j),(i+1,j),(i,j+1)): Abstand der Bilder der Polygonecken zu H
    const O = px(i, j), E1 = px(i + 1, j), E2 = px(i, j + 1);
    for (const [p, q] of lo) { const X = px(p, q), u = p - i, w = q - j, Y = [O[0] + u * (E1[0] - O[0]) + w * (E2[0] - O[0]), O[1] + u * (E1[1] - O[1]) + w * (E2[1] - O[1])]; maxAff = Math.max(maxAff, Math.hypot(X[0] - Y[0], X[1] - Y[1])); }
  }
  // Nachbarkacheln (i,j)|(i+1,j): gemeinsame Kante p = i+1: Ecken (i+1,j),(i+1,j+1) in beiden Kacheln dieselben Punkte -> Spalt = Abstand der Bilder derselben Gitterpunkte (immer 0 mit gleicher Funktion)
  tbl(['Pruefung', 'Zahl', 'groesste Abweichung (px, Canvas 600 x 900)']);
  row(['Bild eines Streckenpunktes gegen die Sehne der Endpunktbilder (zufaellige Strecken im Ausschnitt a=2,b=4, 7 Punkte je Strecke)', n, f2(maxLine) + ' (Gleitkomma-Rest)']);
  row(['Streckenzug aus Teilstuecken je Kachel (geteilt an p,q = ganz) gegen die Gesamtsehne (Kachelgrenzen ueberschritten)', n, f2(maxCross)]);
  row(['Flaechenkanten eines Musterpolygons je Kachel gegen die Bildsehne (Fuenfeck in ' + polys.length + ' Kacheln)', polys.length, f2(maxEdge)]);
  row(['Spalt zwischen Nachbarkacheln (dieselben Gitterpunkte, dieselbe Funktion)', '-', '0 (gleiche Gleitkommawerte)']);
  row(['Vergleich: AFFINE Kachelabbildung (wie das Feld heute, 3 Kachelecken) gegen H, Ecken des Fuenfecks', polys.length, f2(maxAff) + ' (so gross waere der Fehler ohne H)']);
}

// ---------- Messung 5 ----------
hdr('Messung 5: Fluchtlinie und Kachelzahl (Kachelschleife = umschliessendes Rechteck [0,b] x [0,b] in (p,q))');
tbl(['a,b', 'Format', 'Kacheln im Rechteck (halb: [0,b] x [0,b/2])', 'davon mit Flaeche im Ausschnitt', 'ganz unterhalb (v_max <= a)', 'ganz oberhalb (v_min >= b)', 'Kachel mit v_min = 0 (Spitze)', 'Kacheln mit Segment ueber v = a', 'Kacheln mit Segment ueber v = b']);
for (const [a, b, fmt] of [[1, 3, 'ganz'], [1, 4, 'ganz'], [2, 4, 'ganz'], [2, 5, 'ganz'], [3, 6, 'ganz'], [3, 6, 'halb'], [3, 7, 'ganz'], [4, 8, 'ganz'], [2, 6, 'halb']]) {
  const hs = regionHalfplanes(a, b, fmt); let tot = 0, ins = 0, below = 0, above = 0, apex = 0, crossA = 0, crossB = 0;
  const jmax = fmt === 'halb' ? Math.ceil(b / 2) : b; for (let i = 0; i < b; i++) for (let j = 0; j < jmax; j++) { tot++; const sq = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], ar = area(clipAll(sq, hs)); const vmin = i + j, vmax = i + j + 2;
    if (ar > 1e-9) ins++; else if (vmax <= a) below++; else if (vmin >= b) above++; if (vmin === 0) apex++; if (vmin < a && vmax > a) crossA++; if (vmin < b && vmax > b) crossB++; }
  row([a + ',' + b, fmt, tot, ins, below, above, apex, crossA, crossB]);
}
console.log('\nSpalten "ganz unterhalb/oberhalb" zaehlen Kacheln mit keiner Flaeche im Ausschnitt; beim halben Format kommen Kacheln hinzu, die nur ausserhalb der T1-Achse (p < q) liegen (Differenz der Spalten).');
// Kachel an der Spitze: v=0 -> y = -Unendlich; Abstand der Bilder bei geklemmtem v >= eps
{
  const a = 2, b = 4, ys = eps => (1 / a - 1 / eps) / (1 / a - 1 / b);
  tbl(['Klemme v >= eps', 'y des Bildes der Spitze (Rahmenhoehen H)', 'Fehler im sichtbaren Bereich (px, Canvas 600 x 600): Strecke (0,0)-(2,1), Spitze auf (0,eps) geklemmt, gegen exakten Abschnitt bei v = a']);
  const h = H(a, b), PXW = 600, PXH = 600, px = (p, q) => { const r = h(p, q); return [(r.x + 1) / 2 * PXW, (1 - r.y) * PXH]; };
  for (const eps of [1e-1, 1e-2, 1e-3, 1e-4, 1e-6]) {
    // Segment von (0,0) nach (2,1): exakt zu v >= a abgeschnitten; Klemme ersetzt (0,0) durch (eps*2/3, eps/3) auf demselben Strahl? NEIN: die Klemme verschiebt nur den Endpunkt auf v = eps: Punkt (0,0) -> (0, eps)
    const P0 = [0, eps], Q = [2, 1], A = px(P0[0], P0[1]), B = px(Q[0], Q[1]);
    // exakte Sichtlinie: Schnitt der Strecke (0,0)-(2,1) mit v=a bei t: (2t + t) = a -> t = a/3; Punkt (2t, t)
    const t = a / 3, E = px(2 * t, t); // gehoert zur exakten Strecke
    // Abstand dieses Punktes von der geklemmten Sehne A-B
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), d = Math.abs((E[0] - A[0]) * dy - (E[1] - A[1]) * dx) / L;
    row([eps, f2(ys(eps)), f2(d) + ' px']);
  }
}
console.log('\nVorschlag: Linien an der Senke an v >= a (exakt) teilen/abschneiden; Flaechen: Klemme v >= eps mit eps = 1e-3 ergibt oben genannten Fehler; Kacheln mit v_max <= a ueberspringen; Strecken zwischen v = a und v = b nie verwerfen.');

// ---------- Messung 6 ----------
hdr('Messung 6: Streckung der Maschen und Optimum (□N, Rahmen 1 : 1, 1 : 2 hoch, 2 : 1 breit)');
const OPT = { '□N': [7, 12], 'DN': [7, 12], 'HDN': [7, 12], '□MN': [7, 12], '△TN': [8, 16], '△GN': [8, 16], '△N': [8, 16], '△MN': [8, 16], '*N': [6, 10], '*MN': [6, 10] };
// Streckung einer Masche: lokale Bildmasche am Schwerpunkt der Masche im Ausschnitt; Breite = |dx| der waagerechten Diagonale (Schritt p+1, q-1),
// Hoehe = |dy| der senkrechten Diagonale (Schritt p+1, q+1), beide im Rahmen Breite = ratio, Hoehe = 1; Streckung = max(Breite/Hoehe, Hoehe/Breite).
function meshAspect(a, b, fmt, ratio, p, q) {
  const h = H(a, b), img = (P, Q) => { const r = h(P, Q); return [(fmt === 'halb' ? r.x : (r.x + 1) / 2) * ratio, r.y]; };
  const e = 1e-4, d1 = (P, Q) => img(P, Q), A = d1(p - e, q + e), B = d1(p + e, q - e), C = d1(p - e, q - e), D = d1(p + e, q + e);
  const w = Math.abs(B[0] - A[0]) / (2 * e), hh = Math.abs(D[1] - C[1]) / (2 * e); return w / hh;   // Breite : Hoehe der Bildmasche (Einheitsmasche)
}
function stretch(a, b, fmt, ratio) {
  const hs = regionHalfplanes(a, b, fmt); let mx = 1, cnt = 0; const cells = [];
  for (let i = 0; i < b; i++) for (let j = 0; j < b; j++) { const poly = clipAll([[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], hs), ar = area(poly); if (ar < 0.25) continue; // Masche zu mindestens einem Viertel im Ausschnitt
    const cx = poly.reduce((s, P) => s + P[0], 0) / poly.length, cy = poly.reduce((s, P) => s + P[1], 0) / poly.length, asp = meshAspect(a, b, fmt, ratio, cx, cy), s = Math.max(asp, 1 / asp);
    mx = Math.max(mx, s); cnt++; cells.push({ i, j, cx, cy, asp, s }); }
  return { mx, cnt, cells };
}
tbl(['a,b', 'Format', 'W', 'im Optimum 7 bis 12', 'Streckung max bei 1:1', 'bei 1:2 (hoch)', 'bei 2:1 (breit)', 'bestes Rahmenverhaeltnis B:H (min. max. Streckung)', 'dort max. Streckung']);
const best = (a, b, fmt) => { let bs = 1e9, br = 1; for (let r = 0.1; r <= 10; r *= 1.02) { const s = stretch(a, b, fmt, r).mx; if (s < bs) { bs = s; br = r; } } return [br, bs]; };
const okList = [];
for (const fmt of ['ganz', 'halb']) for (let b = 2; b <= 9; b++) for (let a = 1; a < b; a++) {
  const W = formula('□N', a, b, fmt); const inOpt = W >= 7 && W <= 12; if (!inOpt) continue;
  const s11 = stretch(a, b, fmt, 1).mx, s12 = stretch(a, b, fmt, 0.5).mx, s21 = stretch(a, b, fmt, 2).mx, [br, bs] = best(a, b, fmt);
  row([a + ',' + b, fmt, f2(W), 'ja', f2(s11), f2(s12), f2(s21), f2(br), f2(bs)]); okList.push({ a, b, fmt, W, s11, s12, s21, br, bs });
}
console.log('\nOptimum fuer △N (W = b^2 - a^2 bzw. /2, 8 bis 16) und *N (W = (b^2 - a^2)/6, 6 bis 10): (a,b,Format) im Bereich:\n');
tbl(['Familie', '(a,b,Format) mit W im Optimum']);
for (const fam of ['□N', '△N', '*N']) { const list = []; for (const fmt of ['ganz', 'halb']) for (let b = 2; b <= 12; b++) for (let a = 1; a < b; a++) { const W = formula(fam, a, b, fmt), [lo, hi] = OPT[fam]; if (W >= lo - 1e-9 && W <= hi + 1e-9) list.push(a + ',' + b + (fmt === 'halb' ? 'h' : '')); } row([fam, list.join('  ')]); }
console.log('\nBrauchbar = W im Optimum UND max. Streckung <= 2 (b <= 9), je Rahmenverhaeltnis Breite : Hoehe; Streckung aus den Quadratmaschen (fuer △N und *N als Naeherung uebernommen, ihre Maschen liegen in denselben Zellen):\n');
tbl(['Rahmen B:H', '□N', '△N', '*N']);
for (const ratio of [0.5, 2 / 3, 1, 1.5, 2]) {
  const cols = ['□N', '△N', '*N'].map(fam => { const L = []; for (const fmt of ['ganz', 'halb']) for (let b = 2; b <= 9; b++) for (let a = 1; a < b; a++) { const W = formula(fam, a, b, fmt), [lo, hi] = OPT[fam]; if (W < lo - 1e-9 || W > hi + 1e-9) continue; if (stretch(a, b, fmt, ratio).mx <= 2) L.push(a + ',' + b + (fmt === 'halb' ? 'h' : '')); } return L.join('  ') || '-'; });
  row([f2(ratio) + (ratio === 1 ? ' (1:1)' : ratio === 0.5 ? ' (1:2 hoch)' : ratio === 2 ? ' (2:1 breit)' : ''), ...cols]);
}
{ const r149 = 388 / 281, [br, bs] = best(2, 4, 'ganz'); console.log('\nVergleich mit der Quelle: Fig. 149 (a=2, b=4, ganz) hat Rahmen B:H = 388:281 = ' + f2(r149) + ' (gemessen, Bild gedreht gelesen); dort max. Streckung ' + f2(stretch(2, 4, 'ganz', r149).mx) + '; bestes Verhaeltnis nach Rechnung ' + f2(br) + ' mit ' + f2(bs) + '.'); }
console.log('\n(h = halbes Format; b hoechstens 12 gerechnet.) Streckung = max(Breite/Hoehe, Hoehe/Breite) der Bildbox einer ganzen Maschenzelle; Lesart: Auslegung der Quelle-Angabe S. 17 "hoechstens 1 x 2" fuer Maschen (nicht am Bild geprueft).');
console.log('\nEcken und Mitte (□N, ganz, Rahmen 1 : 1): Bildmasche Breite : Hoehe an den vier Rahmenecken und in der Mitte (lokal, Einheitsmasche):\n');
tbl(['a,b', 'links unten', 'rechts unten', 'links oben', 'rechts oben', 'Mitte (x = 0, y = 1/2)', 'Verhaeltnis groesste/kleinste']);
for (const [a, b] of [[2, 4], [3, 5], [2, 5], [3, 6], [1, 4], [4, 7]]) {
  const e = 1e-6, vm = 1 / (1 / a - 0.5 * (1 / a - 1 / b)), pts = [[e, a - e], [a - e, e], [e, b - e], [b - e, e], [vm / 2, vm / 2]], asp = pts.map(([p, q]) => meshAspect(a, b, 'ganz', 1, p, q));
  row([a + ',' + b, ...asp.map(f2), f2(Math.max(...asp) / Math.min(...asp))]);
}

// ---------- Messung 7 ----------
hdr('Messung 7: Sechseck *N (soweit der Prototyp es hergibt)');
console.log('Zaehlung der feinen Dreiecke des △N-Gitters im Ausschnitt, geteilt durch 6 (ein Sechseck = 6 Dreiecke), gegen W = (b^2 - a^2)/6 (ganz) bzw. /12 (halb):\n');
tbl(['a,b', 'Format', 'Dreiecke gezaehlt', 'Dreiecke/6', 'Formel W', 'Quelle']);
for (const [a, b, fmt, src] of [[3, 7, 'ganz', '6,7 (Fig. 165)'], [3, 9, 'halb', '6 (Fig. 166/167)']]) {
  const tri = countMeshes(FAM['△N'][0], a, b, fmt).W; row([a + ',' + b, fmt, f2(tri), f2(tri / 6), f2(formula('*N', a, b, fmt)), src]);
}
console.log('\nNicht geprueft: ob die Sechsecke (Auslassen von Linien nach S. 14/52) im Ausschnitt ganze Sechsecke ergeben, wie viele am Rand angeschnitten sind, und das Verhaeltnis zum feinen Rhombengitter der App (E_fein = 3 X Y): dafuer fehlt die Auslassregel im Prototyp.');
