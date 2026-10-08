/**
 * core/farborgel-selection.mjs
 * Group D Phase B4: turns this generator's own anchor ({hueIndex, registerIndex}, core/facecolor.js
 * anchorFor()) and a chosen harmony type ('2'|'3'|'4'|'W'|'B'|'S'|'V') into a real Farborgel
 * HarmonySelection - the REAL reducer (color-harmony/ui/composition.mjs's reduceComposition())
 * and the REAL selection builder (color-harmony/ui/HarmonySelection.mjs's createHarmonySelection()),
 * unmodified, doing the actual work. This file only resolves the anchor to a real atlas field and
 * picks which reducer action to dispatch - no color math, no classification/provenance logic of
 * its own.
 *
 * Letter mapping (color-harmony/ui/components/Toolbar.mjs's own relationLetters, verified real,
 * not assumed): W=isotint (Weiß), B=isotone (Schwarz), S=shadowSeries (Schatten), V=isovalent (Wert).
 * '2'/'3'/'4' are cardinalities (color-harmony/ui/INTEGRATION_INTERFACE.md: Gegenfarben/Dreier/Vierer).
 *
 * Both the 7 rail buttons and the harmony dropdown (sketch.js/ui-farbe.js, browser only) call
 * buildHarmonySelection() - the one function below is the only call site for either trigger.
 */
import { createComposition, reduceComposition } from '../color-harmony/ui/composition.mjs';
import { createHarmonySelection } from '../color-harmony/ui/HarmonySelection.mjs';
import { historicalToDisplay } from '../color-harmony/ui/DisplayCalibration.mjs';
import Engine from './farborgel-engine.mjs';

export const SERIES_RELATIONS = Object.freeze({ W: 'isotint', B: 'isotone', S: 'shadowSeries', V: 'isovalent' });
const CARDINALITIES = Object.freeze(['2', '3', '4']);

/** The real atlas field (color-harmony/ColorHarmonyEngine.js's buildTriangle() output) our anchor
 * points at - the same real object every other engine call (createComposition, adoptSeries) needs,
 * not a bare {hue,w,s} triple. Throws for an out-of-range registerIndex (e.g. a stale anchor after
 * the atlas geometry changed - it hasn't, but this is not assumed away). */
export function anchorField(anchor) {
    const row = Engine.triangle(anchor.hueIndex);
    const field = row[anchor.registerIndex];
    if (!field) throw new RangeError(`farborgel-selection: no atlas field at hueIndex=${anchor.hueIndex} registerIndex=${anchor.registerIndex}`);
    return field;
}

/** The anchor's own calibrated display color - the SAME Oklab-mixed, gamut-mapped pipeline
 * HarmonySelection.mjs's createHarmonySelection() runs per member (historicalToDisplay(),
 * color-harmony/ui/DisplayCalibration.mjs), applied directly to the anchor field with no harmony
 * type needed. This is what a preview of "the anchor itself" should show, now that
 * applyHarmonyToPattern() paints with this same calibrated color instead of re-resolving through
 * core/color.js (Phase B4 follow-up) - a preview using the OTHER (core/color.js) system would show
 * a color the pattern itself no longer produces.
 * @param {{hueIndex:number, registerIndex:number}} anchor a real (non-null-register) anchor.
 * @returns {number[]} a deterministic [r,g,b] byte triple (0-255 integers).
 */
export function anchorDisplayColor(anchor) {
    return historicalToDisplay(anchorField(anchor)).rgb.slice();
}

/**
 * @param {{hueIndex:number, registerIndex:number}} anchor a real (non-null-register) anchor.
 * @param {'2'|'3'|'4'|'W'|'B'|'S'|'V'} harmonyType
 * @returns {object} a real, version-1 HarmonySelection (color-harmony/ui/HarmonySelection.mjs).
 */
export function buildHarmonySelection(anchor, harmonyType) {
    const field = anchorField(anchor);
    const composition = createComposition(field);
    const type = String(harmonyType);
    let result;
    if (CARDINALITIES.includes(type)) {
        result = reduceComposition(composition, 'generateHarmony', Number(type));
    } else if (Object.hasOwn(SERIES_RELATIONS, type)) {
        result = reduceComposition(composition, 'adoptSeries', { anchor: field, relation: SERIES_RELATIONS[type] });
    } else {
        throw new RangeError(`farborgel-selection: unknown harmony type ${harmonyType}`);
    }
    return createHarmonySelection(result);
}

// Browser bridge: ui-farbe.js (a classic script) calls these by name. Guarded so importing this
// file in Node (tools/color/test-farborgel-selection.js) never touches `window`. anchorDisplayColor
// is what ui-farbe.js's anchor preview swatch uses (Phase B4 follow-up) - anchorField stays exposed
// too, for anything that still needs the raw field (w/s/label), not just its display color.
if (typeof window !== 'undefined') {
    window.farborgelBuildHarmonySelection = buildHarmonySelection;
    window.farborgelAnchorField = anchorField;
    window.farborgelAnchorDisplayColor = anchorDisplayColor;
    // Once: the generator can already be running (setup() does not wait for this module) - ui-farbe.js unlocks what needs it on this event.
    window.dispatchEvent(new Event('farborgel-selection-ready'));
}
