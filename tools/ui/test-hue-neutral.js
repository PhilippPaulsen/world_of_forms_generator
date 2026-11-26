/**
 * tools/ui/test-hue-neutral.js (task 154)
 * The neutral state of the hue stepper ("-" between hue 24 and hue 1): wiring in ui-farbe.js (ring 0..24 where 0 is UI-only, enter/leave, the keys 2 3 4 as grays, the remembered harmony type
 * IN MEMORY only, the locks, the swatch, the Farborgel link), the markup (the B5 stepper is gone), the dictionary (DE and EN), the phone config (no gray entry). The behaviour itself is
 * checked in the browser pane (reports/154.md); core: tools/color/test-anchor-neutral.js.
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fails = 0, n = 0;
function check(name, ok, d) { n++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${d !== undefined ? '  [' + d + ']' : ''}`); }
const farbe = read('ui-farbe.js'), html = read('index.html'), i18n = read('ui-i18n.js'), pcfg = read('ui-phone-config.js'), css = read('style.css');
check('the B5 stepper is gone: no #farbe-gray-stepper in the markup, the code, the phone config; its dictionary keys are gone', !/farbe-gray/.test(html + farbe + pcfg) && !/'index\.graustufen|'farbe\.gray\.(title|reason|legacy)'/.test(i18n));
check('the hue field is still a number field with min 1 and max 24 (UI-only 0 is never in the markup), the neutral "-" is its placeholder with the colour of a value', /<input type="number" id="farbe-anchor-hue-input" min="1" max="24"/.test(html) && /#farbe-anchor-hue-input::placeholder \{ color: inherit; opacity: 1; \}/.test(css) && /setAttribute\('placeholder', '\\u2014'\)/.test(farbe));
check('the ring is 24 -> "-" -> 1 (compute: position 0 is the neutral, (cur + dir + 25) % 25)', /\(cur \+ dir \+ ANCHOR_HUE_COUNT \+ 1\) % \(ANCHOR_HUE_COUNT \+ 1\)/.test(farbe) && /an\.neutral === true \? 0 :/.test(farbe));
check('the change handler: 0 enters the neutral state, a hue leaves it', /if \(v === 0\) \{ enterNeutral\(a\); return; \}/.test(farbe) && /leaveNeutralTo\(a, v\);/.test(farbe));
check('entering from a harmony: remembers the REGENERABLE type in memory (neutralMemo), sets the anchor neutral, clears lastHarmonyType, colours gray; the legacy ladder (0) becomes 8', /neutralMemo = REGENERABLE_HARMONY_TYPES\.indexOf\(t\) >= 0 \? \{ sheet: activeLayer, type: t \} : null;/.test(farbe) && /setLastHarmonyTypeFor\(activeLayer, null\);/.test(farbe) && /if \(grayTones === 0\) grayTones = 8;/.test(farbe));
check('leaving to a hue: the memo of THIS sheet is applied with the new hue, else the gray stays (afterAnchorChange)', /neutralMemo\.sheet === activeLayer \? neutralMemo\.type : null/.test(farbe) && /if \(memo\) \{ applyHarmony\(memo\); sync\(\); \} else afterAnchorChange\(\);/.test(farbe));
check('the memo is dropped by: any applied harmony (applySelection: key, handoff, dropdown), Reset Color (window.applyGrayDefault), a sheet change (sync)', /neutralMemo = null; \{ const an = anchorFor\(activeLayer\); if \(an && an\.neutral\) delete an\.neutral; \}/.test(farbe) && /window\.applyGrayDefault = function \(\) \{ neutralMemo = null; applyGrayDefault\(\); \};/.test(farbe) && /neutralMemo\.sheet !== activeLayer\) neutralMemo = null;/.test(farbe));
const memoLines = (farbe.match(/neutralMemo/g) || []).length;
check('the memo never reaches the session, the autosave or the export: it is a module variable of ui-farbe.js only (no core file names it)', ['core/session.js', 'core/session-apply.js', 'core/state.js', 'core/export.js', 'core/facecolor.js'].every(f => !/neutralMemo|Memo/.test(read(f))) && memoLines > 0);
check('the keys 2 3 4: in the neutral state a key sets grayTones (the active key again = 8) and runs applyGrayDefault; they are not locked by the Farborgel loading', /function grayKey\(k\)/.test(farbe) && /grayTones = grayTones === k \? 8 : k;/.test(farbe) && /isNeutral\(\) && \/\^\[234\]\$\/\.test\(type\)\) grayKey/.test(farbe) && /neutral && \/\^\[234\]\$\/\.test\(type\) \? null : loadingAny/.test(farbe));
check('the keys are named as grays in the neutral state (the dictionary key is swapped, so a language switch keeps it) and marked active by grayTones', /'farbe\.gray\.key' \+ t/.test(farbe) && /asGray && grayTones === parseInt\(t, 10\)/.test(farbe));
check('locks with a reason in the neutral state: the Kreis / Dreieck triggers, the register stepper (owner "neutral"); only the circle family is shown', /UI\.setDisabled\(b, why \|\| neutralWhy\)/.test(farbe) && /UI\.setDisabled\(registerStepperRoot, neutralWhy, 'neutral'\)/.test(farbe) && /if \(isNeutral\(\)\) viewFamily = 'circle';/.test(farbe));
check('swatch: ONE constant NEUTRAL_SWATCH #000000 through syncAnchorPreview (row and both overlays), named "Unbunt: Weiß, Grau, Schwarz"', /const NEUTRAL_SWATCH = '#000000';/.test(farbe) && /if \(neutral\) bg = NEUTRAL_SWATCH;/.test(farbe) && (farbe.match(/#000000/g) || []).length === 1);
check('the Farborgel link opens without hue and register in the neutral state', /farborgelPageUrl\(isNeutral\(\) \? null : anchorFor\(activeLayer\), GENERATOR_TAB_ID\)/.test(farbe));
check('the names follow a language switch at once (langchange runs sync)', /addEventListener\('langchange', function \(\) \{ if \(typeof frameCount/.test(farbe));
for (const key of ['farbe.neutral.swatch', 'farbe.neutral.reason', 'farbe.gray.key2', 'farbe.gray.key3', 'farbe.gray.key4']) {
    check('dictionary has ' + key + ' (de and en)', new RegExp("'" + key.replace(/\./g, '\\.') + "': \\{ de: '[^']+', en: '[^']+' \\}").test(i18n));
}
check('sketch.js is untouched by the neutral state (it never names it)', !/neutral/.test(read('sketch.js')));
console.log(`${n - fails}/${n} checks passed`);
process.exit(fails ? 1 : 0);
