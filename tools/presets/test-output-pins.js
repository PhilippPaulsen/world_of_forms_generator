/**
 * tools/presets/test-output-pins.js - task 183. The OUTPUT fingerprint of the ten presets (plan: _Plaene/Fingerabdruck-presets.md).
 *   node tools/presets/test-output-pins.js            check the pins (and run the four sabotage runs)
 *   node tools/presets/test-output-pins.js --update   re-pin deliberately: prints old -> new per slug, writes nothing when nothing changed
 *   node tools/presets/test-output-pins.js --raw      (internal) prints the computed results as JSON
 *   OUTPUT_PINS_OVERRIDES='{"core/tiling.js":"/path/copy.js"}'   core files replaced by copies (the sabotage runs); the tree is never written
 *
 * What it pins, per preset (presets/manifest.json, all ten): load the session (parseSession, planSessionRestore, applySessionSnapshot, headless hooks), then
 *   svg    = SHA-256 of generateSVGString()   (the whole tiling: face polygons with colours, line paths; toFixed(2) text)
 *   export = SHA-256 of buildExportData(null) without exportedAt, numbers rounded to 1e-6 HERE (never in the core), -0 as 0, NaN/Infinity = an error.
 * Both are needed (task 183 sabotage): the SVG sees drawing and tiling, the export sees face detection, colours and nodes (also for the lines-only presets).
 * The older pins (pixel-pins.json, svg-pixel-pins.json) compare two renderings of the SAME code (round trip); this one pins what the code draws.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const PINS = path.join(__dirname, 'output-pins.json');
const F = require('../session/fixtures.js');
const S = require('../session/scenarios.js');

const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const J = JSON.stringify;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'presets', 'manifest.json'), 'utf8'));

// export data -> plain data with numbers rounded to 1e-6; -0 = 0; NaN / Infinity throw (named by path)
function normalize(v, where) {
    if (typeof v === 'number') {
        if (!Number.isFinite(v)) throw new Error('non-finite number (' + v + ') at ' + where);
        const r = Math.round(v * 1e6) / 1e6;
        return r === 0 ? 0 : r;
    }
    if (Array.isArray(v)) return v.map((x, i) => normalize(x, where + '[' + i + ']'));
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = normalize(v[k], where + '.' + k); return o; }
    return v;
}

// one preset -> { svg, export, polygons, paths } or { error }
function compute(p, overrides) {
    try {
        const ctx = F.makeContext({ state: true, export: true, coreOverrides: overrides });
        const sb = ctx.sb;
        Object.assign(sb, { width: 600, height: 600, document: { body: {} }, getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }), CLOSE: 'close',
            floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max });
        ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'ellipse', 'rect', 'line', 'bezier'].forEach(n => { sb[n] = () => { }; });
        const parsed = sb.parseSession(fs.readFileSync(path.join(ROOT, 'presets', p.file), 'utf8'));
        if (!parsed.ok) return { error: 'parse ' + parsed.code };
        const plan = sb.planSessionRestore(parsed.snapshot, { canvasW: 600, canvasH: 600 });
        if (!plan.ok) return { error: 'plan ' + plan.code };
        const r = sb.applySessionSnapshot(parsed.snapshot, plan.plan, S.fakeHooks(ctx, null, S.uiOf(ctx, null, null), { skipCheck: true }));
        if (!r.ok) return { error: 'apply failed' };
        const svg = ctx.get('generateSVGString()');
        const ex = sb.buildExportData(null); delete ex.exportedAt;
        return { svg: sha(svg), export: sha(J(normalize(JSON.parse(J(ex)), 'export'))), polygons: (svg.match(/<polygon /g) || []).length, paths: (svg.match(/<path /g) || []).length };
    } catch (e) { return { error: String(e && e.message || e).split('\n')[0] }; }
}
function computeAll(overrides) { const o = {}; for (const p of manifest.presets) o[p.slug] = compute(p, overrides); return o; }
const overridesEnv = () => process.env.OUTPUT_PINS_OVERRIDES ? JSON.parse(process.env.OUTPUT_PINS_OVERRIDES) : undefined;
const short = h => (h || '-').slice(0, 10);

const args = process.argv.slice(2);
if (args.includes('--raw')) { process.stdout.write(J(computeAll(overridesEnv()))); process.exit(0); }

if (args.includes('--update')) {
    const now = computeAll(overridesEnv());
    const bad = Object.entries(now).filter(([, v]) => v.error);
    if (bad.length) { bad.forEach(([s, v]) => console.log(`ERROR  ${s}: ${v.error}`)); console.log('not written'); process.exit(1); }
    const old = fs.existsSync(PINS) ? JSON.parse(fs.readFileSync(PINS, 'utf8')).presets || {} : {};
    let changed = 0;
    for (const s of Object.keys(now)) {
        const o = old[s], n = now[s];
        const parts = ['svg', 'export'].filter(k => !o || o[k] !== n[k]).map(k => `${k} ${short(o && o[k])} -> ${short(n[k])}`);
        if (!o || o.polygons !== n.polygons || o.paths !== n.paths) parts.push(`polygons/paths ${o ? o.polygons + '/' + o.paths : '-'} -> ${n.polygons}/${n.paths}`);
        if (parts.length) { changed++; console.log(`CHANGED  ${s}: ${parts.join('; ')}`); }
    }
    for (const s of Object.keys(old)) if (!now[s]) { changed++; console.log(`REMOVED  ${s}`); }
    if (!changed) { console.log('no change, nothing written'); process.exit(0); }
    let commit = 'unknown';
    try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim() + (execSync('git status --short', { cwd: ROOT }).toString().trim() ? ' (+ uncommitted changes)' : ''); } catch (e) { /* no git */ }
    const pins = {
        note: `Output pins (task 183): per preset SHA-256 of generateSVGString() and of buildExportData(null) without exportedAt, numbers rounded to 1e-6 (-0 = 0). Computed headless by tools/presets/test-output-pins.js on Node ${process.version} (${process.platform}), generator ${commit}. Other Node versions / platforms are NOT verified (Math.sin/cos/pow may differ in the last bit; the export is rounded for that, the SVG uses toFixed(2)). Re-pin only on a deliberate change of what is drawn: node tools/presets/test-output-pins.js --update, then check the diff.`,
        measuredOn: commit, node: process.version, presets: now,
    };
    fs.writeFileSync(PINS, J(pins, null, 2) + '\n');
    console.log(`written ${PINS} (${changed} changed)`);
    process.exit(0);
}

