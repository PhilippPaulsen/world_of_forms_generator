// G5a (task 060): gridSpec is the ONE writable truth of the base grid; nodeCount is only its projection; every E comes from getGridDivisions.
//   node tools/grid/test-grid-g5a.js     BASE = the commit before 060 (default 88a73ecb). Sabotage runs work on a COPY of the repo tree (this file runs from its own ../..).
//   1/2. old tree (git archive BASE) and working tree run tools/grid/measure-g5a.js: grids, drawn calls, segments, export JSON, net lines, net warp, 135 morph frames: equal
//   3.   source scan: exactly ONE write of nodeCount (core/state.js projectGridSpec) in core/, sketch.js, ui*.js, gallery*.js
//   4.   getGridDivisions(fromLegacy(shape, c)) equals the old E = c - 1 for every shape and c = 1..7 (square lage 2: E = ordnung); netWarpForBase keeps its signature and c = 1 means no warp
//   5.   session round trip and rollback: gridSpec/nodeCount agree, gridRevision is neither rewound nor touched by apply
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || '88a73ecb';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ---- 1/2. behaviour against the old tree ------------------------------------------------------------------------------------------------
let haveBase = true;
try { cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' }); } catch (e) { haveBase = false; }
if (!haveBase) console.log('NOTE  commit ' + BASE + ' is not available: the old-tree comparison (1, 2) is skipped');
else {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g5a-old-'));
    cp.execSync(`git archive ${BASE} | tar -x -C "${dir}"`, { cwd: ROOT, stdio: 'ignore' });
    fs.copyFileSync(path.join(ROOT, 'tools/grid/measure-g5a.js'), path.join(dir, 'tools/grid/measure-g5a.js'));
    const run = cwd => cp.execFileSync('node', ['tools/grid/measure-g5a.js'], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
    const oldOut = JSON.parse(run(dir)), newOut = JSON.parse(run(ROOT));
    const keys = Object.keys(newOut), grids = keys.filter(k => !k.startsWith('morph/')), morphs = keys.filter(k => k.startsWith('morph/'));
    const diff = ks => ks.filter(k => JSON.stringify(oldOut[k]) !== JSON.stringify(newOut[k]));
    const threw = keys.filter(k => typeof newOut[k] === 'string');
    check('(0) the measurement itself ran: nothing threw, same keys in both trees', threw.length === 0 && JSON.stringify(Object.keys(oldOut)) === JSON.stringify(keys), threw.slice(0, 2).join(' | '));
    check('(1) grids, drawn calls, segments, export JSON, net warp and net lines equal the old tree (' + grids.length + ' cases: 3 shapes x c 1..7 x 3 sizes, nets none/single/tiled on square)', grids.length > 100 && diff(grids).length === 0, diff(grids).slice(0, 3).join(' | '));
    check('(2) morph frames t = 0 .25 .5 .75 1 equal the old tree (' + morphs.length * 5 + ' frames: 3 shapes x 3 symmetries x linear/radial/bilinear)', morphs.length === 27 && diff(morphs).length === 0, diff(morphs).slice(0, 3).join(' | '));
    const sq = newOut['square/3/3/single'];
    check('(1) the control is not vacuous: a square net has a warp (differs from none), E is the old c - 1 (c = 3 -> 2, c = 1 -> 0), the net changes the drawn calls', sq && sq.E === 2 && newOut['square/1/3/single'].E === 0 && sq.warp !== newOut['square/3/3/none'].warp && sq.drawn !== newOut['square/3/3/none'].drawn && sq.lines !== newOut['square/1/3/single'].lines);
}

// ---- 3. exactly one write of nodeCount ----------------------------------------------------------------------------------------------------
{
    const files = [];
    const walk = (d, rx) => fs.readdirSync(path.join(ROOT, d)).forEach(f => { if (rx.test(f)) files.push(path.join(d, f)); });
    walk('core', /\.js$/); walk('.', /^(sketch|gallery|gallery-render|nav|ui[\w-]*)\.js$/);
    const writes = [];
    for (const f of files) {
        read(f).split('\n').forEach((line, i) => {
            const code = line.replace(/\/\/.*$/, '');
            if (/for\s*\(\s*(let|var)\s+nodeCount\b/.test(code)) return;   // core/forms.js: the loop variable of the limit scan shadows the global
            // a write: `nodeCount =`, `nodeCount +=`, `nodeCount++` ...; not a member (layer.nodeCount, st.nodeCount), not a declaration (let/var), not a comparison, not an object key
            const re = /(^|[^.\w$])nodeCount\s*(=(?!=)|\+\+|--|\+=|-=|\*=|\/=)/g; let m;
            while ((m = re.exec(code))) {
                const before = code.slice(0, m.index + m[1].length);
                if (/\b(let|var|const)\s+$/.test(before)) continue;           // a declaration (state.js let, gallery-render.js var shim)
                writes.push(f + ':' + (i + 1));
            }
        });
    }
    check('(3) exactly one write of nodeCount in core/, sketch.js, ui*.js, gallery*.js, nav.js', writes.length === 1 && /^core[\\/]state\.js:/.test(writes[0]), writes.join(' | '));
    const st = read('core/state.js');
    check('(3) it is projectGridSpec() in core/state.js, which also sets gridSpec', /function projectGridSpec\(spec\) \{\s*const c = toLegacy\(spec\);\s*gridSpec = spec;\s*nodeCount = c;\s*\}/.test(st));
    check('(3) setGrid, rebuildGrid and the session restore all go through it; no per-frame sync (draw never mentions projectGridSpec)',
        /function setGrid[\s\S]*?projectGridSpec\(spec\)/.test(st) && /function rebuildGrid[\s\S]*?projectGridSpec\(spec\)/.test(st) && /projectGridSpec\(c\.gridSpec\)/.test(read('core/session-apply.js')) && /projectGridSpec\(Object\.assign\(\{\}, st\.grid\)\)/.test(read('core/session-apply.js'))
        && !/function draw\(\)[\s\S]{0,400}projectGridSpec/.test(read('sketch.js')));
    const producers = [];
    // core/forms.js is excluded: its `c - 1` are the builders' own lattice arithmetic (the three Lage-1 builders are byte-unchanged), not E producers
    for (const f of files.filter(f => !/^core[\\/]forms\.js$/.test(f))) read(f).split('\n').forEach((line, i) => { const code = line.replace(/\/\/.*$/, ''); if (/\bnodeCount(Value)?\s*-\s*1\b/.test(code)) producers.push(f + ':' + (i + 1)); });
    check('(3) no `nodeCount - 1` left outside comments and the builders (every E comes from getGridDivisions)', producers.length === 0, producers.join(' | '));
}

// ---- 4. getGridDivisions == the old E ----------------------------------------------------------------------------------------------------
{
    const sb = { Math, console, Number, Object, Error, Map, JSON };
    vm.createContext(sb);
    vm.runInContext(read('core/forms.js') + '\n' + read('core/netwarp.js'), sb);
    let bad = [], n = 0;
    for (const shape of ['triangle', 'square', 'hex']) for (let c = 1; c <= 7; c++) {
        n++;
        const oldE = c - 1, spec = sb.fromLegacy(shape, c);
        if (sb.getGridDivisions(spec) !== oldE) bad.push(shape + c + ':' + sb.getGridDivisions(spec));
    }
    check('(4) getGridDivisions(fromLegacy(shape, c)) === c - 1 (the old E) for 3 shapes x c = 1..7 (' + n + ' cases)', bad.length === 0, bad.join(' '));
    check('(4) triangle/square: E = ordnung (c >= 2); c = 1 (legacy marker) E = 0; hex E = ordnung - 1 (the old E)', [2, 3, 7].every(c => sb.getGridDivisions({ shape: 'square', ordnung: c - 1, lage: 1 }) === c - 1) && sb.getGridDivisions({ shape: 'square', ordnung: 1, lage: 1, legacyC1: true }) === 0 && sb.getGridDivisions({ shape: 'hex', ordnung: 4, lage: 1 }) === 3);
    check('(4) square lage 2: E = ordnung (the lage-2 grid refines the same lage-1 grid)', [1, 2, 3, 6].every(o => sb.getGridDivisions({ shape: 'square', ordnung: o, lage: 2 }) === o));
    // netWarpForBase keeps its legacy signature and its numbers: c = 1 -> E = 0 -> no warp; c >= 2 -> E = c - 1; other shapes: no warp
    const C = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }], spec = { x: { kind: 'trig', w: -1 }, y: 'same', repeat: false };
    const dump = w => JSON.stringify(w);
    let wbad = [];
    for (let c = 1; c <= 7; c++) {
        const w = sb.netWarpForBase(spec, 'square', C, c, 5), ref = sb.makeNetWarp(spec, { c0: C[0], v1: { x: 300, y: 0 }, v2: { x: 0, y: 300 } }, c - 1, 5);
        if (dump(w) !== dump(ref)) wbad.push(c);
    }
    check('(4) netWarpForBase(spec, shape, corners, c, Rt) equals makeNetWarp(..., c - 1, ...) for c = 1..7, c = 1 -> E 0 as before; hex and a missing corner list: no warp; an invalid c behaves like the old c - 1 < 1', wbad.length === 0 && sb.netWarpForBase(spec, 'hex', C, 4, 5) === null && sb.netWarpForBase(spec, 'triangle', C, 4, 5) === null && sb.netWarpForBase(spec, 'square', null, 4, 5) === null && dump(sb.netWarpForBase(spec, 'square', C, null, 5)) === dump(sb.makeNetWarp(spec, { c0: C[0], v1: { x: 300, y: 0 }, v2: { x: 0, y: 300 } }, -1, 5)), wbad.join(','));
}

// ---- 5. session round trip and rollback ---------------------------------------------------------------------------------------------------
{
    const S = require('../session/scenarios.js');
    const { world, uiOf, snapOf, fakeHooks, applyInto, same } = S;
    const agree = ctx => { const gs = ctx.get('gridSpec'), nc = ctx.get('nodeCount'); return ctx.get('toLegacy(gridSpec)') === nc && gs.shape === ctx.get('currentShape'); };
    const src = world('square', 5, 3, 'none'), target = world('hex', 3, 5, 'none');
    check('(5) after the scenario setup gridSpec and nodeCount agree in both worlds (square c 5 -> ordnung 4, hex c 3 -> ordnung 3)', agree(src) && agree(target) && src.get('gridSpec.ordnung') === 4 && target.get('gridSpec.ordnung') === 3);
    const snap = snapOf(src, uiOf(src, 'spiegeling', 6)), tui = uiOf(target, 'none', 6);
    const rev0 = target.get('gridRevision');
    const r = applyInto(target, snap, fakeHooks(target, snap, tui));
    check('(5) apply restores shape and order through gridSpec: nodeCount follows, the spec equals the source\'s, the snapshot round-trips', r.ok === true && agree(target) && same(target.get('gridSpec'), src.get('gridSpec')) && target.get('nodeCount') === 5 && same(snapOf(target, tui), snap), r.ok ? '' : JSON.stringify(r).slice(0, 160));
    check('(5) apply does not rebuild: gridRevision unchanged by a restore', target.get('gridRevision') === rev0, rev0 + ' -> ' + target.get('gridRevision'));
    const steps = []; const dry = world('hex', 3, 5, 'none');
    applyInto(dry, snap, fakeHooks(dry, null, uiOf(dry, 'none', 6), { skipCheck: true }), { beforeStep: n => steps.push(n) });
    let badRb = [], nRb = 0;
    for (const stepName of steps) {
        const t = world('hex', 3, 5, 'none'), tu = uiOf(t, 'none', 6);
        const pre = { gs: t.get('gridSpec'), nc: t.get('nodeCount'), cs: t.get('currentShape'), rev: t.get('gridRevision') };
        const res = applyInto(t, snap, fakeHooks(t, null, tu, { skipCheck: true }), { beforeStep: n => { if (n === stepName) throw new Error('fault before ' + n); } });
        nRb++;
        const ok = res.ok === false && res.rolledBack === true && t.get('gridSpec') === pre.gs && t.get('nodeCount') === pre.nc && t.get('currentShape') === pre.cs && t.get('gridRevision') === pre.rev && agree(t);
        if (!ok) badRb.push(stepName + ':' + (t.get('gridRevision') - pre.rev) + (agree(t) ? '' : ':drift'));
    }
    check('(5) a fault before each of the ' + nRb + ' apply steps rolls back to the same gridSpec object, the same nodeCount and an UNTOUCHED gridRevision (never rewound), no drift', nRb >= 6 && badRb.length === 0, badRb.join(' '));
    const t2 = world('square', 4, 3, 'none'), rv = t2.get('gridRevision');
    t2.run('setGrid({ shape: "hex", ordnung: 2, lage: 1 })');
    check('(5) setGrid still bumps gridRevision once and sets shape, gridSpec and nodeCount together', t2.get('gridRevision') === rv + 1 && agree(t2) && t2.get('currentShape') === 'hex' && t2.get('nodeCount') === 2);
    let threw = false; try { t2.run('setGrid({ shape: "hex", ordnung: 2, lage: 2 })'); } catch (e) { threw = true; }
    check('(5) lage 2 stays locked: setGrid refuses it and changes nothing', threw && t2.get('gridSpec.lage') === 1 && t2.get('gridRevision') === rv + 1);
    t2.run('projectGridSpec(fromLegacy("triangle", 1)); rebuildGrid("triangle")');
    check('(5) the legacy c = 1 marker survives rebuildGrid: gridSpec keeps legacyC1, nodeCount 1, E 0', t2.get('gridSpec.legacyC1') === true && t2.get('nodeCount') === 1 && t2.get('getGridDivisions(gridSpec)') === 0);
    t2.run('currentShape = "square"; rebuildGrid("square")');
    check('(5) a shape change keeps the ORDNUNG (task 068c3a; triangle c 1 = ordnung 1 -> square ordnung 1 = count 2) and gridSpec follows the shape', agree(t2) && t2.get('nodeCount') === 2 && t2.get('gridSpec.shape') === 'square');
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
