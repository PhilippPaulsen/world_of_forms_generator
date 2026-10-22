(function () {
  const $ = function (s) { return document.querySelector(s); };
  const moreRail = UI.overlay($('#btn-more-rail'), $('#more-rail'), {});
  UI.overlay($('#btn-info'), $('#info-card'), {});
  // Help (header) and Download (rail) open modal dialogs that sketch.js shows and hides; this adds their keyboard behaviour.
  UI.dialog($('#help-overlay'), $('#btn-help'), $('#close-help'));
  UI.dialog($('#export-overlay'), $('#btn-save'), $('#close-export'));
  // "Neu anfangen" (Mehr): a confirmation first. Cancel is the first control, so it has the initial focus; Escape cancels (UI.dialog); confirming
  // runs window.sessionRestart() (sketch.js: stop the autosave writer, remove the saved session, load the page without URL parameters).
  const restartOverlay = $('#restart-overlay'), restartBtn = $('#btn-restart'), cancelRestart = $('#cancel-restart'), confirmRestart = $('#confirm-restart');
  if (restartOverlay && restartBtn && cancelRestart && confirmRestart) {
    UI.dialog(restartOverlay, restartBtn, cancelRestart);
    restartBtn.addEventListener('click', function () {
      if (moreRail && moreRail.isOpen) moreRail.close(false);   // the popover goes; the dialog takes over
      restartOverlay.classList.remove('hidden');
    });
    cancelRestart.addEventListener('click', function () {
      restartOverlay.classList.add('hidden');
      const more = $('#btn-more-rail'); if (more && more.offsetParent !== null) more.focus();   // the trigger inside the closed popover cannot take the focus back
    });
    confirmRestart.addEventListener('click', function () {
      if (typeof window.sessionRestart === 'function') window.sessionRestart(); else restartOverlay.classList.add('hidden');
    });
  }
  // ---- aria-pressed on the rail's toggles ------------------------------------------------------------------------------------------------------------------------------------
  // Nodes, Fill, Curve, Free, Free Endpoints and Alternative Net are toggles whose state sketch.js (its handlers, and the session restore) keeps only as the class 'active'. This
  // mirrors that class into aria-pressed on every UI.onSync tick (draw() calls it), so a screen reader hears the state; it writes an attribute only when the value changed and it
  // does not read the 'disabled' state (Curve and Free stay pressed or not while a net transform disables them). Not toggles, so without aria-pressed: Undo, Redo, Random, Clear,
  // Download, Paste Pattern, "Neu anfangen" (actions), Info and Mehr (they open something: aria-expanded), the two catalog links.
  const TOGGLES = ['btn-toggle-nodes', 'btn-toggle-curve', 'btn-toggle-faces', 'btn-toggle-free', 'btn-toggle-free-endpoints', 'btn-alternative-net'].map(function (id) { return document.getElementById(id); }).filter(Boolean);
  // Curve, Free and Fill are locked while a net transform is active (sketch.js: UI.setDisabled, aria-disabled, focusable). A tap, a click or a long press on a locked one shows the reason as a notice;
  // an unlocked one is not touched here (sketch.js's own handler toggles it).
  ['btn-toggle-curve', 'btn-toggle-free', 'btn-toggle-faces'].forEach(function (id) { const b = document.getElementById(id); if (b) UI.guard(b, function () { }); });
  const IN_MORE = ['btn-toggle-curve', 'btn-toggle-free', 'btn-toggle-free-endpoints', 'btn-alternative-net'].map(function (id) { return document.getElementById(id); }).filter(Boolean);
  function syncPressed() {
    TOGGLES.forEach(function (b) {
      const v = b.classList.contains('active') ? 'true' : 'false';
      if (b.getAttribute('aria-pressed') !== v) b.setAttribute('aria-pressed', v);
    });
  }
  // The state dot on Mehr (.nav-more.has-state::after): one of the four toggles inside it is on. sketch.js sets the classes while the popover is closed too (a restore), so the dot is right
  // without ever opening it; Fill and Curve exclude each other there (it turns the other off), and the dot follows the class.
  const moreBtn = $('#btn-more-rail');
  function syncDot() {
    if (!moreBtn) return;
    const on = IN_MORE.some(function (b) { return b.classList.contains('active'); });
    if (moreBtn.classList.contains('has-state') !== on) moreBtn.classList.toggle('has-state', on);
  }

  // ---- the name line in the Mehr popover -------------------------------------------------------------------------------------------------------------------------------------
  // #more-name is aria-hidden (every icon already has its accessible name) and has a reserved height, so filling or emptying it moves nothing. It shows the state ("an" / "aus", from
  // aria-pressed; none for an action such as "Neu anfangen") and the name (the aria-label) of the last icon that got a pointerdown (mouse, pen or touch: iOS Safari does not focus a
  // button on a tap), a focusin (keyboard) or a mouse pointerover, and is refreshed on every tick, so a tap that toggles the state shows the new state. Nothing depends on hover
  // or focus alone. The words are keyed (the dictionary comes in a later phase).
  const T = { 'more.state.on': 'an', 'more.state.off': 'aus', 'more.hint': 'Symbol antippen' };
  // Which buttons of the second row close the sheet on the mousedown and which on the click. Clear, Paste Pattern and Download are wired by p5 on the mousedown (their handlers run on it), so a click may never
  // come: close on the mousedown. Reset Color (Farbe) is wired on the CLICK (sketch.js addEventListener('click')): closing the sheet on its mousedown would cancel the click and the button would do nothing, so it
  // closes on the click like Info. Nodes is wired on the mousedown too (p5) and its handler REPLACES the button's svg (nodeBtn.html(...) in updateNodeToggleIcon): the element the mousedown hit is gone when the finger
  // comes up, so the browser sends NO click (measured with real taps, commit 3b: pointerdown, mousedown, pointerup, mouseup, no click, the sheet stayed open). It closes on the mousedown like Clear.
  const MOUSEDOWN_WIRED = ['btn-clear', 'btn-paste-pattern', 'btn-save', 'btn-toggle-nodes'];
  const CLICK_CLOSES = ['btn-info', 'btn-face-colors-reset', 'btn-random'];
  const moreRow = $('#more-rail .more-row'), nameEl = $('#more-name'), morePanel = $('#more-rail');
  const nameState = nameEl && nameEl.querySelector('.more-name-state'), nameLabel = nameEl && nameEl.querySelector('.more-name-label');
  let last = null;
  function refreshName() {
    if (!nameEl || !nameState || !nameLabel) return;
    if (morePanel && morePanel.hidden) last = null;   // a closed popover starts empty the next time
    let state = '', label = T['more.hint'];
    if (last) {
      label = last.getAttribute('aria-label') || last.getAttribute('title') || '';
      const p = last.getAttribute('aria-pressed');
      if (p === 'true') state = T['more.state.on'] + ' · ';
      else if (p === 'false') state = T['more.state.off'] + ' · ';
    }
    if (nameState.textContent !== state) nameState.textContent = state;
    if (nameLabel.textContent !== label) nameLabel.textContent = label;
  }
  // The listeners sit on the whole sheet, not on the first row: the phone layout (ui-phone.js) adds a second icon row (.more-extra) with the former rail buttons, and the name line names those too. They are
  // buttons and links with an accessible name; a link (the catalog) is not a button, so `a` counts as well.
  function touched(e) {
    const b = e.target.closest && e.target.closest('button, a');
    if (!b || !morePanel || !morePanel.contains(b) || !(b.closest && b.closest('.more-row'))) return;
    last = b;
    refreshName();
  }
  if (moreRow && morePanel) {
    morePanel.addEventListener('pointerdown', touched, true);
    morePanel.addEventListener('focusin', touched);
    morePanel.addEventListener('pointerover', function (e) { if (e.pointerType === 'mouse') touched(e); });
    // The second row's buttons leave the sheet when they are used. Clear, Paste Pattern and Download are wired by sketch.js on the MOUSEDOWN (p5's press handler), and Download's dialog then covers the button, so the
    // click never reaches it: the sheet closes on the mousedown, after the button's own handler has run (the bridge in ui.js sends a mousedown for a keyboard activation too). The browser's mousedown default would
    // focus the pressed button - in a closed sheet, i.e. nowhere - so it is cancelled, and the focus goes to the Mehr button unless a dialog that just opened has taken it (UI.dialog does). Info opens its own card
    // on the click (UI.overlay: one overlay at a time) and the catalog link needs its click to navigate: they close the sheet on the click.
    // The button the mousedown hit, found through the event's PATH: the p5 handler of Nodes has already replaced the button's svg when this listener runs, so the target (the old svg) is detached and its closest() finds nothing.
    function hitBy(e, sel) {
      const t = e.target, own = t && t.closest && t.closest(sel);
      if (own) return own;
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      for (let i = 0; i < path.length; i++) { const m = path[i] && path[i].closest && path[i].closest(sel); if (m) return m; }
      return null;
    }
    morePanel.addEventListener('mousedown', function (e) {
      const b = hitBy(e, MOUSEDOWN_WIRED.map(function (id) { return '.more-extra #' + id; }).join(', '));
      if (!b || !moreRail || !moreRail.isOpen) return;
      e.preventDefault();
      moreRail.close(false);
      const a = document.activeElement;
      if ((!a || a === document.body || morePanel.contains(a)) && moreBtn) moreBtn.focus();
    });
    morePanel.addEventListener('click', function (e) {
      const b = e.target.closest && e.target.closest('.more-extra a, ' + CLICK_CLOSES.map(function (id) { return '#' + id; }).join(', '));
      if (b && moreRail && moreRail.isOpen) moreRail.close(true);
    });
  }

  UI.onSync(function () { syncPressed(); syncDot(); refreshName(); });
  syncPressed(); syncDot(); refreshName();
})();
