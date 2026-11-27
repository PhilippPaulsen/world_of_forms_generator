/**
 * tools/presets/convert.js
 * Task 159 (A2 presets): an EXPORT (formatVersion 2, core/export.js buildExportData) -> a SESSION JSON (core/session.js, schema 2).
 *
 *   node tools/presets/convert.js <export.json> [--grau alt|neu8|abbild] [--faces on|off] [--out <session.json>]
 *
 * Why a tool and not an import in the Studio: the Studio has no import (no new control, no core change). The tool builds the state in a vm
 * with the REAL core (rebuildGrid, setFaceAssignment, buildSessionSnapshot, serializeSession), so the file is written by the core's own writer
 * and the roundtrip (export -> session -> load -> export) is testable (tools/presets/test-convert.js).
 *
 * What the preparation does (here, never in the export code):
 *   - connections: null edges [a,a] and duplicate pairs are removed (the faces do not change; the cause of null edges is reported, not fixed: reports/161.md);
 *   - face colours: only the entries of the CURRENT trails are kept (an export carries orphans of earlier states);
 *   - net: meta.netTransform (derived, export form) -> the session net spec ({x,y,repeat,domain,macro} | {kind:'projective',...});
 *   - showFaces: opts.showFaces (default true; false = a lines-only preset; the export does not say, buildExportData writes faces either way);
 *   - mode: settings.uiMode is always written ('simple'), so the old-session rule (no field = advanced) never applies;
 *   - grays (--grau): alt = unchanged (grayTones 0, no anchor); neu8 = recoloured with the 8-tone ladder, cyclic over the trails (the distribution changes);
 *     abbild = rank-preserving map of the old gray values onto tones of the 8-tone ladder (the distribution stays), anchor neutral: true, grayTones 8.
 * The saved time is a constant (reproducible files). Not part of the app: nothing under core/ or sketch.js is touched, only read.
 */
const fs = require('fs');
const path = require('path');
const F = require('../session/fixtures.js');
const S = require('../session/scenarios.js');

const SAVED_AT = 0;
const GRAU_MODES = ['alt', 'neu8', 'abbild'];
const J = JSON.stringify;

// export netTransform -> session net spec (null when none)
function netSpecOf(nt) {
    if (!nt) return null;
    if (nt.kind === 'projective') {
        const o = { kind: 'projective', family: nt.family, a: nt.a, b: nt.b, format: nt.format };
        if (nt.interp === true) o.interp = true;
        if (nt.cls !== undefined) o.cls = nt.cls;
        return o;
    }
    const axis = a => {
        if (a.kind === 'uniform') return { kind: 'uniform', w: 0 };
        if (a.kind === 'trig') return Object.assign({ kind: 'trig', w: a.w }, a.focus !== undefined ? { focus: a.focus } : {}, a.alternate ? { alternate: true } : {});
        if (a.kind === 'geometric') return Object.assign({ kind: 'geometric', w: a.w }, a.alternate ? { alternate: true } : {});
        throw new Error('unknown net axis kind ' + a.kind);
    };
    const spec = { x: axis(nt.x), y: J(nt.x) === J(nt.y) ? 'same' : axis(nt.y), repeat: !!nt.repeat };
    if (nt.domain !== 'field' && nt.macro && nt.macro > 1) spec.macro = nt.macro;   // in a field the export ignores macro (macroIgnored); carrying it breaks the roundtrip
    if (nt.domain) spec.domain = nt.domain;
    return spec;
}

// edges without null edges and duplicates: -> { edges, nullEdges, duplicates }
function cleanEdges(edges) {
    const out = [], seen = new Set(); let nullEdges = 0, duplicates = 0;
    for (const e of edges) {
        const a = e[0], b = e[1];
        if (a === b) { nullEdges++; continue; }
        const k = Math.min(a, b) + '-' + Math.max(a, b);
        if (seen.has(k)) { duplicates++; continue; }
        seen.add(k); out.push([a, b]);
    }
    return { edges: out, nullEdges, duplicates };
}

