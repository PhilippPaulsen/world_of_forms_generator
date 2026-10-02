/**
 * tools/color/test-farborgel-handoff.js
 * Headless verification of Farborgel sub-page P3: the return handoff of a composed HarmonySelection from the
 * standalone Farborgel page to the generator tab that opened it (localStorage mailbox + `storage` event).
 *
 *   node tools/color/test-farborgel-handoff.js
 *
 * The two halves live in different worlds (a classic script in the generator, an ES module on the Farborgel page),
 * and the payload is UNTRUSTED cross-page input - so the weight here is on the validation layer and on the seams:
 *
 *   A. real selections (all 7 types, several anchors, a compound, a single color, a gray) validate
 *   B. every field of the contract, mutated: wrong version/source, bad members, bad coordinates, bad colors,
 *      cardinality / activeMemberIndex inconsistencies, hostile keys
 *   C. an envelope truncated at EVERY length, and an oversized one
 *   D. fuzz: thousands of random mutations - the validator/parser never throw, and anything they ACCEPT can be
 *      applied by applyHarmonyToPattern() without throwing and lands in range (accepted => safe)
 *   E. the envelope parser: addressing, replays (dedup window), what is silent vs warned vs acked
 *   F. per-sheet lastSelectionFor()/'custom' state: round trip per sheet, dropped by every other type, resets
 *   G. the sender state machine (handoff.mjs) with fakes: pending/ok/rejected/timeout/late ack/storage errors,
 *      a repeated IDENTICAL emit still being delivered, stale acks ignored, two generator tabs
 *   H. cross-checks between the two worlds: shared constants, rejection reasons <-> i18n, tab ids, link URLs
 *   I. wiring: the browser glue really uses all of the above
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
const clone = x => JSON.parse(JSON.stringify(x));

async function main() {
    // ---- generator half: the real classic scripts in a sandbox ----
    const sb = { console };
    vm.createContext(sb);
    for (const f of ['state', 'color', 'facecolor', 'farborgel-bridge']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'core', f + '.js'), 'utf8'), sb, { filename: f });
    const run = code => vm.runInContext(code, sb);
    const B = {
        validate: sb.validateHarmonySelection, parse: sb.parseFarborgelHandoff, remember: sb.rememberFarborgelHandoffId, buildAck: sb.buildFarborgelAck,
        newTabId: sb.farborgelNewTabId, pageUrl: sb.farborgelPageUrl, apply: sb.applyHarmonyToPattern
    };
    const BC = JSON.parse(run('JSON.stringify({ HANDOFF_KEY: FARBORGEL_HANDOFF_KEY, ACK_KEY: FARBORGEL_ACK_KEY, TAB_ID_PATTERN: FARBORGEL_TAB_ID_PATTERN.source, MAX_CHARS: FARBORGEL_HANDOFF_MAX_CHARS, MAX_MEMBERS: FARBORGEL_SELECTION_MAX_MEMBERS, WINDOW: FARBORGEL_HANDOFF_DEDUP_WINDOW, REASONS: FARBORGEL_ACK_REASONS, CUSTOM: CUSTOM_HARMONY_TYPE })'));

    // ---- Farborgel half: the real ES modules ----
    const H = await imp('color-harmony/ui/handoff.mjs');
    const { buildHarmonySelection } = await imp('core/farborgel-selection.mjs');
    const C = await imp('color-harmony/ui/composition.mjs');
    const { createHarmonySelection } = await imp('color-harmony/ui/HarmonySelection.mjs');
    const Engine = (await imp('core/farborgel-engine.mjs')).default;
    const I18N = await imp('color-harmony/ui/i18n.mjs');

    // ---- real selections ----
    const real = [];
    for (const a of [{ hueIndex: 1, registerIndex: 0 }, { hueIndex: 9, registerIndex: 21 }, { hueIndex: 17, registerIndex: 12 }, { hueIndex: 24, registerIndex: 27 }, { hueIndex: 5, registerIndex: 7 }])
        for (const t of ['2', '3', '4', 'W', 'B', 'S', 'V']) real.push({ label: `${a.hueIndex}/${a.registerIndex} ${t}`, sel: buildHarmonySelection(a, t) });
    real.push({ label: 'single atlas color', sel: createHarmonySelection(C.createComposition(Engine.triangle(5)[2])) });
    real.push({ label: 'single reference color', sel: createHarmonySelection(C.createComposition(C.fullColor(9))) });
    real.push({ label: 'a gray', sel: createHarmonySelection(C.createComposition(Engine.grayAxis()[3])) });
    for (const [h, r, n] of [[5, 2, 3], [5, 2, 4], [9, 12, 2], [17, 20, 4]]) {
        let c = C.createComposition(Engine.triangle(h)[r]);
        c = C.reduceComposition(c, 'generateHarmony', n); c = C.reduceComposition(c, 'beginSubstitution'); c = C.reduceComposition(c, 'applySubstitution', 0);
        real.push({ label: `compound ${h}/${r} n=${n}`, sel: createHarmonySelection(c) });
    }
    const TAB = 'abcdef012345';
    const envelope = (sel, over) => JSON.stringify({ v: 1, id: 'id-1', to: TAB, at: 1790000000000, selection: sel, ...over });

    console.log('== A. real selections validate ==');
    {
        const bad = real.filter(r => !B.validate(clone(r.sel)).ok).map(r => r.label);
        check(`${real.length} real selections (7 harmony types x 5 anchors, single colors, a gray, 4 compounds) pass the validator`, bad.length === 0, bad.join(', '));
        check('...including after a JSON round trip (that is how they travel)', real.every(r => B.validate(JSON.parse(JSON.stringify(r.sel))).ok));
        check('the largest real record (24-member V series) is within the envelope cap', Math.max(...real.map(r => envelope(r.sel).length)) < BC.MAX_CHARS, `${Math.max(...real.map(r => envelope(r.sel).length))} chars`);
        const gray = real.find(r => r.label === 'a gray').sel;
        check('a gray member (hueIndex null) is accepted - the generator maps it to its gray hue substitute', gray.members[0].analyticalCoordinate.hueIndex === null && B.validate(clone(gray)).ok);
    }

    console.log('\n== B. every field of the contract, mutated ==');
    {
        const base = real.find(r => r.label === '9/21 3').sel;
        const mut = (fn) => { const x = clone(base); fn(x); return B.validate(x).ok; };
        const rejects = (name, fn) => check(`rejected: ${name}`, mut(fn) === false);
        check('control: the unmutated record is accepted', B.validate(clone(base)).ok);
        rejects('version 2', x => { x.version = 2; });
        rejects('version "1" (string)', x => { x.version = '1'; });
        rejects('version missing', x => { delete x.version; });
        rejects('source "generator"', x => { x.source = 'generator'; });
        rejects('source missing', x => { delete x.source; });
        rejects('members missing', x => { delete x.members; });
        rejects('members empty', x => { x.members = []; x.classification.cardinality = 0; });
        rejects('members an object', x => { x.members = { 0: x.members[0], length: 1 }; });
        rejects('members a string', x => { x.members = 'abc'; });
        rejects('257 members (over the cap)', x => { x.members = Array.from({ length: 257 }, () => clone(base.members[0])); x.classification.cardinality = 257; });
        check('exactly 256 members is still accepted (the cap is inclusive)', (() => { const x = clone(base); x.members = Array.from({ length: 256 }, () => clone(base.members[0])); x.classification.cardinality = 256; return B.validate(x).ok; })());
        for (const [label, v] of [['null', null], ['number', 5], ['string', 'x'], ['array', []]]) rejects(`a member that is ${label}`, x => { x.members[1] = v; });
        rejects('member without analyticalCoordinate', x => { delete x.members[0].analyticalCoordinate; });
        rejects('analyticalCoordinate an array', x => { x.members[0].analyticalCoordinate = [1, 0.1, 0.1]; });
        for (const hv of [0, 25, -1, 1.5, '3', NaN, Infinity, undefined, {}, [], true]) rejects(`hueIndex ${JSON.stringify(hv)}${hv === undefined ? ' (undefined)' : ''}`, x => { x.members[0].analyticalCoordinate.hueIndex = hv; });
        check('hueIndex null is accepted (a gray)', mut(x => { x.members[0].analyticalCoordinate.hueIndex = null; }));
        for (const [k, vals] of [['w', [-0.1, 1.1, NaN, Infinity, -Infinity, '0.2', null, undefined, {}, true]], ['s', [-0.0001, 2, NaN, '0.1', null, undefined]]])
            for (const v of vals) rejects(`${k} = ${String(v)}`, x => { x.members[0].analyticalCoordinate[k] = v; });
        check('w and s at the boundaries 0 and 1 are accepted', mut(x => { x.members[0].analyticalCoordinate.w = 0; x.members[0].analyticalCoordinate.s = 1; }));
        rejects('srgb missing', x => { delete x.members[0].srgb; });
        rejects('srgb of length 2', x => { x.members[0].srgb = [1, 2]; });
        rejects('srgb of length 4', x => { x.members[0].srgb = [1, 2, 3, 4]; });
        for (const bv of [-1, 256, 1.5, '10', null, NaN, Infinity]) rejects(`an srgb channel ${String(bv)}`, x => { x.members[0].srgb[1] = bv; });
        rejects('srgb a string "010203"', x => { x.members[0].srgb = '010203'; });
        check('srgb channels 0 and 255 are accepted', mut(x => { x.members[0].srgb = [0, 255, 0]; }));
        rejects('cardinality != member count (too small)', x => { x.classification.cardinality = 2; });
        rejects('cardinality != member count (too large)', x => { x.classification.cardinality = 4; });
        rejects('cardinality a string', x => { x.classification.cardinality = '3'; });
        rejects('classification missing', x => { delete x.classification; });
        rejects('classification an array', x => { x.classification = []; });
        rejects('activeMemberIndex -1', x => { x.activeMemberIndex = -1; });
        rejects('activeMemberIndex = member count', x => { x.activeMemberIndex = 3; });
        rejects('activeMemberIndex 1.5', x => { x.activeMemberIndex = 1.5; });
        rejects('activeMemberIndex missing', x => { delete x.activeMemberIndex; });
        for (const [label, v] of [['null', null], ['undefined', undefined], ['an array', []], ['a string', 'selection'], ['a number', 1]]) check(`rejected: the whole selection is ${label}`, B.validate(v).ok === false);
        check('extra / unknown additive fields are tolerated (the interface says receivers ignore them)', mut(x => { x.futureField = { a: 1 }; x.members[0].extra = 'x'; }));
        check('a hostile "__proto__" key from JSON.parse does not break validation or pollute Object', (() => {
            const x = JSON.parse(JSON.stringify(base).replace('{"version":1', '{"__proto__":{"polluted":true},"version":1'));
            const r = B.validate(x);
            return ({}).polluted === undefined && typeof r.ok === 'boolean';
        })());
        check('the validator never throws on a getter that throws', (() => {
            const x = clone(base); Object.defineProperty(x.members[0], 'srgb', { get() { throw new Error('boom'); }, enumerable: true });
            try { return B.validate(x).ok === false; } catch (e) { return false; }
        })());
    }

    console.log('\n== C. truncated and oversized envelopes ==');
    {
        const full = envelope(real.find(r => r.label === '9/21 4').sel);
        let acc = 0, thrown = 0, accepted = 0;
        for (let n = 0; n < full.length; n++) {
            try { const r = B.parse(full.slice(0, n), TAB, []); acc++; if (r.ok) accepted++; } catch (e) { thrown++; }
        }
        check(`the envelope (${full.length} chars) cut at every one of its ${full.length} lengths never throws`, thrown === 0, `${thrown} threw`);
        check('...and no truncation is ever accepted', accepted === 0, `${accepted} accepted`);
        check('the full envelope is accepted', B.parse(full, TAB, []).ok === true);
        const huge = envelope(real[0].sel, { pad: 'x'.repeat(BC.MAX_CHARS) });
        const r = B.parse(huge, TAB, []);
        check('an envelope over the cap is rejected as invalid-envelope BEFORE parsing', r.ok === false && r.code === 'invalid-envelope' && r.addressed === false, r.detail);
        check('...and one exactly at the cap is not rejected for size', (() => { const s = envelope(real[0].sel); const padded = s.slice(0, -1) + ',"p":"' + 'x'.repeat(BC.MAX_CHARS - s.length - 7) + '"}'; return padded.length === BC.MAX_CHARS && B.parse(padded, TAB, []).ok; })());
    }

    console.log('\n== D. fuzz: nothing throws, and accepted => safe to apply ==');
    {
        let seed = 987654; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
        const sources = real.map(r => envelope(r.sel));
        const fakeTrails = Array.from({ length: 9 }, (_, i) => ({ key: 'k' + i, faceCount: 1 + (i % 3), area: 100 - i }));
        const junk = [null, undefined, 0, -1, 1.5, NaN, 'x', '', [], {}, true, 1e308, -0, '1', [1, 2, 3]];
        const mutateString = s => { const a = s.split(''); for (let k = 1 + rnd(4); k > 0; k--) { const i = rnd(a.length), op = rnd(3); if (op === 0) a.splice(i, 1); else if (op === 1) a[i] = '{}[]",:0123456789tfn'[rnd(20)]; else a.splice(i, 0, '{}[]",:9'[rnd(8)]); } return a.join(''); };
        const mutateObject = s => { const o = JSON.parse(s); const nodes = []; (function walk(x, depth) { if (x && typeof x === 'object' && depth < 5) { nodes.push(x); Object.values(x).forEach(v => walk(v, depth + 1)); } })(o, 0);
            for (let k = 1 + rnd(3); k > 0; k--) { const n = nodes[rnd(nodes.length)], keys = Object.keys(n); if (!keys.length) continue; const key = keys[rnd(keys.length)]; if (rnd(3) === 0) delete n[key]; else n[key] = junk[rnd(junk.length)]; } return JSON.stringify(o); };
        let runs = 0, thrown = 0, accepted = 0, rejected = 0, unsafe = 0, outOfRange = 0, inconsistent = 0;
        for (let i = 0; i < 4000; i++) {
            const s0 = sources[rnd(sources.length)];
            const s = rnd(2) ? mutateString(s0) : mutateObject(s0);
            runs++;
            let r;
            try { r = B.parse(s, TAB, []); } catch (e) { thrown++; continue; }
            if (!r.ok) { rejected++; if (r.code === 'invalid-selection' && !(r.addressed && r.id)) inconsistent++; continue; }
            accepted++;
            // accepted => the generator's real application path must cope
            const store = new Map();
            try {
                B.apply(r.selection, store, fakeTrails, ['cyclic', 'area', 'symmetry'][rnd(3)], { groupOpsCount: 6 });
                const M = r.selection.members.length;
                for (const a of store.values()) if (!(Number.isInteger(a.params.memberIndex) && a.params.memberIndex >= 0 && a.params.memberIndex < M && a.params.cardinality === M)) outOfRange++;
            } catch (e) { unsafe++; }
        }
        check(`${runs} fuzzed envelopes (string-level and field-level mutations of real records): the parser never throws`, thrown === 0, `${thrown} threw`);
        check(`...${accepted} were accepted and ${rejected} rejected - both outcomes occur, so the fuzz exercises the validator rather than bouncing off the JSON parser`, accepted > 50 && rejected > 500, `accepted ${accepted}, rejected ${rejected}`);
        check('...every ACCEPTED selection is applied by applyHarmonyToPattern() without throwing', unsafe === 0, `${unsafe} threw`);
        check('...and every member index it writes is in range of that selection', outOfRange === 0, `${outOfRange} out of range`);
        check('...and every invalid-selection verdict that is addressed to this tab carries a usable id (so an ack can be sent)', inconsistent === 0, `${inconsistent}`);
    }

    console.log('\n== E. envelope parser: addressing, replays, silent vs warned ==');
    {
        const sel = real.find(r => r.label === '9/21 3').sel;
        const ok = B.parse(envelope(sel), TAB, []);
        check('a valid envelope for this tab: ok, with its id and the selection', ok.ok && ok.id === 'id-1' && eq(ok.selection, sel));
        check('addressed to ANOTHER tab: not-for-me (silent - only the addressee reacts, so several generator tabs cannot apply one handoff)', B.parse(envelope(sel, { to: '000000000000' }), TAB, []).code === 'not-for-me');
        check('"to" missing: not-for-me', B.parse(envelope(sel, { to: undefined }), TAB, []).code === 'not-for-me');
        for (const [label, v] of [['null', null], ['undefined', undefined], ['empty string', '']]) check(`${label} value (a removeItem event): empty, silent`, B.parse(v, TAB, []).code === 'empty');
        const inv = B.parse('{not json', TAB, []);
        check('invalid JSON: invalid-envelope, not addressed (nobody to ack)', inv.code === 'invalid-envelope' && inv.addressed === false);
        check('JSON that is not an object ([] / 5 / "x" / null): invalid-envelope', ['[]', '5', '"x"', 'null'].every(s => B.parse(s, TAB, []).code === 'invalid-envelope'));
        const v2 = B.parse(envelope(sel, { v: 2 }), TAB, []);
        check('envelope version 2: invalid-envelope, addressed and with an id (an ack can say so)', v2.code === 'invalid-envelope' && v2.addressed === true && v2.id === 'id-1');
        const noId = B.parse(envelope(sel, { id: undefined }), TAB, []);
        check('no id: invalid-envelope, not addressed (an ack without an id could not be matched)', noId.code === 'invalid-envelope' && noId.addressed === false);
        check('malformed ids are refused (spaces, slashes, 65 chars, numbers, objects)', ['has space', 'a/b', 'x'.repeat(65), 12345, { a: 1 }, ''].every(id => B.parse(envelope(sel, { id }), TAB, []).ok === false));
        check('no timestamp: invalid-envelope', B.parse(envelope(sel, { at: undefined }), TAB, []).code === 'invalid-envelope' && B.parse(envelope(sel, { at: 'now' }), TAB, []).code === 'invalid-envelope');
        const badSel = clone(sel); badSel.members[0].srgb = [1, 2];
        const r2 = B.parse(envelope(badSel), TAB, []);
        check('a bad selection in a good envelope: invalid-selection, addressed, with the offending field named', r2.code === 'invalid-selection' && r2.addressed && /srgb/.test(r2.detail), r2.detail);

        const handled = [];
        const first = B.parse(envelope(sel), TAB, handled);
        B.remember(handled, first.id);
        const replay = B.parse(envelope(sel), TAB, handled);
        check('a replayed id inside the dedup window: duplicate (silent, applied once only)', replay.ok === false && replay.code === 'duplicate');
        check('...while a different id is accepted', B.parse(envelope(sel, { id: 'id-2' }), TAB, handled).ok);
        for (let i = 0; i < BC.WINDOW + 5; i++) B.remember(handled, 'fill-' + i);
        check(`the window holds the last ${BC.WINDOW} ids and no more`, handled.length === BC.WINDOW && handled[handled.length - 1] === 'fill-' + (BC.WINDOW + 4) && !handled.includes('id-1'));
        check('...an id that has aged out of the window is accepted again (the documented limit of a bounded window)', B.parse(envelope(sel), TAB, handled).ok);
        check('the ack for a success carries id, ok, sheet', eq((({ v, id, ok, sheet }) => ({ v, id, ok, sheet }))(B.buildAck('id-1', true, 'base', 1)), { v: 1, id: 'id-1', ok: true, sheet: 'base' }));
        check('...for a rejection id, ok:false and a known reason; an unknown reason becomes internal-error', B.buildAck('i', false, 'fill-off').reason === 'fill-off' && B.buildAck('i', false, 'made-up').reason === 'internal-error');
    }

    console.log('\n== F. per-sheet lastSelectionFor() / the "custom" sentinel ==');
    {
        run('additionalLayers = [{}, {}];');
        const sel = real.find(r => r.label === '9/21 4').sel;
        check('a sheet that was never colored reads null for both the type and the selection', run("lastHarmonyTypeFor('base') === null && lastSelectionFor('base') === null && lastSelectionFor(0) === null"));
        sb.__sel = clone(sel);
        run("setLastHarmonyTypeFor('base', CUSTOM_HARMONY_TYPE); setLastSelectionFor('base', __sel);");
        check('base: type "custom" + selection round-trip', run("lastHarmonyTypeFor('base') === 'custom'") && eq(run('lastSelectionFor("base")'), sel));
        check('...and the layers are untouched (state is per sheet)', run("lastHarmonyTypeFor(0) === null && lastSelectionFor(0) === null && lastSelectionFor(1) === null"));
        sb.__sel1 = clone(real.find(r => r.label === '1/0 2').sel);
        run("setLastHarmonyTypeFor(1, CUSTOM_HARMONY_TYPE); setLastSelectionFor(1, __sel1);");
        check('layer 1: its own selection, independent of base', run('lastSelectionFor(1).members.length') === 2 && run('lastSelectionFor("base").members.length') === 4 && run('lastSelectionFor(0) === null'));
        run("setLastHarmonyTypeFor('base', '3');");
        check('base: setting a real type ("3") drops the stored selection - a stale composition cannot outlive its coloring', run("lastSelectionFor('base') === null && lastHarmonyTypeFor('base') === '3'"));
        check('...and layer 1 still has its own', run('lastSelectionFor(1) !== null'));
        run("setLastHarmonyTypeFor(1, null);");
        check('layer 1: null (Reset Color / switching to the old rule system go through this) drops it too', run('lastSelectionFor(1) === null && lastHarmonyTypeFor(1) === null'));
        run("setLastHarmonyTypeFor('base', CUSTOM_HARMONY_TYPE); setLastSelectionFor('base', __sel); setLastHarmonyTypeFor('base', CUSTOM_HARMONY_TYPE);");
        check('re-asserting "custom" does NOT drop the selection (applySelection sets type first, then selection - and a strategy reapply re-sets the type)', run("lastSelectionFor('base') !== null"));
        check('a sheet that does not exist reads null and writing to it is a no-op', run("lastSelectionFor(7) === null && (setLastSelectionFor(7, {}), setLastHarmonyTypeFor(7, 'custom'), lastSelectionFor(7) === null)"));
        const st = fs.readFileSync(path.join(ROOT, 'core/state.js'), 'utf8');
        check('core/state.js resets baseLastSelection with the grid in BOTH rebuild paths (rebuildGrid and rebuildGridFromConstruction)', (st.match(/baseLastHarmonyType = null; baseLastSelection = null;/g) || []).length === 2);
        check('every "a Farborgel harmony owns this sheet" gate stays `lastHarmonyTypeFor(sheet) !== null`, so "custom" counts without touching them',
            /lastHarmonyTypeFor\(sheet\) !== null/.test(fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8')));
    }

    console.log('\n== G. the sender state machine (handoff.mjs) with fakes ==');
    {
        // Two "tabs" sharing one storage; a storage event reaches every tab EXCEPT the writer, and ONLY when the stored value actually changes
        function makeWorld() {
            const data = new Map(); const tabs = [];
            const rawEvents = [];
            const storageFor = tab => ({
                getItem: k => (data.has(k) ? data.get(k) : null),
                setItem(k, v) { const old = data.has(k) ? data.get(k) : null; if (tab.quota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } data.set(k, String(v)); if (old === String(v)) return; rawEvents.push({ key: k, from: tab.name }); tabs.filter(t => t !== tab).forEach(t => t.listeners.forEach(l => l({ key: k, newValue: String(v) }))); },
                removeItem(k) { if (!data.has(k)) return; data.delete(k); tabs.filter(t => t !== tab).forEach(t => t.listeners.forEach(l => l({ key: k, newValue: null }))); }
            });
            const newTab = name => { const tab = { name, listeners: [], quota: false }; tab.storage = storageFor(tab); tab.subscribe = fn => { tab.listeners.push(fn); return () => { tab.listeners = tab.listeners.filter(l => l !== fn); }; }; tabs.push(tab); return tab; };
            return { data, newTab, rawEvents };
        }
        const makeTimers = () => { const pending = []; return { setTimer: (fn, ms) => { const h = { fn, ms, dead: false }; pending.push(h); return h; }, clearTimer: h => { if (h) h.dead = true; }, fire: () => { const h = pending.find(p => !p.dead); if (h) { h.dead = true; h.fn(); return true; } return false; }, live: () => pending.filter(p => !p.dead).length }; };
        // a generator tab, behaving like ui-farbe.js's handler (same pure functions from the bridge)
        function makeGenerator(tab, tabId, { applyResult = { ok: true, sheet: 'base' } } = {}) {
            const handled = []; const applied = []; const warnings = [];
            tab.subscribe(e => {
                if (e.key !== BC.HANDOFF_KEY) return;
                const parsed = B.parse(e.newValue, tabId, handled);
                if (!parsed.ok) {
                    if (['not-for-me', 'empty', 'duplicate'].includes(parsed.code)) return;
                    warnings.push(parsed.code);
                    if (parsed.addressed) { tab.storage.setItem(BC.ACK_KEY, JSON.stringify(B.buildAck(parsed.id, false, parsed.code))); tab.storage.removeItem(BC.HANDOFF_KEY); }
                    return;
                }
                B.remember(handled, parsed.id);
                applied.push(parsed.selection);
                tab.storage.setItem(BC.ACK_KEY, JSON.stringify(B.buildAck(parsed.id, applyResult.ok, applyResult.ok ? applyResult.sheet : applyResult.reason)));
                tab.storage.removeItem(BC.HANDOFF_KEY);
            });
            return { applied, warnings };
        }
        const sel = real.find(r => r.label === '9/21 4').sel;
        const mkSender = (tab, timers, statuses) => H.createHandoffSender({ tabId: TAB, onStatus: s => statuses.push(s), storage: tab.storage, subscribe: tab.subscribe, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

        { // normal round trip
            const w = makeWorld(), far = w.newTab('farborgel'), gen = w.newTab('generator'), tm = makeTimers(), st = [];
            const g = makeGenerator(gen, TAB); const sender = mkSender(far, tm, st);
            sender.send(sel);
            check('round trip: pending, then ok with the sheet the generator reports', eq(st.map(s => s.state), ['pending', 'ok']) && st[1].sheet === 'base', JSON.stringify(st));
            check('...the generator received exactly the record that was sent (unmodified)', g.applied.length === 1 && eq(g.applied[0], sel));
            check('...the ack timer is cancelled by the ack (no spurious timeout later)', tm.live() === 0);
            check('...and both mailbox keys are cleaned up (each side removes the other\'s)', !w.data.has(BC.HANDOFF_KEY) && !w.data.has(BC.ACK_KEY));
        }
        { // rejection
            const w = makeWorld(), far = w.newTab('f'), gen = w.newTab('g'), tm = makeTimers(), st = [];
            makeGenerator(gen, TAB, { applyResult: { ok: false, reason: 'fill-off' } }); mkSender(far, tm, st).send(sel);
            check('a rejection ack becomes { rejected, reason } (e.g. face fill is off in the generator)', eq(st.map(s => s.state), ['pending', 'rejected']) && st[1].reason === 'fill-off', JSON.stringify(st));
        }
        { // invalid selection from a hand-edited record -> generator rejects with an ack, not a throw
            const w = makeWorld(), far = w.newTab('f'), gen = w.newTab('g'), tm = makeTimers(), st = [];
            const g = makeGenerator(gen, TAB); const broken = clone(sel); broken.members[0].srgb = [999, 0, 0];
            mkSender(far, tm, st).send(broken);
            check('a corrupt selection is refused by the generator with reason invalid-selection, and nothing is applied', st[1] && st[1].state === 'rejected' && st[1].reason === 'invalid-selection' && g.applied.length === 0 && g.warnings.includes('invalid-selection'), JSON.stringify(st));
        }
        { // no generator: timeout, key cleaned, then a LATE ack
            const w = makeWorld(), far = w.newTab('f'), tm = makeTimers(), st = [];
            const sender = mkSender(far, tm, st); const id = sender.send(sel);
            check('nobody listening: pending, the handoff record is in the mailbox, a timer is running', eq(st.map(s => s.state), ['pending']) && w.data.has(BC.HANDOFF_KEY) && tm.live() === 1);
            tm.fire();
            check('after the timeout: { timeout } and the unclaimed record is removed from the mailbox', eq(st.map(s => s.state), ['pending', 'timeout']) && !w.data.has(BC.HANDOFF_KEY));
            const gen = w.newTab('late-generator'); gen.storage.setItem(BC.ACK_KEY, JSON.stringify(B.buildAck(id, true, 2)));
            check('a LATE ack still turns the timeout into ok (the timeout means "no answer yet")', st[st.length - 1].state === 'ok' && st[st.length - 1].sheet === 2, JSON.stringify(st.map(s => s.state)));
        }
        { // timeout window is the agreed 3 s
            const w = makeWorld(), far = w.newTab('f'), seen = [];
            H.createHandoffSender({ tabId: TAB, onStatus() { }, storage: far.storage, subscribe: far.subscribe, setTimer: (fn, ms) => { seen.push(ms); return 1; }, clearTimer() { } }).send(sel);
            check('the ack timeout is 3000 ms', seen[0] === 3000 && H.ACK_TIMEOUT_MS === 3000, seen.join());
        }
        { // THE identical-emit problem
            const w = makeWorld(), far = w.newTab('f'), gen = w.newTab('g'), tm = makeTimers(), st = [];
            const g = makeGenerator(gen, TAB); const sender = mkSender(far, tm, st);
            // Freeze the clock: the envelope also carries `at`, and two emits in different milliseconds would differ by
            // that alone - hiding a missing/constant id. With `at` pinned, ONLY the id can make two emits differ.
            const realNow = Date.now; Date.now = () => 1790000000000;
            try { sender.send(sel); sender.send(sel); sender.send(sel); } finally { Date.now = realNow; }
            check('control (the underlying problem): storing a byte-identical value twice fires NO storage event in the other tab',
                (() => { const w2 = makeWorld(), a = w2.newTab('a'), b = w2.newTab('b'); let n = 0; b.subscribe(() => n++); a.storage.setItem('k', 'same'); a.storage.setItem('k', 'same'); return n === 1; })());
            check('...yet the SAME selection emitted three times is delivered three times, because every emit carries its own id', g.applied.length === 3, `${g.applied.length} applied`);
            check('...each with its own ack (3 x pending, 3 x ok)', st.filter(s => s.state === 'ok').length === 3 && st.filter(s => s.state === 'pending').length === 3, st.map(s => s.state).join());
            const ids = new Set(); for (let i = 0; i < 2000; i++) ids.add(H.newHandoffId());
            check('2000 generated message ids are all distinct and 16 hex characters', ids.size === 2000 && [...ids].every(x => /^[0-9a-f]{16}$/.test(x)));
        }
        { // stale ack
            const w = makeWorld(), far = w.newTab('f'), tm = makeTimers(), st = [];
            const sender = mkSender(far, tm, st); const id1 = sender.send(sel); const id2 = sender.send(sel);
            const gen = w.newTab('g'); gen.storage.setItem(BC.ACK_KEY, JSON.stringify(B.buildAck(id1, true, 'base')));
            check('an ack for an OLDER emit is ignored (only the latest send is tracked)', !st.some(s => s.state === 'ok'));
            gen.storage.setItem(BC.ACK_KEY, JSON.stringify(B.buildAck(id2, true, 'base')));
            check('...the ack for the current one is accepted', st[st.length - 1].state === 'ok');
        }
        { // junk on the ack key
            const w = makeWorld(), far = w.newTab('f'), tm = makeTimers(), st = [];
            const sender = mkSender(far, tm, st); const id = sender.send(sel); const gen = w.newTab('g');
            const junk = ['', 'null', '{', '[]', '"x"', JSON.stringify({ v: 2, id, ok: true }), JSON.stringify({ v: 1, id: 'other', ok: true }), JSON.stringify({ v: 1, id }), JSON.stringify({ v: 1, id, ok: 'yes' }), 'x'.repeat(5000)];
            let threw = false; try { junk.forEach(j => gen.storage.setItem(BC.ACK_KEY, j)); } catch (e) { threw = true; }
            check('garbage / wrong-id / wrong-version / oversized values on the ack key never throw and never resolve the send', !threw && eq(st.map(s => s.state), ['pending']), JSON.stringify(st.map(s => s.state)));
            gen.storage.setItem(BC.ACK_KEY, JSON.stringify({ v: 1, id, ok: false, reason: 'not-a-real-reason', at: 1 }));
            check('an unknown rejection reason is shown as internal-error rather than trusted', st[st.length - 1].state === 'rejected' && st[st.length - 1].reason === 'internal-error');
        }
        { // storage problems
            const w = makeWorld(), far = w.newTab('f'), tm = makeTimers(), st = [];
            far.quota = true; mkSender(far, tm, st).send(sel);
            check('a storage write that throws (quota / blocked / private mode): pending, then { storage-unavailable }, and no timer left running', eq(st.map(s => s.state), ['pending', 'storage-unavailable']) && tm.live() === 0, JSON.stringify(st.map(s => s.state)));
            const st2 = []; H.createHandoffSender({ tabId: TAB, onStatus: s => st2.push(s), storage: null, subscribe: () => () => { }, setTimer: tm.setTimer, clearTimer: tm.clearTimer }).send(sel);
            check('no storage object at all: the same outcome', eq(st2.map(s => s.state), ['pending', 'storage-unavailable']));
        }
        { // two generator tabs
            const w = makeWorld(), far = w.newTab('f'), genA = w.newTab('A'), genB = w.newTab('B'), tm = makeTimers(), st = [];
            const gA = makeGenerator(genA, TAB), gB = makeGenerator(genB, 'ffffffffffff');
            mkSender(far, tm, st).send(sel);
            check('two generator tabs open: ONLY the addressee applies the handoff', gA.applied.length === 1 && gB.applied.length === 0 && gB.warnings.length === 0);
        }
        { // mismatched / stale from=
            const w = makeWorld(), far = w.newTab('f'), gen = w.newTab('g'), tm = makeTimers(), st = [];
            const g = makeGenerator(gen, 'ffffffffffff');   // the page was opened from a tab with a DIFFERENT id (e.g. the generator was reloaded since)
            mkSender(far, tm, st).send(sel);
            check('a stale from= (the generator tab was reloaded and has a new id): nobody applies it', g.applied.length === 0);
            tm.fire();
            check('...and the Farborgel page reports the timeout', st.map(s => s.state).join() === 'pending,timeout');
        }
        { // message shape on the wire
            const w = makeWorld(), far = w.newTab('f'), tm = makeTimers();
            mkSender(far, tm, []).send(sel);
            const wire = JSON.parse(w.data.get(BC.HANDOFF_KEY));
            check('the envelope on the wire is { v:1, id, to, at, selection } with the selection byte-identical to what createHarmonySelection built', eq(Object.keys(wire), ['v', 'id', 'to', 'at', 'selection']) && wire.v === 1 && wire.to === TAB && typeof wire.at === 'number' && eq(wire.selection, sel));
        }
    }

    console.log('\n== H. cross-checks between the two worlds ==');
    {
        check('storage keys are identical (bridge vs handoff.mjs)', BC.HANDOFF_KEY === H.HANDOFF_KEY && BC.ACK_KEY === H.ACK_KEY && BC.HANDOFF_KEY === 'wof:farborgel:handoff' && BC.ACK_KEY === 'wof:farborgel:ack');
        check('the tab-id pattern is identical', BC.TAB_ID_PATTERN === H.TAB_ID_PATTERN.source, `${BC.TAB_ID_PATTERN} vs ${H.TAB_ID_PATTERN.source}`);
        check('the rejection reasons are identical, in the same order', eq(BC.REASONS, [...H.ACK_REASONS]));
        const missing = [];
        for (const r of BC.REASONS) for (const loc of ['de', 'en']) { try { const v = I18N.t('transferRejected_' + r, loc); if (!v || v === 'transferRejected_' + r) missing.push(r + ':' + loc); } catch (e) { missing.push(r + ':' + loc); } }
        check('every rejection reason the generator can send has a German AND an English message on the Farborgel page', missing.length === 0, missing.join(', '));
        const orphans = Object.keys(I18N.messages).filter(k => k.startsWith('transferRejected_')).map(k => k.slice('transferRejected_'.length)).filter(r => !BC.REASONS.includes(r));
        check('...and the page has no message for a reason the generator cannot send', orphans.length === 0, orphans.join(', '));
        check('the status messages all exist in both languages', ['transferPending', 'transferApplied', 'transferNoGenerator', 'transferNoStorage', 'transferRejected', 'sheetBase', 'sheetLayer'].every(k => ['de', 'en'].every(l => I18N.t(k, l).length > 0)));

        let tid = new Set(), badId = 0; for (let i = 0; i < 3000; i++) { const x = B.newTabId(); tid.add(x); if (!new RegExp(BC.TAB_ID_PATTERN).test(x)) badId++; }
        check('3000 generated generator tab ids: all 12 lowercase hex characters, no repeats', badId === 0 && tid.size === 3000, `${badId} malformed, ${3000 - tid.size} repeats`);
        check('...also without crypto (the Math.random fallback)', (() => { const saved = Object.getOwnPropertyDescriptor(sb, 'crypto'); sb.crypto = undefined; try { return /^[0-9a-f]{12}$/.test(B.newTabId()); } finally { if (saved) Object.defineProperty(sb, 'crypto', saved); else delete sb.crypto; } })());

        const quiet = (s) => { const w = []; const r = H.tabIdFromSearch(s, (...a) => w.push(a.join(' '))); return { r, w }; };
        check('tabIdFromSearch: a valid from= is returned, silently', (() => { const x = quiet('?hue=9&from=abcdef012345'); return x.r === 'abcdef012345' && x.w.length === 0; })());
        check('...absent: null, silently', (() => { const x = quiet('?hue=9'); return x.r === null && x.w.length === 0; })());
        check('...malformed (short, long, uppercase, non-hex, empty, padded): null with exactly one warning each', ['abc', 'abcdef0123456', 'ABCDEF012345', 'ghijklmnopqr', '', ' abcdef01234', 'abcdef012345 '].every(v => { const x = quiet('?from=' + encodeURIComponent(v)); return x.r === null && x.w.length === 1; }));
        check('the link URL carries from= (with and without a usable anchor), and the page\'s parsers read both parameters independently',
            B.pageUrl({ hueIndex: 9, registerIndex: 21 }, TAB) === `color-harmony/ui/index.html?hue=9&reg=pa&from=${TAB}` && B.pageUrl(null, TAB) === `color-harmony/ui/index.html?from=${TAB}`);
        check('...an invalid tab id is simply left out of the URL; no tab id keeps P2\'s URL byte-identical', B.pageUrl({ hueIndex: 9, registerIndex: 21 }, 'NOPE') === 'color-harmony/ui/index.html?hue=9&reg=pa' && B.pageUrl({ hueIndex: 9, registerIndex: 21 }) === 'color-harmony/ui/index.html?hue=9&reg=pa');
        const S = await imp('color-harmony/ui/state.mjs');
        const search = new URL(B.pageUrl({ hueIndex: 9, registerIndex: 21 }, TAB), 'http://x/').search;
        check('...the P2 anchor parser ignores from= and still pre-fills 9pa; the handoff parser reads from=', eq(S.anchorOverridesFromSearch(search, () => { }), { selectedHue: 9, selectedRegister: 'pa' }) && H.tabIdFromSearch(search) === TAB);

        let inspector = null; try { inspector = await imp('color-harmony/ui/components/Inspector.mjs'); } catch (e) { inspector = null; }
        if (inspector && inspector.transferStatusText) {
            const T = inspector.transferStatusText;
            const states = [{ state: 'pending' }, { state: 'timeout' }, { state: 'storage-unavailable' }, { state: 'ok', sheet: 'base' }, { state: 'ok', sheet: 2 }, { state: 'ok', sheet: null }, ...BC.REASONS.map(reason => ({ state: 'rejected', reason }))];
            check('the page renders a non-empty message for every status the sender can report, in both languages', states.every(s => ['de', 'en'].every(l => T(s, l).length > 0)), `${states.length} statuses`);
            check('...an ok status names the sheet (Basis / Ebene 3 for layer index 2)', T({ state: 'ok', sheet: 'base' }, 'de').endsWith('Basis') && T({ state: 'ok', sheet: 2 }, 'de').endsWith('Ebene 3') && T({ state: 'ok', sheet: 2 }, 'en').endsWith('Layer 3'));
        } else check('Inspector.transferStatusText is importable headlessly', false, 'import failed');
    }

    console.log('\n== I. wiring ==');
    {
        const uf = fs.readFileSync(path.join(ROOT, 'ui-farbe.js'), 'utf8');
        const app = fs.readFileSync(path.join(ROOT, 'color-harmony/ui/app.mjs'), 'utf8');
        const sk = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
        check('ui-farbe.js listens for `storage` events and routes them through parseFarborgelHandoff()', /window\.addEventListener\('storage', onFarborgelHandoffEvent\)/.test(uf) && /parseFarborgelHandoff\(e\.newValue, GENERATOR_TAB_ID, handledHandoffIds\)/.test(uf));
        check('...only the ADDRESSEE removes the handoff key (not-for-me / empty / duplicate return before any removal)', /not-for-me.*empty.*duplicate[\s\S]{0,200}return;/.test(uf) && (uf.match(/removeHandoffKey\(\);/g) || []).length === 2);
        check('...an applied handoff goes through applySelection(selection, CUSTOM_HARMONY_TYPE) - the same function as the 7 buttons', /return applySelection\(selection, CUSTOM_HARMONY_TYPE\)/.test(uf) && /applySelection\(selection, type\);\s*\n\s*\}/.test(uf));
        check('...it is refused (with the reason in the ack) when face fill is off or the sheet cannot show faces, exactly like the disabled buttons', /reason: 'fill-off'/.test(uf) && /reason: 'sheet-unavailable'/.test(uf));
        check('...and applyHarmony(type) is a thin wrapper: it builds the selection, then calls applySelection (no second application path)', /function applyHarmony\(type\)[\s\S]*?applySelection\(selection, type\);/.test(uf) && (uf.match(/applyHarmonyToPattern\(selection, faceAssignmentsFor\(activeLayer\), trails, strategy, context\);/g) || []).length === 1);
        check('the reapply path takes a reason: an ANCHOR change leaves a "custom" sheet alone, a STRATEGY change reapplies the stored selection',
            /function afterAnchorChange\(\) \{ reapply\('anchor'\); \}/.test(uf) && /function afterStrategyChange\(\) \{ reapply\('strategy'\); \}/.test(uf) && /if \(reason === 'strategy' && stored\) applySelection\(stored, CUSTOM_HARMONY_TYPE\)/.test(uf));
        check('...the strategy radios call afterStrategyChange; the four anchor inputs call afterAnchorChange', /setDistributionStrategyFor\(activeLayer, r\.dataset\.strategy\);\s*\n\s*afterStrategyChange\(\);/.test(uf) && (uf.match(/afterAnchorChange\(\);\n/g) || []).length >= 4);
        check('the override stepper (sketch.js) and assignFarborgelSlot read the selection through farborgelSelectionFor()', /window\.farborgelSelectionFor\(sheet\)/.test(sk) && /const selection = farborgelSelectionFor\(sheet\);/.test(uf));
        check('the generator tab id is created once per page load and put on the link', /const GENERATOR_TAB_ID = typeof farborgelNewTabId === 'function' \? farborgelNewTabId\(\) : null;/.test(uf) && /farborgelPageUrl\(anchorFor\(activeLayer\), GENERATOR_TAB_ID\)/.test(uf));
        check('app.mjs sends the same record through the sender inside the existing transfer callback, and only when a valid from= is present', /if\(handoff\)handoff\.send\(selection\);/.test(app) && /const tabId=tabIdFromSearch\(location\.search\);\s*\n\s*if\(!tabId\)return null;/.test(app));
        check('...the in-page CustomEvent is still dispatched first (the contract is unchanged)', /window\.dispatchEvent\(new CustomEvent\(HARMONY_SELECTION_EVENT,\{detail:selection\}\)\);\s*\n[\s\S]*?handoff\.send/.test(app));
        check('...and without from= the old "noch kein Muster verbunden" notice is kept (transferNotice: !handoff)', /transferNotice:!handoff/.test(app));
        const html = fs.readFileSync(path.join(ROOT, 'color-harmony/ui/index.html'), 'utf8');
        check('handoff.mjs is in the standalone page\'s import map (so it is cache-busted like every other module)', /"\.\/handoff\.mjs": "\.\/handoff\.mjs\?v=/.test(html));
    }

    console.log(`\n${checks - failures}/${checks} checks passed`);
    if (failures > 0) process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
