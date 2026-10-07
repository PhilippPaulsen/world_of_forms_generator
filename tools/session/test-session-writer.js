/**
 * tools/session/test-session-writer.js
 * Phase 3 autosave, P2: core/session-writer.js (WHEN the snapshot is written), and the whole cycle with the real modules against a fake storage.
 *
 *   node tools/session/test-session-writer.js
 *   SESSION_WRITER_JS=/path/to/mutated/session-writer.js node tools/session/test-session-writer.js    (sabotage runs)
 *
 * 1. the scheduler with a fake clock and fake timers: a burst is one write, unchanged text is not written, flush, disable, isBlocked, throwing
 *    callbacks, the back-off after a failed write, the max-wait (a user who keeps the mouse moving still gets writes), O(1) markDirty, the
 *    restorability check;
 * 2. the full cycle with REAL modules: collect -> serialize -> write (fake storage, the main key only) -> loadSessionForStartup (reload) -> parse
 *    -> plan -> apply -> collect gives the identical snapshot and export, on the 258 corpus patterns and the layered patterns; the equality
 *    skip works from the second write on.
 */
const S = require('./scenarios.js');
const F = require('./fixtures.js');
const { C, makeContext, J } = F;
const { CANVAS, safe, newCtx, world, populateCorpus, layeredAltNet, uiOf, snapOf, exportOf, fakeHooks, applyInto } = S;

let failures = 0, checks = 0;
function check(name, ok, detail) { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); }
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.message)); process.exit(1); });

const base = makeContext();
const createSessionWriter = base.get('createSessionWriter');
const K = n => base.get(n);

const STORM = { hit: false };
// ---- the rig: a fake clock and fake timers ------------------------------------------------------------------------------------------------
function rig(o) {
    o = o || {};
    const clock = { t: 100000 }, timers = [], R = { clock, timers, writes: [], warns: [], checks: 0, collects: 0, serializes: 0, sets: 0, clears: 0, version: 0, blocked: false, writeResult: () => ({ ok: true }), checkResult: null };
    let id = 0;
    R.setTimer = (fn, ms) => { const h = ++id; timers.push({ h, at: clock.t + ms, fn }); R.sets++; return h; };
    R.clearTimer = h => { const i = timers.findIndex(t => t.h === h); if (i >= 0) timers.splice(i, 1); R.clears++; };
    R.advance = ms => {
        const target = clock.t + ms; let fires = 0;
        for (;;) {
            if (++fires > 5000) { STORM.hit = true; break; }                  // a writer that re-arms at 0 ms forever must FAIL a check, not hang the run
            let next = null; for (const t of timers) if (t.at <= target && (!next || t.at < next.at || (t.at === next.at && t.h < next.h))) next = t;
            if (!next) break;
            timers.splice(timers.indexOf(next), 1); clock.t = Math.max(clock.t, next.at); next.fn();
        }
        clock.t = target;
    };
    R.collect = () => { R.collects++; return { v: R.version }; };
    R.serialize = (s, now) => { R.serializes++; return J({ v: s.v, savedAt: now }); };
    R.write = (text, now) => { const r = R.writeResult(); if (r && r.ok) R.writes.push({ text, at: clock.t }); return r; };
    R.make = extra => (R.w = createSessionWriter(Object.assign({ collect: R.collect, serialize: R.serialize, write: R.write, setTimer: R.setTimer, clearTimer: R.clearTimer, now: () => clock.t,
        isBlocked: () => R.blocked, check: o.check ? () => { R.checks++; return R.checkResult; } : undefined, warn: m => R.warns.push(m) }, extra || {})));
    return R;
}

