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

/**
 * Colors `trails` from a Farborgel HarmonySelection (version 1), cyclically:
 * trail i gets selection.members[i % M] (A B C A B C ... for M members).
 * Writes through setFaceAssignment() exactly as core/color.js's own rules do
 * via applyPaletteToTrails() - the only difference is where the color comes
 * from (a fixed, already-resolved member list instead of generateHarmonyPalette()).
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
 *   its existing area-then-key order - trail i's slot is purely positional.
 * @returns {number} trails.length (assignments written).
 */
function applyHarmonyToPattern(selection, store, trails) {
    if (!selection || !Array.isArray(selection.members) || !selection.members.length) {
        throw new Error('applyHarmonyToPattern: selection needs at least one member');
    }
    const M = selection.members.length;
    trails.forEach((t, i) => {
        const memberIndex = i % M;
        const m = selection.members[memberIndex];
        const c = m.analyticalCoordinate;
        const hue = c.hueIndex === null ? FARBORGEL_GRAY_HUE_SUBSTITUTE : _farborgelHueToCoreHue(c.hueIndex);
        setFaceAssignment(store, t.key, {
            hue, w: c.w, s: c.s,
            rule: 'farborgel',
            params: { source: 'harmonySelection', memberIndex, cardinality: M }
        });
    });
    return trails.length;
}
