/**
 * core/session-writer.js
 * Phase 3 autosave, P2: WHEN the session snapshot is written. A pure scheduler - timers, clock, collecting, serializing and writing are all
 * injected, so Node drives it with a fake clock (tools/session/test-session-writer.js). It decides nothing about WHAT is saved (that is
 * core/session.js) or WHERE (core/session-store.js); sketch.js wires the three together and calls markDirty() at the end of draw().
 *
 *   const w = createSessionWriter({ collect, serialize, write, setTimer, clearTimer, now, isBlocked, check, warn });
 *   w.markDirty()  the saved state MAY have changed (called after every draw - a hover redraw too; see "Cost" below)
 *   w.flush()      write now if dirty (pagehide, visibilitychange to hidden, playback start)
 *   w.cancel()     forget the pending write (not permanent)
 *   w.disable()    stop for good: nothing pending fires, flush() and markDirty() do nothing. "Neu anfangen" calls it BEFORE it removes the
 *                  key - otherwise the pagehide handler writes the snapshot straight back.
 *   w.inspect()    a copy of the internal state (counters, last error, whether a timer is pending)
 *   Every method returns a short string or nothing, and NONE of them throws: a throwing collect/serialize/write/check/isBlocked/timer is
 *   caught, counted, warned about once per kind, and backed off.
 *
 * Injected:
 *   collect()                  -> the state object (core/session-apply.js collectSessionState)
 *   serialize(state, now)      -> the snapshot TEXT (buildSessionSnapshot + serializeSession), or a non-string when it cannot be serialized.
 *                                 Called with now = 0 for the comparison key, and with the real time for the text that is written: savedAt is
 *                                 part of the text, so comparing real texts would never see two snapshots as equal.
 *   write(text, now)           -> { ok: true } | { ok: false, code, detail } (core/session-store.js writeSession; it writes the main key only)
 *   setTimer(fn, ms), clearTimer(handle), now()
 *   isBlocked()                -> true while writing must wait: timeline or layer-animation playback runs (the animation overwrites saved layer
 *                                 fields), a restore is in progress. While blocked and dirty the writer re-checks every debounce interval.
 *   check(text)                -> null, or a reason string when the text could not be restored (the writer then does not write it and keeps the
 *                                 previous snapshot); optional
 *   warn(message)              console.warn by default
 *
 * Timing: a write happens DEBOUNCE_MS after the last markDirty, but never later than MAX_WAIT_MS after the FIRST unsaved change (a user who
 * keeps the mouse moving must still get writes). markDirty() is O(1) and creates no timer unless none is pending - it is called on every
 * draw. Equal text is not written again. After any failure the writer backs off BACKOFF_MS (a full quota must not be hammered on every draw).
 *
 * Cost: markDirty() on every draw rather than gating it on a "did the saved fields change" signature, because such a signature would have to
 * read every saved field (the same work as collecting) or miss edits that change content without changing a length (a per-trail override
 * changes one memberIndex). The cost of a draw is a function call and two integer stores; collect + serialize run at most once per debounce
 * or max-wait interval, and an unchanged text is not written.
 */

const SESSION_WRITE_DEBOUNCE_MS = 800;
const SESSION_WRITE_MAX_WAIT_MS = 5000;
const SESSION_WRITE_BACKOFF_MS = 10000;

