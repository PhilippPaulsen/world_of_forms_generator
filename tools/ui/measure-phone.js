/*
 * Measures the PHONE layout of one tab (phone layout, commit 5): tooling, not part of the test suite (it needs a browser). The counterpart of tools/ui/measure-layout.js, which measures the layouts from
 * 768px up; this one is for html.ph (widths up to 767px). It is evaluated INSIDE a page of the viewport to measure (tools/ui/record-baseline.js recordPhone() loads an iframe of the exact size and
 * evaluates it there) and returns  { env, states }  for the tab the page was loaded in (#form, #farbe or #netz):
 *
 *   env      innerWidth / innerHeight, the pointer, html.className, the tab, the sub-tab labels, scalars: docScrollV, docScrollH (document height / width beyond the viewport), docHeight, canvasSide
 *            (the smaller side of #canvas-container), spare (the viewport height below the panel).
 *   states   { name: snapshot }, a snapshot = { '#selector': [x, y, w, h] | null, ...scalars }, rects in VIEWPORT pixels (the page does not scroll), rounded to 0.1; null = hidden or absent:
 *     base                 the header, its tab links and Help, the canvas, the tool row and each of its buttons, the sub-tab row and each sub-tab button, the panel slot
 *     sub:<id>             a sub-tab shown: the slot, each of its rows, every control of the row (by id; an element sketch.js hides is null)
 *     <sheet>              the sheet open (rail_more, panel_more, kreis, dreieck, layer_sheet, timeline_sheet): the sheet, its scrim, and the controls in it that have an id; scalars scrollHeight /
 *                          clientHeight (does it scroll)
 *     notice               a 3-line notice showing (UI.notify): the stack and the notice; notice_in_sheet: the same while the rail's sheet is open (the stack goes under the header)
 *
 * Every snapshot but the notice ones is taken with NO notice on screen (UI.hideToast first), so the file does not depend on the speed of the recording. The steps use dispatched events (the shape
 * of a mouse click), never the keyboard.
 *
 *   const r = await measurePhone();      // -> { env, states }
 */
