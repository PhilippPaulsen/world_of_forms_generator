// Guard for the net-lock reasons (rail rearrangement, commit 3; the lock itself moved to UI.setDisabled in notices commit 11): source text of index.html and sketch.js. No browser.
//   node tools/ui/test-net-lock-reasons.js
//   INDEX_HTML=... SKETCH_JS=... node tools/ui/test-net-lock-reasons.js        (sabotage runs)
//
// Why. Toggle Curve and Free Clothing moved into the "Mehr" popover (commit 2). A text that tells the user that Curve or Free are off, or that face fills need straight lines, has to say WHERE those
// controls are. Since commit 11 the reasons sit on the controls (UI.setDisabled: aria-disabled, shown as a notice on a tap) and the long note #net-locks-note under the canvas is gone: its Field
// sentence about face fills lives in #net-field-info. The reasons on the Curve / Free / Fill buttons name no control (they sit on the control), the face-fill reasons stay factual, and the lock code
// never touches the Mehr button's own title / aria-label. The handler guards and the lock conditions are pinned in test-net-lock.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const HTML = read('INDEX_HTML', 'index.html');
const SKETCH = read('SKETCH_JS', 'sketch.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };

console.log('== the long note is gone; its Field sentence has a new home ==');
{
    check('#net-locks-note is gone from index.html (no element, no id anywhere), from style.css and from sketch.js (no select, no writer, no variant texts)', !/net-locks-note/.test(HTML) && !/net-locks-note/.test(fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8')) && !/net-locks-note|dataset\.fieldText|dataset\.text\b/.test(SKETCH.replace(/\/\/[^\n]*/g, '')));
    const info = (SKETCH.match(/fieldInfo\.html\(`([^`]*)`\)/) || [, ''])[1];
    check('the Field sentence about face fills lives in #net-field-info, in the same words: "Face fills are exact on a Field and work for the base sheet and for layers on the base grid (same shape and size, no offset, no rotation - every timeline playback layer); other layers are not filled."', info.includes('Face fills are exact on a Field and work for the base sheet and for layers on the base grid (same shape and size, no offset, no rotation - every timeline playback layer); other layers are not filled.'), info.slice(0, 60));
    check('...after the sentence that was already there ("Field: macro = R = ... tiles, micro = E = ... per tile.") and shown with it: only while a net is active on a Field', /^Field: macro = R = \$\{R\} tiles, micro = E = \$\{E0\} per tile\. Face fills/.test(info) && /fieldInfo\.elt\.hidden = !\(active && isField\);/.test(SKETCH) && /id="net-field-info" hidden/.test(HTML));
    const m = SKETCH.match(/if \(curveType\.kind !== 'straight'\) return '([^']*)';/);
    check('the face-fill reason "Face fills need straight lines (curve/free mode is on; both are under Mehr)" says where Curve and Free are (under Mehr)', !!m && /^Face fills need straight lines \(curve\/free mode is on; both are under Mehr\)/.test(m[1]), m && m[1]);
}

console.log('\n== what stays as it was ==');
{
    check('the reason on the Curve and Free buttons is "Off while a net transform is active." plus the way back "Set the net back to Regular (Base sheet, square) to use curves again." (it names no control and sits on the control; the way back used to be the last sentence of the removed long note) - now handed to UI.setDisabled through lockBtn', /\[curveBtn, freeBtn\]\.filter\(Boolean\)\.forEach\(b => lockBtn\(b, active \? 'Off while a net transform is active\. Set the net back to Regular \(Base sheet, square\) to use curves again.' : null\)\);/.test(SKETCH));
    const fill = (SKETCH.match(/if \(faceBtn\) lockBtn\(faceBtn, !active \|\| faceOk \? null : \(isField \? '([^']*)' : '([^']*)'\)\);/) || [, '', '']);
    check('the Fill reasons stay factual and name no popover: "Face fills on a Field: ... only" and "Off while a net transform is active (faces are exact only on a Field)"', fill[1] === 'Face fills on a Field: the base sheet and layers on the base grid (same shape and size, no offset, no rotation) only' && fill[2] === 'Off while a net transform is active (faces are exact only on a Field)' && !/Mehr/.test(fill[1] + fill[2]));
    const nw = SKETCH.match(/return 'Face fills are off on a Single or Tiled net transform[^']*';/), nw2 = SKETCH.match(/return 'Face fills on a Field are drawn for the Base sheet[^']*';/);
    check('the other face-fill reasons (Single / Tiled net, a layer off the base grid) are factual and unchanged: they name no Curve or Free and no Mehr', !!nw && !!nw2 && !/Mehr|[Cc]urve|[Ff]ree/.test(nw[0] + nw2[0]));
    check('the lock is UI.setDisabled (aria-disabled, focusable, the reason as a notice on a tap), not the native disabled: the Curve, Free and Fill buttons are never given `.elt.disabled =` by the lock code (only the no-UI fallback inside lockBtn)', /function lockBtn\(b, reason\) \{\s*if \(window\.UI && UI\.setDisabled\) UI\.setDisabled\(b\.elt, reason\);\s*else b\.elt\.disabled = !!reason;/.test(SKETCH) && !/(curveBtn|freeBtn|faceBtn)\.elt\.disabled\s*=/.test(SKETCH) && !/b\.elt\.disabled = active/.test(SKETCH));
}

console.log('\n== the Mehr button\'s own name is not touched by the lock code ==');
{
    check('sketch.js never refers to the Mehr button (#btn-more-rail) or its popover (#more-rail): the lock code cannot overwrite its title or aria-label', !/btn-more-rail|more-rail/.test(SKETCH));
    const mb = (HTML.match(/<button id="btn-more-rail"[^>]*>/) || [''])[0];
    const title = (mb.match(/\btitle="([^"]*)"/) || [])[1], label = (mb.match(/\baria-label="([^"]*)"/) || [])[1];
    check('the Mehr button\'s title and aria-label are equal and name its content ("Mehr: Kurve, Frei, Freie Endpunkte, Alternatives Netz")', title === label && title === 'Mehr: Kurve, Frei, Freie Endpunkte, Alternatives Netz', title);
    const pop = HTML.slice(HTML.indexOf('<div id="more-rail"'), HTML.indexOf('<!-- Info card (UI rework 5a)'));
    check('"under Mehr" is true: Toggle Curve and Toggle Free Clothing are inside #more-rail', pop.includes('id="btn-toggle-curve"') && pop.includes('id="btn-toggle-free"'));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
