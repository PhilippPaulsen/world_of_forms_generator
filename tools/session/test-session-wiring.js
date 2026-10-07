/**
 * tools/session/test-session-wiring.js
 * Phase 3 autosave, P1d: guards the WIRING of the session modules into the page, by reading source text (no browser, no vm). What it
 * pins, and why each is worth a test:
 *  1. index.html loads core/session.js, core/session-apply.js and core/session-store.js, in that order, after everything they call
 *     (forms, state, color, facecolor, farborgel-bridge, symmetry-toggles) and before sketch.js - a wrong order is a ReferenceError at
 *     startup that no Node test of the modules themselves can see; all with the page's shared ?v= string.
 *  2. sketch.js asks for a restore at ONE place - after the final rebuildGrid() of setup(), before the closing sync calls - and the old
 *     catalog / random-line branch is its unchanged else path (a restore that fails or is not due must leave the old start exactly as it was).
 *  3. restoringSymmetry (the flag that mutes uiSync()/redraw() inside the symmetry setters while the session restore drives them) is set
 *     true only inside a try whose finally resets it - so no exit path (return, throw) can leave the symmetry row dead - and the three
 *     functions that read it do so in the guarded form only.
 *  4. the object of UI hooks has exactly the steps core/session-apply.js runs, in the same order.
 *  5. the Farborgel readiness signal: core/farborgel-selection.mjs announces itself once, after its globals exist; ui-farbe.js unlocks
 *     on it (a restored sheet can be ready before the module is - what needs the module is locked until then), the colour panel
 *     rebuilds when it arrives, nothing polls for it, and Reset Color is never locked by it.
 *
 *   node tools/session/test-session-wiring.js
 *   INDEX_HTML=/path/to/mutated/index.html SKETCH_JS=/path/to/mutated/sketch.js node tools/session/test-session-wiring.js    (sabotage runs)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(process.env.INDEX_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sketch = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const applySrc = fs.readFileSync(path.join(ROOT, 'core', 'session-apply.js'), 'utf8');
const selMjs = fs.readFileSync(process.env.SELECTION_MJS || path.join(ROOT, 'core', 'farborgel-selection.mjs'), 'utf8');
const farbeJs = fs.readFileSync(process.env.UI_FARBE_JS || path.join(ROOT, 'ui-farbe.js'), 'utf8');

let failures = 0, checks = 0;
function check(name, ok, detail) { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); }
const count = (text, needle) => text.split(needle).length - 1;
const code = text => text.replace(/\/\/[^\n]*/g, '');   // line comments dropped, for counting names

// ---- 1. script order in index.html ------------------------------------------------------------------------------------------
console.log('== 1. index.html script order ==');
const tags = [...html.matchAll(/<script src="([^"?]+)\?v=([^"]+)"><\/script>/g)].map(m => ({ src: m[1], v: m[2] }));
const at = src => tags.findIndex(t => t.src === src);
{
    const S = at('core/session.js'), A = at('core/session-apply.js'), T = at('core/session-store.js'), K = at('sketch.js');
    check('each session script has exactly one versioned tag', ['core/session.js', 'core/session-apply.js', 'core/session-store.js'].every(s => tags.filter(t => t.src === s).length === 1));
    check('session.js < session-apply.js < session-store.js', S >= 0 && S < A && A < T, `${S},${A},${T}`);
    check('all three come before sketch.js', K >= 0 && T < K, `store ${T}, sketch ${K}`);
    for (const dep of ['core/forms.js', 'core/state.js', 'core/color.js', 'core/facecolor.js', 'core/farborgel-bridge.js', 'core/symmetry-toggles.js']) {
        const d = at(dep);
        check(`${dep} loads before session.js`, d >= 0 && d < S, `${d} < ${S}`);
    }
    const ver = new Set(tags.map(t => t.v));
    check('every local script tag carries the same ?v= string', ver.size === 1, [...ver].join(','));
}

