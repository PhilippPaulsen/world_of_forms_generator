// G6a (task 062): session schema 2 - settings.grid / sheet.grid {shape, ordnung, lage[, legacyC1]} instead of nodeCount; the fingerprint carries the spec and the free endpoints.
//   node tools/session/test-session-v2.js     BASE = the commit before 062 (default f76e5d3a); OLD_TREE = that tree already extracted (sabotage copies have no .git)
//   1. round trip (base + 4 layers + timeline + members + colours + free endpoints + alt net, and 38 more): the state after restore equals the source AND the old tree's (measure-g6a.js)
//   2. c = 1 (legacyC1) round trips, as base and as layer, and stays apart from c = 2
//   3. schema 1 is rejected deterministically ('schema-version'), the notice exists in de and en and the quarantine runs; an invalid import mutates nothing
//   4. invalid grid combinations -> invalid (and the quarantine reason), one case each; lage 2 only through allowLage2, and the plan still refuses it
//   5. the fingerprint changes with ordnung, lage, shape, a moved node, a moved free endpoint; equal for equal geometry
//   6. rollback before every apply step: same objects, gridRevision untouched; no nodeCount key anywhere in a snapshot
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'f76e5d3a';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });
const S = require('./scenarios.js'), F = require('./fixtures.js');
const { world, newCtx, uiOf, snapOf, exportOf, fakeHooks, applyInto, layeredAltNet, addLayer, same } = S;
const clone = F.clone;

// ---- 1. round trip, against the old tree ------------------------------------------------------------------------------------------------------
{
    let oldDir = process.env.OLD_TREE || null;
    if (!oldDir) {
        try {
            cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
            oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g6a-old-'));
            cp.execSync(`git archive ${BASE} | tar -x -C "${oldDir}"`, { cwd: ROOT, stdio: 'ignore' });
        } catch (e) { oldDir = null; }
    }
    const run = cwd => JSON.parse(cp.execFileSync('node', ['tools/session/measure-g6a.js'], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 }));
    const n = run(ROOT), keys = Object.keys(n);
    check('(1) every one of the ' + keys.length + ' round trips (layered alt net with 4 layers, timeline, members, colours, free endpoints; 12 bases; c = 1 layers; corpus patterns) restores and the state after equals the source', keys.length === 39 && keys.every(k => typeof n[k] === 'object' && n[k].equal === true && n[k].exp === n[k].expSrc), keys.filter(k => !(typeof n[k] === 'object' && n[k].equal)).slice(0, 3).join(' | '));
    if (oldDir) {
        fs.copyFileSync(path.join(ROOT, 'tools/session/measure-g6a.js'), path.join(oldDir, 'tools/session/measure-g6a.js'));
        const o = run(oldDir);
        check('(1) the geometry, connections, colours, timeline and export JSON after the restore equal the old tree\'s (schema 1) for all ' + keys.length + ' cases', J(o) === J(n), keys.filter(k => J(o[k]) !== J(n[k])).slice(0, 3).join(' | '));
    } else console.log('NOTE  the old tree (' + BASE + ') is not available: the comparison with it is skipped');
}

// ---- 2. c = 1 ---------------------------------------------------------------------------------------------------------------------------------
{
    let bad = [];
    for (const shape of ['triangle', 'square']) {
        const src = world(shape, 1, 3, 'none'); src.run('connections = [[1, 2]];');
        addLayer(src, { shape, order: 1, size: 3, connections: [[1, 2]], mode: 'none' });
        const snap = snapOf(src, uiOf(src, 'none', 6));
        const target = world('hex', 3, 5, 'none');
        const r = applyInto(target, snap, fakeHooks(target, snap, uiOf(target, 'none', 6)));
        const ok = r.ok && snap.settings.grid.legacyC1 === true && snap.layers[0].grid.legacyC1 === true && target.get('gridSpec.legacyC1') === true && target.get('nodeCount') === 1
            && target.get('additionalLayers[0].gridSpec.legacyC1') === true && target.get('additionalLayers[0].nodeCount') === 1 && same(snapOf(target, uiOf(target, 'none', 6)), snap);
        if (!ok) bad.push(shape);
        // c = 1 and c = 2 are different specs: another fingerprint, and a snapshot of one does not plan against the other
        const src2 = world(shape, 2, 3, 'none'); src2.run('connections = [[1, 2]];');
        const snap2 = snapOf(src2, uiOf(src2, 'none', 6));
        if (J(snap.base.nodeCheck) === J(snap2.base.nodeCheck) || snap2.settings.grid.legacyC1 !== undefined) bad.push(shape + ' vs c2');
    }
    check('(2) c = 1 (triangle, square; base and layer) round trips with its legacyC1 marker, nodeCount 1 follows, and its fingerprint differs from c = 2 (same three/four nodes)', bad.length === 0, bad.join(' | '));
}

