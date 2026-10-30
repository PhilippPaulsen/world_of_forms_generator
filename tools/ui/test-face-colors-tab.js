// Guard for fix F1: the Face Colors group (#face-colors-group) is part of the Farbe tab only; no status, note or empty button of it shows in Form or Netz, and in the Farbe tab at 768px and up only the
// compact chip view shows. sketch.js (updateFaceColorsPanel) shows the group whenever the active sheet's Fill is on and knows no tab, so the tab rule lives in style.css.
// The test evaluates the REAL style.css: a small CSS reader (rules, @media (max-width: 767px), specificity, order) and a small selector matcher decide the computed `display` of a model of the group
// (every child the markup and the engine make) in every cell of a table: tab x layout x the `hidden` attribute sketch.js toggles x the states of the children.
//   node tools/ui/test-face-colors-tab.js
//   STYLE_CSS=... node tools/ui/test-face-colors-tab.js        (sabotage runs)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CSS_FILE = process.env.STYLE_CSS || path.join(ROOT, 'style.css');
const SKETCH_FILE = process.env.SKETCH_JS || path.join(ROOT, 'sketch.js');
const CSS = fs.readFileSync(CSS_FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };

// ---- the CSS reader: rules with their media context --------------------------------------------------------------------------------------------------------------------------------------------
function readRules(css) {
  const rules = []; let order = 0;
  function block(text, media) {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i); if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const body = text.slice(open + 1, j - 1);
      if (/^@media/i.test(head)) block(body, media + ' ' + head.replace(/^@media\s*/i, '').trim());
      else if (head.startsWith('@')) { /* @font-face, @keyframes, @supports ...: not part of the cascade of the elements under test */ }
      else {
        const decls = {};
        body.split(';').forEach((d) => { const k = d.indexOf(':'); if (k > 0) decls[d.slice(0, k).trim().toLowerCase()] = d.slice(k + 1).replace(/!important/i, '').trim(); });
        splitTop(head).forEach((sel) => rules.push({ selector: sel.trim(), decls, media: media.trim(), order: order++ }));
      }
      i = j;
    }
  }
  block(css, '');
  return rules;
}
function splitTop(s) { const out = []; let depth = 0, cur = ''; for (const ch of s) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.filter((x) => x.trim()); }

