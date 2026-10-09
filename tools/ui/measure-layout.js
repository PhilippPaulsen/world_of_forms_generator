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
 *                       Aus and to the tab the page started in. `found` says which controls the script found.
 *   layer_timeline      "+ Layer" (new layer becomes active), "Add to
 *                       Timeline", and the same again: two keyframes, so
 *                       Play and the progress control are measured too
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
    // needed to see the layer/timeline scenario
    '#btn-add-to-timeline',
    '#btn-timeline-play',
    // the net chapter: the Netz row (kind buttons, strength stepper, its Mehr trigger) and its overlay; #net-group is the (hidden) control group inside the overlay
    '#nav-netz',
    '#net-strength-value',
    '#btn-more-netz',
    '#more-netz',
    '#net-group',
  ];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function rect(el) {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) return null;
    return [Math.round(b.x), Math.round(b.y + window.scrollY), Math.round(b.width), Math.round(b.height)];
  }

  function click(el) {
    for (const t of ['mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
    }
  }

  function buttonByText(root, text) {
    if (!root) return null;
    return [...root.querySelectorAll('button')].find(
      (b) => b.textContent.trim().toLowerCase() === text.toLowerCase()
    ) || null;
  }

  function label(el) {
    return (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
  }

  function snap() {
    const out = {};
    TRACKED.forEach((sel) => { out[sel] = rect(document.querySelector(sel)); });
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

  async function measureLayout(opts) {
    const wait = 300;
    const result = { viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
    const shapes = [...document.querySelectorAll('.shape-icon-btn')];
    const nav = window.uiNav || null;                       // nav.js: the tab the page was loaded in (#form, #netz, #farbe) is the one measured, the net chapter visits Netz and comes back
    const startTab = nav ? nav.current() : null;
    result.tab = startTab;

    result.start = snap();

    const shape_switch = {};
    click(shapes[1]); await sleep(wait); shape_switch.square = snap();
    click(shapes[2]); await sleep(wait); shape_switch.hex = snap();
    click(shapes[0]); await sleep(wait); shape_switch.triangle = snap();
    result.shape_switch = shape_switch;

    // The net chapter. The net applies to the SQUARE on the BASE sheet. The Netz row (#nav-netz) holds the kind buttons (.net-kind-btn[data-kind]), the strength stepper (#net-strength-value
    // and its two chevrons) and the Mehr trigger (#btn-more-netz); everything else (Single / Tiled / Field, Macro, Focus, exact values) is in the overlay #more-netz. Switching a kind on applies
    // the defaults (both axes, Field), so a Sinus click is enough for the "square + Sinus + Field" state. The chapter visits the Netz tab, measures the row, the strength step and the opened
    // overlay, switches the net back off and returns to the tab the page started in.
    const net = {};
    click(shapes[1]); await sleep(wait);
    if (nav) { nav.show('netz'); await sleep(wait); }
    net.netz_row = snap();
    const sinBtn = document.querySelector('#nav-netz .net-kind-btn[data-kind="sinus"]');
    if (sinBtn) { click(sinBtn); await sleep(wait); }
    const strUp = document.querySelector('#nav-netz .stepper-btn[data-dir="1"]');
    if (strUp) { click(strUp); await sleep(wait); }
    net.square_sin_field = snap();
    const moreNetz = document.querySelector('#btn-more-netz');
    if (moreNetz) { click(moreNetz); await sleep(wait); net.more_netz_open = snap(); click(moreNetz); await sleep(wait); }
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

    // Two keyframes, so the playback controls (Play, progress) appear too.
    // Each keyframe is a new layer that is active when "Add to Timeline"
    // is clicked. A timeline needs at least one line per layer ("Line
    // count mismatch ... counts must match" otherwise, even for 0 = 0), so
    // each new layer first gets the same line: two real clicks on fixed
    // nodes (deterministic, unlike the random-connection button).
    const lt = {};
    const addLayer = document.querySelector('#btn-add-layer');
    const addToTimeline = document.querySelector('#btn-add-to-timeline');
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
    if (addLayer) { click(addLayer); await sleep(wait); }
    await drawLine();
    lt.layer_1_added = snap();
    if (addToTimeline) { click(addToTimeline); await sleep(wait); }
    lt.timeline_1_keyframe = snap();
    if (addLayer) { click(addLayer); await sleep(wait); }
    await drawLine();
    lt.layer_2_added = snap();
    if (addToTimeline) { click(addToTimeline); await sleep(wait); }
    lt.timeline_2_keyframes = snap();
    const st = document.querySelector('#timeline-status');
    lt.timelineStatus = st ? st.textContent : null; // non-empty = the second keyframe was refused
    result.layer_timeline = lt;

    const text = JSON.stringify(result);
    if (!(opts && opts.raw)) console.log(text);
    return opts && opts.raw ? result : text;
  }

  window.measureLayout = measureLayout;
})();
