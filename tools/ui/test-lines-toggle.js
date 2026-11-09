/**
 * tools/ui/test-lines-toggle.js
 * Task 024: the Lines button (#btn-toggle-lines) and the line weight slider. lineStyle = { visible, weight } (core/state.js).
 *
 *   node tools/ui/test-lines-toggle.js
 *   LINES_SABOTAGE=morph|export|weight|cycle node tools/ui/test-lines-toggle.js     (sabotage runs on in-memory copies; the files are never written)
 *
 *  1. Default (on, weight 2): every drawn call (line, bezier, strokeWeight) and the SVG text are byte-identical to the tree before the task (core/curves.js, core/export.js of 85f563da).
 *  2. Off: 0 line() / bezier() calls in the normal frame and in the morph frame (identical and different keyframes); the chord frame (what faces are computed from) is unchanged; the SVG
 *     has no <path> and no line group (nodes and the canvas frame stay).
 *  3. Weight: every line is drawn at the slider's weight (strokeWeight before it), the SVG group carries the same number.
 *  4. Session: default writes no key (the snapshot text equals one with the field absent), off / weight round-trip, an old snapshot without the field restores the default.
 *  5. The click cycle in a DOM stub of ui-lines.js: OFF -> ON -> slider -> OFF -> ON; aria-pressed / aria-expanded; the slider opens only while on; a restore closes it.
 *  6. Markup, i18n and the position: Nodes, Lines, Faces on the desktop rail; on the phone the key is in the rail's Mehr sheet of every tab and in no tool row, and the slider is a sheet setting.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const SAB = process.env.LINES_SABOTAGE || '';
const { makeRenderWorld } = require('../morph/render-harness.js');
const F = require('../session/fixtures.js');
const S = require('../session/scenarios.js');
const { same, world, uiOf, snapOf, planFor, fakeHooks, applyInto } = S;

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.message)); process.exit(1); });
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BASE = '85f563da';   // the tree before the task
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'lines-'));
const copy = (rel, text) => { const p = path.join(tmp, rel.replace(/\//g, '_')); fs.writeFileSync(p, text); return p; };
const oldOf = rel => copy('old-' + rel, execSync(`git show ${BASE}:${rel}`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString());
// sabotage copies of the working tree
let curves = read('core/curves.js'), exp = read('core/export.js');
if (SAB === 'export') exp = exp.replace(/if \(lineSt\.visible\) \{/, 'if (true) {');
if (SAB === 'weight') exp = exp.replace('stroke-width="${lineSt.weight}"', 'stroke-width="2"');
const filesNew = { 'core/curves.js': copy('curves.js', curves) };
const filesOld = { 'core/curves.js': oldOf('core/curves.js') };
// export.js is loaded by the fixtures (export: true), not as a core file: a copy of it is run over the loaded one inside the world
const EXPORT_SRC = new Map([[filesOld, execSync(`git show ${BASE}:core/export.js`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString()], [filesNew, exp]]);

const CONNS = [[1, 5], [2, 8], [3, 7]], ALT = [[1, 9], [2, 6], [4, 8]];
const stubSvg = w => {   // generateSVGString() needs a document and a computed style
    w.sb.document = { body: {} }; w.sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' });
    w.sb.lineColor = '#000000';
};
function mk(files, o) {
    const w = makeRenderWorld('square', 3, 3, 'rotation_reflection3', files);
    const calls = [];
    w.sb.strokeWeight = (x) => w.sb.__calls.push(['sw', x]);
    w.run(EXPORT_SRC.get(files)); w.baseConnections(CONNS); stubSvg(w);
    if (o && o.morph) { const a = w.addKeyframeLayer(CONNS), b = w.addKeyframeLayer(o.morph === 'alt' ? ALT : CONNS); w.setTimeline([a, b]); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 135 }); }
    return w;
}
const setLines = (w, v) => w.run(`lineStyle = ${JSON.stringify(v)};`);
const lineCalls = d => d.filter(c => c[0] === 'line' || c[0] === 'bezier');
const svgOf = w => w.get('generateSVGString()');
// the sabotage "morph": the morph frame draws although lines are off (drawn through the sink in the old curves.js, which has no gate)
const fileSet = SAB === 'morph' ? filesOld : filesNew;
if (SAB === 'morph') EXPORT_SRC.set(filesOld, exp);   // old curves.js (no gate), new export.js

console.log('== 1. default: byte-identical to the tree before ==');
for (const morph of [null, 'same', 'alt']) {
    const a = mk(filesOld, { morph }), b = mk(filesNew, { morph });
    const da = JSON.stringify(a.drawn()), db = JSON.stringify(b.drawn());
    check(`normal/morph "${morph}": every drawn call incl. strokeWeight equals the tree before (${da.length} bytes)`, da === db && lineCalls(JSON.parse(db)).length > 0);
}
{
    const a = mk(filesOld), b = mk(filesNew);
    check('the SVG text at the default is the text of the tree before, stroke-width="2"', svgOf(a) === svgOf(b) && svgOf(b).includes('<g stroke="#000000" stroke-width="2" fill="none">') && svgOf(b).includes('<path d='));
}

console.log('\n== 2. off: no line anywhere, faces and nodes untouched ==');
for (const morph of [null, 'same', 'alt']) {
    const w = mk(fileSet, { morph });
    const framed = JSON.stringify(w.frame());
    setLines(w, { visible: false, weight: 2 });
    const d = w.drawn();
    check(`off, ${morph ? 'morph ' + morph : 'normal frame'}: 0 line()/bezier() calls`, lineCalls(d).length === 0, lineCalls(d).length);
    check(`off, ${morph ? 'morph ' + morph : 'normal frame'}: the chord frame (the input of face detection) is the same as with lines on`, JSON.stringify(w.frame()) === framed);
}
{
    const w = mk(fileSet); setLines(w, { visible: false, weight: 2 });
    const svg = svgOf(w);
    check('off: the SVG has no <path>, no line group; the canvas frame rect stays', !svg.includes('<path') && !/<g stroke=/.test(svg) && svg.includes('<rect x="0" y="0"') && svg.includes('stroke-width="4"'));
    const n0 = w.get('nodes.length'), dots = (svgOf(w).match(/<circle /g) || []).length;
    check('off: the node dots stay in the SVG (showNodes)', w.get('showNodes') === true && dots === n0 && n0 > 0, dots + '/' + n0);
    setLines(w, { visible: true, weight: 2 });
    check('switching back on gives the paths again', svgOf(w).includes('<path d='));
}
{   // faces: the face data computed with lines off equals the one with lines on (collector path, not the canvas)
    const w = mk(fileSet); w.set('showFaces = true;');
    const FACES = 'JSON.stringify(computeCellFaces(connections))';
    const on = w.get(FACES);
    setLines(w, { visible: false, weight: 2 });
    check('faces: computeCellFaces() with lines off equals the one with lines on', w.get(FACES) === on && on.length > 10, on.length);
}

console.log('\n== 3. weight ==');
{
    const w = mk(fileSet); setLines(w, { visible: true, weight: 5 });
    const d = w.drawn(); let ok = true, n = 0, sw = null;
    d.forEach(c => { if (c[0] === 'sw') sw = c[1]; else { n++; if (sw !== 5) ok = false; } });
    check(`weight 5: every one of the ${n} lines is drawn right after strokeWeight(5), in the normal frame`, n > 0 && ok);
    const m = mk(fileSet, { morph: 'alt' }); setLines(m, { visible: true, weight: 5 });
    sw = null; ok = true; n = 0; m.drawn().forEach(c => { if (c[0] === 'sw') sw = c[1]; else { n++; if (sw !== 5) ok = false; } });
    check(`weight 5: the same in the morph frame (${n} lines)`, n > 0 && ok);
    const svg = svgOf(w);
    check('weight 5: the SVG group says stroke-width="5", the frame keeps 4', svg.includes('<g stroke="#000000" stroke-width="5" fill="none">') && svg.includes('fill="none" stroke="#000000" stroke-width="4"'));
    setLines(w, { visible: true, weight: 0.5 });
    check('weight 0.5 (the slider minimum) is written as 0.5', svgOf(w).includes('stroke-width="0.5"'));
}

console.log('\n== 4. session ==');
const text = (ctx, ui) => ctx.sb.serializeSession(ctx.sb.buildSessionSnapshot(ctx.sb.collectSessionState(ui), 1)).text;
{
    const src = world('square', 4, 3, 'rotation_reflection3'); src.run('connections = [[1, 6], [3, 9]];');
    const ui = uiOf(src, 'spiegeling', 3);
    const t0 = text(src, ui);
    check('default: no lineStyle key in the snapshot text', !t0.includes('lineStyle'));
    src.run('delete globalThis.lineStyle;');
    src.run('lineStyle = { visible: true, weight: 2 };');
    check('default written again: the same text', text(src, ui) === t0);
    src.run('lineStyle = { visible: false, weight: 3.5 };');
    const snap = snapOf(src, ui);
    check('off + weight 3.5: settings.lineStyle = { visible: false, weight: 3.5 }', same(snap.settings.lineStyle, { visible: false, weight: 3.5 }), JSON.stringify(snap.settings.lineStyle));
    const pr = src.sb.parseSession(text(src, ui));
    check('parseSession accepts it and keeps both values', pr.ok && same(pr.snapshot.settings.lineStyle, { visible: false, weight: 3.5 }));
    const target = world('triangle', 3, 4, 'none');
    const r = applyInto(target, snap, fakeHooks(target, snap, uiOf(target, 'none', 6)));
    check('apply restores the lines state into a page that had the default', r.ok === true && same(target.get('lineStyle'), { visible: false, weight: 3.5 }) && target.get('lineStyle') !== src.get('lineStyle'));
    const old = JSON.parse(JSON.stringify(snap)); delete old.settings.lineStyle;
    const t2 = world('hex', 3, 3, 'none'); t2.run('lineStyle = { visible: false, weight: 6 };');
    const r2 = applyInto(t2, old, fakeHooks(t2, null, uiOf(t2, 'none', 6)));
    check('an OLD snapshot without the field restores the default (on, 2) into a page that had it off', r2.ok === true && same(t2.get('lineStyle'), { visible: true, weight: 2 }), JSON.stringify(t2.get('lineStyle')));
    const bad = JSON.parse(text(src, ui)); bad.settings.lineStyle = { visible: 'x', weight: 'y' };
    const pb = src.sb.parseSession(JSON.stringify(bad));
    check('a malformed field falls back to the default instead of failing (no key written)', pb.ok === true && pb.snapshot.settings.lineStyle === undefined);
    const big = JSON.parse(text(src, ui)); big.settings.lineStyle = { visible: true, weight: 1e9 };
    check('a huge weight is clamped to the slider maximum', src.sb.parseSession(JSON.stringify(big)).snapshot.settings.lineStyle.weight === 8);
}

console.log('\n== 5. the click cycle (DOM stub of ui-lines.js) ==');
function domStub(sabotageCycle) {
    const mkEl = () => { const el = { attrs: {}, classes: new Set(), listeners: {}, hidden: true, value: '2', textContent: '2',
        classList: { toggle(c, on) { if (on) el.classes.add(c); else el.classes.delete(c); }, contains: c => el.classes.has(c) },
        setAttribute(k, v) { el.attrs[k] = v; }, getAttribute: k => el.attrs[k], addEventListener(t, f) { el.listeners[t] = f; } }; return el; };
    const els = { 'btn-toggle-lines': mkEl(), 'line-weight-group': mkEl(), 'line-weight-input': mkEl(), 'line-weight-value': mkEl() };
    let redraws = 0, tick = null;
    const ctx = vm.createContext({ document: { getElementById: id => els[id] || null }, LINE_WEIGHT: { min: 0.5, max: 8, step: 0.5, def: 2 }, lineStyle: { visible: true, weight: 2 },
        redraw: () => { redraws++; }, UI: { onSync: f => { tick = f; } }, Number, isFinite, Math, String });
    let src = read('ui-lines.js');
    if (sabotageCycle) src = src.replace("else { open = false; set({ visible: false, weight: lineStyle.weight }); }", "else { open = false; show(); }");
    vm.runInContext(src, ctx, { filename: 'ui-lines.js' });
    const state = () => { const b = els['btn-toggle-lines']; return `${ctx.lineStyle.visible ? 'AN' : 'AUS'}/${b.attrs['aria-expanded'] === 'true' ? 'offen' : 'zu'}/pressed=${b.attrs['aria-pressed']}/slider-${els['line-weight-group'].hidden ? 'hidden' : 'shown'}`; };
    return { els, ctx, state, click: () => els['btn-toggle-lines'].listeners.click(), tick: () => tick(), redraws: () => redraws };
}
{
    const d = domStub(SAB === 'cycle');
    const seq = [d.state()]; d.click(); seq.push(d.state()); d.click(); seq.push(d.state()); d.click(); seq.push(d.state());
    check('the cycle AN/zu -> click -> AN/offen -> click -> AUS/zu -> click -> AN/zu (aria-pressed true while on, false off; aria-expanded with the slider)',
        seq.join(' | ') === 'AN/zu/pressed=true/slider-hidden | AN/offen/pressed=true/slider-shown | AUS/zu/pressed=false/slider-hidden | AN/zu/pressed=true/slider-hidden', seq.join(' | '));
    check('each state change redraws (a click that only opens the slider does not need to)', d.redraws() >= 2);
    d.click();   // slider open again
    d.els['line-weight-input'].value = '6'; d.els['line-weight-input'].listeners.input();
    check('the slider sets the weight, keeps the lines on, shows the number, redraws', d.ctx.lineStyle.weight === 6 && d.ctx.lineStyle.visible && d.els['line-weight-value'].textContent === '6');
    d.els['line-weight-input'].value = '99'; d.els['line-weight-input'].listeners.input();
    check('a value beyond the range is clamped to 8', d.ctx.lineStyle.weight === 8);
    d.ctx.lineStyle = { visible: true, weight: 3 }; d.tick();
    check('a state replaced from outside (a session restore) closes the slider and shows the new weight', d.state().includes('AN/zu') && d.els['line-weight-input'].value === 3);
    check('the open/closed state is not part of lineStyle (nothing to save)', Object.keys(d.ctx.lineStyle).sort().join() === 'visible,weight');
}

console.log('\n== 6. markup, i18n, position ==');
{
    const html = read('index.html');
    const rail = html.match(/<div id="rail-group-b"[\s\S]*?<\/div>/)[0];
    const order = [...rail.matchAll(/id="(btn-[a-z-]+)"/g)].map(m => m[1]).join();
    check('desktop rail group B: Nodes, Lines, Faces', order === 'btn-toggle-nodes,btn-toggle-lines,btn-toggle-faces', order);
    const btn = html.match(/<button id="btn-toggle-lines"[^>]*>/)[0];
    check('the button is an icon button with aria-pressed, aria-expanded, aria-controls, title and aria-label, and a data-i18n key', /class="icon-btn active"/.test(btn) && /aria-pressed="true"/.test(btn) && /aria-expanded="false"/.test(btn) && /aria-controls="line-weight-group"/.test(btn) && /title="[^"]+"/.test(btn) && /aria-label="[^"]+"/.test(btn) && /data-i18n="lines.button"/.test(btn));
    check('the slider group: hidden at the start, range 0.5..8 step 0.5 value 2 (derived from today\'s weight 2), a label with its key; the ids exist once', /id="line-weight-group" hidden/.test(html) && /id="line-weight-input" min="0.5" max="8" step="0.5" value="2"/.test(html) && /data-i18n="lines.weight"/.test(html) && html.split('id="btn-toggle-lines"').length === 2 && html.split('id="line-weight-group"').length === 2);
    check('ui-lines.js is loaded after ui-rail.js, with the page version', /ui-rail\.js\?v=(\w+)"><\/script>\s*<script src="ui-lines\.js\?v=\1"/.test(html));
    const I = require('../../ui-i18n.js');
    const D = (I.DICT || (I.uiI18n && I.uiI18n.DICT));
    check('de and en exist for the button and the slider label', D && D['lines.button'] && D['lines.button'].de && D['lines.button'].en && D['lines.weight'].de === 'Linienstärke' && D['lines.weight'].en === 'Line width' && D['lines.button'].de === btn.match(/aria-label="([^"]+)"/)[1]);
    const cfg = require('../../ui-phone-config.js').config;
    const where = {};
    Object.keys(cfg.toolRows).forEach(t => {
        const row = cfg.toolRows[t];
        const inRow = row.groups.some(g => g.includes('btn-toggle-lines')) || (row.end || []).includes('btn-toggle-lines');
        const inSheet = row.sheet.items.includes('btn-toggle-lines');
        where[t] = (inRow ? 'Leiste' : '') + (inSheet ? 'Mehr' : '');
    });
    check('phone: in every tab the key is in exactly one place, and that is the Mehr sheet (not the tool row)', Object.values(where).every(v => v === 'Mehr') && Object.keys(where).join() === 'form,farbe,netz', JSON.stringify(where));
    check('phone: the slider group is a setting of the Mehr sheet in every tab (usable inside the sheet), and the sheet\'s close lists do not include the Lines key',
        Object.values(cfg.toolRows).every(r => (r.sheet.settings || []).includes('line-weight-group')) && !/MOUSEDOWN_WIRED = \[[^\]]*btn-toggle-lines/.test(read('ui-rail.js')) && !/CLICK_CLOSES = \[[^\]]*btn-toggle-lines/.test(read('ui-rail.js')));
    // why Mehr: the row has no room for a 7th key
    const S_ = cfg.sizes, avail = 390 - 2 * S_.gutter;
    const keys = (t) => cfg.toolRows[t].groups.reduce((a, g) => a + g.length, 0) + 1;   // + Mehr
    const need = (n) => n * S_.target + (n - 1) * S_.rowGap;
    check(`phone width 390: the rows hold 6 keys (${need(6)}px of ${avail}px); a 7th key makes ${need(7)}px > ${avail}px, so Lines goes to Mehr`, need(6) <= avail && need(7) > avail && ['form', 'netz'].every(t => keys(t) === 6), `${need(6)} / ${need(7)} / ${avail}`);
    check('the rail mirrors aria-pressed for the new toggle (ui-rail.js TOGGLES)', /const TOGGLES = \[[^\]]*'btn-toggle-lines'/.test(read('ui-rail.js')));
    check('sketch.js is untouched by the task (it is pinned by the morph tests) and gallery.html still loads without core/state.js: the gallery shim defines lineStyle', execSync(`git diff --stat ${BASE} -- sketch.js core/tiling.js core/faces.js core/facecolor.js tools/morph/off-path-golden.json`, { cwd: ROOT }).toString().trim() === '' && /var lineStyle = \{ visible: true, weight: 2 \}/.test(read('gallery-render.js')));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
