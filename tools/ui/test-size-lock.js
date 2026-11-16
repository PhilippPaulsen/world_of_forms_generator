// Task 080 (B4): the aspect-ratio lock and the height stepper. The real text of sketch.js (the helpers and the two input handlers) runs on fakes against the real state of core/; the markup, the phone placement
// and the texts are read from the source.   STATE_JS / SKETCH_JS / INDEX_HTML / STYLE_CSS / UI_FORM_JS / UI_I18N_JS / PHONE_CONFIG_JS = mutated copies (sabotage runs)
//   1. locked (default): X sets X = Y; the height is put back; unlocking changes nothing; unlocked: Y / X change the format through resizeBase(X, Y); clamping against 1:3 on both axes with the note; re-lock: Y := X,
//      the dialog only for lost colours, cancel leaves lock and format, confirm applies; the lock after a restore / link
//   2. the stepper limits (ui-form.js) come from sizeAxisRange / validateGridSize, the markup and its order, the phone placement and the dot on More, the Raster row widths, the texts de / en
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const SK = read('SKETCH_JS', 'sketch.js'), HTML = read('INDEX_HTML', 'index.html'), CSS = read('STYLE_CSS', 'style.css'), FORM = read('UI_FORM_JS', 'ui-form.js'), I18N = read('UI_I18N_JS', 'ui-i18n.js'), PCFG = read('PHONE_CONFIG_JS', 'ui-phone-config.js');
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const MODE = 'rotation_reflection6';
const dict = (() => { const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(I18N))) m[k[1]] = { de: k[2], en: k[3] }; return m; })();

// the two handlers of sketch.js, as text
const xi = SK.indexOf('shapeInput.input(() => {'), xe = SK.indexOf('\n        });', xi) + '\n        });'.length;
const yi = SK.indexOf('shapeYInput.input(() => {'), ye = SK.indexOf('\n        });', yi) + '\n        });'.length;
const XH = SK.slice(xi, xe), YH = SK.slice(yi, ye);

const mk = (shape, ord, X, Y, lang) => {
    const log = { said: [], dialogs: [], calls: [], sync: 0 };
    const t = (key, vars) => { const e = dict[key]; if (!e) return key; return e[lang || 'de'].replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] !== undefined ? vars[k] : '{' + k + '}'); };
    const win = { UI: { t }, say: (k, text, kind) => log.said.push([k, text, kind]), timelineConfirm: o => log.dialogs.push(o), uiSync: () => { log.sync++; } };
    const w = H.makeRenderWorld(shape, 3, 3, MODE);
    w.sb.document = { body: {} }; w.sb.window = win; w.sb.UI = win.UI;
    ['fill', 'noFill', 'push', 'pop', 'stroke', 'noStroke', 'strokeWeight', 'ellipse', 'line', 'bezier'].forEach(f => { if (!w.sb[f]) w.sb[f] = () => { }; });
    w.set('var canvasSizeSync = function () { width = canvasW; height = canvasH; };');
    ['sizeAxisRange', 'sizeTargetFor', 'sizeLockIsOpen', 'sizeRatioNote', 'sizeChangeRun', 'sizeLockToggle', 'sizeChangePlan', 'sizeChangeText', 'saySizeChange', 'shapeLossWhat'].forEach(n => w.set(grab(n)));
    w.set('var sizeLockOpen = false;');
    const mkInput = (get) => ({ v: '', handler: null, value(x) { if (x === undefined) return this.v; this.v = String(x); return this; }, input(f) { this.handler = f; } });
    const xin = mkInput(), yin = mkInput();
    Object.assign(w.sb, { shapeInput: xin, shapeYInput: yin, renderLayerTabs() { log.calls.push('tabs'); }, updateOffsetControls() { }, updateTimelineControls() { }, applyTimelineFrame() { log.calls.push('frame'); }, redraw() { log.calls.push('redraw'); } });
    w.set(XH); w.set(YH);
    w.set(`currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: ord, lage: 1 })}); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${Y}); symmetryMode = ${J(MODE)}; connections = []; redoStack = []; baseNetTransform = null; additionalLayers = []; timeline = null; altNetSeed = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; baseFaceAnchor = null; baseLastHarmonyType = null; baseLastSelection = null; baseDistributionStrategy = null; spatialMorph = { enabled: false, mode: 'linear', angleDeg: 0 }; rebuildGrid(currentShape);`);
    xin.v = String(X); yin.v = String(Y);
    return { w, xin, yin, log, win };
};
const typeX = (m, v) => { m.xin.v = String(v); m.xin.handler(); };
const typeY = (m, v) => { m.yin.v = String(v); m.yin.handler(); };
const st = (m) => m.w.get('[gridSizeX(), gridSizeY(), canvasW, canvasH, sizeLockIsOpen(), sizeLockOpen]').join();

