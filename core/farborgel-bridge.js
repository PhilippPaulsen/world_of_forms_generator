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

// Farborgel sub-page P2: the URL of the standalone Farborgel page (color-harmony/ui/index.html) pre-filled with a
// generator anchor - `?hue=9&reg=pa`. Pure (no DOM, no generator state), so it stays headlessly testable
// (tools/color/test-farborgel-prefill.js round-trips all 672 anchors through the page's own parser). hueIndex is
// Farborgel's own 1-based hue and goes through unchanged; the register goes as its two-letter atlas code (via
// FARBORGEL_REGISTER_ORDER) rather than as an index, so the page never depends on this array's order. `reg` is
// OMITTED when registerIndex is null or invalid (hue-only: the page opens on the reference circle at that hue);
// no usable hue at all = the bare page URL (the page's default start state). Relative on purpose: the same link
// works on GitHub Pages and under any local static server rooted at the repository.
const FARBORGEL_PAGE_PATH = 'color-harmony/ui/index.html';
// P3: the optional second argument is this generator tab's id (farborgelNewTabId() below). It rides along as
// `from=<id>` so the Farborgel page knows which generator tab to hand a composed selection back to - and it is
// appended whenever given, even when the anchor is unusable (a bare `?from=...` still lets the page send back).
function farborgelPageUrl(anchor, tabId) {
    const params = [];
    if (anchor && Number.isInteger(anchor.hueIndex) && anchor.hueIndex >= 1 && anchor.hueIndex <= 24) {
        params.push('hue=' + anchor.hueIndex);
        if (Number.isInteger(anchor.registerIndex) && anchor.registerIndex >= 0 && anchor.registerIndex < FARBORGEL_REGISTER_ORDER.length) {
            params.push('reg=' + FARBORGEL_REGISTER_ORDER[anchor.registerIndex]);
        }
    }
    if (typeof tabId === 'string' && FARBORGEL_TAB_ID_PATTERN.test(tabId)) params.push('from=' + tabId);
    return params.length ? FARBORGEL_PAGE_PATH + '?' + params.join('&') : FARBORGEL_PAGE_PATH;
}

// ---------------------------------------------------------------------------------------------------------
// Farborgel sub-page P3: the RETURN handoff - a HarmonySelection composed on the standalone Farborgel page
// travels back to the generator tab that opened it. Transport: a localStorage "mailbox" with two keys, one
// per direction (each has exactly one writer, so there is no read-modify-write race and no filtering by
// message kind), plus the `storage` event, which fires in the OTHER tabs only. Everything below is PURE (no DOM,
// no storage, no generator state) so it is headlessly testable (tools/color/test-farborgel-handoff.js); the
// browser glue (the listener, the apply, the ack write) is in ui-farbe.js, the Farborgel side in
// color-harmony/ui/handoff.mjs. The constants are duplicated there on purpose (a classic script and an ES
// module cannot share a file) and the test asserts they are identical.
//
//   handoff key  wof:farborgel:handoff   Farborgel -> generator  { v:1, id, to, at, selection }
//   ack key      wof:farborgel:ack       generator -> Farborgel  { v:1, id, to, ok, sheet? | reason?, at }
//
// `id` is unique per emit and MUST be: setItem() with a value identical to the stored one fires no `storage`
// event at all (measured), so a re-emit of the same selection would otherwise be silently swallowed.
// The payload is UNTRUSTED cross-page input - any script on the origin can write that key, and it did not come
// through this project's own in-page code path - so it is validated field by field before it can reach
// applyHarmonyToPattern(), and a rejection is a warning plus an ack, never a throw into the render pipeline.
// ---------------------------------------------------------------------------------------------------------
const FARBORGEL_HANDOFF_KEY = 'wof:farborgel:handoff';
const FARBORGEL_ACK_KEY = 'wof:farborgel:ack';
const FARBORGEL_TAB_ID_PATTERN = /^[0-9a-f]{12}$/;
const FARBORGEL_HANDOFF_MAX_CHARS = 512 * 1024;   // the largest real selection (24-member V series) is ~19 KB
const FARBORGEL_SELECTION_MAX_MEMBERS = 256;      // V is 24; compounds are smaller; this is a sanity bound
const FARBORGEL_HANDOFF_DEDUP_WINDOW = 20;        // handled ids remembered, so a re-delivered event cannot apply twice
// Rejection reasons the generator can put in an ack. The Farborgel page has a German + English message for each
// (color-harmony/ui/i18n.mjs, keys transferRejected_<reason>); the test asserts the two lists agree.
const FARBORGEL_ACK_REASONS = Object.freeze(['fill-off', 'sheet-unavailable', 'no-trails', 'invalid-selection', 'invalid-envelope', 'internal-error']);

// 12 lowercase hex chars (48 bits) - collision-resistant enough to tell a handful of open tabs apart, not meant
// to be cryptographic. crypto.getRandomValues also exists on non-secure origins (randomUUID does not).
function farborgelNewTabId() {
    let bytes;
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') bytes = Array.from(crypto.getRandomValues(new Uint8Array(6)));
    else bytes = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256));
    return bytes.map(b => (b < 16 ? '0' : '') + b.toString(16)).join('');
}

function _isPlainObject(x) { return typeof x === 'object' && x !== null && !Array.isArray(x); }
function _isUnit(x) { return typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1; }

