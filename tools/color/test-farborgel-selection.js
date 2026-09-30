/**
 * tools/color/test-farborgel-selection.js
 * Headless verification for Group D Phase B4: core/farborgel-selection.mjs's
 * buildHarmonySelection() - all 7 harmony types (2/3/4/W/B/S/V), against known anchors, with
 * independently recomputed expectations (not just "no error thrown"), then fed into Phase A's
 * applyHarmonyToPattern() to confirm the whole pipeline reaches real store assignments.
 *
 *   node tools/color/test-farborgel-selection.js
 *
 * core/farborgel-engine.mjs (which composition.mjs/HarmonySelection.mjs now import, see its own
 * docblock) supports Node directly (fs instead of fetch), so this test imports the REAL,
 * unmodified color-harmony/ui/composition.mjs and HarmonySelection.mjs - no reconstruction, no
 * mocked engine, the actual reducer and actual selection builder do the real work here.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');

let failures = 0, checks = 0;
function check(name, ok, detail) {
    checks++; if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
    const { buildHarmonySelection, anchorField, anchorDisplayColor, SERIES_RELATIONS } = await import(path.join(ROOT, 'core/farborgel-selection.mjs'));
    const Engine = (await import(path.join(ROOT, 'core/farborgel-engine.mjs'))).default;
    const { historicalToDisplay } = await import(path.join(ROOT, 'color-harmony/ui/DisplayCalibration.mjs'));

    // ------------------------------------------------------------------------
    console.log('== 1. anchorField(): resolves to the real atlas field, not a stub ==');
    {
        const anchor = { hueIndex: 1, registerIndex: 0 }; // FARBORGEL_REGISTER_ORDER[0] === 'ca'
        const field = anchorField(anchor);
        check('field is a real atlas field (source, hueIndex, label present)', field.source === 'atlas' && field.hueIndex === 1 && typeof field.label === 'string', JSON.stringify(field));
        check('field label matches the real 28-register order at index 0 ("ca")', field.label.endsWith('ca'), field.label);
        check('anchorField() throws for an out-of-range registerIndex (defensive, not silently wrong)', (() => {
            try { anchorField({ hueIndex: 1, registerIndex: 999 }); return false; } catch { return true; }
        })());
    }

    // ------------------------------------------------------------------------
    console.log('\n== 1b. anchorDisplayColor(): the anchor\'s own calibrated color, not a re-derived one ==');
    {
        // hue=1/"pa" (registerIndex 21) - the exact anchor the muted-appearance investigation used.
        const anchor = { hueIndex: 1, registerIndex: 21 };
        const rgb = anchorDisplayColor(anchor);
        check('returns a deterministic [r,g,b] byte triple (0-255 ints)', Array.isArray(rgb) && rgb.length === 3 && rgb.every(c => Number.isInteger(c) && c >= 0 && c <= 255), JSON.stringify(rgb));
        check('deterministic: calling again for the same anchor gives byte-identical results', same(rgb, anchorDisplayColor(anchor)));
        // Independently recompute via DisplayCalibration.mjs's own historicalToDisplay(), called
        // directly here (not through anchorDisplayColor), against the real atlas field.
        const expected = historicalToDisplay(anchorField(anchor)).rgb;
        check('matches historicalToDisplay(anchorField(anchor)).rgb, computed independently', same(rgb, expected), `got ${JSON.stringify(rgb)}, expected ${JSON.stringify(expected)}`);
        check('matches the known real value from the muted-appearance investigation (hue=1/"pa")', same(rgb, [226, 243, 75]), JSON.stringify(rgb));
        // Cross-check against a REAL HarmonySelection built from the same field: an isotint (W) series'
        // active member IS the anchor field itself (per section 3 below), so its srgb must be identical -
        // proves anchorDisplayColor() uses the exact same calibration pipeline a real harmony member does,
        // not a parallel reimplementation that could silently drift from it.
        const isotint = buildHarmonySelection(anchor, 'W');
        const activeMemberSrgb = isotint.members[isotint.activeMemberIndex].srgb;
        check('matches a real HarmonySelection\'s active-member srgb for the same anchor (same pipeline, not a reimplementation)', same(rgb, activeMemberSrgb), `anchorDisplayColor=${JSON.stringify(rgb)}, member.srgb=${JSON.stringify(activeMemberSrgb)}`);
    }

    // ------------------------------------------------------------------------
    console.log('\n== 2. cardinalities 2/3/4 (Gegenfarben/Dreier/Vierer): real HarmonySelection, independently checked ==');
    {
        const anchor = { hueIndex: 5, registerIndex: 3 };
        for (const n of ['2', '3', '4']) {
            const selection = buildHarmonySelection(anchor, n);
            check(`type ${n}: version-1 HarmonySelection with source 'farborgel'`, selection.version === 1 && selection.source === 'farborgel');
            check(`type ${n}: exactly ${n} members (the requested cardinality)`, selection.members.length === Number(n), selection.members.length);
            check(`type ${n}: every member has a valid sRGB display color (0-255 ints)`, selection.members.every(m => Array.isArray(m.srgb) && m.srgb.length === 3 && m.srgb.every(c => Number.isInteger(c) && c >= 0 && c <= 255)));
            // Independently recompute: every generated member shares the anchor's own w/s (a rotated
            // copy at a different hue, not a resolved-from-scratch value) - core/facecolor.js/
            // resolveColor()'s own contract, checked against the REAL anchor field's w/s directly.
            const anchorFld = anchorField(anchor);
            check(`type ${n}: every member keeps the anchor's own w/s (rotated copies, not new values)`,
                selection.members.every(m => Math.abs(m.analyticalCoordinate.w - anchorFld.w) < 1e-9 && Math.abs(m.analyticalCoordinate.s - anchorFld.s) < 1e-9));
        }
        // n=2 (Gegenfarben): the two hues must be real opposites (12 apart on the 24-hue ring) -
        // recomputed via Engine.hueDistance(), not asserted from the implementation's own choice.
        const sel2 = buildHarmonySelection(anchor, '2');
        const hues2 = sel2.members.map(m => m.analyticalCoordinate.hueIndex);
        check('type 2: the two hues are real opposites (Engine.hueDistance === 12)', Engine.hueDistance(hues2[0], hues2[1]).minimal === 12, hues2.join(','));
    }

    // ------------------------------------------------------------------------
    console.log('\n== 3. W/B/S/V series types: real letter mapping, active member matches the anchor ==');
    {
        check('SERIES_RELATIONS matches the real Toolbar.mjs mapping (W/B/S/V)', same(SERIES_RELATIONS, { W: 'isotint', B: 'isotone', S: 'shadowSeries', V: 'isovalent' }));
        const anchor = { hueIndex: 9, registerIndex: 7 };
        const anchorFld = anchorField(anchor);
        for (const letter of ['W', 'B', 'S', 'V']) {
            const selection = buildHarmonySelection(anchor, letter);
            check(`type ${letter}: version-1 HarmonySelection with source 'farborgel'`, selection.version === 1 && selection.source === 'farborgel');
            check(`type ${letter}: at least one member (a real series, not empty)`, selection.members.length >= 1, selection.members.length);
            const active = selection.members[selection.activeMemberIndex];
            check(`type ${letter}: the ACTIVE member is our original anchor field (same hue+label), per seriesMembers()'s own default activeIdentity`,
                active && active.historicalCoordinate && active.historicalCoordinate.hueIndex === anchorFld.hueIndex && active.historicalCoordinate.label === anchorFld.label,
                active && JSON.stringify(active.historicalCoordinate));
            check(`type ${letter}: provenance.status is 'series' (the real reducer's own source tag)`, selection.provenance.status === 'series', selection.provenance.status);
        }
        // A concrete, independently-checkable fact for isotint/isotone: every member of a Weiß
        // (isotint) series shares the SAME w (white content) as the anchor; every member of a
        // Schwarz (isotone) series shares the SAME s (black content) - the actual definition of
        // those two series, not just "some members exist".
        const w = buildHarmonySelection(anchor, 'W');
        check('type W (isotint/Weiß): every member shares the anchor\'s own w', w.members.every(m => Math.abs(m.analyticalCoordinate.w - anchorFld.w) < 1e-6));
        const b = buildHarmonySelection(anchor, 'B');
        check('type B (isotone/Schwarz): every member shares the anchor\'s own s', b.members.every(m => Math.abs(m.analyticalCoordinate.s - anchorFld.s) < 1e-6));
    }

    // ------------------------------------------------------------------------
    console.log('\n== 4. unknown harmony type throws (no silent wrong behavior) ==');
    {
        const anchor = { hueIndex: 1, registerIndex: 0 };
        check('an unrecognized harmony type throws RangeError', (() => {
            try { buildHarmonySelection(anchor, 'X'); return false; } catch (e) { return e instanceof RangeError; }
        })());
    }

    // ------------------------------------------------------------------------
    console.log('\n== 5. the whole pipeline reaches applyHarmonyToPattern() (Phase A) with real assignments ==');
    {
        // Build a real multi-trail pattern the same way test-farborgel-bridge.js does, via the vm
        // harness, then feed a REAL selection (from THIS phase's real engine) into it.
        const CORE = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'farborgel-bridge'];
        const SRC = CORE.map(f => fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
        const sb = {
            strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs,
            dist: (a, b, c, d) => Math.hypot(c - a, d - b),
            segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, timeline: null, activeNetWarp: null,
            centroid: null, symmetryMode: 'rotation_reflection6', outerCorners: null, currentShape: 'triangle', nodes: null,
            baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, additionalLayers: [], console
        };
        sb.toTileLocal = (n, tileC, flip180) => {
            let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y;
            if (flip180) { x = -x; y = -y; }
            return { x: tileC.x + x, y: tileC.y + y };
        };
        vm.createContext(sb);
        vm.runInContext(SRC, sb);
        const grid = sb.buildTriangleGrid(4, 1.3, 300, 300);
        sb.nodes = grid.nodes; sb.centroid = grid.centroid; sb.outerCorners = grid.outerCorners;
        const table = sb.computeThemeLineOrbits(grid.nodes, grid.centroid, 'triangle', 'rotation_reflection6', grid.outerCorners);
        const reps = table.orbits.map(o => o.pairs[0]);
        const group = sb.getGroupElementsCached(grid.nodes, grid.centroid, 'triangle', 'rotation_reflection6', grid.outerCorners);
        const allIds = table.orbits.map((_, i) => i).slice(0, 6);
        const res = sb.computeCellFaces(allIds.map(i => reps[i]), grid.nodes);
        const trails = sb.computeFaceTrails(res, group);
        check('setup: enough trails to exercise a multi-member selection', trails.length >= 3, `${trails.length} trails`);

        const anchor = { hueIndex: 3, registerIndex: 5 };
        const selection = buildHarmonySelection(anchor, '3'); // Dreier/triad
        const store = new Map();
        let threw = null;
        try { sb.applyHarmonyToPattern(selection, store, trails); } catch (err) { threw = err; }
        check('applyHarmonyToPattern() never throws for a real HarmonySelection from this phase', threw === null, threw && threw.message);
        check('every trail received an assignment', trails.every(t => store.has(t.key)), `${store.size}/${trails.length}`);

        // Independently recompute the FIRST trail's expected color: cyclic assignment (trail i ->
        // member i % M, per Phase A), resolved via the REAL core/color.js resolveColor() at the
        // SAME hue-index conversion Phase A already established (hueIndex-1, 0-based).
        const m0 = selection.members[0];
        const expectedHue0 = ((m0.analyticalCoordinate.hueIndex - 1) % 24 + 24) % 24;
        const a0 = store.get(trails[0].key);
        check('trail 0\'s stored hue/w/s matches member 0\'s real analytical coordinate (converted 1-based -> 0-based)',
            a0.hue === expectedHue0 && a0.w === m0.analyticalCoordinate.w && a0.s === m0.analyticalCoordinate.s,
            JSON.stringify({ stored: a0, expectedHue0 }));
        const REF = vm.runInContext('OSTWALD_REFERENCE_SYSTEM', sb);
        const resolved = sb.resolveColor(REF, a0);
        check('trail 0\'s resolved color is a real, well-formed hex color (actually computed, not a placeholder)', /^#[0-9a-f]{6}$/i.test(resolved.hex), resolved.hex);
        check('provenance: rule is "farborgel" (Phase A\'s own tag, untouched by this phase)', a0.rule === 'farborgel', a0.rule);
    }

    console.log(`\n${checks - failures}/${checks} checks passed`);
    if (failures > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
