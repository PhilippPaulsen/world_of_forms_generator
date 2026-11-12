// G4 (task 059): node numbers, line keys and grid names of core/forms.js, core/symmetry.js, core/orbits.js against the Orakel tools/gitter/measure-name-rule.js,
// matched by COORDINATES (never by ids). The Orakel's own report is reproduced FROM THE CORE (tools/gitter/oracle-bridge.js) and compared line for line.
//   node tools/gitter/test-name-rule.js        FORMS_JS / SYMMETRY_JS / ORBITS_JS = mutated copies (sabotage runs)
const B = require('./oracle-bridge.js'), O = require('./measure-name-rule.js');
const core = B.loadCore(), { V2, LAT } = core;
let pass = 0, fail = 0;
process.on('uncaughtException', e => { console.log('FAIL the test run itself crashed: ' + (e && e.message)); process.exit(1); });
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify, G = core.get;
const shapes = ['triangle', 'square', 'hex'], VIEW = { sizeFactor: 3, canvasW: 600, canvasH: 600 };
const NMAX = (shape, lage) => shape === 'hex' ? (lage === 2 ? 5 : 6) : 8;

// (1) the Orakel's report, produced from the core
{
    const r = B.runOracle(core);
    const dev = r.core.filter(l => l.startsWith('ABWEICHUNG'));
    check('(1) the Orakel report driven by the core is line for line the untouched Orakel report', J(r.core) === J(r.plain), r.core.filter((l, i) => l !== r.plain[i]).slice(0, 2).join(' | ').slice(0, 300));
    const nums = r.core.map(l => /: (\d+)\/(\d+) Zahlen gleich/.exec(l)).filter(Boolean), rows = r.core.map(l => /: (\d+)\/(\d+) Familien gleich/.exec(l)).filter(Boolean);
    const sum = (a, k) => a.reduce((s, m) => s + +m[k], 0);
    check('(1) 299/299 node numbers (7 figures: the printed number at every read position)', sum(nums, 1) === 299 && sum(nums, 2) === 299 && nums.length === 7, sum(nums, 1) + '/' + sum(nums, 2));
    check('(1) 240/240 table rows (6 tables: family, letters, bar, capitals)', sum(rows, 1) === 240 && sum(rows, 2) === 240 && rows.length === 6, sum(rows, 1) + '/' + sum(rows, 2));
    check('(1) uniqueness: 12 grids "eindeutig", 0 collisions, 0 anomalies', r.core.filter(l => l.startsWith('eindeutig')).length === 12 && !r.core.some(l => l.startsWith('KOLLISION')) && !r.core.some(l => /Anomal|anomal/.test(l)));
    // (4) --strict: exactly the two known printing errors of the source, each on its own
    check('(4) strict: exactly two deviations, 5.[] 2. Lage 261 -> 262 and 64 -> 65, nothing else', dev.length === 2 && /5\.□ \(2\. Lage\): Quelle 261, gerechnet 262/.test(dev[0]) && /5\.□ \(034\.png\): Quelle 64, gerechnet 65/.test(dev[1]) && r.badCore === 2 && r.badPlain === 2, dev.join(' | '));
}

