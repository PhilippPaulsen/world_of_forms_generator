/**
 * core/farborgel-bridge.js
 * Farborgel generator integration, Phase A: the adapter that turns a
 * standalone Farborgel `HarmonySelection` (color-harmony/ui/HarmonySelection.mjs,
 * version 1) into per-trail face-color assignments on an EXISTING sheet.
 * Pure logic, no DOM, no p5 - same convention as the rest of core/facecolor.js.
 *
 * SCOPE: this file only does the cyclic member-to-trail mapping and the two
 * coordinate fixes the design session found (hue-index base, gray hue). It
 * reuses setFaceAssignment()/core/facecolor.js's storage UNCHANGED - nothing
 * here reimplements the store, reconciliation, split/merge inheritance or the
 * crossfade mechanism. Those are completely unaware this file exists: every
 * assignment it makes is just another setFaceAssignment() call, identical in
 * shape to one core/color.js's own rules would make.
 *
 * NOT in this file: resolving "the active sheet" to a concrete {store, trails}
 * pair. That resolution (faceColorsGrid() -> sheetGroupElements() ->
 * computeFaceTrails() -> faceAssignmentsFor()) is sketch.js-side glue - the
 * exact same four calls renderFaceColorsPanel() and the "Spread colors"
 * handler already make (sketch.js, ~line 4341-4346) - and needs live grid/DOM
 * state a headless test cannot construct. It is deferred to the UI-wiring
 * phase; applyHarmonyToPattern() below takes the resolved store/trails
 * directly, so it stays headlessly testable against core/facecolor.js alone,
 * matching how every other function in that file is verified.
 */

// The Farborgel's hueIndex is 1-based (color-harmony/ColorHarmonyEngine.js's
// validateHue() requires 1..24, and looks up circle[hueIndex - 1]). This
// engine's own `hue` is a 0-based index into OSTWALD_REFERENCE_SYSTEM.hues
// (core/color.js's hueFullColorLinear(): `system.hues[Math.floor(hue % n)]`).
// A direct pass-through is off by one for every hue, and wraps hueIndex 24
// onto hue 0 ("hue 1") instead of hue 23 ("hue 24") - found in the design
// session, fixed here once, not at every call site.
function _farborgelHueToCoreHue(hueIndex) {
    const n = OSTWALD_REFERENCE_SYSTEM.hues.length;
    return (((hueIndex - 1) % n) + n) % n;
}

// A gray HarmonySelection member (color-harmony/ui/HarmonySelection.mjs:
// "Grays use ... hueIndex:null, v:0") has no hue at all - resolveColor()
// requires a finite `hue` and throws on null (core/color.js: "hue, w and s
// must be finite numbers"). But at v = 1 - w - s = 0, resolveColor()'s linear
// mix `v * V[...] + w * white + s * black` has its hue-dependent term
// multiplied by zero: ANY finite hue resolves to the identical color. Hue 0
// is therefore a safe, inert stand-in for "no hue" - not a guess, the
// verification below measures this by resolving the same member at several
// different substituted hues and checking the results are byte-identical.
const FARBORGEL_GRAY_HUE_SUBSTITUTE = 0;

// The real 28-register atlas order for one hue, exactly as color-harmony/ColorHarmonyEngine.js's
// buildTriangle() emits it: white letters outer loop, black letters inner loop (both in SCALE's
// a,c,e,g,i,l,n,p order), keeping only pairs where black.value - white.value > EPSILON. NOT hand-derived -
// verified by directly running that filter in Node against SCALE's real values and counting exactly 28
// results in exactly this order. core/facecolor.js's anchorFor() registerIndex (0-27) indexes this array;
// Phase B2 only stores the index (this list isn't consumed by that file, to avoid a second copy of it) -
// Phase B4's dropdown wiring is the first real consumer, for turning an index back into an atlas position.
const FARBORGEL_REGISTER_ORDER = Object.freeze([
    'ca', 'ea', 'ec', 'ga', 'gc', 'ge', 'ia', 'ic', 'ie', 'ig',
    'la', 'lc', 'le', 'lg', 'li', 'na', 'nc', 'ne', 'ng', 'ni',
    'nl', 'pa', 'pc', 'pe', 'pg', 'pi', 'pl', 'pn'
]);

