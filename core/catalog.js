/**
 * core/catalog.js
 * Task 064 (G7a): the ONE codec of the catalog v2 - the path of a catalog entry, its manifest record and its display name - shared by the generator
 * (tools/gallery/generate-v2.js, a vm that loads this file) and the Formorgel (gallery.html loads it as a plain script): no second copy in gallery.js or a tool.
 *
 * Path:     gallery/v2/{shape}/{ordnung}/lage{lage}/k{count}/{3|4|6}star/{segment}.svg
 * segment:  the line keys in compareLineKeys order, each as its ASCII token with the bar "~" written "-", joined with "_"   (e.g. 65a-_12.11a)
 *           reversible: tokens use only digits, ".", a-n and "~", so "_" and "-" are free; no "+" (a URL path character), no "~" (shell-special)
 * Manifest: { path, grid: {shape, ordnung, lage}, group: "3*"|"4*"|"6*", lines: [tokens], count, rendererVersion }
 * Name:     formatGridName of the source (core/orbits.js): "{ordnung}{d|q|*}{lage}/{group} {tokens joined with +}"
 *
 * The pure string functions need nothing; the ones that sort or name (catalogSortedTokensV2, catalogNameV2) use core/orbits.js globals
 * (parseLineKey, compareLineKeys, formatLineKey, formatGridName, GRID_V2), so load this file after core/orbits.js.
 */
const CATALOG_V2_ROOT = 'gallery/v2';
const CATALOG_V2_STAR = Object.freeze({ triangle: '3', square: '4', hex: '6' });
const CATALOG_V2_GROUP = Object.freeze({ triangle: '3*', square: '4*', hex: '6*' });

function catalogSegmentV2(tokens) {
    return tokens.map(t => t.replace(/~/g, '-')).join('_');
}
function catalogTokensOfSegmentV2(segment) {
    return segment.split('_').map(t => t.replace(/-/g, '~'));
}
// tokens: ascending line-key order already (catalogSortedTokensV2 makes it so)
function catalogPathV2(grid, tokens) {
    return [CATALOG_V2_ROOT, grid.shape, String(grid.ordnung), 'lage' + grid.lage, 'k' + tokens.length, CATALOG_V2_STAR[grid.shape] + 'star', catalogSegmentV2(tokens) + '.svg'].join('/');
}
// the inverse: -> { grid: {shape, ordnung, lage}, tokens } or null for a path that is not a v2 catalog path
function parseCatalogPathV2(path) {
    const m = /^gallery\/v2\/(triangle|square|hex)\/([1-9]\d*)\/lage([12])\/k([1-9]\d*)\/([346])star\/([^/]+)\.svg$/.exec(path);
    if (!m || CATALOG_V2_STAR[m[1]] !== m[5]) return null;
    const tokens = catalogTokensOfSegmentV2(m[6]);
    if (tokens.length !== +m[4]) return null;
    return { grid: { shape: m[1], ordnung: +m[2], lage: +m[3] }, tokens };
}
// tokens (any order, duplicates kept) -> the same tokens sorted NUMERICALLY by compareLineKeys (never by string); null if one is not a line-key token
function catalogSortedTokensV2(tokens) {
    const keys = tokens.map(t => parseLineKey(t));
    if (keys.some(k => !k)) return null;
    return keys.sort(compareLineKeys).map(k => formatLineKey(k));
}
function catalogEntryV2(grid, tokens, rendererVersion) {
    const sorted = catalogSortedTokensV2(tokens);
    return {
        path: catalogPathV2(grid, sorted),
        grid: { shape: grid.shape, ordnung: grid.ordnung, lage: grid.lage },
        group: CATALOG_V2_GROUP[grid.shape],
        lines: sorted,
        count: sorted.length,
        rendererVersion,
    };
}
// the display name of an entry = formatGridName of its source: "{ordnung}{d|q|*}{lage}/{group} {tokens}"
function catalogNameV2(grid, tokens) {
    const keys = tokens.map(t => parseLineKey(t));
    if (keys.some(k => !k)) return null;
    return formatGridName(grid, keys, GRID_V2);
}
// the keys an entry's links carry: the v2 transport (core/orbits.js formatTransportUrlV2 / formatTransportPasteV2) of the entry's own spec and lines
function catalogLinkV2(entry, opts) {
    const keys = entry.lines.map(t => parseLineKey(t));
    return 'index.html' + formatTransportUrlV2(entry.grid, keys, opts);
}
function catalogPasteV2(entry) {
    return formatTransportPasteV2(entry.grid, entry.lines.map(t => parseLineKey(t)));
}

if (typeof module !== 'undefined') module.exports = { CATALOG_V2_ROOT, CATALOG_V2_STAR, CATALOG_V2_GROUP, catalogSegmentV2, catalogTokensOfSegmentV2, catalogPathV2, parseCatalogPathV2 };