// (2) every grid: the core's orbits and keys equal the Orakel's, by coordinates, for EVERY pair (oriented readings included)
{
    let bad = '', cases = 0, pairsChecked = 0;
    for (const shape of shapes) for (const lage of [1, 2]) for (let n = 1; n <= NMAX(shape, lage); n++) {
        const grid = { shape, ordnung: n, lage }, og = O.buildGrid(shape, n, lage), oo = O.pairOrbits(og), t = core.table(grid), num = core.numbered(grid);
        cases++;
        const idx = new Map(og.nodes.map((nd, i) => [B.ptKey(nd.x, nd.y), i])), idOf = new Map(num.nodes.map((nd, i) => [nd.id, i]));
        const toO = id => idx.get(B.ptKey(num.points[idOf.get(id)].x, num.points[idOf.get(id)].y));
        if (t.entries.length !== oo.length) { bad += ` ${shape}${n}/${lage}:orbits ${t.entries.length}/${oo.length}`; continue; }
        if (t.collisions.length) bad += ` ${shape}${n}/${lage}:collisions`;
        const oName = new Map(); oo.forEach((o, k) => o.pairs.forEach(([i, j]) => oName.set(Math.min(i, j) + ',' + Math.max(i, j), o)));
        for (const e of t.entries) for (const [a, b] of e.pairs) {
            const oi = toO(a), oj = toO(b), o = oName.get(Math.min(oi, oj) + ',' + Math.max(oi, oj)); pairsChecked++;
            if (!o || o.z1 !== e.key.z1 || o.z2 !== e.key.z2 || o.letter !== e.key.buchstabe || o.bar !== e.key.gegen || o.achiral !== e.spiegelgleich || o.name !== e.token) { bad += ` ${shape}${n}/${lage}:${e.token}!=${o && o.name}`; break; }
        }
    }
    check('(2) 3 shapes x 2 lagen x n = 1..8 (hex to 6/5): orbit count, and for EVERY pair z1, z2, letter, bar (direction), spiegelgleich, name equal the Orakel (' + cases + ' grids, ' + pairsChecked + ' pairs)', bad === '', bad.slice(0, 300));
}

// (3) round trips and formats
{
    let bad = '', keys = 0, pr = 0;
    for (const [shape, n, lage] of [['triangle', 4, 2], ['square', 4, 2], ['hex', 3, 1], ['hex', 2, 2], ['square', 3, 1], ['triangle', 6, 1]]) {
        const grid = { shape, ordnung: n, lage }, t = core.table(grid), f = G('formatLineKey'), p = G('parseLineKey'), kf = G('lineKeyForPair'), pf = G('pairForLineKey');
        for (const e of t.entries) {
            keys++;
            const tok = f(e.key); if (J(p(tok)) !== J(e.key) || J(p(tok, { table: t })) !== J(e.key) || tok !== e.token) bad += ` parse ${tok}`;
            const pr0 = pf(t, e.key, V2); if (!pr0 || J(kf(t, pr0[0], pr0[1], V2)) !== J(e.key) || !e.pairs.some(([a, b]) => (a === pr0[0] && b === pr0[1]) || (a === pr0[1] && b === pr0[0]))) bad += ` orbit ${tok}`;
            for (const [a, b] of e.pairs) { pr++; if (J(kf(t, a, b, V2)) !== J(e.key) || J(kf(t, b, a, V2)) !== J(e.key)) { bad += ` pair ${tok}`; break; } }
        }
        if (new Set(t.entries.map(e => e.token)).size !== t.entries.length) bad += ' collisions';
    }
    check('(1) 0 key collisions; roundtrip pair -> key -> same orbit -> representative pair; parseLineKey(formatLineKey(k)) = k (' + keys + ' keys, ' + pr + ' pairs, both pair directions)', bad === '', bad.slice(0, 200));
    const F = G('formatGridName'), P = G('parseGridName');
    const k = (z1, z2, b, g) => ({ z1, z2, buchstabe: b, gegen: !!g });
    check('(3) names: 3d2/3* 65a, 2*2/6* 76a, 5q2/4* 12.11a', F({ shape: 'triangle', ordnung: 3, lage: 2 }, [k(6, 5, 'a')], V2) === '3d2/3* 65a' && F({ shape: 'hex', ordnung: 2, lage: 2 }, [k(7, 6, 'a')], V2) === '2*2/6* 76a' && F({ shape: 'square', ordnung: 5, lage: 2 }, [k(12, 11, 'a')], V2) === '5q2/4* 12.11a');
    check('(3) bar token 55e~ and a multi-line name with duplicates, numeric order (not string order)', F({ shape: 'triangle', ordnung: 3, lage: 2 }, [k(5, 5, 'e', true), k(6, 5, 'a'), k(6, 5, 'a')], V2) === '3d2/3* 55e~+65a+65a');
    const rt = P('3d2/3* 55e~+65a+65a', V2);
    check('(3) parseGridName: grid, group, 3 tokens (count, duplicates kept), format(parse(name)) = name', rt && rt.count === 3 && rt.group === '3*' && rt.grid.lage === 2 && F(rt.grid, rt.keys, V2) === '3d2/3* 55e~+65a+65a', J(rt));
    check('(3) parseGridName also parses the real table tokens 12.11a (square 5 lage 2) and 76a (hex 2 lage 2)', P('5q2/4* 12.11a', V2) && P('2*2/6* 76a', V2) && P('5q2/4* 12.11a', V2).keys[0].z1 === 12);
    check('(3) parseGridName only normalizes after the table check: 65A (spiegelgleich) -> 65a; 65I (not spiegelgleich) and 99a (no such family) refused; a bar is never added or dropped', (r => r && r.tokens[0] === '65a')(P('3d2/3* 65A', V2)) && P('3d2/3* 65I', V2) === null && P('3d2/3* 99a', V2) === null && P('3d2/3* 65a~', V2) === null && P('3d2/3* 65e~', V2) === null && P('3d2/3* 55e~', V2).tokens[0] === '55e~' && P('3d2/3* 55E~', V2).tokens[0] === '55e~');
    check('(3) parse refuses wrong group, wrong lage letters, garbage, unsorted tokens, 0 / 9 ordnung', [P('3q2/3* 65a', V2), P('3d2/4* 65a', V2), P('3x2/3* 65a', V2), P('3d3/3* 65a', V2), P('xx', V2), P(null, V2), P('3d2/3* 65a+55e~', V2), P('0d2/3* 65a', V2), P('3d2/3* ', V2)].every(x => x === null));
    // the string-sort trap: z1 = 12 must not sort before z1 = 6
    const sorted = [k(12, 11, 'a'), k(6, 5, 'a'), k(10, 2, 'c'), k(9, 9, 'a', true), k(9, 9, 'a')].sort(G('compareLineKeys')).map(x => G('formatLineKey')(x));
    check('(3) compareLineKeys is numeric: 65a, 99a, 99a~, 10.2c, 12.11a (z1, z2, letter rank, bar)', J(sorted) === J(['65a', '99a', '99a~', '10.2c', '12.11a']), J(sorted));
    check('(3) display: 55e~ shows an overline, aA for spiegelgleich', G('formatLineKey')(k(5, 5, 'e', true), { display: true, spiegelgleich: true }) === '55eĒ' && G('formatLineKey')(k(6, 5, 'a'), { display: true, spiegelgleich: true }) === '65aA');
}