// ---- the selector matcher: compounds of tag / .class / #id / [attr] / [attr="v"] / :not(compound), combinators ' ' and '>' ------------------------------------------------------------------------
function parseCompound(s) {
  const c = { tag: null, ids: [], classes: [], attrs: [], nots: [] };
  let i = 0; const m = /^[a-zA-Z][a-zA-Z0-9-]*|^\*/.exec(s); if (m) { c.tag = m[0]; i = m[0].length; }
  while (i < s.length) {
    const ch = s[i];
    if (ch === '.') { const r = /^\.([\w-]+)/.exec(s.slice(i)); c.classes.push(r[1]); i += r[0].length; }
    else if (ch === '#') { const r = /^#([\w-]+)/.exec(s.slice(i)); c.ids.push(r[1]); i += r[0].length; }
    else if (ch === '[') { const e = s.indexOf(']', i), body = s.slice(i + 1, e), r = /^([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?$/.exec(body); c.attrs.push({ name: r[1], value: r[2] !== undefined ? r[2] : r[3] !== undefined ? r[3] : r[4] }); i = e + 1; }
    else if (s.startsWith(':not(', i)) { let d = 1, j = i + 5; while (j < s.length && d) { if (s[j] === '(') d++; else if (s[j] === ')') d--; j++; } c.nots.push(parseCompound(s.slice(i + 5, j - 1).trim())); i = j; }
    else throw new Error('unsupported selector part "' + s.slice(i) + '" in "' + s + '"');
  }
  return c;
}
function parseSelector(sel) { // [{ compound, comb }] right to left: comb = how the PREVIOUS (left) one relates
  const parts = []; const re = /\s*([>])\s*|\s+/g; let last = 0, m, comb = null; const toks = [];
  const s = sel.trim(); let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (!depth && (ch === '>' || /\s/.test(ch))) { if (cur) { toks.push(cur); cur = ''; } if (ch === '>') toks.push('>'); } else cur += ch; }
  if (cur) toks.push(cur);
  for (let i = 0; i < toks.length; i++) { if (toks[i] === '>') continue; parts.push({ compound: parseCompound(toks[i]), comb: i > 0 ? (toks[i - 1] === '>' ? '>' : ' ') : null }); }
  return parts;
}
function matchCompound(c, el) {
  if (c.tag && c.tag !== '*' && c.tag !== el.tag) return false;
  if (c.ids.some((x) => el.id !== x)) return false;
  if (c.classes.some((x) => !(el.classes || []).includes(x))) return false;
  if (c.attrs.some((a) => { const v = (el.attrs || {})[a.name]; return a.value === undefined ? v === undefined : v !== a.value; })) return false;
  if (c.nots.some((n) => matchCompound(n, el))) return false;
  return true;
}
function matchSel(parts, el) {
  function at(k, e) {
    if (!e || !matchCompound(parts[k].compound, e)) return false;
    if (k === 0) return true;
    const comb = parts[k].comb;
    if (comb === '>') return at(k - 1, e.parent);
    for (let p = e.parent; p; p = p.parent) if (at(k - 1, p)) return true;
    return false;
  }
  return at(parts.length - 1, el);
}
function specificity(sel) {
  let a = 0, b = 0, c = 0;
  const count = (cm) => { a += cm.ids.length; b += cm.classes.length + cm.attrs.length; if (cm.tag && cm.tag !== '*') c++; cm.nots.forEach(count); };
  parseSelector(sel).forEach((p) => count(p.compound));
  return a * 10000 + b * 100 + c;
}

const RULES = readRules(CSS).filter((r) => /display/.test(Object.keys(r.decls).join(' ')) || true);
const PHONE_MEDIA = /^\(max-width:\s*767px\)$/;
function displayOf(el, phone) {
  let best = null;
  for (const r of RULES) {
    if (r.decls.display === undefined) continue;
    if (r.media && !(phone && PHONE_MEDIA.test(r.media))) continue;   // every other @media (hover, pointer, prefers-color-scheme, width ranges) is not part of this table
    let parts; try { parts = parseSelector(r.selector); } catch (e) { continue; }
    if (!matchSel(parts, el)) continue;
    const sp = specificity(r.selector);
    if (!best || sp > best.sp || (sp === best.sp && r.order > best.order)) best = { sp, order: r.order, value: r.decls.display, selector: r.selector };
  }
  if (best) return best;
  return { value: el.attrs && el.attrs.hidden !== undefined ? 'none' : 'block', selector: el.attrs && el.attrs.hidden !== undefined ? '[hidden] (user agent)' : '(user agent)' };
}
function shown(el, phone) { for (let e = el; e; e = e.parent) if (displayOf(e, phone).value === 'none') return false; return true; }

// ---- the model: <html> > body > .controls-container > #face-colors-group and everything inside it, as the markup and the engine make it ------------------------------------------------------------------
function build(o) {
  const mk = (tag, extra, parent) => { const e = Object.assign({ tag, id: null, classes: [], attrs: {}, parent: parent || null, kids: [] }, extra || {}); if (parent) parent.kids.push(e); return e; };
  const html = mk('html', { classes: o.htmlClasses, attrs: { 'data-tab': o.tab } });
  const body = mk('body', {}, html), main = mk('div', { classes: ['main-container'] }, body), cc = mk('div', { classes: ['controls-container'] }, main);
  const group = mk('div', { id: 'face-colors-group', classes: ['control-group'], attrs: o.groupHidden ? { hidden: '' } : {} }, cc);
  const E = {};
  E.group = group;
  E.title = mk('label', { id: 'face-colors-title' }, group);
  E.kfnote = mk('div', { id: 'face-colors-timeline-note', attrs: o.kfnoteHidden ? { hidden: '' } : {} }, group);
  E.status = mk('div', { id: 'face-colors-status' }, group);
  E.note = mk('div', { id: 'face-colors-note' }, group);
  E.list = mk('div', { id: 'face-colors-list' }, group);
  E.row = mk('div', { classes: ['fc-row'] }, E.list);
  E.rowStepper = mk('span', { classes: ['pairing-variant'] }, E.row);
  E.unassigned = mk('div', { id: 'face-colors-unassigned', attrs: o.unassignedHidden ? { hidden: '' } : {} }, group);
  if (o.host) {   // the row host the engine makes inside the group while the trails surface is applied (kind `group`), holding the two containers
    E.host = mk('div', { id: 'sr-trails-host', classes: ['sr-host'] }, group);
    E.chips = mk('div', { id: 'ph-trail-chips', classes: ['ph-chips'] }, E.host);
    E.chip = mk('button', { classes: ['ph-chip'] }, E.chips);
    E.stepper = mk('div', { id: 'ph-trail-stepper', classes: ['ph-trail-stepper'] }, E.host);
    E.stepBtn = mk('button', { classes: ['icon-btn', 'ph-trail-btn'] }, E.stepper);
    E.label = mk('span', { classes: ['ph-trail-label'] }, E.stepper);
  }
  return E;
}
const FLAGS = { form: 'sr sr-timeline', netz: 'sr sr-timeline sr-netz', farbe: 'sr sr-timeline sr-trails' };
const OLD = ['title', 'kfnote', 'status', 'note', 'list', 'row', 'rowStepper', 'unassigned'];
const VIEW = ['host', 'chips', 'chip', 'stepper', 'stepBtn', 'label'];

console.log('== the premise: sketch.js shows the group by Fill and layer only ==');
(function premise() {
  const sk = fs.readFileSync(SKETCH_FILE, 'utf8');
  const i = sk.indexOf('function updateFaceColorsPanel()'), body = sk.slice(i, sk.indexOf('\n}\n', i));
  check('updateFaceColorsPanel() sets groupEl.hidden from activeShowFaces() and reads no tab (the tab rule must come from the CSS)', i > 0 && /groupEl\.hidden = !visible/.test(body) && /const visible = activeShowFaces\(\)/.test(body) && !/data-tab|uiNav|currentTab|tabchange/.test(body));
})();

console.log('\n== the rule ==');
(function rule() {
  const hits = RULES.filter((r) => r.selector === 'html:not([data-tab="farbe"]) #face-colors-group');
  check('exactly one rule `html:not([data-tab="farbe"]) #face-colors-group`, declaring display: none, outside every @media (every width)', hits.length === 1 && hits[0].decls.display === 'none' && hits[0].media === '', JSON.stringify(hits.map((h) => [h.media, h.decls])));
  check('the rule does not name the phone gate or a phone class (it is no html.ph rule: the phone block of style.css starts later)', hits.length === 1 && !/\.ph\b|\.ph-/.test(hits[0].selector));
  const tabs = new Set(); RULES.forEach((r) => { if (/#face-colors-group/.test(r.selector) && /data-tab/.test(r.selector)) tabs.add(r.selector); });
  check('no rule shows the group for a named tab other than the `:not(farbe)` one (no `[data-tab="form"]` / `"netz"` rule that could undo it)', [...tabs].every((s) => /:not\(\[data-tab="farbe"\]\)/.test(s)), [...tabs].join(' | '));
})();

console.log('\n== the table: tab x layout x the hidden attribute x the states of the children ==');
const rows = [];
for (const phone of [false, true]) for (const tab of ['form', 'netz', 'farbe']) for (const groupHidden of [false, true]) for (const kfnoteHidden of [false, true]) for (const unassignedHidden of [false, true]) {
  const htmlClasses = (phone ? ['ph'] : []).concat(FLAGS[tab].split(' '));
  const host = tab === 'farbe';   // the engine makes the host only in the Farbe tab (the surface flag sr-trails); outside it the containers are back in their hidden holder
  const E = build({ tab, htmlClasses, groupHidden, kfnoteHidden, unassignedHidden, host });
  rows.push({ phone, tab, groupHidden, kfnoteHidden, unassignedHidden, E });
}
function cellName(r) { return `${r.phone ? 'phone' : '>=768'} ${r.tab} ${r.groupHidden ? 'group hidden' : 'group shown by sketch.js'}, kf-note ${r.kfnoteHidden ? 'hidden' : 'shown'}, unassigned ${r.unassignedHidden ? 'hidden' : 'shown'}`; }

// 1 Form and Netz, both layouts: nothing of the group
{
  const bad = []; let n = 0;
  rows.filter((r) => r.tab !== 'farbe').forEach((r) => { Object.keys(r.E).forEach((k) => { n++; if (shown(r.E[k], r.phone)) bad.push(cellName(r) + ' ' + k); }); });
  check(`Form and Netz (${rows.filter((r) => r.tab !== 'farbe').length} cells x every element): neither the group nor anything inside it is displayed, at >= 768 and on the phone, whatever sketch.js does to \`hidden\``, bad.length === 0 && n > 0, bad.slice(0, 4).join(' | ') + (bad.length > 4 ? ' ... (' + bad.length + ')' : ''));
}
// 2 Farbe at >= 768: only the chip view
{
  const cells = rows.filter((r) => r.tab === 'farbe' && !r.phone && !r.groupHidden);
  const bad = [];
  cells.forEach((r) => { OLD.forEach((k) => { if (shown(r.E[k], false)) bad.push(cellName(r) + ' ' + k); }); VIEW.forEach((k) => { if (!shown(r.E[k], false)) bad.push(cellName(r) + ' MISSING ' + k); }); if (!shown(r.E.group, false)) bad.push(cellName(r) + ' group'); });
  check(`Farbe at >= 768 (${cells.length} cells, every state of the keyframe note and the unassigned row): the group and the chip view (host, chips, a chip, the stepper row, its button, the label) show; the title, keyframe note, status, rule note, list header, list rows and the unassigned row do not`, bad.length === 0 && cells.length > 0, bad.slice(0, 4).join(' | '));
}
{
  const cells = rows.filter((r) => r.tab === 'farbe' && !r.phone && r.groupHidden);
  const bad = cells.filter((r) => shown(r.E.group, false) || shown(r.E.chips, false));
  check('Farbe at >= 768 with Fill off (sketch.js sets `hidden` on the group): the group and the chip view are not displayed (the tab rule does not undo `hidden`)', bad.length === 0 && cells.length > 0, bad.map(cellName).slice(0, 2).join(' | '));
}
// 3 the phone: nothing of the old group in any tab (it sits in the hidden controls container); the table pins the CSS, the engine tests pin the Spuren pane
{
  const bad = [];
  rows.filter((r) => r.phone).forEach((r) => { OLD.concat(['group']).forEach((k) => { if (shown(r.E[k], true)) bad.push(cellName(r) + ' ' + k); }); });
  check('the phone (all tabs): the old group and its parts are not displayed (the controls container is hidden under html.ph; the Spuren pane is the engine\'s)', bad.length === 0, bad.slice(0, 3).join(' | '));
}
// 4 which rule decides, for the record of the failure messages
{
  const r = rows.find((x) => !x.phone && x.tab === 'farbe' && !x.groupHidden && !x.kfnoteHidden), E = r.E;
  const by = (k) => displayOf(E[k], false).selector;
  check('in the Farbe tab at >= 768 the old parts are parked by the engine\'s rule `html.sr-trails:not(.ph) #face-colors-group > :not(.sr-host)` and the host keeps its own display', OLD.filter((k) => !['row', 'rowStepper', 'list'].includes(k) || true).every((k) => k === 'row' || k === 'rowStepper' ? true : /:not\(\.sr-host\)/.test(by(k)) || /\[hidden\]/.test(by(k))) && /\.sr-host/.test(by('host')), OLD.map((k) => k + ':' + by(k)).join(' ; '));
}
// 5 a leftover chip view in the group (host, chips, stepper row) outside the Farbe tab is hidden by the tab rule as well
{
  const bad = [];
  for (const tab of ['form', 'netz']) for (const phone of [false, true]) {
    const E = build({ tab, htmlClasses: (phone ? ['ph'] : []).concat(FLAGS[tab].split(' ')), groupHidden: false, kfnoteHidden: false, unassignedHidden: true, host: true });   // the engine left its host behind (a bug the rule must survive)
    VIEW.forEach((k) => { if (shown(E[k], phone)) bad.push((phone ? 'phone ' : '>=768 ') + tab + ' ' + k); });
  }
  check('a LEFTOVER row host with the chips and the stepper row inside the group (as if the engine had not removed it) is hidden outside the Farbe tab too: the group is display: none, so is everything in it', bad.length === 0, bad.join(' | '));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
