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
  function touched(e) {
    const b = e.target.closest && e.target.closest('button');
    if (!b || !moreRow || !moreRow.contains(b)) return;
    last = b;
    refreshName();
  }
  if (moreRow) {
    moreRow.addEventListener('pointerdown', touched, true);
    moreRow.addEventListener('focusin', touched);
    moreRow.addEventListener('pointerover', function (e) { if (e.pointerType === 'mouse') touched(e); });
  }

  UI.onSync(function () { syncPressed(); syncDot(); refreshName(); });
  syncPressed(); syncDot(); refreshName();
})();