// ---- 1. the scheduler ----------------------------------------------------------------------------------------------------------------------------
console.log('== 1. scheduler (fake clock, fake timers) ==');
{
    const R = rig(); const w = R.make();
    let lastMark = 0;
    for (let i = 0; i < 50; i++) { R.version++; w.markDirty(); lastMark = R.clock.t; R.advance(10); }          // a burst of 50 edits over 500 ms
    check('a burst of 50 markDirty calls: nothing is written while it lasts', R.writes.length === 0);
    R.advance(lastMark + 799 - R.clock.t); check('...nor 799 ms after the last one', R.writes.length === 0);
    R.advance(1); check('...exactly one write at 800 ms after the last markDirty', R.writes.length === 1, R.writes.length);
    check('the written text carries the real time (savedAt), the comparison used 0', safe(() => JSON.parse(R.writes[0].text).savedAt === R.writes[0].at && JSON.parse(R.writes[0].text).v === 50));
    check('markDirty created at most one timer for the whole burst plus re-arms (not one per call)', R.sets <= 4, R.sets);
}
{
    const R = rig(); const w = R.make();
    R.version = 1; w.markDirty(); R.advance(800); const first = R.writes.length;
    w.markDirty(); R.advance(800);
    check('nothing changed: markDirty + 800 ms writes nothing (equality skip)', first === 1 && R.writes.length === 1 && w.inspect().skippedEqual === 1, `${first}/${R.writes.length}/${w.inspect().skippedEqual}`);
    check('...although the texts that would have been written differ by savedAt (the comparison is made at now = 0)', R.serialize({ v: 1 }, 1) !== R.serialize({ v: 1 }, 2) && R.writes.length === 1);
    R.version = 2; w.markDirty(); R.advance(800);
    check('a change is written again', R.writes.length === 2);
}
{
    const R = rig(); const w = R.make();
    R.version = 1; w.markDirty();
    const before = R.writes.length; const r = w.flush();
    check('flush() writes immediately when dirty', r === 'written' && R.writes.length === before + 1 && R.clock.t === 100000, r);
    const c0 = R.collects; const r2 = w.flush();
    check('flush() on a clean writer does nothing - not even a collect', r2 === 'clean' && R.collects === c0 && R.writes.length === 1, r2);
    R.advance(2000);
    check('the timer that was pending when flush() wrote is a no-op afterwards (still one write)', R.writes.length === 1);
}
{
    const R = rig(); const w = R.make();
    R.version = 1; w.markDirty(); w.disable();
    check('disable() cancels the pending timer (cleared, none pending)', w.inspect().pending === false && R.timers.length === 0 && R.clears >= 1, `${R.timers.length}/${R.clears}`);
    R.advance(10000); check('...nothing fires', R.writes.length === 0);
    check('flush() after disable() writes nothing', w.flush() === 'disabled' && R.writes.length === 0);
    const sets = R.sets; w.markDirty(); R.advance(10000);
    check('markDirty() after disable() arms nothing, writes nothing and does not even mark dirty', R.sets === sets && R.writes.length === 0 && w.inspect().disabled === true && w.inspect().dirty === false);
    // a clearTimer that does nothing (the handle is already gone, or it throws): the timer still fires, and must write nothing
    const R3 = rig(); R3.clearTimer = () => { throw new Error('clearTimer boom'); }; const w3 = R3.make(); R3.version = 1; w3.markDirty(); w3.disable(); R3.advance(5000);
    check('even if clearTimer() throws, a timer that still fires after disable() writes nothing and nothing escapes', R3.writes.length === 0 && w3.inspect().disabled === true);
}
{
    const R = rig(); const w = R.make(); R.blocked = true; R.version = 1;
    w.markDirty(); R.advance(3000);
    check('isBlocked(): no write while blocked, the writer keeps checking', R.writes.length === 0 && w.inspect().skippedBlocked >= 3, w.inspect().skippedBlocked);
    check('flush() while blocked writes nothing and says so', w.flush() === 'blocked' && R.writes.length === 0);
    R.blocked = false; R.advance(800);
    check('unblocked: the deferred write happens at the next check', R.writes.length === 1, R.writes.length);
    // an edit made right before playback starts is not lost: flush at the playback start (blocked is still false at that moment)
    const R2 = rig(); const w2 = R2.make(); R2.version = 1; w2.markDirty(); R2.advance(300);
    const f = w2.flush(); R2.blocked = true; R2.advance(5000);
    check('an edit 300 ms before playback starts: flush() at the start writes it, the block holds afterwards', f === 'written' && R2.writes.length === 1);
}
{
    // throwing callbacks never escape
    const kinds = {
        collect: R => { R.collect = () => { throw new Error('collect boom'); }; },
        serialize: R => { R.serialize = () => { throw new Error('serialize boom'); }; },
        write: R => { R.write = () => { throw new Error('write boom'); }; },
        'non-string serialize': R => { R.serialize = () => null; },
        isBlocked: R => { R.blockedFn = () => { throw new Error('blocked boom'); }; },
        setTimer: R => { R.setTimer = () => { throw new Error('timer boom'); }; },
        now: R => { R.nowThrows = true; },
    };
    for (const [name, brk] of Object.entries(kinds)) {
        const R = rig(); brk(R);
        const w = createSessionWriter({ collect: (...a) => R.collect(...a), serialize: (...a) => R.serialize(...a), write: (...a) => R.write(...a), setTimer: (...a) => R.setTimer(...a), clearTimer: R.clearTimer,
            now: () => { if (R.nowThrows) throw new Error('now boom'); return R.clock.t; }, isBlocked: () => { if (R.blockedFn) return R.blockedFn(); return false; }, warn: m => R.warns.push(m) });
        R.version = 1;
        const out = safe(() => { w.markDirty(); R.advance(900); w.flush(); R.advance(20000); w.markDirty(); w.cancel(); w.disable(); w.inspect(); return true; });
        check(`a throwing ${name} never escapes the writer`, out === true);
    }
    const Rc = rig(); Rc.collect = () => { throw new Error('collect boom'); }; const wc = Rc.make(); Rc.version = 1; wc.markDirty(); Rc.advance(900);
    check('a throwing collect is counted (errors.collect), warned about once, and backed off - not retried on the next draws', wc.inspect().errors.collect === 1 && Rc.warns.length === 1 && /collect boom/.test(Rc.warns[0]) && wc.inspect().backoffUntil > Rc.clock.t, J(wc.inspect().errors) + ' ' + Rc.warns.length);
    const Rs = rig(); Rs.serialize = () => { throw new Error('serialize boom'); }; const ws = Rs.make(); Rs.version = 1; ws.markDirty(); Rs.advance(900);
    check('a throwing serialize is counted and warned about once', ws.inspect().errors.serialize === 1 && Rs.warns.length === 1, J(ws.inspect().errors));
    const R = rig(); R.write = () => { throw new Error('write boom'); }; const w = R.make(); R.version = 1; w.markDirty(); R.advance(900);
    check('a throwing write is counted (errors.write) and warned about once', w.inspect().errors.write === 1 && R.warns.length === 1 && /write boom/.test(R.warns[0]), J(w.inspect().errors) + ' ' + R.warns.length);
}
{
    // quota back-off
    const R = rig(); R.writeResult = () => ({ ok: false, code: 'storage-error', detail: 'QuotaExceededError' }); const w = R.make();
    R.version = 1; w.markDirty(); R.advance(800);
    check('a failed write: one warning, error counted', R.warns.length === 1 && /storage-error/.test(R.warns[0]) && w.inspect().errors['storage-error'] === 1, R.warns.join('|'));
    const attempts = () => R.serializes;
    const s0 = attempts();
    for (let i = 0; i < 300; i++) { R.version++; w.markDirty(); R.advance(30); }      // 9 s of redraws, a changed text each time
    check('during the 10 s back-off, 300 draws cause no new attempt (no collect, no serialize)', attempts() === s0 && R.writes.length === 0 && R.warns.length === 1, `${attempts() - s0} extra serializes`);
    check('a flush() during the back-off does nothing', w.flush() === 'backoff');
    R.writeResult = () => ({ ok: true });
    R.advance(1500);
    check('after the back-off the writer tries again and succeeds (the state was kept dirty)', R.writes.length === 1 && w.inspect().dirty === false, R.writes.length);
    R.writeResult = () => ({ ok: false, code: 'storage-error', detail: 'again' }); R.version++; w.markDirty(); R.advance(800);
    check('the same kind of failure again is NOT warned again (one warn per kind)', R.warns.length === 1, R.warns.length);
}
{
    // max-wait: a user who keeps moving the mouse still gets writes
    const R = rig(); const w = R.make(); const firstDirty = []; let sawFirst = null;
    const t0 = R.clock.t;
    for (let i = 0; i < 200; i++) { R.version++; if (!w.inspect().dirty) sawFirst = R.clock.t; w.markDirty(); const before = R.writes.length; R.advance(100); if (R.writes.length > before) firstDirty.push(R.writes.at(-1).at - sawFirst); }
    check('markDirty every 100 ms for 20 s (a new text each time): at least 3 writes', R.writes.length >= 3, R.writes.length);
    const gaps = R.writes.map((x, i) => x.at - (i ? R.writes[i - 1].at : t0));
    check('every write happens within 5 s of the first unsaved change (max-wait)', firstDirty.length > 0 && Math.max(...firstDirty) <= 5000, firstDirty.join(','));
    check('...so the gap between writes stays at about 5 s, never the 20 s of a pure debounce', Math.max(...gaps) <= 5200, gaps.join(','));
    // and without max-wait the same loop would never write: this is what the max-wait is for
    const R2 = rig(); const w2 = R2.make({ maxWaitMs: 1e12 });
    for (let i = 0; i < 200; i++) { R2.version++; w2.markDirty(); R2.advance(100); }
    check('(control) the same loop with the max-wait disabled never writes', R2.writes.length === 0, R2.writes.length);
}
{
    // O(1) markDirty: no timer churn
    const R = rig(); const w = R.make(); R.version = 1;
    for (let i = 0; i < 1000; i++) w.markDirty();
    check('1000 markDirty calls at one instant arm one timer and clear none', R.sets === 1 && R.clears === 0 && R.collects === 0, `${R.sets}/${R.clears}/${R.collects}`);
    R.advance(800); check('...and write once', R.writes.length === 1);
}
{
    // the restorability check: a text that could not be restored is not written; the previous snapshot stays
    const R = rig({ check: true }); const w = R.make();
    R.version = 1; w.markDirty(); R.advance(800);
    R.checkResult = 'grid-mismatch: layer 1'; R.version = 2; w.markDirty(); R.advance(800);
    check('check() returns a reason: nothing is written, one warning, the earlier snapshot is the stored one', R.writes.length === 1 && w.inspect().skippedUnrestorable === 1 && R.warns.length === 1 && /grid-mismatch/.test(R.warns[0]), R.warns.join('|'));
    const c = R.checks; w.markDirty(); R.advance(800);
    check('the same unrestorable state is not checked or warned about again', R.warns.length === 1 && w.inspect().skippedUnrestorable === 2 && R.checks === c, `${w.inspect().skippedUnrestorable} skipped, ${R.checks - c} extra checks`);
    R.checkResult = null; R.version = 3; w.markDirty(); R.advance(800);
    check('a state that restores again is written', R.writes.length === 2);
    const R2 = rig({ check: true }); const w2 = R2.make(); R2.version = 1; w2.markDirty(); R2.advance(800);
    check('(control) without a reason from check() the write goes through', R2.writes.length === 1);
}
{
    // cancel(): forgets the pending write, not permanent
    const R = rig(); const w = R.make(); R.version = 1; w.markDirty(); w.cancel(); R.advance(5000);
    check('cancel() drops the pending write', R.writes.length === 0 && w.inspect().dirty === false);
    w.markDirty(); R.advance(800);
    check('...and the writer still works afterwards (cancel is not disable)', R.writes.length === 1);
}

