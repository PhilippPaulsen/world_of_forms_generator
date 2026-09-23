/**
 * tools/color/test-inherit.js
 * Headless verification of the edit-inheritance logic in core/facecolor.js
 * (faceTrailSnapshot / classifyTrailTransitions / reconcileFaceAssignments) on the
 * real edit corpus: the same 258 patterns as test-facecolor.js and every single-
 * orbit edit of each - 10,902 edits (tools/color/corpus.js).
 *
 *   node tools/color/test-inherit.js
 *
 * Setup per edit: color every trail of the ORIGINAL pattern from a palette
 * (distinct slot per trail - so every merge is a genuine conflict), snapshot
 * before/after the edit, reconcile, and check the outcome against the rules.
 */
const { buildPatterns, editsOf } = require('./corpus.js');
const t0 = Date.now();
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const patterns = buildPatterns();
let edits = 0; patterns.forEach(p => { edits += editsOf(p).length; });
console.log(`corpus: ${patterns.length} patterns, ${edits} single-orbit edits`);
check('corpus is the measured one (258 patterns, 10,902 edits)', patterns.length === 258 && edits === 10902);

const kindCount = { new: 0, vanished: 0, reshape: 0, split: 0, merge: 0, complex: 0 };
const bad = { storeShrunk: 0, entryChanged: 0, childWrong: 0, mergeWinnerWrong: 0, mergeNotAParent: 0, noInheritExpected: 0, sizeMismatch: 0, notIdempotent: 0, selfNoop: 0, overwrote: 0, orderDependent: 0, unresolvedIdentical: 0 };
const identical = { total: 0, byKind: {}, resolved: 0 };
const cover = { editsWithComponents: 0, fullyInheritable: 0, newTrailsTotal: 0, newTrailsColored: 0, uncoloredNew: 0, inheritedWrites: 0 };
let preseedRuns = 0, shuffleRuns = 0, skippedEdits = 0, skippedVanishedTrails = 0;
const unresolvedKinds = {}, identicalNonReshapeCfg = new Set();

// reference oracle for the merge winner: recompute each parent's covered area straight from the
// snapshots with the overlap primitive (independent of comp.links), then order by the spec.
function oracleWinner(sb, comp, oldSnap, newSnap, store) {
    const newFaces = comp.newKeys.flatMap(k => newSnap.trails.get(k).map(i => newSnap.faces[i]));
    const cands = comp.oldKeys.filter(k => store.has(k)).map(k => {
        let area = 0;
        oldSnap.trails.get(k).forEach(i => { const of = oldSnap.faces[i]; if (newFaces.some(nf => sb._facesOverlap(of, nf))) area += of.area; });
        const a = store.get(k);
        return { key: k, area: Math.round(area * 100), slot: (a.params && Number.isInteger(a.params.slot)) ? a.params.slot : Infinity };
    }).sort((x, y) => (y.area - x.area) || (x.slot - y.slot) || (x.key < y.key ? -1 : 1));
    return cands.length ? cands[0].key : null;
}

