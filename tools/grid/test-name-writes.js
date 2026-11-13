// Task 071c: updatePatternNameStatus / updateGridInfoLine write the DOM only when the shown value CHANGES (the real sketch.js code on a DOM stub with write counters).
//   node tools/grid/test-name-writes.js      (run from a tree: it reads its own ../../sketch.js; the old tree c634e55d is RED)
// A repeated call with the same input writes 0 times (it replaced the name's content on every draw() before, so the browser restarted the tooltip each time and it never appeared);
// a change of line, ordnung, lage, shape, symmetry mode or language writes exactly once per changed field; reduced symmetry has no title; the title survives every rebuild.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const SK = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8');
const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const dict = (() => { const src = fs.readFileSync(path.join(ROOT, 'ui-i18n.js'), 'utf8'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2], en: k[3] }; return m; })();
const ui = { lang: 'de' }; ui.t = (key, vars) => { const e = dict[key]; if (!e) return key; return e[ui.lang].replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] !== undefined ? vars[k] : '{' + k + '}'); };
const writes = {};   // 'id.text' / 'id.title' / 'id.other' -> number of writes
const bump = (id, kind) => { writes[id + '.' + kind] = (writes[id + '.' + kind] || 0) + 1; };
const els = {};
const mkEl = id => { const e = { id, attrs: {}, getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }, setAttribute(k, v) { bump(id, k === 'title' ? 'title' : 'other'); this.attrs[k] = v; }, removeAttribute(k) { if (k === 'title') bump(id, 'title'); delete this.attrs[k]; }, hasAttribute(k) { return this.attrs[k] !== undefined; }, closest() { return els.stepper; } };
    Object.defineProperty(e, 'textContent', { get() { return this._t || ''; }, set(v) { bump(id, 'text'); this._t = v; } });   // a textContent assignment is a write
    e.html = function (t) { bump(id, 'text'); this._t = t; return this; };   // .html() replaces the content: a write
    e.elt = e; els[id] = e; return e; };