// ---- 3. schema 1, the notice, an invalid import ----------------------------------------------------------------------------------------------------
const src = newCtx(); layeredAltNet(src, {});
const snap = Object.assign({ savedAt: 1 }, snapOf(src, uiOf(src, 'spiegeling', 6)));   // snapOf strips savedAt
const ctxV = world('square', 3, 3, 'none');
const validate = (o, opts) => ctxV.sb.validateSession(o, opts);
{
    check('(3) the constant is 2 and a snapshot of the working tree says schema 2', ctxV.get('SESSION_SCHEMA_VERSION') === 2 && snap.schema === 2 && validate(snap).ok);
    const old = clone(snap); old.schema = 1; old.settings.nodeCount = 3; delete old.settings.grid; old.layers.forEach(l => { l.nodeCount = 3; delete l.grid; });
    const r1 = validate(old), r2 = validate(clone(old)), t = ctxV.sb.parseSession(J(old));
    check('(3) a schema-1 snapshot (nodeCount, no grid) is rejected with the code schema-version, deterministically (twice the same, also through parseSession)', !r1.ok && r1.code === 'schema-version' && J(r1) === J(r2) && !t.ok && t.code === 'schema-version', J(r1));
    check('(3) schema 2 with the old nodeCount fields but no grid is invalid, not silently accepted', (o => { o.settings.nodeCount = 3; delete o.settings.grid; const r = validate(o); return !r.ok && r.code === 'invalid'; })(clone(snap)));
    // the notice: de and en, and sketch.js shows it on 'schema-version' after the quarantine
    const i18n = read('ui-i18n.js'), m = i18n.match(/'note\.session\.oldSchema': \{ de: '([^']+)', en: '([^']+)' \}/);
    check('(3) the notice \'note.session.oldSchema\' exists in German and English (non-empty, different texts)', !!m && m[1].length > 40 && m[2].length > 40 && m[1] !== m[2], m && m[1].slice(0, 30));
    const sk = read('sketch.js'), rej = (sk.match(/const reject = \(code, detail\) => \{\n\s*console\.warn[\s\S]*?\n            \};/) || [''])[0];
    check('(3) the restore\'s reject() quarantines the snapshot and then says the notice for schema-version; the page never throws', /quarantineSession\(guard\.storage, loaded\.text, sessionQuarantineReason\(code\)\)/.test(rej) && /code === 'schema-version'\) say\('session-old', .*note\.session\.oldSchema/.test(rej) && /return false;/.test(rej));
    // the store: quarantine moves the old text out of the main key
    const mem = {}; const storage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
    mem['wof:session'] = 'x';
    const q = ctxV.sb.quarantineSession(storage, J(old), 'schema-version');
    check('(3) quarantineSession(schema-version) removes the main key and keeps the text in the one quarantine slot', q.removed && q.stored && !('wof:session' in mem) && JSON.parse(mem['wof:session:quarantine']).reason === 'schema-version' && JSON.parse(mem['wof:session:quarantine']).text === J(old));
    // an invalid import changes nothing: validate is pure, and nothing is applied
    const target = world('hex', 2, 5, 'none'), pre = target.get('JSON.stringify({ currentShape, nodeCount, gridSpec, gridRevision, nodes, connections, additionalLayers })');
    const bad = clone(snap); bad.settings.grid.ordnung = 0;
    const v = target.sb.validateSession(bad);
    check('(3) an invalid import is refused by validate and leaves the live state exactly as it was (no partial mutation)', !v.ok && target.get('JSON.stringify({ currentShape, nodeCount, gridSpec, gridRevision, nodes, connections, additionalLayers })') === pre);
}

