// Guard for the routing of action messages to the notices (notices commit 10): sketch.js's say() and setTimelineStatus(text, kind), every route's key and kind, the elements that are no longer
// written, the removed #node-count-note, the diamond that no longer toasts. Three parts: the SOURCE text of sketch.js / ui-layers.js / index.html / style.css; the routing functions EXTRACTED from
// sketch.js and run in a vm with a stubbed UI (say and setTimelineStatus live inside setup(), so the real file cannot be loaded here); and the same functions together with the REAL ui.js in a
// fake DOM with injected timers (one notice per message, a repeat replaces it, the cap). The routes that sit in the middle of setup() handlers (paste, node-count, field, macro, align) and in
// pressAt() are pinned by source text; they were also triggered in the browser pane (see the commit message). No browser here.
//   node tools/ui/test-notify-routes.js
//   SKETCH_JS=... UI_LAYERS_JS=... INDEX_HTML=... STYLE_CSS=... UI_JS=... node tools/ui/test-notify-routes.js        (sabotage runs)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const SKETCH = read('SKETCH_JS', 'sketch.js'), LAYERS = read('UI_LAYERS_JS', 'ui-layers.js'), HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css'), UI_SRC = read('UI_JS', 'ui.js');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };
const J = x => JSON.stringify(x);
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const count = (s, re) => (s.match(re) || []).length;
const sk = strip(SKETCH);

