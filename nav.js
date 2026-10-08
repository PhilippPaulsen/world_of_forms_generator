/*
 * Tabs (UI rework 4a). Form / Farbe / Netz are in-page hash links: a click
 * switches only the nav row (and, in later steps, the organ strip and hint
 * area); canvas, pattern, layers and timeline are not touched and nothing
 * reloads.
 *
 *   #form (default) | #farbe | #netz   an unknown or missing hash = #form
 *
 * - A tab click uses history.replaceState, so tab clicks do not fill the
 *   browser history. The hash stays in the URL for reload and sharing; any
 *   query string (catalog back-link parameters) is kept as it is.
 * - Real <a> links inside a <nav>, aria-current="page" on the active one,
 *   each tab aria-controls one nav row (#nav-<tab>). Tab moves between the
 *   links, Enter activates.
 * - Other code can read the current tab with uiNav.current() or listen to
 *   the 'tabchange' event on document (detail: { tab }).
 *
 * UI only: no generator state is read or written here.
 */
(function () {
  const TABS = ['form', 'farbe', 'netz'];
  const DEFAULT_TAB = 'form';
  let current = DEFAULT_TAB;

  function tabFromHash(hash) {
    const t = String(hash || '').replace(/^#/, '');
    return TABS.indexOf(t) >= 0 ? t : DEFAULT_TAB;
  }

  function show(tab) {
    TABS.forEach(function (t) {
      const link = document.getElementById('tab-' + t);
      const row = document.getElementById('nav-' + t);
      if (link) {
        if (t === tab) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
      if (row) row.hidden = t !== tab;
    });
    document.documentElement.setAttribute('data-tab', tab);
    if (tab !== current) {
      current = tab;
      document.dispatchEvent(new CustomEvent('tabchange', { detail: { tab: tab } }));
    }
  }

  function setHash(tab) {
    history.replaceState(null, '', location.pathname + location.search + '#' + tab);
  }

  function init() {
    TABS.forEach(function (t) {
      const link = document.getElementById('tab-' + t);
      if (!link) return;
      link.addEventListener('click', function (e) {
        e.preventDefault();
        setHash(t);
        show(t);
      });
    });
    window.addEventListener('hashchange', function () {
      const t = tabFromHash(location.hash);
      if (location.hash && location.hash !== '#' + t) setHash(t); // unknown hash -> #form
      show(t);
    });

    const start = tabFromHash(location.hash);
    // a present but unknown hash is normalised to the default; no hash is left alone
    if (location.hash && location.hash !== '#' + start) setHash(start);
    current = null; // force the first show() to dispatch, so listeners see the start tab
    show(start);
  }

  window.uiNav = { current: function () { return current; }, show: function (t) { setHash(t); show(t); }, TABS: TABS.slice() };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
