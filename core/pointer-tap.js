/*
 * Phase 2 (touch), track B1: the tap detector for touch and pen. Pure: no DOM, no p5, no timers - the clock is injected, the caller feeds it
 * the pointer events it receives (sketch.js, B2). It decides ONE thing: did this pointer sequence amount to a tap.
 *
 * WHY. p5 1.9.0 calls mousePressed() at touchstart (UA contains "safari", no touchStarted defined) and again for the emulated mousedown that
 * follows a tap (measured on a real iPhone: 25 gestures, 39 mousePressed calls, 8 of 10 lines degenerate [n,n]). Touch and pen are therefore
 * handled here, from pointer events; the mouse path stays what it was. See tools/ui/test-pointer-tap.js for the recorded sequences.
 *
 *   const d = createTapDetector({ now })           now() -> milliseconds (injected; default performance.now / Date.now)
 *   d.down(ev) d.move(ev) d.up(ev) d.cancel(ev)    ev = { pointerId, pointerType, clientX, clientY } (a PointerEvent works as it is)
 *   d.up(ev)    -> { x, y, pointerType, t } for a valid tap, else null. x, y are the CSS-pixel position where the pointer went DOWN (client
 *                  coordinates, like the mouse events they are compared with); t = now() at the pointerup.
 *   d.consumeEmulatedMouse(x, y) -> true once for the emulated mousedown that follows the last tap (see below), else false
 *   d.reset() d.inspect()
 *   down / move / cancel return a short status string (for the tests and for logging); none of the methods throws on odd input.
 *
 * RULES
 *   - Only pointerType 'touch' and 'pen'. A mouse event (or an unknown type) is ignored: no state change, in particular it does not cancel a
 *     touch in progress.
 *   - One active pointer. A second pointer going down while another one is still live cancels the tap (pinch); the gesture stays cancelled
 *     until every pointer of it is up or cancelled, then the next single pointer is a normal tap again.
 *   - Movement of more than 10 CSS px from the down position cancels (checked on move AND at up: a move event can be missing). Moving away and
 *     coming back stays cancelled.
 *   - pointercancel cancels (the browser took the gesture, e.g. to scroll). A duration over 600 ms is a long press, not a tap.
 *   - A pointerup that never arrives (alert, tab switch, lost event) must not wedge the detector: a pointer older than the tap limit is
 *     forgotten when the next pointer goes down. A pointer that goes down again with an id that is still tracked replaces the old record.
 *   - A pointerup (or pointercancel) of an id that is not tracked changes nothing and gives no tap.
 *
 * EMULATED MOUSE. After a tap the browser sends mousemove / mousedown / mouseup / click at the tap position (iPhone: mousedown 75 ms after the
 * pointerup). shouldIgnoreEmulatedMouse() says whether a mouse press belongs to the last tap: it ended less than 800 ms ago and the press is
 * within 24 px of it. consumeEmulatedMouse() asks that of the last tap the detector saw and forgets the tap when the answer is yes, so a
 * second press near the same place is a real one.
 */

const POINTER_TAP_MAX_MOVE_PX = 10;
const POINTER_TAP_MAX_MS = 600;
const EMULATED_MOUSE_WINDOW_MS = 800;
const EMULATED_MOUSE_RADIUS_PX = 24;

function _tapIsTouchLike(ev) { return !!ev && (ev.pointerType === 'touch' || ev.pointerType === 'pen'); }
function _tapNum(v) { return typeof v === 'number' && isFinite(v) ? v : NaN; }
function _tapDist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

// lastTap = { x, y, t } (a tap as up() returns it); x, y in the same coordinates as the mouse event (client px)
function shouldIgnoreEmulatedMouse(o) {
    if (!o || !o.lastTap) return false;
    const t = _tapNum(o.lastTap.t), now = _tapNum(o.now), x = _tapNum(o.x), y = _tapNum(o.y), tx = _tapNum(o.lastTap.x), ty = _tapNum(o.lastTap.y);
    if (isNaN(t) || isNaN(now) || isNaN(x) || isNaN(y) || isNaN(tx) || isNaN(ty)) return false;
    if (now - t >= EMULATED_MOUSE_WINDOW_MS || now < t) return false;
    return _tapDist(x, y, tx, ty) <= EMULATED_MOUSE_RADIUS_PX;
}

