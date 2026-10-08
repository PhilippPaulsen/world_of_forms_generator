// Test for core/pointer-tap.js (Phase 2 touch, B1): the tap detector for touch and pen and the emulated-mouse filter.
//   node tools/ui/test-pointer-tap.js
//   POINTER_TAP_JS=/path/to/mutated/pointer-tap.js node tools/ui/test-pointer-tap.js     (sabotage runs)
//
// The clock is injected; every sequence is a list of timed events replayed through a small harness that does what sketch.js will do in B2:
// pointer events go to the detector, a valid tap is one "press", a mouse press is one press unless the detector says it is the emulated one.
// "legacy" replays the same events through what p5 1.9.0 does today (a press at touchstart AND one at every mousedown) - the bug this track fixes.
//
// FIXTURES. iphone-tap and iphone-scroll are the sequences measured on a real iPhone (iOS 18.7, Safari, probe-app on the real app, 2026-10):
//   tap:    pointerdown(touch) +0, touchstart +2, pointerup +132, touchend +134, mousemove +145, mousedown +207, mouseup +208, click detail=1 +208
//   scroll: a touch that becomes a scroll ends in pointercancel (the probe log does not give times or positions for it: those here are made up)
// Positions are not in the quoted log either; they are chosen here. Everything else is synthetic and marked so.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(process.env.POINTER_TAP_JS || path.join(__dirname, '..', '..', 'core', 'pointer-tap.js'), 'utf8');
const sb = {}; vm.createContext(sb); vm.runInContext(src, sb);
const P = vm.runInContext('({ createTapDetector, shouldIgnoreEmulatedMouse, POINTER_TAP_MAX_MOVE_PX, POINTER_TAP_MAX_MS, EMULATED_MOUSE_WINDOW_MS, EMULATED_MOUSE_RADIUS_PX })', sb);

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const J = x => JSON.stringify(x);
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });

// ---- harness ------------------------------------------------------------------------------------------------------------------------
function rig() {
    const clock = { t: 0 };
    const d = P.createTapDetector({ now: () => clock.t });
    return { clock, d };
}
// events: { t, type, id, pt (pointerType), x, y }. Returns { taps, presses, ignoredMouse, log }
function replay(events, mode) {
    const { clock, d } = rig();
    const out = { taps: [], presses: [], ignoredMouse: 0, log: [] };
    for (const e of events) {
        clock.t = e.t;
        const ev = { pointerId: e.id, pointerType: e.pt, clientX: e.x, clientY: e.y };
        if (mode === 'legacy') {
            if (e.type === 'touchstart' || e.type === 'mousedown') out.presses.push({ t: e.t, by: e.type });
            continue;
        }
        if (e.type === 'pointerdown') d.down(ev);
        else if (e.type === 'pointermove') d.move(ev);
        else if (e.type === 'pointerup') { const tap = d.up(ev); if (tap) { out.taps.push(tap); out.presses.push({ t: e.t, by: 'tap', x: tap.x, y: tap.y }); } }
        else if (e.type === 'pointercancel') d.cancel(ev);
        else if (e.type === 'mousedown') { if (d.consumeEmulatedMouse(e.x, e.y)) out.ignoredMouse++; else out.presses.push({ t: e.t, by: 'mouse', x: e.x, y: e.y }); }
        // touchstart / touchend / mousemove / mouseup / click: not used by the detector path
    }
    return out;
}
const ev = (t, type, o) => Object.assign({ t, type, id: 1, pt: 'touch', x: 100, y: 200 }, o);

// the fixtures
const IPHONE_TAP = [ev(0, 'pointerdown'), ev(2, 'touchstart'), ev(132, 'pointerup'), ev(134, 'touchend'), ev(145, 'mousemove'), ev(207, 'mousedown', { pt: 'mouse' }), ev(208, 'mouseup', { pt: 'mouse' }), ev(208, 'click', { pt: 'mouse' })];
const IPHONE_SCROLL = [ev(0, 'pointerdown'), ev(2, 'touchstart'), ev(40, 'pointermove', { y: 190 }), ev(80, 'pointermove', { y: 160 }), ev(120, 'pointercancel')];   // times and positions made up
const IPHONE_TAP_THEN_SCROLL_THEN_TAP = [].concat(IPHONE_TAP, IPHONE_SCROLL.map(e => Object.assign({}, e, { t: e.t + 1000, id: 2 })), IPHONE_TAP.map(e => Object.assign({}, e, { t: e.t + 2500, id: 3, x: e.pt === 'touch' ? 260 : e.x })).map(e => e.type === 'mousedown' ? Object.assign(e, { x: 260 }) : e));

