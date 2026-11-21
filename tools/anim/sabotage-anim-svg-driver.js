// Task 117: the sabotage runs of tools/anim/test-anim-svg-driver.js (not a test itself). ONE change in a COPY of sketch.js per run; the test must go red. Exit 0 only if every sabotage was caught.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), src = fs.readFileSync(path.join(ROOT, 'sketch.js'), 'utf8'), TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'anim117sab-'));
const FIN = "    finally { showFaces = base; additionalLayers.forEach((l, k) => { l.showFaces = layers[k]; }); }";
const SAB = [
    ['the flags are not restored at all', FIN, '    finally { }'],
    ['the flags are restored only AFTER the first await (a microtask later), not before it', FIN, "    finally { Promise.resolve().then(() => { showFaces = base; additionalLayers.forEach((l, k) => { l.showFaces = layers[k]; }); }); }"],
    ['noFaces does not switch the base flag off', "    showFaces = false;\n    additionalLayers.forEach((l) => { l.showFaces = false; });\n    try { return generateSVGString(); }", "    additionalLayers.forEach((l) => { l.showFaces = false; });\n    try { return generateSVGString(); }"],
    ['noFaces does not switch the layers off', "    showFaces = false;\n    additionalLayers.forEach((l) => { l.showFaces = false; });\n    try { return generateSVGString(); }", "    showFaces = false;\n    try { return generateSVGString(); }"],
    ['a throw in the frame loses the flags (the restore is not in a finally)', "    try { return generateSVGString(); }\n    finally { showFaces = base; additionalLayers.forEach((l, k) => { l.showFaces = layers[k]; }); }", "    const out = generateSVGString();\n    showFaces = base; additionalLayers.forEach((l, k) => { l.showFaces = layers[k]; });\n    return out;"],
    ['the SVG branch sets the pixel density', '        if (!svg) env.density.set(opts.density);', '        env.density.set(opts.density);'],
    ['the SVG branch redraws every frame', "                const bytes = env.encode(env.svgFrame(opts.noFaces === true));", "                env.redraw();\n                const bytes = env.encode(env.svgFrame(opts.noFaces === true));"],
    ['the entries are stored, not deflated', "animZipWriter(svg ? { method: 'deflate', deflate: () => packedNow } : { method: 'store' })", "animZipWriter({ method: 'store' })"],
    ['the packed Blob is not handed to the ZIP (the bytes stay in the parts)', ", env.makeBlob([packedNow], 'application/octet-stream'));", ");"],
    ['the limit does not apply', "if (!est.withinLimits) return { ok: false, code: 'tooBig'", "if (false) return { ok: false, code: 'tooBig'"],
    ['the probe reports the raw size as the packed size', "packed: packed.length, genMs", "packed: bytes.length, genMs"],
    ['a missing CompressionStream is not refused', "    if (svg && !env.deflate) return { ok: false, code: 'noCompression' };\n", ""],
    ['the SVG zip is named like the PNG zip', "svg ? 'world_of_forms_animation_svg.zip' : 'world_of_forms_animation.zip'", "'world_of_forms_animation.zip'"],
];
let bad = 0;
for (const [name, from, to] of SAB) {
    if (src.split(from).length !== 2) { console.log('ANCHOR MISSING/NOT UNIQUE  ' + name); bad++; continue; }
    const f = path.join(TMP, 'sketch-sab.js'); fs.writeFileSync(f, src.replace(from, to));
    const r = spawnSync('node', [path.join(__dirname, 'test-anim-svg-driver.js')], { env: Object.assign({}, process.env, { SKETCH_JS: f }), encoding: 'utf8', timeout: 120000 });
    const fails = (r.stdout.match(/^FAIL/gm) || []).length, red = r.status !== 0;
    console.log(`${red ? 'RED (caught)' : 'GREEN (NOT caught)'}  ${name}  [${fails} failing checks]`);
    if (!red) bad++;
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(bad ? `${bad} sabotage(s) not caught` : `all ${SAB.length} sabotages caught`);
process.exit(bad ? 1 : 0);
