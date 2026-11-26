/**
 * tools/ui/test-gray-stepper.js (task 150)
 * The gray-tones stepper of the Farbe tab (#farbe-gray-stepper): markup (in the Farbe row, before the anchor steppers, visible in both modes), the dictionary (DE and EN), its place on the
 * phone (the Farbe More sheet, as a setting), and its wiring in ui-farbe.js (writes the global grayTones, runs applyGrayDefault, locked while a harmony colours the sheet, never touches sketch.js).
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fails = 0, n = 0;
function check(name, ok, d) { n++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${d !== undefined ? '  [' + d + ']' : ''}`); }
const html = read('index.html'), farbe = read('ui-farbe.js'), i18n = read('ui-i18n.js'), pcfg = read('ui-phone-config.js');
const m = /<div class="stepper" id="farbe-gray-stepper"[^>]*>/.exec(html);
check('the stepper root exists once, role group, aria-label = title (the long German name), no data-level (visible in Einfach and Erweitert)', !!m && (html.match(/id="farbe-gray-stepper"/g) || []).length === 1 && /role="group"/.test(m[0]) && !/data-level/.test(m[0]) && /aria-label="Graustufen: /.test(m[0]) && /title="Graustufen: /.test(m[0]));
const row = html.slice(html.indexOf('id="nav-farbe"'), html.indexOf('id="face-colors-rule"'));
check('it sits in #nav-farbe, before the hue stepper and the register stepper, and the anchor preview stays the last visible item', row.indexOf('id="farbe-gray-stepper"') > 0 && row.indexOf('id="farbe-gray-stepper"') < row.indexOf('id="farbe-anchor-hue-stepper"') && row.indexOf('id="farbe-anchor-preview"') > row.indexOf('id="farbe-anchor-register-stepper"'));
check('display (spinbutton "8"), hidden range input 0..3, two chevron buttons (+1 / -1)', /id="farbe-gray-display"[^>]*role="spinbutton"[^>]*>8</.test(html) && /id="farbe-gray-input" min="0" max="3"/.test(html) && (/id="farbe-gray-stepper"[\s\S]*?<\/div>\s*<\/div>/.exec(html)[0].match(/class="stepper-btn"/g) || []).length === 2);
for (const key of ['index.graustufen', 'index.graustufen-weiter', 'index.graustufen-zurueck', 'farbe.gray.title', 'farbe.gray.reason', 'farbe.gray.legacy']) {
    const re = new RegExp("'" + key.replace(/\./g, '\\.') + "': \\{ de: '[^']+', en: '[^']+' \\}");
    check('dictionary has ' + key + ' (de and en)', re.test(i18n));
}
check('the phone puts it into the Farbe More sheet as a setting (the harmony rows stay two full rows)', /settings: \['line-weight-group', 'farbe-gray-stepper'\]/.test(pcfg));
check('ui-farbe.js writes the global grayTones from the stepper and runs applyGrayDefault() (the explicit, strategy-aware reapplication)', /grayTones = v;/.test(farbe) && /applyGrayDefault\(\);\s*\n\s*sync\(\);/.test(farbe));
check('locked with a reason while a harmony colours the sheet (lastHarmonyTypeFor non-null): compute() refuses, UI.setDisabled on the root', /function grayWhy\(\)/.test(farbe) && /lastHarmonyTypeFor\(activeLayer\)/.test(farbe.slice(farbe.indexOf('function grayWhy()'), farbe.indexOf('function grayWhy()') + 300)) && /UI\.setDisabled\(grayRoot, grayWhy\(\)\)/.test(farbe));
check('the ring is 2 3 4 8 and the legacy ladder (0) steps to 8', /GRAY_TONES = \[2, 3, 4, 8\]/.test(farbe) && /i < 0\) return \{ to: GRAY_TONES\.length - 1 \}/.test(farbe));
check('state: core/state.js declares grayTones (default 8) and session.js writes settings.grayTones always, reading absent/bad as 0', /let grayTones = GRAY_TONES_DEFAULT;/.test(read('core/state.js')) && /GRAY_TONES_DEFAULT = 8/.test(read('core/state.js')) && /settings\.grayTones = _grayTonesNormalize\(st\.grayTones\)/.test(read('core/session.js')));
console.log(`${n - fails}/${n} checks passed`);
process.exit(fails ? 1 : 0);