// ---- 1. the iPhone sequences --------------------------------------------------------------------------------------------------------
console.log('== 1. the recorded iPhone sequences ==');
{
    const legacy = replay(IPHONE_TAP, 'legacy');
    check('legacy (p5 1.9.0 today): one tap = TWO presses (touchstart and the emulated mousedown) - the measured bug', legacy.presses.length === 2 && legacy.presses[0].by === 'touchstart' && legacy.presses[1].by === 'mousedown', J(legacy.presses));
    const r = replay(IPHONE_TAP);
    check('iphone-tap: exactly one press, from the tap detector, at the down position', r.presses.length === 1 && r.presses[0].by === 'tap' && r.presses[0].x === 100 && r.presses[0].y === 200, J(r.presses));
    check('iphone-tap: the tap is {x, y, pointerType, t} with t = the pointerup time (132)', J(r.taps) === J([{ x: 100, y: 200, pointerType: 'touch', t: 132 }]), J(r.taps));
    check('iphone-tap: the emulated mousedown at +207 (75 ms after the pointerup) is consumed, not pressed', r.ignoredMouse === 1);
    const s = replay(IPHONE_SCROLL);
    check('iphone-scroll (moves over 10 px, then pointercancel): no tap, no press', s.taps.length === 0 && s.presses.length === 0, J(s.presses));
    check('legacy on the scroll: ONE press from touchstart alone (the stray node a scroll draws today)', replay(IPHONE_SCROLL, 'legacy').presses.length === 1);
    const scrollNoMove = [ev(0, 'pointerdown'), ev(2, 'touchstart'), ev(60, 'pointercancel')];   // the browser takes the gesture before any move event: also plausible, also no tap
    check('iphone-scroll without any pointermove (pointerdown, pointercancel): no tap, no press; legacy still presses once', replay(scrollNoMove).presses.length === 0 && replay(scrollNoMove, 'legacy').presses.length === 1);
    // the aggregate of the real run: 25 gestures -> 39 mousePressed calls. Taps give 2 calls, scrolls 1: 14 taps + 11 scrolls = 39. The split is INFERRED from the totals, not logged.
    const agg = []; let at = 0;
    for (let i = 0; i < 25; i++) { const id = i + 1, x = 40 + (i * 37) % 300; const seq = i % 25 < 14 ? IPHONE_TAP : IPHONE_SCROLL; seq.forEach(e => agg.push(Object.assign({}, e, { t: e.t + at, id, x: e.pt === 'touch' ? x : x }))); at += 1500; }
    const aggL = replay(agg, 'legacy'), aggN = replay(agg);
    check('aggregate of the real run (inferred split: 14 taps + 11 scrolls = 25 gestures): legacy makes 39 presses as measured, the detector makes 14 (one per tap, none per scroll)', aggL.presses.length === 39 && aggN.presses.length === 14 && aggN.ignoredMouse === 14, `${aggL.presses.length} -> ${aggN.presses.length}`);
    const all = replay(IPHONE_TAP_THEN_SCROLL_THEN_TAP);
    check('tap, then a scroll, then another tap: two presses, in order, the scroll left nothing behind', all.presses.length === 2 && all.presses[0].x === 100 && all.presses[1].x === 260, J(all.presses));
    const leg = replay(IPHONE_TAP_THEN_SCROLL_THEN_TAP, 'legacy');
    check('legacy on the same: 5 presses for 2 taps and a scroll (2 + 1 + 2)', leg.presses.length === 5, String(leg.presses.length));
}

