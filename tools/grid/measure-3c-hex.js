// Task 125 (3C-4 Vorbereitung, Typ R): Moebiusnetz am Sechseck *N. Prototyp und Messungen. Importiert nichts aus core/.
//   node tools/grid/measure-3c-hex.js            -> Tabellen auf stdout (reports/125.md zitiert diese Ausgabe)
//   node tools/grid/measure-3c-hex.js svg DIR    -> schreibt Vergleichsbilder (SVG) nach DIR
// Modell: feines Dreiecksgitter (p,q) der App (Sechseck-Feld: f1 = (v1+v2)/3, f2 = (2 v2 - v1)/3, 60 Grad, Kantenlaenge = Sechseckseite s,
// Sechseckmitten = Untergitter vom Index 3). Homographie H wie 120/124. Auslassregel (Hinterreiter S. 14: "geeignetes Auslassen von Linien",
// "von jedem drei verschiedene Ableitungen"): Gitterpunkte einer Nebenklasse des Index-3-Untergitters werden samt ihren 6 Kanten weggelassen.
'use strict';
const S3 = Math.sqrt(3);
const H = (a, b, half) => (p, q) => { const v = p + q; return { x: half ? (p - q) / v : p / v * 2 - 1 + 0, y: (1 / a - 1 / v) / (1 / a - 1 / b), v }; };
// Bild: ganz: X in [-1,1] = (p-q)/v ; halb: X in [0,1] = (p-q)/v ; Y in [0,1], a unten (0), b oben (1)
const img = (a, b) => (p, q) => { const v = p + q; return { X: (p - q) / v, Y: (1 / a - 1 / v) / (1 / a - 1 / b), v }; };
// Variante A (Barenvariante, wie 124): Kanten p, q, p+q = const -> Kantenrichtungen (1,0), (0,1), (1,-1); Mitten (i - j) = c mod 3
// Variante B (Faecher aus T1): Kanten p, q, p-q = const -> Richtungen (1,0), (0,1), (1,1);   Mitten (i + j) = c mod 3
const DIRS = { A: [[1, 0], [0, 1], [1, -1]], B: [[1, 0], [0, 1], [1, 1]] };
const mod3 = n => ((n % 3) + 3) % 3;
const isCentre = (V, c, i, j) => V === 'A' ? mod3(i - j) === c : mod3(i + j) === c;
const inRegion = (a, b, half) => (p, q) => p >= -1e-9 && q >= -1e-9 && p + q >= a - 1e-9 && p + q <= b + 1e-9 && (!half || p >= q - 1e-9);
function planes(a, b, half) { const h = [[1, 0, 0], [0, 1, 0], [1, 1, -a], [-1, -1, b]]; if (half) h.push([1, -1, 0]); return h; }
function cut(pa, qa, pb, qb, hs) { // Cyrus-Beck
  let t0 = 0, t1 = 1;
  for (const [A, B, C] of hs) { const g0 = A * pa + B * qa + C, g1 = A * pb + B * qb + C;
    if (g0 < -1e-12 && g1 < -1e-12) return null;
    if (g0 < 0 || g1 < 0) { const t = g0 / (g0 - g1); if (g0 < 0) { if (t > t0) t0 = t; } else if (t < t1) t1 = t; } }
  return t0 < t1 - 1e-12 ? [t0, t1] : null; }
// alle Kanten des Netzes (Variante V, Nebenklasse c) im Ausschnitt, als Strecken in (p,q) mit Ziel Bildpunkten
function netEdges(V, c, a, b, half) {
  const hs = planes(a, b, half), out = [], R = b + 2;
  for (let i = -2; i <= R; i++) for (let j = -2; j <= R; j++) { if (isCentre(V, c, i, j)) continue;
    for (const [di, dj] of DIRS[V]) { const i2 = i + di, j2 = j + dj; if (isCentre(V, c, i2, j2)) continue;
      const k = cut(i, j, i2, j2, hs); if (k) out.push({ pa: i + k[0] * di, qa: j + k[0] * dj, pb: i + k[1] * di, qb: j + k[1] * dj, full: k[0] === 0 && k[1] === 1 }); } }
  return out; }