// Phase B3: pure geometry for the Kreis (hue-ring) and Dreieck (register-triangle) widgets - kept here,
// not in ui-farbe.js, specifically so it stays headlessly testable (tools/color/test-anchor-widgets.js)
// with no DOM. Neither function touches the DOM or any generator state; both just turn an index into a
// 2D point, for ui-farbe.js to build real SVG elements from.

// 24 points evenly spaced on a circle, hueIndex 1 at angle 0 (12 o'clock/straight up), increasing hueIndex
// CLOCKWISE - the exact convention color-harmony/ui/views/CircleView.mjs's own point(angle,r) helper uses
// (reimplemented here, not imported - per the Phase B3 design: standalone widget, no ESM import).
function hueRingPoints(cx, cy, r) {
    const points = [];
    for (let hueIndex = 1; hueIndex <= 24; hueIndex++) {
        const angle = (hueIndex - 1) * Math.PI / 12; // 24 steps of 15 degrees
        points.push({ hueIndex, angle, x: cx + Math.sin(angle) * r, y: cy - Math.cos(angle) * r });
    }
    return points;
}

// Letter -> index in SCALE's own a,c,e,g,i,l,n,p order (0-7) - the same table
// color-harmony/ColorHarmonyEngine.js's SCALE and this file's FARBORGEL_REGISTER_ORDER derivation share.
const FARBORGEL_LETTER_INDEX = Object.freeze({ a: 0, c: 1, e: 2, g: 3, i: 4, l: 5, n: 6, p: 7 });

// The 28 registers of FARBORGEL_REGISTER_ORDER laid out as a right-triangle grid in letter-index space -
// row = the white/black letter-index distance (0..6, 7 rows of 1..7 cells summing to 28), column position
// centers each row - the exact layout color-harmony/ui/views/TriangleView.mjs's atlas-mode branch uses
// (reimplemented here, not imported). NOT an equilateral/barycentric triangle (that's the OTHER, continuum
// mode TriangleView.mjs also has, for a fully continuous w/s pick - out of scope here, the anchor's
// registerIndex is discrete). colSpacing/rowSpacing let the caller size the widget; TriangleView.mjs's own
// numbers (79, 70) were tuned for its own 640x640 canvas, not reused verbatim.
function registerTrianglePoints(cx, cy, colSpacing, rowSpacing) {
    return FARBORGEL_REGISTER_ORDER.map((label, registerIndex) => {
        const white = FARBORGEL_LETTER_INDEX[label[0]], black = FARBORGEL_LETTER_INDEX[label[1]];
        const row = 6 - (white - black - 1);
        return { registerIndex, label, row, x: cx + (black - row / 2) * colSpacing, y: cy + row * rowSpacing };
    });
}

// Phase B-Farbstrategien step 2: which harmony member each trail gets is now a pluggable
// function of (trails, inheritedRanks, M, context) -> memberIndex[] (parallel to `trails`), not
// a hardcoded `rank % M`. `inheritedRanks[i]` is trail i's OWN inherited rank (an old-system
// rule's params.slot ONLY - a prior farborgel call's params.memberIndex is a member number, not a
// rank, and is handled as a pin by applyHarmonyToPattern() itself, see its docblock below) or
// `undefined` when nothing is there yet -
// undefined, not pre-resolved to `i`, so a strategy whose OWN natural order differs from the
// plain area-sort (Rings) can tell "nothing inherited, use MY natural order" apart from "the
// inherited value happens to equal i" - collapsing that distinction earlier (an initial version
// of this code did) is a real, silent bug for any trail whose inherited rank and area rank
// coincide, not just an edge case to wave away.
const DISTRIBUTION_STRATEGIES = Object.freeze(['cyclic', 'area', 'symmetry', 'rings']);

