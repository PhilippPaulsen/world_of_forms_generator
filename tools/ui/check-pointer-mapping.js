/*
 * Pointer-to-sketch coordinate check (UI rework, Phase 1 step 3 onward).
 *
 * Console script for a freshly loaded index.html, at the viewport width to
 * be checked. The canvas is 600x600 sketch units (canvasW) but is scaled by
 * CSS, so this verifies that a pointer at a known screen position becomes
 * the intended sketch position, for the mouse and for touch, and that
 * clicking a node really selects it.
 *
 *   await checkPointerMapping()   -> JSON string (also logged)
 *   await checkPointerMapping({ raw: true }) -> the object
 *
 * What it does, per probe point (canvas corners, centre, first and last
 * node): computes the client position from the canvas rect and scale,
 * dispatches a mousemove and, if the browser has Touch/TouchEvent, a
 * touchmove (neither presses anything), and reads p5's mouseX/mouseY (and
 * touches[0]) back. `err*` are the differences to the intended sketch
 * position in sketch units; they should be within 1 screen pixel (see
 * `tolerance`).
 *
 * Then a hit test through the real click path: mousedown+mouseup on
 * nodes[0] and nodes[3] must add a connection [nodes[0].id, nodes[3].id];
 * the connection is undone again afterwards. `hitRadiusScreenPx` is the
 * node hit radius (18 sketch units, sketch.js mousePressed()) as it
 * appears on screen at the current scale.
 *
 * Edge nodes: for each shape at Shape Size 1 (the grid then reaches the
 * canvas border) every node in the first/last row and column is clicked
 * for real; `edge.<shape>` reports how many were hit, the misses, and
 * `offCanvas` (edge nodes that lie outside the canvas - the hexagon at
 * Shape Size 1 - which cannot be clicked and are not counted as misses).
 * checkPointerMapping({ edges: false }) skips this; the shape and size it
 * changed are restored afterwards.
 *
 * Touch events are synthetic: this checks p5's coordinate mapping for
 * touches, NOT that a real phone delivers touch-then-mouse events only
 * once (that needs a real device).
 */
