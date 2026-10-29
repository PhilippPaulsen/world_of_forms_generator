// Guard for the timeline sheet's view (sheets redesign, commit 5a): the pure model in ui-phone-timeline.js (the six readout states, the {n} sources, the enabled states and their reasons, the signature), both
// languages from the REAL dictionary, and the places it is wired (index.html loads it, the sources of the model controls it forwards to, the CSS that shows it only under html.ph). The DOM part (the three buttons
// forward to exactly the right model controls, the toggle's gate, release) runs in tools/ui/test-phone-engine.js with the real ui.js. No browser.
//   node tools/ui/test-phone-timeline.js
//   UI_PHONE_TIMELINE_JS=... UI_I18N_JS=... INDEX_HTML=... STYLE_CSS=... SKETCH_JS=... node tools/ui/test-phone-timeline.js        (sabotage runs)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const SRC = read('UI_PHONE_TIMELINE_JS', 'ui-phone-timeline.js');
const M = require(process.env.UI_PHONE_TIMELINE_JS || path.join(ROOT, 'ui-phone-timeline.js'));
const HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css'), SKETCH = read('SKETCH_JS', 'sketch.js'), NETWARP = fs.readFileSync(path.join(ROOT, 'core', 'netwarp.js'), 'utf8');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack).slice(0, 300)); } };
const J = x => JSON.stringify(x);

// the real dictionary, in a vm
const ctx = vm.createContext({ window: {}, document: undefined, console });
vm.runInContext(read('UI_I18N_JS', 'ui-i18n.js'), ctx, { filename: 'ui-i18n.js' });
const I = ctx.window.uiI18n || vm.runInContext('typeof uiI18n !== "undefined" ? uiI18n : window.uiI18n', ctx);
const tr = lang => (key, p) => { I.setLang(lang); return I.t(key, p); };
const tl = (ids, nets) => ({ keyframeLayerIds: ids, netStates: nets || ids.map(() => ({ x: {} })), segmentDurationsMs: ids.slice(1).map(() => 2000) });

console.log('== the readout: the six states of timelineNetSummary ==');
T('readout', () => {
    const de = tr('de'), en = tr('en');
    const R = (t, st) => M.phoneTimelineModel({ tl: t, summary: st ? { state: st } : null, active: 'base' }).readout;
    const cases = [
        ['none', tl([0, 1], [null, null]), 'timeline.net.none', {}, 'Netz: nicht animiert', 'Net: not animated'],
        ['partial', tl([0, 1, 2], [{ x: 1 }, null, { x: 1 }]), 'timeline.net.partial', { n: '2' }, 'Netz: Keyframe 2 ohne Netz', 'Net: keyframe 2 without a net'],
        ['pending', tl([0], [{ x: 1 }]), 'timeline.net.pending', {}, 'Netz: zweiten Keyframe hinzufügen', 'Net: add a second keyframe'],
        ['incompatible', tl([0, 1]), 'timeline.net.incompatible', {}, 'Netz: nicht animierbar', 'Net: cannot be animated'],
        ['constant', tl([0, 1]), 'timeline.net.constant', {}, 'Netz: gleich in allen Keyframes', 'Net: same in all keyframes'],
        ['animated', tl([0, 1, 2, 3]), 'timeline.net.animated', { n: 4 }, 'Netz: animiert (4 Keyframes)', 'Net: animated (4 keyframes)'],
    ];
    cases.forEach(c => {
        const r = R(c[1], c[0]);
        check(`${c[0]}: key ${c[2]}, params ${J(c[3])}; German "${c[4]}", English "${c[5]}"`, !!r && r.key === c[2] && J(r.params) === J(c[3]) && M.READOUT_KEYS[c[0]] === c[2] && de(r.key, r.params) === c[4] && en(r.key, r.params) === c[5], J(r));
    });
    check('{n} of PARTIAL = the numbers (1-based) of the keyframes with no net in timeline.netStates, as timelineNetSummary() counts them ("2", or "1, 3" for several); {n} of ANIMATED = the number of keyframes (keyframeLayerIds.length)', R(tl([0, 1, 2], [null, { x: 1 }, null]), 'partial').params.n === '1, 3' && R(tl([0, 1, 2], [{ x: 1 }, { x: 1 }, null]), 'partial').params.n === '3' && R(tl([5, 6]), 'animated').params.n === 2 && M.missingNets(tl([0, 1], [null, null])).join() === '1,2' && M.missingNets({ keyframeLayerIds: [0, 1] }).join() === '1,2');
    check('the rule is the summary\'s: core/netwarp.js timelineNetSummary() builds `missing` from netStates the same way and its animated text counts keyframeLayerIds.length (read from the source)', /const missing = tl\.keyframeLayerIds\.map\(\(_, i\) => \(st\[i\] \? 0 : i \+ 1\)\)\.filter\(Boolean\)/.test(NETWARP) && /Net animated with the timeline \(\$\{n\} keyframes\)/.test(NETWARP) && /const n = tl\.keyframeLayerIds\.length/.test(NETWARP));
    check('every state the summary can return has a readout key (none, partial, pending, incompatible, constant, animated: read from the source), an unknown state or no summary or no keyframes gives NO readout (an empty line)', ['none', 'partial', 'pending', 'incompatible', 'constant', 'animated'].every(s => new RegExp("state: '" + s + "'").test(NETWARP) && !!M.READOUT_KEYS[s]) && R(tl([0, 1]), 'weird') === null && R(tl([0, 1]), null) === null && R(null, 'none') === null && R(tl([]), 'none') === null);
});

