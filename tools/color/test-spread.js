/**
 * tools/color/test-spread.js
 * Headless verification of the Face Colors panel's step-3 logic (Group D
 * follow-up): the per-trail stepper writes ONLY its own trail (assignTrailSlot),
 * "Spread colors" fills ONLY the unassigned trails (spreadPaletteToUnassigned),
 * and both work inside the series frozen at the last full application - over
 * the same 258-pattern / 10,902-edit corpus, through the real
 * computeCellFaces() reconciliation path (an edit hands colors on first; the
 * panel logic then acts on the post-edit state).
 *
 *   node tools/color/test-spread.js
 */
const { buildPatterns, editsOf } = require('./corpus.js');
const T0 = Date.now();
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = m => new Map([...m].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));

const patterns = buildPatterns();
const RULES = [['isotint', [0, 4]], ['tetrad', [0, 2]], ['shadow-series', [3, 5]], ['isotone', [12, 1]]];
const conns = (sh, ids) => ids.map(i => sh.reps[i]);
const bad = { slotsNotFrozen: 0, spreadTouched: 0, spreadIncomplete: 0, spreadColor: 0, spreadSlotRule: 0, spreadNotIdem: 0, spreadOverrides: 0, stepOthers: 0, stepColor: 0, stepOverride: 0, stepUnassigned: 0, unassignedMismatch: 0, controlNoErase: 0 };
let edits = 0, withMissing = 0, spreadTotal = 0, stepRuns = 0, stepOnInherited = 0, stepOnUnassigned = 0, controlRuns = 0, controlErased = 0, inheritedEdits = 0;

let ri = 0;
for (const pat of patterns) {
    const { sh, ids } = pat, sb = sh.sb;
    for (const ed of editsOf(pat)) {
        edits++;
        const [ruleId, idx] = RULES[ri++ % RULES.length];
        const axes = sb.harmonyRuleParams(sb.getHarmonyRule(ruleId), sb.REF);
        const palette = { ruleId, idx: idx.map((v, a) => v % axes[a].count), overrides: new Map() };
        const store = new Map();
        const oldTrails = sb.computeFaceTrails(sh.faces(ids), sh.group);
        sb.applyPaletteToTrails(store, oldTrails, palette);                 // the panel's full application
        const N0 = oldTrails.length;
        if (palette.slots !== N0) bad.slotsNotFrozen++;
        sb.computeCellFaces(conns(sh, ids), sh.grid.nodes, store);          // baseline snapshot
        const res = sb.computeCellFaces(conns(sh, ed.ids), sh.grid.nodes, store);   // the edit: reconciliation inherits
        if (!res.faces.length) continue;
        const trails = sb.computeFaceTrails(res, sh.group);
        const missing = sb.unassignedTrails(store, trails);
        if (missing.some(t => store.has(t.key))) bad.unassignedMismatch++;
        if (trails.length - missing.length > 0 && store.size > oldTrails.length) inheritedEdits++;
        const series = sb.generateHarmonyPalette(ruleId, palette.idx, N0);
        const seriesHex = new Set(series.map(c => c.hex));
        if (palette.slots !== N0) bad.slotsNotFrozen++;                     // the edit never regenerates the series

        // ---- Spread colors ----
        if (missing.length) {
            withMissing++;
            const s = clone(store), before = clone(store), ovBefore = palette.overrides.size;
            const n = sb.spreadPaletteToUnassigned(s, trails, palette);
            spreadTotal += n;
            if (n !== missing.length) bad.spreadIncomplete++;
            trails.forEach(t => {
                if (!missing.some(m => m.key === t.key)) { if (JSON.stringify(s.get(t.key)) !== JSON.stringify(before.get(t.key))) bad.spreadTouched++; }
                else {
                    const a = s.get(t.key);
                    if (!a) { bad.spreadIncomplete++; return; }
                    if (!seriesHex.has(sb.resolveColor(sb.REF, a).hex)) bad.spreadColor++;
                    if (a.rule !== ruleId || a.params.slots !== N0 || !Number.isInteger(a.params.slot) || a.params.slot < 0 || a.params.slot >= N0 || !eq(a.params.idx, palette.idx)) bad.spreadColor++;
                }
            });
            // slot rule, replayed independently: least-used slot among colored trails, lowest on ties, list order
            const usage = new Array(N0).fill(0);
            trails.forEach(t => { const a = before.get(t.key); if (a && Number.isInteger(a.params && a.params.slot)) usage[a.params.slot]++; });
            missing.forEach(t => { const m = Math.min(...usage); const slot = usage.indexOf(m); usage[slot]++; if (s.get(t.key).params.slot !== slot) bad.spreadSlotRule++; });
            if (palette.overrides.size !== ovBefore) bad.spreadOverrides++;
            const again = JSON.stringify([...s]);
            if (sb.spreadPaletteToUnassigned(s, trails, palette) !== 0 || JSON.stringify([...s]) !== again) bad.spreadNotIdem++;
        }

        // ---- per-trail stepper ----
        if (trails.length >= 2) {
            const oldKeys = new Set(oldTrails.map(t => t.key));
            const inherited = trails.find(t => store.has(t.key) && !oldKeys.has(t.key));
            const target = inherited || trails.find(t => store.has(t.key));
            if (target) {
                stepRuns++; if (inherited) stepOnInherited++;
                const s = clone(store), before = clone(store);
                const cur = s.get(target.key).params.slot, slot = (cur + 1) % N0;
                const c = sb.assignTrailSlot(s, palette, target.key, slot);
                if (c.hex !== series[slot].hex || sb.resolveColor(sb.REF, s.get(target.key)).hex !== series[slot].hex) bad.stepColor++;
                for (const [k, v] of before) if (k !== target.key && JSON.stringify(s.get(k)) !== JSON.stringify(v)) bad.stepOthers++;
                if (s.size !== before.size) bad.stepOthers++;
                if (palette.overrides.get(target.key) !== slot) bad.stepOverride++;
                palette.overrides.delete(target.key);
            }
            if (missing.length) {
                stepOnUnassigned++;
                const s = clone(store), before = clone(store);
                sb.assignTrailSlot(s, palette, missing[0].key, 0);
                if (!s.has(missing[0].key) || s.get(missing[0].key).params.slot !== 0) bad.stepUnassigned++;
                for (const [k, v] of before) if (JSON.stringify(s.get(k)) !== JSON.stringify(v)) bad.stepOthers++;
                palette.overrides.delete(missing[0].key);
            }
        }

        // ---- negative control: the OLD stepper behavior (full re-application) really does erase inherited colors ----
        if (missing.length || store.size > oldTrails.length) {
            controlRuns++;
            const s = clone(store), before = clone(store);
            sb.applyPaletteToTrails(s, trails, { ruleId, idx: palette.idx.slice(), overrides: new Map() });
            let changed = 0; for (const t of trails) if (before.has(t.key) && JSON.stringify(before.get(t.key)) !== JSON.stringify(s.get(t.key))) changed++;
            if (changed > 0) controlErased++;
        }
    }
}

