// Task 128 (Plan): Machbarkeit des halben Formats (Sechseck, Dreieck) und Zahlen. Liest core/ nur, aendert nichts: der Kern wird im Speicher so veraendert, dass "halb" gueltig ist
// (zwei Zeilen von netProjectiveEffective), und mit den Pruefungen des 127-Harness im Kleinen gefahren. node tools/grid/measure-3c-half.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..'), FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export', 'farborgel-bridge'];
const rd = f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8');
let src = FILES.map(rd).join('\n');
const cut = (s, from) => { if (!s.includes(from)) throw new Error('text not found: ' + from.slice(0, 50)); return s; };
cut(src, "else if (tri && spec.format !== 'full') reason ="); cut(src, "else if (hexa && spec.format !== 'full') reason");
const SRC_HALF = src.replace("else if (tri && spec.format !== 'full') reason =", "else if (false) reason =").replace("else if (hexa && spec.format !== 'full') reason", "else if (false) reason");
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function makeSb(code, cw, ch, shape) {
  const sb = { strokeWeight() { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max,
    dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console, line: (a, b, c, d) => sb.lines.push([a, b, c, d]), bezier() { }, point() { }, push() { }, pop() { }, noStroke() { }, stroke() { }, noFill() { }, CLOSE: 'close',
    fill: c => { sb._fill = c; }, beginShape: () => { sb._cur = []; }, vertex: (x, y) => { sb._cur.push({ x, y }); }, endShape: () => { sb.polys.push({ pts: sb._cur }); sb._cur = null; }, document: { body: {} }, getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }),
    showNodes: true, width: cw, height: ch, canvasW: cw, canvasH: ch, showFaces: false, segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, activeNetWarp: null, lineColor: '#000000', altNetSeed: null,
    currentShape: shape, shapeSizeFactor: 3, nodeCount: 4, symmetryMode: 'none', timeline: null, activeLayer: 'base', connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, lines: [], polys: [] };
  sb.toTileLocal = (n, tc, f, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (f) { x = -x; y = -y; } return { x: tc.x + x, y: tc.y + y }; };
  vm.createContext(sb); vm.runInContext(code, sb);
  const g = shape === 'hex' ? sb.buildHexGrid(4, 3, cw, ch) : sb.buildTriangleGrid(4, 3, cw, ch); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
  const ns = sb.nodes; let d = Infinity; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) d = Math.min(d, Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y));
  const out = []; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) if (Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y) < d * 1.05) out.push([ns[i].id, ns[j].id]); sb.connections = out;
  return sb;
}
const row = a => console.log('| ' + a.join(' | ') + ' |'), f2 = v => (Math.round(v * 100) / 100).toString().replace('.', ',');
console.log('# Messung 128: halbes Format am Sechseck und am Dreieck (Kern im Speicher freigegeben)\n');
console.log('## 1. Feasibility: der Canvas-Schnitt an der Mittelachse (p < q liegt bei X < 0)\n');
row(['Form', 'a,b,cls', 'Canvas', 'Linien (alle endlich, im Canvas, = Bild des exakten Schnitts)', 'Flaechen (endlich, Kanten exakte Sehnen, groesste Koordinate px)', 'W gezaehlt', 'W Formel', 'Treffertest (n, schlecht, groesste Abw. px)', 'Bearbeitungskachel im Gebiet']); row(['---', '---', '---', '---', '---', '---', '---', '---', '---']);
for (const [shape, fam, cases] of [['hex', '*N', [[3, 9, 600, 900, 0], [3, 9, 600, 900, 1], [3, 9, 600, 900, 2], [4, 8, 600, 600, 0], [2, 7, 900, 600, 1]]], ['triangle', '△N', [[3, 6, 600, 900, 0], [2, 6, 600, 900, 0], [2, 4, 600, 600, 0], [1, 3, 600, 600, 0]]]]) for (const [a, b, cw, ch, cls] of cases) {
  const sb = makeSb(SRC_HALF, cw, ch, shape), spec = sb.netProjectiveSpec(a, b, 'half', fam, cls); sb.baseNetTransform = spec;
  const w = sb.netWarpForBase(spec, shape, sb.outerCorners, 4, 3); if (!w) { row([shape, `${a},${b},${cls}`, `${cw}x${ch}`, 'KEIN WARP: ' + sb.netProjectiveEffective(spec, shape).reason, '', '', '', '', '']); continue; }
  const calls = [], orig = sb.drawCurvedBezier; sb.drawCurvedBezier = function (p1, p2, ct, i1, i2) { const i0 = sb.lines.length; orig.call(this, p1, p2, ct, i1, i2); calls.push({ p1, p2, from: i0, to: sb.lines.length }); }; sb.lines = []; sb.drawTessellation(); sb.drawCurvedBezier = orig;
  let bad = 0; for (const l of sb.lines) if (!l.every(Number.isFinite) || l[0] < -1e-6 || l[0] > cw + 1e-6 || l[2] < -1e-6 || l[2] > cw + 1e-6 || l[1] < -1e-6 || l[1] > ch + 1e-6 || l[3] < -1e-6 || l[3] > ch + 1e-6) bad++;
  for (const c of calls) { const ct = sb.netWarpSplitSegment(w, c.p1, c.p2), want = ct.length < 2 ? 0 : 1; if (c.to - c.from !== want) bad++; else if (want) { const A = sb.applyNetWarp(w, ct[0]), B = sb.applyNetWarp(w, ct[1]), l = sb.lines[c.from]; if (Math.hypot(l[0] - A.x, l[1] - A.y) > 1e-9 || Math.hypot(l[2] - B.x, l[3] - B.y) > 1e-9) bad++; } }
  sb.showFaces = true; sb.polys = []; sb.drawTessellation(); let nf = 0, big = 0, bent = 0; for (const p of sb.polys) { if (p.pts.length < 3) continue; nf++; for (const v of p.pts) { if (!Number.isFinite(v.x)) nf = -1e9; big = Math.max(big, Math.abs(v.x), Math.abs(v.y)); }
    for (let i = 0; i < p.pts.length; i++) { const A = p.pts[i], B = p.pts[(i + 1) % p.pts.length], pa = sb.invertNetWarp(w, A), pb = sb.invertNetWarp(w, B), pm = sb.invertNetWarp(w, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }), L = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1; if (Math.abs((pm.x - pa.x) * (pb.y - pa.y) - (pm.y - pa.y) * (pb.x - pa.x)) / L > 1e-6 * Math.max(1, L)) bent++; } }
  const info = sb.netProjectiveInfo(spec, cw, ch), Wf = shape === 'hex' ? (b * b - a * a) / 12 : (b * b - a * a) / 2 / 2 * 2 / 2 * 2;   // placeholder, replaced below
  const Wform = shape === 'hex' ? (b * b - a * a) / 12 : (b * b - a * a) / 2;   // triangle half: 120 Messung 2: 3,6 half = 13,5 = (b^2 - a^2)/2
  let hn = 0, hb = 0, hw = 0; const F = w.frame;
  for (let k = 0; k < 600; k++) { const img = sb.applyNetWarp(w, { x: sb.centroid.x + (rnd() - 0.5) * 500, y: sb.centroid.y + (rnd() - 0.5) * 500 }); if (!sb.netWarpInsideNet(w, img)) continue; const lc = sb.netWarpFieldLocal(w, img); hn++; if (!lc) { hb++; continue; }
    let tx = lc.x, ty = lc.y; if (shape === 'hex') { const v1h = { x: 2 * F.v1.x - F.v2.x, y: 2 * F.v1.y - F.v2.y }, v2h = { x: F.v1.x + F.v2.x, y: F.v1.y + F.v2.y }; tx += lc.tile.i * v1h.x + lc.tile.j * v2h.x; ty += lc.tile.i * v1h.y + lc.tile.j * v2h.y; } else { tx += lc.tile.i * F.v1.x + lc.tile.j * F.v2.x; ty += lc.tile.i * F.v1.y + lc.tile.j * F.v2.y; }
    const im2 = sb.applyNetWarp(w, { x: tx, y: ty }), e = Math.hypot(im2.x - img.x, im2.y - img.y); hw = Math.max(hw, e); if (e > 1e-6) hb++; }
  const P = w.projective, ed = [P.i0, P.j0]; const edOk = shape === 'hex' ? sb.netWarpInsideNet(w, sb.applyNetWarp(w, sb.centroid)) : sb.netWarpInsideNet(w, sb.applyNetWarp(w, sb.centroid));
  row([shape, `${a},${b},${cls}`, `${cw}x${ch}`, bad === 0 ? `ok (${sb.lines.length})` : `${bad} SCHLECHT`, nf > 0 && bent === 0 ? `ok (${nf}; ${Math.round(big)} px)` : `bent ${bent} nf ${nf}`, f2(info.W), f2(Wform), `${hn}, ${hb}, ${hw.toExponential(1)}`, edOk ? `ja (${ed})` : `NEIN (${ed})`]);
}

