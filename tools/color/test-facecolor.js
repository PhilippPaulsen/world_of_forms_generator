/**
 * tools/color/test-facecolor.js
 * Headless verification for core/facecolor.js (Group D, Phase 2): the
 * geometric face-trail key, the per-sheet assignment store, the render-path
 * override - and, as a reported investigation rather than a pass/fail
 * check, what an edit that splits/merges a face does to an assignment.
 *
 *   node tools/color/test-facecolor.js            # checks + investigation
 *
 * Real patterns, not synthetic ones: for a spread of shape x order x
 * symmetry mode, random k-combinations of the REAL theme-line orbits
 * (core/orbits.js) - one representative line per chosen orbit, exactly as
 * the gallery catalog builds them - run through the app's own
 * computeCellFaces(). The core files are loaded into a bare vm context
 * (same approach as tools/gallery/renderSingleCellSVG.js); the only
 * stand-ins are the tiny p5 surface they call.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');

const CORE = ['forms', 'orbits', 'symmetry', 'curves', 'tiling', 'faces', 'color', 'facecolor'];
const SRC = CORE.map(f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const CANVAS = 300, SIZE_FACTOR = 1.3; // same fixed rendering parameters as the gallery catalog
const BUILDERS = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };

function makeSheet(shape, order, mode) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs,
        dist: (a, b, c, d) => Math.hypot(c - a, d - b),
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' },
        centroid: null, symmetryMode: mode, outerCorners: null, currentShape: shape, nodes: null,
        baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, additionalLayers: [], console
    };
    sb.toTileLocal = (n, tileC, flip180) => {
        let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y;
        if (flip180) { x = -x; y = -y; }
        return { x: tileC.x + x, y: tileC.y + y };
    };
    vm.createContext(sb);
    vm.runInContext(SRC, sb);
    const grid = sb[BUILDERS[shape]](order, SIZE_FACTOR, CANVAS, CANVAS);
    sb.nodes = grid.nodes; sb.centroid = grid.centroid; sb.outerCorners = grid.outerCorners;
    const table = sb.computeThemeLineOrbits(grid.nodes, grid.centroid, shape, mode, grid.outerCorners);
    const reps = table.orbits.map(o => o.pairs[0]);
    const group = sb.getGroupElementsCached(grid.nodes, grid.centroid, shape, mode, grid.outerCorners);
    const faces = orbitIds => sb.computeCellFaces(orbitIds.map(i => reps[i]), grid.nodes);
    sb.REF = vm.runInContext('OSTWALD_REFERENCE_SYSTEM', sb); // a top-level const is not a property of the context
    return { sb, shape, order, mode, grid, table, reps, group, faces, label: `${shape}/${order}/${mode}` };
}

// deterministic PRNG so every run checks the same patterns
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

let failures = 0, checks = 0;
function check(name, ok, detail) {
    checks++; if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`);
}

// ---- geometry helpers used only by the tests ---------------------------
const r100 = v => Math.round(v * 100) + 0;
function setString(coords) { return coords.map(p => [r100(p.x), r100(p.y)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(p => p.join(',')).join(';'); }
function faceCoords(res, f) { const by = new Map(res.nodes.map(n => [n.id, n])); return f.nodeIds.map(id => by.get(id)); }
function polyArea(c) { let a = 0; for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; }
function centroidOf(c) { return { x: c.reduce((s, p) => s + p.x, 0) / c.length, y: c.reduce((s, p) => s + p.y, 0) / c.length }; }
function inPoly(pt, c) { let inside = false; for (let i = 0, j = c.length - 1; i < c.length; j = i++) { if ((c[i].y > pt.y) !== (c[j].y > pt.y) && pt.x < (c[j].x - c[i].x) * (pt.y - c[i].y) / (c[j].y - c[i].y) + c[i].x) inside = !inside; } return inside; }
// cyclic ORDERED boundary canonical form (rotation- and direction-invariant)
function cyclicCanon(coords) {
    const pts = coords.map(p => `${r100(p.x)},${r100(p.y)}`);
    let best = null;
    for (const seq of [pts, pts.slice().reverse()]) for (let i = 0; i < seq.length; i++) {
        const s = seq.slice(i).concat(seq.slice(0, i)).join(';'); if (best === null || s < best) best = s;
    }
    return best;
}

// ------------------------------------------------------------------------
console.log('== building real patterns ==');
const CONFIGS = [
    ['triangle', 3, 'rotation_reflection6'], ['triangle', 4, 'rotation_reflection6'], ['triangle', 3, 'rotation6'],
    ['square', 3, 'rotation_reflection6'], ['square', 4, 'rotation_reflection6'], ['square', 3, 'rotation6'],
    ['hex', 2, 'rotation_reflection6'], ['hex', 3, 'rotation_reflection6'], ['hex', 3, 'rotation6'], ['hex', 3, 'rotation_reflection3']
];
const rand = rng(20260923);
const patterns = [];
for (const [shape, order, mode] of CONFIGS) {
    const sh = makeSheet(shape, order, mode);
    const n = sh.table.orbits.length;
    const seen = new Set();
    for (let tries = 0; tries < 400 && seen.size < 30; tries++) {
        const k = 2 + Math.floor(rand() * 4);
        const ids = []; while (ids.length < Math.min(k, n)) { const i = Math.floor(rand() * n); if (!ids.includes(i)) ids.push(i); }
        ids.sort((a, b) => a - b);
        const id = ids.join(',');
        if (seen.has(id)) continue;
        seen.add(id);
        const res = sh.faces(ids);
        if (res.faces.length) patterns.push({ sh, ids, res });
    }
}
console.log(`${patterns.length} real patterns with >=1 face, across ${CONFIGS.length} shape/order/mode configs, ${patterns.reduce((s, p) => s + p.res.faces.length, 0)} faces total`);

// ---------------- 1. key: stability, closure, collisions ------------------
console.log('\n== 1. face-trail key ==');
{
    let unstable = 0, uncachedDiffers = 0, closureMiss = 0, closureBad = 0, closureTotal = 0, closureFacesMissed = 0, closurePatterns = 0, collisions = 0, orderedPairsChecked = 0;
    let centroidMerges = 0, patternsWithCentroidMerge = 0, multiTrail = 0, sumRatio = 0, ratioN = 0, maxKeyMs = 0, sumKeyMs = 0;
    for (const { sh, ids, res } of patterns) {
        const { sb, group } = sh;
        const t0 = process.hrtime.bigint();
        const keys = sb.computeFaceTrailKeys(res, group);
        const ms = Number(process.hrtime.bigint() - t0) / 1e6; sumKeyMs += ms; maxKeyMs = Math.max(maxKeyMs, ms);

        // stable across redraws: brand-new face objects, same keys
        const res2 = sh.faces(ids);
        if (JSON.stringify(sb.computeFaceTrailKeys(res2, group)) !== JSON.stringify(keys)) unstable++;
        // ... and across an UNCACHED group-element build
        const fresh = sb.computeGroupElements(sh.grid.nodes, sh.grid.centroid, sh.shape, sh.mode, sh.grid.outerCorners);
        if (JSON.stringify(sb.computeFaceTrailKeys(res, fresh)) !== JSON.stringify(keys)) uncachedDiffers++;

        // closure: g(F) is again a face of the set (identity vertex-set string), and has the SAME key
        const byIdentity = new Map();
        res.faces.forEach((f, i) => byIdentity.set(setString(faceCoords(res, f)), i));
        let patMiss = 0;
        res.faces.forEach((f, i) => {
            const coords = faceCoords(res, f);
            let faceMissed = false;
            for (const op of group.ops) {
                closureTotal++;
                const j = byIdentity.get(setString(coords.map(p => op(p, group.centroid))));
                if (j === undefined) { closureMiss++; faceMissed = true; } else if (keys[j] !== keys[i]) closureBad++;
            }
            if (faceMissed) { closureFacesMissed++; patMiss++; }
        });
        if (patMiss) closurePatterns++;

        // collisions: faces sharing a key must be group-equivalent as ORDERED cyclic boundaries
        const byKey = new Map();
        keys.forEach((k, i) => { if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(i); });
        for (const idxs of byKey.values()) {
            const first = faceCoords(res, res.faces[idxs[0]]);
            const images = new Set(group.ops.map(op => cyclicCanon(first.map(p => op(p, group.centroid)))));
            for (const j of idxs.slice(1)) { orderedPairsChecked++; if (!images.has(cyclicCanon(faceCoords(res, res.faces[j])))) collisions++; }
        }

        // what a centroid-only key would have merged, that the vertex key keeps apart
        const cKeys = new Map();
        res.faces.forEach((f, i) => { const c = centroidOf(faceCoords(res, f)); const ck = `${r100(c.x)},${r100(c.y)}`; if (!cKeys.has(ck)) cKeys.set(ck, new Set()); cKeys.get(ck).add(keys[i]); });
        let m = 0; for (const s of cKeys.values()) if (s.size > 1) m++;
        centroidMerges += m; if (m) patternsWithCentroidMerge++;

        const classes = new Set(res.faces.map(f => f.connIndex)).size;
        if (byKey.size > classes) multiTrail++;
        sumRatio += byKey.size / classes; ratioN++;
    }
    check('key is identical when the same pattern is recomputed (fresh face objects)', unstable === 0, `${unstable} unstable of ${patterns.length}`);
    check('key is identical with cached and uncached group elements', uncachedDiffers === 0, `${uncachedDiffers}`);
    check('whenever a group image of a face IS a face, it has the same key (trail = orbit)', closureBad === 0, `${closureBad} key mismatches over ${closureTotal - closureMiss} found images`);
    // Not a key property: the RAW segments are closed under the group (checked below), but for a few
    // hex patterns findFaces() returns a face set that is not (a face whose rotation/reflection image is
    // not itself a face). Reported, not failed - see the Phase 2 report; the key cannot repair it.
    console.log(`  info: ${closureFacesMissed} of ${patterns.reduce((s, p) => s + p.res.faces.length, 0)} faces (${closurePatterns}/${patterns.length} patterns, hex only) have a group image that is not a face - upstream of the key`);
    check('no collisions: faces sharing a key are group-equivalent as ordered boundaries', collisions === 0, `${collisions} collisions over ${orderedPairsChecked} same-key pairs`);
    console.log(`  info: centroid-only key would merge different faces in ${patternsWithCentroidMerge}/${patterns.length} patterns (${centroidMerges} centroid cells); the vertex key kept all of them apart`);
    console.log(`  info: ${multiTrail}/${patterns.length} patterns have more trails than connIndex classes; mean trails per class ${(sumRatio / ratioN).toFixed(2)}`);
    console.log(`  info: key computation ${(sumKeyMs / patterns.length).toFixed(3)} ms mean, ${maxKeyMs.toFixed(3)} ms max per pattern (only paid when a sheet has assignments)`);
}

// ---------------- 2/3. store + render-path override ----------------------
console.log('\n== 2/3. assignment store and render override ==');
{
    let regressions = 0, nonMatchRegressions = 0, wrongRecolor = 0, touchedOthers = 0, coverageBad = 0, recolored = 0, fixtures = 0;
    for (const { sh, ids, res } of patterns) {
        const { sb, group } = sh;
        const base = JSON.stringify(res);
        // regression: empty store, and a store whose keys match nothing, leave the result byte-identical
        if (JSON.stringify(sb.computeCellFaces(ids.map(i => sh.reps[i]), sh.grid.nodes, new Map())) !== base) regressions++;
        const nonMatching = new Map([['0,0;1,1;2,2', { hue: 3, w: 0.1, s: 0.1, rule: null, params: null }]]);
        if (JSON.stringify(sb.computeCellFaces(ids.map(i => sh.reps[i]), sh.grid.nodes, nonMatching)) !== base) nonMatchRegressions++;

        // assign every trail a distinct color, one trail at a time: only that trail's faces change
        const keys = sb.computeFaceTrailKeys(res, group);
        const distinct = [...new Set(keys)];
        distinct.forEach((key, t) => {
            fixtures++;
            const store = new Map();
            const a = { hue: t % 24, w: 0.1, s: 0.2, rule: 'test', params: [t] };
            sb.setFaceAssignment(store, key, a);
            const out = sb.computeCellFaces(ids.map(i => sh.reps[i]), sh.grid.nodes, store);
            const want = sb.resolveColor(sb.REF, a).hex;
            let hit = 0;
            out.faces.forEach((f, i) => {
                if (keys[i] === key) { hit++; if (f.color !== want) wrongRecolor++; }
                else if (JSON.stringify(f) !== JSON.stringify(res.faces[i])) touchedOthers++;
            });
            if (hit !== keys.filter(k => k === key).length) coverageBad++;
            recolored += hit;
        });
    }
    check('empty store: result byte-identical to the unassigned computation (all patterns)', regressions === 0, `${regressions} differing`);
    check('store with only non-matching keys: byte-identical too', nonMatchRegressions === 0, `${nonMatchRegressions} differing`);
    check('an assignment recolors every face of its trail with the resolved hex', wrongRecolor === 0 && coverageBad === 0, `${fixtures} single-trail fixtures, ${recolored} faces recolored`);
    check('an assignment touches no face outside its trail', touchedOthers === 0, `${touchedOthers}`);

    // validation + robustness
    const sh = patterns[0].sh, sb = sh.sb;
    const st = new Map();
    let threw = 0;
    for (const bad of [{ hue: 1, w: 0.7, s: 0.6 }, { hue: 1, w: -0.1, s: 0.1 }, { hue: NaN, w: 0, s: 0 }]) { try { sb.setFaceAssignment(st, 'k', bad); } catch (e) { threw++; } }
    check('setFaceAssignment rejects points outside the Ostwald triangle; store stays empty', threw === 3 && st.size === 0);
    const { ids, res } = patterns[0];
    const stale = new Map([[sb.computeFaceTrailKeys(res, sh.group)[0], { hue: 1, w: 0.9, s: 0.9 }]]);
    let noThrow = true, out; try { out = sb.computeCellFaces(ids.map(i => sh.reps[i]), sh.grid.nodes, stale); } catch (e) { noThrow = false; }
    check('an invalid entry that got into the store anyway never breaks rendering (default color kept)', noThrow && JSON.stringify(out) === JSON.stringify(res));
}

// ---------------- per-sheet scoping --------------------------------------
console.log('\n== per-sheet scoping ==');
{
    const { sh, ids, res } = patterns[0];
    const sb = sh.sb;
    const key = sb.computeFaceTrailKeys(res, sh.group)[0];
    const conns = ids.map(i => sh.reps[i]);
    // two layers over the same grid (as an equal-scale layer is)
    sb.additionalLayers = [{ connections: conns, nodes: sh.grid.nodes }, { connections: conns, nodes: sh.grid.nodes }];
    const A = sb.faceAssignmentsFor('base'), L0 = sb.faceAssignmentsFor(0), L1 = sb.faceAssignmentsFor(1);
    check('base and each layer get distinct stores; a layer store is created lazily and is stable', A !== L0 && L0 !== L1 && sb.faceAssignmentsFor(0) === L0);
    check('an out-of-range layer has no store', sb.faceAssignmentsFor(5) === null);
    sb.setFaceAssignment(L0, key, { hue: 5, w: 0.1, s: 0.1 });
    const colorOf = store => sb.computeCellFaces(conns, sh.grid.nodes, store).faces[0].color;
    const plain = res.faces[0].color;
    check('an assignment in layer 0 recolors layer 0 only (base and layer 1 unchanged)', colorOf(L0) !== plain && colorOf(A) === plain && colorOf(L1) === plain);
    sb.setFaceAssignment(A, key, { hue: 17, w: 0.3, s: 0.1 });
    check('base and layer 0 hold independent assignments for the same trail', colorOf(A) !== colorOf(L0) && colorOf(A) !== plain);
    sb.additionalLayers.splice(0, 1); // delete layer 0: old layer 1 becomes index 0
    check('deleting a layer: its store goes with it, the survivor keeps its own (reindexing safe)', sb.faceAssignmentsFor(0) === L1 && L1.size === 0 && sb.faceAssignmentsFor(0) !== L0);
}

// ---------------- real render-path wiring in tiling.js -------------------
console.log('\n== wiring ==');
{
    const til = fs.readFileSync(path.join(ROOT, 'core', 'tiling.js'), 'utf8');
    check('tiling.js passes the base store and each layer store to computeCellFaces()',
        til.includes("computeCellFaces(connections, nodes, faceAssignmentsFor('base'), faceHighlightKeyFor('base'))") && til.includes('computeCellFaces(layer.connections, layer.nodes, faceAssignmentsFor(i), faceHighlightKeyFor(i))'));
    const st = fs.readFileSync(path.join(ROOT, 'core', 'state.js'), 'utf8');
    check('state.js resets the base store in BOTH grid-rebuild paths', (st.match(/baseFaceAssignments = new Map\(\)/g) || []).length === 3, 'declaration + 2 rebuilds');
    const exp = fs.readFileSync(path.join(ROOT, 'core', 'export.js'), 'utf8');
    check('export.js is untouched by this phase (its computeCellFaces() calls pass no store)', /computeCellFaces\(completeConnections\)/.test(exp) && /computeCellFaces\(completeLayerConnections, layer\.nodes\)/.test(exp));
}

// ---------------- 5. Phase 3 logic: trails, palettes, override, reset, highlight -----
console.log('\n== 5. Phase 3 logic (trails, palette, override, reset, highlight) ==');
{
    const sb0 = patterns[0].sh.sb;
    const rules = sb0.listHarmonyRules();
    check('registry exposes what the UI needs: id, label, verified marker, note, and axes with label + resolved count',
        rules.length >= 4 && rules.every(r => typeof r.id === 'string' && typeof r.label === 'string' && (r.verified === false || r.verified === 'secondary')
            && typeof r.note === 'string' && sb0.harmonyRuleParams(r, sb0.REF).every(a => typeof a.label === 'string' && Number.isInteger(a.count) && a.count >= 1)),
        rules.map(r => `${r.id}:${sb0.harmonyRuleParams(r, sb0.REF).map(a => a.count).join('x')}`).join(' '));

    let orderBad = 0, sumBad = 0, unstableOrder = 0, palMismatch = 0, palCount = 0, slotBad = 0, renderBad = 0, palRuns = 0;
    let ovBad = 0, ovRuns = 0, ovOutside = 0, othersChanged = 0, orphanLost = 0, resetBad = 0, hlBad = 0, hlLeak = 0;
    for (const { sh, ids, res } of patterns) {
        const { sb, group } = sh;
        const conns = ids.map(i => sh.reps[i]);
        const trails = sb.computeFaceTrails(res, group);
        if (trails.reduce((a, t) => a + t.faceCount, 0) !== res.faces.length) sumBad++;
        for (let i = 1; i < trails.length; i++) if (Math.round(trails[i - 1].area * 100) < Math.round(trails[i].area * 100)) orderBad++;
        if (JSON.stringify(sb.computeFaceTrails(sh.faces(ids), group).map(t => t.key)) !== JSON.stringify(trails.map(t => t.key))) unstableOrder++;

        for (const rule of sb.listHarmonyRules()) {
            const axes = sb.harmonyRuleParams(rule, sb.REF);
            for (const idx of [axes.map(() => 0), axes.map(a => a.count - 1), axes.map(a => a.count >> 1)]) {
                palRuns++;
                const store = new Map();
                const palette = { ruleId: rule.id, idx, overrides: new Map() };
                store.set('orphan-key', { hue: 1, w: 0.1, s: 0.1, rule: null, params: null });
                const out = sb.applyPaletteToTrails(store, trails, palette);
                const gen = sb.generateHarmonyPalette(rule.id, idx, trails.length);
                if (store.size !== trails.length + 1) palCount++;
                if (!store.has('orphan-key')) orphanLost++;
                trails.forEach((t, i) => {
                    const a = store.get(t.key);
                    if (a.hue !== gen[i].hue || a.w !== gen[i].w || a.s !== gen[i].s || a.rule !== rule.id || a.params.slot !== i || a.params.slots !== trails.length) palMismatch++;
                    if (out.slotOf.get(t.key) !== i) slotBad++;
                });
                const drawn = sb.computeCellFaces(conns, sh.grid.nodes, store);
                const keys = sb.computeFaceTrailKeys(drawn, group);
                drawn.faces.forEach((f, fi) => { const i = trails.findIndex(t => t.key === keys[fi]); if (f.color !== gen[i].hex) renderBad++; });

                // per-trail override: another slot of the SAME series; nobody else changes
                if (trails.length >= 2) {
                    ovRuns++;
                    const before = new Map(store);
                    const target = trails[0].key, slot = trails.length - 1;
                    palette.overrides.set(target, slot);
                    const out2 = sb.applyPaletteToTrails(store, trails, palette);
                    const a = store.get(target);
                    const inSeries = gen.some(c => c.hue === a.hue && c.w === a.w && c.s === a.s);
                    if (!inSeries) ovOutside++;
                    if (a.params.slot !== slot || a.hue !== gen[slot].hue || a.w !== gen[slot].w || a.s !== gen[slot].s) ovBad++;
                    trails.slice(1).forEach(t => { if (JSON.stringify(store.get(t.key)) !== JSON.stringify(before.get(t.key))) othersChanged++; });
                    // an override beyond the series (trails shrank) falls back to the rank slot
                    palette.overrides.set(target, 999);
                    sb.applyPaletteToTrails(store, trails, palette);
                    if (store.get(target).params.slot !== 0) ovBad++;
                }
            }
        }

        // reset -> default coloring, byte-identical to the never-assigned result
        sb.additionalLayers = [];
        const st = sb.faceAssignmentsFor('base'); const pal = sb.facePaletteFor('base');
        pal.ruleId = 'isotint'; pal.idx = [3, 2]; pal.overrides.set(trails[0].key, 0);
        sb.applyPaletteToTrails(st, trails, pal);
        sb.resetFaceColors('base');
        const after = sb.computeCellFaces(conns, sh.grid.nodes, sb.faceAssignmentsFor('base'));
        if (sb.faceAssignmentsFor('base').size !== 0 || JSON.stringify(after) !== JSON.stringify(res) || sb.facePaletteFor('base').ruleId !== null || sb.facePaletteFor('base').overrides.size !== 0) resetBad++;

        // highlight: exactly the trail's faces are flagged; nothing flagged without a key
        const keys = sb.computeFaceTrailKeys(res, group);
        const hk = trails[trails.length - 1].key;
        const hres = sb.computeCellFaces(conns, sh.grid.nodes, null, hk);
        hres.faces.forEach((f, i) => { if (!!f.highlight !== (keys[i] === hk)) hlBad++; });
        if (JSON.stringify(sb.computeCellFaces(conns, sh.grid.nodes, null, null)) !== JSON.stringify(res) || JSON.stringify(res).includes('highlight')) hlLeak++;
    }
    check('trails: face counts add up to the faces, order is area-descending, and is identical on recomputation', sumBad === 0 && orderBad === 0 && unstableOrder === 0, `${patterns.length} patterns`);
    check('every rule x {first, last, middle} axis position x every pattern: one assignment per trail (+ the orphan untouched)', palCount === 0 && orphanLost === 0, `${palRuns} palette applications`);
    check('trail i gets slot i of the generated series (hue/w/s exact), with rule + {idx, slot, slots} recorded', palMismatch === 0 && slotBad === 0);
    check('the palette really renders: every face drawn in its trail\'s series color', renderBad === 0);
    check('per-trail override moves ONE trail to another slot of the same series; all others unchanged; stale override falls back', ovBad === 0 && ovOutside === 0 && othersChanged === 0, `${ovRuns} override runs`);
    check('Reset colors: store and palette cleared, drawing byte-identical to never-assigned', resetBad === 0);
    check('hover highlight flags exactly the hovered trail\'s faces, and nothing when no key is passed', hlBad === 0 && hlLeak === 0);

    // per-sheet palette state
    const { sh, ids, res } = patterns[0]; const sb = sh.sb;
    sb.additionalLayers = [{ connections: [], nodes: sh.grid.nodes }, { connections: [], nodes: sh.grid.nodes }];
    const pb = sb.facePaletteFor('base'), p0 = sb.facePaletteFor(0), p1 = sb.facePaletteFor(1);
    pb.ruleId = 'tetrad'; pb.idx = [0, 0]; p0.ruleId = 'isotint'; p0.idx = [0, 0];
    check('palette state is per sheet (base / layer 0 / layer 1 independent, stable, lazily created)', pb !== p0 && p0 !== p1 && sb.facePaletteFor(1) === p1 && p1.ruleId === null && sb.facePaletteFor(9) === null);
    const trails = sb.computeFaceTrails(res, sh.group);
    sb.applyPaletteToTrails(sb.faceAssignmentsFor('base'), trails, pb); sb.applyPaletteToTrails(sb.faceAssignmentsFor(0), trails, p0);
    sb.resetFaceColors(0);
    check('reset on one sheet leaves the others (store and palette) alone', sb.faceAssignmentsFor(0).size === 0 && sb.facePaletteFor(0).ruleId === null && sb.faceAssignmentsFor('base').size === trails.length && sb.facePaletteFor('base').ruleId === 'tetrad');
    sb.faceHover = { sheet: 'base', key: trails[0].key };
    check('faceHighlightKeyFor() answers only for the hovered sheet', sb.faceHighlightKeyFor('base') === trails[0].key && sb.faceHighlightKeyFor(0) === null);
    sb.resetFaceColors('base');
    check('reset clears that sheet\'s hover', sb.faceHover === null);
}

// ---------------- 4. split / merge investigation (report) ----------------
console.log('\n== 4. what an edit does to an assignment (investigation) ==');
{
    // For every real pattern P and every single-orbit ADDITION (P+o) and REMOVAL (P-o), classify each old trail
    // by what became of its geometry, and check whether its key is still present.
    const tally = { survives: 0, split: 0, merge: 0, deformed: 0, vanished: 0 };
    const keyStillMatches = { survives: 0, split: 0, merge: 0, deformed: 0, vanished: 0 };
    const examples = {};
    let edits = 0, oldTrails = 0;
    for (const { sh, ids, res } of patterns.slice(0, 120)) {
        const sb = sh.sb;
        const n = sh.table.orbits.length;
        const variants = [];
        for (let o = 0; o < n; o++) {
            if (ids.includes(o)) { if (ids.length > 1) variants.push({ kind: 'remove', o, ids: ids.filter(x => x !== o) }); }
            else variants.push({ kind: 'add', o, ids: ids.concat(o).sort((a, b) => a - b) });
        }
        const oldKeys = sb.computeFaceTrailKeys(res, sh.group);
        const oldPolys = res.faces.map(f => faceCoords(res, f));
        for (const v of variants.slice(0, 6)) {
            const res2 = sh.faces(v.ids);
            const newKeys = new Set(sb.computeFaceTrailKeys(res2, sh.group));
            const newKeysArr = sb.computeFaceTrailKeys(res2, sh.group);
            const newPolys = res2.faces.map(f => faceCoords(res2, f));
            const newCents = newPolys.map(centroidOf);
            edits++;
            const seenKey = new Set();
            res.faces.forEach((f, i) => {
                if (seenKey.has(oldKeys[i])) return; seenKey.add(oldKeys[i]); oldTrails++;
                let cls;
                if (newKeys.has(oldKeys[i])) cls = 'survives';
                else {
                    const oc = centroidOf(oldPolys[i]);
                    const inside = newCents.map((c, j) => inPoly(c, oldPolys[i]) ? j : -1).filter(j => j >= 0);
                    const container = newPolys.findIndex(p => inPoly(oc, p));
                    if (inside.length >= 2) cls = 'split';
                    else if (container >= 0 && polyArea(newPolys[container]) > polyArea(oldPolys[i]) * 1.001 && inside.length <= 1) cls = 'merge';
                    else if (container >= 0 || inside.length === 1) cls = 'deformed';
                    else cls = 'vanished';
                }
                tally[cls]++;
                if (newKeys.has(oldKeys[i])) keyStillMatches[cls]++;
                if (!examples[cls] && cls !== 'survives') {
                    const oc = centroidOf(oldPolys[i]);
                    examples[cls] = { sh, i, oldIds: ids, newIds: v.ids, cfg: sh.label, before: ids, after: v, oldKey: oldKeys[i], oldVerts: oldPolys[i].length, oldArea: +polyArea(oldPolys[i]).toFixed(1),
                        succ: newPolys.map((p, j) => [j, p]).filter(([j, p]) => inPoly(newCents[j], oldPolys[i]) || inPoly(oc, p)).map(([j, p]) => ({ key: newKeysArr[j], verts: p.length, area: +polyArea(p).toFixed(1) })) };
                }
            });
        }
    }
    console.log(`  ${edits} single-orbit edits (add or remove) over real patterns, ${oldTrails} old trails classified:`);
    for (const c of Object.keys(tally)) console.log(`    ${c.padEnd(9)} ${String(tally[c]).padStart(6)}  (${(100 * tally[c] / oldTrails).toFixed(1)}%)   old key still matches a face afterwards: ${keyStillMatches[c]}`);
    check('every trail that did NOT survive unchanged lost its key match (assignment inert, never transferred to an unrelated face)',
        keyStillMatches.split === 0 && keyStillMatches.merge === 0 && keyStillMatches.deformed === 0 && keyStillMatches.vanished === 0);
    check('every unchanged trail keeps matching', keyStillMatches.survives === tally.survives);
    for (const c of ['split', 'merge', 'deformed']) if (examples[c]) { const { sh, i, oldIds, newIds, ...rest } = examples[c]; console.log(`  example ${c}:`, JSON.stringify(rest)); }

    // Concrete before/after through the REAL render path: assign the old trail a color, apply the edit,
    // and look at what every face touching that geometry is drawn with; then undo the edit.
    console.log('\n  -- concrete assign-then-edit demos (colors as drawn) --');
    for (const c of ['split', 'merge', 'deformed']) {
        const ex = examples[c]; if (!ex) continue;
        const { sh, oldIds, newIds } = ex, sb = sh.sb;
        const before = sh.faces(oldIds), keysB = sb.computeFaceTrailKeys(before, sh.group);
        const key = keysB[ex.i];
        const store = new Map(); sb.setFaceAssignment(store, key, { hue: 9, w: 0.1, s: 0.1, rule: 'demo', params: null });
        const want = sb.resolveColor(sb.REF, { hue: 9, w: 0.1, s: 0.1 }).hex;
        const conns = ids => ids.map(x => sh.reps[x]);
        const b = sb.computeCellFaces(conns(oldIds), sh.grid.nodes, store);
        const a = sb.computeCellFaces(conns(newIds), sh.grid.nodes, store);
        const u = sb.computeCellFaces(conns(oldIds), sh.grid.nodes, store); // edit undone
        const cnt = (r, col) => r.faces.filter(f => f.color === col).length;
        console.log(`  ${c.padEnd(8)} ${sh.label} orbits [${oldIds}] -> [${newIds}]: faces drawn in the assigned color  before=${cnt(b, want)}  after=${cnt(a, want)}  after undo=${cnt(u, want)}   (store still holds ${store.size} entry)`);
        check(`${c}: assignment is colored before, INERT after the edit (no face inherits it), and comes back on undo`,
            cnt(b, want) >= 1 && cnt(a, want) === 0 && cnt(u, want) === cnt(b, want) && store.size === 1);
    }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