console.log(`corpus: ${patterns.length} patterns, ${edits} edits; ${withMissing} edits leave at least one trail uncolored (${spreadTotal} trails spread)`);
check('corpus is the measured one (10,902 edits)', edits === 10902);
check('the series is frozen: palette.slots equals the trail count of the last full application, and no edit regenerates it', bad.slotsNotFrozen === 0);
check('unassignedTrails() lists exactly the trails without a store entry', bad.unassignedMismatch === 0);
check('Spread colors: every unassigned trail gets a color, every already-assigned trail (inherited or not) is byte-identical after', bad.spreadIncomplete === 0 && bad.spreadTouched === 0, `${withMissing} edits`);
check('Spread colors: each new color is a member of the frozen series, with rule/idx/slot/slots recorded', bad.spreadColor === 0);
check('Spread colors: slot = least-used slot among the colored trails, lowest on ties, in list order (independent replay)', bad.spreadSlotRule === 0);
check('Spread colors: idempotent, and records no overrides (nobody chose those colors)', bad.spreadNotIdem === 0 && bad.spreadOverrides === 0);
check('per-trail stepper: exactly one store entry changes, to series[slot]; the override is recorded', bad.stepOthers === 0 && bad.stepColor === 0 && bad.stepOverride === 0, `${stepRuns} runs (${stepOnInherited} on an inherited trail)`);
check('per-trail stepper on an UNASSIGNED trail assigns that trail only', bad.stepUnassigned === 0, `${stepOnUnassigned} runs`);
check('negative control: the previous behavior (full re-application per click) does change existing entries after edits - so the fix is not vacuous', controlRuns > 0 && controlErased > 0, `${controlErased}/${controlRuns} edits`);
{
    const { sh, ids } = patterns[0], sb = sh.sb, store = new Map();
    const trails = sb.computeFaceTrails(sh.faces(ids), sh.group);
    const palette = { ruleId: 'isotint', idx: [0, 4], overrides: new Map() };
    sb.applyPaletteToTrails(store, trails, palette);
    const N = palette.slots, series = sb.generateHarmonyPalette('isotint', [0, 4], N);
    const reachable = []; for (let k = 0; k < N; k++) reachable.push(sb.resolveColor(sb.REF, (sb.assignTrailSlot(store, palette, trails[0].key, k), store.get(trails[0].key))).hex);
    check('the stepper can reach every color of the series, and only those', eq(reachable, series.map(c => c.hex)));
    const thr = f => { try { f(); return false; } catch (e) { return true; } };
    check('assignTrailSlot rejects a slot outside the series and a missing rule; spread with no rule does nothing',
        thr(() => sb.assignTrailSlot(store, palette, trails[0].key, N)) && thr(() => sb.assignTrailSlot(store, palette, trails[0].key, -1)) && thr(() => sb.assignTrailSlot(store, { ruleId: null, idx: [], overrides: new Map() }, 'k', 0, 3))
        && sb.spreadPaletteToUnassigned(new Map(), trails, { ruleId: null, idx: [], overrides: new Map() }) === 0);
}
console.log(`\n${checks - failures}/${checks} checks passed (${((Date.now() - T0) / 1000).toFixed(1)}s)`);
process.exit(failures ? 1 : 0);
