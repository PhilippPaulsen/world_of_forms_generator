// Task 072c: the name in the mode "nur Drehung" (C3 triangle, C4 square, C6 hexagon): core/orbits.js gridRotationNameFor + core/symmetry.js isRotationMode / rotationHandedness, shown by sketch.js.
//   node tools/grid/test-rotation-display.js      FORMS_JS / SYMMETRY_JS / ORBITS_JS / SKETCH_JS replace one file by a (sabotaged) copy
//   A. the 40 grids of the oracle tools/gitter/measure-rotation-names.js (task 072a): the number of pure-rotation orbits and of names equal the oracle's table; 0 collisions except the law 1c (201, wanted)
//   B. the handedness against a brute force (rotations of the main group applied to the node points): constant on a rotation orbit, opposite on the two orbits of one full orbit, 0 exactly when the orbit is its own mirror image
//   C. the sign convention pinned by explicit coordinates (the sector of the z1 end, computed here from atan2, not by the core): z1 z2 / z2 z1 / underscore
//   D. law 1c: the lines in a side of the net show aA; E. the merge to 52A only where BOTH mirror-equal orbits are in the pattern; F. the source form (shape sign, index); G. the other modes and the full group
//   H. the real updatePatternNameStatus on a DOM stub: two lines, tooltip, written only on change
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const J = JSON.stringify;
const B = require(path.join(ROOT, 'tools', 'gitter', 'oracle-bridge.js'));
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const core = B.loadCore();
const MODE = { triangle: 'rotation3', square: 'rotation3', hex: 'rotation6' };
const NET = [];
for (const shape of ['triangle', 'square', 'hex']) for (let lage = 1; lage <= 2; lage++) { const maxN = lage === 1 ? 8 : (shape === 'hex' ? 4 : 6); for (let n = 1; n <= maxN; n++) NET.push({ shape, ordnung: n, lage }); }
const FORM_NAME = { triangle: 'Dreieck', square: 'Quadrat', hex: 'Sechseck' };

// ---- the oracle table of task 072a (its own output, parsed) -----------------------------------------------------------------------------------------
const oracleRows = new Map();
cp.execFileSync('node', [path.join(ROOT, 'tools', 'gitter', 'measure-rotation-names.js')], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').forEach(l => {
    const m = /^(Dreieck|Quadrat|Sechseck)\s+(\d+) (\d)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/.exec(l);
    if (m) oracleRows.set(m[1] + m[2] + '/' + m[3], { nodes: +m[4], full: +m[5], rot: +m[6], geoAch: +m[8], srcAch: +m[9], only1c: +m[10] });
});
check('(A) the oracle table of 072a was read: 40 grids', oracleRows.size === 40, String(oracleRows.size));