// Sechsecke: Mitte (i,j), Ecken = die 6 Nachbarn; Flaeche im Ausschnitt / Flaeche des ganzen Sechsecks (6 Dreiecke zu 1/2 Masche)
function clipPoly(poly, hs) { for (const [A, B, C] of hs) { const o = []; for (let i = 0; i < poly.length; i++) { const P = poly[i], Q = poly[(i + 1) % poly.length], dp = A * P[0] + B * P[1] + C, dq = A * Q[0] + B * Q[1] + C;
  if (dp >= 0) o.push(P); if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); o.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]); } } poly = o; if (!poly.length) return poly; } return poly; }
const area = poly => { let s = 0; for (let i = 0; i < poly.length; i++) { const P = poly[i], Q = poly[(i + 1) % poly.length]; s += P[0] * Q[1] - Q[0] * P[1]; } return Math.abs(s) / 2; };
function hexagons(V, c, a, b, half) {
  const hs = planes(a, b, half), list = [], R = b + 2;
  // Nachbarn in Kreisfolge je Variante
  const ring = V === 'A' ? [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] : [[1, 0], [1, 1], [0, 1], [-1, 0], [-1, -1], [0, -1]];
  for (let i = -2; i <= R; i++) for (let j = -2; j <= R; j++) { if (!isCentre(V, c, i, j)) continue;
    const poly = ring.map(([di, dj]) => [i + di, j + dj]), full = area(poly), part = area(clipPoly(poly, hs));
    if (part > 1e-9) list.push({ i, j, frac: part / full, poly }); }
  return list; }
const f2 = v => (Math.round(v * 100) / 100).toString().replace('.', ',');
const row = a => console.log('| ' + a.join(' | ') + ' |');
const tbl = cols => { row(cols); row(cols.map(() => '---')); };
const hdr = t => console.log('\n## ' + t + '\n');
module.exports = { img, netEdges, hexagons, planes, inRegion, isCentre, DIRS, clipPoly, area, cut, S3, f2 };

if (require.main === module) {
  const mode = process.argv[2];
  if (mode === 'svg') { // Vergleichsbilder in der Orientierung der Quelle (a links, b rechts, X senkrecht)
    const fs = require('fs'), dir = process.argv[3] || '.';
    const cases = [['165', 3, 7, false], ['166', 3, 9, true]];
    for (const [fig, a, b, half] of cases) for (const V of ['A', 'B']) for (const c of [0, 1, 2]) {
      const Wd = 330, Hd = half ? 215 : 430, g = img(a, b), pts = e => [g(e.pa, e.qa), g(e.pb, e.qb)];
      const X = half ? x => x : x => (x + 1) / 2;
      let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd + 20}" height="${Hd + 40}"><rect width="100%" height="100%" fill="#1d3f8f"/><text x="10" y="${Hd + 34}" fill="#fff" font-size="12">Fig ${fig} a=${a} b=${b} ${half ? 'halb' : 'ganz'} Var ${V} c=${c}</text><g transform="translate(10,10)" stroke="#fff" stroke-width="3" fill="none"><rect width="${Wd}" height="${Hd}"/>`;
      for (const e of netEdges(V, c, a, b, half)) { const [P, Q] = pts(e); s += `<line x1="${(P.Y * Wd).toFixed(1)}" y1="${(X(P.X) * Hd).toFixed(1)}" x2="${(Q.Y * Wd).toFixed(1)}" y2="${(X(Q.X) * Hd).toFixed(1)}"/>`; }
      fs.writeFileSync(`${dir}/hex-${fig}-${V}${c}.svg`, s + '</g></svg>'); }
    console.log('SVG geschrieben nach', dir);
  }
}

