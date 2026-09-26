/**
 * tools/netwarp/test-netwarp-nested.js
 * Roadmap 1.6 / Group E, phase 2 of the nested net: `macro` (Em) unequal macro cells, each subdivided
 * uniformly into micro = E/Em, as ONE piecewise-linear F on the unchanged flat node array.
 *
 *   node tools/netwarp/test-netwarp-nested.js
 *
 *  1. micro = 1 (no macro, or macro = E) is byte-identical to the previous commit's smooth warp - the
 *     laws, applyNetWarp() and the drawn lines of the real pipeline.
 *  2. The design session's worked example, reproduced against the shipped code: Sinus, strength 1, Node
 *     Count 7, Em = 3, micro = 2 -> macro gaps 169.27 / 261.47 / 169.27, fine gaps 84.63 / 84.63 / 130.73 /
 *     130.73 / 84.63 / 84.63 px (from the nodes, the drawn segments and the overlay lines).
 *  3. Oddness and rotation commutation of nested symmetric warps (odd-symmetry error ~4e-14 for Em=3).
 *  4. The free-endpoint inverse: closed form per macro segment (zero evaluations of f), accurate.
 *  5. The node-count ceiling: an unverified E, a non-divisor or a non-integer macro is IGNORED, visibly.
 *  6. Export: macro/micro/macroIgnored, JSON round trip, old exports read as not nested.
 *  7. Overlay levels: macro lines and micro lines at the right lattice indices and positions.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor'];
const load = fromHead => FILES.map(f => fromHead ? execSync(`git show HEAD:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString() : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const SRC_NEW = load(false), SRC_OLD = load(true);
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const W = 600;
function makeSb(src, order, sf, mode) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, atan2: Math.atan2,
        floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, dist: (a, b, c, d) => Math.hypot(c - a, d - b), lerp: (a, b, t) => a + (b - a) * t, console,
        line: (a, b, c, d) => sb.lines.push([a, b, c, d]), bezier: () => { }, point: () => { }, push: () => { }, pop: () => { }, noStroke: () => { }, noFill: () => { }, stroke: () => { },
        fill: () => { }, beginShape: () => { }, vertex: () => { }, endShape: () => { }, CLOSE: 'close',
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, lineColor: '#000', altNetSeed: null,
        currentShape: 'square', shapeSizeFactor: sf, nodeCount: order, symmetryMode: mode, width: W, height: W, showFaces: false,
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, activeLayer: 'base', timeline: null,
        baseNetTransform: null, baseNetAnimation: null, activeNetWarp: null, lines: []
    };
    sb.toTileLocal = (n, tileC, flip180, rot = 0) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } if (rot) { const r = rot * Math.PI / 180, rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r); x = rx; y = ry; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb); vm.runInContext(src, sb);
    const g = sb.buildSquareGrid(order, sf, W, W); sb.nodes = g.nodes; sb.centroid = g.centroid; sb.outerCorners = g.outerCorners;
    return sb;
}
let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gaps = a => a.slice(1).map((v, i) => +(v - a[i]).toFixed(2));
const S1 = { x: { kind: 'trig', w: -1 }, y: 'same', repeat: false };

// ============ 1. micro = 1 is byte-identical ============
console.log('== 1. micro = 1: byte-identical to the previous commit ==');
{
    const oldSb = makeSb(SRC_OLD, 7, 1, 'none'), newSb = makeSb(SRC_NEW, 7, 1, 'none');
    const SPECS = [{ x: { kind: 'trig', w: -0.8 }, y: 'same' }, { x: { kind: 'trig', w: 0.6 }, y: { kind: 'trig', w: -0.4 } }, { x: { kind: 'geometric', w: 1.3 }, y: 'same' }, { x: { kind: 'geometric', w: -1.1, alternate: true }, y: { kind: 'trig', w: 0.5 }, repeat: true }, { x: { kind: 'trig', w: 1 }, y: 'same', repeat: true }];
    let laws = 0, lawBad = 0, pts = 0, ptBad = 0;
    for (const spec of SPECS) for (const E of [2, 3, 4, 6, 8, 12]) for (const macroSpec of [undefined, E]) {
        const s2 = macroSpec === undefined ? spec : { ...spec, macro: macroSpec };
        for (const axis of [spec.x, spec.y === 'same' ? spec.x : spec.y]) {
            const a = oldSb.netAxisLaw(axis, E), b = newSb.netAxisLaw(axis, E, s2.macro);
            laws++; if ((a === null) !== (b === null)) { lawBad++; continue; }
            if (a) for (let i = 0; i <= 400; i++) if (a(i / 400) !== b(i / 400)) { lawBad++; break; }
        }
        const frame = { c0: { x: 30, y: 40 }, v1: { x: 200, y: 0 }, v2: { x: 0, y: 200 } };
        const wo = oldSb.makeNetWarp(spec, frame, E), wn = newSb.makeNetWarp(s2, frame, E);
        if ((wo === null) !== (wn === null)) { ptBad++; continue; }
        if (wo) for (let i = 0; i < 300; i++) { const p = { x: rnd() * 900 - 300, y: rnd() * 900 - 300 }; pts++; if (JSON.stringify(oldSb.applyNetWarp(wo, p)) !== JSON.stringify(newSb.applyNetWarp(wn, p))) ptBad++; }
    }
    check('netAxisLaw(): identical values (===) at 401 points, every law, E = 2..12, macro absent or = E', lawBad === 0, `${laws} laws`);
    check('applyNetWarp(): identical output (JSON) at random points across ~3 tiles', ptBad === 0, `${pts} points`);
    let n = 0, bad = 0, lines = 0;
    for (const order of [3, 5, 7]) for (const mode of ['rotation_reflection6', 'none']) for (const spec of SPECS) for (const macro of [undefined, order - 1]) {
        const build = (src, sp) => { seed = 30 + order; const sb = makeSb(src, order, 3, mode); const ids = sb.nodes.map(x => x.id); sb.connections = [1, 2, 3, 4].map(() => [ids[Math.floor(rnd() * ids.length)], ids[Math.floor(rnd() * ids.length)]]).filter(c => c[0] !== c[1]); sb.baseNetTransform = sp; return sb; };
        const s2 = macro === undefined ? spec : { ...spec, macro };
        const a = build(SRC_OLD, spec), b = build(SRC_NEW, s2); a.lines = []; a.drawTessellation(); b.lines = []; b.drawTessellation();
        n++; lines += b.lines.length; if (JSON.stringify(a.lines) !== JSON.stringify(b.lines)) bad++;
    }
    check('the real pipeline: drawTessellation() draws exactly the previous commit\'s line() calls', bad === 0, `${n} configurations, ${lines} lines`);
}

// ============ 2. the worked example ============
console.log('\n== 2. worked example: Sinus, strength 1, Node Count 7, Em = 3 x micro = 2 ==');
{
    const spec = { ...S1, macro: 3 }, sb = makeSb(SRC_NEW, 7, 1, 'none'); sb.baseNetTransform = spec;
    const w = sb.netWarpBaseNow(), n = 7;
    const xs = [...Array(n).keys()].map(i => sb.applyNetWarp(w, sb.nodes[i * n]).x), macro = [0, 2, 4, 6].map(i => xs[i]);
    console.log('   node x:', xs.map(v => +v.toFixed(2)).join(', '), '\n   macro gaps:', gaps(macro).join(' / '), '  fine gaps:', gaps(xs).join(' / '));
    check('macro gaps 169.27 / 261.47 / 169.27 px (from the nodes)', JSON.stringify(gaps(macro)) === JSON.stringify([169.27, 261.47, 169.27]));
    check('fine gaps 84.63 / 84.63 / 130.73 / 130.73 / 84.63 / 84.63 px - uniform inside each macro cell', JSON.stringify(gaps(xs)) === JSON.stringify([84.63, 84.63, 130.73, 130.73, 84.63, 84.63]));
    // the real drawing: connections between the neighbouring nodes of the top row, symmetry off
    sb.symmetryMode = 'none'; const ids = [...Array(n).keys()].map(i => i * n + 1); sb.connections = ids.slice(1).map((id, i) => [ids[i], id]);
    sb.segmentCollector = []; sb.drawTessellation(); const segs = sb.segmentCollector; sb.segmentCollector = null;
    const dx = [...new Set(segs.flatMap(s => [s.x1, s.x2]).map(v => +v.toFixed(4)))].sort((a, b) => a - b);
    check('the same numbers in the segments the real drawing emits', JSON.stringify(gaps(dx)) === JSON.stringify([84.63, 84.63, 130.73, 130.73, 84.63, 84.63]), gaps(dx).join(' / '));
    const L = sb.netGridLines(spec, sb.outerCorners, 6, { x0: 0, y0: 0, x1: W, y1: W }, { closed: true }), v = L.filter(l => l.axis === 'v').sort((a, b) => a.x1 - b.x1);
    check('the overlay: 7 vertical lines at the same positions', v.length === 7 && v.every((l, i) => Math.abs(l.x1 - xs[i]) < 1e-9));
    const flat = makeSb(SRC_NEW, 7, 1, 'none'); flat.baseNetTransform = { ...S1, macro: 2 };
    const fw = flat.netWarpBaseNow(), fx = [...Array(n).keys()].map(i => flat.applyNetWarp(fw, flat.nodes[i * n]).x);
    check('control: Em = 2 sits on the odd law\'s fixed points - uniform 100 px gaps, no effect', JSON.stringify(gaps(fx)) === JSON.stringify([100, 100, 100, 100, 100, 100]), gaps(fx).join(' / '));
    const one = makeSb(SRC_NEW, 7, 1, 'none'); one.baseNetTransform = S1; const ow = one.netWarpBaseNow();
    check('control: without macro (smooth, Em = E = 6) the gaps are the known 62.70 / 106.57 / 130.73 ...', JSON.stringify(gaps([...Array(n).keys()].map(i => one.applyNetWarp(ow, one.nodes[i * n]).x))) === JSON.stringify([62.7, 106.57, 130.73, 130.73, 106.57, 62.7]));
}

// ============ 3. oddness and commutation ============
console.log('\n== 3. oddness / rotation commutation of nested symmetric warps ==');
{
    const sb = makeSb(SRC_NEW, 13, 1, 'none');
    const unit = { c0: { x: 0, y: 0 }, v1: { x: 1, y: 0 }, v2: { x: 0, y: 1 } }, ctr = { x: 0.5, y: 0.5 };
    let worstOdd = 0, worstRot = 0, worstMir = 0;
    for (const [Em, m, kind, w] of [[3, 2, 'trig', -1], [3, 4, 'trig', -1], [4, 3, 'trig', 0.8], [2, 3, 'trig', -1], [6, 1, 'trig', -1], [3, 1, 'trig', 0.6], [6, 2, 'trig', -0.9]]) {
        const E = Em * m, spec = { x: { kind, w }, y: 'same', macro: Em };
        const wp = sb.makeNetWarp(spec, unit, E); if (!wp) continue;
        // odd-symmetry error of the node positions (the design session's metric, px on a 600 px tile)
        const xs = [...Array(E + 1).keys()].map(i => sb.applyNetWarp(wp, { x: i / E, y: 0.3 }).x * 600);
        const odd = Math.max(...xs.map((v, i) => Math.abs(v - (600 - xs[E - i]))));
        let rot = 0, mir = 0;
        for (let i = 0; i < 3000; i++) { const p = { x: rnd() * 0.999, y: rnd() * 0.999 }; const a = sb.applyNetWarp(wp, sb.rotateAround(p, ctr, 90)), b = sb.rotateAround(sb.applyNetWarp(wp, p), ctr, 90); rot = Math.max(rot, Math.hypot(a.x - b.x, a.y - b.y)); const c = sb.applyNetWarp(wp, { x: 1 - p.x, y: p.y }), d = sb.applyNetWarp(wp, p); mir = Math.max(mir, Math.hypot(c.x - (1 - d.x), c.y - d.y)); }
        console.log(`   Em=${Em} micro=${m} (E=${E}) ${kind} w=${w}: odd-symmetry error ${odd.toExponential(1)} px, rot90 ${rot.toExponential(1)}, x-mirror ${mir.toExponential(1)} (tile units)`);
        worstOdd = Math.max(worstOdd, odd); worstRot = Math.max(worstRot, rot); worstMir = Math.max(worstMir, mir);
    }
    check('node positions odd about the tile centre (Em=3, micro=2: the design session measured 4.3e-14 px)', worstOdd < 1e-11);
    check('rot90 and the x-mirror commute with the nested F (unit tile)', worstRot < 1e-12 && worstMir < 1e-12);
    // the real symmetry engine: the segments stay closed under the group
    const sr = makeSb(SRC_NEW, 7, 3, 'rotation_reflection6'); sr.baseNetTransform = { ...S1, macro: 3 };
    const conns = [[1, 49], [7, 43], [2, 48], [8, 20], [3, 30]]; const wp = sr.netWarpBaseNow(); sr.activeNetWarp = wp;
    sr.segmentCollector = []; sr.drawShapeCell(conns, sr.centroid, false, sr.nodes, 0, undefined, undefined, undefined); const segs = sr.segmentCollector; sr.segmentCollector = null;
    const key = (p, q) => [p, q].map(z => `${z.x.toFixed(5)},${z.y.toFixed(5)}`).sort().join('|'), set = new Set(segs.map(s => key({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 })));
    let missing = 0; for (const s of segs) { const r = p => sr.rotateAround(p, sr.centroid, 90); if (!set.has(key(r({ x: s.x1, y: s.y1 }), r({ x: s.x2, y: s.y2 })))) missing++; }
    check('the real drawConnectionWithSymmetry() output stays 90-degree closed under a nested symmetric warp', missing === 0, `${segs.length} segments, ${missing} missing`);
}

// ============ 4. inverse ============
console.log('\n== 4. F^-1 for a nested warp ==');
{
    const sb = makeSb(SRC_NEW, 7, 3, 'none'); let worst = 0, n = 0;
    for (const spec of [{ x: { kind: 'trig', w: -1 }, y: 'same', macro: 3 }, { x: { kind: 'trig', w: 0.8 }, y: 'same', macro: 2 }, { x: { kind: 'geometric', w: 1.4, alternate: true }, y: { kind: 'trig', w: -0.5 }, macro: 3, repeat: true }, { x: { kind: 'geometric', w: -1.2 }, y: 'same', macro: 6 }]) {
        sb.baseNetTransform = spec; const w = sb.netWarpBaseNow(); if (!w) continue;
        for (let i = 0; i < 2000; i++) {
            const p = { x: -300 + rnd() * 1000, y: -300 + rnd() * 1000 }, back = sb.applyNetWarp(w, sb.invertNetWarp(w, p));
            worst = Math.max(worst, Math.hypot(back.x - p.x, back.y - p.y)); n++;
        }
    }
    // count ONLY the inverse's evaluations
    sb.baseNetTransform = { x: { kind: 'trig', w: -1 }, y: 'same', macro: 3 }; const w = sb.netWarpBaseNow(); let c = 0;
    const wrap = f => { const g = x => { c++; return f(x); }; g.pl = f.pl; return g; }; w.fx = wrap(w.fx); w.fy = wrap(w.fy);
    for (let i = 0; i < 500; i++) sb.invertNetWarp(w, { x: rnd() * 600, y: rnd() * 600 });
    // and the smooth law (no nesting) still evaluates f (bisection): the counter works
    sb.baseNetTransform = { x: { kind: 'trig', w: -1 }, y: 'same' }; const ws = sb.netWarpBaseNow(); let cs = 0; const wraps = f => { const g = x => { cs++; return f(x); }; return g; }; ws.fx = wraps(ws.fx); ws.fy = wraps(ws.fy);
    sb.invertNetWarp(ws, { x: 250, y: 250 });
    check('F(F^-1 p) == p over ~3 tiles, four nested configurations (incl. alternate parity, geometric)', worst < 1e-9, `worst ${worst.toExponential(1)} px, ${n} points`);
    check('the nested inverse is closed form: 0 evaluations of f in 500 inversions (the smooth law needs ' + cs + ' for one)', c === 0 && cs > 50, `${c} vs ${cs}`);
}

// ============ 5. the ceiling ============
console.log('\n== 5. macro validity and the node-count ceiling ==');
{
    const sb = makeSb(SRC_NEW, 7, 1, 'none'), eff = (m, E) => sb.netMacroEffective(m, E);
    const ok = (m, E, macro, micro) => { const r = eff(m, E); return r.valid && r.macro === macro && r.micro === micro; };
    check('valid: absent -> (E,1); 3 of E=6 -> (3,2); 3 of E=12 -> (3,4); 7 of E=14 -> (7,2); macro = E -> (E,1)', ok(undefined, 6, 6, 1) && ok(3, 6, 3, 2) && ok(3, 12, 3, 4) && ok(7, 14, 7, 2) && ok(6, 6, 6, 1));
    const refused = (m, E, frag) => { const r = eff(m, E); return !r.valid && r.macro === E && r.micro === 1 && String(r.reason).includes(frag); };
    check('refused, visibly: a non-divisor, a non-integer, zero/negative, larger than E', refused(4, 6, 'does not divide') && refused(2.5, 6, 'positive integer') && refused(0, 6, 'positive integer') && refused(-3, 6, 'positive integer') && refused(12, 6, 'does not divide'));
    check('refused: E = 15 and above (beyond the verified ceiling 14) even for a valid divisor', refused(3, 15, 'ceiling') && refused(5, 20, 'ceiling') && vm.runInContext('NETWARP_MAX_E', sb) === 14);
    const divs = E => [...Array(E).keys()].map(i => i + 1).filter(m => eff(m, E).valid && m === eff(m, E).macro);
    check('the divisors accepted at the verified sizes: E = 12 -> 1,2,3,4,6,12 ; E = 14 -> 1,2,7,14 ; E = 13 -> 1,13', JSON.stringify(divs(12)) === '[1,2,3,4,6,12]' && JSON.stringify(divs(14)) === '[1,2,7,14]' && JSON.stringify(divs(13)) === '[1,13]');
    const opts = E => JSON.stringify(sb.netMacroOptions(E));
    check('netMacroOptions (what the UI offers): the divisors >= 3 up to E - E=6 -> 3,6 ; 8 -> 4,8 ; 9 -> 3,9 ; 12 -> 3,4,6,12 ; 14 -> 7,14', opts(6) === '[3,6]' && opts(8) === '[4,8]' && opts(9) === '[3,9]' && opts(12) === '[3,4,6,12]' && opts(14) === '[7,14]');
    check('netMacroOptions: no nesting possible (only E itself, or nothing) for E = 2 -> none, 3,4,5,7 -> [E], 13 -> [13], above the ceiling -> none', opts(2) === '[]' && opts(4) === '[4]' && opts(5) === '[5]' && opts(7) === '[7]' && opts(13) === '[13]' && opts(15) === '[]' && opts(3) === '[3]');
    check('every offered option is accepted by netMacroEffective (never a value the core would ignore)', [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].every(E => sb.netMacroOptions(E).every(m => eff(m, E).valid)));
    // an ignored macro really falls back to the smooth law
    const a = makeSb(SRC_NEW, 7, 1, 'none'), b = makeSb(SRC_NEW, 7, 1, 'none'); a.baseNetTransform = { ...S1, macro: 4 }; b.baseNetTransform = S1;
    const wa = a.netWarpBaseNow(), wb = b.netWarpBaseNow(); let same = true; for (let i = 0; i < 200; i++) { const p = { x: rnd() * 600, y: rnd() * 600 }; if (JSON.stringify(a.applyNetWarp(wa, p)) !== JSON.stringify(b.applyNetWarp(wb, p))) same = false; }
    check('an ignored macro (4 does not divide 6) behaves exactly like no macro', same);
}

// ============ 6. export ============
console.log('\n== 6. export ==');
{
    const sb = makeSb(SRC_NEW, 7, 1, 'none'), ex = spec => JSON.parse(JSON.stringify(sb.netTransformExportData(spec, 6)));
    const n1 = ex({ ...S1, macro: 3 });
    check('meta.netTransform: macro 3, micro 2, E 6; geometric q is per macro cell', n1.macro === 3 && n1.micro === 2 && n1.E === 6 && Math.abs(ex({ x: { kind: 'geometric', w: 1.2 }, y: 'same', macro: 3 }).x.q - Math.exp(1.2 / 2)) < 1e-12 && !('macroIgnored' in n1));
    const n0 = ex(S1); check('not nested: macro = E, micro = 1', n0.macro === 6 && n0.micro === 1);
    const ig = ex({ ...S1, macro: 4 }); check('an ignored macro is flagged: macroIgnored {requested, reason}, and the effective macro = E', ig.macro === 6 && ig.micro === 1 && ig.macroIgnored.requested === 4 && /divide/.test(ig.macroIgnored.reason));
    const back = sb.netTransformFromExport(n1), back0 = sb.netTransformFromExport(n0);
    check('round trip: macro comes back for a nested spec, is absent for an un-nested one', back.macro === 3 && back0.macro === undefined);
    const w1 = sb.netWarpForBase({ ...S1, macro: 3 }, 'square', sb.outerCorners, 7), w2 = sb.netWarpForBase(back, 'square', sb.outerCorners, 7); let worst = 0;
    for (let i = 0; i < 500; i++) { const p = { x: rnd() * 900 - 150, y: rnd() * 900 - 150 }, a = sb.applyNetWarp(w1, p), b = sb.applyNetWarp(w2, p); worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y)); }
    check('the exported description maps random points identically to the original spec', worst === 0, `worst ${worst}`);
    check('an export from before nesting (no macro/micro fields) reads back un-nested', sb.netTransformFromExport({ version: 1, x: { kind: 'trig', w: -0.5 }, y: { kind: 'trig', w: -0.5 } }).macro === undefined);
}

// ============ 7. overlay levels ============
console.log('\n== 7. overlay levels ==');
{
    const sb = makeSb(SRC_NEW, 7, 1, 'none'), spec = { ...S1, macro: 3 };
    const L = sb.netGridLines(spec, sb.outerCorners, 6, { x0: 0, y0: 0, x1: W, y1: W }, { closed: true }), v = L.filter(l => l.axis === 'v').sort((a, b) => a.x1 - b.x1);
    check('vertical lines: macro at lattice indices 0, 2, 4, 6 (black), micro at 1, 3, 5 (red)', v.map(l => l.level).join(',') === 'macro,micro,macro,micro,macro,micro,macro');
    console.log('   macro x:', v.filter(l => l.level === 'macro').map(l => +l.x1.toFixed(2)).join(', '), ' micro x:', v.filter(l => l.level === 'micro').map(l => +l.x1.toFixed(2)).join(', '));
    check('macro lines at 0 / 169.27 / 430.73 / 600, micro lines between them at their uniform midpoints (84.63 / 300 / 515.37)', JSON.stringify(v.filter(l => l.level === 'macro').map(l => +l.x1.toFixed(2))) === JSON.stringify([0, 169.27, 430.73, 600]) && JSON.stringify(v.filter(l => l.level === 'micro').map(l => +l.x1.toFixed(2))) === JSON.stringify([84.63, 300, 515.37]));
    check('not nested: every line is macro', sb.netGridLines(S1, sb.outerCorners, 6, { x0: 0, y0: 0, x1: W, y1: W }, { closed: true }).every(l => l.level === 'macro'));
    check('an ignored macro draws un-nested (every line macro)', sb.netGridLines({ ...S1, macro: 4 }, sb.outerCorners, 6, { x0: 0, y0: 0, x1: W, y1: W }, { closed: true }).every(l => l.level === 'macro'));
}

// ============ 8. Macro 2 is law-dependent ============
console.log('\n== 8. Macro 2: a no-op for trig laws, a real split for the geometric law ==');
{
    const sb = makeSb(SRC_NEW, 7, 1, 'none');
    let spread = 0, cases = 0;
    for (const E of [4, 6, 8, 12]) for (let w = -1; w <= 1.0001; w += 0.05) {
        if (Math.abs(w) < 1e-9) continue;
        const f = sb.netAxisLaw({ kind: 'trig', w }, E, 2); cases++;
        const pos = [...Array(E + 1).keys()].map(i => f(i / E));
        spread = Math.max(spread, Math.abs(f.pl.M[1] - 0.5), Math.max(...pos.slice(1).map((g, i) => g - pos[i])) - Math.min(...pos.slice(1).map((g, i) => g - pos[i])));
    }
    check(`trig, Em = 2: the macro point is exactly 1/2 and every gap is equal, for all ${cases} (E x strength) cases (sinus and tangens)`, spread < 1e-14, spread);
    let ok = true, info = [];
    for (const R of [1.5, 2, 3, 5, 9]) for (const E of [4, 6]) {
        const w = Math.log(R), f = sb.netAxisLaw({ kind: 'geometric', w }, E, 2), sm = sb.netAxisLaw({ kind: 'geometric', w }, E, undefined), M = f.pl.M;
        const ratio = (M[2] - M[1]) / (M[1] - M[0]), pos = [...Array(E + 1).keys()].map(i => f(i / E));
        const dSmooth = Math.max(...pos.map((p, i) => Math.abs(p - sm(i / E)))), dUni = Math.max(...pos.map((p, i) => Math.abs(p - i / E)));
        if (!(Math.abs(ratio - R) < 1e-9 && Math.abs(M[1] - 1 / (1 + R)) < 1e-12 && dSmooth > 0.03 && dUni > 0.09)) ok = false;
        if (E === 4) info.push(`R=${R}: M1=${M[1].toFixed(4)}`);
    }
    console.log('   geometric Em = 2, E = 4:', info.join('  '));
    check('geometric, Em = 2: two macro cells in the ratio R : 1 (M1 = 1/(1+R)), distinct from the smooth law (>= 0.03 tile) and from uniform (>= 0.09), R = 1.5 .. 9', ok);
    const g2 = sb.netAxisLaw({ kind: 'geometric', w: 1.2 }, 2, 2), g2s = sb.netAxisLaw({ kind: 'geometric', w: 1.2 }, 2, undefined);
    check('geometric, E = 2: Em = 2 IS the smooth law (no nesting, nothing to offer)', [0, .25, .5, .75, 1].every(t => g2(t) === g2s(t)));
    const G = { x: { kind: 'geometric', w: Math.log(3) }, y: 'same' }, T = { x: { kind: 'trig', w: -1 }, y: 'same' }, N = null;
    const o = (E, sp) => JSON.stringify(sb.netMacroOptions(E, sp));
    check('options, geometric: E=4 -> 2,4 ; 6 -> 2,3,6 ; 8 -> 2,4,8 ; 9 -> 3,9 ; 12 -> 2,3,4,6,12 ; 14 -> 2,7,14', o(4, G) === '[2,4]' && o(6, G) === '[2,3,6]' && o(8, G) === '[2,4,8]' && o(9, G) === '[3,9]' && o(12, G) === '[2,3,4,6,12]' && o(14, G) === '[2,7,14]');
    check('options, geometric, no nesting possible: E=2 -> [2] (itself), 3,5,7 -> [E], above the ceiling -> none', o(2, G) === '[2]' && o(3, G) === '[3]' && o(5, G) === '[5]' && o(7, G) === '[7]' && o(15, G) === '[]');
    check('options, trig / no spec / regular: unchanged (divisors >= 3), Macro 2 never offered', [4, 6, 8, 12, 14].every(E => o(E, T) === o(E, undefined) && o(E, N) === o(E, undefined) && !JSON.parse(o(E, T)).includes(2)) && o(6, T) === '[3,6]' && o(12, T) === '[3,4,6,12]');
    const M1 = { x: { kind: 'geometric', w: 1 }, y: { kind: 'trig', w: -1 } }, M2 = { x: { kind: 'geometric', w: 1 }, y: { kind: 'uniform', w: 0 } }, M3 = { x: { kind: 'uniform', w: 0 }, y: { kind: 'geometric', w: 1 } };
    check('options, mixed: geometric x + trig y -> no 2 (it would flatten the trig axis); geometric x + regular y, or regular x + geometric y -> 2 offered', !JSON.parse(o(4, M1)).includes(2) && JSON.parse(o(4, M2)).includes(2) && JSON.parse(o(4, M3)).includes(2));
    check('every offered option (any law) is accepted by netMacroEffective', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].every(E => [G, T, M1, M2, N, undefined].every(sp => sb.netMacroOptions(E, sp).every(m => sb.netMacroEffective(m, E).valid))));
    // the overlay: geometric R = 3, Node Count 5 (E = 4), Em = 2 -> macro lines at 0 / 150 / 600 (M1 = 1/4), micro at 75 / 375
    const sb5 = makeSb(SRC_NEW, 5, 1, 'none'), L = sb5.netGridLines({ ...G, macro: 2 }, sb5.outerCorners, 4, { x0: 0, y0: 0, x1: W, y1: W }, { closed: true }), v = L.filter(l => l.axis === 'v').sort((a, b) => a.x1 - b.x1);
    console.log('   overlay x:', v.map(l => `${l.level[0]}${l.x1.toFixed(2)}`).join(' '));
    check('overlay, geometric R = 3, E = 4, Em = 2: macro lines at 0 / 150 / 600, micro at 75 / 375 (unequal, real coordinates)', JSON.stringify(v.filter(l => l.level === 'macro').map(l => +l.x1.toFixed(2))) === '[0,150,600]' && JSON.stringify(v.filter(l => l.level === 'micro').map(l => +l.x1.toFixed(2))) === '[75,375]');
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