// ---- 1. behaviour -------------------------------------------------------------------------------------------------------------------------------------
{
    let m = mk('square', 3, 3, 3);
    m.w.set('connections = [[1, 5], [2, 8]];');
    typeX(m, 5);
    check('(1) locked (the default): typing 5 in the width sets X = Y = 5 (600 x 600), the lock stays closed, the lines stay', st(m) === '5,5,600,600,false,false' && m.w.get('connections.length') === 2, st(m));
    m.yin.v = '4'; m.yin.handler();
    check('(1) locked: a value typed into the height changes nothing and the field goes back to X', st(m) === '5,5,600,600,false,false' && m.yin.v === '5', st(m) + ' ' + m.yin.v);
    const before = m.w.get('JSON.stringify([nodes, connections, gridSpec, canvasW, canvasH])');
    m.log.said.length = 0; m.log.sync = 0; m.w.get('sizeLockToggle()');
    check('(1) unlocking changes nothing (same nodes, lines, canvas; Y = X) and asks the page to sync', st(m) === '5,5,600,600,true,true' && m.w.get('JSON.stringify([nodes, connections, gridSpec, canvasW, canvasH])') === before && m.log.sync === 1 && m.log.said.length === 0, st(m));
    m.w.set('connections = [[1, 5], [2, 8], [3, 7]];');
    typeY(m, 7);
    check('(1) unlocked: height 5 -> 7 calls resizeBase(5, 7): X = 5, Y = 7, canvas 600 x 840, the lines stay, the notice names the format', st(m) === '5,7,600,840,true,true' && m.w.get('connections.length') === 3 && /Größe 5 -> 5\/7/.test(m.log.said.map(s => s[1]).join(' ')), st(m) + ' ' + J(m.log.said));
    typeX(m, 7);
    check('(1) unlocked: width 5 -> 7 at height 7 is 7/7 (a square again, the lock stays open until it is clicked)', st(m) === '7,7,600,600,true,true', st(m));
    typeX(m, 3);
    typeY(m, 5);
    check('(1) unlocked: width 3, then height 5: 3/5, canvas 600 x 1000', st(m) === '3,5,600,1000,true,true', st(m));
    m.log.said.length = 0; typeX(m, 5);
    check('(1) unlocked: width 5 at height 5 is 5/5 (the Y field and canvas follow)', st(m) === '5,5,600,600,true,true', st(m));

    // clamping against 1:3, both axes, with the note (the limits are validateGridSize's)
    const clampCase = (X, Y, axis, v, wantX, wantY, note) => {
        const q = mk('square', 3, X, Y); q.w.set('sizeLockOpen = true;');
        (axis === 'y' ? typeY : typeX)(q, v);
        const ok = st(q).startsWith(wantX + ',' + wantY + ',') && q.log.said.filter(s => s[0] === 'size-ratio').length === (note ? 1 : 0);
        if (note) { const txt = q.log.said.find(s => s[0] === 'size-ratio'); return ok && txt && txt[1] === 'Seitenverhältnis höchstens 1:3'; }
        return ok;
    };
    check('(1) X = 2: height 9 is clamped to 6 (note); height 6 is fine (no note)', clampCase(2, 2, 'y', 9, 2, 6, true) && clampCase(2, 2, 'y', 6, 2, 6, false));
    check('(1) Y = 2: width 9 is clamped to 6 (note); Y = 1: width 9 is clamped to 3 (note)', clampCase(2, 2, 'x', 9, 6, 2, true) && clampCase(1, 1, 'x', 9, 3, 1, true) && clampCase(1, 1, 'y', 9, 1, 3, true));
    check('(1) the lower bound: X = 9, height 1 is clamped to 3 (note); Y = 9, width 2 is clamped to 3 (note)', clampCase(9, 9, 'y', 1, 9, 3, true) && clampCase(9, 9, 'x', 2, 3, 9, true));
    // the range is validateGridSize's, for every other count
    const rng = m.w.get('(function () { const o = []; for (let a = 1; a <= 9; a++) { const r = sizeAxisRange("y", a); const want = []; for (let v = 1; v <= 9; v++) if (validateGridSize(a, v).ok) want.push(v); o.push(r.min === want[0] && r.max === want[want.length - 1]); } return o; })()');
    check('(1) sizeAxisRange is exactly the set validateGridSize accepts, for all nine counts (no second table)', rng.every(Boolean) && !/\[\s*1\s*,\s*3\s*,\s*6\s*\]/.test(grab('sizeAxisRange')) && /validateGridSize/.test(grab('sizeAxisRange')));

    // re-lock
    m = mk('square', 3, 3, 3); m.w.set('sizeLockOpen = true; connections = [[1, 5]];'); typeY(m, 5);
    m.w.get('sizeLockToggle()');
    check('(1) locking again at 3/5: Y := X, 3/3, 600 x 600, the lock closed, the lines stay (no dialog: nothing is lost)', st(m) === '3,3,600,600,false,false' && m.w.get('connections.length') === 1 && m.log.dialogs.length === 0, st(m));
    m = mk('square', 3, 3, 3); m.w.get('sizeLockToggle()'); m.w.get('sizeLockToggle()');
    check('(1) locking again at X = Y (nothing to change): just closes, no format change', st(m) === '3,3,600,600,false,false' && m.log.calls.length === 0, st(m));
    // a case that loses colour groups when the area becomes square: find one (hexagon / triangle, coloured)
    let found = null;
    outer: for (const shape of ['hex', 'triangle']) for (const ord of [3, 4]) for (let X = 4; X <= 9; X++) for (let Y = 1; Y < X; Y++) {
        if (X > 3 * Y) continue;
        const q = mk(shape, ord, X, Y); q.w.set('sizeLockOpen = true; connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 4);');
        try { S.colorBase(q.w.ctx, { type: 'custom' }); } catch (e) { continue; }
        const d = q.w.get(`resizeBase(${X}, ${X}, { dryRun: true })`);
        if (d.lost.colorsCount > 0) { found = [shape, ord, X, Y, d.lost.colorsCount, d.lost.colorsTotal]; break outer; }
    }
    check('(1) premise: a coloured pattern exists whose colour groups are lost when the area becomes square again', !!found, J(found));
    if (found) {
        const [shape, ord, X, Y, lostN, total] = found;
        const mkc = () => { const q = mk(shape, ord, X, Y); q.w.set('sizeLockOpen = true; connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 4);'); S.colorBase(q.w.ctx, { type: 'custom' }); return q; };
        let q = mkc(); const stBefore = q.w.get('JSON.stringify([nodes, connections, baseFaceAssignments.size, canvasW, canvasH, gridSizeX(), gridSizeY()])');
        q.w.get('sizeLockToggle()');
        check('(1) re-lock where colours would be lost: the dialog "Größe ändern?" opens first with the real counts, nothing has changed yet', q.log.dialogs.length === 1 && q.log.dialogs[0].title === 'Größe ändern?' && q.log.dialogs[0].text.includes(`${lostN} von ${total}`) && q.w.get('JSON.stringify([nodes, connections, baseFaceAssignments.size, canvasW, canvasH, gridSizeX(), gridSizeY()])') === stBefore, q.log.dialogs[0] && q.log.dialogs[0].text);
        q.log.dialogs[0].returnFocus();
        check('(1) cancel: the format and the pattern are as they were and the lock stays OPEN (the area is not square)', q.w.get('JSON.stringify([nodes, connections, baseFaceAssignments.size, canvasW, canvasH, gridSizeX(), gridSizeY()])') === stBefore && q.w.get('sizeLockIsOpen()') === true && q.log.said.length === 0 && q.log.calls.length === 0);
        q.w.get('sizeLockToggle()'); q.log.dialogs[1].onConfirm();
        check('(1) confirm: Y := X (X / X), the lock closed, the notice names what was not kept', q.w.get('[gridSizeX(), gridSizeY(), sizeLockOpen, sizeLockIsOpen()]').join() === [X, X, false, false].join() && /Nicht erhalten/.test(q.log.said.map(s => s[1]).join(' ')), q.w.get('[gridSizeX(), gridSizeY(), sizeLockOpen]').join());
    }
    // the lock after a restore / a link: the lock is open while the area is not square, closed for a square; the restore hook resets the click
    m = mk('square', 3, 3, 3); m.w.set('sizeLockOpen = true;');
    m.w.set('shapeSizeFactorX = null; shapeSizeFactorY = null;');
    const afterSquareRestore = (() => { const hook = SK.match(/shapeAndInputs\(\) \{[\s\S]*?\n        \},/); return hook ? hook[0] : ''; })();
    check('(1) the restore hook (shapeAndInputs) resets the click (sizeLockOpen = false) and shows the width field from gridSizeX()', /sizeLockOpen = false/.test(afterSquareRestore) && /shapeInput\.value\(gridSizeX\(\)\)/.test(afterSquareRestore), afterSquareRestore.slice(0, 60));
    m.w.set('sizeLockOpen = false; setGridSize(3, 5);');
    const openNonSq = m.w.get('sizeLockIsOpen()');
    m.w.set('setGridSize(4, 4);');
    check('(1) a restored / linked / loaded area with X != Y has the lock open; X = Y has it closed (the state is derived, not saved)', openNonSq === true && m.w.get('sizeLockIsOpen()') === false);
    check('(1) the lock is not part of the session (no sizeLockOpen in session*.js / export.js)', !/sizeLock/.test(read('SESSION_JS', 'core/session.js') + read('SESSION_APPLY_JS', 'core/session-apply.js') + read('EXPORT_JS', 'core/export.js')));
    check('(1) sketch.js: the width handler is the only writer of X: both handlers and the lock go through sizeChangeRun -> resizeBase(x, y); the handlers do not call resizeBase themselves', !/resizeBase\(/.test(XH.replace(/\/\/[^\n]*/g, '')) && !/resizeBase\(/.test(YH.replace(/\/\/[^\n]*/g, '')) && /sizeChangeRun\(t\.x, t\.y/.test(XH) && /sizeChangeRun\(t\.x, t\.y/.test(YH) && /sizeChangeRun\(gridSizeX\(\), gridSizeX\(\)/.test(grab('sizeLockToggle')) && /resizeBase\(x, y\)/.test(grab('sizeChangeRun')) && /resizeBase\(target, targetY, \{ dryRun: true \}\)/.test(grab('sizeChangePlan')));
}

// ---- 2. markup, stepper limits, phone, texts ------------------------------------------------------------------------------------------------------------
{
    const nav = HTML.slice(HTML.indexOf('id="nav-size-stepper"'), HTML.indexOf('id="nav-symmetry"'));
    const order = ['id="nav-size-stepper"', 'id="btn-size-lock"', 'id="nav-size-y-stepper"', 'nav-divider-b'].map(k => nav.indexOf(k));
    check('(2) #nav-form: the width stepper, then the lock button, then the height stepper, then the divider (Breite, Schloss, Höhe)', order.every(i => i >= 0) && order.slice(1).every((v, i) => v > order[i]), order.join());
    check('(2) the lock is a button.icon-btn, aria-pressed="true" (locked, the default), labelled size.lock; the height stepper is a .stepper, aria-disabled="true", with #shape-size-y-input (1..9)', /<button id="btn-size-lock" class="icon-btn" type="button" aria-pressed="true"[^>]*data-i18n="size\.lock"/.test(nav) && /<div id="nav-size-y-stepper" class="stepper"[^>]*aria-disabled="true"/.test(nav) && /<input type="number" id="shape-size-y-input" min="1" max="9"/.test(nav));
    check('(2) the width input is labelled size.x.input, the height input size.y.input; the width stepper is otherwise unchanged (the same input id and chevrons)', /id="shape-size-input" min="1" max="9" value="5" inputmode="none" aria-label="Größe Breite \(1 bis 9\)" data-i18n="size\.x\.input"/.test(nav) && /id="shape-size-y-input"[^>]*data-i18n="size\.y\.input"/.test(nav));
    check('(2) #more-form has the section #ov-size (hidden until the phone moves the lock and the height stepper there), next to #ov-fold', /<div id="more-form"[^>]*>\s*(<!--[\s\S]*?-->\s*)?<div id="ov-size-section" class="overlay-section" hidden>\s*<div id="ov-size" class="overlay-opts"/.test(HTML) && HTML.indexOf('id="ov-size"') < HTML.indexOf('id="ov-fold-title"'));
    // ui-form.js
    check('(2) ui-form.js: the width and the height stepper limits come from sizeAxisRange (validateGridSize); the typed range and the chevrons use them while the lock is open', /function sizeLimits\(axis\)/.test(FORM) && /sizeAxisRange\(axis, other\)/.test(FORM) && /isY = input === sizeYInput/.test(FORM) && /sizeCompute\(d, 'y'\)/.test(FORM) && /size\.ratio\.max/.test(FORM));
    check('(2) ui-form.js: the lock calls window.sizeLockToggle(); the height stepper is aria-disabled with a reason while locked and shows X; the lock\'s aria-pressed is "true" while locked', /UI\.guard\(lockBtn, function \(\) \{ window\.sizeLockToggle\(\); \}\)/.test(FORM) && /UI\.setDisabled\(yStepper, open \? null : T\['reason\.size\.lock'\]\)/.test(FORM) && /const pressed = open \? 'false' : 'true'/.test(FORM) && /sizeYInput\.value = String\(gridSizeY\(\)\)/.test(FORM));
    check('(2) ui-form.js: on the phone (html.ph) the lock and the height stepper move into #ov-size, from 768px they go back behind the width stepper (a class observer)', /phone && lockBtn\.parentNode !== ovSize\) \{ ovSize\.appendChild\(lockBtn\); ovSize\.appendChild\(yStepper\)/.test(FORM) && /!phone && lockBtn\.parentNode === ovSize/.test(FORM) && /MutationObserver\(placeSizeControls\)/.test(FORM));
    // the dot on More: the expression of syncSymmetry, evaluated
    const dotLine = (FORM.match(/const dot = three \|\|[^\n]*;/) || [''])[0];
    const dotOf = (ph, square, three) => vm.runInNewContext(dotLine + '; dot', { three, document: { documentElement: { classList: { contains: () => ph } } }, gridIsSquare: () => square });
    check('(2) #btn-more-form gets .has-state on the phone once X != Y (and by the fold as before); never for a square without the fold', dotOf(true, false, false) === true && dotOf(true, true, false) === false && dotOf(true, true, true) === true && /moreBtn\.classList\.toggle\('has-state', dot\)/.test(FORM), dotLine);
    // the Raster rows (phone): the height stepper and the lock are NOT in the 298px row
    const cfgMod = { exports: {} }; vm.runInNewContext(PCFG, { module: cfgMod, window: undefined, console }); const api = cfgMod.exports, cfg = api && (api.CONFIG || api.config || api.PHONE_CONFIG || api);
    const rows = cfg && cfg.subtabs ? cfg.subtabs.raster.rows : null;
    const widthOf = (r, narrow) => r.items.reduce((a, i) => a + (narrow ? (i.wMin || i.w) : i.w), 0) + 8 * (r.items.length - 1);
    check('(2) the Raster rows: 272 and 298 px (282 with the narrow widths, limit 288), and neither the lock nor the height stepper is a row item', rows && rows.map(r => widthOf(r)).join() === '272,298' && rows.map(r => widthOf(r, true)).join() === '272,282' && rows.every(r => r.items.every(i => !/size-lock|size-y/.test(i.id || ''))) && widthOf(rows[1], true) <= 288, rows && rows.map(r => widthOf(r) + '/' + widthOf(r, true)).join());
    // texts
    const want = { 'size.lock': ['Seitenverhältnis koppeln (Quadrat)', 'Lock aspect ratio (square)'], 'size.x.input': ['Größe Breite (1 bis 9)', 'Size width (1 to 9)'], 'size.y.input': ['Größe Höhe (1 bis 9)', 'Size height (1 to 9)'], 'size.ratio.max': ['Seitenverhältnis höchstens 1:3', 'Aspect ratio at most 1:3'] };
    check('(2) the four texts in the dictionary, de and en', Object.keys(want).every(k => dict[k] && dict[k].de === want[k][0] && dict[k].en === want[k][1]), J(Object.keys(want).filter(k => !dict[k] || dict[k].de !== want[k][0] || dict[k].en !== want[k][1])));
    const m2 = mk('square', 3, 2, 2, 'en'); m2.w.set('sizeLockOpen = true;'); m2.yin.v = '9'; m2.yin.handler();
    check('(2) the clamp note is in the language in force (en: "Aspect ratio at most 1:3")', m2.log.said.some(s => s[0] === 'size-ratio' && s[1] === 'Aspect ratio at most 1:3'), J(m2.log.said));
    check('(2) style.css: the lock shows a closed padlock while aria-pressed="true", an open one when "false"; no glass / blur', /#btn-size-lock\[aria-pressed="false"\] \.ico-closed \{ display: none; \}/.test(CSS) && /#btn-size-lock\[aria-pressed="false"\] \.ico-open \{ display: block; \}/.test(CSS) && !/#btn-size-lock[^{]*\{[^}]*(backdrop|blur|box-shadow)/.test(CSS));
}

console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