if (require.main === module && process.argv[2] !== 'svg') {
  const fmtName = h => h ? 'halb' : 'ganz';
  const Wf = (a, b, half) => (b * b - a * a) / 6 / (half ? 2 : 1);
  console.log('# Messung 125 (3C-4 Vorbereitung): Moebiusnetz am Sechseck *N, Variante A (Baren, wie 124), Nebenklasse c = 0, 1, 2\nErzeugt von `node tools/grid/measure-3c-hex.js`; Bildabgleich `node tools/grid/measure-3c-hex-bild.js`.');

  hdr('Messung 2: W (Flaeche im Ausschnitt / Sechseckflaeche) gegen Quelle und Formel; Sechsecke ganz / angeschnitten je c');
  tbl(['Fig.', 'a,b', 'Format', 'Quelle W', 'Formel (b^2-a^2)/6 bzw. /12', 'c', 'W gezaehlt (Summe der Anteile)', 'Sechsecke ganz', 'angeschnitten (Anteil < 1)', 'davon Anteil 0,5', 'Befund']);
  for (const [fig, a, b, half, src] of [['165', 3, 7, false, 6.7], ['166', 3, 9, true, 6], ['-', 3, 9, false, '-'], ['-', 4, 8, false, '-'], ['-', 3, 8, true, '-'], ['-', 2, 7, false, '-']])
    for (const c of [0, 1, 2]) { const hx = hexagons('A', c, a, b, half), W = hx.reduce((s, h) => s + h.frac, 0), full = hx.filter(h => h.frac > 1 - 1e-9).length, cutn = hx.length - full, halfN = hx.filter(h => Math.abs(h.frac - 0.5) < 1e-6).length;
      row([fig, `${a},${b}`, fmtName(half), src, f2(Wf(a, b, half)), c, f2(W), full, cutn, halfN, Math.abs(W - Wf(a, b, half)) < 1e-9 ? 'W = Formel' : 'ABWEICHUNG']); }

  hdr('Messung 4: Geradheit (Prototyp H, Canvas 600 x 900, Ausschnitt 2,6 ganz)');
  const dl = (P, A, B) => { const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy); return L < 1e-9 ? Math.hypot(P[0] - A[0], P[1] - A[1]) : Math.abs((P[0] - A[0]) * dy - (P[1] - A[1]) * dx) / L; };   // Abstand des Bildpunktes von der Geraden durch die Bilder der Endpunkte (die Teilung der Strecke aendert sich projektiv, die Gerade nicht)
  const worst = { chord: 0, edge: 0, poly: 0 }; let n1 = 0;
  const rnd = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  { const a = 2, b = 6, g = img(a, b), W = 600, Hh = 900, px = (p, q) => { const o = g(p, q); return [W * (o.X + 1) / 2, Hh * (1 - o.Y)]; }, hs = planes(a, b, false);
    for (let k = 0; k < 20000; k++) { const pa = rnd() * b, qa = rnd() * b, pb = rnd() * b, qb = rnd() * b, c = cut(pa, qa, pb, qb, hs); if (!c) continue; n1++;
      const A = px(pa + c[0] * (pb - pa), qa + c[0] * (qb - qa)), B = px(pa + c[1] * (pb - pa), qa + c[1] * (qb - qa));
      for (const t of [0.13, 0.31, 0.5, 0.77, 0.9]) { const u = c[0] + t * (c[1] - c[0]), P = px(pa + u * (pb - pa), qa + u * (qb - qa)); worst.chord = Math.max(worst.chord, dl(P, A, B)); } }
    // Netzkanten (Variante A, alle c) und Sechseckkanten je Kachel
    for (const c of [0, 1, 2]) for (const e of netEdges('A', c, a, b, false)) for (const t of [0.25, 0.5, 0.75]) { const A = px(e.pa, e.qa), B = px(e.pb, e.qb), P = px(e.pa + t * (e.pb - e.pa), e.qa + t * (e.qb - e.qa)); worst.edge = Math.max(worst.edge, dl(P, A, B)); }
    for (const c of [0, 1, 2]) for (const h of hexagons('A', c, a, b, false)) { const poly = h.poly; if (poly.some(P => P[0] + P[1] <= 0.5)) continue; for (let i = 0; i < 6; i++) { const P = poly[i], Q = poly[(i + 1) % 6], A = px(...P), B = px(...Q), M = px((P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2); worst.poly = Math.max(worst.poly, dl(M, A, B)); } } }
  tbl(['Pruefung', 'Zahl', 'groesste Abweichung (px)']);
  row(['Streckenpunkt gegen die Gerade durch die Bilder der Endpunkte (zufaellige Strecken, 5 Punkte, im Ausschnitt 2,6 ganz)', n1, worst.chord.toExponential(1)]);
  row(['Netzkanten des Sechsecknetzes (alle c, Ausschnitt 2,6 ganz), 3 Punkte je Kante', '-', worst.edge.toExponential(1)]);
  row(['Sechseckkanten je Kachel (Kantenmitte gegen die Gerade durch die Bilder der Ecken), alle c', '-', worst.poly.toExponential(1)]);

  // Streckung (Auslegung): Bild des ganzen Sechsecks, Breite/Hoehe der Bildbox gegen das regelmaessige Sechseck (Kanten p+q = const waagrecht: Breite 2, Hoehe sqrt 3)
  function stretch(a, b, half, c, Wpx, Hpx) {
    const g = img(a, b), px = (p, q) => { const o = g(p, q); return [Wpx * (half ? o.X : (o.X + 1) / 2), Hpx * (1 - o.Y)]; }; let st = 1, n = 0, fine = 1;
    for (const h of hexagons('A', c, a, b, half)) { if (h.frac < 0.25) continue; if (h.poly.some(P => P[0] + P[1] < 0.2)) continue;
      const pts = h.poly.map(P => px(...P)), xs = pts.map(P => P[0]), ys = pts.map(P => P[1]), w = Math.max(...xs) - Math.min(...xs), hh = Math.max(...ys) - Math.min(...ys), asp = w / hh / (2 / S3); st = Math.max(st, asp, 1 / asp); n++; }
    // feines Dreieck (wie 124): Raute am Schwerpunkt der Dreiecke im Ausschnitt; hier ueber alle Maschen mit Flaeche >= 1/4 im Ausschnitt
    const e = 1e-4, hs = planes(a, b, half);
    for (let i = 0; i < b; i++) for (let j = 0; j < b; j++) for (const up of [0, 1]) { const poly = up ? [[i + 1, j], [i, j + 1], [i + 1, j + 1]] : [[i, j], [i + 1, j], [i, j + 1]]; const cl = clipPoly(poly, hs); if (area(cl) < 0.125) continue;
      const cx = cl.reduce((s, q) => s + q[0], 0) / cl.length, cy = cl.reduce((s, q) => s + q[1], 0) / cl.length, A = px(cx - e, cy + e), B = px(cx + e, cy - e), C = px(cx - e, cy - e), D = px(cx + e, cy + e), asp = Math.abs(B[0] - A[0]) / Math.abs(D[1] - C[1]) * S3; fine = Math.max(fine, asp, 1 / asp); }
    return { st, fine, n };
  }
  hdr('Messung 3: Streckung und brauchbare (a,b) je Canvas-Verhaeltnis (W 6 bis 10, Streckung <= 2, b <= 9, a >= 2)');
  console.log('Streckung (Auslegung, nicht an der Quelle bewiesen): Breite/Hoehe der Bildbox des ganzen Sechsecks gegen 2 : sqrt3 (Kanten p+q = const waagrecht), Maximum ueber Sechsecke mit mindestens 1/4 Flaeche im Ausschnitt; "fein" = Mass von 124 an den feinen Dreiecken (Sechseck = 6 davon), zum Vergleich.\n');
  const ratios = [['1:2', 0.5], ['3:4', 0.75], ['1:1', 1], ['3:2', 1.5], ['2:1', 2]];
  for (const half of [false, true]) { console.log(`Format ${fmtName(half)}:\n`); tbl(['Canvas B:H', 'c = 0 (Sechsecke Streckung; fein)', 'c = 1', 'c = 2']);
    for (const [nm, r] of ratios) { const cells = [0, 1, 2].map(c => { const l = []; for (let b = 3; b <= 9; b++) for (let a = 2; a < b; a++) { const W = Wf(a, b, half); if (W < 6 - 1e-9 || W > 10 + 1e-9) continue; const s = stretch(a, b, half, c, 600 * r, 600); if (s.st <= 2 && s.fine <= 2) l.push({ k: a + ',' + b, W, s: s.st, f: s.fine }); } l.sort((x, y) => x.s - y.s); return l.slice(0, 6).map(x => `${x.k} (W ${f2(x.W)}; ${f2(x.s)}; ${f2(x.f)})`).join(' ') || '-'; }); row([nm, ...cells]); }
    console.log(''); }
  // Gegenprobe Quelle: Fig. 165 (3,7 ganz) und 166 (3,9 halb) im gemessenen Rahmenverhaeltnis (gedreht gelesen: B = Rahmenhoehe, H = Rahmenbreite)
  { const g = [['165', 3, 7, false, (677.5 - 244) / (412.5 - 95), 1], ['166', 3, 9, true, (471.5 - 262) / (931 - 635), 0], ['167', 3, 9, true, (860 - 645) / (930.5 - 634), 0]];
    console.log('Gegenprobe Quelle (Rahmenverhaeltnis B:H gemessen, a-Seite links = unten gedreht):\n'); tbl(['Fig.', 'B:H', 'Streckung Sechseck (c der Figur)', 'fein']);
    for (const [fig, a, b, half, r, c] of g) { if (fig === '167') continue; const s = stretch(a, b, half, c, 600 * r, 600); row([fig, f2(r), f2(s.st), f2(s.fine)]); } }

  hdr('Messung 5: Fluchtlinie und Kachelzahl (Kachel = Sechseck, Schleife = Sechsecke mit Bildbox im Rechteck [0,b]^2 der Gitterkoordinaten)');
  tbl(['a,b', 'Format', 'c', 'Kacheln im Rechteck', 'davon mit Flaeche im Ausschnitt', 'Kacheln mit Ecke v <= 0 (singulaer) im Ausschnitt', 'kleinste Ecke v einer gezeichneten Kachel', 'groesste Bildkoordinate |Y|/H einer gezeichneten Kachel', 'Kachel der Spitze (Mitte)']);
  for (const [a, b] of [[1, 9], [2, 9], [3, 9], [2, 12], [3, 12]]) for (const half of [false, true]) for (const c of [0, 1, 2]) {
    const hs = planes(a, b, half), ring = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]; let inRect = 0, withArea = 0, sing = 0, vmin = Infinity, ymax = 0, tip = '-';
    for (let i = -3; i <= b + 3; i++) for (let j = -3; j <= b + 3; j++) { if (!isCentre('A', c, i, j)) continue; const poly = ring.map(([di, dj]) => [i + di, j + dj]);
      const bx0 = Math.min(...poly.map(P => P[0])), bx1 = Math.max(...poly.map(P => P[0])), by0 = Math.min(...poly.map(P => P[1])), by1 = Math.max(...poly.map(P => P[1]));
      if (bx1 > 0 && bx0 < b && by1 > 0 && by0 < b) inRect++;
      if (i + j === 0 && i === 0) tip = `(${i},${j})`;
      const ar = area(clipPoly(poly, hs)); if (ar < 1e-9) continue; withArea++;
      const vs = poly.map(P => P[0] + P[1]), vm = Math.min(...vs); if (vm <= 1e-9) { sing++; continue; }
      vmin = Math.min(vmin, vm); for (const P of poly) { const v = P[0] + P[1]; ymax = Math.max(ymax, Math.abs((a * (b - v)) / ((b - a) * v))); } }
    // Kachel, die die Spitze (0,0) als Ecke oder Mitte traegt
    const tips = []; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (isCentre('A', c, i, j) && ring.some(([di, dj]) => i + di === 0 && j + dj === 0) || (isCentre('A', c, i, j) && i === 0 && j === 0)) tips.push(`(${i},${j})`);
    row([`${a},${b}`, fmtName(half), c, inRect, withArea + sing, sing, f2(vmin), f2(ymax), tips.join(' ')]); }
  console.log('\nLesart: "Ecke v <= 0": die Kachel hat eine Ecke auf oder hinter der Fluchtlinie (v = p+q <= 0); wird sie gezeichnet, reicht eine ihrer Flaechenecken ins Unendliche. "kleinste Ecke v" gilt fuer die uebrigen. |Y|/H in Rahmenhoehen.');

  hdr('Messung 6: Mittelachse p = q gegen die Sechsecke (halbes Format) und Rand v = a / v = b (ganzes Format)');
  tbl(['c', 'Mittelachse (a,b = 3,9): angeschnittene Sechsecke (Anteil im halben Format)', 'Lage der Schnittgeraden zum Sechseck', 'Rand v=a/v=b ganz (3,9): angeschnittene Sechsecke']);
  const lage = { 0: 'durch die Mitte und die Mitten zweier Gegenkanten (Spiegelachse, zwei kongruente Haelften je 0,5)', 1: 'durch zwei Ecken im Abstand 2 (kurze Diagonale; Teile ungleich)', 2: 'durch zwei Ecken im Abstand 2 (kurze Diagonale, gespiegelt zu c = 1)' };
  for (const c of [0, 1, 2]) { const hh = hexagons('A', c, 3, 9, true), cuts = hh.filter(h => h.frac < 1 - 1e-9 && h.poly.every(P => P[0] + P[1] >= 3 - 1e-9 && P[0] + P[1] <= 9 + 1e-9)), fl = hexagons('A', c, 3, 9, false), cutF = fl.filter(h => h.frac < 1 - 1e-9);
    row([c, cuts.length ? cuts.map(h => f2(h.frac)).join(' ') : '-', lage[c], cutF.length + ' von ' + fl.length]); }
}

