// Task 120, Messung 1: Lage der Netzlinien in S. 49, Fig. 149 (□N, a=2, b=4, W=6, ganzes Format) gegen die beiden Lesarten des Horizonts.
// node tools/grid/measure-3c-bild.js   (liest docs/quellen/149.png, ungetrackt; ohne die Datei: Meldung, Exit 0)
// Verfahren: Hough-Transformation der weissen Linienpixel innerhalb des Rahmens, dann Schnittpunkte der Buendellinien; Verhaeltnisse, keine Pixel.
// Befund: Fig. 149 ist gegenueber Fig. 148 um 90 Grad gedreht gezeichnet (die a-Seite mit 2 Teilen links, die b-Seite mit 4 Teilen rechts).
'use strict';
const fs = require('fs'), path = require('path'), { readPng } = require('./png-read.js');
const file = path.join(__dirname, '..', '..', 'docs', 'quellen', '149.png');
if (!fs.existsSync(file)) { console.log('docs/quellen/149.png fehlt: Messung 1 nicht ausgefuehrt'); process.exit(0); }
const im = readPng(file), isW = (x, y) => { const [r, g] = im.at(x, y); return r > 170 && g > 170; };
const XL = 50, XR = 331, YT = 105.5, YB = 493.5;   // Rahmenmitte links/rechts (Lauf-Mitte bei y=300) und oben/unten (Zeilen 104..107 / 492..495); gemessen
const pts = []; for (let y = 112; y < 487; y++) for (let x = 56; x < 326; x++) if (isW(x, y)) pts.push([x, y]);
const NA = 720, MR = 700, acc = new Int32Array(NA * 2 * MR), cs = [], sn = [];
for (let i = 0; i < NA; i++) { const t = i * Math.PI / NA; cs.push(Math.cos(t)); sn.push(Math.sin(t)); }
for (const [x, y] of pts) for (let i = 0; i < NA; i++) acc[i * 2 * MR + Math.round(x * cs[i] + y * sn[i]) + MR]++;
const L = [];
for (let k = 0; k < 14; k++) {
  let best = 0, bi = 0, br = 0; for (let i = 0; i < NA; i++) for (let r = 0; r < 2 * MR; r++) { const v = acc[i * 2 * MR + r]; if (v > best) { best = v; bi = i; br = r; } }
  if (best < 60) break; L.push({ t: bi * Math.PI / NA, rho: br - MR, n: best });
  for (let di = -15; di <= 15; di++) for (let dr = -8; dr <= 8; dr++) { const i = (bi + di + NA) % NA, r = br + dr; if (r >= 0 && r < 2 * MR) acc[i * 2 * MR + r] = 0; }
}
// Bildkoordinaten: X = 2 (x - XL)/(XR - XL) - 1 (a-Seite links = -1, b-Seite rechts = +1), Y = (YB - y)/(YB - YT) (0..1)
const FW = XR - XL, FH = YB - YT, nrm = (x, y) => [2 * (x - XL) / FW - 1, (YB - y) / FH];
const yAtX = (l, x) => (l.rho - x * Math.cos(l.t)) / Math.sin(l.t);
console.log('Fig. 149 (a=2, b=4): ' + L.length + ' Linienkandidaten; Rahmen ' + FW + ' x ' + FH + ' px (x: a-Seite -1 links, b-Seite +1 rechts)');
for (const l of L.slice(0, 8)) { const yl = yAtX(l, XL), yr = yAtX(l, XR); console.log('  Stimmen ' + String(l.n).padStart(3) + '  links bei Y=' + nrm(XL, yl)[1].toFixed(3) + '  rechts bei Y=' + nrm(XR, yr)[1].toFixed(3)); }
const a = 2, b = 4;
const X = (l1, l2) => { const c1 = Math.cos(l1.t), s1 = Math.sin(l1.t), c2 = Math.cos(l2.t), s2 = Math.sin(l2.t), d = c1 * s2 - s1 * c2; return [(l1.rho * s2 - l2.rho * s1) / d, (c1 * l2.rho - c2 * l1.rho) / d]; };
const pairs = [[0, 2], [1, 3]]; const dists = [];
for (const [i, j] of pairs) if (L[i] && L[j]) { const P = X(L[i], L[j]); dists.push((P[0] - XR) / FW); console.log('  Schnitt Linie ' + i + ' / ' + j + ' (ein Buendel): ' + ((P[0] - XR) / FW).toFixed(2) + ' Rahmenbreiten jenseits der b-Seite'); }
const mean = dists.reduce((s, v) => s + v, 0) / dists.length;
console.log('Fluchtpunkt jenseits der b-Seite, gemessen (Mittel aus ' + dists.length + '): ' + mean.toFixed(2) + ' H;  Plan 119 a/(b-a) = ' + (a / (b - a)).toFixed(2) + ' H;  Q1 1/(b-a) = ' + (1 / (b - a)).toFixed(2) + ' H');
// Lage des Knotens v=3 auf der Achse a->b: Linien p=3 / q=3 beginnen am oberen/unteren Rahmenrand (p=0 bzw. q=0) bei v=3
const edges = []; for (const l of L.slice(0, 14)) { const c = Math.cos(l.t), s = Math.sin(l.t); const xt = (l.rho - YT * s) / c, xb = (l.rho - YB * s) / c; if (xt > XL + 5 && xt < XR - 5 && Math.abs(Math.atan2(c, s)) < 1.2) edges.push(+nrm(xt, YT)[0].toFixed(3)); if (xb > XL + 5 && xb < XR - 5) edges.push(+nrm(xb, YB)[0].toFixed(3)); }
console.log('Fusspunkte am oberen/unteren Rahmen (X-Achse a->b, -1..1): ' + [...new Set(edges)].join(' ') + '   Modell v=3: X = 2*y(3)-1 = ' + (2 * ((1 / a - 1 / 3) / (1 / a - 1 / b)) - 1).toFixed(3) + ' (Plan 119), linear ohne Perspektive 0.000');