for (const pat of patterns) {
    const { sh, ids, res } = pat, sb = sh.sb;
    sb._facesOverlap = sb._facesOverlap || ((a, b) => a.samples.some(p => sb.pointInPolygon(p, b.poly)) || b.samples.some(p => sb.pointInPolygon(p, a.poly)));
    const oldSnap = sb.faceTrailSnapshot(res, sh.group);
    const oldTrails = sb.computeFaceTrails(res, sh.group);
    for (const ed of editsOf(pat)) {
        const res2 = sh.faces(ed.ids);
        const newSnap = sb.faceTrailSnapshot(res2, sh.group);

        const store = new Map();
        const pal = { ruleId: 'isotint', idx: [0, 4], overrides: new Map() };
        sb.applyPaletteToTrails(store, oldTrails, pal);
        const before = new Map([...store].map(([k, v]) => [k, JSON.stringify(v)]));

        const out = sb.reconcileFaceAssignments(store, oldSnap, newSnap);
        if (out.skipped) { if (newSnap.faceCount) bad.noInheritExpected++; else { skippedEdits++; skippedVanishedTrails += oldTrails.length; } continue; } // an edit that leaves NO faces is the guard's business (below)
        let writes = 0, allInheritable = true;
        for (const c of out.components) {
            kindCount[c.kind]++;
            if (c.kind === 'new' || c.kind === 'vanished' || c.kind === 'complex') allInheritable = false;
            const written = c.written || [];
            writes += written.length;
            if (c.kind === 'reshape' || c.kind === 'split') {
                const parent = store.get(c.oldKeys[0]);
                if (!c.newKeys.every(k => store.has(k) && eq(store.get(k), parent))) bad.childWrong++;
                if (written.length !== c.newKeys.length) bad.childWrong++;
            } else if (c.kind === 'merge') {
                const w = oracleWinner(sb, c, oldSnap, newSnap, store);
                if (c.winner !== w) bad.mergeWinnerWrong++;
                const child = store.get(c.newKeys[0]);
                if (!child || !c.oldKeys.some(k => eq(store.get(k), child))) bad.mergeNotAParent++;
                if (child && w && !eq(child, store.get(w))) bad.mergeWinnerWrong++;
            } else {
                if (c.newKeys.some(k => store.has(k)) || written.length) bad.noInheritExpected++;   // new / vanished / complex: nothing inherited
            }
            // identical-region key breaks: a lost trail and a new trail whose per-face area is the same
            for (const ok of c.oldKeys) for (const nk of c.newKeys) {
                const linked = c.links.some(([i, j]) => oldSnap.faces[i].key === ok && newSnap.faces[j].key === nk);
                if (!linked) continue;
                const oa = oldSnap.trails.get(ok).reduce((s, i) => s + oldSnap.faces[i].area, 0) / oldSnap.trails.get(ok).length;
                const na = newSnap.trails.get(nk).reduce((s, i) => s + newSnap.faces[i].area, 0) / newSnap.trails.get(nk).length;
                if (Math.abs(na / oa - 1) < 1e-3) {
                    identical.total++; identical.byKind[c.kind] = (identical.byKind[c.kind] || 0) + 1;
                    if (c.kind !== 'reshape') identicalNonReshapeCfg.add(sh.shape);
                    const parentEntry = before.get(ok), child = store.get(nk);
                    // resolved = the new key now carries a parent's assignment (its own parent's, except a merge, where the winner's)
                    if (child && (JSON.stringify(child) === parentEntry || (c.kind === 'merge' && c.oldKeys.some(k => JSON.stringify(child) === before.get(k))))) identical.resolved++;
                    else { bad.unresolvedIdentical++; unresolvedKinds[c.kind] = (unresolvedKinds[c.kind] || 0) + 1; }
                }
            }
        }
        // store bookkeeping: nothing removed, nothing changed, growth == writes
        for (const [k, v] of before) { if (!store.has(k)) bad.storeShrunk++; else if (JSON.stringify(store.get(k)) !== v) bad.entryChanged++; }
        if (store.size !== before.size + writes || out.inherited !== writes) bad.sizeMismatch++;
        // idempotence + self-reconcile
        const snapshotStore = JSON.stringify([...store]);
        sb.reconcileFaceAssignments(store, oldSnap, newSnap);
        if (JSON.stringify([...store]) !== snapshotStore) bad.notIdempotent++;
        sb.reconcileFaceAssignments(store, newSnap, newSnap);
        if (JSON.stringify([...store]) !== snapshotStore) bad.selfNoop++;

        if (out.components.length) { cover.editsWithComponents++; if (allInheritable) cover.fullyInheritable++; }
        out.components.forEach(c => { if (c.kind === 'new') { cover.newTrailsTotal += c.newKeys.length; } });
        cover.inheritedWrites += writes;

        // fill-only: pre-seed one child of the first split/reshape with a foreign entry, it must survive
        const firstSplit = out.components.find(c => (c.kind === 'split' || c.kind === 'reshape') && c.newKeys.length >= 1);
        if (firstSplit && preseedRuns < 600) {
            preseedRuns++;
            const s2 = new Map(); sb.applyPaletteToTrails(s2, oldTrails, pal);
            const foreign = { hue: 1, w: 0.05, s: 0.05, rule: 'foreign', params: null };
            const victim = firstSplit.newKeys[0];
            s2.set(victim, foreign);
            sb.reconcileFaceAssignments(s2, oldSnap, newSnap);
            if (!eq(s2.get(victim), foreign)) bad.overwrote++;
            const others = firstSplit.newKeys.slice(1);
            if (!others.every(k => eq(s2.get(k), store.get(firstSplit.oldKeys[0])))) bad.overwrote++;
        }
        // order independence: same edit from face lists in reverse order
        if (out.components.length && shuffleRuns < 600) {
            shuffleRuns++;
            const rev = r => ({ nodes: r.nodes, faces: r.faces.slice().reverse() });
            const s3 = new Map(); sb.applyPaletteToTrails(s3, oldTrails, pal);
            sb.reconcileFaceAssignments(s3, sb.faceTrailSnapshot(rev(res), sh.group), sb.faceTrailSnapshot(rev(res2), sh.group));
            if (JSON.stringify([...s3].sort()) !== JSON.stringify([...store].sort())) bad.orderDependent++;
        }
    }
}

