/*
 * Symmetry: the mapping between what the Form row shows and the four
 * categories the shell works with, and between a category (+ hexagon fold)
 * and one of the six canonical raw symmetry modes.
 * Pure: no DOM, no p5, no shared state - so it has a test
 * (tools/ui/test-symmetry-toggles.js).
 *
 *   category     raw mode (hexagon; fold 3 | 6)                shown in the Form row as
 *   'drehling'   rotation3 | rotation6                         [rotation]              (visible state 1)
 *   'spiegeling' rotation_reflection3 | rotation_reflection6   [rotation + mirror]     (visible state 2, the default)
 *   'none'       none                                          neither (the "other" state, set under More)
 *   'mirror'     reflection_only (group Z2)                    neither (the "other" state, set under More)
 *
 * The Form row has TWO independent toggles (sheets-after block, commit A1): Drehung
 * (the mode has rotation) and Spiegelung (it has a mirror); symmetryCategoryFor() /
 * symmetryToggle() make the category from them. Both on is the default (spiegeling);
 * both off is 'none' (valid). The older exclusive pair (symmetryVisibleState /
 * symmetryCategoryForVisible: rotation, or rotation + mirror, with 'none' and 'mirror'
 * as the "other" state under More) stays here, unchanged and tested, but no control uses it.
 *
 * 'spiegeling' is the historical default (Ostwald's Spiegeling covers the
 * full reflection-containing case). 'mirror' is new as a UI state: the
 * engine has always supported reflection_only (Z2) and the catalog ships
 * 8071 entries for it, but no category+fold combination of the old
 * three-button control reached it. The hexagon fold only applies while
 * rotation is part of the mode.
 *
 * Triangle and square: rotation3 == rotation6 and rotation_reflection3 ==
 * rotation_reflection6 (confirmed collapse, group verification), so fold is
 * meaningless there and one representative raw mode is picked.
 *
 * symmetryModeFor / symmetryCategoryFoldFor moved here unchanged from
 * sketch.js (resolveSymmetryMode / bestEffortCategoryFold), plus the 'mirror'
 * rows.
 */
var SYMMETRY_CATEGORIES = ['none', 'drehling', 'mirror', 'spiegeling'];
var SYMMETRY_OTHER_CATEGORIES = ['none', 'mirror'];

// Does the mode contain rotations / a reflection?
function symmetryHasRotation(category) { return category === 'drehling' || category === 'spiegeling'; }
function symmetryHasMirror(category) { return category === 'mirror' || category === 'spiegeling'; }

// What the main control shows: 'rotation' | 'rotation+mirror' | 'other'.
function symmetryVisibleState(category) {
    if (category === 'drehling') return 'rotation';
    if (category === 'spiegeling') return 'rotation+mirror';
    return 'other';
}

// The category a main option sets (null for 'other': it has no main option).
function symmetryCategoryForVisible(state) {
    if (state === 'rotation') return 'drehling';
    if (state === 'rotation+mirror') return 'spiegeling';
    return null;
}

// The Form row's TWO independent toggles (Drehung, Spiegelung) and the category they make: none | drehling | mirror | spiegeling.
// Pure: (rotation, mirror) -> category, and the category after flipping ONE half ('rotation' | 'mirror'). They never touch the fold
// or a raw mode id: symmetryModeFor() / sketch.js's setCategory stay the only writers of the mode.
function symmetryCategoryFor(rotation, mirror) {
    return rotation ? (mirror ? 'spiegeling' : 'drehling') : (mirror ? 'mirror' : 'none');
}
function symmetryToggle(category, which) {
    const rotation = symmetryHasRotation(category), mirror = symmetryHasMirror(category);
    if (which === 'rotation') return symmetryCategoryFor(!rotation, mirror);
    if (which === 'mirror') return symmetryCategoryFor(rotation, !mirror);
    return category;
}

// The hexagon's 3-/6-fold choice only applies while rotation is part of the mode.
function symmetryFoldApplies(category, shape) {
    return shape === 'hex' && symmetryHasRotation(category);
}

function symmetryModeFor(shape, category, fold) {
    if (category === 'none') return 'none';
    if (category === 'mirror') return 'reflection_only';
    if (shape === 'hex') {
        if (category === 'spiegeling') return fold === 3 ? 'rotation_reflection3' : 'rotation_reflection6';
        return fold === 3 ? 'rotation3' : 'rotation6';
    }
    return category === 'spiegeling' ? 'rotation_reflection6' : 'rotation3';
}

// The inverse of symmetryModeFor(): exact for all six raw modes (reflection_only
// is now 'mirror'; it used to be approximated by 'spiegeling'). currentFold is
// the caller's own fallback for the modes without a fold of their own.
function symmetryCategoryFoldFor(mode, currentFold) {
    return {
        none: { category: 'none', fold: currentFold },
        reflection_only: { category: 'mirror', fold: currentFold },
        rotation3: { category: 'drehling', fold: 3 },
        rotation6: { category: 'drehling', fold: 6 },
        rotation_reflection3: { category: 'spiegeling', fold: 3 },
        rotation_reflection6: { category: 'spiegeling', fold: 6 },
    }[mode];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SYMMETRY_CATEGORIES, SYMMETRY_OTHER_CATEGORIES, symmetryHasRotation, symmetryHasMirror,
        symmetryVisibleState, symmetryCategoryForVisible, symmetryFoldApplies, symmetryModeFor,
        symmetryCategoryFoldFor, symmetryCategoryFor, symmetryToggle,
    };
}