// (5) no systematic name: free ends, reduced modes, incomplete lines, invalid keys; the gate; the legacy path untouched
{
    const grid = { shape: 'square', ordnung: 3, lage: 1 }, t = core.table(grid), F = G('formatGridName'), kf = G('lineKeyForPair');
    check('(5) free end / unknown id / same node: lineKeyForPair null', kf(t, 1, 9999, V2) === null && kf(t, 1, 1, V2) === null && kf(t, -5, 2, V2) === null);
    const nodes = G('buildGridNodes')(grid, LAT).concat([{ id: 777, x: 12.5, y: 40, free: true }]), t2 = G('computeLineKeyTable')(nodes, grid, V2);
    check('(5) a free end node is left out of the table (no key for any pair with it)', kf(t2, 1, 777, V2) === null && t2.entries.length === t.entries.length);
    check('(5) reduced symmetryMode: computeLineKeyTable and formatGridName give null (rotation3, reflection_only, none, hex rotation_reflection3); the main modes do not', ['rotation3', 'reflection_only', 'none', 'rotation6'].every(m => G('computeLineKeyTable')(nodes, grid, { symmetryMode: m }) === null && F(grid, [{ z1: 2, z2: 1, buchstabe: 'a', gegen: false }], { symmetryMode: m }) === null)
        && G('computeLineKeyTable')(G('buildGridNodes')({ shape: 'hex', ordnung: 2, lage: 1 }, LAT), { shape: 'hex', ordnung: 2, lage: 1 }, { symmetryMode: 'rotation_reflection3' }) === null && G('computeLineKeyTable')(nodes, grid, { symmetryMode: 'rotation_reflection6' }) !== null);
    check('(5) incomplete line (a null / invalid key in the list), empty list, bad grid: formatGridName null', [[{ z1: 2, z2: 1, buchstabe: 'a', gegen: false }, null], [], [{ z1: 1, z2: 2, buchstabe: 'a', gegen: false }], [{ z1: 2, z2: 1, buchstabe: 'j', gegen: false }], null].every(ks => F(grid, ks, V2) === null) && F({ shape: 'pentagon', ordnung: 3, lage: 1 }, [{ z1: 2, z2: 1, buchstabe: 'a', gegen: false }], V2) === null);
    check('(5) GITTER_V2 is gone (task 066, G7b): the switch does not exist any more and the whole API works without any option (no opts: no gate error)', typeof G('typeof GITTER_V2') === 'string' && G('typeof GITTER_V2') === 'undefined' && !/gitterV2|GITTER_V2|_lkGate/.test(require('fs').readFileSync(process.env.ORBITS_JS || require('path').join(__dirname, '..', '..', 'core', 'orbits.js'), 'utf8')) && ['getLineKeyTable'].every(fn => { try { return !!G(fn)(grid); } catch (e) { return false; } }) && G('formatGridName')(grid, [{ z1: 1, z2: 1, buchstabe: 'a', gegen: false }]) !== undefined);
    check('(5) incomplete node set: the group does not close -> throws (never a wrong name)', (() => { try { G('computeLineKeyTable')(G('buildGridNodes')(grid, LAT).slice(1), grid, V2); return false; } catch (e) { return /not closed/.test(e.message); } })());
}