function convertExport(exp, opts) {
    opts = opts || {};
    const grau = opts.grau || 'abbild';
    if (GRAU_MODES.indexOf(grau) < 0) throw new Error('--grau must be one of ' + GRAU_MODES.join('|'));
    if (!exp || exp.formatVersion !== 2 || !exp.meta || !exp.geometry) throw new Error('not an export of formatVersion 2');
    const m = exp.meta;
    if (!m.faceColoring || !Array.isArray(m.faceColoring.base)) throw new Error('export has no meta.faceColoring.base');
    if (exp.geometry.layers && exp.geometry.layers.length) throw new Error('exports with layers are not converted (a preset is one sheet)');
    const ctx = F.makeContext({ state: true, export: true });
    ctx.run(`currentShape = ${J(m.shapeType)}; projectGridSpec(${J(m.grid)}); shapeSizeFactor = ${m.shapeSizeFactor}; canvasW = 600; canvasH = 600; symmetryMode = ${J(m.symmetryMode)};
        curveType = ${J(m.curveType)}; showNodes = false; showFaces = ${opts.showFaces === false ? 'false' : 'true'}; freeEndpointsEnabled = false; lineColor = ${J(m.lineColor)}; rebuildGrid(currentShape);`);
    const ce = cleanEdges(exp.geometry.edges);
    ctx.run(`connections = ${J(ce.edges)}; redoStack = []; baseNetTransform = ${J(netSpecOf(m.netTransform))}; uiMode = 'simple'; grayTones = ${grau === 'alt' ? 0 : 8};`);
    // the current trails (the symmetry classes of the faces), and the entries of the export that belong to them
    const trails = JSON.parse(ctx.run(`(function () { const g = sheetGroupElements(nodes, null); const fr = computeCellFaces(connections, nodes, null, null, null); return JSON.stringify(computeFaceTrails(fr, g).map(t => t.key)); })()`));
    const byKey = new Map(m.faceColoring.base.map(e => [e.trail, e]));
    const missing = trails.filter(k => !byKey.has(k));
    if (missing.length) throw new Error(`${missing.length} current trail(s) without a colour entry in the export (the file would render differently): ${missing[0]}`);
    let entries = trails.map(k => byKey.get(k));
    const orphans = m.faceColoring.base.length - entries.length;
    let grayInfo = null;
    if (grau !== 'alt') {
        if (entries.some(e => e.rule !== 'max-contrast-gray')) throw new Error('--grau ' + grau + ' needs gray entries only (rule max-contrast-gray)');
        if (grau === 'neu8') {
            ctx.run(`(function () { const g = sheetGroupElements(nodes, null); const fr = computeCellFaces(connections, nodes, null, null, null); const tr = computeFaceTrails(fr, g);
                const st = new Map(); applyHarmonyToPattern(buildMaxContrastGraySelection(tr.length), st, tr, 'cyclic', { groupOpsCount: g.ops.length }, { ruleId: 'max-contrast-gray', source: 'maxContrastGray' }); baseFaceAssignments = st; })();`);
            entries = null;
        } else {
            // abbild: the distinct old w, light to dark, onto the k tones the 8-tone rule gives for k trails (light to dark): the same trails share a tone, the order stays
            const olds = Array.from(new Set(entries.map(e => e.w))).sort((a, b) => b - a);
            const k = olds.length;
            const tones = JSON.parse(ctx.run(`JSON.stringify(generateHarmonyPalette('max-contrast-gray', [0, 8], ${k}).map(c => ({ hue: c.hue, w: c.w, s: c.s })))`)).sort((a, b) => b.w - a.w);
            const map = new Map(olds.map((w, i) => [w, { rank: i, tone: tones[i] }]));
            grayInfo = olds.map(w => ({ from: w, to: map.get(w).tone.w }));
            entries = entries.map(e => { const t = map.get(e.w); return Object.assign({}, e, { hue: t.tone.hue, w: t.tone.w, s: t.tone.s, params: { source: 'maxContrastGray', memberIndex: t.rank, cardinality: k, strategy: 'cyclic' } }); });
        }
        ctx.run('baseFaceAnchor = newFaceAnchor();');   // neutral: true (task 153)
    }
    if (entries) ctx.run(`(function () { const st = new Map(); ${J(entries)}.forEach(e => setFaceAssignment(st, e.trail, { hue: e.hue, w: e.w, s: e.s, rule: e.rule, params: e.params, displayColor: e.displayColor })); baseFaceAssignments = st; })();`);
    const text = ctx.run(`(function () { const r = serializeSession(buildSessionSnapshot(collectSessionState(undefined), ${SAVED_AT})); if (!r.ok) throw new Error('serialize: ' + r.code); return r.text; })()`);
    const parsed = ctx.sb.parseSession(text);
    if (!parsed.ok) throw new Error('the written session does not parse: ' + parsed.code + ' ' + parsed.detail);
    const planned = ctx.sb.planSessionRestore(parsed.snapshot, { canvasW: 600, canvasH: 600 });
    if (!planned.ok) throw new Error('the written session has no restore plan: ' + planned.code + ' ' + planned.detail);
    return { text, report: { nullEdges: ce.nullEdges, duplicateEdges: ce.duplicates, orphanColors: orphans, trails: trails.length, grau, grayMap: grayInfo, bytes: text.length } };
}

// session text -> the export a Studio would write after loading it (parse, plan, apply with headless hooks, buildExportData). exportedAt removed.
function exportAfterLoad(text) {
    const ctx = S.newCtx();
    const ui = S.uiOf(ctx, null, null);
    const parsed = ctx.sb.parseSession(text);
    if (!parsed.ok) throw new Error('parse: ' + parsed.code + ' ' + parsed.detail);
    const plan = ctx.sb.planSessionRestore(parsed.snapshot, { canvasW: 600, canvasH: 600 });
    if (!plan.ok) throw new Error('plan: ' + plan.code + ' ' + plan.detail);
    const r = ctx.sb.applySessionSnapshot(parsed.snapshot, plan.plan, S.fakeHooks(ctx, null, ui, { skipCheck: true }));
    if (!r.ok) throw new Error('apply failed');
    const d = ctx.sb.buildExportData(null); delete d.exportedAt;
    return d;
}

module.exports = { convertExport, exportAfterLoad, netSpecOf, cleanEdges, GRAU_MODES, SAVED_AT };

if (require.main === module) {
    const args = process.argv.slice(2);
    const take = f => { const i = args.indexOf(f); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
    const grau = take('--grau') || 'abbild', out = take('--out'), faces = take('--faces') !== 'off';
    const file = args[0];
    if (!file) { console.error('usage: node tools/presets/convert.js <export.json> [--grau alt|neu8|abbild] [--faces on|off] [--out <session.json>]'); process.exit(2); }
    const r = convertExport(JSON.parse(fs.readFileSync(file, 'utf8')), { grau, showFaces: faces });
    if (out) fs.writeFileSync(out, r.text);
    console.error(J(r.report));
    if (!out) process.stdout.write(r.text);
}
