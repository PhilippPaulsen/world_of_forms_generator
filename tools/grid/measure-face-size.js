// Task 075, part 1 (measurement, no change): what a size change does to the face colours, and why the faces of a triangle or a hexagon do not always survive it.
//   node tools/grid/measure-face-size.js      -> JSON on stdout
// A. the default gray: ensureDefaultGrayFill() writes one gray per trail, ranked by area ('cyclic' over computeFaceTrails(), largest first): the sequence of grays by area rank at size 1..9, per shape.
// B. the faces per size: computeCellFaces() of the SAME lines at size 1..9 (face count and node count), per shape x ordnung 2..4 x lage 1/2 and two line sets (the first 4 theme-line orbit
//    representatives; four lines of a deterministic generator). Three variants of core/faces.js, the two others written to a temporary copy (the repository is not touched):
//      as is (FACE_EPSILON = 0.5 px absolute) | relative (FACE_EPSILON = 0.5 * 5 / size: the same snapping in units of the shape) | none (FACE_EPSILON = 1e-6).
//    A combination is "size-free" when the face count is the same at all nine sizes.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const H = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const J = JSON.stringify;
const SHAPES = ['triangle', 'square', 'hex'], SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9], MODE = 'rotation_reflection6';
const out = {};
const setup = (w, shape, ord, lage, size) => w.set(`__FE = typeof __FEF === 'function' ? __FEF(${size}) : undefined; currentShape = ${J(shape)}; projectGridSpec(${J({ shape, ordnung: ord, lage })}); shapeSizeFactor = ${size}; symmetryMode = ${J(MODE)}; connections = []; additionalLayers = []; timeline = null; baseFaceAssignments = new Map(); rebuildGrid(currentShape);`);

// ---- A. the default gray ----------------------------------------------------------------------------------------------------------------------
{
    const A = {};
    for (const shape of SHAPES) {
        const w = H.makeRenderWorld(shape, 3, 3, MODE), seqs = new Set(); let n = 0, trailsN = 0;
        for (const size of SIZES) {
            setup(w, shape, 3, 1, size);
            w.set('connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 3);');
            const seq = w.get(`(function () { const r = computeCellFaces(connections, nodes, baseFaceAssignments); const g = getGroupElementsCached(nodes, centroid, currentShape, symmetryMode, outerCorners);
                const t = computeFaceTrails(r, g); return { n: t.length, grays: t.map(tr => { const a = baseFaceAssignments.get(tr.key); return a ? a.rule + ':' + a.params.memberIndex : null; }), real: Array.from(baseFaceAssignments.values()).filter(a => a.rule !== 'max-contrast-gray').length }; })()`);
            seqs.add(J(seq.grays)); n++; trailsN = seq.n;
        }
        A[shape] = { sizes: n, trails: trailsN, distinctGraySequencesByAreaRank: seqs.size, sample: JSON.parse([...seqs][0]).slice(0, 6) };
    }
    out.A_defaultGray = A;
}

// ---- B. faces per size, three variants of core/faces.js -----------------------------------------------------------------------------------------
{
    const src = fs.readFileSync(path.join(ROOT, 'core', 'faces.js'), 'utf8');
    const line = 'const FACE_EPSILON = 0.5;';
    if (!src.includes(line)) throw new Error('FACE_EPSILON line not found');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'face-eps-'));
    const copy = path.join(dir, 'faces-eps.js');
    fs.writeFileSync(copy, src.replace(line, "Object.defineProperty(globalThis, 'FACE_EPSILON', { get() { return typeof __FE === 'number' ? __FE : 0.5; }, configurable: true });"));
    const VARIANTS = { asIs: null, relative: (size) => 0.5 * 5 / size, none: () => 1e-6 };
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const B = {};
    for (const [vname, fe] of Object.entries(VARIANTS)) {
        const rec = { combos: 0, sizeFree: 0, varying: [] };
        for (const shape of SHAPES) {
            const w = H.makeRenderWorld(shape, 3, 3, MODE, vname === 'asIs' ? undefined : { 'core/faces.js': copy });
            if (fe) w.sb.__FEF = fe;
            for (const lage of [1, 2]) for (let ord = 2; ord <= 4; ord++) for (const set of ['reps', 'lcg']) {
                setup(w, shape, ord, lage, 5);
                const nn = w.get('nodes.length');
                const conns = set === 'reps' ? w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice()).slice(0, 4)')
                    : [1, 2, 3, 4].map(() => { const a = 1 + Math.floor(rnd() * nn); let b = 1 + Math.floor(rnd() * nn); if (b === a) b = (a % nn) + 1; return [a, b]; });
                const counts = SIZES.map(size => { setup(w, shape, ord, lage, size); w.set(`connections = ${J(conns)};`); return w.get('computeCellFaces(connections, nodes, null).faces.length'); });
                rec.combos++;
                if (new Set(counts).size === 1) rec.sizeFree++; else rec.varying.push(`${shape}/${ord}/${lage}/${set}: ${counts.join(',')}`);
            }
        }
        B[vname] = rec;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    out.B_facesPerSize = B;
}
process.stdout.write(J(out, null, 1) + '\n');