console.log('\n== the enabled states and their reasons ==');
T('enabled', () => {
    const m = (t, active, open) => M.phoneTimelineModel({ tl: t, summary: { state: 'animated' }, active: active, pairingOpen: open });
    const e0 = m(null, 'base');
    check('NO keyframes: all three disabled - netrec and trash with timeline.noKeyframes, the toggle with timeline.need2 - and not pressed', !e0.netrec.enabled && e0.netrec.reason === 'timeline.noKeyframes' && !e0.trash.enabled && e0.trash.reason === 'timeline.noKeyframes' && !e0.pairing.enabled && e0.pairing.reason === 'timeline.need2' && e0.pairing.pressed === false && e0.count === 0 && e0.readout === null);
    check('a timeline object without keyframes is the same as none', J(m({ keyframeLayerIds: [] }, 0)) === J(e0.count === 0 ? m(null, 0) : null));
    const e1 = m(tl([3]), 3, true);
    check('ONE keyframe: netrec enabled for ITS layer (pos 0), the trash enabled, the toggle disabled with timeline.need2 and never pressed (a segment is needed), even when it was open', e1.netrec.enabled && e1.netrec.pos === 0 && e1.trash.enabled && !e1.pairing.enabled && e1.pairing.reason === 'timeline.need2' && e1.pairing.pressed === false);
    const e2 = m(tl([4, 1, 7]), 7, true);
    check('three keyframes (layers 4, 1, 7), layer 7 selected: netrec at position 2, the toggle enabled and pressed when open, the trash enabled', e2.netrec.enabled && e2.netrec.pos === 2 && e2.pairing.enabled && e2.pairing.pressed === true && e2.trash.enabled && m(tl([4, 1, 7]), 7, false).pairing.pressed === false);
    const b = m(tl([4, 1, 7]), 'base'), n5 = m(tl([4, 1, 7]), 5);
    check('the BASE or a layer that is no keyframe selected: netrec disabled with timeline.notKeyframe (and pos -1); the other two are not affected', !b.netrec.enabled && b.netrec.reason === 'timeline.notKeyframe' && b.netrec.pos === -1 && !n5.netrec.enabled && n5.netrec.reason === 'timeline.notKeyframe' && b.trash.enabled && b.pairing.enabled);
    check('a layer index is matched by VALUE (indexOf in keyframeLayerIds): layer 1 is the SECOND keyframe, not the first', m(tl([4, 1, 7]), 1).netrec.pos === 1 && m(tl([4, 1, 7]), 4).netrec.pos === 0 && m(tl([4, 1, 7]), '1').netrec.enabled === false);
    check('every reason is a dictionary key with a German and an English text: timeline.noKeyframes, timeline.notKeyframe, timeline.need2', ['timeline.noKeyframes', 'timeline.notKeyframe', 'timeline.need2'].every(k => I.has(k) && I.DICT[k].de && I.DICT[k].en && I.DICT[k].en !== I.DICT[k].de) && I.DICT['timeline.need2'].de === 'Mindestens zwei Keyframes nötig' && I.DICT['timeline.noKeyframes'].de === 'Noch keine Keyframes' && I.DICT['timeline.notKeyframe'].de === 'Gewählte Ebene ist kein Keyframe' && M.T['timeline.need2'] === 'Mindestens zwei Keyframes nötig');
    check('the German fallback table of the view (M.T) is the dictionary German, key by key (' + Object.keys(M.T).length + ' keys), and every key is in the dictionary with an English text', Object.keys(M.T).every(k => I.has(k) && I.DICT[k].de === M.T[k] && I.DICT[k].en && I.DICT[k].en !== '' ) && Object.keys(M.T).length === 12, Object.keys(M.T).filter(k => !I.has(k) || I.DICT[k].de !== M.T[k]).join());
    const s1 = M.modelSignature(m(tl([0, 1]), 0), 'de'), s2 = M.modelSignature(m(tl([0, 1]), 1), 'de'), s3 = M.modelSignature(m(tl([0, 1]), 0), 'en'), s4 = M.modelSignature(m(tl([0, 1]), 0), 'de');
    check('the signature changes with the selected layer and with the language and not otherwise (the view rebuilds only then)', s1 === s4 && s1 !== s2 && s1 !== s3);
});

