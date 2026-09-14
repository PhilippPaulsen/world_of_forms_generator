/**
 * tools/gallery/generate.js
 * Roadmap 1.11 pattern catalog, phase (a): the batch driver - full
 * enumeration only (kCombinations()), idempotent/resumable (design
 * session, point 4: skips a target whose file already exists rather
 * than re-rendering it), appends to gallery/manifest.jsonl.
 *
 * Phase (a)'s own explicit scope: this script can run for ANY job list,
 * but this session only invokes it for one small, fully hand-checkable
 * job (triangle order 3, k=2/3/4 - see runVerificationBatch() below).
 * The point-2 full scope (all shapes/orders) and the point-8 sampling
 * strategy for combination counts too large to fully enumerate are
 * deliberately NOT decided or invoked here - a separate, later phase,
 * per the design session's own explicit "don't build the full batch or
 * the sampling strategy yet" instruction.
 */
const fs = require('fs');
const path = require('path');
const { createShapeOrderRenderer, RENDERER_VERSION } = require('./renderSingleCellSVG.js');
const { catalogRelativePath, buildManifestEntry } = require('./catalogPath.js');
const { kCombinations } = require('./combinations.js');

const ROOT = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'gallery', 'manifest.jsonl');

// Roadmap 1.11 pattern catalog, point 4 (idempotent/resumable): a
// target is skipped - not re-rendered, not re-appended to the manifest
// - when its expected output file already exists on disk. Re-running
// this script after generation-scope grows only ever adds the newly-
// in-scope targets, never touches what's already there.
function generateJob({ shape, order, symmetryMode = 'rotation_reflection6', kValues, isSample = false }) {
    const renderer = createShapeOrderRenderer(shape, order, symmetryMode);
    const orbitCount = renderer.table.orbits.length;
    const stats = { generated: 0, skipped: 0, totalMs: 0 };
    const manifestLines = [];

    kValues.forEach(k => {
        const combos = kCombinations(orbitCount, k);
        combos.forEach(orbitIds => {
            const relPath = catalogRelativePath(shape, order, renderer.groupToken, orbitIds);
            const absPath = path.join(ROOT, relPath);
            const entry = buildManifestEntry({ shape, order, symmetryMode, groupToken: renderer.groupToken, orbitIds, isSample, rendererVersion: RENDERER_VERSION });
            if (fs.existsSync(absPath)) {
                stats.skipped++;
                return;
            }
            const t0 = process.hrtime.bigint();
            const svg = renderer.renderCombo(orbitIds);
            fs.mkdirSync(path.dirname(absPath), { recursive: true });
            fs.writeFileSync(absPath, svg);
            const t1 = process.hrtime.bigint();
            stats.totalMs += Number(t1 - t0) / 1e6;
            stats.generated++;
            manifestLines.push(JSON.stringify(entry));
        });
    });

    if (manifestLines.length > 0) {
        fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
        fs.appendFileSync(MANIFEST_PATH, manifestLines.join('\n') + '\n');
    }
    return { orbitCount, groupToken: renderer.groupToken, ...stats };
}

// Roadmap 1.11 pattern catalog, phase (a)'s own verification scope
// (design session go-ahead): triangle order 3 - N=4 orbits, so k=2/3/4
// gives exactly 6+4+1=11 entries, small enough to check every single
// one by hand against an independent reference (see the accompanying
// verification script) rather than sampling or trusting aggregate
// counts alone.
function runVerificationBatch() {
    const t0 = process.hrtime.bigint();
    const result = generateJob({ shape: 'triangle', order: 3, kValues: [2, 3, 4], isSample: false });
    const t1 = process.hrtime.bigint();
    const wallMs = Number(t1 - t0) / 1e6;
    console.log(`triangle order 3 (groupToken=${result.groupToken}, ${result.orbitCount} orbits): generated=${result.generated}, skipped=${result.skipped}`);
    console.log(`render-only time: ${result.totalMs.toFixed(2)}ms total (${(result.totalMs / Math.max(1, result.generated)).toFixed(3)}ms/entry avg)`);
    console.log(`wall time (incl. renderer setup, fs writes): ${wallMs.toFixed(2)}ms`);
}

if (require.main === module) {
    runVerificationBatch();
}

module.exports = { generateJob, runVerificationBatch };
