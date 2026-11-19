// Task 103: (a) the rest run 8/field/1001 of task 102 (which frame, how big, what the hole is: the cell faces or the net warp), (b) the image-centre dependence of the face count of the 102 cell.
//   node tools/morph/measure-rest-103.js rest      (c) node tools/morph/measure-rest-103.js centre
'use strict';
const A = require('./measure-face-artifacts.js');
const cmd = process.argv[2];
const GROW = 'if (typeof spatialMorphRenderGrow === "function") spatialMorphRenderGrow = (p) => p;';
if (cmd === 'rest') {
  const cfg = A.CONFIGS[8];
  for (const net of ['field', 'none']) {
    const acc = A.acceptedSeed(cfg, net, 1, 'morph'), w = A.build(cfg, net, acc.seed, 'morph', 'base'); w.set(GROW);
    const bad = [];
    for (let i = 0; i < A.NT; i++) { const a = A.analyseFrame(A.frameAt(w, i / 40), w.dims); if (a.gapPx2 > 1000) bad.push(`t#${i}:${Math.round(a.gapPx2)}`); }
    console.log(`cfg8 ${cfg.shape}/${cfg.sym}/order${cfg.order}/size${cfg.size} net=${net} seed ${acc.seed} (shape ${JSON.stringify(cfg)}): frames with gap > 1000 px2: ${bad.join(' ') || '-'}`);
  }
} else if (cmd === 'centre') {
  const lines = [[400, 399.08, 399.69, 200], [350, 400, 299.69, 300], [350, 250.31, 350.31, 400]].map((l) => [{ x: l[0], y: l[1] }, { x: l[2], y: l[3] }]);
  const w = A.build(A.CONFIGS[8], 'none', 26, 'morph', 'base');
  w.set('globalThis.__cap=[];{const f=findFaces;findFaces=function(s,n){__cap.push({s:s.map(x=>({x1:x.x1,y1:x.y1,x2:x.x2,y2:x.y2})),n:(n||[]).map(q=>Object.assign({},q))});return f.apply(this,arguments);}}');
  w.get(`(function(){const s=spatialMorphRenderSource({ids:['base']});spatialMorphRenderTileFaces(${JSON.stringify(lines)},s,null);return 1;})()`);
  const caps = JSON.parse(w.get('JSON.stringify(__cap)')), cap = caps[caps.length - 1], segs = cap.s, nodes0 = cap.n;
  const SHIFTS = [[0, 0], [0.37, -0.39], [12.5, -11.8], [-28.87, 5.77]];
  const vm = require('vm'), fs = require('fs'), path = require('path');
  const mk = (src, on) => { const sb = { console, Math }; vm.createContext(sb); vm.runInContext(src + `\nfaceRepairCollinear=${on};var __f=findFaces;`, sb); return sb.__f; };
  const NEW = fs.readFileSync(path.join(__dirname, '..', '..', 'core', 'faces.js'), 'utf8'), OLD = fs.readFileSync(path.join(__dirname, '..', '..', 'reports', 'logs', '103-basis-faces.js'), 'utf8');
  for (const [name, src] of [['main (rule absent)', OLD], ['task 103', NEW]]) {
    const out = SHIFTS.map(([dx, dy]) => { const r = mk(src, true)(segs.map((s) => ({ x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy })), nodes0.map((q) => Object.assign({}, q, { x: q.x + dx, y: q.y + dy }))); return `${r.faces.length} faces / ${Math.round(r.faces.reduce((p, f) => p + f.area, 0))} px2`; });
    console.log(name.padEnd(20), 'shifts', JSON.stringify(SHIFTS), '->', out.join(' | '));
  }
}
