// Task 071b: core/glossary.js is the ONE source of the Hinterreiter terms of the name: the tooltip reads its keys, the info card lists it, the export names the ids.
//   node tools/grid/test-glossary.js     BASE = the commit before 071b (default 49fd7c87); OLD_TREE = that tree already extracted
//   1. the old tree: everything but the optional export field "glossary" is equal (measure scripts); the files that may differ are named
//   2. the glossary: every entry has term and text in de and en; the ids the name uses exist; no text twice; the tooltip owns no text (name.tip.* is gone)
//   3. the tooltip (real function): "1 Sektor" / "n Sektoren", the explanations of the overline and of aA come from the glossary keys, de/en
//   4. the info card: the section "Begriffe" (closed, the pattern of Netz / Zeitleiste), one entry per glossary id, #info-lage gone; the name and grid block is quiet (CSS rules)
//   5. the export field "glossary": ids only, only with a v2 name, formatVersion 2, the rest of the export byte-equal; gallery.html loads core/glossary.js
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || '49fd7c87';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = JSON.stringify;
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const SK = read('sketch.js');
const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const dict = (() => { const src = read('ui-i18n.js'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2], en: k[3] }; return m; })();
const G = require(path.join(ROOT, 'core', 'glossary.js'));
const tIn = ui => (key, vars) => { const e = dict[key]; if (!e) return key; return e[ui.lang].replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] !== undefined ? vars[k] : '{' + k + '}'); };