// ---- 2. Streckung der Quellfiguren und Vorschlaege fuer "halb" ----
const info = (shape, a, b, cls, W, H) => { const sb = SB[shape]; return sb.netProjectiveInfo(sb.netProjectiveSpec(a, b, 'half', shape === 'hex' ? '*N' : '△N', cls), W, H); };
const SB = { hex: makeSb(SRC_HALF, 600, 600, 'hex'), triangle: makeSb(SRC_HALF, 600, 600, 'triangle') };
console.log('\n## 2. Streckung der Quellfiguren (gleiches Mass wie die UI, Rahmenverhaeltnis B:H der Figur gemessen: B = Rahmenhoehe, H = Rahmenbreite)\n');
row(['Fig.', 'Form a,b halb', 'B:H', 'Streckung (UI-Mass = Maximum aus Sechseck-/Dreieckmass und feinem Mass)', 'W']); row(['---', '---', '---', '---', '---']);
for (const [fig, shape, a, b, r] of [['166', 'hex', 3, 9, (471.5 - 262) / (931 - 635)], ['161/162', 'triangle', 3, 6, 210 / 297], ['(Vergleich ganz 165)', 'hex-ganz', 3, 7, 1.37]]) { if (shape === 'hex-ganz') continue; const i = info(shape, a, b, 0, 600 * r, 600); row([fig, `${shape} ${a},${b}`, f2(r), f2(i.stretch) + (i.stretchHex ? ` (Sechseck ${f2(i.stretchHex)}, fein ${f2(i.stretchFine)})` : ''), f2(i.W)]); }
// beste Rahmenverhaeltnisse der Quellfiguren
for (const [shape, a, b] of [['hex', 3, 9], ['triangle', 3, 6]]) { let best = null; for (let r = 0.3; r < 3; r += 0.01) { const i = info(shape, a, b, 0, 600 * r, 600); if (!best || i.stretch < best.s) best = { r: +r.toFixed(2), s: i.stretch }; } console.log(`\nbestes Verhaeltnis B:H fuer ${shape} ${a},${b} halb: ${best.r} (Streckung ${f2(best.s)})`); }
// Canvas-Groessen je Verhaeltnis (core/forms.js gridWidth/gridHeight) und Vorschlaege
const dims = shape => { const sb = SB[shape], out = {}; for (const [nm, X, Y] of [['1:2', 1, 2], ['3:4', 3, 4], ['1:1', 1, 1], ['3:2', 3, 2], ['2:1', 2, 1]]) out[nm] = [sb.gridWidth(shape, X, Y), sb.gridHeight(shape, X, Y)]; return out; };
console.log('\n## 3. Canvas je "Verhaeltnis" (X:Y des Rasters, gridWidth/gridHeight) und Vorschlaege fuer halb (W im Optimum der Form: Sechseck 6 bis 10, Dreieck 8 bis 16; b <= 9; Sechseck a >= 2, Dreieck a >= 1)\n');
for (const shape of ['hex', 'triangle']) { const D = dims(shape), lim = shape === 'hex' ? { lo: 6, hi: 10, aMin: 2 } : { lo: 8, hi: 16, aMin: 1 };
  console.log(`\n### ${shape}: Canvas ` + Object.entries(D).map(([k, v]) => `${k} = ${Math.round(v[0])} x ${Math.round(v[1])} (B:H ${f2(v[0] / v[1])})`).join('; ') + '\n');
  row(['Verhaeltnis', 'cls', 'Streckung <= 2', 'Streckung <= 2,5', 'Streckung <= 3']); row(['---', '---', '---', '---', '---']);
  for (const [nm, v] of Object.entries(D)) for (const cls of (shape === 'hex' ? [0, 1, 2] : [0])) { const cells = [2, 2.5, 3].map(T => { const l = []; for (let b = lim.aMin + 1; b <= 9; b++) for (let a = lim.aMin; a < b; a++) { const i = info(shape, a, b, cls, v[0], v[1]); if (i.valid && i.W >= lim.lo - 1e-9 && i.W <= lim.hi + 1e-9 && i.stretch <= T + 1e-9) l.push({ k: a + ',' + b, W: i.W, s: i.stretch }); } l.sort((x, y) => x.s - y.s); return l.slice(0, 5).map(x => `${x.k} (W ${f2(x.W)}; ${f2(x.s)})`).join(' ') || '-'; }); row([nm, cls, ...cells]); } }
