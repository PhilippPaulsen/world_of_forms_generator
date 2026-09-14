/**
 * tools/gallery/combinations.js
 * Roadmap 1.11 pattern catalog, phase (a): plain k-combinations of
 * orbit ids {0..orbitCount-1} - used for FULL enumeration only (this
 * phase's own explicit scope). The sampling strategy for combination
 * counts too large to fully enumerate (design session, point 2/8) is
 * deliberately NOT built here - that's its own, separately-thought-
 * through follow-on, not part of this phase.
 */

// Standard combinatorial generation, ascending lexicographic order -
// deterministic and reproducible (same order every run), matching this
// project's own general preference for deterministic, non-arbitrary
// enumeration (e.g. core/orbits.js's own canonical orbit indexing).
function kCombinations(n, k) {
    if (k < 0 || k > n) return [];
    const result = [];
    const combo = [];
    function recurse(start) {
        if (combo.length === k) { result.push(combo.slice()); return; }
        for (let i = start; i < n; i++) {
            combo.push(i);
            recurse(i + 1);
            combo.pop();
        }
    }
    recurse(0);
    return result;
}

module.exports = { kCombinations };