// ================= 1. the source =================
console.log('== the source (sketch.js, ui-layers.js, index.html, style.css) ==');
T('source', () => {
    check('sketch.js: say(key, text, kind) exists, returns when window.UI or UI.notify is missing (sketch.js loads before ui.js), then notifyClear(key) FIRST and notify(text, { key, kind }) second, and is exposed as window.say (pressAt() is a top-level function)', /function say\(key, text, kind\) \{\s*if \(!window\.UI \|\| !UI\.notify\) return;\s*UI\.notifyClear\(key\);\s*UI\.notify\(text, \{ key: key, kind: kind \}\);\s*\}\s*window\.say = say;/.test(sk));
    check('sketch.js: say sits next to setTimelineStatus, before it (one block)', sk.indexOf('function say(') > 0 && sk.indexOf('function say(') < sk.indexOf('function setTimelineStatus(') && sk.indexOf('function setTimelineStatus(') - sk.indexOf('function say(') < 1500);
    // the routes: key and kind
    check('route a, Paste Pattern: the four error texts (clipboard unavailable, permission denied, no valid pattern, failed to load) are say(\'paste\', ..., \'error\'); the success path ends with UI.notifyClear(\'paste\'); the element is no longer looked up or written', count(sk, /say\('paste', [^;]*, 'error'\);/g) === 4 && /Clipboard access is not available[^;]*'error'/.test(sk) && /Clipboard permission denied[^;]*'error'/.test(sk) && /Clipboard does not contain a valid copied pattern[^;]*'error'/.test(sk) && /Failed to load the copied pattern[^;]*'error'/.test(sk) && count(sk, /UI\.notifyClear\('paste'\)/g) === 1 && !/pastePatternStatus|#paste-pattern-status/.test(sk));
    check('route d, node counts: showNodeCountNote(text) = say(\'node-count\', text, \'info\') and showLayerNodeCountNote(text) = say(\'layer-node-count\', text, \'info\'), with their callers (2 + 2) unchanged; the 9 s timers, the selects and the note variables are gone', /function showNodeCountNote\(text\) \{ say\('node-count', text, 'info'\); \}/.test(sk) && /function showLayerNodeCountNote\(text\) \{ say\('layer-node-count', text, 'info'\); \}/.test(sk) && count(sk, /showNodeCountNote\(`/g) === 2 && count(sk, /showLayerNodeCountNote\(`/g) === 2 && !/nodeCountNote|layerNodeCountNote|NoteTimer/.test(sk));
    check('route e, the field and macro notes: showFieldNote = say(\'net-field\', text, \'info\'), showMacroNote = say(\'net-macro\', text, \'info\'), no timers of their own; choosing a domain ends the field note and choosing a macro ends the macro note (UI.notifyClear), as the old hidden = true did', /const showFieldNote = text => \{ say\('net-field', text, 'info'\); \};/.test(sk) && /const showMacroNote = text => \{ say\('net-macro', text, 'info'\); \};/.test(sk) && /UI\.notifyClear\('net-field'\); setDomain\(d\); commit\(\);/.test(sk) && /UI\.notifyClear\('net-macro'\); setMacro\(smooth \? undefined : m\); commit\(\);/.test(sk) && !/fieldNote\b|macroNote\b/.test(sk) && count(sk, /showFieldNote\(`/g) === 1 && count(sk, /showMacroNote\(`/g) === 2);
    check('route f, the free-endpoint refusal in pressAt: ONE message line, window.say(\'net-free\', "A free endpoint cannot be placed outside the net (Single and Field are closed nets).", \'warn\'), the condition and the return around it untouched; the timer variable is gone', /if \(foundId === null && freeEndpointsEnabled && netWarp && netWarpIsClosed\(netWarp\) && !netWarpInsideNet\(netWarp, \{ x: x, y: y \}\)\) \{\s*if \(window\.say\) window\.say\('net-free', 'A free endpoint cannot be placed outside the net \(Single and Field are closed nets\)\.', 'warn'\);\s*return;\s*\}/.test(sk) && !/netFreeNoteTimer|getElementById\('net-free-note'\)/.test(sk));
    check('route g, align: the failure is say(\'align\', "Not achievable within the current parameter ranges.", \'warn\'); both clears (a tab switch, a success) are UI.notifyClear(\'align\'); the element is no longer looked up or written', /say\('align', 'Not achievable within the current parameter ranges\.', 'warn'\)/.test(sk) && count(sk, /UI\.notifyClear\('align'\)/g) === 2 && !/alignStatus|#align-to-base-status/.test(sk));
    // the timeline
    const fnBody = name => { const i = sk.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0, k = sk.indexOf('{', i); for (let j = k; j < sk.length; j++) { if (sk[j] === '{') d++; else if (sk[j] === '}' && --d === 0) return sk.slice(i, j + 1); } return ''; };
    const stl = fnBody('setTimelineStatus');
    check('route b, setTimelineStatus(msg, kind): the span #timeline-status is still written ONCE per call and first (the Mehr diagnostic, the segment readout); kind "refusal" adds say(\'timeline-refusal\', msg, \'warn\'), kind "condition" adds say(\'timeline-condition\', msg, \'warn\') once per text, any other call (a readout or a clear) ends a condition with UI.notifyClear(\'timeline-condition\')', count(stl, /timelineStatusEl\.html\(msg \|\| ''\)/g) === 1 && stl.indexOf('timelineStatusEl.html') < stl.indexOf('say(') && /kind === 'refusal' && msg\) say\('timeline-refusal', msg, 'warn'\)/.test(stl) && /kind === 'condition' && msg\) \{ if \(msg !== timelineConditionSaid\) \{ timelineConditionSaid = msg; say\('timeline-condition', msg, 'warn'\); \} \}/.test(stl) && /kind !== 'refusal' && kind !== 'condition' && timelineConditionSaid !== null\) \{ timelineConditionSaid = null; if \(window\.UI\) UI\.notifyClear\('timeline-condition'\); \}/.test(stl));
    check('the callers, classified: REFUSAL (an action was refused) at four places - recaptureTimelineKeyframeNet "Net of keyframe N NOT captured", addLayerToTimeline shape/size/symmetry mismatch, line count mismatch, "not added: its net cannot be interpolated" - and clearTimelineState(\'Timeline removed: Layer N was deleted.\', \'refusal\') (the consequence of a deletion); CONDITION at one place - applyTimelineFrame\'s live mismatch (resolved.reason); everything else is a READOUT (no kind)', count(sk, /setTimelineStatus\([^;]*'refusal'\)/g) === 4 && count(sk, /setTimelineStatus\([^;]*'condition'\)/g) === 1 && /clearTimelineState\(`Timeline removed: Layer \$\{index \+ 1\} was deleted\.`, 'refusal'\)/.test(sk) && /function clearTimelineState\(statusMessage, kind\)/.test(sk) && /setTimelineStatus\(statusMessage, kind\)/.test(sk) && /setTimelineStatus\(resolved\.reason, 'condition'\)/.test(sk) && count(sk, /setTimelineStatus\(''\)/g) === 3 && /clearTimelineState\(''\)/.test(sk));
    const atf = fnBody('applyTimelineFrame');
    check('the per-frame readout: applyTimelineFrame ends its status with setTimelineStatus(<segment readout + net note>) WITHOUT a kind, and contains no say, no UI.notify and no notifyClear (it runs every playback frame); the accepted-add net note ("Net not animated: keyframe N has no net captured") is part of that readout, not a notice', atf.length > 500 && /\+ netNote\);/.test(atf) && !/\bsay\(|UI\.notify|notifyClear|window\.say/.test(atf) && /Net not animated: keyframe/.test(atf));
    check('the diagnostics that stay are not touched by the routing: the net state indicator (syncTimelineNetUi), the Netz hints, the field info, the face-colors notes keep their own writes (the net locks note and the Include net warning text went in commit 11)', /netStateEl\.html\(/.test(sk) && /focusHint\.html\(/.test(sk) && /macroHint\.html\(/.test(sk) && /sizeHint\.html\(/.test(sk) && /statusEl\.textContent = trails\.length === 0/.test(sk) && /fieldInfo\.html\(/.test(sk));
    // the diamond
    const ly = strip(LAYERS);
    check('ui-layers.js: the diamond no longer shows a toast and no longer reads #timeline-status: select(index), addToTimeline(), sync(); a refusal leaves the layer out of the timeline so the diamond stays outline', /api\(\)\.select\(index\);\s*api\(\)\.addToTimeline\(\);\s*sync\(\);\s*return;/.test(ly) && !/UI\.toast|UI\.notify|timeline-status/.test(ly));
    // the removed note
    check('#node-count-note is GONE: no element in index.html, no `.toast` rule in style.css (its only user), no select in sketch.js, and ui.js has no `.toast` handler; the layer\'s #layer-node-count-note stays in the DOM, unwritten (it goes with the old DOM)', !/id="node-count-note"/.test(HTML) && !/(^|[}\s,])\.toast\b/.test(strip(CSS)) && !/node-count-note'\)/.test(sk) && !/\.toast\b/.test(strip(UI_SRC)) && /id="layer-node-count-note"/.test(HTML));
    check('the elements that are no longer written stay in the DOM until the old DOM is removed: #paste-pattern-status, #net-free-note, #net-field-note, #net-macro-note, #align-to-base-status; #timeline-status stays and is still written', ['paste-pattern-status', 'net-free-note', 'net-field-note', 'net-macro-note', 'align-to-base-status', 'timeline-status', 'layer-node-count-note'].every(id => HTML.includes('id="' + id + '"')));
    check('nothing in sketch.js writes the unwritten elements by id any more: no html() / textContent / hidden on #paste-pattern-status, #net-free-note, #net-field-note, #net-macro-note, #align-to-base-status, #layer-node-count-note', !/paste-pattern-status|net-free-note|net-field-note|net-macro-note|align-to-base-status|layer-node-count-note/.test(sk));
    check('no timer is left for these messages (the 9 s and 3 s hides): no setTimeout in sketch.js mentions a note', !/NoteTimer|netFreeNote/.test(sk));
});

// ================= 2. the routing functions, extracted from sketch.js, in a vm with a stubbed UI =================
console.log('\n== say() and setTimelineStatus(), extracted from sketch.js (a stubbed UI) ==');
const BLOCK = (() => { const a = SKETCH.indexOf('    // say(key, text, kind): the one route'), b = SKETCH.indexOf('    window.setTimelineStatus = setTimelineStatus;'); return a >= 0 && b > a ? SKETCH.slice(a, b + '    window.setTimelineStatus = setTimelineStatus;'.length) : ''; })();
function routing(o) {
    o = o || {};
    const log = [], spans = [];
    const ctx = vm.createContext({ console });
    ctx.window = ctx;
    if (!o.noUI) ctx.UI = { notify: o.noNotify ? undefined : (text, opts) => { log.push(['notify', text, opts.key, opts.kind]); }, notifyClear: key => { log.push(['clear', key]); } };
    ctx.timelineStatusEl = { html: t => { spans.push(t); } };
    vm.runInContext(BLOCK, ctx, { filename: 'sketch.js (block)' });
    return { say: ctx.window.say, set: ctx.window.setTimelineStatus, log, spans, ctx };
}
T('routing', () => {
    check('the block was found in sketch.js (say, the condition state and setTimelineStatus)', BLOCK.length > 200 && /function say\(/.test(BLOCK) && /function setTimelineStatus\(/.test(BLOCK));
    let r = routing(); r.say('k', 'text', 'warn');
    check('say(key, text, kind): UI.notifyClear(key) first, then UI.notify(text, { key, kind }) - in that order', J(r.log) === J([['clear', 'k'], ['notify', 'text', 'k', 'warn']]));
    r = routing({ noUI: true });
    check('say without window.UI does nothing and does not throw (the page is not loaded yet / a test page)', (r.say('k', 't', 'info'), r.log.length === 0));
    r = routing({ noNotify: true });
    check('say with a UI that has no notify does nothing and does not throw', (r.say('k', 't', 'info'), r.log.length === 0));
    r = routing(); r.set('Segment 1/2 (Layer 1 → Layer 2)');
    check('a READOUT (no kind) writes the span and notifies nothing', J(r.spans) === J(['Segment 1/2 (Layer 1 → Layer 2)']) && r.log.length === 0);
    r = routing(); for (let i = 0; i < 300; i++) r.set('Segment ' + (1 + (i % 4)) + '/4 (Layer 1 → Layer 2) | Net not animated: keyframe 2 has no net captured (use "Net" on the keyframe)');
    check('the per-frame readout: 300 playback frames (with a net note in the text) write the span 300 times and create NO notice and no clear', r.spans.length === 300 && r.log.length === 0);
    r = routing(); r.set('');
    check('a clear (an empty readout) writes the empty span and notifies nothing (and with no condition showing, clears nothing)', J(r.spans) === J(['']) && r.log.length === 0);
    r = routing(); r.set('Layer 2 not added: its net cannot be interpolated', 'refusal');
    check('a REFUSAL writes the span AND shows one warn notice under the key "timeline-refusal" (clear, then notify)', J(r.spans) === J(['Layer 2 not added: its net cannot be interpolated']) && J(r.log) === J([['clear', 'timeline-refusal'], ['notify', 'Layer 2 not added: its net cannot be interpolated', 'timeline-refusal', 'warn']]));
    r.set('Layer 2 not added: its net cannot be interpolated', 'refusal');
    check('the SAME refusal again (the person repeats the action) notifies again - clear then notify: the showing notice is replaced with a fresh timer, never a second one (no dedupe for action feedback)', r.log.length === 4 && J(r.log.slice(2)) === J(r.log.slice(0, 2)));
    r = routing(); r.set('', 'refusal');
    check('a refusal with an empty text notifies nothing', r.log.length === 0 && J(r.spans) === J(['']));
    r = routing(); for (let i = 0; i < 100; i++) r.set('Layers 1 and 3 cannot be interpolated here', 'condition');
    check('the live mismatch (kind "condition") during playback: 100 frames with the same text notify ONCE (key "timeline-condition", warn); the span is written every frame as before', r.log.filter(l => l[0] === 'notify').length === 1 && r.log.filter(l => l[0] === 'clear').length === 1 && r.spans.length === 100 && r.log[1][3] === 'warn' && r.log[1][2] === 'timeline-condition');
    r.set('another reason', 'condition');
    check('...a DIFFERENT condition text notifies again (once)', r.log.filter(l => l[0] === 'notify').length === 2);
    r.set('Segment 2/3 (Layer 2 → Layer 3)');
    check('...the readout resuming ends the condition: UI.notifyClear(\'timeline-condition\') once, and the very next readout does not clear again', J(r.log.slice(-1)) === J([['clear', 'timeline-condition']]) && (() => { const n = r.log.length; r.set('Segment 3/3 (Layer 2 → Layer 3)'); return r.log.length === n; })());
    r = routing(); r.set('mismatch', 'condition'); const n0 = r.log.length; r.set('mismatch', 'condition'); r.set('mismatch', 'condition'); r.set('segment');
    r.set('mismatch', 'condition');
    check('...after it ended the same condition text notifies again (once per condition, not once per text for ever)', r.log.filter(l => l[0] === 'notify').length === 2 && n0 === 2);
    r = routing(); r.set('mismatch', 'condition'); r.set('', 'refusal'); r.set('Layer 3 refused', 'refusal'); r.set('mismatch', 'condition');
    check('a refusal in between does NOT end a condition (only a readout does): the same condition text is not notified again', r.log.filter(l => l[0] === 'notify' && l[2] === 'timeline-condition').length === 1);
    r = routing(); r.set('mismatch', 'condition'); r.set('');
    check('a plain clear (setTimelineStatus(\'\'), e.g. a timeline removed or a keyframe added) also ends the condition', J(r.log.slice(-1)) === J([['clear', 'timeline-condition']]));
    r = routing(); r.set('Timeline removed: Layer 3 was deleted.', 'refusal');
    check('"Timeline removed" (clearTimelineState passes kind "refusal") is a warn notice under "timeline-refusal" and writes the span', r.log[1][2] === 'timeline-refusal' && r.log[1][3] === 'warn' && r.spans.length === 1);
});

// ================= 3. the same functions with the REAL ui.js in a fake DOM =================
console.log('\n== say() and setTimelineStatus() with the real ui.js (a fake DOM, injected timers) ==');
class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this._a = {}; this.dataset = {}; this.handlers = {}; this._c = new Set(); this.style = {}; this.hidden = false; this._text = ''; this.id = ''; }
    set className(v) { this._c = new Set(String(v).split(/\s+/).filter(Boolean)); } get className() { return [...this._c].join(' '); }
    get classList() { const s = this._c; return { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c), toggle: (c, on) => { const w = on === undefined ? !s.has(c) : !!on; if (w) s.add(c); else s.delete(c); return w; } }; }
    setAttribute(k, v) { this._a[k] = String(v); } getAttribute(k) { return k in this._a ? this._a[k] : null; } removeAttribute(k) { delete this._a[k]; }
    addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; }
    get parentNode() { return this.parent; }
    set textContent(v) { this._text = String(v); this.children.forEach(c => { c.parent = null; }); this.children = []; } get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set innerHTML(v) { this._html = String(v); this.children = []; } get innerHTML() { return this._html; }
    contains(n) { for (let e = n; e; e = e.parent) if (e === this) return true; return false; }
    closest(sel) { for (let e = this; e; e = e.parent) if (sel.startsWith('.') && e._c.has(sel.slice(1))) return e; return null; }
}
function live() {
    const timers = [], clock = { t: 0, id: 0 };
    const doc = { activeElement: null, createElement: tag => { const e = new El(tag); e.ownerDoc = doc; return e; }, getElementById: id => id === 'ui-notices' ? host : null, addEventListener() { }, querySelectorAll: () => [] };
    const host = doc.createElement('div');
    const ctx = vm.createContext({ document: doc, console, MutationObserver: class { observe() { } }, performance: { now: () => clock.t },
        setTimeout: (fn, ms) => { const id = ++clock.id; timers.push({ id, fn, at: clock.t + (ms || 0) }); return id; }, clearTimeout: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); } });
    ctx.window = ctx; ctx.matchMedia = () => ({ matches: false }); ctx.addEventListener = () => { };
    vm.runInContext(UI_SRC, ctx, { filename: 'ui.js' });
    ctx.timelineStatusEl = { html: () => { } };
    vm.runInContext(BLOCK, ctx, { filename: 'sketch.js (block)' });
    const advance = ms => { const end = clock.t + ms; for (;;) { const due = timers.filter(t => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0]; if (!due) break; clock.t = due.at; timers.splice(timers.indexOf(due), 1); due.fn(); } clock.t = end; };
    return { ctx, host, advance, texts: () => host.children.map(n => n.children[0].textContent), kinds: () => host.children.map(n => n.className) };
}
T('live', () => {
    let L = live();
    L.ctx.window.setTimelineStatus('Line count mismatch: Layer 1 has 0, Layer 2 has 0 - counts must match.', 'refusal');
    check('one refusal shows exactly ONE notice: the text, kind warn (class notice-warn), a close button (69 characters)', L.host.children.length === 1 && L.texts()[0].startsWith('Line count mismatch') && L.kinds()[0] === 'notice notice-warn' && L.host.children[0].children.length === 2);
    L.advance(3000); L.ctx.window.setTimelineStatus('Line count mismatch: Layer 1 has 0, Layer 2 has 0 - counts must match.', 'refusal');
    L.advance(6000);
    check('the same refusal again 3 s later REPLACES the showing one (still one notice) and the timer starts fresh: it is still there 6 s after the second call and gone 7 s after (69 characters: 6450 ms)', L.host.children.length === 1 && (L.advance(1000), L.host.children.length === 0));
    L.ctx.window.setTimelineStatus('Line count mismatch: Layer 1 has 0, Layer 2 has 0 - counts must match.', 'refusal');
    check('after expiry the same refusal shows again (the key is cleared first: the "once per condition" rule never hides action feedback)', L.host.children.length === 1);
    L = live(); L.ctx.window.say('node-count', 'Node Count 12 is above the square limit of 8, so it was set to 8.', 'info'); L.ctx.window.say('node-count', 'Node Count 12 is above the square limit of 8, so it was set to 8.', 'info');
    check('a message sent twice is ONE notice (the second replaces the first), kind info (class notice-info)', L.host.children.length === 1 && L.kinds()[0] === 'notice notice-info');
    L.ctx.window.say('paste', 'Clipboard permission denied - check your browser\'s site settings.', 'error'); L.ctx.window.say('align', 'Not achievable within the current parameter ranges.', 'warn');
    check('different routes stack, at most two: the third (align) replaced the oldest (node-count); paste is kind error (class notice-error)', J(L.texts().map(t => t.slice(0, 9))) === J(['Clipboard', 'Not achie']) && L.kinds()[0] === 'notice notice-error');
    L.ctx.window.UI.notifyClear('paste');
    check('UI.notifyClear(\'paste\') (the success path of a later paste) closes the paste notice', J(L.texts().map(t => t.slice(0, 9))) === J(['Not achie']));
    L = live(); for (let i = 0; i < 50; i++) L.ctx.window.setTimelineStatus('Segment ' + (i % 3 + 1) + '/3 (Layer 1 → Layer 2)');
    check('50 playback frames of readout create no notice at all in the real component', L.host.children.length === 0);
    L = live(); for (let i = 0; i < 50; i++) L.ctx.window.setTimelineStatus('Net: the pair of keyframes 1 and 2 is not compatible - the author net is shown', 'condition');
    check('the live mismatch over 50 frames is ONE notice in the real component; the readout resuming closes it', L.host.children.length === 1 && (L.ctx.window.setTimelineStatus('Segment 1/2 (Layer 1 → Layer 2)'), L.host.children.length === 0));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