function createSessionWriter(o) {
    o = o || {};
    const num = (v, d) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : d);
    const debounceMs = num(o.debounceMs, SESSION_WRITE_DEBOUNCE_MS), maxWaitMs = num(o.maxWaitMs, SESSION_WRITE_MAX_WAIT_MS), backoffMs = num(o.backoffMs, SESSION_WRITE_BACKOFF_MS);
    const st = {
        dirty: false, firstDirtyAt: 0, lastDirtyAt: 0, timer: null, disabled: false,
        lastKey: null, lastText: null, lastWriteAt: null, unrestorableKey: null, backoffUntil: 0,
        writes: 0, skippedEqual: 0, skippedBlocked: 0, skippedUnrestorable: 0, skippedBackoff: 0, timerArms: 0,
        errors: {}, lastError: null, warned: {},
    };
    const warn = msg => {
        try { if (typeof o.warn === 'function') o.warn(msg); else if (typeof console !== 'undefined' && console && typeof console.warn === 'function') console.warn(msg); } catch (e) { /* nothing left to do */ }
    };
    const warnOnce = (kind, msg) => { if (!st.warned[kind]) { st.warned[kind] = true; warn('[session] ' + msg); } };
    const now = () => { try { const t = typeof o.now === 'function' ? o.now() : Date.now(); return typeof t === 'number' && isFinite(t) ? t : 0; } catch (e) { return 0; } };
    const blocked = () => { try { return typeof o.isBlocked === 'function' ? !!o.isBlocked() : false; } catch (e) { return true; } };   // when in doubt, do not write

    function dueAt() { return Math.max(Math.min(st.lastDirtyAt + debounceMs, st.firstDirtyAt + maxWaitMs), st.backoffUntil); }
    function clearTimerSafe() {
        if (st.timer === null) return;
        const h = st.timer; st.timer = null;
        try { if (typeof o.clearTimer === 'function') o.clearTimer(h); } catch (e) { /* the timer will fire into a no-op: onTimer checks the state */ }
    }
    function arm(delay) {
        if (st.timer !== null || st.disabled) return;
        try { st.timerArms++; st.timer = o.setTimer(onTimer, Math.max(0, delay)); if (st.timer === null || st.timer === undefined) st.timer = null; }
        catch (e) { st.timer = null; fail('timer', e); }
    }
    function fail(kind, detail) {
        const t = now();
        const text = detail && (detail.name || detail.message) ? (detail.name && detail.message ? detail.name + ': ' + detail.message : String(detail.name || detail.message)) : String(detail);
        st.errors[kind] = (st.errors[kind] || 0) + 1; st.lastError = { kind, detail: text, at: t };
        st.backoffUntil = t + backoffMs;
        warnOnce(kind, `snapshot not saved (${kind}: ${text}); trying again in ${Math.round(backoffMs / 1000)} s at the earliest`);
        return 'error';
    }

    // One attempt to write. Returns what happened; dirty stays true only when a later attempt can succeed (a failure, which has backed off).
    function attempt() {
        let state, key, text, reason = null, res;
        try { state = o.collect(); } catch (e) { return fail('collect', e); }
        try { key = o.serialize(state, 0); } catch (e) { return fail('serialize', e); }
        if (typeof key !== 'string') return fail('serialize', 'the state could not be serialized');
        if (key === st.lastKey) { st.dirty = false; st.skippedEqual++; return 'equal'; }
        if (key === st.unrestorableKey) { st.dirty = false; st.skippedUnrestorable++; return 'unrestorable'; }
        const t = now();
        try { text = o.serialize(state, t); } catch (e) { return fail('serialize', e); }
        if (typeof text !== 'string') return fail('serialize', 'the state could not be serialized');
        if (typeof o.check === 'function') {
            try { reason = o.check(text); } catch (e) { return fail('check', e); }
            if (reason) {
                st.dirty = false; st.unrestorableKey = key; st.skippedUnrestorable++;
                warnOnce('unrestorable:' + reason, `snapshot not saved, it could not be restored (${reason}); the previous one stays`);
                return 'unrestorable';
            }
        }
        try { res = o.write(text, t); } catch (e) { return fail('write', e); }
        if (!res || res.ok !== true) return fail(res && res.code ? String(res.code) : 'write', res && res.detail !== undefined ? res.detail : 'the write was refused');
        st.dirty = false; st.lastKey = key; st.lastText = text; st.lastWriteAt = t; st.writes++; st.unrestorableKey = null;
        return 'written';
    }
    function onTimer() {
        try {
            st.timer = null;
            if (st.disabled || !st.dirty) return;
            const t = now(), due = dueAt();
            if (t < due) { arm(due - t); return; }
            if (blocked()) { st.skippedBlocked++; arm(debounceMs); return; }
            attempt();
            if (st.dirty && !st.disabled) arm(Math.max(0, dueAt() - now()));   // a failed attempt retries after its back-off
        } catch (e) { /* never escapes */ }
    }

    return {
        markDirty() {
            try {
                if (st.disabled) return 'disabled';
                const t = now();
                if (!st.dirty) { st.dirty = true; st.firstDirtyAt = t; }
                st.lastDirtyAt = t;
                if (st.timer === null) arm(dueAt() - t);
                return 'dirty';
            } catch (e) { return 'error'; }
        },
        flush() {
            try {
                if (st.disabled) return 'disabled';
                if (!st.dirty) return 'clean';
                if (blocked()) { st.skippedBlocked++; return 'blocked'; }
                if (now() < st.backoffUntil) { st.skippedBackoff++; return 'backoff'; }
                clearTimerSafe();
                const r = attempt();
                if (st.dirty && !st.disabled) arm(Math.max(0, dueAt() - now()));
                return r;
            } catch (e) { return 'error'; }
        },
        cancel() { try { clearTimerSafe(); st.dirty = false; return 'cancelled'; } catch (e) { return 'error'; } },
        disable() { try { st.disabled = true; clearTimerSafe(); st.dirty = false; return 'disabled'; } catch (e) { st.disabled = true; return 'disabled'; } },
        inspect() {
            return { dirty: st.dirty, disabled: st.disabled, pending: st.timer !== null, firstDirtyAt: st.firstDirtyAt, lastDirtyAt: st.lastDirtyAt, backoffUntil: st.backoffUntil,
                lastWriteAt: st.lastWriteAt, lastText: st.lastText, writes: st.writes, skippedEqual: st.skippedEqual, skippedBlocked: st.skippedBlocked, skippedUnrestorable: st.skippedUnrestorable,
                skippedBackoff: st.skippedBackoff, timerArms: st.timerArms, errors: Object.assign({}, st.errors), lastError: st.lastError ? Object.assign({}, st.lastError) : null };
        },
    };
}
