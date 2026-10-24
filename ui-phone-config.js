/*
 * The phone layout as DATA (phone layout, commit 1a). Pure: no DOM, no window. ui-phone.js (the engine) reads this and knows no control; tools/ui/test-phone-config.js runs validate() in Node.
 *
 * Below 768px the engine re-parents EXISTING controls (same ids, classes, handlers) into script-made containers: a tool row, a sub-tab row and ONE panel slot under the canvas. This file says which
 * control goes where. Widths are the DESIGN widths in px (measured in the pane at a coarse pointer, --target 48) - validate() adds them up against the phone width; the pane run compares them with the real boxes.
 *
 *   anchor     a selector: the containers are inserted right after that element.
 *   tabs       tab -> { covered, panelH, subtabs: [ids], defaultSubtab, toolRow }.  covered: false = the tab keeps today's phone layout (the engine releases everything); in 1a/1b only Form is covered, from commit 2 Farbe as well, from commit 3 Netz: every tab is covered.
 *   subtabs    sub-tab id -> { label, rows } (a STUB - { label, stub: true } - has no rows: its tab is not covered yet). A sub-tab is defined ONCE and may be listed by several tabs ("ebenen", "zeit").
 *   rows       [{ items: [{ id, w, wMin?, h?, fluid? }] }]: one row of the panel (48px high; the panel is two rows); an item is one existing element (a control or the wrapper around a few). h: 104 = a block that
 *              fills both rows (the layer strip is itself two rows). wMin: the width after the narrowest-phone CSS (below 340px), when it is smaller than w. also: [ids] more elements that share the item's slot (two of them are never visible together: the item's w is the widest). sep: true = a hairline the engine makes (w: 1, no id). row.scroll: the row scrolls sideways
 *              below 340px (it does not fit 288px). fluid: the element takes the row's width
 *              (the two strips: flex 0 0 100%) and has no width of its own to add up.
 *   toolRows   name -> { groups: [[ids]], end: [ids], sheet }: the groups sit in a row that scrolls sideways when it does not fit, `end` stays fixed at the end; `sheet` = former rail buttons the rail's "Mehr" sheet receives
 *              (before: the element the new row goes in front of; opener: the button that opens the sheet - it takes the focus when one of these buttons, hidden in the closed sheet, is asked to).
 *   sheets     id -> { host, label, content, trigger: { within, selector }, open }: a block that becomes a bottom sheet (UI.overlay) while the layout is on; tabs.<tab>.sheets lists them. toolRows.<name>.sheet.settings = the
 *              contextual groups the rail's sheet takes along. See the comment at `sheets` below.
 *   sheets.<id>.blocks  (optional) [[row]]: the content of the sheet in blocks of rows (commit 3a of the sheets redesign): a block is a list of rows, a row { items: [{ id, w, wMin? }], wrap? }, an item one existing element
 *              (a .control-group: sketch.js keeps showing and hiding it; it moves whole, the engine knows no control). Rows are 48px high with 8px gaps, blocks are 16px apart, the sheet has 16px padding. A row whose items are
 *              ALL hidden is hidden (no empty row, no gap), a block whose rows are all hidden too. wrap: the row wraps into two lines below 340px (it does not fit 288px there; validate() requires it exactly then).
 *   overlays   id -> { content, blocks, steppers? } (an overlay's steppers wrap inputs that are row items themselves): an overlay that already exists with its own UI.overlay (ui-net.js's #more-netz) and gets the same rows as a sheet's content (commit 4a); tabs.<tab>.overlays lists them. A row may have
 *              `h` (its height when it is not --target: the 20px readout line) and an item may be `fluid` (the row's width, alone in its row).
 *   items      an item of a sheet's or overlay's row may carry `gate: 'class'`: it counts as hidden unless the sheet's content has that class (the timeline sheet's pairing editor: the toggle of ui-phone-timeline.js).
 *   sheets.<id>.steppers  (optional) inputId -> { icon, step, round?, min?, max?, wrap?, noTyping?, name, more, less }: an existing input that the engine wraps into a stepper (UI.stepper) while the layout is on and unwraps at
 *              release() (commit 3b). icons: key -> [stroke paths], the icons of those steppers and the two chevrons (chevron-up, chevron-down).
 *   afterShow  id -> [global, method]: called (when it exists) after the element moved into the visible panel - a moved element loses its scroll position.
 */
