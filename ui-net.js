/*
 * The Netz nav row (UI rework 4c; task 122: the Netzart stepper - | 1 | 3C in front, see below): Sin | Tan | Geo, the strength stepper, and the "Mehr" overlay. It wires
 * markup that already exists in index.html to the EXISTING net logic in sketch.js (initNetControls()) - the net
 * controls are moved, not duplicated:
 *
 *   kinds      the .net-kind-btn buttons (Aus = the regular net). sketch.js's handlers run as before and keep the
 *              'active' class; aria-checked follows it. When a net is switched on from Aus, sketch.js applies the
 *              defaults (both axes, Field) and, for Sin/Tan, at least 4 nodes - and says so (a toast).
 *   strength   a stepper around the existing range input #net-strength-input, which still carries the value in
 *              percent exactly as the slider did (strength = value / 100); #net-strength-value is the display
 *              (sketch.js writes it: 0.5, or x3.2 for Geo). 0.1 per tap, hold to repeat, arrow keys on the display.
 *              A value off the 0.1 grid (0.86) is shown as it is with two decimals and is NEVER rounded on load; the
 *              next tap goes to the next grid value in that direction (0.9 up, 0.8 down).
 *   More       the whole existing #net-group (X/Y, Single/Tiled/Field, Macro, Focus, Net lines, Reverse/Alternate)
 *              plus exact two-decimal fields for strength and focus, in a popover (bottom sheet on the phone).
 *
 * The net applies to the SQUARE on the BASE sheet only. Everywhere else the whole row stays visible and is
 * aria-disabled with the reason (a tap shows it); it is never hidden. The same goes for the axes buttons and Reverse (phone layout, commit 3: they are visible in its panel). Aus disables the strength (it has no effect
 * then); strength 0 is NOT off - the stepper stays enabled there.
 *
 * The German texts below are the reasons for now; the dictionary (data-i18n keys) comes in a later phase.
 */