// brute force on the core's own lattice table: rotation orbits of the pairs, handedness, names
const g = n => core.get(n);
function analyse(spec) {
    const table = g('getLineKeyTable')(spec), K = g('mainGroupSpec')(spec.shape).K, rots = g('mainGroupElements')(spec.shape).slice(0, K), pts = table._pts;
    const ids = [...pts.keys()], at = new Map(ids.map(id => [B.ptKey(pts.get(id).x, pts.get(id).y), id]));
    const rotId = (el, id) => { const [x, y] = el.f(pts.get(id).x, pts.get(id).y), r = at.get(B.ptKey(x, y)); if (r === undefined) throw new Error('not closed'); return r; };
    const canon = (a, b) => { let best = null; for (const el of rots) { const x = rotId(el, a), y = rotId(el, b), k = x < y ? x + ',' + y : y + ',' + x; if (best === null || k < best) best = k; } return best; };
    const orbits = [];   // { entry, key, pairs, h:Set }
    for (const e of table.entries) {
        const by = new Map();
        for (const [a, b] of e.pairs) { const c = canon(a, b); if (!by.has(c)) by.set(c, []); by.get(c).push([a, b]); }
        const list = [...by.values()].map(pairs => ({ entry: e, pairs, h: new Set(pairs.map(([a, b]) => g('rotationHandedness')(spec.shape, pts.get(a), pts.get(b), table._zahl.get(a), table._zahl.get(b)))) }));
        orbits.push({ entry: e, rot: list });
    }
    return { table, orbits };
}
const totals = { only1c: 0, collisions: 0, grids: 0 };
const rotNames = new Map();   // key "shape n/l" -> { name -> count }
let badCount = [], badH = [], badColl = [], badSet = [];
const SAMPLE = {};
for (const spec of NET) {
    const key = FORM_NAME[spec.shape] + spec.ordnung + '/' + spec.lage, row = oracleRows.get(key), A = analyse(spec), names = new Map(), mode = MODE[spec.shape];
    let rotCount = 0, only1c = 0;
    for (const o of A.orbits) {
        rotCount += o.rot.length;
        const geoAchiral = o.rot.length === 1;
        // B: h constant per orbit; two orbits: opposite non-zero; one orbit: 0
        if (o.rot.some(r => r.h.size !== 1)) badH.push(key + ' ' + o.entry.token + ' h not constant');
        else if (geoAchiral ? [...o.rot[0].h][0] !== 0 : (o.rot.length !== 2 || [...o.rot[0].h][0] === 0 || [...o.rot[0].h][0] + [...o.rot[1].h][0] !== 0)) badH.push(key + ' ' + o.entry.token + ' h ' + o.rot.map(r => [...r.h][0]).join('/'));
        if (o.entry.spiegelgleich && !geoAchiral) only1c++;
        for (const r of o.rot) {
            const res = g('gridRotationNameFor')(spec, [r.pairs[0]], mode);
            if (!res) { badSet.push(key + ' ' + o.entry.token + ' null'); continue; }
            const tk = res.tokens[0].token; names.set(tk, (names.get(tk) || 0) + 1);
            if (spec.shape === 'triangle' && spec.ordnung === 3 && spec.lage === 2) (SAMPLE[o.entry.token] = SAMPLE[o.entry.token] || []).push(tk);
        }
    }
    const coll = [...names].filter(([, c]) => c > 1);
    totals.only1c += only1c; totals.collisions += coll.length; totals.grids++;
    if (!row || row.rot !== rotCount || row.only1c !== only1c || row.full !== A.orbits.length) badCount.push(`${key}: oracle ${row && row.rot}/${row && row.only1c}/${row && row.full}, core ${rotCount}/${only1c}/${A.orbits.length}`);
    if (names.size !== rotCount - only1c || coll.length !== only1c || coll.some(([, c]) => c !== 2)) badColl.push(`${key}: ${names.size} names, ${coll.length} collisions, ${only1c} law-1c`);
    rotNames.set(key, names);
}
check('(A) 40 grids: full orbits, pure-rotation orbits and the law-1c orbits equal the oracle table of 072a', badCount.length === 0, badCount.slice(0, 3).join(' | '));
check(`(A) 40 grids: the names are unique except the law 1c: names = orbits - law-1c orbits, every collision is exactly a law-1c pair (${totals.collisions} = ${totals.only1c})`, badColl.length === 0 && totals.only1c === 201 && totals.collisions === 201, badColl.slice(0, 3).join(' | '));
check('(A) every rotation orbit of every grid gets a name (no null)', badSet.length === 0, badSet.slice(0, 3).join(' | '));
check('(B) the handedness: constant on a rotation orbit, opposite on the two orbits of a full orbit, 0 exactly when the orbit is its own mirror image (brute force over the main-group rotations, 40 grids)', badH.length === 0, badH.slice(0, 3).join(' | '));
{
    const s = SAMPLE;
    const has = (k, ...n) => s[k] && n.every(x => s[k].includes(x)) && s[k].length === n.length;
    check('(A) 3rd triangle, 2nd position (Tabelle 1, S. 7): 51a -> 15a + 51a, 32a -> 32a + 23a, 52e -> 25e + 52e, 55i -> 5_5i + 55i, 54i -> 45i + 54i; the aA rows stay one orbit', has('51a', '15a', '51a') && has('32a', '23a', '32a') && has('52e', '25e', '52e') && has('55i', '5_5i', '55i') && has('54i', '45i', '54i') && has('21a', '21aA') && has('33e', '33eE') && has('55n', '55nN'), J(s));
}

