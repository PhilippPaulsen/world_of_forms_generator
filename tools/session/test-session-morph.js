/**
 * tools/session/test-session-morph.js
 * Morph stage b: the PARAMETERS of the spatial morph (enabled, mode, angleDeg) as one additive, project-level block that survives a reload. Nothing is drawn from it yet.
 *
 *   node tools/session/test-session-morph.js
 *   SESSION_JS=... SESSION_APPLY_JS=... SPATIAL_MORPH_JS=... node tools/session/test-session-morph.js        (sabotage runs; the same variables as the other session tests)
 *
 * What is proved here:
 *  1. the pure helpers of core/spatial-morph.js (defaults, normalise, equal) and that core/state.js declares the same defaults;
 *  2. the BYTES: a snapshot of a pattern with the morph at its defaults is byte-for-byte the one written before the block existed (sha256 of the snapshot text of a small and of the
 *     heaviest layered scenario, taken from the code of the commit before stage b; the same was checked over all 258 corpus patterns when the stage was built), the block is written ONLY
 *     when it differs from the defaults, schema stays 1;
 *  3. validate: every parameter round-trips (3 modes x enabled x angles incl. negative, fractional, 360+); an old snapshot without the block is valid; malformed blocks and fields fall
 *     back to their defaults, never throw, unknown keys are dropped;
 *  4. apply: a restore sets the saved parameters; a snapshot WITHOUT the block restores the DEFAULTS into a page that had a morph; the object is new; a failed apply rolls back to the old
 *     reference; the classification test of the state `let`s (captured list) knows the new global;
 *  5. the export JSON and the readers (catalog, gallery, sketch.js) do not carry or read the block; the page loads core/spatial-morph.js before core/session.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const F = require('./fixtures.js');
const S = require('./scenarios.js');
const { ROOT, clone, J } = F;
const { same, safe, newCtx, world, uiOf, snapOf, exportOf, planFor, fakeHooks, applyInto, layeredAltNet } = S;
const M = require(process.env.SPATIAL_MORPH_JS || path.join(ROOT, 'core', 'spatial-morph.js'));

let failures = 0, checks = 0;
function check(name, ok, detail) { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); }
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.message)); process.exit(1); });
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const DEF = { enabled: false, mode: 'linear', angleDeg: 0 };
const setMorph = (ctx, m) => ctx.run(`spatialMorph = ${J(m)};`);
const getMorph = ctx => clone(ctx.get('spatialMorph'));
const text = (ctx, ui) => ctx.sb.serializeSession(ctx.sb.buildSessionSnapshot(ctx.sb.collectSessionState(ui), 1)).text;
const deepFreeze = o => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

// ---- 1. the pure helpers --------------------------------------------------------------------------------------------------------------
console.log('== 1. the helpers and the state default ==');
{
    check('spatialMorphDefaults() is { enabled: false, mode: linear, angleDeg: 0 } and a FRESH object each call', same(M.spatialMorphDefaults(), DEF) && M.spatialMorphDefaults() !== M.spatialMorphDefaults());
    const state = F.read('core/state.js');
    const lit = /^let spatialMorph = (\{[^}]*\});/m.exec(state);
    check('core/state.js declares `let spatialMorph` as a literal equal to the defaults (tools cannot call a function there: state.js loads first)', !!lit && same(Function('return ' + lit[1])(), M.spatialMorphDefaults()), lit && lit[1]);
    const N = M.spatialMorphNormalize;
    const good = [[{ enabled: true, mode: 'radial', angleDeg: 45 }, { enabled: true, mode: 'radial', angleDeg: 45 }], [{ enabled: true, mode: 'bilinear', angleDeg: -45 }, { enabled: true, mode: 'bilinear', angleDeg: -45 }],
        [{ enabled: false, mode: 'linear', angleDeg: 360 }, { enabled: false, mode: 'linear', angleDeg: 360 }], [{ enabled: true, mode: 'linear', angleDeg: 22.5 }, { enabled: true, mode: 'linear', angleDeg: 22.5 }],
        [{ enabled: true, mode: 'linear', angleDeg: -1080.25 }, { enabled: true, mode: 'linear', angleDeg: -1080.25 }], [{ enabled: true, mode: 'linear', angleDeg: 1e9 }, { enabled: true, mode: 'linear', angleDeg: 1e9 }]];
    check('valid values are kept as they are (all three modes, negative, fractional, 360 and more: an angle is NOT wrapped)', good.every(([i, o]) => same(N(i), o)));
    check('-0 becomes 0', Object.is(N({ angleDeg: -0 }).angleDeg, 0));
    const bad = [[undefined, DEF], [null, DEF], ['x', DEF], [5, DEF], [true, DEF], [[], DEF], [[1, 2], DEF], [{}, DEF]];
    check('anything that is not an object (undefined, null, a string, a number, a boolean, an array) is the defaults', bad.every(([i, o]) => same(N(i), o)));
    check('a wrong-typed or unknown field falls back to ITS default, the others stay: enabled 1 / "true" / null -> false; mode "spiral" / "RADIAL" / 5 / null -> linear; angle NaN / Infinity / "45" / null / true -> 0',
        [1, 'true', null, {}, 'yes'].every(e => N({ enabled: e, mode: 'radial', angleDeg: 30 }).enabled === false && N({ enabled: e, mode: 'radial', angleDeg: 30 }).mode === 'radial')
        && ['spiral', 'RADIAL', 5, null, {}, 'Radial '].every(m => same(N({ enabled: true, mode: m, angleDeg: 30 }), { enabled: true, mode: 'linear', angleDeg: 30 }))
        && [NaN, Infinity, -Infinity, '45', null, true, {}, undefined].every(a => same(N({ enabled: true, mode: 'bilinear', angleDeg: a }), { enabled: true, mode: 'bilinear', angleDeg: 0 })));
    check('unknown keys are dropped (nothing but the three parameters survives: no speed, spread, wave, ping-pong)', same(Object.keys(N({ enabled: true, mode: 'radial', angleDeg: 1, speed: 2, spread: 3, wave: true, pingPong: true, faces: true })), ['enabled', 'mode', 'angleDeg']));
    const frozen = deepFreeze({ enabled: true, mode: 'radial', angleDeg: 5, extra: { a: 1 } });
    let threw = null, r; try { r = N(frozen); } catch (e) { threw = e; }
    check('the input is not changed (a deep-frozen object goes through) and the result is a NEW object', threw === null && r !== frozen && same(r, { enabled: true, mode: 'radial', angleDeg: 5 }));
    const E = M.spatialMorphEqual;
    check('spatialMorphEqual compares after normalising: equal values, a value and the defaults (b undefined), a malformed value against the defaults; different in any one field is not equal',
        E({ enabled: true, mode: 'radial', angleDeg: 5 }, { enabled: true, mode: 'radial', angleDeg: 5, junk: 1 }) && E(undefined, DEF) && E({ mode: 'spiral' }, undefined) && E(DEF, undefined)
        && !E({ enabled: true }, undefined) && !E({ mode: 'radial' }, undefined) && !E({ angleDeg: 0.001 }, undefined) && !E({ angleDeg: -45 }, { angleDeg: 315 }));
}

// ---- 2. the bytes ----------------------------------------------------------------------------------------------------------------------
console.log('\n== 2. the snapshot: byte-identical at the defaults, the block only when it differs ==');
const WANT = { small: '1932cccee4c1244f57a81dac3e8d67a9d5fbdde1f8f57ed7c6e13d43fcff9654', layered: '5c494cc138163ba67e32a530045c6c0cfe123eee8ef3ec93b8b7d301c5b76d99' };
{
    const w = world('square', 3, 5, 'none'); w.run('connections = [[1, 6], [2, 9]];');
    const ui = uiOf(w, 'none', 6), t0 = text(w, ui);
    check('the live global exists and holds the defaults in a fresh world', same(getMorph(w), DEF));
    check('a small pattern with the defaults: the snapshot text has the sha256 of the text the code BEFORE stage b wrote (638 characters)', sha(t0) === WANT.small && t0.length === 638, sha(t0).slice(0, 12));
    check('...and contains no spatialMorph key at all', !t0.includes('spatialMorph'));
    const lay = newCtx(); layeredAltNet(lay, {});
    const tl = text(lay, uiOf(lay, 'spiegeling', 6));
    check('the heaviest layered scenario (alt-net hex, 3 layers + playback + timeline, colours) with the defaults: the same sha256 as before stage b', sha(tl) === WANT.layered && !tl.includes('spatialMorph'), sha(tl).slice(0, 12));
    // the same result however the defaults arrive
    const viaUndefined = w.sb.serializeSession(w.sb.buildSessionSnapshot(Object.assign({}, w.sb.collectSessionState(ui), { spatialMorph: undefined }), 1)).text;
    const viaMalformed = w.sb.serializeSession(w.sb.buildSessionSnapshot(Object.assign({}, w.sb.collectSessionState(ui), { spatialMorph: { enabled: 'no', mode: 'spiral', angleDeg: NaN } }), 1)).text;
    check('an absent block (undefined) and a malformed one that normalises to the defaults give the same bytes', viaUndefined === t0 && viaMalformed === t0);
    // differs -> written, at the end of settings
    setMorph(w, { enabled: true, mode: 'radial', angleDeg: -45.5 });
    const s1 = JSON.parse(text(w, ui));
    check('a morph that differs from the defaults is written as settings.spatialMorph = { enabled, mode, angleDeg } (exactly three fields), after netTransform', same(s1.settings.spatialMorph, { enabled: true, mode: 'radial', angleDeg: -45.5 }) && Object.keys(s1.settings).at(-1) === 'spatialMorph' && Object.keys(s1.settings).at(-2) === 'netTransform');
    check('the schema stays 1 (additive field, old snapshots stay valid)', s1.schema === 1 && w.get('SESSION_SCHEMA_VERSION') === 1);
    const without = clone(s1); delete without.settings.spatialMorph;
    check('apart from that one block the text is the same as without the morph', J(without) === J(JSON.parse(t0)));
    // each field alone counts as "differs"
    const single = [{ enabled: true }, { mode: 'radial' }, { mode: 'bilinear' }, { angleDeg: 0.5 }, { angleDeg: -90 }, { angleDeg: 360 }];
    check('each parameter alone off its default makes the block appear (enabled, either other mode, an angle of 0.5, -90, 360)', single.every(m => { setMorph(w, m); return JSON.parse(text(w, ui)).settings.spatialMorph !== undefined; }));
    setMorph(w, { enabled: false, mode: 'radial', angleDeg: 0 });
    check('enabled false with another mode IS written (the parameters are saved even while the morph is off)', JSON.parse(text(w, ui)).settings.spatialMorph.mode === 'radial');
    setMorph(w, DEF);
    check('...and back to the defaults the block is gone again (byte-identical to the start)', text(w, ui) === t0);
}

// ---- 3. validate -----------------------------------------------------------------------------------------------------------------------
console.log('\n== 3. validate: round trip, old snapshots, malformed values ==');
{
    const w = world('hex', 3, 4, 'rotation6'); w.run('connections = [[1, 6]];');
    const ui = uiOf(w, 'drehling', 6);
    let ok = 0, n = 0, badCase = '';
    const angles = [-720, -360, -90, -45, -22.5, -0.5, 0, 0.25, 45, 90, 135, 359.99, 360, 405, 720.5, 1e6, -1e6];
    for (const mode of ['linear', 'radial', 'bilinear']) for (const enabled of [false, true]) for (const angleDeg of angles) {
        const m = { enabled, mode, angleDeg }; setMorph(w, m); n++;
        const snap = JSON.parse(w.sb.serializeSession(w.sb.buildSessionSnapshot(w.sb.collectSessionState(ui), 1)).text);
        const v = w.sb.validateSession(snap);
        const back = v.ok ? (v.snapshot.settings.spatialMorph || DEF) : null;
        if (v.ok && same(back, m)) ok++; else if (!badCase) badCase = J(m) + ' -> ' + J(back);
    }
    check(`validateSession keeps every parameter: ${n} combinations (3 modes x enabled x ${angles.length} angles, negative, fractional, 360+) come back exactly`, ok === n, badCase);
    setMorph(w, DEF);
    const base = JSON.parse(text(w, ui));
    const old = clone(base); delete old.settings.spatialMorph;
    const vOld = w.sb.validateSession(old);
    check('an OLD snapshot (no block; the pre-stage-b bytes) is valid, schema 1, and its normalised copy has no block (the restore then sets the defaults)', vOld.ok && vOld.snapshot.schema === 1 && vOld.snapshot.settings.spatialMorph === undefined);
    const withBlock = v => { const c = clone(base); c.settings.spatialMorph = v; return c; };
    const variants = [['a string', 'radial'], ['a number', 7], ['an array', ['radial', 45]], ['null', null], ['true', true], ['an empty object', {}],
        ['enabled "yes"', { enabled: 'yes', mode: 'radial', angleDeg: 30 }], ['enabled 1', { enabled: 1, mode: 'radial', angleDeg: 30 }], ['mode "spiral"', { enabled: true, mode: 'spiral', angleDeg: 30 }],
        ['mode a number', { enabled: true, mode: 3, angleDeg: 30 }], ['mode in capitals', { enabled: true, mode: 'RADIAL', angleDeg: 30 }], ['angle a string', { enabled: true, mode: 'radial', angleDeg: '30' }],
        ['angle null (what JSON makes of NaN)', { enabled: true, mode: 'radial', angleDeg: null }], ['angle an object', { enabled: true, mode: 'radial', angleDeg: {} }], ['fields missing', { mode: 'bilinear' }], ['only the angle', { angleDeg: 90 }],
        ['unknown keys', { enabled: true, mode: 'radial', angleDeg: 30, speed: 1, wave: true, __proto__x: 1 }]];
    const results = variants.map(([what, v]) => { let r, threw = null; try { r = w.sb.validateSession(withBlock(v)); } catch (e) { threw = e; } return { what, v, r, threw }; });
    check('every malformed block validates (never throws, never rejects the snapshot)', results.every(x => x.threw === null && x.r.ok === true), results.filter(x => x.threw || !x.r.ok).map(x => x.what).join(', '));
    const got = x => x.r.snapshot.settings.spatialMorph || DEF;
    const exp = { 'a string': DEF, 'a number': DEF, 'an array': DEF, 'null': DEF, 'true': DEF, 'an empty object': DEF, 'enabled "yes"': { enabled: false, mode: 'radial', angleDeg: 30 }, 'enabled 1': { enabled: false, mode: 'radial', angleDeg: 30 },
        'mode "spiral"': { enabled: true, mode: 'linear', angleDeg: 30 }, 'mode a number': { enabled: true, mode: 'linear', angleDeg: 30 }, 'mode in capitals': { enabled: true, mode: 'linear', angleDeg: 30 },
        'angle a string': { enabled: true, mode: 'radial', angleDeg: 0 }, 'angle null (what JSON makes of NaN)': { enabled: true, mode: 'radial', angleDeg: 0 }, 'angle an object': { enabled: true, mode: 'radial', angleDeg: 0 },
        'fields missing': { enabled: false, mode: 'bilinear', angleDeg: 0 }, 'only the angle': { enabled: false, mode: 'linear', angleDeg: 90 }, 'unknown keys': { enabled: true, mode: 'radial', angleDeg: 30 } };
    const wrong = results.filter(x => !same(got(x), exp[x.what]));
    check('each bad field falls back to ITS OWN default and the good fields stay (17 variants: wrong type, NaN, unknown mode, missing fields, unknown keys)', wrong.length === 0, wrong.map(x => x.what + ' -> ' + J(got(x))).join(' | '));
    check('a block equal to the defaults after normalising is not carried into the normalised snapshot', results.filter(x => same(exp[x.what], DEF)).every(x => x.r.snapshot.settings.spatialMorph === undefined));
    check('the normalised block has exactly the three keys, whatever the stored one had', results.every(x => !x.r.snapshot.settings.spatialMorph || same(Object.keys(x.r.snapshot.settings.spatialMorph), ['enabled', 'mode', 'angleDeg'])));
    // text from storage with a hostile block
    const hostile = JSON.stringify(withBlock({ enabled: true, mode: 'radial', angleDeg: 1e999 }));
    const pr = w.sb.parseSession(hostile);
    check('a stored angle of 1e999 (an infinity once parsed) goes through parseSession as angle 0', pr.ok && same(pr.snapshot.settings.spatialMorph, { enabled: true, mode: 'radial', angleDeg: 0 }), J(pr.snapshot && pr.snapshot.settings.spatialMorph));
    // without the helper file nothing is written or read (feature test), and nothing throws
    const noHelp = F.makeContext({ state: true, export: true });
    noHelp.run('spatialMorphNormalize = undefined; spatialMorphEqual = undefined;');
    noHelp.run(`spatialMorph = { enabled: true, mode: 'radial', angleDeg: 5 };`);
    const tn = text(noHelp, uiOf(noHelp, 'drehling', 6));
    check('without core/spatial-morph.js loaded the block is neither written nor read, and nothing throws', !tn.includes('spatialMorph') && noHelp.sb.validateSession(withBlock({ enabled: true })).ok === true);
}

// ---- 4. apply --------------------------------------------------------------------------------------------------------------------------
console.log('\n== 4. apply: restore, defaults for an old snapshot, a new object, rollback ==');
{
    const src = world('square', 4, 3, 'rotation_reflection3'); src.run('connections = [[1, 6], [3, 9]];');
    const ui = uiOf(src, 'spiegeling', 3);
    const m = { enabled: true, mode: 'bilinear', angleDeg: -135.5 };
    setMorph(src, m);
    const snap1 = snapOf(src, ui);
    const target = world('triangle', 3, 4, 'none'); setMorph(target, { enabled: true, mode: 'radial', angleDeg: 90 });
    const tui = uiOf(target, 'none', 6);
    const hooks = fakeHooks(target, snap1, tui);
    const r = applyInto(target, snap1, hooks);
    check('a snapshot with the block applies and the globals hold the saved parameters', r.ok === true && same(getMorph(target), m), J(r).slice(0, 160) + ' ' + J(getMorph(target)));
    check('snapshot -> apply -> snapshot is identical, and every UI hook ran after the globals were final', safe(() => same(snapOf(target, tui), snap1)) && hooks.stale === 0);
    check('the target\'s object is a NEW one: not the source\'s and not the snapshot\'s (replace, never share)', target.get('spatialMorph') !== src.get('spatialMorph'));
    // an old snapshot restores the DEFAULTS into a page that had a morph
    const oldSnap = clone(snap1); delete oldSnap.settings.spatialMorph;
    const t2 = world('hex', 3, 3, 'none'); setMorph(t2, { enabled: true, mode: 'radial', angleDeg: 270 });
    const r2 = applyInto(t2, oldSnap, fakeHooks(t2, null, uiOf(t2, 'none', 6)));
    check('an OLD snapshot (no block) restores the DEFAULTS into a page whose morph was on: enabled false, linear, 0', r2.ok === true && same(getMorph(t2), DEF), J(getMorph(t2)));
    // malformed block through the real validate+plan+apply
    const bad = clone(snap1); bad.settings.spatialMorph = { enabled: 'x', mode: 'weird', angleDeg: 'y' };
    const t3 = world('hex', 3, 3, 'none'); setMorph(t3, { enabled: true, mode: 'radial', angleDeg: 270 });
    const r3 = applyInto(t3, bad, fakeHooks(t3, null, uiOf(t3, 'none', 6)));
    check('a malformed block restores the defaults (apply does not fail on it)', r3.ok === true && same(getMorph(t3), DEF));
    // the layered scenario round trip with a morph
    const lay = newCtx(); layeredAltNet(lay, {}); setMorph(lay, { enabled: true, mode: 'linear', angleDeg: 315 });
    const lui = uiOf(lay, 'spiegeling', 6), lsnap = snapOf(lay, lui);
    const lt = world('square', 4, 1, 'none'); const lh = fakeHooks(lt, lsnap, uiOf(lt, 'none', 6));
    const lr = applyInto(lt, lsnap, lh);
    check('the heaviest layered scenario round-trips with a morph (snapshot identical after the restore, hooks in order)', lr.ok === true && safe(() => same(snapOf(lt, lh.symmetryUi), lsnap)) && same(getMorph(lt), { enabled: true, mode: 'linear', angleDeg: 315 }) && lh.stale === 0);
    // rollback
    const fresh = () => { const t = world('triangle', 3, 3, 'rotation6'); setMorph(t, { enabled: true, mode: 'radial', angleDeg: 90 }); return t; };
    const steps = ['A:base', 'A:layers', 'A:timeline', 'B:capture', 'B:settings', 'B:grid', 'B:base', 'B:layers', 'B:net', 'C:shapeAndInputs', 'C:symmetry', 'C:toggles', 'C:net', 'C:layers', 'C:timeline', 'C:finish'];
    let allBack = 0, detail = '';
    for (const step of steps) {
        const t = fresh(); const before = t.get('spatialMorph'), beforeJ = J(before);
        const rr = applyInto(t, snap1, fakeHooks(t, null, uiOf(t, 'none', 6)), { beforeStep(name) { if (name === step) throw new Error('fault at ' + name); } });
        if (rr.ok === false && rr.rolledBack === true && t.get('spatialMorph') === before && J(t.get('spatialMorph')) === beforeJ) allBack++; else if (!detail) detail = step + ' ' + J(rr).slice(0, 80);
    }
    check(`a fault before each of ${steps.length} steps rolls back: the old spatialMorph OBJECT (same reference, same value) is back every time`, allBack === steps.length, detail);
    // the classification test of the state `let`s
    const cap = src.get('SESSION_APPLY_CAPTURED'), unt = src.get('SESSION_APPLY_UNTOUCHED');
    check('spatialMorph is CAPTURED (apply writes it, so the rollback must hold it) and not on the left-alone list; captureSessionGlobals() returns it', cap.includes('spatialMorph') && !unt.includes('spatialMorph') && 'spatialMorph' in src.sb.captureSessionGlobals());
    const lets = [...F.read('core/state.js').matchAll(/^let\s+(\w+)/gm)].map(x => x[1]);
    check('every `let` of core/state.js is still classified (the rule test-session-apply.js pins)', lets.every(n => cap.includes(n) || unt.includes(n)) && lets.includes('spatialMorph'));
    check('collectSessionState() hands the live object over by reference (buildSessionSnapshot copies)', src.sb.collectSessionState(ui).spatialMorph === src.get('spatialMorph'));
}

// ---- 5. autosave, export, readers ---------------------------------------------------------------------------------------------------------
console.log('\n== 5. autosave, export, readers ==');
{
    const w = world('square', 3, 5, 'none'); w.run('connections = [[1, 6]];');
    const ui = uiOf(w, 'none', 6);
    const key = () => w.sb.serializeSession(w.sb.buildSessionSnapshot(w.sb.collectSessionState(ui), 0)).text;
    const k0 = key(); setMorph(w, { enabled: true, mode: 'linear', angleDeg: 0 }); const k1 = key(); setMorph(w, { enabled: true, mode: 'linear', angleDeg: 0 });
    check('the autosave writer compares snapshot texts: a change of a parameter changes the text (it will be written), the same value again does not (it is skipped as equal)', k0 !== k1 && key() === k1);
    const wr = w.sb.createSessionWriter({ collect: () => w.sb.collectSessionState(ui), serialize: (st, now) => { const r = w.sb.serializeSession(w.sb.buildSessionSnapshot(st, now)); return r.ok ? r.text : null; },
        write: () => ({ ok: true }), setTimer: () => 1, clearTimer: () => { }, now: () => 1000, isBlocked: () => false });
    wr.markDirty(); wr.flush(); const w1 = wr.inspect().writes; wr.markDirty(); wr.flush(); const w2 = wr.inspect().writes; setMorph(w, { enabled: true, mode: 'radial', angleDeg: 0 }); wr.markDirty(); wr.flush(); const w3 = wr.inspect().writes;
    check('through the real writer: first write, an unchanged state is not written again, a changed parameter is written (markDirty after every draw is all the page needs: nothing in sketch.js marks it)', w1 === 1 && w2 === 1 && w3 === 2, [w1, w2, w3].join(','));
    // export: omitted
    const e0 = exportOf(w); setMorph(w, DEF); const e1 = exportOf(w);
    check('the export JSON does not carry the block (buildExportData is the same with the morph on and off): it describes the drawn pattern, and nothing draws the morph yet', same(e0, e1) && !J(e0).includes('spatialMorph') && !F.read('core/export.js').includes('spatialMorph'));
    // readers
    const readers = ['gallery.html', 'gallery.js', 'gallery-render.js', 'sketch.js', 'core/export.js', 'core/tiling.js', 'core/orbits.js'];
    check('the catalog / gallery readers, sketch.js, the export and the tiling do not mention the morph block (sketch.js is unchanged in stage b)', readers.every(f => !F.read(f).includes('spatialMorph')), readers.filter(f => F.read(f).includes('spatialMorph')).join(','));
    check('the gallery does not load the session code, so it cannot read or write the block', !/core\/session|core\/spatial-morph/.test(F.read('gallery.html')));
    const html = F.read('index.html');
    const tags = [...html.matchAll(/<script src="([^"?]+)\?v=([^"]+)"><\/script>/g)].map(m => m[1]);
    check('index.html loads core/spatial-morph.js once, after core/state.js and before core/session.js', tags.filter(t => t === 'core/spatial-morph.js').length === 1 && tags.indexOf('core/spatial-morph.js') > tags.indexOf('core/state.js') && tags.indexOf('core/spatial-morph.js') < tags.indexOf('core/session.js'));
    const versions = new Set(); for (const f of ['index.html', 'gallery.html', 'color-harmony/ui/index.html']) [...F.read(f).matchAll(/\?v=(\d{8}[a-z]+)/g)].forEach(m => versions.add(m[1]));
    check('the three HTML files carry ONE ?v= string (bumped together)', versions.size === 1, [...versions].join(','));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
