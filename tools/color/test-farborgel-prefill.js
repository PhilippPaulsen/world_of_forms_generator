/**
 * tools/color/test-farborgel-prefill.js
 * Headless verification of Farborgel sub-page P2: anchor pre-fill through the page URL.
 *
 *   node tools/color/test-farborgel-prefill.js
 *
 * The two halves live in different worlds, so this test is where they meet:
 *   generator  core/farborgel-bridge.js   farborgelPageUrl(anchor)         (classic script, loaded into a vm)
 *   Farborgel  color-harmony/ui/state.mjs anchorOverridesFromSearch() + createState()   (REAL ES module, unmodified)
 * and the independent ORACLE is the generator's own resolver, core/farborgel-selection.mjs anchorField(anchor) -
 * the atlas field an anchor points at when it drives a harmony. "Round trip" therefore means: for every real
 * anchor the page opens on exactly the field the generator is looking at.
 *
 *   1. URL shape: exact strings
 *   2. ROUND TRIP, all 24 x 28 = 672 real anchors: build URL -> parse -> createState -> the oracle's field
 *   3. hue-only (registerIndex null / invalid): no `reg` in the URL, the page opens on the reference circle
 *   4. unusable input (every case warns exactly once, falls back correctly, NEVER throws - createState itself
 *      wraps hue 0/25 and throws on strings/decimals/unknown registers, which would be a blank page)
 *   5. no/unrelated parameters: today's default start state, silently
 *   6. farborgelPageUrl() on garbage anchors
 *   7. fuzz: whatever the URL says, the parser + createState never throw
 *   8. wiring: app.mjs really uses the parser, ui-farbe.js really keeps the link's href current every sync()
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..', '..');

let failures = 0, checks = 0;
function check(name, ok, detail) {
    checks++; if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);

async function main() {
    // ---- the generator half: the real classic script, in a sandbox ----
    const sb = {};
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'core/farborgel-bridge.js'), 'utf8') + '\nthis.__api = { farborgelPageUrl, FARBORGEL_REGISTER_ORDER, FARBORGEL_PAGE_PATH };', sb);
    const { farborgelPageUrl, FARBORGEL_REGISTER_ORDER, FARBORGEL_PAGE_PATH } = sb.__api;

    // ---- the Farborgel half: the real ES modules ----
    const S = await imp('color-harmony/ui/state.mjs');
    const { anchorField } = await imp('core/farborgel-selection.mjs');
    const searchOf = url => new URL(url, 'http://localhost/').search;
    const parse = (search) => { const warnings = []; const overrides = S.anchorOverridesFromSearch(search, (...a) => warnings.push(a.join(' '))); return { overrides, warnings }; };
    const defaults = S.createState();
    const brief = st => ({ hue: st.selectedHue, reg: st.selectedRegister, view: st.activeView, circleMode: st.circleMode, source: st.selectedField.source, fieldHue: st.selectedField.hueIndex, label: st.selectedField.label ?? null, members: st.composition.activeHarmony.members.length });

    console.log('== 1. URL shape ==');
    {
        check('the page path is color-harmony/ui/index.html', FARBORGEL_PAGE_PATH === 'color-harmony/ui/index.html');
        check('hue 9 + register "pa" -> ?hue=9&reg=pa', farborgelPageUrl({ hueIndex: 9, registerIndex: FARBORGEL_REGISTER_ORDER.indexOf('pa') }) === 'color-harmony/ui/index.html?hue=9&reg=pa');
        check('the first anchor (hue 1, registerIndex 0 = "ca") -> ?hue=1&reg=ca', farborgelPageUrl({ hueIndex: 1, registerIndex: 0 }) === 'color-harmony/ui/index.html?hue=1&reg=ca');
        check('the last anchor (hue 24, registerIndex 27 = "pn") -> ?hue=24&reg=pn', farborgelPageUrl({ hueIndex: 24, registerIndex: 27 }) === 'color-harmony/ui/index.html?hue=24&reg=pn');
        check('the URL is relative (works on GitHub Pages and under any local root)', !/^[a-z]+:|^\//i.test(farborgelPageUrl({ hueIndex: 3, registerIndex: 3 })));
        check('the register order is the 28 lowercase two-letter atlas codes, and matches the Farborgel page\'s own list exactly',
            FARBORGEL_REGISTER_ORDER.length === 28 && eq([...FARBORGEL_REGISTER_ORDER], S.registers), `${FARBORGEL_REGISTER_ORDER.length} vs ${S.registers.length}`);
    }

    console.log('\n== 2. round trip: every real anchor (24 hues x 28 registers) ==');
    {
        let n = 0, urlBad = 0, warnBad = 0, stateBad = 0, oracleBad = 0, numBad = 0, membersBad = 0; const firstBad = [];
        for (let h = 1; h <= 24; h++) for (let i = 0; i < 28; i++) {
            n++;
            const anchor = { hueIndex: h, registerIndex: i };
            const url = farborgelPageUrl(anchor);
            if (url !== `color-harmony/ui/index.html?hue=${h}&reg=${FARBORGEL_REGISTER_ORDER[i]}`) urlBad++;
            const { overrides, warnings } = parse(searchOf(url));
            if (warnings.length) warnBad++;
            const st = S.createState(overrides);
            const f = st.selectedField, oracle = anchorField(anchor);
            if (!(f.source === 'atlas' && st.circleMode === 'atlas' && st.selectedHue === h && st.selectedRegister === FARBORGEL_REGISTER_ORDER[i] && f.label === `${h}${FARBORGEL_REGISTER_ORDER[i]}`)) { stateBad++; if (firstBad.length < 3) firstBad.push(`${h}/${i}`); }
            if (!(f.label === oracle.label && f.hueIndex === oracle.hueIndex && f.source === oracle.source)) oracleBad++;
            if (!(f.w === oracle.w && f.s === oracle.s && f.v === oracle.v)) numBad++;
            if (st.composition.activeHarmony.members.length !== 1) membersBad++;
        }
        check(`${n} anchors: the built URL is exactly ?hue=<h>&reg=<code>`, urlBad === 0 && n === 672, `${urlBad} bad`);
        check('...parsing it never warns (every real anchor is valid input)', warnBad === 0, `${warnBad} warned`);
        check('...createState lands on that atlas field (source atlas, hue, register, label, circleMode atlas)', stateBad === 0, `${stateBad} bad ${firstBad.join(' ')}`);
        check('...and it is the SAME field the generator\'s own resolver (anchorField) points at: label, hue, source', oracleBad === 0, `${oracleBad} bad`);
        check('...with identical analytical coordinates (w, s, v)', numBad === 0, `${numBad} bad`);
        check('...and the composition starts as that single member', membersBad === 0, `${membersBad} bad`);
    }

    console.log('\n== 3. hue-only ==');
    {
        let urlBad = 0, stateBad = 0, warnBad = 0;
        for (let h = 1; h <= 24; h++) {
            const url = farborgelPageUrl({ hueIndex: h, registerIndex: null });
            if (url !== `color-harmony/ui/index.html?hue=${h}`) urlBad++;
            const { overrides, warnings } = parse(searchOf(url));
            if (warnings.length || 'selectedRegister' in overrides) warnBad++;
            const b = brief(S.createState(overrides));
            if (!(b.source === 'reference' && b.fieldHue === h && b.circleMode === 'reference' && b.hue === h && b.label === null && b.members === 1 && b.view === 'circle')) stateBad++;
        }
        check('24 hues, registerIndex null: the URL carries no `reg`', urlBad === 0, `${urlBad} bad`);
        check('...parsing is silent and sets no register', warnBad === 0, `${warnBad} bad`);
        check('...the page opens on the reference circle at that hue (a full-color vertex: source reference, no label, circleMode reference)', stateBad === 0, `${stateBad} bad`);
        const same = [undefined, null, -1, 28, 1.5, '3', NaN].every(r => farborgelPageUrl({ hueIndex: 5, registerIndex: r }) === 'color-harmony/ui/index.html?hue=5');
        check('an invalid registerIndex (undefined / null / -1 / 28 / 1.5 / "3" / NaN) is treated exactly like hue-only', same);
    }

    console.log('\n== 4. unusable input: warn once, fall back, never throw ==');
    {
        const defaultBrief = brief(defaults);
        const badHues = ['0', '25', '9.5', '09', '+9', '-1', ' 9', '9 ', 'abc', '', '1e1', '٩', '99', '024', '9a', '0x9', 'NaN', 'Infinity', '9%20'];
        let throws = 0, notDefault = 0, notOneWarn = 0, notEmpty = 0;
        for (const hv of badHues) {
            let res;
            try {
                res = parse('?hue=' + encodeURIComponent(hv) + '&reg=pa');
                if (!eq(res.overrides, {})) notEmpty++;
                if (res.warnings.length !== 1) notOneWarn++;
                if (!eq(brief(S.createState(res.overrides)), defaultBrief)) notDefault++;
            } catch (e) { throws++; }
        }
        check(`${badHues.length} invalid hues (0, 25, 9.5, 09, +9, -1, spaces, text, empty, exponent, non-ASCII digit, ...) with a valid reg: BOTH ignored, overrides {}`, notEmpty === 0, `${notEmpty} bad`);
        check('...each warns exactly once', notOneWarn === 0, `${notOneWarn} bad`);
        check('...the page state is exactly today\'s default start state', notDefault === 0, `${notDefault} bad`);
        check('...and none of them throws', throws === 0, `${throws} threw`);
        // the evidence for WHY the parser has to be strict: raw createState does not cope
        const raw = (v) => { try { const st = S.createState({ selectedHue: v }); return `ok->hue ${st.selectedHue}`; } catch (e) { return 'THROWS'; } };
        check('control: raw createState({selectedHue}) would silently WRAP 0 -> 24 and 25 -> 1 and THROW on "9" / 9.5 (why the parser exists)',
            raw(0) === 'ok->hue 24' && raw(25) === 'ok->hue 1' && raw('9') === 'THROWS' && raw(9.5) === 'THROWS', `0:${raw(0)} 25:${raw(25)} "9":${raw('9')} 9.5:${raw(9.5)}`);

        const badRegs = ['zz', 'PA', 'Pa', 'p', 'pa ', ' pa', '', '12', 'paa', 'ab', 'pa%00'];
        let regNotHueOnly = 0, regWarn = 0, regThrow = 0, regWrongState = 0;
        for (const rv of badRegs) {
            try {
                const res = parse('?hue=9&reg=' + encodeURIComponent(rv));
                if (!eq(res.overrides, { selectedHue: 9 })) regNotHueOnly++;
                if (res.warnings.length !== 1) regWarn++;
                const b = brief(S.createState(res.overrides));
                if (!(b.source === 'reference' && b.fieldHue === 9)) regWrongState++;
            } catch (e) { regThrow++; }
        }
        check(`${badRegs.length} invalid registers with a valid hue: fall back to hue-only (overrides {selectedHue: 9})`, regNotHueOnly === 0, `${regNotHueOnly} bad`);
        check('...each warns exactly once, and the page opens on the reference circle at hue 9', regWarn === 0 && regWrongState === 0, `${regWarn} warn, ${regWrongState} state`);
        check('...and none throws', regThrow === 0);

        const regOnly = parse('?reg=pa');
        check('reg without hue: ignored ({}), one warning, default start state', eq(regOnly.overrides, {}) && regOnly.warnings.length === 1 && eq(brief(S.createState(regOnly.overrides)), defaultBrief));
        const hueEmptyReg = parse('?hue=9&reg=');
        check('"?hue=9&reg=" (reg present but empty) = invalid reg -> hue-only with one warning', eq(hueEmptyReg.overrides, { selectedHue: 9 }) && hueEmptyReg.warnings.length === 1);
    }

    console.log('\n== 5. no / unrelated parameters = today\'s behavior ==');
    {
        const defaultBrief = brief(defaults);
        for (const [label, search] of [['empty string', ''], ['"?"', '?'], ['undefined', undefined], ['null', null], ['?integration=1', '?integration=1'], ['?calibration=1', '?calibration=1'], ['?foo=bar&hue2=9', '?foo=bar&hue2=9']]) {
            const r = parse(search);
            check(`${label}: overrides {}, no warning, default start state`, eq(r.overrides, {}) && r.warnings.length === 0 && eq(brief(S.createState(r.overrides)), defaultBrief));
        }
        const withDev = parse('?integration=1&hue=9&reg=pa&calibration=0');
        check('other parameters next to hue/reg do not interfere (and the leading "?" is optional)', eq(withDev.overrides, { selectedHue: 9, selectedRegister: 'pa' }) && eq(parse('hue=9&reg=pa').overrides, { selectedHue: 9, selectedRegister: 'pa' }));
        check('the default start state is the reference circle at hue 1 (what a bookmarked / direct visit shows)', defaultBrief.source === 'reference' && defaultBrief.hue === 1 && defaultBrief.circleMode === 'reference' && defaultBrief.view === 'circle');
        check('a repeated parameter uses its FIRST value (?hue=3&hue=9 -> 3)', eq(parse('?hue=3&hue=9&reg=ca&reg=pa').overrides, { selectedHue: 3, selectedRegister: 'ca' }));
        check('overrides keep the hue first (createState applies them in key order)', Object.keys(parse('?reg=pa&hue=9').overrides).join() === 'selectedHue,selectedRegister');
    }

    console.log('\n== 6. farborgelPageUrl() on garbage anchors ==');
    {
        const bare = 'color-harmony/ui/index.html';
        const cases = [['null', null, bare], ['undefined', undefined, bare], ['{}', {}, bare], ['hueIndex 0', { hueIndex: 0, registerIndex: 3 }, bare], ['hueIndex 25', { hueIndex: 25, registerIndex: 3 }, bare],
            ['hueIndex 1.5', { hueIndex: 1.5, registerIndex: 3 }, bare], ['hueIndex "9"', { hueIndex: '9', registerIndex: 3 }, bare], ['hueIndex null', { hueIndex: null, registerIndex: 3 }, bare], ['hueIndex NaN', { hueIndex: NaN, registerIndex: 3 }, bare]];
        for (const [label, anchor, want] of cases) check(`${label}: the bare page URL (default start state), not a broken query`, farborgelPageUrl(anchor) === want, farborgelPageUrl(anchor));
        check('the result never contains "undefined", "null" or "NaN"', [null, {}, { hueIndex: 3 }, { hueIndex: 3, registerIndex: undefined }, { hueIndex: 3, registerIndex: null }].every(a => !/undefined|null|NaN/.test(farborgelPageUrl(a))));
    }

    console.log('\n== 7. fuzz: nothing in the URL can throw ==');
    {
        const pieces = ['hue', 'reg', '=', '&', '?', '9', '24', '0', 'pa', 'zz', '%', '%00', '%zz', '\u0000', ' ', '+', '-', '.', 'é', '٩', '😀', 'a'.repeat(5000), '[]', '__proto__', 'constructor', 'hue[]', '#frag'];
        let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
        let thrown = 0, inconsistent = 0, runs = 3000;
        for (let k = 0; k < runs; k++) {
            let s = '?'; for (let j = rnd(8); j >= 0; j--) s += pieces[rnd(pieces.length)];
            try {
                const o = S.anchorOverridesFromSearch(s, () => { });
                const st = S.createState(o);                                  // must be constructible whatever the URL said
                const okKeys = Object.keys(o).every(key => key === 'selectedHue' || key === 'selectedRegister');
                const okHue = !('selectedHue' in o) || (Number.isInteger(o.selectedHue) && o.selectedHue >= 1 && o.selectedHue <= 24 && st.selectedHue === o.selectedHue);
                const okReg = !('selectedRegister' in o) || ('selectedHue' in o && S.registers.includes(o.selectedRegister) && st.selectedRegister === o.selectedRegister);
                if (!(okKeys && okHue && okReg)) inconsistent++;
            } catch (e) { thrown++; }
        }
        check(`${runs} random URLs (control characters, emoji, 5000-char values, __proto__, bad percent-escapes...): the parser and createState never throw`, thrown === 0, `${thrown} threw`);
        check('...and every result is internally consistent (keys, hue in 1-24, register only with a hue)', inconsistent === 0, `${inconsistent} inconsistent`);
    }

    console.log('\n== 8. wiring ==');
    {
        const app = fs.readFileSync(path.join(ROOT, 'color-harmony/ui/app.mjs'), 'utf8');
        check('app.mjs imports anchorOverridesFromSearch from ./state.mjs', /import\s*\{[^}]*\banchorOverridesFromSearch\b[^}]*\}\s*from\s*'\.\/state\.mjs'/.test(app));
        check('app.mjs builds its initial state through it (createState(anchorOverridesFromSearch(location.search)))', /createState\(\s*anchorOverridesFromSearch\(\s*location\.search\s*\)\s*\)/.test(app));
        check('...inside a try/catch whose fallback is the plain createState() (belt and braces: never a blank page)', /try\s*\{[^}]*anchorOverridesFromSearch[^}]*\}\s*catch[^{]*\{[^}]*return createState\(\)/.test(app));
        check('...and the top-level state is initialised by that function, not by a bare createState()', /let state=initialState\(\)/.test(app) && !/let state=createState\(\)/.test(app));
        const uf = fs.readFileSync(path.join(ROOT, 'ui-farbe.js'), 'utf8');
        const syncBody = (uf.match(/function sync\(\)\s*\{([\s\S]*?)\n  \}\n/) || [])[1] || '';
        check('ui-farbe.js builds the link URL with farborgelPageUrl(anchorFor(activeLayer)[, tab id - P3 adds the optional second argument])', /farborgelPageUrl\(\s*anchorFor\(\s*activeLayer\s*\)\s*(?:,\s*GENERATOR_TAB_ID\s*)?\)/.test(uf));
        check('...and sync() (which runs every frame) calls syncFarborgelLink() - not only a click handler', /syncFarborgelLink\(\);/.test(syncBody));
        check('...it is set with setAttribute("href") only when it changed (a plain string compare per frame)', /getAttribute\('href'\) !== url\)\s*farborgelLink\.setAttribute\('href', url\)/.test(uf));
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
        check('index.html still has #btn-farborgel (Farbe-tab-only, new tab, noopener) as the link the sync updates',
            /<a id="btn-farborgel"[^>]*class="[^"]*rail-farbe-only[^"]*"[^>]*target="_blank"[^>]*rel="noopener"/.test(html) || /<a id="btn-farborgel"[^>]*rail-farbe-only[^>]*>/.test(html));
    }

    console.log(`\n${checks - failures}/${checks} checks passed`);
    if (failures > 0) process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