// Cyclic (today's original, unchanged default): trail i gets member rank % M - A B C A B C.
// Natural order = area-sorted position i (trails' own existing order) when nothing inherited.
function _cyclicStrategy(trails, inheritedRanks, M) {
    return trails.map((t, i) => {
        const r = inheritedRanks[i] !== undefined ? inheritedRanks[i] : i;
        return ((r % M) + M) % M;
    });
}

// Area: CONTIGUOUS buckets instead of an interleaved cycle - trails 0..bucketSize-1 (by rank)
// all get member 0, the next bucketSize get member 1, and so on, so a real, rendered pattern
// reads as "the big trails are one color, the small ones another", not alternating. bucketSize
// = ceil(N/M) spreads the M buckets as evenly as N allows; the final clamp only matters when a
// stale inherited rank (e.g. from a since-edited pattern) exceeds the current trail count.
// Natural order = area-sorted position i, same as Cyclic, when nothing inherited.
function _areaStrategy(trails, inheritedRanks, M) {
    const N = trails.length;
    const bucketSize = Math.max(1, Math.ceil(N / M));
    return trails.map((t, i) => {
        const r = inheritedRanks[i] !== undefined ? inheritedRanks[i] : i;
        return Math.min(M - 1, Math.max(0, Math.floor(r / bucketSize)));
    });
}

// Symmetry: groups trails by their REAL symmetry role (t.faceCount - the size of this trail's
// own orbit under the sheet's group; core/facecolor.js's computeFaceTrails() already computes
// it) - a face lying on a mirror axis or rotation center has a SMALLER faceCount than a
// "generic" one (faceCount === group.ops.length), a real, already-available distinction (see
// the investigation session's own hex example: a lone faceCount=1 trail among otherwise
// faceCount=6/12 ones). Cycles members WITHIN each faceCount group independently (a LOCAL
// index 0,1,2.. per group, sorted by each trail's own inherited-or-area rank so an override
// still shifts things sensibly) instead of across the whole mixed list - the point of this
// strategy is that trails sharing a symmetry role stay visually grouped, which a single global
// cycle mixing every role together would not achieve. Groups are processed in DESCENDING
// faceCount order (generic trails - those closest to context.groupOpsCount - first) for a
// deterministic, meaningful bucket order, not arbitrary Map iteration order; groupOpsCount
// itself isn't otherwise needed by the grouping logic (faceCount alone already partitions
// correctly), but is threaded through per the confirmed design and used for this ordering.
function _symmetryStrategy(trails, inheritedRanks, M, context) {
    const rankOrI = i => inheritedRanks[i] !== undefined ? inheritedRanks[i] : i;
    const groups = new Map(); // faceCount -> [trail index, ...]
    trails.forEach((t, i) => {
        if (!groups.has(t.faceCount)) groups.set(t.faceCount, []);
        groups.get(t.faceCount).push(i);
    });
    const orderedFaceCounts = Array.from(groups.keys()).sort((a, b) => b - a);
    const memberIndex = new Array(trails.length);
    orderedFaceCounts.forEach(fc => {
        const idxs = groups.get(fc).slice().sort((a, b) => rankOrI(a) - rankOrI(b));
        idxs.forEach((trailIdx, localPos) => { memberIndex[trailIdx] = ((localPos % M) + M) % M; });
    });
    return memberIndex;
}

