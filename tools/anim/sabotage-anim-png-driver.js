// Task 116: the sabotage runs of tools/anim/test-anim-png-driver.js (not a test itself). ONE change in a COPY of sketch.js per run; the test must go red. Exit 0 only if every sabotage was caught.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), src = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8'), TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'anim116sab-'));
const SAB = [
    ['the position is not restored', '        tl.elapsedMs = position; tl.playing = false;', '        tl.playing = false;'],
    ['the status text is not restored', '        env.status.set(saved.status);', ''],
    ['the pixel density is not restored', '        try { env.density.set(saved.density); }', '        try { }'],
    ['cancel is ignored', "if (env.shouldCancel()) { result = { ok: false, code: 'cancelled', done: i }; break; }", ''],
    ['the limit is ignored', "if (!est.withinLimits) return { ok: false, code: 'tooBig'", "if (false) return { ok: false, code: 'tooBig'"],
    ['the last frame is not at t = 1', 'env.setProgress(ft.times[i]);', 'env.setProgress(i / ft.n);'],
    ['a playing timeline is not paused', '    env.pauseTimeline(position);\n', ''],
    ['the frames are not handed to the ZIP as Blobs', 'await zip.add(animFrameName(i + 1, ft.n, \'png\'), bytes, blob);', 'await zip.add(animFrameName(i + 1, ft.n, \'png\'), bytes);'],
    ['bilinear is not refused', "sm.mode === 'bilinear') return 'static'", "sm.mode === 'bilinear') return null"],
    ['no wait for the background check', 'while (!env.idle() && env.now() - t0 < 15000)', 'while (false)'],
    ['the busy background check is not parked', '        if (!env.idle()) env.pauseBackground();', ''],
    ['an error does not restore the state (the restore sits after the try)', '    } finally {\n        try { env.density.set(saved.density)', '    } finally {\n        if (result && result.code === \'error\') return result;\n        try { env.density.set(saved.density)'],
];
let bad = 0;
for (const [name, from, to] of SAB) {
    if (src.split(from).length !== 2) { console.log('ANCHOR MISSING/NOT UNIQUE  ' + name); bad++; continue; }
    const f = path.join(TMP, 'sketch-sab.js'); fs.writeFileSync(f, src.replace(from, to));
    const r = spawnSync('node', [path.join(__dirname, 'test-anim-png-driver.js')], { env: Object.assign({}, process.env, { SKETCH_JS: f }), encoding: 'utf8', timeout: 120000 });
    const fails = (r.stdout.match(/^FAIL/gm) || []).length, red = r.status !== 0;
    console.log(`${red ? 'RED (caught)' : 'GREEN (NOT caught)'}  ${name}  [${fails} failing checks]`);
    if (!red) bad++;
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(bad ? `${bad} sabotage(s) not caught` : `all ${SAB.length} sabotages caught`);
process.exit(bad ? 1 : 0);
