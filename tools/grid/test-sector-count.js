// Task 072c2: the tooltip of the name says how many sectors a line touches: the RANK of its letter in the series of the shape (triangle a e i n, square a d g k n, hexagon a c e g i l n), not the index in the
// whole alphabet 'abcdefghiklmn' ("g (7 Sektoren)" in the square was wrong: g is the 3rd letter of the square series).
//   node tools/grid/test-sector-count.js      SKETCH_JS / ORBITS_JS replace a file by a (sabotaged) copy; on 6f85fd39 the file reads its own tree (RED: the old tooltip)
//   1. the table: every letter of every series -> its count (and nothing else is a letter of that shape); never more than the number of letters of the series (4 / 5 / 7)
//   2. the oracle (tools/gitter/measure-name-rule.js pairOrbits: its n is the number of sectors touched, directly): every orbit of 12 grids -> the core's count equals n
//   3. the real tooltip text (patternNameTooltip, de and en): the examples of the order (square 52g -> 3, hexagon 12.6c -> 2, triangle 15a -> 1), the full group and "nur Drehung"
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const B = require(path.join(ROOT, 'tools', 'gitter', 'oracle-bridge.js'));
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const M = require(path.join(ROOT, 'tools', 'gitter', 'measure-name-rule.js'));
const core = B.loadCore();
const HAS = core.get("typeof lineKeySectors === 'function'");
const SERIES = { triangle: 'aein', square: 'adgkn', hex: 'acegiln' };
const SK = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const dict = (() => { const src = fs.readFileSync(path.join(ROOT, 'ui-i18n.js'), 'utf8'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2].replace(/\\'/g, "'"), en: k[3].replace(/\\'/g, "'") }; return m; })();
const ui = { lang: 'de' }; ui.t = (key, vars) => { const e = dict[key]; if (!e) return key; return e[ui.lang].replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] !== undefined ? vars[k] : '{' + k + '}'); };

// ---- the tooltip function in a world, fed by a v2 object -------------------------------------------------------------------------------------------
function tooltipWorld(shape, ordnung, lage) {
    const w = H.makeRenderWorld(shape, 3, 3, 'rotation_reflection6'), sb = w.sb;
    sb.document = { body: {} }; sb.window = { UI: ui }; sb.UI = ui;
    w.set(`currentShape = ${J(shape)}; setGrid(${J({ shape, ordnung, lage })});`);
    sb.glossaryEntry = require(path.join(ROOT, 'core', 'glossary.js')).glossaryEntry;
    if (process.env.ORBITS_JS) { /* the world loads core from the repo; a sabotaged orbits.js is judged by the core part of this test */ }
    w.set(grab('patternNameTooltip'));
    return w;
}

// ---- 1. the series ---------------------------------------------------------------------------------------------------------------------------------
{
    const bad = [];
    for (const [shape, series] of Object.entries(SERIES)) {
        const f = HAS ? core.get('lineKeySectors') : () => undefined;
        series.split('').forEach((ch, i) => { const n = f({ z1: 5, z2: 2, buchstabe: ch, gegen: false }, shape); if (n !== i + 1) bad.push(`${shape} ${ch}: ${n} instead of ${i + 1}`); });
        'abcdefghiklmn'.split('').filter(ch => series.indexOf(ch) < 0).forEach(ch => { const n = f({ z1: 5, z2: 2, buchstabe: ch, gegen: false }, shape); if (n !== null) bad.push(`${shape} ${ch}: ${n} instead of null (no letter of the series)`); });
        const max = Math.max(...series.split('').map(ch => f({ z1: 5, z2: 2, buchstabe: ch, gegen: false }, shape)));
        if (max !== series.length) bad.push(`${shape}: the largest count ${max}, the series has ${series.length} letters`);
    }
    check('(1) every letter of the series of each shape gives its rank (triangle a e i n = 1..4, square a d g k n = 1..5, hexagon a c e g i l n = 1..7), a letter of another shape\'s series gives null, never more than 4 / 5 / 7', bad.length === 0, bad.slice(0, 4).join(' | '));
}

// ---- 2. the oracle ---------------------------------------------------------------------------------------------------------------------------------
{
    let n = 0; const bad = [];
    const f = HAS ? core.get('lineKeySectors') : () => undefined;
    for (const [shape, o, l] of [['triangle', 3, 2], ['triangle', 5, 1], ['triangle', 8, 1], ['square', 4, 2], ['square', 5, 2], ['square', 6, 1], ['square', 8, 1], ['hex', 3, 1], ['hex', 4, 1], ['hex', 2, 2], ['hex', 6, 1], ['hex', 5, 1]]) {
        const g = M.buildGrid(shape, o, l);
        for (const orb of M.pairOrbits(g)) { n++; const c = f({ z1: orb.z1, z2: orb.z2, buchstabe: orb.letter, gegen: orb.bar }, shape); if (c !== orb.n) bad.push(`${shape}${o}/${l} ${orb.name}: core ${c}, oracle n ${orb.n}`); }
    }
    check(`(2) ${n} orbits of 12 grids (two-digit families included): the count of sectors equals the oracle's n (sectors touched by the segment, read directly)`, n > 800 && bad.length === 0, bad.slice(0, 4).join(' | '));
}

// ---- 3. the real tooltip text ----------------------------------------------------------------------------------------------------------------------
{
    const cases = [
        ['square', 4, 1, '52g', 'rotation_reflection6', 3], ['square', 4, 1, '52g', 'rotation3', 3],
        ['hex', 8, 1, '12.6c', 'rotation_reflection6', 2], ['hex', 8, 1, '12.6c', 'rotation6', 2],
        ['triangle', 4, 2, '51a', 'rotation_reflection6', 1], ['triangle', 4, 2, '51a', 'rotation3', 1, '15a'],
    ];
    const bad = []; let seen = 0;
    for (const [shape, o, l, tok, mode, want, shown] of cases) {
        const spec = { shape, ordnung: o, lage: l }, t = core.get('getLineKeyTable')(spec), e = t.byToken.get(tok);
        if (!e) { bad.push(tok + ' does not exist in ' + shape + o); continue; }
        const nameFn = core.get(mode.startsWith('rotation_reflection') ? 'gridDisplayNameFor' : 'gridRotationNameFor');
        const pair = shown ? e.pairs.find(p => { const r = nameFn(spec, [p], mode); return r && r.tokens[0].token === shown; }) : e.pairs[0];   // the mirror-equal orbit is shown as 15a (task 072c)
        const v2 = pair ? nameFn(spec, [pair], mode) : null;
        if (!v2) { bad.push(tok + ' ' + mode + ': no name'); continue; }
        const w = tooltipWorld(shape, o, l);
        for (const lang of ['de', 'en']) {
            ui.lang = lang; const tip = w.get(`patternNameTooltip(${J(v2)}, ${J(spec)})`);
            const m = /\((\d+) (Sektor|Sektoren|sector|sectors)\)/.exec(tip); seen++;
            const one = want === 1, wantWord = lang === 'de' ? (one ? 'Sektor' : 'Sektoren') : (one ? 'sector' : 'sectors');
            if (!m || +m[1] !== want || m[2] !== wantWord) bad.push(`${shape} ${tok} ${mode} ${lang}: "${m && m[0]}" instead of (${want} ${wantWord})`);
        }
    }
    ui.lang = 'de';
    check(`(3) the tooltip (de and en, ${seen} texts): square 52g "3 Sektoren", hexagon 12.6c "2 Sektoren", triangle 15a "1 Sektor", in the full group and in "nur Drehung" (one count, singular/plural right)`, bad.length === 0 && seen === 12, bad.slice(0, 4).join(' | '));
}
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