function createTapDetector(o) {
    o = o || {};
    const now = () => {
        try { const t = typeof o.now === 'function' ? o.now() : (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()); return typeof t === 'number' && isFinite(t) ? t : 0; }
        catch (e) { return 0; }
    };
    // pointers: id -> { t0 } for every touch/pen pointer that is down; cand: the one tap in the making (null when the gesture is cancelled)
    let pointers = new Map(), cand = null, lastTap = null;

    function reset() { pointers = new Map(); cand = null; }
    function purgeStale(t) { pointers.forEach((p, id) => { if (t - p.t0 > POINTER_TAP_MAX_MS) { pointers.delete(id); if (cand && cand.id === id) cand = null; } }); }

    function down(ev) {
        try {
            if (!_tapIsTouchLike(ev)) return 'ignored';
            const t = now(), id = ev.pointerId, x = _tapNum(ev.clientX), y = _tapNum(ev.clientY);
            purgeStale(t);
            if (pointers.has(id)) { pointers.delete(id); if (cand && cand.id === id) cand = null; }   // a down for an id that never went up: the old record is dead
            if (pointers.size > 0) { cand = null; pointers.set(id, { t0: t }); return 'multi'; }   // another pointer is live: pinch, nothing is a tap until all are up
            pointers.set(id, { t0: t });
            if (isNaN(x) || isNaN(y)) { cand = null; return 'bad-position'; }
            cand = { id, x0: x, y0: y, t0: t, pointerType: ev.pointerType };
            return 'down';
        } catch (e) { reset(); return 'error'; }
    }

    function move(ev) {
        try {
            if (!_tapIsTouchLike(ev)) return 'ignored';
            if (!cand || cand.id !== ev.pointerId) return 'idle';
            const x = _tapNum(ev.clientX), y = _tapNum(ev.clientY);
            if (isNaN(x) || isNaN(y) || _tapDist(x, y, cand.x0, cand.y0) > POINTER_TAP_MAX_MOVE_PX) { cand = null; return 'moved'; }
            return 'ok';
        } catch (e) { reset(); return 'error'; }
    }

    function up(ev) {
        try {
            if (!_tapIsTouchLike(ev)) return null;
            if (!pointers.has(ev.pointerId)) return null;   // not a pointer this detector saw go down: no tap, nothing changes
            const t = now();
            pointers.delete(ev.pointerId);
            const c = cand && cand.id === ev.pointerId ? cand : null;
            if (c) cand = null;
            if (pointers.size === 0) cand = null;
            if (!c) return null;
            if (t - c.t0 > POINTER_TAP_MAX_MS) return null;   // long press
            const x = _tapNum(ev.clientX), y = _tapNum(ev.clientY);
            if (!isNaN(x) && !isNaN(y) && _tapDist(x, y, c.x0, c.y0) > POINTER_TAP_MAX_MOVE_PX) return null;   // the finger ended elsewhere, no move event told us
            lastTap = { x: c.x0, y: c.y0, t };
            return { x: c.x0, y: c.y0, pointerType: c.pointerType, t };
        } catch (e) { reset(); return null; }
    }

    function cancel(ev) {
        try {
            if (ev && ev.pointerType !== undefined && !_tapIsTouchLike(ev)) return 'ignored';
            if (!ev || ev.pointerId === undefined) { reset(); return 'reset'; }
            if (!pointers.has(ev.pointerId)) return 'unknown';
            pointers.delete(ev.pointerId);
            if (cand && cand.id === ev.pointerId) cand = null;
            if (pointers.size === 0) cand = null;
            return 'cancelled';
        } catch (e) { reset(); return 'error'; }
    }

    function consumeEmulatedMouse(x, y) {
        try {
            if (shouldIgnoreEmulatedMouse({ lastTap, now: now(), x, y })) { lastTap = null; return true; }
            return false;
        } catch (e) { return false; }
    }

    return {
        down, move, up, cancel, reset, consumeEmulatedMouse,
        inspect() { return { pointers: pointers.size, candidate: cand ? { id: cand.id, x: cand.x0, y: cand.y0, t0: cand.t0 } : null, lastTap: lastTap ? Object.assign({}, lastTap) : null }; },
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createTapDetector, shouldIgnoreEmulatedMouse, POINTER_TAP_MAX_MOVE_PX, POINTER_TAP_MAX_MS, EMULATED_MOUSE_WINDOW_MS, EMULATED_MOUSE_RADIUS_PX };
}