// (2b) geometry path: canvas coordinates (size, translation, canvas, alt-net rotated, handedness): keys equal the Orakel's through the canonical frame
{
    let bad = '', cases = 0;
    const run = (shape, n, lage, geo, nodes, label) => {
        const grid = { shape, ordnung: n, lage }, t = G('computeLineKeyTable')(nodes, grid, { geometry: geo }), og = O.buildGrid(shape, n, lage), oo = O.pairOrbits(og);
        const fr = G('canonicalGridFrame')({ shape, ordnung: n, centroid: geo.centroid, outerCorners: geo.outerCorners }), idx = new Map(og.nodes.map((nd, i) => [B.ptKey(nd.x, nd.y), i]));
        const oMap = new Map(); oo.forEach(o => o.pairs.forEach(([i, j]) => oMap.set(Math.min(i, j) + ',' + Math.max(i, j), o.name)));
        const pos = new Map(nodes.map(nd => { const o = fr.toOracle(nd.x, nd.y); return [nd.id, idx.get(B.ptKey(o.X, o.Y))]; }));
        cases++;
        for (const e of t.entries) for (const [a, b] of e.pairs) { const i = pos.get(a), j = pos.get(b); if (i === undefined || j === undefined || oMap.get(Math.min(i, j) + ',' + Math.max(i, j)) !== e.token) { bad += ` ${label}:${e.token}`; return; } }
    };
    for (const shape of shapes) for (const [n, lage] of [[2, 2], [3, 1], [3, 2]]) for (const v of [{}, { sizeFactor: 1 }, { sizeFactor: 9, canvasW: 900, canvasH: 500 }, { center: { x: 90, y: 410 } }]) {
        const g = G('buildGrid')({ shape, ordnung: n, lage }, Object.assign({}, VIEW, v), LAT);
        run(shape, n, lage, g, g.nodes, `${shape}${n}/${lage}/${J(v)}`);
    }
    for (const [shape, k] of [['triangle', 3], ['square', 4], ['hex', 6]]) for (const side of [1, -1]) {
        const e = G('completeEdgeToRegularPolygon')({ x: 120, y: 230 }, { x: 310, y: 260 }, k, side), geo = { centroid: e.center, outerCorners: e.vertices };
        const uv = G('buildGridNodes')({ shape, ordnung: 3, lage: 2 }, LAT), nodes = G('projectGridNodes')(uv, { shape, ordnung: 3, outerCorners: e.vertices, centroid: e.center });
        run(shape, 3, 2, geo, nodes, `alt-${shape}/${side}`);
    }
    check('(2) the geometry path (canvas x, y through canonicalGridFrame): default, other size/canvas/translation, and rotated/mirrored alt-net grids give the Orakel\'s keys, bar direction included (' + cases + ' grids)', bad === '', bad.slice(0, 200));
}