if (require.main === module && process.argv[2] !== 'svg') {
  hdr('Messung 5b: Durchlaeufe der Kachelschleife tileHex (latticeIJBounds, Rand 3; Rechteck [0,b]^2 der Gitterkoordinaten, Kachelindizes i = (p-q)/3, j = (p+2q)/3)');
  tbl(['b', 'c (Bearbeitungskachel-Mitte (p0,q0))', 'Durchlaeufe (i x j)', 'davon mit Flaeche im Ausschnitt (a=3, ganz)']);
  for (const b of [9, 12]) for (const c of [0, 1, 2]) { const o = [[0, 0], [1, 0], [0, 1]][c], corners = [[0, 0], [b, 0], [b, b], [0, b]].map(([p, q]) => [(p - o[0]) - (q - o[1]), (p - o[0]) + 2 * (q - o[1])].map(x => x / 3));
    const is = corners.map(k => k[0]), js = corners.map(k => k[1]), ni = Math.ceil(Math.max(...is)) + 3 - (Math.floor(Math.min(...is)) - 3) + 1, nj = Math.ceil(Math.max(...js)) + 3 - (Math.floor(Math.min(...js)) - 3) + 1;
    row([b, `${c} (${o[0]},${o[1]})`, `${ni} x ${nj} = ${ni * nj}`, hexagons('A', c, 3, b, false).length]); }
}