// Phase B-Farbstrategien: each trail's distance from the sheet's centroid, for the 'rings'
// strategy - computed LAZILY (the caller only needs to call this when 'rings' is the active
// strategy, never on the hot Cyclic/Area/Symmetry path) from a REAL computeCellFaces() result,
// not reimplemented from trails alone (computeFaceTrails()'s own {key,faceCount,area,connIndex,
// color} records carry no geometry). Representative point = this trail's FIRST face's own
// centroid (the mean of its boundary node coordinates) - matching computeFaceTrails()'s
// existing "first face represents the trail" convention for its own .color/.connIndex fields,
// not a new, second convention invented for this one strategy. Returns Map(trail key ->
// distance); a trail with no locatable face (should not happen for a real result) is omitted,
// letting _ringsStrategy()'s own `distances.get(key) || 0` fall back safely.
function computeTrailRingDistances(facesResult, group, trails) {
    const keys = computeFaceTrailKeys(facesResult, group);
    const nodeById = new Map(facesResult.nodes.map(n => [n.id, n]));
    const firstFaceIndexOf = new Map();
    facesResult.faces.forEach((f, i) => {
        if (keys[i] === null || (f.sheets && f.sheets.length >= 2)) return;
        if (!firstFaceIndexOf.has(keys[i])) firstFaceIndexOf.set(keys[i], i);
    });
    const distances = new Map();
    trails.forEach(t => {
        const faceIdx = firstFaceIndexOf.get(t.key);
        if (faceIdx === undefined) return;
        const pts = facesResult.faces[faceIdx].nodeIds.map(id => nodeById.get(id)).filter(Boolean);
        if (!pts.length) return;
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        distances.set(t.key, Math.hypot(cx - group.centroid.x, cy - group.centroid.y));
    });
    return distances;
}

// Topology-as-rings: the SAME contiguous-bucket shape as Area, but keyed by distance from the
// sheet's centroid instead of by area - "sort/bucket by that instead of by area" (confirmed
// design). Each trail's representative point is its FIRST face's own centroid (matching
// computeFaceTrails()'s existing "first face represents the trail" convention for .color/
// .connIndex - not reinventing a second convention). Distance-rank is this strategy's OWN
// natural order (replacing area-rank i, which Cyclic/Area use); an inherited rank, when
// present, still overrides it - same uniform inheritance rule as every other strategy, just
// applied on top of a different natural ordering. context.ringDistances is a Map(trail key ->
// distance), computed lazily by applyHarmonyToPattern() below ONLY when this strategy is
// selected (never on the hot Cyclic/Area/Symmetry path).
function _ringsStrategy(trails, inheritedRanks, M, context) {
    const distances = context && context.ringDistances;
    if (!distances) return _cyclicStrategy(trails, inheritedRanks, M); // defensive: no distance data given, never silently miscolor
    const N = trails.length;
    const bucketSize = Math.max(1, Math.ceil(N / M));
    const naturalRank = new Map(
        trails.slice().sort((a, b) => (distances.get(a.key) || 0) - (distances.get(b.key) || 0))
            .map((t, i) => [t.key, i])
    );
    return trails.map((t, i) => {
        const r = inheritedRanks[i] !== undefined ? inheritedRanks[i] : naturalRank.get(t.key);
        return Math.min(M - 1, Math.max(0, Math.floor(r / bucketSize)));
    });
}

const _DISTRIBUTION_FNS = Object.freeze({
    cyclic: _cyclicStrategy, area: _areaStrategy, symmetry: _symmetryStrategy, rings: _ringsStrategy
});

