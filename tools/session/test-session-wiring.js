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
 *  6. the autosave writer (P2): core/session-writer.js loads after session-store.js and before sketch.js; markDirty() is the last statement of draw();
 *     pagehide and visibilitychange (hidden) flush; the writer is created last in setup(); it is flushed before a playback starts and blocked while one
 *     runs; writes only through writeSession (the main key, quiet); "Neu anfangen" disables the writer BEFORE it removes the keys, then navigates; the
 *     confirm dialog has Cancel first (initial focus), UI.dialog with Cancel as its close button, and plain click listeners.
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
const railJs = fs.readFileSync(process.env.UI_RAIL_JS || path.join(ROOT, 'ui-rail.js'), 'utf8');

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
    const W = at('core/session-writer.js');
    check('session-writer.js has exactly one versioned tag, after session-store.js', tags.filter(t => t.src === 'core/session-writer.js').length === 1 && W > T, `writer ${W}, store ${T}`);
    check('all four come before sketch.js', K >= 0 && W < K && T < K, `writer ${W}, sketch ${K}`);
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

// ---- 6. the autosave writer (P2) ----------------------------------------------------------------------------------------------------------
console.log('\n== 6. autosave writer wiring ==');
{
    const drawBody = (sketch.match(/\nfunction draw\(\) \{([\s\S]*?)\n\}\n/) || [, ''])[1];
    const lastStmt = drawBody.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')).pop();
    check('markDirty() is the last statement of draw() (after the first draw has done its work)', lastStmt === 'if (window.sessionWriter) window.sessionWriter.markDirty();', lastStmt);
    check('...and nothing else in sketch.js calls markDirty', count(code(sketch), '.markDirty()') === 1);
    // p5 1.9.0's friendly-error reader (fesCodeReader -> removeMultilineComments) takes the source of setup() and draw() and strips block comments with a
    // loop that never ends - until "RangeError: Invalid string length" at every page load - when a `*/` comes before the first `/*`. setup() has a line comment
    // containing `*/` ("#btn-mode-*/#btn-fold-*"), so neither function may contain a block comment at all. Found by a console error that a comment caused.
    {
        const body = name => (sketch.match(new RegExp('\\nfunction ' + name + '\\(\\) \\{[\\s\\S]*?\\n\\}\\n')) || [''])[0];
        const s = body('setup'), d = body('draw');
        check('setup() and draw() contain no block comment (p5 1.9.0 FES removeMultilineComments throws on them: console error at every load)', s.length > 10000 && d.length > 1000 && !s.includes('/*') && !d.includes('/*'), `${s.length}/${d.length} chars`);
    }
    const start = sketch.indexOf('function startSessionWriter() {');
    const startBody = sketch.slice(start, sketch.indexOf('\n    // "Neu anfangen"', start));
    check('pagehide flushes the writer', /window\.addEventListener\('pagehide', \(\) => \{ writer\.flush\(\); \}\);/.test(startBody));
    check('visibilitychange flushes the writer, only when the page is hidden', /document\.addEventListener\('visibilitychange', \(\) => \{ if \(document\.visibilityState === 'hidden'\) writer\.flush\(\); \}\);/.test(startBody));
    check('the writer exists only where the storage guard allows (not in a frame)', /const guard = sessionStorageGuard\(window\);\n\s*if \(!guard\.allowed\) return null;/.test(startBody));
    check('it writes through writeSession only (main key, current URL, quiet) - the one call of writeSession in sketch.js', count(code(sketch), 'writeSession(') === 1 && /write: \(text, now\) => writeSession\(guard\.storage, text, window\.location\.href, now, true\)/.test(startBody));
    check('collect() derives the build size of layers a layer animation left mid-way (collectSessionState(..., { buildSizes: true }))', /collect: \(\) => collectSessionState\(window\.symmetryUi, \{ buildSizes: true \}\),/.test(startBody));
    check('check() runs parseSession + planSessionRestore with the live canvas size', /parseSession\(text\)/.test(startBody) && /planSessionRestore\(parsed\.snapshot, \{ canvasW, canvasH \}\)/.test(startBody));
    check('isBlocked() is "something plays" (isAnythingAnimating: layer animation, timeline, net animation)', /isBlocked: \(\) => isAnythingAnimating\(\)/.test(startBody));
    const tail = (sketch.match(/updatePatternNameStatus\(\);\n(\s*startSessionWriter\(\);[^\n]*)\n\}\n/) || [])[1];
    check('startSessionWriter() is the last call of setup() (after the restore and the first sync)', !!tail);
    check('...and it is called exactly once', count(code(sketch), 'startSessionWriter()') === 2 /* the call + the declaration */);
    // playback: flushed just before it starts
    check('toggleTimelinePlayback flushes before timeline.playing = true', /sessionFlushNow\(\);[^\n]*\n\s*timeline\.startTime = millis\(\) - timeline\.elapsedMs;\n\s*timeline\.playing = true;/.test(sketch));
    check('toggleActiveLayerAnimationPlayback flushes before anim.playing = true', /sessionFlushNow\(\);[^\n]*\n\s*anim\.startTime = millis\(\) - anim\.elapsedMs;\n\s*anim\.playing = true;/.test(sketch));
    check('sessionFlushNow() flushes the writer if there is one', /function sessionFlushNow\(\) \{ if \(window\.sessionWriter\) window\.sessionWriter\.flush\(\); \}/.test(sketch));
    // Neu anfangen
    const rs = (sketch.match(/window\.sessionRestart = function \(\) \{([\s\S]*?)\n    \};/) || [, ''])[1];
    const iDis = rs.indexOf('sessionWriter.disable()'), iMain = rs.indexOf('removeItem(SESSION_STORAGE_KEY)'), iQ = rs.indexOf('removeItem(SESSION_QUARANTINE_KEY)'), iNav = rs.indexOf('window.location.assign(window.location.pathname)');
    check('"Neu anfangen" disables the writer BEFORE it removes the keys', iDis >= 0 && iMain > iDis && iQ > iDis, `${iDis} < ${iMain},${iQ}`);
    check('...removes the main key AND the quarantine slot, and only then navigates (no search, no hash)', iMain >= 0 && iQ >= 0 && iNav > iMain && iNav > iQ, `${iMain},${iQ} < ${iNav}`);
    check('...and does not rebuild any state by hand (no rebuildGrid / assignments in it)', !/rebuildGrid|connections|additionalLayers/.test(rs));
    // the confirm dialog
    const ov = (html.match(/<div id="restart-overlay"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/) || [''])[0];
    check('index.html: the dialog has Cancel BEFORE Confirm (UI.dialog focuses the first control: Cancel has the default focus)', ov.indexOf('id="cancel-restart"') > 0 && ov.indexOf('id="confirm-restart"') > ov.indexOf('id="cancel-restart"'));
    check('index.html: the trigger lives in the rail "Mehr" popover, with a data-i18n key on every text', /<div id="more-rail"[\s\S]*?id="btn-restart"[^>]*data-i18n="restart\.open"/.test(html) && ['restart.title', 'restart.text', 'restart.cancel', 'restart.confirm'].every(k => ov.includes('data-i18n="' + k + '"')));
    check('ui-rail.js: UI.dialog with Cancel as the close button (Escape cancels)', /UI\.dialog\(restartOverlay, restartBtn, cancelRestart\)/.test(railJs));
    check('ui-rail.js: plain click listeners (not p5 mousePressed) for open, cancel and confirm', count(railJs, "restartBtn.addEventListener('click'") === 1 && count(railJs, "cancelRestart.addEventListener('click'") === 1 && count(railJs, "confirmRestart.addEventListener('click'") === 1 && !/mousePressed/.test(railJs));
    check('ui-rail.js: confirming runs window.sessionRestart()', /confirmRestart\.addEventListener\('click', function \(\) \{\n\s*if \(typeof window\.sessionRestart === 'function'\) window\.sessionRestart\(\);/.test(railJs));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
