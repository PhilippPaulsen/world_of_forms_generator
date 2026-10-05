/*
 * Shared UI building blocks (UI rework 4b onward). UI only; no generator
 * state is read or written here.
 *
 *   UI.toast(text, ms)              a fixed-position, dismissible message (#ui-toast); it never moves the layout
 *   UI.setDisabled(el, reason)      "disabled, not hidden": aria-disabled (the control stays focusable and
 *                                   tappable); a tap, Enter/Space or a long press shows the reason as a toast,
 *                                   and the reason is the title (desktop hover). reason = null enables it again.
 *   UI.guard(el, onActivate)        runs onActivate on a click unless the control is aria-disabled (then: the reason)
 *   UI.stepper(root, opts)          number + stacked up/down chevrons around an existing number input (see below)
 *   UI.radiogroup(container, fn)    an exclusive choice: role="radio" options, aria-checked, arrow keys
 *   UI.overlay(trigger, panel)      a popover / bottom sheet ("More") opened by a button
 *   UI.pressed(el)                  keeps aria-pressed in step with the 'active' class (which the old handlers set)
 *
 * Toasts are dismissed by Escape, by a click on them, by the next tap anywhere, or after a few seconds.
 * Text is passed in by the caller (the dictionary comes in a later phase).
 */
(function () {
  const LONG_PRESS_MS = 500;

  // ---- toast -------------------------------------------------------------
  let toastTimer = null;
  function toastEl() { return document.getElementById('ui-toast'); }
  function hideToast() {
    const el = toastEl();
    if (el) el.hidden = true;
    clearTimeout(toastTimer);
  }
  function toast(text, ms) {
    const el = toastEl();
    if (!el || !text) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms || 4000);
  }
  // The next tap anywhere dismisses (capture phase: it runs before a control's own handler, which may show a new toast).
  document.addEventListener('pointerdown', function (e) {
    const t = toastEl();
    if (t && !t.hidden) hideToast();
    // the sketch's own notes (e.g. #node-count-note) are toasts too: dismiss them the same way
    document.querySelectorAll('.toast:not(#ui-toast):not([hidden])').forEach(function (n) { if (!n.contains(e.target)) n.hidden = true; });
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      hideToast();
      document.querySelectorAll('.toast:not([hidden])').forEach(function (n) { n.hidden = true; });
    }
  });
  document.addEventListener('click', function (e) {
    const n = e.target.closest && e.target.closest('.toast');
    if (n) n.hidden = true;
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
  function showReason(el) { toast(el.dataset.reason || '', 5000); }

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
   *   Hold a button: it repeats after 600 ms, faster after a while. Arrow keys on the input step too.
   *   refresh() re-reads compute() for both directions and updates the buttons; call it after any state change.
   */
  function stepper(root, opts) {
    const input = opts.input, buttons = Array.prototype.slice.call(root.querySelectorAll('.stepper-btn'));
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
      const r = opts.compute(dir);
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
        const r = opts.compute(parseInt(b.dataset.dir, 10));
        setDisabled(b, r.to === null || r.to === undefined ? r.reason : null);
      });
    }
    buttons.forEach(function (b) {
      const dir = parseInt(b.dataset.dir, 10);
      attachReason(b);
      let delay = null, repeat = null, count = 0;
      function stop() { clearTimeout(delay); clearInterval(repeat); delay = repeat = null; count = 0; }
      let downDisabled = false; // was the button disabled when the press began? (the step itself may disable it)
      b.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        downDisabled = isDisabled(b);
        if (downDisabled) return; // the click shows the reason
        step(dir);
        stop();
        delay = setTimeout(function () {
          repeat = setInterval(function () {
            count++;
            if (isDisabled(b) || !step(dir)) { stop(); return; }
            if (count === 12) { clearInterval(repeat); repeat = setInterval(function () { if (isDisabled(b) || !step(dir)) stop(); }, 70); }
          }, 150);
        }, 600);
      });
      ['pointerup', 'pointercancel', 'pointerleave', 'blur'].forEach(function (t) { b.addEventListener(t, stop); });
      // click: a mouse/touch click (event.detail >= 1) was already handled on pointerdown; a keyboard activation
      // (Enter/Space, or a scripted .click()) has detail 0 and steps here. Either way a disabled button shows its reason.
      b.addEventListener('click', function (e) {
        if (e.detail > 0) { if (downDisabled) showReason(b); return; }
        if (isDisabled(b)) { showReason(b); return; }
        step(dir);
      });
      b.style.touchAction = 'manipulation';
    });
    (opts.keyEl || input).addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    });
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
   */
  const SHEET_QUERY = '(max-width: 767px)';
  let openOverlay = null;
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
      api.isOpen = true; openOverlay = api;
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
      api.isOpen = false; if (openOverlay === api) openOverlay = null;
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) trigger.focus();
    }
    function toggle() { if (api.isOpen) close(true); else open(); }
    trigger.addEventListener('click', toggle);
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(true); return; }
      if (e.key !== 'Tab') return;
      const items = Array.prototype.slice.call(panel.querySelectorAll('button, [tabindex="0"]')).filter(function (n) { return n.tabIndex >= 0; });
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    if (scrim) scrim.addEventListener('click', function () { if (api.isOpen) close(false); });
    document.addEventListener('pointerdown', function (e) {
      if (api.isOpen && !panel.contains(e.target) && !trigger.contains(e.target) && e.target !== scrim) close(false);
    }, true);
    window.addEventListener('resize', function () { if (api.isOpen) close(false); });
    window.addEventListener('scroll', function () { if (api.isOpen && !window.matchMedia(SHEET_QUERY).matches) close(false); }, { passive: true });
    panel.hidden = true;
    if (!panel.hasAttribute('tabindex')) panel.tabIndex = -1;
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    return api;
  }

  // ---- one sync entry point -------------------------------------------------------
  // sketch.js calls window.uiSync() at the start of every draw() and after symmetry changes; each nav row registers
  // its own state-reading function here with UI.onSync(fn).
  const syncFns = [];
  window.uiSync = function () { for (let i = 0; i < syncFns.length; i++) syncFns[i](); };
  function onSync(fn) { syncFns.push(fn); }

  window.UI = { onSync: onSync, toast: toast, hideToast: hideToast, setDisabled: setDisabled, guard: guard, stepper: stepper, pressed: pressed, isDisabled: isDisabled, radiogroup: radiogroup, overlay: overlay, checkedFromActive: checkedFromActive, showReason: showReason };
})();
