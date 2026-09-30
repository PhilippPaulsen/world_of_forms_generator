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

// ------------------------------------------------------------------------
console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
