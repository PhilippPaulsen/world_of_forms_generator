/*
 * The phone layout as DATA (phone layout, commit 1a). Pure: no DOM, no window. ui-phone.js (the engine) reads this and knows no control; tools/ui/test-phone-config.js runs validate() in Node.
 *
 * Below 768px the engine re-parents EXISTING controls (same ids, classes, handlers) into script-made containers: a tool row, a sub-tab row and ONE panel slot under the canvas. This file says which
 * control goes where. Widths are the DESIGN widths in px (measured in the pane at a coarse pointer, --target 48) - validate() adds them up against the phone width; the pane run compares them with the real boxes.
 *
 *   anchor     a selector: the containers are inserted right after that element.
 *   tabs       tab -> { covered, panelH, subtabs: [ids], defaultSubtab, toolRow }.  covered: false = the tab keeps today's phone layout (the engine releases everything); in 1a/1b only Form is covered.
 *   subtabs    sub-tab id -> { label, rows } (a STUB - { label, stub: true } - has no rows: its tab is not covered yet). A sub-tab is defined ONCE and may be listed by several tabs ("ebenen", "zeit").
 *   rows       [{ items: [{ id, w, wMin?, h?, fluid? }] }]: one row of the panel (48px high; the panel is two rows); an item is one existing element (a control or the wrapper around a few). h: 104 = a block that
 *              fills both rows (the layer strip is itself two rows). wMin: the width after the narrowest-phone CSS (below 340px), when it is smaller than w. fluid: the element takes the row's width
 *              (the two strips: flex 0 0 100%) and has no width of its own to add up.
 *   toolRows   name -> { groups: [[ids]], end: [ids], sheet }: the groups sit in a row that scrolls sideways when it does not fit, `end` stays fixed at the end; `sheet` = former rail buttons the rail's "Mehr" sheet receives
 *              (before: the element the new row goes in front of; opener: the button that opens the sheet - it takes the focus when one of these buttons, hidden in the closed sheet, is asked to).
 *   afterShow  id -> [global, method]: called (when it exists) after the element moved into the visible panel - a moved element loses its scroll position.
 */