// ---- 2. the startup block ---------------------------------------------------------------------------------------------------------
console.log('\n== 2. startup block in sketch.js ==');
const ELSE_BRANCH = `    } else if (catalogUrlPattern && catalogUrlPattern.layer === 'new') {
        if (!applyCatalogPatternToNewLayer(catalogUrlPattern)) addRandomConnection();
    } else if (!catalogUrlPattern || !applyCatalogPattern(catalogUrlPattern)) {
        addRandomConnection();
    }
`;
{
    const call = '    if (restoreSessionAtStartup()) {\n';
    const iCall = sketch.indexOf(call);
    check('exactly one call of restoreSessionAtStartup() in an if', iCall >= 0 && count(code(sketch), 'restoreSessionAtStartup()') === 2 /* the call + the declaration */, count(code(sketch), 'restoreSessionAtStartup()'));
    const after = iCall >= 0 ? sketch.slice(iCall) : '';
    const iElse = after.indexOf(ELSE_BRANCH);
    check('the old catalog / random-line branch follows, unchanged, as the else path', iElse > 0 && after.slice(call.length, iElse).trim().startsWith('// restored:'), iElse);
    check('only a comment sits between the call and the else (the restored case does nothing else)', iElse > 0 && /^\s*\/\/[^\n]*\n$/.test(after.slice(call.length, iElse)));
    // position: directly after the setup()-level rebuildGrid(currentShape) (4-space indent - the shape/size/node handlers call it deeper in)
    // that is the last one before the call; only comments may sit between them
    const rebuilds = [...sketch.slice(0, iCall + 1).matchAll(/\n    rebuildGrid\(currentShape\);\n/g)];
    const lastRebuild = rebuilds.length ? rebuilds[rebuilds.length - 1] : null;
    const between = lastRebuild ? sketch.slice(lastRebuild.index + lastRebuild[0].length, iCall) : null;
    check('the call follows the final setup()-level rebuildGrid(currentShape), with only comments between', between !== null && between.split('\n').every(l => /^\s*(\/\/.*)?$/.test(l)), between === null ? 'no rebuildGrid before the call' : between.length);
    check('no later setup()-level rebuildGrid(currentShape) after the call', !/\n    rebuildGrid\(currentShape\);\n/.test(sketch.slice(iCall)));
    const tailSync = ['renderLayerTabs();', 'updateOffsetControls();', 'updateFaceToggleControl();', 'updateTimelineControls();', 'redraw();'];
    const tailStart = iElse > 0 ? iCall + iElse + ELSE_BRANCH.length : -1;
    const tail = tailStart > 0 ? sketch.slice(tailStart, tailStart + 1400) : '';
    check('the closing sync calls (tabs, offsets, face toggle, timeline, redraw) still follow the block', tailSync.every(s => tail.includes('    ' + s)) && tail.indexOf('    renderLayerTabs();') < tail.indexOf('    redraw();'));
    check('the definition of restoreSessionAtStartup() is above the call', sketch.indexOf('function restoreSessionAtStartup()') > 0 && sketch.indexOf('function restoreSessionAtStartup()') < iCall);
    check('a failed restore never reloads on its own except for resyncFailed', count(code(sketch), 'location.reload()') === 1 && /if \(applied\.resyncFailed\) location\.reload\(\);/.test(sketch));
    check('no writer is wired (P1d restores only)', !/writeSession\s*\(/.test(sketch));
}

// ---- 3. restoringSymmetry ------------------------------------------------------------------------------------------------------------
console.log('\n== 3. restoringSymmetry ==');
{
    check('declared once, false', count(sketch, 'let restoringSymmetry = false;') === 1);
    check('set true exactly once', count(sketch, 'restoringSymmetry = true;') === 1);
    check('reset to false exactly once besides the declaration, and it is in a finally', count(sketch, 'restoringSymmetry = false;') === 2 && count(sketch, 'finally { restoringSymmetry = false; }') === 1);
    const m = sketch.match(/restoringSymmetry = true;\n(\s*)try \{([\s\S]*?)\n\s*\} finally \{ restoringSymmetry = false; \}/);
    check('the true assignment is directly followed by try { ... } finally { reset }', !!m);
    const body = m ? m[2] : '';
    check('nothing between the assignment and the try can throw (they are adjacent), and the try body contains no return', !!m && !/\breturn\b/.test(body));
    check('the try body is the two setter calls and nothing else', !!m && body.split('\n').map(s => s.trim()).filter(Boolean).join(' ') === 'if (category !== null && category !== undefined) ui.setCategory(category); if (fold !== null && fold !== undefined) ui.setFold(fold);');
    check('the read-back checks come after the finally (the flag is already false when they throw)', (() => { const f = sketch.indexOf('} finally { restoringSymmetry = false; }'); const t = sketch.indexOf('the symmetry controls did not take'); return f > 0 && t > f; })());
    check('updateSymmetryModeControl: uiSync only while the flag is false', /if \(window\.uiSync && !restoringSymmetry\) window\.uiSync\(\);/.test(sketch));
    const cat = sketch.match(/function applySymmetryCategory\(category\) \{[\s\S]*?\n    \}/), fold = sketch.match(/function applySymmetryFold\(fold\) \{[\s\S]*?\n    \}/);
    check('applySymmetryCategory: redraw only while the flag is false', !!cat && /\n        if \(!restoringSymmetry\) redraw\(\);\n/.test(cat[0]) && !/\n\s*redraw\(\);/.test(cat[0].replace('if (!restoringSymmetry) redraw();', '')));
    check('applySymmetryFold: redraw only while the flag is false', !!fold && /\n        if \(!restoringSymmetry\) redraw\(\);\n/.test(fold[0]) && !/\n\s*redraw\(\);/.test(fold[0].replace('if (!restoringSymmetry) redraw();', '')));
    check('the flag is read in exactly those three places and nowhere else', count(code(sketch), 'restoringSymmetry') === 1 /* declaration */ + 1 /* true */ + 1 /* finally */ + 3 /* readers */);
}

// ---- 4. the hooks ------------------------------------------------------------------------------------------------------------------------
console.log('\n== 4. hook object ==');
{
    const steps = (applySrc.match(/const SESSION_HOOK_STEPS = Object\.freeze\(\[([^\]]*)\]\)/) || [, ''])[1].split(',').map(s => s.replace(/['"\s]/g, '')).filter(Boolean);
    const obj = sketch.match(/const sessionHooks = \{([\s\S]*?)\n    \};\n    window\.sessionUi = sessionHooks;/);
    const keys = obj ? [...obj[1].matchAll(/\n        ([A-Za-z]+)(?:\(|:)/g)].map(m => m[1]) : [];
    check('core/session-apply.js lists the seven steps', steps.join() === 'shapeAndInputs,symmetry,toggles,net,layers,timeline,finish', steps.join());
    check('sessionHooks defines symmetryUi and then the same steps in the same order', keys.join() === 'symmetryUi,' + steps.join(), keys.join());
    check('window.sessionUi is that object', !!obj);
}

// ---- 5. the Farborgel readiness signal ----------------------------------------------------------------------------------------------------
console.log('\n== 5. Farborgel readiness signal ==');
{
    const EV = "'farborgel-selection-ready'";
    const block = (selMjs.match(/if \(typeof window !== 'undefined'\) \{([\s\S]*?)\n\}/) || [, ''])[1];
    const iG = block.indexOf('window.farborgelBuildHarmonySelection = buildHarmonySelection;'), iE = block.indexOf('window.dispatchEvent(new Event(' + EV + '));');
    check('core/farborgel-selection.mjs dispatches the event once, inside the window guard', count(selMjs, EV) === 1 && iE > 0);
    check('...after all three globals exist', iG >= 0 && iE > block.indexOf('window.farborgelAnchorDisplayColor = anchorDisplayColor;') && iE > iG);
    check('ui-farbe.js listens for it and runs sync() (only once the first draw has happened)', new RegExp("window\\.addEventListener\\(" + EV + ", function \\(\\) \\{ if \\(typeof frameCount !== 'undefined' && frameCount > 0\\) sync\\(\\); \\}\\);").test(farbeJs));
    check('no polling for the module in sketch.js', !/setInterval|farborgelBuildHarmonySelection[\s\S]{0,200}setTimeout/.test(code(sketch)) && !/waitedMs/.test(sketch));
    check('the colour panel rebuilds when the module arrives (its signature includes the module)', /farborgel: typeof window\.farborgelBuildHarmonySelection === 'function'/.test(sketch));
    check('the lock reads the module state, with the exact regenerable types', /REGENERABLE_HARMONY_TYPES = \['2', '3', '4', 'B', 'W', 'S', 'V'\]/.test(farbeJs) && /typeof window\.farborgelBuildHarmonySelection === 'function'/.test(farbeJs));
    check('locked: the 7 harmony buttons and the dropdown (any sheet)', /UI\.setDisabled\(harmonyBtns\[type\], loadingAny\)/.test(farbeJs) && /harmonySelect\.disabled = !!loadingAny/.test(farbeJs));
    check('locked on a regenerable sheet: the strategy icons, the anchor steppers (also their compute(), which the arrow keys use) and the anchor points', /UI\.setDisabled\(r, loadingSheet\)/.test(farbeJs) && /UI\.setDisabled\(b, loadingSheet\)/.test(farbeJs) && count(farbeJs, 'const lock = moduleWhy(true);') === 2 && /UI\.setDisabled\(r, moduleWhy\(true\)\)/.test(farbeJs));
    check('NOT locked by it: Reset Color and the Kreis/Dreieck triggers', /UI\.setDisabled\(resetBtn, why\)/.test(farbeJs) && /UI\.setDisabled\(b, why\); \}\);\n    Object\.keys\(harmonyBtns\)/.test(farbeJs));
    check('the reason text exists under its key', /'reason\.farborgel\.loading': 'Farborgel lädt noch\.'/.test(farbeJs));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
