/**
 * tools/color/test-inherit-hook.js
 * End-to-end verification of the lazy reconciliation hook (Group D follow-up,
 * step 2) through the REAL computeCellFaces() call path - not Step 1's
 * isolated functions - on the same 258-pattern / 10,902-edit corpus
 * (tools/color/corpus.js): snapshot per sheet, reconcile-on-change, the
 * curve-mode / cleared-pattern guard, sheets without assignments costing
 * nothing, and real timing against the previous commit's code.
 *
 *   node tools/color/test-inherit-hook.js
 */
const { buildPatterns, editsOf, loadSrc } = require('./corpus.js');
const T0 = Date.now();
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sortedStore = m => JSON.stringify([...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
const PAL = { ruleId: 'isotint', idx: [0, 4] };
const pal = () => ({ ...PAL, idx: PAL.idx.slice(), overrides: new Map() });
const spy = sb => { const st = { calls: 0 }; const orig = sb.reconcileFaceAssignments; sb.reconcileFaceAssignments = function (...a) { st.calls++; return orig.apply(this, a); }; return st; };

const patterns = buildPatterns();
console.log(`corpus: ${patterns.length} patterns`);
const colored = (sh, ids) => {             // a store with every trail of the pattern colored from a palette
    const sb = sh.sb, store = new Map();
    const res = sh.faces(ids);
    sb.applyPaletteToTrails(store, sb.computeFaceTrails(res, sh.group), pal());
    return store;
};
const conns = (sh, ids) => ids.map(i => sh.reps[i]);
// an edit that leaves faces AND changes the trail-key set (adding an orbit that closes nothing new leaves the set unchanged - no reconciliation is due then)
const structuralEdit = (pat) => {
    const { sh, ids } = pat, sb = sh.sb;
    const k0 = sb.faceTrailSnapshot(sh.faces(ids), sh.group).keys;
    return editsOf(pat).find(e => { const s1 = sb.faceTrailSnapshot(sh.faces(e.ids), sh.group); return s1.faceCount && !(s1.keys.size === k0.size && [...s1.keys].every(x => k0.has(x))); });
};
const call = (sh, ids, store) => sh.sb.computeCellFaces(conns(sh, ids), sh.grid.nodes, store);

// ---------------- 1. every real edit through the real call path ----------------
console.log('\n== 1. all single-orbit edits through computeCellFaces() ==');
{
    let edits = 0, storeBad = 0, snapBad = 0, colorBad = 0, baselineBad = 0, guardSkips = 0, fired = 0, entriesWritten = 0;
    for (const pat of patterns) {
        const { sh, ids } = pat, sb = sh.sb;
        for (const ed of editsOf(pat)) {
            edits++;
            const store = colored(sh, ids);
            const ref = new Map(store);                        // reference store, driven by Step 1's functions directly
            call(sh, ids, store);                              // baseline call: records the snapshot
            const snap0 = sb.faceSnapshotFor(store);
            if (!snap0 || snap0.faceCount === 0) { baselineBad++; continue; }
            const refNew = sh.faces(ed.ids);
            const refSnap = sb.faceTrailSnapshot(refNew, sh.group);
            if (refSnap.faceCount) { sb.reconcileFaceAssignments(ref, snap0, refSnap); }
            const before = store.size;
            const out = call(sh, ed.ids, store);               // the edit, seen for the first time here
            if (sortedStore(store) !== sortedStore(ref)) storeBad++;
            if (refSnap.faceCount) {
                const s1 = sb.faceSnapshotFor(store);
                if (!s1 || s1.faceCount !== refSnap.faceCount || ![...refSnap.keys].every(k => s1.keys.has(k))) snapBad++;
                if (store.size !== before) { fired++; entriesWritten += store.size - before; }
            } else { guardSkips++; if (sb.faceSnapshotFor(store) !== snap0) snapBad++; }   // no faces: snapshot is still the baseline object
            // what is DRAWN: an assigned trail shows its entry's hex, everything else keeps the default color
            const keys = sb.computeFaceTrailKeys(out, sh.group);
            out.faces.forEach((f, i) => {
                const a = store.get(keys[i]);
                const want = a ? sb.resolveColor(sb.REF, a).hex : refNew.faces[i].color;
                if (f.color !== want) colorBad++;
            });
        }
    }
    check('corpus is the measured one (10,902 edits)', edits === 10902, `${edits}`);
    check('the first computeCellFaces() after an assignment records the baseline snapshot (every pattern)', baselineBad === 0);
    check('through the real call path the store equals Step 1\'s reference reconciliation, edit by edit', storeBad === 0, `${edits} edits, ${fired} changed the store (${entriesWritten} entries inherited)`);
    check('the snapshot follows the new real state (or stays the baseline when the edit leaves no faces)', snapBad === 0, `${guardSkips} face-less edits kept the baseline`);
    check('every drawn face carries its trail\'s entry color; unassigned faces keep the default', colorBad === 0);
}

// ---------------- 2. edit sequences, undo, redo ----------------
console.log('\n== 2. edit sequences (random walks, undo, redo) ==');
{
    const rand = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
    let steps = 0, walkBad = 0, undoBad = 0, redoBad = 0, undoRuns = 0;
    for (let w = 0; w < 200; w++) {
        const pat = patterns[Math.floor(rand() * patterns.length)], { sh } = pat, sb = sh.sb;
        let ids = pat.ids.slice();
        const store = colored(sh, ids), ref = new Map(store);
        call(sh, ids, store);
        let prevSnap = sb.faceSnapshotFor(store);
        for (let k = 0; k < 6; k++) {
            const opts = editsOf({ sh, ids }); const ed = opts[Math.floor(rand() * opts.length)]; steps++;
            const res = sh.faces(ed.ids), snap = sb.faceTrailSnapshot(res, sh.group);
            if (snap.faceCount) { const same = prevSnap.keys.size === snap.keys.size && [...snap.keys].every(x => prevSnap.keys.has(x)); if (!same) sb.reconcileFaceAssignments(ref, prevSnap, snap); prevSnap = snap; }
            call(sh, ed.ids, store); ids = ed.ids;
            if (sortedStore(store) !== sortedStore(ref)) walkBad++;
        }
    }
    check('6-step random walks: the hooked store equals the step-by-step reference chain at every step', walkBad === 0, `${steps} steps in 200 walks`);
    // undo / redo: original colors return; nothing is overwritten
    for (const pat of patterns.slice(0, 200)) {
        const { sh, ids } = pat, sb = sh.sb;
        const edits = editsOf(pat).filter(e => e.kind === 'add');
        if (!edits.length) continue;
        const store = colored(sh, ids), orig = new Map(store);
        const c0 = JSON.stringify(call(sh, ids, store).faces.map(f => f.color));
        call(sh, edits[0].ids, store);
        const afterEdit = sortedStore(store);
        undoRuns++;
        const back = call(sh, ids, store);                                    // undo
        if (JSON.stringify(back.faces.map(f => f.color)) !== c0) undoBad++;
        for (const [k, v] of orig) if (JSON.stringify(store.get(k)) !== JSON.stringify(v)) undoBad++;
        call(sh, edits[0].ids, store);                                        // redo
        if (sortedStore(store) !== afterEdit) redoBad++;                      // the entries written by the first pass are simply still there
    }
    check('Undo restores the exact original colors and leaves the original entries untouched', undoBad === 0, `${undoRuns} runs`);
    check('Redo finds the earlier inherited entries in place (no overwrite - the documented staleness trade-off)', redoBad === 0);
}

// ---------------- 3. laziness, counted ----------------
console.log('\n== 3. laziness: when does reconciliation run? ==');
{
    let emptyCalls = 0, emptySnap = 0, emptyDiff = 0, steadyCalls = 0, steadyIdent = 0, changeOk = 0, repeatCalls = 0, unchangedSetCalls = 0, unchangedSetN = 0, n = 0, m = 0;
    for (const pat of patterns.slice(0, 120)) {
        const { sh, ids } = pat, sb = sh.sb; n++;
        const st = spy(sb);
        const plain = JSON.stringify(call(sh, ids, null));
        const empty = new Map();
        for (let i = 0; i < 5; i++) if (JSON.stringify(call(sh, ids, empty)) !== plain) emptyDiff++;
        if (sb.faceSnapshotFor(empty) !== null) emptySnap++;
        emptyCalls += st.calls;
        const store = colored(sh, ids);
        call(sh, ids, store);
        const snap = sb.faceSnapshotFor(store), c0 = st.calls;
        for (let i = 0; i < 10; i++) call(sh, ids, store);
        steadyCalls += st.calls - c0; if (sb.faceSnapshotFor(store) === snap) steadyIdent++;
        const ed = structuralEdit(pat);
        if (ed) {
            m++;
            const c1 = st.calls;
            call(sh, ed.ids, store);
            if (st.calls - c1 === 1) changeOk++;
            const c2 = st.calls;
            for (let i = 0; i < 10; i++) call(sh, ed.ids, store);
            repeatCalls += st.calls - c2;
        }
    }
    check('empty store: 0 reconciliations, no snapshot kept, result identical to passing no store', emptyCalls === 0 && emptySnap === 0 && emptyDiff === 0, `${n} patterns x 5 calls`);
    check('non-empty store, unchanged geometry, 10 repeated calls: 0 reconciliations and the snapshot object is not rebuilt', steadyCalls === 0 && steadyIdent === n);
    check('a changed key set reconciles exactly once; repeating the same state adds none', changeOk === m && repeatCalls === 0, `${changeOk}/${m} first calls, ${repeatCalls} on repeats`);
    // edits that do not change the key set (an added orbit that closes no new region): no reconciliation, no snapshot rebuild
    let noChangeN = 0, noChangeCalls = 0, noChangeRebuilt = 0;
    for (const pat of patterns.slice(0, 200)) {
        const { sh, ids } = pat, sb = sh.sb;
        const k0 = sb.faceTrailSnapshot(sh.faces(ids), sh.group).keys;
        const e = editsOf(pat).find(x => { const s1 = sb.faceTrailSnapshot(sh.faces(x.ids), sh.group); return s1.faceCount && s1.keys.size === k0.size && [...s1.keys].every(y => k0.has(y)); });
        if (!e) continue;
        noChangeN++;
        const st = spy(sb), store = colored(sh, ids);
        call(sh, ids, store); const snap = sb.faceSnapshotFor(store), c0 = st.calls;
        call(sh, e.ids, store);
        noChangeCalls += st.calls - c0; if (sb.faceSnapshotFor(store) !== snap) noChangeRebuilt++;
    }
    check('an edit that leaves the trail-key set unchanged reconciles nothing and does not rebuild the snapshot', noChangeN > 0 && noChangeCalls === 0 && noChangeRebuilt === 0, `${noChangeN} such edits`);
}

// ---------------- 4. curve-mode / cleared-pattern guard, end to end ----------------
console.log('\n== 4. curve-mode detour and cleared pattern ==');
{
    // a pattern + an edit that really changes the face structure and inherits something
    let pick = null;
    for (const pat of patterns) {
        const { sh, ids } = pat, sb = sh.sb;
        for (const ed of editsOf(pat)) {
            const s0 = sb.faceTrailSnapshot(sh.faces(ids), sh.group), s1 = sb.faceTrailSnapshot(sh.faces(ed.ids), sh.group);
            if (!s1.faceCount) continue;
            const t = new Map(); sb.applyPaletteToTrails(t, sb.computeFaceTrails(sh.faces(ids), sh.group), pal());
            if (sb.reconcileFaceAssignments(t, s0, s1).inherited > 0) { pick = { pat, ed }; break; }
        }
        if (pick) break;
    }
    const { sh, ids } = pick.pat, sb = sh.sb, ed = pick.ed;
    const reference = () => { const r = colored(sh, ids); sb.reconcileFaceAssignments(r, sb.faceTrailSnapshot(sh.faces(ids), sh.group), sb.faceTrailSnapshot(sh.faces(ed.ids), sh.group)); return sortedStore(r); };
    const REF = reference();

    // (i) detour without an edit
    let store = colored(sh, ids), st = spy(sb);
    call(sh, ids, store);
    const snap0 = sb.faceSnapshotFor(store), json0 = sortedStore(store);
    sb.curveType = { kind: 'curve' };
    const inCurve = call(sh, ids, store);
    sb.curveType = { kind: 'straight' };
    check('curve mode returns no faces and leaves the snapshot object and the store untouched', inCurve.faces.length === 0 && sb.faceSnapshotFor(store) === snap0 && sortedStore(store) === json0);
    call(sh, ids, store);
    check('back in straight mode with the same pattern: no reconciliation fires, snapshot still the pre-detour one', st.calls === 0 && sb.faceSnapshotFor(store) === snap0 && sortedStore(store) === json0);

    // (ii) an edit happens DURING the detour
    store = colored(sh, ids); st = spy(sb);
    call(sh, ids, store);
    const before = sb.faceSnapshotFor(store);
    sb.curveType = { kind: 'curve' };
    call(sh, ed.ids, store); call(sh, ed.ids, store);                         // the edited pattern is only ever seen in curve mode
    check('during the detour nothing reconciles and the snapshot is still the last REAL state', st.calls === 0 && sb.faceSnapshotFor(store) === before);
    sb.curveType = { kind: 'straight' };
    call(sh, ed.ids, store);
    check('returning to straight lines reconciles the edit made during the detour, against the PRE-detour snapshot', st.calls === 1 && sortedStore(store) === REF);

    // (iii) genuinely cleared pattern
    store = colored(sh, ids); st = spy(sb);
    call(sh, ids, store);
    const base = sb.faceSnapshotFor(store);
    const cleared = sb.computeCellFaces([], sh.grid.nodes, store);
    check('a cleared pattern (zero faces, straight mode) does not replace the snapshot', cleared.faces.length === 0 && sb.faceSnapshotFor(store) === base && st.calls === 0);
    call(sh, ids, store);
    check('redrawing the same pattern after clearing reconciles nothing', st.calls === 0 && sortedStore(store) === json0);
    sb.computeCellFaces([], sh.grid.nodes, store);
    call(sh, ed.ids, store);
    check('a different pattern after clearing reconciles against the pre-clear snapshot (overlap inheritance carries over - documented consequence)', st.calls === 1 && sortedStore(store) === REF);
}

// ---------------- 5. lifecycle ----------------
console.log('\n== 5. reset, rebuild, per-sheet independence ==');
{
    const { sh, ids } = patterns[0], sb = sh.sb;
    const store = colored(sh, ids);
    call(sh, ids, store);
    check('a store has a snapshot once it holds assignments', sb.faceSnapshotFor(store) !== null);
    store.clear();                                                            // what Reset colors does
    call(sh, ids, store);
    check('Reset colors (store.clear()) drops the snapshot at the next computation', sb.faceSnapshotFor(store) === null);
    check('a brand-new store (grid rebuild) starts with no snapshot', sb.faceSnapshotFor(new Map()) === null);

    // real resetFaceColors() on the base store
    sb.baseFaceAssignments = colored(sh, ids);
    call(sh, ids, sb.baseFaceAssignments);
    const held = sb.baseFaceAssignments;
    sb.resetFaceColors('base');
    call(sh, ids, held);
    check('resetFaceColors(\'base\') clears the snapshot too (through the empty-store rule)', held.size === 0 && sb.faceSnapshotFor(held) === null);

    // two sheets, two stores: independent snapshots and independent reconciliation
    const other = patterns.find(p => p.sh === sh && p.ids.join() !== ids.join()) || patterns[1];
    const A = colored(sh, ids), B = colored(other.sh, other.ids);
    call(sh, ids, A); call(other.sh, other.ids, B);
    const sa = sb.faceSnapshotFor(A), sbB = other.sh.sb.faceSnapshotFor(B);
    const ed = structuralEdit({ sh, ids });
    call(sh, ed.ids, A);
    check('editing one sheet changes only that sheet\'s snapshot and store', sb.faceSnapshotFor(A) !== sa && other.sh.sb.faceSnapshotFor(B) === sbB);
}

// ---------------- 6. regression + real timing against the previous commit ----------------
console.log('\n== 6. regression and timing vs the previous commit (real measurements) ==');
{
    const oldPatterns = buildPatterns(loadSrc(true));
    let diffEmpty = 0, diffNull = 0, diffSteady = 0;
    const perPat = [];
    const time = (fn, reps) => { const t = process.hrtime.bigint(); for (let i = 0; i < reps; i++) fn(); return Number(process.hrtime.bigint() - t) / 1e3 / reps; };
    for (let p = 0; p < patterns.length; p++) {
        const n = patterns[p], o = oldPatterns[p];
        if (n.ids.join() !== o.ids.join() || n.sh.label !== o.sh.label) throw new Error('corpus mismatch between HEAD and working tree');
        const cn = conns(n.sh, n.ids), co = conns(o.sh, o.ids);
        if (JSON.stringify(n.sh.sb.computeCellFaces(cn, n.sh.grid.nodes, new Map())) !== JSON.stringify(o.sh.sb.computeCellFaces(co, o.sh.grid.nodes, new Map()))) diffEmpty++;
        if (JSON.stringify(n.sh.sb.computeCellFaces(cn, n.sh.grid.nodes)) !== JSON.stringify(o.sh.sb.computeCellFaces(co, o.sh.grid.nodes))) diffNull++;
        const sN = colored(n.sh, n.ids), sO = colored(o.sh, o.ids);
        if (JSON.stringify(n.sh.sb.computeCellFaces(cn, n.sh.grid.nodes, sN)) !== JSON.stringify(o.sh.sb.computeCellFaces(co, o.sh.grid.nodes, sO))) diffSteady++;
        // timings, interleaved old/new to cancel drift; 12 rounds
        const emptyN = new Map(), emptyO = new Map();
        const r = { eN: [], eO: [], sN: [], sO: [] };
        n.sh.sb.computeCellFaces(cn, n.sh.grid.nodes, sN); // baseline snapshot outside the timed region
        for (let k = 0; k < 12; k++) {
            r.eO.push(time(() => o.sh.sb.computeCellFaces(co, o.sh.grid.nodes, emptyO), 3));
            r.eN.push(time(() => n.sh.sb.computeCellFaces(cn, n.sh.grid.nodes, emptyN), 3));
            r.sO.push(time(() => o.sh.sb.computeCellFaces(co, o.sh.grid.nodes, sO), 3));
            r.sN.push(time(() => n.sh.sb.computeCellFaces(cn, n.sh.grid.nodes, sN), 3));
        }
        const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
        perPat.push({ eO: med(r.eO), eN: med(r.eN), sO: med(r.sO), sN: med(r.sN) });
    }
    check('no store / empty store: results byte-identical to the previous commit\'s (258 patterns)', diffEmpty === 0 && diffNull === 0);
    check('non-empty store, unchanged geometry: results byte-identical to the previous commit\'s', diffSteady === 0);
    const tot = k => perPat.reduce((s, x) => s + x[k], 0);
    const eRatio = tot('eN') / tot('eO'), sRatio = tot('sN') / tot('sO');
    const dEmpty = (tot('eN') - tot('eO')) / perPat.length, dSteady = (tot('sN') - tot('sO')) / perPat.length;
    console.log(`  empty store   : previous ${(tot('eO') / perPat.length).toFixed(1)} us/call, now ${(tot('eN') / perPat.length).toFixed(1)} us/call  (ratio ${eRatio.toFixed(3)}, ${dEmpty >= 0 ? '+' : ''}${dEmpty.toFixed(2)} us)`);
    console.log(`  steady store  : previous ${(tot('sO') / perPat.length).toFixed(1)} us/call, now ${(tot('sN') / perPat.length).toFixed(1)} us/call  (ratio ${sRatio.toFixed(3)}, ${dSteady >= 0 ? '+' : ''}${dSteady.toFixed(2)} us; keys are now computed once and shared)`);
    check('empty-store cost is unchanged (within 5% of the previous commit\'s, measured; the work is one WeakMap delete)', eRatio < 1.05, `ratio ${eRatio.toFixed(3)}`);
    check('steady-state cost with assignments is not worse (within 5%; shared keys offset the key-set comparison)', sRatio < 1.05, `ratio ${sRatio.toFixed(3)}`);

    // what an edit that fires costs: the hooked call vs the same call with no store at all
    const deltas = [];
    let sample = 0;
    for (const pat of patterns) {
        for (const ed of editsOf(pat)) {
            if (sample++ % 5) continue;
            const { sh, ids } = pat, sb = sh.sb;
            const store = colored(sh, ids); call(sh, ids, store);
            const c1 = conns(sh, ed.ids);
            const tBase = time(() => sb.computeCellFaces(c1, sh.grid.nodes, null), 1);
            const tHook = time(() => sb.computeCellFaces(c1, sh.grid.nodes, store), 1);      // first sight of the edit: snapshot + reconcile + apply
            deltas.push(tHook - tBase);
        }
    }
    deltas.sort((a, b) => a - b);
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    console.log(`  a firing edit costs ${mean.toFixed(0)} us extra on average (median ${deltas[deltas.length >> 1].toFixed(0)}, p95 ${deltas[Math.floor(deltas.length * 0.95)].toFixed(0)}, max ${deltas[deltas.length - 1].toFixed(0)}) over ${deltas.length} sampled edits - paid once per structural change, not per redraw`);
    check('a firing edit stays far below a frame (p95 < 20 ms extra)', deltas[Math.floor(deltas.length * 0.95)] < 20000);
}

console.log(`\n${checks - failures}/${checks} checks passed (${((Date.now() - T0) / 1000).toFixed(1)}s)`);
process.exit(failures ? 1 : 0);