(function (root) {
  'use strict';

  const config = {
    version: 1,
    query: '(max-width: 767px)',
    anchor: '.canvas-row',   // the containers are inserted right after this element (before .main-container)
    // px. chromeH = header + toolRow + subtabs + gap + panel is the height the canvas leaves free (the CSS has the same numbers as --ph-* tokens; tools/ui/test-phone-config.js compares them).
    sizes: { header: 48, toolRow: 56, subtabs: 44, gap: 8, target: 48, rowGap: 8, gutter: 16, designWidth: 375, narrowWidth: 320 },
    // the ids that no HTML file holds because a script creates them: id -> the script. (None yet; the layer and timeline strips are containers in index.html that ui-layers.js / ui-timeline.js fill.)
    createdByScript: {},
    tabs: {
      form: { covered: true, panelH: 104, subtabs: ['raster', 'ebenen', 'zeit'], defaultSubtab: 'raster', toolRow: 'form' },
      farbe: { covered: false, subtabs: ['harmonie', 'spuren', 'ebenen', 'zeit'] },
      netz: { covered: false, subtabs: ['art', 'achsen', 'ebenen', 'zeit'] }
    },
    toolRows: {
      form: {
        groups: [['btn-undo', 'btn-redo', 'btn-random'], ['btn-toggle-nodes', 'btn-toggle-faces']],
        end: ['btn-more-rail'],
        // the rail's other buttons: the rail's "Mehr" sheet (#more-rail) receives them as a second icon row, above its name line
        sheet: { id: 'more-rail', before: 'more-name', opener: 'btn-more-rail', items: ['btn-gallery', 'btn-paste-pattern', 'btn-info', 'btn-save', 'btn-clear'] }
      }
    },
    subtabs: {
      raster: {
        label: 'Raster',
        rows: [
          { items: [{ id: 'nav-shapes', w: 160 }, { id: 'nav-symmetry', w: 104 }] },
          { items: [{ id: 'nav-node-stepper', w: 117, wMin: 109 }, { id: 'nav-size-stepper', w: 117, wMin: 109 }, { id: 'btn-more-form', w: 48 }] }
        ]
      },
      ebenen: { label: 'Ebenen', rows: [{ items: [{ id: 'layer-strip', fluid: true, h: 104 }] }] },
      zeit: { label: 'Zeit', rows: [{ items: [{ id: 'timeline-strip', fluid: true }] }] },
      // stubs: the sub-tabs of the tabs that are not covered yet
      harmonie: { label: 'Harmonie', stub: true },
      spuren: { label: 'Spuren', stub: true },
      art: { label: 'Art', stub: true },
      achsen: { label: 'Achsen', stub: true }
    },
    afterShow: { 'layer-strip': ['layerTable', 'revealActive'] }
  };

  const sharesRow = row => row.items.length > 1;   // a fluid element fills its row: nothing else may share it

  // ---- validate(config, env) -> [problem strings]; [] = fine. env = { ids: Set|Array of the ids the HTML holds } -------------------------------------------------------------------------------------
  function validate(cfg, env) {
    const bad = [];
    const S = cfg.sizes, htmlIds = new Set((env && env.ids) || []), made = cfg.createdByScript || {};
    const known = id => htmlIds.has(id) || Object.prototype.hasOwnProperty.call(made, id);
    const avail = S.designWidth - 2 * S.gutter, availNarrow = S.narrowWidth - 2 * S.gutter;
    const rowW = (items, key) => items.reduce((a, it) => a + (it.fluid ? 0 : key === 'min' && it.wMin ? it.wMin : it.w), 0) + S.rowGap * Math.max(0, items.length - 1);
    if (!/^\(max-width: 767px\)$/.test(cfg.query || '')) bad.push('query must be (max-width: 767px)');
    Object.keys(cfg.subtabs).forEach(function (sid) {
      const st = cfg.subtabs[sid];
      if (!st.label || typeof st.label !== 'string') bad.push('subtab ' + sid + ': no label');
      if (st.stub && st.rows) bad.push('subtab ' + sid + ': a stub has no rows');
      if (!st.stub && !Array.isArray(st.rows)) bad.push('subtab ' + sid + ': no rows');
    });
    Object.keys(cfg.tabs).forEach(function (tab) {
      const t = cfg.tabs[tab], used = new Map(), seenSub = new Set();
      if (!Array.isArray(t.subtabs) || !t.subtabs.length) { bad.push(tab + ': no sub-tabs'); return; }
      t.subtabs.forEach(function (sid) {
        if (!cfg.subtabs[sid]) bad.push(tab + ': sub-tab ' + sid + ' is not defined');
        if (seenSub.has(sid)) bad.push(tab + ': sub-tab ' + sid + ' is listed twice');
        seenSub.add(sid);
      });
      if (!t.covered) {   // a tab that is not covered yet: stubs (or real shared sub-tabs) only, and no tool row
        if (t.toolRow) bad.push(tab + ': not covered, but has a tool row');
        t.subtabs.forEach(function (sid) { const st = cfg.subtabs[sid]; if (st && !st.stub && !(sid === 'ebenen' || sid === 'zeit')) bad.push(tab + ': not covered, but sub-tab ' + sid + ' has content'); });
        return;
      }
      if (t.subtabs.indexOf(t.defaultSubtab) < 0) bad.push(tab + ': defaultSubtab ' + t.defaultSubtab + ' is not one of its sub-tabs');
      if (t.panelH !== 2 * S.target + S.rowGap) bad.push(tab + ': panelH ' + t.panelH + ' is not two rows of ' + S.target + ' + the gap');
      const claim = function (id, where) {
        if (!known(id)) bad.push(tab + ': ' + where + ': id ' + id + ' is neither in index.html nor created by a named script');
        if (used.has(id)) bad.push(tab + ': ' + where + ': control ' + id + ' is listed twice (also in ' + used.get(id) + ')');
        else used.set(id, where);
      };
      const tr = cfg.toolRows[t.toolRow];
      if (!tr) bad.push(tab + ': tool row ' + t.toolRow + ' is not defined');
      else {
        const ids = [].concat.apply([], tr.groups).concat(tr.end);
        ids.forEach(function (id) { claim(id, 'tool row'); });
        if (tr.sheet) { if (!known(tr.sheet.id)) bad.push(tab + ': sheet ' + tr.sheet.id + ' is not in index.html'); tr.sheet.items.forEach(function (id) { claim(id, 'sheet'); }); }
        // the tool row at 375: n icons of --target, 4px inside a group, a 1px hairline with 8px margins between groups (and before the fixed end); 4px margins from 366px down
        const n = ids.length, gaps = tr.groups.reduce((a, g) => a + (g.length - 1), 0), seps = tr.groups.length;   // seps: between the groups + before the end = groups.length
        const w = n * S.target + gaps * 4 + seps * (1 + 2 * 8);
        if (w > avail) bad.push(tab + ': the tool row is ' + w + 'px wide, more than the ' + avail + 'px of a ' + S.designWidth + 'px phone');
      }
      t.subtabs.forEach(function (sid) {
        const st = cfg.subtabs[sid];
        if (!st) return;
        if (st.stub) { bad.push(tab + ': covered, but sub-tab ' + sid + ' is a stub'); return; }
        let heightRows = 0;
        st.rows.forEach(function (row, i) {
          if (!row.items || !row.items.length) bad.push(tab + '/' + sid + ': row ' + (i + 1) + ' is empty');
          row.items.forEach(function (it) {
            claim(it.id, sid + ' row ' + (i + 1));
            if (it.fluid ? it.w !== undefined || sharesRow(row) : !(it.w > 0)) bad.push(tab + '/' + sid + ': ' + it.id + (it.fluid ? ' is fluid but has a width or shares its row' : ' has no width'));
            if (it.wMin !== undefined && !(it.wMin > 0 && it.wMin <= it.w)) bad.push(tab + '/' + sid + ': ' + it.id + ' has a wMin above its w');
          });
          const span = Math.max.apply(null, row.items.map(it => it.h || S.target));
          heightRows += span > S.target ? Math.round((span + S.rowGap) / (S.target + S.rowGap)) : 1;
          if (rowW(row.items) > avail) bad.push(tab + '/' + sid + ': row ' + (i + 1) + ' is ' + rowW(row.items) + 'px wide, more than the ' + avail + 'px of a ' + S.designWidth + 'px phone');
          if (rowW(row.items, 'min') > availNarrow) bad.push(tab + '/' + sid + ': row ' + (i + 1) + ' is ' + rowW(row.items, 'min') + 'px wide even with its narrow widths, more than the ' + availNarrow + 'px of a ' + S.narrowWidth + 'px phone');
        });
        if (heightRows > 2) bad.push(tab + '/' + sid + ': ' + heightRows + ' rows, the panel holds two');
        const blockH = st.rows.reduce((a, r) => a + Math.max.apply(null, r.items.map(it => it.h || S.target)) + S.rowGap, -S.rowGap);
        if (blockH > t.panelH) bad.push(tab + '/' + sid + ': its rows are ' + blockH + 'px high, the panel is ' + t.panelH + 'px');
      });
    });
    // a shared sub-tab is defined ONCE and listed by every tab: no control may be defined by two sub-tabs
    const definedIn = {};
    Object.keys(cfg.subtabs).forEach(function (sid) {
      (cfg.subtabs[sid].rows || []).forEach(function (row) {
        (row.items || []).forEach(function (it) {
          if (definedIn[it.id] && definedIn[it.id] !== sid) bad.push('control ' + it.id + ' is defined by two sub-tabs (' + definedIn[it.id] + ', ' + sid + '): a shared sub-tab is defined once and listed by every tab');
          definedIn[it.id] = sid;
        });
      });
    });
    Object.keys(cfg.afterShow || {}).forEach(function (id) { if (!known(id)) bad.push('afterShow: id ' + id + ' is unknown'); });
    return bad;
  }

  const api = { config: config, validate: validate, chromeH: function (cfg, tab) { const S = cfg.sizes; return S.header + S.toolRow + S.subtabs + S.gap + cfg.tabs[tab].panelH; } };
  root.PHONE_CONFIG = config;
  root.PHONE_CONFIG_API = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
