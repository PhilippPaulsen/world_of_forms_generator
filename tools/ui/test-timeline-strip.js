// Guard for the timeline strip and the layers' diamonds (layer-table commit 6): the pure model (ui-timeline.js: timelineMarks, timelineProgress, diamondPlan, includeNetState, netStateDot), the DOM
// they build (the REAL ui.js, ui-timeline.js and ui-layers.js in a vm with a fake DOM), and the source text of index.html, style.css, sketch.js and the two scripts. No browser.
//   node tools/ui/test-timeline-strip.js
//   INDEX_HTML=... STYLE_CSS=... SKETCH_JS=... UI_LAYERS_JS=... UI_TIMELINE_JS=... UI_JS=... node tools/ui/test-timeline-strip.js        (sabotage runs)
//
// What it pins. The strip (Play, the scrub bar with one decorative diamond mark per keyframe, the ONE Include net switch, "Mehr") is a pure view of `timeline`; every action goes through
// window.layerApi. The diamond of a layer: an outline one selects the row's layer and THEN adds it with the current Base net; a filled one takes the keyframe out and asks first only when that
// discards a user-set line pairing. The old Add to Timeline, the old Include net, the old Play row, the old progress input and the old Remove Timeline are hidden for good.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css'), SKETCH = read('SKETCH_JS', 'sketch.js'), LAYERS = read('UI_LAYERS_JS', 'ui-layers.js'), TLJS = read('UI_TIMELINE_JS', 'ui-timeline.js'), UI_SRC = read('UI_JS', 'ui.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.message).slice(0, 160)); } };
const J = x => JSON.stringify(x);

// ================= 1. the pure model =================
console.log('== the model (loaded without a DOM) ==');
const mctx = vm.createContext({ console });
mctx.window = mctx;
T('model', () => {
    vm.runInContext(TLJS, mctx, { filename: 'ui-timeline.js' });
    const M = mctx.timelineModel;
    check('the model is exported without a DOM', !!M && ['timelineMarks', 'timelineProgress', 'diamondPlan', 'includeNetState', 'netStateDot'].every(k => typeof M[k] === 'function'));
    const L = (x) => Object.assign({ connections: [], enabled: true }, x || {});
    const tl3 = { keyframeLayerIds: [4, 1, 7], segmentDurationsMs: [2000, 1000], segmentPairings: [null, null], segmentFlips: [null, null], segmentMembers: [null, null], elapsedMs: 0, playing: false, startTime: 0 };
    check('timelineMarks: one mark per keyframe at its time position - the cumulative segment durations over the total: [2000, 1000] -> 0, 2/3, 1; index = the layer\'s array index, number = its place in the sequence', J(M.timelineMarks(tl3).map(m => [m.index, m.number, Math.round(m.frac * 1e6) / 1e6])) === J([[4, 1, 0], [1, 2, 0.666667], [7, 3, 1]]));
    check('...two keyframes: 0 and 1; ONE keyframe (no segment yet): its mark at 0; no timeline, no keyframes or a broken object: no marks', J(M.timelineMarks({ keyframeLayerIds: [0, 1], segmentDurationsMs: [2000] }).map(m => m.frac)) === J([0, 1]) && J(M.timelineMarks({ keyframeLayerIds: [3], segmentDurationsMs: [] }).map(m => [m.index, m.frac])) === J([[3, 0]]) && J(M.timelineMarks(null)) === '[]' && J(M.timelineMarks({})) === '[]');
    check('...unequal durations move the marks (a segment of 1000 then one of 3000: 0, 0.25, 1)', J(M.timelineMarks({ keyframeLayerIds: [0, 1, 2], segmentDurationsMs: [1000, 3000] }).map(m => m.frac)) === J([0, 0.25, 1]));
    check('timelineProgress: paused = elapsedMs over the total (500 of 3000); playing = the clock (now - startTime), clamped to 0..1; no segment or no timeline: 0', Math.abs(M.timelineProgress(Object.assign({}, tl3, { elapsedMs: 1500 }), 99999) - 0.5) < 1e-9 && Math.abs(M.timelineProgress(Object.assign({}, tl3, { playing: true, startTime: 1000, elapsedMs: 0 }), 2500) - 0.5) < 1e-9 && M.timelineProgress(Object.assign({}, tl3, { playing: true, startTime: 1000 }), 99999) === 1 && M.timelineProgress(Object.assign({}, tl3, { playing: true, startTime: 5000 }), 1000) === 0 && M.timelineProgress({ keyframeLayerIds: [0], segmentDurationsMs: [] }, 5) === 0 && M.timelineProgress(null, 5) === 0);
    // diamondPlan
    const layers = [L(), L(), L(), L({ isTimelinePlayback: true }), L()];
    const base = { keyframeLayerIds: [0, 1, 2], playbackLayerIndex: 3, segmentDurationsMs: [2000, 2000], segmentPairings: [null, null], segmentFlips: [null, null], segmentMembers: [null, null] };
    const plan = (tl, i) => M.diamondPlan(layers, tl, i);
    check('diamondPlan: a layer that is not a keyframe -> outline: { filled: false, action: \'add\', needsConfirm: false }; without a timeline the same', J(plan(base, 4)) === J({ filled: false, action: 'add', needsConfirm: false, segments: [] }) && J(plan(null, 0)) === J({ filled: false, action: 'add', needsConfirm: false, segments: [] }));
    check('...the PLAYBACK layer and a missing layer never get a diamond (null)', plan(base, 3) === null && plan(base, 9) === null && M.diamondPlan(layers, base, -1) === null && M.diamondPlan(null, base, 0) === null);
    check('...a keyframe with default (null) segments -> filled, \'remove\', NO confirmation - first, middle and last', [0, 1, 2].every(i => { const p = plan(base, i); return p.filled === true && p.action === 'remove' && p.needsConfirm === false && p.segments.length === 0; }));
    const withP = (k, v) => Object.assign({}, base, { [k]: v });
    check('the confirm rule - a user-set pairing in a segment NEXT to the keyframe: segment 0 set -> the first keyframe (its only segment) and the middle one (merged) ask; the last does not (its segment 1 is default)', plan(withP('segmentPairings', [[1, 0], null]), 0).needsConfirm === true && plan(withP('segmentPairings', [[1, 0], null]), 1).needsConfirm === true && plan(withP('segmentPairings', [[1, 0], null]), 2).needsConfirm === false && J(plan(withP('segmentPairings', [[1, 0], null]), 1).segments) === J([0]));
    check('...segment 1 set -> the middle and the LAST keyframe ask, the first does not', plan(withP('segmentPairings', [null, [1, 0]]), 0).needsConfirm === false && plan(withP('segmentPairings', [null, [1, 0]]), 1).needsConfirm === true && plan(withP('segmentPairings', [null, [1, 0]]), 2).needsConfirm === true && J(plan(withP('segmentPairings', [null, [1, 0]]), 2).segments) === J([1]));
    check('...a set flips or members entry counts as well (a reversed line, a symmetry variant), each on its own', plan(withP('segmentFlips', [null, [true, false]]), 2).needsConfirm === true && plan(withP('segmentMembers', [[0, 2], null]), 0).needsConfirm === true && plan(withP('segmentFlips', [null, [true]]), 0).needsConfirm === false);
    check('...both neighbours set: the middle keyframe loses two segments (segments [0, 1]); a timeline WITHOUT the flips / members arrays (an older save) does not throw', J(plan(withP('segmentPairings', [[1, 0], [1, 0]]), 1).segments) === J([0, 1]) && (() => { const old = { keyframeLayerIds: [0, 1], segmentDurationsMs: [2000], segmentPairings: [[1, 0]] }; return plan(old, 1).needsConfirm === true && plan({ keyframeLayerIds: [0, 1], segmentDurationsMs: [2000], segmentPairings: [null] }, 1).needsConfirm === false; })());
    check('...a single keyframe (no segment) never asks; a pairing of a segment NOT adjacent (keyframe 0 of four, pairing on segment 2) does not count', plan({ keyframeLayerIds: [0], segmentDurationsMs: [], segmentPairings: [], segmentFlips: [], segmentMembers: [] }, 0).needsConfirm === false && plan({ keyframeLayerIds: [0, 1, 2, 4], segmentDurationsMs: [1, 1, 1], segmentPairings: [null, null, [1, 0]], segmentFlips: [null, null, null], segmentMembers: [null, null, null] }, 0).needsConfirm === false);
    // include net
    const inl = (o, a) => M.includeNetState(o, a);
    check('includeNetState: automatic follows the net (on while a net warp is active) - titles "Netz aufnehmen: automatisch (an)" / "(aus)"; true = "immer" (on even without a net), false = "nie" (off even with a net)', J(inl(null, true)) === J({ on: true, mode: 'auto', title: 'Netz aufnehmen: automatisch (an)', warn: false }) && J(inl(null, false)) === J({ on: false, mode: 'auto', title: 'Netz aufnehmen: automatisch (aus)', warn: false }) && J(inl(true, false)) === J({ on: true, mode: 'always', title: 'Netz aufnehmen: immer', warn: false }) && J(inl(false, true)) === J({ on: false, mode: 'never', title: 'Netz aufnehmen: nie \u2013 das Netz bewegt sich nicht mit der Zeitleiste', warn: true }) && J(inl(false, false)) === J({ on: false, mode: 'never', title: 'Netz aufnehmen: nie', warn: false }) && inl(undefined, true).mode === 'auto');
    check('includeNetState().warn (the dot and the words): a net warp is active while Include net is off - only "nie" can be that (automatic is on with a net); no warn without a net, with "immer" or with automatic', inl(false, true).warn === true && [inl(null, true), inl(null, false), inl(true, true), inl(true, false), inl(false, false), inl(undefined, false)].every(s => s.warn === false));
    check('netStateDot: only the Timeline\'s net states "partial" and "incompatible" (the net is NOT animated) give the dot; none, pending, constant, animated and no timeline do not', ['partial', 'incompatible'].every(s => M.netStateDot({ state: s })) && ['none', 'pending', 'constant', 'animated'].every(s => !M.netStateDot({ state: s })) && !M.netStateDot(null));
});