['pattern-name-status', 'grid-info-status', 'nav-node-stepper', 'stepper', 'layer-node-count-input'].forEach(mkEl);
const w = H.makeRenderWorld('square', 3, 3, 'rotation_reflection6');
const sb = w.sb;
sb.document = { body: {}, getElementById: id => els[id] || null }; sb.window = { UI: ui }; sb.UI = ui; sb.select = id => els[id.replace('#', '')] || null;
w.set("currentShape = 'square'; setGrid({ shape: 'square', ordnung: 4, lage: 1 });");
w.sb.glossaryEntry = require(path.join(ROOT, 'core', 'glossary.js')).glossaryEntry;
w.set('let patternNameCacheSignature = null; let patternNameCacheValue = null; let patternNameCacheTip = null;');
['activeConnections', 'activeGridOverride', 'patternNameSignature', 'patternNameTooltip', 'updateGridInfoLine', 'updatePatternNameStatus'].forEach(nm => w.set(grab(nm)));
const reps = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
const call = () => { Object.keys(writes).forEach(k => delete writes[k]); w.set('updatePatternNameStatus();'); const o = Object.assign({}, writes); o.total = Object.values(o).reduce((a, b) => a + b, 0); o.name = (o['pattern-name-status.text'] || 0) + (o['pattern-name-status.title'] || 0) + (o['pattern-name-status.other'] || 0); return o; };
w.set(`connections = ${J(reps.slice(10, 12))};`);
const first = call();
check('(1) the first call shows the name and sets the tooltip', first['pattern-name-status.text'] === 1 && first['pattern-name-status.title'] === 1 && els['pattern-name-status'].attrs.title.startsWith('4q1: Ordnung 4'), J(first));
const r2 = call(), r3 = call();
check('(2) the second and the third call with unchanged input write NOTHING anywhere (name text and title, info line, stepper titles): 0 / 0', r2.total === 0 && r3.total === 0, J([r2, r3]));
const change = (tag, code, expect) => { w.set(code); const a = call(), b = call(); check(`(3) ${tag}: the name text and the title are written exactly once (the info line and the stepper title only where the grid changed), the call after it writes nothing`, a['pattern-name-status.text'] === expect.text && a['pattern-name-status.title'] === expect.title && (a['pattern-name-status.other'] || 0) === 0 && b.total === 0, J([a, b])); };
change('a new line', `connections = ${J(reps.slice(10, 13))};`, { text: 1, title: 1 });
change('the ordnung', "setGrid({ shape: 'square', ordnung: 5, lage: 1 }); connections = [];", { text: 1, title: 1 });
w.set(`connections = ${J(reps.slice(10, 12))};`); call(); call();
change('the lage', "setGrid({ shape: 'square', ordnung: 4, lage: 2 }); connections = [];", { text: 1, title: 1 });
const reps2 = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
change('lines on the lage-2 grid', `connections = ${J(reps2.slice(10, 12))};`, { text: 1, title: 1 });
change('the shape', "currentShape = 'triangle'; setGrid({ shape: 'triangle', ordnung: 3, lage: 1 }); connections = [];", { text: 1, title: 1 });
const reps3 = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
change('lines on the triangle', `connections = ${J(reps3.slice(3, 5))};`, { text: 1, title: 1 });
change('the symmetry mode (rotation only: the old name, NO title)', "symmetryMode = 'reflection_only';", { text: 1, title: 1 });
check('(4) reduced symmetry: no title attribute at all, the old name text', els['pattern-name-status'].attrs.title === undefined && !/^\d+[dq*][12]\//.test(els['pattern-name-status'].textContent), els['pattern-name-status'].textContent);
change('back to the main group (the title returns)', "symmetryMode = 'rotation_reflection6';", { text: 1, title: 1 });
check('(5) the title is there after the rebuilds', els['pattern-name-status'].attrs.title.startsWith('3d1: Ordnung 3'), els['pattern-name-status'].attrs.title);
ui.lang = 'en'; const l1 = call(), l2 = call(); ui.lang = 'de';
check('(6) a language change re-writes the TITLE (the signature carries the language; the name text itself is language-neutral) once, then nothing; the English title is there', l1['pattern-name-status.title'] === 1 && !l1['pattern-name-status.text'] && l2.total === 0, J([l1, l2]));
ui.lang = 'en'; call(); check('(6) the English title text', els['pattern-name-status'].attrs.title.startsWith('3d1: order 3'), els['pattern-name-status'].attrs.title); ui.lang = 'de'; call();
// (6b) the title is lost from outside (rebuild of the field) while the signature stays: the next call writes it back once, then nothing
delete els['pattern-name-status'].attrs.title; const t1 = call(), t2 = call();
check('(6b) a title lost from outside (same signature) comes back exactly once, then nothing', t1['pattern-name-status.title'] === 1 && !t1['pattern-name-status.text'] && t2.total === 0 && els['pattern-name-status'].attrs.title.startsWith('3d1: Ordnung 3'), J([t1, t2]));
w.set('connections = [];');
const e1 = call(), e2 = call();
check('(7) no line: the placeholder is written once, then nothing; no title', e1['pattern-name-status.text'] === 1 && e2.total === 0 && els['pattern-name-status'].attrs.title === undefined, J([e1, e2]));
w.set('nodes.push({ id: nodes.length + 1, x: 41.5, y: 99.5, free: true }); connections = [[1, nodes.length]];');
const f1 = call(), f2 = call();
check('(8) a free endpoint: the message once, then nothing; no title', f1['pattern-name-status.text'] === 1 && f2.total === 0 && els['pattern-name-status'].attrs.title === undefined && els['pattern-name-status'].textContent === 'Name unavailable (includes free endpoints)', J([f1, f2]));
console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
