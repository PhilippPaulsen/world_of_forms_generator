/*
 * Shared UI building blocks (UI rework 4b onward). UI only; no generator
 * state is read or written here.
 *
 *   UI.notify(text, opts)           the ONE notification component: a fixed-position message in the always-rendered live region #ui-notices (it never moves the
 *                                   layout). opts { key, kind: 'info' | 'warn' | 'error', ttl, sticky }. With a key a showing notice is updated in place; once it was
 *                                   dismissed or has expired the same key is NOT shown again until UI.notifyClear(key) (once per condition). At most two are visible
 *                                   (a third replaces the oldest); under the phone layout (html.ph) ONE (a new one replaces the showing one). The duration is clamp(3000 + 50 x length, 4000, 9000) ms unless ttl is given; the timer is
 *                                   stopped while the pointer is over a notice or the focus is inside it and restarts on leave. A text of 60 or more characters,
 *                                   or a sticky notice, has a close button; Escape closes the newest; a press outside notices closes the non-sticky ones. A notice that holds
 *                                   the focus and is closed by the person (its close button, Escape) gives the focus back to the element that had it before, else to the
 *                                   newest remaining notice's close button; an expiry never moves the focus, and a notice never takes it when it appears.
 *   UI.notifyClear(key)             the condition ended: closes that notice if it is showing and forgets the key (it may show again)
 *   UI.toast(text, ms)              a thin wrapper: UI.notify(text, { ttl: ms }); every older call site keeps working
 *   UI.t(key, params)               a string of the bilingual dictionary (ui-i18n.js) in the current language; UI.lang is 'de' or 'en' (?lang=en in the URL, nothing saved), UI.setLang(l) switches,
 *                                   UI.applyI18n(root) writes the dictionary strings into the elements that carry data-i18n / data-i18n-label / data-i18n-title
 *   UI.setDisabled(el, reason)      "disabled, not hidden": aria-disabled (the control stays focusable and
 *                                   tappable); a tap, Enter/Space or a long press shows the reason as a toast,
 *                                   and the reason is the title (desktop hover). reason = null enables it again.
 *   UI.guard(el, onActivate)        runs onActivate on a click unless the control is aria-disabled (then: the reason)
 *   UI.normalizeNumber(text)        a typed number as a string the existing parse (parseFloat) can read: trimmed; ONE comma and no dot becomes a dot (the German decimal pad types
 *                                   "0,35"); a dot stays; any other mix of separators ("1,2,3", "1.2,3", "1.234,5", "1.2.3") gives '' (invalid: the field falls back to its
 *                                   previous value, as for any text that is not a number); the minus and everything else stay. "1," -> "1." (parseFloat 1), ",5" -> ".5" (0.5).
 *   UI.stepper(root, opts)          number + stacked up/down chevrons around an existing number input (see below)
 *   UI.radiogroup(container, fn)    an exclusive choice: role="radio" options, aria-checked, arrow keys
 *   UI.overlay(trigger, panel)      a popover / bottom sheet ("More") opened by a button
 *   UI.dialog(overlay, trigger, closeBtn)  keyboard behaviour (focus in, Escape, Tab trap, focus back) for a dialog sketch.js opens
 *   UI.pressed(el)                  keeps aria-pressed in step with the 'active' class (which the old handlers set)
 *   UI.name(el, text)               a control's name: the title (the native tooltip) and the aria-label (the accessible name) with the same text. For
 *                                   a control with no visible text of its own (an icon, a glyph, an unlabelled field); a control with visible text is
 *                                   named by that text and keeps its title as a description, with no aria-label (WCAG 2.5.3)
 *
 * Text is passed in by the caller (the dictionary comes in a later phase).
 */