console.log('\n== component structure (must reproduce the design measurement) ==');
console.log('  ', JSON.stringify(kindCount));
// The measurement counted 816 vanished trails; the guard skips every edit that leaves NO faces at all (106 of
// them - the patterns' last faces disappear), and the trails those edits lose are exactly the missing 247.
check('component counts equal the recorded measurement: new 9985, reshape 2207, split 19221, merge 905, complex 240 - and vanished 569 + 247 in guard-skipped edits = the measured 816',
    kindCount.new === 9985 && kindCount.reshape === 2207 && kindCount.split === 19221 && kindCount.merge === 905 && kindCount.complex === 240
    && kindCount.vanished === 569 && kindCount.vanished + skippedVanishedTrails === 816,
    `${Object.values(kindCount).reduce((a, b) => a + b, 0)} components; ${skippedEdits} face-less edits skipped, ${skippedVanishedTrails} trails`);

console.log('\n== inheritance rules over all edits ==');
check('reshape and split: EVERY child holds the parent\'s full assignment (hue, w, s, rule, params)', bad.childWrong === 0, `${kindCount.reshape + kindCount.split} components`);
check('merge: the child holds the winner\'s assignment; winner = largest covered area, then lowest slot, then key (independent oracle)', bad.mergeWinnerWrong === 0 && bad.mergeNotAParent === 0, `${kindCount.merge} merges`);
check('new / vanished / complex components inherit nothing', bad.noInheritExpected === 0);
check('nothing is ever deleted or changed in the store; growth equals the number of inherited children', bad.storeShrunk === 0 && bad.entryChanged === 0 && bad.sizeMismatch === 0, `${cover.inheritedWrites} entries written`);
check('idempotent (same edit twice) and self-reconciliation is a no-op', bad.notIdempotent === 0 && bad.selfNoop === 0);
check('fill-only: a child that already has an entry is never overwritten, its siblings still inherit', bad.overwrote === 0, `${preseedRuns} pre-seeded runs`);
check('independent of face order (both snapshots built from reversed face lists)', bad.orderDependent === 0, `${shuffleRuns} runs`);

console.log('\n== the identical-region key breaks (Phase 2\'s stub/T-junction case) ==');
console.log(`  ${identical.total} identical-region (lost, new) pairs across ALL component kinds:`, JSON.stringify(identical.byKind));
console.log(`  resolved ${identical.resolved}/${identical.total}; unresolved by component kind: ${JSON.stringify(unresolvedKinds)}; outside 1->1 they occur only in: ${[...identicalNonReshapeCfg].join(', ')}`);
check('every identical-region key break that sits in a reshape/split/merge component is resolved (new key carries an assignment)',
    bad.unresolvedIdentical === (identical.byKind.complex || 0) && Object.keys(unresolvedKinds).every(k => k === 'complex'), `${identical.resolved}/${identical.total}; the rest are in complex components, which inherit nothing by rule`);
check('1->1 count: 506 with the final sample-point overlap test (the design measurement, 505, used the vertex-mean test only)', (identical.byKind.reshape || 0) === 506, `reshape: ${identical.byKind.reshape || 0}`);
check('the identical-region breaks OUTSIDE 1->1 (25 split, 18 merge, 1 complex) are all hex - the patterns whose face set is not group-closed (Phase 2 finding)',
    (identical.byKind.split || 0) === 25 && (identical.byKind.merge || 0) === 18 && (identical.byKind.complex || 0) === 1 && [...identicalNonReshapeCfg].every(c => c === 'hex'));

