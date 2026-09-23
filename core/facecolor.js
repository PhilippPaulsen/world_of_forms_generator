/**
 * core/facecolor.js
 * Roadmap 1.10a / Group D (Ostwald color harmony), Phase 2: which color a
 * face gets when the user has ASSIGNED one - the geometric face-trail key,
 * the per-sheet assignment store, and the render-path override. Phase 1's
 * core/color.js supplies the color math (resolveColor()); nothing here is
 * DOM (the Phase 3 Face Colors panel lives in sketch.js and drives the
 * trail/palette/highlight functions in the Phase 3 section below) or export
 * (Phase 4).
 *
 * WHY assignments cannot live on face objects: computeCellFaces()
 * (core/faces.js) is re-run on EVERY redraw (core/tiling.js's
 * drawTessellation()), so every face object is brand new each frame. An
 * assignment therefore has to be found again from the face's GEOMETRY.
 *
 * THE KEY (design session, confirmed): the face's vertex set, canonicalized
 * over the sheet's symmetry group - each group element g maps every vertex
 * of the face, the mapped coordinates are rounded to 0.01px, sorted, and
 * serialized; the lexicographic MINIMUM over all g is the key. All copies
 * of one face under the group (its "trail" / face orbit) share one key, so
 * one assignment colors the whole trail - finer than connIndex classes
 * (measured: 43 of 66 real patterns had more trails than connIndex
 * classes), which is why connIndex was not used. A centroid-only key was
 * rejected (concentric faces collided in 2 of 80 patterns); the vertex set
 * separates them.
 *
 * WHICH GROUP: the one that GENERATED the faces. collectCellSegments()
 * (core/faces.js) draws through drawShapeCell() without a shape/mode
 * override, i.e. with the GLOBAL currentShape/symmetryMode/outerCorners,
 * even for a layer - so that is the group the face set is symmetric under,
 * and sheetGroupElements() below uses exactly it (with the sheet's own
 * node array as the cache identity). Using a layer's own symmetryMode
 * instead would be wrong whenever it differs from the base's.
 *
 * ORPHANS: nothing here ever deletes a store entry. An edit that removes
 * or reshapes a face just leaves its key unmatched (see the Phase 2
 * split/merge investigation); the entry is inert, and comes back to life
 * if the geometry does (undo, or drawing the face again). Whether to prune
 * is a Phase 3 decision, not made here.
 *
 * Pure except for sheetGroupElements()/faceAssignmentsFor() (live-app glue,
 * last section) - the key/apply functions take everything explicitly, so
 * they can be tested headlessly.
 */

// Rounding resolution of the key: 0.01px (design session).
const FACE_KEY_SCALE = 100;

// The canonical trail key for one face: `coords` = [{x,y}, ...] (the face's
// boundary vertices, any order), `ops` = the group's coordinate transforms
// (core/orbits.js computeGroupElements().ops, ops[g](point, center)),
// `center` = the group's fixed point (the sheet centroid).
function faceTrailKey(coords, ops, center) {
    let best = null;
    for (let g = 0; g < ops.length; g++) {
        const pts = coords.map(p => {
            const q = ops[g](p, center);
            return [Math.round(q.x * FACE_KEY_SCALE), Math.round(q.y * FACE_KEY_SCALE)];
        });
        pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const s = pts.map(p => (p[0] + 0) + ',' + (p[1] + 0)).join(';'); // + 0: turns -0 into 0
        if (best === null || s < best) best = s;
    }
    return best;
}

// Keys for every face of a findFaces()/computeCellFaces() result, parallel
// to facesResult.faces. `group` = computeGroupElements()-shaped
// {ops, centroid}. A face with no coordinates (cannot happen for real
// results) gets null.
function computeFaceTrailKeys(facesResult, group) {
    const nodeById = new Map(facesResult.nodes.map(n => [n.id, n]));
    return facesResult.faces.map(face => {
        const coords = face.nodeIds.map(id => nodeById.get(id)).filter(Boolean);
        return coords.length ? faceTrailKey(coords, group.ops, group.centroid) : null;
    });
}

// Validates and stores one assignment: {hue, w, s, rule, params}. hue/w/s
// are checked by actually resolving them (resolveColor() throws outside
// the Ostwald triangle), so a bad entry can never get in and later break
// rendering. rule/params are provenance for the Phase 3 UI (which rule +
// stepper positions produced this color); the render path only reads
// hue/w/s. The stored record is a copy.
function setFaceAssignment(store, key, assignment) {
    resolveColor(OSTWALD_REFERENCE_SYSTEM, assignment); // throws if invalid
    store.set(key, {
        hue: assignment.hue, w: assignment.w, s: assignment.s,
        rule: assignment.rule === undefined ? null : assignment.rule,
        params: assignment.params === undefined ? null : assignment.params
    });
}

