// Test for core/pick-node.js (Phase 2 touch, B4a): the nearest-node hit test and the radius by pointer type. Not wired into the app.
//   node tools/ui/test-pick-node.js
//   PICK_NODE_JS=/path/to/mutated/pick-node.js node tools/ui/test-pick-node.js     (sabotage runs)
//
// The nodes come from the REAL grid builders (tools/session/scenarios.js worlds, size 5). "old" is the loop of pressAt() as it is today
// (the first node in array order with dist < 18). The table at the end uses the finger-to-node distances measured on a real iPhone with
// the detector variant (V3: median 5.9, p90 9.3, max 10.0 css px, canvas scale 0.5717) in 8 directions around every node.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const S = require('../session/scenarios.js');

const src = fs.readFileSync(process.env.PICK_NODE_JS || path.join(__dirname, '..', '..', 'core', 'pick-node.js'), 'utf8');
const sb = {}; vm.createContext(sb); vm.runInContext(src, sb);
const P = vm.runInContext('({ pickNodeAt, hitRadius, HIT_RADIUS_FINE, HIT_TOUCH_CSS_PX })', sb);

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });

const oldPick = (nodes, x, y) => { for (const nd of nodes) { if (Math.hypot(x - nd.x, y - nd.y) < 18) return nd; } return null; };   // sketch.js pressAt(), verbatim rule
const brute = (nodes, x, y, r) => { let best = null, bd = Infinity; nodes.forEach(n => { const d = Math.hypot(x - n.x, y - n.y); if (d < r && d < bd) { best = n; bd = d; } }); return best; };
const MAX = { triangle: 7, square: 13, hex: 7 };
const SCALE = 0.5717;
const grid = (shape, order) => S.world(shape, order, 5, 'none').get('nodes').filter(n => !n.free).map(n => ({ id: n.id, x: n.x, y: n.y }));
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

console.log('== 1. hitRadius ==');
{
    const r = P.hitRadius;
    check('fine pointer (mouse): 18 at every scale', r('mouse', 0.5717) === 18 && r('mouse', 0.9333) === 18 && r('mouse', 3) === 18 && r('mouse') === 18);
    check('anything that is not touch or pen is fine: pointer types "", undefined, null, "stylus"', r('', 0.5) === 18 && r(undefined, 0.5) === 18 && r(null, 0.5) === 18 && r('stylus', 0.5) === 18);
    check('touch at 375 px (scale 0.5717): 22 / 0.5717 = 38.48 units', Math.abs(r('touch', 0.5717) - 22 / 0.5717) < 1e-9 && r('touch', 0.5717) > 38.4 && r('touch', 0.5717) < 38.5);
    check('touch at 320 px (scale 0.48): 45.83; at 768+ (0.9333): 23.57', Math.abs(r('touch', 0.48) - 45.8333333) < 1e-5 && Math.abs(r('touch', 0.9333) - 23.5722) < 1e-3);
    check('pen is treated like touch', r('pen', 0.5717) === r('touch', 0.5717));
    check('never below the fine radius: scale 1.2 gives 18.33, scale 1.5 and 3 give 18', Math.abs(r('touch', 1.2) - 22 / 1.2) < 1e-9 && r('touch', 1.5) === 18 && r('touch', 3) === 18);
    check('a missing, zero, negative or non-finite scale gives the fine radius, never Infinity or NaN', r('touch') === 18 && r('touch', 0) === 18 && r('touch', -1) === 18 && r('touch', NaN) === 18 && r('touch', Infinity) === 18 && r('touch', '0.5') === 18);
}