// ---- C. the sign convention, pinned by explicit coordinates --------------------------------------------------------------------------------------
{
    const sectorOf = (shape, p) => { const sp = g('mainGroupSpec')(shape), w = sp.w, u = (((Math.atan2(p.y, p.x) - sp.alpha0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) % (2 * w); if (Math.hypot(p.x, p.y) < 1e-9 || u < 1e-9 || Math.abs(u - w) < 1e-9 || Math.abs(u - 2 * w) < 1e-9) return 0; return u < w ? 1 : -1; };
    let found = { pos: 0, neg: 0, eqPos: 0, eqNeg: 0 }, wrong = [];
    for (const spec of [{ shape: 'square', ordnung: 4, lage: 2 }, { shape: 'hex', ordnung: 3, lage: 1 }, { shape: 'triangle', ordnung: 4, lage: 2 }]) {
        const t = g('getLineKeyTable')(spec), mode = MODE[spec.shape];
        for (const e of t.entries) {
            if (e.spiegelgleich) continue;
            for (const [a, b] of e.pairs) {
                const za = t._zahl.get(a), zb = t._zahl.get(b), pa = t._pts.get(a), pb = t._pts.get(b), sa = sectorOf(spec.shape, pa), sb = sectorOf(spec.shape, pb);
                const res = g('gridRotationNameFor')(spec, [[a, b]], mode), tk = res.tokens[0].token, z1 = Math.max(za, zb), z2 = Math.min(za, zb);
                const fam = (x, y) => (x >= 10 || y >= 10) ? x + '.' + y : '' + x + y;
                let exp;
                if (za !== zb) { const s1 = za > zb ? sa : sb; if (s1 === 0) continue; exp = (s1 > 0 ? fam(z1, z2) : fam(z2, z1)) + e.key.buchstabe + (e.key.gegen ? '~' : ''); found[s1 > 0 ? 'pos' : 'neg']++; }
                else { if (sa === 0 || sa !== sb) continue; exp = (sa > 0 ? fam(z1, z2) : (z1 >= 10 ? z1 + '._' + z2 : z1 + '_' + z2)) + e.key.buchstabe + (e.key.gegen ? '~' : ''); found[sa > 0 ? 'eqPos' : 'eqNeg']++; }
                if (tk !== exp) wrong.push(`${spec.shape}${spec.ordnung} ${e.token}: ${tk} instead of ${exp}`);
            }
        }
    }
    check(`(C) the convention by explicit coordinates: the z1 end in a sector of the shaded type (S0 rotated) -> "z1 z2", in the mirror type -> "z2 z1"; z1 = z2: both ends in the shaded type plain, in the other type the underscore before the second number (${found.pos} / ${found.neg} / ${found.eqPos} / ${found.eqNeg} pairs)`, wrong.length === 0 && found.pos > 50 && found.neg > 50 && found.eqPos > 5 && found.eqNeg > 5, wrong.slice(0, 3).join(' | ') + J(found));
}

// ---- D / E / F. law 1c, the merge to 52A, the source form ------------------------------------------------------------------------------------------
{
    const spec = { shape: 'triangle', ordnung: 3, lage: 2 }, t = g('getLineKeyTable')(spec), f = tok => t.byToken.get(tok);
    const e65a = f('65a'), e65e = f('65e');
    const rn = (pairs) => g('gridRotationNameFor')(spec, pairs, 'rotation3');
    // D. 65a and 65e lie in a side of the net: aA for BOTH geometric orbits, law1c true (the source's law 1c); the geometry says two orbits
    const orbitsOf = e => { const A = analyse(spec).orbits.find(o => o.entry.token === e.token); return A.rot; };
    const r65 = orbitsOf(e65a), res1 = rn([r65[0].pairs[0]]), res2 = rn([r65[1].pairs[0]]);
    check('(D) law 1c: 65a (a line in a side of the net) has two geometric rotation orbits and both are shown as aA: one name for two figures (wanted), law1c flagged', r65.length === 2 && res1.tokens[0].token === '65aA' && res2.tokens[0].token === '65aA' && res1.tokens[0].law1c && res2.tokens[0].law1c && !res1.tokens[0].swapped, J([r65.length, res1 && res1.tokens, res2 && res2.tokens]));
    const e51 = f('51a'), o51 = orbitsOf(e51), pR = o51.find(r => [...r.h][0] > 0).pairs[0], pM = o51.find(r => [...r.h][0] < 0).pairs[0];
    const single = rn([pR]), singleM = rn([pM]), both = rn([pR, pM]), twice = rn([pR, pR, pM]);
    check('(E) a single orbit stays 51a (R) or 15a (its mirror image) in the key AND in the source form', single.ascii === '3d2/3* 51a' && single.source === '3△/ 51a' && singleM.ascii === '3d2/3* 15a' && singleM.source === '3△/ 15a', J([single.ascii, single.source, singleM.ascii, singleM.source]));
    check('(E) both mirror-equal orbits in the pattern: the source form writes the capital 51A once, the key keeps both tokens (51a, 15a: no information lost; display only)', both.source === '3△/ 51A' && both.ascii === '3d2/3* 51a+15a' && both.merged === 1, J([both.source, both.ascii, both.merged]));
    check('(E) R, R and the mirror image: one pair merges, the second R stays: "51A + 51a"; the key lists all three', twice.source === '3△/ 51A + 51a' && twice.ascii === '3d2/3* 51a+51a+15a', J([twice.source, twice.ascii]));
    // equal numbers: 55i and 5_5i
    const o55 = orbitsOf(f('55i')), p1 = o55.find(r => [...r.h][0] > 0).pairs[0], p2 = o55.find(r => [...r.h][0] < 0).pairs[0], eq = rn([p1, p2]);
    check('(E) equal numbers: the pair 55i + 5_5i is written 55I (capital, source S. 6/7 "55 ī + 55 ī = 55 Ī"); alone: 5_5i, in the source form with the underline under the second 5', eq.source === '3△/ 55I' && eq.ascii === '3d2/3* 55i+5_5i' && rn([p2]).source === '3△/ 55\u0332i' && rn([p1]).source === '3△/ 55i', J([eq.source, eq.ascii, rn([p2]).source]));
    // F. shape sign and index
    const sq = g('getLineKeyTable')({ shape: 'square', ordnung: 4, lage: 1 }), hx = g('getLineKeyTable')({ shape: 'hex', ordnung: 4, lage: 1 });
    const ps = (tb, tok) => tb.byToken.get(tok).pairs[0];
    const rs = g('gridRotationNameFor')({ shape: 'square', ordnung: 4, lage: 1 }, [ps(sq, '52a')], 'rotation6'), rh = g('gridRotationNameFor')({ shape: 'hex', ordnung: 4, lage: 1 }, [ps(hx, '54g')], 'rotation6');
    check('(F) source form: square "4□/ " + index ₄, hexagon "4*/ " + index ₆, triangle without index (S. 40, 52, 7)', /^4□\/ (52|25)a₄$/.test(rs.source) && /^4\*\/ (54|45)g₆$/.test(rh.source) && single.source === '3△/ 51a' && rs.grid === '4q1' && rh.grid === '4*1', J([rs.source, rh.source, single.source]));
    const bar = g('gridRotationNameFor')({ shape: 'hex', ordnung: 4, lage: 1 }, [ps(hx, '85e~')], 'rotation6');
    check('(F) the overline stays: 85e~ is "85e" + combining overline in the source form, "~" in the key', bar && /ē₆$/.test(bar.source) && /~$/.test(bar.ascii), J(bar && [bar.source, bar.ascii]));
}

// ---- G. the other modes and the full group --------------------------------------------------------------------------------------------------------
{
    const spec = { shape: 'square', ordnung: 4, lage: 1 }, t = g('getLineKeyTable')(spec), p = [t.byToken.get('52a').pairs[0]];
    const modes = ['none', 'reflection_only', 'rotation_reflection3', 'rotation_reflection6'], hexSpec = { shape: 'hex', ordnung: 3, lage: 1 }, ht = g('getLineKeyTable')(hexSpec), hp = [ht.byToken.get('52a').pairs[0]];
    check('(G) isRotationMode: triangle/square rotation3 and rotation6, hexagon rotation6 only; no other mode, no unknown shape', g('isRotationMode')('triangle', 'rotation3') && g('isRotationMode')('triangle', 'rotation6') && g('isRotationMode')('square', 'rotation3') && g('isRotationMode')('square', 'rotation6') && g('isRotationMode')('hex', 'rotation6') && !g('isRotationMode')('hex', 'rotation3') && modes.concat(['rotation3', 'rotation6']).every(m => !g('isRotationMode')('hex', m) || m === 'rotation6') && !g('isRotationMode')('circle', 'rotation6') && !g('isRotationMode')('square', 'reflection_only'));
    check('(G) no rotation name (null, the old name stays) for: no symmetry, one mirror, the full group, hexagon 3-fold, a free end, no line', modes.every(m => g('gridRotationNameFor')(spec, p, m) === null) && g('gridRotationNameFor')(hexSpec, hp, 'rotation3') === null && g('gridRotationNameFor')(hexSpec, hp, 'rotation_reflection3') === null && g('gridRotationNameFor')(spec, [[0, null]], 'rotation3') === null && g('gridRotationNameFor')(spec, [], 'rotation3') === null);
    check('(G) the full group is untouched: gridDisplayNameFor is null in the rotation modes (the export keeps its null), and the same as before in the full-group modes', g('gridDisplayNameFor')(spec, p, 'rotation3') === null && g('gridDisplayNameFor')(spec, p, 'rotation_reflection6').ascii === '4q1/4* 52a' && g('gridDisplayNameFor')(spec, p, 'rotation_reflection6').rotation === undefined && g('gridDisplayNameFor')(spec, p, 'rotation_reflection6').source === undefined && !g('gridDisplayNameFor')(spec, p, 'rotation_reflection6').tokens.some(tk => tk.swapped || tk.law1c) && g('gridLineKeysFor')(spec, p, 'rotation3').name === null && g('gridLineKeysFor')(spec, p, 'rotation_reflection6').name === '4q1/4* 52a');
}

// ---- H. the real updatePatternNameStatus -----------------------------------------------------------------------------------------------------------
{
    const SK = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
    const grab = (name) => { const m = SK.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n\\}\\n')); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
    const dict = (() => { const src = fs.readFileSync(path.join(ROOT, 'ui-i18n.js'), 'utf8'); const m = {}; const rx = /'([\w.]+)': \{ de: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g; let k; while ((k = rx.exec(src))) m[k[1]] = { de: k[2].replace(/\\'/g, "'"), en: k[3].replace(/\\'/g, "'") }; return m; })();
    const ui = { lang: 'de' }; ui.t = (key, vars) => { const e = dict[key]; if (!e) return key; return e[ui.lang].replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] !== undefined ? vars[k] : '{' + k + '}'); };
    const writes = {}, bump = (id, kind) => { writes[id + '.' + kind] = (writes[id + '.' + kind] || 0) + 1; }, els = {};
    const mkEl = id => { const e = { id, attrs: {}, getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }, setAttribute(k, v) { bump(id, k === 'title' ? 'title' : 'other'); this.attrs[k] = v; }, removeAttribute(k) { if (k === 'title') bump(id, 'title'); delete this.attrs[k]; }, hasAttribute(k) { return this.attrs[k] !== undefined; }, closest() { return els.stepper; } };
        Object.defineProperty(e, 'textContent', { get() { return this._t || ''; }, set(v) { bump(id, 'text'); this._t = v; } });
        e.html = function (t) { bump(id, 'text'); this._t = t; return this; };
        e.elt = e; els[id] = e; return e; };
    ['pattern-name-status', 'grid-info-status', 'nav-node-stepper', 'stepper', 'layer-node-count-input'].forEach(mkEl);
    const w = H.makeRenderWorld('square', 3, 3, 'rotation_reflection6'), sb = w.sb;
    sb.document = { body: {}, getElementById: id => els[id] || null }; sb.window = { UI: ui }; sb.UI = ui; sb.select = id => els[id.replace('#', '')] || null;
    w.set("currentShape = 'square'; setGrid({ shape: 'square', ordnung: 4, lage: 1 });");
    sb.glossaryEntry = require(path.join(ROOT, 'core', 'glossary.js')).glossaryEntry;
    w.set('let patternNameCacheSignature = null; let patternNameCacheValue = null; let patternNameCacheTip = null;');
    ['activeConnections', 'activeGridOverride', 'patternNameSignature', 'patternNameTooltip', 'updateGridInfoLine', 'updatePatternNameStatus'].forEach(nm => w.set(grab(nm)));
    const tb = g('getLineKeyTable')({ shape: 'square', ordnung: 4, lage: 1 }), pr = tok => tb.byToken.get(tok).pairs[0];
    const call = () => { Object.keys(writes).forEach(k => delete writes[k]); w.set('updatePatternNameStatus();'); const o = Object.assign({}, writes); o.total = Object.values(o).reduce((a, b) => a + b, 0); return o; };
    w.set("symmetryMode = 'rotation6';"); w.set(`connections = ${J([pr('52a')])};`);
    const c1 = call(), txt = els['pattern-name-status'].textContent, tip = els['pattern-name-status'].attrs.title || '';
    check('(H) mode "nur Drehung": two lines, the key and the source form; the tooltip is there and names the rotation, the source form, no law 1c', /^4q1\/4\* (52|25)a\n4□\/ (52|25)a₄$/.test(txt) && tip.startsWith('4q1: Ordnung 4, Quadrat, Lage 1, Drehung, 25 Knoten') && /Quellform/.test(tip) && /Zugrichtung/.test(tip) && !/Gesetz 1c/.test(tip), J([txt, tip.slice(0, 120)]));
    const c2 = call(), c3 = call();
    check('(H) written only on change: the second and third call write nothing (the 071c counter test for the new name)', c1['pattern-name-status.text'] === 1 && c1['pattern-name-status.title'] === 1 && c2.total === 0 && c3.total === 0, J([c1, c2, c3]));
    ui.lang = 'en'; const l1 = call(), l2 = call(); ui.lang = 'de';
    check('(H) a language change rewrites the tooltip once (English), the name text not; then nothing', l1['pattern-name-status.title'] === 1 && !l1['pattern-name-status.text'] && l2.total === 0 && /source form/i.test(els['pattern-name-status'].attrs.title === undefined ? '' : (ui.lang = 'en', call(), els['pattern-name-status'].attrs.title)), J([l1, l2]));
    ui.lang = 'de'; call();
    w.set("symmetryMode = 'rotation_reflection6';"); const m1 = call(), m2 = call();
    check('(H) back to the full group: the old display name, no second line, the tooltip of the main group; once, then nothing', els['pattern-name-status'].textContent === '4q1/4* 52a' && /Hauptgruppe 4\*/.test(els['pattern-name-status'].attrs.title) && m1['pattern-name-status.text'] === 1 && m2.total === 0, J([els['pattern-name-status'].textContent, m1, m2]));
    w.set("symmetryMode = 'reflection_only';"); call();
    check('(H) one mirror only: the old name (no source form), no tooltip', !/\n/.test(els['pattern-name-status'].textContent) && !/^4q1\//.test(els['pattern-name-status'].textContent) && els['pattern-name-status'].attrs.title === undefined, els['pattern-name-status'].textContent);
}
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