if (require.main === module && process.argv[2] !== 'svg') {
  hdr('Messung 5c: groesste gezeichnete Koordinate in px (Ecken der Sechseckkacheln mit Flaeche im Ausschnitt, ganz; Canvas = Rahmen; Grenze 8000 px, Task 121)');
  tbl(['Canvas B x H (px)', 'a,b mit der groessten Koordinate', 'c', 'groesste |Koordinate| (px)']);
  const ring = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  for (const [Wc, Hc] of [[600, 600], [1800, 600], [600, 1800]]) { let worstV = 0, at = '';
    for (let b = 3; b <= 12; b++) for (let a = 2; a < b; a++) for (const c of [0, 1, 2]) { const hs = planes(a, b, false);
      for (let i = -3; i <= b + 3; i++) for (let j = -3; j <= b + 3; j++) { if (!isCentre('A', c, i, j)) continue; const poly = ring.map(([di, dj]) => [i + di, j + dj]); if (area(clipPoly(poly, hs)) < 1e-9) continue;
        for (const [p, q] of poly) { const v = p + q; if (v <= 0) { worstV = Infinity; at = `${a},${b} c ${c}: Ecke v <= 0`; continue; } const x = Wc * p / v, y = Hc * a * (b - v) / ((b - a) * v), m = Math.max(Math.abs(x), Math.abs(y)); if (m > worstV) { worstV = m; at = `${a},${b}`; } } } }
    row([`${Wc} x ${Hc}`, at, 'alle', Math.round(worstV)]); }
}
