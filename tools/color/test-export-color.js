/**
 * tools/color/test-export-color.js
 * Headless verification of Group D Phase 4 (export): face.colorSpec,
 * face.color for assigned faces, and meta.faceColoring in buildExportData().
 *
 *   node tools/color/test-export-color.js
 *
 * (1) Regression: with no assignments, buildExportData() of the WORKING TREE
 *     is byte-identical (JSON, exportedAt removed) to the same export from the
 *     last commit's core files (`git show HEAD:...`) - across real patterns,
 *     with and without a layer.
 * (2) Round trip: assign palettes from all four Phase 1 rules (with a per-trail
 *     override) on the base sheet and on a layer, export, JSON.stringify ->
 *     JSON.parse, and re-derive everything from the PARSED data alone: the
 *     exported system + colorSpec -> resolveColor() must equal face.color
 *     exactly, and (rule, params) must regenerate the same (hue, w, s).
 * Real patterns as in test-facecolor.js (random k-combinations of real orbits).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
// farborgel-bridge: core/facecolor.js's ensureDefaultGrayFill() now calls applyHarmonyToPattern()
// (gray-as-selection round) - needed on both sides here (compares against HEAD, which already
// has core/farborgel-bridge.js from an earlier, already-committed round).
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export', 'farborgel-bridge'];
const load = fromHead => FILES.map(f => fromHead
    ? execSync(`git show HEAD:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString()
    : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const SRC_NEW = load(false), SRC_OLD = load(true);
const BUILDERS = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };

function makeSheet(src, shape, order, mode) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        dist: (a, b, c, d) => Math.hypot(c - a, d - b), console,
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, timeline: null, activeNetWarp: null, lineColor: '#000000', altNetSeed: null,
        currentShape: shape, shapeSizeFactor: 1.3, nodeCount: order, symmetryMode: mode,
        connections: [], additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null
    };
    sb.toTileLocal = (n, tileC, flip180) => { let x = n.x - sb.centroid.x, y = n.y - sb.centroid.y; if (flip180) { x = -x; y = -y; } return { x: tileC.x + x, y: tileC.y + y }; };
    vm.createContext(sb);
    vm.runInContext(src, sb);
    const grid = sb[BUILDERS[shape]](order, 1.3, 300, 300);
    sb.nodes = grid.nodes; sb.centroid = grid.centroid; sb.outerCorners = grid.outerCorners;
    const table = sb.computeThemeLineOrbits(grid.nodes, grid.centroid, shape, mode, grid.outerCorners);
    const reps = table.orbits.map(o => o.pairs[0]);
    const setBase = ids => { sb.connections = ids.map(i => reps[i].slice()); };
    const addLayer = ids => {
        const layer = { connections: ids.map(i => reps[i].slice()), redoStack: [], offsetX: 0, offsetY: 0, rotation: 0, shape, symmetryMode: mode, enabled: true, showFaces: true, nodeCount: order, shapeSizeFactor: 1.3, nodes: grid.nodes, centroid: grid.centroid, outerCorners: grid.outerCorners };
        sb.additionalLayers.push(layer); return layer;
    };
    const exp = () => { const d = sb.buildExportData(null); delete d.exportedAt; return d; };
    return { sb, grid, table, reps, setBase, addLayer, exp, group: () => sb.getGroupElementsCached(grid.nodes, grid.centroid, shape, mode, grid.outerCorners) };
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const CONFIGS = [['triangle', 4, 'rotation_reflection6'], ['triangle', 3, 'rotation6'], ['square', 4, 'rotation_reflection6'], ['square', 3, 'rotation6'], ['hex', 3, 'rotation_reflection6'], ['hex', 3, 'rotation6']];
const rand = rng(20260924);
function randomIds(n, k) { const ids = []; while (ids.length < Math.min(k, n)) { const i = Math.floor(rand() * n); if (!ids.includes(i)) ids.push(i); } return ids.sort((a, b) => a - b); }

// ---------------- 1. unassigned regression ----------------
// Phase B1 revision: orbitColor() (core/faces.js) now returns evenly-spaced Ostwald grays
// instead of evenly-spaced HSL hues - an INTENDED default-color change, so an unassigned
// export's face.color no longer stays byte-identical to HEAD by itself. Everything else
// about an unassigned export still must: this check now compares structure with face.color
// stripped out, and separately confirms the new color is a genuine gray hex, not an
// unrelated/broken value - still a real regression guard, just for the new baseline.
console.log('== 1. unassigned export: structure identical to the last commit; color is now a valid gray (Phase B1) ==');
{
    let n = 0, structBad = 0, colorBad = 0, withFaces = 0, withLayer = 0, noMeta = 0, specBad2 = 0;
    const GRAY_HEX = /^#([0-9a-f]{2})\1\1$/i;
    const stripColor = faces => (faces || []).map(f => { const { color, colorSpec, ...rest } = f; return rest; });
    // orbitColor() colors BOTH geometry.faces (base) and geometry.layers[].faces (each
    // enabled layer, core/export.js:179) - strip and gray-check both, not just the base.
    // Phase B-Farbstrategien follow-up (gray-as-selection round): colorSpec is ALSO stripped here
    // now, alongside color - core/facecolor.js's faceColoringExportData() used to document "no
    // sheet has an assignment -> export byte-identically", a real guarantee this round
    // intentionally retires: ensureDefaultGrayFill() means there is no more "no assignment" state
    // once a sheet has been rendered once, so an export with literally nothing explicitly chosen
    // now carries real colorSpec/meta.faceColoring too - checked for its OWN correctness below
    // (section "no assignments: colorSpec/meta.faceColoring now ALWAYS reflect a real gray
    // default"), not compared away as noise here.
    const stripStruct = geom => ({
        ...geom, faces: stripColor(geom.faces),
        layers: (geom.layers || []).map(l => ({ ...l, faces: stripColor(l.faces) }))
    });
    const allFaceColors = geom => [...(geom.faces || []), ...((geom.layers || []).flatMap(l => l.faces || []))].map(f => f.color);
    const allColorSpecs = geom => [...(geom.faces || []), ...((geom.layers || []).flatMap(l => l.faces || []))].map(f => f.colorSpec).filter(Boolean);
    for (const [shape, order, mode] of CONFIGS) {
        const A = makeSheet(SRC_NEW, shape, order, mode), B = makeSheet(SRC_OLD, shape, order, mode);
        const N = A.table.orbits.length;
        for (let t = 0; t < 25; t++) {
            const ids = randomIds(N, 2 + Math.floor(rand() * 4)), lay = randomIds(N, 2 + Math.floor(rand() * 3)), useLayer = t % 2 === 1;
            for (const S of [A, B]) { S.sb.additionalLayers = []; S.setBase(ids); if (useLayer) S.addLayer(lay); }
            const a = A.exp(), b = B.exp();
            n++; if (useLayer) withLayer++;
            if ((a.geometry.faces || []).length) withFaces++;
            const aMeta = { ...a.meta }; delete aMeta.faceColoring;
            const bMeta = { ...b.meta }; delete bMeta.faceColoring;
            const aStruct = { ...a, meta: aMeta, geometry: stripStruct(a.geometry) };
            const bStruct = { ...b, meta: bMeta, geometry: stripStruct(b.geometry) };
            if (JSON.stringify(aStruct) !== JSON.stringify(bStruct)) structBad++;
            allFaceColors(a.geometry).forEach(c => { if (!GRAY_HEX.test(c)) colorBad++; });
            // no assignments: colorSpec/meta.faceColoring now ALWAYS reflect a real gray default
            // (the eager fill, not an absence of data) - checked here, not stripped away above.
            if ((a.geometry.faces || []).length && !a.meta.faceColoring) noMeta++;
            allColorSpecs(a.geometry).forEach(cs => { if (cs.rule !== 'max-contrast-gray' || cs.displayColor !== null) specBad2++; });
        }
    }
    check('no assignments: export structure identical to the previous commit\'s (every field but face.color/colorSpec/meta.faceColoring)', structBad === 0, `${n} exports (${withLayer} with a layer, ${withFaces} with faces), ${structBad} differing`);
    check('no assignments: every face.color is a valid Ostwald gray hex (#rrggbb, R=G=B) - the Phase B1 default', colorBad === 0, `${colorBad} not a gray hex`);
    check('no assignments: colorSpec/meta.faceColoring are now ALWAYS present (the eager gray fill), every colorSpec tagged rule: max-contrast-gray, no displayColor override', noMeta === 0 && specBad2 === 0, `${withFaces} exports with faces`);
}

// ---------------- 2. round trip ----------------
console.log('\n== 2. round trip: assign -> export -> JSON -> re-derive ==');
{
    const RULES = ['isotint', 'isotone', 'shadow-series', 'tetrad'];
    let runs = 0, sysBad = 0, resolveBad = 0, specBad = 0, metaBad = 0, regenBad = 0, unassignedBad = 0, countBad = 0, overrideRuns = 0, overrideBad = 0, restBad = 0, isolBad = 0, faceRows = 0, assignedRows = 0, fmtBad = 0;
    for (const [shape, order, mode] of CONFIGS) {
        const S = makeSheet(SRC_NEW, shape, order, mode), sb = S.sb;
        const REF = vm.runInContext('OSTWALD_REFERENCE_SYSTEM', sb);
        const N = S.table.orbits.length;
        for (const rule of RULES) for (const target of ['base', 'layer']) for (let t = 0; t < 3; t++) {
            const ids = randomIds(N, 3), lay = randomIds(N, 3);
            sb.additionalLayers = []; sb.baseFaceAssignments = new Map(); S.setBase(ids);
            const layer = S.addLayer(lay); layer.faceAssignments = new Map();
            const group = S.group();
            const store = target === 'base' ? sb.baseFaceAssignments : layer.faceAssignments;
            const conns = target === 'base' ? sb.connections : layer.connections;
            const res0 = sb.computeCellFaces(conns, S.grid.nodes);
            const trails = sb.computeFaceTrails(res0, group);
            if (trails.length < 2) continue;
            runs++;
            const axes = sb.harmonyRuleParams(sb.getHarmonyRule(rule), REF);
            const palette = { ruleId: rule, idx: axes.map(a => (a.count >> 1) + t >= a.count ? 0 : (a.count >> 1) + t), overrides: new Map() };
            palette.overrides.set(trails[0].key, trails.length - 1); overrideRuns++;
            sb.applyPaletteToTrails(store, trails, palette);
            store.set('orphan-key', { hue: 3, w: 0.1, s: 0.1, rule: null, params: null }); // must survive into meta, never into a face

            const before = S.exp();                                    // (with assignments) - for the "only these fields differ" check below
            const parsed = JSON.parse(JSON.stringify(before));         // real JSON round trip
            const fc = parsed.meta.faceColoring;
            if (!fc || !eq(fc.system, JSON.parse(JSON.stringify(REF)))) sysBad++;
            const metaList = target === 'base' ? fc.base : (fc.layers && fc.layers[0] && fc.layers[0].assignments);
            if (!metaList || metaList.length !== store.size) metaBad++;
            else for (const e of metaList) { const a = store.get(e.trail); if (!a || !eq({ hue: e.hue, w: e.w, s: e.s, rule: e.rule, params: e.params, displayColor: e.displayColor }, a)) metaBad++; }
            // sheet isolation: the other sheet never explicitly received THIS rule - its own meta
            // entry and its faces' colorSpec now exist too (ensureDefaultGrayFill() eager-fills
            // every rendered sheet, Phase B-Farbstrategien follow-up, gray-as-selection round),
            // but every one of them must carry rule: 'max-contrast-gray', never `rule` (the
            // explicitly-applied one) or any of its entries - that's what "isolated" now means.
            const otherFaces = target === 'base' ? parsed.geometry.layers[0].faces : parsed.geometry.faces;
            const otherMetaList = target === 'base' ? fc.layers && fc.layers[0] && fc.layers[0].assignments : fc.base;
            // A genuinely face-less other sheet (its own random ids happened to enclose nothing)
            // gets no gray fill either - ensureDefaultGrayFill() has no trails to fill, so no
            // meta entry for it exists, which is correct, not an isolation leak. Only checked when
            // there is something to have been filled.
            if (otherFaces.length && (!otherMetaList || !otherMetaList.every(e => e.rule === 'max-contrast-gray'))) isolBad++;
            if (!otherFaces.every(f => f.colorSpec && f.colorSpec.rule === 'max-contrast-gray')) isolBad++;
            if (parsed.formatVersion !== 1) fmtBad++;

            const faces = target === 'base' ? parsed.geometry.faces : parsed.geometry.layers[0].faces;
            const keysNow = sb.computeFaceTrailKeys(sb.computeCellFaces(conns, S.grid.nodes), group);
            if (faces.length !== keysNow.length) countBad++;
            let assignedHere = 0, ovSeen = false;
            faces.forEach((f, i) => {
                faceRows++;
                const assigned = store.has(keysNow[i]) && keysNow[i] !== 'orphan-key';
                if (!assigned) {
                    // Phase B1: an unassigned face's default is now an Ostwald gray hex, not hsl(...) -
                    // dormant in this specific round-trip scenario (applyPaletteToTrails colors every
                    // detected trail, so there is normally nothing left unassigned here), fixed anyway
                    // so it stays correct if that ever changes.
                    if (f.colorSpec !== undefined || !/^#([0-9a-f]{2})\1\1$/i.test(f.color)) unassignedBad++;
                    return;
                }
                assignedRows++; assignedHere++;
                const cs = f.colorSpec, a = store.get(keysNow[i]);
                if (!cs || cs.trail !== keysNow[i] || cs.system !== fc.system.id || !eq({ hue: cs.hue, w: cs.w, s: cs.s, rule: cs.rule, params: cs.params, displayColor: cs.displayColor }, a)) specBad++;
                // reconstruct the resolved color from the PARSED data only (exported system + colorSpec)
                if (sb.resolveColor(fc.system, { hue: cs.hue, w: cs.w, s: cs.s }).hex !== f.color) resolveBad++;
                // (rule, params) regenerate the same (hue, w, s)
                const gen = sb.generateHarmonyPalette(cs.rule, cs.params.idx, cs.params.slots, fc.system)[cs.params.slot];
                if (gen.hue !== cs.hue || gen.w !== cs.w || gen.s !== cs.s) regenBad++;
                if (cs.trail === trails[0].key) { ovSeen = true; if (cs.params.slot !== trails.length - 1) overrideBad++; }
            });
            if (assignedHere === 0 || !ovSeen) overrideBad++;

            // everything else in the export is exactly what the (now also eager-gray-filled, no
            // longer literally empty) baseline export would have been - the OLD second assertion
            // here ("plain has no colorSpec at all") is gone: resetting both stores to new Maps no
            // longer leaves them empty past this same S.exp() call (ensureDefaultGrayFill() refills
            // them, Phase B-Farbstrategien follow-up, gray-as-selection round) - section 1 above
            // already covers that baseline's own correctness in detail; this check stays about
            // structural equivalence once BOTH colorSpec and meta.faceColoring are stripped on
            // both sides, same as before.
            const strip = d => { const c = JSON.parse(JSON.stringify(d)); delete c.meta.faceColoring; const walk = arr => (arr || []).forEach(f => { delete f.colorSpec; f.color = 'X'; }); walk(c.geometry.faces); (c.geometry.layers || []).forEach(l => walk(l.faces)); return c; };
            sb.baseFaceAssignments = new Map(); layer.faceAssignments = new Map();
            const plain = S.exp();
            if (!eq(strip(before), strip(plain))) restBad++;
        }
    }
    check('exported system == the reference system, verbatim (constants + verified/calibrated tags travel with the data)', sysBad === 0, `${runs} runs`);
    check('colorSpec fields == the store entry that produced them (hue, w, s, rule, params), trail key attached', specBad === 0, `${assignedRows} assigned faces of ${faceRows}`);
    check('re-derived color: resolveColor(exported system, colorSpec) === face.color, exactly', resolveBad === 0);
    check('(rule, params) regenerate the same (hue, w, s) - the assignment is reconstructable, not just descriptive', regenBad === 0);
    check('meta.faceColoring lists every store entry of the sheet (orphans included) with identical values', metaBad === 0);
    check('per-trail override survives the round trip (slot != rank, in params)', overrideBad === 0, `${overrideRuns} override runs, all 4 rules, base and layer`);
    check('unassigned faces: gray hex color, no colorSpec', unassignedBad === 0);
    check('sheet isolation: an assignment on one sheet leaves the other sheet\'s faces and meta untouched', isolBad === 0);
    check('face count unchanged by assigning; formatVersion stays 1', countBad === 0 && fmtBad === 0);
    check('apart from face.color/colorSpec and meta.faceColoring, the export equals the unassigned export', restBad === 0);
}
// ---------------- 3. partial assignment (mixed assigned/unassigned faces on one sheet) ----------------
console.log('\n== 3. mixed: one assigned trail among unassigned faces ==');
{
    let runs = 0, bad = 0, ctrlBad = 0, multi = 0;
    const GRAY_HEX = /^#([0-9a-f]{2})\1\1$/i;
    for (const [shape, order, mode] of CONFIGS) {
        const A = makeSheet(SRC_NEW, shape, order, mode), B = makeSheet(SRC_OLD, shape, order, mode), sb = A.sb;
        const N = A.table.orbits.length;
        for (let t = 0; t < 8; t++) {
            const ids = randomIds(N, 3);
            A.setBase(ids); B.setBase(ids);
            const group = A.group(), res = sb.computeCellFaces(sb.connections, A.grid.nodes), trails = sb.computeFaceTrails(res, group);
            if (trails.length < 2) continue;
            runs++; multi++;
            sb.baseFaceAssignments = new Map();
            const pick = trails[trails.length >> 1].key;
            sb.setFaceAssignment(sb.baseFaceAssignments, pick, { hue: 7, w: 0.1, s: 0.2, rule: null, params: null });
            const keys = sb.computeFaceTrailKeys(res, group);
            const out = JSON.parse(JSON.stringify(A.exp())), old = JSON.parse(JSON.stringify(B.exp()));
            out.geometry.faces.forEach((f, i) => {
                if (keys[i] === pick) { if (!f.colorSpec || f.colorSpec.rule !== null || f.colorSpec.params !== null || f.color !== sb.resolveColor(out.meta.faceColoring.system, { hue: 7, w: 0.1, s: 0.2 }).hex) bad++; }
                else {
                    // Phase B1: an unassigned face's OWN color now legitimately differs from the
                    // previous commit's (evenly-spaced gray instead of evenly-spaced hue) - compare
                    // everything else byte-identical, and separately require the new color to be a
                    // genuine gray hex, not compare it away entirely.
                    // Phase B-Farbstrategien follow-up (gray-as-selection round): every OTHER trail
                    // now ALSO carries real colorSpec (ensureDefaultGrayFill()'s own gray entry,
                    // rule: 'max-contrast-gray') - no longer undefined, the previous commit never
                    // had this field at all, so it is stripped from the structural comparison the
                    // same way color already is, and checked separately for its own correctness.
                    const { color: newColor, colorSpec: newSpec, ...restNew } = f;
                    // HEAD-drift fix: this comparison was written while HEAD was still the commit BEFORE the
                    // gray-as-selection round (so the OLD side had no colorSpec on unassigned faces). Once that
                    // round was committed, HEAD itself already writes the gray colorSpec - strip it from the OLD
                    // side too, exactly as it is stripped from the new one, so only the rest is compared.
                    const { color: oldColor, colorSpec: oldSpec, ...restOld } = old.geometry.faces[i];
                    if (!newSpec || newSpec.rule !== 'max-contrast-gray' || JSON.stringify(restNew) !== JSON.stringify(restOld) || !GRAY_HEX.test(newColor)) bad++;
                }
            });
            if (JSON.stringify(out.geometry.faces) === JSON.stringify(old.geometry.faces)) ctrlBad++;      // control: the assignment must change SOMETHING
        }
    }
    check('one assigned trail: its faces get the explicit colorSpec + hex color; every other trail gets a real gray-filled colorSpec (rule: max-contrast-gray), otherwise byte-identical to the previous commit\'s', bad === 0, `${runs} runs`);
    check('control: an assigned export really differs from the previous commit\'s (the comparison can fail)', ctrlBad === 0);
}
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