(function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const HIT_RADIUS = 18; // sketch.js mousePressed(): dist(...) < 18

  async function checkPointerMapping(opts) {
    const cv = document.querySelector('#canvas-container canvas');
    const out = { viewportWidth: window.innerWidth, ok: true };
    if (!cv || typeof width === 'undefined' || typeof nodes === 'undefined') {
      out.ok = false; out.error = 'canvas, width or nodes not available';
      return opts && opts.raw ? out : JSON.stringify(out);
    }
    const rect = cv.getBoundingClientRect();
    const sx = rect.width / width;
    const sy = rect.height / height;
    out.canvasCssSize = [Math.round(rect.width * 100) / 100, Math.round(rect.height * 100) / 100];
    out.sketchSize = [width, height];
    out.scale = Math.round(sx * 1000) / 1000;
    out.hitRadiusScreenPx = Math.round(HIT_RADIUS * sx * 10) / 10;

    const first = nodes[0], last = nodes[nodes.length - 1];
    const probes = [
      ['top-left', 0, 0],
      ['centre', width / 2, height / 2],
      ['bottom-right', width - 1, height - 1],
      ['first-node', first.x, first.y],
      ['last-node', last.x, last.y],
    ];
    const canTouch = typeof Touch === 'function' && typeof TouchEvent === 'function';
    out.touchApi = canTouch;
    out.probes = [];
    for (const [name, px, py] of probes) {
      const cx = rect.left + px * sx, cy = rect.top + py * sy;
      const o = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy };
      cv.dispatchEvent(new MouseEvent('mousemove', o)); await sleep(20);
      const row = { name, want: [Math.round(px * 100) / 100, Math.round(py * 100) / 100],
                    mouse: [Math.round(mouseX * 100) / 100, Math.round(mouseY * 100) / 100] };
      row.errMouse = Math.round(Math.max(Math.abs(mouseX - px), Math.abs(mouseY - py)) * 1000) / 1000;
      if (canTouch) {
        const t = new Touch({ identifier: 1, target: cv, clientX: cx, clientY: cy });
        cv.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true,
          touches: [t], targetTouches: [t], changedTouches: [t] }));
        await sleep(20);
        const tp = (typeof touches !== 'undefined' && touches[0]) ? touches[0] : null;
        row.touch = tp ? [Math.round(tp.x * 100) / 100, Math.round(tp.y * 100) / 100] : null;
        row.errTouch = tp ? Math.round(Math.max(Math.abs(tp.x - px), Math.abs(tp.y - py)) * 1000) / 1000 : null;
        row.touchMouse = [Math.round(mouseX * 100) / 100, Math.round(mouseY * 100) / 100];
      }
      out.probes.push(row);
    }
    out.maxErrMouse = Math.max(...out.probes.map((p) => p.errMouse));
    out.maxErrTouch = canTouch ? Math.max(...out.probes.map((p) => (p.errTouch == null ? Infinity : p.errTouch))) : null;

    // Hit test through the real click path.
    async function clickAt(px, py) {
      const o = { bubbles: true, cancelable: true, view: window, button: 0,
                  clientX: rect.left + px * sx, clientY: rect.top + py * sy };
      cv.dispatchEvent(new MouseEvent('mousemove', o)); await sleep(30);
      cv.dispatchEvent(new MouseEvent('mousedown', o));
      cv.dispatchEvent(new MouseEvent('mouseup', o));
      cv.dispatchEvent(new MouseEvent('click', o));
      await sleep(80);
    }
    const a = nodes[0], b = nodes[Math.min(3, nodes.length - 1)];
    const before = connections.length;
    await clickAt(a.x, a.y); await clickAt(b.x, b.y);
    const conn = connections.length > before ? connections[connections.length - 1] : null;
    out.hit = { want: [a.id, b.id], got: conn ? conn.slice() : null,
                ok: !!conn && conn[0] === a.id && conn[1] === b.id };
    const undo = document.querySelector('#btn-undo');
    if (undo && conn) for (const t of ['mousedown', 'mouseup', 'click']) undo.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
    await sleep(60);
    out.hit.undone = connections.length === before;

    // MouseEvent.clientX/Y are whole numbers, so a mouse position can be up
    // to 1 screen pixel off the intended point: allow 1 px, expressed in
    // sketch units (1 / scale). Touch positions keep fractions.
    out.tolerance = Math.round((1 / sx) * 100) / 100;

    // Nodes at the edges. At Shape Size 1 the grid reaches the canvas
    // border, so this covers the first/last row and column of every shape.
    // Each edge node is clicked for real (first click = the edge node,
    // second = the node nearest the centre; the connection must contain
    // both ids), then undone. Reported per shape: how many edge nodes were
    // hit, and for the misses the node, its position and where p5 put the
    // pointer.
    if (!(opts && opts.edges === false)) {
      out.edge = {};
      const sizeInput = document.querySelector('#shape-size-input');
      const shapeBtns = [...document.querySelectorAll('.shape-icon-btn')];
      const setSize = async (v) => {
        sizeInput.value = String(v);
        sizeInput.dispatchEvent(new Event('input', { bubbles: true }));
        sizeInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(200);
      };
      const originalSize = sizeInput ? sizeInput.value : null;
      const originalShape = shapeBtns.findIndex((b) => b.classList.contains('active'));
      const btnClick = (el) => { for (const t of ['mousedown', 'mouseup', 'click']) el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })); };
      for (const [i, name] of [[0, 'triangle'], [1, 'square'], [2, 'hex']]) {
        if (!shapeBtns[i] || !sizeInput) continue;
        btnClick(shapeBtns[i]); await sleep(250);
        await setSize(1);
        const ns = nodes.slice();
        const eps = 1e-6;
        const minX = Math.min(...ns.map((n) => n.x)), maxX = Math.max(...ns.map((n) => n.x));
        const minY = Math.min(...ns.map((n) => n.y)), maxY = Math.max(...ns.map((n) => n.y));
        const sets = { firstRow: ns.filter((n) => n.y - minY < eps), lastRow: ns.filter((n) => maxY - n.y < eps),
                       firstCol: ns.filter((n) => n.x - minX < eps), lastCol: ns.filter((n) => maxX - n.x < eps) };
        const allEdge = [...new Map(Object.values(sets).flat().map((n) => [n.id, n])).values()];
        // A node outside the canvas (the hexagon at Shape Size 1 reaches
        // x = -46..646 on a 0..600 canvas) has nothing to click on, and
        // mousePressed() drops pointers outside the canvas: reported
        // separately, not counted as a miss.
        const onCanvas = (n) => n.x >= 0 && n.x <= width && n.y >= 0 && n.y <= height;
        const edgeNodes = allEdge.filter(onCanvas);
        const offCanvas = allEdge.filter((n) => !onCanvas(n)).map((n) => ({ id: n.id, at: [Math.round(n.x * 100) / 100, Math.round(n.y * 100) / 100] }));
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const centre = ns.filter((n) => !edgeNodes.includes(n)).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0] || ns[0];
        const r2 = cv.getBoundingClientRect();
        const s2 = r2.width / width;
        const click2 = async (px, py) => {
          const o = { bubbles: true, cancelable: true, view: window, button: 0, clientX: r2.left + px * s2, clientY: r2.top + py * s2 };
          cv.dispatchEvent(new MouseEvent('mousemove', o)); await sleep(30);
          const seen = [mouseX, mouseY];
          cv.dispatchEvent(new MouseEvent('mousedown', o)); cv.dispatchEvent(new MouseEvent('mouseup', o)); cv.dispatchEvent(new MouseEvent('click', o));
          await sleep(80);
          return seen;
        };
        let hit = 0; const misses = []; let maxErr = 0;
        for (const e of edgeNodes) {
          const before = connections.length;
          const seen = await click2(e.x, e.y); await click2(centre.x, centre.y);
          const last = connections.length > before ? connections[connections.length - 1] : null;
          const ok = !!last && last.indexOf(e.id) >= 0 && last.indexOf(centre.id) >= 0;
          const err = Math.max(Math.abs(seen[0] - e.x), Math.abs(seen[1] - e.y)); if (err > maxErr) maxErr = err;
          if (ok) hit++; else misses.push({ id: e.id, at: [Math.round(e.x * 100) / 100, Math.round(e.y * 100) / 100], pointer: [Math.round(seen[0] * 100) / 100, Math.round(seen[1] * 100) / 100] });
          if (last) { btnClick(document.querySelector('#btn-undo')); await sleep(60); }
          else if (connections.length && connections[connections.length - 1].length === 1) { btnClick(document.querySelector('#btn-undo')); await sleep(60); }
        }
        out.edge[name] = { size: 1, nodes: ns.length, edgeNodes: edgeNodes.length,
                           rows_cols: { firstRow: sets.firstRow.length, lastRow: sets.lastRow.length, firstCol: sets.firstCol.length, lastCol: sets.lastCol.length },
                           extent: [[Math.round(minX * 10) / 10, Math.round(minY * 10) / 10], [Math.round(maxX * 10) / 10, Math.round(maxY * 10) / 10]],
                           hit, misses, offCanvas, maxPointerErr: Math.round(maxErr * 100) / 100 };
      }
      // restore what the check changed
      if (sizeInput && originalSize !== null) await setSize(originalSize);
      if (originalShape >= 0 && shapeBtns[originalShape]) { btnClick(shapeBtns[originalShape]); await sleep(250); }
      out.edgeOk = Object.values(out.edge).every((e) => e.hit === e.edgeNodes);
    }

    out.ok = out.maxErrMouse <= out.tolerance + 0.01 &&
             (!canTouch || out.maxErrTouch <= out.tolerance + 0.01) && out.hit.ok &&
             (out.edgeOk === undefined || out.edgeOk);
    const text = JSON.stringify(out);
    if (!(opts && opts.raw)) console.log(text);
    return opts && opts.raw ? out : text;
  }

  window.checkPointerMapping = checkPointerMapping;
})();