// ---- 2. thresholds -------------------------------------------------------------------------------------------------------------------
console.log('\n== 2. thresholds: movement, duration, position at up, pen, mouse ==');
{
    const down = (r, o) => r.d.down(Object.assign({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 }, o));
    let r = rig(); down(r); r.clock.t = 100; r.d.move({ pointerId: 1, pointerType: 'touch', clientX: 110, clientY: 100 });
    check('a move of exactly 10 px is still a tap', r.d.up({ pointerId: 1, pointerType: 'touch', clientX: 110, clientY: 100 }) !== null);
    r = rig(); down(r); r.d.move({ pointerId: 1, pointerType: 'touch', clientX: 110.1, clientY: 100 });
    check('a move of 10.1 px cancels', r.d.up({ pointerId: 1, pointerType: 'touch', clientX: 110.1, clientY: 100 }) === null);
    r = rig(); down(r); r.d.move({ pointerId: 1, pointerType: 'touch', clientX: 107, clientY: 107 });
    check('the distance is Euclidean: 7 + 7 px diagonal is 9.9 px, a tap', r.d.up({ pointerId: 1, pointerType: 'touch', clientX: 107, clientY: 107 }) !== null);
    r = rig(); down(r); r.d.move({ pointerId: 1, pointerType: 'touch', clientX: 108, clientY: 108 });
    check('...and 8 + 8 px diagonal is 11.3 px, cancelled', r.d.up({ pointerId: 1, pointerType: 'touch', clientX: 108, clientY: 108 }) === null);
    r = rig(); down(r); r.d.move({ pointerId: 1, pointerType: 'touch', clientX: 140, clientY: 100 }); r.d.move({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    check('moving away and back to the start stays cancelled', r.d.up({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 }) === null);
    r = rig(); down(r);
    check('no move event at all, but the pointerup is 30 px away: no tap (the position at up is checked too)', r.d.up({ pointerId: 1, pointerType: 'touch', clientX: 130, clientY: 100 }) === null);
    r = rig(); down(r); r.clock.t = 600;
    check('a duration of exactly 600 ms is a tap', r.d.up({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 }) !== null);
    r = rig(); down(r); r.clock.t = 601;
    check('601 ms is a long press, not a tap', r.d.up({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 }) === null);
    r = rig(); down(r, { pointerType: 'pen' }); r.clock.t = 50;
    const pen = r.d.up({ pointerId: 1, pointerType: 'pen', clientX: 101, clientY: 100 });
    check('a pen tap is a tap and reports pointerType "pen"', pen && pen.pointerType === 'pen' && pen.x === 100 && pen.y === 100, J(pen));
    r = rig(); r.d.down({ pointerId: 1, pointerType: 'mouse', clientX: 5, clientY: 5 });
    check('a mouse pointer is not handled here: down gives no candidate, up gives null', r.d.inspect().pointers === 0 && r.d.up({ pointerId: 1, pointerType: 'mouse', clientX: 5, clientY: 5 }) === null);
    r = rig(); down(r); r.d.down({ pointerId: 9, pointerType: 'mouse', clientX: 300, clientY: 300 }); r.d.move({ pointerId: 9, pointerType: 'mouse', clientX: 500, clientY: 500 }); r.d.cancel({ pointerId: 9, pointerType: 'mouse' });
    check('a mouse pointer passing through during a touch does not cancel the touch', r.d.up({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 }) !== null);
    r = rig(); r.d.down({ pointerId: 1, pointerType: '', clientX: 5, clientY: 5 }); r.d.down({ pointerId: 2, pointerType: undefined, clientX: 5, clientY: 5 }); r.d.down(null); r.d.down(undefined);
    check('an unknown pointer type, null and undefined are ignored and nothing throws', r.d.inspect().pointers === 0);
    r = rig(); r.d.down({ pointerId: 1, pointerType: 'touch', clientX: NaN, clientY: 5 });
    check('a down with a NaN position is no candidate (no NaN coordinates ever reach the sketch)', r.d.up({ pointerId: 1, pointerType: 'touch', clientX: 5, clientY: 5 }) === null);
}

// ---- 3. several pointers --------------------------------------------------------------------------------------------------------------
console.log('\n== 3. a second pointer (pinch) ==');
{
    const T = (id, x, y) => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y });
    let r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 30; r.d.down(T(2, 220, 100)); r.clock.t = 80;
    const a = r.d.up(T(1, 100, 100)), b = r.d.up(T(2, 220, 100));
    check('two fingers: neither pointerup is a tap (the second pointer cancelled the first)', a === null && b === null);
    r.clock.t = 400; r.d.down(T(3, 50, 50)); r.clock.t = 450;
    const c = r.d.up(T(3, 50, 50));
    check('the next single tap after the pinch works', c && c.x === 50 && c.t === 450, J(c));
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 30; r.d.down(T(2, 220, 100)); r.clock.t = 60; r.d.up(T(2, 220, 100)); r.clock.t = 90;
    const d1 = r.d.up(T(1, 100, 100));
    check('the SECOND finger lifted first, then the first: still no tap', d1 === null);
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 30; r.d.down(T(2, 220, 100)); r.clock.t = 60; r.d.up(T(1, 100, 100)); r.clock.t = 70; r.d.down(T(3, 100, 100)); r.clock.t = 90;
    check('a new finger while one of the pinch fingers is still down is not a tap', r.d.up(T(3, 100, 100)) === null);
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 100; r.d.up(T(1, 100, 100)); r.clock.t = 120; r.d.down(T(2, 100, 100)); r.clock.t = 140;
    check('a second tap after the first finger is UP is a normal tap (not mistaken for a second finger)', r.d.up(T(2, 100, 100)) !== null);
}