// ================= 2. the DOM =================
console.log('\n== the DOM (the real ui.js, ui-timeline.js and ui-layers.js, a fake DOM) ==');
class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this._a = {}; this.dataset = {}; this.handlers = {}; this._c = new Set(); this.style = {}; this.hidden = false; this.id = ''; this._text = ''; this._html = ''; this.type = ''; this.tabIndex = 0; this.offsetParent = {}; this.value = ''; }
    set className(v) { this._c = new Set(String(v).split(/\s+/).filter(Boolean)); } get className() { return [...this._c].join(' '); }
    get classList() { const s = this._c, self = this; return { add: c => { s.add(c); if (self.onClass) self.onClass(); }, remove: c => { s.delete(c); if (self.onClass) self.onClass(); }, contains: c => s.has(c), toggle: (c, on) => { const w = on === undefined ? !s.has(c) : !!on; if (w) s.add(c); else s.delete(c); return w; } }; }
    setAttribute(k, v) { this._a[k] = String(v); } getAttribute(k) { return k in this._a ? this._a[k] : null; } removeAttribute(k) { delete this._a[k]; } hasAttribute(k) { return k in this._a; }
    addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; }
    get parentNode() { return this.parent; }
    set textContent(v) { this._text = String(v); if (v === '') { this.children.forEach(c => { c.parent = null; }); this.children = []; } } get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set innerHTML(v) { this._html = String(v); this.children = []; } get innerHTML() { return this._html; }
    contains(n) { for (let e = n; e; e = e.parent) if (e === this) return true; return false; }
    closest(sel) { for (let e = this; e; e = e.parent) { if (sel.startsWith('.') ? e._c.has(sel.slice(1)) : e.tagName.toLowerCase() === sel) return e; } return null; }
    focus() { this.ownerDoc.activeElement = this; this.dispatch('focusin'); }
    getBoundingClientRect() { return { left: 0, right: 40, top: 0, bottom: 40 }; }
    querySelector() { return null; } querySelectorAll() { return []; }
    dispatch(type, ev) { const e = Object.assign({ type, target: this, stopPropagation() { }, preventDefault() { }, detail: 1 }, ev || {}); for (let n = this; n; n = n.parent) (n.handlers[type] || []).forEach(h => { e.currentTarget = n; h(e); }); return e; }
}
function build(o) {
    o = o || {};
    const byId = {};
    const doc = { activeElement: null, visibilityState: 'visible', documentElement: {}, addEventListener() { }, createElement: tag => { const e = new El(tag); e.ownerDoc = doc; return e; }, getElementById: id => byId[id] || null, querySelector: () => null, querySelectorAll: () => [] };
    const mk = (id, tag, cls) => { const e = doc.createElement(tag || 'div'); e.id = id; if (cls) e.className = cls; byId[id] = e; return e; };
    const table = mk('layer-table', 'div', 'layer-table'), rail = mk('layer-rail', 'div', 'layer-rail'), strip = mk('layer-strip', 'div', 'layer-strip'), tstrip = o.noStrip ? null : mk('timeline-strip', 'div', 'timeline-strip');
    const group = mk('timeline-group', 'div', 'control-group'), clearBtn = mk('btn-clear-timeline', 'button', 'layer-btn'); clearBtn.hidden = true;
    const toastEl = mk('ui-notices', 'div', 'notices');   // the notification container (ui.js UI.notify): notices are inserted into it and removed from it
    const status = mk('timeline-status', 'span');
    // the layer-remove dialog and the timeline confirmation
    const mkDialog = (idOverlay, idTitle, idText, idCancel, idConfirm) => { const ov = mk(idOverlay, 'div', 'dialog-overlay hidden'), content = new El('div'); content.className = 'dialog-content'; content.ownerDoc = doc; ov.appendChild(content); const t = mk(idTitle, 'strong'); content.appendChild(t); mk(idText, 'p'); const c = mk(idCancel, 'button'), k = mk(idConfirm, 'button'); content.appendChild(c); content.appendChild(k); return { ov, c, k }; };
    const lrd = mkDialog('layer-remove-overlay', 'layer-remove-title', 'layer-remove-text', 'cancel-layer-remove', 'confirm-layer-remove');
    const tcd = o.noConfirm ? null : mkDialog('timeline-confirm-overlay', 'timeline-confirm-title', 'timeline-confirm-text', 'cancel-timeline-confirm', 'confirm-timeline-confirm');
    // the old group behind "Mehr": a HIDDEN child (a rect far away that must NOT count), a not-hidden child without client rects (display: none by CSS) and two visible children at o.groupRects; window.scrollBy is recorded
    const scrolls = [], gRects = o.groupRects || [[900, 960], [970, 1010]];
    const gHidden = new El('div'), gNoRects = new El('div'), gA = new El('div'), gB = new El('div');
    [gHidden, gNoRects, gA, gB].forEach(g => { g.ownerDoc = doc; g.scrollIntoView = () => { scrolls.push({ wrong: 'scrollIntoView' }); }; });
    gHidden.hidden = true; gHidden.getClientRects = () => []; gHidden.getBoundingClientRect = () => ({ top: 5000, bottom: 6000, left: 0, right: 100 });
    gNoRects.getClientRects = () => []; gNoRects.getBoundingClientRect = () => ({ top: 7000, bottom: 8000, left: 0, right: 100 });
    [gA, gB].forEach((g, k) => { g.getClientRects = () => group.classList.contains('ts-open') ? [{}] : [];   // laid out only while the group is open (display: none otherwise): a reveal run BEFORE it opens sees nothing
         g.getBoundingClientRect = () => ({ top: gRects[k][0], bottom: gRects[k][1], left: 0, right: 100 }); });
    [gHidden, gNoRects, gA, gB].forEach(g => group.appendChild(g));
    const clock = { t: 0 }, calls = [], moq = [];
    const layers = o.layers || [];
    const ctx = vm.createContext({ document: doc, console, MutationObserver: class { constructor(cb) { this.cb = cb; } observe(el) { el.onClass = () => { moq.push(this.cb); }; } }, setTimeout: () => 0, clearTimeout() { }, performance: { now: () => clock.t } });
    ctx.window = ctx; ctx.matchMedia = q => ({ matches: !!o.reduced && /prefers-reduced-motion:\s*reduce\b/.test(q) }); ctx.scrollBy = opts => { scrolls.push(opts); }; ctx.innerWidth = 800; ctx.innerHeight = 900; ctx.addEventListener = (t, fn) => { (ctx.__wl = ctx.__wl || {})[t] = (ctx.__wl[t] || []).concat(fn); };
    ctx.additionalLayers = layers; ctx.activeLayer = o.active === undefined ? 'base' : o.active; ctx.timeline = o.timeline === undefined ? null : o.timeline;
    ctx.millis = () => clock.t;
    ctx.netAuthorWarpActive = () => !!ctx.__netActive;
    ctx.timelineNetSummary = () => ctx.__summary || null;
    ctx.__override = o.override === undefined ? null : o.override;
    ctx.layerApi = {
        select(sheet) { calls.push(['select', sheet]); ctx.activeLayer = sheet; },
        add() { calls.push(['add']); layers.push({ connections: [], enabled: true }); ctx.activeLayer = layers.length - 1; },
        remove(i) { calls.push(['remove', i]); layers.splice(i, 1); },
        setEnabled(i, on) { calls.push(['setEnabled', i, on]); if (layers[i]) layers[i].enabled = !!on; },
        toggleMore() { calls.push(['toggleMore']); },
        addToTimeline() {
            calls.push(['addToTimeline']);
            if (o.refuse) { status.textContent = o.refuse; return; }
            if (o.acceptWithStatus) status.textContent = o.acceptWithStatus;   // an ACCEPTED add that still writes a status (e.g. "Net not animated: keyframe 2 has no net captured")
            const i = ctx.activeLayer;
            if (!ctx.timeline) ctx.timeline = { keyframeLayerIds: [i], playbackLayerIndex: null, segmentDurationsMs: [], segmentPairings: [], segmentFlips: [], segmentMembers: [], netStates: [null], elapsedMs: 0, playing: false, startTime: null };
            else { ctx.timeline.keyframeLayerIds.push(i); ctx.timeline.segmentDurationsMs.push(2000); ctx.timeline.segmentPairings.push(null); ctx.timeline.segmentFlips.push(null); ctx.timeline.segmentMembers.push(null); }
            if (!o.acceptWithStatus) status.textContent = '';
        },
        removeKeyframe(i) { calls.push(['removeKeyframe', i]); const tl = ctx.timeline; const pos = tl.keyframeLayerIds.indexOf(i); tl.keyframeLayerIds.splice(pos, 1); if (tl.keyframeLayerIds.length === 0) ctx.timeline = null; },
        play() { calls.push(['play']); if (ctx.timeline) ctx.timeline.playing = !ctx.timeline.playing; },
        setProgress(t) { calls.push(['setProgress', t]); if (ctx.timeline) { const tot = ctx.timeline.segmentDurationsMs.reduce((a, b) => a + b, 0); ctx.timeline.elapsedMs = t * tot; ctx.timeline.playing = false; } },
        clearTimeline() { calls.push(['clearTimeline']); ctx.timeline = null; },
        includeNet() { return ctx.__override; },
        toggleIncludeNet() { calls.push(['toggleIncludeNet']); const shown = ctx.__override === null ? !!ctx.__netActive : ctx.__override; const next = !shown; ctx.__override = next === !!ctx.__netActive ? null : next; },
    };
    vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    vm.runInContext(TLJS, ctx, { filename: 'ui-timeline.js' });
    if (!o.noLayersScript) vm.runInContext(LAYERS, ctx, { filename: 'ui-layers.js' });
    const clk = b => { b.dispatch('click', { detail: 1 }); while (moq.length) moq.shift()([]); };
    const sync = () => ctx.window.uiSync();
    const s = tstrip ? { play: tstrip.children[0], bar: tstrip.children[1], net: tstrip.children[2], more: tstrip.children[3], marks: () => tstrip.children[1].children[0].children, input: tstrip.children[1].children[1] } : null;
    const rcell = key => { const g1 = rail.children[0].children, g2 = rail.children[1].children; for (const b of [g1[0]].concat(g1[1].children, [g1[2]], g2)) if (b.dataset.key === key) return b; return null; };
    const tcell = key => { for (const r of [table.children[0]].concat(table.children[1].children)) for (const b of r.children) if (b.dataset.key === key) return b; return null; };
    return { ctx, doc, byId, calls, layers, clk, sync, s, rail, table, rcell, tcell, status, toastEl, group, clearBtn, lrd, tcd, clock, moq, scrolls };
}
const L = x => Object.assign({ connections: [], enabled: true }, x || {});
const tlOf = (ids, extra) => Object.assign({ keyframeLayerIds: ids.slice(), playbackLayerIndex: ids.length > 1 ? 99 : null, segmentDurationsMs: ids.slice(1).map(() => 2000), segmentPairings: ids.slice(1).map(() => null), segmentFlips: ids.slice(1).map(() => null), segmentMembers: ids.slice(1).map(() => null), netStates: ids.map(() => null), elapsedMs: 0, playing: false, startTime: null }, extra || {});
const toastText = e => (e.toastEl.children.length ? e.toastEl.children[e.toastEl.children.length - 1].children[0].textContent : null);   // the newest notice's text, or null