/**
 * Colors `trails` from a Farborgel HarmonySelection (version 1) using `strategy` (one of
 * DISTRIBUTION_STRATEGIES, default 'cyclic' - today's original A B C A B C behavior, unchanged)
 * to decide which member each trail gets. Every strategy is fed the SAME inherited-rank array:
 * trail i's OWN INHERITED rank if one exists (Phase B-Farbstrategien: an old-system rule - e.g.
 * core/color.js's max-contrast-gray, applied in Form-mode - already wrote a real `params.slot`
 * for this exact trail key into `store`; reusing it means this application lands on trails in the SAME
 * relative order that prior one established, not a freshly recomputed area-sort), falling back to trail
 * i's plain area-sorted position `i` when none is there (today's unchanged behavior, opportunistic -
 * never required). A prior FARBORGEL entry's `params.memberIndex` is NOT a rank and is not fed to the
 * strategies as one: when it was written by the same strategy with the same cardinality it is kept as a
 * pin for that trail (reapplying is idempotent), otherwise the trail is distributed afresh - see the
 * comment at the inheritance block below. The read happens BEFORE this same call's own write overwrites
 * that trail's entry, per trail, so it only ever sees what was there coming INTO this call, never a
 * just-written entry from earlier in the same forEach. Writes through
 * setFaceAssignment() exactly as core/color.js's own rules do via applyPaletteToTrails() - the
 * only difference is where the color comes from (a fixed, already-resolved member list instead
 * of generateHarmonyPalette()).
 *
 * KNOWN GAP (Phase E, not a bug): this does NOT touch the sheet's facePalette
 * (facePaletteFor()) - there is no ruleId/idx to record, since the Farborgel
 * supplies fixed colors, not a rule to regenerate. assignTrailSlot() ("drag a
 * trail to another slot") and spreadPaletteToUnassigned() ("Spread colors")
 * both read palette.ruleId first and no-op without one (see their own guards
 * in core/facecolor.js), so neither recognizes a Farborgel-sourced assignment
 * as part of a series. A Farborgel-colored sheet's trails are fully colored by
 * this call, but the per-trail override stepper and Spread have nothing to
 * work from afterwards. Deliberate scope for this phase, not an oversight -
 * see the design session's own finding.
 *
 * @param {object} selection  HarmonySelection v1 (color-harmony/ui/HarmonySelection.mjs);
 *   only `.members[].analyticalCoordinate.{hueIndex,w,s}` is read.
 * @param {Map} store   the sheet's assignment store (faceAssignmentsFor(sheet)).
 * @param {Array} trails  the sheet's current trail list (computeFaceTrails()), in
 *   its existing area-then-key order - trail i's member comes from its own inherited
 *   `params.slot` if `store` already has one for that trail key, else from `i` itself.
 * @param {string} [strategy='cyclic']  one of DISTRIBUTION_STRATEGIES.
 * @param {object} [context]  strategy-specific extra data - { groupOpsCount } for 'symmetry',
 *   { ringDistances: Map(key -> number) } for 'rings'. Unused by 'cyclic'/'area'.
 * @param {object} [provenance]  what gets recorded on each write and, with fillOnly, whether an
 *   existing entry is skipped - { ruleId, source, fillOnly }, default { ruleId: 'farborgel',
 *   source: 'harmonySelection', fillOnly: false } (today's original, unchanged behavior: every
 *   call site that doesn't pass this gets byte-identical output to before this parameter
 *   existed). Phase B-Farbstrategien follow-up (gray-as-selection round): a non-Farborgel caller
 *   (core/facecolor.js's ensureDefaultGrayFill()) passes its own ruleId/source so a gray-sourced
 *   entry is never mistagged 'farborgel' (nothing elsewhere hardcodes that string - every reader
 *   compares against rule.id/palette.ruleId generically, confirmed by reading every call site
 *   before this change), and fillOnly: true so it only ever FILLS a gap (unassignedTrails()'
 *   own trails) - never overwrites an existing entry, the same invariant
 *   reconcileFaceAssignments() already documents elsewhere in this file set ("Inheritance only
 *   FILLS"). inheritedRanks/strategy dispatch below are computed over the FULL `trails` array
 *   regardless of fillOnly, so a filled-in trail's rank is correct relative to the whole sheet,
 *   not just the gap being filled - only the final write is skipped for a trail that already
 *   has an entry.
 * @returns {number} the number of assignments actually written (trails.length unless fillOnly
 *   skipped some).
 */
