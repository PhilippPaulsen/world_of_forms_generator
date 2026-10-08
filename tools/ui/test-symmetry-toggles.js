// Test for core/symmetry-toggles.js: the mapping between the four categories, the two visible states of the
// Form row's symmetry control plus the "other" state, and the category+fold <-> raw mode resolution.
//   node tools/ui/test-symmetry-toggles.js
const path = require('path');
const S = require(path.join(__dirname, '..', '..', 'core', 'symmetry-toggles.js'));

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const SHAPES = ['triangle', 'square', 'hex'];
const FOLDS = [3, 6];
const MODES = ['none', 'reflection_only', 'rotation3', 'rotation6', 'rotation_reflection3', 'rotation_reflection6'];

// The resolution as it stood in sketch.js BEFORE the 'mirror' category (copied verbatim).
function oldResolve(shape, category, fold) {
    if (category === 'none') return 'none';
    if (shape === 'hex') {
        if (category === 'spiegeling') return fold === 3 ? 'rotation_reflection3' : 'rotation_reflection6';
        return fold === 3 ? 'rotation3' : 'rotation6';
    }
    return category === 'spiegeling' ? 'rotation_reflection6' : 'rotation3';
}

console.log('== 1. categories <-> the two visible states + "other" ==');
{
    check('the four categories', eq([...S.SYMMETRY_CATEGORIES].sort(), ['drehling', 'mirror', 'none', 'spiegeling']));
    check('rotation -> "rotation"; rotation + mirror -> "rotation+mirror" (the default)',
        S.symmetryVisibleState('drehling') === 'rotation' && S.symmetryVisibleState('spiegeling') === 'rotation+mirror');
    check('none and mirror-only are the "other" state (neither main option is active)',
        S.symmetryVisibleState('none') === 'other' && S.symmetryVisibleState('mirror') === 'other');
    check('the "other" categories are exactly none and mirror', eq([...S.SYMMETRY_OTHER_CATEGORIES].sort(), ['mirror', 'none']) &&
        S.SYMMETRY_CATEGORIES.every(c => (S.symmetryVisibleState(c) === 'other') === S.SYMMETRY_OTHER_CATEGORIES.includes(c)));
    check('a main option sets its category; "other" has no main option',
        S.symmetryCategoryForVisible('rotation') === 'drehling' && S.symmetryCategoryForVisible('rotation+mirror') === 'spiegeling' &&
        S.symmetryCategoryForVisible('other') === null);
    check('visible state -> category -> visible state round trip for the two main options',
        ['rotation', 'rotation+mirror'].every(v => S.symmetryVisibleState(S.symmetryCategoryForVisible(v)) === v));
    check('rotation / mirror content of each category',
        S.symmetryHasRotation('drehling') && S.symmetryHasRotation('spiegeling') && !S.symmetryHasRotation('none') && !S.symmetryHasRotation('mirror') &&
        S.symmetryHasMirror('mirror') && S.symmetryHasMirror('spiegeling') && !S.symmetryHasMirror('none') && !S.symmetryHasMirror('drehling'));
}

console.log('\n== 2. category + fold -> raw mode ==');
{
    let same = 0, total = 0;
    for (const shape of SHAPES) for (const fold of FOLDS) for (const c of ['none', 'drehling', 'spiegeling']) {
        total++; if (S.symmetryModeFor(shape, c, fold) === oldResolve(shape, c, fold)) same++;
    }
    check('the three old categories resolve exactly as before (regression against the old function)', same === total, `${same}/${total}`);
    check('mirror resolves to reflection_only for every shape and fold',
        SHAPES.every(s => FOLDS.every(f => S.symmetryModeFor(s, 'mirror', f) === 'reflection_only')));
    check('hexagon: fold 3/6 picks rotation3|6 and rotation_reflection3|6',
        S.symmetryModeFor('hex', 'drehling', 3) === 'rotation3' && S.symmetryModeFor('hex', 'drehling', 6) === 'rotation6' &&
        S.symmetryModeFor('hex', 'spiegeling', 3) === 'rotation_reflection3' && S.symmetryModeFor('hex', 'spiegeling', 6) === 'rotation_reflection6');
    check('triangle/square: fold has no effect (rotation3==rotation6 collapse)',
        ['triangle', 'square'].every(s => S.symmetryModeFor(s, 'drehling', 3) === S.symmetryModeFor(s, 'drehling', 6) &&
            S.symmetryModeFor(s, 'spiegeling', 3) === S.symmetryModeFor(s, 'spiegeling', 6)));
    check('the default (spiegeling, hexagon, fold 6) is rotation_reflection6 - today\'s start state',
        S.symmetryModeFor('hex', 'spiegeling', 6) === 'rotation_reflection6');
}

console.log('\n== 3. raw mode -> category (inverse); every mode stays representable ==');
{
    check('every one of the six raw modes has a category', MODES.every(m => S.symmetryCategoryFoldFor(m, 6)));
    check('reflection_only is exactly "mirror" (it used to be approximated by spiegeling)',
        S.symmetryCategoryFoldFor('reflection_only', 6).category === 'mirror');
    const hexRound = MODES.every(m => { const cf = S.symmetryCategoryFoldFor(m, 6); return S.symmetryModeFor('hex', cf.category, cf.fold) === m; });
    check('hexagon: mode -> category+fold -> mode is exact for all six modes', hexRound);
    const collapse = { rotation6: 'rotation3', rotation_reflection3: 'rotation_reflection6' };
    const tsRound = ['triangle', 'square'].every(s => MODES.every(m => {
        const cf = S.symmetryCategoryFoldFor(m, 6);
        return S.symmetryModeFor(s, cf.category, cf.fold) === (collapse[m] || m);
    }));
    check('triangle/square: round trip is exact up to the 3==6 collapse (rotation6->rotation3, rotation_reflection3->6)', tsRound);
    check('a mode without a fold of its own keeps the caller\'s current fold (none, reflection_only)',
        S.symmetryCategoryFoldFor('none', 3).fold === 3 && S.symmetryCategoryFoldFor('reflection_only', 3).fold === 3);
    // what a catalog back-link / paste can carry: each of the six modes lands on a visible state or on "other"
    const visible = Object.fromEntries(MODES.map(m => [m, S.symmetryVisibleState(S.symmetryCategoryFoldFor(m, 6).category)]));
    check('catalog modes: rotation3|6 -> rotation, rotation_reflection3|6 -> rotation+mirror, none and reflection_only -> other',
        visible.rotation3 === 'rotation' && visible.rotation6 === 'rotation' && visible.rotation_reflection3 === 'rotation+mirror' &&
        visible.rotation_reflection6 === 'rotation+mirror' && visible.none === 'other' && visible.reflection_only === 'other');
}

console.log('\n== 4. hexagon fold ==');
{
    check('fold applies only for the hexagon while rotation is part of the mode', SHAPES.every(s => S.SYMMETRY_CATEGORIES.every(c =>
        S.symmetryFoldApplies(c, s) === (s === 'hex' && (c === 'drehling' || c === 'spiegeling')))));
    check('a 3-fold catalog mode stays 3-fold (rotation3, rotation_reflection3)',
        S.symmetryCategoryFoldFor('rotation3', 6).fold === 3 && S.symmetryCategoryFoldFor('rotation_reflection3', 6).fold === 3);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