// 5b: Sechseck ganz bei "3:2": was liefert netProjectiveInfo am tatsaechlichen Canvas?
{ const sb = SB.hex, D = dims('hex')['3:2']; console.log(`\n## 4. Sechseck ganz bei 3:2 (Raster 3 x 2): Canvas ${Math.round(D[0])} x ${Math.round(D[1])} (B:H ${f2(D[0] / D[1])}); Vergleich Bericht 127 (B:H 1,5)\n`); row(['a,b', 'W', 'Streckung bei Canvas', 'Streckung bei B:H 1,5']); row(['---', '---', '---', '---']);
  for (const [a, b] of [[3, 7], [3, 8], [4, 8], [5, 9], [2, 7]]) { const s = sb.netProjectiveSpec(a, b, 'full', '*N', 0), i1 = sb.netProjectiveInfo(s, D[0], D[1]), i2 = sb.netProjectiveInfo(s, 900, 600); row([`${a},${b}`, f2(i1.W), f2(i1.stretch), f2(i2.stretch)]); } }

// ---- 5. Sechseck halb mit gesenktem W-Bereich (W ab 3, die Haelfte von 6; b <= 9 und b <= 12), cls 0 ----
{ console.log('\n## 5. Sechseck halb, cls 0, W 3 bis 10, Streckung <= 2,5 (b <= 9 | b <= 12)\n'); row(['Verhaeltnis', 'b <= 9', 'b <= 12']); row(['---', '---', '---']);
  for (const [nm, v] of Object.entries(dims('hex'))) row([nm, ...[9, 12].map(B => { const l = []; for (let b = 3; b <= B; b++) for (let a = 2; a < b; a++) { const i = info('hex', a, b, 0, v[0], v[1]); if (i.valid && i.W >= 3 - 1e-9 && i.W <= 10 + 1e-9 && i.stretch <= 2.5 + 1e-9) l.push({ k: a + ',' + b, W: i.W, s: i.stretch }); } l.sort((x, y) => x.s - y.s); return l.slice(0, 5).map(x => `${x.k} (W ${f2(x.W)}; ${f2(x.s)})`).join(' ') || '-'; })]); }
