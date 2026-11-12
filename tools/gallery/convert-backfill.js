/**
 * tools/gallery/convert-backfill.js
 * Task 064 (G7a): the Ostwald backfill (gallery/ostwald-backfill.csv: legacy catalog path -> plate label + url) mapped onto the v2 keys.
 * A legacy path names (shape, legacy order c, group token, orbit ids); the legacy orbit table gives each id's representative pair, the v2 line-key table of the grid
 * fromLegacy(shape, c) gives that pair its key, and the v2 path follows from the codec (core/catalog.js). Only the whole main group (legacy token D3 / D4 / D6 at the
 * default mode rotation_reflection6) has a key: a row of another group (Z2, C3, ...) is NOT mapped and is listed, never dropped silently. A mapped row whose v2 path is not
 * in gallery/v2/manifest.jsonl is listed too (the acceptance catalog is small). Writes gallery/v2/ostwald-backfill.csv (same header: catalogPath,label,url); the old CSV is untouched.
 *   node tools/gallery/convert-backfill.js [outRoot]
 * -> { mapped: [{ from, to, inCatalog }], unmapped: [{ from, reason }] }
 */
const fs = require('fs');
const path = require('path');
const { createShapeOrderRenderer, createGridRendererV2 } = require('./renderSingleCellSVG.js');

const ROOT = path.join(__dirname, '..', '..');
const MAIN_TOKEN = { triangle: 'D3', square: 'D4', hex: 'D6' };

function parseCsvLine(line) {   // the file has no quotes or embedded commas (see its three rows); anything else is refused, not guessed
    if (line.includes('"')) throw new Error('convert-backfill: quoted CSV fields are not supported: ' + line);
    return line.split(',');
}

function convertBackfill(outRoot) {
    outRoot = outRoot || ROOT;
    const rows = fs.readFileSync(path.join(ROOT, 'gallery', 'ostwald-backfill.csv'), 'utf8').split('\n').filter(Boolean).map(parseCsvLine);
    const header = rows[0];
    if (header.join(',') !== 'catalogPath,label,url') throw new Error('convert-backfill: unexpected header ' + header.join(','));
    const inCatalog = new Set(fs.readFileSync(path.join(outRoot, 'gallery', 'v2', 'manifest.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).path));
    const mapped = [], unmapped = [], out = ['catalogPath,label,url'];
    const cache = new Map();
    for (const [legacyPath, label, url] of rows.slice(1)) {
        const m = /^gallery\/(triangle|square|hex)\/(\d+)\/k(\d+)\/([A-Za-z0-9]+)\/(\d+(?:\+\d+)*)\.svg$/.exec(legacyPath);
        if (!m) { unmapped.push({ from: legacyPath, reason: 'not a legacy catalog path' }); continue; }
        const [, shape, c, , token, idsRaw] = m, order = +c, ids = idsRaw.split('+').map(Number);
        if (token !== MAIN_TOKEN[shape]) { unmapped.push({ from: legacyPath, reason: `group ${token} is not the whole main group ${MAIN_TOKEN[shape]}: no line key` }); continue; }
        const ck = shape + order;
        if (!cache.has(ck)) {
            const legacy = createShapeOrderRenderer(shape, order, 'rotation_reflection6');
            const fromLegacyOrdnung = shape === 'hex' ? order : order - 1;   // core/forms.js fromLegacy: hex ordnung = c; triangle/square c >= 2 -> c - 1 (c = 1 is the legacy marker, not in the catalog)
            const gridSpec = { shape, ordnung: fromLegacyOrdnung, lage: 1 };
            cache.set(ck, { legacy, v2: createGridRendererV2(gridSpec), gridSpec });
        }
        const { legacy, v2, gridSpec } = cache.get(ck);
        const sb = v2.sandbox;
        let tokens;
        try {
            tokens = ids.map(id => {
                const orbit = legacy.table.orbits[id];
                if (!orbit) throw new Error(`orbit id ${id} does not exist`);
                const key = sb.lineKeyForPair(v2.table, orbit.pairs[0][0], orbit.pairs[0][1], { gitterV2: true });
                if (!key) throw new Error(`pair ${orbit.pairs[0]} has no key`);
                return sb.formatLineKey(key);
            });
        } catch (e) { unmapped.push({ from: legacyPath, reason: e.message }); continue; }
        const entry = sb.catalogEntryV2(gridSpec, tokens, 'x');
        mapped.push({ from: legacyPath, to: entry.path, inCatalog: inCatalog.has(entry.path) });
        out.push([entry.path, label, url].join(','));
    }
    fs.mkdirSync(path.join(outRoot, 'gallery', 'v2'), { recursive: true });
    fs.writeFileSync(path.join(outRoot, 'gallery', 'v2', 'ostwald-backfill.csv'), out.join('\n') + '\n');
    return { mapped, unmapped };
}

if (require.main === module) {
    const r = convertBackfill(process.argv[2] ? path.resolve(process.argv[2]) : ROOT);
    console.log(`backfill: ${r.mapped.length} mapped (${r.mapped.filter(x => x.inCatalog).length} in the acceptance catalog), ${r.unmapped.length} not mapped`);
    r.mapped.forEach(x => console.log('  ' + x.from + ' -> ' + x.to + (x.inCatalog ? '' : '   (NOT in the v2 manifest)')));
    r.unmapped.forEach(x => console.log('  NOT MAPPED ' + x.from + ': ' + x.reason));
}

module.exports = { convertBackfill };
