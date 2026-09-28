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
    out.ok = out.maxErrMouse <= out.tolerance + 0.01 &&
             (!canTouch || out.maxErrTouch <= out.tolerance + 0.01) && out.hit.ok;
    const text = JSON.stringify(out);
    if (!(opts && opts.raw)) console.log(text);
    return opts && opts.raw ? out : text;
  }

  window.checkPointerMapping = checkPointerMapping;
})();