T('strip', () => {
    let e = build({});
    check('the strip is built into #timeline-strip: Play, the scrub bar (marks, then a real range input), the Include net switch, "Mehr"; every button is a real <button type="button"> with an aria-label and a title (UI.name), no p5 mousedown listener', !!e.s && e.s.play.tagName === 'BUTTON' && e.s.net.tagName === 'BUTTON' && e.s.more.tagName === 'BUTTON' && [e.s.play, e.s.net, e.s.more].every(b => b.type === 'button' && !!b.getAttribute('aria-label') && !!b.getAttribute('title')) && e.s.input.tagName === 'INPUT' && e.s.input.type === 'range' && ![e.s.play, e.s.net, e.s.more, e.s.input].some(b => b.handlers.mousedown));
    check('the scrub bar: aria-label "Zeitleiste", min 0, max 1, step 0.001, aria-valuetext "0 %"; the marks container is aria-hidden', e.s.input.getAttribute('aria-label') === 'Zeitleiste' && e.s.input.min === '0' && e.s.input.max === '1' && e.s.input.step === '0.001' && e.s.input.getAttribute('aria-valuetext') === '0 %' && e.s.bar.children[0].getAttribute('aria-hidden') === 'true');
    check('names: Play "Abspielen"; Include net "Netz aufnehmen: automatisch (aus)" without a net; "Zeitleiste: Mehr" closed (aria-expanded false, aria-controls the old group)', e.s.play.getAttribute('aria-label') === 'Abspielen' && e.s.net.getAttribute('aria-label') === 'Netz aufnehmen: automatisch (aus)' && e.s.more.getAttribute('aria-label') === 'Zeitleiste: Mehr' && e.s.more.getAttribute('aria-expanded') === 'false' && e.s.more.getAttribute('aria-controls') === 'timeline-group', 'play=' + e.s.play.getAttribute('aria-label') + '; net=' + e.s.net.getAttribute('aria-label') + '; more=' + e.s.more.getAttribute('aria-label'));
    check('below two keyframes (none) Play and the scrub bar are PRESENT and aria-disabled with the reason "Mindestens zwei Keyframes nötig" (title = the reason); a click on either calls nothing', e.s.play.getAttribute('aria-disabled') === 'true' && e.s.input.getAttribute('aria-disabled') === 'true' && e.s.play.dataset.reason === 'Mindestens zwei Keyframes nötig' && e.s.input.dataset.reason === 'Mindestens zwei Keyframes nötig' && (e.clk(e.s.play), e.clk(e.s.input), e.calls.length === 0));
    e.s.input.value = '0.5'; e.s.input.dispatch('input');
    check('...and an input event on the disabled scrub bar (a key on it) calls nothing and puts the thumb back to 0', e.calls.length === 0 && e.s.input.value === '0');
    e = build({ layers: [L()], timeline: tlOf([0]), active: 0 });
    check('with ONE keyframe Play and the scrub bar stay disabled', e.s.play.getAttribute('aria-disabled') === 'true' && e.s.input.getAttribute('aria-disabled') === 'true');
    e = build({ layers: [L(), L(), L({ isTimelinePlayback: true })], timeline: tlOf([0, 1]), active: 0 });
    check('with two keyframes both are enabled (no aria-disabled), and the two marks are in place: --f 0 and 1, aria-hidden, with the keyframes\' layer index', e.s.play.getAttribute('aria-disabled') === null && e.s.input.getAttribute('aria-disabled') === null && e.s.marks().length === 2 && J(e.s.marks().map(m => m.getAttribute('style'))) === J(['--f:0', '--f:1']) && e.s.marks().every(m => m.getAttribute('aria-hidden') === 'true') && J(e.s.marks().map(m => m.dataset.index)) === J(['0', '1']));
    e.clk(e.s.play);
    check('Play calls layerApi.play() once; the button turns into Pause (name "Pause") while the timeline plays and back', J(e.calls) === J([['play']]) && (e.sync(), e.s.play.getAttribute('aria-label') === 'Pause') && (e.clk(e.s.play), e.sync(), e.s.play.getAttribute('aria-label') === 'Abspielen'));
    e.calls.length = 0; e.s.input.value = '0.25'; e.s.input.dispatch('input');
    check('the scrub bar calls layerApi.setProgress(<its value>) once per input and the spoken value follows at once ("25 %")', J(e.calls) === J([['setProgress', 0.25]]) && e.s.input.getAttribute('aria-valuetext') === '25 %');
    // the thumb
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1], { elapsedMs: 1000 }), active: 0 });
    e.sync();
    check('the thumb follows the timeline on every tick: elapsedMs 1000 of 2000 -> 0.5 and "50 %"', e.s.input.value === '0.5' && e.s.input.getAttribute('aria-valuetext') === '50 %');
    e.ctx.timeline.playing = true; e.ctx.timeline.startTime = 0; e.clock.t = 1500; e.sync();
    check('...while it plays the thumb follows the CLOCK (now - startTime = 1500 of 2000 -> 0.75), not elapsedMs', e.s.input.value === '0.75');
    e.s.input.dispatch('pointerdown'); e.clock.t = 500; e.sync();
    check('...but it is NOT overwritten while the person drags it (a pointerdown on the bar): the tick leaves the value alone', e.s.input.value === '0.75');
    e.s.input.dispatch('pointerup'); e.sync();
    check('...it follows again after the pointer is released (0.25 at clock 500)', e.s.input.value === '0.25');
    e.s.input.dispatch('keydown'); e.clock.t = 1000; e.sync();
    check('...a key held on it (keydown) protects it too, until keyup', e.s.input.value === '0.25' && (e.s.input.dispatch('keyup'), e.sync(), e.s.input.value === '0.5'));
    // marks follow the durations
    e = build({ layers: [L(), L(), L()], timeline: tlOf([0, 1, 2]), active: 0 });
    e.ctx.timeline.segmentDurationsMs = [1000, 3000]; e.sync();
    check('the marks are rebuilt when the durations change (1000 / 3000: 0, 0.25, 1)', J(e.s.marks().map(m => m.getAttribute('style'))) === J(['--f:0', '--f:0.25', '--f:1']));
    // Mehr
    e.clk(e.s.more);
    check('"Mehr" opens the old group (class ts-open on #timeline-group, aria-expanded true) and closes it again; it is closed by default', e.group.classList.contains('ts-open') === true && e.s.more.getAttribute('aria-expanded') === 'true' && (e.clk(e.s.more), !e.group.classList.contains('ts-open') && e.s.more.getAttribute('aria-expanded') === 'false'));
    // Include net
    e = build({});
    check('Include net is operable WITHOUT an active net (not aria-disabled); a click calls layerApi.toggleIncludeNet() once and the state follows: "Netz aufnehmen: immer", aria-pressed true, the black (active) look', e.s.net.getAttribute('aria-disabled') === null && (e.clk(e.s.net), J(e.calls) === J([['toggleIncludeNet']]) && e.s.net.getAttribute('aria-pressed') === 'true' && e.s.net.getAttribute('aria-label') === 'Netz aufnehmen: immer' && e.s.net.classList.contains('active')));
    check('...a second click returns to automatic ("automatisch (aus)", aria-pressed false); with a net active the automatic value is on ("automatisch (an)", pressed) and the click goes to "nie"', (e.clk(e.s.net), e.s.net.getAttribute('aria-pressed') === 'false' && e.s.net.getAttribute('aria-label') === 'Netz aufnehmen: automatisch (aus)') && (e.ctx.__netActive = true, e.sync(), e.s.net.getAttribute('aria-pressed') === 'true' && e.s.net.getAttribute('aria-label') === 'Netz aufnehmen: automatisch (an)') && (e.clk(e.s.net), e.s.net.getAttribute('aria-pressed') === 'false' && e.s.net.getAttribute('aria-label') === 'Netz aufnehmen: nie \u2013 das Netz bewegt sich nicht mit der Zeitleiste' && e.s.net.getAttribute('title') === 'Netz aufnehmen: nie \u2013 das Netz bewegt sich nicht mit der Zeitleiste' && e.s.net.classList.contains('has-state')) && (e.clk(e.s.net), !e.s.net.classList.contains('has-state') && e.s.net.getAttribute('aria-label') === 'Netz aufnehmen: automatisch (an)') && (e.clk(e.s.net), e.ctx.__netActive = false, e.sync(), !e.s.net.classList.contains('has-state') && e.s.net.getAttribute('aria-label') === 'Netz aufnehmen: nie'));
    e = build({});
    e.ctx.__summary = { state: 'partial', text: 'x' }; e.sync();
    check('the state dot (has-state) shows while the Timeline\'s net is "partial" or "incompatible" and goes with "animated"', e.s.net.classList.contains('has-state') && (e.ctx.__summary = { state: 'incompatible', text: 'y' }, e.sync(), e.s.net.classList.contains('has-state')) && (e.ctx.__summary = { state: 'animated', text: 'z' }, e.sync(), !e.s.net.classList.contains('has-state')));
    check('there is exactly ONE Include net switch in the strip (one .ts-net button) and the old one is not re-built here', tlStripButtons(e) === 1);
    function tlStripButtons(x) { return x.s ? [x.s.play, x.s.net, x.s.more].filter(b => b.classList.contains('ts-net')).length : 0; }
    // "Zeitleiste entfernen"
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1]), active: 0 });
    e.sync();
    check('"Zeitleiste entfernen" is visible while a timeline exists and hidden without one', e.clearBtn.hidden === false && (e.ctx.timeline = null, e.sync(), e.clearBtn.hidden === true));
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1]), active: 0 });
    e.sync(); e.clearBtn.focus(); e.clk(e.clearBtn);
    check('it ALWAYS asks: the dialog opens ("Zeitleiste entfernen?", the text says keyframes, pairings and net snapshots are discarded, the layers stay), Cancel has the focus order (first), clearTimeline is not called yet', !e.tcd.ov.classList.contains('hidden') && e.byId['timeline-confirm-title'].textContent === 'Zeitleiste entfernen?' && /Keyframes, Linienzuordnungen und Netz-Schnappschüsse/.test(e.byId['timeline-confirm-text'].textContent) && /Ebenen selbst bleiben erhalten/.test(e.byId['timeline-confirm-text'].textContent) && e.tcd.k.textContent === 'Zeitleiste entfernen' && e.calls.length === 0 && e.tcd.ov.children[0].children.indexOf(e.tcd.c) < e.tcd.ov.children[0].children.indexOf(e.tcd.k));
    e.clk(e.tcd.c);
    check('...Cancel closes it without clearing and the focus returns to the button that opened it', e.calls.length === 0 && e.tcd.ov.classList.contains('hidden') && e.doc.activeElement === e.clearBtn);
    e.clk(e.clearBtn); e.clk(e.tcd.k);
    check('...Confirm calls layerApi.clearTimeline() once and closes the dialog', J(e.calls) === J([['clearTimeline']]) && e.tcd.ov.classList.contains('hidden') && e.ctx.timeline === null);
});

