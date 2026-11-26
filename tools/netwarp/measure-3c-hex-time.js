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

// Task 127: Zeit je drawTessellation (Median ueber 20), Sechseck-3C gegen das Sechseck-Feld, in Node (nicht Chrome: nur das Verhaeltnis zaehlt)
const FLD = { x: { kind: 'trig', w: 0.6 }, y: 'same', domain: 'field' };
function time(net, faces) { const sb = makeSb(join(NEW), 600, 600, 'hex'); sb.baseNetTransform = typeof net === 'function' ? net(sb) : net; sb.connections = edgeConnections(sb); sb.showFaces = faces; const ts = [];
  for (let k = 0; k < 22; k++) { sb.lines = []; sb.polys = []; const t0 = process.hrtime.bigint(); sb.drawTessellation(); ts.push(Number(process.hrtime.bigint() - t0) / 1e6); } ts.splice(0, 2); ts.sort((a, b) => a - b); return ts[ts.length >> 1]; }
console.log('| Netz | Flaechen | Median ms (20 Laeufe) |\n| --- | --- | --- |');
const rows = [['Sechseck-Feld', FLD], ['3C 3,7', sb => sb.netProjectiveSpec(3, 7, 'full', '*N', 0)], ['3C 5,9', sb => sb.netProjectiveSpec(5, 9, 'full', '*N', 0)], ['3C 2,12', sb => sb.netProjectiveSpec(2, 12, 'full', '*N', 0)]];
const out = {};
for (const faces of [false, true]) for (const [n, net] of rows) { const t = time(net, faces); out[n + faces] = t; console.log(`| ${n} | ${faces ? 'ja' : 'nein'} | ${t.toFixed(1)} |`); }
console.log('Verhaeltnis 3C 3,7 / Feld: ohne Flaechen ' + (out['3C 3,7false'] / out['Sechseck-Feldfalse']).toFixed(2) + ', mit ' + (out['3C 3,7true'] / out['Sechseck-Feldtrue']).toFixed(2) + '; 3C 5,9: ' + (out['3C 5,9false'] / out['Sechseck-Feldfalse']).toFixed(2) + ' / ' + (out['3C 5,9true'] / out['Sechseck-Feldtrue']).toFixed(2));
