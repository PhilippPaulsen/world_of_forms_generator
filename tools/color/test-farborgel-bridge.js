/**
 * tools/color/test-farborgel-bridge.js
 * Headless verification for core/farborgel-bridge.js (Farborgel generator
 * integration, Phase A): applyHarmonyToPattern() against a REAL multi-trail
 * sheet, with the exact rigor the rest of Group D uses - independently
 * recomputed expected colors, not just "no error thrown".
 *
 *   node tools/color/test-farborgel-bridge.js
 *
 * Same loading approach as tools/color/test-facecolor.js: core files in a
 * bare vm context, a real grid/orbit table, computeCellFaces() for real
 * faces - the only stand-ins are the tiny p5 surface they call.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');

const CORE = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'farborgel-bridge'];
const SRC = CORE.map(f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const CANVAS = 300, SIZE_FACTOR = 1.3;
const BUILDERS = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };

function makeSheet(shape, order, mode) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs,
        dist: (a, b, c, d) => Math.hypot(c - a, d - b),
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, timeline: null, activeNetWarp: null,
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
    sb.REF = vm.runInContext('OSTWALD_REFERENCE_SYSTEM', sb);
    return { sb, shape, order, mode, grid, table, reps, group, faces };
}

let failures = 0, checks = 0;
function check(name, ok, detail) {
    checks++; if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ------------------------------------------------------------------------
console.log('== building one real multi-trail pattern ==');
// triangle/4/rotation_reflection6, a wide orbit spread: pick enough real
// theme-line orbits (core/orbits.js) to get several distinct trails, the
// same "real pattern, not synthetic" approach test-facecolor.js uses.
const sheet = makeSheet('triangle', 4, 'rotation_reflection6');
const allIds = sheet.table.orbits.map((_, i) => i).slice(0, 6);
const res = sheet.faces(allIds);
const trails = sheet.sb.computeFaceTrails(res, sheet.group);
console.log(`${trails.length} trails from ${res.faces.length} faces (orbits ${allIds.join(',')})`);
check('setup: the test pattern has enough trails to exercise 2/3/4-member cycling', trails.length >= 5, `${trails.length} trails`);

const resolveColor = sheet.sb.resolveColor;
const REF = sheet.sb.REF;
const applyHarmonyToPattern = sheet.sb.applyHarmonyToPattern;

// A minimal, but real-shaped, HarmonySelection member - only the fields
// applyHarmonyToPattern() reads (analyticalCoordinate.{hueIndex,w,s}), per
// color-harmony/ui/INTEGRATION_INTERFACE.md's version-1 schema.
function member(hueIndex, w, s) {
    return { analyticalCoordinate: { hueIndex, v: hueIndex === null ? 0 : 1 - w - s, w, s } };
}

// Farborgel follow-up: a member that ALSO carries a real-shaped srgb (HarmonySelection.mjs's
// own calibrated display color) - the field applyHarmonyToPattern() now additionally reads.
function memberWithDisplay(hueIndex, w, s, srgb) {
    return Object.assign(member(hueIndex, w, s), { srgb });
}
const _toHex = rgb => '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join('');

// ---------------- 1. real trail-color correctness, M = 2/3/4 --------------
console.log('\n== 1. cyclic assignment correctness (independently recomputed) ==');
{
    // hue-index picks spread across the ring, on purpose including 1 and 24
    // (the two edge cases the off-by-one bug would show at) and one gray.
    const selections = {
        2: { version: 1, source: 'farborgel', members: [member(1, 0.1, 0.1), member(13, 0.2, 0.3)] },
        3: { version: 1, source: 'farborgel', members: [member(1, 0.1, 0.1), member(13, 0.2, 0.3), member(null, 0.5, 0.5)] },
        4: { version: 1, source: 'farborgel', members: [member(1, 0.1, 0.1), member(13, 0.2, 0.3), member(null, 0.5, 0.5), member(24, 0.05, 0.05)] }
    };
    for (const M of [2, 3, 4]) {
        const selection = selections[M];
        const store = new Map();
        let threw = null;
        try { applyHarmonyToPattern(selection, store, trails); } catch (err) { threw = err; }
        check(`M=${M}: setFaceAssignment never throws for a real HarmonySelection`, threw === null, threw && threw.message);
        check(`M=${M}: every trail received an assignment`, trails.every(t => store.has(t.key)), `${store.size}/${trails.length}`);

        let cyclingOk = true, colorOk = true, provenanceOk = true;
        trails.forEach((t, i) => {
            const expectedMemberIndex = i % M;
            const c = selection.members[expectedMemberIndex].analyticalCoordinate;
            const expectedHue = c.hueIndex === null ? 0 : (((c.hueIndex - 1) % 24) + 24) % 24;
            const a = store.get(t.key);
            if (a.w !== c.w || a.s !== c.s || a.hue !== expectedHue) colorOk = false;
            // independently recomputed resolved color (calling resolveColor directly here,
            // not through the bridge) must match what got stored, and must match resolving
            // the ORIGINAL hueIndex/w/s by hand at the expected core hue.
            const stored = resolveColor(REF, a);
            const expected = resolveColor(REF, { hue: expectedHue, w: c.w, s: c.s });
            if (stored.hex !== expected.hex || !same(stored.linear, expected.linear)) colorOk = false;
            if (a.rule !== 'farborgel' || !a.params || a.params.memberIndex !== expectedMemberIndex || a.params.cardinality !== M) provenanceOk = false;
            if (a.params && a.params.memberIndex !== expectedMemberIndex) cyclingOk = false;
        });
        check(`M=${M}: cyclic member assignment is A B C ... A B C (positional, i % ${M})`, cyclingOk);
        check(`M=${M}: stored hue/w/s and resolved color match an independently recomputed expectation`, colorOk);
        check(`M=${M}: provenance is {rule:'farborgel', params:{source,memberIndex,cardinality}} per trail`, provenanceOk);
    }
}

// ---------------- 2. hue correctness: the exact off-by-one bug ------------
console.log('\n== 2. hue-index correction (the bug found in design) ==');
{
    const store = new Map();
    const selection = { version: 1, source: 'farborgel', members: [member(24, 0.1, 0.1)] };
    applyHarmonyToPattern(selection, store, [trails[0]]);
    const a = store.get(trails[0].key);
    check('hueIndex:24 maps to core hue 23 (system.hues[23], "hue 24") ...', a.hue === 23, `got hue ${a.hue}`);
    check('... NOT to core hue 0 (system.hues[0], "hue 1") - the exact wrap bug', a.hue !== 0);
    const resolvedAt23 = resolveColor(REF, { hue: 23, w: 0.1, s: 0.1 });
    const resolvedAt0 = resolveColor(REF, { hue: 0, w: 0.1, s: 0.1 });
    check('resolved color for hueIndex:24 matches hue=23, differs from hue=0 (real colors, not just indices)',
        resolveColor(REF, a).hex === resolvedAt23.hex && resolveColor(REF, a).hex !== resolvedAt0.hex,
        `stored->${resolveColor(REF, a).hex}  hue23->${resolvedAt23.hex}  hue0->${resolvedAt0.hex}`);

    const store1 = new Map();
    applyHarmonyToPattern({ version: 1, source: 'farborgel', members: [member(1, 0.2, 0.2)] }, store1, [trails[0]]);
    check('hueIndex:1 maps to core hue 0 ("hue 1", the other edge)', store1.get(trails[0].key).hue === 0, `got ${store1.get(trails[0].key).hue}`);
}

// ---------------- 3. gray correctness: measured, not just asserted --------
console.log('\n== 3. gray member: hue is provably irrelevant at v=0 (measured) ==');
{
    // A true gray: w + s = 1, so v = 1 - w - s = 0.
    const grayW = 0.63, grayS = 0.37;
    const substituteHues = [0, 5, 12, 23];
    const resolved = substituteHues.map(hue => resolveColor(REF, { hue, w: grayW, s: grayS }));
    const allIdentical = resolved.every(r => r.hex === resolved[0].hex && same(r.linear, resolved[0].linear) && same(r.srgb8, resolved[0].srgb8));
    check('resolveColor(hue, w, s) at v=0 gives BYTE-IDENTICAL results for hue in {0,5,12,23} (measured across 4 substitutions)',
        allIdentical, resolved.map(r => r.hex).join(','));

    const store = new Map();
    const selection = { version: 1, source: 'farborgel', members: [member(null, grayW, grayS)] };
    applyHarmonyToPattern(selection, store, [trails[0]]);
    const a = store.get(trails[0].key);
    check('a hueIndex:null member is stored with the FARBORGEL_GRAY_HUE_SUBSTITUTE (hue 0), not null/NaN', a.hue === 0, `got ${a.hue}`);
    check('its resolved color matches the measured gray color at every substituted hue above',
        resolveColor(REF, a).hex === resolved[0].hex);
}

// ---------------- 4. no storage-path duplication / reconciliation unaware -
console.log('\n== 4. reconciliation, split/merge and crossfade stay unaware ==');
{
    // Structural fact (code review, not a runtime check): core/farborgel-bridge.js's
    // only CALL into core/facecolor.js is setFaceAssignment() - strip comments first
    // (the docblock above names facePaletteFor() in prose, describing the gap - that
    // is not a call and must not trip this check), then look for an actual "name(" call.
    const bridgeSrc = fs.readFileSync(path.join(ROOT, 'core', 'farborgel-bridge.js'), 'utf8');
    const codeOnly = bridgeSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const forbiddenCalls = ['reconcileFaceAssignments', 'crossfadeFaceColors', 'keyframeFieldFor', 'playbackCrossfadeColors', 'facePaletteFor', 'applyAssignmentsLazily'];
    const touchesInternals = forbiddenCalls.filter(fn => codeOnly.includes(fn + '('));
    check('core/farborgel-bridge.js calls none of reconciliation/crossfade/palette internals directly (comments excluded)', touchesInternals.length === 0, touchesInternals.join(','));

    // Runtime fact, not just a source-text check: the sheet's facePalette is a
    // real, independent piece of state (facePaletteFor()) - confirm applyHarmonyToPattern()
    // truly leaves it alone (still ruleId:null after a real call), the concrete
    // meaning of "Spread colors"/the override stepper not recognizing this sheet.
    {
        const paletteBefore = JSON.stringify(sheet.sb.facePaletteFor('base'));
        applyHarmonyToPattern({ version: 1, source: 'farborgel', members: [member(5, 0.1, 0.1)] }, sheet.sb.faceAssignmentsFor('base'), trails);
        const paletteAfter = sheet.sb.facePaletteFor('base');
        check('facePaletteFor(\'base\').ruleId stays null after applyHarmonyToPattern (Spread/override stay unaware, per design)',
            paletteAfter.ruleId === null && JSON.stringify(paletteAfter) === paletteBefore, JSON.stringify(paletteAfter));
    }

    // Runtime fact: a farborgel-sourced assignment is a plain store entry, so it
    // goes through the SAME reconciliation computeCellFaces() already runs for
    // every store on every redraw - proven here by editing the pattern (a
    // different orbit selection = a structural change) and confirming surviving
    // trails keep their farborgel assignment, exactly as test-facecolor.js
    // already proved for core/color.js-sourced ones.
    const store = new Map();
    const selection2 = { version: 1, source: 'farborgel', members: [member(1, 0.1, 0.1), member(13, 0.2, 0.3)] };
    applyHarmonyToPattern(selection2, store, trails);
    const before = new Set(store.keys());
    const editedIds = allIds.slice(0, Math.max(1, allIds.length - 1)); // drop one orbit: a real structural edit
    const resEdited = sheet.faces(editedIds);
    const trailsEdited = sheet.sb.computeFaceTrails(resEdited, sheet.group);
    // computeCellFaces() with the SAME store reconciles it against the new geometry (as core/facecolor.js's
    // own applyAssignmentsLazily()/reconcileFaceAssignments() do on every redraw) - call it the same way.
    sheet.sb.computeCellFaces(editedIds.map(i => sheet.reps[i]), sheet.grid.nodes, store);
    const survivingFarborgel = trailsEdited.filter(t => store.has(t.key) && store.get(t.key).rule === 'farborgel');
    check('after a real structural edit, surviving trails keep their farborgel-sourced assignment (rule label intact)',
        survivingFarborgel.length > 0, `${survivingFarborgel.length}/${trailsEdited.length} surviving trails still farborgel-tagged`);
    check('the store never lost the pre-edit entries (orphans kept inert, per core/facecolor.js\'s own contract)',
        [...before].every(k => store.has(k)), `${[...before].filter(k => store.has(k)).length}/${before.size} kept`);
}

// ---------------- 5. displayColor: Farborgel's own calibrated color actually paints the face --
console.log('\n== 5. displayColor: real member.srgb, not a core/color.js re-resolve, is what gets painted ==');
{
    // Two visually distinct, deliberately NOT-round srgb triples - if the render path fell back
    // to resolveColor(hue,w,s) instead of using these, the painted hex could not coincidentally
    // match them (resolveColor's own gamut/mix math has no way to land on an arbitrary triple).
    const srgbA = [226, 243, 75], srgbB = [12, 34, 200];
    const selection = { version: 1, source: 'farborgel', members: [memberWithDisplay(1, 0.0355, 0.1087, srgbA), memberWithDisplay(13, 0.0355, 0.1087, srgbB)] };
    const store = new Map();
    applyHarmonyToPattern(selection, store, trails);

    check('stored displayColor === member.srgb, byte-identical, for every trail',
        trails.every((t, i) => same(store.get(t.key).displayColor, selection.members[i % 2].srgb)));
    check('hue/w/s recipe is STILL stored alongside displayColor (provenance kept, not replaced)',
        trails.every((t, i) => store.get(t.key).w === selection.members[i % 2].analyticalCoordinate.w));

    // Actually paint: computeCellFaces(..., store) is the real render-path entry point
    // (applyAssignmentsLazily -> applyFaceAssignments), exactly what core/tiling.js's
    // drawTessellation() triggers on every redraw - not a hand-rolled shortcut. The store
    // must be passed to THIS call (not a separate unassigned one) so face.color is real.
    const painted = sheet.sb.computeCellFaces(allIds.map(i => sheet.reps[i]), sheet.grid.nodes, store);
    let paintOk = true, specOk = true, notOldResolveOk = true;
    const nodeById = new Map(painted.nodes.map(n => [n.id, n]));
    trails.forEach((t, i) => {
        const expected = selection.members[i % 2].srgb;
        const expectedHex = _toHex(expected);
        // find one face of this trail among the painted result via its key
        const faceIdx = sheet.sb.computeFaceTrailKeys(painted, sheet.group).findIndex(k => k === t.key);
        if (faceIdx < 0) { paintOk = false; return; }
        const f = painted.faces[faceIdx];
        if (f.color !== expectedHex) paintOk = false;
        if (!f.colorSpec || !same(f.colorSpec.displayColor, expected)) specOk = false;
        // the color this WOULD have been under the old (pre-fix) re-resolve path, for contrast
        const a = store.get(t.key);
        const oldPathHex = resolveColor(REF, a).hex;
        if (oldPathHex === expectedHex) notOldResolveOk = false; // would only coincide by chance with this deliberately odd srgb
    });
    check('face.color === Farborgel\'s own srgb (hex), for every trail, via the REAL computeCellFaces() render path', paintOk);
    check('face.colorSpec.displayColor carries the same srgb through to export', specOk);
    check('this differs from the old core/color.js resolveColor(hue,w,s) path (proves displayColor, not a coincidental match, painted the face)', notOldResolveOk);

    // Export: faceColoringExportData must carry displayColor per entry too.
    const exportData = sheet.sb.faceColoringExportData(store, []);
    check('faceColoringExportData: every entry carries the real displayColor',
        exportData && exportData.base && exportData.base.length === store.size &&
        exportData.base.every(e => same(e.displayColor, store.get(e.trail).displayColor)));

    // Reconciliation: a structural edit must hand displayColor to inherited child faces too,
    // not just hue/w/s (same edit shape as section 4, checked for displayColor specifically here).
    const editedIds2 = allIds.slice(0, Math.max(1, allIds.length - 1));
    const resEdited2 = sheet.faces(editedIds2);
    const trailsEdited2 = sheet.sb.computeFaceTrails(resEdited2, sheet.group);
    sheet.sb.computeCellFaces(editedIds2.map(i => sheet.reps[i]), sheet.grid.nodes, store);
    const survivingWithDisplay = trailsEdited2.filter(t => store.has(t.key) && store.get(t.key).rule === 'farborgel');
    check('after a structural edit, every surviving/inherited farborgel trail still carries a valid 3-byte displayColor (not dropped by reconciliation)',
        survivingWithDisplay.length > 0 && survivingWithDisplay.every(t => Array.isArray(store.get(t.key).displayColor) && store.get(t.key).displayColor.length === 3),
        `${survivingWithDisplay.length}/${trailsEdited2.length}`);
}

// ---------------- 6. inheritance: a prior params.slot overrides the plain area rank ---------
console.log('\n== 6. inheritance (Phase B-Farbstrategien): a pre-existing params.slot wins over i ==');
{
    // No prior entries at all: every trail falls back to its own area rank i - byte-identical
    // to the pre-inheritance behavior (same assertion section 1 already made, restated here
    // explicitly as the "nothing to inherit" baseline this section's real cases are compared
    // against).
    {
        const store = new Map();
        const selection = { version: 1, source: 'farborgel', members: [member(1, 0.1, 0.1), member(13, 0.2, 0.3), member(5, 0.15, 0.15)] };
        applyHarmonyToPattern(selection, store, trails);
        const noPriorOk = trails.every((t, i) => store.get(t.key).params.memberIndex === i % 3);
        check('no prior store entries: every trail falls back to plain area rank i (unchanged baseline)', noPriorOk);
    }

    // A prior rule (NOT farborgel - e.g. a Form-mode grayscale rule) already wrote real
    // params.slot values, deliberately in a DIFFERENT order than the trails' own area rank
    // (slot = (i + 3) % trails.length, a fixed rotation - never equal to i itself for
    // trails.length > 3, so this could not pass by the old i-based behavior coinciding by
    // chance). applyHarmonyToPattern() must read THOSE slots, not recompute fresh area ranks.
    {
        const store = new Map();
        trails.forEach((t, i) => {
            const slot = (i + 3) % trails.length;
            store.set(t.key, { hue: 0, w: 0.5, s: 0.1, rule: 'max-contrast-gray', params: { idx: [0], slot, slots: trails.length }, displayColor: null });
        });
        const M = 4;
        const selection = { version: 1, source: 'farborgel', members: [member(1, 0.1, 0.1), member(7, 0.1, 0.1), member(13, 0.1, 0.1), member(19, 0.1, 0.1)] };
        applyHarmonyToPattern(selection, store, trails);
        const inheritedOk = trails.every((t, i) => {
            const expectedSlot = (i + 3) % trails.length;
            return store.get(t.key).params.memberIndex === expectedSlot % M;
        });
        check('a prior rule\'s params.slot (here, a fixed rotation, never equal to i) is what memberIndex actually follows', inheritedOk);
        check('at least one trail\'s inherited member really differs from what i % M alone would have given (the inheritance is doing real work, not a no-op)',
            trails.some((t, i) => (((i + 3) % trails.length) % M) !== (i % M)));
    }

    // The read happens BEFORE this same call's own write: a second applyHarmonyToPattern() call
    // (e.g. clicking a different harmony button right after) reads the FIRST call's own entries.
    // HISTORY (corrected): this check used to assert that A (M=2) then B (M=4) leave memberIndex
    // IDENTICAL trail for trail ("a farborgel entry inherits from the previous farborgel entry too").
    // That was the bug, not the feature: B's four members were never all used (member 2 and 3 could not
    // appear because A's 0..1 was read back as a rank). A prior farborgel memberIndex is a MEMBER number,
    // not a rank; it is only a valid pin for the same strategy AND the same cardinality (section 8
    // below). A different size starts that harmony's natural order fresh.
    {
        const store = new Map();
        const selA = { version: 1, source: 'farborgel', members: [member(1, 0.1, 0.1), member(13, 0.2, 0.3)] };
        applyHarmonyToPattern(selA, store, trails);
        const selB = { version: 1, source: 'farborgel', members: [member(2, 0.1, 0.1), member(8, 0.1, 0.1), member(14, 0.1, 0.1), member(20, 0.1, 0.1)] };
        applyHarmonyToPattern(selB, store, trails);
        const ranksAfterB = trails.map(t => store.get(t.key).params.memberIndex);
        const freshB = new Map();
        applyHarmonyToPattern(selB, freshB, trails);
        const ranksFreshB = trails.map(t => freshB.get(t.key).params.memberIndex);
        check('A (M=2) then B (M=4): B comes out exactly as if applied to an empty sheet - a different size never inherits the previous size\'s member numbers',
            JSON.stringify(ranksAfterB) === JSON.stringify(ranksFreshB), `after A=${ranksAfterB.join(',')} fresh=${ranksFreshB.join(',')}`);
        check('...and all four of B\'s members actually appear (the reported symptom: some never did)', new Set(ranksAfterB).size === Math.min(4, trails.length), `${new Set(ranksAfterB).size} distinct`);
    }
}

// ---------------- 7. distribution strategies (Phase B-Farbstrategien step 2) -----------------
console.log('\n== 7. distribution strategies: area/symmetry/rings against real patterns ==');
{
    const computeFaceTrails = sheet.sb.computeFaceTrails;
    const computeTrailRingDistances = sheet.sb.computeTrailRingDistances;

    // ---- Cyclic: the refactor must be a byte-identical extraction, not a new formula ----
    {
        for (const M of [2, 3, 4]) {
            const store = new Map();
            const sel = { version: 1, source: 'farborgel', members: Array.from({ length: M }, (_, k) => member(1 + k * 3, 0.1, 0.1)) };
            applyHarmonyToPattern(sel, store, trails, 'cyclic');
            const ok = trails.every((t, i) => store.get(t.key).params.memberIndex === i % M);
            check(`Cyclic, M=${M}: memberIndex === i % M for every trail, exactly the pre-refactor formula`, ok);
        }
        // default (no strategy argument at all) must still mean cyclic - the old call shape.
        const store = new Map();
        applyHarmonyToPattern({ version: 1, source: 'farborgel', members: [member(1, 0.1, 0.1), member(13, 0.1, 0.1)] }, store, trails);
        check('omitting the strategy argument entirely still means cyclic (old call shape unaffected)',
            trails.every((t, i) => store.get(t.key).params.memberIndex === i % 2));
    }

    // ---- A richer real pattern for Area/Symmetry/Rings: hex/2/rotation_reflection6, which has
    // THREE distinct faceCount values (a real symmetry-role mix) and enough trails to make
    // contiguous bucketing visibly different from interleaving. ----
    const hexSheet = makeSheet('hex', 2, 'rotation_reflection6');
    const hexIds = hexSheet.table.orbits.map((_, i) => i).slice(0, 5);
    const hexRes = hexSheet.faces(hexIds);
    const hexTrails = computeFaceTrails(hexRes, hexSheet.group);
    check('setup: the richer pattern has several distinct faceCount values (a real symmetry-role mix)',
        new Set(hexTrails.map(t => t.faceCount)).size >= 3, JSON.stringify([...new Set(hexTrails.map(t => t.faceCount))]));

    // ---- Area: CONTIGUOUS buckets, not interleaved - independently recomputed ----
    {
        const M = 4;
        const store = new Map();
        const sel = { version: 1, source: 'farborgel', members: Array.from({ length: M }, (_, k) => member(1 + k * 3, 0.1, 0.1)) };
        applyHarmonyToPattern(sel, store, hexTrails, 'area');
        const N = hexTrails.length;
        const bucketSize = Math.ceil(N / M);
        const expected = hexTrails.map((t, i) => Math.min(M - 1, Math.floor(i / bucketSize)));
        const actual = hexTrails.map(t => store.get(t.key).params.memberIndex);
        check('Area: every trail\'s bucket matches an independently recomputed floor(i/ceil(N/M)), clamped',
            JSON.stringify(actual) === JSON.stringify(expected), `actual=${actual.join(',')} expected=${expected.join(',')}`);
        // contiguity: once memberIndex increases along area-rank order, it must never decrease again
        let monotonic = true;
        for (let i = 1; i < actual.length; i++) if (actual[i] < actual[i - 1]) monotonic = false;
        check('Area buckets are CONTIGUOUS by area rank (monotonically non-decreasing), not interleaved like Cyclic', monotonic);
    }

    // ---- Symmetry: groups EXACTLY the trails sharing faceCount - independently recomputed ----
    {
        const M = 3;
        const store = new Map();
        const sel = { version: 1, source: 'farborgel', members: Array.from({ length: M }, (_, k) => member(1 + k * 3, 0.1, 0.1)) };
        applyHarmonyToPattern(sel, store, hexTrails, 'symmetry', { groupOpsCount: hexSheet.group.ops.length });
        // Independently recompute: for each distinct faceCount, its own trails (sorted by area
        // rank i, since none have an inherited inheritance rank here) get 0,1,2,... % M.
        const byFaceCount = new Map();
        hexTrails.forEach((t, i) => { if (!byFaceCount.has(t.faceCount)) byFaceCount.set(t.faceCount, []); byFaceCount.get(t.faceCount).push(i); });
        let groupingOk = true, ok = true;
        for (const idxs of byFaceCount.values()) {
            idxs.forEach((trailIdx, localPos) => {
                if (store.get(hexTrails[trailIdx].key).params.memberIndex !== localPos % M) ok = false;
            });
        }
        // every trail sharing a memberIndex-cycle-position within ITS OWN group must share faceCount with its groupmates (checked by construction above); additionally confirm NO cross-group contamination: two trails with DIFFERENT faceCount that happen to land on the same memberIndex must not have been forced into one shared cycle (this is structural - true by the grouping code itself, but assert group count too)
        check('Symmetry: every trail\'s memberIndex matches an independently recomputed WITHIN-faceCount-group local cycle',
            ok, hexTrails.map(t => `${t.faceCount}:${store.get(t.key).params.memberIndex}`).join(' '));
        check('Symmetry: the number of distinct faceCount groups matches the pattern\'s own real symmetry-role count',
            byFaceCount.size === new Set(hexTrails.map(t => t.faceCount)).size);
    }

    // ---- Rings: CONTIGUOUS buckets by centroid-distance rank, not area rank - independently recomputed ----
    {
        const M = 4;
        const store = new Map();
        const sel = { version: 1, source: 'farborgel', members: Array.from({ length: M }, (_, k) => member(1 + k * 3, 0.1, 0.1)) };
        const ringDistances = computeTrailRingDistances(hexRes, hexSheet.group, hexTrails);
        check('computeTrailRingDistances: every real trail gets a real, non-negative distance',
            hexTrails.every(t => typeof ringDistances.get(t.key) === 'number' && ringDistances.get(t.key) >= 0));
        applyHarmonyToPattern(sel, store, hexTrails, 'rings', { ringDistances });
        // Independently recompute: sort trail KEYS by distance (not by the existing area order),
        // bucket that NEW order the same contiguous way Area does.
        const byDistance = hexTrails.slice().sort((a, b) => ringDistances.get(a.key) - ringDistances.get(b.key));
        const distanceRankOf = new Map(byDistance.map((t, i) => [t.key, i]));
        const N = hexTrails.length, bucketSize = Math.ceil(N / M);
        const expected = hexTrails.map(t => Math.min(M - 1, Math.floor(distanceRankOf.get(t.key) / bucketSize)));
        const actual = hexTrails.map(t => store.get(t.key).params.memberIndex);
        check('Rings: every trail\'s bucket matches an independently recomputed distance-rank bucket, not the area-rank one',
            JSON.stringify(actual) === JSON.stringify(expected), `actual=${actual.join(',')} expected=${expected.join(',')}`);
        // Confirm rings genuinely differs from what Area (same M, same trails) would have given -
        // proves distance, not area, actually drove the bucketing (not a coincidental match).
        const areaBucketSize = Math.ceil(N / M);
        const areaExpected = hexTrails.map((t, i) => Math.min(M - 1, Math.floor(i / areaBucketSize)));
        check('Rings bucketing really differs from Area bucketing on this pattern (distance, not area, is doing the work)',
            JSON.stringify(actual) !== JSON.stringify(areaExpected));
    }

    // ---- Inheritance must keep working under every non-cyclic strategy too ----
    {
        const M = 3;
        const store = new Map();
        // Pre-seed an inherited order (a fixed rotation, mirroring section 6's own approach).
        hexTrails.forEach((t, i) => {
            const slot = (i + 5) % hexTrails.length;
            store.set(t.key, { hue: 0, w: 0.5, s: 0.1, rule: 'max-contrast-gray', params: { idx: [0], slot, slots: hexTrails.length }, displayColor: null });
        });
        const sel = { version: 1, source: 'farborgel', members: Array.from({ length: M }, (_, k) => member(1 + k * 3, 0.1, 0.1)) };
        applyHarmonyToPattern(sel, store, hexTrails, 'area');
        const N = hexTrails.length, bucketSize = Math.ceil(N / M);
        const expected = hexTrails.map((t, i) => Math.min(M - 1, Math.floor(((i + 5) % N) / bucketSize)));
        const actual = hexTrails.map(t => store.get(t.key).params.memberIndex);
        check('inheritance still works under a non-Cyclic strategy (Area): buckets follow the INHERITED rank, not the fresh area rank',
            JSON.stringify(actual) === JSON.stringify(expected), `actual=${actual.join(',')} expected=${expected.join(',')}`);
    }

    check('an unknown strategy name throws rather than silently falling back', (() => {
        try { applyHarmonyToPattern({ version: 1, source: 'farborgel', members: [member(1, 0.1, 0.1)] }, new Map(), trails, 'nonsense'); return false; }
        catch (e) { return true; }
    })());

    // ---- Switching strategies must NOT misread the old strategy's small memberIndex range as
    // a full rank - a real bug found live in the browser: Cyclic (M=4) writes memberIndex 0..3,
    // then switching to Area (bucketSize=6 for 23 trails) read that 0..3 value back as if it
    // were a full 0..22 rank, collapsing every trail into bucket 0. Fixed by only honoring
    // params.memberIndex as an inherited rank when params.strategy matches the NEW call's own
    // strategy; a real strategy switch must start that strategy's own natural order fresh. ----
    {
        const M1 = 4, M2 = 4;
        const store = new Map();
        const selCyclic = { version: 1, source: 'farborgel', members: Array.from({ length: M1 }, (_, k) => member(1 + k * 3, 0.1, 0.1)) };
        applyHarmonyToPattern(selCyclic, store, hexTrails, 'cyclic');
        const selArea = { version: 1, source: 'farborgel', members: Array.from({ length: M2 }, (_, k) => member(2 + k * 3, 0.1, 0.1)) };
        applyHarmonyToPattern(selArea, store, hexTrails, 'area');
        const N = hexTrails.length, bucketSize = Math.ceil(N / M2);
        const expectedFresh = hexTrails.map((t, i) => Math.min(M2 - 1, Math.floor(i / bucketSize)));
        const actual = hexTrails.map(t => store.get(t.key).params.memberIndex);
        check('switching Cyclic -> Area does NOT collapse into one bucket (starts Area\'s own fresh area-rank order, not Cyclic\'s small memberIndex range)',
            JSON.stringify(actual) === JSON.stringify(expectedFresh), `actual=${actual.join(',')} expected=${expectedFresh.join(',')}`);
        check('...and is not degenerately all-zero (the concrete symptom the live-browser bug showed)',
            new Set(actual).size > 1, JSON.stringify(actual));

        // Reapplying the SAME strategy with a DIFFERENT M (Area M=4 -> Area M=2).
        // HISTORY (corrected): this check used to expect "chaining" from the previous Area memberIndex:
        // floor(prevMemberIndex / bucketSize2) - with prev in 0..3 and a bucket of 12 that is 0 for EVERY
        // trail, i.e. the expected value was 23 zeros: the collapse itself, written down as correct. The
        // right expectation: a different M starts that M's natural Area order fresh (section 8 covers
        // the same-M case, which is pinned instead).
        const selArea2 = { version: 1, source: 'farborgel', members: Array.from({ length: 2 }, (_, k) => member(5 + k * 3, 0.1, 0.1)) };
        applyHarmonyToPattern(selArea2, store, hexTrails, 'area');
        const bucketSize2 = Math.ceil(N / 2);
        const expectedFresh2 = hexTrails.map((t, i) => Math.min(1, Math.floor(i / bucketSize2)));
        const actual2 = hexTrails.map(t => store.get(t.key).params.memberIndex);
        check('Area (M=4) then Area (M=2): the new size is distributed afresh (both members used), not collapsed into member 0',
            JSON.stringify(actual2) === JSON.stringify(expectedFresh2) && new Set(actual2).size === 2, `actual=${actual2.join(',')} expected=${expectedFresh2.join(',')}`);
    }

    // ---------------- 8. memberIndex is a PIN, never a rank (the "colors collapse / reshuffle on reapply" bug) ----------------
    // Reproduced live (133-trail hex pattern): Dreier then Vierer under Cyclic used 3 of 4 colors, under Area
    // and Rings 1 of 4; reapplying the SAME harmony under Area/Rings collapsed to member 0, and under Symmetry
    // reshuffled which trail has which color on every click. Cause: applyHarmonyToPattern() read a previous
    // farborgel entry's params.memberIndex (a member number 0..M-1) back AS A RANK (0..N-1). The fix pins it
    // instead - only when the existing entry has the same strategy AND the same cardinality - and distributes
    // everything else afresh. Every strategy x every size change x every reapply is checked here.
    console.log('\n== 8. memberIndex is a pin: all M colors, idempotent reapply, size/strategy change starts fresh ==');
    {
        const hexRingDistances = computeTrailRingDistances(hexRes, hexSheet.group, hexTrails);
        const ctxFor = strat => strat === 'symmetry' ? { groupOpsCount: hexSheet.group.ops.length }
            : strat === 'rings' ? { ringDistances: hexRingDistances } : undefined;
        const selOf = (M, hueShift) => ({ version: 1, source: 'farborgel', members: Array.from({ length: M }, (_, k) => member(1 + ((k * 3 + (hueShift || 0)) % 24), 0.1, 0.1)) });
        const apply = (store, M, strat, hueShift) => applyHarmonyToPattern(selOf(M, hueShift), store, hexTrails, strat, ctxFor(strat));
        const mi = store => hexTrails.map(t => store.get(t.key).params.memberIndex);
        const fresh = (M, strat) => { const st = new Map(); apply(st, M, strat); return mi(st); };
        const distinct = a => new Set(a).size;

        for (const strat of ['cyclic', 'area', 'symmetry', 'rings']) {
            // sanity: the strategy itself uses every member of these sizes on this pattern when applied fresh
            const allUsedFresh = [2, 3, 4].every(M => distinct(fresh(M, strat)) === M);
            check(`[${strat}] setup: applied fresh, sizes 2/3/4 each use all of their members on this pattern`, allUsedFresh);

            // (a) size changes: each step equals a fresh application AND uses all members (the reported symptom)
            const store = new Map();
            let sizeOk = true, usedOk = true, detail = [];
            for (const M of [3, 4, 2, 4, 3, 2]) {
                apply(store, M, strat);
                const got = mi(store), want = fresh(M, strat);
                if (JSON.stringify(got) !== JSON.stringify(want)) sizeOk = false;
                if (distinct(got) !== M) usedOk = false;
                detail.push(`${M}:${distinct(got)}`);
            }
            check(`[${strat}] size changes 3,4,2,4,3,2 in a row: every step equals a fresh application of that size`, sizeOk, detail.join(' '));
            check(`[${strat}] ...and every step uses ALL of its M members (no collapse, no dropped members)`, usedOk, detail.join(' '));

            // (b) the exact reported sequences: Dreier -> Vierer, and a size-1 series (W) -> Vierer
            const st2 = new Map(); apply(st2, 3, strat); apply(st2, 4, strat);
            check(`[${strat}] Dreier then Vierer: all 4 colors`, distinct(mi(st2)) === 4);
            const st3 = new Map(); apply(st3, 1, strat); apply(st3, 4, strat);
            check(`[${strat}] a 1-color series then Vierer: all 4 colors (not stuck on member 0)`, distinct(mi(st3)) === 4);

            // (c) idempotency: same size, same strategy -> identical member numbers, including with different colors
            // (an anchor step changes the hues, never the size of a 2/3/4 harmony)
            const st4 = new Map(); apply(st4, 4, strat);
            const first = mi(st4);
            apply(st4, 4, strat); const second = mi(st4);
            apply(st4, 4, strat, 5); const third = mi(st4);
            check(`[${strat}] reapplying the same harmony (also with shifted hues, as an anchor step does) leaves every trail's member unchanged`,
                JSON.stringify(first) === JSON.stringify(second) && JSON.stringify(second) === JSON.stringify(third),
                `colors distinct: ${distinct(first)}/${distinct(second)}/${distinct(third)}`);

            // (d) a per-trail override (assignFarborgelSlot() shape) survives a same-size, same-strategy
            // reapply and is dropped by a size change - exactly as documented
            const st5 = new Map(); apply(st5, 4, strat);
            const victim = hexTrails[hexTrails.length >> 1].key;
            const before = st5.get(victim).params.memberIndex, over = (before + 1) % 4;
            st5.set(victim, { ...st5.get(victim), params: { ...st5.get(victim).params, memberIndex: over } });
            const othersBefore = mi(st5);
            apply(st5, 4, strat, 7);
            const after = mi(st5);
            check(`[${strat}] a per-trail override survives reapplying the same harmony size (and nothing else moves)`,
                st5.get(victim).params.memberIndex === over && JSON.stringify(after) === JSON.stringify(othersBefore));
            apply(st5, 3, strat);
            check(`[${strat}] ...and is dropped when the size changes (the new size is distributed afresh)`, JSON.stringify(mi(st5)) === JSON.stringify(fresh(3, strat)));
        }

        // (e) a strategy switch never reads another strategy's member numbers
        {
            const st = new Map(); apply(st, 4, 'cyclic'); apply(st, 4, 'area');
            check('switching strategy at the SAME size (Cyclic -> Area, M=4) starts Area afresh', JSON.stringify(mi(st)) === JSON.stringify(fresh(4, 'area')));
            apply(st, 4, 'symmetry');
            check('...and Area -> Symmetry likewise', JSON.stringify(mi(st)) === JSON.stringify(fresh(4, 'symmetry')));
        }

        // (f) a partly pinned store (trails added by an edit have no entry yet): pins keep, the rest is computed, all in range
        {
            const st = new Map(); apply(st, 4, 'area');
            const keep = hexTrails.slice(0, 12), dropped = hexTrails.slice(12);
            dropped.forEach(t => st.delete(t.key));
            const pinnedBefore = keep.map(t => st.get(t.key).params.memberIndex);
            apply(st, 4, 'area');
            check('partly pinned store: existing entries keep their member, the missing ones are computed in range',
                keep.every((t, i) => st.get(t.key).params.memberIndex === pinnedBefore[i]) && hexTrails.every(t => { const m = st.get(t.key).params.memberIndex; return Number.isInteger(m) && m >= 0 && m < 4; }));
        }

        // (g) an out-of-range stored memberIndex (cardinality matches, value does not) is ignored, never indexed
        {
            const st = new Map(); apply(st, 3, 'cyclic');
            const k = hexTrails[0].key;
            st.set(k, { ...st.get(k), params: { ...st.get(k).params, memberIndex: 99 } });
            let threw = false;
            try { apply(st, 3, 'cyclic'); } catch (e) { threw = true; }
            check('a corrupt out-of-range memberIndex with a matching cardinality is ignored (distributed afresh), not read as a member', !threw && st.get(k).params.memberIndex === fresh(3, 'cyclic')[0]);
        }

        // (h) the .slot path (gray / old-system rules) is untouched: a slot wins over a stale memberIndex and is read as a rank
        {
            const M = 3, st = new Map();
            hexTrails.forEach((t, i) => st.set(t.key, { hue: 0, w: 0.5, s: 0.1, rule: 'max-contrast-gray', params: { idx: [0], slot: (i + 2) % hexTrails.length, slots: hexTrails.length, memberIndex: 0, cardinality: M, strategy: 'cyclic' }, displayColor: null }));
            apply(st, M, 'cyclic');
            check('.slot still wins and is still read as a rank (even next to a matching memberIndex/cardinality/strategy)',
                hexTrails.every((t, i) => st.get(t.key).params.memberIndex === ((i + 2) % hexTrails.length) % M));
        }
    }
}

// ------------------------------------------------------------------------
console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