console.log('\n== 2. pickNodeAt basics ==');
{
    const N = [{ id: 1, x: 0, y: 0 }, { id: 2, x: 10, y: 0 }, { id: 3, x: 100, y: 100 }];
    const id = (n) => (n ? n.id : null);
    const T = f => { try { return f(); } catch (e) { return 'THROWS ' + e.message; } };
    check('one node in range: that node', id(P.pickNodeAt(N, 98, 99, 18)) === 3);
    check('none in range: null', P.pickNodeAt(N, 50, 50, 18) === null);
    check('several in range: the NEAREST, not the first (a click 8 px right of node 1 is nearer to node 2)', id(P.pickNodeAt(N, 8, 0, 18)) === 2 && id(oldPick(N, 8, 0)) === 1);
    check('...and the nearest, whatever the array order', id(P.pickNodeAt(N.slice().reverse(), 8, 0, 18)) === 2);
    check('a tie goes to the LOWER index (the point exactly between nodes 1 and 2)', id(P.pickNodeAt(N, 5, 0, 18)) === 1 && id(P.pickNodeAt([N[1], N[0], N[2]], 5, 0, 18)) === 2);
    check('the radius is strict, like the old `< 18`: a node exactly 18 away is not picked, 17.999 is', P.pickNodeAt([{ id: 1, x: 18, y: 0 }], 0, 0, 18) === null && P.pickNodeAt([{ id: 1, x: 17.999, y: 0 }], 0, 0, 18) !== null);
    check('the returned object is the node itself (the caller reads .id and the rest)', P.pickNodeAt(N, 0, 0, 18) === N[0]);
    check('a larger radius reaches further (touch 38.5: a node 30 away)', P.pickNodeAt([{ id: 9, x: 30, y: 0 }], 0, 0, 18) === null && id(P.pickNodeAt([{ id: 9, x: 30, y: 0 }], 0, 0, 38.48)) === 9);
    check('the nearest wins inside a large radius too', id(P.pickNodeAt([{ id: 1, x: 30, y: 0 }, { id: 2, x: 20, y: 0 }], 0, 0, 38.48)) === 2);
    check('negative coordinates and a layer-style offset work (nothing assumes the canvas)', id(P.pickNodeAt([{ id: 4, x: -50, y: -50 }], -45, -52, 18)) === 4);
    check('empty, null, undefined, a non-array: null and no throw', T(() => P.pickNodeAt([], 0, 0, 18)) === null && T(() => P.pickNodeAt(null, 0, 0, 18)) === null && T(() => P.pickNodeAt(undefined, 0, 0, 18)) === null && T(() => P.pickNodeAt(5, 0, 0, 18)) === null);
    check('NaN / Infinity / missing coordinates: null', P.pickNodeAt(N, NaN, 0, 18) === null && P.pickNodeAt(N, 0, Infinity, 18) === null && P.pickNodeAt(N, undefined, 0, 18) === null && P.pickNodeAt(N, '0', 0, 18) === null);
    check('a radius that is 0, negative, NaN, Infinity or missing: null (never "everything in range")', P.pickNodeAt(N, 0, 0, 0) === null && P.pickNodeAt(N, 0, 0, -5) === null && P.pickNodeAt(N, 0, 0, NaN) === null && P.pickNodeAt(N, 0, 0, Infinity) === null && P.pickNodeAt(N, 0, 0) === null);
    check('nodes with a non-finite coordinate, null entries and holes are skipped, the rest still found', T(() => id(P.pickNodeAt([null, { id: 1, x: NaN, y: 0 }, { id: 2 }, , { id: 3, x: 1, y: 1 }], 0, 0, 18))) === 3);
    check('a node whose coordinates are strings is skipped (a string would be coerced by Math.hypot and picked)', P.pickNodeAt([{ id: 1, x: '1', y: '1' }], 0, 0, 18) === null && id(P.pickNodeAt([{ id: 1, x: '1', y: '1' }, { id: 2, x: 5, y: 5 }], 0, 0, 18)) === 2);
    check('the same input gives the same answer (no state)', id(P.pickNodeAt(N, 8, 0, 18)) === id(P.pickNodeAt(N, 8, 0, 18)));
}