(function (root) {
  'use strict';

  const config = {
    version: 1,
    query: '(max-width: 767px)',
    anchor: '.canvas-row',   // the containers are inserted right after this element (before .main-container)
    // px. chromeH = header + gap (above the canvas) + toolRow + subtabs + gap (above the panel) + panel is the height the canvas leaves free (the CSS has the same numbers as --ph-* tokens and --sp-2;
    // tools/ui/test-phone-config.js compares them). scale = the four spacings of the phone CSS (--sp-1 .. --sp-4): gap = scale[1], gutter = scale[2].
    sizes: { header: 40, toolRow: 64, subtabs: 44, gap: 8, target: 48, rowGap: 8, gutter: 16, designWidth: 375, narrowWidth: 320 },
    scale: [4, 8, 16, 32],
    // the ids that no HTML file holds because a script creates them: id -> the script. (None yet; the layer and timeline strips are containers in index.html that ui-layers.js / ui-timeline.js fill.)
    createdByScript: { 'ph-trail-chips': 'ui-phone-chips.js', 'ph-trail-stepper': 'ui-phone-chips.js', 'ph-tl-icons': 'ui-phone-timeline.js', 'ph-tl-readout': 'ui-phone-timeline.js', 'ph-tl-chips': 'ui-phone-pairing.js', 'ph-tl-moves': 'ui-phone-pairing.js', 'ph-tl-variant': 'ui-phone-pairing.js', 'ph-tl-reset': 'ui-phone-pairing.js', 'ph-tl-listbtn': 'ui-phone-pairing.js', 'ph-tl-listhead': 'ui-phone-pairing.js', 'ph-tl-list': 'ui-phone-pairing.js' },
    tabs: {
      form: { covered: true, panelH: 104, subtabs: ['raster', 'ebenen', 'zeit'], defaultSubtab: 'raster', toolRow: 'form', sheets: ['layer', 'timeline'] },
      farbe: { covered: true, panelH: 104, subtabs: ['harmonie', 'spuren', 'ebenen', 'zeit'], defaultSubtab: 'harmonie', toolRow: 'farbe', sheets: ['layer', 'timeline'] },
      netz: { covered: true, panelH: 104, subtabs: ['art', 'achsen', 'ebenen', 'zeit'], defaultSubtab: 'art', toolRow: 'netz', sheets: ['layer', 'timeline'], overlays: ['netz'] }
    },
    toolRows: {
      form: {
        groups: [['btn-undo', 'btn-redo', 'btn-random'], ['btn-toggle-nodes', 'btn-toggle-faces']],
        end: ['btn-more-rail'],
        // the rail's other buttons: the rail's "Mehr" sheet (#more-rail) receives them as a second icon row, above its name line
        sheet: { id: 'more-rail', before: 'more-name', opener: 'btn-more-rail', items: ['btn-gallery', 'btn-paste-pattern', 'btn-info', 'btn-save', 'btn-clear'],
          // the contextual groups that sketch.js shows under the page while Curve or Free is on (the strength slider, the roughness, ...): they follow their toggles into this sheet and stay hidden until sketch.js shows them
          settings: ['curve-fold-group', 'curve-strength-group', 'free-roughness-group', 'free-controls-group'] }
      },
      // Farbe (commit 2): Fill | the four distribution strategies (the radiogroup wrapper: 4 icons, `icons`) | More. Today's Farbe rail minus Undo / Redo / Random / Clear / the Formorgel link / the Curve-Free popover
      // (hidden in Farbe by style.css) - what is left of it goes into the sheet: Reset Color, Nodes, the Farborgel link, Info, Download. The sheet's own first row (Curve, Free, ... Neu anfangen) is Form's and stays
      // hidden in Farbe (the phone CSS). openerLabel: the name More has while this tool row is on (its own says "Kurve, Frei, ...").
      farbe: {
        groups: [['btn-toggle-faces'], ['farbe-strategy-group']],
        icons: { 'farbe-strategy-group': 4 },
        end: ['btn-more-rail'],
        sheet: { id: 'more-rail', before: 'more-name', opener: 'btn-more-rail', items: ['btn-face-colors-reset', 'btn-toggle-nodes', 'btn-farborgel', 'btn-info', 'btn-save'],
          openerLabel: { text: 'Mehr: Farben zurücksetzen, Knoten, Farborgel, Info, Download', i18n: 'more.farbe.button' } }
      },
      // Netz (commit 3): Undo, Redo | Nodes, Net lines, Fill | More. Net lines is a text button in #more-netz at 768px and up; the phone CSS draws it as an icon in this row. Random, the Formorgel link, Info,
      // Download and Clear go to the rail's sheet, which keeps its own first row (Curve, Free, Free Endpoints, Alternative Net, Neu anfangen) as it has in Form (they are in the Netz rail's More today).
      // labels (commit 3b): id -> the name the control has while this tool row is on (aria-label and title, data-i18n). Net lines is an icon here: its text, which is its name at 768px and up, is emptied visually.
      netz: {
        labels: { 'net-lines-btn': { text: 'Netzlinien zeigen', i18n: 'netz.lines.button' } },
        groups: [['btn-undo', 'btn-redo'], ['btn-toggle-nodes', 'net-lines-btn', 'btn-toggle-faces']],
        end: ['btn-more-rail'],
        sheet: { id: 'more-rail', before: 'more-name', opener: 'btn-more-rail', items: ['btn-random', 'btn-gallery', 'btn-info', 'btn-save', 'btn-clear'],
          settings: ['curve-fold-group', 'curve-strength-group', 'free-roughness-group', 'free-controls-group'] }
      }
    },
    // follow: follower id -> the id of the block it left (sketch.js still shows and hides that block as a whole), on apply and on every UI tick, only while the layout is on. A string copies the block's `hidden`
    // (release() shows the follower again). An object { of, mode: 'disable', reason } keeps the follower SHOWN and marks it aria-disabled with the reason (UI.setDisabled) while the block is hidden:
    // release() enables it again. `i18n` (optional) is the dictionary key (ui-i18n.js) of the reason: the engine writes the text of the current language, `reason` is the German text it falls back to.
    // The Fokus stepper left #net-focus-row (which keeps the title and the exact field in the Netz sheet); sketch.js shows that row only for Sin and Tan, so for Aus and Geo
    // the stepper is there but disabled and says why, instead of an empty row.
    follow: { 'net-focus-stepper': { of: 'net-focus-row', mode: 'disable', reason: 'Fokus gilt für Sin und Tan', i18n: 'net.reason.focus' } },
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
      // Farbe (commit 2). Row 1 of Harmonie: Kreis + Dreieck (the wrapper), a hairline (`sep`: the engine makes it), and the harmony cluster of the active view (the two clusters share one slot: `also`, and both reserve
      // four buttons' width). It is 337px wide: from 340px down the row scrolls sideways (`scroll`), a 4-button cluster and two anchor buttons do not fit 288px with 48px targets. Row 2: the two anchor steppers and the swatch.
      harmonie: {
        label: 'Harmonie',
        rows: [
          { scroll: true, items: [{ id: 'nav-anchor-views', w: 104 }, { sep: true, w: 1 }, { id: 'farbe-family-triangle', w: 216, also: ['farbe-family-circle'] }] },
          { items: [{ id: 'farbe-anchor-hue-stepper', w: 117, wMin: 109 }, { id: 'farbe-anchor-register-stepper', w: 117, wMin: 109 }, { id: 'farbe-anchor-preview', w: 48 }] }
        ]
      },
      // the chip view of the trails (ui-phone-chips.js makes both containers; the model is the hidden #face-colors-list)
      spuren: { label: 'Spuren', rows: [{ items: [{ id: 'ph-trail-chips', fluid: true }] }, { items: [{ id: 'ph-trail-stepper', fluid: true }] }] },
      // Netz (commit 3). Art: row 1 = the four kinds (Aus, Sin, Tan, Geo: 4 x 60 + 3 gaps = 264), row 2 = the strength stepper, the panel's own More (#more-netz: the domain, Macro, the exact fields, Alternate and the
      // hints stay in it) and Reverse LAST (sketch.js shows it for Geo only: More keeps its place whether or not Reverse is there; 117 + 8 + 48 + 8 + 74 = 255). Achsen: row 1 = Both / X / Y, row 2 = the Fokus stepper (sketch.js shows its row for Sin and Tan only: disabled with a reason otherwise, see `follow`).
      art: { label: 'Art', rows: [{ items: [{ id: 'nav-kinds', w: 264 }] }, { items: [{ id: 'net-strength-stepper', w: 117, wMin: 109 }, { id: 'btn-more-netz', w: 48 }, { id: 'net-reverse-btn', w: 74 }] }] },
      achsen: { label: 'Achsen', rows: [{ items: [{ id: 'net-axes-row', w: 158 }] }, { items: [{ id: 'net-focus-stepper', w: 117, wMin: 109 }] }] }
    },
    // Bottom sheets (1b): a block that stays inline above 768px and in the tabs that are not covered moves into a sheet (UI.overlay) while the layout is on. The sheet FOLLOWS the block's own open state - the
    // "..." button's existing handler flips it, nothing here toggles it - and closing the sheet (Escape, the scrim, a tap outside, a resize) closes that state by clicking the button once more.
    //   content: the block; trigger: { within: an element of the panel, selector } the "..." button; open: how to read the state ({ notHidden: true } or { hasClass }); label: the dialog's name (the button's own).
    // the stroke paths (viewBox 24, 18px, the UI's icon style) of the icons the steppers of a sheet use, and the two chevrons every stepper has
    icons: {
      'arrow-right': ['M4 12 H20', 'M14 6 L20 12 L14 18'],
      'arrow-down': ['M12 4 V20', 'M6 14 L12 20 L18 14'],
      'rotate': ['M4 12 a8 8 0 1 0 2.7 -6', 'M4 4 v6 h6'],
      'sliders': ['M4 8 H20', 'M4 16 H20', 'M9 5 V11', 'M15 13 V19'],
      'target': ['M12 3 V7', 'M12 17 V21', 'M3 12 H7', 'M17 12 H21', 'M16 12 a4 4 0 1 1 -8 0 a4 4 0 1 1 8 0'],
      'chevron-up': ['M6 15 L12 9 L18 15'],
      'chevron-down': ['M6 9 L12 15 L18 9']
    },
    sheets: {
      // The layer sheet (3a): no group headings, no visible labels (the labels stay as the names of the controls). Block 1 = what the layer IS: row 1 the three shapes and the three symmetry modes (6 x 48 + gaps = 328: wraps
      // below 340px), row 2 the node count and size steppers, row 3 the fold buttons (sketch.js shows them for a hexagon layer only: the row collapses otherwise). Block 2 = where it SITS: row 1 offset X, offset Y
      // (the typed inputs, wrapped into 117px steppers by the engine: see `steppers`) and Align to base, row 2 the two mesh presets and the rotation field. Every item is the layer's own .control-group, so sketch.js's show / hide of a group still decides.
      layer: {
        host: 'ph-sheet-layer', label: 'Ebenen-Einstellungen', content: 'layer-more-panel', trigger: { within: 'layer-strip', selector: '.lt-more' }, open: { notHidden: true },
        // steppers (3b): an existing typed input that becomes a stepper (the same markup as the Form row's, built by the engine around the input) while the layout is on, and is plain again after release():
        // step / round / min / max / wrap / noTyping are the options of UI.stepper (commit 2); `icon` is a key of `icons`; name / more / less = { i18n (dictionary key), text (German fallback) } of the
        // group, the up chevron and the down chevron. The item that holds the input is 117px wide (109 at 320).
        steppers: {
          'layer-offset-x-input': { icon: 'arrow-right', step: 10, round: 0, noTyping: true, display: { decimals: 1 }, name: { i18n: 'layer.shiftX', text: 'Versatz X' }, more: { i18n: 'layer.shiftX.more', text: 'Versatz X mehr' }, less: { i18n: 'layer.shiftX.less', text: 'Versatz X weniger' } },
          'layer-offset-y-input': { icon: 'arrow-down', step: 10, round: 0, noTyping: true, display: { decimals: 1 }, name: { i18n: 'layer.shiftY', text: 'Versatz Y' }, more: { i18n: 'layer.shiftY.more', text: 'Versatz Y mehr' }, less: { i18n: 'layer.shiftY.less', text: 'Versatz Y weniger' } },
          'layer-rotation-input': { icon: 'rotate', step: 15, min: 0, max: 360, wrap: true, round: 0, noTyping: true, display: { decimals: 1 }, name: { i18n: 'layer.rotation', text: 'Drehung' }, more: { i18n: 'layer.rotation.more', text: 'Drehung mehr' }, less: { i18n: 'layer.rotation.less', text: 'Drehung weniger' } }
        },
        blocks: [
          [
            { wrap: true, items: [{ id: 'layer-shape-group', w: 160 }, { id: 'layer-mode-group', w: 160 }] },
            { items: [{ id: 'layer-node-count-group', w: 117, wMin: 109 }, { id: 'layer-shape-size-group', w: 117, wMin: 109 }] },
            { items: [{ id: 'layer-fold-group', w: 104 }] }
          ],
          [
            { items: [{ id: 'layer-offset-x-group', w: 117, wMin: 109 }, { id: 'layer-offset-y-group', w: 117, wMin: 109 }, { id: 'layer-align-group', w: 48 }] },
            { items: [{ id: 'layer-mesh-preset-group', w: 104 }, { id: 'layer-rotation-group', w: 117, wMin: 109 }] }
          ]
        ]
      },
      // The timeline sheet (5a, 5b, 5c): block 1 = the icon row (netrec | pairing toggle + the segment select | trash: five elements of 48px and 84px, two 1px hairlines with 4px side margins, 8px gaps = 286px;
      // ui-phone-timeline.js makes it and forwards the clicks to the hidden model controls, ui-phone-pairing.js puts the select into it) and ONE readout line of 20px. Block 2 = the line-pairing view of
      // ui-phone-pairing.js, every item behind a GATE: the rows show only while the sheet's content (#timeline-group) has the class ph-tl-editor-show (the view puts it there while the pairing toggle is on and the list is
      // not): row 1 = the line chips (fluid, they scroll), row 2 = [end up, end down, reverse] 160 + [hairline, variant back, k/c, variant forward] 155 = 323px (wraps below 355px, `wrap`), row 3 = [list][reset] (the list
      // icon is hidden while the model offers no list). Block 3 (5c) = the pairing list, behind ph-tl-list-show: a header row [back][count] and the list (fluid; the config counts ONE list row, the real list is as long as
      // the model's and scrolls inside the sheet). The old editor (#timeline-pairing) is the model and is parked hidden by the CSS, with the keyframe list, the net box, the status span and the text button.
      timeline: {
        host: 'ph-sheet-timeline', label: 'Zeitleiste: Mehr', content: 'timeline-group', trigger: { within: 'timeline-strip', selector: '.ts-more' }, open: { hasClass: 'ts-open' },
        blocks: [
          [
            { items: [{ id: 'ph-tl-icons', w: 286 }] },
            { h: 20, items: [{ id: 'ph-tl-readout', fluid: true }] }
          ],
          [
            { items: [{ id: 'ph-tl-chips', fluid: true, gate: 'ph-tl-editor-show' }] },
            { wrap: true, items: [{ id: 'ph-tl-moves', w: 160, gate: 'ph-tl-editor-show' }, { id: 'ph-tl-variant', w: 155, gate: 'ph-tl-editor-show' }] },
            { items: [{ id: 'ph-tl-listbtn', w: 48, gate: 'ph-tl-editor-show' }, { id: 'ph-tl-reset', w: 48, gate: 'ph-tl-editor-show' }] }
          ],
          [
            { items: [{ id: 'ph-tl-listhead', fluid: true, gate: 'ph-tl-list-show' }] },
            { items: [{ id: 'ph-tl-list', fluid: true, gate: 'ph-tl-list-show' }] }
          ]
        ]
      }
    },
    // The Netz sheet (commit 4a): #more-netz is an overlay of its own (ui-net.js opens it from the "..." of the Art panel), so it has no host here: its content is the overlay itself. No headings, no visible labels. Block 1 =
    // the exact strength and focus fields (typed fields for now: 60px; commit 4b makes them steppers), block 2 = the domain (Einzeln / Gekachelt / Feld as icons: 3 x 48 + gaps), the macro cells (only while sketch.js shows
    // them: 3 x 58.5 + gaps, more buttons wrap), Alternate as an icon (sketch.js shows it for Tiled with a geometric law or a focus; its wrapper #net-geo-row stays when Reverse moved to the panel) and ONE readout line of
    // 20px (ui-net.js writes it: "Feld: 5 x 5 Kacheln"). The hints, the headings and the leftover groups are parked hidden by the CSS.
    overlays: {
      netz: {
        content: 'more-netz',
        // the exact fields become steppers (4b): step 0.01, two decimals, the limits of bindExact (ui-net.js: strength 0..1, focus -1..1); the stepper writes the field and dispatches input and change, which bindExact
        // handles as it handles a typed value (clamp, notice, restore). The field is its own row item: the wrapper takes its place in the row. `fixed`: the number of decimals written.
        steppers: {
          'net-strength-exact': { icon: 'sliders', step: 0.01, round: 2, min: 0, max: 1, fixed: 2, noTyping: true, name: { i18n: 'net.strengthFine', text: 'Stärke fein' }, more: { i18n: 'net.strengthFine.more', text: 'Stärke fein mehr' }, less: { i18n: 'net.strengthFine.less', text: 'Stärke fein weniger' } },
          'net-focus-exact': { icon: 'target', step: 0.01, round: 2, min: -1, max: 1, fixed: 2, noTyping: true, name: { i18n: 'net.focusFine', text: 'Fokus fein' }, more: { i18n: 'net.focusFine.more', text: 'Fokus fein mehr' }, less: { i18n: 'net.focusFine.less', text: 'Fokus fein weniger' } }
        },
        blocks: [
          [
            { items: [{ id: 'net-strength-exact', w: 117, wMin: 109 }, { id: 'net-focus-exact', w: 117, wMin: 109 }] }
          ],
          [
            { items: [{ id: 'net-domain-row', w: 160 }] },
            { items: [{ id: 'net-macro-row', w: 192 }] },
            { items: [{ id: 'net-geo-row', w: 48 }] },
            { h: 20, items: [{ id: 'net-readout', fluid: true }] }
          ]
        ]
      }
    },
    afterShow: { 'layer-strip': ['layerTable', 'revealActive'], 'ph-trail-chips': ['uiPhoneChips', 'refresh'] }
  };

  // a follow entry is a string (the id of the block; mode 'hide') or { of, mode, reason }
  const followSpec = v => (typeof v === 'string' ? { of: v, mode: 'hide' } : v);
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
    Object.keys(cfg.sheets || {}).forEach(function (sid) {   // a sheet no tab lists would never be built, and never validated below
      if (!Object.keys(cfg.tabs).some(function (tab) { return (cfg.tabs[tab].sheets || []).indexOf(sid) >= 0; })) bad.push('sheet ' + sid + ' is defined but no tab lists it');
    });
    Object.keys(cfg.overlays || {}).forEach(function (oid) {
      if (!Object.keys(cfg.tabs).some(function (tab) { return (cfg.tabs[tab].overlays || []).indexOf(oid) >= 0; })) bad.push('overlay ' + oid + ' is defined but no tab lists it');
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
      // the steppers of a sheet or an overlay: the input exists in index.html (a sheet's input is NOT a row item, its group is; an overlay's input IS one: the wrapper takes its place), the icons exist, the options are the
      // ones UI.stepper takes (and `fixed` the decimals written, `display.decimals` the decimals shown), every name has a dictionary key and a German text
      const checkSteppers = function (def, label, isRowItem) {
        if (def.steppers === undefined) return;
        const icons = cfg.icons || {};
        const rowIds = [].concat.apply([], (Array.isArray(def.blocks) ? def.blocks : []).map(function (rows) { return [].concat.apply([], (Array.isArray(rows) ? rows : []).map(function (r) { return (r.items || []).map(function (i) { return i.id; }); })); }));
        ['chevron-up', 'chevron-down'].forEach(function (k) { if (!Array.isArray(icons[k]) || !icons[k].length) bad.push('icons: ' + k + ' is missing'); });
        Object.keys(def.steppers).forEach(function (iid) {
          const sp = def.steppers[iid], where = tab + ': ' + label + ' stepper ' + iid;
          if (!known(iid)) bad.push(where + ': the input is not in index.html');
          if (isRowItem ? rowIds.indexOf(iid) < 0 : rowIds.indexOf(iid) >= 0) bad.push(where + (isRowItem ? ': the input must be a row item of the overlay (the wrapper takes its place)' : ': the input is also a row item'));
          if (!(typeof sp.step === 'number' && sp.step > 0 && isFinite(sp.step))) bad.push(where + ': step must be a positive number');
          if (sp.round !== undefined && !(Number.isInteger(sp.round) && sp.round >= 0)) bad.push(where + ': round must be a whole number of decimals');
          if (sp.fixed !== undefined && !(Number.isInteger(sp.fixed) && sp.fixed >= 0)) bad.push(where + ': fixed must be a whole number of decimals');
          if (sp.display !== undefined && !(sp.display && Number.isInteger(sp.display.decimals) && sp.display.decimals >= 0)) bad.push(where + ': display needs a whole number of decimals');
          if (typeof sp.min === 'number' && typeof sp.max === 'number' && !(sp.max > sp.min)) bad.push(where + ': max must be above min');
          if (sp.wrap && !(typeof sp.min === 'number' && typeof sp.max === 'number' && sp.max > sp.min)) bad.push(where + ': wrap needs min and max');
          if (!Array.isArray(icons[sp.icon]) || !icons[sp.icon].length) bad.push(where + ': the icon ' + sp.icon + ' is not defined in icons');
          ['name', 'more', 'less'].forEach(function (k) { const n = sp[k]; if (!n || typeof n.i18n !== 'string' || !n.i18n || typeof n.text !== 'string' || !n.text.trim()) bad.push(where + ': ' + k + ' needs an i18n key and a German text'); });
        });
      };
      // the rows of a sheet or an overlay (blocks): every id exists and is used once in the tab, a row fits 343px and, unless it wraps, 288px with its narrow widths; a row may have its own height `h`, an item may be `fluid`
      // (the row's width, alone in its row)
      const checkBlocks = function (def, label) {
        if (def.blocks === undefined) return;
        const sw = S.designWidth - 2 * S.gutter, swNarrow = S.narrowWidth - 2 * S.gutter;
        if (!Array.isArray(def.blocks) || !def.blocks.length) { bad.push(tab + ': ' + label + ': blocks must be a non-empty list'); return; }
        def.blocks.forEach(function (rows, bi) {
          if (!Array.isArray(rows) || !rows.length) { bad.push(tab + ': ' + label + ': block ' + (bi + 1) + ' has no rows'); return; }
          rows.forEach(function (row, ri) {
            const where = label + ' block ' + (bi + 1) + ' row ' + (ri + 1);
            if (!row || !Array.isArray(row.items) || !row.items.length) { bad.push(tab + ': ' + where + ' is empty'); return; }
            if (row.h !== undefined && !(row.h > 0)) bad.push(tab + ': ' + where + ' has a bad height');
            row.items.forEach(function (it) {
              claim(it.id, where);
              if (it.gate !== undefined && !(typeof it.gate === 'string' && /^[a-z][a-z0-9-]*$/.test(it.gate))) bad.push(tab + ': ' + where + ': ' + it.id + ' has a bad gate (a class name)');
              if (it.fluid) { if (it.w !== undefined || row.items.length > 1) bad.push(tab + ': ' + where + ': ' + it.id + ' is fluid but has a width or shares its row'); return; }
              if (!(it.w > 0)) bad.push(tab + ': ' + where + ': ' + it.id + ' has no width');
              if (it.wMin !== undefined && !(it.wMin > 0 && it.wMin <= it.w)) bad.push(tab + ': ' + where + ': ' + it.id + ' has a wMin above its w');
            });
            if (rowW(row.items) > sw) bad.push(tab + ': ' + where + ' is ' + rowW(row.items) + 'px wide, more than the ' + sw + 'px of a ' + S.designWidth + 'px phone');
            const fitsNarrow = rowW(row.items, 'min') <= swNarrow;
            if (row.wrap) {
              if (fitsNarrow) bad.push(tab + ': ' + where + ' is marked wrap but fits ' + swNarrow + 'px');
              if (row.items.some(function (it) { return (it.wMin || it.w) > swNarrow; })) bad.push(tab + ': ' + where + ' has an item wider than ' + swNarrow + 'px: wrapping cannot help');
            } else if (!fitsNarrow) bad.push(tab + ': ' + where + ' is ' + rowW(row.items, 'min') + 'px wide even with its narrow widths, more than the ' + swNarrow + 'px of a ' + S.narrowWidth + 'px phone, and does not wrap');
          });
        });
      };
      (t.sheets || []).forEach(function (sid) {
        const sh = (cfg.sheets || {})[sid];
        if (!sh) { bad.push(tab + ': sheet ' + sid + ' is not defined'); return; }
        claim(sh.content, 'sheet ' + sid);
        if (htmlIds.has(sh.host)) bad.push(tab + ': sheet ' + sid + ': its host id ' + sh.host + ' is in index.html (a script makes the host)');
        if (!sh.label || typeof sh.label !== 'string') bad.push(tab + ': sheet ' + sid + ': no label');
        if (!sh.trigger || !sh.trigger.within || !sh.trigger.selector) bad.push(tab + ': sheet ' + sid + ': no trigger');
        else if (!known(sh.trigger.within)) bad.push(tab + ': sheet ' + sid + ': trigger container ' + sh.trigger.within + ' is unknown');
        if (!sh.open || !(sh.open.notHidden === true || typeof sh.open.hasClass === 'string')) bad.push(tab + ': sheet ' + sid + ': open must be { notHidden: true } or { hasClass }');
        checkSteppers(sh, 'sheet ' + sid, false);
        checkBlocks(sh, 'sheet ' + sid);
      });
      (t.overlays || []).forEach(function (oid) {
        const ov = (cfg.overlays || {})[oid];
        if (!ov) { bad.push(tab + ': overlay ' + oid + ' is not defined'); return; }
        claim(ov.content, 'overlay ' + oid);
        if (ov.blocks === undefined) bad.push(tab + ': overlay ' + oid + ': no blocks');
        checkBlocks(ov, 'overlay ' + oid);
        checkSteppers(ov, 'overlay ' + oid, true);
      });
      const tr = cfg.toolRows[t.toolRow];
      if (!tr) bad.push(tab + ': tool row ' + t.toolRow + ' is not defined');
      else {
        const ids = [].concat.apply([], tr.groups).concat(tr.end);
        ids.forEach(function (id) { claim(id, 'tool row'); });
        if (tr.sheet) { if (!known(tr.sheet.id)) bad.push(tab + ': sheet ' + tr.sheet.id + ' is not in index.html'); tr.sheet.items.concat(tr.sheet.settings || []).forEach(function (id) { claim(id, 'sheet'); }); }
        // the tool row at 375: n icons of --target, 4px inside a group, a 1px hairline with 8px margins between groups (and before the fixed end); 4px margins from 366px down
        // `icons`: an element that holds several icons (a radiogroup wrapper) counts as that many, 4px apart
        const icons = id => (tr.icons && tr.icons[id]) || 1;
        const n = ids.reduce((a, id) => a + icons(id), 0), gaps = tr.groups.reduce((a, g) => a + (g.length - 1) + g.reduce((b, id) => b + icons(id) - 1, 0), 0), seps = tr.groups.length;   // seps: between the groups + before the end = groups.length
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
            if (it.sep) {   // a hairline the engine makes: a width, no id
              if (it.id || !(it.w > 0)) bad.push(tab + '/' + sid + ': a separator has a width and no id');
              return;
            }
            claim(it.id, sid + ' row ' + (i + 1));
            (it.also || []).forEach(function (id) { claim(id, sid + ' row ' + (i + 1)); });
            if (it.fluid ? it.w !== undefined || sharesRow(row) : !(it.w > 0)) bad.push(tab + '/' + sid + ': ' + it.id + (it.fluid ? ' is fluid but has a width or shares its row' : ' has no width'));
            if (it.wMin !== undefined && !(it.wMin > 0 && it.wMin <= it.w)) bad.push(tab + '/' + sid + ': ' + it.id + ' has a wMin above its w');
          });
          const span = Math.max.apply(null, row.items.map(it => it.h || S.target));
          heightRows += span > S.target ? Math.round((span + S.rowGap) / (S.target + S.rowGap)) : 1;
          if (rowW(row.items) > avail) bad.push(tab + '/' + sid + ': row ' + (i + 1) + ' is ' + rowW(row.items) + 'px wide, more than the ' + avail + 'px of a ' + S.designWidth + 'px phone');
          if (row.scroll) { if (rowW(row.items, 'min') <= availNarrow) bad.push(tab + '/' + sid + ': row ' + (i + 1) + ' is marked scroll but fits ' + availNarrow + 'px'); }
          else if (rowW(row.items, 'min') > availNarrow) bad.push(tab + '/' + sid + ': row ' + (i + 1) + ' is ' + rowW(row.items, 'min') + 'px wide even with its narrow widths, more than the ' + availNarrow + 'px of a ' + S.narrowWidth + 'px phone');
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
          if (!it.id) return;
          if (definedIn[it.id] && definedIn[it.id] !== sid) bad.push('control ' + it.id + ' is defined by two sub-tabs (' + definedIn[it.id] + ', ' + sid + '): a shared sub-tab is defined once and listed by every tab');
          definedIn[it.id] = sid;
        });
      });
    });
    Object.keys(cfg.afterShow || {}).forEach(function (id) { if (!known(id)) bad.push('afterShow: id ' + id + ' is unknown'); });
    Object.keys(cfg.follow || {}).forEach(function (id) {
      const f = followSpec(cfg.follow[id]);
      if (!known(id) || !known(f.of)) bad.push('follow: ' + id + ' or ' + f.of + ' is unknown');
      else if (id === f.of) bad.push('follow: ' + id + ' follows itself');
      if (f.mode !== 'hide' && f.mode !== 'disable') bad.push('follow: ' + id + ' has the unknown mode ' + f.mode);
      if (f.mode === 'disable' && !(typeof f.reason === 'string' && f.reason.trim())) bad.push('follow: ' + id + ' is disabled but has no reason');
    });
    Object.keys(cfg.toolRows).forEach(function (name) {   // labels: the name a control has while the tool row is on; the control must be in that row
      const tr = cfg.toolRows[name], inRow = [].concat.apply([], tr.groups).concat(tr.end);
      Object.keys(tr.labels || {}).forEach(function (id) {
        const l = tr.labels[id];
        if (inRow.indexOf(id) < 0) bad.push('toolRows.' + name + '.labels: ' + id + ' is not in that tool row');
        if (!l || typeof l.text !== 'string' || !l.text.trim()) bad.push('toolRows.' + name + '.labels: ' + id + ' has no text');
        if (!l || typeof l.i18n !== 'string' || !l.i18n) bad.push('toolRows.' + name + '.labels: ' + id + ' has no data-i18n key');
      });
    });
    return bad;
  }

  // The height of a sheet made of blocks (padding 16 + the blocks 16 apart + 16 padding), by the design widths: rows of --target with 8px gaps, a row whose items are all in `hide` (ids) is gone, a block with no row too;
  // narrow: the 320px phone (narrow widths, a wrap row breaks into lines). Returns null for a sheet without blocks.
  function sheetHeight(cfg, sid, opts) {
    const sh = (cfg.sheets || {})[sid] || (cfg.overlays || {})[sid], S = cfg.sizes, hide = (opts && opts.hide) || [], narrow = !!(opts && opts.narrow), gates = (opts && opts.gates) || [];
    const off = function (it) { return hide.indexOf(it.id) >= 0 || (it.gate !== undefined && gates.indexOf(it.gate) < 0); };   // hidden by the caller, or behind a gate that is not open
    if (!sh || !sh.blocks) return null;
    const avail = (narrow ? S.narrowWidth : S.designWidth) - 2 * S.gutter;
    const blockH = sh.blocks.map(function (rows) {
      const hs = rows.filter(function (row) { return row.items.some(function (it) { return !off(it); }); }).map(function (row) {
        const items = row.items.filter(function (it) { return !off(it); });
        let lines = 1, x = 0;
        if (narrow && row.wrap) { items.forEach(function (it, i) { const w = it.wMin || it.w; if (i && x + S.rowGap + w > avail) { lines++; x = w; } else x += (i ? S.rowGap : 0) + w; }); }
        return lines * (row.h || S.target) + (lines - 1) * S.rowGap;
      });
      return hs.length ? hs.reduce(function (a, h) { return a + h; }, 0) + (hs.length - 1) * S.rowGap : 0;
    }).filter(function (h) { return h > 0; });
    return 2 * S.gutter + blockH.reduce(function (a, h) { return a + h; }, 0) + Math.max(0, blockH.length - 1) * S.gutter;
  }

  const api = { config: config, validate: validate, sheetHeight: sheetHeight, followSpec: followSpec, chromeH: function (cfg, tab) { const S = cfg.sizes; return S.header + S.gap + S.toolRow + S.subtabs + S.gap + cfg.tabs[tab].panelH; } };
  root.PHONE_CONFIG = config;
  root.PHONE_CONFIG_API = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