// ---- guard: face-less snapshots ----
console.log('\n== guard: empty face sets are not "everything vanished" ==');
{
    const { sh, ids, res } = patterns[0], sb = sh.sb;
    const oldSnap = sb.faceTrailSnapshot(res, sh.group), trails = sb.computeFaceTrails(res, sh.group);
    const store = new Map(); sb.applyPaletteToTrails(store, trails, { ruleId: 'tetrad', idx: [0, 2], overrides: new Map() });
    const json0 = JSON.stringify([...store]);
    const empty = sb.faceTrailSnapshot({ nodes: [], faces: [] }, sh.group);
    const a = sb.reconcileFaceAssignments(store, oldSnap, empty), b = sb.reconcileFaceAssignments(store, empty, oldSnap);
    check('old -> empty and empty -> old: skipped, store untouched, no components', a.skipped && b.skipped && a.components.length === 0 && b.components.length === 0 && JSON.stringify([...store]) === json0);
    sb.curveType = { kind: 'curve' };
    const curveRes = sh.faces(ids);
    sb.curveType = { kind: 'straight' };
    const curveSnap = sb.faceTrailSnapshot(curveRes, sh.group);
    const c = sb.reconcileFaceAssignments(store, oldSnap, curveSnap);
    check('real curve mode: computeCellFaces() returns no faces -> skipped, store untouched', curveRes.faces.length === 0 && curveSnap.faceCount === 0 && c.skipped && JSON.stringify([...store]) === json0);
    check('null/undefined snapshots are skipped, not thrown on', sb.reconcileFaceAssignments(store, null, oldSnap).skipped && sb.reconcileFaceAssignments(store, oldSnap, undefined).skipped);
}

// ---- synthetic merge tie-breaks (real merges are conflicts by construction, but exact ties are rare in the corpus) ----
console.log('\n== merge tie-breaks (constructed) ==');
{
    const sb = patterns[0].sh.sb;
    const sq = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
    const mkFace = (key, poly) => ({ key, poly, area: Math.abs((poly[1].x - poly[0].x) * (poly[2].y - poly[1].y)), samples: sb.faceSamplePoints(poly) });
    const mkSnap = faces => { const s = { faceCount: faces.length, keys: new Set(), trails: new Map(), faces }; faces.forEach((f, i) => { s.keys.add(f.key); if (!s.trails.has(f.key)) s.trails.set(f.key, []); s.trails.get(f.key).push(i); }); return s; };
    const entry = slot => ({ hue: slot, w: 0.1, s: 0.1, rule: 'r', params: { slot } });
    const merged = mkFace('M', sq(0, 0, 20, 10));
    const run = (fa, fb, ea, eb) => {
        const store = new Map(); if (ea) store.set('A', ea); if (eb) store.set('B', eb);
        const r = sb.reconcileFaceAssignments(store, mkSnap([fa, fb]), mkSnap([merged]));
        return { r, m: store.get('M') };
    };
    let x = run(mkFace('A', sq(0, 0, 10, 10)), mkFace('B', sq(10, 0, 20, 10)), entry(3), entry(1));
    check('equal areas -> the lower palette slot wins', x.r.components[0].kind === 'merge' && x.r.components[0].winner === 'B' && eq(x.m, entry(1)));
    x = run(mkFace('A', sq(0, 0, 14, 10)), mkFace('B', sq(14, 0, 20, 10)), entry(0), entry(5));
    check('larger covered area wins over a lower slot', x.r.components[0].winner === 'A' && eq(x.m, entry(0)));
    x = run(mkFace('A', sq(0, 0, 10, 10)), mkFace('B', sq(10, 0, 20, 10)), { ...entry(2), params: null }, { ...entry(2), params: null });
    check('equal area and no slots -> the smaller key wins', x.r.components[0].winner === 'A');
    x = run(mkFace('A', sq(0, 0, 10, 10)), mkFace('B', sq(10, 0, 20, 10)), null, entry(4));
    check('a parent without an assignment does not compete', x.r.components[0].winner === 'B' && eq(x.m, entry(4)));
    x = run(mkFace('A', sq(0, 0, 10, 10)), mkFace('B', sq(10, 0, 20, 10)), null, null);
    check('no parent has an assignment: nothing is written', x.r.components[0].winner === undefined && x.m === undefined && x.r.inherited === 0);
}

console.log('\n== coverage (informational) ==');
console.log(`  edits with a structural change: ${cover.editsWithComponents}; of those, every changed trail inheritable (no new region / vanished / complex): ${cover.fullyInheritable} (${(100 * cover.fullyInheritable / cover.editsWithComponents).toFixed(1)}%)`);
console.log(`  new-region trails left uncolored by design (no predecessor): ${cover.newTrailsTotal}; entries written by inheritance: ${cover.inheritedWrites}`);
console.log(`\n${checks - failures}/${checks} checks passed (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(failures ? 1 : 0);