T('diamonds', () => {
    // table: column 3, the Base row has none
    let e = build({ layers: [L(), L(), L({ isTimelinePlayback: true }), L()], timeline: tlOf([0, 1]), active: 'base' });
    e.sync();
    check('the TABLE: every layer row has a diamond (key dia:N) between the eye and the x; the Base row has none (an empty cell); the playback layer has no row and so no diamond', e.table.children[0].children.length === 1 && J(e.table.children[1].children[0].children.map(b => b.dataset.key)) === J(['chip:0', 'eye:0', 'dia:0', 'x:0']) && !e.tcell('dia:2') && !!e.tcell('dia:3'));
    check('...filled = a keyframe (data-body "on"), outline = not; named "Ebene N aus der Zeitleiste entfernen" / "Ebene N zur Zeitleiste hinzufügen" (the RUNNING number: the plain layer at array index 3 is "Ebene 3")', e.tcell('dia:0').dataset.body === 'on' && e.tcell('dia:1').dataset.body === 'on' && e.tcell('dia:3').dataset.body === 'off' && e.tcell('dia:0').getAttribute('aria-label') === 'Ebene 1 aus der Zeitleiste entfernen' && e.tcell('dia:3').getAttribute('aria-label') === 'Ebene 3 zur Zeitleiste hinzufügen' && e.tcell('dia:3').getAttribute('title') === e.tcell('dia:3').getAttribute('aria-label'));
    // outline click: select first, then add
    e = build({ layers: [L({ connections: [[1, 2]] }), L({ connections: [[1, 2]] })], active: 'base' });
    e.sync(); e.clk(e.tcell('dia:1'));
    check('an OUTLINE diamond in the table: layerApi.select(<its layer>) FIRST, then layerApi.addToTimeline(): the order of the calls is [select 1, addToTimeline]; the layer becomes a keyframe and its diamond fills', J(e.calls) === J([['select', 1], ['addToTimeline']]) && e.ctx.timeline.keyframeLayerIds.join() === '1' && e.tcell('dia:1').dataset.body === 'on' && toastText(e) === null);
    // refusal
    e = build({ layers: [L(), L()], active: 'base', refuse: 'Layer 2 not added: its net cannot be interpolated with Layer 1\'s net - the law family differs on the X axis (trig vs geometric).' });
    e.sync(); e.clk(e.tcell('dia:1'));
    check('a REFUSED add (addLayerToTimeline returns nothing: the layer is not a keyframe afterwards, so the diamond stays outline; the message is the notice sketch.js\'s setTimelineStatus shows - the DIAMOND itself shows none any more) changes nothing: the diamond stays outline, no timeline, no toast from the diamond', J(e.calls) === J([['select', 1], ['addToTimeline']]) && toastText(e) === null && e.ctx.timeline === null && e.tcell('dia:1').dataset.body === 'off' && /^Layer 2 not added: its net cannot be interpolated/.test(e.status.textContent));
    // an ACCEPTED add whose status line is not empty (partial net: "Net not animated ...") is no refusal: no toast
    e = build({ layers: [L(), L()], active: 'base', acceptWithStatus: 'Net not animated: keyframe 2 has no net captured (use "Net" on the keyframe)' });
    e.sync(); e.clk(e.tcell('dia:1'));
    check('an ACCEPTED add that still writes a status line (a partial net: "Net not animated: keyframe 2 has no net captured") is no refusal: the keyframe is there, the diamond is filled and the diamond shows NO toast (it never does; the status text is the readout in the Mehr group)', e.ctx.timeline && e.ctx.timeline.keyframeLayerIds.join() === '1' && e.tcell('dia:1').dataset.body === 'on' && toastText(e) === null && /Net not animated/.test(e.status.textContent));
    // remove without pairing
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1]), active: 0 });
    e.sync(); e.clk(e.tcell('dia:1'));
    check('a FILLED diamond without a set pairing removes the keyframe at once: layerApi.removeKeyframe(<index>), no dialog, no select, no add', J(e.calls) === J([['removeKeyframe', 1]]) && (!e.tcd || e.tcd.ov.classList.contains('hidden')) && e.ctx.timeline.keyframeLayerIds.join() === '0');
    // remove with pairing
    e = build({ layers: [L(), L(), L()], timeline: tlOf([0, 1, 2], { segmentPairings: [[1, 0], null] }), active: 0 });
    e.sync(); e.tcell('dia:1').focus(); e.clk(e.tcell('dia:1'));
    check('a FILLED diamond whose removal would discard a user-set pairing (the middle keyframe, segment 0 set) asks: the dialog opens ("Ebene 2 aus der Zeitleiste entfernen?", the text names the lost pairing and says the layer stays), removeKeyframe NOT called yet', !e.tcd.ov.classList.contains('hidden') && e.byId['timeline-confirm-title'].textContent === 'Ebene 2 aus der Zeitleiste entfernen?' && /Linienzuordnung/.test(e.byId['timeline-confirm-text'].textContent) && /Ebene selbst bleibt erhalten/.test(e.byId['timeline-confirm-text'].textContent) && e.calls.length === 0);
    e.clk(e.tcd.c);
    check('...Cancel (the default focus: it comes first) closes it, removes nothing and the focus returns to THAT diamond', e.calls.length === 0 && e.tcd.ov.classList.contains('hidden') && e.doc.activeElement === e.tcell('dia:1') && e.ctx.timeline.keyframeLayerIds.length === 3);
    e.clk(e.tcell('dia:1')); e.clk(e.tcd.k);
    check('...Confirm removes THAT keyframe once (removeKeyframe(1)) and closes the dialog; the diamond turns outline', J(e.calls) === J([['removeKeyframe', 1]]) && e.tcd.ov.classList.contains('hidden') && e.tcell('dia:1').dataset.body === 'off');
    e = build({ layers: [L(), L(), L()], timeline: tlOf([0, 1, 2], { segmentPairings: [null, [1, 0]] }), active: 0 });
    e.sync(); e.clk(e.tcell('dia:0'));
    check('...the FIRST keyframe with only segment 1 set does not ask (removing it drops segment 0 only)', J(e.calls) === J([['removeKeyframe', 0]]) && e.tcd.ov.classList.contains('hidden'));
    // narrow views: the 4th button
    e = build({ layers: [L(), L()], timeline: tlOf([0]), active: 1 });
    e.sync();
    check('the RAIL: the diamond is the 4th button, the active layer\'s (order eye, diamond, "...", x); outline for a layer that is not a keyframe; named for the RUNNING number', J(e.rail.children[1].children.map(b => b.dataset.key)) === J(['eye', 'dia', 'more', 'x']) && e.rcell('dia').dataset.body === 'off' && e.rcell('dia').getAttribute('aria-label') === 'Ebene 2 zur Zeitleiste hinzufügen');
    e.clk(e.rcell('dia'));
    check('...a click on it: select(<the active layer>) then addToTimeline(); the diamond fills and is named "aus der Zeitleiste entfernen"; the same layer\'s table diamond fills on the same tick', J(e.calls) === J([['select', 1], ['addToTimeline']]) && e.rcell('dia').dataset.body === 'on' && e.rcell('dia').getAttribute('aria-label') === 'Ebene 2 aus der Zeitleiste entfernen' && e.tcell('dia:1').dataset.body === 'on');
    e = build({});
    check('on the Base the rail\'s diamond is PRESENT and aria-disabled with the reason "Keine Ebene aktiv." (title = the reason); a click calls nothing', e.rcell('dia').getAttribute('aria-disabled') === 'true' && e.rcell('dia').dataset.reason === 'Keine Ebene aktiv.' && (e.clk(e.rcell('dia')), e.calls.length === 0) && toastText(e) === 'Keine Ebene aktiv.');
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1]), active: 1, refuse: 'x' });
    e.sync(); e.clk(e.rcell('dia'));
    check('a filled rail diamond removes the ACTIVE layer\'s keyframe (removeKeyframe(1)), asking only with a set pairing (none here)', J(e.calls) === J([['removeKeyframe', 1]]));
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1], { segmentFlips: [[true]] }), active: 1 });
    e.sync(); e.rcell('dia').focus(); e.clk(e.rcell('dia'));
    check('...with a set flip it asks, Cancel returns the focus to the RAIL\'s diamond', !e.tcd.ov.classList.contains('hidden') && (e.clk(e.tcd.c), e.doc.activeElement === e.rcell('dia') && e.calls.length === 0));
    // without the dialog script
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1], { segmentPairings: [[1, 0]] }), active: 0, noConfirm: true });
    e.sync(); e.clk(e.tcell('dia:1'));
    check('a page without the confirmation (ui-timeline.js dialog absent) still removes (no throw)', J(e.calls) === J([['removeKeyframe', 1]]));
    // last keyframe: the playback layer disappears, the chip numbers must not jump
    e = build({ layers: [L(), L(), L({ isTimelinePlayback: true }), L()], timeline: tlOf([0, 1]), active: 0 });
    e.sync();
    const before = [0, 1, 3].map(i => e.tcell('chip:' + i).textContent).join();
    e.ctx.layerApi.removeKeyframe = i => { e.calls.push(['removeKeyframe', i]); e.layers.splice(2, 1); e.ctx.timeline = null; };   // the real function takes the playback layer out of additionalLayers when the timeline drops to one keyframe
    e.clk(e.tcell('dia:1')); e.sync();
    check('the chip numbers do not jump when the playback layer goes away with a keyframe (1, 2, 3 before and after; the plain layer moves from array index 3 to 2)', before === '1,2,3' && [0, 1, 2].map(i => e.tcell('chip:' + i).textContent).join() === '1,2,3');
    // ---- "Mehr" brings the WHOLE old group into view with the layer block's reveal (commit 7) ----
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1]), active: 0 });
    e.sync(); e.s.more.focus(); e.clk(e.s.more);
    check('opening "Mehr" with the group below the fold (the union of its two visible children 900..1010 in a 900px viewport; a [hidden] child at 5000..6000 and a child without client rects at 7000..8000 do not count): window.scrollBy is called ONCE with { top: 110, behavior: \'smooth\' } (the whole group ends at the bottom edge); the focus stays on the toggle', e.scrolls.length === 1 && J(e.scrolls[0]) === J({ top: 110, behavior: 'smooth' }) && e.doc.activeElement === e.s.more && e.s.more.getAttribute('aria-expanded') === 'true');
    e.clk(e.s.more);
    check('...closing it scrolls nothing; a second open scrolls again', e.scrolls.length === 1 && e.s.more.getAttribute('aria-expanded') === 'false' && (e.clk(e.s.more), e.scrolls.length === 2));
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1]), active: 0, groupRects: [[200, 260], [270, 320]] });
    e.sync(); e.clk(e.s.more);
    check('...no scroll when the WHOLE group is already inside the viewport (200..320)', e.scrolls.length === 0 && e.s.more.getAttribute('aria-expanded') === 'true');
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1]), active: 0, groupRects: [[800, 860], [870, 920]] });
    e.sync(); e.clk(e.s.more);
    check('...a group whose FIRST child is visible but whose last child is cut (800..920 in 900) scrolls by the overhang, 20px', e.scrolls.length === 1 && J(e.scrolls[0]) === J({ top: 20, behavior: 'smooth' }));
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1]), active: 0, groupRects: [[-40, 10], [20, 60]] });
    e.sync(); e.clk(e.s.more);
    check('...a group starting above the top (-40..60) scrolls up by 40 (a negative delta)', e.scrolls.length === 1 && J(e.scrolls[0]) === J({ top: -40, behavior: 'smooth' }));
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1]), active: 0, groupRects: [[100, 600], [610, 1100]] });
    e.sync(); e.clk(e.s.more);
    check('...a group TALLER than the viewport (100..1100 in 900) aligns its top edge to the viewport top with an 8px margin: scrollBy top 92', e.scrolls.length === 1 && J(e.scrolls[0]) === J({ top: 92, behavior: 'smooth' }));
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1]), active: 0, reduced: true });
    e.sync(); e.clk(e.s.more);
    check('...with prefers-reduced-motion the behaviour is \'auto\' (the fake matches only `prefers-reduced-motion: reduce`)', e.scrolls.length === 1 && J(e.scrolls[0]) === J({ top: 110, behavior: 'auto' }));
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1]), active: 0 });
    e.sync(); e.group.classList.add('ts-open'); e.s.more.focus(); e.ctx.layerTable.revealPanel(e.group);
    check('...it is the layer block\'s function, not a copy: calling layerTable.revealPanel(group) by hand gives the same single scroll (top 110, smooth)', e.scrolls.length === 1 && J(e.scrolls[0]) === J({ top: 110, behavior: 'smooth' }) && typeof e.ctx.layerTable.revealPanel === 'function');
    e = build({ layers: [L(), L()], timeline: tlOf([0, 1]), active: 0, noLayersScript: true });
    e.sync(); e.clk(e.s.more);
    check('a page without ui-layers.js (no layerTable): "Mehr" still opens and does not throw (no reveal, nothing else breaks)', e.s.more.getAttribute('aria-expanded') === 'true' && e.group.classList.contains('ts-open') && e.scrolls.length === 0);
});

