/**
 * tools/presets/build-presets.js
 * Task 160: presets/quellen/<slug>.export.json (the source of truth: an export of the Studio) + tools/presets/presets-table.json (slug, source name,
 * category, listed, showFaces, titles and descriptions DE/EN) -> presets/<slug>.session.json and presets/manifest.json.
 *   node tools/presets/build-presets.js [--import <dir-with-the-original-exports>]   (--import copies the exports named in the table into presets/quellen/ first)
 * Reproducible: the same inputs give the same bytes (test-presets.js rebuilds in memory and compares). Texts are edited in the table, then rebuilt.
 */
const fs = require('fs');
const path = require('path');
const { convertExport } = require('./convert.js');
const ROOT = path.join(__dirname, '..', '..');
const TABLE = path.join(__dirname, 'presets-table.json');
const OUT = path.join(ROOT, 'presets');

// -> { files: { 'presets/x': text }, manifest, reports }  (nothing written)
function buildAll(table, readSource) {
    const files = {}, entries = [], reports = {};
    for (const p of table.presets) {
        const r = convertExport(JSON.parse(readSource(p.slug)), { grau: table.grau, showFaces: p.showFaces });
        const file = p.slug + '.session.json';
        files[file] = r.text;
        reports[p.slug] = r.report;
        entries.push(Object.assign({ slug: p.slug, title: p.title, description: p.description, category: p.category, listed: p.listed, file, mode: 'simple', bytes: Buffer.byteLength(r.text, 'utf8') }, p.gallery ? { gallery: p.gallery } : {}));   // task 169: the optional gallery block (start page), additive: no schema bump
    }
    const manifest = { presetManifest: table.presetManifest, sessionSchema: 2, presets: entries, redirects: {} };
    files['manifest.json'] = JSON.stringify(manifest, null, 2) + '\n';
    return { files, manifest, reports };
}
const readQuelle = slug => fs.readFileSync(path.join(OUT, 'quellen', slug + '.export.json'), 'utf8');
module.exports = { buildAll, readQuelle, TABLE, OUT };

if (require.main === module) {
    const table = JSON.parse(fs.readFileSync(TABLE, 'utf8'));
    const i = process.argv.indexOf('--import');
    if (i > 0) {
        const dir = process.argv[i + 1];
        fs.mkdirSync(path.join(OUT, 'quellen'), { recursive: true });
        for (const p of table.presets) fs.writeFileSync(path.join(OUT, 'quellen', p.slug + '.export.json'), JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, p.source), 'utf8'))) + '\n');
    }
    const b = buildAll(table, readQuelle);
    for (const [f, t] of Object.entries(b.files)) fs.writeFileSync(path.join(OUT, f), t);
    for (const [s, r] of Object.entries(b.reports)) console.log(s, JSON.stringify(r));
}
