// G6b (task 063): tree-agnostic SVG measurement (see tools/grid/measure-g5a.js): the SAME file runs in a checkout of the old commit and in the working tree.
// For every case it records the sha of the SVG text, the sha of the SVG without the optional <title> line, and the title (null in the old tree).
//   node tools/grid/measure-g6b.js > out.json
'use strict';
const crypto = require('crypto');
const path = require('path');
const H = require(path.join(__dirname, '..', 'morph', 'render-harness.js'));
const h = (x) => crypto.createHash('sha256').update(x).digest('hex').slice(0, 16);
const out = {};
const TITLE = /  <title>[^\n]*<\/title>\n/;
function svgOf(w) {
    const sb = w.sb;
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.lineColor = '#000000';
    ['fill', 'noFill', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect'].forEach((n) => { sb[n] = () => { }; });
    sb.CLOSE = 'close';
    const svg = w.get('generateSVGString()');
    const m = TITLE.exec(svg);
    return { raw: h(svg), plain: h(svg.replace(TITLE, '')), title: m ? m[0].trim() : null, len: svg.length };
}
const reps = (w, n) => w.run('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())').slice(0, n);
for (const shape of ['triangle', 'square', 'hex']) for (const order of [2, 3]) for (const sym of ['rotation_reflection6', 'rotation_reflection3', 'rotation3', 'none']) for (const faces of [false, true]) {
    const key = [shape, order, sym, faces ? 'faces' : 'lines'].join('/');
    try {
        const w = H.makeRenderWorld(shape, order, 3, sym);
        w.baseConnections(reps(w, 5));
        w.run('showFaces = ' + faces + ';');
        out[key] = svgOf(w);
    } catch (e) { out[key] = 'threw: ' + String(e && e.message).slice(0, 120); }
}
// a free endpoint (no systematic name) and a layer with its own line
for (const shape of ['triangle', 'square', 'hex']) {
    const key = ['free', shape].join('/');
    try {
        const w = H.makeRenderWorld(shape, 3, 3, 'rotation_reflection6');
        w.baseConnections(reps(w, 2));
        w.run('nodes.push({ id: nodes.length + 1, x: 41.25, y: 99.5, free: true }); connections.push([1, nodes.length]);');
        out[key] = svgOf(w);
    } catch (e) { out[key] = 'threw: ' + String(e && e.message).slice(0, 120); }
}
// a morph frame (the SVG export draws the frame the canvas shows)
const CONNS = { square: [[1, 5], [2, 8], [3, 7]], triangle: [[1, 5], [2, 6], [3, 4]], hex: [[1, 10], [3, 14], [5, 20]] };
const ALT = { square: [[1, 9], [2, 6], [4, 8]], triangle: [[1, 6], [2, 5], [3, 5]], hex: [[2, 11], [4, 15], [6, 21]] };
for (const shape of ['square', 'triangle', 'hex']) for (const mode of ['linear', 'radial']) for (const t of [0, 0.5, 1]) {
    const key = ['morph', shape, mode, t].join('/');
    try {
        const w = H.makeRenderWorld(shape, 3, 3, 'rotation_reflection3');
        w.baseConnections(CONNS[shape]);
        const a = w.addKeyframeLayer(CONNS[shape]), b = w.addKeyframeLayer(ALT[shape]);
        w.setTimeline([a, b]);
        w.setMorph({ enabled: true, mode, angleDeg: mode === 'linear' ? 135 : 0 });
        w.set(`timeline.elapsedMs = ${t * 2000};`);
        out[key] = svgOf(w);
    } catch (e) { out[key] = 'threw: ' + String(e && e.message).slice(0, 120); }
}
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