// The render-path override: for every face of `facesResult` whose trail
// key has an assignment in `store`, replaces face.color (orbitColor()'s
// hsl string) with the assigned color's hex. Mutates faces in place -
// they are fresh objects every redraw, so nothing persistent is touched.
// Everything else is deliberately untouched:
//  - unassigned faces keep orbitColor()'s value, and with an empty/absent
//    store (or no group) this returns before computing a single key, so
//    the unassigned path is byte-identical to before this module existed
//    and pays no cost;
//  - a cross-sheet face (sheets >= 2, CROSS_SHEET_COLOR) is skipped -
//    out of scope by design;
//  - an assignment that no longer resolves is skipped, never thrown out of
//    the render loop.
// Returns the number of faces recolored.
function applyFaceAssignments(facesResult, store, group) {
    if (!store || store.size === 0 || !group || !facesResult.faces.length) return 0;
    const keys = computeFaceTrailKeys(facesResult, group);
    let applied = 0;
    facesResult.faces.forEach((face, i) => {
        if (face.sheets && face.sheets.length >= 2) return;
        const a = keys[i] === null ? undefined : store.get(keys[i]);
        if (!a) return;
        try {
            face.color = resolveColor(OSTWALD_REFERENCE_SYSTEM, a).hex;
            // Phase 4: the full Ostwald-space data rides on the face (export:
            // face.colorSpec) so an assignment is reconstructable, not just
            // visually reproducible. Present on ASSIGNED faces only; `trail`
            // is the key that joins the face to meta.faceColoring's entry.
            face.colorSpec = { system: OSTWALD_REFERENCE_SYSTEM.id, hue: a.hue, w: a.w, s: a.s, rule: a.rule, params: a.params, trail: keys[i] };
            applied++;
        } catch (err) { /* stale/invalid entry: keep the default color */ }
    });
    return applied;
}

// Phase 4 (export): meta.faceColoring - {system, base?, layers?}. `system`
// is the WHOLE reference color system as plain data (hue anchors, white/
// black, gray-letter table, mix rule, and its verified/calibrated tags), so a
// consumer can re-derive every color without this code. base / layers[] hold
// every store entry of that sheet, orphans included (an orphan is inert but
// returns on Undo - see the header): [{trail, hue, w, s, rule, params}].
// `layerStores` = [{layerIndex, store}], layerIndex = position in the
// EXPORTED geometry.layers array (enabled layers only). Returns null when no
// sheet has an assignment, so unassigned patterns export byte-identically.
function faceColoringExportData(baseStore, layerStores) {
    const entries = store => Array.from(store.entries()).map(([trail, a]) => ({ trail, hue: a.hue, w: a.w, s: a.s, rule: a.rule, params: a.params }));
    const out = { system: JSON.parse(JSON.stringify(OSTWALD_REFERENCE_SYSTEM)) };
    let any = false;
    if (baseStore && baseStore.size) { out.base = entries(baseStore); any = true; }
    const layers = (layerStores || []).filter(l => l.store && l.store.size).map(l => ({ layerIndex: l.layerIndex, assignments: entries(l.store) }));
    if (layers.length) { out.layers = layers; any = true; }
    return any ? out : null;
}

// ----------------- TRAILS, PALETTE, HIGHLIGHT (Phase 3) -------------
// Pure logic behind the Face Colors panel (sketch.js); no DOM here.