// ---- 4. cancelled gestures and the stuck state ---------------------------------------------------------------------------------------
console.log('\n== 4. after a cancelled gesture the next single tap works; a lost pointerup does not wedge the detector ==');
{
    const T = (id, x, y, type) => ({ pointerId: id, pointerType: type || 'touch', clientX: x, clientY: y });
    const nextTapWorks = (r, id) => { r.clock.t += 700; r.d.down(T(id, 40, 40)); r.clock.t += 60; const t = r.d.up(T(id, 40, 40)); return !!t && t.x === 40 && t.y === 40; };
    // pointercancel
    let r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 50; r.d.cancel(T(1, 100, 100));
    check('after pointercancel: up of that id gives no tap, and the detector holds no candidate and no pointer', r.d.up(T(1, 100, 100)) === null && (() => { const q = rig(); q.d.down(T(1, 100, 100)); q.d.cancel(T(1, 100, 100)); const i = q.d.inspect(); return i.candidate === null && i.pointers === 0; })());
    check('...and the next single tap is a normal tap', nextTapWorks(r, 2));
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 50; r.d.cancel(T(1, 100, 100));
    r.clock.t = 100; r.d.down(T(2, 40, 40)); r.clock.t = 150;
    check('...even immediately after (100 ms later), without waiting for any timeout', r.d.up(T(2, 40, 40)) !== null);
    // second finger
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 20; r.d.down(T(2, 200, 100)); r.clock.t = 60; r.d.up(T(2, 200, 100)); r.d.up(T(1, 100, 100));
    check('after a two-finger gesture the next single tap works (immediately)', (() => { r.clock.t = 100; r.d.down(T(3, 40, 40)); r.clock.t = 140; return r.d.up(T(3, 40, 40)) !== null; })());
    // movement over 10 px
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 40; r.d.move(T(1, 100, 140)); r.clock.t = 80; r.d.up(T(1, 100, 140));
    check('after a movement over 10 px the next single tap works (immediately)', (() => { r.clock.t = 100; r.d.down(T(2, 40, 40)); r.clock.t = 140; return r.d.up(T(2, 40, 40)) !== null; })());
    // a cancel without id resets everything
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 10; r.d.down(T(2, 200, 100)); r.d.cancel();
    check('cancel() with no event forgets every pointer', r.d.inspect().pointers === 0 && r.d.inspect().candidate === null);
    check('...and a pointercancel for an id that was never tracked changes nothing', (() => { const q = rig(); q.d.down(T(1, 100, 100)); q.d.cancel(T(77, 0, 0)); q.clock.t = 50; return q.d.up(T(1, 100, 100)) !== null; })());
    // a pointerup that never arrives
    r = rig(); r.d.down(T(1, 100, 100));   // finger A: its pointerup is lost
    r.clock.t = 2000; r.d.down(T(2, 40, 40)); r.clock.t = 2050;
    const t2 = r.d.up(T(2, 40, 40));
    check('a pointerdown whose pointerup never arrives, then a new pointerdown 2 s later: the new tap works (the old pointer is forgotten)', t2 && t2.x === 40 && r.d.inspect().pointers === 0, J(t2));
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 601; r.d.down(T(2, 40, 40)); r.clock.t = 650;
    check('...the old pointer is forgotten as soon as it is older than the tap limit (601 ms)', r.d.up(T(2, 40, 40)) !== null);
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 600; r.d.down(T(2, 40, 40)); r.clock.t = 650;
    check('...but at exactly 600 ms it is still live, so the new pointer is the second finger of a pinch: no tap', r.d.up(T(2, 40, 40)) === null);
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 10; r.d.down(T(1, 120, 120)); r.clock.t = 50;
    const dup = r.d.up(T(1, 120, 120));
    check('the same pointerId going down twice without an up: the second down replaces the first (tap at the second position)', dup && dup.x === 120 && dup.y === 120 && r.d.inspect().pointers === 0, J(dup));
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 10; r.d.down(T(2, 200, 100)); r.clock.t = 20; r.d.up(T(1, 100, 100));   // finger 2's pointerup is lost
    r.clock.t = 1500; r.d.down(T(3, 40, 40)); r.clock.t = 1540;
    check('a two-finger gesture whose last pointerup is lost does not wedge it either: the next tap 1.5 s later works', r.d.up(T(3, 40, 40)) !== null);
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 700; r.d.up(T(1, 100, 100));
    check('a long press (700 ms) leaves nothing behind: the next tap works at once', (() => { r.clock.t = 720; r.d.down(T(2, 40, 40)); r.clock.t = 760; return r.d.up(T(2, 40, 40)) !== null; })());
    for (let i = 0; i < 50; i++) { const q = rig(); q.d.down(T(1, 1, 1)); q.d.up(T(1, 1, 1)); }
    check('inspect() after a clean tap: no pointers, no candidate', (() => { const q = rig(); q.d.down(T(1, 5, 5)); q.clock.t = 10; q.d.up(T(1, 5, 5)); const i = q.d.inspect(); return i.pointers === 0 && i.candidate === null; })());
}

