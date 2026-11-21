// Task 119 (Typ U): numerische Gegenprobe zu den Aussagen von Q1 ueber 3C, 4E. Nur Rechnung, kein Import aus core/.
// node tools/grid/check-gerade-netze.js
'use strict';
const inter = (a, b) => { // lines as [p,q] points
  const [p, q] = a, [r, s] = b, d1 = [q[0]-p[0], q[1]-p[1]], d2 = [s[0]-r[0], s[1]-r[1]];
  const den = d1[0]*d2[1]-d1[1]*d2[0]; if (Math.abs(den) < 1e-12) return null;
  const t = ((r[0]-p[0])*d2[1]-(r[1]-p[1])*d2[0])/den; return [p[0]+t*d1[0], p[1]+t*d1[1]];
};
// ---- 3C: Homographie H: (u,v) -> (x,y); Netz = Bild des 45-Grad-gedrehten Quadratgitters p=(u+v)/..., q
const a = 2, b = 4;
const H = (u, v) => [u / v, (1/a - 1/v) / (1/a - 1/b)];
let maxCol = 0;
// Quadratgitter-Achsen p,q mit u=(p-q), v=(p+q): Geraden p=const bzw. q=const; Diagonalen: u=const, v=const
const lineImg = (f) => [H(...f(0.0)), H(...f(1.0))];
const pl = c => lineImg(t => { const q = a/2 + t*(b-a)/2 * 3 + 0.5; return [c - q, c + q]; }); // p = c
// Kollinearitaet dreier Bildpunkte einer Geraden p=c
let nlines = 0;
for (let c = 2; c <= 5; c++) { const pts = [0.3, 0.9, 1.7].map(q => H(c - q, c + q)); const [A, B, C] = pts; const cr = (B[0]-A[0])*(C[1]-A[1]) - (B[1]-A[1])*(C[0]-A[0]); maxCol = Math.max(maxCol, Math.abs(cr)); nlines++; }
for (let c = 0.5; c <= 2; c += 0.5) { const pts = [2.5, 3.1, 3.9].map(v => H(c, v)); const [A, B, C] = pts; maxCol = Math.max(maxCol, Math.abs((B[0]-A[0])*(C[1]-A[1]) - (B[1]-A[1])*(C[0]-A[0]))); }
console.log('3C: Geraden bleiben Geraden (max |Kreuzprodukt|):', maxCol.toExponential(2));
// Fluchtpunkt der u=const-Schar (Faecher aus x=0) und Horizont ueber der Oberkante, a=2,b=4
const hz = (1/a) / (1/a - 1/b);
console.log('3C: Horizont bei y =', hz, ' ueber Oberkante:', hz - 1, ' | Q1-Formel H/(b-a) =', 1/(b-a), ' | a/(b-a) =', a/(b-a));
// Bars: v=const -> y konstant (T2 im Unendlichen); F1,F2 = Fluchtpunkt der Richtungen (1,1),(−1,1) in (u,v): x=±1 auf dem Horizont
console.log('3C: Richtung (1,1): x =', 1, ' (x=u/v mit u=v)  Horizont y =', hz, '  -> F1,F2 bei x=+-1 (Rand +-1: Breite 2v im Wedge u in [-v,v])');
// Wedge-Breite: x in [-1,1] entspricht u in [-v,v] (90-Grad-Keil); Rechteck-Ausschnitt = Urbild eines 90-Grad-Keils, 45 Grad zu den Netzachsen
// ---- 4E: Tangentenscharen; Linie k: oben tan(k*pi/n), unten s*cot(k*pi/n) ; Spiegelschar x -> -x
function e4(n, s) {
  const L1 = [], L2 = [];
  for (let k = 1; k < n/2; k++) { const th = k*Math.PI/n; L1.push([[Math.tan(th), 1], [s/Math.tan(th), 0]]); L2.push([[-Math.tan(th), 1], [-s/Math.tan(th), 0]]); }
  return { L1, L2 };
}
for (const [n, s] of [[8, 1], [12, 1], [12, 0.7]]) {
  const { L1, L2 } = e4(n, s); const m = L1.length;
  // sind Knoten mit gleicher Indexsumme i+j auf gemeinsamer Waagerechten? und Differenz?
  const ys = {}; for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) { const P = inter(L1[i], L2[j]); if (!P) continue; (ys['s' + (i+j)] = ys['s' + (i+j)] || []).push(P[1]); (ys['d' + (i-j)] = ys['d' + (i-j)] || []).push(P[1]); }
  let sSpread = 0, dSpread = 0;
  for (const k in ys) { const v = ys[k]; const sp = Math.max(...v) - Math.min(...v); if (k[0] === 's') sSpread = Math.max(sSpread, sp); else dSpread = Math.max(dSpread, sp); }
  console.log(`4E n=${n} s=${s}: max y-Streuung bei i+j=const: ${sSpread.toFixed(4)}, bei i-j=const: ${dSpread.toExponential(2)}`);
  // Homographietest: gibt es H mit Knoten(i,j) -> (i-j, i+j)? kleinste Quadrate (DLT) Restfehler
  const pts = []; for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) { const P = inter(L1[i], L2[j]); if (P) pts.push({ P, g: [i - j, i + j] }); }
  console.log(`   Knoten ${pts.length}; Waagerechte-Eigenschaft (i-j=const -> gleiches y)  ${dSpread < 1e-9 ? 'JA' : 'nein'}`);
}