// ---- checks
let checks = 0, failures = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const slugs = manifest.presets.map(p => p.slug);
const pinsOk = fs.existsSync(PINS);
check('pin file exists', pinsOk);
if (!pinsOk) { console.log('create it: node tools/presets/test-output-pins.js --update'); process.exit(1); }
const pins = JSON.parse(fs.readFileSync(PINS, 'utf8'));
const pinned = pins.presets || {};
const HEX = /^[0-9a-f]{64}$/;
check('pin file: note names Node version and commit; measuredOn and node set', typeof pins.note === 'string' && /Node v\d/.test(pins.note) && /generator \S+/.test(pins.note) && !!pins.measuredOn && /^v\d/.test(pins.node));
check('pins: the slugs are exactly the slugs of the manifest (no preset without a pin, no pin without a preset)', J(Object.keys(pinned).sort()) === J(slugs.slice().sort()), slugs.length + ' presets');
check('pins: svg and export are SHA-256 hex, polygons and paths are integers', slugs.every(s => pinned[s] && HEX.test(pinned[s].svg) && HEX.test(pinned[s].export) && Number.isInteger(pinned[s].polygons) && Number.isInteger(pinned[s].paths)));
check('coverage: both lines-only presets (showFaces false: 0 polygons) and both net kinds (sine, projective) are pinned',
    ['quadrat-linien', 'quadrat-drehung-linien'].every(s => pinned[s] && pinned[s].polygons === 0) && ['quadrat-spiegelung-sinus', 'quadrat-spiegelung-projektiv'].every(s => pinned[s] && pinned[s].polygons > 0));

const hint = (diffs) => {
    console.log('  Node ' + process.version + ' (' + process.platform + '); pins were made on ' + pins.node + ' (' + pins.measuredOn + ').');
    console.log('  Deliberate change of the drawing? Then: node tools/presets/test-output-pins.js --update, and check the diff of the slugs above.');
    console.log('  Not a change of yours? A different Node version or platform may be the cause (unverified guess): read the pin note: node -e "console.log(require(\'./tools/presets/output-pins.json\').note)"');
};
const first = computeAll(undefined);
const bad = [];
for (const s of slugs) {
    const n = first[s], o = pinned[s];
    if (n.error) { bad.push(`${s}: does not load (${n.error})`); continue; }
    if (!o) continue;
    for (const k of ['svg', 'export']) if (n[k] !== o[k]) bad.push(`${s}: ${k} hash ${short(o[k])} -> ${short(n[k])}, polygons ${o.polygons} -> ${n.polygons}, paths ${o.paths} -> ${n.paths}`);
}
check('output: every preset loads and svg + export hash equal the pins', bad.length === 0, bad.length ? bad.length + ' difference(s)' : slugs.length + ' presets x 2 hashes');
if (bad.length) { bad.forEach(b => console.log('  ' + b)); hint(); }
const second = computeAll(undefined);
check('determinism: a second run in a fresh context gives the same hashes for all ten', J(first) === J(second));
{   // normalize: -0 and non-finite numbers
    let threw = false; try { normalize({ a: [1, NaN] }, 'x'); } catch (e) { threw = /non-finite.*x\.a\[1\]/.test(e.message); }
    let inf = false; try { normalize(Infinity, 'y'); } catch (e) { inf = /non-finite/.test(e.message); }
    check('normalize: -0 is 0, 1e-6 rounding, NaN and Infinity are reported with their path', J(normalize({ a: -0, b: 0.12345649, c: 2 }, 'z')) === '{"a":0,"b":0.123456,"c":2}' && threw && inf);
}

