// Task 125, Messung 1: welche Auslassregel (Variante A/B, Nebenklasse c, Spiegelung) zeigen Fig. 165, 166, 167 (S. 52)?
// node tools/grid/measure-3c-hex-bild.js   (liest docs/quellen/152.png, ungetrackt; ohne die Datei: Meldung, Exit 0)
// Verfahren: Rahmen der Figur aus den Zeilen/Spalten mit langen weissen Laeufen; Netzlinien jedes Kandidaten (measure-3c-hex.js) in die Rahmenmitte
// gelegt; je Kandidat: Anteil der Linienproben (alle 2 px) mit weissem Pixel im Abstand <= 4 px (Vorwaerts) und mittlerer Abstand. Eine Zahl je Kandidat, kein Augenmass.
'use strict';
const fs = require('fs'), path = require('path'), { readPng } = require('./png-read.js');
const { img, netEdges } = require('./measure-3c-hex.js');
const file = path.join(__dirname, '..', '..', 'docs', 'quellen', '152.png');
if (!fs.existsSync(file)) { console.log('docs/quellen/152.png fehlt: Messung nicht ausgefuehrt'); process.exit(0); }
const im = readPng(file), W = im.w, Hh = im.h;
// Papier ist cremefarben (hell), die Linien sind hell auf dunkelblauem Grund: weisse Linienpixel nur INNERHALB des blauen Blocks einer Figur zaehlen
const FIG = [
  { fig: '165', a: 3, b: 7, half: false, win: [70, 450, 215, 700], fr: { left: 95, right: 412.5, top: 244, bottom: 677.5 } },
  { fig: '166', a: 3, b: 9, half: true, win: [610, 960, 225, 495], fr: { left: 635, right: 931, top: 262, bottom: 471.5 } },
  { fig: '167', a: 3, b: 9, half: true, win: [600, 960, 610, 890], fr: { left: 634, right: 930.5, top: 645, bottom: 860 } },
];
const white = new Uint8Array(W * Hh);
for (const F of FIG) { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; const [wx0, wx1, wy0, wy1] = F.win;
  for (let y = wy0; y <= wy1; y++) for (let x = wx0; x <= wx1; x++) { const [r, , b] = im.at(x, y); if (r < 90 && b > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  F.win = [x0, x1, y0, y1];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const [r, g, b] = im.at(x, y); if ((r + g + b) / 3 > 140) white[y * W + x] = 1; } }
// Abstand zum naechsten weissen Pixel (Chamfer, zwei Durchlaeufe)
const INF = 1e9, D = new Float32Array(W * Hh); for (let i = 0; i < D.length; i++) D[i] = white[i] ? 0 : INF;
for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { let d = D[y * W + x]; if (x) d = Math.min(d, D[y * W + x - 1] + 1); if (y) d = Math.min(d, D[(y - 1) * W + x] + 1); if (x && y) d = Math.min(d, D[(y - 1) * W + x - 1] + 1.414); if (y && x < W - 1) d = Math.min(d, D[(y - 1) * W + x + 1] + 1.414); D[y * W + x] = d; }
for (let y = Hh - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { let d = D[y * W + x]; if (x < W - 1) d = Math.min(d, D[y * W + x + 1] + 1); if (y < Hh - 1) d = Math.min(d, D[(y + 1) * W + x] + 1); if (x < W - 1 && y < Hh - 1) d = Math.min(d, D[(y + 1) * W + x + 1] + 1.414); if (y < Hh - 1 && x) d = Math.min(d, D[(y + 1) * W + x - 1] + 1.414); D[y * W + x] = d; }
// Rahmenmitten (fr) von Hand aus den Helligkeitssprüngen der Spalten/Zeilen gelesen (Schritt 1 der Messung; die Funktion frame() unten ist die automatische Variante, hier nicht benutzt, weil Beschriftung und Kratzer sie stoeren)
// Rahmen: Zeilen/Spalten mit langen weissen Laeufen (>= 70 %) im blauen Block; aeusserste Gruppen = Rahmenmitte
function frame(x0, x1, y0, y1) {
  const rows = [], cols = []; for (let y = y0; y <= y1; y++) { let n = 0; for (let x = x0; x <= x1; x++) n += white[y * W + x]; if (n > 0.7 * (x1 - x0)) rows.push(y); }
  for (let x = x0; x <= x1; x++) { let n = 0; for (let y = y0; y <= y1; y++) n += white[y * W + x]; if (n > 0.7 * (y1 - y0)) cols.push(x); }
  const grp = a => { const g = []; let c = [a[0]]; for (let i = 1; i < a.length; i++) { if (a[i] - a[i - 1] <= 2) c.push(a[i]); else { g.push(c); c = [a[i]]; } } g.push(c); return g.map(k => (k[0] + k[k.length - 1]) / 2); };
  const R = grp(rows), C = grp(cols); return { top: R[0], bottom: R[R.length - 1], left: C[0], right: C[C.length - 1] };
}
console.log('| Fig. | Rahmen x,y (px) | Variante | c | gespiegelt | Anteil der Linienproben auf weiss (<= 4 px) | mittlerer Abstand (px) |\n| --- | --- | --- | --- | --- | --- | --- |');
for (const F of FIG) {
  const f = F.fr, Wd = f.right - f.left, Hd = f.bottom - f.top, g = img(F.a, F.b), res = [];
  for (const V of ['A', 'B']) for (const c of [0, 1, 2]) for (const flip of [false, true]) {
    let n = 0, hit = 0, sum = 0;
    for (const e of netEdges(V, c, F.a, F.b, F.half)) {
      const P = g(e.pa, e.qa), Q = g(e.pb, e.qb), pt = t => { const X = P.X + t * (Q.X - P.X), Y = P.Y + t * (Q.Y - P.Y), u = F.half ? X : (X + 1) / 2; return [f.left + Y * Wd, f.top + (flip ? 1 - u : u) * Hd]; };
      const len = Math.hypot((Q.Y - P.Y) * Wd, ((Q.X - P.X) * (F.half ? 1 : 0.5)) * Hd), k = Math.max(2, Math.ceil(len / 2));
      for (let i = 0; i <= k; i++) { const [x, y] = pt(i / k), xi = Math.round(x), yi = Math.round(y); if (xi < f.left + 8 || xi > f.right - 8 || yi < f.top + 8 || yi > f.bottom - 8) continue; n++; const d = D[yi * W + xi]; sum += Math.min(d, 30); if (d <= 4) hit++; }
    }
    res.push({ V, c, flip, hit: hit / n, mean: sum / n });
  }
  res.sort((p, q) => q.hit - p.hit);
  for (const r of res.slice(0, 4)) console.log(`| ${F.fig} | ${f.left}..${f.right}, ${f.top}..${f.bottom} | ${r.V} | ${r.c} | ${r.flip ? 'ja' : 'nein'} | ${(100 * r.hit).toFixed(1)} % | ${r.mean.toFixed(1)} |`);
  console.log(`| ${F.fig} | (schlechtester der 12) | ${res[res.length - 1].V} | ${res[res.length - 1].c} | ${res[res.length - 1].flip ? 'ja' : 'nein'} | ${(100 * res[res.length - 1].hit).toFixed(1)} % | ${res[res.length - 1].mean.toFixed(1)} |`);
}