// -> { ok: true, selection } | { ok: false, detail }. `selection` is the SAME object that was passed in (the
// validated record itself, not a reduced copy): applyHarmonyToPattern() reads members[].analyticalCoordinate.
// {hueIndex,w,s} and members[].srgb, and every one of those is checked here. Never throws.
function validateHarmonySelection(raw) {
    try {
        if (!_isPlainObject(raw)) return { ok: false, detail: 'selection is not an object' };
        if (raw.version !== 1) return { ok: false, detail: 'version must be 1' };
        if (raw.source !== 'farborgel') return { ok: false, detail: 'source must be "farborgel"' };
        const members = raw.members;
        if (!Array.isArray(members) || members.length < 1) return { ok: false, detail: 'members must be a non-empty array' };
        if (members.length > FARBORGEL_SELECTION_MAX_MEMBERS) return { ok: false, detail: `members has ${members.length} entries (max ${FARBORGEL_SELECTION_MAX_MEMBERS})` };
        for (let i = 0; i < members.length; i++) {
            const m = members[i];
            if (!_isPlainObject(m)) return { ok: false, detail: `member ${i} is not an object` };
            const c = m.analyticalCoordinate;
            if (!_isPlainObject(c)) return { ok: false, detail: `member ${i} has no analyticalCoordinate` };
            if (!(c.hueIndex === null || (Number.isInteger(c.hueIndex) && c.hueIndex >= 1 && c.hueIndex <= 24))) return { ok: false, detail: `member ${i} hueIndex must be null or an integer 1-24` };
            if (!_isUnit(c.w) || !_isUnit(c.s)) return { ok: false, detail: `member ${i} w and s must be numbers in 0-1` };
            if (!Array.isArray(m.srgb) || m.srgb.length !== 3 || !m.srgb.every(b => Number.isInteger(b) && b >= 0 && b <= 255)) return { ok: false, detail: `member ${i} srgb must be three integers 0-255` };
        }
        if (!_isPlainObject(raw.classification) || raw.classification.cardinality !== members.length) return { ok: false, detail: 'classification.cardinality must equal the member count' };
        if (!Number.isInteger(raw.activeMemberIndex) || raw.activeMemberIndex < 0 || raw.activeMemberIndex >= members.length) return { ok: false, detail: 'activeMemberIndex out of range' };
        return { ok: true, selection: raw };
    } catch (e) {
        return { ok: false, detail: 'unexpected shape (' + (e && e.message) + ')' };
    }
}

// Parses the raw string of a `storage` event on FARBORGEL_HANDOFF_KEY for the tab `myTabId`.
//   { ok: true, id, selection }
//   { ok: false, code: 'not-for-me' | 'duplicate' | 'empty', ... }          -> silent: no warning, no ack
//   { ok: false, code: 'invalid-envelope' | 'invalid-selection', detail, id?, addressed }
//        -> a warning; `addressed` is true when the envelope proved it was meant for this tab AND carried a usable
//           id, so a rejection ack can be written (otherwise the sender simply times out)
// `handledIds` is an array of already-processed ids (the caller keeps the last FARBORGEL_HANDOFF_DEDUP_WINDOW).
// Never throws.
function parseFarborgelHandoff(rawString, myTabId, handledIds) {
    if (rawString === null || rawString === undefined || rawString === '') return { ok: false, code: 'empty' };
    if (typeof rawString !== 'string') return { ok: false, code: 'invalid-envelope', detail: 'not a string', addressed: false };
    if (rawString.length > FARBORGEL_HANDOFF_MAX_CHARS) return { ok: false, code: 'invalid-envelope', detail: `larger than ${FARBORGEL_HANDOFF_MAX_CHARS} characters`, addressed: false };
    let env;
    try { env = JSON.parse(rawString); } catch (e) { return { ok: false, code: 'invalid-envelope', detail: 'not valid JSON', addressed: false }; }
    if (!_isPlainObject(env)) return { ok: false, code: 'invalid-envelope', detail: 'not an object', addressed: false };
    if (env.to !== myTabId) return { ok: false, code: 'not-for-me' };
    const id = (typeof env.id === 'string' && env.id.length >= 1 && env.id.length <= 64 && /^[0-9A-Za-z_-]+$/.test(env.id)) ? env.id : null;
    const addressed = id !== null;
    if (env.v !== 1) return { ok: false, code: 'invalid-envelope', detail: 'envelope version must be 1', id, addressed };
    if (id === null) return { ok: false, code: 'invalid-envelope', detail: 'envelope id missing or malformed', addressed: false };
    if (typeof env.at !== 'number' || !Number.isFinite(env.at)) return { ok: false, code: 'invalid-envelope', detail: 'envelope timestamp missing', id, addressed };
    if (Array.isArray(handledIds) && handledIds.includes(id)) return { ok: false, code: 'duplicate', id };
    const v = validateHarmonySelection(env.selection);
    if (!v.ok) return { ok: false, code: 'invalid-selection', detail: v.detail, id, addressed };
    return { ok: true, id, selection: v.selection };
}

// Remembers `id` in the dedup window (mutates and returns `handledIds`, oldest dropped past the window).
function rememberFarborgelHandoffId(handledIds, id) {
    handledIds.push(id);
    while (handledIds.length > FARBORGEL_HANDOFF_DEDUP_WINDOW) handledIds.shift();
    return handledIds;
}

// The ack the generator writes: { v:1, id, to, ok:true, sheet, at } or { v:1, id, to, ok:false, reason, at }.
// `sheet` is 'base' or the 0-based layer index; `to` is the Farborgel's tab (informational - there is one
// ack key and one Farborgel waiting per id).
function buildFarborgelAck(id, ok, detail, now) {
    const ack = { v: 1, id, ok: !!ok, at: typeof now === 'number' ? now : Date.now() };
    if (ok) ack.sheet = detail;
    else ack.reason = FARBORGEL_ACK_REASONS.includes(detail) ? detail : 'internal-error';
    return ack;
}

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
