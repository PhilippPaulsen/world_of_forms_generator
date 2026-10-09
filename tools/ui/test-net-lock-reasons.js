// Guard for the net-lock reasons (rail rearrangement, commit 3): source text of index.html and sketch.js. No browser.
//   node tools/ui/test-net-lock-reasons.js
//   INDEX_HTML=... SKETCH_JS=... node tools/ui/test-net-lock-reasons.js        (sabotage runs)
//
// Why. Toggle Curve and Free Clothing moved into the "Mehr" popover (commit 2). A text that tells the user that Curve or Free are off, or that face fills need straight lines, now has to say WHERE those
// controls are. The reasons are plain string literals in sketch.js (the note in the Netz group, its Field variant, the face-fill reason) and in index.html (#net-locks-note); the title reasons on the Curve /
// Free / Fill buttons themselves name no control and sit on the control, so they stay as they are, and the Fill reasons stay factual. Nothing else about the lock may change: it is still the native
// `disabled` plus a title (UI.setDisabled, which also gives touch a reason, is the planned 5c step), and the lock code never touches the Mehr button's own title / aria-label.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const HTML = read('INDEX_HTML', 'index.html');
const SKETCH = read('SKETCH_JS', 'sketch.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };

console.log('== the reasons that name Curve or Free say where they are ==');
{
    const note = (HTML.match(/<div id="net-locks-note" hidden>([\s\S]*?)<\/div>/) || [, ''])[1];
    check('#net-locks-note (the note in the Netz group) names Curve and free-clothing and says they are under Mehr', /Curve/.test(note) && /free-clothing \(under Mehr\)/.test(note), note.slice(0, 70));
    check('...and keeps its other content: face-fill modes, "exact on a Field warp", the way back ("Set the net back to Regular")', /face-fill modes are off while a net transform is active/.test(note) && /only exact on a Field warp/.test(note) && /Set the net back to Regular \(Base sheet, square\) to use them again\./.test(note));
    const field = (SKETCH.match(/note\.elt\.dataset\.fieldText = '([^']*)'/) || [, ''])[1];
    check('the Field variant of that note (dataset.fieldText in sketch.js) names Curve and free-clothing and says they are under Mehr', /^Curve and free-clothing \(under Mehr\) are off while a net transform is active/.test(field) && /under Mehr/.test(field), field.slice(0, 80));
    check('...and keeps its other content (lines kept straight, face fills exact on a Field, the way back)', /lines are kept straight/.test(field) && /Face fills are exact on a Field/.test(field) && /Set the net back to Regular \(Base sheet, square\) to use curves again\./.test(field));
    const m = SKETCH.match(/if \(curveType\.kind !== 'straight'\) return '([^']*)';/);
    check('the face-fill reason "Face fills need straight lines (curve/free mode is on ...)" says where Curve and Free are (under Mehr)', !!m && /^Face fills need straight lines \(curve\/free mode is on; both are under Mehr\)\.$/.test(m[1]), m && m[1]);
}

console.log('\n== what stays as it was ==');
{
    check('the title reason on the Curve and Free buttons is unchanged: "Off while a net transform is active" (it names no control and sits on the control)', /\[curveBtn, freeBtn\]\.filter\(Boolean\)\.forEach\(b => \{ b\.elt\.disabled = active; b\.elt\.title = active \? 'Off while a net transform is active' : b\.elt\.dataset\.title; \}\);/.test(SKETCH));
    const fill = (SKETCH.match(/faceBtn\.elt\.title = !active \? faceBtn\.elt\.dataset\.title : faceOk \? faceBtn\.elt\.dataset\.title : \(isField \? '([^']*)' : '([^']*)'\);/) || [, '', '']);
    check('the Fill reasons stay factual and name no popover: "Face fills on a Field: ... only" and "Off while a net transform is active (faces are exact only on a Field)"', fill[1] === 'Face fills on a Field: the base sheet and layers on the base grid (same shape and size, no offset, no rotation) only' && fill[2] === 'Off while a net transform is active (faces are exact only on a Field)' && !/Mehr/.test(fill[1] + fill[2]));
    const nw = SKETCH.match(/return 'Face fills are off on a Single or Tiled net transform[^']*';/), nw2 = SKETCH.match(/return 'Face fills on a Field are drawn for the Base sheet[^']*';/);
    check('the other face-fill reasons (Single / Tiled net, a layer off the base grid) are factual and unchanged: they name no Curve or Free and no Mehr', !!nw && !!nw2 && !/Mehr|[Cc]urve|[Ff]ree/.test(nw[0] + nw2[0]));
    check('the lock is still the native `disabled` plus a title (UI.setDisabled, which gives touch a reason, is the planned 5c step): Curve, Free and Fill are set with `.elt.disabled =`', /b\.elt\.disabled = active;/.test(SKETCH) && /faceBtn\.elt\.disabled = active && !faceOk;/.test(SKETCH) && !/UI\.setDisabled\((curveBtn|freeBtn|faceBtn)/.test(SKETCH));
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