// ---- 5. pointer identity -----------------------------------------------------------------------------------------------------------
console.log('\n== 5. pointer identity ==');
{
    const T = (id, x, y) => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y });
    let r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 50;
    check('a pointerup with a different pointerId produces no tap', r.d.up(T(2, 100, 100)) === null);
    check('...and leaves the active tap alone: the real pointerup still gives it', r.d.up(T(1, 100, 100)) !== null);
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 50; r.d.move(T(2, 400, 400));
    check('a pointermove of another id does not cancel the active tap', r.d.up(T(1, 100, 100)) !== null);
    r = rig();
    check('a pointerup with nothing down gives no tap', r.d.up(T(1, 100, 100)) === null);
    r = rig(); r.d.down(T(1, 100, 100)); r.clock.t = 30; r.d.up(T(1, 100, 100)); r.clock.t = 40;
    check('a second pointerup for the same id (a duplicate) gives no second tap', r.d.up(T(1, 100, 100)) === null);
    r = rig(); r.d.down({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 }); r.clock.t = 30;
    check('a pointerup of the same id but another pointerType does not count as a mouse/other pointer tap', r.d.up({ pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 100 }) === null && r.d.up(T(1, 100, 100)) !== null);
}

// ---- 6. the emulated mouse ------------------------------------------------------------------------------------------------------------
console.log('\n== 6. emulated mouse after a tap ==');
{
    const tap = { x: 100, y: 200, t: 132 };
    const f = (o) => P.shouldIgnoreEmulatedMouse(Object.assign({ lastTap: tap, now: 207, x: 100, y: 200 }, o));
    check('the iPhone case: mousedown 75 ms after the pointerup at the same place is ignored', f({}) === true);
    check('799 ms after: ignored; 800 ms: not (the window is open at the start only)', f({ now: 132 + 799 }) === true && f({ now: 132 + 800 }) === false);
    check('24 px away: ignored; 24.1 px: not', f({ x: 124 }) === true && f({ x: 124.1 }) === false);
    check('the distance is Euclidean (17 + 17 px = 24.04 px is NOT within 24)', f({ x: 117, y: 217 }) === false && f({ x: 116, y: 216 }) === true);
    check('no previous tap: nothing is ignored', P.shouldIgnoreEmulatedMouse({ lastTap: null, now: 1, x: 1, y: 1 }) === false && P.shouldIgnoreEmulatedMouse({ now: 1, x: 1, y: 1 }) === false && P.shouldIgnoreEmulatedMouse() === false);
    check('a clock that went backwards (now before the tap) ignores nothing', f({ now: 100 }) === false);
    check('NaN or missing coordinates ignore nothing', f({ x: NaN }) === false && f({ y: undefined }) === false && P.shouldIgnoreEmulatedMouse({ lastTap: { x: 1, y: 1 }, now: 5, x: 1, y: 1 }) === false);
    // consume once
    let r = rig(); r.d.down({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 200 }); r.clock.t = 132; r.d.up({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 200 });
    r.clock.t = 207;
    const first = r.d.consumeEmulatedMouse(100, 200), second = r.d.consumeEmulatedMouse(100, 200);
    check('consumed once: the emulated mousedown is ignored, a second press at the same place right after is a real one', first === true && second === false, `${first},${second}`);
    // emulated mouse never arrives
    r = rig(); r.d.down({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 200 }); r.clock.t = 100; r.d.up({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 200 });
    r.clock.t = 1100;
    check('the emulated mouse never arrives: a real mouse press 1 s later at the same place is NOT swallowed', r.d.consumeEmulatedMouse(100, 200) === false);
    // a real second tap within 800 ms at another position
    const twoTaps = [ev(0, 'pointerdown', { id: 1 }), ev(100, 'pointerup', { id: 1 }), ev(300, 'pointerdown', { id: 2, x: 300, y: 400 }), ev(400, 'pointerup', { id: 2, x: 300, y: 400 }), ev(470, 'mousedown', { pt: 'mouse', x: 300, y: 400 })];
    const rt = replay(twoTaps);
    check('a real second tap 200 ms later at another position is a tap, and the mousedown after it is the emulated one of THAT tap', rt.taps.length === 2 && rt.presses.length === 2 && rt.ignoredMouse === 1, J(rt.presses));
    const wrongPlace = [ev(0, 'pointerdown'), ev(100, 'pointerup'), ev(150, 'mousedown', { pt: 'mouse', x: 400, y: 200 })];
    const rw = replay(wrongPlace);
    check('a mouse press 50 ms after a tap but 300 px away (hybrid laptop) is a real press', rw.presses.length === 2 && rw.presses[1].by === 'mouse' && rw.ignoredMouse === 0, J(rw.presses));
    const mouseOnly = [ev(0, 'pointerdown', { pt: 'mouse', id: 5 }), ev(10, 'pointerup', { pt: 'mouse', id: 5 }), ev(12, 'mousedown', { pt: 'mouse' })];
    const rm = replay(mouseOnly);
    check('a plain mouse click (pointer events with pointerType mouse) is one mouse press and no tap', rm.taps.length === 0 && rm.presses.length === 1 && rm.presses[0].by === 'mouse', J(rm.presses));
    // two-finger on the fixtures
    const pinch = [ev(0, 'pointerdown', { id: 1 }), ev(10, 'pointerdown', { id: 2, x: 220 }), ev(60, 'pointermove', { id: 1, x: 80 }), ev(100, 'pointerup', { id: 1 }), ev(105, 'pointerup', { id: 2, x: 220 })];
    check('fixture two-finger: no tap, no press', (() => { const q = replay(pinch); return q.taps.length === 0 && q.presses.length === 0; })());
    const longPress = [ev(0, 'pointerdown'), ev(700, 'pointerup')];
    check('fixture long press: no tap, no press', (() => { const q = replay(longPress); return q.taps.length === 0 && q.presses.length === 0; })());
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