console.log('\n== 3. against the old handler on the real grids ==');
{
    let pts = 0, one = 0, oneSame = 0, many = 0, manyNearest = 0, manyDiffer = 0, none = 0, noneSame = 0, bad = [];
    for (const shape of ['triangle', 'square', 'hex']) for (const order of [2, 3, 4, 5, 6, 7, 9, 13].filter(o => o <= MAX[shape])) {
        const nodes = grid(shape, order);
        for (let k = 0; k < 300; k++) {
            const x = -20 + rnd() * 640, y = -20 + rnd() * 640; pts++;
            const inRange = nodes.filter(n => Math.hypot(x - n.x, y - n.y) < 18);
            const a = oldPick(nodes, x, y), b = P.pickNodeAt(nodes, x, y, 18);
            if (inRange.length === 0) { none++; if (a === null && b === null) noneSame++; else bad.push(shape + order + ' none'); }
            else if (inRange.length === 1) { one++; if (a === b && a === inRange[0]) oneSame++; else bad.push(shape + order + ' one'); }
            else { many++; if (b === brute(nodes, x, y, 18)) manyNearest++; else bad.push(shape + order + ' many'); if (a !== b) manyDiffer++; }
        }
    }
    check(`${pts} random points on 3 shapes x several orders: nothing in range -> both null`, none > 100 && noneSame === none, `${noneSame}/${none}`);
    check('...exactly one node in range -> the new rule equals the old handler (the same node object)', one >= 50 && oneSame === one, `${oneSame}/${one}`);
    check('...several in range -> the new rule is the nearest of them (checked against a brute-force scan)', many > 100 && manyNearest === many, `${manyNearest}/${many}`);
    check('...and in those cases it is a REAL change: the old rule picks another node in a large share of them', manyDiffer > many * 0.3, `${manyDiffer}/${many}`);
    check('no unexplained mismatch', bad.length === 0, bad.slice(0, 3).join(', '));
}

