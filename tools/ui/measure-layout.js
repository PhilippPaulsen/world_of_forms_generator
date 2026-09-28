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
 *   start               untouched page
 *   shape_switch        square, hexagon, triangle again
 *   square_sin_field    square + Sinus + Field (the tallest net panel)
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
    // needed to see the layer/timeline scenario
    '#btn-add-to-timeline',
    '#btn-timeline-play',
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

    result.start = snap();

    const shape_switch = {};
    click(shapes[1]); await sleep(wait); shape_switch.square = snap();
    click(shapes[2]); await sleep(wait); shape_switch.hex = snap();
    click(shapes[0]); await sleep(wait); shape_switch.triangle = snap();
    result.shape_switch = shape_switch;

    const net = {};
    click(shapes[1]); await sleep(wait);
    const group = document.querySelector('#net-group');
    const sin = buttonByText(group, 'Sinus') || buttonByText(group, 'Sin');
    if (sin) { click(sin); await sleep(wait); }
    const field = buttonByText(group, 'Field');
    if (field) { click(field); await sleep(wait); }
    net.square_sin_field = snap();
    net.found = { sin: !!sin, field: !!field };
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
