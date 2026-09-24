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
const FILES = ['forms', 'orbits', 'symmetry', 'curves', 'netwarp', 'tiling', 'faces', 'color', 'facecolor', 'export'];
const load = fromHead => FILES.map(f => fromHead
    ? execSync(`git show HEAD:core/${f}.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString()
    : fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8')).join('\n');
const SRC_NEW = load(false), SRC_OLD = load(true);
const BUILDERS = { triangle: 'buildTriangleGrid', square: 'buildSquareGrid', hex: 'buildHexGrid' };

function makeSheet(src, shape, order, mode) {
    const sb = {
        strokeWeight: () => { }, radians: d => d * Math.PI / 180, cos: Math.cos, sin: Math.sin, sqrt: Math.sqrt, abs: Math.abs, degrees: r => r * 180 / Math.PI, atan2: Math.atan2,
        dist: (a, b, c, d) => Math.hypot(c - a, d - b), console,
        segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, activeNetWarp: null, lineColor: '#000000', altNetSeed: null,
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
console.log('== 1. unassigned export is byte-identical to the last commit ==');
{
    let n = 0, bad = 0, withFaces = 0, withLayer = 0, leaked = 0;
    for (const [shape, order, mode] of CONFIGS) {
        const A = makeSheet(SRC_NEW, shape, order, mode), B = makeSheet(SRC_OLD, shape, order, mode);
        const N = A.table.orbits.length;
        for (let t = 0; t < 25; t++) {
            const ids = randomIds(N, 2 + Math.floor(rand() * 4)), lay = randomIds(N, 2 + Math.floor(rand() * 3)), useLayer = t % 2 === 1;
            for (const S of [A, B]) { S.sb.additionalLayers = []; S.setBase(ids); if (useLayer) S.addLayer(lay); }
            const a = A.exp(), b = B.exp();
            n++; if (useLayer) withLayer++;
            if ((a.geometry.faces || []).length) withFaces++;
            if (JSON.stringify(a) !== JSON.stringify(b)) bad++;
            const s = JSON.stringify(a); if (s.includes('colorSpec') || s.includes('faceColoring')) leaked++;
        }
    }
    check('no assignments: export JSON identical to the previous commit\'s (exportedAt aside)', bad === 0, `${n} exports (${withLayer} with a layer, ${withFaces} with faces), ${bad} differing`);
    check('no assignments: no colorSpec / meta.faceColoring anywhere', leaked === 0);
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
            else for (const e of metaList) { const a = store.get(e.trail); if (!a || !eq({ hue: e.hue, w: e.w, s: e.s, rule: e.rule, params: e.params }, a)) metaBad++; }
            // sheet isolation: the other sheet has no assignments -> no meta entry, no colorSpec on its faces
            if (target === 'base' ? fc.layers !== undefined : fc.base !== undefined) isolBad++;
            const otherFaces = target === 'base' ? parsed.geometry.layers[0].faces : parsed.geometry.faces;
            if (otherFaces.some(f => f.colorSpec !== undefined)) isolBad++;
            if (parsed.formatVersion !== 1) fmtBad++;

            const faces = target === 'base' ? parsed.geometry.faces : parsed.geometry.layers[0].faces;
            const keysNow = sb.computeFaceTrailKeys(sb.computeCellFaces(conns, S.grid.nodes), group);
            if (faces.length !== keysNow.length) countBad++;
            let assignedHere = 0, ovSeen = false;
            faces.forEach((f, i) => {
                faceRows++;
                const assigned = store.has(keysNow[i]) && keysNow[i] !== 'orphan-key';
                if (!assigned) {
                    if (f.colorSpec !== undefined || !/^hsl\(/.test(f.color)) unassignedBad++;
                    return;
                }
                assignedRows++; assignedHere++;
                const cs = f.colorSpec, a = store.get(keysNow[i]);
                if (!cs || cs.trail !== keysNow[i] || cs.system !== fc.system.id || !eq({ hue: cs.hue, w: cs.w, s: cs.s, rule: cs.rule, params: cs.params }, a)) specBad++;
                // reconstruct the resolved color from the PARSED data only (exported system + colorSpec)
                if (sb.resolveColor(fc.system, { hue: cs.hue, w: cs.w, s: cs.s }).hex !== f.color) resolveBad++;
                // (rule, params) regenerate the same (hue, w, s)
                const gen = sb.generateHarmonyPalette(cs.rule, cs.params.idx, cs.params.slots, fc.system)[cs.params.slot];
                if (gen.hue !== cs.hue || gen.w !== cs.w || gen.s !== cs.s) regenBad++;
                if (cs.trail === trails[0].key) { ovSeen = true; if (cs.params.slot !== trails.length - 1) overrideBad++; }
            });
            if (assignedHere === 0 || !ovSeen) overrideBad++;

            // everything else in the export is exactly what the unassigned export would have been
            const strip = d => { const c = JSON.parse(JSON.stringify(d)); delete c.meta.faceColoring; const walk = arr => (arr || []).forEach(f => { delete f.colorSpec; f.color = 'X'; }); walk(c.geometry.faces); (c.geometry.layers || []).forEach(l => walk(l.faces)); return c; };
            sb.baseFaceAssignments = new Map(); layer.faceAssignments = new Map();
            const plain = S.exp();
            if (!eq(strip(before), strip(plain))) restBad++;
            if (JSON.stringify(plain).includes('colorSpec')) restBad++;
        }
    }
    check('exported system == the reference system, verbatim (constants + verified/calibrated tags travel with the data)', sysBad === 0, `${runs} runs`);
    check('colorSpec fields == the store entry that produced them (hue, w, s, rule, params), trail key attached', specBad === 0, `${assignedRows} assigned faces of ${faceRows}`);
    check('re-derived color: resolveColor(exported system, colorSpec) === face.color, exactly', resolveBad === 0);
    check('(rule, params) regenerate the same (hue, w, s) - the assignment is reconstructable, not just descriptive', regenBad === 0);
    check('meta.faceColoring lists every store entry of the sheet (orphans included) with identical values', metaBad === 0);
    check('per-trail override survives the round trip (slot != rank, in params)', overrideBad === 0, `${overrideRuns} override runs, all 4 rules, base and layer`);
    check('unassigned faces: hsl color, no colorSpec', unassignedBad === 0);
    check('sheet isolation: an assignment on one sheet leaves the other sheet\'s faces and meta untouched', isolBad === 0);
    check('face count unchanged by assigning; formatVersion stays 1', countBad === 0 && fmtBad === 0);
    check('apart from face.color/colorSpec and meta.faceColoring, the export equals the unassigned export', restBad === 0);
}
// ---------------- 3. partial assignment (mixed assigned/unassigned faces on one sheet) ----------------
console.log('\n== 3. mixed: one assigned trail among unassigned faces ==');
{
    let runs = 0, bad = 0, ctrlBad = 0, multi = 0;
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
                else if (f.colorSpec !== undefined || JSON.stringify(f) !== JSON.stringify(old.geometry.faces[i])) bad++;   // other faces byte-identical to the previous commit's
            });
            if (JSON.stringify(out.geometry.faces) === JSON.stringify(old.geometry.faces)) ctrlBad++;      // control: the assignment must change SOMETHING
        }
    }
    check('one assigned trail: only its faces gain colorSpec + hex color; every other face is byte-identical to the previous commit\'s', bad === 0, `${runs} runs`);
    check('control: an assigned export really differs from the previous commit\'s (the comparison can fail)', ctrlBad === 0);
}
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