// ---- 4. invalid combinations -------------------------------------------------------------------------------------------------------------------------
{
    const tamper = (fn, opts) => { const o = clone(snap); fn(o); return validate(o, opts); };
    const cases = [
        ['triangle ordnung 2 lage 2 (lage 2 is locked in the app)', o => { o.settings.shape = 'triangle'; o.settings.grid = { shape: 'triangle', ordnung: 2, lage: 2 }; }],
        ['square ordnung 1 lage 2', o => { o.settings.shape = 'square'; o.settings.grid = { shape: 'square', ordnung: 1, lage: 2 }; }],
        ['ordnung 0', o => { o.settings.grid.ordnung = 0; }],
        ['ordnung 1.5', o => { o.settings.grid.ordnung = 1.5; }],
        ['ordnung above the shape ceiling (hex 13)', o => { o.settings.shape = 'hex'; o.settings.grid = { shape: 'hex', ordnung: 13, lage: 1 }; }],
        ['a foreign shape (pentagon)', o => { o.settings.shape = 'pentagon'; o.settings.grid = { shape: 'pentagon', ordnung: 2, lage: 1 }; }],
        ['grid shape differs from the sheet shape', o => { o.settings.grid.shape = o.settings.shape === 'hex' ? 'square' : 'hex'; }],
        ['legacyC1 on a hex', o => { o.settings.shape = 'hex'; o.settings.grid = { shape: 'hex', ordnung: 1, lage: 1, legacyC1: true }; }],
        ['an unknown key in the grid', o => { o.settings.grid.nodeCount = 3; }],
        ['a layer with lage 2', o => { o.layers[0].grid = Object.assign({}, o.layers[0].grid, { lage: 2 }); }],
        ['a layer with a missing grid', o => { delete o.layers[1].grid; }],
        ['no settings.grid', o => { delete o.settings.grid; }],
    ];
    const res = cases.map(([name, fn]) => [name, tamper(fn)]);
    res.forEach(([name, r]) => check('(4) ' + name + ' -> invalid', !r.ok && r.code === 'invalid', J(r).slice(0, 140)));
    check('(4) an invalid snapshot is quarantined under the reason \'corrupt\' (sketch.js maps code invalid to it)', /return 'corrupt'; \/\/ empty, too-large, not-json, not-an-object, invalid/.test(read('sketch.js')));
    // lage 2 only through the test option: validate accepts it, the plan still refuses (the app cannot build lage 2)
    const l2 = tamper(o => { o.settings.grid = { shape: o.settings.shape, ordnung: 2, lage: 2 }; }, { allowLage2: true });
    const planCtx = world('hex', 3, 3, 'none');
    const pl = l2.ok ? planCtx.sb.planSessionRestore(l2.snapshot, { canvasW: S.CANVAS, canvasH: S.CANVAS }) : null;
    check('(4) with allowLage2 the validator accepts a lage-2 grid (tests only) and planSessionRestore refuses it: plan-error, nothing applied', l2.ok && pl && !pl.ok && pl.code === 'plan-error' && /lage-2/.test(pl.detail), pl && pl.detail);
}

