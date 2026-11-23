/**
 * tools/netwarp/test-netwarp-family-snapshot.js
 * Task 127 (Zusatz aus 125): a stored 3C spec keeps the family it was written with after a shape change (netProjectiveForShape renames only when reading).
 * The Timeline / Start-End capture must take the family of the CURRENT shape, else a valid triangle pair is refused with "family differs".
 *   node tools/netwarp/test-netwarp-family-snapshot.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const SQ = '□N', TR = '△N';
function load(shape, net) {
    const ctx = { currentShape: shape }; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'core', 'netwarp.js'), 'utf8') + '\nvar baseNetTransform = null;', ctx);
    ctx.baseNetTransform = net; return ctx;
}
let fail = 0; const ok = (n, c, d) => { if (!c) fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  ' + (d || ''))); };
const mk = (fam, a, b) => ({ kind: 'projective', a, b, format: 'full', family: fam });
// the net was written on the square (family square-N), the user then switched to the triangle
const t = load('triangle', mk(SQ, 2, 4));
const s1 = t.netSpecSnapshot();
ok('snapshot on the triangle carries the triangle family', s1.family === TR, JSON.stringify(s1));
ok('snapshot is a copy (the author spec keeps its stored family)', t.baseNetTransform.family === SQ);
t.baseNetTransform = mk(TR, 3, 5); const s2 = t.netSpecSnapshot();
const c = t.netAnimationCompat(s1, s2);
ok('stale + fresh triangle pair is interpolable', c.ok === true, JSON.stringify(c));
ok('a real square net and a triangle net are still refused', load('square', mk(SQ, 2, 4)).netAnimationCompat(mk(SQ, 2, 4), mk(TR, 3, 5)).ok === false);
const sq = load('square', mk(TR, 2, 4)); ok('stale triangle family on the square becomes the square family', sq.netSpecSnapshot().family === SQ);
const hx = load('hex', mk(SQ, 2, 4)); const hs = hx.netSpecSnapshot(); ok('hex shape: the snapshot carries the hexagon family *N and cls 0 (task 127: the hexagon has its 3C)', hs.family === '*N' && hs.cls === 0, JSON.stringify(hs));
ok('regular net', load('triangle', null).netSpecSnapshot().regular === true);
ok('non-3C spec untouched', JSON.stringify(load('triangle', { x: { kind: 'uniform', w: 0 } }).netSpecSnapshot()) === JSON.stringify({ x: { kind: 'uniform', w: 0 } }));
const src = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8').replace(/\/\/.*$/gm, '');
ok('sketch.js captureNetAnimationEnd uses netSpecSnapshot()', /function captureNetAnimationEnd[\s\S]{0,700}netSpecSnapshot\(\)/.test(src));
console.log(fail ? `\n${fail} FAILED` : '\nall ok'); process.exit(fail ? 1 : 0);
