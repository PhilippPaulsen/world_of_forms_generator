/**
 * tools/gallery/catalogPath.js
 * Roadmap 1.11 pattern catalog, phase (a): the addressing/manifest
 * scheme - deliberately the SAME information as 1.11-B's own naming
 * grammar (docs/terminology.md, Part B - count, GroupToken, sorted
 * orbitIds), not a second scheme kept in sync by hand. A catalog
 * entry's file path and its systematic pattern name are both derived
 * from the exact same (shape, order, count, groupToken, sortedOrbitIds)
 * tuple.
 *
 * Path scheme: gallery/{shape}/{order}/k{count}/{groupToken}/{sortedOrbitIds}.svg
 * e.g. gallery/triangle/4/k2/D3/1+7.svg for the pattern named count=2,
 * groupToken=D3, ids=1+7 (formatThemeLineName()'s own string form:
 * "2" + star + "/D3 1+7").
 *
 * Pure functions only - no fs access here (that's the batch driver's
 * job), matching this project's own established pure/glue split.
 */
const path = require('path');

// Roadmap 1.11 pattern catalog: sorts ascending - the SAME invariant
// core/orbits.js's formatThemeLineName() already enforces for the
// displayed name ("orbit ids are sorted ascending... so the name is an
// invariant of the constructed pattern"), so a catalog entry's path
// segment and its systematic name always agree on ordering by
// construction, not by a caller remembering to sort both the same way.
function sortedOrbitIdsSegment(orbitIds) {
    return [...orbitIds].sort((a, b) => a - b).join('+');
}

function catalogRelativePath(shape, order, groupToken, orbitIds) {
    const count = orbitIds.length;
    const idsSegment = sortedOrbitIdsSegment(orbitIds);
    return path.posix.join('gallery', shape, String(order), `k${count}`, groupToken, `${idsSegment}.svg`);
}

// Roadmap 1.11-B: reconstructs the exact systematic name string
// (docs/terminology.md, Part B) from the same tuple a path is built
// from - byte-identical to what core/orbits.js's formatThemeLineName()
// itself would produce for a real connection set resolving to these
// same orbit ids, verified against that real function in the test
// suite (not just assumed to match by eye).
function patternNameFor(groupToken, orbitIds) {
    return `${orbitIds.length}*/${groupToken} ${sortedOrbitIdsSegment(orbitIds)}`;
}

// Roadmap 1.11 pattern catalog: one manifest.jsonl record - every field
// the design session's own manifest schema specified (path, shape,
// order, symmetryMode, groupToken, orbitIds, isSample, rendererVersion),
// plus count (redundant with orbitIds.length, but kept explicit since
// 1.11-B's own grammar treats {count} as a first-class, independently-
// meaningful field, not merely derivable array length).
function buildManifestEntry({ shape, order, symmetryMode, groupToken, orbitIds, isSample, rendererVersion }) {
    const sortedIds = [...orbitIds].sort((a, b) => a - b);
    return {
        path: catalogRelativePath(shape, order, groupToken, orbitIds),
        shape,
        order,
        symmetryMode,
        groupToken,
        count: sortedIds.length,
        orbitIds: sortedIds,
        isSample: !!isSample,
        rendererVersion,
    };
}

module.exports = { catalogRelativePath, patternNameFor, buildManifestEntry, sortedOrbitIdsSegment };