// ---- 4E/4C/4F, Lesart (UNGEPRUEFT gegen Fig. 213/253): ein Tangentenbuendel L(k), k = -n/2..n/2: oben (tan(k*pi/n), y=1), unten (s*cot(k*pi/n), y=0), s = d2/d1.
// Ergebnis der Probe: Schnitte L(i) mit L(-j) liegen ausserhalb des Rahmens (y<0 oder y>1); im Rahmen liegen nur Schnitte gleichsinniger Linien L(i), L(j), i<j: Knoten i+j=const kollinear UND Gruppengeraden gemeinsamer Punkt (Strahlenbuendel), KEINE senkrechten Baren. Die Quelle nennt fuer 4E eine Barenschar: diese Lesart reproduziert sie NICHT (Beschriftung der Scharen nicht aus Text rekonstruiert). Fragen: liegen Knoten mit i-j = const auf einer Waagerechten
// (Barenschar, x = tan((i-j)pi/n)) bzw. bei s != 1 auf einem Strahlenbuendel, und ist das Netz ein Homographiebild des Gitters (i,j)?
function lineFit(pts) { const A = pts[0], B = pts[pts.length - 1]; let m = 0; for (const P of pts) m = Math.max(m, Math.abs((B[0]-A[0])*(P[1]-A[1]) - (B[1]-A[1])*(P[0]-A[0])) / Math.hypot(B[0]-A[0], B[1]-A[1])); return m; }
for (const s of [1, 0.7, 1.6]) {
  const n = 16, L = k => { const th = k*Math.PI/n; return [[Math.tan(th), 1], [s/Math.tan(th), 0]]; };
  const groups = {};
  for (let i = 1; i < n/2; i++) for (let j = 1; j < n/2; j++) { const P = i < j ? inter(L(i), L(j)) : null; if (P && P[1] > 0 && P[1] < 1) (groups[i+j] = groups[i+j] || []).push(P); }
  let colin = 0, xs = 0; const gl = [];
  for (const c in groups) { const g = groups[c]; if (g.length >= 3) { colin = Math.max(colin, lineFit(g)); xs = Math.max(xs, Math.max(...g.map(p => p[0])) - Math.min(...g.map(p => p[0]))); gl.push([g[0], g[g.length-1]]); } }
  let spread = 0; if (gl.length >= 3) { const P0 = inter(gl[0], gl[1]); if (P0) for (let q = 2; q < gl.length; q++) { const P = inter(gl[0], gl[q]); if (P) spread = Math.max(spread, Math.hypot(P[0]-P0[0], P[1]-P0[1])); } }
  console.log(`Tangentenbuendel s=${s}: Knoten i+j=const kollinear (max Abstand ${colin.toExponential(1)}), x-Streuung je Gruppe ${xs.toExponential(1)} (0 = senkrechte Baren), ${gl.length} Gruppengeraden, Streuung ihres Schnittpunkts ${spread.toExponential(1)} (0 = Strahlenbuendel)`);
}
// ---- 3C: Maschenzahl im 90-Grad-Keil p,q >= 0, a <= p+q <= b: Flaeche = (b^2-a^2)/2 (k = 1)
for (const [A, B] of [[1, 4], [2, 4], [3, 6]]) console.log(`3C W(a=${A},b=${B}) = ${(B*B - A*A)/2}  (Quelle: ${[7.5, 6, 13.5][[[1,4],[2,4],[3,6]].findIndex(x => x[0]===A && x[1]===B)]} fuer □N bei W bzw. 6,75 bei W/2)`);
