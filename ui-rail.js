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
})();
