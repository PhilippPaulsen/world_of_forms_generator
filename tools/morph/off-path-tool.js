// Regenerates or prints the data of the "switch OFF changes nothing" proof (morph stage c). Not a test.
//   node tools/morph/off-path-tool.js --write-specs     (re)write tools/morph/off-path-specs.json: the 30 patterns (12 from the colour corpus tools/color/corpus.js, 6 with layers, 6 with a timeline,
//                                                        3 with a net warp, 3 with curves); deterministic
//   node tools/morph/off-path-tool.js --hashes          print the segment hash of every pattern for the CURRENT tree (a frame = every line() / bezier() call drawTessellation() makes, in drawing order: curves and free lines count, not only the chords)
//   TILING_JS=/path/to/old/tiling.js node tools/morph/off-path-tool.js --hashes     the same with another core/tiling.js (the tree before the hook, from `git show <commit>:core/tiling.js`)
// Regenerate the golden hashes in tools/morph/test-spatial-morph-render.js (OFF_GOLDEN) from the tree you trust and the pixel hashes (tools/morph/off-path-golden.json) with
// tools/morph/measure-off-path.js in the browser pane; see the header of that file.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SPECS = path.join(__dirname, 'off-path-specs.json');

function buildSpecs() {
    const C = require('../color/corpus.js');
    const P = C.buildPatterns();
    const out = [];
    const corpus = [0, 10, 38, 63, 89, 119, 144, 172, 201, 230, 5, 100];
    corpus.forEach((i) => { const p = P[i]; out.push({ id: 'corpus-' + i, group: 'corpus', shape: p.sh.shape, order: p.sh.order, size: 3, mode: p.sh.mode, connections: p.ids.map((k) => p.sh.reps[k].slice()) }); });
    const sq = { shape: 'square', order: 3, size: 3, mode: 'rotation_reflection3', connections: [[1, 5], [2, 8], [3, 7]] };
    const L = (shape, order, size, mode, conns, o) => Object.assign({ shape, order, size, mode, connections: conns, offsetX: 0, offsetY: 0, rotation: 0, enabled: true }, o || {});
    out.push(Object.assign({ id: 'layers-offset', group: 'layers' }, sq, { layers: [L('square', 3, 3, 'rotation_reflection3', [[1, 9], [3, 7]], { offsetX: 20, offsetY: -10 })] }));
    out.push(Object.assign({ id: 'layers-rotated', group: 'layers' }, sq, { layers: [L('square', 3, 3, 'none', [[2, 6], [4, 8]], { rotation: 17 })] }));
    out.push(Object.assign({ id: 'layers-scaled', group: 'layers' }, sq, { layers: [L('square', 3, 4.5, 'reflection_only', [[1, 6], [2, 9]])] }));
    out.push(Object.assign({ id: 'layers-hex-on-square', group: 'layers' }, sq, { layers: [L('hex', 2, 3, 'rotation3', [[1, 4], [2, 6]])] }));
    out.push(Object.assign({ id: 'layers-two', group: 'layers' }, sq, { layers: [L('square', 3, 3, 'none', [[1, 9], [3, 7]], { offsetX: -30 }), L('square', 3, 3, 'rotation_reflection3', [[2, 6], [4, 8]], { offsetY: 25, rotation: 90 })] }));
    out.push({ id: 'layers-triangle-on-hex', group: 'layers', shape: 'hex', order: 3, size: 3, mode: 'rotation6', connections: [[1, 10], [3, 14], [5, 20]], layers: [L('triangle', 3, 3, 'reflection_only', [[1, 5], [2, 6]], { offsetX: 12 })] });
    const kf = (conns, o) => L('square', 3, 3, 'rotation_reflection3', conns, Object.assign({ enabled: false }, o || {}));
    const two = [kf([[1, 5], [2, 8]]), kf([[2, 6], [4, 8]])];
    const three = two.concat([kf([[1, 9], [3, 7]], { offsetX: 15 })]);
    const t = (id, layers, ids, progress, playing) => Object.assign({ id, group: 'timeline' }, sq, { connections: [[1, 5], [2, 8]], layers, timeline: { keyframes: ids, progress, playing } });
    out.push(t('timeline-2kf-start', two, [0, 1], 0, false));
    out.push(t('timeline-3kf-paused-05', three, [0, 1, 2], 0.05, false));
    out.push(t('timeline-2kf-play-25', two, [0, 1], 0.25, true));
    out.push(t('timeline-2kf-play-50', two, [0, 1], 0.5, true));
    out.push(t('timeline-3kf-play-60', three, [0, 1, 2], 0.6, true));
    out.push(t('timeline-3kf-play-90', three, [0, 1, 2], 0.9, true));
    out.push(Object.assign({ id: 'net-sin-field', group: 'net' }, sq, { net: { x: { kind: 'trig', w: 0.3 }, y: 'same', repeat: false, domain: 'field' } }));
    out.push(Object.assign({ id: 'net-tiled', group: 'net' }, sq, { net: { x: { kind: 'trig', w: -0.4 }, y: 'same', repeat: false, domain: 'tiled' } }));
    out.push(Object.assign({ id: 'net-geo', group: 'net' }, sq, { net: { x: { kind: 'geometric', w: 0.5, alternate: true }, y: 'same', repeat: false, domain: 'field' } }));
    out.push(Object.assign({ id: 'curve-fold2', group: 'curve' }, sq, { curve: { kind: 'curve', fold: 2, symmetric: false, leaning: 'left', strength: 25 } }));
    out.push(Object.assign({ id: 'curve-fold1-sym', group: 'curve' }, sq, { mode: 'reflection_only', curve: { kind: 'curve', fold: 1, symmetric: true, leaning: 'left', strength: 25 } }));
    out.push(Object.assign({ id: 'free-seeded', group: 'curve' }, sq, { curve: { kind: 'free', seed: 123456789, roughness: 1, strength: 25, visible: true } }));
    return out;
}

function hashes() {
    const { makeRenderWorld } = require('./render-harness.js');
    const specs = JSON.parse(fs.readFileSync(SPECS, 'utf8'));
    const { offPathScript } = require('./off-path-script.js');
    const files = process.env.TILING_JS ? { 'core/tiling.js': process.env.TILING_JS } : undefined;
    const out = {};
    specs.forEach((s) => {
        const w = makeRenderWorld(s.shape, s.order, s.size, s.mode, files);
        w.run(offPathScript(s));
        out[s.id] = crypto.createHash('sha256').update(JSON.stringify(w.drawn())).digest('hex').slice(0, 16);   // what is DRAWN: every line() and bezier() call, so curves count
    });
    return out;
}

if (require.main === module) {
    if (process.argv.includes('--write-specs')) { fs.writeFileSync(SPECS, JSON.stringify(buildSpecs(), null, 0).replace(/\},\{"id"/g, '},\n{"id"') + '\n'); console.log('wrote', SPECS); }
    else if (process.argv.includes('--hashes')) console.log(JSON.stringify(hashes(), null, 1));
    else console.log('usage: --write-specs | --hashes');
}
module.exports = { buildSpecs, hashes, SPECS };
