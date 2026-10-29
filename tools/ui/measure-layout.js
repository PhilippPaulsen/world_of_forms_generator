/*
 * Layout measurement for the UI rework (Phase 1 onward).
 *
 * A console script, not a Node test: paste it into the browser console of a
 * FRESHLY LOADED index.html (or inject it with a browser tool), at the
 * viewport width to be measured (the UI rework uses 375 / 768 / 1100 / 1440).
 * It clicks the real buttons with real mouse events and reports where the
 * main elements are after each step, so a before/after comparison shows
 * exactly which controls moved.
 *
 *   await measureLayout()            -> JSON string (also logged)
 *   await measureLayout({ raw: true }) -> the object
 *
 * Every rect is [x, y, w, h] in DOCUMENT coordinates (y includes the scroll
 * offset), rounded to whole pixels; null = the element does not exist or is
 * hidden (display:none gives a 0x0 box, reported as null).
 *
 * Scenarios, in this order (the last one leaves a layer and a keyframe in
 * the session, so reload before measuring again):
 *   start               untouched page (the tab in the URL hash is the measured one: #form, #netz, #farbe)
 *   shape_switch        square, hexagon, triangle again
 *   square_sin_field    the net chapter: square, the Netz tab (netz_row), Sinus (+ the Field default) and one
 *                       strength step (square_sin_field), the Netz "Mehr" overlay open (more_netz_open), back to
 *                       Aus and to the tab the page started in. `found` says which controls the script found. Since commit 4a of the sheets redesign the overlay is also
 *                       measured in four more states (more_netz_sin_tiled_focus, more_netz_geo_tiled, more_netz_geo_single, more_netz_geo_macro) and the controls inside it are tracked.
 *   face_trails         the trails chapter (patterns commit C0b-5): the Farbe tab, a triangle of three lines (two face trails) and Fill on (trails_fill_on): the Face Colors group and, at 768px and up, its
 *                       chip view (nine more selectors, TRACKED_TRAILS, tracked in this one snapshot only); put back afterwards
 *   layer_timeline      a new layer (it becomes active), "Add to Timeline", and the same again:
 *                       two keyframes, so Play and the scrub bar are measured too. Since the
 *                       cleanup (step B) these two actions go through window.layerApi (add(),
 *                       addToTimeline()), the functions the table, the rail, the strip and the
 *                       diamonds call - the old hidden #btn-add-layer / #btn-add-to-timeline are
 *                       only the FALLBACK of a tree that has no layerApi. The same state results.
 *   timeline_more       the timeline strip's "Mehr" opened (real clicks) and closed again
 *   layer_more          the layer "Mehr" opened (layerApi.toggleMore) and closed again
 *   plus_probe          ONE REAL click on the visible "+" of the current view (the table, the rail
 *                       or the strip: whichever has a rect); `probe` says which element it was
 *   notice              a notice showing (UI.notify, key "baseline"), so #ui-notices has a rect. It is the ONLY snapshot taken with a notice on screen: every other one is preceded
 *                       by UI.hideToast() and one frame, and #ui-notices and its children are measured in VIEWPORT coordinates (they are position: fixed: a document rect would
 *                       follow the scroll offset of the moment). Two recordings of the same tree give the same result (tools/ui/compare-baseline.js: 0 differences).
 *   dom_present         which old and kept selectors exist in the DOM (a hidden element has no
 *                       rect, so the rects cannot show that it is gone; this does)
 *   pointer             what the page's pointer media features say (coarse / fine / hover) and the
 *                       value of --target: the file proves how it was recorded
 *
 * Per snapshot: the tracked elements, scrollWidth vs clientWidth, the
 * document height, and the elements extending beyond the viewport's left or
 * right edge (up to 10). `canvasTop` is the canvas container's y; a
 * negative value means content is cut off at the top.
 *
 * Element ids are looked up by selector; extend TRACKED below when a new
 * layout lands. Read-only apart from the clicks above; no app code touched.
 */