// ================= 3. the source =================
console.log('\n== the markup, the CSS, ui-timeline.js and the sketch.js block ==');
T('source', () => {
    const rowStart = HTML.indexOf('<div class="canvas-row">'), rowEnd = HTML.indexOf('<div class="main-container">');
    const row = rowStart >= 0 && rowEnd > rowStart ? HTML.slice(rowStart, rowEnd) : '';
    const tag = (row.match(/<div id="timeline-strip"[^>]*>/) || [''])[0];
    check('#timeline-strip is a child of the canvas row DIRECTLY after #canvas-container and BEFORE #layer-strip and .rail-left (canvas, timeline strip, layer strip, the tool rail\'s rows: the DOM order is the visual order on a phone), role="group", aria-label, data-i18n, empty in the markup', /class="timeline-strip"/.test(tag) && /role="group"/.test(tag) && /aria-label="Zeitleiste"/.test(tag) && /data-i18n="timeline\.strip"/.test(tag) && (row.match(/id="timeline-strip"/g) || []).length === 1 && /<div id="canvas-container"><\/div>\s*<!--[\s\S]*?-->\s*<div id="timeline-strip"[^>]*><\/div>\s*<!--[\s\S]*?-->\s*<div id="layer-strip"/.test(row) && row.indexOf('id="timeline-strip"') < row.indexOf('id="layer-strip"') && row.indexOf('id="layer-strip"') < row.indexOf('class="rail-left"'));
    // the reveal exists ONCE: ui-layers.js has it; ui-timeline.js only calls it; no other script scrolls the page
    const stripCode = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const scripts = { 'ui-layers.js': LAYERS, 'ui-timeline.js': TLJS, 'sketch.js': SKETCH };
    fs.readdirSync(ROOT).filter(f => /^(ui|gallery).*\.js$/.test(f) && !(f in scripts)).forEach(f => { scripts[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
    const withScroll = Object.keys(scripts).filter(f => /\bscrollBy\s*\(/.test(stripCode(scripts[f]))).sort();
    const tlCode = stripCode(TLJS);
    check('ONE reveal implementation: window.scrollBy( appears in ui-layers.js (once, in revealPanel) and in no other script (gallery.js and sketch.js scroll for their own reasons with scrollTo / scrollIntoView); ui-timeline.js has no scrollBy / scrollTo / scrollIntoView, no panelRevealDelta, no rect measuring and no innerHeight - it only calls layerTable.revealPanel(group), once, and only when "Mehr" has just opened', J(withScroll) === J(['ui-layers.js']) && (stripCode(LAYERS).match(/window\.scrollBy\(/g) || []).length === 1 && !/\bscroll(By|To|IntoView)\s*\(/.test(tlCode) && !/panelRevealDelta|getBoundingClientRect|getClientRects|innerHeight|visualViewport/.test(tlCode) && (tlCode.match(/revealPanel\(/g) || []).length === 1 && /if \(moreOpen && group && root\.layerTable && root\.layerTable\.revealPanel\) root\.layerTable\.revealPanel\(group\);/.test(tlCode) && /moreBtn\.addEventListener\('click', function \(\) \{ setMore\(!moreOpen\); sync\(\); if \(moreOpen/.test(tlCode));
    const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const noMedia = (() => { let t = css; for (;;) { const i = t.indexOf('@media'); if (i < 0) return t; let d = 0, j = t.indexOf('{', i), k = j; for (; k < t.length; k++) { if (t[k] === '{') d++; else if (t[k] === '}') { d--; if (!d) break; } } t = t.slice(0, i) + t.slice(k + 1); } })();
    check('the old controls are hidden at EVERY width (a top-level rule): Add to Timeline, the old Include net, the old Play row, the old progress input and Remove Timeline - the DOM stays', /#btn-add-to-timeline, #btn-timeline-include-net, #timeline-playback-controls, #timeline-progress-input, #btn-remove-timeline\s*\{\s*display:\s*none;\s*\}/.test(noMedia) && ['btn-add-to-timeline', 'btn-timeline-include-net', 'timeline-playback-controls', 'timeline-progress-input', 'btn-remove-timeline', 'btn-timeline-play'].every(id => HTML.includes('id="' + id + '"')));
    check('the old group #timeline-group is collapsed unless "Mehr" is open (a top-level rule: display: none unless .ts-open) and holds the keyframe list, the net status and warning, the pairing editor, the status line and the NEW "Zeitleiste entfernen" button', /#timeline-group:not\(\.ts-open\)\s*\{\s*display:\s*none;\s*\}/.test(noMedia) && (() => { const g = (HTML.match(/<div class="control-group" id="timeline-group">[\s\S]*?<span id="timeline-status"><\/span>\s*<\/div>/) || [''])[0]; return ['timeline-keyframe-list', 'timeline-net-state', 'timeline-net-warning', 'timeline-pairing', 'timeline-status', 'btn-clear-timeline'].every(id => g.includes('id="' + id + '"')); })());
    check('the strip\'s layout: a flex row (gap var(--gap)); on the phone a full line (flex: 0 0 100%); from 768px the SECOND grid row in the canvas column (grid-column: 2; grid-row: 2), as wide as the canvas (var(--canvas-size)) and centred - the canvas row\'s own rules are not touched', /\.timeline-strip\s*\{[^}]*display:\s*flex[^}]*gap:\s*var\(--gap\)[^}]*flex:\s*0 0 100%/.test(css) && /@media \(min-width: 768px\)\s*\{\s*\.timeline-strip\s*\{[^}]*flex:\s*none[^}]*grid-column:\s*2[^}]*grid-row:\s*2[^}]*width:\s*var\(--canvas-size\)[^}]*justify-self:\s*center/.test(CSS.replace(/\/\*[\s\S]*?\*\//g, '')));
    check('the scrub bar is as high as a button (var(--target)), has the slider look (6px track, 14px thumb), and the marks are decorative (pointer-events: none) positioned from --f over the track minus the thumb', /\.timeline-strip \.ts-range\s*\{[^}]*height:\s*var\(--target\)/.test(css) && /\.timeline-strip \.ts-range::-webkit-slider-runnable-track\s*\{[^}]*height:\s*6px/.test(css) && /--ts-thumb:\s*14px/.test(css) && /\.timeline-strip \.ts-marks\s*\{[^}]*pointer-events:\s*none/.test(css) && /left:\s*calc\(var\(--ts-thumb\) \/ 2 \+ var\(--f, 0\) \* \(100% - var\(--ts-thumb\)\)\)/.test(css));
    check('the table keeps its reserved width and now draws column 3: `.layer-table .lt-dia { grid-column: 3 }` next to the eye (2) and the x (4); the width rule is unchanged (4 x --target + 3 gaps)', /\.layer-table \.lt-dia\s*\{\s*grid-column:\s*3;\s*\}/.test(css) && /\.layer-table \.lt-eye\s*\{\s*grid-column:\s*2;\s*\}/.test(css) && /\.layer-table \.lt-x\s*\{\s*grid-column:\s*4;\s*\}/.test(css) && /width:\s*calc\(4 \* var\(--target\) \+ 3 \* var\(--rail-gap\)\)/.test(css));
    check('the confirmation dialog: a dialog-overlay (hidden), Cancel BEFORE Confirm, the confirm button is class="dialog-danger" (the red text and border of commit 3), data-i18n on the buttons', (() => { const ov = (HTML.match(/<div id="timeline-confirm-overlay"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/) || [''])[0]; return /class="dialog-overlay hidden"/.test(ov) && ov.indexOf('id="cancel-timeline-confirm"') > 0 && ov.indexOf('id="confirm-timeline-confirm"') > ov.indexOf('id="cancel-timeline-confirm"') && /id="confirm-timeline-confirm" class="dialog-danger"/.test(ov) && /data-i18n="timeline\.confirm\.cancel"/.test(ov); })());
    const order = ['<script src="sketch.js', '<script src="ui.js', '<script src="ui-layer.js', '<script src="ui-timeline.js', '<script src="ui-layers.js', '<script src="ui-net.js'].map(s => HTML.indexOf(s));
    check('ui-timeline.js is loaded with a ?v= after ui.js and before ui-layers.js (the diamonds use its model and its dialog), ui-layers.js before ui-net.js', order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])) && /<script src="ui-timeline\.js\?v=\w+"><\/script>/.test(HTML), order.join(','));
    // ui-timeline.js
    const code = TLJS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    check('ui-timeline.js has no p5 binding (no mousePressed, no select(), no mousedown listener), writes no sketch state (no assignment to timeline / activeLayer / additionalLayers) and calls ONLY window.layerApi for actions (play, setProgress, toggleIncludeNet, clearTimeline) and reads includeNet', !/mousePressed|[^.\w]select\(|addEventListener\('mousedown'/.test(code) && !/(^|[;{}\n])\s*(timeline|activeLayer|additionalLayers)\s*=[^=]/.test(code) && ['play', 'setProgress', 'toggleIncludeNet', 'clearTimeline', 'includeNet'].every(m => new RegExp('api\\(\\)\\.' + m + '\\(').test(code)) && ['UI.guard(', 'UI.name(', 'UI.setDisabled(', 'UI.dialog(', 'UI.onSync('].every(x => code.includes(x)));
    check('ui-timeline.js: exactly ONE Include net switch is built (one .ts-net), the thumb is guarded while the person drags or holds a key (pointerdown / keydown set, pointerup / pointercancel / keyup / blur clear), Play and the scrub bar are disabled with UI.setDisabled and the reason', (code.match(/btn\('ts-net'/g) || []).length === 1 && /input\.addEventListener\('pointerdown', function \(\) \{ interacting = true; \}\)/.test(code) && /input\.addEventListener\('keydown', function \(\) \{ interacting = true; \}\)/.test(code) && /\['pointerup', 'pointercancel', 'keyup', 'blur'\]/.test(code) && /if \(!interacting\)/.test(code) && /UI\.setDisabled\(playBtn, reason\);/.test(code) && /UI\.setDisabled\(input, reason\);/.test(code));
    check('ui-layers.js: the diamond calls select THEN addToTimeline (in that order), removes through layerApi.removeKeyframe, asks through timelineConfirm only when diamondPlan says needsConfirm, shows NO toast and does not read #timeline-status (the refusal is a notice from sketch.js), and never writes sketch state', /api\(\)\.select\(index\);\s*api\(\)\.addToTimeline\(\);/.test(LAYERS) && /api\(\)\.removeKeyframe\(index\)/.test(LAYERS) && /if \(!plan\.needsConfirm \|\| !root\.timelineConfirm\)/.test(LAYERS) && !/UI\.toast\(|UI\.notify\(|timeline-status/.test(LAYERS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')) && !/(^|[;{}\n])\s*(activeLayer|additionalLayers|timeline)\s*=[^=]|\.enabled\s*=[^=]/.test(LAYERS));
    // the sketch.js block
    const bi = SKETCH.indexOf('    // layerApi: begin'), ei = SKETCH.indexOf('    // layerApi: end\n');
    const block = bi >= 0 && ei > bi ? SKETCH.slice(bi, ei) : '';
    const names = [...block.matchAll(/^        (\w+)\(/gm)].map(m => m[1]);
    check('sketch.js: the ONE layerApi block publishes the five old methods, the seven timeline ones (addToTimeline, removeKeyframe, play, setProgress, clearTimeline, includeNet, toggleIncludeNet) and moreState, each a single line of assignments / calls to EXISTING named functions or a getter; no if, loop, let, const or block comment (p5\'s friendly-error reader scans setup())', J(names) === J(['select', 'add', 'remove', 'setEnabled', 'toggleMore', 'addToTimeline', 'removeKeyframe', 'play', 'setProgress', 'clearTimeline', 'includeNet', 'toggleIncludeNet', 'moreState']) && !/\b(if|for|while|let|const)\b|\/\*/.test(block.replace(/\/\/[^\n]*/g, '')) && (SKETCH.match(/window\.layerApi\s*=/g) || []).length === 1);
    check('...every function the block calls exists once at the top level of sketch.js or core/ (addLayerToTimeline, removeKeyframeFromTimeline, toggleTimelinePlayback, setTimelineProgress, removeTimelineAction) and the setup-local ones it reaches are declared in the same setup() (syncTimelineDisplay, includeNetOverride, includeNetBtn)', ['addLayerToTimeline', 'removeKeyframeFromTimeline', 'toggleTimelinePlayback', 'setTimelineProgress', 'removeTimelineAction'].every(f => (SKETCH.match(new RegExp('^function ' + f + '\\(', 'm')) || []).length === 1) && /function syncTimelineDisplay\(\)/.test(SKETCH) && /let includeNetOverride = null;/.test(SKETCH) && /const includeNetBtn = select\('#btn-timeline-include-net'\)|includeNetBtn = select\('#btn-timeline-include-net'\)/.test(SKETCH));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
