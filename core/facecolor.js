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
 * WHICH GROUP: the one that GENERATED the faces - the sheet's OWN. A layer's
 * faces are expanded through drawShapeCell() with that layer's shape,
 * symmetry mode and mirror axis (collectCellSegments()'s `sheet` override, the
 * same parameters core/tiling.js draws the layer with), so sheetGroupElements()
 * builds the group from the same override. (Before the per-layer face-detection
 * fix both used the base's globals, which mismatched the drawn lines for a layer
 * with its own mode or shape.) The base sheet passes no override and uses the
 * globals, exactly as before.
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
function applyFaceAssignments(facesResult, store, group, keys = null) {
    if (!store || store.size === 0 || !group || !facesResult.faces.length) return 0;
    if (!keys) keys = computeFaceTrailKeys(facesResult, group); // callers that already computed them pass them in
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
    palette.slots = trails.length; // the length of the series now in force (frozen until the next full application)
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

// --- editing the series in force without repainting it (follow-up step 3) ---
// After a full application the palette's series is FROZEN at palette.slots
// colors: an edit that adds or removes trails does not regenerate it (that would
// repaint most surviving trails - measured 73.6-85.9%), inherited trails keep
// their slot, and the two functions below work inside that same series.

// Trails of the list that hold no assignment right now (new regions, complex
// components, anything reconciliation could not hand a color to).
function unassignedTrails(store, trails) {
    return trails.filter(t => !store.has(t.key));
}

function _writeSlot(store, palette, key, slot, slots, series) {
    const c = series[slot];
    setFaceAssignment(store, key, { hue: c.hue, w: c.w, s: c.s, rule: palette.ruleId, params: { idx: palette.idx.slice(), slot, slots } });
    return c;
}

// Per-trail override: ONE trail takes `slot` of the series in force - a single
// store write, never a re-run of the rule over the other trails. The choice
// stays inside the series (the color is series[slot]); the override is recorded
// so a later explicit full application keeps it. `fallbackSlots` = the series
// length to use if the palette has none recorded yet. Returns the color.
function assignTrailSlot(store, palette, key, slot, fallbackSlots) {
    if (!palette || !palette.ruleId) throw new Error('assignTrailSlot: no rule is applied');
    const slots = palette.slots || fallbackSlots;
    if (!Number.isInteger(slot) || slot < 0 || slot >= slots) throw new Error(`assignTrailSlot: slot ${slot} outside the series (0..${slots - 1})`);
    const series = generateHarmonyPalette(palette.ruleId, palette.idx, slots);
    const c = _writeSlot(store, palette, key, slot, slots, series);
    palette.overrides.set(key, slot);
    return c;
}

// "Spread colors": gives every UNASSIGNED trail a slot of the series in force -
// nothing that already has an assignment (inherited or overridden) is touched.
// Slot choice: the least-used slot among the trails currently holding one
// (a free slot first - one a vanished or merged trail left behind - then the
// lowest), trails taken in list order (area, largest first); deterministic, and
// spreads distinct colors as far as the series allows. Not recorded as overrides
// (nobody chose them). Returns the number of trails colored.
function spreadPaletteToUnassigned(store, trails, palette, fallbackSlots) {
    if (!palette || !palette.ruleId) return 0;
    const todo = unassignedTrails(store, trails);
    if (!todo.length) return 0;
    const slots = palette.slots || fallbackSlots || trails.length;
    const series = generateHarmonyPalette(palette.ruleId, palette.idx, slots);
    const usage = new Array(slots).fill(0);
    trails.forEach(t => {
        const a = store.get(t.key);
        if (a && a.rule === palette.ruleId && a.params && Number.isInteger(a.params.slot) && a.params.slot >= 0 && a.params.slot < slots) usage[a.params.slot]++;
    });
    todo.forEach(t => {
        let best = 0;
        for (let k = 1; k < slots; k++) if (usage[k] < usage[best]) best = k;
        _writeSlot(store, palette, t.key, best, slots, series);
        usage[best]++;
    });
    return todo.length;
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

// ----------------- EDIT INHERITANCE (Group D, follow-up step 1) -------
// What happens to an assignment when an edit changes the face structure: the
// old trail's key no longer exists, so without this its color is silently lost
// (Phase 2's split/merge investigation, Phase 3's edit+undo friction). Pure
// logic only - no snapshot storage and no render hook yet (later steps); the
// caller supplies the two face-trail snapshots (before/after an edit).
//
// Rules (design session, decided):
//  - Only trails whose key is LOST (old, absent afterwards) or NEW (present
//    afterwards, unknown before) take part; trails whose key survives are never
//    touched. Lost and new trails are linked when a face of one OVERLAPS a face
//    of the other, and union-find over those links gives components; the
//    component's shape (lost x new) decides the rule:
//      1 lost -> 1 new  "reshape"  the new trail inherits the parent's assignment
//      1 lost -> N new  "split"    EVERY child inherits it, in full
//      M lost -> 1 new  "merge"    the parent covering the most area inside the
//                                  merged face wins (ties: lower palette slot,
//                                  then key); only parents WITH an assignment compete
//      anything else               nothing: M->N "complex", N->0 "vanished" (the
//                                  entry stays as an orphan - Undo restores it),
//                                  0->1 "new" (a region with no predecessor)
//  - Inheritance only FILLS: a trail that already has an entry is never
//    overwritten (keeps Undo/redo of an orphan pure), and nothing is ever
//    deleted from the store.
//  - Guard: a snapshot with no faces (curve/free mode returns none, a cleared
//    pattern has none) is never read as "everything vanished" - the whole
//    reconciliation is skipped.

// Even area-based overlap needs no polygon clipping: two faces overlap when any
// interior sample point of one lies inside the other. Sample points per face:
// the vertex mean, the halfway points toward each vertex, and each edge
// midpoint pulled 15% toward the mean - kept only if inside the face's OWN
// polygon (a concave face's mean can fall outside it). Measured on the real
// edit corpus: switching from mean-only to these samples moved no component
// count by more than 1.5%.
function pointInPolygon(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        if ((poly[i].y > pt.y) !== (poly[j].y > pt.y) &&
            pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) inside = !inside;
    }
    return inside;
}

function faceSamplePoints(poly) {
    const m = { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length };
    const cand = [m];
    poly.forEach(v => cand.push({ x: m.x + (v.x - m.x) * 0.5, y: m.y + (v.y - m.y) * 0.5 }));
    poly.forEach((v, i) => {
        const w = poly[(i + 1) % poly.length];
        const e = { x: (v.x + w.x) / 2, y: (v.y + w.y) / 2 };
        cand.push({ x: e.x + (m.x - e.x) * 0.15, y: e.y + (m.y - e.y) * 0.15 });
    });
    const own = cand.filter(p => pointInPolygon(p, poly));
    return own.length ? own : [m];
}

// A before/after description of one sheet's faces: {faceCount, keys:Set,
// trails:Map(key -> [face index]), faces:[{key, poly, area, samples}]}.
// Cross-sheet faces are left out, like everywhere else.
function faceTrailSnapshot(facesResult, group, keys = null) {
    if (!keys) keys = computeFaceTrailKeys(facesResult, group);
    const nodeById = new Map(facesResult.nodes.map(n => [n.id, n]));
    const snap = { faceCount: 0, keys: new Set(), trails: new Map(), faces: [] };
    facesResult.faces.forEach((f, i) => {
        if (keys[i] === null || (f.sheets && f.sheets.length >= 2)) return;
        const poly = f.nodeIds.map(id => nodeById.get(id)).filter(Boolean).map(n => ({ x: n.x, y: n.y }));
        if (poly.length < 3) return;
        const idx = snap.faces.length;
        snap.faces.push({ key: keys[i], poly, area: f.area, samples: faceSamplePoints(poly) });
        snap.keys.add(keys[i]);
        if (!snap.trails.has(keys[i])) snap.trails.set(keys[i], []);
        snap.trails.get(keys[i]).push(idx);
    });
    snap.faceCount = snap.faces.length;
    return snap;
}

function _facesOverlap(a, b) {
    return a.samples.some(p => pointInPolygon(p, b.poly)) || b.samples.some(p => pointInPolygon(p, a.poly));
}

// The components of the lost/new link graph between two snapshots:
// [{kind, oldKeys, newKeys, links:[[oldFaceIdx, newFaceIdx]]}], kind as in the
// header. Deterministic: components and keys are sorted. Empty for a skipped
// (face-less) snapshot.
function classifyTrailTransitions(oldSnap, newSnap) {
    if (!oldSnap || !newSnap || !oldSnap.faceCount || !newSnap.faceCount) return [];
    const lost = [...oldSnap.keys].filter(k => !newSnap.keys.has(k)).sort();
    const fresh = [...newSnap.keys].filter(k => !oldSnap.keys.has(k)).sort();
    const parent = new Map();
    const find = x => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const union = (a, b) => parent.set(find(a), find(b));
    lost.forEach(k => find('o:' + k));
    fresh.forEach(k => find('n:' + k));
    const links = [];
    const lostSet = new Set(lost), freshSet = new Set(fresh);
    oldSnap.faces.forEach((of, i) => {
        if (!lostSet.has(of.key)) return;
        newSnap.faces.forEach((nf, j) => {
            if (!freshSet.has(nf.key) || !_facesOverlap(of, nf)) return;
            union('o:' + of.key, 'n:' + nf.key);
            links.push([i, j]);
        });
    });
    const byRoot = new Map();
    const comp = r => { if (!byRoot.has(r)) byRoot.set(r, { oldKeys: [], newKeys: [], links: [] }); return byRoot.get(r); };
    lost.forEach(k => comp(find('o:' + k)).oldKeys.push(k));
    fresh.forEach(k => comp(find('n:' + k)).newKeys.push(k));
    links.forEach(l => comp(find('o:' + oldSnap.faces[l[0]].key)).links.push(l));
    const out = [];
    for (const c of byRoot.values()) {
        const o = c.oldKeys.length, n = c.newKeys.length;
        c.kind = o === 0 ? 'new' : n === 0 ? 'vanished' : (o === 1 && n === 1) ? 'reshape' : o === 1 ? 'split' : n === 1 ? 'merge' : 'complex';
        out.push(c);
    }
    return out.sort((a, b) => (a.oldKeys[0] || '\uffff' + a.newKeys[0]) < (b.oldKeys[0] || '\uffff' + b.newKeys[0]) ? -1 : 1);
}

// Applies the inheritance rules to `store` for one edit (oldSnap -> newSnap).
// Mutates the store (fills only), returns {skipped, inherited, components}
// where each component also carries `winner` (merge) and `written` (the child
// keys that received an entry). Idempotent: reconciling a snapshot against
// itself, or running the same edit twice, changes nothing the second time.
function reconcileFaceAssignments(store, oldSnap, newSnap) {
    if (!oldSnap || !newSnap || !oldSnap.faceCount || !newSnap.faceCount) return { skipped: true, inherited: 0, components: [] };
    const components = classifyTrailTransitions(oldSnap, newSnap);
    let inherited = 0;
    const give = (comp, fromKey) => {
        const a = store.get(fromKey);
        comp.written = comp.written || [];
        comp.newKeys.forEach(child => {
            if (store.has(child)) return; // fill only
            setFaceAssignment(store, child, { hue: a.hue, w: a.w, s: a.s, rule: a.rule, params: a.params == null ? null : JSON.parse(JSON.stringify(a.params)) });
            comp.written.push(child);
            inherited++;
        });
    };
    for (const comp of components) {
        if (comp.kind === 'reshape' || comp.kind === 'split') {
            if (store.has(comp.oldKeys[0])) give(comp, comp.oldKeys[0]);
        } else if (comp.kind === 'merge') {
            // Parent's area inside the merged face = the total area of its old faces linked to it.
            const areaOf = new Map();
            comp.links.forEach(([i]) => {
                const of = oldSnap.faces[i];
                areaOf.set(of.key, (areaOf.get(of.key) || 0) + of.area);
            });
            const cands = comp.oldKeys.filter(k => store.has(k)).map(k => {
                const a = store.get(k);
                return { key: k, area: Math.round((areaOf.get(k) || 0) * 100), slot: (a.params && Number.isInteger(a.params.slot)) ? a.params.slot : Infinity };
            }).sort((x, y) => (y.area - x.area) || (x.slot - y.slot) || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
            if (cands.length) { comp.winner = cands[0].key; give(comp, comp.winner); }
        }
    }
    return { skipped: false, inherited, components };
}

// ----------------- LAZY RECONCILIATION (Group D follow-up, step 2) ----
// Where the last REAL face-trail state of each sheet is remembered, and the one
// function core/faces.js's computeCellFaces() calls to apply a store.
//
// The snapshot lives in a WeakMap keyed by the sheet's assignment STORE object
// (not in state.js): the store is already the per-sheet identity (base:
// baseFaceAssignments, layer: layer.faceAssignments), so the snapshot is per
// sheet by construction and needs no reset code of its own - a grid rebuild
// creates a new store Map (no snapshot), a deleted layer takes its store with
// it (garbage-collected), and "Reset colors" (store.clear()) is caught below.
const _faceSnapshots = new WeakMap();

function faceSnapshotFor(store) { return _faceSnapshots.get(store) || null; }

// Same key SET <=> nothing to reconcile (a key is the face's geometry).
function _sameKeySet(a, b) {
    if (a.size !== b.size) return false;
    for (const k of a) if (!b.has(k)) return false;
    return true;
}

// Applies one sheet's store to a fresh computeCellFaces() result, reconciling
// first when the face structure changed since the stored snapshot:
//  - empty/absent store: nothing is tracked - the snapshot is dropped (a later
//    first assignment must not diff against a stale one) and no key is computed,
//    so a sheet without assignments pays only this one WeakMap delete;
//  - NO faces (curve/free mode returns none; a genuinely cleared pattern has
//    none): return WITHOUT touching the snapshot. The stored snapshot stays the
//    last REAL state, so a detour into curve mode - or clearing and redrawing -
//    still reconciles against it afterwards (an empty snapshot would make every
//    trail look like it had no predecessor);
//  - no snapshot yet (the first call after the first assignment): record the
//    current state as the baseline, nothing to reconcile - the app redraws right
//    after every assignment, so the baseline is the state the colors were
//    assigned in;
//  - key set differs from the snapshot: reconcileFaceAssignments(), then the
//    snapshot becomes the new state; same key set: nothing at all.
// Keys are computed once and shared with applyFaceAssignments(). Returns the
// number of faces recolored.
function applyAssignmentsLazily(facesResult, store, gridNodes, sheet = null) {
    if (!store) return 0;
    if (store.size === 0) { _faceSnapshots.delete(store); return 0; }
    if (!facesResult.faces.length) return 0;
    const group = sheetGroupElements(gridNodes, sheet);
    if (!group) return 0;
    const keys = computeFaceTrailKeys(facesResult, group);
    const prev = _faceSnapshots.get(store);
    if (!prev) {
        _faceSnapshots.set(store, faceTrailSnapshot(facesResult, group, keys));
    } else {
        const now = new Set();
        facesResult.faces.forEach((f, i) => { if (keys[i] !== null && !(f.sheets && f.sheets.length >= 2)) now.add(keys[i]); });
        if (!_sameKeySet(prev.keys, now)) {
            const snap = faceTrailSnapshot(facesResult, group, keys);
            reconcileFaceAssignments(store, prev, snap);
            _faceSnapshots.set(store, snap);
        }
    }
    return applyFaceAssignments(facesResult, store, group, keys);
}

// ----------------- CROSSFADE (Group D item 4, phase 3) ------------------
// Face color as an animated parameter of the timeline. During playback the morphing
// playback layer's faces change every frame (75% or more of the mid-morph area has no
// counterpart at either keyframe, measured), so a face has no identity to follow and a
// geometric trail key means nothing on it. Colors are therefore a FIELD over position:
// each keyframe's coloring is a static field (its faces, each in its displayed color),
// and a live face takes the mix of the two fields sampled INSIDE it, weights (1-t, t).
// Mixing is in LINEAR LIGHT - Ostwald's own disc mixing, and this engine's mixing
// space throughout (core/color.js); complementary hues therefore pass through neutral
// at t=0.5, an accepted property, not something to work around. Pure functions here;
// playbackCrossfadeColors() below is the live glue. Nothing is ever written to a store.

// A keyframe's coloring as a field: [{poly, minX, maxX, minY, maxY, lin}] from a
// computeCellFaces() result (assigned faces carry their hex, others the default hsl).
function keyframeColorField(facesResult) {
    const nodeById = new Map(facesResult.nodes.map(n => [n.id, n]));
    const field = [];
    facesResult.faces.forEach(f => {
        const poly = f.nodeIds.map(id => nodeById.get(id)).filter(Boolean).map(n => ({ x: n.x, y: n.y }));
        if (poly.length < 3) return;
        const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
        field.push({ poly, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), lin: cssColorToLinear(f.color) });
    });
    return field;
}

function _lookupField(field, p) {
    for (const f of field) {
        if (p.x < f.minX || p.x > f.maxX || p.y < f.minY || p.y > f.maxY) continue;
        if (pointInPolygon(p, f.poly)) return f.lin;
    }
    return null;
}

// The color of each face of `facesResult` at crossfade position t (0 = fieldA, 1 =
// fieldB): per interior sample point (faceSamplePoints(), the same primitive the
// inheritance overlap test uses) look up both fields; both present -> the linear-light
// mix (1-t)*a + t*b; only one present -> that side alone; neither -> the sample is
// skipped. The face takes the mean of its samples in linear light. Returns [hex | null]
// parallel to facesResult.faces - null (no sample covered by either keyframe) leaves the
// face's own default color. At t=0 / t=1 a face that IS a keyframe face gets exactly that
// face's color. Sample-based, so the "area weighting" is the uniform average over the
// face's samples, not an exact area integral.
function crossfadeFaceColors(facesResult, fieldA, fieldB, t) {
    const nodeById = new Map(facesResult.nodes.map(n => [n.id, n]));
    return facesResult.faces.map(face => {
        const poly = face.nodeIds.map(id => nodeById.get(id)).filter(Boolean).map(n => ({ x: n.x, y: n.y }));
        if (poly.length < 3) return null;
        const acc = [0, 0, 0];
        let n = 0;
        for (const p of faceSamplePoints(poly)) {
            const a = _lookupField(fieldA, p), b = _lookupField(fieldB, p);
            let c;
            if (a && b) c = [0, 1, 2].map(k => (1 - t) * a[k] + t * b[k]);
            else c = a || b;
            if (!c) continue;
            acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; n++;
        }
        return n ? linearToHex(acc.map(v => v / n)) : null;
    });
}

// ----------------- LIVE-APP GLUE ---------------------------------

// The group elements the CURRENT sheet's faces are symmetric under - see
// the header ("WHICH GROUP"). gridNodes = the sheet's own node array
// (global `nodes` for the base, layer.nodes for a layer). null if the
// engine cannot build them (a grid not symmetric under its claimed group -
// a real bug elsewhere, warned once, never allowed to take rendering down;
// the caller then simply applies no assignments).
let faceGroupWarned = false;
function sheetGroupElements(gridNodes, sheet = null) {
    try {
        // A layer's OWN shape/mode/centroid/corners (`sheet`, see
        // faceSheetOverrideOfLayer()) - the group its faces are generated under;
        // omitted = the base's globals, as before.
        return sheet
            ? getGroupElementsCached(gridNodes, sheet.centroid, sheet.shape, sheet.symmetryMode, sheet.outerCorners)
            : getGroupElementsCached(gridNodes, centroid, currentShape, symmetryMode, outerCorners);
    } catch (err) {
        if (!faceGroupWarned) { faceGroupWarned = true; console.warn('Group elements unavailable - face color assignments not applied:', err.message); }
        return null;
    }
}

// What a LAYER's own face pipeline needs (shape, symmetry mode, centroid, outer
// corners) - the same fields core/tiling.js's override object hands to the
// tile functions that draw it. null for the base (its globals apply), so every
// base-sheet call stays exactly as it was.
function faceSheetOverrideOfLayer(layer) {
    return { shape: layer.shape, symmetryMode: layer.symmetryMode, centroid: layer.centroid, outerCorners: layer.outerCorners };
}
function faceSheetOverrideFor(sheet) {
    return sheet === 'base' || !additionalLayers[sheet] ? null : faceSheetOverrideOfLayer(additionalLayers[sheet]);
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

// ----------------- CROSSFADE: LIVE GLUE ------------------------------
// The two keyframe fields are rebuilt only when a keyframe's connections, store or grid
// change (signature below), not per frame - per frame only the sampling runs.
const _keyframeFieldCache = new WeakMap();
function keyframeFieldFor(layerIndex) {
    const layer = additionalLayers[layerIndex];
    const store = faceAssignmentsFor(layerIndex);
    const sigOf = () => JSON.stringify([layer.connections, [...store], layer.shape, layer.symmetryMode, layer.nodes.length, layer.outerCorners[0]]);
    const hit = _keyframeFieldCache.get(layer);
    if (hit && hit.sig === sigOf()) return hit.field;
    const field = keyframeColorField(computeCellFaces(layer.connections, layer.nodes, store, null, faceSheetOverrideOfLayer(layer)));
    // computeCellFaces() may have reconciled the keyframe's store against an edit (inheritance), so the
    // signature is taken AFTER it: the next frame then hits the cache instead of rebuilding once more.
    _keyframeFieldCache.set(layer, { sig: sigOf(), field });
    return field;
}

// The crossfade colors for the playback layer's current frame, or null when there is
// nothing to fade between (no timeline frame applied yet, a keyframe layer gone, or
// NEITHER bracketing keyframe has any color assignment - then the playback layer keeps
// its default orbit colors, exactly as before). One keyframe colored, the other not:
// crossfades from the colored look to the default one. timeline.currentFrame =
// {segmentIndex, localT} is written by sketch.js's applyTimelineFrame().
function playbackCrossfadeColors(facesResult) {
    if (!timeline || !timeline.currentFrame) return null;
    const { segmentIndex, localT } = timeline.currentFrame;
    const idA = timeline.keyframeLayerIds[segmentIndex], idB = timeline.keyframeLayerIds[segmentIndex + 1];
    if (!additionalLayers[idA] || !additionalLayers[idB]) return null;
    if (faceAssignmentsFor(idA).size === 0 && faceAssignmentsFor(idB).size === 0) return null;
    return crossfadeFaceColors(facesResult, keyframeFieldFor(idA), keyframeFieldFor(idB), localT);
}