console.log('\n== where it is wired ==');
T('wiring', () => {
    const order = (HTML.replace(/<!--[\s\S]*?-->/g, '').match(/<script src="[^"]+"/g) || []).map(s => /src="([^"?]+)/.exec(s)[1]);
    check('index.html loads ui-phone-timeline.js after ui-timeline.js and ui-i18n.js and before ui-phone-config.js and ui-phone.js (the engine moves its two elements by id)', order.indexOf('ui-phone-timeline.js') > 0 && order.indexOf('ui-phone-timeline.js') > order.indexOf('ui-timeline.js') && order.indexOf('ui-phone-timeline.js') > order.indexOf('ui-i18n.js') && order.indexOf('ui-phone-timeline.js') < order.indexOf('ui-phone-config.js') && order.indexOf('ui-phone-timeline.js') < order.indexOf('ui-phone.js'), order.filter(f => /phone|timeline/.test(f)).join());
    const s = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    check('the view never observes the DOM (no MutationObserver): it refreshes on the UI ticks, after a signature compare; it writes no model state (no assignment to timeline, netStates or the hidden controls)', !/MutationObserver/.test(s) && /UI\.onSync\(sync\)/.test(s) && !/timeline\.[a-zA-Z]+ = |netStates\[/.test(s));
    check('it FORWARDS: netrec clicks the first button of the keyframe\'s tab in #timeline-keyframe-list (children[pos]), the trash clicks #btn-clear-timeline; nothing else is clicked and nothing is cloned', /list\.children\[m\.netrec\.pos\]/.test(s) && /tab\.querySelector\('button'\)/.test(s) && /doc\.getElementById\('btn-clear-timeline'\)/.test(s) && !/cloneNode/.test(s));
    check('the model controls it forwards to are still what sketch.js builds: one .layer-tab per keyframe in sequence order whose FIRST button is "Net" (renderTimelineKeyframeList), and "Net" calls recaptureTimelineKeyframeNet(pos) (sketch.js is unchanged by this commit)', /timeline\.keyframeLayerIds\.forEach\(\(layerIndex, pos\) => \{\s*const tab = document\.createElement\('span'\);\s*tab\.className = 'layer-tab';/.test(SKETCH) && /netBtn\.textContent = 'Net';[\s\S]{0,260}recaptureTimelineKeyframeNet\(pos\)/.test(SKETCH) && /tab\.appendChild\(label\);\s*tab\.appendChild\(netBtn\);\s*tab\.appendChild\(removeBtn\);/.test(SKETCH));
    check('the page globals it reads are the ones that exist (read only): `timeline` (core/state.js), timelineNetSummary() (core/netwarp.js), `activeLayer` (sketch.js) - behind three window.* readers made by the file', /^let timeline\b/m.test(fs.readFileSync(path.join(ROOT, 'core', 'state.js'), 'utf8')) && /^function timelineNetSummary\(\)/m.test(NETWARP) && /^let activeLayer\b/m.test(fs.readFileSync(path.join(ROOT, 'core', 'state.js'), 'utf8')) && /window\.timelineState = /.test(SRC) && /window\.timelineSummary = /.test(SRC) && /window\.activeLayerNow = /.test(SRC));
    const marker = CSS.indexOf('=== Phone layout (');
    check('nothing of this view\'s CSS is above the phone block (no .ph-tl- class, no #ph-tl- id)', !/ph-tl-/.test(CSS.slice(0, marker)));
});

T('gate', () => {
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    check('the view is on while the timeline SURFACE is applied: it reads html.sr-timeline (the engine\'s flag, C0b-2), not html.ph', /html\.classList\.contains\('sr-timeline'\)/.test(code) && !/classList\.contains\('ph'\)/.test(code));
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