function applyHarmonyToPattern(selection, store, trails, strategy = 'cyclic', context = undefined,
    provenance = { ruleId: 'farborgel', source: 'harmonySelection', fillOnly: false }) {
    if (!selection || !Array.isArray(selection.members) || !selection.members.length) {
        throw new Error('applyHarmonyToPattern: selection needs at least one member');
    }
    const fn = _DISTRIBUTION_FNS[strategy];
    if (!fn) throw new Error(`applyHarmonyToPattern: unknown strategy "${strategy}"`);
    const M = selection.members.length;
    // Two DIFFERENT kinds of inheritance, deliberately not conflated (an earlier version treated both as
    // "a rank" - a real, reproduced bug, see below):
    //  1. params.slot - an old-system rule's own entry (core/color.js, _writeSlot()) carries a real 0..N-1
    //     RANK, meaningful to every strategy. Always honored, passed to the strategy as an inherited rank.
    //  2. params.memberIndex - a prior Farborgel entry's MEMBER NUMBER (0..M-1), the outcome of a
    //     distribution, not a rank. It is only meaningful as exactly what it is: a pin. When the existing
    //     entry was produced by the SAME strategy AND the SAME cardinality M, the trail keeps that member
    //     as-is and the strategy arithmetic is skipped - reapplying the same harmony (same type, an anchor
    //     step, a per-trail override from assignFarborgelSlot()) is then idempotent for every strategy.
    //     Otherwise (a different strategy: its own natural order starts fresh; a different M: a member
    //     number from a harmony of another size cannot be mapped onto this one - the old grouping is not
    //     recoverable from member numbers alone) the trail is computed from the strategy's natural order,
    //     exactly like a trail with nothing applied yet.
    // The previous implementation fed memberIndex back into the strategies AS a rank. That is only correct
    // for Cyclic with an unchanged M (rank % M is a fixed point): Area/Rings divide it by ceil(N/M) and
    // collapse every trail into member 0 (a small 0..M-1 "rank" / a bucket of 19-45), Cyclic dropped every
    // member >= the old M after a size change, and Symmetry re-sorted by the old member number and re-cycled,
    // reshuffling which trail has which color on every reapply. Same category of mistake as the .slot reuse
    // caught in assignFarborgelSlot() (ui-farbe.js): M is almost always far smaller than N.
    // `undefined` (not a fallback to i) in inheritedRanks when nothing inheritable is there - each strategy
    // resolves its OWN fallback (area-sorted i for Cyclic/Area/Symmetry, distance-rank for Rings), so a real
    // inherited value is never confused with one that only coincides with a strategy's natural order.
    const pinned = new Array(trails.length).fill(undefined);
    const inheritedRanks = trails.map((t, i) => {
        const existing = store.get(t.key);
        if (!existing || !existing.params) return undefined;
        if (Number.isInteger(existing.params.slot)) return existing.params.slot;
        const p = existing.params;
        if (Number.isInteger(p.memberIndex) && p.strategy === strategy && p.cardinality === M && p.memberIndex >= 0 && p.memberIndex < M) {
            pinned[i] = p.memberIndex;
        }
        return undefined;
    });
    const computed = fn(trails, inheritedRanks, M, context);
    const memberIndexes = computed.map((m, i) => pinned[i] !== undefined ? pinned[i] : m);
    let written = 0;
    trails.forEach((t, i) => {
        if (provenance.fillOnly && store.has(t.key)) return; // fill only - never overwrite an existing entry
        const memberIndex = memberIndexes[i];
        const m = selection.members[memberIndex];
        const c = m.analyticalCoordinate;
        const hue = c.hueIndex === null ? FARBORGEL_GRAY_HUE_SUBSTITUTE : _farborgelHueToCoreHue(c.hueIndex);
        setFaceAssignment(store, t.key, {
            hue, w: c.w, s: c.s,
            rule: provenance.ruleId,
            params: { source: provenance.source, memberIndex, cardinality: M, strategy },
            // Farborgel follow-up: paint with the engine's OWN calibrated display color
            // (Oklab-mixed, gamut-mapped - color-harmony/ui/CALIBRATION.md) instead of
            // letting the render path re-resolve hue/w/s through this app's OWN, older,
            // uncalibrated OSTWALD_REFERENCE_SYSTEM (core/color.js) - the two hue circles
            // disagree (this app's is the "Old"/pre-calibration reference Farborgel itself
            // used to use), which is what made real Farborgel harmonies look muted, like
            // the old tetrad/isotint system. m.srgb is a deterministic, already-validated
            // [r,g,b] byte triple straight from HarmonySelection.mjs - safe to store as-is -
            // undefined (a non-Farborgel caller's synthetic member has no .srgb) becomes
            // setFaceAssignment()'s own null, so a gray-sourced entry resolves through
            // OSTWALD_REFERENCE_SYSTEM natively instead of a phantom override.
            displayColor: m.srgb
        });
        written++;
    });
    return written;
}