// The distinct face trails of a computeCellFaces() result, one entry per
// key: {key, faceCount, area, connIndex, color}. `color` is the color the
// trail is DRAWN with right now (its first face's face.color: an assigned
// hex, or orbitColor()'s default). Order is by total area, largest first
// (area rounded to 0.01 so float noise cannot reorder equal trails), ties
// by key - deterministic for a given geometry, so a palette's slot i keeps
// meaning the same trail across redraws. A cross-sheet face never belongs
// to a trail.
function computeFaceTrails(facesResult, group) {
    const keys = computeFaceTrailKeys(facesResult, group);
    const byKey = new Map();
    facesResult.faces.forEach((f, i) => {
        if (keys[i] === null || (f.sheets && f.sheets.length >= 2)) return;
        let t = byKey.get(keys[i]);
        if (!t) { t = { key: keys[i], faceCount: 0, area: 0, connIndex: f.connIndex, color: f.color }; byKey.set(keys[i], t); }
        t.faceCount++;
        t.area += f.area;
    });
    return Array.from(byKey.values()).sort((a, b) =>
        (Math.round(b.area * 100) - Math.round(a.area * 100)) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

// A sheet's palette state: which harmony rule is applied, the chosen index
// per rule axis (one k/c stepper each), and per-trail slot overrides
// (trail key -> slot of the SAME generated series). Plain data; the
// assignments themselves live in the sheet's store.
function newFacePalette() {
    return { ruleId: null, idx: [], overrides: new Map() };
}

// Colors the sheet's trails from its palette: the rule generates exactly
// one color per trail (slots = trails.length) and trail i gets slot i -
// unless the palette holds an override for it, which moves that trail to
// another slot of the SAME series (never a color from outside it). Every
// trail is (re)assigned through setFaceAssignment(), recording the rule and
// {idx, slot, slots} as provenance. Assignments of keys that are no longer
// trails (orphans) are left alone. Returns {colors, slotOf} (slotOf: key ->
// slot), or null when no rule is applied or there are no trails.
function applyPaletteToTrails(store, trails, palette) {
    if (!palette || !palette.ruleId || trails.length === 0) return null;
    const colors = generateHarmonyPalette(palette.ruleId, palette.idx, trails.length);
    const slotOf = new Map();
    trails.forEach((t, i) => {
        const o = palette.overrides.get(t.key);
        const slot = (o !== undefined && o >= 0 && o < colors.length) ? o : i;
        const c = colors[slot];
        setFaceAssignment(store, t.key, { hue: c.hue, w: c.w, s: c.s, rule: palette.ruleId, params: { idx: palette.idx.slice(), slot, slots: trails.length } });
        slotOf.set(t.key, slot);
    });
    return { colors, slotOf };
}

// "Reset colors": back to the default symmetry-orbit coloring - clears the
// sheet's assignment store (orphans included) and its palette state.
function resetFaceColors(sheet) {
    const store = faceAssignmentsFor(sheet);
    if (store) store.clear();
    if (sheet === 'base') baseFacePalette = null;
    else if (additionalLayers[sheet]) additionalLayers[sheet].facePalette = null;
    if (faceHover && faceHover.sheet === sheet) faceHover = null;
}

// Hover highlight: the trail whose swatch row is under the pointer gets
// its faces flagged (face.highlight), which drawFaceFillsAtTile() outlines
// on every tile. Flags only faces of the matching key, on the fresh
// per-redraw face objects; returns how many were flagged.
const FACE_HIGHLIGHT_COLOR = '#ff2d55';
function markHighlightedTrail(facesResult, key, group) {
    if (!key || !group || !facesResult.faces.length) return 0;
    const keys = computeFaceTrailKeys(facesResult, group);
    let n = 0;
    facesResult.faces.forEach((f, i) => { if (keys[i] === key) { f.highlight = true; n++; } });
    return n;
}

// ----------------- LIVE-APP GLUE ---------------------------------

// The group elements the CURRENT sheet's faces are symmetric under - see
// the header ("WHICH GROUP"). gridNodes = the sheet's own node array
// (global `nodes` for the base, layer.nodes for a layer). null if the
// engine cannot build them (a grid not symmetric under its claimed group -
// a real bug elsewhere, warned once, never allowed to take rendering down;
// the caller then simply applies no assignments).
let faceGroupWarned = false;
function sheetGroupElements(gridNodes) {
    try {
        return getGroupElementsCached(gridNodes, centroid, currentShape, symmetryMode, outerCorners);
    } catch (err) {
        if (!faceGroupWarned) { faceGroupWarned = true; console.warn('Group elements unavailable - face color assignments not applied:', err.message); }
        return null;
    }
}

// The assignment store of one sheet: 'base', or an integer index into
// additionalLayers[]. The base's lives in state.js (reset whenever the
// grid is rebuilt - its keys are geometry of the old grid); a layer's
// lives ON the layer object, so it follows the layer through deletion and
// reindexing (additionalLayers.splice) with no bookkeeping. Created lazily,
// so every layer literal (addLayer(), the timeline playback layer) works
// unchanged.
function faceAssignmentsFor(sheet) {
    if (sheet === 'base') return baseFaceAssignments;
    const layer = additionalLayers[sheet];
    if (!layer) return null;
    if (!layer.faceAssignments) layer.faceAssignments = new Map();
    return layer.faceAssignments;
}

// The palette state of one sheet ('base' or a layer index), created lazily
// like the assignment store. Base's lives in state.js (null = fresh, reset
// with the grid); a layer's on the layer object.
function facePaletteFor(sheet) {
    if (sheet === 'base') { if (!baseFacePalette) baseFacePalette = newFacePalette(); return baseFacePalette; }
    const layer = additionalLayers[sheet];
    if (!layer) return null;
    if (!layer.facePalette) layer.facePalette = newFacePalette();
    return layer.facePalette;
}

// The trail key to outline on `sheet`'s faces right now (hover), or null.
function faceHighlightKeyFor(sheet) {
    return faceHover && faceHover.sheet === sheet ? faceHover.key : null;
}