(function () {
  const TRACKED = [
    '#canvas-container',
    '#shape-size-input',
    '#node-count-input',
    '#btn-toggle-nodes',
    '#btn-clear',
    '#btn-add-layer',
    '#btn-save',
    '#btn-help',
    // the Form row's symmetry toggles and the Mehr button next to them (patterns commit 9: first tracked here; cleanup-3 does not have them)
    '#nav-symmetry', '#btn-sym-rotation', '#btn-sym-mirror', '#btn-more-form', '#more-form',
    // the canvas rail (rail rearrangement, commits 1 to 3): one element of each group, the links, the Mehr trigger and its popover
    '#btn-undo',
    '#btn-random',
    '#btn-toggle-faces',
    '#btn-more-rail',
    '#btn-gallery',
    '#btn-farborgel',
    '#btn-paste-pattern',
    '#btn-info',
    '#more-rail',
    // needed to see the layer/timeline scenario (the OLD hidden controls: null at every width while they are hidden)
    '#btn-add-to-timeline',
    '#btn-timeline-play',
    // the layer table, rail and strip (ui-layers.js; ONE shows per width, the others are display: none = null), their key children, the timeline strip (ui-timeline.js) and the notices (ui.js)
    '#layer-table', '#layer-rail', '#layer-strip', '#timeline-strip', '#ui-notices', '#ui-notices .notice',
    '#layer-table [data-key="chip:base"]', '#layer-table [data-key="add"]', '#layer-table [data-key="more"]', '#layer-table [data-key^="dia:"]',
    '#layer-rail [data-key="chip:base"]', '#layer-rail [data-key="add"]', '#layer-rail [data-key="more"]', '#layer-rail [data-key^="dia:"]',
    '#layer-strip [data-key="chip:base"]', '#layer-strip [data-key="add"]', '#layer-strip [data-key="more"]', '#layer-strip [data-key^="dia:"]',
    '#timeline-strip .ts-play', '#timeline-strip .ts-range', '#timeline-strip .ts-net', '#timeline-strip .ts-more',
    '#timeline-group', '#layer-more-panel',
    // the net chapter: the Netz row (kind buttons, strength stepper, its Mehr trigger) and its overlay; #net-group is the (hidden) control group inside the overlay
    '#nav-netz',
    '#net-strength-value',
    '#btn-more-netz',
    '#more-netz',
    '#net-group',
    // commit 4a of the sheets redesign (baseline-cleanup-3.json): the controls INSIDE the Netz overlay - the exact fields, the domain row and its three buttons, the macro row and its first three buttons, the Alternate
    // wrapper and button, Reverse, Net lines, the axes row, the Fokus row, the readout line (absent in a tree before 4a: null). Selectors that exist in both trees (class and data attributes, no new ids).
    '#net-strength-exact', '#net-focus-exact', '#net-axes-row', '#net-focus-row', '#net-domain-row',
    '.net-domain-btn[data-domain="single"]', '.net-domain-btn[data-domain="tiled"]', '.net-domain-btn[data-domain="field"]',
    '#net-macro-row', '#net-macro-buttons', '#net-macro-buttons button:nth-child(1)', '#net-macro-buttons button:nth-child(2)', '#net-macro-buttons button:nth-child(3)',
    '#net-geo-row', '#net-alternate-btn', '#net-reverse-btn', '#net-lines-btn', '#net-readout',
  ];

  // patterns commit C0b-5 (baseline-cleanup-7.json): the Face Colors group (shown by sketch.js while the active sheet's Fill is on) and, at 768px and up, the chip view that takes its place: the row host the engine
  // makes, the chip bar, the first chip, the stepper row, its two buttons, the n/N display and the label. Tracked ONLY in the snapshots of the trails chapter (face_trails): in every other state they would be null
  // (a recording of an earlier tree has no face_trails and none of these), and the file stays under 1 MB.
  const TRACKED_TRAILS = [
    '#face-colors-group', '#sr-trails-host', '#ph-trail-chips', '#ph-trail-chips .ph-chip:nth-child(1)', '#ph-trail-stepper', '#ph-trail-stepper .ph-trail-prev', '#ph-trail-stepper .ph-trail-next', '#ph-trail-stepper .ph-trail-count', '#ph-trail-stepper .ph-trail-label',
  ];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function rect(el) {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) return null;
    return [Math.round(b.x), Math.round(b.y + window.scrollY), Math.round(b.width), Math.round(b.height)];
  }

  // A rect in VIEWPORT coordinates (no scroll offset): for the position: fixed notices, whose document rect follows the scroll position of the moment.
  function rectViewport(el) {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) return null;
    return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)];
  }

  function click(el) {
    for (const t of ['mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
    }
  }

  // a real click: what a mouse does (detail 1), unlike click() above (detail 0, which the keyboard bridge reads as Enter / Space)
  function realClick(el) {
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const C = /^pointer/.test(t) && typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
      el.dispatchEvent(new C(t, { bubbles: true, cancelable: true, view: window, detail: 1, button: 0, pointerType: 'mouse' }));
    }
  }

  // the selectors whose PRESENCE in the DOM is recorded (dom_present): the old layer row and timeline controls, the old toggles and the message spans (all hidden, so their rects are null)
  // and the kept ones next to them. A later deletion shows up here as true -> false.
  const PRESENT = [
    '#layer-row-group', '#layer-row', '#btn-layer-base', '#layer-tabs', '#btn-add-layer', '#paste-pattern-status',
    '#layer-more-row', '#btn-more-layer', '#layer-more-panel', '#layer-node-count-note', '#align-to-base-status',
    '#timeline-group', '#btn-add-to-timeline', '#btn-timeline-include-net', '#btn-remove-timeline', '#btn-clear-timeline',
    '#timeline-playback-controls', '#btn-timeline-play', '#timeline-progress-input', '#timeline-net-warning', '#timeline-net-state',
    '#timeline-keyframe-list', '#timeline-pairing', '#timeline-status',
    '#net-free-note', '#net-field-note', '#net-macro-note', '#net-field-info',
    '#layer-table', '#layer-rail', '#layer-strip', '#timeline-strip', '#ui-notices',
  ];

  function buttonByText(root, text) {
    if (!root) return null;
    return [...root.querySelectorAll('button')].find(
      (b) => b.textContent.trim().toLowerCase() === text.toLowerCase()
    ) || null;
  }

  function label(el) {
    return (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
  }

  function snap(withTrails) {
    const out = {};
    (withTrails ? TRACKED.concat(TRACKED_TRAILS) : TRACKED).forEach((sel) => { const el = document.querySelector(sel); out[sel] = sel.indexOf('#ui-notices') === 0 ? rectViewport(el) : rect(el); });
    const root = document.documentElement;
    out.scrollWidth = root.scrollWidth;
    out.clientWidth = root.clientWidth;
    out.docHeight = root.scrollHeight;
    out.canvasTop = out['#canvas-container'] ? out['#canvas-container'][1] : null;
    out.beyondViewport = [...document.querySelectorAll('body *')]
      .filter((e) => {
        const b = e.getBoundingClientRect();
        return (b.width > 0 || b.height > 0) && (b.right > root.clientWidth + 0.5 || b.left < -0.5);
      })
      .slice(0, 10)
      .map((e) => {
        const b = e.getBoundingClientRect();
        return label(e) + ' [' + Math.round(b.left) + '..' + Math.round(b.right) + ']';
      });
    return out;
  }

  // Every snapshot but the notice one is taken with NO notice showing: a notice that an earlier step raised (the net chapter's "Sin und Tan brauchen mindestens 4 Knoten" one) would still be
  // on screen in a fast recording and gone in a slow one. UI.hideToast() closes the non-sticky notices; one frame (or 80 ms where the page is hidden and no frame comes) lets the layout settle.
  async function snapQ(keepNotices, withTrails) {
    if (!keepNotices && window.UI && UI.hideToast) {
      UI.hideToast();
      await new Promise((r) => { let done = false; const fin = () => { if (!done) { done = true; r(); } }; if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fin); setTimeout(fin, 80); });
    }
    return snap(withTrails);
  }

  async function measureLayout(opts) {
    const wait = 300;
    const result = { viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
    const shapes = [...document.querySelectorAll('.shape-icon-btn')];
    const nav = window.uiNav || null;                       // nav.js: the tab the page was loaded in (#form, #netz, #farbe) is the one measured, the net chapter visits Netz and comes back
    const startTab = nav ? nav.current() : null;
    result.tab = startTab;

    result.start = await snapQ();

    const shape_switch = {};
    click(shapes[1]); await sleep(wait); shape_switch.square = await snapQ();
    click(shapes[2]); await sleep(wait); shape_switch.hex = await snapQ();
    click(shapes[0]); await sleep(wait); shape_switch.triangle = await snapQ();
    result.shape_switch = shape_switch;

    // The net chapter. The net applies to the SQUARE on the BASE sheet. The Netz row (#nav-netz) holds the kind buttons (.net-kind-btn[data-kind]), the strength stepper (#net-strength-value
    // and its two chevrons) and the Mehr trigger (#btn-more-netz); everything else (Single / Tiled / Field, Macro, Focus, exact values) is in the overlay #more-netz. Switching a kind on applies
    // the defaults (both axes, Field), so a Sinus click is enough for the "square + Sinus + Field" state. The chapter visits the Netz tab, measures the row, the strength step and the opened
    // overlay, switches the net back off and returns to the tab the page started in.
    const net = {};
    click(shapes[1]); await sleep(wait);
    if (nav) { nav.show('netz'); await sleep(wait); }
    net.netz_row = await snapQ();
    const sinBtn = document.querySelector('#nav-netz .net-kind-btn[data-kind="sinus"]');
    if (sinBtn) { click(sinBtn); await sleep(wait); }
    const strUp = document.querySelector('#nav-netz .stepper-btn[data-dir="1"]');
    if (strUp) { click(strUp); await sleep(wait); }
    net.square_sin_field = await snapQ();
    const moreNetz = document.querySelector('#btn-more-netz');
    if (moreNetz) {
      click(moreNetz); await sleep(wait); net.more_netz_open = await snapQ();   // Sinus + Field
      // commit 4a: the controls inside the overlay in four more states (the overlay stays open: only mousedown events, no pointerdown outside it): Sin + Tiled with a focus (Alternate shows),
      // Geo + Tiled, Geo + Single, and Geo + Single with seven nodes (E = 6: the macro row shows). The state is put back afterwards (Field, focus 0, the node count it had).
      const dBtn = (d) => document.querySelector('.net-domain-btn[data-domain="' + d + '"]');
      const kBtn = (k) => document.querySelector('#nav-netz .net-kind-btn[data-kind="' + k + '"]');
      const md = (el) => { if (el) el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })); };
      const setFocus = async (v) => { const f = document.querySelector('#net-focus-exact'); if (f) { f.value = v; f.dispatchEvent(new Event('change', { bubbles: true })); await sleep(wait); } };
      md(dBtn('tiled')); await sleep(wait); await setFocus('0.30');
      net.more_netz_sin_tiled_focus = await snapQ();
      await setFocus('0.00');
      md(kBtn('geometric')); await sleep(wait); net.more_netz_geo_tiled = await snapQ();
      md(dBtn('single')); await sleep(wait); net.more_netz_geo_single = await snapQ();
      const nodeIn = document.querySelector('#node-count-input'), nodeWas = nodeIn ? nodeIn.value : null;
      if (nodeIn) {
        nodeIn.value = '7'; nodeIn.dispatchEvent(new Event('input', { bubbles: true })); await sleep(wait * 2);
        net.more_netz_geo_macro = await snapQ();
        nodeIn.value = nodeWas; nodeIn.dispatchEvent(new Event('input', { bubbles: true })); await sleep(wait);
      }
      md(kBtn('sinus')); await sleep(wait); md(dBtn('field')); await sleep(wait);
      click(moreNetz); await sleep(wait);
    }
    net.found = {
      sin: !!sinBtn, strengthUp: !!strUp, moreNetz: !!moreNetz,
      sinusActive: !!(sinBtn && sinBtn.classList.contains('active')),
      fieldActive: !!document.querySelector('#net-field-btn.active'),
      strengthText: (document.querySelector('#net-strength-value') || {}).textContent || null,
    };
    const offBtn = document.querySelector('#nav-netz .net-kind-btn[data-kind="regular"]');
    if (offBtn) { click(offBtn); await sleep(wait); }
    if (nav && startTab) { nav.show(startTab); await sleep(wait); }
    click(shapes[0]); await sleep(wait);
    result.square_sin_field = net;

    // The trails chapter (patterns commit C0b-5). The Farbe tab, the base sheet with a triangle of three lines (two face trails) and Fill on: the Face Colors group is shown (sketch.js) and, with the trails surface applied
    // at 768px and up, holds the chip bar and the stepper row (trails_fill_on). Everything is put back afterwards (Fill as it was, the three lines removed) and the page returns to the tab it started in.
    const ft = {};
    const fillBtn = document.querySelector('#btn-toggle-faces');
    if (typeof activeNodes === 'function' && typeof activeConnections === 'function' && fillBtn) {
      const fnodes = activeNodes(), fconns = activeConnections();
      if (nav) { nav.show('farbe'); await sleep(wait); }
      if (fnodes.length >= 3) {
        const ids = fnodes.map((n) => n.id), n0 = fconns.length;
        fconns.push([ids[0], ids[1]]); fconns.push([ids[1], ids[2]]); fconns.push([ids[2], ids[0]]);
        if (typeof redraw === 'function') redraw();
        await sleep(wait);
        const fillWas = fillBtn.classList.contains('active');
        if (!fillWas) { click(fillBtn); await sleep(wait * 3); }
        ft.trails_fill_on = await snapQ(false, true);
        if (!fillWas) { click(fillBtn); await sleep(wait); }
        fconns.length = n0;
        if (typeof redraw === 'function') redraw();
        await sleep(wait);
      }
      if (nav && startTab) { nav.show(startTab); await sleep(wait); }
    }
    result.face_trails = ft;

    // Two keyframes, so the playback controls (Play, progress) appear too.
    // Each keyframe is a new layer that is active when "Add to Timeline"
    // is clicked. A timeline needs at least one line per layer ("Line
    // count mismatch ... counts must match" otherwise, even for 0 = 0), so
    // each new layer first gets the same line: two real clicks on fixed
    // nodes (deterministic, unlike the random-connection button).
    const lt = {};
    // the actions go through window.layerApi (the table, the rail, the strip and the diamonds call it); a tree without layerApi falls back to the old hidden buttons
    const api = window.layerApi && window.layerApi.add && window.layerApi.addToTimeline ? window.layerApi : null;
    const oldAddLayer = document.querySelector('#btn-add-layer');
    const oldAddToTimeline = document.querySelector('#btn-add-to-timeline');
    const addLayer = api ? { api: true } : oldAddLayer, addToTimeline = api ? { api: true } : oldAddToTimeline;
    const doAddLayer = () => { if (api) api.add(); else click(oldAddLayer); };
    const doAddToTimeline = () => { if (api) api.addToTimeline(); else click(oldAddToTimeline); };
    const canvas = document.querySelector('#canvas-container canvas');
    async function clickNode(n) {
      const r = canvas.getBoundingClientRect();
      const s = r.width / width; // p5 global: canvas width in sketch units
      const opts = { bubbles: true, cancelable: true, view: window, button: 0,
                     clientX: r.left + n.x * s, clientY: r.top + n.y * s };
      canvas.dispatchEvent(new MouseEvent('mousemove', opts)); await sleep(30);
      canvas.dispatchEvent(new MouseEvent('mousedown', opts));
      canvas.dispatchEvent(new MouseEvent('mouseup', opts));
      canvas.dispatchEvent(new MouseEvent('click', opts));
      await sleep(80);
    }
    async function drawLine() {
      if (typeof nodes === 'undefined' || typeof width === 'undefined' || !canvas || nodes.length < 4) return;
      await clickNode(nodes[0]); await clickNode(nodes[3]);
    }
    if (addLayer) { doAddLayer(); await sleep(wait); }
    await drawLine();
    lt.layer_1_added = await snapQ();
    if (addToTimeline) { doAddToTimeline(); await sleep(wait); }
    lt.timeline_1_keyframe = await snapQ();
    if (addLayer) { doAddLayer(); await sleep(wait); }
    await drawLine();
    lt.layer_2_added = await snapQ();
    if (addToTimeline) { doAddToTimeline(); await sleep(wait); }
    lt.timeline_2_keyframes = await snapQ();
    const st = document.querySelector('#timeline-status');
    lt.timelineStatus = st ? st.textContent : null; // non-empty = the second keyframe was refused
    result.layer_timeline = lt;
    result.actions_via = api ? 'layerApi' : 'old hidden buttons';

    // the timeline strip's "Mehr" (real clicks): opens the old #timeline-group (the keyframe list, the net status, the pairing editor, the status line, "Zeitleiste entfernen"); closed again after
    const tsMore = document.querySelector('#timeline-strip .ts-more');
    if (tsMore) { realClick(tsMore); await sleep(wait); result.timeline_more = await snapQ(); realClick(tsMore); await sleep(wait); }
    // the layer "Mehr" of the active layer (a layer is active now): opened and closed again
    if (api && api.toggleMore) { api.toggleMore(); await sleep(wait); result.layer_more = await snapQ(); api.toggleMore(); await sleep(wait); }
    // ONE real click on the visible "+" of the current view (a third layer): which element it was is in `probe`
    {
      let probeBtn = null, probeView = null;
      for (const v of ['#layer-table', '#layer-rail', '#layer-strip']) { const b = document.querySelector(v + ' [data-key="add"]'); if (b && rect(b)) { probeBtn = b; probeView = v; break; } }
      const n0 = typeof additionalLayers !== 'undefined' ? additionalLayers.length : null;
      if (probeBtn) { realClick(probeBtn); await sleep(wait); }
      const n1 = typeof additionalLayers !== 'undefined' ? additionalLayers.length : null;
      result.probe = { view: probeView, selector: probeView ? probeView + ' [data-key="add"]' : null, ariaLabel: probeBtn ? probeBtn.getAttribute('aria-label') : null, layersBefore: n0, layersAfter: n1, added: n0 !== null && n1 === n0 + 1 };
      result.plus_probe = await snapQ();
    }
    // a notice showing, so #ui-notices has a rect (a refusal-length text: the notice has its close button)
    if (window.UI && UI.notify) {
      UI.notify('Off while a net transform is active. Set the net back to Regular (Base sheet, square) to use curves again.', { key: 'baseline', kind: 'warn' });
      await sleep(150); result.notice = await snapQ(true);
      UI.notifyClear('baseline'); await sleep(wait);
    }
    result.dom_present = {}; PRESENT.forEach((sel) => { result.dom_present[sel] = !!document.querySelector(sel); });
    result.pointer = {
      coarse: matchMedia('(pointer: coarse)').matches, fine: matchMedia('(pointer: fine)').matches, hover: matchMedia('(hover: hover)').matches, anyCoarse: matchMedia('(any-pointer: coarse)').matches,
      target: getComputedStyle(document.documentElement).getPropertyValue('--target').trim(), innerWidth: window.innerWidth,
    };

    const text = JSON.stringify(result);
    if (!(opts && opts.raw)) console.log(text);
    return opts && opts.raw ? result : text;
  }

  window.measureLayout = measureLayout;
})();