// ---- the notification model: PURE (no DOM), exported as window.noticeModel and tested in a vm without a document ------------------------------------
(function (root) {
  const TTL_BASE = 3000, TTL_PER_CHAR = 50, TTL_MIN = 4000, TTL_MAX = 9000, MAX_VISIBLE = 2, PHONE_MAX_VISIBLE = 1, CLOSE_AT = 60;
  const KINDS = ['info', 'warn', 'error'];
  // how long a notice stays: an explicit ttl wins; otherwise clamp(3000 + 50 x the text length, 4000, 9000)
  function noticeTtl(text, ttl) {
    if (typeof ttl === 'number' && ttl > 0) return ttl;
    return Math.min(TTL_MAX, Math.max(TTL_MIN, TTL_BASE + TTL_PER_CHAR * String(text == null ? '' : text).length));
  }
  // a long text or a sticky notice cannot be left to a timer alone: it gets a close button
  function noticeNeedsClose(text, sticky) { return !!sticky || String(text == null ? '' : text).length >= CLOSE_AT; }
  function noticeKind(kind) { return KINDS.indexOf(kind) >= 0 ? kind : 'info'; }
  // how many notices may show at once: two, and ONE under the phone layout (a new one replaces the showing one); the caller chooses at every call: matchMedia plus html.ph
  function noticeLimit(phone) { return phone ? PHONE_MAX_VISIBLE : MAX_VISIBLE; }
  // how many of the visible notices make room for one more (the oldest go first)
  function noticeEvictions(visible, max) { return Math.max(0, visible + 1 - (max || MAX_VISIBLE)); }
  // "once per condition": a keyed notice that is showing is UPDATED, one that was dismissed or expired is SKIPPED until clear(key), anything else is SHOWN; no key always shows
  function createKeyState() {
    const st = new Map();
    return {
      decide: function (key) { if (key === null || key === undefined) return 'show'; const s = st.get(key); return s === 'showing' ? 'update' : s === 'done' ? 'skip' : 'show'; },
      showing: function (key) { if (key !== null && key !== undefined) st.set(key, 'showing'); },
      gone: function (key) { if (key !== null && key !== undefined && st.get(key) === 'showing') st.set(key, 'done'); },
      clear: function (key) { st.delete(key); },
      state: function (key) { return st.get(key) || 'none'; },
    };
  }
  root.noticeModel = { noticeLimit: noticeLimit, PHONE_MAX_VISIBLE: PHONE_MAX_VISIBLE, noticeTtl: noticeTtl, noticeNeedsClose: noticeNeedsClose, noticeKind: noticeKind, noticeEvictions: noticeEvictions, createKeyState: createKeyState, MAX_VISIBLE: MAX_VISIBLE, CLOSE_AT: CLOSE_AT, TTL_MIN: TTL_MIN, TTL_MAX: TTL_MAX };
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
  if (typeof document === 'undefined') return;   // the model above is all a page without a document needs
  const LONG_PRESS_MS = 500;
  // the bilingual dictionary (ui-i18n.js, loaded before this file): a string of the dictionary in the current language, else the German text this file has always carried (a page without ui-i18n.js
  // behaves as before)
  const I18N = window.uiI18n || null;
  function tr(key, fallback) { return I18N && I18N.has(key) ? I18N.t(key) : fallback; }

  // ---- notifications ---------------------------------------------------------
  // The container #ui-notices is ALWAYS rendered (a live region that is toggled with `hidden` is announced unreliably): notices are inserted into it and removed from
  // it. The close button sits next to the text node, not inside it, so the announcement is the text alone. Nothing here moves the focus.
  const M = window.noticeModel;
  const NOTICE_TEXT = { 'notice.close': 'Hinweis schließen' };
  const NOTICE_X = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>';
  const keys = M.createKeyState();
  const notices = [];   // oldest first; { el, textEl, closeBtn, key, sticky, ttl, timer, hover, focus }
  function noticesEl() { return document.getElementById('ui-notices'); }
  // the phone layout: html.ph (set by ui-phone.js only, at 767px and below) AND the narrow media query; chosen at every call, so a resize or a tab change is followed
  function phoneNow() {
    const h = document.documentElement;
    return !!(h && h.classList && h.classList.contains('ph')) && (typeof window.matchMedia !== 'function' || window.matchMedia('(max-width: 767px)').matches);
  }
  function stopTimer(n) { if (n.timer !== null) { clearTimeout(n.timer); n.timer = null; } }
  function startTimer(n) {
    stopTimer(n);
    if (n.sticky || n.hover || n.focus) return;
    n.timer = setTimeout(function () { n.timer = null; removeNotice(n); }, M.noticeTtl(n.textEl.textContent, n.ttl));
  }
  // The last element that had the focus OUTSIDE #ui-notices: where the focus goes back to when a notice that holds it is closed by the person (a click, Enter or Space on its close button, Escape).
  let lastOutsideFocus = null;
  document.addEventListener('focusin', function (e) {
    const host = noticesEl();
    if (e.target && !(host && host.contains(e.target))) lastOutsideFocus = e.target;
  }, true);
  function focusableAgain(el) { return !!el && el.isConnected !== false && !el.disabled && !el.hidden && typeof el.focus === 'function'; }
  // back to the recorded element if it is still connected and focusable; else the close button of the newest notice that is left; else nowhere (the focus stays where the browser put it)
  function returnFocus() {
    const t = lastOutsideFocus;
    if (focusableAgain(t)) { t.focus(); if (document.activeElement === t) return; }
    const left = notices[notices.length - 1];
    if (left && left.closeBtn && typeof left.closeBtn.focus === 'function') left.closeBtn.focus();
  }
  // byPerson: closed by a click / Enter / Space on the close button or by Escape. Only then, and only when the notice held the focus, does the focus move back; an expiry, the cap, a press outside
  // and notifyClear never move it.
  function removeNotice(n, byPerson) {
    const at = notices.indexOf(n);
    if (at < 0) return;
    const hadFocus = !!byPerson && !!document.activeElement && n.el.contains(document.activeElement);
    notices.splice(at, 1);
    stopTimer(n);
    if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
    keys.gone(n.key);   // a keyed notice that leaves (closed, expired, replaced) is not shown again until notifyClear(key)
    if (hadFocus) returnFocus();
  }
  function syncClose(n) {
    const need = M.noticeNeedsClose(n.textEl.textContent, n.sticky);
    if (need && !n.closeBtn) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'icon-btn notice-close';
      b.setAttribute('data-i18n', 'notice.close');
      b.innerHTML = NOTICE_X;
      name(b, tr('notice.close', NOTICE_TEXT['notice.close']));
      b.addEventListener('click', function () { removeNotice(n, true); });
      n.el.appendChild(b);
      n.closeBtn = b;
    } else if (!need && n.closeBtn) {
      n.el.removeChild(n.closeBtn);
      n.closeBtn = null;
    }
  }
  function buildNotice() {
    const el = document.createElement('div'), textEl = document.createElement('span');
    textEl.className = 'notice-text';
    el.appendChild(textEl);
    const n = { el: el, textEl: textEl, closeBtn: null, key: null, sticky: false, ttl: undefined, timer: null, hover: false, focus: false };
    // the timer stops while the pointer is over the notice or the focus is inside it, and restarts (the full duration) when both have left
    el.addEventListener('pointerenter', function () { n.hover = true; stopTimer(n); });
    el.addEventListener('pointerleave', function () { n.hover = false; startTimer(n); });
    el.addEventListener('focusin', function () { n.focus = true; stopTimer(n); });
    el.addEventListener('focusout', function (e) { if (e.relatedTarget && el.contains(e.relatedTarget)) return; n.focus = false; startTimer(n); });
    return n;
  }
  function notify(text, opts) {
    opts = opts || {};
    const host = noticesEl();
    if (!host || !text) return null;
    const key = opts.key === undefined ? null : opts.key;
    const verdict = keys.decide(key);
    if (verdict === 'skip') return null;
    let n = null;
    if (verdict === 'update') for (let i = 0; i < notices.length; i++) if (notices[i].key === key) n = notices[i];
    if (!n) {
      for (let k = M.noticeEvictions(notices.length, M.noticeLimit(phoneNow())); k > 0; k--) removeNotice(notices[0]);   // at most two (one under the phone layout): the oldest make room
      n = buildNotice();
      n.key = key;
      host.appendChild(n.el);
      notices.push(n);
      keys.showing(key);
    }
    const kind = M.noticeKind(opts.kind);
    n.el.className = 'notice notice-' + kind;
    n.textEl.textContent = String(text);
    n.el.setAttribute('title', String(text));   // the text is clamped to three lines: the full text is the title
    n.sticky = !!opts.sticky;
    n.ttl = opts.ttl;
    syncClose(n);
    startTimer(n);   // new or updated in place: the timer starts again
    return n.el;
  }
  function notifyClear(key) {
    for (let i = 0; i < notices.length; i++) if (notices[i].key === key) { removeNotice(notices[i]); break; }
    keys.clear(key);
  }
  // a thin wrapper: every older call site (disabled-control reasons, stepper limits, the net notes, the Farborgel errors, the diamond refusal) keeps its signature
  function toast(text, ms) { return notify(text, { ttl: ms }); }
  function hideToast() { notices.slice().forEach(function (n) { if (!n.sticky) removeNotice(n); }); }
  // a press outside every notice closes the non-sticky ones (capture phase: it runs before a control's own handler, which may show a new one); a press INSIDE one does not
  document.addEventListener('pointerdown', function (e) {
    if (notices.length && !(e.target && e.target.closest && e.target.closest('.notice'))) hideToast();
  }, true);
  // A press on a notice must not reach the sketch: p5 listens for a mousedown on the WINDOW and sketch.js's mousePressed() acts on the pointer position, so a notice over the canvas (the phone layout anchors
  // it there) would draw or select a node under the finger (measured: with free endpoints on, a tap on a notice added a node). The listener is on the document in the bubble phase: it runs before the
  // window's and stops the event there; the notice's own controls (its close button: a click) are not affected, and nothing in the capture phase is.
  document.addEventListener('mousedown', function (e) {
    if (e.target && e.target.closest && e.target.closest('.notice')) e.stopPropagation();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (notices.length) removeNotice(notices[notices.length - 1], true);   // the newest
    }
  });

  // ---- disabled with a reason --------------------------------------------
  function setDisabled(el, reason) {
    if (!el) return;
    if (reason) {
      if (el.getAttribute('aria-disabled') !== 'true') el.setAttribute('aria-disabled', 'true');
      if (el.dataset.reason !== reason) el.dataset.reason = reason;
      if (el.dataset.baseTitle === undefined) el.dataset.baseTitle = el.getAttribute('title') || '';
      if (el.getAttribute('title') !== reason) el.setAttribute('title', reason);
    } else if (el.getAttribute('aria-disabled') === 'true') {
      el.removeAttribute('aria-disabled');
      delete el.dataset.reason;
      if (el.dataset.baseTitle !== undefined) { el.setAttribute('title', el.dataset.baseTitle); delete el.dataset.baseTitle; }
    }
  }
  function isDisabled(el) { return el.getAttribute('aria-disabled') === 'true'; }

  // ---- a typed number (decimal comma) --------------------------------------
  // The German iOS decimal pad types a comma. Only the separators are looked at: the text is not validated further (parseFloat reads "0.35abc" as 0.35 as it always did).
  function normalizeNumber(text) {
    const s = String(text === null || text === undefined ? '' : text).trim();
    const seps = s.match(/[.,]/g) || [];
    if (seps.length > 1) return '';                  // two separators: a thousands separator or a typo
    return seps.length === 1 && seps[0] === ',' ? s.replace(',', '.') : s;
  }

  // ---- a control's name ----------------------------------------------------
  // setDisabled swaps the title for the reason and keeps the name in dataset.baseTitle; a name set while a reason is showing goes there, so the reason stays on
  // hover and the new name comes back when the control is enabled. The aria-label is never touched by setDisabled: the name outlives every disable / enable.
  function name(el, text) {
    if (!el) return;
    if (el.dataset && el.dataset.baseTitle !== undefined) el.dataset.baseTitle = text;
    else if (el.getAttribute('title') !== text) el.setAttribute('title', text);
    if (el.getAttribute('aria-label') !== text) el.setAttribute('aria-label', text);
  }
  function showReason(el, from) { toast(el.dataset.reason || (from && from.dataset.reason) || '', 5000); }   // from: the element whose reason stands in when el has none yet (a stepper's root)

  function attachReason(el) {
    if (el.dataset.reasonBound) return;
    el.dataset.reasonBound = '1';
    let timer = null;
    el.addEventListener('pointerdown', function () {
      if (!isDisabled(el)) return;
      clearTimeout(timer);
      timer = setTimeout(function () { showReason(el); }, LONG_PRESS_MS); // long press (touch): the reason; a short tap shows it on click
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { el.addEventListener(t, function () { clearTimeout(timer); }); });
  }

  function guard(el, onActivate) {
    attachReason(el);
    el.addEventListener('click', function (e) {
      if (isDisabled(el)) { e.preventDefault(); showReason(el); return; }
      onActivate(e);
    });
  }

  // ---- stepper -----------------------------------------------------------
  /*
   * UI.stepper(root, { input, compute, onStep })
   *   root     the .stepper element holding the two chevron .stepper-btn (data-dir +1 up / -1 down) and the input
   *   input    the EXISTING number input (id, min/max and its handlers stay); the stepper only sets its value and
   *            dispatches 'input' and 'change', so sketch.js reacts exactly as it did to typing. The field stays
   *            typable (inputmode="none": no keyboard on touch).
   *   compute(dir) -> { to: number, note?: string }  the next value, or
   *                   { to: null, reason: string }   blocked: that button is aria-disabled with the reason
   *   range() -> { min, max, minMsg, maxMsg }  the valid range for TYPED values: an out-of-range number is clamped
   *            and a toast says why; an emptied field is restored on blur
   *   noTyping  true when `input` is only a state carrier (a hidden range input, value = percent): no typed-value
   *            handling. keyEl  the element that takes ArrowUp/Down (default: the input; a focusable spinbutton
   *            display otherwise)
   *   Hold a button: it repeats after 600 ms (every 150 ms, every 70 ms after 1.8 s of repeating - see holdRepeat). Arrow keys on the input step too.
   *   refresh() re-reads compute() for both directions and updates the buttons; call it after any state change.
   *   A stepper whose ROOT is aria-disabled (UI.setDisabled(root, reason); the phone layout does it for a stepper whose block is hidden) does nothing: compute() is not asked, a step is refused with the
   *   root's reason (a toast, no change), the chevrons are disabled with it, and a typed value is put back.
   */
  // Hold-to-repeat of a stepper chevron (Phase 2, track A, commit C). A SELF-RESCHEDULING timeout, not a setInterval: a setInterval keeps firing while the step
  // (the handler: setValue -> input/change events -> sketch.js rebuilds the grid and redraw()s, all synchronous) takes longer than the interval, and the queued
  // callbacks stack up and keep stepping after the finger is lifted. Here the next step is scheduled only after the previous one has FINISHED: it is due at the
  // nominal time (the same 600 ms start delay, then every 150 ms, every 70 ms once 1800 ms of repeating have passed - by elapsed time, not by step count), but never
  // earlier than 16 ms after the previous step ended, i.e. the gap is max(interval, cost of the last step + 16 ms). On a device that keeps up the step times are
  // those of the old setInterval; on one that does not, steps are skipped (never added). stop() invalidates a generation token, so a timer callback that is
  // already queued or running when the release arrives (or a step that itself ends the hold) cannot step or reschedule. step() returns false to end the hold.
  const HOLD_START_MS = 600, HOLD_SLOW_MS = 150, HOLD_FAST_MS = 70, HOLD_FAST_AFTER_MS = 1800, HOLD_PAUSE_MS = 16;
  function holdRepeat(stepFn) {
    let timer = null, gen = 0, lastCost = 0;
    function stop() { gen++; if (timer !== null) { clearTimeout(timer); timer = null; } }
    function start() {
      stop();
      const mine = gen, t0 = performance.now() + HOLD_START_MS;
      let due = t0;
      function schedule(at) { due = at; timer = setTimeout(tick, Math.max(0, at - performance.now())); }
      function tick() {
        timer = null;
        if (mine !== gen) return;                        // released: a callback that was already queued does nothing
        const began = performance.now();
        const go = stepFn();
        const end = performance.now();
        lastCost = end - began;
        if (mine !== gen) return;                        // released during the step
        if (!go) { stop(); return; }
        const interval = (due - t0) >= HOLD_FAST_AFTER_MS ? HOLD_FAST_MS : HOLD_SLOW_MS;
        schedule(Math.max(due + interval, end + HOLD_PAUSE_MS));
      }
      schedule(t0 + HOLD_SLOW_MS);                       // 600 ms after the press, plus the first 150 ms interval: the first repeat is at 750 ms
    }
    return { start: start, stop: stop, cost: function () { return lastCost; } };
  }

  function stepper(root, opts) {
    const input = opts.input, buttons = Array.prototype.slice.call(root.querySelectorAll('.stepper-btn'));
    const compute = function (dir) { return isDisabled(root) ? { to: null, reason: root.dataset.reason || '' } : opts.compute(dir); };
    let last = parseInt(input.value, 10); // the last valid value, for restoring an emptied field
    function setValue(v) {
      input.value = String(v);
      last = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // The field stays typable (inputmode="none": no keyboard on touch). This listener is registered before
    // sketch.js's own (ui-form.js runs before setup()), so it sees the event first: an emptied/NaN field is
    // mid-typing and never reaches the sketch; an out-of-range number is clamped, with a toast, BEFORE the sketch
    // reads it.
    if (!opts.noTyping) {
      input.addEventListener('input', function (e) {
        if (isDisabled(root)) { input.value = String(last); e.stopImmediatePropagation(); return; }
        const v = parseInt(input.value, 10);
        if (input.value === '' || isNaN(v)) { e.stopImmediatePropagation(); return; }
        const rg = opts.range ? opts.range() : null;
        if (rg && (v < rg.min || v > rg.max)) {
          const c = v < rg.min ? rg.min : rg.max;
          input.value = String(c);
          toast(v < rg.min ? rg.minMsg : rg.maxMsg, 4000);
        }
        last = parseInt(input.value, 10);
      });
      const normalise = function () {
        const v = parseInt(input.value, 10);
        if (isNaN(v)) { if (!isNaN(last)) input.value = String(last); }
        else if (String(v) !== input.value) input.value = String(v); // "3.5" -> "3"
      };
      input.addEventListener('change', normalise);
      input.addEventListener('blur', normalise);
    }
    function step(dir) {
      const r = compute(dir);
      if (r.to === null || r.to === undefined) { toast(r.reason, 4000); return false; }
      setValue(r.to);
      if (r.note) toast(r.note, 4000);
      refresh();
      return true;
    }
    function refresh() {
      const cur = parseInt(input.value, 10);
      if (!isNaN(cur) && document.activeElement !== input) last = cur; // follows programmatic changes (catalog, shape switch)
      buttons.forEach(function (b) {
        const r = compute(parseInt(b.dataset.dir, 10));
        setDisabled(b, r.to === null || r.to === undefined ? r.reason : null);
      });
    }
    const holds = [];
    buttons.forEach(function (b) {
      const dir = parseInt(b.dataset.dir, 10);
      attachReason(b);
      const hold = holdRepeat(function () { return !isDisabled(b) && step(dir); });
      holds.push(hold);
      const stop = hold.stop;
      let downDisabled = false; // was the button disabled when the press began? (the step itself may disable it)
      b.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        downDisabled = isDisabled(b) || isDisabled(root);
        if (downDisabled) return; // the click shows the reason
        step(dir);
        hold.start();
      });
      // every way a hold can end: finger / button up, the gesture taken over (scroll, a system gesture), the pointer leaving, focus lost, a long-press context menu
      ['pointerup', 'pointercancel', 'pointerleave', 'blur', 'contextmenu'].forEach(function (t) { b.addEventListener(t, stop); });
      // click: a mouse/touch click (event.detail >= 1) was already handled on pointerdown; a keyboard activation
      // (Enter/Space, or a scripted .click()) has detail 0 and steps here. Either way a disabled button shows its reason.
      b.addEventListener('click', function (e) {
        if (e.detail > 0) { if (downDisabled) showReason(b, root); return; }
        if (isDisabled(b) || isDisabled(root)) { showReason(b, root); return; }
        step(dir);
      });
      b.style.touchAction = 'manipulation';
    });
    // the page goes to the background (tab switch, app switch, lock screen) while a chevron is held: no pointerup may ever arrive
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') holds.forEach(function (h) { h.stop(); }); });
    (opts.keyEl || input).addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    });
    // a root that is (un)disabled from outside (the phone layout, in the middle of a UI tick that already refreshed this stepper) brings the chevrons up to date at once, not on the next redraw
    if (typeof MutationObserver === 'function') new MutationObserver(function () { refresh(); }).observe(root, { attributes: true, attributeFilter: ['aria-disabled'] });
    return { refresh: refresh, step: step };
  }

  // ---- aria-pressed follows the 'active' class ------------------------------
  function pressed(el) {
    function sync() {
      const on = el.classList.contains('active') ? 'true' : 'false';
      if (el.getAttribute('aria-pressed') !== on) el.setAttribute('aria-pressed', on);
    }
    sync();
    new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  // ---- aria-checked follows the 'active' class (radios whose state sketch.js owns) -------
  function checkedFromActive(el) {
    function sync() {
      const on = el.classList.contains('active') ? 'true' : 'false';
      if (el.getAttribute('aria-checked') !== on) el.setAttribute('aria-checked', on);
      const tab = on === 'true' ? 0 : -1;
      if (el.tabIndex !== tab) el.tabIndex = tab;
    }
    sync();
    new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  // ---- keyboard activation of buttons that sketch.js binds with p5's mousePressed() ------
  /*
   * p5's element.mousePressed(fn) listens for 'mousedown' only. Enter/Space on a focused button fires only 'click'
   * (event.detail === 0), so such a button did nothing from the keyboard. This bridge turns a keyboard-activated click
   * on ANY <button> into a 'mousedown' on it, which the p5 handler then receives. It used to cover four containers
   * (header, nav rows, overlays, canvas rail) and missed the rest: the layers/timeline/cross-layer area, the layer
   * groups, the Help and Download dialogs (open by keyboard, not operable by it) - so the rule is now the element, not
   * a list of places. Buttons with plain click handlers (ui.js's own, the layer tabs, the pairing editor) have no
   * mousedown listener, so the extra event is harmless there.
   *
   * No double firing: a mouse/pen/touch activation starts with a real pointerdown/mousedown on the button, so the
   * click that ends it is NOT bridged. That is decided per button, not by event.detail alone (a browser that reports
   * detail 0 for a tap would otherwise fire twice): the button is remembered at pointerdown/mousedown and forgotten
   * at its next click - or at the next key press anywhere, so a press that was dragged off the button (no click)
   * cannot swallow a later Enter/Space. The bridge's own synthetic mousedown is not remembered.
   *
   * The synthetic event has clientX/clientY 0, so p5 sees the pointer outside the canvas and sketch.js's global
   * mousePressed() (which only acts inside the canvas) ignores it - a button press never lands on a node.
   */
  const downButtons = new Set();
  let bridging = false;
  function noteDown(e) {
    if (bridging) return;
    const b = e.target.closest && e.target.closest('button');
    if (b) downButtons.add(b);
  }
  document.addEventListener('pointerdown', noteDown, true);
  document.addEventListener('mousedown', noteDown, true);
  document.addEventListener('keydown', function () { downButtons.clear(); }, true);
  document.addEventListener('click', function (e) {
    const b = e.target.closest && e.target.closest('button');
    if (!b) return;
    const hadPointerDown = downButtons.delete(b);
    if (e.detail !== 0 || hadPointerDown) return;
    if (b.disabled || b.getAttribute('aria-disabled') === 'true') return;
    bridging = true;
    try { b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })); }
    finally { bridging = false; }
  }, true);

  // ---- radio group ------------------------------------------------------------
  /*
   * UI.radiogroup(container, onSelect) - an exclusive choice: role="radiogroup" with role="radio" children, aria-checked,
   * roving tabindex, arrow keys move AND select (like native radios). set(el) marks one option checked (or none: null;
   * then the first is the tab stop). A checked option also gets the 'active' class (black fill).
   */
  function radiogroup(container, onSelect) {
    const radios = Array.prototype.slice.call(container.querySelectorAll('[role="radio"]'));
    function set(checked) {
      radios.forEach(function (r, i) {
        const on = r === checked;
        if (r.getAttribute('aria-checked') !== (on ? 'true' : 'false')) r.setAttribute('aria-checked', on ? 'true' : 'false');
        if (r.classList.contains('active') !== on) r.classList.toggle('active', on);
        const tab = (checked ? on : i === 0) ? 0 : -1;
        if (r.tabIndex !== tab) r.tabIndex = tab;
      });
    }
    radios.forEach(function (r, i) {
      attachReason(r);
      r.addEventListener('click', function () { if (isDisabled(r)) { showReason(r); return; } onSelect(r); });
      r.addEventListener('keydown', function (e) {
        let j = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % radios.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + radios.length) % radios.length;
        if (j < 0) return;
        e.preventDefault();
        for (let k = 0; k < radios.length && isDisabled(radios[j]); k++) j = (j + (j > i ? 1 : -1) + radios.length) % radios.length;
        if (isDisabled(radios[j])) return;
        radios[j].focus();
        onSelect(radios[j]);
      });
    });
    return { set: set, radios: radios };
  }

  // ---- overlay ("More") ---------------------------------------------------------
  /*
   * UI.overlay(trigger, panel, opts) - a dialog opened by `trigger`: a popover under it on wide screens, a bottom sheet
   * (with a scrim) on the phone (< 768px). One at a time. Escape, a tap outside, the trigger again, scrolling or
   * resizing closes it; focus moves in on open and back to the trigger on Escape/close. opts.onOpen() runs first,
   * so the content can be synced before it shows.
   * opts.onClose(returnFocus) runs after EVERY close (Escape, the scrim, a tap outside, a resize, close()), so an owner of the state behind the
   * panel can follow it. opts.toggleOnClick === false: the trigger's click is NOT bound here (the owner opens and closes the panel itself - the
   * phone layout's sheets follow a state some other handler of the same button flips). A resize does not close the panel while a text field inside
   * it has the focus: the soft keyboard of a phone resizes the window, and closing the sheet then would throw away what the person is typing in.
   * A tap inside a modal dialog (aria-modal="true", made by UI.dialog) does not count as a tap outside: a dialog opened from the panel leaves it open. The same for a tap on a notice (.notice).
   * A 'tabchange' (nav.js) closes the open overlay (the Back button and a hash edit change the tab without a tap).
   */
  const SHEET_QUERY = '(max-width: 767px)';
  let openOverlay = null;
  // html.overlay-open while an overlay (a "More" sheet, the info card) is open: the phone layout anchors the notices under the header then (style.css), because a bottom sheet covers the canvas's lower half
  // and the notice would lie over the very field being edited. One overlay is open at a time (openOverlay), so a flag is enough; it is only a class: nothing outside the phone layout reads it.
  function markOverlayOpen(on) {
    const cl = document.documentElement && document.documentElement.classList;
    if (cl && typeof cl[on ? 'add' : 'remove'] === 'function') cl[on ? 'add' : 'remove']('overlay-open');
  }
  function overlay(trigger, panel, opts) {
    const scrim = document.getElementById('overlay-scrim');
    const api = { isOpen: false, open: open, close: close, toggle: toggle };
    function place() {
      if (window.matchMedia(SHEET_QUERY).matches) {
        panel.classList.add('sheet'); panel.style.top = ''; panel.style.left = '';
        if (scrim) scrim.hidden = false;
      } else {
        panel.classList.remove('sheet');
        if (scrim) scrim.hidden = true;
        const r = trigger.getBoundingClientRect();
        panel.style.top = Math.round(r.bottom + 8) + 'px';
        const w = panel.offsetWidth;
        panel.style.left = Math.max(8, Math.min(Math.round(r.left), window.innerWidth - w - 8)) + 'px';
      }
    }
    function open() {
      if (api.isOpen) return;
      if (openOverlay && openOverlay !== api) openOverlay.close();
      if (opts && opts.onOpen) opts.onOpen();
      panel.hidden = false;
      api.isOpen = true; openOverlay = api; markOverlayOpen(true);
      trigger.setAttribute('aria-expanded', 'true');
      place();
      // querySelector alone would also match a button inside a `hidden` ancestor (e.g. #more-farbe's Spread
      // button, normally hidden inside #face-colors-unassigned, sits before the always-visible Reset button in
      // the DOM): .focus() silently no-ops on such an element, so focus never actually enters the panel and
      // Escape (which needs a focused descendant to bubble the keydown up to the panel) then does nothing.
      // offsetParent is null for a `display:none` element AND for any element with a `hidden` ancestor, but not
      // for a merely off-screen-but-laid-out one, so this excludes exactly the elements .focus() would ignore.
      const candidates = panel.querySelectorAll('[tabindex="0"], button:not([disabled])');
      const first = Array.prototype.find.call(candidates, function (el) { return el.offsetParent !== null; });
      // A content-sparse panel (e.g. #info-card: a status text with nothing focusable in it) has no candidate
      // here, so focus would otherwise stay on `trigger` - outside the panel - and a real Escape keypress then
      // never reaches the panel's own keydown listener below (it only catches events bubbling from a focused
      // descendant). Falling back to the panel itself (made programmatically focusable via tabindex="-1", set
      // once below - not tab-reachable, so it does not add a stop to normal Tab order) keeps Escape working for
      // any overlay, regardless of what it contains.
      if (first) first.focus(); else panel.focus();
    }
    function close(returnFocus) {
      if (!api.isOpen) return;
      panel.hidden = true;
      if (scrim) scrim.hidden = true;
      api.isOpen = false; if (openOverlay === api) { openOverlay = null; markOverlayOpen(false); }
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) trigger.focus();
      if (opts && opts.onClose) opts.onClose(!!returnFocus);
    }
    function toggle() { if (api.isOpen) close(true); else open(); }
    if (!opts || opts.toggleOnClick !== false) trigger.addEventListener('click', toggle);
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(true); return; }
      if (e.key !== 'Tab') return;
      // every control the Tab key can reach: a number field after the last button used to fall outside the loop (Tab skipped it), and a hidden button as the "last" one broke the wrap
      const items = Array.prototype.slice.call(panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')).filter(function (n) { return n.tabIndex >= 0 && n.offsetParent !== null; });
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    if (scrim) scrim.addEventListener('click', function () { if (api.isOpen) close(false); });
    document.addEventListener('pointerdown', function (e) {
      // a confirmation dialog (UI.dialog: aria-modal) opened from this panel lies outside it: a tap on its buttons or its backdrop is not "outside" - the panel stays, and the dialog's own focus return finds its opener
      // a notice (UI.notify) lies outside the panel too, and over it under the phone layout (z-index 60 against 40): a tap on its close button or its text is not "outside" either - it dismisses the notice, the panel stays
      if (api.isOpen && !panel.contains(e.target) && !trigger.contains(e.target) && e.target !== scrim && !(e.target && e.target.closest && e.target.closest('[aria-modal="true"], .notice'))) close(false);
    }, true);
    const typing = function () { const a = document.activeElement; return !!a && panel.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName || '') && !/^(button|checkbox|radio|range|submit|reset)$/.test(a.type || ''); };
    window.addEventListener('resize', function () { if (api.isOpen && !typing()) close(false); });
    window.addEventListener('scroll', function () { if (api.isOpen && !window.matchMedia(SHEET_QUERY).matches) close(false); }, { passive: true });
    panel.hidden = true;
    if (!panel.hasAttribute('tabindex')) panel.tabIndex = -1;
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    return api;
  }

  // A tab change (nav.js's 'tabchange': the header tab, the Back button, a hash edit) closes the open overlay: its trigger may be about to move or hide, and an overlay left open would keep its scrim and its
  // sheet over the next tab. A tap on a header tab already closes it (an outside tap); this covers the ways that do not tap.
  document.addEventListener('tabchange', function () { if (openOverlay) openOverlay.close(false); });

  // ---- modal dialog whose open/close logic lives elsewhere (Help, Download) ---------------------
  /*
   * UI.dialog(overlayEl, trigger, closeBtn) - keyboard behaviour for a dialog that sketch.js opens and closes by toggling
   * the 'hidden' class on `overlayEl` (UI.overlay() cannot be used: it owns the open/close itself). Same contract as
   * UI.overlay(): focus moves into the dialog when it opens, Escape closes it and focus goes back to `trigger`, Tab
   * stays inside. A MutationObserver on the class turns "hidden removed / added" into those focus moves, so sketch.js
   * is untouched; Escape is a click on `closeBtn`, i.e. the dialog closes through its own handler (the keyboard bridge
   * above turns that click into the mousedown p5 listens for).
   * The backdrop click that also closes these dialogs has NO keyboard equivalent, on purpose: Escape and the Close
   * button are the keyboard way out.
   */
  function dialog(overlayEl, trigger, closeBtn) {
    if (!overlayEl || !trigger || !closeBtn) return null;
    const content = overlayEl.querySelector('.dialog-content') || overlayEl;
    const heading = content.querySelector('strong');
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');
    if (heading) overlayEl.setAttribute('aria-label', heading.textContent.replace(/[:\u2026]+$/, '').trim());
    if (!content.hasAttribute('tabindex')) content.tabIndex = -1;
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    let wasOpen = !overlayEl.classList.contains('hidden');
    function items() {
      return Array.prototype.slice.call(overlayEl.querySelectorAll('button:not([disabled]), [tabindex="0"]')).filter(function (n) { return n.offsetParent !== null; });
    }
    new MutationObserver(function () {
      const open = !overlayEl.classList.contains('hidden');
      if (open === wasOpen) return;
      wasOpen = open;
      trigger.setAttribute('aria-expanded', String(open));
      if (open) { (items()[0] || content).focus(); }
      else if (overlayEl.contains(document.activeElement) || document.activeElement === document.body) trigger.focus();
    }).observe(overlayEl, { attributes: true, attributeFilter: ['class'] });
    overlayEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeBtn.click(); return; }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !overlayEl.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !overlayEl.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    });
    return { isOpen: function () { return wasOpen; } };
  }

  // ---- one sync entry point -------------------------------------------------------
  // sketch.js calls window.uiSync() at the start of every draw() and after symmetry changes; each nav row registers
  // its own state-reading function here with UI.onSync(fn).
  const syncFns = [];
  window.uiSync = function () { for (let i = 0; i < syncFns.length; i++) syncFns[i](); };
  function onSync(fn) { syncFns.push(fn); }

  window.UI = { normalizeNumber: normalizeNumber, onSync: onSync, notify: notify, notifyClear: notifyClear, toast: toast, hideToast: hideToast, setDisabled: setDisabled, name: name, guard: guard, stepper: stepper, pressed: pressed, isDisabled: isDisabled, dialog: dialog, radiogroup: radiogroup, overlay: overlay, checkedFromActive: checkedFromActive, showReason: showReason };
  // the dictionary on UI: UI.t(key, params), UI.lang (the current language: 'de' or 'en'), UI.setLang(l), UI.applyI18n(root); without ui-i18n.js t returns the key
  window.UI.t = I18N ? I18N.t : function (key) { return String(key); };
  window.UI.setLang = I18N ? I18N.setLang : function () { return 'de'; };
  window.UI.applyI18n = I18N ? I18N.applyI18n : function () { return 0; };
  Object.defineProperty(window.UI, 'lang', { enumerable: true, get: function () { return I18N ? I18N.lang : 'de'; } });
})();
