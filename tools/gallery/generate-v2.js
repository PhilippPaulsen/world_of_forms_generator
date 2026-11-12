/**
 * tools/gallery/generate-v2.js
 * Task 064 (G7a): the catalog v2 generator. Writes gallery/v2/ (the SVGs and gallery/v2/manifest.jsonl); the old catalog under gallery/ is never touched (it goes in G7b).
 * Paths, manifest records and names come from core/catalog.js (the one codec); the combinations are over the SORTED LINE KEYS of the grid (compareLineKeys order of
 * core/orbits.js getLineKeyTable), never over orbit numbers; a grid is checked by validateGridSpec (replaces the old assertNotDegenerateOrder: ordnung 1 of triangle and
 * square is a valid grid of its own now). Deterministic: same tree -> same bytes, the manifest is rewritten whole in a fixed order.
 *
 * THE ACCEPTANCE CATALOG (no mass generation, task 064): every shape x ordnung 1, 2, 3 (lage 1);
 *   k = 1: every line key of the grid (complete);
 *   k = 2: a FIXED rule over the N sorted keys e_0 .. e_(N-1): the neighbour pairs (e_i, e_(i+1)) for i = 0 .. N-2, plus the pair (e_0, e_(N-1)) when N > 2.
 *          That is N pairs per grid (N-1 for N = 2, none for N = 1): linear in N, every key appears in at least one pair, first and last are joined.
 *   node: node tokens only through the tables; nothing is read from the old catalog.
 *   node scripts/CLI:  node tools/gallery/generate-v2.js [outDir]    (default: the repo root, i.e. gallery/v2)
 */
const fs = require('fs');
const path = require('path');
const { createGridRendererV2, RENDERER_VERSION_V2 } = require('./renderSingleCellSVG.js');

const ROOT = path.join(__dirname, '..', '..');
const SHAPES = ['triangle', 'square', 'hex'];
const ORDNUNGEN = [1, 2, 3];

// the k = 2 rule (see the header): index pairs over n sorted keys
function k2Pairs(n) {
    const pairs = [];
    for (let i = 0; i + 1 < n; i++) pairs.push([i, i + 1]);
    if (n > 2) pairs.push([0, n - 1]);
    return pairs;
}

// -> the planned entries of one grid: [{ tokens (sorted), k }], in a fixed order (k = 1 by key, then k = 2 by the rule)
function planGrid(tokens) {
    const plan = tokens.map(t => ({ k: 1, tokens: [t] }));
    k2Pairs(tokens.length).forEach(([i, j]) => plan.push({ k: 2, tokens: [tokens[i], tokens[j]] }));
    return plan;
}

function generateCatalogV2(outRoot) {
    outRoot = outRoot || ROOT;
    const lines = [], stats = { files: 0, bytes: 0, grids: 0 };
    for (const shape of SHAPES) for (const ordnung of ORDNUNGEN) {
        const spec = { shape, ordnung, lage: 1 };
        const r = createGridRendererV2(spec);
        const sb = r.sandbox;
        stats.grids++;
        for (const item of planGrid(r.tokens)) {
            const entry = sb.catalogEntryV2(spec, item.tokens, RENDERER_VERSION_V2);
            const svg = r.renderTokens(entry.lines);
            const abs = path.join(outRoot, entry.path);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, svg);
            stats.files++; stats.bytes += Buffer.byteLength(svg);
            lines.push(JSON.stringify(JSON.parse(JSON.stringify(entry))));
        }
    }
    const manifest = path.join(outRoot, 'gallery', 'v2', 'manifest.jsonl');
    fs.mkdirSync(path.dirname(manifest), { recursive: true });
    fs.writeFileSync(manifest, lines.join('\n') + '\n');
    stats.manifestBytes = Buffer.byteLength(lines.join('\n') + '\n');
    return stats;
}

if (require.main === module) {
    const t0 = Date.now();
    const st = generateCatalogV2(process.argv[2] ? path.resolve(process.argv[2]) : ROOT);
    console.log(`catalog v2: ${st.grids} grids, ${st.files} SVG files (${(st.bytes / 1024).toFixed(1)} KB), manifest ${st.manifestBytes} bytes, ${Date.now() - t0} ms`);
}

module.exports = { generateCatalogV2, planGrid, k2Pairs, SHAPES, ORDNUNGEN };