// ---- 1. old tree ---------------------------------------------------------------------------------------------------------------------------------
let oldDir = process.env.OLD_TREE || null;
if (!oldDir) {
    try {
        cp.execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
        oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glossary-old-'));
        cp.execSync(`git archive ${BASE} | tar -x -C "${oldDir}"`, { cwd: ROOT, stdio: 'ignore' });
    } catch (e) { oldDir = null; }
}
if (!oldDir) console.log('NOTE  the old tree is not available: the comparison with it is skipped');
else {
    const run = (cwd, script) => cp.execFileSync('node', [script], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
    for (const script of ['tools/grid/measure-g5a.js', 'tools/grid/measure-g5b.js', 'tools/session/measure-g6a.js', 'tools/grid/measure-g6b.js', 'tools/grid/measure-lage2-app.js']) {
        let a, b, err = '';
        try { a = JSON.parse(run(oldDir, script)); b = JSON.parse(run(ROOT, script)); } catch (e) { err = String(e.message).slice(0, 200); }
        const keys = a ? Object.keys(b) : [], bad = a ? keys.filter(k => J(a[k]) !== J(b[k])) : [];
        check('(1) ' + script + ' equals the old tree (' + keys.length + ' keys; the export is compared without the new field "glossary")', a && keys.length > 5 && bad.length === 0, err || bad.slice(0, 3).join(' | '));
    }
    const same = f => read(f) === fs.readFileSync(path.join(oldDir, f), 'utf8');
    check('(1) core/*.js except export.js and the new glossary.js, core/faces, tiling, facecolor, orbits, state, session, forms, catalog and tools/morph/off-path-golden.json are unchanged', fs.readdirSync(path.join(ROOT, 'core')).filter(f => /\.js$/.test(f) && f !== 'export.js' && f !== 'glossary.js').every(f => same('core/' + f)) && same('tools/morph/off-path-golden.json') && !fs.existsSync(path.join(oldDir, 'core/glossary.js')));
}
const P5 = ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect', 'translate', 'rotate', 'scale', 'textSize', 'text', 'textAlign', 'background', 'clear'];
function world(shape, spec, mode, ui) {
    const w = H.makeRenderWorld(shape, 3, 3, mode || 'rotation_reflection6');
    const sb = w.sb;
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.CLOSE = 'close'; sb.window = { UI: ui }; if (ui) sb.UI = ui;
    P5.forEach(f => { sb[f] = () => { }; });
    w.set('globalThis.__lage2 = true;');
    if (spec) w.set(`currentShape = ${J(spec.shape)}; setGrid(${J(spec)}); symmetryMode = ${J(mode || 'rotation_reflection6')};`);
    return w;
}

// ---- 2. the glossary --------------------------------------------------------------------------------------------------------------------------------
{
    const ids = G.GLOSSARY.map(e => e.id);
    check('(2) 14 entries: order, position, maingroup, formsign, nodes, nodenumber, family, letter, sector, bar, lower, mirror, both, nameform', J(ids) === J(['order', 'position', 'maingroup', 'formsign', 'nodes', 'nodenumber', 'family', 'letter', 'sector', 'bar', 'lower', 'mirror', 'both', 'nameform']));
    const missing = [];
    for (const e of G.GLOSSARY) for (const k of [e.termKey, e.textKey]) { const d = dict[k]; if (!d || !d.de || !d.en) missing.push(k); }
    check('(2) every entry has its term and its explanation in German AND English (non-empty), in ui-i18n.js DICT; the entry holds only the two keys (no text of its own)', missing.length === 0 && G.GLOSSARY.every(e => J(Object.keys(e).sort()) === J(['id', 'termKey', 'textKey'])), missing.join(','));
    const texts = G.GLOSSARY.map(e => dict[e.textKey].de), textsEn = G.GLOSSARY.map(e => dict[e.textKey].en);
    check('(2) no explanation twice (German or English), the English differs from the German', new Set(texts).size === texts.length && new Set(textsEn).size === textsEn.length && G.GLOSSARY.every(e => dict[e.textKey].de !== dict[e.textKey].en));
    check('(2) the terms are the Hinterreiter words of docs/terminology.md (Drehling, Spiegeling, Überstrich, Hauptgruppe, Knotennummer, Familie, Buchstabe, Sektor) and no Ostwald terms', /Drehling/.test(dict['glossary.lower'].de) && /Spiegeling/.test(dict['glossary.mirror'].de) && /Drehling.*Spiegeling/.test(dict['glossary.both'].de) && dict['glossary.bar.term'].de === 'Überstrich' && !/Ostwald|Farbkreis|Tafel|Fundstelle|S\. \d/.test(G.GLOSSARY.map(e => dict[e.textKey].de + dict[e.termKey].de).join(' ')));
    check('(2) the tooltip keys name.tip.* are gone from the dictionary and from sketch.js; the old formulations ("berührt", "touches", "Großbuchstabe: Drehling ist") are gone', !Object.keys(dict).some(k => /^name\.tip\./.test(k)) && !/name\.tip\./.test(SK) && !/berührt \{s\}|touches \{s\}|Drehling ist zugleich/.test(read('ui-i18n.js')));
    check('(2) glossaryIdsForName: the grid and line terms always; bar only with an overline, both only with aA; [] for null', J(G.glossaryIdsForName({ tokens: [{ key: { gegen: false }, spiegelgleich: false }] })) === J(['order', 'position', 'maingroup', 'formsign', 'nodes', 'nodenumber', 'family', 'letter', 'sector', 'nameform']) && G.glossaryIdsForName({ tokens: [{ key: { gegen: true }, spiegelgleich: true }] }).join() === 'order,position,maingroup,formsign,nodes,nodenumber,family,letter,sector,bar,both,nameform' && G.glossaryIdsForName(null).length === 0);
}

// ---- 3. the tooltip --------------------------------------------------------------------------------------------------------------------------------
{
    const ui = { lang: 'de' }; ui.t = tIn(ui);
    const w = world('square', { shape: 'square', ordnung: 12, lage: 1 }, 'rotation_reflection6', ui);
    w.sb.glossaryEntry = G.glossaryEntry;
    ['patternNameTooltip'].forEach(n => w.set(grab(n)));
    // pick lines that cover 1 sector (a), several sectors, an overline and a capital (aA)
    const reps = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
    w.set(`connections = ${J(reps)};`);
    const v2 = w.get('gridDisplayNameFor(baseGridSpecNow(), connections, symmetryMode)');
    const pick = [v2.tokens.find(t => t.key.buchstabe === 'a'), v2.tokens.find(t => t.key.buchstabe !== 'a' && !t.spiegelgleich && !t.key.gegen), v2.tokens.find(t => t.spiegelgleich), v2.tokens.find(t => t.key.gegen)].filter(Boolean);
    const sub = { grid: v2.grid, group: v2.group, tokens: pick };
    w.sb.__sub = sub;
    const tip = w.get('patternNameTooltip(__sub, baseGridSpecNow())');
    const lines = tip.split('\n');
    check('(3) the first line names the grid with glossary words: "12q1: Ordnung 12, Quadrat, Lage 1, Hauptgruppe 4*, 169 Knoten"', lines[0] === '12q1: Ordnung 12, Quadrat, Lage 1, Hauptgruppe 4*, 169 Knoten', lines[0]);
    const a = lines.find(l => l.includes('Buchstabe a '));
    check('(3) singular and plural: a letter a touches "(1 Sektor)", every other letter "(n Sektoren)" with n >= 2', /\(1 Sektor\)/.test(a || '') && !/1 Sektoren/.test(tip) && lines.slice(1).filter(l => !l.includes('Buchstabe a ')).every(l => /\(\d+ Sektoren\)/.test(l) && !/\(1 Sektoren\)/.test(l)), tip);
    check('(3) the capital: "aA: Klein- und Großbuchstabe zugleich: die Linie ist zugleich Drehling und Spiegeling." (the glossary term and text); the overline: "Überstrich: Die Strecke läuft gegen den Uhrzeigersinn ..."', lines.some(l => l.includes('; aA: ' + dict['glossary.both'].de)) && lines.some(l => l.includes('; Überstrich: ' + dict['glossary.bar'].de)), tip);
    ui.lang = 'en';
    const tipEn = w.get('patternNameTooltip(__sub, baseGridSpecNow())');
    check('(3) English: "12q1: order 12, Square, position 1, main group 4*, 169 nodes", "(1 sector)" / "(n sectors)", "overline: ...", "aA: ..." from the glossary keys', tipEn.startsWith('12q1: order 12, Square, position 1, main group 4*, 169 nodes') && /\(1 sector\)/.test(tipEn) && !/1 sectors/.test(tipEn) && tipEn.includes('; overline: ' + dict['glossary.bar'].en) && tipEn.includes('; aA: ' + dict['glossary.both'].en), tipEn);
    check('(3) every explanation the tooltip prints is a glossary text (no tooltip text of its own): the tooltip function reads glossaryEntry(...).termKey / .textKey and the two sector keys only', /glossaryEntry\(id\)\.termKey/.test(SK) && /glossaryEntry\(id\)\.textKey/.test(SK) && !/T\('name\./.test(SK));
}

// ---- 4. the info card ------------------------------------------------------------------------------------------------------------------------------
{
    const html = read('index.html'), css = read('style.css');
    const card = html.slice(html.indexOf('id="info-card"'), html.indexOf('id="ui-notices"'));
    const m = /<details class="info-section" id="info-glossary">([\s\S]*?)<\/details>/.exec(card);
    check('(4) the section "Begriffe": a <details class="info-section" id="info-glossary"> without `open` (closed by default), before Netz and Zeitleiste, the summary has the key info.glossary.title', !!m && !/<details[^>]*\bopen\b/.test(card) && card.indexOf('id="info-glossary"') < card.indexOf('id="info-net"') && /<summary data-i18n="info\.glossary\.title">Begriffe<\/summary>/.test(card));
    const spans = m ? [...m[1].matchAll(/<p><span data-i18n="(glossary\.[a-z]+)\.term">([^<]*)<\/span>: <span data-i18n="(glossary\.[a-z]+)">([^<]*)<\/span><\/p>/g)] : [];
    check('(4) one plain line per glossary id, in the order of the glossary, term and explanation with their keys; the German markup text equals the dictionary', spans.length === 14 && spans.every((s, i) => s[1] === G.GLOSSARY[i].textKey && s[3] === G.GLOSSARY[i].textKey && s[2].replace(/&amp;/g, '&') === dict[G.GLOSSARY[i].termKey].de && s[4].replace(/&amp;/g, '&') === dict[G.GLOSSARY[i].textKey].de), String(spans.length));
    check('(4) #info-lage is gone (markup) and the key info.lage with it', !/info-lage/.test(html) && !dict['info.lage'] && !/info\.lage/.test(read('ui-i18n.js')));
    const rule = /#pattern-name-group \{ align-items: flex-start; text-align: left; \}\n#pattern-name-group #pattern-name-status, #pattern-name-group #grid-info-status \{ font-size: var\(--size-secondary\); font-weight: var\(--weight-regular\); color: var\(--color-text\); opacity: 1; text-align: left; font-variant-numeric: tabular-nums; \}/.test(css);
    check('(4) the name and grid block is quiet: left-aligned, ONE size (--size-secondary), ONE weight (regular), ONE colour (--color-text, no opacity), the same rule for both lines; it beats the old centred, muted rule of index.html by its id selectors', rule && /#pattern-name-status \{[^}]*text-align: center/.test(html) && !/#grid-info-status \{[^}]*(font-size|color|opacity)/.test(css.replace(/#pattern-name-group #grid-info-status[^{]*\{[^}]*\}/, '')));
}

// ---- 5. the export field ---------------------------------------------------------------------------------------------------------------------------
{
    const w = world('square', { shape: 'square', ordnung: 4, lage: 1 });
    const reps = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
    w.set(`connections = ${J(reps.slice(10, 13))};`);
    const d = JSON.parse(w.get('JSON.stringify(buildExportData())'));
    const dn = w.get('gridDisplayNameFor(baseGridSpecNow(), connections, symmetryMode)');
    check('(5) a v2 name: the export has "glossary" = the ids of the terms the name uses (strings from the glossary, no text), formatVersion stays 2, the name is the export name', d.formatVersion === 2 && Array.isArray(d.glossary) && J(d.glossary) === J(G.glossaryIdsForName(dn)) && d.glossary.every(id => G.glossaryEntry(id) && !/\s/.test(id)) && d.name === dn.ascii, J(d.glossary));
    const keysOnly = JSON.stringify(d.glossary);
    check('(5) the field carries NO full text (ids only): not one dictionary text appears in the field', !Object.values(dict).some(v => v.de.length > 12 && keysOnly.includes(v.de)) && keysOnly.length < 200);
    const noField = Object.assign({}, d); delete noField.glossary;
    w.set('symmetryMode = "rotation3";');
    const d2 = JSON.parse(w.get('JSON.stringify(buildExportData())'));
    w.set('symmetryMode = "rotation_reflection6"; connections = [];');
    const d3 = JSON.parse(w.get('JSON.stringify(buildExportData())'));
    check('(5) no v2 name (reduced symmetry, no line): no "glossary" field at all', d2.glossary === undefined && d3.glossary === undefined && d2.name === null && d3.name === null, J([d2.name, d2.glossary]));
    check('(5) the field is the last key added (additive): the keys of the export before it are the same as without it', Object.keys(d).filter(k => k !== 'glossary').join() === Object.keys(noField).join());
    const gal = read('gallery.html'), idx = read('index.html');
    check('(5) gallery.html and index.html load core/glossary.js after core/orbits.js (and index.html before core/export.js); no effect in the gallery (test-gallery-globals)', /core\/orbits\.js[^\n]*\n\s*<script src="core\/glossary\.js/.test(gal) && /core\/orbits\.js[^\n]*\n\s*<script src="core\/glossary\.js/.test(idx) && idx.indexOf('<script src="core/glossary.js') < idx.indexOf('<script src="core/export.js') && !/(document|window|select|createCanvas)\b/.test(read('core/glossary.js').replace(/\/\*[\s\S]*?\*\//, '')));
}

console.log(`${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