// ---- sabotage runs (copies in a temp dir, the tree is never written): the pins must notice each
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'output-pins-'));
function sabotage(label, rel, from, to) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const n = src.split(from).length - 1;
    if (n !== 1) { check('sabotage ' + label + ': anchor found exactly once in ' + rel, false, n + ' times (the code moved: update the anchor)'); return null; }
    const copy = path.join(tmp, label + '-' + path.basename(rel));
    fs.writeFileSync(copy, src.replace(from, () => to));
    const env = Object.assign({}, process.env, { OUTPUT_PINS_OVERRIDES: J({ [rel]: copy }) });
    const r = spawnSync(process.execPath, [__filename, '--raw'], { env, encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.status !== 0) { check('sabotage ' + label + ': the run itself works', false, (r.stderr || '').split('\n')[0]); return null; }
    return JSON.parse(r.stdout);
}
const differs = (res, k) => slugs.filter(s => res[s] && !res[s].error && res[s][k] !== pinned[s][k]);
const withPoly = slugs.filter(s => pinned[s] && pinned[s].polygons > 0);
const sameSet = (a, b) => J(a.slice().sort()) === J(b.slice().sort());
const ran = [];
try {
    let r = sabotage('a-facecolor', 'core/facecolor.js', 'face.color = a.displayColor ? _srgbBytesToHex(a.displayColor) : resolved.hex;', "face.color = a.displayColor ? _srgbBytesToHex(a.displayColor) : (resolved.hex === '#ffffff' ? '#fefefe' : resolved.hex);");
    if (r) { const sv = differs(r, 'svg'), ex = differs(r, 'export'); ran.push(['a face colour (facecolor.js)', sv, ex]);
        check('sabotage a (one face colour in facecolor.js): svg changes for every preset with faces, export for all ten', sameSet(sv, withPoly) && ex.length === slugs.length, `svg ${sv.length}, export ${ex.length}`); }
    r = sabotage('b-faces', 'core/faces.js', 'compBounded = negative;', 'compBounded = compTraced;');
    if (r) { const sv = differs(r, 'svg'), ex = differs(r, 'export'); ran.push(['outer-face heuristic (faces.js)', sv, ex]);
        check('sabotage b (outer-face heuristic in faces.js): svg changes for every preset with faces, export for all ten', sameSet(sv, withPoly) && ex.length === slugs.length, `svg ${sv.length}, export ${ex.length}`); }
    r = sabotage('c1-tiling', 'core/tiling.js', 'const c0 = oc[0], c1 = oc[1], c3 = oc[3];', 'const c0 = { x: oc[0].x + 0.5, y: oc[0].y }, c1 = oc[1], c3 = oc[3];');
    if (r) { const sv = differs(r, 'svg'), ex = differs(r, 'export'); ran.push(['tile origin (tiling.js)', sv, ex]);
        check('sabotage c1 (tile origin in tiling.js): svg changes for all ten (the export does not see tiling)', sv.length === slugs.length && ex.length === 0, `svg ${sv.length}, export ${ex.length}`); }
    r = sabotage('c2-forms', 'core/forms.js', 'const startX = cx - size / 2; const startY = cy - size / 2;', 'const startX = cx - size / 2 + 0.01; const startY = cy - size / 2;');
    if (r) { const errs = slugs.filter(s => r[s] && r[s].error && /grid-mismatch/.test(r[s].error)); ran.push(['node start (forms.js)', errs, []]);
        check('sabotage c2 (node start in forms.js): every preset fails to load with grid-mismatch', errs.length === slugs.length, errs.length + ' of ' + slugs.length); }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
check('the tree is untouched by the sabotage runs (the pins file is unchanged on disk)', J(JSON.parse(fs.readFileSync(PINS, 'utf8'))) === J(pins));
if (process.env.OUTPUT_PINS_VERBOSE) ran.forEach(([n, sv, ex]) => console.log(`  ${n}: svg [${sv.map(s => s.replace('quadrat-', '')).join(' ')}] export ${ex.length}`));

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
