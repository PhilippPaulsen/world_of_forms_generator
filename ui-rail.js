(function () {
  const $ = function (s) { return document.querySelector(s); };
  UI.overlay($('#btn-more-rail'), $('#more-rail'), {});
  UI.overlay($('#btn-info'), $('#info-card'), {});
  // Help (header) and Download (rail) open modal dialogs that sketch.js shows and hides; this adds their keyboard behaviour.
  UI.dialog($('#help-overlay'), $('#btn-help'), $('#close-help'));
  UI.dialog($('#export-overlay'), $('#btn-save'), $('#close-export'));
})();
