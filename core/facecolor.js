/**
 * core/facecolor.js
 * Roadmap 1.10a / Group D (Ostwald color harmony), Phase 2: which color a
 * face gets when the user has ASSIGNED one - the geometric face-trail key,
 * the per-sheet assignment store, and the render-path override. Phase 1's
 * core/color.js supplies the color math (resolveColor()); nothing here is
 * UI (Phase 3) or export (Phase 4).
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
            applied++;
        } catch (err) { /* stale/invalid entry: keep the default color */ }
    });
    return applied;
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