check('no scenario above made the writer re-arm a timer at 0 ms forever (the fake clock gave up on none of them)', STORM.hit === false);

// ---- 2. the full cycle with the real modules ------------------------------------------------------------------------------------------------------
console.log('\n== 2. full cycle: collect -> write -> load (reload) -> parse -> plan -> apply -> collect ==');
function fakeStorage() {
    const map = new Map(), calls = [];
    return { map, calls, getItem: k => { calls.push(['get', k]); return map.has(k) ? map.get(k) : null; }, setItem: (k, v) => { calls.push(['set', k]); map.set(k, String(v)); }, removeItem: k => { calls.push(['remove', k]); map.delete(k); } };
}
const HREF = 'https://example.org/world/index.html?x=1';
const RELOAD = { getEntriesByType: () => [{ type: 'reload' }] };
// one writer over a source context, like sketch.js builds it
function writerFor(src, ui, storage, R) {
    const sb = src.sb;
    return R.make({
        collect: () => sb.collectSessionState(ui, { buildSizes: true }),   // as sketch.js: a layer a layer animation left mid-way is saved with the size its nodes were built with
        serialize: (state, now) => { const r = sb.serializeSession(sb.buildSessionSnapshot(state, now)); return r.ok ? r.text : null; },
        write: (text, now) => sb.writeSession(storage, text, HREF, now),
        check: text => { const p = sb.parseSession(text); if (!p.ok) return p.code + ': ' + p.detail; const q = sb.planSessionRestore(p.snapshot, { canvasW: CANVAS, canvasH: CANVAS }); return q.ok ? null : q.code + ': ' + q.detail; },
    });
}
function restoreInto(target, tui, storage, expectedSnap) {
    const loaded = target.sb.loadSessionForStartup({ storage, perf: RELOAD, currentHref: HREF, allowed: true });
    if (loaded.action !== 'restore') return { err: 'load ' + J(loaded) };
    const parsed = target.sb.parseSession(loaded.text); if (!parsed.ok) return { err: 'parse ' + parsed.code };
    const planned = target.sb.planSessionRestore(parsed.snapshot, { canvasW: CANVAS, canvasH: CANVAS }); if (!planned.ok) return { err: 'plan ' + planned.code };
    const r = target.sb.applySessionSnapshot(parsed.snapshot, planned.plan, fakeHooks(target, expectedSnap, tui), {});
    return r.ok ? { ok: true } : { err: 'apply ' + J(r).slice(0, 120) };
}
{
    const patterns = C.buildPatterns();
    const sources = new Map(), target = world('square', 4, 1, 'none'), tui = uiOf(target, 'none', 6);
    let ok = 0, okExport = 0, wrote = 0, keysOnly = true, skipOk = 0, bad = [];
    patterns.forEach((p, i) => {
        const key = p.sh.label; if (!sources.has(key)) sources.set(key, newCtx());
        const src = sources.get(key); populateCorpus(src, p, i);
        const ui = uiOf(src, 'spiegeling', 6), storage = fakeStorage(), R = rig({ check: true });
        const w = writerFor(src, ui, storage, R);
        w.markDirty(); const r1 = w.flush();
        if (r1 === 'written') wrote++; else { bad.push(i + ':write ' + r1 + ' ' + J(w.inspect().errors)); return; }
        if (storage.calls.some(c => c[0] === 'set' && c[1] !== 'wof:session')) keysOnly = false;
        w.markDirty(); const r2 = w.flush(); if (r2 === 'equal') skipOk++;                              // the same state again: skipped by the text
        const exp1 = exportOf(src), snap1 = snapOf(src, ui);
        const r = restoreInto(target, tui, storage, snap1);
        if (!r.ok) { bad.push(i + ':' + r.err); return; }
        if (safe(() => J(snapOf(target, tui)) === J(snap1))) ok++; else bad.push(i + ':snapshot differs');
        if (safe(() => J(exportOf(target)) === J(exp1))) okExport++; else bad.push(i + ':export differs');
    });
    check(`all ${patterns.length} corpus patterns are written (the restorability check passes for every one)`, wrote === patterns.length, `${wrote} ${bad.slice(0, 2).join(' | ')}`);
    check('write -> load -> parse -> plan -> apply -> collect gives the identical snapshot for every pattern', ok === patterns.length, `${ok}/${patterns.length} ${bad.slice(0, 2).join(' | ')}`);
    check('...and the identical export (geometry, faces, face colours)', okExport === patterns.length, `${okExport}/${patterns.length}`);
    check('the writer only ever writes the main key wof:session (never the quarantine slot, never a Farborgel key)', keysOnly);
    check('the equality skip works from the second write on (same state: skipped)', skipOk === patterns.length, `${skipOk}/${patterns.length}`);
}
{
    for (const [label, opt] of [['layered alt-net hex, 3 layers + playback + timeline, custom selection, palette overrides', {}], ['same with a free curve', { curveType: { kind: 'free', seed: 123456789, roughness: 1, strength: 25 } }]]) {
        const src = newCtx(); layeredAltNet(src, opt);
        // the scenario is mid-playback (timeline.playing, clocks): a snapshot never holds clocks, so it is writable regardless
        const ui = uiOf(src, 'spiegeling', 6), storage = fakeStorage(), R = rig({ check: true }); const w = writerFor(src, ui, storage, R);
        w.markDirty(); const r1 = w.flush();
        check(`${label}: written`, r1 === 'written', r1 + ' ' + J(w.inspect().errors));
        const snap1 = snapOf(src, ui), exp1 = exportOf(src);
        const target = world('hex', 3, 3), tui = uiOf(target, 'spiegeling', 3);
        const r = restoreInto(target, tui, storage, snap1);
        check('  restores', r.ok === true, r.err);
        // a second writer over the RESTORED state: its first write rewrites the same snapshot (no last text yet), the second is skipped.
        // (Before buildExportData() below: computing faces lazily writes gray-fill entries into the store, so an export taken first would change what is saved.)
        const R2 = rig({ check: true }), storage2 = fakeStorage(), w2 = writerFor(target, tui, storage2, R2);
        w2.markDirty(); const a = w2.flush(); w2.markDirty(); const b = w2.flush();
        check('  identical snapshot and export after the restore', safe(() => J(snapOf(target, tui)) === J(snap1) && J(exportOf(target)) === J(exp1)));
        check('  after a restore the first write rewrites the (identical) snapshot, the second is skipped', a === 'written' && b === 'equal', `${a},${b}`);
        const texts = (() => { try { const s1 = JSON.parse(JSON.parse(storage.map.get('wof:session')).snapshot), s2 = JSON.parse(JSON.parse(storage2.map.get('wof:session')).snapshot); delete s1.savedAt; delete s2.savedAt; return [s1, s2]; } catch (e) { return null; } })();
        check('  ...and the text of that first write equals the original one apart from savedAt', !!texts && J(texts[0]) === J(texts[1]), texts ? S.firstDiff(texts[0], texts[1]) : 'unreadable');
    }
    // a layer a layer animation left mid-way (live size 3.8, nodes built for 3): written with the build size, restorable; no consistent size: refused, then written once it is consistent
    {
        const src = newCtx(); layeredAltNet(src, {});
        src.run('timeline.playing = false; additionalLayers[0].shapeSizeFactor = 3.8; additionalLayers[0].animation = { fromShapeSizeFactor: 3, toShapeSizeFactor: 5 };');
        const ui = uiOf(src, 'spiegeling', 6), storage = fakeStorage(), R = rig({ check: true }); const w = writerFor(src, ui, storage, R);
        w.markDirty(); const r1 = w.flush();
        const stored = (() => { try { return JSON.parse(JSON.parse(storage.map.get('wof:session')).snapshot); } catch (e) { return null; } })();
        check('layered pattern with layer 0 mid-animation (3.8, nodes built for 3): the writer WRITES it, with the build size 3 in the snapshot', r1 === 'written' && stored && stored.layers[0].shapeSizeFactor === 3 && src.get('additionalLayers')[0].shapeSizeFactor === 3.8, r1 + ' ' + J(w.inspect().errors));
        const target = world('hex', 3, 3), tui = uiOf(target, 'spiegeling', 3);
        const r = restoreInto(target, tui, storage, snapOf(src, ui));
        check('  and it restores: the layer comes back with 3 and the same nodes', r.ok === true && target.get('additionalLayers')[0].shapeSizeFactor === 3 && J(target.get('additionalLayers')[0].nodes) === J(src.get('additionalLayers')[0].nodes), r.err);
        // no consistent size
        src.run('additionalLayers[0].nodes = additionalLayers[0].nodes.map(n => n.free ? n : Object.assign({}, n, { x: n.x + 3 })); additionalLayers[0].shapeSizeFactor = 3.7;');
        R.version++; w.markDirty(); const r2 = w.flush();
        check('a layer with no consistent size: the write is refused (unrestorable), the previous snapshot stays', r2 === 'unrestorable' && J(JSON.parse(JSON.parse(storage.map.get('wof:session')).snapshot).layers[0].shapeSizeFactor) === '3', r2);
        src.run('additionalLayers[0].nodes = additionalLayers[0].nodes.map(n => n.free ? n : Object.assign({}, n, { x: n.x - 3 })); additionalLayers[0].shapeSizeFactor = 3; connections.push([2, 4]);');
        R.version++; w.markDirty(); const r3 = w.flush();
        check('  once the layer is consistent again the next state is written', r3 === 'written', r3);
    }
    // a restore that was quarantined (fresh start): the writer never touches the quarantine slot
    const src = world('square', 4, 3, 'rotation_reflection6'); src.run('connections = [[1, 5]];');
    const storage = fakeStorage(); storage.map.set('wof:session', 'not json at all');
    const loaded = src.sb.loadSessionForStartup({ storage, perf: RELOAD, currentHref: HREF, allowed: true });
    const qBefore = storage.map.get('wof:session:quarantine');
    const R = rig({ check: true }), ui = uiOf(src, 'spiegeling', 6), w = writerFor(src, ui, storage, R);
    w.markDirty(); w.flush(); R.version++; w.markDirty(); w.flush();
    check('after a quarantined (fresh-start) restore the writer writes the main key and leaves the quarantine slot byte for byte alone', loaded.action === 'fresh' && qBefore !== undefined && storage.map.get('wof:session:quarantine') === qBefore && storage.calls.filter(c => c[0] === 'set').every(c => c[1] === 'wof:session' || c[1] === 'wof:session:quarantine') && storage.calls.filter(c => c[0] === 'set' && c[1] === 'wof:session:quarantine').length === 1);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