// ---- 5. the fingerprint ----------------------------------------------------------------------------------------------------------------------------------
{
    const sb = world('square', 3, 3, 'none').sb;
    const g = sb.buildGrid({ shape: 'square', ordnung: 2, lage: 1 }, { sizeFactor: 3, canvasW: 600, canvasH: 600 }).nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
    const spec = { shape: 'square', ordnung: 2, lage: 1 };
    const fp = (nodes, sp) => J(sb.sessionNodeFingerprint(nodes, sp));
    const base = fp(g, spec);
    check('(5) equal geometry gives an equal fingerprint (a copy of the nodes, a copy of the spec)', base === fp(g.map(n => Object.assign({}, n)), Object.assign({}, spec)) && /^\{"count":9,"hash":"[0-9a-f]{8}"\}$/.test(base));
    check('(5) another ordnung, another lage and another shape give another fingerprint on the same nodes', [{ shape: 'square', ordnung: 3, lage: 1 }, { shape: 'square', ordnung: 2, lage: 2 }, { shape: 'hex', ordnung: 2, lage: 1 }, { shape: 'triangle', ordnung: 2, lage: 1 }].every(sp => fp(g, sp) !== base) && fp(g, undefined) !== base);
    check('(5) c = 1 (legacyC1) and c = 2 (ordnung 1) differ on the same nodes', fp(g, { shape: 'triangle', ordnung: 1, lage: 1, legacyC1: true }) !== fp(g, { shape: 'triangle', ordnung: 1, lage: 1 }));
    const moved = g.map((n, i) => (i === 4 ? Object.assign({}, n, { x: n.x + 0.5 }) : n));
    check('(5) a node moved by half a pixel changes it (the old rounding to 0.01 px is kept)', fp(moved, spec) !== base && fp(g.map((n, i) => (i === 4 ? Object.assign({}, n, { x: n.x + 0.004 }) : n)), spec) === base);
    const withFree = g.concat([{ id: 10, x: 12.5, y: 7, free: true }]);
    check('(5) a free endpoint is part of it: added, moved or with another id it changes the fingerprint, the count stays the grid count', fp(withFree, spec) !== base && fp(withFree.map(n => (n.free ? Object.assign({}, n, { x: 13 }) : n)), spec) !== fp(withFree, spec) && fp(withFree.map(n => (n.free ? Object.assign({}, n, { id: 11 }) : n)), spec) !== fp(withFree, spec) && sb.sessionNodeFingerprint(withFree, spec).count === 9);
    check('(5) sessionGridFingerprint ignores free endpoints (what a rebuilt layerGrid() is compared with) but not the spec', J(sb.sessionGridFingerprint(withFree, spec)) === J(sb.sessionGridFingerprint(g, spec)) && J(sb.sessionGridFingerprint(g, spec)) !== J(sb.sessionGridFingerprint(g, { shape: 'square', ordnung: 3, lage: 1 })));
    // in a snapshot: a grid tampered to another order does not plan (grid-mismatch), even where the node count would agree
    const t = clone(snap); t.settings.grid = Object.assign({}, t.settings.grid); // the hash was made with the original spec
    const v = validate(t);
    const pc = world('hex', 3, 3, 'none');
    const pr = pc.sb.planSessionRestore(v.snapshot, { canvasW: S.CANVAS, canvasH: S.CANVAS });
    const t2 = clone(snap); t2.layers[0].grid = Object.assign({}, t2.layers[0].grid, { ordnung: t2.layers[0].grid.ordnung + 1 });
    const v2 = validate(t2), pr2 = v2.ok ? pc.sb.planSessionRestore(v2.snapshot, { canvasW: S.CANVAS, canvasH: S.CANVAS }) : null;
    check('(5) the untouched snapshot plans; a layer grid changed to another ordnung does not (grid-mismatch naming the layer)', pr.ok && pr2 && !pr2.ok && pr2.code === 'grid-mismatch' && /layers\[0\]/.test(pr2.detail), pr2 && pr2.detail);
}

// ---- 6. rollback, no nodeCount in a snapshot ---------------------------------------------------------------------------------------------------------
{
    const text = J(snap);
    check('(6) no snapshot carries a nodeCount key any more (settings, layers, anywhere)', !/"nodeCount"/.test(text) && /"grid":\{"shape":"hex"/.test(text) && snap.layers.every(l => l.grid && l.grid.lage === 1));
    const steps = []; const dry = world('hex', 2, 5, 'none');
    applyInto(dry, snap, fakeHooks(dry, null, uiOf(dry, 'none', 6), { skipCheck: true }), { beforeStep: n => steps.push(n) });
    let bad = [], n = 0;
    for (const stepName of steps) {
        const t = world('hex', 2, 5, 'none'), tu = uiOf(t, 'none', 6);
        addLayer(t, { shape: 'triangle', order: 3, size: 3, connections: [[1, 2]], mode: 'none' });
        const pre = { layers: t.get('additionalLayers'), l0: t.get('additionalLayers[0].gridSpec'), gs: t.get('gridSpec'), nc: t.get('nodeCount'), rev: t.get('gridRevision'), nodes: t.get('nodes') };
        const res = applyInto(t, snap, fakeHooks(t, null, tu, { skipCheck: true }), { beforeStep: nm => { if (nm === stepName) throw new Error('fault before ' + nm); } });
        n++;
        const ok = res.ok === false && res.rolledBack === true && t.get('additionalLayers') === pre.layers && t.get('additionalLayers[0].gridSpec') === pre.l0 && t.get('gridSpec') === pre.gs && t.get('nodeCount') === pre.nc && t.get('gridRevision') === pre.rev && t.get('nodes') === pre.nodes;
        if (!ok) bad.push(stepName);
    }
    check('(6) a fault before each of the ' + n + ' apply steps restores the same objects (layers, specs, nodes), the same nodeCount and an UNTOUCHED gridRevision', n >= 14 && bad.length === 0, bad.join(' '));
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