(function () {
  // a text of the bilingual dictionary (ui-i18n.js) in the current language, else the German text written here
  const tr = function (key, params, fallback) { const i = window.uiI18n; return i && i.has(key) ? i.t(key, params) : fallback; };
  const T = {
    get 'reason.net.notApplicable'() { return tr('reason.net.notApplicable', null, 'Netz gilt für das Quadrat, Basis-Ebene.'); },
    get 'reason.net.needsKind'() { return tr('reason.net.needsKind', null, 'Die Stärke gilt für Sin, Tan und Geo.'); },
    get 'reason.strength.max'() { return tr('reason.strength.max', null, 'Größte Stärke: 1,0.'); },
    get 'reason.strength.min'() { return tr('reason.strength.min', null, 'Kleinste Stärke: 0,0.'); },
    get 'reason.strength.exact'() { return tr('reason.strength.exact', null, 'Die Stärke liegt zwischen 0,00 und 1,00.'); },
    get 'reason.focus.max'() { return tr('reason.focus.max', null, 'Größter Fokus: 1,0.'); },
    get 'reason.focus.min'() { return tr('reason.focus.min', null, 'Kleinster Fokus: −1,0.'); },
    get 'reason.focus.exact'() { return tr('reason.focus.exact', null, 'Der Fokus liegt zwischen −1,00 und 1,00.'); },
    get 'reason.art.needsN1'() { return tr('net.art.reason.needsN1', null, 'Das Gesetz gilt für Netzart 1. Netzart 1 wählen.'); },
  };
  const $ = function (s) { return document.querySelector(s); };

  const row = $('#nav-netz'), panel = $('#more-netz'), moreBtn = $('#btn-more-netz');
  const kindBtns = Array.prototype.slice.call(row.querySelectorAll('.net-kind-btn'));
  const strengthRoot = $('#net-strength-stepper');   // task 122: the row has more steppers now (Netzart, a, b)
  const strengthInput = $('#net-strength-input'), strengthDisplay = $('#net-strength-value');
  const focusRoot = panel.querySelector('#net-focus-row .stepper');
  const focusRowEl = $('#net-focus-row');
  const focusInput = $('#net-focus-input'), focusDisplay = $('#net-focus-value');
  const strengthExact = $('#net-strength-exact'), focusExact = $('#net-focus-exact');
  const readoutEl = $('#net-readout');

  function applies() { return (currentShape === 'square' || currentShape === 'triangle' || currentShape === 'hex') && activeLayer === 'base'; }
  function kind() {
    const b = kindBtns.find(function (x) { return x.classList.contains('active'); });
    return b ? b.dataset.kind : 'regular';
  }
  function reasonAll() { return applies() ? null : T['reason.net.notApplicable']; }
  // the phone layout disables the Fokus stepper (aria-disabled on its root, with the reason) while sketch.js hides the Fokus row (Aus, Geo); the exact field says the same and is locked
  // At 768px and up (the Netz surface, patterns C0b-3) nothing disables the stepper - the layout's follow rule is the phone's - but the exact field sits in the overlay's rows whatever sketch.js does with the Fokus row,
  // so the hidden row itself says "does not apply" (Aus, Geo), with the same text the phone layout writes.
  function reasonFocus() { return reasonAll() || (artNow() !== 'n1' ? tt('net.art.reason.needsN1.focus') : null) || (UI.isDisabled(focusRoot) ? focusRoot.dataset.reason || '' : null) || (focusRowEl && focusRowEl.hidden ? UI.t('net.reason.focus') : null); }
  function reasonStrength() { return reasonAll() || (artNow() !== 'n1' ? tt('net.art.reason.needsN1.strength') : null) || (kind() === 'regular' ? T['reason.net.needsKind'] : null); }   // task 122: the strength is Netzart 1's

  // ---- kinds: a radiogroup whose state sketch.js owns ------------------------------------------------------------
  kindBtns.forEach(function (b) { UI.checkedFromActive(b); });

  // A disabled net control must not reach sketch.js's p5 handler (a 'mousedown' listener): stop it on the way down. The listeners sit on the document, not on the row: the phone layout (ui-phone.js) moves the kind
  // buttons, the axes buttons and Reverse into its panel, outside #nav-netz and #more-netz.
  const GUARDED = '.net-kind-btn[aria-disabled="true"], .net-axes-btn[aria-disabled="true"], #net-reverse-btn[aria-disabled="true"]';
  document.addEventListener('mousedown', function (e) {
    const b = e.target.closest && e.target.closest(GUARDED);
    if (b) e.stopPropagation();
  }, true);
  document.addEventListener('click', function (e) {
    const b = e.target.closest && e.target.closest(GUARDED);
    if (b) UI.showReason(b);
  });
  const axesBtns = Array.prototype.slice.call(document.querySelectorAll('.net-axes-btn')), reverseBtn = $('#net-reverse-btn');
  // the icon-only toggles (Net lines, Reverse, Alternate; C0b-4: no text any more) say their state, not only draw it: sketch.js keeps the 'active' class, aria-pressed follows it
  [$('#net-lines-btn'), reverseBtn, $('#net-alternate-btn')].forEach(function (b) { if (b) UI.pressed(b); });
  // Arrow keys move AND choose, like native radios (the choice itself is sketch.js's p5 handler: a 'mousedown').
  kindBtns.forEach(function (b, i) {
    b.addEventListener('keydown', function (e) {
      let j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % kindBtns.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + kindBtns.length) % kindBtns.length;
      if (j < 0) return;
      e.preventDefault();
      if (!applies()) return;
      kindBtns[j].focus();
      kindBtns[j].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    });
  });

  // ---- steppers on the percent range inputs ---------------------------------------------------------------------
  // p = the value in percent (strength 0..100, focus -100..100). One tap = the next multiple of 10 in that direction,
  // so a value off the grid (86) goes to 90 up and 80 down; the stored value is only changed by a tap.
  function gridStep(p, dir, lo, hi) {
    if (dir > 0) return p >= hi ? null : Math.min(hi, (Math.floor(p / 10) + 1) * 10);
    return p <= lo ? null : Math.max(lo, (Math.ceil(p / 10) - 1) * 10);
  }
  function strengthCompute(dir) {
    const why = reasonStrength();
    if (why) return { to: null, reason: why };
    const to = gridStep(parseInt(strengthInput.value, 10) || 0, dir, 0, 100);
    return to === null ? { to: null, reason: T[dir > 0 ? 'reason.strength.max' : 'reason.strength.min'] } : { to: to };
  }
  function focusCompute(dir) {
    const why = reasonAll();
    if (why) return { to: null, reason: why };
    const to = gridStep(parseInt(focusInput.value, 10) || 0, dir, -100, 100);
    return to === null ? { to: null, reason: T[dir > 0 ? 'reason.focus.max' : 'reason.focus.min'] } : { to: to };
  }
  const strengthStepper = UI.stepper(strengthRoot, { input: strengthInput, compute: strengthCompute, noTyping: true, keyEl: strengthDisplay });
  const focusStepper = UI.stepper(focusRoot, { input: focusInput, compute: focusCompute, noTyping: true, keyEl: focusDisplay });

  // ---- exact two-decimal fields (under More) ---------------------------------------------------------------------
  // The carrier holds whole percent, so two decimals are exact. A value outside the range is clamped with a toast;
  // anything that is not a number restores the current value.
  function bindExact(field, carrier, lo, hi, msg, reasonFn) {
    field.addEventListener('change', function () {
      const why = reasonFn();
      let v = parseFloat(UI.normalizeNumber(field.value));   // the German decimal pad types a comma; the field is type=text so the typed text reaches here (a number input gives '' for it on iOS)
      if (why || isNaN(v)) { show(); if (why) UI.toast(why, 4000); return; }
      if (v < lo || v > hi) { v = v < lo ? lo : hi; UI.toast(msg, 4000); }
      carrier.value = String(Math.round(v * 100));
      carrier.dispatchEvent(new Event('input', { bubbles: true }));
      carrier.dispatchEvent(new Event('change', { bubbles: true }));
      show();
    });
    function show() { field.value = ((parseInt(carrier.value, 10) || 0) / 100).toFixed(2); }
    return show;
  }
  const showStrengthExact = bindExact(strengthExact, strengthInput, 0, 1, T['reason.strength.exact'], reasonStrength);
  const showFocusExact = bindExact(focusExact, focusInput, -1, 1, T['reason.focus.exact'], reasonFocus);

  // A field the phone layout wrapped into a stepper (ui-phone.js: data-stepper, readonly with no keyboard) keeps the readOnly that layout gave it: this tick must not undo it. The lock (aria-disabled and the reason)
  // is still set here; the layout mirrors it onto the stepper.
  function setLocked(field, why) {
    if (!field.hasAttribute('data-stepper') && field.readOnly !== !!why) field.readOnly = !!why;
    UI.setDisabled(field, why);
  }

  // ---- the More overlay -------------------------------------------------------------------------------------------
  const overlay = UI.overlay(moreBtn, panel, { onOpen: sync });


  // ---- task 122 (3C-3): the Netzart stepper and the Moebius net (3C) controls ---------------------------------------------------------------------------
  // The stepper (-, 1, 3C) replaces the Aus button; it chooses through sketch.js's window.netArtSet() (the panel state lives there). The table of what a shape offers is ui-net-art.js (window.netArt, pure).
  // Under 3C the Sin / Tan / Geo group and the strength give way to a, b, the format and "W . stretch" at the ACTUAL canvas; the Mehr overlay lists the suggestions and the Netzarten with their reasons.
  const netArt = window.netArt;
  const artRoot = $('#net-art-stepper'), artInput = $('#net-art-input'), artDisplay = $('#net-art-value');
  const cluster3c = $('#net-3c'), aRoot = $('#net-a-stepper'), aInput = $('#net-a-input'), aDisplay = $('#net-a-value'), bRoot = $('#net-b-stepper'), bInput = $('#net-b-input'), bDisplay = $('#net-b-value');
  const fmtGroup = $('#net-format');
  const fmtBtns = Array.prototype.slice.call(document.querySelectorAll('.net-format-btn')), infoEl = $('#net-3c-info'), reasonEl = $('#net-3c-reason');
  const more3c = $('#net-3c-more'), frameEl = $('#net-3c-frame'), suggestEl = $('#net-3c-suggest'), noteEl = $('#net-3c-note'), listEl = $('#net-art-list'), strengthSection = $('#net-strength-section');
  const kindsGroup = $('#nav-kinds'), strengthStepperEl = $('#net-strength-stepper'), dividerA = row.querySelector('.nav-divider-a');
  const tt = function (key, params) { return window.UI && UI.t ? UI.t(key, params) : key; };
  const langNow = function () { return (window.UI && UI.lang) || 'de'; };
  const core3c = function () { return { spec: netProjectiveSpec, info: netProjectiveInfo }; };
  const forShape0 = function (spec, shape) { return typeof netProjectiveForShape === 'function' ? netProjectiveForShape(spec, shape) : spec; };
  const forShape = function (spec) { return typeof netProjectiveForShape === 'function' ? netProjectiveForShape(spec, currentShape) : spec; };   // task 124: the family follows the shape (a stale one is renamed by the core)
  function artNow() { return !baseNetTransform ? 'off' : baseNetTransform.kind === 'projective' ? 'n3c' : 'n1'; }
  function spec3c() { return artNow() === 'n3c' ? baseNetTransform : null; }
  let last3c = null;   // the last 3C choice (a, b, format): coming back to 3C starts from it
  function artIndex(id) { for (let i = 0; i < netArt.ART.length; i++) if (netArt.ART[i].id === id) return i; return 0; }
  function choose(id) {
    if (typeof window.netArtSet !== 'function') return;
    if (id === 'n3c') {
      let par = last3c || netArt.defaultFor(core3c(), canvasW, canvasH, currentShape);
      if (!netArt.formatAvail(currentShape, par.format).ok) par = { a: par.a, b: par.b, format: 'full' };   // task 124: a half-format memory does not start 3C on the triangle
      window.netArtSet('3c', par);
    }
    else window.netArtSet(id === 'off' ? 'off' : 'n1');
  }
  function artCompute(dir) {
    const why = reasonAll(); if (why) return { to: null, reason: why };
    const r = netArt.step(currentShape, artNow(), dir);
    return r.to === null ? { to: null, reason: tt(r.reason) } : { to: artIndex(r.to) };
  }
  function abCompute(which, dir) {
    const why = reasonAll(), s = spec3c(); if (why) return { to: null, reason: why }; if (!s) return { to: null, reason: tt('net.art.reason.min') };
    const a = Math.round(s.a), b = Math.round(s.b), r = which === 'a' ? netArt.stepA(a, b, dir, currentShape) : netArt.stepB(a, b, dir);
    return r.to === null ? { to: null, reason: tt(r.reason) } : { to: r.to };
  }
  const artStepper = UI.stepper(artRoot, { input: artInput, compute: artCompute, noTyping: true, keyEl: artDisplay });
  const aStepper = UI.stepper(aRoot, { input: aInput, compute: function (d) { return abCompute('a', d); }, noTyping: true, keyEl: aDisplay });
  const bStepper = UI.stepper(bRoot, { input: bInput, compute: function (d) { return abCompute('b', d); }, noTyping: true, keyEl: bDisplay });
  artInput.addEventListener('input', function () { const id = netArt.ART[parseInt(artInput.value, 10)]; if (id && id.id !== artNow()) choose(id.id); });
  function set3c(a, b, format) { if (typeof window.netArtSet === 'function') window.netArtSet('3c', { a: a, b: b, format: format }); }
  aInput.addEventListener('input', function () { const s = spec3c(); if (s) set3c(parseInt(aInput.value, 10), Math.round(s.b), s.format); });
  bInput.addEventListener('input', function () { const s = spec3c(); if (s) set3c(Math.round(s.a), parseInt(bInput.value, 10), s.format); });
  fmtBtns.forEach(function (b) { b.addEventListener('click', function () { const s = spec3c(); if (!s || UI.isDisabled(b) || !netArt.formatAvail(currentShape, b.dataset.format).ok) return; set3c(Math.round(s.a), Math.round(s.b), b.dataset.format); }); });
  const setAria = function (el, name, v) { if (el.getAttribute(name) !== v) el.setAttribute(name, v); };   // task 084: an attribute is written only when its value changes (sync runs on every redraw)
  const setText = function (el, v) { if (el.textContent !== v) el.textContent = v; };
  const setHidden = function (el, v) { if (el.hidden !== v) el.hidden = v; };
  let moreSig = null, suggestCache = {}, lastHintSig = null;   // lastHintSig: the state of the notice "no net, and why" (task 126)
  function fmtWord(f) { return tt(f === 'half' ? 'net.3c.format.half' : 'net.3c.format.full'); }
  function syncArt(all) {
    const a3 = artNow(), idx = artIndex(a3), cur = spec3c(), ents = netArt.entries(currentShape);
    if (cur && Number.isInteger(cur.a) && Number.isInteger(cur.b)) last3c = { a: cur.a, b: cur.b, format: cur.format };
    if (artInput.value !== String(idx)) artInput.value = String(idx);
    setText(artDisplay, netArt.ART[idx].short);
    setAria(artDisplay, 'aria-valuenow', String(idx));
    setAria(artDisplay, 'aria-valuetext', tt('net.art.name.' + a3));
    const tip = tt('net.art.tip.' + a3); if (artDisplay.title !== tip) artDisplay.title = tip;
    artStepper.refresh();
    // the Netzart 1 group (Sin / Tan / Geo, strength) is shown for "-" and 1 and gives way to the 3C controls under 3C
    const is3 = a3 === 'n3c';
    setHidden(kindsGroup, is3); setHidden(strengthStepperEl, is3); if (dividerA) setHidden(dividerA, is3); setHidden(cluster3c, !is3);
    setHidden(more3c, !is3); setHidden(strengthSection, is3);
    [aRoot, bRoot, fmtGroup].forEach(function (el) { setHidden(el, !is3); });   // the layout moves them out of the cluster: each one is hidden on its own
    { const dr = $('#net-domain-row'); if (dr) setHidden(dr, is3); }   // task 123: the axes row stays (phone: visible and locked with a reason, desktop Mehr: the group class hides it)   // the layout moves them out of #net-group: hidden here, not by a class of the group
    let line3 = null;
    const why3 = is3 && !ents[artIndex('n3c')].ok ? tt(ents[artIndex('n3c')].reason) : null;   // a 3C spec on a shape that has no 3C (the core draws no net): a, b and the format stay, locked, and the line says why
    [aRoot, bRoot].forEach(function (el) { UI.setDisabled(el, why3 || all || null); });
    const measureEl = $('#net-3c-measure');
    const warnShow = function (text) { setHidden(infoEl, !text); if (text) { setAria(infoEl, 'aria-label', text); if (infoEl.title !== text) infoEl.title = text; } };   // task 123: the row carries a small sign only when there is something to warn about
    // task 126: a 3C spec that draws NO net on this shape says why where the person sees it, not in a tooltip only: the short line next to the sign (the phone: the third row of the Art panel), the notice once per state
    // (shape included: a shape change reports anew), the full sentence in the tooltip and under Mehr > Maße. The stretch and W warnings stay with the sign alone (they are notes, the net is drawn).
    const hint = is3 && typeof netProjectiveEffective === 'function' ? netArt.invalidHint({ effective: netProjectiveEffective, forShape: forShape0 }, cur, currentShape) : null;
    const hintFull = hint ? tt(hint.key) : '', hintShort = hint ? tt(hint.shortKey) : '';
    setText(reasonEl, hintShort); if (reasonEl.title !== hintFull) reasonEl.title = hintFull; setHidden(reasonEl, !hint);
    const hs = netArt.hintSig(hint, currentShape);
    if (hs !== lastHintSig) { lastHintSig = hs; if (hint) { if (window.say) window.say('net-3c-invalid', hintFull, 'warn'); } else if (window.UI && UI.notifyClear) UI.notifyClear('net-3c-invalid'); }
    if (why3) { warnShow(hintFull || why3); setText(measureEl, hintFull || why3); setText(noteEl, ''); line3 = '\u26a0 ' + (hintShort || why3); }
    else if (is3 && typeof netProjectiveInfo === 'function') {
      const info = netProjectiveInfo(forShape(cur), canvasW, canvasH), sm = netArt.summary(info, langNow()), wn = netArt.warnings(info, currentShape), lim = netArt.limitsFor(currentShape);
      const a = Math.round(cur.a), b = Math.round(cur.b);
      setText(aDisplay, String(a)); setText(bDisplay, String(b));
      if (aInput.value !== String(a)) aInput.value = String(a);
      if (bInput.value !== String(b)) bInput.value = String(b);
      setAria(aDisplay, 'aria-valuenow', String(a)); setAria(bDisplay, 'aria-valuenow', String(b));
      aStepper.refresh(); bStepper.refresh();
      fmtBtns.forEach(function (bt) { const on = bt.dataset.format === cur.format, fb = netArt.formatAvail(currentShape, bt.dataset.format); bt.classList.toggle('active', on); setAria(bt, 'aria-checked', on ? 'true' : 'false'); UI.setDisabled(bt, why3 || all || (fb.ok ? null : tt(fb.reason))); });
      if (hint) { warnShow(hintFull); setText(measureEl, hintFull); setText(noteEl, hintFull); line3 = '\u26a0 ' + hintShort; }   // task 124/126: a spec the core refuses on this shape (half on the triangle, a = 1 on the square) stays; no net is drawn and this says why
      else if (sm) {
        const ml = netArt.measureLine(info, langNow(), tt), warn = [];
        if (wn.stretch) warn.push(tt('net.3c.warn.stretch', { s: sm.stretch }));
        if (wn.wLow) warn.push(tt('net.3c.warn.wLow', { w: sm.W, lo: lim.wLo, hi: lim.wHi })); if (wn.wHigh) warn.push(tt('net.3c.warn.wHigh', { w: sm.W, lo: lim.wLo, hi: lim.wHi }));
        const w = warn.join(' ');
        warnShow(w); setText(measureEl, ml); setText(noteEl, w);
        line3 = (warn.length ? '\u26a0 ' : '') + ml;
      }
    } else { warnShow(''); }
    // the Mehr overlay: rewritten only when what it shows changes (sync runs on every redraw)
    const sig = [a3, currentShape, langNow(), canvasW, canvasH, cur ? cur.a + ',' + cur.b + ',' + cur.format : ''].join('|');
    if (sig !== moreSig) {
      moreSig = sig;
      // the Netzarten of this shape: what is available, and every other with its reason
      listEl.innerHTML = '';
      const add = function (name, state) { const li = document.createElement('li'); li.textContent = tt('net.art.list.row', { name: name, state: state }); listEl.appendChild(li); };
      ents.filter(function (e) { return e.id !== 'off'; }).forEach(function (e) { add(tt('net.art.name.' + e.id), e.ok ? tt('net.art.list.ok') : tt(e.reason)); });
      netArt.later().forEach(function (l) { add(tt('net.art.list.later', { label: l.label }), tt(l.reason)); });
      if (is3 && typeof netProjectiveInfo === 'function') {
        setText(frameEl, tt('net.3c.frame', { w: canvasW, h: canvasH }));
        const ck = currentShape + canvasW + 'x' + canvasH, sg = suggestCache[ck] || (suggestCache = {}, suggestCache[ck] = netArt.suggest(core3c(), canvasW, canvasH, currentShape));
        suggestEl.innerHTML = '';
        sg.list.forEach(function (c) {
          const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'layer-btn net-3c-suggest-btn';
          const w = netArt.num(c.W, 2, langNow()), st = netArt.num(c.stretch, 1, langNow()), f = fmtWord(c.format);
          bt.textContent = tt('net.3c.suggest.item', { a: c.a, b: c.b, fmt: f, w: w, s: st }); bt.title = tt('net.3c.suggest.itemTitle', { a: c.a, b: c.b, fmt: f, w: w, s: st });
          if (cur && Math.round(cur.a) === c.a && Math.round(cur.b) === c.b && cur.format === c.format) bt.classList.add('active');
          bt.addEventListener('click', function () { set3c(c.a, c.b, c.format); });
          suggestEl.appendChild(bt);
        });
        if (!sg.list.length && sg.best) { const p = document.createElement('p'); p.className = 'net-3c-note'; p.textContent = tt('net.3c.suggest.none', { w: canvasW, h: canvasH, a: sg.best.a, b: sg.best.b, fmt: fmtWord(sg.best.format), s: netArt.num(sg.best.stretch, 1, langNow()) }); suggestEl.appendChild(p); }
      }
    }
    return line3;
  }
  // ---- sync (on every redraw) ------------------------------------------------------------------------------------
  function sync() {
    const all = reasonAll();
    const line3 = syncArt(all);
    kindBtns.forEach(function (b) { UI.setDisabled(b, all || (artNow() === 'off' ? T['reason.art.needsN1'] : null)); });   // task 122: the law applies to Netzart 1; with "-" the group stays visible and says so
    axesBtns.forEach(function (b) { UI.setDisabled(b, all || (artNow() === 'n3c' ? tt('net.art.reason.needsN1.axes') : null)); });   // hidden with #net-group elsewhere; in the phone layout's panel they stay visible, so they say why
    UI.setDisabled(reverseBtn, all || (artNow() === 'n3c' ? tt('net.art.reason.needsN1.reverse') : null));   // task 123: Reverse is a Netzart 1 control: visible (when Netzart 1 was Geo) but locked under 3C
    UI.setDisabled(moreBtn, all);
    if (all && overlay.isOpen) overlay.close(false);
    strengthStepper.refresh();
    focusStepper.refresh();
    // spinbutton values for assistive technology
    const sp = (parseInt(strengthInput.value, 10) || 0) / 100, fp = (parseInt(focusInput.value, 10) || 0) / 100;
    // task 084: an attribute is written only when its value changes (sync runs on every redraw)
    const setAria = function (el, name, v) { if (el.getAttribute(name) !== v) el.setAttribute(name, v); };
    setAria(strengthDisplay, 'aria-valuenow', String(sp));
    setAria(strengthDisplay, 'aria-valuetext', strengthDisplay.textContent);
    setAria(focusDisplay, 'aria-valuenow', String(fp));
    setAria(focusDisplay, 'aria-valuetext', focusDisplay.textContent);
    // exact fields follow the state unless being typed in
    if (document.activeElement !== strengthExact) showStrengthExact();
    if (document.activeElement !== focusExact) showFocusExact();
    setLocked(strengthExact, reasonStrength());
    setLocked(focusExact, reasonFocus());
    // the readout line of the phone layout's Netz sheet: the active domain and the shape size (core/state.js), in the current language
    if (line3 !== null) { if (readoutEl && readoutEl.textContent !== line3) readoutEl.textContent = line3; return; }   // task 122: under 3C the line is W and the stretch (the last thing sync() does)
    if (readoutEl && window.netReadout) {
      const d = $('.net-domain-btn.active'), dom = window.netReadout.readoutDomain(d ? d.dataset.domain : 'single', typeof netDomainEffective === 'function' && typeof netSizeFactors === 'function' ? netDomainEffective({ domain: 'field' }, netSizeFactors(), currentShape).ignored === null : undefined), fld = dom === 'field' && typeof gridSizeX === 'function', ms = fld && typeof netWarpBaseNow === 'function' && netWarpBaseNow() ? netWarpBaseNow().meshes : undefined, hexF = !!ms && currentShape === 'hex', text = window.netReadout.readoutText(dom, hexF ? gridSizeX() : ms ? ms.x : fld ? gridSizeX() : shapeSizeFactor, UI.t, hexF ? gridSizeY() : ms ? ms.y : fld ? gridSizeY() : undefined, !!ms, hexF), family = window.netReadout.readoutFamily(currentShape, dom, typeof netWarpActive === 'function' && netWarpActive(), UI.t), line = family ? family + ' \u00b7 ' + text : text;   // task 086: a Field reads X and Y; task 088: the triangle's Field reads the meshes it covers, edge cut; task 111: the family name in front (Field and an active net only)
      if (readoutEl.textContent !== line) readoutEl.textContent = line;
    }
  }
  // the Fokus stepper's root is (un)disabled by the phone layout during a UI tick, after this sync ran: the exact field and the chevrons follow at once
  if (typeof MutationObserver === 'function') new MutationObserver(sync).observe(focusRoot, { attributes: true, attributeFilter: ['aria-disabled'] });
  UI.onSync(sync);
})();
