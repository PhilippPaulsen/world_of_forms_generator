(function () {
  const $ = function (s) { return document.querySelector(s); };
  UI.overlay($('#btn-more-rail'), $('#more-rail'), {});
  UI.overlay($('#btn-info'), $('#info-card'), {});
})();