(function () {
  'use strict';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const r1 = (n) => Math.round(n * 10) / 10;
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];

  function rect(el) {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) return null;
    return [r1(b.x), r1(b.y), r1(b.width), r1(b.height)];
  }
  function realClick(el) {
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const C = /^pointer/.test(t) && typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
      el.dispatchEvent(new C(t, { bubbles: true, cancelable: true, view: window, detail: 1, button: 0, pointerType: 'mouse' }));
    }
  }
  async function settle(ms) {
    if (window.UI && UI.hideToast) UI.hideToast();
    await sleep(ms || 250);
  }
  const LONG = 'Sin und Tan brauchen mindestens 4 Knoten. Die Anzahl wurde auf 4 gesetzt, damit das Netz berechnet werden kann und alle Maschen sichtbar bleiben.';

  // the rect of an element under a stable key: by id, else by its place among its siblings
  function keyOf(el, scope) {
    if (el.id) return '#' + el.id;
    const sibs = [...el.parentNode.children], tag = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '');
    return (scope || '') + ' ' + tag + '[' + sibs.indexOf(el) + ']';
  }
  function controls(root, out, prefix) {
    qa(root + ' button, ' + root + ' a, ' + root + ' input, ' + root + ' [role="spinbutton"], ' + root + ' select, ' + root + ' [role="radiogroup"]').forEach((el) => { out[prefix + keyOf(el, root)] = rect(el); });
  }
  function scalars() {
    const de = document.documentElement, cv = q('#canvas-container'), sl = q('#ph-slot'), c = rect(cv), s = rect(sl);
    return { docScrollV: de.scrollHeight - de.clientHeight, docScrollH: de.scrollWidth - de.clientWidth, docHeight: de.scrollHeight, canvasSide: c ? Math.min(c[2], c[3]) : null, spare: s ? r1(window.innerHeight - (s[1] + s[3])) : null };
  }

  function base() {
    const o = {};
    ['.app-header', '#tab-form', '#tab-farbe', '#tab-netz', '#btn-help', '#canvas-container', '#ph-stack', '#ph-toolrow', '#ph-tools', '#ph-subtabs', '#ph-slot'].forEach((s) => { o[s] = rect(q(s)); });
    qa('#ph-toolrow button, #ph-toolrow a').forEach((el) => { o['#ph-toolrow ' + keyOf(el, '#ph-toolrow')] = rect(el); });
    qa('#ph-toolrow .ph-sep').forEach((el, i) => { o['#ph-toolrow .ph-sep[' + i + ']'] = rect(el); });
    qa('#ph-subtabs button').forEach((el) => { o['#ph-subtabs ' + keyOf(el, '#ph-subtabs')] = rect(el); });
    return Object.assign(o, scalars());
  }

  // a sub-tab shown: the slot, each row, the controls of the rows
  async function sub(id) {
    const b = q('#ph-subtab-' + id);
    if (!b) return null;
    realClick(b); await settle(300);
    const o = { '#ph-slot': rect(q('#ph-slot')) };
    o['#ph-subtab-' + id + '[current]'] = b.getAttribute('aria-current') === 'true' ? 1 : 0;
    qa('#ph-slot .ph-row').forEach((row, i) => { o['#ph-slot .ph-row[' + i + ']'] = rect(row); controls('#ph-slot .ph-row:nth-child(' + (i + 1) + ')', o, ''); });
    return Object.assign(o, scalars());
  }

  async function sheet(name, open, sel, closeOpener) {
    const o = {};
    try { open(); } catch (e) { return { error: String(e) }; }
    await sleep(450);
    const el = q(sel), shown = !!el && !el.hidden && el.getBoundingClientRect().height > 0;
    o[sel] = shown ? rect(el) : null;
    o['#overlay-scrim'] = rect(q('#overlay-scrim'));
    o.open = shown ? 1 : 0;
    if (shown) { o.scrollHeight = el.scrollHeight; o.clientHeight = el.clientHeight; controls(sel, o, ''); }
    o.htmlClass = document.documentElement.className;
    // the notice while this sheet is open: the stack goes under the header
    if (shown && name === 'rail_more') { UI.notify(LONG, { kind: 'warn' }); await sleep(250); o['#ui-notices .notice'] = rect(q('#ui-notices .notice')); o['#ui-notices'] = rect(q('#ui-notices')); UI.hideToast(); await sleep(100); }
    if (shown) { const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); el.dispatchEvent(k); await sleep(350); if (!el.hidden && el.getBoundingClientRect().height > 0 && closeOpener) { realClick(closeOpener); await sleep(300); } }
    o.closed = !el || el.hidden || el.getBoundingClientRect().height === 0 ? 1 : 0;
    return o;
  }

  async function measurePhone() {
    const tab = document.documentElement.getAttribute('data-tab'), states = {};
    const env = { innerWidth: window.innerWidth, innerHeight: window.innerHeight, coarse: matchMedia('(pointer: coarse)').matches, tab: tab, htmlClass: document.documentElement.className, visibility: document.visibilityState };
    await settle(400);
    states.base = base();
    const subs = qa('#ph-subtabs button').map((b) => b.id.replace('ph-subtab-', ''));
    env.subtabs = subs;
    // the sub-tabs (the first one again at the end)
    for (const id of subs) states['sub:' + id] = await sub(id);
    await sub(subs[0]);
    // a notice (3 lines, with a close button): over the bottom of the canvas
    UI.notify(LONG, { kind: 'warn' }); await sleep(300);
    states.notice = { '#ui-notices': rect(q('#ui-notices')), '#ui-notices .notice': rect(q('#ui-notices .notice')), '#canvas-container': rect(q('#canvas-container')), '#ph-toolrow': rect(q('#ph-toolrow')), count: qa('#ui-notices .notice').length };
    await settle(200);
    // the sheets
    const rail = q('#btn-more-rail');
    states.rail_more = await sheet('rail_more', () => realClick(rail), '#more-rail', rail);
    if (tab === 'form') { const b = q('#btn-more-form'); states.panel_more = await sheet('panel_more', () => realClick(b), '#more-form', b); }
    if (tab === 'netz') {
      // the net applies to the square on the base: choose the square, then Sin (like measure-layout's net chapter), then the panel's own More
      const shapes = qa('.shape-icon-btn'); if (shapes[1]) { realClick(shapes[1]); await sleep(400); }
      const sin = q('.net-kind-btn[data-kind="sinus"]'); if (sin) { realClick(sin); await sleep(500); }
      await settle(200);
      await sub('art');
      const b = q('#btn-more-netz'); states.panel_more = await sheet('panel_more', () => realClick(b), '#more-netz', b);
      await sub('achsen'); states.net_achsen_sin = { '#ph-slot': rect(q('#ph-slot')), '#net-focus-stepper': rect(q('#net-focus-stepper')), disabled: q('#net-focus-stepper').getAttribute('aria-disabled') === 'true' ? 1 : 0 };
      await sub('art');
      const geo = q('.net-kind-btn[data-kind="geometric"]'); if (geo) { realClick(geo); await sleep(500); }
      states.net_art_geo = { '#ph-slot': rect(q('#ph-slot')), '#btn-more-netz': rect(q('#btn-more-netz')), '#net-reverse-btn': rect(q('#net-reverse-btn')), '#net-strength-value': rect(q('#net-strength-value')) };
      await settle(200);
    }
    if (tab === 'farbe') {
      for (const [name, btnId, sel] of [['kreis', 'btn-open-kreis', '#overlay-kreis'], ['dreieck', 'btn-open-dreieck', '#overlay-dreieck']]) {
        await sub('harmonie');
        const b = q('#' + btnId);
        states[name] = await sheet(name, () => { realClick(b); if (q(sel).hidden) realClick(b); }, sel, b);
      }
      // a triangle on the base with Fill on: two trails, the chip view with chips
      const ids = activeNodes().map((n) => n.id), c = activeConnections();
      c.push([ids[0], ids[1]]); c.push([ids[1], ids[2]]); c.push([ids[2], ids[0]]); redraw(); await sleep(400);
      const fill = q('#btn-toggle-faces'); if (!fill.classList.contains('active')) realClick(fill);
      await sleep(900);
      states.spuren_with_trails = await sub('spuren');
      await sub('harmonie');
    }
    // the layer sheet and the timeline sheet (a layer and one keyframe)
    await sub('ebenen');
    const add = qa('#layer-strip button').find((b) => /hinzuf/i.test(b.getAttribute('aria-label') || ''));
    if (add) { realClick(add); await sleep(500); }
    states.ebenen_with_layer = await sub('ebenen');
    const lm = q('#layer-strip .lt-more');
    if (lm) states.layer_sheet = await sheet('layer_sheet', () => realClick(lm), '#ph-sheet-layer', lm);
    if (window.layerApi && layerApi.addToTimeline) { layerApi.addToTimeline(); await sleep(500); }
    await sub('zeit');
    const tm = q('#timeline-strip .ts-more');
    if (tm) states.timeline_sheet = await sheet('timeline_sheet', () => realClick(tm), '#ph-sheet-timeline', tm);
    await sub(subs[0]);
    await settle(300);
    return { env: env, states: states };
  }
  window.measurePhone = measurePhone;
})();