console.log('\n== 4. the table: shape x order at size 5 (old handler against the new rules) ==\n  NOT A RESULT: an equal-error, 8-direction MODEL (one fixed finger error in every direction around every node). Do not use it to decide anything;\n  the decision rests on the paired replay on a real phone (iPhone V4: same finger positions, old and new rule).');
{
    const ERR = [['median 5.9 px', 5.9], ['p90 9.3 px', 9.3], ['max 10.0 px', 10.0]];   // iPhone V3, finger to node centre
    const dirs = Array.from({ length: 8 }, (_, i) => i * Math.PI / 4);
    let aggOld = 0, aggNew = 0, aggTot = 0, exactBadNew = 0, exactBadOld = 0, exactTot = 0, spacingFail = [];
    const rows = [];
    for (const shape of ['triangle', 'square', 'hex']) for (const order of [3, 4, 5, 6, 7, 9, 13].filter(o => o <= MAX[shape])) {
        const nodes = grid(shape, order);
        let sp = Infinity; for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) sp = Math.min(sp, Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y));
        const rt = P.hitRadius('touch', SCALE);
        const cells = ERR.map(([label, px]) => {
            const e = px / SCALE; let o = 0, nf = 0, nt = 0, tot = 0;
            for (const t of nodes) for (const a of dirs) {
                const x = t.x + e * Math.cos(a), y = t.y + e * Math.sin(a); tot++;
                if (oldPick(nodes, x, y) === t) o++; if (P.pickNodeAt(nodes, x, y, 18) === t) nf++; if (P.pickNodeAt(nodes, x, y, rt) === t) nt++;
                if (px === 5.9 || true) { /* aggregate below */ }
            }
            aggOld += o; aggNew += nt; aggTot += tot;
            // a finger error below half the node spacing is always resolved by the nearest rule
            if (e < sp / 2 - 1e-9 && nt !== tot) spacingFail.push(`${shape}${order}@${px}`);
            return { o: o / tot, nf: nf / tot, nt: nt / tot };
        });
        for (const t of nodes) { exactTot++; if (oldPick(nodes, t.x, t.y) !== t) exactBadOld++; if (P.pickNodeAt(nodes, t.x, t.y, rt) !== t || P.pickNodeAt(nodes, t.x, t.y, 18) !== t) exactBadNew++; }
        rows.push({ shape, order, n: nodes.length, sp, px: sp * SCALE, cells });
    }
    const f = v => (Math.round(v * 100) + '%').padStart(4);
    console.log('  shape    ord nodes  spacing(u/px)  | median 5.9 px: old fine38 | p90 9.3 px: old fine38 | max 10.0 px: old fine38   (old = first within 18; fine = nearest within 18; 38 = nearest within 38.5)');
    rows.forEach(r => console.log('  ' + r.shape.padEnd(8) + String(r.order).padStart(3) + String(r.n).padStart(6) + `   ${r.sp.toFixed(1).padStart(5)}/${r.px.toFixed(1).padStart(5)}   | ` + r.cells.map(c => `${f(c.o)} ${f(c.nf)} ${f(c.nt)}`).join('  | ')));
    check('a click exactly on a node: the new rule (fine 18 and touch 38.5) always picks it, on every grid; the old handler does not', exactBadNew === 0 && exactBadOld > 0, `new wrong ${exactBadNew}/${exactTot}, old wrong ${exactBadOld}/${exactTot}`);
    check('a finger error below half the node spacing is always resolved by the nearest rule (every cell where that applies)', spacingFail.length === 0, spacingFail.slice(0, 4).join(', '));
    // What the table says, stated honestly. The finger errors are placed in 8 directions at a FIXED size, which is the pessimistic case. The nearest rule is
    // exact below half the node spacing (checked above) and above that it can only be right by direction; the old rule is right "by array order": it takes the lower
    // index among the nodes in range, so it resolves a displacement towards HIGHER indices (right and down in this numbering) in favour of the target even where
    // the finger is nearer the neighbour - and it fails the other directions. Neither rule beats the other at errors above half the spacing; the paired comparison
    // on the same taps (probe V4) is what decides that for real fingers.
    const below = rows.reduce((n, r) => n + r.cells.filter((c, i) => (ERR[i][1] / SCALE) < r.sp / 2 - 1e-9).length, 0);
    const oldBelowFail = rows.reduce((n, r) => n + r.cells.filter((c, i) => (ERR[i][1] / SCALE) < r.sp / 2 - 1e-9 && c.o < 1).length, 0);
    check('in the cells where the finger error is below half the node spacing the nearest rule is 100%; the old rule is below 100% in some of those same cells (index-order luck, not geometry)', below > 0 && oldBelowFail > 0, `${below} cells, old < 100% in ${oldBelowFail}`);
    const w = [0.5, 0.4, 0.1];
    const wOld = rows.reduce((s2, r) => s2 + r.cells.reduce((t, c, i) => t + w[i] * c.o, 0), 0) / rows.length, wNew = rows.reduce((s2, r) => s2 + r.cells.reduce((t, c, i) => t + w[i] * c.nt, 0), 0) / rows.length;
    console.log(`  info (invented weights 50/40/10 %, mean over the ${rows.length} patterns): old ${(100 * wOld).toFixed(1)}%  nearest(touch) ${(100 * wNew).toFixed(1)}%  - the model above with made-up weights; not a result, not for decisions`);
    const sq5 = rows.find(r => r.shape === 'square' && r.order === 5), hex3 = rows.find(r => r.shape === 'hex' && r.order === 3), sq7 = rows.find(r => r.shape === 'square' && r.order === 7), hex4 = rows.find(r => r.shape === 'hex' && r.order === 4);
    check('at the measured MEDIAN error (5.9 px) square 5 and hex 3 are fully resolved by the nearest rule; square 7 and hex 4 are not', sq5.cells[0].nt === 1 && hex3.cells[0].nt === 1 && sq7.cells[0].nt < 1 && hex4.cells[0].nt < 1, `sq5 ${f(sq5.cells[0].nt)} hex3 ${f(hex3.cells[0].nt)} sq7 ${f(sq7.cells[0].nt)} hex4 ${f(hex4.cells[0].nt)}`);
    check('at the measured MAX error (10 px) even square 5 is not fully resolved by either rule in this 8-direction model (the V3 runs had no tap that far out)', sq5.cells[2].nt < 1 && sq5.cells[2].o < 1, `nearest ${f(sq5.cells[2].nt)} old ${f(sq5.cells[2].o)}`);
    check('at order 13 / hexagon 7 the dense grids stay ambiguous at a 10 px error even with the nearest rule (no zoom here, reported not hidden)', rows.find(r => r.shape === 'square' && r.order === 13).cells[2].nt < 0.5 && rows.find(r => r.shape === 'hex' && r.order === 7).cells[2].nt < 0.5);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