// (5b) legacy untouched: every function the old orbits.js had is source-identical, and gives the same results
{
    const cp = require('child_process'), fs = require('fs'), path = require('path'), vm = require('vm');
    const old = cp.execFileSync('git', ['show', (process.env.BASE || 'dd146481') + ':core/orbits.js'], { cwd: B.ROOT, encoding: 'utf8' });
    const sb = { Math, console, Number, Object, Error, Set, Map, WeakMap, JSON, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, atan2: Math.atan2, PI: Math.PI, dist: (a, b, c, d) => Math.hypot(c - a, d - b) };
    vm.createContext(sb); vm.runInContext(old, sb);
    const names = [...old.matchAll(/^function (\w+)\(/gm)].map(m => m[1]).filter(n => n !== 'computeThemeLineOrbitAssignments');   // task 066: removed on purpose (no consumer left: the v1 export was its only one)
    const same = names.filter(n => vm.runInContext(n + '.toString()', sb) !== G(n + '.toString()'));
    check('(6) all ' + names.length + ' functions of the old core/orbits.js (computeThemeLineOrbits, formatThemeLineName, computeThemeLineOrbitTable, _pairKey, ...) are source-identical', same.length === 0, same.join(','));
    let eq = 0, n = 0;
    for (const shape of shapes) for (const c of [3, 4, 5]) {
        const g = G('buildGrid')(G('fromLegacy')(shape, c), VIEW), mode = shape === 'hex' ? 'rotation_reflection6' : 'rotation_reflection3';
        const a = vm.runInContext('computeThemeLineOrbits', sb)(g.nodes, g.centroid, shape, mode, g.outerCorners), b = G('computeThemeLineOrbits')(g.nodes, g.centroid, shape, mode, g.outerCorners);
        n++; if (J(a.orbits) === J(b.orbits) && J([...a.pairToOrbitId]) === J([...b.pairToOrbitId])) eq++;
    }
    check('(6) legacy orbit tables (orbit ids, pairToOrbitId) byte-equal to the old code (' + n + ' grids)', eq === n);
}

// (5) times per call (draw budget)
{
    const T = (fn, reps) => { const t = []; for (let i = 0; i < reps; i++) { const t0 = process.hrtime.bigint(); fn(); t.push(Number(process.hrtime.bigint() - t0) / 1e6); } t.sort((a, b) => a - b); return t[reps >> 1]; };
    const out = [];
    for (const [shape, n, lage] of [['triangle', 5, 2], ['square', 5, 2], ['hex', 2, 2], ['hex', 4, 1]]) {
        const grid = { shape, ordnung: n, lage }, nodes = G('buildGridNodes')(grid, LAT);
        const cold = T(() => G('computeLineKeyTable')(nodes, grid, V2), 5);
        G('getLineKeyTable')(grid, V2);
        const keys = G('getLineKeyTable')(grid, V2).entries.slice(0, 3).map(e => e.key);
        const fmt = T(() => G('formatGridName')(grid, keys, V2), 2001), lk = T(() => G('lineKeyForPair')(G('getLineKeyTable')(grid, V2), 1, 2, V2), 2001);
        out.push(`${shape}${n}/${lage} table ${cold.toFixed(1)} ms, formatGridName ${(fmt * 1000).toFixed(1)} us, lineKeyForPair ${(lk * 1000).toFixed(1)} us`);
        check('(5) ' + shape + n + '/' + lage + ': formatGridName (3 tokens) under 0.2 ms per call, cached lookup under 0.2 ms, cold table under 1 s', fmt < 0.2 && lk < 0.2 && cold < 1000, `${cold}/${fmt}/${lk}`);
    }
    console.log('  times (median):', out.join(' | '));
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
